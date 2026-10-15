import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { verifyAdminRole } from "@/lib/admin-access";
import { inspectQuoteRuntime } from "@/lib/quote-runtime-diagnostics";
import {
  buildQuoteRequestSnapshot,
  hashQuoteClientIp,
  quoteSubmissionInputSchema,
  quoteRequestSnapshotMatches,
  verifyQuoteTurnstileToken,
  quoteRequestStatusSchema,
  type QuoteRequestSnapshot,
} from "@/lib/quote-submission";
import { withQuoteRegistrationEnabled } from "@/lib/quote-registration-gate";

const unavailableMessage =
  "O registro está temporariamente indisponível. Tente novamente mais tarde.";
const rateLimitMessage =
  "Muitas tentativas foram realizadas. Aguarde antes de enviar outra solicitação.";
const conflictMessage =
  "Esta tentativa já foi registrada com dados diferentes. Atualize a página para iniciar uma nova solicitação.";

export type RegisterQuoteRequestResult =
  { ok: true; id: string } | { ok: false; reason: "unavailable" };

class QuoteRegistrationUnavailableError extends Error {}

function createQuoteServiceClient() {
  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) throw new Error(unavailableMessage);
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function readTrustedCloudflareIp(request: Request): string {
  const cloudflareRequest = request as Request & { cf?: unknown };
  if (!cloudflareRequest.cf || typeof cloudflareRequest.cf !== "object") {
    throw new Error(unavailableMessage);
  }

  const ip = request.headers.get("cf-connecting-ip")?.trim();
  const isIpv4 =
    ip?.split(".").length === 4 &&
    ip.split(".").every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  let isIpv6 = false;
  if (ip?.includes(":") && /^[0-9a-fA-F:.]+$/.test(ip)) {
    try {
      isIpv6 = new URL(`http://[${ip}]/`).hostname.startsWith("[");
    } catch {
      isIpv6 = false;
    }
  }
  if (!ip || ip.length > 45 || ip.includes(",") || (!isIpv4 && !isIpv6)) {
    throw new Error(unavailableMessage);
  }
  return ip;
}

async function loadQuoteSnapshot(
  db: ReturnType<typeof createQuoteServiceClient>,
  input: z.infer<typeof quoteSubmissionInputSchema>,
): Promise<QuoteRequestSnapshot> {
  const slugs = [...new Set(input.items.map((item) => item.slug))];
  const productsResult = await db
    .from("catalog_products")
    .select("slug,category,active,data")
    .in("slug", slugs);
  if (productsResult.error) throw new QuoteRegistrationUnavailableError();
  if (productsResult.data.length !== slugs.length) {
    throw new Error(
      "Um ou mais produtos não estão disponíveis no catálogo. Atualize a lista e tente novamente.",
    );
  }

  const categorySlugs = [...new Set(productsResult.data.map((product) => product.category))];
  const categoriesResult = await db
    .from("catalog_categories")
    .select("slug,active")
    .in("slug", categorySlugs);
  if (categoriesResult.error) throw new QuoteRegistrationUnavailableError();

  const result = buildQuoteRequestSnapshot(input, productsResult.data, categoriesResult.data);
  if (!result.ok) throw new Error(result.error);
  return result.snapshot;
}

export const registerQuoteRequest = createServerFn({ method: "POST" })
  .validator((value: unknown) => quoteSubmissionInputSchema.parse(value))
  .handler(async ({ data }) => {
    if (process.env["QUOTE_REGISTRATION_ENABLED"] !== "true") {
      return { ok: false, reason: "unavailable" } as const;
    }

    return withQuoteRegistrationEnabled(process.env["QUOTE_REGISTRATION_ENABLED"], async () => {
      const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
      const supabaseUrl = process.env["SUPABASE_URL"];
      const turnstileSecret = process.env["CLOUDFLARE_TURNSTILE_SECRET_KEY"];
      const expectedHostname = process.env["QUOTE_TURNSTILE_HOSTNAME"];
      const rateLimitSecret = process.env["QUOTE_RATE_LIMIT_HMAC_SECRET"];
      if (
        !serviceRoleKey ||
        !supabaseUrl ||
        !turnstileSecret ||
        !expectedHostname ||
        !rateLimitSecret ||
        rateLimitSecret.length < 32
      ) {
        return { ok: false, reason: "unavailable" } as const;
      }

      const request = getRequest();
      if (!request) return { ok: false, reason: "unavailable" } as const;
      const clientIp = readTrustedCloudflareIp(request);
      const db = createQuoteServiceClient();

      const existing = await db
        .from("quote_requests")
        .select("id,contact,items")
        .eq("request_key", data.requestKey)
        .maybeSingle();
      if (existing.error) throw new Error(unavailableMessage);
      if (existing.data) {
        const snapshot = await loadQuoteSnapshot(db, data);
        if (!quoteRequestSnapshotMatches(existing.data.contact, existing.data.items, snapshot)) {
          throw new Error(conflictMessage);
        }
        return { ok: true, id: existing.data.id } as const;
      }

      const verified = await verifyQuoteTurnstileToken(
        data.turnstileToken,
        clientIp,
        turnstileSecret,
        expectedHostname,
      );
      if (!verified)
        throw new Error(
          "Não foi possível validar a proteção antispam. Atualize o desafio e tente novamente.",
        );

      const snapshot = await loadQuoteSnapshot(db, data);
      const clientKeyHash = await hashQuoteClientIp(clientIp, rateLimitSecret);
      const limitResult = await db.rpc("consume_quote_submission_rate_limit", {
        _client_key_hash: clientKeyHash,
      });
      if (limitResult.error) throw new QuoteRegistrationUnavailableError();
      if (!limitResult.data) throw new Error(rateLimitMessage);

      const inserted = await db
        .from("quote_requests")
        .insert({
          request_key: data.requestKey,
          contact: snapshot.contact,
          items: snapshot.items,
        })
        .select("id")
        .single();

      if (inserted.error?.code === "23505") {
        const duplicate = await db
          .from("quote_requests")
          .select("id,contact,items")
          .eq("request_key", data.requestKey)
          .maybeSingle();
        if (duplicate.error || !duplicate.data) throw new Error(unavailableMessage);
        if (!quoteRequestSnapshotMatches(duplicate.data.contact, duplicate.data.items, snapshot)) {
          throw new Error(conflictMessage);
        }
        return { ok: true, id: duplicate.data.id } as const;
      }
      if (inserted.error || !inserted.data) throw new Error(unavailableMessage);
      return { ok: true, id: inserted.data.id } as const;
    }).catch((error: unknown) => {
      if (error instanceof QuoteRegistrationUnavailableError) {
        return { ok: false, reason: "unavailable" } as const;
      }
      throw error;
    });
  });

export const updateQuoteRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: quoteRequestStatusSchema,
      })
      .strict()
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    await verifyAdminRole(() =>
      context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      }),
    );
    const result = await context.supabase
      .from("quote_requests")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (result.error) throw new Error("Não foi possível atualizar a situação do orçamento.");
    if (!result.data) throw new Error("O orçamento não foi encontrado ou não pode ser atualizado.");
    return { ok: true };
  });

export const getQuoteRuntimeDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await verifyAdminRole(() =>
      context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      }),
    );

    return inspectQuoteRuntime(process.env, getRequest() ?? null);
  });

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const quoteRoute = readFileSync("src/routes/orcamento.tsx", "utf8");
const serverFunctions = readFileSync("src/lib/catalog.functions.ts", "utf8");
const browserClient = readFileSync("src/integrations/supabase/client.ts", "utf8");
const quoteFunctions = readFileSync("src/lib/quote.functions.ts", "utf8");
const quoteMigration = readFileSync("drizzle/manual-apply-0003-quote-management.sql", "utf8");
const formalQuoteMigration = readFileSync("drizzle/migrations/0003_quote_management.sql", "utf8");
const normalizedManualQuoteMigration = quoteMigration.replace(/\r\n/g, "\n");
const quoteMigrationJournal = JSON.parse(
  readFileSync("drizzle/migrations/meta/_journal.json", "utf8"),
) as {
  entries: Array<{ idx: number; when: number; tag: string }>;
};

it("keeps registration behind a server function and does not expose database writes to the browser", () => {
  expect(quoteRoute).not.toMatch(/saveQuote|supabase\.from|quote_requests/);
  expect(quoteRoute).toContain("registerQuoteRequest");
  expect(serverFunctions).not.toMatch(/saveQuote|supabaseAdmin|client\.server/i);
  expect(serverFunctions).not.toMatch(
    /from\(['"]quote_requests['"]\)\.(insert|upsert|update|delete)/i,
  );
  expect(quoteFunctions).toContain('process.env["SUPABASE_SERVICE_ROLE_KEY"]');
  expect(quoteFunctions).toContain('process.env["QUOTE_REGISTRATION_ENABLED"]');
  expect(quoteFunctions.indexOf("return withQuoteRegistrationEnabled")).toBeLessThan(
    quoteFunctions.indexOf('const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]'),
  );
  expect(quoteFunctions).not.toContain("request.cf");
  expect(quoteFunctions).toContain('getRequestHeader("cf-connecting-ip")');
  expect(quoteFunctions).toContain("validateQuoteClientIp");
  expect(quoteFunctions).not.toContain("x-forwarded-for");
  expect(quoteFunctions).not.toContain("x-real-ip");
  expect(quoteFunctions.indexOf("verifyQuoteTurnstileToken")).toBeLessThan(
    quoteFunctions.indexOf('rpc("consume_quote_submission_rate_limit"'),
  );
  expect(quoteFunctions.indexOf('rpc("consume_quote_submission_rate_limit"')).toBeLessThan(
    quoteFunctions.indexOf(".insert({"),
  );
  expect(quoteFunctions).toContain("await verifyAdminRole");
  expect(quoteFunctions).toContain(".middleware([requireSupabaseAuth])");
  expect(quoteRoute).not.toContain("QUOTE_REGISTRATION_ENABLED");
  expect(browserClient).not.toContain("QUOTE_REGISTRATION_ENABLED");
});

it("limits writes and personal-data reads to protected server and administrator paths", () => {
  expect(quoteMigration).toContain(
    "REVOKE ALL ON TABLE public.quote_requests FROM PUBLIC, anon, authenticated, service_role",
  );
  expect(quoteMigration).toContain("GRANT SELECT ON TABLE public.quote_requests TO authenticated");
  expect(quoteMigration).toContain(
    "GRANT SELECT, INSERT ON TABLE public.quote_requests TO service_role",
  );
  expect(quoteMigration).toContain(
    "GRANT UPDATE (status) ON TABLE public.quote_requests TO authenticated",
  );
  expect(quoteMigration).toContain("DEFAULT 'aguardando_orcamento'");
  expect(quoteMigration).toContain(
    "CHECK (status IN ('aguardando_orcamento', 'orcamento_realizado', 'compra_finalizada'))",
  );
  expect(quoteMigration).not.toMatch(
    /GRANT INSERT[^;]*ON TABLE public\.quote_requests TO (PUBLIC|anon|authenticated)/i,
  );
  expect(quoteMigration).toContain("USING (public.has_role(auth.uid(), 'admin'))");
  expect(quoteMigration).toContain(
    "GRANT EXECUTE ON FUNCTION public.consume_quote_submission_rate_limit(text) TO service_role",
  );
  expect(quoteMigration).toContain(
    "REVOKE ALL ON FUNCTION public.consume_quote_submission_rate_limit(text) FROM PUBLIC, anon, authenticated",
  );
  expect(quoteMigration).toContain("pg_advisory_xact_lock");
  expect(quoteMigration).toContain("interval '15 minutes'");
  expect(quoteMigration).toContain("interval '24 hours'");
  expect(quoteMigration).toContain("SET search_path = pg_catalog, public, pg_temp");
  const rateLimitFunction =
    quoteMigration.split("CREATE FUNCTION public.consume_quote_submission_rate_limit")[1] ?? "";
  const rateLimitBody =
    rateLimitFunction.split("CREATE FUNCTION public.cleanup_quote_submission_rate_limits")[0] ?? "";
  expect(rateLimitBody).not.toMatch(/DELETE\s+FROM\s+public\.quote_submission_rate_limits/i);
  expect(quoteMigration).toContain(
    "GRANT EXECUTE ON FUNCTION public.cleanup_quote_submission_rate_limits() TO service_role",
  );
});

it("keeps the manual script atomic and byte-equivalent to the formal schema migration", () => {
  const startMarker =
    "-- BEGIN exact schema migration body from drizzle/migrations/0003_quote_management.sql.";
  const endMarker =
    "-- END exact schema migration body from drizzle/migrations/0003_quote_management.sql.";
  const start = normalizedManualQuoteMigration.indexOf(startMarker);
  const bodyStart = normalizedManualQuoteMigration.indexOf("\n", start) + 1;
  const end = normalizedManualQuoteMigration.indexOf(endMarker, bodyStart);
  const manualBody = normalizedManualQuoteMigration.slice(bodyStart, end).trim();
  const formalBody = formalQuoteMigration.trim().replace(/\r\n/g, "\n");
  const hash = createHash("sha256")
    .update(formalQuoteMigration.replace(/\r\n/g, "\n"))
    .digest("hex");
  const migration = quoteMigrationJournal.entries.find(
    (entry) => entry.tag === "0003_quote_management",
  );

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(bodyStart);
  expect(manualBody).toBe(formalBody);
  expect(normalizedManualQuoteMigration.trimStart()).toMatch(/^--[\s\S]*?\n\nBEGIN;/);
  expect(normalizedManualQuoteMigration).toContain("\nCOMMIT;");
  expect(migration).toBeDefined();
  expect(migration?.idx).toBe(3);
  expect(normalizedManualQuoteMigration).toContain(`'${hash}',\n  ${migration?.when}`);
  expect(formalQuoteMigration).toContain("cleanup_quote_submission_rate_limits");
});

it("does not place privileged Supabase credentials in the browser client", () => {
  expect(browserClient).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  expect(browserClient).not.toContain("client.server");
});

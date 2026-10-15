export const EXPECTED_QUOTE_TURNSTILE_HOSTNAME = "pixely-perfect-render.lovable.app";

export type QuoteRuntimeDiagnostics = {
  supabaseServiceRoleKeyConfigured: boolean;
  supabaseUrlConfigured: boolean;
  supabasePublishableKeyConfigured: boolean;
  turnstileSecretKeyConfigured: boolean;
  turnstileHostnameConfigured: boolean;
  turnstileHostnameMatchesExpected: boolean;
  rateLimitHmacSecretConfigured: boolean;
  cloudflareWorkerMetadataPresent: boolean;
  cfConnectingIpHeaderPresent: boolean;
};

type RuntimeEnvironment = Record<string, string | undefined>;

export function inspectQuoteRuntime(
  environment: RuntimeEnvironment,
  request: Request | null,
): QuoteRuntimeDiagnostics {
  const cloudflareRequest = request as (Request & { cf?: unknown }) | null;
  const turnstileHostname = environment["QUOTE_TURNSTILE_HOSTNAME"]?.trim() ?? "";

  return {
    supabaseServiceRoleKeyConfigured: Boolean(environment["SUPABASE_SERVICE_ROLE_KEY"]?.trim()),
    supabaseUrlConfigured: Boolean(environment["SUPABASE_URL"]?.trim()),
    supabasePublishableKeyConfigured: Boolean(environment["SUPABASE_PUBLISHABLE_KEY"]?.trim()),
    turnstileSecretKeyConfigured: Boolean(environment["CLOUDFLARE_TURNSTILE_SECRET_KEY"]?.trim()),
    turnstileHostnameConfigured: Boolean(turnstileHostname),
    turnstileHostnameMatchesExpected:
      turnstileHostname.toLowerCase() === EXPECTED_QUOTE_TURNSTILE_HOSTNAME,
    rateLimitHmacSecretConfigured: (environment["QUOTE_RATE_LIMIT_HMAC_SECRET"]?.length ?? 0) >= 32,
    cloudflareWorkerMetadataPresent:
      typeof cloudflareRequest?.cf === "object" && cloudflareRequest.cf !== null,
    cfConnectingIpHeaderPresent: Boolean(request?.headers.get("cf-connecting-ip")?.trim()),
  };
}

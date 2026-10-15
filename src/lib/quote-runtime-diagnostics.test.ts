import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPECTED_QUOTE_TURNSTILE_HOSTNAME,
  inspectQuoteRuntime,
} from "./quote-runtime-diagnostics";

const quoteFunctions = readFileSync("src/lib/quote.functions.ts", "utf8");

describe("quote runtime diagnostics", () => {
  it("returns only boolean presence indicators and compares the configured hostname", () => {
    const secret = "private-test-value";
    const request = new Request("https://example.test/");
    request.headers.set("cf-connecting-ip", "203.0.113.42");
    Object.defineProperty(request, "cf", { value: { colo: "test" } });

    const diagnostics = inspectQuoteRuntime(
      {
        SUPABASE_SERVICE_ROLE_KEY: secret,
        SUPABASE_URL: "https://project.example.test",
        SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
        CLOUDFLARE_TURNSTILE_SECRET_KEY: "turnstile-test-secret",
        QUOTE_TURNSTILE_HOSTNAME: EXPECTED_QUOTE_TURNSTILE_HOSTNAME,
        QUOTE_RATE_LIMIT_HMAC_SECRET: "test-rate-limit-secret-long-enough-32",
      },
      request,
    );

    expect(Object.values(diagnostics).every((value) => typeof value === "boolean")).toBe(true);
    expect(diagnostics).toEqual({
      supabaseServiceRoleKeyConfigured: true,
      supabaseUrlConfigured: true,
      supabasePublishableKeyConfigured: true,
      turnstileSecretKeyConfigured: true,
      turnstileHostnameConfigured: true,
      turnstileHostnameMatchesExpected: true,
      rateLimitHmacSecretConfigured: true,
      cloudflareWorkerMetadataPresent: true,
      cfConnectingIpHeaderPresent: true,
    });
    expect(JSON.stringify(diagnostics)).not.toContain(secret);
    expect(JSON.stringify(diagnostics)).not.toContain("203.0.113.42");
  });

  it("reports missing, blank, or mismatched values without returning their contents", () => {
    const diagnostics = inspectQuoteRuntime(
      {
        SUPABASE_SERVICE_ROLE_KEY: " ",
        SUPABASE_URL: "",
        SUPABASE_PUBLISHABLE_KEY: undefined,
        CLOUDFLARE_TURNSTILE_SECRET_KEY: undefined,
        QUOTE_TURNSTILE_HOSTNAME: "wrong.example.test",
        QUOTE_RATE_LIMIT_HMAC_SECRET: "short",
      },
      new Request("https://example.test/"),
    );

    expect(Object.values(diagnostics).every((value) => typeof value === "boolean")).toBe(true);
    expect(diagnostics).toEqual({
      supabaseServiceRoleKeyConfigured: false,
      supabaseUrlConfigured: false,
      supabasePublishableKeyConfigured: false,
      turnstileSecretKeyConfigured: false,
      turnstileHostnameConfigured: true,
      turnstileHostnameMatchesExpected: false,
      rateLimitHmacSecretConfigured: false,
      cloudflareWorkerMetadataPresent: false,
      cfConnectingIpHeaderPresent: false,
    });
    expect(JSON.stringify(diagnostics)).not.toContain("wrong.example.test");
  });

  it("protects the server diagnostic with authentication and an administrator role check before inspection", () => {
    const diagnosticFunctionStart = quoteFunctions.indexOf(
      "export const getQuoteRuntimeDiagnostics",
    );
    const diagnosticFunction = quoteFunctions.slice(diagnosticFunctionStart);

    expect(diagnosticFunction).toContain(".middleware([requireSupabaseAuth])");
    expect(diagnosticFunction.indexOf("await verifyAdminRole")).toBeGreaterThanOrEqual(0);
    expect(diagnosticFunction.indexOf("await verifyAdminRole")).toBeLessThan(
      diagnosticFunction.indexOf("inspectQuoteRuntime(process.env"),
    );
    expect(diagnosticFunction).not.toMatch(
      /\.from\(['"]quote_requests['"]\)\.(insert|update|delete)/,
    );
  });
});

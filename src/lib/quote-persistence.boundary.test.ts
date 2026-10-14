import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const quoteRoute = readFileSync('src/routes/orcamento.tsx', 'utf8');
const serverFunctions = readFileSync('src/lib/catalog.functions.ts', 'utf8');
const browserClient = readFileSync('src/integrations/supabase/client.ts', 'utf8');

it('does not expose a public endpoint or call that writes quote requests', () => {
  expect(quoteRoute).not.toMatch(/saveQuote|useServerFn|registerQuote/i);
  expect(serverFunctions).not.toMatch(/saveQuote|supabaseAdmin|client\.server/i);
  expect(serverFunctions).not.toMatch(/from\(['"]quote_requests['"]\)\.(insert|upsert|update|delete)/i);
});

it('does not place privileged Supabase credentials in the browser client', () => {
  expect(browserClient).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  expect(browserClient).not.toContain('client.server');
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle", "migrations", "0004_admin_product_order.sql"),
  "utf8",
);
const journal = JSON.parse(
  readFileSync(resolve(process.cwd(), "drizzle", "migrations", "meta", "_journal.json"), "utf8"),
) as { entries: Array<{ idx: number; tag: string; when: number }> };

describe("administrative product order migration", () => {
  it("backfills a separate order without narrowing numeric values and uses deterministic fallbacks", () => {
    expect(migration).toMatch(/ADD COLUMN admin_order integer NOT NULL DEFAULT 2147483647/i);
    expect(migration).toMatch(/data->>'order'/i);
    expect(migration).toMatch(/length\(ltrim\(data->>'order', '0'\)\)/i);
    expect(migration).toMatch(/END COLLATE "C",\s*slug COLLATE "C"/i);
    expect(migration).not.toMatch(/\(data->>'order'\)::integer/i);
    expect(migration).toMatch(/row_number\(\) OVER\s*\([\s\S]*?slug/i);
    expect(migration).not.toMatch(/SET\s+data\s*=/i);
    expect(migration).toMatch(/CREATE INDEX catalog_products_admin_order_idx/i);
  });

  it("registers the migration after 0003 in the Drizzle journal", () => {
    expect(journal.entries.map(({ idx }) => idx)).toEqual([0, 1, 2, 3, 4]);
    expect(journal.entries[4]).toMatchObject({
      idx: 4,
      tag: "0004_admin_product_order",
    });
    expect(journal.entries[4]?.when ?? Number.NEGATIVE_INFINITY).toBeGreaterThan(
      journal.entries[3]?.when ?? Number.POSITIVE_INFINITY,
    );
  });

  it("restricts and atomically validates administrator reorder requests", () => {
    expect(migration).toMatch(/SECURITY DEFINER/i);
    expect(migration).toMatch(/public\.has_role\(auth\.uid\(\), 'admin'\)/i);
    expect(migration).toMatch(/LOCK TABLE public\.catalog_products IN SHARE ROW EXCLUSIVE MODE/i);
    expect(migration).toMatch(/count\(DISTINCT requested\.slug\)/i);
    expect(migration).toMatch(/cardinality\(_slugs\) <> \(SELECT count\(\*\) FROM public\.catalog_products\)/i);
    expect(migration).toMatch(/UPDATE public\.catalog_products[\s\S]*?SET admin_order = \(requested\.sort_position - 1\)::integer/i);
    expect(migration).toMatch(/REVOKE ALL[\s\S]*?FROM PUBLIC, anon, service_role/i);
    expect(migration).toMatch(/GRANT EXECUTE[\s\S]*?TO authenticated/i);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle", "migrations", "0002_homepage_banners.sql"),
  "utf8",
);
const catalogMigration = readFileSync(
  resolve(process.cwd(), "drizzle", "migrations", "0000_majesta_catalog_admin.sql"),
  "utf8",
);
const journal = JSON.parse(
  readFileSync(resolve(process.cwd(), "drizzle", "migrations", "meta", "_journal.json"), "utf8"),
) as { entries: Array<{ idx: number; tag: string }> };
const supabaseTypes = readFileSync(
  resolve(process.cwd(), "src", "integrations", "supabase", "types.ts"),
  "utf8",
);

describe("homepage banner migration", () => {
  it("is registered after the existing migrations and references the existing product key", () => {
    expect(
      journal.entries.some((entry) => entry.idx === 2 && entry.tag === "0002_homepage_banners"),
    ).toBe(true);
    expect(catalogMigration).toMatch(
      /CREATE TABLE public\.catalog_products \(slug text primary key/i,
    );
    expect(supabaseTypes).toMatch(
      /foreignKeyName: "homepage_banners_product_slug_fkey"[\s\S]*columns: \["product_slug"\][\s\S]*referencedRelation: "catalog_products"[\s\S]*referencedColumns: \["slug"\]/i,
    );
  });

  it("isolates banner reads with RLS and restricts changes to admins", () => {
    expect(migration).toMatch(/ALTER TABLE public\.homepage_banners ENABLE ROW LEVEL SECURITY/i);
    expect(migration).toMatch(
      /CREATE POLICY public_eligible_homepage_banners[\s\S]*TO anon, authenticated[\s\S]*active[\s\S]*archived_at IS NULL[\s\S]*starts_at[\s\S]*ends_at/i,
    );
    expect(migration).toMatch(
      /CREATE POLICY admin_manage_homepage_banners[\s\S]*public\.has_role\(auth\.uid\(\), 'admin'\)/i,
    );
    expect(migration).toMatch(/GRANT SELECT ON public\.homepage_banners TO anon, authenticated/i);
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.homepage_banners FROM PUBLIC, anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(/GRANT INSERT, UPDATE ON public\.homepage_banners TO authenticated/i);
    expect(migration).not.toMatch(/GRANT [^;]*DELETE[^;]* ON public\.homepage_banners/i);
    expect(migration).toMatch(
      /GRANT SELECT, INSERT, UPDATE ON public\.homepage_banners TO service_role/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.reorder_homepage_banners\(uuid\[\]\) FROM PUBLIC, anon, service_role/i,
    );
  });

  it("prevents cascading product removal and performs complete order updates in one RPC", () => {
    expect(migration).toMatch(
      /REFERENCES public\.catalog_products\(slug\)\s+ON DELETE RESTRICT\s+ON UPDATE RESTRICT/i,
    );
    expect(migration).toMatch(/CREATE FUNCTION public\.reorder_homepage_banners\(_ids uuid\[\]\)/i);
    expect(migration).toMatch(/Banner order must include every banner exactly once/i);
    expect(migration).toMatch(/UPDATE public\.homepage_banners AS b[\s\S]*WITH ORDINALITY/i);
  });

  it("validates stored image paths, uses the catalog demo fields, and maintains update timestamps", () => {
    expect(migration).toMatch(/homepage_banners_image_required CHECK[\s\S]*btrim\(image_path\)/i);
    expect(migration).toMatch(/homepage_banners_image_path_valid CHECK[\s\S]*banners\//i);
    expect(migration).toMatch(
      /homepage_banners_mobile_image_path_valid CHECK[\s\S]*mobile_image_path IS NULL/i,
    );
    expect(migration).toMatch(/p\.data -> 'featured' = 'true'::jsonb/i);
    expect(migration).toMatch(/p\.data -> 'demo'/i);
    expect(migration).toMatch(
      /CREATE TRIGGER homepage_banners_set_updated_at[\s\S]*BEFORE UPDATE/i,
    );
    expect(migration).not.toMatch(/ALTER TABLE public\.(catalog_products|catalog_categories)/i);
    expect(migration).not.toMatch(/DROP TABLE/i);
  });
});

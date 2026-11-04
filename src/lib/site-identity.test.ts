import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  brandIconLinks,
  homepageCanonicalLink,
  homepageIdentityScripts,
  organizationStructuredData,
} from "./site-identity";

describe("site identity metadata", () => {
  it("uses the official public brand icons with suitable square sizes", () => {
    for (const [file, size] of [
      ["favicon-96.png", 96],
      ["favicon.png", 64],
      ["apple-touch-icon.png", 180],
      ["majesta-logo.png", 1254],
    ] as const) {
      const png = readFileSync(join(process.cwd(), "public", file));
      expect(png.toString("ascii", 1, 4)).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }

    expect(brandIconLinks).toContainEqual({
      rel: "icon",
      type: "image/png",
      href: "/favicon-96.png",
      sizes: "96x96",
    });
    expect(brandIconLinks).toContainEqual({
      rel: "apple-touch-icon",
      href: "/apple-touch-icon.png",
      sizes: "180x180",
    });
  });

  it("sets the official HTTPS homepage as canonical", () => {
    expect(homepageCanonicalLink).toEqual({
      rel: "canonical",
      href: "https://majestaembalagens.com.br/",
    });
  });

  it("publishes one Organization JSON-LD record with confirmed business details", () => {
    expect(homepageIdentityScripts).toHaveLength(1);
    expect(homepageIdentityScripts[0]?.type).toBe("application/ld+json");
    expect(JSON.parse(homepageIdentityScripts[0]!.children)).toEqual(organizationStructuredData);
    expect(organizationStructuredData).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Majesta Embalagens",
      legalName: "69.795.523 THAYSA SILVA VARELA DE VASCONCELOS",
      url: "https://majestaembalagens.com.br/",
      logo: "https://majestaembalagens.com.br/majesta-logo.png",
      email: "contato@majestaembalagens.com.br",
      telephone: "+55 19 99614-5193",
      identifier: {
        "@type": "PropertyValue",
        propertyID: "CNPJ",
        value: "69.795.523/0001-78",
      },
    });
    expect(organizationStructuredData).not.toHaveProperty("sameAs");
    expect(organizationStructuredData).not.toHaveProperty("openingHours");
  });
});

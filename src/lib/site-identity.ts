export const SITE_ORIGIN = "https://majestaembalagens.com.br";

export const organizationStructuredData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Majesta Embalagens",
  legalName: "69.795.523 THAYSA SILVA VARELA DE VASCONCELOS",
  url: `${SITE_ORIGIN}/`,
  logo: `${SITE_ORIGIN}/majesta-logo.png`,
  email: "contato@majestaembalagens.com.br",
  telephone: "+55 19 99614-5193",
  identifier: {
    "@type": "PropertyValue",
    propertyID: "CNPJ",
    value: "69.795.523/0001-78",
  },
} as const;

export const homepageIdentityScripts = [
  { type: "application/ld+json", children: JSON.stringify(organizationStructuredData) },
] as const;

export const brandIconLinks = [
  { rel: "icon", type: "image/png", href: "/favicon-96.png", sizes: "96x96" },
  { rel: "icon", type: "image/png", href: "/favicon.png", sizes: "64x64" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
] as const;

export const homepageCanonicalLink = {
  rel: "canonical",
  href: `${SITE_ORIGIN}/`,
} as const;

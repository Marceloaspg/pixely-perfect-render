// Dados de contato oficiais. Preencha com as informações reais da Majesta.
// WhatsApp: somente dígitos com DDI e DDD, ex.: "5511999999999".
export const siteConfig = {
  whatsapp: "",
  email: "",
  instagram: "",
  facebook: "",
};

export function whatsappLink(text: string) {
  const base = siteConfig.whatsapp ? `https://wa.me/${siteConfig.whatsapp}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

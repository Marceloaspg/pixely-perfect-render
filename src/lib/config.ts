// Dados de contato oficiais. Preencha com as informações reais da Majesta.
// WhatsApp: somente dígitos com DDI e DDD. Nunca usar números fictícios.
export const siteConfig = {
  whatsapp: "",
  email: "",
  instagram: "",
  facebook: "",
};

export function whatsappLink(text: string) {
  if (!/^\d{10,15}$/.test(siteConfig.whatsapp)) return undefined;
  const base = `https://wa.me/${siteConfig.whatsapp}`;
  return `${base}?text=${encodeURIComponent(text)}`;
}

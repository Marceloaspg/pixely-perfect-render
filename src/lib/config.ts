// Dados de contato oficiais. Preencha com as informações reais da Majesta.
// WhatsApp: somente dígitos com DDI e DDD. Nunca usar números fictícios.
export const siteConfig = {
  whatsapp: "5519996145193",
  email: "",
  instagram: "",
  facebook: "",
};

export function whatsappLink(text: string, number = siteConfig.whatsapp) {
  if (!/^\d{10,15}$/.test(number)) return undefined;
  const base = `https://wa.me/${number}`;
  return `${base}?text=${encodeURIComponent(text)}`;
}

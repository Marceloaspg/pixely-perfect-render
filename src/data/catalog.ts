import burger from "@/assets/cat-burger.jpg";
import pizza from "@/assets/cat-pizza.jpg";
import marmita from "@/assets/cat-marmita.jpg";
import hero from "@/assets/hero.jpg";

export type Category = {
  slug: string;
  number: string;
  name: string;
  description: string;
  image: string;
  subcategories: string[];
};

export type Product = {
  slug: string;
  name: string;
  category: string;
  description: string;
  specs: string[];
  variations: string[];
  packUnit?: string;
  applications: string[];
  featured?: boolean;
  order: number;
  image: string;
  demo: true;
};

export const categories: Category[] = [
  { slug: "embalagens-para-marmita", number: "01", name: "Embalagens para Marmitas", description: "Marmitas, potes e embalagens térmicas para refeições.", image: marmita, subcategories: ["Marmitas de alumínio", "Marmitas com tampa", "Embalagens térmicas", "Embalagens para refeições", "Potes para alimentos"] },
  { slug: "embalagens-para-hamburguer", number: "02", name: "Embalagens para Hambúrguer", description: "Caixas para lanches, artesanais e combos.", image: burger, subcategories: ["Caixas para hambúrguer", "Caixinhas para lanches", "Embalagens para hambúrguer artesanal", "Embalagens para delivery", "Caixas para combos"] },
  { slug: "embalagens-para-pizza", number: "03", name: "Embalagens para Pizza", description: "Caixas de papelão em modelos e tamanhos variados.", image: pizza, subcategories: ["Caixas para pizza", "Caixas para pizza brotinho", "Embalagens de papelão para pizza", "Modelos e tamanhos variados"] },
  { slug: "sacos-kraft-e-sacolas", number: "04", name: "Sacos Kraft e Sacolas", description: "Sacos e sacolas de papel para lanche e delivery.", image: hero, subcategories: ["Sacos kraft para lanche", "Sacos de papel para delivery", "Sacolas kraft", "Sacos para transporte de alimentos"] },
  { slug: "papeis-para-alimentos", number: "05", name: "Papéis para Alimentos", description: "Papel acoplado, papel manteiga e papéis para embrulho.", image: marmita, subcategories: ["Papel acoplado para lanche", "Papel manteiga para lanches", "Papel para hambúrguer", "Papel para embrulhar alimentos", "Papéis para proteção e apresentação de lanches"] },
  { slug: "embalagens-para-batatas-e-porcoes", number: "06", name: "Embalagens para Batatas e Porções", description: "Caixinhas para batata, porções e acompanhamentos.", image: burger, subcategories: ["Caixinhas para batata frita", "Embalagens para porções", "Embalagens para petiscos", "Caixas para acompanhamentos", "Recipientes para alimentos"] },
  { slug: "embalagens-para-pastel-e-churros", number: "07", name: "Embalagens para Pastel e Churros", description: "Sacos, suportes e caixas para pastel e churros.", image: marmita, subcategories: ["Sacos para pastel", "Embalagens para pastel", "Embalagens para churros", "Suportes e caixas para churros"] },
  { slug: "embalagens-para-hot-dog", number: "08", name: "Embalagens para Hot Dog", description: "Caixas e suportes para cachorro-quente.", image: burger, subcategories: ["Caixas para hot dog", "Embalagens para cachorro-quente", "Suportes para hot dog", "Embalagens para delivery de hot dog"] },
  { slug: "embalagens-para-combos", number: "09", name: "Embalagens para Combos", description: "Caixas para combos de lanche, batata e kits.", image: burger, subcategories: ["Caixas para combos de hambúrguer", "Embalagens para combos de lanche e batata", "Caixas para kits de refeições", "Embalagens para combos de delivery"] },
  { slug: "etiquetas-e-lacres-de-seguranca", number: "10", name: "Etiquetas e Lacres de Segurança", description: "Lacres adesivos e etiquetas para delivery.", image: hero, subcategories: ["Etiquetas lacre de segurança", "Lacres adesivos para delivery", "Etiquetas para fechamento de embalagens", "Etiquetas de identificação"] },
  { slug: "papel-termico", number: "11", name: "Papel Térmico", description: "Bobinas para impressoras e emissão de pedidos.", image: marmita, subcategories: ["Bobinas de papel térmico", "Papel térmico para impressoras", "Bobinas para emissão de pedidos", "Bobinas para equipamentos comerciais"] },
  { slug: "higiene-e-suprimentos", number: "12", name: "Higiene e Suprimentos", description: "Papel toalha interfolha e itens de apoio.", image: hero, subcategories: ["Papel toalha interfolha", "Papel toalha interfolhado para dispensers", "Produtos de apoio à higiene e à operação comercial"] },
];

export const applications = ["Delivery", "Consumo no local", "Lanches", "Refeições", "Pizza", "Operação e higiene"];

type Seed = Omit<Product, "demo" | "image" | "order"> & { image?: string };
const seeds: Seed[] = [
  { slug: "marmita-aluminio-com-tampa", name: "Marmita de alumínio com tampa", category: "embalagens-para-marmita", description: "Embalagem para refeições prontas, indicada para delivery e retirada.", specs: ["Material: alumínio", "Acompanha tampa"], variations: ["Diversos tamanhos"], applications: ["Delivery", "Refeições"], featured: true },
  { slug: "pote-para-alimentos", name: "Pote para alimentos", category: "embalagens-para-marmita", description: "Pote para acompanhamentos, molhos e porções.", specs: ["Uso alimentício"], variations: ["Diversas capacidades"], applications: ["Delivery", "Refeições"] },
  { slug: "caixa-para-hamburguer", name: "Caixa para hambúrguer", category: "embalagens-para-hamburguer", description: "Caixa de papel cartão para lanches e hambúrgueres artesanais.", specs: ["Material: papel cartão / kraft"], variations: ["Pequena", "Média", "Grande"], applications: ["Delivery", "Lanches"], featured: true },
  { slug: "caixa-para-pizza", name: "Caixa para pizza", category: "embalagens-para-pizza", description: "Caixa de papelão para transporte e apresentação de pizzas.", specs: ["Material: papelão"], variations: ["Brotinho", "Média", "Grande"], applications: ["Delivery", "Pizza"], featured: true },
  { slug: "saco-kraft-para-lanche", name: "Saco kraft para lanche", category: "sacos-kraft-e-sacolas", description: "Saco de papel kraft para lanches e delivery.", specs: ["Material: papel kraft"], variations: ["Diversos tamanhos"], applications: ["Delivery", "Lanches"], featured: true },
  { slug: "sacola-kraft", name: "Sacola kraft com alça", category: "sacos-kraft-e-sacolas", description: "Sacola de papel para transporte de pedidos.", specs: ["Material: papel kraft"], variations: ["Diversos tamanhos"], applications: ["Delivery"] },
  { slug: "papel-acoplado-para-lanche", name: "Papel acoplado para lanche", category: "papeis-para-alimentos", description: "Papel para embrulhar e proteger lanches.", specs: ["Papel acoplado"], variations: ["Diversas medidas"], applications: ["Lanches", "Delivery"], featured: true },
  { slug: "papel-manteiga-para-hamburguer", name: "Papel manteiga para hambúrguer", category: "papeis-para-alimentos", description: "Papel para apresentação e proteção de hambúrgueres.", specs: ["Papel manteiga"], variations: ["Diversas medidas"], applications: ["Lanches"] },
  { slug: "caixinha-para-batata-frita", name: "Caixinha para batata frita", category: "embalagens-para-batatas-e-porcoes", description: "Embalagem para batatas e porções.", specs: ["Papel cartão"], variations: ["P", "M", "G"], applications: ["Lanches", "Delivery"] },
  { slug: "saco-para-pastel", name: "Saco para pastel", category: "embalagens-para-pastel-e-churros", description: "Saco de papel para pastéis.", specs: ["Papel"], variations: ["Diversos tamanhos"], applications: ["Lanches"] },
  { slug: "embalagem-para-churros", name: "Embalagem para churros", category: "embalagens-para-pastel-e-churros", description: "Embalagem para servir e transportar churros.", specs: ["Papel"], variations: ["Diversos modelos"], applications: ["Lanches", "Consumo no local"] },
  { slug: "caixa-para-hot-dog", name: "Caixa para hot dog", category: "embalagens-para-hot-dog", description: "Caixa para cachorro-quente no local ou delivery.", specs: ["Papel cartão"], variations: ["Diversos tamanhos"], applications: ["Lanches", "Delivery"] },
  { slug: "caixa-para-combo", name: "Caixa para combo lanche e batata", category: "embalagens-para-combos", description: "Caixa com espaço para lanche e acompanhamento.", specs: ["Papel cartão / kraft"], variations: ["Diversos modelos"], applications: ["Delivery", "Lanches"] },
  { slug: "etiqueta-lacre-de-seguranca", name: "Etiqueta lacre de segurança", category: "etiquetas-e-lacres-de-seguranca", description: "Lacre adesivo para fechamento de embalagens de delivery.", specs: ["Adesivo"], variations: ["Diversos formatos"], applications: ["Delivery"], featured: true },
  { slug: "bobina-papel-termico", name: "Bobina de papel térmico", category: "papel-termico", description: "Bobina para impressoras de pedidos e equipamentos comerciais.", specs: ["Papel térmico"], variations: ["Diversas larguras"], applications: ["Operação e higiene"] },
  { slug: "papel-toalha-interfolha", name: "Papel toalha interfolha", category: "higiene-e-suprimentos", description: "Papel toalha interfolhado para dispensers.", specs: ["Interfolhado"], variations: ["Folha simples", "Folha dupla"], applications: ["Operação e higiene"] },
];

export const products: Product[] = seeds.map((s, i) => ({
  ...s,
  order: i,
  demo: true,
  image: s.image ?? categories.find((c) => c.slug === s.category)!.image,
}));

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
export const getProduct = (slug: string) => products.find((p) => p.slug === slug);

export const segments: { slug: string; name: string; products: string[] }[] = [
  { slug: "hamburguerias", name: "Hamburguerias", products: ["caixa-para-hamburguer", "papel-acoplado-para-lanche", "papel-manteiga-para-hamburguer", "saco-kraft-para-lanche", "caixinha-para-batata-frita", "caixa-para-combo", "etiqueta-lacre-de-seguranca"] },
  { slug: "pizzarias", name: "Pizzarias", products: ["caixa-para-pizza", "saco-kraft-para-lanche", "etiqueta-lacre-de-seguranca", "bobina-papel-termico", "papel-toalha-interfolha"] },
  { slug: "marmitarias", name: "Marmitarias", products: ["marmita-aluminio-com-tampa", "pote-para-alimentos", "sacola-kraft", "etiqueta-lacre-de-seguranca", "bobina-papel-termico"] },
  { slug: "restaurantes", name: "Restaurantes", products: ["marmita-aluminio-com-tampa", "pote-para-alimentos", "sacola-kraft", "bobina-papel-termico", "papel-toalha-interfolha"] },
  { slug: "lanchonetes", name: "Lanchonetes", products: ["caixa-para-hamburguer", "papel-acoplado-para-lanche", "saco-kraft-para-lanche", "caixinha-para-batata-frita", "papel-toalha-interfolha"] },
  { slug: "pastelarias", name: "Pastelarias", products: ["saco-para-pastel", "embalagem-para-churros", "saco-kraft-para-lanche", "papel-toalha-interfolha"] },
  { slug: "hot-doguerias", name: "Hot-doguerias", products: ["caixa-para-hot-dog", "saco-kraft-para-lanche", "etiqueta-lacre-de-seguranca", "papel-toalha-interfolha"] },
  { slug: "delivery", name: "Delivery em geral", products: ["sacola-kraft", "saco-kraft-para-lanche", "etiqueta-lacre-de-seguranca", "caixa-para-combo", "bobina-papel-termico"] },
];

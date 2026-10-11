import { z } from 'zod';
import burger from '@/assets/cat-burger.jpg';
import kraft from '@/assets/kraft.jpg';
import paper from '@/assets/paper.jpg';
import fries from '@/assets/fries.jpg';
import hotdog from '@/assets/hotdog.jpg';
import seal from '@/assets/seal.jpg';
export const defaultCategories = ['embalagens-para-hamburguer','sacos-kraft-e-sacolas','papeis-para-alimentos','embalagens-para-batatas-e-porcoes','embalagens-para-hot-dog','embalagens-para-combos','etiquetas-e-lacres-de-seguranca'] as const;
export const allowedCategories = defaultCategories;
export const imageMap: Record<string,string> = {burger,kraft,paper,fries,hotdog,seal};
export const categoryDataSchema = z.object({
  name: z.string().trim().min(1, 'Nome da categoria é obrigatório.').max(120),
  number: z.string().max(4).default('01'),
  order: z.number().int().min(0).max(9999).optional(),
  description: z.string().max(600).default(''),
  imageKey: z.string().default('burger'),
  imagePath: z.string().max(300).default(''),
  subcategories: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
});
export const productDimensionsSchema = z.object({
  length: z.string().trim().max(30).default(''),
  width: z.string().trim().max(30).default(''),
  height: z.string().trim().max(30).default(''),
  unit: z.enum(['cm', 'mm', 'm', '']).default('cm'),
});
export const productDataSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(3000),
  sku: z.string().trim().max(60).default(''),
  material: z.string().trim().max(120).default(''),
  dimensions: productDimensionsSchema.default({ length: '', width: '', height: '', unit: 'cm' }),
  packageQuantity: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().positive().nullable().optional().default(null)
  ),
  packageType: z.enum(['pacote', 'fardo', 'caixa', 'unidade', '']).default(''),
  specs: z.array(z.string().max(300)).max(40).default([]),
  variations: z.array(z.string().max(120)).max(40).default([]),
  packUnit: z.string().max(120).default(''),
  applications: z.array(z.string().max(100)).max(10).default([]),
  featured: z.boolean().default(false),
  order: z.number().int().min(0).max(9999).default(0),
  demo: z.boolean().default(false),
  imagePath: z.string().max(300).default(''),
  additionalImagePaths: z.array(z.string().min(1).max(300)).max(5).default([])
    .refine(paths => new Set(paths).size === paths.length, 'A galeria não pode conter caminhos repetidos.'),
});
export type Category = z.infer<typeof categoryDataSchema> & {slug:string;image:string;active:boolean};
export type Product = z.infer<typeof productDataSchema> & {slug:string;category:string;image:string;additionalImages:string[];active:boolean};
export const contactSchema = z.object({whatsapp:z.string().regex(/^\d{10,15}$/),email:z.union([z.string().email(),z.literal('')]),instagram:z.union([z.string().url(),z.literal('')]),facebook:z.union([z.string().url(),z.literal('')])});
export type SiteConfig = z.infer<typeof contactSchema>;
export type CatalogData = { categories:Category[];products:Product[];config:SiteConfig };
export const categorySlugSchema = z.string().regex(/^[a-z0-9-]{1,120}$/, 'Use apenas letras minúsculas, números e hífens no slug.');
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
export { assertAdminRole } from '@/lib/admin-access';
export function sortCategories(categories: Category[]): Category[] {
  const orderOf = (category: Category) => category.order ?? Math.max(0, (Number(category.number) || 1) - 1);
  return [...categories].sort((a,b)=>
    orderOf(a) - orderOf(b)
  );
}
export function filterPublicCatalog(categories: Category[], products: Product[]) {
  const visibleCategories = categories.filter(category => category.active);
  const visibleCategorySlugs = new Set(visibleCategories.map(category => category.slug));
  return {
    categories: visibleCategories,
    products: products.filter(product => product.active && visibleCategorySlugs.has(product.category)),
  };
}
export const applications = ['Delivery','Consumo no local','Lanches'];
export const segments = [
 {slug:'hamburguerias',name:'Hamburguerias',categories:allowedCategories.filter(s=>s!=='embalagens-para-hot-dog')},
 {slug:'lanchonetes',name:'Lanchonetes',categories:allowedCategories},
 {slug:'hot-doguerias',name:'Hot-doguerias',categories:['embalagens-para-hot-dog','sacos-kraft-e-sacolas','papeis-para-alimentos','etiquetas-e-lacres-de-seguranca']},
 {slug:'delivery',name:'Delivery em geral',categories:allowedCategories},
];

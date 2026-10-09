import { createContext, useContext, type ReactNode } from 'react';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getCatalog } from './catalog.functions';
import { imageMap, type CatalogData } from '@/data/catalog';
export const catalogQuery=queryOptions({queryKey:['catalog'],queryFn:async()=>{
 const data=await getCatalog();
 const categories=data.categories.map(c=>({...c,image:c.image||imageMap[c.imageKey]||imageMap['burger']||''}));
 const products=data.products.map(p=>({...p,image:p.image||categories.find(c=>c.slug===p.category)?.image||''}));
 return {...data,categories,products};
},staleTime:30_000});
const Ctx=createContext<CatalogData|null>(null);
export function CatalogProvider({children}:{children:ReactNode}){
 const {data}=useSuspenseQuery(catalogQuery);
 const categories=data.categories.map(c=>({...c,image:c.image||imageMap[c.imageKey]||imageMap['burger']||''}));
 const products=data.products.map(p=>({...p,image:p.image||categories.find(c=>c.slug===p.category)?.image||''}));
 return <Ctx.Provider value={{...data,categories,products}}>{children}</Ctx.Provider>;
}
export function useCatalog(){const c=useContext(Ctx);if(!c)throw new Error('Catalog provider missing');return c;}

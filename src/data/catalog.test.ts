import { expect, it } from 'vitest';
import { allowedCategories, segments } from './catalog';
it('exposes exactly the seven requested categories',()=>{expect([...allowedCategories]).toEqual(['embalagens-para-hamburguer','sacos-kraft-e-sacolas','papeis-para-alimentos','embalagens-para-batatas-e-porcoes','embalagens-para-hot-dog','embalagens-para-combos','etiquetas-e-lacres-de-seguranca']);});
it('never relates segments to removed categories',()=>{for(const segment of segments)for(const category of segment.categories)expect(allowedCategories).toContain(category);});

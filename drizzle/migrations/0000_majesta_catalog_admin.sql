CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade not null, role public.app_role not null, unique(user_id,role));
GRANT SELECT ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
CREATE POLICY own_role ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.catalog_categories (slug text primary key, data jsonb not null default '{}', active boolean not null default true);
GRANT SELECT ON public.catalog_categories TO anon; GRANT SELECT,INSERT,UPDATE,DELETE ON public.catalog_categories TO authenticated; GRANT ALL ON public.catalog_categories TO service_role;
ALTER TABLE public.catalog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_categories ON public.catalog_categories FOR SELECT TO anon,authenticated USING(active);
CREATE POLICY admin_categories ON public.catalog_categories FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.catalog_products (slug text primary key, category text references public.catalog_categories(slug) not null, data jsonb not null default '{}', active boolean not null default true);
GRANT SELECT ON public.catalog_products TO anon; GRANT SELECT,INSERT,UPDATE,DELETE ON public.catalog_products TO authenticated; GRANT ALL ON public.catalog_products TO service_role;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_products ON public.catalog_products FOR SELECT TO anon,authenticated USING(active AND EXISTS(SELECT 1 FROM public.catalog_categories c WHERE c.slug=category AND c.active));
CREATE POLICY admin_products ON public.catalog_products FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.contact_settings (id integer primary key default 1, data jsonb not null default '{}');
GRANT SELECT ON public.contact_settings TO anon; GRANT SELECT,INSERT,UPDATE ON public.contact_settings TO authenticated; GRANT ALL ON public.contact_settings TO service_role;
ALTER TABLE public.contact_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_contact ON public.contact_settings FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY admin_contact ON public.contact_settings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.quote_requests (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), contact jsonb not null, items jsonb not null, request_key uuid unique not null);
GRANT SELECT ON public.quote_requests TO authenticated; GRANT ALL ON public.quote_requests TO service_role;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_quotes ON public.quote_requests FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
INSERT INTO public.catalog_categories(slug,data) VALUES
('embalagens-para-hamburguer','{"name":"Embalagens para Hambúrguer","number":"01","description":"Caixas e embalagens para lanches e hambúrgueres.","imageKey":"burger","subcategories":["Caixas para hambúrguer","Caixinhas para lanches","Embalagens para hambúrguer artesanal","Embalagens para delivery"]}'),
('sacos-kraft-e-sacolas','{"name":"Sacos Kraft e Sacolas","number":"02","description":"Sacos e sacolas para lanches e delivery.","imageKey":"kraft","subcategories":["Sacos kraft para lanche","Sacolas kraft para delivery","Sacos de papel","Sacolas para transporte de alimentos"]}'),
('papeis-para-alimentos','{"name":"Papéis para Alimentos","number":"03","description":"Papéis para proteção e apresentação de lanches.","imageKey":"paper","subcategories":["Papel acoplado para lanche","Papel manteiga para lanche","Papel para hambúrguer","Papel para embrulhar alimentos"]}'),
('embalagens-para-batatas-e-porcoes','{"name":"Embalagens para Batatas e Porções","number":"04","description":"Embalagens para batatas, petiscos e acompanhamentos.","imageKey":"fries","subcategories":["Caixinhas para batata frita","Caixas para porções","Embalagens para petiscos","Recipientes para acompanhamentos"]}'),
('embalagens-para-hot-dog','{"name":"Embalagens para Hot Dog","number":"05","description":"Caixas e suportes para cachorro-quente.","imageKey":"hotdog","subcategories":["Caixas para hot dog","Suportes para cachorro-quente","Embalagens para delivery de hot dog"]}'),
('embalagens-para-combos','{"name":"Embalagens para Combos","number":"06","description":"Caixas para reunir lanches e acompanhamentos.","imageKey":"burger","subcategories":["Caixas para combos de hambúrguer","Embalagens para lanche e batata","Caixas para kits de lanches","Embalagens para combos de delivery"]}'),
('etiquetas-e-lacres-de-seguranca','{"name":"Etiquetas e Lacres de Segurança","number":"07","description":"Etiquetas e lacres para fechamento de embalagens.","imageKey":"seal","subcategories":["Etiquetas lacre para delivery","Lacres adesivos de segurança","Etiquetas para fechamento de embalagens"]}');
INSERT INTO public.catalog_products(slug,category,data) VALUES
('caixa-para-hamburguer','embalagens-para-hamburguer','{"name":"Caixa para hambúrguer","description":"Exemplo de embalagem para hambúrguer. Modelo e especificações a cadastrar.","demo":true,"featured":true,"order":1,"applications":["Delivery","Lanches"]}'),
('saco-kraft-para-lanche','sacos-kraft-e-sacolas','{"name":"Saco kraft para lanche","description":"Exemplo de saco para lanche. Modelo e especificações a cadastrar.","demo":true,"featured":true,"order":2,"applications":["Delivery","Lanches"]}'),
('sacola-kraft','sacos-kraft-e-sacolas','{"name":"Sacola kraft para delivery","description":"Exemplo de sacola para transporte. Modelo e especificações a cadastrar.","demo":true,"order":3,"applications":["Delivery"]}'),
('papel-acoplado-para-lanche','papeis-para-alimentos','{"name":"Papel acoplado para lanche","description":"Exemplo de papel para lanches. Modelo e especificações a cadastrar.","demo":true,"order":4,"applications":["Lanches","Delivery"]}'),
('papel-manteiga-para-hamburguer','papeis-para-alimentos','{"name":"Papel manteiga para hambúrguer","description":"Exemplo de papel para hambúrguer. Modelo e especificações a cadastrar.","demo":true,"order":5,"applications":["Lanches"]}'),
('caixinha-para-batata-frita','embalagens-para-batatas-e-porcoes','{"name":"Caixinha para batata frita","description":"Exemplo de embalagem para porções. Modelo e especificações a cadastrar.","demo":true,"order":6,"applications":["Lanches","Delivery"]}'),
('caixa-para-hot-dog','embalagens-para-hot-dog','{"name":"Caixa para hot dog","description":"Exemplo de caixa para cachorro-quente. Modelo e especificações a cadastrar.","demo":true,"order":7,"applications":["Lanches","Delivery"]}'),
('caixa-para-combo','embalagens-para-combos','{"name":"Caixa para combo lanche e batata","description":"Exemplo de caixa para combo. Modelo e especificações a cadastrar.","demo":true,"order":8,"applications":["Delivery","Lanches"]}'),
('etiqueta-lacre-de-seguranca','etiquetas-e-lacres-de-seguranca','{"name":"Etiqueta lacre de segurança","description":"Exemplo de etiqueta para fechamento. Modelo e especificações a cadastrar.","demo":true,"order":9,"applications":["Delivery"]}');
INSERT INTO public.contact_settings(id,data) VALUES (1,'{"whatsapp":"5519996145193","email":"","instagram":"","facebook":""}');
ALTER TABLE public.catalog_products
  ADD COLUMN admin_order integer NOT NULL DEFAULT 2147483647;

WITH ordered_products AS (
  SELECT
    slug,
    row_number() OVER (
      ORDER BY
        CASE WHEN data->>'order' ~ '^[0-9]+$' THEN 0 ELSE 1 END,
        CASE
          WHEN data->>'order' ~ '^[0-9]+$' THEN length(ltrim(data->>'order', '0'))
        END,
        CASE
          WHEN data->>'order' ~ '^[0-9]+$' THEN ltrim(data->>'order', '0')
        END COLLATE "C",
        slug COLLATE "C"
    ) - 1 AS position
  FROM public.catalog_products
)
UPDATE public.catalog_products AS products
SET admin_order = ordered_products.position::integer
FROM ordered_products
WHERE products.slug = ordered_products.slug;

CREATE INDEX catalog_products_admin_order_idx
  ON public.catalog_products (admin_order, slug);

CREATE FUNCTION public.reorder_catalog_products(_slugs text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem reorganizar produtos.';
  END IF;

  LOCK TABLE public.catalog_products IN SHARE ROW EXCLUSIVE MODE;

  IF _slugs IS NULL OR cardinality(_slugs) > 10000 THEN
    RAISE EXCEPTION 'A lista de produtos é inválida.';
  END IF;

  IF cardinality(_slugs) <> (
    SELECT count(DISTINCT requested.slug)
    FROM unnest(_slugs) AS requested(slug)
  ) THEN
    RAISE EXCEPTION 'A sequência contém produtos duplicados ou inválidos.';
  END IF;

  IF cardinality(_slugs) <> (SELECT count(*) FROM public.catalog_products)
    OR EXISTS (
      SELECT 1
      FROM unnest(_slugs) AS requested(slug)
      LEFT JOIN public.catalog_products AS products ON products.slug = requested.slug
      WHERE products.slug IS NULL
    )
  THEN
    RAISE EXCEPTION 'A lista de produtos foi alterada. Atualize o painel e tente novamente.';
  END IF;

  UPDATE public.catalog_products AS products
  SET admin_order = (requested.sort_position - 1)::integer
  FROM unnest(_slugs) WITH ORDINALITY AS requested(slug, sort_position)
  WHERE products.slug = requested.slug;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_catalog_products(text[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reorder_catalog_products(text[]) TO authenticated;

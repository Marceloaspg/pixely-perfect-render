CREATE TABLE public.homepage_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('institutional', 'campaign', 'product')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  subtitle text NOT NULL DEFAULT '' CHECK (length(subtitle) <= 500),
  image_path text,
  mobile_image_path text,
  button_label text NOT NULL DEFAULT '' CHECK (length(button_label) <= 60),
  button_href text NOT NULL DEFAULT '' CHECK (
    length(button_href) <= 500
    AND button_href !~ '[[:cntrl:]]'
    AND position(chr(92) IN button_href) = 0
    AND (
      button_href = ''
      OR button_href ~ '^/([^/]|$)'
      OR button_href ~* '^https://([A-Za-z0-9.-]+|\[[A-Fa-f0-9:.]+\])(:[0-9]{1,5})?([/?#][^[:cntrl:]]*)?$'
    )
  ),
  product_slug text REFERENCES public.catalog_products(slug)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order BETWEEN 0 AND 9999),
  active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homepage_banners_valid_schedule CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at
  ),
  CONSTRAINT homepage_banners_product_type_requires_product CHECK (
    type <> 'product' OR product_slug IS NOT NULL
  ),
  CONSTRAINT homepage_banners_image_required CHECK (
    type = 'product' OR (
      image_path IS NOT NULL
      AND image_path = btrim(image_path)
      AND image_path ~* '^banners/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  ),
  CONSTRAINT homepage_banners_image_path_valid CHECK (
    image_path IS NULL OR (
      length(image_path) <= 300
      AND image_path = btrim(image_path)
      AND image_path ~* '^banners/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  ),
  CONSTRAINT homepage_banners_mobile_image_path_valid CHECK (
    mobile_image_path IS NULL OR (
      length(mobile_image_path) <= 300
      AND mobile_image_path = btrim(mobile_image_path)
      AND mobile_image_path ~* '^banners/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    )
  )
);

CREATE INDEX homepage_banners_public_order_idx
  ON public.homepage_banners (display_order, id)
  WHERE active AND archived_at IS NULL;

CREATE INDEX homepage_banners_product_slug_idx
  ON public.homepage_banners (product_slug)
  WHERE product_slug IS NOT NULL;

REVOKE ALL ON TABLE public.homepage_banners FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.homepage_banners TO anon, authenticated;
GRANT INSERT, UPDATE ON public.homepage_banners TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.homepage_banners TO service_role;

ALTER TABLE public.homepage_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_eligible_homepage_banners
  ON public.homepage_banners
  FOR SELECT
  TO anon, authenticated
  USING (
    active
    AND archived_at IS NULL
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
    AND (
      product_slug IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.catalog_products p
        JOIN public.catalog_categories c ON c.slug = p.category
        WHERE p.slug = homepage_banners.product_slug
          AND p.active
          AND c.active
          AND (
            homepage_banners.type <> 'product'
            OR (
              p.data -> 'featured' = 'true'::jsonb
              AND COALESCE(p.data -> 'demo', 'false'::jsonb) = 'false'::jsonb
              AND btrim(COALESCE(p.data ->> 'imagePath', '')) <> ''
            )
          )
      )
    )
  );

CREATE POLICY admin_manage_homepage_banners
  ON public.homepage_banners
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE FUNCTION public.reorder_homepage_banners(_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT COALESCE(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'Administrator permission required'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(cardinality(_ids), 0) <> (SELECT count(*) FROM public.homepage_banners)
    OR COALESCE(cardinality(_ids), 0) <> (
      SELECT count(DISTINCT supplied.id)
      FROM unnest(_ids) AS supplied(id)
    )
    OR EXISTS (
      SELECT 1 FROM public.homepage_banners b
      WHERE NOT (b.id = ANY(_ids))
    )
  THEN
    RAISE EXCEPTION 'Banner order must include every banner exactly once'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.homepage_banners AS b
  SET display_order = (ordered.ordinality - 1)::integer,
      updated_at = now()
  FROM unnest(_ids) WITH ORDINALITY AS ordered(id, ordinality)
  WHERE b.id = ordered.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_homepage_banners(uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reorder_homepage_banners(uuid[]) TO authenticated;

CREATE FUNCTION public.set_homepage_banners_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER homepage_banners_set_updated_at
  BEFORE UPDATE ON public.homepage_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.set_homepage_banners_updated_at();

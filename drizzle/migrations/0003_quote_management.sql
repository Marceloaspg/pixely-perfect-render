ALTER TABLE public.quote_requests
  ADD COLUMN status text NOT NULL DEFAULT 'aguardando_orcamento'
    CONSTRAINT quote_requests_status_check
    CHECK (status IN ('aguardando_orcamento', 'orcamento_realizado', 'compra_finalizada'));

CREATE INDEX quote_requests_created_at_desc_idx
  ON public.quote_requests (created_at DESC);

REVOKE ALL ON TABLE public.quote_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.quote_requests TO authenticated;
GRANT SELECT, INSERT ON TABLE public.quote_requests TO service_role;
GRANT UPDATE (status) ON TABLE public.quote_requests TO authenticated;

CREATE POLICY admin_update_quotes
  ON public.quote_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.quote_submission_rate_limits (
  client_key_hash text PRIMARY KEY
    CHECK (client_key_hash ~ '^[0-9a-f]{64}$'),
  short_window_started_at timestamptz NOT NULL,
  short_window_count integer NOT NULL DEFAULT 0 CHECK (short_window_count >= 0),
  daily_window_started_at timestamptz NOT NULL,
  daily_window_count integer NOT NULL DEFAULT 0 CHECK (daily_window_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quote_submission_rate_limits_updated_at_idx
  ON public.quote_submission_rate_limits (updated_at);

ALTER TABLE public.quote_submission_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quote_submission_rate_limits FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quote_submission_rate_limits TO service_role;

CREATE FUNCTION public.consume_quote_submission_rate_limit(_client_key_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  updated_row public.quote_submission_rate_limits%ROWTYPE;
BEGIN
  IF _client_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid rate-limit key' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_client_key_hash, 0));

  INSERT INTO public.quote_submission_rate_limits (
    client_key_hash,
    short_window_started_at,
    short_window_count,
    daily_window_started_at,
    daily_window_count,
    updated_at
  )
  VALUES (_client_key_hash, v_now, 1, v_now, 1, v_now)
  ON CONFLICT (client_key_hash) DO UPDATE
  SET short_window_started_at = CASE
        WHEN public.quote_submission_rate_limits.short_window_started_at <= v_now - interval '15 minutes'
          THEN v_now
        ELSE public.quote_submission_rate_limits.short_window_started_at
      END,
      short_window_count = CASE
        WHEN public.quote_submission_rate_limits.short_window_started_at <= v_now - interval '15 minutes'
          THEN 1
        ELSE LEAST(public.quote_submission_rate_limits.short_window_count + 1, 6)
      END,
      daily_window_started_at = CASE
        WHEN public.quote_submission_rate_limits.daily_window_started_at <= v_now - interval '24 hours'
          THEN v_now
        ELSE public.quote_submission_rate_limits.daily_window_started_at
      END,
      daily_window_count = CASE
        WHEN public.quote_submission_rate_limits.daily_window_started_at <= v_now - interval '24 hours'
          THEN 1
        ELSE LEAST(public.quote_submission_rate_limits.daily_window_count + 1, 21)
      END,
      updated_at = v_now
  RETURNING * INTO updated_row;

  RETURN updated_row.short_window_count <= 5
    AND updated_row.daily_window_count <= 20;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_quote_submission_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_quote_submission_rate_limit(text) TO service_role;

CREATE FUNCTION public.cleanup_quote_submission_rate_limits()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  deleted_rows bigint;
BEGIN
  DELETE FROM public.quote_submission_rate_limits
  WHERE updated_at < now() - interval '24 hours';

  GET DIAGNOSTICS deleted_rows = ROW_COUNT;
  RETURN deleted_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_quote_submission_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_quote_submission_rate_limits() TO service_role;

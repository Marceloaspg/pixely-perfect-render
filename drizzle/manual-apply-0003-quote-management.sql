-- MANUAL APPLY SCRIPT — REVIEW BEFORE RUNNING
-- Target: only drizzle/migrations/0003_quote_management.sql.
-- Run this complete file once in the SQL Editor for the correct Lovable Cloud
-- project. Do not run individual statements. Stop if the SQL Editor does not
-- preserve the explicit transaction and support DO blocks/multiple statements.
--
-- Drizzle SHA-256 (LF-normalized formal migration file):
-- 02c8ab9801246e7f7b2b6909dc698f4928d081d9015c4e32a2e1bf963263cca6
-- Journal timestamp: 1792025836755
-- The schema migration and Drizzle history insert are in the same transaction.

BEGIN;

DO $preflight$
DECLARE
  history_count bigint;
  history_timestamps numeric[];
BEGIN
  RAISE NOTICE 'Manual migration target database=%, role=%', current_database(), current_user;

  IF current_setting('transaction_read_only') = 'on' THEN
    RAISE EXCEPTION 'Refusing to apply migration in a read-only transaction';
  END IF;

  IF to_regclass('public.quote_requests') IS NULL
    OR to_regclass('drizzle.__drizzle_migrations') IS NULL
    OR to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL
  THEN
    RAISE EXCEPTION 'Required catalog/admin or Drizzle migration-history dependency is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_requests'
      AND column_name IN ('id', 'created_at', 'contact', 'items', 'request_key')
    GROUP BY table_schema, table_name
    HAVING count(*) = 5
  ) THEN
    RAISE EXCEPTION 'quote_requests is missing one or more expected columns';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_info
    WHERE constraint_info.conrelid = 'public.quote_requests'::regclass
      AND constraint_info.contype = 'u'
      AND constraint_info.conkey = ARRAY[
        (SELECT attribute_info.attnum
         FROM pg_attribute attribute_info
         WHERE attribute_info.attrelid = 'public.quote_requests'::regclass
           AND attribute_info.attname = 'request_key'
           AND NOT attribute_info.attisdropped)
      ]::smallint[]
  ) THEN
    RAISE EXCEPTION 'quote_requests.request_key unique constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class table_info
    JOIN pg_namespace schema_info ON schema_info.oid = table_info.relnamespace
    WHERE schema_info.nspname = 'public'
      AND table_info.relname = 'quote_requests'
      AND table_info.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_requests'
      AND policyname = 'admin_quotes'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'Existing quote_requests admin read policy or RLS is missing';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_requests'
      AND column_name = 'status'
  )
    OR to_regclass('public.quote_requests_created_at_desc_idx') IS NOT NULL
    OR to_regclass('public.quote_submission_rate_limits') IS NOT NULL
    OR to_regclass('public.quote_submission_rate_limits_updated_at_idx') IS NOT NULL
    OR to_regprocedure('public.consume_quote_submission_rate_limit(text)') IS NOT NULL
    OR to_regprocedure('public.cleanup_quote_submission_rate_limits()') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'quote_requests'
        AND policyname = 'admin_update_quotes'
    )
  THEN
    RAISE EXCEPTION 'A quote-management object already exists; refusing partial or duplicate application';
  END IF;

  SELECT count(*), array_agg(created_at::numeric ORDER BY created_at::numeric)
  INTO history_count, history_timestamps
  FROM drizzle.__drizzle_migrations;

  IF history_count <> 3
    OR history_timestamps IS DISTINCT FROM ARRAY[
      1791584510602::numeric,
      1791584599878::numeric,
      1791759790248::numeric
    ]
  THEN
    RAISE EXCEPTION 'Unexpected Drizzle history; expected migrations 0000 through 0002, found count=% timestamps=%',
      history_count, history_timestamps;
  END IF;
END;
$preflight$;

-- BEGIN exact schema migration body from drizzle/migrations/0003_quote_management.sql.
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
-- END exact schema migration body from drizzle/migrations/0003_quote_management.sql.

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES (
  '02c8ab9801246e7f7b2b6909dc698f4928d081d9015c4e32a2e1bf963263cca6',
  1792025836755
);

DO $postflight$
DECLARE
  history_count bigint;
  latest_hash text;
  latest_timestamp numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_requests'
      AND column_name = 'status'
      AND is_nullable = 'NO'
      AND column_default LIKE '%aguardando_orcamento%'
  )
    OR NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.quote_requests'::regclass
        AND conname = 'quote_requests_status_check'
        AND contype = 'c'
    )
    OR to_regclass('public.quote_requests_created_at_desc_idx') IS NULL
    OR to_regclass('public.quote_submission_rate_limits') IS NULL
    OR to_regclass('public.quote_submission_rate_limits_updated_at_idx') IS NULL
    OR to_regprocedure('public.consume_quote_submission_rate_limit(text)') IS NULL
    OR to_regprocedure('public.cleanup_quote_submission_rate_limits()') IS NULL
  THEN
    RAISE EXCEPTION 'Post-migration quote schema validation failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class table_info
    JOIN pg_namespace schema_info ON schema_info.oid = table_info.relnamespace
    WHERE schema_info.nspname = 'public'
      AND table_info.relname = 'quote_submission_rate_limits'
      AND table_info.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_requests'
      AND policyname = 'admin_update_quotes'
      AND cmd = 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'Post-migration RLS policy validation failed';
  END IF;

  IF has_table_privilege('anon', 'public.quote_requests', 'SELECT')
    OR has_table_privilege('authenticated', 'public.quote_requests', 'INSERT')
    OR has_table_privilege('authenticated', 'public.quote_requests', 'DELETE')
    OR has_table_privilege('authenticated', 'public.quote_requests', 'TRUNCATE')
    OR has_column_privilege('authenticated', 'public.quote_requests', 'contact', 'UPDATE')
    OR has_table_privilege('service_role', 'public.quote_requests', 'UPDATE')
    OR has_table_privilege('service_role', 'public.quote_requests', 'DELETE')
    OR has_table_privilege('service_role', 'public.quote_requests', 'TRUNCATE')
    OR has_table_privilege('service_role', 'public.quote_requests', 'REFERENCES')
    OR has_table_privilege('service_role', 'public.quote_requests', 'TRIGGER')
  THEN
    RAISE EXCEPTION 'Unexpected quote_requests table privileges';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.quote_requests', 'SELECT')
    OR NOT has_column_privilege('authenticated', 'public.quote_requests', 'status', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.quote_requests', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.quote_requests', 'INSERT')
  THEN
    RAISE EXCEPTION 'Required quote_requests table privileges are missing';
  END IF;

  SELECT count(*) INTO history_count
  FROM drizzle.__drizzle_migrations;

  SELECT hash, created_at::numeric
  INTO latest_hash, latest_timestamp
  FROM drizzle.__drizzle_migrations
  ORDER BY created_at DESC
  LIMIT 1;

  IF history_count <> 4
    OR latest_hash <> '02c8ab9801246e7f7b2b6909dc698f4928d081d9015c4e32a2e1bf963263cca6'
    OR latest_timestamp <> 1792025836755
  THEN
    RAISE EXCEPTION 'Post-migration Drizzle history validation failed; count=% latest timestamp=% hash=%',
      history_count, latest_timestamp, latest_hash;
  END IF;
END;
$postflight$;

COMMIT;

-- The cleanup function is deliberately not called during quote submission.
-- Schedule it separately as database maintenance after reviewing the deployment.

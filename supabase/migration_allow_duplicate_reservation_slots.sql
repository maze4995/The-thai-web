-- Allow multiple schedule_slots rows to reference the same reservation_id.
-- Run this in Supabase SQL Editor if inserts fail with a unique constraint error
-- on schedule_slots.reservation_id or (store_id, reservation_id).

DO $$
DECLARE
  constraint_record RECORD;
  index_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class rel
      ON rel.oid = con.conrelid
    JOIN pg_namespace nsp
      ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'schedule_slots'
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) ILIKE '%reservation_id%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.schedule_slots DROP CONSTRAINT IF EXISTS %I',
      constraint_record.constraint_name
    );
  END LOOP;

  FOR index_record IN
    SELECT
      idx.indexname AS index_name
    FROM pg_indexes idx
    WHERE idx.schemaname = 'public'
      AND idx.tablename = 'schedule_slots'
      AND idx.indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND idx.indexdef ILIKE '%reservation_id%'
  LOOP
    EXECUTE format(
      'DROP INDEX IF EXISTS public.%I',
      index_record.index_name
    );
  END LOOP;
END $$;

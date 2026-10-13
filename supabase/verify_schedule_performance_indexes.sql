-- 두 CREATE INDEX 문을 각각 실행한 뒤 이 조회 전용 SQL 전체를 실행하세요.
-- 두 행에서 exists / valid / ready가 모두 true인지 확인합니다.
-- definition은 해당 테이블의 btree (store_id, work_date)여야 합니다.
WITH expected(index_name, table_name) AS (
  VALUES
    ('schedule_slots_store_date_idx', 'schedule_slots'),
    ('daily_attendance_store_date_idx', 'daily_attendance')
)
SELECT
  statement_timestamp() AS captured_at,
  e.table_name AS expected_table,
  e.index_name,
  i.indexrelid IS NOT NULL AS exists,
  t.relname AS actual_table,
  i.indisvalid AS valid,
  i.indisready AS ready,
  pg_get_indexdef(i.indexrelid) AS definition
FROM expected e
LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
LEFT JOIN pg_catalog.pg_class c
  ON c.relnamespace = n.oid AND c.relname = e.index_name
LEFT JOIN pg_catalog.pg_index i ON i.indexrelid = c.oid
LEFT JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
ORDER BY e.table_name;

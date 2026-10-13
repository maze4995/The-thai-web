-- 조판지 성능 2차 진단: 전체를 SQL Editor에 붙여넣고 Run 하세요.
-- 조회 전용입니다. 확장 설치, 통계 초기화, 데이터/권한 변경을 하지 않습니다.
-- 1차 결과에서 pg_stat_statements 확장 위치가 extensions인 것을 확인했습니다.
-- 누적 실행 통계이며 네트워크/브라우저 렌더링 시간은 포함하지 않습니다.
-- 테이블 이름을 SQL 본문에서 찾는 방식이므로 결과는 관련 SQL의 후보입니다.
-- SQL 본문과 매장/사용자/고객 정보는 결과에 포함하지 않습니다.
-- 값의 단위: *_ms = 밀리초, total_exec_seconds = 초.
-- 평균은 과거 전체의 평균이고 최대값은 과거의 한 번일 수 있습니다.
-- 결과가 비어 있으면 관련 기록 부재, 통계 수집 설정, 조회 권한 등을 확인해야 합니다.
-- 참고: https://www.postgresql.org/docs/17/pgstatstatements.html

WITH target_names(table_name) AS (
  VALUES ('schedule_slots'), ('daily_attendance'), ('daily_settings'),
         ('therapists'), ('store_members'), ('reservations')
), candidates AS (
  SELECT q.*, r.rolname AS db_role,
    ARRAY(
      SELECT t.table_name
      FROM target_names t
      WHERE q.query ILIKE '%' || t.table_name || '%'
      ORDER BY t.table_name
    ) AS mentioned_tables
  FROM extensions.pg_stat_statements q
  LEFT JOIN pg_catalog.pg_roles r ON r.oid = q.userid
  WHERE q.dbid = (
    SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database()
  )
    AND q.calls > 0
    -- 진단 SQL과 DDL을 후보에서 제외합니다.
    AND q.query NOT ILIKE '%pg_stat_%'
    AND q.query NOT ILIKE '%pg_catalog%'
    AND q.query NOT ILIKE '%information_schema%'
    AND q.query !~* '^\s*(create|alter|drop|grant|revoke|comment)\M'
)
SELECT
  statement_timestamp() AS captured_at,
  queryid::text AS query_id,
  db_role,
  toplevel,
  mentioned_tables,
  calls,
  round(mean_exec_time::numeric, 3) AS mean_exec_ms,
  round(max_exec_time::numeric, 3) AS max_exec_ms,
  round(stddev_exec_time::numeric, 3) AS stddev_exec_ms,
  round(total_exec_time::numeric / 1000, 3) AS total_exec_seconds,
  round(rows::numeric / calls, 2) AS average_rows_returned_or_affected,
  round(shared_blks_hit::numeric / calls, 2) AS average_shared_blocks_hit,
  round(shared_blks_read::numeric / calls, 2) AS average_shared_blocks_read,
  temp_blks_written,
  to_jsonb(candidates)->>'stats_since' AS statement_stats_since,
  to_jsonb(candidates)->>'minmax_stats_since' AS minmax_stats_since
FROM candidates
WHERE cardinality(mentioned_tables) > 0
ORDER BY mean_exec_time DESC, calls DESC
LIMIT 50;

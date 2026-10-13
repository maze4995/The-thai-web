-- 조판지 성능 진단: 앱 역할 우선 조회 (기존 관리자 작업 상위 50개 문제 보완)
-- 전체를 SQL Editor에 붙여넣고 Run 하세요. 단일 SELECT이며 DB를 변경하지 않습니다.
-- 결과 전체를 CSV로 공유하세요. SQL 본문, 고객 데이터, 사용자 UUID는 출력하지 않습니다.
-- 01: 수집/권한 상태, 02: 역할별 기록 요약, 03: 앱 역할의 관련 SQL 실행 통계.
-- 03이 없어도 01/02는 출력됩니다. 기록 부재와 권한 문제를 구분하는 데 사용합니다.
-- 앱 역할을 먼저 추린 뒤 상위 50개를 출력하므로 관리자 SQL이 밀어내지 않습니다.
-- 누적 평균/최대값입니다. 최근 체감 지연 및 네트워크 시간과 같지 않습니다.
-- mentioned_tables는 SQL 본문의 테이블 이름으로 판별한 후보입니다.
-- 참고: https://www.postgresql.org/docs/17/pgstatstatements.html
WITH target_names(table_name) AS (
  VALUES ('schedule_slots'), ('daily_attendance'), ('daily_settings'),
         ('therapists'), ('store_members'), ('reservations')
), stats AS MATERIALIZED (
  SELECT q.*, r.rolname::text AS db_role,
    ARRAY(
      SELECT t.table_name FROM target_names t
      WHERE q.query ILIKE '%' || t.table_name || '%'
      ORDER BY t.table_name
    ) AS mentioned_tables
  FROM extensions.pg_stat_statements q
  LEFT JOIN pg_catalog.pg_roles r ON r.oid = q.userid
  WHERE q.dbid = (
    SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database()
  ) AND q.calls > 0
), api_queries AS (
  SELECT * FROM stats
  WHERE db_role IN ('authenticated', 'anon', 'service_role', 'authenticator')
    AND cardinality(mentioned_tables) > 0
  ORDER BY mean_exec_time DESC, calls DESC, queryid
  LIMIT 50
), report AS (
  SELECT '01_collection'::text AS section, 'status'::text AS object_name,
    jsonb_build_object(
      'captured_at', statement_timestamp(),
      'stats_reset_at', i.stats_reset,
      'discarded_entries', i.dealloc,
      'track_mode', current_setting('pg_stat_statements.track', true),
      'compute_query_id', current_setting('compute_query_id', true),
      'can_read_all_stats', pg_has_role(current_user, 'pg_read_all_stats', 'USAGE'),
      'note', '02는 현재 보존된 모든 역할의 통계, 03은 앱 역할 중 테이블 이름이 확인된 SQL입니다.'
    ) AS details
  FROM extensions.pg_stat_statements_info i

  UNION ALL

  SELECT '02_role_summary', COALESCE(db_role, 'unknown'),
    jsonb_build_object(
      'statement_entries', count(*),
      'total_calls', sum(calls),
      'entries_with_visible_sql', count(*) FILTER (
        WHERE query IS NOT NULL AND query <> '<insufficient privilege>'
      ),
      'related_entries', count(*) FILTER (WHERE cardinality(mentioned_tables) > 0),
      'related_calls', COALESCE(sum(calls) FILTER (
        WHERE cardinality(mentioned_tables) > 0
      ), 0)
    )
  FROM stats GROUP BY db_role

  UNION ALL

  SELECT '03_api_query_times', db_role || ':' || queryid::text,
    jsonb_build_object(
      'query_id', queryid::text,
      'db_role', db_role,
      'toplevel', toplevel,
      'mentioned_tables', mentioned_tables,
      'calls', calls,
      'mean_exec_ms', round(mean_exec_time::numeric, 3),
      'max_exec_ms', round(max_exec_time::numeric, 3),
      'stddev_exec_ms', round(stddev_exec_time::numeric, 3),
      'total_exec_seconds', round(total_exec_time::numeric / 1000, 3),
      'average_rows_returned_or_affected', round(rows::numeric / calls, 2),
      'average_shared_blocks_hit', round(shared_blks_hit::numeric / calls, 2),
      'average_shared_blocks_read', round(shared_blks_read::numeric / calls, 2),
      'temp_blks_written', temp_blks_written,
      'statement_stats_since', to_jsonb(api_queries)->>'stats_since',
      'minmax_stats_since', to_jsonb(api_queries)->>'minmax_stats_since'
    )
  FROM api_queries
)
SELECT section, object_name, details
FROM report
ORDER BY section, (details->>'mean_exec_ms')::numeric DESC NULLS LAST, object_name;

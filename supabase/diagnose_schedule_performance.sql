-- 조판지 성능 1차 진단: Supabase SQL Editor에 전체를 붙여넣고 Run 하세요.
-- 단일 SELECT이며 데이터, 인덱스, 권한, 설정을 변경하지 않습니다.
-- 고객/예약 원본 데이터, 사용자 ID, 실행 중인 SQL 본문은 조회하지 않습니다.
-- 결과의 section / object_name / details 세 열 전체를 CSV로 내보내 공유하면 됩니다.
-- row 추정치와 scan 횟수는 누적 통계입니다. 많다는 이유만으로 병목은 아닙니다.
-- SQL Editor 관리자 조회는 실제 로그인 사용자의 RLS/API 응답 시간 측정이 아닙니다.
-- 이 결과로 기존 구조를 확인한 뒤 매장/날짜와 사용자 권한을 지정해 실행계획을 측정합니다.

WITH target_names(table_name) AS (
  VALUES
    ('schedule_slots'),
    ('daily_attendance'),
    ('daily_settings'),
    ('therapists'),
    ('store_members'),
    ('reservations')
), targets AS (
  SELECT t.table_name, c.oid, c.relrowsecurity, c.relforcerowsecurity
  FROM target_names t
  LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'public'
  LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = n.oid
   AND c.relname = t.table_name
   AND c.relkind IN ('r', 'p')
), report AS (
  SELECT
    '01_environment'::text AS section,
    'database'::text AS object_name,
    jsonb_build_object(
      'captured_at', statement_timestamp(),
      'postgres_version', current_setting('server_version'),
      'statistics_reset_at', d.stats_reset,
      'pg_stat_statements_schema', (
        SELECT n.nspname
        FROM pg_catalog.pg_extension e
        JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'pg_stat_statements'
      ),
      'note', '통계 초기화 이후의 누적 값입니다. 실제 API 지연 시간은 별도 측정해야 합니다.'
    ) AS details
  FROM pg_catalog.pg_stat_database d
  WHERE d.datname = current_database()

  UNION ALL

  SELECT '02_tables', t.table_name,
    jsonb_build_object(
      'exists', t.oid IS NOT NULL,
      'estimated_live_rows', s.n_live_tup,
      'estimated_dead_rows', s.n_dead_tup,
      'total_size_including_indexes', pg_size_pretty(pg_total_relation_size(t.oid)),
      'sequential_scans', s.seq_scan,
      'sequential_rows_read', s.seq_tup_read,
      'index_scans', s.idx_scan,
      'last_analyze', s.last_analyze,
      'last_autoanalyze', s.last_autoanalyze,
      'last_autovacuum', s.last_autovacuum,
      'rls_enabled', t.relrowsecurity,
      'rls_forced', t.relforcerowsecurity
    )
  FROM targets t
  LEFT JOIN pg_catalog.pg_stat_user_tables s ON s.relid = t.oid

  UNION ALL

  SELECT '03_indexes', t.table_name,
    jsonb_build_object('indexes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', ic.relname,
        'definition', pg_get_indexdef(i.indexrelid),
        'valid', i.indisvalid,
        'ready', i.indisready,
        'unique', i.indisunique,
        'size', pg_size_pretty(pg_relation_size(i.indexrelid)),
        'scans', si.idx_scan
      ) ORDER BY ic.relname)
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_class ic ON ic.oid = i.indexrelid
      LEFT JOIN pg_catalog.pg_stat_user_indexes si ON si.indexrelid = i.indexrelid
      WHERE i.indrelid = t.oid
    ), '[]'::jsonb))
  FROM targets t

  UNION ALL

  SELECT '04_rls_policies', t.table_name,
    jsonb_build_object('policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', p.policyname,
        'roles', p.roles,
        'command', p.cmd,
        'permissive', p.permissive,
        'using_expression', p.qual,
        'with_check_expression', p.with_check
      ) ORDER BY p.policyname)
      FROM pg_catalog.pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t.table_name
    ), '[]'::jsonb))
  FROM targets t

  UNION ALL

  SELECT '05_triggers', t.table_name,
    jsonb_build_object('triggers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', tr.tgname,
        'enabled_mode', tr.tgenabled,
        'definition', pg_get_triggerdef(tr.oid)
      ) ORDER BY tr.tgname)
      FROM pg_catalog.pg_trigger tr
      WHERE tr.tgrelid = t.oid AND NOT tr.tgisinternal
    ), '[]'::jsonb))
  FROM targets t

  UNION ALL

  SELECT '06_activity_snapshot', 'client_connections',
    jsonb_build_object(
      'connections_except_this_query', count(*),
      'active_connections', count(*) FILTER (WHERE a.state = 'active'),
      'idle_in_transaction', count(*) FILTER (WHERE a.state = 'idle in transaction'),
      'active_lock_waits', count(*) FILTER (
        WHERE a.state = 'active' AND a.wait_event_type = 'Lock'
      ),
      'active_advisory_lock_waits', count(*) FILTER (
        WHERE a.state = 'active' AND a.wait_event_type = 'Lock'
          AND a.wait_event = 'advisory'
      ),
      'longest_active_query_seconds', round(max(
        extract(epoch FROM statement_timestamp() - a.query_start)
      ) FILTER (WHERE a.state = 'active'), 3),
      'note', '실행 순간의 DB 전체 연결 상태입니다. 조판지 전용 수치가 아니며 권한에 따라 일부 활동은 보이지 않을 수 있습니다.'
    )
  FROM pg_catalog.pg_stat_activity a
  WHERE a.datname = current_database()
    AND a.backend_type = 'client backend'
    AND a.pid <> pg_backend_pid()
)
SELECT section, object_name, details
FROM report
ORDER BY section, object_name;

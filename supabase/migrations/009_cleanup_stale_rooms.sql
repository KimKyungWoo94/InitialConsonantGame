-- 오래된 방 자동 정리 (answers는 rooms FK ON DELETE CASCADE로 함께 삭제)
--
-- 실행 방법: Supabase SQL Editor에 붙여넣고 Run
-- 사전 준비: Dashboard → Database → Extensions → pg_cron 활성화

CREATE OR REPLACE FUNCTION cleanup_stale_rooms()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waiting_deleted INT;
  v_finished_deleted INT;
  v_playing_deleted INT;
BEGIN
  -- 입장 대기 방: 24시간 지나면 삭제
  DELETE FROM rooms
  WHERE status = 'waiting'
    AND created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_waiting_deleted = ROW_COUNT;

  -- 종료된 방: 7일 지나면 삭제
  DELETE FROM rooms
  WHERE status = 'finished'
    AND last_activity < now() - interval '7 days';
  GET DIAGNOSTICS v_finished_deleted = ROW_COUNT;

  -- 방치된 진행 중 방: 7일간 활동 없으면 삭제
  DELETE FROM rooms
  WHERE status = 'playing'
    AND last_activity < now() - interval '7 days';
  GET DIAGNOSTICS v_playing_deleted = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'deleted', json_build_object(
      'waiting', v_waiting_deleted,
      'finished', v_finished_deleted,
      'playing', v_playing_deleted,
      'total', v_waiting_deleted + v_finished_deleted + v_playing_deleted
    ),
    'ran_at', now()
  );
END;
$$;

-- 클라이언트(anon)에서 직접 호출하지 못하게 차단 (cron/관리자만 실행)
REVOKE ALL ON FUNCTION cleanup_stale_rooms() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_stale_rooms() FROM anon, authenticated;

-- pg_cron: 매일 04:00 UTC (= 13:00 KST) 자동 실행
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stale-rooms-daily') THEN
    PERFORM cron.unschedule('cleanup-stale-rooms-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-stale-rooms-daily',
  '0 4 * * *',
  $$SELECT public.cleanup_stale_rooms();$$
);

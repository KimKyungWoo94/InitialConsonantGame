-- Supabase SQL Editor에 붙여넣고 실행하세요

CREATE TABLE IF NOT EXISTS rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT UNIQUE NOT NULL,
  chosung       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'waiting',
  player_a      TEXT,
  player_b      TEXT,
  player_a_id   TEXT,
  player_b_id   TEXT,
  turn          TEXT DEFAULT 'A',
  winner        TEXT,
  last_activity TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS answers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player     TEXT NOT NULL,
  word       TEXT NOT NULL,
  definition TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS answers_room_word_unique
  ON answers (room_id, lower(trim(word)));

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_read" ON rooms FOR SELECT USING (true);
CREATE POLICY "rooms_write" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (true);

CREATE POLICY "answers_read" ON answers FOR SELECT USING (true);
CREATE POLICY "answers_write" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "answers_delete" ON answers FOR DELETE USING (true);

-- Realtime 활성화
-- 아래 SQL이 에러나면: Supabase 대시보드 → Database → Replication
-- 에서 rooms, answers 테이블 Realtime을 켜주세요.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE answers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 단어 제출 (차례·중복 검증)
CREATE OR REPLACE FUNCTION submit_word(
  p_room_id UUID,
  p_player TEXT,
  p_word TEXT,
  p_definition TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_normalized TEXT;
  v_duplicate BOOLEAN;
BEGIN
  v_normalized := trim(p_word);

  IF v_normalized = '' THEN
    RETURN json_build_object('success', false, 'reason', '단어를 입력해주세요.');
  END IF;

  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', '방을 찾을 수 없습니다.');
  END IF;

  IF v_room.status != 'playing' THEN
    RETURN json_build_object('success', false, 'reason', '게임이 진행 중이 아닙니다.');
  END IF;

  IF v_room.turn != p_player THEN
    RETURN json_build_object('success', false, 'reason', '내 차례가 아닙니다.');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM answers
    WHERE room_id = p_room_id AND lower(trim(word)) = lower(v_normalized)
  ) INTO v_duplicate;

  IF v_duplicate THEN
    RETURN json_build_object(
      'success', false,
      'reason', '이미 사용한 단어예요! 다른 단어를 입력해주세요.'
    );
  END IF;

  INSERT INTO answers (room_id, player, word, definition)
  VALUES (p_room_id, p_player, v_normalized, nullif(trim(p_definition), ''));

  UPDATE rooms
  SET turn = CASE WHEN p_player = 'A' THEN 'B' ELSE 'A' END,
      last_activity = now()
  WHERE id = p_room_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 포기
CREATE OR REPLACE FUNCTION surrender_game(
  p_room_id UUID,
  p_player TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', '방을 찾을 수 없습니다.');
  END IF;

  IF v_room.status != 'playing' THEN
    RETURN json_build_object('success', false, 'reason', '게임이 진행 중이 아닙니다.');
  END IF;

  UPDATE rooms
  SET status = 'finished',
      winner = CASE WHEN p_player = 'A' THEN 'B' ELSE 'A' END,
      last_activity = now()
  WHERE id = p_room_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 다시 하기
CREATE OR REPLACE FUNCTION rematch_game(p_room_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM answers WHERE room_id = p_room_id;

  UPDATE rooms
  SET status = 'playing',
      winner = NULL,
      turn = 'A',
      chosung = (
        SELECT string_agg(
          (ARRAY['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'])[floor(random() * 14 + 1)::int],
          ''
        )
        FROM generate_series(1, 2)
      ),
      last_activity = now()
  WHERE id = p_room_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 방장이 선공/후공을 정하고 게임 시작
CREATE OR REPLACE FUNCTION start_game(
  p_room_id UUID,
  p_player_id TEXT,
  p_first_turn TEXT DEFAULT 'A'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', '방을 찾을 수 없습니다.');
  END IF;

  IF v_room.player_a_id IS DISTINCT FROM p_player_id THEN
    RETURN json_build_object('success', false, 'reason', '방장만 게임을 시작할 수 있습니다.');
  END IF;

  IF v_room.player_b IS NULL THEN
    RETURN json_build_object('success', false, 'reason', '상대방이 아직 입장하지 않았습니다.');
  END IF;

  IF v_room.status != 'waiting' THEN
    RETURN json_build_object('success', false, 'reason', '이미 게임이 시작됐습니다.');
  END IF;

  IF p_first_turn NOT IN ('A', 'B') THEN
    RETURN json_build_object('success', false, 'reason', '잘못된 선공 설정입니다.');
  END IF;

  UPDATE rooms
  SET status = 'playing',
      turn = p_first_turn,
      last_activity = now()
  WHERE id = p_room_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 오래된 방 자동 정리 (009_cleanup_stale_rooms.sql 과 동일)
-- pg_cron 스케줄 등록은 migrations/009_cleanup_stale_rooms.sql 을 SQL Editor에서 실행하세요.
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
  DELETE FROM rooms
  WHERE status = 'waiting'
    AND created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_waiting_deleted = ROW_COUNT;

  DELETE FROM rooms
  WHERE status = 'finished'
    AND last_activity < now() - interval '7 days';
  GET DIAGNOSTICS v_finished_deleted = ROW_COUNT;

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

REVOKE ALL ON FUNCTION cleanup_stale_rooms() FROM PUBLIC;
REVOKE ALL ON FUNCTION cleanup_stale_rooms() FROM anon, authenticated;

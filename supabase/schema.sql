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
  p_word TEXT
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

  INSERT INTO answers (room_id, player, word) VALUES (p_room_id, p_player, v_normalized);

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

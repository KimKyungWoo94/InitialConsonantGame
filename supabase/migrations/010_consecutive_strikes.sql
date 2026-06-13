-- 연속 잘못된 제출(중복·사전 없음) 5회 시 패배, 성공 시 해당 플레이어 카운트 초기화
--
-- 실행: Supabase SQL Editor에 붙여넣고 Run

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS player_a_strikes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS player_b_strikes INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION apply_submit_failure(
  p_room_id UUID,
  p_player TEXT,
  p_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_strikes INT;
  v_max_strikes CONSTANT INT := 5;
BEGIN
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

  IF p_player = 'A' THEN
    v_strikes := v_room.player_a_strikes + 1;
    UPDATE rooms
    SET player_a_strikes = v_strikes,
        last_activity = now()
    WHERE id = p_room_id;
  ELSE
    v_strikes := v_room.player_b_strikes + 1;
    UPDATE rooms
    SET player_b_strikes = v_strikes,
        last_activity = now()
    WHERE id = p_room_id;
  END IF;

  IF v_strikes >= v_max_strikes THEN
    UPDATE rooms
    SET status = 'finished',
        winner = CASE WHEN p_player = 'A' THEN 'B' ELSE 'A' END,
        last_activity = now()
    WHERE id = p_room_id;

    RETURN json_build_object(
      'success', false,
      'reason', format('연속 %s회 잘못된 제출로 패배했습니다.', v_max_strikes),
      'gameOver', true,
      'loser', p_player,
      'strikes', v_strikes,
      'strikesRemaining', 0,
      'maxStrikes', v_max_strikes
    );
  END IF;

  RETURN json_build_object(
    'success', false,
    'reason', p_reason,
    'gameOver', false,
    'strikes', v_strikes,
    'strikesRemaining', v_max_strikes - v_strikes,
    'maxStrikes', v_max_strikes
  );
END;
$$;

CREATE OR REPLACE FUNCTION register_failed_submit(
  p_room_id UUID,
  p_player TEXT,
  p_reason TEXT DEFAULT '잘못된 제출입니다.'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN apply_submit_failure(p_room_id, p_player, p_reason);
END;
$$;

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
    RETURN apply_submit_failure(
      p_room_id,
      p_player,
      '이미 사용한 단어예요! 다른 단어를 입력해주세요.'
    );
  END IF;

  INSERT INTO answers (room_id, player, word, definition)
  VALUES (p_room_id, p_player, v_normalized, nullif(trim(p_definition), ''));

  UPDATE rooms
  SET turn = CASE WHEN p_player = 'A' THEN 'B' ELSE 'A' END,
      player_a_strikes = CASE WHEN p_player = 'A' THEN 0 ELSE player_a_strikes END,
      player_b_strikes = CASE WHEN p_player = 'B' THEN 0 ELSE player_b_strikes END,
      last_activity = now()
  WHERE id = p_room_id;

  RETURN json_build_object(
    'success', true,
    'strikes', 0,
    'strikesRemaining', 5,
    'maxStrikes', 5
  );
END;
$$;

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
      player_a_strikes = 0,
      player_b_strikes = 0,
      last_activity = now()
  WHERE id = p_room_id;

  RETURN json_build_object('success', true);
END;
$$;

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
      player_a_strikes = 0,
      player_b_strikes = 0,
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

-- submit_word 함수 중복(3인자/4인자) 정리
DROP FUNCTION IF EXISTS submit_word(UUID, TEXT, TEXT);

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

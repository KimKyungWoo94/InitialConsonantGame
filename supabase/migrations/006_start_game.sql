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

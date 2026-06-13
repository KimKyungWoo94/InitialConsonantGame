import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const content = readFileSync('.env.local', 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY
);

async function testGameFlow() {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();

  const { data: room, error: createError } = await supabase
    .from('rooms')
    .insert({
      code,
      chosung: 'ㅅㄹ',
      player_a: '플레이어A',
      player_a_id: 'test-a',
      status: 'waiting',
      turn: 'A',
    })
    .select()
    .single();

  if (createError || !room) throw new Error(`방 생성 실패: ${createError?.message}`);

  const { data: joined, error: joinError } = await supabase
    .from('rooms')
    .update({ player_b: '플레이어B', player_b_id: 'test-b' })
    .eq('id', room.id)
    .eq('status', 'waiting')
    .select()
    .single();

  if (joinError || !joined) throw new Error(`입장 실패: ${joinError?.message}`);

  const { data: startResult, error: startError } = await supabase.rpc('start_game', {
    p_room_id: room.id,
    p_player_id: 'test-a',
    p_first_turn: 'A',
  });
  if (startError) throw new Error(`게임 시작 실패: ${startError.message}`);
  if (!startResult?.success) throw new Error(`게임 시작 거부됨: ${startResult?.reason}`);

  const words = ['사람', '사랑'];
  for (let i = 0; i < words.length; i++) {
    const player = i % 2 === 0 ? 'A' : 'B';
    const { data, error } = await supabase.rpc('submit_word', {
      p_room_id: room.id,
      p_player: player,
      p_word: words[i],
    });
    if (error) throw new Error(`단어 제출 실패: ${error.message}`);
    if (!data?.success) throw new Error(`단어 거부됨: ${data?.reason}`);
  }

  const { data: dupResult, error: dupError } = await supabase.rpc('submit_word', {
    p_room_id: room.id,
    p_player: 'A',
    p_word: '사람',
  });

  if (dupError) throw new Error(`중복 테스트 실패: ${dupError.message}`);
  if (dupResult?.success) throw new Error('중복 단어가 성공하면 안 됨');
  if (dupResult?.gameOver) throw new Error('중복 1회로 게임이 종료되면 안 됨');
  if (dupResult?.strikes !== 1) throw new Error(`중복 1회 strikes=1 이어야 함 (got ${dupResult?.strikes})`);

  const { data: afterDup } = await supabase.from('rooms').select('status, turn, player_a_strikes').eq('id', room.id).single();
  if (afterDup?.status !== 'playing') throw new Error('중복 후에도 게임이 진행 중이어야 함');
  if (afterDup?.turn !== 'A') throw new Error('중복 후 차례가 유지되어야 함');
  if (afterDup?.player_a_strikes !== 1) throw new Error('중복 후 player_a_strikes=1 이어야 함');

  const { data: validWord, error: validError } = await supabase.rpc('submit_word', {
    p_room_id: room.id,
    p_player: 'A',
    p_word: '사료',
  });
  if (validError) throw new Error(`중복 후 정상 제출 실패: ${validError.message}`);
  if (!validWord?.success) throw new Error(`중복 후 정상 제출 거부됨: ${validWord?.reason}`);

  const { data: afterSuccess } = await supabase.from('rooms').select('player_a_strikes, turn').eq('id', room.id).single();
  if (afterSuccess?.player_a_strikes !== 0) throw new Error('성공 제출 후 strikes가 0으로 초기화되어야 함');
  if (afterSuccess?.turn !== 'B') throw new Error('성공 제출 후 차례가 넘어가야 함');

  // 연속 5회 실패 시 패배
  await supabase.from('rooms').update({ turn: 'B', player_b_strikes: 0 }).eq('id', room.id);
  for (let i = 1; i <= 5; i++) {
    const { data: failResult, error: failError } = await supabase.rpc('register_failed_submit', {
      p_room_id: room.id,
      p_player: 'B',
      p_reason: '사전에 없는 단어예요!',
    });
    if (failError) throw new Error(`연속 실패 테스트 ${i}회: ${failError.message}`);
    if (i < 5) {
      if (failResult?.gameOver) throw new Error(`${i}회 실패로 게임이 종료되면 안 됨`);
      if (failResult?.strikes !== i) throw new Error(`${i}회 실패 strikes=${i} 이어야 함`);
    } else {
      if (!failResult?.gameOver) throw new Error('5회 연속 실패 시 게임이 종료되어야 함');
      if (failResult?.loser !== 'B') throw new Error('5회 연속 실패 시 패자는 B여야 함');
    }
  }

  const { data: afterFiveFails } = await supabase.from('rooms').select('status, winner').eq('id', room.id).single();
  if (afterFiveFails?.status !== 'finished') throw new Error('5회 실패 후 status=finished 여야 함');
  if (afterFiveFails?.winner !== 'A') throw new Error('5회 실패 후 winner=A 여야 함');

  await supabase.from('answers').delete().eq('room_id', room.id);
  await supabase.from('rooms').update({ status: 'finished', winner: 'B' }).eq('id', room.id);

  const { data: finishedCheck } = await supabase.from('rooms').select('*').eq('id', room.id).single();
  if (finishedCheck?.status !== 'finished') {
    throw new Error('테스트 종료 처리 실패');
  }

  const { error: rematchError } = await supabase.rpc('rematch_game', { p_room_id: room.id });
  if (rematchError) throw new Error(`다시하기 실패: ${rematchError.message}`);

  const { data: rematched } = await supabase.from('rooms').select('*').eq('id', room.id).single();
  if (rematched?.status !== 'playing') throw new Error('다시하기 후 상태 오류');

  await supabase.from('rooms').delete().eq('id', room.id);

  // 커스텀 초성 테스트
  const code2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const { data: customRoom, error: customCreateError } = await supabase
    .from('rooms')
    .insert({
      code: code2,
      chosung: 'ㅂㅈ',
      player_a: 'A',
      player_a_id: 'custom-a',
      player_b: 'B',
      player_b_id: 'custom-b',
      status: 'playing',
      turn: 'A',
    })
    .select()
    .single();

  if (customCreateError || !customRoom) {
    throw new Error(`커스텀 초성 방 생성 실패: ${customCreateError?.message}`);
  }

  const customWords = ['박쥐', '부자'];
  for (let i = 0; i < customWords.length; i++) {
    const player = i % 2 === 0 ? 'A' : 'B';
    const { data, error } = await supabase.rpc('submit_word', {
      p_room_id: customRoom.id,
      p_player: player,
      p_word: customWords[i],
    });
    if (error) throw new Error(`커스텀 단어 제출 실패: ${error.message}`);
    if (!data?.success) throw new Error(`커스텀 단어 거부됨: ${data?.reason}`);
  }

  await supabase.from('rooms').delete().eq('id', customRoom.id);

  console.log('PASS: 게임 플로우 검증 완료');
  console.log(' - 방 생성/입장 OK');
  console.log(' - 단어 제출/차례 넘기기 OK');
  console.log(' - 중복 단어 재입력 OK');
  console.log(' - 연속 실패 5회 패배 OK');
  console.log(' - 성공 시 strikes 초기화 OK');
  console.log(' - 다시하기 OK');
  console.log(' - 커스텀 초성(ㅂㅈ) OK');
}

testGameFlow().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});

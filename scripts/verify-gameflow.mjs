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
    .update({ player_b: '플레이어B', player_b_id: 'test-b', status: 'playing' })
    .eq('id', room.id)
    .eq('status', 'waiting')
    .select()
    .single();

  if (joinError || !joined) throw new Error(`입장 실패: ${joinError?.message}`);

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
  if (!dupResult?.gameOver) throw new Error('중복 단어 시 게임 종료가 되지 않음');

  const { data: finished } = await supabase.from('rooms').select('*').eq('id', room.id).single();
  if (finished?.status !== 'finished' || finished?.winner !== 'B') {
    throw new Error('패배 처리 결과가 올바르지 않음');
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
  console.log(' - 중복 단어 패배 OK');
  console.log(' - 다시하기 OK');
  console.log(' - 커스텀 초성(ㅂㅈ) OK');
}

testGameFlow().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});

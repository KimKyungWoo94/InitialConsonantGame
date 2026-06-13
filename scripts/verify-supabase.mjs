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
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('FAIL: .env.local에 URL 또는 키가 없습니다.');
  process.exit(1);
}

if (url.includes('/rest/v1')) {
  console.error('FAIL: URL에 /rest/v1 이 포함되어 있습니다. base URL만 사용하세요.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function verify() {
  const checks = [];

  const { error: roomsError } = await supabase.from('rooms').select('id').limit(1);
  if (roomsError) {
    console.error('FAIL rooms:', roomsError.message);
    process.exit(1);
  }
  checks.push('rooms 테이블 OK');

  const { error: answersError } = await supabase.from('answers').select('id').limit(1);
  if (answersError) {
    console.error('FAIL answers:', answersError.message);
    process.exit(1);
  }
  checks.push('answers 테이블 OK');

  const { error: rpcError } = await supabase.rpc('submit_word', {
    p_room_id: '00000000-0000-0000-0000-000000000000',
    p_player: 'A',
    p_word: '테스트',
  });

  if (rpcError?.message?.includes('Could not find the function')) {
    console.error('FAIL: submit_word 함수가 없습니다. schema.sql을 실행하세요.');
    process.exit(1);
  }
  checks.push('submit_word RPC OK');

  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const { data: room, error: createError } = await supabase
    .from('rooms')
    .insert({
      code,
      chosung: 'ㅅㄹ',
      player_a: '검증봇',
      player_a_id: 'verify-bot',
      status: 'waiting',
      turn: 'A',
    })
    .select()
    .single();

  if (createError || !room) {
    console.error('FAIL 방 생성:', createError?.message);
    process.exit(1);
  }
  checks.push('방 생성 OK');

  const { error: deleteError } = await supabase.from('rooms').delete().eq('id', room.id);
  if (deleteError) {
    console.error('FAIL 방 삭제:', deleteError.message);
    process.exit(1);
  }
  checks.push('방 삭제 OK');

  console.log('PASS: Supabase 연결 및 스키마 검증 완료');
  for (const c of checks) console.log(' -', c);
}

verify().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});

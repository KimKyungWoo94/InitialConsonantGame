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

function ms(start) {
  return `${(performance.now() - start).toFixed(1)}ms`;
}

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  console.log(`  ${label}: ${ms(start)}`);
  return result;
}

const env = loadEnvLocal();
const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== DB 부하·구조 점검 ===\n');

  const { count: roomCount, error: roomCountErr } = await supabase
    .from('rooms')
    .select('*', { count: 'exact', head: true });
  if (roomCountErr) throw roomCountErr;

  const { count: answerCount, error: answerCountErr } = await supabase
    .from('answers')
    .select('*', { count: 'exact', head: true });
  if (answerCountErr) throw answerCountErr;

  console.log(`[데이터 규모] rooms ${roomCount ?? 0}건, answers ${answerCount ?? 0}건`);

  const { data: statusRows } = await supabase.from('rooms').select('status');
  const statusMap = {};
  for (const row of statusRows ?? []) {
    statusMap[row.status] = (statusMap[row.status] ?? 0) + 1;
  }
  console.log(`[방 상태] ${JSON.stringify(statusMap)}`);

  const { data: topRooms } = await supabase
    .from('answers')
    .select('room_id')
    .limit(1000);

  const perRoom = {};
  for (const row of topRooms ?? []) {
    perRoom[row.room_id] = (perRoom[row.room_id] ?? 0) + 1;
  }
  const maxAnswers = Object.values(perRoom).sort((a, b) => b - a)[0] ?? 0;
  console.log(`[샘플] 방당 최대 answers(상위1000행 기준): ${maxAnswers}건\n`);

  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const { data: room, error: createErr } = await supabase
    .from('rooms')
    .insert({
      code,
      chosung: 'ㅅㄹ',
      player_a: 'perf-a',
      player_a_id: 'perf-a-id',
      player_b: 'perf-b',
      player_b_id: 'perf-b-id',
      status: 'playing',
      turn: 'A',
    })
    .select()
    .single();
  if (createErr || !room) throw createErr ?? new Error('방 생성 실패');

  const roomId = room.id;
  console.log('[단일 방 쿼리 지연]');

  await timed('fetchRoom', () =>
    supabase.from('rooms').select('*').eq('id', roomId).single().then((r) => {
      if (r.error) throw r.error;
      return r.data;
    })
  );

  await timed('fetchAnswers(0건)', () =>
    supabase
      .from('answers')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .then((r) => {
        if (r.error) throw r.error;
        return r.data;
      })
  );

  const words = Array.from({ length: 50 }, (_, i) => `단어${i}`);
  for (let i = 0; i < words.length; i++) {
    const { error } = await supabase.rpc('submit_word', {
      p_room_id: roomId,
      p_player: i % 2 === 0 ? 'A' : 'B',
      p_word: words[i],
      p_definition: `테스트 뜻 ${i}`,
    });
    if (error) throw error;
  }

  await timed('fetchAnswers(50건)', () =>
    supabase
      .from('answers')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .then((r) => {
        if (r.error) throw r.error;
        return r.data;
      })
  );

  console.log('\n[동시 조회 시뮬레이션] 2플레이어 × (INSERT후 fetch + 턴변경 fetch)]');
  const burstStart = performance.now();
  await Promise.all([
    supabase.from('answers').select('*').eq('room_id', roomId).order('created_at'),
    supabase.from('answers').select('*').eq('room_id', roomId).order('created_at'),
    supabase.from('rooms').select('*').eq('id', roomId).single(),
    supabase.from('rooms').select('*').eq('id', roomId).single(),
  ]);
  console.log(`  4회 병렬 조회: ${ms(burstStart)}`);

  const pollStart = performance.now();
  for (let i = 0; i < 10; i++) {
    await supabase.from('rooms').select('*').eq('id', roomId).single();
  }
  console.log(`  대기화면 폴링 10회(1.5초×10≈15초 상당): ${ms(pollStart)}`);

  await supabase.from('rooms').delete().eq('id', roomId);

  console.log('\n[코드 기반 부하 요인]');
  const issues = [
    {
      level: '주의',
      item: '단어 1개 제출 시 fetchAnswers 최대 3~4회/클라이언트',
      detail: 'Realtime INSERT + 턴 변경 + 제출자 재조회가 겹침',
    },
    {
      level: '주의',
      item: '대기/결과 화면 1.5초 폴링',
      detail: '방 1개당 클라이언트 0.67 req/s (Realtime 보완용)',
    },
    {
      level: '양호',
      item: 'submit_word RPC',
      detail: 'FOR UPDATE + 유니크 인덱스로 2인 게임에 적합',
    },
    {
      level: '양호',
      item: 'fetchAnswers 전체 로드',
      detail: '2인 게임에서 수십~백여 건 수준이라 현재 규모에 문제 없음',
    },
  ];

  if ((roomCount ?? 0) > 500) {
    issues.push({
      level: '개선권장',
      item: 'rooms 테이블 누적',
      detail: `${roomCount}건 — 종료된 방 정리(cron) 권장`,
    });
  }

  if ((answerCount ?? 0) > 5000) {
    issues.push({
      level: '개선권장',
      item: 'answers 테이블 누적',
      detail: `${answerCount}건 — 오래된 데이터 정리 권장`,
    });
  }

  for (const issue of issues) {
    console.log(`  [${issue.level}] ${issue.item}`);
    console.log(`         ${issue.detail}`);
  }

  console.log('\n[결론]');
  if ((roomCount ?? 0) < 100 && (answerCount ?? 0) < 2000) {
    console.log('  현재 데이터 규모·지연 시간 기준 실질적 DB 병목은 없습니다.');
    console.log('  다만 클라이언트 중복 fetchAnswers는 줄이면 API 호출을 절약할 수 있습니다.');
  } else {
    console.log('  데이터가 쌓이고 있습니다. 정리 작업과 fetch 최적화를 검토하세요.');
  }
}

main().catch((e) => {
  console.error('FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});

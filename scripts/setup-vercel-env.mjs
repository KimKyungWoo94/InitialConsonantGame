import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';

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
const vars = [
  ['VITE_SUPABASE_URL', env.VITE_SUPABASE_URL],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY],
];

for (const [name, value] of vars) {
  if (!value) {
    console.error(`FAIL: ${name} 값이 .env.local에 없습니다.`);
    process.exit(1);
  }

  for (const target of ['production', 'preview', 'development']) {
    const result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', name, target, '--force'],
      {
        input: value,
        encoding: 'utf8',
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    if (result.status !== 0) {
      const err = result.stderr || result.stdout;
      if (!String(err).includes('already exists')) {
        console.error(`FAIL ${name} (${target}):`, err);
        process.exit(1);
      }
    }
    console.log(`OK: ${name} -> ${target}`);
  }
}

console.log('PASS: Vercel environment variables 설정 완료');

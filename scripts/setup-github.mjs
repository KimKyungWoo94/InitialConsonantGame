import { spawnSync } from 'child_process';

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    input,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result;
}

function gh(args) {
  return run('gh', args);
}

const status = gh(['auth', 'status']);
if (status.status !== 0) {
  console.error('FAIL: GitHub 로그인이 필요합니다.');
  console.error('1) 터미널에서 실행: gh auth login -h github.com -p https -w');
  console.error('2) 브라우저에서 https://github.com/login/device 인증 완료');
  process.exit(1);
}

const repoName = 'InitialConsonantGame';
const create = gh([
  'repo',
  'create',
  repoName,
  '--public',
  '--source=.',
  '--remote=origin',
  '--push',
]);

if (create.status !== 0) {
  const output = `${create.stdout}\n${create.stderr}`;
  if (output.includes('already exists')) {
    const view = gh(['repo', 'view', repoName, '--json', 'url,sshUrl,owner']);
    if (view.status !== 0) {
      console.error('FAIL:', view.stderr || view.stdout);
      process.exit(1);
    }
    const info = JSON.parse(view.stdout);
    const remoteUrl = `https://github.com/${info.owner.login}/${repoName}.git`;
    run('git', ['remote', 'remove', 'origin']);
    run('git', ['remote', 'add', 'origin', remoteUrl]);
    const push = run('git', ['push', '-u', 'origin', 'main']);
    if (push.status !== 0) {
      console.error('FAIL push:', push.stderr || push.stdout);
      process.exit(1);
    }
    console.log('PASS: 기존 GitHub 저장소에 push 완료');
    console.log(info.url);
    process.exit(0);
  }

  console.error('FAIL repo create:', create.stderr || create.stdout);
  process.exit(1);
}

const view = gh(['repo', 'view', repoName, '--json', 'url']);
const info = JSON.parse(view.stdout);
console.log('PASS: GitHub 저장소 생성 및 push 완료');
console.log(info.url);

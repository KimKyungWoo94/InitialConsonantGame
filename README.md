# 초성 게임

부부·친구끼리 아이폰으로 실시간 초성 단어 대결을 하는 웹 게임입니다.

## 시작하기

### 1. Supabase 설정

1. [Supabase](https://supabase.com) 대시보드 → 프로젝트 선택
2. **SQL Editor** → `supabase/schema.sql` 내용 붙여넣기 → **Run**
3. **Project Settings → API** 에서 URL과 anon key 복사

### 2. 환경 변수

프로젝트 루트에 `.env.local` 파일 생성:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### 3. 로컬 실행

```bash
npm install
npm run dev
```

PC: `http://localhost:5173`  
같은 Wi-Fi 아이폰: 터미널에 표시되는 `Network` 주소로 접속

### 3-1. 자동 검증

```bash
npm run verify:all
```

Supabase 연결, DB, 게임 플로우를 자동 검증합니다.

### 4. Vercel 배포

배포 URL: **https://initial-consonant-game.vercel.app**

1. GitHub 연동 (최초 1회):
   ```bash
   gh auth login -h github.com -p https -w
   npm run setup:github
   npx vercel git connect --yes
   ```
2. 이후 코드 push 시 Vercel이 자동 배포합니다.

Vercel 환경 변수 (이미 설정됨):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### 5. 아이폰에서 사용

1. Safari에서 배포된 URL 접속
2. **공유(↑) → 홈 화면에 추가** 로 앱처럼 설치

## 게임 방법

- 랜덤 또는 직접 입력 초성 (예: ㅅㄹ)
- 같은 초성 단어를 번갈아 입력
- **중복·없는 단어** → 다시 입력 (패배 아님)
- **포기** → 패배

## 사전 검증 설정 (1회)

1. [표준국어대사전 Open API](https://stdict.korean.go.kr/openapi/openApiInfo.do) 에서 **인증키 발급** (무료)
2. Vercel → Project Settings → Environment Variables:
   - `STDICT_API_KEY` = 발급받은 키
3. 로컬 개발 시 `.env.local`에도 추가:
   ```
   STDICT_API_KEY=발급받은_키
   ```

## DB 업데이트 (중복 규칙 변경 시 1회)

Supabase SQL Editor에서 `supabase/migrations/003_duplicate_retry.sql` 실행

## 기술 스택

- React + Vite + Tailwind CSS
- Supabase (PostgreSQL + Realtime)

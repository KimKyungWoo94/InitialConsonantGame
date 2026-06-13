import { test, expect, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('초성 게임 E2E', () => {
  test('초대 링크로 들어오면 방 코드 자동 입력', async ({ page }) => {
    await page.goto('/join/AB12');
    await expect(page.getByText('AB12 방에 초대받았어요!')).toBeVisible();
    await expect(page.getByPlaceholder('예: AB12')).toHaveValue('AB12');
    await expect(page.getByRole('button', { name: '입장하기' })).toBeVisible();
  });

  test('다시 하기 시 양쪽 플레이어 채팅 내역 초기화', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await mockDictionary(pageA);
    await mockDictionary(pageB);

    const roomCode = await createRoomWithChosung(pageA, 'ㅅㄹ');
    await joinRoom(pageB, roomCode, '플레이어B');
    await waitForGameStart(pageA, pageB);

    const words = ['사람', '사랑'];

    await submitWordAndWaitSync(pageA, pageB, words[0]);
    await submitWordAndWaitSync(pageB, pageA, words[1]);

    pageA.once('dialog', (dialog) => dialog.accept());
    await pageA.getByRole('button', { name: '포기하기' }).click();

    await expect(pageA.getByText('패배...')).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText('승리!')).toBeVisible({ timeout: 15_000 });

    await pageA.getByRole('button', { name: '랜덤 다시 하기' }).click();

    await expect(pageA.getByText('첫 단어를 입력하세요!')).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText('첫 단어를 입력하세요!')).toBeVisible({ timeout: 15_000 });
    await expect(pageA.getByText(words[0], { exact: true })).not.toBeVisible();
    await expect(pageB.getByText(words[0], { exact: true })).not.toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test('중복 단어는 패배하지 않고 재입력', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await mockDictionary(pageA);
    await mockDictionary(pageB);

    const roomCode = await createRoomWithChosung(pageA, 'ㅅㄹ');
    await joinRoom(pageB, roomCode, '테스트B');
    await waitForGameStart(pageA, pageB);

    await submitWord(pageA, '사람');
    await expect(pageA.getByText('사람', { exact: true })).toBeVisible({ timeout: 15_000 });

    await submitWord(pageB, '사랑');
    await expect(pageA.getByText('내 차례!')).toBeVisible({ timeout: 30_000 });
    await submitWord(pageA, '사람');
    await expect(pageA.getByText('이미 사용한 단어')).toBeVisible();
    await expect(pageA.getByText('내 차례!')).toBeVisible();
    await expect(pageA.getByText('패배...')).not.toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});

async function mockDictionary(page: Page) {
  await page.route('**/api/validate-word**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ exists: true }),
    });
  });
}

async function createRoomWithChosung(page: Page, chosung: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: '방 만들기' }).click();
  await page.getByPlaceholder('이름 입력').fill('플레이어A');
  await page.getByRole('button', { name: '직접 입력' }).click();

  for (const char of chosung.split('')) {
    await page.getByRole('button', { name: char, exact: true }).click();
  }

  await page.getByRole('button', { name: '방 만들기' }).click();
  await expect(page.getByText('상대방 입장 대기 중')).toBeVisible({ timeout: 10_000 });

  return (await page.locator('p.text-5xl').innerText()).trim();
}

async function joinRoom(page: Page, roomCode: string, name: string) {
  await page.goto('/');
  await page.getByRole('button', { name: '방 입장하기' }).click();
  await page.getByPlaceholder('이름 입력').fill(name);
  await page.getByPlaceholder('예: AB12').fill(roomCode);
  await page.getByRole('button', { name: '입장하기' }).click();
}

async function waitForGameStart(pageA: Page, pageB: Page) {
  await expect(pageA.getByText(/님이 입장했어요/)).toBeVisible({ timeout: 20_000 });
  await expect(pageB.getByText('방장이 게임을 시작할 때까지 기다려주세요')).toBeVisible({ timeout: 20_000 });
  await pageA.getByRole('button', { name: '게임 시작' }).click();
  await expect(pageA.getByText(/내 차례!|상대방 차례/)).toBeVisible({ timeout: 15_000 });
  await expect(pageB.getByText(/내 차례!|상대방 차례/)).toBeVisible({ timeout: 15_000 });
  await expect(pageA.getByText('내 차례!')).toBeVisible();
  await expect(pageB.getByText('상대방 차례')).toBeVisible();
}

async function submitWord(page: Page, word: string) {
  await page.getByPlaceholder(/글자 단어 입력/).fill(word);
  await page.getByRole('button', { name: '제출' }).click();
}

async function submitWordAndWaitSync(submitter: Page, observer: Page, word: string) {
  await submitWord(submitter, word);
  await expect(submitter.getByText(word, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(observer.getByText(word, { exact: true })).toBeVisible({ timeout: 30_000 });
}

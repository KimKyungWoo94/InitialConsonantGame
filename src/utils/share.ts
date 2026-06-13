export interface ShareResult {
  ok: boolean;
  method: 'share' | 'clipboard' | 'manual' | 'cancelled';
  message: string;
}

export function buildInviteUrl(origin: string, code: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/join/${code.toUpperCase()}`;
}

function buildInviteText(code: string, url: string): string {
  return `초성 게임에 초대합니다!\n방 코드: ${code}\n${url}`;
}

function copyWithTextarea(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  return copyWithTextarea(text);
}

export async function copyRoomCode(code: string): Promise<ShareResult> {
  const copied = await copyText(code);
  return {
    ok: copied,
    method: copied ? 'clipboard' : 'manual',
    message: copied ? '방 코드가 복사되었습니다!' : `복사에 실패했습니다. 방 코드: ${code}`,
  };
}

export async function shareRoomInvite(
  code: string,
  origin = window.location.origin
): Promise<ShareResult> {
  const url = buildInviteUrl(origin, code);
  const text = buildInviteText(code, url);
  const shareData: ShareData = {
    title: '초성 게임',
    text: `초성 게임에 초대합니다! 방 코드: ${code}`,
    url,
  };

  if (navigator.share) {
    const canShare = navigator.canShare ? navigator.canShare(shareData) : true;

    if (canShare) {
      try {
        await navigator.share(shareData);
        return { ok: true, method: 'share', message: '공유 메뉴를 열었습니다.' };
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: false, method: 'cancelled', message: '' };
        }
      }
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: 'clipboard', message: '방 코드가 복사되었습니다!' };
    }
  } catch {
    // fallback below
  }

  if (await copyText(text)) {
    return { ok: true, method: 'clipboard', message: '방 코드가 복사되었습니다!' };
  }

  return {
    ok: false,
    method: 'manual',
    message: `복사에 실패했습니다. 방 코드: ${code}`,
  };
}

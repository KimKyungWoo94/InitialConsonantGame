export type DictionaryValidation =
  | { ok: true }
  | { ok: false; reason: string };

export async function validateWordExists(word: string): Promise<DictionaryValidation> {
  try {
    const res = await fetch(`/api/validate-word?word=${encodeURIComponent(word)}`);

    if (res.status === 503) {
      return {
        ok: false,
        reason: '사전 API가 아직 설정되지 않았어요. (관리자에게 문의)',
      };
    }

    if (!res.ok) {
      return { ok: false, reason: '사전 검증에 실패했습니다. 다시 시도해주세요.' };
    }

    const data = (await res.json()) as { exists?: boolean; reason?: string };

    if (!data.exists) {
      return {
        ok: false,
        reason: data.reason ?? '사전에 없는 단어예요! 다른 단어를 입력해주세요.',
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: '사전 검증에 실패했습니다. 다시 시도해주세요.' };
  }
}

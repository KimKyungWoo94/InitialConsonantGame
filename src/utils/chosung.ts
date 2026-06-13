const FULL_CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const CHOSUNG_LIST = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ',
  'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const DOUBLE_CHOSUNG_MAP: Record<string, string> = {
  'ㄲ': 'ㄱ',
  'ㄸ': 'ㄷ',
  'ㅃ': 'ㅂ',
  'ㅆ': 'ㅅ',
  'ㅉ': 'ㅈ',
};

export function normalizeWord(word: string): string {
  return word.trim().normalize('NFC');
}

function normalizeChosungChar(char: string): string {
  return DOUBLE_CHOSUNG_MAP[char] ?? char;
}

export function extractChosung(word: string): string {
  return word
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0) - 0xac00;
      if (code < 0 || code > 11171) return '';
      const chosungIndex = Math.floor(code / 588);
      const raw = FULL_CHOSUNG[chosungIndex] ?? '';
      return normalizeChosungChar(raw);
    })
    .join('');
}

export type ChosungValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateChosung(word: string, chosung: string): ChosungValidation {
  const normalized = normalizeWord(word);
  if (!normalized) {
    return { ok: false, reason: '단어를 입력해주세요.' };
  }
  if (!/^[가-힣]+$/.test(normalized)) {
    return { ok: false, reason: '한글만 입력할 수 있어요.' };
  }
  if (normalized.length !== chosung.length) {
    return {
      ok: false,
      reason: `${chosung.length}글자 단어를 입력해주세요! (지금 ${normalized.length}글자)`,
    };
  }

  const extracted = extractChosung(normalized);
  if (extracted !== chosung) {
    return { ok: false, reason: '초성이 일치하지 않아요!' };
  }

  return { ok: true };
}

export function randomChosung(length: 2 | 3 = 2): string {
  return Array.from({ length }, () =>
    CHOSUNG_LIST[Math.floor(Math.random() * CHOSUNG_LIST.length)]
  ).join('');
}

export function formatChosung(chosung: string): string {
  return chosung.split('').join(' ');
}

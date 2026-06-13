const FULL_CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

export const CHOSUNG_LIST = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ',
  'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const DOUBLE_CHOSUNG_MAP: Record<string, string> = {
  'ㄲ': 'ㄱ',
  'ㄸ': 'ㄷ',
  'ㅃ': 'ㅂ',
  'ㅆ': 'ㅅ',
  'ㅉ': 'ㅈ',
};

export type ChosungLength = 2 | 3;

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
  | { ok: true; value: string }
  | { ok: false; reason: string };

export function parseChosungInput(
  raw: string,
  expectedLength?: ChosungLength
): ChosungValidation {
  const cleaned = raw
    .replace(/\s/g, '')
    .split('')
    .map((char) => normalizeChosungChar(char))
    .join('');

  if (!cleaned) {
    return { ok: false, reason: '초성을 입력해주세요.' };
  }

  for (const char of cleaned) {
    if (!CHOSUNG_LIST.includes(char as (typeof CHOSUNG_LIST)[number])) {
      return { ok: false, reason: `'${char}'는 사용할 수 없는 초성이에요.` };
    }
  }

  const length = expectedLength ?? cleaned.length;
  if (cleaned.length !== length) {
    return { ok: false, reason: `${length}글자 초성을 입력해주세요!` };
  }

  if (length < 2 || length > 3) {
    return { ok: false, reason: '초성은 2~3글자만 가능해요.' };
  }

  return { ok: true, value: cleaned };
}

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

  return { ok: true, value: normalized };
}

export function randomChosung(length: ChosungLength = 2): string {
  return Array.from({ length }, () =>
    CHOSUNG_LIST[Math.floor(Math.random() * CHOSUNG_LIST.length)]
  ).join('');
}

export function formatChosung(chosung: string): string {
  return chosung.split('').join(' ');
}

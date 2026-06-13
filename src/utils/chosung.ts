const CHOSUNG_LIST = [
  'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ',
  'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

export function normalizeWord(word: string): string {
  return word.trim().normalize('NFC');
}

export function extractChosung(word: string): string {
  return word
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0) - 0xac00;
      if (code < 0 || code > 11171) return '';
      const chosungIndex = Math.floor(code / 588);
      return CHOSUNG_LIST[chosungIndex] ?? '';
    })
    .join('');
}

export function validateChosung(word: string, chosung: string): boolean {
  const normalized = normalizeWord(word);
  if (!normalized) return false;
  if (!/^[가-힣]+$/.test(normalized)) return false;
  return extractChosung(normalized) === chosung;
}

export function randomChosung(length: 2 | 3 = 2): string {
  return Array.from({ length }, () =>
    CHOSUNG_LIST[Math.floor(Math.random() * CHOSUNG_LIST.length)]
  ).join('');
}

export function formatChosung(chosung: string): string {
  return chosung.split('').join(' ');
}

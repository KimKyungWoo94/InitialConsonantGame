import {
  extractChosung,
  parseChosungInput,
  validateChosung,
} from '../src/utils/chosung.ts';

const tests = [
  {
    name: '박쥐 → ㅂㅈ',
    run: () => extractChosung('박쥐') === 'ㅂㅈ',
  },
  {
    name: '사랑 → ㅅㄹ',
    run: () => extractChosung('사랑') === 'ㅅㄹ',
  },
  {
    name: '박쥐 validates ㅂㅈ',
    run: () => validateChosung('박쥐', 'ㅂㅈ').ok === true,
  },
  {
    name: '박쥐쥐 length mismatch',
    run: () => validateChosung('박쥐쥐', 'ㅂㅈ').ok === false,
  },
  {
    name: 'parse ㅂ ㅈ',
    run: () => parseChosungInput('ㅂ ㅈ', 2).ok && parseChosungInput('ㅂ ㅈ', 2).value === 'ㅂㅈ',
  },
  {
    name: 'parse ㅉ normalizes to ㅈ',
    run: () => parseChosungInput('ㅂㅉ', 2).ok && parseChosungInput('ㅂㅉ', 2).value === 'ㅂㅈ',
  },
  {
    name: 'reject invalid char',
    run: () => parseChosungInput('ㅂa', 2).ok === false,
  },
  {
    name: '3 letter chosung',
    run: () => parseChosungInput('ㅅㅇㅎ', 3).ok === true,
  },
];

let failed = 0;
for (const test of tests) {
  if (!test.run()) {
    console.error('FAIL:', test.name);
    failed++;
  } else {
    console.log('OK:', test.name);
  }
}

if (failed > 0) {
  console.error(`FAIL: ${failed} tests failed`);
  process.exit(1);
}

console.log('PASS: 초성 유틸 검증 완료');

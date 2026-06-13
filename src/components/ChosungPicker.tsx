import {
  CHOSUNG_LIST,
  formatChosung,
  parseChosungInput,
  type ChosungLength,
} from '../utils/chosung';

interface ChosungPickerProps {
  value: string;
  length: ChosungLength;
  onChange: (value: string) => void;
  onLengthChange: (length: ChosungLength) => void;
  disabled?: boolean;
}

export function ChosungPicker({
  value,
  length,
  onChange,
  onLengthChange,
  disabled = false,
}: ChosungPickerProps) {
  const handlePick = (char: string) => {
    if (disabled || value.length >= length) return;
    onChange(value + char);
  };

  const handleBackspace = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {([2, 3] as ChosungLength[]).map((len) => (
          <button
            key={len}
            type="button"
            disabled={disabled}
            onClick={() => {
              onLengthChange(len);
              onChange(value.slice(0, len));
            }}
            className={`flex-1 rounded-xl py-2 text-sm font-medium ${
              length === len
                ? 'bg-violet-500 text-white'
                : 'bg-white/10 text-violet-200'
            }`}
          >
            {len}글자
          </button>
        ))}
      </div>

      <div className="flex min-h-[3.5rem] items-center justify-center rounded-xl bg-black/20 px-4">
        <p className="text-3xl font-bold tracking-[0.4em] text-white">
          {value ? formatChosung(value) : '초성 선택'}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {CHOSUNG_LIST.map((char) => (
          <button
            key={char}
            type="button"
            disabled={disabled || value.length >= length}
            onClick={() => handlePick(char)}
            className="rounded-xl bg-white/10 py-3 text-lg font-bold text-white active:bg-violet-500 disabled:opacity-40"
          >
            {char}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || value.length === 0}
        onClick={handleBackspace}
        className="w-full rounded-xl border border-white/20 py-2 text-sm text-violet-200 disabled:opacity-40"
      >
        지우기
      </button>
    </div>
  );
}

export function validateCustomChosung(value: string, length: ChosungLength) {
  return parseChosungInput(value, length);
}

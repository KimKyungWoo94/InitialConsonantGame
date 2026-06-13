import { useEffect } from 'react';
import type { NudgePayload } from '../types/nudge';

const FLOATING_EMOJIS = ['🐣', '✨', '💨', '⏰', '🏃‍♀️', '💕'];

interface NudgeEffectProps {
  payload: NudgePayload | null;
  onDone: () => void;
}

export function NudgeEffect({ payload, onDone }: NudgeEffectProps) {
  useEffect(() => {
    if (!payload) return;
    const timer = setTimeout(onDone, 2800);
    return () => clearTimeout(timer);
  }, [payload, onDone]);

  if (!payload) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {FLOATING_EMOJIS.map((emoji, index) => (
        <span
          key={`${emoji}-${index}`}
          className="nudge-float absolute text-2xl"
          style={{
            left: `${12 + index * 14}%`,
            top: `${18 + (index % 3) * 8}%`,
            animationDelay: `${index * 0.12}s`,
          }}
        >
          {emoji}
        </span>
      ))}

      <div className="flex h-full items-center justify-center px-6">
        <div className="nudge-pop max-w-xs rounded-3xl border border-violet-200/80 bg-white/95 px-6 py-5 text-center shadow-2xl backdrop-blur">
          <p className="text-5xl leading-none">🐣💨</p>
          <p className="mt-3 text-lg font-bold text-violet-700">
            {payload.fromName}님이 재촉했어요!
          </p>
          <p className="mt-1 text-sm text-violet-500">빨리빨리~ 내 차례 기다리는 중 🏃‍♀️</p>
        </div>
      </div>
    </div>
  );
}

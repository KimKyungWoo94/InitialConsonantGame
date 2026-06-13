import type { Answer } from '../types';
import { normalizeWord } from './chosung';

export function sortAnswers(answers: Answer[]): Answer[] {
  return [...answers].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

export function mergeAnswer(prev: Answer[], incoming: Answer): Answer[] {
  if (prev.some((a) => a.id === incoming.id)) return prev;

  const withoutOptimistic = prev.filter(
    (a) =>
      !(
        a.id.startsWith('opt-') &&
        a.player === incoming.player &&
        normalizeWord(a.word) === normalizeWord(incoming.word)
      )
  );

  return sortAnswers([...withoutOptimistic, incoming]);
}

export function appendOptimisticAnswer(
  prev: Answer[],
  roomId: string,
  player: Answer['player'],
  word: string,
  definition?: string | null
): Answer[] {
  const normalized = normalizeWord(word);
  if (prev.some((a) => normalizeWord(a.word) === normalized)) return prev;

  const optimistic: Answer = {
    id: `opt-${normalized}`,
    room_id: roomId,
    player,
    word: normalized,
    definition: definition ?? null,
    created_at: new Date().toISOString(),
  };

  return sortAnswers([...prev, optimistic]);
}

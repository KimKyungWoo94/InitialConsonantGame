export interface RecentOpponent {
  name: string;
  playedAt: string;
}

const KEY = 'chosung_recent_opponents';
const MAX = 5;

export function loadRecentOpponents(): RecentOpponent[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as RecentOpponent[];
  } catch {
    return [];
  }
}

export function addRecentOpponent(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;

  const list = loadRecentOpponents().filter((o) => o.name !== trimmed);
  list.unshift({ name: trimmed, playedAt: new Date().toISOString() });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

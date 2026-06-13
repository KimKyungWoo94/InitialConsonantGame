import type { GameSession } from '../types';

const SESSION_KEY = 'chosung_game_session';

function createPlayerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getPlayerId(): string {
  const key = 'chosung_player_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = createPlayerId();
    localStorage.setItem(key, id);
  }
  return id;
}

export function saveSession(session: GameSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): GameSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

const PLAYER_NAME_KEY = 'chosung_player_name';

export function savePlayerName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

export function loadPlayerName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) ?? '';
}

export type PlayerRole = 'A' | 'B';
export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  code: string;
  chosung: string;
  status: RoomStatus;
  player_a: string | null;
  player_b: string | null;
  player_a_id: string | null;
  player_b_id: string | null;
  turn: PlayerRole | null;
  winner: PlayerRole | null;
  last_activity: string;
  created_at: string;
}

export interface Answer {
  id: string;
  room_id: string;
  player: PlayerRole;
  word: string;
  created_at: string;
}

export interface GameSession {
  roomId: string;
  player: PlayerRole;
  playerName: string;
  playerId: string;
}

export interface SubmitWordResult {
  success: boolean;
  reason?: string;
  gameOver?: boolean;
  loser?: PlayerRole;
}

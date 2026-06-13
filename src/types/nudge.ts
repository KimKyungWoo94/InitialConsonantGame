import type { PlayerRole } from '../types';

export interface NudgePayload {
  from: PlayerRole;
  fromName: string;
  to: PlayerRole;
}

export const NUDGE_COOLDOWN_MS = 8000;

import { supabase } from '../lib/supabase';
import type { PlayerRole, Room, SubmitWordResult } from '../types';
import { normalizeWord, randomChosung, validateChosung } from '../utils/chosung';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export async function createRoom(playerName: string, playerId: string): Promise<Room> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const chosung = randomChosung(2);

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        chosung,
        player_a: playerName,
        player_a_id: playerId,
        status: 'waiting',
        turn: 'A',
      })
      .select()
      .single();

    if (!error && data) return data as Room;
    if (error?.code !== '23505') throw error;
  }

  throw new Error('방 코드 생성에 실패했습니다. 다시 시도해주세요.');
}

export async function joinRoom(
  code: string,
  playerName: string,
  playerId: string
): Promise<Room> {
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('status', 'waiting')
    .single();

  if (error || !room) throw new Error('방을 찾을 수 없습니다. 코드를 확인해주세요.');

  const { data, error: updateError } = await supabase
    .from('rooms')
    .update({
      player_b: playerName,
      player_b_id: playerId,
      status: 'playing',
    })
    .eq('id', room.id)
    .eq('status', 'waiting')
    .select()
    .single();

  if (updateError || !data) throw new Error('이미 다른 사람이 입장했거나 방이 없습니다.');
  return data as Room;
}

export async function fetchRoom(roomId: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error) return null;
  return data as Room;
}

export async function fetchAnswers(roomId: string) {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function submitWord(
  roomId: string,
  player: PlayerRole,
  word: string,
  chosung: string,
  usedWords: string[]
): Promise<SubmitWordResult> {
  const normalized = normalizeWord(word);

  if (!validateChosung(normalized, chosung)) {
    return { success: false, reason: '초성이 일치하지 않아요!' };
  }

  if (usedWords.some((w) => normalizeWord(w) === normalized)) {
    await endGame(roomId, player);
    return {
      success: false,
      reason: '이미 나온 단어예요!',
      gameOver: true,
      loser: player,
    };
  }

  const { data, error } = await supabase.rpc('submit_word', {
    p_room_id: roomId,
    p_player: player,
    p_word: normalized,
  });

  if (error) throw error;
  return data as SubmitWordResult;
}

export async function surrender(roomId: string, player: PlayerRole) {
  const { data, error } = await supabase.rpc('surrender_game', {
    p_room_id: roomId,
    p_player: player,
  });

  if (error) throw error;
  return data;
}

export async function rematch(roomId: string) {
  const { data, error } = await supabase.rpc('rematch_game', {
    p_room_id: roomId,
  });

  if (error) throw error;
  return data;
}

export async function endGame(roomId: string, loser: PlayerRole) {
  const winner: PlayerRole = loser === 'A' ? 'B' : 'A';
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'finished', winner })
    .eq('id', roomId);

  if (error) throw error;
}

export function resolvePlayerRole(room: Room, playerId: string): PlayerRole | null {
  if (room.player_a_id === playerId) return 'A';
  if (room.player_b_id === playerId) return 'B';
  return null;
}

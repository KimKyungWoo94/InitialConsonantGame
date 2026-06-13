import { supabase } from '../lib/supabase';
import type { PlayerRole, Room, SubmitWordResult } from '../types';
import { normalizeWord, randomChosung, validateChosung } from '../utils/chosung';
import { validateWordExists } from '../utils/dictionary';

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export async function createRoom(
  playerName: string,
  playerId: string,
  chosung?: string
): Promise<Room> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const roomChosung = chosung ?? randomChosung(2);

    const { data, error } = await supabase
      .from('rooms')
      .insert({
        code,
        chosung: roomChosung,
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
    .single();

  if (error || !room) throw new Error('방을 찾을 수 없습니다. 코드를 확인해주세요.');

  if (room.status !== 'waiting') {
    throw new Error('이미 게임이 시작된 방입니다.');
  }

  if (room.player_b_id) {
    throw new Error('이 방은 2인 전용입니다. 이미 상대가 입장했어요.');
  }

  if (room.player_a_id === playerId) {
    throw new Error('내가 만든 방입니다. 홈에서 이어하기를 이용해주세요.');
  }

  const { data, error: updateError } = await supabase
    .from('rooms')
    .update({
      player_b: playerName,
      player_b_id: playerId,
    })
    .eq('id', room.id)
    .eq('status', 'waiting')
    .is('player_b_id', null)
    .select()
    .single();

  if (updateError || !data) {
    throw new Error('이미 다른 사람이 입장했거나 방이 없습니다.');
  }
  return data as Room;
}

export async function startGame(
  roomId: string,
  playerId: string,
  firstTurn: PlayerRole = 'A'
): Promise<void> {
  const { data, error } = await supabase.rpc('start_game', {
    p_room_id: roomId,
    p_player_id: playerId,
    p_first_turn: firstTurn,
  });

  if (error) {
    if (error.message.includes('start_game')) {
      throw new Error('게임 시작 설정이 필요해요. Supabase SQL Editor에서 006_start_game.sql을 실행해주세요.');
    }
    throw error;
  }

  const result = data as { success?: boolean; reason?: string };
  if (!result?.success) {
    throw new Error(result?.reason ?? '게임 시작에 실패했습니다.');
  }
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

function formatSubmitRpcError(message: string): string {
  if (message.includes('submit_word') || message.includes('PGRST202')) {
    return '단어 제출 설정 오류예요. Supabase SQL Editor에서 008_submit_word_fix.sql을 실행해주세요.';
  }
  if (message.includes('definition')) {
    return '뜻풀이 저장 설정이 필요해요. Supabase에서 007 SQL을 실행해주세요.';
  }
  return message;
}

export async function submitWord(
  roomId: string,
  player: PlayerRole,
  word: string,
  chosung: string,
  usedWords: string[]
): Promise<SubmitWordResult> {
  const normalized = normalizeWord(word);
  const validation = validateChosung(normalized, chosung);

  if (!validation.ok) {
    return { success: false, reason: validation.reason };
  }

  if (usedWords.some((w) => normalizeWord(w) === normalized)) {
    return {
      success: false,
      reason: '이미 사용한 단어예요! 다른 단어를 입력해주세요.',
    };
  }

  const dictionaryCheck = await validateWordExists(normalized);
  if (!dictionaryCheck.ok) {
    return { success: false, reason: dictionaryCheck.reason };
  }

  const { data, error } = await supabase.rpc('submit_word', {
    p_room_id: roomId,
    p_player: player,
    p_word: normalized,
    p_definition: dictionaryCheck.definition ?? null,
  });

  if (error) {
    return {
      success: false,
      reason: formatSubmitRpcError(error.message),
    };
  }

  if (!data || typeof data !== 'object') {
    return { success: false, reason: '서버 응답이 없습니다. 잠시 후 다시 시도해주세요.' };
  }

  const result = data as SubmitWordResult;
  if (!result.success) {
    return {
      ...result,
      reason:
        result.reason ??
        (result.gameOver ? '게임이 종료되었습니다.' : '제출이 거부되었습니다. 다시 시도해주세요.'),
    };
  }

  return result;
}

export async function surrender(roomId: string, player: PlayerRole) {
  const { data, error } = await supabase.rpc('surrender_game', {
    p_room_id: roomId,
    p_player: player,
  });

  if (error) throw error;
  return data;
}

export async function rematch(roomId: string, chosung?: string, firstTurn: PlayerRole = 'A') {
  const room = await fetchRoom(roomId);
  const length = (room?.chosung.length === 3 ? 3 : 2) as 2 | 3;
  const finalChosung = chosung ?? randomChosung(length);

  const { error: rpcError } = await supabase.rpc('rematch_game', {
    p_room_id: roomId,
  });
  if (rpcError) throw rpcError;

  const { error: updateError } = await supabase
    .from('rooms')
    .update({ chosung: finalChosung, turn: firstTurn })
    .eq('id', roomId);

  if (updateError) throw updateError;
  return { success: true };
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

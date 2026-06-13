import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Answer, Room } from '../types';

export function useRoomSubscription(
  roomId: string | undefined,
  onUpdate: (room: Room) => void
) {
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) onUpdate(payload.new as Room);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onUpdate]);
}

export function useAnswersSubscription(
  roomId: string | undefined,
  onNewAnswer: (answer: Answer) => void
) {
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`answers-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'answers',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) onNewAnswer(payload.new as Answer);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onNewAnswer]);
}

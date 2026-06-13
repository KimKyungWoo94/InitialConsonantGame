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
  onInsert: (answer: Answer) => void,
  onDelete: (answerId: string) => void,
  onClear: () => void
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
          if (payload.new) onInsert(payload.new as Answer);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'answers',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const deletedId = (payload.old as Answer | undefined)?.id;
          if (deletedId) onDelete(deletedId);
          else onClear();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onInsert, onDelete, onClear]);
}

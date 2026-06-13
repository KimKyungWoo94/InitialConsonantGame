import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PlayerRole } from '../types';
import { NUDGE_COOLDOWN_MS, type NudgePayload } from '../types/nudge';

export function useNudge(
  roomId: string | undefined,
  player: PlayerRole | null,
  playerName: string | undefined,
  onReceived: (payload: NudgePayload) => void
) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onReceivedRef = useRef(onReceived);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [sentMessage, setSentMessage] = useState('');

  useEffect(() => {
    onReceivedRef.current = onReceived;
  }, [onReceived]);

  useEffect(() => {
    if (!roomId || !player) return;

    const channel = supabase.channel(`nudge:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'nudge' }, ({ payload }) => {
      const data = payload as NudgePayload;
      if (data?.to === player) {
        onReceivedRef.current(data);
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, player]);

  useEffect(() => {
    if (cooldownMs <= 0) return;

    const timer = setInterval(() => {
      setCooldownMs((prev) => Math.max(0, prev - 200));
    }, 200);

    return () => clearInterval(timer);
  }, [cooldownMs]);

  const sendNudge = useCallback(async () => {
    if (!channelRef.current || !player || !playerName || cooldownMs > 0) return false;

    const opponent: PlayerRole = player === 'A' ? 'B' : 'A';
    await channelRef.current.send({
      type: 'broadcast',
      event: 'nudge',
      payload: { from: player, fromName: playerName, to: opponent } satisfies NudgePayload,
    });

    setCooldownMs(NUDGE_COOLDOWN_MS);
    setSentMessage('재촉 보냈어요! 💨');
    return true;
  }, [player, playerName, cooldownMs]);

  useEffect(() => {
    if (!sentMessage) return;
    const timer = setTimeout(() => setSentMessage(''), 2200);
    return () => clearTimeout(timer);
  }, [sentMessage]);

  return {
    sendNudge,
    cooldownMs,
    sentMessage,
    canNudge: cooldownMs <= 0,
    cooldownSeconds: Math.ceil(cooldownMs / 1000),
  };
}

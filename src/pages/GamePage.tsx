import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchAnswers,
  fetchRoom,
  rematch,
  resolvePlayerRole,
  submitWord,
  surrender,
} from '../hooks/useRoom';
import { useAnswersSubscription, useRoomSubscription } from '../hooks/useGameSubscription';
import type { Answer, GameSession, PlayerRole, Room } from '../types';
import { formatChosung, type ChosungLength } from '../utils/chosung';
import { loadSession, saveSession } from '../utils/session';
import { shareRoomInvite } from '../utils/share';
import { ChosungPicker, validateCustomChosung } from '../components/ChosungPicker';

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [session, setSession] = useState<GameSession | null>(null);
  const [word, setWord] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [rematchMode, setRematchMode] = useState<'random' | 'custom'>('random');
  const [rematchChosung, setRematchChosung] = useState('');
  const [rematchLength, setRematchLength] = useState<ChosungLength>(2);
  const [rematching, setRematching] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const player: PlayerRole | null = session?.player ?? null;
  const isMyTurn = room?.status === 'playing' && room.turn === player;
  const opponentName =
    player === 'A' ? room?.player_b : player === 'B' ? room?.player_a : null;

  const handleRoomUpdate = useCallback((updated: Room) => {
    setRoom(updated);
  }, []);

  const handleNewAnswer = useCallback((answer: Answer) => {
    setAnswers((prev) => {
      if (prev.some((a) => a.id === answer.id)) return prev;
      return [...prev, answer];
    });
  }, []);

  useRoomSubscription(roomId, handleRoomUpdate);
  useAnswersSubscription(roomId, handleNewAnswer);

  useEffect(() => {
    const id = roomId;
    if (!id) {
      navigate('/');
      return;
    }

    async function init(currentRoomId: string) {
      setLoading(true);
      const stored = loadSession();
      const roomData = await fetchRoom(currentRoomId);

      if (!roomData) {
        navigate('/');
        return;
      }

      if (stored && stored.roomId === currentRoomId) {
        setSession(stored);
      } else if (stored) {
        const role = resolvePlayerRole(roomData, stored.playerId);
        if (role) {
          const updated: GameSession = { ...stored, player: role, roomId: currentRoomId };
          saveSession(updated);
          setSession(updated);
        }
      }

      const answerData = await fetchAnswers(currentRoomId);
      setAnswers(answerData);
      setRoom(roomData);
      setLoading(false);
    }

    init(id);
  }, [roomId, navigate]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [answers]);

  const handleSubmit = async () => {
    if (!room || !player || !word.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const usedWords = answers.map((a) => a.word);
      const result = await submitWord(room.id, player, word, room.chosung, usedWords);

      if (!result.success) {
        setError(result.reason ?? '제출에 실패했습니다.');
        if (result.gameOver) setWord('');
        return;
      }

      setWord('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSurrender = async () => {
    if (!room || !player) return;
    if (!confirm('정말 포기하시겠어요?')) return;

    try {
      await surrender(room.id, player);
    } catch (e) {
      setError(e instanceof Error ? e.message : '포기 처리에 실패했습니다.');
    }
  };

  const handleRematch = async (chosung?: string) => {
    if (!room || rematching) return;

    if (rematchMode === 'custom' && !chosung) {
      const validation = validateCustomChosung(rematchChosung, rematchLength);
      if (!validation.ok) {
        setError(validation.reason);
        return;
      }
      chosung = validation.value;
    }

    setRematching(true);
    setError('');

    try {
      await rematch(room.id, chosung);
      setAnswers([]);
      setWord('');
      setRematchChosung('');
      setRematchMode('random');
    } catch (e) {
      setError(e instanceof Error ? e.message : '다시 하기에 실패했습니다.');
    } finally {
      setRematching(false);
    }
  };

  const shareInvite = async () => {
    if (!room) return;

    const result = await shareRoomInvite(room.code);
    if (result.message) {
      setShareMessage(result.message);
      setTimeout(() => setShareMessage(''), 3000);
    }
  };

  if (loading || !room) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-violet-200">
        불러오는 중...
      </div>
    );
  }

  if (room.status === 'playing' && !player) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
          <p className="text-violet-200">이 기기에서는 게임 세션이 없어요.</p>
          <p className="mt-2 text-sm text-violet-300">홈에서 방 만들기 또는 입장을 다시 해주세요.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 w-full rounded-2xl bg-violet-500 py-4 font-semibold text-white"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  if (room.status === 'finished') {
    const isWinner = room.winner === player;
    const winnerName =
      room.winner === 'A' ? room.player_a : room.winner === 'B' ? room.player_b : null;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-md rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
          <p className="text-6xl">{isWinner ? '🎉' : '😢'}</p>
          <h2 className="mt-4 text-2xl font-bold text-white">
            {isWinner ? '승리!' : '패배...'}
          </h2>
          <p className="mt-2 text-violet-200">
            {winnerName ? `${winnerName}님이 이겼습니다` : '게임 종료'}
          </p>
          <p className="mt-4 text-3xl font-bold tracking-widest text-violet-300">
            {formatChosung(room.chosung)}
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRematchMode('random')}
                className={`flex-1 rounded-xl py-2 text-sm ${
                  rematchMode === 'random' ? 'bg-violet-500 text-white' : 'bg-white/10 text-violet-200'
                }`}
              >
                랜덤
              </button>
              <button
                type="button"
                onClick={() => {
                  setRematchMode('custom');
                  setRematchLength(room.chosung.length as ChosungLength);
                }}
                className={`flex-1 rounded-xl py-2 text-sm ${
                  rematchMode === 'custom' ? 'bg-violet-500 text-white' : 'bg-white/10 text-violet-200'
                }`}
              >
                초성 직접 입력
              </button>
            </div>

            {rematchMode === 'custom' && (
              <ChosungPicker
                value={rematchChosung}
                length={rematchLength}
                onChange={setRematchChosung}
                onLengthChange={setRematchLength}
                disabled={rematching}
              />
            )}

            <button
              onClick={() => handleRematch()}
              disabled={rematching}
              className="w-full rounded-2xl bg-violet-500 py-4 font-semibold text-white disabled:opacity-50"
            >
              {rematching ? '시작 중...' : rematchMode === 'random' ? '랜덤 다시 하기' : '이 초성으로 다시 하기'}
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full rounded-2xl border border-white/20 py-3 text-violet-200"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (room.status === 'waiting') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-md rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
          <p className="text-violet-200">상대방 입장 대기 중...</p>
          <p className="mt-6 text-5xl font-bold tracking-[0.3em] text-white">{room.code}</p>
          <p className="mt-4 text-2xl font-bold tracking-widest text-violet-300">
            {formatChosung(room.chosung)}
          </p>
          <p className="mt-2 text-sm text-violet-300">방 코드를 공유하세요</p>
          {shareMessage && (
            <p className="mt-4 rounded-xl bg-green-500/20 px-3 py-2 text-sm text-green-200">
              {shareMessage}
            </p>
          )}
          <button
            onClick={shareInvite}
            className="mt-6 w-full rounded-2xl bg-violet-500 py-4 font-semibold text-white active:scale-[0.98]"
          >
            코드 공유하기
          </button>
          <p className="mt-3 text-xs text-violet-400">
            공유가 안 되면 카카오톡에 방 코드({room.code})를 직접 보내주세요
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-3 w-full py-2 text-sm text-violet-300"
          >
            홈으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="mb-4 text-center">
          <p className="text-sm text-violet-300">
            상대: <span className="font-medium text-white">{opponentName ?? '...'}</span>
          </p>
          <h1 className="mt-2 text-5xl font-bold tracking-[0.4em] text-white">
            {formatChosung(room.chosung)}
          </h1>
          <p className={`mt-2 text-sm font-medium ${isMyTurn ? 'text-green-300' : 'text-violet-300'}`}>
            {isMyTurn ? '내 차례!' : '상대방 차례...'}
          </p>
        </header>

        <div
          ref={historyRef}
          className="mb-4 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-black/20 p-4"
        >
          {answers.length === 0 ? (
            <p className="text-center text-sm text-violet-400">첫 단어를 입력하세요!</p>
          ) : (
            answers.map((answer) => {
              const isMine = answer.player === player;
              return (
                <div
                  key={answer.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isMine
                        ? 'rounded-br-sm bg-violet-500 text-white'
                        : 'rounded-bl-sm bg-white/15 text-violet-100'
                    }`}
                  >
                    <p className="text-xs opacity-70">{isMine ? '나' : opponentName}</p>
                    <p className="text-lg font-medium">{answer.word}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && (
          <p className="mb-2 rounded-xl bg-red-500/20 px-3 py-2 text-center text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && isMyTurn && handleSubmit()}
              placeholder={
                isMyTurn
                  ? `${room.chosung.length}글자 단어 입력...`
                  : '상대방 차례'
              }
              disabled={!isMyTurn || submitting}
              className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-lg text-white placeholder:text-violet-400/50 outline-none focus:border-violet-300 disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!isMyTurn || !word.trim() || submitting}
              className="rounded-2xl bg-violet-500 px-5 font-semibold text-white disabled:opacity-40"
            >
              제출
            </button>
          </div>
          <button
            onClick={handleSurrender}
            className="w-full py-2 text-sm text-red-300"
          >
            포기하기
          </button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchAnswers,
  fetchRoom,
  rematch,
  resolvePlayerRole,
  startGame,
  submitWord,
  surrender,
} from '../hooks/useRoom';
import { useAnswersSubscription, useRoomSubscription } from '../hooks/useGameSubscription';
import type { Answer, GameSession, PlayerRole, Room } from '../types';
import { formatChosung, type ChosungLength } from '../utils/chosung';
import { formatDuration } from '../utils/formatDuration';
import { addRecentOpponent } from '../utils/recentOpponents';
import { loadSession, saveSession } from '../utils/session';
import { copyRoomCode, shareRoomInvite } from '../utils/share';
import { notifyMyTurn } from '../utils/turnAlert';
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
  const [firstTurn, setFirstTurn] = useState<PlayerRole>('A');
  const [starting, setStarting] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const roomRef = useRef<Room | null>(null);
  const wasMyTurnRef = useRef(false);
  const gameStartedAtRef = useRef<number | null>(null);
  const savedOpponentRef = useRef(false);
  const [gameStats, setGameStats] = useState({ wordCount: 0, durationMs: 0 });

  const player: PlayerRole | null = session?.player ?? null;
  const isMyTurn = room?.status === 'playing' && room.turn === player;
  const opponentName =
    player === 'A' ? room?.player_b : player === 'B' ? room?.player_a : null;

  const handleRoomUpdate = useCallback((updated: Room) => {
    const previous = roomRef.current;
    roomRef.current = updated;
    setRoom(updated);

    const rematched =
      previous?.status === 'finished' &&
      updated.status === 'playing' &&
      updated.winner === null;

    if (rematched && roomId) {
      fetchAnswers(roomId).then(setAnswers);
      setWord('');
      setError('');
      setRematchChosung('');
      setRematchMode('random');
      gameStartedAtRef.current = Date.now();
      savedOpponentRef.current = false;
      return;
    }

    if (previous?.status !== 'playing' && updated.status === 'playing') {
      gameStartedAtRef.current = Date.now();
      savedOpponentRef.current = false;
    }

    if (
      previous &&
      previous.turn !== updated.turn &&
      updated.status === 'playing' &&
      roomId
    ) {
      fetchAnswers(roomId).then(setAnswers);
    }
  }, [roomId]);

  const handleNewAnswer = useCallback((answer: Answer) => {
    setAnswers((prev) => {
      if (prev.some((a) => a.id === answer.id)) return prev;
      return [...prev, answer];
    });
  }, []);

  const handleDeleteAnswer = useCallback((answerId: string) => {
    setAnswers((prev) => prev.filter((a) => a.id !== answerId));
  }, []);

  const handleClearAnswers = useCallback(() => {
    setAnswers([]);
  }, []);

  useRoomSubscription(roomId, handleRoomUpdate);
  useAnswersSubscription(roomId, handleNewAnswer, handleDeleteAnswer, handleClearAnswers);

  useEffect(() => {
    if (!roomId || room?.status !== 'waiting') return;

    const poll = setInterval(async () => {
      const fresh = await fetchRoom(roomId);
      if (!fresh) return;

      const changed =
        fresh.status !== room?.status ||
        fresh.player_b !== room?.player_b ||
        fresh.turn !== room?.turn;

      if (changed) {
        handleRoomUpdate(fresh);
        if (fresh.status === 'playing') {
          fetchAnswers(roomId).then(setAnswers);
        }
      }
    }, 1500);

    return () => clearInterval(poll);
  }, [roomId, room?.status, room?.player_b, room?.turn, handleRoomUpdate]);

  useEffect(() => {
    if (!roomId || room?.status !== 'finished') return;

    const poll = setInterval(async () => {
      const fresh = await fetchRoom(roomId);
      if (fresh && fresh.status === 'playing' && fresh.winner === null) {
        handleRoomUpdate(fresh);
        fetchAnswers(roomId).then(setAnswers);
      }
    }, 1500);

    return () => clearInterval(poll);
  }, [roomId, room?.status, handleRoomUpdate]);

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
      roomRef.current = roomData;
      setLoading(false);
    }

    init(id);
  }, [roomId, navigate]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [answers]);

  useEffect(() => {
    if (room?.status === 'playing' && !gameStartedAtRef.current) {
      gameStartedAtRef.current = Date.now();
    }
  }, [room?.status]);

  useEffect(() => {
    if (!isMyTurn) {
      wasMyTurnRef.current = false;
      return;
    }

    if (!wasMyTurnRef.current) {
      notifyMyTurn();
      wasMyTurnRef.current = true;
      inputRef.current?.focus();
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (room?.status !== 'finished' || !opponentName || savedOpponentRef.current) return;

    savedOpponentRef.current = true;
    addRecentOpponent(opponentName);

    const startedAt =
      gameStartedAtRef.current ??
      (answers[0] ? new Date(answers[0].created_at).getTime() : Date.now());
    setGameStats({
      wordCount: answers.length,
      durationMs: Date.now() - startedAt,
    });
  }, [room?.status, opponentName, answers.length]);

  const focusInput = () => {
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSubmit = async () => {
    if (!room || !player || !word.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const usedWords = answers.map((a) => a.word);
      const result = await submitWord(room.id, player, word, room.chosung, usedWords);

      if (!result.success) {
        setError(result.reason ?? '제출에 실패했습니다.');
        focusInput();
        return;
      }

      setWord('');
      focusInput();
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출에 실패했습니다.');
      focusInput();
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
      await rematch(room.id, chosung, firstTurn);
      const [freshAnswers, freshRoom] = await Promise.all([
        fetchAnswers(room.id),
        fetchRoom(room.id),
      ]);
      setAnswers(freshAnswers);
      if (freshRoom) {
        roomRef.current = freshRoom;
        setRoom(freshRoom);
      }
      setWord('');
      setRematchChosung('');
      setRematchMode('random');
    } catch (e) {
      setError(e instanceof Error ? e.message : '다시 하기에 실패했습니다.');
    } finally {
      setRematching(false);
    }
  };

  const handleStartGame = async () => {
    if (!room || !session || player !== 'A' || starting) return;

    setStarting(true);
    setError('');

    try {
      await startGame(room.id, session.playerId, firstTurn);
      const freshRoom = await fetchRoom(room.id);
      if (freshRoom) {
        roomRef.current = freshRoom;
        setRoom(freshRoom);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '게임 시작에 실패했습니다.');
    } finally {
      setStarting(false);
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

  const copyCode = async () => {
    if (!room) return;

    const result = await copyRoomCode(room.code);
    if (result.message) {
      setCopyMessage(result.message);
      setTimeout(() => setCopyMessage(''), 3000);
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
          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-violet-200">
            <p>총 {gameStats.wordCount}개 단어</p>
            <p className="mt-1">플레이 시간 {formatDuration(gameStats.durationMs)}</p>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
          )}

          <div className="mt-6 space-y-3">
            <div>
              <p className="mb-2 text-sm text-violet-200">선공 설정</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFirstTurn('A')}
                  className={`flex-1 rounded-xl py-2 text-sm ${
                    firstTurn === 'A' ? 'bg-violet-500 text-white' : 'bg-white/10 text-violet-200'
                  }`}
                >
                  {room.player_a ?? '방장'} 먼저
                </button>
                <button
                  type="button"
                  onClick={() => setFirstTurn('B')}
                  className={`flex-1 rounded-xl py-2 text-sm ${
                    firstTurn === 'B' ? 'bg-violet-500 text-white' : 'bg-white/10 text-violet-200'
                  }`}
                >
                  {room.player_b ?? '상대'} 먼저
                </button>
              </div>
            </div>

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
    const isHost = player === 'A';
    const opponentJoined = Boolean(room.player_b);

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="w-full max-w-md rounded-3xl bg-white/10 p-8 text-center backdrop-blur">
          <p className="text-violet-200">
            {isHost
              ? opponentJoined
                ? `${room.player_b}님이 입장했어요!`
                : '상대방 입장 대기 중...'
              : `${room.player_a}님의 방에 입장했어요`}
          </p>
          <p className="mt-6 text-5xl font-bold tracking-[0.3em] text-white">{room.code}</p>
          <button
            type="button"
            onClick={copyCode}
            className="mt-2 text-sm text-violet-300 underline underline-offset-2"
          >
            방 코드 복사
          </button>
          {copyMessage && (
            <p className="mt-2 rounded-xl bg-green-500/20 px-3 py-2 text-sm text-green-200">
              {copyMessage}
            </p>
          )}
          <p className="mt-4 text-2xl font-bold tracking-widest text-violet-300">
            {formatChosung(room.chosung)}
          </p>
          <p className="mt-2 text-sm text-violet-300">
            {isHost ? '2인 전용 · 링크를 공유하세요' : '방장이 게임을 시작할 때까지 기다려주세요'}
          </p>

          {isHost && opponentJoined && (
            <div className="mt-6 space-y-3 text-left">
              <p className="text-center text-sm text-violet-200">누가 먼저 시작할까요?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFirstTurn('A')}
                  className={`flex-1 rounded-xl py-2 text-sm ${
                    firstTurn === 'A' ? 'bg-violet-500 text-white' : 'bg-white/10 text-violet-200'
                  }`}
                >
                  내가 먼저
                </button>
                <button
                  type="button"
                  onClick={() => setFirstTurn('B')}
                  className={`flex-1 rounded-xl py-2 text-sm ${
                    firstTurn === 'B' ? 'bg-violet-500 text-white' : 'bg-white/10 text-violet-200'
                  }`}
                >
                  {room.player_b} 먼저
                </button>
              </div>
              <p className="text-center text-xs text-violet-400">
                기본값: 방 만든 사람(입장 순서 1번)이 먼저
              </p>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
          )}

          {isHost && (
            <>
              {shareMessage && (
                <p className="mt-4 rounded-xl bg-green-500/20 px-3 py-2 text-sm text-green-200">
                  {shareMessage}
                </p>
              )}
              <button
                onClick={shareInvite}
                className="mt-6 w-full rounded-2xl bg-violet-500 py-4 font-semibold text-white active:scale-[0.98]"
              >
                {opponentJoined ? '링크 다시 공유하기' : '코드 공유하기'}
              </button>
              {opponentJoined && (
                <button
                  onClick={handleStartGame}
                  disabled={starting}
                  className="mt-3 w-full rounded-2xl border border-violet-300/50 bg-violet-500/20 py-4 font-semibold text-white disabled:opacity-50"
                >
                  {starting ? '시작 중...' : '게임 시작'}
                </button>
              )}
            </>
          )}

          <p className="mt-3 text-xs text-violet-400">
            링크를 내면 상대방이 방 코드를 자동으로 입력해요
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
          {answers.length > 0 && (
            <p className="mt-1 text-xs text-violet-400">지금까지 {answers.length}개 단어</p>
          )}
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
                    {answer.definition && (
                      <p className="mt-0.5 text-xs leading-snug opacity-75">{answer.definition}</p>
                    )}
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
              ref={inputRef}
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

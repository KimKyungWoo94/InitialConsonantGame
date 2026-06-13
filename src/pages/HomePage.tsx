import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChosungPicker, validateCustomChosung } from '../components/ChosungPicker';
import { createRoom, joinRoom } from '../hooks/useRoom';
import { getPlayerId, saveSession } from '../utils/session';
import { InstallPrompt } from '../components/InstallPrompt';
import { formatChosung, type ChosungLength } from '../utils/chosung';

type ChosungMode = 'random' | 'custom';

export function HomePage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [chosungMode, setChosungMode] = useState<ChosungMode>('random');
  const [customChosung, setCustomChosung] = useState('');
  const [chosungLength, setChosungLength] = useState<ChosungLength>(2);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    let chosung: string | undefined;
    if (chosungMode === 'custom') {
      const validation = validateCustomChosung(customChosung, chosungLength);
      if (!validation.ok) {
        setError(validation.reason);
        return;
      }
      chosung = validation.value;
    }

    setLoading(true);
    setError('');

    try {
      const playerId = getPlayerId();
      const room = await createRoom(playerName.trim(), playerId, chosung);
      saveSession({
        roomId: room.id,
        player: 'A',
        playerName: playerName.trim(),
        playerId,
      });
      navigate(`/game/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '방 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    if (!roomCode.trim()) {
      setError('방 코드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const playerId = getPlayerId();
      const room = await joinRoom(roomCode.trim(), playerName.trim(), playerId);
      saveSession({
        roomId: room.id,
        player: 'B',
        playerName: playerName.trim(),
        playerId,
      });
      navigate(`/game/${room.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '방 입장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md flex-1">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">초성 게임</h1>
          <p className="mt-2 text-violet-200">같은 초성으로 단어를 번갈아 대세요!</p>
        </header>

        <InstallPrompt />

        {mode === 'menu' && (
          <div className="space-y-3">
            <button
              onClick={() => { setMode('create'); setError(''); }}
              className="w-full rounded-2xl bg-violet-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-violet-900/40 active:scale-[0.98]"
            >
              방 만들기
            </button>
            <button
              onClick={() => { setMode('join'); setError(''); }}
              className="w-full rounded-2xl border border-violet-400/40 bg-white/10 px-6 py-4 text-lg font-semibold text-white backdrop-blur active:scale-[0.98]"
            >
              방 입장하기
            </button>
          </div>
        )}

        {(mode === 'create' || mode === 'join') && (
          <div className="space-y-4 rounded-3xl bg-white/10 p-5 backdrop-blur">
            <div>
              <label className="mb-1 block text-sm text-violet-200">닉네임</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="이름 입력"
                maxLength={12}
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-violet-300/60 outline-none focus:border-violet-300"
              />
            </div>

            {mode === 'create' && (
              <div className="space-y-3">
                <label className="block text-sm text-violet-200">초성 설정</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChosungMode('random')}
                    className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                      chosungMode === 'random'
                        ? 'bg-violet-500 text-white'
                        : 'bg-white/10 text-violet-200'
                    }`}
                  >
                    랜덤
                  </button>
                  <button
                    type="button"
                    onClick={() => setChosungMode('custom')}
                    className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                      chosungMode === 'custom'
                        ? 'bg-violet-500 text-white'
                        : 'bg-white/10 text-violet-200'
                    }`}
                  >
                    직접 입력
                  </button>
                </div>

                {chosungMode === 'custom' && (
                  <ChosungPicker
                    value={customChosung}
                    length={chosungLength}
                    onChange={setCustomChosung}
                    onLengthChange={setChosungLength}
                  />
                )}
              </div>
            )}

            {mode === 'join' && (
              <div>
                <label className="mb-1 block text-sm text-violet-200">방 코드</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="예: AB12"
                  maxLength={4}
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-2xl font-bold tracking-widest text-white placeholder:text-violet-300/60 outline-none focus:border-violet-300"
                />
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
            )}

            <button
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={loading}
              className="w-full rounded-2xl bg-violet-500 px-6 py-4 text-lg font-semibold text-white disabled:opacity-50"
            >
              {loading ? '처리 중...' : mode === 'create' ? '방 만들기' : '입장하기'}
            </button>

            <button
              onClick={() => { setMode('menu'); setError(''); }}
              className="w-full py-2 text-sm text-violet-300"
            >
              ← 돌아가기
            </button>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-white/5 p-4 text-sm text-violet-200">
          <p className="font-medium text-white">게임 방법</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>랜덤 또는 직접 입력 초성 (예: {formatChosung('ㅅㄹ')})</li>
            <li>같은 초성 단어를 번갈아 입력</li>
            <li>중복·없는 단어는 다시 입력</li>
            <li>포기하면 패배!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

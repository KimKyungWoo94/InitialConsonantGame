export function InstallPrompt() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);

  if (!isIOS || isStandalone) return null;

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-violet-400/30 bg-violet-950/60 p-4 text-sm leading-relaxed text-violet-100">
      <p className="mb-2 font-semibold text-white">📱 홈 화면에 추가하기</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li>Safari 하단 <strong>공유(↑)</strong> 버튼 탭</li>
        <li><strong>홈 화면에 추가</strong> 선택</li>
        <li><strong>추가</strong> 탭</li>
      </ol>
    </div>
  );
}

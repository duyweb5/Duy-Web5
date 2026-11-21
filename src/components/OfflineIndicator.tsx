import { WifiOff } from 'lucide-react';
import { Language } from '../data/bostonData';
import { useOnlineStatus } from '../hooks/usePWAInstall';

interface OfflineIndicatorProps {
  lang: Language;
}

export function OfflineIndicator({ lang }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  const isVi = lang === 'vi';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-white/15 bg-[#0A2239] px-4 py-3 text-white shadow-xl sm:left-5 sm:right-auto sm:mx-0"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C8102E] text-white">
        <WifiOff className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 text-xs leading-relaxed">
        <p className="font-semibold text-white">
          {isVi ? 'Đang ở chế độ ngoại tuyến (Offline)' : 'You are currently offline'}
        </p>
        <p className="text-white/75">
          {isVi
            ? 'Lịch trình Boston bạn đã lưu vẫn có thể xem lại bất cứ lúc nào.'
            : 'Your saved Boston 3-day itinerary remains available offline.'}
        </p>
      </div>
    </div>
  );
}

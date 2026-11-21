import { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { Language } from '../data/bostonData';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  lang: Language;
  variant?: 'navbar' | 'footer';
}

export function PWAInstallButton({
  lang,
  variant = 'navbar',
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || (!isInstallable && !isIOS)) {
    return null;
  }

  const isVi = lang === 'vi';

  const handleClick = async () => {
    if (isIOS && !isInstallable) {
      setShowIOSGuide(true);
      return;
    }
    await promptInstall();
  };

  const buttonClass =
    variant === 'footer'
      ? 'inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 whitespace-nowrap shrink-0'
      : 'inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 text-xs font-semibold text-[#0A2239] transition-colors hover:border-[#0A2239]/30 hover:bg-[#F7F8FA] focus-visible:outline-2 focus-visible:outline-[#C8102E] whitespace-nowrap shrink-0';

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label={isVi ? 'Cài ứng dụng Meet Boston' : 'Install Meet Boston app'}
        title={isVi ? 'Cài ứng dụng lên màn hình chính' : 'Install app to home screen'}
        className={buttonClass}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className={variant === 'navbar' ? 'hidden sm:inline' : 'inline'}>
          {isVi ? 'Cài ứng dụng' : 'Install App'}
        </span>
      </button>

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-pwa-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A2239]/60 p-4 backdrop-blur-xs"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-xl border border-[#E3E7EE] bg-white p-6 text-[#0F1B2B] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              aria-label={isVi ? 'Đóng' : 'Close'}
              className="absolute right-3.5 top-3.5 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2.5 text-[#0A2239]">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A2239] text-white">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
              </div>
              <h3 id="ios-pwa-title" className="font-display text-base font-bold">
                {isVi ? 'Cài Meet Boston trên iPhone / iPad' : 'Install Meet Boston on iOS'}
              </h3>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#526071]">
              {isVi
                ? 'Thêm Meet Boston vào màn hình chính để mở nhanh như ứng dụng và xem lại lịch trình Boston cả khi không có mạng:'
                : 'Add Meet Boston to your Home Screen for instant launch and offline access to your saved Boston itinerary:'}
            </p>

            <ol className="mt-4 space-y-3 text-sm text-[#0F1B2B]">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A2239]/10 font-mono text-xs font-bold text-[#0A2239]">
                  1
                </span>
                <span className="leading-snug">
                  {isVi ? 'Nhấn biểu tượng ' : 'Tap the '}
                  <Share className="mx-0.5 inline h-4 w-4 text-[#0A2239]" aria-hidden="true" />
                  <strong>{isVi ? ' Chia sẻ (Share)' : ' Share'}</strong>
                  {isVi ? ' ở thanh công cụ Safari.' : ' icon in the Safari toolbar.'}
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A2239]/10 font-mono text-xs font-bold text-[#0A2239]">
                  2
                </span>
                <span className="leading-snug">
                  {isVi ? 'Cuộn xuống và chọn ' : 'Scroll down and tap '}
                  <PlusSquare className="mx-0.5 inline h-4 w-4 text-[#0A2239]" aria-hidden="true" />
                  <strong>
                    {isVi ? ' Thêm vào MH chính' : ' Add to Home Screen'}
                  </strong>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A2239]/10 font-mono text-xs font-bold text-[#0A2239]">
                  3
                </span>
                <span className="leading-snug">
                  {isVi ? 'Nhấn ' : 'Tap '}
                  <strong>{isVi ? 'Thêm (Add)' : 'Add'}</strong>
                  {isVi ? ' ở góc trên bên phải để hoàn tất.' : ' in the top-right corner.'}
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-lg bg-[#0A2239] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#133454]"
            >
              {isVi ? 'Đã hiểu' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

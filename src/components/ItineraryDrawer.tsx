import { useEffect, useState } from 'react';
import {
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MapPin,
  Printer,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { Language, SavedItineraryItem } from '../data/bostonData';
import { useSiteCopy } from '../lib/I18nContext';
import {
  buildGoogleMapsDayRouteUrl,
  createSharedItinerary,
  downloadItineraryIcs,
  printItineraryPdf,
} from '../lib/itineraryService';
import { ResilientImage } from './ResilientImage';

interface ItineraryDrawerProps {
  lang: Language;
  open: boolean;
  items: SavedItineraryItem[];
  onClose: () => void;
  onChangeDay: (id: string, day: 1 | 2 | 3) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onLoadStarter: () => void;
}

export function ItineraryDrawer({
  lang,
  open,
  items,
  onClose,
  onChangeDay,
  onRemoveItem,
  onClearAll,
  onLoadStarter,
}: ItineraryDrawerProps) {
  const isVi = lang === 'vi';
  const siteCopy = useSiteCopy(lang);
  const t = siteCopy.drawer;
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState('');

  // Reset generated share link whenever the itinerary items change
  useEffect(() => {
    setShareUrl('');
    setShareCopied(false);
    setShareError('');
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const days: (1 | 2 | 3)[] = [1, 2, 3];

  const handleCopy = async () => {
    const lines: string[] = [
      isVi ? 'LỊCH TRÌNH DU LỊCH BOSTON (MEET BOSTON)' : 'MY BOSTON ITINERARY (MEET BOSTON)',
      '',
    ];
    for (const day of days) {
      const dayItems = items.filter((i) => i.day === day);
      if (dayItems.length === 0) continue;
      lines.push(`${t.dayPrefix} ${day}:`);
      for (const item of dayItems) {
        lines.push(`- ${item.title[lang]} (${item.district})`);
      }
      lines.push('');
    }
    if (shareUrl) {
      lines.push(`${isVi ? 'Link chia sẻ' : 'Share link'}: ${shareUrl}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleCreateShareLink = async () => {
    if (!items.length || sharing) return;
    setSharing(true);
    setShareError('');
    try {
      const res = await createSharedItinerary({ items, lang });
      setShareUrl(res.shareUrl);
      try {
        await navigator.clipboard.writeText(res.shareUrl);
        setShareCopied(true);
        window.setTimeout(() => setShareCopied(false), 2600);
      } catch {
        // Still display the link for manual copy
      }
    } catch {
      setShareError(
        isVi
          ? 'Không thể tạo liên kết chia sẻ lúc này. Vui lòng thử lại.'
          : 'Could not generate a share link right now. Please try again.'
      );
    } finally {
      setSharing(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2200);
    } catch {
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2200);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="itinerary-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-[#071727]/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E3E7EE] px-6 py-5">
          <div>
            <h2
              id="itinerary-drawer-title"
              className="font-display text-xl font-extrabold text-[#0A2239]"
            >
              {t.title}
            </h2>
            <p className="mt-1 text-xs text-[#526071]">
              {items.length > 0
                ? `${items.length} ${t.itemsCount}`
                : t.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={siteCopy.modal.close}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#0F1B2B] hover:bg-[#F7F8FA]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {items.length === 0 ? (
            <div className="rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-6 text-center">
              <p className="font-display text-base font-bold text-[#0A2239]">
                {t.emptyTitle}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#526071]">
                {t.emptyDesc}
              </p>
              <button
                type="button"
                onClick={onLoadStarter}
                className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#C8102E] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A10C24]"
              >
                {t.loadStarter}
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {days.map((day) => {
                const dayItems = items.filter((item) => item.day === day);
                if (dayItems.length === 0) return null;
                const mapsRouteUrl = buildGoogleMapsDayRouteUrl(dayItems, lang);

                return (
                  <div key={day}>
                    <div className="flex items-center justify-between gap-2 border-b border-[#E3E7EE] pb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-sm font-bold text-[#0A2239]">
                          {t.dayPrefix} {day}
                        </h3>
                        <span className="font-mono text-xs text-[#526071] tabular-nums">
                          ({dayItems.length})
                        </span>
                      </div>

                      <a
                        href={mapsRouteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-[#E3E7EE] bg-[#F7F8FA] px-2.5 py-1 text-[11px] font-semibold text-[#0A2239] transition-colors hover:border-[#C8102E] hover:text-[#C8102E]"
                      >
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        <span>{isVi ? 'Lộ trình Maps' : 'Maps Route'}</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-70" aria-hidden="true" />
                      </a>
                    </div>

                    <ul className="mt-3 space-y-3">
                      {dayItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex gap-3 rounded-lg border border-[#E3E7EE] p-3"
                        >
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[#0A2239]">
                            <ResilientImage
                              src={item.image}
                              alt={item.title[lang]}
                              fallbackTitle={item.title[lang]}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-sm font-bold text-[#0A2239]">
                              {item.title[lang]}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[#526071]">
                              {item.district} · {item.subtitle[lang]}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1">
                                {days.map((d) => (
                                  <button
                                    key={d}
                                    type="button"
                                    onClick={() => onChangeDay(item.id, d)}
                                    className={`min-h-[28px] rounded px-2 text-xs font-semibold tabular-nums transition-colors ${
                                      item.day === d
                                        ? 'bg-[#0A2239] text-white'
                                        : 'bg-[#F7F8FA] text-[#526071] hover:text-[#0A2239]'
                                    }`}
                                  >
                                    D{d}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => onRemoveItem(item.id)}
                                aria-label={`${t.remove} ${item.title[lang]}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] transition-colors hover:bg-red-50 hover:text-[#C8102E]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {/* Generated Shareable Link Box */}
              {shareUrl && (
                <div className="rounded-xl border border-emerald-700/20 bg-emerald-50 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {isVi ? 'Đã tạo link chia sẻ công khai' : 'Shareable trip link ready'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyShareUrl}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800"
                    >
                      {shareCopied ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span>{shareCopied ? (isVi ? 'Đã chép' : 'Copied') : isVi ? 'Chép link' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="mt-1.5 break-all font-mono text-[11px] text-emerald-950">
                    {shareUrl}
                  </p>
                </div>
              )}

              {shareError && (
                <p role="alert" className="text-xs font-semibold text-[#C8102E]">
                  {shareError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {items.length > 0 && (
          <div className="space-y-2.5 border-t border-[#E3E7EE] bg-[#F7F8FA] px-6 py-4">
            {/* Primary Share + Copy Row */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateShareLink}
                disabled={sharing}
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#C8102E] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#A10C24] disabled:opacity-60 whitespace-nowrap"
              >
                {sharing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {sharing
                    ? isVi
                      ? 'Đang tạo link...'
                      : 'Creating link...'
                    : isVi
                      ? 'Tạo link chia sẻ'
                      : 'Share Trip Link'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg bg-[#0A2239] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#133454] whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{copied ? t.copiedBtn : isVi ? 'Chép chữ' : 'Copy Text'}</span>
              </button>
            </div>

            {/* Secondary Export Row: PDF, .ics Calendar, Clear */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => printItineraryPdf(items, lang, shareUrl || undefined)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#D4DBE5] bg-white px-2.5 py-1 text-xs font-semibold text-[#0A2239] hover:border-[#0A2239]"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isVi ? 'In / PDF' : 'Print / PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => downloadItineraryIcs(items, lang)}
                  className="inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#D4DBE5] bg-white px-2.5 py-1 text-xs font-semibold text-[#0A2239] hover:border-[#0A2239]"
                >
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{isVi ? 'Lịch .ics' : '.ics Calendar'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClearAll}
                className="min-h-[34px] px-2 text-xs font-semibold text-[#526071] transition-colors hover:text-[#C8102E]"
              >
                {t.clearAll}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

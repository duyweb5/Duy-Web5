import { useEffect, useState } from 'react';
import { Check, Copy, Trash2, X } from 'lucide-react';
import { COPY, Language, SavedItineraryItem } from '../data/bostonData';
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
  const t = COPY[lang].drawer;
  const [copied, setCopied] = useState(false);

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
      lang === 'vi' ? 'LỊCH TRÌNH DU LỊCH BOSTON (MEET BOSTON)' : 'MY BOSTON ITINERARY (MEET BOSTON)',
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
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
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
            aria-label={COPY[lang].modal.close}
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
                return (
                  <div key={day}>
                    <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-2">
                      <h3 className="font-display text-sm font-bold text-[#0A2239]">
                        {t.dayPrefix} {day}
                      </h3>
                      <span className="font-mono text-xs text-[#526071] tabular-nums">
                        {dayItems.length}
                      </span>
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
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {items.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-[#E3E7EE] bg-[#F7F8FA] px-6 py-4">
            <button
              type="button"
              onClick={onClearAll}
              className="min-h-[40px] px-2 text-xs font-semibold text-[#526071] transition-colors hover:text-[#C8102E]"
            >
              {t.clearAll}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0A2239] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#133454] whitespace-nowrap shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{copied ? t.copiedBtn : t.copyBtn}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { Bookmark, Check, X } from 'lucide-react';
import {
  EventItem,
  ExperienceItem,
  HotelItem,
  Language,
} from '../data/bostonData';
import { useSiteCopy } from '../lib/I18nContext';
import { ResilientImage } from './ResilientImage';

export type DetailModalTarget =
  | { kind: 'experience'; item: ExperienceItem }
  | { kind: 'event'; item: EventItem }
  | { kind: 'hotel'; item: HotelItem }
  | null;

interface DetailModalProps {
  lang: Language;
  target: DetailModalTarget;
  isSaved: boolean;
  onClose: () => void;
  onToggleSave: () => void;
}

export function DetailModal({
  lang,
  target,
  isSaved,
  onClose,
  onToggleSave,
}: DetailModalProps) {
  const t = useSiteCopy(lang).modal;

  useEffect(() => {
    if (!target) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [target, onClose]);

  if (!target) return null;

  const title =
    target.kind === 'hotel' ? target.item.name : target.item.title[lang];
  const image = target.item.image;
  const district = target.item.district;
  const description = target.item.description[lang];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/70 p-4 backdrop-blur-xs sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0A2239]">
          <ResilientImage
            src={image}
            alt={title}
            fallbackTitle={title}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A2239]/80 text-white transition-colors hover:bg-[#0A2239]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold text-[#C8102E]">{district}</p>
          <h3
            id="detail-modal-title"
            className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-[#0A2239]"
          >
            {title}
          </h3>

          <p className="mt-4 text-sm leading-relaxed text-[#526071] sm:text-base">
            {description}
          </p>

          {/* Practical Information Grid */}
          <dl className="mt-6 grid grid-cols-1 gap-4 border-y border-[#E3E7EE] py-5 sm:grid-cols-2">
            {target.kind === 'experience' && (
              <>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.address}</dt>
                  <dd className="mt-1 text-sm font-medium text-[#0F1B2B]">
                    {target.item.address}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.hours}</dt>
                  <dd className="mt-1 font-mono text-sm font-medium text-[#0F1B2B] tabular-nums">
                    {target.item.hours}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.price}</dt>
                  <dd className="mt-1 text-sm font-medium text-[#0F1B2B]">
                    {target.item.price[lang]}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.transit}</dt>
                  <dd className="mt-1 text-sm font-medium text-[#0F1B2B]">
                    {target.item.transit}
                  </dd>
                </div>
              </>
            )}

            {target.kind === 'event' && (
              <>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.address}</dt>
                  <dd className="mt-1 text-sm font-medium text-[#0F1B2B]">
                    {target.item.venue}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.hours}</dt>
                  <dd className="mt-1 font-mono text-sm font-medium text-[#0F1B2B] tabular-nums">
                    {target.item.fullDate[lang]} · {target.item.time}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.price}</dt>
                  <dd className="mt-1 text-sm font-medium text-[#0F1B2B]">
                    {target.item.price[lang]}
                  </dd>
                </div>
              </>
            )}

            {target.kind === 'hotel' && (
              <>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.address}</dt>
                  <dd className="mt-1 text-sm font-medium text-[#0F1B2B]">
                    {target.item.address}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-[#526071]">{t.price}</dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-[#0F1B2B] tabular-nums">
                    ${target.item.rateUsd} / {lang === 'vi' ? 'đêm' : 'night'} · ★ {target.item.rating}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-[#526071]">
                    {lang === 'vi' ? 'Tiện nghi nổi bật' : 'Key Amenities'}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[#0F1B2B]">
                    {target.item.amenities[lang].join(' · ')}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {target.kind === 'experience' && (
            <div className="mt-5 rounded-lg bg-[#F7F8FA] p-4">
              <p className="text-xs font-bold text-[#0A2239]">{t.insiderTip}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#526071]">
                {target.item.insiderTip[lang]}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[42px] items-center rounded-lg border border-[#E3E7EE] px-4 py-2 text-sm font-semibold text-[#0F1B2B] transition-colors hover:bg-[#F7F8FA]"
            >
              {t.close}
            </button>
            <button
              type="button"
              onClick={onToggleSave}
              className={`inline-flex min-h-[42px] items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
                isSaved
                  ? 'bg-[#0A2239] text-white hover:bg-[#133454]'
                  : 'bg-[#C8102E] text-white hover:bg-[#A10C24]'
              }`}
            >
              {isSaved ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Bookmark className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{isSaved ? t.removeFromTrip : t.addToTrip}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

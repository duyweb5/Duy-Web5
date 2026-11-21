import { Check, Download, Map, X } from 'lucide-react';
import { Language } from '../data/bostonData';
import { SharedItineraryRecord } from '../lib/itineraryService';

interface SharedTripBannerProps {
  lang: Language;
  trip: SharedItineraryRecord;
  imported: boolean;
  onImportTrip: () => void;
  onOpenDrawer: () => void;
  onDismiss: () => void;
}

export function SharedTripBanner({
  lang,
  trip,
  imported,
  onImportTrip,
  onOpenDrawer,
  onDismiss,
}: SharedTripBannerProps) {
  const isVi = lang === 'vi';
  const dayCount = new Set(trip.items.map((i) => i.day)).size;

  return (
    <div className="border-b border-[#0A2239]/15 bg-[#0A2239] text-white">
      <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center lg:px-8">
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C8102E] text-white">
            <Map className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#FF8A9B]">
              {isVi ? 'Lịch trình Boston được chia sẻ' : 'Shared Boston Itinerary'}
            </p>
            <h2 className="mt-0.5 font-display text-base font-bold text-white sm:text-lg">
              {trip.title}
            </h2>
            <p className="mt-0.5 text-xs text-white/80">
              {isVi
                ? `${trip.items.length} điểm dừng · ${dayCount} ngày khám phá — bạn có thể lưu vào lịch trình cá nhân để chỉnh sửa, mở Google Maps hoặc tải PDF.`
                : `${trip.items.length} stops across ${dayCount} days — import a copy to customize, open Google Maps routes, or export PDF.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onImportTrip}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              imported
                ? 'bg-emerald-600 text-white'
                : 'bg-[#C8102E] text-white hover:bg-[#A10C24]'
            }`}
          >
            {imported ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {imported
                ? isVi
                  ? 'Đã lưu vào lịch trình của bạn'
                  : 'Imported to My Trip'
                : isVi
                  ? 'Lưu vào lịch trình của tôi'
                  : 'Import to My Trip'}
            </span>
          </button>

          {imported && (
            <button
              type="button"
              onClick={onOpenDrawer}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              {isVi ? 'Mở lịch trình' : 'Open Trip'}
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            aria-label={isVi ? 'Đóng thông báo' : 'Dismiss banner'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

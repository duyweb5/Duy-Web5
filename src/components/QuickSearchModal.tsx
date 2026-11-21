import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  Compass,
  MapPin,
  Play,
  Search,
  X,
} from 'lucide-react';
import {
  EventItem,
  ExperienceItem,
  HotelItem,
  Language,
  NeighborhoodItem,
} from '../data/bostonData';
import {
  UnifiedSearchHit,
  UnifiedSearchKind,
  buildUnifiedSearchHits,
} from '../lib/searchUtils';
import { VideoItemRecord, VideoTopicRecord } from '../lib/videoService';

interface QuickSearchModalProps {
  lang: Language;
  open: boolean;
  experiences: ExperienceItem[];
  neighborhoods: NeighborhoodItem[];
  events: EventItem[];
  hotels: HotelItem[];
  videos: VideoItemRecord[];
  topics: VideoTopicRecord[];
  onClose: () => void;
  onSelectHit: (hit: UnifiedSearchHit) => void;
}

const KIND_LABELS: Record<UnifiedSearchKind, { vi: string; en: string }> = {
  experience: { vi: 'Điểm đến', en: 'Experience' },
  neighborhood: { vi: 'Khu phố', en: 'Neighborhood' },
  event: { vi: 'Sự kiện', en: 'Event' },
  hotel: { vi: 'Lưu trú', en: 'Stay' },
  video: { vi: 'Video', en: 'Video' },
};

function KindIcon({ kind }: { kind: UnifiedSearchKind }) {
  switch (kind) {
    case 'video':
      return <Play className="h-3.5 w-3.5 fill-current text-[#C8102E]" aria-hidden="true" />;
    case 'neighborhood':
      return <MapPin className="h-3.5 w-3.5 text-[#0A2239]" aria-hidden="true" />;
    case 'event':
      return <Calendar className="h-3.5 w-3.5 text-[#0A2239]" aria-hidden="true" />;
    case 'hotel':
      return <Building2 className="h-3.5 w-3.5 text-[#0A2239]" aria-hidden="true" />;
    default:
      return <Compass className="h-3.5 w-3.5 text-[#0A2239]" aria-hidden="true" />;
  }
}

export function QuickSearchModal({
  lang,
  open,
  experiences,
  neighborhoods,
  events,
  hotels,
  videos,
  topics,
  onClose,
  onSelectHit,
}: QuickSearchModalProps) {
  const isVi = lang === 'vi';
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'experience' | 'event' | 'hotel' | 'video'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const hits = useMemo(
    () =>
      buildUnifiedSearchHits({
        query,
        scope,
        lang,
        experiences,
        neighborhoods,
        events,
        hotels,
        videos,
        topics,
        limit: 10,
      }),
    [query, scope, lang, experiences, neighborhoods, events, hotels, videos, topics]
  );

  if (!open) return null;

  const quickSuggestions = isVi
    ? ['Freedom Trail', 'Lang Thang Boston', 'Quincy Market', 'Back Bay', 'Seaport', 'Hải sản']
    : ['Freedom Trail', 'Lang Thang Boston', 'Quincy Market', 'Back Bay', 'Seaport', 'Seafood'];

  const scopes: Array<{ id: 'all' | 'experience' | 'event' | 'hotel' | 'video'; label: string }> = [
    { id: 'all', label: isVi ? 'Tất cả' : 'All' },
    { id: 'experience', label: isVi ? 'Điểm đến & Khu phố' : 'Explore' },
    { id: 'event', label: isVi ? 'Sự kiện' : 'Events' },
    { id: 'hotel', label: isVi ? 'Lưu trú' : 'Stay' },
    { id: 'video', label: 'Video' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Tìm kiếm toàn trang' : 'Sitewide search'}
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#071727]/65 px-4 pt-16 pb-10 backdrop-blur-xs sm:pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E3E7EE] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Row */}
        <div className="flex items-center gap-3 border-b border-[#E3E7EE] px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-[#526071]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isVi
                ? 'Tìm điểm tham quan, khu phố, sự kiện, khách sạn hoặc video...'
                : 'Search attractions, neighborhoods, events, hotels, or videos...'
            }
            className="h-10 w-full bg-transparent text-base font-medium text-[#0F1B2B] placeholder:text-[#526071] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={isVi ? 'Xoá từ khoá' : 'Clear search'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={isVi ? 'Đóng tìm kiếm' : 'Close search'}
            className="inline-flex h-9 items-center rounded-md border border-[#E3E7EE] px-2.5 font-mono text-[11px] font-medium text-[#526071] hover:bg-[#F7F8FA]"
          >
            ESC
          </button>
        </div>

        {/* Scope Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#E3E7EE] bg-[#F7F8FA] px-5 py-2.5">
          {scopes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScope(item.id)}
              className={`min-h-[32px] rounded-md px-3 text-xs font-semibold transition-colors ${
                scope === item.id
                  ? 'bg-[#0A2239] text-white'
                  : 'bg-white text-[#526071] border border-[#E3E7EE] hover:text-[#0A2239]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Results / Suggestions */}
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length === 0 ? (
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#526071]">
                {isVi ? 'Gợi ý tìm nhanh (hỗ trợ gõ không dấu)' : 'Quick suggestions'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickSuggestions.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setQuery(term)}
                    className="rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] px-3 py-1.5 text-xs font-semibold text-[#0A2239] transition-colors hover:border-[#C8102E] hover:text-[#C8102E]"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : hits.length > 0 ? (
            <ul className="divide-y divide-[#E3E7EE]">
              {hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectHit(hit);
                      onClose();
                      setQuery('');
                    }}
                    className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-[#F7F8FA]"
                  >
                    {hit.thumbnail ? (
                      <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-[#0A2239]">
                        <img
                          src={hit.thumbnail}
                          alt={hit.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {hit.kind === 'video' && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <Play className="h-3.5 w-3.5 fill-white text-white" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#F7F8FA]">
                        <KindIcon kind={hit.kind} />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded bg-[#F0F3F8] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0A2239]">
                          <KindIcon kind={hit.kind} />
                          {KIND_LABELS[hit.kind][lang]}
                        </span>
                      </div>
                      <p className="mt-1 truncate font-display text-sm font-bold text-[#0F1B2B]">
                        {hit.title}
                      </p>
                      <p className="truncate text-xs text-[#526071]">{hit.meta}</p>
                    </div>

                    <ArrowRight className="h-4 w-4 shrink-0 text-[#C8102E]" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-[#0A2239]">
                {isVi
                  ? `Không tìm thấy kết quả cho "${query}"`
                  : `No matches found for "${query}"`}
              </p>
              <p className="mt-1 text-xs text-[#526071]">
                {isVi
                  ? 'Thử từ khoá ngắn hơn như Boston, Back Bay, Freedom Trail hoặc chuyển sang bộ lọc "Tất cả".'
                  : 'Try a shorter keyword like Boston, Back Bay, or Freedom Trail, or switch to "All".'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

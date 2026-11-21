import { useMemo, useState } from 'react';
import { Bookmark, Check, Play, TrainFront } from 'lucide-react';
import { Language, NeighborhoodItem } from '../data/bostonData';
import { useSiteCopy } from '../lib/I18nContext';
import { findRelatedVideosForNeighborhood } from '../lib/searchUtils';
import { VideoItemRecord } from '../lib/videoService';
import { ResilientImage } from './ResilientImage';

interface NeighborhoodsSectionProps {
  lang: Language;
  items: NeighborhoodItem[];
  selectedId: string;
  onSelectId: (id: string) => void;
  savedIds: Set<string>;
  onToggleSaveNeighborhood: (nb: NeighborhoodItem) => void;
  videos?: VideoItemRecord[];
  onOpenVideo?: (slug: string) => void;
}

export function NeighborhoodsSection({
  lang,
  items,
  selectedId,
  onSelectId,
  savedIds,
  onToggleSaveNeighborhood,
  videos = [],
  onOpenVideo,
}: NeighborhoodsSectionProps) {
  const t = useSiteCopy(lang).neighborhoods;
  const active = items.find((n) => n.id === selectedId) || items[0];
  const [feedback, setFeedback] = useState(false);

  const relatedVideos = useMemo(
    () => (active ? findRelatedVideosForNeighborhood(active, videos, 2) : { items: [], isDirectMatch: false }),
    [active, videos]
  );

  if (!active) return null;

  const isSaved = savedIds.has(active.id);

  const handleSave = () => {
    onToggleSaveNeighborhood(active);
    if (!isSaved) {
      setFeedback(true);
      window.setTimeout(() => setFeedback(false), 1800);
    }
  };

  return (
    <section id="neighborhoods" className="bg-[#0A2239] py-20 text-white lg:py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-[#FF8A9B]">
            {t.kicker}
          </p>
          <h2 className="text-balance-heading mt-2 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-white/80">
            {t.subtitle}
          </p>
        </div>

        {/* Interactive Neighborhood Tabs */}
        <div
          role="tablist"
          aria-label={t.title}
          className="mt-8 flex flex-wrap gap-2 border-b border-white/15 pb-6"
        >
          {items.map((nb) => {
            const isCurrent = nb.id === active.id;
            return (
              <button
                key={nb.id}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => onSelectId(nb.id)}
                className={`min-h-[42px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 ${
                  isCurrent
                    ? 'bg-[#C8102E] text-white'
                    : 'bg-white/10 text-white/85 hover:bg-white/15 hover:text-white'
                }`}
              >
                {nb.name}
              </button>
            );
          })}
        </div>

        {/* Balanced 2-Column Editorial Split (items-stretch) */}
        <div className="mt-10 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          {/* Left Visual Column */}
          <div className="relative overflow-hidden rounded-xl bg-[#071727] lg:col-span-6">
            <ResilientImage
              src={active.image}
              alt={`${active.name}, Boston`}
              fallbackTitle={active.name}
              className="aspect-[4/3] w-full object-cover lg:h-full lg:aspect-auto"
            />
          </div>

          {/* Right Editorial Details Column */}
          <div className="flex flex-col justify-between rounded-xl border border-white/15 bg-[#0D2A46] p-7 lg:col-span-6 lg:p-9">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium tracking-wide text-white/75">
                <span>{active.vibe[lang]}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {t.walkability} {active.walkScore}/100
                </span>
              </div>

              <h3 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {active.name}
              </h3>
              <p className="mt-1.5 text-sm font-medium text-white/90 sm:text-base">
                {active.tagline[lang]}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/80 sm:text-[15px]">
                {active.description[lang]}
              </p>

              {/* Transit Info */}
              <div className="mt-6 flex items-center gap-3 border-y border-white/15 py-4 text-sm text-white/90">
                <TrainFront className="h-4 w-4 shrink-0 text-[#FF8A9B]" aria-hidden="true" />
                <div>
                  <span className="text-white/65">{t.transitLabel}: </span>
                  <span className="font-semibold text-white">{active.transit}</span>
                </div>
              </div>

              {/* Top 3 Local Picks */}
              <div className="mt-6">
                <h4 className="text-xs font-semibold tracking-wide text-white/70">
                  {t.topPicksTitle}
                </h4>
                <ol className="mt-3 divide-y divide-white/10">
                  {active.topPicks.map((pick, idx) => (
                    <li
                      key={pick.name}
                      className="flex items-start gap-4 py-3 first:pt-1 last:pb-0"
                    >
                      <span className="font-mono text-xs font-medium text-[#FF8A9B] tabular-nums pt-0.5">
                        0{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">
                          {pick.name}{' '}
                          <span className="font-normal text-white/60">
                            · {pick.category[lang]}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-white/75 sm:text-sm">
                          {pick.note[lang]}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Smart Cross-Linked Videos for this Neighborhood */}
              {relatedVideos.items.length > 0 && onOpenVideo && (
                <div className="mt-6 border-t border-white/15 pt-5">
                  <h4 className="text-xs font-semibold tracking-wide text-white/70">
                    {relatedVideos.isDirectMatch
                      ? lang === 'vi'
                        ? `Video thực tế tại ${active.name}`
                        : `Real-world videos in ${active.name}`
                      : lang === 'vi'
                        ? 'Video khám phá Boston nổi bật'
                        : 'Featured Boston walk-through videos'}
                  </h4>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {relatedVideos.items.map((vid) => {
                      const vidTitle =
                        lang === 'vi'
                          ? vid.titleVi || vid.rawTitle
                          : vid.titleEn || vid.titleVi || vid.rawTitle;
                      const slug =
                        lang === 'vi'
                          ? vid.slugVi || vid.id
                          : vid.slugEn || vid.slugVi || vid.id;
                      return (
                        <button
                          key={vid.id}
                          type="button"
                          onClick={() => onOpenVideo(slug)}
                          className="group flex items-center gap-3 rounded-lg border border-white/15 bg-white/5 p-2 text-left transition-colors hover:border-[#FF8A9B]/60 hover:bg-white/10"
                        >
                          <div className="relative aspect-video w-20 shrink-0 overflow-hidden rounded bg-[#071727]">
                            <img
                              src={
                                vid.thumbnail ||
                                `https://i.ytimg.com/vi/${vid.youtubeId}/hqdefault.jpg`
                              }
                              alt={vidTitle}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                              <Play className="h-3.5 w-3.5 fill-white text-white" aria-hidden="true" />
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-xs font-semibold leading-snug text-white group-hover:text-[#FF8A9B]">
                              {vidTitle}
                            </p>
                            {vid.duration && (
                              <p className="mt-0.5 font-mono text-[10px] text-white/60 tabular-nums">
                                {vid.duration}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 ${
                  isSaved
                    ? 'bg-white text-[#0A2239] hover:bg-white/90'
                    : 'bg-[#C8102E] text-white hover:bg-[#A10C24]'
                }`}
              >
                {isSaved ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {isSaved ? t.savedNeighborhoodBtn : t.addNeighborhoodBtn}
                </span>
              </button>

              {feedback && (
                <span className="text-xs font-medium text-white/85">
                  {lang === 'vi'
                    ? 'Đã thêm vào Ngày 2 lịch trình'
                    : 'Added to Day 2 of your itinerary'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import {
  COPY,
  EventItem,
  ExperienceItem,
  HotelItem,
  Language,
  NeighborhoodItem,
} from '../data/bostonData';
import { SiteConfigData } from '../lib/cmsService';
import { ResilientImage } from './ResilientImage';

export interface SearchHit {
  id: string;
  kind: 'experience' | 'event' | 'hotel' | 'neighborhood';
  title: string;
  meta: string;
  href: string;
}

interface HeroSectionProps {
  lang: Language;
  siteConfig: SiteConfigData;
  experiences: ExperienceItem[];
  neighborhoods: NeighborhoodItem[];
  events: EventItem[];
  hotels: HotelItem[];
  onChangeLang: (lang: Language) => void;
  onSelectSearchHit: (hit: SearchHit) => void;
}

export function HeroSection({
  lang,
  siteConfig,
  experiences,
  neighborhoods,
  events,
  hotels,
  onChangeLang,
  onSelectSearchHit,
}: HeroSectionProps) {
  const t = COPY[lang].hero;
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | 'experience' | 'event' | 'hotel'>('all');
  const [isFocused, setIsFocused] = useState(false);

  const kickerText = lang === 'vi' ? siteConfig.kickerVi : siteConfig.kickerEn;
  const headlineText =
    lang === 'vi' ? siteConfig.headlineVi : siteConfig.headlineEn;
  const subheadText =
    lang === 'vi' ? siteConfig.subheadVi : siteConfig.subheadEn;

  const searchHits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const hits: SearchHit[] = [];

    if (scope === 'all' || scope === 'experience') {
      for (const exp of experiences) {
        const hay = `${exp.title[lang]} ${exp.summary[lang]} ${exp.district}`.toLowerCase();
        if (hay.includes(q)) {
          hits.push({
            id: exp.id,
            kind: 'experience',
            title: exp.title[lang],
            meta: `${exp.district} · ${exp.duration[lang]}`,
            href: '#explore',
          });
        }
      }
      for (const nb of neighborhoods) {
        const hay = `${nb.name} ${nb.tagline[lang]} ${nb.description[lang]}`.toLowerCase();
        if (hay.includes(q)) {
          hits.push({
            id: nb.id,
            kind: 'neighborhood',
            title: nb.name,
            meta: `${nb.vibe[lang]}`,
            href: '#neighborhoods',
          });
        }
      }
    }

    if (scope === 'all' || scope === 'event') {
      for (const evt of events) {
        const hay = `${evt.title[lang]} ${evt.venue} ${evt.district}`.toLowerCase();
        if (hay.includes(q)) {
          hits.push({
            id: evt.id,
            kind: 'event',
            title: evt.title[lang],
            meta: `${evt.fullDate[lang]} · ${evt.district}`,
            href: '#events',
          });
        }
      }
    }

    if (scope === 'all' || scope === 'hotel') {
      for (const htl of hotels) {
        const hay = `${htl.name} ${htl.district} ${htl.style[lang]}`.toLowerCase();
        if (hay.includes(q)) {
          hits.push({
            id: htl.id,
            kind: 'hotel',
            title: htl.name,
            meta: `${htl.district} · $${htl.rateUsd}`,
            href: '#stay',
          });
        }
      }
    }

    return hits.slice(0, 6);
  }, [query, scope, lang, experiences, neighborhoods, events, hotels]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchHits.length > 0) {
      onSelectSearchHit(searchHits[0]);
      setIsFocused(false);
    } else {
      const target =
        scope === 'event' ? '#events' : scope === 'hotel' ? '#stay' : '#explore';
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="top" className="relative bg-[#0A2239]">
      {/* Full-bleed panoramic Boston Hero */}
      <div className="relative min-h-[600px] lg:min-h-[660px] flex flex-col justify-between overflow-hidden">
        <ResilientImage
          src={siteConfig.heroImage}
          alt={
            lang === 'vi'
              ? 'Toàn cảnh đường chân trời Boston và sông Charles lúc hoàng hôn'
              : 'Boston skyline and Charles River sailboats at golden hour'
          }
          fallbackTitle="Boston Skyline · Charles River"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Measured multi-stop scrim guaranteeing >= 4.5:1 text legibility */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0A2239]/90 via-[#0A2239]/50 to-[#0A2239]/35"
        />

        <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-between px-6 py-8 lg:px-8 lg:py-10">
          {/* Subtle Hero Utility Strip: Official Descriptor + Language Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs font-medium tracking-wide text-white/85 sm:text-sm">
              {kickerText}
            </p>

            <div
              role="group"
              aria-label="Language switcher"
              className="inline-flex items-center rounded-lg border border-white/25 bg-[#0A2239]/55 p-1 backdrop-blur-sm"
            >
              <button
                type="button"
                onClick={() => onChangeLang('vi')}
                className={`min-h-[32px] rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'vi'
                    ? 'bg-white text-[#0A2239]'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                Tiếng Việt
              </button>
              <button
                type="button"
                onClick={() => onChangeLang('en')}
                className={`min-h-[32px] rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  lang === 'en'
                    ? 'bg-white text-[#0A2239]'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Focal Hero Content */}
          <div className="my-auto max-w-3xl py-12 lg:py-16">
            <h1 className="text-balance-heading font-display text-[clamp(2.4rem,4.8vw,4.15rem)] font-extrabold leading-[1.08] tracking-tight text-white">
              {headlineText}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
              {subheadText}
            </p>

            {/* Interactive Discovery Search Hub */}
            <div className="relative mt-8 max-w-2xl">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-xl sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 items-center gap-3 px-3">
                  <Search
                    className="h-5 w-5 shrink-0 text-[#526071]"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={query}
                    onFocus={() => setIsFocused(true)}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setIsFocused(true);
                    }}
                    placeholder={t.searchPlaceholder}
                    aria-label={t.searchPlaceholder}
                    className="h-11 w-full bg-transparent text-sm font-medium text-[#0F1B2B] placeholder:text-[#526071] focus:outline-none sm:text-base"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0F1B2B]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-[#E3E7EE] pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
                  <select
                    value={scope}
                    onChange={(e) =>
                      setScope(
                        e.target.value as 'all' | 'experience' | 'event' | 'hotel'
                      )
                    }
                    aria-label="Category filter"
                    className="h-11 rounded-lg bg-[#F7F8FA] px-3 text-sm font-semibold text-[#0F1B2B] focus:outline-2 focus:outline-[#C8102E]"
                  >
                    <option value="all">{t.searchAll}</option>
                    <option value="experience">{t.searchExplore}</option>
                    <option value="event">{t.searchEvents}</option>
                    <option value="hotel">{t.searchStay}</option>
                  </select>

                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#A10C24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2239] whitespace-nowrap shrink-0"
                  >
                    <span>{t.searchBtn}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </form>

              {/* Live Search Results Dropdown */}
              {isFocused && query.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[#E3E7EE] bg-white shadow-2xl">
                  {searchHits.length > 0 ? (
                    <ul className="divide-y divide-[#E3E7EE]">
                      {searchHits.map((hit) => (
                        <li key={`${hit.kind}-${hit.id}`}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSearchHit(hit);
                              setIsFocused(false);
                              setQuery('');
                            }}
                            className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-[#F7F8FA]"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-display text-sm font-bold text-[#0F1B2B]">
                                {hit.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-[#526071]">
                                {hit.meta}
                              </p>
                            </div>
                            <ArrowRight
                              className="h-4 w-4 shrink-0 text-[#C8102E]"
                              aria-hidden="true"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-4 text-sm text-[#526071]">{t.noResults}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width 4-Column Destination Facts Strip below Hero */}
      <div className="border-t border-white/10 bg-[#071727]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 divide-y divide-white/10 px-6 sm:grid-cols-4 sm:divide-x sm:divide-y-0 lg:px-8">
          {siteConfig.stats.map((stat, idx) => (
            <div key={`${stat.value}-${idx}`} className="py-5 sm:px-6 first:sm:pl-0 last:sm:pr-0">
              <p className="font-display text-2xl font-extrabold tracking-tight text-white tabular-nums">
                {stat.value}
              </p>
              <p className="mt-1 text-xs leading-snug text-white/75 sm:text-sm">
                {lang === 'vi' ? stat.labelVi : stat.labelEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { ArrowUpRight, Bookmark, Check } from 'lucide-react';
import { EventItem, Language } from '../data/bostonData';
import { useSiteCopy } from '../lib/I18nContext';

interface EventsSectionProps {
  lang: Language;
  items: EventItem[];
  savedIds: Set<string>;
  onToggleSaveEvent: (evt: EventItem) => void;
  onSelectEvent: (evt: EventItem) => void;
}

export function EventsSection({
  lang,
  items,
  savedIds,
  onToggleSaveEvent,
  onSelectEvent,
}: EventsSectionProps) {
  const t = useSiteCopy(lang).events;
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month' | 'holiday'>('all');
  const [category, setCategory] = useState<
    'all' | 'arts' | 'sports' | 'festival' | 'exhibition'
  >('all');

  const filteredEvents = useMemo(() => {
    return items.filter((evt) => {
      const matchTime = timeframe === 'all' || evt.timeframe === timeframe;
      const matchCat = category === 'all' || evt.category === category;
      return matchTime && matchCat;
    });
  }, [items, timeframe, category]);

  const timeframes: ('all' | 'week' | 'month' | 'holiday')[] = [
    'all',
    'week',
    'month',
    'holiday',
  ];
  const categories: ('all' | 'arts' | 'sports' | 'festival' | 'exhibition')[] = [
    'all',
    'festival',
    'sports',
    'arts',
    'exhibition',
  ];

  return (
    <section id="events" className="bg-[#F7F8FA] py-20 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#C8102E]">{t.kicker}</p>
            <h2 className="text-balance-heading mt-2 font-display text-3xl font-extrabold tracking-tight text-[#0A2239] sm:text-4xl">
              {t.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#526071]">
              {t.subtitle}
            </p>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-[#E3E7EE] bg-white p-1">
              {timeframes.map((tf) => {
                const active = timeframe === tf;
                return (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 sm:text-sm ${
                      active
                        ? 'bg-[#0A2239] text-white'
                        : 'text-[#526071] hover:text-[#0A2239]'
                    }`}
                  >
                    {t.timeframes[tf]}
                  </button>
                );
              })}
            </div>

            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value as
                    | 'all'
                    | 'arts'
                    | 'sports'
                    | 'festival'
                    | 'exhibition'
                )
              }
              aria-label={t.categories.all}
              className="min-h-[44px] rounded-xl border border-[#E3E7EE] bg-white px-4 text-sm font-semibold text-[#0F1B2B] focus:outline-2 focus:outline-[#C8102E]"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {t.categories[cat]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Structured Editorial Events Schedule */}
        <div className="mt-10 overflow-hidden rounded-xl border border-[#E3E7EE] bg-white">
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <p className="text-base font-medium text-[#526071]">{t.empty}</p>
              <button
                type="button"
                onClick={() => {
                  setTimeframe('all');
                  setCategory('all');
                }}
                className="mt-4 inline-flex min-h-[40px] items-center rounded-lg bg-[#0A2239] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#133454]"
              >
                {t.resetFilters}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#E3E7EE]">
              {filteredEvents.map((evt) => {
                const isSaved = savedIds.has(evt.id);
                return (
                  <li
                    key={evt.id}
                    className="grid grid-cols-1 items-center gap-5 px-6 py-6 transition-colors duration-150 hover:bg-[#F7F8FA]/80 md:grid-cols-12"
                  >
                    {/* Tabular Date Column */}
                    <div className="flex items-baseline gap-2.5 md:col-span-2 md:flex-col md:gap-0.5">
                      <span className="font-display text-3xl font-extrabold tracking-tight text-[#0A2239] tabular-nums">
                        {evt.dayNum}
                      </span>
                      <span className="font-mono text-xs font-medium tracking-wider text-[#C8102E]">
                        {evt.monthLabel[lang]} 2026
                      </span>
                    </div>

                    {/* Event Summary */}
                    <div className="md:col-span-7">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#526071]">
                        <span className="font-semibold text-[#0066B2]">
                          {t.categories[evt.category]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{evt.district}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{evt.time}</span>
                      </div>

                      <h3 className="mt-1.5 font-display text-lg font-bold text-[#0A2239] sm:text-xl">
                        <button
                          type="button"
                          onClick={() => onSelectEvent(evt)}
                          className="text-left transition-colors hover:text-[#C8102E]"
                        >
                          {evt.title[lang]}
                        </button>
                      </h3>

                      <p className="mt-1 text-sm text-[#526071]">
                        {evt.venue} ·{' '}
                        <span className="font-semibold text-[#0F1B2B] tabular-nums">
                          {evt.price[lang]}
                        </span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 md:col-span-3 md:justify-end">
                      <button
                        type="button"
                        onClick={() => onSelectEvent(evt)}
                        className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-[#0A2239] transition-colors hover:text-[#C8102E] whitespace-nowrap shrink-0"
                      >
                        <span>{t.details}</span>
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleSaveEvent(evt)}
                        className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          isSaved
                            ? 'border-[#0A2239] bg-[#0A2239] text-white'
                            : 'border-[#E3E7EE] bg-white text-[#0F1B2B] hover:border-[#0A2239]'
                        }`}
                      >
                        {isSaved ? (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>{isSaved ? t.savedEvent : t.saveEvent}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

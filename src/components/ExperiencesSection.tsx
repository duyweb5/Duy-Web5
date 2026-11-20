import { useState } from 'react';
import { ArrowUpRight, Bookmark, Check } from 'lucide-react';
import {
  COPY,
  ExperienceCategory,
  ExperienceItem,
  Language,
} from '../data/bostonData';
import { ResilientImage } from './ResilientImage';

interface ExperiencesSectionProps {
  lang: Language;
  items: ExperienceItem[];
  savedIds: Set<string>;
  onToggleSave: (item: ExperienceItem) => void;
  onSelectExperience: (item: ExperienceItem) => void;
}

export function ExperiencesSection({
  lang,
  items,
  savedIds,
  onToggleSave,
  onSelectExperience,
}: ExperiencesSectionProps) {
  const t = COPY[lang].explore;
  const [activeCategory, setActiveCategory] = useState<'all' | ExperienceCategory>('all');

  const filterKeys: ('all' | ExperienceCategory)[] = [
    'all',
    'history',
    'dining',
    'arts',
    'outdoors',
  ];

  const categoryLabels: Record<ExperienceCategory, string> = {
    history: t.filters.history,
    dining: t.filters.dining,
    arts: t.filters.arts,
    outdoors: t.filters.outdoors,
  };

  const filtered =
    activeCategory === 'all'
      ? items
      : items.filter((item) => item.category === activeCategory);

  return (
    <section id="explore" className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        {/* Section Header + Functional Segmented Category Controls */}
        <div className="flex flex-col justify-between gap-6 border-b border-[#E3E7EE] pb-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#C8102E]">{t.kicker}</p>
            <h2 className="text-balance-heading mt-2 font-display text-3xl font-extrabold tracking-tight text-[#0A2239] sm:text-4xl">
              {t.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#526071]">
              {t.subtitle}
            </p>
          </div>

          <div
            role="tablist"
            aria-label={t.title}
            className="flex flex-wrap items-center gap-1 rounded-xl bg-[#F7F8FA] p-1.5"
          >
            {filterKeys.map((key) => {
              const active = activeCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(key)}
                  className={`min-h-[38px] rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0A2239] text-white'
                      : 'text-[#526071] hover:text-[#0A2239]'
                  }`}
                >
                  {t.filters[key]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Asymmetric Editorial Bento Grid */}
        <div className="mt-10 grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, idx) => {
            const isLead = activeCategory === 'all' && idx === 0;
            const isSaved = savedIds.has(item.id);

            return (
              <article
                key={item.id}
                className={`group flex flex-col overflow-hidden rounded-xl border border-[#E3E7EE] bg-white transition-colors duration-150 hover:border-[#0A2239]/35 ${
                  isLead ? 'md:col-span-2 lg:col-span-2' : ''
                }`}
              >
                <div
                  onClick={() => onSelectExperience(item)}
                  className={`relative cursor-pointer overflow-hidden bg-[#0A2239] ${
                    isLead ? 'aspect-[16/9] lg:aspect-[21/11]' : 'aspect-[4/3]'
                  }`}
                >
                  <ResilientImage
                    src={item.image}
                    alt={item.title[lang]}
                    fallbackTitle={item.title[lang]}
                    className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    {/* Clean Unboxed Metadata with typographic separators */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#526071]">
                      <span className="font-semibold text-[#C8102E]">
                        {categoryLabels[item.category]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{item.district}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.duration[lang]}</span>
                    </div>

                    <h3 className="mt-2.5 font-display text-xl font-bold leading-snug tracking-tight text-[#0A2239]">
                      <button
                        type="button"
                        onClick={() => onSelectExperience(item)}
                        className="text-left transition-colors hover:text-[#C8102E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8102E]"
                      >
                        {item.title[lang]}
                      </button>
                    </h3>

                    <p className="mt-2.5 text-sm leading-relaxed text-[#526071] sm:text-[15px]">
                      {item.summary[lang]}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-4 border-t border-[#E3E7EE] pt-4">
                    <button
                      type="button"
                      onClick={() => onSelectExperience(item)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-[#0A2239] transition-colors hover:text-[#C8102E] whitespace-nowrap shrink-0"
                    >
                      <span>{t.viewDetails}</span>
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleSave(item)}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 ${
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
                      <span>{isSaved ? t.saved : t.save}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

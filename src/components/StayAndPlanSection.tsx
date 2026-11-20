import { useState } from 'react';
import { ArrowRight, Bookmark, Check, CheckCircle2 } from 'lucide-react';
import { HotelItem, Language } from '../data/bostonData';
import { useSiteCopy } from '../lib/I18nContext';
import { EMAIL_REGEX, submitGuideLead } from '../lib/cmsService';
import { ResilientImage } from './ResilientImage';

interface StayAndPlanSectionProps {
  lang: Language;
  hotels: HotelItem[];
  showMeetings: boolean;
  savedIds: Set<string>;
  onToggleSaveHotel: (hotel: HotelItem) => void;
  onSelectHotel: (hotel: HotelItem) => void;
  onOpenMeetingsModal: () => void;
}

export function StayAndPlanSection({
  lang,
  hotels,
  showMeetings,
  savedIds,
  onToggleSaveHotel,
  onSelectHotel,
  onOpenMeetingsModal,
}: StayAndPlanSectionProps) {
  const t = useSiteCopy(lang).stay;
  const [districtFilter, setDistrictFilter] = useState<
    'all' | 'back-bay' | 'seaport' | 'beacon-hill'
  >('all');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const districtOptions: {
    key: 'all' | 'back-bay' | 'seaport' | 'beacon-hill';
    label: string;
  }[] = [
    { key: 'all', label: t.allDistricts },
    { key: 'back-bay', label: 'Back Bay' },
    { key: 'seaport', label: 'Seaport & Waterfront' },
    { key: 'beacon-hill', label: 'Beacon Hill' },
  ];

  const visibleHotels =
    districtFilter === 'all'
      ? hotels
      : hotels.filter((h) => h.neighborhoodKey === districtFilter);

  const handleGuideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      setEmailError(t.emailInvalid);
      return;
    }
    setEmailError('');
    setSubmitting(true);
    try {
      await submitGuideLead(trimmed, 'visitor_guide', lang);
      setEmailSent(true);
      setEmail('');
    } catch {
      setEmailError(
        lang === 'vi'
          ? 'Không thể lưu đăng ký lúc này. Vui lòng thử lại.'
          : 'Could not save your request right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="stay" className="bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        {/* Hotels Header + Filter */}
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
            {districtOptions.map((opt) => {
              const active = districtFilter === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setDistrictFilter(opt.key)}
                  className={`min-h-[38px] rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#0A2239] text-white'
                      : 'text-[#526071] hover:text-[#0A2239]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hotels Editorial Grid */}
        <div className="mt-10 grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-4">
          {visibleHotels.map((hotel) => {
            const isSaved = savedIds.has(hotel.id);
            return (
              <article
                key={hotel.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-[#E3E7EE] bg-white transition-colors duration-150 hover:border-[#0A2239]/35"
              >
                <div
                  onClick={() => onSelectHotel(hotel)}
                  className="aspect-[4/3] cursor-pointer overflow-hidden bg-[#0A2239]"
                >
                  <ResilientImage
                    src={hotel.image}
                    alt={hotel.name}
                    fallbackTitle={hotel.name}
                    className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-[#526071]">
                      <span className="font-semibold text-[#0066B2]">
                        {hotel.district}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{hotel.style[lang]}</span>
                    </div>

                    <h3 className="mt-2 font-display text-lg font-bold leading-snug text-[#0A2239]">
                      <button
                        type="button"
                        onClick={() => onSelectHotel(hotel)}
                        className="text-left transition-colors hover:text-[#C8102E]"
                      >
                        {hotel.name}
                      </button>
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-[#526071]">
                      {hotel.summary[lang]}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#E3E7EE] pt-4">
                    <div>
                      <span className="font-display text-lg font-extrabold text-[#0A2239] tabular-nums">
                        ${hotel.rateUsd}
                      </span>
                      <span className="ml-1 text-xs text-[#526071]">
                        {t.perNight}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleSaveHotel(hotel)}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
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
                      <span>{isSaved ? t.savedHotel : t.saveHotel}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Official Visitor Guide & Meetings / Conventions Split */}
        <div
          id="meetings"
          className="mt-20 grid grid-cols-1 items-stretch gap-7 lg:grid-cols-12"
        >
          {/* Free Visitor Guide Form */}
          <div
            id="visitor-guide"
            className={`flex flex-col justify-between rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-8 lg:p-10 ${
              showMeetings ? 'lg:col-span-7' : 'lg:col-span-12'
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-[#C8102E]">
                {t.guideKicker}
              </p>
              <h3 className="text-balance-heading mt-2 font-display text-2xl font-extrabold tracking-tight text-[#0A2239] sm:text-3xl">
                {t.guideTitle}
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#526071] sm:text-base">
                {t.guideDesc}
              </p>
            </div>

            <div className="mt-8">
              {emailSent ? (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-700/20 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                  <p>{t.emailSuccess}</p>
                </div>
              ) : (
                <form
                  onSubmit={handleGuideSubmit}
                  noValidate
                  className="flex flex-col gap-3 sm:flex-row"
                >
                  <div className="flex-1">
                    <label htmlFor="visitor-guide-email" className="sr-only">
                      {t.emailPlaceholder}
                    </label>
                    <input
                      id="visitor-guide-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError('');
                      }}
                      placeholder={t.emailPlaceholder}
                      className="h-12 w-full rounded-lg border border-[#D4DBE5] bg-white px-4 text-sm font-medium text-[#0F1B2B] placeholder:text-[#526071] focus:border-[#0A2239] focus:outline-none"
                    />
                    {emailError && (
                      <p role="alert" className="mt-1.5 text-xs font-medium text-[#C8102E]">
                        {emailError}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#C8102E] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#A10C24] disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <span>{t.emailBtn}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Meetings & Conventions B2B Card */}
          {showMeetings && (
            <div className="flex flex-col justify-between rounded-xl bg-[#0A2239] p-8 text-white lg:col-span-5 lg:p-10">
              <div>
                <p className="text-sm font-semibold text-[#FF8A9B]">
                  {t.meetingsKicker}
                </p>
                <h3 className="text-balance-heading mt-2 font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {t.meetingsTitle}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
                  {t.meetingsDesc}
                </p>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={onOpenMeetingsModal}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#0A2239] transition-colors hover:bg-[#F7F8FA] whitespace-nowrap shrink-0"
                >
                  <span>{t.meetingsBtn}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

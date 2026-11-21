import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  ExternalLink,
  Film,
  ListVideo,
  MapPin,
  Play,
  Search,
  Share2,
  Youtube,
} from 'lucide-react';
import {
  ExperienceItem,
  HotelItem,
  Language,
  NeighborhoodItem,
} from '../data/bostonData';
import { useSiteCopy } from '../lib/I18nContext';
import {
  findRelatedPlacesForVideo,
  normalizeSearchText,
} from '../lib/searchUtils';
import { applyVideoSeoMetadata } from '../lib/videoSeo';
import {
  VideoChannelRecord,
  VideoItemRecord,
  VideoTopicRecord,
} from '../lib/videoService';

interface VideoLibrarySectionProps {
  lang: Language;
  channels: VideoChannelRecord[];
  topics: VideoTopicRecord[];
  videos: VideoItemRecord[];
  savedIds: Set<string>;
  onToggleSaveVideo: (video: VideoItemRecord) => void;
  isDedicatedPage?: boolean;
  initialSlug?: string;
  onNavigateDedicated?: (slug?: string) => void;
  onNavigateHome?: () => void;
  neighborhoods?: NeighborhoodItem[];
  experiences?: ExperienceItem[];
  hotels?: HotelItem[];
  onOpenExperience?: (item: ExperienceItem) => void;
  onOpenHotel?: (item: HotelItem) => void;
  onOpenNeighborhood?: (neighborhoodId: string) => void;
}

function getVideoTitle(v: VideoItemRecord, lang: Language): string {
  return lang === 'vi'
    ? v.titleVi || v.rawTitle
    : v.titleEn || v.titleVi || v.rawTitle;
}

function getVideoSummary(v: VideoItemRecord, lang: Language): string {
  return lang === 'vi'
    ? v.summaryVi || v.descriptionVi || ''
    : v.summaryEn || v.summaryVi || v.descriptionEn || '';
}

function getVideoDescription(v: VideoItemRecord, lang: Language): string {
  return lang === 'vi'
    ? v.descriptionVi || v.rawDescription || v.summaryVi || ''
    : v.descriptionEn || v.summaryEn || v.descriptionVi || v.rawDescription || '';
}

function getVideoSlug(v: VideoItemRecord, lang: Language): string {
  return lang === 'vi' ? v.slugVi || v.id : v.slugEn || v.slugVi || v.id;
}

function getTopicTitle(t: VideoTopicRecord, lang: Language): string {
  return lang === 'vi' ? t.titleVi : t.titleEn || t.titleVi;
}

export function VideoLibrarySection({
  lang,
  channels,
  topics,
  videos,
  savedIds,
  onToggleSaveVideo,
  isDedicatedPage = false,
  initialSlug,
  onNavigateDedicated,
  onNavigateHome,
  neighborhoods = [],
  experiences = [],
  hotels = [],
  onOpenExperience,
  onOpenHotel,
  onOpenNeighborhood,
}: VideoLibrarySectionProps) {
  const isVi = lang === 'vi';
  const copy = useSiteCopy(lang).videos;

  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeVideoId, setActiveVideoId] = useState<string>('');
  const [playerActive, setPlayerActive] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const primaryChannel = channels[0] || null;

  // Map topicId -> topic
  const topicMap = useMemo(() => {
    const map = new Map<string, VideoTopicRecord>();
    for (const t of topics) map.set(t.id, t);
    return map;
  }, [topics]);

  // Count videos per topic
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of videos) {
      if (v.topicId) {
        counts.set(v.topicId, (counts.get(v.topicId) || 0) + 1);
      }
    }
    return counts;
  }, [videos]);

  // Visible topics that actually have videos (or all topics if none assigned yet)
  const visibleTopics = useMemo(() => {
    const withVideos = topics.filter((t) => (topicCounts.get(t.id) || 0) > 0);
    return withVideos.length > 0 ? withVideos : topics;
  }, [topics, topicCounts]);

  // Filtered playlist queue (accent-insensitive VI/EN)
  const filteredVideos = useMemo(() => {
    const qNorm = normalizeSearchText(searchQuery);
    return videos.filter((v) => {
      if (selectedTopicId !== 'all' && v.topicId !== selectedTopicId) {
        return false;
      }
      if (!qNorm) return true;
      const hay = normalizeSearchText(
        [
          v.titleVi,
          v.titleEn,
          v.rawTitle,
          v.summaryVi,
          v.summaryEn,
          v.channelName,
          ...v.keywordsVi,
          ...v.keywordsEn,
        ].join(' ')
      );
      return hay.includes(qNorm);
    });
  }, [videos, selectedTopicId, searchQuery]);

  // Resolve initial deep-link slug (/videos/:slug or #video/:slug)
  useEffect(() => {
    if (!initialSlug || videos.length === 0) return;
    const normalized = initialSlug.toLowerCase();
    const match = videos.find(
      (v) =>
        v.slugVi.toLowerCase() === normalized ||
        v.slugEn.toLowerCase() === normalized ||
        v.youtubeId.toLowerCase() === normalized ||
        v.id.toLowerCase() === normalized
    );
    if (match) {
      setActiveVideoId(match.id);
      if (match.topicId) {
        setSelectedTopicId('all');
      }
    }
  }, [initialSlug, videos]);

  // Ensure activeVideo always points to a valid video
  const activeVideo = useMemo(() => {
    if (activeVideoId) {
      const exact = filteredVideos.find((v) => v.id === activeVideoId);
      if (exact) return exact;
      const globalMatch = videos.find((v) => v.id === activeVideoId);
      if (globalMatch && selectedTopicId === 'all' && !searchQuery.trim()) {
        return globalMatch;
      }
    }
    return filteredVideos[0] || videos[0] || null;
  }, [activeVideoId, filteredVideos, videos, selectedTopicId, searchQuery]);

  const activeIndex = activeVideo
    ? filteredVideos.findIndex((v) => v.id === activeVideo.id)
    : -1;

  // Inject dynamic Schema.org VideoObject JSON-LD & OpenGraph meta
  useEffect(() => {
    return applyVideoSeoMetadata({
      video: activeVideo,
      lang,
      isDedicatedPage,
    });
  }, [activeVideo, lang, isDedicatedPage]);

  const handleSelectVideo = (video: VideoItemRecord, autoPlay = true) => {
    setActiveVideoId(video.id);
    setDescExpanded(false);
    if (autoPlay) setPlayerActive(true);

    // Sync clean URL slug on dedicated /videos page without reload
    if (isDedicatedPage) {
      const slug = getVideoSlug(video, lang);
      window.history.replaceState(null, '', `/videos/${slug}`);
    }
  };

  const handlePrev = () => {
    if (filteredVideos.length === 0) return;
    const prevIdx =
      activeIndex <= 0 ? filteredVideos.length - 1 : activeIndex - 1;
    handleSelectVideo(filteredVideos[prevIdx], true);
  };

  const handleNext = () => {
    if (filteredVideos.length === 0) return;
    const nextIdx =
      activeIndex < 0 || activeIndex >= filteredVideos.length - 1
        ? 0
        : activeIndex + 1;
    handleSelectVideo(filteredVideos[nextIdx], true);
  };

  const handleCopyDeepLink = async () => {
    if (!activeVideo) return;
    const slug = getVideoSlug(activeVideo, lang);
    const shareUrl = `${window.location.origin}/videos/${slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Ignore clipboard restriction
    }
    setCopiedShare(true);
    window.setTimeout(() => setCopiedShare(false), 2200);
  };

  if (videos.length === 0) {
    return null;
  }

  const activeTopic = activeVideo?.topicId
    ? topicMap.get(activeVideo.topicId) || null
    : null;
  const activeChannel =
    channels.find((c) => c.id === activeVideo?.channelId) || primaryChannel;
  const activeHighlights = activeVideo
    ? lang === 'vi'
      ? activeVideo.highlightsVi
      : activeVideo.highlightsEn.length > 0
        ? activeVideo.highlightsEn
        : activeVideo.highlightsVi
    : [];
  const activeSaved = activeVideo ? savedIds.has(activeVideo.id) : false;

  const activeTitle = activeVideo ? getVideoTitle(activeVideo, lang) : '';
  const activeSummary = activeVideo ? getVideoSummary(activeVideo, lang) : '';
  const activeDescription = activeVideo
    ? getVideoDescription(activeVideo, lang)
    : '';

  return (
    <section
      id="videos"
      className={`${
        isDedicatedPage
          ? 'min-h-[82vh] bg-[#F7F8FA] pt-8 pb-20'
          : 'border-t border-[#E3E7EE] bg-[#F7F8FA] py-20 lg:py-24'
      }`}
    >
      <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
        {/* Top Navigation Back Bar (Dedicated /videos route only) */}
        {isDedicatedPage && onNavigateHome && (
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-[#E3E7EE] pb-4">
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-[#0A2239] transition-colors hover:text-[#C8102E]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>
                {isVi ? 'Quay lại trang chủ Meet Boston' : 'Back to Meet Boston Home'}
              </span>
            </button>
            <span className="font-mono text-xs text-[#526071] tabular-nums">
              /videos
              {activeVideo ? `/${getVideoSlug(activeVideo, lang)}` : ''}
            </span>
          </div>
        )}

        {/* Section Header + Channel Summary Bar */}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#C8102E]">
              {copy.kicker}
            </p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#0A2239] sm:text-4xl">
              {copy.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#526071]">
              {copy.subtitle}
            </p>
          </div>

          {/* Channel Stats + Official YouTube Link + Full-Page Link */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 rounded-xl border border-[#E3E7EE] bg-white px-4 py-2.5">
              <div>
                <p className="font-mono text-base font-bold text-[#0A2239] tabular-nums">
                  {videos.length}
                </p>
                <p className="text-[11px] font-medium text-[#526071]">
                  {isVi ? 'Video' : 'Videos'}
                </p>
              </div>
              <div className="h-7 w-px bg-[#E3E7EE]" aria-hidden="true" />
              <div>
                <p className="font-mono text-base font-bold text-[#0A2239] tabular-nums">
                  {visibleTopics.length}
                </p>
                <p className="text-[11px] font-medium text-[#526071]">
                  {isVi ? 'Chủ đề' : 'Topics'}
                </p>
              </div>
              {primaryChannel && (
                <>
                  <div className="h-7 w-px bg-[#E3E7EE]" aria-hidden="true" />
                  <a
                    href={primaryChannel.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C8102E] transition-colors hover:text-[#0A2239]"
                  >
                    <Youtube className="h-4 w-4" aria-hidden="true" />
                    <span>
                      {primaryChannel.handle ||
                        (isVi ? primaryChannel.titleVi : primaryChannel.titleEn)}
                    </span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </>
              )}
            </div>

            {!isDedicatedPage && onNavigateDedicated && (
              <button
                type="button"
                onClick={() =>
                  onNavigateDedicated(
                    activeVideo ? getVideoSlug(activeVideo, lang) : undefined
                  )
                }
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0A2239] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#143757]"
              >
                <span>{copy.openFullLibrary}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Topic / Playlist Filter Bar + Live Search */}
        <div className="mt-8 flex flex-col gap-4 border-b border-[#E3E7EE] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label={isVi ? 'Chủ đề video' : 'Video topics'}
            className="flex items-center gap-1 overflow-x-auto pb-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedTopicId === 'all'}
              onClick={() => setSelectedTopicId('all')}
              className={`inline-flex min-h-[40px] items-center gap-2 border-b-2 px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                selectedTopicId === 'all'
                  ? 'border-[#C8102E] text-[#0A2239]'
                  : 'border-transparent text-[#526071] hover:text-[#0A2239]'
              }`}
            >
              <span>{copy.allTopics}</span>
              <span className="font-mono text-xs text-[#526071] tabular-nums">
                {videos.length}
              </span>
            </button>

            {visibleTopics.map((topic) => {
              const count = topicCounts.get(topic.id) || 0;
              const isSelected = selectedTopicId === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedTopicId(topic.id);
                    const firstInTopic = videos.find(
                      (v) => v.topicId === topic.id
                    );
                    if (firstInTopic) {
                      setActiveVideoId(firstInTopic.id);
                    }
                  }}
                  className={`inline-flex min-h-[40px] items-center gap-2 border-b-2 px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'border-[#C8102E] text-[#0A2239]'
                      : 'border-transparent text-[#526071] hover:text-[#0A2239]'
                  }`}
                >
                  <span>{getTopicTitle(topic, lang)}</span>
                  <span className="font-mono text-xs text-[#526071] tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#526071]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              className="h-10 w-full rounded-lg border border-[#E3E7EE] bg-white pr-3.5 pl-10 text-sm text-[#0F1B2B] placeholder:text-[#526071]/70 focus:border-[#0A2239] focus:outline-none"
            />
          </div>
        </div>

        {/* Main Cinema Theater Grid (Reference-inspired 1fr + 360px Playlist Queue) */}
        {activeVideo ? (
          <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            {/* LEFT STAGE: 16:9 YouTube Facade Player + Controls + Editorial Details + CTA */}
            <div className="min-w-0 space-y-5">
              <div className="overflow-hidden rounded-2xl border border-[#E3E7EE] bg-white shadow-xs">
                {/* 16:9 Facade / No-Cookie Embed */}
                <div className="relative aspect-video w-full bg-[#071727]">
                  {playerActive ? (
                    <iframe
                      key={activeVideo.youtubeId}
                      src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?rel=0&autoplay=1&modestbranding=1`}
                      title={activeTitle}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlayerActive(true)}
                      aria-label={`${isVi ? 'Phát video' : 'Play video'}: ${activeTitle}`}
                      className="group relative block h-full w-full overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-[#C8102E]"
                    >
                      <img
                        src={
                          activeVideo.thumbnail ||
                          `https://i.ytimg.com/vi/${activeVideo.youtubeId}/hqdefault.jpg`
                        }
                        alt={activeTitle}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#071727]/85 via-[#071727]/25 to-transparent" />

                      {/* Center Play Button */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#C8102E] text-white shadow-xl transition-transform duration-200 group-hover:scale-110 sm:h-20 sm:w-20">
                          <Play
                            className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8"
                            aria-hidden="true"
                          />
                        </span>
                      </div>

                      {/* Bottom Overlay Metadata */}
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-white/80">
                            {activeTopic
                              ? getTopicTitle(activeTopic, lang)
                              : activeVideo.channelName}
                          </p>
                          <p className="mt-1 line-clamp-1 font-display text-base font-bold sm:text-lg">
                            {activeTitle}
                          </p>
                        </div>
                        {activeVideo.duration && (
                          <span className="rounded bg-black/75 px-2.5 py-1 font-mono text-xs font-medium text-white tabular-nums shrink-0">
                            {activeVideo.duration}
                          </span>
                        )}
                      </div>
                    </button>
                  )}
                </div>

                {/* Theater Control Bar (Prev / Next / Save / Share / Open on YouTube) */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E7EE] bg-[#F7F8FA]/80 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={filteredVideos.length <= 1}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E3E7EE] bg-white px-3 text-xs font-semibold text-[#0A2239] transition-colors hover:border-[#0A2239] disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      <span>{copy.prevVideo}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={filteredVideos.length <= 1}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#E3E7EE] bg-white px-3 text-xs font-semibold text-[#0A2239] transition-colors hover:border-[#0A2239] disabled:opacity-40"
                    >
                      <span>{copy.nextVideo}</span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {activeIndex >= 0 && (
                      <span className="ml-1 font-mono text-xs text-[#526071] tabular-nums">
                        {activeIndex + 1} / {filteredVideos.length}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleSaveVideo(activeVideo)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                        activeSaved
                          ? 'border-[#0A2239] bg-[#0A2239] text-white'
                          : 'border-[#E3E7EE] bg-white text-[#0A2239] hover:border-[#0A2239]'
                      }`}
                    >
                      {activeSaved ? (
                        <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {activeSaved
                          ? isVi
                            ? 'Đã lưu lịch trình'
                            : 'Saved to Trip'
                          : isVi
                            ? 'Lưu lịch trình'
                            : 'Save to Trip'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyDeepLink}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 text-xs font-semibold text-[#0A2239] transition-colors hover:border-[#0A2239]"
                    >
                      {copiedShare ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>
                        {copiedShare
                          ? isVi
                            ? 'Đã chép link'
                            : 'Link Copied'
                          : isVi
                            ? 'Chia sẻ'
                            : 'Share'}
                      </span>
                    </button>

                    <a
                      href={`https://www.youtube.com/watch?v=${activeVideo.youtubeId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 text-xs font-semibold text-[#C8102E] transition-colors hover:border-[#C8102E]"
                    >
                      <Youtube className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{copy.watchOnYoutube}</span>
                    </a>
                  </div>
                </div>

                {/* Video Title, Summary, AI Key Takeaways & Description */}
                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[#526071]">
                    {activeTopic && (
                      <span className="font-semibold text-[#C8102E]">
                        {getTopicTitle(activeTopic, lang)}
                      </span>
                    )}
                    <span>·</span>
                    <span>{activeVideo.channelName}</span>
                    {activeVideo.duration && (
                      <>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {activeVideo.duration}
                        </span>
                      </>
                    )}
                    {activeVideo.publishedDate && (
                      <>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {activeVideo.publishedDate.slice(0, 10)}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="mt-2 font-display text-xl font-extrabold leading-snug text-[#0A2239] sm:text-2xl">
                    {activeTitle}
                  </h3>

                  {activeSummary && (
                    <p className="mt-3 text-sm leading-relaxed text-[#334155]">
                      {activeSummary}
                    </p>
                  )}

                  {/* AI Key Takeaways */}
                  {activeHighlights.length > 0 && (
                    <div className="mt-5 rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-4">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0A2239]">
                        {copy.keyTakeaways}
                      </p>
                      <ul className="mt-2.5 space-y-2">
                        {activeHighlights.map((point, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 text-sm text-[#0F1B2B]"
                          >
                            <CheckCircle2
                              className="mt-0.5 h-4 w-4 shrink-0 text-[#C8102E]"
                              aria-hidden="true"
                            />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Full Editorial Description (Collapsible if long) */}
                  {activeDescription && activeDescription !== activeSummary && (
                    <div className="mt-4 border-t border-[#E3E7EE] pt-4">
                      <p
                        className={`whitespace-pre-line text-sm leading-relaxed text-[#526071] ${
                          descExpanded ? '' : 'line-clamp-3'
                        }`}
                      >
                        {activeDescription}
                      </p>
                      {activeDescription.length > 180 && (
                        <button
                          type="button"
                          onClick={() => setDescExpanded((p) => !p)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0A2239] hover:text-[#C8102E]"
                        >
                          <span>
                            {descExpanded
                              ? isVi
                                ? 'Thu gọn mô tả'
                                : 'Show less'
                              : isVi
                                ? 'Xem đầy đủ mô tả'
                                : 'Read full description'}
                          </span>
                          {descExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Cross-Linking: Related Boston Places & Neighborhoods */}
              {(() => {
                const related = findRelatedPlacesForVideo({
                  video: activeVideo,
                  neighborhoods,
                  experiences,
                  hotels,
                });
                const hasAny =
                  related.neighborhoods.length > 0 ||
                  related.experiences.length > 0 ||
                  related.hotels.length > 0;
                if (!hasAny || (!onOpenNeighborhood && !onOpenExperience && !onOpenHotel)) {
                  return null;
                }
                return (
                  <div className="rounded-2xl border border-[#E3E7EE] bg-white p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0A2239]">
                        {isVi
                          ? 'Khám phá địa điểm & khu phố liên quan'
                          : 'Related Boston Places & Neighborhoods'}
                      </p>
                      <span className="text-xs text-[#526071]">
                        {isVi ? 'Bấm để xem & thêm lịch trình' : 'Explore & add to trip'}
                      </span>
                    </div>
                    <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {related.neighborhoods.map((nb) =>
                        onOpenNeighborhood ? (
                          <button
                            key={`nb-${nb.id}`}
                            type="button"
                            onClick={() => onOpenNeighborhood(nb.id)}
                            className="flex items-center gap-3 rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-3 text-left transition-colors hover:border-[#C8102E] hover:bg-white"
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0A2239] text-white">
                              <MapPin className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[#0A2239]">
                                {nb.name}
                              </p>
                              <p className="truncate text-[11px] text-[#526071]">
                                {nb.vibe[lang]}
                              </p>
                            </div>
                          </button>
                        ) : null
                      )}

                      {related.experiences.map((exp) =>
                        onOpenExperience ? (
                          <button
                            key={`exp-${exp.id}`}
                            type="button"
                            onClick={() => onOpenExperience(exp)}
                            className="flex items-center gap-3 rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-3 text-left transition-colors hover:border-[#C8102E] hover:bg-white"
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#C8102E] text-white">
                              <Compass className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[#0A2239]">
                                {exp.title[lang]}
                              </p>
                              <p className="truncate text-[11px] text-[#526071]">
                                {exp.district}
                              </p>
                            </div>
                          </button>
                        ) : null
                      )}

                      {related.hotels.map((htl) =>
                        onOpenHotel ? (
                          <button
                            key={`htl-${htl.id}`}
                            type="button"
                            onClick={() => onOpenHotel(htl)}
                            className="flex items-center gap-3 rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-3 text-left transition-colors hover:border-[#C8102E] hover:bg-white"
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#143757] text-white">
                              <Building2 className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-[#0A2239]">
                                {htl.name}
                              </p>
                              <p className="truncate text-[11px] text-[#526071]">
                                {htl.district} · ${htl.rateUsd}
                              </p>
                            </div>
                          </button>
                        ) : null
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Customizable Bilingual CTA Block below Player (Admin-managed per channel) */}
              {activeChannel?.ctaEnabled &&
                (activeChannel.ctaTitleVi || activeChannel.ctaTitleEn) && (
                  <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#0A2239]/15 bg-[#0A2239] p-6 text-white sm:flex-row sm:items-center">
                    <div className="max-w-xl">
                      <p className="font-display text-base font-bold text-white sm:text-lg">
                        {isVi
                          ? activeChannel.ctaTitleVi
                          : activeChannel.ctaTitleEn || activeChannel.ctaTitleVi}
                      </p>
                      {(activeChannel.ctaSubtitleVi ||
                        activeChannel.ctaSubtitleEn) && (
                        <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                          {isVi
                            ? activeChannel.ctaSubtitleVi
                            : activeChannel.ctaSubtitleEn ||
                              activeChannel.ctaSubtitleVi}
                        </p>
                      )}
                    </div>
                    {activeChannel.ctaButtonUrl && (
                      <a
                        href={activeChannel.ctaButtonUrl}
                        onClick={(e) => {
                          if (
                            isDedicatedPage &&
                            activeChannel.ctaButtonUrl.startsWith('#') &&
                            onNavigateHome
                          ) {
                            e.preventDefault();
                            onNavigateHome();
                            window.setTimeout(() => {
                              document
                                .querySelector(activeChannel.ctaButtonUrl)
                                ?.scrollIntoView({ behavior: 'smooth' });
                            }, 120);
                          }
                        }}
                        target={
                          activeChannel.ctaButtonUrl.startsWith('http')
                            ? '_blank'
                            : undefined
                        }
                        rel={
                          activeChannel.ctaButtonUrl.startsWith('http')
                            ? 'noreferrer'
                            : undefined
                        }
                        className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#C8102E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A10C24] whitespace-nowrap shrink-0"
                      >
                        <span>
                          {isVi
                            ? activeChannel.ctaButtonLabelVi || 'Khám phá ngay'
                            : activeChannel.ctaButtonLabelEn || 'Explore Now'}
                        </span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}
            </div>

            {/* RIGHT COLUMN: Scrollable Numbered Playlist Queue (Exact reference UX) */}
            <aside
              aria-label={copy.playlistQueue}
              className="flex flex-col overflow-hidden rounded-2xl border border-[#E3E7EE] bg-white shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-[#E3E7EE] bg-[#0A2239] px-4 py-3.5 text-white">
                <div className="flex items-center gap-2 min-w-0">
                  <ListVideo className="h-4 w-4 text-[#F8B4B4] shrink-0" aria-hidden="true" />
                  <h3 className="truncate font-display text-sm font-bold">
                    {selectedTopicId === 'all'
                      ? copy.playlistQueue
                      : getTopicTitle(
                          topicMap.get(selectedTopicId) || visibleTopics[0],
                          lang
                        )}
                  </h3>
                </div>
                <span className="font-mono text-xs text-white/80 tabular-nums shrink-0">
                  {filteredVideos.length}
                </span>
              </div>

              <div className="max-h-[480px] divide-y divide-[#E3E7EE] overflow-y-auto">
                {filteredVideos.map((vid, idx) => {
                  const isActive = activeVideo?.id === vid.id;
                  const title = getVideoTitle(vid, lang);
                  return (
                    <button
                      key={vid.id}
                      type="button"
                      onClick={() => handleSelectVideo(vid, true)}
                      className={`group flex w-full items-start gap-3 border-l-3 p-3 text-left transition-colors ${
                        isActive
                          ? 'border-l-[#C8102E] bg-[#FFF5F6]'
                          : 'border-l-transparent bg-white hover:bg-[#F7F8FA]'
                      }`}
                    >
                      <span
                        className={`mt-1 w-5 text-center font-mono text-xs font-semibold tabular-nums shrink-0 ${
                          isActive ? 'text-[#C8102E]' : 'text-[#526071]'
                        }`}
                      >
                        {isActive ? '▶' : String(idx + 1).padStart(2, '0')}
                      </span>

                      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-[#0A2239]">
                        <img
                          src={
                            vid.thumbnail ||
                            `https://i.ytimg.com/vi/${vid.youtubeId}/hqdefault.jpg`
                          }
                          alt={title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {vid.duration && (
                          <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white tabular-nums">
                            {vid.duration}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`line-clamp-2 text-xs font-bold leading-snug ${
                            isActive ? 'text-[#C8102E]' : 'text-[#0A2239]'
                          }`}
                        >
                          {title}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-[#526071]">
                          {vid.channelName}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-[#E3E7EE] bg-white p-10 text-center">
            <Film className="mx-auto h-10 w-10 text-[#526071]/60" aria-hidden="true" />
            <p className="mt-3 font-display text-base font-bold text-[#0A2239]">
              {copy.emptySearch}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTopicId('all');
              }}
              className="mt-4 inline-flex min-h-[40px] items-center rounded-lg bg-[#0A2239] px-4 py-2 text-xs font-semibold text-white hover:bg-[#143757]"
            >
              {isVi ? 'Xem tất cả video' : 'Reset Filters'}
            </button>
          </div>
        )}

        {/* Browse Grid Below Player (for quick visual discovery across all videos in current filter) */}
        {filteredVideos.length > 1 && (
          <div className="mt-12">
            <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-3">
              <h3 className="font-display text-lg font-bold text-[#0A2239]">
                {selectedTopicId === 'all'
                  ? copy.browseAllHeading
                  : getTopicTitle(
                      topicMap.get(selectedTopicId) || visibleTopics[0],
                      lang
                    )}
              </h3>
              <span className="font-mono text-xs text-[#526071] tabular-nums">
                {filteredVideos.length} {isVi ? 'video' : 'videos'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(isDedicatedPage
                ? filteredVideos
                : filteredVideos.slice(0, 6)
              ).map((vid) => {
                const title = getVideoTitle(vid, lang);
                const summary = getVideoSummary(vid, lang);
                const tRec = vid.topicId ? topicMap.get(vid.topicId) : null;
                const isPlaying = activeVideo?.id === vid.id;
                const isSaved = savedIds.has(vid.id);

                return (
                  <article
                    key={vid.id}
                    className={`group flex flex-col overflow-hidden rounded-xl border bg-white transition-all ${
                      isPlaying
                        ? 'border-[#C8102E] ring-1 ring-[#C8102E]/20'
                        : 'border-[#E3E7EE] hover:border-[#0A2239]/30 hover:shadow-md'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectVideo(vid, true);
                        document
                          .getElementById('videos')
                          ?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="relative aspect-video w-full overflow-hidden bg-[#0A2239] text-left"
                    >
                      <img
                        src={
                          vid.thumbnail ||
                          `https://i.ytimg.com/vi/${vid.youtubeId}/hqdefault.jpg`
                        }
                        alt={title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/30" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#C8102E]/95 text-white shadow-md transition-transform group-hover:scale-110">
                          <Play
                            className="ml-0.5 h-5 w-5 fill-current"
                            aria-hidden="true"
                          />
                        </span>
                      </span>
                      {vid.duration && (
                        <span className="absolute right-2.5 bottom-2.5 rounded bg-black/80 px-2 py-0.5 font-mono text-[11px] font-medium text-white tabular-nums">
                          {vid.duration}
                        </span>
                      )}
                    </button>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="truncate text-[#C8102E]">
                          {tRec ? getTopicTitle(tRec, lang) : vid.channelName}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleSaveVideo(vid)}
                          aria-label={
                            isSaved
                              ? isVi
                                ? 'Bỏ lưu video'
                                : 'Remove saved video'
                              : isVi
                                ? 'Lưu video vào lịch trình'
                                : 'Save video to trip'
                          }
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                            isSaved
                              ? 'bg-[#0A2239] text-white'
                              : 'text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]'
                          }`}
                        >
                          {isSaved ? (
                            <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleSelectVideo(vid, true);
                          document
                            .getElementById('videos')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="mt-1.5 text-left font-display text-sm font-bold leading-snug text-[#0A2239] transition-colors group-hover:text-[#C8102E] line-clamp-2"
                      >
                        {title}
                      </button>

                      {summary && (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#526071]">
                          {summary}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {!isDedicatedPage &&
              filteredVideos.length > 6 &&
              onNavigateDedicated && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => onNavigateDedicated()}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#0A2239] bg-white px-6 py-2.5 text-sm font-semibold text-[#0A2239] transition-colors hover:bg-[#0A2239] hover:text-white"
                  >
                    <span>
                      {isVi
                        ? `Xem toàn bộ ${filteredVideos.length} video trong thư viện`
                        : `View all ${filteredVideos.length} videos in the library`}
                    </span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
          </div>
        )}
      </div>
    </section>
  );
}

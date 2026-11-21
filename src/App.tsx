import { useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  EventItem,
  ExperienceItem,
  HotelItem,
  Language,
  NeighborhoodItem,
  SavedItineraryItem,
} from './data/bostonData';
import {
  CmsEvent,
  CmsExperience,
  CmsHotel,
  CmsNeighborhood,
  DEFAULT_CMS_EVENTS,
  DEFAULT_CMS_EXPERIENCES,
  DEFAULT_CMS_HOTELS,
  DEFAULT_CMS_NEIGHBORHOODS,
  DEFAULT_SITE_CONFIG,
  ResolvedAdminRole,
  SiteConfigData,
  resolveAdminRole,
  subscribePublicCms,
} from './lib/cmsService';
import { auth } from './lib/firebase';
import { I18nProvider } from './lib/I18nContext';
import {
  DEFAULT_I18N_CONFIG,
  I18nConfigData,
  UiTranslationRecord,
  subscribeI18nConfig,
  subscribeUiTranslations,
} from './lib/i18nService';
import {
  DEFAULT_VIDEOS,
  DEFAULT_VIDEO_CHANNELS,
  DEFAULT_VIDEO_TOPICS,
  VideoChannelRecord,
  VideoItemRecord,
  VideoTopicRecord,
  subscribePublicVideoLibrary,
} from './lib/videoService';
import { CmsAdminWorkspace } from './components/CmsAdminWorkspace';
import { DetailModal, DetailModalTarget } from './components/DetailModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EventsSection } from './components/EventsSection';
import { ExperiencesSection } from './components/ExperiencesSection';
import { Footer } from './components/Footer';
import { HeroSection, SearchHit } from './components/HeroSection';
import { ItineraryDrawer } from './components/ItineraryDrawer';
import { MeetingsModal } from './components/MeetingsModal';
import { Navbar } from './components/Navbar';
import { NeighborhoodsSection } from './components/NeighborhoodsSection';
import { QuickSearchModal } from './components/QuickSearchModal';
import { StayAndPlanSection } from './components/StayAndPlanSection';
import { VideoLibrarySection } from './components/VideoLibrarySection';

const STORAGE_KEY = 'meet-boston-itinerary-v1';

type AppRouteState = {
  view: 'public' | 'videos' | 'admin';
  videoSlug?: string;
};

function resolveLocationRoute(): AppRouteState {
  const hash = window.location.hash.toLowerCase().replace(/\/+$/, '');
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const lowerPath = path.toLowerCase();

  if (hash === '#admin' || lowerPath === '/admin') {
    return { view: 'admin' };
  }
  if (lowerPath === '/videos') {
    return { view: 'videos' };
  }
  if (lowerPath.startsWith('/videos/')) {
    return {
      view: 'videos',
      videoSlug: decodeURIComponent(path.slice('/videos/'.length)),
    };
  }
  if (hash.startsWith('#video/')) {
    return {
      view: 'videos',
      videoSlug: decodeURIComponent(window.location.hash.slice('#video/'.length)),
    };
  }
  return { view: 'public' };
}

function buildStarterItinerary(
  exps: ExperienceItem[],
  htls: HotelItem[]
): SavedItineraryItem[] {
  const result: SavedItineraryItem[] = [];
  if (exps[0]) {
    result.push({
      id: exps[0].id,
      type: 'experience',
      day: 1,
      title: exps[0].title,
      subtitle: exps[0].duration,
      district: exps[0].district,
      image: exps[0].image,
    });
  }
  if (exps[1]) {
    result.push({
      id: exps[1].id,
      type: 'experience',
      day: 1,
      title: exps[1].title,
      subtitle: exps[1].duration,
      district: exps[1].district,
      image: exps[1].image,
    });
  }
  if (exps[2]) {
    result.push({
      id: exps[2].id,
      type: 'experience',
      day: 2,
      title: exps[2].title,
      subtitle: exps[2].duration,
      district: exps[2].district,
      image: exps[2].image,
    });
  }
  if (htls[0]) {
    result.push({
      id: htls[0].id,
      type: 'hotel',
      day: 1,
      title: { vi: htls[0].name, en: htls[0].name },
      subtitle: htls[0].style,
      district: htls[0].district,
      image: htls[0].image,
    });
  }
  return result;
}

function MeetBostonApp() {
  const [lang, setLang] = useState<Language>('vi');
  const [route, setRoute] = useState<AppRouteState>(() => resolveLocationRoute());

  // Firebase Auth + Admin RBAC state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminRole, setAdminRole] = useState<ResolvedAdminRole>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
  const isAdmin = adminRole !== null;

  // Live CMS Data (falls back smoothly to defaults if Firestore has not been seeded yet)
  const [cmsSiteConfig, setCmsSiteConfig] = useState<SiteConfigData | null>(null);
  const [cmsExperiences, setCmsExperiences] = useState<CmsExperience[] | null>(null);
  const [cmsNeighborhoods, setCmsNeighborhoods] = useState<CmsNeighborhood[] | null>(
    null
  );
  const [cmsEvents, setCmsEvents] = useState<CmsEvent[] | null>(null);
  const [cmsHotels, setCmsHotels] = useState<CmsHotel[] | null>(null);
  const [cmsI18nConfig, setCmsI18nConfig] = useState<I18nConfigData | null>(null);
  const [uiTranslations, setUiTranslations] = useState<UiTranslationRecord[]>([]);

  // Live Video Library Data (falls back smoothly to Lang Thang Boston starter showcase)
  const [cmsVideoChannels, setCmsVideoChannels] = useState<
    VideoChannelRecord[] | null
  >(null);
  const [cmsVideoTopics, setCmsVideoTopics] = useState<VideoTopicRecord[] | null>(
    null
  );
  const [cmsVideos, setCmsVideos] = useState<VideoItemRecord[] | null>(null);

  const userPickedLangRef = useRef(false);

  const i18nConfig = cmsI18nConfig || DEFAULT_I18N_CONFIG;
  const siteConfig = cmsSiteConfig || DEFAULT_SITE_CONFIG;
  const experiences =
    cmsExperiences && cmsExperiences.length > 0
      ? cmsExperiences
      : DEFAULT_CMS_EXPERIENCES;
  const neighborhoods =
    cmsNeighborhoods && cmsNeighborhoods.length > 0
      ? cmsNeighborhoods
      : DEFAULT_CMS_NEIGHBORHOODS;
  const events =
    cmsEvents && cmsEvents.length > 0 ? cmsEvents : DEFAULT_CMS_EVENTS;
  const hotels =
    cmsHotels && cmsHotels.length > 0 ? cmsHotels : DEFAULT_CMS_HOTELS;

  const videoChannels =
    cmsVideoChannels && cmsVideoChannels.length > 0
      ? cmsVideoChannels
      : DEFAULT_VIDEO_CHANNELS;
  const videoTopics =
    cmsVideoTopics && cmsVideoTopics.length > 0
      ? cmsVideoTopics
      : DEFAULT_VIDEO_TOPICS;
  const videos =
    cmsVideos && cmsVideos.length > 0 ? cmsVideos : DEFAULT_VIDEOS;

  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>(
    DEFAULT_CMS_NEIGHBORHOODS[0].id
  );

  const [savedItems, setSavedItems] = useState<SavedItineraryItem[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage read errors in restricted iframes
    }
    return [];
  });

  const [detailTarget, setDetailTarget] = useState<DetailModalTarget>(null);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [meetingsOpen, setMeetingsOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K quick search shortcut on public views
  useEffect(() => {
    if (route.view === 'admin') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [route.view]);

  // Sync browser URL & hash navigation (/admin, /videos, /videos/:slug, #video/:slug)
  useEffect(() => {
    const onRouteChange = () => {
      setRoute(resolveLocationRoute());
    };
    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);
    return () => {
      window.removeEventListener('hashchange', onRouteChange);
      window.removeEventListener('popstate', onRouteChange);
    };
  }, []);

  // Listen to Firebase Authentication
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setAdminRole(null);
        setCheckingAdmin(false);
        return;
      }
      setCheckingAdmin(true);
      try {
        const resolved = await resolveAdminRole(
          nextUser.uid,
          nextUser.email,
          nextUser.emailVerified
        );
        setAdminRole(resolved);
      } catch {
        setAdminRole(null);
      } finally {
        setCheckingAdmin(false);
      }
    });
    return unsub;
  }, []);

  // Subscribe to public published CMS content, bilingual config, and Video Library in real time
  useEffect(() => {
    if (route.view === 'admin') return;
    const unsubCms = subscribePublicCms({
      onSiteConfig: setCmsSiteConfig,
      onExperiences: setCmsExperiences,
      onNeighborhoods: setCmsNeighborhoods,
      onEvents: setCmsEvents,
      onHotels: setCmsHotels,
    });
    const unsubI18n = subscribeI18nConfig(setCmsI18nConfig);
    const unsubTranslations = subscribeUiTranslations(setUiTranslations);
    const unsubVideos = subscribePublicVideoLibrary({
      onChannels: setCmsVideoChannels,
      onTopics: setCmsVideoTopics,
      onVideos: setCmsVideos,
    });
    return () => {
      unsubCms();
      unsubI18n();
      unsubTranslations();
      unsubVideos();
    };
  }, [route.view]);

  // Enforce enabled languages & default/browser locale policy from CMS i18nConfig
  useEffect(() => {
    if (!i18nConfig.enableVi && lang === 'vi') {
      setLang('en');
      return;
    }
    if (!i18nConfig.enableEn && lang === 'en') {
      setLang('vi');
      return;
    }
    if (!userPickedLangRef.current && cmsI18nConfig) {
      if (i18nConfig.autoDetectBrowser && typeof navigator !== 'undefined') {
        const browserLang = (navigator.language || '').toLowerCase();
        if (browserLang.startsWith('en') && i18nConfig.enableEn) {
          setLang('en');
          return;
        }
        if (browserLang.startsWith('vi') && i18nConfig.enableVi) {
          setLang('vi');
          return;
        }
      }
      setLang(i18nConfig.defaultLanguage);
    }
  }, [cmsI18nConfig, i18nConfig, lang]);

  // Keep <html lang="..."> synced for SEO & screen readers
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const handlePublicChangeLang = (nextLang: Language) => {
    userPickedLangRef.current = true;
    setLang(nextLang);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
    } catch {
      // Ignore storage write errors in restricted iframes
    }
  }, [savedItems]);

  const savedIds = useMemo(
    () => new Set(savedItems.map((item) => item.id)),
    [savedItems]
  );

  const openAdminCms = () => {
    window.history.pushState(null, '', '/admin');
    setRoute({ view: 'admin' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const exitAdminCms = () => {
    window.history.replaceState(null, '', '/');
    setRoute({ view: 'public' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const navigateToVideosPage = (slug?: string) => {
    const nextUrl = slug ? `/videos/${slug}` : '/videos';
    window.history.pushState(null, '', nextUrl);
    setRoute({ view: 'videos', videoSlug: slug });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = (hash?: string) => {
    window.history.pushState(null, '', hash ? `/${hash}` : '/');
    setRoute({ view: 'public' });
    if (hash) {
      window.setTimeout(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (route.view === 'admin') {
    return (
      <CmsAdminWorkspace
        user={user}
        authReady={authReady}
        isAdmin={isAdmin}
        adminRole={adminRole}
        checkingAdmin={checkingAdmin}
        onExitCms={exitAdminCms}
      />
    );
  }

  const toggleItineraryItem = (entry: SavedItineraryItem) => {
    setSavedItems((prev) =>
      prev.some((i) => i.id === entry.id)
        ? prev.filter((i) => i.id !== entry.id)
        : [...prev, entry]
    );
  };

  const handleToggleExperience = (exp: ExperienceItem) => {
    toggleItineraryItem({
      id: exp.id,
      type: 'experience',
      day: 1,
      title: exp.title,
      subtitle: exp.duration,
      district: exp.district,
      image: exp.image,
    });
  };

  const handleToggleNeighborhood = (nb: NeighborhoodItem) => {
    toggleItineraryItem({
      id: nb.id,
      type: 'neighborhood',
      day: 2,
      title: { vi: `Khu phố ${nb.name}`, en: `${nb.name} Neighborhood` },
      subtitle: nb.vibe,
      district: nb.name,
      image: nb.image,
    });
  };

  const handleToggleEvent = (evt: EventItem) => {
    toggleItineraryItem({
      id: evt.id,
      type: 'event',
      day: 2,
      title: evt.title,
      subtitle: evt.fullDate,
      district: evt.district,
      image: evt.image,
    });
  };

  const handleToggleHotel = (hotel: HotelItem) => {
    toggleItineraryItem({
      id: hotel.id,
      type: 'hotel',
      day: 1,
      title: { vi: hotel.name, en: hotel.name },
      subtitle: hotel.style,
      district: hotel.district,
      image: hotel.image,
    });
  };

  const handleToggleVideo = (video: VideoItemRecord) => {
    toggleItineraryItem({
      id: video.id,
      type: 'video',
      day: 1,
      title: {
        vi: video.titleVi || video.rawTitle,
        en: video.titleEn || video.titleVi || video.rawTitle,
      },
      subtitle: {
        vi: video.duration ? `Video · ${video.duration}` : 'Video YouTube',
        en: video.duration ? `Video · ${video.duration}` : 'YouTube Video',
      },
      district: video.channelName || 'Boston',
      image: video.thumbnail,
    });
  };

  const handleOpenNeighborhood = (neighborhoodId: string) => {
    setSelectedNeighborhoodId(neighborhoodId);
    if (route.view === 'videos') {
      navigateToHome('#neighborhoods');
    } else {
      document
        .querySelector('#neighborhoods')
        ?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectSearchHit = (hit: SearchHit) => {
    if (hit.kind === 'experience') {
      const exp = experiences.find((e) => e.id === hit.id);
      if (exp) setDetailTarget({ kind: 'experience', item: exp });
    } else if (hit.kind === 'event') {
      const evt = events.find((e) => e.id === hit.id);
      if (evt) setDetailTarget({ kind: 'event', item: evt });
    } else if (hit.kind === 'hotel') {
      const htl = hotels.find((h) => h.id === hit.id);
      if (htl) setDetailTarget({ kind: 'hotel', item: htl });
    } else if (hit.kind === 'neighborhood') {
      handleOpenNeighborhood(hit.id);
    } else if (hit.kind === 'video') {
      navigateToVideosPage(hit.slug || hit.id);
    }
  };

  const handleToggleModalTarget = () => {
    if (!detailTarget) return;
    if (detailTarget.kind === 'experience') {
      handleToggleExperience(detailTarget.item);
    } else if (detailTarget.kind === 'event') {
      handleToggleEvent(detailTarget.item);
    } else if (detailTarget.kind === 'hotel') {
      handleToggleHotel(detailTarget.item);
    }
  };

  const handleChangeDay = (id: string, day: 1 | 2 | 3) => {
    setSavedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, day } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const isVideosPage = route.view === 'videos';

  return (
    <I18nProvider i18nConfig={i18nConfig} overrides={uiTranslations}>
      <div className="min-h-screen bg-white text-[#0F1B2B]">
        <Navbar
          lang={lang}
          savedCount={savedItems.length}
          isVideosPage={isVideosPage}
          onNavigateHome={navigateToHome}
          onNavigateVideos={() => navigateToVideosPage()}
          onOpenItinerary={() => setItineraryOpen(true)}
          onOpenQuickSearch={() => setQuickSearchOpen(true)}
        />

        {isVideosPage ? (
          <main>
            {/* Compact Language Switcher Bar on Dedicated /videos Page */}
            {i18nConfig.showLanguageSwitcher &&
              i18nConfig.enableVi &&
              i18nConfig.enableEn && (
                <div className="border-b border-[#E3E7EE] bg-white">
                  <div className="mx-auto flex max-w-[1280px] items-center justify-end gap-2 px-6 py-2.5 lg:px-8">
                    <span className="text-xs font-medium text-[#526071]">
                      {lang === 'vi' ? 'Ngôn ngữ:' : 'Language:'}
                    </span>
                    <div className="inline-flex rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] p-0.5 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => handlePublicChangeLang('vi')}
                        className={`rounded-md px-2.5 py-1 transition-colors ${
                          lang === 'vi'
                            ? 'bg-[#0A2239] text-white'
                            : 'text-[#526071] hover:text-[#0A2239]'
                        }`}
                      >
                        {i18nConfig.viLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePublicChangeLang('en')}
                        className={`rounded-md px-2.5 py-1 transition-colors ${
                          lang === 'en'
                            ? 'bg-[#0A2239] text-white'
                            : 'text-[#526071] hover:text-[#0A2239]'
                        }`}
                      >
                        {i18nConfig.enLabel}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            <VideoLibrarySection
              lang={lang}
              channels={videoChannels}
              topics={videoTopics}
              videos={videos}
              savedIds={savedIds}
              onToggleSaveVideo={handleToggleVideo}
              isDedicatedPage
              initialSlug={route.videoSlug}
              onNavigateHome={() => navigateToHome()}
              neighborhoods={neighborhoods}
              experiences={experiences}
              hotels={hotels}
              onOpenExperience={(item) =>
                setDetailTarget({ kind: 'experience', item })
              }
              onOpenHotel={(item) => setDetailTarget({ kind: 'hotel', item })}
              onOpenNeighborhood={handleOpenNeighborhood}
            />
          </main>
        ) : (
          <main>
            <HeroSection
              lang={lang}
              siteConfig={siteConfig}
              experiences={experiences}
              neighborhoods={neighborhoods}
              events={events}
              hotels={hotels}
              videos={videos}
              videoTopics={videoTopics}
              onChangeLang={handlePublicChangeLang}
              onSelectSearchHit={handleSelectSearchHit}
            />

            {siteConfig.showExplore && (
              <ExperiencesSection
                lang={lang}
                items={experiences}
                savedIds={savedIds}
                onToggleSave={handleToggleExperience}
                onSelectExperience={(item) =>
                  setDetailTarget({ kind: 'experience', item })
                }
              />
            )}

            {siteConfig.showNeighborhoods && (
              <NeighborhoodsSection
                lang={lang}
                items={neighborhoods}
                selectedId={selectedNeighborhoodId}
                onSelectId={setSelectedNeighborhoodId}
                savedIds={savedIds}
                onToggleSaveNeighborhood={handleToggleNeighborhood}
                videos={videos}
                onOpenVideo={(slug) => navigateToVideosPage(slug)}
              />
            )}

            {siteConfig.showEvents && (
              <EventsSection
                lang={lang}
                items={events}
                savedIds={savedIds}
                onToggleSaveEvent={handleToggleEvent}
                onSelectEvent={(item) =>
                  setDetailTarget({ kind: 'event', item })
                }
              />
            )}

            {siteConfig.showStay && (
              <StayAndPlanSection
                lang={lang}
                hotels={hotels}
                showMeetings={siteConfig.showMeetings}
                savedIds={savedIds}
                onToggleSaveHotel={handleToggleHotel}
                onSelectHotel={(item) =>
                  setDetailTarget({ kind: 'hotel', item })
                }
                onOpenMeetingsModal={() => setMeetingsOpen(true)}
              />
            )}

            <VideoLibrarySection
              lang={lang}
              channels={videoChannels}
              topics={videoTopics}
              videos={videos}
              savedIds={savedIds}
              onToggleSaveVideo={handleToggleVideo}
              onNavigateDedicated={navigateToVideosPage}
              neighborhoods={neighborhoods}
              experiences={experiences}
              hotels={hotels}
              onOpenExperience={(item) =>
                setDetailTarget({ kind: 'experience', item })
              }
              onOpenHotel={(item) => setDetailTarget({ kind: 'hotel', item })}
              onOpenNeighborhood={handleOpenNeighborhood}
            />
          </main>
        )}

        <Footer
          lang={lang}
          siteConfig={siteConfig}
          onOpenItinerary={() => setItineraryOpen(true)}
          onOpenAdminCms={openAdminCms}
        />

        <DetailModal
          lang={lang}
          target={detailTarget}
          isSaved={detailTarget ? savedIds.has(detailTarget.item.id) : false}
          onClose={() => setDetailTarget(null)}
          onToggleSave={handleToggleModalTarget}
        />

        <ItineraryDrawer
          lang={lang}
          open={itineraryOpen}
          items={savedItems}
          onClose={() => setItineraryOpen(false)}
          onChangeDay={handleChangeDay}
          onRemoveItem={handleRemoveItem}
          onClearAll={() => setSavedItems([])}
          onLoadStarter={() =>
            setSavedItems(buildStarterItinerary(experiences, hotels))
          }
        />

        <MeetingsModal
          lang={lang}
          open={meetingsOpen}
          onClose={() => setMeetingsOpen(false)}
        />

        <QuickSearchModal
          lang={lang}
          open={quickSearchOpen}
          experiences={experiences}
          neighborhoods={neighborhoods}
          events={events}
          hotels={hotels}
          videos={videos}
          topics={videoTopics}
          onClose={() => setQuickSearchOpen(false)}
          onSelectHit={handleSelectSearchHit}
        />
      </div>
    </I18nProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MeetBostonApp />
    </ErrorBoundary>
  );
}

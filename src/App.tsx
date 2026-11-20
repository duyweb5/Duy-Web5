import { useEffect, useMemo, useState } from 'react';
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
  SiteConfigData,
  checkIsAdminUser,
  subscribePublicCms,
} from './lib/cmsService';
import { auth } from './lib/firebase';
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
import { StayAndPlanSection } from './components/StayAndPlanSection';

const STORAGE_KEY = 'meet-boston-itinerary-v1';

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

function isAdminLocation(): boolean {
  const hash = window.location.hash.toLowerCase().replace(/\/+$/, '');
  const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  return hash === '#admin' || path === '/admin';
}

function MeetBostonApp() {
  const [lang, setLang] = useState<Language>('vi');
  const [viewMode, setViewMode] = useState<'public' | 'admin'>(() =>
    isAdminLocation() ? 'admin' : 'public'
  );

  // Firebase Auth + Admin RBAC state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(false);

  // Live CMS Data (falls back smoothly to defaults if Firestore has not been seeded yet)
  const [cmsSiteConfig, setCmsSiteConfig] = useState<SiteConfigData | null>(null);
  const [cmsExperiences, setCmsExperiences] = useState<CmsExperience[] | null>(null);
  const [cmsNeighborhoods, setCmsNeighborhoods] = useState<CmsNeighborhood[] | null>(
    null
  );
  const [cmsEvents, setCmsEvents] = useState<CmsEvent[] | null>(null);
  const [cmsHotels, setCmsHotels] = useState<CmsHotel[] | null>(null);

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

  // Sync #admin hash and /admin path navigation
  useEffect(() => {
    const onRouteChange = () => {
      if (isAdminLocation()) {
        setViewMode('admin');
      } else if (viewMode === 'admin') {
        setViewMode('public');
      }
    };
    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('popstate', onRouteChange);
    return () => {
      window.removeEventListener('hashchange', onRouteChange);
      window.removeEventListener('popstate', onRouteChange);
    };
  }, [viewMode]);

  // Listen to Firebase Authentication
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }
      setCheckingAdmin(true);
      try {
        const allowed = await checkIsAdminUser(
          nextUser.uid,
          nextUser.email,
          nextUser.emailVerified
        );
        setIsAdmin(allowed);
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    });
    return unsub;
  }, []);

  // Subscribe to public published CMS content in real time
  useEffect(() => {
    if (viewMode !== 'public') return;
    const unsub = subscribePublicCms({
      onSiteConfig: setCmsSiteConfig,
      onExperiences: setCmsExperiences,
      onNeighborhoods: setCmsNeighborhoods,
      onEvents: setCmsEvents,
      onHotels: setCmsHotels,
    });
    return unsub;
  }, [viewMode]);

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
    window.location.hash = '#admin';
    setViewMode('admin');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const exitAdminCms = () => {
    if (isAdminLocation()) {
      window.history.replaceState(null, '', '/');
    }
    setViewMode('public');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (viewMode === 'admin') {
    return (
      <CmsAdminWorkspace
        user={user}
        authReady={authReady}
        isAdmin={isAdmin}
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
      setSelectedNeighborhoodId(hit.id);
      document
        .querySelector('#neighborhoods')
        ?.scrollIntoView({ behavior: 'smooth' });
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

  return (
    <div className="min-h-screen bg-white text-[#0F1B2B]">
      <Navbar
        lang={lang}
        savedCount={savedItems.length}
        onOpenItinerary={() => setItineraryOpen(true)}
      />

      <main>
        <HeroSection
          lang={lang}
          siteConfig={siteConfig}
          experiences={experiences}
          neighborhoods={neighborhoods}
          events={events}
          hotels={hotels}
          onChangeLang={setLang}
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
          />
        )}

        {siteConfig.showEvents && (
          <EventsSection
            lang={lang}
            items={events}
            savedIds={savedIds}
            onToggleSaveEvent={handleToggleEvent}
            onSelectEvent={(item) => setDetailTarget({ kind: 'event', item })}
          />
        )}

        {siteConfig.showStay && (
          <StayAndPlanSection
            lang={lang}
            hotels={hotels}
            showMeetings={siteConfig.showMeetings}
            savedIds={savedIds}
            onToggleSaveHotel={handleToggleHotel}
            onSelectHotel={(item) => setDetailTarget({ kind: 'hotel', item })}
            onOpenMeetingsModal={() => setMeetingsOpen(true)}
          />
        )}
      </main>

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
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MeetBostonApp />
    </ErrorBoundary>
  );
}

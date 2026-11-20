import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  COPY,
  EVENTS,
  EXPERIENCES,
  EventItem,
  ExperienceCategory,
  ExperienceItem,
  HOTELS,
  HotelItem,
  IMAGES,
  Language,
  NEIGHBORHOODS,
  NeighborhoodItem,
} from '../data/bostonData';
import { OperationType, db, handleFirestoreError } from './firebase';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'duyweb5@gmail.com';
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SiteStatConfig {
  value: string;
  labelVi: string;
  labelEn: string;
}

export interface SiteConfigData {
  kickerVi: string;
  kickerEn: string;
  headlineVi: string;
  headlineEn: string;
  subheadVi: string;
  subheadEn: string;
  heroImage: string;
  visitorCenterAddress: string;
  visitorCenterHours: string;
  footerAboutVi: string;
  footerAboutEn: string;
  showExplore: boolean;
  showNeighborhoods: boolean;
  showEvents: boolean;
  showStay: boolean;
  showMeetings: boolean;
  stats: SiteStatConfig[];
  updatedBy?: string;
  updatedAt?: Timestamp | null;
}

export interface CmsExperience extends ExperienceItem {
  published: boolean;
  sortOrder: number;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CmsNeighborhood extends NeighborhoodItem {
  published: boolean;
  sortOrder: number;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CmsEvent extends EventItem {
  published: boolean;
  sortOrder: number;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface CmsHotel extends HotelItem {
  published: boolean;
  sortOrder: number;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface GuideLeadRecord {
  id: string;
  email: string;
  source: 'visitor_guide' | 'newsletter';
  lang: Language;
  status: 'new' | 'contacted' | 'archived';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface MeetingRfpRecord {
  id: string;
  organization: string;
  email: string;
  guests: string;
  timeframe: string;
  notes: string;
  status: 'new' | 'reviewing' | 'responded' | 'archived';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'editor';
  addedBy: string;
  createdAt?: Timestamp | null;
}

export const PRESET_GALLERY_IMAGES = [
  { label: 'Boston Skyline & Charles River', url: IMAGES.heroSkyline },
  { label: 'Beacon Hill Acorn Street', url: IMAGES.beaconHill },
  { label: 'Seaport Harborwalk', url: IMAGES.seaport },
  { label: 'North End Culinary Table', url: IMAGES.northEndDining },
  { label: 'Freedom Trail Old State House', url: IMAGES.freedomTrail },
  { label: 'Back Bay Luxury Suite', url: IMAGES.luxuryHotel },
];

export const DEFAULT_SITE_CONFIG: SiteConfigData = {
  kickerVi: COPY.vi.hero.kicker,
  kickerEn: COPY.en.hero.kicker,
  headlineVi: COPY.vi.hero.headline,
  headlineEn: COPY.en.hero.headline,
  subheadVi: COPY.vi.hero.subhead,
  subheadEn: COPY.en.hero.subhead,
  heroImage: IMAGES.heroSkyline,
  visitorCenterAddress: COPY.vi.footer.visitorCenterAddress,
  visitorCenterHours: COPY.vi.footer.visitorCenterHours,
  footerAboutVi: COPY.vi.footer.about,
  footerAboutEn: COPY.en.footer.about,
  showExplore: true,
  showNeighborhoods: true,
  showEvents: true,
  showStay: true,
  showMeetings: true,
  stats: COPY.vi.hero.stats.map((s, idx) => ({
    value: s.value,
    labelVi: s.label,
    labelEn: COPY.en.hero.stats[idx]?.label || s.label,
  })),
};

export const DEFAULT_CMS_EXPERIENCES: CmsExperience[] = EXPERIENCES.map(
  (item, idx) => ({
    ...item,
    featured: Boolean(item.featured),
    published: true,
    sortOrder: idx + 1,
  })
);

export const DEFAULT_CMS_NEIGHBORHOODS: CmsNeighborhood[] = NEIGHBORHOODS.map(
  (item, idx) => ({
    ...item,
    published: true,
    sortOrder: idx + 1,
  })
);

export const DEFAULT_CMS_EVENTS: CmsEvent[] = EVENTS.map((item, idx) => ({
  ...item,
  published: true,
  sortOrder: idx + 1,
}));

export const DEFAULT_CMS_HOTELS: CmsHotel[] = HOTELS.map((item, idx) => ({
  ...item,
  published: true,
  sortOrder: idx + 1,
}));

function clampStr(val: string, maxLen: number, fallback = ''): string {
  const trimmed = (val ?? '').trim();
  const safe = trimmed.length > 0 ? trimmed : fallback;
  return safe.slice(0, maxLen);
}

export function generateSafeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

// -----------------------------------------------------------------------------
// Firestore Mappers (Flatten bilingual fields to match firebase-blueprint.json)
// -----------------------------------------------------------------------------
function fromDocExperience(id: string, d: Record<string, unknown>): CmsExperience {
  return {
    id,
    category: (d.category as ExperienceCategory) || 'history',
    featured: Boolean(d.featured),
    published: Boolean(d.published),
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    title: { vi: String(d.titleVi || ''), en: String(d.titleEn || '') },
    summary: { vi: String(d.summaryVi || ''), en: String(d.summaryEn || '') },
    description: {
      vi: String(d.descriptionVi || ''),
      en: String(d.descriptionEn || ''),
    },
    insiderTip: {
      vi: String(d.insiderTipVi || ''),
      en: String(d.insiderTipEn || ''),
    },
    district: String(d.district || ''),
    duration: {
      vi: String(d.durationVi || ''),
      en: String(d.durationEn || ''),
    },
    hours: String(d.hours || ''),
    price: { vi: String(d.priceVi || ''), en: String(d.priceEn || '') },
    address: String(d.address || ''),
    transit: String(d.transit || ''),
    image: String(d.image || IMAGES.freedomTrail),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  };
}

function fromDocNeighborhood(
  id: string,
  d: Record<string, unknown>
): CmsNeighborhood {
  const rawPicks = Array.isArray(d.topPicks) ? d.topPicks : [];
  return {
    id,
    name: String(d.name || ''),
    published: Boolean(d.published),
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    tagline: { vi: String(d.taglineVi || ''), en: String(d.taglineEn || '') },
    description: {
      vi: String(d.descriptionVi || ''),
      en: String(d.descriptionEn || ''),
    },
    transit: String(d.transit || ''),
    vibe: { vi: String(d.vibeVi || ''), en: String(d.vibeEn || '') },
    walkScore: typeof d.walkScore === 'number' ? d.walkScore : 90,
    image: String(d.image || IMAGES.beaconHill),
    topPicks: rawPicks.map((p: Record<string, unknown>) => ({
      name: String(p.name || ''),
      category: {
        vi: String(p.categoryVi || ''),
        en: String(p.categoryEn || ''),
      },
      note: { vi: String(p.noteVi || ''), en: String(p.noteEn || '') },
    })),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  };
}

function fromDocEvent(id: string, d: Record<string, unknown>): CmsEvent {
  return {
    id,
    dayNum: String(d.dayNum || '01'),
    monthLabel: {
      vi: String(d.monthLabelVi || 'THG 11'),
      en: String(d.monthLabelEn || 'NOV'),
    },
    fullDate: {
      vi: String(d.fullDateVi || ''),
      en: String(d.fullDateEn || ''),
    },
    timeframe: (d.timeframe as 'week' | 'month' | 'holiday') || 'month',
    category:
      (d.category as 'arts' | 'sports' | 'festival' | 'exhibition') || 'arts',
    published: Boolean(d.published),
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    title: { vi: String(d.titleVi || ''), en: String(d.titleEn || '') },
    venue: String(d.venue || ''),
    district: String(d.district || ''),
    time: String(d.time || ''),
    price: { vi: String(d.priceVi || ''), en: String(d.priceEn || '') },
    description: {
      vi: String(d.descriptionVi || ''),
      en: String(d.descriptionEn || ''),
    },
    image: String(d.image || IMAGES.seaport),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  };
}

function fromDocHotel(id: string, d: Record<string, unknown>): CmsHotel {
  return {
    id,
    name: String(d.name || ''),
    district: String(d.district || ''),
    neighborhoodKey:
      (d.neighborhoodKey as 'back-bay' | 'seaport' | 'beacon-hill') ||
      'back-bay',
    published: Boolean(d.published),
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    style: { vi: String(d.styleVi || ''), en: String(d.styleEn || '') },
    rateUsd: typeof d.rateUsd === 'number' ? d.rateUsd : 350,
    rating: String(d.rating || '4.8'),
    summary: { vi: String(d.summaryVi || ''), en: String(d.summaryEn || '') },
    description: {
      vi: String(d.descriptionVi || ''),
      en: String(d.descriptionEn || ''),
    },
    address: String(d.address || ''),
    amenities: {
      vi: Array.isArray(d.amenitiesVi) ? d.amenitiesVi.map(String) : [],
      en: Array.isArray(d.amenitiesEn) ? d.amenitiesEn.map(String) : [],
    },
    image: String(d.image || IMAGES.luxuryHotel),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  };
}

function toExperiencePayload(
  item: Omit<CmsExperience, 'id'>,
  uid: string,
  isCreate: boolean
) {
  const base = {
    category: item.category,
    featured: Boolean(item.featured),
    published: Boolean(item.published),
    sortOrder: Math.max(0, Math.min(10000, Number(item.sortOrder) || 0)),
    titleVi: clampStr(item.title.vi, 180, 'Điểm đến Boston'),
    titleEn: clampStr(item.title.en, 180, 'Boston Destination'),
    summaryVi: clampStr(item.summary.vi, 420, 'Khám phá điểm đến tại Boston.'),
    summaryEn: clampStr(item.summary.en, 420, 'Explore this Boston highlight.'),
    descriptionVi: clampStr(item.description.vi, 2000, 'Thông tin chi tiết.'),
    descriptionEn: clampStr(item.description.en, 2000, 'Detailed overview.'),
    insiderTipVi: clampStr(item.insiderTip.vi, 500, ''),
    insiderTipEn: clampStr(item.insiderTip.en, 500, ''),
    district: clampStr(item.district, 100, 'Downtown'),
    durationVi: clampStr(item.duration.vi, 80, '2 giờ'),
    durationEn: clampStr(item.duration.en, 80, '2 hours'),
    hours: clampStr(item.hours, 120, '09:00 – 17:00'),
    priceVi: clampStr(item.price.vi, 120, 'Miễn phí'),
    priceEn: clampStr(item.price.en, 120, 'Free'),
    address: clampStr(item.address, 220, 'Boston, MA'),
    transit: clampStr(item.transit, 160, 'MBTA Green Line'),
    image: clampStr(item.image, 500, IMAGES.freedomTrail),
    updatedAt: serverTimestamp(),
  };

  return isCreate
    ? { ...base, createdBy: uid, createdAt: serverTimestamp() }
    : base;
}

function toNeighborhoodPayload(
  item: Omit<CmsNeighborhood, 'id'>,
  uid: string,
  isCreate: boolean
) {
  const safePicks = (item.topPicks.length > 0
    ? item.topPicks
    : [
        {
          name: 'Local Landmark',
          category: { vi: 'Điểm dừng', en: 'Highlight' },
          note: { vi: 'Điểm tham quan nổi bật', en: 'Must-visit local stop' },
        },
      ]
  )
    .slice(0, 5)
    .map((p) => ({
      name: clampStr(p.name, 120, 'Local Stop'),
      categoryVi: clampStr(p.category.vi, 60, 'Nổi bật'),
      categoryEn: clampStr(p.category.en, 60, 'Highlight'),
      noteVi: clampStr(p.note.vi, 260, 'Trải nghiệm bản địa'),
      noteEn: clampStr(p.note.en, 260, 'Local experience'),
    }));

  const base = {
    name: clampStr(item.name, 100, 'Boston District'),
    published: Boolean(item.published),
    sortOrder: Math.max(0, Math.min(10000, Number(item.sortOrder) || 0)),
    taglineVi: clampStr(item.tagline.vi, 240, 'Khu phố đặc trưng tại Boston'),
    taglineEn: clampStr(item.tagline.en, 240, 'Signature Boston neighborhood'),
    descriptionVi: clampStr(item.description.vi, 1500, 'Mô tả khu phố.'),
    descriptionEn: clampStr(item.description.en, 1500, 'Neighborhood overview.'),
    transit: clampStr(item.transit, 160, 'MBTA'),
    vibeVi: clampStr(item.vibe.vi, 120, 'Kiến trúc · Bản địa'),
    vibeEn: clampStr(item.vibe.en, 120, 'Architecture · Local'),
    walkScore: Math.max(0, Math.min(100, Math.round(Number(item.walkScore) || 90))),
    image: clampStr(item.image, 500, IMAGES.beaconHill),
    topPicks: safePicks,
    updatedAt: serverTimestamp(),
  };

  return isCreate
    ? { ...base, createdBy: uid, createdAt: serverTimestamp() }
    : base;
}

function toEventPayload(
  item: Omit<CmsEvent, 'id'>,
  uid: string,
  isCreate: boolean
) {
  const base = {
    dayNum: clampStr(item.dayNum, 4, '01'),
    monthLabelVi: clampStr(item.monthLabel.vi, 20, 'THG 12'),
    monthLabelEn: clampStr(item.monthLabel.en, 20, 'DEC'),
    fullDateVi: clampStr(item.fullDate.vi, 80, '01 Tháng 12, 2026'),
    fullDateEn: clampStr(item.fullDate.en, 80, 'December 1, 2026'),
    timeframe: item.timeframe,
    category: item.category,
    published: Boolean(item.published),
    sortOrder: Math.max(0, Math.min(10000, Number(item.sortOrder) || 0)),
    titleVi: clampStr(item.title.vi, 180, 'Sự kiện tại Boston'),
    titleEn: clampStr(item.title.en, 180, 'Boston Event'),
    venue: clampStr(item.venue, 180, 'Boston Common'),
    district: clampStr(item.district, 100, 'Downtown'),
    time: clampStr(item.time, 60, '18:00 – 21:00'),
    priceVi: clampStr(item.price.vi, 100, 'Miễn phí'),
    priceEn: clampStr(item.price.en, 100, 'Free'),
    descriptionVi: clampStr(item.description.vi, 1500, 'Chi tiết sự kiện.'),
    descriptionEn: clampStr(item.description.en, 1500, 'Event details.'),
    image: clampStr(item.image, 500, IMAGES.seaport),
    updatedAt: serverTimestamp(),
  };

  return isCreate
    ? { ...base, createdBy: uid, createdAt: serverTimestamp() }
    : base;
}

function toHotelPayload(
  item: Omit<CmsHotel, 'id'>,
  uid: string,
  isCreate: boolean
) {
  const amenitiesVi = (item.amenities.vi.length > 0 ? item.amenities.vi : ['Wi-Fi miễn phí'])
    .slice(0, 10)
    .map((a) => clampStr(a, 100, 'Tiện nghi'));
  const amenitiesEn = (item.amenities.en.length > 0 ? item.amenities.en : ['Complimentary Wi-Fi'])
    .slice(0, 10)
    .map((a) => clampStr(a, 100, 'Amenity'));

  const base = {
    name: clampStr(item.name, 140, 'Boston Hotel'),
    district: clampStr(item.district, 100, 'Back Bay'),
    neighborhoodKey: item.neighborhoodKey,
    published: Boolean(item.published),
    sortOrder: Math.max(0, Math.min(10000, Number(item.sortOrder) || 0)),
    styleVi: clampStr(item.style.vi, 100, 'Boutique'),
    styleEn: clampStr(item.style.en, 100, 'Boutique'),
    rateUsd: Math.max(10, Math.min(25000, Math.round(Number(item.rateUsd) || 320))),
    rating: clampStr(item.rating, 10, '4.8'),
    summaryVi: clampStr(item.summary.vi, 420, 'Khách sạn trung tâm Boston.'),
    summaryEn: clampStr(item.summary.en, 420, 'Central Boston stay.'),
    descriptionVi: clampStr(item.description.vi, 1500, 'Mô tả khách sạn.'),
    descriptionEn: clampStr(item.description.en, 1500, 'Hotel overview.'),
    address: clampStr(item.address, 220, 'Boston, MA'),
    amenitiesVi,
    amenitiesEn,
    image: clampStr(item.image, 500, IMAGES.luxuryHotel),
    updatedAt: serverTimestamp(),
  };

  return isCreate
    ? { ...base, createdBy: uid, createdAt: serverTimestamp() }
    : base;
}

// -----------------------------------------------------------------------------
// Admin Access Check
// -----------------------------------------------------------------------------
export type ResolvedAdminRole = 'superAdmin' | 'admin' | 'editor' | null;

export function emailToAdminId(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export async function resolveAdminRole(
  uid: string,
  email: string | null,
  emailVerified: boolean
): Promise<ResolvedAdminRole> {
  if (!emailVerified) return null;
  const normalizedEmail = email?.trim().toLowerCase() || '';
  if (normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL) return 'superAdmin';

  try {
    // 1. Check UID-keyed admin record
    const uidSnap = await getDoc(doc(db, 'admins', uid));
    if (uidSnap.exists()) {
      const role = uidSnap.data()?.role;
      return role === 'editor' ? 'editor' : 'admin';
    }

    // 2. Check email-keyed pre-approved admin record
    if (normalizedEmail) {
      const emailDocId = emailToAdminId(normalizedEmail);
      const emailSnap = await getDoc(doc(db, 'admins', emailDocId));
      if (
        emailSnap.exists() &&
        String(emailSnap.data()?.email || '').toLowerCase() === normalizedEmail
      ) {
        const role = emailSnap.data()?.role;
        return role === 'editor' ? 'editor' : 'admin';
      }
    }

    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `admins/${uid}`);
  }
}

export async function checkIsAdminUser(
  uid: string,
  email: string | null,
  emailVerified: boolean
): Promise<boolean> {
  const role = await resolveAdminRole(uid, email, emailVerified);
  return role !== null;
}

// -----------------------------------------------------------------------------
// Live Subscriptions
// -----------------------------------------------------------------------------
export interface PublicCmsCallbacks {
  onSiteConfig: (config: SiteConfigData | null) => void;
  onExperiences: (items: CmsExperience[]) => void;
  onNeighborhoods: (items: CmsNeighborhood[]) => void;
  onEvents: (items: CmsEvent[]) => void;
  onHotels: (items: CmsHotel[]) => void;
}

export function subscribePublicCms(cb: PublicCmsCallbacks): () => void {
  const unsubs: (() => void)[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'siteConfig', 'main'),
      (snap) => {
        cb.onSiteConfig(snap.exists() ? (snap.data() as SiteConfigData) : null);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'siteConfig/main')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'experiences'), where('published', '==', true)),
      (snap) => {
        const list = snap.docs
          .map((d) => fromDocExperience(d.id, d.data()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        cb.onExperiences(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'experiences')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'neighborhoods'), where('published', '==', true)),
      (snap) => {
        const list = snap.docs
          .map((d) => fromDocNeighborhood(d.id, d.data()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        cb.onNeighborhoods(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'neighborhoods')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'events'), where('published', '==', true)),
      (snap) => {
        const list = snap.docs
          .map((d) => fromDocEvent(d.id, d.data()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        cb.onEvents(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'events')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'hotels'), where('published', '==', true)),
      (snap) => {
        const list = snap.docs
          .map((d) => fromDocHotel(d.id, d.data()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        cb.onHotels(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'hotels')
    )
  );

  return () => unsubs.forEach((u) => u());
}

export interface AdminCmsCallbacks extends PublicCmsCallbacks {
  onGuideLeads: (leads: GuideLeadRecord[]) => void;
  onMeetingRfps: (rfps: MeetingRfpRecord[]) => void;
}

export function subscribeAdminCms(cb: AdminCmsCallbacks): () => void {
  const unsubs: (() => void)[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, 'siteConfig', 'main'),
      (snap) => {
        cb.onSiteConfig(snap.exists() ? (snap.data() as SiteConfigData) : null);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'siteConfig/main')
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'experiences'),
      (snap) => {
        const list = snap.docs
          .map((d) => fromDocExperience(d.id, d.data()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        cb.onExperiences(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'experiences')
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'neighborhoods'),
      (snap) => {
        const list = snap.docs
          .map((d) => fromDocNeighborhood(d.id, d.data()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        cb.onNeighborhoods(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'neighborhoods')
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'events'),
      (snap) => {
        const list = snap.docs
          .map((d) => fromDocEvent(d.id, d.data()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        cb.onEvents(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'events')
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'hotels'),
      (snap) => {
        const list = snap.docs
          .map((d) => fromDocHotel(d.id, d.data()))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        cb.onHotels(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'hotels')
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'guideLeads'),
      (snap) => {
        const leads: GuideLeadRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              email: String(data.email || ''),
              source:
                (data.source as 'visitor_guide' | 'newsletter') ||
                'visitor_guide',
              lang: (data.lang as Language) || 'vi',
              status:
                (data.status as 'new' | 'contacted' | 'archived') || 'new',
              createdAt: (data.createdAt as Timestamp | null) ?? null,
              updatedAt: (data.updatedAt as Timestamp | null) ?? null,
            };
          })
          .sort(
            (a, b) =>
              (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
          );
        cb.onGuideLeads(leads);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'guideLeads')
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, 'meetingRfps'),
      (snap) => {
        const rfps: MeetingRfpRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              organization: String(data.organization || ''),
              email: String(data.email || ''),
              guests: String(data.guests || ''),
              timeframe: String(data.timeframe || ''),
              notes: String(data.notes || ''),
              status:
                (data.status as
                  | 'new'
                  | 'reviewing'
                  | 'responded'
                  | 'archived') || 'new',
              createdAt: (data.createdAt as Timestamp | null) ?? null,
              updatedAt: (data.updatedAt as Timestamp | null) ?? null,
            };
          })
          .sort(
            (a, b) =>
              (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
          );
        cb.onMeetingRfps(rfps);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'meetingRfps')
    )
  );

  return () => unsubs.forEach((u) => u());
}

// -----------------------------------------------------------------------------
// Admin CMS Mutations
// -----------------------------------------------------------------------------
export async function saveSiteConfig(config: SiteConfigData, uid: string) {
  const path = 'siteConfig/main';
  const safeStats = (config.stats.length > 0 ? config.stats : DEFAULT_SITE_CONFIG.stats)
    .slice(0, 4)
    .map((s) => ({
      value: clampStr(s.value, 24, '0'),
      labelVi: clampStr(s.labelVi, 120, 'Thông số'),
      labelEn: clampStr(s.labelEn, 120, 'Metric'),
    }));

  const payload = {
    kickerVi: clampStr(config.kickerVi, 160, DEFAULT_SITE_CONFIG.kickerVi),
    kickerEn: clampStr(config.kickerEn, 160, DEFAULT_SITE_CONFIG.kickerEn),
    headlineVi: clampStr(config.headlineVi, 180, DEFAULT_SITE_CONFIG.headlineVi),
    headlineEn: clampStr(config.headlineEn, 180, DEFAULT_SITE_CONFIG.headlineEn),
    subheadVi: clampStr(config.subheadVi, 500, DEFAULT_SITE_CONFIG.subheadVi),
    subheadEn: clampStr(config.subheadEn, 500, DEFAULT_SITE_CONFIG.subheadEn),
    heroImage: clampStr(config.heroImage, 500, IMAGES.heroSkyline),
    visitorCenterAddress: clampStr(
      config.visitorCenterAddress,
      220,
      DEFAULT_SITE_CONFIG.visitorCenterAddress
    ),
    visitorCenterHours: clampStr(
      config.visitorCenterHours,
      120,
      DEFAULT_SITE_CONFIG.visitorCenterHours
    ),
    footerAboutVi: clampStr(
      config.footerAboutVi,
      450,
      DEFAULT_SITE_CONFIG.footerAboutVi
    ),
    footerAboutEn: clampStr(
      config.footerAboutEn,
      450,
      DEFAULT_SITE_CONFIG.footerAboutEn
    ),
    showExplore: Boolean(config.showExplore),
    showNeighborhoods: Boolean(config.showNeighborhoods),
    showEvents: Boolean(config.showEvents),
    showStay: Boolean(config.showStay),
    showMeetings: Boolean(config.showMeetings),
    stats: safeStats,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'siteConfig', 'main'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveExperience(
  existingItem: CmsExperience | null,
  draft: Omit<CmsExperience, 'id'>,
  uid: string
) {
  const id = existingItem ? existingItem.id : generateSafeDocId('exp');
  const path = `experiences/${id}`;
  const isCreate = !existingItem;
  const payload = toExperiencePayload(draft, uid, isCreate);
  try {
    if (isCreate) {
      await setDoc(doc(db, 'experiences', id), payload);
    } else {
      await updateDoc(doc(db, 'experiences', id), payload);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isCreate ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deleteExperience(id: string) {
  const path = `experiences/${id}`;
  try {
    await deleteDoc(doc(db, 'experiences', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveNeighborhood(
  existingItem: CmsNeighborhood | null,
  draft: Omit<CmsNeighborhood, 'id'>,
  uid: string
) {
  const id = existingItem ? existingItem.id : generateSafeDocId('nb');
  const path = `neighborhoods/${id}`;
  const isCreate = !existingItem;
  const payload = toNeighborhoodPayload(draft, uid, isCreate);
  try {
    if (isCreate) {
      await setDoc(doc(db, 'neighborhoods', id), payload);
    } else {
      await updateDoc(doc(db, 'neighborhoods', id), payload);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isCreate ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deleteNeighborhood(id: string) {
  const path = `neighborhoods/${id}`;
  try {
    await deleteDoc(doc(db, 'neighborhoods', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveEvent(
  existingItem: CmsEvent | null,
  draft: Omit<CmsEvent, 'id'>,
  uid: string
) {
  const id = existingItem ? existingItem.id : generateSafeDocId('evt');
  const path = `events/${id}`;
  const isCreate = !existingItem;
  const payload = toEventPayload(draft, uid, isCreate);
  try {
    if (isCreate) {
      await setDoc(doc(db, 'events', id), payload);
    } else {
      await updateDoc(doc(db, 'events', id), payload);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isCreate ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deleteEvent(id: string) {
  const path = `events/${id}`;
  try {
    await deleteDoc(doc(db, 'events', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveHotel(
  existingItem: CmsHotel | null,
  draft: Omit<CmsHotel, 'id'>,
  uid: string
) {
  const id = existingItem ? existingItem.id : generateSafeDocId('htl');
  const path = `hotels/${id}`;
  const isCreate = !existingItem;
  const payload = toHotelPayload(draft, uid, isCreate);
  try {
    if (isCreate) {
      await setDoc(doc(db, 'hotels', id), payload);
    } else {
      await updateDoc(doc(db, 'hotels', id), payload);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isCreate ? OperationType.CREATE : OperationType.UPDATE,
      path
    );
  }
}

export async function deleteHotel(id: string) {
  const path = `hotels/${id}`;
  try {
    await deleteDoc(doc(db, 'hotels', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedDefaultCmsContent(uid: string) {
  try {
    const batch = writeBatch(db);

    batch.set(doc(db, 'siteConfig', 'main'), {
      ...DEFAULT_SITE_CONFIG,
      updatedBy: uid,
      updatedAt: serverTimestamp(),
    });

    for (const exp of DEFAULT_CMS_EXPERIENCES) {
      batch.set(
        doc(db, 'experiences', exp.id),
        toExperiencePayload(exp, uid, true)
      );
    }

    for (const nb of DEFAULT_CMS_NEIGHBORHOODS) {
      batch.set(
        doc(db, 'neighborhoods', nb.id),
        toNeighborhoodPayload(nb, uid, true)
      );
    }

    for (const evt of DEFAULT_CMS_EVENTS) {
      batch.set(doc(db, 'events', evt.id), toEventPayload(evt, uid, true));
    }

    for (const htl of DEFAULT_CMS_HOTELS) {
      batch.set(doc(db, 'hotels', htl.id), toHotelPayload(htl, uid, true));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-seed');
  }
}

// -----------------------------------------------------------------------------
// Public Lead Submissions & Admin Lead Management
// -----------------------------------------------------------------------------
export async function submitGuideLead(
  email: string,
  source: 'visitor_guide' | 'newsletter',
  lang: Language
) {
  const safeEmail = clampStr(email.toLowerCase(), 160);
  if (!EMAIL_REGEX.test(safeEmail)) {
    throw new Error('Invalid email format');
  }
  const id = generateSafeDocId('lead');
  const path = `guideLeads/${id}`;
  try {
    await setDoc(doc(db, 'guideLeads', id), {
      email: safeEmail,
      source,
      lang,
      status: 'new',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function submitMeetingRfp(input: {
  organization: string;
  email: string;
  guests: string;
  timeframe: string;
  notes: string;
}) {
  const safeEmail = clampStr(input.email.toLowerCase(), 160);
  const safeOrg = clampStr(input.organization, 180);
  if (safeOrg.length < 2 || !EMAIL_REGEX.test(safeEmail)) {
    throw new Error('Invalid organization or email');
  }
  const id = generateSafeDocId('rfp');
  const path = `meetingRfps/${id}`;
  try {
    await setDoc(doc(db, 'meetingRfps', id), {
      organization: safeOrg,
      email: safeEmail,
      guests: clampStr(input.guests, 40, '150 - 500'),
      timeframe: clampStr(input.timeframe, 40, 'Q2 2027'),
      notes: clampStr(input.notes, 1200, ''),
      status: 'new',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateGuideLeadStatus(
  id: string,
  status: 'new' | 'contacted' | 'archived'
) {
  const path = `guideLeads/${id}`;
  try {
    await updateDoc(doc(db, 'guideLeads', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteGuideLead(id: string) {
  const path = `guideLeads/${id}`;
  try {
    await deleteDoc(doc(db, 'guideLeads', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateMeetingRfpStatus(
  id: string,
  status: 'new' | 'reviewing' | 'responded' | 'archived'
) {
  const path = `meetingRfps/${id}`;
  try {
    await updateDoc(doc(db, 'meetingRfps', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMeetingRfp(id: string) {
  const path = `meetingRfps/${id}`;
  try {
    await deleteDoc(doc(db, 'meetingRfps', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -----------------------------------------------------------------------------
// Admin Allowlist Management (Super Admin only)
// -----------------------------------------------------------------------------
const SAFE_UID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function subscribeAdminUsers(
  onAdmins: (admins: AdminUserRecord[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'admins'),
    (snap) => {
      const list: AdminUserRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: String(data.email || ''),
            displayName: String(data.displayName || ''),
            role: (data.role as 'admin' | 'editor') || 'admin',
            addedBy: String(data.addedBy || ''),
            createdAt: (data.createdAt as Timestamp | null) ?? null,
          };
        })
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
        );
      onAdmins(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'admins')
  );
}

export async function saveAdminUser(
  input: {
    uid?: string;
    email: string;
    displayName: string;
    role: 'admin' | 'editor';
  },
  addedByUid: string
) {
  const safeEmail = clampStr(input.email.toLowerCase(), 160);
  const safeName = clampStr(input.displayName, 120);

  if (!EMAIL_REGEX.test(safeEmail)) {
    throw new Error('Địa chỉ email không hợp lệ.');
  }
  if (safeName.length < 1) {
    throw new Error('Vui lòng nhập tên hiển thị.');
  }

  const targetDocId = input.uid?.trim()
    ? input.uid.trim()
    : emailToAdminId(safeEmail);

  if (!SAFE_UID_REGEX.test(targetDocId)) {
    throw new Error('Mã định danh quản trị viên không hợp lệ.');
  }

  const path = `admins/${targetDocId}`;
  try {
    await setDoc(doc(db, 'admins', targetDocId), {
      email: safeEmail,
      displayName: safeName,
      role: input.role,
      addedBy: addedByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAdminUser(uid: string) {
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}


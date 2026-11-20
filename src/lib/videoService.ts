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
import { OperationType, db, handleFirestoreError } from './firebase';

export const SAMPLE_YOUTUBE_CHANNEL_URL =
  'https://www.youtube.com/channel/UCamcyJiCcgHge0T9hW95ocA';

export interface VideoChannelRecord {
  id: string;
  youtubeChannelId: string;
  handle: string;
  url: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  avatarUrl: string;
  ctaEnabled: boolean;
  ctaTitleVi: string;
  ctaTitleEn: string;
  ctaSubtitleVi: string;
  ctaSubtitleEn: string;
  ctaButtonLabelVi: string;
  ctaButtonLabelEn: string;
  ctaButtonUrl: string;
  published: boolean;
  videoCount: number;
  lastSyncedAt: string;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface VideoTopicRecord {
  id: string;
  channelId: string;
  youtubePlaylistId: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  slug: string;
  sortOrder: number;
  published: boolean;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface VideoItemRecord {
  id: string;
  channelId: string;
  topicId: string;
  youtubeId: string;
  channelName: string;
  thumbnail: string;
  duration: string;
  durationSeconds: number;
  publishedDate: string;
  viewCount: number;
  rawTitle: string;
  rawDescription: string;
  titleVi: string;
  titleEn: string;
  summaryVi: string;
  summaryEn: string;
  descriptionVi: string;
  descriptionEn: string;
  highlightsVi: string[];
  highlightsEn: string[];
  seoTitleVi: string;
  seoTitleEn: string;
  seoDescriptionVi: string;
  seoDescriptionEn: string;
  slugVi: string;
  slugEn: string;
  keywordsVi: string[];
  keywordsEn: string[];
  status: 'draft' | 'published';
  aiStatus: 'pending' | 'optimized' | 'manual';
  manuallyEdited: boolean;
  featured: boolean;
  sortOrder: number;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface VideoGlossaryTermRecord {
  id: string;
  sourceTerm: string;
  targetVi: string;
  targetEn: string;
  keepOriginal: boolean;
  notes: string;
  createdBy?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface YouTubeImportPayload {
  channel: {
    youtubeChannelId: string;
    handle: string;
    url: string;
    title: string;
    description: string;
    avatarUrl: string;
    sourceMode: 'youtube_api_v3' | 'public_metadata';
  };
  playlists: Array<{
    youtubePlaylistId: string;
    title: string;
    description: string;
    videoCount: number;
    videoIds: string[];
  }>;
  videos: Array<{
    youtubeId: string;
    channelId: string;
    channelName: string;
    title: string;
    description: string;
    thumbnail: string;
    duration: string;
    durationSeconds: number;
    publishedDate: string;
    viewCount: number;
    playlistIds: string[];
  }>;
  stats: {
    playlistsFound: number;
    videosFound: number;
    mode: 'youtube_api_v3' | 'public_metadata';
  };
}

export interface OptimizedVideoAIResult {
  detectedSourceLang: 'vi' | 'en';
  titleVi: string;
  titleEn: string;
  summaryVi: string;
  summaryEn: string;
  descriptionVi: string;
  descriptionEn: string;
  highlightsVi: string[];
  highlightsEn: string[];
  seoTitleVi: string;
  seoTitleEn: string;
  seoDescriptionVi: string;
  seoDescriptionEn: string;
  slugVi: string;
  slugEn: string;
  keywordsVi: string[];
  keywordsEn: string[];
  suggestedTopicId: string;
}

export interface TranslatedTopicAIItem {
  id: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  slug: string;
}

export function slugifyVideoText(input: string, fallback = 'video'): string {
  const cleaned = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
  return cleaned || fallback;
}

export function sanitizeFirestoreId(raw: string, prefix: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return `${prefix}${clean || Date.now().toString(36)}`;
}

// Default starter showcase seeded from the user's real channel "Lang Thang Boston"
// Used immediately on public pages until Admin syncs custom data into Firestore
export const DEFAULT_VIDEO_CHANNELS: VideoChannelRecord[] = [
  {
    id: 'ch_UCamcyJiCcgHge0T9hW95ocA',
    youtubeChannelId: 'UCamcyJiCcgHge0T9hW95ocA',
    handle: '@langthangboston',
    url: SAMPLE_YOUTUBE_CHANNEL_URL,
    titleVi: 'Lang Thang Boston',
    titleEn: 'Lang Thang Boston',
    descriptionVi:
      'Góc nhìn chân thực về du lịch Boston, ẩm thực New England, đời sống tại Hoa Kỳ và trải nghiệm du học từ người Việt sống tại Boston.',
    descriptionEn:
      'Authentic Vietnamese-led perspectives on exploring Boston, New England cuisine, everyday life in the U.S., and student experiences in Greater Boston.',
    avatarUrl: '',
    ctaEnabled: true,
    ctaTitleVi: 'Lên lịch trình khám phá Boston theo các điểm trong video',
    ctaTitleEn: 'Build your Boston itinerary around these featured stops',
    ctaSubtitleVi:
      'Lưu video yêu thích vào Lịch trình cá nhân hoặc xem danh sách điểm tham quan và khu phố chuẩn bản địa ngay trên Meet Boston.',
    ctaSubtitleEn:
      'Save favorite videos to your personal Trip Planner or browse curated local attractions and neighborhoods across Meet Boston.',
    ctaButtonLabelVi: 'Khám phá Điểm đến',
    ctaButtonLabelEn: 'Explore Attractions',
    ctaButtonUrl: '#explore',
    published: true,
    videoCount: 4,
    lastSyncedAt: '2026-11-20T00:00:00.000Z',
  },
];

export const DEFAULT_VIDEO_TOPICS: VideoTopicRecord[] = [
  {
    id: 'topic_PLsryQlFpcABbYCy1Hr6ohAXo3p_BPh-go',
    channelId: 'ch_UCamcyJiCcgHge0T9hW95ocA',
    youtubePlaylistId: 'PLsryQlFpcABbYCy1Hr6ohAXo3p_BPh-go',
    titleVi: 'Du lịch Boston & Nước Mỹ',
    titleEn: 'Boston & U.S. Travel',
    descriptionVi:
      'Hành trình dạo bước các công trình biểu tượng, chợ lịch sử và ẩm thực đặc sản tại Boston và vùng New England.',
    descriptionEn:
      'Guided walks through iconic landmarks, historic markets, and signature culinary stops across Boston and New England.',
    slug: 'du-lich-boston-nuoc-my',
    sortOrder: 0,
    published: true,
  },
  {
    id: 'topic_PLsryQlFpcABa-0l0o2cTSwOBrl8ERZKwV',
    channelId: 'ch_UCamcyJiCcgHge0T9hW95ocA',
    youtubePlaylistId: 'PLsryQlFpcABa-0l0o2cTSwOBrl8ERZKwV',
    titleVi: 'Du học Boston',
    titleEn: 'Studying in Boston',
    descriptionVi:
      'Chia sẻ thực tế về môi trường học thuật, đời sống sinh viên và mẹo thích nghi tại thủ đô giáo dục Hoa Kỳ.',
    descriptionEn:
      'Real-world insights on university campuses, student life, and settling into America’s academic capital.',
    slug: 'du-hoc-boston',
    sortOrder: 1,
    published: true,
  },
  {
    id: 'topic_PLsryQlFpcABa7ku2_ErQE3TKChjoDvxC7',
    channelId: 'ch_UCamcyJiCcgHge0T9hW95ocA',
    youtubePlaylistId: 'PLsryQlFpcABa7ku2_ErQE3TKChjoDvxC7',
    titleVi: 'Cuộc sống tại Mỹ',
    titleEn: 'Life in the United States',
    descriptionVi:
      'Nhịp sống thường nhật, bốn mùa New England và kinh nghiệm sinh hoạt hữu ích tại vùng Greater Boston.',
    descriptionEn:
      'Everyday moments, four New England seasons, and practical living tips across Greater Boston.',
    slug: 'cuoc-song-tai-my',
    sortOrder: 2,
    published: true,
  },
];

export const DEFAULT_VIDEOS: VideoItemRecord[] = [
  {
    id: 'yt_FQtcP8QJtTQ',
    channelId: 'ch_UCamcyJiCcgHge0T9hW95ocA',
    topicId: 'topic_PLsryQlFpcABbYCy1Hr6ohAXo3p_BPh-go',
    youtubeId: 'FQtcP8QJtTQ',
    channelName: 'Lang Thang Boston',
    thumbnail: 'https://i.ytimg.com/vi/FQtcP8QJtTQ/hqdefault.jpg',
    duration: '12:40',
    durationSeconds: 760,
    publishedDate: '2026-11-17T01:16:30+00:00',
    viewCount: 1450,
    rawTitle:
      'Check in Boston City Hall & Thưởng thức Đặc sản ở Quincy Market',
    rawDescription:
      'Khám phá Boston City Hall với kiến trúc độc đáo và Quincy Market – khu chợ nổi tiếng nhộn nhịp cùng đặc sản Lobster Roll, Clam Chowder.',
    titleVi:
      'Check-in Boston City Hall & Thưởng thức Đặc sản tại Quincy Market',
    titleEn:
      'Exploring Boston City Hall & Tasting Iconic Eats at Quincy Market',
    summaryVi:
      'Dạo bước trung tâm Boston qua quảng trường City Hall đầy ấn tượng và thưởng thức bánh mì tôm hùm Lobster Roll cùng súp nghêu Clam Chowder trứ danh tại Quincy Market.',
    summaryEn:
      'Stroll through downtown Boston from architectural City Hall Plaza to bustling Quincy Market for classic New England Lobster Rolls and creamy Clam Chowder.',
    descriptionVi:
      'Có dịp ghé thăm trung tâm Boston, bạn không nên bỏ qua Boston City Hall với kiến trúc Brutalist đặc trưng và khu chợ lịch sử Quincy Market luôn sôi động sắc màu. Video dẫn bạn dạo quanh những góc check-in nổi bật nhất khu Downtown và trải nghiệm bộ đôi ẩm thực biểu tượng của New England: Lobster Roll béo thơm cùng bát súp nghêu Clam Chowder nóng hổi.',
    descriptionEn:
      'When visiting downtown Boston, pair a walk past the bold Brutalist architecture of Boston City Hall with the lively halls of historic Quincy Market. This vlog highlights top photo vantage points and essential New England culinary classics including buttered Lobster Rolls, rich Clam Chowder, and fresh smoothies.',
    highlightsVi: [
      'Góc tham quan và chụp ảnh đẹp quanh Boston City Hall Plaza',
      'Khám phá không gian ẩm thực sầm uất bên trong chợ lịch sử Quincy Market',
      'Trải nghiệm thực tế món bánh mì tôm hùm Lobster Roll & súp nghêu Clam Chowder',
    ],
    highlightsEn: [
      'Best walking angles and landmark views around Boston City Hall Plaza',
      'Inside the bustling historic food hall of Faneuil Hall & Quincy Market',
      'Firsthand tasting of New England Lobster Rolls and Clam Chowder',
    ],
    seoTitleVi: 'Boston City Hall & Đặc sản Quincy Market | Video Meet Boston',
    seoTitleEn: 'Boston City Hall & Quincy Market Food Guide | Meet Boston',
    seoDescriptionVi:
      'Xem video thực tế khám phá Boston City Hall và thưởng thức Lobster Roll, Clam Chowder tại chợ lịch sử Quincy Market từ kênh Lang Thang Boston.',
    seoDescriptionEn:
      'Watch a firsthand tour of Boston City Hall and historic Quincy Market featuring New England Lobster Rolls and Clam Chowder.',
    slugVi: 'check-in-boston-city-hall-dac-san-quincy-market',
    slugEn: 'boston-city-hall-and-quincy-market-food-guide',
    keywordsVi: [
      'Boston City Hall',
      'Quincy Market',
      'Lobster Roll Boston',
      'Clam Chowder',
      'du lịch Boston',
    ],
    keywordsEn: [
      'Boston City Hall',
      'Quincy Market',
      'Boston Lobster Roll',
      'New England Clam Chowder',
      'Boston travel vlog',
    ],
    status: 'published',
    aiStatus: 'optimized',
    manuallyEdited: false,
    featured: true,
    sortOrder: 0,
  },
  {
    id: 'yt_9ZrZ67NapE4',
    channelId: 'ch_UCamcyJiCcgHge0T9hW95ocA',
    topicId: 'topic_PLsryQlFpcABa-0l0o2cTSwOBrl8ERZKwV',
    youtubeId: '9ZrZ67NapE4',
    channelName: 'Lang Thang Boston',
    thumbnail: 'https://i.ytimg.com/vi/9ZrZ67NapE4/hqdefault.jpg',
    duration: '11:27',
    durationSeconds: 687,
    publishedDate: '2026-10-12T10:00:00+00:00',
    viewCount: 2180,
    rawTitle: 'Du học Boston — Trải nghiệm thực tế tại thủ đô giáo dục Hoa Kỳ',
    rawDescription:
      'Góc nhìn thực tế về cuộc sống du học sinh, di chuyển và học tập tại khu vực Greater Boston.',
    titleVi: 'Du học Boston: Nhịp sống sinh viên tại thủ đô giáo dục Hoa Kỳ',
    titleEn: 'Studying in Boston: Student Life in America’s Academic Capital',
    summaryVi:
      'Cái nhìn cận cảnh về môi trường học thuật đẳng cấp thế giới, cách di chuyển bằng tàu điện MBTA và kinh nghiệm hòa nhập nhanh cho du học sinh mới đến Boston.',
    summaryEn:
      'An inside look at Greater Boston’s world-class university ecosystem, navigating the MBTA transit network, and settling in smoothly as an international student.',
    descriptionVi:
      'Boston quy tụ hơn 50 trường đại học và cao đẳng danh tiếng bậc nhất thế giới. Tập video chia sẻ trải nghiệm thực tế về đời sống sinh viên, không gian học tập, chi phí sinh hoạt và những lời khuyên hữu ích giúp du học sinh tự tin khám phá thành phố ngay từ học kỳ đầu tiên.',
    descriptionEn:
      'Greater Boston is home to more than 50 renowned colleges and universities. This episode shares practical insights on campus rhythms, public transit commuting, daily living tips, and how newcomers can make the most of their first semester in Boston.',
    highlightsVi: [
      'Bức tranh tổng quan về cộng đồng sinh viên quốc tế tại Greater Boston',
      'Kinh nghiệm di chuyển tiết kiệm và an toàn quanh các khu đại học',
      'Lời khuyên thực tế về thời tiết New England và chi phí sinh hoạt',
    ],
    highlightsEn: [
      'Overview of Greater Boston’s vibrant international student community',
      'Practical tips for commuting safely across university neighborhoods',
      'Essential advice on preparing for New England seasons and student budgets',
    ],
    seoTitleVi: 'Du học Boston: Kinh nghiệm & Cuộc sống sinh viên',
    seoTitleEn: 'Studying in Boston: International Student Life Guide',
    seoDescriptionVi:
      'Khám phá trải nghiệm du học Boston thực tế: môi trường đại học, di chuyển MBTA và mẹo thích nghi cuộc sống sinh viên tại thủ đô giáo dục Mỹ.',
    seoDescriptionEn:
      'Explore authentic student life in Boston including university campuses, MBTA transit tips, and adapting to New England seasons.',
    slugVi: 'du-hoc-boston-nhip-song-sinh-vien',
    slugEn: 'studying-in-boston-student-life-guide',
    keywordsVi: [
      'du học Boston',
      'sinh viên tại Boston',
      'đại học Boston',
      'cuộc sống du học Mỹ',
    ],
    keywordsEn: [
      'study in Boston',
      'Boston student life',
      'Boston universities',
      'Greater Boston guide',
    ],
    status: 'published',
    aiStatus: 'optimized',
    manuallyEdited: false,
    featured: false,
    sortOrder: 1,
  },
];

export const DEFAULT_GLOSSARY_SEED: Array<{
  sourceTerm: string;
  targetVi: string;
  targetEn: string;
  keepOriginal: boolean;
  notes: string;
}> = [
  {
    sourceTerm: 'Freedom Trail',
    targetVi: 'Con đường Tự do (Freedom Trail)',
    targetEn: 'Freedom Trail',
    keepOriginal: false,
    notes: 'Giữ tên tiếng Anh trong ngoặc ở lần nhắc đầu tiên',
  },
  {
    sourceTerm: 'Quincy Market',
    targetVi: 'Chợ Quincy Market',
    targetEn: 'Quincy Market',
    keepOriginal: true,
    notes: 'Địa danh lịch sử tại Faneuil Hall',
  },
  {
    sourceTerm: 'Lobster Roll',
    targetVi: 'Bánh mì tôm hùm Lobster Roll',
    targetEn: 'New England Lobster Roll',
    keepOriginal: false,
    notes: 'Đặc sản hải sản biểu tượng vùng New England',
  },
  {
    sourceTerm: 'Clam Chowder',
    targetVi: 'Súp nghêu Clam Chowder',
    targetEn: 'New England Clam Chowder',
    keepOriginal: false,
    notes: 'Súp nghêu kem đặc trưng của Boston',
  },
  {
    sourceTerm: 'Beacon Hill',
    targetVi: 'Beacon Hill',
    targetEn: 'Beacon Hill',
    keepOriginal: true,
    notes: 'Tên khu phố cổ biểu tượng, luôn giữ nguyên danh từ riêng',
  },
  {
    sourceTerm: 'MBTA',
    targetVi: 'Hệ thống tàu điện MBTA (The T)',
    targetEn: 'MBTA (The T)',
    keepOriginal: false,
    notes: 'Mạng lưới giao thông công cộng Greater Boston',
  },
];

function mapChannelDoc(id: string, d: Record<string, unknown>): VideoChannelRecord {
  return {
    id,
    youtubeChannelId: String(d.youtubeChannelId || ''),
    handle: String(d.handle || ''),
    url: String(d.url || ''),
    titleVi: String(d.titleVi || ''),
    titleEn: String(d.titleEn || ''),
    descriptionVi: String(d.descriptionVi || ''),
    descriptionEn: String(d.descriptionEn || ''),
    avatarUrl: String(d.avatarUrl || ''),
    ctaEnabled: Boolean(d.ctaEnabled),
    ctaTitleVi: String(d.ctaTitleVi || ''),
    ctaTitleEn: String(d.ctaTitleEn || ''),
    ctaSubtitleVi: String(d.ctaSubtitleVi || ''),
    ctaSubtitleEn: String(d.ctaSubtitleEn || ''),
    ctaButtonLabelVi: String(d.ctaButtonLabelVi || ''),
    ctaButtonLabelEn: String(d.ctaButtonLabelEn || ''),
    ctaButtonUrl: String(d.ctaButtonUrl || ''),
    published: Boolean(d.published),
    videoCount: Number(d.videoCount || 0),
    lastSyncedAt: String(d.lastSyncedAt || ''),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  };
}

function mapTopicDoc(id: string, d: Record<string, unknown>): VideoTopicRecord {
  return {
    id,
    channelId: String(d.channelId || ''),
    youtubePlaylistId: String(d.youtubePlaylistId || ''),
    titleVi: String(d.titleVi || ''),
    titleEn: String(d.titleEn || ''),
    descriptionVi: String(d.descriptionVi || ''),
    descriptionEn: String(d.descriptionEn || ''),
    slug: String(d.slug || id),
    sortOrder: Number(d.sortOrder || 0),
    published: Boolean(d.published),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  };
}

function mapVideoDoc(id: string, d: Record<string, unknown>): VideoItemRecord {
  return {
    id,
    channelId: String(d.channelId || ''),
    topicId: String(d.topicId || ''),
    youtubeId: String(d.youtubeId || ''),
    channelName: String(d.channelName || ''),
    thumbnail: String(d.thumbnail || ''),
    duration: String(d.duration || ''),
    durationSeconds: Number(d.durationSeconds || 0),
    publishedDate: String(d.publishedDate || ''),
    viewCount: Number(d.viewCount || 0),
    rawTitle: String(d.rawTitle || ''),
    rawDescription: String(d.rawDescription || ''),
    titleVi: String(d.titleVi || ''),
    titleEn: String(d.titleEn || ''),
    summaryVi: String(d.summaryVi || ''),
    summaryEn: String(d.summaryEn || ''),
    descriptionVi: String(d.descriptionVi || ''),
    descriptionEn: String(d.descriptionEn || ''),
    highlightsVi: Array.isArray(d.highlightsVi) ? d.highlightsVi.map(String) : [],
    highlightsEn: Array.isArray(d.highlightsEn) ? d.highlightsEn.map(String) : [],
    seoTitleVi: String(d.seoTitleVi || ''),
    seoTitleEn: String(d.seoTitleEn || ''),
    seoDescriptionVi: String(d.seoDescriptionVi || ''),
    seoDescriptionEn: String(d.seoDescriptionEn || ''),
    slugVi: String(d.slugVi || id),
    slugEn: String(d.slugEn || id),
    keywordsVi: Array.isArray(d.keywordsVi) ? d.keywordsVi.map(String) : [],
    keywordsEn: Array.isArray(d.keywordsEn) ? d.keywordsEn.map(String) : [],
    status: d.status === 'draft' ? 'draft' : 'published',
    aiStatus:
      d.aiStatus === 'optimized' || d.aiStatus === 'manual'
        ? d.aiStatus
        : 'pending',
    manuallyEdited: Boolean(d.manuallyEdited),
    featured: Boolean(d.featured),
    sortOrder: Number(d.sortOrder || 0),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  };
}

function mapGlossaryDoc(
  id: string,
  d: Record<string, unknown>
): VideoGlossaryTermRecord {
  return {
    id,
    sourceTerm: String(d.sourceTerm || ''),
    targetVi: String(d.targetVi || ''),
    targetEn: String(d.targetEn || ''),
    keepOriginal: Boolean(d.keepOriginal),
    notes: String(d.notes || ''),
    createdBy: typeof d.createdBy === 'string' ? d.createdBy : undefined,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  };
}

// Public real-time subscription (published channels, topics, and videos only)
export function subscribePublicVideoLibrary(handlers: {
  onChannels: (items: VideoChannelRecord[]) => void;
  onTopics: (items: VideoTopicRecord[]) => void;
  onVideos: (items: VideoItemRecord[]) => void;
}): () => void {
  const unsubChannels = onSnapshot(
    query(collection(db, 'videoChannels'), where('published', '==', true)),
    (snap) => {
      handlers.onChannels(
        snap.docs.map((d) => mapChannelDoc(d.id, d.data() as Record<string, unknown>))
      );
    },
    (err) => {
      console.warn('[videoService] public channels subscription:', err.message);
      handlers.onChannels([]);
    }
  );

  const unsubTopics = onSnapshot(
    query(collection(db, 'videoTopics'), where('published', '==', true)),
    (snap) => {
      const items = snap.docs
        .map((d) => mapTopicDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      handlers.onTopics(items);
    },
    (err) => {
      console.warn('[videoService] public topics subscription:', err.message);
      handlers.onTopics([]);
    }
  );

  const unsubVideos = onSnapshot(
    query(collection(db, 'videos'), where('status', '==', 'published')),
    (snap) => {
      const items = snap.docs
        .map((d) => mapVideoDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return a.sortOrder - b.sortOrder;
        });
      handlers.onVideos(items);
    },
    (err) => {
      console.warn('[videoService] public videos subscription:', err.message);
      handlers.onVideos([]);
    }
  );

  return () => {
    unsubChannels();
    unsubTopics();
    unsubVideos();
  };
}

// Admin real-time subscription (all channels, topics, videos including drafts, and AI glossary)
export function subscribeAdminVideoLibrary(handlers: {
  onChannels: (items: VideoChannelRecord[]) => void;
  onTopics: (items: VideoTopicRecord[]) => void;
  onVideos: (items: VideoItemRecord[]) => void;
  onGlossary: (items: VideoGlossaryTermRecord[]) => void;
}): () => void {
  const unsubChannels = onSnapshot(
    collection(db, 'videoChannels'),
    (snap) => {
      handlers.onChannels(
        snap.docs.map((d) => mapChannelDoc(d.id, d.data() as Record<string, unknown>))
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'videoChannels')
  );

  const unsubTopics = onSnapshot(
    collection(db, 'videoTopics'),
    (snap) => {
      const items = snap.docs
        .map((d) => mapTopicDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      handlers.onTopics(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'videoTopics')
  );

  const unsubVideos = onSnapshot(
    collection(db, 'videos'),
    (snap) => {
      const items = snap.docs
        .map((d) => mapVideoDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      handlers.onVideos(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'videos')
  );

  const unsubGlossary = onSnapshot(
    collection(db, 'videoGlossary'),
    (snap) => {
      const items = snap.docs
        .map((d) =>
          mapGlossaryDoc(d.id, d.data() as Record<string, unknown>)
        )
        .sort((a, b) => a.sourceTerm.localeCompare(b.sourceTerm));
      handlers.onGlossary(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'videoGlossary')
  );

  return () => {
    unsubChannels();
    unsubTopics();
    unsubVideos();
    unsubGlossary();
  };
}

// ---------------------------------------------------------------------------
// Server API Bridges (YouTube Importer + Gemini AI)
// ---------------------------------------------------------------------------

export async function fetchYouTubeChannelImport(params: {
  url: string;
  maxPlaylists?: number;
  maxVideosPerPlaylist?: number;
}): Promise<YouTubeImportPayload> {
  const res = await fetch('/api/youtube/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || `YouTube import error (${res.status})`);
  }
  return json as YouTubeImportPayload;
}

export async function requestAiOptimizeVideo(params: {
  youtubeId: string;
  rawTitle: string;
  rawDescription: string;
  channelName: string;
  currentTopicId?: string;
  topics: Array<{ id: string; titleVi: string; titleEn: string }>;
  glossary: VideoGlossaryTermRecord[];
  fetchMissingDescription?: boolean;
}): Promise<{
  optimized: OptimizedVideoAIResult;
  enrichedMetadata: {
    description?: string;
    duration?: string;
    durationSeconds?: number;
    publishedDate?: string;
    viewCount?: number;
  } | null;
}> {
  const res = await fetch('/api/ai/optimize-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      glossary: params.glossary.map((g) => ({
        sourceTerm: g.sourceTerm,
        targetVi: g.targetVi,
        targetEn: g.targetEn,
        keepOriginal: g.keepOriginal,
        notes: g.notes,
      })),
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || `Gemini AI error (${res.status})`);
  }
  return json;
}

export async function requestAiTranslateTopics(params: {
  channelName: string;
  topics: Array<{ id: string; rawTitle: string }>;
  glossary: VideoGlossaryTermRecord[];
}): Promise<TranslatedTopicAIItem[]> {
  const res = await fetch('/api/ai/translate-topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channelName: params.channelName,
      topics: params.topics,
      glossary: params.glossary.map((g) => ({
        sourceTerm: g.sourceTerm,
        targetVi: g.targetVi,
        targetEn: g.targetEn,
        keepOriginal: g.keepOriginal,
        notes: g.notes,
      })),
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || `Gemini AI topics error (${res.status})`);
  }
  return (json.topics || []) as TranslatedTopicAIItem[];
}

// ---------------------------------------------------------------------------
// Firestore Mutations (Strictly Compliant with Blueprint & Hardened Rules)
// ---------------------------------------------------------------------------

function clampStr(v: string | undefined | null, max: number, fallback = ''): string {
  const s = (v ?? fallback).toString().trim();
  return s.slice(0, max);
}

function clampList(arr: string[] | undefined, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s || '').trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

export async function saveVideoChannel(
  data: Omit<VideoChannelRecord, 'createdBy' | 'createdAt' | 'updatedAt'>,
  uid: string
): Promise<void> {
  const id = sanitizeFirestoreId(data.id || data.youtubeChannelId, data.id ? '' : 'ch_');
  const ref = doc(db, 'videoChannels', id);
  try {
    const existing = await getDoc(ref);
    const base = {
      youtubeChannelId: clampStr(data.youtubeChannelId, 120, id),
      handle: clampStr(data.handle, 100),
      url: clampStr(data.url, 300, 'https://www.youtube.com'),
      titleVi: clampStr(data.titleVi, 160, 'Kênh YouTube'),
      titleEn: clampStr(data.titleEn, 160, data.titleVi || 'YouTube Channel'),
      descriptionVi: clampStr(data.descriptionVi, 1200),
      descriptionEn: clampStr(data.descriptionEn, 1200),
      avatarUrl: clampStr(data.avatarUrl, 500),
      ctaEnabled: Boolean(data.ctaEnabled),
      ctaTitleVi: clampStr(data.ctaTitleVi, 180),
      ctaTitleEn: clampStr(data.ctaTitleEn, 180),
      ctaSubtitleVi: clampStr(data.ctaSubtitleVi, 360),
      ctaSubtitleEn: clampStr(data.ctaSubtitleEn, 360),
      ctaButtonLabelVi: clampStr(data.ctaButtonLabelVi, 80),
      ctaButtonLabelEn: clampStr(data.ctaButtonLabelEn, 80),
      ctaButtonUrl: clampStr(data.ctaButtonUrl, 400),
      published: Boolean(data.published),
      videoCount: Math.max(0, Math.min(100000, Math.round(Number(data.videoCount) || 0))),
      lastSyncedAt: clampStr(data.lastSyncedAt, 60),
    };
    if (existing.exists()) {
      await updateDoc(ref, { ...base, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        ...base,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `videoChannels/${id}`);
  }
}

export async function deleteVideoChannel(channelId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'videoChannels', channelId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `videoChannels/${channelId}`);
  }
}

export async function saveVideoTopic(
  data: Omit<VideoTopicRecord, 'createdBy' | 'createdAt' | 'updatedAt'>,
  uid: string
): Promise<void> {
  const id = sanitizeFirestoreId(data.id || data.slug || Date.now().toString(36), '');
  const ref = doc(db, 'videoTopics', id);
  try {
    const existing = await getDoc(ref);
    const base = {
      channelId: clampStr(data.channelId, 128, 'manual'),
      youtubePlaylistId: clampStr(data.youtubePlaylistId, 120),
      titleVi: clampStr(data.titleVi, 140, 'Chủ đề mới'),
      titleEn: clampStr(data.titleEn, 140, data.titleVi || 'New Topic'),
      descriptionVi: clampStr(data.descriptionVi, 420),
      descriptionEn: clampStr(data.descriptionEn, 420),
      slug: slugifyVideoText(data.slug || data.titleEn || data.titleVi, id),
      sortOrder: Math.max(0, Math.min(10000, Math.round(Number(data.sortOrder) || 0))),
      published: Boolean(data.published),
    };
    if (existing.exists()) {
      await updateDoc(ref, { ...base, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        ...base,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `videoTopics/${id}`);
  }
}

export async function deleteVideoTopic(topicId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'videoTopics', topicId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `videoTopics/${topicId}`);
  }
}

export async function saveVideoItem(
  data: Omit<VideoItemRecord, 'createdBy' | 'createdAt' | 'updatedAt'>,
  uid: string
): Promise<void> {
  const id = sanitizeFirestoreId(data.id || `yt_${data.youtubeId}`, '');
  const ref = doc(db, 'videos', id);
  try {
    const existing = await getDoc(ref);
    const titleVi = clampStr(data.titleVi || data.rawTitle, 200, 'Video');
    const titleEn = clampStr(data.titleEn || data.rawTitle, 200, titleVi);
    const base = {
      channelId: clampStr(data.channelId, 128, 'manual'),
      topicId: clampStr(data.topicId, 128),
      youtubeId: clampStr(data.youtubeId, 32),
      channelName: clampStr(data.channelName, 160, 'YouTube'),
      thumbnail: clampStr(
        data.thumbnail || `https://i.ytimg.com/vi/${data.youtubeId}/hqdefault.jpg`,
        500
      ),
      duration: clampStr(data.duration, 24),
      durationSeconds: Math.max(
        0,
        Math.min(86400, Math.round(Number(data.durationSeconds) || 0))
      ),
      publishedDate: clampStr(data.publishedDate, 60),
      viewCount: Math.max(
        0,
        Math.min(2000000000, Math.round(Number(data.viewCount) || 0))
      ),
      rawTitle: clampStr(data.rawTitle || titleVi, 240, titleVi),
      rawDescription: clampStr(data.rawDescription, 5000),
      titleVi,
      titleEn,
      summaryVi: clampStr(data.summaryVi, 480),
      summaryEn: clampStr(data.summaryEn, 480),
      descriptionVi: clampStr(data.descriptionVi, 3000),
      descriptionEn: clampStr(data.descriptionEn, 3000),
      highlightsVi: clampList(data.highlightsVi, 5, 260),
      highlightsEn: clampList(data.highlightsEn, 5, 260),
      seoTitleVi: clampStr(data.seoTitleVi, 120),
      seoTitleEn: clampStr(data.seoTitleEn, 120),
      seoDescriptionVi: clampStr(data.seoDescriptionVi, 260),
      seoDescriptionEn: clampStr(data.seoDescriptionEn, 260),
      slugVi: slugifyVideoText(data.slugVi || titleVi, `video-${data.youtubeId.toLowerCase()}`),
      slugEn: slugifyVideoText(data.slugEn || titleEn, `video-${data.youtubeId.toLowerCase()}`),
      keywordsVi: clampList(data.keywordsVi, 10, 80),
      keywordsEn: clampList(data.keywordsEn, 10, 80),
      status: data.status === 'draft' ? 'draft' : 'published',
      aiStatus:
        data.aiStatus === 'optimized' || data.aiStatus === 'manual'
          ? data.aiStatus
          : 'pending',
      manuallyEdited: Boolean(data.manuallyEdited),
      featured: Boolean(data.featured),
      sortOrder: Math.max(0, Math.min(100000, Math.round(Number(data.sortOrder) || 0))),
    };

    if (existing.exists()) {
      const { youtubeId: _immutableYtId, ...updatable } = base;
      void _immutableYtId;
      await updateDoc(ref, { ...updatable, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        ...base,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `videos/${id}`);
  }
}

export async function deleteVideoItem(videoId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'videos', videoId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `videos/${videoId}`);
  }
}

export async function saveGlossaryTerm(
  data: Omit<VideoGlossaryTermRecord, 'createdBy' | 'createdAt' | 'updatedAt'>,
  uid: string
): Promise<void> {
  const id = sanitizeFirestoreId(
    data.id || `term_${slugifyVideoText(data.sourceTerm, Date.now().toString(36))}`,
    ''
  );
  const ref = doc(db, 'videoGlossary', id);
  try {
    const existing = await getDoc(ref);
    const base = {
      sourceTerm: clampStr(data.sourceTerm, 120, 'Term'),
      targetVi: clampStr(data.targetVi || data.sourceTerm, 140),
      targetEn: clampStr(data.targetEn || data.sourceTerm, 140),
      keepOriginal: Boolean(data.keepOriginal),
      notes: clampStr(data.notes, 300),
    };
    if (existing.exists()) {
      await updateDoc(ref, { ...base, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        ...base,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `videoGlossary/${id}`);
  }
}

export async function deleteGlossaryTerm(termId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'videoGlossary', termId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `videoGlossary/${termId}`);
  }
}

export async function seedDefaultGlossaryTerms(uid: string): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;
  for (const item of DEFAULT_GLOSSARY_SEED) {
    const id = sanitizeFirestoreId(`term_${slugifyVideoText(item.sourceTerm)}`, '');
    const ref = doc(db, 'videoGlossary', id);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      batch.set(ref, {
        sourceTerm: item.sourceTerm,
        targetVi: item.targetVi,
        targetEn: item.targetEn,
        keepOriginal: item.keepOriginal,
        notes: item.notes,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      count++;
    }
  }
  if (count > 0) {
    await batch.commit();
  }
  return count;
}

/**
 * Non-Destructive Incremental Channel Sync:
 * - Creates or updates the channel metadata (preserving custom CTA settings if already configured).
 * - Creates new topics for playlists (preserving already customized topics).
 * - Adds new videos keyed by yt_{youtubeId}, skipping overwrites on any video with manuallyEdited=true or aiStatus='optimized'.
 */
export async function syncImportedChannelToFirestore(params: {
  payload: YouTubeImportPayload;
  existingChannels: VideoChannelRecord[];
  existingTopics: VideoTopicRecord[];
  existingVideos: VideoItemRecord[];
  selectedPlaylistIds: string[];
  defaultStatus: 'draft' | 'published';
  translatedTopics?: TranslatedTopicAIItem[];
  uid: string;
}): Promise<{
  channelId: string;
  topicsAdded: number;
  videosAdded: number;
  videosPreserved: number;
}> {
  const {
    payload,
    existingChannels,
    existingTopics,
    existingVideos,
    selectedPlaylistIds,
    defaultStatus,
    translatedTopics,
    uid,
  } = params;

  const channelDocId = sanitizeFirestoreId(payload.channel.youtubeChannelId, 'ch_');
  const prevChannel = existingChannels.find((c) => c.id === channelDocId);

  await saveVideoChannel(
    {
      id: channelDocId,
      youtubeChannelId: payload.channel.youtubeChannelId,
      handle: payload.channel.handle || prevChannel?.handle || '',
      url: payload.channel.url,
      titleVi: prevChannel?.titleVi || payload.channel.title,
      titleEn: prevChannel?.titleEn || payload.channel.title,
      descriptionVi: prevChannel?.descriptionVi || payload.channel.description,
      descriptionEn: prevChannel?.descriptionEn || payload.channel.description,
      avatarUrl: payload.channel.avatarUrl || prevChannel?.avatarUrl || '',
      ctaEnabled: prevChannel ? prevChannel.ctaEnabled : true,
      ctaTitleVi:
        prevChannel?.ctaTitleVi ||
        'Lên lịch trình khám phá Boston theo các địa điểm trong video',
      ctaTitleEn:
        prevChannel?.ctaTitleEn ||
        'Plan your Boston trip around the places featured in this video',
      ctaSubtitleVi:
        prevChannel?.ctaSubtitleVi ||
        'Lưu video vào Lịch trình cá nhân hoặc khám phá thêm điểm tham quan, khu phố & khách sạn tuyển chọn.',
      ctaSubtitleEn:
        prevChannel?.ctaSubtitleEn ||
        'Save this video to your itinerary or browse curated attractions, neighborhoods, and hotels.',
      ctaButtonLabelVi: prevChannel?.ctaButtonLabelVi || 'Khám phá Điểm đến',
      ctaButtonLabelEn: prevChannel?.ctaButtonLabelEn || 'Explore Boston',
      ctaButtonUrl: prevChannel?.ctaButtonUrl || '#explore',
      published: prevChannel ? prevChannel.published : true,
      videoCount: payload.videos.length,
      lastSyncedAt: new Date().toISOString(),
    },
    uid
  );

  const selectedSet = new Set(selectedPlaylistIds);
  const existingTopicById = new Map(existingTopics.map((t) => [t.id, t]));
  const aiTopicMap = new Map(
    (translatedTopics || []).map((t) => [t.id, t])
  );

  const playlistIdToTopicDocId = new Map<string, string>();
  let topicsAdded = 0;

  const activePlaylists = payload.playlists.filter(
    (pl) => selectedSet.size === 0 || selectedSet.has(pl.youtubePlaylistId)
  );

  for (let i = 0; i < activePlaylists.length; i++) {
    const pl = activePlaylists[i];
    const topicDocId = sanitizeFirestoreId(pl.youtubePlaylistId, 'topic_');
    playlistIdToTopicDocId.set(pl.youtubePlaylistId, topicDocId);

    if (!existingTopicById.has(topicDocId)) {
      const aiLoc = aiTopicMap.get(pl.youtubePlaylistId);
      await saveVideoTopic(
        {
          id: topicDocId,
          channelId: channelDocId,
          youtubePlaylistId: pl.youtubePlaylistId,
          titleVi: aiLoc?.titleVi || pl.title,
          titleEn: aiLoc?.titleEn || pl.title,
          descriptionVi: aiLoc?.descriptionVi || pl.description || '',
          descriptionEn: aiLoc?.descriptionEn || pl.description || '',
          slug: aiLoc?.slug || slugifyVideoText(pl.title, topicDocId),
          sortOrder: existingTopics.length + topicsAdded,
          published: true,
        },
        uid
      );
      topicsAdded++;
    }
  }

  // Fallback general topic if there are videos without a matching selected playlist
  let generalTopicId = '';
  const existingVideoById = new Map(existingVideos.map((v) => [v.id, v]));
  let videosAdded = 0;
  let videosPreserved = 0;

  const filteredVideos = payload.videos.filter((v) => {
    if (selectedSet.size === 0) return true;
    if (v.playlistIds.length === 0) return true;
    return v.playlistIds.some((pid) => selectedSet.has(pid));
  });

  // Process in controlled chunks of 20 using Firestore batches for fast atomic writes
  for (let i = 0; i < filteredVideos.length; i += 20) {
    const chunk = filteredVideos.slice(i, i + 20);
    const batch = writeBatch(db);
    let batchOps = 0;

    for (let j = 0; j < chunk.length; j++) {
      const v = chunk[j];
      const videoDocId = sanitizeFirestoreId(v.youtubeId, 'yt_');
      const existingVid = existingVideoById.get(videoDocId);

      // Find best topicId from selected playlists
      let topicId = '';
      for (const pid of v.playlistIds) {
        const mapped = playlistIdToTopicDocId.get(pid);
        if (mapped) {
          topicId = mapped;
          break;
        }
      }
      if (!topicId && activePlaylists.length === 0) {
        if (!generalTopicId) {
          generalTopicId = sanitizeFirestoreId(`${channelDocId}_general`, 'topic_');
          if (!existingTopicById.has(generalTopicId)) {
            await saveVideoTopic(
              {
                id: generalTopicId,
                channelId: channelDocId,
                youtubePlaylistId: '',
                titleVi: 'Video mới nhất',
                titleEn: 'Latest Videos',
                descriptionVi: `Tuyển tập video nổi bật từ kênh ${payload.channel.title}.`,
                descriptionEn: `Featured videos from ${payload.channel.title}.`,
                slug: 'video-moi-nhat',
                sortOrder: existingTopics.length + topicsAdded,
                published: true,
              },
              uid
            );
            topicsAdded++;
          }
        }
        topicId = generalTopicId;
      }

      if (existingVid) {
        // Non-destructive: NEVER overwrite admin edits or AI-optimized bilingual content
        videosPreserved++;
        continue;
      }

      const cleanTitle = clampStr(v.title, 200, 'Video YouTube');
      const cleanDesc = clampStr(v.description, 3000);
      const ref = doc(db, 'videos', videoDocId);
      batch.set(ref, {
        channelId: channelDocId,
        topicId,
        youtubeId: clampStr(v.youtubeId, 32),
        channelName: clampStr(v.channelName || payload.channel.title, 160),
        thumbnail: clampStr(
          v.thumbnail || `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`,
          500
        ),
        duration: clampStr(v.duration, 24),
        durationSeconds: Math.max(0, Math.min(86400, Math.round(v.durationSeconds || 0))),
        publishedDate: clampStr(v.publishedDate, 60),
        viewCount: Math.max(0, Math.min(2000000000, Math.round(v.viewCount || 0))),
        rawTitle: clampStr(v.title, 240, cleanTitle),
        rawDescription: clampStr(v.description, 5000),
        titleVi: cleanTitle,
        titleEn: cleanTitle,
        summaryVi: cleanDesc.slice(0, 260),
        summaryEn: '',
        descriptionVi: cleanDesc,
        descriptionEn: '',
        highlightsVi: [],
        highlightsEn: [],
        seoTitleVi: cleanTitle.slice(0, 65),
        seoTitleEn: cleanTitle.slice(0, 65),
        seoDescriptionVi: cleanDesc.slice(0, 155),
        seoDescriptionEn: '',
        slugVi: slugifyVideoText(cleanTitle, `video-${v.youtubeId.toLowerCase()}`),
        slugEn: slugifyVideoText(cleanTitle, `video-${v.youtubeId.toLowerCase()}`),
        keywordsVi: [],
        keywordsEn: [],
        status: defaultStatus,
        aiStatus: 'pending',
        manuallyEdited: false,
        featured: existingVideos.length === 0 && videosAdded === 0,
        sortOrder: existingVideos.length + videosAdded,
        createdBy: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batchOps++;
      videosAdded++;
    }

    if (batchOps > 0) {
      await batch.commit();
    }
  }

  return {
    channelId: channelDocId,
    topicsAdded,
    videosAdded,
    videosPreserved,
  };
}

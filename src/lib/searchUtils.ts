import {
  EventItem,
  ExperienceItem,
  HotelItem,
  Language,
  NeighborhoodItem,
} from '../data/bostonData';
import { VideoItemRecord, VideoTopicRecord } from './videoService';

export type UnifiedSearchKind =
  | 'experience'
  | 'neighborhood'
  | 'event'
  | 'hotel'
  | 'video';

export interface UnifiedSearchHit {
  id: string;
  kind: UnifiedSearchKind;
  title: string;
  meta: string;
  href: string;
  thumbnail?: string;
  slug?: string;
  score: number;
}

/**
 * Strips Vietnamese diacritics and normalizes text for forgiving VI/EN search.
 * Example: "Ẩm thực Hải sản Đêm" -> "am thuc hai san dem"
 */
export function normalizeSearchText(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(haystack: string, titleNorm: string, queryNorm: string): number {
  if (!queryNorm) return 0;
  if (titleNorm === queryNorm) return 100;
  if (titleNorm.startsWith(queryNorm)) return 85;
  if (titleNorm.includes(queryNorm)) return 70;
  if (haystack.includes(queryNorm)) return 50;

  const tokens = queryNorm.split(' ').filter((t) => t.length >= 2);
  if (tokens.length > 1 && tokens.every((t) => haystack.includes(t))) {
    return 40;
  }
  return 0;
}

export function buildUnifiedSearchHits(params: {
  query: string;
  scope: 'all' | 'experience' | 'event' | 'hotel' | 'video';
  lang: Language;
  experiences: ExperienceItem[];
  neighborhoods: NeighborhoodItem[];
  events: EventItem[];
  hotels: HotelItem[];
  videos: VideoItemRecord[];
  topics?: VideoTopicRecord[];
  limit?: number;
}): UnifiedSearchHit[] {
  const {
    query,
    scope,
    lang,
    experiences,
    neighborhoods,
    events,
    hotels,
    videos,
    topics = [],
    limit = 8,
  } = params;

  const qNorm = normalizeSearchText(query);
  if (!qNorm) return [];

  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const hits: UnifiedSearchHit[] = [];

  if (scope === 'all' || scope === 'experience') {
    for (const exp of experiences) {
      const titleNorm = normalizeSearchText(`${exp.title.vi} ${exp.title.en}`);
      const hay = normalizeSearchText(
        `${exp.title.vi} ${exp.title.en} ${exp.summary.vi} ${exp.summary.en} ${exp.district} ${exp.address}`
      );
      const score = scoreMatch(hay, titleNorm, qNorm);
      if (score > 0) {
        hits.push({
          id: exp.id,
          kind: 'experience',
          title: exp.title[lang],
          meta: `${exp.district} · ${exp.duration[lang]}`,
          href: '#explore',
          thumbnail: exp.image,
          score,
        });
      }
    }

    for (const nb of neighborhoods) {
      const picksText = nb.topPicks.map((p) => p.name).join(' ');
      const titleNorm = normalizeSearchText(nb.name);
      const hay = normalizeSearchText(
        `${nb.name} ${nb.tagline.vi} ${nb.tagline.en} ${nb.description.vi} ${nb.description.en} ${nb.vibe.vi} ${nb.vibe.en} ${picksText}`
      );
      const score = scoreMatch(hay, titleNorm, qNorm);
      if (score > 0) {
        hits.push({
          id: nb.id,
          kind: 'neighborhood',
          title: nb.name,
          meta: nb.vibe[lang],
          href: '#neighborhoods',
          thumbnail: nb.image,
          score,
        });
      }
    }
  }

  if (scope === 'all' || scope === 'event') {
    for (const evt of events) {
      const titleNorm = normalizeSearchText(`${evt.title.vi} ${evt.title.en}`);
      const hay = normalizeSearchText(
        `${evt.title.vi} ${evt.title.en} ${evt.venue} ${evt.district} ${evt.description.vi} ${evt.description.en}`
      );
      const score = scoreMatch(hay, titleNorm, qNorm);
      if (score > 0) {
        hits.push({
          id: evt.id,
          kind: 'event',
          title: evt.title[lang],
          meta: `${evt.fullDate[lang]} · ${evt.district}`,
          href: '#events',
          thumbnail: evt.image,
          score,
        });
      }
    }
  }

  if (scope === 'all' || scope === 'hotel') {
    for (const htl of hotels) {
      const titleNorm = normalizeSearchText(htl.name);
      const hay = normalizeSearchText(
        `${htl.name} ${htl.district} ${htl.style.vi} ${htl.style.en} ${htl.summary.vi} ${htl.summary.en}`
      );
      const score = scoreMatch(hay, titleNorm, qNorm);
      if (score > 0) {
        hits.push({
          id: htl.id,
          kind: 'hotel',
          title: htl.name,
          meta: `${htl.district} · $${htl.rateUsd}`,
          href: '#stay',
          thumbnail: htl.image,
          score,
        });
      }
    }
  }

  if (scope === 'all' || scope === 'video') {
    for (const vid of videos) {
      const topic = vid.topicId ? topicMap.get(vid.topicId) : undefined;
      const displayTitle =
        lang === 'vi'
          ? vid.titleVi || vid.rawTitle
          : vid.titleEn || vid.titleVi || vid.rawTitle;
      const slug =
        lang === 'vi' ? vid.slugVi || vid.id : vid.slugEn || vid.slugVi || vid.id;
      const titleNorm = normalizeSearchText(
        `${vid.titleVi} ${vid.titleEn} ${vid.rawTitle}`
      );
      const hay = normalizeSearchText(
        [
          vid.titleVi,
          vid.titleEn,
          vid.rawTitle,
          vid.summaryVi,
          vid.summaryEn,
          vid.channelName,
          topic?.titleVi || '',
          topic?.titleEn || '',
          ...vid.keywordsVi,
          ...vid.keywordsEn,
        ].join(' ')
      );
      const score = scoreMatch(hay, titleNorm, qNorm);
      if (score > 0) {
        hits.push({
          id: vid.id,
          kind: 'video',
          title: displayTitle,
          meta: [
            topic ? (lang === 'vi' ? topic.titleVi : topic.titleEn || topic.titleVi) : vid.channelName,
            vid.duration || (lang === 'vi' ? 'Video YouTube' : 'YouTube Video'),
          ]
            .filter(Boolean)
            .join(' · '),
          href: `/videos/${slug}`,
          thumbnail:
            vid.thumbnail ||
            `https://i.ytimg.com/vi/${vid.youtubeId}/hqdefault.jpg`,
          slug,
          score,
        });
      }
    }
  }

  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Smart Cross-Linking: finds videos most relevant to a given Boston neighborhood.
 * Uses neighborhood name + landmark top-picks against bilingual video metadata,
 * falling back cleanly to featured/general Boston videos if no direct keyword match exists.
 */
export function findRelatedVideosForNeighborhood(
  neighborhood: NeighborhoodItem,
  videos: VideoItemRecord[],
  limit = 2
): { items: VideoItemRecord[]; isDirectMatch: boolean } {
  if (!videos.length) return { items: [], isDirectMatch: false };

  const keywords = [
    normalizeSearchText(neighborhood.name),
    ...neighborhood.topPicks.map((p) => normalizeSearchText(p.name)),
  ].filter((k) => k.length >= 3);

  const scored = videos.map((vid) => {
    const hay = normalizeSearchText(
      [
        vid.titleVi,
        vid.titleEn,
        vid.rawTitle,
        vid.summaryVi,
        vid.summaryEn,
        vid.descriptionVi,
        vid.descriptionEn,
        ...vid.keywordsVi,
        ...vid.keywordsEn,
      ].join(' ')
    );

    let score = 0;
    for (let i = 0; i < keywords.length; i++) {
      if (hay.includes(keywords[i])) {
        score += i === 0 ? 10 : 5;
      }
    }
    return { vid, score };
  });

  const matched = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.vid);

  if (matched.length > 0) {
    return { items: matched, isDirectMatch: true };
  }

  // Fallback: top featured or newest Boston videos
  const fallback = [...videos]
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, limit);
  return { items: fallback, isDirectMatch: false };
}

/**
 * Smart Cross-Linking: finds Boston neighborhoods & experiences related to the active video.
 */
export function findRelatedPlacesForVideo(params: {
  video: VideoItemRecord | null;
  neighborhoods: NeighborhoodItem[];
  experiences: ExperienceItem[];
  hotels: HotelItem[];
}): {
  neighborhoods: NeighborhoodItem[];
  experiences: ExperienceItem[];
  hotels: HotelItem[];
} {
  const { video, neighborhoods, experiences, hotels } = params;
  if (!video) {
    return { neighborhoods: [], experiences: [], hotels: [] };
  }

  const hay = normalizeSearchText(
    [
      video.titleVi,
      video.titleEn,
      video.rawTitle,
      video.summaryVi,
      video.summaryEn,
      video.descriptionVi,
      video.descriptionEn,
      ...video.keywordsVi,
      ...video.keywordsEn,
    ].join(' ')
  );

  const matchedNeighborhoods = neighborhoods
    .filter((nb) => {
      const nbNorm = normalizeSearchText(nb.name);
      if (nbNorm && hay.includes(nbNorm)) return true;
      return nb.topPicks.some((p) => {
        const pn = normalizeSearchText(p.name);
        return pn.length >= 4 && hay.includes(pn);
      });
    })
    .slice(0, 2);

  const matchedExperiences = experiences
    .filter((exp) => {
      const distNorm = normalizeSearchText(exp.district);
      const titleNorm = normalizeSearchText(`${exp.title.vi} ${exp.title.en}`);
      if (distNorm.length >= 4 && hay.includes(distNorm)) return true;
      return titleNorm
        .split(' ')
        .filter((w) => w.length >= 5)
        .some((w) => hay.includes(w));
    })
    .slice(0, 2);

  const matchedHotels = hotels
    .filter((htl) => {
      const distNorm = normalizeSearchText(htl.district);
      return distNorm.length >= 4 && hay.includes(distNorm);
    })
    .slice(0, 1);

  return {
    neighborhoods:
      matchedNeighborhoods.length > 0
        ? matchedNeighborhoods
        : neighborhoods.slice(0, 2),
    experiences:
      matchedExperiences.length > 0
        ? matchedExperiences
        : experiences.slice(0, 2),
    hotels: matchedHotels.length > 0 ? matchedHotels : hotels.slice(0, 1),
  };
}

import { Language } from '../data/bostonData';
import { VideoItemRecord } from './videoService';

const VIDEO_JSONLD_ID = 'meet-boston-video-schema';

function secondsToIso8601(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'PT5M';
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  let out = 'PT';
  if (h > 0) out += `${h}H`;
  if (m > 0) out += `${m}M`;
  if (s > 0 || (h === 0 && m === 0)) out += `${s}S`;
  return out;
}

function setMetaTag(selector: string, attrName: string, attrValue: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Injects Schema.org VideoObject JSON-LD and updates page meta/OpenGraph tags
 * for the currently playing video (especially valuable on /videos and /videos/:slug).
 */
export function applyVideoSeoMetadata(params: {
  video: VideoItemRecord | null;
  lang: Language;
  isDedicatedPage: boolean;
}): () => void {
  const { video, lang, isDedicatedPage } = params;
  const prevTitle = document.title;
  const prevDesc =
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content || '';

  // Remove old script first
  const oldScript = document.getElementById(VIDEO_JSONLD_ID);
  if (oldScript) oldScript.remove();

  if (!video) {
    return () => {};
  }

  const title =
    lang === 'vi'
      ? video.seoTitleVi || video.titleVi || video.rawTitle
      : video.seoTitleEn || video.titleEn || video.titleVi || video.rawTitle;
  const description =
    lang === 'vi'
      ? video.seoDescriptionVi || video.summaryVi || video.descriptionVi || title
      : video.seoDescriptionEn ||
        video.summaryEn ||
        video.descriptionEn ||
        video.summaryVi ||
        title;
  const keywords = lang === 'vi' ? video.keywordsVi : video.keywordsEn;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: lang === 'vi' ? video.titleVi : video.titleEn || video.titleVi,
    description: description.slice(0, 300),
    thumbnailUrl: [
      `https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`,
      video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`,
    ],
    uploadDate: video.publishedDate || new Date().toISOString(),
    duration: secondsToIso8601(video.durationSeconds),
    embedUrl: `https://www.youtube-nocookie.com/embed/${video.youtubeId}`,
    contentUrl: `https://www.youtube.com/watch?v=${video.youtubeId}`,
    inLanguage: lang,
    keywords: keywords.join(', '),
    publisher: {
      '@type': 'Organization',
      name: 'Meet Boston',
    },
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = VIDEO_JSONLD_ID;
  script.textContent = JSON.stringify(jsonLd);
  document.head.appendChild(script);

  if (isDedicatedPage) {
    document.title = `${title} — Meet Boston`;
    setMetaTag('meta[name="description"]', 'name', 'description', description.slice(0, 160));
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
    setMetaTag(
      'meta[property="og:description"]',
      'property',
      'og:description',
      description.slice(0, 160)
    );
    setMetaTag(
      'meta[property="og:image"]',
      'property',
      'og:image',
      video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`
    );
  }

  return () => {
    const existing = document.getElementById(VIDEO_JSONLD_ID);
    if (existing) existing.remove();
    if (isDedicatedPage) {
      document.title = prevTitle;
      if (prevDesc) {
        setMetaTag('meta[name="description"]', 'name', 'description', prevDesc);
      }
    }
  };
}

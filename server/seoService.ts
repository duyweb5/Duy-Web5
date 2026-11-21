import type { Request } from 'express';
import { getAdminDb } from './firebaseAdmin.js';

interface CachedSeoSnapshot {
  fetchedAt: number;
  siteName: string;
  headlineVi: string;
  subheadVi: string;
  heroImage: string;
  videos: Array<{
    id: string;
    youtubeId: string;
    titleVi: string;
    titleEn: string;
    summaryVi: string;
    summaryEn: string;
    seoTitleVi: string;
    seoTitleEn: string;
    seoDescriptionVi: string;
    seoDescriptionEn: string;
    slugVi: string;
    slugEn: string;
    thumbnail: string;
    durationSeconds: number;
    publishedDate: string;
    keywordsVi: string[];
    keywordsEn: string[];
    channelName: string;
  }>;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let seoCache: CachedSeoSnapshot | null = null;

const FALLBACK_SITE = {
  siteName: 'Meet Boston',
  headlineVi: 'Meet Boston — Khám Phá Thành Phố Không Bao Giờ Cũ',
  subheadVi:
    'Cổng thông tin du lịch song ngữ Greater Boston: điểm tham quan, khu phố biểu tượng, sự kiện, lưu trú, lập lịch trình và thư viện video thực tế.',
  heroImage: '',
};

function escapeHtmlAttr(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

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

/**
 * Domain-agnostic canonical base URL resolver.
 * Priority:
 * 1. Explicit PUBLIC_APP_URL env var (pins a single primary domain, e.g. https://langthangbostone.com)
 * 2. Incoming custom domain header (X-Forwarded-Host / Host) when it is a real public custom domain (not localhost / *.run.app)
 * 3. APP_URL env var (Cloud Run / AI Studio runtime URL)
 * 4. Fallback to incoming request host
 */
export function resolveCanonicalBaseUrl(req: Request): string {
  const pinnedPublicUrl = (process.env.PUBLIC_APP_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (
    pinnedPublicUrl &&
    pinnedPublicUrl.startsWith('http') &&
    !pinnedPublicUrl.includes('MY_APP_URL')
  ) {
    return pinnedPublicUrl;
  }

  const rawHost = (req.header('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  const hostNoPort = rawHost.split(':')[0].toLowerCase();
  const isLocal =
    !hostNoPort ||
    hostNoPort === 'localhost' ||
    hostNoPort.startsWith('127.0.0.1');
  const isRunApp = hostNoPort.endsWith('.run.app');

  if (!isLocal && !isRunApp) {
    const rawProto = (req.header('x-forwarded-proto') || req.protocol || 'https')
      .split(',')[0]
      .trim();
    const proto = rawProto === 'http' ? 'https' : rawProto;
    return `${proto}://${rawHost}`.replace(/\/+$/, '');
  }

  const appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (appUrl && appUrl.startsWith('http') && !appUrl.includes('MY_APP_URL')) {
    return appUrl;
  }

  if (rawHost) {
    return `${isLocal ? 'http' : 'https'}://${rawHost}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

async function getSeoSnapshot(): Promise<CachedSeoSnapshot> {
  const now = Date.now();
  if (seoCache && now - seoCache.fetchedAt < CACHE_TTL_MS) {
    return seoCache;
  }

  const snapshot: CachedSeoSnapshot = {
    fetchedAt: now,
    siteName: FALLBACK_SITE.siteName,
    headlineVi: FALLBACK_SITE.headlineVi,
    subheadVi: FALLBACK_SITE.subheadVi,
    heroImage: FALLBACK_SITE.heroImage,
    videos: [],
  };

  try {
    const db = getAdminDb();

    const [siteSnap, videosSnap] = await Promise.all([
      db.collection('siteConfig').doc('main').get().catch(() => null),
      db
        .collection('videos')
        .where('status', '==', 'published')
        .limit(250)
        .get()
        .catch(() => null),
    ]);

    if (siteSnap?.exists) {
      const d = siteSnap.data() || {};
      if (typeof d.headlineVi === 'string' && d.headlineVi.trim()) {
        snapshot.headlineVi = `${d.headlineVi.trim()} — Meet Boston`;
      }
      if (typeof d.subheadVi === 'string' && d.subheadVi.trim()) {
        snapshot.subheadVi = d.subheadVi.trim();
      }
      if (
        typeof d.heroImage === 'string' &&
        d.heroImage.startsWith('https://')
      ) {
        snapshot.heroImage = d.heroImage;
      }
    }

    if (videosSnap && !videosSnap.empty) {
      snapshot.videos = videosSnap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          youtubeId: String(d.youtubeId || ''),
          titleVi: String(d.titleVi || d.rawTitle || ''),
          titleEn: String(d.titleEn || d.titleVi || d.rawTitle || ''),
          summaryVi: String(d.summaryVi || d.descriptionVi || ''),
          summaryEn: String(d.summaryEn || d.descriptionEn || ''),
          seoTitleVi: String(d.seoTitleVi || d.titleVi || d.rawTitle || ''),
          seoTitleEn: String(d.seoTitleEn || d.titleEn || d.titleVi || ''),
          seoDescriptionVi: String(
            d.seoDescriptionVi || d.summaryVi || d.descriptionVi || ''
          ),
          seoDescriptionEn: String(
            d.seoDescriptionEn || d.summaryEn || d.descriptionEn || ''
          ),
          slugVi: String(d.slugVi || doc.id),
          slugEn: String(d.slugEn || d.slugVi || doc.id),
          thumbnail: String(
            d.thumbnail ||
              (d.youtubeId
                ? `https://i.ytimg.com/vi/${d.youtubeId}/hqdefault.jpg`
                : '')
          ),
          durationSeconds: Number(d.durationSeconds || 0),
          publishedDate: String(d.publishedDate || ''),
          keywordsVi: Array.isArray(d.keywordsVi)
            ? d.keywordsVi.map(String)
            : [],
          keywordsEn: Array.isArray(d.keywordsEn)
            ? d.keywordsEn.map(String)
            : [],
          channelName: String(d.channelName || 'Meet Boston'),
        };
      });
    }
  } catch {
    // Graceful fallback when Admin SDK IAM is not yet active in local preview
  }

  seoCache = snapshot;
  return snapshot;
}

export function clearSeoCache(): void {
  seoCache = null;
}

export function generateRobotsTxt(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${cleanBase}/sitemap.xml`,
    '',
  ].join('\n');
}

export async function generateSitemapXml(baseUrl: string): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const snapshot = await getSeoSnapshot();
  const todayIso = new Date().toISOString().slice(0, 10);

  const urls: string[] = [
    `  <url>
    <loc>${escapeXml(cleanBase)}/</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
    `  <url>
    <loc>${escapeXml(cleanBase)}/videos</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`,
  ];

  const seenSlugs = new Set<string>();
  for (const v of snapshot.videos) {
    const slug = (v.slugVi || v.id).trim();
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const loc = `${cleanBase}/videos/${encodeURIComponent(slug)}`;
    const thumb =
      v.thumbnail || `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg`;
    const title = (v.seoTitleVi || v.titleVi || 'Boston Video').slice(0, 100);
    const desc = (
      v.seoDescriptionVi ||
      v.summaryVi ||
      v.titleVi ||
      'Boston travel video guide'
    ).slice(0, 2000);
    const lastmod =
      v.publishedDate && /^\d{4}-\d{2}-\d{2}/.test(v.publishedDate)
        ? v.publishedDate.slice(0, 10)
        : todayIso;

    const videoBlock = v.youtubeId
      ? `
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumb)}</video:thumbnail_loc>
      <video:title>${escapeXml(title)}</video:title>
      <video:description>${escapeXml(desc)}</video:description>
      <video:player_loc>https://www.youtube-nocookie.com/embed/${escapeXml(v.youtubeId)}</video:player_loc>${
        v.durationSeconds > 0
          ? `\n      <video:duration>${Math.min(28800, Math.floor(v.durationSeconds))}</video:duration>`
          : ''
      }
    </video:video>`
      : '';

    urls.push(`  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${videoBlock}
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls.join('\n')}
</urlset>
`;
}

/**
 * Injects route-aware SEO metadata, Canonical URL, OpenGraph, Twitter Card,
 * and Schema.org JSON-LD into index.html before serving to browsers & crawlers.
 */
export async function injectDynamicSeoHtml(
  htmlTemplate: string,
  req: Request
): Promise<string> {
  const baseUrl = resolveCanonicalBaseUrl(req);
  const reqPath = (req.path || '/').replace(/\/+$/, '') || '/';
  const lowerPath = reqPath.toLowerCase();

  // Never index admin pages
  if (lowerPath === '/admin' || lowerPath.startsWith('/admin/')) {
    const adminMeta = `<meta name="robots" content="noindex, nofollow" />`;
    return htmlTemplate.replace('<!--SEO_HEAD_META-->', adminMeta);
  }

  const snapshot = await getSeoSnapshot();

  let pageTitle = snapshot.headlineVi;
  let pageDesc = snapshot.subheadVi.slice(0, 160);
  let canonicalUrl = `${baseUrl}${reqPath === '/' ? '/' : reqPath}`;
  let ogType = 'website';
  let ogImage = snapshot.heroImage;
  const schemas: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: snapshot.siteName,
      url: `${baseUrl}/`,
      inLanguage: ['vi', 'en'],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'TouristDestination',
      name: 'Greater Boston, Massachusetts',
      description: snapshot.subheadVi,
      url: `${baseUrl}/`,
      touristType: ['Cultural Tourism', 'Food Tourism', 'Family Travel', 'Business & Meetings'],
    },
  ];

  if (lowerPath === '/videos') {
    pageTitle = `Thư viện Video Du lịch Boston — ${snapshot.siteName}`;
    pageDesc =
      'Khám phá Boston qua thư viện video YouTube thực tế, phân loại theo chủ đề và tối ưu song ngữ Việt – Anh.';
    canonicalUrl = `${baseUrl}/videos`;
    if (snapshot.videos[0]?.thumbnail) {
      ogImage = snapshot.videos[0].thumbnail;
    }
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: pageTitle,
      description: pageDesc,
      url: canonicalUrl,
    });
  } else if (lowerPath.startsWith('/videos/')) {
    const rawSlug = decodeURIComponent(reqPath.slice('/videos/'.length)).toLowerCase();
    const matched = snapshot.videos.find(
      (v) =>
        v.slugVi.toLowerCase() === rawSlug ||
        v.slugEn.toLowerCase() === rawSlug ||
        v.youtubeId.toLowerCase() === rawSlug ||
        v.id.toLowerCase() === rawSlug
    );

    if (matched) {
      const seoTitle = matched.seoTitleVi || matched.titleVi;
      const seoDesc = (
        matched.seoDescriptionVi ||
        matched.summaryVi ||
        matched.titleVi
      ).slice(0, 160);
      pageTitle = `${seoTitle} — ${snapshot.siteName}`;
      pageDesc = seoDesc;
      canonicalUrl = `${baseUrl}/videos/${encodeURIComponent(matched.slugVi || matched.id)}`;
      ogType = 'video.other';
      ogImage =
        matched.thumbnail ||
        `https://i.ytimg.com/vi/${matched.youtubeId}/maxresdefault.jpg`;

      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: matched.titleVi,
        description: seoDesc,
        thumbnailUrl: [
          `https://i.ytimg.com/vi/${matched.youtubeId}/maxresdefault.jpg`,
          ogImage,
        ],
        uploadDate: matched.publishedDate || new Date().toISOString(),
        duration: secondsToIso8601(matched.durationSeconds),
        embedUrl: `https://www.youtube-nocookie.com/embed/${matched.youtubeId}`,
        contentUrl: `https://www.youtube.com/watch?v=${matched.youtubeId}`,
        url: canonicalUrl,
        inLanguage: 'vi',
        keywords: matched.keywordsVi.join(', '),
        publisher: {
          '@type': 'Organization',
          name: snapshot.siteName,
          url: `${baseUrl}/`,
        },
      });
    }
  }

  const metaLines: string[] = [
    `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    `<meta property="og:site_name" content="${escapeHtmlAttr(snapshot.siteName)}" />`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(pageTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(pageDesc)}" />`,
  ];

  if (ogImage) {
    metaLines.push(
      `<meta property="og:image" content="${escapeHtmlAttr(ogImage)}" />`,
      `<meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}" />`
    );
  }

  const jsonLdScripts = schemas
    .map(
      (s) =>
        `<script type="application/ld+json">${safeJsonLd(s)}</script>`
    )
    .join('\n    ');

  let out = htmlTemplate;
  out = out.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlAttr(pageTitle)}</title>`
  );
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtmlAttr(pageDesc)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtmlAttr(pageTitle)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtmlAttr(pageDesc)}" />`
  );
  out = out.replace(
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtmlAttr(ogType)}" />`
  );

  if (out.includes('<!--SEO_HEAD_META-->')) {
    out = out.replace(
      '<!--SEO_HEAD_META-->',
      `${metaLines.join('\n    ')}\n    ${jsonLdScripts}`
    );
  } else {
    out = out.replace(
      '</head>',
      `    ${metaLines.join('\n    ')}\n    ${jsonLdScripts}\n  </head>`
    );
  }

  return out;
}

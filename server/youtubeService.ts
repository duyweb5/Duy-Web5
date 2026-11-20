export interface ImportedYouTubeChannel {
  youtubeChannelId: string;
  handle: string;
  url: string;
  title: string;
  description: string;
  avatarUrl: string;
  sourceMode: 'youtube_api_v3' | 'public_metadata';
}

export interface ImportedYouTubePlaylist {
  youtubePlaylistId: string;
  title: string;
  description: string;
  videoCount: number;
  videoIds: string[];
}

export interface ImportedYouTubeVideo {
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
}

export interface YouTubeImportResult {
  channel: ImportedYouTubeChannel;
  playlists: ImportedYouTubePlaylist[];
  videos: ImportedYouTubeVideo[];
  stats: {
    playlistsFound: number;
    videosFound: number;
    mode: 'youtube_api_v3' | 'public_metadata';
  };
}

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  Cookie: 'CONSENT=YES+cb.20240101-01-p0.en+FX+999',
};

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

export function formatSecondsToDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '';
  const sec = Math.floor(totalSeconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseDurationToSeconds(durationText: string): number {
  if (!durationText) return 0;
  const trimmed = durationText.trim();
  // ISO-8601 PT#H#M#S
  const isoMatch = trimmed.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (isoMatch) {
    const h = Number(isoMatch[1] || 0);
    const m = Number(isoMatch[2] || 0);
    const s = Number(isoMatch[3] || 0);
    return h * 3600 + m * 60 + s;
  }
  // mm:ss or hh:mm:ss
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function extractBalancedJson(html: string, marker: string): unknown | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx + marker.length);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractYtInitialData(html: string): Record<string, unknown> | null {
  const parsed =
    extractBalancedJson(html, 'var ytInitialData =') ||
    extractBalancedJson(html, 'window["ytInitialData"] =') ||
    extractBalancedJson(html, 'ytInitialData =');
  return parsed && typeof parsed === 'object'
    ? (parsed as Record<string, unknown>)
    : null;
}

function extractYtPlayerResponse(html: string): Record<string, unknown> | null {
  const parsed =
    extractBalancedJson(html, 'var ytInitialPlayerResponse =') ||
    extractBalancedJson(html, 'ytInitialPlayerResponse =');
  return parsed && typeof parsed === 'object'
    ? (parsed as Record<string, unknown>)
    : null;
}

function cleanThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function parseInputTarget(rawInput: string): {
  kind: 'channel_id' | 'handle' | 'playlist' | 'video' | 'url';
  value: string;
} {
  const input = rawInput.trim();
  if (/^UC[a-zA-Z0-9_-]{20,}$/.test(input)) {
    return { kind: 'channel_id', value: input };
  }
  if (/^@[a-zA-Z0-9._-]+$/.test(input)) {
    return { kind: 'handle', value: input };
  }
  if (/^(PL|UU|OLAK5uy_)[a-zA-Z0-9_-]{10,}$/.test(input)) {
    return { kind: 'playlist', value: input };
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return { kind: 'video', value: input };
  }

  try {
    const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const u = new URL(normalized);
    const listParam = u.searchParams.get('list');
    const vParam = u.searchParams.get('v');

    if (u.hostname.includes('youtu.be')) {
      const seg = u.pathname.replace(/^\/+/, '').split('/')[0];
      if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
        return { kind: 'video', value: seg };
      }
    }
    if (u.pathname.startsWith('/playlist') && listParam) {
      return { kind: 'playlist', value: listParam };
    }
    if (u.pathname.startsWith('/watch') && vParam) {
      return { kind: 'video', value: vParam };
    }
    if (u.pathname.startsWith('/shorts/')) {
      const seg = u.pathname.split('/')[2];
      if (seg) return { kind: 'video', value: seg };
    }
    const chMatch = u.pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);
    if (chMatch) {
      return { kind: 'channel_id', value: chMatch[1] };
    }
    const handleMatch = u.pathname.match(/\/(@[a-zA-Z0-9._-]+)/);
    if (handleMatch) {
      return { kind: 'handle', value: handleMatch[1] };
    }
    return { kind: 'url', value: normalized };
  } catch {
    return { kind: 'handle', value: input.startsWith('@') ? input : `@${input}` };
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`YouTube HTTP ${res.status} when loading ${url}`);
  }
  return res.text();
}

async function fetchChannelRssVideos(
  channelId: string
): Promise<Map<string, Partial<ImportedYouTubeVideo>>> {
  const map = new Map<string, Partial<ImportedYouTubeVideo>>();
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      { headers: BROWSER_HEADERS }
    );
    if (!res.ok) return map;
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    for (const entry of entries) {
      const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
      if (!videoId) continue;
      const title = decodeXmlEntities(
        entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || ''
      );
      const description = decodeXmlEntities(
        entry.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] || ''
      );
      const published =
        entry.match(/<published>([^<]+)<\/published>/)?.[1]?.trim() || '';
      const viewsStr =
        entry.match(/<media:statistics[^>]*views="(\d+)"/)?.[1] || '0';
      const author = decodeXmlEntities(
        entry.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1] || ''
      );
      map.set(videoId, {
        youtubeId: videoId,
        title,
        description,
        publishedDate: published,
        viewCount: Number(viewsStr) || 0,
        channelName: author,
        thumbnail: cleanThumbnailUrl(videoId),
      });
    }
  } catch {
    // Non-fatal; ytInitialData still provides videos
  }
  return map;
}

function extractDurationFromLockup(lockup: Record<string, unknown>): string {
  const str = JSON.stringify(lockup.contentImage || '');
  const matches = [...str.matchAll(/"text":"(\d{1,2}:\d{2}(?::\d{2})?)"/g)];
  if (matches.length > 0) {
    return matches[0][1];
  }
  return '';
}

function extractVideosFromYtData(
  data: Record<string, unknown>,
  channelId: string,
  channelName: string
): ImportedYouTubeVideo[] {
  const found = new Map<string, ImportedYouTubeVideo>();

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;

    // Modern YouTube 2025-2026 lockupViewModel
    if (
      rec.lockupViewModel &&
      typeof rec.lockupViewModel === 'object' &&
      (rec.lockupViewModel as Record<string, unknown>).contentType ===
        'LOCKUP_CONTENT_TYPE_VIDEO'
    ) {
      const l = rec.lockupViewModel as Record<string, unknown>;
      const videoId = typeof l.contentId === 'string' ? l.contentId : '';
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) && !found.has(videoId)) {
        const meta = (l.metadata as Record<string, unknown>)
          ?.lockupMetadataViewModel as Record<string, unknown> | undefined;
        const title =
          ((meta?.title as Record<string, unknown>)?.content as string) || '';
        const duration = extractDurationFromLockup(l);
        if (title) {
          found.set(videoId, {
            youtubeId: videoId,
            channelId,
            channelName,
            title: title.trim(),
            description: '',
            thumbnail: cleanThumbnailUrl(videoId),
            duration,
            durationSeconds: parseDurationToSeconds(duration),
            publishedDate: '',
            viewCount: 0,
            playlistIds: [],
          });
        }
      }
    }

    // Legacy playlistVideoRenderer
    if (rec.playlistVideoRenderer && typeof rec.playlistVideoRenderer === 'object') {
      const v = rec.playlistVideoRenderer as Record<string, unknown>;
      const videoId = typeof v.videoId === 'string' ? v.videoId : '';
      if (videoId && !found.has(videoId)) {
        const titleObj = v.title as Record<string, unknown> | undefined;
        const runs = titleObj?.runs as Array<{ text?: string }> | undefined;
        const title =
          runs?.map((r) => r.text || '').join('') ||
          (typeof titleObj?.simpleText === 'string' ? titleObj.simpleText : '');
        const lengthObj = v.lengthText as Record<string, unknown> | undefined;
        const duration =
          typeof lengthObj?.simpleText === 'string' ? lengthObj.simpleText : '';
        const lengthSec = Number(v.lengthSeconds || 0);
        if (title) {
          found.set(videoId, {
            youtubeId: videoId,
            channelId,
            channelName,
            title: title.trim(),
            description: '',
            thumbnail: cleanThumbnailUrl(videoId),
            duration: duration || formatSecondsToDuration(lengthSec),
            durationSeconds: lengthSec || parseDurationToSeconds(duration),
            publishedDate: '',
            viewCount: 0,
            playlistIds: [],
          });
        }
      }
    }

    // Channel /videos tab videoRenderer
    if (rec.videoRenderer && typeof rec.videoRenderer === 'object') {
      const v = rec.videoRenderer as Record<string, unknown>;
      const videoId = typeof v.videoId === 'string' ? v.videoId : '';
      if (videoId && !found.has(videoId)) {
        const titleObj = v.title as Record<string, unknown> | undefined;
        const runs = titleObj?.runs as Array<{ text?: string }> | undefined;
        const title =
          runs?.map((r) => r.text || '').join('') ||
          (typeof titleObj?.simpleText === 'string' ? titleObj.simpleText : '');
        const lengthObj = v.lengthText as Record<string, unknown> | undefined;
        const duration =
          typeof lengthObj?.simpleText === 'string' ? lengthObj.simpleText : '';
        const descObj = v.descriptionSnippet as Record<string, unknown> | undefined;
        const descRuns = descObj?.runs as Array<{ text?: string }> | undefined;
        const description = descRuns?.map((r) => r.text || '').join('') || '';
        const viewObj = v.viewCountText as Record<string, unknown> | undefined;
        const viewStr =
          typeof viewObj?.simpleText === 'string'
            ? viewObj.simpleText.replace(/[^\d]/g, '')
            : '0';
        if (title) {
          found.set(videoId, {
            youtubeId: videoId,
            channelId,
            channelName,
            title: title.trim(),
            description: description.trim(),
            thumbnail: cleanThumbnailUrl(videoId),
            duration,
            durationSeconds: parseDurationToSeconds(duration),
            publishedDate: '',
            viewCount: Number(viewStr) || 0,
            playlistIds: [],
          });
        }
      }
    }

    for (const val of Object.values(rec)) {
      if (val && typeof val === 'object') walk(val);
    }
  }

  walk(data);
  return Array.from(found.values());
}

function extractPlaylistsFromChannelData(
  data: Record<string, unknown>
): Array<{ youtubePlaylistId: string; title: string; videoCount: number }> {
  const playlists = new Map<
    string,
    { youtubePlaylistId: string; title: string; videoCount: number }
  >();

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const rec = node as Record<string, unknown>;

    if (
      rec.lockupViewModel &&
      typeof rec.lockupViewModel === 'object' &&
      (rec.lockupViewModel as Record<string, unknown>).contentType ===
        'LOCKUP_CONTENT_TYPE_PLAYLIST'
    ) {
      const l = rec.lockupViewModel as Record<string, unknown>;
      const id = typeof l.contentId === 'string' ? l.contentId : '';
      if (id && !playlists.has(id)) {
        const meta = (l.metadata as Record<string, unknown>)
          ?.lockupMetadataViewModel as Record<string, unknown> | undefined;
        const title =
          ((meta?.title as Record<string, unknown>)?.content as string) || '';
        const badgeMatch = JSON.stringify(l.contentImage || '').match(
          /"text":"(\d[\d,.]*)\s*(?:video|videos)"/i
        );
        const count = badgeMatch
          ? Number(badgeMatch[1].replace(/[^\d]/g, '')) || 0
          : 0;
        if (title) {
          playlists.set(id, {
            youtubePlaylistId: id,
            title: title.trim(),
            videoCount: count,
          });
        }
      }
    }

    if (rec.gridPlaylistRenderer && typeof rec.gridPlaylistRenderer === 'object') {
      const p = rec.gridPlaylistRenderer as Record<string, unknown>;
      const id = typeof p.playlistId === 'string' ? p.playlistId : '';
      if (id && !playlists.has(id)) {
        const titleObj = p.title as Record<string, unknown> | undefined;
        const runs = titleObj?.runs as Array<{ text?: string }> | undefined;
        const title =
          runs?.map((r) => r.text || '').join('') ||
          (typeof titleObj?.simpleText === 'string' ? titleObj.simpleText : '');
        const countStr = String(p.videoCountShortText || p.videoCount || '0').replace(
          /[^\d]/g,
          ''
        );
        if (title) {
          playlists.set(id, {
            youtubePlaylistId: id,
            title: title.trim(),
            videoCount: Number(countStr) || 0,
          });
        }
      }
    }

    for (const val of Object.values(rec)) {
      if (val && typeof val === 'object') walk(val);
    }
  }

  walk(data);
  return Array.from(playlists.values());
}

export async function fetchSingleVideoDetails(videoId: string): Promise<{
  youtubeId: string;
  channelId: string;
  channelName: string;
  title: string;
  description: string;
  duration: string;
  durationSeconds: number;
  publishedDate: string;
  viewCount: number;
  thumbnail: string;
}> {
  const cleanId = videoId.trim();
  if (!/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
    throw new Error('Invalid YouTube video ID.');
  }

  // Optional YouTube Data API v3 fast path
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (apiKey) {
    const apiRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(cleanId)}&key=${encodeURIComponent(apiKey)}`
    );
    if (apiRes.ok) {
      const json = (await apiRes.json()) as {
        items?: Array<{
          snippet?: {
            channelId?: string;
            channelTitle?: string;
            title?: string;
            description?: string;
            publishedAt?: string;
          };
          contentDetails?: { duration?: string };
          statistics?: { viewCount?: string };
        }>;
      };
      const item = json.items?.[0];
      if (item?.snippet) {
        const sec = parseDurationToSeconds(item.contentDetails?.duration || '');
        return {
          youtubeId: cleanId,
          channelId: item.snippet.channelId || '',
          channelName: item.snippet.channelTitle || '',
          title: item.snippet.title || '',
          description: item.snippet.description || '',
          duration: formatSecondsToDuration(sec),
          durationSeconds: sec,
          publishedDate: item.snippet.publishedAt || '',
          viewCount: Number(item.statistics?.viewCount || 0),
          thumbnail: cleanThumbnailUrl(cleanId),
        };
      }
    }
  }

  const html = await fetchHtml(`https://www.youtube.com/watch?v=${cleanId}`);
  const player = extractYtPlayerResponse(html);
  const vd = (player?.videoDetails as Record<string, unknown> | undefined) || {};
  const micro = (
    (player?.microformat as Record<string, unknown> | undefined)
      ?.playerMicroformatRenderer as Record<string, unknown> | undefined
  ) || {};

  const lengthSeconds = Number(vd.lengthSeconds || 0);
  return {
    youtubeId: cleanId,
    channelId: String(vd.channelId || ''),
    channelName: String(vd.author || ''),
    title: String(vd.title || ''),
    description: String(vd.shortDescription || ''),
    duration: formatSecondsToDuration(lengthSeconds),
    durationSeconds: lengthSeconds,
    publishedDate: String(micro.publishDate || micro.uploadDate || ''),
    viewCount: Number(vd.viewCount || 0),
    thumbnail: cleanThumbnailUrl(cleanId),
  };
}

async function importViaYouTubeApiV3(
  apiKey: string,
  channelId: string,
  maxPlaylists: number,
  maxVideosPerPlaylist: number
): Promise<YouTubeImportResult> {
  const chRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`
  );
  if (!chRes.ok) {
    throw new Error(`YouTube Data API error (${chRes.status})`);
  }
  const chJson = (await chRes.json()) as {
    items?: Array<{
      id: string;
      snippet: {
        title: string;
        description: string;
        customUrl?: string;
        thumbnails?: { high?: { url: string }; default?: { url: string } };
      };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  };
  const chItem = chJson.items?.[0];
  if (!chItem) {
    throw new Error('Không tìm thấy kênh YouTube này qua YouTube Data API v3.');
  }

  const channel: ImportedYouTubeChannel = {
    youtubeChannelId: chItem.id,
    handle: chItem.snippet.customUrl || '',
    url: `https://www.youtube.com/channel/${chItem.id}`,
    title: chItem.snippet.title.trim(),
    description: chItem.snippet.description || '',
    avatarUrl:
      chItem.snippet.thumbnails?.high?.url ||
      chItem.snippet.thumbnails?.default?.url ||
      '',
    sourceMode: 'youtube_api_v3',
  };

  // Fetch channel playlists
  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${encodeURIComponent(channelId)}&maxResults=${Math.min(50, maxPlaylists)}&key=${encodeURIComponent(apiKey)}`
  );
  const plJson = plRes.ok
    ? ((await plRes.json()) as {
        items?: Array<{
          id: string;
          snippet: { title: string; description: string };
          contentDetails: { itemCount: number };
        }>;
      })
    : { items: [] };

  const playlists: ImportedYouTubePlaylist[] = [];
  const videoMap = new Map<string, ImportedYouTubeVideo>();

  for (const pl of plJson.items || []) {
    const itemsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(pl.id)}&maxResults=${Math.min(50, maxVideosPerPlaylist)}&key=${encodeURIComponent(apiKey)}`
    );
    const itemsJson = itemsRes.ok
      ? ((await itemsRes.json()) as {
          items?: Array<{
            snippet?: {
              title?: string;
              description?: string;
              publishedAt?: string;
              resourceId?: { videoId?: string };
            };
          }>;
        })
      : { items: [] };

    const videoIds: string[] = [];
    for (const item of itemsJson.items || []) {
      const vid = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title || '';
      if (!vid || title === 'Deleted video' || title === 'Private video') continue;
      videoIds.push(vid);
      const existing = videoMap.get(vid);
      if (existing) {
        if (!existing.playlistIds.includes(pl.id)) existing.playlistIds.push(pl.id);
      } else {
        videoMap.set(vid, {
          youtubeId: vid,
          channelId: channel.youtubeChannelId,
          channelName: channel.title,
          title: title.trim(),
          description: item.snippet?.description || '',
          thumbnail: cleanThumbnailUrl(vid),
          duration: '',
          durationSeconds: 0,
          publishedDate: item.snippet?.publishedAt || '',
          viewCount: 0,
          playlistIds: [pl.id],
        });
      }
    }

    playlists.push({
      youtubePlaylistId: pl.id,
      title: pl.snippet.title.trim(),
      description: pl.snippet.description || '',
      videoCount: pl.contentDetails.itemCount || videoIds.length,
      videoIds,
    });
  }

  // Enrich video durations & views in chunks of 50 (only 1 quota unit per 50 videos!)
  const allIds = Array.from(videoMap.keys());
  for (let i = 0; i < allIds.length; i += 50) {
    const chunk = allIds.slice(i, i + 50);
    const dRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${chunk.join(',')}&key=${encodeURIComponent(apiKey)}`
    );
    if (!dRes.ok) continue;
    const dJson = (await dRes.json()) as {
      items?: Array<{
        id: string;
        contentDetails?: { duration?: string };
        statistics?: { viewCount?: string };
      }>;
    };
    for (const d of dJson.items || []) {
      const target = videoMap.get(d.id);
      if (!target) continue;
      const sec = parseDurationToSeconds(d.contentDetails?.duration || '');
      target.durationSeconds = sec;
      target.duration = formatSecondsToDuration(sec);
      target.viewCount = Number(d.statistics?.viewCount || 0);
    }
  }

  return {
    channel,
    playlists,
    videos: Array.from(videoMap.values()),
    stats: {
      playlistsFound: playlists.length,
      videosFound: videoMap.size,
      mode: 'youtube_api_v3',
    },
  };
}

export async function importYouTubeSource(options: {
  url: string;
  maxPlaylists?: number;
  maxVideosPerPlaylist?: number;
}): Promise<YouTubeImportResult> {
  const maxPlaylists = Math.min(20, Math.max(1, options.maxPlaylists ?? 12));
  const maxVideosPerPlaylist = Math.min(
    40,
    Math.max(1, options.maxVideosPerPlaylist ?? 20)
  );
  const parsed = parseInputTarget(options.url);

  // Case 1: Single Video URL
  if (parsed.kind === 'video') {
    const detail = await fetchSingleVideoDetails(parsed.value);
    const channel: ImportedYouTubeChannel = {
      youtubeChannelId: detail.channelId || `ch_${detail.youtubeId}`,
      handle: '',
      url: detail.channelId
        ? `https://www.youtube.com/channel/${detail.channelId}`
        : `https://www.youtube.com/watch?v=${detail.youtubeId}`,
      title: detail.channelName || 'YouTube Channel',
      description: '',
      avatarUrl: '',
      sourceMode: process.env.YOUTUBE_API_KEY ? 'youtube_api_v3' : 'public_metadata',
    };
    return {
      channel,
      playlists: [],
      videos: [
        {
          youtubeId: detail.youtubeId,
          channelId: channel.youtubeChannelId,
          channelName: channel.title,
          title: detail.title,
          description: detail.description,
          thumbnail: detail.thumbnail,
          duration: detail.duration,
          durationSeconds: detail.durationSeconds,
          publishedDate: detail.publishedDate,
          viewCount: detail.viewCount,
          playlistIds: [],
        },
      ],
      stats: {
        playlistsFound: 0,
        videosFound: 1,
        mode: channel.sourceMode,
      },
    };
  }

  // Case 2: Direct Playlist URL
  if (parsed.kind === 'playlist') {
    const html = await fetchHtml(
      `https://www.youtube.com/playlist?list=${encodeURIComponent(parsed.value)}`
    );
    const data = extractYtInitialData(html);
    if (!data) {
      throw new Error('Không thể đọc siêu dữ liệu từ playlist YouTube này.');
    }
    const meta = (
      (data.metadata as Record<string, unknown> | undefined)
        ?.playlistMetadataRenderer as Record<string, unknown> | undefined
    ) || {};
    const plTitle = String(meta.title || `Playlist ${parsed.value}`).trim();
    const str = JSON.stringify(data);
    const ownerName =
      str.match(/"videoOwnerRenderer":\{"thumbnail":[\s\S]*?"text":"([^"]+)"/)?.[1] ||
      'YouTube Channel';
    const ownerChannelId =
      str.match(/"browseId":"(UC[a-zA-Z0-9_-]+)"/)?.[1] ||
      `pl_${parsed.value}`;

    const videos = extractVideosFromYtData(
      data,
      ownerChannelId,
      ownerName
    ).slice(0, maxVideosPerPlaylist);
    for (const v of videos) {
      v.playlistIds = [parsed.value];
    }

    return {
      channel: {
        youtubeChannelId: ownerChannelId,
        handle: '',
        url: ownerChannelId.startsWith('UC')
          ? `https://www.youtube.com/channel/${ownerChannelId}`
          : `https://www.youtube.com/playlist?list=${parsed.value}`,
        title: ownerName,
        description: '',
        avatarUrl: '',
        sourceMode: 'public_metadata',
      },
      playlists: [
        {
          youtubePlaylistId: parsed.value,
          title: plTitle,
          description: '',
          videoCount: videos.length,
          videoIds: videos.map((v) => v.youtubeId),
        },
      ],
      videos,
      stats: {
        playlistsFound: 1,
        videosFound: videos.length,
        mode: 'public_metadata',
      },
    };
  }

  // Case 3: Channel (@handle, /channel/UC..., or channel URL)
  let playlistsPageUrl = '';
  if (parsed.kind === 'channel_id') {
    playlistsPageUrl = `https://www.youtube.com/channel/${parsed.value}/playlists`;
  } else if (parsed.kind === 'handle') {
    playlistsPageUrl = `https://www.youtube.com/${parsed.value}/playlists`;
  } else {
    const cleanBase = parsed.value
      .replace(/\/(videos|playlists|shorts|featured|streams|about).*$/i, '')
      .replace(/\/+$/, '');
    playlistsPageUrl = `${cleanBase}/playlists`;
  }

  const playlistsHtml = await fetchHtml(playlistsPageUrl);
  const ytData = extractYtInitialData(playlistsHtml);
  if (!ytData) {
    throw new Error(
      'Không đọc được dữ liệu kênh YouTube. Vui lòng kiểm tra lại đường dẫn kênh.'
    );
  }

  const chMeta = (
    (ytData.metadata as Record<string, unknown> | undefined)
      ?.channelMetadataRenderer as Record<string, unknown> | undefined
  ) || {};

  const resolvedChannelId =
    String(chMeta.externalId || '') ||
    (parsed.kind === 'channel_id' ? parsed.value : '') ||
    playlistsHtml.match(/"externalId":"(UC[a-zA-Z0-9_-]+)"/)?.[1] ||
    '';

  if (!resolvedChannelId) {
    throw new Error('Không xác định được Channel ID (UC...) từ đường dẫn đã nhập.');
  }

  // If optional YOUTUBE_API_KEY is configured on server, use official YouTube Data API v3
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (apiKey) {
    try {
      return await importViaYouTubeApiV3(
        apiKey,
        resolvedChannelId,
        maxPlaylists,
        maxVideosPerPlaylist
      );
    } catch (err) {
      console.warn(
        '[youtubeService] YouTube Data API v3 failed, falling back to public metadata:',
        err
      );
    }
  }

  const vanityUrl = String(chMeta.vanityChannelUrl || '');
  const handleMatch = vanityUrl.match(/(@[a-zA-Z0-9._-]+)/);
  const avatarSources = (
    (chMeta.avatar as Record<string, unknown> | undefined)?.thumbnails as
      | Array<{ url?: string }>
      | undefined
  ) || [];

  const channel: ImportedYouTubeChannel = {
    youtubeChannelId: resolvedChannelId,
    handle: handleMatch ? handleMatch[1] : '',
    url: `https://www.youtube.com/channel/${resolvedChannelId}`,
    title: String(chMeta.title || 'YouTube Channel').trim(),
    description: String(chMeta.description || '').trim(),
    avatarUrl: avatarSources[avatarSources.length - 1]?.url || '',
    sourceMode: 'public_metadata',
  };

  // 1. Extract playlists from /playlists tab (skip redundant "All videos" mega-playlist if specific playlists exist)
  const rawPlaylists = extractPlaylistsFromChannelData(ytData);
  const prioritizedPlaylists = rawPlaylists
    .filter((pl) => {
      if (rawPlaylists.length <= 2) return true;
      return !/^(all videos|tất cả video|uploads)$/i.test(pl.title.trim());
    })
    .slice(0, maxPlaylists);

  // 2. Fetch RSS feed in parallel (gives full descriptions, exact publish dates & views for newest 15 uploads)
  const rssPromise = fetchChannelRssVideos(resolvedChannelId);

  // 3. Fetch videos inside each playlist (controlled concurrency of 4)
  const videoMap = new Map<string, ImportedYouTubeVideo>();
  const finalPlaylists: ImportedYouTubePlaylist[] = [];

  for (let i = 0; i < prioritizedPlaylists.length; i += 4) {
    const batch = prioritizedPlaylists.slice(i, i + 4);
    const results = await Promise.allSettled(
      batch.map(async (pl) => {
        const html = await fetchHtml(
          `https://www.youtube.com/playlist?list=${encodeURIComponent(pl.youtubePlaylistId)}`
        );
        const pData = extractYtInitialData(html);
        const vids = pData
          ? extractVideosFromYtData(
              pData,
              channel.youtubeChannelId,
              channel.title
            ).slice(0, maxVideosPerPlaylist)
          : [];
        return { pl, vids };
      })
    );

    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { pl, vids } = r.value;
      const videoIds: string[] = [];
      for (const v of vids) {
        videoIds.push(v.youtubeId);
        const existing = videoMap.get(v.youtubeId);
        if (existing) {
          if (!existing.playlistIds.includes(pl.youtubePlaylistId)) {
            existing.playlistIds.push(pl.youtubePlaylistId);
          }
          if (!existing.duration && v.duration) {
            existing.duration = v.duration;
            existing.durationSeconds = v.durationSeconds;
          }
        } else {
          v.playlistIds = [pl.youtubePlaylistId];
          videoMap.set(v.youtubeId, v);
        }
      }
      if (videoIds.length > 0) {
        finalPlaylists.push({
          youtubePlaylistId: pl.youtubePlaylistId,
          title: pl.title,
          description: '',
          videoCount: pl.videoCount || videoIds.length,
          videoIds,
        });
      }
    }
  }

  // 4. Also merge latest RSS uploads (adds descriptions, published dates, and captures recent uncategorized uploads)
  const rssMap = await rssPromise;
  for (const [vid, rssData] of rssMap.entries()) {
    const existing = videoMap.get(vid);
    if (existing) {
      if (!existing.description && rssData.description) {
        existing.description = rssData.description;
      }
      if (!existing.publishedDate && rssData.publishedDate) {
        existing.publishedDate = rssData.publishedDate;
      }
      if (!existing.viewCount && rssData.viewCount) {
        existing.viewCount = rssData.viewCount;
      }
    } else if (rssData.title) {
      videoMap.set(vid, {
        youtubeId: vid,
        channelId: channel.youtubeChannelId,
        channelName: channel.title,
        title: rssData.title,
        description: rssData.description || '',
        thumbnail: cleanThumbnailUrl(vid),
        duration: '',
        durationSeconds: 0,
        publishedDate: rssData.publishedDate || '',
        viewCount: rssData.viewCount || 0,
        playlistIds: [],
      });
    }
  }

  // 5. Fallback if channel had zero playlists: fetch /videos tab
  if (videoMap.size === 0) {
    try {
      const vHtml = await fetchHtml(
        `https://www.youtube.com/channel/${resolvedChannelId}/videos`
      );
      const vData = extractYtInitialData(vHtml);
      if (vData) {
        for (const v of extractVideosFromYtData(
          vData,
          channel.youtubeChannelId,
          channel.title
        ).slice(0, 30)) {
          videoMap.set(v.youtubeId, v);
        }
      }
    } catch {
      // Ignore fallback failure
    }
  }

  return {
    channel,
    playlists: finalPlaylists,
    videos: Array.from(videoMap.values()),
    stats: {
      playlistsFound: finalPlaylists.length,
      videosFound: videoMap.size,
      mode: 'public_metadata',
    },
  };
}

import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';
import {
  fetchSingleVideoDetails,
  importYouTubeSource,
} from './youtubeService.js';
import {
  GlossaryRuleInput,
  optimizeVideoWithGemini,
  translateTopicsWithGemini,
} from './geminiVideoService.js';

const PUBSUBHUBBUB_HUB_URL = 'https://pubsubhubbub.appspot.com/subscribe';
const DEFAULT_LEASE_SECONDS = 432000; // 5 days (renewed daily by Cloud Scheduler)

export type SyncTriggerSource = 'cron_scheduler' | 'websub_push' | 'admin_manual';

export interface ChannelAutoSyncResult {
  channelId: string;
  youtubeChannelId: string;
  channelTitle: string;
  topicsAdded: number;
  videosAdded: number;
  videosPreserved: number;
  videosAiOptimized: number;
  videosAiFailed: number;
  webSubRenewed: boolean;
  status: 'success' | 'partial' | 'error';
  summary: string;
  errorDetail?: string;
}

export interface ScheduledSyncRunReport {
  trigger: SyncTriggerSource;
  status: 'success' | 'partial' | 'error';
  channelsScanned: number;
  totalTopicsAdded: number;
  totalVideosAdded: number;
  totalVideosAiOptimized: number;
  totalVideosAiFailed: number;
  totalWebSubRenewed: number;
  durationMs: number;
  results: ChannelAutoSyncResult[];
}

export interface ParsedWebSubEntry {
  videoId: string;
  channelId: string;
  title: string;
  published: string;
  updated: string;
  authorName: string;
  deleted: boolean;
}

function clampStr(v: unknown, max: number, fallback = ''): string {
  const s = (v ?? fallback).toString().trim();
  return s.slice(0, max);
}

function clampList(arr: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => String(s || '').trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function slugify(input: string, fallback = 'video'): string {
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

function sanitizeDocId(raw: string, prefix: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return `${prefix}${clean || Date.now().toString(36)}`;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Resolves the canonical public HTTPS callback base URL for YouTube WebSub.
 */
export function resolvePublicBaseUrl(requestHost?: string, protocol?: string): string {
  const pinnedPublic = (process.env.PUBLIC_APP_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (
    pinnedPublic &&
    pinnedPublic.startsWith('http') &&
    !pinnedPublic.includes('MY_APP_URL')
  ) {
    return pinnedPublic;
  }

  const cleanHost = (requestHost || '').split(',')[0].trim();
  const hostNoPort = cleanHost.split(':')[0].toLowerCase();
  const isLocal =
    !hostNoPort ||
    hostNoPort === 'localhost' ||
    hostNoPort.startsWith('127.0.0.1');
  const isRunApp = hostNoPort.endsWith('.run.app');

  if (!isLocal && !isRunApp) {
    const proto = protocol === 'http' ? 'https' : protocol || 'https';
    return `${proto}://${cleanHost}`.replace(/\/+$/, '');
  }

  const appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (appUrl && appUrl.startsWith('http') && !appUrl.includes('MY_APP_URL')) {
    return appUrl;
  }

  if (!isLocal) {
    const proto = protocol === 'http' ? 'https' : protocol || 'https';
    return `${proto}://${cleanHost}`.replace(/\/+$/, '');
  }
  return '';
}

export function buildYouTubeTopicUrl(youtubeChannelId: string): string {
  return `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${encodeURIComponent(
    youtubeChannelId.trim()
  )}`;
}

export function extractChannelIdFromTopicUrl(topicUrl: string): string | null {
  try {
    const u = new URL(topicUrl);
    const id = u.searchParams.get('channel_id');
    if (id && /^UC[a-zA-Z0-9_-]{18,}$/.test(id)) return id;
  } catch {
    // Fallback regex
  }
  const m = topicUrl.match(/channel_id=(UC[a-zA-Z0-9_-]{18,})/);
  return m ? m[1] : null;
}

/**
 * Verifies X-Hub-Signature header (HMAC-SHA1) from Google PubSubHubbub Hub
 * when WEBSUB_SECRET is configured.
 */
export function verifyWebSubSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined
): { valid: boolean; reason?: string } {
  const secret = (process.env.WEBSUB_SECRET || '').trim();
  if (!secret) {
    // Allow unsigned hub delivery only when WEBSUB_SECRET is intentionally unset
    return { valid: true };
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha1=')) {
    return { valid: false, reason: 'Missing sha1 X-Hub-Signature header' };
  }
  const providedHex = signatureHeader.slice('sha1='.length).trim();
  const computedHex = crypto
    .createHmac('sha1', secret)
    .update(rawBody)
    .digest('hex');

  const bufA = Buffer.from(providedHex, 'utf8');
  const bufB = Buffer.from(computedHex, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, reason: 'Invalid HMAC-SHA1 X-Hub-Signature' };
  }
  return { valid: true };
}

/**
 * Parses YouTube Atom XML payload delivered by PubSubHubbub WebSub push.
 */
export function parseYouTubeWebSubAtomXml(xml: string): ParsedWebSubEntry[] {
  const entries: ParsedWebSubEntry[] = [];
  if (!xml || typeof xml !== 'string') return entries;

  // Detect <at:deleted-entry> tombstones cleanly
  if (xml.includes('<at:deleted-entry') && !xml.includes('<entry>')) {
    return entries;
  }

  const entryMatches = xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/g) || [];
  for (const block of entryMatches) {
    const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim() || '';
    const channelId = block.match(/<yt:channelId>([^<]+)<\/yt:channelId>/)?.[1]?.trim() || '';
    const title = decodeXmlEntities(
      block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || ''
    );
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1]?.trim() || '';
    const updated = block.match(/<updated>([^<]+)<\/updated>/)?.[1]?.trim() || '';
    const authorName = decodeXmlEntities(
      block.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/)?.[1]?.trim() ||
        ''
    );

    if (videoId && channelId) {
      entries.push({
        videoId,
        channelId,
        title,
        published,
        updated,
        authorName,
        deleted: false,
      });
    }
  }

  return entries;
}

/**
 * Registers or unregisters a YouTube channel with Google's official PubSubHubbub Hub.
 */
export async function subscribeChannelToWebSub(params: {
  youtubeChannelId: string;
  callbackBaseUrl: string;
  mode: 'subscribe' | 'unsubscribe';
  leaseSeconds?: number;
}): Promise<{ ok: boolean; status: number; callbackUrl: string; topicUrl: string; message: string }> {
  const { youtubeChannelId, callbackBaseUrl, mode } = params;
  const leaseSeconds = params.leaseSeconds ?? DEFAULT_LEASE_SECONDS;
  const base = callbackBaseUrl.replace(/\/+$/, '');
  if (!base.startsWith('https://')) {
    throw new Error(
      'YouTube WebSub yêu cầu địa chỉ callback HTTPS công khai (cấu hình PUBLIC_APP_URL=https://meetboston.duyvo.win trên Cloud Run).'
    );
  }

  const callbackUrl = `${base}/api/webhooks/youtube`;
  const topicUrl = buildYouTubeTopicUrl(youtubeChannelId);

  const form = new URLSearchParams();
  form.set('hub.callback', callbackUrl);
  form.set('hub.topic', topicUrl);
  form.set('hub.verify', 'async');
  form.set('hub.mode', mode);
  if (mode === 'subscribe') {
    form.set('hub.lease_seconds', String(leaseSeconds));
  }
  const secret = (process.env.WEBSUB_SECRET || '').trim();
  if (secret) {
    form.set('hub.secret', secret);
  }

  const res = await fetch(PUBSUBHUBBUB_HUB_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MeetBoston-WebSub-Client/1.0',
    },
    body: form.toString(),
  });

  const text = await res.text().catch(() => '');
  const ok = res.status >= 200 && res.status < 300;
  return {
    ok,
    status: res.status,
    callbackUrl,
    topicUrl,
    message: ok
      ? `Google PubSubHubbub Hub đã tiếp nhận yêu cầu ${mode} (HTTP ${res.status}).`
      : `Hub trả về HTTP ${res.status}: ${text.slice(0, 200)}`,
  };
}

/**
 * Records WebSub verification confirmation (GET /api/webhooks/youtube challenge) into Firestore.
 */
export async function recordWebSubVerification(params: {
  youtubeChannelId: string;
  mode: string;
  leaseSeconds?: number;
}): Promise<void> {
  const db = getAdminDb();
  const channelDocId = sanitizeDocId(params.youtubeChannelId, 'ch_');
  const ref = db.collection('videoChannels').doc(channelDocId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const now = new Date();
  if (params.mode === 'unsubscribe') {
    await ref.update({
      webSubStatus: 'inactive',
      webSubLeaseExpiresAt: '',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  const leaseSec = Math.max(3600, Number(params.leaseSeconds) || DEFAULT_LEASE_SECONDS);
  const expiresAt = new Date(now.getTime() + leaseSec * 1000).toISOString();
  await ref.update({
    webSubStatus: 'active',
    webSubSubscribedAt: now.toISOString(),
    webSubLeaseExpiresAt: expiresAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function writeSyncLog(entry: {
  trigger: SyncTriggerSource;
  status: 'success' | 'partial' | 'error';
  channelId: string;
  channelTitle: string;
  videosAdded: number;
  videosAiOptimized: number;
  videosAiFailed: number;
  topicsAdded: number;
  webSubRenewed: number;
  summary: string;
  errorDetail?: string;
  durationMs: number;
}): Promise<void> {
  try {
    const db = getAdminDb();
    const id = `log_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    await db
      .collection('videoSyncLogs')
      .doc(id)
      .set({
        trigger: entry.trigger,
        status: entry.status,
        channelId: clampStr(entry.channelId, 128),
        channelTitle: clampStr(entry.channelTitle, 160),
        videosAdded: Math.max(0, entry.videosAdded),
        videosAiOptimized: Math.max(0, entry.videosAiOptimized),
        videosAiFailed: Math.max(0, entry.videosAiFailed),
        topicsAdded: Math.max(0, entry.topicsAdded),
        webSubRenewed: Math.max(0, entry.webSubRenewed),
        summary: clampStr(entry.summary, 600, 'Completed sync'),
        errorDetail: clampStr(entry.errorDetail || '', 1000),
        durationMs: Math.max(0, Math.round(entry.durationMs)),
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.error('[videoAutoSync] Failed to write videoSyncLogs:', err);
  }
}

async function loadGlossaryForAi(): Promise<GlossaryRuleInput[]> {
  const db = getAdminDb();
  const snap = await db.collection('videoGlossary').get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      sourceTerm: String(data.sourceTerm || ''),
      targetVi: String(data.targetVi || ''),
      targetEn: String(data.targetEn || ''),
      keepOriginal: Boolean(data.keepOriginal),
      notes: String(data.notes || ''),
    };
  });
}

async function loadTopicsForChannel(channelDocId: string): Promise<
  Array<{ id: string; youtubePlaylistId: string; titleVi: string; titleEn: string }>
> {
  const db = getAdminDb();
  const snap = await db
    .collection('videoTopics')
    .where('channelId', '==', channelDocId)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      youtubePlaylistId: String(data.youtubePlaylistId || ''),
      titleVi: String(data.titleVi || ''),
      titleEn: String(data.titleEn || ''),
    };
  });
}

interface UpsertVideoParams {
  channelDocId: string;
  channelName: string;
  youtubeId: string;
  rawTitle: string;
  rawDescription: string;
  thumbnail: string;
  duration: string;
  durationSeconds: number;
  publishedDate: string;
  viewCount: number;
  topicId: string;
  topics: Array<{ id: string; titleVi: string; titleEn: string }>;
  glossary: GlossaryRuleInput[];
  autoAiOptimize: boolean;
  autoPublishNew: boolean;
  sortOrder: number;
}

/**
 * Mode A Production Upsert for a single newly discovered video:
 * - Enriches missing YouTube description/duration via watch metadata.
 * - Calls Google Gemini AI for bilingual VI/EN & SEO optimization if autoAiOptimize=true.
 * - Gracefully falls back to saving the raw video (aiStatus='pending') if Gemini quota/API fails,
 *   so zero new videos are ever lost.
 */
async function upsertNewVideoWithAutoAi(params: UpsertVideoParams): Promise<{
  aiOptimized: boolean;
  aiError?: string;
}> {
  const db = getAdminDb();
  const videoDocId = sanitizeDocId(params.youtubeId, 'yt_');

  let rawTitle = clampStr(params.rawTitle, 240, 'Video YouTube');
  let rawDescription = clampStr(params.rawDescription, 5000);
  let duration = clampStr(params.duration, 24);
  let durationSeconds = Math.max(0, Math.min(86400, Math.round(params.durationSeconds || 0)));
  let publishedDate = clampStr(params.publishedDate, 60);
  let viewCount = Math.max(0, Math.min(2000000000, Math.round(params.viewCount || 0)));
  let thumbnail = clampStr(
    params.thumbnail || `https://i.ytimg.com/vi/${params.youtubeId}/hqdefault.jpg`,
    500
  );

  // Enrich description/duration from watch page when RSS/playlist metadata is sparse
  if (rawDescription.length < 30 || !duration) {
    try {
      const details = await fetchSingleVideoDetails(params.youtubeId);
      if (details.title && rawTitle === 'Video YouTube') {
        rawTitle = clampStr(details.title, 240, rawTitle);
      }
      if (details.description) {
        rawDescription = clampStr(details.description, 5000);
      }
      if (details.duration) duration = clampStr(details.duration, 24);
      if (details.durationSeconds) {
        durationSeconds = Math.max(0, Math.min(86400, Math.round(details.durationSeconds)));
      }
      if (details.publishedDate) publishedDate = clampStr(details.publishedDate, 60);
      if (details.viewCount) {
        viewCount = Math.max(0, Math.min(2000000000, Math.round(details.viewCount)));
      }
      if (details.thumbnail) thumbnail = clampStr(details.thumbnail, 500);
    } catch {
      // Non-fatal: continue with RSS/playlist metadata
    }
  }

  let titleVi = clampStr(rawTitle, 200, 'Video YouTube');
  let titleEn = clampStr(rawTitle, 200, titleVi);
  let summaryVi = clampStr(rawDescription, 260);
  let summaryEn = '';
  let descriptionVi = clampStr(rawDescription, 3000);
  let descriptionEn = '';
  let highlightsVi: string[] = [];
  let highlightsEn: string[] = [];
  let seoTitleVi = clampStr(titleVi, 65);
  let seoTitleEn = clampStr(titleEn, 65);
  let seoDescriptionVi = clampStr(rawDescription, 155);
  let seoDescriptionEn = '';
  let slugVi = slugify(titleVi, `video-${params.youtubeId.toLowerCase()}`);
  let slugEn = slugify(titleEn, `video-${params.youtubeId.toLowerCase()}`);
  let keywordsVi: string[] = [];
  let keywordsEn: string[] = [];
  let topicId = clampStr(params.topicId, 128);
  let aiStatus: 'pending' | 'optimized' = 'pending';
  let aiError: string | undefined;

  if (params.autoAiOptimize && process.env.GEMINI_API_KEY?.trim()) {
    try {
      const opt = await optimizeVideoWithGemini({
        youtubeId: params.youtubeId,
        rawTitle,
        rawDescription,
        channelName: params.channelName,
        currentTopicId: topicId,
        topics: params.topics,
        glossary: params.glossary,
      });

      titleVi = clampStr(opt.titleVi, 200, titleVi);
      titleEn = clampStr(opt.titleEn, 200, titleEn);
      summaryVi = clampStr(opt.summaryVi, 480);
      summaryEn = clampStr(opt.summaryEn, 480);
      descriptionVi = clampStr(opt.descriptionVi, 3000);
      descriptionEn = clampStr(opt.descriptionEn, 3000);
      highlightsVi = clampList(opt.highlightsVi, 5, 260);
      highlightsEn = clampList(opt.highlightsEn, 5, 260);
      seoTitleVi = clampStr(opt.seoTitleVi, 120);
      seoTitleEn = clampStr(opt.seoTitleEn, 120);
      seoDescriptionVi = clampStr(opt.seoDescriptionVi, 260);
      seoDescriptionEn = clampStr(opt.seoDescriptionEn, 260);
      slugVi = slugify(opt.slugVi || titleVi, slugVi);
      slugEn = slugify(opt.slugEn || titleEn, slugEn);
      keywordsVi = clampList(opt.keywordsVi, 10, 80);
      keywordsEn = clampList(opt.keywordsEn, 10, 80);
      if (opt.suggestedTopicId && params.topics.some((t) => t.id === opt.suggestedTopicId)) {
        topicId = opt.suggestedTopicId;
      }
      aiStatus = 'optimized';
    } catch (err) {
      aiError = err instanceof Error ? err.message : 'Gemini AI error';
      // Graceful fallback: save raw video as aiStatus='pending' so nothing is lost
    }
  } else if (params.autoAiOptimize && !process.env.GEMINI_API_KEY?.trim()) {
    aiError = 'GEMINI_API_KEY chưa được cấu hình trên server.';
  }

  await db
    .collection('videos')
    .doc(videoDocId)
    .set({
      channelId: params.channelDocId,
      topicId,
      youtubeId: clampStr(params.youtubeId, 32),
      channelName: clampStr(params.channelName, 160, 'YouTube'),
      thumbnail,
      duration,
      durationSeconds,
      publishedDate,
      viewCount,
      rawTitle,
      rawDescription,
      titleVi,
      titleEn,
      summaryVi,
      summaryEn,
      descriptionVi,
      descriptionEn,
      highlightsVi,
      highlightsEn,
      seoTitleVi,
      seoTitleEn,
      seoDescriptionVi,
      seoDescriptionEn,
      slugVi,
      slugEn,
      keywordsVi,
      keywordsEn,
      status: params.autoPublishNew ? 'published' : 'draft',
      aiStatus,
      manuallyEdited: false,
      featured: false,
      sortOrder: Math.max(0, Math.min(100000, params.sortOrder)),
      createdBy: 'system_autosync',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  return {
    aiOptimized: aiStatus === 'optimized',
    aiError,
  };
}

/**
 * Real-Time Handler for YouTube WebSub (PubSubHubbub) Push Notifications.
 * Triggered within ~1-5 minutes of a channel uploading a new video.
 */
export async function handleWebSubPushXml(xml: string): Promise<{
  processed: number;
  videosAdded: number;
  videosAiOptimized: number;
  videosAiFailed: number;
}> {
  const startedAt = Date.now();
  const entries = parseYouTubeWebSubAtomXml(xml);
  if (entries.length === 0) {
    return { processed: 0, videosAdded: 0, videosAiOptimized: 0, videosAiFailed: 0 };
  }

  const db = getAdminDb();
  const glossary = await loadGlossaryForAi();

  let videosAdded = 0;
  let videosAiOptimized = 0;
  let videosAiFailed = 0;
  const aiErrors: string[] = [];

  for (const entry of entries) {
    const channelDocId = sanitizeDocId(entry.channelId, 'ch_');
    const channelRef = db.collection('videoChannels').doc(channelDocId);
    const channelSnap = await channelRef.get();
    if (!channelSnap.exists) {
      // Security: ignore push notifications for unregistered channels
      continue;
    }

    const ch = channelSnap.data() || {};
    if (ch.autoSyncEnabled === false || ch.webSubEnabled === false) {
      continue;
    }

    const videoDocId = sanitizeDocId(entry.videoId, 'yt_');
    const existingSnap = await db.collection('videos').doc(videoDocId).get();
    if (existingSnap.exists) {
      // Idempotent & Non-Destructive: never overwrite existing videos or manual edits
      continue;
    }

    const topics = await loadTopicsForChannel(channelDocId);
    const autoAiOptimize = ch.autoAiOptimize !== false;
    const autoPublishNew = ch.autoPublishNew !== false;

    const existingCount = Number(ch.videoCount || 0);
    const res = await upsertNewVideoWithAutoAi({
      channelDocId,
      channelName: String(ch.titleVi || entry.authorName || 'YouTube'),
      youtubeId: entry.videoId,
      rawTitle: entry.title || 'Video YouTube mới',
      rawDescription: '',
      thumbnail: `https://i.ytimg.com/vi/${entry.videoId}/hqdefault.jpg`,
      duration: '',
      durationSeconds: 0,
      publishedDate: entry.published || new Date().toISOString(),
      viewCount: 0,
      topicId: topics[0]?.id || '',
      topics,
      glossary,
      autoAiOptimize,
      autoPublishNew,
      sortOrder: 0, // Surface brand-new uploads at the top of the library
    });

    videosAdded++;
    if (res.aiOptimized) {
      videosAiOptimized++;
    } else if (res.aiError) {
      videosAiFailed++;
      aiErrors.push(res.aiError);
    }

    const summary = `WebSub tức thì: +1 video mới "${entry.title.slice(0, 80)}"${
      res.aiOptimized
        ? ' (Gemini AI đã tối ưu song ngữ & xuất bản)'
        : res.aiError
          ? ' (Đã lưu video, chờ AI tối ưu lại)'
          : ''
    }`;

    await channelRef.update({
      videoCount: existingCount + 1,
      lastSyncedAt: new Date().toISOString(),
      lastAutoSyncStatus: res.aiError ? 'partial' : 'success',
      lastAutoSyncSummary: clampStr(summary, 400),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeSyncLog({
      trigger: 'websub_push',
      status: res.aiError ? 'partial' : 'success',
      channelId: channelDocId,
      channelTitle: String(ch.titleVi || entry.authorName || entry.channelId),
      videosAdded: 1,
      videosAiOptimized: res.aiOptimized ? 1 : 0,
      videosAiFailed: res.aiError ? 1 : 0,
      topicsAdded: 0,
      webSubRenewed: 0,
      summary,
      errorDetail: aiErrors.join(' | '),
      durationMs: Date.now() - startedAt,
    });
  }

  return {
    processed: entries.length,
    videosAdded,
    videosAiOptimized,
    videosAiFailed,
  };
}

/**
 * Scheduled Daily Reconciliation Sync (Cloud Scheduler -> POST /api/cron/sync-youtube)
 * Also callable manually by verified CMS Admins from /admin.
 *
 * Responsibilities:
 * 1. Renew YouTube WebSub leases before expiry (so real-time push never lapses).
 * 2. Scan connected channels for new playlists/topics & missed videos (non-destructive).
 * 3. Mode A: Auto-optimize newly discovered videos with Gemini AI & publish immediately
 *    (with graceful fallback if Gemini quota is temporarily exhausted).
 * 4. Write complete observability records to /videoSyncLogs.
 */
export async function runScheduledYouTubeSync(options: {
  trigger: SyncTriggerSource;
  callbackBaseUrl?: string;
  targetChannelId?: string;
  forceRenewWebSub?: boolean;
  maxAiPerRun?: number;
}): Promise<ScheduledSyncRunReport> {
  const runStart = Date.now();
  const db = getAdminDb();
  const maxAiBudget = Math.max(0, Math.min(25, options.maxAiPerRun ?? 10));
  let remainingAiBudget = maxAiBudget;

  const channelsSnap = await db.collection('videoChannels').get();
  const allChannels: Array<Record<string, unknown> & { id: string }> =
    channelsSnap.docs
      .map((d): Record<string, unknown> & { id: string } => ({
        ...(d.data() as Record<string, unknown>),
        id: d.id,
      }))
      .filter((ch) => {
        if (options.targetChannelId) {
          return (
            ch.id === options.targetChannelId ||
            ch.youtubeChannelId === options.targetChannelId
          );
        }
        // By default, channels with autoSyncEnabled !== false participate in scheduled sync
        return ch.autoSyncEnabled !== false;
      });

  if (allChannels.length === 0) {
    const emptyReport: ScheduledSyncRunReport = {
      trigger: options.trigger,
      status: 'success',
      channelsScanned: 0,
      totalTopicsAdded: 0,
      totalVideosAdded: 0,
      totalVideosAiOptimized: 0,
      totalVideosAiFailed: 0,
      totalWebSubRenewed: 0,
      durationMs: Date.now() - runStart,
      results: [],
    };
    await writeSyncLog({
      trigger: options.trigger,
      status: 'success',
      channelId: '',
      channelTitle: 'Hệ thống',
      videosAdded: 0,
      videosAiOptimized: 0,
      videosAiFailed: 0,
      topicsAdded: 0,
      webSubRenewed: 0,
      summary: 'Không có kênh YouTube nào đang bật Tự động quét (Auto-Sync).',
      durationMs: emptyReport.durationMs,
    });
    return emptyReport;
  }

  const glossary = await loadGlossaryForAi();
  const results: ChannelAutoSyncResult[] = [];
  let totalTopicsAdded = 0;
  let totalVideosAdded = 0;
  let totalVideosAiOptimized = 0;
  let totalVideosAiFailed = 0;
  let totalWebSubRenewed = 0;

  for (const ch of allChannels) {
    const chStart = Date.now();
    const channelDocId = ch.id;
    const youtubeChannelId = String(ch.youtubeChannelId || '');
    const channelTitle = String(ch.titleVi || ch.titleEn || youtubeChannelId);
    const channelUrl = String(ch.url || `https://www.youtube.com/channel/${youtubeChannelId}`);
    const webSubEnabled = ch.webSubEnabled !== false;
    const autoAiOptimize = ch.autoAiOptimize !== false;
    const autoPublishNew = ch.autoPublishNew !== false;

    let topicsAdded = 0;
    let videosAdded = 0;
    let videosPreserved = 0;
    let videosAiOptimized = 0;
    let videosAiFailed = 0;
    let webSubRenewed = false;
    const errors: string[] = [];

    try {
      // Step 1: Auto-renew YouTube WebSub lease if expiring within 48 hours (or forced)
      const leaseExpiresStr = String(ch.webSubLeaseExpiresAt || '');
      const leaseExpiresMs = leaseExpiresStr ? Date.parse(leaseExpiresStr) : 0;
      const needsRenew =
        webSubEnabled &&
        Boolean(youtubeChannelId) &&
        Boolean(options.callbackBaseUrl?.startsWith('https://')) &&
        (options.forceRenewWebSub ||
          !leaseExpiresMs ||
          Number.isNaN(leaseExpiresMs) ||
          leaseExpiresMs - Date.now() < 48 * 60 * 60 * 1000);

      if (needsRenew && options.callbackBaseUrl) {
        try {
          const subRes = await subscribeChannelToWebSub({
            youtubeChannelId,
            callbackBaseUrl: options.callbackBaseUrl,
            mode: 'subscribe',
          });
          if (subRes.ok) {
            webSubRenewed = true;
            totalWebSubRenewed++;
            await db.collection('videoChannels').doc(channelDocId).update({
              webSubStatus: ch.webSubStatus === 'active' ? 'active' : 'pending',
              webSubSubscribedAt: new Date().toISOString(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          } else {
            errors.push(`WebSub renew: ${subRes.message}`);
          }
        } catch (subErr) {
          errors.push(
            `WebSub renew: ${subErr instanceof Error ? subErr.message : 'failed'}`
          );
        }
      }

      // Step 2: Fetch fresh channel playlists + videos (Zero-Key or YouTube API v3)
      const imported = await importYouTubeSource({
        url: channelUrl,
        maxPlaylists: 15,
        maxVideosPerPlaylist: 25,
      });

      // Step 3: Load existing topics & videos for this channel
      const existingTopics = await loadTopicsForChannel(channelDocId);
      const existingTopicIds = new Set(existingTopics.map((t) => t.id));
      const playlistToTopicId = new Map<string, string>();
      for (const t of existingTopics) {
        if (t.youtubePlaylistId) {
          playlistToTopicId.set(t.youtubePlaylistId, t.id);
        }
      }

      const newPlaylists = imported.playlists.filter((pl) => {
        const docId = sanitizeDocId(pl.youtubePlaylistId, 'topic_');
        playlistToTopicId.set(pl.youtubePlaylistId, docId);
        return !existingTopicIds.has(docId);
      });

      // Optional Gemini AI translation for brand-new playlists
      const translatedNewTopics = new Map<
        string,
        { titleVi: string; titleEn: string; descriptionVi: string; descriptionEn: string; slug: string }
      >();
      if (
        newPlaylists.length > 0 &&
        autoAiOptimize &&
        process.env.GEMINI_API_KEY?.trim()
      ) {
        try {
          const translated = await translateTopicsWithGemini({
            channelName: channelTitle,
            topics: newPlaylists.map((p) => ({
              id: p.youtubePlaylistId,
              rawTitle: p.title,
            })),
            glossary,
          });
          for (const item of translated) {
            translatedNewTopics.set(item.id, item);
          }
        } catch {
          // Non-fatal: fall back to original playlist titles
        }
      }

      for (const pl of newPlaylists) {
        const topicDocId = sanitizeDocId(pl.youtubePlaylistId, 'topic_');
        const loc = translatedNewTopics.get(pl.youtubePlaylistId);
        await db
          .collection('videoTopics')
          .doc(topicDocId)
          .set({
            channelId: channelDocId,
            youtubePlaylistId: clampStr(pl.youtubePlaylistId, 120),
            titleVi: clampStr(loc?.titleVi || pl.title, 140, 'Chủ đề mới'),
            titleEn: clampStr(loc?.titleEn || pl.title, 140, 'New Topic'),
            descriptionVi: clampStr(loc?.descriptionVi || pl.description || '', 420),
            descriptionEn: clampStr(loc?.descriptionEn || pl.description || '', 420),
            slug: slugify(loc?.slug || pl.title, topicDocId),
            sortOrder: existingTopics.length + topicsAdded,
            published: true,
            createdBy: 'system_autosync',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        existingTopics.push({
          id: topicDocId,
          youtubePlaylistId: pl.youtubePlaylistId,
          titleVi: clampStr(loc?.titleVi || pl.title, 140, 'Chủ đề mới'),
          titleEn: clampStr(loc?.titleEn || pl.title, 140, 'New Topic'),
        });
        topicsAdded++;
      }

      // Step 4: Non-destructive video sync + Mode A Auto-AI & Auto-Publish
      const existingVideosSnap = await db
        .collection('videos')
        .where('channelId', '==', channelDocId)
        .get();
      const existingVideoIds = new Set(existingVideosSnap.docs.map((d) => d.id));

      let geminiQuotaExhausted = false;

      for (let i = 0; i < imported.videos.length; i++) {
        const v = imported.videos[i];
        const videoDocId = sanitizeDocId(v.youtubeId, 'yt_');
        if (existingVideoIds.has(videoDocId)) {
          videosPreserved++;
          continue;
        }

        let mappedTopicId = '';
        for (const pid of v.playlistIds) {
          const tid = playlistToTopicId.get(pid);
          if (tid) {
            mappedTopicId = tid;
            break;
          }
        }

        const shouldRunAi =
          autoAiOptimize && !geminiQuotaExhausted && remainingAiBudget > 0;
        if (shouldRunAi) {
          remainingAiBudget--;
        }

        const res = await upsertNewVideoWithAutoAi({
          channelDocId,
          channelName: v.channelName || channelTitle,
          youtubeId: v.youtubeId,
          rawTitle: v.title,
          rawDescription: v.description,
          thumbnail: v.thumbnail,
          duration: v.duration,
          durationSeconds: v.durationSeconds,
          publishedDate: v.publishedDate,
          viewCount: v.viewCount,
          topicId: mappedTopicId,
          topics: existingTopics.map((t) => ({
            id: t.id,
            titleVi: t.titleVi,
            titleEn: t.titleEn,
          })),
          glossary,
          autoAiOptimize: shouldRunAi,
          autoPublishNew,
          sortOrder: existingVideosSnap.size + videosAdded,
        });

        videosAdded++;
        if (res.aiOptimized) {
          videosAiOptimized++;
        } else if (res.aiError) {
          videosAiFailed++;
          if (
            res.aiError.includes('RESOURCE_EXHAUSTED') ||
            res.aiError.includes('prepayment credits') ||
            res.aiError.includes('429')
          ) {
            // Stop hammering Gemini if credits are depleted; still ingest remaining raw videos cleanly
            geminiQuotaExhausted = true;
          }
          if (errors.length < 3) {
            errors.push(`AI (${v.youtubeId}): ${res.aiError.slice(0, 140)}`);
          }
        }
      }

      const status: 'success' | 'partial' | 'error' =
        errors.length > 0 ? 'partial' : 'success';
      const summary =
        videosAdded > 0 || topicsAdded > 0
          ? `Quét xong ${channelTitle}: +${videosAdded} video mới (${videosAiOptimized} tối ưu AI${
              videosAiFailed > 0 ? `, ${videosAiFailed} chờ AI` : ''
            }), +${topicsAdded} chủ đề, giữ nguyên ${videosPreserved} video đã có.${
              webSubRenewed ? ' Đã gia hạn WebSub.' : ''
            }`
          : `Kênh ${channelTitle} đã cập nhật mới nhất (${videosPreserved} video được giữ nguyên).${
              webSubRenewed ? ' Đã gia hạn WebSub.' : ''
            }`;

      await db
        .collection('videoChannels')
        .doc(channelDocId)
        .update({
          videoCount: Math.max(existingVideosSnap.size + videosAdded, imported.videos.length),
          lastSyncedAt: new Date().toISOString(),
          lastAutoSyncStatus: status,
          lastAutoSyncSummary: clampStr(summary, 400),
          updatedAt: FieldValue.serverTimestamp(),
        });

      await writeSyncLog({
        trigger: options.trigger,
        status,
        channelId: channelDocId,
        channelTitle,
        videosAdded,
        videosAiOptimized,
        videosAiFailed,
        topicsAdded,
        webSubRenewed: webSubRenewed ? 1 : 0,
        summary,
        errorDetail: errors.join(' | '),
        durationMs: Date.now() - chStart,
      });

      totalTopicsAdded += topicsAdded;
      totalVideosAdded += videosAdded;
      totalVideosAiOptimized += videosAiOptimized;
      totalVideosAiFailed += videosAiFailed;

      results.push({
        channelId: channelDocId,
        youtubeChannelId,
        channelTitle,
        topicsAdded,
        videosAdded,
        videosPreserved,
        videosAiOptimized,
        videosAiFailed,
        webSubRenewed,
        status,
        summary,
        errorDetail: errors.join(' | ') || undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi quét kênh YouTube.';
      await db
        .collection('videoChannels')
        .doc(channelDocId)
        .update({
          lastAutoSyncStatus: 'error',
          lastAutoSyncSummary: clampStr(`Lỗi đồng bộ tự động: ${msg}`, 400),
          updatedAt: FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      await writeSyncLog({
        trigger: options.trigger,
        status: 'error',
        channelId: channelDocId,
        channelTitle,
        videosAdded,
        videosAiOptimized,
        videosAiFailed,
        topicsAdded,
        webSubRenewed: webSubRenewed ? 1 : 0,
        summary: `Đồng bộ kênh ${channelTitle} gặp lỗi.`,
        errorDetail: msg,
        durationMs: Date.now() - chStart,
      });

      results.push({
        channelId: channelDocId,
        youtubeChannelId,
        channelTitle,
        topicsAdded,
        videosAdded,
        videosPreserved,
        videosAiOptimized,
        videosAiFailed,
        webSubRenewed,
        status: 'error',
        summary: `Đồng bộ kênh ${channelTitle} gặp lỗi.`,
        errorDetail: msg,
      });
    }
  }

  const anyError = results.some((r) => r.status === 'error');
  const anyPartial = results.some((r) => r.status === 'partial');
  const overallStatus: 'success' | 'partial' | 'error' =
    anyError && results.every((r) => r.status === 'error')
      ? 'error'
      : anyError || anyPartial
        ? 'partial'
        : 'success';

  return {
    trigger: options.trigger,
    status: overallStatus,
    channelsScanned: results.length,
    totalTopicsAdded,
    totalVideosAdded,
    totalVideosAiOptimized,
    totalVideosAiFailed,
    totalWebSubRenewed,
    durationMs: Date.now() - runStart,
    results,
  };
}

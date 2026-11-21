import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  fetchSingleVideoDetails,
  importYouTubeSource,
} from './server/youtubeService.js';
import {
  optimizeVideoWithGemini,
  translateTopicsWithGemini,
} from './server/geminiVideoService.js';
import {
  checkAdminFirestoreReadiness,
  formatAdminSdkError,
  getAdminDb,
  verifyAdminRequest,
  verifyCronOrAdminRequest,
} from './server/firebaseAdmin.js';
import {
  extractChannelIdFromTopicUrl,
  handleWebSubPushXml,
  recordWebSubVerification,
  resolvePublicBaseUrl,
  runScheduledYouTubeSync,
  subscribeChannelToWebSub,
  verifyWebSubSignature,
} from './server/videoAutoSyncService.js';
import {
  clearSeoCache,
  generateRobotsTxt,
  generateSitemapXml,
  injectDynamicSeoHtml,
  resolveCanonicalBaseUrl,
} from './server/seoService.js';
import { FieldValue } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || (isProd ? 8080 : 3000);

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  // Basic security headers (matches Cloud Run / Nginx hardening)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health check endpoint for Cloud Run readiness
  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      service: 'meet-boston-fullstack',
      canonicalBaseUrl: resolveCanonicalBaseUrl(req),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      youtubeApiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
      cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
      webSubSecretConfigured: Boolean(process.env.WEBSUB_SECRET?.trim()),
    });
  });

  // Domain-agnostic dynamic robots.txt (automatically reflects active domain or PUBLIC_APP_URL)
  app.get('/robots.txt', (req, res) => {
    const baseUrl = resolveCanonicalBaseUrl(req);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(generateRobotsTxt(baseUrl));
  });

  // Domain-agnostic dynamic sitemap.xml with Google Video Sitemap extensions
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const baseUrl = resolveCanonicalBaseUrl(req);
      const xml = await generateSitemapXml(baseUrl);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(xml);
    } catch (err) {
      console.error('[Sitemap] Generation failed:', err);
      res.status(500).send('Unable to generate sitemap');
    }
  });

  // 1. YouTube Channel / Playlist / Video Importer (Zero-Key default + optional YouTube API v3)
  app.post('/api/youtube/import', async (req, res) => {
    try {
      const { url, maxPlaylists, maxVideosPerPlaylist } = req.body || {};
      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({
          error: 'Vui lòng nhập đường dẫn kênh YouTube, @handle hoặc playlist.',
        });
        return;
      }

      const result = await importYouTubeSource({
        url: url.trim(),
        maxPlaylists:
          typeof maxPlaylists === 'number' ? maxPlaylists : undefined,
        maxVideosPerPlaylist:
          typeof maxVideosPerPlaylist === 'number'
            ? maxVideosPerPlaylist
            : undefined,
      });

      res.json(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Không thể lấy dữ liệu từ YouTube.';
      res.status(502).json({ error: message });
    }
  });

  // 2. Fetch full details (description, duration, publishDate) for a single YouTube video
  app.post('/api/youtube/video-details', async (req, res) => {
    try {
      const { videoId } = req.body || {};
      if (!videoId || typeof videoId !== 'string') {
        res.status(400).json({ error: 'Thiếu mã YouTube videoId.' });
        return;
      }
      const details = await fetchSingleVideoDetails(videoId);
      res.json(details);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Không thể tải chi tiết video từ YouTube.';
      res.status(502).json({ error: message });
    }
  });

  function formatGeminiRouteError(err: unknown, fallback: string): {
    status: number;
    message: string;
  } {
    const raw = err instanceof Error ? err.message : fallback;
    let extracted = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string; status?: string; code?: number } };
      if (parsed?.error?.message) {
        extracted = parsed.error.message;
      }
    } catch {
      // raw is already plain text
    }
    if (
      raw.includes('RESOURCE_EXHAUSTED') ||
      raw.includes('prepayment credits') ||
      raw.includes('429')
    ) {
      return {
        status: 429,
        message: `Hạn mức/tín dụng Gemini API hiện đã hết (${extracted}). Vui lòng kiểm tra khóa API trong Settings > Secrets hoặc biến môi trường GEMINI_API_KEY trên Cloud Run.`,
      };
    }
    if (raw.includes('API_KEY') || raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
      return {
        status: 403,
        message: `Khóa Gemini API chưa hợp lệ hoặc chưa được cấu hình (${extracted}). Vui lòng kiểm tra trong Settings > Secrets.`,
      };
    }
    return { status: 500, message: extracted };
  }

  // 3. Gemini AI: Context-aware VI/EN translation, SEO optimization & topic classification
  app.post('/api/ai/optimize-video', async (req, res) => {
    try {
      const {
        youtubeId,
        rawTitle,
        rawDescription,
        channelName,
        currentTopicId,
        topics,
        glossary,
        fetchMissingDescription,
      } = req.body || {};

      if (!youtubeId || !rawTitle) {
        res
          .status(400)
          .json({ error: 'Thiếu youtubeId hoặc tiêu đề gốc của video.' });
        return;
      }

      let effectiveDescription =
        typeof rawDescription === 'string' ? rawDescription : '';
      let fetchedDetails: {
        description?: string;
        duration?: string;
        durationSeconds?: number;
        publishedDate?: string;
        viewCount?: number;
      } | null = null;

      // Auto-enrich missing YouTube description before Gemini translates!
      if (fetchMissingDescription && effectiveDescription.trim().length < 25) {
        try {
          const det = await fetchSingleVideoDetails(String(youtubeId));
          if (det.description) {
            effectiveDescription = det.description;
          }
          fetchedDetails = {
            description: det.description,
            duration: det.duration,
            durationSeconds: det.durationSeconds,
            publishedDate: det.publishedDate,
            viewCount: det.viewCount,
          };
        } catch {
          // Proceed with title + channel context if watch fetch fails
        }
      }

      const optimized = await optimizeVideoWithGemini({
        youtubeId: String(youtubeId),
        rawTitle: String(rawTitle),
        rawDescription: effectiveDescription,
        channelName: String(channelName || 'YouTube Channel'),
        currentTopicId:
          typeof currentTopicId === 'string' ? currentTopicId : undefined,
        topics: Array.isArray(topics) ? topics : [],
        glossary: Array.isArray(glossary) ? glossary : [],
      });

      res.json({
        optimized,
        enrichedMetadata: fetchedDetails,
      });
    } catch (err: unknown) {
      const formatted = formatGeminiRouteError(
        err,
        'Lỗi khi gọi Google Gemini AI tối ưu video.'
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 4. Gemini AI: Batch translate & SEO-format YouTube playlist topic names
  app.post('/api/ai/translate-topics', async (req, res) => {
    try {
      const { channelName, topics, glossary } = req.body || {};
      if (!Array.isArray(topics) || topics.length === 0) {
        res.status(400).json({ error: 'Danh sách chủ đề trống.' });
        return;
      }

      const translated = await translateTopicsWithGemini({
        channelName: String(channelName || 'YouTube Channel'),
        topics,
        glossary: Array.isArray(glossary) ? glossary : [],
      });

      res.json({ topics: translated });
    } catch (err: unknown) {
      const formatted = formatGeminiRouteError(
        err,
        'Lỗi khi dịch danh sách chủ đề bằng Gemini AI.'
      );
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // =========================================================================
  // 5. HYBRID AUTO-SYNC: YOUTUBE WEBSUB (PUBSUBHUBBUB) + CLOUD SCHEDULER CRON
  // =========================================================================

  // 5a. YouTube WebSub Verification Challenge (GET /api/webhooks/youtube)
  app.get('/api/webhooks/youtube', async (req, res) => {
    const mode = String(req.query['hub.mode'] || '');
    const topic = String(req.query['hub.topic'] || '');
    const challenge = String(req.query['hub.challenge'] || '');
    const leaseSeconds = Number(req.query['hub.lease_seconds'] || 0);

    if (!challenge || !topic || (mode !== 'subscribe' && mode !== 'unsubscribe')) {
      res.status(400).send('Invalid WebSub verification request.');
      return;
    }

    const youtubeChannelId = extractChannelIdFromTopicUrl(topic);
    if (!youtubeChannelId) {
      res.status(400).send('Unsupported YouTube topic URL.');
      return;
    }

    try {
      await recordWebSubVerification({
        youtubeChannelId,
        mode,
        leaseSeconds: leaseSeconds || undefined,
      });
    } catch (err) {
      console.warn('[WebSub GET] Could not persist lease confirmation:', err);
    }

    // Echo exact challenge as plain text per W3C WebSub spec
    res.status(200).type('text/plain').send(challenge);
  });

  // 5b. YouTube WebSub Real-Time Push Notification (POST /api/webhooks/youtube)
  app.post(
    '/api/webhooks/youtube',
    express.text({
      type: ['application/atom+xml', 'application/xml', 'text/xml', 'text/plain'],
      limit: '1mb',
    }),
    async (req, res) => {
      const rawXml = typeof req.body === 'string' ? req.body : '';
      if (!rawXml.trim()) {
        res.status(204).end();
        return;
      }

      const sigCheck = verifyWebSubSignature(
        rawXml,
        req.header('x-hub-signature')
      );
      if (!sigCheck.valid) {
        res.status(403).json({ error: sigCheck.reason || 'Invalid WebSub signature' });
        return;
      }

      try {
        const result = await handleWebSubPushXml(rawXml);
        clearSeoCache();
        res.status(200).json({ ok: true, ...result });
      } catch (err) {
        console.error('[WebSub POST] Processing failed:', err);
        res.status(500).json({ error: formatAdminSdkError(err) });
      }
    }
  );

  // 5c. Cloud Scheduler Daily Reconciliation & WebSub Renewal (POST /api/cron/sync-youtube)
  app.post('/api/cron/sync-youtube', async (req, res) => {
    const authResult = await verifyCronOrAdminRequest(req);
    if (!authResult.ok) {
      res.status(401).json({ error: authResult.reason });
      return;
    }

    try {
      const { channelId, forceRenewWebSub, maxAiPerRun } = req.body || {};
      const callbackBaseUrl = resolvePublicBaseUrl(
        req.header('x-forwarded-host') || req.get('host'),
        req.header('x-forwarded-proto') || req.protocol
      );

      const report = await runScheduledYouTubeSync({
        trigger:
          authResult.source === 'cron_secret' ? 'cron_scheduler' : 'admin_manual',
        callbackBaseUrl: callbackBaseUrl || undefined,
        targetChannelId: typeof channelId === 'string' ? channelId.trim() : undefined,
        forceRenewWebSub: Boolean(forceRenewWebSub),
        maxAiPerRun: typeof maxAiPerRun === 'number' ? maxAiPerRun : 10,
      });

      clearSeoCache();
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: formatAdminSdkError(err) });
    }
  });

  // 5d. Admin-only: Activate / Renew / Unsubscribe YouTube WebSub for a channel
  app.post('/api/admin/websub/subscribe', async (req, res) => {
    const admin = await verifyAdminRequest(req);
    if (!admin) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập tài khoản Quản trị viên.' });
      return;
    }

    const { channelId, youtubeChannelId, mode, callbackBaseUrl } = req.body || {};
    if (!youtubeChannelId || typeof youtubeChannelId !== 'string') {
      res.status(400).json({ error: 'Thiếu mã kênh YouTube (youtubeChannelId).' });
      return;
    }

    const resolvedBase =
      (typeof callbackBaseUrl === 'string' && callbackBaseUrl.trim().startsWith('https://')
        ? callbackBaseUrl.trim().replace(/\/+$/, '')
        : '') ||
      resolvePublicBaseUrl(
        req.header('x-forwarded-host') || req.get('host'),
        req.header('x-forwarded-proto') || req.protocol
      );

    try {
      const actionMode = mode === 'unsubscribe' ? 'unsubscribe' : 'subscribe';
      const result = await subscribeChannelToWebSub({
        youtubeChannelId: youtubeChannelId.trim(),
        callbackBaseUrl: resolvedBase,
        mode: actionMode,
      });

      // Best-effort update status in Firestore via Admin SDK
      if (channelId && typeof channelId === 'string') {
        try {
          const db = getAdminDb();
          await db
            .collection('videoChannels')
            .doc(channelId)
            .update({
              webSubEnabled: actionMode === 'subscribe',
              webSubStatus:
                actionMode === 'unsubscribe'
                  ? 'inactive'
                  : result.ok
                    ? 'pending'
                    : 'error',
              webSubSubscribedAt:
                actionMode === 'subscribe' && result.ok
                  ? new Date().toISOString()
                  : '',
              updatedAt: FieldValue.serverTimestamp(),
            });
        } catch {
          // Client UI can still update via Firestore client SDK if server IAM is not yet granted
        }
      }

      res.status(result.ok ? 200 : 502).json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Không thể đăng ký YouTube WebSub.',
      });
    }
  });

  // 5e. Admin-only: Server Automation Readiness Check (never exposes secrets or metadata)
  app.get('/api/admin/automation/status', async (req, res) => {
    const admin = await verifyAdminRequest(req);
    if (!admin) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập tài khoản Quản trị viên.' });
      return;
    }

    const callbackBaseUrl = resolvePublicBaseUrl(
      req.header('x-forwarded-host') || req.get('host'),
      req.header('x-forwarded-proto') || req.protocol
    );
    const firestoreReadiness = await checkAdminFirestoreReadiness();

    res.json({
      cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
      webSubSecretConfigured: Boolean(process.env.WEBSUB_SECRET?.trim()),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      youtubeApiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
      publicBaseUrl: callbackBaseUrl,
      webSubCallbackUrl: callbackBaseUrl
        ? `${callbackBaseUrl}/api/webhooks/youtube`
        : '',
      cronEndpointUrl: callbackBaseUrl
        ? `${callbackBaseUrl}/api/cron/sync-youtube`
        : '',
      adminSdkReady: firestoreReadiness.ready,
      adminSdkError: firestoreReadiness.error || '',
    });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexPath = path.join(distDir, 'index.html');

    // Immutable caching for Vite hashed assets
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );

    // Static public files & copied /src/assets/images
    app.use(
      express.static(distDir, {
        maxAge: '1d',
        index: false,
      })
    );

    // SPA fallback for /, /admin, /videos, /videos/:slug with dynamic SEO meta & JSON-LD
    app.get('*', async (req, res) => {
      if (!fs.existsSync(indexPath)) {
        res.status(404).send('Build output not found. Run npm run build.');
        return;
      }
      try {
        const rawHtml = await fs.promises.readFile(indexPath, 'utf8');
        const enrichedHtml = await injectDynamicSeoHtml(rawHtml, req);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        );
        res.send(enrichedHtml);
      } catch (err) {
        console.error('[SEO HTML Inject] Fallback to static index.html:', err);
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Meet Boston Server] Listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`
    );
  });
}

startServer().catch((err) => {
  console.error('[Meet Boston Server] Failed to start:', err);
  process.exit(1);
});

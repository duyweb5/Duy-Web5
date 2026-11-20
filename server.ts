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
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'meet-boston-fullstack',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      youtubeApiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
    });
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

    // SPA fallback for /, /admin, /videos, /videos/:slug
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexPath)) {
        res.setHeader(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        );
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
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

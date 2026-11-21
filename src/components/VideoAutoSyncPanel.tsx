import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Loader2,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Youtube,
} from 'lucide-react';
import { Language } from '../data/bostonData';
import {
  ServerAutomationStatus,
  VideoChannelRecord,
  VideoSyncLogRecord,
  deleteVideoSyncLog,
  fetchServerAutomationStatus,
  manageChannelWebSub,
  saveVideoChannel,
  triggerServerAutoSync,
} from '../lib/videoService';

interface VideoAutoSyncPanelProps {
  uid: string;
  adminLang: Language;
  channels: VideoChannelRecord[];
  syncLogs: VideoSyncLogRecord[];
  onNotice: (msg: string) => void;
  onGoToImport: () => void;
}

const DEFAULT_PROD_BASE_URL = 'https://meetboston.duyvo.win';
const GCP_PROJECT_ID = 'gen-lang-client-0440115237';

function formatIsoDate(iso?: string | null, isVi = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(isVi ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatDuration(ms: number): string {
  if (!ms || ms < 1000) return `${ms || 0}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function VideoAutoSyncPanel({
  uid,
  adminLang,
  channels,
  syncLogs,
  onNotice,
  onGoToImport,
}: VideoAutoSyncPanelProps) {
  const isVi = adminLang === 'vi';

  const [status, setStatus] = useState<ServerAutomationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  const [runningCron, setRunningCron] = useState(false);
  const [busyChannelId, setBusyChannelId] = useState<string | null>(null);
  const [customCallbackBase, setCustomCallbackBase] = useState(DEFAULT_PROD_BASE_URL);
  const [showDevOpsGuide, setShowDevOpsGuide] = useState(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoadingStatus(true);
    setStatusError('');
    try {
      const s = await fetchServerAutomationStatus();
      setStatus(s);
      if (s.publicBaseUrl && s.publicBaseUrl.startsWith('https://')) {
        setCustomCallbackBase(s.publicBaseUrl);
      }
    } catch (err) {
      setStatusError(
        err instanceof Error ? err.message : 'Không thể kiểm tra trạng thái server.'
      );
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const handleToggleChannelField = async (
    ch: VideoChannelRecord,
    field: 'autoSyncEnabled' | 'webSubEnabled' | 'autoAiOptimize' | 'autoPublishNew',
    nextVal: boolean
  ) => {
    setBusyChannelId(ch.id);
    try {
      await saveVideoChannel(
        {
          ...ch,
          [field]: nextVal,
        },
        uid
      );
      onNotice(
        isVi
          ? `Đã cập nhật cấu hình tự động cho kênh "${ch.titleVi}".`
          : `Updated automation settings for "${ch.titleEn || ch.titleVi}".`
      );
    } catch (err) {
      onNotice(
        err instanceof Error ? err.message : 'Không thể lưu cấu hình kênh.'
      );
    } finally {
      setBusyChannelId(null);
    }
  };

  const handleRunCronNow = async (channelId?: string) => {
    setRunningCron(true);
    try {
      const report = await triggerServerAutoSync({
        channelId,
        forceRenewWebSub: true,
        maxAiPerRun: 10,
      });
      onNotice(
        isVi
          ? `Đồng bộ hoàn tất (${formatDuration(report.durationMs)}): +${report.totalVideosAdded} video mới (${report.totalVideosAiOptimized} tối ưu AI), +${report.totalTopicsAdded} chủ đề, ${report.totalWebSubRenewed} WebSub gia hạn.`
          : `Sync finished (${formatDuration(report.durationMs)}): +${report.totalVideosAdded} new videos (${report.totalVideosAiOptimized} AI-optimized), +${report.totalTopicsAdded} topics.`
      );
      await loadStatus();
    } catch (err) {
      onNotice(
        err instanceof Error ? err.message : 'Không thể chạy đồng bộ tự động.'
      );
    } finally {
      setRunningCron(false);
    }
  };

  const handleWebSubAction = async (
    ch: VideoChannelRecord,
    mode: 'subscribe' | 'unsubscribe'
  ) => {
    setBusyChannelId(ch.id);
    try {
      const res = await manageChannelWebSub({
        channelId: ch.id,
        youtubeChannelId: ch.youtubeChannelId,
        mode,
        callbackBaseUrl: customCallbackBase.trim(),
      });
      // Also mirror status via client SDK so UI reflects immediately even before server IAM is granted
      await saveVideoChannel(
        {
          ...ch,
          webSubEnabled: mode === 'subscribe',
          webSubStatus:
            mode === 'unsubscribe' ? 'inactive' : res.ok ? 'pending' : 'error',
          webSubSubscribedAt:
            mode === 'subscribe' && res.ok ? new Date().toISOString() : '',
        },
        uid
      );
      onNotice(res.message);
    } catch (err) {
      onNotice(
        err instanceof Error ? err.message : 'Lỗi khi thao tác WebSub.'
      );
    } finally {
      setBusyChannelId(null);
    }
  };

  const copyCommand = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCmd(key);
      window.setTimeout(() => setCopiedCmd(null), 2000);
    } catch {
      onNotice(isVi ? 'Không thể sao chép tự động.' : 'Copy failed.');
    }
  };

  const effectiveDomain =
    (customCallbackBase || DEFAULT_PROD_BASE_URL).replace(/\/+$/, '');

  const cmdStep1Iam = `PROJECT_NUMBER=$(gcloud projects describe ${GCP_PROJECT_ID} --format="value(projectNumber)")
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \\
  --member="serviceAccount:\${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \\
  --role="roles/datastore.user"`;

  const cmdStep2Env = `CRON_SECRET=$(openssl rand -hex 24)
WEBSUB_SECRET=$(openssl rand -hex 24)
echo "Luu lai CRON_SECRET de dung o Buoc 3: $CRON_SECRET"

gcloud run services update YOUR_CLOUD_RUN_SERVICE \\
  --project=${GCP_PROJECT_ID} \\
  --region=YOUR_REGION \\
  --update-env-vars="PUBLIC_APP_URL=${effectiveDomain},CRON_SECRET=\${CRON_SECRET},WEBSUB_SECRET=\${WEBSUB_SECRET}"`;

  const cmdStep3Scheduler = `gcloud scheduler jobs create http meet-boston-youtube-daily-sync \\
  --project=${GCP_PROJECT_ID} \\
  --location=us-east1 \\
  --schedule="0 6 * * *" \\
  --time-zone="America/New_York" \\
  --uri="${effectiveDomain}/api/cron/sync-youtube" \\
  --http-method=POST \\
  --headers="Content-Type=application/json,X-Cron-Secret=\${CRON_SECRET}" \\
  --message-body='{"forceRenewWebSub":true,"maxAiPerRun":10}'`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[#0A2239]/15 bg-[#0A2239] p-6 text-white">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-amber-300">
              <Radio className="h-3.5 w-3.5" />
              <span>
                {isVi
                  ? 'Kiến trúc Hybrid Production · Chế độ A (Tự AI + Tự Xuất bản)'
                  : 'Hybrid Production Sync · Mode A (Auto-AI + Auto-Publish)'}
              </span>
            </div>
            <h3 className="mt-1.5 font-display text-xl font-extrabold">
              {isVi
                ? 'Tự động bắt video mới tức thì (WebSub) & Quét lịch Cloud Scheduler'
                : 'Real-Time YouTube WebSub Push & Daily Cloud Scheduler Sync'}
            </h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/80">
              {isVi
                ? 'Khi kênh đăng video mới, Google PubSubHubbub đẩy thông báo trực tiếp sang Cloud Run trong 1–5 phút. Đồng thời Cloud Scheduler chạy mỗi ngày để tự gia hạn thuê bao WebSub và đồng bộ toàn bộ Playlist mà không bao giờ ghi đè bài bạn đã chỉnh sửa.'
                : 'New uploads arrive in 1–5 minutes via YouTube PubSubHubbub push, backed by a daily Cloud Scheduler job that renews WebSub leases and reconciles playlists non-destructively.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loadingStatus}
              onClick={() => void loadStatus()}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3.5 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`}
              />
              <span>{isVi ? 'Kiểm tra Server' : 'Check Server'}</span>
            </button>
            <button
              type="button"
              disabled={runningCron || channels.length === 0}
              onClick={() => void handleRunCronNow()}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#A10C24] disabled:opacity-50"
            >
              {runningCron ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" />
              )}
              <span>
                {runningCron
                  ? isVi
                    ? 'Đang quét & tối ưu...'
                    : 'Running Sync...'
                  : isVi
                    ? 'Chạy quét & gia hạn ngay'
                    : 'Run Sync Now'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Server Readiness Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526071]">
              Firebase Admin SDK (ADC)
            </span>
            {status?.adminSdkReady ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
          </div>
          <p className="mt-1.5 text-sm font-bold text-[#0A2239]">
            {loadingStatus
              ? isVi
                ? 'Đang kiểm tra...'
                : 'Checking...'
              : status?.adminSdkReady
                ? isVi
                  ? 'Sẵn sàng ghi Firestore'
                  : 'Firestore Write Ready'
                : isVi
                  ? 'Cần cấp quyền IAM'
                  : 'Needs IAM Role'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#526071]">
            {status?.adminSdkReady
              ? 'roles/datastore.user'
              : isVi
                ? 'Cấp roles/datastore.user trên GCP'
                : 'Grant roles/datastore.user'}
          </p>
        </div>

        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526071]">
              Cloud Scheduler (CRON_SECRET)
            </span>
            {status?.cronSecretConfigured ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
          </div>
          <p className="mt-1.5 text-sm font-bold text-[#0A2239]">
            {status?.cronSecretConfigured
              ? isVi
                ? 'Đã khóa bảo mật'
                : 'Secured'
              : isVi
                ? 'Chưa đặt biến môi trường'
                : 'Not Configured'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[#526071]">
            POST /api/cron/sync-youtube
          </p>
        </div>

        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526071]">
              WebSub HMAC (WEBSUB_SECRET)
            </span>
            {status?.webSubSecretConfigured ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <Bell className="h-4 w-4 text-[#0A2239]" />
            )}
          </div>
          <p className="mt-1.5 text-sm font-bold text-[#0A2239]">
            {status?.webSubSecretConfigured
              ? isVi
                ? 'Xác thực chữ ký SHA-1'
                : 'HMAC-SHA1 Active'
              : isVi
                ? 'Tùy chọn (khuyên đặt)'
                : 'Optional (Recommended)'}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-[#526071]">
            /api/webhooks/youtube
          </p>
        </div>

        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#526071]">
              Google Gemini AI (Chế độ A)
            </span>
            {status?.geminiConfigured ? (
              <Sparkles className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
          </div>
          <p className="mt-1.5 text-sm font-bold text-[#0A2239]">
            {status?.geminiConfigured
              ? isVi
                ? 'Đã gắn GEMINI_API_KEY'
                : 'API Key Attached'
              : isVi
                ? 'Thiếu GEMINI_API_KEY'
                : 'Missing API Key'}
          </p>
          <p className="mt-0.5 text-[11px] text-[#526071]">
            {isVi
              ? 'Tự dịch VI/EN + SEO khi có video mới'
              : 'Auto VI/EN SEO on new uploads'}
          </p>
        </div>
      </div>

      {/* Warning banner if Admin SDK IAM not granted yet */}
      {(statusError || (status && !status.adminSdkReady && status.adminSdkError)) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1">
            <p className="font-bold">
              {isVi
                ? 'Cần cấp quyền IAM để Server tự ghi Firestore (chỉ cần chạy 1 lần trên GCP)'
                : 'IAM Permission Required for Server-Side Firestore Sync'}
            </p>
            <p>{statusError || status?.adminSdkError}</p>
          </div>
        </div>
      )}

      {/* Per-Channel Automation Controls */}
      <div className="rounded-2xl border border-[#E3E7EE] bg-white p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-[#E3E7EE] pb-4 sm:flex-row sm:items-end">
          <div>
            <h4 className="font-display text-base font-bold text-[#0A2239]">
              {isVi
                ? 'Cấu hình Tự động hóa theo từng Kênh YouTube'
                : 'Per-Channel Auto-Sync & WebSub Controls'}
            </h4>
            <p className="mt-0.5 text-xs text-[#526071]">
              {isVi
                ? 'Bật/tắt quét định kỳ, bắt video mới tức thì qua YouTube WebSub và chính sách Chế độ A (Tự AI + Tự xuất bản).'
                : 'Configure scheduled sync, real-time WebSub push, and Mode A auto-AI publishing per channel.'}
            </p>
          </div>

          <label className="block text-xs sm:w-80">
            <span className="font-semibold text-[#0A2239]">
              {isVi ? 'Tên miền Callback WebSub (HTTPS)' : 'WebSub Callback Base URL'}
            </span>
            <input
              type="url"
              value={customCallbackBase}
              onChange={(e) => setCustomCallbackBase(e.target.value)}
              placeholder="https://meetboston.duyvo.win"
              className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3 font-mono text-xs text-[#0F1B2B]"
            />
          </label>
        </div>

        {channels.length === 0 ? (
          <div className="py-8 text-center">
            <Youtube className="mx-auto h-8 w-8 text-[#C8102E]" />
            <p className="mt-2 text-sm font-semibold text-[#0A2239]">
              {isVi
                ? 'Chưa có kênh YouTube nào trong Firestore'
                : 'No connected YouTube channels yet'}
            </p>
            <p className="mt-1 text-xs text-[#526071]">
              {isVi
                ? 'Hãy đồng bộ lần đầu kênh Lang Thang Boston (hoặc kênh bất kỳ) ở tab "Đồng bộ Kênh YouTube & CTA" để kích hoạt lịch tự động.'
                : 'Import a channel first in the "YouTube Sync & CTA" tab to enable automation.'}
            </p>
            <button
              type="button"
              onClick={onGoToImport}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#A10C24]"
            >
              <span>{isVi ? 'Đi tới Nhập Kênh YouTube' : 'Go to YouTube Import'}</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {channels.map((ch) => {
              const isBusy = busyChannelId === ch.id || runningCron;
              const autoSync = ch.autoSyncEnabled !== false;
              const webSubOn = ch.webSubEnabled !== false;
              const autoAi = ch.autoAiOptimize !== false;
              const autoPub = ch.autoPublishNew !== false;

              const wsStatus = ch.webSubStatus || 'inactive';
              const wsBadge =
                wsStatus === 'active'
                  ? {
                      text: isVi ? 'WebSub Đang hoạt động' : 'WebSub Active',
                      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                    }
                  : wsStatus === 'pending'
                    ? {
                        text: isVi ? 'WebSub Chờ Hub xác minh' : 'WebSub Pending Verify',
                        cls: 'border-amber-200 bg-amber-50 text-amber-700',
                      }
                    : wsStatus === 'error'
                      ? {
                          text: isVi ? 'WebSub Lỗi' : 'WebSub Error',
                          cls: 'border-red-200 bg-red-50 text-[#C8102E]',
                        }
                      : {
                          text: isVi ? 'WebSub Chưa kích hoạt' : 'WebSub Inactive',
                          cls: 'border-slate-200 bg-slate-50 text-slate-600',
                        };

              return (
                <div
                  key={ch.id}
                  className="rounded-xl border border-[#E3E7EE] bg-[#F7F8FA]/50 p-4"
                >
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Youtube className="h-4 w-4 text-[#C8102E]" />
                        <span className="font-display text-sm font-bold text-[#0A2239]">
                          {ch.titleVi}
                        </span>
                        <span className="font-mono text-[11px] text-[#526071]">
                          {ch.youtubeChannelId}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${wsBadge.cls}`}
                        >
                          <Radio className="h-3 w-3" />
                          <span>{wsBadge.text}</span>
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#526071]">
                        <span>
                          {isVi ? 'Đồng bộ gần nhất:' : 'Last sync:'}{' '}
                          <strong className="text-[#0F1B2B]">
                            {formatIsoDate(ch.lastSyncedAt, isVi)}
                          </strong>
                        </span>
                        {ch.webSubLeaseExpiresAt && (
                          <span>
                            {isVi ? 'Hạn thuê WebSub:' : 'WebSub lease until:'}{' '}
                            <strong className="text-[#0F1B2B]">
                              {formatIsoDate(ch.webSubLeaseExpiresAt, isVi)}
                            </strong>
                          </span>
                        )}
                      </div>
                      {ch.lastAutoSyncSummary && (
                        <p className="mt-1 text-xs text-[#0A2239]">
                          {ch.lastAutoSyncSummary}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleWebSubAction(ch, 'subscribe')}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0A2239] px-3 text-xs font-semibold text-white hover:bg-[#143757] disabled:opacity-50"
                      >
                        <Bell className="h-3.5 w-3.5 text-amber-300" />
                        <span>
                          {isVi ? 'Kích hoạt / Gia hạn WebSub' : 'Activate WebSub'}
                        </span>
                      </button>

                      {wsStatus !== 'inactive' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleWebSubAction(ch, 'unsubscribe')}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E3E7EE] bg-white px-2.5 text-xs font-semibold text-[#526071] hover:text-[#C8102E] disabled:opacity-50"
                        >
                          <BellOff className="h-3.5 w-3.5" />
                          <span>{isVi ? 'Tắt' : 'Stop'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRunCronNow(ch.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#0A2239]/25 bg-white px-3 text-xs font-semibold text-[#0A2239] hover:border-[#0A2239] disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`}
                        />
                        <span>{isVi ? 'Quét ngay' : 'Sync Now'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Automation Policy Toggles */}
                  <div className="mt-4 grid grid-cols-1 gap-2.5 border-t border-[#E3E7EE] pt-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-xs font-semibold text-[#0A2239]">
                      <input
                        type="checkbox"
                        checked={autoSync}
                        disabled={isBusy}
                        onChange={(e) =>
                          void handleToggleChannelField(
                            ch,
                            'autoSyncEnabled',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 accent-[#C8102E]"
                      />
                      <span>
                        {isVi ? 'Quét lịch hàng ngày' : 'Daily Scheduled Sync'}
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-xs font-semibold text-[#0A2239]">
                      <input
                        type="checkbox"
                        checked={webSubOn}
                        disabled={isBusy}
                        onChange={(e) =>
                          void handleToggleChannelField(
                            ch,
                            'webSubEnabled',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 accent-[#C8102E]"
                      />
                      <span>
                        {isVi ? 'Bắt video mới tức thì (WebSub)' : 'Real-Time WebSub Push'}
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-xs font-semibold text-[#0A2239]">
                      <input
                        type="checkbox"
                        checked={autoAi}
                        disabled={isBusy}
                        onChange={(e) =>
                          void handleToggleChannelField(
                            ch,
                            'autoAiOptimize',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 accent-[#C8102E]"
                      />
                      <span>
                        {isVi ? 'Chế độ A: Tự gọi Gemini AI' : 'Mode A: Auto Gemini AI'}
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-xs font-semibold text-[#0A2239]">
                      <input
                        type="checkbox"
                        checked={autoPub}
                        disabled={isBusy}
                        onChange={(e) =>
                          void handleToggleChannelField(
                            ch,
                            'autoPublishNew',
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 accent-[#C8102E]"
                      />
                      <span>
                        {isVi ? 'Chế độ A: Tự xuất bản ngay' : 'Mode A: Auto-Publish'}
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Collapsible DevOps Setup Commands for Cloud Run + Cloud Scheduler */}
      <div className="rounded-2xl border border-[#E3E7EE] bg-white">
        <button
          type="button"
          onClick={() => setShowDevOpsGuide((v) => !v)}
          className="flex w-full items-center justify-between p-5 text-left"
        >
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-[#C8102E]" />
            <div>
              <h4 className="font-display text-sm font-bold text-[#0A2239]">
                {isVi
                  ? '3 Lệnh cấu hình 1 lần trên Google Cloud Run & Cloud Scheduler (Copy-Paste)'
                  : 'One-Time Google Cloud Run & Cloud Scheduler CLI Setup'}
              </h4>
              <p className="text-xs text-[#526071]">
                {isVi
                  ? `Áp dụng cho dự án ${GCP_PROJECT_ID} · Tên miền ${effectiveDomain}`
                  : `Project ${GCP_PROJECT_ID} · Domain ${effectiveDomain}`}
              </p>
            </div>
          </div>
          {showDevOpsGuide ? (
            <ChevronUp className="h-4 w-4 text-[#526071]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#526071]" />
          )}
        </button>

        {showDevOpsGuide && (
          <div className="space-y-4 border-t border-[#E3E7EE] p-5 text-xs">
            {[
              {
                key: 'iam',
                title: isVi
                  ? 'Bước 1 — Cấp quyền tối thiểu Firestore (roles/datastore.user) cho Cloud Run Service Account (không cần file key JSON)'
                  : 'Step 1 — Grant Least-Privilege Firestore Role to Cloud Run Service Account',
                cmd: cmdStep1Iam,
              },
              {
                key: 'env',
                title: isVi
                  ? 'Bước 2 — Tạo & gắn biến bảo mật CRON_SECRET, WEBSUB_SECRET, PUBLIC_APP_URL lên Cloud Run'
                  : 'Step 2 — Set CRON_SECRET, WEBSUB_SECRET & PUBLIC_APP_URL on Cloud Run',
                cmd: cmdStep2Env,
              },
              {
                key: 'scheduler',
                title: isVi
                  ? 'Bước 3 — Tạo lịch Cloud Scheduler chạy 06:00 sáng mỗi ngày (tự quét video, playlist & gia hạn WebSub)'
                  : 'Step 3 — Create Daily 06:00 AM Cloud Scheduler Job (Sync + WebSub Lease Renewal)',
                cmd: cmdStep3Scheduler,
              },
            ].map((step) => (
              <div key={step.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[#0A2239]">{step.title}</p>
                  <button
                    type="button"
                    onClick={() => void copyCommand(step.key, step.cmd)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E3E7EE] bg-[#F7F8FA] px-2.5 text-[11px] font-semibold text-[#0A2239] hover:border-[#0A2239]"
                  >
                    {copiedCmd === step.key ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span>{isVi ? 'Đã sao chép' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>{isVi ? 'Sao chép' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-[#0A2239] p-3.5 font-mono text-[11px] leading-relaxed text-slate-100">
                  {step.cmd}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Sync Execution History (/videoSyncLogs) */}
      <div className="rounded-2xl border border-[#E3E7EE] bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-[#0A2239]" />
            <div>
              <h4 className="font-display text-base font-bold text-[#0A2239]">
                {isVi
                  ? `Nhật ký Đồng bộ Tự động (${syncLogs.length})`
                  : `Automated Sync Execution Logs (${syncLogs.length})`}
              </h4>
              <p className="text-xs text-[#526071]">
                {isVi
                  ? 'Ghi nhận thời gian thực mọi lượt chạy từ Google Cloud Scheduler, YouTube WebSub Push và nút kiểm thử Admin.'
                  : 'Real-time server audit log of Cloud Scheduler runs, YouTube WebSub pushes, and manual admin runs.'}
              </p>
            </div>
          </div>
        </div>

        {syncLogs.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#CBD5E1] py-8 text-center text-xs text-[#526071]">
            <Clock className="mx-auto h-6 w-6 text-[#94A3B8]" />
            <p className="mt-2">
              {isVi
                ? 'Chưa có nhật ký chạy tự động nào. Bấm "Chạy quét & gia hạn ngay" ở trên để kiểm thử luồng đồng bộ.'
                : 'No sync logs recorded yet. Click "Run Sync Now" above to test.'}
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#E3E7EE]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#526071]">
                <tr>
                  <th className="px-3.5 py-2.5">{isVi ? 'Thời gian' : 'Time'}</th>
                  <th className="px-3 py-2.5">{isVi ? 'Nguồn' : 'Trigger'}</th>
                  <th className="px-3 py-2.5">{isVi ? 'Kênh & Tóm tắt' : 'Channel & Summary'}</th>
                  <th className="px-3 py-2.5 text-right">{isVi ? 'Kết quả' : 'Counts'}</th>
                  <th className="px-3 py-2.5">{isVi ? 'Trạng thái' : 'Status'}</th>
                  <th className="px-3 py-2.5 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EE]">
                {syncLogs.map((log) => {
                  const triggerLabel =
                    log.trigger === 'websub_push'
                      ? 'WebSub Push'
                      : log.trigger === 'cron_scheduler'
                        ? 'Cloud Scheduler'
                        : isVi
                          ? 'Admin chạy tay'
                          : 'Admin Manual';
                  const statusCls =
                    log.status === 'success'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : log.status === 'partial'
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-[#C8102E] bg-red-50 border-red-200';

                  return (
                    <tr key={log.id} className="hover:bg-[#F7F8FA]/70">
                      <td className="px-3.5 py-3 font-mono text-[11px] text-[#526071] whitespace-nowrap tabular-nums">
                        <div>
                          {log.createdAt
                            ? formatIsoDate(log.createdAt.toDate().toISOString(), isVi)
                            : '—'}
                        </div>
                        <div className="text-[10px] text-[#94A3B8]">
                          {formatDuration(log.durationMs)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="rounded bg-[#0A2239]/8 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#0A2239]">
                          {triggerLabel}
                        </span>
                      </td>
                      <td className="max-w-md px-3 py-3">
                        <p className="font-semibold text-[#0A2239]">
                          {log.channelTitle || '—'}
                        </p>
                        <p className="mt-0.5 text-[#526071]">{log.summary}</p>
                        {log.errorDetail && (
                          <p className="mt-1 font-mono text-[10px] text-[#C8102E]">
                            {log.errorDetail}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-[11px] whitespace-nowrap tabular-nums">
                        <div className="font-semibold text-[#0A2239]">
                          +{log.videosAdded} vid
                        </div>
                        <div className="text-emerald-700">
                          +{log.videosAiOptimized} AI
                          {log.videosAiFailed > 0 && (
                            <span className="text-amber-700">
                              {' '}
                              ({log.videosAiFailed} err)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${statusCls}`}
                        >
                          {log.status === 'success'
                            ? isVi
                              ? 'Thành công'
                              : 'Success'
                            : log.status === 'partial'
                              ? isVi
                                ? 'Hoàn tất (1 phần)'
                                : 'Partial'
                              : isVi
                                ? 'Lỗi'
                                : 'Error'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteVideoSyncLog(log.id);
                          }}
                          title={isVi ? 'Xóa dòng nhật ký' : 'Delete log'}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#E3E7EE] text-[#526071] hover:border-red-200 hover:bg-red-50 hover:text-[#C8102E]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

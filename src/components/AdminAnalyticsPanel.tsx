import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Film,
  Globe,
  Map,
  Radio,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Language } from '../data/bostonData';
import { GuideLeadRecord, MeetingRfpRecord } from '../lib/cmsService';
import {
  SharedItineraryAdminItem,
  deleteSharedItinerary,
} from '../lib/itineraryService';
import {
  VideoChannelRecord,
  VideoItemRecord,
  VideoSyncLogRecord,
} from '../lib/videoService';

interface AdminAnalyticsPanelProps {
  adminLang: Language;
  videos: VideoItemRecord[];
  videoChannels: VideoChannelRecord[];
  videoSyncLogs: VideoSyncLogRecord[];
  guideLeads: GuideLeadRecord[];
  meetingRfps: MeetingRfpRecord[];
  sharedItineraries: SharedItineraryAdminItem[];
  canDeleteSharedTrips: boolean;
  onJumpToVideos: () => void;
  onJumpToLeads: () => void;
  onNotice: (msg: string) => void;
}

function sanitizeCsvCell(value: unknown): string {
  let str = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  // Prevent CSV formula injection in Excel/Google Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadUtf8Csv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((r) => r.map(sanitizeCsvCell).join(',')),
  ];
  // UTF-8 BOM ensures Vietnamese diacritics open cleanly in Microsoft Excel
  const csvContent = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDateStamp(ts?: { toDate?: () => Date } | null, isVi = true): string {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  try {
    return ts.toDate().toLocaleString(isVi ? 'vi-VN' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function AdminAnalyticsPanel({
  adminLang,
  videos,
  videoChannels,
  videoSyncLogs,
  guideLeads,
  meetingRfps,
  sharedItineraries,
  canDeleteSharedTrips,
  onJumpToVideos,
  onJumpToLeads,
  onNotice,
}: AdminAnalyticsPanelProps) {
  const isVi = adminLang === 'vi';
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';

  const videoStats = useMemo(() => {
    const total = videos.length;
    const published = videos.filter((v) => v.status === 'published').length;
    const aiOptimized = videos.filter((v) => v.aiStatus === 'optimized').length;
    const totalViews = videos.reduce(
      (sum, v) => sum + (Number.isFinite(v.viewCount) ? v.viewCount : 0),
      0
    );
    const activeWebSub = videoChannels.filter(
      (c) => c.webSubStatus === 'active'
    ).length;
    const latestLog = videoSyncLogs[0] || null;

    return {
      total,
      published,
      publishedPct: total ? Math.round((published / total) * 100) : 0,
      aiOptimized,
      aiPct: total ? Math.round((aiOptimized / total) * 100) : 0,
      totalViews,
      activeWebSub,
      channelCount: videoChannels.length,
      latestLog,
    };
  }, [videos, videoChannels, videoSyncLogs]);

  const leadBreakdown = useMemo(() => {
    return {
      guideNew: guideLeads.filter((l) => l.status === 'new').length,
      guideContacted: guideLeads.filter((l) => l.status === 'contacted').length,
      guideArchived: guideLeads.filter((l) => l.status === 'archived').length,
      rfpNew: meetingRfps.filter((r) => r.status === 'new').length,
      rfpReviewing: meetingRfps.filter((r) => r.status === 'reviewing').length,
      rfpResponded: meetingRfps.filter((r) => r.status === 'responded').length,
      rfpArchived: meetingRfps.filter((r) => r.status === 'archived').length,
    };
  }, [guideLeads, meetingRfps]);

  const handleExportGuideLeadsCsv = () => {
    const headers = ['ID', 'Email', 'Source', 'Language', 'Status', 'Created At'];
    const rows = guideLeads.map((lead) => [
      lead.id,
      lead.email,
      lead.source,
      lead.lang,
      lead.status,
      formatDateStamp(lead.createdAt, isVi),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadUtf8Csv(`meet-boston-guide-leads-${stamp}.csv`, headers, rows);
    onNotice(
      isVi
        ? `Đã xuất ${guideLeads.length} Email Cẩm nang ra file CSV.`
        : `Exported ${guideLeads.length} Guide Leads to CSV.`
    );
  };

  const handleExportRfpsCsv = () => {
    const headers = [
      'ID',
      'Organization',
      'Email',
      'Guests',
      'Timeframe',
      'Status',
      'Notes',
      'Created At',
    ];
    const rows = meetingRfps.map((rfp) => [
      rfp.id,
      rfp.organization,
      rfp.email,
      rfp.guests,
      rfp.timeframe,
      rfp.status,
      rfp.notes,
      formatDateStamp(rfp.createdAt, isVi),
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadUtf8Csv(`meet-boston-meeting-rfps-${stamp}.csv`, headers, rows);
    onNotice(
      isVi
        ? `Đã xuất ${meetingRfps.length} yêu cầu RFP ra file CSV.`
        : `Exported ${meetingRfps.length} Meeting RFPs to CSV.`
    );
  };

  const handleCopyTripLink = async (shareId: string) => {
    const fullUrl = activeOrigin ? `${activeOrigin}/trip/${shareId}` : `/trip/${shareId}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(shareId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard blocked in restricted browser
    }
  };

  const handleDeleteTrip = async (shareId: string) => {
    setDeletingId(shareId);
    try {
      await deleteSharedItinerary(shareId);
      onNotice(
        isVi
          ? `Đã xóa lịch trình chia sẻ ${shareId}.`
          : `Deleted shared trip ${shareId}.`
      );
    } catch {
      onNotice(
        isVi
          ? 'Không thể xóa lịch trình chia sẻ này.'
          : 'Unable to delete this shared trip.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Video SEO Health + CRM Funnel & CSV Export */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Video Library & AI SEO Health */}
        <section className="rounded-xl border border-[#E3E7EE] bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#0A2239]">
                <Film className="h-4 w-4 text-[#C8102E]" aria-hidden="true" />
                <span>
                  {isVi
                    ? 'Hiệu suất Thư viện Video & AI SEO'
                    : 'Video Library & AI SEO Health'}
                </span>
              </h2>
              <p className="mt-1 text-xs text-[#526071]">
                {isVi
                  ? 'Tổng hợp tiến độ biên tập song ngữ, lượt xem YouTube và đồng bộ WebSub.'
                  : 'Bilingual optimization coverage, YouTube views, and WebSub sync status.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onJumpToVideos}
              className="rounded-lg border border-[#E3E7EE] px-2.5 py-1.5 text-xs font-semibold text-[#0A2239] hover:bg-[#F7F8FA] whitespace-nowrap shrink-0"
            >
              {isVi ? 'Mở Thư viện' : 'Open Library'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-[#F7F8FA] p-3">
              <p className="text-[11px] font-medium text-[#526071]">
                {isVi ? 'Tổng Video' : 'Total Videos'}
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-[#0A2239] tabular-nums">
                {videoStats.total}
              </p>
              <p className="mt-0.5 text-[11px] text-[#526071] tabular-nums">
                {videoStats.published} {isVi ? 'công khai' : 'published'}
              </p>
            </div>
            <div className="rounded-lg bg-[#F7F8FA] p-3">
              <p className="text-[11px] font-medium text-[#526071]">
                {isVi ? 'Lượt xem YT' : 'YT Views'}
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-[#0A2239] tabular-nums">
                {new Intl.NumberFormat(isVi ? 'vi-VN' : 'en-US', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                }).format(videoStats.totalViews)}
              </p>
              <p className="mt-0.5 text-[11px] text-[#526071] tabular-nums">
                {videoStats.channelCount} {isVi ? 'kênh' : 'channels'}
              </p>
            </div>
            <div className="rounded-lg bg-[#F7F8FA] p-3">
              <p className="text-[11px] font-medium text-[#526071]">
                {isVi ? 'WebSub Push' : 'WebSub Push'}
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-[#0A2239] tabular-nums">
                {videoStats.activeWebSub}/{videoStats.channelCount}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#16A34A]">
                <Radio className="h-3 w-3" aria-hidden="true" />
                <span>{isVi ? 'Đang kích hoạt' : 'Active'}</span>
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-[#0F1B2B]">
                  <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" aria-hidden="true" />
                  <span>
                    {isVi
                      ? 'Đã tối ưu SEO song ngữ bằng AI'
                      : 'AI Bilingual SEO Optimized'}
                  </span>
                </span>
                <span className="font-mono font-semibold text-[#0A2239] tabular-nums">
                  {videoStats.aiOptimized}/{videoStats.total} ({videoStats.aiPct}%)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#E3E7EE]">
                <div
                  className="h-full rounded-full bg-[#C8102E] transition-all"
                  style={{ width: `${videoStats.aiPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0F1B2B]">
                  {isVi ? 'Tỷ lệ Video đã xuất bản' : 'Published Video Ratio'}
                </span>
                <span className="font-mono font-semibold text-[#0A2239] tabular-nums">
                  {videoStats.published}/{videoStats.total} ({videoStats.publishedPct}%)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#E3E7EE]">
                <div
                  className="h-full rounded-full bg-[#0A2239] transition-all"
                  style={{ width: `${videoStats.publishedPct}%` }}
                />
              </div>
            </div>
          </div>

          {videoStats.latestLog && (
            <div className="mt-4 rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] px-3 py-2 text-[11px] text-[#526071]">
              <span className="font-semibold text-[#0A2239]">
                {isVi ? 'Đồng bộ gần nhất:' : 'Latest Sync:'}
              </span>{' '}
              {videoStats.latestLog.summary || videoStats.latestLog.status} ·{' '}
              <span className="font-mono">
                {formatDateStamp(videoStats.latestLog.createdAt, isVi)}
              </span>
            </div>
          )}
        </section>

        {/* CRM Leads & RFP Conversion + 1-Click CSV Export */}
        <section className="flex flex-col justify-between rounded-xl border border-[#E3E7EE] bg-white p-6">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#0A2239]">
                  {isVi
                    ? 'Phễu chuyển đổi Leads & Xuất CRM (CSV)'
                    : 'Leads & RFP Funnel + CSV Export'}
                </h2>
                <p className="mt-1 text-xs text-[#526071]">
                  {isVi
                    ? 'Theo dõi trạng thái chăm sóc khách và tải nhanh file CSV chuẩn UTF-8 cho Excel.'
                    : 'Track lead progression and download Excel-ready UTF-8 CSV spreadsheets.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onJumpToLeads}
                className="rounded-lg border border-[#E3E7EE] px-2.5 py-1.5 text-xs font-semibold text-[#0A2239] hover:bg-[#F7F8FA] whitespace-nowrap shrink-0"
              >
                {isVi ? 'Quản lý Leads' : 'Manage Leads'}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#E3E7EE] p-3.5">
                <p className="text-xs font-bold text-[#0A2239]">
                  {isVi ? 'Email Cẩm nang & Bản tin' : 'Visitor Guide & Newsletter'}
                </p>
                <dl className="mt-2.5 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#526071]">{isVi ? 'Chờ xử lý (Mới)' : 'New'}</dt>
                    <dd className="font-mono font-bold text-[#C8102E] tabular-nums">
                      {leadBreakdown.guideNew}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#526071]">{isVi ? 'Đã liên hệ' : 'Contacted'}</dt>
                    <dd className="font-mono font-semibold text-[#16A34A] tabular-nums">
                      {leadBreakdown.guideContacted}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#526071]">{isVi ? 'Lưu trữ' : 'Archived'}</dt>
                    <dd className="font-mono text-[#526071] tabular-nums">
                      {leadBreakdown.guideArchived}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-[#E3E7EE] p-3.5">
                <p className="text-xs font-bold text-[#0A2239]">
                  {isVi ? 'Yêu cầu Hội nghị (RFP)' : 'Meetings & Events RFPs'}
                </p>
                <dl className="mt-2.5 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#526071]">{isVi ? 'Yêu cầu mới' : 'New'}</dt>
                    <dd className="font-mono font-bold text-[#C8102E] tabular-nums">
                      {leadBreakdown.rfpNew}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#526071]">{isVi ? 'Đang báo giá' : 'Reviewing'}</dt>
                    <dd className="font-mono font-semibold text-[#0A2239] tabular-nums">
                      {leadBreakdown.rfpReviewing}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#526071]">{isVi ? 'Đã phản hồi' : 'Responded'}</dt>
                    <dd className="font-mono font-semibold text-[#16A34A] tabular-nums">
                      {leadBreakdown.rfpResponded}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-[#E3E7EE] pt-4">
            <button
              type="button"
              disabled={guideLeads.length === 0}
              onClick={handleExportGuideLeadsCsv}
              className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#0A2239]/25 bg-white px-3.5 text-xs font-semibold text-[#0A2239] transition-colors hover:bg-[#F7F8FA] disabled:opacity-45 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isVi
                  ? `Xuất CSV Cẩm nang (${guideLeads.length})`
                  : `Export Guide CSV (${guideLeads.length})`}
              </span>
            </button>
            <button
              type="button"
              disabled={meetingRfps.length === 0}
              onClick={handleExportRfpsCsv}
              className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0A2239] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#133454] disabled:opacity-45 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {isVi
                  ? `Xuất CSV Hội nghị RFP (${meetingRfps.length})`
                  : `Export RFP CSV (${meetingRfps.length})`}
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* Row 2: Shared Traveler Itineraries + Domain/SEO/PWA Readiness */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Shared Itineraries Management (/trip/:shareId) */}
        <section className="rounded-xl border border-[#E3E7EE] bg-white p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#0A2239]">
                <Map className="h-4 w-4 text-[#C8102E]" aria-hidden="true" />
                <span>
                  {isVi
                    ? 'Lịch trình du khách đã chia sẻ (/trip/...)'
                    : 'Traveler Shared Itineraries (/trip/...)'}
                </span>
              </h2>
              <p className="mt-1 text-xs text-[#526071]">
                {isVi
                  ? 'Các liên kết lịch trình Boston 3 ngày được du khách tạo và lưu trực tiếp trên Firestore.'
                  : '3-day Boston trip snapshots created by visitors and persisted in Firestore.'}
              </p>
            </div>
            <span className="rounded-md bg-[#F7F8FA] px-2.5 py-1 font-mono text-xs font-bold text-[#0A2239] tabular-nums">
              {sharedItineraries.length}
            </span>
          </div>

          {sharedItineraries.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-[#E3E7EE] bg-[#F7F8FA] px-4 py-8 text-center text-xs text-[#526071]">
              {isVi
                ? 'Chưa có lịch trình chia sẻ nào. Khi du khách nhấn "Tạo link chia sẻ" trong Lịch trình Boston, bản ghi sẽ hiển thị tại đây.'
                : 'No shared itineraries yet. When visitors click "Create Share Link" inside My Boston Trip, entries will appear here.'}
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#E3E7EE]">
              {sharedItineraries.slice(0, 8).map((trip) => (
                <div
                  key={trip.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[#0A2239]">
                        {trip.title}
                      </p>
                      <span className="shrink-0 rounded bg-[#F7F8FA] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#526071]">
                        {trip.lang}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#526071]">
                      <span className="font-mono text-[#0A2239]">/trip/{trip.id}</span> ·{' '}
                      {trip.items.length} {isVi ? 'điểm dừng' : 'stops'} ·{' '}
                      {formatDateStamp(trip.createdAt, isVi)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleCopyTripLink(trip.id)}
                      title={isVi ? 'Sao chép liên kết' : 'Copy share link'}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]"
                    >
                      {copiedId === trip.id ? (
                        <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <a
                      href={`/trip/${trip.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={isVi ? 'Xem lịch trình' : 'Open shared trip'}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {canDeleteSharedTrips && (
                      <button
                        type="button"
                        disabled={deletingId === trip.id}
                        onClick={() => void handleDeleteTrip(trip.id)}
                        title={isVi ? 'Xóa lịch trình' : 'Delete shared trip'}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#526071] hover:border-[#C8102E]/40 hover:bg-red-50 hover:text-[#C8102E] disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Domain, SEO & PWA Readiness Card */}
        <section className="rounded-xl border border-[#E3E7EE] bg-white p-6 lg:col-span-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#0A2239]">
            <Globe className="h-4 w-4 text-[#C8102E]" aria-hidden="true" />
            <span>
              {isVi
                ? 'Trạng thái Tên miền, SEO & Ứng dụng PWA'
                : 'Domain, SEO & PWA Readiness'}
            </span>
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#526071]">
            {isVi
              ? 'Toàn bộ Canonical URL, Sitemap, Robots.txt, link chia sẻ và PWA Manifest tự động thích ứng theo tên miền hiện tại — đổi sang tên miền mới không cần sửa mã nguồn.'
              : 'Canonical URLs, Sitemap, Robots.txt, shared trip links, and PWA Manifest automatically adapt to the active domain with zero code edits.'}
          </p>

          <div className="mt-4 rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] p-3">
            <p className="text-[11px] font-medium text-[#526071]">
              {isVi ? 'Tên miền đang hoạt động' : 'Active Origin'}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs font-bold text-[#0A2239]">
              {activeOrigin || '—'}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { href: '/sitemap.xml', label: 'sitemap.xml' },
              { href: '/robots.txt', label: 'robots.txt' },
              { href: '/manifest.webmanifest', label: 'PWA Manifest' },
              { href: '/api/health', label: 'API Health' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center justify-between rounded-lg border border-[#E3E7EE] px-3 text-xs font-semibold text-[#0A2239] transition-colors hover:border-[#0A2239]/30 hover:bg-[#F7F8FA]"
              >
                <span className="truncate font-mono">{item.label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#526071]" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

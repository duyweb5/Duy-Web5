import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookMarked,
  Check,
  CheckCircle2,
  DownloadCloud,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  FolderKanban,
  Languages,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Square,
  Trash2,
  X,
  Youtube,
} from 'lucide-react';
import { Language } from '../data/bostonData';
import {
  OptimizedVideoAIResult,
  SAMPLE_YOUTUBE_CHANNEL_URL,
  VideoChannelRecord,
  VideoGlossaryTermRecord,
  VideoItemRecord,
  VideoSyncLogRecord,
  VideoTopicRecord,
  YouTubeImportPayload,
  deleteGlossaryTerm,
  deleteVideoChannel,
  deleteVideoItem,
  deleteVideoTopic,
  fetchYouTubeChannelImport,
  requestAiOptimizeVideo,
  requestAiTranslateTopics,
  saveGlossaryTerm,
  saveVideoChannel,
  saveVideoItem,
  saveVideoTopic,
  seedDefaultGlossaryTerms,
  slugifyVideoText,
  syncImportedChannelToFirestore,
} from '../lib/videoService';
import { VideoAutoSyncPanel } from './VideoAutoSyncPanel';

type VideoSubTab = 'videos' | 'import' | 'automation' | 'topics' | 'glossary';

interface VideoLibraryTabProps {
  uid: string;
  adminLang: Language;
  channels: VideoChannelRecord[];
  topics: VideoTopicRecord[];
  videos: VideoItemRecord[];
  glossary: VideoGlossaryTermRecord[];
  syncLogs: VideoSyncLogRecord[];
  onNotice: (msg: string) => void;
  initialEditVideoId?: string | null;
  onClearInitialEdit?: () => void;
}

export function VideoLibraryTab({
  uid,
  adminLang,
  channels,
  topics,
  videos,
  glossary,
  syncLogs,
  onNotice,
  initialEditVideoId,
  onClearInitialEdit,
}: VideoLibraryTabProps) {
  const isVi = adminLang === 'vi';
  const [subTab, setSubTab] = useState<VideoSubTab>('videos');

  // Filter state (Videos sub-tab)
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [aiFilter, setAiFilter] = useState<'all' | 'pending' | 'optimized' | 'manual'>('all');

  // Batch AI Queue state
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, title: '' });
  const batchCancelRef = useRef(false);

  // Video Editor Modal + AI Review Diff
  const [editingVideo, setEditingVideo] = useState<VideoItemRecord | null>(null);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [aiProposal, setAiProposal] = useState<OptimizedVideoAIResult | null>(null);
  const [savingVideo, setSavingVideo] = useState(false);

  // Importer state
  const [importUrl, setImportUrl] = useState(SAMPLE_YOUTUBE_CHANNEL_URL);
  const [maxPlaylists, setMaxPlaylists] = useState(12);
  const [maxVideosPerPlaylist, setMaxVideosPerPlaylist] = useState(20);
  const [importDefaultStatus, setImportDefaultStatus] = useState<'published' | 'draft'>('published');
  const [autoTranslateTopicsOnSync, setAutoTranslateTopicsOnSync] = useState(true);
  const [fetchingImport, setFetchingImport] = useState(false);
  const [syncingImport, setSyncingImport] = useState(false);
  const [importPreview, setImportPreview] = useState<YouTubeImportPayload | null>(null);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState('');

  // Channel CTA editor state
  const [editingChannel, setEditingChannel] = useState<VideoChannelRecord | null>(null);
  const [savingChannel, setSavingChannel] = useState(false);

  // Topic editor state
  const [editingTopic, setEditingTopic] = useState<Partial<VideoTopicRecord> | null>(null);
  const [translatingTopics, setTranslatingTopics] = useState(false);

  // Glossary editor state
  const [newTerm, setNewTerm] = useState({
    sourceTerm: '',
    targetVi: '',
    targetEn: '',
    keepOriginal: false,
    notes: '',
  });
  const [savingTerm, setSavingTerm] = useState(false);

  // Handle jump-to-edit from Language Audit Matrix
  useMemo(() => {
    if (initialEditVideoId) {
      const target = videos.find((v) => v.id === initialEditVideoId);
      if (target) {
        setSubTab('videos');
        setEditingVideo(target);
        setAiProposal(null);
      }
      onClearInitialEdit?.();
    }
  }, [initialEditVideoId, videos, onClearInitialEdit]);

  const topicMap = useMemo(() => {
    const map = new Map<string, VideoTopicRecord>();
    for (const t of topics) map.set(t.id, t);
    return map;
  }, [topics]);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return videos.filter((v) => {
      if (topicFilter !== 'all' && v.topicId !== topicFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (aiFilter !== 'all' && v.aiStatus !== aiFilter) return false;
      if (!q) return true;
      return (
        v.titleVi.toLowerCase().includes(q) ||
        v.titleEn.toLowerCase().includes(q) ||
        v.rawTitle.toLowerCase().includes(q) ||
        v.youtubeId.toLowerCase().includes(q)
      );
    });
  }, [videos, topicFilter, statusFilter, aiFilter, searchQuery]);

  const stats = useMemo(() => {
    const published = videos.filter((v) => v.status === 'published').length;
    const optimized = videos.filter((v) => v.aiStatus === 'optimized').length;
    const pending = videos.filter((v) => v.aiStatus === 'pending').length;
    return { total: videos.length, published, optimized, pending };
  }, [videos]);

  // -------------------------------------------------------------------------
  // Handlers: YouTube Channel Import & Non-Destructive Sync
  // -------------------------------------------------------------------------
  const handleFetchChannel = async (overrideUrl?: string) => {
    const target = (overrideUrl ?? importUrl).trim();
    if (!target) return;
    if (overrideUrl) setImportUrl(overrideUrl);
    setImportError('');
    setFetchingImport(true);
    try {
      const data = await fetchYouTubeChannelImport({
        url: target,
        maxPlaylists,
        maxVideosPerPlaylist,
      });
      setImportPreview(data);
      setSelectedPlaylistIds(
        new Set(data.playlists.map((p) => p.youtubePlaylistId))
      );
      onNotice(
        isVi
          ? `Đã quét kênh "${data.channel.title}": ${data.stats.playlistsFound} chủ đề, ${data.stats.videosFound} video.`
          : `Scanned "${data.channel.title}": ${data.stats.playlistsFound} playlists, ${data.stats.videosFound} videos.`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi quét kênh YouTube.';
      setImportError(msg);
    } finally {
      setFetchingImport(false);
    }
  };

  const handleConfirmSyncToFirestore = async () => {
    if (!importPreview) return;
    setSyncingImport(true);
    setImportError('');
    try {
      let translatedTopics;
      const chosenPlaylists = importPreview.playlists.filter(
        (p) =>
          selectedPlaylistIds.size === 0 ||
          selectedPlaylistIds.has(p.youtubePlaylistId)
      );

      if (autoTranslateTopicsOnSync && chosenPlaylists.length > 0) {
        try {
          translatedTopics = await requestAiTranslateTopics({
            channelName: importPreview.channel.title,
            topics: chosenPlaylists.map((p) => ({
              id: p.youtubePlaylistId,
              rawTitle: p.title,
            })),
            glossary,
          });
        } catch (aiErr) {
          console.warn('[VideoLibraryTab] Optional topic AI translation skipped:', aiErr);
        }
      }

      const res = await syncImportedChannelToFirestore({
        payload: importPreview,
        existingChannels: channels,
        existingTopics: topics,
        existingVideos: videos,
        selectedPlaylistIds: Array.from(selectedPlaylistIds),
        defaultStatus: importDefaultStatus,
        translatedTopics,
        uid,
      });

      onNotice(
        isVi
          ? `Đồng bộ xong: +${res.topicsAdded} chủ đề, +${res.videosAdded} video mới (${res.videosPreserved} video đã có được giữ nguyên).`
          : `Synced: +${res.topicsAdded} topics, +${res.videosAdded} new videos (${res.videosPreserved} existing preserved).`
      );
      setImportPreview(null);
      setSubTab('videos');
    } catch (err: unknown) {
      setImportError(
        err instanceof Error ? err.message : 'Lỗi khi lưu dữ liệu vào Firestore.'
      );
    } finally {
      setSyncingImport(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Single & Batch Gemini AI Optimization
  // -------------------------------------------------------------------------
  const runGeminiForVideo = async (
    video: VideoItemRecord,
    applyImmediately: boolean
  ) => {
    setAiBusyId(video.id);
    try {
      const { optimized, enrichedMetadata } = await requestAiOptimizeVideo({
        youtubeId: video.youtubeId,
        rawTitle: video.rawTitle || video.titleVi,
        rawDescription: video.rawDescription || video.descriptionVi,
        channelName: video.channelName,
        currentTopicId: video.topicId,
        topics: topics.map((t) => ({
          id: t.id,
          titleVi: t.titleVi,
          titleEn: t.titleEn,
        })),
        glossary,
        fetchMissingDescription: true,
      });

      if (applyImmediately) {
        await saveVideoItem(
          {
            ...video,
            rawDescription:
              enrichedMetadata?.description || video.rawDescription,
            duration: enrichedMetadata?.duration || video.duration,
            durationSeconds:
              enrichedMetadata?.durationSeconds || video.durationSeconds,
            publishedDate:
              enrichedMetadata?.publishedDate || video.publishedDate,
            viewCount: enrichedMetadata?.viewCount || video.viewCount,
            topicId: optimized.suggestedTopicId || video.topicId,
            titleVi: optimized.titleVi,
            titleEn: optimized.titleEn,
            summaryVi: optimized.summaryVi,
            summaryEn: optimized.summaryEn,
            descriptionVi: optimized.descriptionVi,
            descriptionEn: optimized.descriptionEn,
            highlightsVi: optimized.highlightsVi,
            highlightsEn: optimized.highlightsEn,
            seoTitleVi: optimized.seoTitleVi,
            seoTitleEn: optimized.seoTitleEn,
            seoDescriptionVi: optimized.seoDescriptionVi,
            seoDescriptionEn: optimized.seoDescriptionEn,
            slugVi: optimized.slugVi,
            slugEn: optimized.slugEn,
            keywordsVi: optimized.keywordsVi,
            keywordsEn: optimized.keywordsEn,
            aiStatus: 'optimized',
          },
          uid
        );
        onNotice(
          isVi
            ? `Gemini AI đã dịch song ngữ & tối ưu SEO: "${optimized.titleVi}"`
            : `Gemini AI localized & SEO-optimized: "${optimized.titleEn}"`
        );
      } else {
        // Preview inside editor diff before applying
        if (enrichedMetadata) {
          setEditingVideo((prev) =>
            prev
              ? {
                  ...prev,
                  rawDescription:
                    enrichedMetadata.description || prev.rawDescription,
                  duration: enrichedMetadata.duration || prev.duration,
                  durationSeconds:
                    enrichedMetadata.durationSeconds || prev.durationSeconds,
                  publishedDate:
                    enrichedMetadata.publishedDate || prev.publishedDate,
                  viewCount: enrichedMetadata.viewCount || prev.viewCount,
                }
              : prev
          );
        }
        setAiProposal(optimized);
      }
    } catch (err: unknown) {
      onNotice(
        err instanceof Error
          ? `Lỗi Gemini AI: ${err.message}`
          : 'Không thể chạy Gemini AI lúc này.'
      );
    } finally {
      setAiBusyId(null);
    }
  };

  const handleBatchOptimizePending = async () => {
    const queue = filteredVideos
      .filter((v) => v.aiStatus === 'pending' && !v.manuallyEdited)
      .slice(0, 15);
    if (queue.length === 0) {
      onNotice(
        isVi
          ? 'Không có video nào ở trạng thái "Chờ AI" (và chưa khóa chỉnh tay) trong bộ lọc hiện tại.'
          : 'No unlocked pending videos in current filter.'
      );
      return;
    }

    batchCancelRef.current = false;
    setBatchRunning(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < queue.length; i++) {
      if (batchCancelRef.current) break;
      const vid = queue[i];
      setBatchProgress({
        current: i + 1,
        total: queue.length,
        title: vid.titleVi || vid.rawTitle,
      });
      try {
        await runGeminiForVideo(vid, true);
        successCount++;
      } catch {
        failCount++;
      }
      // Gentle pacing between Gemini calls
      if (i < queue.length - 1 && !batchCancelRef.current) {
        await new Promise((r) => setTimeout(r, 450));
      }
    }

    setBatchRunning(false);
    setBatchProgress({ current: 0, total: 0, title: '' });
    onNotice(
      isVi
        ? `Hoàn tất hàng đợi AI: ${successCount} video thành công${failCount > 0 ? `, ${failCount} lỗi` : ''}.`
        : `Batch AI complete: ${successCount} optimized${failCount > 0 ? `, ${failCount} failed` : ''}.`
    );
  };

  const handleTranslateAllTopics = async () => {
    if (topics.length === 0) return;
    setTranslatingTopics(true);
    try {
      const results = await requestAiTranslateTopics({
        channelName: channels[0]?.titleVi || 'Meet Boston Video Library',
        topics: topics.map((t) => ({ id: t.id, rawTitle: t.titleVi })),
        glossary,
      });
      for (const item of results) {
        const orig = topics.find((t) => t.id === item.id);
        if (!orig) continue;
        await saveVideoTopic(
          {
            ...orig,
            titleVi: item.titleVi,
            titleEn: item.titleEn,
            descriptionVi: item.descriptionVi || orig.descriptionVi,
            descriptionEn: item.descriptionEn || orig.descriptionEn,
            slug: item.slug || orig.slug,
          },
          uid
        );
      }
      onNotice(
        isVi
          ? `Gemini AI đã chuẩn hóa song ngữ ${results.length} chủ đề.`
          : `Gemini AI localized ${results.length} topics.`
      );
    } catch (err: unknown) {
      onNotice(
        err instanceof Error ? err.message : 'Lỗi khi dịch danh sách chủ đề.'
      );
    } finally {
      setTranslatingTopics(false);
    }
  };

  const handleSaveEditedVideo = async () => {
    if (!editingVideo) return;
    setSavingVideo(true);
    try {
      await saveVideoItem(editingVideo, uid);
      onNotice(
        isVi ? 'Đã lưu thay đổi video.' : 'Video changes saved.'
      );
      setEditingVideo(null);
      setAiProposal(null);
    } catch (err: unknown) {
      onNotice(
        err instanceof Error ? err.message : 'Lỗi khi lưu video.'
      );
    } finally {
      setSavingVideo(false);
    }
  };

  const handleApplyAiProposal = () => {
    if (!editingVideo || !aiProposal) return;
    setEditingVideo({
      ...editingVideo,
      topicId: aiProposal.suggestedTopicId || editingVideo.topicId,
      titleVi: aiProposal.titleVi,
      titleEn: aiProposal.titleEn,
      summaryVi: aiProposal.summaryVi,
      summaryEn: aiProposal.summaryEn,
      descriptionVi: aiProposal.descriptionVi,
      descriptionEn: aiProposal.descriptionEn,
      highlightsVi: aiProposal.highlightsVi,
      highlightsEn: aiProposal.highlightsEn,
      seoTitleVi: aiProposal.seoTitleVi,
      seoTitleEn: aiProposal.seoTitleEn,
      seoDescriptionVi: aiProposal.seoDescriptionVi,
      seoDescriptionEn: aiProposal.seoDescriptionEn,
      slugVi: aiProposal.slugVi,
      slugEn: aiProposal.slugEn,
      keywordsVi: aiProposal.keywordsVi,
      keywordsEn: aiProposal.keywordsEn,
      aiStatus: 'optimized',
    });
    setAiProposal(null);
    onNotice(
      isVi
        ? 'Đã áp dụng đề xuất AI vào biểu mẫu. Bấm "Lưu Video" để ghi vào Firestore.'
        : 'Applied AI proposal to editor. Click "Save Video" to persist.'
    );
  };

  const handleAddGlossaryTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.sourceTerm.trim()) return;
    setSavingTerm(true);
    try {
      await saveGlossaryTerm(
        {
          id: '',
          sourceTerm: newTerm.sourceTerm.trim(),
          targetVi: (newTerm.keepOriginal
            ? newTerm.sourceTerm
            : newTerm.targetVi || newTerm.sourceTerm
          ).trim(),
          targetEn: (newTerm.keepOriginal
            ? newTerm.sourceTerm
            : newTerm.targetEn || newTerm.sourceTerm
          ).trim(),
          keepOriginal: newTerm.keepOriginal,
          notes: newTerm.notes.trim(),
        },
        uid
      );
      setNewTerm({
        sourceTerm: '',
        targetVi: '',
        targetEn: '',
        keepOriginal: false,
        notes: '',
      });
      onNotice(isVi ? 'Đã thêm thuật ngữ vào Từ điển AI.' : 'Glossary term added.');
    } finally {
      setSavingTerm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & KPI Strip */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E3E7EE] pb-5 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#C8102E]">
            {isVi ? 'Thư viện Video & Google Gemini AI' : 'Video Library & Gemini AI Studio'}
          </p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-[#0A2239]">
            {isVi
              ? 'Quản lý Kênh YouTube, Chủ đề & Dịch Song ngữ SEO'
              : 'YouTube Channels, Topics & Bilingual AI SEO'}
          </h2>
          <p className="mt-1 text-sm text-[#526071]">
            {isVi
              ? 'Nhập kênh YouTube tự động theo playlist, dùng Gemini AI tối ưu SEO & dịch Anh/Việt theo ngữ cảnh kèm bộ thuật ngữ chuyên ngành.'
              : 'Auto-sync YouTube channels & playlists, optimize SEO and context-aware EN/VI localization with Gemini AI and your custom glossary.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/videos"
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3.5 text-xs font-semibold text-[#0A2239] hover:border-[#0A2239]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>{isVi ? 'Xem trang /videos' : 'Open /videos'}</span>
          </a>
          <button
            type="button"
            onClick={() => setSubTab('import')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#A10C24]"
          >
            <DownloadCloud className="h-3.5 w-3.5" />
            <span>{isVi ? 'Nhập kênh YouTube' : 'Import YouTube Channel'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <p className="text-xs font-semibold text-[#526071]">
            {isVi ? 'Tổng số video' : 'Total Videos'}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#0A2239] tabular-nums">
            {stats.total}
          </p>
          <p className="mt-0.5 text-xs text-[#526071]">
            {stats.published} {isVi ? 'đang xuất bản' : 'published'}
          </p>
        </div>
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <p className="text-xs font-semibold text-[#526071]">
            {isVi ? 'Đã tối ưu Gemini AI' : 'AI Optimized'}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {stats.optimized}
          </p>
          <p className="mt-0.5 text-xs text-[#526071]">
            {stats.pending} {isVi ? 'chờ dịch & SEO' : 'pending AI'}
          </p>
        </div>
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <p className="text-xs font-semibold text-[#526071]">
            {isVi ? 'Chủ đề / Playlist' : 'Topics / Playlists'}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#0A2239] tabular-nums">
            {topics.length}
          </p>
          <p className="mt-0.5 text-xs text-[#526071]">
            {channels.length} {isVi ? 'kênh kết nối' : 'channels'}
          </p>
        </div>
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <p className="text-xs font-semibold text-[#526071]">
            {isVi ? 'Từ điển thuật ngữ AI' : 'AI Glossary Terms'}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#0A2239] tabular-nums">
            {glossary.length}
          </p>
          <p className="mt-0.5 text-xs text-[#526071]">
            {isVi ? 'Đồng nhất thuật ngữ VI/EN' : 'Consistent EN/VI terms'}
          </p>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap gap-1 border-b border-[#E3E7EE]">
        {(
          [
            {
              id: 'videos',
              labelVi: `Danh sách Video (${videos.length})`,
              labelEn: `Videos (${videos.length})`,
              icon: Film,
            },
            {
              id: 'import',
              labelVi: 'Đồng bộ Kênh YouTube & CTA',
              labelEn: 'YouTube Sync & CTA',
              icon: Youtube,
            },
            {
              id: 'automation',
              labelVi: `Tự động hóa & Lịch quét (${syncLogs.length})`,
              labelEn: `Auto-Sync & Logs (${syncLogs.length})`,
              icon: Radio,
            },
            {
              id: 'topics',
              labelVi: `Chủ đề / Playlist (${topics.length})`,
              labelEn: `Topics (${topics.length})`,
              icon: FolderKanban,
            },
            {
              id: 'glossary',
              labelVi: `Từ điển Thuật ngữ AI (${glossary.length})`,
              labelEn: `AI Glossary (${glossary.length})`,
              icon: BookMarked,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`inline-flex min-h-[42px] items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                active
                  ? 'border-[#C8102E] text-[#0A2239]'
                  : 'border-transparent text-[#526071] hover:text-[#0A2239]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{isVi ? tab.labelVi : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: VIDEOS LIST & BATCH GEMINI AI QUEUE                        */}
      {/* ===================================================================== */}
      {subTab === 'videos' && (
        <div className="space-y-4">
          {/* Action & Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#E3E7EE] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#526071]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isVi ? 'Tìm tiêu đề VI/EN hoặc mã video...' : 'Search title or video ID...'
                  }
                  className="h-9 w-full rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] pr-3 pl-9 text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:bg-white focus:outline-none"
                />
              </div>

              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#E3E7EE] bg-white px-2.5 text-xs font-medium text-[#0F1B2B]"
              >
                <option value="all">
                  {isVi ? 'Tất cả chủ đề' : 'All Topics'}
                </option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {isVi ? t.titleVi : t.titleEn}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'published' | 'draft')
                }
                className="h-9 rounded-lg border border-[#E3E7EE] bg-white px-2.5 text-xs font-medium text-[#0F1B2B]"
              >
                <option value="all">{isVi ? 'Mọi trạng thái' : 'All Status'}</option>
                <option value="published">{isVi ? 'Đã xuất bản' : 'Published'}</option>
                <option value="draft">{isVi ? 'Bản nháp' : 'Draft'}</option>
              </select>

              <select
                value={aiFilter}
                onChange={(e) =>
                  setAiFilter(
                    e.target.value as 'all' | 'pending' | 'optimized' | 'manual'
                  )
                }
                className="h-9 rounded-lg border border-[#E3E7EE] bg-white px-2.5 text-xs font-medium text-[#0F1B2B]"
              >
                <option value="all">{isVi ? 'Mọi trạng thái AI' : 'All AI States'}</option>
                <option value="pending">{isVi ? 'Chờ AI dịch & SEO' : 'Pending AI'}</option>
                <option value="optimized">{isVi ? 'Đã tối ưu AI' : 'AI Optimized'}</option>
                <option value="manual">{isVi ? 'Chỉnh tay' : 'Manual'}</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {batchRunning ? (
                <button
                  type="button"
                  onClick={() => {
                    batchCancelRef.current = true;
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C8102E] px-3.5 text-xs font-semibold text-white"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>{isVi ? 'Dừng hàng đợi' : 'Stop Queue'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBatchOptimizePending}
                  disabled={stats.pending === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2239] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#143757] disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>
                    {isVi
                      ? `AI Tối ưu hàng loạt (${stats.pending} chờ)`
                      : `Batch AI Optimize (${stats.pending})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Live Batch AI Progress Banner */}
          {batchRunning && (
            <div className="rounded-xl border border-[#0A2239]/20 bg-[#0A2239] p-4 text-white">
              <div className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-300 shrink-0" />
                  <span className="truncate font-semibold">
                    {isVi ? 'Gemini AI đang dịch & tối ưu SEO:' : 'Gemini AI optimizing:'}{' '}
                    {batchProgress.title}
                  </span>
                </div>
                <span className="font-mono tabular-nums shrink-0">
                  {batchProgress.current} / {batchProgress.total}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full bg-amber-300 transition-all duration-300"
                  style={{
                    width: `${
                      batchProgress.total > 0
                        ? Math.round(
                            (batchProgress.current / batchProgress.total) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Videos Table or Empty Prompt */}
          {videos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center">
              <Youtube className="mx-auto h-10 w-10 text-[#C8102E]" />
              <h3 className="mt-3 font-display text-lg font-bold text-[#0A2239]">
                {isVi
                  ? 'Chưa có video nào trong Firestore'
                  : 'No videos synced to Firestore yet'}
              </h3>
              <p className="mx-auto mt-1.5 max-w-lg text-sm text-[#526071]">
                {isVi
                  ? 'Bắt đầu bằng cách đồng bộ kênh mẫu Lang Thang Boston hoặc dán bất kỳ đường dẫn kênh YouTube nào để tự động lấy toàn bộ chủ đề và video.'
                  : 'Start by importing the Lang Thang Boston sample channel or paste any YouTube channel URL to automatically fetch playlists and videos.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubTab('import');
                  void handleFetchChannel(SAMPLE_YOUTUBE_CHANNEL_URL);
                }}
                className="mt-5 inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#C8102E] px-5 py-2 text-sm font-semibold text-white hover:bg-[#A10C24]"
              >
                <DownloadCloud className="h-4 w-4" />
                <span>
                  {isVi
                    ? 'Quét ngay kênh mẫu Lang Thang Boston'
                    : 'Scan Lang Thang Boston Channel Now'}
                </span>
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E3E7EE] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#526071]">
                    <tr>
                      <th className="px-4 py-3">{isVi ? 'Video' : 'Video'}</th>
                      <th className="px-3 py-3">{isVi ? 'Chủ đề' : 'Topic'}</th>
                      <th className="px-3 py-3">{isVi ? 'Song ngữ / AI' : 'Bilingual / AI'}</th>
                      <th className="px-3 py-3">{isVi ? 'Trạng thái' : 'Status'}</th>
                      <th className="px-4 py-3 text-right">{isVi ? 'Thao tác' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EE]">
                    {filteredVideos.map((vid) => {
                      const topic = vid.topicId ? topicMap.get(vid.topicId) : null;
                      const busyThis = aiBusyId === vid.id;
                      return (
                        <tr key={vid.id} className="hover:bg-[#F7F8FA]/70">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-[#0A2239]">
                                <img
                                  src={vid.thumbnail}
                                  alt={vid.titleVi}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                                {vid.duration && (
                                  <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[10px] text-white tabular-nums">
                                    {vid.duration}
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 max-w-md">
                                <div className="flex items-center gap-1.5">
                                  <p className="truncate font-semibold text-[#0A2239]">
                                    VI: {vid.titleVi}
                                  </p>
                                  {vid.manuallyEdited && (
                                    <span title={isVi ? 'Đã khóa chỉnh tay (không ghi đè khi đồng bộ)' : 'Manually locked'}>
                                      <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 truncate text-[#526071]">
                                  EN: {vid.titleEn}
                                </p>
                                <p className="mt-1 font-mono text-[10px] text-[#526071]">
                                  /{vid.slugVi} · {vid.youtubeId}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="font-medium text-[#0F1B2B]">
                              {topic
                                ? isVi
                                  ? topic.titleVi
                                  : topic.titleEn
                                : isVi
                                  ? 'Chưa phân loại'
                                  : 'Uncategorized'}
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
                                vid.aiStatus === 'optimized'
                                  ? 'text-emerald-700'
                                  : vid.aiStatus === 'manual'
                                    ? 'text-[#0A2239]'
                                    : 'text-amber-700'
                              }`}
                            >
                              {vid.aiStatus === 'optimized' ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                              <span>
                                {vid.aiStatus === 'optimized'
                                  ? isVi
                                    ? 'Đã tối ưu AI'
                                    : 'AI Ready'
                                  : vid.aiStatus === 'manual'
                                    ? isVi
                                      ? 'Chỉnh tay'
                                      : 'Manual'
                                    : isVi
                                      ? 'Chờ AI'
                                      : 'Pending'}
                              </span>
                            </span>
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                void saveVideoItem(
                                  {
                                    ...vid,
                                    status:
                                      vid.status === 'published'
                                        ? 'draft'
                                        : 'published',
                                  },
                                  uid
                                )
                              }
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                vid.status === 'published'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}
                            >
                              {vid.status === 'published' ? (
                                <Eye className="h-3 w-3" />
                              ) : (
                                <EyeOff className="h-3 w-3" />
                              )}
                              <span>
                                {vid.status === 'published'
                                  ? isVi
                                    ? 'Xuất bản'
                                    : 'Published'
                                  : isVi
                                    ? 'Nháp'
                                    : 'Draft'}
                              </span>
                            </button>
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busyThis || batchRunning}
                                onClick={() => void runGeminiForVideo(vid, true)}
                                title={
                                  isVi
                                    ? 'Dùng Gemini AI dịch song ngữ & tối ưu SEO ngay'
                                    : 'Optimize bilingual & SEO with Gemini AI'
                                }
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#0A2239]/20 bg-[#F7F8FA] px-2.5 text-[11px] font-semibold text-[#0A2239] hover:bg-[#0A2239] hover:text-white disabled:opacity-40"
                              >
                                {busyThis ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" />
                                )}
                                <span>AI SEO</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVideo(vid);
                                  setAiProposal(null);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E3E7EE] text-[#0A2239] hover:bg-[#F7F8FA]"
                                title={isVi ? 'Chỉnh sửa chi tiết' : 'Edit video'}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteVideoItem(vid.id);
                                  onNotice(
                                    isVi ? 'Đã xóa video khỏi thư viện.' : 'Video deleted.'
                                  );
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E3E7EE] text-[#526071] hover:border-red-200 hover:bg-red-50 hover:text-[#C8102E]"
                                title={isVi ? 'Xóa video' : 'Delete video'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: YOUTUBE CHANNEL IMPORTER & CTA SETTINGS                    */}
      {/* ===================================================================== */}
      {subTab === 'import' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#E3E7EE] bg-white p-6">
            <h3 className="font-display text-lg font-bold text-[#0A2239]">
              {isVi
                ? 'Nhập tự động từ Kênh YouTube / Playlist / Video'
                : 'Auto-Import from YouTube Channel / Playlist / Video'}
            </h3>
            <p className="mt-1 text-sm text-[#526071]">
              {isVi
                ? 'Hỗ trợ đường dẫn kênh (/channel/UC..., /@handle), đường dẫn Playlist hoặc từng video lẻ. Hệ thống tự lấy danh sách chủ đề, video, thời lượng, mô tả và đồng bộ không ghi đè bài bạn đã chỉnh sửa.'
                : 'Supports channel URLs (/channel/UC..., /@handle), playlist URLs, or single videos. Automatically imports topics, videos, durations, and descriptions non-destructively.'}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://www.youtube.com/channel/UC... hoặc @handle"
                className="h-11 flex-1 rounded-lg border border-[#CBD5E1] px-3.5 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
              />
              <button
                type="button"
                disabled={fetchingImport || !importUrl.trim()}
                onClick={() => void handleFetchChannel()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0A2239] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#143757] disabled:opacity-50 whitespace-nowrap"
              >
                {fetchingImport ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span>
                  {fetchingImport
                    ? isVi
                      ? 'Đang quét YouTube...'
                      : 'Scanning YouTube...'
                    : isVi
                      ? 'Quét dữ liệu kênh'
                      : 'Scan Channel'}
                </span>
              </button>
            </div>

            {/* Quick Sample Channel Shortcut */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => void handleFetchChannel(SAMPLE_YOUTUBE_CHANNEL_URL)}
                className="inline-flex items-center gap-1.5 font-semibold text-[#C8102E] hover:underline"
              >
                <Youtube className="h-3.5 w-3.5" />
                <span>
                  {isVi
                    ? 'Dùng nhanh kênh mẫu: Lang Thang Boston (UCamcyJiCcgHge0T9hW95ocA)'
                    : 'Quick test: Lang Thang Boston (UCamcyJiCcgHge0T9hW95ocA)'}
                </span>
              </button>
            </div>

            {/* Import Depth Options */}
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#E3E7EE] pt-4 sm:grid-cols-3">
              <label className="block text-xs">
                <span className="font-semibold text-[#0A2239]">
                  {isVi ? 'Số chủ đề (Playlist) tối đa' : 'Max Playlists'}
                </span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxPlaylists}
                  onChange={(e) => setMaxPlaylists(Number(e.target.value) || 12)}
                  className="mt-1 h-9 w-full rounded-lg border border-[#E3E7EE] px-3 text-sm"
                />
              </label>

              <label className="block text-xs">
                <span className="font-semibold text-[#0A2239]">
                  {isVi ? 'Số video tối đa / chủ đề' : 'Max Videos / Playlist'}
                </span>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={maxVideosPerPlaylist}
                  onChange={(e) =>
                    setMaxVideosPerPlaylist(Number(e.target.value) || 20)
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[#E3E7EE] px-3 text-sm"
                />
              </label>

              <label className="block text-xs">
                <span className="font-semibold text-[#0A2239]">
                  {isVi ? 'Trạng thái video mới nhập' : 'Default Status for New Videos'}
                </span>
                <select
                  value={importDefaultStatus}
                  onChange={(e) =>
                    setImportDefaultStatus(e.target.value as 'published' | 'draft')
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[#E3E7EE] bg-white px-3 text-sm"
                >
                  <option value="published">
                    {isVi ? 'Xuất bản ngay lên thư viện' : 'Publish Immediately'}
                  </option>
                  <option value="draft">
                    {isVi ? 'Lưu bản nháp (Duyệt trước)' : 'Save as Draft (Review First)'}
                  </option>
                </select>
              </label>
            </div>

            {importError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-[#C8102E]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Preview & Selective Playlist Sync Panel */}
            {importPreview && (
              <div className="mt-6 rounded-xl border border-[#0A2239]/20 bg-[#F7F8FA] p-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E3E7EE] pb-4">
                  <div className="flex items-center gap-3">
                    {importPreview.channel.avatarUrl && (
                      <img
                        src={importPreview.channel.avatarUrl}
                        alt={importPreview.channel.title}
                        className="h-12 w-12 rounded-full border border-[#E3E7EE] object-cover"
                      />
                    )}
                    <div>
                      <h4 className="font-display text-base font-bold text-[#0A2239]">
                        {importPreview.channel.title}
                      </h4>
                      <p className="font-mono text-xs text-[#526071]">
                        {importPreview.channel.handle ||
                          importPreview.channel.youtubeChannelId}{' '}
                        · {importPreview.stats.playlistsFound}{' '}
                        {isVi ? 'chủ đề' : 'playlists'} ·{' '}
                        {importPreview.stats.videosFound} video
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={syncingImport}
                    onClick={() => void handleConfirmSyncToFirestore()}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white hover:bg-[#A10C24] disabled:opacity-50"
                  >
                    {syncingImport ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>
                      {syncingImport
                        ? isVi
                          ? 'Đang đồng bộ & dịch chủ đề...'
                          : 'Syncing & Translating...'
                        : isVi
                          ? 'Đồng bộ vào Thư viện (Không ghi đè)'
                          : 'Sync to Library (Non-Destructive)'}
                    </span>
                  </button>
                </div>

                {/* Auto-translate playlist titles option */}
                <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#0A2239]">
                  <input
                    type="checkbox"
                    checked={autoTranslateTopicsOnSync}
                    onChange={(e) =>
                      setAutoTranslateTopicsOnSync(e.target.checked)
                    }
                    className="h-4 w-4 accent-[#C8102E]"
                  />
                  <Sparkles className="h-3.5 w-3.5 text-[#C8102E]" />
                  <span>
                    {isVi
                      ? 'Tự động gọi Google Gemini AI chuẩn hóa & dịch tên các chủ đề (Playlist) sang song ngữ VI/EN khi lưu'
                      : 'Auto-translate playlist names into bilingual VI/EN using Google Gemini AI on sync'}
                  </span>
                </label>

                {/* Playlist Checkboxes */}
                {importPreview.playlists.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0A2239]">
                        {isVi
                          ? 'Chọn các chủ đề (Playlist) muốn nhập:'
                          : 'Select playlists to import:'}
                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPlaylistIds(
                              new Set(
                                importPreview.playlists.map(
                                  (p) => p.youtubePlaylistId
                                )
                              )
                            )
                          }
                          className="font-semibold text-[#0A2239] hover:underline"
                        >
                          {isVi ? 'Chọn tất cả' : 'Select all'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPlaylistIds(new Set())}
                          className="font-semibold text-[#526071] hover:underline"
                        >
                          {isVi ? 'Bỏ chọn' : 'Clear'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {importPreview.playlists.map((pl) => {
                        const checked = selectedPlaylistIds.has(
                          pl.youtubePlaylistId
                        );
                        return (
                          <label
                            key={pl.youtubePlaylistId}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-2.5 text-xs ${
                              checked
                                ? 'border-[#0A2239] bg-white'
                                : 'border-[#E3E7EE] bg-white/60 opacity-75'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(selectedPlaylistIds);
                                  if (checked) next.delete(pl.youtubePlaylistId);
                                  else next.add(pl.youtubePlaylistId);
                                  setSelectedPlaylistIds(next);
                                }}
                                className="h-4 w-4 accent-[#C8102E] shrink-0"
                              />
                              <span className="truncate font-semibold text-[#0A2239]">
                                {pl.title}
                              </span>
                            </span>
                            <span className="font-mono text-[11px] text-[#526071] tabular-nums shrink-0">
                              {pl.videoIds.length} vid
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Connected Channels & Player CTA Management */}
          <div className="rounded-2xl border border-[#E3E7EE] bg-white p-6">
            <h3 className="font-display text-base font-bold text-[#0A2239]">
              {isVi
                ? 'Kênh đã kết nối & Cấu hình khối CTA dưới trình phát'
                : 'Connected Channels & Below-Player CTA Configuration'}
            </h3>

            {channels.length === 0 ? (
              <p className="mt-2 text-sm text-[#526071]">
                {isVi
                  ? 'Chưa có kênh nào được lưu trong Firestore. Hãy quét và đồng bộ kênh ở phía trên.'
                  : 'No connected channels saved yet. Scan and sync a channel above.'}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {channels.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-[#E3E7EE] p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Youtube className="h-4 w-4 text-[#C8102E]" />
                        <p className="font-display text-sm font-bold text-[#0A2239]">
                          {ch.titleVi}
                        </p>
                        {ch.handle && (
                          <span className="font-mono text-xs text-[#526071]">
                            {ch.handle}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[#526071]">
                        {isVi ? 'CTA dưới video:' : 'Player CTA:'}{' '}
                        <strong>
                          {ch.ctaEnabled
                            ? ch.ctaTitleVi || 'Đang bật'
                            : isVi
                              ? 'Đang tắt'
                              : 'Disabled'}
                        </strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleFetchChannel(ch.url)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 text-xs font-semibold text-[#0A2239] hover:border-[#0A2239]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>{isVi ? 'Đồng bộ mới' : 'Re-Sync'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingChannel(ch)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2239] px-3 text-xs font-semibold text-white hover:bg-[#143757]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>{isVi ? 'Sửa Kênh & CTA' : 'Edit Channel & CTA'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteVideoChannel(ch.id);
                          onNotice(isVi ? 'Đã xóa cấu hình kênh.' : 'Channel removed.');
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#526071] hover:border-red-200 hover:bg-red-50 hover:text-[#C8102E]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: TOPICS / PLAYLISTS MANAGER                                 */}
      {/* ===================================================================== */}
      {subTab === 'topics' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[#526071]">
              {isVi
                ? 'Sắp xếp thứ tự hiển thị, đổi tên song ngữ VI/EN hoặc tạo chủ đề tùy chỉnh cho thư viện video.'
                : 'Manage display order, bilingual VI/EN labels, or add custom video topics.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={translatingTopics || topics.length === 0}
                onClick={() => void handleTranslateAllTopics()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2239] px-3.5 text-xs font-semibold text-white hover:bg-[#143757] disabled:opacity-40"
              >
                {translatingTopics ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                )}
                <span>
                  {isVi ? 'AI Dịch tất cả Chủ đề (VI/EN)' : 'AI Translate All Topics'}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setEditingTopic({
                    id: '',
                    channelId: channels[0]?.id || 'manual',
                    youtubePlaylistId: '',
                    titleVi: '',
                    titleEn: '',
                    descriptionVi: '',
                    descriptionEn: '',
                    slug: '',
                    sortOrder: topics.length,
                    published: true,
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C8102E] px-3.5 text-xs font-semibold text-white hover:bg-[#A10C24]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isVi ? 'Thêm chủ đề mới' : 'New Topic'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E3E7EE] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#526071]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">{isVi ? 'Tên Tiếng Việt' : 'Vietnamese Title'}</th>
                  <th className="px-4 py-3">{isVi ? 'Tên Tiếng Anh' : 'English Title'}</th>
                  <th className="px-3 py-3">Slug</th>
                  <th className="px-3 py-3">{isVi ? 'Số video' : 'Videos'}</th>
                  <th className="px-4 py-3 text-right">{isVi ? 'Thao tác' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EE]">
                {topics.map((t) => {
                  const vidCount = videos.filter((v) => v.topicId === t.id).length;
                  return (
                    <tr key={t.id} className="hover:bg-[#F7F8FA]/70">
                      <td className="px-4 py-3 font-mono text-[#526071] tabular-nums">
                        {t.sortOrder}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0A2239]">
                        {t.titleVi}
                      </td>
                      <td className="px-4 py-3 text-[#0F1B2B]">{t.titleEn}</td>
                      <td className="px-3 py-3 font-mono text-[#526071]">{t.slug}</td>
                      <td className="px-3 py-3 font-mono tabular-nums">{vidCount}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingTopic(t)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E3E7EE] text-[#0A2239] hover:bg-[#F7F8FA]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteVideoTopic(t.id);
                              onNotice(isVi ? 'Đã xóa chủ đề.' : 'Topic deleted.');
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E3E7EE] text-[#526071] hover:border-red-200 hover:bg-red-50 hover:text-[#C8102E]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: AI GLOSSARY / TRANSLATION MEMORY                           */}
      {/* ===================================================================== */}
      {subTab === 'glossary' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#E3E7EE] bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#0A2239]">
                  {isVi
                    ? 'Bộ Từ điển Thuật ngữ Chuyên ngành cho Google Gemini AI'
                    : 'Domain Glossary / Translation Memory for Gemini AI'}
                </h3>
                <p className="mt-1 text-xs text-[#526071]">
                  {isVi
                    ? 'Mọi thuật ngữ khai báo ở đây sẽ tự động đính kèm vào lệnh dịch của Gemini AI để đảm bảo 100% video đồng nhất danh từ riêng, địa danh và thuật ngữ thương hiệu.'
                    : 'Every term listed here is automatically injected into Gemini AI prompts so 100% of translated videos preserve consistent proper nouns and brand terminology.'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const added = await seedDefaultGlossaryTerms(uid);
                  onNotice(
                    isVi
                      ? added > 0
                        ? `Đã nạp ${added} thuật ngữ Boston chuẩn mẫu.`
                        : 'Bộ thuật ngữ mẫu đã có sẵn.'
                      : `Seeded ${added} default Boston glossary terms.`
                  );
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#0A2239] px-3.5 text-xs font-semibold text-[#0A2239] hover:bg-[#0A2239] hover:text-white"
              >
                <Languages className="h-3.5 w-3.5" />
                <span>
                  {isVi ? 'Nạp bộ thuật ngữ Boston mẫu' : 'Seed Boston Terms'}
                </span>
              </button>
            </div>

            <form
              onSubmit={handleAddGlossaryTerm}
              className="mt-4 grid grid-cols-1 gap-3 border-t border-[#E3E7EE] pt-4 md:grid-cols-12"
            >
              <input
                type="text"
                required
                value={newTerm.sourceTerm}
                onChange={(e) =>
                  setNewTerm((p) => ({ ...p, sourceTerm: e.target.value }))
                }
                placeholder={isVi ? 'Thuật ngữ gốc (VD: Freedom Trail)' : 'Source Term'}
                className="h-10 rounded-lg border border-[#CBD5E1] px-3 text-xs md:col-span-3"
              />
              <input
                type="text"
                disabled={newTerm.keepOriginal}
                value={newTerm.keepOriginal ? newTerm.sourceTerm : newTerm.targetVi}
                onChange={(e) =>
                  setNewTerm((p) => ({ ...p, targetVi: e.target.value }))
                }
                placeholder={isVi ? 'Bản Tiếng Việt chuẩn' : 'Target Vietnamese'}
                className="h-10 rounded-lg border border-[#CBD5E1] px-3 text-xs disabled:bg-[#F7F8FA] md:col-span-3"
              />
              <input
                type="text"
                disabled={newTerm.keepOriginal}
                value={newTerm.keepOriginal ? newTerm.sourceTerm : newTerm.targetEn}
                onChange={(e) =>
                  setNewTerm((p) => ({ ...p, targetEn: e.target.value }))
                }
                placeholder={isVi ? 'Bản Tiếng Anh chuẩn' : 'Target English'}
                className="h-10 rounded-lg border border-[#CBD5E1] px-3 text-xs disabled:bg-[#F7F8FA] md:col-span-3"
              />
              <button
                type="submit"
                disabled={savingTerm}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#A10C24] md:col-span-3"
              >
                <Plus className="h-4 w-4" />
                <span>{isVi ? 'Thêm quy tắc' : 'Add Rule'}</span>
              </button>

              <div className="flex flex-wrap items-center gap-4 md:col-span-12">
                <label className="inline-flex items-center gap-2 text-xs text-[#0A2239]">
                  <input
                    type="checkbox"
                    checked={newTerm.keepOriginal}
                    onChange={(e) =>
                      setNewTerm((p) => ({ ...p, keepOriginal: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[#C8102E]"
                  />
                  <span>
                    {isVi
                      ? 'Giữ nguyên danh từ riêng ở cả hai ngôn ngữ'
                      : 'Keep original proper noun in both languages'}
                  </span>
                </label>
                <input
                  type="text"
                  value={newTerm.notes}
                  onChange={(e) =>
                    setNewTerm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder={isVi ? 'Ghi chú ngữ cảnh cho AI (tùy chọn)...' : 'Optional context note for AI...'}
                  className="h-9 flex-1 min-w-[200px] rounded-lg border border-[#E3E7EE] px-3 text-xs"
                />
              </div>
            </form>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E3E7EE] bg-white">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-[11px] font-semibold uppercase tracking-wider text-[#526071]">
                <tr>
                  <th className="px-4 py-3">{isVi ? 'Thuật ngữ gốc' : 'Source'}</th>
                  <th className="px-4 py-3">{isVi ? 'Tiếng Việt chuẩn' : 'Vietnamese'}</th>
                  <th className="px-4 py-3">{isVi ? 'Tiếng Anh chuẩn' : 'English'}</th>
                  <th className="px-4 py-3">{isVi ? 'Ghi chú ngữ cảnh' : 'Notes'}</th>
                  <th className="px-4 py-3 text-right">{isVi ? 'Xóa' : 'Delete'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EE]">
                {glossary.map((term) => (
                  <tr key={term.id}>
                    <td className="px-4 py-3 font-semibold text-[#0A2239]">
                      {term.sourceTerm}
                      {term.keepOriginal && (
                        <span className="ml-2 font-mono text-[10px] text-[#C8102E]">
                          [KEEP]
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{term.targetVi}</td>
                    <td className="px-4 py-3">{term.targetEn}</td>
                    <td className="px-4 py-3 text-[#526071]">{term.notes || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteGlossaryTerm(term.id);
                          onNotice(isVi ? 'Đã xóa thuật ngữ.' : 'Term removed.');
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E3E7EE] text-[#526071] hover:border-red-200 hover:bg-red-50 hover:text-[#C8102E]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {glossary.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#526071]">
                      {isVi
                        ? 'Chưa có thuật ngữ nào. Hãy thêm quy tắc ở trên hoặc bấm "Nạp bộ thuật ngữ Boston mẫu".'
                        : 'No glossary terms yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 5: HYBRID AUTO-SYNC (WEBSUB + CLOUD SCHEDULER) & AUDIT LOGS   */}
      {/* ===================================================================== */}
      {subTab === 'automation' && (
        <VideoAutoSyncPanel
          uid={uid}
          adminLang={adminLang}
          channels={channels}
          syncLogs={syncLogs}
          onNotice={onNotice}
          onGoToImport={() => setSubTab('import')}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: VIDEO EDITOR WITH GEMINI AI REVIEW DIFF & MANUAL LOCK        */}
      {/* ===================================================================== */}
      {editingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/65 p-4 backdrop-blur-xs"
          onClick={() => {
            setEditingVideo(null);
            setAiProposal(null);
          }}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E7EE] px-6 py-4">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-extrabold text-[#0A2239]">
                  {isVi
                    ? 'Biên tập Video Song ngữ & Tối ưu SEO'
                    : 'Bilingual Video & SEO Editor'}
                </h3>
                <p className="font-mono text-xs text-[#526071]">
                  YouTube ID: {editingVideo.youtubeId} · {editingVideo.channelName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={aiBusyId === editingVideo.id}
                  onClick={() => void runGeminiForVideo(editingVideo, false)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2239] px-3.5 text-xs font-semibold text-white hover:bg-[#143757] disabled:opacity-50"
                >
                  {aiBusyId === editingVideo.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  )}
                  <span>
                    {aiBusyId === editingVideo.id
                      ? isVi
                        ? 'Gemini đang phân tích...'
                        : 'Gemini analyzing...'
                      : isVi
                        ? 'AI Đề xuất Song ngữ & SEO (Xem trước)'
                        : 'AI Bilingual & SEO Preview'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingVideo(null);
                    setAiProposal(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#0A2239] hover:bg-[#F7F8FA]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {/* AI REVIEW DIFF BANNER */}
              {aiProposal && (
                <div className="rounded-xl border-2 border-[#0A2239] bg-[#F7F8FA] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E7EE] pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#C8102E]" />
                      <h4 className="font-display text-sm font-bold text-[#0A2239]">
                        {isVi
                          ? 'Bản đề xuất từ Google Gemini AI (Duyệt trước khi áp dụng)'
                          : 'Google Gemini AI Proposal (Review Before Applying)'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAiProposal(null)}
                        className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-xs font-semibold text-[#526071]"
                      >
                        {isVi ? 'Bỏ qua' : 'Dismiss'}
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyAiProposal}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8102E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#A10C24]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{isVi ? 'Áp dụng kết quả AI' : 'Apply AI Proposal'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                    <div className="space-y-1.5 rounded-lg bg-white p-3 border border-[#E3E7EE]">
                      <p className="font-mono text-[10px] font-bold uppercase text-[#C8102E]">
                        Tiếng Việt (AI đề xuất)
                      </p>
                      <p className="font-bold text-[#0A2239]">{aiProposal.titleVi}</p>
                      <p className="text-[#526071]">{aiProposal.summaryVi}</p>
                      <p className="font-mono text-[11px] text-emerald-700">
                        SEO: {aiProposal.seoTitleVi} · /{aiProposal.slugVi}
                      </p>
                    </div>
                    <div className="space-y-1.5 rounded-lg bg-white p-3 border border-[#E3E7EE]">
                      <p className="font-mono text-[10px] font-bold uppercase text-[#0A2239]">
                        English (AI proposed)
                      </p>
                      <p className="font-bold text-[#0A2239]">{aiProposal.titleEn}</p>
                      <p className="text-[#526071]">{aiProposal.summaryEn}</p>
                      <p className="font-mono text-[11px] text-emerald-700">
                        SEO: {aiProposal.seoTitleEn} · /{aiProposal.slugEn}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Topic, Status & Manual Lock Bar */}
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-4 md:grid-cols-4">
                <label className="text-xs">
                  <span className="font-semibold text-[#0A2239]">
                    {isVi ? 'Chủ đề / Playlist' : 'Topic / Playlist'}
                  </span>
                  <select
                    value={editingVideo.topicId}
                    onChange={(e) =>
                      setEditingVideo({ ...editingVideo, topicId: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs"
                  >
                    <option value="">{isVi ? '-- Chưa phân loại --' : '-- Uncategorized --'}</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {isVi ? t.titleVi : t.titleEn}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs">
                  <span className="font-semibold text-[#0A2239]">
                    {isVi ? 'Trạng thái' : 'Status'}
                  </span>
                  <select
                    value={editingVideo.status}
                    onChange={(e) =>
                      setEditingVideo({
                        ...editingVideo,
                        status: e.target.value as 'draft' | 'published',
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs"
                  >
                    <option value="published">{isVi ? 'Đã xuất bản' : 'Published'}</option>
                    <option value="draft">{isVi ? 'Bản nháp' : 'Draft'}</option>
                  </select>
                </label>

                <label className="text-xs">
                  <span className="font-semibold text-[#0A2239]">
                    {isVi ? 'Thứ tự hiển thị' : 'Sort Order'}
                  </span>
                  <input
                    type="number"
                    value={editingVideo.sortOrder}
                    onChange={(e) =>
                      setEditingVideo({
                        ...editingVideo,
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs"
                  />
                </label>

                <div className="flex flex-col justify-end gap-2 text-xs">
                  <label className="inline-flex items-center gap-2 font-semibold text-[#0A2239]">
                    <input
                      type="checkbox"
                      checked={editingVideo.manuallyEdited}
                      onChange={(e) =>
                        setEditingVideo({
                          ...editingVideo,
                          manuallyEdited: e.target.checked,
                          aiStatus: e.target.checked
                            ? editingVideo.aiStatus === 'pending'
                              ? 'manual'
                              : editingVideo.aiStatus
                            : editingVideo.aiStatus,
                        })
                      }
                      className="h-4 w-4 accent-[#C8102E]"
                    />
                    {editingVideo.manuallyEdited ? (
                      <Lock className="h-3.5 w-3.5 text-amber-600" />
                    ) : (
                      <LockOpen className="h-3.5 w-3.5 text-[#526071]" />
                    )}
                    <span>{isVi ? 'Khóa chỉnh tay' : 'Manual Lock'}</span>
                  </label>
                  <label className="inline-flex items-center gap-2 font-semibold text-[#0A2239]">
                    <input
                      type="checkbox"
                      checked={editingVideo.featured}
                      onChange={(e) =>
                        setEditingVideo({
                          ...editingVideo,
                          featured: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[#C8102E]"
                    />
                    <span>{isVi ? 'Ghim nổi bật đầu danh sách' : 'Featured Video'}</span>
                  </label>
                </div>
              </div>

              {/* Side-by-Side VI | EN Editor */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Vietnamese Column */}
                <div className="space-y-3 rounded-xl border border-[#E3E7EE] p-4">
                  <p className="font-mono text-xs font-bold uppercase text-[#C8102E]">
                    Tiếng Việt (VI)
                  </p>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">Tiêu đề hiển thị (VI)</span>
                    <input
                      type="text"
                      value={editingVideo.titleVi}
                      onChange={(e) =>
                        setEditingVideo({ ...editingVideo, titleVi: e.target.value })
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">Tóm tắt ngắn (VI)</span>
                    <textarea
                      rows={2}
                      value={editingVideo.summaryVi}
                      onChange={(e) =>
                        setEditingVideo({ ...editingVideo, summaryVi: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">Mô tả chi tiết (VI)</span>
                    <textarea
                      rows={4}
                      value={editingVideo.descriptionVi}
                      onChange={(e) =>
                        setEditingVideo({ ...editingVideo, descriptionVi: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">
                      Điểm chính (mỗi dòng 1 ý, tối đa 5)
                    </span>
                    <textarea
                      rows={3}
                      value={editingVideo.highlightsVi.join('\n')}
                      onChange={(e) =>
                        setEditingVideo({
                          ...editingVideo,
                          highlightsVi: e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .slice(0, 5),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs">
                      <span className="font-semibold text-[#0A2239]">SEO Title (VI)</span>
                      <input
                        type="text"
                        value={editingVideo.seoTitleVi}
                        onChange={(e) =>
                          setEditingVideo({ ...editingVideo, seoTitleVi: e.target.value })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-2.5 text-xs"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-semibold text-[#0A2239]">URL Slug (VI)</span>
                      <input
                        type="text"
                        value={editingVideo.slugVi}
                        onChange={(e) =>
                          setEditingVideo({
                            ...editingVideo,
                            slugVi: slugifyVideoText(e.target.value, editingVideo.id),
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-2.5 font-mono text-xs"
                      />
                    </label>
                  </div>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">SEO Meta Description (VI)</span>
                    <textarea
                      rows={2}
                      value={editingVideo.seoDescriptionVi}
                      onChange={(e) =>
                        setEditingVideo({
                          ...editingVideo,
                          seoDescriptionVi: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                    />
                  </label>
                </div>

                {/* English Column */}
                <div className="space-y-3 rounded-xl border border-[#E3E7EE] p-4">
                  <p className="font-mono text-xs font-bold uppercase text-[#0A2239]">
                    English (EN)
                  </p>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">Display Title (EN)</span>
                    <input
                      type="text"
                      value={editingVideo.titleEn}
                      onChange={(e) =>
                        setEditingVideo({ ...editingVideo, titleEn: e.target.value })
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3 text-xs"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">Short Summary (EN)</span>
                    <textarea
                      rows={2}
                      value={editingVideo.summaryEn}
                      onChange={(e) =>
                        setEditingVideo({ ...editingVideo, summaryEn: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">Editorial Description (EN)</span>
                    <textarea
                      rows={4}
                      value={editingVideo.descriptionEn}
                      onChange={(e) =>
                        setEditingVideo({ ...editingVideo, descriptionEn: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">
                      Key Takeaways (one per line, max 5)
                    </span>
                    <textarea
                      rows={3}
                      value={editingVideo.highlightsEn.join('\n')}
                      onChange={(e) =>
                        setEditingVideo({
                          ...editingVideo,
                          highlightsEn: e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .slice(0, 5),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs">
                      <span className="font-semibold text-[#0A2239]">SEO Title (EN)</span>
                      <input
                        type="text"
                        value={editingVideo.seoTitleEn}
                        onChange={(e) =>
                          setEditingVideo({ ...editingVideo, seoTitleEn: e.target.value })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-2.5 text-xs"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="font-semibold text-[#0A2239]">URL Slug (EN)</span>
                      <input
                        type="text"
                        value={editingVideo.slugEn}
                        onChange={(e) =>
                          setEditingVideo({
                            ...editingVideo,
                            slugEn: slugifyVideoText(e.target.value, editingVideo.id),
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-2.5 font-mono text-xs"
                      />
                    </label>
                  </div>
                  <label className="block text-xs">
                    <span className="font-semibold text-[#0A2239]">SEO Meta Description (EN)</span>
                    <textarea
                      rows={2}
                      value={editingVideo.seoDescriptionEn}
                      onChange={(e) =>
                        setEditingVideo({
                          ...editingVideo,
                          seoDescriptionEn: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2.5 text-xs"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-[#E3E7EE] bg-[#F7F8FA] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setEditingVideo(null);
                  setAiProposal(null);
                }}
                className="h-10 rounded-lg border border-[#E3E7EE] bg-white px-4 text-xs font-semibold text-[#526071]"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={savingVideo}
                onClick={() => void handleSaveEditedVideo()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#C8102E] px-5 text-xs font-semibold text-white hover:bg-[#A10C24] disabled:opacity-50"
              >
                {savingVideo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>{isVi ? 'Lưu Video' : 'Save Video'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CHANNEL & BELOW-PLAYER CTA EDITOR                            */}
      {/* ===================================================================== */}
      {editingChannel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/65 p-4 backdrop-blur-xs"
          onClick={() => setEditingChannel(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-3">
              <h3 className="font-display text-lg font-bold text-[#0A2239]">
                {isVi
                  ? 'Cấu hình Kênh & Khối CTA dưới trình phát'
                  : 'Channel & Below-Player CTA Settings'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingChannel(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E3E7EE]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-semibold text-[#0A2239]">Tên kênh (VI)</span>
                  <input
                    type="text"
                    value={editingChannel.titleVi}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, titleVi: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-[#0A2239]">Channel Name (EN)</span>
                  <input
                    type="text"
                    value={editingChannel.titleEn}
                    onChange={(e) =>
                      setEditingChannel({ ...editingChannel, titleEn: e.target.value })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3"
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-2 font-semibold text-[#0A2239]">
                <input
                  type="checkbox"
                  checked={editingChannel.ctaEnabled}
                  onChange={(e) =>
                    setEditingChannel({
                      ...editingChannel,
                      ctaEnabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-[#C8102E]"
                />
                <span>
                  {isVi
                    ? 'Hiển thị khối kêu gọi hành động (CTA) ngay dưới trình phát video'
                    : 'Show customizable CTA card below the video player'}
                </span>
              </label>

              {editingChannel.ctaEnabled && (
                <div className="space-y-3 rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="font-semibold text-[#0A2239]">Tiêu đề CTA (VI)</span>
                      <input
                        type="text"
                        value={editingChannel.ctaTitleVi}
                        onChange={(e) =>
                          setEditingChannel({
                            ...editingChannel,
                            ctaTitleVi: e.target.value,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3"
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-[#0A2239]">CTA Title (EN)</span>
                      <input
                        type="text"
                        value={editingChannel.ctaTitleEn}
                        onChange={(e) =>
                          setEditingChannel({
                            ...editingChannel,
                            ctaTitleEn: e.target.value,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="font-semibold text-[#0A2239]">Mô tả CTA (VI)</span>
                      <textarea
                        rows={2}
                        value={editingChannel.ctaSubtitleVi}
                        onChange={(e) =>
                          setEditingChannel({
                            ...editingChannel,
                            ctaSubtitleVi: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white p-2.5"
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-[#0A2239]">CTA Subtitle (EN)</span>
                      <textarea
                        rows={2}
                        value={editingChannel.ctaSubtitleEn}
                        onChange={(e) =>
                          setEditingChannel({
                            ...editingChannel,
                            ctaSubtitleEn: e.target.value,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-[#CBD5E1] bg-white p-2.5"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="block">
                      <span className="font-semibold text-[#0A2239]">Nhãn nút (VI)</span>
                      <input
                        type="text"
                        value={editingChannel.ctaButtonLabelVi}
                        onChange={(e) =>
                          setEditingChannel({
                            ...editingChannel,
                            ctaButtonLabelVi: e.target.value,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3"
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-[#0A2239]">Button Label (EN)</span>
                      <input
                        type="text"
                        value={editingChannel.ctaButtonLabelEn}
                        onChange={(e) =>
                          setEditingChannel({
                            ...editingChannel,
                            ctaButtonLabelEn: e.target.value,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3"
                      />
                    </label>
                    <label className="block">
                      <span className="font-semibold text-[#0A2239]">Đường dẫn (URL / #anchor)</span>
                      <input
                        type="text"
                        value={editingChannel.ctaButtonUrl}
                        onChange={(e) =>
                          setEditingChannel({
                            ...editingChannel,
                            ctaButtonUrl: e.target.value,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] bg-white px-3"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingChannel(null)}
                className="h-9 rounded-lg border border-[#E3E7EE] px-4 text-xs font-semibold text-[#526071]"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={savingChannel}
                onClick={async () => {
                  setSavingChannel(true);
                  try {
                    await saveVideoChannel(editingChannel, uid);
                    onNotice(isVi ? 'Đã lưu cấu hình kênh & CTA.' : 'Channel saved.');
                    setEditingChannel(null);
                  } finally {
                    setSavingChannel(false);
                  }
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#A10C24]"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isVi ? 'Lưu cấu hình' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: TOPIC EDITOR                                                 */}
      {/* ===================================================================== */}
      {editingTopic && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/65 p-4 backdrop-blur-xs"
          onClick={() => setEditingTopic(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-[#0A2239]">
              {editingTopic.id
                ? isVi
                  ? 'Chỉnh sửa Chủ đề Video'
                  : 'Edit Video Topic'
                : isVi
                  ? 'Tạo Chủ đề Video mới'
                  : 'Create Video Topic'}
            </h3>

            <div className="mt-4 space-y-3 text-xs">
              <label className="block">
                <span className="font-semibold text-[#0A2239]">Tên chủ đề (VI)</span>
                <input
                  type="text"
                  value={editingTopic.titleVi || ''}
                  onChange={(e) =>
                    setEditingTopic({ ...editingTopic, titleVi: e.target.value })
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3"
                />
              </label>
              <label className="block">
                <span className="font-semibold text-[#0A2239]">Topic Title (EN)</span>
                <input
                  type="text"
                  value={editingTopic.titleEn || ''}
                  onChange={(e) =>
                    setEditingTopic({ ...editingTopic, titleEn: e.target.value })
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="font-semibold text-[#0A2239]">URL Slug</span>
                  <input
                    type="text"
                    value={editingTopic.slug || ''}
                    onChange={(e) =>
                      setEditingTopic({
                        ...editingTopic,
                        slug: slugifyVideoText(e.target.value),
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3 font-mono"
                  />
                </label>
                <label className="block">
                  <span className="font-semibold text-[#0A2239]">Thứ tự</span>
                  <input
                    type="number"
                    value={editingTopic.sortOrder ?? 0}
                    onChange={(e) =>
                      setEditingTopic({
                        ...editingTopic,
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-[#CBD5E1] px-3"
                  />
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                className="h-9 rounded-lg border border-[#E3E7EE] px-4 text-xs font-semibold text-[#526071]"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editingTopic.titleVi?.trim()) return;
                  await saveVideoTopic(
                    {
                      id:
                        editingTopic.id ||
                        `topic_${slugifyVideoText(editingTopic.titleVi, Date.now().toString(36))}`,
                      channelId:
                        editingTopic.channelId || channels[0]?.id || 'manual',
                      youtubePlaylistId: editingTopic.youtubePlaylistId || '',
                      titleVi: editingTopic.titleVi.trim(),
                      titleEn: (
                        editingTopic.titleEn || editingTopic.titleVi
                      ).trim(),
                      descriptionVi: editingTopic.descriptionVi || '',
                      descriptionEn: editingTopic.descriptionEn || '',
                      slug:
                        editingTopic.slug ||
                        slugifyVideoText(
                          editingTopic.titleEn || editingTopic.titleVi
                        ),
                      sortOrder: editingTopic.sortOrder ?? topics.length,
                      published: editingTopic.published ?? true,
                    },
                    uid
                  );
                  onNotice(isVi ? 'Đã lưu chủ đề.' : 'Topic saved.');
                  setEditingTopic(null);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#A10C24]"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isVi ? 'Lưu chủ đề' : 'Save Topic'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

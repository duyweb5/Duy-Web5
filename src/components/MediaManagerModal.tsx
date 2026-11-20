import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Crop,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  clearGoogleDriveAccessToken,
  connectGoogleDrive,
  getGoogleDriveAccessToken,
} from '../lib/firebase';
import {
  DriveImageFile,
  downloadDriveImageBlob,
  listDriveImages,
} from '../lib/driveService';
import {
  AspectCropPreset,
  ImageOptimizationOptions,
  ImageOutputFormat,
  OptimizedImageResult,
  ResizePreset,
  formatBytes,
  generateSeoFileName,
  optimizeImageBlob,
  sanitizeSeoFileNameInput,
} from '../lib/imageOptimizer';
import {
  MediaAssetRecord,
  MediaFolder,
  MediaSource,
  deleteMediaAsset,
  uploadOptimizedMediaAsset,
} from '../lib/mediaService';

export interface MediaUsageRef {
  section: string;
  label: string;
}

interface MediaManagerModalProps {
  open: boolean;
  uid: string;
  canDelete: boolean;
  assets: MediaAssetRecord[];
  defaultFolder?: MediaFolder;
  contextTitle?: string;
  contextHint?: string;
  initialTab?: 'upload' | 'drive' | 'library';
  selectMode?: boolean;
  getUsageRefs: (url: string) => MediaUsageRef[];
  onClose: () => void;
  onSelectAsset?: (asset: MediaAssetRecord) => void;
  onNotice?: (message: string) => void;
}

const FOLDER_LABELS: Record<MediaFolder, string> = {
  hero: 'Hero Trang chủ',
  experiences: 'Trải nghiệm',
  neighborhoods: 'Khu phố',
  events: 'Sự kiện',
  hotels: 'Khách sạn',
  general: 'Chung',
};

export function MediaManagerModal({
  open,
  uid,
  canDelete,
  assets,
  defaultFolder = 'general',
  contextTitle = '',
  contextHint = '',
  initialTab = 'upload',
  selectMode = true,
  getUsageRefs,
  onClose,
  onSelectAsset,
  onNotice,
}: MediaManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'drive' | 'library'>(
    initialTab
  );

  // Staging image for client-side WebP optimizer
  const [stagedBlob, setStagedBlob] = useState<Blob | null>(null);
  const [stagedSource, setStagedSource] = useState<MediaSource>('computer');
  const [stagedRawName, setStagedRawName] = useState('');
  const [options, setOptions] = useState<ImageOptimizationOptions>(() => ({
    resizePreset: defaultFolder === 'hero' ? 'hero' : 'card',
    aspectCrop: defaultFolder === 'hero' ? '16:9' : 'original',
    format: 'image/webp',
    quality: 0.82,
  }));
  const [optimized, setOptimized] = useState<OptimizedImageResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // SEO metadata inputs
  const [seoFileName, setSeoFileName] = useState('');
  const [altVi, setAltVi] = useState('');
  const [altEn, setAltEn] = useState('');
  const [folder, setFolder] = useState<MediaFolder>(defaultFolder);

  // Drag-drop state
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Google Drive state
  const [driveToken, setDriveToken] = useState<string | null>(() =>
    getGoogleDriveAccessToken()
  );
  const [driveFiles, setDriveFiles] = useState<DriveImageFile[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveImportingId, setDriveImportingId] = useState<string | null>(null);
  const [driveSearch, setDriveSearch] = useState('');
  const [driveError, setDriveError] = useState('');

  // Library state
  const [libSearch, setLibSearch] = useState('');
  const [libFolder, setLibFolder] = useState<'all' | MediaFolder>('all');
  const [deleteTarget, setDeleteTarget] = useState<MediaAssetRecord | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  // Reset modal defaults whenever opened
  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setFolder(defaultFolder);
    setOptions({
      resizePreset: defaultFolder === 'hero' ? 'hero' : 'card',
      aspectCrop: defaultFolder === 'hero' ? '16:9' : 'original',
      format: 'image/webp',
      quality: 0.82,
    });
    setStagedBlob(null);
    setOptimized(null);
    setErrorMsg('');
    setDriveError('');
    setDeleteTarget(null);
    setDriveToken(getGoogleDriveAccessToken());
  }, [open, initialTab, defaultFolder]);

  // Clipboard paste support (Ctrl+V) while Upload tab is active
  useEffect(() => {
    if (!open || activeTab !== 'upload' || stagedBlob) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            stageFileForOptimization(
              file,
              file.name || 'clipboard-photo.png',
              'computer'
            );
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, activeTab, stagedBlob, contextTitle, contextHint, options.format]);

  // Re-run client-side optimization whenever stagedBlob or optimization controls change
  useEffect(() => {
    if (!stagedBlob) {
      setOptimized(null);
      return;
    }
    let cancelled = false;
    setOptimizing(true);
    setErrorMsg('');

    void optimizeImageBlob(stagedBlob, options)
      .then((res) => {
        if (!cancelled) {
          setOptimized(res);
          // Sync extension on seoFileName if user switched output format
          setSeoFileName((prev) =>
            prev ? sanitizeSeoFileNameInput(prev, options.format) : prev
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : 'Không thể tối ưu ảnh này.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setOptimizing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [stagedBlob, options]);

  // Load Google Drive images when Drive tab opens with valid token
  const fetchDriveImages = async (token: string, queryText = driveSearch) => {
    setDriveLoading(true);
    setDriveError('');
    try {
      const list = await listDriveImages(token, queryText);
      setDriveFiles(list);
    } catch (err) {
      if (err instanceof Error && err.message === 'DRIVE_AUTH_EXPIRED') {
        clearGoogleDriveAccessToken();
        setDriveToken(null);
        setDriveFiles([]);
        setDriveError(
          'Phiên kết nối Google Drive đã hết hạn. Vui lòng kết nối lại.'
        );
      } else {
        setDriveError(
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách ảnh từ Google Drive.'
        );
      }
    } finally {
      setDriveLoading(false);
    }
  };

  useEffect(() => {
    if (open && activeTab === 'drive' && driveToken) {
      void fetchDriveImages(driveToken, '');
    }
  }, [open, activeTab, driveToken]);

  const stageFileForOptimization = (
    blob: Blob,
    rawName: string,
    source: MediaSource
  ) => {
    if (blob.size > 25 * 1024 * 1024) {
      setErrorMsg('Ảnh gốc vượt quá 25 MB. Vui lòng chọn tệp nhỏ hơn.');
      return;
    }
    setErrorMsg('');
    setStagedSource(source);
    setStagedRawName(rawName);
    setStagedBlob(blob);

    const suggestedSeo = generateSeoFileName(
      contextTitle || rawName,
      contextHint || (defaultFolder !== 'general' ? defaultFolder : ''),
      options.format
    );
    setSeoFileName(suggestedSeo);

    const fallbackLabel =
      contextTitle.trim() ||
      rawName
        .replace(/\.[a-zA-Z0-9]+$/, '')
        .replace(/[-_]+/g, ' ')
        .trim() ||
      'Hình ảnh Meet Boston';
    setAltVi(fallbackLabel);
    setAltEn(fallbackLabel);
  };

  const handleFilePick = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Vui lòng chọn tệp hình ảnh (JPG, PNG, WebP, AVIF...).');
      return;
    }
    stageFileForOptimization(file, file.name, 'computer');
  };

  const handleConnectDrive = async () => {
    setDriveError('');
    setDriveLoading(true);
    try {
      const token = await connectGoogleDrive();
      setDriveToken(token);
      await fetchDriveImages(token, driveSearch);
    } catch (err) {
      setDriveError(
        err instanceof Error
          ? err.message
          : 'Không thể kết nối Google Drive. Vui lòng thử lại.'
      );
      setDriveLoading(false);
    }
  };

  const handleImportDriveFile = async (file: DriveImageFile) => {
    if (!driveToken) return;
    setDriveImportingId(file.id);
    setDriveError('');
    try {
      const blob = await downloadDriveImageBlob(driveToken, file.id);
      stageFileForOptimization(blob, file.name, 'google_drive');
    } catch (err) {
      if (err instanceof Error && err.message === 'DRIVE_AUTH_EXPIRED') {
        clearGoogleDriveAccessToken();
        setDriveToken(null);
        setDriveError('Phiên Google Drive đã hết hạn. Vui lòng kết nối lại.');
      } else {
        setDriveError(
          err instanceof Error
            ? err.message
            : 'Không thể tải ảnh từ Google Drive.'
        );
      }
    } finally {
      setDriveImportingId(null);
    }
  };

  const handleApplySeoSuggestion = () => {
    const suggested = generateSeoFileName(
      contextTitle || altVi || stagedRawName,
      contextHint || (folder !== 'general' ? folder : 'boston'),
      options.format
    );
    setSeoFileName(suggested);
  };

  const handleCommitUpload = async () => {
    if (!stagedBlob || !optimized) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const savedAsset = await uploadOptimizedMediaAsset({
        sourceBlob: stagedBlob,
        optimized,
        options,
        seoFileName: seoFileName || stagedRawName,
        altVi: altVi || seoFileName,
        altEn: altEn || altVi || seoFileName,
        folder,
        source: stagedSource,
        uid,
      });

      const providerLabel =
        savedAsset.storageProvider === 'firebase_storage'
          ? 'Firebase Storage CDN'
          : 'WebP tối ưu (Firestore Compact)';
      onNotice?.(
        `Đã lưu ${savedAsset.seoFileName} (${formatBytes(savedAsset.optimizedBytes)}) qua ${providerLabel}.`
      );

      if (selectMode && onSelectAsset) {
        onSelectAsset(savedAsset);
        onClose();
      } else {
        setStagedBlob(null);
        setOptimized(null);
        setActiveTab('library');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể lưu ảnh lên hệ thống. Vui lòng thử lại.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMediaAsset(deleteTarget);
      onNotice?.(`Đã xóa ảnh ${deleteTarget.seoFileName} khỏi thư viện.`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filteredAssets = useMemo(() => {
    const q = libSearch.trim().toLowerCase();
    return assets.filter((a) => {
      if (libFolder !== 'all' && a.folder !== libFolder) return false;
      if (!q) return true;
      return (
        a.seoFileName.toLowerCase().includes(q) ||
        a.altVi.toLowerCase().includes(q) ||
        a.altEn.toLowerCase().includes(q)
      );
    });
  }, [assets, libSearch, libFolder]);

  const deleteTargetUsage = useMemo(
    () => (deleteTarget ? getUsageRefs(deleteTarget.url) : []),
    [deleteTarget, getUsageRefs]
  );

  if (!open) return null;

  const finalSanitizedPreview = sanitizeSeoFileNameInput(
    seoFileName || stagedRawName || 'meet-boston-photo',
    options.format
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A2239]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Quản lý & Tối ưu hình ảnh CMS"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#E3E7EE] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E3E7EE] px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold text-[#0A2239]">
              {stagedBlob
                ? 'Tối ưu ảnh & Đặt tên chuẩn SEO'
                : 'Trình tải ảnh & Thư viện Media'}
            </h2>
            <p className="mt-0.5 text-xs text-[#526071]">
              Tải ảnh từ Máy tính hoặc Google Drive · Tự động nén WebP, cắt khung chuẩn và gợi ý tên SEO
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Top Source Tabs (hidden while actively editing a staged image) */}
        {!stagedBlob && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#E3E7EE] bg-[#F7F8FA] px-6 py-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                activeTab === 'upload'
                  ? 'bg-[#0A2239] text-white'
                  : 'border border-[#E3E7EE] bg-white text-[#526071] hover:text-[#0A2239]'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Tải từ Máy tính</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('drive')}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                activeTab === 'drive'
                  ? 'bg-[#0A2239] text-white'
                  : 'border border-[#E3E7EE] bg-white text-[#526071] hover:text-[#0A2239]'
              }`}
            >
              <Cloud className="h-3.5 w-3.5" />
              <span>Google Drive</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                activeTab === 'library'
                  ? 'bg-[#0A2239] text-white'
                  : 'border border-[#E3E7EE] bg-white text-[#526071] hover:text-[#0A2239]'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Thư viện Media</span>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  activeTab === 'library' ? 'text-white/80' : 'text-[#526071]'
                }`}
              >
                ({assets.length})
              </span>
            </button>
          </div>
        )}

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ============================================================== */}
          {/* VIEW A: LIVE CLIENT-SIDE OPTIMIZER & SEO STUDIO                */}
          {/* ============================================================== */}
          {stagedBlob ? (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left 6 cols: Live Preview + Before/After Telemetry */}
              <div className="space-y-4 lg:col-span-6">
                <div className="overflow-hidden rounded-xl border border-[#E3E7EE] bg-[#F7F8FA]">
                  <div className="relative flex aspect-[16/10] items-center justify-center bg-[#0F1B2B]/5 p-2">
                    {optimized ? (
                      <img
                        src={optimized.dataUrl}
                        alt={altVi || 'Xem trước ảnh tối ưu'}
                        className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-[#526071]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang xử lý và nén ảnh...</span>
                      </div>
                    )}
                    {optimizing && optimized && (
                      <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-[#0A2239]/85 px-2.5 py-1 text-[11px] font-semibold text-white">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Đang nén lại...</span>
                      </div>
                    )}
                  </div>

                  {/* Live Size Comparison Strip */}
                  {optimized && (
                    <div className="grid grid-cols-3 divide-x divide-[#E3E7EE] border-t border-[#E3E7EE] bg-white text-center">
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#526071]">
                          Ảnh gốc
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[#0F1B2B]">
                          {formatBytes(optimized.originalBytes)}
                        </p>
                        <p className="font-mono text-[10px] tabular-nums text-[#526071]">
                          {optimized.originalWidth}×{optimized.originalHeight}
                        </p>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#526071]">
                          Sau tối ưu
                        </p>
                        <p className="mt-0.5 font-mono text-xs font-bold tabular-nums text-[#0066B2]">
                          {formatBytes(optimized.optimizedBytes)}
                        </p>
                        <p className="font-mono text-[10px] tabular-nums text-[#526071]">
                          {optimized.width}×{optimized.height}
                        </p>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#526071]">
                          Tiết kiệm
                        </p>
                        <p
                          className={`mt-0.5 font-mono text-xs font-extrabold tabular-nums ${
                            optimized.savingsPercent >= 0
                              ? 'text-[#16A34A]'
                              : 'text-[#D97706]'
                          }`}
                        >
                          {optimized.savingsPercent >= 0
                            ? `-${optimized.savingsPercent}%`
                            : `+${Math.abs(optimized.savingsPercent)}%`}
                        </p>
                        <p className="text-[10px] text-[#526071]">
                          Đã xóa EXIF/GPS
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optimization Controls */}
                <div className="space-y-4 rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0A2239]">
                    <Sliders className="h-3.5 w-3.5" />
                    <span>Tùy chọn thu nhỏ & chuyển định dạng tối ưu</span>
                  </div>

                  {/* Resize Preset */}
                  <div>
                    <label className="block text-[11px] font-semibold text-[#526071]">
                      Kích thước tối đa (chiều ngang)
                    </label>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {(
                        [
                          { id: 'hero', label: 'Hero 1920px' },
                          { id: 'card', label: 'Card 1200px' },
                          { id: 'thumbnail', label: 'Nhỏ 640px' },
                          { id: 'original', label: 'Giữ nguyên' },
                        ] as { id: ResizePreset; label: string }[]
                      ).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            setOptions((o) => ({
                              ...o,
                              resizePreset: preset.id,
                            }))
                          }
                          className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                            options.resizePreset === preset.id
                              ? 'border-[#0A2239] bg-[#0A2239] text-white'
                              : 'border-[#D4DBE5] bg-white text-[#526071] hover:text-[#0A2239]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aspect Ratio Crop */}
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#526071]">
                      <Crop className="h-3 w-3" />
                      <span>Cắt khung tỷ lệ chuẩn</span>
                    </label>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'original', label: 'Tự do' },
                          { id: '16:9', label: '16:9 Hero' },
                          { id: '4:3', label: '4:3 Card' },
                          { id: '1:1', label: '1:1 Vuông' },
                        ] as { id: AspectCropPreset; label: string }[]
                      ).map((crop) => (
                        <button
                          key={crop.id}
                          type="button"
                          onClick={() =>
                            setOptions((o) => ({ ...o, aspectCrop: crop.id }))
                          }
                          className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                            options.aspectCrop === crop.id
                              ? 'border-[#0A2239] bg-[#0A2239] text-white'
                              : 'border-[#D4DBE5] bg-white text-[#526071] hover:text-[#0A2239]'
                          }`}
                        >
                          {crop.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Format + Quality */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#526071]">
                        Định dạng đầu ra
                      </label>
                      <select
                        value={options.format}
                        onChange={(e) =>
                          setOptions((o) => ({
                            ...o,
                            format: e.target.value as ImageOutputFormat,
                          }))
                        }
                        className="mt-1.5 h-9 w-full rounded-lg border border-[#D4DBE5] bg-white px-2.5 text-xs font-semibold text-[#0F1B2B]"
                      >
                        <option value="image/webp">
                          WebP (Khuyên dùng · Nhẹ & nét)
                        </option>
                        <option value="image/jpeg">JPEG tối ưu</option>
                        <option value="image/png">PNG (Giữ nền trong suốt)</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#526071]">
                        <span>Chất lượng nén</span>
                        <span className="font-mono font-bold tabular-nums text-[#0A2239]">
                          {options.format === 'image/png'
                            ? 'Lossless'
                            : `${Math.round(options.quality * 100)}%`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={55}
                        max={95}
                        step={1}
                        disabled={options.format === 'image/png'}
                        value={Math.round(options.quality * 100)}
                        onChange={(e) =>
                          setOptions((o) => ({
                            ...o,
                            quality: Number(e.target.value) / 100,
                          }))
                        }
                        className="mt-2.5 w-full accent-[#0A2239] disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 6 cols: SEO Filename & Alt Text Form */}
              <div className="flex flex-col justify-between space-y-5 lg:col-span-6">
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-[#0A2239]">
                        Tên file ảnh chuẩn SEO *
                      </label>
                      <button
                        type="button"
                        onClick={handleApplySeoSuggestion}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0066B2] hover:underline"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Gợi ý lại tên SEO</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={seoFileName}
                      onChange={(e) => setSeoFileName(e.target.value)}
                      placeholder="meet-boston-beacon-hill-acorn-street.webp"
                      className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                    />
                    <p className="mt-1.5 text-[11px] text-[#526071]">
                      Tên lưu chuẩn hóa:{' '}
                      <code className="font-mono font-semibold text-[#0A2239]">
                        {finalSanitizedPreview}
                      </code>
                    </p>
                  </div>

                  <div className="space-y-3 rounded-xl border border-[#E3E7EE] bg-white p-4">
                    <p className="text-xs font-bold text-[#0A2239]">
                      Mô tả Alt Text song ngữ (SEO Google Images)
                    </p>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#526071]">
                        Alt Text (Tiếng Việt) *
                      </label>
                      <input
                        type="text"
                        value={altVi}
                        onChange={(e) => setAltVi(e.target.value)}
                        placeholder="VD: Phố lát đá cuội Acorn Street tại khu phố Beacon Hill Boston"
                        className="mt-1 h-9 w-full rounded-lg border border-[#D4DBE5] px-3 text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#526071]">
                        Alt Text (English) *
                      </label>
                      <input
                        type="text"
                        value={altEn}
                        onChange={(e) => setAltEn(e.target.value)}
                        placeholder="e.g. Historic cobblestone Acorn Street in Beacon Hill Boston"
                        className="mt-1 h-9 w-full rounded-lg border border-[#D4DBE5] px-3 text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#526071]">
                        Phân loại thư mục
                      </label>
                      <select
                        value={folder}
                        onChange={(e) =>
                          setFolder(e.target.value as MediaFolder)
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#D4DBE5] bg-white px-2.5 text-xs font-semibold text-[#0F1B2B]"
                      >
                        {(Object.keys(FOLDER_LABELS) as MediaFolder[]).map(
                          (f) => (
                            <option key={f} value={f}>
                              {FOLDER_LABELS[f]}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] p-3 text-[11px] leading-relaxed text-[#526071]">
                    <span className="font-semibold text-[#0A2239]">
                      Nguồn ảnh:{' '}
                    </span>
                    {stagedSource === 'google_drive'
                      ? 'Google Drive (đã tải bản sạch & tối ưu WebP độc lập)'
                      : 'Tải lên từ Máy tính'}{' '}
                    · Hệ thống tự động ưu tiên lưu lên{' '}
                    <span className="font-semibold text-[#0A2239]">
                      Firebase Storage CDN
                    </span>{' '}
                    (hoặc tự dự phòng WebP gọn nhẹ nếu Storage chưa bật).
                  </div>

                  {errorMsg && (
                    <p
                      role="alert"
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-[#C8102E]"
                    >
                      {errorMsg}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between gap-3 border-t border-[#E3E7EE] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStagedBlob(null);
                      setOptimized(null);
                      setErrorMsg('');
                    }}
                    className="inline-flex min-h-[40px] items-center rounded-lg border border-[#E3E7EE] px-4 text-xs font-semibold text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]"
                  >
                    Chọn ảnh khác
                  </button>
                  <button
                    type="button"
                    disabled={saving || optimizing || !optimized}
                    onClick={handleCommitUpload}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0A2239] px-5 text-xs font-semibold text-white hover:bg-[#133454] disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang lưu lên kho ảnh...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>
                          {selectMode
                            ? 'Lưu & Dùng ảnh này'
                            : 'Lưu vào Thư viện Media'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'upload' ? (
            /* ============================================================ */
            /* VIEW B: COMPUTER UPLOAD (DRAG & DROP / FILE PICKER / PASTE)  */
            /* ============================================================ */
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  handleFilePick(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
                  dragging
                    ? 'border-[#0A2239] bg-[#0A2239]/5'
                    : 'border-[#D4DBE5] bg-[#F7F8FA] hover:border-[#0A2239]/60'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#0A2239] shadow-sm ring-1 ring-[#E3E7EE]">
                  <HardDrive className="h-6 w-6" />
                </div>
                <p className="mt-4 font-display text-base font-bold text-[#0A2239]">
                  Kéo thả ảnh vào đây, dán từ Clipboard (Ctrl + V) hoặc bấm để chọn tệp
                </p>
                <p className="mt-1.5 text-xs text-[#526071]">
                  Hỗ trợ JPG, PNG, WebP, AVIF (tối đa 25 MB) · Tự động thu nhỏ & chuyển sang WebP siêu nhẹ
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0A2239] px-5 text-xs font-semibold text-white hover:bg-[#133454]"
                >
                  <Upload className="h-4 w-4" />
                  <span>Chọn ảnh từ máy tính</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleFilePick(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>

              {errorMsg && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-[#C8102E]"
                >
                  {errorMsg}
                </p>
              )}
            </div>
          ) : activeTab === 'drive' ? (
            /* ============================================================ */
            /* VIEW C: GOOGLE DRIVE PHOTO BROWSER & IMPORTER                */
            /* ============================================================ */
            <div className="space-y-4">
              {!driveToken ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#0A2239] shadow-sm ring-1 ring-[#E3E7EE]">
                    <Cloud className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-[#0A2239]">
                    Kết nối Google Drive để nhập ảnh trực tiếp
                  </h3>
                  <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#526071]">
                    Ứng dụng chỉ yêu cầu quyền <strong>chỉ đọc (Read-only)</strong> để duyệt và tải ảnh từ Google Drive về bộ tối ưu WebP của CMS — đảm bảo ảnh tải nhanh và không bao giờ lỗi liên kết.
                  </p>

                  {driveError && (
                    <p
                      role="alert"
                      className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-[#C8102E]"
                    >
                      {driveError}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={driveLoading}
                    onClick={handleConnectDrive}
                    className="mt-5 inline-flex min-h-[42px] items-center gap-2.5 rounded-lg border border-[#D4DBE5] bg-white px-5 py-2 text-xs font-semibold text-[#0F1B2B] shadow-sm transition-colors hover:bg-[#F7F8FA] disabled:opacity-60"
                  >
                    <svg
                      viewBox="0 0 48 48"
                      className="h-4.5 w-4.5 shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                    </svg>
                    <span>
                      {driveLoading
                        ? 'Đang kết nối Google Drive...'
                        : 'Sign in with Google Drive'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void fetchDriveImages(driveToken, driveSearch);
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]" />
                      <input
                        type="text"
                        value={driveSearch}
                        onChange={(e) => setDriveSearch(e.target.value)}
                        placeholder="Tìm ảnh trong Google Drive theo tên file..."
                        className="h-9 w-full rounded-lg border border-[#D4DBE5] bg-white pl-9 pr-3 text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={driveLoading}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0A2239] px-4 text-xs font-semibold text-white hover:bg-[#133454] disabled:opacity-60"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Tìm</span>
                    </button>
                    <button
                      type="button"
                      disabled={driveLoading}
                      onClick={() => void fetchDriveImages(driveToken, driveSearch)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 text-xs font-semibold text-[#526071] hover:text-[#0A2239]"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${driveLoading ? 'animate-spin' : ''}`}
                      />
                      <span>Làm mới</span>
                    </button>
                  </form>

                  {driveError && (
                    <p
                      role="alert"
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-[#C8102E]"
                    >
                      {driveError}
                    </p>
                  )}

                  {driveLoading ? (
                    <div className="flex items-center justify-center py-12 text-xs text-[#526071]">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Đang tải danh sách ảnh từ Google Drive...</span>
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-10 text-center text-xs text-[#526071]">
                      Không tìm thấy tệp hình ảnh nào trong Google Drive khớp với từ khóa.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {driveFiles.map((file) => {
                        const isImporting = driveImportingId === file.id;
                        return (
                          <div
                            key={file.id}
                            className="flex flex-col overflow-hidden rounded-xl border border-[#E3E7EE] bg-white"
                          >
                            <div className="relative aspect-[4/3] bg-[#F7F8FA]">
                              {file.thumbnailLink ? (
                                <img
                                  src={file.thumbnailLink}
                                  alt={file.name}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[#526071]">
                                  <ImageIcon className="h-6 w-6" />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-1 flex-col justify-between p-2.5">
                              <div>
                                <p
                                  title={file.name}
                                  className="truncate text-xs font-semibold text-[#0A2239]"
                                >
                                  {file.name}
                                </p>
                                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-[#526071]">
                                  {file.sizeBytes > 0
                                    ? formatBytes(file.sizeBytes)
                                    : file.mimeType.replace('image/', '').toUpperCase()}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={Boolean(driveImportingId)}
                                onClick={() => void handleImportDriveFile(file)}
                                className="mt-2.5 inline-flex min-h-[32px] w-full items-center justify-center gap-1.5 rounded-lg bg-[#0A2239] px-2.5 text-[11px] font-semibold text-white hover:bg-[#133454] disabled:opacity-60"
                              >
                                {isImporting ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span>Đang nhập...</span>
                                  </>
                                ) : (
                                  <span>Nhập & Tối ưu</span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ============================================================ */
            /* VIEW D: CENTRALIZED MEDIA LIBRARY PICKER                     */
            /* ============================================================ */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]" />
                  <input
                    type="text"
                    value={libSearch}
                    onChange={(e) => setLibSearch(e.target.value)}
                    placeholder="Tìm theo tên file SEO hoặc Alt Text..."
                    className="h-9 w-full rounded-lg border border-[#D4DBE5] bg-white pl-9 pr-3 text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                  />
                </div>

                <select
                  value={libFolder}
                  onChange={(e) =>
                    setLibFolder(e.target.value as 'all' | MediaFolder)
                  }
                  className="h-9 rounded-lg border border-[#D4DBE5] bg-white px-3 text-xs font-semibold text-[#0F1B2B]"
                >
                  <option value="all">Tất cả thư mục ({assets.length})</option>
                  {(Object.keys(FOLDER_LABELS) as MediaFolder[]).map((f) => (
                    <option key={f} value={f}>
                      {FOLDER_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>

              {filteredAssets.length === 0 ? (
                <div className="rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-10 text-center">
                  <p className="text-sm font-semibold text-[#0A2239]">
                    Chưa có ảnh nào trong Thư viện Media
                  </p>
                  <p className="mt-1 text-xs text-[#526071]">
                    Chuyển sang tab Tải từ Máy tính hoặc Google Drive để tối ưu và lưu ảnh đầu tiên.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAssets.map((asset) => {
                    const usageCount = getUsageRefs(asset.url).length;
                    const savedPct =
                      asset.originalBytes > 0
                        ? Math.round(
                            ((asset.originalBytes - asset.optimizedBytes) /
                              asset.originalBytes) *
                              100
                          )
                        : 0;
                    return (
                      <div
                        key={asset.id}
                        className="flex flex-col overflow-hidden rounded-xl border border-[#E3E7EE] bg-white"
                      >
                        <div className="relative aspect-[16/10] bg-[#F7F8FA]">
                          <img
                            src={asset.url}
                            alt={asset.altVi}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute left-2 top-2 rounded bg-[#0A2239]/85 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                            {asset.width}×{asset.height} ·{' '}
                            {formatBytes(asset.optimizedBytes)}
                          </span>
                          {savedPct > 0 && (
                            <span className="absolute right-2 top-2 rounded bg-[#16A34A] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                              -{savedPct}%
                            </span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col justify-between p-3">
                          <div>
                            <p
                              title={asset.seoFileName}
                              className="truncate font-mono text-xs font-bold text-[#0A2239]"
                            >
                              {asset.seoFileName}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-[#526071]">
                              {asset.altVi}
                            </p>
                            <p className="mt-1 text-[10px] font-medium text-[#526071]">
                              {FOLDER_LABELS[asset.folder]} ·{' '}
                              {asset.storageProvider === 'firebase_storage'
                                ? 'Storage CDN'
                                : 'Compact WebP'}
                              {usageCount > 0
                                ? ` · Đang dùng (${usageCount})`
                                : ''}
                            </p>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            {selectMode && onSelectAsset && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectAsset(asset);
                                  onClose();
                                }}
                                className="inline-flex min-h-[34px] flex-1 items-center justify-center rounded-lg bg-[#0A2239] px-3 text-xs font-semibold text-white hover:bg-[#133454]"
                              >
                                Chọn ảnh này
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(asset)}
                                aria-label="Xóa ảnh"
                                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#526071] hover:border-red-200 hover:bg-red-50 hover:text-[#C8102E]"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Safe Delete Confirmation Dialog with Usage Reference Warning */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0A2239]/60 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-[#E3E7EE] bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-[#C8102E]">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="font-display text-base font-bold">
                Xác nhận xóa hình ảnh
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#526071]">
              Bạn có chắc chắn muốn xóa vĩnh viễn tệp{' '}
              <code className="font-mono font-semibold text-[#0A2239]">
                {deleteTarget.seoFileName}
              </code>{' '}
              khỏi Thư viện Media? Hành động này không thể hoàn tác.
            </p>

            {deleteTargetUsage.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold">
                  Cảnh báo: Ảnh này đang được sử dụng tại {deleteTargetUsage.length} vị trí:
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px]">
                  {deleteTargetUsage.map((ref, idx) => (
                    <li key={idx}>
                      <strong>{ref.section}:</strong> {ref.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="inline-flex min-h-[38px] items-center rounded-lg border border-[#E3E7EE] px-4 text-xs font-semibold text-[#0F1B2B] hover:bg-[#F7F8FA]"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>Xóa vĩnh viễn</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

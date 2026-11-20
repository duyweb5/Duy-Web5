import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { formatBytes, sanitizeSeoFileNameInput } from '../lib/imageOptimizer';
import {
  MediaAssetRecord,
  MediaFolder,
  deleteMediaAsset,
  updateMediaAssetMeta,
} from '../lib/mediaService';
import { MediaUsageRef } from './MediaManagerModal';

const FOLDER_LABELS: Record<MediaFolder, string> = {
  hero: 'Hero Trang chủ',
  experiences: 'Trải nghiệm',
  neighborhoods: 'Khu phố',
  events: 'Sự kiện',
  hotels: 'Khách sạn',
  general: 'Chung',
};

interface MediaLibraryTabProps {
  assets: MediaAssetRecord[];
  canDelete: boolean;
  getUsageRefs: (url: string) => MediaUsageRef[];
  onOpenUploader: (initialTab: 'upload' | 'drive') => void;
  onNotice: (msg: string) => void;
}

export function MediaLibraryTab({
  assets,
  canDelete,
  getUsageRefs,
  onOpenUploader,
  onNotice,
}: MediaLibraryTabProps) {
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<'all' | MediaFolder>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit SEO / Alt modal state
  const [editingAsset, setEditingAsset] = useState<MediaAssetRecord | null>(
    null
  );
  const [editFileName, setEditFileName] = useState('');
  const [editAltVi, setEditAltVi] = useState('');
  const [editAltEn, setEditAltEn] = useState('');
  const [editFolder, setEditFolder] = useState<MediaFolder>('general');
  const [savingMeta, setSavingMeta] = useState(false);

  // Safe delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<MediaAssetRecord | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    let totalOrig = 0;
    let totalOpt = 0;
    for (const a of assets) {
      totalOrig += a.originalBytes || 0;
      totalOpt += a.optimizedBytes || 0;
    }
    const saved = Math.max(0, totalOrig - totalOpt);
    const savedPct =
      totalOrig > 0 ? Math.round((saved / totalOrig) * 100) : 0;
    return {
      count: assets.length,
      totalOpt,
      saved,
      savedPct,
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (folderFilter !== 'all' && a.folder !== folderFilter) return false;
      if (!q) return true;
      return (
        a.seoFileName.toLowerCase().includes(q) ||
        a.altVi.toLowerCase().includes(q) ||
        a.altEn.toLowerCase().includes(q)
      );
    });
  }, [assets, search, folderFilter]);

  const openEditMeta = (asset: MediaAssetRecord) => {
    setEditingAsset(asset);
    setEditFileName(asset.seoFileName);
    setEditAltVi(asset.altVi);
    setEditAltEn(asset.altEn);
    setEditFolder(asset.folder);
  };

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setSavingMeta(true);
    try {
      await updateMediaAssetMeta(editingAsset, {
        seoFileName: editFileName,
        altVi: editAltVi,
        altEn: editAltEn,
        folder: editFolder,
      });
      onNotice('Đã cập nhật tên SEO và mô tả Alt Text của ảnh.');
      setEditingAsset(null);
    } finally {
      setSavingMeta(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMediaAsset(deleteTarget);
      onNotice(`Đã xóa ảnh ${deleteTarget.seoFileName}.`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyUrl = (asset: MediaAssetRecord) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
      onNotice('Đã sao chép đường dẫn ảnh.');
      window.setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const deleteUsageRefs = useMemo(
    () => (deleteTarget ? getUsageRefs(deleteTarget.url) : []),
    [deleteTarget, getUsageRefs]
  );

  return (
    <div className="space-y-6">
      {/* Summary Stat Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-5">
          <p className="text-xs font-semibold text-[#526071]">
            Tổng số ảnh trong kho Media
          </p>
          <p className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-[#0A2239]">
            {stats.count}
          </p>
        </div>
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-5">
          <p className="text-xs font-semibold text-[#526071]">
            Tổng dung lượng sau nén WebP
          </p>
          <p className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-[#0066B2]">
            {formatBytes(stats.totalOpt)}
          </p>
        </div>
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-5">
          <p className="text-xs font-semibold text-[#526071]">
            Băng thông tiết kiệm được
          </p>
          <p className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-[#16A34A]">
            {formatBytes(stats.saved)}{' '}
            {stats.savedPct > 0 && (
              <span className="text-sm font-bold">(-{stats.savedPct}%)</span>
            )}
          </p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E3E7EE] bg-white p-4">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên file chuẩn SEO hoặc Alt Text..."
              className="h-9 w-full rounded-lg border border-[#D4DBE5] bg-white pl-9 pr-3 text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
            />
          </div>
          <select
            value={folderFilter}
            onChange={(e) =>
              setFolderFilter(e.target.value as 'all' | MediaFolder)
            }
            className="h-9 rounded-lg border border-[#D4DBE5] bg-white px-3 text-xs font-semibold text-[#0F1B2B]"
          >
            <option value="all">Tất cả thư mục</option>
            {(Object.keys(FOLDER_LABELS) as MediaFolder[]).map((f) => (
              <option key={f} value={f}>
                {FOLDER_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenUploader('upload')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0A2239] px-4 text-xs font-semibold text-white hover:bg-[#133454]"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Tải ảnh từ Máy tính</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenUploader('drive')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#0A2239]/25 bg-[#F7F8FA] px-4 text-xs font-semibold text-[#0A2239] hover:bg-white"
          >
            <Cloud className="h-3.5 w-3.5" />
            <span>Nhập từ Google Drive</span>
          </button>
        </div>
      </div>

      {/* Media Grid */}
      {filteredAssets.length === 0 ? (
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-12 text-center">
          <p className="font-display text-base font-bold text-[#0A2239]">
            Kho Thư viện Media đang trống
          </p>
          <p className="mt-1.5 text-sm text-[#526071]">
            Tải ảnh lên từ máy tính hoặc nhập trực tiếp từ Google Drive — hệ thống sẽ tự động thu nhỏ, nén WebP và gợi ý tên file chuẩn SEO.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenUploader('upload')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0A2239] px-4 text-xs font-semibold text-white hover:bg-[#133454]"
            >
              <Upload className="h-4 w-4" />
              <span>Tải ảnh đầu tiên</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenUploader('drive')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#E3E7EE] bg-white px-4 text-xs font-semibold text-[#0A2239] hover:bg-[#F7F8FA]"
            >
              <Cloud className="h-4 w-4" />
              <span>Kết nối Google Drive</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => {
            const refs = getUsageRefs(asset.url);
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
                  <span className="absolute left-2.5 top-2.5 rounded bg-[#0A2239]/85 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                    {asset.width}×{asset.height} ·{' '}
                    {formatBytes(asset.optimizedBytes)}
                  </span>
                  {savedPct > 0 && (
                    <span className="absolute right-2.5 top-2.5 rounded bg-[#16A34A] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      -{savedPct}%
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <p
                      title={asset.seoFileName}
                      className="truncate font-mono text-xs font-bold text-[#0A2239]"
                    >
                      {asset.seoFileName}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-[#526071]">
                      {asset.altVi}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-[#526071]">
                      <span>{FOLDER_LABELS[asset.folder]}</span>
                      <span>·</span>
                      <span>
                        {asset.source === 'google_drive'
                          ? 'Google Drive'
                          : 'Máy tính'}
                      </span>
                      <span>·</span>
                      <span className="text-[#0A2239]">
                        {asset.storageProvider === 'firebase_storage'
                          ? 'Storage CDN'
                          : 'Compact WebP'}
                      </span>
                    </div>
                    {refs.length > 0 && (
                      <p className="mt-1.5 text-[11px] font-semibold text-[#0066B2]">
                        Đang dùng tại {refs.length} vị trí:{' '}
                        {refs.map((r) => r.label).join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#E3E7EE] pt-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditMeta(asset)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#E3E7EE] px-2.5 text-[11px] font-semibold text-[#0A2239] hover:bg-[#F7F8FA]"
                      >
                        <Pencil className="h-3 w-3" />
                        <span>Sửa SEO</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(asset)}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#E3E7EE] px-2.5 text-[11px] font-semibold text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]"
                      >
                        {copiedId === asset.id ? (
                          <>
                            <Check className="h-3 w-3 text-[#16A34A]" />
                            <span>Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>URL</span>
                          </>
                        )}
                      </button>
                    </div>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(asset)}
                        aria-label="Xóa ảnh"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit SEO Metadata Modal */}
      {editingAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A2239]/55 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveMeta}
            className="w-full max-w-lg rounded-xl border border-[#E3E7EE] bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-3">
              <h3 className="font-display text-base font-bold text-[#0A2239]">
                Chỉnh sửa Tên SEO & Alt Text
              </h3>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-[#F7F8FA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#526071]">
                  Tên file chuẩn SEO *
                </label>
                <input
                  type="text"
                  required
                  value={editFileName}
                  onChange={(e) => setEditFileName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-xs text-[#0F1B2B]"
                />
                <p className="mt-1 text-[11px] text-[#526071]">
                  Tên chuẩn hóa:{' '}
                  <code className="font-mono font-semibold text-[#0A2239]">
                    {sanitizeSeoFileNameInput(
                      editFileName,
                      editingAsset.mimeType
                    )}
                  </code>
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#526071]">
                  Alt Text (Tiếng Việt) *
                </label>
                <input
                  type="text"
                  required
                  value={editAltVi}
                  onChange={(e) => setEditAltVi(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-[#D4DBE5] px-3 text-xs text-[#0F1B2B]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#526071]">
                  Alt Text (English) *
                </label>
                <input
                  type="text"
                  required
                  value={editAltEn}
                  onChange={(e) => setEditAltEn(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-[#D4DBE5] px-3 text-xs text-[#0F1B2B]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#526071]">
                  Thư mục
                </label>
                <select
                  value={editFolder}
                  onChange={(e) =>
                    setEditFolder(e.target.value as MediaFolder)
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-[#D4DBE5] bg-white px-2.5 text-xs font-semibold text-[#0F1B2B]"
                >
                  {(Object.keys(FOLDER_LABELS) as MediaFolder[]).map((f) => (
                    <option key={f} value={f}>
                      {FOLDER_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="inline-flex min-h-[38px] items-center rounded-lg border border-[#E3E7EE] px-4 text-xs font-semibold text-[#526071]"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingMeta}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#0A2239] px-5 text-xs font-semibold text-white hover:bg-[#133454] disabled:opacity-60"
              >
                {savingMeta ? 'Đang lưu...' : 'Lưu thông tin SEO'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Safe Delete Dialog with Usage Reference Check */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A2239]/55 p-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-[#E3E7EE] bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-[#C8102E]">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="font-display text-base font-bold">
                Xác nhận xóa ảnh khỏi Thư viện
              </h3>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#526071]">
              Xóa vĩnh viễn tệp{' '}
              <code className="font-mono font-semibold text-[#0A2239]">
                {deleteTarget.seoFileName}
              </code>
              ? Hành động này không thể hoàn tác.
            </p>

            {deleteUsageRefs.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-bold">
                  Cảnh báo: Ảnh này đang được sử dụng tại {deleteUsageRefs.length} vị trí:
                </p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px]">
                  {deleteUsageRefs.map((r, i) => (
                    <li key={i}>
                      <strong>{r.section}:</strong> {r.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="inline-flex min-h-[38px] items-center rounded-lg border border-[#E3E7EE] px-4 text-xs font-semibold text-[#0F1B2B]"
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

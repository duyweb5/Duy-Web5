import { useState } from 'react';
import { Cloud, Plus, Trash2, Upload, X } from 'lucide-react';
import { ExperienceCategory, IMAGES } from '../data/bostonData';
import {
  CmsEvent,
  CmsExperience,
  CmsHotel,
  CmsNeighborhood,
  PRESET_GALLERY_IMAGES,
} from '../lib/cmsService';
import { MediaFolder } from '../lib/mediaService';
import { ResilientImage } from './ResilientImage';

export interface MediaPickerRequest {
  folder: MediaFolder;
  contextTitle: string;
  contextHint: string;
  initialTab?: 'upload' | 'drive' | 'library';
  onSelected: (url: string) => void;
}

function ImagePickerField({
  value,
  onChange,
  onOpenMediaPicker,
  folder,
  contextTitle,
  contextHint,
}: {
  value: string;
  onChange: (val: string) => void;
  onOpenMediaPicker?: (req: MediaPickerRequest) => void;
  folder: MediaFolder;
  contextTitle: string;
  contextHint: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-[#0F1B2B]">
          Ảnh đại diện (Tải lên, Google Drive, Thư viện hoặc URL)
        </label>
        {onOpenMediaPicker && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                onOpenMediaPicker({
                  folder,
                  contextTitle,
                  contextHint,
                  initialTab: 'upload',
                  onSelected: onChange,
                })
              }
              className="inline-flex min-h-[30px] items-center gap-1.5 rounded-md bg-[#0A2239] px-2.5 text-[11px] font-semibold text-white hover:bg-[#133454]"
            >
              <Upload className="h-3 w-3" />
              <span>Tải ảnh / Tối ưu WebP</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenMediaPicker({
                  folder,
                  contextTitle,
                  contextHint,
                  initialTab: 'drive',
                  onSelected: onChange,
                })
              }
              className="inline-flex min-h-[30px] items-center gap-1.5 rounded-md border border-[#0A2239]/25 bg-[#F7F8FA] px-2.5 text-[11px] font-semibold text-[#0A2239] hover:bg-white"
            >
              <Cloud className="h-3 w-3" />
              <span>Google Drive / Thư viện</span>
            </button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-[#E3E7EE] bg-[#0A2239]">
          <ResilientImage
            src={value}
            alt="Preview"
            fallbackTitle="Preview"
            className="h-full w-full object-cover"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/src/assets/images/... hoặc https://..."
          className="h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_GALLERY_IMAGES.map((img) => (
          <button
            key={img.url}
            type="button"
            onClick={() => onChange(img.url)}
            className={`min-h-[32px] rounded-md border px-2.5 text-xs font-medium transition-colors ${
              value === img.url
                ? 'border-[#0A2239] bg-[#0A2239] text-white'
                : 'border-[#E3E7EE] bg-[#F7F8FA] text-[#526071] hover:border-[#0A2239]'
            }`}
          >
            {img.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 1. Experience Editor Modal
// -----------------------------------------------------------------------------
export function ExperienceEditorModal({
  initial,
  nextOrder,
  saving,
  onClose,
  onSave,
  onOpenMediaPicker,
}: {
  initial: CmsExperience | null;
  nextOrder: number;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: Omit<CmsExperience, 'id'>) => Promise<void>;
  onOpenMediaPicker?: (req: MediaPickerRequest) => void;
}) {
  const [titleVi, setTitleVi] = useState(initial?.title.vi || '');
  const [titleEn, setTitleEn] = useState(initial?.title.en || '');
  const [category, setCategory] = useState<ExperienceCategory>(
    initial?.category || 'history'
  );
  const [district, setDistrict] = useState(initial?.district || 'Downtown');
  const [featured, setFeatured] = useState(Boolean(initial?.featured));
  const [published, setPublished] = useState(initial ? initial.published : true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? nextOrder);
  const [summaryVi, setSummaryVi] = useState(initial?.summary.vi || '');
  const [summaryEn, setSummaryEn] = useState(initial?.summary.en || '');
  const [descriptionVi, setDescriptionVi] = useState(initial?.description.vi || '');
  const [descriptionEn, setDescriptionEn] = useState(initial?.description.en || '');
  const [insiderTipVi, setInsiderTipVi] = useState(initial?.insiderTip.vi || '');
  const [insiderTipEn, setInsiderTipEn] = useState(initial?.insiderTip.en || '');
  const [durationVi, setDurationVi] = useState(initial?.duration.vi || '2 giờ');
  const [durationEn, setDurationEn] = useState(initial?.duration.en || '2 hours');
  const [hours, setHours] = useState(initial?.hours || '09:00 – 17:00');
  const [priceVi, setPriceVi] = useState(initial?.price.vi || 'Miễn phí');
  const [priceEn, setPriceEn] = useState(initial?.price.en || 'Free');
  const [address, setAddress] = useState(initial?.address || 'Boston, MA');
  const [transit, setTransit] = useState(
    initial?.transit || 'MBTA Green Line · Park Street'
  );
  const [image, setImage] = useState(initial?.image || IMAGES.freedomTrail);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (titleVi.trim().length < 2 || titleEn.trim().length < 2) {
      setError('Vui lòng nhập đầy đủ tiêu đề Tiếng Việt và Tiếng Anh (tối thiểu 2 ký tự).');
      return;
    }
    setError('');
    await onSave({
      category,
      featured,
      published,
      sortOrder: Number(sortOrder) || 0,
      title: { vi: titleVi, en: titleEn },
      summary: { vi: summaryVi || titleVi, en: summaryEn || titleEn },
      description: {
        vi: descriptionVi || summaryVi || titleVi,
        en: descriptionEn || summaryEn || titleEn,
      },
      insiderTip: { vi: insiderTipVi, en: insiderTipEn },
      district,
      duration: { vi: durationVi, en: durationEn },
      hours,
      price: { vi: priceVi, en: priceEn },
      address,
      transit,
      image,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/65 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-4">
          <h3 className="font-display text-lg font-extrabold text-[#0A2239]">
            {initial ? 'Chỉnh sửa Trải nghiệm' : 'Thêm Trải nghiệm mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#0F1B2B] hover:bg-[#F7F8FA]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tiêu đề (Tiếng Việt) *
              </label>
              <input
                type="text"
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                maxLength={180}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Title (English) *
              </label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                maxLength={180}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Danh mục
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as ExperienceCategory)
                }
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] bg-white px-3 text-sm focus:border-[#0A2239] focus:outline-none"
              >
                <option value="history">Lịch sử (History)</option>
                <option value="dining">Ẩm thực (Dining)</option>
                <option value="arts">Nghệ thuật (Arts)</option>
                <option value="outdoors">Ngoài trời (Outdoors)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Khu vực
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                maxLength={100}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Thứ tự hiển thị
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm tabular-nums focus:border-[#0A2239] focus:outline-none"
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#0F1B2B]">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="h-4 w-4 accent-[#0A2239]"
                />
                <span>Xuất bản công khai</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-[#0F1B2B]">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="h-4 w-4 accent-[#C8102E]"
                />
                <span>Thẻ nổi bật (Lead)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tóm tắt ngắn (VI)
              </label>
              <textarea
                rows={2}
                value={summaryVi}
                onChange={(e) => setSummaryVi(e.target.value)}
                maxLength={420}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Short Summary (EN)
              </label>
              <textarea
                rows={2}
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
                maxLength={420}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Mô tả chi tiết (VI)
              </label>
              <textarea
                rows={3}
                value={descriptionVi}
                onChange={(e) => setDescriptionVi(e.target.value)}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Full Description (EN)
              </label>
              <textarea
                rows={3}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Mẹo bản địa (VI)
              </label>
              <input
                type="text"
                value={insiderTipVi}
                onChange={(e) => setInsiderTipVi(e.target.value)}
                maxLength={500}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Insider Tip (EN)
              </label>
              <input
                type="text"
                value={insiderTipEn}
                onChange={(e) => setInsiderTipEn(e.target.value)}
                maxLength={500}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm focus:border-[#0A2239] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Thời lượng (VI / EN)
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={durationVi}
                  onChange={(e) => setDurationVi(e.target.value)}
                  placeholder="2 giờ"
                  className="h-10 rounded-lg border border-[#D4DBE5] px-2.5 text-sm"
                />
                <input
                  type="text"
                  value={durationEn}
                  onChange={(e) => setDurationEn(e.target.value)}
                  placeholder="2 hours"
                  className="h-10 rounded-lg border border-[#D4DBE5] px-2.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Giờ mở cửa
              </label>
              <input
                type="text"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Giá tham khảo (VI / EN)
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={priceVi}
                  onChange={(e) => setPriceVi(e.target.value)}
                  className="h-10 rounded-lg border border-[#D4DBE5] px-2.5 text-sm"
                />
                <input
                  type="text"
                  value={priceEn}
                  onChange={(e) => setPriceEn(e.target.value)}
                  className="h-10 rounded-lg border border-[#D4DBE5] px-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Địa chỉ
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tuyến tàu MBTA
              </label>
              <input
                type="text"
                value={transit}
                onChange={(e) => setTransit(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
          </div>

          <ImagePickerField
            value={image}
            onChange={setImage}
            onOpenMediaPicker={onOpenMediaPicker}
            folder="experiences"
            contextTitle={titleVi || titleEn}
            contextHint={district}
          />

          {error && (
            <p role="alert" className="text-xs font-semibold text-[#C8102E]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[#E3E7EE] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-[#E3E7EE] px-4 text-sm font-semibold text-[#0F1B2B] hover:bg-[#F7F8FA]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu Trải nghiệm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 2. Neighborhood Editor Modal
// -----------------------------------------------------------------------------
export function NeighborhoodEditorModal({
  initial,
  nextOrder,
  saving,
  onClose,
  onSave,
  onOpenMediaPicker,
}: {
  initial: CmsNeighborhood | null;
  nextOrder: number;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: Omit<CmsNeighborhood, 'id'>) => Promise<void>;
  onOpenMediaPicker?: (req: MediaPickerRequest) => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [published, setPublished] = useState(initial ? initial.published : true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? nextOrder);
  const [walkScore, setWalkScore] = useState(initial?.walkScore ?? 95);
  const [transit, setTransit] = useState(initial?.transit || 'MBTA Green Line');
  const [vibeVi, setVibeVi] = useState(initial?.vibe.vi || 'Kiến trúc · Bản địa');
  const [vibeEn, setVibeEn] = useState(initial?.vibe.en || 'Architecture · Local');
  const [taglineVi, setTaglineVi] = useState(initial?.tagline.vi || '');
  const [taglineEn, setTaglineEn] = useState(initial?.tagline.en || '');
  const [descriptionVi, setDescriptionVi] = useState(initial?.description.vi || '');
  const [descriptionEn, setDescriptionEn] = useState(initial?.description.en || '');
  const [image, setImage] = useState(initial?.image || IMAGES.beaconHill);
  const [topPicks, setTopPicks] = useState(
    initial?.topPicks.length
      ? initial.topPicks
      : [
          {
            name: '',
            category: { vi: 'Điểm dừng', en: 'Highlight' },
            note: { vi: '', en: '' },
          },
        ]
  );
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Vui lòng nhập tên khu phố (tối thiểu 2 ký tự).');
      return;
    }
    setError('');
    await onSave({
      name,
      published,
      sortOrder: Number(sortOrder) || 0,
      walkScore: Math.max(0, Math.min(100, Number(walkScore) || 90)),
      transit,
      vibe: { vi: vibeVi, en: vibeEn },
      tagline: { vi: taglineVi || name, en: taglineEn || name },
      description: {
        vi: descriptionVi || taglineVi || name,
        en: descriptionEn || taglineEn || name,
      },
      image,
      topPicks: topPicks.filter((p) => p.name.trim().length > 0),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/65 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-4">
          <h3 className="font-display text-lg font-extrabold text-[#0A2239]">
            {initial ? 'Chỉnh sửa Khu phố' : 'Thêm Khu phố mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#0F1B2B]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tên khu phố *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Walk Score (0-100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={walkScore}
                onChange={(e) => setWalkScore(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Thứ tự
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tuyến tàu MBTA
              </label>
              <input
                type="text"
                value={transit}
                onChange={(e) => setTransit(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Phong cách (VI)
              </label>
              <input
                type="text"
                value={vibeVi}
                onChange={(e) => setVibeVi(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Vibe (EN)
              </label>
              <input
                type="text"
                value={vibeEn}
                onChange={(e) => setVibeEn(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Khẩu hiệu khu phố (VI)
              </label>
              <input
                type="text"
                value={taglineVi}
                onChange={(e) => setTaglineVi(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tagline (EN)
              </label>
              <input
                type="text"
                value={taglineEn}
                onChange={(e) => setTaglineEn(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Mô tả (VI)
              </label>
              <textarea
                rows={3}
                value={descriptionVi}
                onChange={(e) => setDescriptionVi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Description (EN)
              </label>
              <textarea
                rows={3}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
              />
            </div>
          </div>

          {/* Top Picks (1-5 items) */}
          <div className="space-y-3 rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0A2239]">
                Điểm dừng nổi bật (tối đa 5)
              </span>
              {topPicks.length < 5 && (
                <button
                  type="button"
                  onClick={() =>
                    setTopPicks((prev) => [
                      ...prev,
                      {
                        name: '',
                        category: { vi: 'Điểm dừng', en: 'Stop' },
                        note: { vi: '', en: '' },
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-[#E3E7EE] bg-white px-2.5 py-1 text-xs font-semibold text-[#0A2239]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm điểm dừng</span>
                </button>
              )}
            </div>

            {topPicks.map((pick, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-2 rounded-lg border border-[#E3E7EE] bg-white p-3 sm:grid-cols-12"
              >
                <input
                  type="text"
                  value={pick.name}
                  placeholder="Tên địa điểm"
                  onChange={(e) =>
                    setTopPicks((prev) =>
                      prev.map((p, i) =>
                        i === idx ? { ...p, name: e.target.value } : p
                      )
                    )
                  }
                  className="h-9 rounded-md border border-[#D4DBE5] px-2.5 text-xs sm:col-span-4"
                />
                <input
                  type="text"
                  value={pick.note.vi}
                  placeholder="Ghi chú (VI)"
                  onChange={(e) =>
                    setTopPicks((prev) =>
                      prev.map((p, i) =>
                        i === idx
                          ? { ...p, note: { ...p.note, vi: e.target.value } }
                          : p
                      )
                    )
                  }
                  className="h-9 rounded-md border border-[#D4DBE5] px-2.5 text-xs sm:col-span-4"
                />
                <input
                  type="text"
                  value={pick.note.en}
                  placeholder="Note (EN)"
                  onChange={(e) =>
                    setTopPicks((prev) =>
                      prev.map((p, i) =>
                        i === idx
                          ? { ...p, note: { ...p.note, en: e.target.value } }
                          : p
                      )
                    )
                  }
                  className="h-9 rounded-md border border-[#D4DBE5] px-2.5 text-xs sm:col-span-3"
                />
                <button
                  type="button"
                  disabled={topPicks.length <= 1}
                  onClick={() =>
                    setTopPicks((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label="Xóa điểm dừng"
                  className="inline-flex h-9 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E] disabled:opacity-30 sm:col-span-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <ImagePickerField
            value={image}
            onChange={setImage}
            onOpenMediaPicker={onOpenMediaPicker}
            folder="neighborhoods"
            contextTitle={name}
            contextHint="boston-neighborhood"
          />

          <label className="flex items-center gap-2 text-xs font-semibold text-[#0F1B2B]">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 accent-[#0A2239]"
            />
            <span>Hiển thị công khai trên trang chủ</span>
          </label>

          {error && (
            <p role="alert" className="text-xs font-semibold text-[#C8102E]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[#E3E7EE] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-[#E3E7EE] px-4 text-sm font-semibold text-[#0F1B2B]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu Khu phố'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 3. Event Editor Modal
// -----------------------------------------------------------------------------
export function EventEditorModal({
  initial,
  nextOrder,
  saving,
  onClose,
  onSave,
  onOpenMediaPicker,
}: {
  initial: CmsEvent | null;
  nextOrder: number;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: Omit<CmsEvent, 'id'>) => Promise<void>;
  onOpenMediaPicker?: (req: MediaPickerRequest) => void;
}) {
  const [titleVi, setTitleVi] = useState(initial?.title.vi || '');
  const [titleEn, setTitleEn] = useState(initial?.title.en || '');
  const [dayNum, setDayNum] = useState(initial?.dayNum || '28');
  const [monthLabelVi, setMonthLabelVi] = useState(
    initial?.monthLabel.vi || 'THG 11'
  );
  const [monthLabelEn, setMonthLabelEn] = useState(
    initial?.monthLabel.en || 'NOV'
  );
  const [fullDateVi, setFullDateVi] = useState(
    initial?.fullDate.vi || '28 Tháng 11, 2026'
  );
  const [fullDateEn, setFullDateEn] = useState(
    initial?.fullDate.en || 'November 28, 2026'
  );
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'holiday'>(
    initial?.timeframe || 'month'
  );
  const [category, setCategory] = useState<
    'arts' | 'sports' | 'festival' | 'exhibition'
  >(initial?.category || 'festival');
  const [venue, setVenue] = useState(initial?.venue || 'Boston Common');
  const [district, setDistrict] = useState(initial?.district || 'Downtown');
  const [time, setTime] = useState(initial?.time || '18:00 – 21:00');
  const [priceVi, setPriceVi] = useState(initial?.price.vi || 'Miễn phí');
  const [priceEn, setPriceEn] = useState(initial?.price.en || 'Free');
  const [descriptionVi, setDescriptionVi] = useState(
    initial?.description.vi || ''
  );
  const [descriptionEn, setDescriptionEn] = useState(
    initial?.description.en || ''
  );
  const [image, setImage] = useState(initial?.image || IMAGES.seaport);
  const [published, setPublished] = useState(initial ? initial.published : true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? nextOrder);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (titleVi.trim().length < 2 || titleEn.trim().length < 2) {
      setError('Vui lòng nhập tên sự kiện song ngữ (tối thiểu 2 ký tự).');
      return;
    }
    setError('');
    await onSave({
      dayNum,
      monthLabel: { vi: monthLabelVi, en: monthLabelEn },
      fullDate: { vi: fullDateVi, en: fullDateEn },
      timeframe,
      category,
      published,
      sortOrder: Number(sortOrder) || 0,
      title: { vi: titleVi, en: titleEn },
      venue,
      district,
      time,
      price: { vi: priceVi, en: priceEn },
      description: {
        vi: descriptionVi || titleVi,
        en: descriptionEn || titleEn,
      },
      image,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/65 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-4">
          <h3 className="font-display text-lg font-extrabold text-[#0A2239]">
            {initial ? 'Chỉnh sửa Sự kiện' : 'Thêm Sự kiện mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E7EE]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tên sự kiện (VI) *
              </label>
              <input
                type="text"
                value={titleVi}
                onChange={(e) => setTitleVi(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Event Title (EN) *
              </label>
              <input
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Ngày (số)
              </label>
              <input
                type="text"
                value={dayNum}
                maxLength={4}
                onChange={(e) => setDayNum(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tháng (VI)
              </label>
              <input
                type="text"
                value={monthLabelVi}
                onChange={(e) => setMonthLabelVi(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Month (EN)
              </label>
              <input
                type="text"
                value={monthLabelEn}
                onChange={(e) => setMonthLabelEn(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Khung thời gian
              </label>
              <select
                value={timeframe}
                onChange={(e) =>
                  setTimeframe(e.target.value as 'week' | 'month' | 'holiday')
                }
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] bg-white px-2.5 text-sm"
              >
                <option value="week">Tuần này</option>
                <option value="month">Tháng tới</option>
                <option value="holiday">Mùa lễ hội</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Thể loại
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as
                      | 'arts'
                      | 'sports'
                      | 'festival'
                      | 'exhibition'
                  )
                }
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] bg-white px-2.5 text-sm"
              >
                <option value="festival">Lễ hội</option>
                <option value="sports">Thể thao</option>
                <option value="arts">Nghệ thuật</option>
                <option value="exhibition">Triển lãm</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Ngày đầy đủ (VI)
              </label>
              <input
                type="text"
                value={fullDateVi}
                onChange={(e) => setFullDateVi(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Full Date (EN)
              </label>
              <input
                type="text"
                value={fullDateEn}
                onChange={(e) => setFullDateEn(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Địa điểm tổ chức
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Khu vực
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Khung giờ
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Giá vé (VI)
              </label>
              <input
                type="text"
                value={priceVi}
                onChange={(e) => setPriceVi(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Ticket Price (EN)
              </label>
              <input
                type="text"
                value={priceEn}
                onChange={(e) => setPriceEn(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Thứ tự
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Mô tả (VI)
              </label>
              <textarea
                rows={3}
                value={descriptionVi}
                onChange={(e) => setDescriptionVi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Description (EN)
              </label>
              <textarea
                rows={3}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
              />
            </div>
          </div>

          <ImagePickerField
            value={image}
            onChange={setImage}
            onOpenMediaPicker={onOpenMediaPicker}
            folder="events"
            contextTitle={titleVi || titleEn}
            contextHint={district}
          />

          <label className="flex items-center gap-2 text-xs font-semibold text-[#0F1B2B]">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 accent-[#0A2239]"
            />
            <span>Xuất bản công khai</span>
          </label>

          {error && (
            <p role="alert" className="text-xs font-semibold text-[#C8102E]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[#E3E7EE] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-[#E3E7EE] px-4 text-sm font-semibold text-[#0F1B2B]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu Sự kiện'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 4. Hotel Editor Modal
// -----------------------------------------------------------------------------
export function HotelEditorModal({
  initial,
  nextOrder,
  saving,
  onClose,
  onSave,
  onOpenMediaPicker,
}: {
  initial: CmsHotel | null;
  nextOrder: number;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: Omit<CmsHotel, 'id'>) => Promise<void>;
  onOpenMediaPicker?: (req: MediaPickerRequest) => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [district, setDistrict] = useState(initial?.district || 'Back Bay');
  const [neighborhoodKey, setNeighborhoodKey] = useState<
    'back-bay' | 'seaport' | 'beacon-hill'
  >(initial?.neighborhoodKey || 'back-bay');
  const [styleVi, setStyleVi] = useState(initial?.style.vi || 'Boutique');
  const [styleEn, setStyleEn] = useState(initial?.style.en || 'Boutique');
  const [rateUsd, setRateUsd] = useState(initial?.rateUsd ?? 360);
  const [rating, setRating] = useState(initial?.rating || '4.8');
  const [summaryVi, setSummaryVi] = useState(initial?.summary.vi || '');
  const [summaryEn, setSummaryEn] = useState(initial?.summary.en || '');
  const [descriptionVi, setDescriptionVi] = useState(
    initial?.description.vi || ''
  );
  const [descriptionEn, setDescriptionEn] = useState(
    initial?.description.en || ''
  );
  const [address, setAddress] = useState(initial?.address || 'Boston, MA');
  const [amenitiesViText, setAmenitiesViText] = useState(
    (initial?.amenities.vi || ['Wi-Fi miễn phí', 'Vị trí trung tâm']).join(', ')
  );
  const [amenitiesEnText, setAmenitiesEnText] = useState(
    (initial?.amenities.en || ['Complimentary Wi-Fi', 'Central Location']).join(
      ', '
    )
  );
  const [image, setImage] = useState(initial?.image || IMAGES.luxuryHotel);
  const [published, setPublished] = useState(initial ? initial.published : true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? nextOrder);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Vui lòng nhập tên khách sạn (tối thiểu 2 ký tự).');
      return;
    }
    setError('');
    const amenitiesVi = amenitiesViText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const amenitiesEn = amenitiesEnText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await onSave({
      name,
      district,
      neighborhoodKey,
      published,
      sortOrder: Number(sortOrder) || 0,
      style: { vi: styleVi, en: styleEn },
      rateUsd: Math.max(10, Math.min(25000, Number(rateUsd) || 350)),
      rating,
      summary: { vi: summaryVi || name, en: summaryEn || name },
      description: {
        vi: descriptionVi || summaryVi || name,
        en: descriptionEn || summaryEn || name,
      },
      address,
      amenities: { vi: amenitiesVi, en: amenitiesEn },
      image,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/65 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E3E7EE] pb-4">
          <h3 className="font-display text-lg font-extrabold text-[#0A2239]">
            {initial ? 'Chỉnh sửa Khách sạn' : 'Thêm Khách sạn mới'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3E7EE]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tên khách sạn *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Nhóm khu vực lọc
              </label>
              <select
                value={neighborhoodKey}
                onChange={(e) =>
                  setNeighborhoodKey(
                    e.target.value as 'back-bay' | 'seaport' | 'beacon-hill'
                  )
                }
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] bg-white px-3 text-sm"
              >
                <option value="back-bay">Back Bay</option>
                <option value="seaport">Seaport & Waterfront</option>
                <option value="beacon-hill">Beacon Hill</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tên khu hiển thị
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Giá / đêm (USD)
              </label>
              <input
                type="number"
                min={10}
                max={25000}
                value={rateUsd}
                onChange={(e) => setRateUsd(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Đánh giá (sao)
              </label>
              <input
                type="text"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Thứ tự
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Phong cách (VI)
              </label>
              <input
                type="text"
                value={styleVi}
                onChange={(e) => setStyleVi(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Style (EN)
              </label>
              <input
                type="text"
                value={styleEn}
                onChange={(e) => setStyleEn(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Địa chỉ
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tóm tắt (VI)
              </label>
              <textarea
                rows={2}
                value={summaryVi}
                onChange={(e) => setSummaryVi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Summary (EN)
              </label>
              <textarea
                rows={2}
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Mô tả chi tiết (VI)
              </label>
              <textarea
                rows={2}
                value={descriptionVi}
                onChange={(e) => setDescriptionVi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Description (EN)
              </label>
              <textarea
                rows={2}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Tiện nghi (VI, phân cách dấu phẩy)
              </label>
              <input
                type="text"
                value={amenitiesViText}
                onChange={(e) => setAmenitiesViText(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F1B2B]">
                Amenities (EN, comma separated)
              </label>
              <input
                type="text"
                value={amenitiesEnText}
                onChange={(e) => setAmenitiesEnText(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
              />
            </div>
          </div>

          <ImagePickerField
            value={image}
            onChange={setImage}
            onOpenMediaPicker={onOpenMediaPicker}
            folder="hotels"
            contextTitle={name}
            contextHint={district}
          />

          <label className="flex items-center gap-2 text-xs font-semibold text-[#0F1B2B]">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 accent-[#0A2239]"
            />
            <span>Xuất bản công khai</span>
          </label>

          {error && (
            <p role="alert" className="text-xs font-semibold text-[#C8102E]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[#E3E7EE] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-[#E3E7EE] px-4 text-sm font-semibold text-[#0F1B2B]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu Khách sạn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

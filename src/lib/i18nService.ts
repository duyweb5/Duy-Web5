import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { COPY, Language } from '../data/bostonData';
import {
  CmsEvent,
  CmsExperience,
  CmsHotel,
  CmsNeighborhood,
  SiteConfigData,
} from './cmsService';
import { OperationType, db, handleFirestoreError } from './firebase';
import { MediaAssetRecord } from './mediaService';
import { VideoItemRecord } from './videoService';

export type UiTranslationGroup =
  | 'nav'
  | 'hero'
  | 'explore'
  | 'neighborhoods'
  | 'events'
  | 'stay'
  | 'videos'
  | 'drawer'
  | 'modal'
  | 'meetingsModal'
  | 'footer';

export const ALL_UI_TRANSLATION_GROUPS: UiTranslationGroup[] = [
  'nav',
  'hero',
  'explore',
  'neighborhoods',
  'events',
  'stay',
  'videos',
  'drawer',
  'modal',
  'meetingsModal',
  'footer',
];

export interface I18nConfigData {
  defaultLanguage: Language;
  enableVi: boolean;
  enableEn: boolean;
  showLanguageSwitcher: boolean;
  autoDetectBrowser: boolean;
  viLabel: string;
  enLabel: string;
  updatedBy?: string;
  updatedAt?: Timestamp | null;
}

export const DEFAULT_I18N_CONFIG: I18nConfigData = {
  defaultLanguage: 'vi',
  enableVi: true,
  enableEn: true,
  showLanguageSwitcher: true,
  autoDetectBrowser: false,
  viLabel: 'Tiếng Việt',
  enLabel: 'English',
};

export interface UiTranslationRecord {
  id: string;
  group: UiTranslationGroup;
  keyPath: string;
  valueVi: string;
  valueEn: string;
  updatedBy?: string;
  updatedAt?: Timestamp | null;
}

export interface UiTranslationCatalogItem {
  id: string;
  group: UiTranslationGroup;
  keyPath: string;
  labelVi: string;
  labelEn: string;
  multiline?: boolean;
  defaultVi: string;
  defaultEn: string;
}

export interface UiGroupMeta {
  id: UiTranslationGroup;
  labelVi: string;
  labelEn: string;
}

export const UI_TRANSLATION_GROUPS: UiGroupMeta[] = [
  { id: 'nav', labelVi: 'Thanh điều hướng', labelEn: 'Navigation Bar' },
  { id: 'hero', labelVi: 'Tìm kiếm Hero', labelEn: 'Hero Search' },
  { id: 'explore', labelVi: 'Khối Trải nghiệm', labelEn: 'Experiences Section' },
  {
    id: 'neighborhoods',
    labelVi: 'Khối Khu phố',
    labelEn: 'Neighborhoods Section',
  },
  { id: 'events', labelVi: 'Khối Sự kiện', labelEn: 'Events Section' },
  {
    id: 'stay',
    labelVi: 'Khách sạn & Cẩm nang',
    labelEn: 'Hotels, Guide & MICE',
  },
  {
    id: 'videos',
    labelVi: 'Thư viện Video',
    labelEn: 'Video Library',
  },
  { id: 'drawer', labelVi: 'Ngăn Lịch trình', labelEn: 'Itinerary Drawer' },
  { id: 'modal', labelVi: 'Cửa sổ Chi tiết', labelEn: 'Detail Modal' },
  {
    id: 'meetingsModal',
    labelVi: 'Biểu mẫu Hội nghị RFP',
    labelEn: 'Meetings RFP Modal',
  },
  { id: 'footer', labelVi: 'Chân trang & Bản tin', labelEn: 'Footer & Dispatch' },
];

export function keyPathToDocId(keyPath: string): string {
  return keyPath.replace(/\./g, '__').replace(/[^a-zA-Z0-9_-]/g, '');
}

function getNestedString(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let curr: unknown = obj;
  for (const part of parts) {
    if (curr && typeof curr === 'object' && part in curr) {
      curr = (curr as Record<string, unknown>)[part];
    } else {
      return '';
    }
  }
  return typeof curr === 'string' ? curr : '';
}

function setNestedString(
  obj: Record<string, unknown>,
  path: string,
  value: string
): void {
  const parts = path.split('.');
  let curr: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (curr[key] && typeof curr[key] === 'object') {
      curr = curr[key] as Record<string, unknown>;
    } else {
      return;
    }
  }
  const leaf = parts[parts.length - 1];
  if (leaf in curr && typeof curr[leaf] === 'string') {
    curr[leaf] = value;
  }
}

interface CatalogSeedDef {
  group: UiTranslationGroup;
  keyPath: string;
  labelVi: string;
  labelEn: string;
  multiline?: boolean;
}

const CATALOG_DEFS: CatalogSeedDef[] = [
  // Navigation
  { group: 'nav', keyPath: 'nav.explore', labelVi: 'Menu: Trải nghiệm', labelEn: 'Menu: Things to Do' },
  { group: 'nav', keyPath: 'nav.neighborhoods', labelVi: 'Menu: Khu phố', labelEn: 'Menu: Neighborhoods' },
  { group: 'nav', keyPath: 'nav.events', labelVi: 'Menu: Sự kiện', labelEn: 'Menu: Events' },
  { group: 'nav', keyPath: 'nav.stay', labelVi: 'Menu: Lưu trú', labelEn: 'Menu: Places to Stay' },
  { group: 'nav', keyPath: 'nav.videos', labelVi: 'Menu: Thư viện Video', labelEn: 'Menu: Videos' },
  { group: 'nav', keyPath: 'nav.meetings', labelVi: 'Menu: Hội nghị', labelEn: 'Menu: Meetings' },
  { group: 'nav', keyPath: 'nav.myTrip', labelVi: 'Nút chính: Lịch trình', labelEn: 'Primary CTA: My Itinerary' },
  { group: 'videos', keyPath: 'videos.kicker', labelVi: 'Nhãn dẫn Thư viện Video', labelEn: 'Video Library Kicker' },
  { group: 'videos', keyPath: 'videos.title', labelVi: 'Tiêu đề Thư viện Video', labelEn: 'Video Library Title' },
  { group: 'videos', keyPath: 'videos.subtitle', labelVi: 'Mô tả Thư viện Video', labelEn: 'Video Library Subtitle', multiline: true },
  { group: 'videos', keyPath: 'videos.openFullLibrary', labelVi: 'Nút mở thư viện đầy đủ', labelEn: 'Open Full Library CTA' },

  // Hero Search
  { group: 'hero', keyPath: 'hero.searchPlaceholder', labelVi: 'Ô tìm kiếm (Placeholder)', labelEn: 'Search input placeholder' },
  { group: 'hero', keyPath: 'hero.searchAll', labelVi: 'Bộ lọc: Tất cả', labelEn: 'Scope: All' },
  { group: 'hero', keyPath: 'hero.searchExplore', labelVi: 'Bộ lọc: Trải nghiệm', labelEn: 'Scope: Experiences' },
  { group: 'hero', keyPath: 'hero.searchEvents', labelVi: 'Bộ lọc: Sự kiện', labelEn: 'Scope: Events' },
  { group: 'hero', keyPath: 'hero.searchStay', labelVi: 'Bộ lọc: Khách sạn', labelEn: 'Scope: Hotels' },
  { group: 'hero', keyPath: 'hero.searchBtn', labelVi: 'Nút Tìm kiếm', labelEn: 'Search button' },
  { group: 'hero', keyPath: 'hero.noResults', labelVi: 'Thông báo không có kết quả', labelEn: 'Empty search message', multiline: true },

  // Explore
  { group: 'explore', keyPath: 'explore.kicker', labelVi: 'Nhãn dẫn khối Trải nghiệm', labelEn: 'Experiences section kicker' },
  { group: 'explore', keyPath: 'explore.title', labelVi: 'Tiêu đề khối Trải nghiệm', labelEn: 'Experiences section title' },
  { group: 'explore', keyPath: 'explore.subtitle', labelVi: 'Mô tả khối Trải nghiệm', labelEn: 'Experiences section subtitle', multiline: true },
  { group: 'explore', keyPath: 'explore.filters.all', labelVi: 'Tab lọc: Tất cả', labelEn: 'Filter: All' },
  { group: 'explore', keyPath: 'explore.filters.history', labelVi: 'Tab lọc: Lịch sử', labelEn: 'Filter: History' },
  { group: 'explore', keyPath: 'explore.filters.dining', labelVi: 'Tab lọc: Ẩm thực', labelEn: 'Filter: Dining' },
  { group: 'explore', keyPath: 'explore.filters.arts', labelVi: 'Tab lọc: Nghệ thuật', labelEn: 'Filter: Arts' },
  { group: 'explore', keyPath: 'explore.filters.outdoors', labelVi: 'Tab lọc: Ngoài trời', labelEn: 'Filter: Outdoors' },
  { group: 'explore', keyPath: 'explore.save', labelVi: 'Nút Lưu lịch trình', labelEn: 'Save to Trip button' },
  { group: 'explore', keyPath: 'explore.saved', labelVi: 'Trạng thái Đã lưu', labelEn: 'Saved state label' },
  { group: 'explore', keyPath: 'explore.viewDetails', labelVi: 'Nút Xem chi tiết', labelEn: 'View Details button' },

  // Neighborhoods
  { group: 'neighborhoods', keyPath: 'neighborhoods.kicker', labelVi: 'Nhãn dẫn khối Khu phố', labelEn: 'Neighborhoods kicker' },
  { group: 'neighborhoods', keyPath: 'neighborhoods.title', labelVi: 'Tiêu đề khối Khu phố', labelEn: 'Neighborhoods title' },
  { group: 'neighborhoods', keyPath: 'neighborhoods.subtitle', labelVi: 'Mô tả khối Khu phố', labelEn: 'Neighborhoods subtitle', multiline: true },
  { group: 'neighborhoods', keyPath: 'neighborhoods.walkability', labelVi: 'Nhãn Điểm đi bộ', labelEn: 'Walk Score label' },
  { group: 'neighborhoods', keyPath: 'neighborhoods.transitLabel', labelVi: 'Nhãn Giao thông công cộng', labelEn: 'Transit Access label' },
  { group: 'neighborhoods', keyPath: 'neighborhoods.topPicksTitle', labelVi: 'Tiêu đề Điểm dừng nổi bật', labelEn: 'Top Local Stops heading' },
  { group: 'neighborhoods', keyPath: 'neighborhoods.addNeighborhoodBtn', labelVi: 'Nút Lưu khu phố', labelEn: 'Save Neighborhood button' },
  { group: 'neighborhoods', keyPath: 'neighborhoods.savedNeighborhoodBtn', labelVi: 'Trạng thái Đã lưu khu phố', labelEn: 'Saved Neighborhood state' },

  // Events
  { group: 'events', keyPath: 'events.kicker', labelVi: 'Nhãn dẫn khối Sự kiện', labelEn: 'Events section kicker' },
  { group: 'events', keyPath: 'events.title', labelVi: 'Tiêu đề khối Sự kiện', labelEn: 'Events section title' },
  { group: 'events', keyPath: 'events.subtitle', labelVi: 'Mô tả khối Sự kiện', labelEn: 'Events section subtitle', multiline: true },
  { group: 'events', keyPath: 'events.timeframes.all', labelVi: 'Thời gian: Tất cả', labelEn: 'Timeframe: All Dates' },
  { group: 'events', keyPath: 'events.timeframes.week', labelVi: 'Thời gian: Tuần này', labelEn: 'Timeframe: This Week' },
  { group: 'events', keyPath: 'events.timeframes.month', labelVi: 'Thời gian: 30 ngày tới', labelEn: 'Timeframe: Next 30 Days' },
  { group: 'events', keyPath: 'events.timeframes.holiday', labelVi: 'Thời gian: Mùa lễ hội', labelEn: 'Timeframe: Holiday Season' },
  { group: 'events', keyPath: 'events.categories.all', labelVi: 'Thể loại: Tất cả', labelEn: 'Category: All' },
  { group: 'events', keyPath: 'events.categories.arts', labelVi: 'Thể loại: Nghệ thuật', labelEn: 'Category: Arts & Music' },
  { group: 'events', keyPath: 'events.categories.sports', labelVi: 'Thể loại: Thể thao', labelEn: 'Category: Sports' },
  { group: 'events', keyPath: 'events.categories.festival', labelVi: 'Thể loại: Lễ hội', labelEn: 'Category: Festivals' },
  { group: 'events', keyPath: 'events.categories.exhibition', labelVi: 'Thể loại: Triển lãm', labelEn: 'Category: Exhibitions' },
  { group: 'events', keyPath: 'events.empty', labelVi: 'Thông báo trống bộ lọc', labelEn: 'Empty filter message', multiline: true },
  { group: 'events', keyPath: 'events.resetFilters', labelVi: 'Nút Đặt lại bộ lọc', labelEn: 'Reset Filters button' },
  { group: 'events', keyPath: 'events.details', labelVi: 'Nút Chi tiết sự kiện', labelEn: 'Event details button' },

  // Stay, Visitor Guide & Meetings
  { group: 'stay', keyPath: 'stay.kicker', labelVi: 'Nhãn dẫn khối Lưu trú', labelEn: 'Stay section kicker' },
  { group: 'stay', keyPath: 'stay.title', labelVi: 'Tiêu đề khối Khách sạn', labelEn: 'Hotels section title' },
  { group: 'stay', keyPath: 'stay.subtitle', labelVi: 'Mô tả khối Khách sạn', labelEn: 'Hotels section subtitle', multiline: true },
  { group: 'stay', keyPath: 'stay.allDistricts', labelVi: 'Bộ lọc Tất cả khu vực', labelEn: 'All Districts filter' },
  { group: 'stay', keyPath: 'stay.perNight', labelVi: 'Đơn vị giá (/ đêm)', labelEn: 'Nightly unit (/ night)' },
  { group: 'stay', keyPath: 'stay.guideKicker', labelVi: 'Nhãn dẫn Cẩm nang Du lịch', labelEn: 'Visitor Guide kicker' },
  { group: 'stay', keyPath: 'stay.guideTitle', labelVi: 'Tiêu đề Cẩm nang Du lịch', labelEn: 'Visitor Guide headline' },
  { group: 'stay', keyPath: 'stay.guideDesc', labelVi: 'Mô tả Cẩm nang Du lịch', labelEn: 'Visitor Guide description', multiline: true },
  { group: 'stay', keyPath: 'stay.emailPlaceholder', labelVi: 'Placeholder email Cẩm nang', labelEn: 'Guide email placeholder' },
  { group: 'stay', keyPath: 'stay.emailBtn', labelVi: 'Nút Gửi Cẩm nang', labelEn: 'Send Free Guide button' },
  { group: 'stay', keyPath: 'stay.emailSuccess', labelVi: 'Thông báo gửi Cẩm nang thành công', labelEn: 'Guide success message', multiline: true },
  { group: 'stay', keyPath: 'stay.meetingsKicker', labelVi: 'Nhãn dẫn Hội nghị (MICE)', labelEn: 'Meetings section kicker' },
  { group: 'stay', keyPath: 'stay.meetingsTitle', labelVi: 'Tiêu đề Hội nghị & Sự kiện', labelEn: 'Meetings headline' },
  { group: 'stay', keyPath: 'stay.meetingsDesc', labelVi: 'Mô tả Hội nghị & Sự kiện', labelEn: 'Meetings description', multiline: true },
  { group: 'stay', keyPath: 'stay.meetingsBtn', labelVi: 'Nút Gửi yêu cầu RFP', labelEn: 'Submit RFP button' },

  // Itinerary Drawer
  { group: 'drawer', keyPath: 'drawer.title', labelVi: 'Tiêu đề Ngăn Lịch trình', labelEn: 'Itinerary drawer title' },
  { group: 'drawer', keyPath: 'drawer.subtitle', labelVi: 'Mô tả Ngăn Lịch trình', labelEn: 'Itinerary drawer subtitle', multiline: true },
  { group: 'drawer', keyPath: 'drawer.emptyTitle', labelVi: 'Tiêu đề khi lịch trình trống', labelEn: 'Empty itinerary title' },
  { group: 'drawer', keyPath: 'drawer.emptyDesc', labelVi: 'Hướng dẫn khi lịch trình trống', labelEn: 'Empty itinerary description', multiline: true },
  { group: 'drawer', keyPath: 'drawer.loadStarter', labelVi: 'Nút Nạp lịch trình 48h mẫu', labelEn: 'Load 48-hour starter button' },
  { group: 'drawer', keyPath: 'drawer.dayPrefix', labelVi: 'Tiền tố ngày (Ngày / Day)', labelEn: 'Day prefix' },
  { group: 'drawer', keyPath: 'drawer.copyBtn', labelVi: 'Nút Sao chép lịch trình', labelEn: 'Copy Itinerary button' },
  { group: 'drawer', keyPath: 'drawer.clearAll', labelVi: 'Nút Xóa tất cả', labelEn: 'Clear All button' },

  // Detail Modal
  { group: 'modal', keyPath: 'modal.close', labelVi: 'Nút Đóng cửa sổ', labelEn: 'Close button' },
  { group: 'modal', keyPath: 'modal.address', labelVi: 'Nhãn Địa chỉ', labelEn: 'Address label' },
  { group: 'modal', keyPath: 'modal.hours', labelVi: 'Nhãn Giờ mở cửa', labelEn: 'Hours label' },
  { group: 'modal', keyPath: 'modal.price', labelVi: 'Nhãn Chi phí', labelEn: 'Cost label' },
  { group: 'modal', keyPath: 'modal.transit', labelVi: 'Nhãn Giao thông', labelEn: 'Transit label' },
  { group: 'modal', keyPath: 'modal.insiderTip', labelVi: 'Nhãn Mẹo bản địa', labelEn: 'Insider Tip label' },
  { group: 'modal', keyPath: 'modal.addToTrip', labelVi: 'Nút Thêm vào lịch trình', labelEn: 'Save to Itinerary button' },
  { group: 'modal', keyPath: 'modal.removeFromTrip', labelVi: 'Nút Bỏ khỏi lịch trình', labelEn: 'Remove from Itinerary button' },

  // Meetings RFP Modal
  { group: 'meetingsModal', keyPath: 'meetingsModal.title', labelVi: 'Tiêu đề Form RFP', labelEn: 'RFP modal title' },
  { group: 'meetingsModal', keyPath: 'meetingsModal.subtitle', labelVi: 'Mô tả Form RFP', labelEn: 'RFP modal subtitle', multiline: true },
  { group: 'meetingsModal', keyPath: 'meetingsModal.orgLabel', labelVi: 'Nhãn Tên tổ chức', labelEn: 'Organization field label' },
  { group: 'meetingsModal', keyPath: 'meetingsModal.emailLabel', labelVi: 'Nhãn Email liên hệ', labelEn: 'Work Email field label' },
  { group: 'meetingsModal', keyPath: 'meetingsModal.guestsLabel', labelVi: 'Nhãn Quy mô khách', labelEn: 'Estimated Attendance label' },
  { group: 'meetingsModal', keyPath: 'meetingsModal.monthLabel', labelVi: 'Nhãn Thời gian dự kiến', labelEn: 'Target Timeframe label' },
  { group: 'meetingsModal', keyPath: 'meetingsModal.submit', labelVi: 'Nút Gửi yêu cầu RFP', labelEn: 'Submit RFP CTA' },
  { group: 'meetingsModal', keyPath: 'meetingsModal.successTitle', labelVi: 'Tiêu đề gửi RFP thành công', labelEn: 'RFP success headline' },
  { group: 'meetingsModal', keyPath: 'meetingsModal.successDesc', labelVi: 'Mô tả gửi RFP thành công', labelEn: 'RFP success description', multiline: true },

  // Footer
  { group: 'footer', keyPath: 'footer.visitorCenterTitle', labelVi: 'Tiêu đề Trung tâm Du khách', labelEn: 'Visitor Center heading' },
  { group: 'footer', keyPath: 'footer.newsletterTitle', labelVi: 'Tiêu đề Bản tin cuối tuần', labelEn: 'Newsletter heading' },
  { group: 'footer', keyPath: 'footer.newsletterPlaceholder', labelVi: 'Placeholder Email bản tin', labelEn: 'Newsletter email placeholder' },
  { group: 'footer', keyPath: 'footer.newsletterBtn', labelVi: 'Nút Đăng ký bản tin', labelEn: 'Subscribe button' },
  { group: 'footer', keyPath: 'footer.newsletterOk', labelVi: 'Thông báo Đăng ký thành công', labelEn: 'Subscribed confirmation' },
  { group: 'footer', keyPath: 'footer.copyright', labelVi: 'Dòng bản quyền chân trang', labelEn: 'Footer copyright line' },
];

export const UI_TRANSLATION_CATALOG: UiTranslationCatalogItem[] = CATALOG_DEFS.map(
  (def) => ({
    ...def,
    id: keyPathToDocId(def.keyPath),
    defaultVi: getNestedString(
      COPY.vi as unknown as Record<string, unknown>,
      def.keyPath
    ),
    defaultEn: getNestedString(
      COPY.en as unknown as Record<string, unknown>,
      def.keyPath
    ),
  })
);

export type SiteCopyBundle = typeof COPY;

export function buildMergedCopy(
  overrides: UiTranslationRecord[]
): SiteCopyBundle {
  if (!overrides.length) return COPY;

  const cloned = JSON.parse(JSON.stringify(COPY)) as {
    vi: Record<string, unknown>;
    en: Record<string, unknown>;
  };

  for (const entry of overrides) {
    if (entry.valueVi.trim()) {
      setNestedString(cloned.vi, entry.keyPath, entry.valueVi);
    }
    if (entry.valueEn.trim()) {
      setNestedString(cloned.en, entry.keyPath, entry.valueEn);
    }
  }

  return cloned as unknown as SiteCopyBundle;
}

// -----------------------------------------------------------------------------
// Firestore Live Subscriptions & Mutations
// -----------------------------------------------------------------------------
function clampStr(val: string, maxLen: number, fallback: string): string {
  const trimmed = (val ?? '').trim();
  const safe = trimmed.length > 0 ? trimmed : fallback;
  return safe.slice(0, maxLen);
}

export function subscribeI18nConfig(
  onConfig: (config: I18nConfigData | null) => void
): () => void {
  return onSnapshot(
    doc(db, 'i18nConfig', 'main'),
    (snap) => {
      if (!snap.exists()) {
        onConfig(null);
        return;
      }
      const d = snap.data();
      const enableVi = d.enableVi !== false;
      const enableEn = d.enableEn !== false;
      const safeEnableVi = enableVi || !enableEn;
      const rawDefault: Language = d.defaultLanguage === 'en' ? 'en' : 'vi';
      const safeDefault: Language =
        rawDefault === 'vi' && !safeEnableVi
          ? 'en'
          : rawDefault === 'en' && !enableEn
            ? 'vi'
            : rawDefault;

      onConfig({
        defaultLanguage: safeDefault,
        enableVi: safeEnableVi,
        enableEn,
        showLanguageSwitcher: d.showLanguageSwitcher !== false,
        autoDetectBrowser: Boolean(d.autoDetectBrowser),
        viLabel: String(d.viLabel || DEFAULT_I18N_CONFIG.viLabel),
        enLabel: String(d.enLabel || DEFAULT_I18N_CONFIG.enLabel),
        updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
        updatedAt: (d.updatedAt as Timestamp | null) ?? null,
      });
    },
    (err) => handleFirestoreError(err, OperationType.GET, 'i18nConfig/main')
  );
}

export function subscribeUiTranslations(
  onEntries: (entries: UiTranslationRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'uiTranslations'),
    where('group', 'in', ALL_UI_TRANSLATION_GROUPS)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: UiTranslationRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          group: (data.group as UiTranslationGroup) || 'nav',
          keyPath: String(data.keyPath || ''),
          valueVi: String(data.valueVi || ''),
          valueEn: String(data.valueEn || ''),
          updatedBy:
            typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
          updatedAt: (data.updatedAt as Timestamp | null) ?? null,
        };
      });
      onEntries(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'uiTranslations')
  );
}

export async function saveI18nConfig(
  config: I18nConfigData,
  uid: string
): Promise<void> {
  const enableVi = Boolean(config.enableVi);
  const enableEn = Boolean(config.enableEn);
  const safeEnableVi = enableVi || !enableEn;
  const safeEnableEn = enableEn;
  const safeDefault: Language =
    config.defaultLanguage === 'en' && safeEnableEn
      ? 'en'
      : safeEnableVi
        ? 'vi'
        : 'en';

  const payload = {
    defaultLanguage: safeDefault,
    enableVi: safeEnableVi,
    enableEn: safeEnableEn,
    showLanguageSwitcher: Boolean(config.showLanguageSwitcher),
    autoDetectBrowser: Boolean(config.autoDetectBrowser),
    viLabel: clampStr(config.viLabel, 40, DEFAULT_I18N_CONFIG.viLabel),
    enLabel: clampStr(config.enLabel, 40, DEFAULT_I18N_CONFIG.enLabel),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'i18nConfig', 'main'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'i18nConfig/main');
  }
}

export async function saveUiTranslation(
  item: {
    group: UiTranslationGroup;
    keyPath: string;
    valueVi: string;
    valueEn: string;
  },
  uid: string
): Promise<void> {
  const id = keyPathToDocId(item.keyPath);
  const catalog = UI_TRANSLATION_CATALOG.find((c) => c.id === id);
  const payload = {
    group: item.group,
    keyPath: clampStr(item.keyPath, 120, 'nav.explore'),
    valueVi: clampStr(item.valueVi, 600, catalog?.defaultVi || 'Tiếng Việt'),
    valueEn: clampStr(item.valueEn, 600, catalog?.defaultEn || 'English'),
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'uiTranslations', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `uiTranslations/${id}`);
  }
}

export async function batchSaveUiTranslations(
  items: {
    group: UiTranslationGroup;
    keyPath: string;
    valueVi: string;
    valueEn: string;
  }[],
  uid: string
): Promise<void> {
  if (items.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const item of items) {
      const id = keyPathToDocId(item.keyPath);
      const catalog = UI_TRANSLATION_CATALOG.find((c) => c.id === id);
      batch.set(doc(db, 'uiTranslations', id), {
        group: item.group,
        keyPath: clampStr(item.keyPath, 120, 'nav.explore'),
        valueVi: clampStr(item.valueVi, 600, catalog?.defaultVi || 'Tiếng Việt'),
        valueEn: clampStr(item.valueEn, 600, catalog?.defaultEn || 'English'),
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'uiTranslations/batch');
  }
}

export async function deleteUiTranslation(entryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'uiTranslations', entryId));
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `uiTranslations/${entryId}`
    );
  }
}

export async function resetAllUiTranslations(
  entryIds: string[]
): Promise<void> {
  if (entryIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of entryIds) {
      batch.delete(doc(db, 'uiTranslations', id));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'uiTranslations/resetAll');
  }
}

// -----------------------------------------------------------------------------
// Content Bilingual Audit Engine (Scans all CMS entities for VI / EN parity)
// -----------------------------------------------------------------------------
export type AuditEntityKind =
  | 'site'
  | 'experience'
  | 'neighborhood'
  | 'event'
  | 'hotel'
  | 'video'
  | 'media';

export interface BilingualAuditItem {
  id: string;
  entityKind: AuditEntityKind;
  entityId: string;
  moduleLabelVi: string;
  moduleLabelEn: string;
  titleVi: string;
  titleEn: string;
  totalFields: number;
  completeFields: number;
  issues: {
    fieldLabelVi: string;
    fieldLabelEn: string;
    reason: 'missing_vi' | 'missing_en' | 'identical';
  }[];
  status: 'complete' | 'warning' | 'missing';
}

export interface BilingualAuditSummary {
  items: BilingualAuditItem[];
  totalFields: number;
  completeFields: number;
  completionPercent: number;
  issueCount: number;
  byModule: {
    kind: AuditEntityKind;
    labelVi: string;
    labelEn: string;
    totalItems: number;
    completeItems: number;
    percent: number;
  }[];
}

function evaluateFieldPairs(
  pairs: {
    labelVi: string;
    labelEn: string;
    vi: string;
    en: string;
    allowIdentical?: boolean;
  }[]
) {
  const issues: BilingualAuditItem['issues'] = [];
  let complete = 0;

  for (const p of pairs) {
    const vi = (p.vi || '').trim();
    const en = (p.en || '').trim();

    if (!vi) {
      issues.push({
        fieldLabelVi: p.labelVi,
        fieldLabelEn: p.labelEn,
        reason: 'missing_vi',
      });
    } else if (!en) {
      issues.push({
        fieldLabelVi: p.labelVi,
        fieldLabelEn: p.labelEn,
        reason: 'missing_en',
      });
    } else if (
      !p.allowIdentical &&
      vi.length >= 10 &&
      vi.toLowerCase() === en.toLowerCase()
    ) {
      issues.push({
        fieldLabelVi: p.labelVi,
        fieldLabelEn: p.labelEn,
        reason: 'identical',
      });
    } else {
      complete += 1;
    }
  }

  const hasMissing = issues.some(
    (i) => i.reason === 'missing_vi' || i.reason === 'missing_en'
  );
  const status: BilingualAuditItem['status'] = hasMissing
    ? 'missing'
    : issues.length > 0
      ? 'warning'
      : 'complete';

  return {
    totalFields: pairs.length,
    completeFields: complete,
    issues,
    status,
  };
}

export function computeContentTranslationAudit(params: {
  siteConfig: SiteConfigData;
  experiences: CmsExperience[];
  neighborhoods: CmsNeighborhood[];
  events: CmsEvent[];
  hotels: CmsHotel[];
  videos?: VideoItemRecord[];
  mediaAssets: MediaAssetRecord[];
}): BilingualAuditSummary {
  const items: BilingualAuditItem[] = [];

  // 1. SiteConfig
  const sitePairs = [
    {
      labelVi: 'Dòng dẫn Hero',
      labelEn: 'Hero Kicker',
      vi: params.siteConfig.kickerVi,
      en: params.siteConfig.kickerEn,
    },
    {
      labelVi: 'Tiêu đề Hero',
      labelEn: 'Hero Headline',
      vi: params.siteConfig.headlineVi,
      en: params.siteConfig.headlineEn,
    },
    {
      labelVi: 'Mô tả Hero',
      labelEn: 'Hero Subhead',
      vi: params.siteConfig.subheadVi,
      en: params.siteConfig.subheadEn,
    },
    {
      labelVi: 'Giới thiệu Footer',
      labelEn: 'Footer About',
      vi: params.siteConfig.footerAboutVi,
      en: params.siteConfig.footerAboutEn,
    },
    ...params.siteConfig.stats.map((st, idx) => ({
      labelVi: `Chỉ số #${idx + 1}`,
      labelEn: `Stat #${idx + 1}`,
      vi: st.labelVi,
      en: st.labelEn,
    })),
  ];
  items.push({
    id: 'site-main',
    entityKind: 'site',
    entityId: 'main',
    moduleLabelVi: 'Trang chủ & Footer',
    moduleLabelEn: 'Homepage & Footer',
    titleVi: params.siteConfig.headlineVi || 'Trang chủ',
    titleEn: params.siteConfig.headlineEn || 'Homepage',
    ...evaluateFieldPairs(sitePairs),
  });

  // 2. Experiences
  for (const exp of params.experiences) {
    items.push({
      id: `exp-${exp.id}`,
      entityKind: 'experience',
      entityId: exp.id,
      moduleLabelVi: 'Trải nghiệm',
      moduleLabelEn: 'Experiences',
      titleVi: exp.title.vi,
      titleEn: exp.title.en,
      ...evaluateFieldPairs([
        { labelVi: 'Tiêu đề', labelEn: 'Title', vi: exp.title.vi, en: exp.title.en },
        { labelVi: 'Tóm tắt', labelEn: 'Summary', vi: exp.summary.vi, en: exp.summary.en },
        { labelVi: 'Mô tả', labelEn: 'Description', vi: exp.description.vi, en: exp.description.en },
        { labelVi: 'Thời lượng', labelEn: 'Duration', vi: exp.duration.vi, en: exp.duration.en, allowIdentical: true },
        { labelVi: 'Chi phí', labelEn: 'Price', vi: exp.price.vi, en: exp.price.en, allowIdentical: true },
      ]),
    });
  }

  // 3. Neighborhoods
  for (const nb of params.neighborhoods) {
    items.push({
      id: `nb-${nb.id}`,
      entityKind: 'neighborhood',
      entityId: nb.id,
      moduleLabelVi: 'Khu phố',
      moduleLabelEn: 'Neighborhoods',
      titleVi: nb.name,
      titleEn: nb.name,
      ...evaluateFieldPairs([
        { labelVi: 'Khẩu hiệu', labelEn: 'Tagline', vi: nb.tagline.vi, en: nb.tagline.en },
        { labelVi: 'Mô tả', labelEn: 'Description', vi: nb.description.vi, en: nb.description.en },
        { labelVi: 'Phong cách', labelEn: 'Vibe', vi: nb.vibe.vi, en: nb.vibe.en },
      ]),
    });
  }

  // 4. Events
  for (const evt of params.events) {
    items.push({
      id: `evt-${evt.id}`,
      entityKind: 'event',
      entityId: evt.id,
      moduleLabelVi: 'Sự kiện',
      moduleLabelEn: 'Events',
      titleVi: evt.title.vi,
      titleEn: evt.title.en,
      ...evaluateFieldPairs([
        { labelVi: 'Tên sự kiện', labelEn: 'Event Title', vi: evt.title.vi, en: evt.title.en },
        { labelVi: 'Ngày đầy đủ', labelEn: 'Full Date', vi: evt.fullDate.vi, en: evt.fullDate.en },
        { labelVi: 'Giá vé', labelEn: 'Price', vi: evt.price.vi, en: evt.price.en, allowIdentical: true },
        { labelVi: 'Mô tả', labelEn: 'Description', vi: evt.description.vi, en: evt.description.en },
      ]),
    });
  }

  // 5. Hotels
  for (const htl of params.hotels) {
    items.push({
      id: `htl-${htl.id}`,
      entityKind: 'hotel',
      entityId: htl.id,
      moduleLabelVi: 'Khách sạn',
      moduleLabelEn: 'Hotels',
      titleVi: htl.name,
      titleEn: htl.name,
      ...evaluateFieldPairs([
        { labelVi: 'Phong cách', labelEn: 'Style', vi: htl.style.vi, en: htl.style.en, allowIdentical: true },
        { labelVi: 'Tóm tắt', labelEn: 'Summary', vi: htl.summary.vi, en: htl.summary.en },
        { labelVi: 'Mô tả', labelEn: 'Description', vi: htl.description.vi, en: htl.description.en },
        {
          labelVi: 'Tiện nghi',
          labelEn: 'Amenities',
          vi: htl.amenities.vi.join(', '),
          en: htl.amenities.en.join(', '),
        },
      ]),
    });
  }

  // 6. Videos
  for (const vid of params.videos || []) {
    items.push({
      id: `video-${vid.id}`,
      entityKind: 'video',
      entityId: vid.id,
      moduleLabelVi: 'Thư viện Video',
      moduleLabelEn: 'Video Library',
      titleVi: vid.titleVi || vid.rawTitle,
      titleEn: vid.titleEn || vid.rawTitle,
      ...evaluateFieldPairs([
        { labelVi: 'Tiêu đề Video', labelEn: 'Video Title', vi: vid.titleVi, en: vid.titleEn },
        { labelVi: 'Tóm tắt Video', labelEn: 'Video Summary', vi: vid.summaryVi, en: vid.summaryEn },
        { labelVi: 'Mô tả SEO', labelEn: 'SEO Description', vi: vid.seoDescriptionVi, en: vid.seoDescriptionEn },
      ]),
    });
  }

  // 7. Media Alt Text
  for (const asset of params.mediaAssets) {
    items.push({
      id: `media-${asset.id}`,
      entityKind: 'media',
      entityId: asset.id,
      moduleLabelVi: 'Thư viện Media',
      moduleLabelEn: 'Media Library',
      titleVi: asset.altVi || asset.seoFileName,
      titleEn: asset.altEn || asset.seoFileName,
      ...evaluateFieldPairs([
        {
          labelVi: 'Mô tả ảnh (Alt Text)',
          labelEn: 'Image Alt Text',
          vi: asset.altVi,
          en: asset.altEn,
        },
      ]),
    });
  }

  const totalFields = items.reduce((acc, i) => acc + i.totalFields, 0);
  const completeFields = items.reduce((acc, i) => acc + i.completeFields, 0);
  const completionPercent =
    totalFields > 0 ? Math.round((completeFields / totalFields) * 100) : 100;
  const issueCount = items.filter((i) => i.status !== 'complete').length;

  const moduleDefs: { kind: AuditEntityKind; labelVi: string; labelEn: string }[] = [
    { kind: 'site', labelVi: 'Trang chủ & Footer', labelEn: 'Homepage & Footer' },
    { kind: 'experience', labelVi: 'Trải nghiệm', labelEn: 'Experiences' },
    { kind: 'neighborhood', labelVi: 'Khu phố', labelEn: 'Neighborhoods' },
    { kind: 'event', labelVi: 'Sự kiện', labelEn: 'Events' },
    { kind: 'hotel', labelVi: 'Khách sạn', labelEn: 'Hotels' },
    { kind: 'video', labelVi: 'Thư viện Video', labelEn: 'Video Library' },
    { kind: 'media', labelVi: 'Alt ảnh Media', labelEn: 'Media Alt Text' },
  ];

  const byModule = moduleDefs.map((mod) => {
    const group = items.filter((i) => i.entityKind === mod.kind);
    const completeItems = group.filter((i) => i.status === 'complete').length;
    const modTotalFields = group.reduce((acc, i) => acc + i.totalFields, 0);
    const modCompleteFields = group.reduce((acc, i) => acc + i.completeFields, 0);
    return {
      kind: mod.kind,
      labelVi: mod.labelVi,
      labelEn: mod.labelEn,
      totalItems: group.length,
      completeItems,
      percent:
        modTotalFields > 0
          ? Math.round((modCompleteFields / modTotalFields) * 100)
          : 100,
    };
  });

  return {
    items,
    totalFields,
    completeFields,
    completionPercent,
    issueCount,
    byModule,
  };
}

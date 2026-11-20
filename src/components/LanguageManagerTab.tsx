import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Download,
  Globe,
  Languages,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Upload,
} from 'lucide-react';
import { Language } from '../data/bostonData';
import {
  CmsEvent,
  CmsExperience,
  CmsHotel,
  CmsNeighborhood,
  SiteConfigData,
} from '../lib/cmsService';
import {
  AuditEntityKind,
  DEFAULT_I18N_CONFIG,
  I18nConfigData,
  UI_TRANSLATION_CATALOG,
  UI_TRANSLATION_GROUPS,
  UiTranslationGroup,
  UiTranslationRecord,
  batchSaveUiTranslations,
  computeContentTranslationAudit,
  deleteUiTranslation,
  resetAllUiTranslations,
  saveI18nConfig,
  saveUiTranslation,
} from '../lib/i18nService';
import { MediaAssetRecord } from '../lib/mediaService';
import { VideoItemRecord } from '../lib/videoService';

type LanguageSubTab = 'settings' | 'strings' | 'audit';

interface LanguageManagerTabProps {
  uid: string;
  adminLang: Language;
  i18nConfig: I18nConfigData;
  overrides: UiTranslationRecord[];
  siteConfig: SiteConfigData;
  experiences: CmsExperience[];
  neighborhoods: CmsNeighborhood[];
  events: CmsEvent[];
  hotels: CmsHotel[];
  videos?: VideoItemRecord[];
  mediaAssets: MediaAssetRecord[];
  onNotice: (msg: string) => void;
  onJumpToEdit: (kind: AuditEntityKind, entityId: string) => void;
}

export function LanguageManagerTab({
  uid,
  adminLang,
  i18nConfig,
  overrides,
  siteConfig,
  experiences,
  neighborhoods,
  events,
  hotels,
  videos,
  mediaAssets,
  onNotice,
  onJumpToEdit,
}: LanguageManagerTabProps) {
  const isVi = adminLang === 'vi';
  const [subTab, setSubTab] = useState<LanguageSubTab>('settings');
  const [configDraft, setConfigDraft] = useState<I18nConfigData>(i18nConfig);
  const [savingConfig, setSavingConfig] = useState(false);

  // UI Strings editor state
  const [groupFilter, setGroupFilter] = useState<'all' | UiTranslationGroup>(
    'all'
  );
  const [stringSearch, setStringSearch] = useState('');
  const [onlyCustomized, setOnlyCustomized] = useState(false);
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { valueVi: string; valueEn: string }>
  >({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Content audit filter state
  const [auditModuleFilter, setAuditModuleFilter] = useState<
    'all' | AuditEntityKind
  >('all');
  const [auditStatusFilter, setAuditStatusFilter] = useState<
    'all' | 'issues' | 'complete'
  >('all');

  useEffect(() => {
    setConfigDraft(i18nConfig);
  }, [i18nConfig]);

  const overrideMap = useMemo(() => {
    const map = new Map<string, UiTranslationRecord>();
    for (const item of overrides) {
      map.set(item.id, item);
    }
    return map;
  }, [overrides]);

  const audit = useMemo(
    () =>
      computeContentTranslationAudit({
        siteConfig,
        experiences,
        neighborhoods,
        events,
        hotels,
        videos,
        mediaAssets,
      }),
    [siteConfig, experiences, neighborhoods, events, hotels, videos, mediaAssets]
  );

  // Resolve current displayed VI/EN value for a catalog entry
  const getEntryValues = (id: string, defaultVi: string, defaultEn: string) => {
    const draft = draftEdits[id];
    if (draft) return draft;
    const saved = overrideMap.get(id);
    if (saved) return { valueVi: saved.valueVi, valueEn: saved.valueEn };
    return { valueVi: defaultVi, valueEn: defaultEn };
  };

  const isEntryDirty = (id: string, defaultVi: string, defaultEn: string) => {
    const draft = draftEdits[id];
    if (!draft) return false;
    const saved = overrideMap.get(id);
    const baseVi = saved ? saved.valueVi : defaultVi;
    const baseEn = saved ? saved.valueEn : defaultEn;
    return draft.valueVi !== baseVi || draft.valueEn !== baseEn;
  };

  const dirtyEntries = useMemo(() => {
    return UI_TRANSLATION_CATALOG.filter((item) =>
      isEntryDirty(item.id, item.defaultVi, item.defaultEn)
    );
  }, [draftEdits, overrideMap]);

  const filteredCatalog = useMemo(() => {
    const q = stringSearch.trim().toLowerCase();
    return UI_TRANSLATION_CATALOG.filter((item) => {
      if (groupFilter !== 'all' && item.group !== groupFilter) return false;
      const customized = overrideMap.has(item.id);
      if (onlyCustomized && !customized) return false;
      if (!q) return true;
      const vals = getEntryValues(item.id, item.defaultVi, item.defaultEn);
      return (
        item.keyPath.toLowerCase().includes(q) ||
        item.labelVi.toLowerCase().includes(q) ||
        item.labelEn.toLowerCase().includes(q) ||
        vals.valueVi.toLowerCase().includes(q) ||
        vals.valueEn.toLowerCase().includes(q)
      );
    });
  }, [groupFilter, stringSearch, onlyCustomized, overrideMap, draftEdits]);

  const filteredAuditItems = useMemo(() => {
    return audit.items.filter((item) => {
      if (
        auditModuleFilter !== 'all' &&
        item.entityKind !== auditModuleFilter
      ) {
        return false;
      }
      if (auditStatusFilter === 'issues' && item.status === 'complete') {
        return false;
      }
      if (auditStatusFilter === 'complete' && item.status !== 'complete') {
        return false;
      }
      return true;
    });
  }, [audit.items, auditModuleFilter, auditStatusFilter]);

  // ---------------------------------------------------------------------------
  // Handlers: Site Language Config
  // ---------------------------------------------------------------------------
  const handleToggleLanguage = (target: Language) => {
    setConfigDraft((prev) => {
      if (target === 'vi') {
        if (prev.enableVi && !prev.enableEn) return prev; // Keep at least 1 enabled
        const nextEnableVi = !prev.enableVi;
        return {
          ...prev,
          enableVi: nextEnableVi,
          defaultLanguage: !nextEnableVi ? 'en' : prev.defaultLanguage,
        };
      } else {
        if (prev.enableEn && !prev.enableVi) return prev; // Keep at least 1 enabled
        const nextEnableEn = !prev.enableEn;
        return {
          ...prev,
          enableEn: nextEnableEn,
          defaultLanguage: !nextEnableEn ? 'vi' : prev.defaultLanguage,
        };
      }
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await saveI18nConfig(configDraft, uid);
      onNotice(
        isVi
          ? 'Đã lưu cấu hình 2 ngôn ngữ (VI / EN) lên Firestore.'
          : 'Saved bilingual (VI / EN) language configuration.'
      );
    } finally {
      setSavingConfig(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers: UI Translation Overrides
  // ---------------------------------------------------------------------------
  const updateDraftField = (
    id: string,
    defaultVi: string,
    defaultEn: string,
    field: 'valueVi' | 'valueEn',
    value: string
  ) => {
    const current = getEntryValues(id, defaultVi, defaultEn);
    setDraftEdits((prev) => ({
      ...prev,
      [id]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const handleSaveSingleRow = async (
    item: (typeof UI_TRANSLATION_CATALOG)[number]
  ) => {
    const vals = getEntryValues(item.id, item.defaultVi, item.defaultEn);
    setSavingRowId(item.id);
    try {
      await saveUiTranslation(
        {
          group: item.group,
          keyPath: item.keyPath,
          valueVi: vals.valueVi,
          valueEn: vals.valueEn,
        },
        uid
      );
      setDraftEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      onNotice(
        isVi
          ? `Đã lưu bản dịch "${item.labelVi}".`
          : `Saved translation for "${item.labelEn}".`
      );
    } finally {
      setSavingRowId(null);
    }
  };

  const handleResetSingleRow = async (
    item: (typeof UI_TRANSLATION_CATALOG)[number]
  ) => {
    setSavingRowId(item.id);
    try {
      if (overrideMap.has(item.id)) {
        await deleteUiTranslation(item.id);
      }
      setDraftEdits((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      onNotice(
        isVi
          ? `Đã khôi phục mặc định cho "${item.labelVi}".`
          : `Restored default copy for "${item.labelEn}".`
      );
    } finally {
      setSavingRowId(null);
    }
  };

  const handleBatchSaveAll = async () => {
    if (dirtyEntries.length === 0) return;
    setBatchBusy(true);
    try {
      const payload = dirtyEntries.map((item) => {
        const vals = getEntryValues(item.id, item.defaultVi, item.defaultEn);
        return {
          group: item.group,
          keyPath: item.keyPath,
          valueVi: vals.valueVi,
          valueEn: vals.valueEn,
        };
      });
      await batchSaveUiTranslations(payload, uid);
      setDraftEdits({});
      onNotice(
        isVi
          ? `Đã lưu đồng loạt ${payload.length} chuỗi ngôn ngữ.`
          : `Saved ${payload.length} UI translation strings.`
      );
    } finally {
      setBatchBusy(false);
    }
  };

  const handleResetAllOverrides = async () => {
    setBatchBusy(true);
    try {
      await resetAllUiTranslations(overrides.map((o) => o.id));
      setDraftEdits({});
      setConfirmResetAll(false);
      onNotice(
        isVi
          ? 'Đã khôi phục toàn bộ nhãn giao diện về mặc định.'
          : 'Restored all UI strings to default values.'
      );
    } finally {
      setBatchBusy(false);
    }
  };

  const handleExportJson = () => {
    const exportObj: Record<string, { vi: string; en: string }> = {};
    for (const item of UI_TRANSLATION_CATALOG) {
      const vals = getEntryValues(item.id, item.defaultVi, item.defaultEn);
      exportObj[item.keyPath] = { vi: vals.valueVi, en: vals.valueEn };
    }
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meet-boston-translations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotice(
      isVi
        ? 'Đã tải xuống tệp sao lưu song ngữ JSON.'
        : 'Downloaded bilingual JSON backup.'
    );
  };

  const handleImportJsonFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportError('');
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as Record<
        string,
        { vi?: unknown; en?: unknown }
      >;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON structure');
      }

      const toUpdate: {
        group: UiTranslationGroup;
        keyPath: string;
        valueVi: string;
        valueEn: string;
      }[] = [];

      for (const item of UI_TRANSLATION_CATALOG) {
        const entry = parsed[item.keyPath];
        if (!entry || typeof entry !== 'object') continue;
        const nextVi =
          typeof entry.vi === 'string' && entry.vi.trim()
            ? entry.vi.trim()
            : item.defaultVi;
        const nextEn =
          typeof entry.en === 'string' && entry.en.trim()
            ? entry.en.trim()
            : item.defaultEn;
        if (nextVi !== item.defaultVi || nextEn !== item.defaultEn) {
          toUpdate.push({
            group: item.group,
            keyPath: item.keyPath,
            valueVi: nextVi,
            valueEn: nextEn,
          });
        }
      }

      if (toUpdate.length === 0) {
        setImportError(
          isVi
            ? 'Không tìm thấy khóa dịch nào khác mặc định trong tệp JSON.'
            : 'No customized translation keys found in the imported JSON.'
        );
        return;
      }

      setBatchBusy(true);
      await batchSaveUiTranslations(toUpdate, uid);
      setDraftEdits({});
      onNotice(
        isVi
          ? `Đã nhập và cập nhật ${toUpdate.length} chuỗi dịch từ JSON.`
          : `Imported and saved ${toUpdate.length} translation strings from JSON.`
      );
    } catch {
      setImportError(
        isVi
          ? 'Tệp JSON không đúng định dạng song ngữ Meet Boston.'
          : 'Invalid JSON format. Please use an exported Meet Boston translations file.'
      );
    } finally {
      setBatchBusy(false);
    }
  };

  const switcherVisible =
    configDraft.showLanguageSwitcher &&
    configDraft.enableVi &&
    configDraft.enableEn;

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <p className="text-xs font-medium text-[#526071]">
            {isVi ? 'Ngôn ngữ mặc định' : 'Default Locale'}
          </p>
          <p className="mt-1.5 font-display text-xl font-extrabold text-[#0A2239]">
            {i18nConfig.defaultLanguage === 'vi' ? 'Tiếng Việt (VI)' : 'English (EN)'}
          </p>
          <p className="mt-1 text-xs text-[#526071]">
            {i18nConfig.enableVi && i18nConfig.enableEn
              ? isVi
                ? 'Song ngữ VI · EN đang bật'
                : 'Both VI · EN active'
              : i18nConfig.enableVi
                ? isVi
                  ? 'Chỉ bật Tiếng Việt'
                  : 'Vietnamese only'
                : isVi
                  ? 'Chỉ bật Tiếng Anh'
                  : 'English only'}
          </p>
        </div>

        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <p className="text-xs font-medium text-[#526071]">
            {isVi ? 'Độ hoàn thiện song ngữ' : 'Content Bilingual Parity'}
          </p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#0A2239] tabular-nums">
            {audit.completionPercent}%
          </p>
          <p className="mt-1 text-xs text-[#526071] tabular-nums">
            {audit.completeFields}/{audit.totalFields}{' '}
            {isVi ? 'trường nội dung chuẩn' : 'verified fields'}
          </p>
        </div>

        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <p className="text-xs font-medium text-[#526071]">
            {isVi ? 'Nhãn giao diện đã tùy biến' : 'Customized UI Strings'}
          </p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-[#0A2239] tabular-nums">
            {overrides.length}
            <span className="text-sm font-semibold text-[#526071]">
              /{UI_TRANSLATION_CATALOG.length}
            </span>
          </p>
          <p className="mt-1 text-xs text-[#526071]">
            {isVi ? 'Đồng bộ thời gian thực' : 'Live Firestore overrides'}
          </p>
        </div>

        <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
          <p className="text-xs font-medium text-[#526071]">
            {isVi ? 'Mục nội dung cần rà soát' : 'Items Needing Review'}
          </p>
          <p
            className={`mt-1.5 font-display text-2xl font-extrabold tabular-nums ${
              audit.issueCount > 0 ? 'text-[#D97706]' : 'text-[#16A34A]'
            }`}
          >
            {audit.issueCount}
          </p>
          <p className="mt-1 text-xs text-[#526071]">
            {audit.issueCount === 0
              ? isVi
                ? 'Tất cả mục đều đủ VI / EN'
                : 'All items fully bilingual'
              : isVi
                ? 'Thiếu dịch hoặc trùng VI/EN'
                : 'Missing or identical copy'}
          </p>
        </div>
      </div>

      {/* Sub-navigation Segmented Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E3E7EE] pb-4">
        <div
          role="tablist"
          aria-label="Language management sections"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[#E9EEF5] p-1"
        >
          {(
            [
              {
                id: 'settings' as LanguageSubTab,
                icon: Sliders,
                label: isVi ? 'Cấu hình ngôn ngữ' : 'Site Settings',
              },
              {
                id: 'strings' as LanguageSubTab,
                icon: Languages,
                label: isVi
                  ? `Nhãn giao diện (${UI_TRANSLATION_CATALOG.length})`
                  : `UI Strings (${UI_TRANSLATION_CATALOG.length})`,
              },
              {
                id: 'audit' as LanguageSubTab,
                icon: Globe,
                label: isVi
                  ? `Kiểm tra song ngữ (${audit.issueCount})`
                  : `Content Audit (${audit.issueCount})`,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSubTab(tab.id)}
                className={`inline-flex min-h-[36px] items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-[#0A2239] shadow-xs'
                    : 'text-[#526071] hover:text-[#0A2239]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {subTab === 'strings' && dirtyEntries.length > 0 && (
          <button
            type="button"
            disabled={batchBusy}
            onClick={() => void handleBatchSaveAll()}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#C8102E] px-4 text-xs font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Save className="h-3.5 w-3.5" />
            <span>
              {isVi
                ? `Lưu tất cả thay đổi (${dirtyEntries.length})`
                : `Save All Changes (${dirtyEntries.length})`}
            </span>
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: SITE LANGUAGE SETTINGS */}
      {/* ===================================================================== */}
      {subTab === 'settings' && (
        <form
          onSubmit={handleSaveConfig}
          className="grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          <div className="space-y-6 rounded-xl border border-[#E3E7EE] bg-white p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3E7EE] pb-4">
              <div>
                <h2 className="font-display text-base font-extrabold text-[#0A2239]">
                  {isVi
                    ? 'Chính sách hiển thị 2 ngôn ngữ trên trang công khai'
                    : 'Public Portal Bilingual Policy'}
                </h2>
                <p className="mt-0.5 text-xs text-[#526071]">
                  {isVi
                    ? 'Quy định ngôn ngữ mặc định, bật/tắt ngôn ngữ và tùy chỉnh nút chuyển đổi ở đầu trang.'
                    : 'Control default locale, enabled languages, browser detection, and Hero switcher labels.'}
                </p>
              </div>
            </div>

            {/* Active Languages Switches */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#0A2239]">
                {isVi
                  ? '1. Ngôn ngữ đang kích hoạt (phải bật ít nhất 1 ngôn ngữ)'
                  : '1. Active Languages (at least 1 must remain enabled)'}
              </p>
              <div className="divide-y divide-[#E3E7EE] rounded-lg border border-[#E3E7EE]">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0F1B2B]">
                      Tiếng Việt (VI)
                    </p>
                    <p className="text-xs text-[#526071]">
                      {isVi
                        ? 'Hiển thị phiên bản tiếng Việt cho du khách Việt Nam.'
                        : 'Serve Vietnamese portal copy and content.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={configDraft.enableVi && !configDraft.enableEn}
                    onClick={() => handleToggleLanguage('vi')}
                    className={`min-h-[34px] rounded-lg border px-3.5 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
                      configDraft.enableVi
                        ? 'border-[#16A34A]/30 bg-emerald-50 text-[#16A34A]'
                        : 'border-[#E3E7EE] bg-[#F7F8FA] text-[#526071]'
                    }`}
                  >
                    {configDraft.enableVi
                      ? isVi
                        ? 'Đang bật'
                        : 'Enabled'
                      : isVi
                        ? 'Đang tắt'
                        : 'Disabled'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0F1B2B]">
                      English (EN)
                    </p>
                    <p className="text-xs text-[#526071]">
                      {isVi
                        ? 'Hiển thị phiên bản tiếng Anh cho du khách quốc tế.'
                        : 'Serve English portal copy and content.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={configDraft.enableEn && !configDraft.enableVi}
                    onClick={() => handleToggleLanguage('en')}
                    className={`min-h-[34px] rounded-lg border px-3.5 text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
                      configDraft.enableEn
                        ? 'border-[#16A34A]/30 bg-emerald-50 text-[#16A34A]'
                        : 'border-[#E3E7EE] bg-[#F7F8FA] text-[#526071]'
                    }`}
                  >
                    {configDraft.enableEn
                      ? isVi
                        ? 'Đang bật'
                        : 'Enabled'
                      : isVi
                        ? 'Đang tắt'
                        : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>

            {/* Default Language Selection */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-[#0A2239]">
                {isVi
                  ? '2. Ngôn ngữ mặc định khi khách mới truy cập'
                  : '2. Default Language for New Visitors'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      code: 'vi' as Language,
                      title: 'Tiếng Việt (VI)',
                      enabled: configDraft.enableVi,
                    },
                    {
                      code: 'en' as Language,
                      title: 'English (EN)',
                      enabled: configDraft.enableEn,
                    },
                  ] as const
                ).map((opt) => {
                  const selected = configDraft.defaultLanguage === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      disabled={!opt.enabled}
                      onClick={() =>
                        setConfigDraft((prev) => ({
                          ...prev,
                          defaultLanguage: opt.code,
                        }))
                      }
                      className={`flex min-h-[44px] items-center justify-between rounded-lg border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                        selected
                          ? 'border-[#0A2239] bg-[#0A2239] text-white'
                          : 'border-[#D4DBE5] bg-white text-[#0F1B2B] hover:bg-[#F7F8FA]'
                      }`}
                    >
                      <span>{opt.title}</span>
                      {selected && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Behavior Switches */}
            <div className="space-y-3 border-t border-[#E3E7EE] pt-4">
              <p className="text-xs font-bold text-[#0A2239]">
                {isVi ? '3. Hành vi chuyển đổi & nhận diện' : '3. Switcher & Detection'}
              </p>

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[#E3E7EE] px-4 py-3 hover:bg-[#F7F8FA]">
                <div>
                  <p className="text-sm font-semibold text-[#0F1B2B]">
                    {isVi
                      ? 'Hiển thị thanh chuyển ngôn ngữ trên Banner Hero'
                      : 'Show Language Switcher in Hero Bar'}
                  </p>
                  <p className="text-xs text-[#526071]">
                    {isVi
                      ? 'Tự động ẩn nếu bạn chỉ kích hoạt duy nhất 1 ngôn ngữ.'
                      : 'Automatically hidden if only 1 language is enabled.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={configDraft.showLanguageSwitcher}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      showLanguageSwitcher: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 accent-[#0A2239]"
                />
              </label>

              <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[#E3E7EE] px-4 py-3 hover:bg-[#F7F8FA]">
                <div>
                  <p className="text-sm font-semibold text-[#0F1B2B]">
                    {isVi
                      ? 'Tự động nhận diện ngôn ngữ trình duyệt lần đầu'
                      : 'Auto-detect Browser Language on First Visit'}
                  </p>
                  <p className="text-xs text-[#526071]">
                    {isVi
                      ? 'Nếu trình duyệt khách là tiếng Anh (en-*), ưu tiên mở ngay bản English.'
                      : 'Automatically match navigator.language (vi / en) when enabled.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={configDraft.autoDetectBrowser}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      autoDetectBrowser: e.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 accent-[#0A2239]"
                />
              </label>
            </div>

            {/* Custom Switcher Labels */}
            <div className="grid grid-cols-1 gap-4 border-t border-[#E3E7EE] pt-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#0F1B2B]">
                  {isVi
                    ? 'Nhãn nút Tiếng Việt (VD: Tiếng Việt / VN)'
                    : 'Vietnamese Button Label'}
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={configDraft.viLabel}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      viLabel: e.target.value,
                    }))
                  }
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0F1B2B]">
                  {isVi
                    ? 'Nhãn nút Tiếng Anh (VD: English / EN)'
                    : 'English Button Label'}
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={configDraft.enLabel}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      enLabel: e.target.value,
                    }))
                  }
                  className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E3E7EE] pt-4">
              <button
                type="button"
                onClick={() => setConfigDraft(DEFAULT_I18N_CONFIG)}
                className="inline-flex min-h-[38px] items-center gap-1.5 text-xs font-semibold text-[#526071] hover:text-[#0A2239]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isVi ? 'Đặt về mặc định' : 'Reset Defaults'}</span>
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                <span>
                  {savingConfig
                    ? isVi
                      ? 'Đang lưu...'
                      : 'Saving...'
                    : isVi
                      ? 'Lưu cấu hình ngôn ngữ'
                      : 'Save Language Settings'}
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Hero Switcher Preview + Architecture Summary */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-xl border border-[#E3E7EE] bg-white p-6">
              <h3 className="font-display text-sm font-bold text-[#0A2239]">
                {isVi
                  ? 'Xem trước thanh chuyển ngôn ngữ trên Hero'
                  : 'Live Hero Switcher Preview'}
              </h3>
              <p className="mt-1 text-xs text-[#526071]">
                {isVi
                  ? 'Hiển thị đúng như khách truy cập nhìn thấy ở góc trên bên phải Banner Hero.'
                  : 'Exact appearance rendered in the top-right Hero strip.'}
              </p>

              <div className="mt-4 rounded-xl bg-[#0A2239] p-5 text-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-white/80">
                    {configDraft.defaultLanguage === 'vi'
                      ? siteConfig.kickerVi
                      : siteConfig.kickerEn}
                  </span>

                  {switcherVisible ? (
                    <div className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 p-1">
                      <span
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                          configDraft.defaultLanguage === 'vi'
                            ? 'bg-white text-[#0A2239]'
                            : 'text-white/85'
                        }`}
                      >
                        {configDraft.viLabel || 'Tiếng Việt'}
                      </span>
                      <span
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                          configDraft.defaultLanguage === 'en'
                            ? 'bg-white text-[#0A2239]'
                            : 'text-white/85'
                        }`}
                      >
                        {configDraft.enLabel || 'English'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs italic text-white/60">
                      {isVi
                        ? '(Bộ chuyển ngôn ngữ đang ẩn)'
                        : '(Switcher hidden)'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E3E7EE] bg-white p-6">
              <h3 className="font-display text-sm font-bold text-[#0A2239]">
                {isVi
                  ? 'Cách quản lý 2 ngôn ngữ hoạt động'
                  : 'How Bilingual Management Works'}
              </h3>
              <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#526071]">
                <li>
                  <strong className="text-[#0F1B2B]">
                    1. {isVi ? 'Nội dung động (Hero, Trải nghiệm, Sự kiện...):' : 'Dynamic Content:'}
                  </strong>{' '}
                  {isVi
                    ? 'Mọi bản ghi đều có song song 2 trường VI & EN. Bạn có thể rà soát toàn bộ tại tab Kiểm tra song ngữ.'
                    : 'Every CMS item stores parallel VI & EN fields, audited live in the Content Audit tab.'}
                </li>
                <li>
                  <strong className="text-[#0F1B2B]">
                    2. {isVi ? 'Nhãn giao diện cố định (Menu, Nút bấm, Form...):' : 'Static Interface Labels:'}
                  </strong>{' '}
                  {isVi
                    ? 'Chỉnh sửa trực tiếp tại tab Nhãn giao diện mà không cần sửa code hay deploy lại.'
                    : 'Customize any navbar link, section heading, button, or form text live with zero code deploys.'}
                </li>
                <li>
                  <strong className="text-[#0F1B2B]">
                    3. {isVi ? 'SEO tự động:' : 'Automatic HTML Lang:'}
                  </strong>{' '}
                  {isVi
                    ? 'Thuộc tính <html lang="vi|en"> tự động cập nhật theo ngôn ngữ khách đang xem.'
                    : 'Document <html lang="vi|en"> stays synchronized automatically for SEO and accessibility.'}
                </li>
              </ul>
            </div>
          </div>
        </form>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: UI STRINGS TRANSLATION EDITOR */}
      {/* ===================================================================== */}
      {subTab === 'strings' && (
        <div className="space-y-4">
          {/* Search + Import / Export Toolbar */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#E3E7EE] bg-white p-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]" />
                <input
                  type="text"
                  value={stringSearch}
                  onChange={(e) => setStringSearch(e.target.value)}
                  placeholder={
                    isVi
                      ? 'Tìm nhãn giao diện, mã key, văn bản VI hoặc EN...'
                      : 'Search UI labels, keys, Vietnamese or English copy...'
                  }
                  className="h-10 w-full rounded-lg border border-[#D4DBE5] bg-white pl-9 pr-3 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                />
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#0F1B2B] whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={onlyCustomized}
                  onChange={(e) => setOnlyCustomized(e.target.checked)}
                  className="h-4 w-4 accent-[#0A2239]"
                />
                <span>
                  {isVi
                    ? `Chỉ mục đã tùy biến (${overrides.length})`
                    : `Customized only (${overrides.length})`}
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D4DBE5] bg-white px-3 text-xs font-semibold text-[#0A2239] hover:bg-[#F7F8FA] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isVi ? 'Xuất JSON' : 'Export JSON'}</span>
              </button>

              <button
                type="button"
                disabled={batchBusy}
                onClick={() => importInputRef.current?.click()}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D4DBE5] bg-white px-3 text-xs font-semibold text-[#0A2239] hover:bg-[#F7F8FA] disabled:opacity-50 whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{isVi ? 'Nhập JSON' : 'Import JSON'}</span>
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportJsonFile}
                className="hidden"
              />

              {overrides.length > 0 && !confirmResetAll && (
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(true)}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-[#C8102E] hover:bg-red-50 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{isVi ? 'Khôi phục tất cả' : 'Reset All'}</span>
                </button>
              )}
            </div>
          </div>

          {confirmResetAll && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-xs">
              <p className="font-semibold text-[#C8102E]">
                {isVi
                  ? `Xác nhận xóa toàn bộ ${overrides.length} chuỗi tùy biến và quay về văn bản mặc định ban đầu?`
                  : `Confirm resetting all ${overrides.length} custom overrides back to default portal copy?`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(false)}
                  className="min-h-[32px] rounded-md border border-[#D4DBE5] bg-white px-3 font-semibold text-[#0F1B2B]"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={batchBusy}
                  onClick={() => void handleResetAllOverrides()}
                  className="min-h-[32px] rounded-md bg-[#C8102E] px-3 font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60"
                >
                  {isVi ? 'Xác nhận khôi phục' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          )}

          {importError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-[#C8102E]"
            >
              {importError}
            </p>
          )}

          {/* Section Group Filter Buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setGroupFilter('all')}
              className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                groupFilter === 'all'
                  ? 'bg-[#0A2239] text-white'
                  : 'border border-[#E3E7EE] bg-white text-[#526071] hover:text-[#0A2239]'
              }`}
            >
              {isVi ? 'Tất cả nhóm' : 'All Groups'} ({UI_TRANSLATION_CATALOG.length})
            </button>
            {UI_TRANSLATION_GROUPS.map((grp) => {
              const count = UI_TRANSLATION_CATALOG.filter(
                (i) => i.group === grp.id
              ).length;
              const active = groupFilter === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setGroupFilter(grp.id)}
                  className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#0A2239] text-white'
                      : 'border border-[#E3E7EE] bg-white text-[#526071] hover:text-[#0A2239]'
                  }`}
                >
                  {isVi ? grp.labelVi : grp.labelEn}{' '}
                  <span className="font-mono opacity-75 tabular-nums">
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Side-by-side Translation Table */}
          <div className="overflow-hidden rounded-xl border border-[#E3E7EE] bg-white">
            <div className="hidden grid-cols-12 gap-4 border-b border-[#E3E7EE] bg-[#F7F8FA] px-5 py-3 text-xs font-semibold text-[#526071] lg:grid">
              <div className="col-span-3">
                {isVi ? 'Vị trí & Mã khóa' : 'Location & Key'}
              </div>
              <div className="col-span-4">Tiếng Việt (VI)</div>
              <div className="col-span-4">English (EN)</div>
              <div className="col-span-1 text-right">
                {isVi ? 'Lưu' : 'Action'}
              </div>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-[#526071]">
                {isVi
                  ? 'Không tìm thấy nhãn giao diện nào khớp với bộ lọc hiện tại.'
                  : 'No UI translation entries match your current filter.'}
              </div>
            ) : (
              <div className="divide-y divide-[#E3E7EE]">
                {filteredCatalog.map((item) => {
                  const vals = getEntryValues(
                    item.id,
                    item.defaultVi,
                    item.defaultEn
                  );
                  const dirty = isEntryDirty(
                    item.id,
                    item.defaultVi,
                    item.defaultEn
                  );
                  const customized = overrideMap.has(item.id);
                  const groupMeta = UI_TRANSLATION_GROUPS.find(
                    (g) => g.id === item.group
                  );
                  const isRowBusy = savingRowId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`grid grid-cols-1 gap-3 px-5 py-4 lg:grid-cols-12 lg:items-start lg:gap-4 ${
                        dirty ? 'bg-amber-50/40' : 'hover:bg-[#F7F8FA]/50'
                      }`}
                    >
                      <div className="lg:col-span-3">
                        <p className="text-sm font-semibold text-[#0A2239]">
                          {isVi ? item.labelVi : item.labelEn}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#526071]">
                          <span>
                            {isVi ? groupMeta?.labelVi : groupMeta?.labelEn}
                          </span>
                          <span aria-hidden="true">·</span>
                          <code className="font-mono text-[#0A2239]/80">
                            {item.keyPath}
                          </code>
                        </div>
                        <p
                          className={`mt-1 text-[11px] font-semibold ${
                            dirty
                              ? 'text-[#D97706]'
                              : customized
                                ? 'text-[#16A34A]'
                                : 'text-[#526071]'
                          }`}
                        >
                          {dirty
                            ? isVi
                              ? 'Chưa lưu thay đổi'
                              : 'Unsaved edits'
                            : customized
                              ? isVi
                                ? 'Đã tùy biến trên Firestore'
                                : 'Custom override active'
                              : isVi
                                ? 'Đang dùng mặc định'
                                : 'Default copy'}
                        </p>
                      </div>

                      <div className="lg:col-span-4">
                        <label className="mb-1 block text-[11px] font-semibold text-[#526071] lg:hidden">
                          Tiếng Việt (VI)
                        </label>
                        {item.multiline ? (
                          <textarea
                            rows={2}
                            maxLength={600}
                            value={vals.valueVi}
                            onChange={(e) =>
                              updateDraftField(
                                item.id,
                                item.defaultVi,
                                item.defaultEn,
                                'valueVi',
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[#D4DBE5] bg-white px-3 py-2 text-xs leading-relaxed text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                          />
                        ) : (
                          <input
                            type="text"
                            maxLength={600}
                            value={vals.valueVi}
                            onChange={(e) =>
                              updateDraftField(
                                item.id,
                                item.defaultVi,
                                item.defaultEn,
                                'valueVi',
                                e.target.value
                              )
                            }
                            className="h-9 w-full rounded-lg border border-[#D4DBE5] bg-white px-3 text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                          />
                        )}
                      </div>

                      <div className="lg:col-span-4">
                        <label className="mb-1 block text-[11px] font-semibold text-[#526071] lg:hidden">
                          English (EN)
                        </label>
                        {item.multiline ? (
                          <textarea
                            rows={2}
                            maxLength={600}
                            value={vals.valueEn}
                            onChange={(e) =>
                              updateDraftField(
                                item.id,
                                item.defaultVi,
                                item.defaultEn,
                                'valueEn',
                                e.target.value
                              )
                            }
                            className="w-full rounded-lg border border-[#D4DBE5] bg-white px-3 py-2 text-xs leading-relaxed text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                          />
                        ) : (
                          <input
                            type="text"
                            maxLength={600}
                            value={vals.valueEn}
                            onChange={(e) =>
                              updateDraftField(
                                item.id,
                                item.defaultVi,
                                item.defaultEn,
                                'valueEn',
                                e.target.value
                              )
                            }
                            className="h-9 w-full rounded-lg border border-[#D4DBE5] bg-white px-3 text-xs text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                          />
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1.5 lg:col-span-1 lg:pt-0.5">
                        {dirty && (
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void handleSaveSingleRow(item)}
                            title={isVi ? 'Lưu dòng này' : 'Save row'}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-[#0A2239] px-2.5 text-xs font-semibold text-white hover:bg-[#133454] disabled:opacity-50"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(customized || dirty) && (
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void handleResetSingleRow(item)}
                            title={
                              isVi ? 'Khôi phục mặc định' : 'Restore default'
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E3E7EE] text-[#526071] hover:bg-[#F7F8FA] hover:text-[#C8102E] disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: CONTENT BILINGUAL AUDIT MATRIX */}
      {/* ===================================================================== */}
      {subTab === 'audit' && (
        <div className="space-y-5">
          {/* Per-module Progress Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {audit.byModule.map((mod) => {
              const active = auditModuleFilter === mod.kind;
              return (
                <button
                  key={mod.kind}
                  type="button"
                  onClick={() =>
                    setAuditModuleFilter(active ? 'all' : mod.kind)
                  }
                  className={`rounded-xl border p-3.5 text-left transition-colors ${
                    active
                      ? 'border-[#0A2239] bg-[#0A2239] text-white'
                      : 'border-[#E3E7EE] bg-white text-[#0F1B2B] hover:border-[#0A2239]/40'
                  }`}
                >
                  <p
                    className={`truncate text-xs font-semibold ${
                      active ? 'text-white/85' : 'text-[#526071]'
                    }`}
                  >
                    {isVi ? mod.labelVi : mod.labelEn}
                  </p>
                  <p className="mt-1 font-display text-lg font-extrabold tabular-nums">
                    {mod.percent}%
                  </p>
                  <div
                    className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${
                      active ? 'bg-white/20' : 'bg-[#E9EEF5]'
                    }`}
                  >
                    <div
                      className={`h-full rounded-full ${
                        mod.percent === 100
                          ? active
                            ? 'bg-emerald-300'
                            : 'bg-[#16A34A]'
                          : active
                            ? 'bg-amber-300'
                            : 'bg-[#D97706]'
                      }`}
                      style={{ width: `${mod.percent}%` }}
                    />
                  </div>
                  <p
                    className={`mt-1.5 text-[11px] tabular-nums ${
                      active ? 'text-white/75' : 'text-[#526071]'
                    }`}
                  >
                    {mod.completeItems}/{mod.totalItems}{' '}
                    {isVi ? 'đạt chuẩn' : 'complete'}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 rounded-lg bg-[#E9EEF5] p-1">
              {(
                [
                  {
                    id: 'all' as const,
                    label: isVi
                      ? `Tất cả (${audit.items.length})`
                      : `All (${audit.items.length})`,
                  },
                  {
                    id: 'issues' as const,
                    label: isVi
                      ? `Cần rà soát (${audit.issueCount})`
                      : `Needs Review (${audit.issueCount})`,
                  },
                  {
                    id: 'complete' as const,
                    label: isVi
                      ? `Đủ song ngữ (${audit.items.length - audit.issueCount})`
                      : `Complete (${audit.items.length - audit.issueCount})`,
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAuditStatusFilter(opt.id)}
                  className={`min-h-[34px] rounded-md px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                    auditStatusFilter === opt.id
                      ? 'bg-white text-[#0A2239] shadow-xs'
                      : 'text-[#526071] hover:text-[#0A2239]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {auditModuleFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setAuditModuleFilter('all')}
                className="text-xs font-semibold text-[#C8102E] hover:underline"
              >
                {isVi ? 'Hiện tất cả module' : 'Show all modules'}
              </button>
            )}
          </div>

          {/* Audit Table */}
          <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-xs font-semibold text-[#526071]">
                <tr>
                  <th className="px-4 py-3">
                    {isVi ? 'Module' : 'Module'}
                  </th>
                  <th className="px-4 py-3">Tiếng Việt (VI)</th>
                  <th className="px-4 py-3">English (EN)</th>
                  <th className="px-4 py-3">
                    {isVi ? 'Trạng thái song ngữ' : 'Bilingual Status'}
                  </th>
                  <th className="px-4 py-3 text-right">
                    {isVi ? 'Hành động' : 'Action'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EE]">
                {filteredAuditItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-[#526071]"
                    >
                      {auditStatusFilter === 'issues'
                        ? isVi
                          ? 'Tuyệt vời! Mọi nội dung CMS đều đã đầy đủ bản dịch Tiếng Việt và Tiếng Anh.'
                          : 'Great! All CMS items have complete Vietnamese and English copy.'
                        : isVi
                          ? 'Không có bản ghi nào trong nhóm này.'
                          : 'No records in this filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredAuditItems.map((row) => (
                    <tr key={row.id} className="hover:bg-[#F7F8FA]/60">
                      <td className="px-4 py-3 text-xs font-semibold text-[#526071] whitespace-nowrap">
                        {isVi ? row.moduleLabelVi : row.moduleLabelEn}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-xs font-semibold text-[#0A2239]">
                        {row.titleVi || '—'}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-xs text-[#0F1B2B]">
                        {row.titleEn || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {row.status === 'complete' ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#16A34A]">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="tabular-nums">
                              {row.completeFields}/{row.totalFields}{' '}
                              {isVi ? 'đủ VI & EN' : 'VI & EN OK'}
                            </span>
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center gap-1.5 font-semibold ${
                                row.status === 'missing'
                                  ? 'text-[#C8102E]'
                                  : 'text-[#D97706]'
                              }`}
                            >
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {row.issues.length}{' '}
                                {isVi ? 'trường cần kiểm tra' : 'field(s) to check'}
                              </span>
                            </span>
                            <p className="text-[11px] text-[#526071]">
                              {row.issues
                                .slice(0, 2)
                                .map((iss) => {
                                  const lbl = isVi
                                    ? iss.fieldLabelVi
                                    : iss.fieldLabelEn;
                                  const reason =
                                    iss.reason === 'missing_vi'
                                      ? isVi
                                        ? 'thiếu VI'
                                        : 'missing VI'
                                      : iss.reason === 'missing_en'
                                        ? isVi
                                          ? 'thiếu EN'
                                          : 'missing EN'
                                        : isVi
                                          ? 'trùng VI/EN'
                                          : 'identical VI/EN';
                                  return `${lbl} (${reason})`;
                                })
                                .join(' · ')}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToEdit(row.entityKind, row.entityId)
                          }
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-[#D4DBE5] bg-white px-2.5 text-xs font-semibold text-[#0A2239] hover:border-[#0A2239] hover:bg-[#F7F8FA] whitespace-nowrap"
                        >
                          <span>{isVi ? 'Mở sửa' : 'Edit'}</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

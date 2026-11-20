import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Compass,
  Copy,
  Database,
  Eye,
  EyeOff,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import {
  AdminUserRecord,
  BOOTSTRAPPED_ADMIN_EMAIL,
  CmsEvent,
  CmsExperience,
  CmsHotel,
  CmsNeighborhood,
  DEFAULT_SITE_CONFIG,
  GuideLeadRecord,
  MeetingRfpRecord,
  PRESET_GALLERY_IMAGES,
  SiteConfigData,
  deleteAdminUser,
  deleteEvent,
  deleteExperience,
  deleteGuideLead,
  deleteHotel,
  deleteMeetingRfp,
  deleteNeighborhood,
  saveAdminUser,
  saveEvent,
  saveExperience,
  saveHotel,
  saveNeighborhood,
  saveSiteConfig,
  seedDefaultCmsContent,
  subscribeAdminCms,
  subscribeAdminUsers,
  updateGuideLeadStatus,
  updateMeetingRfpStatus,
} from '../lib/cmsService';
import { signInWithGoogle, signOutAdmin } from '../lib/firebase';
import {
  EventEditorModal,
  ExperienceEditorModal,
  HotelEditorModal,
  NeighborhoodEditorModal,
} from './CmsEditors';
import { ResilientImage } from './ResilientImage';

type AdminTab =
  | 'overview'
  | 'site'
  | 'experiences'
  | 'neighborhoods'
  | 'events'
  | 'hotels'
  | 'leads'
  | 'admins';

interface CmsAdminWorkspaceProps {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  checkingAdmin: boolean;
  onExitCms: () => void;
}

export function CmsAdminWorkspace({
  user,
  authReady,
  isAdmin,
  checkingAdmin,
  onExitCms,
}: CmsAdminWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [siteConfig, setSiteConfig] = useState<SiteConfigData | null>(null);
  const [experiences, setExperiences] = useState<CmsExperience[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<CmsNeighborhood[]>([]);
  const [events, setEvents] = useState<CmsEvent[]>([]);
  const [hotels, setHotels] = useState<CmsHotel[]>([]);
  const [guideLeads, setGuideLeads] = useState<GuideLeadRecord[]>([]);
  const [meetingRfps, setMeetingRfps] = useState<MeetingRfpRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);

  const [siteDraft, setSiteDraft] = useState<SiteConfigData>(DEFAULT_SITE_CONFIG);
  const [searchQuery, setSearchQuery] = useState('');
  const [leadsSubTab, setLeadsSubTab] = useState<'guide' | 'rfp'>('guide');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [authError, setAuthError] = useState('');
  const [uidCopied, setUidCopied] = useState(false);

  // Add Admin form state (Super Admin only)
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'editor'>('admin');
  const [adminFormError, setAdminFormError] = useState('');

  const isSuperAdmin =
    Boolean(user?.emailVerified) &&
    user?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

  // Modal editors
  const [editingExp, setEditingExp] = useState<CmsExperience | null | undefined>(
    undefined
  );
  const [editingNb, setEditingNb] = useState<CmsNeighborhood | null | undefined>(
    undefined
  );
  const [editingEvt, setEditingEvt] = useState<CmsEvent | null | undefined>(
    undefined
  );
  const [editingHtl, setEditingHtl] = useState<CmsHotel | null | undefined>(
    undefined
  );

  const showNotice = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3000);
  };

  // Subscribe to all Firestore collections strictly after verified admin auth
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;
    const unsub = subscribeAdminCms({
      onSiteConfig: (cfg) => {
        setSiteConfig(cfg);
        if (cfg) setSiteDraft(cfg);
      },
      onExperiences: setExperiences,
      onNeighborhoods: setNeighborhoods,
      onEvents: setEvents,
      onHotels: setHotels,
      onGuideLeads: setGuideLeads,
      onMeetingRfps: setMeetingRfps,
    });
    return unsub;
  }, [authReady, user, isAdmin]);

  // Subscribe to /admins list only when logged in as Super Admin
  useEffect(() => {
    if (!authReady || !user || !isSuperAdmin) return;
    return subscribeAdminUsers(setAdminUsers);
  }, [authReady, user, isSuperAdmin]);

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Không thể đăng nhập bằng Google.'
      );
    }
  };

  const handleSeedDatabase = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await seedDefaultCmsContent(user.uid);
      showNotice('Đã đồng bộ toàn bộ dữ liệu mặc định lên Firestore.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSiteConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await saveSiteConfig(siteDraft, user.uid);
      showNotice('Đã lưu cấu hình Trang chủ & Footer.');
    } finally {
      setBusy(false);
    }
  };

  const isDatabaseEmpty =
    !siteConfig &&
    experiences.length === 0 &&
    neighborhoods.length === 0 &&
    events.length === 0 &&
    hotels.length === 0;

  const newLeadsCount = useMemo(
    () =>
      guideLeads.filter((l) => l.status === 'new').length +
      meetingRfps.filter((r) => r.status === 'new').length,
    [guideLeads, meetingRfps]
  );

  const filteredExperiences = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return experiences;
    return experiences.filter(
      (i) =>
        i.title.vi.toLowerCase().includes(q) ||
        i.title.en.toLowerCase().includes(q) ||
        i.district.toLowerCase().includes(q)
    );
  }, [experiences, searchQuery]);

  const filteredNeighborhoods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return neighborhoods;
    return neighborhoods.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.tagline.vi.toLowerCase().includes(q)
    );
  }, [neighborhoods, searchQuery]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (i) =>
        i.title.vi.toLowerCase().includes(q) ||
        i.venue.toLowerCase().includes(q) ||
        i.district.toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  const filteredHotels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return hotels;
    return hotels.filter(
      (i) =>
        i.name.toLowerCase().includes(q) || i.district.toLowerCase().includes(q)
    );
  }, [hotels, searchQuery]);

  // ---------------------------------------------------------------------------
  // Auth Loading / Sign-In Gate
  // ---------------------------------------------------------------------------
  if (!authReady || checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-6">
        <div className="w-full max-w-md rounded-xl border border-[#E3E7EE] bg-white p-8 text-center">
          <p className="font-display text-lg font-bold text-[#0A2239]">
            Meet Boston CMS
          </p>
          <p className="mt-2 text-sm text-[#526071]">
            Đang kiểm tra phiên đăng nhập quản trị...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-6">
        <div className="w-full max-w-md rounded-xl border border-[#E3E7EE] bg-white p-8">
          <p className="text-xs font-semibold text-[#C8102E]">
            Meet Boston · Hệ thống Quản trị Nội dung
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold text-[#0A2239]">
            Đăng nhập Quản trị CMS
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#526071]">
            Sử dụng tài khoản Google quản trị (
            <span className="font-mono text-xs text-[#0F1B2B]">
              {BOOTSTRAPPED_ADMIN_EMAIL}
            </span>
            ) để chỉnh sửa nội dung trang chủ, trải nghiệm, khu phố, sự kiện, khách sạn và quản lý yêu cầu khách hàng.
          </p>

          {authError && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-[#C8102E]"
            >
              {authError}
            </p>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#0A2239] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#133454]"
            >
              <span>Đăng nhập bằng Google</span>
            </button>
            <button
              type="button"
              onClick={onExitCms}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-[#E3E7EE] px-4 py-2 text-sm font-semibold text-[#0F1B2B] hover:bg-[#F7F8FA]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại trang web công khai</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    const handleCopyUid = () => {
      if (navigator.clipboard) {
        void navigator.clipboard.writeText(user.uid);
        setUidCopied(true);
        window.setTimeout(() => setUidCopied(false), 2500);
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-6">
        <div className="w-full max-w-md rounded-xl border border-[#E3E7EE] bg-white p-8">
          <div className="flex items-center gap-2 text-[#C8102E]">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-xs font-bold">Không có quyền quản trị</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold text-[#0A2239]">
            Tài khoản chưa được cấp quyền CMS
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#526071]">
            Bạn đang đăng nhập bằng{' '}
            <span className="font-mono text-xs text-[#0F1B2B]">
              {user.email}
            </span>
            . Hãy gửi mã UID bên dưới cho quản trị viên chính (
            <span className="font-mono text-xs text-[#0F1B2B]">
              {BOOTSTRAPPED_ADMIN_EMAIL}
            </span>
            ) để được thêm vào danh sách quản trị CMS.
          </p>

          <div className="mt-4 rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] p-3">
            <p className="text-[11px] font-semibold text-[#526071]">
              Mã định danh Firebase UID của bạn
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <code className="truncate font-mono text-xs font-semibold text-[#0A2239]">
                {user.uid}
              </code>
              <button
                type="button"
                onClick={handleCopyUid}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#D4DBE5] bg-white px-2.5 py-1 text-xs font-semibold text-[#0A2239] hover:bg-[#F7F8FA]"
              >
                {uidCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Sao chép UID</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-[#0A2239] px-4 text-sm font-semibold text-white hover:bg-[#133454]"
            >
              Đổi tài khoản Google
            </button>
            <button
              type="button"
              onClick={onExitCms}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-[#E3E7EE] px-4 text-sm font-semibold text-[#0F1B2B] hover:bg-[#F7F8FA]"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError('');
    setBusy(true);
    try {
      await saveAdminUser(
        {
          uid: newAdminUid,
          email: newAdminEmail,
          displayName: newAdminName,
          role: newAdminRole,
        },
        user.uid
      );
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
      setNewAdminRole('admin');
      showNotice('Đã cấp quyền quản trị CMS cho tài khoản mới.');
    } catch (err) {
      setAdminFormError(
        err instanceof Error
          ? err.message
          : 'Không thể thêm quản trị viên. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setBusy(false);
    }
  };

  const navItems: {
    id: AdminTab;
    label: string;
    icon: typeof LayoutDashboard;
    count?: number;
  }[] = [
    { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'site', label: 'Trang chủ & Footer', icon: Settings },
    {
      id: 'experiences',
      label: 'Trải nghiệm',
      icon: Compass,
      count: experiences.length,
    },
    {
      id: 'neighborhoods',
      label: 'Khu phố',
      icon: MapPin,
      count: neighborhoods.length,
    },
    { id: 'events', label: 'Sự kiện', icon: Calendar, count: events.length },
    { id: 'hotels', label: 'Khách sạn', icon: Building2, count: hotels.length },
    {
      id: 'leads',
      label: 'Khách hàng & RFP',
      icon: Inbox,
      count: guideLeads.length + meetingRfps.length,
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'admins' as AdminTab,
            label: 'Quản trị viên',
            icon: Users,
            count: adminUsers.length + 1,
          },
        ]
      : []),
  ];

  const currentTabLabel =
    navItems.find((n) => n.id === activeTab)?.label || 'Tổng quan';

  return (
    <div className="flex min-h-screen bg-[#F7F8FA] text-[#0F1B2B]">
      {/* Fixed Left Sidebar (256px) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#E3E7EE] bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-[#E3E7EE] px-6">
          <span className="font-display text-lg font-extrabold tracking-tight text-[#0A2239]">
            Meet Boston CMS
          </span>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="CMS Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSearchQuery('');
                }}
                className={`flex min-h-[40px] w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[#0A2239] text-white'
                    : 'text-[#526071] hover:bg-[#F7F8FA] hover:text-[#0A2239]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      active ? 'text-white/80' : 'text-[#526071]'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#E3E7EE] p-4">
          <p className="truncate text-xs font-semibold text-[#0F1B2B]">
            {user.displayName || 'Administrator'}
          </p>
          <p className="truncate font-mono text-[11px] text-[#526071]">
            {user.email}
          </p>
          <button
            type="button"
            onClick={() => void signOutAdmin()}
            className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg border border-[#E3E7EE] px-3 text-xs font-semibold text-[#526071] hover:bg-[#F7F8FA] hover:text-[#C8102E]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Breadcrumb Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E3E7EE] bg-white px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-semibold text-[#526071] whitespace-nowrap">
              Meet Boston CMS
            </span>
            <span className="text-[#526071]" aria-hidden="true">
              /
            </span>
            <h1 className="truncate font-display font-bold text-[#0A2239]">
              {currentTabLabel}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {toast && (
              <span className="hidden text-xs font-semibold text-[#16A34A] sm:inline">
                {toast}
              </span>
            )}
            <button
              type="button"
              onClick={onExitCms}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3.5 text-xs font-semibold text-[#0A2239] hover:bg-[#F7F8FA] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Xem trang web</span>
            </button>
          </div>
        </header>

        {/* Mobile Tab Strip */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-[#E3E7EE] bg-white px-4 py-2 lg:hidden">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[36px] rounded-md px-3 text-xs font-semibold whitespace-nowrap shrink-0 ${
                activeTab === item.id
                  ? 'bg-[#0A2239] text-white'
                  : 'bg-[#F7F8FA] text-[#526071]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 p-6 lg:p-8">
          {/* First-run Empty Database Seed Callout */}
          {isDatabaseEmpty && (
            <div className="mb-6 flex flex-col justify-between gap-4 rounded-xl border border-[#0A2239]/20 bg-white p-6 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-base font-bold text-[#0A2239]">
                  Cơ sở dữ liệu Firestore chưa có bản ghi CMS
                </h2>
                <p className="mt-1 text-sm text-[#526071]">
                  Nhấn nút bên cạnh để nạp ngay toàn bộ cấu hình trang chủ, 5 trải nghiệm, 6 khu phố, 6 sự kiện và 4 khách sạn mẫu vào Firestore để bắt đầu chỉnh sửa trực tiếp.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleSeedDatabase}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Database className="h-4 w-4" />
                <span>
                  {busy ? 'Đang khởi tạo...' : 'Khởi tạo dữ liệu mẫu'}
                </span>
              </button>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 1: OVERVIEW */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  {
                    label: 'Trải nghiệm',
                    value: experiences.length,
                    sub: `${experiences.filter((i) => i.published).length} công khai`,
                  },
                  {
                    label: 'Khu phố',
                    value: neighborhoods.length,
                    sub: `${neighborhoods.filter((i) => i.published).length} công khai`,
                  },
                  {
                    label: 'Sự kiện',
                    value: events.length,
                    sub: `${events.filter((i) => i.published).length} công khai`,
                  },
                  {
                    label: 'Khách sạn',
                    value: hotels.length,
                    sub: `${hotels.filter((i) => i.published).length} công khai`,
                  },
                  {
                    label: 'Email Cẩm nang',
                    value: guideLeads.length,
                    sub: `${guideLeads.filter((l) => l.status === 'new').length} mới`,
                  },
                  {
                    label: 'Yêu cầu RFP',
                    value: meetingRfps.length,
                    sub: `${meetingRfps.filter((r) => r.status === 'new').length} mới`,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-[#E3E7EE] bg-white p-4"
                  >
                    <p className="text-xs font-medium text-[#526071]">
                      {stat.label}
                    </p>
                    <p className="mt-1.5 font-display text-2xl font-extrabold text-[#0A2239] tabular-nums">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs text-[#526071] tabular-nums">
                      {stat.sub}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Quick Section Visibility Toggles */}
                <div className="rounded-xl border border-[#E3E7EE] bg-white p-6">
                  <h2 className="font-display text-base font-bold text-[#0A2239]">
                    Bật / Tắt nhanh các khối trên trang chủ
                  </h2>
                  <p className="mt-1 text-xs text-[#526071]">
                    Thay đổi có hiệu lực ngay lập tức đối với mọi khách truy cập.
                  </p>

                  <div className="mt-5 divide-y divide-[#E3E7EE]">
                    {(
                      [
                        ['showExplore', '01. Khối Trải nghiệm chọn lọc'],
                        ['showNeighborhoods', '02. Khối Khám phá Khu phố'],
                        ['showEvents', '03. Khối Lịch sự kiện Boston'],
                        ['showStay', '04. Khối Khách sạn & Cẩm nang'],
                        ['showMeetings', '05. Khối Hội nghị & Yêu cầu RFP'],
                      ] as const
                    ).map(([key, label]) => {
                      const enabled = siteDraft[key];
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between py-3"
                        >
                          <span className="text-sm font-medium text-[#0F1B2B]">
                            {label}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              const next = { ...siteDraft, [key]: !enabled };
                              setSiteDraft(next);
                              setBusy(true);
                              try {
                                await saveSiteConfig(next, user.uid);
                                showNotice('Đã cập nhật trạng thái hiển thị.');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
                              enabled
                                ? 'border-[#16A34A]/30 bg-emerald-50 text-[#16A34A]'
                                : 'border-[#E3E7EE] bg-[#F7F8FA] text-[#526071]'
                            }`}
                          >
                            {enabled ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" />
                            )}
                            <span>{enabled ? 'Đang hiện' : 'Đang ẩn'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Operations */}
                <div className="flex flex-col justify-between rounded-xl border border-[#E3E7EE] bg-white p-6">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#0A2239]">
                      Tác vụ quản trị nhanh
                    </h2>
                    <p className="mt-1 text-xs text-[#526071]">
                      Có{' '}
                      <span className="font-mono font-semibold text-[#C8102E] tabular-nums">
                        {newLeadsCount}
                      </span>{' '}
                      yêu cầu khách hàng mới đang chờ xử lý.
                    </p>

                    <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('experiences');
                          setEditingExp(null);
                        }}
                        className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[#E3E7EE] px-4 text-sm font-semibold text-[#0A2239] hover:bg-[#F7F8FA]"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Thêm Trải nghiệm</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('events');
                          setEditingEvt(null);
                        }}
                        className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[#E3E7EE] px-4 text-sm font-semibold text-[#0A2239] hover:bg-[#F7F8FA]"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Thêm Sự kiện</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('hotels');
                          setEditingHtl(null);
                        }}
                        className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[#E3E7EE] px-4 text-sm font-semibold text-[#0A2239] hover:bg-[#F7F8FA]"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Thêm Khách sạn</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('leads')}
                        className="flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#0A2239] px-4 text-sm font-semibold text-white hover:bg-[#133454]"
                      >
                        <Inbox className="h-4 w-4" />
                        <span>Xem Hộp thư Leads</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-[#E3E7EE] pt-4">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSeedDatabase}
                      className="inline-flex min-h-[38px] items-center gap-2 text-xs font-semibold text-[#526071] hover:text-[#0A2239]"
                    >
                      <Database className="h-3.5 w-3.5" />
                      <span>Khôi phục / Đồng bộ lại bộ dữ liệu mẫu Meet Boston</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 2: SITE CONFIG (HERO, STATS, FOOTER) */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'site' && (
            <form
              onSubmit={handleSaveSiteConfig}
              className="space-y-6 rounded-xl border border-[#E3E7EE] bg-white p-6 lg:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E3E7EE] pb-4">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-[#0A2239]">
                    Nội dung Hero, Chỉ số & Chân trang
                  </h2>
                  <p className="mt-0.5 text-xs text-[#526071]">
                    Chỉnh sửa đồng thời cả bản Tiếng Việt và Tiếng Anh.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[40px] rounded-lg bg-[#C8102E] px-5 text-sm font-semibold text-white hover:bg-[#A10C24] disabled:opacity-60"
                >
                  {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Dòng dẫn Hero (VI)
                  </label>
                  <input
                    type="text"
                    value={siteDraft.kickerVi}
                    onChange={(e) =>
                      setSiteDraft({ ...siteDraft, kickerVi: e.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Hero Kicker (EN)
                  </label>
                  <input
                    type="text"
                    value={siteDraft.kickerEn}
                    onChange={(e) =>
                      setSiteDraft({ ...siteDraft, kickerEn: e.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Tiêu đề lớn Hero (VI)
                  </label>
                  <input
                    type="text"
                    value={siteDraft.headlineVi}
                    onChange={(e) =>
                      setSiteDraft({ ...siteDraft, headlineVi: e.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Hero Headline (EN)
                  </label>
                  <input
                    type="text"
                    value={siteDraft.headlineEn}
                    onChange={(e) =>
                      setSiteDraft({ ...siteDraft, headlineEn: e.target.value })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Mô tả Hero (VI)
                  </label>
                  <textarea
                    rows={3}
                    value={siteDraft.subheadVi}
                    onChange={(e) =>
                      setSiteDraft({ ...siteDraft, subheadVi: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Hero Subhead (EN)
                  </label>
                  <textarea
                    rows={3}
                    value={siteDraft.subheadEn}
                    onChange={(e) =>
                      setSiteDraft({ ...siteDraft, subheadEn: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-3 text-sm"
                  />
                </div>
              </div>

              {/* Hero Image Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#0F1B2B]">
                  Ảnh nền toàn cảnh Hero
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-[#E3E7EE] bg-[#0A2239]">
                    <ResilientImage
                      src={siteDraft.heroImage}
                      alt="Hero preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <input
                    type="text"
                    value={siteDraft.heroImage}
                    onChange={(e) =>
                      setSiteDraft({ ...siteDraft, heroImage: e.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_GALLERY_IMAGES.map((img) => (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() =>
                        setSiteDraft({ ...siteDraft, heroImage: img.url })
                      }
                      className={`min-h-[32px] rounded-md border px-2.5 text-xs font-medium ${
                        siteDraft.heroImage === img.url
                          ? 'border-[#0A2239] bg-[#0A2239] text-white'
                          : 'border-[#E3E7EE] bg-[#F7F8FA] text-[#526071]'
                      }`}
                    >
                      {img.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 Stats Bar Editor */}
              <div className="space-y-3 border-t border-[#E3E7EE] pt-5">
                <h3 className="font-display text-sm font-bold text-[#0A2239]">
                  4 Chỉ số nổi bật dưới Hero
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {siteDraft.stats.map((st, idx) => (
                    <div
                      key={idx}
                      className="space-y-2 rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] p-3.5"
                    >
                      <input
                        type="text"
                        value={st.value}
                        placeholder="Giá trị (VD: 23)"
                        onChange={(e) =>
                          setSiteDraft({
                            ...siteDraft,
                            stats: siteDraft.stats.map((s, i) =>
                              i === idx ? { ...s, value: e.target.value } : s
                            ),
                          })
                        }
                        className="h-9 w-full rounded-md border border-[#D4DBE5] bg-white px-2.5 font-mono text-sm font-bold"
                      />
                      <input
                        type="text"
                        value={st.labelVi}
                        placeholder="Nhãn Tiếng Việt"
                        onChange={(e) =>
                          setSiteDraft({
                            ...siteDraft,
                            stats: siteDraft.stats.map((s, i) =>
                              i === idx ? { ...s, labelVi: e.target.value } : s
                            ),
                          })
                        }
                        className="h-9 w-full rounded-md border border-[#D4DBE5] bg-white px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        value={st.labelEn}
                        placeholder="English Label"
                        onChange={(e) =>
                          setSiteDraft({
                            ...siteDraft,
                            stats: siteDraft.stats.map((s, i) =>
                              i === idx ? { ...s, labelEn: e.target.value } : s
                            ),
                          })
                        }
                        className="h-9 w-full rounded-md border border-[#D4DBE5] bg-white px-2.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Visitor Center & Footer */}
              <div className="grid grid-cols-1 gap-4 border-t border-[#E3E7EE] pt-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Địa chỉ Trung tâm Du khách
                  </label>
                  <input
                    type="text"
                    value={siteDraft.visitorCenterAddress}
                    onChange={(e) =>
                      setSiteDraft({
                        ...siteDraft,
                        visitorCenterAddress: e.target.value,
                      })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Giờ mở cửa Trung tâm Du khách
                  </label>
                  <input
                    type="text"
                    value={siteDraft.visitorCenterHours}
                    onChange={(e) =>
                      setSiteDraft({
                        ...siteDraft,
                        visitorCenterHours: e.target.value,
                      })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Giới thiệu Chân trang (VI)
                  </label>
                  <textarea
                    rows={2}
                    value={siteDraft.footerAboutVi}
                    onChange={(e) =>
                      setSiteDraft({
                        ...siteDraft,
                        footerAboutVi: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F1B2B]">
                    Footer About (EN)
                  </label>
                  <textarea
                    rows={2}
                    value={siteDraft.footerAboutEn}
                    onChange={(e) =>
                      setSiteDraft({
                        ...siteDraft,
                        footerAboutEn: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-[#D4DBE5] p-2.5 text-sm"
                  />
                </div>
              </div>
            </form>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 3: EXPERIENCES CRUD */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'experiences' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lọc trải nghiệm..."
                    className="h-10 w-full rounded-lg border border-[#E3E7EE] bg-white pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEditingExp(null)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#C8102E] px-4 text-sm font-semibold text-white hover:bg-[#A10C24]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm Trải nghiệm</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-xs font-semibold text-[#526071]">
                    <tr>
                      <th className="px-4 py-3">Trải nghiệm</th>
                      <th className="px-4 py-3">Danh mục · Khu vực</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thứ tự</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EE]">
                    {filteredExperiences.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-sm text-[#526071]"
                        >
                          Chưa có trải nghiệm nào. Nhấn &quot;Thêm Trải nghiệm&quot; hoặc khởi tạo dữ liệu mẫu.
                        </td>
                      </tr>
                    ) : (
                      filteredExperiences.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F7F8FA]/70">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#0A2239]">
                              {item.title.vi}
                            </p>
                            <p className="text-xs text-[#526071]">
                              {item.title.en}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#526071]">
                            {item.category} · {item.district}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={async () => {
                                await saveExperience(
                                  item,
                                  { ...item, published: !item.published },
                                  user.uid
                                );
                                showNotice('Đã cập nhật trạng thái xuất bản.');
                              }}
                              className={`text-xs font-semibold ${
                                item.published
                                  ? 'text-[#16A34A]'
                                  : 'text-[#D97706]'
                              }`}
                            >
                              {item.published ? 'Công khai' : 'Bản nháp'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-[#526071]">
                            {item.sortOrder}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingExp(item)}
                                aria-label="Sửa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#0A2239] hover:bg-[#F7F8FA]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteExperience(item.id);
                                  showNotice('Đã xóa trải nghiệm.');
                                }}
                                aria-label="Xóa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 4: NEIGHBORHOODS CRUD */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'neighborhoods' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lọc khu phố..."
                    className="h-10 w-full rounded-lg border border-[#E3E7EE] bg-white pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEditingNb(null)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#C8102E] px-4 text-sm font-semibold text-white hover:bg-[#A10C24]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm Khu phố</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-xs font-semibold text-[#526071]">
                    <tr>
                      <th className="px-4 py-3">Khu phố</th>
                      <th className="px-4 py-3">Tuyến tàu MBTA</th>
                      <th className="px-4 py-3 text-right">Walk Score</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EE]">
                    {filteredNeighborhoods.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-sm text-[#526071]"
                        >
                          Chưa có khu phố nào trong cơ sở dữ liệu.
                        </td>
                      </tr>
                    ) : (
                      filteredNeighborhoods.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F7F8FA]/70">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#0A2239]">
                              {item.name}
                            </p>
                            <p className="text-xs text-[#526071]">
                              {item.tagline.vi}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#526071]">
                            {item.transit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-[#0A2239]">
                            {item.walkScore}/100
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={async () => {
                                await saveNeighborhood(
                                  item,
                                  { ...item, published: !item.published },
                                  user.uid
                                );
                                showNotice('Đã cập nhật trạng thái khu phố.');
                              }}
                              className={`text-xs font-semibold ${
                                item.published
                                  ? 'text-[#16A34A]'
                                  : 'text-[#D97706]'
                              }`}
                            >
                              {item.published ? 'Công khai' : 'Bản nháp'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingNb(item)}
                                aria-label="Sửa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#0A2239] hover:bg-[#F7F8FA]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteNeighborhood(item.id);
                                  showNotice('Đã xóa khu phố.');
                                }}
                                aria-label="Xóa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 5: EVENTS CRUD */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lọc sự kiện..."
                    className="h-10 w-full rounded-lg border border-[#E3E7EE] bg-white pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEvt(null)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#C8102E] px-4 text-sm font-semibold text-white hover:bg-[#A10C24]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm Sự kiện</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-xs font-semibold text-[#526071]">
                    <tr>
                      <th className="px-4 py-3">Ngày</th>
                      <th className="px-4 py-3">Sự kiện & Địa điểm</th>
                      <th className="px-4 py-3">Thể loại</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EE]">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-sm text-[#526071]"
                        >
                          Chưa có sự kiện nào trong cơ sở dữ liệu.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F7F8FA]/70">
                          <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums text-[#0A2239] whitespace-nowrap">
                            {item.dayNum} {item.monthLabel.vi}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#0A2239]">
                              {item.title.vi}
                            </p>
                            <p className="text-xs text-[#526071]">
                              {item.venue} · {item.time}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#526071]">
                            {item.category} · {item.timeframe}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={async () => {
                                await saveEvent(
                                  item,
                                  { ...item, published: !item.published },
                                  user.uid
                                );
                                showNotice('Đã cập nhật trạng thái sự kiện.');
                              }}
                              className={`text-xs font-semibold ${
                                item.published
                                  ? 'text-[#16A34A]'
                                  : 'text-[#D97706]'
                              }`}
                            >
                              {item.published ? 'Công khai' : 'Bản nháp'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingEvt(item)}
                                aria-label="Sửa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#0A2239] hover:bg-[#F7F8FA]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteEvent(item.id);
                                  showNotice('Đã xóa sự kiện.');
                                }}
                                aria-label="Xóa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 6: HOTELS CRUD */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'hotels' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lọc khách sạn..."
                    className="h-10 w-full rounded-lg border border-[#E3E7EE] bg-white pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEditingHtl(null)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#C8102E] px-4 text-sm font-semibold text-white hover:bg-[#A10C24]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm Khách sạn</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-xs font-semibold text-[#526071]">
                    <tr>
                      <th className="px-4 py-3">Khách sạn</th>
                      <th className="px-4 py-3">Khu vực</th>
                      <th className="px-4 py-3 text-right">Giá / đêm</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EE]">
                    {filteredHotels.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-sm text-[#526071]"
                        >
                          Chưa có khách sạn nào trong cơ sở dữ liệu.
                        </td>
                      </tr>
                    ) : (
                      filteredHotels.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F7F8FA]/70">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#0A2239]">
                              {item.name}
                            </p>
                            <p className="text-xs text-[#526071]">
                              {item.style.vi} · ★ {item.rating}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#526071]">
                            {item.district}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-[#0A2239]">
                            ${item.rateUsd}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={async () => {
                                await saveHotel(
                                  item,
                                  { ...item, published: !item.published },
                                  user.uid
                                );
                                showNotice('Đã cập nhật trạng thái khách sạn.');
                              }}
                              className={`text-xs font-semibold ${
                                item.published
                                  ? 'text-[#16A34A]'
                                  : 'text-[#D97706]'
                              }`}
                            >
                              {item.published ? 'Công khai' : 'Bản nháp'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setEditingHtl(item)}
                                aria-label="Sửa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#0A2239] hover:bg-[#F7F8FA]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteHotel(item.id);
                                  showNotice('Đã xóa khách sạn.');
                                }}
                                aria-label="Xóa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* TAB 7: LEADS INBOX (GUIDE LEADS & MEETING RFPS) */}
          {/* --------------------------------------------------------------- */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1 rounded-xl border border-[#E3E7EE] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setLeadsSubTab('guide')}
                  className={`min-h-[38px] rounded-lg px-4 text-sm font-semibold transition-colors ${
                    leadsSubTab === 'guide'
                      ? 'bg-[#0A2239] text-white'
                      : 'text-[#526071] hover:text-[#0A2239]'
                  }`}
                >
                  Cẩm nang & Bản tin ({guideLeads.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLeadsSubTab('rfp')}
                  className={`min-h-[38px] rounded-lg px-4 text-sm font-semibold transition-colors ${
                    leadsSubTab === 'rfp'
                      ? 'bg-[#0A2239] text-white'
                      : 'text-[#526071] hover:text-[#0A2239]'
                  }`}
                >
                  Yêu cầu Hội nghị RFP ({meetingRfps.length})
                </button>
              </div>

              {leadsSubTab === 'guide' ? (
                <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-xs font-semibold text-[#526071]">
                      <tr>
                        <th className="px-4 py-3">Email khách hàng</th>
                        <th className="px-4 py-3">Nguồn đăng ký</th>
                        <th className="px-4 py-3">Ngôn ngữ</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E7EE]">
                      {guideLeads.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-10 text-center text-sm text-[#526071]"
                          >
                            Chưa có lượt đăng ký Cẩm nang hoặc Bản tin nào từ trang công khai.
                          </td>
                        </tr>
                      ) : (
                        guideLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-[#F7F8FA]/70">
                            <td className="px-4 py-3 font-mono text-xs font-medium text-[#0A2239]">
                              {lead.email}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#526071]">
                              {lead.source === 'visitor_guide'
                                ? 'Cẩm nang Du lịch'
                                : 'Bản tin Footer'}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[#526071]">
                              {lead.lang.toUpperCase()}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={lead.status}
                                onChange={async (e) => {
                                  await updateGuideLeadStatus(
                                    lead.id,
                                    e.target.value as
                                      | 'new'
                                      | 'contacted'
                                      | 'archived'
                                  );
                                  showNotice('Đã cập nhật trạng thái.');
                                }}
                                className="h-8 rounded-md border border-[#D4DBE5] bg-white px-2 text-xs font-semibold text-[#0F1B2B]"
                              >
                                <option value="new">Mới</option>
                                <option value="contacted">Đã gửi / Liên hệ</option>
                                <option value="archived">Lưu trữ</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteGuideLead(lead.id);
                                  showNotice('Đã xóa bản ghi.');
                                }}
                                aria-label="Xóa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-xs font-semibold text-[#526071]">
                      <tr>
                        <th className="px-4 py-3">Tổ chức & Liên hệ</th>
                        <th className="px-4 py-3">Quy mô · Thời gian</th>
                        <th className="px-4 py-3">Ghi chú</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3E7EE]">
                      {meetingRfps.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-10 text-center text-sm text-[#526071]"
                          >
                            Chưa có yêu cầu tổ chức Hội nghị (RFP) nào được gửi từ trang web.
                          </td>
                        </tr>
                      ) : (
                        meetingRfps.map((rfp) => (
                          <tr key={rfp.id} className="hover:bg-[#F7F8FA]/70">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[#0A2239]">
                                {rfp.organization}
                              </p>
                              <p className="font-mono text-xs text-[#526071]">
                                {rfp.email}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs text-[#526071] whitespace-nowrap">
                              {rfp.guests} · {rfp.timeframe}
                            </td>
                            <td className="max-w-xs px-4 py-3 text-xs text-[#526071]">
                              {rfp.notes || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={rfp.status}
                                onChange={async (e) => {
                                  await updateMeetingRfpStatus(
                                    rfp.id,
                                    e.target.value as
                                      | 'new'
                                      | 'reviewing'
                                      | 'responded'
                                      | 'archived'
                                  );
                                  showNotice('Đã cập nhật trạng thái RFP.');
                                }}
                                className="h-8 rounded-md border border-[#D4DBE5] bg-white px-2 text-xs font-semibold text-[#0F1B2B]"
                              >
                                <option value="new">Mới</option>
                                <option value="reviewing">Đang khảo sát</option>
                                <option value="responded">Đã phản hồi</option>
                                <option value="archived">Lưu trữ</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteMeetingRfp(rfp.id);
                                  showNotice('Đã xóa yêu cầu RFP.');
                                }}
                                aria-label="Xóa"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: ADMINS (Super Admin Only) */}
          {activeTab === 'admins' && isSuperAdmin && (
            <div className="space-y-6">
              <div className="rounded-xl border border-[#E3E7EE] bg-white p-6">
                <h2 className="font-display text-base font-bold text-[#0A2239]">
                  Cấp quyền quản trị viên mới
                </h2>
                <p className="mt-1 text-sm text-[#526071]">
                  Yêu cầu cộng tác viên mở trang <code className="font-mono text-xs text-[#0A2239]">#admin</code> và đăng nhập bằng Google để lấy <strong>Mã UID</strong>, sau đó nhập thông tin bên dưới để cấp quyền.
                </p>

                <form
                  onSubmit={handleAddAdmin}
                  className="mt-5 grid gap-4 md:grid-cols-2"
                >
                  <div>
                    <label className="block text-xs font-semibold text-[#526071]">
                      Firebase UID *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAdminUid}
                      onChange={(e) => setNewAdminUid(e.target.value)}
                      placeholder="VD: x8K2mPq9ZrT1aBcDeFgHiJkL"
                      className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 font-mono text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#526071]">
                      Email Google *
                    </label>
                    <input
                      type="email"
                      required
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="nhanvien@gmail.com"
                      className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#526071]">
                      Tên hiển thị *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAdminName}
                      onChange={(e) => setNewAdminName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DBE5] px-3 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#526071]">
                      Vai trò
                    </label>
                    <select
                      value={newAdminRole}
                      onChange={(e) =>
                        setNewAdminRole(e.target.value as 'admin' | 'editor')
                      }
                      className="mt-1.5 h-10 w-full rounded-lg border border-[#D4DBE5] bg-white px-3 text-sm font-medium text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                    >
                      <option value="admin">Quản trị viên (Admin)</option>
                      <option value="editor">Biên tập viên (Editor)</option>
                    </select>
                  </div>

                  {adminFormError && (
                    <p
                      role="alert"
                      className="md:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-[#C8102E]"
                    >
                      {adminFormError}
                    </p>
                  )}

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0A2239] px-5 text-sm font-semibold text-white hover:bg-[#133454] disabled:opacity-60"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Thêm quản trị viên</span>
                    </button>
                  </div>
                </form>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-xs font-semibold text-[#526071]">
                    <tr>
                      <th className="px-4 py-3">Tên hiển thị</th>
                      <th className="px-4 py-3">Email Google</th>
                      <th className="px-4 py-3">Firebase UID</th>
                      <th className="px-4 py-3">Vai trò</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EE]">
                    <tr className="bg-[#FAFBFC]">
                      <td className="px-4 py-3 font-semibold text-[#0A2239]">
                        {user.displayName || 'Chủ sở hữu hệ thống'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#0F1B2B]">
                        {BOOTSTRAPPED_ADMIN_EMAIL}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#526071]">
                        {user.uid}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-[#0A2239]">
                        Super Admin
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-[#526071]">
                        Mặc định
                      </td>
                    </tr>
                    {adminUsers.map((adm) => (
                      <tr key={adm.uid} className="hover:bg-[#F7F8FA]/60">
                        <td className="px-4 py-3 font-semibold text-[#0A2239]">
                          {adm.displayName}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#0F1B2B]">
                          {adm.email}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#526071]">
                          {adm.uid}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#0F1B2B]">
                          {adm.role === 'admin' ? 'Admin' : 'Editor'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {adm.uid !== user.uid && (
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteAdminUser(adm.uid);
                                showNotice(
                                  `Đã thu hồi quyền quản trị của ${adm.email}.`
                                );
                              }}
                              aria-label="Thu hồi quyền"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#526071] hover:bg-red-50 hover:text-[#C8102E]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Editors */}
      {editingExp !== undefined && (
        <ExperienceEditorModal
          initial={editingExp}
          nextOrder={experiences.length + 1}
          saving={busy}
          onClose={() => setEditingExp(undefined)}
          onSave={async (draft) => {
            setBusy(true);
            try {
              await saveExperience(editingExp, draft, user.uid);
              setEditingExp(undefined);
              showNotice('Đã lưu Trải nghiệm lên Firestore.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {editingNb !== undefined && (
        <NeighborhoodEditorModal
          initial={editingNb}
          nextOrder={neighborhoods.length + 1}
          saving={busy}
          onClose={() => setEditingNb(undefined)}
          onSave={async (draft) => {
            setBusy(true);
            try {
              await saveNeighborhood(editingNb, draft, user.uid);
              setEditingNb(undefined);
              showNotice('Đã lưu Khu phố lên Firestore.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {editingEvt !== undefined && (
        <EventEditorModal
          initial={editingEvt}
          nextOrder={events.length + 1}
          saving={busy}
          onClose={() => setEditingEvt(undefined)}
          onSave={async (draft) => {
            setBusy(true);
            try {
              await saveEvent(editingEvt, draft, user.uid);
              setEditingEvt(undefined);
              showNotice('Đã lưu Sự kiện lên Firestore.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {editingHtl !== undefined && (
        <HotelEditorModal
          initial={editingHtl}
          nextOrder={hotels.length + 1}
          saving={busy}
          onClose={() => setEditingHtl(undefined)}
          onSave={async (draft) => {
            setBusy(true);
            try {
              await saveHotel(editingHtl, draft, user.uid);
              setEditingHtl(undefined);
              showNotice('Đã lưu Khách sạn lên Firestore.');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

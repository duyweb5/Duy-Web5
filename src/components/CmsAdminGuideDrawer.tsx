import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  ListChecks,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import {
  AdminRoleKey,
  GUIDE_TOPICS,
  GuideModuleTabId,
  ONBOARDING_CHECKLIST,
  ROLE_DEFINITIONS,
  ROLE_MATRIX_ROWS,
} from '../data/adminGuideData';

interface CmsAdminGuideDrawerProps {
  open: boolean;
  activeTab: GuideModuleTabId;
  currentUserRole: 'superAdmin' | 'admin' | 'editor';
  onClose: () => void;
  onNavigateTab: (tab: GuideModuleTabId) => void;
}

const ROLE_LABELS: Record<AdminRoleKey, string> = {
  superAdmin: 'Super Admin',
  admin: 'Admin',
  editor: 'Editor',
  member: 'Thành viên',
};

const ONBOARDING_STORAGE_KEY = 'meet-boston-cms-onboarding-v1';

export function CmsAdminGuideDrawer({
  open,
  activeTab,
  currentUserRole,
  onClose,
  onNavigateTab,
}: CmsAdminGuideDrawerProps) {
  const [expandedLeft, setExpandedLeft] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRoleKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rolesSectionOpen, setRolesSectionOpen] = useState(true);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [openTopicIds, setOpenTopicIds] = useState<string[]>(['topic-overview']);
  const [checkedOnboardingIds, setCheckedOnboardingIds] = useState<string[]>(
    () => {
      try {
        const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // Ignore storage read errors
      }
      return [];
    }
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify(checkedOnboardingIds)
      );
    } catch {
      // Ignore storage write errors
    }
  }, [checkedOnboardingIds]);

  const toggleOnboardingStep = (id: string) => {
    setCheckedOnboardingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const visibleOnboardingSteps = useMemo(
    () =>
      ONBOARDING_CHECKLIST.filter(
        (step) => step.tabId !== 'admins' || currentUserRole === 'superAdmin'
      ),
    [currentUserRole]
  );

  const completedOnboardingCount = visibleOnboardingSteps.filter((s) =>
    checkedOnboardingIds.includes(s.id)
  ).length;

  // Automatically expand the handbook topic matching the currently active CMS tab
  useEffect(() => {
    if (!open) return;
    const matched = GUIDE_TOPICS.find((t) => t.tabId === activeTab);
    if (matched) {
      setOpenTopicIds((prev) =>
        prev.includes(matched.id) ? prev : [matched.id, ...prev]
      );
    }
  }, [open, activeTab]);

  // Close drawer with Escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return GUIDE_TOPICS.filter((topic) => {
      const roleMatch =
        roleFilter === 'all' || topic.roles.includes(roleFilter);
      if (!roleMatch) return false;
      if (!q) return true;
      const haystack = [
        topic.title,
        topic.subtitle,
        topic.purpose,
        ...topic.steps,
        ...topic.tips,
        ...topic.roles.map((r) => ROLE_LABELS[r]),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [roleFilter, searchQuery]);

  const selectedRoleDef = useMemo(
    () =>
      roleFilter === 'all'
        ? null
        : ROLE_DEFINITIONS.find((r) => r.key === roleFilter) || null,
    [roleFilter]
  );

  const toggleTopic = (id: string) => {
    setOpenTopicIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setRolesSectionOpen(true);
    setOnboardingOpen(true);
    setOpenTopicIds(filteredTopics.map((t) => t.id));
  };

  const collapseAll = () => {
    setRolesSectionOpen(false);
    setOnboardingOpen(false);
    setOpenTopicIds([]);
  };

  if (!open) return null;

  return (
    <>
      {/* Subtle backdrop on mobile or when expanded left on smaller viewports */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#0A2239]/25 transition-opacity ${
          expandedLeft ? 'block' : 'lg:hidden'
        }`}
      />

      {/* Right-docked Expandable/Collapsible Handbook Panel */}
      <aside
        role="dialog"
        aria-modal="false"
        aria-label="Cẩm nang hướng dẫn quản trị CMS"
        className={`fixed inset-y-0 right-0 z-50 flex flex-col border-l border-[#E3E7EE] bg-white shadow-2xl transition-[width] duration-200 ease-out ${
          expandedLeft
            ? 'w-full sm:w-[760px] lg:w-[880px]'
            : 'w-full sm:w-[460px]'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#E3E7EE] bg-[#0A2239] px-5 py-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <BookOpen className="h-4.5 w-4.5 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-display text-base font-extrabold tracking-tight text-white">
                Cẩm nang Quản trị CMS
              </h2>
              <p className="truncate text-xs text-white/75">
                Vai trò của bạn:{' '}
                <span className="font-semibold text-white">
                  {ROLE_LABELS[currentUserRole]}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setExpandedLeft((v) => !v)}
              title={expandedLeft ? 'Thu gọn sang phải' : 'Mở rộng sang trái'}
              className="hidden min-h-[34px] items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 sm:inline-flex"
            >
              {expandedLeft ? (
                <>
                  <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Thu gọn</span>
                </>
              ) : (
                <>
                  <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Mở rộng</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cẩm nang"
              className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Sticky Search & Role Filter Strip */}
        <div className="space-y-3 border-b border-[#E3E7EE] bg-[#F7F8FA] px-5 py-3.5">
          {/* Search Input */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#526071]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm hướng dẫn (VD: thêm sự kiện, UID, RFP, Hero, ẩn bài)..."
              className="h-9 w-full rounded-lg border border-[#D4DBE5] bg-white pl-9 pr-8 text-xs text-[#0F1B2B] placeholder:text-[#526071]/70 focus:border-[#0A2239] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#526071] hover:text-[#0A2239]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Role Segmented Filter + Expand/Collapse All */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="Lọc hướng dẫn theo vai trò"
            >
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'superAdmin', label: 'Super Admin' },
                  { id: 'admin', label: 'Admin' },
                  { id: 'editor', label: 'Editor' },
                  { id: 'member', label: 'Thành viên' },
                ] as { id: 'all' | AdminRoleKey; label: string }[]
              ).map((item) => {
                const active = roleFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRoleFilter(item.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-[#0A2239] text-white'
                        : 'border border-[#E3E7EE] bg-white text-[#526071] hover:text-[#0A2239]'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <button
                type="button"
                onClick={expandAll}
                className="text-[#0066B2] hover:underline"
              >
                Mở tất cả
              </button>
              <span className="text-[#D4DBE5]" aria-hidden="true">
                |
              </span>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[#526071] hover:text-[#0A2239] hover:underline"
              >
                Thu gọn tất cả
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Handbook Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {/* Highlighted Role Detail Card when filtering by a specific role */}
            {selectedRoleDef && (
              <div className="rounded-xl border border-[#0A2239]/20 bg-[#F7F8FA] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3
                    className={`font-display text-sm font-extrabold ${selectedRoleDef.accentClass}`}
                  >
                    Vai trò: {selectedRoleDef.label} —{' '}
                    {selectedRoleDef.shortTitle}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-[#526071]">
                  {selectedRoleDef.summary}
                </p>

                <div
                  className={`mt-3 grid gap-3 ${
                    expandedLeft ? 'sm:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  <div className="rounded-lg border border-[#E3E7EE] bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#16A34A]">
                      Quyền được phép
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs text-[#0F1B2B]">
                      {selectedRoleDef.canDo.map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16A34A]" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-[#E3E7EE] bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#C8102E]">
                      Giới hạn & Bảo vệ
                    </p>
                    <ul className="mt-2 space-y-1.5 text-xs text-[#0F1B2B]">
                      {selectedRoleDef.cannotDo.map((line, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C8102E]" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Collapsible Section 0: Complete RBAC Role Matrix */}
            {!searchQuery.trim() && (
              <section className="overflow-hidden rounded-xl border border-[#E3E7EE] bg-white">
                <button
                  type="button"
                  onClick={() => setRolesSectionOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#F7F8FA]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ShieldCheck
                      className="h-4.5 w-4.5 shrink-0 text-[#C8102E]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-bold text-[#0A2239]">
                        Phân quyền vai trò: Super Admin · Admin · Editor · Thành viên
                      </h3>
                      <p className="truncate text-xs text-[#526071]">
                        Bảng đối chiếu nhanh quyền thao tác và bảo mật của từng nhóm tài khoản
                      </p>
                    </div>
                  </div>
                  {rolesSectionOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#526071]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#526071]" />
                  )}
                </button>

                {rolesSectionOpen && (
                  <div className="border-t border-[#E3E7EE] px-4 py-3.5">
                    {/* Role Summary Cards */}
                    <div
                      className={`grid gap-2.5 ${
                        expandedLeft ? 'sm:grid-cols-2' : 'grid-cols-1'
                      }`}
                    >
                      {ROLE_DEFINITIONS.map((role) => {
                        const isMine = role.key === currentUserRole;
                        return (
                          <div
                            key={role.key}
                            className={`rounded-lg border p-3 ${
                              isMine
                                ? 'border-[#0A2239] bg-[#F7F8FA]'
                                : 'border-[#E3E7EE] bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-display text-xs font-extrabold ${role.accentClass}`}
                              >
                                {role.label}
                              </span>
                              <span className="text-[11px] font-medium text-[#526071]">
                                {isMine ? 'Tài khoản của bạn' : role.shortTitle}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-[#526071]">
                              {role.summary}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Permission Matrix Table */}
                    <div className="mt-3.5 overflow-x-auto rounded-lg border border-[#E3E7EE]">
                      <table className="w-full min-w-[420px] text-left text-xs">
                        <thead className="border-b border-[#E3E7EE] bg-[#F7F8FA] text-[11px] font-bold text-[#0A2239]">
                          <tr>
                            <th className="px-3 py-2">Chức năng / Khu vực</th>
                            <th className="px-2.5 py-2 text-center">Super Admin</th>
                            <th className="px-2.5 py-2 text-center">Admin</th>
                            <th className="px-2.5 py-2 text-center">Editor</th>
                            <th className="px-2.5 py-2 text-center">Thành viên</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E3E7EE]">
                          {ROLE_MATRIX_ROWS.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#F7F8FA]/60">
                              <td className="px-3 py-2 font-medium text-[#0F1B2B]">
                                {row.capability}
                              </td>
                              <td className="px-2.5 py-2 text-center font-semibold text-[#16A34A]">
                                {row.superAdmin}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-center font-medium ${
                                  row.admin === 'Không'
                                    ? 'text-[#526071]/70'
                                    : 'text-[#0A2239]'
                                }`}
                              >
                                {row.admin}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-center font-medium ${
                                  row.editor === 'Không'
                                    ? 'text-[#526071]/70'
                                    : 'text-[#0066B2]'
                                }`}
                              >
                                {row.editor}
                              </td>
                              <td
                                className={`px-2.5 py-2 text-center font-medium ${
                                  row.member === 'Bị chặn' ||
                                  row.member === 'Không'
                                    ? 'text-[#C8102E]'
                                    : 'text-[#16A34A]'
                                }`}
                              >
                                {row.member}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Collapsible Section 0.5: Interactive Onboarding Checklist */}
            {!searchQuery.trim() && (
              <section className="overflow-hidden rounded-xl border border-[#E3E7EE] bg-white">
                <button
                  type="button"
                  onClick={() => setOnboardingOpen((v) => !v)}
                  aria-expanded={onboardingOpen}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#F7F8FA]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ListChecks
                      className="h-4.5 w-4.5 shrink-0 text-[#0066B2]"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-sm font-bold text-[#0A2239]">
                          Checklist khởi động nhanh cho người mới
                        </h3>
                        <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-[#0066B2]">
                          {completedOnboardingCount}/
                          {visibleOnboardingSteps.length}
                        </span>
                      </div>
                      <p className="truncate text-xs text-[#526071]">
                        Đánh dấu từng bước khi làm quen hệ thống CMS Meet Boston
                      </p>
                    </div>
                  </div>
                  {onboardingOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#526071]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#526071]" />
                  )}
                </button>

                {onboardingOpen && (
                  <div className="border-t border-[#E3E7EE] px-4 py-3.5">
                    <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E3E7EE]">
                      <div
                        className="h-full bg-[#16A34A] transition-all duration-200"
                        style={{
                          width: `${
                            visibleOnboardingSteps.length > 0
                              ? Math.round(
                                  (completedOnboardingCount /
                                    visibleOnboardingSteps.length) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <ul className="space-y-2">
                      {visibleOnboardingSteps.map((step) => {
                        const done = checkedOnboardingIds.includes(step.id);
                        return (
                          <li
                            key={step.id}
                            className="flex items-start justify-between gap-3 rounded-lg border border-[#E3E7EE] bg-[#F7F8FA]/60 p-2.5"
                          >
                            <label className="flex cursor-pointer items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={done}
                                onChange={() => toggleOnboardingStep(step.id)}
                                className="mt-0.5 h-4 w-4 rounded border-[#D4DBE5] text-[#0A2239] focus:ring-[#0A2239]"
                              />
                              <div>
                                <p
                                  className={`text-xs font-semibold ${
                                    done
                                      ? 'text-[#526071] line-through'
                                      : 'text-[#0A2239]'
                                  }`}
                                >
                                  {step.title}
                                </p>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-[#526071]">
                                  {step.detail}
                                </p>
                              </div>
                            </label>
                            <button
                              type="button"
                              onClick={() => onNavigateTab(step.tabId)}
                              className="shrink-0 rounded-md border border-[#D4DBE5] bg-white px-2 py-1 text-[11px] font-semibold text-[#0A2239] hover:bg-[#0A2239] hover:text-white"
                            >
                              Mở tab
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Collapsible Module & Workflow Accordions */}
            {filteredTopics.length === 0 ? (
              <div className="rounded-xl border border-[#E3E7EE] bg-[#F7F8FA] p-6 text-center">
                <p className="text-sm font-semibold text-[#0A2239]">
                  Không tìm thấy mục hướng dẫn phù hợp
                </p>
                <p className="mt-1 text-xs text-[#526071]">
                  Thử xóa bộ lọc vai trò hoặc nhập từ khóa ngắn hơn (VD: "sự kiện", "khách sạn", "UID", "RFP").
                </p>
              </div>
            ) : (
              filteredTopics.map((topic) => {
                const isOpen = openTopicIds.includes(topic.id);
                const isCurrentModule = topic.tabId === activeTab;
                const canJumpToTab =
                  Boolean(topic.tabId) &&
                  (topic.tabId !== 'admins' || currentUserRole === 'superAdmin');

                return (
                  <section
                    key={topic.id}
                    className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                      isCurrentModule
                        ? 'border-[#0A2239]/50'
                        : 'border-[#E3E7EE]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#F7F8FA]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-sm font-bold text-[#0A2239]">
                            {topic.title}
                          </h3>
                          {isCurrentModule && (
                            <span className="text-[11px] font-bold text-[#C8102E]">
                              · Đang xem trang này
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-[#526071]">
                          {topic.subtitle}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-[#526071]">
                          Vai trò:{' '}
                          <span className="text-[#0F1B2B]">
                            {topic.roles.map((r) => ROLE_LABELS[r]).join(' · ')}
                          </span>
                        </p>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[#526071]" />
                      ) : (
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#526071]" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="space-y-4 border-t border-[#E3E7EE] px-4 py-4">
                        {/* 1. Purpose */}
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#526071]">
                            Chức năng chính
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[#0F1B2B]">
                            {topic.purpose}
                          </p>
                        </div>

                        {/* 2. Step-by-step instructions */}
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#0A2239]">
                            Các bước thực hiện
                          </p>
                          <ol className="mt-2 space-y-2">
                            {topic.steps.map((step, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2.5 text-xs leading-relaxed text-[#0F1B2B]"
                              >
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#0A2239] font-mono text-[11px] font-bold tabular-nums text-white">
                                  {idx + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* 3. Tips & Important notes */}
                        <div className="rounded-lg border border-[#E3E7EE] bg-[#F7F8FA] p-3">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0066B2]">
                            <Info className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Lưu ý & Mẹo vận hành</span>
                          </div>
                          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[#526071]">
                            {topic.tips.map((tip, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span
                                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0066B2]"
                                  aria-hidden="true"
                                />
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Quick Jump Action */}
                        {canJumpToTab && topic.tabId && !isCurrentModule && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => onNavigateTab(topic.tabId!)}
                              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[#0A2239] bg-white px-3 text-xs font-semibold text-[#0A2239] transition-colors hover:bg-[#0A2239] hover:text-white"
                            >
                              <span>Đi tới module này</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </div>

        {/* Footer Tip */}
        <div className="flex items-center justify-between border-t border-[#E3E7EE] bg-[#F7F8FA] px-5 py-3 text-[11px] text-[#526071]">
          <span>
            Nhấn <kbd className="rounded border border-[#D4DBE5] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#0A2239]">Esc</kbd> để đóng nhanh cẩm nang
          </span>
          <button
            type="button"
            onClick={() => setExpandedLeft((v) => !v)}
            className="hidden font-semibold text-[#0A2239] hover:underline sm:inline"
          >
            {expandedLeft ? 'Thu gọn khung đọc →' : '← Mở rộng khung đọc'}
          </button>
        </div>
      </aside>
    </>
  );
}

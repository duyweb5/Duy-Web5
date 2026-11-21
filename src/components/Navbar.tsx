import { useState } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { Language } from '../data/bostonData';
import { useSiteCopy } from '../lib/I18nContext';
import { PWAInstallButton } from './PWAInstallButton';

interface NavbarProps {
  lang: Language;
  savedCount: number;
  isVideosPage?: boolean;
  onNavigateHome?: (hash?: string) => void;
  onNavigateVideos?: () => void;
  onOpenItinerary: () => void;
  onOpenQuickSearch?: () => void;
}

export function Navbar({
  lang,
  savedCount,
  isVideosPage = false,
  onNavigateHome,
  onNavigateVideos,
  onOpenItinerary,
  onOpenQuickSearch,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useSiteCopy(lang).nav;

  const links = [
    { href: '#explore', label: t.explore, isVideos: false },
    { href: '#neighborhoods', label: t.neighborhoods, isVideos: false },
    { href: '#events', label: t.events, isVideos: false },
    { href: '#stay', label: t.stay, isVideos: false },
    { href: '#meetings', label: t.meetings, isVideos: false },
    { href: '/videos', label: t.videos, isVideos: true },
  ];

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    link: { href: string; isVideos: boolean }
  ) => {
    setMobileOpen(false);
    if (link.isVideos && onNavigateVideos) {
      e.preventDefault();
      onNavigateVideos();
      return;
    }
    if (!link.isVideos && isVideosPage && onNavigateHome) {
      e.preventDefault();
      onNavigateHome(link.href);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E3E7EE] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-6 px-6 lg:px-8">
        {/* Zone 1: Single text element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            if (isVideosPage && onNavigateHome) {
              e.preventDefault();
              onNavigateHome();
            }
          }}
          className="font-display text-xl font-extrabold tracking-tight text-[#0A2239] transition-colors hover:text-[#C8102E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C8102E] whitespace-nowrap shrink-0"
        >
          Meet Boston
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-6 md:flex"
        >
          {links.map((link) => {
            const active = link.isVideos && isVideosPage;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link)}
                className={`relative py-1 text-sm font-semibold transition-colors duration-150 after:absolute after:bottom-0 after:left-0 after:h-[2px] after:bg-[#C8102E] after:transition-all after:duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C8102E] whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-[#0A2239] after:w-full'
                    : 'text-[#0F1B2B]/80 hover:text-[#0A2239] after:w-0 hover:after:w-full'
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Quick Search + PWA Install + Primary Action CTA + Mobile Menu Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenQuickSearch && (
            <button
              type="button"
              onClick={onOpenQuickSearch}
              aria-label={lang === 'vi' ? 'Tìm kiếm toàn trang (Ctrl+K)' : 'Quick search (Ctrl+K)'}
              title={lang === 'vi' ? 'Tìm kiếm nhanh (Ctrl+K)' : 'Quick search (Ctrl+K)'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#0A2239] transition-colors hover:border-[#0A2239]/30 hover:bg-[#F7F8FA] focus-visible:outline-2 focus-visible:outline-[#C8102E]"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          <PWAInstallButton lang={lang} variant="navbar" />

          <button
            type="button"
            onClick={onOpenItinerary}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#C8102E] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#A10C24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2239] whitespace-nowrap shrink-0"
          >
            <span>{t.myTrip}</span>
            {savedCount > 0 && (
              <span className="font-mono text-xs font-medium tabular-nums opacity-95">
                ({savedCount})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? t.menuClose : t.menuOpen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#0A2239] transition-colors hover:bg-[#F7F8FA] focus-visible:outline-2 focus-visible:outline-[#C8102E] md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile off-canvas dropdown menu */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-[#E3E7EE] bg-white px-6 py-4 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => handleLinkClick(e, link)}
                  className="flex min-h-[44px] items-center text-base font-semibold text-[#0F1B2B] transition-colors hover:text-[#C8102E]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

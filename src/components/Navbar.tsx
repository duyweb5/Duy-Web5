import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { COPY, Language } from '../data/bostonData';

interface NavbarProps {
  lang: Language;
  savedCount: number;
  onOpenItinerary: () => void;
}

export function Navbar({ lang, savedCount, onOpenItinerary }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = COPY[lang].nav;

  const links = [
    { href: '#explore', label: t.explore },
    { href: '#neighborhoods', label: t.neighborhoods },
    { href: '#events', label: t.events },
    { href: '#stay', label: t.stay },
    { href: '#meetings', label: t.meetings },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#E3E7EE] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-8 px-6 lg:px-8">
        {/* Zone 1: Single text element Brand Wordmark */}
        <a
          href="#top"
          className="font-display text-xl font-extrabold tracking-tight text-[#0A2239] transition-colors hover:text-[#C8102E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C8102E] whitespace-nowrap shrink-0"
        >
          Meet Boston
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 md:flex"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative py-1 text-sm font-semibold text-[#0F1B2B]/80 transition-colors duration-150 hover:text-[#0A2239] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 after:bg-[#C8102E] after:transition-all after:duration-150 hover:after:w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C8102E] whitespace-nowrap shrink-0"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Single primary action CTA (desktop) + mobile menu toggle */}
        <div className="flex items-center gap-3 shrink-0">
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
                  onClick={() => setMobileOpen(false)}
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

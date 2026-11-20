import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { COPY, Language } from '../data/bostonData';
import {
  EMAIL_REGEX,
  SiteConfigData,
  submitGuideLead,
} from '../lib/cmsService';

interface FooterProps {
  lang: Language;
  siteConfig: SiteConfigData;
  onOpenItinerary: () => void;
  onOpenAdminCms: () => void;
}

export function Footer({
  lang,
  siteConfig,
  onOpenItinerary,
  onOpenAdminCms,
}: FooterProps) {
  const t = COPY[lang].footer;
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const aboutText =
    lang === 'vi' ? siteConfig.footerAboutVi : siteConfig.footerAboutEn;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
      return;
    }
    setSubmitting(true);
    try {
      await submitGuideLead(trimmed, 'newsletter', lang);
      setSubscribed(true);
      setEmail('');
    } catch {
      // Keep form available for retry
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-white/10 bg-[#071727] text-white">
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Brand & Official Visitor Center */}
          <div className="lg:col-span-4">
            <a
              href="#top"
              className="font-display text-2xl font-extrabold tracking-tight text-white"
            >
              Meet Boston
            </a>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
              {aboutText}
            </p>
            <div className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/75">
              <p className="font-semibold text-white">{t.visitorCenterTitle}</p>
              <p className="mt-1">{siteConfig.visitorCenterAddress}</p>
              <p className="mt-0.5 font-mono text-white/65 tabular-nums">
                {siteConfig.visitorCenterHours}
              </p>
            </div>
          </div>

          {/* Sitemap Columns */}
          <div className="grid grid-cols-2 gap-8 lg:col-span-4">
            {t.columns.map((col) => (
              <div key={col.heading}>
                <h3 className="font-display text-sm font-bold text-white">
                  {col.heading}
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-white/75">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {link.href === '#top' ? (
                        <button
                          type="button"
                          onClick={onOpenItinerary}
                          className="transition-colors hover:text-white"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <a
                          href={link.href}
                          className="transition-colors hover:text-white"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-4">
            <h3 className="font-display text-sm font-bold text-white">
              {t.newsletterTitle}
            </h3>
            <form onSubmit={handleSubscribe} className="mt-4 flex gap-2">
              <label htmlFor="footer-newsletter" className="sr-only">
                {t.newsletterPlaceholder}
              </label>
              <input
                id="footer-newsletter"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (subscribed) setSubscribed(false);
                }}
                placeholder={t.newsletterPlaceholder}
                className="h-11 min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3.5 text-sm text-white placeholder:text-white/55 focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-[#C8102E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#A10C24] disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {subscribed ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>{t.newsletterOk}</span>
                  </>
                ) : (
                  <span>{t.newsletterBtn}</span>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row sm:items-center">
          <p>{t.copyright}</p>
          <button
            type="button"
            onClick={onOpenAdminCms}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/75 transition-colors hover:text-white whitespace-nowrap shrink-0"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{lang === 'vi' ? 'Quản trị CMS' : 'CMS Admin'}</span>
          </button>
        </div>
      </div>
    </footer>
  );
}

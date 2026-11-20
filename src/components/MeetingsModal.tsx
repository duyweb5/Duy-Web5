import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { COPY, Language } from '../data/bostonData';
import { EMAIL_REGEX, submitMeetingRfp } from '../lib/cmsService';

interface MeetingsModalProps {
  lang: Language;
  open: boolean;
  onClose: () => void;
}

export function MeetingsModal({ lang, open, onClose }: MeetingsModalProps) {
  const t = COPY[lang].meetingsModal;
  const [org, setOrg] = useState('');
  const [email, setEmail] = useState('');
  const [guests, setGuests] = useState('150 - 500');
  const [timeframe, setTimeframe] = useState('Q2 2027');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org.trim() || !EMAIL_REGEX.test(email.trim())) {
      setError(t.error);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await submitMeetingRfp({
        organization: org.trim(),
        email: email.trim(),
        guests,
        timeframe,
        notes: notes.trim(),
      });
      setSubmitted(true);
    } catch {
      setError(
        lang === 'vi'
          ? 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại.'
          : 'Could not submit inquiry right now. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setError('');
    setOrg('');
    setEmail('');
    setNotes('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meetings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071727]/70 p-4 backdrop-blur-xs"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="meetings-modal-title"
              className="font-display text-xl font-extrabold text-[#0A2239] sm:text-2xl"
            >
              {submitted ? t.successTitle : t.title}
            </h3>
            {!submitted && (
              <p className="mt-1.5 text-sm leading-relaxed text-[#526071]">
                {t.subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label={COPY[lang].modal.close}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E3E7EE] text-[#0F1B2B] hover:bg-[#F7F8FA]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="mt-6">
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <p className="leading-relaxed">{t.successDesc}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-[42px] items-center rounded-lg bg-[#0A2239] px-5 py-2 text-sm font-semibold text-white hover:bg-[#133454]"
              >
                {t.done}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="rfp-org"
                className="block text-xs font-semibold text-[#0F1B2B]"
              >
                {t.orgLabel}
              </label>
              <input
                id="rfp-org"
                type="text"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
                placeholder={t.orgPlaceholder}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#D4DBE5] px-3.5 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="rfp-email"
                className="block text-xs font-semibold text-[#0F1B2B]"
              >
                {t.emailLabel}
              </label>
              <input
                id="rfp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="mt-1.5 h-11 w-full rounded-lg border border-[#D4DBE5] px-3.5 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="rfp-guests"
                  className="block text-xs font-semibold text-[#0F1B2B]"
                >
                  {t.guestsLabel}
                </label>
                <select
                  id="rfp-guests"
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#D4DBE5] bg-white px-3 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                >
                  <option value="50 - 150">50 – 150</option>
                  <option value="150 - 500">150 – 500</option>
                  <option value="500 - 2000">500 – 2,000</option>
                  <option value="2000+">2,000+</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="rfp-month"
                  className="block text-xs font-semibold text-[#0F1B2B]"
                >
                  {t.monthLabel}
                </label>
                <select
                  id="rfp-month"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#D4DBE5] bg-white px-3 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
                >
                  <option value="Q1 2027">Q1 2027</option>
                  <option value="Q2 2027">Q2 2027</option>
                  <option value="Q3 2027">Q3 2027</option>
                  <option value="Q4 2027">Q4 2027</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="rfp-notes"
                className="block text-xs font-semibold text-[#0F1B2B]"
              >
                {t.notesLabel}
              </label>
              <textarea
                id="rfp-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
                className="mt-1.5 w-full rounded-lg border border-[#D4DBE5] p-3.5 text-sm text-[#0F1B2B] focus:border-[#0A2239] focus:outline-none"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs font-semibold text-[#C8102E]">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-[42px] items-center rounded-lg border border-[#E3E7EE] px-4 py-2 text-sm font-semibold text-[#0F1B2B] hover:bg-[#F7F8FA]"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[42px] items-center rounded-lg bg-[#C8102E] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A10C24] disabled:opacity-60"
              >
                {submitting
                  ? lang === 'vi'
                    ? 'Đang gửi...'
                    : 'Submitting...'
                  : t.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

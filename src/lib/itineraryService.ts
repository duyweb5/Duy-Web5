import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Language, SavedItineraryItem } from '../data/bostonData';
import { db } from './firebase';

export interface SharedItineraryRecord {
  id: string;
  title: string;
  lang: Language;
  items: SavedItineraryItem[];
}

export interface SharedItineraryAdminItem extends SharedItineraryRecord {
  createdAt?: Timestamp | null;
}

interface FirestoreTripItemPayload {
  id: string;
  type: SavedItineraryItem['type'];
  day: 1 | 2 | 3;
  titleVi: string;
  titleEn: string;
  subtitleVi: string;
  subtitleEn: string;
  district: string;
  image: string;
}

function generateShareId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = 'bos-';
  for (let i = 0; i < arr.length; i++) {
    out += chars[arr[i] % chars.length];
  }
  return out;
}

function clamp(v: unknown, max: number, fallback = ''): string {
  const s = String(v ?? fallback).trim();
  return (s || fallback).slice(0, max);
}

/**
 * Persists an immutable trip snapshot to Firestore /sharedItineraries/{shareId}
 * and returns a domain-agnostic shareable URL (${origin}/trip/${shareId}).
 */
export async function createSharedItinerary(params: {
  items: SavedItineraryItem[];
  lang: Language;
  title?: string;
}): Promise<{ shareId: string; shareUrl: string }> {
  const validItems: FirestoreTripItemPayload[] = params.items
    .slice(0, 30)
    .map((item) => {
      const safeImage =
        item.image && item.image.length <= 1000 && !item.image.startsWith('data:')
          ? item.image
          : '';
      const validDay: 1 | 2 | 3 =
        item.day === 2 ? 2 : item.day === 3 ? 3 : 1;
      const validType: SavedItineraryItem['type'] =
        item.type === 'neighborhood' ||
        item.type === 'event' ||
        item.type === 'hotel' ||
        item.type === 'video'
          ? item.type
          : 'experience';

      return {
        id: clamp(item.id, 128, 'stop'),
        type: validType,
        day: validDay,
        titleVi: clamp(item.title.vi || item.title.en, 200, 'Boston Stop'),
        titleEn: clamp(item.title.en || item.title.vi, 200, 'Boston Stop'),
        subtitleVi: clamp(item.subtitle.vi || '', 160, ''),
        subtitleEn: clamp(item.subtitle.en || '', 160, ''),
        district: clamp(item.district || 'Boston', 120, 'Boston'),
        image: safeImage,
      };
    });

  if (validItems.length === 0) {
    throw new Error(
      params.lang === 'vi'
        ? 'Lịch trình đang trống.'
        : 'Itinerary is empty.'
    );
  }

  const shareId = generateShareId();
  const defaultTitle =
    params.lang === 'vi'
      ? `Lịch trình Boston (${validItems.length} điểm dừng)`
      : `My Boston Trip (${validItems.length} stops)`;
  const title = clamp(params.title || defaultTitle, 140, defaultTitle);

  await setDoc(doc(db, 'sharedItineraries', shareId), {
    title,
    lang: params.lang === 'en' ? 'en' : 'vi',
    items: validItems,
    createdAt: serverTimestamp(),
  });

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return {
    shareId,
    shareUrl: origin ? `${origin}/trip/${shareId}` : `/trip/${shareId}`,
  };
}

export async function loadSharedItinerary(
  shareId: string
): Promise<SharedItineraryRecord | null> {
  const cleanId = shareId.trim();
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(cleanId)) return null;

  const snap = await getDoc(doc(db, 'sharedItineraries', cleanId));
  if (!snap.exists()) return null;

  const data = snap.data() || {};
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: SavedItineraryItem[] = rawItems.map(
    (entry: Record<string, unknown>) => ({
      id: String(entry.id || ''),
      type: (entry.type as SavedItineraryItem['type']) || 'experience',
      day: entry.day === 2 ? 2 : entry.day === 3 ? 3 : 1,
      title: {
        vi: String(entry.titleVi || entry.titleEn || ''),
        en: String(entry.titleEn || entry.titleVi || ''),
      },
      subtitle: {
        vi: String(entry.subtitleVi || ''),
        en: String(entry.subtitleEn || ''),
      },
      district: String(entry.district || 'Boston'),
      image: String(entry.image || ''),
    })
  );

  if (items.length === 0) return null;

  return {
    id: snap.id,
    title: String(data.title || 'Boston Trip'),
    lang: data.lang === 'en' ? 'en' : 'vi',
    items,
  };
}

/**
 * Admin-only real-time listener for traveler-shared Boston itineraries (/sharedItineraries).
 */
export function subscribeSharedItineraries(
  onData: (items: SharedItineraryAdminItem[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'sharedItineraries'),
    (snap) => {
      const list: SharedItineraryAdminItem[] = snap.docs.map((d) => {
        const data = d.data() || {};
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const items: SavedItineraryItem[] = rawItems.map(
          (entry: Record<string, unknown>) => ({
            id: String(entry.id || ''),
            type: (entry.type as SavedItineraryItem['type']) || 'experience',
            day: entry.day === 2 ? 2 : entry.day === 3 ? 3 : 1,
            title: {
              vi: String(entry.titleVi || entry.titleEn || ''),
              en: String(entry.titleEn || entry.titleVi || ''),
            },
            subtitle: {
              vi: String(entry.subtitleVi || ''),
              en: String(entry.subtitleEn || ''),
            },
            district: String(entry.district || 'Boston'),
            image: String(entry.image || ''),
          })
        );
        return {
          id: d.id,
          title: String(data.title || 'Boston Trip'),
          lang: data.lang === 'en' ? 'en' : 'vi',
          items,
          createdAt: (data.createdAt as Timestamp | null) || null,
        };
      });

      list.sort((a, b) => {
        const aMs = a.createdAt?.toMillis?.() ?? 0;
        const bMs = b.createdAt?.toMillis?.() ?? 0;
        return bMs - aMs;
      });
      onData(list);
    },
    (err) => {
      console.error('[SharedItineraries] Admin subscription error:', err);
      onData([]);
    }
  );
}

/**
 * Admin-only deletion of a shared itinerary snapshot.
 */
export async function deleteSharedItinerary(shareId: string): Promise<void> {
  const cleanId = shareId.trim();
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(cleanId)) return;
  await deleteDoc(doc(db, 'sharedItineraries', cleanId));
}

/**
 * Builds a real Google Maps multi-stop route URL for a given day's Boston stops.
 */
export function buildGoogleMapsDayRouteUrl(
  dayItems: SavedItineraryItem[],
  lang: Language
): string {
  const stops = dayItems
    .map((item) => {
      const label =
        item.type === 'video'
          ? `${item.district}, Boston, MA`
          : `${item.title.en || item.title[lang]}, ${item.district}, Boston, MA`;
      return label.trim();
    })
    .filter(Boolean);

  if (stops.length === 0) {
    return 'https://www.google.com/maps/search/?api=1&query=Boston%2C+MA';
  }
  if (stops.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`;
  }

  const origin = encodeURIComponent(stops[0]);
  const destination = encodeURIComponent(stops[stops.length - 1]);
  const waypoints = stops.slice(1, -1).slice(0, 8).map(encodeURIComponent).join('|');

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=transit`;
  if (waypoints) {
    url += `&waypoints=${waypoints}`;
  }
  return url;
}

function escapeIcsText(text: string): string {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsDateLocal(d: Date, hour: number): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}0000`;
}

/**
 * Downloads a valid RFC 5545 .ics calendar file for Apple Calendar / Google Calendar.
 */
export function downloadItineraryIcs(
  items: SavedItineraryItem[],
  lang: Language
): void {
  if (!items.length) return;
  const nowStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

  // Schedule starting tomorrow so users can adjust dates easily after import
  const startBase = new Date();
  startBase.setDate(startBase.getDate() + 1);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meet Boston//Trip Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${lang === 'vi' ? 'Lịch trình Boston' : 'Boston Trip Itinerary'}`,
    'X-WR-TIMEZONE:America/New_York',
  ];

  const days: (1 | 2 | 3)[] = [1, 2, 3];
  for (const day of days) {
    const dayItems = items.filter((i) => i.day === day);
    if (!dayItems.length) continue;

    const eventDate = new Date(startBase);
    eventDate.setDate(startBase.getDate() + (day - 1));

    dayItems.forEach((item, idx) => {
      const startHour = Math.min(20, 9 + idx * 2);
      const endHour = Math.min(22, startHour + 2);
      const title = item.title[lang] || item.title.en;
      const desc = `${item.district} — ${item.subtitle[lang] || ''}`.trim();

      lines.push(
        'BEGIN:VEVENT',
        `UID:boston-d${day}-${idx}-${Date.now()}@meetboston`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${formatIcsDateLocal(eventDate, startHour)}`,
        `DTEND:${formatIcsDateLocal(eventDate, endHour)}`,
        `SUMMARY:${escapeIcsText(`[Day ${day}] ${title}`)}`,
        `LOCATION:${escapeIcsText(`${item.district}, Boston, MA`)}`,
        `DESCRIPTION:${escapeIcsText(desc)}`,
        'END:VEVENT'
      );
    });
  }

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'boston-itinerary.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Prints or saves the 3-day itinerary as a clean editorial PDF using a hidden iframe
 * (never calls window.open so it works reliably inside iframes and strict browsers).
 */
export function printItineraryPdf(
  items: SavedItineraryItem[],
  lang: Language,
  shareUrl?: string
): void {
  if (!items.length || typeof document === 'undefined') return;

  const isVi = lang === 'vi';
  const days: (1 | 2 | 3)[] = [1, 2, 3];
  const daySections = days
    .map((day) => {
      const dayItems = items.filter((i) => i.day === day);
      if (!dayItems.length) return '';
      const rows = dayItems
        .map(
          (item, idx) => `
          <li style="padding:10px 0;border-bottom:1px solid #E3E7EE;display:flex;gap:12px;">
            <span style="font-family:monospace;color:#C8102E;font-weight:700;">0${idx + 1}</span>
            <div>
              <div style="font-weight:700;color:#0A2239;font-size:14px;">${escapeHtml(item.title[lang])}</div>
              <div style="color:#526071;font-size:12px;margin-top:2px;">${escapeHtml(item.district)} · ${escapeHtml(item.subtitle[lang])}</div>
            </div>
          </li>`
        )
        .join('');

      return `
        <section style="margin-top:22px;page-break-inside:avoid;">
          <h2 style="font-size:16px;color:#0A2239;border-bottom:2px solid #0A2239;padding-bottom:6px;margin:0;">
            ${isVi ? `Ngày ${day}` : `Day ${day}`} (${dayItems.length})
          </h2>
          <ol style="list-style:none;padding:0;margin:8px 0 0 0;">${rows}</ol>
        </section>`;
    })
    .join('');

  const html = `<!doctype html>
  <html lang="${lang}">
    <head>
      <meta charset="utf-8" />
      <title>${isVi ? 'Lịch trình Boston — Meet Boston' : 'Boston Itinerary — Meet Boston'}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #0F1B2B; padding: 28px; max-width: 760px; margin: 0 auto; }
        @media print { body { padding: 12px; } }
      </style>
    </head>
    <body>
      <header style="border-bottom:3px solid #C8102E;padding-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:#C8102E;text-transform:uppercase;letter-spacing:0.08em;">Meet Boston · Trip Planner</div>
        <h1 style="margin:6px 0 0 0;font-size:24px;color:#0A2239;">${isVi ? 'Lịch Trình Khám Phá Boston' : 'My Boston Travel Itinerary'}</h1>
        ${shareUrl ? `<p style="margin:6px 0 0 0;font-size:12px;color:#526071;">${escapeHtml(shareUrl)}</p>` : ''}
      </header>
      ${daySections}
      <footer style="margin-top:28px;font-size:11px;color:#526071;border-top:1px solid #E3E7EE;padding-top:10px;">
        ${escapeHtml(window.location.origin)}
      </footer>
    </body>
  </html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const docObj = iframe.contentWindow?.document;
  if (docObj) {
    docObj.open();
    docObj.write(html);
    docObj.close();
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1500);
    }, 250);
  } else if (iframe.parentNode) {
    iframe.parentNode.removeChild(iframe);
  }
}

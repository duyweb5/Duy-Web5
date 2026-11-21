import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Request } from 'express';
import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const BOOTSTRAPPED_ADMIN_EMAIL = 'duyweb5@gmail.com';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

let cachedConfig: FirebaseAppletConfig | null = null;
let cachedDb: Firestore | null = null;

export function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  if (cachedConfig) return cachedConfig;
  const configPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as FirebaseAppletConfig;
  if (!parsed?.projectId || parsed.projectId === 'remixed-project-id') {
    throw new Error(
      'firebase-applet-config.json is missing a valid projectId.'
    );
  }
  cachedConfig = parsed;
  return parsed;
}

export function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  const cfg = loadFirebaseAppletConfig();
  // Uses Application Default Credentials (ADC) on Cloud Run / GCP — never requires a JSON key file.
  return initializeApp({
    projectId: cfg.projectId,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;
  const app = getFirebaseAdminApp();
  const cfg = loadFirebaseAppletConfig();
  if (
    cfg.firestoreDatabaseId &&
    cfg.firestoreDatabaseId.trim() &&
    cfg.firestoreDatabaseId !== '(default)'
  ) {
    cachedDb = getFirestore(app, cfg.firestoreDatabaseId);
  } else {
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}

export function isPermissionDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const code = (err as { code?: unknown })?.code;
  return (
    code === 7 ||
    code === 'permission-denied' ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('7 PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('Could not load the default credentials')
  );
}

export function formatAdminSdkError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (isPermissionDeniedError(err)) {
    const cfg = loadFirebaseAppletConfig();
    return `Server chưa được cấp quyền IAM Firestore (roles/datastore.user) trên dự án ${cfg.projectId}. Vui lòng chạy lệnh cấp quyền IAM cho Cloud Run / Service Account (chi tiết trong tab Tự động hóa).`;
  }
  return raw || 'Lỗi kết nối Firebase Admin SDK.';
}

function emailToAdminDocId(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface VerifiedAdminCaller {
  uid: string;
  email: string;
}

/**
 * Verifies a Firebase ID token from Authorization: Bearer <idToken>
 * and checks that the caller is either the bootstrapped super admin
 * or listed in the Firestore /admins collection.
 */
export async function verifyAdminRequest(
  req: Request
): Promise<VerifiedAdminCaller | null> {
  const authHeader = req.header('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!decoded.email || decoded.email_verified !== true) {
      return null;
    }
    const emailLower = decoded.email.toLowerCase();
    if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
      return { uid: decoded.uid, email: emailLower };
    }

    // Check /admins allowlist via Admin SDK
    const db = getAdminDb();
    const byUid = await db.collection('admins').doc(decoded.uid).get();
    if (byUid.exists) {
      return { uid: decoded.uid, email: emailLower };
    }
    const byEmail = await db
      .collection('admins')
      .doc(emailToAdminDocId(emailLower))
      .get();
    if (
      byEmail.exists &&
      String(byEmail.data()?.email || '').toLowerCase() === emailLower
    ) {
      return { uid: decoded.uid, email: emailLower };
    }
    return null;
  } catch {
    return null;
  }
}

export type CronAuthResult =
  | { ok: true; source: 'cron_secret' }
  | { ok: true; source: 'admin_token'; admin: VerifiedAdminCaller }
  | { ok: false; reason: string };

/**
 * Protects /api/cron/sync-youtube:
 * Accepts either Cloud Scheduler's CRON_SECRET (Bearer or X-Cron-Secret header)
 * OR a verified CMS Admin Firebase ID token for manual test runs from /admin.
 */
export async function verifyCronOrAdminRequest(
  req: Request
): Promise<CronAuthResult> {
  const expectedSecret = (process.env.CRON_SECRET || '').trim();
  const headerCronSecret = (req.header('x-cron-secret') || '').trim();
  const authHeader = (req.header('authorization') || '').trim();
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (expectedSecret) {
    if (
      (headerCronSecret &&
        timingSafeEqualStr(headerCronSecret, expectedSecret)) ||
      (bearerToken && timingSafeEqualStr(bearerToken, expectedSecret))
    ) {
      return { ok: true, source: 'cron_secret' };
    }
  }

  // Fallback: verify Firebase Admin ID Token (for Admin CMS "Run Cron Now")
  if (bearerToken) {
    const admin = await verifyAdminRequest(req);
    if (admin) {
      return { ok: true, source: 'admin_token', admin };
    }
  }

  return {
    ok: false,
    reason: expectedSecret
      ? 'Xác thực không hợp lệ. Cần header CRON_SECRET hợp lệ hoặc phiên đăng nhập Admin.'
      : 'Chưa cấu hình CRON_SECRET trên server; chỉ Admin đã đăng nhập mới được gọi thủ công.',
  };
}

/**
 * Probes whether the server runtime currently has Firestore IAM read access
 * via Application Default Credentials without ever exposing instance metadata.
 */
export async function checkAdminFirestoreReadiness(): Promise<{
  ready: boolean;
  error?: string;
}> {
  try {
    const db = getAdminDb();
    await db.collection('videoChannels').limit(1).get();
    return { ready: true };
  } catch (err) {
    return {
      ready: false,
      error: formatAdminSdkError(err),
    };
  }
}

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Google Workspace OAuth scopes (least-privilege read-only Drive access)
export const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const googleDriveProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleDriveProvider.addScope(scope));
googleDriveProvider.setCustomParameters({ prompt: 'select_account' });

// Strict in-memory caching for Google Drive OAuth access token (never localStorage/sessionStorage)
let cachedDriveAccessToken: string | null = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedDriveAccessToken = null;
  }
});

export function getGoogleDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function clearGoogleDriveAccessToken(): void {
  cachedDriveAccessToken = null;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    // Only cache if Drive scope was already granted in the same session
  }
  return result;
}

export async function connectGoogleDrive(): Promise<string> {
  const result = await signInWithPopup(auth, googleDriveProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Không nhận được mã truy cập Google Drive từ tài khoản Google.');
  }
  cachedDriveAccessToken = credential.accessToken;
  return cachedDriveAccessToken;
}

export async function signOutAdmin() {
  cachedDriveAccessToken = null;
  return signOut(auth);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

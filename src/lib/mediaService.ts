import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { OperationType, db, handleFirestoreError, storage } from './firebase';
import {
  ImageOptimizationOptions,
  ImageOutputFormat,
  OptimizedImageResult,
  ensureCompactFallbackDataUrl,
  sanitizeSeoFileNameInput,
} from './imageOptimizer';

export type MediaFolder =
  | 'hero'
  | 'experiences'
  | 'neighborhoods'
  | 'events'
  | 'hotels'
  | 'general';

export type MediaSource = 'computer' | 'google_drive';
export type MediaStorageProvider = 'firebase_storage' | 'firestore_compact';

export interface MediaAssetRecord {
  id: string;
  seoFileName: string;
  altVi: string;
  altEn: string;
  url: string;
  storagePath: string;
  storageProvider: MediaStorageProvider;
  mimeType: ImageOutputFormat;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
  source: MediaSource;
  folder: MediaFolder;
  createdBy: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

function generateMediaDocId(): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `med_${Date.now().toString(36)}_${rand}`;
}

function clampStr(val: string, maxLen: number, fallback = ''): string {
  const cleaned = (val ?? '').trim();
  if (!cleaned) return fallback;
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

export function subscribeMediaAssets(
  onAssets: (assets: MediaAssetRecord[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'mediaAssets'),
    (snap) => {
      const list: MediaAssetRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            seoFileName: String(data.seoFileName || 'meet-boston-image.webp'),
            altVi: String(data.altVi || ''),
            altEn: String(data.altEn || ''),
            url: String(data.url || ''),
            storagePath: String(data.storagePath || ''),
            storageProvider:
              (data.storageProvider as MediaStorageProvider) ||
              'firestore_compact',
            mimeType: (data.mimeType as ImageOutputFormat) || 'image/webp',
            width: Number(data.width || 0),
            height: Number(data.height || 0),
            originalBytes: Number(data.originalBytes || 0),
            optimizedBytes: Number(data.optimizedBytes || 0),
            source: (data.source as MediaSource) || 'computer',
            folder: (data.folder as MediaFolder) || 'general',
            createdBy: String(data.createdBy || ''),
            createdAt: (data.createdAt as Timestamp | null) ?? null,
            updatedAt: (data.updatedAt as Timestamp | null) ?? null,
          };
        })
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
        );
      onAssets(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'mediaAssets')
  );
}

async function tryUploadToFirebaseStorage(
  folder: MediaFolder,
  seoFileName: string,
  blob: Blob,
  mimeType: ImageOutputFormat
): Promise<{ url: string; storagePath: string } | null> {
  const uniquePrefix = Date.now().toString(36);
  const storagePath = `media/${folder}/${uniquePrefix}-${seoFileName}`;
  const fileRef = storageRef(storage, storagePath);

  const uploadPromise = (async () => {
    await uploadBytes(fileRef, blob, {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable',
    });
    const url = await getDownloadURL(fileRef);
    return { url, storagePath };
  })();

  const timeoutPromise = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), 10000);
  });

  try {
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch {
    // Firebase Storage bucket may not be activated yet or rules not deployed -> graceful fallback
    return null;
  }
}

export interface UploadMediaParams {
  sourceBlob: Blob;
  optimized: OptimizedImageResult;
  options: ImageOptimizationOptions;
  seoFileName: string;
  altVi: string;
  altEn: string;
  folder: MediaFolder;
  source: MediaSource;
  uid: string;
}

export async function uploadOptimizedMediaAsset(
  params: UploadMediaParams
): Promise<MediaAssetRecord> {
  const safeFileName = sanitizeSeoFileNameInput(
    params.seoFileName,
    params.optimized.mimeType
  );
  const safeAltVi = clampStr(
    params.altVi,
    240,
    safeFileName.replace(/\.[a-z]+$/, '').replace(/-/g, ' ')
  );
  const safeAltEn = clampStr(params.altEn, 240, safeAltVi);

  // 1. Primary path: Firebase Cloud Storage CDN (real SEO .webp URL)
  let finalOptimized = params.optimized;
  let url = '';
  let storagePath = '';
  let storageProvider: MediaStorageProvider = 'firebase_storage';

  const storageResult = await tryUploadToFirebaseStorage(
    params.folder,
    safeFileName,
    params.optimized.blob,
    params.optimized.mimeType
  );

  if (storageResult) {
    url = storageResult.url;
    storagePath = storageResult.storagePath;
    storageProvider = 'firebase_storage';
  } else {
    // 2. Automatic resilient fallback: compact WebP stored cleanly under 300KB
    finalOptimized = await ensureCompactFallbackDataUrl(
      params.sourceBlob,
      params.options
    );
    url = finalOptimized.dataUrl;
    storagePath = '';
    storageProvider = 'firestore_compact';
  }

  const finalFileName = sanitizeSeoFileNameInput(
    safeFileName,
    finalOptimized.mimeType
  );

  const id = generateMediaDocId();
  const path = `mediaAssets/${id}`;

  const payload = {
    seoFileName: clampStr(finalFileName, 180, 'meet-boston-image.webp'),
    altVi: safeAltVi,
    altEn: safeAltEn,
    url,
    storagePath: clampStr(storagePath, 300, ''),
    storageProvider,
    mimeType: finalOptimized.mimeType,
    width: Math.max(1, Math.min(8000, Math.round(finalOptimized.width))),
    height: Math.max(1, Math.min(8000, Math.round(finalOptimized.height))),
    originalBytes: Math.max(
      1,
      Math.min(50000000, Math.round(finalOptimized.originalBytes))
    ),
    optimizedBytes: Math.max(
      1,
      Math.min(1000000, Math.round(finalOptimized.optimizedBytes))
    ),
    source: params.source,
    folder: params.folder,
    createdBy: params.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'mediaAssets', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    id,
    ...payload,
    createdAt: null,
    updatedAt: null,
  };
}

export async function updateMediaAssetMeta(
  asset: MediaAssetRecord,
  updates: {
    seoFileName: string;
    altVi: string;
    altEn: string;
    folder: MediaFolder;
  }
) {
  const path = `mediaAssets/${asset.id}`;
  const safeSeoFileName = sanitizeSeoFileNameInput(
    updates.seoFileName,
    asset.mimeType
  );
  try {
    await updateDoc(doc(db, 'mediaAssets', asset.id), {
      seoFileName: clampStr(safeSeoFileName, 180, asset.seoFileName),
      altVi: clampStr(updates.altVi, 240, asset.altVi),
      altEn: clampStr(updates.altEn, 240, asset.altEn),
      folder: updates.folder,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteMediaAsset(asset: MediaAssetRecord) {
  const path = `mediaAssets/${asset.id}`;

  // Clean up Firebase Storage object if present (ignore object-not-found)
  if (asset.storagePath && asset.storageProvider === 'firebase_storage') {
    try {
      await deleteObject(storageRef(storage, asset.storagePath));
    } catch {
      // Proceed to remove Firestore record even if Storage object was already removed
    }
  }

  try {
    await deleteDoc(doc(db, 'mediaAssets', asset.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

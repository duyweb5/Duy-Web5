export type ImageOutputFormat = 'image/webp' | 'image/jpeg' | 'image/png';
export type ResizePreset = 'hero' | 'card' | 'thumbnail' | 'original';
export type AspectCropPreset = 'original' | '16:9' | '4:3' | '1:1';

export interface ImageOptimizationOptions {
  resizePreset: ResizePreset;
  aspectCrop: AspectCropPreset;
  format: ImageOutputFormat;
  quality: number; // 0.55 - 0.95
}

export interface OptimizedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  optimizedBytes: number;
  savingsPercent: number;
  mimeType: ImageOutputFormat;
}

export const RESIZE_PRESET_MAX_WIDTH: Record<ResizePreset, number | null> = {
  hero: 1920,
  card: 1200,
  thumbnail: 640,
  original: null,
};

export function getExtensionForFormat(format: ImageOutputFormat): string {
  if (format === 'image/webp') return 'webp';
  if (format === 'image/png') return 'png';
  return 'jpg';
}

export function stripVietnameseAccents(input: string): string {
  return input
    .replace(/[Đđ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function slugifySeoBase(input: string): string {
  const cleaned = stripVietnameseAccents(input)
    .toLowerCase()
    .replace(/\.(webp|jpe?g|png|gif|heic|avif|bmp)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);

  return cleaned || 'meet-boston-photo';
}

/**
 * Generates a clean, Google Image SEO-friendly filename from Vietnamese/English context.
 * Example: ("Đường mòn Tự do Boston", "Downtown", "image/webp")
 * -> "meet-boston-duong-mon-tu-do-boston-downtown.webp"
 */
export function generateSeoFileName(
  titleOrFileName: string,
  contextHint: string,
  format: ImageOutputFormat
): string {
  const ext = getExtensionForFormat(format);
  const parts: string[] = [];

  const titleSlug = slugifySeoBase(titleOrFileName);
  const hintSlug = contextHint ? slugifySeoBase(contextHint) : '';

  if (!titleSlug.startsWith('meet-boston') && !titleSlug.startsWith('boston')) {
    parts.push('meet-boston');
  }
  parts.push(titleSlug);
  if (hintSlug && !titleSlug.includes(hintSlug)) {
    parts.push(hintSlug);
  }

  const combined = parts
    .join('-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);

  return `${combined || 'meet-boston-image'}.${ext}`;
}

export function sanitizeSeoFileNameInput(
  rawInput: string,
  format: ImageOutputFormat
): string {
  const ext = getExtensionForFormat(format);
  const base = slugifySeoBase(rawInput);
  return `${base}.${ext}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function loadBitmapFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không thể đọc dữ liệu ảnh. Vui lòng chọn tệp JPG, PNG hoặc WebP hợp lệ.'));
    };
    img.src = objectUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Không thể chuyển đổi ảnh sang dữ liệu hiển thị.'));
      }
    };
    reader.onerror = () => reject(new Error('Lỗi đọc dữ liệu ảnh.'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: ImageOutputFormat,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Trình duyệt không thể nén ảnh ở định dạng này.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      mimeType === 'image/png' ? undefined : quality
    );
  });
}

function computeCropRect(
  srcW: number,
  srcH: number,
  crop: AspectCropPreset
): { sx: number; sy: number; sw: number; sh: number } {
  if (crop === 'original') {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  }
  const targetRatio =
    crop === '16:9' ? 16 / 9 : crop === '4:3' ? 4 / 3 : 1;
  const currentRatio = srcW / srcH;

  if (Math.abs(currentRatio - targetRatio) < 0.01) {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  }

  if (currentRatio > targetRatio) {
    // Source is wider -> crop width symmetrically
    const sw = Math.round(srcH * targetRatio);
    const sx = Math.round((srcW - sw) / 2);
    return { sx, sy: 0, sw, sh: srcH };
  } else {
    // Source is taller -> crop height symmetrically
    const sh = Math.round(srcW / targetRatio);
    const sy = Math.round((srcH - sh) / 2);
    return { sx: 0, sy, sw: srcW, sh };
  }
}

/**
 * Client-side Canvas optimization pipeline:
 * 1. Center-crops to requested aspect ratio (16:9, 4:3, 1:1, or original)
 * 2. Downscales smoothly to max width preset (1920px / 1200px / 640px)
 * 3. Strips EXIF/GPS metadata automatically
 * 4. Encodes as WebP / JPEG / PNG at chosen quality
 */
export async function optimizeImageBlob(
  sourceBlob: Blob,
  options: ImageOptimizationOptions
): Promise<OptimizedImageResult> {
  const img = await loadBitmapFromBlob(sourceBlob);
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;

  const { sx, sy, sw, sh } = computeCropRect(
    originalWidth,
    originalHeight,
    options.aspectCrop
  );

  const maxW = RESIZE_PRESET_MAX_WIDTH[options.resizePreset];
  let outW = sw;
  let outH = sh;

  if (maxW && sw > maxW) {
    const scale = maxW / sw;
    outW = Math.round(sw * scale);
    outH = Math.max(1, Math.round(sh * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Trình duyệt không hỗ trợ bộ xử lý đồ họa Canvas 2D.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // For JPEG, paint clean white background in case source PNG has transparency
  if (options.format === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

  const clampedQuality = Math.max(0.5, Math.min(0.95, options.quality));
  const blob = await canvasToBlob(canvas, options.format, clampedQuality);
  const dataUrl = await blobToDataUrl(blob);

  const originalBytes = Math.max(1, sourceBlob.size);
  const optimizedBytes = Math.max(1, blob.size);
  const savingsPercent = Math.round(
    ((originalBytes - optimizedBytes) / originalBytes) * 100
  );

  return {
    blob,
    dataUrl,
    width: outW,
    height: outH,
    originalWidth,
    originalHeight,
    originalBytes,
    optimizedBytes,
    savingsPercent,
    mimeType: options.format,
  };
}

/**
 * Guarantees a compact WebP data URL under Firestore's safe field bound (~240KB)
 * when operating in Firestore Compact Fallback mode (if Firebase Storage bucket is not activated yet).
 */
export async function ensureCompactFallbackDataUrl(
  sourceBlob: Blob,
  options: ImageOptimizationOptions
): Promise<OptimizedImageResult> {
  const MAX_DATA_URL_LENGTH = 300000; // Well within 350,000 char Firestore rule bound
  let attempt = await optimizeImageBlob(sourceBlob, options);
  if (attempt.dataUrl.length <= MAX_DATA_URL_LENGTH) {
    return attempt;
  }

  // Step down progressively to WebP + smaller width/quality to fit cleanly
  const fallbackSteps: Partial<ImageOptimizationOptions>[] = [
    { format: 'image/webp', quality: 0.78, resizePreset: 'card' },
    { format: 'image/webp', quality: 0.68, resizePreset: 'card' },
    { format: 'image/webp', quality: 0.62, resizePreset: 'thumbnail' },
    { format: 'image/webp', quality: 0.55, resizePreset: 'thumbnail' },
  ];

  for (const step of fallbackSteps) {
    attempt = await optimizeImageBlob(sourceBlob, {
      ...options,
      ...step,
    });
    if (attempt.dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return attempt;
    }
  }

  return attempt;
}

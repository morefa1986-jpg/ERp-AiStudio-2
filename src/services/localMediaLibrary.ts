export interface LocalMediaAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  blob: Blob;
}

import { nextId } from '../utils/id';

export interface ImageEditOptions {
  rotationDeg?: 0 | 90 | 180 | 270;
  /** Backward-compatible alias used by the social media editor UI. */
  rotation?: 0 | 90 | 180 | 270;
  brightness?: number;
  contrast?: number;
  quality?: number;
}

const DB_NAME = 'fathi_erp_media_library';
const DB_VERSION = 1;
const STORE_NAME = 'assets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('MEDIA_DB_OPEN_FAILED'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('MEDIA_DB_REQUEST_FAILED'));
  });
}

async function putMediaAsset(asset: LocalMediaAsset): Promise<LocalMediaAsset> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    await requestToPromise(transaction.objectStore(STORE_NAME).put(asset));
    return asset;
  } finally {
    db.close();
  }
}

export async function saveMediaFile(file: File): Promise<LocalMediaAsset> {
  const asset: LocalMediaAsset = {
    id: nextId('media'),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
  };
  return putMediaAsset(asset);
}

export async function saveMediaBlob(blob: Blob, name: string, mimeType?: string): Promise<LocalMediaAsset> {
  const asset: LocalMediaAsset = {
    id: nextId('media'),
    name,
    mimeType: mimeType || blob.type || 'application/octet-stream',
    size: blob.size,
    createdAt: new Date().toISOString(),
    blob,
  };
  return putMediaAsset(asset);
}

export async function listMediaAssets(): Promise<LocalMediaAsset[]> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const assets = await requestToPromise(transaction.objectStore(STORE_NAME).getAll()) as LocalMediaAsset[];
    return assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } finally {
    db.close();
  }
}

export async function deleteMediaAsset(assetId: string): Promise<void> {
  const db = await openDb();
  try {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    await requestToPromise(transaction.objectStore(STORE_NAME).delete(assetId));
  } finally {
    db.close();
  }
}

export async function renameMediaAsset(asset: LocalMediaAsset, newName: string): Promise<LocalMediaAsset> {
  const cleanName = newName.trim();
  if (!cleanName) throw new Error('MEDIA_NAME_REQUIRED');
  return putMediaAsset({ ...asset, name: cleanName });
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('IMAGE_DECODE_FAILED'));
    };
    image.src = url;
  });
}

export async function createEditedImageVersion(
  asset: LocalMediaAsset,
  options: ImageEditOptions,
): Promise<LocalMediaAsset> {
  if (!asset.mimeType.startsWith('image/')) throw new Error('IMAGE_ASSET_REQUIRED');
  const image = await loadImage(asset.blob);
  const rotation = options.rotationDeg ?? options.rotation ?? 0;
  const swapDimensions = rotation === 90 || rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swapDimensions ? image.naturalHeight : image.naturalWidth;
  canvas.height = swapDimensions ? image.naturalWidth : image.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_NOT_AVAILABLE');

  const brightness = Math.max(20, Math.min(200, options.brightness ?? 100));
  const contrast = Math.max(20, Math.min(200, options.contrast ?? 100));
  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  const outputType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = Math.max(0.3, Math.min(1, options.quality ?? 0.9));
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('IMAGE_EXPORT_FAILED')), outputType, quality);
  });
  const dot = asset.name.lastIndexOf('.');
  const baseName = dot > 0 ? asset.name.slice(0, dot) : asset.name;
  const extension = outputType === 'image/png' ? 'png' : 'jpg';
  return saveMediaBlob(blob, `${baseName}-edited.${extension}`, outputType);
}

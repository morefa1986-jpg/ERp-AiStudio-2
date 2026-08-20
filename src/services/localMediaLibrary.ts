export interface LocalMediaAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  blob: Blob;
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

export async function saveMediaFile(file: File): Promise<LocalMediaAsset> {
  const db = await openDb();
  try {
    const asset: LocalMediaAsset = {
      id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: new Date().toISOString(),
      blob: file,
    };
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    await requestToPromise(transaction.objectStore(STORE_NAME).put(asset));
    return asset;
  } finally {
    db.close();
  }
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

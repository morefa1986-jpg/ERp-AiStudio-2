import { getStoredSessionToken } from '../context/AuthContext';
import { FileAttachment } from '../types';
import { nextId } from '../utils/id';

export type ClientFileCategory = 'chat' | 'mortality' | 'laboratory';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

export async function uploadLocalAttachment(category: ClientFileCategory, file: File, addedBy?: string): Promise<FileAttachment> {
  const fallback: FileAttachment = {
    id: nextId('file'),
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    addedAt: new Date().toISOString(),
    addedBy,
  };
  const token = getStoredSessionToken();
  if (!token) return fallback;
  const response = await fetch(`/api/files/${category}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', base64: await fileToBase64(file) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.file?.storageId) throw new Error(data.error || 'LOCAL_FILE_UPLOAD_FAILED');
  return {
    ...fallback,
    fileName: data.file.originalName || fallback.fileName,
    mimeType: data.file.mimeType || fallback.mimeType,
    sizeBytes: Number(data.file.sizeBytes) || fallback.sizeBytes,
    storageId: data.file.storageId,
    downloadUrl: data.file.downloadUrl || `/api/files/${category}/${encodeURIComponent(data.file.storageId)}`,
    checksum: data.file.sha256 ? `SHA-256:${data.file.sha256}` : undefined,
    addedAt: data.file.storedAt || fallback.addedAt,
  };
}

export function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

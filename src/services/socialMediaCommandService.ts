import { nextId } from '../utils/id';

export type SocialPlatformId = 'instagram' | 'linkedin' | 'whatsapp' | 'telegram' | 'eitaa' | 'rubika' | 'bale' | 'facebook' | 'x' | 'youtube';
export type SocialWorkflowStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'READY_TO_PUBLISH' | 'PUBLISHED' | 'REJECTED';

export interface SocialPlatformDefinition { id: SocialPlatformId; name: string; loginUrl: string; composeUrl: string; colorHint: string; supportsFileShare: boolean; }
export interface SocialConnectionState { platformId: SocialPlatformId; connected: boolean; assistedReady?: boolean; accountLabel?: string; connectedAt?: string; lastOpenedAt?: string; }
export interface SocialCampaignDraft { id: string; title: string; caption: string; hashtags: string[]; platformIds: SocialPlatformId[]; mediaAssetIds: string[]; scheduledAt?: string; status: SocialWorkflowStatus; createdAt: string; updatedAt: string; approvedAt?: string; approvedBy?: string; publishedAt?: string; notes?: string; }

export const SOCIAL_PLATFORMS: SocialPlatformDefinition[] = [
  { id: 'instagram', name: 'Instagram', loginUrl: 'https://www.instagram.com/', composeUrl: 'https://www.instagram.com/', colorHint: 'IG', supportsFileShare: true },
  { id: 'linkedin', name: 'LinkedIn', loginUrl: 'https://www.linkedin.com/login', composeUrl: 'https://www.linkedin.com/feed/', colorHint: 'in', supportsFileShare: true },
  { id: 'whatsapp', name: 'WhatsApp', loginUrl: 'https://web.whatsapp.com/', composeUrl: 'https://web.whatsapp.com/', colorHint: 'WA', supportsFileShare: true },
  { id: 'telegram', name: 'Telegram', loginUrl: 'https://web.telegram.org/', composeUrl: 'https://web.telegram.org/', colorHint: 'TG', supportsFileShare: true },
  { id: 'eitaa', name: 'Eitaa', loginUrl: 'https://web.eitaa.com/', composeUrl: 'https://web.eitaa.com/', colorHint: 'ET', supportsFileShare: true },
  { id: 'rubika', name: 'Rubika', loginUrl: 'https://web.rubika.ir/', composeUrl: 'https://web.rubika.ir/', colorHint: 'RB', supportsFileShare: true },
  { id: 'bale', name: 'Bale', loginUrl: 'https://web.bale.ai/', composeUrl: 'https://web.bale.ai/', colorHint: 'BL', supportsFileShare: true },
  { id: 'facebook', name: 'Facebook', loginUrl: 'https://www.facebook.com/login/', composeUrl: 'https://www.facebook.com/', colorHint: 'FB', supportsFileShare: true },
  { id: 'x', name: 'X', loginUrl: 'https://x.com/login', composeUrl: 'https://x.com/compose/post', colorHint: 'X', supportsFileShare: true },
  { id: 'youtube', name: 'YouTube Studio', loginUrl: 'https://accounts.google.com/', composeUrl: 'https://studio.youtube.com/', colorHint: 'YT', supportsFileShare: true },
];

const DB_NAME = 'fathi_erp_social_workflow';
const DB_VERSION = 1;
const STORE_NAME = 'records';
const CONNECTIONS_KEY = 'connections';
const DRAFTS_KEY = 'drafts';

interface StoredRecord<T> { key: string; value: T; }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('SOCIAL_DB_UNAVAILABLE'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('SOCIAL_DB_OPEN_FAILED'));
  });
}

async function readRecord<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openDb();
    try {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      const record = await new Promise<StoredRecord<T> | undefined>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      return record?.value ?? fallback;
    } finally { db.close(); }
  } catch { return fallback; }
}

async function writeRecord<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  try {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ key, value } satisfies StoredRecord<T>);
    await new Promise<void>((resolve, reject) => { request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  } finally { db.close(); }
}

export async function listSocialConnections(): Promise<SocialConnectionState[]> {
  const saved = await readRecord<Record<string, SocialConnectionState>>(CONNECTIONS_KEY, {});
  return SOCIAL_PLATFORMS.map((platform) => saved[platform.id] || { platformId: platform.id, connected: false });
}

export async function setSocialConnection(platformId: SocialPlatformId, _connected: boolean, accountLabel?: string): Promise<SocialConnectionState[]> {
  const current = await readRecord<Record<string, SocialConnectionState>>(CONNECTIONS_KEY, {});
  const existing = current[platformId];
  current[platformId] = { platformId, connected: false, assistedReady: Boolean(accountLabel?.trim()), accountLabel: accountLabel?.trim() || existing?.accountLabel, connectedAt: undefined, lastOpenedAt: existing?.lastOpenedAt };
  await writeRecord(CONNECTIONS_KEY, current);
  return listSocialConnections();
}

export async function markPlatformOpened(platformId: SocialPlatformId): Promise<SocialConnectionState[]> {
  const current = await readRecord<Record<string, SocialConnectionState>>(CONNECTIONS_KEY, {});
  const existing = current[platformId] || { platformId, connected: false };
  current[platformId] = { ...existing, lastOpenedAt: new Date().toISOString() };
  await writeRecord(CONNECTIONS_KEY, current);
  return listSocialConnections();
}

export function openPlatformLogin(platformId: SocialPlatformId): void {
  const platform = SOCIAL_PLATFORMS.find((item) => item.id === platformId);
  if (!platform || typeof window === 'undefined') return;
  window.open(platform.loginUrl, '_blank', 'noopener,noreferrer');
  void markPlatformOpened(platformId);
}

export function openPlatformComposer(platformId: SocialPlatformId): void {
  const platform = SOCIAL_PLATFORMS.find((item) => item.id === platformId);
  if (!platform || typeof window === 'undefined') return;
  window.open(platform.composeUrl, '_blank', 'noopener,noreferrer');
  void markPlatformOpened(platformId);
}

export async function listSocialDrafts(): Promise<SocialCampaignDraft[]> {
  const drafts = await readRecord<SocialCampaignDraft[]>(DRAFTS_KEY, []);
  return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function saveSocialDraft(input: Omit<SocialCampaignDraft, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: SocialWorkflowStatus }): Promise<SocialCampaignDraft[]> {
  const drafts = await listSocialDrafts(); const now = new Date().toISOString();
  const draft: SocialCampaignDraft = { ...input, id: nextId('social'), status: input.status || 'DRAFT', createdAt: now, updatedAt: now };
  const next = [draft, ...drafts]; await writeRecord(DRAFTS_KEY, next); return next;
}

export async function updateSocialDraft(id: string, patch: Partial<SocialCampaignDraft>): Promise<SocialCampaignDraft[]> {
  const now = new Date().toISOString(); const next = (await listSocialDrafts()).map((draft) => draft.id === id ? { ...draft, ...patch, id: draft.id, updatedAt: now } : draft); await writeRecord(DRAFTS_KEY, next); return next;
}

export async function deleteSocialDraft(id: string): Promise<SocialCampaignDraft[]> {
  const next = (await listSocialDrafts()).filter((draft) => draft.id !== id); await writeRecord(DRAFTS_KEY, next); return next;
}

export function formatCaption(caption: string, hashtags: string[]): string {
  const cleanTags = hashtags.map((tag) => tag.trim().replace(/^#/, '').replace(/\s+/g, '_')).filter(Boolean).map((tag) => `#${tag}`);
  return [caption.trim(), cleanTags.join(' ')].filter(Boolean).join('\n\n');
}

export async function copyCampaignCaption(caption: string): Promise<boolean> { try { await navigator.clipboard.writeText(caption); return true; } catch { return false; } }
export async function shareCampaignFiles(files: File[], title: string, text: string): Promise<'SHARED' | 'UNSUPPORTED' | 'CANCELLED'> {
  if (typeof navigator === 'undefined' || !('share' in navigator)) return 'UNSUPPORTED';
  try { const payload: ShareData = { title, text }; if (files.length > 0 && (!('canShare' in navigator) || navigator.canShare({ files }))) payload.files = files; await navigator.share(payload); return 'SHARED'; } catch (error: any) { return error?.name === 'AbortError' ? 'CANCELLED' : 'UNSUPPORTED'; }
}

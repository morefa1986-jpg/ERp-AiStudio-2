export type SocialPlatformId =
  | 'instagram'
  | 'linkedin'
  | 'whatsapp'
  | 'telegram'
  | 'eitaa'
  | 'rubika'
  | 'bale'
  | 'facebook'
  | 'x'
  | 'youtube';

export type SocialWorkflowStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'REJECTED';

export interface SocialPlatformDefinition {
  id: SocialPlatformId;
  name: string;
  loginUrl: string;
  composeUrl: string;
  colorHint: string;
  supportsFileShare: boolean;
}

export interface SocialConnectionState {
  platformId: SocialPlatformId;
  connected: boolean;
  accountLabel?: string;
  connectedAt?: string;
  lastOpenedAt?: string;
}

export interface SocialCampaignDraft {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  platformIds: SocialPlatformId[];
  mediaAssetIds: string[];
  scheduledAt?: string;
  status: SocialWorkflowStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  publishedAt?: string;
  notes?: string;
}

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

const CONNECTION_STORAGE_KEY = 'fathi_social_connections_v1';
const DRAFT_STORAGE_KEY = 'fathi_social_campaigns_v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable in private/restricted browser contexts.
  }
}

export function listSocialConnections(): SocialConnectionState[] {
  const saved = readJson<Record<string, SocialConnectionState>>(CONNECTION_STORAGE_KEY, {});
  return SOCIAL_PLATFORMS.map((platform) => saved[platform.id] || {
    platformId: platform.id,
    connected: false,
  });
}

export function setSocialConnection(
  platformId: SocialPlatformId,
  connected: boolean,
  accountLabel?: string,
): SocialConnectionState[] {
  const current = readJson<Record<string, SocialConnectionState>>(CONNECTION_STORAGE_KEY, {});
  current[platformId] = {
    platformId,
    connected,
    accountLabel: accountLabel?.trim() || current[platformId]?.accountLabel,
    connectedAt: connected ? (current[platformId]?.connectedAt || new Date().toISOString()) : undefined,
    lastOpenedAt: current[platformId]?.lastOpenedAt,
  };
  writeJson(CONNECTION_STORAGE_KEY, current);
  return listSocialConnections();
}

export function markPlatformOpened(platformId: SocialPlatformId): SocialConnectionState[] {
  const current = readJson<Record<string, SocialConnectionState>>(CONNECTION_STORAGE_KEY, {});
  const existing = current[platformId] || { platformId, connected: false };
  current[platformId] = { ...existing, lastOpenedAt: new Date().toISOString() };
  writeJson(CONNECTION_STORAGE_KEY, current);
  return listSocialConnections();
}

export function openPlatformLogin(platformId: SocialPlatformId): void {
  const platform = SOCIAL_PLATFORMS.find((item) => item.id === platformId);
  if (!platform || typeof window === 'undefined') return;
  window.open(platform.loginUrl, '_blank', 'noopener,noreferrer');
  markPlatformOpened(platformId);
}

export function openPlatformComposer(platformId: SocialPlatformId): void {
  const platform = SOCIAL_PLATFORMS.find((item) => item.id === platformId);
  if (!platform || typeof window === 'undefined') return;
  window.open(platform.composeUrl, '_blank', 'noopener,noreferrer');
  markPlatformOpened(platformId);
}

export function listSocialDrafts(): SocialCampaignDraft[] {
  const drafts = readJson<SocialCampaignDraft[]>(DRAFT_STORAGE_KEY, []);
  return drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function saveSocialDraft(input: Omit<SocialCampaignDraft, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: SocialWorkflowStatus }): SocialCampaignDraft[] {
  const drafts = listSocialDrafts();
  const now = new Date().toISOString();
  const draft: SocialCampaignDraft = {
    ...input,
    id: `social_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: input.status || 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };
  const next = [draft, ...drafts];
  writeJson(DRAFT_STORAGE_KEY, next);
  return next;
}

export function updateSocialDraft(id: string, patch: Partial<SocialCampaignDraft>): SocialCampaignDraft[] {
  const now = new Date().toISOString();
  const next = listSocialDrafts().map((draft) => draft.id === id ? { ...draft, ...patch, id: draft.id, updatedAt: now } : draft);
  writeJson(DRAFT_STORAGE_KEY, next);
  return next;
}

export function deleteSocialDraft(id: string): SocialCampaignDraft[] {
  const next = listSocialDrafts().filter((draft) => draft.id !== id);
  writeJson(DRAFT_STORAGE_KEY, next);
  return next;
}

export function formatCaption(caption: string, hashtags: string[]): string {
  const cleanTags = hashtags
    .map((tag) => tag.trim().replace(/^#/, '').replace(/\s+/g, '_'))
    .filter(Boolean)
    .map((tag) => `#${tag}`);
  return [caption.trim(), cleanTags.join(' ')].filter(Boolean).join('\n\n');
}

export async function copyCampaignCaption(caption: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(caption);
    return true;
  } catch {
    return false;
  }
}

export async function shareCampaignFiles(
  files: File[],
  title: string,
  text: string,
): Promise<'SHARED' | 'UNSUPPORTED' | 'CANCELLED'> {
  if (typeof navigator === 'undefined' || !('share' in navigator)) return 'UNSUPPORTED';
  try {
    const payload: ShareData = { title, text };
    if (files.length > 0) {
      const canShareFiles = !('canShare' in navigator) || navigator.canShare({ files });
      if (canShareFiles) payload.files = files;
    }
    await navigator.share(payload);
    return 'SHARED';
  } catch (error: any) {
    if (error?.name === 'AbortError') return 'CANCELLED';
    return 'UNSUPPORTED';
  }
}

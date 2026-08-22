import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteERPStore } from '../../server/storage';
import { roleAllows } from '../utils/rbac';

const tempDirs: string[] = [];

function createStore(): SqliteERPStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-social-'));
  tempDirs.push(dir);
  return new SqliteERPStore(path.join(dir, 'erp.sqlite'));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('Social media workflow server persistence and RBAC', () => {
  it('persists assisted account state without ever marking an official connection as true', () => {
    const store = createStore();
    try {
      const connection = store.upsertSocialConnection({ platformId: 'instagram', connected: true, accountLabel: 'Fathi Caviar' });
      expect(connection.connected).toBe(false);
      expect(connection.assistedReady).toBe(true);
      expect(store.listSocialConnections()[0]).toMatchObject({ platformId: 'instagram', connected: false, assistedReady: true });
    } finally {
      store.close();
    }
  });

  it('persists draft, approval and publication queue records durably', () => {
    const store = createStore();
    try {
      store.upsertSocialDraft({
        id: 'social_1',
        title: 'Caviar launch',
        caption: 'Traceable farm update',
        hashtags: ['caviar'],
        platformIds: ['instagram', 'linkedin'],
        mediaAssetIds: ['asset_1'],
        status: 'PENDING_APPROVAL',
        createdAt: '2026-08-20T00:00:00.000Z',
        updatedAt: '2026-08-20T00:00:00.000Z',
      });
      store.upsertSocialDraft({ ...store.getSocialDraft('social_1')!, status: 'APPROVED', approvedBy: 'Owner', approvedAt: '2026-08-20T01:00:00.000Z', updatedAt: '2026-08-20T01:00:00.000Z' });
      expect(store.listSocialDrafts()).toHaveLength(1);
      expect(store.getSocialDraft('social_1')).toMatchObject({ status: 'APPROVED', approvedBy: 'Owner' });
      expect(store.deleteSocialDraft('social_1')).toBe(true);
      expect(store.listSocialDrafts()).toHaveLength(0);
    } finally {
      store.close();
    }
  });

  it('keeps social approvals restricted to media-capable roles', () => {
    expect(roleAllows('Media Manager', 'media', 'approve')).toBe(true);
    expect(roleAllows('Viewer/Auditor', 'media', 'approve')).toBe(false);
    expect(roleAllows('Technician', 'media', 'create')).toBe(false);
  });
});

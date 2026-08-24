import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ModuleSettingsStore } from '../../server/moduleSettings';
import { defaultModuleVisibility, normalizeModuleVisibility, validateModuleVisibilityPayload } from '../utils/moduleVisibilityPolicy';

const tempDirs: string[] = [];
function tempDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fathi-module-settings-'));
  tempDirs.push(dir);
  return path.join(dir, 'erp.sqlite');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('server-shared module visibility', () => {
  it('forces locked modules on even when a caller tries to disable them', () => {
    const normalized = normalizeModuleVisibility({ dashboard: false, adminSettings: false, feeding: false });
    expect(normalized.dashboard).toBe(true);
    expect(normalized.adminSettings).toBe(true);
    expect(normalized.feeding).toBe(false);
  });

  it('rejects unknown module ids and non-boolean values', () => {
    expect(validateModuleVisibilityPayload({ feeding: false, fakeModule: true }).ok).toBe(false);
    expect(validateModuleVisibilityPayload({ feeding: 'no' }).ok).toBe(false);
  });

  it('persists visibility in SQLite and is visible to a second store instance', () => {
    const db = tempDb();
    const first = new ModuleSettingsStore(db);
    const next = defaultModuleVisibility();
    next.feeding = false;
    next.mediaStudio = false;
    first.setModuleVisibility(next);
    first.close();

    const second = new ModuleSettingsStore(db);
    const stored = second.getModuleVisibility();
    second.close();
    expect(stored.feeding).toBe(false);
    expect(stored.mediaStudio).toBe(false);
    expect(stored.dashboard).toBe(true);
    expect(stored.adminSettings).toBe(true);
  });
});

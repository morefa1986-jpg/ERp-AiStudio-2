import { describe, expect, it } from 'vitest';
import { MODULE_CATALOG } from '../context/ModuleVisibilityContext';

describe('admin module visibility catalog', () => {
  it('contains unique route ids and the complete core ERP surface', () => {
    const ids = MODULE_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const required of ['dashboard','ponds','feeding','waterQuality','hatchery','processing','sales','accounting','hr','securityAudit','backup','adminSettings']) {
      expect(ids).toContain(required);
    }
  });

  it('keeps recovery/control routes locked on', () => {
    expect(MODULE_CATALOG.find((item) => item.id === 'dashboard')?.locked).toBe(true);
    expect(MODULE_CATALOG.find((item) => item.id === 'adminSettings')?.locked).toBe(true);
  });

  it('has an admin-readable Persian label and description for every module', () => {
    expect(MODULE_CATALOG.every((item) => item.titleFa.trim() && item.titleEn.trim() && item.descriptionFa.trim())).toBe(true);
  });
});

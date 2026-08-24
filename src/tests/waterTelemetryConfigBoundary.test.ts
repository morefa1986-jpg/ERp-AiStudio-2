import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DAHIR_CONFIG, saveDahirConfig } from '../services/dahirApi';

describe('water telemetry configuration boundary', () => {
  it('keeps browser configuration non-authoritative and server-managed for credentials/base URL', () => {
    const storage: Record<string, string> = {};
    vi.stubGlobal('window', { localStorage: { setItem: (key: string, value: string) => { storage[key] = value; }, getItem: (key: string) => storage[key] || null } });
    const saved = saveDahirConfig({
      ...DEFAULT_DAHIR_CONFIG,
      baseUrl: 'https://should-not-be-stored.example',
      authMode: 'server',
      pondDevices: [{ pondId: 'pond_1', deviceId: 'dev_1', levelKey: 'waterLevel', unit: 'cm' }],
      treatmentDeviceId: 'treat_1',
      treatmentKeys: ['temperature'],
      pollSeconds: 30,
    });
    expect(saved.baseUrl).toBe('SERVER_MANAGED');
    expect(saved.authMode).toBe('server');
    expect(JSON.stringify(storage)).not.toContain('should-not-be-stored');
    expect(JSON.stringify(storage)).not.toMatch(/api[_-]?key|token|password|secret/i);
  });
});

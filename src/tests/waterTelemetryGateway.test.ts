import { afterEach, describe, expect, it, vi } from 'vitest';
import { dahirGatewayStatus, fetchDahirTelemetryServerSide } from '../../server/dahirGateway';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('server-side water telemetry gateway', () => {
  it('reports configuration without exposing credentials', () => {
    const status = dahirGatewayStatus({
      WATER_TELEMETRY_BASE_URL: 'http://127.0.0.1:8080',
      WATER_TELEMETRY_API_KEY: 'super-secret-key',
    } as NodeJS.ProcessEnv);

    expect(status).toEqual({
      configured: true,
      authMode: 'apiKey',
      host: '127.0.0.1:8080',
      maxAgeMinutes: 15,
    });
    expect(JSON.stringify(status)).not.toContain('super-secret-key');
  });

  it('rejects invalid device identifiers before making a network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchDahirTelemetryServerSide(
      '../unsafe/device',
      ['waterLevel'],
      { WATER_TELEMETRY_BASE_URL: 'http://127.0.0.1:8080', WATER_TELEMETRY_API_KEY: 'key' } as NodeJS.ProcessEnv,
    )).rejects.toThrow('DAHIR_DEVICE_INVALID');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes telemetry and marks data older than 15 minutes as stale', async () => {
    const now = Date.now();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      temperature: [{ ts: now - 2 * 60_000, value: '15.8' }],
      dissolvedOxygen: [{ ts: now - 20 * 60_000, value: 6.2 }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchDahirTelemetryServerSide(
      'pond-sensor-01',
      ['temperature', 'dissolvedOxygen'],
      { WATER_TELEMETRY_BASE_URL: 'http://127.0.0.1:8080', WATER_TELEMETRY_BEARER_TOKEN: 'token' } as NodeJS.ProcessEnv,
    );

    expect(result.temperature.numericValue).toBe(15.8);
    expect(result.temperature.isFresh).toBe(true);
    expect(result.dissolvedOxygen.numericValue).toBe(6.2);
    expect(result.dissolvedOxygen.isFresh).toBe(false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/plugins/telemetry/DEVICE/pond-sensor-01/values/timeseries');
    expect((options as RequestInit).headers).toMatchObject({ 'X-Authorization': 'Bearer token' });
  });

  it('maps upstream authentication failures to a stable gateway error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    await expect(fetchDahirTelemetryServerSide(
      'sensor-01',
      ['waterLevel'],
      { WATER_TELEMETRY_BASE_URL: 'http://127.0.0.1:8080', WATER_TELEMETRY_API_KEY: 'bad-key' } as NodeJS.ProcessEnv,
    )).rejects.toThrow('DAHIR_AUTH_FAILED');
  });

  it('keeps legacy environment keys as a backend-only migration fallback', () => {
    const status = dahirGatewayStatus({
      DAHIR_BASE_URL: 'http://127.0.0.1:8080',
      DAHIR_BEARER_TOKEN: 'legacy-token',
    } as NodeJS.ProcessEnv);
    expect(status.configured).toBe(true);
    expect(status.authMode).toBe('bearer');
  });
});

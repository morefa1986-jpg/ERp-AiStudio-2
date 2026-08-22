import { describe, expect, it } from 'vitest';
import { resolveServerListenConfig } from '../../server/lanConfig';

describe('LAN secure binding policy', () => {
  it('binds localhost over HTTP for the desktop/offline default', () => {
    expect(resolveServerListenConfig({} as NodeJS.ProcessEnv)).toMatchObject({
      host: '127.0.0.1',
      lanMode: false,
      protocol: 'http',
      tlsEnabled: false,
    });
  });

  it('refuses LAN mode without an explicit host and TLS material', () => {
    expect(() => resolveServerListenConfig({ FATHI_LAN_MODE: 'true' } as NodeJS.ProcessEnv)).toThrow('FATHI_LAN_HOST_REQUIRED_WHEN_LAN_ENABLED');
    expect(() => resolveServerListenConfig({ FATHI_LAN_MODE: 'true', FATHI_LAN_HOST: '192.168.1.20' } as NodeJS.ProcessEnv)).toThrow('FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED');
  });

  it('enables HTTPS when LAN certificate and key paths are configured', () => {
    expect(resolveServerListenConfig({
      FATHI_LAN_MODE: 'true',
      FATHI_LAN_HOST: '192.168.1.20',
      FATHI_LAN_TLS_CERT: '/secure/cert.pem',
      FATHI_LAN_TLS_KEY: '/secure/key.pem',
    } as NodeJS.ProcessEnv)).toMatchObject({
      host: '192.168.1.20',
      lanMode: true,
      protocol: 'https',
      tlsEnabled: true,
    });
  });
});

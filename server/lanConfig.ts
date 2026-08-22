export interface ServerListenConfig {
  port: number;
  lanMode: boolean;
  host: string;
  tlsEnabled: boolean;
  tlsKeyPath?: string;
  tlsCertPath?: string;
  protocol: 'http' | 'https';
}

export function resolveServerListenConfig(env: NodeJS.ProcessEnv = process.env): ServerListenConfig {
  const port = Number(env.PORT || 3000);
  const lanMode = env.FATHI_LAN_MODE === 'true';
  const configuredLanHost = env.FATHI_LAN_HOST?.trim() || env.FATHI_BIND_HOST?.trim();
  if (lanMode && !configuredLanHost) throw new Error('FATHI_LAN_HOST_REQUIRED_WHEN_LAN_ENABLED');

  const tlsKeyPath = env.FATHI_LAN_TLS_KEY?.trim();
  const tlsCertPath = env.FATHI_LAN_TLS_CERT?.trim();
  const tlsEnabled = Boolean(lanMode && tlsKeyPath && tlsCertPath);
  const allowInsecureHttp = env.FATHI_LAN_ALLOW_INSECURE_HTTP === 'true';
  if (lanMode && !tlsEnabled && !allowInsecureHttp) throw new Error('FATHI_LAN_TLS_CERT_AND_KEY_REQUIRED');

  return {
    port,
    lanMode,
    host: lanMode ? configuredLanHost! : '127.0.0.1',
    tlsEnabled,
    tlsKeyPath,
    tlsCertPath,
    protocol: tlsEnabled ? 'https' : 'http',
  };
}

import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const e2eDataDir = path.join(os.tmpdir(), `fathi-aqua-erp-e2e-${process.pid}`);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'dot' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Use the production bundle so CI/browser tests do not depend on tsx's
    // IPC helper and exercise the same server artifact shipped to desktop.
    command: 'node dist/server.cjs',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { FATHI_DATA_DIR: e2eDataDir, NODE_ENV: 'production' },
  },
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ACTIVE_UI_FILES = [
  'src/components/layout/Header.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/views/AuthModal.tsx',
  'src/components/views/DashboardView.tsx',
  'src/components/views/PondsView.tsx',
  'src/components/views/FeedingView.tsx',
  'src/components/views/BiometricsView.tsx',
  'src/components/views/WaterQualityView.tsx',
  'src/components/views/HatcheryView.tsx',
  'src/components/views/ProcessingView.tsx',
  'src/components/views/WarehouseView.tsx',
  'src/components/views/SalesCrmView.tsx',
  'src/components/views/AccountingView.tsx',
  'src/components/views/HrPayrollView.tsx',
  'src/components/views/AiAssistantView.tsx',
  'src/components/views/CrossPlatformView.tsx',
  'src/components/views/SecurityAuditView.tsx',
  'src/components/views/BackupRestoreView.tsx',
  'src/components/views/OperationsModuleView.tsx',
  'src/components/views/GlobalSearchModal.tsx',
];

// SocialMediaCommandCenterView intentionally embeds a complete seven-locale COPY table,
// so it is checked by its own locale coverage rather than this single-script scanner.

describe('Active UI hard-coded language guard', () => {
  it('contains no Persian/Arabic-script UI literals outside localization layers', () => {
    const offenders: string[] = [];
    for (const file of ACTIVE_UI_FILES) {
      const text = readFileSync(resolve(process.cwd(), file), 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (/[\u0600-\u06FF]/.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim().slice(0, 140)}`);
      });
    }
    expect(offenders, `Hard-coded RTL-script UI text found:\n${offenders.join('\n')}`).toEqual([]);
  });
});

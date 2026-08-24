import { describe, expect, it } from 'vitest';
import { assessDrRestoreReadiness } from '../utils/drRestoreReadiness';

describe('DR restore readiness', () => {
  it('fails closed until a fresh-machine restore and credential plan are verified', () => {
    const result = assessDrRestoreReadiness({
      backupExported: true,
      databaseFilePresent: true,
      serverEnvDocumented: true,
      installerArtifactPresent: true,
      credentialsRotatedOrReentered: false,
      restoreRunOnFreshMachine: false,
      loginAfterRestoreVerified: false,
      windowsUninstallPolicyDocumented: true,
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('Credential rotation or manual re-entry plan');
    expect(result.missing).toContain('Restore run on a fresh machine');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('passes only when all commercial restore gates are explicitly verified', () => {
    expect(assessDrRestoreReadiness({
      backupExported: true,
      databaseFilePresent: true,
      serverEnvDocumented: true,
      installerArtifactPresent: true,
      credentialsRotatedOrReentered: true,
      restoreRunOnFreshMachine: true,
      loginAfterRestoreVerified: true,
      windowsUninstallPolicyDocumented: true,
    }).ready).toBe(true);
  });
});

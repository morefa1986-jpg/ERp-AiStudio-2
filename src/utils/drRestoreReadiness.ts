export interface DrRestoreInput {
  backupExported: boolean;
  databaseFilePresent: boolean;
  serverEnvDocumented: boolean;
  installerArtifactPresent: boolean;
  credentialsRotatedOrReentered: boolean;
  restoreRunOnFreshMachine: boolean;
  loginAfterRestoreVerified: boolean;
  windowsUninstallPolicyDocumented: boolean;
}

export interface DrRestoreReadiness {
  ready: boolean;
  missing: string[];
  warnings: string[];
}

const REQUIRED: Array<[keyof DrRestoreInput, string]> = [
  ['backupExported', 'Encrypted ERP backup export'],
  ['databaseFilePresent', 'SQLite/database payload'],
  ['serverEnvDocumented', 'Server environment and port/TLS configuration'],
  ['installerArtifactPresent', 'Windows installer or portable artifact'],
  ['credentialsRotatedOrReentered', 'Credential rotation or manual re-entry plan'],
  ['restoreRunOnFreshMachine', 'Restore run on a fresh machine'],
  ['loginAfterRestoreVerified', 'Login and state-load verification after restore'],
  ['windowsUninstallPolicyDocumented', 'Uninstall and retain/delete-data policy'],
];

export function assessDrRestoreReadiness(input: DrRestoreInput): DrRestoreReadiness {
  const missing = REQUIRED.filter(([key]) => !input[key]).map(([, label]) => label);
  const warnings: string[] = [];
  if (!input.credentialsRotatedOrReentered) warnings.push('Credentials, API tokens, hardware drivers and scheduler secrets are intentionally not embedded in ERP backups.');
  if (!input.restoreRunOnFreshMachine) warnings.push('A build artifact is not equal to a proven disaster-recovery restore.');
  return { ready: missing.length === 0, missing, warnings };
}

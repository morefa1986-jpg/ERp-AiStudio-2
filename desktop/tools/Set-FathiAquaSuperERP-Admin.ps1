param(
  [string]$Username = "morefa1986",
  [string]$FullName = "محمدرضا فتحی",
  [string]$Email = "admin@fathiaqua.local",
  [string]$Role = "Super Admin",
  [string]$DatabasePath = "",
  [SecureString]$Password
)

$ErrorActionPreference = "Stop"

if (-not $DatabasePath) {
  $DatabasePath = Join-Path $env:LOCALAPPDATA "FathiAquaSuperERP\data\fathi-aqua-erp.sqlite"
}

if (-not (Test-Path $DatabasePath)) {
  throw "Database not found: $DatabasePath. Run the ERP once first, or pass -DatabasePath."
}

if (-not $Password) {
  $Password = Read-Host "New admin password" -AsSecureString
}

$plainPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($plainPtr)
} finally {
  if ($plainPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($plainPtr) }
}

if (-not $plainPassword -or $plainPassword.Length -lt 12) {
  throw "Password must be at least 12 characters."
}

$env:FATHI_RESET_DB = $DatabasePath
$env:FATHI_RESET_USERNAME = $Username.Trim().ToLowerInvariant()
$env:FATHI_RESET_FULLNAME = $FullName
$env:FATHI_RESET_EMAIL = $Email
$env:FATHI_RESET_ROLE = $Role
$env:FATHI_RESET_PASSWORD = $plainPassword

$nodeScript = @'
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.FATHI_RESET_DB);
const username = process.env.FATHI_RESET_USERNAME;
const fullName = process.env.FATHI_RESET_FULLNAME || 'Administrator';
const email = process.env.FATHI_RESET_EMAIL || 'admin@fathiaqua.local';
const role = process.env.FATHI_RESET_ROLE || 'Super Admin';
const plain = process.env.FATHI_RESET_PASSWORD || '';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(plain, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
const passwordHash = ['scrypt', 16384, 8, 1, salt, hash].join('$');
const now = new Date().toISOString();
const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
if (existing) {
  db.prepare('UPDATE users SET full_name = ?, email = ?, role = ?, password_hash = ?, is_active = 1, preferred_language = COALESCE(preferred_language, ?) WHERE id = ?')
    .run(fullName, email, role, passwordHash, 'fa', existing.id);
  console.log(`Updated admin user: ${username}`);
} else {
  db.prepare('INSERT INTO users (id, username, full_name, email, role, password_hash, is_active, preferred_language, last_login_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?)')
    .run(`usr_${crypto.randomUUID()}`, username, fullName, email, role, passwordHash, 'fa', now);
  console.log(`Created admin user: ${username}`);
}
db.prepare('INSERT INTO audit_log (id, timestamp, user_id, user_role, action, entity, entity_id, after_state, transaction_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(`audit_${crypto.randomUUID()}`, now, 'local-admin-tool', 'Super Admin', 'PASSWORD_RESET', 'User', username, JSON.stringify({ username, role }), `txn_${crypto.randomUUID()}`);
db.close();
'@

$tempScript = Join-Path $env:TEMP "fathi-set-admin-$([Guid]::NewGuid().ToString('N')).cjs"
try {
  Set-Content -Path $tempScript -Value $nodeScript -Encoding UTF8
  node $tempScript
  Write-Host "Admin username is: $Username"
  Write-Host "Password was hashed and stored securely. The plain password was not written to disk."
} finally {
  Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
  Remove-Item Env:\FATHI_RESET_DB -ErrorAction SilentlyContinue
  Remove-Item Env:\FATHI_RESET_USERNAME -ErrorAction SilentlyContinue
  Remove-Item Env:\FATHI_RESET_FULLNAME -ErrorAction SilentlyContinue
  Remove-Item Env:\FATHI_RESET_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:\FATHI_RESET_ROLE -ErrorAction SilentlyContinue
  Remove-Item Env:\FATHI_RESET_PASSWORD -ErrorAction SilentlyContinue
  $plainPassword = $null
}

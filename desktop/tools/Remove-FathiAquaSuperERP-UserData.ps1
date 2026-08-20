param(
    [switch]$ConfirmDelete
)

$ErrorActionPreference = 'Stop'
$DataRoot = Join-Path $env:LOCALAPPDATA 'FathiAquaSuperERP'

Write-Host 'Fathi Aqua SuperERP - User Data Cleanup' -ForegroundColor Cyan
Write-Host "Data folder: $DataRoot"
Write-Host ''

if (-not $ConfirmDelete) {
    Write-Host 'No data was deleted.' -ForegroundColor Yellow
    Write-Host 'Normal Windows uninstall intentionally preserves ERP data and backups.'
    Write-Host 'To permanently remove all local ERP user data, run:'
    Write-Host '  powershell -ExecutionPolicy Bypass -File .\Remove-FathiAquaSuperERP-UserData.ps1 -ConfirmDelete' -ForegroundColor White
    exit 0
}

if (Test-Path $DataRoot) {
    Remove-Item -LiteralPath $DataRoot -Recurse -Force
    Write-Host 'All Fathi Aqua SuperERP local user data was permanently deleted.' -ForegroundColor Green
} else {
    Write-Host 'No local ERP user-data folder was found.' -ForegroundColor Yellow
}

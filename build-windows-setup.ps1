# ==============================================================================
# NS LUXURY VILLA MANAGEMENT SYSTEM — NATIVE WINDOWS BUILD & SETUP SCRIPT
# Builds the cloud-connected Electron installer (.exe).
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Gold
Write-Host " 🏰 NS LUXURY VILLA — Windows Native Installer Build System" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Gold

# Check Node environment
$nodeVersion = node -v 2>$null
if (-not $nodeVersion) {
    Write-Error "Node.js is not installed or not in PATH. Please install Node.js v20+."
    exit 1
}
Write-Host "✔️ Node.js Version: $nodeVersion" -ForegroundColor Green

# Build Desktop Electron Installer
Write-Host "`n[1/1] Building Native Windows Installer (.exe) with Electron Builder..." -ForegroundColor Cyan
npm.cmd run build:desktop
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to build @nslv/desktop installer"; exit $LASTEXITCODE }

Write-Host "`n======================================================================" -ForegroundColor Gold
Write-Host " 🎉 BUILD SUCCESSFUL! NATIVE WINDOWS SETUP PACKAGE IS READY." -ForegroundColor Green
Write-Host " 📦 Installer location: packages\desktop\release\" -ForegroundColor Yellow
Write-Host " 📤 Publish Setup.exe, its .blockmap, and latest.yml to the HTTPS update directory for each release." -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Gold

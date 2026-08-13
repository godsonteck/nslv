# ==============================================================================
# NS LUXURY VILLA MANAGEMENT SYSTEM — NATIVE WINDOWS BUILD & SETUP SCRIPT
# Builds shared libraries, frontend client, backend server, and Electron installer (.exe)
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

# 1. Build Shared Package
Write-Host "`n[1/4] Building @nslv/shared..." -ForegroundColor Cyan
npm run build:shared
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to build @nslv/shared"; exit $LASTEXITCODE }

# 2. Build Frontend Client
Write-Host "`n[2/4] Building @nslv/client (Vite Production Assets)..." -ForegroundColor Cyan
npm run build:client
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to build @nslv/client"; exit $LASTEXITCODE }

# 3. Build Backend Server
Write-Host "`n[3/4] Building @nslv/server (TypeScript Backend API)..." -ForegroundColor Cyan
npm run build:server
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to build @nslv/server"; exit $LASTEXITCODE }

# 4. Build Desktop Electron Installer
Write-Host "`n[4/4] Building Native Windows Installer (.exe) with Electron Builder..." -ForegroundColor Cyan
npm run build:desktop
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to build @nslv/desktop installer"; exit $LASTEXITCODE }

Write-Host "`n======================================================================" -ForegroundColor Gold
Write-Host " 🎉 BUILD SUCCESSFUL! NATIVE WINDOWS SETUP PACKAGE IS READY." -ForegroundColor Green
Write-Host " 📦 Installer location: packages\desktop\release\" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Gold

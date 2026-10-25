# PowerShell script to start DocSpace Backend and Frontend on Windows

$rootDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$pidsDir = Join-Path $rootDir ".pids"
$logsDir = Join-Path $rootDir "logs"

New-Item -ItemType Directory -Force -Path $pidsDir | Out-Null
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Starting DocSpace Platform Servers (Windows) " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Backend (Port 8000)
$backendConn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($backendConn) {
    Write-Host "[!] Backend port 8000 is already in use by PID $($backendConn.OwningProcess)." -ForegroundColor Yellow
} else {
    Write-Host "[*] Starting FastAPI Backend on port 8000..." -ForegroundColor Green
    $pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
    if (-not (Test-Path $pythonExe)) {
        $pythonExe = "python"
    }
    
    $backendProcess = Start-Process -FilePath $pythonExe `
        -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload" `
        -WorkingDirectory $backendDir `
        -RedirectStandardOutput (Join-Path $logsDir "backend.log") `
        -RedirectStandardError (Join-Path $logsDir "backend-error.log") `
        -PassThru

    Set-Content -Path (Join-Path $pidsDir "backend.pid") -Value $backendProcess.Id
    Write-Host "   [OK] Backend started (PID: $($backendProcess.Id))" -ForegroundColor Green
}

# 2. Check Frontend (Port 3000)
$frontendConn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($frontendConn) {
    Write-Host "[!] Frontend port 3000 is already in use by PID $($frontendConn.OwningProcess)." -ForegroundColor Yellow
} else {
    Write-Host "[*] Starting Next.js Frontend on port 3000..." -ForegroundColor Green
    
    $frontendProcess = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "npm run dev" `
        -WorkingDirectory $rootDir `
        -RedirectStandardOutput (Join-Path $logsDir "frontend.log") `
        -RedirectStandardError (Join-Path $logsDir "frontend-error.log") `
        -PassThru

    Set-Content -Path (Join-Path $pidsDir "frontend.pid") -Value $frontendProcess.Id
    Write-Host "   [OK] Frontend started (PID: $($frontendProcess.Id))" -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  DocSpace Platform is Live!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Frontend Web:       http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API:        http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs (Swagger): http://localhost:8000/docs" -ForegroundColor White
Write-Host "  To stop servers:    powershell -File scripts/stop-servers.ps1" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Cyan

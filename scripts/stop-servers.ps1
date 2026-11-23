# PowerShell script to stop DocSpace Backend and Frontend on Windows

$rootDir = Split-Path -Parent $PSScriptRoot
$pidsDir = Join-Path $rootDir ".pids"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Stopping DocSpace Platform Servers (Windows) " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

function Stop-PortProcess([int]$port, [string]$name) {
    Write-Host "Checking $name on port $port..." -ForegroundColor Yellow
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $pids) {
            try {
                & taskkill /PID $procId /T /F 2>$null | Out-Null
                Write-Host "   [OK] Terminated $name process tree (PID: $procId)" -ForegroundColor Green
            } catch {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "   [OK] Terminated $name process (PID: $procId)" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "   [i] No process listening on port $port." -ForegroundColor Gray
    }
}

# Stop Frontend (3000) and Backend (8000)
Stop-PortProcess -port 3000 -name "Frontend"
Stop-PortProcess -port 8000 -name "Backend"

# Clean up PID files
if (Test-Path $pidsDir) {
    Remove-Item (Join-Path $pidsDir "*.pid") -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  DocSpace servers stopped." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

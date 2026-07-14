$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$serviceDir = Join-Path $root "services\akshare-service"
$python = Join-Path $serviceDir ".venv\Scripts\python.exe"

if (!(Test-Path $python)) {
  Write-Error "Python virtual environment not found: $python. Run: python -m venv services/akshare-service/.venv"
  exit 1
}

$env:PYTHONPATH = $serviceDir
$hostName = if ($env:AKSHARE_SERVICE_HOST) { $env:AKSHARE_SERVICE_HOST } else { "127.0.0.1" }
$port = if ($env:AKSHARE_SERVICE_PORT) { $env:AKSHARE_SERVICE_PORT } else { "8001" }

Write-Host "Starting AKShare FastAPI service on $hostName`:$port"
Set-Location $serviceDir
& $python -m uvicorn app.main:app --host $hostName --port $port

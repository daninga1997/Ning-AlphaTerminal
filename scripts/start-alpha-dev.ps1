$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$serviceScript = Join-Path $root "scripts\start-akshare-service.ps1"
$checkScript = Join-Path $root "scripts\check-akshare-service.ps1"
$python = Join-Path $root "services\akshare-service\.venv\Scripts\python.exe"

if (!(Test-Path $python)) {
  Write-Error "AKShare Python virtual environment is missing. Create it and install requirements first."
  exit 1
}

Write-Host "Opening AKShare service in a visible PowerShell window..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$serviceScript`""
)

Write-Host "Waiting for AKShare service health check..."
$healthy = $false
for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  try {
    & powershell -ExecutionPolicy Bypass -File $checkScript
    if ($LASTEXITCODE -ne 0) {
      continue
    }
    $healthy = $true
    break
  } catch {
    Write-Host "AKShare service not ready yet..."
  }
}

if (!$healthy) {
  Write-Error "AKShare service failed health check."
  exit 1
}

Set-Location $root
Write-Host "Starting Alpha Terminal Next.js dev server..."
& "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" run dev

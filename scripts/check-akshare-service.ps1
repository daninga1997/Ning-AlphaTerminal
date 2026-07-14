$ErrorActionPreference = "Stop"

$baseUrl = $env:AKSHARE_SERVICE_BASE_URL
if ([string]::IsNullOrWhiteSpace($baseUrl)) {
  $baseUrl = "http://127.0.0.1:8001"
}

try {
  $response = Invoke-RestMethod -Uri "$baseUrl/health" -TimeoutSec 10
  Write-Host "AKShare service health:" -ForegroundColor Green
  $response | ConvertTo-Json -Depth 8
} catch {
  Write-Error "AKShare service is not healthy at $baseUrl. $($_.Exception.Message)"
  exit 1
}

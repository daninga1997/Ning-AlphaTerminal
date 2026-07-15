param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"
Write-Host "GET /api/market/storage/health"
Invoke-RestMethod -Uri "$BaseUrl/api/market/storage/health" | ConvertTo-Json -Depth 8
Write-Host "GET /api/market/storage/coverage"
Invoke-RestMethod -Uri "$BaseUrl/api/market/storage/coverage" | ConvertTo-Json -Depth 8

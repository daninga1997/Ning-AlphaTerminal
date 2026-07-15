param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$Codes = ""
)

$ErrorActionPreference = "Stop"
$headers = @{ "x-alpha-local-sync" = "true" }
$body = if ($Codes.Trim().Length -gt 0) { @{ codes = $Codes.Split(",") } | ConvertTo-Json } else { "{}" }

foreach ($path in @("/api/market/sync/quotes", "/api/market/sync/sectors", "/api/market/sync/overview")) {
  Write-Host "POST $path"
  Invoke-RestMethod -Method Post -Uri "$BaseUrl$path" -Headers $headers -ContentType "application/json" -Body $body | ConvertTo-Json -Depth 8
}

param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [string]$Now = ""
)

$ErrorActionPreference = "Stop"
$headers = @{ "x-alpha-local-sync" = "true" }
$payload = if ($Now.Trim().Length -gt 0) { @{ now = $Now } | ConvertTo-Json } else { "{}" }

Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/market/finalize-day" -Headers $headers -ContentType "application/json" -Body $payload | ConvertTo-Json -Depth 10

$r = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"login":"admin@nsvilla.com","password":"Admin@NSVilla2026!"}' -UseBasicParsing
$token = ($r.Content | ConvertFrom-Json).data.tokens.accessToken
Write-Host "Token: $($token.Substring(0,20))..."

@("2026-08-23", "2026-08-22", "2026-08-24") | ForEach-Object {
    $d = $_
    Write-Host "Testing date: $d"
    $r = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/cash-register?businessDate=$d" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data.data
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "carriedIntoToday: $($data.carriedIntoToday)"
    Write-Host "expectedCash: $($data.expectedCash)"
    Write-Host "entries count: $($data.entries.Count)"
    Write-Host "---"
    Start-Sleep -Milliseconds 100
}
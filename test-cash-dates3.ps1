$r = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"login":"admin@nsvilla.com","password":"Admin@NSVilla2026!"}' -UseBasicParsing
$token = ($r.Content | ConvertFrom-Json).data.tokens.accessToken
Write-Host "Token: $($token.Substring(0,20))..."

$dates = @("2026-08-23", "2026-08-22", "2026-08-24")

foreach ($d in $dates) {
    $r = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/cash-register?businessDate=$d" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data.data
    Write-Host "$d : carried=$($d.carriedIntoToday) expected=$($d.expectedCash) entries=$($d.entries.Count)"
    Start-Sleep -Milliseconds 100
}
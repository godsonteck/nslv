$r = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/auth/login" -Method POST -ContentType "application/json" -Body '{"login":"admin@nsvilla.com","password":"Admin@NSVilla2026!"}' -UseBasicParsing
$token = ($r.Content | ConvertFrom-Json).data.tokens.accessToken
Write-Host "Token: $($token.Substring(0,20))..."

$today = (Get-Date).ToString("yyyy-MM-dd")
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$tomorrow = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")

$dates = @($today, $yesterday, (Get-Date).AddDays(1).ToString("yyyy-MM-dd"))

foreach ($d in @($today, $yesterday, (Get-Date).AddDays(1).ToString("yyyy-MM-dd"))) {
    $r = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/cash-register?businessDate=$d" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data.data
    Write-Host "$d : carried=$($data.carriedIntoToday) expected=$($data.expectedCash) entries=$($data.entries.Count)"
}
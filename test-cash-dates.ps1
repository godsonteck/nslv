$token = Get-Content token.txt
Write-Host "Token: $($token.Substring(0,20))..."

$today = (Get-Date).ToString("yyyy-MM-dd")
$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$tomorrow = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")

$dates = @($today, $yesterday, $tomorrow)

foreach ($d in $dates) {
    $r = Invoke-WebRequest -Uri "http://localhost:3001/api/v1/cash-register?businessDate=$d" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    $data = ($r.Content | ConvertFrom-Json).data.data
    Write-Host "$d : carried=$($data.carriedIntoToday) expected=$($data.expectedCash) entries=$($data.entries.Count)"
}
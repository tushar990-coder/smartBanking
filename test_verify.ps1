$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking_JotirlingPdw;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()

$cmd.CommandText = "SELECT COUNT(*) FROM Users"
$u = $cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM Roles"
$r = $cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM Branches"
$b = $cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM FinancialYears"
$f = $cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM SansthaDetails"
$s = $cmd.ExecuteScalar()

$conn.Close()

Write-Host "==================================================================" -ForegroundColor Green
Write-Host "LIVE VERIFICATION ON SmartBanking_JotirlingPdw:" -ForegroundColor Green
Write-Host "  -> Users:          $u" -ForegroundColor Green
Write-Host "  -> Roles:          $r" -ForegroundColor Green
Write-Host "  -> Branches:       $b" -ForegroundColor Green
Write-Host "  -> FinancialYears: $f" -ForegroundColor Green
Write-Host "  -> SansthaDetails: $s" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green

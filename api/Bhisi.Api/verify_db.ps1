$connStr = "Server=.;Database=Gurudev_SmartBanking;Trusted_Connection=True;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM sys.tables"
$tableCount = $cmd.ExecuteScalar()
Write-Host "SmartBanking_Gurudev Total Tables: $tableCount" -ForegroundColor Cyan

$cmd.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('PigmyAgents') AND name = 'JoiningDate'"
$colCheck = $cmd.ExecuteScalar()
if ($colCheck -gt 0) {
    Write-Host "SUCCESS: Verified JoiningDate column exists in PigmyAgents (Latest migration applied!)" -ForegroundColor Green
} else {
    Write-Host "WARNING: JoiningDate column missing in PigmyAgents" -ForegroundColor Red
}

$conn.Close()

$server = 'tcp:43.239.93.47,15050'
$dbName = 'SmartBanking_Testing'
$user = 'sa'
$password = 'Mindspace2026'

$connStr = "Server=$server;Database=$dbName;User Id=$user;Password=$password;Trusted_Connection=False;TrustServerCertificate=True;Connect Timeout=30;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$sqlFile = Join-Path $PSScriptRoot "migration_pigmy_withdrawal_day1_reset.sql"
$sql = Get-Content $sqlFile -Raw

$batches = $sql -split '(?m)^\s*GO\s*$'
foreach ($batch in $batches) {
    if ($batch.Trim()) {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $batch
        $cmd.ExecuteNonQuery() | Out-Null
    }
}

Write-Host "Migration executed successfully!" -ForegroundColor Green

# Verify columns in PigmyAccounts
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PigmyAccounts' AND COLUMN_NAME IN ('EffectiveStartDate', 'CurrentCycleNumber', 'LastWithdrawalDate', 'TotalWithdrawnAmount')"
$reader = $cmd.ExecuteReader()
Write-Host "`nPigmyAccounts Columns:" -ForegroundColor Yellow
while ($reader.Read()) {
    Write-Host " - $($reader[0]) ($($reader[1]))" -ForegroundColor Gray
}
$reader.Close()

# Verify PigmyWithdrawals table
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE name = 'PigmyWithdrawals'"
$tableExists = $cmd.ExecuteScalar()
Write-Host "PigmyWithdrawals Table Exists: $tableExists" -ForegroundColor Yellow

$conn.Close()

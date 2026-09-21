$ErrorActionPreference = "Stop"
$server = "tcp:43.239.93.47,15050"
$dbName = "SmartBanking_Testing"
$user = "sa"
$password = "Mindspace2026"

Write-Host "Connecting to $dbName on $server..." -ForegroundColor Cyan
$connStr = "Server=$server;Database=$dbName;User Id=$user;Password=$password;Trusted_Connection=False;TrustServerCertificate=True;Connect Timeout=30;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('Members')"
$initialCols = $cmd.ExecuteScalar()
Write-Host "Initial Members Columns in $($dbName): $initialCols" -ForegroundColor Yellow

$cmd.CommandText = "SELECT COUNT(*) FROM Members"
$initialMembers = $cmd.ExecuteScalar()
Write-Host "Initial Members Records in $($dbName): $initialMembers" -ForegroundColor Yellow

$cmd.CommandText = "SELECT COUNT(*) FROM ShareAccounts WHERE TotalShareCount > 0"
$initialShares = $cmd.ExecuteScalar()
Write-Host "Active Shareholders in $($dbName): $initialShares" -ForegroundColor Yellow

$conn.Close()

$scriptPath = Join-Path $PSScriptRoot "members_normalization_and_cleanup.sql"
Write-Host "`nExecuting $scriptPath on $server ($dbName)..." -ForegroundColor Cyan
& sqlcmd -S $server -U $user -P $password -d $dbName -i $scriptPath -b

# Verify results
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('Members')"
$finalCols = $cmd.ExecuteScalar()
Write-Host "`nFinal Members Columns in $($dbName): $finalCols (Expected: 13)" -ForegroundColor Green

$cmd.CommandText = "SELECT COUNT(*) FROM Members"
$finalMembers = $cmd.ExecuteScalar()
Write-Host "Final Members Records in $($dbName): $finalMembers (Expected: $initialShares)" -ForegroundColor Green

$cmd.CommandText = "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('Members') ORDER BY column_id"
$reader = $cmd.ExecuteReader()
Write-Host "`nRemaining Canonical Columns:" -ForegroundColor White
while ($reader.Read()) {
    Write-Host (" - " + $reader[0]) -ForegroundColor Gray
}
$reader.Close()
$conn.Close()

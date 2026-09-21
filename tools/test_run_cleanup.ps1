$ErrorActionPreference = "Stop"
$sqlServer = "."
$dbName = "SmartBanking"
$connStr = "Server=$sqlServer;Database=$dbName;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=30;"

Write-Host "Connecting to $dbName on $sqlServer..." -ForegroundColor Cyan
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

# Check initial column count
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('Members')"
$initialCols = $cmd.ExecuteScalar()
Write-Host "Initial Members Columns: $initialCols" -ForegroundColor Yellow

$cmd.CommandText = "SELECT COUNT(*) FROM Members"
$initialMembers = $cmd.ExecuteScalar()
Write-Host "Initial Members Records: $initialMembers" -ForegroundColor Yellow

$cmd.CommandText = "SELECT COUNT(*) FROM ShareAccounts WHERE TotalShareCount > 0"
$initialShares = $cmd.ExecuteScalar()
Write-Host "Active Shareholders (TotalShareCount > 0): $initialShares" -ForegroundColor Yellow

$conn.Close()

# Execute script using sqlcmd or ADO.NET with batch splitting
$scriptPath = Join-Path $PSScriptRoot "members_normalization_and_cleanup.sql"
Write-Host "`nExecuting $scriptPath via sqlcmd..." -ForegroundColor Cyan
& sqlcmd -S $sqlServer -d $dbName -E -i $scriptPath -b

# Verify results
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('Members')"
$finalCols = $cmd.ExecuteScalar()
Write-Host "`nFinal Members Columns: $finalCols (Expected: 12)" -ForegroundColor Green

$cmd.CommandText = "SELECT COUNT(*) FROM Members"
$finalMembers = $cmd.ExecuteScalar()
Write-Host "Final Members Records: $finalMembers" -ForegroundColor Green

$cmd.CommandText = "SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('Members') ORDER BY column_id"
$reader = $cmd.ExecuteReader()
Write-Host "`nRemaining Canonical Columns:" -ForegroundColor White
while ($reader.Read()) {
    Write-Host (" - " + $reader[0]) -ForegroundColor Gray
}
$reader.Close()
$conn.Close()

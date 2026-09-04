$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('Members') AND name = 'NickName'
)
BEGIN
    ALTER TABLE Members ADD NickName NVARCHAR(100) NULL;
END
"@
    $cmd.ExecuteNonQuery()
    Write-Host "SUCCESS: NickName column checked/added to Members table successfully!" -ForegroundColor Green
    $conn.Close()
} catch {
    Write-Host "ERROR: Failed to alter table: $($_.Exception.Message)" -ForegroundColor Red
}

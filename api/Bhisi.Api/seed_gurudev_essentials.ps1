$connStr = "Server=.;Database=SmartBanking_Gurudev;Trusted_Connection=True;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()

$cmd.CommandText = @"
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Users]') AND name = 'ActiveSessionToken')
BEGIN
    ALTER TABLE [Users] ALTER COLUMN [ActiveSessionToken] nvarchar(max) NULL;
END
"@
$cmd.ExecuteNonQuery()
Write-Host "Altered ActiveSessionToken to nvarchar(max) successfully"
$conn.Close()

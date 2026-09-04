$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = '20260806031847_LatestUpdates') INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES ('20260806031847_LatestUpdates', '10.0.9');"
$cmd.ExecuteNonQuery()

Write-Host "Migration history successfully updated for SmartBanking database." -ForegroundColor Green
$conn.Close()

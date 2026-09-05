$connString = "Server=.\SQLEXPRESS01;Database=SmartBanking_JotirlingPdw;Trusted_Connection=True;TrustServerCertificate=True;"
$query = "DELETE FROM [dbo].[PigmyAgents]; DBCC CHECKIDENT ('[dbo].[PigmyAgents]', RESEED, 0);"
$conn = New-Object System.Data.SqlClient.SqlConnection($connString)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = $query
$cmd.ExecuteNonQuery()
$conn.Close()
Write-Host "Done"

$connStr = "Server=.;Database=SmartBanking_ShareTest;Trusted_Connection=True;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT LedgerID, LedgerName, AccountType, OpeningBalance FROM Ledgers WHERE LedgerID = 47 OR LedgerName LIKE N'%रोख%' OR AccountType = 'Cash'"
$reader = $cmd.ExecuteReader()
while ($reader.Read()) {
    Write-Host "LedgerID: $($reader['LedgerID']) | Name: $($reader['LedgerName']) | Type: $($reader['AccountType']) | OB: $($reader['OpeningBalance'])"
}
$conn.Close()

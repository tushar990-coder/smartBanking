$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, CashierName, CounterNumber, Remarks FROM Cashiers"
$r = $cmd.ExecuteReader()
while($r.Read()) {
    $chars = [char[]]$r["CashierName"]
    $hex = ($chars | ForEach-Object { "U+" + ([int]$_).ToString("X4") }) -join " "
    Write-Host ("ID: " + $r["Id"] + " | Name: " + $r["CashierName"] + " | Chars: " + $hex)
}
$conn.Close()

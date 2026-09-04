$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, CashierName, CounterNumber, Remarks FROM Cashiers"
$r = $cmd.ExecuteReader()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
while($r.Read()) {
    Write-Host ("ID: " + $r["Id"] + " | Name: " + $r["CashierName"] + " | Counter: " + $r["CounterNumber"] + " | Remarks: " + $r["Remarks"])
}
$conn.Close()

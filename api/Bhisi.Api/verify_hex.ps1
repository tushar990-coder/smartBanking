$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, CashierName, CounterNumber, Remarks FROM Cashiers"
$r = $cmd.ExecuteReader()
while($r.Read()) {
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($r["CashierName"])
    $base64 = [System.Convert]::ToBase64String($bytes)
    Write-Host ("ID: " + $r["Id"] + " | Base64: " + $base64 + " | String: " + $r["CashierName"])
}
$conn.Close()

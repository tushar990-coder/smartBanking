$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT BranchID, BranchCode, BranchName, Address FROM Branches"
$r = $cmd.ExecuteReader()
while($r.Read()) {
    Write-Host ("BranchID: " + $r["BranchID"] + " | Code: " + $r["BranchCode"] + " | Name: " + $r["BranchName"] + " | Address: " + $r["Address"])
}
$conn.Close()

$server = 'tcp:43.239.93.47,15050'
$dbName = 'SmartBanking_Testing'
$user = 'sa'
$password = 'Mindspace2026'

$connStr = "Server=$server;Database=$dbName;User Id=$user;Password=$password;Trusted_Connection=False;TrustServerCertificate=True;Connect Timeout=30;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = @"
SELECT 
    s.PigmySchemeID, 
    s.SchemeCode, 
    s.SchemeName, 
    s.InterestRate, 
    ISNULL(s.PrematureInterestRate, 0) as PrematureRate, 
    ISNULL(s.PenaltyInterestRate, 0) as PenaltyRate, 
    COUNT(sl.SlabID) as SlabsCount
FROM PigmySchemes s 
LEFT JOIN PigmySchemeInterestSlabs sl ON s.PigmySchemeID = sl.PigmySchemeID 
GROUP BY s.PigmySchemeID, s.SchemeCode, s.SchemeName, s.InterestRate, s.PrematureInterestRate, s.PenaltyInterestRate
ORDER BY s.PigmySchemeID
"@

$reader = $cmd.ExecuteReader()
Write-Host "`n--- EXISTING PIGMY SCHEMES IN DATABASE ---" -ForegroundColor Cyan
while ($reader.Read()) {
    $id = $reader["PigmySchemeID"]
    $code = $reader["SchemeCode"]
    $name = $reader["SchemeName"]
    $rate = $reader["InterestRate"]
    $prem = $reader["PrematureRate"]
    $pen = $reader["PenaltyRate"]
    $slabs = $reader["SlabsCount"]
    Write-Host "Scheme #$id ($code) '$name' | Rate: $rate% | Premature: $prem% | Penalty: $pen% | Slabs Count: $slabs" -ForegroundColor $(if ($slabs -gt 0) { "Green" } else { "Yellow" })
}
$reader.Close()
$conn.Close()

$dbs = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")
$sql = [System.IO.File]::ReadAllText("d:\Bhisi Software\tools\master_vps_update_schema.sql", [System.Text.Encoding]::UTF8)

foreach ($db in $dbs) {
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;")
        $conn.Open()
        
        # Split by GO
        $batches = $sql -split "(?m)^\s*GO\s*$"
        foreach ($b in $batches) {
            $trimmed = $b.Trim()
            if ($trimmed.Length -gt 0) {
                $cmd = $conn.CreateCommand()
                $cmd.CommandText = $trimmed
                $cmd.ExecuteNonQuery() | Out-Null
            }
        }
        Write-Host "SUCCESS: Fully updated schema for '$db'!" -ForegroundColor Green
        $conn.Close()
    } catch {
        Write-Host "Error for '$db': $($_.Exception.Message)" -ForegroundColor Red
    }
}

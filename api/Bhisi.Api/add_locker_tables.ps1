$databases = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")

$sqlScript = Get-Content -Path "d:\Bhisi Software\api\Bhisi.Api\create_locker_tables.sql" -Raw

foreach ($db in $databases) {
    $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sqlScript
        $cmd.ExecuteNonQuery()
        Write-Host "SUCCESS: Locker tables created/verified on '$db' database!" -ForegroundColor Green
        $conn.Close()
    } catch {
        Write-Host "Notice for '$db': $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

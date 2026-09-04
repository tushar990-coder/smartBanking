[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$servers = @(".\SQLEXPRESS01", ".", "localhost", "(local)")
$dbName = "SmartBanking_JotirlingPdw"
$sqlPath = "d:\Bhisi Software\tools\V2_Migrate_Customer_Member_Split.sql"

$sqlContent = [System.IO.File]::ReadAllText($sqlPath)
$success = $false

foreach ($srv in $servers) {
    $connStr = "Server=$srv;Database=$dbName;Trusted_Connection=True;TrustServerCertificate=True;"
    try {
        Write-Host "Attempting connection to server: $srv, database: $dbName..." -ForegroundColor Cyan
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        Write-Host "Connected successfully to $srv!" -ForegroundColor Green
        
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sqlContent
        $cmd.CommandTimeout = 120
        $cmd.ExecuteNonQuery() | Out-Null
        
        Write-Host "V2 Migration Script executed successfully on $srv!" -ForegroundColor Green
        $conn.Close()
        $success = $true
        break
    }
    catch {
        Write-Host "Failed on $srv : $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

if (-not $success) {
    Write-Host "Could not apply migration to $dbName on any server." -ForegroundColor Red
}

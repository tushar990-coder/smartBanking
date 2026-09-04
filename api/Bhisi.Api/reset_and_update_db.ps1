param (
    [string]$DbName = "SmartBanking_Gurudev",
    [string]$Server = "."
)

$masterConnStr = "Server=$Server;Database=master;Trusted_Connection=True;TrustServerCertificate=True"
$conn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
$conn.Open()

$cmd = $conn.CreateCommand()
$cmd.CommandText = "IF EXISTS (SELECT name FROM sys.databases WHERE name = '$DbName') BEGIN ALTER DATABASE [$DbName] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$DbName]; END; CREATE DATABASE [$DbName];"
$cmd.ExecuteNonQuery()
$conn.Close()

Write-Host "Fresh empty database '$DbName' created." -ForegroundColor Green

$targetConnStr = "Server=$Server;Database=$DbName;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
Write-Host "Applying all migrations from scratch..." -ForegroundColor Yellow

$env:ConnectionStrings__DefaultConnection = $targetConnStr
dotnet ef database update --project "d:\Bhisi Software\api\Bhisi.Api" --connection "$targetConnStr"

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Database '$DbName' created cleanly with ALL migrations and latest changes!" -ForegroundColor Green
} else {
    Write-Host "ERROR: Database migration failed." -ForegroundColor Red
}

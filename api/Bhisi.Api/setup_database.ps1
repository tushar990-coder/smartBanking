param (
    [string]$DbName = "SmartBanking_Gurudev",
    [string]$Server = "."
)

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " SmartBanking Database Creator and Update Tool" -ForegroundColor Cyan
Write-Host " Target Database: $DbName on Server: $Server" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Create Database if not exists
$masterConnStr = "Server=$Server;Database=master;Trusted_Connection=True;TrustServerCertificate=True"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '$DbName') CREATE DATABASE [$DbName];"
    $cmd.ExecuteNonQuery()
    $conn.Close()
    Write-Host "[SUCCESS] Database '$DbName' created or verified on server '$Server'." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to connect or create database '$DbName': $_" -ForegroundColor Red
    exit 1
}

# 2. Run EF Core Database Update
$targetConnStr = "Server=$Server;Database=$DbName;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
Write-Host "[INFO] Applying EF Core Migrations (Schema and Latest Changes)..." -ForegroundColor Yellow

$env:ConnectionStrings__DefaultConnection = $targetConnStr
dotnet ef database update --project "d:\Bhisi Software\api\Bhisi.Api" --connection "$targetConnStr"

if ($LASTEXITCODE -eq 0) {
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host " SUCCESS: Database '$DbName' is ready with ALL latest changes!" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
} else {
    Write-Host "[ERROR] EF Migration update failed." -ForegroundColor Red
}

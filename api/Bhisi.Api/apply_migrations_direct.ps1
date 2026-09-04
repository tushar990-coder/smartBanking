param (
    [string]$DbName = "SmartBanking_Gurudev"
)

$targetConnStr = "Server=.;Database=$DbName;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
Write-Host "Updating database '$DbName'..." -ForegroundColor Yellow

$env:ConnectionStrings__DefaultConnection = $targetConnStr
dotnet ef database update --project "d:\Bhisi Software\api\Bhisi.Api"

Write-Host "Migration execution finished." -ForegroundColor Green

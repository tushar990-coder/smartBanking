$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()

Write-Host "Checking columns in Roles table..." -ForegroundColor Yellow

$cmd.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Roles'"
$reader = $cmd.ExecuteReader()
$cols = @()
while ($reader.Read()) {
    $cols += $reader[0]
}
$reader.Close()

Write-Host "Existing columns: $($cols -join ', ')" -ForegroundColor Cyan

if ($cols -notcontains "RoleCode") {
    Write-Host "Adding column RoleCode..." -ForegroundColor Yellow
    $cmd.CommandText = "ALTER TABLE Roles ADD RoleCode NVARCHAR(30) NOT NULL DEFAULT '';"
    $cmd.ExecuteNonQuery()
}

if ($cols -notcontains "IsSystemRole") {
    Write-Host "Adding column IsSystemRole..." -ForegroundColor Yellow
    $cmd.CommandText = "ALTER TABLE Roles ADD IsSystemRole BIT NOT NULL DEFAULT 1;"
    $cmd.ExecuteNonQuery()
}

if ($cols -notcontains "Status") {
    Write-Host "Adding column Status..." -ForegroundColor Yellow
    $cmd.CommandText = "ALTER TABLE Roles ADD Status BIT NOT NULL DEFAULT 1;"
    $cmd.ExecuteNonQuery()
}

# Also ensure any existing roles have RoleCode set if empty
$cmd.CommandText = "UPDATE Roles SET RoleCode = RoleName WHERE RoleCode = '' OR RoleCode IS NULL;"
$cmd.ExecuteNonQuery()

Write-Host "Roles table fix applied successfully!" -ForegroundColor Green
$conn.Close()

param(
    [string]$SqlServerInstance = ".\SQLEXPRESS01",
    [string]$NewPassword = "Shri@2026"
)

# Load BCrypt dll
$dllPath = "C:\Users\tusha\.nuget\packages\bcrypt.net-next\4.0.3\lib\net20\BCrypt.Net-Next.dll"
if (Test-Path $dllPath) {
    [System.Reflection.Assembly]::LoadFrom($dllPath) | Out-Null
    $hash = [BCrypt.Net.BCrypt]::HashPassword($NewPassword)
} else {
    $hash = '$2a$11$6fxAYBVHsmYhkIWjlMOe0OG98hAkMMAUUifrbG4Ju.jE/SMOyJtAK'
}

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " SMARTBANKING ADMIN PASSWORD RESET TOOL" -ForegroundColor Yellow
Write-Host " Target User:     admin" -ForegroundColor White
Write-Host " New Password:    $NewPassword" -ForegroundColor Green
Write-Host " Server Instance: $SqlServerInstance" -ForegroundColor White
Write-Host " Generated Hash:  $hash" -ForegroundColor Gray
Write-Host "========================================================================`n" -ForegroundColor Cyan

$connStrMaster = "Server=$SqlServerInstance;Database=master;Integrated Security=True;TrustServerCertificate=True;Timeout=5;"

try {
    $masterConn = New-Object System.Data.SqlClient.SqlConnection($connStrMaster)
    $masterConn.Open()
    
    $cmd = $masterConn.CreateCommand()
    $cmd.CommandText = "SELECT name FROM sys.databases WHERE name NOT IN ('master','tempdb','model','msdb') ORDER BY name;"
    $reader = $cmd.ExecuteReader()
    
    $databases = @()
    while ($reader.Read()) {
        $databases += $reader["name"].ToString()
    }
    $masterConn.Close()
} catch {
    Write-Host " Failed to connect to SQL Server master ($SqlServerInstance): $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($databases.Count) candidate databases on instance: $SqlServerInstance`n" -ForegroundColor Cyan

$updatedCount = 0

foreach ($db in $databases) {
    $connStrDb = "Server=$SqlServerInstance;Database=$db;Integrated Security=True;TrustServerCertificate=True;Timeout=5;"
    try {
        $dbConn = New-Object System.Data.SqlClient.SqlConnection($connStrDb)
        $dbConn.Open()
        
        $checkCmd = $dbConn.CreateCommand()
        $checkCmd.CommandText = "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users';"
        $hasUsersTable = [int]$checkCmd.ExecuteScalar() -gt 0
        
        if ($hasUsersTable) {
            $updateCmd = $dbConn.CreateCommand()
            $updateCmd.CommandText = @'
                IF EXISTS (SELECT 1 FROM Users WHERE Username = 'admin')
                BEGIN
                    UPDATE Users 
                    SET PasswordHash = @hash,
                        IsLocked = 0,
                        IsActive = 1,
                        FailedLoginAttempts = 0,
                        RequirePasswordChange = 0
                    WHERE Username = 'admin';
                    SELECT 'UPDATED' AS Result;
                END
                ELSE
                BEGIN
                    DECLARE @RoleId INT = (SELECT TOP 1 RoleID FROM Roles WHERE RoleName = 'Admin');
                    IF @RoleId IS NULL
                    BEGIN
                        INSERT INTO Roles (RoleName, Description) VALUES ('Admin', 'System Administrator');
                        SET @RoleId = SCOPE_IDENTITY();
                    END

                    INSERT INTO Users (Username, PasswordHash, RoleID, IsActive, IsLocked, FailedLoginAttempts, RequirePasswordChange)
                    VALUES ('admin', @hash, @RoleId, 1, 0, 0, 0);
                    SELECT 'INSERTED' AS Result;
                END
'@
            $updateCmd.Parameters.AddWithValue("@hash", $hash) | Out-Null
            $result = $updateCmd.ExecuteScalar()
            
            Write-Host " [SUCCESS] [$db] -> admin password set to '$NewPassword' (Action: $result)" -ForegroundColor Green
            $updatedCount++
        } else {
            Write-Host " [SKIP]    [$db] -> No 'Users' table" -ForegroundColor DarkGray
        }
        
        $dbConn.Close()
    } catch {
        Write-Host " [ERROR]   [$db] -> $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "`n========================================================================" -ForegroundColor Cyan
Write-Host " COMPLETE: Successfully updated admin password in $updatedCount client databases!" -ForegroundColor Green
Write-Host " Login Credentials:" -ForegroundColor White
Write-Host "   Username: admin" -ForegroundColor Yellow
Write-Host "   Password: $NewPassword" -ForegroundColor Yellow
Write-Host "========================================================================" -ForegroundColor Cyan

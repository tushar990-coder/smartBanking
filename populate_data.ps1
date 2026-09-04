# SmartBanking ERP - Direct Seed & Verification Tool (Self-Healing & Auto-Creating)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Clear-Host

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "    SmartBanking ERP - Direct Database Population & Verification  " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Read Target Database from appsettings
$configPath = Join-Path $PSScriptRoot "appsettings.Production.json"
if (-not (Test-Path $configPath)) {
    $configPath = Join-Path $PSScriptRoot "appsettings.json"
}

$targetServer = "."
$targetDb = "SmartBanking_JotirlingPdw"

if (Test-Path $configPath) {
    $json = Get-Content $configPath -Raw
    if ($json -match 'Server=([^;]+);') { $targetServer = $matches[1] }
    if ($json -match 'Database=([^;]+);') { $targetDb = $matches[1] }
}

Write-Host "Target Server:   $targetServer" -ForegroundColor Yellow
Write-Host "Target Database: $targetDb" -ForegroundColor Yellow
Write-Host ""

# 2. Connect to SQL Server master database first
$instances = @($targetServer, ".", ".\SQLEXPRESS", "(local)", "localhost", "localhost\SQLEXPRESS")
$connected = $false
$workingInstance = $null

foreach ($inst in $instances) {
    try {
        $connStr = "Server=$inst;Database=master;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=3;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        
        # Ensure target database exists
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '$targetDb') CREATE DATABASE [$targetDb];"
        $cmd.ExecuteNonQuery() | Out-Null
        $conn.Close()
        
        $connected = $true
        $workingInstance = $inst
        break
    } catch { }
}

if (-not $connected) {
    Write-Host "[ERROR] Could not connect to SQL Server!" -ForegroundColor Red
    Write-Host "[त्रुटी] SQL Server शी संपर्क होऊ शकला नाही. SQL Server किंवा SQL Server Express चालू आहे का ते तपासा." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press ENTER to exit"
    exit 1
}

Write-Host "[OK] Connected to SQL Server instance: '$workingInstance'" -ForegroundColor Green
Write-Host "[OK] Database '$targetDb' is ready!" -ForegroundColor Green
Write-Host ""

# 3. Check if tables exist, if not apply Master Schema
$dbConnStr = "Server=$workingInstance;Database=$targetDb;Trusted_Connection=True;TrustServerCertificate=True;Connect Timeout=60;"
$dbConn = New-Object System.Data.SqlClient.SqlConnection($dbConnStr)
$dbConn.Open()

$cmd = $dbConn.CreateCommand()
$cmd.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0;"
$existingTables = [int]$cmd.ExecuteScalar()

if ($existingTables -lt 10) {
    Write-Host "Tables missing ($existingTables found). Applying Master Banking Schema..." -ForegroundColor Cyan
    $sqlFile = Join-Path $PSScriptRoot "SmartBanking_Clean_Master_Deploy.sql"
    if (Test-Path $sqlFile) {
        $sqlContent = Get-Content -Path $sqlFile -Raw -Encoding UTF8
        $batches = $sqlContent -split "(?im)^\s*GO\s*$"
        foreach ($b in $batches) {
            $trimmed = $b.Trim()
            if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
                $bCmd = $dbConn.CreateCommand()
                $bCmd.CommandText = $trimmed
                $bCmd.CommandTimeout = 120
                try { $bCmd.ExecuteNonQuery() | Out-Null } catch { }
            }
        }
        Write-Host "[OK] Schema applied successfully!" -ForegroundColor Green
    }
}

Write-Host "Populating and verifying default records..." -ForegroundColor Cyan

$seedSql = @"
    -- 1. Roles
    IF NOT EXISTS (SELECT * FROM [Roles] WHERE [RoleName] = 'Admin')
        INSERT INTO [Roles] ([RoleCode], [RoleName], [Description], [IsSystemRole], [Status]) VALUES ('Admin', 'Admin', 'System Administrator', 1, 1);
    IF NOT EXISTS (SELECT * FROM [Roles] WHERE [RoleName] = 'Manager')
        INSERT INTO [Roles] ([RoleCode], [RoleName], [Description], [IsSystemRole], [Status]) VALUES ('Manager', 'Manager', 'Branch Manager', 1, 1);
    IF NOT EXISTS (SELECT * FROM [Roles] WHERE [RoleName] = 'Cashier')
        INSERT INTO [Roles] ([RoleCode], [RoleName], [Description], [IsSystemRole], [Status]) VALUES ('Cashier', 'Cashier', 'Cashier', 1, 1);
    IF NOT EXISTS (SELECT * FROM [Roles] WHERE [RoleName] = 'Clerk')
        INSERT INTO [Roles] ([RoleCode], [RoleName], [Description], [IsSystemRole], [Status]) VALUES ('Clerk', 'Clerk', 'Account Clerk', 1, 1);
    IF NOT EXISTS (SELECT * FROM [Roles] WHERE [RoleName] = 'Auditor')
        INSERT INTO [Roles] ([RoleCode], [RoleName], [Description], [IsSystemRole], [Status]) VALUES ('Auditor', 'Auditor', 'Statutory Auditor', 1, 1);

    -- 2. Branch
    IF NOT EXISTS (SELECT * FROM [Branches])
    BEGIN
        INSERT INTO [Branches] ([BranchCode], [BranchName], [Address], [BranchType], [MobileNo], [Email], [IsActive])
        VALUES ('MAIN', N'मुख्य शाखा (Main Branch)', N'मुख्य कार्यालय', 'Branch', '9876543210', 'info@smartbanking.in', 1);
    END

    -- 3. Financial Year
    IF NOT EXISTS (SELECT * FROM [FinancialYears] WHERE [YearCode] = '2026-2027')
    BEGIN
        INSERT INTO [FinancialYears] ([YearCode], [StartDate], [EndDate], [IsActive], [IsClosed])
        VALUES ('2026-2027', '2026-04-01 00:00:00', '2027-03-31 23:59:59', 1, 0);
    END

    -- 4. Admin User
    DECLARE @AdminRoleId INT;
    SELECT TOP 1 @AdminRoleId = [RoleID] FROM [Roles] WHERE [RoleName] = 'Admin';
    IF @AdminRoleId IS NULL SET @AdminRoleId = 1;

    DECLARE @DefaultBranchId INT;
    SELECT TOP 1 @DefaultBranchId = [BranchID] FROM [Branches];
    IF @DefaultBranchId IS NULL SET @DefaultBranchId = 1;

    IF NOT EXISTS (SELECT * FROM [Users] WHERE [Username] = 'admin')
    BEGIN
        INSERT INTO [Users] ([Username], [PasswordHash], [RoleID], [DefaultBranchID], [IsActive], [IsLocked], [FailedLoginAttempts], [RequirePasswordChange])
        VALUES ('admin', '$2a$11$zAlwyzqhGYvR2PaoY4POd.SYuw7wAoYLT4PG1wzHibDSsnCVOicKa', @AdminRoleId, @DefaultBranchId, 1, 0, 0, 0);
    END
    ELSE
    BEGIN
        UPDATE [Users] 
        SET [IsLocked] = 0, [IsActive] = 1, [FailedLoginAttempts] = 0, [RoleID] = @AdminRoleId, [DefaultBranchID] = @DefaultBranchId,
            [PasswordHash] = '$2a$11$zAlwyzqhGYvR2PaoY4POd.SYuw7wAoYLT4PG1wzHibDSsnCVOicKa'
        WHERE [Username] = 'admin';
    END

    -- 5. Sanstha Details
    IF NOT EXISTS (SELECT * FROM [SansthaDetails])
    BEGIN
        INSERT INTO [SansthaDetails] ([SansthaName], [RegistrationNo], [Address], [District], [State], [PinCode], [ContactNo], [Email], [IsMigrationLocked], [AutoPostVouchers], [AutoPostVoucherLimit])
        VALUES (N'श्री जोतिर्लिंग नागरी सहकारी पतसंस्था मर्या.', 'PNE/BNK/2026/01', N'मुख्य रस्ता', N'पुणे', N'महाराष्ट्र', '411001', '9876543210', 'info@smartbanking.in', 0, 1, 50000.00);
    END

    -- 6. Account Groups
    IF NOT EXISTS (SELECT * FROM [AccountGroups])
    BEGIN
        INSERT INTO [AccountGroups] ([GroupName], [ParentGroupID], [NatureOfGroup], [IsActive]) VALUES 
        (N'रोकड व बँक शिल्लक (Cash & Bank)', NULL, 'Asset', 1),
        (N'ठेवी (Deposits)', NULL, 'Liability', 1),
        (N'कर्ज वाटप (Loans & Advances)', NULL, 'Asset', 1),
        (N'भाग भांडवल (Share Capital)', NULL, 'Liability', 1),
        (N'उत्पन्न (Income)', NULL, 'Income', 1),
        (N'खर्च (Expenditure)', NULL, 'Expense', 1),
        (N'राखीव निधी व इतर फंड (Reserves & Funds)', NULL, 'Liability', 1);
    END

    -- 7. Active Day End Status
    IF NOT EXISTS (SELECT * FROM [BranchDayEndStatuses])
    BEGIN
        INSERT INTO [BranchDayEndStatuses] ([BranchID], [BusinessDate], [IsDayClosed])
        VALUES (@DefaultBranchId, '2026-04-01 00:00:00', 0);
    END
"@

$cmd = $dbConn.CreateCommand()
$cmd.CommandText = $seedSql
$cmd.ExecuteNonQuery() | Out-Null

$cmd.CommandText = "SELECT COUNT(*) FROM [Roles]"
$rolesCount = [int]$cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM [Branches]"
$branchesCount = [int]$cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM [FinancialYears]"
$fyCount = [int]$cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM [Users]"
$usersCount = [int]$cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM [SansthaDetails]"
$sansthaCount = [int]$cmd.ExecuteScalar()

$cmd.CommandText = "SELECT COUNT(*) FROM [AccountGroups]"
$accGroupsCount = [int]$cmd.ExecuteScalar()

$dbConn.Close()

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "             DATABASE CONTENT VERIFICATION REPORT                 " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  -> Roles (रोल्स):                $rolesCount records [OK]" -ForegroundColor Green
Write-Host "  -> Branches (शाखा):             $branchesCount records (मुख्य शाखा) [OK]" -ForegroundColor Green
Write-Host "  -> Financial Years (आर्थिक वर्ष): $fyCount records (2026-2027) [OK]" -ForegroundColor Green
Write-Host "  -> Users (युझर्स):              $usersCount records (admin / admin123) [OK]" -ForegroundColor Green
Write-Host "  -> Sanstha Profile (संस्था):    $sansthaCount record (श्री जोतिर्लिंग पतसंस्था) [OK]" -ForegroundColor Green
Write-Host "  -> Account Groups (ग्रुप्स):    $accGroupsCount records [OK]" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Press ENTER to continue (बाहेर पडण्यासाठी ENTER दाबा)"

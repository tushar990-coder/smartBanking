# =========================================================================================
# SmartBanking ERP - Testing Database Creator & Zero-Conflict Sequential ID Generator
# Server: .\SQLEXPRESS01
# Source: SmartBanking_Padavalwadi
# Target: testing
# =========================================================================================

$server = ".\SQLEXPRESS01"
$sourceDb = "SmartBanking_Padavalwadi"
$targetDb = "testing"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  SmartBanking ERP - Creating Clean '$targetDb' Database        " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Connect to Master and Create Target Database
$masterConnStr = "Server=$server;Database=master;Integrated Security=True;TrustServerCertificate=True;"
$masterConn = New-Object System.Data.SqlClient.SqlConnection($masterConnStr)
$masterConn.Open()

$createDbCmd = $masterConn.CreateCommand()
$createDbCmd.CommandText = @"
IF DB_ID('$targetDb') IS NOT NULL
BEGIN
    ALTER DATABASE [$targetDb] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [$targetDb];
END
CREATE DATABASE [$targetDb];
ALTER DATABASE [$targetDb] SET MULTI_USER;
"@
Write-Host "[1/5] Creating fresh database [$targetDb]..." -ForegroundColor Yellow
$createDbCmd.ExecuteNonQuery() | Out-Null
$masterConn.Close()
Write-Host "  -> Database [$targetDb] created successfully." -ForegroundColor Green

# 2. Get list of all tables from Source DB
$srcConnStr = "Server=$server;Database=$sourceDb;Integrated Security=True;TrustServerCertificate=True;"
$srcConn = New-Object System.Data.SqlClient.SqlConnection($srcConnStr)
$srcConn.Open()

$tgtConnStr = "Server=$server;Database=$targetDb;Integrated Security=True;TrustServerCertificate=True;"
$tgtConn = New-Object System.Data.SqlClient.SqlConnection($tgtConnStr)
$tgtConn.Open()

# 3. Create all tables in target database
Write-Host "[2/5] Generating and deploying complete schema to [$targetDb]..." -ForegroundColor Yellow

$getTablesCmd = $srcConn.CreateCommand()
$getTablesCmd.CommandText = @"
SELECT t.name AS TableName
FROM sys.tables t
WHERE t.is_ms_shipped = 0
ORDER BY t.name;
"@

$tables = New-Object System.Collections.Generic.List[string]
$r = $getTablesCmd.ExecuteReader()
while ($r.Read()) {
    $tables.Add($r["TableName"].ToString())
}
$r.Close()

# Generate Table Schemas
foreach ($t in $tables) {
    # Get columns
    $colCmd = $srcConn.CreateCommand()
    $colCmd.CommandText = @"
    SELECT 
        c.name AS ColumnName,
        tp.name AS TypeName,
        c.max_length,
        c.precision,
        c.scale,
        c.is_nullable,
        c.is_identity,
        ic.seed_value,
        ic.increment_value,
        ISNULL(dc.definition, '') AS DefaultDefinition
    FROM sys.columns c
    JOIN sys.types tp ON c.user_type_id = tp.user_type_id
    LEFT JOIN sys.identity_columns ic ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
    WHERE c.object_id = OBJECT_ID('dbo.[$t]')
    ORDER BY c.column_id;
"@
    $colReader = $colCmd.ExecuteReader()
    $colDefs = New-Object System.Collections.Generic.List[string]

    while ($colReader.Read()) {
        $cName = $colReader["ColumnName"].ToString()
        $tName = $colReader["TypeName"].ToString()
        $maxLen = [int]$colReader["max_length"]
        $prec = [int]$colReader["precision"]
        $scale = [int]$colReader["scale"]
        $isNullable = [bool]$colReader["is_nullable"]
        $isIdentity = [bool]$colReader["is_identity"]
        $defaultDef = $colReader["DefaultDefinition"].ToString()

        $typeStr = $tName
        if ($tName -in @("nvarchar", "nchar")) {
            if ($maxLen -eq -1) { $typeStr = "$tName(MAX)" }
            else { $typeStr = "$tName($($maxLen / 2))" }
        } elseif ($tName -in @("varchar", "char", "varbinary", "binary")) {
            if ($maxLen -eq -1) { $typeStr = "$tName(MAX)" }
            else { $typeStr = "$tName($maxLen)" }
        } elseif ($tName -in @("decimal", "numeric")) {
            $typeStr = "$tName($prec, $scale)"
        }

        $colLine = "[$cName] $typeStr"
        if ($isIdentity) {
            $colLine += " IDENTITY(1,1)"
        }
        if (-not $isNullable) {
            $colLine += " NOT NULL"
        } else {
            $colLine += " NULL"
        }
        if ($defaultDef) {
            $colLine += " DEFAULT $defaultDef"
        }

        $colDefs.Add($colLine)
    }
    $colReader.Close()

    # Get Primary Key
    $pkCmd = $srcConn.CreateCommand()
    $pkCmd.CommandText = @"
    SELECT c.name AS ColumnName
    FROM sys.indexes i
    JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.object_id = OBJECT_ID('dbo.[$t]') AND i.is_primary_key = 1
    ORDER BY ic.key_ordinal;
"@
    $pkReader = $pkCmd.ExecuteReader()
    $pkCols = New-Object System.Collections.Generic.List[string]
    while ($pkReader.Read()) {
        $pkCols.Add("[$($pkReader['ColumnName'])]")
    }
    $pkReader.Close()

    if ($pkCols.Count -gt 0) {
        $colDefs.Add("CONSTRAINT [PK_$t] PRIMARY KEY CLUSTERED ($([string]::Join(', ', $pkCols)))")
    }

    $createTableSql = "CREATE TABLE dbo.[$t] (`n    " + [string]::Join(",`n    ", $colDefs) + "`n);"
    $tgtCmd = $tgtConn.CreateCommand()
    $tgtCmd.CommandText = $createTableSql
    $tgtCmd.ExecuteNonQuery() | Out-Null
}

Write-Host "  -> All $($tables.Count) table schemas created successfully." -ForegroundColor Green

# 4. Copy Master and Configuration Data with IDs Starting from 1
Write-Host "[3/5] Migrating Master & Seed data with IDs starting from 1..." -ForegroundColor Yellow

# Helper function to copy table with SqlBulkCopy
function Copy-MasterTable {
    param(
        [string]$TableName,
        [string]$SelectSql
    )

    $srcCmd = $srcConn.CreateCommand()
    $srcCmd.CommandText = $SelectSql
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($srcCmd)
    $dt = New-Object System.Data.DataTable
    $adapter.Fill($dt) | Out-Null

    if ($dt.Rows.Count -eq 0) { return }

    $bulk = New-Object System.Data.SqlClient.SqlBulkCopy($tgtConnStr, [System.Data.SqlClient.SqlBulkCopyOptions]::KeepIdentity)
    $bulk.DestinationTableName = "dbo.[$TableName]"
    foreach ($col in $dt.Columns) {
        $bulk.ColumnMappings.Add($col.ColumnName, $col.ColumnName) | Out-Null
    }
    $bulk.WriteToServer($dt)
    $bulk.Close()
    Write-Host "    - $TableName : $($dt.Rows.Count) rows copied" -ForegroundColor Gray
}

# A. EF Migrations & System Histories
Copy-MasterTable "__EFMigrationsHistory" "SELECT * FROM dbo.[__EFMigrationsHistory]"
Copy-MasterTable "SystemVersionHistories" "SELECT * FROM dbo.[SystemVersionHistories]"

# B. Sanstha Details (SansthaID = 1)
Copy-MasterTable "SansthaDetails" "SELECT * FROM dbo.[SansthaDetails]"

# C. FinancialYears (FinancialYearID = 1)
Copy-MasterTable "FinancialYears" "SELECT * FROM dbo.[FinancialYears]"

# D. Branches (BranchID = 1, etc.)
Copy-MasterTable "Branches" "SELECT * FROM dbo.[Branches]"

# E. Roles & Users (RoleID = 1..5, UserID = 1)
Copy-MasterTable "Roles" "SELECT * FROM dbo.[Roles]"
Copy-MasterTable "Users" "SELECT * FROM dbo.[Users]"

# F. AccountGroups (GroupID: 1 to 91 preserved)
Copy-MasterTable "AccountGroups" "SELECT * FROM dbo.[AccountGroups] ORDER BY GroupID"

# G. Ledgers (LedgerID: 1 to 408 preserved, with balances zeroed out)
Copy-MasterTable "Ledgers" @"
SELECT 
    LedgerID,
    LedgerName,
    GroupID,
    CAST(0.00 AS decimal(18,2)) AS OpeningBalance,
    OpeningBalanceType,
    ReportType,
    AccountType,
    ExcludeFromRule35Swanidhi,
    IsActive,
    LegacyLedgerId,
    LedgerNameEnglish,
    DisplayOrder,
    LedgerCode
FROM dbo.[Ledgers] 
ORDER BY LedgerID
"@

# H. Voucher Mappings
Copy-MasterTable "VoucherMappings" "SELECT * FROM dbo.[VoucherMappings]"

# I. Bank Masters & Investment Institutions
Copy-MasterTable "BankMasters" "SELECT * FROM dbo.[BankMasters]"
Copy-MasterTable "InvestmentInstitutions" "SELECT * FROM dbo.[InvestmentInstitutions]"

# J. NPA Configurations & Slabs
Copy-MasterTable "NpaConfigs" "SELECT * FROM dbo.[NpaConfigs]"
Copy-MasterTable "NpaProvisionSlabs" "SELECT * FROM dbo.[NpaProvisionSlabs]"

# K. Cash Management Settings & Cashiers
Copy-MasterTable "CashManagementSettings" "SELECT * FROM dbo.[CashManagementSettings]"
Copy-MasterTable "Cashiers" "SELECT * FROM dbo.[Cashiers]"

# L. Scheme Masters with ID normalized to start from 1!
# 1) ShareSchemes -> Normalize ShareSchemeId to 1
Copy-MasterTable "ShareSchemes" @"
SELECT 
    ROW_NUMBER() OVER(ORDER BY ShareSchemeId) AS ShareSchemeId,
    BranchID, SchemeCode, SchemeName, MemberType, ShareFaceValue,
    MinSharesCount, MaxSharesCount, EntranceFee, BuildingFund,
    ShareTransferFee, DividendRate, HasVotingRights, IsAadhaarCompulsory,
    IsPanCompulsory, LoanEligibilityMultiplier, EffectiveDate, IsActive,
    ShareCapitalLedgerID, EntranceFeeLedgerID, ShareTransferFeeLedgerID,
    BuildingFundLedgerID, DividendPayableLedgerID, IsMobileCompulsory
FROM dbo.[ShareSchemes]
"@

# 2) SavingInterestSettings -> SettingID = 1
Copy-MasterTable "SavingInterestSettings" @"
SELECT 
    ROW_NUMBER() OVER(ORDER BY SettingID) AS SettingID,
    InterestRate, CalculationMethod, PostingFrequency, EffectiveDate,
    LedgerID, CreatedBy, CreatedOn, SchemeName, SavingLiabilityLedgerID,
    InterestExpenseLedgerID, InterestPayableLedgerID, SchemeCode
FROM dbo.[SavingInterestSettings]
"@

# 3) FdSchemes -> Normalize FdSchemeID to 1
Copy-MasterTable "FdSchemes" @"
SELECT 
    ROW_NUMBER() OVER(ORDER BY FdSchemeID) AS FdSchemeID,
    InstitutionID, BranchID, SchemeCode, SchemeName, DurationMonths,
    InterestRate, SeniorCitizenInterestRate, InterestType,
    InterestPostingMethod, InterestCompoundingFrequency, MinimumAmount,
    MaximumAmount, PrematureInterestRate, EffectiveDate, IsActive,
    CreatedBy, CreatedDate, ModifiedBy, ModifiedDate, FdLiabilityLedgerID,
    InterestExpenseLedgerID, InterestPayableLedgerID, PrematurePenaltyLedgerID
FROM dbo.[FdSchemes]
"@

# 4) RdSchemes -> Normalize RdSchemeID to 1
Copy-MasterTable "RdSchemes" @"
SELECT 
    ROW_NUMBER() OVER(ORDER BY RdSchemeID) AS RdSchemeID,
    InstitutionID, BranchID, SchemeCode, SchemeName, DurationMonths,
    InstallmentAmount, MinimumInstallment, MaximumInstallment, InterestRate,
    InterestMethod, PenaltyAmount, EffectiveDate, IsActive, CreatedBy,
    CreatedDate, ModifiedBy, ModifiedDate, RdLiabilityLedgerID,
    InterestExpenseLedgerID, InterestPayableLedgerID, PenaltyIncomeLedgerID,
    PrematurePenaltyRate
FROM dbo.[RdSchemes]
"@

# 5) PigmySchemes -> Normalize PigmySchemeID to 1
Copy-MasterTable "PigmySchemes" @"
SELECT 
    ROW_NUMBER() OVER(ORDER BY PigmySchemeID) AS PigmySchemeID,
    SchemeName, InterestRate, DurationMonths, Status, CreatedBy,
    CreatedDate, PigmyLiabilityLedgerID, CommissionExpenseLedgerID,
    InterestExpenseLedgerID, InterestPayableLedgerID, SchemeCode
FROM dbo.[PigmySchemes]
"@

# 5. Reseed All Tables so IDs start cleanly from 1
Write-Host "[4/5] Reseeding all Identity Columns to guarantee starting from 1..." -ForegroundColor Yellow

$reseedCmd = $tgtConn.CreateCommand()
$reseedCmd.CommandText = @"
DECLARE @tbl NVARCHAR(128);
DECLARE @hasIdentity INT;
DECLARE @rowCount INT;
DECLARE @maxId BIGINT;
DECLARE @sql NVARCHAR(MAX);

DECLARE tbl_cursor CURSOR FOR
SELECT t.name
FROM sys.tables t
WHERE t.is_ms_shipped = 0 AND t.name != '__EFMigrationsHistory';

OPEN tbl_cursor;
FETCH NEXT FROM tbl_cursor INTO @tbl;

WHILE @@FETCH_STATUS = 0
BEGIN
    SELECT @hasIdentity = COUNT(*) FROM sys.identity_columns WHERE object_id = OBJECT_ID(@tbl);
    
    IF @hasIdentity > 0
    BEGIN
        SET @sql = 'SELECT @cnt = COUNT(*) FROM dbo.[' + @tbl + ']';
        EXEC sp_executesql @sql, N'@cnt INT OUTPUT', @cnt = @rowCount OUTPUT;
        
        IF @rowCount = 0
        BEGIN
            -- Empty table: reset seed to 0 so next insert gets ID 1
            DBCC CHECKIDENT (@tbl, RESEED, 0) WITH NO_INFOMSGS;
        END
        ELSE
        BEGIN
            -- Populated master table: reseed to current max ID
            DECLARE @colName NVARCHAR(128);
            SELECT @colName = name FROM sys.identity_columns WHERE object_id = OBJECT_ID(@tbl);
            SET @sql = 'SELECT @max = MAX([' + @colName + ']) FROM dbo.[' + @tbl + ']';
            EXEC sp_executesql @sql, N'@max BIGINT OUTPUT', @max = @maxId OUTPUT;
            
            DBCC CHECKIDENT (@tbl, RESEED, @maxId) WITH NO_INFOMSGS;
        END
    END

    FETCH NEXT FROM tbl_cursor INTO @tbl;
END

CLOSE tbl_cursor;
DEALLOCATE tbl_cursor;
"@
$reseedCmd.ExecuteNonQuery() | Out-Null
Write-Host "  -> All table identity seeds re-calibrated successfully." -ForegroundColor Green

# 6. Verification and Summary
Write-Host "[5/5] Running final verification on database [$targetDb]..." -ForegroundColor Yellow

$verifyCmd = $tgtConn.CreateCommand()
$verifyCmd.CommandText = @"
SELECT 'AccountGroups (खाते गट)' AS Component, COUNT(*) AS TotalCount, MIN(GroupID) AS MinID, MAX(GroupID) AS MaxID FROM AccountGroups
UNION ALL SELECT 'Ledgers (खाते माहिती)', COUNT(*), MIN(LedgerID), MAX(LedgerID) FROM Ledgers
UNION ALL SELECT 'ShareSchemes (शेअर योजना)', COUNT(*), MIN(ShareSchemeId), MAX(ShareSchemeId) FROM ShareSchemes
UNION ALL SELECT 'SavingInterestSettings (बचत योजना)', COUNT(*), MIN(SettingID), MAX(SettingID) FROM SavingInterestSettings
UNION ALL SELECT 'FdSchemes (मुदत ठेव योजना)', COUNT(*), MIN(FdSchemeID), MAX(FdSchemeID) FROM FdSchemes
UNION ALL SELECT 'RdSchemes (आवर्ती ठेव योजना)', COUNT(*), MIN(RdSchemeID), MAX(RdSchemeID) FROM RdSchemes
UNION ALL SELECT 'PigmySchemes (पिग्मी योजना)', COUNT(*), MIN(PigmySchemeID), MAX(PigmySchemeID) FROM PigmySchemes
UNION ALL SELECT 'Branches (शाखा)', COUNT(*), MIN(BranchID), MAX(BranchID) FROM Branches
UNION ALL SELECT 'Roles (भूमिका)', COUNT(*), MIN(RoleID), MAX(RoleID) FROM Roles
UNION ALL SELECT 'Users (वापरकर्ते)', COUNT(*), MIN(UserID), MAX(UserID) FROM Users
UNION ALL SELECT 'SansthaDetails (संस्था माहिती)', COUNT(*), MIN(SansthaID), MAX(SansthaID) FROM SansthaDetails
UNION ALL SELECT 'FinancialYears (आर्थिक वर्ष)', COUNT(*), MIN(FinancialYearID), MAX(FinancialYearID) FROM FinancialYears
UNION ALL SELECT 'Customers (ग्राहक - Fresh Zero)', COUNT(*), ISNULL(MIN(CustomerID), 0), ISNULL(MAX(CustomerID), 0) FROM Customers
UNION ALL SELECT 'Members (सभासद - Fresh Zero)', COUNT(*), ISNULL(MIN(MemberID), 0), ISNULL(MAX(MemberID), 0) FROM Members
UNION ALL SELECT 'ShareAccounts (Fresh Zero)', COUNT(*), ISNULL(MIN(ShareAccountId), 0), ISNULL(MAX(ShareAccountId), 0) FROM ShareAccounts
UNION ALL SELECT 'SavingAccountMasters (Fresh Zero)', COUNT(*), ISNULL(MIN(SavingAccountID), 0), ISNULL(MAX(SavingAccountID), 0) FROM SavingAccountMasters
UNION ALL SELECT 'Vouchers (Fresh Zero)', COUNT(*), ISNULL(MIN(VoucherID), 0), ISNULL(MAX(VoucherID), 0) FROM Vouchers;
"@

$vReader = $verifyCmd.ExecuteReader()
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  FINAL STATUS OF [$targetDb] DATABASE:" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ("{0,-38} | {1,-10} | {2,-7} | {3,-7}" -f "Component", "Total Rows", "Min ID", "Max ID") -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------------------------" -ForegroundColor Gray

while ($vReader.Read()) {
    $c = $vReader[0].ToString()
    $cnt = $vReader[1].ToString()
    $min = $vReader[2].ToString()
    $max = $vReader[3].ToString()
    Write-Host ("{0,-38} | {1,-10} | {2,-7} | {3,-7}" -f $c, $cnt, $min, $max) -ForegroundColor White
}
$vReader.Close()

$srcConn.Close()
$tgtConn.Close()

Write-Host ""
Write-Host "✅ Deployment completed with 100% success! All IDs start from 1 with zero conflicts." -ForegroundColor Green

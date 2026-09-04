$dbs = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")

$sqlFix = @"
-- 1. Create ShareSchemes if not exists
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ShareSchemes')
BEGIN
    CREATE TABLE [ShareSchemes] (
        [ShareSchemeId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [BranchID] int NOT NULL DEFAULT 1,
        [SchemeCode] nvarchar(50) NOT NULL,
        [SchemeName] nvarchar(100) NOT NULL,
        [MemberType] nvarchar(50) NOT NULL DEFAULT 'Regular',
        [ShareFaceValue] decimal(18,2) NOT NULL DEFAULT 100.00,
        [MinSharesCount] int NOT NULL DEFAULT 1,
        [MaxSharesCount] int NOT NULL DEFAULT 1000,
        [EntranceFee] decimal(18,2) NOT NULL DEFAULT 10.00,
        [BuildingFund] decimal(18,2) NOT NULL DEFAULT 0.00,
        [ShareTransferFee] decimal(18,2) NOT NULL DEFAULT 25.00,
        [DividendRate] decimal(18,2) NOT NULL DEFAULT 10.00,
        [HasVotingRights] bit NOT NULL DEFAULT 1,
        [IsMobileCompulsory] bit NOT NULL DEFAULT 1,
        [IsAadhaarCompulsory] bit NOT NULL DEFAULT 1,
        [IsPanCompulsory] bit NOT NULL DEFAULT 0,
        [LoanEligibilityMultiplier] int NOT NULL DEFAULT 10,
        [EffectiveDate] datetime2 NOT NULL DEFAULT GETDATE(),
        [IsActive] bit NOT NULL DEFAULT 1,
        [ShareCapitalLedgerID] int NULL,
        [EntranceFeeLedgerID] int NULL,
        [ShareTransferFeeLedgerID] int NULL,
        [BuildingFundLedgerID] int NULL,
        [DividendPayableLedgerID] int NULL
    );
END
ELSE
BEGIN
    IF COL_LENGTH('ShareSchemes', 'BranchID') IS NULL ALTER TABLE [ShareSchemes] ADD [BranchID] int NOT NULL DEFAULT 1;
    IF COL_LENGTH('ShareSchemes', 'SchemeCode') IS NULL ALTER TABLE [ShareSchemes] ADD [SchemeCode] nvarchar(50) NOT NULL DEFAULT 'SHR-01';
    IF COL_LENGTH('ShareSchemes', 'SchemeName') IS NULL ALTER TABLE [ShareSchemes] ADD [SchemeName] nvarchar(100) NOT NULL DEFAULT '';
    IF COL_LENGTH('ShareSchemes', 'MemberType') IS NULL ALTER TABLE [ShareSchemes] ADD [MemberType] nvarchar(50) NOT NULL DEFAULT 'Regular';
    IF COL_LENGTH('ShareSchemes', 'ShareFaceValue') IS NULL ALTER TABLE [ShareSchemes] ADD [ShareFaceValue] decimal(18,2) NOT NULL DEFAULT 100.00;
    IF COL_LENGTH('ShareSchemes', 'MinSharesCount') IS NULL ALTER TABLE [ShareSchemes] ADD [MinSharesCount] int NOT NULL DEFAULT 1;
    IF COL_LENGTH('ShareSchemes', 'MaxSharesCount') IS NULL ALTER TABLE [ShareSchemes] ADD [MaxSharesCount] int NOT NULL DEFAULT 1000;
    IF COL_LENGTH('ShareSchemes', 'EntranceFee') IS NULL ALTER TABLE [ShareSchemes] ADD [EntranceFee] decimal(18,2) NOT NULL DEFAULT 10.00;
    IF COL_LENGTH('ShareSchemes', 'BuildingFund') IS NULL ALTER TABLE [ShareSchemes] ADD [BuildingFund] decimal(18,2) NOT NULL DEFAULT 0.00;
    IF COL_LENGTH('ShareSchemes', 'ShareTransferFee') IS NULL ALTER TABLE [ShareSchemes] ADD [ShareTransferFee] decimal(18,2) NOT NULL DEFAULT 25.00;
    IF COL_LENGTH('ShareSchemes', 'DividendRate') IS NULL ALTER TABLE [ShareSchemes] ADD [DividendRate] decimal(18,2) NOT NULL DEFAULT 10.00;
    IF COL_LENGTH('ShareSchemes', 'HasVotingRights') IS NULL ALTER TABLE [ShareSchemes] ADD [HasVotingRights] bit NOT NULL DEFAULT 1;
    IF COL_LENGTH('ShareSchemes', 'IsMobileCompulsory') IS NULL ALTER TABLE [ShareSchemes] ADD [IsMobileCompulsory] bit NOT NULL DEFAULT 1;
    IF COL_LENGTH('ShareSchemes', 'IsAadhaarCompulsory') IS NULL ALTER TABLE [ShareSchemes] ADD [IsAadhaarCompulsory] bit NOT NULL DEFAULT 1;
    IF COL_LENGTH('ShareSchemes', 'IsPanCompulsory') IS NULL ALTER TABLE [ShareSchemes] ADD [IsPanCompulsory] bit NOT NULL DEFAULT 0;
    IF COL_LENGTH('ShareSchemes', 'LoanEligibilityMultiplier') IS NULL ALTER TABLE [ShareSchemes] ADD [LoanEligibilityMultiplier] int NOT NULL DEFAULT 10;
    IF COL_LENGTH('ShareSchemes', 'EffectiveDate') IS NULL ALTER TABLE [ShareSchemes] ADD [EffectiveDate] datetime2 NOT NULL DEFAULT GETDATE();
    IF COL_LENGTH('ShareSchemes', 'IsActive') IS NULL ALTER TABLE [ShareSchemes] ADD [IsActive] bit NOT NULL DEFAULT 1;
    IF COL_LENGTH('ShareSchemes', 'ShareCapitalLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [ShareCapitalLedgerID] int NULL;
    IF COL_LENGTH('ShareSchemes', 'EntranceFeeLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [EntranceFeeLedgerID] int NULL;
    IF COL_LENGTH('ShareSchemes', 'ShareTransferFeeLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [ShareTransferFeeLedgerID] int NULL;
    IF COL_LENGTH('ShareSchemes', 'BuildingFundLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [BuildingFundLedgerID] int NULL;
    IF COL_LENGTH('ShareSchemes', 'DividendPayableLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [DividendPayableLedgerID] int NULL;
END
"@

foreach ($db in $dbs) {
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;")
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sqlFix
        $cmd.ExecuteNonQuery()
        Write-Host "SUCCESS: ShareSchemes created & synced for '$db'!" -ForegroundColor Green
        $conn.Close()
    } catch {
        Write-Host "Error for '$db': $($_.Exception.Message)" -ForegroundColor Red
    }
}

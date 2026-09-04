$schema = Get-Content -Path "d:\Bhisi Software\api\Bhisi.Api\SmartBanking_EF_Generated.sql" -Raw -Encoding UTF8

$seedScript = @"

-- ===================================================================
-- SMART BANKING CORE ERP - COMPLETE MASTER SEED DATA
-- ===================================================================

-- 1. Seed Roles
BEGIN TRY
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
END TRY BEGIN CATCH END CATCH
GO

-- 2. Seed Default Branch
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [Branches])
    BEGIN
        INSERT INTO [Branches] ([BranchCode], [BranchName], [Address], [BranchType], [MobileNo], [Email], [IsActive])
        VALUES ('MAIN', N'मुख्य शाखा (Main Branch)', N'मुख्य कार्यालय', 'Branch', '9876543210', 'info@smartbanking.in', 1);
    END
END TRY BEGIN CATCH END CATCH
GO

-- 3. Seed Financial Year 2026-2027
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [FinancialYears] WHERE [YearCode] = '2026-2027')
    BEGIN
        INSERT INTO [FinancialYears] ([YearCode], [StartDate], [EndDate], [IsActive], [IsClosed])
        VALUES ('2026-2027', '2026-04-01 00:00:00', '2027-03-31 23:59:59', 1, 0);
    END
END TRY BEGIN CATCH END CATCH
GO

-- 4. Seed Admin User (admin / admin123)
BEGIN TRY
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
END TRY BEGIN CATCH END CATCH
GO

-- 5. Seed Sanstha Details
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [SansthaDetails])
    BEGIN
        INSERT INTO [SansthaDetails] ([SansthaName], [RegistrationNo], [Address], [District], [State], [PinCode], [ContactNo], [Email], [IsMigrationLocked], [AutoPostVouchers], [AutoPostVoucherLimit])
        VALUES (N'श्री जोतिर्लिंग नागरी सहकारी पतसंस्था मर्या.', 'PNE/BNK/2026/01', N'मुख्य रस्ता', N'पुणे', N'महाराष्ट्र', '411001', '9876543210', 'info@smartbanking.in', 0, 1, 50000.00);
    END
END TRY BEGIN CATCH END CATCH
GO

-- 6. Seed Core Account Groups
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [AccountGroups])
    BEGIN
        INSERT INTO [AccountGroups] ([GroupName], [ParentGroupID], [NatureOfGroup], [DisplayOrder], [IsActive]) VALUES 
        (N'भाग भांडवल (Share Capital)', NULL, 'Liability', 1, 1),
        (N'राखीव निधी व इतर फंड (Reserves & Funds)', NULL, 'Liability', 2, 1),
        (N'ठेवी (Deposits)', NULL, 'Liability', 3, 1),
        (N'इतर देणी (Other Liabilities)', NULL, 'Liability', 4, 1),
        (N'रोकड शिल्लक (Cash Balance)', NULL, 'Asset', 1, 1),
        (N'बँकेतील शिल्लक (Bank Balance)', NULL, 'Asset', 2, 1),
        (N'गुंतवणूक (Investments)', NULL, 'Asset', 3, 1),
        (N'कर्ज वाटप (Loans & Advances)', NULL, 'Asset', 4, 1),
        (N'मालमत्ता (Assets & Deadstock)', NULL, 'Asset', 5, 1),
        (N'इतर येणे (Other Receivables)', NULL, 'Asset', 6, 1),
        (N'उत्पन्न (Income)', NULL, 'Income', 1, 1),
        (N'खर्च (Expenditure)', NULL, 'Expense', 1, 1);
    END
END TRY BEGIN CATCH END CATCH
GO

-- 7. Seed Core Ledgers
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [Ledgers])
    BEGIN
        DECLARE @CashGroupId INT;
        SELECT TOP 1 @CashGroupId = [GroupID] FROM [AccountGroups] WHERE [GroupName] LIKE N'%रोकड%';
        IF @CashGroupId IS NULL SET @CashGroupId = 1;

        DECLARE @BankGroupId INT;
        SELECT TOP 1 @BankGroupId = [GroupID] FROM [AccountGroups] WHERE [GroupName] LIKE N'%बँक%';
        IF @BankGroupId IS NULL SET @BankGroupId = 1;

        INSERT INTO [Ledgers] ([LedgerCode], [LedgerName], [GroupID], [OpeningBalance], [OpeningBalanceType], [IsActive]) VALUES
        ('51', N'हातातील रोख शिल्लक (Cash in Hand)', @CashGroupId, 0.00, 'Debit', 1),
        ('248', N'बँक करंट खाते (Bank Current A/c)', @BankGroupId, 0.00, 'Debit', 1);
    END
END TRY BEGIN CATCH END CATCH
GO

-- 8. Seed Branch Day End Status (Active Business Date)
BEGIN TRY
    DECLARE @BranchId INT;
    SELECT TOP 1 @BranchId = [BranchID] FROM [Branches];
    IF @BranchId IS NULL SET @BranchId = 1;

    IF NOT EXISTS (SELECT * FROM [BranchDayEndStatuses] WHERE [BranchID] = @BranchId)
    BEGIN
        INSERT INTO [BranchDayEndStatuses] ([BranchID], [BusinessDate], [IsDayClosed])
        VALUES (@BranchId, '2026-04-01 00:00:00', 0);
    END
END TRY BEGIN CATCH END CATCH
GO

-- 9. Seed Default Saving Interest Settings
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [SavingInterestSettings])
    BEGIN
        INSERT INTO [SavingInterestSettings] ([SchemeName], [InterestRate], [CalculationFrequency], [PostingFrequency], [MinBalanceForInterest], [IsActive])
        VALUES (N'साधारण बचत खाते', 4.00, 'Daily', 'Half-Yearly', 500.00, 1);
    END
END TRY BEGIN CATCH END CATCH
GO

PRINT '=======================================================';
PRINT '  SMART BANKING MASTER DEPLOY & SEED COMPLETED!        ';
PRINT '=======================================================';
"@

$fullDeploy = $schema + "`r`n`r`n" + $seedScript

[System.IO.File]::WriteAllText("d:\Bhisi Software\api\Bhisi.Api\SmartBanking_Clean_Master_Deploy.sql", $fullDeploy, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("d:\Bhisi Software\SmartBanking_Clean_Master_Deploy.sql", $fullDeploy, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("d:\Bhisi Software\OfflineRelease\SmartBanking_Clean_Master_Deploy.sql", $fullDeploy, [System.Text.Encoding]::UTF8)

Write-Host "Created SmartBanking_Clean_Master_Deploy.sql successfully in all directories!"

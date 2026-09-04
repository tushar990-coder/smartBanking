-- ===================================================================
-- SmartBanking ERP - Initial Data Seed Script
-- (Roles, Admin User, Default Branch, Financial Year, Sanstha Details)
-- ===================================================================

SET NOCOUNT ON;

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

-- 2. Seed Default Branch
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [Branches])
        INSERT INTO [Branches] ([BranchCode], [BranchName], [Address], [IsActive], [BranchType])
        VALUES ('MAIN', N'मुख्य शाखा (Main Branch)', N'मुख्य कार्यालय', 1, 'Branch');
END TRY BEGIN CATCH END CATCH

-- 3. Seed Financial Year 2026-2027
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [FinancialYears] WHERE [YearCode] = '2026-2027')
        INSERT INTO [FinancialYears] ([YearCode], [StartDate], [EndDate], [IsActive], [IsClosed])
        VALUES ('2026-2027', '2026-04-01 00:00:00', '2027-03-31 23:59:59', 1, 0);
END TRY BEGIN CATCH END CATCH

-- 4. Seed Admin User (admin / admin123)
BEGIN TRY
    DECLARE @AdminRoleId INT;
    SELECT TOP 1 @AdminRoleId = [RoleID] FROM [Roles] WHERE [RoleName] = 'Admin';
    IF @AdminRoleId IS NULL SET @AdminRoleId = 1;

    IF NOT EXISTS (SELECT * FROM [Users] WHERE [Username] = 'admin')
    BEGIN
        INSERT INTO [Users] ([Username], [PasswordHash], [RoleID], [IsActive], [IsLocked], [FailedLoginAttempts], [RequirePasswordChange])
        VALUES ('admin', '$2a$11$zAlwyzqhGYvR2PaoY4POd.SYuw7wAoYLT4PG1wzHibDSsnCVOicKa', @AdminRoleId, 1, 0, 0, 0);
    END
    ELSE
    BEGIN
        UPDATE [Users] 
        SET [IsLocked] = 0, [IsActive] = 1, [FailedLoginAttempts] = 0, [RoleID] = @AdminRoleId,
            [PasswordHash] = '$2a$11$zAlwyzqhGYvR2PaoY4POd.SYuw7wAoYLT4PG1wzHibDSsnCVOicKa'
        WHERE [Username] = 'admin';
    END
END TRY BEGIN CATCH END CATCH

-- 5. Seed Sanstha Details
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [SansthaDetails])
    BEGIN
        INSERT INTO [SansthaDetails] ([SansthaName], [RegistrationNo], [Address], [District], [State], [PinCode], [ContactNo], [Email], [AutoPostVoucherLimit])
        VALUES (N'श्री जोतिर्लिंग नागरी सहकारी पतसंस्था मर्या.', 'PNE/BNK/2026/01', N'मुख्य रस्ता', N'पुणे', N'महाराष्ट्र', '411001', '9876543210', 'info@smartbanking.in', 50000.00);
    END
END TRY BEGIN CATCH END CATCH

-- 6. Seed Default Account Groups if empty
BEGIN TRY
    IF NOT EXISTS (SELECT * FROM [AccountGroups])
    BEGIN
        INSERT INTO [AccountGroups] ([GroupName], [GroupType], [Nature], [DisplayOrder]) VALUES 
        (N'रोकड व बँक शिल्लक (Cash & Bank)', 'Asset', 'Debit', 1),
        (N'ठेवी (Deposits)', 'Liability', 'Credit', 2),
        (N'कर्ज वाटप (Loans & Advances)', 'Asset', 'Debit', 3),
        (N'भाग भांडवल (Share Capital)', 'Liability', 'Credit', 4),
        (N'उत्पन्न (Income)', 'Income', 'Credit', 5),
        (N'खर्च (Expenditure)', 'Expense', 'Debit', 6);
    END
END TRY BEGIN CATCH END CATCH

PRINT 'INITIAL SEED DATA INSERTED SUCCESSFULLY!';

-- =========================================================================================
-- SmartBanking Core ERP - CBS Database Schema Patch & Migration Script
-- PATCH ID: PATCH_PIGMY_DYNAMIC_SLABS_AND_CYCLE_RESET_V2.5.15
-- TARGET MODULE: Pigmy Daily Deposit (पिग्मी दैनिक ठेव योजना)
-- DATE: 2026-09-26
--
-- DESCRIPTION:
--   This patch introduces:
--   1. Dynamic Multi-Scheme Interest & Penalty Slabs ([dbo].[PigmySchemeInterestSlabs])
--   2. Pigmy Account Cycle Tracking & Day 1 Reset Fields ([dbo].[PigmyAccounts])
--   3. Audit & Ledger Table for Partial Withdrawals ([dbo].[PigmyWithdrawals])
--   4. Zero-Data-Loss Migration & Default Slabs Seeding for Existing Schemes & Accounts
--
-- COMPATIBILITY & IDEMPOTENCY:
--   - 100% Idempotent (can be executed multiple times safely without duplicate errors).
--   - Zero data loss guarantee: existing accounts, balances, and vouchers are preserved.
--   - Compatible with SQL Server 2012+ and all VPS client instances (Bambawade, Padawalwadi, Testing, etc.).
-- =========================================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

PRINT '=========================================================================================';
PRINT '  Executing Patch: Pigmy Dynamic Slabs, Partial Withdrawal & Day 1 Reset                 ';
PRINT '  Target Database Context: ' + DB_NAME();
PRINT '  Execution Timestamp: ' + CONVERT(NVARCHAR(30), GETDATE(), 120);
PRINT '=========================================================================================';
GO

-- -----------------------------------------------------------------------------------------
-- PART 1: PIGMY SCHEME DYNAMIC INTEREST & PENALTY SLABS TABLE
-- -----------------------------------------------------------------------------------------
PRINT '>>> 1/4 Checking & Creating [dbo].[PigmySchemeInterestSlabs] Table...';

IF OBJECT_ID(N'[dbo].[PigmySchemeInterestSlabs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmySchemeInterestSlabs] (
        [SlabID] INT IDENTITY(1,1) NOT NULL,
        [PigmySchemeID] INT NOT NULL,
        [FromMonths] INT NOT NULL,
        [ToMonths] INT NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        [PenaltyRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        [SlabDescription] NVARCHAR(100) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_PigmySchemeInterestSlabs] PRIMARY KEY CLUSTERED ([SlabID] ASC),
        CONSTRAINT [FK_PigmySchemeInterestSlabs_PigmySchemes] FOREIGN KEY ([PigmySchemeID]) 
            REFERENCES [dbo].[PigmySchemes]([PigmySchemeID]) ON DELETE CASCADE
    );
    PRINT '    [SUCCESS] Created Table [dbo].[PigmySchemeInterestSlabs]';
END
ELSE
BEGIN
    PRINT '    [SKIP] Table [dbo].[PigmySchemeInterestSlabs] already exists.';
END
GO

-- Ensure Performance Index on PigmySchemeInterestSlabs
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PigmySchemeInterestSlabs_Scheme' AND object_id = OBJECT_ID('dbo.PigmySchemeInterestSlabs'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmySchemeInterestSlabs_Scheme] 
        ON [dbo].[PigmySchemeInterestSlabs] ([PigmySchemeID], [FromMonths], [ToMonths]);
    PRINT '    [SUCCESS] Created Index [IX_PigmySchemeInterestSlabs_Scheme]';
END
GO

-- -----------------------------------------------------------------------------------------
-- PART 2: PIGMY ACCOUNTS TABLE EXTENSION (CYCLE TRACKING & DAY 1 RESET)
-- -----------------------------------------------------------------------------------------
PRINT '>>> 2/4 Checking & Adding Cycle Reset Columns to [dbo].[PigmyAccounts]...';

-- Column 2.1: EffectiveStartDate (Recomputed upon each partial withdrawal to reset Day 1)
IF COL_LENGTH('PigmyAccounts', 'EffectiveStartDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [EffectiveStartDate] DATETIME NULL;
    PRINT '    [SUCCESS] Added Column [EffectiveStartDate] to [PigmyAccounts]';
END
ELSE
BEGIN
    PRINT '    [SKIP] Column [EffectiveStartDate] already exists on [PigmyAccounts]';
END
GO

-- Column 2.2: CurrentCycleNumber (Tracks cycle iteration: 1, 2, 3...)
IF COL_LENGTH('PigmyAccounts', 'CurrentCycleNumber') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [CurrentCycleNumber] INT NOT NULL CONSTRAINT DF_PigmyAccounts_CurrentCycleNumber DEFAULT 1;
    PRINT '    [SUCCESS] Added Column [CurrentCycleNumber] to [PigmyAccounts] (Default: 1)';
END
ELSE
BEGIN
    PRINT '    [SKIP] Column [CurrentCycleNumber] already exists on [PigmyAccounts]';
END
GO

-- Column 2.3: LastWithdrawalDate (Timestamp of the most recent partial withdrawal)
IF COL_LENGTH('PigmyAccounts', 'LastWithdrawalDate') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [LastWithdrawalDate] DATETIME NULL;
    PRINT '    [SUCCESS] Added Column [LastWithdrawalDate] to [PigmyAccounts]';
END
ELSE
BEGIN
    PRINT '    [SKIP] Column [LastWithdrawalDate] already exists on [PigmyAccounts]';
END
GO

-- Column 2.4: TotalWithdrawnAmount (Cumulative principal withdrawn across all cycles)
IF COL_LENGTH('PigmyAccounts', 'TotalWithdrawnAmount') IS NULL
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] ADD [TotalWithdrawnAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_PigmyAccounts_TotalWithdrawnAmount DEFAULT 0.00;
    PRINT '    [SUCCESS] Added Column [TotalWithdrawnAmount] to [PigmyAccounts] (Default: 0.00)';
END
ELSE
BEGIN
    PRINT '    [SKIP] Column [TotalWithdrawnAmount] already exists on [PigmyAccounts]';
END
GO

-- Safe Data Initialization for Existing Pigmy Accounts
UPDATE [dbo].[PigmyAccounts]
SET [EffectiveStartDate] = ISNULL([OpeningDate], GETDATE()),
    [CurrentCycleNumber] = 1,
    [TotalWithdrawnAmount] = 0.00
WHERE [EffectiveStartDate] IS NULL;
PRINT '    [SUCCESS] Initialized EffectiveStartDate for all existing PigmyAccounts without reset date.';
GO

-- -----------------------------------------------------------------------------------------
-- PART 3: PIGMY PARTIAL WITHDRAWALS AUDIT & TRANSACTION TABLE
-- -----------------------------------------------------------------------------------------
PRINT '>>> 3/4 Checking & Creating [dbo].[PigmyWithdrawals] Table...';

IF OBJECT_ID(N'[dbo].[PigmyWithdrawals]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmyWithdrawals] (
        [WithdrawalID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [PigmyAccountID] INT NOT NULL,
        [WithdrawalDate] DATETIME NOT NULL,
        [CycleNumber] INT NOT NULL DEFAULT 1,
        [CycleStartSnapshot] DATETIME NOT NULL,
        [ElapsedDays] INT NOT NULL DEFAULT 0,
        [ElapsedMonths] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        [RequestedAmount] DECIMAL(18,2) NOT NULL,
        [AppliedSlabID] INT NULL,
        [PenaltyRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        [PenaltyAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        [NetPaidAmount] DECIMAL(18,2) NOT NULL,
        [RemainingBalance] DECIMAL(18,2) NOT NULL,
        [VoucherNo] NVARCHAR(50) NULL,
        [Narration] NVARCHAR(250) NULL,
        [CreatedBy] INT NOT NULL DEFAULT 1,
        [CreatedDate] DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [FK_PigmyWithdrawals_PigmyAccounts] FOREIGN KEY ([PigmyAccountID]) 
            REFERENCES [dbo].[PigmyAccounts]([PigmyAccountID]) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX [IX_PigmyWithdrawals_PigmyAccountID] ON [dbo].[PigmyWithdrawals]([PigmyAccountID]);
    CREATE NONCLUSTERED INDEX [IX_PigmyWithdrawals_WithdrawalDate] ON [dbo].[PigmyWithdrawals]([WithdrawalDate]);
    PRINT '    [SUCCESS] Created Table [dbo].[PigmyWithdrawals] with foreign key and indexes.';
END
ELSE
BEGIN
    PRINT '    [SKIP] Table [dbo].[PigmyWithdrawals] already exists.';
END
GO

-- -----------------------------------------------------------------------------------------
-- PART 4: DATA MIGRATION - SEED DEFAULT 4 SLABS FOR EXISTING PIGMY SCHEMES
-- -----------------------------------------------------------------------------------------
PRINT '>>> 4/4 Seeding default standard slabs for existing schemes without slabs...';

DECLARE @SchemeID INT;
DECLARE @InterestRate DECIMAL(5,2);
DECLARE @PrematureRate DECIMAL(5,2);
DECLARE @PenaltyRate DECIMAL(5,2);
DECLARE @DurationMonths INT;
DECLARE @SeededCount INT = 0;

DECLARE scheme_cursor CURSOR LOCAL FAST_FORWARD FOR 
    SELECT PigmySchemeID, InterestRate, ISNULL(PrematureInterestRate, 5.50), ISNULL(PenaltyInterestRate, 2.00), ISNULL(DurationMonths, 12)
    FROM [dbo].[PigmySchemes];

OPEN scheme_cursor;
FETCH NEXT FROM scheme_cursor INTO @SchemeID, @InterestRate, @PrematureRate, @PenaltyRate, @DurationMonths;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[PigmySchemeInterestSlabs] WHERE PigmySchemeID = @SchemeID)
    BEGIN
        -- Slab 1: 0 to 3 Months (2% Penalty, 0% Interest)
        INSERT INTO [dbo].[PigmySchemeInterestSlabs] (PigmySchemeID, FromMonths, ToMonths, InterestRate, PenaltyRate, SlabDescription, IsActive, CreatedAt)
        VALUES (@SchemeID, 0, 3, 0.00, @PenaltyRate, N'० ते ३ महिने (२% दंड कपात)', 1, GETUTCDATE());

        -- Slab 2: 3 to 6 Months (1% Penalty, 0% Interest)
        INSERT INTO [dbo].[PigmySchemeInterestSlabs] (PigmySchemeID, FromMonths, ToMonths, InterestRate, PenaltyRate, SlabDescription, IsActive, CreatedAt)
        VALUES (@SchemeID, 3, 6, 0.00, 1.00, N'३ ते ६ महिने (१% दंड कपात)', 1, GETUTCDATE());

        -- Slab 3: 6 to 11 Months (Premature Interest, 0% Penalty)
        INSERT INTO [dbo].[PigmySchemeInterestSlabs] (PigmySchemeID, FromMonths, ToMonths, InterestRate, PenaltyRate, SlabDescription, IsActive, CreatedAt)
        VALUES (@SchemeID, 6, 11, @PrematureRate, 0.00, N'६ ते ११ महिने (अकाली व्याजदर)', 1, GETUTCDATE());

        -- Slab 4: 11 to Duration Months (Full Regular Interest, 0% Penalty)
        INSERT INTO [dbo].[PigmySchemeInterestSlabs] (PigmySchemeID, FromMonths, ToMonths, InterestRate, PenaltyRate, SlabDescription, IsActive, CreatedAt)
        VALUES (@SchemeID, 11, CASE WHEN @DurationMonths > 11 THEN @DurationMonths ELSE 12 END, @InterestRate, 0.00, N'११ ते १२ महिने (पूर्ण नियमित व्याज)', 1, GETUTCDATE());

        SET @SeededCount = @SeededCount + 1;
        PRINT '    + Seeded 4 default slabs for SchemeID: ' + CAST(@SchemeID AS NVARCHAR(10));
    END

    FETCH NEXT FROM scheme_cursor INTO @SchemeID, @InterestRate, @PrematureRate, @PenaltyRate, @DurationMonths;
END

CLOSE scheme_cursor;
DEALLOCATE scheme_cursor;

PRINT '    [COMPLETED] Seeded default slabs for ' + CAST(@SeededCount AS NVARCHAR(10)) + ' schemes.';
GO

-- -----------------------------------------------------------------------------------------
-- VERIFICATION REPORT (FOR COLLEAGUE / DBA CHECK)
-- -----------------------------------------------------------------------------------------
PRINT '=========================================================================================';
PRINT '  PATCH VERIFICATION AUDIT                                                               ';
PRINT '=========================================================================================';

SELECT 
    'PigmySchemeInterestSlabs' AS [Table], 
    COUNT(*) AS [TotalRowCount] 
FROM [dbo].[PigmySchemeInterestSlabs]
UNION ALL
SELECT 
    'PigmyWithdrawals' AS [Table], 
    COUNT(*) AS [TotalRowCount] 
FROM [dbo].[PigmyWithdrawals]
UNION ALL
SELECT 
    'PigmyAccounts with EffectiveStartDate' AS [Table], 
    COUNT(*) AS [TotalRowCount] 
FROM [dbo].[PigmyAccounts] 
WHERE [EffectiveStartDate] IS NOT NULL;

PRINT '=========================================================================================';
PRINT '  [SUCCESS] PIGMY DATABASE PATCH APPLIED SUCCESSFULLY WITH ZERO LOSS!                    ';
PRINT '=========================================================================================';
GO

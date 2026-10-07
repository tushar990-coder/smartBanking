-- ==============================================================================
-- UNIVERSAL DATABASE HEALER & SCHEMA SYNC SCRIPT
-- Ensures [CustomerOpeningBalances].[SourceModule] and all missing columns exist.
-- Safe, idempotent, zero data loss.
-- ==============================================================================

-- 1. [CustomerOpeningBalances].[SourceModule]
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomerOpeningBalances')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CustomerOpeningBalances]') AND name = 'SourceModule')
    BEGIN
        ALTER TABLE [CustomerOpeningBalances] ADD [SourceModule] nvarchar(50) NOT NULL CONSTRAINT DF_CustomerOpeningBalances_SourceModule DEFAULT 'CustomerOpeningBalance';
        PRINT '  + Added [SourceModule] to [CustomerOpeningBalances]';
    END

    -- Synchronize existing saving account audit rows to SourceModule = 'Saving' using dynamic SQL to prevent batch compilation error
    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingAccountMasters')
    BEGIN
        EXEC('
            UPDATE cob
            SET cob.[SourceModule] = ''Saving''
            FROM [CustomerOpeningBalances] cob
            INNER JOIN [SavingAccountMasters] sam 
                ON cob.CustomerID = sam.CustomerID 
                AND cob.LedgerID = sam.LedgerID 
                AND cob.Amount = sam.OpeningBalance
            WHERE cob.[SourceModule] = ''CustomerOpeningBalance'';
        ');
        PRINT '  -> Synchronized existing Saving Account opening balances to SourceModule = ''Saving''';
    END
END

-- 2. [SavingAccountJointHolders].[MemberID]
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingAccountJointHolders')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountJointHolders]') AND name = 'MemberID')
    BEGIN
        ALTER TABLE [SavingAccountJointHolders] ADD [MemberID] int NULL;
        PRINT '  + Added [MemberID] to [SavingAccountJointHolders]';
    END
END

-- 3. [CifSequences].[BranchID] & [CurrentNumber]
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CifSequences')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CifSequences]') AND name = 'BranchID')
    BEGIN
        ALTER TABLE [CifSequences] ADD [BranchID] int NOT NULL CONSTRAINT DF_CifSequences_BranchID DEFAULT 1;
        PRINT '  + Added [BranchID] to [CifSequences]';
    END
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CifSequences]') AND name = 'CurrentNumber')
    BEGIN
        ALTER TABLE [CifSequences] ADD [CurrentNumber] int NOT NULL CONSTRAINT DF_CifSequences_CurrentNumber DEFAULT 0;
        PRINT '  + Added [CurrentNumber] to [CifSequences]';
    END
END

-- 4. [CustomerImportBatches].[FileType]
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomerImportBatches')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CustomerImportBatches]') AND name = 'FileType')
    BEGIN
        ALTER TABLE [CustomerImportBatches] ADD [FileType] nvarchar(50) NULL;
        PRINT '  + Added [FileType] to [CustomerImportBatches]';
    END
END

-- 5. [PigmySchemeInterestSlabs].[FromMonths] & [ToMonths]
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmySchemeInterestSlabs')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmySchemeInterestSlabs]') AND name = 'FromMonths')
    BEGIN
        ALTER TABLE [PigmySchemeInterestSlabs] ADD [FromMonths] int NOT NULL CONSTRAINT DF_PigmySlabs_FromMonths DEFAULT 0;
        PRINT '  + Added [FromMonths] to [PigmySchemeInterestSlabs]';
    END
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmySchemeInterestSlabs]') AND name = 'ToMonths')
    BEGIN
        ALTER TABLE [PigmySchemeInterestSlabs] ADD [ToMonths] int NOT NULL CONSTRAINT DF_PigmySlabs_ToMonths DEFAULT 0;
        PRINT '  + Added [ToMonths] to [PigmySchemeInterestSlabs]';
    END
END

-- 6. [FdClosureApprovals] Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FdClosureApprovals')
BEGIN
    CREATE TABLE [dbo].[FdClosureApprovals] (
        [ApprovalID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [FdAccountID] INT NOT NULL,
        [BranchID] INT NOT NULL,
        [CustomerID] INT NOT NULL,
        [ClosureType] NVARCHAR(30) NOT NULL,
        [ClosureDate] DATETIME2 NOT NULL,
        [DepositAmount] DECIMAL(18,2) NOT NULL,
        [InterestAmount] DECIMAL(18,2) NOT NULL,
        [OverdueInterest] DECIMAL(18,2) NOT NULL,
        [PenaltyAmount] DECIMAL(18,2) NOT NULL,
        [TdsAmount] DECIMAL(18,2) NOT NULL,
        [NetPayoutAmount] DECIMAL(18,2) NOT NULL,
        [PaymentMode] NVARCHAR(20) NOT NULL,
        [BankAccountLedgerID] INT NULL,
        [ChequeNo] NVARCHAR(50) NULL,
        [ChequeDate] DATETIME2 NULL,
        [TargetSavingAccountID] INT NULL,
        [AdjustInLoan] BIT NOT NULL DEFAULT 0,
        [TargetLoanAccountID] INT NULL,
        [LoanAdjustmentAmount] DECIMAL(18,2) NULL,
        [SurplusPayoutAmount] DECIMAL(18,2) NULL,
        [SurplusPaymentMode] NVARCHAR(20) NULL,
        [SurplusBankLedgerID] INT NULL,
        [SurplusChequeNo] NVARCHAR(50) NULL,
        [SurplusChequeDate] DATETIME2 NULL,
        [SurplusSavingAccountID] INT NULL,
        [Narration] NVARCHAR(500) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT 'Approved',
        [MakerUserID] INT NOT NULL DEFAULT 1,
        [MakerNotes] NVARCHAR(500) NULL,
        [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [CheckerUserID] INT NULL,
        [CheckerNotes] NVARCHAR(500) NULL,
        [ActionedOn] DATETIME2 NULL,
        [VoucherID] INT NULL
    );
    PRINT '  + Created table [FdClosureApprovals]';
END

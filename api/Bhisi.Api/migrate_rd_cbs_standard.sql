-- ==============================================================================
-- CBS Standardization for Recurring Deposit (RD) Module
-- Idempotent, safe migration script for all databases
-- ==============================================================================

-- 1. Create RDInstallmentSchedules Table if not exists
IF OBJECT_ID(N'[dbo].[RDInstallmentSchedules]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RDInstallmentSchedules] (
        [ScheduleID] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [RdAccountID] INT NOT NULL,
        [InstallmentNo] INT NOT NULL,
        [DueDate] DATE NOT NULL,
        [GraceDate] DATE NOT NULL,
        [ExpectedAmount] DECIMAL(18,2) NOT NULL,
        [PaidDate] DATETIME2 NULL,
        [PaidAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_RDInstallmentSchedules_PaidAmount DEFAULT 0.00,
        [OverdueDays] INT NOT NULL CONSTRAINT DF_RDInstallmentSchedules_OverdueDays DEFAULT 0,
        [PenaltyCharged] DECIMAL(18,2) NOT NULL CONSTRAINT DF_RDInstallmentSchedules_PenaltyCharged DEFAULT 0.00,
        [PenaltyWaived] DECIMAL(18,2) NOT NULL CONSTRAINT DF_RDInstallmentSchedules_PenaltyWaived DEFAULT 0.00,
        [PaymentMode] NVARCHAR(30) NULL,
        [VoucherID] INT NULL,
        [Status] NVARCHAR(20) NOT NULL CONSTRAINT DF_RDInstallmentSchedules_Status DEFAULT 'Pending',
        CONSTRAINT [FK_RDInstallmentSchedules_RdAccounts] FOREIGN KEY ([RdAccountID]) 
            REFERENCES [dbo].[RdAccounts]([RdAccountID]) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX [IX_RDInstallmentSchedules_Account_Due] 
        ON [dbo].[RDInstallmentSchedules] ([RdAccountID], [DueDate], [Status]);

    PRINT 'Created RDInstallmentSchedules table successfully.';
END
ELSE
BEGIN
    PRINT 'RDInstallmentSchedules table already exists.';
END
GO

-- 2. Alter RdAccounts with CBS Enterprise Fields
IF COL_LENGTH('RdAccounts', 'CumulativeInterestAccrued') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [CumulativeInterestAccrued] DECIMAL(18,2) NOT NULL CONSTRAINT DF_RdAccounts_CumInt DEFAULT 0.00;

IF COL_LENGTH('RdAccounts', 'IsLienMarked') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [IsLienMarked] BIT NOT NULL CONSTRAINT DF_RdAccounts_IsLien DEFAULT 0;

IF COL_LENGTH('RdAccounts', 'LienLoanAccountNo') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [LienLoanAccountNo] NVARCHAR(30) NULL;

IF COL_LENGTH('RdAccounts', 'LienAmount') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [LienAmount] DECIMAL(18,2) NULL;

IF COL_LENGTH('RdAccounts', 'AutoDebitDay') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [AutoDebitDay] INT NOT NULL CONSTRAINT DF_RdAccounts_AutoDebitDay DEFAULT 10;

IF COL_LENGTH('RdAccounts', 'ClosureDate') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [ClosureDate] DATETIME2 NULL;

IF COL_LENGTH('RdAccounts', 'ClosureType') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [ClosureType] NVARCHAR(30) NULL;

IF COL_LENGTH('RdAccounts', 'ClosedPayoutAmount') IS NULL
    ALTER TABLE [dbo].[RdAccounts] ADD [ClosedPayoutAmount] DECIMAL(18,2) NULL;

PRINT 'RdAccounts table columns verified and synchronized.';
GO

-- 3. Alter RdAccountSequences for CBS 14-Digit Standard
IF COL_LENGTH('RdAccountSequences', 'SchemeCodeNumeric') IS NULL
    ALTER TABLE [dbo].[RdAccountSequences] ADD [SchemeCodeNumeric] INT NOT NULL CONSTRAINT DF_RdSeq_Scheme DEFAULT 201;

IF COL_LENGTH('RdAccountSequences', 'LastSequenceNumber') IS NULL
    ALTER TABLE [dbo].[RdAccountSequences] ADD [LastSequenceNumber] INT NOT NULL CONSTRAINT DF_RdSeq_Last DEFAULT 0;

IF COL_LENGTH('RdAccountSequences', 'UpdatedOn') IS NULL
    ALTER TABLE [dbo].[RdAccountSequences] ADD [UpdatedOn] DATETIME NULL;

PRINT 'RdAccountSequences table columns verified and synchronized.';
GO

-- 4. Alter RdTransactions for Passbook and Running Balances
IF COL_LENGTH('RdTransactions', 'BalanceAfterTxn') IS NULL
    ALTER TABLE [dbo].[RdTransactions] ADD [BalanceAfterTxn] DECIMAL(18,2) NULL;

IF COL_LENGTH('RdTransactions', 'Narration') IS NULL
    ALTER TABLE [dbo].[RdTransactions] ADD [Narration] NVARCHAR(250) NULL;

PRINT 'RdTransactions table columns verified and synchronized.';
GO

-- 5. Alter RdSchemes with CBS parameters
IF COL_LENGTH('RdSchemes', 'SchemeCodeNumeric') IS NULL
    ALTER TABLE [dbo].[RdSchemes] ADD [SchemeCodeNumeric] INT NOT NULL CONSTRAINT DF_RdSchemes_SchemeCodeNum DEFAULT 201;

IF COL_LENGTH('RdSchemes', 'CompoundingFrequency') IS NULL
    ALTER TABLE [dbo].[RdSchemes] ADD [CompoundingFrequency] NVARCHAR(20) NOT NULL CONSTRAINT DF_RdSchemes_CompFreq DEFAULT 'Quarterly';

IF COL_LENGTH('RdSchemes', 'GracePeriodDays') IS NULL
    ALTER TABLE [dbo].[RdSchemes] ADD [GracePeriodDays] INT NOT NULL CONSTRAINT DF_RdSchemes_GraceDays DEFAULT 5;

PRINT 'RdSchemes table columns verified and synchronized.';
GO

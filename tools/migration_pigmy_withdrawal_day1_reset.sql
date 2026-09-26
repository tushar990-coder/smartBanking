-- ==============================================================================
-- PIGMY PARTIAL WITHDRAWAL & DAY 1 RESET ARCHITECTURE MIGRATION
-- Database: SmartBanking_Testing (Remote Server: tcp:43.239.93.47,15050)
-- ==============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[PigmyAccounts]') AND name = 'EffectiveStartDate'
)
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts]
    ADD [EffectiveStartDate] DATETIME NULL;
    PRINT 'Added EffectiveStartDate to PigmyAccounts';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[PigmyAccounts]') AND name = 'CurrentCycleNumber'
)
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts]
    ADD [CurrentCycleNumber] INT NOT NULL CONSTRAINT DF_PigmyAccounts_CurrentCycleNumber DEFAULT 1;
    PRINT 'Added CurrentCycleNumber to PigmyAccounts';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[PigmyAccounts]') AND name = 'LastWithdrawalDate'
)
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts]
    ADD [LastWithdrawalDate] DATETIME NULL;
    PRINT 'Added LastWithdrawalDate to PigmyAccounts';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[PigmyAccounts]') AND name = 'TotalWithdrawnAmount'
)
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts]
    ADD [TotalWithdrawnAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_PigmyAccounts_TotalWithdrawnAmount DEFAULT 0.00;
    PRINT 'Added TotalWithdrawnAmount to PigmyAccounts';
END
GO

-- Initialize existing accounts
UPDATE [dbo].[PigmyAccounts]
SET [EffectiveStartDate] = [OpeningDate],
    [CurrentCycleNumber] = 1,
    [TotalWithdrawnAmount] = 0.00
WHERE [EffectiveStartDate] IS NULL;
PRINT 'Initialized EffectiveStartDate for existing PigmyAccounts';
GO

-- Create PigmyWithdrawals tracking table if not exists
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PigmyWithdrawals')
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
    CREATE INDEX [IX_PigmyWithdrawals_PigmyAccountID] ON [dbo].[PigmyWithdrawals]([PigmyAccountID]);
    CREATE INDEX [IX_PigmyWithdrawals_WithdrawalDate] ON [dbo].[PigmyWithdrawals]([WithdrawalDate]);
    PRINT 'Created PigmyWithdrawals table with indexes and constraints';
END
ELSE
BEGIN
    PRINT 'PigmyWithdrawals table already exists';
END
GO

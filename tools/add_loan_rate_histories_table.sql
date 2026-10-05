-- =========================================================================================
-- SmartBanking CBS: LoanRateHistories Table Migration
-- Purpose: Tracks historical interest rate revisions, Board Resolution numbers, 
--          effective dates, reasons, and user audit trails for all Loan Schemes.
-- =========================================================================================

SET NOCOUNT ON;
PRINT N'Starting LoanRateHistories table creation/verification...';

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanRateHistories')
BEGIN
    CREATE TABLE [dbo].[LoanRateHistories] (
        [HistoryID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [LoanRateID] INT NOT NULL,
        [OldInterestRate] DECIMAL(18,2) NOT NULL,
        [NewInterestRate] DECIMAL(18,2) NOT NULL,
        [OldOverdueInterestRate] DECIMAL(18,2) NOT NULL,
        [NewOverdueInterestRate] DECIMAL(18,2) NOT NULL,
        [ResolutionNo] NVARCHAR(100) NOT NULL DEFAULT '',
        [ResolutionDate] DATETIME2 NULL,
        [EffectiveDate] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [Reason] NVARCHAR(500) NULL,
        [ChangedByUserID] INT NOT NULL DEFAULT 1,
        [ChangedByUsername] NVARCHAR(100) NOT NULL DEFAULT 'System',
        [ChangedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [IPAddress] NVARCHAR(50) NULL,
        CONSTRAINT [FK_LoanRateHistories_LoanRates] FOREIGN KEY ([LoanRateID]) 
            REFERENCES [dbo].[LoanRates]([LoanRateID]) ON DELETE CASCADE
    );

    PRINT N'  + [SUCCESS] Created table [dbo].[LoanRateHistories].';
END
ELSE
BEGIN
    PRINT N'  + Table [dbo].[LoanRateHistories] already exists.';
END

-- Ensure Index on LoanRateID
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_LoanRateHistories_LoanRateID' 
      AND object_id = OBJECT_ID('dbo.LoanRateHistories')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanRateHistories_LoanRateID] 
    ON [dbo].[LoanRateHistories]([LoanRateID] ASC);

    PRINT N'  + [SUCCESS] Created Index [IX_LoanRateHistories_LoanRateID].';
END

-- Ensure Index on EffectiveDate
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_LoanRateHistories_EffectiveDate' 
      AND object_id = OBJECT_ID('dbo.LoanRateHistories')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_LoanRateHistories_EffectiveDate] 
    ON [dbo].[LoanRateHistories]([EffectiveDate] DESC);

    PRINT N'  + [SUCCESS] Created Index [IX_LoanRateHistories_EffectiveDate].';
END
GO

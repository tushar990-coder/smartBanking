SET NOCOUNT ON;

-- 1. FdAccounts ParentFdAccountID
IF COL_LENGTH('dbo.FdAccounts', 'ParentFdAccountID') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [ParentFdAccountID] INT NULL;
    PRINT '  + Added column [ParentFdAccountID] to [dbo].[FdAccounts]';
END

-- 2. Create FdAutoRenewalLogs Table
IF OBJECT_ID(N'[dbo].[FdAutoRenewalLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FdAutoRenewalLogs] (
        [LogID] INT IDENTITY(1,1) NOT NULL,
        [InstitutionID] INT NOT NULL DEFAULT 1,
        [BranchID] INT NOT NULL,
        [BatchDate] DATETIME2 NOT NULL,
        [OldFdAccountID] INT NOT NULL,
        [NewFdAccountID] INT NULL,
        [OldAccountNo] NVARCHAR(30) NOT NULL,
        [NewAccountNo] NVARCHAR(30) NULL,
        [CustomerID] INT NOT NULL,
        [CustomerName] NVARCHAR(150) NOT NULL,
        [RenewalOption] NVARCHAR(30) NOT NULL,
        [RenewedAmount] DECIMAL(18,2) NOT NULL,
        [InterestPaidOut] DECIMAL(18,2) NOT NULL,
        [AppliedRate] DECIMAL(5,2) NOT NULL,
        [VoucherID] INT NULL,
        [Status] NVARCHAR(20) NOT NULL,
        [ErrorMessage] NVARCHAR(500) NULL,
        [ExecutedBy] NVARCHAR(100) NOT NULL,
        [ExecutionTime] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [IsReverted] BIT NOT NULL DEFAULT 0,
        [RevertedDate] DATETIME2 NULL,
        [RevertedBy] NVARCHAR(100) NULL,
        [RevertReason] NVARCHAR(250) NULL,
        CONSTRAINT [PK_FdAutoRenewalLogs] PRIMARY KEY CLUSTERED ([LogID] ASC)
    );
    PRINT '  + Created Table [dbo].[FdAutoRenewalLogs]';
END
ELSE
BEGIN
    PRINT '  - Table [dbo].[FdAutoRenewalLogs] already exists.';
END

-- =========================================================================================
-- SmartBanking CBS - FD Tenor Slabs & Duration Type (Days/Months/Years) Migration Script
-- Zero Data Loss - Safe and Idempotent
-- =========================================================================================

SET NOCOUNT ON;
GO

PRINT '>>> Updating FdSchemes for DurationType and SchemeDurationModel...';

-- 1. FdSchemes Columns
IF COL_LENGTH('dbo.FdSchemes', 'DurationType') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [DurationType] NVARCHAR(20) NOT NULL DEFAULT 'Months';
    PRINT '  + Added column [DurationType] to [dbo].[FdSchemes]';
END
GO

IF COL_LENGTH('dbo.FdSchemes', 'SchemeDurationModel') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [SchemeDurationModel] NVARCHAR(20) NOT NULL DEFAULT 'Fixed';
    PRINT '  + Added column [SchemeDurationModel] to [dbo].[FdSchemes]';
END
GO

IF COL_LENGTH('dbo.FdSchemes', 'MinDurationDays') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [MinDurationDays] INT NULL;
    PRINT '  + Added column [MinDurationDays] to [dbo].[FdSchemes]';
END
GO

IF COL_LENGTH('dbo.FdSchemes', 'MaxDurationDays') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdSchemes] ADD [MaxDurationDays] INT NULL;
    PRINT '  + Added column [MaxDurationDays] to [dbo].[FdSchemes]';
END
GO

-- 2. FdAccounts Columns
PRINT '>>> Updating FdAccounts for DurationType and DurationValue...';

IF COL_LENGTH('dbo.FdAccounts', 'DurationType') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [DurationType] NVARCHAR(20) NULL DEFAULT 'Months';
    PRINT '  + Added column [DurationType] to [dbo].[FdAccounts]';
END
GO

IF COL_LENGTH('dbo.FdAccounts', 'DurationValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [DurationValue] INT NULL;
    PRINT '  + Added column [DurationValue] to [dbo].[FdAccounts]';
END
GO

IF COL_LENGTH('dbo.FdAccounts', 'DurationInDays') IS NULL
BEGIN
    ALTER TABLE [dbo].[FdAccounts] ADD [DurationInDays] INT NULL;
    PRINT '  + Added column [DurationInDays] to [dbo].[FdAccounts]';
END
GO

-- 3. Create FdSchemeInterestSlabs Table
PRINT '>>> Creating Table [dbo].[FdSchemeInterestSlabs] if not exists...';

IF OBJECT_ID(N'[dbo].[FdSchemeInterestSlabs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[FdSchemeInterestSlabs] (
        [SlabID] INT IDENTITY(1,1) NOT NULL,
        [FdSchemeID] INT NOT NULL,
        [FromDays] INT NOT NULL,
        [ToDays] INT NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL,
        [SeniorCitizenRate] DECIMAL(5,2) NOT NULL,
        [PrematureRate] DECIMAL(5,2) NOT NULL DEFAULT 0,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [PK_FdSchemeInterestSlabs] PRIMARY KEY CLUSTERED ([SlabID] ASC),
        CONSTRAINT [FK_FdSchemeInterestSlabs_FdSchemes] FOREIGN KEY ([FdSchemeID]) 
            REFERENCES [dbo].[FdSchemes]([FdSchemeID]) ON DELETE CASCADE
    );
    PRINT '  + Created Table [dbo].[FdSchemeInterestSlabs]';
END
ELSE
BEGIN
    PRINT '  - Table [dbo].[FdSchemeInterestSlabs] already exists.';
END
GO

PRINT '>>> Migration completed successfully.';
GO

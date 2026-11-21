-- Phase 2 (Temporary Customer Login & Portal Testing Schema Patch)
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Customers')
BEGIN
    IF COL_LENGTH('Customers', 'PortalPinHash') IS NULL
        ALTER TABLE [dbo].[Customers] ADD [PortalPinHash] nvarchar(255) NULL;
    IF COL_LENGTH('Customers', 'PortalFailedAttempts') IS NULL
        ALTER TABLE [dbo].[Customers] ADD [PortalFailedAttempts] int NOT NULL DEFAULT 0;
    IF COL_LENGTH('Customers', 'IsPortalLocked') IS NULL
        ALTER TABLE [dbo].[Customers] ADD [IsPortalLocked] bit NOT NULL DEFAULT 0;
    IF COL_LENGTH('Customers', 'PortalSessionToken') IS NULL
        ALTER TABLE [dbo].[Customers] ADD [PortalSessionToken] nvarchar(2000) NULL;
END
GO

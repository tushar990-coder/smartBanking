-- =========================================================================================
-- SmartBanking ERP - Pigmy Module 100% Pure Customer-First (CustomerID / CIF) Migration
-- Zero Member Dependency - Removes MemberID from PigmyAccounts & adds CustomerID to Vouchers
-- =========================================================================================
SET NOCOUNT ON;
PRINT '-------------------------------------------------------------------------';
PRINT 'Starting Migration: Decoupling Pigmy Module from Members -> 100% CustomerID';
PRINT '-------------------------------------------------------------------------';

-- 1. Ensure VoucherDetails has CustomerID
IF COL_LENGTH('dbo.VoucherDetails', 'CustomerID') IS NULL
BEGIN
    PRINT '>>> Step 1: Adding CustomerID column to [dbo.VoucherDetails]...';
    ALTER TABLE [dbo].[VoucherDetails] ADD [CustomerID] INT NULL;
    PRINT '    [+] Column CustomerID added to VoucherDetails.';
END
ELSE
BEGIN
    PRINT '>>> Step 1: CustomerID already exists on [dbo.VoucherDetails].';
END
GO

-- Add Foreign Key & Index on VoucherDetails.CustomerID
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_VoucherDetails_Customers_CustomerID')
BEGIN
    PRINT '    [+] Creating FK_VoucherDetails_Customers_CustomerID...';
    ALTER TABLE [dbo].[VoucherDetails] WITH CHECK ADD CONSTRAINT [FK_VoucherDetails_Customers_CustomerID]
    FOREIGN KEY ([CustomerID]) REFERENCES [dbo].[Customers] ([CustomerID]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VoucherDetails_CustomerID' AND object_id = OBJECT_ID('dbo.VoucherDetails'))
BEGIN
    PRINT '    [+] Creating index IX_VoucherDetails_CustomerID...';
    CREATE NONCLUSTERED INDEX [IX_VoucherDetails_CustomerID] ON [dbo].[VoucherDetails] ([CustomerID]);
END
GO

-- 2. Ensure AgentCustomerRequests has CreatedCustomerID
IF COL_LENGTH('dbo.AgentCustomerRequests', 'CreatedCustomerID') IS NULL
BEGIN
    PRINT '>>> Step 2: Adding CreatedCustomerID column to [dbo.AgentCustomerRequests]...';
    ALTER TABLE [dbo].[AgentCustomerRequests] ADD [CreatedCustomerID] INT NULL;
    PRINT '    [+] Column CreatedCustomerID added to AgentCustomerRequests.';
END
ELSE
BEGIN
    PRINT '>>> Step 2: CreatedCustomerID already exists on [dbo.AgentCustomerRequests].';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AgentCustomerRequests_Customers_CreatedCustomerID')
BEGIN
    PRINT '    [+] Creating FK_AgentCustomerRequests_Customers_CreatedCustomerID...';
    ALTER TABLE [dbo].[AgentCustomerRequests] WITH CHECK ADD CONSTRAINT [FK_AgentCustomerRequests_Customers_CreatedCustomerID]
    FOREIGN KEY ([CreatedCustomerID]) REFERENCES [dbo].[Customers] ([CustomerID]);
END
GO

-- 3. Ensure PigmyAccounts has CustomerID column
IF COL_LENGTH('dbo.PigmyAccounts', 'CustomerID') IS NULL
BEGIN
    PRINT '>>> Step 3: Adding CustomerID column to [dbo.PigmyAccounts]...';
    ALTER TABLE [dbo].[PigmyAccounts] ADD [CustomerID] INT NULL;
    PRINT '    [+] Column CustomerID added to PigmyAccounts.';
END
ELSE
BEGIN
    PRINT '>>> Step 3: CustomerID column already present on [dbo.PigmyAccounts].';
END
GO

-- 4. Backfill CustomerID from Members.CustomerID (Accurate Relationship)
PRINT '>>> Step 4: Backfilling PigmyAccounts.CustomerID from Members.CustomerID...';
IF COL_LENGTH('dbo.PigmyAccounts', 'MemberID') IS NOT NULL
BEGIN
    UPDATE p
    SET p.CustomerID = m.CustomerID
    FROM [dbo].[PigmyAccounts] p
    INNER JOIN [dbo].[Members] m ON p.MemberID = m.MemberID
    WHERE (p.CustomerID IS NULL OR p.CustomerID = 0) AND m.CustomerID IS NOT NULL;
    
    PRINT '    [+] CustomerID mapped from linked Members successfully.';
END
GO

-- 5. Guarantee Every PigmyAccount Has a Customer (Resolve Orphans if any)
PRINT '>>> Step 5: Resolving any orphan PigmyAccounts without CustomerID...';
DECLARE @OrphanCount INT = 0;
SELECT @OrphanCount = COUNT(*) FROM [dbo].[PigmyAccounts] WHERE CustomerID IS NULL OR CustomerID = 0;

IF @OrphanCount > 0
BEGIN
    PRINT '    [!] Found ' + CAST(@OrphanCount AS VARCHAR(10)) + ' orphan accounts. Auto-creating Customer profiles...';
    
    DECLARE @BranchID INT;
    DECLARE @AccNo NVARCHAR(30);
    DECLARE @AccID INT;
    
    DECLARE orphan_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT PigmyAccountID, AccountNo, BranchID 
    FROM [dbo].[PigmyAccounts] 
    WHERE CustomerID IS NULL OR CustomerID = 0;
    
    OPEN orphan_cursor;
    FETCH NEXT FROM orphan_cursor INTO @AccID, @AccNo, @BranchID;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @NewCustID INT;
        INSERT INTO [dbo].[Customers] (BranchID, FirstName, LastName, Status, CreatedOn, CreatedBy)
        VALUES (@BranchID, 'Pigmy', 'Customer ' + @AccNo, 'Active', GETDATE(), 1);
        SET @NewCustID = SCOPE_IDENTITY();
        
        UPDATE [dbo].[PigmyAccounts] 
        SET CustomerID = @NewCustID 
        WHERE PigmyAccountID = @AccID;
        
        FETCH NEXT FROM orphan_cursor INTO @AccID, @AccNo, @BranchID;
    END;
    
    CLOSE orphan_cursor;
    DEALLOCATE orphan_cursor;
    PRINT '    [+] All orphan accounts mapped to new Customer records.';
END
ELSE
BEGIN
    PRINT '    [+] Zero orphan accounts found. 100% of PigmyAccounts have valid CustomerID.';
END
GO

-- 6. Drop Foreign Key and Index on MemberID from PigmyAccounts
PRINT '>>> Step 6: Dropping MemberID foreign key and index from PigmyAccounts...';
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PigmyAccounts_Members_MemberID')
BEGIN
    ALTER TABLE [dbo].[PigmyAccounts] DROP CONSTRAINT [FK_PigmyAccounts_Members_MemberID];
    PRINT '    [+] Dropped FK_PigmyAccounts_Members_MemberID.';
END

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PigmyAccounts_MemberID' AND object_id = OBJECT_ID('dbo.PigmyAccounts'))
BEGIN
    DROP INDEX [IX_PigmyAccounts_MemberID] ON [dbo].[PigmyAccounts];
    PRINT '    [+] Dropped index IX_PigmyAccounts_MemberID.';
END
GO

-- 7. Enforce PigmyAccounts.CustomerID INT NOT NULL
PRINT '>>> Step 7: Enforcing CustomerID INT NOT NULL on PigmyAccounts...';
ALTER TABLE [dbo].[PigmyAccounts] ALTER COLUMN [CustomerID] INT NOT NULL;
PRINT '    [+] PigmyAccounts.CustomerID is now NOT NULL.';
GO

-- 8. Add/Verify Foreign Key and Index on PigmyAccounts.CustomerID
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PigmyAccounts_Customers_CustomerID')
BEGIN
    PRINT '    [+] Creating FK_PigmyAccounts_Customers_CustomerID...';
    ALTER TABLE [dbo].[PigmyAccounts] WITH CHECK ADD CONSTRAINT [FK_PigmyAccounts_Customers_CustomerID]
    FOREIGN KEY ([CustomerID]) REFERENCES [dbo].[Customers] ([CustomerID]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PigmyAccounts_CustomerID' AND object_id = OBJECT_ID('dbo.PigmyAccounts'))
BEGIN
    PRINT '    [+] Creating index IX_PigmyAccounts_CustomerID...';
    CREATE NONCLUSTERED INDEX [IX_PigmyAccounts_CustomerID] ON [dbo].[PigmyAccounts] ([CustomerID]);
END
GO

-- 9. Drop Column MemberID Completely from PigmyAccounts
PRINT '>>> Step 9: Dropping MemberID column permanently from PigmyAccounts...';
IF COL_LENGTH('dbo.PigmyAccounts', 'MemberID') IS NOT NULL
BEGIN
    -- Drop any default constraint bound to MemberID if present
    DECLARE @DfName NVARCHAR(128);
    SELECT @DfName = d.name 
    FROM sys.default_constraints d 
    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
    WHERE d.parent_object_id = OBJECT_ID('dbo.PigmyAccounts') AND c.name = 'MemberID';
    
    IF @DfName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.[PigmyAccounts] DROP CONSTRAINT [' + @DfName + '];');
        PRINT '    [+] Dropped default constraint ' + @DfName + '.';
    END

    ALTER TABLE [dbo].[PigmyAccounts] DROP COLUMN [MemberID];
    PRINT '    [+] Successfully DROPPED column MemberID from PigmyAccounts!';
END
ELSE
BEGIN
    PRINT '    [+] Column MemberID already dropped from PigmyAccounts.';
END
GO

-- 10. Verification
PRINT '-------------------------------------------------------------------------';
PRINT 'Verification:';
SELECT 
    t.name AS TableName, 
    c.name AS ColumnName, 
    ty.name AS DataType, 
    c.is_nullable AS IsNullable 
FROM sys.tables t 
JOIN sys.columns c ON t.object_id = c.object_id 
JOIN sys.types ty ON c.user_type_id = ty.user_type_id 
WHERE t.name IN ('PigmyAccounts', 'VoucherDetails', 'AgentCustomerRequests') 
  AND c.name IN ('CustomerID', 'MemberID', 'CreatedCustomerID', 'CreatedMemberID')
ORDER BY t.name, c.name;
PRINT '-------------------------------------------------------------------------';
PRINT 'Pigmy Module 100% Pure Customer-First Migration Complete!';
PRINT '-------------------------------------------------------------------------';
GO

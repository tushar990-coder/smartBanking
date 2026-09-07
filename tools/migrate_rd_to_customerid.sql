USE [testing];

-- 1. Drop foreign keys referencing RdAccounts or from RdAccounts
DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + 
               N' DROP CONSTRAINT ' + QUOTENAME(name) + N';' + CHAR(13)
FROM sys.foreign_keys
WHERE parent_object_id = OBJECT_ID(N'RdAccounts')
  AND (name LIKE '%Member%' OR name LIKE '%Joint%');

IF @sql <> N'' EXEC sp_executesql @sql;

-- 2. Drop indexes on MemberID / JointMemberID
SET @sql = N'';
SELECT @sql += N'DROP INDEX ' + QUOTENAME(name) + N' ON [RdAccounts];' + CHAR(13)
FROM sys.indexes
WHERE object_id = OBJECT_ID(N'RdAccounts')
  AND (name LIKE '%MemberID%' OR name LIKE '%JointMemberID%');

IF @sql <> N'' EXEC sp_executesql @sql;

-- 3. Modify CustomerID to NOT NULL (table is empty so this is 100% safe)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'RdAccounts') AND name = 'CustomerID')
BEGIN
    ALTER TABLE [RdAccounts] ALTER COLUMN [CustomerID] INT NOT NULL;
END
ELSE
BEGIN
    ALTER TABLE [RdAccounts] ADD [CustomerID] INT NOT NULL;
END

-- 4. Drop MemberID column if exists
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'RdAccounts') AND name = 'MemberID')
BEGIN
    ALTER TABLE [RdAccounts] DROP COLUMN [MemberID];
END

-- 5. Handle JointCustomerID
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'RdAccounts') AND name = 'JointCustomerID')
BEGIN
    ALTER TABLE [RdAccounts] ADD [JointCustomerID] INT NULL;
END

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'RdAccounts') AND name = 'JointMemberID')
BEGIN
    ALTER TABLE [RdAccounts] DROP COLUMN [JointMemberID];
END

-- 6. Add Foreign Key for CustomerID and JointCustomerID
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_RdAccounts_Customers_CustomerID')
BEGIN
    ALTER TABLE [RdAccounts] ADD CONSTRAINT [FK_RdAccounts_Customers_CustomerID] 
    FOREIGN KEY ([CustomerID]) REFERENCES [Customers] ([CustomerID]) ON DELETE NO ACTION;
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_RdAccounts_Customers_JointCustomerID')
BEGIN
    ALTER TABLE [RdAccounts] ADD CONSTRAINT [FK_RdAccounts_Customers_JointCustomerID] 
    FOREIGN KEY ([JointCustomerID]) REFERENCES [Customers] ([CustomerID]) ON DELETE NO ACTION;
END

-- 7. Add Indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RdAccounts_CustomerID' AND object_id = OBJECT_ID(N'RdAccounts'))
BEGIN
    CREATE INDEX [IX_RdAccounts_CustomerID] ON [RdAccounts] ([CustomerID]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RdAccounts_JointCustomerID' AND object_id = OBJECT_ID(N'RdAccounts'))
BEGIN
    CREATE INDEX [IX_RdAccounts_JointCustomerID] ON [RdAccounts] ([JointCustomerID]);
END

PRINT 'RdAccounts schema successfully migrated to CustomerID-First architecture.';

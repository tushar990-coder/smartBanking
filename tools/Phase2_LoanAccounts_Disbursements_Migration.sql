-- ==============================================================================
-- PHASE 2: LOAN ACCOUNTS & DISBURSEMENTS DECOUPLING
-- 1. Drop CoMemberID and CoMember2ID FK constraints and indexes from LoanAccounts
-- 2. Drop CoMemberID and CoMember2ID columns from LoanAccounts
-- 3. Alter MemberID to nullable (INT NULL) in LoanAccounts
-- 4. Ensure index on CustomerID in LoanAccounts
-- ==============================================================================

-- 1. Drop Foreign Key Constraints
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanAccounts_Members_CoMemberID')
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] DROP CONSTRAINT [FK_LoanAccounts_Members_CoMemberID];
    PRINT 'Dropped FK_LoanAccounts_Members_CoMemberID';
END
GO

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanAccounts_Members_CoMember2ID')
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] DROP CONSTRAINT [FK_LoanAccounts_Members_CoMember2ID];
    PRINT 'Dropped FK_LoanAccounts_Members_CoMember2ID';
END
GO

-- 2. Drop Indexes on CoMemberID & CoMember2ID
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanAccounts_CoMemberID' AND object_id = OBJECT_ID('[dbo].[LoanAccounts]'))
BEGIN
    DROP INDEX [IX_LoanAccounts_CoMemberID] ON [dbo].[LoanAccounts];
    PRINT 'Dropped index IX_LoanAccounts_CoMemberID';
END
GO

IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanAccounts_CoMember2ID' AND object_id = OBJECT_ID('[dbo].[LoanAccounts]'))
BEGIN
    DROP INDEX [IX_LoanAccounts_CoMember2ID] ON [dbo].[LoanAccounts];
    PRINT 'Dropped index IX_LoanAccounts_CoMember2ID';
END
GO

-- 3. Drop columns CoMemberID & CoMember2ID
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[LoanAccounts]') AND name = 'CoMemberID')
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] DROP COLUMN [CoMemberID];
    PRINT 'Dropped column [CoMemberID] from [LoanAccounts]';
END
GO

IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[LoanAccounts]') AND name = 'CoMember2ID')
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] DROP COLUMN [CoMember2ID];
    PRINT 'Dropped column [CoMember2ID] from [LoanAccounts]';
END
GO

-- 4. Alter MemberID to INT NULL (Nullable)
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[dbo].[LoanAccounts]') AND name = 'MemberID')
BEGIN
    ALTER TABLE [dbo].[LoanAccounts] ALTER COLUMN [MemberID] INT NULL;
    PRINT 'Altered [LoanAccounts].[MemberID] to INT NULL';
END
GO

-- 5. Ensure index on CustomerID
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanAccounts_CustomerID' AND object_id = OBJECT_ID('[dbo].[LoanAccounts]'))
BEGIN
    CREATE INDEX [IX_LoanAccounts_CustomerID] ON [dbo].[LoanAccounts] ([CustomerID]);
    PRINT 'Created index IX_LoanAccounts_CustomerID';
END
GO

PRINT 'Phase 2: LoanAccounts migration completed successfully.';

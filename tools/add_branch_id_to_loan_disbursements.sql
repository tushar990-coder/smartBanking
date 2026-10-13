-- ==============================================================================
-- Script: add_branch_id_to_loan_disbursements.sql
-- Description: Add BranchID to LoanDisbursements table and backfill from LoanAccounts
-- ==============================================================================

IF COL_LENGTH('LoanDisbursements', 'BranchID') IS NULL
BEGIN
    PRINT 'Adding BranchID column to LoanDisbursements...';
    ALTER TABLE [dbo].[LoanDisbursements] ADD [BranchID] int NOT NULL CONSTRAINT [DF_LoanDisbursements_BranchID] DEFAULT 1;

    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanDisbursements_Branches_BranchID')
    BEGIN
        PRINT 'Adding foreign key FK_LoanDisbursements_Branches_BranchID...';
        ALTER TABLE [dbo].[LoanDisbursements] ADD CONSTRAINT [FK_LoanDisbursements_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches] ([BranchID]);
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanDisbursements_BranchID' AND object_id = OBJECT_ID('LoanDisbursements'))
    BEGIN
        PRINT 'Creating index IX_LoanDisbursements_BranchID...';
        CREATE INDEX [IX_LoanDisbursements_BranchID] ON [dbo].[LoanDisbursements] ([BranchID]);
    END
    PRINT 'BranchID added successfully.';
END
ELSE
BEGIN
    PRINT 'BranchID already exists in LoanDisbursements.';
END
GO

-- Backfill legacy records from LoanAccounts
PRINT 'Backfilling BranchID from LoanAccounts...';
UPDATE ld
SET ld.BranchID = ISNULL(la.BranchID, 1)
FROM [dbo].[LoanDisbursements] ld
INNER JOIN [dbo].[LoanAccounts] la ON ld.LoanAccountID = la.LoanAccountID
WHERE ld.BranchID = 1 AND la.BranchID IS NOT NULL AND la.BranchID <> 1;

PRINT 'Backfill completed.';
GO

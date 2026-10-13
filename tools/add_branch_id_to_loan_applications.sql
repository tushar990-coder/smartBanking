-- Migration: Add BranchID to LoanApplications for Multi-Branch Architecture
-- Date: 2026-10-12

IF COL_LENGTH('LoanApplications', 'BranchID') IS NULL
BEGIN
    PRINT 'Adding BranchID to LoanApplications table...';
    ALTER TABLE [dbo].[LoanApplications] ADD [BranchID] int NOT NULL CONSTRAINT [DF_LoanApplications_BranchID] DEFAULT 1;
    
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanApplications_Branches_BranchID')
    BEGIN
        ALTER TABLE [dbo].[LoanApplications] ADD CONSTRAINT [FK_LoanApplications_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches] ([BranchID]);
    END
    
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanApplications_BranchID' AND object_id = OBJECT_ID('LoanApplications'))
    BEGIN
        CREATE INDEX [IX_LoanApplications_BranchID] ON [dbo].[LoanApplications] ([BranchID]);
    END
    PRINT 'BranchID successfully added to LoanApplications.';
END
ELSE
BEGIN
    PRINT 'BranchID already exists on LoanApplications.';
END
GO

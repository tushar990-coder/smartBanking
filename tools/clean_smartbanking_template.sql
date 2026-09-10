-- =========================================================================
-- SmartBanking_Template - Master Template DB Clean & Reset Script
-- Cleans all transactional, account, customer, member, audit, and voucher data.
-- Preserves: Schemes, Account Groups, Ledgers, Sanstha Profile, Branch, Users,
--            Roles, Financial Year, Bank Masters, and Core Settings.
-- Reseeds all cleared identity tables to start from 1.
-- Resets CifSequences to CurrentValue = 0 (next CIF = CIF000001).
-- 100% Strict Pure Customer-First (CIF-First) Architecture.
-- =========================================================================

USE [SmartBanking_Template];
GO

SET NOCOUNT ON;
PRINT 'Beginning SmartBanking_Template database reset...';

-- 1. Disable all foreign key constraints and triggers
PRINT 'Disabling foreign keys and triggers...';
EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL";
EXEC sp_MSforeachtable "ALTER TABLE ? DISABLE TRIGGER ALL";
GO

-- 2. Clear transactional & accounting records
PRINT 'Clearing vouchers, ledger mappings and audit logs...';
DELETE FROM [VoucherDetails];
DELETE FROM [Vouchers];
DELETE FROM [VoucherMappings];
DELETE FROM [AuditLogs];
DELETE FROM [UserLoginAudits];
DELETE FROM [SystemNotifications];
DELETE FROM [BranchDayEndStatuses];
DELETE FROM [EodBatchProcessLogs];
GO

-- 3. Clear Saving Accounts & Transactions
PRINT 'Clearing Saving module...';
DELETE FROM [SavingTransactions];
DELETE FROM [SavingAccountJointHolders];
DELETE FROM [SavingAccountClosings];
DELETE FROM [SavingPassbooks];
DELETE FROM [SavingInterestPostings];
DELETE FROM [SavingVoucherMappings];
DELETE FROM [SavingAccountMasters];
GO

-- 4. Clear Fixed Deposits (FD)
PRINT 'Clearing FD module...';
DELETE FROM [FdTransactions];
DELETE FROM [FdInterestAccruals];
DELETE FROM [FdAccounts];
DELETE FROM [FdAccountSequences];
GO

-- 5. Clear Recurring Deposits (RD)
PRINT 'Clearing RD module...';
DELETE FROM [RdTransactions];
DELETE FROM [RdInterestAccruals];
DELETE FROM [RdAccounts];
DELETE FROM [RdAccountSequences];
GO

-- 6. Clear Pigmy / Daily Collection
PRINT 'Clearing Pigmy module...';
DELETE FROM [PigmyTransactions];
DELETE FROM [PigmyCollections];
DELETE FROM [PigmyAgentCashDeposits];
DELETE FROM [PigmyAgentCommissions];
DELETE FROM [PigmyOpeningBalances];
DELETE FROM [PigmyInterestLogs];
DELETE FROM [PigmyVoucherMappings];
DELETE FROM [PigmyAgents];
DELETE FROM [PigmyAccounts];
DELETE FROM [PigmyAccountSequences];
GO

-- 7. Clear Loans Module
PRINT 'Clearing Loans module...';
DELETE FROM [LoanInstallmentSchedules];
DELETE FROM [LoanDisbursementDeductions];
DELETE FROM [LoanDisbursements];
DELETE FROM [LoanCollections];
DELETE FROM [LoanCollectionFees];
DELETE FROM [LoanDocuments];
DELETE FROM [LoanAccountNpaStatuses];
DELETE FROM [BorrowerLinkedAccounts];
DELETE FROM [GoldLoanDetails];
DELETE FROM [Sec101CaseMasters];
DELETE FROM [Sec101HearingLogs];
DELETE FROM [Sec101NoticeHistories];
DELETE FROM [Sec101LegalExpenses];
DELETE FROM [Sec101AttachmentAuctions];
DELETE FROM [DemandNotices];
DELETE FROM [DemandMemberDetails];
DELETE FROM [DemandRecoveries];
DELETE FROM [NpaClassificationRuns];
DELETE FROM [CollateralComplianceLogs];
DELETE FROM [LoanAccounts];
DELETE FROM [LoanApplications];
GO

-- 8. Clear Shares & Members
PRINT 'Clearing Shares & Members...';
DELETE FROM [ShareTransactions];
DELETE FROM [ShareCertificatePrintHistories];
DELETE FROM [ShareCertificates];
DELETE FROM [ShareAccounts];
DELETE FROM [DividendDistributions];
DELETE FROM [DeceasedClaimSettlements];
DELETE FROM [JointMembers];
DELETE FROM [MemberOpeningBalances];
DELETE FROM [Members];
GO

-- 9. Clear Customers & Imports
PRINT 'Clearing Customers & CIFs...';
DELETE FROM [CustomerOpeningBalances];
DELETE FROM [CustomerImportBatches];
DELETE FROM [AgentCustomerRequests];
DELETE FROM [Customers];
GO

-- 10. Clear Investments (if any)
PRINT 'Clearing Investments module...';
IF OBJECT_ID(N'InvestmentInterestAccruals', N'U') IS NOT NULL DELETE FROM [InvestmentInterestAccruals];
IF OBJECT_ID(N'InvestmentInterestReceipts', N'U') IS NOT NULL DELETE FROM [InvestmentInterestReceipts];
IF OBJECT_ID(N'InvestmentMaturities', N'U') IS NOT NULL DELETE FROM [InvestmentMaturities];
IF OBJECT_ID(N'InvestmentPrematureWithdrawals', N'U') IS NOT NULL DELETE FROM [InvestmentPrematureWithdrawals];
IF OBJECT_ID(N'InvestmentRenewals', N'U') IS NOT NULL DELETE FROM [InvestmentRenewals];
IF OBJECT_ID(N'InvestmentVoucherMappings', N'U') IS NOT NULL DELETE FROM [InvestmentVoucherMappings];
IF OBJECT_ID(N'InvestmentAccounts', N'U') IS NOT NULL DELETE FROM [InvestmentAccounts];
IF OBJECT_ID(N'InvestmentAccountSequences', N'U') IS NOT NULL DELETE FROM [InvestmentAccountSequences];
GO

-- 11. Clear Lockers & Assets (if any)
PRINT 'Clearing Lockers & Assets...';
IF OBJECT_ID(N'LockerRentPostings', N'U') IS NOT NULL DELETE FROM [LockerRentPostings];
IF OBJECT_ID(N'LockerVisitRegisters', N'U') IS NOT NULL DELETE FROM [LockerVisitRegisters];
IF OBJECT_ID(N'LockerSurrenders', N'U') IS NOT NULL DELETE FROM [LockerSurrenders];
IF OBJECT_ID(N'LockerAllotments', N'U') IS NOT NULL DELETE FROM [LockerAllotments];
IF OBJECT_ID(N'Lockers', N'U') IS NOT NULL DELETE FROM [Lockers];

IF OBJECT_ID(N'AssetPurchases', N'U') IS NOT NULL DELETE FROM [AssetPurchases];
IF OBJECT_ID(N'AssetAllocations', N'U') IS NOT NULL DELETE FROM [AssetAllocations];
IF OBJECT_ID(N'AssetDepreciations', N'U') IS NOT NULL DELETE FROM [AssetDepreciations];
IF OBJECT_ID(N'AssetDisposals', N'U') IS NOT NULL DELETE FROM [AssetDisposals];
IF OBJECT_ID(N'AssetMaintenances', N'U') IS NOT NULL DELETE FROM [AssetMaintenances];
IF OBJECT_ID(N'AssetTransfers', N'U') IS NOT NULL DELETE FROM [AssetTransfers];
IF OBJECT_ID(N'AssetVerifications', N'U') IS NOT NULL DELETE FROM [AssetVerifications];
IF OBJECT_ID(N'Assets', N'U') IS NOT NULL DELETE FROM [Assets];
IF OBJECT_ID(N'EmployeeBankDetails', N'U') IS NOT NULL DELETE FROM [EmployeeBankDetails];
GO

-- 12. Clear Cash Management balances & logs (preserve Cashier masters)
PRINT 'Resetting Cashier balances...';
DELETE FROM [CashAllocations];
DELETE FROM [CashDenominations];
DELETE FROM [CashierBalances];
GO

-- 13. Reset Sequence tables so new records start strictly at 1
PRINT 'Resetting all sequence tables to 0...';
UPDATE [CifSequences] SET [CurrentValue] = 0, [LastUpdated] = GETDATE();
GO

-- 14. Reseed all identity columns for empty tables to 0 (so next insert starts at 1)
PRINT 'Reseeding identity columns to 0 for all empty tables...';
DECLARE @reseedSql NVARCHAR(MAX) = N'';

SELECT @reseedSql += N'
IF OBJECT_ID(''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''', ''U'') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ')
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''') AND last_value IS NOT NULL)
        BEGIN
            DBCC CHECKIDENT (''' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ''', RESEED, 0) WITH NO_INFOMSGS;
        END
    END
END;'
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.identity_columns c ON t.object_id = c.object_id
WHERE t.is_ms_shipped = 0;

EXEC sp_executesql @reseedSql;
GO

-- 15. Re-enable all triggers
PRINT 'Re-enabling triggers...';
EXEC sp_MSforeachtable "ALTER TABLE ? ENABLE TRIGGER ALL";
GO

-- 16. Re-enable and check all foreign keys
PRINT 'Re-enabling and validating foreign keys...';
EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL";
GO

PRINT '=========================================================================';
PRINT '  SmartBanking_Template CLEANUP COMPLETED SUCCESSFULLY!                 ';
PRINT '=========================================================================';
GO

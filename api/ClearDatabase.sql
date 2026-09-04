SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
EXEC sp_MSForEachTable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';

-- Vouchers
DELETE FROM VoucherDetails;
DELETE FROM Vouchers;

-- Loans
DELETE FROM LoanCollectionFees;
DELETE FROM LoanCollections;
DELETE FROM LoanInstallmentSchedules;
DELETE FROM LoanDisbursementDeductions;
DELETE FROM LoanDisbursements;
DELETE FROM CollateralComplianceLogs;
DELETE FROM LoanAccountNpaStatuses;
DELETE FROM NpaClassificationRuns;
DELETE FROM OverdueInterestLedgers;
DELETE FROM OverdueRecoveryLedgers;
DELETE FROM BorrowerLinkedAccounts;
DELETE FROM LoanDocuments;
DELETE FROM LoanAccounts;
DELETE FROM LoanApplications;
DELETE FROM GoldLoanDetails;

-- Savings
DELETE FROM SavingTransactions;
DELETE FROM SavingPassbooks;
DELETE FROM SavingInterestPostings;
DELETE FROM SavingAccountClosings;
DELETE FROM SavingAccountJointHolders;
DELETE FROM SavingAccountMasters;

-- Pigmy
DELETE FROM PigmyCollections;
DELETE FROM PigmyTransactions;
DELETE FROM PigmyInterestLogs;
DELETE FROM PigmyOpeningBalances;
DELETE FROM PigmyAgentCashDeposits;
DELETE FROM PigmyAgentCommissions;
DELETE FROM PigmyAccounts;
DELETE FROM PigmyAgents;

-- FD
DELETE FROM FdInterestAccruals;
DELETE FROM FdTransactions;
DELETE FROM FdAccounts;

-- RD
DELETE FROM RdInterestAccruals;
DELETE FROM RdTransactions;
DELETE FROM RdAccounts;

-- Investment
DELETE FROM InvestmentInterestAccruals;
DELETE FROM InvestmentInterestReceipts;
DELETE FROM InvestmentMaturities;
DELETE FROM InvestmentRenewals;
DELETE FROM InvestmentPrematureWithdrawals;
DELETE FROM InvestmentAccounts;

-- Asset
DELETE FROM AssetAllocations;
DELETE FROM AssetDepreciations;
DELETE FROM AssetDisposals;
DELETE FROM AssetMaintenances;
DELETE FROM AssetPurchases;
DELETE FROM AssetTransfers;
DELETE FROM AssetVerifications;
DELETE FROM Assets;

-- Share
DELETE FROM ShareCertificatePrintHistories;
DELETE FROM DividendDistributions;
DELETE FROM ShareTransactions;
DELETE FROM ShareCertificates;
DELETE FROM ShareAccounts;

-- Members
DELETE FROM MemberOpeningBalances;
DELETE FROM Members;

-- Reseed Identities
EXEC sp_MSForEachTable '
IF OBJECT_ID(''?'') NOT IN (OBJECT_ID(''[dbo].[Users]''), OBJECT_ID(''[dbo].[Roles]''), OBJECT_ID(''[dbo].[AccountGroups]''), OBJECT_ID(''[dbo].[Ledgers]''), OBJECT_ID(''[dbo].[Branches]''), OBJECT_ID(''[dbo].[FinancialYears]''), OBJECT_ID(''[dbo].[SansthaDetails]''), OBJECT_ID(''[dbo].[NpaConfigs]''), OBJECT_ID(''[dbo].[NpaProvisionSlabs]''), OBJECT_ID(''[dbo].[__EFMigrationsHistory]''))
BEGIN
    IF IDENT_SEED(SUBSTRING(''?'', 8, LEN(''?'')-8)) IS NOT NULL
        DBCC CHECKIDENT (''?'', RESEED, 0);
END
';

EXEC sp_MSForEachTable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';

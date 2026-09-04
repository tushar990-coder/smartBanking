-- =========================================================================================
-- SmartBanking ERP - Master Database Clean & Reset Script (Keep Masters & Login)
-- =========================================================================================
-- PRESERVED DATA:
--   1. Login & Auth: Users, Roles, RolePermissions, Permissions
--   2. Setup: Branches, SansthaDetails, FinancialYears
--   3. Chart of Accounts: AccountGroups (खाते गट), Ledgers (खाते माहिती) -> Balances Reset to 0
--   4. Product Configurations & Schemes: Schemes, Rates, Settings, Mappings
--
-- CLEARED DATA:
--   All Customers, Members, Accounts (Saving, Loan, FD, RD, Pigmy, Shares, Lockers, Assets, etc.),
--   All Transactions, Vouchers, Collections, Logs, Opening Balances, and Operational Records.
--   All Identity Counters & Sequences Reset to 0 (Fresh Start).
-- =========================================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;

PRINT '------------------------------------------------------------------';
PRINT '  SmartBanking ERP - Database Clean & Fresh Start Resetting...    ';
PRINT '------------------------------------------------------------------';

BEGIN TRY
    BEGIN TRANSACTION;

    -- 1. Disable all Foreign Key constraints temporarily
    PRINT ' [1/5] Disabling all foreign key constraints...';
    EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";

    -- 2. Clear all Transaction, Account, Customer and Operational Tables safely
    PRINT ' [2/5] Wiping transactional and operational records...';

    -- Vouchers & Financial Transactions
    IF OBJECT_ID('dbo.VoucherDetails', 'U') IS NOT NULL DELETE FROM dbo.VoucherDetails;
    IF OBJECT_ID('dbo.Vouchers', 'U') IS NOT NULL DELETE FROM dbo.Vouchers;

    -- Saving Accounts & Transactions
    IF OBJECT_ID('dbo.SavingTransactions', 'U') IS NOT NULL DELETE FROM dbo.SavingTransactions;
    IF OBJECT_ID('dbo.SavingInterestPostings', 'U') IS NOT NULL DELETE FROM dbo.SavingInterestPostings;
    IF OBJECT_ID('dbo.SavingAccountClosings', 'U') IS NOT NULL DELETE FROM dbo.SavingAccountClosings;
    IF OBJECT_ID('dbo.SavingPassbooks', 'U') IS NOT NULL DELETE FROM dbo.SavingPassbooks;
    IF OBJECT_ID('dbo.SavingAccountJointHolders', 'U') IS NOT NULL DELETE FROM dbo.SavingAccountJointHolders;
    IF OBJECT_ID('dbo.SavingAccountMasters', 'U') IS NOT NULL DELETE FROM dbo.SavingAccountMasters;

    -- Loan Accounts, Disbursements, Collections & Schedules
    IF OBJECT_ID('dbo.OverdueInterestLedgers', 'U') IS NOT NULL DELETE FROM dbo.OverdueInterestLedgers;
    IF OBJECT_ID('dbo.LoanCollectionFees', 'U') IS NOT NULL DELETE FROM dbo.LoanCollectionFees;
    IF OBJECT_ID('dbo.LoanCollections', 'U') IS NOT NULL DELETE FROM dbo.LoanCollections;
    IF OBJECT_ID('dbo.LoanDisbursementDeductions', 'U') IS NOT NULL DELETE FROM dbo.LoanDisbursementDeductions;
    IF OBJECT_ID('dbo.LoanDisbursements', 'U') IS NOT NULL DELETE FROM dbo.LoanDisbursements;
    IF OBJECT_ID('dbo.LoanInstallmentSchedules', 'U') IS NOT NULL DELETE FROM dbo.LoanInstallmentSchedules;
    IF OBJECT_ID('dbo.GoldLoanDetails', 'U') IS NOT NULL DELETE FROM dbo.GoldLoanDetails;
    IF OBJECT_ID('dbo.LoanDocuments', 'U') IS NOT NULL DELETE FROM dbo.LoanDocuments;
    IF OBJECT_ID('dbo.LoanApplications', 'U') IS NOT NULL DELETE FROM dbo.LoanApplications;
    IF OBJECT_ID('dbo.LoanAccountNpaStatuses', 'U') IS NOT NULL DELETE FROM dbo.LoanAccountNpaStatuses;
    IF OBJECT_ID('dbo.BorrowerLinkedAccounts', 'U') IS NOT NULL DELETE FROM dbo.BorrowerLinkedAccounts;
    IF OBJECT_ID('dbo.CollateralComplianceLogs', 'U') IS NOT NULL DELETE FROM dbo.CollateralComplianceLogs;
    IF OBJECT_ID('dbo.LoanAccounts', 'U') IS NOT NULL DELETE FROM dbo.LoanAccounts;

    -- Fixed Deposits (FD)
    IF OBJECT_ID('dbo.FdTransactions', 'U') IS NOT NULL DELETE FROM dbo.FdTransactions;
    IF OBJECT_ID('dbo.FdInterestAccruals', 'U') IS NOT NULL DELETE FROM dbo.FdInterestAccruals;
    IF OBJECT_ID('dbo.FdAccounts', 'U') IS NOT NULL DELETE FROM dbo.FdAccounts;
    IF OBJECT_ID('dbo.FdAccountSequences', 'U') IS NOT NULL DELETE FROM dbo.FdAccountSequences;

    -- Recurring Deposits (RD)
    IF OBJECT_ID('dbo.RdTransactions', 'U') IS NOT NULL DELETE FROM dbo.RdTransactions;
    IF OBJECT_ID('dbo.RdInterestAccruals', 'U') IS NOT NULL DELETE FROM dbo.RdInterestAccruals;
    IF OBJECT_ID('dbo.RdAccounts', 'U') IS NOT NULL DELETE FROM dbo.RdAccounts;
    IF OBJECT_ID('dbo.RdAccountSequences', 'U') IS NOT NULL DELETE FROM dbo.RdAccountSequences;

    -- Pigmy Daily Deposits
    IF OBJECT_ID('dbo.PigmyCollections', 'U') IS NOT NULL DELETE FROM dbo.PigmyCollections;
    IF OBJECT_ID('dbo.PigmyTransactions', 'U') IS NOT NULL DELETE FROM dbo.PigmyTransactions;
    IF OBJECT_ID('dbo.PigmyOpeningBalances', 'U') IS NOT NULL DELETE FROM dbo.PigmyOpeningBalances;
    IF OBJECT_ID('dbo.PigmyInterestLogs', 'U') IS NOT NULL DELETE FROM dbo.PigmyInterestLogs;
    IF OBJECT_ID('dbo.PigmyAgentCashDeposits', 'U') IS NOT NULL DELETE FROM dbo.PigmyAgentCashDeposits;
    IF OBJECT_ID('dbo.PigmyAgentCommissions', 'U') IS NOT NULL DELETE FROM dbo.PigmyAgentCommissions;
    IF OBJECT_ID('dbo.PigmyAccounts', 'U') IS NOT NULL DELETE FROM dbo.PigmyAccounts;
    IF OBJECT_ID('dbo.PigmyAccountSequences', 'U') IS NOT NULL DELETE FROM dbo.PigmyAccountSequences;
    IF OBJECT_ID('dbo.PigmyAgents', 'U') IS NOT NULL DELETE FROM dbo.PigmyAgents;
    IF OBJECT_ID('dbo.AgentCustomerRequests', 'U') IS NOT NULL DELETE FROM dbo.AgentCustomerRequests;

    -- Shares & Dividends
    IF OBJECT_ID('dbo.ShareTransactions', 'U') IS NOT NULL DELETE FROM dbo.ShareTransactions;
    IF OBJECT_ID('dbo.ShareCertificates', 'U') IS NOT NULL DELETE FROM dbo.ShareCertificates;
    IF OBJECT_ID('dbo.ShareCertificatePrintHistories', 'U') IS NOT NULL DELETE FROM dbo.ShareCertificatePrintHistories;
    IF OBJECT_ID('dbo.DividendDistributions', 'U') IS NOT NULL DELETE FROM dbo.DividendDistributions;
    IF OBJECT_ID('dbo.ShareAccounts', 'U') IS NOT NULL DELETE FROM dbo.ShareAccounts;

    -- Investments
    IF OBJECT_ID('dbo.InvestmentInterestAccruals', 'U') IS NOT NULL DELETE FROM dbo.InvestmentInterestAccruals;
    IF OBJECT_ID('dbo.InvestmentInterestReceipts', 'U') IS NOT NULL DELETE FROM dbo.InvestmentInterestReceipts;
    IF OBJECT_ID('dbo.InvestmentMaturities', 'U') IS NOT NULL DELETE FROM dbo.InvestmentMaturities;
    IF OBJECT_ID('dbo.InvestmentRenewals', 'U') IS NOT NULL DELETE FROM dbo.InvestmentRenewals;
    IF OBJECT_ID('dbo.InvestmentPrematureWithdrawals', 'U') IS NOT NULL DELETE FROM dbo.InvestmentPrematureWithdrawals;
    IF OBJECT_ID('dbo.InvestmentAccounts', 'U') IS NOT NULL DELETE FROM dbo.InvestmentAccounts;
    IF OBJECT_ID('dbo.InvestmentAccountSequences', 'U') IS NOT NULL DELETE FROM dbo.InvestmentAccountSequences;

    -- Lockers
    IF OBJECT_ID('dbo.LockerVisitRegisters', 'U') IS NOT NULL DELETE FROM dbo.LockerVisitRegisters;
    IF OBJECT_ID('dbo.LockerRentPostings', 'U') IS NOT NULL DELETE FROM dbo.LockerRentPostings;
    IF OBJECT_ID('dbo.LockerSurrenders', 'U') IS NOT NULL DELETE FROM dbo.LockerSurrenders;
    IF OBJECT_ID('dbo.LockerAllotments', 'U') IS NOT NULL DELETE FROM dbo.LockerAllotments;
    IF OBJECT_ID('dbo.Lockers', 'U') IS NOT NULL 
    BEGIN
        UPDATE dbo.Lockers SET Status = 'Available';
    END

    -- Legal Recovery (Sec 101) & Demand Notices
    IF OBJECT_ID('dbo.Sec101NoticeHistories', 'U') IS NOT NULL DELETE FROM dbo.Sec101NoticeHistories;
    IF OBJECT_ID('dbo.Sec101HearingLogs', 'U') IS NOT NULL DELETE FROM dbo.Sec101HearingLogs;
    IF OBJECT_ID('dbo.Sec101AttachmentAuctions', 'U') IS NOT NULL DELETE FROM dbo.Sec101AttachmentAuctions;
    IF OBJECT_ID('dbo.Sec101LegalExpenses', 'U') IS NOT NULL DELETE FROM dbo.Sec101LegalExpenses;
    IF OBJECT_ID('dbo.Sec101CaseMasters', 'U') IS NOT NULL DELETE FROM dbo.Sec101CaseMasters;
    IF OBJECT_ID('dbo.DemandMemberDetails', 'U') IS NOT NULL DELETE FROM dbo.DemandMemberDetails;
    IF OBJECT_ID('dbo.DemandRecoveries', 'U') IS NOT NULL DELETE FROM dbo.DemandRecoveries;
    IF OBJECT_ID('dbo.DemandNotices', 'U') IS NOT NULL DELETE FROM dbo.DemandNotices;

    -- Asset Management
    IF OBJECT_ID('dbo.AssetPurchases', 'U') IS NOT NULL DELETE FROM dbo.AssetPurchases;
    IF OBJECT_ID('dbo.AssetAllocations', 'U') IS NOT NULL DELETE FROM dbo.AssetAllocations;
    IF OBJECT_ID('dbo.AssetTransfers', 'U') IS NOT NULL DELETE FROM dbo.AssetTransfers;
    IF OBJECT_ID('dbo.AssetMaintenances', 'U') IS NOT NULL DELETE FROM dbo.AssetMaintenances;
    IF OBJECT_ID('dbo.AssetDepreciations', 'U') IS NOT NULL DELETE FROM dbo.AssetDepreciations;
    IF OBJECT_ID('dbo.AssetVerifications', 'U') IS NOT NULL DELETE FROM dbo.AssetVerifications;
    IF OBJECT_ID('dbo.AssetDisposals', 'U') IS NOT NULL DELETE FROM dbo.AssetDisposals;
    IF OBJECT_ID('dbo.Assets', 'U') IS NOT NULL DELETE FROM dbo.Assets;

    -- Cash Operations
    IF OBJECT_ID('dbo.CashAllocations', 'U') IS NOT NULL DELETE FROM dbo.CashAllocations;
    IF OBJECT_ID('dbo.CashDenominations', 'U') IS NOT NULL DELETE FROM dbo.CashDenominations;
    IF OBJECT_ID('dbo.CashierBalances', 'U') IS NOT NULL DELETE FROM dbo.CashierBalances;
    IF OBJECT_ID('dbo.Cashiers', 'U') IS NOT NULL DELETE FROM dbo.Cashiers;

    -- Opening Balances, Customers & Members
    IF OBJECT_ID('dbo.CustomerOpeningBalances', 'U') IS NOT NULL DELETE FROM dbo.CustomerOpeningBalances;
    IF OBJECT_ID('dbo.MemberOpeningBalances', 'U') IS NOT NULL DELETE FROM dbo.MemberOpeningBalances;
    IF OBJECT_ID('dbo.DeceasedClaimSettlements', 'U') IS NOT NULL DELETE FROM dbo.DeceasedClaimSettlements;
    IF OBJECT_ID('dbo.JointMembers', 'U') IS NOT NULL DELETE FROM dbo.JointMembers;
    IF OBJECT_ID('dbo.CommitteeMembers', 'U') IS NOT NULL DELETE FROM dbo.CommitteeMembers;
    IF OBJECT_ID('dbo.EmployeeBankDetails', 'U') IS NOT NULL DELETE FROM dbo.EmployeeBankDetails;
    IF OBJECT_ID('dbo.EmployerMasters', 'U') IS NOT NULL DELETE FROM dbo.EmployerMasters;
    IF OBJECT_ID('dbo.Members', 'U') IS NOT NULL DELETE FROM dbo.Members;
    IF OBJECT_ID('dbo.Customers', 'U') IS NOT NULL DELETE FROM dbo.Customers;

    -- Operational Logs & Audits
    IF OBJECT_ID('dbo.BranchDayEndStatuses', 'U') IS NOT NULL DELETE FROM dbo.BranchDayEndStatuses;
    IF OBJECT_ID('dbo.EodBatchProcessLogs', 'U') IS NOT NULL DELETE FROM dbo.EodBatchProcessLogs;
    IF OBJECT_ID('dbo.NpaClassificationRuns', 'U') IS NOT NULL DELETE FROM dbo.NpaClassificationRuns;
    IF OBJECT_ID('dbo.BorrowerLinkedAccounts', 'U') IS NOT NULL DELETE FROM dbo.BorrowerLinkedAccounts;
    IF OBJECT_ID('dbo.CollateralComplianceLogs', 'U') IS NOT NULL DELETE FROM dbo.CollateralComplianceLogs;
    IF OBJECT_ID('dbo.UserLoginAudits', 'U') IS NOT NULL DELETE FROM dbo.UserLoginAudits;
    IF OBJECT_ID('dbo.AuditLogs', 'U') IS NOT NULL DELETE FROM dbo.AuditLogs;
    IF OBJECT_ID('dbo.SystemNotifications', 'U') IS NOT NULL DELETE FROM dbo.SystemNotifications;

    -- 3. Reset Ledger Balances (Keeping Account Groups and Ledgers Intact)
    PRINT ' [3/5] Resetting Ledger opening balances to 0.00...';
    IF OBJECT_ID('dbo.Ledgers', 'U') IS NOT NULL
    BEGIN
        UPDATE dbo.Ledgers
        SET OpeningBalance = 0.00,
            OpeningBalanceType = 'Dr';
    END

    -- 4. Reset Identity Counters (Reseed to 0 for fresh sequence allotment)
    PRINT ' [4/5] Resetting table identity seeds to 0...';
    DECLARE @tableList TABLE (TableName NVARCHAR(128));
    INSERT INTO @tableList VALUES 
        ('Customers'), ('Members'), ('SavingAccountMasters'), ('SavingTransactions'),
        ('LoanAccounts'), ('LoanApplications'), ('LoanDisbursements'), ('LoanCollections'),
        ('FdAccounts'), ('FdTransactions'), ('RdAccounts'), ('RdTransactions'),
        ('PigmyAccounts'), ('PigmyTransactions'), ('PigmyCollections'), ('PigmyAgents'),
        ('ShareAccounts'), ('ShareTransactions'), ('InvestmentAccounts'),
        ('LockerAllotments'), ('Assets'), ('Vouchers'), ('VoucherDetails'),
        ('CustomerOpeningBalances'), ('MemberOpeningBalances'), ('Sec101CaseMasters'),
        ('DemandNotices'), ('AuditLogs'), ('UserLoginAudits');

    DECLARE @tName NVARCHAR(128);
    DECLARE table_cursor CURSOR FOR SELECT TableName FROM @tableList;
    OPEN table_cursor;
    FETCH NEXT FROM table_cursor INTO @tName;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF OBJECT_ID('dbo.' + @tName, 'U') IS NOT NULL AND OBJECTPROPERTY(OBJECT_ID('dbo.' + @tName), 'TableHasIdentity') = 1
        BEGIN
            BEGIN TRY
                EXEC('DBCC CHECKIDENT (''dbo.' + @tName + ''', RESEED, 0)');
            END TRY
            BEGIN CATCH
                -- Ignore if table is empty or has issues reseeding
            END CATCH
        END
        FETCH NEXT FROM table_cursor INTO @tName;
    END
    CLOSE table_cursor;
    DEALLOCATE table_cursor;

    -- 5. Re-enable all Foreign Key constraints
    PRINT ' [5/5] Re-enabling all foreign key constraints...';
    EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";

    COMMIT TRANSACTION;
    PRINT '------------------------------------------------------------------';
    PRINT ' [SUCCESS] Database cleared & reset successfully! Ready for Fresh Data.';
    PRINT '------------------------------------------------------------------';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    DECLARE @errMsg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT ' [ERROR] Database reset failed: ' + @errMsg;
    RAISERROR(@errMsg, 16, 1);
END CATCH;

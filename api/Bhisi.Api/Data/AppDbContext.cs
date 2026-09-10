using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Models;

namespace Bhisi.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<FinancialYear> FinancialYears { get; set; }
        public DbSet<Branch> Branches { get; set; }

        // Authentication & Security
        public DbSet<Role> Roles { get; set; }
        public DbSet<RolePermission> RolePermissions { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<UserLoginAudit> UserLoginAudits { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }
        public DbSet<SystemNotification> SystemNotifications { get; set; }
        public DbSet<BranchDayEndStatus> BranchDayEndStatuses { get; set; }
        public DbSet<EodBatchProcessLog> EodBatchProcessLogs { get; set; }
        public DbSet<SystemVersionHistory> SystemVersionHistories { get; set; }

        public DbSet<AccountGroup> AccountGroups { get; set; }
        public DbSet<Ledger> Ledgers { get; set; }
        public DbSet<Customer> Customers { get; set; }
        public DbSet<CifSequence> CifSequences { get; set; }
        public DbSet<CustomerImportBatch> CustomerImportBatches { get; set; }
        public DbSet<Member> Members { get; set; }
        public DbSet<EmployerMaster> EmployerMasters { get; set; }
        public DbSet<CommitteeMember> CommitteeMembers { get; set; }
        public DbSet<AuditLedgerMapping> AuditLedgerMappings { get; set; }
        public DbSet<Voucher> Vouchers { get; set; }
        public DbSet<VoucherDetail> VoucherDetails { get; set; }
        public DbSet<SansthaDetail> SansthaDetails { get; set; }
        public DbSet<VoucherMapping> VoucherMappings { get; set; }
        public DbSet<CustomerOpeningBalance> CustomerOpeningBalances { get; set; }
        public DbSet<MemberOpeningBalance> MemberOpeningBalances { get; set; }
        public DbSet<LoanRate> LoanRates { get; set; }
        public DbSet<LoanApplication> LoanApplications { get; set; }
        public DbSet<LoanAccount> LoanAccounts { get; set; }
        public DbSet<LoanDisbursement> LoanDisbursements { get; set; }
        public DbSet<LoanDisbursementDeduction> LoanDisbursementDeductions { get; set; }
        public DbSet<LoanCollection> LoanCollections { get; set; }
        public DbSet<LoanCollectionFee> LoanCollectionFees { get; set; }
        public DbSet<LoanInstallmentSchedule> LoanInstallmentSchedules { get; set; }
        public DbSet<GoldLoanDetail> GoldLoanDetails { get; set; }
        public DbSet<LoanDocument> LoanDocuments { get; set; }
        public DbSet<SecurityType> SecurityTypes { get; set; }

        public DbSet<SavingAccountMaster> SavingAccountMasters { get; set; }
        public DbSet<SavingTransaction> SavingTransactions { get; set; }
        public DbSet<SavingInterestSetting> SavingInterestSettings { get; set; }
        public DbSet<SavingInterestPosting> SavingInterestPostings { get; set; }
        public DbSet<SavingAccountClosing> SavingAccountClosings { get; set; }
        public DbSet<SavingPassbook> SavingPassbooks { get; set; }
        public DbSet<SavingVoucherMapping> SavingVoucherMappings { get; set; }
        public DbSet<SavingAccountJointHolder> SavingAccountJointHolders { get; set; }
        public DbSet<JointMember> JointMembers { get; set; }
        public DbSet<DeceasedClaimSettlement> DeceasedClaimSettlements { get; set; }

        // Fixed Deposit Module DbSets
        public DbSet<FdScheme> FdSchemes { get; set; }
        public DbSet<FdAccount> FdAccounts { get; set; }
        public DbSet<FdTransaction> FdTransactions { get; set; }
        public DbSet<FdInterestAccrual> FdInterestAccruals { get; set; }
        public DbSet<FdAccountSequence> FdAccountSequences { get; set; }

        // Recurring Deposit Module DbSets
        public DbSet<RdScheme> RdSchemes { get; set; }
        public DbSet<RdAccount> RdAccounts { get; set; }
        public DbSet<RdTransaction> RdTransactions { get; set; }
        public DbSet<RdInterestAccrual> RdInterestAccruals { get; set; }
        public DbSet<RdAccountSequence> RdAccountSequences { get; set; }

        // Pigmy Deposit Module DbSets
        public DbSet<PigmyScheme> PigmySchemes { get; set; }
        public DbSet<PigmyAgent> PigmyAgents { get; set; }
        public DbSet<PigmyAccount> PigmyAccounts { get; set; }
        public DbSet<PigmyOpeningBalance> PigmyOpeningBalances { get; set; }
        public DbSet<PigmyTransaction> PigmyTransactions { get; set; }
        public DbSet<PigmyAccountSequence> PigmyAccountSequences { get; set; }
        public DbSet<PigmyCollection> PigmyCollections { get; set; }
        public DbSet<PigmyVoucherMapping> PigmyVoucherMappings { get; set; }
        public DbSet<PigmyAgentCashDeposit> PigmyAgentCashDeposits { get; set; }
        public DbSet<PigmyCommissionSetting> PigmyCommissionSettings { get; set; }
        public DbSet<PigmyAgentCommission> PigmyAgentCommissions { get; set; }
        public DbSet<PigmyInterestLog> PigmyInterestLogs { get; set; }
        public DbSet<AgentCustomerRequest> AgentCustomerRequests { get; set; }

        // Investment Module DbSets
        public DbSet<InvestmentInstitution> InvestmentInstitutions { get; set; }
        public DbSet<InvestmentScheme> InvestmentSchemes { get; set; }
        public DbSet<InvestmentAccount> InvestmentAccounts { get; set; }
        public DbSet<InvestmentInterestAccrual> InvestmentInterestAccruals { get; set; }
        public DbSet<InvestmentInterestReceipt> InvestmentInterestReceipts { get; set; }
        public DbSet<InvestmentMaturity> InvestmentMaturities { get; set; }
        public DbSet<InvestmentRenewal> InvestmentRenewals { get; set; }
        public DbSet<InvestmentPrematureWithdrawal> InvestmentPrematureWithdrawals { get; set; }
        public DbSet<InvestmentVoucherMapping> InvestmentVoucherMappings { get; set; }
        public DbSet<InvestmentAccountSequence> InvestmentAccountSequences { get; set; }

        // Asset Management Module DbSets
        public DbSet<AssetCategory> AssetCategories { get; set; }
        public DbSet<Asset> Assets { get; set; }
        public DbSet<AssetPurchase> AssetPurchases { get; set; }
        public DbSet<AssetAllocation> AssetAllocations { get; set; }
        public DbSet<AssetTransfer> AssetTransfers { get; set; }
        public DbSet<AssetMaintenance> AssetMaintenances { get; set; }
        public DbSet<AssetDepreciation> AssetDepreciations { get; set; }
        public DbSet<AssetVerification> AssetVerifications { get; set; }
        public DbSet<AssetDisposal> AssetDisposals { get; set; }

        // NPA Module DbSets
        public DbSet<NpaConfig> NpaConfigs { get; set; }
        public DbSet<NpaProvisionSlab> NpaProvisionSlabs { get; set; }
        public DbSet<CollateralComplianceLog> CollateralComplianceLogs { get; set; }
        public DbSet<LoanAccountNpaStatus> LoanAccountNpaStatuses { get; set; }
        public DbSet<NpaClassificationRun> NpaClassificationRuns { get; set; }
        public DbSet<OverdueInterestLedger> OverdueInterestLedgers { get; set; }
        public DbSet<OverdueRecoveryLedger> OverdueRecoveryLedgers { get; set; }
        public DbSet<BorrowerLinkedAccounts> BorrowerLinkedAccounts { get; set; }

        // Share Module DbSets
        public DbSet<ShareScheme> ShareSchemes { get; set; }
        public DbSet<ShareAccount> ShareAccounts { get; set; }
        public DbSet<ShareCertificate> ShareCertificates { get; set; }
        public DbSet<ShareCertificatePrintHistory> ShareCertificatePrintHistories { get; set; }
        public DbSet<ShareTransaction> ShareTransactions { get; set; }
        public DbSet<DividendDistribution> DividendDistributions { get; set; }

        // Employee Bank Details Module DbSets
        public DbSet<BranchMaster> BranchMasters { get; set; }
        public DbSet<DepartmentMaster> DepartmentMasters { get; set; }
        public DbSet<EmployeeBankDetail> EmployeeBankDetails { get; set; }
        public DbSet<BankMaster> BankMasters { get; set; }

        // Demand & Recovery Module DbSets
        public DbSet<DemandNotice> DemandNotices { get; set; }
        public DbSet<DemandMemberDetail> DemandMemberDetails { get; set; }
        public DbSet<DemandRecovery> DemandRecoveries { get; set; }

        // Locker Management Module DbSets
        public DbSet<LockerType> LockerTypes { get; set; }
        public DbSet<Locker> Lockers { get; set; }
        public DbSet<LockerAllotment> LockerAllotments { get; set; }
        public DbSet<LockerVisitRegister> LockerVisitRegisters { get; set; }
        public DbSet<LockerRentPosting> LockerRentPostings { get; set; }
        public DbSet<LockerSurrender> LockerSurrenders { get; set; }

        // Section 101 / 91 Legal Recovery Module DbSets
        public DbSet<LegalRecoveryLedgerMapping> LegalRecoveryLedgerMappings { get; set; }
        public DbSet<Sec101CaseMaster> Sec101CaseMasters { get; set; }
        public DbSet<Sec101NoticeHistory> Sec101NoticeHistories { get; set; }
        public DbSet<Sec101HearingLog> Sec101HearingLogs { get; set; }
        public DbSet<Sec101AttachmentAuction> Sec101AttachmentAuctions { get; set; }
        public DbSet<Sec101LegalExpense> Sec101LegalExpenses { get; set; }

        // Cash Management Module DbSets
        public DbSet<Cashier> Cashiers { get; set; }
        public DbSet<CashAllocation> CashAllocations { get; set; }
        public DbSet<CashDenomination> CashDenominations { get; set; }
        public DbSet<CashierBalance> CashierBalances { get; set; }
        public DbSet<CashManagementSetting> CashManagementSettings { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<AccountGroup>(entity =>
            {
                entity.HasOne(a => a.ParentGroup)
                      .WithMany(a => a.SubGroups)
                      .HasForeignKey(a => a.ParentGroupID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Ledger>(entity =>
            {
                entity.HasOne(l => l.AccountGroup)
                      .WithMany(g => g.Ledgers)
                      .HasForeignKey(l => l.GroupID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<AuditLedgerMapping>(entity =>
            {
                entity.HasOne(m => m.Ledger)
                      .WithMany()
                      .HasForeignKey(m => m.LedgerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Branch>(entity =>
            {
                entity.HasIndex(b => b.BranchCode).IsUnique();
                entity.HasOne(b => b.DefaultCashLedger)
                      .WithMany()
                      .HasForeignKey(b => b.DefaultCashLedgerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Customer>(entity =>
            {
                entity.HasIndex(c => c.CIFNo).IsUnique().HasFilter("[CIFNo] IS NOT NULL AND [CIFNo] <> ''");
                entity.HasIndex(c => c.AadhaarNo).IsUnique().HasFilter("[AadhaarNo] IS NOT NULL AND [AadhaarNo] <> ''");
                entity.HasIndex(c => c.PANNo).IsUnique().HasFilter("[PANNo] IS NOT NULL AND [PANNo] <> ''");
                entity.HasIndex(c => c.CKYCNo).IsUnique().HasFilter("[CKYCNo] IS NOT NULL AND [CKYCNo] <> ''");
                entity.HasIndex(c => c.Village);
                entity.HasIndex(c => c.MobileNo);

                entity.HasOne(c => c.Branch)
                      .WithMany()
                      .HasForeignKey(c => c.BranchID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(c => c.MemberProfile)
                      .WithOne(m => m.Customer)
                      .HasForeignKey<Member>(m => m.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Member>(entity =>
            {
                entity.HasIndex(m => m.MemberCode).IsUnique().HasFilter("[MemberCode] IS NOT NULL AND [MemberCode] <> ''");
                entity.HasIndex(m => m.CustomerID).IsUnique().HasFilter("[CustomerID] IS NOT NULL");

                entity.HasOne(m => m.Branch)
                      .WithMany()
                      .HasForeignKey(m => m.BranchID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<JointMember>(entity =>
            {
                entity.HasOne(j => j.PrimaryMember)
                      .WithMany()
                      .HasForeignKey(j => j.PrimaryMemberID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<DeceasedClaimSettlement>(entity =>
            {
                entity.HasOne(d => d.Member)
                      .WithMany()
                      .HasForeignKey(d => d.MemberID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.Branch)
                      .WithMany()
                      .HasForeignKey(d => d.BranchID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.Voucher)
                      .WithMany()
                      .HasForeignKey(d => d.VoucherID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<SavingAccountMaster>(entity =>
            {
                entity.HasOne(s => s.Branch)
                      .WithMany()
                      .HasForeignKey(s => s.BranchID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(s => s.Customer)
                      .WithMany(c => c.SavingAccounts)
                      .HasForeignKey(s => s.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<SavingTransaction>(entity =>
            {
                entity.HasOne(s => s.Customer)
                      .WithMany(c => c.SavingTransactions)
                      .HasForeignKey(s => s.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ShareAccount>(entity =>
            {
                entity.HasOne(s => s.Customer)
                      .WithMany(c => c.ShareAccounts)
                      .HasForeignKey(s => s.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ShareCertificate>(entity =>
            {
                entity.HasOne(s => s.Customer)
                      .WithMany(c => c.ShareCertificates)
                      .HasForeignKey(s => s.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ShareTransaction>(entity =>
            {
                entity.HasOne(s => s.Customer)
                      .WithMany(c => c.ShareTransactions)
                      .HasForeignKey(s => s.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<FdAccount>(entity =>
            {
                entity.HasOne(f => f.Customer)
                      .WithMany(c => c.FdAccounts)
                      .HasForeignKey(f => f.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<RdAccount>(entity =>
            {
                entity.HasOne(r => r.Customer)
                      .WithMany(c => c.RdAccounts)
                      .HasForeignKey(r => r.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(r => r.JointCustomer)
                      .WithMany()
                      .HasForeignKey(r => r.JointCustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<LoanAccount>(entity =>
            {
                entity.HasOne(l => l.Branch)
                      .WithMany()
                      .HasForeignKey(l => l.BranchID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(l => l.Customer)
                      .WithMany(c => c.LoanAccounts)
                      .HasForeignKey(l => l.CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(l => l.CoCustomer)
                      .WithMany()
                      .HasForeignKey(l => l.CoCustomerID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(l => l.CoCustomer2)
                      .WithMany()
                      .HasForeignKey(l => l.CoCustomer2ID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(l => l.Guarantor1Customer)
                      .WithMany()
                      .HasForeignKey(l => l.Guarantor1CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(l => l.Guarantor2Customer)
                      .WithMany()
                      .HasForeignKey(l => l.Guarantor2CustomerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Voucher>(entity =>
            {
                entity.HasOne(v => v.Branch)
                      .WithMany()
                      .HasForeignKey(v => v.BranchID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<VoucherDetail>(entity =>
            {
                entity.HasOne(d => d.Voucher)
                      .WithMany(v => v.VoucherDetails)
                      .HasForeignKey(d => d.VoucherID)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(d => d.Ledger)
                      .WithMany()
                      .HasForeignKey(d => d.LedgerID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<BorrowerLinkedAccounts>(entity =>
            {
                entity.HasOne(b => b.ParentMember)
                      .WithMany()
                      .HasForeignKey(b => b.ParentMemberID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(b => b.LinkedMember)
                      .WithMany()
                      .HasForeignKey(b => b.LinkedMemberID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<EmployeeBankDetail>(entity =>
            {
                entity.HasIndex(e => e.CIFNo).IsUnique();
                entity.HasIndex(e => e.EmployeeID).IsUnique();

                entity.HasOne(e => e.Branch)
                      .WithMany()
                      .HasForeignKey(e => e.BranchID)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.Department)
                      .WithMany()
                      .HasForeignKey(e => e.DepartmentID)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<PigmyCollection>(entity =>
            {
                entity.HasIndex(p => new { p.PigmyAccountId, p.CollectionDate })
                      .IsUnique()
                      .HasFilter("[CollectionSource] IN ('MANUAL', 'IMPORT')");

                entity.HasIndex(p => p.TransactionId)
                      .IsUnique()
                      .HasFilter("[TransactionId] IS NOT NULL");

                entity.HasIndex(p => new { p.AgentId, p.CollectionDate });
            });

            // Disable cascade deletes globally to prevent SQL Server multiple cascade paths error
            foreach (var relationship in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
            {
                relationship.DeleteBehavior = DeleteBehavior.Restrict;
            }

            // Inform EF Core that tables have database triggers (e.g. trg_AutoReseed_*)
            // This disables EF Core's default 'OUTPUT' clause on SQL Server, preventing Error 334
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                var tableName = entityType.GetTableName();
                if (!string.IsNullOrEmpty(tableName) && entityType.ClrType != null && !entityType.IsKeyless)
                {
                    entityType.AddTrigger($"trg_AutoReseed_{tableName}");
                }
            }
        }

        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            configurationBuilder.Properties<decimal>().HavePrecision(18, 2);
            base.ConfigureConventions(configurationBuilder);
        }
    }
}

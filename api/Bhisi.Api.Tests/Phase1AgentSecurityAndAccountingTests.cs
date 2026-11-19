using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class Phase1AgentSecurityAndAccountingTests
    {
        private static AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static IConfiguration BuildJwtConfig()
        {
            var dict = new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "SuperSecretUnitTestingJwtKeyForBhisiApi32PlusChars!",
                ["Jwt:ExpireDays"] = "1"
            };
            return new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        }

        private static ControllerContext BuildUserContext(string role, int? agentId = null, int branchId = 1, string name = "TestUser")
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, name),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            if (agentId.HasValue)
            {
                claims.Add(new Claim(ClaimTypes.NameIdentifier, agentId.Value.ToString()));
                claims.Add(new Claim("agentId", agentId.Value.ToString()));
                claims.Add(new Claim("AgentId", agentId.Value.ToString()));
            }
            else
            {
                claims.Add(new Claim(ClaimTypes.NameIdentifier, "99"));
            }

            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                }
            };
        }

        [Fact]
        public void PigmyAgentPublicDto_DoesNotExposeCredentialProperties()
        {
            var propNames = typeof(PigmyAgentPublicDto).GetProperties().Select(p => p.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            Assert.DoesNotContain("PasswordHash", propNames);
            Assert.DoesNotContain("Password", propNames);
            Assert.DoesNotContain("Pin", propNames);
            Assert.DoesNotContain("ActiveSessionToken", propNames);
        }

        [Fact]
        public async Task PigmyAgentsController_AgentCanReadOnlyOwnRecord_AndReturnsPublicDto()
        {
            using var context = GetInMemoryDbContext(nameof(PigmyAgentsController_AgentCanReadOnlyOwnRecord_AndReturnsPublicDto));
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.PigmyAgents.AddRange(
                new PigmyAgent { PigmyAgentID = 10, AgentName = "Agent Ten", BranchID = 1, Pin = "1234", PasswordHash = "hash", ActiveSessionToken = "tok" },
                new PigmyAgent { PigmyAgentID = 20, AgentName = "Agent Twenty", BranchID = 1, Pin = "5678", PasswordHash = "hash2" }
            );
            await context.SaveChangesAsync();

            var controller = new PigmyAgentsController(context)
            {
                ControllerContext = BuildUserContext("AGENT", agentId: 10, branchId: 1)
            };

            var forbidden = await controller.GetPigmyAgent(20);
            var forbidObj = Assert.IsType<ObjectResult>(forbidden.Result);
            Assert.Equal(403, forbidObj.StatusCode);

            var allowed = await controller.GetPigmyAgent(10);
            var ok = Assert.IsType<OkObjectResult>(allowed.Result);
            var dto = Assert.IsType<PigmyAgentPublicDto>(ok.Value);
            Assert.Equal(10, dto.PigmyAgentID);
            Assert.Equal("Agent Ten", dto.AgentName);
        }

        [Fact]
        public async Task AuthController_AgentWithoutPasswordOrPin_ShouldBeRejectedWithUnauthorized()
        {
            using var context = GetInMemoryDbContext(nameof(AuthController_AgentWithoutPasswordOrPin_ShouldBeRejectedWithUnauthorized));
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.Customers.Add(new Customer { CustomerID = 1, FirstName = "Raju", LastName = "Patil", MobileNo = "9876543210", BranchID = 1 });
            context.PigmyAgents.Add(new PigmyAgent
            {
                PigmyAgentID = 5,
                AgentName = "Raju Patil",
                CustomerID = 1,
                BranchID = 1,
                Status = "Active",
                PasswordHash = null,
                Pin = null
            });
            await context.SaveChangesAsync();

            var controller = new AuthController(context, BuildJwtConfig());
            var result = await controller.Login(new LoginRequestDto { Username = "9876543210", Password = "anything" });

            Assert.IsType<UnauthorizedObjectResult>(result.Result);
        }

        [Fact]
        public async Task AuthController_AgentPinAutoUpgradesToBcrypt_AndLocksAfter5Failures()
        {
            using var context = GetInMemoryDbContext(nameof(AuthController_AgentPinAutoUpgradesToBcrypt_AndLocksAfter5Failures));
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.FinancialYears.Add(new FinancialYear { FinancialYearID = 1, YearCode = "2026-2027", IsActive = true, StartDate = new DateTime(2026, 4, 1), EndDate = new DateTime(2027, 3, 31) });
            context.Customers.Add(new Customer { CustomerID = 2, FirstName = "Suresh", LastName = "Kale", MobileNo = "9999988888", BranchID = 1 });
            context.PigmyAgents.Add(new PigmyAgent
            {
                PigmyAgentID = 6,
                AgentName = "Suresh Kale",
                CustomerID = 2,
                BranchID = 1,
                Status = "Active",
                Pin = "4321"
            });
            await context.SaveChangesAsync();

            var controller = new AuthController(context, BuildJwtConfig());

            // 1. Valid plaintext PIN logs in and upgrades to BCrypt
            var okRes = await controller.Login(new LoginRequestDto { Username = "9999988888", Password = "4321", BranchID = 1 });
            var okObj = Assert.IsType<OkObjectResult>(okRes.Result);
            var loginDto = Assert.IsType<LoginResponseDto>(okObj.Value);
            Assert.Equal("AGENT", loginDto.Role);
            Assert.False(string.IsNullOrWhiteSpace(loginDto.Token));

            var updatedAgent = await context.PigmyAgents.FindAsync(6);
            Assert.NotNull(updatedAgent);
            Assert.Null(updatedAgent!.Pin);
            Assert.True(BCrypt.Net.BCrypt.Verify("4321", updatedAgent.PasswordHash));
            Assert.Equal(loginDto.Token, updatedAgent.ActiveSessionToken);

            // 2. Five consecutive bad attempts lock the account
            for (int i = 0; i < 5; i++)
            {
                var badRes = await controller.Login(new LoginRequestDto { Username = "9999988888", Password = "wrong", BranchID = 1 });
                Assert.IsType<UnauthorizedObjectResult>(badRes.Result);
            }

            updatedAgent = await context.PigmyAgents.FindAsync(6);
            Assert.True(updatedAgent!.IsLocked);
            Assert.Equal(5, updatedAgent.FailedLoginAttempts);

            // 3. Even valid password fails while locked
            var lockedRes = await controller.Login(new LoginRequestDto { Username = "9999988888", Password = "4321", BranchID = 1 });
            Assert.IsType<UnauthorizedObjectResult>(lockedRes.Result);
        }

        [Fact]
        public async Task PigmySyncService_RejectsOnlineOnClosedDate_AndPreservesCollectionDateOnOfflineSync()
        {
            using var context = GetInMemoryDbContext(nameof(PigmySyncService_RejectsOnlineOnClosedDate_AndPreservesCollectionDateOnOfflineSync));
            var closedDate = new DateTime(2026, 11, 18);

            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.Customers.Add(new Customer { CustomerID = 1, FirstName = "Test", LastName = "Member", BranchID = 1 });
            context.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = closedDate,
                IsDayClosed = true
            });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 1, AgentName = "Agent One", BranchID = 1, MaxCashLimit = 50000m, Status = "Active" });
            context.PigmyAccounts.Add(new PigmyAccount
            {
                PigmyAccountID = 101,
                CustomerID = 1,
                AccountNo = "PGM-101",
                PigmyAgentID = 1,
                BranchID = 1,
                TotalDepositedAmount = 1000m,
                Status = "Active"
            });
            await context.SaveChangesAsync();

            var lockService = new AgentLockService(context);
            var guardService = new BusinessDateGuardService(context);
            var syncService = new PigmySyncService(context, lockService, guardService);

            // 1. Online collection attempted on a closed BusinessDate => 409 Conflict
            var onlineRes = await syncService.ProcessSingleCollectionAsync(1, new SingleCollectionRequestDto
            {
                PigmyAccountId = 101,
                Amount = 200m,
                Timestamp = new DateTime(2026, 11, 18, 10, 0, 0, DateTimeKind.Unspecified),
                TransactionId = Guid.NewGuid().ToString(),
                PaymentMode = "CASH",
                OfflineSync = false
            });
            Assert.False(onlineRes.Success);
            Assert.Equal(409, onlineRes.StatusCode);

            // 2. Offline collection captured on 2026-11-18 and synced later => succeeds & preserves CollectionDate = 2026-11-18
            var offlineRes = await syncService.ProcessSingleCollectionAsync(1, new SingleCollectionRequestDto
            {
                PigmyAccountId = 101,
                Amount = 300m,
                Timestamp = new DateTime(2026, 11, 18, 16, 30, 0, DateTimeKind.Unspecified),
                TransactionId = Guid.NewGuid().ToString(),
                PaymentMode = "CASH",
                OfflineSync = true
            });
            Assert.True(offlineRes.Success);
            Assert.Equal(200, offlineRes.StatusCode);

            var savedCollection = await context.PigmyCollections.FirstOrDefaultAsync();
            Assert.NotNull(savedCollection);
            Assert.Equal(closedDate.Date, savedCollection!.CollectionDate.Date);
            Assert.Equal(1300m, savedCollection.ClosingBalance);
        }

        [Fact]
        public async Task AgentLockService_TracksAllFourCashProductsAndMaxLockDays()
        {
            using var context = GetInMemoryDbContext(nameof(AgentLockService_TracksAllFourCashProductsAndMaxLockDays));
            var oldDate = DateTime.UtcNow.AddHours(5.5).Date.AddDays(-3);

            context.PigmyAgents.Add(new PigmyAgent
            {
                PigmyAgentID = 7,
                AgentName = "Multi Product Agent",
                MaxCashLimit = 100000m,
                MaxLockDays = 2,
                Status = "Active"
            });

            // Older cash loan collection + current day cash saving & RD + UPI saving (should not count as cash)
            context.LoanCollections.Add(new LoanCollection
            {
                LoanAccountID = 1,
                AgentID = 7,
                CollectionDate = oldDate,
                TotalAmountReceived = 1000m,
                PrincipalCollected = 800m,
                InterestCollected = 200m,
                PaymentMode = "CASH",
                CollectionSource = "AGENT_MOBILE",
                ReceiptNo = "LN-1"
            });
            context.SavingTransactions.AddRange(
                new SavingTransaction
                {
                    SavingAccountID = 1,
                    AgentID = 7,
                    TransactionDate = DateTime.UtcNow.AddHours(5.5).Date,
                    TransactionType = "Deposit",
                    Amount = 500m,
                    PaymentMode = "CASH",
                    CollectionSource = "AGENT_MOBILE"
                },
                new SavingTransaction
                {
                    SavingAccountID = 1,
                    AgentID = 7,
                    TransactionDate = DateTime.UtcNow.AddHours(5.5).Date,
                    TransactionType = "Deposit",
                    Amount = 900m,
                    PaymentMode = "UPI",
                    CollectionSource = "AGENT_MOBILE"
                }
            );
            context.RdTransactions.Add(new RdTransaction
            {
                RdAccountID = 1,
                AgentID = 7,
                TransactionDate = DateTime.UtcNow.AddHours(5.5).Date,
                TransactionType = "Installment",
                PrincipalAmount = 400m,
                CollectionSource = "AGENT_MOBILE"
            });
            await context.SaveChangesAsync();

            var lockService = new AgentLockService(context);
            var status = await lockService.GetLockStatusAsync(7);

            Assert.Equal("LOCKED", status.Status);
            Assert.True(status.IsLocked);
            Assert.Equal(1900m, status.PendingCash); // 1000 Loan + 500 Saving Cash + 400 RD Cash (900 UPI excluded)
        }

        [Fact]
        public async Task AgentDayBookController_DepositCash_ReconcilesAllFourProductsAndCreatesBalancedVoucher()
        {
            using var context = GetInMemoryDbContext(nameof(AgentDayBookController_DepositCash_ReconcilesAllFourProductsAndCreatesBalancedVoucher));
            var bizDate = new DateTime(2026, 11, 19);

            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main Branch" });
            context.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                IsActive = true,
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31)
            });

            // Required AccountGroup & Ledgers
            context.AccountGroups.Add(new AccountGroup
            {
                GroupID = 1,
                GroupName = "रोख शिल्लक",
                NatureOfGroup = "Assets"
            });
            context.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CSH-1", LedgerName = "Cash In Hand", AccountType = "Cash In Hand" },
                new Ledger { LedgerID = 2, GroupID = 1, LedgerCode = "PGM-L", LedgerName = "Pigmy Deposit Liability", AccountType = "Liability" },
                new Ledger { LedgerID = 3, GroupID = 1, LedgerCode = "LN-P", LedgerName = "Loan Receivable", AccountType = "Asset" },
                new Ledger { LedgerID = 4, GroupID = 1, LedgerCode = "LN-I", LedgerName = "Loan Interest Income", AccountType = "Income" },
                new Ledger { LedgerID = 5, GroupID = 1, LedgerCode = "SB-L", LedgerName = "Saving Deposit Liability", AccountType = "Liability" },
                new Ledger { LedgerID = 6, GroupID = 1, LedgerCode = "RD-L", LedgerName = "RD Liability", AccountType = "Liability" }
            );

            context.PigmyVoucherMappings.Add(new PigmyVoucherMapping
            {
                MappingId = 1,
                BranchId = 1,
                DebitLedgerId = 1,
                CreditLedgerId = 2,
                IsActive = true
            });

            context.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanType = "Gold Loan",
                LoanLedgerID = 3,
                InterestLedgerID = 4,
                OverdueInterestLedgerID = 4
            });
            context.LoanAccounts.Add(new LoanAccount { LoanAccountID = 10, LoanAccountNo = "LN-10", LoanRateID = 1, BranchID = 1 });
            context.SavingAccountMasters.Add(new SavingAccountMaster { SavingAccountID = 20, AccountNo = "SB-20", BranchID = 1, LedgerID = 5 });
            context.RdSchemes.Add(new RdScheme { RdSchemeID = 1, SchemeName = "Regular RD", RdLiabilityLedgerID = 6 });
            context.RdAccounts.Add(new RdAccount { RdAccountID = 30, AccountNo = "RD-30", RdSchemeID = 1, BranchID = 1 });

            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 8, AgentName = "Ganesh Joshi", BranchID = 1, MaxCashLimit = 50000m, Status = "Active" });

            // 4-product collections totaling 500 + 1000 + 300 + 200 = 2000
            context.PigmyCollections.Add(new PigmyCollection
            {
                PigmyAccountId = 1,
                AgentId = 8,
                CollectionDate = bizDate,
                CollectionAmount = 500m,
                PaymentMode = "CASH",
                CollectionSource = "APP",
                ReceiptNo = "PG-1",
                TransactionId = Guid.NewGuid().ToString()
            });
            context.LoanCollections.Add(new LoanCollection
            {
                LoanAccountID = 10,
                AgentID = 8,
                CollectionDate = bizDate,
                TotalAmountReceived = 1000m,
                PrincipalCollected = 800m,
                InterestCollected = 200m,
                PaymentMode = "CASH",
                CollectionSource = "AGENT_MOBILE",
                ReceiptNo = "LN-1"
            });
            context.SavingTransactions.Add(new SavingTransaction
            {
                SavingAccountID = 20,
                AgentID = 8,
                TransactionDate = bizDate,
                TransactionType = "Deposit",
                Amount = 300m,
                PaymentMode = "CASH",
                CollectionSource = "AGENT_MOBILE"
            });
            context.RdTransactions.Add(new RdTransaction
            {
                RdAccountID = 30,
                AgentID = 8,
                TransactionDate = bizDate,
                TransactionType = "Installment",
                PrincipalAmount = 200m,
                CollectionSource = "AGENT_MOBILE"
            });
            await context.SaveChangesAsync();

            var controller = new AgentDayBookController(context)
            {
                ControllerContext = BuildUserContext("Cashier", branchId: 1)
            };

            var response = await controller.DepositCash(new AgentDayBookController.CashDepositDto
            {
                AgentId = 8,
                BranchId = 1,
                DepositDate = bizDate,
                CollectionDateFrom = bizDate,
                CollectionDateTo = bizDate,
                Amount = 2000m,
                PaymentMode = "CASH",
                Narration = "Full 4-product remittance"
            });

            if (response is ObjectResult errRes && errRes is not OkObjectResult)
            {
                Assert.Fail($"Expected OkObjectResult but got {errRes.StatusCode}: {errRes.Value}");
            }
            var ok = Assert.IsType<OkObjectResult>(response);
            Assert.NotNull(ok.Value);

            var deposit = await context.PigmyAgentCashDeposits.FirstOrDefaultAsync();
            Assert.NotNull(deposit);
            Assert.Equal(2000m, deposit!.Amount);
            Assert.NotNull(deposit.VoucherId);

            // Balanced GL Voucher check
            var entries = await context.VoucherDetails.Where(e => e.VoucherID == deposit.VoucherId).ToListAsync();
            Assert.Equal(2000m, entries.Where(e => e.DrCr == "Dr").Sum(e => e.Amount));
            Assert.Equal(2000m, entries.Where(e => e.DrCr == "Cr").Sum(e => e.Amount));
            Assert.Equal(500m, entries.Where(e => e.DrCr == "Cr" && e.LedgerID == 2).Sum(e => e.Amount)); // Pigmy
            Assert.Equal(800m, entries.Where(e => e.DrCr == "Cr" && e.LedgerID == 3).Sum(e => e.Amount)); // Loan Principal
            Assert.Equal(200m, entries.Where(e => e.DrCr == "Cr" && e.LedgerID == 4).Sum(e => e.Amount)); // Loan Interest
            Assert.Equal(300m, entries.Where(e => e.DrCr == "Cr" && e.LedgerID == 5).Sum(e => e.Amount)); // Saving
            Assert.Equal(200m, entries.Where(e => e.DrCr == "Cr" && e.LedgerID == 6).Sum(e => e.Amount)); // RD

            // Linked RemittanceDepositId + VoucherID
            var loanCol = await context.LoanCollections.FirstAsync();
            var savingTx = await context.SavingTransactions.FirstAsync();
            var rdTx = await context.RdTransactions.FirstAsync();
            Assert.Equal(deposit.DepositId, loanCol.RemittanceDepositId);
            Assert.Equal(deposit.VoucherId, loanCol.VoucherID);
            Assert.Equal(deposit.DepositId, savingTx.RemittanceDepositId);
            Assert.Equal(deposit.VoucherId, savingTx.VoucherID);
            Assert.Equal(deposit.DepositId, rdTx.RemittanceDepositId);
            Assert.Equal(deposit.VoucherId, rdTx.VoucherID);

            // Agent pending cash is now 0
            var lockService = new AgentLockService(context);
            var lockStatus = await lockService.GetLockStatusAsync(8);
            Assert.Equal("ALLOWED", lockStatus.Status);
            Assert.Equal(0m, lockStatus.PendingCash);
        }

        [Fact]
        public async Task VoucherRollback_AgentMultiProductRemittance_UnlinksWithoutDeletingCustomerLoanSavingRdCollections()
        {
            using var context = GetInMemoryDbContext(nameof(VoucherRollback_AgentMultiProductRemittance_UnlinksWithoutDeletingCustomerLoanSavingRdCollections));
            var bizDate = new DateTime(2026, 11, 19);

            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main Branch" });
            context.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                IsActive = true,
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31)
            });
            context.AccountGroups.Add(new AccountGroup { GroupID = 1, GroupName = "रोख शिल्लक", NatureOfGroup = "Assets" });
            context.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CSH-1", LedgerName = "Cash In Hand", AccountType = "Cash In Hand" },
                new Ledger { LedgerID = 2, GroupID = 1, LedgerCode = "PGM-L", LedgerName = "Pigmy Deposit Liability", AccountType = "Liability" },
                new Ledger { LedgerID = 3, GroupID = 1, LedgerCode = "LN-P", LedgerName = "Loan Receivable", AccountType = "Asset" },
                new Ledger { LedgerID = 4, GroupID = 1, LedgerCode = "LN-I", LedgerName = "Loan Interest Income", AccountType = "Income" },
                new Ledger { LedgerID = 5, GroupID = 1, LedgerCode = "SB-L", LedgerName = "Saving Deposit Liability", AccountType = "Liability" },
                new Ledger { LedgerID = 6, GroupID = 1, LedgerCode = "RD-L", LedgerName = "RD Liability", AccountType = "Liability" }
            );
            context.PigmyVoucherMappings.Add(new PigmyVoucherMapping { MappingId = 1, BranchId = 1, DebitLedgerId = 1, CreditLedgerId = 2, IsActive = true });
            context.LoanRates.Add(new LoanRate { LoanRateID = 1, LoanType = "Gold Loan", LoanLedgerID = 3, InterestLedgerID = 4, OverdueInterestLedgerID = 4 });
            context.LoanAccounts.Add(new LoanAccount { LoanAccountID = 10, LoanAccountNo = "LN-10", LoanRateID = 1, BranchID = 1, PrincipalBalance = 5000m, Status = "Active" });
            context.SavingAccountMasters.Add(new SavingAccountMaster { SavingAccountID = 20, AccountNo = "SB-20", BranchID = 1, LedgerID = 5, CurrentBalance = 1300m, Status = "Active" });
            context.RdSchemes.Add(new RdScheme { RdSchemeID = 1, SchemeName = "Regular RD", RdLiabilityLedgerID = 6 });
            context.RdAccounts.Add(new RdAccount { RdAccountID = 30, AccountNo = "RD-30", RdSchemeID = 1, BranchID = 1, TotalDepositedAmount = 200m, TotalPaidInstallments = 1, Status = "Active" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 8, AgentName = "Ganesh Joshi", BranchID = 1, MaxCashLimit = 50000m, Status = "Active" });

            context.PigmyCollections.Add(new PigmyCollection { PigmyAccountId = 1, AgentId = 8, CollectionDate = bizDate, CollectionAmount = 500m, PaymentMode = "CASH", CollectionSource = "APP", ReceiptNo = "PG-1", TransactionId = Guid.NewGuid().ToString() });
            context.LoanCollections.Add(new LoanCollection { LoanAccountID = 10, AgentID = 8, CollectionDate = bizDate, TotalAmountReceived = 1000m, PrincipalCollected = 800m, InterestCollected = 200m, PaymentMode = "CASH", CollectionSource = "AGENT_MOBILE", ReceiptNo = "LN-1" });
            context.SavingTransactions.Add(new SavingTransaction { SavingAccountID = 20, AgentID = 8, TransactionDate = bizDate, TransactionType = "Deposit", Amount = 300m, PaymentMode = "CASH", CollectionSource = "AGENT_MOBILE", VoucherNo = "SB-AGT-8-1" });
            context.RdTransactions.Add(new RdTransaction { RdAccountID = 30, AgentID = 8, TransactionDate = bizDate, TransactionType = "Installment", PrincipalAmount = 200m, CollectionSource = "AGENT_MOBILE" });
            await context.SaveChangesAsync();

            var daybookCtrl = new AgentDayBookController(context) { ControllerContext = BuildUserContext("Cashier", branchId: 1) };
            var depRes = await daybookCtrl.DepositCash(new AgentDayBookController.CashDepositDto
            {
                AgentId = 8,
                BranchId = 1,
                DepositDate = bizDate,
                CollectionDateFrom = bizDate,
                CollectionDateTo = bizDate,
                Amount = 2000m,
                PaymentMode = "CASH"
            });
            Assert.IsType<OkObjectResult>(depRes);

            var deposit = await context.PigmyAgentCashDeposits.FirstAsync();
            Assert.NotNull(deposit.VoucherId);

            // Now delete the consolidated remittance voucher via VoucherRollbackAndDeleteService (e.g. from Voucher Passing)
            var rollbackService = new VoucherRollbackAndDeleteService(context);
            var delRes = await rollbackService.DeleteVoucherWithRollbackAsync(deposit.VoucherId!.Value, new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "चुकून चुकीचा एजंट भरणा व्हाउचर बनला",
                ActionSource = "VOUCHER_HARD_DELETE"
            });

            Assert.True(delRes.Success, delRes.Message);

            // Customer doorstep collections MUST STILL EXIST with intact balances, only unlinked from the deleted remittance voucher!
            var loanCol = await context.LoanCollections.FirstOrDefaultAsync();
            var savingTx = await context.SavingTransactions.FirstOrDefaultAsync();
            var rdTx = await context.RdTransactions.FirstOrDefaultAsync();
            Assert.NotNull(loanCol);
            Assert.NotNull(savingTx);
            Assert.NotNull(rdTx);
            Assert.Null(loanCol!.RemittanceDepositId);
            Assert.Null(loanCol.VoucherID);
            Assert.Null(savingTx!.RemittanceDepositId);
            Assert.Null(savingTx.VoucherID);
            Assert.Null(rdTx!.RemittanceDepositId);
            Assert.Null(rdTx.VoucherID);

            var loanAcc = await context.LoanAccounts.FirstAsync(l => l.LoanAccountID == 10);
            var savAcc = await context.SavingAccountMasters.FirstAsync(s => s.SavingAccountID == 20);
            var rdAcc = await context.RdAccounts.FirstAsync(r => r.RdAccountID == 30);
            Assert.Equal(5000m, loanAcc.PrincipalBalance);
            Assert.Equal(1300m, savAcc.CurrentBalance);
            Assert.Equal(200m, rdAcc.TotalDepositedAmount);
        }

        [Fact]
        public async Task PigmyAgentsController_Upsert_SavesHashedPassword_AllowsCashierGet_AndNeverLeaksSecrets()
        {
            using var context = GetInMemoryDbContext(nameof(PigmyAgentsController_Upsert_SavesHashedPassword_AllowsCashierGet_AndNeverLeaksSecrets));
            context.Branches.Add(new Branch { BranchID = 1, BranchName = "मुख्य शाखा" });
            await context.SaveChangesAsync();

            var adminCtrl = new PigmyAgentsController(context) { ControllerContext = BuildUserContext("Admin", branchId: 1) };
            var postRes = await adminCtrl.PostPigmyAgent(new PigmyAgentUpsertDto
            {
                AgentName = "संतोष पाटील",
                BranchID = 1,
                Username = "santosh_agt",
                Password = "AgentPass@123",
                Status = "Active"
            });

            var created = Assert.IsType<CreatedAtActionResult>(postRes.Result);
            var dto = Assert.IsType<PigmyAgentPublicDto>(created.Value);
            Assert.Equal("मुख्य शाखा", dto.BranchName);
            Assert.Equal("मुख्य शाखा", dto.Branch?.BranchName);

            var savedAgent = await context.PigmyAgents.FirstAsync(a => a.PigmyAgentID == dto.PigmyAgentID);
            Assert.False(string.IsNullOrWhiteSpace(savedAgent.PasswordHash));
            Assert.True(BCrypt.Net.BCrypt.Verify("AgentPass@123", savedAgent.PasswordHash));

            // Cashier MUST be able to read GET /api/PigmyAgents (branch dropdowns across Pigmy/RD/Customer screens)
            var cashierCtrl = new PigmyAgentsController(context) { ControllerContext = BuildUserContext("Cashier", branchId: 1) };
            var getRes = await cashierCtrl.GetPigmyAgents(1);
            var ok = Assert.IsType<OkObjectResult>(getRes.Result);
            var list = Assert.IsAssignableFrom<IEnumerable<PigmyAgentPublicDto>>(ok.Value);
            Assert.Single(list);
        }

        [Fact]
        public async Task LoanAccountsController_PutLoanAccount_WithNullRowVersion_SucceedsWithoutConcurrencyCrash()
        {
            using var context = GetInMemoryDbContext(nameof(LoanAccountsController_PutLoanAccount_WithNullRowVersion_SucceedsWithoutConcurrencyCrash));
            context.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 55,
                BranchID = 1,
                LoanAccountNo = "LN-55",
                PrincipalBalance = 10000m,
                Status = "Active",
                RowVersion = new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 }
            });
            await context.SaveChangesAsync();

            var ctrl = new LoanAccountsController(context) { ControllerContext = BuildUserContext("Admin", branchId: 1) };
            var putRes = await ctrl.PutLoanAccount(55, new LoanAccount
            {
                LoanAccountID = 55,
                BranchID = 1,
                LoanAccountNo = "LN-55",
                PrincipalBalance = 9500m,
                Status = "Active",
                RowVersion = null
            });

            Assert.IsType<NoContentResult>(putRes);
            var updated = await context.LoanAccounts.FirstAsync(l => l.LoanAccountID == 55);
            Assert.Equal(9500m, updated.PrincipalBalance);
            Assert.NotNull(updated.RowVersion);
        }

        [Fact]
        public void UploadController_GetKycFile_RejectsTraversalAndNonGuidNames()
        {
            var ctrl = new UploadController();
            Assert.IsType<BadRequestObjectResult>(ctrl.GetKycFile("../appsettings.json"));
            Assert.IsType<BadRequestObjectResult>(ctrl.GetKycFile("not-a-guid.jpg"));
            Assert.IsType<BadRequestObjectResult>(ctrl.GetKycFile("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.exe"));
        }
    }
}

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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class DoorstepLoanEmiScheduleAndWaterfallTests
    {
        private static AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext BuildAgentContext(int agentId, int branchId = 1, string name = "Agent")
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, name),
                new Claim(ClaimTypes.Role, "AGENT"),
                new Claim(ClaimTypes.NameIdentifier, agentId.ToString()),
                new Claim("agentId", agentId.ToString()),
                new Claim("AgentId", agentId.ToString()),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };

            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                }
            };
        }

        private static ControllerContext BuildStaffContext(string role = "Admin", int userId = 99, int branchId = 1)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, "CashierAdmin"),
                new Claim(ClaimTypes.Role, role),
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };

            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                }
            };
        }

        [Fact]
        public async Task CollectLoanEmi_AccruesCurrentPeriodDailyReducingInterest_AndMarksFirstInstallmentPaid()
        {
            using var context = GetInMemoryDbContext(nameof(CollectLoanEmi_AccruesCurrentPeriodDailyReducingInterest_AndMarksFirstInstallmentPaid));
            var disburseDate = new DateTime(2026, 10, 1);
            var collectDate = new DateTime(2026, 10, 31); // 30 days elapsed

            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.Customers.Add(new Customer { CustomerID = 1, BranchID = 1, FirstName = "राजेश", LastName = "पाटील" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 5, AgentName = "एजंट एक", BranchID = 1, MaxCashLimit = 100000m, MaxLockDays = 5, Status = "Active" });

            var rate = new LoanRate
            {
                LoanRateID = 1,
                LoanType = "वैयक्तिक कर्ज",
                InterestRate = 12m,
                InterestCalculationMethod = "Reducing (घटती शिल्लक)",
                LoanInstallmentType = "समान हप्ता",
                LoanLedgerID = 201,
                InterestLedgerID = 301
            };
            context.LoanRates.Add(rate);

            var loan = new LoanAccount
            {
                LoanAccountID = 11,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 1,
                LoanRate = rate,
                LoanAccountNo = "LN-011",
                SanctionedAmount = 100000m,
                PrincipalBalance = 100000m,
                PurePrincipalBalance = 100000m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 12m,
                DurationMonths = 12,
                NoOfInstallments = 12,
                OpeningDate = disburseDate,
                LoanDisbursementDate = disburseDate,
                InstallmentAmount = 8885m,
                InstallmentFrequency = "मासिक (Monthly)",
                IsAgentCollectionAllowed = true,
                AssignedAgentID = 5,
                Status = "Active"
            };
            context.LoanAccounts.Add(loan);

            var schedules = LoanScheduleGenerator.GenerateSchedules(loan, rate);
            foreach (var s in schedules)
            {
                s.LoanAccountID = loan.LoanAccountID;
                context.LoanInstallmentSchedules.Add(s);
            }
            await context.SaveChangesAsync();

            var controller = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildAgentContext(5)
            };

            // Collect 10000 on 2026-10-31 (offlineSync triggers preserved collDate):
            // 30 days interest = Math.Round(100000 * 12 * 30 / 36500) = 986
            // Principal = 10000 - 986 = 9014 (exceeds Installment #1 principal ~7885 so Installment #1 becomes Paid)
            var result = await controller.CollectLoanEmi(new PigmyMobileApiController.CollectLoanEmiRequestDto
            {
                AgentId = 5,
                LoanAccountId = 11,
                Amount = 10000m,
                PaymentMode = "CASH",
                CollectionDate = collectDate,
                SyncReferenceId = Guid.NewGuid().ToString("N")
            });

            var ok = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(ok.Value);

            var savedCollection = await context.LoanCollections.FirstAsync();
            Assert.Equal(10000m, savedCollection.TotalAmountReceived);
            Assert.Equal(0m, savedCollection.PenaltyInterestCollected);
            Assert.Equal(0m, savedCollection.ReceivableInterestCollected);
            Assert.Equal(986m, savedCollection.InterestCollected);
            Assert.Equal(9014m, savedCollection.PrincipalCollected);

            var updatedLoan = await context.LoanAccounts.FirstAsync(l => l.LoanAccountID == 11);
            Assert.Equal(90986m, updatedLoan.PrincipalBalance);
            Assert.Equal(0m, updatedLoan.InterestBalance);
            Assert.Equal(collectDate.Date, updatedLoan.LastInstallmentPaidDate?.Date);

            var firstSched = await context.LoanInstallmentSchedules
                .Where(s => s.LoanAccountID == 11)
                .OrderBy(s => s.InstallmentNo)
                .FirstAsync();
            Assert.Equal("Paid", firstSched.Status);
            Assert.Equal(collectDate.Date, firstSched.PaidDate?.Date);
        }

        [Fact]
        public async Task CollectLoanEmi_SplitsPenaltyReceivableAndCurrentInterest_AndAgentDayBookCreditsAllFourLedgers()
        {
            using var context = GetInMemoryDbContext(nameof(CollectLoanEmi_SplitsPenaltyReceivableAndCurrentInterest_AndAgentDayBookCreditsAllFourLedgers));
            var disburseDate = new DateTime(2026, 10, 1);
            var collectDate = new DateTime(2026, 10, 31);

            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.Customers.Add(new Customer { CustomerID = 1, BranchID = 1, FirstName = "संतोष", LastName = "कुलकर्णी" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 8, AgentName = "एजंट आठ", BranchID = 1, MaxCashLimit = 100000m, MaxLockDays = 5, Status = "Active" });

            context.AccountGroups.Add(new AccountGroup
            {
                GroupID = 1,
                GroupName = "रोख शिल्लक",
                NatureOfGroup = "Assets"
            });
            context.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "1001", LedgerName = "Cash In Hand", AccountType = "Cash In Hand" },
                new Ledger { LedgerID = 47, GroupID = 1, LedgerCode = "2001", LedgerName = "Pigmy Deposits", AccountType = "Liabilities" },
                new Ledger { LedgerID = 201, GroupID = 1, LedgerCode = "1101", LedgerName = "Loan Principal", AccountType = "Assets" },
                new Ledger { LedgerID = 301, GroupID = 1, LedgerCode = "4101", LedgerName = "Loan Interest Income", AccountType = "Income" },
                new Ledger { LedgerID = 115, GroupID = 1, LedgerCode = "1150", LedgerName = "Receivable Interest", AccountType = "Assets" },
                new Ledger { LedgerID = 305, GroupID = 1, LedgerCode = "4105", LedgerName = "Overdue Interest Income", AccountType = "Income" }
            );
            context.PigmyVoucherMappings.Add(new PigmyVoucherMapping
            {
                MappingId = 1,
                BranchId = 1,
                DebitLedgerId = 1,
                CreditLedgerId = 47,
                IsActive = true
            });

            var rate = new LoanRate
            {
                LoanRateID = 2,
                LoanType = "व्यवसाय कर्ज",
                InterestRate = 12m,
                InterestCalculationMethod = "Reducing (घटती शिल्लक)",
                LoanLedgerID = 201,
                InterestLedgerID = 301,
                ReceivableInterestLedgerID = 115,
                OverdueInterestLedgerID = 305
            };
            context.LoanRates.Add(rate);

            var loan = new LoanAccount
            {
                LoanAccountID = 20,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 2,
                LoanRate = rate,
                LoanAccountNo = "LN-020",
                SanctionedAmount = 100000m,
                PrincipalBalance = 100000m,
                PurePrincipalBalance = 100000m,
                InterestBalance = 400m,         // Previous Receivable Interest
                OverdueInterestBalance = 150m,  // Penalty Interest
                InterestRate = 12m,
                DurationMonths = 12,
                OpeningDate = disburseDate,
                LoanDisbursementDate = disburseDate,
                IsAgentCollectionAllowed = true,
                AssignedAgentID = 8,
                Status = "Active"
            };
            context.LoanAccounts.Add(loan);
            await context.SaveChangesAsync();

            var mobileCtrl = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildAgentContext(8)
            };

            // Total payment 5000 => 150 penalty + 400 receivable + 986 current (30 days) + 3464 principal = 5000
            var collectRes = await mobileCtrl.CollectLoanEmi(new PigmyMobileApiController.CollectLoanEmiRequestDto
            {
                AgentId = 8,
                LoanAccountId = 20,
                Amount = 5000m,
                PaymentMode = "CASH",
                CollectionDate = collectDate,
                SyncReferenceId = Guid.NewGuid().ToString("N")
            });
            Assert.IsType<OkObjectResult>(collectRes);

            var lc = await context.LoanCollections.FirstAsync();
            Assert.Equal(150m, lc.PenaltyInterestCollected);
            Assert.Equal(400m, lc.ReceivableInterestCollected);
            Assert.Equal(986m, lc.InterestCollected);
            Assert.Equal(3464m, lc.PrincipalCollected);

            // Cashier remits ₹5,000 in AgentDayBook
            var daybookCtrl = new AgentDayBookController(context) { ControllerContext = BuildStaffContext("Cashier") };
            var depRes = await daybookCtrl.DepositCash(new AgentDayBookController.CashDepositDto
            {
                AgentId = 8,
                BranchId = 1,
                CollectionDateFrom = collectDate,
                CollectionDateTo = collectDate,
                DepositDate = collectDate,
                Amount = 5000m,
                PaymentMode = "CASH"
            });
            Assert.IsType<OkObjectResult>(depRes);

            var voucher = await context.Vouchers.Include(v => v.VoucherDetails).FirstAsync();
            decimal drTotal = voucher.VoucherDetails.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
            decimal crTotal = voucher.VoucherDetails.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);
            Assert.Equal(5000m, drTotal);
            Assert.Equal(5000m, crTotal);
            Assert.Equal(150m, voucher.VoucherDetails.Where(vd => vd.DrCr == "Cr" && vd.LedgerID == 305).Sum(vd => vd.Amount));
            Assert.Equal(400m, voucher.VoucherDetails.Where(vd => vd.DrCr == "Cr" && vd.LedgerID == 115).Sum(vd => vd.Amount));
            Assert.Equal(986m, voucher.VoucherDetails.Where(vd => vd.DrCr == "Cr" && vd.LedgerID == 301).Sum(vd => vd.Amount));
            Assert.Equal(3464m, voucher.VoucherDetails.Where(vd => vd.DrCr == "Cr" && vd.LedgerID == 201).Sum(vd => vd.Amount));
        }

        [Fact]
        public async Task CollectLoanEmi_RejectsOverpaymentExceedingTotalDues_WithoutMutatingLoanOrSchedule()
        {
            using var context = GetInMemoryDbContext(nameof(CollectLoanEmi_RejectsOverpaymentExceedingTotalDues_WithoutMutatingLoanOrSchedule));
            var collDate = new DateTime(2026, 10, 31);

            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.Customers.Add(new Customer { CustomerID = 1, BranchID = 1, FirstName = "अमित", LastName = "शिंदे" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 5, AgentName = "एजंट पाच", BranchID = 1, MaxCashLimit = 100000m, MaxLockDays = 5, Status = "Active" });

            var rate = new LoanRate { LoanRateID = 1, LoanType = "कर्ज", InterestRate = 12m, InterestCalculationMethod = "Reducing" };
            context.LoanRates.Add(rate);

            var loan = new LoanAccount
            {
                LoanAccountID = 30,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 1,
                LoanRate = rate,
                LoanAccountNo = "LN-030",
                SanctionedAmount = 10000m,
                PrincipalBalance = 4000m,
                PurePrincipalBalance = 4000m,
                InterestBalance = 200m,
                OverdueInterestBalance = 0m,
                InterestRate = 12m,
                LastInstallmentPaidDate = collDate, // 0 current period interest => MaxPayable = 4200
                OpeningDate = collDate.AddMonths(-2),
                IsAgentCollectionAllowed = true,
                AssignedAgentID = 5,
                Status = "Active"
            };
            context.LoanAccounts.Add(loan);
            context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 1,
                LoanAccountID = 30,
                InstallmentNo = 1,
                DueDate = collDate,
                PrincipalAmount = 4000m,
                InterestAmount = 200m,
                TotalAmount = 4200m,
                Status = "Pending"
            });
            await context.SaveChangesAsync();

            var controller = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildAgentContext(5)
            };

            var res = await controller.CollectLoanEmi(new PigmyMobileApiController.CollectLoanEmiRequestDto
            {
                AgentId = 5,
                LoanAccountId = 30,
                Amount = 5000m, // Exceeds 4200 max payable
                PaymentMode = "CASH",
                CollectionDate = collDate,
                SyncReferenceId = Guid.NewGuid().ToString("N")
            });

            Assert.IsType<BadRequestObjectResult>(res);

            var unchangedLoan = await context.LoanAccounts.FirstAsync(l => l.LoanAccountID == 30);
            Assert.Equal(4000m, unchangedLoan.PrincipalBalance);
            Assert.Equal(200m, unchangedLoan.InterestBalance);
            Assert.Equal("Active", unchangedLoan.Status);
            Assert.Empty(await context.LoanCollections.ToListAsync());

            var unchangedSched = await context.LoanInstallmentSchedules.FirstAsync(s => s.ScheduleID == 1);
            Assert.Equal("Pending", unchangedSched.Status);
        }

        [Fact]
        public async Task CollectLoanEmi_PartialInterestPayment_CarriesForwardUnpaidCurrentInterest_AndDoesNotPrematurelyCloseWhenInterestRemains()
        {
            using var context = GetInMemoryDbContext(nameof(CollectLoanEmi_PartialInterestPayment_CarriesForwardUnpaidCurrentInterest_AndDoesNotPrematurelyCloseWhenInterestRemains));
            var collDate = DateTime.UtcNow.AddHours(5.5).Date;
            var startDate = collDate.AddDays(-30); // 30 days on 100000 @ 12% = 986 current interest

            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.Customers.Add(new Customer { CustomerID = 1, BranchID = 1, FirstName = "प्रवीण", LastName = "मोरे" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 5, AgentName = "एजंट पाच", BranchID = 1, MaxCashLimit = 100000m, MaxLockDays = 5, Status = "Active" });
            var rate = new LoanRate { LoanRateID = 1, LoanType = "कर्ज", InterestRate = 12m, InterestCalculationMethod = "Reducing" };
            context.LoanRates.Add(rate);

            // Case A: Partial current interest payment
            var loanA = new LoanAccount
            {
                LoanAccountID = 41,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 1,
                LoanRate = rate,
                LoanAccountNo = "LN-041",
                SanctionedAmount = 100000m,
                PrincipalBalance = 100000m,
                PurePrincipalBalance = 100000m,
                InterestBalance = 0m,
                InterestRate = 12m,
                OpeningDate = startDate,
                LoanDisbursementDate = startDate,
                IsAgentCollectionAllowed = true,
                AssignedAgentID = 5,
                Status = "Active"
            };

            // Case B: Principal already 0, only Receivable Interest = 500 remaining
            var loanB = new LoanAccount
            {
                LoanAccountID = 42,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 1,
                LoanRate = rate,
                LoanAccountNo = "LN-042",
                SanctionedAmount = 10000m,
                PrincipalBalance = 0m,
                PurePrincipalBalance = 0m,
                InterestBalance = 500m,
                OverdueInterestBalance = 0m,
                InterestRate = 12m,
                LastInstallmentPaidDate = collDate,
                OpeningDate = startDate,
                IsAgentCollectionAllowed = true,
                AssignedAgentID = 5,
                Status = "Active"
            };

            context.LoanAccounts.AddRange(loanA, loanB);
            await context.SaveChangesAsync();

            var controller = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildAgentContext(5)
            };

            // Sub-case A: Pay only 400 when 986 current interest is due => 586 carried to InterestBalance
            var resA = await controller.CollectLoanEmi(new PigmyMobileApiController.CollectLoanEmiRequestDto
            {
                AgentId = 5,
                LoanAccountId = 41,
                Amount = 400m,
                PaymentMode = "CASH",
                CollectionDate = collDate,
                SyncReferenceId = Guid.NewGuid().ToString("N")
            });
            Assert.IsType<OkObjectResult>(resA);

            var updatedLoanA = await context.LoanAccounts.FirstAsync(l => l.LoanAccountID == 41);
            var colA = await context.LoanCollections.FirstAsync(c => c.LoanAccountID == 41);
            Assert.Equal(400m, colA.InterestCollected);
            Assert.Equal(0m, colA.PrincipalCollected);
            Assert.Equal(586m, updatedLoanA.InterestBalance);
            Assert.Equal(100000m, updatedLoanA.PrincipalBalance);
            Assert.Equal("Active", updatedLoanA.Status);

            // Sub-case B1: Pay 200 of 500 receivable interest when principal is 0 => must stay Active!
            var resB1 = await controller.CollectLoanEmi(new PigmyMobileApiController.CollectLoanEmiRequestDto
            {
                AgentId = 5,
                LoanAccountId = 42,
                Amount = 200m,
                PaymentMode = "CASH",
                CollectionDate = collDate,
                SyncReferenceId = Guid.NewGuid().ToString("N")
            });
            Assert.IsType<OkObjectResult>(resB1);

            var updatedLoanB1 = await context.LoanAccounts.FirstAsync(l => l.LoanAccountID == 42);
            var colB1 = await context.LoanCollections.FirstAsync(c => c.LoanAccountID == 42);
            Assert.Equal(200m, colB1.ReceivableInterestCollected);
            Assert.Equal(300m, updatedLoanB1.InterestBalance);
            Assert.Equal("Active", updatedLoanB1.Status);

            // Sub-case B2: Pay final 300 => all balances zero => Closed!
            var resB2 = await controller.CollectLoanEmi(new PigmyMobileApiController.CollectLoanEmiRequestDto
            {
                AgentId = 5,
                LoanAccountId = 42,
                Amount = 300m,
                PaymentMode = "CASH",
                CollectionDate = collDate,
                SyncReferenceId = Guid.NewGuid().ToString("N")
            });
            Assert.IsType<OkObjectResult>(resB2);

            var updatedLoanB2 = await context.LoanAccounts.FirstAsync(l => l.LoanAccountID == 42);
            Assert.Equal(0m, updatedLoanB2.InterestBalance);
            Assert.Equal("Closed", updatedLoanB2.Status);
        }

        [Fact]
        public async Task CollectLoanEmi_MigratedOpeningBalanceLoan_FullSettlementMarksAllSchedulesPaidAndClosesLoan()
        {
            using var context = GetInMemoryDbContext(nameof(CollectLoanEmi_MigratedOpeningBalanceLoan_FullSettlementMarksAllSchedulesPaidAndClosesLoan));
            var collDate = DateTime.UtcNow.AddHours(5.5).Date;
            var openingDate = collDate.AddMonths(-6);

            context.Branches.Add(new Branch { BranchID = 1, BranchName = "Main" });
            context.Customers.Add(new Customer { CustomerID = 1, BranchID = 1, FirstName = "विजय", LastName = "जाधव" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 5, AgentName = "एजंट पाच", BranchID = 1, MaxCashLimit = 100000m, MaxLockDays = 5, Status = "Active" });
            var rate = new LoanRate { LoanRateID = 1, LoanType = "कर्ज", InterestRate = 12m, InterestCalculationMethod = "Reducing" };
            context.LoanRates.Add(rate);

            var loan = new LoanAccount
            {
                LoanAccountID = 50,
                BranchID = 1,
                CustomerID = 1,
                LoanRateID = 1,
                LoanRate = rate,
                LoanAccountNo = "LN-OB-50",
                IsOpeningBalance = true,
                SanctionedAmount = 100000m,
                PrincipalBalance = 20000m, // 80,000 paid before software migration
                PurePrincipalBalance = 20000m,
                InterestBalance = 0m,
                OverdueInterestBalance = 0m,
                InterestRate = 12m,
                OpeningDate = openingDate,
                LastInstallmentPaidDate = collDate, // 0 days extra interest on collDate for exact principal test
                IsAgentCollectionAllowed = true,
                AssignedAgentID = 5,
                Status = "Active"
            };
            context.LoanAccounts.Add(loan);

            for (int i = 1; i <= 10; i++)
            {
                var dueDate = i <= 8
                    ? openingDate.AddMonths(-(9 - i))
                    : openingDate.AddMonths(i - 8);
                context.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
                {
                    LoanAccountID = 50,
                    InstallmentNo = i,
                    DueDate = dueDate,
                    PrincipalAmount = 10000m,
                    InterestAmount = 0m,
                    TotalAmount = 10000m,
                    Status = i <= 8 ? "Paid" : "Pending",
                    PaidDate = i <= 8 ? openingDate : (DateTime?)null
                });
            }
            await context.SaveChangesAsync();

            var controller = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildAgentContext(5)
            };

            // Step 1: Collect 10000 (9th installment); Verify only 9 paid (NOT 10 — proves no double-counting)
            var res1 = await controller.CollectLoanEmi(new PigmyMobileApiController.CollectLoanEmiRequestDto
            {
                AgentId = 5,
                LoanAccountId = 50,
                Amount = 10000m,
                PaymentMode = "CASH",
                CollectionDate = collDate,
                SyncReferenceId = Guid.NewGuid().ToString("N")
            });
            Assert.IsType<OkObjectResult>(res1);

            var schedAfterFirst = await context.LoanInstallmentSchedules
                .Where(s => s.LoanAccountID == 50)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();
            Assert.Equal(9, schedAfterFirst.Count(s => s.Status == "Paid"));
            Assert.Equal("Paid", schedAfterFirst.First(s => s.InstallmentNo == 9).Status);
            Assert.NotEqual("Paid", schedAfterFirst.First(s => s.InstallmentNo == 10).Status);

            // Step 2: Collect remaining 10000 (10th installment); Principal hits 0 => All 10 Paid & Loan Closed
            var res2 = await controller.CollectLoanEmi(new PigmyMobileApiController.CollectLoanEmiRequestDto
            {
                AgentId = 5,
                LoanAccountId = 50,
                Amount = 10000m,
                PaymentMode = "CASH",
                CollectionDate = collDate,
                SyncReferenceId = Guid.NewGuid().ToString("N")
            });
            Assert.IsType<OkObjectResult>(res2);

            var finalLoan = await context.LoanAccounts.FirstAsync(l => l.LoanAccountID == 50);
            Assert.Equal(0m, finalLoan.PrincipalBalance);
            Assert.Equal(0m, finalLoan.InterestBalance);
            Assert.Equal("Closed", finalLoan.Status);

            var schedAfterSecond = await context.LoanInstallmentSchedules
                .Where(s => s.LoanAccountID == 50)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();
            Assert.Equal(10, schedAfterSecond.Count(s => s.Status == "Paid"));
        }
    }
}

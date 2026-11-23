using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class PigmyWithdrawalAndClosureSettlementTests
    {
        private static AppDbContext CreateDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static void AttachUser(ControllerBase controller, int userId = 10, int branchId = 1, string role = "BranchManager", bool isHo = false)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim("UserID", userId.ToString()),
                new Claim(ClaimTypes.Name, $"user_{userId}"),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("IsHeadOffice", isHo ? "true" : "false")
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(identity)
                }
            };
        }

        private static async Task<(
            Branch branch,
            Ledger cashLedger,
            Ledger bankLedger,
            Ledger pigmyLiabLedger,
            Ledger intExpLedger,
            Ledger intPayLedger,
            Ledger customDeductionLedger,
            Ledger savingLiabLedger,
            Customer customer,
            PigmyAgent agent)> SeedCoreAccountingAsync(AppDbContext db)
        {
            var branch = new Branch
            {
                BranchID = 1,
                BranchCode = "HO",
                BranchName = "मुख्य शाखा",
                BranchType = "HeadOffice",
                DefaultCashLedgerID = 101,
                IsActive = true
            };
            db.Branches.Add(branch);

            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = new DateTime(2026, 11, 20),
                IsDayClosed = false
            });

            var assetGroup = new AccountGroup { GroupID = 1, GroupName = "रोकड व बँक", NatureOfGroup = "Assets" };
            var liabGroup = new AccountGroup { GroupID = 2, GroupName = "ठेवी देयता", NatureOfGroup = "Liabilities" };
            var incGroup = new AccountGroup { GroupID = 3, GroupName = "विविध उत्पन्न", NatureOfGroup = "Income" };
            var expGroup = new AccountGroup { GroupID = 4, GroupName = "व्याज व कमिशन खर्च", NatureOfGroup = "Expenses" };
            db.AccountGroups.AddRange(assetGroup, liabGroup, incGroup, expGroup);

            var cashLedger = new Ledger
            {
                LedgerID = 101,
                LedgerName = "रोख शिल्लक (Cash In Hand)",
                GroupID = 1,
                AccountGroup = assetGroup,
                AccountType = "Cash In Hand",
                IsActive = true
            };
            var bankLedger = new Ledger
            {
                LedgerID = 102,
                LedgerName = "जिल्हा मध्यवर्ती बँक चालू खाते",
                GroupID = 1,
                AccountGroup = assetGroup,
                AccountType = "Bank Account",
                IsActive = true
            };
            var pigmyLiabLedger = new Ledger
            {
                LedgerID = 201,
                LedgerName = "दैनंदिन पिग्मी ठेव देयता खाते",
                GroupID = 2,
                AccountGroup = liabGroup,
                AccountType = "Liabilities",
                IsActive = true
            };
            var intPayLedger = new Ledger
            {
                LedgerID = 202,
                LedgerName = "पिग्मी देणे व्याज तरतूद खाते",
                GroupID = 2,
                AccountGroup = liabGroup,
                AccountType = "Liabilities",
                IsActive = true
            };
            var savingLiabLedger = new Ledger
            {
                LedgerID = 203,
                LedgerName = "बचत ठेव देयता खाते",
                GroupID = 2,
                AccountGroup = liabGroup,
                AccountType = "Savings",
                IsActive = true
            };
            // Notice: Name does NOT match any old hardcoded "दंड" / "Penalty" strings — proves 100% dynamic lookup!
            var customDeductionLedger = new Ledger
            {
                LedgerID = 301,
                LedgerName = "विशेष मुदतपूर्व कमिशन वसुली निधी २०२६",
                GroupID = 3,
                AccountGroup = incGroup,
                AccountType = "Income",
                IsActive = true
            };
            // Decoy Income ledger that old fuzzy logic would have accidentally grabbed!
            var decoyOtherIncome = new Ledger
            {
                LedgerID = 399,
                LedgerName = "इतर उत्पन्न (Decoy Fuzzy Ledger)",
                GroupID = 3,
                AccountGroup = incGroup,
                AccountType = "Income",
                IsActive = true
            };
            var intExpLedger = new Ledger
            {
                LedgerID = 401,
                LedgerName = "पिग्मी व्याज खर्च खाते",
                GroupID = 4,
                AccountGroup = expGroup,
                AccountType = "Expenses",
                IsActive = true
            };

            db.Ledgers.AddRange(
                cashLedger,
                bankLedger,
                pigmyLiabLedger,
                intPayLedger,
                savingLiabLedger,
                customDeductionLedger,
                decoyOtherIncome,
                intExpLedger);

            db.VoucherMappings.Add(new VoucherMapping
            {
                TransactionType = "PIGMY",
                DebitLedgerID = cashLedger.LedgerID,
                CreditLedgerID = pigmyLiabLedger.LedgerID
            });

            var customer = new Customer
            {
                CustomerID = 1,
                BranchID = 1,
                CIFNo = "CIF0001",
                FirstName = "राजेश",
                MiddleName = "शंकर",
                LastName = "पाटील",
                MobileNo = "9876543210",
                Status = "Active"
            };
            db.Customers.Add(customer);

            var agent = new PigmyAgent
            {
                PigmyAgentID = 1,
                BranchID = 1,
                AgentName = "संतोष जाधव",
                Username = "ag01",
                PasswordHash = "hash",
                Status = "Active"
            };
            db.PigmyAgents.Add(agent);

            await db.SaveChangesAsync();
            return (branch, cashLedger, bankLedger, pigmyLiabLedger, intExpLedger, intPayLedger, customDeductionLedger, savingLiabLedger, customer, agent);
        }

        [Fact]
        public async Task DynamicDeductionLedger_EnforcedWithoutHardcoding_AndPostsExactSelectedLedger()
        {
            using var db = CreateDbContext(nameof(DynamicDeductionLedger_EnforcedWithoutHardcoding_AndPostsExactSelectedLedger));
            var seed = await SeedCoreAccountingAsync(db);

            // Scheme initially has NO PrematureDeductionLedgerID mapped
            var scheme = new PigmyScheme
            {
                PigmySchemeID = 1,
                SchemeCode = "PG12",
                SchemeName = "१२ महिने दैनिक ठेव",
                DurationMonths = 12,
                InterestRate = 6.0m,
                PrematureInterestRate = 4.0m,
                PenaltyInterestRate = 3.0m,
                PigmyLiabilityLedgerID = seed.pigmyLiabLedger.LedgerID,
                InterestExpenseLedgerID = seed.intExpLedger.LedgerID,
                InterestPayableLedgerID = seed.intPayLedger.LedgerID,
                PrematureDeductionLedgerID = null,
                Status = "Active",
                Slabs = new List<PigmySchemeInterestSlab>
                {
                    new PigmySchemeInterestSlab { SlabID = 1, FromDays = 0, ToDays = 90, PenaltyRate = 3.0m, InterestRate = 0m, IsActive = true }
                }
            };
            db.PigmySchemes.Add(scheme);

            var account = new PigmyAccount
            {
                PigmyAccountID = 1,
                AccountNo = "PG-1001",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                PigmySchemeID = scheme.PigmySchemeID,
                PigmyAgentID = seed.agent.PigmyAgentID,
                OpeningDate = new DateTime(2026, 10, 1),
                EffectiveStartDate = new DateTime(2026, 10, 1), // 50 days elapsed on 2026-11-20 -> 3% deduction = ₹300
                MaturityDate = new DateTime(2027, 10, 1),
                TotalDepositedAmount = 10000m,
                Status = "Active"
            };
            db.PigmyAccounts.Add(account);
            await db.SaveChangesAsync();

            var controller = new PigmyClosureController(db);
            AttachUser(controller, userId: 25, branchId: 1);

            // 1. Attempt closure WITHOUT DeductionLedgerId -> MUST fail (proves decoy "इतर उत्पन्न" is NOT grabbed!)
            var missingLedgerRes = await controller.CloseAccount(new PigmyClosureController.ClosureRequest
            {
                AccountNo = "PG-1001",
                BranchId = 1,
                ClosureDate = new DateTime(2026, 11, 20),
                PaymentMode = "Cash"
            });
            Assert.IsType<BadRequestObjectResult>(missingLedgerRes);
            Assert.Equal("Active", (await db.PigmyAccounts.FindAsync(1))!.Status);

            // 2. Attempt closure passing Bank Ledger as DeductionLedgerId -> MUST fail guard!
            var invalidCashBankRes = await controller.CloseAccount(new PigmyClosureController.ClosureRequest
            {
                AccountNo = "PG-1001",
                BranchId = 1,
                ClosureDate = new DateTime(2026, 11, 20),
                PaymentMode = "Cash",
                DeductionLedgerId = seed.bankLedger.LedgerID
            });
            Assert.IsType<BadRequestObjectResult>(invalidCashBankRes);

            // 3. Pass dynamic custom DeductionLedgerId + custom edited commission deduction (₹350 instead of ₹300)
            var okRes = await controller.CloseAccount(new PigmyClosureController.ClosureRequest
            {
                AccountNo = "PG-1001",
                BranchId = 1,
                ClosureDate = new DateTime(2026, 11, 20),
                PaymentMode = "Cash",
                CustomPenaltyAmount = 350m,
                DeductionLedgerId = seed.customDeductionLedger.LedgerID,
                OverrideReason = "एजंट कमिशन ३.५% प्रमाणे कपात"
            });
            Assert.IsType<OkObjectResult>(okRes);

            var closedAcc = await db.PigmyAccounts.FindAsync(1);
            Assert.Equal("Closed", closedAcc!.Status);
            Assert.Equal(0m, closedAcc.TotalDepositedAmount);

            var closureRow = await db.PigmyAccountClosures.SingleAsync();
            Assert.Equal(10000m, closureRow.GrossDepositBalance);
            Assert.Equal(350m, closureRow.CommissionOrPenaltyAmount);
            Assert.Equal(seed.customDeductionLedger.LedgerID, closureRow.DeductionLedgerID);
            Assert.Equal(9650m, closureRow.NetPayableAmount);
            Assert.Equal(25, closureRow.CreatedBy); // Real Maker ID, not hardcoded 1!

            var voucher = await db.Vouchers.Include(v => v.VoucherDetails).SingleAsync(v => v.VoucherID == closureRow.VoucherID);
            Assert.Equal("Pending", voucher.Status);
            Assert.Equal(25, voucher.CreatedBy);
            Assert.Contains(voucher.VoucherDetails, vd => vd.DrCr == "Dr" && vd.LedgerID == seed.pigmyLiabLedger.LedgerID && vd.Amount == 10000m);
            Assert.Contains(voucher.VoucherDetails, vd => vd.DrCr == "Cr" && vd.LedgerID == seed.customDeductionLedger.LedgerID && vd.Amount == 350m);
            Assert.Contains(voucher.VoucherDetails, vd => vd.DrCr == "Cr" && vd.LedgerID == seed.cashLedger.LedgerID && vd.Amount == 9650m);
        }

        [Fact]
        public async Task DoubleInterestGuard_DeductsAlreadyCapitalizedInterestOnClosure()
        {
            using var db = CreateDbContext(nameof(DoubleInterestGuard_DeductsAlreadyCapitalizedInterestOnClosure));
            var seed = await SeedCoreAccountingAsync(db);

            var scheme = new PigmyScheme
            {
                PigmySchemeID = 2,
                SchemeCode = "PG-MAT",
                SchemeName = "मुदत पूर्ण पिग्मी योजना",
                DurationMonths = 12,
                InterestRate = 6.0m,
                PrematureInterestRate = 4.0m,
                PenaltyInterestRate = 2.0m,
                PigmyLiabilityLedgerID = seed.pigmyLiabLedger.LedgerID,
                InterestExpenseLedgerID = seed.intExpLedger.LedgerID,
                PrematureDeductionLedgerID = seed.customDeductionLedger.LedgerID,
                Status = "Active",
                Slabs = new List<PigmySchemeInterestSlab>
                {
                    new PigmySchemeInterestSlab { SlabID = 2, FromDays = 336, ToDays = 365, PenaltyRate = 0m, InterestRate = 6.0m, IsActive = true }
                }
            };
            db.PigmySchemes.Add(scheme);

            // Customer deposited ₹10,000 principal + ₹200 half-yearly interest already capitalized into TotalDepositedAmount = ₹10,200
            var account = new PigmyAccount
            {
                PigmyAccountID = 2,
                AccountNo = "PG-2002",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                PigmySchemeID = scheme.PigmySchemeID,
                PigmyAgentID = seed.agent.PigmyAgentID,
                OpeningDate = new DateTime(2025, 11, 15),
                EffectiveStartDate = new DateTime(2025, 11, 15),
                MaturityDate = new DateTime(2026, 11, 15),
                TotalDepositedAmount = 10200m,
                Status = "Active"
            };
            db.PigmyAccounts.Add(account);

            db.PigmyInterestLogs.Add(new PigmyInterestLog
            {
                LogId = 1,
                PigmyAccountId = account.PigmyAccountID,
                CalculationDate = new DateTime(2026, 5, 15),
                PeriodStartDate = new DateTime(2025, 11, 15),
                PeriodEndDate = new DateTime(2026, 5, 15),
                InterestAmount = 200m,
                Status = "POSTED"
            });
            await db.SaveChangesAsync();

            var controller = new PigmyClosureController(db);
            AttachUser(controller, userId: 15, branchId: 1);

            var previewAction = await controller.PreviewClosure("PG-2002");
            var okPreview = Assert.IsType<OkObjectResult>(previewAction.Result);
            var preview = Assert.IsType<PigmyClosureController.ClosurePreviewResult>(okPreview.Value);

            // Principal = 10,200 - 200 = 10,000. 6% of 10,000 = 600 total interest.
            // Since ₹200 is already inside TotalDepositedAmount (10,200), additional interest must be ₹400, NetPayable = ₹10,600!
            Assert.Equal(200m, preview.AlreadyCapitalizedInterest);
            Assert.Equal(600m, preview.GrossSlabInterestAmount);
            Assert.Equal(400m, preview.PrematureInterestAmount);
            Assert.Equal(10600m, preview.NetPayable);
        }

        [Fact]
        public async Task SavingTransferMode_DefersCreditUntilCheckerApproval_AndReversesOnUnpass()
        {
            using var db = CreateDbContext(nameof(SavingTransferMode_DefersCreditUntilCheckerApproval_AndReversesOnUnpass));
            var seed = await SeedCoreAccountingAsync(db);

            var scheme = new PigmyScheme
            {
                PigmySchemeID = 3,
                SchemeCode = "PG-SB",
                SchemeName = "पिग्मी योजना",
                DurationMonths = 12,
                InterestRate = 6.0m,
                PigmyLiabilityLedgerID = seed.pigmyLiabLedger.LedgerID,
                InterestExpenseLedgerID = seed.intExpLedger.LedgerID,
                PrematureDeductionLedgerID = seed.customDeductionLedger.LedgerID,
                Status = "Active",
                Slabs = new List<PigmySchemeInterestSlab>
                {
                    new PigmySchemeInterestSlab { SlabID = 3, FromDays = 91, ToDays = 180, PenaltyRate = 0m, InterestRate = 0m, IsActive = true }
                }
            };
            db.PigmySchemes.Add(scheme);

            var savingAcc = new SavingAccountMaster
            {
                SavingAccountID = 50,
                AccountNo = "SB-5001",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                LedgerID = seed.savingLiabLedger.LedgerID,
                OpeningDate = new DateTime(2025, 1, 1),
                CurrentBalance = 1000m,
                Status = "Active"
            };
            db.SavingAccountMasters.Add(savingAcc);

            var pigmyAcc = new PigmyAccount
            {
                PigmyAccountID = 3,
                AccountNo = "PG-3003",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                PigmySchemeID = scheme.PigmySchemeID,
                PigmyAgentID = seed.agent.PigmyAgentID,
                OpeningDate = new DateTime(2026, 7, 1),
                EffectiveStartDate = new DateTime(2026, 7, 1), // ~142 days -> 0% penalty, 0% interest
                MaturityDate = new DateTime(2027, 7, 1),
                TotalDepositedAmount = 8000m,
                Status = "Active"
            };
            db.PigmyAccounts.Add(pigmyAcc);
            await db.SaveChangesAsync();

            var controller = new PigmyClosureController(db);
            AttachUser(controller, userId: 11, branchId: 1);

            var wdrRes = await controller.WithdrawAmount(new PigmyClosureController.WithdrawalRequest
            {
                AccountNo = "PG-3003",
                Amount = 3000m,
                BranchId = 1,
                WithdrawalDate = new DateTime(2026, 11, 20),
                PaymentMode = "Saving Transfer",
                SavingAccountId = savingAcc.SavingAccountID
            });
            Assert.IsType<OkObjectResult>(wdrRes);

            // 1. Before Checker Approval: Saving Account MUST still be ₹1,000!
            var sbBeforeApprove = await db.SavingAccountMasters.FindAsync(50);
            Assert.Equal(1000m, sbBeforeApprove!.CurrentBalance);
            Assert.Empty(await db.SavingTransactions.ToListAsync());

            // 2. Checker Approves Voucher via VoucherPostingController
            var voucher = await db.Vouchers.SingleAsync();
            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var postingController = new VoucherPostingController(db, rollbackSvc);
            AttachUser(postingController, userId: 99, branchId: 1, role: "Admin", isHo: true);

            var postRes = await postingController.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                ApprovedBy = 99,
                BusinessDate = new DateTime(2026, 11, 20)
            });
            Assert.IsType<OkObjectResult>(postRes);

            var sbAfterApprove = await db.SavingAccountMasters.FindAsync(50);
            Assert.Equal(4000m, sbAfterApprove!.CurrentBalance);
            Assert.Single(await db.SavingTransactions.Where(t => t.VoucherNo == voucher.VoucherNo).ToListAsync());

            // 3. Unpass Voucher via VoucherPostingController -> Saving credit MUST reverse cleanly back to ₹1,000!
            var unpassRes = await postingController.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { voucher.VoucherID },
                Reason = "तपासणीसाठी अन-पास"
            });
            Assert.IsType<OkObjectResult>(unpassRes);
            var sbAfterUnpass = await db.SavingAccountMasters.FindAsync(50);
            Assert.Equal(1000m, sbAfterUnpass!.CurrentBalance);
            Assert.Empty(await db.SavingTransactions.Where(t => t.VoucherNo == voucher.VoucherNo).ToListAsync());
        }

        [Fact]
        public async Task DirectLienClosure_AdjustInLoanWaterfall_PassingPreview_AndLosslessRollback()
        {
            using var db = CreateDbContext(nameof(DirectLienClosure_AdjustInLoanWaterfall_PassingPreview_AndLosslessRollback));
            var seed = await SeedCoreAccountingAsync(db);

            var loanAssetLedger = new Ledger { LedgerID = 501, LedgerName = "तारण कर्ज मुद्दल लेजर", GroupID = 1, AccountType = "Assets", IsActive = true };
            var loanIntLedger = new Ledger { LedgerID = 502, LedgerName = "कर्ज व्याज उत्पन्न लेजर", GroupID = 3, AccountType = "Income", IsActive = true };
            var loanPenLedger = new Ledger { LedgerID = 503, LedgerName = "कर्ज दंड व्याज उत्पन्न लेजर", GroupID = 3, AccountType = "Income", IsActive = true };
            db.Ledgers.AddRange(loanAssetLedger, loanIntLedger, loanPenLedger);

            var loanRate = new LoanRate
            {
                LoanRateID = 1,
                LoanType = "पिग्मी तारण कर्ज",
                InterestRate = 12m,
                InterestCalculationMethod = "Flat",
                LoanLedgerID = loanAssetLedger.LedgerID,
                InterestLedgerID = loanIntLedger.LedgerID,
                OverdueInterestLedgerID = loanPenLedger.LedgerID
            };
            db.LoanRates.Add(loanRate);

            var loan = new LoanAccount
            {
                LoanAccountID = 77,
                LoanAccountNo = "LN-PG-77",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                LoanRateID = loanRate.LoanRateID,
                SanctionedAmount = 10000m,
                PrincipalBalance = 10000m,
                InterestBalance = 500m,
                OverdueInterestBalance = 200m,
                InterestRate = 12m,
                OpeningDate = new DateTime(2026, 4, 1),
                LastInterestPostingDate = new DateTime(2026, 11, 20),
                Status = "Active"
            };
            db.LoanAccounts.Add(loan);

            var scheme = new PigmyScheme
            {
                PigmySchemeID = 4,
                SchemeCode = "PG-LIEN",
                SchemeName = "तारण पिग्मी योजना",
                DurationMonths = 12,
                InterestRate = 6.0m,
                PigmyLiabilityLedgerID = seed.pigmyLiabLedger.LedgerID,
                InterestExpenseLedgerID = seed.intExpLedger.LedgerID,
                PrematureDeductionLedgerID = seed.customDeductionLedger.LedgerID,
                Status = "Active",
                Slabs = new List<PigmySchemeInterestSlab>
                {
                    new PigmySchemeInterestSlab { SlabID = 4, FromDays = 91, ToDays = 365, PenaltyRate = 0m, InterestRate = 0m, IsActive = true }
                }
            };
            db.PigmySchemes.Add(scheme);

            var pigmy = new PigmyAccount
            {
                PigmyAccountID = 4,
                AccountNo = "PG-4004",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                PigmySchemeID = scheme.PigmySchemeID,
                PigmyAgentID = seed.agent.PigmyAgentID,
                OpeningDate = new DateTime(2026, 3, 1),
                EffectiveStartDate = new DateTime(2026, 3, 1),
                MaturityDate = new DateTime(2027, 3, 1),
                TotalDepositedAmount = 15000m,
                IsLienMarked = true,
                LienLoanAccountNo = "LN-PG-77",
                LienAmount = 12000m,
                Status = "Active"
            };
            db.PigmyAccounts.Add(pigmy);

            var collateral = new LoanDepositCollateral
            {
                CollateralID = 1,
                LoanAccountID = loan.LoanAccountID,
                CustomerID = seed.customer.CustomerID,
                CollateralType = "PigmyDeposit",
                DepositAccountID = pigmy.PigmyAccountID,
                DepositAccountNo = pigmy.AccountNo,
                DepositAmount = 15000m,
                LienAmount = 12000m,
                CurrentDepositBalance = 15000m,
                LienStatus = "Pledged"
            };
            db.LoanDepositCollaterals.Add(collateral);
            await db.SaveChangesAsync();

            var controller = new PigmyClosureController(db);
            AttachUser(controller, userId: 30, branchId: 1);

            // 1. Cash closure on liened account MUST fail
            var blockedCashRes = await controller.CloseAccount(new PigmyClosureController.ClosureRequest
            {
                AccountNo = "PG-4004",
                BranchId = 1,
                ClosureDate = new DateTime(2026, 11, 20),
                PaymentMode = "Cash",
                ManagerOverrideConfirmed = true
            });
            Assert.IsType<BadRequestObjectResult>(blockedCashRes);

            // 2. Close with Adjust in Loan + Cash surplus (₹15,000 -> ₹10,700 loan + ₹4,300 Cash surplus)
            var closeRes = await controller.CloseAccount(new PigmyClosureController.ClosureRequest
            {
                AccountNo = "PG-4004",
                BranchId = 1,
                ClosureDate = new DateTime(2026, 11, 20),
                PaymentMode = "Adjust in Loan",
                AdjustInLoan = true,
                TargetLoanAccountId = loan.LoanAccountID,
                SurplusPaymentMode = "Cash"
            });
            Assert.IsType<OkObjectResult>(closeRes);

            var updatedLoan = await db.LoanAccounts.FindAsync(77);
            Assert.Equal("Closed", updatedLoan!.Status);
            Assert.Equal(0m, updatedLoan.PrincipalBalance);
            Assert.Equal(0m, updatedLoan.InterestBalance);
            Assert.Equal(0m, updatedLoan.OverdueInterestBalance);

            var updatedPigmy = await db.PigmyAccounts.FindAsync(4);
            Assert.Equal("Closed", updatedPigmy!.Status);
            Assert.False(updatedPigmy.IsLienMarked);
            Assert.Equal("Released", (await db.LoanDepositCollaterals.FindAsync(1))!.LienStatus);

            var closureSnap = await db.PigmyAccountClosures.SingleAsync();
            Assert.Equal(10700m, closureSnap.LoanAdjustedAmount);
            Assert.Equal(4300m, closureSnap.SurplusPayoutAmount);

            // 3. Checker Passing Inspection (by-voucher/{voucherId}) MUST succeed on closed account!
            var byVoucherRes = await controller.GetClosureByVoucher(closureSnap.VoucherID!.Value);
            Assert.IsType<OkObjectResult>(byVoucherRes);

            // 4. Reject / Delete Voucher -> Lossless Rollback of Loan, Lien, Collateral, and Pigmy Account!
            var rollbackService = new VoucherRollbackAndDeleteService(db);
            var delResult = await rollbackService.DeleteVoucherWithRollbackAsync(
                closureSnap.VoucherID.Value,
                new VoucherDeleteRequestContext
                {
                    UserId = 99,
                    Username = "checker",
                    UserRole = "Admin",
                    UserBranchId = 1,
                    IsHeadOfficeAdmin = true,
                    Reason = "चुकून क्लोजर नोंदवले गेले",
                    ActionSource = "TEST_REJECT",
                    RequireMinTenCharReason = false
                });
            Assert.True(delResult.Success, delResult.Message);

            var reopenedPigmy = await db.PigmyAccounts.FindAsync(4);
            Assert.Equal("Active", reopenedPigmy!.Status);
            Assert.Equal(15000m, reopenedPigmy.TotalDepositedAmount);
            Assert.True(reopenedPigmy.IsLienMarked);
            Assert.Equal("LN-PG-77", reopenedPigmy.LienLoanAccountNo);

            var restoredCollateral = await db.LoanDepositCollaterals.FindAsync(1);
            Assert.Equal("Pledged", restoredCollateral!.LienStatus);
            Assert.Equal(15000m, restoredCollateral.CurrentDepositBalance);

            var reopenedLoan = await db.LoanAccounts.FindAsync(77);
            Assert.Equal("Active", reopenedLoan!.Status);
            Assert.Equal(10000m, reopenedLoan.PrincipalBalance);
            Assert.Equal(500m, reopenedLoan.InterestBalance);
            Assert.Equal(200m, reopenedLoan.OverdueInterestBalance);
            Assert.Empty(await db.LoanCollections.ToListAsync());
            Assert.Empty(await db.PigmyAccountClosures.ToListAsync());
        }

        [Fact]
        public async Task AgentCommission_DeductsPrematureWithdrawalsWithinLockInPeriod()
        {
            using var db = CreateDbContext(nameof(AgentCommission_DeductsPrematureWithdrawalsWithinLockInPeriod));
            var seed = await SeedCoreAccountingAsync(db);

            var scheme = new PigmyScheme
            {
                PigmySchemeID = 5,
                SchemeCode = "PG-COMM",
                SchemeName = "कमिशन योजना",
                DurationMonths = 12,
                InterestRate = 6m,
                PigmyLiabilityLedgerID = seed.pigmyLiabLedger.LedgerID,
                Status = "Active"
            };
            db.PigmySchemes.Add(scheme);

            var accEarly = new PigmyAccount
            {
                PigmyAccountID = 51,
                AccountNo = "PG-5001",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                PigmySchemeID = 5,
                PigmyAgentID = seed.agent.PigmyAgentID,
                OpeningDate = new DateTime(2026, 10, 1),
                MaturityDate = new DateTime(2027, 10, 1),
                Status = "Active"
            };
            var accSeasoned = new PigmyAccount
            {
                PigmyAccountID = 52,
                AccountNo = "PG-5002",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                PigmySchemeID = 5,
                PigmyAgentID = seed.agent.PigmyAgentID,
                OpeningDate = new DateTime(2026, 2, 1),
                MaturityDate = new DateTime(2027, 2, 1),
                Status = "Active"
            };
            db.PigmyAccounts.AddRange(accEarly, accSeasoned);

            db.PigmyCommissionSettings.Add(new PigmyCommissionSetting
            {
                SettingId = 1,
                AgentId = seed.agent.PigmyAgentID,
                ProductType = "PIGMY",
                CommissionType = "PERCENTAGE",
                CommissionValue = 3.0m,
                CalculationFrequency = "MONTHLY",
                DeductPrematureWithdrawals = true,
                PrematureLockInDays = 180,
                IsActive = true
            });

            // Gross collection in Nov 2026 = ₹20,000
            db.PigmyCollections.Add(new PigmyCollection
            {
                CollectionId = 1,
                PigmyAccountId = 51,
                AgentId = seed.agent.PigmyAgentID,
                CollectionDate = new DateTime(2026, 11, 10),
                CollectionAmount = 20000m,
                ClosingBalance = 20000m,
                ReceiptNo = "RCP-1"
            });

            // Premature withdrawal within 180 days (45 days) = ₹5,000 -> MUST be deducted from eligible collection!
            db.PigmyWithdrawals.Add(new PigmyWithdrawal
            {
                WithdrawalID = 1,
                PigmyAccountID = 51,
                WithdrawalDate = new DateTime(2026, 11, 15),
                CycleNumber = 1,
                CycleStartSnapshot = new DateTime(2026, 10, 1),
                ElapsedDays = 45,
                RequestedAmount = 5000m,
                NetPaidAmount = 4900m,
                RemainingBalance = 15000m
            });

            // Seasoned withdrawal after 180 days (220 days) = ₹3,000 -> MUST NOT be deducted!
            db.PigmyWithdrawals.Add(new PigmyWithdrawal
            {
                WithdrawalID = 2,
                PigmyAccountID = 52,
                WithdrawalDate = new DateTime(2026, 11, 16),
                CycleNumber = 1,
                CycleStartSnapshot = new DateTime(2026, 4, 1),
                ElapsedDays = 220,
                RequestedAmount = 3000m,
                NetPaidAmount = 3000m,
                RemainingBalance = 7000m
            });

            await db.SaveChangesAsync();

            var commController = new AgentCommissionController(db);
            var calcRes = await commController.Calculate(new AgentCommissionController.CalculateRequest
            {
                FromDate = new DateTime(2026, 11, 1),
                ToDate = new DateTime(2026, 11, 30),
                Frequency = "MONTHLY",
                AgentId = seed.agent.PigmyAgentID,
                ProductType = "PIGMY"
            });
            Assert.IsType<OkObjectResult>(calcRes);

            var pendingRow = await db.PigmyAgentCommissions.SingleAsync();
            Assert.Equal(15000m, pendingRow.TotalCollectionAmount); // 20,000 - 5,000
            Assert.Equal(450m, pendingRow.CalculatedCommission);    // 3% of 15,000
        }

        [Fact]
        public async Task SchemeMappedLedgers_AutoResolveWithoutManualIds_AndSchemeSaveRequiresPenaltyLedger()
        {
            using var db = CreateDbContext(nameof(SchemeMappedLedgers_AutoResolveWithoutManualIds_AndSchemeSaveRequiresPenaltyLedger));
            var seed = await SeedCoreAccountingAsync(db);

            // 1. PigmySchemesController MUST block saving a scheme with PenaltyRate > 0 when PrematureDeductionLedgerID is missing
            var schemesCtrl = new PigmySchemesController(db);
            AttachUser(schemesCtrl, userId: 1, branchId: 1, role: "Admin", isHo: true);

            var invalidSchemeRes = await schemesCtrl.PostPigmyScheme(new PigmyScheme
            {
                SchemeCode = "PG-BAD",
                SchemeName = "कमिशन कपात लेजर नसलेली योजना",
                InterestRate = 6.0m,
                DurationMonths = 12,
                TenureDays = 365,
                PigmyLiabilityLedgerID = seed.pigmyLiabLedger.LedgerID,
                InterestExpenseLedgerID = seed.intExpLedger.LedgerID,
                PrematureDeductionLedgerID = null,
                Slabs = new List<PigmySchemeInterestSlab>
                {
                    new PigmySchemeInterestSlab { FromDays = 0, ToDays = 90, PenaltyRate = 2.0m, InterestRate = 0m, IsActive = true },
                    new PigmySchemeInterestSlab { FromDays = 91, ToDays = 365, PenaltyRate = 0m, InterestRate = 6.0m, IsActive = true }
                }
            });
            Assert.IsType<BadRequestObjectResult>(invalidSchemeRes.Result);

            // 2. Save scheme WITH PrematureDeductionLedgerID mapped in Scheme Settings
            var validSchemeRes = await schemesCtrl.PostPigmyScheme(new PigmyScheme
            {
                SchemeCode = "PG-AUTO",
                SchemeName = "योजना मॅपिंग आधारित पिग्मी",
                InterestRate = 6.0m,
                DurationMonths = 12,
                TenureDays = 365,
                InterestCalculationMethod = "Simple Pro-Rata Days",
                PigmyLiabilityLedgerID = seed.pigmyLiabLedger.LedgerID,
                InterestExpenseLedgerID = seed.intExpLedger.LedgerID,
                PrematureDeductionLedgerID = seed.customDeductionLedger.LedgerID,
                Slabs = new List<PigmySchemeInterestSlab>
                {
                    new PigmySchemeInterestSlab { FromDays = 0, ToDays = 90, PenaltyRate = 2.0m, InterestRate = 0m, IsActive = true },
                    new PigmySchemeInterestSlab { FromDays = 91, ToDays = 365, PenaltyRate = 0m, InterestRate = 6.0m, IsActive = true }
                }
            });
            var createdRes = Assert.IsType<CreatedAtActionResult>(validSchemeRes.Result);
            var savedScheme = Assert.IsType<PigmyScheme>(createdRes.Value);

            var acc = new PigmyAccount
            {
                PigmyAccountID = 60,
                AccountNo = "PG-6001",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                PigmySchemeID = savedScheme.PigmySchemeID,
                PigmyAgentID = seed.agent.PigmyAgentID,
                OpeningDate = new DateTime(2026, 10, 20),
                EffectiveStartDate = new DateTime(2026, 10, 20), // 31 days on 2026-11-20 -> 2% penalty
                MaturityDate = new DateTime(2027, 10, 20),
                TotalDepositedAmount = 5000m,
                Status = "Active"
            };
            db.PigmyAccounts.Add(acc);
            await db.SaveChangesAsync();

            // 3. Partial Withdrawal WITHOUT passing DeductionLedgerId or InterestDebitLedgerId (exact UI payload)
            var closureCtrl = new PigmyClosureController(db);
            AttachUser(closureCtrl, userId: 20, branchId: 1);

            var wdrRes = await closureCtrl.WithdrawAmount(new PigmyClosureController.WithdrawalRequest
            {
                AccountNo = "PG-6001",
                Amount = 1000m,
                BranchId = 1,
                WithdrawalDate = new DateTime(2026, 11, 20),
                PaymentMode = "Cash",
                DeductionLedgerId = null,
                InterestDebitMode = "Auto",
                InterestDebitLedgerId = null
            });
            Assert.IsType<OkObjectResult>(wdrRes);

            var wdrRow = await db.PigmyWithdrawals.SingleAsync(w => w.PigmyAccountID == 60);
            Assert.Equal(20m, wdrRow.PenaltyAmount); // 2% of 1000
            Assert.Equal(seed.customDeductionLedger.LedgerID, wdrRow.DeductionLedgerID);

            var vch = await db.Vouchers.Include(v => v.VoucherDetails).SingleAsync(v => v.VoucherID == wdrRow.VoucherID);
            Assert.Contains(vch.VoucherDetails, vd => vd.DrCr == "Cr" && vd.LedgerID == seed.customDeductionLedger.LedgerID && vd.Amount == 20m);
            Assert.Contains(vch.VoucherDetails, vd => vd.DrCr == "Cr" && vd.LedgerID == seed.cashLedger.LedgerID && vd.Amount == 980m);
        }

        [Fact]
        public async Task SchemeInterestCalculation_HonorsDailyBalanceProduct_AndAutoHealsLegacy365MonthsMaturityBug()
        {
            using var db = CreateDbContext(nameof(SchemeInterestCalculation_HonorsDailyBalanceProduct_AndAutoHealsLegacy365MonthsMaturityBug));
            var seed = await SeedCoreAccountingAsync(db);

            // Simulate legacy scheme where DurationMonths was saved as 365 (days) and method is Daily Balance Product!
            var scheme = new PigmyScheme
            {
                PigmySchemeID = 7,
                SchemeCode = "PG-DAILY",
                SchemeName = "दैनिक प्रॉडक्ट पिग्मी योजना",
                DurationMonths = 365, // Legacy bug value!
                TenureDays = 365,
                InterestDaysInYear = 365,
                InterestRate = 7.30m, // 7.30% p.a. => exactly 0.0002 per rupee per day!
                InterestCalculationMethod = "Daily Balance Product (दैनिक शिल्लक प्रॉडक्ट)",
                PigmyLiabilityLedgerID = seed.pigmyLiabLedger.LedgerID,
                InterestExpenseLedgerID = seed.intExpLedger.LedgerID,
                PrematureDeductionLedgerID = seed.customDeductionLedger.LedgerID,
                Status = "Active",
                Slabs = new List<PigmySchemeInterestSlab>
                {
                    new PigmySchemeInterestSlab { SlabID = 71, FromDays = 0, ToDays = 180, PenaltyRate = 2m, InterestRate = 0m, IsActive = true },
                    new PigmySchemeInterestSlab { SlabID = 72, FromDays = 181, ToDays = 365, PenaltyRate = 0m, InterestRate = 7.30m, IsActive = true }
                }
            };
            db.PigmySchemes.Add(scheme);

            // Simulate account whose MaturityDate was broken to 2055 (OpeningDate.AddMonths(365))
            var account = new PigmyAccount
            {
                PigmyAccountID = 70,
                AccountNo = "PG-7001",
                CustomerID = seed.customer.CustomerID,
                BranchID = 1,
                PigmySchemeID = 7,
                PigmyAgentID = seed.agent.PigmyAgentID,
                OpeningDate = new DateTime(2025, 11, 20),
                EffectiveStartDate = new DateTime(2025, 11, 20),
                MaturityDate = new DateTime(2025, 11, 20).AddMonths(365), // Broken 2056 date!
                TotalDepositedAmount = 20000m,
                Status = "Active"
            };
            db.PigmyAccounts.Add(account);

            // Deposit 1: ₹10,000 on 2025-11-20 (held 365 days until 2026-11-20 => 10000 * 7.30 * 365 / 36500 = ₹730.00)
            // Deposit 2: ₹10,000 on 2026-05-24 (held 180 days until 2026-11-20 => 10000 * 7.30 * 180 / 36500 = ₹360.00)
            // Total exact Daily Balance Product interest = ₹1,090.00 (NOT flat ₹1,460.00 and NOT ₹0!)
            db.PigmyTransactions.AddRange(
                new PigmyTransaction
                {
                    PigmyAccountID = 70,
                    TransactionDate = new DateTime(2025, 11, 20),
                    ValueDate = new DateTime(2025, 11, 20),
                    TransactionType = "DEPOSIT",
                    CrAmount = 10000m,
                    BalanceAmount = 10000m,
                    Narration = "पहिले जमा"
                },
                new PigmyTransaction
                {
                    PigmyAccountID = 70,
                    TransactionDate = new DateTime(2026, 5, 24),
                    ValueDate = new DateTime(2026, 5, 24),
                    TransactionType = "DEPOSIT",
                    CrAmount = 10000m,
                    BalanceAmount = 20000m,
                    Narration = "दुसरे जमा"
                });
            await db.SaveChangesAsync();

            var closureCtrl = new PigmyClosureController(db);
            AttachUser(closureCtrl, userId: 21, branchId: 1);

            var previewAction = await closureCtrl.PreviewClosure("PG-7001", branchId: 1, asOfDate: new DateTime(2026, 11, 20));
            var okPreview = Assert.IsType<OkObjectResult>(previewAction.Result);
            var preview = Assert.IsType<PigmyClosureController.ClosurePreviewResult>(okPreview.Value);

            Assert.False(preview.IsPremature); // Auto-healed 365-day maturity!
            Assert.Equal(new DateTime(2026, 11, 20), preview.MaturityDate.Date);
            Assert.Equal(7.30m, preview.PrematureInterestRate);
            Assert.Equal(1090.00m, preview.PrematureInterestAmount);
            Assert.Equal(21090.00m, preview.NetPayable);

            // Execute Closure WITHOUT manual InterestDebitLedgerId -> auto-posts Dr InterestExpenseLedgerID (401) ₹1,090!
            var closeRes = await closureCtrl.CloseAccount(new PigmyClosureController.ClosureRequest
            {
                AccountNo = "PG-7001",
                BranchId = 1,
                ClosureDate = new DateTime(2026, 11, 20),
                PaymentMode = "Cash",
                DeductionLedgerId = null,
                InterestDebitMode = "Auto",
                InterestDebitLedgerId = null
            });
            Assert.IsType<OkObjectResult>(closeRes);

            var closureRow = await db.PigmyAccountClosures.SingleAsync(c => c.PigmyAccountID == 70);
            Assert.Equal(1090.00m, closureRow.FinalInterestAmount);
            Assert.Equal(seed.intExpLedger.LedgerID, closureRow.InterestDebitLedgerID);
            Assert.Equal(21090.00m, closureRow.NetPayableAmount);
        }
    }
}

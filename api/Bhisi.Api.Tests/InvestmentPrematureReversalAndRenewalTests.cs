using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class InvestmentPrematureReversalAndRenewalTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiInvPremRev_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildAdminPrincipal(int branchId = 1, DateTime? businessDate = null)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            if (businessDate.HasValue)
            {
                claims.Add(new Claim("BusinessDate", businessDate.Value.ToString("yyyy-MM-dd")));
            }
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"));
        }

        private static void AttachUser(ControllerBase controller, ClaimsPrincipal principal)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        private static JsonElement ParseOkJson(ActionResult actionResult)
        {
            var ok = Assert.IsType<OkObjectResult>(actionResult);
            var json = JsonSerializer.Serialize(ok.Value);
            return JsonDocument.Parse(json).RootElement;
        }

        private static async Task SeedBaseInvestmentEnvironmentAsync(AppDbContext db, DateTime businessDate)
        {
            db.Branches.Add(new Branch
            {
                BranchID = 1,
                BranchCode = "001",
                BranchName = "मुख्य शाखा",
                IsActive = true
            });

            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });

            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = businessDate.Date,
                IsDayClosed = false
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "गुंतवणूक मालमत्ता", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "बँक खाती", NatureOfGroup = "Assets", IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "व्याज उत्पन्न", NatureOfGroup = "Income", IsActive = true },
                new AccountGroup { GroupID = 4, GroupName = "खर्च", NatureOfGroup = "Expenses", IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 701, GroupID = 1, LedgerCode = "INV-ASSET", LedgerName = "बँक मुदत ठेव गुंतवणूक", AccountType = "Asset", IsActive = true },
                new Ledger { LedgerID = 702, GroupID = 1, LedgerCode = "INV-REC", LedgerName = "येणे व्याज गुंतवणुकीवरील", AccountType = "Asset", IsActive = true },
                new Ledger { LedgerID = 703, GroupID = 3, LedgerCode = "INV-INC", LedgerName = "गुंतवणूक व्याज उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 704, GroupID = 1, LedgerCode = "INV-TDS", LedgerName = "येणे टी.डी.एस कपात", AccountType = "Asset", IsActive = true },
                new Ledger { LedgerID = 705, GroupID = 2, LedgerCode = "BANK-DCC", LedgerName = "सांगली जिल्हा मध्यवर्ती बँक चालू खाते", AccountType = "Bank", IsActive = true },
                new Ledger { LedgerID = 706, GroupID = 4, LedgerCode = "INV-PEN", LedgerName = "गुंतवणूक मुदतपूर्व दंड खर्च", AccountType = "Expenses", IsActive = true }
            );

            db.InvestmentInstitutions.Add(new InvestmentInstitution
            {
                InstitutionID = 1,
                BranchID = 1,
                InstitutionName = "यड्राव बँक गुंतवणूक",
                InstitutionType = "CoopBank",
                IsActive = true
            });

            db.InvestmentSchemes.Add(new InvestmentScheme
            {
                SchemeID = 1,
                BranchID = 1,
                InvestmentInstitutionID = 1,
                SchemeCode = "INV01",
                SchemeName = "१२ महिने मुदत ठेव",
                InterestRate = 7.50m,
                PrematureWithdrawalRate = 6.00m,
                DurationType = "Months",
                DurationMonths = 12,
                InterestCalculationMethod = "Simple",
                InvestmentType = "Deposit",
                InvestmentAssetLedgerID = 701,
                InterestReceivableLedgerID = 702,
                InterestIncomeLedgerID = 703,
                TdsLedgerID = 704,
                IsActive = true
            });

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task PrematureWithdraw_WhenAccruedReceivableExceedsInterestPaid_PostsExactIncomeReversalAndZeroesReceivable()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 2);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            // Case A: Principal 3,50,000 + Standing Receivable 20,000; Premature InterestPaid = 8,000 -> Reversal = 12,000
            // Case B: Principal 1,00,000 + Standing Receivable 5,000; Premature InterestPaid = 0 -> Reversal = 5,000
            db.InvestmentAccounts.AddRange(
                new InvestmentAccount
                {
                    InvestmentAccountID = 101,
                    BranchID = 1,
                    FinancialYearID = 1,
                    InvestmentInstitutionID = 1,
                    SchemeID = 1,
                    InvestmentNo = "001-701-0000101-7",
                    DepositReceiptNo = "0186",
                    InvestmentDate = new DateTime(2025, 8, 1),
                    MaturityDate = new DateTime(2026, 8, 1),
                    PrincipalAmount = 350000m,
                    InterestRate = 7.50m,
                    ExpectedMaturityAmount = 376250m,
                    AccruedInterestTillMigration = 20000m,
                    BookValue = 370000m,
                    Status = "Active"
                },
                new InvestmentAccount
                {
                    InvestmentAccountID = 102,
                    BranchID = 1,
                    FinancialYearID = 1,
                    InvestmentInstitutionID = 1,
                    SchemeID = 1,
                    InvestmentNo = "001-701-0000102-5",
                    DepositReceiptNo = "0187",
                    InvestmentDate = new DateTime(2026, 3, 30),
                    MaturityDate = new DateTime(2026, 5, 30),
                    PrincipalAmount = 100000m,
                    InterestRate = 6.00m,
                    ExpectedMaturityAmount = 101000m,
                    AccruedInterestTillMigration = 5000m,
                    BookValue = 105000m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var controller = new InvestmentAccountsController(db);
            AttachUser(controller, BuildAdminPrincipal(1, businessDate));

            // Execute Case A (InterestPaid = 8000, TDS = 800)
            var resA = ParseOkJson(await controller.PrematureWithdraw(new PrematureWithdrawRequest
            {
                InvestmentAccountID = 101,
                WithdrawalDate = businessDate,
                PrincipalPaid = 350000m,
                RevisedInterestRate = 5.50m,
                InterestPaid = 8000m,
                PenaltyAmount = 0m,
                TdsAmount = 800m,
                TdsLedgerID = 704,
                PaymentMode = "Bank",
                BankLedgerID = 705,
                ReferenceNo = "UTR-PRE-101"
            }));

            Assert.Equal(12000m, resA.GetProperty("accruedInterestReversed").GetDecimal());
            Assert.Equal(357200m, resA.GetProperty("netPayout").GetDecimal());

            int voucherIdA = resA.GetProperty("voucherId").GetInt32();
            var detailsA = await db.VoucherDetails.Where(d => d.VoucherID == voucherIdA).ToListAsync();
            Assert.Equal(
                detailsA.Where(d => d.DrCr == "Dr").Sum(d => d.Amount),
                detailsA.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));

            // Bank Dr = 3,57,200; TDS Dr = 800; Interest Income Reversal Dr = 12,000 (Total Dr = 3,70,000)
            Assert.Contains(detailsA, d => d.LedgerID == 705 && d.DrCr == "Dr" && d.Amount == 357200m);
            Assert.Contains(detailsA, d => d.LedgerID == 704 && d.DrCr == "Dr" && d.Amount == 800m);
            Assert.Contains(detailsA, d => d.LedgerID == 703 && d.DrCr == "Dr" && d.Amount == 12000m);
            // Asset Cr = 3,50,000; Receivable Cr = FULL 20,000 (Total Cr = 3,70,000)
            Assert.Contains(detailsA, d => d.LedgerID == 701 && d.DrCr == "Cr" && d.Amount == 350000m);
            Assert.Contains(detailsA, d => d.LedgerID == 702 && d.DrCr == "Cr" && d.Amount == 20000m);

            // Execute Case B (InterestPaid = 0 -> full 5,000 receivable reversed!)
            var resB = ParseOkJson(await controller.PrematureWithdraw(new PrematureWithdrawRequest
            {
                InvestmentAccountID = 102,
                WithdrawalDate = businessDate,
                PrincipalPaid = 100000m,
                RevisedInterestRate = 0m,
                InterestPaid = 0m,
                PenaltyAmount = 0m,
                TdsAmount = 0m,
                PaymentMode = "Bank",
                BankLedgerID = 705
            }));

            Assert.Equal(5000m, resB.GetProperty("accruedInterestReversed").GetDecimal());
            int voucherIdB = resB.GetProperty("voucherId").GetInt32();
            var detailsB = await db.VoucherDetails.Where(d => d.VoucherID == voucherIdB).ToListAsync();
            Assert.Contains(detailsB, d => d.LedgerID == 703 && d.DrCr == "Dr" && d.Amount == 5000m);
            Assert.Contains(detailsB, d => d.LedgerID == 702 && d.DrCr == "Cr" && d.Amount == 5000m);
            Assert.Contains(detailsB, d => d.LedgerID == 701 && d.DrCr == "Cr" && d.Amount == 100000m);
        }

        [Fact]
        public async Task PrematureWithdraw_WhenPrincipalReducedDueToPriorInterestClawback_ClearsFullAssetAndReversesIncome()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 2);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 201,
                BranchID = 1,
                FinancialYearID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "001-701-0000201-5",
                InvestmentDate = new DateTime(2025, 6, 1),
                MaturityDate = new DateTime(2026, 6, 1),
                PrincipalAmount = 350000m,
                InterestRate = 7.50m,
                ExpectedMaturityAmount = 376250m,
                BookValue = 350000m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var controller = new InvestmentAccountsController(db);
            AttachUser(controller, BuildAdminPrincipal(1, businessDate));

            // Bank deducts 6,000 excess periodic interest from principal -> PrincipalPaid = 3,44,000
            var res = ParseOkJson(await controller.PrematureWithdraw(new PrematureWithdrawRequest
            {
                InvestmentAccountID = 201,
                WithdrawalDate = businessDate,
                PrincipalPaid = 344000m,
                RevisedInterestRate = 5.0m,
                InterestPaid = 0m,
                PaymentMode = "Bank",
                BankLedgerID = 705
            }));

            Assert.Equal(6000m, res.GetProperty("interestClawback").GetDecimal());
            Assert.Equal(344000m, res.GetProperty("netPayout").GetDecimal());

            int voucherId = res.GetProperty("voucherId").GetInt32();
            var details = await db.VoucherDetails.Where(d => d.VoucherID == voucherId).ToListAsync();
            Assert.Contains(details, d => d.LedgerID == 705 && d.DrCr == "Dr" && d.Amount == 344000m);
            Assert.Contains(details, d => d.LedgerID == 703 && d.DrCr == "Dr" && d.Amount == 6000m);
            Assert.Contains(details, d => d.LedgerID == 701 && d.DrCr == "Cr" && d.Amount == 350000m);
        }

        [Fact]
        public async Task PrematureWithdraw_Rollback_RestoresActiveStatusAndExactBookValue()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 2);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 301,
                BranchID = 1,
                FinancialYearID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "001-701-0000301-3",
                InvestmentDate = new DateTime(2025, 10, 1),
                MaturityDate = new DateTime(2026, 10, 1),
                PrincipalAmount = 200000m,
                InterestRate = 7.50m,
                ExpectedMaturityAmount = 215000m,
                AccruedInterestTillMigration = 7500m,
                BookValue = 207500m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var controller = new InvestmentAccountsController(db);
            AttachUser(controller, BuildAdminPrincipal(1, businessDate));

            var res = ParseOkJson(await controller.PrematureWithdraw(new PrematureWithdrawRequest
            {
                InvestmentAccountID = 301,
                WithdrawalDate = businessDate,
                PrincipalPaid = 200000m,
                RevisedInterestRate = 5.0m,
                InterestPaid = 3000m,
                PaymentMode = "Bank",
                BankLedgerID = 705
            }));

            int voucherId = res.GetProperty("voucherId").GetInt32();
            var closedAcc = await db.InvestmentAccounts.FindAsync(301);
            Assert.Equal("Closed", closedAcc!.Status);
            Assert.Equal(0m, closedAcc.BookValue);

            // Rollback premature voucher -> must restore Status = "Active" AND BookValue = 2,07,500
            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var delRes = await rollbackSvc.DeleteVoucherWithRollbackAsync(voucherId, new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "चुकून मुदतपूर्व मोडणी एन्ट्री पडल्याने रद्द केले"
            });
            Assert.True(delRes.Success, delRes.Message);

            var restoredAcc = await db.InvestmentAccounts.FindAsync(301);
            Assert.Equal("Active", restoredAcc!.Status);
            Assert.Equal(207500m, restoredAcc.BookValue);
            Assert.False(await db.InvestmentPrematureWithdrawals.AnyAsync(p => p.InvestmentAccountID == 301));
        }

        [Fact]
        public async Task RenewInvestment_Generates14DigitCbsAccountNo_SupportsDaysDuration_AndReversesExcessReceivable()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 2);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 401,
                BranchID = 1,
                FinancialYearID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "001-701-0000005-2",
                OldInvestmentNo = "88",
                DepositReceiptNo = "FDR-7788",
                InvestmentDate = new DateTime(2025, 4, 2),
                MaturityDate = businessDate,
                PrincipalAmount = 100000m,
                InterestRate = 7.50m,
                ExpectedMaturityAmount = 107500m,
                AccruedInterestTillMigration = 8000m, // Higher than actual 7,500 recognized at renewal -> 500 reversal!
                BookValue = 108000m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var controller = new InvestmentAccountsController(db);
            AttachUser(controller, BuildAdminPrincipal(1, businessDate));

            var res = ParseOkJson(await controller.RenewInvestment(new RenewalRequest
            {
                OldInvestmentAccountID = 401,
                RenewalDate = businessDate,
                RenewalType = "PrincipalAndInterest",
                RenewalAmount = 107500m,
                NewSchemeID = 1,
                NewInterestRate = 8.00m,
                DurationType = "Days",
                DurationValue = 400,
                NewDepositReceiptNo = "FDR-9900"
            }));

            string newAccNo = res.GetProperty("newAccountNo").GetString()!;
            Assert.StartsWith("001-701-", newAccNo);
            Assert.Equal(17, newAccNo.Length); // "001-701-0000001-X" formatted 14-digit CBS

            var newAcc = await db.InvestmentAccounts.FirstAsync(a => a.InvestmentNo == newAccNo);
            Assert.Equal("FDR-9900", newAcc.DepositReceiptNo);
            Assert.Equal("88", newAcc.OldInvestmentNo);
            Assert.Equal(businessDate.AddDays(400), newAcc.MaturityDate);

            int voucherId = res.GetProperty("voucherId").GetInt32();
            var details = await db.VoucherDetails.Where(d => d.VoucherID == voucherId).ToListAsync();
            Assert.Equal(
                details.Where(d => d.DrCr == "Dr").Sum(d => d.Amount),
                details.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));
            // 500 excess receivable reversed via Dr InterestIncome (703) and full 8000 Receivable credited (702)
            Assert.Contains(details, d => d.LedgerID == 703 && d.DrCr == "Dr" && d.Amount == 500m);
            Assert.Contains(details, d => d.LedgerID == 702 && d.DrCr == "Cr" && d.Amount == 8000m);
        }

        [Fact]
        public async Task PrematureWithdraw_ReceivableReversal_WithCustomPostingLedgerWhenStandingReceivableIsZero_PostsBalancedCustomEntries()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 2);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 707, GroupID = 1, LedgerCode = "POSTING_INTR", LedgerName = "गुंतवणूक पोस्टिंग व्याज खाते", AccountType = "Asset", IsActive = true },
                new Ledger { LedgerID = 708, GroupID = 4, LedgerCode = "PRIOR-ADJ", LedgerName = "मागील वर्ष व्याज समायोजन", AccountType = "Expenses", IsActive = true }
            );

            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 501,
                BranchID = 1,
                FinancialYearID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "001-701-0000501-9",
                InvestmentDate = new DateTime(2025, 11, 1),
                MaturityDate = new DateTime(2026, 11, 1),
                PrincipalAmount = 100000m,
                InterestRate = 7.50m,
                ExpectedMaturityAmount = 107500m,
                AccruedInterestTillMigration = 0m,
                BookValue = 100000m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var controller = new InvestmentAccountsController(db);
            AttachUser(controller, BuildAdminPrincipal(1, businessDate));

            var res = ParseOkJson(await controller.PrematureWithdraw(new PrematureWithdrawRequest
            {
                InvestmentAccountID = 501,
                WithdrawalDate = businessDate,
                PrincipalPaid = 100000m,
                RevisedInterestRate = 5.0m,
                InterestPaid = 0m,
                EnablePostingInterestReversal = true,
                ReversalMode = "ReceivableReversal",
                ReversePostingInterestAmount = 5000m,
                ReversalDebitLedgerID = 708,
                PostingCreditLedgerID = 707,
                PaymentMode = "Bank",
                BankLedgerID = 705
            }));

            Assert.Equal("ReceivableReversal", res.GetProperty("reversalMode").GetString());
            Assert.Equal(5000m, res.GetProperty("accruedInterestReversed").GetDecimal());
            Assert.Equal(100000m, res.GetProperty("netPayout").GetDecimal());

            int voucherId = res.GetProperty("voucherId").GetInt32();
            var details = await db.VoucherDetails.Where(d => d.VoucherID == voucherId).ToListAsync();
            Assert.Equal(105000m, details.Where(d => d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(105000m, details.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));
            Assert.Contains(details, d => d.LedgerID == 705 && d.DrCr == "Dr" && d.Amount == 100000m);
            Assert.Contains(details, d => d.LedgerID == 708 && d.DrCr == "Dr" && d.Amount == 5000m);
            Assert.Contains(details, d => d.LedgerID == 701 && d.DrCr == "Cr" && d.Amount == 100000m);
            Assert.Contains(details, d => d.LedgerID == 707 && d.DrCr == "Cr" && d.Amount == 5000m);

            var withdrawal = await db.InvestmentPrematureWithdrawals.FirstAsync(w => w.InvestmentAccountID == 501);
            Assert.Equal("ReceivableReversal", withdrawal.ReversalMode);
            Assert.Equal(708, withdrawal.ReversalDebitLedgerID);
            Assert.Equal(707, withdrawal.PostingCreditLedgerID);
            Assert.Equal(5000m, withdrawal.AccruedInterestReversed);
        }

        [Fact]
        public async Task PrematureWithdraw_ReceivableReversal_FullStandingReceivableIndependentOfInterestPaid_CreditsReceivableAndIncome()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 2);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 502,
                BranchID = 1,
                FinancialYearID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "001-701-0000502-7",
                InvestmentDate = new DateTime(2025, 6, 1),
                MaturityDate = new DateTime(2026, 6, 1),
                PrincipalAmount = 100000m,
                InterestRate = 7.50m,
                ExpectedMaturityAmount = 107500m,
                AccruedInterestTillMigration = 10000m,
                BookValue = 110000m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var controller = new InvestmentAccountsController(db);
            AttachUser(controller, BuildAdminPrincipal(1, businessDate));

            var res = ParseOkJson(await controller.PrematureWithdraw(new PrematureWithdrawRequest
            {
                InvestmentAccountID = 502,
                WithdrawalDate = businessDate,
                PrincipalPaid = 100000m,
                RevisedInterestRate = 6.0m,
                InterestPaid = 12000m,
                EnablePostingInterestReversal = true,
                ReversalMode = "ReceivableReversal",
                ReversePostingInterestAmount = 10000m,
                ReversalDebitLedgerID = 703,
                PostingCreditLedgerID = 702,
                PaymentMode = "Bank",
                BankLedgerID = 705
            }));

            Assert.Equal(0m, res.GetProperty("receivableCleared").GetDecimal());
            Assert.Equal(10000m, res.GetProperty("accruedInterestReversed").GetDecimal());
            Assert.Equal(12000m, res.GetProperty("freshInterestIncome").GetDecimal());
            Assert.Equal(112000m, res.GetProperty("netPayout").GetDecimal());

            int voucherId = res.GetProperty("voucherId").GetInt32();
            var details = await db.VoucherDetails.Where(d => d.VoucherID == voucherId).ToListAsync();
            Assert.Equal(122000m, details.Where(d => d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(122000m, details.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));
            Assert.Contains(details, d => d.LedgerID == 705 && d.DrCr == "Dr" && d.Amount == 112000m);
            Assert.Contains(details, d => d.LedgerID == 703 && d.DrCr == "Dr" && d.Amount == 10000m);
            Assert.Contains(details, d => d.LedgerID == 701 && d.DrCr == "Cr" && d.Amount == 100000m);
            Assert.Contains(details, d => d.LedgerID == 702 && d.DrCr == "Cr" && d.Amount == 10000m);
            Assert.Contains(details, d => d.LedgerID == 703 && d.DrCr == "Cr" && d.Amount == 12000m);
        }

        [Fact]
        public async Task PrematureWithdraw_PayoutDeduction_ReducesNetPayoutWithoutAlteringPrincipalPaid_AndBalancesDrCr()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 2);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            db.Ledgers.Add(new Ledger
            {
                LedgerID = 708,
                GroupID = 4,
                LedgerCode = "PRIOR-ADJ",
                LedgerName = "मागील वर्ष व्याज समायोजन",
                AccountType = "Expenses",
                IsActive = true
            });

            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 503,
                BranchID = 1,
                FinancialYearID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "001-701-0000503-5",
                InvestmentDate = new DateTime(2025, 7, 1),
                MaturityDate = new DateTime(2026, 7, 1),
                PrincipalAmount = 100000m,
                InterestRate = 7.50m,
                ExpectedMaturityAmount = 107500m,
                BookValue = 100000m,
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var controller = new InvestmentAccountsController(db);
            AttachUser(controller, BuildAdminPrincipal(1, businessDate));

            var res = ParseOkJson(await controller.PrematureWithdraw(new PrematureWithdrawRequest
            {
                InvestmentAccountID = 503,
                WithdrawalDate = businessDate,
                PrincipalPaid = 100000m,
                RevisedInterestRate = 5.0m,
                InterestPaid = 0m,
                EnablePostingInterestReversal = true,
                ReversalMode = "PayoutDeduction",
                ReversePostingInterestAmount = 3000m,
                ReversalDebitLedgerID = 708,
                PaymentMode = "Bank",
                BankLedgerID = 705
            }));

            Assert.Equal("PayoutDeduction", res.GetProperty("reversalMode").GetString());
            Assert.Equal(3000m, res.GetProperty("payoutDeductionAmount").GetDecimal());
            Assert.Equal(3000m, res.GetProperty("interestClawback").GetDecimal());
            Assert.Equal(97000m, res.GetProperty("netPayout").GetDecimal());

            int voucherId = res.GetProperty("voucherId").GetInt32();
            var details = await db.VoucherDetails.Where(d => d.VoucherID == voucherId).ToListAsync();
            Assert.Equal(100000m, details.Where(d => d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(100000m, details.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));
            Assert.Contains(details, d => d.LedgerID == 705 && d.DrCr == "Dr" && d.Amount == 97000m);
            Assert.Contains(details, d => d.LedgerID == 708 && d.DrCr == "Dr" && d.Amount == 3000m);
            Assert.Contains(details, d => d.LedgerID == 701 && d.DrCr == "Cr" && d.Amount == 100000m);

            var withdrawal = await db.InvestmentPrematureWithdrawals.FirstAsync(w => w.InvestmentAccountID == 503);
            Assert.Equal(100000m, withdrawal.PrincipalPaid);
            Assert.Equal(3000m, withdrawal.InterestClawbackAmount);
            Assert.Equal("PayoutDeduction", withdrawal.ReversalMode);
            Assert.Equal(708, withdrawal.ReversalDebitLedgerID);
            Assert.Null(withdrawal.PostingCreditLedgerID);
            Assert.Equal(97000m, withdrawal.NetPayout);
        }

        [Fact]
        public async Task GetInvestmentAccounts_ExcludesCancelledRejectedAccruals_ZeroesClosedReceivable_AndRollbackRestores()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 4, 2);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 504,
                BranchID = 1,
                FinancialYearID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "001-701-0000504-3",
                InvestmentDate = new DateTime(2025, 9, 1),
                MaturityDate = new DateTime(2026, 9, 1),
                PrincipalAmount = 150000m,
                InterestRate = 7.50m,
                ExpectedMaturityAmount = 161250m,
                AccruedInterestTillMigration = 2000m,
                BookValue = 156000m,
                Status = "Active"
            });

            db.Vouchers.AddRange(
                new Voucher { VoucherID = 9001, BranchID = 1, VoucherNo = "JV-ACC-OK", VoucherDate = new DateTime(2026, 3, 31), VoucherType = "Journal", Status = "Approved", TotalAmount = 4000m, CreatedBy = 1 },
                new Voucher { VoucherID = 9002, BranchID = 1, VoucherNo = "JV-ACC-CAN", VoucherDate = new DateTime(2026, 3, 31), VoucherType = "Journal", Status = "Cancelled", TotalAmount = 9999m, CreatedBy = 1 },
                new Voucher { VoucherID = 9003, BranchID = 1, VoucherNo = "JV-ACC-REJ", VoucherDate = new DateTime(2026, 3, 31), VoucherType = "Journal", Status = "Rejected", TotalAmount = 8888m, CreatedBy = 1 }
            );

            db.InvestmentInterestAccruals.AddRange(
                new InvestmentInterestAccrual { AccrualID = 1, BranchID = 1, FinancialYearID = 1, InvestmentAccountID = 504, AccrualDate = new DateTime(2026, 3, 31), InterestAmount = 4000m, VoucherID = 9001, IsPosted = true },
                new InvestmentInterestAccrual { AccrualID = 2, BranchID = 1, FinancialYearID = 1, InvestmentAccountID = 504, AccrualDate = new DateTime(2026, 3, 31), InterestAmount = 9999m, VoucherID = 9002, IsPosted = true },
                new InvestmentInterestAccrual { AccrualID = 3, BranchID = 1, FinancialYearID = 1, InvestmentAccountID = 504, AccrualDate = new DateTime(2026, 3, 31), InterestAmount = 8888m, VoucherID = 9003, IsPosted = true }
            );
            await db.SaveChangesAsync();

            var controller = new InvestmentAccountsController(db);
            AttachUser(controller, BuildAdminPrincipal(1, businessDate));

            // 1. Before closure: Cancelled/Rejected accruals must be excluded (2,000 + 4,000 = 6,000)
            var camelOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
            var listResultBefore = Assert.IsType<OkObjectResult>((await controller.GetInvestmentAccounts(1, null)).Result!);
            var listJsonBefore = JsonDocument.Parse(JsonSerializer.Serialize(listResultBefore.Value, camelOptions)).RootElement;
            var accBefore = listJsonBefore.EnumerateArray().Single(x => x.GetProperty("investmentAccountID").GetInt32() == 504);
            Assert.Equal(6000m, accBefore.GetProperty("accruedInterest").GetDecimal());
            Assert.Equal(6000m, accBefore.GetProperty("interestReceivable").GetDecimal());

            // 2. Premature withdraw with InterestPaid = 1,000 -> reverses 5,000 (verified receivable 6,000 - 1,000)
            var preRes = ParseOkJson(await controller.PrematureWithdraw(new PrematureWithdrawRequest
            {
                InvestmentAccountID = 504,
                WithdrawalDate = businessDate,
                PrincipalPaid = 150000m,
                RevisedInterestRate = 5.0m,
                InterestPaid = 1000m,
                PaymentMode = "Bank",
                BankLedgerID = 705
            }));
            Assert.Equal(5000m, preRes.GetProperty("accruedInterestReversed").GetDecimal());
            int preVoucherId = preRes.GetProperty("voucherId").GetInt32();

            // 3. After closure: GetInvestmentAccounts must report interestReceivable == 0 and reversal audit total == 5,000
            var listResultClosed = Assert.IsType<OkObjectResult>((await controller.GetInvestmentAccounts(1, null)).Result!);
            var listJsonClosed = JsonDocument.Parse(JsonSerializer.Serialize(listResultClosed.Value, camelOptions)).RootElement;
            var accClosed = listJsonClosed.EnumerateArray().Single(x => x.GetProperty("investmentAccountID").GetInt32() == 504);
            Assert.Equal("Closed", accClosed.GetProperty("status").GetString());
            Assert.Equal(0m, accClosed.GetProperty("interestReceivable").GetDecimal());
            Assert.Equal(5000m, accClosed.GetProperty("reversedPostingInterest").GetDecimal());

            // 4. Rollback premature voucher -> restores Status = Active and BookValue = 156,000 (excluding Cancelled/Rejected accruals)
            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var delRes = await rollbackSvc.DeleteVoucherWithRollbackAsync(preVoucherId, new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "सत्यापित रोलबॅक तपासणी"
            });
            Assert.True(delRes.Success, delRes.Message);

            var restored = await db.InvestmentAccounts.FindAsync(504);
            Assert.Equal("Active", restored!.Status);
            Assert.Equal(156000m, restored.BookValue);
        }

        [Fact]
        public async Task GetInvestmentRenewedReport_ReturnsPrincipalAndInterest_PrincipalOnlyWithBankPayout_AndExcludesRolledBack()
        {
            await using var db = CreateContext();
            var businessDate = new DateTime(2026, 5, 20);
            await SeedBaseInvestmentEnvironmentAsync(db, businessDate);

            db.InvestmentAccounts.AddRange(
                // 1) Inv 801: PrincipalAndInterest renewal (5,00,000 + 33,750 net reinvested + 3,750 TDS = 5,33,750)
                new InvestmentAccount
                {
                    InvestmentAccountID = 801,
                    BranchID = 1,
                    FinancialYearID = 1,
                    InvestmentInstitutionID = 1,
                    SchemeID = 1,
                    InvestmentNo = "00160100000801",
                    DepositReceiptNo = "INV-R-801",
                    OldInvestmentNo = "801",
                    InvestmentDate = new DateTime(2025, 5, 20),
                    MaturityDate = new DateTime(2026, 5, 20),
                    PrincipalAmount = 500000m,
                    InterestRate = 7.50m,
                    ExpectedMaturityAmount = 537500m,
                    BookValue = 500000m,
                    Status = "Active"
                },
                // 2) Inv 802: PrincipalOnly renewal (2,00,000 renewed; 15,000 gross interest - 1,500 TDS = 13,500 received in Bank 705)
                new InvestmentAccount
                {
                    InvestmentAccountID = 802,
                    BranchID = 1,
                    FinancialYearID = 1,
                    InvestmentInstitutionID = 1,
                    SchemeID = 1,
                    InvestmentNo = "00160100000802",
                    DepositReceiptNo = "INV-R-802",
                    OldInvestmentNo = "802",
                    InvestmentDate = new DateTime(2025, 5, 20),
                    MaturityDate = new DateTime(2026, 5, 20),
                    PrincipalAmount = 200000m,
                    InterestRate = 7.50m,
                    ExpectedMaturityAmount = 215000m,
                    BookValue = 200000m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var adminPrincipal = BuildAdminPrincipal(1, businessDate);
            var invController = new InvestmentAccountsController(db);
            AttachUser(invController, adminPrincipal);

            // Execute 1: PrincipalAndInterest renewal on 801
            var ren1Json = ParseOkJson(await invController.RenewInvestment(new RenewalRequest
            {
                OldInvestmentAccountID = 801,
                NewSchemeID = 1,
                RenewalType = "PrincipalAndInterest",
                RenewalAmount = 533750m,
                RenewalDate = businessDate,
                NewInterestRate = 7.75m,
                DurationType = "Months",
                DurationValue = 12,
                NewDepositReceiptNo = "INV-R-901",
                TdsAmount = 3750m,
                TdsLedgerID = 704
            }));
            Assert.NotNull(ren1Json.GetProperty("newAccountNo").GetString());

            // Execute 2: PrincipalOnly renewal on 802 with Bank interest payout
            var ren2Json = ParseOkJson(await invController.RenewInvestment(new RenewalRequest
            {
                OldInvestmentAccountID = 802,
                NewSchemeID = 1,
                RenewalType = "PrincipalOnly",
                RenewalAmount = 200000m,
                RenewalDate = businessDate,
                NewInterestRate = 7.50m,
                DurationType = "Months",
                DurationValue = 12,
                NewDepositReceiptNo = "INV-R-902",
                InterestPayoutAmount = 15000m,
                TdsAmount = 1500m,
                TdsLedgerID = 704,
                PaymentMode = "Bank",
                BankLedgerID = 705
            }));
            int ren2VoucherId = ren2Json.GetProperty("voucherId").GetInt32();

            var reportsController = new ReportsController(db, new MemoryCache(new MemoryCacheOptions()));
            AttachUser(reportsController, adminPrincipal);

            var allRowsRes = Assert.IsType<OkObjectResult>(await reportsController.GetInvestmentRenewedReport(
                branchID: 1,
                institutionID: null,
                schemeID: null,
                fromDate: null,
                toDate: null));
            var allRows = JsonDocument.Parse(JsonSerializer.Serialize(allRowsRes.Value)).RootElement;
            Assert.Equal(2, allRows.GetArrayLength());

            var row801 = allRows.EnumerateArray().First(x => x.GetProperty("OldInvestmentAccountID").GetInt32() == 801);
            Assert.Equal("PrincipalAndInterest", row801.GetProperty("RenewalType").GetString());
            Assert.Equal(500000m, row801.GetProperty("OldPrincipalAmount").GetDecimal());
            Assert.Equal(33750m, row801.GetProperty("ReinvestedInterest").GetDecimal());
            Assert.Equal(0m, row801.GetProperty("TotalCashOrBankReceived").GetDecimal());
            Assert.Equal(3750m, row801.GetProperty("TdsAmount").GetDecimal());
            Assert.Equal(533750m, row801.GetProperty("NewPrincipalAmount").GetDecimal());
            Assert.Equal("INV-R-901", row801.GetProperty("NewDepositReceiptNo").GetString());
            Assert.Equal("ठेवीत जमा", row801.GetProperty("ReceiptModeLabel").GetString());

            var row802 = allRows.EnumerateArray().First(x => x.GetProperty("OldInvestmentAccountID").GetInt32() == 802);
            Assert.Equal("PrincipalOnly", row802.GetProperty("RenewalType").GetString());
            Assert.Equal(200000m, row802.GetProperty("OldPrincipalAmount").GetDecimal());
            Assert.Equal(0m, row802.GetProperty("ReinvestedInterest").GetDecimal());
            Assert.Equal(13500m, row802.GetProperty("TotalCashOrBankReceived").GetDecimal());
            Assert.Equal(13500m, row802.GetProperty("NetInterestReceived").GetDecimal());
            Assert.Equal(1500m, row802.GetProperty("TdsAmount").GetDecimal());
            Assert.Equal(200000m, row802.GetProperty("NewPrincipalAmount").GetDecimal());
            Assert.Equal("बँक जमा", row802.GetProperty("ReceiptModeLabel").GetString());

            // Rollback renewal #2 voucher -> must disappear from Renewed Investments report
            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var delRes = await rollbackSvc.DeleteVoucherWithRollbackAsync(ren2VoucherId, new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "गुंतवणूक नूतनीकरण रोलबॅक चाचणी"
            });
            Assert.True(delRes.Success, delRes.Message);

            var afterRollbackRes = Assert.IsType<OkObjectResult>(await reportsController.GetInvestmentRenewedReport(
                branchID: 1,
                institutionID: null,
                schemeID: null,
                fromDate: null,
                toDate: null));
            var afterRollbackRows = JsonDocument.Parse(JsonSerializer.Serialize(afterRollbackRes.Value)).RootElement;
            Assert.Equal(1, afterRollbackRows.GetArrayLength());
            Assert.Equal(801, afterRollbackRows[0].GetProperty("OldInvestmentAccountID").GetInt32());
        }
    }
}

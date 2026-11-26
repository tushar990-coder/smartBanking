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
    public class SavingBulkTransferTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"SavingBulkTransfer_{Guid.NewGuid():N}")
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ClaimsPrincipal BuildPrincipal(int userId, string username, string role, int branchId, DateTime bizDate, bool isHo = true)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString()),
                new Claim("IsHeadOffice", isHo ? "true" : "false"),
                new Claim("BusinessDate", bizDate.ToString("yyyy-MM-dd"))
            };
            return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestJwt"));
        }

        private static void AttachUser(ControllerBase controller, ClaimsPrincipal principal)
        {
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        private static async Task SeedMilkSocietyEnvironmentAsync(AppDbContext db, DateTime bizDate)
        {
            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "सह्याद्री ग्रामीण बिगर शेती सहकारी पतसंस्था"
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
                BusinessDate = bizDate.Date,
                IsDayClosed = false
            });

            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "ठेवी", NatureOfGroup = "Liabilities", DisplayOrder = 1, IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "रोख व बँक", NatureOfGroup = "Assets", DisplayOrder = 2, IsActive = true },
                new AccountGroup { GroupID = 3, GroupName = "इतर देणी", NatureOfGroup = "Liabilities", DisplayOrder = 3, IsActive = true }
            );

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 10, GroupID = 2, LedgerCode = "10", LedgerName = "हातातील रोख शिल्लक", AccountType = "Cash", IsActive = true },
                new Ledger { LedgerID = 15, GroupID = 2, LedgerCode = "15", LedgerName = "के.डी.सी.सी चालु खाते", AccountType = "Bank Account", IsActive = true },
                new Ledger { LedgerID = 16, GroupID = 2, LedgerCode = "16", LedgerName = "कुरुंदवाड चालु खाते", AccountType = "Bank Account", IsActive = true },
                new Ledger { LedgerID = 46, GroupID = 1, LedgerCode = "46", LedgerName = "सेव्हिंग ठेव", AccountType = "Savings", IsActive = true },
                new Ledger { LedgerID = 47, GroupID = 1, LedgerCode = "47", LedgerName = "महालक्ष्मी सेव्हिंग ठेव", AccountType = "Savings", IsActive = true },
                new Ledger { LedgerID = 48, GroupID = 1, LedgerCode = "48", LedgerName = "हनुमान सेव्हिंग ठेव", AccountType = "Savings", IsActive = true },
                new Ledger { LedgerID = 90, GroupID = 3, LedgerCode = "90", LedgerName = "दूध बिल सस्पेन्स खाते", AccountType = "General Ledger", IsActive = true }
            );

            db.Branches.Add(new Branch
            {
                BranchID = 1,
                BranchCode = "HO",
                BranchName = "मुख्य शाखा",
                BranchType = "HeadOffice",
                DefaultCashLedgerID = 10,
                IsActive = true
            });

            db.SavingInterestSettings.AddRange(
                new SavingInterestSetting
                {
                    SettingID = 1,
                    SchemeCode = "301",
                    SchemeName = "सेव्हिंग ठेव",
                    InterestRate = 4m,
                    MinimumBalance = 500m,
                    LedgerID = 46,
                    SavingLiabilityLedgerID = 46,
                    EffectiveDate = new DateTime(2025, 4, 1)
                },
                new SavingInterestSetting
                {
                    SettingID = 2,
                    SchemeCode = "302",
                    SchemeName = "महालक्ष्मी सेव्हिंग ठेव",
                    InterestRate = 4m,
                    MinimumBalance = 100m,
                    LedgerID = 47,
                    SavingLiabilityLedgerID = 47,
                    EffectiveDate = new DateTime(2025, 4, 1)
                },
                new SavingInterestSetting
                {
                    SettingID = 3,
                    SchemeCode = "303",
                    SchemeName = "हनुमान सेव्हिंग ठेव",
                    InterestRate = 4m,
                    MinimumBalance = 100m,
                    LedgerID = 48,
                    SavingLiabilityLedgerID = 48,
                    EffectiveDate = new DateTime(2025, 4, 1)
                }
            );

            db.Customers.AddRange(
                new Customer { CustomerID = 101, BranchID = 1, CIFNo = "CIF000101", FirstName = "अनिल", MiddleName = "वसंत", LastName = "गाडवे", BirthDate = new DateTime(1985, 5, 10) },
                new Customer { CustomerID = 102, BranchID = 1, CIFNo = "CIF000102", FirstName = "कुमार", MiddleName = "बाबू", LastName = "गाडवे", BirthDate = new DateTime(1982, 8, 15) },
                new Customer { CustomerID = 103, BranchID = 1, CIFNo = "CIF000103", FirstName = "भास्कर", MiddleName = "धर्मा", LastName = "कांबळे", BirthDate = new DateTime(1988, 1, 20) },
                new Customer { CustomerID = 199, BranchID = 1, CIFNo = "CIF000199", FirstName = "महालक्ष्मी", LastName = "दूध संस्था", BirthDate = new DateTime(2000, 1, 1) }
            );

            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task MultiSchemeSavingAccounts_IndependentOldAccountNoPerScheme_AllowedForSameCustomer()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 26);
            await SeedMilkSocietyEnvironmentAsync(db, bizDate);

            var savAccCtrl = new SavingAccountsController(db);
            AttachUser(savAccCtrl, BuildPrincipal(1, "admin", "Admin", branchId: 1, bizDate));

            // 1. Open Regular Saving account for Customer 101 with OldAccountNo = "1"
            var regRes = await savAccCtrl.PostSavingAccountMaster(new SavingAccountsController.CreateSavingAccountDto
            {
                BranchID = 1,
                CustomerID = 101,
                SavingSchemeID = 1,
                LedgerID = 46,
                AccountType = "Single",
                OpeningDate = bizDate,
                OldAccountNo = "1",
                LegacyAccountNumber = "1",
                OpeningBalance = 0m,
                Status = "Active"
            });
            Assert.IsType<CreatedAtActionResult>(regRes.Result);

            // 2. Open Mahalakshmi Milk Society Saving account for SAME Customer 101 with OldAccountNo = "1" -> MUST SUCCEED!
            var mahaRes = await savAccCtrl.PostSavingAccountMaster(new SavingAccountsController.CreateSavingAccountDto
            {
                BranchID = 1,
                CustomerID = 101,
                SavingSchemeID = 2,
                LedgerID = 47,
                AccountType = "Single",
                OpeningDate = bizDate,
                OldAccountNo = "1",
                LegacyAccountNumber = "1",
                OpeningBalance = 0m,
                Status = "Active"
            });
            Assert.IsType<CreatedAtActionResult>(mahaRes.Result);

            // 3. Duplicate OldAccountNo = "1" inside the SAME scheme (SettingID = 2) -> Blocked!
            var dupSameScheme = await savAccCtrl.PostSavingAccountMaster(new SavingAccountsController.CreateSavingAccountDto
            {
                BranchID = 1,
                CustomerID = 102,
                SavingSchemeID = 2,
                LedgerID = 47,
                AccountType = "Single",
                OpeningDate = bizDate,
                OldAccountNo = "1",
                LegacyAccountNumber = "1",
                OpeningBalance = 0m,
                Status = "Active"
            });
            Assert.IsType<BadRequestObjectResult>(dupSameScheme.Result);

            // 4. Hanuman Milk Society Saving scheme (SettingID = 3) still starts fresh at nextLegacyAccountNo = "1"
            var nextHanuman = await savAccCtrl.GetNextAccountNo(branchId: 1, schemeId: 3);
            var okHanuman = Assert.IsType<OkObjectResult>(nextHanuman.Result);
            var json = System.Text.Json.JsonSerializer.Serialize(okHanuman.Value);
            Assert.Contains("\"nextLegacyAccountNo\":\"1\"", json);
        }

        [Fact]
        public async Task Stage1_KdccBankMilkBillBulkCredit_StaysPendingUntilApproved_ThenCreditsAllFarmers()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 26);
            await SeedMilkSocietyEnvironmentAsync(db, bizDate);

            db.SavingAccountMasters.AddRange(
                new SavingAccountMaster { SavingAccountID = 501, BranchID = 1, CustomerID = 101, SavingSchemeID = 2, LedgerID = 47, AccountNo = "00130200000018", OldAccountNo = "3", OpeningDate = new DateTime(2025, 4, 1), CurrentBalance = 100m, MinimumBalance = 100m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 502, BranchID = 1, CustomerID = 102, SavingSchemeID = 2, LedgerID = 47, AccountNo = "00130200000026", OldAccountNo = "6", OpeningDate = new DateTime(2025, 4, 1), CurrentBalance = 200m, MinimumBalance = 100m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 503, BranchID = 1, CustomerID = 103, SavingSchemeID = 2, LedgerID = 47, AccountNo = "00130200000034", OldAccountNo = "8", OpeningDate = new DateTime(2025, 4, 1), CurrentBalance = 150m, MinimumBalance = 100m, Status = "Active" }
            );
            await db.SaveChangesAsync();

            var bulkCtrl = new SavingTransactionsController(db);
            AttachUser(bulkCtrl, BuildPrincipal(10, "clerk", "Clerk", branchId: 1, bizDate));

            // Stage 1: KDCC Bank Dr ₹10,000 -> Mahalakshmi Saving Accounts Cr (5000 + 3000 + 2000)
            var actionRes = await bulkCtrl.PostBulkSavingTransfer(new SavingBulkTransferRequestDto
            {
                BranchId = 1,
                TransactionDate = bizDate,
                SavingLedgerId = 47,
                SavingSchemeId = 2,
                Direction = "CREDIT",
                ContraMode = "BANK",
                ContraLedgerId = 15, // के.डी.सी.सी चालु खाते
                Narration = "महालक्ष्मी दूध संस्था पंधरवडा बिल जमा",
                Items = new List<SavingBulkTransferItemInput>
                {
                    new SavingBulkTransferItemInput { SavingAccountId = 501, Amount = 5000m },
                    new SavingBulkTransferItemInput { SavingAccountId = 502, Amount = 3000m },
                    new SavingBulkTransferItemInput { SavingAccountId = 503, Amount = 2000m }
                }
            });

            var ok = Assert.IsType<OkObjectResult>(actionRes);
            var exec = Assert.IsType<SavingBulkTransferExecutionResult>(ok.Value);
            Assert.StartsWith("JV-SBK-20261126-", exec.VoucherNo);
            Assert.Equal(3, exec.ProcessedCount);
            Assert.Equal(10000m, exec.TotalAmount);

            // Zero Auto-Post check: Pending voucher leaves Saving balances & SavingTransactions untouched
            var pendingVoucher = await db.Vouchers.Include(v => v.VoucherDetails).FirstAsync(v => v.VoucherID == exec.VoucherId);
            Assert.Equal("Pending", pendingVoucher.Status);
            Assert.Null(pendingVoucher.ScrollNo);
            Assert.Equal(100m, (await db.SavingAccountMasters.FindAsync(501))!.CurrentBalance);
            Assert.Empty(db.SavingTransactions);

            // Checker approves via VoucherPostingController
            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildPrincipal(20, "manager", "Admin", branchId: 1, bizDate));

            var postRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { exec.VoucherId },
                BusinessDate = bizDate
            });
            Assert.IsType<OkObjectResult>(postRes);

            Assert.Equal(5100m, (await db.SavingAccountMasters.FindAsync(501))!.CurrentBalance);
            Assert.Equal(3200m, (await db.SavingAccountMasters.FindAsync(502))!.CurrentBalance);
            Assert.Equal(2150m, (await db.SavingAccountMasters.FindAsync(503))!.CurrentBalance);
            Assert.Equal(3, await db.SavingTransactions.CountAsync(t => t.VoucherID == exec.VoucherId && t.TransactionType == "Deposit"));
        }

        [Fact]
        public async Task Stage2A_SchemeToSchemeBulkTransfer_EnforcesMinBalance_TransfersToRegularSaving_AndUnpassDeletesLosslessly()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 26);
            await SeedMilkSocietyEnvironmentAsync(db, bizDate);

            // Mahalakshmi Milk Society Saving accounts (MinBal = 100) + Regular Saving accounts (MinBal = 500) for same 3 Customers
            db.SavingAccountMasters.AddRange(
                new SavingAccountMaster { SavingAccountID = 501, BranchID = 1, CustomerID = 101, SavingSchemeID = 2, LedgerID = 47, AccountNo = "00130200000018", OldAccountNo = "3", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 5000m, CurrentBalance = 5000m, MinimumBalance = 100m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 502, BranchID = 1, CustomerID = 102, SavingSchemeID = 2, LedgerID = 47, AccountNo = "00130200000026", OldAccountNo = "6", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 3000m, CurrentBalance = 3000m, MinimumBalance = 100m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 503, BranchID = 1, CustomerID = 103, SavingSchemeID = 2, LedgerID = 47, AccountNo = "00130200000034", OldAccountNo = "8", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 2000m, CurrentBalance = 2000m, MinimumBalance = 100m, Status = "Active" },

                new SavingAccountMaster { SavingAccountID = 601, BranchID = 1, CustomerID = 101, SavingSchemeID = 1, LedgerID = 46, AccountNo = "00130100000011", OldAccountNo = "11", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 500m, CurrentBalance = 500m, MinimumBalance = 500m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 602, BranchID = 1, CustomerID = 102, SavingSchemeID = 1, LedgerID = 46, AccountNo = "00130100000029", OldAccountNo = "12", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 500m, CurrentBalance = 500m, MinimumBalance = 500m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 603, BranchID = 1, CustomerID = 103, SavingSchemeID = 1, LedgerID = 46, AccountNo = "00130100000037", OldAccountNo = "13", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 500m, CurrentBalance = 500m, MinimumBalance = 500m, Status = "Active" }
            );
            await db.SaveChangesAsync();

            var bulkCtrl = new SavingTransactionsController(db);
            AttachUser(bulkCtrl, BuildPrincipal(10, "clerk", "Clerk", branchId: 1, bizDate));

            // 1. Verify CustomerID target auto-matching in GetBulkTransferAccounts
            var gridRes = await bulkCtrl.GetBulkTransferAccounts(branchId: 1, ledgerId: 47, schemeId: 2, targetLedgerId: 46, targetSchemeId: 1);
            var gridOk = Assert.IsType<OkObjectResult>(gridRes);
            var gridJson = System.Text.Json.JsonSerializer.Serialize(gridOk.Value);
            Assert.Contains("\"matchedTargetSavingAccountID\":601", gridJson);
            Assert.Contains("\"matchedTargetSavingAccountID\":602", gridJson);

            // 2. Minimum Balance Guard: trying to debit ₹4,950 from 501 (Balance 5000, MinBal 100 -> Avail 4900) must fail
            var minBalFail = await bulkCtrl.PostBulkSavingTransfer(new SavingBulkTransferRequestDto
            {
                BranchId = 1,
                TransactionDate = bizDate,
                SavingLedgerId = 47,
                SavingSchemeId = 2,
                Direction = "DEBIT",
                ContraMode = "SCHEME_TO_SCHEME",
                ContraLedgerId = 46,
                ContraTargetSchemeId = 1,
                Items = new List<SavingBulkTransferItemInput>
                {
                    new SavingBulkTransferItemInput { SavingAccountId = 501, Amount = 4950m }
                }
            });
            Assert.IsType<BadRequestObjectResult>(minBalFail);

            // 3. Valid Scheme-to-Scheme Bulk Transfer (Dr महालक्ष्मी सेव्हिंग -> Cr रेग्युलर सेव्हिंग ठेव)
            var validTransfer = await bulkCtrl.PostBulkSavingTransfer(new SavingBulkTransferRequestDto
            {
                BranchId = 1,
                TransactionDate = bizDate,
                SavingLedgerId = 47,
                SavingSchemeId = 2,
                Direction = "DEBIT",
                ContraMode = "SCHEME_TO_SCHEME",
                ContraLedgerId = 46,
                ContraTargetSchemeId = 1,
                Narration = "महालक्ष्मी सेव्हिंग मधून रेग्युलर सेव्हिंग ठेव खात्यावर वर्ग",
                Items = new List<SavingBulkTransferItemInput>
                {
                    new SavingBulkTransferItemInput { SavingAccountId = 501, Amount = 4500m },
                    new SavingBulkTransferItemInput { SavingAccountId = 502, Amount = 2500m },
                    new SavingBulkTransferItemInput { SavingAccountId = 503, Amount = 1500m }
                }
            });
            var ok = Assert.IsType<OkObjectResult>(validTransfer);
            var exec = Assert.IsType<SavingBulkTransferExecutionResult>(ok.Value);

            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildPrincipal(20, "manager", "Admin", branchId: 1, bizDate));

            var postRes = await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { exec.VoucherId },
                BusinessDate = bizDate
            });
            Assert.IsType<OkObjectResult>(postRes);

            // Source Mahalakshmi accounts debited; Target Regular Saving accounts credited!
            Assert.Equal(500m, (await db.SavingAccountMasters.FindAsync(501))!.CurrentBalance);
            Assert.Equal(500m, (await db.SavingAccountMasters.FindAsync(502))!.CurrentBalance);
            Assert.Equal(500m, (await db.SavingAccountMasters.FindAsync(503))!.CurrentBalance);

            Assert.Equal(5000m, (await db.SavingAccountMasters.FindAsync(601))!.CurrentBalance);
            Assert.Equal(3000m, (await db.SavingAccountMasters.FindAsync(602))!.CurrentBalance);
            Assert.Equal(2000m, (await db.SavingAccountMasters.FindAsync(603))!.CurrentBalance);

            Assert.Equal(3, await db.SavingTransactions.CountAsync(t => t.VoucherID == exec.VoucherId && t.TransactionType == "Withdrawal"));
            Assert.Equal(3, await db.SavingTransactions.CountAsync(t => t.VoucherID == exec.VoucherId && t.TransactionType == "Deposit"));

            // 4. Unpass + Hard Delete reverses all 6 Saving accounts 100% losslessly
            var unpassRes = await postingCtrl.UnpassVouchers(new VoucherPostingController.UnpassVouchersRequest
            {
                VoucherIds = new List<int> { exec.VoucherId },
                Reason = "Test reversal"
            });
            Assert.IsType<OkObjectResult>(unpassRes);

            var vouchersCtrl = new VouchersController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(vouchersCtrl, BuildPrincipal(20, "manager", "Admin", branchId: 1, bizDate));
            var delRes = await vouchersCtrl.DeleteVoucher(exec.VoucherId, reason: "Testing clean rollback delete");
            Assert.IsType<OkObjectResult>(delRes);

            Assert.Equal(5000m, (await db.SavingAccountMasters.FindAsync(501))!.CurrentBalance);
            Assert.Equal(3000m, (await db.SavingAccountMasters.FindAsync(502))!.CurrentBalance);
            Assert.Equal(2000m, (await db.SavingAccountMasters.FindAsync(503))!.CurrentBalance);
            Assert.Equal(500m, (await db.SavingAccountMasters.FindAsync(601))!.CurrentBalance);
            Assert.Equal(500m, (await db.SavingAccountMasters.FindAsync(602))!.CurrentBalance);
            Assert.Equal(500m, (await db.SavingAccountMasters.FindAsync(603))!.CurrentBalance);
            Assert.Empty(db.SavingTransactions);
            Assert.False(await db.Vouchers.AnyAsync(v => v.VoucherID == exec.VoucherId));
        }

        [Fact]
        public async Task Stage2B_SocietyMasterCifSavingAccountToFarmersRegularSaving_DebitsMasterAndCreditsProducers()
        {
            await using var db = CreateContext();
            var bizDate = new DateTime(2026, 11, 26);
            await SeedMilkSocietyEnvironmentAsync(db, bizDate);

            // Milk Society holds 1 consolidated Saving account (#799) with ₹25,000; Farmers hold Regular Saving accounts
            db.SavingAccountMasters.AddRange(
                new SavingAccountMaster { SavingAccountID = 799, BranchID = 1, CustomerID = 199, SavingSchemeID = 2, LedgerID = 47, AccountNo = "00130200000991", OldAccountNo = "1", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 25000m, CurrentBalance = 25000m, MinimumBalance = 500m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 601, BranchID = 1, CustomerID = 101, SavingSchemeID = 1, LedgerID = 46, AccountNo = "00130100000011", OldAccountNo = "11", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 500m, CurrentBalance = 500m, MinimumBalance = 500m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 602, BranchID = 1, CustomerID = 102, SavingSchemeID = 1, LedgerID = 46, AccountNo = "00130100000029", OldAccountNo = "12", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 500m, CurrentBalance = 500m, MinimumBalance = 500m, Status = "Active" },
                new SavingAccountMaster { SavingAccountID = 603, BranchID = 1, CustomerID = 103, SavingSchemeID = 1, LedgerID = 46, AccountNo = "00130100000037", OldAccountNo = "13", OpeningDate = new DateTime(2025, 4, 1), OpeningBalance = 500m, CurrentBalance = 500m, MinimumBalance = 500m, Status = "Active" }
            );
            await db.SaveChangesAsync();

            var bulkCtrl = new SavingTransactionsController(db);
            AttachUser(bulkCtrl, BuildPrincipal(10, "clerk", "Clerk", branchId: 1, bizDate));

            var res = await bulkCtrl.PostBulkSavingTransfer(new SavingBulkTransferRequestDto
            {
                BranchId = 1,
                TransactionDate = bizDate,
                SavingLedgerId = 46,
                SavingSchemeId = 1,
                Direction = "CREDIT",
                ContraMode = "SAVING_ACCOUNT",
                ContraSavingAccountId = 799, // महालक्ष्मी दूध संस्था बचत खाते
                Narration = "महालक्ष्मी संस्था बचत खात्यातून उत्पादकांच्या बचत खात्यावर वर्ग",
                Items = new List<SavingBulkTransferItemInput>
                {
                    new SavingBulkTransferItemInput { SavingAccountId = 601, Amount = 4000m },
                    new SavingBulkTransferItemInput { SavingAccountId = 602, Amount = 3000m },
                    new SavingBulkTransferItemInput { SavingAccountId = 603, Amount = 1500m }
                }
            });
            var ok = Assert.IsType<OkObjectResult>(res);
            var exec = Assert.IsType<SavingBulkTransferExecutionResult>(ok.Value);

            var postingCtrl = new VoucherPostingController(db, new VoucherRollbackAndDeleteService(db));
            AttachUser(postingCtrl, BuildPrincipal(20, "manager", "Admin", branchId: 1, bizDate));
            await postingCtrl.PostVouchers(new VoucherPostingController.PostVouchersRequest
            {
                VoucherIds = new List<int> { exec.VoucherId },
                BusinessDate = bizDate
            });

            Assert.Equal(16500m, (await db.SavingAccountMasters.FindAsync(799))!.CurrentBalance);
            Assert.Equal(4500m, (await db.SavingAccountMasters.FindAsync(601))!.CurrentBalance);
            Assert.Equal(3500m, (await db.SavingAccountMasters.FindAsync(602))!.CurrentBalance);
            Assert.Equal(2000m, (await db.SavingAccountMasters.FindAsync(603))!.CurrentBalance);
        }
    }
}

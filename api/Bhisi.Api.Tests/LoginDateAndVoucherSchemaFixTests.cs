using System;
using System.Collections.Generic;
using System.IO;
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
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class LoginDateAndVoucherSchemaFixTests
    {
        private static AppDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: $"BhisiLoginDateFix_{Guid.NewGuid()}")
                .ConfigureWarnings(x => x.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static IConfiguration BuildTestConfig()
        {
            return new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Key"] = "unit_test_secret_key_for_smart_banking_1234567890!"
                })
                .Build();
        }

        private static void AttachUser(ControllerBase controller, ClaimsPrincipal principal, string? headerBusinessDate = null)
        {
            var httpContext = new DefaultHttpContext { User = principal };
            if (!string.IsNullOrWhiteSpace(headerBusinessDate))
            {
                httpContext.Request.Headers["X-Business-Date"] = headerBusinessDate;
            }
            controller.ControllerContext = new ControllerContext { HttpContext = httpContext };
        }

        [Fact]
        public async Task FdAutoRenewalBatch_UsesLoginBusinessDate_InsteadOfOpenApril1DayEndStatus()
        {
            await using var db = CreateContext();
            var apr1 = new DateTime(2026, 4, 1);
            var loginNov17 = new DateTime(2026, 11, 17);

            db.SansthaDetails.Add(new SansthaDetail
            {
                SansthaID = 1,
                SansthaName = "पडवळवाडी पतसंस्था",
                FdRenewalReceiptPolicy = "RETAIN_ORIGINAL",
                AllowManualReceiptNoOnRenewal = false
            });
            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", IsActive = true });
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = apr1,
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });
            // Old unclosed day end record stuck on 01/04/2026
            db.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = apr1,
                IsDayClosed = false
            });
            db.AccountGroups.AddRange(
                new AccountGroup { GroupID = 1, GroupName = "ठेवी", NatureOfGroup = "Liabilities", IsActive = true },
                new AccountGroup { GroupID = 2, GroupName = "खर्च", NatureOfGroup = "Expenses", IsActive = true }
            );
            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 1, LedgerCode = "FD-LIAB", LedgerName = "मुदत ठेव", AccountType = "Fixed Deposit", IsActive = true },
                new Ledger { LedgerID = 102, GroupID = 1, LedgerCode = "FD-PAY", LedgerName = "देणे व्याज", AccountType = "Payable", IsActive = true },
                new Ledger { LedgerID = 103, GroupID = 2, LedgerCode = "FD-EXP", LedgerName = "व्याज खर्च", AccountType = "Expenses", IsActive = true }
            );
            db.FdSchemes.Add(new FdScheme
            {
                FdSchemeID = 1,
                SchemeCode = "FD401",
                SchemeName = "साधारण मुदत ठेव",
                DurationMonths = 12,
                DurationType = "Months",
                SchemeDurationModel = "Fixed",
                InterestRate = 9m,
                SeniorCitizenInterestRate = 9.5m,
                InterestType = "Simple",
                FdLiabilityLedgerID = 101,
                InterestPayableLedgerID = 102,
                InterestExpenseLedgerID = 103,
                IsActive = true
            });
            db.Customers.Add(new Customer
            {
                CustomerID = 1,
                CIFNo = "CIF000170",
                FirstName = "नारायण",
                LastName = "गुरव",
                BirthDate = new DateTime(1985, 1, 1),
                BranchID = 1,
                Status = "Active"
            });
            db.Members.Add(new Member { MemberID = 1, CustomerID = 1, MemberCode = "M170", BranchID = 1 });
            db.FdAccounts.Add(new FdAccount
            {
                FdAccountID = 206,
                BranchID = 1,
                FinancialYearID = 1,
                CustomerID = 1,
                FdSchemeID = 1,
                AccountNo = "001-401-0000206-6",
                ReceiptNo = "206",
                LegacyAccountNumber = "206",
                OpeningDate = new DateTime(2025, 11, 17),
                MaturityDate = new DateTime(2026, 11, 17),
                DurationType = "Months",
                DurationValue = 12,
                DurationInDays = 365,
                DepositAmount = 50000m,
                MaturityAmount = 54500m,
                InterestRate = 9m,
                Status = "Active",
                IsAutoRenewable = true,
                AutoRenewalOption = "PrincipalOnly",
                MaxAutoRenewalCycles = 3,
                AutoRenewalCount = 0,
                SavingAccountID = 1
            });
            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 1,
                BranchID = 1,
                CustomerID = 1,
                LedgerID = 102,
                AccountNo = "00110100000001",
                Status = "Active",
                CurrentBalance = 1000m
            });
            await db.SaveChangesAsync();

            var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", "1"),
                new Claim("DefaultBranchID", "1"),
                new Claim("BusinessDate", "2026-11-17")
            }, "TestJwt"));

            var ctrl = new FdAccountsController(db);
            AttachUser(ctrl, principal, headerBusinessDate: "2026-11-17");

            var ok = Assert.IsType<OkObjectResult>(await ctrl.RunAutoRenewalBatch(new AutoRenewalBatchRequest
            {
                BranchID = 1,
                ProcessDate = loginNov17,
                SpecificAccountIDs = new List<int> { 206 }
            }));

            var json = JsonDocument.Parse(JsonSerializer.Serialize(ok.Value)).RootElement;
            Assert.Equal(1, json.GetProperty("SuccessCount").GetInt32());
            string vNo = json.GetProperty("Items")[0].GetProperty("VoucherNo").GetString()!;

            var voucher = await db.Vouchers.FirstAsync(v => v.VoucherNo == vNo);
            Assert.Equal(loginNov17, voucher.VoucherDate.Date);
        }

        [Fact]
        public async Task SwitchBranch_PreservesSessionLoginBusinessDate_WhenNotClosedInTargetBranch()
        {
            await using var db = CreateContext();
            var apr1 = new DateTime(2026, 4, 1);

            db.Roles.Add(new Role { RoleID = 1, RoleName = "Admin" });
            db.Users.Add(new User
            {
                UserID = 1,
                Username = "admin",
                PasswordHash = "x",
                RoleID = 1,
                DefaultBranchID = 1,
                IsActive = true
            });
            db.Branches.AddRange(
                new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", IsActive = true },
                new Branch { BranchID = 2, BranchCode = "BR2", BranchName = "शाखा २", IsActive = true }
            );
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = apr1,
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });
            db.BranchDayEndStatuses.AddRange(
                new BranchDayEndStatus { BranchID = 1, BusinessDate = apr1, IsDayClosed = false },
                new BranchDayEndStatus { BranchID = 2, BusinessDate = apr1, IsDayClosed = false }
            );
            await db.SaveChangesAsync();

            var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "1"),
                new Claim(ClaimTypes.Name, "admin"),
                new Claim(ClaimTypes.Role, "Admin"),
                new Claim("BranchID", "1"),
                new Claim("DefaultBranchID", "1"),
                new Claim("BusinessDate", "2026-11-17")
            }, "TestJwt"));

            var authCtrl = new AuthController(db, BuildTestConfig());
            AttachUser(authCtrl, principal, headerBusinessDate: "2026-11-17");

            var res = await authCtrl.SwitchBranch(new SwitchBranchRequestDto { TargetBranchID = 2 });
            var ok = Assert.IsType<OkObjectResult>(res.Result);
            var dto = Assert.IsType<SwitchBranchResponseDto>(ok.Value);
            Assert.Equal("2026-11-17", dto.BusinessDate);
            Assert.Equal(2, dto.BranchID);
        }

        [Fact]
        public async Task VoucherRollback_DeletesContraVoucherAndEnhancedInvestmentInterestReceipt_Cleanly()
        {
            await using var db = CreateContext();
            var dt = new DateTime(2026, 4, 1);

            db.Branches.Add(new Branch { BranchID = 1, BranchCode = "HO", BranchName = "मुख्य शाखा", IsActive = true });
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-2027",
                StartDate = dt,
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });
            db.BranchDayEndStatuses.Add(new BranchDayEndStatus { BranchID = 1, BusinessDate = dt, IsDayClosed = false });
            db.AccountGroups.Add(new AccountGroup { GroupID = 1, GroupName = "रोख", NatureOfGroup = "Assets", IsActive = true });
            db.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CASH", LedgerName = "रोख", AccountType = "Cash In Hand", IsActive = true },
                new Ledger { LedgerID = 2, GroupID = 1, LedgerCode = "BANK", LedgerName = "बँक", AccountType = "Bank", IsActive = true }
            );
            db.InvestmentInstitutions.Add(new InvestmentInstitution { InstitutionID = 1, InstitutionName = "DCC Bank", BranchID = 1 });
            db.InvestmentSchemes.Add(new InvestmentScheme { SchemeID = 1, SchemeName = "FD Inv" });
            db.InvestmentAccounts.Add(new InvestmentAccount
            {
                InvestmentAccountID = 1,
                BranchID = 1,
                InvestmentInstitutionID = 1,
                SchemeID = 1,
                InvestmentNo = "INV-001",
                PrincipalAmount = 100000m,
                BookValue = 100000m,
                Status = "Active"
            });

            var contraVoucher = new Voucher
            {
                VoucherID = 10,
                BranchID = 1,
                VoucherNo = "001/26-27/CTR/000001",
                VoucherDate = dt,
                VoucherType = "Contra",
                Status = "Pending",
                TotalAmount = 25m,
                Narration = "येणे गुंतवणूकीवरील व्याज • येणे टी.डी.एस कपात"
            };
            var invVoucher = new Voucher
            {
                VoucherID = 11,
                BranchID = 1,
                VoucherNo = "VCH-INV-REC-001",
                VoucherDate = dt,
                VoucherType = "Receipt",
                Status = "Pending",
                TotalAmount = 900m,
                Narration = "गुंतवणूक व्याज प्राप्ती"
            };
            db.Vouchers.AddRange(contraVoucher, invVoucher);
            db.InvestmentInterestReceipts.Add(new InvestmentInterestReceipt
            {
                ReceiptID = 1,
                InvestmentAccountID = 1,
                VoucherID = 11,
                ReceiptDate = dt,
                ReceiptType = "DepositInterest",
                GrossAmount = 1000m,
                TdsAmount = 100m,
                TdsLedgerID = 2,
                ReceivedAmount = 900m,
                PaymentMode = "Bank",
                BankLedgerID = 2,
                ReferenceNo = "REF-1",
                Remarks = "Test"
            });
            await db.SaveChangesAsync();

            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var ctx = new VoucherDeleteRequestContext
            {
                UserId = 1,
                Username = "admin",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "Test voucher delete",
                ActionSource = "VOUCHER_REJECTED_DELETED_POSTING"
            };

            var resContra = await rollbackSvc.DeleteVoucherWithRollbackAsync(10, ctx);
            Assert.True(resContra.Success, resContra.Message);
            Assert.Null(await db.Vouchers.FindAsync(10));

            var resInv = await rollbackSvc.DeleteVoucherWithRollbackAsync(11, ctx);
            Assert.True(resInv.Success, resInv.Message);
            Assert.Null(await db.Vouchers.FindAsync(11));
            Assert.Empty(await db.InvestmentInterestReceipts.ToListAsync());
        }

        [Fact]
        public void SchemaScripts_SeparateGrossAmountAlterAndUpdateBatches_ToPreventCompileError()
        {
            string repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
            string programCs = File.ReadAllText(Path.Combine(repoRoot, "api", "Bhisi.Api", "Program.cs"));
            string masterSql = File.ReadAllText(Path.Combine(repoRoot, "tools", "master_vps_update_schema.sql"));

            // In Program.cs, the InvestmentInterestReceipts UPDATE must run via dynamic SQL EXEC(...) so ALTER TABLE executes first
            Assert.Contains("EXEC(N'UPDATE [dbo].[InvestmentInterestReceipts] SET [GrossAmount] = [ReceivedAmount]", programCs);

            // In master_vps_update_schema.sql, GO must separate ALTER TABLE ADD [GrossAmount] from UPDATE [dbo].[InvestmentInterestReceipts]
            int alterIdx = masterSql.IndexOf("ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [GrossAmount]", StringComparison.Ordinal);
            int updateIdx = masterSql.IndexOf("SET [GrossAmount] = [ReceivedAmount]", StringComparison.Ordinal);
            Assert.True(alterIdx > 0 && updateIdx > alterIdx);
            string between = masterSql.Substring(alterIdx, updateIdx - alterIdx);
            Assert.Contains("GO", between);
        }
    }
}

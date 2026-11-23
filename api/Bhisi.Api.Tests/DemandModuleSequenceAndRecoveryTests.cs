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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class DemandModuleSequenceAndRecoveryTests
    {
        private static AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext BuildAdminContext(int userId = 99, int branchId = 1)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, "TestAdmin"),
                new Claim(ClaimTypes.Role, "Admin"),
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

        private static readonly JsonSerializerOptions CamelOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        private static JsonDocument ParseResultJson(ActionResult<object> actionResult)
        {
            var okResult = Assert.IsType<OkObjectResult>(actionResult.Result);
            string json = JsonSerializer.Serialize(okResult.Value, CamelOpts);
            return JsonDocument.Parse(json);
        }

        private static void SeedCoreMasters(AppDbContext db)
        {
            db.Branches.Add(new Branch { BranchID = 1, BranchName = "मुख्य शाखा", BranchCode = "001" });
            db.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2026-27",
                StartDate = new DateTime(2026, 4, 1),
                EndDate = new DateTime(2027, 3, 31),
                IsActive = true,
                IsClosed = false
            });

            var liabilityGroup = new AccountGroup { GroupID = 10, GroupName = "ठेवी", NatureOfGroup = "Liabilities" };
            var incomeGroup = new AccountGroup { GroupID = 20, GroupName = "उत्पन्न", NatureOfGroup = "Income" };
            var assetGroup = new AccountGroup { GroupID = 30, GroupName = "मालमत्ता व येणे", NatureOfGroup = "Assets" };
            var expGroup = new AccountGroup { GroupID = 40, GroupName = "खर्च", NatureOfGroup = "Expenses" };
            db.AccountGroups.AddRange(liabilityGroup, incomeGroup, assetGroup, expGroup);

            db.Ledgers.AddRange(
                new Ledger { LedgerID = 101, GroupID = 30, LedgerCode = "BNK-01", LedgerName = "DCCB Bank", AccountType = "Bank Account", IsActive = true },
                new Ledger { LedgerID = 201, GroupID = 30, LedgerCode = "LN-01", LedgerName = "में. मोठे कर्ज मुद्दल", AccountType = "Loan", IsActive = true },
                new Ledger { LedgerID = 301, GroupID = 20, LedgerCode = "INT-01", LedgerName = "कर्ज व्याज उत्पन्न", AccountType = "Income", IsActive = true },
                new Ledger { LedgerID = 302, GroupID = 30, LedgerCode = "REC-INT-01", LedgerName = "येणे कर्ज व्याज", AccountType = "Assets", IsActive = true },
                new Ledger { LedgerID = 401, GroupID = 10, LedgerCode = "SNJ-01", LedgerName = "संजीवनी ठेव लेजर", AccountType = "Savings", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 501, GroupID = 10, LedgerCode = "RD-L1", LedgerName = "नियमित RD देयता", AccountType = "Deposits", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 502, GroupID = 10, LedgerCode = "RD-L2", LedgerName = "बालभविष्य RD देयता", AccountType = "Deposits", OpeningBalanceType = "Cr", IsActive = true },
                new Ledger { LedgerID = 601, GroupID = 40, LedgerCode = "EXP-01", LedgerName = "ठेव व्याज खर्च", AccountType = "Expenses", IsActive = true }
            );

            db.EmployerMasters.Add(new EmployerMaster { Id = 1, Name = "राजाराम सारडा प्रा.शि.", IsActive = true });

            db.LoanRates.Add(new LoanRate
            {
                LoanRateID = 1,
                LoanCode = "LN-BIG",
                LoanType = "में. मोठे कर्ज",
                ShortName = "में. मोठे कर्ज",
                InterestRate = 12m,
                InterestCalculationMethod = "Reducing (घटती शिल्लक)",
                LoanLedgerID = 201,
                InterestLedgerID = 301,
                ReceivableInterestLedgerID = 302,
                IsActive = true
            });

            db.SavingInterestSettings.Add(new SavingInterestSetting
            {
                SettingID = 2,
                SchemeCode = "102",
                SchemeName = "संजीवनी ठेव",
                InterestRate = 7.0m,
                CalculationMethod = "Daily Product",
                PostingFrequency = "Yearly",
                SavingLiabilityLedgerID = 401,
                LedgerID = 401,
                InterestExpenseLedgerID = 601,
                EffectiveDate = new DateTime(2026, 4, 1)
            });

            db.RdSchemes.AddRange(
                new RdScheme
                {
                    RdSchemeID = 1,
                    SchemeCode = "RD01",
                    SchemeName = "नियमित RD १२",
                    DurationMonths = 12,
                    MinimumInstallment = 1000m,
                    MaximumInstallment = 50000m,
                    InterestRate = 8m,
                    RdLiabilityLedgerID = 501,
                    IsActive = true
                },
                new RdScheme
                {
                    RdSchemeID = 2,
                    SchemeCode = "RD02",
                    SchemeName = "बालभविष्य RD ३६",
                    DurationMonths = 36,
                    MinimumInstallment = 500m,
                    MaximumInstallment = 50000m,
                    InterestRate = 9m,
                    RdLiabilityLedgerID = 502,
                    IsActive = true
                }
            );

            // Configure single Sanstha Demand Setting:
            // Seq 1 = Loan, Seq 2 = संजीवनी ठेव, Seq 3 = बालभविष्य RD (RdSchemeID 2!), Seq 4 = नियमित RD (RdSchemeID 1!)
            // Intentionally set RdSchemeID 2 BEFORE RdSchemeID 1 to verify Settings SequenceOrder drives order!
            db.DemandColumnSettings.AddRange(
                new DemandColumnSetting
                {
                    DemandColumnSettingId = 1,
                    SequenceOrder = 1,
                    ColumnHeaderMr = "में. मोठे कर्ज",
                    ItemType = "LOAN",
                    LoanRateID = 1,
                    PrincipalOrDepositLedgerID = 201,
                    InterestLedgerID = 301,
                    ReceivableInterestLedgerID = 302,
                    ShowBalanceColumn = true,
                    LoanIntraAllocationOrder = "INTEREST_FIRST",
                    IsActive = true
                },
                new DemandColumnSetting
                {
                    DemandColumnSettingId = 2,
                    SequenceOrder = 2,
                    ColumnHeaderMr = "संजीवनी ठेव",
                    ItemType = "THRIFT_SAVING",
                    SavingSchemeID = 2,
                    PrincipalOrDepositLedgerID = 401,
                    IsContributionTarget = true,
                    DefaultAmount = 0m,
                    IsActive = true
                },
                new DemandColumnSetting
                {
                    DemandColumnSettingId = 3,
                    SequenceOrder = 3,
                    ColumnHeaderMr = "बालभविष्य RD ३६",
                    ItemType = "RD",
                    RdSchemeID = 2,
                    PrincipalOrDepositLedgerID = 502,
                    DefaultAmount = 500m,
                    IsActive = true
                },
                new DemandColumnSetting
                {
                    DemandColumnSettingId = 4,
                    SequenceOrder = 4,
                    ColumnHeaderMr = "नियमित RD १२",
                    ItemType = "RD",
                    RdSchemeID = 1,
                    PrincipalOrDepositLedgerID = 501,
                    DefaultAmount = 1000m,
                    IsActive = true
                }
            );
        }

        [Fact]
        public async Task Preview_SumsMultipleLoansInSameScheme_CreatesMultiRdSubRowsInSettingSequence_AndFiltersOnlyBorrowers()
        {
            using var db = GetInMemoryDbContext(nameof(Preview_SumsMultipleLoansInSameScheme_CreatesMultiRdSubRowsInSettingSequence_AndFiltersOnlyBorrowers));
            SeedCoreMasters(db);

            // Employee 1 (Code "7"): Borrower with 2 active Loans under LoanRateID=1 + 2 RD accounts (Scheme 1 & Scheme 2)
            db.Customers.AddRange(
                new Customer { CustomerID = 11, BranchID = 1, CIFNo = "CIF0011", FirstName = "दिगंबर", LastName = "चव्हाण", EmployerId = 1, EmployeeCode = "7", Status = "Active" },
                new Customer { CustomerID = 12, BranchID = 1, CIFNo = "CIF0012", FirstName = "मधुरा", LastName = "काळे", EmployerId = 1, EmployeeCode = "43", Status = "Active" }
            );
            db.Members.AddRange(
                new Member { MemberID = 101, CustomerID = 11, BranchID = 1, MemberCode = "M101", Status = "Active" },
                new Member { MemberID = 102, CustomerID = 12, BranchID = 1, MemberCode = "M102", Status = "Active" }
            );

            // Two active loans under same LoanRateID=1 for Employee 1
            db.LoanAccounts.AddRange(
                new LoanAccount
                {
                    LoanAccountID = 1001,
                    BranchID = 1,
                    CustomerID = 11,
                    MemberID = 101,
                    LoanRateID = 1,
                    LoanAccountNo = "LN-A",
                    PrincipalBalance = 200000m,
                    PurePrincipalBalance = 200000m,
                    InterestBalance = 500m,
                    InterestRate = 12m,
                    InstallmentAmount = 4000m,
                    OpeningDate = new DateTime(2026, 9, 1),
                    LastInterestPostingDate = new DateTime(2026, 9, 1),
                    MaturityDate = new DateTime(2028, 9, 1),
                    Status = "Active"
                },
                new LoanAccount
                {
                    LoanAccountID = 1002,
                    BranchID = 1,
                    CustomerID = 11,
                    MemberID = 101,
                    LoanRateID = 1,
                    LoanAccountNo = "LN-B",
                    PrincipalBalance = 100000m,
                    PurePrincipalBalance = 100000m,
                    InterestBalance = 200m,
                    InterestRate = 12m,
                    InstallmentAmount = 2250m,
                    OpeningDate = new DateTime(2026, 9, 1),
                    LastInterestPostingDate = new DateTime(2026, 9, 1),
                    MaturityDate = new DateTime(2028, 9, 1),
                    Status = "Active"
                }
            );

            // Schedules due on or before 2026-10-01
            db.LoanInstallmentSchedules.AddRange(
                new LoanInstallmentSchedule { ScheduleID = 1, LoanAccountID = 1001, InstallmentNo = 1, DueDate = new DateTime(2026, 10, 1), PrincipalAmount = 4000m, InterestAmount = 0m, TotalAmount = 4000m, Status = "Pending" },
                new LoanInstallmentSchedule { ScheduleID = 2, LoanAccountID = 1002, InstallmentNo = 1, DueDate = new DateTime(2026, 10, 1), PrincipalAmount = 2250m, InterestAmount = 0m, TotalAmount = 2250m, Status = "Pending" }
            );

            // Employee 1 has 2 RDs: Scheme 1 opened earlier than Scheme 2, but Settings put Scheme 2 at Seq 3 and Scheme 1 at Seq 4!
            db.RdAccounts.AddRange(
                new RdAccount { RdAccountID = 701, BranchID = 1, CustomerID = 11, RdSchemeID = 1, AccountNo = "RD-REG-01", InstallmentAmount = 1000m, OpeningDate = new DateTime(2026, 1, 1), MaturityDate = new DateTime(2027, 1, 1), Status = "Active" },
                new RdAccount { RdAccountID = 702, BranchID = 1, CustomerID = 11, RdSchemeID = 2, AccountNo = "RD-BAL-02", InstallmentAmount = 500m, OpeningDate = new DateTime(2026, 6, 1), MaturityDate = new DateTime(2029, 6, 1), Status = "Active" }
            );

            await db.SaveChangesAsync();

            var ctrl = new DemandNoticesController(db) { ControllerContext = BuildAdminContext() };

            // 1. All employees (OnlyBorrowers = false) + Contribution = 500
            using var docAll = ParseResultJson(await ctrl.PreviewDemandGrid(new DemandPreviewRequestDto
            {
                BranchId = 1,
                EmployerId = 1,
                DemandDate = new DateTime(2026, 10, 1), // 30 days since 2026-09-01
                OnlyBorrowers = false,
                ContributionAmount = 500m
            }));

            var rows = docAll.RootElement.GetProperty("rows");
            Assert.Equal(2, rows.GetArrayLength());

            var emp1 = rows[0];
            Assert.Equal("7", emp1.GetProperty("empCode").GetString());

            var loanCell = emp1.GetProperty("cells")[0];
            Assert.Equal(300000m, loanCell.GetProperty("currentBalanceAmount").GetDecimal()); // 200k + 100k summed
            Assert.Equal(6250m, loanCell.GetProperty("demandPrincipalOrDeposit").GetDecimal()); // 4000 + 2250 yenebaki summed
            Assert.Equal(2, loanCell.GetProperty("accountCount").GetInt32());
            // Daily interest: 200k*12%*30/365=1973 + 500 bal = 2473; 100k*12%*30/365=986 + 200 bal = 1186 => total > 700 prior balance
            Assert.True(loanCell.GetProperty("demandInterest").GetDecimal() > 700m);

            var thriftCell = emp1.GetProperty("cells")[1];
            Assert.Equal(500m, thriftCell.GetProperty("demandPrincipalOrDeposit").GetDecimal());

            // Multi-RD Sub-Row check: Primary RD MUST be Scheme 2 (Seq 3), SubRow[0] MUST be Scheme 1 (Seq 4)!
            var primaryRd = emp1.GetProperty("primaryRd");
            Assert.Equal(702, primaryRd.GetProperty("accountId").GetInt32());
            Assert.Equal(3, primaryRd.GetProperty("sequenceOrder").GetInt32());
            Assert.Equal(500m, primaryRd.GetProperty("demandPrincipalOrDeposit").GetDecimal());

            var rdSubRows = emp1.GetProperty("rdSubRows");
            Assert.Equal(1, rdSubRows.GetArrayLength());
            Assert.Equal(701, rdSubRows[0].GetProperty("accountId").GetInt32());
            Assert.Equal(4, rdSubRows[0].GetProperty("sequenceOrder").GetInt32());
            Assert.Equal(1000m, rdSubRows[0].GetProperty("demandPrincipalOrDeposit").GetDecimal());

            // Employee 2 has no RD sub-rows and gets 500 in Sanjivani Thrift
            var emp2 = rows[1];
            Assert.Equal("43", emp2.GetProperty("empCode").GetString());
            Assert.Equal(0, emp2.GetProperty("rdSubRows").GetArrayLength());
            Assert.Equal(500m, emp2.GetProperty("cells")[1].GetProperty("demandPrincipalOrDeposit").GetDecimal());

            // 2. OnlyBorrowers = true excludes Employee 2
            using var docBorrowersOnly = ParseResultJson(await ctrl.PreviewDemandGrid(new DemandPreviewRequestDto
            {
                BranchId = 1,
                EmployerId = 1,
                DemandDate = new DateTime(2026, 10, 1),
                OnlyBorrowers = true,
                ContributionAmount = 500m
            }));
            Assert.Equal(1, docBorrowersOnly.RootElement.GetProperty("rows").GetArrayLength());
        }

        [Fact]
        public async Task BulkRecovery_EnforcesPerEmployeePool_AllocatesShortSalaryBySequenceIncludingRdSubRow_AndSupportsLosslessRollback()
        {
            using var db = GetInMemoryDbContext(nameof(BulkRecovery_EnforcesPerEmployeePool_AllocatesShortSalaryBySequenceIncludingRdSubRow_AndSupportsLosslessRollback));
            SeedCoreMasters(db);

            db.Customers.AddRange(
                new Customer { CustomerID = 11, BranchID = 1, CIFNo = "CIF0011", FirstName = "दिगंबर", LastName = "चव्हाण", EmployerId = 1, EmployeeCode = "7", Status = "Active" },
                new Customer { CustomerID = 12, BranchID = 1, CIFNo = "CIF0012", FirstName = "मधुरा", LastName = "काळे", EmployerId = 1, EmployeeCode = "43", Status = "Active" }
            );
            db.Members.AddRange(
                new Member { MemberID = 101, CustomerID = 11, BranchID = 1, MemberCode = "M101", Status = "Active" },
                new Member { MemberID = 102, CustomerID = 12, BranchID = 1, MemberCode = "M102", Status = "Active" }
            );

            db.LoanAccounts.Add(new LoanAccount
            {
                LoanAccountID = 1001,
                BranchID = 1,
                CustomerID = 11,
                MemberID = 101,
                LoanRateID = 1,
                LoanAccountNo = "LN-1001",
                PrincipalBalance = 50000m,
                PurePrincipalBalance = 50000m,
                InterestBalance = 100m,
                InterestRate = 12m,
                InstallmentAmount = 900m,
                OpeningDate = new DateTime(2026, 9, 1),
                Status = "Active"
            });
            db.LoanInstallmentSchedules.Add(new LoanInstallmentSchedule
            {
                ScheduleID = 1,
                LoanAccountID = 1001,
                InstallmentNo = 1,
                DueDate = new DateTime(2026, 10, 1),
                PrincipalAmount = 900m,
                InterestAmount = 100m,
                TotalAmount = 1000m,
                Status = "Pending"
            });

            // Existing Saving account for Employee 1; Employee 2 has NO Saving account yet (tests AutoCreateMissingThriftAccount!)
            db.SavingAccountMasters.Add(new SavingAccountMaster
            {
                SavingAccountID = 801,
                BranchID = 1,
                AccountNo = "00110200000015",
                SavingSchemeID = 2,
                CustomerID = 11,
                LedgerID = 401,
                OpeningDate = new DateTime(2026, 4, 1),
                CurrentBalance = 1000m,
                InterestRate = 7m,
                Status = "Active"
            });

            db.RdAccounts.AddRange(
                new RdAccount { RdAccountID = 701, BranchID = 1, CustomerID = 11, RdSchemeID = 1, AccountNo = "RD-REG-01", InstallmentAmount = 1000m, DurationMonths = 12, OpeningDate = new DateTime(2026, 9, 1), MaturityDate = new DateTime(2027, 9, 1), TotalDepositedAmount = 0m, Status = "Active" },
                new RdAccount { RdAccountID = 702, BranchID = 1, CustomerID = 11, RdSchemeID = 2, AccountNo = "RD-BAL-02", InstallmentAmount = 500m, DurationMonths = 36, OpeningDate = new DateTime(2026, 9, 1), MaturityDate = new DateTime(2029, 9, 1), TotalDepositedAmount = 0m, Status = "Active" }
            );

            await db.SaveChangesAsync();

            var noticeCtrl = new DemandNoticesController(db) { ControllerContext = BuildAdminContext() };

            // Save Demand Notice:
            // Emp 1: Seq 1 Loan (900 Prin + 100 Int = 1000), Seq 2 संजीवनी ठेव (500), Seq 3 बालभविष्य RD (500), Seq 4 नियमित RD SubRow (1000) => Total 3000
            // Emp 2: Seq 2 संजीवनी ठेव (500) => Total 500
            using var saveDoc = ParseResultJson(await noticeCtrl.SaveDemandGrid(new SaveDemandGridRequestDto
            {
                BranchId = 1,
                EmployerId = 1,
                DemandDate = new DateTime(2026, 10, 1),
                ContributionAmount = 500m,
                Rows = new List<SaveDemandMemberRowDto>
                {
                    new SaveDemandMemberRowDto
                    {
                        MemberId = 101,
                        CustomerId = 11,
                        EmpCode = "7",
                        CIFNo = "CIF0011",
                        MemberName = "दिगंबर चव्हाण",
                        IsSelected = true,
                        Cells = new List<SaveDemandCellDto>
                        {
                            new SaveDemandCellDto
                            {
                                DemandColumnSettingId = 1,
                                SequenceOrder = 1,
                                ItemType = "LOAN",
                                ColumnHeaderMr = "में. मोठे कर्ज",
                                SchemeId = 1,
                                SourceAccountIdsCsv = "1001",
                                CurrentBalanceAmount = 50000m,
                                DemandPrincipalOrDeposit = 900m,
                                DemandInterest = 100m,
                                PrincipalOrDepositLedgerID = 201,
                                InterestLedgerID = 301,
                                ReceivableInterestLedgerID = 302
                            },
                            new SaveDemandCellDto
                            {
                                DemandColumnSettingId = 2,
                                SequenceOrder = 2,
                                ItemType = "THRIFT_SAVING",
                                ColumnHeaderMr = "संजीवनी ठेव",
                                SchemeId = 2,
                                AccountId = 801,
                                DemandPrincipalOrDeposit = 500m,
                                PrincipalOrDepositLedgerID = 401
                            }
                        },
                        PrimaryRd = new SaveDemandRdItemDto
                        {
                            DemandColumnSettingId = 3,
                            SequenceOrder = 3,
                            SubRowIndex = 0,
                            ColumnHeaderMr = "बालभविष्य RD ३६",
                            RdSchemeID = 2,
                            AccountId = 702,
                            DisplaySubLabel = "बालभविष्य RD ३६ (RD-BAL-02)",
                            DemandPrincipalOrDeposit = 500m,
                            PrincipalOrDepositLedgerID = 502
                        },
                        RdSubRows = new List<SaveDemandRdItemDto>
                        {
                            new SaveDemandRdItemDto
                            {
                                DemandColumnSettingId = 4,
                                SequenceOrder = 4,
                                SubRowIndex = 1,
                                ColumnHeaderMr = "नियमित RD १२",
                                RdSchemeID = 1,
                                AccountId = 701,
                                DisplaySubLabel = "नियमित RD १२ (RD-REG-01)",
                                DemandPrincipalOrDeposit = 1000m,
                                PrincipalOrDepositLedgerID = 501
                            }
                        }
                    },
                    new SaveDemandMemberRowDto
                    {
                        MemberId = 102,
                        CustomerId = 12,
                        EmpCode = "43",
                        CIFNo = "CIF0012",
                        MemberName = "मधुरा काळे",
                        IsSelected = true,
                        Cells = new List<SaveDemandCellDto>
                        {
                            new SaveDemandCellDto
                            {
                                DemandColumnSettingId = 2,
                                SequenceOrder = 2,
                                ItemType = "THRIFT_SAVING",
                                ColumnHeaderMr = "संजीवनी ठेव",
                                SchemeId = 2,
                                AccountId = null, // Auto-open missing thrift account!
                                DemandPrincipalOrDeposit = 500m,
                                PrincipalOrDepositLedgerID = 401
                            }
                        }
                    }
                }
            }));

            int noticeId = saveDoc.RootElement.GetProperty("demandNoticeId").GetInt32();
            Assert.Equal(3500m, saveDoc.RootElement.GetProperty("totalDemandAmount").GetDecimal());

            var savedMdList = await db.DemandMemberDetails.Include(m => m.ColumnItems).Where(m => m.DemandNoticeId == noticeId).ToListAsync();
            int md1Id = savedMdList.First(m => m.MemberId == 101).DemandMemberDetailId;
            int md2Id = savedMdList.First(m => m.MemberId == 102).DemandMemberDetailId;

            var recCtrl = new DemandRecoveriesController(db) { ControllerContext = BuildAdminContext() };

            // Process 1st Bulk Recovery:
            // Emp 1 gives SHORT salary ₹2,200 (out of ₹3,000); Emp 2 gives FULL ₹500 => Total Bank cheque ₹2,700
            // Emp 1 expected Sequence allocation:
            //   Seq 1 Loan: 1000 (100 Int + 900 Prin)
            //   Seq 2 संजीवनी ठेव: 500
            //   Seq 3 बालभविष्य RD (Account 702): 500
            //   Seq 4 नियमित RD SubRow (Account 701): remaining 200 out of 1000!
            using var bulkDoc1 = ParseResultJson(await recCtrl.ProcessBulkRecovery(new BulkDemandRecoveryRequestDto
            {
                RecoveryDate = new DateTime(2026, 10, 5),
                PaymentMode = "Bank",
                BankLedgerID = 101,
                ReferenceNo = "UTR-BULK-001",
                AutoCreateMissingThriftAccount = true,
                IdempotencyKey = "KEY-BULK-1",
                Notices = new List<BulkNoticeRecoveryInputDto>
                {
                    new BulkNoticeRecoveryInputDto
                    {
                        DemandNoticeId = noticeId,
                        Members = new List<BulkMemberRecoveryInputDto>
                        {
                            new BulkMemberRecoveryInputDto { DemandMemberDetailId = md1Id, IsSelected = true, ActualReceivedAmount = 2200m },
                            new BulkMemberRecoveryInputDto { DemandMemberDetailId = md2Id, IsSelected = true, ActualReceivedAmount = 500m }
                        }
                    }
                }
            }));

            int vch1Id = bulkDoc1.RootElement.GetProperty("recoveries")[0].GetProperty("voucherId").GetInt32();
            Assert.Equal("PartiallyReceived", bulkDoc1.RootElement.GetProperty("recoveries")[0].GetProperty("demandStatus").GetString());

            // Check Employee 1 Loan balance + Schedule synced to Paid!
            var loan1 = await db.LoanAccounts.FindAsync(1001);
            Assert.Equal(49100m, loan1!.PrincipalBalance);
            Assert.Equal(0m, loan1.InterestBalance);
            var sch1 = await db.LoanInstallmentSchedules.FindAsync(1);
            Assert.Equal("Paid", sch1!.Status);

            // Check Employee 1 Saving & Auto-Created Employee 2 Saving!
            var emp1Sav = await db.SavingAccountMasters.FindAsync(801);
            Assert.Equal(1500m, emp1Sav!.CurrentBalance);
            var emp2Sav = await db.SavingAccountMasters.FirstOrDefaultAsync(s => s.CustomerID == 12);
            Assert.NotNull(emp2Sav);
            Assert.Equal(500m, emp2Sav!.CurrentBalance);

            // Check Multi-RD Sub-Row balances: Seq 3 got full 500, Seq 4 SubRow got partial 200
            var rdBal = await db.RdAccounts.FindAsync(702);
            var rdReg = await db.RdAccounts.FindAsync(701);
            Assert.Equal(500m, rdBal!.TotalDepositedAmount);
            Assert.Equal(200m, rdReg!.TotalDepositedAmount);

            // Verify Voucher 1 is Strictly Balanced (Total Dr == Total Cr == 2700)
            var vch1Details = await db.VoucherDetails.Where(d => d.VoucherID == vch1Id).ToListAsync();
            Assert.Equal(2700m, vch1Details.Where(d => d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(2700m, vch1Details.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));

            // Approve 1st Voucher in Voucher Passing (Maker-Checker) before posting 2nd remainder cheque recovery;
            // also proves Pending-Voucher Guard blocks colliding Pending recoveries on the same Notice.
            var pendingCollisionRes = await recCtrl.ProcessBulkRecovery(new BulkDemandRecoveryRequestDto
            {
                RecoveryDate = new DateTime(2026, 10, 10),
                PaymentMode = "Bank",
                BankLedgerID = 101,
                Notices = new List<BulkNoticeRecoveryInputDto>
                {
                    new BulkNoticeRecoveryInputDto
                    {
                        DemandNoticeId = noticeId,
                        Members = new List<BulkMemberRecoveryInputDto>
                        {
                            new BulkMemberRecoveryInputDto { DemandMemberDetailId = md1Id, IsSelected = true, ActualReceivedAmount = 800m }
                        }
                    }
                }
            });
            Assert.IsType<BadRequestObjectResult>(pendingCollisionRes.Result);

            var vch1Entity = await db.Vouchers.FindAsync(vch1Id);
            vch1Entity!.Status = "Approved";
            await db.SaveChangesAsync();

            // 2nd Bulk Recovery for Employee 1's remaining ₹800 on RD SubRow (701)
            using var bulkDoc2 = ParseResultJson(await recCtrl.ProcessBulkRecovery(new BulkDemandRecoveryRequestDto
            {
                RecoveryDate = new DateTime(2026, 10, 10),
                PaymentMode = "Bank",
                BankLedgerID = 101,
                ReferenceNo = "UTR-BULK-002",
                IdempotencyKey = "KEY-BULK-2",
                Notices = new List<BulkNoticeRecoveryInputDto>
                {
                    new BulkNoticeRecoveryInputDto
                    {
                        DemandNoticeId = noticeId,
                        Members = new List<BulkMemberRecoveryInputDto>
                        {
                            new BulkMemberRecoveryInputDto { DemandMemberDetailId = md1Id, IsSelected = true, ActualReceivedAmount = 800m }
                        }
                    }
                }
            }));

            int vch2Id = bulkDoc2.RootElement.GetProperty("recoveries")[0].GetProperty("voucherId").GetInt32();
            Assert.Equal("Received", bulkDoc2.RootElement.GetProperty("recoveries")[0].GetProperty("demandStatus").GetString());
            Assert.Equal(1000m, (await db.RdAccounts.FindAsync(701))!.TotalDepositedAmount);

            // Now REJECT / ROLLBACK 2nd Voucher (₹800) and verify lossless rollback back to ₹200 RD & PartiallyReceived!
            var rollbackSvc = new VoucherRollbackAndDeleteService(db);
            var delResult = await rollbackSvc.DeleteVoucherWithRollbackAsync(vch2Id, new VoucherDeleteRequestContext
            {
                UserId = 99,
                Username = "Checker",
                UserRole = "Admin",
                UserBranchId = 1,
                IsHeadOfficeAdmin = true,
                Reason = "Cheque 2 bounced - testing Demand Recovery lossless rollback"
            });

            Assert.True(delResult.Success, delResult.Message);
            Assert.Equal(200m, (await db.RdAccounts.FindAsync(701))!.TotalDepositedAmount);
            var noticeAfterRb = await db.DemandNotices.FindAsync(noticeId);
            Assert.Equal("PartiallyReceived", noticeAfterRb!.Status);
            Assert.Equal(2700m, noticeAfterRb.TotalRecoveredAmount);
            var md1AfterRb = await db.DemandMemberDetails.FindAsync(md1Id);
            Assert.Equal("Partial", md1AfterRb!.RecoveryStatus);
            Assert.False(md1AfterRb.IsProcessed);
        }

        [Fact]
        public async Task SavingInterestPosting_AnnualMeetingRate_FiltersOnlySanjivaniScheme_AndCapitalizesIntoPrincipal()
        {
            using var db = GetInMemoryDbContext(nameof(SavingInterestPosting_AnnualMeetingRate_FiltersOnlySanjivaniScheme_AndCapitalizesIntoPrincipal));
            SeedCoreMasters(db);

            // Regular Saving Scheme (SettingID = 1, 3%)
            db.SavingInterestSettings.Add(new SavingInterestSetting
            {
                SettingID = 1,
                SchemeCode = "101",
                SchemeName = "नियमित बचत",
                InterestRate = 3.0m,
                CalculationMethod = "Daily Product",
                PostingFrequency = "Half-Yearly",
                SavingLiabilityLedgerID = 401,
                InterestExpenseLedgerID = 601,
                EffectiveDate = new DateTime(2026, 4, 1)
            });

            db.Customers.Add(new Customer { CustomerID = 21, BranchID = 1, CIFNo = "CIF0021", FirstName = "संतोष", LastName = "पवार", Status = "Active" });

            // Account 1: Regular Saving ₹10,000; Account 2: संजीवनी ठेव (Scheme 2) ₹10,000 (Leap=false 2026, 365 days)
            db.SavingAccountMasters.AddRange(
                new SavingAccountMaster
                {
                    SavingAccountID = 901,
                    BranchID = 1,
                    AccountNo = "00110100000011",
                    SavingSchemeID = 1,
                    CustomerID = 21,
                    LedgerID = 401,
                    OpeningDate = new DateTime(2025, 4, 1),
                    OpeningBalance = 10000m,
                    CurrentBalance = 10000m,
                    InterestRate = 3m,
                    Status = "Active"
                },
                new SavingAccountMaster
                {
                    SavingAccountID = 902,
                    BranchID = 1,
                    AccountNo = "00110200000022",
                    SavingSchemeID = 2,
                    CustomerID = 21,
                    LedgerID = 401,
                    OpeningDate = new DateTime(2025, 4, 1),
                    OpeningBalance = 10000m,
                    CurrentBalance = 10000m,
                    InterestRate = 7m,
                    Status = "Active"
                }
            );
            await db.SaveChangesAsync();

            var postCtrl = new SavingInterestPostingsController(db) { ControllerContext = BuildAdminContext() };

            // Society annual meeting decides 8.5% on संजीवनी ठेव (SavingSchemeID = 2) for 365 days (2025-04-01 to 2026-03-31)
            var res = await postCtrl.PostInterest(new InterestPostingRequest
            {
                PeriodStart = new DateTime(2025, 4, 1),
                PeriodEnd = new DateTime(2026, 3, 31),
                PostingDate = new DateTime(2026, 3, 31),
                PostedBy = 99,
                SavingSchemeID = 2,
                OverrideInterestRate = 8.5m
            });

            Assert.IsType<OkObjectResult>(res);

            var regularAcc = await db.SavingAccountMasters.FindAsync(901);
            var sanjivaniAcc = await db.SavingAccountMasters.FindAsync(902);

            Assert.Equal(10000m, regularAcc!.CurrentBalance); // Regular saving untouched
            Assert.Equal(10850m, sanjivaniAcc!.CurrentBalance); // ₹850 annual meeting interest (8.5%) capitalized directly into principal!
            Assert.Equal(8.5m, sanjivaniAcc.InterestRate);

            var intTxn = await db.SavingTransactions.FirstOrDefaultAsync(t => t.SavingAccountID == 902 && t.TransactionType == "Interest");
            Assert.NotNull(intTxn);
            Assert.Equal(850m, intTxn!.Amount);
            Assert.True(intTxn.VoucherID > 0);
        }

        [Fact]
        public async Task PreviewAndGetGrid_ExposesRdZoneSequenceBeforeNonRdColumns_WhenRdIsSequenceOne()
        {
            using var db = GetInMemoryDbContext(nameof(PreviewAndGetGrid_ExposesRdZoneSequenceBeforeNonRdColumns_WhenRdIsSequenceOne));
            SeedCoreMasters(db);

            // Reorder existing DemandColumnSettings: Seq 1 = नियमित RD, Seq 2 = Loan, Seq 3 = संजीवनी ठेव, Seq 4 = बालभविष्य RD
            var sLoan = await db.DemandColumnSettings.FindAsync(1);
            var sThrift = await db.DemandColumnSettings.FindAsync(2);
            var sRd2 = await db.DemandColumnSettings.FindAsync(3);
            var sRd1 = await db.DemandColumnSettings.FindAsync(4);
            sRd1!.SequenceOrder = 1;
            sLoan!.SequenceOrder = 2;
            sThrift!.SequenceOrder = 3;
            sRd2!.SequenceOrder = 4;

            db.Customers.Add(new Customer { CustomerID = 31, BranchID = 1, CIFNo = "CIF0031", FirstName = "प्रवीण", LastName = "जोशी", EmployerId = 1, EmployeeCode = "15", Status = "Active" });
            db.Members.Add(new Member { MemberID = 131, CustomerID = 31, BranchID = 1, MemberCode = "M131", Status = "Active" });
            db.RdAccounts.Add(new RdAccount
            {
                RdAccountID = 801,
                BranchID = 1,
                CustomerID = 31,
                RdSchemeID = 1,
                AccountNo = "RD-801",
                InstallmentAmount = 1000m,
                TotalDepositedAmount = 3000m,
                OpeningDate = new DateTime(2026, 1, 1),
                MaturityDate = new DateTime(2027, 1, 1),
                Status = "Active"
            });
            await db.SaveChangesAsync();

            var noticeCtrl = new DemandNoticesController(db) { ControllerContext = BuildAdminContext() };
            using var prevDoc = ParseResultJson(await noticeCtrl.PreviewDemandGrid(new DemandPreviewRequestDto
            {
                BranchId = 1,
                EmployerId = 1,
                DemandDate = new DateTime(2026, 10, 31),
                ContributionAmount = 500m
            }));

            Assert.True(prevDoc.RootElement.GetProperty("hasRdZone").GetBoolean());
            Assert.Equal(1, prevDoc.RootElement.GetProperty("rdZoneSequence").GetInt32());
            var cols = prevDoc.RootElement.GetProperty("columns");
            Assert.Equal(2, cols.GetArrayLength());
            Assert.Equal(2, cols[0].GetProperty("sequenceOrder").GetInt32());
            Assert.Equal(3, cols[1].GetProperty("sequenceOrder").GetInt32());
        }

        [Fact]
        public async Task ValidateDemandGrid_CatchesMissingRdLedger_AndChecksInactiveHistoricalSetting()
        {
            using var db = GetInMemoryDbContext(nameof(ValidateDemandGrid_CatchesMissingRdLedger_AndChecksInactiveHistoricalSetting));
            SeedCoreMasters(db);

            // Soft-deactivated historical column missing PrincipalOrDepositLedgerID
            db.DemandColumnSettings.Add(new DemandColumnSetting
            {
                DemandColumnSettingId = 98,
                SequenceOrder = 9999,
                ColumnHeaderMr = "जुनी वर्गणी ठेव",
                ItemType = "THRIFT_SAVING",
                SavingSchemeID = 2,
                PrincipalOrDepositLedgerID = null,
                IsActive = false
            });

            // RD Scheme & Setting both missing PrincipalOrDepositLedgerID / RdLiabilityLedgerID
            db.RdSchemes.Add(new RdScheme
            {
                RdSchemeID = 99,
                SchemeCode = "RD99",
                SchemeName = "अपूर्ण लेजर RD",
                DurationMonths = 12,
                MinimumInstallment = 500m,
                MaximumInstallment = 10000m,
                InterestRate = 7m,
                RdLiabilityLedgerID = null,
                IsActive = true
            });
            db.DemandColumnSettings.Add(new DemandColumnSetting
            {
                DemandColumnSettingId = 99,
                SequenceOrder = 5,
                ColumnHeaderMr = "अपूर्ण लेजर RD",
                ItemType = "RD",
                RdSchemeID = 99,
                PrincipalOrDepositLedgerID = null,
                IsActive = true
            });
            await db.SaveChangesAsync();

            var noticeCtrl = new DemandNoticesController(db) { ControllerContext = BuildAdminContext() };
            using var valDoc = ParseResultJson(await noticeCtrl.ValidateDemandGrid(new SaveDemandGridRequestDto
            {
                BranchId = 1,
                EmployerId = 1,
                DemandDate = new DateTime(2026, 10, 31),
                Rows = new List<SaveDemandMemberRowDto>
                {
                    new SaveDemandMemberRowDto
                    {
                        MemberId = 101,
                        EmpCode = "7",
                        MemberName = "दिगंबर चव्हाण",
                        IsSelected = true,
                        Cells = new List<SaveDemandCellDto>
                        {
                            new SaveDemandCellDto
                            {
                                DemandColumnSettingId = 98,
                                SequenceOrder = 1,
                                ItemType = "THRIFT_SAVING",
                                ColumnHeaderMr = "जुनी वर्गणी ठेव",
                                DemandPrincipalOrDeposit = 500m
                            }
                        },
                        PrimaryRd = new SaveDemandRdItemDto
                        {
                            DemandColumnSettingId = 99,
                            SequenceOrder = 5,
                            SubRowIndex = 0,
                            ColumnHeaderMr = "अपूर्ण लेजर RD",
                            RdSchemeID = 99,
                            AccountId = 701,
                            DemandPrincipalOrDeposit = 500m,
                            PrincipalOrDepositLedgerID = null
                        }
                    }
                }
            }));

            Assert.False(valDoc.RootElement.GetProperty("isValid").GetBoolean());
            var errors = valDoc.RootElement.GetProperty("errors").EnumerateArray().Select(e => e.GetString() ?? "").ToList();
            var warnings = valDoc.RootElement.GetProperty("warnings").EnumerateArray().Select(w => w.GetString() ?? "").ToList();

            Assert.Contains(errors, e => e.Contains("जुनी वर्गणी ठेव"));
            Assert.Contains(errors, e => e.Contains("अपूर्ण लेजर RD"));
            Assert.Contains(warnings, w => w.Contains("जुनी वर्गणी ठेव") && w.Contains("निष्क्रिय"));
        }
    }
}

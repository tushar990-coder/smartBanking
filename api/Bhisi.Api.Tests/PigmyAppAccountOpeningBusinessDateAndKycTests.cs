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
using Xunit;

namespace Bhisi.Api.Tests
{
    public class PigmyAppAccountOpeningBusinessDateAndKycTests
    {
        private static AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;
            return new AppDbContext(options);
        }

        private static ControllerContext BuildUserContext(string role, int userOrAgentId, int branchId = 1, bool isAgent = false)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, isAgent ? "TestAgent" : "StaffClerk"),
                new Claim(ClaimTypes.Role, role),
                new Claim(ClaimTypes.NameIdentifier, userOrAgentId.ToString()),
                new Claim("BranchID", branchId.ToString()),
                new Claim("DefaultBranchID", branchId.ToString())
            };
            if (isAgent)
            {
                claims.Add(new Claim("agentId", userOrAgentId.ToString()));
                claims.Add(new Claim("AgentId", userOrAgentId.ToString()));
            }

            return new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
                }
            };
        }

        private static string GenerateValidAadhaar(string firstElevenDigits)
        {
            for (char d = '0'; d <= '9'; d++)
            {
                string candidate = firstElevenDigits + d;
                if (KycValidationHelper.IsValidAadhaar(candidate, out _))
                {
                    return candidate;
                }
            }
            throw new InvalidOperationException("Failed to generate valid Aadhaar checksum for test.");
        }

        [Fact]
        public async Task CreateCustomer_And_CreateAccount_UseActiveCbsBusinessDate_SchemeDuration_AndStaffUserId()
        {
            using var context = GetInMemoryDbContext(nameof(CreateCustomer_And_CreateAccount_UseActiveCbsBusinessDate_SchemeDuration_AndStaffUserId));
            var closedPrevDay = new DateTime(2026, 4, 26);
            var activeBusinessDate = new DateTime(2026, 4, 27);

            context.Branches.Add(new Branch { BranchID = 1, BranchCode = "001", BranchName = "Main Branch" });
            context.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = closedPrevDay,
                IsDayClosed = true
            });
            context.PigmySchemes.Add(new PigmyScheme
            {
                PigmySchemeID = 1,
                SchemeCode = "301",
                SchemeName = "१८ महिने दैनिक पिग्मी",
                DurationMonths = 18,
                InterestRate = 5.5m,
                Status = "Active"
            });
            context.PigmyAgents.Add(new PigmyAgent
            {
                PigmyAgentID = 5,
                AgentName = "एजंट पाच",
                BranchID = 1,
                Status = "Active"
            });
            await context.SaveChangesAsync();

            var appCtrl = new PigmyAppController(context) { ControllerContext = BuildUserContext("Clerk", userOrAgentId: 42, branchId: 1) };
            var mobileCtrl = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildUserContext("Clerk", userOrAgentId: 42, branchId: 1)
            };

            string aadhaar1 = GenerateValidAadhaar("23456789012");
            string aadhaar2 = GenerateValidAadhaar("34567890123");

            var res1 = await appCtrl.CreateCustomer(new PigmyAppController.CreateCustomerDto
            {
                FirstName = "सुनील",
                LastName = "सावंत",
                MobileNo = "9876543210",
                AadhaarNo = aadhaar1,
                BranchID = 1,
                AgentId = 5
            }, headerAgentId: 0);
            Assert.IsType<OkObjectResult>(res1);

            var res2 = await mobileCtrl.CreateAccount(new PigmyMobileApiController.CreateAccountRequestDto
            {
                FirstName = "रमेश",
                LastName = "शिंदे",
                MobileNo = "9876543211",
                AadhaarNo = aadhaar2,
                BranchID = 1,
                AgentId = 5,
                DailyDepositAmount = 200m
            });
            Assert.IsType<OkObjectResult>(res2);

            var customers = await context.Customers.OrderBy(c => c.CustomerID).ToListAsync();
            Assert.Equal(2, customers.Count);
            Assert.All(customers, c =>
            {
                Assert.Equal(activeBusinessDate.Date, c.RegistrationDate.Date);
                Assert.Equal(42, c.CreatedBy);
            });

            var accounts = await context.PigmyAccounts.OrderBy(a => a.PigmyAccountID).ToListAsync();
            Assert.Equal(2, accounts.Count);
            Assert.All(accounts, a =>
            {
                Assert.Equal(activeBusinessDate.Date, a.OpeningDate.Date);
                Assert.Equal(activeBusinessDate.AddMonths(18).Date, a.MaturityDate.Date);
                Assert.Equal(5.5m, a.InterestRate);
                Assert.Equal(42, a.CreatedBy);
            });
        }

        [Fact]
        public async Task DuplicateAadhaarAndPan_AreRejectedAcrossAllEndpoints_WhileSoftDeletedCustomerAllowsReuse()
        {
            using var context = GetInMemoryDbContext(nameof(DuplicateAadhaarAndPan_AreRejectedAcrossAllEndpoints_WhileSoftDeletedCustomerAllowsReuse));
            string dupAadhaar = GenerateValidAadhaar("45678901234");
            string formattedDupAadhaar = $"{dupAadhaar.Substring(0, 4)} {dupAadhaar.Substring(4, 4)} {dupAadhaar.Substring(8, 4)}";
            string deletedAadhaar = GenerateValidAadhaar("56789012345");
            string validUniqueAadhaar = GenerateValidAadhaar("67890123456");

            context.Branches.Add(new Branch { BranchID = 1, BranchCode = "001", BranchName = "Main Branch" });
            context.PigmySchemes.Add(new PigmyScheme { PigmySchemeID = 1, SchemeCode = "301", SchemeName = "दैनिक पिग्मी", DurationMonths = 12, InterestRate = 4m, Status = "Active" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 5, AgentName = "एजंट पाच", BranchID = 1, Status = "Active" });

            context.Customers.AddRange(
                new Customer
                {
                    CustomerID = 1,
                    BranchID = 1,
                    CIFNo = "CIF000001",
                    FirstName = "विद्यमान",
                    LastName = "ग्राहक",
                    MobileNo = "9900000001",
                    AadhaarNo = dupAadhaar,
                    PANNo = "ABCPD1234F",
                    IsDeleted = false,
                    Status = "Active"
                },
                new Customer
                {
                    CustomerID = 2,
                    BranchID = 1,
                    CIFNo = "CIF000002",
                    FirstName = "हटवलेला",
                    LastName = "ग्राहक",
                    MobileNo = "9900000002",
                    AadhaarNo = deletedAadhaar,
                    PANNo = "XYZPK5678L",
                    IsDeleted = true,
                    Status = "Inactive"
                }
            );
            context.AgentCustomerRequests.Add(new AgentCustomerRequest
            {
                RequestID = 10,
                BranchID = 1,
                PigmyAgentID = 5,
                FirstName = "नवीन",
                LastName = "अर्जदार",
                MobileNo = "9900000003",
                AadhaarNo = dupAadhaar,
                Status = "Pending"
            });
            await context.SaveChangesAsync();

            var appCtrl = new PigmyAppController(context) { ControllerContext = BuildUserContext("Clerk", 42) };
            var mobileStaffCtrl = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildUserContext("Clerk", 42)
            };
            var mobileAgentCtrl = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildUserContext("AGENT", 5, isAgent: true)
            };
            var reqCtrl = new AgentCustomerRequestsController(context) { ControllerContext = BuildUserContext("Clerk", 42) };

            // 1. PigmyApp.CreateCustomer rejects formatted duplicate Aadhaar
            var r1 = await appCtrl.CreateCustomer(new PigmyAppController.CreateCustomerDto
            {
                FirstName = "नवीन",
                LastName = "एक",
                MobileNo = "9811111111",
                AadhaarNo = formattedDupAadhaar,
                BranchID = 1,
                AgentId = 5
            }, 0);
            Assert.IsType<BadRequestObjectResult>(r1);

            // 2. PigmyMobileApi.CreateAccount rejects duplicate PAN (case-insensitive)
            var r2 = await mobileStaffCtrl.CreateAccount(new PigmyMobileApiController.CreateAccountRequestDto
            {
                FirstName = "नवीन",
                LastName = "दोन",
                MobileNo = "9811111112",
                AadhaarNo = validUniqueAadhaar,
                PANNo = "abcpd1234f",
                BranchID = 1,
                AgentId = 5
            });
            Assert.IsType<BadRequestObjectResult>(r2);

            // 3. PigmyMobileApi.CreateAccountRequest rejects duplicate Aadhaar
            var r3 = await mobileAgentCtrl.CreateAccountRequest(new PigmyMobileApiController.MobileCreateRequestDto
            {
                FirstName = "नवीन",
                LastName = "तीन",
                MobileNo = "9811111113",
                AadhaarNo = dupAadhaar
            });
            Assert.IsType<BadRequestObjectResult>(r3);

            // 4. ApproveAndCreateRequest rejects duplicate Aadhaar
            var r4 = await reqCtrl.ApproveAndCreateRequest(10, new ApproveAndCreateRequestDto
            {
                CustomerData = new Customer
                {
                    BranchID = 1,
                    FirstName = "नवीन",
                    LastName = "अर्जदार",
                    MobileNo = "9900000003",
                    AadhaarNo = dupAadhaar
                },
                PigmyData = new PigmyAccountCreationDto { OpenPigmyAccount = true, PigmySchemeID = 1, PigmyAgentID = 5 },
                ApprovedByUserID = 42
            });
            Assert.IsType<BadRequestObjectResult>(r4);

            // 5. Soft-deleted customer's Aadhaar & PAN can be reused cleanly
            var okReused = await mobileStaffCtrl.CreateAccount(new PigmyMobileApiController.CreateAccountRequestDto
            {
                FirstName = "पुन्हा",
                LastName = "नोंदणी",
                MobileNo = "9811111199",
                AadhaarNo = deletedAadhaar,
                PANNo = "XYZPK5678L",
                BranchID = 1,
                AgentId = 5
            });
            Assert.IsType<OkObjectResult>(okReused);
        }

        [Fact]
        public async Task CreateAccount_RejectsDuplicateOldAccountNoInSameScheme_AllowsDifferentScheme()
        {
            using var context = GetInMemoryDbContext(nameof(CreateAccount_RejectsDuplicateOldAccountNoInSameScheme_AllowsDifferentScheme));

            context.Branches.Add(new Branch { BranchID = 1, BranchCode = "001", BranchName = "Main Branch" });
            context.PigmySchemes.AddRange(
                new PigmyScheme { PigmySchemeID = 1, SchemeCode = "301", SchemeName = "योजना १", DurationMonths = 12, InterestRate = 4m, Status = "Active" },
                new PigmyScheme { PigmySchemeID = 2, SchemeCode = "302", SchemeName = "योजना २", DurationMonths = 24, InterestRate = 5m, Status = "Active" }
            );
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 5, AgentName = "एजंट पाच", BranchID = 1, Status = "Active" });
            await context.SaveChangesAsync();

            var ctrl = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildUserContext("Clerk", 42)
            };

            var firstOk = await ctrl.CreateAccount(new PigmyMobileApiController.CreateAccountRequestDto
            {
                FirstName = "ग्राहक",
                LastName = "पहिला",
                MobileNo = "9800000001",
                PigmySchemeID = 1,
                OldAccountNo = "PG-OLD-55",
                BranchID = 1,
                AgentId = 5
            });
            Assert.IsType<OkObjectResult>(firstOk);

            var dupSameScheme = await ctrl.CreateAccount(new PigmyMobileApiController.CreateAccountRequestDto
            {
                FirstName = "ग्राहक",
                LastName = "दुसरा",
                MobileNo = "9800000002",
                PigmySchemeID = 1,
                OldAccountNo = "PG-OLD-55",
                BranchID = 1,
                AgentId = 5
            });
            Assert.IsType<BadRequestObjectResult>(dupSameScheme);

            var diffSchemeOk = await ctrl.CreateAccount(new PigmyMobileApiController.CreateAccountRequestDto
            {
                FirstName = "ग्राहक",
                LastName = "तिसरा",
                MobileNo = "9800000003",
                PigmySchemeID = 2,
                OldAccountNo = "PG-OLD-55",
                BranchID = 1,
                AgentId = 5
            });
            Assert.IsType<OkObjectResult>(diffSchemeOk);
        }

        [Fact]
        public async Task AccountOpening_BlocksWhenBranchBusinessDateFallsInClosedFinancialYear()
        {
            using var context = GetInMemoryDbContext(nameof(AccountOpening_BlocksWhenBranchBusinessDateFallsInClosedFinancialYear));
            var closedFyBusinessDate = new DateTime(2026, 3, 20);

            context.Branches.Add(new Branch { BranchID = 1, BranchCode = "001", BranchName = "Main Branch" });
            context.FinancialYears.Add(new FinancialYear
            {
                FinancialYearID = 1,
                YearCode = "2025-2026",
                StartDate = new DateTime(2025, 4, 1),
                EndDate = new DateTime(2026, 3, 31),
                IsClosed = true,
                IsActive = false
            });
            context.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = closedFyBusinessDate,
                IsDayClosed = false
            });
            context.PigmySchemes.Add(new PigmyScheme { PigmySchemeID = 1, SchemeCode = "301", SchemeName = "दैनिक", Status = "Active" });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 5, AgentName = "एजंट पाच", BranchID = 1, Status = "Active" });
            context.AgentCustomerRequests.Add(new AgentCustomerRequest
            {
                RequestID = 20,
                BranchID = 1,
                PigmyAgentID = 5,
                FirstName = "विनंती",
                LastName = "ग्राहक",
                MobileNo = "9899999999",
                Status = "Pending"
            });
            await context.SaveChangesAsync();

            var appCtrl = new PigmyAppController(context) { ControllerContext = BuildUserContext("Clerk", 42) };
            var mobileStaffCtrl = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildUserContext("Clerk", 42)
            };
            var mobileAgentCtrl = new PigmyMobileApiController(context, new AgentLockService(context), new PigmySyncService(context, new AgentLockService(context)))
            {
                ControllerContext = BuildUserContext("AGENT", 5, isAgent: true)
            };
            var reqCtrl = new AgentCustomerRequestsController(context) { ControllerContext = BuildUserContext("Clerk", 42) };

            Assert.IsType<BadRequestObjectResult>(await appCtrl.CreateCustomer(new PigmyAppController.CreateCustomerDto
            {
                FirstName = "एक",
                LastName = "दोन",
                MobileNo = "9811111111",
                BranchID = 1,
                AgentId = 5
            }, 0));

            Assert.IsType<BadRequestObjectResult>(await mobileStaffCtrl.CreateAccount(new PigmyMobileApiController.CreateAccountRequestDto
            {
                FirstName = "तीन",
                LastName = "चार",
                MobileNo = "9811111112",
                BranchID = 1,
                AgentId = 5
            }));

            Assert.IsType<BadRequestObjectResult>(await mobileAgentCtrl.CreateAccountRequest(new PigmyMobileApiController.MobileCreateRequestDto
            {
                FirstName = "पाच",
                LastName = "सहा",
                MobileNo = "9811111113"
            }));

            Assert.IsType<BadRequestObjectResult>(await reqCtrl.ApproveAndCreateRequest(20, new ApproveAndCreateRequestDto
            {
                CustomerData = new Customer { BranchID = 1, FirstName = "विनंती", LastName = "ग्राहक", MobileNo = "9899999999" },
                PigmyData = new PigmyAccountCreationDto { OpenPigmyAccount = true, PigmySchemeID = 1, PigmyAgentID = 5 },
                ApprovedByUserID = 42
            }));
        }

        [Fact]
        public async Task ApproveAndCreateRequest_WithOpeningBalance_StampsBusinessDateOnCustomerAccountTransactionAndVoucher()
        {
            using var context = GetInMemoryDbContext(nameof(ApproveAndCreateRequest_WithOpeningBalance_StampsBusinessDateOnCustomerAccountTransactionAndVoucher));
            var closedPrevDay = new DateTime(2026, 4, 26);
            var activeBusinessDate = new DateTime(2026, 4, 27);

            context.Branches.Add(new Branch { BranchID = 1, BranchCode = "001", BranchName = "Main Branch" });
            context.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = 1,
                BusinessDate = closedPrevDay,
                IsDayClosed = true
            });
            context.AccountGroups.Add(new AccountGroup { GroupID = 1, GroupName = "रोख शिल्लक", NatureOfGroup = "Assets" });
            context.Ledgers.AddRange(
                new Ledger { LedgerID = 1, GroupID = 1, LedgerCode = "CSH-1", LedgerName = "Cash In Hand", AccountType = "Cash In Hand" },
                new Ledger { LedgerID = 47, GroupID = 1, LedgerCode = "PGM-L", LedgerName = "पिग्मी ठेव लेजर", AccountType = "Liability" }
            );
            context.PigmyVoucherMappings.Add(new PigmyVoucherMapping { MappingId = 1, BranchId = 1, DebitLedgerId = 1, CreditLedgerId = 47, IsActive = true });

            context.PigmySchemes.Add(new PigmyScheme
            {
                PigmySchemeID = 1,
                SchemeCode = "301",
                SchemeName = "दैनिक ठेव योजना",
                DurationMonths = 12,
                InterestRate = 4.5m,
                PigmyLiabilityLedgerID = 47,
                Status = "Active"
            });
            context.PigmyAgents.Add(new PigmyAgent { PigmyAgentID = 5, AgentName = "एजंट पाच", BranchID = 1, Status = "Active" });

            context.AgentCustomerRequests.Add(new AgentCustomerRequest
            {
                RequestID = 101,
                BranchID = 1,
                PigmyAgentID = 5,
                AgentName = "एजंट पाच",
                FirstName = "महेश",
                LastName = "देसाई",
                MobileNo = "9822001100",
                DailyDepositAmount = 200m,
                OldAccountNo = "109",
                OpenPigmyAccount = true,
                Status = "Pending"
            });
            await context.SaveChangesAsync();

            var controller = new AgentCustomerRequestsController(context)
            {
                ControllerContext = BuildUserContext("Manager", userOrAgentId: 77, branchId: 1)
            };

            var res = await controller.ApproveAndCreateRequest(101, new ApproveAndCreateRequestDto
            {
                CustomerData = new Customer
                {
                    BranchID = 1,
                    FirstName = "महेश",
                    LastName = "देसाई",
                    MobileNo = "9822001100"
                },
                PigmyData = new PigmyAccountCreationDto
                {
                    OpenPigmyAccount = true,
                    PigmySchemeID = 1,
                    PigmyAgentID = 5,
                    DailyDepositAmount = 200m,
                    OpeningBalance = 500m
                },
                ApprovedByUserID = 77
            });

            Assert.IsType<OkObjectResult>(res);

            var cust = await context.Customers.FirstAsync();
            Assert.Equal(activeBusinessDate.Date, cust.RegistrationDate.Date);
            Assert.Equal(77, cust.CreatedBy);

            var acc = await context.PigmyAccounts.FirstAsync();
            Assert.Equal(activeBusinessDate.Date, acc.OpeningDate.Date);
            Assert.Equal(activeBusinessDate.AddMonths(12).Date, acc.MaturityDate.Date);
            Assert.Equal(4.5m, acc.InterestRate);

            var tx = await context.PigmyTransactions.FirstAsync();
            Assert.Equal(activeBusinessDate.Date, tx.TransactionDate.Date);
            Assert.Equal(activeBusinessDate.Date, tx.ValueDate.Date);
            Assert.Equal(500m, tx.CrAmount);

            var voucher = await context.Vouchers.Include(v => v.VoucherDetails).FirstAsync();
            Assert.Equal(activeBusinessDate.Date, voucher.VoucherDate.Date);
            Assert.StartsWith("PV-1-20260427-OPN-", voucher.VoucherNo);
            Assert.Equal(500m, voucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount));
            Assert.Equal(500m, voucher.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount));
        }
    }
}

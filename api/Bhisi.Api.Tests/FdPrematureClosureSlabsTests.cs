using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Controllers;
using Xunit;
using Microsoft.AspNetCore.Mvc;

namespace Bhisi.Api.Tests
{
    public class FdPrematureClosureSlabsTests
    {
        private AppDbContext GetInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new AppDbContext(options);
        }

        private static JsonElement ToJson(object val)
        {
            var json = JsonSerializer.Serialize(val);
            return JsonDocument.Parse(json).RootElement;
        }

        private async Task<(Branch branch, Customer customer, Customer seniorCustomer)> SeedBaseEntitiesAsync(AppDbContext context)
        {
            var branch = new Branch
            {
                BranchID = 1,
                BranchName = "मुख्य शाखा",
                BranchCode = "MAIN01"
            };
            context.Branches.Add(branch);

            var regCustomer = new Customer
            {
                CustomerID = 101,
                FirstName = "रामचंद्र",
                LastName = "पाटील",
                BirthDate = new DateTime(1985, 5, 15) // ~41 years old
            };
            context.Customers.Add(regCustomer);

            var seniorCustomer = new Customer
            {
                CustomerID = 102,
                FirstName = "निवृत्ती",
                LastName = "कुलकर्णी",
                BirthDate = new DateTime(1955, 3, 10) // 71 years old (Senior Citizen)
            };
            context.Customers.Add(seniorCustomer);

            await context.SaveChangesAsync();
            return (branch, regCustomer, seniorCustomer);
        }

        [Fact]
        public async Task Test_TC01_PrematureClose_60Days_MatchedSlab_FinancialLeakPrevented()
        {
            // TC-01: ₹10,00,000 FD for 3 years @ 9.00%, closed after 60 days
            // Expected: Slabs match 46-90 days (5.00%), Penalty 1.00% -> Final Premature Rate 4.00%
            // Saving ₹6,575.34 compared to old faulty logic (8.00% -> ₹13,150.68)
            using var context = GetInMemoryDbContext();
            var (branch, customer, _) = await SeedBaseEntitiesAsync(context);

            var scheme = new FdScheme
            {
                FdSchemeID = 1,
                SchemeName = "३ वर्षे मुदत ठेव",
                InterestRate = 9.00m,
                InterestType = "Cumulative",
                DurationMonths = 36,
                DurationType = "Years",
                MinDurationDays = 15,
                IsActive = true,
                Slabs = new List<FdSchemeInterestSlab>
                {
                    new() { SlabID = 1, FromDays = 15, ToDays = 45, InterestRate = 4.00m, IsActive = true },
                    new() { SlabID = 2, FromDays = 46, ToDays = 90, InterestRate = 5.00m, IsActive = true },
                    new() { SlabID = 3, FromDays = 91, ToDays = 180, InterestRate = 6.00m, IsActive = true },
                    new() { SlabID = 4, FromDays = 181, ToDays = 365, InterestRate = 7.00m, IsActive = true },
                    new() { SlabID = 5, FromDays = 366, ToDays = 1095, InterestRate = 9.00m, IsActive = true },
                }
            };
            context.FdSchemes.Add(scheme);

            var openingDate = new DateTime(2026, 1, 1);
            var closureDate = openingDate.AddDays(60); // 2026-03-02 (60 days run period)

            var account = new FdAccount
            {
                FdAccountID = 1001,
                AccountNo = "FD-TC01-001",
                BranchID = branch.BranchID,
                CustomerID = customer.CustomerID,
                FdSchemeID = scheme.FdSchemeID,
                DepositAmount = 1000000m,
                InterestRate = 9.00m,
                OpeningDate = openingDate,
                MaturityDate = openingDate.AddYears(3),
                Status = "Active",
                LegacyAccruedInt = 0m
            };
            context.FdAccounts.Add(account);
            await context.SaveChangesAsync();

            var controller = new FdAccountsController(context);
            var response = await controller.GetPrematurePreview(account.FdAccountID, closureDate);
            var okResult = Assert.IsType<OkObjectResult>(response);

            var root = ToJson(okResult.Value!);
            Assert.Equal(60, root.GetProperty("actualDays").GetInt32());
            Assert.Equal(5.00m, root.GetProperty("slabRate").GetDecimal());
            Assert.Equal(1.00m, root.GetProperty("penaltyRate").GetDecimal());
            Assert.Equal(4.00m, root.GetProperty("prematureRate").GetDecimal());
            Assert.Contains("46 ते 90 दिवस", root.GetProperty("matchedSlabText").GetString());
            Assert.False(root.GetProperty("isMinimumPeriodViolated").GetBoolean());

            // Recalculated interest = (1,000,000 * 4.00 * 60) / 36500 = 6,575.34
            decimal recalculatedInterest = root.GetProperty("recalculatedInterest").GetDecimal();
            Assert.Equal(6575.34m, recalculatedInterest);

            // Audit Financial Leakage Proof:
            // Under old faulty logic: 9.00% - 1.00% = 8.00% -> ₹13,150.68
            decimal oldDefectiveInterest = Math.Round((1000000m * 8.00m * 60) / 36500.0m, 2);
            decimal leakagePrevented = oldDefectiveInterest - recalculatedInterest;
            Assert.Equal(6575.34m, leakagePrevented);
        }

        [Fact]
        public async Task Test_TC02_PrematureClose_SeniorCitizen_ProtectedSlabRate()
        {
            // TC-02: 1 Year (8.00%) Senior Citizen, 120 days
            // Expected: Slabs 91-180 days (Regular 6.50%, Senior 7.00%) -> Final: 7.00% - 1.00% = 6.00%
            using var context = GetInMemoryDbContext();
            var (branch, _, seniorCustomer) = await SeedBaseEntitiesAsync(context);

            var scheme = new FdScheme
            {
                FdSchemeID = 2,
                SchemeName = "१ वर्ष मुदत ठेव",
                InterestRate = 8.00m,
                InterestType = "Cumulative",
                DurationMonths = 12,
                DurationType = "Years",
                MinDurationDays = 15,
                IsActive = true,
                Slabs = new List<FdSchemeInterestSlab>
                {
                    new() { SlabID = 11, FromDays = 15, ToDays = 90, InterestRate = 5.50m, SeniorCitizenRate = 6.00m, IsActive = true },
                    new() { SlabID = 12, FromDays = 91, ToDays = 180, InterestRate = 6.50m, SeniorCitizenRate = 7.00m, IsActive = true },
                    new() { SlabID = 13, FromDays = 181, ToDays = 365, InterestRate = 8.00m, SeniorCitizenRate = 8.50m, IsActive = true },
                }
            };
            context.FdSchemes.Add(scheme);

            var openingDate = new DateTime(2026, 1, 1);
            var closureDate = openingDate.AddDays(120);

            var account = new FdAccount
            {
                FdAccountID = 1002,
                AccountNo = "FD-TC02-SENIOR",
                BranchID = branch.BranchID,
                CustomerID = seniorCustomer.CustomerID,
                FdSchemeID = scheme.FdSchemeID,
                DepositAmount = 100000m,
                InterestRate = 8.00m,
                OpeningDate = openingDate,
                MaturityDate = openingDate.AddYears(1),
                Status = "Active"
            };
            context.FdAccounts.Add(account);
            await context.SaveChangesAsync();

            var controller = new FdAccountsController(context);
            var response = await controller.GetPrematurePreview(account.FdAccountID, closureDate);
            var okResult = Assert.IsType<OkObjectResult>(response);

            var root = ToJson(okResult.Value!);
            Assert.True(root.GetProperty("isSeniorCitizen").GetBoolean());
            Assert.Equal(120, root.GetProperty("actualDays").GetInt32());
            Assert.Equal(7.00m, root.GetProperty("slabRate").GetDecimal()); // Senior citizen rate applied
            Assert.Equal(1.00m, root.GetProperty("penaltyRate").GetDecimal());
            Assert.Equal(6.00m, root.GetProperty("prematureRate").GetDecimal()); // 7.00% - 1.00%
            Assert.False(root.GetProperty("isMinimumPeriodViolated").GetBoolean());
        }

        [Fact]
        public async Task Test_TC03_PrematureClose_BelowMinimumHoldingPeriod_ZeroInterest()
        {
            // TC-03: 1 Year (8.00%), 10 days run period (Min slab is 15 days)
            // Expected: 0.00% (Zero Interest) under RBI minimum holding period mandate
            using var context = GetInMemoryDbContext();
            var (branch, customer, _) = await SeedBaseEntitiesAsync(context);

            var scheme = new FdScheme
            {
                FdSchemeID = 3,
                SchemeName = "१ वर्ष मुदत ठेव",
                InterestRate = 8.00m,
                MinDurationDays = 15,
                IsActive = true,
                Slabs = new List<FdSchemeInterestSlab>
                {
                    new() { SlabID = 21, FromDays = 15, ToDays = 90, InterestRate = 5.00m, IsActive = true },
                    new() { SlabID = 22, FromDays = 91, ToDays = 365, InterestRate = 8.00m, IsActive = true }
                }
            };
            context.FdSchemes.Add(scheme);

            var openingDate = new DateTime(2026, 1, 1);
            var closureDate = openingDate.AddDays(10); // 10 days (< 15 min days)

            var account = new FdAccount
            {
                FdAccountID = 1003,
                AccountNo = "FD-TC03-ZERO",
                BranchID = branch.BranchID,
                CustomerID = customer.CustomerID,
                FdSchemeID = scheme.FdSchemeID,
                DepositAmount = 500000m,
                InterestRate = 8.00m,
                OpeningDate = openingDate,
                MaturityDate = openingDate.AddYears(1),
                Status = "Active"
            };
            context.FdAccounts.Add(account);
            await context.SaveChangesAsync();

            var controller = new FdAccountsController(context);
            var response = await controller.GetPrematurePreview(account.FdAccountID, closureDate);
            var okResult = Assert.IsType<OkObjectResult>(response);

            var root = ToJson(okResult.Value!);
            Assert.Equal(10, root.GetProperty("actualDays").GetInt32());
            Assert.True(root.GetProperty("isMinimumPeriodViolated").GetBoolean());
            Assert.Equal(0.00m, root.GetProperty("prematureRate").GetDecimal());
            Assert.Equal(0.00m, root.GetProperty("recalculatedInterest").GetDecimal());
            Assert.Contains("०.००% (शून्य) व्याज देय", root.GetProperty("resolutionNote").GetString());
        }

        [Fact]
        public async Task Test_TC04_PrematureClose_LongTenor_400Days_AccurateSlabMatching()
        {
            // TC-04: 2 Years (8.50%), 400 days run period
            // Slabs: 366-730 days is 8.00%. Final = 8.00% - 1.00% = 7.00%
            using var context = GetInMemoryDbContext();
            var (branch, customer, _) = await SeedBaseEntitiesAsync(context);

            var scheme = new FdScheme
            {
                FdSchemeID = 4,
                SchemeName = "२ वर्षे मुदत ठेव",
                InterestRate = 8.50m,
                MinDurationDays = 15,
                IsActive = true,
                Slabs = new List<FdSchemeInterestSlab>
                {
                    new() { SlabID = 31, FromDays = 15, ToDays = 180, InterestRate = 6.00m, IsActive = true },
                    new() { SlabID = 32, FromDays = 181, ToDays = 365, InterestRate = 7.00m, IsActive = true },
                    new() { SlabID = 33, FromDays = 366, ToDays = 730, InterestRate = 8.00m, IsActive = true }
                }
            };
            context.FdSchemes.Add(scheme);

            var openingDate = new DateTime(2026, 1, 1);
            var closureDate = openingDate.AddDays(400);

            var account = new FdAccount
            {
                FdAccountID = 1004,
                AccountNo = "FD-TC04-400DAYS",
                BranchID = branch.BranchID,
                CustomerID = customer.CustomerID,
                FdSchemeID = scheme.FdSchemeID,
                DepositAmount = 200000m,
                InterestRate = 8.50m,
                OpeningDate = openingDate,
                MaturityDate = openingDate.AddYears(2),
                Status = "Active"
            };
            context.FdAccounts.Add(account);
            await context.SaveChangesAsync();

            var controller = new FdAccountsController(context);
            var response = await controller.GetPrematurePreview(account.FdAccountID, closureDate);
            var okResult = Assert.IsType<OkObjectResult>(response);

            var root = ToJson(okResult.Value!);
            Assert.Equal(400, root.GetProperty("actualDays").GetInt32());
            Assert.Equal(8.00m, root.GetProperty("slabRate").GetDecimal());
            Assert.Equal(1.00m, root.GetProperty("penaltyRate").GetDecimal());
            Assert.Equal(7.00m, root.GetProperty("prematureRate").GetDecimal());
            Assert.False(root.GetProperty("isMinimumPeriodViolated").GetBoolean());
        }

        [Fact]
        public async Task Test_TC05_PrematureClose_FixedSchemeFallback_NoSlabs()
        {
            // TC-05: Fixed scheme without slabs, Contracted Rate = 8.00%, Run Days = 90
            // Expected: Safe fallback to 8.00% - 1.00% penalty = 7.00%
            using var context = GetInMemoryDbContext();
            var (branch, customer, _) = await SeedBaseEntitiesAsync(context);

            var scheme = new FdScheme
            {
                FdSchemeID = 5,
                SchemeName = "विशेष मुदत ठेव (विना-स्लॅब)",
                InterestRate = 8.00m,
                MinDurationDays = 7,
                IsActive = true,
                Slabs = new List<FdSchemeInterestSlab>() // Empty slabs
            };
            context.FdSchemes.Add(scheme);

            var openingDate = new DateTime(2026, 1, 1);
            var closureDate = openingDate.AddDays(90);

            var account = new FdAccount
            {
                FdAccountID = 1005,
                AccountNo = "FD-TC05-FIXED",
                BranchID = branch.BranchID,
                CustomerID = customer.CustomerID,
                FdSchemeID = scheme.FdSchemeID,
                DepositAmount = 300000m,
                InterestRate = 8.00m,
                OpeningDate = openingDate,
                MaturityDate = openingDate.AddYears(1),
                Status = "Active"
            };
            context.FdAccounts.Add(account);
            await context.SaveChangesAsync();

            var controller = new FdAccountsController(context);
            var response = await controller.GetPrematurePreview(account.FdAccountID, closureDate);
            var okResult = Assert.IsType<OkObjectResult>(response);

            var root = ToJson(okResult.Value!);
            Assert.Equal(90, root.GetProperty("actualDays").GetInt32());
            Assert.Equal(8.00m, root.GetProperty("slabRate").GetDecimal());
            Assert.Equal(1.00m, root.GetProperty("penaltyRate").GetDecimal());
            Assert.Equal(7.00m, root.GetProperty("prematureRate").GetDecimal());
            Assert.Equal("फिक्स्ड योजना (विना-स्लॅब)", root.GetProperty("matchedSlabText").GetString());
            Assert.False(root.GetProperty("isMinimumPeriodViolated").GetBoolean());
        }
    }
}

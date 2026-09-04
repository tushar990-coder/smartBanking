using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Controllers;
using Xunit;
using Microsoft.AspNetCore.Mvc;

namespace Bhisi.Api.Tests
{
    public class LoanScheduleTests
    {
        private AppDbContext GetInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new AppDbContext(options);
        }

        [Fact]
        public async Task Test_Reducing_EqualPrincipal_ScheduleCalculation()
        {
            using var context = GetInMemoryDbContext();

            // Seed LoanRate with InterestCalculationMethod = "Reducing (घटती पद्धत)" and LoanInstallmentType = "समान मुद्दल"
            var loanRate = new LoanRate
            {
                LoanRateID = 10,
                LoanType = "तारणी",
                InterestRate = 12m,
                InterestCalculationMethod = "Reducing (घटती पद्धत)",
                LoanInstallmentType = "समान मुद्दल",
                IsActive = true
            };
            context.LoanRates.Add(loanRate);
            await context.SaveChangesAsync();

            var controller = new LoanAccountsController(context);

            var request = new LoanSchedulePreviewRequest
            {
                LoanRateID = 10,
                LoanAmount = 120000m,
                InterestRate = 12m,
                NoOfInstallments = 12,
                DurationMonths = 12,
                InstallmentFrequency = "मासिक (Monthly)",
                LoanDisbursementDate = new DateTime(2026, 1, 1),
                FirstInstallmentDate = new DateTime(2026, 2, 1)
            };

            var response = await controller.PreviewSchedule(request);
            var okResult = Assert.IsType<OkObjectResult>(response.Result);
            var schedule = Assert.IsType<List<OpeningBalanceScheduleDto>>(okResult.Value);

            Assert.Equal(12, schedule.Count);

            // First Installment details (Jan 1 to Feb 1 = 31 days)
            var inst1 = schedule.First(s => s.No == 1);
            Assert.Equal(120000m, inst1.OpeningBalance);
            Assert.Equal(10000m, inst1.Principal);
            Assert.Equal(31, inst1.Days);
            // Interest = (120000 * 31 * 12) / 36500 = 1223.01 => rounded to 1223
            Assert.Equal(1223m, inst1.Interest);
            Assert.Equal(11223m, inst1.Total);
            Assert.Equal(110000m, inst1.ClosingBalance);

            // Second Installment details (Feb 1 to Mar 1 = 28 days)
            var inst2 = schedule.First(s => s.No == 2);
            Assert.Equal(110000m, inst2.OpeningBalance);
            Assert.Equal(10000m, inst2.Principal);
            Assert.Equal(28, inst2.Days);
            // Interest = (110000 * 28 * 12) / 36500 = 1012.60 => rounded to 1013
            Assert.Equal(1013m, inst2.Interest);
            Assert.Equal(11013m, inst2.Total);
            Assert.Equal(100000m, inst2.ClosingBalance);

            // Last Installment Closing Balance should be exactly 0
            var instLast = schedule.Last();
            Assert.Equal(0m, instLast.ClosingBalance);
            Assert.Equal(0m, instLast.Balance);

            // Sum of all principal amounts must equal 120000
            decimal totalPrincipal = schedule.Sum(s => s.Principal);
            Assert.Equal(120000m, totalPrincipal);
        }
    }
}

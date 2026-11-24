using System;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class LicenseServiceTests
    {
        private sealed class FakeWebHostEnvironment : IWebHostEnvironment
        {
            public string EnvironmentName { get; set; } = Environments.Production;
            public string ApplicationName { get; set; } = "Bhisi.Api.Tests";
            public string WebRootPath { get; set; } = string.Empty;
            public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
            public string ContentRootPath { get; set; } = string.Empty;
            public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        }

        private static LicenseService BuildLicenseService(string dbName, string host, Action<AppDbContext>? seed = null)
        {
            var services = new ServiceCollection();
            services.AddDbContext<AppDbContext>(opt => opt.UseInMemoryDatabase(dbName));
            var sp = services.BuildServiceProvider();

            if (seed != null)
            {
                using var scope = sp.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                seed(db);
                db.SaveChanges();
            }

            var httpCtx = new DefaultHttpContext();
            httpCtx.Request.Host = new HostString(host);
            var accessor = new HttpContextAccessor { HttpContext = httpCtx };

            return new LicenseService(
                NullLogger<LicenseService>.Instance,
                sp,
                new FakeWebHostEnvironment(),
                accessor);
        }

        [Fact]
        public void GetLicenseStatus_WildcardDomain_ResolvesSansthaNameFromDatabase_InsteadOfHardcodedName()
        {
            const string expectedName = "आर.आय.टी. कर्मचारी सहकारी पतसंस्था मर्यादित";
            var svc = BuildLicenseService(
                nameof(GetLicenseStatus_WildcardDomain_ResolvesSansthaNameFromDatabase_InsteadOfHardcodedName),
                "ritemployee-unit1.hellomindspace.in",
                db =>
                {
                    db.SansthaDetails.Add(new SansthaDetail
                    {
                        SansthaID = 1,
                        SansthaName = expectedName
                    });
                });

            var status = svc.GetLicenseStatus();

            Assert.True(status.IsValid);
            Assert.Equal("ONLINE_VPS", status.LicenseType);
            Assert.Equal("ritemployee-unit1.hellomindspace.in", status.ActiveDomain);
            Assert.Equal(expectedName, status.SansthaName);
            Assert.DoesNotContain("जोतिर्लिंग", status.SansthaName);
        }

        [Fact]
        public void GetLicenseStatus_WildcardDomain_FallsBackToGenericCloudName_WhenSansthaDetailsMissing()
        {
            var svc = BuildLicenseService(
                nameof(GetLicenseStatus_WildcardDomain_FallsBackToGenericCloudName_WhenSansthaDetailsMissing),
                "emptytenant-unit2.hellomindspace.in");

            var status = svc.GetLicenseStatus();

            Assert.True(status.IsValid);
            Assert.Equal("SmartBanking Cloud", status.SansthaName);
        }
    }
}

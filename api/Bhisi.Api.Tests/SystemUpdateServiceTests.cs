using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace Bhisi.Api.Tests
{
    public class SystemUpdateServiceTests
    {
        private sealed class DummyBackupService : IBackupService
        {
            public Task<string> GenerateDatabaseBackupAsync() => Task.FromResult(string.Empty);
        }

        private sealed class DummyLifetime : IHostApplicationLifetime
        {
            public CancellationToken ApplicationStarted => CancellationToken.None;
            public CancellationToken ApplicationStopping => CancellationToken.None;
            public CancellationToken ApplicationStopped => CancellationToken.None;
            public void StopApplication() { }
        }

        private static SystemUpdateService CreateService(string tempRoot)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase("SystemUpdateTests_" + Guid.NewGuid().ToString("N"))
                .Options;
            var context = new AppDbContext(options);
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AppConfig:AppRoot"] = tempRoot
                })
                .Build();
            return new SystemUpdateService(context, config, new DummyBackupService(), new DummyLifetime());
        }

        private static IFormFile BuildZipFormFile(string fileName, Dictionary<string, string> entries)
        {
            var ms = new MemoryStream();
            using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
            {
                foreach (var kv in entries)
                {
                    var entry = archive.CreateEntry(kv.Key);
                    using var writer = new StreamWriter(entry.Open(), Encoding.UTF8);
                    writer.Write(kv.Value);
                }
            }
            ms.Position = 0;
            return new FormFile(ms, 0, ms.Length, "patchFile", fileName);
        }

        [Fact]
        public async Task StageOfflinePatch_MultiAppVpsMasterZip_IsRejectedWithClearGuidance()
        {
            var tempRoot = Path.Combine(Path.GetTempPath(), "bhisi_sysupdate_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);
            try
            {
                var svc = CreateService(tempRoot);
                var formFile = BuildZipFormFile("SmartBanking_VPS_Multi_App_Master_Patch_v2.6.42.zip", new Dictionary<string, string>
                {
                    ["version.json"] = "{\"version\":\"2.6.42\",\"releaseDate\":\"2026-11-24\",\"changelog\":[\"test\"]}",
                    ["apply_patch.ps1"] = "# installer",
                    ["backend/Bhisi.Api.dll"] = "dll",
                    ["frontend/index.html"] = "<html></html>"
                });

                var res = await svc.StageOfflinePatchAsync(formFile);

                Assert.False(res.IsValid);
                Assert.Equal("2.6.42", res.Version);
                Assert.Contains("1_Click_Update_Testing.bat", res.ErrorMessage);
            }
            finally
            {
                if (Directory.Exists(tempRoot)) Directory.Delete(tempRoot, true);
            }
        }

        [Fact]
        public async Task StageOfflinePatch_ValidSingleAppZip_SucceedsAndReadsManifest()
        {
            var tempRoot = Path.Combine(Path.GetTempPath(), "bhisi_sysupdate_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempRoot);
            try
            {
                var svc = CreateService(tempRoot);
                var formFile = BuildZipFormFile("SmartBanking_Update_v2.6.42.zip", new Dictionary<string, string>
                {
                    ["version.json"] = "{\"version\":\"2.6.42\",\"releaseDate\":\"2026-11-24\",\"changelog\":[\"Patch note 1\"]}",
                    ["migrate.sql"] = "SELECT 1;",
                    ["Bhisi.Api.exe"] = "exe",
                    ["wwwroot/index.html"] = "<html></html>"
                });

                var res = await svc.StageOfflinePatchAsync(formFile);

                Assert.True(res.IsValid);
                Assert.Equal("2.6.42", res.Version);
                Assert.True(res.HasDatabaseMigration);
                Assert.Contains("Patch note 1", res.Changelog);
            }
            finally
            {
                if (Directory.Exists(tempRoot)) Directory.Delete(tempRoot, true);
            }
        }
    }
}

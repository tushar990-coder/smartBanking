using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Serilog;

namespace Bhisi.Api.Services
{
    public class SystemUpdateService : ISystemUpdateService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IBackupService _backupService;
        private readonly IHostApplicationLifetime _appLifetime;
        private readonly HttpClient _httpClient;

        private const string DefaultCurrentVersion = "1.0.0";
        private const string DefaultManifestUrl = "https://raw.githubusercontent.com/tushar990-coder/smart-banking/main/latest-release.json";

        public SystemUpdateService(
            AppDbContext context,
            IConfiguration configuration,
            IBackupService backupService,
            IHostApplicationLifetime appLifetime)
        {
            _context = context;
            _configuration = configuration;
            _backupService = backupService;
            _appLifetime = appLifetime;
            _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        }

        private string GetAppRoot() => Directory.GetCurrentDirectory();

        private string GetStagingRoot()
        {
            var dir = Path.Combine(GetAppRoot(), "updates", "staging");
            if (!Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            return dir;
        }

        public async Task<SystemVersionInfo> GetCurrentVersionInfoAsync()
        {
            string currentVersion = DefaultCurrentVersion;
            string buildDate = string.Empty;

            // 1. Try reading local version.json
            string versionFile = Path.Combine(GetAppRoot(), "version.json");
            if (File.Exists(versionFile))
            {
                try
                {
                    string json = await File.ReadAllTextAsync(versionFile);
                    using var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("version", out var vProp))
                    {
                        currentVersion = vProp.GetString() ?? DefaultCurrentVersion;
                    }
                    if (doc.RootElement.TryGetProperty("releaseDate", out var dProp))
                    {
                        buildDate = dProp.GetString() ?? string.Empty;
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Could not parse version.json");
                }
            }

            // 2. Fetch history from DB
            List<SystemVersionHistory> history = new();
            try
            {
                history = await _context.SystemVersionHistories
                    .OrderByDescending(h => h.AppliedOn)
                    .Take(50)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Could not fetch SystemVersionHistories from database.");
            }

            var latestEntry = history.FirstOrDefault();
            if (latestEntry != null && !string.IsNullOrWhiteSpace(latestEntry.VersionNumber) && currentVersion == DefaultCurrentVersion)
            {
                currentVersion = latestEntry.VersionNumber;
            }

            string dbName = string.Empty;
            try
            {
                dbName = _context.Database.GetDbConnection().Database;
            }
            catch { }

            return new SystemVersionInfo
            {
                CurrentVersion = currentVersion,
                BuildDate = buildDate,
                DatabaseName = dbName,
                LastUpdatedOn = latestEntry?.AppliedOn,
                LastAppliedPatch = latestEntry?.PatchName ?? "Initial Setup",
                History = history
            };
        }

        public async Task<CheckUpdateResult> CheckOnlineUpdatesAsync()
        {
            var currentInfo = await GetCurrentVersionInfoAsync();
            string manifestUrl = _configuration["AppConfig:UpdateManifestUrl"] ?? DefaultManifestUrl;

            try
            {
                var response = await _httpClient.GetAsync(manifestUrl);
                if (!response.IsSuccessStatusCode)
                {
                    return new CheckUpdateResult
                    {
                        HasUpdate = false,
                        CurrentVersion = currentInfo.CurrentVersion,
                        Message = "अपडेट सर्व्हरशी संपर्क होऊ शकला नाही. (HTTP " + response.StatusCode + ")"
                    };
                }

                string json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                string latestVer = root.GetProperty("latestVersion").GetString() ?? currentInfo.CurrentVersion;
                string releaseDate = root.TryGetProperty("releaseDate", out var rd) ? (rd.GetString() ?? "") : "";
                string downloadUrl = root.TryGetProperty("downloadUrl", out var du) ? (du.GetString() ?? "") : "";
                double downloadSize = root.TryGetProperty("downloadSizeMb", out var ds) ? ds.GetDouble() : 0;
                bool isCritical = root.TryGetProperty("isCritical", out var ic) && ic.GetBoolean();

                List<string> changelog = new();
                if (root.TryGetProperty("changelog", out var cl) && cl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in cl.EnumerateArray())
                    {
                        var str = item.GetString();
                        if (!string.IsNullOrWhiteSpace(str)) changelog.Add(str);
                    }
                }

                bool hasUpdate = IsNewerVersion(latestVer, currentInfo.CurrentVersion);

                return new CheckUpdateResult
                {
                    HasUpdate = hasUpdate,
                    CurrentVersion = currentInfo.CurrentVersion,
                    LatestVersion = latestVer,
                    ReleaseDate = releaseDate,
                    DownloadUrl = downloadUrl,
                    DownloadSizeMb = downloadSize,
                    Changelog = changelog,
                    IsCritical = isCritical,
                    Message = hasUpdate ? "नवीन आवृत्ती उपलब्ध आहे!" : "आपले सॉफ्टवेअर अद्ययावत (Up-to-date) आहे."
                };
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Online update check failed.");
                return new CheckUpdateResult
                {
                    HasUpdate = false,
                    CurrentVersion = currentInfo.CurrentVersion,
                    Message = "इंटरनेट कनेक्शन उपलब्ध नाही किंवा अपडेट सर्व्हरशी संपर्क होऊ शकला नाही."
                };
            }
        }

        public async Task<UpdateValidationResult> StageOfflinePatchAsync(IFormFile patchZip)
        {
            if (patchZip == null || patchZip.Length == 0)
            {
                return new UpdateValidationResult { IsValid = false, ErrorMessage = "कृपया वैध .zip पॅच फाईल निवडा." };
            }

            if (!patchZip.FileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
            {
                return new UpdateValidationResult { IsValid = false, ErrorMessage = "फक्त .zip स्वरूपातील अपडेट पॅच फाईल समर्थित आहे." };
            }

            string stagingRoot = GetStagingRoot();
            string tempZipPath = Path.Combine(stagingRoot, "uploaded_patch.zip");
            string extractPath = Path.Combine(stagingRoot, "extracted");

            try
            {
                if (Directory.Exists(extractPath))
                {
                    Directory.Delete(extractPath, true);
                }
                Directory.CreateDirectory(extractPath);

                if (File.Exists(tempZipPath))
                {
                    File.Delete(tempZipPath);
                }

                using (var stream = new FileStream(tempZipPath, FileMode.Create))
                {
                    await patchZip.CopyToAsync(stream);
                }

                ZipFile.ExtractToDirectory(tempZipPath, extractPath, true);

                return ValidateExtractedPackage(extractPath, patchZip.Length);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to stage offline patch");
                return new UpdateValidationResult
                {
                    IsValid = false,
                    ErrorMessage = "पॅच फाईल अनझिप करताना त्रुटी आली: " + ex.Message
                };
            }
        }

        public async Task<UpdateValidationResult> DownloadAndStageOnlinePatchAsync(string downloadUrl)
        {
            if (string.IsNullOrWhiteSpace(downloadUrl))
            {
                return new UpdateValidationResult { IsValid = false, ErrorMessage = "डाउनलोड URL अवैध आहे." };
            }

            string stagingRoot = GetStagingRoot();
            string tempZipPath = Path.Combine(stagingRoot, "downloaded_online_patch.zip");
            string extractPath = Path.Combine(stagingRoot, "extracted");

            try
            {
                if (Directory.Exists(extractPath))
                {
                    Directory.Delete(extractPath, true);
                }
                Directory.CreateDirectory(extractPath);

                if (File.Exists(tempZipPath))
                {
                    File.Delete(tempZipPath);
                }

                using (var client = new HttpClient { Timeout = TimeSpan.FromMinutes(10) })
                {
                    using var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead);
                    response.EnsureSuccessStatusCode();

                    using var fs = new FileStream(tempZipPath, FileMode.Create, FileAccess.Write, FileShare.None);
                    await response.Content.CopyToAsync(fs);
                }

                ZipFile.ExtractToDirectory(tempZipPath, extractPath, true);

                long fileSizeBytes = new FileInfo(tempZipPath).Length;
                return ValidateExtractedPackage(extractPath, fileSizeBytes);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to download online update package");
                return new UpdateValidationResult
                {
                    IsValid = false,
                    ErrorMessage = "क्लाउडवरून पॅच डाउनलोड करताना त्रुटी आली: " + ex.Message
                };
            }
        }

        private UpdateValidationResult ValidateExtractedPackage(string extractPath, long fileSizeBytes)
        {
            string versionJsonPath = Path.Combine(extractPath, "version.json");
            string version = "Unknown";
            string releaseDate = DateTime.Now.ToString("yyyy-MM-dd");
            List<string> changelog = new();

            if (File.Exists(versionJsonPath))
            {
                try
                {
                    string json = File.ReadAllText(versionJsonPath);
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("version", out var v)) version = v.GetString() ?? version;
                    if (root.TryGetProperty("releaseDate", out var rd)) releaseDate = rd.GetString() ?? releaseDate;
                    if (root.TryGetProperty("changelog", out var cl) && cl.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in cl.EnumerateArray())
                        {
                            var s = item.GetString();
                            if (!string.IsNullOrWhiteSpace(s)) changelog.Add(s);
                        }
                    }
                }
                catch { }
            }

            bool hasSql = File.Exists(Path.Combine(extractPath, "migrate.sql"));
            bool hasApiExe = File.Exists(Path.Combine(extractPath, "Bhisi.Api.exe")) || File.Exists(Path.Combine(extractPath, "UpdateFiles", "Bhisi.Api.exe"));
            bool hasWwwroot = Directory.Exists(Path.Combine(extractPath, "wwwroot")) || Directory.Exists(Path.Combine(extractPath, "UpdateFiles", "wwwroot"));

            if (!hasApiExe && !hasWwwroot && !hasSql)
            {
                return new UpdateValidationResult
                {
                    IsValid = false,
                    ErrorMessage = "पॅच फाईलमध्ये आवश्यक प्रणाली फाइल्स (Bhisi.Api.exe / wwwroot / migrate.sql) आढळल्या नाहीत."
                };
            }

            return new UpdateValidationResult
            {
                IsValid = true,
                Version = version,
                ReleaseDate = releaseDate,
                Changelog = changelog,
                HasDatabaseMigration = hasSql,
                FileSizeBytes = fileSizeBytes,
                StagingPath = extractPath
            };
        }

        public async Task<ApplyUpdateResult> ApplyStagedUpdateAsync(string? username = null)
        {
            string stagingRoot = GetStagingRoot();
            string extractPath = Path.Combine(stagingRoot, "extracted");

            if (!Directory.Exists(extractPath))
            {
                return new ApplyUpdateResult
                {
                    Success = false,
                    Message = "स्टेजिंग फोल्डरमध्ये कोणताही पॅच आढळला नाही. कृपया प्रथम पॅच अपलोड करा."
                };
            }

            // Flatten nested UpdateFiles folder if creator placed it inside
            string updateSourceDir = extractPath;
            if (Directory.Exists(Path.Combine(extractPath, "UpdateFiles")))
            {
                updateSourceDir = Path.Combine(extractPath, "UpdateFiles");
            }

            string backupPath = string.Empty;
            string targetVersion = "Unknown";

            // Read version
            string versionFile = Path.Combine(extractPath, "version.json");
            if (!File.Exists(versionFile))
            {
                versionFile = Path.Combine(updateSourceDir, "version.json");
            }
            if (File.Exists(versionFile))
            {
                try
                {
                    string json = await File.ReadAllTextAsync(versionFile);
                    using var doc = JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("version", out var v))
                    {
                        targetVersion = v.GetString() ?? targetVersion;
                    }
                }
                catch { }
            }

            try
            {
                // Step 1: Automatic DB Backup
                try
                {
                    backupPath = await _backupService.GenerateDatabaseBackupAsync();
                    Log.Information("Pre-update automatic backup completed at {Path}", backupPath);
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Automatic pre-update backup warning. Continuing update...");
                }

                // Step 2: Apply Cumulative Database Migration if present
                string sqlPath = Path.Combine(extractPath, "migrate.sql");
                if (!File.Exists(sqlPath))
                {
                    sqlPath = Path.Combine(updateSourceDir, "migrate.sql");
                }

                if (File.Exists(sqlPath))
                {
                    try
                    {
                        string fullSql = await File.ReadAllTextAsync(sqlPath);
                        var batches = Regex.Split(fullSql, @"(?im)^\s*GO\s*$", RegexOptions.Multiline);
                        foreach (var batch in batches)
                        {
                            var trimmed = batch.Trim();
                            if (!string.IsNullOrWhiteSpace(trimmed))
                            {
                                try
                                {
                                    await _context.Database.ExecuteSqlRawAsync(trimmed);
                                }
                                catch (Exception sqlEx)
                                {
                                    Log.Warning(sqlEx, "Migration batch warning: {Batch}", trimmed);
                                }
                            }
                        }
                        Log.Information("Cumulative migrate.sql applied successfully!");
                    }
                    catch (Exception ex)
                    {
                        Log.Error(ex, "Failed to apply migrate.sql script.");
                    }
                }

                // Step 3: Record Update History in Database
                try
                {
                    var historyEntry = new SystemVersionHistory
                    {
                        VersionNumber = targetVersion,
                        AppliedOn = DateTime.Now,
                        PatchName = $"SmartBanking Update v{targetVersion}",
                        Status = "SUCCESS",
                        Remarks = $"Applied successfully on {DateTime.Now:dd/MM/yyyy HH:mm}. Pre-backup: {Path.GetFileName(backupPath)}",
                        AppliedBy = username ?? "Admin"
                    };

                    _context.SystemVersionHistories.Add(historyEntry);
                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Could not record update history entry.");
                }

                // Step 4: Prepare and Launch Detached Helper Script to replace files and restart
                string appDir = GetAppRoot();
                string toolsDir = Path.Combine(appDir, "tools");
                if (!Directory.Exists(toolsDir)) Directory.CreateDirectory(toolsDir);

                string helperBatPath = Path.Combine(toolsDir, "update_helper.bat");
                EnsureUpdateHelperBatExists(helperBatPath);

                // Start helper process detached
                var startInfo = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/c start \"\" /min \"{helperBatPath}\" \"{appDir}\" \"{updateSourceDir}\" \"Bhisi.Api.exe\"",
                    UseShellExecute = true,
                    CreateNoWindow = true,
                    WorkingDirectory = appDir
                };

                Process.Start(startInfo);
                Log.Information("Spawned update_helper.bat detached successfully!");

                // Step 5: Stop API gracefully after 1.5 seconds so helper can swap files
                _ = Task.Run(async () =>
                {
                    await Task.Delay(1500);
                    Log.Information("Initiating application shutdown for update restart...");
                    _appLifetime.StopApplication();
                });

                return new ApplyUpdateResult
                {
                    Success = true,
                    TargetVersion = targetVersion,
                    BackupPath = backupPath,
                    Message = $"सिस्टीम v{targetVersion} वर यशस्वीरीत्या अपडेट होत आहे. सर्व्हर रीस्टार्ट होत आहे..."
                };
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Error while applying staged update.");
                return new ApplyUpdateResult
                {
                    Success = false,
                    Message = "अपडेट लागू करताना त्रुटी आली: " + ex.Message
                };
            }
        }

        private void EnsureUpdateHelperBatExists(string path)
        {
            string batContent = @"@echo off
set APP_DIR=%~1
set STAGING_DIR=%~2
set EXE_NAME=%~3

if ""%APP_DIR%""=="""" exit /b
if ""%STAGING_DIR%""=="""" exit /b
if ""%EXE_NAME%""=="""" set EXE_NAME=Bhisi.Api.exe

REM 1. Wait for parent API process to exit gracefully
timeout /t 3 /nobreak >nul

REM Force kill any hanging instances just in case
taskkill /F /IM %EXE_NAME% 2>nul
timeout /t 1 /nobreak >nul

REM 2. Replace API executable if present in staging
if exist ""%STAGING_DIR%\%EXE_NAME%"" (
    copy /y ""%STAGING_DIR%\%EXE_NAME%"" ""%APP_DIR%\%EXE_NAME%"" >nul
)

REM 3. Replace wwwroot frontend if present in staging
if exist ""%STAGING_DIR%\wwwroot"" (
    if not exist ""%APP_DIR%\wwwroot"" mkdir ""%APP_DIR%\wwwroot""
    xcopy /s /e /y ""%STAGING_DIR%\wwwroot\*"" ""%APP_DIR%\wwwroot\"" >nul
)

REM 4. Copy version.json if present
if exist ""%STAGING_DIR%\version.json"" (
    copy /y ""%STAGING_DIR%\version.json"" ""%APP_DIR%\version.json"" >nul
)

REM 5. Copy launcher batch scripts if present
if exist ""%STAGING_DIR%\StartSmartBanking.bat"" (
    copy /y ""%STAGING_DIR%\StartSmartBanking.bat"" ""%APP_DIR%\StartSmartBanking.bat"" >nul
)
if exist ""%STAGING_DIR%\StopSmartBanking.bat"" (
    copy /y ""%STAGING_DIR%\StopSmartBanking.bat"" ""%APP_DIR%\StopSmartBanking.bat"" >nul
)

REM 6. Clean staging folder
timeout /t 1 /nobreak >nul
if exist ""%APP_DIR%\updates\staging"" (
    rd /s /q ""%APP_DIR%\updates\staging"" 2>nul
)

REM 7. Start the updated API server
cd /d ""%APP_DIR%""
start /min ""SmartBanking Server"" ""%APP_DIR%\%EXE_NAME%""

exit
";
            File.WriteAllText(path, batContent);
        }

        private bool IsNewerVersion(string remoteVersion, string localVersion)
        {
            try
            {
                var cleanRemote = Regex.Replace(remoteVersion, @"[^\d.]", "");
                var cleanLocal = Regex.Replace(localVersion, @"[^\d.]", "");

                var vRemote = new Version(cleanRemote);
                var vLocal = new Version(cleanLocal);
                return vRemote > vLocal;
            }
            catch
            {
                return !string.Equals(remoteVersion.Trim(), localVersion.Trim(), StringComparison.OrdinalIgnoreCase);
            }
        }
    }
}

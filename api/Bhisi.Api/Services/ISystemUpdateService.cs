using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public class SystemVersionInfo
    {
        public string CurrentVersion { get; set; } = "1.0.0";
        public string BuildDate { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public DateTime? LastUpdatedOn { get; set; }
        public string LastAppliedPatch { get; set; } = string.Empty;
        public List<SystemVersionHistory> History { get; set; } = new();
    }

    public class CheckUpdateResult
    {
        public bool HasUpdate { get; set; }
        public string CurrentVersion { get; set; } = string.Empty;
        public string LatestVersion { get; set; } = string.Empty;
        public string ReleaseDate { get; set; } = string.Empty;
        public string DownloadUrl { get; set; } = string.Empty;
        public double DownloadSizeMb { get; set; }
        public List<string> Changelog { get; set; } = new();
        public bool IsCritical { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class UpdateValidationResult
    {
        public bool IsValid { get; set; }
        public string Version { get; set; } = string.Empty;
        public string ReleaseDate { get; set; } = string.Empty;
        public List<string> Changelog { get; set; } = new();
        public bool HasDatabaseMigration { get; set; }
        public long FileSizeBytes { get; set; }
        public string ErrorMessage { get; set; } = string.Empty;
        public string StagingPath { get; set; } = string.Empty;
    }

    public class ApplyUpdateResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string BackupPath { get; set; } = string.Empty;
        public string TargetVersion { get; set; } = string.Empty;
    }

    public interface ISystemUpdateService
    {
        Task<SystemVersionInfo> GetCurrentVersionInfoAsync();
        Task<CheckUpdateResult> CheckOnlineUpdatesAsync();
        Task<UpdateValidationResult> StageOfflinePatchAsync(IFormFile patchZip);
        Task<UpdateValidationResult> DownloadAndStageOnlinePatchAsync(string downloadUrl);
        Task<ApplyUpdateResult> ApplyStagedUpdateAsync(string? username = null);
    }
}

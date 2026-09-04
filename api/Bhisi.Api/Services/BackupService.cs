using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Bhisi.Api.Data;
using Serilog;

namespace Bhisi.Api.Services
{
    public class BackupService : IBackupService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public BackupService(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task<string> GenerateDatabaseBackupAsync()
        {
            string dbName = _context.Database.GetDbConnection().Database;
            string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            string backupFileName = $"{dbName}_Backup_{timestamp}.bak";

            string backupDir = _configuration["AppConfig:BackupPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "Uploads");
            if (!Directory.Exists(backupDir))
            {
                Directory.CreateDirectory(backupDir);
            }

            string fullBackupPath = Path.Combine(backupDir, backupFileName);

            try
            {
                string backupQuery = $"BACKUP DATABASE [{dbName}] TO DISK = '{fullBackupPath}' WITH FORMAT, MEDIANAME = 'BhisiDBBackup', NAME = 'Full Backup of {dbName}';";
                await _context.Database.ExecuteSqlRawAsync(backupQuery);
                Log.Information($"Database backup created successfully at: {fullBackupPath}");
                return fullBackupPath;
            }
            catch (Exception ex)
            {
                Log.Warning(ex, "Primary backup path failed. Retrying with C:\\BhisiBackups...");
                string fallbackDir = @"C:\BhisiBackups";
                if (!Directory.Exists(fallbackDir))
                {
                    Directory.CreateDirectory(fallbackDir);
                }
                string fallbackPath = Path.Combine(fallbackDir, backupFileName);
                string fallbackQuery = $"BACKUP DATABASE [{dbName}] TO DISK = '{fallbackPath}' WITH FORMAT, MEDIANAME = 'BhisiDBBackup', NAME = 'Full Backup of {dbName}';";
                await _context.Database.ExecuteSqlRawAsync(fallbackQuery);
                Log.Information($"Database backup created at fallback path: {fallbackPath}");
                return fallbackPath;
            }
        }
    }
}

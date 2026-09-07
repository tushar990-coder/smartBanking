using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public interface INotificationEngineService
    {
        Task<int> GenerateAutoNotificationsAsync(int branchId = 1);
        Task<List<SystemNotification>> GetNotificationsAsync(int branchId, string? module = null, string? priority = null, string? status = "Active");
        Task<Dictionary<string, int>> GetModuleCountsAsync(int branchId);
        Task<bool> CompleteNotificationAsync(long notificationId, int? userId = null);
    }

    public class NotificationEngineService : INotificationEngineService
    {
        private readonly AppDbContext _db;

        public NotificationEngineService(AppDbContext db)
        {
            _db = db;
        }

        public async Task<int> GenerateAutoNotificationsAsync(int branchId = 1)
        {
            int createdCount = 0;
            DateTime today = DateTime.Today;

            // Ensure SystemNotifications table is created if auto-migration hasn't executed
            try
            {
                await _db.Database.ExecuteSqlRawAsync(@"
                    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemNotifications')
                    BEGIN
                        CREATE TABLE [SystemNotifications] (
                            [NotificationID] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                            [BranchID] int NOT NULL DEFAULT 1,
                            [UserID] int NULL,
                            [RoleName] nvarchar(50) NULL,
                            [ModuleName] nvarchar(50) NOT NULL,
                            [NotificationType] nvarchar(50) NOT NULL,
                            [Title] nvarchar(250) NOT NULL,
                            [Description] nvarchar(500) NOT NULL,
                            [Priority] nvarchar(20) NOT NULL DEFAULT 'MEDIUM',
                            [TargetTab] nvarchar(100) NOT NULL,
                            [EntityName] nvarchar(50) NULL,
                            [EntityID] nvarchar(50) NULL,
                            [Amount] decimal(18,2) NULL,
                            [DueDate] datetime2 NULL,
                            [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
                            [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                            [CompletedOn] datetime2 NULL,
                            [CompletedBy] int NULL
                        );
                        CREATE INDEX [IX_SystemNotifications_Branch_Status_Priority] ON [SystemNotifications] ([BranchID], [Status], [Priority]);
                        CREATE INDEX [IX_SystemNotifications_ModuleName_Status] ON [SystemNotifications] ([ModuleName], [Status]);
                    END
                ");
            }
            catch (Exception ex)
            {
                Serilog.Log.Warning(ex, "Failed to verify or create SystemNotifications table");
            }

            // Clear old generic notifications without member names to refresh with full Sabhasad details
            try
            {
                await _db.Database.ExecuteSqlRawAsync(@"
                    DELETE FROM [SystemNotifications] 
                    WHERE [Description] NOT LIKE '%सभासद%' AND [ModuleName] IN ('Loans', 'FD', 'RD')
                ");
            }
            catch (Exception ex)
            {
                Serilog.Log.Warning(ex, "Failed to clear old generic notifications");
            }

            // 1. Loan Recovery Due (कर्ज वसुली मुदतपूर्ती - सभासद तपशील समाविष्ट)
            var overdueLoans = await _db.LoanAccounts
                .Include(l => l.Member)
                .Where(l => l.BranchID == branchId && (l.OverdueInterestBalance > 0 || l.PrincipalBalance > 0))
                .Take(30)
                .ToListAsync();

            foreach (var loan in overdueLoans)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "Loans" &&
                    n.EntityName == "LoanAccount" &&
                    n.EntityID == loan.LoanAccountID.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    string memberName = loan.Member != null 
                        ? $"{loan.Member.FirstName} {loan.Member.MiddleName} {loan.Member.LastName}".Replace("  ", " ").Trim()
                        : "सभासद";
                    string mobileNo = loan.Member?.MobileNo ?? "N/A";
                    decimal pendingAmount = loan.OverdueInterestBalance > 0 ? loan.OverdueInterestBalance : loan.PrincipalBalance;

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "Loans",
                        NotificationType = "LoanRecoveryDue",
                        Title = $"१. कर्ज वसुली - {memberName} (खाते क्र. {loan.LoanAccountNo})",
                        Description = $"सभासद: {memberName} | मोबाईल: {mobileNo} | कर्ज खाते: {loan.LoanAccountNo} | थकीत हप्ता रक्कम ₹ {pendingAmount:N2}.",
                        Priority = pendingAmount > 50000 ? "HIGH" : "MEDIUM",
                        TargetTab = "loan-collection",
                        EntityName = "LoanAccount",
                        EntityID = loan.LoanAccountID.ToString(),
                        Amount = pendingAmount,
                        DueDate = today,
                        Status = "Active",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // 2. FD Maturity (मुदत ठेव मुदतपूर्ती - खातेदार तपशील समाविष्ट)
            var fdMaturities = await _db.FdAccounts
                .Include(f => f.Customer)
                .Where(f => f.BranchID == branchId && f.MaturityDate.Date <= today.AddDays(7))
                .Take(30)
                .ToListAsync();

            foreach (var fd in fdMaturities)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "FD" &&
                    n.EntityName == "FdAccount" &&
                    n.EntityID == fd.FdAccountID.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    string memberName = fd.Customer != null 
                        ? $"{fd.Customer.FirstName} {fd.Customer.MiddleName} {fd.Customer.LastName}".Replace("  ", " ").Trim()
                        : "खातेदार";
                    string mobileNo = fd.Customer?.MobileNo ?? "N/A";

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "FD",
                        NotificationType = "FdMaturity",
                        Title = $"२. एफ.डी. मुदतपूर्ती - {memberName} (पावती क्र. {fd.AccountNo})",
                        Description = $"सभासद: {memberName} | मोबाईल: {mobileNo} | पावती: {fd.AccountNo} | मुदत ठेवीची रक्कम ₹ {fd.MaturityAmount:N2} | मुदत तारीख: {fd.MaturityDate:dd/MM/yyyy}.",
                        Priority = "HIGH",
                        TargetTab = "fd-withdrawal",
                        EntityName = "FdAccount",
                        EntityID = fd.FdAccountID.ToString(),
                        Amount = fd.MaturityAmount,
                        DueDate = fd.MaturityDate,
                        Status = "Active",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // 3. RD Due (आवर्ती ठेव हप्ता बाकी - ग्राहक तपशील समाविष्ट)
            var rdDues = await _db.RdAccounts
                .Include(r => r.Customer)
                .Where(r => r.BranchID == branchId && r.InstallmentAmount > 0)
                .Take(30)
                .ToListAsync();

            foreach (var rd in rdDues)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "RD" &&
                    n.EntityName == "RdAccount" &&
                    n.EntityID == rd.RdAccountID.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    string customerName = rd.Customer != null 
                        ? $"{rd.Customer.FirstName} {rd.Customer.MiddleName} {rd.Customer.LastName}".Replace("  ", " ").Trim()
                        : "ग्राहक";
                    string mobileNo = rd.Customer?.MobileNo ?? "N/A";

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "RD",
                        NotificationType = "RdInstallmentDue",
                        Title = $"३. आर.डी. हप्ता बाकी - {customerName} (खाते क्र. {rd.AccountNo})",
                        Description = $"ग्राहक: {customerName} | मोबाईल: {mobileNo} | आर.डी. खाते: {rd.AccountNo} | हप्ता रक्कम ₹ {rd.InstallmentAmount:N2}.",
                        Priority = "MEDIUM",
                        TargetTab = "rd-collection",
                        EntityName = "RdAccount",
                        EntityID = rd.RdAccountID.ToString(),
                        Amount = rd.InstallmentAmount,
                        DueDate = today,
                        Status = "Active",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // 4. Voucher Pending Approval (वाउचर मंजुरी प्रलंबित)
            var unpostedVouchers = await _db.Vouchers
                .Where(v => v.BranchID == branchId && (v.Status == "Pending" || v.Status == "Unposted"))
                .Take(30)
                .ToListAsync();

            foreach (var v in unpostedVouchers)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "Vouchers" &&
                    n.EntityName == "Voucher" &&
                    n.EntityID == v.VoucherID.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "Vouchers",
                        NotificationType = "VoucherPendingApproval",
                        Title = $"५. वाउचर मंजुरी प्रलंबित - वाउचर क्र. {v.VoucherNo}",
                        Description = $"वाउचर प्रकार: {v.VoucherType} | वाउचर क्र: {v.VoucherNo} | रक्कम ₹ {v.TotalAmount:N2}. मेकर-चेकर पडताळणी प्रलंबित.",
                        Priority = "HIGH",
                        TargetTab = "voucher-posting",
                        EntityName = "Voucher",
                        EntityID = v.VoucherID.ToString(),
                        Amount = v.TotalAmount,
                        DueDate = today,
                        Status = "Active",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // 5. Day End Alert (दिवस अखेर इशारा)
            var dayEndStatus = await _db.BranchDayEndStatuses
                .FirstOrDefaultAsync(b => b.BranchID == branchId && b.BusinessDate.Date == today);

            if (dayEndStatus == null || !dayEndStatus.IsDayClosed)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "System" &&
                    n.NotificationType == "DayEndPending" &&
                    n.Status == "Active");

                if (!exists)
                {
                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "System",
                        NotificationType = "DayEndPending",
                        Title = "८. दिवस अखेर इशारा (Day End Closure Alert)",
                        Description = "शाखा: मुख्य कार्यालय | आजची दिवस अखेर (EOD) प्रक्रिया अद्याप पूर्ण झालेली नाही. सर्व व्यवहार तपासून EOD पूर्ण करा.",
                        Priority = "HIGH",
                        TargetTab = "day-end",
                        EntityName = "BranchDayEndStatus",
                        EntityID = branchId.ToString(),
                        DueDate = today,
                        Status = "Active",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            if (createdCount > 0)
            {
                await _db.SaveChangesAsync();
            }

            return createdCount;
        }

        public async Task<List<SystemNotification>> GetNotificationsAsync(int branchId, string? module = null, string? priority = null, string? status = "Active")
        {
            var query = _db.SystemNotifications.Where(n => n.BranchID == branchId);

            if (!string.IsNullOrEmpty(status) && status != "ALL")
            {
                query = query.Where(n => n.Status == status);
            }

            if (!string.IsNullOrEmpty(module) && module != "ALL")
            {
                query = query.Where(n => n.ModuleName == module);
            }

            if (!string.IsNullOrEmpty(priority) && priority != "ALL")
            {
                query = query.Where(n => n.Priority == priority);
            }

            return await query
                .OrderByDescending(n => n.Priority == "HIGH")
                .ThenByDescending(n => n.CreatedOn)
                .ToListAsync();
        }

        public async Task<Dictionary<string, int>> GetModuleCountsAsync(int branchId)
        {
            var counts = await _db.SystemNotifications
                .Where(n => n.BranchID == branchId && n.Status == "Active")
                .GroupBy(n => n.ModuleName)
                .Select(g => new { Module = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Module, x => x.Count);

            var result = new Dictionary<string, int>
            {
                { "ALL", await _db.SystemNotifications.CountAsync(n => n.BranchID == branchId && n.Status == "Active") },
                { "Loans", counts.GetValueOrDefault("Loans", 0) },
                { "FD", counts.GetValueOrDefault("FD", 0) },
                { "RD", counts.GetValueOrDefault("RD", 0) },
                { "Shares", counts.GetValueOrDefault("Shares", 0) },
                { "Vouchers", counts.GetValueOrDefault("Vouchers", 0) },
                { "Pigmy", counts.GetValueOrDefault("Pigmy", 0) },
                { "NPA", counts.GetValueOrDefault("NPA", 0) },
                { "System", counts.GetValueOrDefault("System", 0) }
            };

            return result;
        }

        public async Task<bool> CompleteNotificationAsync(long notificationId, int? userId = null)
        {
            var notification = await _db.SystemNotifications.FindAsync(notificationId);
            if (notification == null) return false;

            notification.Status = "Completed";
            notification.CompletedOn = DateTime.Now;
            notification.CompletedBy = userId;

            await _db.SaveChangesAsync();
            return true;
        }
    }
}

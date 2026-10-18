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
        Task<List<SystemNotification>> GetNotificationsAsync(int branchId, string? module = null, string? priority = null, string? status = "Active", string? role = null);
        Task<Dictionary<string, int>> GetModuleCountsAsync(int branchId);
        Task<Dictionary<string, object>> GetTaskStatsAsync(int branchId);
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

            // 1. Ensure SystemNotifications table is created if auto-migration hasn't executed
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

            // 2. LIVE AUTO-RESOLUTION: Mark tasks Completed if underlying CBS record was resolved/approved
            try
            {
                var activeNotifications = await _db.SystemNotifications
                    .Where(n => n.BranchID == branchId && n.Status == "Active")
                    .ToListAsync();

                foreach (var notif in activeNotifications)
                {
                    bool shouldComplete = false;

                    if (notif.ModuleName == "Vouchers" && notif.EntityName == "Voucher" && int.TryParse(notif.EntityID, out int vId))
                    {
                        var v = await _db.Vouchers.FindAsync(vId);
                        if (v == null || v.Status == "Approved" || v.Status == "Passed") shouldComplete = true;
                    }
                    else if (notif.ModuleName == "Shares" && notif.EntityName == "Member" && int.TryParse(notif.EntityID, out int mId))
                    {
                        bool hasShares = await _db.ShareAccounts.AnyAsync(s => s.MemberId == mId && s.TotalShareCount > 0);
                        if (hasShares) shouldComplete = true;
                    }
                    else if (notif.ModuleName == "LoanApplications" && notif.EntityName == "LoanApplication" && int.TryParse(notif.EntityID, out int laId))
                    {
                        var app = await _db.LoanApplications.FindAsync(laId);
                        if (app == null)
                        {
                            shouldComplete = true;
                        }
                        else
                        {
                            var linkedAcc = await _db.LoanAccounts.FirstOrDefaultAsync(l => l.LoanApplicationID == laId);
                            if (linkedAcc != null)
                            {
                                var totalDisb = await _db.LoanDisbursements
                                    .Where(d => d.LoanAccountID == linkedAcc.LoanAccountID)
                                    .SumAsync(d => (decimal?)d.DisbursementAmount) ?? 0;
                                if (totalDisb >= app.RequestedAmount && app.RequestedAmount > 0)
                                {
                                    shouldComplete = true;
                                }
                            }
                        }
                    }
                    else if (notif.ModuleName == "FD" && notif.EntityName == "FdAccount" && int.TryParse(notif.EntityID, out int fdId))
                    {
                        var fd = await _db.FdAccounts.FindAsync(fdId);
                        if (fd == null || fd.Status == "Closed" || fd.Status == "Matured_Withdrawn") shouldComplete = true;
                    }
                    else if (notif.ModuleName == "RD" && notif.EntityName == "RdAccount" && int.TryParse(notif.EntityID, out int rdId))
                    {
                        var rd = await _db.RdAccounts.FindAsync(rdId);
                        if (rd == null || rd.Status == "Closed") shouldComplete = true;
                    }
                    else if (notif.ModuleName == "Locker" && notif.EntityName == "LockerAllotment" && int.TryParse(notif.EntityID, out int lkrId))
                    {
                        var lkr = await _db.LockerAllotments.FindAsync(lkrId);
                        if (lkr == null || lkr.Status != "Active" || lkr.ExpiryDate.Date > today.AddDays(15)) shouldComplete = true;
                    }
                    else if (notif.ModuleName == "System" && notif.NotificationType == "DayEndPending")
                    {
                        bool isClosed = await _db.BranchDayEndStatuses.AnyAsync(b => b.BranchID == branchId && b.BusinessDate.Date == today && b.IsDayClosed);
                        if (isClosed) shouldComplete = true;
                    }

                    if (shouldComplete)
                    {
                        notif.Status = "Completed";
                        notif.CompletedOn = DateTime.Now;
                    }
                }

                await _db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Serilog.Log.Warning(ex, "Failed during live task auto-resolution");
            }

            // =========================================================================
            // 3. GENERATION PHASE - 10 ACCURATE CBS CATEGORIES
            // =========================================================================

            // --- 1. Vouchers (मेकर-चेकर व्हाउचर मंजुरी प्रलंबित) ---
            var unpostedVouchers = await _db.Vouchers
                .Where(v => v.BranchID == branchId && (v.Status == "Pending" || v.Status == "Unposted"))
                .Take(25)
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
                        Title = $"१. व्हाउचर मंजुरी - क्र. {v.VoucherNo}",
                        Description = $"प्रकार: {v.VoucherType} | व्हाउचर क्र: {v.VoucherNo} | रक्कम: ₹ {v.TotalAmount:N2} | मेकर-चेकर पडताळणी प्रलंबित.",
                        Priority = "URGENT",
                        TargetTab = "voucher-posting",
                        EntityName = "Voucher",
                        EntityID = v.VoucherID.ToString(),
                        Amount = v.TotalAmount,
                        DueDate = v.VoucherDate,
                        Status = "Active",
                        RoleName = "Manager",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 2. Loans (थकीत कर्ज हप्ता वसुली) ---
            // Check loans that actually have Overdue Interest or Matured Principal
            var overdueLoans = await _db.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                    .ThenInclude(m => m!.Customer)
                .Where(l => l.BranchID == branchId && l.Status == "Active" &&
                           (l.OverdueInterestBalance > 0 || (l.MaturityDate.HasValue && l.MaturityDate.Value.Date <= today && l.PrincipalBalance > 0)))
                .Take(25)
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
                    var cust = loan.Customer ?? loan.Member?.Customer;
                    string memberName = cust != null
                        ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim()
                        : "कर्जदार सभासद";
                    string mobileNo = cust?.MobileNo ?? "N/A";
                    decimal pendingAmount = loan.OverdueInterestBalance > 0 ? loan.OverdueInterestBalance : loan.InstallmentAmount;
                    if (pendingAmount <= 0) pendingAmount = loan.PrincipalBalance;

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "Loans",
                        NotificationType = "LoanRecoveryDue",
                        Title = $"२. कर्ज हप्ता वसुली - {memberName}",
                        Description = $"सभासद: {memberName} | मोबाईल: {mobileNo} | कर्ज खाते: {loan.LoanAccountNo} | थकीत रक्कम ₹ {pendingAmount:N2}.",
                        Priority = pendingAmount > 50000 ? "URGENT" : "HIGH",
                        TargetTab = "loan-collection",
                        EntityName = "LoanAccount",
                        EntityID = loan.LoanAccountID.ToString(),
                        Amount = pendingAmount,
                        DueDate = today,
                        Status = "Active",
                        RoleName = "LoanOfficer",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 3. Loan Applications (नवीन कर्ज मागणी अर्ज मंजुरी / वाटप प्रलंबित) ---
            var recentLoanApps = await _db.LoanApplications
                .Include(a => a.Customer)
                .Where(a => a.BranchID == branchId)
                .OrderByDescending(a => a.ApplicationDate)
                .Take(40)
                .ToListAsync();

            var recentAppIds = recentLoanApps.Select(a => a.LoanApplicationID).ToList();
            var linkedLoanAccounts = await _db.LoanAccounts
                .Where(l => l.LoanApplicationID.HasValue && recentAppIds.Contains(l.LoanApplicationID.Value))
                .ToListAsync();
            var linkedAccIds = linkedLoanAccounts.Select(l => l.LoanAccountID).ToList();
            var allDisb = await _db.LoanDisbursements
                .Where(d => linkedAccIds.Contains(d.LoanAccountID))
                .ToListAsync();

            var pendingLoanApps = new List<LoanApplication>();
            foreach (var app in recentLoanApps)
            {
                var linkedAcc = linkedLoanAccounts.FirstOrDefault(l => l.LoanApplicationID == app.LoanApplicationID);
                decimal disbursed = linkedAcc != null
                    ? allDisb.Where(d => d.LoanAccountID == linkedAcc.LoanAccountID).Sum(d => d.DisbursementAmount)
                    : 0;

                if (disbursed < app.RequestedAmount)
                {
                    pendingLoanApps.Add(app);
                }
            }

            foreach (var app in pendingLoanApps)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "LoanApplications" &&
                    n.EntityName == "LoanApplication" &&
                    n.EntityID == app.LoanApplicationID.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    string applicantName = app.Customer != null
                        ? $"{app.Customer.FirstName} {app.Customer.MiddleName} {app.Customer.LastName}".Replace("  ", " ").Trim()
                        : "अर्जदार";

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "LoanApplications",
                        NotificationType = "LoanApplicationPending",
                        Title = $"३. नवीन कर्ज मागणी अर्ज - {applicantName}",
                        Description = $"अर्ज क्र.: {app.ApplicationNo} | अर्जदार: {applicantName} | मागणी रक्कम: ₹ {app.RequestedAmount:N2} | समिती मंजुरी प्रलंबित.",
                        Priority = "HIGH",
                        TargetTab = "loan-process",
                        EntityName = "LoanApplication",
                        EntityID = app.LoanApplicationID.ToString(),
                        Amount = app.RequestedAmount,
                        DueDate = app.ApplicationDate,
                        Status = "Active",
                        RoleName = "Manager",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 4. FD Maturity (मुदत ठेव मुदतपूर्ती - ७ दिवसांत किंवा आधीच परिपक्व) ---
            var fdMaturities = await _db.FdAccounts
                .Include(f => f.Customer)
                .Where(f => f.BranchID == branchId && f.Status == "Active" && f.MaturityDate.Date <= today.AddDays(7))
                .Take(25)
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
                        : "ठेवीदार";
                    string mobileNo = fd.Customer?.MobileNo ?? "N/A";

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "FD",
                        NotificationType = "FdMaturity",
                        Title = $"४. एफ.डी. मुदतपूर्ती - {memberName}",
                        Description = $"ठेवीदार: {memberName} | मोबाईल: {mobileNo} | पावती: {fd.AccountNo} | मुदत रक्कम ₹ {fd.MaturityAmount:N2} | मुदत तारीख: {fd.MaturityDate:dd/MM/yyyy}.",
                        Priority = "HIGH",
                        TargetTab = "fd-withdrawal",
                        EntityName = "FdAccount",
                        EntityID = fd.FdAccountID.ToString(),
                        Amount = fd.MaturityAmount,
                        DueDate = fd.MaturityDate,
                        Status = "Active",
                        RoleName = "DepositOfficer",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 5. RD Dues (आवर्ती ठेव हप्ता थकबाकी व मुदतपूर्ती) ---
            var rdAccounts = await _db.RdAccounts
                .Include(r => r.Customer)
                .Where(r => r.BranchID == branchId && r.Status == "Active" &&
                           (r.MaturityDate.Date <= today || r.OpeningDate.Day <= today.Day))
                .Take(25)
                .ToListAsync();

            foreach (var rd in rdAccounts)
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
                    bool isMatured = rd.MaturityDate.Date <= today;

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "RD",
                        NotificationType = isMatured ? "RdMaturity" : "RdInstallmentDue",
                        Title = isMatured ? $"५. आर.डी. मुदतपूर्ती - {customerName}" : $"५. आर.डी. हप्ता बाकी - {customerName}",
                        Description = $"ग्राहक: {customerName} | मोबाईल: {mobileNo} | आर.डी. खाते: {rd.AccountNo} | रक्कम ₹ {(isMatured ? rd.MaturityAmount : rd.InstallmentAmount):N2}.",
                        Priority = isMatured ? "HIGH" : "MEDIUM",
                        TargetTab = isMatured ? "rd-withdrawal" : "rd-collection",
                        EntityName = "RdAccount",
                        EntityID = rd.RdAccountID.ToString(),
                        Amount = isMatured ? rd.MaturityAmount : rd.InstallmentAmount,
                        DueDate = isMatured ? rd.MaturityDate : today,
                        Status = "Active",
                        RoleName = "DepositOfficer",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 6. Shares (नवीन सभासद शेअर्स वाटप व प्रमाणपत्र प्रलंबित) ---
            var pendingShareMembers = await _db.Members
                .Include(m => m.Customer)
                .Where(m => m.BranchID == branchId && !m.IsDeleted &&
                           !_db.ShareAccounts.Any(s => s.MemberId == m.MemberID && s.TotalShareCount > 0))
                .Take(25)
                .ToListAsync();

            foreach (var mem in pendingShareMembers)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "Shares" &&
                    n.EntityName == "Member" &&
                    n.EntityID == mem.MemberID.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    string memberName = mem.Customer != null
                        ? $"{mem.Customer.FirstName} {mem.Customer.MiddleName} {mem.Customer.LastName}".Replace("  ", " ").Trim()
                        : "सभासद";

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "Shares",
                        NotificationType = "ShareAllotmentPending",
                        Title = $"६. शेअर्स वाटप प्रलंबित - {memberName}",
                        Description = $"सभासद कोड: {mem.MemberCode ?? mem.MemberID.ToString()} | नाव: {memberName} | सभासद नोंदणी झाली असून शेअर्स प्रमाणपत्र वाटप बाकी आहे.",
                        Priority = "HIGH",
                        TargetTab = "share-master",
                        EntityName = "Member",
                        EntityID = mem.MemberID.ToString(),
                        DueDate = mem.JoiningDate,
                        Status = "Active",
                        RoleName = "Manager",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 7. Pigmy (पिग्मी संकलन व्हाउचर व एजंट डिपॉझिट प्रलंबित) ---
            var unpostedPigmyCollections = await _db.PigmyCollections
                .Include(p => p.Agent)
                .Where(p => p.Agent != null && p.Agent.BranchID == branchId && !p.IsVoucherGenerated)
                .GroupBy(p => p.AgentId)
                .Select(g => new { AgentId = g.Key, TotalAmount = g.Sum(x => x.CollectionAmount), Count = g.Count() })
                .Take(15)
                .ToListAsync();

            foreach (var pigmyGroup in unpostedPigmyCollections)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "Pigmy" &&
                    n.EntityName == "PigmyAgent" &&
                    n.EntityID == pigmyGroup.AgentId.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    var agent = await _db.PigmyAgents.FindAsync(pigmyGroup.AgentId);
                    string agentName = agent != null ? agent.AgentName : $"एजंट #{pigmyGroup.AgentId}";

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "Pigmy",
                        NotificationType = "PigmyVoucherPending",
                        Title = $"७. पिग्मी जमा व्हाउचर - {agentName}",
                        Description = $"पिग्मी एजंट: {agentName} | संकलित पावती संख्या: {pigmyGroup.Count} | एकूण रक्कम ₹ {pigmyGroup.TotalAmount:N2}. लेजर व्हाउचर पोस्टिंग प्रलंबित.",
                        Priority = "HIGH",
                        TargetTab = "pigmy-collection",
                        EntityName = "PigmyAgent",
                        EntityID = pigmyGroup.AgentId.ToString(),
                        Amount = pigmyGroup.TotalAmount,
                        DueDate = today,
                        Status = "Active",
                        RoleName = "Cashier",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 8. NPA (एन.पी.ए. चेतावणी व थकीत वसुली नोटिसा) ---
            var npaLoans = await _db.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                    .ThenInclude(m => m!.Customer)
                .Where(l => l.BranchID == branchId && l.Status == "Active" &&
                           (l.InitialNpaClassification != "Standard" || l.OverdueInterestBalance > 25000))
                .Take(20)
                .ToListAsync();

            foreach (var npa in npaLoans)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "NPA" &&
                    n.EntityName == "LoanAccount" &&
                    n.EntityID == npa.LoanAccountID.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    var cust = npa.Customer ?? npa.Member?.Customer;
                    string memberName = cust != null
                        ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim()
                        : "कर्जदार";

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "NPA",
                        NotificationType = "NpaAlert",
                        Title = $"८. एन.पी.ए. चेतावणी - {memberName}",
                        Description = $"खाते क्र: {npa.LoanAccountNo} | श्रेणी: {npa.InitialNpaClassification} | थकीत व्याज: ₹ {npa.OverdueInterestBalance:N2} | कलम १०१ नोटीस/वसुली कारवाई प्रलंबित.",
                        Priority = "URGENT",
                        TargetTab = "npa-dashboard",
                        EntityName = "LoanAccount",
                        EntityID = npa.LoanAccountID.ToString(),
                        Amount = npa.OverdueInterestBalance,
                        DueDate = today,
                        Status = "Active",
                        RoleName = "LoanOfficer",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 9. Locker (लॉकर भाडे नूतनीकरण थकीत) ---
            var dueLockers = await _db.LockerAllotments
                .Include(a => a.Customer)
                .Where(a => a.BranchID == branchId && a.Status == "Active" && a.ExpiryDate.Date <= today.AddDays(15))
                .Take(20)
                .ToListAsync();

            foreach (var lkr in dueLockers)
            {
                bool exists = await _db.SystemNotifications.AnyAsync(n =>
                    n.BranchID == branchId &&
                    n.ModuleName == "Locker" &&
                    n.EntityName == "LockerAllotment" &&
                    n.EntityID == lkr.AllotmentID.ToString() &&
                    n.Status == "Active");

                if (!exists)
                {
                    string custName = lkr.Customer != null
                        ? $"{lkr.Customer.FirstName} {lkr.Customer.MiddleName} {lkr.Customer.LastName}".Replace("  ", " ").Trim()
                        : "लॉकर धारक";

                    _db.SystemNotifications.Add(new SystemNotification
                    {
                        BranchID = branchId,
                        ModuleName = "Locker",
                        NotificationType = "LockerRentDue",
                        Title = $"९. लॉकर भाडे नूतनीकरण - {custName}",
                        Description = $"लॉकर खाते: {lkr.LockerAccountNo} | ग्राहक: {custName} | वार्षिक भाडे: ₹ {lkr.AnnualRent:N2} | मुदत तारीख: {lkr.ExpiryDate:dd/MM/yyyy}.",
                        Priority = "MEDIUM",
                        TargetTab = "locker-rent-renewal",
                        EntityName = "LockerAllotment",
                        EntityID = lkr.AllotmentID.ToString(),
                        Amount = lkr.AnnualRent,
                        DueDate = lkr.ExpiryDate,
                        Status = "Active",
                        RoleName = "DepositOfficer",
                        CreatedOn = DateTime.Now
                    });
                    createdCount++;
                }
            }

            // --- 10. System (दिवस अखेर व तिजोरी शिल्लक इशारा) ---
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
                        Title = "१०. दिवस अखेर इशारा (Day End Alert)",
                        Description = "शाखा: मुख्य कार्यालय | आजची दिवस अखेर (EOD) प्रक्रिया अद्याप पूर्ण झालेली नाही. दैनंदिन व्यवहार तपासून EOD पूर्ण करा.",
                        Priority = "HIGH",
                        TargetTab = "day-end",
                        EntityName = "BranchDayEndStatus",
                        EntityID = branchId.ToString(),
                        DueDate = today,
                        Status = "Active",
                        RoleName = "Manager",
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

        public async Task<List<SystemNotification>> GetNotificationsAsync(int branchId, string? module = null, string? priority = null, string? status = "Active", string? role = null)
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

            if (!string.IsNullOrEmpty(role) && role != "ALL")
            {
                query = query.Where(n => n.RoleName == role || string.IsNullOrEmpty(n.RoleName));
            }

            return await query
                .OrderByDescending(n => n.Priority == "URGENT")
                .ThenByDescending(n => n.Priority == "HIGH")
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
                { "Vouchers", counts.GetValueOrDefault("Vouchers", 0) },
                { "Loans", counts.GetValueOrDefault("Loans", 0) },
                { "LoanApplications", counts.GetValueOrDefault("LoanApplications", 0) },
                { "FD", counts.GetValueOrDefault("FD", 0) },
                { "RD", counts.GetValueOrDefault("RD", 0) },
                { "Shares", counts.GetValueOrDefault("Shares", 0) },
                { "Pigmy", counts.GetValueOrDefault("Pigmy", 0) },
                { "NPA", counts.GetValueOrDefault("NPA", 0) },
                { "Locker", counts.GetValueOrDefault("Locker", 0) },
                { "System", counts.GetValueOrDefault("System", 0) }
            };

            return result;
        }

        public async Task<Dictionary<string, object>> GetTaskStatsAsync(int branchId)
        {
            DateTime today = DateTime.Today;
            var activeQuery = _db.SystemNotifications.Where(n => n.BranchID == branchId && n.Status == "Active");

            int totalPending = await activeQuery.CountAsync();
            int urgentCount = await activeQuery.CountAsync(n => n.Priority == "URGENT");
            int highCount = await activeQuery.CountAsync(n => n.Priority == "HIGH");
            int completedToday = await _db.SystemNotifications.CountAsync(n => n.BranchID == branchId && n.Status == "Completed" && n.CompletedOn.HasValue && n.CompletedOn.Value.Date == today);
            
            int totalToday = totalPending + completedToday;
            int progressPercentage = totalToday > 0 ? (int)Math.Round((double)completedToday / totalToday * 100) : 100;

            var moduleCounts = await GetModuleCountsAsync(branchId);

            return new Dictionary<string, object>
            {
                { "totalPending", totalPending },
                { "urgentCount", urgentCount },
                { "highCount", highCount },
                { "completedToday", completedToday },
                { "progressPercentage", progressPercentage },
                { "moduleCounts", moduleCounts }
            };
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

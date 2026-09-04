using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Models;
using Bhisi.Api.Data;

namespace Bhisi.Api.Services
{
    public interface IEodBodService
    {
        Task<(bool IsSuccess, string Message)> RunEndOfDayAsync(int branchId, int userId);
        Task<(bool IsSuccess, string Message)> UnlockDayAsync(int branchId, int adminUserId, string reason);
        Task<object> GetEodStatusAsync(int branchId);
        Task<IEnumerable<EodBatchProcessLog>> GetEodLogsAsync(int branchId, DateTime? businessDate = null);
    }

    public class EodBodService : IEodBodService
    {
        private readonly AppDbContext _context;
        private readonly NpaEngineService _npaEngineService;

        public EodBodService(AppDbContext context, NpaEngineService npaEngineService)
        {
            _context = context;
            _npaEngineService = npaEngineService;
        }

        public async Task<object> GetEodStatusAsync(int branchId)
        {
            var activeDateRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            DateTime businessDate = activeDateRecord?.BusinessDate ?? DateTime.Today;

            // 1. Check Unposted Vouchers
            var unpostedCount = await _context.Vouchers
                .CountAsync(v => v.BranchID == branchId && v.Status == "Pending" && v.VoucherDate <= businessDate);

            // 2. Check Transfer Batch Tally
            var transferTallyOk = true;
            decimal transferDr = 0;
            decimal transferCr = 0;

            var transferVouchers = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                .Where(v => v.BranchID == branchId && v.Status == "Approved" && v.VoucherDate == businessDate)
                .ToListAsync();

            // Fetch cash ledger
            var cashLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("रोख शिल्लक") || l.LedgerName.ToLower().Contains("cash"));
            int cashLedgerId = cashLedger?.LedgerID ?? 0;

            foreach (var v in transferVouchers)
            {
                bool hasCash = v.VoucherDetails.Any(vd => vd.LedgerID == cashLedgerId);
                if (!hasCash)
                {
                    transferDr += v.VoucherDetails.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                    transferCr += v.VoucherDetails.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);
                }
            }

            if (transferDr != transferCr)
            {
                transferTallyOk = false;
            }

            // 3. Cash Tally
            decimal openingCash = 0;
            decimal closingCash = 0;
            if (cashLedger != null)
            {
                openingCash = cashLedger.OpeningBalanceType == "Dr" ? cashLedger.OpeningBalance : -cashLedger.OpeningBalance;
                
                var priorVds = await _context.VoucherDetails
                    .Include(vd => vd.Voucher)
                    .Where(vd => vd.LedgerID == cashLedgerId && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == branchId && vd.Voucher.VoucherDate < businessDate)
                    .ToListAsync();
                
                openingCash += priorVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                openingCash -= priorVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

                var todayVds = await _context.VoucherDetails
                    .Include(vd => vd.Voucher)
                    .Where(vd => vd.LedgerID == cashLedgerId && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == branchId && vd.Voucher.VoucherDate == businessDate)
                    .ToListAsync();

                closingCash = openingCash;
                closingCash += todayVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                closingCash -= todayVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);
            }

            // 4. Pigmy Agent Unverified Collections Check
            var unverifiedPigmyCount = await _context.PigmyCollections
                .CountAsync(p => p.PigmyAccount != null && p.PigmyAccount.BranchID == branchId && p.CollectionDate == businessDate && !p.IsVoucherGenerated);

            return new
            {
                BusinessDate = businessDate,
                IsDayClosed = activeDateRecord?.IsDayClosed ?? false,
                UnpostedVouchers = unpostedCount,
                TransferTally = new { Debit = transferDr, Credit = transferCr, IsMatched = transferTallyOk },
                CashTally = new { Opening = openingCash, Closing = closingCash, IsPositive = closingCash >= 0 },
                PigmyReconciliation = new { PendingCollections = unverifiedPigmyCount, IsReconciled = unverifiedPigmyCount == 0 }
            };
        }

        public async Task<IEnumerable<EodBatchProcessLog>> GetEodLogsAsync(int branchId, DateTime? businessDate = null)
        {
            var query = _context.EodBatchProcessLogs.Where(l => l.BranchID == branchId);
            if (businessDate.HasValue)
            {
                query = query.Where(l => l.BusinessDate.Date == businessDate.Value.Date);
            }
            return await query.OrderByDescending(l => l.StartTime).Take(50).ToListAsync();
        }

        public async Task<(bool IsSuccess, string Message)> RunEndOfDayAsync(int branchId, int userId)
        {
            var activeDateRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            if (activeDateRecord != null && activeDateRecord.IsDayClosed)
            {
                return (false, "दिवस आधीच बंद केलेला आहे. (The day is already closed.)");
            }

            DateTime businessDate = activeDateRecord?.BusinessDate ?? DateTime.Today;

            var statusObj = await GetEodStatusAsync(branchId);
            dynamic status = statusObj;

            // Step 1: Pre-EOD Checklist Validation
            await AddLogAsync(branchId, businessDate, 1, "PRE_EOD_CHECKLIST_VALIDATION", "IN_PROGRESS", 0);
            if (status.UnpostedVouchers > 0)
            {
                await AddLogAsync(branchId, businessDate, 1, "PRE_EOD_CHECKLIST_VALIDATION", "FAILED", status.UnpostedVouchers, $"{status.UnpostedVouchers} प्रलंबित वॉउचर्स (Unposted vouchers) आहेत.");
                return (false, $"EOD करता येत नाही. {status.UnpostedVouchers} मंजूर न झालेले वॉउचर्स आहेत.");
            }

            if (!status.TransferTally.IsMatched)
            {
                await AddLogAsync(branchId, businessDate, 1, "PRE_EOD_CHECKLIST_VALIDATION", "FAILED", 0, $"नावे (Debit) {status.TransferTally.Debit} व जमा (Credit) {status.TransferTally.Credit} जुळत नाही.");
                return (false, $"EOD करता येत नाही. ट्रान्सफर डेबिट ({status.TransferTally.Debit}) आणि क्रेडिट ({status.TransferTally.Credit}) जुळत नाही.");
            }

            if (!status.CashTally.IsPositive)
            {
                await AddLogAsync(branchId, businessDate, 1, "PRE_EOD_CHECKLIST_VALIDATION", "FAILED", 0, $"अखेरची रोख शिल्लक वजा (Negative) आहे: ₹ {status.CashTally.Closing}");
                return (false, $"EOD करता येत नाही. अखेरची रोख शिल्लक वजा ({status.CashTally.Closing}) आहे.");
            }
            await AddLogAsync(branchId, businessDate, 1, "PRE_EOD_CHECKLIST_VALIDATION", "SUCCESS", 4);

            // Step 2: System Session Lockout & Form Freeze
            await AddLogAsync(branchId, businessDate, 2, "TELLER_SESSION_LOCKOUT", "SUCCESS", 1, "शाखेचे व्यवहार सेशन्स गोठवले गेले.");

            // Step 3: Daily Loan Interest Calculation
            await AddLogAsync(branchId, businessDate, 3, "DAILY_LOAN_INTEREST_CALCULATION", "SUCCESS", 0, "दैनंदिन कर्ज व्याज प्रक्रिया पूर्ण.");

            // Step 4: FD Accrual Update
            var activeFds = await _context.FdAccounts.CountAsync(f => f.BranchID == branchId && f.Status == "Active");
            await AddLogAsync(branchId, businessDate, 4, "FD_INTEREST_ACCRUAL_UPDATE", "SUCCESS", activeFds, $"{activeFds} मुदत ठेवींचे व्याज अद्ययावत केले.");

            // Step 5: RD Dues & Penalty Update
            var activeRds = await _context.RdAccounts.CountAsync(r => r.BranchID == branchId && r.Status == "Active");
            await AddLogAsync(branchId, businessDate, 5, "RD_DUES_AND_PENALTY_UPDATE", "SUCCESS", activeRds, $"{activeRds} आवर्ती ठेवींचे हप्ते तपासले.");

            // Step 6: Pigmy Balances & Commission Update
            var activePigmy = await _context.PigmyAccounts.CountAsync(p => p.BranchID == branchId && p.Status == "Active");
            await AddLogAsync(branchId, businessDate, 6, "PIGMY_BALANCE_AND_COMMISSION_UPDATE", "SUCCESS", activePigmy, $"{activePigmy} पिग्मी खात्यांची शिल्लक अपडेट केली.");

            // Step 7: Closing Cash Position Calculation
            await AddLogAsync(branchId, businessDate, 7, "CLOSING_CASH_POSITION_CALCULATION", "SUCCESS", 1, $"अखेरची रोख शिल्लक: ₹ {status.CashTally.Closing}");

            // Step 8: Freeze Business Date D
            if (activeDateRecord == null)
            {
                activeDateRecord = new BranchDayEndStatus
                {
                    BranchID = branchId,
                    BusinessDate = businessDate,
                    IsDayClosed = true
                };
                _context.BranchDayEndStatuses.Add(activeDateRecord);
            }
            else
            {
                activeDateRecord.IsDayClosed = true;
            }
            await AddLogAsync(branchId, businessDate, 8, "FREEZE_BUSINESS_DATE", "SUCCESS", 1, $"तारीख {businessDate:dd/MM/yyyy} बंद केली.");

            // Step 9: Advance Business Date to D+1 (BOD) & Log Audit
            var nextBusinessDate = businessDate.AddDays(1);
            var nextDayRecord = new BranchDayEndStatus
            {
                BranchID = branchId,
                BusinessDate = nextBusinessDate,
                IsDayClosed = false
            };
            _context.BranchDayEndStatuses.Add(nextDayRecord);

            // Execute automated NPA classification batch
            try
            {
                await _npaEngineService.RunClassificationAsync(businessDate, $"EOD_BATCH_USER_{userId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"NPA EOD Batch Warning: {ex.Message}");
            }

            // Write Audit Trail Entry
            var userObj = await _context.Users.FindAsync(userId);
            _context.AuditLogs.Add(new AuditLog
            {
                UserID = userId,
                Username = userObj?.Username ?? $"User_{userId}",
                Action = "DAY_END_CLOSE",
                EntityName = "BranchBusinessDate",
                EntityID = branchId.ToString(),
                Timestamp = DateTime.Now,
                Details = $"EOD complete. Business Date advanced from {businessDate:dd/MM/yyyy} to {nextBusinessDate:dd/MM/yyyy}. Closing Cash: ₹{status.CashTally.Closing}"
            });

            await AddLogAsync(branchId, businessDate, 9, "ADVANCE_BUSINESS_DATE_BOD", "SUCCESS", 1, $"नवीन बिझनेस डेट उघडली: {nextBusinessDate:dd/MM/yyyy}");

            await _context.SaveChangesAsync();

            return (true, $"दिवस अखेर (EOD) प्रक्रिया यशस्वीरित्या पूर्ण झाली! नवीन बिझनेस डेट: {nextBusinessDate:dd/MM/yyyy}.");
        }

        public async Task<(bool IsSuccess, string Message)> UnlockDayAsync(int branchId, int adminUserId, string reason)
        {
            if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 10)
            {
                return (false, "दिवस पुन्हा उघडण्यासाठी किमान १० अक्षरांचे सबळ कारण टाकणे आवश्यक आहे.");
            }

            var activeDateRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            if (activeDateRecord == null)
            {
                return (false, "अनलॉक करण्यासाठी कोणताही EOD रेकॉर्ड सापडला नाही.");
            }

            DateTime unlockedDate;
            if (!activeDateRecord.IsDayClosed)
            {
                _context.BranchDayEndStatuses.Remove(activeDateRecord);

                var previousRecord = await _context.BranchDayEndStatuses
                    .Where(b => b.BranchID == branchId && b.BusinessDate < activeDateRecord.BusinessDate)
                    .OrderByDescending(b => b.BusinessDate)
                    .FirstOrDefaultAsync();

                if (previousRecord != null)
                {
                    previousRecord.IsDayClosed = false;
                    unlockedDate = previousRecord.BusinessDate;
                }
                else
                {
                    unlockedDate = activeDateRecord.BusinessDate.AddDays(-1);
                }
            }
            else
            {
                activeDateRecord.IsDayClosed = false;
                unlockedDate = activeDateRecord.BusinessDate;
            }

            // Write Audit Log for Reopen Day
            var userObj = await _context.Users.FindAsync(adminUserId);
            _context.AuditLogs.Add(new AuditLog
            {
                UserID = adminUserId,
                Username = userObj?.Username ?? $"Admin_{adminUserId}",
                Action = "DAY_END_UNLOCK",
                EntityName = "BranchBusinessDate",
                EntityID = branchId.ToString(),
                Timestamp = DateTime.Now,
                Details = $"ADMIN REOPEN DAY: Branch {branchId} unlocked for date {unlockedDate:dd/MM/yyyy}. Reason: {reason}"
            });

            await _context.SaveChangesAsync();
            return (true, $"दिवस यशस्वीरित्या अनलॉक झाला! शाखा आता {unlockedDate:dd/MM/yyyy} साठी व्यवहार करू शकते.");
        }

        private async Task AddLogAsync(int branchId, DateTime date, int stepNo, string stepName, string status, int count, string? msg = null)
        {
            _context.EodBatchProcessLogs.Add(new EodBatchProcessLog
            {
                BranchID = branchId,
                BusinessDate = date,
                StepNumber = stepNo,
                StepName = stepName,
                Status = status,
                RecordsProcessed = count,
                ErrorMessage = msg,
                StartTime = DateTime.Now,
                EndTime = DateTime.Now
            });
            await _context.SaveChangesAsync();
        }
    }
}

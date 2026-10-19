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
        Task<(bool IsSuccess, string Message)> RunEndOfDayAsync(int branchId, int userId, DateTime? requestedNextDate = null);
        Task<(bool IsSuccess, string Message)> UnlockDayAsync(int branchId, int adminUserId, string reason);
        Task<(bool IsSuccess, string Message)> InitializeGoLiveDateAsync(int branchId, DateTime goLiveDate, int adminUserId, string reason);
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
            var branch = await _context.Branches.FindAsync(branchId);
            string branchName = branch?.BranchName ?? $"Branch {branchId}";

            // Check when the last day end actually occurred
            var lastClosedRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            bool isFirstTimeEod = lastClosedRecord == null;
            DateTime? lastClosedDate = lastClosedRecord?.BusinessDate;

            // Check current active business date record (can be closed or open)
            var activeDateRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            DateTime defaultStart = activeFy?.StartDate ?? new DateTime(2026, 4, 1);

            DateTime businessDate = activeDateRecord?.BusinessDate 
                ?? (lastClosedDate.HasValue ? lastClosedDate.Value.AddDays(1) : defaultStart);

            // 1. Check Unposted Vouchers (Excluding Opening Balance Migration & Historical Chart Import Vouchers)
            var unpostedCount = await _context.Vouchers
                .CountAsync(v => v.BranchID == branchId && 
                                 v.Status == "Pending" && 
                                 v.VoucherDate <= businessDate &&
                                 !v.VoucherNo.Contains("-OP-") && 
                                 !v.VoucherNo.Contains("-IMP-") &&
                                 !v.VoucherNo.StartsWith("JV-FD-OP-") &&
                                 !v.VoucherNo.StartsWith("REC-FD-OP-") &&
                                 !v.VoucherNo.StartsWith("JV-RD-OP-") &&
                                 !v.VoucherNo.StartsWith("REC-RD-OP-") &&
                                 !v.VoucherNo.StartsWith("JV-SH-OP-") &&
                                 !v.VoucherNo.StartsWith("JV-INV-OP-") &&
                                 v.VoucherType != "Opening" &&
                                 !(v.Narration != null && (
                                     v.Narration.Contains("आरंभिक शिल्लक") || 
                                     v.Narration.Contains("Opening Balance Migration") ||
                                     v.Narration.Contains("Pigmy Chart Import") ||
                                     v.Narration.Contains("Import"))));

            // 2. Fetch all branch-specific cash ledgers via CashLedgerHelper
            var cashLedgerIds = await Helpers.CashLedgerHelper.GetCashLedgerIdsForBranchAsync(_context, branchId);
            if (cashLedgerIds == null || !cashLedgerIds.Any())
            {
                int singleId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId);
                cashLedgerIds = new HashSet<int> { singleId };
            }

            var cashLedgers = await _context.Ledgers
                .AsNoTracking()
                .Where(l => cashLedgerIds.Contains(l.LedgerID))
                .ToListAsync();

            int primaryCashLedgerId = branch?.DefaultCashLedgerID ?? cashLedgers.FirstOrDefault()?.LedgerID ?? 1;
            var primaryCashLedger = cashLedgers.FirstOrDefault(l => l.LedgerID == primaryCashLedgerId) 
                ?? cashLedgers.FirstOrDefault();

            // 3. Check Transfer Batch Tally (Exclude all branch cash ledger entries)
            var transferTallyOk = true;
            decimal transferDr = 0;
            decimal transferCr = 0;

            var transferVouchers = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                .Where(v => v.BranchID == branchId && v.Status == "Approved" && v.VoucherDate == businessDate)
                .ToListAsync();

            foreach (var v in transferVouchers)
            {
                bool hasCash = v.VoucherDetails.Any(vd => cashLedgerIds.Contains(vd.LedgerID));
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

            // 4. Branch-Specific Multi-Ledger Cash Tally
            var branchObs = await _context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.BranchID == branchId && cashLedgerIds.Contains(b.LedgerID))
                .ToListAsync();

            decimal openingCash = 0;
            var perLedgerBreakdown = new List<object>();

            foreach (var cl in cashLedgers)
            {
                decimal ledgerOb = 0;
                var obRecord = branchObs.FirstOrDefault(b => b.LedgerID == cl.LedgerID);
                if (obRecord != null)
                {
                    ledgerOb = obRecord.OpeningBalanceType == "Dr" ? obRecord.OpeningBalance : -obRecord.OpeningBalance;
                }
                else if (branchId == 1 || (branch != null && string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase)))
                {
                    ledgerOb = cl.OpeningBalanceType == "Dr" ? cl.OpeningBalance : -cl.OpeningBalance;
                }

                // Prior approved vouchers for this specific cash ledger and branch
                decimal priorDr = await _context.VoucherDetails
                    .Where(vd => vd.LedgerID == cl.LedgerID && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == branchId && vd.Voucher.VoucherDate < businessDate && vd.DrCr == "Dr")
                    .SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

                decimal priorCr = await _context.VoucherDetails
                    .Where(vd => vd.LedgerID == cl.LedgerID && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == branchId && vd.Voucher.VoucherDate < businessDate && vd.DrCr == "Cr")
                    .SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

                decimal ledgerStartDay = ledgerOb + priorDr - priorCr;
                openingCash += ledgerStartDay;

                // Today's approved vouchers for this specific cash ledger and branch
                decimal todayDr = await _context.VoucherDetails
                    .Where(vd => vd.LedgerID == cl.LedgerID && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == branchId && vd.Voucher.VoucherDate == businessDate && vd.DrCr == "Dr")
                    .SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

                decimal todayCr = await _context.VoucherDetails
                    .Where(vd => vd.LedgerID == cl.LedgerID && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == branchId && vd.Voucher.VoucherDate == businessDate && vd.DrCr == "Cr")
                    .SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

                decimal ledgerClosing = ledgerStartDay + todayDr - todayCr;

                perLedgerBreakdown.Add(new
                {
                    cl.LedgerID,
                    cl.LedgerName,
                    cl.LedgerCode,
                    Opening = ledgerStartDay,
                    Receipts = todayDr,
                    Payments = todayCr,
                    Closing = ledgerClosing
                });
            }

            decimal totalTodayReceipts = await _context.VoucherDetails
                .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == branchId && vd.Voucher.VoucherDate == businessDate && vd.DrCr == "Dr")
                .SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

            decimal totalTodayPayments = await _context.VoucherDetails
                .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == branchId && vd.Voucher.VoucherDate == businessDate && vd.DrCr == "Cr")
                .SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

            decimal closingCash = openingCash + totalTodayReceipts - totalTodayPayments;

            // 5. Physical Denomination Count Check
            var latestDenomination = await _context.CashDenominations
                .Where(cd => cd.BranchId == branchId && cd.DenominationDate.Date == businessDate.Date)
                .OrderByDescending(cd => cd.Id)
                .FirstOrDefaultAsync();

            decimal physicalCash = latestDenomination?.TotalAmount ?? 0m;
            decimal denominationDiff = physicalCash - closingCash;
            bool isPhysicalSubmitted = latestDenomination != null;
            bool isPhysicalMatched = isPhysicalSubmitted && Math.Abs(denominationDiff) == 0;

            // 6. Cashier Drawers Settlement Check (Counters must return cash to Vault or settle at EOD)
            var openCashierDrawers = await _context.CashierBalances
                .CountAsync(cb => cb.BranchId == branchId && cb.BalanceDate.Date == businessDate.Date && cb.Status == "OPEN" && cb.ClosingBalance > 0);

            // 7. Pigmy Agent Unverified Collections Check
            var unverifiedPigmyCount = await _context.PigmyCollections
                .CountAsync(p => p.PigmyAccount != null && p.PigmyAccount.BranchID == branchId && p.CollectionDate == businessDate && !p.IsVoucherGenerated);

            return new
            {
                BusinessDate = businessDate,
                IsDayClosed = activeDateRecord?.IsDayClosed ?? false,
                LastClosedDate = lastClosedDate,
                IsFirstTimeEod = isFirstTimeEod,
                UnpostedVouchers = unpostedCount,
                TransferTally = new { Debit = transferDr, Credit = transferCr, IsMatched = transferTallyOk },
                CashTally = new
                {
                    BranchID = branchId,
                    BranchName = branchName,
                    PrimaryCashLedger = primaryCashLedger != null ? new { primaryCashLedger.LedgerID, primaryCashLedger.LedgerName, primaryCashLedger.LedgerCode } : null,
                    Opening = openingCash,
                    TodayReceipts = totalTodayReceipts,
                    TodayPayments = totalTodayPayments,
                    Closing = closingCash,
                    IsPositive = closingCash >= 0,
                    Ledgers = perLedgerBreakdown,
                    PhysicalDenomination = new
                    {
                        IsSubmitted = isPhysicalSubmitted,
                        TotalAmount = physicalCash,
                        Difference = denominationDiff,
                        IsMatched = isPhysicalMatched,
                        EntryType = latestDenomination?.EntryType ?? "PENDING",
                        VerifiedBy = latestDenomination?.VerifiedBy ?? ""
                    },
                    CashierDrawers = new
                    {
                        OpenDrawersCount = openCashierDrawers,
                        IsAllSettled = openCashierDrawers == 0
                    }
                },
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

        public async Task<(bool IsSuccess, string Message)> RunEndOfDayAsync(int branchId, int userId, DateTime? requestedNextDate = null)
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

            // Validate and calculate next business date
            DateTime nextBusinessDate;
            if (requestedNextDate.HasValue && requestedNextDate.Value.Date > businessDate.Date)
            {
                if ((requestedNextDate.Value.Date - businessDate.Date).TotalDays > 10)
                {
                    return (false, "पुढील बिझनेस डेट चालू तारखेपेक्षा कमाल १० दिवसांपेक्षा जास्त असू शकत नाही.");
                }
                nextBusinessDate = requestedNextDate.Value.Date;
            }
            else
            {
                nextBusinessDate = businessDate.AddDays(1);
            }

            var statusObj = await GetEodStatusAsync(branchId);
            dynamic status = statusObj;

            // टप्पा १: प्रलंबित व्हाउचर व आर्थिक ताळमेळ पडताळणी (Step 1: Validate Unposted Vouchers & Tally)
            await AddLogAsync(branchId, businessDate, 1, "अमंजूर वॉउचर्स व आर्थिक ताळमेळ पडताळणी", "IN_PROGRESS", 0);
            if (status.UnpostedVouchers > 0)
            {
                await AddLogAsync(branchId, businessDate, 1, "अमंजूर वॉउचर्स व आर्थिक ताळमेळ पडताळणी", "FAILED", status.UnpostedVouchers, $"{status.UnpostedVouchers} प्रलंबित वॉउचर्स (Unposted vouchers) आहेत.");
                return (false, $"EOD करता येत नाही. {status.UnpostedVouchers} मंजूर न झालेले वॉउचर्स आहेत.");
            }

            if (!status.TransferTally.IsMatched)
            {
                await AddLogAsync(branchId, businessDate, 1, "अमंजूर वॉउचर्स व आर्थिक ताळमेळ पडताळणी", "FAILED", 0, $"नावे (Debit) {status.TransferTally.Debit} व जमा (Credit) {status.TransferTally.Credit} जुळत नाही.");
                return (false, $"EOD करता येत नाही. ट्रान्सफर डेबिट ({status.TransferTally.Debit}) आणि क्रेडिट ({status.TransferTally.Credit}) जुळत नाही.");
            }

            if (!status.CashTally.IsPositive)
            {
                await AddLogAsync(branchId, businessDate, 1, "अमंजूर वॉउचर्स व आर्थिक ताळमेळ पडताळणी", "FAILED", 0, $"अखेरची रोख शिल्लक वजा (Negative) आहे: ₹ {status.CashTally.Closing}");
                return (false, $"EOD करता येत नाही. अखेरची रोख शिल्लक वजा ({status.CashTally.Closing}) आहे.");
            }
            await AddLogAsync(branchId, businessDate, 1, "अमंजूर वॉउचर्स व आर्थिक ताळमेळ पडताळणी", "SUCCESS", 1, "सर्व व्हाउचर्स मंजूर व रोजकीर्द संतुलित.");

            // टप्पा २: दिवसअखेर रोख शिल्लक व रोजकीर्द गोठवणे (Step 2: Closing Cash & Freeze Daybook)
            string ledgerInfo = status.CashTally.PrimaryCashLedger != null 
                ? $"{status.CashTally.PrimaryCashLedger.LedgerName} (GL: {status.CashTally.PrimaryCashLedger.LedgerID})" 
                : "सर्व रोख खाती";
            
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
            await AddLogAsync(branchId, businessDate, 2, "दिवसअखेर रोख शिल्लक व रोजकीर्द गोठवणे", "SUCCESS", 1, 
                $"अखेर रोख: ₹ {status.CashTally.Closing} | तारीख {businessDate:dd/MM/yyyy} बंद केली.");

            // टप्पा ३: पुढील बिझनेस डेट उघडणे व NPA बॅच (Step 3: Advance to Next Business Date & BOD)
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
                Details = $"EOD complete. Business Date advanced from {businessDate:dd/MM/yyyy} to {nextBusinessDate:dd/MM/yyyy}. Closing Cash: ₹{status.CashTally.Closing} ({ledgerInfo})"
            });

            await AddLogAsync(branchId, businessDate, 3, "पुढील बिझनेस डेट उघडणे व NPA बॅच", "SUCCESS", 1, $"नवीन बिझनेस डेट उघडली: {nextBusinessDate:dd/MM/yyyy}");

            await _context.SaveChangesAsync();

            return (true, $"दिवस अखेर (EOD) प्रक्रिया यशस्वीरित्या पूर्ण झाली! नवीन बिझनेस डेट: {nextBusinessDate:dd/MM/yyyy}.");
        }

        public async Task<(bool IsSuccess, string Message)> InitializeGoLiveDateAsync(int branchId, DateTime goLiveDate, int adminUserId, string reason)
        {
            if (goLiveDate == default)
            {
                return (false, "अवैध गो-लाईव्ह तारीख. (Invalid Go-Live Date.)");
            }

            var activeDateRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            DateTime oldDate = activeDateRecord?.BusinessDate ?? DateTime.Today;

            // Remove any unclosed records to prevent competing dates
            var unclosedRecords = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && !b.IsDayClosed)
                .ToListAsync();

            if (unclosedRecords.Any())
            {
                _context.BranchDayEndStatuses.RemoveRange(unclosedRecords);
            }

            var newRecord = new BranchDayEndStatus
            {
                BranchID = branchId,
                BusinessDate = goLiveDate.Date,
                IsDayClosed = false
            };
            _context.BranchDayEndStatuses.Add(newRecord);

            // Write Audit Log for Go-Live Date Initialization
            var userObj = await _context.Users.FindAsync(adminUserId);
            _context.AuditLogs.Add(new AuditLog
            {
                UserID = adminUserId,
                Username = userObj?.Username ?? $"Admin_{adminUserId}",
                Action = "GOLIVE_BUSINESS_DATE_INITIALIZED",
                EntityName = "BranchBusinessDate",
                EntityID = branchId.ToString(),
                Timestamp = DateTime.Now,
                Details = $"Go-Live Date Initialized for Branch {branchId} from {oldDate:dd/MM/yyyy} to {goLiveDate:dd/MM/yyyy}. Reason: {reason}"
            });

            await _context.SaveChangesAsync();
            return (true, $"संस्थेची गो-लाईव्ह बिझनेस डेट यशस्वीरीत्या {goLiveDate:dd/MM/yyyy} निश्चित करण्यात आली आहे!");
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

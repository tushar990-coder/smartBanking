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

        private async Task<(DateTime BusinessDate, DateTime? LastClosedDate, bool IsDayClosed, BranchDayEndStatus? ActiveRecord)> ResolveSequentialBusinessDateAsync(int branchId)
        {
            var activeFy = await _context.FinancialYears.AsNoTracking().FirstOrDefaultAsync(f => f.IsActive);
            DateTime defaultStart = activeFy?.StartDate.Date ?? new DateTime(2026, 4, 1);

            // 1. Latest closed date for this branch
            var lastClosedRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            DateTime? lastClosedDate = lastClosedRecord?.BusinessDate.Date;

            // 2. Oldest unclosed record after lastClosedDate (e.g., 01/06/2026)
            var oldestUnclosedRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && !b.IsDayClosed && b.BusinessDate.Year >= 2000
                         && (lastClosedDate == null || b.BusinessDate > lastClosedDate.Value))
                .OrderBy(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            // 3. Also check if there is an earlier operational voucher after lastClosedDate (in case a past login overwrote BranchDayEndStatuses)
            var earliestUnclosedVoucherDate = await _context.Vouchers
                .AsNoTracking()
                .Where(v => v.BranchID == branchId &&
                            v.VoucherDate >= defaultStart &&
                            (lastClosedDate == null || v.VoucherDate > lastClosedDate.Value) &&
                            v.VoucherType != "Opening" &&
                            !v.VoucherNo.Contains("-OP-") &&
                            !v.VoucherNo.Contains("-IMP-") &&
                            !v.VoucherNo.StartsWith("JV-FD-OP-") &&
                            !v.VoucherNo.StartsWith("REC-FD-OP-") &&
                            !v.VoucherNo.StartsWith("JV-RD-OP-") &&
                            !v.VoucherNo.StartsWith("REC-RD-OP-") &&
                            !v.VoucherNo.StartsWith("JV-SH-OP-") &&
                            !v.VoucherNo.StartsWith("JV-INV-OP-") &&
                            !(v.Narration != null && (
                                v.Narration.Contains("आरंभिक शिल्लक") ||
                                v.Narration.Contains("Opening Balance Migration") ||
                                v.Narration.Contains("Pigmy Chart Import") ||
                                v.Narration.Contains("Import"))))
                .OrderBy(v => v.VoucherDate)
                .Select(v => (DateTime?)v.VoucherDate.Date)
                .FirstOrDefaultAsync();

            DateTime businessDate;
            if (lastClosedDate.HasValue)
            {
                // Strict sequential enforcement: after lastClosedDate (e.g. 31/05/2026), the next day to close is ALWAYS 01/06/2026
                businessDate = lastClosedDate.Value.AddDays(1);
            }
            else
            {
                if (oldestUnclosedRecord != null)
                {
                    businessDate = oldestUnclosedRecord.BusinessDate.Date;
                    if (earliestUnclosedVoucherDate.HasValue && earliestUnclosedVoucherDate.Value < businessDate)
                    {
                        businessDate = earliestUnclosedVoucherDate.Value;
                    }
                }
                else if (earliestUnclosedVoucherDate.HasValue)
                {
                    businessDate = earliestUnclosedVoucherDate.Value;
                }
                else
                {
                    businessDate = defaultStart;
                }
            }

            // Ensure oldestUnclosedRecord reflects the resolved sequential businessDate
            if (oldestUnclosedRecord == null)
            {
                oldestUnclosedRecord = new BranchDayEndStatus
                {
                    BranchID = branchId,
                    BusinessDate = businessDate,
                    IsDayClosed = false
                };
                _context.BranchDayEndStatuses.Add(oldestUnclosedRecord);
                await _context.SaveChangesAsync();
            }
            else if (oldestUnclosedRecord.BusinessDate.Date != businessDate.Date)
            {
                oldestUnclosedRecord.BusinessDate = businessDate.Date;
                await _context.SaveChangesAsync();
            }

            return (businessDate.Date, lastClosedDate, oldestUnclosedRecord.IsDayClosed, oldestUnclosedRecord);
        }

        public async Task<object> GetEodStatusAsync(int branchId)
        {
            var branch = await _context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == branchId);
            string branchName = branch?.BranchName ?? $"Branch {branchId}";

            var resolved = await ResolveSequentialBusinessDateAsync(branchId);
            DateTime businessDate = resolved.BusinessDate;
            DateTime? lastClosedDate = resolved.LastClosedDate;
            bool isFirstTimeEod = lastClosedDate == null;

            DateTime dayStart = businessDate.Date;
            DateTime dayEnd = dayStart.AddDays(1);

            // 1. Check Unposted Vouchers strictly for the active businessDate [dayStart, dayEnd) (1:1 sync with VoucherPostingController)
            var unpostedCount = await _context.Vouchers
                .AsNoTracking()
                .CountAsync(v => (v.BranchID == branchId || v.BranchID == 0) &&
                                 v.Status == "Pending" &&
                                 v.VoucherDate >= dayStart &&
                                 v.VoucherDate < dayEnd &&
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

            // 3. Check Transfer Batch Tally (All non-cash lines in today's approved vouchers [dayStart, dayEnd))
            var todayVoucherLines = await _context.VoucherDetails
                .AsNoTracking()
                .Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId && vd.Voucher.Status == "Approved" && vd.Voucher.VoucherDate >= dayStart && vd.Voucher.VoucherDate < dayEnd)
                .Select(vd => new { vd.VoucherID, vd.LedgerID, vd.DrCr, vd.Amount })
                .ToListAsync();

            var cashVoucherIds = todayVoucherLines
                .Where(vd => cashLedgerIds.Contains(vd.LedgerID))
                .Select(vd => vd.VoucherID)
                .ToHashSet();

            decimal transferDr = todayVoucherLines
                .Where(vd => !cashVoucherIds.Contains(vd.VoucherID) && vd.DrCr == "Dr")
                .Sum(vd => vd.Amount);

            decimal transferCr = todayVoucherLines
                .Where(vd => !cashVoucherIds.Contains(vd.VoucherID) && vd.DrCr == "Cr")
                .Sum(vd => vd.Amount);

            decimal allTodayDr = todayVoucherLines.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
            decimal allTodayCr = todayVoucherLines.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

            bool transferTallyOk = Math.Abs(transferDr - transferCr) < 0.01m && Math.Abs(allTodayDr - allTodayCr) < 0.01m;

            // 4. Branch-Specific Cash Tally (Fast Aggregated Query scoped to the active date's Financial Year Baseline)
            var fyBaseline = await Helpers.FinancialYearBaselineHelper.ResolveBaselineAsync(_context, dayStart);
            int baselineFyId = fyBaseline.BaselineFinancialYearId;

            var branchObs = await _context.BranchLedgerOpeningBalances
                .AsNoTracking()
                .Where(b => b.BranchID == branchId &&
                            cashLedgerIds.Contains(b.LedgerID) &&
                            (baselineFyId == 0 || b.FinancialYearID == baselineFyId))
                .ToListAsync();

            decimal baseLedgerOb = 0m;
            foreach (var cl in cashLedgers)
            {
                var obRecord = branchObs.FirstOrDefault(b => b.LedgerID == cl.LedgerID);
                if (obRecord != null)
                {
                    baseLedgerOb += obRecord.OpeningBalanceType == "Dr" ? obRecord.OpeningBalance : -obRecord.OpeningBalance;
                }
                else if (!fyBaseline.IsCarriedForwardYear && (branchId == 1 || (branch != null && string.Equals(branch.BranchType, "HeadOffice", StringComparison.OrdinalIgnoreCase))))
                {
                    baseLedgerOb += cl.OpeningBalanceType == "Dr" ? cl.OpeningBalance : -cl.OpeningBalance;
                }
            }

            var priorCashQuery = _context.VoucherDetails
                .AsNoTracking()
                .Where(vd => cashLedgerIds.Contains(vd.LedgerID) &&
                             vd.Voucher != null &&
                             vd.Voucher.Status == "Approved" &&
                             vd.Voucher.BranchID == branchId &&
                             vd.Voucher.VoucherDate < dayStart);

            if (fyBaseline.BaselineStartDate.HasValue)
            {
                priorCashQuery = priorCashQuery.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate >= fyBaseline.BaselineStartDate.Value);
            }

            decimal priorDr = await priorCashQuery
                .Where(vd => vd.DrCr == "Dr")
                .SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

            decimal priorCr = await priorCashQuery
                .Where(vd => vd.DrCr == "Cr")
                .SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

            decimal openingCash = baseLedgerOb + priorDr - priorCr;

            decimal totalTodayReceipts = todayVoucherLines
                .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Dr")
                .Sum(vd => vd.Amount);

            decimal totalTodayPayments = todayVoucherLines
                .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Cr")
                .Sum(vd => vd.Amount);

            decimal closingCash = openingCash + totalTodayReceipts - totalTodayPayments;
            bool isCashPositiveAndTallied = closingCash >= 0m && Math.Abs((openingCash + totalTodayReceipts - totalTodayPayments) - closingCash) < 0.01m;

            bool isLastClosedDateInClosedFy = false;
            string? lastClosedDateFyCode = null;
            if (lastClosedDate.HasValue)
            {
                DateTime targetClosedDate = lastClosedDate.Value.Date;
                var closedFyForLastDate = await _context.FinancialYears
                    .AsNoTracking()
                    .FirstOrDefaultAsync(fy => fy.IsClosed &&
                                               targetClosedDate >= fy.StartDate.Date &&
                                               targetClosedDate <= fy.EndDate.Date);
                if (closedFyForLastDate != null)
                {
                    isLastClosedDateInClosedFy = true;
                    lastClosedDateFyCode = closedFyForLastDate.YearCode;
                }
            }

            return new
            {
                BusinessDate = businessDate,
                NextSequentialDate = businessDate.AddDays(1),
                IsDayClosed = resolved.IsDayClosed,
                LastClosedDate = lastClosedDate,
                IsLastClosedDateInClosedFy = isLastClosedDateInClosedFy,
                LastClosedDateFyCode = lastClosedDateFyCode,
                IsFirstTimeEod = isFirstTimeEod,
                UnpostedVouchers = unpostedCount,
                TransferTally = new
                {
                    Debit = transferDr,
                    Credit = transferCr,
                    Difference = Math.Abs(transferDr - transferCr),
                    IsMatched = transferTallyOk
                },
                CashTally = new
                {
                    BranchID = branchId,
                    BranchName = branchName,
                    PrimaryCashLedger = primaryCashLedger != null ? new { primaryCashLedger.LedgerID, primaryCashLedger.LedgerName, primaryCashLedger.LedgerCode } : null,
                    Opening = openingCash,
                    TodayReceipts = totalTodayReceipts,
                    TodayPayments = totalTodayPayments,
                    Closing = closingCash,
                    IsPositive = isCashPositiveAndTallied,
                    IsTallied = isCashPositiveAndTallied
                }
            };
        }

        public async Task<IEnumerable<EodBatchProcessLog>> GetEodLogsAsync(int branchId, DateTime? businessDate = null)
        {
            var query = _context.EodBatchProcessLogs.AsNoTracking().Where(l => l.BranchID == branchId);
            if (businessDate.HasValue)
            {
                query = query.Where(l => l.BusinessDate.Date == businessDate.Value.Date);
            }
            return await query.OrderByDescending(l => l.StartTime).Take(50).ToListAsync();
        }

        public async Task<(bool IsSuccess, string Message)> RunEndOfDayAsync(int branchId, int userId, DateTime? requestedNextDate = null)
        {
            // 1. Always resolve the earliest unclosed date (e.g. 01/06/2026 must be closed before moving to next date)
            var resolved = await ResolveSequentialBusinessDateAsync(branchId);
            DateTime businessDate = resolved.BusinessDate;
            var activeDateRecord = resolved.ActiveRecord;

            if (activeDateRecord != null && activeDateRecord.IsDayClosed)
            {
                return (false, $"दिनांक {businessDate:dd/MM/yyyy} चा दिवस आधीच बंद केलेला आहे.");
            }

            // Next sequential date (defaults strictly to next calendar day businessDate + 1 day)
            DateTime nextBusinessDate = businessDate.AddDays(1);
            if (requestedNextDate.HasValue && requestedNextDate.Value.Date > businessDate.Date)
            {
                nextBusinessDate = requestedNextDate.Value.Date;
            }

            // 2. Strict Validation: Pending Vouchers, Cash Balance Tally, Transfer Balance Tally
            var statusObj = await GetEodStatusAsync(branchId);
            dynamic status = statusObj;

            if (status.UnpostedVouchers > 0)
            {
                return (false, $"दिवस अखेर करता येत नाही! दिनांक {businessDate:dd/MM/yyyy} चे {status.UnpostedVouchers} व्हाउचर्स प्रलंबित (Pending) आहेत. कृपया आधी व्हाउचर्स पास करा.");
            }

            if (!status.TransferTally.IsMatched)
            {
                return (false, $"दिवस अखेर करता येत नाही! ट्रान्सफर बॅलन्स टॅली नाही (नावे: ₹{status.TransferTally.Debit:N2} व जमा: ₹{status.TransferTally.Credit:N2}).");
            }

            if (!status.CashTally.IsPositive)
            {
                return (false, $"दिवस अखेर करता येत नाही! अखेरची रोख शिल्लक टॅली नाही किंवा वजा (₹{status.CashTally.Closing:N2}) आहे.");
            }

            // 3. Close the current day (e.g. 01/06/2026)
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
                activeDateRecord.BusinessDate = businessDate;
                activeDateRecord.IsDayClosed = true;
            }

            // Remove any other stray unclosed records for this branch so that nextBusinessDate is strictly the active open date
            var otherUnclosed = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && !b.IsDayClosed && b.BusinessDate.Date != businessDate.Date)
                .ToListAsync();
            if (otherUnclosed.Any())
            {
                _context.BranchDayEndStatuses.RemoveRange(otherUnclosed);
            }

            // 4. Open the next sequential business date (e.g. 02/06/2026)
            var existingNext = await _context.BranchDayEndStatuses
                .FirstOrDefaultAsync(b => b.BranchID == branchId && b.BusinessDate.Date == nextBusinessDate.Date);

            if (existingNext != null)
            {
                existingNext.IsDayClosed = false;
            }
            else
            {
                _context.BranchDayEndStatuses.Add(new BranchDayEndStatus
                {
                    BranchID = branchId,
                    BusinessDate = nextBusinessDate,
                    IsDayClosed = false
                });
            }

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

            await _context.SaveChangesAsync();

            return (true, $"दिनांक {businessDate:dd/MM/yyyy} चा दिवस अखेर (Day End) पूर्ण झाला! पुढील कामकाजाची तारीख: {nextBusinessDate:dd/MM/yyyy}");
        }

        public async Task<(bool IsSuccess, string Message)> InitializeGoLiveDateAsync(int branchId, DateTime goLiveDate, int adminUserId, string reason)
        {
            if (goLiveDate == default)
            {
                return (false, "अवैध गो-लाईव्ह तारीख.");
            }

            var closedFyForGoLive = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed &&
                                           goLiveDate.Date >= fy.StartDate.Date &&
                                           goLiveDate.Date <= fy.EndDate.Date);

            if (closedFyForGoLive != null)
            {
                return (false, $"दिनांक {goLiveDate:dd/MM/yyyy} ही तारीख बंद झालेल्या आर्थिक वर्षात ({closedFyForGoLive.YearCode}) येते. बंद आर्थिक वर्षातील तारीख सेट करता येणार नाही.");
            }

            var lastClosedRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            if (lastClosedRecord != null && goLiveDate.Date <= lastClosedRecord.BusinessDate.Date)
            {
                return (false, $"दिनांक {lastClosedRecord.BusinessDate:dd/MM/yyyy} पर्यंत दिवस अखेर पूर्ण झालेला आहे. मागील तारीख उघडण्यासाठी 'दिवस अखेर रद्द करा (Revoke Day End)' वापरा.");
            }

            var unclosedRecords = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && !b.IsDayClosed)
                .ToListAsync();

            if (unclosedRecords.Any())
            {
                _context.BranchDayEndStatuses.RemoveRange(unclosedRecords);
            }

            _context.BranchDayEndStatuses.Add(new BranchDayEndStatus
            {
                BranchID = branchId,
                BusinessDate = goLiveDate.Date,
                IsDayClosed = false
            });

            var userObj = await _context.Users.FindAsync(adminUserId);
            _context.AuditLogs.Add(new AuditLog
            {
                UserID = adminUserId,
                Username = userObj?.Username ?? $"Admin_{adminUserId}",
                Action = "GOLIVE_BUSINESS_DATE_INITIALIZED",
                EntityName = "BranchBusinessDate",
                EntityID = branchId.ToString(),
                Timestamp = DateTime.Now,
                Details = $"Business Date set for Branch {branchId} to {goLiveDate:dd/MM/yyyy}. Reason: {reason}"
            });

            await _context.SaveChangesAsync();
            return (true, $"कामाची तारीख यशस्वीरीत्या {goLiveDate:dd/MM/yyyy} निश्चित करण्यात आली आहे!");
        }

        public async Task<(bool IsSuccess, string Message)> UnlockDayAsync(int branchId, int adminUserId, string reason)
        {
            if (string.IsNullOrWhiteSpace(reason))
            {
                reason = "Day End Revoked by User";
            }

            // Find the latest closed day record to revoke
            var lastClosedRecord = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && b.IsDayClosed && b.BusinessDate.Year >= 2000)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            if (lastClosedRecord == null)
            {
                return (false, "रद्द (Revoke) करण्यासाठी कोणताही बंद केलेला दिवस (Closed Day) आढळला नाही.");
            }

            DateTime unlockedDate = lastClosedRecord.BusinessDate.Date;

            // Closed Financial Year Lock Guard (FY Lock Check)
            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed &&
                                           unlockedDate >= fy.StartDate.Date &&
                                           unlockedDate <= fy.EndDate.Date);

            if (closedFy != null)
            {
                return (false, $"दिनांक {unlockedDate:dd/MM/yyyy} ही तारीख बंद झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) येते. आर्थिक वर्ष बंद (Closed) असल्यामुळे या दिवसाचा Day End रद्द (Revoke) करता येणार नाही.");
            }

            // Remove any unclosed records after lastClosedRecord (e.g. 02/06/2026)
            var subsequentUnclosed = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == branchId && !b.IsDayClosed && b.BusinessDate > lastClosedRecord.BusinessDate)
                .ToListAsync();

            if (subsequentUnclosed.Any())
            {
                _context.BranchDayEndStatuses.RemoveRange(subsequentUnclosed);
            }

            // Reopen the closed day (e.g. 01/06/2026 -> IsDayClosed = false)
            lastClosedRecord.IsDayClosed = false;

            var userObj = await _context.Users.FindAsync(adminUserId);
            _context.AuditLogs.Add(new AuditLog
            {
                UserID = adminUserId,
                Username = userObj?.Username ?? $"Admin_{adminUserId}",
                Action = "DAY_END_REVOKE",
                EntityName = "BranchBusinessDate",
                EntityID = branchId.ToString(),
                Timestamp = DateTime.Now,
                Details = $"DAY END REVOKED: Branch {branchId} reopened for date {unlockedDate:dd/MM/yyyy}. Reason: {reason}"
            });

            await _context.SaveChangesAsync();
            return (true, $"दिनांक {unlockedDate:dd/MM/yyyy} चा दिवस अखेर रद्द (Revoke) करून तो दिवस पुन्हा उघडण्यात आला आहे!");
        }
    }
}

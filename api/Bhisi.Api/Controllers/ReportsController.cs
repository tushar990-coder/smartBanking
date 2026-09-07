using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class ReportsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReportsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Reports/system-health
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        [HttpGet("system-health")]
        public async Task<IActionResult> GetSystemHealth([FromQuery] int branchId = 1)
        {
            try
            {
                // 1. Check DB Connectivity
                bool canConnect = await _context.Database.CanConnectAsync();

                // 2. Active Financial Year
                var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);

                // 3. Pending / Unposted Vouchers
                var pendingVouchersCount = await _context.Vouchers.CountAsync(v => v.Status == "Pending");

                // 4. Check Unbalanced Vouchers (Debit != Credit)
                var unbalancedVouchersCount = await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => v.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount) != v.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount))
                    .CountAsync();

                // 5. Day End Status for today
                var today = DateTime.Today;
                var eodStatus = await _context.BranchDayEndStatuses
                    .FirstOrDefaultAsync(b => b.BranchID == branchId && b.BusinessDate == today);

                var isEodClosed = eodStatus?.IsDayClosed ?? false;

                // 6. Basic Totals
                var totalMembers = await _context.Members.CountAsync();
                var activeLoans = await _context.LoanAccounts.CountAsync(l => l.Status == "Active");

                return Ok(new
                {
                    status = canConnect && unbalancedVouchersCount == 0 ? "Healthy" : "Warning",
                    databaseConnected = canConnect,
                    activeFinancialYear = activeFy?.YearCode ?? "Not Configured",
                    pendingVouchers = pendingVouchersCount,
                    unbalancedVouchers = unbalancedVouchersCount,
                    isEodClosed = isEodClosed,
                    totalMembers = totalMembers,
                    activeLoans = activeLoans,
                    checkedAt = DateTime.Now
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { status = "Critical", error = ex.Message });
            }
        }

        private decimal CalculateOutstandingInterest(LoanAccount la, DateTime targetDate, List<LoanInstallmentSchedule> schedules, List<LoanCollection>? collections = null)
        {
            var loanRate = la.LoanRate;
            bool isDailyReducing = loanRate != null && 
                (loanRate.InterestCalculationMethod?.Contains("Daily Reducing") == true || loanRate.InterestCalculationMethod?.Contains("Reducing") == true);

            if (isDailyReducing)
            {
                var fromDate = la.LastInstallmentPaidDate ?? la.LoanDisbursementDate ?? la.OpeningDate;
                var rate = la.InterestRate;
                var diffTime = targetDate.Date - fromDate.Date;
                var diffDays = Math.Max(0, diffTime.Days);
                decimal newInterest = diffDays > 0 ? Math.Round((la.PrincipalBalance * rate * diffDays) / 36500m) : 0;
                return la.InterestBalance + newInterest;
            }
            else
            {
                var accountCollections = collections != null 
                    ? collections.Where(c => c.LoanAccountID == la.LoanAccountID).ToList()
                    : new List<LoanCollection>();
                return Services.LoanScheduleGenerator.GetUnpaidScheduledInterest(la, schedules, accountCollections, targetDate);
            }
        }

        private ReportNodeDto BuildGroupTree(AccountGroup group, List<AccountGroup> allGroups, Dictionary<int, List<ReportNodeDto>> ledgersByGroupId)
        {
            var node = new ReportNodeDto
            {
                Id = group.GroupID,
                Name = group.GroupName,
                Code = group.GroupCode,
                DisplayOrder = group.DisplayOrder,
                IsGroup = true
            };

            if (ledgersByGroupId.ContainsKey(group.GroupID))
            {
                var sortedLedgers = ledgersByGroupId[group.GroupID]
                    .OrderBy(l => l.Code, new AlphanumericComparer())
                    .ThenBy(l => l.Name)
                    .ToList();
                node.Children.AddRange(sortedLedgers);
            }

            var subGroups = allGroups.Where(g => g.ParentGroupID == group.GroupID)
                .OrderBy(g => g.DisplayOrder)
                .ThenBy(g => g.GroupCode, new AlphanumericComparer())
                .ThenBy(g => g.GroupID)
                .ToList();

            foreach (var subGroup in subGroups)
            {
                var subNode = BuildGroupTree(subGroup, allGroups, ledgersByGroupId);
                if (subNode.Children.Count > 0 || subNode.Amount != 0 || subNode.PreviousYearAmount != 0 || subNode.ClosingBalance != 0 || subNode.OpeningBalance != 0 || subNode.TotalDebit != 0 || subNode.TotalCredit != 0)
                {
                    node.Children.Add(subNode);
                }
            }

            decimal totalOpeningDr = node.Children.Where(c => c.OpeningType == "Dr").Sum(c => c.OpeningBalance);
            decimal totalOpeningCr = node.Children.Where(c => c.OpeningType == "Cr").Sum(c => c.OpeningBalance);
            if (totalOpeningDr > totalOpeningCr)
            {
                node.OpeningBalance = totalOpeningDr - totalOpeningCr;
                node.OpeningType = "Dr";
            }
            else if (totalOpeningCr > totalOpeningDr)
            {
                node.OpeningBalance = totalOpeningCr - totalOpeningDr;
                node.OpeningType = "Cr";
            }

            node.TotalDebit = node.Children.Sum(c => c.TotalDebit);
            node.TotalCredit = node.Children.Sum(c => c.TotalCredit);

            decimal totalClosingDr = node.Children.Where(c => c.ClosingType == "Dr").Sum(c => c.ClosingBalance);
            decimal totalClosingCr = node.Children.Where(c => c.ClosingType == "Cr").Sum(c => c.ClosingBalance);
            if (totalClosingDr > totalClosingCr)
            {
                node.ClosingBalance = totalClosingDr - totalClosingCr;
                node.ClosingType = "Dr";
            }
            else if (totalClosingCr > totalClosingDr)
            {
                node.ClosingBalance = totalClosingCr - totalClosingDr;
                node.ClosingType = "Cr";
            }

            node.Amount = node.Children.Sum(c => c.Amount);
            node.PreviousYearAmount = node.Children.Sum(c => c.PreviousYearAmount);

            return node;
        }

        // GET: api/Reports/TrialBalance
        [HttpGet("TrialBalance")]
        public async Task<ActionResult<IEnumerable<ReportNodeDto>>> GetTrialBalance([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            var groups = await _context.AccountGroups.ToListAsync();
            var ledgers = await _context.Ledgers.ToListAsync();
            
            var query = _context.VoucherDetails.Include(vd => vd.Voucher)
                .Where(vd => vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled")
                .AsQueryable();
            if (fromDate.HasValue)
                query = query.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate >= fromDate.Value);
            if (toDate.HasValue)
            {
                var toDateEnd = toDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate <= toDateEnd);
            }
            if (branchId.HasValue)
            {
                query = query.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
            }

            var voucherDetails = await query.ToListAsync();

            var ledgersByGroupId = new Dictionary<int, List<ReportNodeDto>>();

            foreach (var ledger in ledgers)
            {
                var ledgerVds = voucherDetails.Where(vd => vd.LedgerID == ledger.LedgerID).ToList();
                decimal totalDr = ledgerVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                decimal totalCr = ledgerVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

                decimal openingBal = ledger.OpeningBalance;
                decimal drBal = ledger.OpeningBalanceType == "Dr" ? openingBal : 0;
                decimal crBal = ledger.OpeningBalanceType == "Cr" ? openingBal : 0;

                drBal += totalDr;
                crBal += totalCr;

                decimal closingBal = 0;
                string closingType = "";

                if (drBal > crBal)
                {
                    closingBal = drBal - crBal;
                    closingType = "Dr";
                }
                else if (crBal > drBal)
                {
                    closingBal = crBal - drBal;
                    closingType = "Cr";
                }

                var node = new ReportNodeDto
                {
                    Id = ledger.LedgerID,
                    Name = ledger.LedgerName,
                    Code = !string.IsNullOrWhiteSpace(ledger.LedgerCode) ? ledger.LedgerCode.Trim() : ledger.LedgerID.ToString(),
                    IsGroup = false,
                    OpeningBalance = openingBal,
                    OpeningType = ledger.OpeningBalanceType ?? "",
                    TotalDebit = totalDr,
                    TotalCredit = totalCr,
                    ClosingBalance = closingBal,
                    ClosingType = closingType
                };

                bool hasActivity = Math.Abs(openingBal) >= 0.01m || Math.Abs(totalDr) >= 0.01m || Math.Abs(totalCr) >= 0.01m || Math.Abs(closingBal) >= 0.01m;
                if (hasActivity)
                {
                    if (!ledgersByGroupId.ContainsKey(ledger.GroupID))
                        ledgersByGroupId[ledger.GroupID] = new List<ReportNodeDto>();
                    ledgersByGroupId[ledger.GroupID].Add(node);
                }
            }

            var result = new List<ReportNodeDto>();
            var rootGroups = groups.Where(g => g.ParentGroupID == null || !groups.Any(p => p.GroupID == g.ParentGroupID))
                .OrderBy(g => g.DisplayOrder)
                .ThenBy(g => g.GroupCode, new AlphanumericComparer())
                .ThenBy(g => g.GroupID)
                .ToList();
            foreach (var group in rootGroups)
            {
                var tree = BuildGroupTree(group, groups, ledgersByGroupId);
                if (tree.Children.Count > 0 || Math.Abs(tree.OpeningBalance) >= 0.01m || Math.Abs(tree.TotalDebit) >= 0.01m || Math.Abs(tree.TotalCredit) >= 0.01m || Math.Abs(tree.ClosingBalance) >= 0.01m)
                {
                    result.Add(tree);
                }
            }

            return result;
        }

        [HttpGet("Daybook")]
        public async Task<ActionResult<DaybookResponseDto>> GetDaybook([FromQuery] DateTime date, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            DateTime startDate = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
            DateTime endDate = DateTime.SpecifyKind(toDate.HasValue ? toDate.Value.Date.AddDays(1).AddTicks(-1) : date.Date.AddDays(1).AddTicks(-1), DateTimeKind.Unspecified);

            var ledgers = await _context.Ledgers.AsNoTracking().Include(l => l.AccountGroup).ToListAsync();

            // Match all cash ledgers dynamically (e.g. "हातातील रोख शिल्लक", "हातावरील रोख शिल्लक", "रोख शिल्लक", "Cash", etc.)
            var cashLedgerIds = ledgers
                .Where(l => 
                    l.LedgerName.Contains("हातातील रोख शिल्लक") || 
                    l.LedgerName.Contains("हातावरील रोख शिल्लक") || 
                    l.LedgerName.Contains("रोख शिल्लक") || 
                    l.LedgerName.Contains("हातातील") || 
                    l.LedgerName.Contains("हातावरील") || 
                    l.LedgerName.Contains("रोख") || 
                    l.LedgerName.ToLower().Contains("cash") ||
                    (l.AccountGroup != null && (
                        l.AccountGroup.GroupName.Contains("Cash") || 
                        l.AccountGroup.GroupName.Contains("रोख") ||
                        l.AccountGroup.GroupName.Contains("हातातील") ||
                        l.AccountGroup.GroupName.Contains("हातावरील")
                    ))
                )
                .Select(l => l.LedgerID)
                .ToHashSet();

            // Calculate Opening Balance for Cash across matched cash ledgers
            decimal openingBalance = 0;
            var cashLedgersList = ledgers.Where(l => cashLedgerIds.Contains(l.LedgerID)).ToList();
            foreach (var cl in cashLedgersList)
            {
                openingBalance += cl.OpeningBalanceType == "Dr" ? cl.OpeningBalance : -cl.OpeningBalance;
            }

            if (cashLedgerIds.Count > 0)
            {
                var priorDrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Dr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < startDate);
                var priorCrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Cr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < startDate);

                if (branchId.HasValue)
                {
                    priorDrQuery = priorDrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                    priorCrQuery = priorCrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                }

                decimal priorDr = await priorDrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
                decimal priorCr = await priorCrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

                openingBalance += (priorDr - priorCr);
            }

            var vouchersQuery = _context.Vouchers.AsNoTracking()
                .Include(v => v.VoucherDetails)
                .ThenInclude(vd => vd.Ledger)
                .Include(v => v.VoucherDetails)
                .ThenInclude(vd => vd.Member)
                .Where(v => (v.Status == "Approved" || string.IsNullOrEmpty(v.Status) || v.Status == "Posted") 
                         && v.Status != "Rejected" 
                         && v.Status != "Cancelled" 
                         && v.VoucherDate >= startDate 
                         && v.VoucherDate <= endDate
                         && v.VoucherType != "Opening Balance"
                         && (v.Narration == null || (!v.Narration.Contains("Opening Balance") && !v.Narration.Contains("आरंभीची शिल्लक") && !v.Narration.Contains("स्थलांतर"))));
            if (branchId.HasValue)
            {
                vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
            }
            var vouchers = await vouchersQuery.ToListAsync();

            var jamaGroups = new Dictionary<int, DaybookGroupDto>();
            var naveGroups = new Dictionary<int, DaybookGroupDto>();

            foreach (var v in vouchers)
            {
                var cashDetail = v.VoucherDetails.FirstOrDefault(vd => cashLedgerIds.Contains(vd.LedgerID));
                decimal cashAmountInVoucher = cashDetail?.Amount ?? 0m;
                string cashDrCr = cashDetail?.DrCr ?? "";

                var nonCashDetails = v.VoucherDetails.Where(vd => !cashLedgerIds.Contains(vd.LedgerID)).ToList();
                decimal totalNonCashDr = nonCashDetails.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                decimal totalNonCashCr = nonCashDetails.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

                foreach (var vd in nonCashDetails)
                {
                    var targetDict = vd.DrCr == "Cr" ? jamaGroups : naveGroups;

                    if (!targetDict.ContainsKey(vd.LedgerID))
                    {
                        targetDict[vd.LedgerID] = new DaybookGroupDto
                        {
                            LedgerId = vd.LedgerID,
                            LedgerName = vd.Ledger?.LedgerName ?? "Unknown",
                            Entries = new List<DaybookEntryDto>()
                        };
                    }

                    var group = targetDict[vd.LedgerID];

                    string narration = string.IsNullOrWhiteSpace(v.Narration) ? (v.VoucherType ?? "") : v.Narration;
                    if (vd.Member != null)
                    {
                        narration = $"{vd.Member.MemberCode}-{vd.Member.FirstName} {vd.Member.LastName}";
                    }

                    decimal cashAmt = 0m;
                    decimal transferAmt = 0m;

                    if (cashDetail == null)
                    {
                        // Pure Transfer / Journal Voucher
                        transferAmt = vd.Amount;
                    }
                    else if (cashDrCr == "Cr")
                    {
                        // Payment Voucher: Cash is being paid out
                        if (vd.DrCr == "Dr")
                        {
                            if (totalNonCashDr > 0)
                            {
                                decimal proportion = vd.Amount / totalNonCashDr;
                                cashAmt = Math.Min(vd.Amount, cashAmountInVoucher * proportion);
                                transferAmt = vd.Amount - cashAmt;
                            }
                            else
                            {
                                cashAmt = Math.Min(vd.Amount, cashAmountInVoucher);
                                transferAmt = vd.Amount - cashAmt;
                            }
                        }
                        else
                        {
                            // Deduction inside Payment voucher
                            transferAmt = vd.Amount;
                        }
                    }
                    else // cashDrCr == "Dr"
                    {
                        // Receipt Voucher: Cash is being received
                        if (vd.DrCr == "Cr")
                        {
                            if (totalNonCashCr > 0)
                            {
                                decimal proportion = vd.Amount / totalNonCashCr;
                                cashAmt = Math.Min(vd.Amount, cashAmountInVoucher * proportion);
                                transferAmt = vd.Amount - cashAmt;
                            }
                            else
                            {
                                cashAmt = Math.Min(vd.Amount, cashAmountInVoucher);
                                transferAmt = vd.Amount - cashAmt;
                            }
                        }
                        else
                        {
                            // Debit side inside Receipt voucher
                            transferAmt = vd.Amount;
                        }
                    }

                    var entry = new DaybookEntryDto
                    {
                        Narration = narration,
                        VoucherNo = v.VoucherNo ?? "",
                        CashAmount = Math.Round(cashAmt, 2),
                        TransferAmount = Math.Round(transferAmt, 2)
                    };

                    group.TotalCash += entry.CashAmount;
                    group.TotalTransfer += entry.TransferAmount;
                    group.Entries.Add(entry);
                }
            }

            // Include unvouchered Loan Disbursements into Nave (Payments)
            var existingVoucherIds = vouchers.Select(v => v.VoucherID).ToHashSet();
            var unvoucheredDisbQuery = _context.LoanDisbursements
                .Where(ld => ld.LoanAccount != null 
                          && ld.DisbursementDate >= startDate 
                          && ld.DisbursementDate <= endDate
                          && !ld.VoucherID.HasValue
                          && ld.PaymentMode != "Opening Balance"
                          && (ld.Remarks == null || (!ld.Remarks.Contains("Opening Balance") && !ld.Remarks.Contains("मागील येणे"))));

            if (branchId.HasValue)
            {
                unvoucheredDisbQuery = unvoucheredDisbQuery.Where(ld => ld.LoanAccount!.BranchID == branchId.Value);
            }

            var unvoucheredDisb = await unvoucheredDisbQuery
                .Include(ld => ld.LoanAccount!).ThenInclude(la => la!.Member)
                .Include(ld => ld.LoanAccount!).ThenInclude(la => la!.LoanRate)
                .ToListAsync();


            var defaultLoanLedger = ledgers.FirstOrDefault(l => l.LedgerName.Contains("कर्ज") || l.LedgerName.Contains("Loan") || l.LedgerName.Contains("मुद्दल")) ?? ledgers.FirstOrDefault();

            foreach (var ld in unvoucheredDisb)
            {
                int lId = ld.LoanAccount?.LoanRate?.LoanLedgerID ?? defaultLoanLedger?.LedgerID ?? 0;
                if (lId == 0) continue;
                string lName = ledgers.FirstOrDefault(l => l.LedgerID == lId)?.LedgerName ?? "कर्ज खाते (Loan Account)";

                if (!naveGroups.ContainsKey(lId))
                {
                    naveGroups[lId] = new DaybookGroupDto
                    {
                        LedgerId = lId,
                        LedgerName = lName,
                        Entries = new List<DaybookEntryDto>()
                    };
                }

                var group = naveGroups[lId];
                var member = ld.LoanAccount?.Member;
                string narration = member != null 
                    ? $"{member.MemberCode}-{member.FirstName} {member.LastName}" 
                    : $"Loan Disbursed (A/C: {ld.LoanAccount?.LoanAccountNo})";

                bool isCash = ld.PaymentMode == "Cash";
                var entry = new DaybookEntryDto
                {
                    Narration = narration,
                    VoucherNo = "DISB-" + ld.LoanDisbursementID,
                    CashAmount = isCash ? ld.DisbursementAmount : 0,
                    TransferAmount = isCash ? 0 : ld.DisbursementAmount
                };
                group.TotalCash += entry.CashAmount;
                group.TotalTransfer += entry.TransferAmount;
                group.Entries.Add(entry);
            }

            // Include unvouchered Loan Collections into Jama (Receipts)
            var unvoucheredColQuery = _context.LoanCollections
                .Where(lc => lc.LoanAccount != null && lc.CollectionDate >= startDate && lc.CollectionDate <= endDate
                          && !lc.VoucherID.HasValue);

            if (branchId.HasValue)
            {
                unvoucheredColQuery = unvoucheredColQuery.Where(lc => lc.LoanAccount!.BranchID == branchId.Value);
            }

            var unvoucheredCols = await unvoucheredColQuery
                .Include(lc => lc.LoanAccount!).ThenInclude(la => la!.Member)
                .Include(lc => lc.LoanAccount!).ThenInclude(la => la!.LoanRate)
                .ToListAsync();


            var defaultInterestLedger = ledgers.FirstOrDefault(l => l.LedgerName.Contains("कर्ज व्याज") || l.LedgerName.Contains("व्याज जमा") || l.LedgerName.Contains("Interest")) ?? defaultLoanLedger;

            foreach (var lc in unvoucheredCols)
            {
                var member = lc.LoanAccount?.Member;
                string memberNarration = member != null 
                    ? $"{member.MemberCode}-{member.FirstName} {member.LastName}" 
                    : $"Loan Collection (Rect: {lc.ReceiptNo})";
                bool isCash = lc.PaymentMode == "Cash";

                // Principal Collected -> Loan Ledger
                if (lc.PrincipalCollected > 0)
                {
                    int lId = lc.LoanAccount?.LoanRate?.LoanLedgerID ?? defaultLoanLedger?.LedgerID ?? 0;
                    if (lId > 0)
                    {
                        string lName = ledgers.FirstOrDefault(l => l.LedgerID == lId)?.LedgerName ?? "कर्ज खाते (Loan Account)";
                        if (!jamaGroups.ContainsKey(lId))
                        {
                            jamaGroups[lId] = new DaybookGroupDto
                            {
                                LedgerId = lId,
                                LedgerName = lName,
                                Entries = new List<DaybookEntryDto>()
                            };
                        }
                        var group = jamaGroups[lId];
                        var entry = new DaybookEntryDto
                        {
                            Narration = memberNarration,
                            VoucherNo = lc.ReceiptNo ?? ("REC-" + lc.LoanCollectionID),
                            CashAmount = isCash ? lc.PrincipalCollected : 0,
                            TransferAmount = isCash ? 0 : lc.PrincipalCollected
                        };
                        group.TotalCash += entry.CashAmount;
                        group.TotalTransfer += entry.TransferAmount;
                        group.Entries.Add(entry);
                    }
                }

                // Interest Collected -> Interest Ledger
                if (lc.InterestCollected + lc.PenaltyInterestCollected > 0)
                {
                    int iId = lc.LoanAccount?.LoanRate?.InterestLedgerID ?? defaultInterestLedger?.LedgerID ?? 0;
                    if (iId > 0)
                    {
                        string iName = ledgers.FirstOrDefault(l => l.LedgerID == iId)?.LedgerName ?? "कर्ज व्याज जमा (Loan Interest)";
                        if (!jamaGroups.ContainsKey(iId))
                        {
                            jamaGroups[iId] = new DaybookGroupDto
                            {
                                LedgerId = iId,
                                LedgerName = iName,
                                Entries = new List<DaybookEntryDto>()
                            };
                        }
                        var group = jamaGroups[iId];
                        decimal intAmt = lc.InterestCollected + lc.PenaltyInterestCollected;
                        var entry = new DaybookEntryDto
                        {
                            Narration = memberNarration,
                            VoucherNo = lc.ReceiptNo ?? ("REC-" + lc.LoanCollectionID),
                            CashAmount = isCash ? intAmt : 0,
                            TransferAmount = isCash ? 0 : intAmt
                        };
                        group.TotalCash += entry.CashAmount;
                        group.TotalTransfer += entry.TransferAmount;
                        group.Entries.Add(entry);
                    }
                }
            }

            var response = new DaybookResponseDto
            {
                OpeningBalance = openingBalance,
                Receipts = jamaGroups.Values.OrderBy(g => g.LedgerId).ToList(),
                Payments = naveGroups.Values.OrderBy(g => g.LedgerId).ToList()
            };

            // Calculate totals
            response.TotalReceiptsCash = response.Receipts.Sum(g => g.TotalCash);
            response.TotalReceiptsTransfer = response.Receipts.Sum(g => g.TotalTransfer);
            response.TotalPaymentsCash = response.Payments.Sum(g => g.TotalCash);
            response.TotalPaymentsTransfer = response.Payments.Sum(g => g.TotalTransfer);

            response.ClosingBalance = openingBalance + response.TotalReceiptsCash - response.TotalPaymentsCash;

            return Ok(response);
        }

        [HttpGet("DaybookBatch")]
        public async Task<ActionResult<DaybookBatchResponseDto>> GetDaybookBatch([FromQuery] DateTime date, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            DateTime rangeStart = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
            DateTime rangeEnd = DateTime.SpecifyKind(toDate.HasValue ? toDate.Value.Date.AddDays(1).AddTicks(-1) : date.Date.AddDays(1).AddTicks(-1), DateTimeKind.Unspecified);

            // Load ledgers once
            var ledgers = await _context.Ledgers.AsNoTracking().Include(l => l.AccountGroup).ToListAsync();

            var cashLedgerIds = ledgers
                .Where(l =>
                    l.LedgerName.Contains("हातातील रोख शिल्लक") ||
                    l.LedgerName.Contains("हातावरील रोख शिल्लक") ||
                    l.LedgerName.Contains("रोख शिल्लक") ||
                    l.LedgerName.Contains("हातातील") ||
                    l.LedgerName.Contains("हातावरील") ||
                    l.LedgerName.Contains("रोख") ||
                    l.LedgerName.ToLower().Contains("cash") ||
                    (l.AccountGroup != null && (
                        l.AccountGroup.GroupName.Contains("Cash") ||
                        l.AccountGroup.GroupName.Contains("रोख") ||
                        l.AccountGroup.GroupName.Contains("हातातील") ||
                        l.AccountGroup.GroupName.Contains("हातावरील")
                    ))
                )
                .Select(l => l.LedgerID)
                .ToHashSet();

            // Opening balance as of rangeStart
            decimal baseOpeningBalance = 0;
            var cashLedgersList = ledgers.Where(l => cashLedgerIds.Contains(l.LedgerID)).ToList();
            foreach (var cl in cashLedgersList)
            {
                baseOpeningBalance += cl.OpeningBalanceType == "Dr" ? cl.OpeningBalance : -cl.OpeningBalance;
            }

            if (cashLedgerIds.Count > 0)
            {
                var priorDrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Dr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < rangeStart);
                var priorCrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Cr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < rangeStart);

                if (branchId.HasValue)
                {
                    priorDrQuery = priorDrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                    priorCrQuery = priorCrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                }

                decimal priorDr = await priorDrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
                decimal priorCr = await priorCrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
                baseOpeningBalance += (priorDr - priorCr);
            }

            // Load ALL vouchers for the entire range in one query
            var vouchersQuery = _context.Vouchers.AsNoTracking()
                .Include(v => v.VoucherDetails).ThenInclude(vd => vd.Ledger)
                .Include(v => v.VoucherDetails).ThenInclude(vd => vd.Member)
                .Where(v => (v.Status == "Approved" || string.IsNullOrEmpty(v.Status) || v.Status == "Posted") 
                         && v.Status != "Rejected" 
                         && v.Status != "Cancelled" 
                         && v.VoucherDate >= rangeStart 
                         && v.VoucherDate <= rangeEnd
                         && v.VoucherType != "Opening Balance"
                         && (v.Narration == null || (!v.Narration.Contains("Opening Balance") && !v.Narration.Contains("आरंभीची शिल्लक") && !v.Narration.Contains("स्थलांतर"))));
            if (branchId.HasValue)
            {
                vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
            }
            var allVouchers = await vouchersQuery.ToListAsync();

            // Load ALL unvouchered loan disbursements and collections for the range
            var existingVoucherIds = allVouchers.Select(v => v.VoucherID).ToHashSet();

            var unvoucheredDisbQuery = _context.LoanDisbursements.AsNoTracking()
                .Where(ld => ld.LoanAccount != null 
                          && ld.DisbursementDate >= rangeStart 
                          && ld.DisbursementDate <= rangeEnd
                          && !ld.VoucherID.HasValue
                          && ld.PaymentMode != "Opening Balance"
                          && (ld.Remarks == null || (!ld.Remarks.Contains("Opening Balance") && !ld.Remarks.Contains("मागील येणे"))));
            if (branchId.HasValue)
            {
                unvoucheredDisbQuery = unvoucheredDisbQuery.Where(ld => ld.LoanAccount!.BranchID == branchId.Value);
            }
            var allUnvoucheredDisb = await unvoucheredDisbQuery
                .Include(ld => ld.LoanAccount!).ThenInclude(la => la!.Member)
                .Include(ld => ld.LoanAccount!).ThenInclude(la => la!.LoanRate)
                .ToListAsync();

            var unvoucheredColQuery = _context.LoanCollections.AsNoTracking()
                .Where(lc => lc.LoanAccount != null && lc.CollectionDate >= rangeStart && lc.CollectionDate <= rangeEnd
                          && !lc.VoucherID.HasValue);
            if (branchId.HasValue)
            {
                unvoucheredColQuery = unvoucheredColQuery.Where(lc => lc.LoanAccount!.BranchID == branchId.Value);
            }
            var allUnvoucheredCols = await unvoucheredColQuery
                .Include(lc => lc.LoanAccount!).ThenInclude(la => la!.Member)
                .Include(lc => lc.LoanAccount!).ThenInclude(la => la!.LoanRate)
                .ToListAsync();

            var defaultLoanLedger = ledgers.FirstOrDefault(l => l.LedgerName.Contains("कर्ज") || l.LedgerName.Contains("Loan") || l.LedgerName.Contains("मुद्दल")) ?? ledgers.FirstOrDefault();
            var defaultInterestLedger = ledgers.FirstOrDefault(l => l.LedgerName.Contains("कर्ज व्याज") || l.LedgerName.Contains("व्याज जमा") || l.LedgerName.Contains("Interest")) ?? defaultLoanLedger;

            // Group data by date
            var vouchersByDate = allVouchers.GroupBy(v => v.VoucherDate.Date).ToDictionary(g => g.Key, g => g.ToList());
            var disbByDate = allUnvoucheredDisb.GroupBy(ld => ld.DisbursementDate.Date).ToDictionary(g => g.Key, g => g.ToList());
            var colsByDate = allUnvoucheredCols.GroupBy(lc => lc.CollectionDate.Date).ToDictionary(g => g.Key, g => g.ToList());

            var batchResponse = new DaybookBatchResponseDto();
            decimal runningOpeningBalance = baseOpeningBalance;

            // Iterate through each date in range
            for (var currentDate = rangeStart.Date; currentDate <= rangeEnd.Date; currentDate = currentDate.AddDays(1))
            {
                var jamaGroups = new Dictionary<int, DaybookGroupDto>();
                var naveGroups = new Dictionary<int, DaybookGroupDto>();

                // Process vouchers for this date
                if (vouchersByDate.TryGetValue(currentDate, out var dayVouchers))
                {
                    foreach (var v in dayVouchers)
                    {
                        var cashDetail = v.VoucherDetails.FirstOrDefault(vd => cashLedgerIds.Contains(vd.LedgerID));
                        decimal cashAmountInVoucher = cashDetail?.Amount ?? 0m;
                        string cashDrCr = cashDetail?.DrCr ?? "";

                        var nonCashDetails = v.VoucherDetails.Where(vd => !cashLedgerIds.Contains(vd.LedgerID)).ToList();
                        decimal totalNonCashDr = nonCashDetails.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                        decimal totalNonCashCr = nonCashDetails.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

                        foreach (var vd in nonCashDetails)
                        {
                            var targetDict = vd.DrCr == "Cr" ? jamaGroups : naveGroups;

                            if (!targetDict.ContainsKey(vd.LedgerID))
                            {
                                targetDict[vd.LedgerID] = new DaybookGroupDto
                                {
                                    LedgerId = vd.LedgerID,
                                    LedgerName = vd.Ledger?.LedgerName ?? "Unknown",
                                    Entries = new List<DaybookEntryDto>()
                                };
                            }

                            var group = targetDict[vd.LedgerID];

                            string narration = string.IsNullOrWhiteSpace(v.Narration) ? (v.VoucherType ?? "") : v.Narration;
                            if (vd.Member != null)
                            {
                                narration = $"{vd.Member.MemberCode}-{vd.Member.FirstName} {vd.Member.LastName}";
                            }

                            decimal cashAmt = 0m;
                            decimal transferAmt = 0m;

                            if (cashDetail == null)
                            {
                                // Pure Transfer / Journal Voucher
                                transferAmt = vd.Amount;
                            }
                            else if (cashDrCr == "Cr")
                            {
                                // Payment Voucher: Cash is being paid out
                                if (vd.DrCr == "Dr")
                                {
                                    if (totalNonCashDr > 0)
                                    {
                                        decimal proportion = vd.Amount / totalNonCashDr;
                                        cashAmt = Math.Min(vd.Amount, cashAmountInVoucher * proportion);
                                        transferAmt = vd.Amount - cashAmt;
                                    }
                                    else
                                    {
                                        cashAmt = Math.Min(vd.Amount, cashAmountInVoucher);
                                        transferAmt = vd.Amount - cashAmt;
                                    }
                                }
                                else
                                {
                                    // Deduction inside Payment voucher
                                    transferAmt = vd.Amount;
                                }
                            }
                            else // cashDrCr == "Dr"
                            {
                                // Receipt Voucher: Cash is being received
                                if (vd.DrCr == "Cr")
                                {
                                    if (totalNonCashCr > 0)
                                    {
                                        decimal proportion = vd.Amount / totalNonCashCr;
                                        cashAmt = Math.Min(vd.Amount, cashAmountInVoucher * proportion);
                                        transferAmt = vd.Amount - cashAmt;
                                    }
                                    else
                                    {
                                        cashAmt = Math.Min(vd.Amount, cashAmountInVoucher);
                                        transferAmt = vd.Amount - cashAmt;
                                    }
                                }
                                else
                                {
                                    // Debit side inside Receipt voucher
                                    transferAmt = vd.Amount;
                                }
                            }

                            var entry = new DaybookEntryDto
                            {
                                Narration = narration,
                                VoucherNo = v.VoucherNo ?? "",
                                CashAmount = Math.Round(cashAmt, 2),
                                TransferAmount = Math.Round(transferAmt, 2)
                            };

                            group.TotalCash += entry.CashAmount;
                            group.TotalTransfer += entry.TransferAmount;
                            group.Entries.Add(entry);
                        }
                    }
                }

                // Process unvouchered disbursements for this date
                if (disbByDate.TryGetValue(currentDate, out var dayDisb))
                {
                    foreach (var ld in dayDisb)
                    {
                        int lId = ld.LoanAccount?.LoanRate?.LoanLedgerID ?? defaultLoanLedger?.LedgerID ?? 0;
                        if (lId == 0) continue;
                        string lName = ledgers.FirstOrDefault(l => l.LedgerID == lId)?.LedgerName ?? "कर्ज खाते (Loan Account)";

                        if (!naveGroups.ContainsKey(lId))
                        {
                            naveGroups[lId] = new DaybookGroupDto
                            {
                                LedgerId = lId,
                                LedgerName = lName,
                                Entries = new List<DaybookEntryDto>()
                            };
                        }

                        var group = naveGroups[lId];
                        var member = ld.LoanAccount?.Member;
                        string narration = member != null
                            ? $"{member.MemberCode}-{member.FirstName} {member.LastName}"
                            : $"Loan Disbursed (A/C: {ld.LoanAccount?.LoanAccountNo})";

                        bool isCash = ld.PaymentMode == "Cash";
                        var entry = new DaybookEntryDto
                        {
                            Narration = narration,
                            VoucherNo = "DISB-" + ld.LoanDisbursementID,
                            CashAmount = isCash ? ld.DisbursementAmount : 0,
                            TransferAmount = isCash ? 0 : ld.DisbursementAmount
                        };
                        group.TotalCash += entry.CashAmount;
                        group.TotalTransfer += entry.TransferAmount;
                        group.Entries.Add(entry);
                    }
                }

                // Process unvouchered collections for this date
                if (colsByDate.TryGetValue(currentDate, out var dayCols))
                {
                    foreach (var lc in dayCols)
                    {
                        var member = lc.LoanAccount?.Member;
                        string memberNarration = member != null
                            ? $"{member.MemberCode}-{member.FirstName} {member.LastName}"
                            : $"Loan Collection (Rect: {lc.ReceiptNo})";
                        bool isCash = lc.PaymentMode == "Cash";

                        if (lc.PrincipalCollected > 0)
                        {
                            int lId = lc.LoanAccount?.LoanRate?.LoanLedgerID ?? defaultLoanLedger?.LedgerID ?? 0;
                            if (lId > 0)
                            {
                                string lName = ledgers.FirstOrDefault(l => l.LedgerID == lId)?.LedgerName ?? "कर्ज खाते (Loan Account)";
                                if (!jamaGroups.ContainsKey(lId))
                                {
                                    jamaGroups[lId] = new DaybookGroupDto
                                    {
                                        LedgerId = lId,
                                        LedgerName = lName,
                                        Entries = new List<DaybookEntryDto>()
                                    };
                                }
                                var group = jamaGroups[lId];
                                var entry = new DaybookEntryDto
                                {
                                    Narration = memberNarration,
                                    VoucherNo = lc.ReceiptNo ?? ("REC-" + lc.LoanCollectionID),
                                    CashAmount = isCash ? lc.PrincipalCollected : 0,
                                    TransferAmount = isCash ? 0 : lc.PrincipalCollected
                                };
                                group.TotalCash += entry.CashAmount;
                                group.TotalTransfer += entry.TransferAmount;
                                group.Entries.Add(entry);
                            }
                        }

                        if (lc.InterestCollected + lc.PenaltyInterestCollected > 0)
                        {
                            int iId = lc.LoanAccount?.LoanRate?.InterestLedgerID ?? defaultInterestLedger?.LedgerID ?? 0;
                            if (iId > 0)
                            {
                                string iName = ledgers.FirstOrDefault(l => l.LedgerID == iId)?.LedgerName ?? "कर्ज व्याज जमा (Loan Interest)";
                                if (!jamaGroups.ContainsKey(iId))
                                {
                                    jamaGroups[iId] = new DaybookGroupDto
                                    {
                                        LedgerId = iId,
                                        LedgerName = iName,
                                        Entries = new List<DaybookEntryDto>()
                                    };
                                }
                                var group = jamaGroups[iId];
                                decimal intAmt = lc.InterestCollected + lc.PenaltyInterestCollected;
                                var entry = new DaybookEntryDto
                                {
                                    Narration = memberNarration,
                                    VoucherNo = lc.ReceiptNo ?? ("REC-" + lc.LoanCollectionID),
                                    CashAmount = isCash ? intAmt : 0,
                                    TransferAmount = isCash ? 0 : intAmt
                                };
                                group.TotalCash += entry.CashAmount;
                                group.TotalTransfer += entry.TransferAmount;
                                group.Entries.Add(entry);
                            }
                        }
                    }
                }

                // Build day response
                var dayResponse = new DaybookResponseDto
                {
                    OpeningBalance = runningOpeningBalance,
                    Receipts = jamaGroups.Values.OrderBy(g => g.LedgerId).ToList(),
                    Payments = naveGroups.Values.OrderBy(g => g.LedgerId).ToList()
                };

                dayResponse.TotalReceiptsCash = dayResponse.Receipts.Sum(g => g.TotalCash);
                dayResponse.TotalReceiptsTransfer = dayResponse.Receipts.Sum(g => g.TotalTransfer);
                dayResponse.TotalPaymentsCash = dayResponse.Payments.Sum(g => g.TotalCash);
                dayResponse.TotalPaymentsTransfer = dayResponse.Payments.Sum(g => g.TotalTransfer);
                dayResponse.ClosingBalance = runningOpeningBalance + dayResponse.TotalReceiptsCash - dayResponse.TotalPaymentsCash;

                bool hasTransactions = dayResponse.TotalReceiptsCash > 0 || dayResponse.TotalPaymentsCash > 0
                    || dayResponse.TotalReceiptsTransfer > 0 || dayResponse.TotalPaymentsTransfer > 0
                    || dayResponse.Receipts.Count > 0 || dayResponse.Payments.Count > 0;

                // Include day if it has transactions or if it's a single-day query
                if (hasTransactions || rangeStart.Date == rangeEnd.Date)
                {
                    batchResponse.Days.Add(new DaybookDayDto
                    {
                        Date = currentDate.ToString("yyyy-MM-dd"),
                        Data = dayResponse
                    });
                }

                // Carry forward closing balance as next day's opening
                runningOpeningBalance = dayResponse.ClosingBalance;
            }

            return Ok(batchResponse);
        }

        [HttpGet("DaybookSummary")]
        public async Task<ActionResult<DaybookSummaryResponseDto>> GetDaybookSummary([FromQuery] DateTime date, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            DateTime startDate = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
            DateTime endDate = DateTime.SpecifyKind(toDate.HasValue ? toDate.Value.Date.AddDays(1).AddTicks(-1) : date.Date.AddDays(1).AddTicks(-1), DateTimeKind.Unspecified);

            var ledgers = await _context.Ledgers.AsNoTracking().Include(l => l.AccountGroup).ToListAsync();
            var groups = await _context.AccountGroups.AsNoTracking().ToListAsync();
            
            // Match all cash ledgers dynamically
            var cashLedgerIds = ledgers
                .Where(l => 
                    l.LedgerName.Contains("हातातील रोख शिल्लक") || 
                    l.LedgerName.Contains("हातावरील रोख शिल्लक") || 
                    l.LedgerName.Contains("रोख शिल्लक") || 
                    l.LedgerName.Contains("हातातील") || 
                    l.LedgerName.Contains("हातावरील") || 
                    l.LedgerName.Contains("रोख") || 
                    l.LedgerName.ToLower().Contains("cash") ||
                    (l.AccountGroup != null && (
                        l.AccountGroup.GroupName.Contains("Cash") || 
                        l.AccountGroup.GroupName.Contains("रोख") ||
                        l.AccountGroup.GroupName.Contains("हातातील") ||
                        l.AccountGroup.GroupName.Contains("हातावरील")
                    ))
                )
                .Select(l => l.LedgerID)
                .ToHashSet();

            // Calculate Opening Balance for Cash across matched cash ledgers
            decimal openingBalance = 0;
            var cashLedgersList = ledgers.Where(l => cashLedgerIds.Contains(l.LedgerID)).ToList();
            foreach (var cl in cashLedgersList)
            {
                openingBalance += cl.OpeningBalanceType == "Dr" ? cl.OpeningBalance : -cl.OpeningBalance;
            }

            if (cashLedgerIds.Count > 0)
            {
                var priorDrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Dr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < startDate);
                var priorCrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Cr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < startDate);

                if (branchId.HasValue)
                {
                    priorDrQuery = priorDrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                    priorCrQuery = priorCrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                }

                decimal priorDr = await priorDrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
                decimal priorCr = await priorCrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

                openingBalance += (priorDr - priorCr);
            }

            var vouchersQuery = _context.Vouchers.AsNoTracking()
                .Include(v => v.VoucherDetails).ThenInclude(vd => vd.Member)
                .Where(v => (v.Status == "Approved" || string.IsNullOrEmpty(v.Status) || v.Status == "Posted") 
                         && v.Status != "Rejected" 
                         && v.Status != "Cancelled" 
                         && v.VoucherDate >= startDate 
                         && v.VoucherDate <= endDate
                         && v.VoucherType != "Opening Balance"
                         && (v.Narration == null || (!v.Narration.Contains("Opening Balance") && !v.Narration.Contains("आरंभीची शिल्लक") && !v.Narration.Contains("स्थलांतर"))));
            
            if (branchId.HasValue)
            {
                vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
            }
            var vouchers = await vouchersQuery.ToListAsync();

            var ledgerSummaries = new Dictionary<int, DaybookSummaryLedgerDto>();

            foreach (var v in vouchers)
            {
                bool hasCash = v.VoucherDetails.Any(vd => cashLedgerIds.Contains(vd.LedgerID));
                
                foreach (var vd in v.VoucherDetails)
                {
                    if (cashLedgerIds.Contains(vd.LedgerID)) continue; // Skip cash ledger itself

                    if (!ledgerSummaries.ContainsKey(vd.LedgerID))
                    {
                        var l = ledgers.FirstOrDefault(x => x.LedgerID == vd.LedgerID);
                        ledgerSummaries[vd.LedgerID] = new DaybookSummaryLedgerDto
                        {
                            LedgerId = vd.LedgerID,
                            LedgerName = l?.LedgerName ?? "Unknown"
                        };
                    }

                    var summary = ledgerSummaries[vd.LedgerID];
                    
                    if (!string.IsNullOrEmpty(v.VoucherNo))
                    {
                        if (string.IsNullOrEmpty(summary.VoucherNo))
                        {
                            summary.VoucherNo = v.VoucherNo;
                        }
                        else
                        {
                            var existingVouchers = summary.VoucherNo.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries);
                            if (!existingVouchers.Contains(v.VoucherNo))
                            {
                                summary.VoucherNo += ", " + v.VoucherNo;
                            }
                        }
                    }

                    // Collect Member Details / Narration
                    string memInfo = "";
                    if (vd.Member != null)
                    {
                        memInfo = $"{vd.Member.MemberCode}-{vd.Member.FirstName} {vd.Member.LastName}".Trim();
                    }
                    else if (!string.IsNullOrWhiteSpace(v.Narration))
                    {
                        memInfo = v.Narration.Trim();
                    }

                    if (!string.IsNullOrEmpty(memInfo))
                    {
                        if (string.IsNullOrEmpty(summary.MemberDetails))
                        {
                            summary.MemberDetails = memInfo;
                        }
                        else
                        {
                            var existingMems = summary.MemberDetails.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries);
                            if (!existingMems.Contains(memInfo))
                            {
                                summary.MemberDetails += ", " + memInfo;
                            }
                        }
                    }

                    if (vd.DrCr == "Cr") // Receipt (Jama)
                    {
                        if (hasCash) summary.ReceiptCash += vd.Amount;
                        else summary.ReceiptTransfer += vd.Amount;
                    }
                    else // Payment (Nave)
                    {
                        if (hasCash) summary.PaymentCash += vd.Amount;
                        else summary.PaymentTransfer += vd.Amount;
                    }
                }
            }

            // Include unvouchered Loan Disbursements into GetDaybookSummary (Payment side)
            var existingVoucherIdsSummary = vouchers.Select(v => v.VoucherID).ToHashSet();
            var unvoucheredDisbQuerySummary = _context.LoanDisbursements.AsNoTracking()
                .Include(ld => ld.LoanAccount!).ThenInclude(la => la!.Member)
                .Include(ld => ld.LoanAccount!).ThenInclude(la => la!.LoanRate)
                .Where(ld => ld.DisbursementDate >= startDate 
                          && ld.DisbursementDate <= endDate
                          && !ld.VoucherID.HasValue
                          && ld.PaymentMode != "Opening Balance"
                          && (ld.Remarks == null || (!ld.Remarks.Contains("Opening Balance") && !ld.Remarks.Contains("मागील येणे"))));
            if (branchId.HasValue)
            {
                unvoucheredDisbQuerySummary = unvoucheredDisbQuerySummary.Where(ld => ld.LoanAccount != null && ld.LoanAccount.BranchID == branchId.Value);
            }
            var unvoucheredDisbSummary = await unvoucheredDisbQuerySummary.ToListAsync();
            var defaultLoanLedgerSummary = ledgers.FirstOrDefault(l => l.LedgerName.Contains("कर्ज") || l.LedgerName.Contains("Loan") || l.LedgerName.Contains("मुद्दल")) ?? ledgers.FirstOrDefault();

            foreach (var ld in unvoucheredDisbSummary)
            {
                int lId = ld.LoanAccount?.LoanRate?.LoanLedgerID ?? defaultLoanLedgerSummary?.LedgerID ?? 0;
                if (lId == 0) continue;

                if (!ledgerSummaries.ContainsKey(lId))
                {
                    var l = ledgers.FirstOrDefault(x => x.LedgerID == lId);
                    ledgerSummaries[lId] = new DaybookSummaryLedgerDto
                    {
                        LedgerId = lId,
                        LedgerName = l?.LedgerName ?? "कर्ज खाते (Loan Account)"
                    };
                }
                var summary = ledgerSummaries[lId];
                bool isCash = ld.PaymentMode == "Cash";
                if (isCash) summary.PaymentCash += ld.DisbursementAmount;
                else summary.PaymentTransfer += ld.DisbursementAmount;

                var m = ld.LoanAccount?.Member;
                if (m != null)
                {
                    string mStr = $"{m.MemberCode}-{m.FirstName} {m.LastName}";
                    if (string.IsNullOrEmpty(summary.MemberDetails)) summary.MemberDetails = mStr;
                    else if (!summary.MemberDetails.Contains(mStr)) summary.MemberDetails += ", " + mStr;
                }
            }

            // Include unvouchered Loan Collections into GetDaybookSummary (Receipt side)
            var unvoucheredColQuerySummary = _context.LoanCollections.AsNoTracking()
                .Include(lc => lc.LoanAccount!).ThenInclude(la => la!.Member)
                .Include(lc => lc.LoanAccount!).ThenInclude(la => la!.LoanRate)
                .Where(lc => lc.CollectionDate >= startDate && lc.CollectionDate <= endDate
                          && !lc.VoucherID.HasValue);
            if (branchId.HasValue)
            {
                unvoucheredColQuerySummary = unvoucheredColQuerySummary.Where(lc => lc.LoanAccount != null && lc.LoanAccount.BranchID == branchId.Value);
            }
            var unvoucheredColSummary = await unvoucheredColQuerySummary.ToListAsync();
            var defaultInterestLedgerSummary = ledgers.FirstOrDefault(l => l.LedgerName.Contains("कर्ज व्याज") || l.LedgerName.Contains("व्याज जमा") || l.LedgerName.Contains("Interest")) ?? defaultLoanLedgerSummary;

            foreach (var lc in unvoucheredColSummary)
            {
                bool isCash = lc.PaymentMode == "Cash";
                var m = lc.LoanAccount?.Member;
                string mStr = m != null ? $"{m.MemberCode}-{m.FirstName} {m.LastName}" : "";

                if (lc.PrincipalCollected > 0)
                {
                    int lId = lc.LoanAccount?.LoanRate?.LoanLedgerID ?? defaultLoanLedgerSummary?.LedgerID ?? 0;
                    if (lId > 0)
                    {
                        if (!ledgerSummaries.ContainsKey(lId))
                        {
                            var l = ledgers.FirstOrDefault(x => x.LedgerID == lId);
                            ledgerSummaries[lId] = new DaybookSummaryLedgerDto
                            {
                                LedgerId = lId,
                                LedgerName = l?.LedgerName ?? "कर्ज खाते (Loan Account)"
                            };
                        }
                        var summary = ledgerSummaries[lId];
                        if (isCash) summary.ReceiptCash += lc.PrincipalCollected;
                        else summary.ReceiptTransfer += lc.PrincipalCollected;

                        if (!string.IsNullOrEmpty(mStr))
                        {
                            if (string.IsNullOrEmpty(summary.MemberDetails)) summary.MemberDetails = mStr;
                            else if (!summary.MemberDetails.Contains(mStr)) summary.MemberDetails += ", " + mStr;
                        }
                    }
                }

                if (lc.InterestCollected + lc.PenaltyInterestCollected > 0)
                {
                    int iId = lc.LoanAccount?.LoanRate?.InterestLedgerID ?? defaultInterestLedgerSummary?.LedgerID ?? 0;
                    if (iId > 0)
                    {
                        if (!ledgerSummaries.ContainsKey(iId))
                        {
                            var l = ledgers.FirstOrDefault(x => x.LedgerID == iId);
                            ledgerSummaries[iId] = new DaybookSummaryLedgerDto
                            {
                                LedgerId = iId,
                                LedgerName = l?.LedgerName ?? "कर्ज व्याज जमा (Loan Interest)"
                            };
                        }
                        var summary = ledgerSummaries[iId];
                        decimal intAmt = lc.InterestCollected + lc.PenaltyInterestCollected;
                        if (isCash) summary.ReceiptCash += intAmt;
                        else summary.ReceiptTransfer += intAmt;

                        if (!string.IsNullOrEmpty(mStr))
                        {
                            if (string.IsNullOrEmpty(summary.MemberDetails)) summary.MemberDetails = mStr;
                            else if (!summary.MemberDetails.Contains(mStr)) summary.MemberDetails += ", " + mStr;
                        }
                    }
                }
            }

            // Group by parent AccountGroup
            var groupSummaries = new Dictionary<int, DaybookSummaryGroupDto>();

            foreach (var ls in ledgerSummaries.Values)
            {
                var l = ledgers.FirstOrDefault(x => x.LedgerID == ls.LedgerId);
                int groupId = l?.GroupID ?? 0;
                
                // Find top-level or nearest parent group for grouping (simplified logic: just use its direct group or parent)
                var grp = groups.FirstOrDefault(g => g.GroupID == groupId);
                int effectiveGroupId = grp?.ParentGroupID ?? grp?.GroupID ?? 0;
                var effectiveGroup = groups.FirstOrDefault(g => g.GroupID == effectiveGroupId);
                string effectiveGroupName = effectiveGroup?.GroupName ?? "Other";

                if (!groupSummaries.ContainsKey(effectiveGroupId))
                {
                    groupSummaries[effectiveGroupId] = new DaybookSummaryGroupDto
                    {
                        GroupId = effectiveGroupId,
                        GroupName = effectiveGroupName,
                        Ledgers = new List<DaybookSummaryLedgerDto>()
                    };
                }

                groupSummaries[effectiveGroupId].Ledgers.Add(ls);
            }

            var response = new DaybookSummaryResponseDto
            {
                OpeningBalance = openingBalance,
                Groups = groupSummaries.Values.OrderBy(g => g.GroupId).ToList(),
                TotalReceiptsCash = ledgerSummaries.Values.Sum(l => l.ReceiptCash),
                TotalReceiptsTransfer = ledgerSummaries.Values.Sum(l => l.ReceiptTransfer),
                TotalPaymentsCash = ledgerSummaries.Values.Sum(l => l.PaymentCash),
                TotalPaymentsTransfer = ledgerSummaries.Values.Sum(l => l.PaymentTransfer)
            };

            response.ClosingBalance = openingBalance + response.TotalReceiptsCash - response.TotalPaymentsCash;

            return Ok(response);
        }

        [HttpGet("DaybookSummaryBatch")]
        public async Task<ActionResult<DaybookSummaryBatchResponseDto>> GetDaybookSummaryBatch([FromQuery] DateTime date, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            DateTime rangeStart = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
            DateTime rangeEnd = DateTime.SpecifyKind(toDate.HasValue ? toDate.Value.Date.AddDays(1).AddTicks(-1) : date.Date.AddDays(1).AddTicks(-1), DateTimeKind.Unspecified);

            var ledgers = await _context.Ledgers.AsNoTracking().Include(l => l.AccountGroup).ToListAsync();
            var groups = await _context.AccountGroups.AsNoTracking().ToListAsync();

            // Match all cash ledgers dynamically
            var cashLedgerIds = ledgers
                .Where(l =>
                    l.LedgerName.Contains("हातातील रोख शिल्लक") ||
                    l.LedgerName.Contains("हातावरील रोख शिल्लक") ||
                    l.LedgerName.Contains("रोख शिल्लक") ||
                    l.LedgerName.Contains("हातातील") ||
                    l.LedgerName.Contains("हातावरील") ||
                    l.LedgerName.Contains("रोख") ||
                    l.LedgerName.ToLower().Contains("cash") ||
                    (l.AccountGroup != null && (
                        l.AccountGroup.GroupName.Contains("Cash") ||
                        l.AccountGroup.GroupName.Contains("रोख") ||
                        l.AccountGroup.GroupName.Contains("हातातील") ||
                        l.AccountGroup.GroupName.Contains("हातावरील")
                    ))
                )
                .Select(l => l.LedgerID)
                .ToHashSet();

            // Calculate Opening Balance for Cash as of rangeStart
            decimal baseOpeningBalance = 0;
            var cashLedgersList = ledgers.Where(l => cashLedgerIds.Contains(l.LedgerID)).ToList();
            foreach (var cl in cashLedgersList)
            {
                baseOpeningBalance += cl.OpeningBalanceType == "Dr" ? cl.OpeningBalance : -cl.OpeningBalance;
            }

            if (cashLedgerIds.Count > 0)
            {
                var priorDrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Dr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < rangeStart);
                var priorCrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Cr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < rangeStart);

                if (branchId.HasValue)
                {
                    priorDrQuery = priorDrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                    priorCrQuery = priorCrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                }

                decimal priorDr = await priorDrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
                decimal priorCr = await priorCrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;

                baseOpeningBalance += (priorDr - priorCr);
            }

            // Load ALL vouchers for the entire range in one query
            var vouchersQuery = _context.Vouchers.AsNoTracking()
                .Include(v => v.VoucherDetails).ThenInclude(vd => vd.Member)
                .Where(v => (v.Status == "Approved" || string.IsNullOrEmpty(v.Status) || v.Status == "Posted") 
                         && v.Status != "Rejected" 
                         && v.Status != "Cancelled" 
                         && v.VoucherDate >= rangeStart 
                         && v.VoucherDate <= rangeEnd
                         && v.VoucherType != "Opening Balance"
                         && (v.Narration == null || (!v.Narration.Contains("Opening Balance") && !v.Narration.Contains("आरंभीची शिल्लक") && !v.Narration.Contains("स्थलांतर"))));

            if (branchId.HasValue)
            {
                vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
            }
            var allVouchers = await vouchersQuery.ToListAsync();

            // Load ALL unvouchered loan disbursements and collections for the range
            var existingVoucherIds = allVouchers.Select(v => v.VoucherID).ToHashSet();

            var unvoucheredDisbQuery = _context.LoanDisbursements.AsNoTracking()
                .Include(ld => ld.LoanAccount!).ThenInclude(la => la!.Member)
                .Include(ld => ld.LoanAccount!).ThenInclude(la => la!.LoanRate)
                .Where(ld => ld.DisbursementDate >= rangeStart 
                          && ld.DisbursementDate <= rangeEnd
                          && !ld.VoucherID.HasValue
                          && ld.PaymentMode != "Opening Balance"
                          && (ld.Remarks == null || (!ld.Remarks.Contains("Opening Balance") && !ld.Remarks.Contains("मागील येणे"))));
            if (branchId.HasValue)
            {
                unvoucheredDisbQuery = unvoucheredDisbQuery.Where(ld => ld.LoanAccount != null && ld.LoanAccount.BranchID == branchId.Value);
            }
            var allUnvoucheredDisb = await unvoucheredDisbQuery.ToListAsync();

            var unvoucheredColQuery = _context.LoanCollections.AsNoTracking()
                .Include(lc => lc.LoanAccount!).ThenInclude(la => la!.Member)
                .Include(lc => lc.LoanAccount!).ThenInclude(la => la!.LoanRate)
                .Where(lc => lc.CollectionDate >= rangeStart && lc.CollectionDate <= rangeEnd
                          && !lc.VoucherID.HasValue);
            if (branchId.HasValue)
            {
                unvoucheredColQuery = unvoucheredColQuery.Where(lc => lc.LoanAccount != null && lc.LoanAccount.BranchID == branchId.Value);
            }
            var allUnvoucheredCols = await unvoucheredColQuery.ToListAsync();

            var defaultLoanLedger = ledgers.FirstOrDefault(l => l.LedgerName.Contains("कर्ज") || l.LedgerName.Contains("Loan") || l.LedgerName.Contains("मुद्दल")) ?? ledgers.FirstOrDefault();
            var defaultInterestLedger = ledgers.FirstOrDefault(l => l.LedgerName.Contains("कर्ज व्याज") || l.LedgerName.Contains("व्याज जमा") || l.LedgerName.Contains("Interest")) ?? defaultLoanLedger;

            // Group by Date
            var vouchersByDate = allVouchers.GroupBy(v => v.VoucherDate.Date).ToDictionary(g => g.Key, g => g.ToList());
            var disbByDate = allUnvoucheredDisb.GroupBy(ld => ld.DisbursementDate.Date).ToDictionary(g => g.Key, g => g.ToList());
            var colsByDate = allUnvoucheredCols.GroupBy(lc => lc.CollectionDate.Date).ToDictionary(g => g.Key, g => g.ToList());

            var batchResponse = new DaybookSummaryBatchResponseDto();
            decimal runningOpeningBalance = baseOpeningBalance;

            for (var currentDate = rangeStart.Date; currentDate <= rangeEnd.Date; currentDate = currentDate.AddDays(1))
            {
                var ledgerSummaries = new Dictionary<int, DaybookSummaryLedgerDto>();

                // 1. Vouchers for currentDate
                if (vouchersByDate.TryGetValue(currentDate, out var dayVouchers))
                {
                    foreach (var v in dayVouchers)
                    {
                        bool hasCash = v.VoucherDetails.Any(vd => cashLedgerIds.Contains(vd.LedgerID));

                        foreach (var vd in v.VoucherDetails)
                        {
                            if (cashLedgerIds.Contains(vd.LedgerID)) continue;

                            if (!ledgerSummaries.ContainsKey(vd.LedgerID))
                            {
                                var l = ledgers.FirstOrDefault(x => x.LedgerID == vd.LedgerID);
                                ledgerSummaries[vd.LedgerID] = new DaybookSummaryLedgerDto
                                {
                                    LedgerId = vd.LedgerID,
                                    LedgerName = l?.LedgerName ?? "Unknown"
                                };
                            }

                            var summary = ledgerSummaries[vd.LedgerID];

                            if (!string.IsNullOrEmpty(v.VoucherNo))
                            {
                                if (string.IsNullOrEmpty(summary.VoucherNo))
                                {
                                    summary.VoucherNo = v.VoucherNo;
                                }
                                else
                                {
                                    var existingVouchers = summary.VoucherNo.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries);
                                    if (!existingVouchers.Contains(v.VoucherNo))
                                    {
                                        summary.VoucherNo += ", " + v.VoucherNo;
                                    }
                                }
                            }

                            string memInfo = "";
                            if (vd.Member != null)
                            {
                                memInfo = $"{vd.Member.MemberCode}-{vd.Member.FirstName} {vd.Member.LastName}".Trim();
                            }
                            else if (!string.IsNullOrWhiteSpace(v.Narration))
                            {
                                memInfo = v.Narration.Trim();
                            }

                            if (!string.IsNullOrEmpty(memInfo))
                            {
                                if (string.IsNullOrEmpty(summary.MemberDetails))
                                {
                                    summary.MemberDetails = memInfo;
                                }
                                else
                                {
                                    var existingMems = summary.MemberDetails.Split(new[] { ", " }, StringSplitOptions.RemoveEmptyEntries);
                                    if (!existingMems.Contains(memInfo))
                                    {
                                        summary.MemberDetails += ", " + memInfo;
                                    }
                                }
                            }

                            if (vd.DrCr == "Cr")
                            {
                                if (hasCash) summary.ReceiptCash += vd.Amount;
                                else summary.ReceiptTransfer += vd.Amount;
                            }
                            else
                            {
                                if (hasCash) summary.PaymentCash += vd.Amount;
                                else summary.PaymentTransfer += vd.Amount;
                            }
                        }
                    }
                }

                // 2. Disbursements for currentDate
                if (disbByDate.TryGetValue(currentDate, out var dayDisb))
                {
                    foreach (var ld in dayDisb)
                    {
                        int lId = ld.LoanAccount?.LoanRate?.LoanLedgerID ?? defaultLoanLedger?.LedgerID ?? 0;
                        if (lId == 0) continue;

                        if (!ledgerSummaries.ContainsKey(lId))
                        {
                            var l = ledgers.FirstOrDefault(x => x.LedgerID == lId);
                            ledgerSummaries[lId] = new DaybookSummaryLedgerDto
                            {
                                LedgerId = lId,
                                LedgerName = l?.LedgerName ?? "कर्ज खाते (Loan Account)"
                            };
                        }
                        var summary = ledgerSummaries[lId];
                        bool isCash = ld.PaymentMode == "Cash";
                        if (isCash) summary.PaymentCash += ld.DisbursementAmount;
                        else summary.PaymentTransfer += ld.DisbursementAmount;

                        var m = ld.LoanAccount?.Member;
                        if (m != null)
                        {
                            string mStr = $"{m.MemberCode}-{m.FirstName} {m.LastName}";
                            if (string.IsNullOrEmpty(summary.MemberDetails)) summary.MemberDetails = mStr;
                            else if (!summary.MemberDetails.Contains(mStr)) summary.MemberDetails += ", " + mStr;
                        }
                    }
                }

                // 3. Collections for currentDate
                if (colsByDate.TryGetValue(currentDate, out var dayCols))
                {
                    foreach (var lc in dayCols)
                    {
                        bool isCash = lc.PaymentMode == "Cash";
                        var m = lc.LoanAccount?.Member;
                        string mStr = m != null ? $"{m.MemberCode}-{m.FirstName} {m.LastName}" : "";

                        if (lc.PrincipalCollected > 0)
                        {
                            int lId = lc.LoanAccount?.LoanRate?.LoanLedgerID ?? defaultLoanLedger?.LedgerID ?? 0;
                            if (lId > 0)
                            {
                                if (!ledgerSummaries.ContainsKey(lId))
                                {
                                    var l = ledgers.FirstOrDefault(x => x.LedgerID == lId);
                                    ledgerSummaries[lId] = new DaybookSummaryLedgerDto
                                    {
                                        LedgerId = lId,
                                        LedgerName = l?.LedgerName ?? "कर्ज खाते (Loan Account)"
                                    };
                                }
                                var summary = ledgerSummaries[lId];
                                if (isCash) summary.ReceiptCash += lc.PrincipalCollected;
                                else summary.ReceiptTransfer += lc.PrincipalCollected;

                                if (!string.IsNullOrEmpty(mStr))
                                {
                                    if (string.IsNullOrEmpty(summary.MemberDetails)) summary.MemberDetails = mStr;
                                    else if (!summary.MemberDetails.Contains(mStr)) summary.MemberDetails += ", " + mStr;
                                }
                            }
                        }

                        if (lc.InterestCollected + lc.PenaltyInterestCollected > 0)
                        {
                            int iId = lc.LoanAccount?.LoanRate?.InterestLedgerID ?? defaultInterestLedger?.LedgerID ?? 0;
                            if (iId > 0)
                            {
                                if (!ledgerSummaries.ContainsKey(iId))
                                {
                                    var l = ledgers.FirstOrDefault(x => x.LedgerID == iId);
                                    ledgerSummaries[iId] = new DaybookSummaryLedgerDto
                                    {
                                        LedgerId = iId,
                                        LedgerName = l?.LedgerName ?? "कर्ज व्याज जमा (Loan Interest)"
                                    };
                                }
                                var summary = ledgerSummaries[iId];
                                decimal intAmt = lc.InterestCollected + lc.PenaltyInterestCollected;
                                if (isCash) summary.ReceiptCash += intAmt;
                                else summary.ReceiptTransfer += intAmt;

                                if (!string.IsNullOrEmpty(mStr))
                                {
                                    if (string.IsNullOrEmpty(summary.MemberDetails)) summary.MemberDetails = mStr;
                                    else if (!summary.MemberDetails.Contains(mStr)) summary.MemberDetails += ", " + mStr;
                                }
                            }
                        }
                    }
                }

                // Group by parent AccountGroup for currentDate
                var groupSummaries = new Dictionary<int, DaybookSummaryGroupDto>();

                foreach (var ls in ledgerSummaries.Values)
                {
                    var l = ledgers.FirstOrDefault(x => x.LedgerID == ls.LedgerId);
                    int groupId = l?.GroupID ?? 0;

                    var grp = groups.FirstOrDefault(g => g.GroupID == groupId);
                    int effectiveGroupId = grp?.ParentGroupID ?? grp?.GroupID ?? 0;
                    var effectiveGroup = groups.FirstOrDefault(g => g.GroupID == effectiveGroupId);
                    string effectiveGroupName = effectiveGroup?.GroupName ?? "Other";

                    if (!groupSummaries.ContainsKey(effectiveGroupId))
                    {
                        groupSummaries[effectiveGroupId] = new DaybookSummaryGroupDto
                        {
                            GroupId = effectiveGroupId,
                            GroupName = effectiveGroupName,
                            Ledgers = new List<DaybookSummaryLedgerDto>()
                        };
                    }

                    groupSummaries[effectiveGroupId].Ledgers.Add(ls);
                }

                var dayResponse = new DaybookSummaryResponseDto
                {
                    OpeningBalance = runningOpeningBalance,
                    Groups = groupSummaries.Values.OrderBy(g => g.GroupId).ToList(),
                    TotalReceiptsCash = ledgerSummaries.Values.Sum(l => l.ReceiptCash),
                    TotalReceiptsTransfer = ledgerSummaries.Values.Sum(l => l.ReceiptTransfer),
                    TotalPaymentsCash = ledgerSummaries.Values.Sum(l => l.PaymentCash),
                    TotalPaymentsTransfer = ledgerSummaries.Values.Sum(l => l.PaymentTransfer)
                };

                dayResponse.ClosingBalance = runningOpeningBalance + dayResponse.TotalReceiptsCash - dayResponse.TotalPaymentsCash;

                bool hasTransactions = dayResponse.TotalReceiptsCash > 0 || dayResponse.TotalPaymentsCash > 0
                    || dayResponse.TotalReceiptsTransfer > 0 || dayResponse.TotalPaymentsTransfer > 0
                    || dayResponse.Groups.Count > 0;

                if (hasTransactions || rangeStart.Date == rangeEnd.Date)
                {
                    batchResponse.Days.Add(new DaybookSummaryDayDto
                    {
                        Date = currentDate.ToString("yyyy-MM-dd"),
                        Data = dayResponse
                    });
                }

                runningOpeningBalance = dayResponse.ClosingBalance;
            }

            return Ok(batchResponse);
        }

        private string NormalizeNature(string? n)
        {
            if (string.IsNullOrWhiteSpace(n)) return "";
            var s = n.Trim().ToLower();
            if (s.StartsWith("liab") || s.Contains("देयता") || s.Contains("भांडवल") || s.Contains("देणी")) return "Liabilities";
            if (s.StartsWith("asset") || s.Contains("मालमत्ता") || s.Contains("येणी") || s.Contains("संपत्ती") || s.Contains("जिंदगी")) return "Assets";
            if (s.StartsWith("inc") || s.Contains("उत्पन्न") || s.Contains("जमा")) return "Income";
            if (s.StartsWith("exp") || s.Contains("खर्च") || s.Contains("नावे")) return "Expenses";
            return n.Trim();
        }

        private async Task<List<ReportNodeDto>> BuildReportNodes(string nature, DateTime? fromDate, DateTime? toDate, int? branchId = null)
        {
            var groups = await _context.AccountGroups.ToListAsync();
            var ledgers = await _context.Ledgers.ToListAsync();
            string targetNature = NormalizeNature(nature);
            
            var query = _context.VoucherDetails.Include(vd => vd.Voucher)
                .Where(vd => vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled")
                .AsQueryable();
            if (toDate.HasValue)
            {
                var toDateEnd = toDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate <= toDateEnd);
            }
            if (branchId.HasValue)
            {
                query = query.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
            }
            var vds = await query.ToListAsync();

            var ledgersByGroupId = new Dictionary<int, List<ReportNodeDto>>();

            foreach (var ledger in ledgers)
            {
                // To determine if ledger falls under this nature, trace back to its root group
                var currentGroup = groups.FirstOrDefault(g => g.GroupID == ledger.GroupID);
                string rootNature = "";
                while(currentGroup != null)
                {
                    rootNature = NormalizeNature(currentGroup.NatureOfGroup);
                    if (!string.IsNullOrEmpty(rootNature)) break;
                    if (currentGroup.ParentGroupID.HasValue)
                        currentGroup = groups.FirstOrDefault(g => g.GroupID == currentGroup.ParentGroupID.Value);
                    else
                        break;
                }

                if (string.IsNullOrEmpty(rootNature) && currentGroup != null)
                {
                    rootNature = NormalizeNature(currentGroup.NatureOfGroup);
                }

                if (rootNature?.Trim().ToLower() != targetNature.ToLower()) continue;

                var ledgerVds = vds.Where(vd => vd.LedgerID == ledger.LedgerID).ToList();
                decimal totalDr = ledgerVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                decimal totalCr = ledgerVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

                decimal drBal = ledger.OpeningBalanceType == "Dr" ? ledger.OpeningBalance : 0;
                decimal crBal = ledger.OpeningBalanceType == "Cr" ? ledger.OpeningBalance : 0;

                decimal drBalOpening = drBal;
                decimal crBalOpening = crBal;

                if (fromDate.HasValue)
                {
                    var pastVds = ledgerVds.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate < fromDate.Value.Date).ToList();
                    drBalOpening += pastVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                    crBalOpening += pastVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);
                }

                drBal += totalDr;
                crBal += totalCr;

                decimal netBal = 0;
                decimal prevNetBal = 0;
                if (targetNature == "Assets" || targetNature == "Expenses")
                {
                    netBal = drBal - crBal;
                    prevNetBal = drBalOpening - crBalOpening;
                }
                else
                {
                    netBal = crBal - drBal;
                    prevNetBal = crBalOpening - drBalOpening;
                }

                decimal openingBal = 0;
                string openingType = "";
                if (drBalOpening > crBalOpening) { openingBal = drBalOpening - crBalOpening; openingType = "Dr"; }
                else if (crBalOpening > drBalOpening) { openingBal = crBalOpening - drBalOpening; openingType = "Cr"; }

                string ledgerCode = !string.IsNullOrWhiteSpace(ledger.LedgerCode) ? ledger.LedgerCode.Trim() : ledger.LedgerID.ToString();

                var node = new ReportNodeDto
                {
                    Id = ledger.LedgerID,
                    Name = ledger.LedgerName,
                    Code = ledgerCode,
                    IsGroup = false,
                    Amount = netBal,
                    PreviousYearAmount = prevNetBal,
                    OpeningBalance = openingBal,
                    OpeningType = openingType,
                    TotalDebit = totalDr,
                    TotalCredit = totalCr,
                    ClosingBalance = netBal,
                    Children = new List<ReportNodeDto>()
                };
                if (!ledgersByGroupId.ContainsKey(ledger.GroupID))
                    ledgersByGroupId[ledger.GroupID] = new List<ReportNodeDto>();
                ledgersByGroupId[ledger.GroupID].Add(node);
            }

            // Determine Section Groups:
            // 1. Find all root groups for this nature
            var candidateRootGroups = groups
                .Where(g => (g.ParentGroupID == null || !groups.Any(p => p.GroupID == g.ParentGroupID)) && NormalizeNature(g.NatureOfGroup) == targetNature)
                .ToList();

            var sectionGroups = new List<AccountGroup>();

            foreach (var root in candidateRootGroups)
            {
                var directChildren = groups.Where(g => g.ParentGroupID == root.GroupID).ToList();
                string gName = root.GroupName?.Trim() ?? "";
                bool isGenericUmbrella = gName.Contains("भांडवल व देणी") || gName.Contains("देयता") || gName.Contains("Liabilities") ||
                                         gName.Contains("मालमत्ता व येणी") || gName.Contains("जिंदगी") || gName.Contains("Assets") ||
                                         gName.Contains("उत्पन्न") || gName.Contains("Income") || gName.Contains("खर्च") || gName.Contains("Expenses");

                // If root group is generic container and has child section groups, expand its direct children as section groups
                if (isGenericUmbrella && directChildren.Count > 0)
                {
                    sectionGroups.AddRange(directChildren);
                }
                else
                {
                    sectionGroups.Add(root);
                }
            }

            // Order section groups by DisplayOrder, then GroupCode, then GroupID
            var sortedSectionGroups = sectionGroups
                .OrderBy(g => g.DisplayOrder)
                .ThenBy(g => g.GroupCode, new AlphanumericComparer())
                .ThenBy(g => g.GroupID)
                .ToList();

            var result = new List<ReportNodeDto>();

            foreach (var group in sortedSectionGroups)
            {
                var rootNode = new ReportNodeDto
                {
                    Id = group.GroupID,
                    Name = group.GroupName,
                    Code = group.GroupCode,
                    DisplayOrder = group.DisplayOrder,
                    IsGroup = true
                };

                // Get all child ledgers directly under this section group and its sub-groups (flattened pure accounts)
                var allAccounts = GetAllLedgerNodesUnderGroup(group, groups, ledgersByGroupId);
                
                // Filter out accounts that have 0 balance and 0 transactions in both current and previous years
                var activeAccounts = allAccounts
                    .Where(a => Math.Abs(a.Amount) >= 0.01m || Math.Abs(a.PreviousYearAmount) >= 0.01m || Math.Abs(a.OpeningBalance) >= 0.01m || a.TotalDebit >= 0.01m || a.TotalCredit >= 0.01m)
                    .ToList();

                rootNode.Children.AddRange(activeAccounts);
                rootNode.Amount = activeAccounts.Sum(c => c.Amount);
                rootNode.PreviousYearAmount = activeAccounts.Sum(c => c.PreviousYearAmount);
                rootNode.OpeningBalance = activeAccounts.Sum(c => c.OpeningBalance);

                // Only include group if it has active accounts or non-zero total
                if (activeAccounts.Count > 0 || Math.Abs(rootNode.Amount) >= 0.01m || Math.Abs(rootNode.PreviousYearAmount) >= 0.01m)
                {
                    result.Add(rootNode);
                }
            }

            return result;
        }

        private List<ReportNodeDto> GetAllLedgerNodesUnderGroup(AccountGroup group, List<AccountGroup> allGroups, Dictionary<int, List<ReportNodeDto>> ledgersByGroupId)
        {
            var list = new List<ReportNodeDto>();
            if (ledgersByGroupId.ContainsKey(group.GroupID))
            {
                list.AddRange(ledgersByGroupId[group.GroupID]);
            }

            var subGroups = allGroups.Where(g => g.ParentGroupID == group.GroupID)
                .OrderBy(g => g.DisplayOrder)
                .ThenBy(g => g.GroupCode, new AlphanumericComparer())
                .ThenBy(g => g.GroupID)
                .ToList();

            foreach (var sub in subGroups)
            {
                list.AddRange(GetAllLedgerNodesUnderGroup(sub, allGroups, ledgersByGroupId));
            }

            return list
                .OrderBy(l => l.Code, new AlphanumericComparer())
                .ThenBy(l => l.Name)
                .ToList();
        }

        // GET: api/Reports/ProfitAndLoss
        [HttpGet("ProfitAndLoss")]
        public async Task<ActionResult<ProfitAndLossDto>> GetProfitAndLoss([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            var dto = new ProfitAndLossDto();
            
            dto.Expenses = await BuildReportNodes("Expenses", fromDate, toDate, branchId);
            dto.Incomes = await BuildReportNodes("Income", fromDate, toDate, branchId);

            dto.TotalExpense = dto.Expenses.Sum(e => e.Amount);
            dto.TotalIncome = dto.Incomes.Sum(i => i.Amount);
            dto.TotalPreviousYearExpense = dto.Expenses.Sum(e => e.PreviousYearAmount);
            dto.TotalPreviousYearIncome = dto.Incomes.Sum(i => i.PreviousYearAmount);

            if (dto.TotalIncome > dto.TotalExpense)
            {
                dto.NetProfit = dto.TotalIncome - dto.TotalExpense;
            }
            else
            {
                dto.NetLoss = dto.TotalExpense - dto.TotalIncome;
            }

            if (dto.TotalPreviousYearIncome > dto.TotalPreviousYearExpense)
            {
                dto.PreviousYearNetProfit = dto.TotalPreviousYearIncome - dto.TotalPreviousYearExpense;
            }
            else
            {
                dto.PreviousYearNetLoss = dto.TotalPreviousYearExpense - dto.TotalPreviousYearIncome;
            }

            dto.PreviousYearLabel = fromDate.HasValue ? fromDate.Value.AddDays(-1).ToString("dd/MM/yyyy") : "मागील वर्ष";
            dto.CurrentYearLabel = toDate.HasValue ? toDate.Value.ToString("dd/MM/yyyy") : "चालू वर्ष";

            return dto;
        }

        // GET: api/Reports/BalanceSheet
        [HttpGet("BalanceSheet")]
        public async Task<ActionResult<BalanceSheetDto>> GetBalanceSheet([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            var dto = new BalanceSheetDto();
            
            dto.Liabilities = await BuildReportNodes("Liabilities", fromDate, toDate, branchId);
            dto.Assets = await BuildReportNodes("Assets", fromDate, toDate, branchId);

            dto.TotalLiabilities = dto.Liabilities.Sum(l => l.Amount);
            dto.TotalAssets = dto.Assets.Sum(a => a.Amount);
            dto.TotalPreviousYearLiabilities = dto.Liabilities.Sum(l => l.PreviousYearAmount);
            dto.TotalPreviousYearAssets = dto.Assets.Sum(a => a.PreviousYearAmount);

            // Add Net Profit/Loss
            var pnlDto = await GetProfitAndLoss(fromDate, toDate, branchId);
            var pnl = pnlDto.Value;
            if (pnl != null)
            {
                if (pnl.NetProfit > 0 || pnl.PreviousYearNetProfit > 0)
                {
                    dto.Liabilities.Add(new ReportNodeDto 
                    { 
                        Name = "निव्वळ नफा (Net Profit)", 
                        Amount = pnl.NetProfit, 
                        PreviousYearAmount = pnl.PreviousYearNetProfit, 
                        IsGroup = true 
                    });
                    dto.TotalLiabilities += pnl.NetProfit;
                    dto.TotalPreviousYearLiabilities += pnl.PreviousYearNetProfit;
                }
                if (pnl.NetLoss > 0 || pnl.PreviousYearNetLoss > 0)
                {
                    dto.Assets.Add(new ReportNodeDto 
                    { 
                        Name = "निव्वळ तोटा (Net Loss)", 
                        Amount = pnl.NetLoss, 
                        PreviousYearAmount = pnl.PreviousYearNetLoss, 
                        IsGroup = true 
                    });
                    dto.TotalAssets += pnl.NetLoss;
                    dto.TotalPreviousYearAssets += pnl.PreviousYearNetLoss;
                }
            }

            dto.PreviousYearLabel = fromDate.HasValue ? fromDate.Value.AddDays(-1).ToString("dd/MM/yyyy") : "मागील वर्ष";
            dto.CurrentYearLabel = toDate.HasValue ? toDate.Value.ToString("dd/MM/yyyy") : "चालू वर्ष";

            return dto;
        }

        // GET: api/Reports/GeneralLedger
        [HttpGet("GeneralLedger")]
        public async Task<ActionResult<GeneralLedgerDto>> GetGeneralLedger([FromQuery] int ledgerId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            var ledger = await _context.Ledgers.FindAsync(ledgerId);
            if (ledger == null) return NotFound();

            var dto = new GeneralLedgerDto
            {
                LedgerName = ledger.LedgerName
            };

            // Calculate opening balance up to fromDate
            decimal openingDr = ledger.OpeningBalanceType == "Dr" ? ledger.OpeningBalance : 0;
            decimal openingCr = ledger.OpeningBalanceType == "Cr" ? ledger.OpeningBalance : 0;

            var allVdsQuery = _context.VoucherDetails.Include(vd => vd.Voucher)
                                       .Where(vd => vd.LedgerID == ledgerId && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled");
            if (branchId.HasValue)
            {
                allVdsQuery = allVdsQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
            }
            var allVds = await allVdsQuery
                                       .OrderBy(vd => vd.Voucher!.VoucherDate)
                                       .ThenBy(vd => vd.VoucherID)
                                       .ToListAsync();

            if (fromDate.HasValue)
            {
                var pastVds = allVds.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate < fromDate.Value).ToList();
                openingDr += pastVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                openingCr += pastVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);
            }

            if (openingDr > openingCr)
            {
                dto.OpeningBalance = openingDr - openingCr;
                dto.OpeningType = "Dr";
            }
            else if (openingCr > openingDr)
            {
                dto.OpeningBalance = openingCr - openingDr;
                dto.OpeningType = "Cr";
            }
            else
            {
                dto.OpeningBalance = 0;
                dto.OpeningType = "";
            }

            // Current transactions
            var currentVds = allVds.AsEnumerable();
            if (fromDate.HasValue) currentVds = currentVds.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate >= fromDate.Value);
            if (toDate.HasValue) 
            {
                var toDateEnd = toDate.Value.Date.AddDays(1).AddTicks(-1);
                currentVds = currentVds.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate <= toDateEnd);
            }

            decimal runningBalDr = dto.OpeningType == "Dr" ? dto.OpeningBalance : 0;
            decimal runningBalCr = dto.OpeningType == "Cr" ? dto.OpeningBalance : 0;

            foreach (var vd in currentVds)
            {
                var trans = new GeneralLedgerTransactionDto
                {
                    Date = vd.Voucher?.VoucherDate ?? DateTime.MinValue,
                    VoucherNo = vd.Voucher?.VoucherNo ?? "",
                    VoucherType = vd.Voucher?.VoucherType ?? "",
                    Narration = vd.Voucher?.Narration ?? "",
                    Debit = vd.DrCr == "Dr" ? vd.Amount : 0,
                    Credit = vd.DrCr == "Cr" ? vd.Amount : 0
                };

                dto.TotalDebit += trans.Debit;
                dto.TotalCredit += trans.Credit;

                runningBalDr += trans.Debit;
                runningBalCr += trans.Credit;

                if (runningBalDr > runningBalCr)
                {
                    trans.Balance = runningBalDr - runningBalCr;
                    trans.BalanceType = "Dr";
                }
                else if (runningBalCr > runningBalDr)
                {
                    trans.Balance = runningBalCr - runningBalDr;
                    trans.BalanceType = "Cr";
                }
                else
                {
                    trans.Balance = 0;
                    trans.BalanceType = "";
                }

                dto.Transactions.Add(trans);
            }

            if (runningBalDr > runningBalCr)
            {
                dto.ClosingBalance = runningBalDr - runningBalCr;
                dto.ClosingType = "Dr";
            }
            else if (runningBalCr > runningBalDr)
            {
                dto.ClosingBalance = runningBalCr - runningBalDr;
                dto.ClosingType = "Cr";
            }
            else
            {
                dto.ClosingBalance = 0;
                dto.ClosingType = "";
            }

            return dto;
        }

        // GET: api/Reports/CashBookBatch
        [HttpGet("CashBookBatch")]
        public async Task<ActionResult<CashBookBatchResponseDto>> GetCashBookBatch([FromQuery] DateTime date, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            DateTime rangeStart = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
            DateTime rangeEnd = DateTime.SpecifyKind(toDate.HasValue ? toDate.Value.Date.AddDays(1).AddTicks(-1) : date.Date.AddDays(1).AddTicks(-1), DateTimeKind.Unspecified);

            var ledgers = await _context.Ledgers.AsNoTracking().Include(l => l.AccountGroup).ToListAsync();
            var cashLedgerIds = await Helpers.CashLedgerHelper.GetCashLedgerIdsForBranchAsync(_context, branchId);

            decimal baseOpeningDr = 0;
            decimal baseOpeningCr = 0;

            var cashLedgersList = ledgers.Where(l => cashLedgerIds.Contains(l.LedgerID)).ToList();
            foreach (var cl in cashLedgersList)
            {
                if (cl.OpeningBalanceType == "Dr") baseOpeningDr += cl.OpeningBalance;
                if (cl.OpeningBalanceType == "Cr") baseOpeningCr += cl.OpeningBalance;
            }

            if (cashLedgerIds.Count > 0)
            {
                var priorDrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Dr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < rangeStart);
                var priorCrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Cr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < rangeStart);

                if (branchId.HasValue)
                {
                    priorDrQuery = priorDrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                    priorCrQuery = priorCrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                }

                baseOpeningDr += await priorDrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
                baseOpeningCr += await priorCrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
            }

            var vouchersQuery = _context.Vouchers.AsNoTracking()
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Member)
                .Where(v => (v.Status == "Approved" || string.IsNullOrEmpty(v.Status) || v.Status == "Posted") && v.Status != "Rejected" && v.Status != "Cancelled" && v.VoucherDate >= rangeStart && v.VoucherDate <= rangeEnd);

            if (branchId.HasValue)
            {
                vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
            }

            var allVouchers = await vouchersQuery.ToListAsync();

            var vouchersByDate = allVouchers
                .GroupBy(v => v.VoucherDate.Date)
                .ToDictionary(g => g.Key, g => g.ToList());

            var batchResponse = new CashBookBatchResponseDto();
            decimal runningDr = baseOpeningDr;
            decimal runningCr = baseOpeningCr;

            for (var currentDate = rangeStart.Date; currentDate <= rangeEnd.Date; currentDate = currentDate.AddDays(1))
            {
                var response = new CashBookResponseDto();

                if (runningDr > runningCr)
                {
                    response.OpeningBalance = runningDr - runningCr;
                    response.OpeningType = "Dr";
                }
                else if (runningCr > runningDr)
                {
                    response.OpeningBalance = runningCr - runningDr;
                    response.OpeningType = "Cr";
                }
                else
                {
                    response.OpeningBalance = 0;
                    response.OpeningType = "";
                }

                var receiptsDict = new Dictionary<int, CashBookGroupDto>();
                var paymentsDict = new Dictionary<int, CashBookGroupDto>();

                if (vouchersByDate.TryGetValue(currentDate, out var dayVouchers))
                {
                    foreach (var v in dayVouchers)
                    {
                        var cashDetail = v.VoucherDetails.FirstOrDefault(vd => cashLedgerIds.Contains(vd.LedgerID));
                        if (cashDetail == null) continue;

                        bool isReceipt = cashDetail.DrCr == "Dr";
                        var targetDict = isReceipt ? receiptsDict : paymentsDict;

                        foreach (var vd in v.VoucherDetails)
                        {
                            if (cashLedgerIds.Contains(vd.LedgerID)) continue;

                            if (isReceipt && vd.DrCr != "Cr") continue;
                            if (!isReceipt && vd.DrCr != "Dr") continue;

                            if (!targetDict.ContainsKey(vd.LedgerID))
                            {
                                targetDict[vd.LedgerID] = new CashBookGroupDto
                                {
                                    LedgerId = vd.LedgerID,
                                    LedgerName = vd.Ledger?.LedgerName ?? "Unknown"
                                };
                            }

                            var group = targetDict[vd.LedgerID];

                            string details = "";
                            if (vd.Member != null)
                            {
                                details = $"{vd.Member.MemberCode}-{vd.Member.FirstName} {vd.Member.LastName}";
                            }
                            else
                            {
                                details = string.IsNullOrWhiteSpace(v.Narration) ? (vd.Ledger?.LedgerName ?? "") : v.Narration;
                            }

                            var entry = new CashBookEntryDto
                            {
                                VoucherNo = v.VoucherNo ?? "",
                                Details = details,
                                Amount = vd.Amount
                            };

                            group.Entries.Add(entry);
                            group.TotalAmount += entry.Amount;
                        }
                    }
                }

                response.Receipts = receiptsDict.Values.OrderBy(g => g.LedgerId).ToList();
                response.Payments = paymentsDict.Values.OrderBy(g => g.LedgerId).ToList();

                response.TotalReceipts = response.Receipts.Sum(g => g.TotalAmount);
                response.TotalPayments = response.Payments.Sum(g => g.TotalAmount);

                runningDr += response.TotalReceipts;
                runningCr += response.TotalPayments;

                if (runningDr > runningCr)
                {
                    response.ClosingBalance = runningDr - runningCr;
                    response.ClosingType = "Dr";
                }
                else if (runningCr > runningDr)
                {
                    response.ClosingBalance = runningCr - runningDr;
                    response.ClosingType = "Cr";
                }
                else
                {
                    response.ClosingBalance = 0;
                    response.ClosingType = "";
                }

                bool hasTransactions = response.Receipts.Count > 0 || response.Payments.Count > 0;
                if (hasTransactions || rangeStart.Date == rangeEnd.Date)
                {
                    batchResponse.Days.Add(new CashBookDayDto
                    {
                        Date = currentDate.ToString("yyyy-MM-dd"),
                        Data = response
                    });
                }
            }

            return Ok(batchResponse);
        }

        // GET: api/Reports/CashBook
        [HttpGet("CashBook")]
        public async Task<ActionResult<CashBookResponseDto>> GetCashBook([FromQuery] DateTime date, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            DateTime startDate = DateTime.SpecifyKind(date.Date, DateTimeKind.Unspecified);
            DateTime endDate = DateTime.SpecifyKind(toDate.HasValue ? toDate.Value.Date.AddDays(1).AddTicks(-1) : date.Date.AddDays(1).AddTicks(-1), DateTimeKind.Unspecified);

            var ledgers = await _context.Ledgers.AsNoTracking().Include(l => l.AccountGroup).ToListAsync();
            var cashLedgerIds = await Helpers.CashLedgerHelper.GetCashLedgerIdsForBranchAsync(_context, branchId);

            decimal openingDr = 0;
            decimal openingCr = 0;

            var cashLedgersList = ledgers.Where(l => cashLedgerIds.Contains(l.LedgerID)).ToList();
            foreach (var cl in cashLedgersList)
            {
                if (cl.OpeningBalanceType == "Dr") openingDr += cl.OpeningBalance;
                if (cl.OpeningBalanceType == "Cr") openingCr += cl.OpeningBalance;
            }

            if (cashLedgerIds.Count > 0)
            {
                var priorDrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Dr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < startDate);
                var priorCrQuery = _context.VoucherDetails.AsNoTracking()
                    .Where(vd => cashLedgerIds.Contains(vd.LedgerID) && vd.DrCr == "Cr" && vd.Voucher != null && (vd.Voucher.Status == "Approved" || string.IsNullOrEmpty(vd.Voucher.Status) || vd.Voucher.Status == "Posted") && vd.Voucher.Status != "Rejected" && vd.Voucher.Status != "Cancelled" && vd.Voucher.VoucherDate < startDate);
                if (branchId.HasValue)
                {
                    priorDrQuery = priorDrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                    priorCrQuery = priorCrQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
                }

                openingDr += await priorDrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
                openingCr += await priorCrQuery.SumAsync(vd => (decimal?)vd.Amount) ?? 0m;
            }

            var response = new CashBookResponseDto();

            if (openingDr > openingCr)
            {
                response.OpeningBalance = openingDr - openingCr;
                response.OpeningType = "Dr";
            }
            else if (openingCr > openingDr)
            {
                response.OpeningBalance = openingCr - openingDr;
                response.OpeningType = "Cr";
            }
            else
            {
                response.OpeningBalance = 0;
                response.OpeningType = "";
            }

            var vouchersQuery = _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Member)
                .Where(v => (v.Status == "Approved" || string.IsNullOrEmpty(v.Status) || v.Status == "Posted") && v.Status != "Rejected" && v.Status != "Cancelled" && v.VoucherDate >= startDate && v.VoucherDate <= endDate);
            if (branchId.HasValue)
            {
                vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
            }
            var vouchers = await vouchersQuery.ToListAsync();

            var receiptsDict = new Dictionary<int, CashBookGroupDto>();
            var paymentsDict = new Dictionary<int, CashBookGroupDto>();

            foreach (var v in vouchers)
            {
                var cashDetail = v.VoucherDetails.FirstOrDefault(vd => cashLedgerIds.Contains(vd.LedgerID));
                if (cashDetail == null) continue; // Not a cash transaction

                bool isReceipt = cashDetail.DrCr == "Dr";
                var targetDict = isReceipt ? receiptsDict : paymentsDict;

                foreach (var vd in v.VoucherDetails)
                {
                    if (cashLedgerIds.Contains(vd.LedgerID)) continue;

                    // Only consider the opposite side of the cash entry
                    if (isReceipt && vd.DrCr != "Cr") continue;
                    if (!isReceipt && vd.DrCr != "Dr") continue;

                    if (!targetDict.ContainsKey(vd.LedgerID))
                    {
                        targetDict[vd.LedgerID] = new CashBookGroupDto
                        {
                            LedgerId = vd.LedgerID,
                            LedgerName = vd.Ledger?.LedgerName ?? "Unknown"
                        };
                    }

                    var group = targetDict[vd.LedgerID];

                    string details = "";
                    if (vd.Member != null)
                    {
                        details = $"{vd.Member.MemberCode}-{vd.Member.FirstName} {vd.Member.LastName}";
                    }
                    else
                    {
                        details = string.IsNullOrWhiteSpace(v.Narration) ? (vd.Ledger?.LedgerName ?? "") : v.Narration;
                    }

                    var entry = new CashBookEntryDto
                    {
                        VoucherNo = v.VoucherNo ?? "",
                        Details = details,
                        Amount = vd.Amount
                    };

                    group.Entries.Add(entry);
                    group.TotalAmount += entry.Amount;
                }
            }

            response.Receipts = receiptsDict.Values.OrderBy(g => g.LedgerId).ToList();
            response.Payments = paymentsDict.Values.OrderBy(g => g.LedgerId).ToList();

            response.TotalReceipts = response.Receipts.Sum(g => g.TotalAmount);
            response.TotalPayments = response.Payments.Sum(g => g.TotalAmount);

            decimal runningBalDr = response.OpeningType == "Dr" ? response.OpeningBalance : 0;
            decimal runningBalCr = response.OpeningType == "Cr" ? response.OpeningBalance : 0;

            runningBalDr += response.TotalReceipts;
            runningBalCr += response.TotalPayments;

            if (runningBalDr > runningBalCr)
            {
                response.ClosingBalance = runningBalDr - runningBalCr;
                response.ClosingType = "Dr";
            }
            else if (runningBalCr > runningBalDr)
            {
                response.ClosingBalance = runningBalCr - runningBalDr;
                response.ClosingType = "Cr";
            }
            else
            {
                response.ClosingBalance = 0;
                response.ClosingType = "";
            }

            return Ok(response);
        }

        // GET: api/Reports/MemberBalances
        [HttpGet("MemberBalances")]
        public async Task<ActionResult<IEnumerable<MemberBalanceReportDto>>> GetMemberBalances([FromQuery] int ledgerId, [FromQuery] DateTime? asOfDate, [FromQuery] int? branchId)
        {
            var targetLedger = await _context.Ledgers.FindAsync(ledgerId);
            bool isShareLedger = targetLedger != null && (
                targetLedger.AccountType == "Share Capital" || 
                targetLedger.LedgerName.Contains("भाग") || 
                targetLedger.LedgerName.Contains("शेअर्स") ||
                targetLedger.LedgerName.ToLower().Contains("share")
            );

            var membersQuery = _context.Members.Include(m => m.Customer).AsQueryable();
            if (branchId.HasValue)
            {
                membersQuery = membersQuery.Where(m => m.BranchID == branchId.Value);
            }
            var members = await membersQuery.ToListAsync();
            
            // Get opening balances for this ledger
            var openingBalances = await _context.MemberOpeningBalances
                .Where(m => m.LedgerID == ledgerId)
                .ToDictionaryAsync(m => m.MemberID);

            // Get all voucher details for this ledger up to asOfDate
            var query = _context.VoucherDetails.Include(vd => vd.Voucher)
                .Where(vd => vd.LedgerID == ledgerId && vd.MemberID != null);
                
            if (asOfDate.HasValue)
            {
                var dateEnd = asOfDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate <= dateEnd);
            }
            if (branchId.HasValue)
            {
                query = query.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
            }
            
            var voucherDetails = await query.ToListAsync();

            // For share capital ledgers, check active share accounts for self-healing
            var activeShareMemberIds = isShareLedger 
                ? await _context.ShareAccounts.Where(s => s.TotalShareCount > 0).Select(s => s.MemberId).ToHashSetAsync()
                : null;
            
            var result = new List<MemberBalanceReportDto>();
            var orphanMobsToRemove = new List<MemberOpeningBalance>();
            
            foreach(var member in members)
            {
                decimal opAmt = 0;
                string opType = "Dr";
                if (openingBalances.TryGetValue(member.MemberID, out var opBal))
                {
                    // Self-healing check: if this is a share capital ledger, and member has no share account and no vouchers, this is an orphan leftover
                    if (isShareLedger && activeShareMemberIds != null && !activeShareMemberIds.Contains(member.MemberID))
                    {
                        var hasVouchers = voucherDetails.Any(vd => vd.MemberID == member.MemberID);
                        if (!hasVouchers)
                        {
                            orphanMobsToRemove.Add(opBal);
                            continue; // Skip orphan member from report
                        }
                    }

                    opAmt = opBal.Amount;
                    opType = opBal.BalanceType;
                }
                
                var drSum = voucherDetails.Where(vd => vd.MemberID == member.MemberID && vd.DrCr == "Dr").Sum(vd => vd.Amount);
                var crSum = voucherDetails.Where(vd => vd.MemberID == member.MemberID && vd.DrCr == "Cr").Sum(vd => vd.Amount);
                
                // standard accounting logic: positive = Dr, negative = Cr
                decimal netBal = (opType == "Dr" ? opAmt : -opAmt) + drSum - crSum;
                
                // Only include if they have a non-zero balance
                if (netBal != 0)
                {
                    result.Add(new MemberBalanceReportDto
                    {
                        MemberId = member.MemberID,
                        MemberCode = member.MemberCode ?? "",
                        LegacyMemberNo = member.LegacyMemberNo ?? "",
                        CIFNo = member.CIFNo ?? "",
                        MemberName = string.Join(" ", new[] { member.FirstName, member.MiddleName, member.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim(),
                        Balance = Math.Abs(netBal),
                        BalanceType = netBal > 0 ? "Dr" : "Cr"
                    });
                }
            }

            // Cleanup any detected orphan MemberOpeningBalances in background
            if (orphanMobsToRemove.Any())
            {
                try
                {
                    _context.MemberOpeningBalances.RemoveRange(orphanMobsToRemove);
                    if (targetLedger != null)
                    {
                        decimal removedTotal = orphanMobsToRemove.Sum(o => o.Amount);
                        if (targetLedger.OpeningBalanceType == "Cr")
                        {
                            targetLedger.OpeningBalance -= removedTotal;
                            if (targetLedger.OpeningBalance < 0)
                            {
                                targetLedger.OpeningBalance = Math.Abs(targetLedger.OpeningBalance);
                                targetLedger.OpeningBalanceType = "Dr";
                            }
                        }
                        else
                        {
                            targetLedger.OpeningBalance += removedTotal;
                        }
                    }
                    await _context.SaveChangesAsync();
                }
                catch { }
            }
            
            // Return sorted by member code or ID
            return Ok(result.OrderBy(r => r.MemberCode).ToList());
        }

        [HttpGet("LoanDisbursementRegister")]
        public async Task<ActionResult<IEnumerable<LoanDisbursementRegisterDto>>> GetLoanDisbursementRegister([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            var query = _context.LoanDisbursements
                .Include(d => d.LoanAccount!)
                    .ThenInclude(a => a!.Customer)
                .Include(d => d.LoanAccount!)
                    .ThenInclude(a => a!.Member)
                .Include(d => d.LoanAccount!)
                    .ThenInclude(a => a!.Guarantor1Member)
                .Include(d => d.LoanAccount!)
                    .ThenInclude(a => a!.Guarantor2Member)
                .Include(d => d.LoanAccount!)
                    .ThenInclude(a => a!.LoanRate)
                .AsQueryable();

            if (fromDate.HasValue)
                query = query.Where(d => d.DisbursementDate >= fromDate.Value.Date);
            
            if (toDate.HasValue)
            {
                var toDateEnd = toDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(d => d.DisbursementDate <= toDateEnd);
            }
            if (branchId.HasValue)
            {
                query = query.Where(d => d.LoanAccount != null && d.LoanAccount.BranchID == branchId.Value);
            }

            var disbursements = await query.OrderBy(d => d.DisbursementDate).ThenBy(d => d.LoanDisbursementID).ToListAsync();

            var resultList = disbursements.Select(d =>
            {
                var acc = d.LoanAccount;
                var cust = acc?.Customer;
                var mem = acc?.Member;
                string bName = cust != null
                    ? string.Join(" ", new[] { cust.FirstName, cust.MiddleName, cust.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim()
                    : (mem != null ? string.Join(" ", new[] { mem.FirstName, mem.MiddleName, mem.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim() : "");
                string cif = cust?.CIFNo ?? mem?.CIFNo ?? "";
                string mCode = mem?.MemberCode ?? "";

                return new LoanDisbursementRegisterDto
                {
                    LoanDisbursementID = d.LoanDisbursementID,
                    DisbursementDate = d.DisbursementDate,
                    LoanAccountNo = acc?.LoanAccountNo ?? "",
                    CifNo = cif,
                    MemberCode = mCode,
                    BorrowerName = bName,
                    LoanType = !string.IsNullOrWhiteSpace(acc?.LoanRate?.ShortName) ? acc.LoanRate.ShortName : (acc?.LoanRate?.LoanType ?? ""),
                    SanctionedAmount = d.SanctionedAmount,
                    ShareDeduction = d.ShareDeduction,
                    DepositDeduction = 0,
                    OtherDeductions = d.ProcessingFee + d.InsuranceDeduction + d.StationeryCharges + d.OtherDeductions,
                    NetAmountPaid = d.NetAmountPaid,
                    Guarantor1Name = acc?.Guarantor1Member != null ? string.Join(" ", new[] { acc.Guarantor1Member.FirstName, acc.Guarantor1Member.MiddleName, acc.Guarantor1Member.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim() : "",
                    Guarantor2Name = acc?.Guarantor2Member != null ? string.Join(" ", new[] { acc.Guarantor2Member.FirstName, acc.Guarantor2Member.MiddleName, acc.Guarantor2Member.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim() : ""
                };
            });

            return Ok(resultList);
        }

        [HttpGet("LoanCollectionRegister")]
        public async Task<ActionResult<IEnumerable<LoanCollectionRegisterDto>>> GetLoanCollectionRegister([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? branchId)
        {
            var query = _context.LoanCollections
                .Include(c => c.LoanAccount!)
                    .ThenInclude(a => a!.Customer)
                .Include(c => c.LoanAccount!)
                    .ThenInclude(a => a!.Member)
                .Include(c => c.LoanAccount!)
                    .ThenInclude(a => a!.LoanRate)
                .AsQueryable();

            if (fromDate.HasValue)
                query = query.Where(c => c.CollectionDate >= fromDate.Value.Date);
            
            if (toDate.HasValue)
            {
                var toDateEnd = toDate.Value.Date.AddDays(1).AddTicks(-1);
                query = query.Where(c => c.CollectionDate <= toDateEnd);
            }
            if (branchId.HasValue)
            {
                query = query.Where(c => c.LoanAccount != null && c.LoanAccount.BranchID == branchId.Value);
            }

            var collections = await query.OrderBy(c => c.CollectionDate).ThenBy(c => c.LoanCollectionID).ToListAsync();

            var resultList = collections.Select(c =>
            {
                var acc = c.LoanAccount;
                var cust = acc?.Customer;
                var mem = acc?.Member;
                string mName = cust != null
                    ? string.Join(" ", new[] { cust.FirstName, cust.MiddleName, cust.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim()
                    : (mem != null ? string.Join(" ", new[] { mem.FirstName, mem.MiddleName, mem.LastName }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim() : "");
                string cif = cust?.CIFNo ?? mem?.CIFNo ?? "";
                string mCode = mem?.MemberCode ?? "";

                return new LoanCollectionRegisterDto
                {
                    LoanCollectionID = c.LoanCollectionID,
                    CollectionDate = c.CollectionDate,
                    ReceiptNo = c.ReceiptNo ?? "",
                    LoanAccountNo = acc?.LoanAccountNo ?? "",
                    CifNo = cif,
                    MemberCode = mCode,
                    MemberName = mName,
                    LoanType = !string.IsNullOrWhiteSpace(acc?.LoanRate?.ShortName) ? acc.LoanRate.ShortName : (acc?.LoanRate?.LoanType ?? ""),
                    PrincipalCollected = c.PrincipalCollected,
                    InterestCollected = c.InterestCollected,
                    PenaltyInterestCollected = c.PenaltyInterestCollected,
                    SurchargeCollected = c.SurchargeCollected,
                    TotalAmountReceived = c.TotalAmountReceived,
                    PaymentMode = c.PaymentMode
                };
            });

            return Ok(resultList);
        }

        // GET: api/Reports/LoanLedger?loanAccountId=1&fromDate=2024-04-01&toDate=2025-03-31
        [HttpGet("LoanLedger")]
        public async Task<ActionResult<LoanLedgerReportDto>> GetLoanLedger([FromQuery] int loanAccountId, [FromQuery] DateTime fromDate, [FromQuery] DateTime toDate)
        {
            try
            {
                var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
                var loanAccount = await _context.LoanAccounts
                    .Include(la => la.Customer)
                    .Include(la => la.Member)
                    .Include(la => la.LoanRate)
                    .FirstOrDefaultAsync(la => la.LoanAccountID == loanAccountId);

                if (loanAccount == null) return NotFound("Loan Account not found");

                var cust = loanAccount.Customer;
                var mem = loanAccount.Member;
                string bName = cust != null
                    ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Trim()
                    : (mem != null ? $"{mem.FirstName} {mem.MiddleName} {mem.LastName}".Trim() : "");
                string aadhaar = cust?.AadhaarNo ?? mem?.AadhaarNo ?? "";
                string pan = cust?.PANNo ?? mem?.PANNo ?? "";
                string cif = cust?.CIFNo ?? mem?.CIFNo ?? "";

                var report = new LoanLedgerReportDto
                {
                    SansthaInfo = sanstha,
                    LoanType = !string.IsNullOrWhiteSpace(loanAccount.LoanRate?.ShortName) ? loanAccount.LoanRate.ShortName : (loanAccount.LoanRate?.LoanType ?? ""),
                    LoanAccountNo = loanAccount.LoanAccountNo ?? "",
                    Status = loanAccount.Status,
                    SanctionedAmount = loanAccount.SanctionedAmount,
                    MemberName = bName,
                    InterestRate = loanAccount.InterestRate,
                    DisbursementDate = loanAccount.LoanDisbursementDate,
                    InstallmentAmount = loanAccount.InstallmentAmount,
                    AadhaarNo = aadhaar,
                    PanNo = pan,
                    CifNo = cif,
                    MaturityDate = loanAccount.MaturityDate,
                    DurationMonths = loanAccount.DurationMonths,
                    OverdueAmount = loanAccount.OverdueInterestBalance,
                };

                // Guarantors
                if (loanAccount.Guarantor1CustomerID.HasValue && loanAccount.Guarantor1CustomerID.Value > 0)
                {
                    var gc1 = await _context.Customers.FindAsync(loanAccount.Guarantor1CustomerID.Value);
                    if (gc1 != null) report.Guarantors.Add(new LoanLedgerGuarantorDto { Name = $"{gc1.FirstName} {gc1.LastName}".Trim() });
                }
                else if (loanAccount.Guarantor1MemberID.HasValue && loanAccount.Guarantor1MemberID.Value > 0)
                {
                    var g1 = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == loanAccount.Guarantor1MemberID);
                    if (g1 != null) report.Guarantors.Add(new LoanLedgerGuarantorDto { Name = $"{g1.FirstName} {g1.LastName}".Trim() });
                }

                if (loanAccount.Guarantor2CustomerID.HasValue && loanAccount.Guarantor2CustomerID.Value > 0)
                {
                    var gc2 = await _context.Customers.FindAsync(loanAccount.Guarantor2CustomerID.Value);
                    if (gc2 != null) report.Guarantors.Add(new LoanLedgerGuarantorDto { Name = $"{gc2.FirstName} {gc2.LastName}".Trim() });
                }
                else if (loanAccount.Guarantor2MemberID.HasValue && loanAccount.Guarantor2MemberID.Value > 0)
                {
                    var g2 = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == loanAccount.Guarantor2MemberID);
                    if (g2 != null) report.Guarantors.Add(new LoanLedgerGuarantorDto { Name = $"{g2.FirstName} {g2.LastName}".Trim() });
                }

                // Fetch transactions
                var transactions = new List<LoanLedgerTransactionDto>();

                decimal sanctionedDisbursement = loanAccount.SanctionedAmount > 0 ? loanAccount.SanctionedAmount : loanAccount.PrincipalBalance;

                // Calculate opening principal balance at OpeningDate by reversing post-opening activity
                var postOpeningCollections = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == loanAccountId && c.CollectionDate > loanAccount.OpeningDate)
                    .SumAsync(c => (decimal?)c.PrincipalCollected) ?? 0;

                var postOpeningDisbursements = await _context.LoanDisbursements
                    .Where(d => d.LoanAccountID == loanAccountId && d.DisbursementDate > loanAccount.OpeningDate)
                    .SumAsync(d => (decimal?)d.DisbursementAmount) ?? 0;

                decimal openingPrincipal = loanAccount.IsOpeningBalance 
                    ? (loanAccount.PrincipalBalance + postOpeningCollections - postOpeningDisbursements)
                    : sanctionedDisbursement;

                // Opening Balance Row
                if (loanAccount.IsOpeningBalance && loanAccount.OpeningDate <= toDate)
                {
                    if (loanAccount.OpeningDate >= fromDate)
                    {
                        transactions.Add(new LoanLedgerTransactionDto
                        {
                            Date = loanAccount.OpeningDate,
                            ReceiptNo = "-",
                            Particulars = "Opening Balance",
                            LoanDisbursement = 0,
                            Balance = openingPrincipal
                        });
                    }
                }

                // Disbursements (For Opening Balance loans, exclude any disbursement on/before OpeningDate to prevent double-counting)
                var disbursementsQuery = _context.LoanDisbursements
                    .Where(d => d.LoanAccountID == loanAccountId 
                             && d.DisbursementDate >= fromDate 
                             && d.DisbursementDate <= toDate);

                if (loanAccount.IsOpeningBalance)
                {
                    disbursementsQuery = disbursementsQuery.Where(d => d.DisbursementDate > loanAccount.OpeningDate);
                }

                var disbursements = await disbursementsQuery.ToListAsync();

                foreach (var d in disbursements)
                {
                    transactions.Add(new LoanLedgerTransactionDto
                    {
                        Date = d.DisbursementDate,
                        ReceiptNo = d.VoucherID?.ToString() ?? "-",
                        Particulars = "Loan Disbursement",
                        LoanDisbursement = d.DisbursementAmount
                    });
                }

                // Collections
                var collections = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == loanAccountId && c.CollectionDate >= fromDate && c.CollectionDate <= toDate)
                    .ToListAsync();

                foreach (var c in collections)
                {
                    transactions.Add(new LoanLedgerTransactionDto
                    {
                        Date = c.CollectionDate,
                        ReceiptNo = c.ReceiptNo ?? "",
                        Particulars = "Loan Collection",
                        PrincipalDeposit = c.PrincipalCollected,
                        Interest = c.InterestCollected,
                        PenalInterest = c.PenaltyInterestCollected,
                        Total = c.TotalAmountReceived
                    });
                }

                // Sort by Date
                transactions = transactions
                    .OrderBy(t => t.Date)
                    .ThenBy(t => t.Particulars.Contains("Disbursement") || t.Particulars.Contains("Opening Balance") ? 0 : 1)
                    .ToList();

                // Calculate running balance and days
                decimal runningBalance = 0;
                
                if (loanAccount.IsOpeningBalance && loanAccount.OpeningDate < fromDate)
                {
                    runningBalance += openingPrincipal;
                }
                else if (!loanAccount.IsOpeningBalance && loanAccount.LoanDisbursementDate.HasValue && loanAccount.LoanDisbursementDate.Value < fromDate)
                {
                    runningBalance += sanctionedDisbursement;
                }

                var priorDisbursementsQuery = _context.LoanDisbursements
                    .Where(d => d.LoanAccountID == loanAccountId && d.DisbursementDate < fromDate);

                if (loanAccount.IsOpeningBalance)
                {
                    priorDisbursementsQuery = priorDisbursementsQuery.Where(d => d.DisbursementDate > loanAccount.OpeningDate);
                }

                var priorDisbursements = await priorDisbursementsQuery
                    .SumAsync(d => (decimal?)d.DisbursementAmount) ?? 0;

                var priorCollections = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == loanAccountId && c.CollectionDate < fromDate)
                    .SumAsync(c => (decimal?)c.PrincipalCollected) ?? 0;
                    
                runningBalance += priorDisbursements - priorCollections;

                // Add an initial row for previous balance ONLY if there is a positive balance brought forward
                if (runningBalance > 0 && fromDate > loanAccount.OpeningDate)
                {
                    var initialBalanceRow = new LoanLedgerTransactionDto
                    {
                        Date = fromDate.AddDays(-1),
                        Particulars = "मागील शिल्लक (Previous Balance)",
                        LoanDisbursement = 0,
                        Balance = runningBalance
                    };
                    
                    transactions.Insert(0, initialBalanceRow);
                }

                DateTime? priorPaymentDate = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == loanAccountId && c.CollectionDate < fromDate)
                    .OrderByDescending(c => c.CollectionDate)
                    .Select(c => (DateTime?)c.CollectionDate)
                    .FirstOrDefaultAsync();

                DateTime? lastDate = priorPaymentDate ?? loanAccount.LastInstallmentPaidDate ?? loanAccount.LoanDisbursementDate ?? loanAccount.OpeningDate;
                decimal currentBalance = runningBalance;

                for (int i = 0; i < transactions.Count; i++)
                {
                    var t = transactions[i];

                    if (t.Particulars == "मागील शिल्लक (Previous Balance)")
                    {
                        t.Days = 0;
                        // Keep lastDate as the actual prior collection/disbursement date
                    }
                    else if (t.Particulars.Contains("Opening Balance"))
                    {
                        t.Days = 0;
                        currentBalance = t.Balance;
                        lastDate = t.Date;
                    }
                    else if (t.Particulars.Contains("Disbursement"))
                    {
                        t.Days = 0;
                        currentBalance += t.LoanDisbursement;
                        t.Balance = currentBalance;
                        lastDate = t.Date;
                    }
                    else
                    {
                        if (lastDate.HasValue)
                        {
                            t.Days = Math.Max(0, (int)(t.Date.Date - lastDate.Value.Date).TotalDays);
                        }
                        else
                        {
                            t.Days = 0;
                        }

                        currentBalance = currentBalance - t.PrincipalDeposit;
                        if (currentBalance < 0) currentBalance = 0;
                        t.Balance = currentBalance;
                        lastDate = t.Date;
                    }
                }
                
                report.Transactions = transactions;

                // Fetch Schedule
                var schedule = await _context.LoanInstallmentSchedules
                    .Where(s => s.LoanAccountID == loanAccountId)
                    .OrderBy(s => s.InstallmentNo)
                    .ToListAsync();

                report.InstallmentChart = schedule.Select(s => new OpeningBalanceScheduleDto
                {
                    No = s.InstallmentNo,
                    Date = s.DueDate,
                    Principal = s.PrincipalAmount,
                    Interest = s.InterestAmount,
                    Total = s.TotalAmount,
                    Balance = s.BalanceAmount,
                    OpeningBalance = s.OpeningBalance,
                    ClosingBalance = s.ClosingBalance,
                    Days = s.Days,
                    InterestRate = s.InterestRate
                }).ToList();
                
                // Calculate overdue count
                report.OverdueInstallmentCount = schedule.Count(s => s.DueDate < DateTime.Today && s.Status != "Paid");

                return Ok(report);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error in GetLoanLedger: {ex.Message}");
            }
        }

        // Dashboard Summary API
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        [HttpGet("DashboardSummary")]
        [HttpGet("dashboard-summary")]
        [HttpGet("Dashboard")]
        [HttpGet("dashboard-stats")]
        [HttpGet("summary")]
        public async Task<ActionResult> GetDashboardSummary([FromQuery] int? branchId)
        {
            try
            {
                // Members
                var membersQuery = _context.Members.Include(m => m.Customer).AsNoTracking();
                if (branchId.HasValue) membersQuery = membersQuery.Where(m => m.BranchID == branchId.Value);
                var totalMembers = await membersQuery.CountAsync();

                // Loan Module
                var loanAccountsQuery = _context.LoanAccounts.AsNoTracking();
                if (branchId.HasValue) loanAccountsQuery = loanAccountsQuery.Where(l => l.BranchID == branchId.Value);

                var totalLoanAccounts = await loanAccountsQuery.CountAsync();
                var activeLoanAccounts = await loanAccountsQuery.Where(l => l.Status == "Active").CountAsync();
                var totalLoanDisbursed = await loanAccountsQuery.SumAsync(l => (decimal?)l.SanctionedAmount) ?? 0m;
                var totalLoanPrincipalBalance = await loanAccountsQuery.Where(l => l.Status == "Active").SumAsync(l => (decimal?)l.PrincipalBalance) ?? 0m;
                var totalLoanInterestBalance = await loanAccountsQuery.Where(l => l.Status == "Active").SumAsync(l => (decimal?)l.InterestBalance) ?? 0m;
                var totalLoanOverdueBalance = await loanAccountsQuery.Where(l => l.Status == "Active").SumAsync(l => (decimal?)l.OverdueInterestBalance) ?? 0m;
                
                var loanCollectionsQuery = _context.LoanCollections.AsNoTracking();
                if (branchId.HasValue) loanCollectionsQuery = loanCollectionsQuery.Where(c => c.LoanAccount != null && c.LoanAccount.BranchID == branchId.Value);
                var totalLoanCollected = await loanCollectionsQuery.SumAsync(c => (decimal?)c.TotalAmountReceived) ?? 0m;
                
                // Saving Module
                var savingAccountsQuery = _context.SavingAccountMasters.AsNoTracking();
                if (branchId.HasValue) savingAccountsQuery = savingAccountsQuery.Where(s => s.BranchID == branchId.Value);

                var totalSavingAccounts = await savingAccountsQuery.CountAsync();
                var activeSavingAccounts = await savingAccountsQuery.Where(s => s.Status == "Active").CountAsync();
                var totalSavingBalance = await savingAccountsQuery.Where(s => s.Status == "Active").SumAsync(s => (decimal?)s.CurrentBalance) ?? 0m;
                
                var savingTxnsQuery = _context.SavingTransactions.AsNoTracking();
                if (branchId.HasValue) savingTxnsQuery = savingTxnsQuery.Where(t => t.SavingAccount != null && t.SavingAccount.BranchID == branchId.Value);
                var totalSavingDeposits = await savingTxnsQuery
                    .Where(t => t.TransactionType == "Deposit" && t.Narration != "Opening Balance")
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;
                var totalSavingWithdrawals = await savingTxnsQuery
                    .Where(t => t.TransactionType == "Withdrawal")
                    .SumAsync(t => (decimal?)t.Amount) ?? 0m;

                // Member OB
                var memberOBsQuery = _context.MemberOpeningBalances.AsNoTracking();
                if (branchId.HasValue) memberOBsQuery = memberOBsQuery.Where(o => o.Member != null && o.Member.BranchID == branchId.Value);
                var totalMemberOBDr = await memberOBsQuery.Where(o => o.BalanceType == "Dr").SumAsync(o => (decimal?)o.Amount) ?? 0m;
                var totalMemberOBCr = await memberOBsQuery.Where(o => o.BalanceType == "Cr").SumAsync(o => (decimal?)o.Amount) ?? 0m;

                // Voucher / Accounting
                var vouchersQuery = _context.Vouchers.AsNoTracking();
                if (branchId.HasValue) vouchersQuery = vouchersQuery.Where(v => v.BranchID == branchId.Value);
                var totalVouchers = await vouchersQuery.CountAsync();
                var totalLedgers = await _context.Ledgers.AsNoTracking().CountAsync();

                return Ok(new
                {
                    members = new { totalMembers },
                    loan = new
                    {
                        totalAccounts = totalLoanAccounts,
                        activeAccounts = activeLoanAccounts,
                        totalDisbursed = totalLoanDisbursed,
                        principalBalance = totalLoanPrincipalBalance,
                        interestBalance = totalLoanInterestBalance,
                        overdueBalance = totalLoanOverdueBalance,
                        totalCollected = totalLoanCollected
                    },
                    saving = new
                    {
                        totalAccounts = totalSavingAccounts,
                        activeAccounts = activeSavingAccounts,
                        totalBalance = totalSavingBalance,
                        totalDeposits = totalSavingDeposits,
                        totalWithdrawals = totalSavingWithdrawals
                    },
                    memberOB = new
                    {
                        totalDr = totalMemberOBDr,
                        totalCr = totalMemberOBCr
                    },
                    accounting = new
                    {
                        totalVouchers,
                        totalLedgers
                    }
                });
            }
            catch (Exception ex)
            {
                // Fallback safe zero values on error so Dashboard frontend cards never crash or show empty
                return Ok(new
                {
                    members = new { totalMembers = 0 },
                    loan = new
                    {
                        totalAccounts = 0,
                        activeAccounts = 0,
                        totalDisbursed = 0m,
                        principalBalance = 0m,
                        interestBalance = 0m,
                        overdueBalance = 0m,
                        totalCollected = 0m
                    },
                    saving = new
                    {
                        totalAccounts = 0,
                        activeAccounts = 0,
                        totalBalance = 0m,
                        totalDeposits = 0m,
                        totalWithdrawals = 0m
                    },
                    memberOB = new
                    {
                        totalDr = 0m,
                        totalCr = 0m
                    },
                    accounting = new
                    {
                        totalVouchers = 0,
                        totalLedgers = 0
                    },
                    error = ex.Message
                });
            }
        }

        // GET: api/Reports/Member360/{memberId} or api/Reports/Customer360/{customerId}
        [HttpGet("Member360/{memberId}")]
        [HttpGet("Customer360/{customerId}")]
        public async Task<ActionResult<Member360Dto>> GetMember360(int? memberId, int? customerId, [FromQuery] string? cifNo = null)
        {
            try
            {
                Customer? customer = null;
                Member? member = null;

                if (!string.IsNullOrWhiteSpace(cifNo))
                {
                    customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CIFNo == cifNo.Trim());
                    if (customer != null)
                    {
                        member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                    }
                }
                else if (customerId.HasValue && customerId.Value > 0)
                {
                    customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == customerId.Value);
                    if (customer != null)
                    {
                        member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                    }
                }
                else
                {
                    int lookupId = memberId ?? customerId ?? 0;
                    if (lookupId <= 0) return BadRequest("वैध सभासद किंवा ग्राहक आयडी आवश्यक आहे.");

                    // 1. Prioritize CustomerID lookup (CIF-First architecture used across all UI dropdowns)
                    customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == lookupId);
                    if (customer != null)
                    {
                        member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
                    }
                    else
                    {
                        // 2. Fallback to MemberID lookup if no customer matches lookupId
                        member = await _context.Members.Include(m => m.Customer).Include(m => m.Branch).FirstOrDefaultAsync(m => m.MemberID == lookupId);
                        if (member?.CustomerID != null)
                        {
                            customer = await _context.Customers.Include(c => c.Branch).FirstOrDefaultAsync(c => c.CustomerID == member.CustomerID.Value);
                        }
                    }
                }

                if (member == null && customer == null)
                {
                    return NotFound("सभासद किंवा ग्राहक सापडला नाही (Member or Customer not found)");
                }

                int? targetCustId = customer?.CustomerID ?? member?.CustomerID;
                int? targetMemId = member?.MemberID;

                var savingsAccs = await _context.SavingAccountMasters
                    .Where(s => targetCustId != null && s.CustomerID == targetCustId)
                    .ToListAsync();

                var loanAccs = await _context.LoanAccounts
                    .Include(l => l.LoanRate)
                    .Where(l => (targetCustId != null && l.CustomerID == targetCustId) || (targetMemId != null && l.MemberID == targetMemId))
                    .ToListAsync();

                var fdAccs = await _context.FdAccounts
                    .Where(f => targetCustId != null && f.CustomerID == targetCustId)
                    .ToListAsync();

                var rdAccs = await _context.RdAccounts
                    .Where(r => targetCustId != null && r.CustomerID == targetCustId)
                    .ToListAsync();

                var pigmyAccs = await _context.PigmyAccounts
                    .Where(p => targetCustId != null && p.CustomerID == targetCustId)
                    .ToListAsync();

                // Calculate share capital accurately from ShareAccounts and MemberOpeningBalances
                decimal shareCapital = 0;
                if (targetMemId.HasValue)
                {
                    var shareAccount = await _context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == targetMemId.Value);
                    shareCapital = shareAccount?.TotalShareAmount ?? 0;

                    if (shareCapital == 0)
                    {
                        shareCapital = await _context.MemberOpeningBalances
                            .Include(ob => ob.Ledger)
                            .Where(ob => ob.MemberID == targetMemId.Value && ob.Ledger != null && (
                                ob.Ledger.AccountType == "Share Capital" || 
                                ob.Ledger.LedgerName.Contains("भाग") || 
                                ob.Ledger.LedgerName.Contains("शेअर्स") || 
                                ob.Ledger.LedgerName.ToLower().Contains("share")))
                            .SumAsync(ob => (decimal?)ob.Amount) ?? 0;
                    }
                }

                var totalDeposits = savingsAccs.Sum(s => s.CurrentBalance) + fdAccs.Sum(f => f.DepositAmount) + rdAccs.Sum(r => r.TotalDepositedAmount) + pigmyAccs.Sum(p => p.TotalDepositedAmount);

                decimal totalLoansOutstanding = 0;
                var activeLoanIds = loanAccs.Where(l => l.Status == "Active").Select(l => l.LoanAccountID).ToList();
                var allLoanIds = loanAccs.Select(l => l.LoanAccountID).ToList();

                var memberSchedules = await _context.LoanInstallmentSchedules
                    .Where(s => activeLoanIds.Contains(s.LoanAccountID))
                    .ToListAsync();

                var memberLoanCollections = await _context.LoanCollections
                    .Where(c => allLoanIds.Contains(c.LoanAccountID))
                    .ToListAsync();

                foreach (var l in loanAccs)
                {
                    if (l.Status == "Active")
                    {
                        var schedulesForAccount = memberSchedules.Where(s => s.LoanAccountID == l.LoanAccountID).ToList();
                        if (!schedulesForAccount.Any() && l.LoanRate != null)
                        {
                            try
                            {
                                schedulesForAccount = Services.LoanScheduleGenerator.GenerateSchedules(l, l.LoanRate);
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"Error generating schedules for loan account {l.LoanAccountID}: {ex.Message}");
                            }
                        }
                        totalLoansOutstanding += l.PrincipalBalance + CalculateOutstandingInterest(l, DateTime.Today, schedulesForAccount, memberLoanCollections) + l.OverdueInterestBalance;
                    }
                    else
                    {
                        totalLoansOutstanding += l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance;
                    }
                }

                // Last Tx dates
                string? lastSavingTxDate = null;
                if (savingsAccs.Any())
                {
                    var savingAccIds = savingsAccs.Select(s => s.SavingAccountID).ToList();
                    var lastSavingTx = await _context.SavingTransactions
                        .Where(st => savingAccIds.Contains(st.SavingAccountID))
                        .OrderByDescending(st => st.TransactionDate)
                        .FirstOrDefaultAsync();
                    if (lastSavingTx != null)
                    {
                        lastSavingTxDate = lastSavingTx.TransactionDate.ToString("yyyy-MM-dd");
                    }
                }

                string? lastLoanTxDate = null;
                if (loanAccs.Any())
                {
                    var loanAccIds = loanAccs.Select(l => l.LoanAccountID).ToList();
                    var lastCollection = await _context.LoanCollections
                        .Where(lc => loanAccIds.Contains(lc.LoanAccountID))
                        .OrderByDescending(lc => lc.CollectionDate)
                        .FirstOrDefaultAsync();
                    if (lastCollection != null)
                    {
                        lastLoanTxDate = lastCollection.CollectionDate.ToString("yyyy-MM-dd");
                    }
                    else
                    {
                        var lastDisb = await _context.LoanDisbursements
                            .Where(ld => loanAccIds.Contains(ld.LoanAccountID))
                            .OrderByDescending(ld => ld.DisbursementDate)
                            .FirstOrDefaultAsync();
                        if (lastDisb != null)
                        {
                            lastLoanTxDate = lastDisb.DisbursementDate.ToString("yyyy-MM-dd");
                        }
                    }
                }

                // Build recent transactions list (merged)
                var recentTxs = new List<RecentTransactionDto>();
                string branchName = customer?.Branch?.BranchName ?? member?.Branch?.BranchName ?? "Main Branch";

                // 1. Savings Tx
                if (savingsAccs.Any())
                {
                    var savingAccIds = savingsAccs.Select(s => s.SavingAccountID).ToList();
                    var savingTxs = await _context.SavingTransactions
                        .Include(st => st.SavingAccount)
                        .Where(st => savingAccIds.Contains(st.SavingAccountID))
                        .OrderByDescending(st => st.TransactionDate)
                        .Take(20)
                        .ToListAsync();

                    foreach (var tx in savingTxs)
                    {
                        recentTxs.Add(new RecentTransactionDto
                        {
                            Date = tx.TransactionDate.ToString("yyyy-MM-dd HH:mm"),
                            Module = "बचत ठेव (Saving)",
                            TransactionType = tx.TransactionType == "Deposit" ? "जमा (Deposit)" : "नावे (Withdrawal)",
                            Amount = tx.Amount,
                            Branch = branchName,
                            VoucherNo = tx.VoucherNo ?? "-"
                        });
                    }
                }

                // 2. Pigmy Tx
                if (pigmyAccs.Any())
                {
                    var pigmyAccIds = pigmyAccs.Select(p => p.PigmyAccountID).ToList();
                    var pigmyCols = await _context.PigmyCollections
                        .Where(pc => pigmyAccIds.Contains(pc.PigmyAccountId))
                        .OrderByDescending(pc => pc.CollectionDate)
                        .Take(20)
                        .ToListAsync();

                    foreach (var col in pigmyCols)
                    {
                        recentTxs.Add(new RecentTransactionDto
                        {
                            Date = col.CollectionDate.ToString("yyyy-MM-dd HH:mm"),
                            Module = "पिग्मी ठेव (Pigmy)",
                            TransactionType = "जमा (Collection)",
                            Amount = col.CollectionAmount,
                            Branch = branchName,
                            VoucherNo = col.ReceiptNo ?? "-"
                        });
                    }
                }

                // 3. Loan Collections Tx
                if (loanAccs.Any())
                {
                    var loanAccIds = loanAccs.Select(l => l.LoanAccountID).ToList();
                    var collections = await _context.LoanCollections
                        .Include(lc => lc.LoanAccount)
                        .Where(lc => loanAccIds.Contains(lc.LoanAccountID))
                        .OrderByDescending(lc => lc.CollectionDate)
                        .Take(20)
                        .ToListAsync();

                    foreach (var col in collections)
                    {
                        recentTxs.Add(new RecentTransactionDto
                        {
                            Date = col.CollectionDate.ToString("yyyy-MM-dd HH:mm"),
                            Module = "कर्ज विभाग (Loan)",
                            TransactionType = "वसुली (Collection)",
                            Amount = col.TotalAmountReceived,
                            Branch = branchName,
                            VoucherNo = col.ReceiptNo ?? "-"
                        });
                    }

                    var disbursements = await _context.LoanDisbursements
                        .Include(ld => ld.LoanAccount)
                        .Where(ld => loanAccIds.Contains(ld.LoanAccountID))
                        .OrderByDescending(ld => ld.DisbursementDate)
                        .Take(20)
                        .ToListAsync();

                    foreach (var disb in disbursements)
                    {
                        recentTxs.Add(new RecentTransactionDto
                        {
                            Date = disb.DisbursementDate.ToString("yyyy-MM-dd HH:mm"),
                            Module = "कर्ज विभाग (Loan)",
                            TransactionType = "वितरण (Disbursement)",
                            Amount = disb.DisbursementAmount,
                            Branch = branchName,
                            VoucherNo = "-"
                        });
                    }
                }

                // Sort and take top 20
                recentTxs = recentTxs.OrderByDescending(t => t.Date).Take(20).ToList();

                var dto = new Member360Dto
                {
                    MemberInfo = new MemberInfoDto
                    {
                        CustomerID = targetCustId,
                        MemberID = targetMemId ?? (customer?.CustomerID ?? 0),
                        MemberCode = member?.MemberCode ?? (customer?.CIFNo ?? ""),
                        OldMemberCode = member?.LegacyMemberNo ?? "",
                        CIFNo = customer?.CIFNo ?? member?.CIFNo ?? "",
                        FirstName = customer?.FirstName ?? member?.FirstName ?? "",
                        MiddleName = customer?.MiddleName ?? member?.MiddleName,
                        LastName = customer?.LastName ?? member?.LastName ?? "",
                        NickName = customer?.NickName ?? member?.NickName,
                        MobileNo = customer?.MobileNo ?? member?.MobileNo ?? "",
                        AadhaarNo = MaskAadhaar(customer?.AadhaarNo ?? member?.AadhaarNo ?? ""),
                        PANNo = customer?.PANNo ?? member?.PANNo,
                        BranchName = branchName,
                        JoiningDate = member?.JoiningDate ?? customer?.RegistrationDate ?? DateTime.Today,
                        Status = member?.Status ?? customer?.Status ?? "Active",
                        PhotoPath = customer?.PhotoPath ?? member?.PhotoPath
                    },
                    Balances = new BalanceSummaryDto
                    {
                        TotalDeposits = totalDeposits,
                        TotalLoansOutstanding = totalLoansOutstanding,
                        ShareCapital = shareCapital
                    },
                    Portfolio = new PortfolioSummaryDto
                    {
                        Savings = new ProductSummaryDto
                        {
                            Accounts = savingsAccs.Count,
                            Balance = savingsAccs.Sum(s => s.CurrentBalance),
                            StatusColor = savingsAccs.Sum(s => s.CurrentBalance) > 500 ? "Green" : (savingsAccs.Any() ? "Red" : "Gray"),
                            LastTxDate = lastSavingTxDate
                        },
                        FixedDeposits = new ProductSummaryDto
                        {
                            Accounts = fdAccs.Count,
                            Balance = fdAccs.Sum(f => f.DepositAmount),
                            StatusColor = fdAccs.Any(f => f.Status == "Active") ? "Green" : (fdAccs.Any() ? "Gray" : "Gray"),
                            LastTxDate = fdAccs.OrderByDescending(f => f.OpeningDate).FirstOrDefault()?.OpeningDate.ToString("yyyy-MM-dd")
                        },
                        RecurringDeposits = new ProductSummaryDto
                        {
                            Accounts = rdAccs.Count,
                            Balance = rdAccs.Sum(r => r.TotalDepositedAmount),
                            StatusColor = rdAccs.Any(r => r.Status == "Active") ? "Green" : (rdAccs.Any() ? "Gray" : "Gray"),
                            LastTxDate = rdAccs.OrderByDescending(r => r.OpeningDate).FirstOrDefault()?.OpeningDate.ToString("yyyy-MM-dd")
                        },
                        Pigmy = new ProductSummaryDto
                        {
                            Accounts = pigmyAccs.Count,
                            Balance = pigmyAccs.Sum(p => p.TotalDepositedAmount),
                            StatusColor = pigmyAccs.Any(p => p.Status == "Active") ? "Green" : (pigmyAccs.Any() ? "Gray" : "Gray"),
                            LastTxDate = pigmyAccs.OrderByDescending(p => p.OpeningDate).FirstOrDefault()?.OpeningDate.ToString("yyyy-MM-dd")
                        },
                        Loans = new ProductSummaryDto
                        {
                            Accounts = loanAccs.Count,
                            Balance = totalLoansOutstanding,
                            StatusColor = loanAccs.Any(l => l.OverdueInterestBalance > 0) ? "Red" : (loanAccs.Any() ? "Green" : "Gray"),
                            LastTxDate = lastLoanTxDate
                        },
                        Shares = new ProductSummaryDto
                        {
                            Accounts = shareCapital > 0 ? 1 : 0,
                            Balance = shareCapital,
                            StatusColor = shareCapital > 0 ? "Green" : "Gray",
                            LastTxDate = null,
                            FolioNo = shareCapital > 0 ? "FOLIO-" + (member?.MemberCode ?? customer?.CIFNo) : null
                        }
                    },
                    RecentTransactions = recentTxs
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error fetching Customer/Member 360 profile for memberId {memberId}/customerId {customerId}: {ex}");
                return StatusCode(500, $"३६०° प्रोफाइल लोडिंग करताना त्रुटी आली: {ex.Message}");
            }
        }

        // GET: api/Reports/OverdueLoans
        [HttpGet("OverdueLoans")]
        public async Task<ActionResult<OverdueLoanReportDto>> GetOverdueLoans([FromQuery] DateTime toDate, [FromQuery] string filterType = "All", [FromQuery] int? loanRateId = null, [FromQuery] int? branchId = null)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

            var query = _context.LoanAccounts
                .Include(la => la.Customer)
                .Include(la => la.Member)
                .Include(la => la.LoanRate)
                .Include(la => la.Guarantor1Member)
                .Include(la => la.Guarantor2Member)
                .Where(la => la.OpeningDate <= toDate && la.Status == "Active");

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(la => la.BranchID == branchId.Value);
            }

            if (loanRateId.HasValue && loanRateId.Value > 0)
            {
                query = query.Where(la => la.LoanRateID == loanRateId.Value);
            }

            if (filterType == "Secured")
            {
                query = query.Where(la => la.LoanRate != null && la.LoanRate.SecurityType == "तारणी");
            }
            else if (filterType == "Unsecured")
            {
                query = query.Where(la => la.LoanRate == null || la.LoanRate.SecurityType != "तारणी");
            }

            var loanAccounts = await query.ToListAsync();

            var loanAccountIds = loanAccounts.Select(la => la.LoanAccountID).ToList();
            var schedules = await _context.LoanInstallmentSchedules
                .Where(s => loanAccountIds.Contains(s.LoanAccountID))
                .ToListAsync();

            var rows = new List<OverdueLoanRowDto>();
            foreach (var la in loanAccounts)
            {
                var overdueSchedulesForAccount = schedules
                    .Where(s => s.LoanAccountID == la.LoanAccountID && s.DueDate <= toDate && s.Status != "Paid")
                    .ToList();

                decimal overduePrincipal = overdueSchedulesForAccount.Sum(s => s.PrincipalAmount);
                if (la.MaturityDate.HasValue && la.MaturityDate.Value <= toDate && la.PrincipalBalance > overduePrincipal)
                {
                    overduePrincipal = la.PrincipalBalance;
                }

                if (overduePrincipal > la.PrincipalBalance)
                {
                    overduePrincipal = la.PrincipalBalance;
                }

                // Show in Thakit Karj Yadi if there is overdue principal, or interest overdue, or past maturity
                bool isOverdue = overduePrincipal > 0 || la.OverdueInterestBalance > 0 || (la.MaturityDate.HasValue && la.MaturityDate.Value <= toDate && la.PrincipalBalance > 0);

                if (!isOverdue)
                {
                    continue;
                }

                int overdueCount = overdueSchedulesForAccount.Count;
                DateTime? overdueSince = overdueSchedulesForAccount.Any() 
                    ? overdueSchedulesForAccount.Min(s => s.DueDate) 
                    : (la.MaturityDate.HasValue && la.MaturityDate.Value <= toDate && la.PrincipalBalance > 0 ? la.MaturityDate.Value : (DateTime?)null);

                var gList = new List<string>();
                if (la.Guarantor1Member != null)
                {
                    string g1Name = $"{la.Guarantor1Member.FirstName} {la.Guarantor1Member.MiddleName} {la.Guarantor1Member.LastName}".Replace("  ", " ").Trim();
                    string g1Mobile = !string.IsNullOrWhiteSpace(la.Guarantor1Member.MobileNo) ? $" ({la.Guarantor1Member.MobileNo})" : "";
                    gList.Add($"१) {g1Name}{g1Mobile}");
                }
                if (la.Guarantor2Member != null)
                {
                    string g2Name = $"{la.Guarantor2Member.FirstName} {la.Guarantor2Member.MiddleName} {la.Guarantor2Member.LastName}".Replace("  ", " ").Trim();
                    string g2Mobile = !string.IsNullOrWhiteSpace(la.Guarantor2Member.MobileNo) ? $" ({la.Guarantor2Member.MobileNo})" : "";
                    gList.Add($"२) {g2Name}{g2Mobile}");
                }
                string guarantorDetails = string.Join("\n", gList);

                var cust = la.Customer;
                var mem = la.Member;
                string mName = cust != null
                    ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Trim()
                    : (mem != null ? $"{mem.FirstName} {mem.MiddleName} {mem.LastName}".Trim() : "");
                string mob = cust?.MobileNo ?? mem?.MobileNo ?? "";
                string cif = cust?.CIFNo ?? mem?.CIFNo ?? "";
                string mCode = mem?.MemberCode ?? "";

                rows.Add(new OverdueLoanRowDto
                {
                    LoanAccountID = la.LoanAccountID,
                    LoanAccountNo = la.LoanAccountNo ?? "",
                    LoanType = la.LoanRate?.ShortName ?? la.LoanRate?.LoanType ?? "",
                    CustomerID = la.CustomerID,
                    CifNo = cif,
                    MemberID = la.MemberID ?? la.CustomerID ?? 0,
                    MemberCode = mCode,
                    MemberName = mName,
                    MobileNo = mob,
                    LoanDate = la.LoanDisbursementDate ?? la.OpeningDate,
                    SanctionedAmount = la.SanctionedAmount,
                    PrincipalBalance = la.PrincipalBalance,
                    OverduePrincipal = overduePrincipal,
                    OverdueSinceDate = overdueSince,
                    OverdueInstallmentsCount = overdueCount > 0 ? overdueCount : (la.MaturityDate.HasValue && la.MaturityDate.Value <= toDate ? la.NoOfInstallments : 1),
                    InstallmentAmount = la.InstallmentAmount,
                    OutstandingInterest = CalculateOutstandingInterest(la, toDate, schedules),
                    GuarantorDetails = guarantorDetails,
                    MaturityDate = la.MaturityDate,
                    Remarks = ""
                });
            }

            var report = new OverdueLoanReportDto
            {
                SansthaInfo = sanstha,
                Rows = rows.OrderBy(r => r.LoanType).ThenBy(r => r.LoanAccountNo).ToList()
            };

            return Ok(report);
        }
        [HttpGet("member-ledger-balances")]
        public async Task<ActionResult<MemberLedgerBalanceReportDto>> GetMemberLedgerBalances([FromQuery] int ledgerId, [FromQuery] DateTime asOfDate, [FromQuery] int? branchId = null)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
            var ledger = await _context.Ledgers.FindAsync(ledgerId);
            
            if (ledger == null)
            {
                return NotFound("Ledger not found.");
            }

            bool isShareLedger = ledger.AccountType == "Share Capital" || 
                                 ledger.LedgerName.Contains("भाग") || 
                                 ledger.LedgerName.Contains("शेअर्स") ||
                                 ledger.LedgerName.ToLower().Contains("share");

            // Get Opening Balances
            var openingBalances = await _context.MemberOpeningBalances
                .Where(m => m.LedgerID == ledgerId)
                .ToListAsync();

            // Get Voucher Details
            var voucherQuery = _context.VoucherDetails
                .Include(vd => vd.Voucher)
                .Where(vd => vd.LedgerID == ledgerId && vd.MemberID != null && vd.Voucher != null && vd.Voucher.VoucherDate.Date <= asOfDate.Date);

            if (branchId.HasValue && branchId.Value > 0)
            {
                voucherQuery = voucherQuery.Where(vd => vd.Voucher != null && vd.Voucher.BranchID == branchId.Value);
            }

            var voucherDetails = await voucherQuery.ToListAsync();

            var activeShareMemberIds = isShareLedger 
                ? await _context.ShareAccounts.Where(s => s.TotalShareCount > 0).Select(s => s.MemberId).ToHashSetAsync()
                : null;

            var memberIds = openingBalances.Select(ob => ob.MemberID)
                .Union(voucherDetails.Select(vd => vd.MemberID!.Value))
                .Distinct()
                .ToList();

            var membersQuery = _context.Members.Include(m => m.Customer).Where(m => memberIds.Contains(m.MemberID));
            if (branchId.HasValue && branchId.Value > 0)
            {
                membersQuery = membersQuery.Where(m => m.BranchID == branchId.Value);
            }

            var members = await membersQuery.ToDictionaryAsync(m => m.MemberID, m => m);

            var rows = new List<MemberLedgerBalanceDto>();

            foreach (var memberId in memberIds)
            {
                if (!members.TryGetValue(memberId, out var member))
                    continue;

                // Self-healing check for share ledgers
                if (isShareLedger && activeShareMemberIds != null && !activeShareMemberIds.Contains(memberId))
                {
                    var hasVouchers = voucherDetails.Any(vd => vd.MemberID == memberId);
                    if (!hasVouchers) continue;
                }

                decimal obDr = openingBalances.Where(ob => ob.MemberID == memberId && ob.BalanceType == "Dr").Sum(ob => ob.Amount);
                decimal obCr = openingBalances.Where(ob => ob.MemberID == memberId && ob.BalanceType == "Cr").Sum(ob => ob.Amount);

                decimal vDr = voucherDetails.Where(vd => vd.MemberID == memberId && vd.DrCr == "Dr").Sum(vd => vd.Amount);
                decimal vCr = voucherDetails.Where(vd => vd.MemberID == memberId && vd.DrCr == "Cr").Sum(vd => vd.Amount);

                decimal totalDr = obDr + vDr;
                decimal totalCr = obCr + vCr;
                
                decimal netBalance = totalCr - totalDr;
                
                // If it's a zero balance, don't show
                if (netBalance == 0) continue;

                string balanceType = netBalance > 0 ? "Cr" : "Dr";
                decimal displayBalance = Math.Abs(netBalance);

                rows.Add(new MemberLedgerBalanceDto
                {
                    MemberID = member.MemberID,
                    MemberNo = member.MemberCode ?? "",
                    MemberName = $"{member.FirstName} {member.MiddleName} {member.LastName}".Trim(),
                    Balance = displayBalance,
                    BalanceType = balanceType
                });
            }

            var report = new MemberLedgerBalanceReportDto
            {
                SansthaInfo = sanstha,
                LedgerName = ledger.LedgerName,
                AsOfDate = asOfDate,
                Rows = rows.OrderBy(r => r.MemberNo).ToList()
            };

            return Ok(report);
        }

        [HttpGet("member-ledger-statement")]
        public async Task<IActionResult> GetMemberLedgerStatement([FromQuery] int memberId, [FromQuery] int ledgerId, [FromQuery] DateTime fromDate, [FromQuery] DateTime toDate)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
            var member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == memberId);
            if (member == null) return NotFound("Member not found.");

            var ledger = await _context.Ledgers.FindAsync(ledgerId);
            if (ledger == null) return NotFound("Ledger not found.");

            // 1. Opening Balance up to fromDate
            var memberOpBals = await _context.MemberOpeningBalances
                .Where(m => m.MemberID == memberId && m.LedgerID == ledgerId)
                .ToListAsync();

            decimal obDr = memberOpBals.Where(ob => ob.BalanceType == "Dr").Sum(ob => ob.Amount);
            decimal obCr = memberOpBals.Where(ob => ob.BalanceType == "Cr").Sum(ob => ob.Amount);

            var prevVouchers = await _context.VoucherDetails
                .Include(vd => vd.Voucher)
                .Where(vd => vd.MemberID == memberId && vd.LedgerID == ledgerId && vd.Voucher != null && vd.Voucher.VoucherDate.Date < fromDate.Date)
                .ToListAsync();

            obDr += prevVouchers.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
            obCr += prevVouchers.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

            decimal runningBalance = obCr - obDr; // Positive means Cr balance, negative means Dr balance
            decimal openingNetBalance = obCr - obDr;
            int openingShares = (int)(Math.Abs(openingNetBalance) / 100M);

            // 2. Current period transactions
            var currVouchers = await _context.VoucherDetails
                .Include(vd => vd.Voucher)
                .Where(vd => vd.MemberID == memberId && vd.LedgerID == ledgerId && vd.Voucher != null && vd.Voucher.VoucherDate.Date >= fromDate.Date && vd.Voucher.VoucherDate.Date <= toDate.Date)
                .OrderBy(vd => vd.Voucher!.VoucherDate)
                .ThenBy(vd => vd.VoucherID)
                .ToListAsync();

            var transactions = new List<MemberLedgerTransactionDto>();
            decimal totalDebit = 0;
            decimal totalCredit = 0;
            int totalDrShares = 0;
            int totalCrShares = 0;

            foreach (var vd in currVouchers)
            {
                int sharesQty = (int)(vd.Amount / 100M);
                if (vd.DrCr == "Cr") 
                {
                    runningBalance += vd.Amount;
                    totalCredit += vd.Amount;
                    totalCrShares += sharesQty;
                }
                else 
                {
                    runningBalance -= vd.Amount;
                    totalDebit += vd.Amount;
                    totalDrShares += sharesQty;
                }

                int runningSharesCount = (int)(Math.Abs(runningBalance) / 100M);

                transactions.Add(new MemberLedgerTransactionDto
                {
                    Date = vd.Voucher?.VoucherDate ?? DateTime.MinValue,
                    VoucherNo = vd.Voucher?.VoucherNo ?? "",
                    Particulars = !string.IsNullOrWhiteSpace(vd.Voucher?.Narration) ? vd.Voucher.Narration : (vd.Voucher?.VoucherType ?? ""),
                    SharesQuantity = sharesQty,
                    Debit = vd.DrCr == "Dr" ? vd.Amount : 0,
                    Credit = vd.DrCr == "Cr" ? vd.Amount : 0,
                    BalanceShares = runningSharesCount,
                    Balance = Math.Abs(runningBalance),
                    BalanceType = runningBalance >= 0 ? "Cr" : "Dr"
                });
            }

            var report = new MemberLedgerStatementReportDto
            {
                SansthaInfo = sanstha,
                MemberNo = member.MemberCode ?? "",
                LegacyMemberNo = member.LegacyMemberNo ?? string.Empty,
                MemberName = $"{member.FirstName} {member.MiddleName} {member.LastName}".Trim(),
                MobileNo = member.MobileNo ?? string.Empty,
                Village = member.Village ?? string.Empty,
                Taluka = member.Taluka ?? string.Empty,
                Address = member.Address ?? string.Empty,
                AadhaarNo = member.AadhaarNo ?? string.Empty,
                PANNo = member.PANNo ?? string.Empty,
                LedgerName = ledger.LedgerName,
                FromDate = fromDate,
                ToDate = toDate,
                OpeningBalance = Math.Abs(openingNetBalance),
                OpeningBalanceType = openingNetBalance >= 0 ? "Cr" : "Dr",
                OpeningShares = openingShares,
                Transactions = transactions,
                TotalDebit = totalDebit,
                TotalCredit = totalCredit,
                TotalDebitShares = totalDrShares,
                TotalCreditShares = totalCrShares,
                ClosingBalance = Math.Abs(runningBalance),
                ClosingBalanceType = runningBalance >= 0 ? "Cr" : "Dr",
                ClosingShares = (int)(Math.Abs(runningBalance) / 100M)
            };

            return Ok(report);
        }

        [HttpGet("i-namuna")]
        public async Task<ActionResult<INamunaReportDto>> GetINamunaReport([FromQuery] int memberId)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
            var member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == memberId);
            if (member == null) return NotFound("Member not found.");

            var shareAccount = await _context.ShareAccounts
                .Include(s => s.Transactions)
                .Include(s => s.Certificates)
                .FirstOrDefaultAsync(s => s.MemberId == memberId);

            if (shareAccount != null && shareAccount.Transactions != null)
            {
                foreach(var t in shareAccount.Transactions)
                {
                    if (t.VoucherId.HasValue)
                    {
                        t.Voucher = await _context.Vouchers.FindAsync(t.VoucherId.Value);
                    }
                }
            }

            var report = new INamunaReportDto
            {
                SansthaInfo = sanstha,
                MemberInfo = new MemberDetailsDto
                {
                    MemberID = member.MemberID,
                    MemberCode = member.MemberCode ?? "",
                    LegacyMemberNo = member.LegacyMemberNo ?? "",
                    CIFNo = member.CIFNo ?? "",
                    AccountNo = shareAccount?.AccountNo ?? member.MemberCode ?? "",
                    JoiningDate = member.JoiningDate,
                    EntranceFeeDate = member.JoiningDate,
                    FullName = $"{member.FirstName} {member.MiddleName} {member.LastName}".Trim(),
                    Address = $"{member.Address}, {member.Village}, {member.Taluka}, {member.District}".Trim(new char[] { ',', ' ' }),
                    AgeAtJoining = member.BirthDate.HasValue ? (member.JoiningDate.Year - member.BirthDate.Value.Year) : 0,
                    NomineeName = member.NomineeName ?? "-",
                    NomineeAddress = member.NomineeAddress ?? "-",
                    NominationDate = member.JoiningDate,
                    Occupation = member.Occupation ?? "-",
                    CessationDate = member.Status == "Closed" ? member.UpdatedOn : null,
                    CessationReason = "-",
                    Remarks = member.Status == "Closed" ? "Account Closed" : "-"
                }
            };

                        decimal runningBalance = 0;
            string currentCertificate = "";

            // 1. Fetch Opening Balance from MemberOpeningBalances
            var opBal = await _context.MemberOpeningBalances
                .Include(o => o.Ledger)
                .FirstOrDefaultAsync(o => o.MemberID == memberId && o.Ledger != null && (o.Ledger.LedgerName.Contains("सभासद भाग") || o.Ledger.LedgerName.Contains("Share")));

            if (opBal != null && opBal.Amount > 0)
            {
                bool hasExistingOpBal = shareAccount != null && shareAccount.Transactions != null && 
                                        shareAccount.Transactions.Any(t => t.TransactionType == "OpeningBalance");
                
                if (!hasExistingOpBal)
                {
                    var opBalAmount = opBal.BalanceType == "Cr" ? opBal.Amount : -opBal.Amount;
                    var dto = new INamunaTransactionDto
                    {
                        AllotmentDate = member.JoiningDate,
                        AllotmentCashbookNo = "OP-BAL",
                        Application = "-",
                        TotalAmountReceived = opBalAmount,
                        NumberOfSharesHeld = (int)(opBalAmount / 100),
                        AllotmentCertificateNo = "-",
                        Remarks = "Opening Balance",
                        BalanceAmount = opBalAmount,
                        BalanceCertificateNo = "-"
                    };
                    runningBalance += opBalAmount;
                    report.Transactions.Add(dto);
                }
            }

            if (shareAccount != null && shareAccount.Transactions != null)
            {

                var transactions = shareAccount.Transactions.OrderBy(t => t.TransactionDate).ThenBy(t => t.TransactionId).ToList();

                foreach (var t in transactions)
                {
                    var dto = new INamunaTransactionDto();
                    if (t.TransactionType == "Allotment" || t.TransactionType == "OpeningBalance")
                    {
                        dto.AllotmentDate = t.TransactionDate;
                        dto.AllotmentCashbookNo = t.Voucher?.VoucherNo ?? "-";
                        dto.Application = "-";
                        dto.TotalAmountReceived = t.Amount;
                        dto.NumberOfSharesHeld = t.NumberOfShares;
                        
                        var cert = shareAccount.Certificates?.FirstOrDefault(c => c.IssueDate.Date == t.TransactionDate.Date);
                        if (cert != null) currentCertificate = cert.CertificateNo;
                        
                        dto.AllotmentCertificateNo = currentCertificate;
                        
                        runningBalance += t.Amount;
                    }
                    else if (t.TransactionType == "Refund" || t.TransactionType == "Transfer")
                    {
                        dto.TransferDate = t.TransactionDate;
                        dto.TransferCashbookNo = t.Voucher?.VoucherNo ?? "-";
                        if (t.TransactionType == "Transfer") dto.NumberOfSharesTransferred = t.NumberOfShares;
                        if (t.TransactionType == "Refund") dto.NumberOfSharesReturned = t.NumberOfShares;
                        
                        runningBalance -= t.Amount;
                    }

                    dto.BalanceAmount = runningBalance;
                    dto.BalanceCertificateNo = currentCertificate;
                    dto.Remarks = t.Narration;

                    report.Transactions.Add(dto);
                }
            }

            return Ok(report);
        }

        // GET: api/Reports/i-namuna-register
        [HttpGet("i-namuna-register")]
        public async Task<ActionResult<INamunaRegisterResponseDto>> GetINamunaRegisterReport(
            [FromQuery] int? branchId = null,
            [FromQuery] string? status = null)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

            var query = _context.Members.Include(m => m.Customer).AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(m => m.BranchID == branchId.Value);
            }
            if (!string.IsNullOrWhiteSpace(status) && status != "सर्व" && status != "All")
            {
                query = query.Where(m => m.Status == status);
            }

            var members = await query.OrderBy(m => m.MemberID).ToListAsync();
            var memberIds = members.Select(m => m.MemberID).ToList();

            var shareAccounts = await _context.ShareAccounts
                .Include(s => s.Certificates)
                .Where(s => memberIds.Contains(s.MemberId))
                .ToListAsync();

            var rows = new List<INamunaRegisterRowDto>();
            int sr = 1;

            foreach (var m in members)
            {
                var sh = shareAccounts.FirstOrDefault(s => s.MemberId == m.MemberID);
                var certNos = sh?.Certificates != null && sh.Certificates.Any()
                    ? string.Join(", ", sh.Certificates.Select(c => c.CertificateNo).Distinct())
                    : "-";

                int age = 0;
                if (m.BirthDate.HasValue)
                {
                    age = m.JoiningDate.Year - m.BirthDate.Value.Year;
                    if (m.BirthDate.Value.Date > m.JoiningDate.AddYears(-age)) age--;
                }

                rows.Add(new INamunaRegisterRowDto
                {
                    SrNo = sr++,
                    MemberID = m.MemberID,
                    MemberCode = m.MemberCode ?? m.CIFNo ?? "",
                    CIFNo = m.CIFNo ?? "",
                    FullName = $"{m.FirstName} {m.MiddleName} {m.LastName}".Trim().Replace("  ", " "),
                    FullNameEng = $"{m.FirstNameEng} {m.MiddleNameEng} {m.LastNameEng}".Trim().Replace("  ", " "),
                    Address = $"{m.Address}, {m.Village}, {m.Taluka}".Trim(new char[] { ',', ' ' }),
                    Occupation = m.Occupation ?? "-",
                    JoiningDate = m.JoiningDate,
                    AgeAtJoining = age > 0 ? age : null,
                    TotalShareCount = sh?.TotalShareCount ?? 0,
                    TotalShareAmount = sh?.TotalShareAmount ?? 0,
                    CertificateNos = certNos,
                    NomineeName = m.NomineeName ?? "-",
                    NomineeRelation = m.NomineeRelation ?? "-",
                    NomineeAddress = m.NomineeAddress ?? "-",
                    NomineeIsMinor = m.NomineeIsMinor,
                    NomineeGuardianName = m.NomineeGuardianName,
                    Status = m.Status,
                    CessationDate = m.Status == "Closed" || m.Status == "Mayat" ? m.UpdatedOn : null,
                    CessationReason = m.Status == "Mayat" ? "मयत (Deceased Claim Settled)" : (m.Status == "Closed" ? "सभासदत्व राजीनामा/रद्द (Closed)" : "-"),
                    Remarks = m.Status != "Active" ? m.Status : "-"
                });
            }

            return Ok(new INamunaRegisterResponseDto
            {
                SansthaInfo = sanstha,
                Rows = rows,
                TotalMembers = rows.Count,
                TotalShares = rows.Sum(r => r.TotalShareCount),
                TotalShareCapital = rows.Sum(r => r.TotalShareAmount)
            });
        }

        // GET: api/Reports/voter-list
        [HttpGet("voter-list")]
        public async Task<ActionResult<VoterListResponseDto>> GetVoterListReport(
            [FromQuery] int? branchId = null,
            [FromQuery] string? membershipType = null,
            [FromQuery] string? status = null,
            [FromQuery] string? eligibility = null)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

            var query = _context.Members.Include(m => m.Customer).AsQueryable();
            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(m => m.BranchID == branchId.Value);
            }
            if (!string.IsNullOrWhiteSpace(status) && status != "सर्व" && status != "All")
            {
                query = query.Where(m => m.Status == status);
            }
            if (!string.IsNullOrWhiteSpace(membershipType) && membershipType != "सर्व" && membershipType != "All")
            {
                query = query.Where(m => m.MembershipType == membershipType);
            }

            var members = await query.OrderBy(m => m.MemberID).ToListAsync();
            var memberIds = members.Select(m => m.MemberID).ToList();

            var shareAccounts = await _context.ShareAccounts
                .Where(s => memberIds.Contains(s.MemberId))
                .ToListAsync();

            var jointMembers = await _context.JointMembers
                .Where(j => memberIds.Contains(j.PrimaryMemberID))
                .ToListAsync();

            var rows = new List<VoterListRowDto>();
            int sr = 1;

            foreach (var m in members)
            {
                var sh = shareAccounts.FirstOrDefault(s => s.MemberId == m.MemberID);
                var jList = jointMembers.Where(j => j.PrimaryMemberID == m.MemberID).ToList();
                string jointNames = jList.Any()
                    ? string.Join(", ", jList.Select(j => $"{j.FirstName} {j.LastName}".Trim() + (string.IsNullOrWhiteSpace(j.RelationWithPrimary) ? "" : $" ({j.RelationWithPrimary})")))
                    : "-";

                string mType = string.IsNullOrWhiteSpace(m.MembershipType) ? "Regular" : m.MembershipType;
                int shareCount = sh?.TotalShareCount ?? 0;
                decimal shareAmt = sh?.TotalShareAmount ?? 0;

                bool isEligible = true;
                string? ineligibilityReason = null;

                if (m.Status != "Active")
                {
                    isEligible = false;
                    ineligibilityReason = $"अपात्र (खाते स्थिती: {m.Status})";
                }
                else if (mType == "Nominal")
                {
                    isEligible = false;
                    ineligibilityReason = "अपात्र (कलम २४(१) नाममात्र सभासद - मतदानाचा अधिकार नाही)";
                }
                else if (mType == "Associate")
                {
                    isEligible = false;
                    ineligibilityReason = "अपात्र (कलम २४(२) सह-सभासद - केवळ मुख्य सभासदाच्या संमतीने/अनुपस्थितीत)";
                }
                else if (shareCount <= 0)
                {
                    isEligible = false;
                    ineligibilityReason = "अपात्र (किमान शेअर्स भागभांडवल नाही)";
                }

                if (!string.IsNullOrWhiteSpace(eligibility) && eligibility != "सर्व" && eligibility != "All")
                {
                    if (eligibility == "Eligible" && !isEligible) continue;
                    if (eligibility == "Ineligible" && isEligible) continue;
                }

                rows.Add(new VoterListRowDto
                {
                    SrNo = sr++,
                    MemberID = m.MemberID,
                    MemberCode = m.MemberCode ?? m.CIFNo ?? "",
                    CIFNo = m.CIFNo ?? "",
                    FullName = $"{m.FirstName} {m.MiddleName} {m.LastName}".Trim().Replace("  ", " "),
                    FullNameEng = $"{m.FirstNameEng} {m.MiddleNameEng} {m.LastNameEng}".Trim().Replace("  ", " "),
                    Address = $"{m.Address}, {m.Village}".Trim(new char[] { ',', ' ' }),
                    MobileNo = m.MobileNo ?? "-",
                    MembershipType = mType,
                    TotalShareCount = shareCount,
                    TotalShareAmount = shareAmt,
                    JointMemberNames = jointNames,
                    Status = m.Status,
                    IsVotingEligible = isEligible,
                    VotingEligibilityText = isEligible ? "पात्र (Eligible)" : "अपात्र (Ineligible)",
                    IneligibilityReason = ineligibilityReason
                });
            }

            return Ok(new VoterListResponseDto
            {
                SansthaInfo = sanstha,
                Rows = rows,
                TotalMembers = rows.Count,
                TotalEligibleVoters = rows.Count(r => r.IsVotingEligible),
                TotalIneligibleVoters = rows.Count(r => !r.IsVotingEligible),
                TotalShares = rows.Sum(r => r.TotalShareCount),
                TotalShareCapital = rows.Sum(r => r.TotalShareAmount)
            });
        }

        // GET: api/Reports/GuarantorReport
        [HttpGet("GuarantorReport")]
        public async Task<IActionResult> GetGuarantorReport([FromQuery] int? memberId = null, [FromQuery] int? customerId = null, [FromQuery] int? branchId = null)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

            var accountsQuery = _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                .Include(l => l.Guarantor1Member).ThenInclude(m => m!.Customer)
                .Include(l => l.Guarantor2Member).ThenInclude(m => m!.Customer)
                .Include(l => l.Guarantor1Customer)
                .Include(l => l.Guarantor2Customer)
                .Include(l => l.LoanRate)
                .Where(l => l.Status == "Active");

            if (branchId.HasValue && branchId.Value > 0)
            {
                accountsQuery = accountsQuery.Where(l => l.BranchID == branchId.Value);
            }

            var activeAccounts = await accountsQuery.ToListAsync();

            var appsQuery = _context.LoanApplications
                .Include(a => a.Customer)
                .Include(a => a.Member)
                .Include(a => a.Guarantor1Member).ThenInclude(m => m!.Customer)
                .Include(a => a.Guarantor2Member).ThenInclude(m => m!.Customer)
                .Include(a => a.Guarantor1Customer)
                .Include(a => a.Guarantor2Customer)
                .Include(a => a.LoanRate)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                appsQuery = appsQuery.Where(a => (a.Customer != null && a.Customer.BranchID == branchId.Value) || (a.Member != null && a.Member.BranchID == branchId.Value));
            }

            var applications = await appsQuery.ToListAsync();

            // Collect all unique guarantor entities (identified by CustomerID if available, else MemberID)
            var guarantorProfiles = new Dictionary<string, (int? mId, int? cId, string name, string code, string cif, string mobile)>();

            void RegisterGuarantor(Member? m, Customer? c, int? mId, int? cId)
            {
                int? resCId = c?.CustomerID ?? (m?.CustomerID > 0 ? m.CustomerID : cId);
                int? resMId = m?.MemberID ?? mId;
                if (!resCId.HasValue && !resMId.HasValue) return;

                string key = resCId.HasValue && resCId.Value > 0 ? $"C_{resCId.Value}" : $"M_{resMId!.Value}";
                if (guarantorProfiles.ContainsKey(key)) return;

                string name = c != null 
                    ? $"{c.FirstName} {c.MiddleName} {c.LastName}".Trim() 
                    : (m != null ? $"{m.FirstName} {m.MiddleName} {m.LastName}".Trim() : "N/A");
                string code = m?.MemberCode ?? c?.CIFNo ?? "";
                string cif = c?.CIFNo ?? m?.CIFNo ?? (resCId.HasValue ? $"CIF{resCId.Value:D6}" : $"CIF{resMId:D6}");
                string mobile = !string.IsNullOrWhiteSpace(c?.MobileNo) ? c.MobileNo : (!string.IsNullOrWhiteSpace(m?.MobileNo) ? m.MobileNo : "-");

                guarantorProfiles[key] = (resMId, resCId, name, code, cif, mobile);
            }

            foreach (var l in activeAccounts)
            {
                if (l.Guarantor1Customer != null || l.Guarantor1CustomerID.HasValue)
                    RegisterGuarantor(l.Guarantor1Member, l.Guarantor1Customer, l.Guarantor1MemberID, l.Guarantor1CustomerID);
                else if (l.Guarantor1Member != null || l.Guarantor1MemberID.HasValue)
                    RegisterGuarantor(l.Guarantor1Member, l.Guarantor1Member?.Customer, l.Guarantor1MemberID, l.Guarantor1Member?.CustomerID);

                if (l.Guarantor2Customer != null || l.Guarantor2CustomerID.HasValue)
                    RegisterGuarantor(l.Guarantor2Member, l.Guarantor2Customer, l.Guarantor2MemberID, l.Guarantor2CustomerID);
                else if (l.Guarantor2Member != null || l.Guarantor2MemberID.HasValue)
                    RegisterGuarantor(l.Guarantor2Member, l.Guarantor2Member?.Customer, l.Guarantor2MemberID, l.Guarantor2Member?.CustomerID);
            }

            foreach (var a in applications)
            {
                if (a.Guarantor1Customer != null || a.Guarantor1CustomerID.HasValue)
                    RegisterGuarantor(a.Guarantor1Member, a.Guarantor1Customer, a.Guarantor1MemberID, a.Guarantor1CustomerID);
                else if (a.Guarantor1Member != null || a.Guarantor1MemberID.HasValue)
                    RegisterGuarantor(a.Guarantor1Member, a.Guarantor1Member?.Customer, a.Guarantor1MemberID, a.Guarantor1Member?.CustomerID);

                if (a.Guarantor2Customer != null || a.Guarantor2CustomerID.HasValue)
                    RegisterGuarantor(a.Guarantor2Member, a.Guarantor2Customer, a.Guarantor2MemberID, a.Guarantor2CustomerID);
                else if (a.Guarantor2Member != null || a.Guarantor2MemberID.HasValue)
                    RegisterGuarantor(a.Guarantor2Member, a.Guarantor2Member?.Customer, a.Guarantor2MemberID, a.Guarantor2Member?.CustomerID);
            }

            var resultList = new List<object>();

            foreach (var kvp in guarantorProfiles)
            {
                var (gMId, gCId, gName, gCode, gCif, gMobile) = kvp.Value;

                // Filter by memberId or customerId if requested
                if (memberId.HasValue && memberId.Value > 0 && gMId != memberId.Value) continue;
                if (customerId.HasValue && customerId.Value > 0 && gCId != customerId.Value) continue;

                bool MatchesG1(LoanAccount l) => (gCId.HasValue && l.Guarantor1CustomerID == gCId.Value) || (gMId.HasValue && l.Guarantor1MemberID == gMId.Value);
                bool MatchesG2(LoanAccount l) => (gCId.HasValue && l.Guarantor2CustomerID == gCId.Value) || (gMId.HasValue && l.Guarantor2MemberID == gMId.Value);
                bool MatchesAppG1(LoanApplication a) => (gCId.HasValue && a.Guarantor1CustomerID == gCId.Value) || (gMId.HasValue && a.Guarantor1MemberID == gMId.Value);
                bool MatchesAppG2(LoanApplication a) => (gCId.HasValue && a.Guarantor2CustomerID == gCId.Value) || (gMId.HasValue && a.Guarantor2MemberID == gMId.Value);

                var gActiveLoans = activeAccounts
                    .Where(l => (MatchesG1(l) || MatchesG2(l)) && (l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance > 0))
                    .Select(l => new
                    {
                        loanAccountID = l.LoanAccountID,
                        loanAccountNo = l.LoanAccountNo,
                        borrowerName = l.Customer != null 
                            ? $"{l.Customer.FirstName} {l.Customer.MiddleName} {l.Customer.LastName}".Trim() 
                            : (l.Member != null ? $"{l.Member.FirstName} {l.Member.MiddleName} {l.Member.LastName}".Trim() : ""),
                        borrowerCode = l.Member?.MemberCode ?? l.Customer?.CIFNo,
                        borrowerCIF = l.Customer?.CIFNo ?? l.Member?.CIFNo ?? "",
                        loanType = l.LoanRate?.ShortName ?? l.LoanRate?.LoanType ?? "",
                        sanctionedAmount = l.SanctionedAmount,
                        currentBalance = l.PrincipalBalance + l.InterestBalance + l.OverdueInterestBalance,
                        guarantorType = MatchesG1(l) ? "जामीनदार १ (Guarantor 1)" : "जामीनदार २ (Guarantor 2)",
                        status = "Active"
                    }).ToList();

                var gPendingApps = applications
                    .Where(a => (MatchesAppG1(a) || MatchesAppG2(a)) && !activeAccounts.Any(l => l.LoanApplicationID == a.LoanApplicationID))
                    .Select(a => new
                    {
                        loanApplicationID = a.LoanApplicationID,
                        applicationNo = a.ApplicationNo,
                        borrowerName = a.Customer != null 
                            ? $"{a.Customer.FirstName} {a.Customer.MiddleName} {a.Customer.LastName}".Trim() 
                            : (a.Member != null ? $"{a.Member.FirstName} {a.Member.MiddleName} {a.Member.LastName}".Trim() : ""),
                        borrowerCode = a.Member?.MemberCode ?? a.Customer?.CIFNo,
                        borrowerCIF = a.Customer?.CIFNo ?? a.Member?.CIFNo ?? "",
                        loanType = a.LoanRate?.ShortName ?? a.LoanRate?.LoanType ?? "",
                        requestedAmount = a.RequestedAmount,
                        guarantorType = MatchesAppG1(a) ? "जामीनदार १ (Guarantor 1)" : "जामीनदार २ (Guarantor 2)",
                        status = "Pending"
                    }).ToList();

                if (!memberId.HasValue && !customerId.HasValue && gActiveLoans.Count == 0 && gPendingApps.Count == 0) continue;

                resultList.Add(new
                {
                    guarantorMemberID = gMId ?? 0,
                    guarantorCustomerID = gCId ?? 0,
                    guarantorName = gName,
                    guarantorCode = gCode,
                    cifNo = gCif,
                    mobileNo = string.IsNullOrWhiteSpace(gMobile) || gMobile == "0000000000" ? "-" : gMobile,
                    activeGuaranteedLoansCount = gActiveLoans.Count,
                    pendingGuaranteedAppsCount = gPendingApps.Count,
                    totalGuaranteedSanctionedAmount = gActiveLoans.Sum(l => l.sanctionedAmount) + gPendingApps.Sum(a => a.requestedAmount),
                    totalGuaranteedCurrentBalance = gActiveLoans.Sum(l => l.currentBalance),
                    activeLoans = gActiveLoans,
                    pendingApplications = gPendingApps
                });
            }

            return Ok(new
            {
                sansthaInfo = sanstha,
                guarantors = resultList
            });
        }

        private static string MaskAadhaar(string? aadhaar)
        {
            if (string.IsNullOrWhiteSpace(aadhaar)) return "-";
            var clean = aadhaar.Trim().Replace(" ", "").Replace("-", "");
            if (clean.Length == 12)
            {
                return $"XXXX-XXXX-{clean.Substring(8)}";
            }
            if (clean.Length > 4)
            {
                return new string('X', clean.Length - 4) + clean.Substring(clean.Length - 4);
            }
            return clean;
        }

        [HttpGet("aadhaar-list")]
        public async Task<ActionResult<AadhaarReportResponseDto>> GetAadhaarListReport([FromQuery] int? branchId = null)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

            var membersQuery = _context.Members.Include(m => m.Customer).AsQueryable();
            var savingQuery = _context.SavingAccountMasters.AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                membersQuery = membersQuery.Where(m => m.BranchID == branchId.Value);
                savingQuery = savingQuery.Where(s => s.BranchID == branchId.Value);
            }

            var members = await membersQuery.OrderBy(m => m.MemberID).ToListAsync();
            var savingAccounts = await savingQuery.ToListAsync();

            var list = new List<AadhaarReportRowDto>();
            int srNo = 1;
            
            foreach (var m in members)
            {
                var accounts = savingAccounts.Where(a => m.CustomerID.HasValue && a.CustomerID == m.CustomerID.Value).ToList();
                if (accounts.Any())
                {
                    foreach (var a in accounts)
                    {
                        list.Add(new AadhaarReportRowDto
                        {
                            SrNo = srNo++,
                            CifNo = m.MemberCode ?? m.CIFNo ?? "",
                            AccountHolderName = $"{m.FirstName} {m.MiddleName} {m.LastName}".Trim().Replace("  ", " "),
                            SavingAccountNo = a.AccountNo,
                            AadhaarNo = MaskAadhaar(m.AadhaarNo)
                        });
                    }
                }
                else
                {
                    list.Add(new AadhaarReportRowDto
                    {
                        SrNo = srNo++,
                        CifNo = m.MemberCode ?? m.CIFNo ?? "",
                        AccountHolderName = $"{m.FirstName} {m.MiddleName} {m.LastName}".Trim().Replace("  ", " "),
                        SavingAccountNo = "",
                        AadhaarNo = MaskAadhaar(m.AadhaarNo)
                    });
                }
            }

            return Ok(new AadhaarReportResponseDto
            {
                SansthaInfo = sanstha,
                Rows = list
            });
        }
        [HttpGet("SavingKhatavani/{accountId}")]
        public async Task<ActionResult<SavingKhatavaniReportDto>> GetSavingKhatavani(int accountId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            var account = await _context.SavingAccountMasters
                .Include(a => a.Customer)
                    .ThenInclude(c => c!.MemberProfile)
                .Include(a => a.Ledger)
                .FirstOrDefaultAsync(a => a.SavingAccountID == accountId);

            if (account == null)
                return NotFound(new { message = "Saving account not found" });

            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

            var allTransactions = await _context.SavingTransactions
                .Where(t => t.SavingAccountID == accountId)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.TransactionID)
                .ToListAsync();

            // Check if an Opening Balance transaction is already recorded in the transactions table
            bool hasOpeningTxn = allTransactions.Any(t => 
                !string.IsNullOrEmpty(t.Narration) && 
                (t.Narration.IndexOf("Opening Balance", StringComparison.OrdinalIgnoreCase) >= 0 || 
                 t.Narration.Contains("आरंभीची शिल्लक") || 
                 t.Narration.Contains("सुरुवातीची शिल्लक")));

            // Base running balance before the start of all transactions:
            // If an opening transaction exists in table, base starting balance is 0 to prevent double counting.
            // If no opening transaction exists, base starting balance is account.OpeningBalance.
            decimal runningBalance = hasOpeningTxn ? 0 : account.OpeningBalance;
            var responseTxns = new List<SavingKhatavaniTransactionDto>();

            // 1. Calculate Period Opening Balance (transactions before fromDate)
            if (fromDate.HasValue)
            {
                var beforeFromDate = allTransactions.Where(t => t.TransactionDate.Date < fromDate.Value.Date).ToList();
                foreach (var t in beforeFromDate)
                {
                    if (t.TransactionType == "Deposit" || t.TransactionType == "Interest")
                        runningBalance += t.Amount;
                    else
                        runningBalance -= t.Amount;
                }

                // Add "मागील शिल्लक (Opening Balance)" row only if there were prior transactions or runningBalance > 0
                if (beforeFromDate.Count > 0 || runningBalance > 0)
                {
                    responseTxns.Add(new SavingKhatavaniTransactionDto
                    {
                        Date = fromDate.Value.AddDays(-1),
                        Particulars = "मागील शिल्लक (Opening Balance)",
                        Debit = 0,
                        Credit = 0,
                        Balance = runningBalance
                    });
                }
            }
            else
            {
                // If no fromDate was specified and there's no opening txn in table but account.OpeningBalance > 0
                if (!hasOpeningTxn && account.OpeningBalance > 0)
                {
                    responseTxns.Add(new SavingKhatavaniTransactionDto
                    {
                        Date = account.OpeningDate,
                        Particulars = "सुरुवातीची शिल्लक (Opening Balance)",
                        Debit = 0,
                        Credit = 0,
                        Balance = runningBalance
                    });
                }
            }

            decimal periodOpeningBal = runningBalance;

            // 2. Filter transactions within the selected date range
            var periodTxns = allTransactions.AsEnumerable();
            if (fromDate.HasValue)
                periodTxns = periodTxns.Where(t => t.TransactionDate.Date >= fromDate.Value.Date);
            if (toDate.HasValue)
                periodTxns = periodTxns.Where(t => t.TransactionDate.Date <= toDate.Value.Date);

            decimal periodTotalDr = 0;
            decimal periodTotalCr = 0;

            foreach (var t in periodTxns)
            {
                decimal dr = 0;
                decimal cr = 0;
                if (t.TransactionType == "Deposit" || t.TransactionType == "Interest")
                {
                    cr = t.Amount;
                    runningBalance += cr;
                    periodTotalCr += cr;
                }
                else
                {
                    dr = t.Amount;
                    runningBalance -= dr;
                    periodTotalDr += dr;
                }

                string typeLabel = t.TransactionType switch {
                    "Deposit" => "जमा (Deposit)",
                    "Withdrawal" => "नावे (Withdrawal)",
                    "Interest" => "व्याज जमा (Interest)",
                    "Charges" => "शुल्क नावे (Charges)",
                    _ => t.TransactionType
                };

                string particulars = typeLabel;
                if (!string.IsNullOrEmpty(t.PaymentMode) && t.PaymentMode != "Cash")
                    particulars += $" [{t.PaymentMode}]";
                if (!string.IsNullOrEmpty(t.VoucherNo))
                    particulars += $" (व्हा. {t.VoucherNo})";
                if (!string.IsNullOrEmpty(t.Narration))
                    particulars += $" - {t.Narration}";

                responseTxns.Add(new SavingKhatavaniTransactionDto
                {
                    Date = t.TransactionDate,
                    Particulars = particulars,
                    Debit = dr,
                    Credit = cr,
                    Balance = runningBalance
                });
            }

            string holderName = account.Customer != null
                ? $"{account.Customer.FirstName} {account.Customer.MiddleName} {account.Customer.LastName}".Trim()
                : (account.Member != null ? $"{account.Member.FirstName} {account.Member.MiddleName} {account.Member.LastName}".Trim() : "");

            string memberCode = account.Customer?.MemberProfile?.MemberCode ?? account.Member?.MemberCode ?? "";
            string cifNo = account.Customer?.CIFNo ?? (account.Member?.CIFNo ?? "");

            var report = new SavingKhatavaniReportDto
            {
                SansthaDetail = sanstha,
                AccountNo = account.AccountNo,
                OldAccountNo = account.OldAccountNo ?? account.LegacyAccountNumber,
                MemberCode = memberCode,
                CIFNo = cifNo,
                MemberName = holderName,
                AccountType = account.AccountType,
                LedgerName = account.Ledger?.LedgerName ?? "बचत ठेव",
                OpeningDate = account.OpeningDate,
                OpeningBalance = account.OpeningBalance,
                CurrentBalance = account.CurrentBalance,
                InterestRate = account.InterestRate,
                PeriodOpeningBalance = periodOpeningBal,
                PeriodTotalDebit = periodTotalDr,
                PeriodTotalCredit = periodTotalCr,
                ClosingBalance = runningBalance,
                Transactions = responseTxns
            };

            return Ok(report);
        }

        // GET: api/Reports/GoldJewelryReport
        [HttpGet("GoldJewelryReport")]
        public async Task<ActionResult<GoldJewelryReportResponseDto>> GetGoldJewelryReport(
            [FromQuery] int? branchId,
            [FromQuery] int? loanAccountId,
            [FromQuery] string? status,
            [FromQuery] DateTime? asOfDate)
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();

            string branchName = "सर्व शाखा";
            if (branchId.HasValue && branchId.Value > 0)
            {
                var branch = await _context.Branches.FindAsync(branchId.Value);
                if (branch != null)
                {
                    branchName = branch.BranchName;
                }
            }

            var query = _context.GoldLoanDetails
                .Include(g => g.LoanAccount)
                    .ThenInclude(l => l!.Customer)
                .Include(g => g.LoanAccount)
                    .ThenInclude(l => l!.Member)
                .Include(g => g.LoanAccount)
                    .ThenInclude(l => l!.Branch)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(g => g.LoanAccount != null && g.LoanAccount.BranchID == branchId.Value);
            }

            if (loanAccountId.HasValue && loanAccountId.Value > 0)
            {
                query = query.Where(g => g.LoanAccountID == loanAccountId.Value);
            }

            if (!string.IsNullOrWhiteSpace(status) && status.Trim().ToLower() != "all" && status.Trim().ToLower() != "सर्व")
            {
                if (status.Trim().ToLower() == "active" || status.Trim() == "चालू")
                {
                    query = query.Where(g => g.LoanAccount != null && g.LoanAccount.Status == "Active");
                }
                else if (status.Trim().ToLower() == "closed" || status.Trim() == "बंद")
                {
                    query = query.Where(g => g.LoanAccount != null && (g.LoanAccount.Status == "Closed" || g.LoanAccount.Status == "Settled"));
                }
            }

            if (asOfDate.HasValue)
            {
                query = query.Where(g => g.LoanAccount == null || g.LoanAccount.OpeningDate.Date <= asOfDate.Value.Date);
            }

            var goldList = await query
                .OrderBy(g => g.LoanAccount != null ? g.LoanAccount.LoanAccountNo : "")
                .ThenBy(g => g.GoldLoanDetailID)
                .ToListAsync();

            var items = new List<GoldJewelryReportItemDto>();
            int sr = 1;
            var uniqueAccountIds = new HashSet<int>();

            foreach (var g in goldList)
            {
                var l = g.LoanAccount;
                var c = l?.Customer;
                var m = l?.Member;

                string borrowerName = "";
                if (c != null)
                {
                    borrowerName = $"{c.FirstName} {c.MiddleName} {c.LastName}".Trim().Replace("  ", " ");
                    if (!string.IsNullOrEmpty(c.CIFNo))
                    {
                        borrowerName = $"{c.CIFNo} - {borrowerName}";
                    }
                }
                else if (m != null)
                {
                    borrowerName = $"{m.FirstName} {m.MiddleName} {m.LastName}".Trim().Replace("  ", " ");
                    if (!string.IsNullOrEmpty(m.MemberCode))
                    {
                        borrowerName = $"{m.MemberCode} - {borrowerName}";
                    }
                }
                else if (l != null)
                {
                    borrowerName = $"खाते क्र. {l.LoanAccountNo}";
                }

                if (l != null)
                {
                    uniqueAccountIds.Add(l.LoanAccountID);
                }

                items.Add(new GoldJewelryReportItemDto
                {
                    SrNo = sr++,
                    GoldLoanDetailID = g.GoldLoanDetailID,
                    LoanAccountID = g.LoanAccountID,
                    LoanAccountNo = l?.LoanAccountNo ?? g.LoanAccountID.ToString(),
                    CustomerID = l?.CustomerID,
                    CifNo = c?.CIFNo ?? m?.CIFNo ?? "",
                    MemberID = m?.MemberID ?? l?.CustomerID ?? 0,
                    MemberCode = m?.MemberCode ?? c?.CIFNo ?? "",
                    BorrowerName = borrowerName,
                    OrnamentName = g.OrnamentName,
                    EstimatedValue = g.EstimatedValue > 0 ? g.EstimatedValue : (g.NetWeight * g.GoldRatePerGram),
                    NetWeight = g.NetWeight,
                    GrossWeight = g.GrossWeight,
                    Quantity = g.Quantity > 0 ? g.Quantity : 1,
                    Purity = g.Purity,
                    GoldRatePerGram = g.GoldRatePerGram,
                    LoanStatus = l?.Status ?? "Active",
                    SanctionedAmount = l?.SanctionedAmount ?? 0,
                    PrincipalBalance = l?.PrincipalBalance ?? 0,
                    LoanDisbursementDate = l?.LoanDisbursementDate ?? l?.OpeningDate
                });
            }

            var response = new GoldJewelryReportResponseDto
            {
                SansthaInfo = sanstha,
                ReportDate = (asOfDate ?? DateTime.Today).ToString("dd/MM/yyyy"),
                BranchName = branchName,
                Items = items,
                TotalEstimatedValue = items.Sum(i => i.EstimatedValue),
                TotalNetWeight = items.Sum(i => i.NetWeight),
                TotalGrossWeight = items.Sum(i => i.GrossWeight),
                TotalQuantity = items.Sum(i => i.Quantity),
                TotalAccountsCount = uniqueAccountIds.Count
            };

            return Ok(response);
        }
    }


    public class MemberLedgerBalanceDto
    {
        public int MemberID { get; set; }
        public string MemberNo { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public decimal Balance { get; set; }
        public string BalanceType { get; set; } = string.Empty;
    }

    public class MemberLedgerBalanceReportDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public string LedgerName { get; set; } = string.Empty;
        public DateTime AsOfDate { get; set; }
        public List<MemberLedgerBalanceDto> Rows { get; set; } = new();
    }

    public class MemberLedgerTransactionDto
    {
        public DateTime Date { get; set; }
        public string Particulars { get; set; } = string.Empty;
        public string VoucherNo { get; set; } = string.Empty;
        public int SharesQuantity { get; set; }
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public int BalanceShares { get; set; }
        public decimal Balance { get; set; }
        public string BalanceType { get; set; } = string.Empty;
    }

    public class MemberLedgerStatementReportDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public string MemberNo { get; set; } = string.Empty;
        public string LegacyMemberNo { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public string Village { get; set; } = string.Empty;
        public string Taluka { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string AadhaarNo { get; set; } = string.Empty;
        public string PANNo { get; set; } = string.Empty;
        public string LedgerName { get; set; } = string.Empty;
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public decimal OpeningBalance { get; set; }
        public string OpeningBalanceType { get; set; } = string.Empty;
        public int OpeningShares { get; set; }
        public List<MemberLedgerTransactionDto> Transactions { get; set; } = new();
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
        public int TotalDebitShares { get; set; }
        public int TotalCreditShares { get; set; }
        public decimal ClosingBalance { get; set; }
        public string ClosingBalanceType { get; set; } = string.Empty;
        public int ClosingShares { get; set; }
    }

    public class INamunaReportDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public MemberDetailsDto MemberInfo { get; set; } = new();
        public List<INamunaTransactionDto> Transactions { get; set; } = new();
    }

    public class MemberDetailsDto
    {
        public int MemberID { get; set; }
        public string MemberCode { get; set; } = string.Empty;
        public string LegacyMemberNo { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public string AccountNo { get; set; } = string.Empty;
        public DateTime JoiningDate { get; set; }
        public DateTime EntranceFeeDate { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public int AgeAtJoining { get; set; }
        public string NomineeName { get; set; } = string.Empty;
        public string NomineeAddress { get; set; } = string.Empty;
        public DateTime? NominationDate { get; set; }
        public DateTime? CessationDate { get; set; }
        public string Occupation { get; set; } = string.Empty;
        public string CessationReason { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
    }

    public class INamunaTransactionDto
    {
        public DateTime? AllotmentDate { get; set; }
        public string? AllotmentCashbookNo { get; set; }
        public string Application { get; set; } = string.Empty;
        public decimal TotalAmountReceived { get; set; }
        public int NumberOfSharesHeld { get; set; }
        public string AllotmentCertificateNo { get; set; } = string.Empty;

        public DateTime? TransferDate { get; set; }
        public string? TransferCashbookNo { get; set; }
        public int NumberOfSharesTransferred { get; set; }
        public int NumberOfSharesReturned { get; set; }

        public decimal BalanceAmount { get; set; }
        public string BalanceCertificateNo { get; set; } = string.Empty;
        public string Remarks { get; set; } = string.Empty;
    }
}




    public class AadhaarReportRowDto
    {
        public int SrNo { get; set; }
        public string CifNo { get; set; } = string.Empty;
        public string AccountHolderName { get; set; } = string.Empty;
        public string SavingAccountNo { get; set; } = string.Empty;
        public string AadhaarNo { get; set; } = string.Empty;
    }

    public class AadhaarReportResponseDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public List<AadhaarReportRowDto> Rows { get; set; } = new();
    }

    public class INamunaRegisterRowDto
    {
        public int SrNo { get; set; }
        public int MemberID { get; set; }
        public string MemberCode { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string FullNameEng { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string Occupation { get; set; } = string.Empty;
        public DateTime JoiningDate { get; set; }
        public int? AgeAtJoining { get; set; }
        public int TotalShareCount { get; set; } = 0;
        public decimal TotalShareAmount { get; set; } = 0;
        public string CertificateNos { get; set; } = string.Empty;
        public string NomineeName { get; set; } = string.Empty;
        public string NomineeRelation { get; set; } = string.Empty;
        public string NomineeAddress { get; set; } = string.Empty;
        public bool NomineeIsMinor { get; set; } = false;
        public string? NomineeGuardianName { get; set; }
        public string Status { get; set; } = "Active";
        public DateTime? CessationDate { get; set; }
        public string? CessationReason { get; set; }
        public string? Remarks { get; set; }
    }

    public class INamunaRegisterResponseDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public List<INamunaRegisterRowDto> Rows { get; set; } = new();
        public int TotalMembers { get; set; }
        public int TotalShares { get; set; }
        public decimal TotalShareCapital { get; set; }
    }

    public class VoterListRowDto
    {
        public int SrNo { get; set; }
        public int MemberID { get; set; }
        public string MemberCode { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string FullNameEng { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public string MembershipType { get; set; } = "Regular";
        public int TotalShareCount { get; set; } = 0;
        public decimal TotalShareAmount { get; set; } = 0;
        public string JointMemberNames { get; set; } = string.Empty;
        public string Status { get; set; } = "Active";
        public bool IsVotingEligible { get; set; } = true;
        public string VotingEligibilityText { get; set; } = "पात्र (Eligible)";
        public string? IneligibilityReason { get; set; }
    }

    public class VoterListResponseDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public List<VoterListRowDto> Rows { get; set; } = new();
        public int TotalMembers { get; set; }
        public int TotalEligibleVoters { get; set; }
        public int TotalIneligibleVoters { get; set; }
        public int TotalShares { get; set; }
        public decimal TotalShareCapital { get; set; }
    }

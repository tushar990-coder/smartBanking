using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public class VoucherDeleteRequestContext
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string UserRole { get; set; } = string.Empty;
        public int UserBranchId { get; set; }
        public bool IsHeadOfficeAdmin { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string ActionSource { get; set; } = "VOUCHER_HARD_DELETE";
        public bool EnforceSameBusinessDateForBranchUser { get; set; } = false;
        public bool RequireMinTenCharReason { get; set; } = false;
        public string? ClientIpAddress { get; set; }
    }

    public class VoucherDeleteResult
    {
        public bool Success { get; set; }
        public int HttpStatusCode { get; set; } = StatusCodes.Status200OK;
        public string Message { get; set; } = string.Empty;
        public int DeletedPrimaryVoucherId { get; set; }
        public string DeletedPrimaryVoucherNo { get; set; } = string.Empty;
        public List<string> DeletedVoucherNos { get; set; } = new();
    }

    public class LoanInterestBatchAccountSnapshot
    {
        public int LoanAccountID { get; set; }
        public decimal Interest { get; set; }
        public bool Capitalized { get; set; }
        public DateTime? PrevLastPaidDate { get; set; }
    }

    internal sealed class VoucherRollbackDomainException : Exception
    {
        public int StatusCode { get; }

        public VoucherRollbackDomainException(int statusCode, string message) : base(message)
        {
            StatusCode = statusCode;
        }
    }

    /// <summary>
    /// Unified CBS Hard-Delete &amp; Full Parent State Rollback Service across all 17 ERP modules.
    /// Physically removes Pending/Unapproved Vouchers, VoucherDetails, and every linked module
    /// transaction row from SQL Server (zero soft-delete), while restoring parent account state
    /// and respecting global DeleteBehavior.Restrict FK constraints.
    /// </summary>
    public class VoucherRollbackAndDeleteService
    {
        public const string BatchSnapshotPrefix = "[BATCH_SNAPSHOT:";

        private readonly AppDbContext _context;

        public VoucherRollbackAndDeleteService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<VoucherDeleteResult> DeleteVoucherWithRollbackAsync(
            int voucherId,
            VoucherDeleteRequestContext req)
        {
            string cleanReason = (req.Reason ?? string.Empty).Trim();
            if (req.RequireMinTenCharReason)
            {
                if (cleanReason.Length < 10)
                {
                    return new VoucherDeleteResult
                    {
                        Success = false,
                        HttpStatusCode = StatusCodes.Status400BadRequest,
                        Message = "ऑडिट नियमांनुसार व्हाउचर डिलीट करण्याचे किमान १० अक्षरांचे स्पष्ट कारण देणे आवश्यक आहे."
                    };
                }
            }
            else if (string.IsNullOrWhiteSpace(cleanReason))
            {
                return new VoucherDeleteResult
                {
                    Success = false,
                    HttpStatusCode = StatusCodes.Status400BadRequest,
                    Message = "व्हाउचर नाकारण्याचे / डिलीट करण्याचे कारण देणे आवश्यक आहे."
                };
            }

            bool ownsTransaction = _context.Database.CurrentTransaction == null;
            await using var transaction = ownsTransaction
                ? await _context.Database.BeginTransactionAsync()
                : null;

            try
            {
                var primaryVoucher = await _context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

                if (primaryVoucher == null)
                {
                    if (ownsTransaction && transaction != null) await transaction.RollbackAsync();
                    return new VoucherDeleteResult
                    {
                        Success = false,
                        HttpStatusCode = StatusCodes.Status404NotFound,
                        Message = "व्हाउचर सापडले नाही (Voucher not found)."
                    };
                }

                // 1. Branch authorization guard
                if (!req.IsHeadOfficeAdmin)
                {
                    bool allowedBranch = primaryVoucher.BranchID == req.UserBranchId ||
                                         (primaryVoucher.IsIbtVoucher && primaryVoucher.TargetBranchID == req.UserBranchId);
                    if (!allowedBranch)
                    {
                        throw new VoucherRollbackDomainException(
                            StatusCodes.Status403Forbidden,
                            "तुम्हाला इतर शाखेचे व्हाउचर नाकारण्याची किंवा डिलीट करण्याची परवानगी नाही.");
                    }
                }

                // 2. Discover complete paired/sibling voucher group (IBT, LoanCollection dual-voucher, LockerAllotment dual-voucher)
                var voucherGroup = await DiscoverVoucherGroupAsync(primaryVoucher);

                // 3. Strictly block Approved vouchers across the entire group
                var approvedVoucher = voucherGroup.FirstOrDefault(v =>
                    string.Equals(v.Status, "Approved", StringComparison.OrdinalIgnoreCase));
                if (approvedVoucher != null)
                {
                    throw new VoucherRollbackDomainException(
                        StatusCodes.Status400BadRequest,
                        $"मंजूर (Approved/Passed) व्हाउचर ({approvedVoucher.VoucherNo}) थेट डिलीट करता येत नाही. प्रथम व्हाउचर अन-पास (Unpass) करा आणि मग प्रलंबित यादीतून डिलीट करा.");
                }

                // 4. Financial Year & EOD / Active Business Date guards
                await ValidateFinancialYearAndDayEndGuardsAsync(primaryVoucher, voucherGroup, req);

                var voucherIds = voucherGroup.Select(v => v.VoucherID).Distinct().ToHashSet();
                var voucherNos = voucherGroup
                    .Where(v => !string.IsNullOrWhiteSpace(v.VoucherNo))
                    .Select(v => v.VoucherNo!.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                string primaryVoucherNo = primaryVoucher.VoucherNo ?? $"ID-{primaryVoucher.VoucherID}";
                decimal primaryTotalAmount = primaryVoucher.TotalAmount;
                DateTime primaryVoucherDate = primaryVoucher.VoucherDate.Date;

                // 5. Break circular self-referencing Vouchers.RelatedVoucherID FKs FIRST
                await UnlinkRelatedVoucherReferencesAsync(voucherIds);

                // Shared trackers to guarantee zero double-reversal & chronological running-balance integrity
                var reversedSavingTxnIds = new HashSet<int>();
                var affectedSavingAccountIds = new HashSet<int>();
                var affectedPigmyAccountIds = new HashSet<int>();
                var rolledBackLoanCollectionIds = new HashSet<int>();
                var extraDeletedVoucherNos = new HashSet<string>(voucherNos, StringComparer.OrdinalIgnoreCase);

                // =========================================================================
                // MODULE 1: DECEASED CLAIM SETTLEMENT (VCH-CLM-* / DeceasedClaimSettlements)
                // =========================================================================
                await RollbackDeceasedClaimsAsync(voucherIds, voucherNos, affectedPigmyAccountIds);

                // =========================================================================
                // MODULE 2: DEMAND RECOVERY (VCH-DMD-* / DemandRecoveries)
                // =========================================================================
                var demandRecoveryRows = await _context.DemandRecoveries
                    .Where(d => d.VoucherId.HasValue && voucherIds.Contains(d.VoucherId.Value))
                    .ToListAsync();
                var affectedDemandNoticeIds = demandRecoveryRows.Select(d => d.DemandNoticeId).Distinct().ToList();
                if (demandRecoveryRows.Any())
                {
                    // Reverse Demand's Pigmy credit deposits (linked via ReferenceId == VoucherNo)
                    var demandPigmyTxs = await _context.PigmyTransactions
                        .Where(pt => pt.ReferenceId != null &&
                                     voucherNos.Contains(pt.ReferenceId) &&
                                     pt.TransactionType == "DEPOSIT")
                        .ToListAsync();
                    foreach (var pt in demandPigmyTxs)
                    {
                        var pAcc = await _context.PigmyAccounts.FindAsync(pt.PigmyAccountID);
                        if (pAcc != null)
                        {
                            pAcc.TotalDepositedAmount = Math.Max(0m, Math.Round(pAcc.TotalDepositedAmount - pt.CrAmount, 2, MidpointRounding.AwayFromZero));
                            _context.Entry(pAcc).State = EntityState.Modified;
                            affectedPigmyAccountIds.Add(pAcc.PigmyAccountID);
                        }
                        _context.PigmyTransactions.Remove(pt);
                    }
                }

                // =========================================================================
                // MODULE 3: FIXED DEPOSIT (Renewal, MIS, Accrual, Closure/FD Settlement, Single & Bulk Opening)
                // =========================================================================
                await RollbackFdModuleAsync(
                    primaryVoucher,
                    voucherGroup,
                    voucherIds,
                    voucherNos,
                    reversedSavingTxnIds,
                    affectedSavingAccountIds,
                    affectedPigmyAccountIds,
                    rolledBackLoanCollectionIds,
                    extraDeletedVoucherNos);

                // =========================================================================
                // MODULE 4: RECURRING DEPOSIT (Closure/Renewal, Installment, Accrual, Opening)
                // =========================================================================
                await RollbackRdModuleAsync(
                    primaryVoucher,
                    voucherIds,
                    voucherNos,
                    cleanReason,
                    req,
                    reversedSavingTxnIds,
                    affectedSavingAccountIds);

                // =========================================================================
                // MODULE 5: PIGMY DEPOSIT (AgentDayBook, Direct Collection, Opening, Interest, Commission, Withdrawal & Closure)
                // =========================================================================
                await RollbackPigmyModuleAsync(
                    primaryVoucher,
                    voucherIds,
                    voucherNos,
                    affectedPigmyAccountIds);

                // =========================================================================
                // MODULE 6: SHARE & MEMBER (Allotment, Transfer, Withdrawal/Member Closure, Dividends)
                // =========================================================================
                await RollbackShareAndMemberModuleAsync(
                    voucherGroup,
                    voucherIds,
                    voucherNos);

                // =========================================================================
                // MODULE 7: LOAN, NPA & LEGAL (Disbursement, Collection, Legal Expense, Batch Interest & NPA)
                // =========================================================================
                await RollbackLoanNpaLegalModuleAsync(
                    primaryVoucher,
                    voucherIds,
                    voucherNos,
                    reversedSavingTxnIds,
                    affectedSavingAccountIds,
                    affectedPigmyAccountIds,
                    rolledBackLoanCollectionIds);

                // Finalize DemandNotice Status after all Demand sub-ledgers (Share/Saving/RD/Pigmy/Loan) rolled back
                if (demandRecoveryRows.Any())
                {
                    _context.DemandRecoveries.RemoveRange(demandRecoveryRows);
                    await _context.SaveChangesAsync();

                    foreach (int noticeId in affectedDemandNoticeIds)
                    {
                        var notice = await _context.DemandNotices.FindAsync(noticeId);
                        if (notice == null) continue;

                        decimal remainingRecovered = await _context.DemandRecoveries
                            .Where(r => r.DemandNoticeId == noticeId)
                            .SumAsync(r => (decimal?)r.TotalReceivedAmount) ?? 0m;

                        if (remainingRecovered <= 0.009m)
                        {
                            notice.Status = "Pending";
                            var memberDetails = await _context.DemandMemberDetails
                                .Where(m => m.DemandNoticeId == noticeId && m.IsProcessed)
                                .ToListAsync();
                            foreach (var md in memberDetails)
                            {
                                md.IsProcessed = false;
                                _context.Entry(md).State = EntityState.Modified;
                            }
                        }
                        else if (remainingRecovered < notice.TotalDemandAmount - 0.009m)
                        {
                            notice.Status = "PartiallyReceived";
                        }
                        _context.Entry(notice).State = EntityState.Modified;
                    }
                    await _context.SaveChangesAsync();
                }

                // =========================================================================
                // MODULE 8: INVESTMENT (Maturity, Premature, Renewal, Interest Receipt/Accrual, Opening)
                // =========================================================================
                await RollbackInvestmentModuleAsync(voucherIds, voucherNos);

                // =========================================================================
                // MODULE 9: LOCKER (Surrender, Allotment, Rent Posting)
                // =========================================================================
                await RollbackLockerModuleAsync(voucherIds);

                // =========================================================================
                // MODULE 10: FIXED ASSETS (Purchase, Maintenance, Disposal, Depreciation)
                // =========================================================================
                await RollbackFixedAssetModuleAsync(voucherIds);

                // =========================================================================
                // MODULE 11: SAVING (Account Closing, Interest Posting, Direct Txns, Opening & Passbook Resync)
                // =========================================================================
                await RollbackSavingModuleAsync(
                    voucherIds,
                    voucherNos,
                    reversedSavingTxnIds,
                    affectedSavingAccountIds);

                // =========================================================================
                // MODULE 12: CASH MANAGEMENT (CashAllocations & CashDenominations)
                // =========================================================================
                await RollbackCashManagementAsync(voucherNos);

                // Flush all sub-ledger removals & parent state updates before running-balance resync
                await _context.SaveChangesAsync();

                // Recalculate chronological running balances on surviving Saving & Pigmy accounts
                if (affectedSavingAccountIds.Any())
                {
                    await RecalculateSavingRunningBalancesAsync(affectedSavingAccountIds);
                }
                if (affectedPigmyAccountIds.Any())
                {
                    await RecalculatePigmyRunningBalancesAsync(affectedPigmyAccountIds);
                }

                // Clean up pending SystemNotifications for the deleted vouchers
                var idStrings = voucherIds.Select(id => id.ToString(CultureInfo.InvariantCulture)).ToHashSet();
                var voucherNotifications = await _context.SystemNotifications
                    .Where(n => n.EntityName == "Voucher" &&
                                n.EntityID != null &&
                                (idStrings.Contains(n.EntityID) || voucherNos.Contains(n.EntityID)))
                    .ToListAsync();
                if (voucherNotifications.Any())
                {
                    _context.SystemNotifications.RemoveRange(voucherNotifications);
                }

                // Record immutable AuditLog entry
                string actorUsername = !string.IsNullOrWhiteSpace(req.Username)
                    ? req.Username
                    : $"User-{req.UserId}";

                _context.AuditLogs.Add(new AuditLog
                {
                    UserID = req.UserId > 0 ? req.UserId : null,
                    Username = actorUsername,
                    Action = string.IsNullOrWhiteSpace(req.ActionSource) ? "VOUCHER_HARD_DELETE" : req.ActionSource,
                    EntityName = "Voucher",
                    EntityID = primaryVoucherNo.Length > 50 ? primaryVoucherNo.Substring(0, 50) : primaryVoucherNo,
                    Timestamp = DateTime.Now,
                    IPAddress = req.ClientIpAddress,
                    Details = $"व्हाउचर {string.Join(", ", extraDeletedVoucherNos)} (तारीख: {primaryVoucherDate:dd/MM/yyyy}, रक्कम: ₹{primaryTotalAmount:N2}) आणि सर्व संलग्न सब-लेजर नोंदी १००% फिजिकल हार्ड-डिलीट करून खात्यांची मूळ स्थिती पूर्ववत केली. कारण: {cleanReason}",
                    Status = "Success"
                });

                await _context.SaveChangesAsync();

                // Physically delete VoucherDetails & Vouchers for any remaining vouchers in voucherIds
                // (some helpers like FdRenewalRollbackHelper / RdClosureSettlementHelper may have already deleted sibling vouchers)
                await UnlinkRelatedVoucherReferencesAsync(voucherIds);

                var remainingDetails = await _context.VoucherDetails
                    .Where(vd => voucherIds.Contains(vd.VoucherID))
                    .ToListAsync();
                if (remainingDetails.Any())
                {
                    _context.VoucherDetails.RemoveRange(remainingDetails);
                    await _context.SaveChangesAsync();
                }

                var remainingVouchers = await _context.Vouchers
                    .Where(v => voucherIds.Contains(v.VoucherID))
                    .ToListAsync();
                if (remainingVouchers.Any())
                {
                    _context.Vouchers.RemoveRange(remainingVouchers);
                    await _context.SaveChangesAsync();
                }

                if (ownsTransaction && transaction != null)
                {
                    await transaction.CommitAsync();
                }

                return new VoucherDeleteResult
                {
                    Success = true,
                    HttpStatusCode = StatusCodes.Status200OK,
                    Message = $"व्हाउचर {primaryVoucherNo} आणि सर्व संलग्न नोंदी डेटाबेसमधून पूर्णपणे डिलीट करून खात्याची मूळ स्थिती पूर्ववत करण्यात आली आहे.",
                    DeletedPrimaryVoucherId = primaryVoucher.VoucherID,
                    DeletedPrimaryVoucherNo = primaryVoucherNo,
                    DeletedVoucherNos = extraDeletedVoucherNos.ToList()
                };
            }
            catch (VoucherRollbackDomainException dex)
            {
                if (ownsTransaction && transaction != null)
                {
                    await transaction.RollbackAsync();
                    _context.ChangeTracker.Clear();
                }

                return new VoucherDeleteResult
                {
                    Success = false,
                    HttpStatusCode = dex.StatusCode,
                    Message = dex.Message
                };
            }
            catch (InvalidOperationException ioex)
            {
                if (ownsTransaction && transaction != null)
                {
                    await transaction.RollbackAsync();
                    _context.ChangeTracker.Clear();
                }

                return new VoucherDeleteResult
                {
                    Success = false,
                    HttpStatusCode = StatusCodes.Status400BadRequest,
                    Message = ioex.Message
                };
            }
            catch (Exception ex)
            {
                if (ownsTransaction && transaction != null)
                {
                    await transaction.RollbackAsync();
                    _context.ChangeTracker.Clear();
                }

                return new VoucherDeleteResult
                {
                    Success = false,
                    HttpStatusCode = StatusCodes.Status500InternalServerError,
                    Message = "व्हाउचर डिलीट व स्टेट रोलबॅक करताना तांत्रिक त्रुटी आली: " + (ex.InnerException?.Message ?? ex.Message)
                };
            }
        }

        // =====================================================================
        // GROUP DISCOVERY, GUARDS & SELF-FK UNLINKING
        // =====================================================================

        private async Task<List<Voucher>> DiscoverVoucherGroupAsync(Voucher primaryVoucher)
        {
            var groupById = new Dictionary<int, Voucher>
            {
                [primaryVoucher.VoucherID] = primaryVoucher
            };

            var queue = new Queue<int>();
            queue.Enqueue(primaryVoucher.VoucherID);

            while (queue.Count > 0)
            {
                int currentId = queue.Dequeue();
                var current = groupById[currentId];

                var discoveredIds = new HashSet<int>();
                if (current.RelatedVoucherID.HasValue && current.RelatedVoucherID.Value > 0)
                {
                    discoveredIds.Add(current.RelatedVoucherID.Value);
                }

                var reverseRelatedIds = await _context.Vouchers
                    .Where(v => v.RelatedVoucherID == currentId)
                    .Select(v => v.VoucherID)
                    .ToListAsync();
                foreach (var rid in reverseRelatedIds) discoveredIds.Add(rid);

                // Dual-voucher LoanCollections (VoucherID <-> HomeBranchVoucherID)
                var lcDuals = await _context.LoanCollections
                    .Where(lc => lc.VoucherID == currentId || lc.HomeBranchVoucherID == currentId)
                    .Select(lc => new { lc.VoucherID, lc.HomeBranchVoucherID })
                    .ToListAsync();
                foreach (var lc in lcDuals)
                {
                    if (lc.VoucherID.HasValue && lc.VoucherID.Value > 0) discoveredIds.Add(lc.VoucherID.Value);
                    if (lc.HomeBranchVoucherID.HasValue && lc.HomeBranchVoucherID.Value > 0) discoveredIds.Add(lc.HomeBranchVoucherID.Value);
                }

                // Dual-voucher LockerAllotments (DepositVoucherID <-> AdvanceRentVoucherID)
                var lkrDuals = await _context.LockerAllotments
                    .Where(a => a.DepositVoucherID == currentId || a.AdvanceRentVoucherID == currentId)
                    .Select(a => new { a.DepositVoucherID, a.AdvanceRentVoucherID })
                    .ToListAsync();
                foreach (var lkr in lkrDuals)
                {
                    if (lkr.DepositVoucherID.HasValue && lkr.DepositVoucherID.Value > 0) discoveredIds.Add(lkr.DepositVoucherID.Value);
                    if (lkr.AdvanceRentVoucherID.HasValue && lkr.AdvanceRentVoucherID.Value > 0) discoveredIds.Add(lkr.AdvanceRentVoucherID.Value);
                }

                foreach (int nextId in discoveredIds)
                {
                    if (!groupById.ContainsKey(nextId))
                    {
                        var nextV = await _context.Vouchers
                            .Include(v => v.VoucherDetails)
                            .FirstOrDefaultAsync(v => v.VoucherID == nextId);
                        if (nextV != null)
                        {
                            groupById[nextId] = nextV;
                            queue.Enqueue(nextId);
                        }
                    }
                }
            }

            return groupById.Values.ToList();
        }

        private async Task ValidateFinancialYearAndDayEndGuardsAsync(
            Voucher primaryVoucher,
            List<Voucher> voucherGroup,
            VoucherDeleteRequestContext req)
        {
            DateTime vDate = primaryVoucher.VoucherDate.Date;

            bool isClosedFy = await _context.FinancialYears
                .AnyAsync(fy => fy.IsClosed && vDate >= fy.StartDate.Date && vDate <= fy.EndDate.Date);
            if (isClosedFy)
            {
                throw new VoucherRollbackDomainException(
                    StatusCodes.Status400BadRequest,
                    $"तारीख {vDate:dd/MM/yyyy} ही बंद केलेल्या आर्थिक वर्षात (Closed Financial Year) येत असल्यामुळे हे व्हाउचर डिलीट करता येत नाही.");
            }

            if (!req.IsHeadOfficeAdmin)
            {
                var branchIdsToCheck = voucherGroup
                    .Select(v => v.BranchID)
                    .Where(b => b > 0)
                    .Distinct()
                    .ToList();

                foreach (int bId in branchIdsToCheck)
                {
                    bool exactClosed = await _context.BranchDayEndStatuses
                        .AnyAsync(b => b.BranchID == bId && b.BusinessDate.Date == vDate && b.IsDayClosed);

                    DateTime? latestClosed = await _context.BranchDayEndStatuses
                        .Where(b => b.BranchID == bId && b.IsDayClosed)
                        .OrderByDescending(b => b.BusinessDate)
                        .Select(b => (DateTime?)b.BusinessDate)
                        .FirstOrDefaultAsync();

                    if (exactClosed || (latestClosed.HasValue && vDate <= latestClosed.Value.Date))
                    {
                        throw new VoucherRollbackDomainException(
                            StatusCodes.Status400BadRequest,
                            $"शाखा क्र. #{bId} साठी दिनांक {vDate:dd/MM/yyyy} चा डे-एंड (EOD) बंद झालेला असल्यामुळे हे व्हाउचर डिलीट करता येत नाही.");
                    }
                }

                if (req.EnforceSameBusinessDateForBranchUser)
                {
                    int checkBranchId = req.UserBranchId > 0 ? req.UserBranchId : primaryVoucher.BranchID;
                    DateTime activeBusinessDate = await _context.BranchDayEndStatuses
                        .Where(b => b.BranchID == checkBranchId && !b.IsDayClosed)
                        .OrderByDescending(b => b.BusinessDate)
                        .Select(b => (DateTime?)b.BusinessDate)
                        .FirstOrDefaultAsync() ?? DateTime.Today;

                    if (vDate != activeBusinessDate.Date)
                    {
                        throw new VoucherRollbackDomainException(
                            StatusCodes.Status403Forbidden,
                            $"शाखा वापरकर्त्यांना फक्त चालू कामकाजाच्या तारखेचे ({activeBusinessDate:dd/MM/yyyy}) प्रलंबित व्हाउचर डिलीट करण्याची परवानगी आहे.");
                    }
                }
            }
        }

        private async Task UnlinkRelatedVoucherReferencesAsync(HashSet<int> voucherIds)
        {
            if (!voucherIds.Any()) return;

            var relatedVouchers = await _context.Vouchers
                .Where(v => voucherIds.Contains(v.VoucherID) ||
                            (v.RelatedVoucherID.HasValue && voucherIds.Contains(v.RelatedVoucherID.Value)))
                .ToListAsync();

            bool modified = false;
            foreach (var rv in relatedVouchers)
            {
                if (rv.RelatedVoucherID.HasValue)
                {
                    rv.RelatedVoucherID = null;
                    _context.Entry(rv).State = EntityState.Modified;
                    modified = true;
                }
            }

            if (modified)
            {
                await _context.SaveChangesAsync();
            }
        }

        // =====================================================================
        // IDEMPOTENT SINGLE-PASS SAVING REVERSAL & PASSBOOK RESYNC
        // =====================================================================

        private async Task ReverseAndHardDeleteSavingTxnOnceAsync(
            SavingTransaction st,
            HashSet<int> reversedSavingTxnIds,
            HashSet<int> affectedSavingAccountIds)
        {
            if (!reversedSavingTxnIds.Add(st.TransactionID))
            {
                return;
            }

            var passbookRows = await _context.SavingPassbooks
                .Where(p => p.TransactionID == st.TransactionID)
                .ToListAsync();
            if (passbookRows.Any())
            {
                _context.SavingPassbooks.RemoveRange(passbookRows);
            }

            var savAcc = await _context.SavingAccountMasters.FindAsync(st.SavingAccountID);
            if (savAcc != null)
            {
                if (st.TransactionType == "Deposit" || st.TransactionType == "Interest")
                {
                    savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance - st.Amount, 2, MidpointRounding.AwayFromZero);
                }
                else if (st.TransactionType == "Withdrawal" || st.TransactionType == "Charges")
                {
                    savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance + st.Amount, 2, MidpointRounding.AwayFromZero);
                }
                _context.Entry(savAcc).State = EntityState.Modified;
                affectedSavingAccountIds.Add(savAcc.SavingAccountID);
            }

            _context.SavingTransactions.Remove(st);

            // Handle legacy unstamped internal Saving-to-Saving transfer counter-row if VoucherNo was null on target leg
            if (st.TargetSavingAccountID.HasValue && st.TargetSavingAccountID.Value > 0)
            {
                string expectedCounterType = (st.TransactionType == "Withdrawal") ? "Deposit" : "Withdrawal";
                var unstampedCounter = await _context.SavingTransactions
                    .FirstOrDefaultAsync(ct =>
                        ct.TransactionID != st.TransactionID &&
                        ct.SavingAccountID == st.TargetSavingAccountID.Value &&
                        ct.TargetSavingAccountID == st.SavingAccountID &&
                        ct.TransactionType == expectedCounterType &&
                        ct.Amount == st.Amount &&
                        ct.TransactionDate.Date == st.TransactionDate.Date &&
                        ct.VoucherNo == null);

                if (unstampedCounter != null)
                {
                    await ReverseAndHardDeleteSavingTxnOnceAsync(unstampedCounter, reversedSavingTxnIds, affectedSavingAccountIds);
                }
            }
        }

        private async Task ReverseAllSavingTransactionsByVoucherNosAsync(
            HashSet<string> voucherNos,
            HashSet<int> reversedSavingTxnIds,
            HashSet<int> affectedSavingAccountIds)
        {
            if (!voucherNos.Any()) return;

            var vNoList = voucherNos.ToList();
            var matchedTxns = await _context.SavingTransactions
                .Where(st => st.VoucherNo != null && vNoList.Contains(st.VoucherNo))
                .OrderByDescending(st => st.TransactionDate)
                .ThenByDescending(st => st.TransactionID)
                .ToListAsync();

            foreach (var st in matchedTxns)
            {
                await ReverseAndHardDeleteSavingTxnOnceAsync(st, reversedSavingTxnIds, affectedSavingAccountIds);
            }
        }

        private async Task RecalculateSavingRunningBalancesAsync(HashSet<int> savingAccountIds)
        {
            foreach (int savAccId in savingAccountIds)
            {
                var savAcc = await _context.SavingAccountMasters.FindAsync(savAccId);
                if (savAcc == null) continue;

                var txns = await _context.SavingTransactions
                    .Where(t => t.SavingAccountID == savAccId)
                    .OrderBy(t => t.TransactionDate)
                    .ThenBy(t => t.TransactionID)
                    .ToListAsync();

                if (!txns.Any()) continue;

                decimal netTxEffect = 0m;
                foreach (var t in txns)
                {
                    if (t.TransactionType == "Deposit" || t.TransactionType == "Interest")
                        netTxEffect += t.Amount;
                    else if (t.TransactionType == "Withdrawal" || t.TransactionType == "Charges")
                        netTxEffect -= t.Amount;
                }

                // Anchor backward from savAcc.CurrentBalance so both legacy and fresh accounts stay 100% consistent
                decimal running = Math.Round(savAcc.CurrentBalance - netTxEffect, 2, MidpointRounding.AwayFromZero);
                bool changed = false;
                foreach (var t in txns)
                {
                    if (t.TransactionType == "Deposit" || t.TransactionType == "Interest")
                        running = Math.Round(running + t.Amount, 2, MidpointRounding.AwayFromZero);
                    else if (t.TransactionType == "Withdrawal" || t.TransactionType == "Charges")
                        running = Math.Round(running - t.Amount, 2, MidpointRounding.AwayFromZero);

                    if (Math.Abs(t.BalanceAfterTxn - running) >= 0.01m)
                    {
                        t.BalanceAfterTxn = running;
                        _context.Entry(t).State = EntityState.Modified;
                        changed = true;
                    }
                }

                if (changed)
                {
                    await _context.SaveChangesAsync();
                }
            }
        }

        private async Task RecalculatePigmyRunningBalancesAsync(HashSet<int> pigmyAccountIds)
        {
            foreach (int pgId in pigmyAccountIds)
            {
                var pAcc = await _context.PigmyAccounts.FindAsync(pgId);
                if (pAcc == null) continue;

                var txns = await _context.PigmyTransactions
                    .Where(t => t.PigmyAccountID == pgId)
                    .OrderBy(t => t.TransactionDate)
                    .ThenBy(t => t.PigmyTransactionID)
                    .ToListAsync();

                if (!txns.Any()) continue;

                decimal running = 0m;
                bool changed = false;
                foreach (var t in txns)
                {
                    running = Math.Round(running + t.CrAmount - t.DrAmount, 2, MidpointRounding.AwayFromZero);
                    if (Math.Abs(t.BalanceAmount - running) >= 0.01m)
                    {
                        t.BalanceAmount = running;
                        _context.Entry(t).State = EntityState.Modified;
                        changed = true;
                    }
                }

                if (changed)
                {
                    await _context.SaveChangesAsync();
                }
            }
        }

        // =====================================================================
        // MODULE 1: DECEASED CLAIM SETTLEMENT
        // =====================================================================

        private async Task RollbackDeceasedClaimsAsync(
            HashSet<int> voucherIds,
            HashSet<string> voucherNos,
            HashSet<int> affectedPigmyAccountIds)
        {
            var claims = await _context.DeceasedClaimSettlements
                .Where(c => c.VoucherID.HasValue && voucherIds.Contains(c.VoucherID.Value))
                .ToListAsync();

            if (!claims.Any()) return;

            foreach (var claim in claims)
            {
                var member = await _context.Members.FindAsync(claim.MemberID);
                if (member != null)
                {
                    member.Status = "Active";
                    _context.Entry(member).State = EntityState.Modified;

                    // Reopen Saving accounts of this deceased member that had 0 balance or were closed by this claim
                    if (member.CustomerID.HasValue && member.CustomerID.Value > 0)
                    {
                        var closedSavs = await _context.SavingAccountMasters
                            .Where(s => s.CustomerID == member.CustomerID.Value &&
                                        s.Status == "Closed" &&
                                        (!s.ClosingDate.HasValue || s.ClosingDate.Value.Date == claim.SettlementDate.Date))
                            .ToListAsync();
                        foreach (var s in closedSavs)
                        {
                            s.Status = "Active";
                            s.ClosingDate = null;
                            _context.Entry(s).State = EntityState.Modified;
                        }
                    }

                    // Restore ShareAccount & ShareCertificates cancelled/surrendered due to Deceased Claim
                    var shareAccounts = await _context.ShareAccounts
                        .Where(sa => sa.MemberId == member.MemberID)
                        .ToListAsync();
                    foreach (var sa in shareAccounts)
                    {
                        if (sa.Status == "Closed")
                        {
                            sa.Status = "Active";
                            _context.Entry(sa).State = EntityState.Modified;
                        }

                        var deceasedCerts = await _context.ShareCertificates
                            .Where(c => c.ShareAccountId == sa.ShareAccountId &&
                                        (c.Status == "Cancelled" || c.Status == "Surrendered") &&
                                        (c.CancellationReason == null ||
                                         c.CancellationReason.Contains("Deceased") ||
                                         c.CancellationReason.Contains("मयत") ||
                                         c.CancellationReason.Contains("Claim")))
                            .ToListAsync();
                        foreach (var cert in deceasedCerts)
                        {
                            cert.Status = "Active";
                            cert.CancellationReason = null;
                            if (cert.ToShareNo >= cert.FromShareNo && cert.FromShareNo > 0)
                            {
                                cert.NumberOfShares = (int)(cert.ToShareNo - cert.FromShareNo + 1);
                            }
                            _context.Entry(cert).State = EntityState.Modified;
                        }
                    }
                }
            }

            // Reverse Deceased Claim Pigmy closure transactions (ReferenceId == VoucherNo or Narration contains VoucherNo)
            if (voucherNos.Any())
            {
                var vNoList = voucherNos.ToList();
                var claimPigmyTxs = await _context.PigmyTransactions
                    .Where(pt => (pt.ReferenceId != null && vNoList.Contains(pt.ReferenceId)) ||
                                 (pt.Narration != null && pt.Narration.Contains("Deceased") && vNoList.Any(vn => pt.Narration.Contains(vn))))
                    .ToListAsync();

                foreach (var pt in claimPigmyTxs)
                {
                    var pAcc = await _context.PigmyAccounts.FindAsync(pt.PigmyAccountID);
                    if (pAcc != null)
                    {
                        pAcc.TotalDepositedAmount = Math.Round(pAcc.TotalDepositedAmount + pt.DrAmount - pt.CrAmount, 2, MidpointRounding.AwayFromZero);
                        pAcc.Status = pAcc.MaturityDate.Date <= DateTime.Today ? "Matured" : "Active";
                        _context.Entry(pAcc).State = EntityState.Modified;
                        affectedPigmyAccountIds.Add(pAcc.PigmyAccountID);
                    }
                    _context.PigmyTransactions.Remove(pt);
                }
            }

            _context.DeceasedClaimSettlements.RemoveRange(claims);
            await _context.SaveChangesAsync();
        }

        // =====================================================================
        // MODULE 3: FIXED DEPOSIT
        // =====================================================================

        private async Task RollbackFdModuleAsync(
            Voucher primaryVoucher,
            List<Voucher> voucherGroup,
            HashSet<int> voucherIds,
            HashSet<string> voucherNos,
            HashSet<int> reversedSavingTxnIds,
            HashSet<int> affectedSavingAccountIds,
            HashSet<int> affectedPigmyAccountIds,
            HashSet<int> rolledBackLoanCollectionIds,
            HashSet<string> extraDeletedVoucherNos)
        {
            // 3A. FD Renewal (Manual Renewal & Auto-Renewal)
            var renewalVoucher = voucherGroup.FirstOrDefault(FdRenewalRollbackHelper.IsFdRenewalVoucher);
            bool isAutoRenewalVoucher = voucherNos.Any(v => v.StartsWith("JV-FD-AUTOREN-", StringComparison.OrdinalIgnoreCase)) ||
                                        await _context.FdAutoRenewalLogs.AnyAsync(l => l.VoucherID.HasValue && voucherIds.Contains(l.VoucherID.Value));

            if (renewalVoucher != null || isAutoRenewalVoucher)
            {
                var targetRenV = renewalVoucher ?? primaryVoucher;

                // Pre-reverse any SavingTransactions on these voucherNos via our idempotent tracker so passbook balances resync
                await ReverseAllSavingTransactionsByVoucherNosAsync(voucherNos, reversedSavingTxnIds, affectedSavingAccountIds);
                await _context.SaveChangesAsync();

                var renResult = await FdRenewalRollbackHelper.RollbackRenewalByVoucherAsync(
                    _context,
                    targetRenV,
                    deletePrimaryVoucherRecord: false);

                foreach (var dv in renResult.DeletedVoucherNos)
                {
                    if (!string.IsNullOrWhiteSpace(dv)) extraDeletedVoucherNos.Add(dv);
                }
            }

            var fdAffectedForPostingDate = new HashSet<int>();

            // 3B. FD MIS Payouts
            var misPayouts = await _context.FdMisPayouts
                .Include(m => m.FdAccount)
                .Where(m => m.VoucherID.HasValue && voucherIds.Contains(m.VoucherID.Value))
                .ToListAsync();

            if (misPayouts.Any())
            {
                foreach (var mis in misPayouts)
                {
                    fdAffectedForPostingDate.Add(mis.FdAccountID);

                    if (mis.LoanAdjustedAmount > 0 && mis.TargetLoanAccountID.HasValue)
                    {
                        string fdAccNo = mis.FdAccount?.AccountNo ?? string.Empty;
                        var misLoanCols = await _context.LoanCollections
                            .Include(c => c.Fees)
                            .Where(c => c.LoanAccountID == mis.TargetLoanAccountID.Value &&
                                        c.CollectionDate.Date == mis.PayoutDate.Date &&
                                        Math.Abs(c.TotalAmountReceived - mis.LoanAdjustedAmount) < 0.01m &&
                                        ((c.VoucherID.HasValue && voucherIds.Contains(c.VoucherID.Value)) ||
                                         (!c.VoucherID.HasValue && (string.IsNullOrEmpty(fdAccNo) || (c.Remarks != null && c.Remarks.Contains(fdAccNo))))))
                            .ToListAsync();

                        foreach (var lc in misLoanCols)
                        {
                            await RollbackAndHardDeleteLoanCollectionAsync(
                                lc,
                                voucherIds,
                                voucherNos,
                                reversedSavingTxnIds,
                                affectedSavingAccountIds,
                                affectedPigmyAccountIds,
                                rolledBackLoanCollectionIds);
                        }
                    }
                }

                var misFdTxs = await _context.FdTransactions
                    .Where(t => voucherIds.Contains(t.VoucherID) && t.TransactionType == "MIS_Payout")
                    .ToListAsync();
                if (misFdTxs.Any())
                {
                    _context.FdTransactions.RemoveRange(misFdTxs);
                }

                _context.FdMisPayouts.RemoveRange(misPayouts);
                await _context.SaveChangesAsync();
            }

            // 3C. FD Interest Accruals
            var fdAccruals = await _context.FdInterestAccruals
                .Where(a => voucherIds.Contains(a.VoucherID))
                .ToListAsync();

            if (fdAccruals.Any())
            {
                foreach (var acc in fdAccruals)
                {
                    fdAffectedForPostingDate.Add(acc.FdAccountID);
                }

                var accrualFdTxs = await _context.FdTransactions
                    .Where(t => voucherIds.Contains(t.VoucherID) && t.TransactionType == "Accrual")
                    .ToListAsync();
                if (accrualFdTxs.Any())
                {
                    _context.FdTransactions.RemoveRange(accrualFdTxs);
                }

                _context.FdInterestAccruals.RemoveRange(fdAccruals);
                await _context.SaveChangesAsync();
            }

            // Restore FdAccount.LastInterestPostingDate for any MIS / Accrual reversals
            foreach (int fdId in fdAffectedForPostingDate)
            {
                var fdAcc = await _context.FdAccounts.FindAsync(fdId);
                if (fdAcc == null) continue;

                DateTime? latestAccrual = await _context.FdInterestAccruals
                    .Where(a => a.FdAccountID == fdId)
                    .OrderByDescending(a => a.AccrualDate)
                    .Select(a => (DateTime?)a.AccrualDate)
                    .FirstOrDefaultAsync();

                DateTime? latestMis = await _context.FdMisPayouts
                    .Where(m => m.FdAccountID == fdId && m.Status == "Success")
                    .OrderByDescending(m => m.PayoutDate)
                    .Select(m => (DateTime?)m.PayoutDate)
                    .FirstOrDefaultAsync();

                if (latestAccrual.HasValue && latestMis.HasValue)
                    fdAcc.LastInterestPostingDate = latestAccrual.Value >= latestMis.Value ? latestAccrual : latestMis;
                else
                    fdAcc.LastInterestPostingDate = latestAccrual ?? latestMis;

                _context.Entry(fdAcc).State = EntityState.Modified;
            }

            // 3D. FD Closure & FD Settlement (Payout / Premature_Close / JV-FD-CLOSE-* / JV-FD-PRECLOSE-*)
            var fdClosureTxs = await _context.FdTransactions
                .Include(t => t.FdAccount)
                .Where(t => voucherIds.Contains(t.VoucherID) &&
                            (t.TransactionType == "Payout" || t.TransactionType == "Premature_Close"))
                .ToListAsync();

            var closedFdAccounts = fdClosureTxs
                .Where(t => t.FdAccount != null)
                .Select(t => t.FdAccount!)
                .GroupBy(f => f.FdAccountID)
                .Select(g => g.First())
                .ToList();

            // Fallback lookup by VoucherNo suffix if FdTransaction was missing
            foreach (var vNo in voucherNos)
            {
                string[] closePrefixes = { "JV-FD-CLOSE-", "JV-FD-PRECLOSE-", "PMT-FD-CLOSE-", "PAY-FD-CLOSE-", "PMT-FD-PRECLOSE-", "PAY-FD-PRECLOSE-" };
                string extracted = string.Empty;
                foreach (var p in closePrefixes)
                {
                    if (vNo.StartsWith(p, StringComparison.OrdinalIgnoreCase))
                    {
                        extracted = vNo.Substring(p.Length).Trim();
                        break;
                    }
                }
                if (string.IsNullOrEmpty(extracted))
                {
                    int idxClose = vNo.IndexOf("-FD-CLOSE-", StringComparison.OrdinalIgnoreCase);
                    if (idxClose >= 0) extracted = vNo.Substring(idxClose + "-FD-CLOSE-".Length).Trim();
                    int idxPre = vNo.IndexOf("-FD-PRECLOSE-", StringComparison.OrdinalIgnoreCase);
                    if (idxPre >= 0) extracted = vNo.Substring(idxPre + "-FD-PRECLOSE-".Length).Trim();
                }

                if (!string.IsNullOrEmpty(extracted))
                {
                    var fallbackFd = await FdRenewalRollbackHelper.FindFdAccountByAnyNumberAsync(_context, extracted);
                    if (fallbackFd != null && closedFdAccounts.All(f => f.FdAccountID != fallbackFd.FdAccountID))
                    {
                        closedFdAccounts.Add(fallbackFd);
                    }
                }
            }

            if (fdClosureTxs.Any() || closedFdAccounts.Any())
            {
                var closedFdAccNos = closedFdAccounts
                    .Where(f => !string.IsNullOrWhiteSpace(f.AccountNo))
                    .SelectMany(f => FdRenewalRollbackHelper.BuildAccountNumberVariants(f.AccountNo))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // Roll back any FD Settlement LoanCollections (either linked directly via VoucherID or matching PaymentMode == "FD Settlement" & ChequeNo == fd.AccountNo)
                var fdSettlementLoanCols = await _context.LoanCollections
                    .Include(c => c.Fees)
                    .Where(c => (c.VoucherID.HasValue && voucherIds.Contains(c.VoucherID.Value)) ||
                                (c.PaymentMode == "FD Settlement" &&
                                 c.CollectionDate.Date == primaryVoucher.VoucherDate.Date &&
                                 c.ChequeNo != null &&
                                 closedFdAccNos.Contains(c.ChequeNo)))
                    .ToListAsync();

                foreach (var lc in fdSettlementLoanCols)
                {
                    await RollbackAndHardDeleteLoanCollectionAsync(
                        lc,
                        voucherIds,
                        voucherNos,
                        reversedSavingTxnIds,
                        affectedSavingAccountIds,
                        affectedPigmyAccountIds,
                        rolledBackLoanCollectionIds);
                }

                if (fdClosureTxs.Any())
                {
                    _context.FdTransactions.RemoveRange(fdClosureTxs);
                }

                foreach (var fd in closedFdAccounts)
                {
                    fd.Status = fd.MaturityDate.Date <= DateTime.Today ? "Matured" : "Active";
                    if (!string.IsNullOrEmpty(fd.Remarks))
                    {
                        fd.Remarks = Regex.Replace(fd.Remarks, @"\s*\|\s*बंद दिनांक:[^|]*", string.Empty).Trim();
                    }
                    _context.Entry(fd).State = EntityState.Modified;
                }

                await _context.SaveChangesAsync();
            }

            // 3E. Single & Bulk FD Opening (REC-FD-* / JV-FD-* / REC-FD-BLK-* / JV-FD-BLK-* — excluding RD->FD renewal JV-RD-REN-*)
            bool isRdToFdRenewal = voucherNos.Any(v => v.StartsWith("JV-RD-REN-", StringComparison.OrdinalIgnoreCase));
            if (!isRdToFdRenewal && renewalVoucher == null && !isAutoRenewalVoucher)
            {
                var fdOpeningTxs = await _context.FdTransactions
                    .Include(t => t.FdAccount)
                    .Where(t => voucherIds.Contains(t.VoucherID) && t.TransactionType == "Opening")
                    .ToListAsync();

                if (fdOpeningTxs.Any())
                {
                    var openedFds = fdOpeningTxs
                        .Where(t => t.FdAccount != null)
                        .Select(t => t.FdAccount!)
                        .GroupBy(f => f.FdAccountID)
                        .Select(g => g.First())
                        .ToList();

                    var nonLegacyFds = openedFds.Where(f => !f.IsLegacyAccount).ToList();
                    var legacyFds = openedFds.Where(f => f.IsLegacyAccount).ToList();

                    if (legacyFds.Any())
                    {
                        var legacyFdIds = legacyFds.Select(f => f.FdAccountID).ToList();
                        var legacyTxs = fdOpeningTxs.Where(t => legacyFdIds.Contains(t.FdAccountID)).ToList();
                        if (legacyTxs.Any()) _context.FdTransactions.RemoveRange(legacyTxs);
                        await _context.SaveChangesAsync();
                    }

                    // Validate ALL non-legacy operational accounts in single/bulk opening batch before deleting any
                    foreach (var fd in nonLegacyFds)
                    {
                        string accNo = fd.AccountNo ?? string.Empty;
                        bool pledgedInSecurityDetails = !string.IsNullOrEmpty(accNo) && await _context.LoanAccounts
                            .AnyAsync(l => l.Status == "Active" && l.SecurityDetails != null && l.SecurityDetails.Contains(accNo));
                        bool pledgedInCollaterals = await _context.LoanDepositCollaterals
                            .AnyAsync(c => c.CollateralType == "FixedDeposit" && c.DepositAccountID == fd.FdAccountID);

                        if (fd.IsLienMarked || pledgedInSecurityDetails || pledgedInCollaterals)
                        {
                            throw new VoucherRollbackDomainException(
                                StatusCodes.Status400BadRequest,
                                $"मुदत ठेव खाते क्र. {fd.AccountNo} वर कर्जाचा तारण बोजा (Lien/Security) असल्यामुळे ओपनिंग व्हाउचर डिलीट करता येत नाही.");
                        }

                        bool hasSubsequentFdTx = await _context.FdTransactions
                            .AnyAsync(t => t.FdAccountID == fd.FdAccountID && !voucherIds.Contains(t.VoucherID));
                        bool hasMis = await _context.FdMisPayouts
                            .AnyAsync(m => m.FdAccountID == fd.FdAccountID);
                        bool hasAccrual = await _context.FdInterestAccruals
                            .AnyAsync(a => a.FdAccountID == fd.FdAccountID);
                        bool hasAutoRen = await _context.FdAutoRenewalLogs
                            .AnyAsync(l => l.OldFdAccountID == fd.FdAccountID || l.NewFdAccountID == fd.FdAccountID);

                        if (hasSubsequentFdTx || hasMis || hasAccrual || hasAutoRen || fd.Status == "Closed" || fd.Status == "Renewed")
                        {
                            throw new VoucherRollbackDomainException(
                                StatusCodes.Status400BadRequest,
                                $"मुदत ठेव खाते क्र. {fd.AccountNo} वर पुढील व्याज/क्लोजर/नूतनीकरण व्यवहार झालेले असल्यामुळे ओपनिंग व्हाउचर डिलीट करता येत नाही.");
                        }
                    }

                    if (nonLegacyFds.Any())
                    {
                        var openedFdIds = nonLegacyFds.Select(f => f.FdAccountID).ToList();
                        var branchesToSync = nonLegacyFds.Select(f => f.BranchID).Where(b => b > 0).Distinct().ToList();

                        var allOpeningFdTxs = await _context.FdTransactions
                            .Where(t => openedFdIds.Contains(t.FdAccountID))
                            .ToListAsync();
                        if (allOpeningFdTxs.Any())
                        {
                            _context.FdTransactions.RemoveRange(allOpeningFdTxs);
                        }

                        _context.FdAccounts.RemoveRange(nonLegacyFds);
                        await _context.SaveChangesAsync();

                        foreach (int bId in branchesToSync)
                        {
                            await FdRenewalRollbackHelper.SyncBranchFdSequenceAsync(_context, bId);
                        }
                    }
                }
            }
        }

        // =====================================================================
        // MODULE 4: RECURRING DEPOSIT
        // =====================================================================

        private async Task RollbackRdModuleAsync(
            Voucher primaryVoucher,
            HashSet<int> voucherIds,
            HashSet<string> voucherNos,
            string cleanReason,
            VoucherDeleteRequestContext req,
            HashSet<int> reversedSavingTxnIds,
            HashSet<int> affectedSavingAccountIds)
        {
            // Pre-reverse SavingTransactions through our idempotent tracker so helpers don't double-reverse
            // and affectedSavingAccountIds gets full chronological BalanceAfterTxn recalculation
            await ReverseAllSavingTransactionsByVoucherNosAsync(voucherNos, reversedSavingTxnIds, affectedSavingAccountIds);
            await _context.SaveChangesAsync();

            // 4A. RD Closure & RD->FD Renewal
            bool handledClosure = await RdClosureSettlementHelper.RollbackRdClosureOrRenewalByVoucherAsync(
                _context,
                primaryVoucher,
                cleanReason,
                req.UserId,
                req.Username);

            if (handledClosure)
            {
                return;
            }

            // 4B. RD Installment Collection (excluding RD Opening vouchers REC-RD-OPEN-* / JV-RD-OPEN-*)
            bool isRdOpeningPrefix = voucherNos.Any(v =>
                v.StartsWith("REC-RD-OPEN-", StringComparison.OrdinalIgnoreCase) ||
                v.StartsWith("JV-RD-OPEN-", StringComparison.OrdinalIgnoreCase) ||
                v.StartsWith("REC-RD-OP-", StringComparison.OrdinalIgnoreCase) ||
                v.StartsWith("JV-RD-OP-", StringComparison.OrdinalIgnoreCase));

            if (!isRdOpeningPrefix)
            {
                bool handledInstallment = await RdInstallmentCollectionRollbackHelper.RollbackRdInstallmentCollectionByVoucherAsync(
                    _context,
                    primaryVoucher,
                    cleanReason,
                    req.UserId,
                    req.Username);

                if (handledInstallment)
                {
                    return;
                }
            }

            // 4C. RD Interest Accruals
            var rdAccruals = await _context.RdInterestAccruals
                .Where(a => voucherIds.Contains(a.VoucherID))
                .ToListAsync();

            if (rdAccruals.Any())
            {
                foreach (var acc in rdAccruals)
                {
                    var rdAcc = await _context.RdAccounts.FindAsync(acc.RdAccountID);
                    if (rdAcc != null)
                    {
                        rdAcc.CumulativeInterestAccrued = Math.Max(0m, Math.Round(rdAcc.CumulativeInterestAccrued - acc.InterestAmount, 2, MidpointRounding.AwayFromZero));
                        _context.Entry(rdAcc).State = EntityState.Modified;
                    }
                }

                var rdAccrualTxs = await _context.RdTransactions
                    .Where(t => voucherIds.Contains(t.VoucherID) && t.TransactionType == "Accrual")
                    .ToListAsync();
                if (rdAccrualTxs.Any())
                {
                    _context.RdTransactions.RemoveRange(rdAccrualTxs);
                }

                _context.RdInterestAccruals.RemoveRange(rdAccruals);
                await _context.SaveChangesAsync();
            }

            // 4D. RD Opening (REC-RD-OPEN-{AccountNo} / JV-RD-OPEN-{AccountNo} / REC-RD-OP-* / JV-RD-OP-*)
            if (isRdOpeningPrefix)
            {
                var openRdTxs = await _context.RdTransactions
                    .Include(t => t.RdAccount)
                    .Where(t => voucherIds.Contains(t.VoucherID))
                    .ToListAsync();

                var openedRds = openRdTxs
                    .Where(t => t.RdAccount != null)
                    .Select(t => t.RdAccount!)
                    .GroupBy(r => r.RdAccountID)
                    .Select(g => g.First())
                    .ToList();

                foreach (var vNo in voucherNos)
                {
                    string[] rdOpenPrefixes = { "REC-RD-OPEN-", "JV-RD-OPEN-", "REC-RD-OP-", "JV-RD-OP-" };
                    foreach (var p in rdOpenPrefixes)
                    {
                        if (vNo.StartsWith(p, StringComparison.OrdinalIgnoreCase))
                        {
                            string accToken = vNo.Substring(p.Length).Trim();
                            var rdFallback = await _context.RdAccounts.FirstOrDefaultAsync(r => r.AccountNo == accToken);
                            if (rdFallback != null && openedRds.All(x => x.RdAccountID != rdFallback.RdAccountID))
                            {
                                openedRds.Add(rdFallback);
                            }
                        }
                    }
                }

                if (openedRds.Any())
                {
                    var legacyRds = openedRds.Where(r => r.IsLegacyAccount).ToList();
                    if (legacyRds.Any())
                    {
                        var legRdIds = legacyRds.Select(r => r.RdAccountID).ToList();
                        var legTxs = openRdTxs.Where(t => legRdIds.Contains(t.RdAccountID)).ToList();
                        if (legTxs.Any()) _context.RdTransactions.RemoveRange(legTxs);
                        await _context.SaveChangesAsync();
                    }

                    var nonLegacyRds = openedRds.Where(r => !r.IsLegacyAccount).ToList();
                    foreach (var rd in nonLegacyRds)
                    {
                        if (rd.IsLienMarked)
                        {
                            throw new VoucherRollbackDomainException(
                                StatusCodes.Status400BadRequest,
                                $"आरडी खाते क्र. {rd.AccountNo} वर कर्जाचा तारण बोजा (Lien) असल्यामुळे ओपनिंग व्हाउचर डिलीट करता येत नाही.");
                        }

                        bool hasLaterTx = await _context.RdTransactions
                            .AnyAsync(t => t.RdAccountID == rd.RdAccountID && !voucherIds.Contains(t.VoucherID));
                        bool hasAccrual = await _context.RdInterestAccruals
                            .AnyAsync(a => a.RdAccountID == rd.RdAccountID);
                        bool hasExtraPaidSched = await _context.RDInstallmentSchedules
                            .AnyAsync(s => s.RdAccountID == rd.RdAccountID &&
                                           s.PaidAmount > 0 &&
                                           s.InstallmentNo > 1 &&
                                           (!s.VoucherID.HasValue || !voucherIds.Contains(s.VoucherID.Value)));

                        if (hasLaterTx || hasAccrual || hasExtraPaidSched || rd.Status == "Closed")
                        {
                            throw new VoucherRollbackDomainException(
                                StatusCodes.Status400BadRequest,
                                $"आरडी खाते क्र. {rd.AccountNo} वर पुढील हप्ते/व्याज/क्लोजर नोंदी अस्तित्वात असल्यामुळे ओपनिंग व्हाउचर डिलीट करता येत नाही.");
                        }
                    }

                    if (nonLegacyRds.Any())
                    {
                        var rdIds = nonLegacyRds.Select(r => r.RdAccountID).ToList();
                        var rdBranches = nonLegacyRds.Select(r => r.BranchID).Where(b => b > 0).Distinct().ToList();

                        var schedules = await _context.RDInstallmentSchedules.Where(s => rdIds.Contains(s.RdAccountID)).ToListAsync();
                        if (schedules.Any()) _context.RDInstallmentSchedules.RemoveRange(schedules);

                        var allRdTxs = await _context.RdTransactions.Where(t => rdIds.Contains(t.RdAccountID)).ToListAsync();
                        if (allRdTxs.Any()) _context.RdTransactions.RemoveRange(allRdTxs);

                        _context.RdAccounts.RemoveRange(nonLegacyRds);
                        await _context.SaveChangesAsync();

                        foreach (int bId in rdBranches)
                        {
                            await SyncBranchRdSequenceAsync(bId);
                        }
                    }
                }
            }
        }

        // =====================================================================
        // MODULE 5: PIGMY DEPOSIT
        // =====================================================================

        private async Task RollbackPigmyModuleAsync(
            Voucher primaryVoucher,
            HashSet<int> voucherIds,
            HashSet<string> voucherNos,
            HashSet<int> affectedPigmyAccountIds)
        {
            // 5A. AgentDayBook / MobileSync Cash Remittance (PigmyAgentCashDeposits)
            // CRITICAL DOMAIN RULE: Pre-collected PigmyCollections are NOT deleted; only their remittance link is cleared!
            var agentDeposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.VoucherId.HasValue && voucherIds.Contains(d.VoucherId.Value))
                .ToListAsync();

            if (agentDeposits.Any())
            {
                var remittedCols = await _context.PigmyCollections
                    .Where(c => c.VoucherId.HasValue && voucherIds.Contains(c.VoucherId.Value))
                    .ToListAsync();

                foreach (var col in remittedCols)
                {
                    col.VoucherId = null;
                    col.IsVoucherGenerated = false;
                    _context.Entry(col).State = EntityState.Modified;
                }
                await _context.SaveChangesAsync();

                foreach (var dep in agentDeposits)
                {
                    if (!string.IsNullOrWhiteSpace(dep.ReceiptNo))
                    {
                        var denoms = await _context.CashDenominations
                            .Where(cd => cd.Remarks != null && cd.Remarks.Contains(dep.ReceiptNo))
                            .ToListAsync();
                        if (denoms.Any())
                        {
                            _context.CashDenominations.RemoveRange(denoms);
                        }
                    }
                }

                _context.PigmyAgentCashDeposits.RemoveRange(agentDeposits);
                await _context.SaveChangesAsync();
            }
            else
            {
                // 5B. Direct Manual / BulkManual / OpeningImport PigmyCollections
                var directCols = await _context.PigmyCollections
                    .Where(c => c.VoucherId.HasValue && voucherIds.Contains(c.VoucherId.Value))
                    .ToListAsync();

                if (directCols.Any())
                {
                    // Same-day manual collection merge case (single row incremented by primaryVoucher.TotalAmount)
                    if (directCols.Count == 1 &&
                        directCols[0].CollectionSource == "MANUAL" &&
                        directCols[0].CollectionAmount > primaryVoucher.TotalAmount + 0.01m)
                    {
                        var col = directCols[0];
                        var pAcc = await _context.PigmyAccounts.FindAsync(col.PigmyAccountId);
                        if (pAcc != null)
                        {
                            pAcc.TotalDepositedAmount = Math.Max(0m, Math.Round(pAcc.TotalDepositedAmount - primaryVoucher.TotalAmount, 2, MidpointRounding.AwayFromZero));
                            _context.Entry(pAcc).State = EntityState.Modified;
                            affectedPigmyAccountIds.Add(pAcc.PigmyAccountID);
                        }

                        col.CollectionAmount = Math.Round(col.CollectionAmount - primaryVoucher.TotalAmount, 2, MidpointRounding.AwayFromZero);
                        col.ClosingBalance = Math.Max(0m, Math.Round(col.ClosingBalance - primaryVoucher.TotalAmount, 2, MidpointRounding.AwayFromZero));
                        col.VoucherId = null;
                        col.IsVoucherGenerated = false;
                        _context.Entry(col).State = EntityState.Modified;

                        var mergedTx = await _context.PigmyTransactions
                            .Where(pt => pt.PigmyAccountID == col.PigmyAccountId &&
                                         pt.TransactionType == "DEPOSIT" &&
                                         Math.Abs(pt.CrAmount - primaryVoucher.TotalAmount) < 0.01m &&
                                         (string.IsNullOrEmpty(col.ReceiptNo) || pt.Narration.Contains(col.ReceiptNo)))
                            .OrderByDescending(pt => pt.PigmyTransactionID)
                            .FirstOrDefaultAsync();
                        if (mergedTx != null)
                        {
                            _context.PigmyTransactions.Remove(mergedTx);
                        }

                        await _context.SaveChangesAsync();
                    }
                    else
                    {
                        var depositTxsToDelete = new List<PigmyTransaction>();
                        foreach (var col in directCols)
                        {
                            var pAcc = await _context.PigmyAccounts.FindAsync(col.PigmyAccountId);
                            if (pAcc != null)
                            {
                                pAcc.TotalDepositedAmount = Math.Max(0m, Math.Round(pAcc.TotalDepositedAmount - col.CollectionAmount, 2, MidpointRounding.AwayFromZero));
                                _context.Entry(pAcc).State = EntityState.Modified;
                                affectedPigmyAccountIds.Add(pAcc.PigmyAccountID);
                            }

                            var matchedTxs = await _context.PigmyTransactions
                                .Where(pt => pt.PigmyAccountID == col.PigmyAccountId &&
                                             pt.TransactionType == "DEPOSIT" &&
                                             ((!string.IsNullOrEmpty(col.ReceiptNo) && pt.Narration.Contains(col.ReceiptNo)) ||
                                              (!string.IsNullOrEmpty(col.TransactionId) && pt.ReferenceId == col.TransactionId)))
                                .ToListAsync();

                            foreach (var mt in matchedTxs)
                            {
                                if (depositTxsToDelete.All(x => x.PigmyTransactionID != mt.PigmyTransactionID))
                                {
                                    depositTxsToDelete.Add(mt);
                                }
                            }
                        }

                        _context.PigmyCollections.RemoveRange(directCols);
                        await _context.SaveChangesAsync();

                        if (depositTxsToDelete.Any())
                        {
                            _context.PigmyTransactions.RemoveRange(depositTxsToDelete);
                            await _context.SaveChangesAsync();
                        }
                    }
                }
            }

            // 5C. Pigmy Initial Opening Deposit (PV-{BranchID}-{yyyyMMdd}-OPN-{guid})
            if (voucherNos.Any(v => v.Contains("-OPN-", StringComparison.OrdinalIgnoreCase)) &&
                !string.IsNullOrWhiteSpace(primaryVoucher.Narration))
            {
                var accMatch = Regex.Match(primaryVoucher.Narration, @"A/C\s+([0-9A-Za-z-]+)");
                if (accMatch.Success)
                {
                    string pgAccNo = accMatch.Groups[1].Value.Trim();
                    string pgDigits = new string(pgAccNo.Where(char.IsDigit).ToArray());
                    var pAcc = await _context.PigmyAccounts.FirstOrDefaultAsync(p =>
                        p.AccountNo == pgAccNo || (pgDigits.Length == 14 && p.AccountNo == pgDigits));

                    if (pAcc != null)
                    {
                        var openTx = await _context.PigmyTransactions
                            .Where(pt => pt.PigmyAccountID == pAcc.PigmyAccountID &&
                                         pt.TransactionType == "DEPOSIT" &&
                                         Math.Abs(pt.CrAmount - primaryVoucher.TotalAmount) < 0.01m &&
                                         pt.Narration.Contains("Opening", StringComparison.OrdinalIgnoreCase))
                            .OrderByDescending(pt => pt.PigmyTransactionID)
                            .FirstOrDefaultAsync();

                        if (openTx != null)
                        {
                            pAcc.TotalDepositedAmount = Math.Max(0m, Math.Round(pAcc.TotalDepositedAmount - openTx.CrAmount, 2, MidpointRounding.AwayFromZero));
                            _context.Entry(pAcc).State = EntityState.Modified;
                            _context.PigmyTransactions.Remove(openTx);
                            await _context.SaveChangesAsync();
                        }

                        bool hasAnyRemainingActivity =
                            pAcc.IsLienMarked ||
                            await _context.PigmyTransactions.AnyAsync(t => t.PigmyAccountID == pAcc.PigmyAccountID) ||
                            await _context.PigmyCollections.AnyAsync(c => c.PigmyAccountId == pAcc.PigmyAccountID) ||
                            await _context.PigmyWithdrawals.AnyAsync(w => w.PigmyAccountID == pAcc.PigmyAccountID) ||
                            await _context.PigmyInterestLogs.AnyAsync(l => l.PigmyAccountId == pAcc.PigmyAccountID);

                        if (!hasAnyRemainingActivity)
                        {
                            int pgBranchId = pAcc.BranchID;
                            var openBals = await _context.PigmyOpeningBalances.Where(o => o.PigmyAccountID == pAcc.PigmyAccountID).ToListAsync();
                            if (openBals.Any()) _context.PigmyOpeningBalances.RemoveRange(openBals);

                            var agentTrfs = await _context.PigmyAgentAccountTransfers.Where(t => t.PigmyAccountID == pAcc.PigmyAccountID).ToListAsync();
                            if (agentTrfs.Any()) _context.PigmyAgentAccountTransfers.RemoveRange(agentTrfs);

                            _context.PigmyAccounts.Remove(pAcc);
                            affectedPigmyAccountIds.Remove(pAcc.PigmyAccountID);
                            await _context.SaveChangesAsync();
                            await SyncBranchPigmySequenceAsync(pgBranchId);
                        }
                        else
                        {
                            affectedPigmyAccountIds.Add(pAcc.PigmyAccountID);
                        }
                    }
                }
            }

            // 5D. Pigmy Interest Posting (PigmyInterestLogs / VCH-INT-*)
            var pigmyIntLogs = await _context.PigmyInterestLogs
                .Where(l => l.VoucherId.HasValue && voucherIds.Contains(l.VoucherId.Value))
                .ToListAsync();

            if (pigmyIntLogs.Any())
            {
                var vNoList = voucherNos.ToList();
                foreach (var log in pigmyIntLogs)
                {
                    var pAcc = await _context.PigmyAccounts.FindAsync(log.PigmyAccountId);
                    if (pAcc != null)
                    {
                        pAcc.TotalDepositedAmount = Math.Max(0m, Math.Round(pAcc.TotalDepositedAmount - log.InterestAmount, 2, MidpointRounding.AwayFromZero));
                        _context.Entry(pAcc).State = EntityState.Modified;
                        affectedPigmyAccountIds.Add(pAcc.PigmyAccountID);
                    }

                    var intTxs = await _context.PigmyTransactions
                        .Where(pt => pt.PigmyAccountID == log.PigmyAccountId &&
                                     pt.TransactionType == "INTEREST" &&
                                     (vNoList.Any(vn => pt.Narration.Contains(vn)) ||
                                      (Math.Abs(pt.CrAmount - log.InterestAmount) < 0.01m && pt.TransactionDate.Date == log.CalculationDate.Date)))
                        .ToListAsync();

                    if (intTxs.Any())
                    {
                        _context.PigmyTransactions.RemoveRange(intTxs);
                    }
                }

                _context.PigmyInterestLogs.RemoveRange(pigmyIntLogs);
                await _context.SaveChangesAsync();
            }

            // 5E. Pigmy Agent Commission Payout (PigmyAgentCommissions / VCH-COMM-*)
            // Pre-calculated commission bill row returns to Status = "PENDING", VoucherId = null
            var agentComms = await _context.PigmyAgentCommissions
                .Where(c => c.VoucherId.HasValue && voucherIds.Contains(c.VoucherId.Value))
                .ToListAsync();

            if (agentComms.Any())
            {
                foreach (var comm in agentComms)
                {
                    comm.Status = "PENDING";
                    comm.VoucherId = null;
                    _context.Entry(comm).State = EntityState.Modified;
                }
                await _context.SaveChangesAsync();
            }

            // 5F. Pigmy Partial Withdrawals (PigmyWithdrawals / VCH-WDR-* / PV-*-PIGMY-WDR-* / JV-PIGMY-WDR-*)
            if (voucherNos.Any())
            {
                var vNoList = voucherNos.ToList();
                var withdrawals = await _context.PigmyWithdrawals
                    .Where(w => w.VoucherNo != null && vNoList.Contains(w.VoucherNo))
                    .ToListAsync();

                foreach (var w in withdrawals)
                {
                    var pAcc = await _context.PigmyAccounts.FindAsync(w.PigmyAccountID);
                    if (pAcc != null)
                    {
                        pAcc.TotalDepositedAmount = Math.Round(pAcc.TotalDepositedAmount + w.RequestedAmount, 2, MidpointRounding.AwayFromZero);
                        pAcc.TotalWithdrawnAmount = Math.Max(0m, Math.Round(pAcc.TotalWithdrawnAmount - w.RequestedAmount, 2, MidpointRounding.AwayFromZero));
                        pAcc.CurrentCycleNumber = w.CycleNumber;
                        pAcc.EffectiveStartDate = w.CycleStartSnapshot;
                        pAcc.LastWithdrawalDate = await _context.PigmyWithdrawals
                            .Where(x => x.PigmyAccountID == pAcc.PigmyAccountID && x.WithdrawalID != w.WithdrawalID)
                            .OrderByDescending(x => x.WithdrawalDate)
                            .ThenByDescending(x => x.WithdrawalID)
                            .Select(x => (DateTime?)x.WithdrawalDate)
                            .FirstOrDefaultAsync();
                        _context.Entry(pAcc).State = EntityState.Modified;
                        affectedPigmyAccountIds.Add(pAcc.PigmyAccountID);
                    }

                    var wTx = await _context.PigmyTransactions
                        .Where(pt => pt.PigmyAccountID == w.PigmyAccountID &&
                                     pt.TransactionType == "WITHDRAWAL" &&
                                     Math.Abs(pt.DrAmount - w.RequestedAmount) < 0.01m &&
                                     pt.TransactionDate.Date == w.WithdrawalDate.Date)
                        .OrderByDescending(pt => pt.PigmyTransactionID)
                        .FirstOrDefaultAsync();

                    if (wTx != null)
                    {
                        _context.PigmyTransactions.Remove(wTx);
                    }

                    _context.PigmyWithdrawals.Remove(w);
                }

                if (withdrawals.Any())
                {
                    await _context.SaveChangesAsync();
                }

                // Pigmy Full Account Closure (VCH-CLO-* / PV-*-PIGMY-CLO-* / JV-PIGMY-CLO-*)
                var closurePigmyTxsByRef = await _context.PigmyTransactions
                    .Where(pt => pt.TransactionType == "WITHDRAWAL" &&
                                 pt.ReferenceId != null &&
                                 vNoList.Contains(pt.ReferenceId))
                    .ToListAsync();

                var closurePigmyTxsByNarr = await _context.PigmyTransactions
                    .Where(pt => pt.TransactionType == "WITHDRAWAL" &&
                                 pt.Narration != null &&
                                 vNoList.Any(vn => pt.Narration.Contains(vn)))
                    .ToListAsync();

                var closurePigmyTxs = closurePigmyTxsByRef
                    .Concat(closurePigmyTxsByNarr)
                    .GroupBy(pt => pt.PigmyTransactionID)
                    .Select(g => g.First())
                    .ToList();

                foreach (var cloTx in closurePigmyTxs)
                {
                    var pAcc = await _context.PigmyAccounts.FindAsync(cloTx.PigmyAccountID);
                    if (pAcc != null)
                    {
                        pAcc.TotalDepositedAmount = Math.Round(pAcc.TotalDepositedAmount + cloTx.DrAmount, 2, MidpointRounding.AwayFromZero);
                        pAcc.Status = pAcc.MaturityDate.Date <= DateTime.Today ? "Matured" : "Active";
                        _context.Entry(pAcc).State = EntityState.Modified;
                        affectedPigmyAccountIds.Add(pAcc.PigmyAccountID);
                    }
                    _context.PigmyTransactions.Remove(cloTx);
                }

                if (closurePigmyTxs.Any())
                {
                    await _context.SaveChangesAsync();
                }
            }
        }

        // =====================================================================
        // MODULE 6: SHARE & MEMBER
        // =====================================================================

        private async Task RollbackShareAndMemberModuleAsync(
            List<Voucher> voucherGroup,
            HashSet<int> voucherIds,
            HashSet<string> voucherNos)
        {
            // Skip ShareTransactions belonging to LoanDisbursement here so LoanDisbursementReversalHelper reverses them once
            bool isLoanDisbursement = await _context.LoanDisbursements
                .AnyAsync(d => d.VoucherID.HasValue && voucherIds.Contains(d.VoucherID.Value));

            if (!isLoanDisbursement)
            {
                var shareTxns = await _context.ShareTransactions
                    .Where(st => st.VoucherId.HasValue && voucherIds.Contains(st.VoucherId.Value))
                    .ToListAsync();

                if (shareTxns.Any())
                {
                    // 6A. Share Transfer (Transfer-Out + Transfer-In)
                    var outTxns = shareTxns.Where(t => t.TransactionType == "Transfer-Out").ToList();
                    var inTxns = shareTxns.Where(t => t.TransactionType == "Transfer-In").ToList();

                    if (outTxns.Any() || inTxns.Any())
                    {
                        foreach (var inTxn in inTxns)
                        {
                            var toAcc = await _context.ShareAccounts.FindAsync(inTxn.ShareAccountId);
                            if (toAcc != null)
                            {
                                if (toAcc.TotalShareCount < inTxn.NumberOfShares)
                                {
                                    throw new VoucherRollbackDomainException(
                                        StatusCodes.Status400BadRequest,
                                        $"हस्तांतरित शेअर्स पुढील व्यवहारात वापरले गेले असल्यामुळे शेअर ट्रान्सफर व्हाउचर डिलीट करता येत नाही (सध्याचे शेअर्स: {toAcc.TotalShareCount}, आवश्यक: {inTxn.NumberOfShares}).");
                                }

                                toAcc.TotalShareCount = Math.Max(0, toAcc.TotalShareCount - inTxn.NumberOfShares);
                                toAcc.TotalShareAmount = Math.Max(0m, toAcc.TotalShareAmount - inTxn.Amount);
                                _context.Entry(toAcc).State = EntityState.Modified;
                            }

                            ShareCertificate? newCert = await FindShareCertificateForTransactionAsync(inTxn);
                            long restoredFromNo = newCert?.FromShareNo ?? 0;
                            long restoredToNo = newCert?.ToShareNo ?? 0;

                            if (newCert != null)
                            {
                                var prints = await _context.ShareCertificatePrintHistories
                                    .Where(p => p.CertificateId == newCert.CertificateId)
                                    .ToListAsync();
                                if (prints.Any()) _context.ShareCertificatePrintHistories.RemoveRange(prints);
                                _context.ShareCertificates.Remove(newCert);
                            }

                            // Restore transferor certificate(s)
                            foreach (var outTxn in outTxns)
                            {
                                var fromCerts = await _context.ShareCertificates
                                    .Where(c => c.ShareAccountId == outTxn.ShareAccountId)
                                    .OrderByDescending(c => c.CertificateId)
                                    .ToListAsync();

                                foreach (var fc in fromCerts)
                                {
                                    if (fc.Status == "Transferred" &&
                                        ((restoredFromNo > 0 && fc.FromShareNo >= restoredFromNo && fc.ToShareNo <= restoredToNo) ||
                                         restoredFromNo == 0))
                                    {
                                        fc.Status = "Active";
                                        fc.CancellationReason = null;
                                        if (fc.ToShareNo >= fc.FromShareNo && fc.FromShareNo > 0)
                                        {
                                            fc.NumberOfShares = (int)(fc.ToShareNo - fc.FromShareNo + 1);
                                        }
                                        _context.Entry(fc).State = EntityState.Modified;
                                    }
                                    else if (restoredToNo > 0 && fc.FromShareNo == restoredToNo + 1)
                                    {
                                        fc.FromShareNo = restoredFromNo;
                                        fc.NumberOfShares = (int)(fc.ToShareNo - fc.FromShareNo + 1);
                                        _context.Entry(fc).State = EntityState.Modified;
                                    }
                                    else if (restoredFromNo > 0 && fc.ToShareNo == restoredFromNo - 1 && fc.Status == "Active")
                                    {
                                        fc.ToShareNo = restoredToNo;
                                        fc.NumberOfShares = (int)(fc.ToShareNo - fc.FromShareNo + 1);
                                        _context.Entry(fc).State = EntityState.Modified;
                                    }
                                }
                            }
                        }

                        foreach (var outTxn in outTxns)
                        {
                            var fromAcc = await _context.ShareAccounts.FindAsync(outTxn.ShareAccountId);
                            if (fromAcc != null)
                            {
                                fromAcc.TotalShareCount += outTxn.NumberOfShares;
                                fromAcc.TotalShareAmount += outTxn.Amount;
                                if (fromAcc.Status == "Closed") fromAcc.Status = "Active";
                                _context.Entry(fromAcc).State = EntityState.Modified;
                            }
                        }
                    }

                    // 6B. Share Allotment
                    foreach (var st in shareTxns.Where(t => t.TransactionType == "Allotment"))
                    {
                        var shAcc = await _context.ShareAccounts.FindAsync(st.ShareAccountId);
                        if (shAcc != null)
                        {
                            if (shAcc.TotalShareCount < st.NumberOfShares)
                            {
                                throw new VoucherRollbackDomainException(
                                    StatusCodes.Status400BadRequest,
                                    $"शेअर खात्यावरील ({shAcc.AccountNo}) शेअर्स आधीच हस्तांतरित किंवा परत केले गेले असल्यामुळे हे शेअर वाटप व्हाउचर डिलीट करता येत नाही.");
                            }

                            shAcc.TotalShareCount = Math.Max(0, shAcc.TotalShareCount - st.NumberOfShares);
                            shAcc.TotalShareAmount = Math.Max(0m, shAcc.TotalShareAmount - st.Amount);
                            _context.Entry(shAcc).State = EntityState.Modified;
                        }

                        var cert = await FindShareCertificateForTransactionAsync(st);
                        if (cert != null)
                        {
                            var prints = await _context.ShareCertificatePrintHistories
                                .Where(p => p.CertificateId == cert.CertificateId)
                                .ToListAsync();
                            if (prints.Any()) _context.ShareCertificatePrintHistories.RemoveRange(prints);
                            _context.ShareCertificates.Remove(cert);
                        }
                    }

                    // 6C. Share Withdrawal / Refund / Member Closure (VCH-SHR-WD-*)
                    bool isMemberClosureVoucher = voucherGroup.Any(v =>
                        v.Narration != null &&
                        (v.Narration.Contains("Member Closure", StringComparison.OrdinalIgnoreCase) ||
                         v.Narration.Contains("सभासदत्व रद्द")));

                    foreach (var st in shareTxns.Where(t => t.TransactionType == "Withdrawal" || t.TransactionType == "Refund"))
                    {
                        var shAcc = await _context.ShareAccounts.FindAsync(st.ShareAccountId);
                        if (shAcc != null)
                        {
                            shAcc.TotalShareCount += st.NumberOfShares;
                            shAcc.TotalShareAmount += st.Amount;
                            shAcc.Status = "Active";
                            _context.Entry(shAcc).State = EntityState.Modified;

                            var surrenderedCerts = await _context.ShareCertificates
                                .Where(c => c.ShareAccountId == shAcc.ShareAccountId &&
                                            (c.Status == "Surrendered" || c.Status == "Cancelled"))
                                .ToListAsync();
                            foreach (var sc in surrenderedCerts)
                            {
                                sc.Status = "Active";
                                sc.CancellationReason = null;
                                if (sc.ToShareNo >= sc.FromShareNo && sc.FromShareNo > 0)
                                {
                                    sc.NumberOfShares = (int)(sc.ToShareNo - sc.FromShareNo + 1);
                                }
                                _context.Entry(sc).State = EntityState.Modified;
                            }

                            bool isTxnMemberClosure = isMemberClosureVoucher ||
                                                      (st.Narration != null && st.Narration.Contains("Member Closure", StringComparison.OrdinalIgnoreCase));
                            if (isTxnMemberClosure && shAcc.MemberId > 0)
                            {
                                var member = await _context.Members.FindAsync(shAcc.MemberId);
                                if (member != null && member.Status == "Closed")
                                {
                                    member.Status = "Active";
                                    _context.Entry(member).State = EntityState.Modified;
                                }
                            }
                        }
                    }

                    _context.ShareTransactions.RemoveRange(shareTxns);
                    await _context.SaveChangesAsync();
                }
            }

            // 6D. Dividend Distributions
            var dividends = await _context.DividendDistributions
                .Where(d => d.VoucherId.HasValue && voucherIds.Contains(d.VoucherId.Value))
                .ToListAsync();

            if (dividends.Any())
            {
                _context.DividendDistributions.RemoveRange(dividends);
                await _context.SaveChangesAsync();
            }
        }

        private async Task<ShareCertificate?> FindShareCertificateForTransactionAsync(ShareTransaction st)
        {
            if (!string.IsNullOrWhiteSpace(st.Narration))
            {
                var match = Regex.Match(st.Narration, @"Cert(?:ificate)?(?:\s*No)?:\s*([A-Za-z0-9-]+)", RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    string certNo = match.Groups[1].Value.Trim();
                    var exact = await _context.ShareCertificates
                        .FirstOrDefaultAsync(c => c.ShareAccountId == st.ShareAccountId && c.CertificateNo == certNo);
                    if (exact != null) return exact;
                }
            }

            return await _context.ShareCertificates
                .Where(c => c.ShareAccountId == st.ShareAccountId &&
                            c.NumberOfShares == st.NumberOfShares &&
                            c.IssueDate.Date == st.TransactionDate.Date)
                .OrderByDescending(c => c.CertificateId)
                .FirstOrDefaultAsync();
        }

        // =====================================================================
        // MODULE 7: LOAN, NPA & LEGAL
        // =====================================================================

        private async Task RollbackLoanNpaLegalModuleAsync(
            Voucher primaryVoucher,
            HashSet<int> voucherIds,
            HashSet<string> voucherNos,
            HashSet<int> reversedSavingTxnIds,
            HashSet<int> affectedSavingAccountIds,
            HashSet<int> affectedPigmyAccountIds,
            HashSet<int> rolledBackLoanCollectionIds)
        {
            // 7A. Loan Disbursements
            var disbursements = await _context.LoanDisbursements
                .Include(d => d.Deductions)
                .Where(d => d.VoucherID.HasValue && voucherIds.Contains(d.VoucherID.Value))
                .ToListAsync();

            if (disbursements.Any())
            {
                // Reverse any credited SavingTransactions first via our idempotent tracker
                await ReverseAllSavingTransactionsByVoucherNosAsync(voucherNos, reversedSavingTxnIds, affectedSavingAccountIds);
                await _context.SaveChangesAsync();

                foreach (var disb in disbursements)
                {
                    await LoanDisbursementReversalHelper.ReverseAndDeleteDisbursementAsync(
                        _context,
                        disb,
                        primaryVoucher,
                        deleteVoucherRecord: false);
                }
                await _context.SaveChangesAsync();
            }

            // 7B. Loan Collections (Single-branch, Cross-branch IBT, OTS, Demand, FD Settlement)
            var collections = await _context.LoanCollections
                .Include(c => c.Fees)
                .Where(c => (c.VoucherID.HasValue && voucherIds.Contains(c.VoucherID.Value)) ||
                            (c.HomeBranchVoucherID.HasValue && voucherIds.Contains(c.HomeBranchVoucherID.Value)))
                .ToListAsync();

            foreach (var lc in collections)
            {
                await RollbackAndHardDeleteLoanCollectionAsync(
                    lc,
                    voucherIds,
                    voucherNos,
                    reversedSavingTxnIds,
                    affectedSavingAccountIds,
                    affectedPigmyAccountIds,
                    rolledBackLoanCollectionIds);
            }

            // 7C. Section 101 / 91 Legal Expenses (LEG-* / Sec101LegalExpenses)
            var legalExpenses = await _context.Sec101LegalExpenses
                .Where(e => e.VoucherId.HasValue && voucherIds.Contains(e.VoucherId.Value))
                .ToListAsync();

            if (legalExpenses.Any())
            {
                var legalOverdueRows = await _context.OverdueRecoveryLedgers
                    .Where(o => o.VoucherID.HasValue && voucherIds.Contains(o.VoucherID.Value))
                    .ToListAsync();
                if (legalOverdueRows.Any())
                {
                    _context.OverdueRecoveryLedgers.RemoveRange(legalOverdueRows);
                }

                _context.Sec101LegalExpenses.RemoveRange(legalExpenses);
                await _context.SaveChangesAsync();
            }

            // 7D. Batch Loan Interest Posting (PostInterestBatch) & NPA Contra / Provision (HQ-JV-* / JV-LN-INT-*)
            await RollbackBatchLoanInterestAndNpaAsync(primaryVoucher, voucherIds, voucherNos);
        }

        private async Task RollbackAndHardDeleteLoanCollectionAsync(
            LoanCollection collection,
            HashSet<int> voucherIds,
            HashSet<string> voucherNos,
            HashSet<int> reversedSavingTxnIds,
            HashSet<int> affectedSavingAccountIds,
            HashSet<int> affectedPigmyAccountIds,
            HashSet<int> rolledBackLoanCollectionIds)
        {
            if (!rolledBackLoanCollectionIds.Add(collection.LoanCollectionID))
            {
                return;
            }

            var loanAccount = await _context.LoanAccounts.FindAsync(collection.LoanAccountID);
            if (loanAccount != null)
            {
                loanAccount.PrincipalBalance = Math.Round(loanAccount.PrincipalBalance + collection.PrincipalCollected, 2, MidpointRounding.AwayFromZero);
                loanAccount.PurePrincipalBalance = Math.Min(
                    loanAccount.PrincipalBalance,
                    Math.Round(loanAccount.PurePrincipalBalance + collection.PrincipalCollected, 2, MidpointRounding.AwayFromZero));

                decimal penaltyToRestore = collection.PenaltyInterestCollected + collection.PenaltyWaived;
                if (penaltyToRestore > 0)
                {
                    loanAccount.OverdueInterestBalance = Math.Round(loanAccount.OverdueInterestBalance + penaltyToRestore, 2, MidpointRounding.AwayFromZero);
                }

                // Check for exact pre-settlement snapshot tag [PreIntBal:...|PreIntDt:...] from FD Settlement
                bool appliedPreSettlementSnapshot = false;
                if (!string.IsNullOrWhiteSpace(collection.Remarks))
                {
                    var snapMatch = Regex.Match(collection.Remarks, @"\[PreIntBal:([0-9.\-]+)\|PreIntDt:([0-9\-A-Za-z]+)\]");
                    if (snapMatch.Success &&
                        decimal.TryParse(snapMatch.Groups[1].Value, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal preIntBal))
                    {
                        loanAccount.InterestBalance = Math.Round(Math.Max(0m, preIntBal), 2, MidpointRounding.AwayFromZero);
                        string dtToken = snapMatch.Groups[2].Value.Trim();
                        if (string.Equals(dtToken, "NULL", StringComparison.OrdinalIgnoreCase))
                        {
                            loanAccount.LastInterestPostingDate = null;
                        }
                        else if (DateTime.TryParseExact(dtToken, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime parsedDt))
                        {
                            loanAccount.LastInterestPostingDate = parsedDt;
                        }
                        appliedPreSettlementSnapshot = true;
                    }
                }

                if (!appliedPreSettlementSnapshot)
                {
                    decimal receivableToRestore = collection.ReceivableInterestCollected + collection.InterestWaived;
                    if (receivableToRestore > 0)
                    {
                        loanAccount.InterestBalance = Math.Round(loanAccount.InterestBalance + receivableToRestore, 2, MidpointRounding.AwayFromZero);
                    }
                }

                if ((loanAccount.Status == "Closed" || loanAccount.Status == "Closed_OTS") &&
                    (loanAccount.PrincipalBalance > 0.009m || loanAccount.InterestBalance > 0.009m || loanAccount.OverdueInterestBalance > 0.009m))
                {
                    loanAccount.Status = "Active";
                }
            }

            // Reverse Pigmy Transfer if used
            if (collection.SourcePigmyAccountID.HasValue && collection.SourcePigmyAccountID.Value > 0)
            {
                decimal totalDeducted = collection.TotalAmountReceived + (collection.Fees?.Sum(f => f.Amount) ?? 0m);
                var pigmyAcc = await _context.PigmyAccounts.FindAsync(collection.SourcePigmyAccountID.Value);
                if (pigmyAcc != null)
                {
                    pigmyAcc.TotalDepositedAmount = Math.Round(pigmyAcc.TotalDepositedAmount + totalDeducted, 2, MidpointRounding.AwayFromZero);
                    pigmyAcc.TotalWithdrawnAmount = Math.Max(0m, Math.Round(pigmyAcc.TotalWithdrawnAmount - totalDeducted, 2, MidpointRounding.AwayFromZero));
                    if (collection.PigmyTransferType == "CLOSURE" && pigmyAcc.Status == "Closed")
                    {
                        pigmyAcc.Status = pigmyAcc.MaturityDate.Date <= DateTime.Today ? "Matured" : "Active";
                    }
                    _context.Entry(pigmyAcc).State = EntityState.Modified;
                    affectedPigmyAccountIds.Add(pigmyAcc.PigmyAccountID);

                    if (!string.IsNullOrWhiteSpace(collection.ReceiptNo))
                    {
                        var pigmyTxns = await _context.PigmyTransactions
                            .Where(pt => pt.PigmyAccountID == pigmyAcc.PigmyAccountID &&
                                         (pt.ReferenceId == collection.ReceiptNo || pt.Narration.Contains(collection.ReceiptNo)))
                            .ToListAsync();
                        if (pigmyTxns.Any())
                        {
                            _context.PigmyTransactions.RemoveRange(pigmyTxns);
                        }
                    }
                }
            }

            // Reverse Saving Transfer ONCE (never double-refunding!)
            if (collection.PaymentMode == "Saving Transfer" || collection.PaymentMode == "Saving")
            {
                var vNoList = voucherNos.ToList();
                var candidateSavTxns = await _context.SavingTransactions
                    .Where(st => (st.VoucherNo != null && vNoList.Contains(st.VoucherNo)) ||
                                 (!string.IsNullOrEmpty(collection.ReceiptNo) && st.Narration != null && st.Narration.Contains(collection.ReceiptNo)))
                    .ToListAsync();

                if (candidateSavTxns.Any())
                {
                    foreach (var st in candidateSavTxns)
                    {
                        await ReverseAndHardDeleteSavingTxnOnceAsync(st, reversedSavingTxnIds, affectedSavingAccountIds);
                    }
                }
            }

            // Remove associated LoanCollectionFees
            var fees = (collection.Fees != null && collection.Fees.Any())
                ? collection.Fees.ToList()
                : await _context.LoanCollectionFees.Where(f => f.LoanCollectionID == collection.LoanCollectionID).ToListAsync();
            if (fees.Any())
            {
                _context.LoanCollectionFees.RemoveRange(fees);
            }

            // Remove any OverdueInterestLedgers / OverdueRecoveryLedgers linked to this collection
            var colVoucherIds = new HashSet<int>(voucherIds);
            if (collection.VoucherID.HasValue) colVoucherIds.Add(collection.VoucherID.Value);
            if (collection.HomeBranchVoucherID.HasValue) colVoucherIds.Add(collection.HomeBranchVoucherID.Value);

            var colOverdueInt = await _context.OverdueInterestLedgers
                .Where(o => (o.VoucherID.HasValue && colVoucherIds.Contains(o.VoucherID.Value)) ||
                            (!string.IsNullOrEmpty(collection.ReceiptNo) && o.Particulars.Contains(collection.ReceiptNo)))
                .ToListAsync();
            if (colOverdueInt.Any())
            {
                foreach (var oi in colOverdueInt)
                {
                    if (loanAccount != null && oi.LoanAccountID == loanAccount.LoanAccountID && oi.DebitAmount > 0)
                    {
                        loanAccount.InterestProvisionBalance = Math.Round(loanAccount.InterestProvisionBalance + oi.DebitAmount, 2, MidpointRounding.AwayFromZero);
                    }
                }
                _context.OverdueInterestLedgers.RemoveRange(colOverdueInt);
            }

            var colOverdueRec = await _context.OverdueRecoveryLedgers
                .Where(o => (o.VoucherID.HasValue && colVoucherIds.Contains(o.VoucherID.Value)) ||
                            (!string.IsNullOrEmpty(collection.ReceiptNo) && o.Particulars.Contains(collection.ReceiptNo)))
                .ToListAsync();
            if (colOverdueRec.Any())
            {
                _context.OverdueRecoveryLedgers.RemoveRange(colOverdueRec);
            }

            collection.VoucherID = null;
            collection.HomeBranchVoucherID = null;
            _context.LoanCollections.Remove(collection);
            await _context.SaveChangesAsync();

            if (loanAccount != null)
            {
                var remainingCols = await _context.LoanCollections
                    .Where(c => c.LoanAccountID == loanAccount.LoanAccountID)
                    .OrderByDescending(c => c.CollectionDate)
                    .ThenByDescending(c => c.LoanCollectionID)
                    .ToListAsync();

                loanAccount.LastInstallmentPaidDate = remainingCols.FirstOrDefault()?.CollectionDate;
                _context.Entry(loanAccount).State = EntityState.Modified;

                var allSchedules = await _context.LoanInstallmentSchedules
                    .Where(s => s.LoanAccountID == loanAccount.LoanAccountID)
                    .OrderBy(s => s.InstallmentNo)
                    .ToListAsync();

                if (allSchedules.Any())
                {
                    LoanScheduleGenerator.SynchronizeSchedules(loanAccount, allSchedules, remainingCols);
                    foreach (var sch in allSchedules)
                    {
                        _context.Entry(sch).State = EntityState.Modified;
                    }
                }

                await _context.SaveChangesAsync();
            }
        }

        private async Task RollbackBatchLoanInterestAndNpaAsync(
            Voucher primaryVoucher,
            HashSet<int> voucherIds,
            HashSet<string> voucherNos)
        {
            var vNoList = voucherNos.ToList();
            bool reversedFromSnapshot = false;

            if (vNoList.Any())
            {
                var batchAudit = await _context.AuditLogs
                    .Where(a => a.Action == "LOAN_INTEREST_POSTING_BATCH" &&
                                a.EntityID != null &&
                                vNoList.Contains(a.EntityID))
                    .OrderByDescending(a => a.AuditLogID)
                    .FirstOrDefaultAsync();

                if (batchAudit?.Details != null)
                {
                    int snapIdx = batchAudit.Details.IndexOf(BatchSnapshotPrefix, StringComparison.Ordinal);
                    if (snapIdx >= 0)
                    {
                        int jsonStart = snapIdx + BatchSnapshotPrefix.Length;
                        int jsonEnd = batchAudit.Details.LastIndexOf(']');
                        if (jsonEnd > jsonStart)
                        {
                            string json = batchAudit.Details.Substring(jsonStart, jsonEnd - jsonStart);
                            var snapshots = JsonSerializer.Deserialize<List<LoanInterestBatchAccountSnapshot>>(json);
                            if (snapshots != null && snapshots.Any())
                            {
                                foreach (var snap in snapshots)
                                {
                                    var loan = await _context.LoanAccounts.FindAsync(snap.LoanAccountID);
                                    if (loan == null) continue;

                                    if (snap.Capitalized)
                                    {
                                        loan.PrincipalBalance = Math.Max(0m, Math.Round(loan.PrincipalBalance - snap.Interest, 2, MidpointRounding.AwayFromZero));
                                        loan.CapitalizedInterestAmount = Math.Max(0m, Math.Round(loan.CapitalizedInterestAmount - snap.Interest, 2, MidpointRounding.AwayFromZero));
                                    }
                                    else
                                    {
                                        loan.InterestBalance = Math.Max(0m, Math.Round(loan.InterestBalance - snap.Interest, 2, MidpointRounding.AwayFromZero));
                                    }

                                    loan.LastInterestPostingDate = snap.PrevLastPaidDate;
                                    _context.Entry(loan).State = EntityState.Modified;
                                }
                                reversedFromSnapshot = true;
                            }
                        }
                    }
                }
            }

            // Fallback for older Loan Interest Run vouchers created before JSON snapshot tagging
            if (!reversedFromSnapshot &&
                !string.IsNullOrWhiteSpace(primaryVoucher.Narration) &&
                primaryVoucher.Narration.StartsWith("Loan Interest Run", StringComparison.OrdinalIgnoreCase))
            {
                var detailLedgerIds = (primaryVoucher.VoucherDetails ?? new List<VoucherDetail>())
                    .Where(vd => vd.DrCr == "Dr")
                    .Select(vd => vd.LedgerID)
                    .Distinct()
                    .ToList();

                var matchingSchemeIds = await _context.LoanRates
                    .Where(r => (r.LoanLedgerID.HasValue && detailLedgerIds.Contains(r.LoanLedgerID.Value)) ||
                                (r.ReceivableInterestLedgerID.HasValue && detailLedgerIds.Contains(r.ReceivableInterestLedgerID.Value)))
                    .Select(r => r.LoanRateID)
                    .ToListAsync();

                if (matchingSchemeIds.Any())
                {
                    var candidateLoans = await _context.LoanAccounts
                        .Where(l => l.BranchID == primaryVoucher.BranchID &&
                                    matchingSchemeIds.Contains(l.LoanRateID) &&
                                    l.LastInterestPostingDate.HasValue &&
                                    l.LastInterestPostingDate.Value.Date == primaryVoucher.VoucherDate.Date)
                        .ToListAsync();

                    decimal remainingDrToReverse = (primaryVoucher.VoucherDetails ?? new List<VoucherDetail>())
                        .Where(vd => vd.DrCr == "Dr")
                        .Sum(vd => vd.Amount);

                    foreach (var loan in candidateLoans)
                    {
                        if (remainingDrToReverse <= 0.009m) break;
                        if (loan.InterestBalance > 0)
                        {
                            decimal deduct = Math.Min(loan.InterestBalance, remainingDrToReverse);
                            loan.InterestBalance = Math.Max(0m, Math.Round(loan.InterestBalance - deduct, 2, MidpointRounding.AwayFromZero));
                            remainingDrToReverse -= deduct;
                        }
                        else if (loan.CapitalizedInterestAmount > 0)
                        {
                            decimal deduct = Math.Min(loan.CapitalizedInterestAmount, remainingDrToReverse);
                            loan.CapitalizedInterestAmount = Math.Max(0m, Math.Round(loan.CapitalizedInterestAmount - deduct, 2, MidpointRounding.AwayFromZero));
                            loan.PrincipalBalance = Math.Max(0m, Math.Round(loan.PrincipalBalance - deduct, 2, MidpointRounding.AwayFromZero));
                            remainingDrToReverse -= deduct;
                        }
                        loan.LastInterestPostingDate = null;
                        _context.Entry(loan).State = EntityState.Modified;
                    }
                }
            }

            // Clean OverdueInterestLedgers & OverdueRecoveryLedgers (NPA Contra HQ-JV-* / Monthly Interest JV-LN-INT-*)
            var overdueIntRows = await _context.OverdueInterestLedgers
                .Where(o => o.VoucherID.HasValue && voucherIds.Contains(o.VoucherID.Value))
                .ToListAsync();

            if (overdueIntRows.Any())
            {
                foreach (var oi in overdueIntRows)
                {
                    var loan = await _context.LoanAccounts.FindAsync(oi.LoanAccountID);
                    if (loan != null)
                    {
                        decimal netContra = oi.CreditAmount - oi.DebitAmount;
                        if (netContra > 0)
                        {
                            loan.InterestProvisionBalance = Math.Max(0m, Math.Round(loan.InterestProvisionBalance - netContra, 2, MidpointRounding.AwayFromZero));
                            _context.Entry(loan).State = EntityState.Modified;
                        }
                    }
                }
                _context.OverdueInterestLedgers.RemoveRange(overdueIntRows);
            }

            var overdueRecRows = await _context.OverdueRecoveryLedgers
                .Where(o => o.VoucherID.HasValue && voucherIds.Contains(o.VoucherID.Value))
                .ToListAsync();

            if (overdueRecRows.Any())
            {
                _context.OverdueRecoveryLedgers.RemoveRange(overdueRecRows);
            }

            await _context.SaveChangesAsync();
        }

        // =====================================================================
        // MODULE 8: INVESTMENT
        // =====================================================================

        private async Task RollbackInvestmentModuleAsync(
            HashSet<int> voucherIds,
            HashSet<string> voucherNos)
        {
            // 8A. Investment Maturity
            var maturities = await _context.InvestmentMaturities
                .Where(m => m.VoucherID.HasValue && voucherIds.Contains(m.VoucherID.Value))
                .ToListAsync();
            foreach (var mat in maturities)
            {
                var inv = await _context.InvestmentAccounts.FindAsync(mat.InvestmentAccountID);
                if (inv != null)
                {
                    inv.Status = "Active";
                    _context.Entry(inv).State = EntityState.Modified;
                }
            }
            if (maturities.Any()) _context.InvestmentMaturities.RemoveRange(maturities);

            // 8B. Investment Premature Withdrawal
            var prematures = await _context.InvestmentPrematureWithdrawals
                .Where(p => p.VoucherID.HasValue && voucherIds.Contains(p.VoucherID.Value))
                .ToListAsync();
            foreach (var pre in prematures)
            {
                var inv = await _context.InvestmentAccounts.FindAsync(pre.InvestmentAccountID);
                if (inv != null)
                {
                    inv.Status = "Active";
                    _context.Entry(inv).State = EntityState.Modified;
                }
            }
            if (prematures.Any()) _context.InvestmentPrematureWithdrawals.RemoveRange(prematures);

            // 8C. Investment Interest Receipts & Accruals
            var intReceipts = await _context.InvestmentInterestReceipts
                .Where(r => r.VoucherID.HasValue && voucherIds.Contains(r.VoucherID.Value))
                .ToListAsync();
            if (intReceipts.Any()) _context.InvestmentInterestReceipts.RemoveRange(intReceipts);

            var intAccruals = await _context.InvestmentInterestAccruals
                .Where(a => a.VoucherID.HasValue && voucherIds.Contains(a.VoucherID.Value))
                .ToListAsync();
            if (intAccruals.Any()) _context.InvestmentInterestAccruals.RemoveRange(intAccruals);

            await _context.SaveChangesAsync();

            // 8D. Investment Renewals
            var renewals = await _context.InvestmentRenewals
                .Where(r => r.VoucherID.HasValue && voucherIds.Contains(r.VoucherID.Value))
                .ToListAsync();
            if (renewals.Any())
            {
                var invBranchesToSync = new HashSet<int>();
                foreach (var ren in renewals)
                {
                    int newInvId = ren.NewInvestmentAccountID;
                    bool childHasActivity =
                        await _context.InvestmentMaturities.AnyAsync(m => m.InvestmentAccountID == newInvId) ||
                        await _context.InvestmentPrematureWithdrawals.AnyAsync(p => p.InvestmentAccountID == newInvId) ||
                        await _context.InvestmentRenewals.AnyAsync(r => r.OldInvestmentAccountID == newInvId && r.RenewalID != ren.RenewalID) ||
                        await _context.InvestmentInterestReceipts.AnyAsync(r => r.InvestmentAccountID == newInvId) ||
                        await _context.InvestmentInterestAccruals.AnyAsync(a => a.InvestmentAccountID == newInvId);

                    if (childHasActivity)
                    {
                        throw new VoucherRollbackDomainException(
                            StatusCodes.Status400BadRequest,
                            "नूतनीकरणातून तयार झालेल्या नवीन गुंतवणूक खात्यावर पुढील व्यवहार नोंदवले गेले असल्यामुळे हे गुंतवणूक नूतनीकरण व्हाउचर डिलीट करता येत नाही.");
                    }

                    var oldInv = await _context.InvestmentAccounts.FindAsync(ren.OldInvestmentAccountID);
                    if (oldInv != null)
                    {
                        oldInv.Status = "Active";
                        _context.Entry(oldInv).State = EntityState.Modified;
                    }

                    _context.InvestmentRenewals.Remove(ren);
                    await _context.SaveChangesAsync();

                    var newInv = await _context.InvestmentAccounts.FindAsync(newInvId);
                    if (newInv != null)
                    {
                        invBranchesToSync.Add(newInv.BranchID);
                        _context.InvestmentAccounts.Remove(newInv);
                        await _context.SaveChangesAsync();
                    }
                }

                foreach (int bId in invBranchesToSync.Where(b => b > 0))
                {
                    await SyncBranchInvestmentSequenceAsync(bId);
                }
            }

            // 8E. Investment Opening (PAY-INV-OP-{InvestmentNo})
            foreach (var vNo in voucherNos)
            {
                if (!vNo.StartsWith("PAY-INV-OP-", StringComparison.OrdinalIgnoreCase)) continue;
                string invNo = vNo.Substring("PAY-INV-OP-".Length).Trim();
                if (string.IsNullOrEmpty(invNo)) continue;

                var invAcc = await _context.InvestmentAccounts.FirstOrDefaultAsync(i => i.InvestmentNo == invNo);
                if (invAcc == null || invAcc.IsLegacyAccount) continue;

                int invId = invAcc.InvestmentAccountID;
                bool hasChildRows =
                    await _context.InvestmentMaturities.AnyAsync(m => m.InvestmentAccountID == invId) ||
                    await _context.InvestmentPrematureWithdrawals.AnyAsync(p => p.InvestmentAccountID == invId) ||
                    await _context.InvestmentRenewals.AnyAsync(r => r.OldInvestmentAccountID == invId || r.NewInvestmentAccountID == invId) ||
                    await _context.InvestmentInterestReceipts.AnyAsync(r => r.InvestmentAccountID == invId) ||
                    await _context.InvestmentInterestAccruals.AnyAsync(a => a.InvestmentAccountID == invId);

                if (hasChildRows)
                {
                    throw new VoucherRollbackDomainException(
                        StatusCodes.Status400BadRequest,
                        $"गुंतवणूक खाते क्र. {invAcc.InvestmentNo} वर पुढील व्याज/मॅच्युरिटी/नूतनीकरण व्यवहार अस्तित्वात असल्यामुळे ओपनिंग व्हाउचर डिलीट करता येत नाही.");
                }

                int invBranchId = invAcc.BranchID;
                _context.InvestmentAccounts.Remove(invAcc);
                await _context.SaveChangesAsync();
                await SyncBranchInvestmentSequenceAsync(invBranchId);
            }
        }

        // =====================================================================
        // MODULE 9: LOCKER
        // =====================================================================

        private async Task RollbackLockerModuleAsync(HashSet<int> voucherIds)
        {
            // 9A. Locker Surrenders (VCH-LKR-REF-*)
            var surrenders = await _context.LockerSurrenders
                .Where(s => s.VoucherID.HasValue && voucherIds.Contains(s.VoucherID.Value))
                .ToListAsync();

            foreach (var sur in surrenders)
            {
                var allotment = await _context.LockerAllotments.FindAsync(sur.AllotmentID);
                if (allotment != null)
                {
                    allotment.Status = "Active";
                    _context.Entry(allotment).State = EntityState.Modified;

                    var locker = await _context.Lockers.FindAsync(allotment.LockerID);
                    if (locker != null)
                    {
                        locker.Status = "Allotted";
                        _context.Entry(locker).State = EntityState.Modified;
                    }
                }
            }
            if (surrenders.Any())
            {
                _context.LockerSurrenders.RemoveRange(surrenders);
                await _context.SaveChangesAsync();
            }

            // 9B. Locker Allotments (VCH-LKR-DEP-* & VCH-LKR-RNT-*)
            var allotments = await _context.LockerAllotments
                .Where(a => (a.DepositVoucherID.HasValue && voucherIds.Contains(a.DepositVoucherID.Value)) ||
                            (a.AdvanceRentVoucherID.HasValue && voucherIds.Contains(a.AdvanceRentVoucherID.Value)))
                .ToListAsync();

            if (allotments.Any())
            {
                foreach (var allot in allotments)
                {
                    bool hasSurrender = await _context.LockerSurrenders.AnyAsync(s => s.AllotmentID == allot.AllotmentID);
                    bool hasLaterRent = await _context.LockerRentPostings
                        .AnyAsync(rp => rp.AllotmentID == allot.AllotmentID &&
                                        (!rp.VoucherID.HasValue || !voucherIds.Contains(rp.VoucherID.Value)));

                    if (hasSurrender || hasLaterRent)
                    {
                        throw new VoucherRollbackDomainException(
                            StatusCodes.Status400BadRequest,
                            $"लॉकर वाटप क्र. {allot.LockerAccountNo} वर पुढील भाडे वसुली किंवा सरेंडर व्यवहार झालेला असल्यामुळे वाटप व्हाउचर डिलीट करता येत नाही.");
                    }

                    var initialRentRows = await _context.LockerRentPostings
                        .Where(rp => rp.AllotmentID == allot.AllotmentID)
                        .ToListAsync();
                    if (initialRentRows.Any()) _context.LockerRentPostings.RemoveRange(initialRentRows);

                    var visits = await _context.LockerVisitRegisters
                        .Where(v => v.AllotmentID == allot.AllotmentID)
                        .ToListAsync();
                    if (visits.Any()) _context.LockerVisitRegisters.RemoveRange(visits);

                    var locker = await _context.Lockers.FindAsync(allot.LockerID);
                    if (locker != null)
                    {
                        locker.Status = "Available";
                        _context.Entry(locker).State = EntityState.Modified;
                    }
                }

                await _context.SaveChangesAsync();
                _context.LockerAllotments.RemoveRange(allotments);
                await _context.SaveChangesAsync();
            }

            // 9C. Subsequent Locker Rent Postings (VCH-LKR-REN-*)
            var rentPostings = await _context.LockerRentPostings
                .Where(rp => rp.VoucherID.HasValue && voucherIds.Contains(rp.VoucherID.Value))
                .OrderByDescending(rp => rp.ToDate)
                .ToListAsync();

            if (rentPostings.Any())
            {
                foreach (var rp in rentPostings)
                {
                    var allot = await _context.LockerAllotments.FindAsync(rp.AllotmentID);
                    if (allot != null)
                    {
                        allot.ExpiryDate = rp.FromDate;
                        _context.Entry(allot).State = EntityState.Modified;
                    }
                }

                _context.LockerRentPostings.RemoveRange(rentPostings);
                await _context.SaveChangesAsync();
            }
        }

        // =====================================================================
        // MODULE 10: FIXED ASSETS
        // =====================================================================

        private async Task RollbackFixedAssetModuleAsync(HashSet<int> voucherIds)
        {
            // 10A. Asset Purchases
            var purchases = await _context.AssetPurchases
                .Where(p => p.VoucherID.HasValue && voucherIds.Contains(p.VoucherID.Value))
                .ToListAsync();

            if (purchases.Any())
            {
                foreach (var pur in purchases)
                {
                    var assetIds = new List<int>();
                    if (!string.IsNullOrWhiteSpace(pur.AssetIdsJson))
                    {
                        var parsed = JsonSerializer.Deserialize<List<int>>(pur.AssetIdsJson);
                        if (parsed != null) assetIds.AddRange(parsed);
                    }

                    var assetsToDelete = assetIds.Any()
                        ? await _context.Assets.Where(a => assetIds.Contains(a.AssetID)).ToListAsync()
                        : await _context.Assets
                            .Where(a => a.BranchID == pur.BranchID &&
                                        !a.IsOpeningBalance &&
                                        a.PurchaseDate.Date == pur.InvoiceDate.Date &&
                                        a.OriginalCost <= pur.TotalAmount)
                            .ToListAsync();

                    foreach (var asset in assetsToDelete)
                    {
                        int aId = asset.AssetID;
                        bool hasDownstream =
                            await _context.AssetDepreciations.AnyAsync(d => d.AssetID == aId) ||
                            await _context.AssetDisposals.AnyAsync(d => d.AssetID == aId) ||
                            await _context.AssetMaintenances.AnyAsync(m => m.AssetID == aId) ||
                            await _context.AssetAllocations.AnyAsync(al => al.AssetID == aId) ||
                            await _context.AssetTransfers.AnyAsync(tr => tr.AssetID == aId) ||
                            await _context.AssetVerifications.AnyAsync(vf => vf.AssetID == aId);

                        if (hasDownstream)
                        {
                            throw new VoucherRollbackDomainException(
                                StatusCodes.Status400BadRequest,
                                $"मालमत्ता '{asset.AssetCode} - {asset.AssetName}' वर घसारा/दुरुस्ती/वाटप/विक्री व्यवहार अस्तित्वात असल्यामुळे खरेदी व्हाउचर डिलीट करता येत नाही.");
                        }
                    }

                    if (assetsToDelete.Any())
                    {
                        _context.Assets.RemoveRange(assetsToDelete);
                    }
                }

                _context.AssetPurchases.RemoveRange(purchases);
                await _context.SaveChangesAsync();
            }

            // 10B. Asset Maintenances
            var maintenances = await _context.AssetMaintenances
                .Where(m => m.VoucherID.HasValue && voucherIds.Contains(m.VoucherID.Value))
                .ToListAsync();
            if (maintenances.Any())
            {
                _context.AssetMaintenances.RemoveRange(maintenances);
                await _context.SaveChangesAsync();
            }

            // 10C. Asset Disposals
            var disposals = await _context.AssetDisposals
                .Where(d => d.VoucherID.HasValue && voucherIds.Contains(d.VoucherID.Value))
                .ToListAsync();
            if (disposals.Any())
            {
                foreach (var disp in disposals)
                {
                    var asset = await _context.Assets.FindAsync(disp.AssetID);
                    if (asset != null)
                    {
                        asset.Status = "Active";
                        asset.CurrentBookValue = disp.BookValueAtDisposal;
                        _context.Entry(asset).State = EntityState.Modified;
                    }
                }
                _context.AssetDisposals.RemoveRange(disposals);
                await _context.SaveChangesAsync();
            }

            // 10D. Asset Depreciations
            var depreciations = await _context.AssetDepreciations
                .Where(d => d.VoucherID.HasValue && voucherIds.Contains(d.VoucherID.Value))
                .ToListAsync();
            if (depreciations.Any())
            {
                foreach (var dep in depreciations)
                {
                    var asset = await _context.Assets.FindAsync(dep.AssetID);
                    if (asset != null)
                    {
                        asset.AccumulatedDepreciation = Math.Max(0m, Math.Round(asset.AccumulatedDepreciation - dep.DepreciationAmount, 2, MidpointRounding.AwayFromZero));
                        asset.CurrentBookValue = Math.Round(asset.CurrentBookValue + dep.DepreciationAmount, 2, MidpointRounding.AwayFromZero);
                        _context.Entry(asset).State = EntityState.Modified;
                    }
                }
                _context.AssetDepreciations.RemoveRange(depreciations);
                await _context.SaveChangesAsync();
            }
        }

        // =====================================================================
        // MODULE 11: SAVING
        // =====================================================================

        private async Task RollbackSavingModuleAsync(
            HashSet<int> voucherIds,
            HashSet<string> voucherNos,
            HashSet<int> reversedSavingTxnIds,
            HashSet<int> affectedSavingAccountIds)
        {
            if (!voucherNos.Any()) return;
            var vNoList = voucherNos.ToList();

            // 11A. Saving Account Closings (VCH-SAV-CLS-*)
            var closings = await _context.SavingAccountClosings
                .Where(c => c.VoucherNo != null && vNoList.Contains(c.VoucherNo))
                .ToListAsync();

            if (closings.Any())
            {
                foreach (var cls in closings)
                {
                    bool hadLinkedSavTxns = await _context.SavingTransactions
                        .AnyAsync(st => st.SavingAccountID == cls.SavingAccountID &&
                                        st.VoucherNo != null &&
                                        vNoList.Contains(st.VoucherNo));

                    await ReverseAllSavingTransactionsByVoucherNosAsync(voucherNos, reversedSavingTxnIds, affectedSavingAccountIds);

                    var savAcc = await _context.SavingAccountMasters.FindAsync(cls.SavingAccountID);
                    if (savAcc != null)
                    {
                        if (!hadLinkedSavTxns && cls.GrossBalance > 0)
                        {
                            savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance + cls.GrossBalance, 2, MidpointRounding.AwayFromZero);
                        }
                        savAcc.Status = "Active";
                        savAcc.ClosingDate = null;
                        _context.Entry(savAcc).State = EntityState.Modified;
                        affectedSavingAccountIds.Add(savAcc.SavingAccountID);
                    }
                }

                _context.SavingAccountClosings.RemoveRange(closings);
                await _context.SaveChangesAsync();
            }

            // 11B. Saving Interest Postings (VCH-SAV-INT-*)
            var interestTxns = await _context.SavingTransactions
                .Where(st => st.VoucherNo != null &&
                             vNoList.Contains(st.VoucherNo) &&
                             st.TransactionType == "Interest")
                .ToListAsync();

            var interestAccountIds = interestTxns.Select(t => t.SavingAccountID).Distinct().ToList();
            decimal reversedInterestTotal = interestTxns.Sum(t => t.Amount);

            foreach (var itx in interestTxns)
            {
                await ReverseAndHardDeleteSavingTxnOnceAsync(itx, reversedSavingTxnIds, affectedSavingAccountIds);
            }

            if (interestTxns.Any())
            {
                await _context.SaveChangesAsync();

                foreach (int savAccId in interestAccountIds)
                {
                    var savAcc = await _context.SavingAccountMasters.FindAsync(savAccId);
                    if (savAcc == null) continue;

                    var prevInterestTx = await _context.SavingTransactions
                        .Where(t => t.SavingAccountID == savAccId && t.TransactionType == "Interest")
                        .OrderByDescending(t => t.TransactionDate)
                        .ThenByDescending(t => t.TransactionID)
                        .FirstOrDefaultAsync();

                    savAcc.LastInterestPostingDate = prevInterestTx?.TransactionDate;
                    savAcc.LastInterestAmount = prevInterestTx?.Amount;
                    _context.Entry(savAcc).State = EntityState.Modified;
                }
            }

            // Match SavingInterestPostings (handles both single VoucherNo and comma-separated multi-branch VoucherNo)
            var candidatePostings = await _context.SavingInterestPostings
                .Where(p => p.VoucherNo != null && vNoList.Any(vn => p.VoucherNo.Contains(vn)))
                .ToListAsync();

            foreach (var post in candidatePostings)
            {
                var tokens = (post.VoucherNo ?? string.Empty)
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(t => t.Trim())
                    .Where(t => !string.IsNullOrWhiteSpace(t))
                    .ToList();

                int removedCount = tokens.RemoveAll(t => voucherNos.Contains(t));
                if (removedCount <= 0) continue;

                decimal remainingInterest = Math.Max(0m, Math.Round(post.TotalInterest - reversedInterestTotal, 2, MidpointRounding.AwayFromZero));
                if (!tokens.Any() || remainingInterest <= 0.009m)
                {
                    _context.SavingInterestPostings.Remove(post);
                }
                else
                {
                    post.VoucherNo = string.Join(", ", tokens);
                    post.TotalInterest = remainingInterest;
                    _context.Entry(post).State = EntityState.Modified;
                }
            }

            // 11C. General Sweep: Reverse all remaining SavingTransactions matching voucherNos
            await ReverseAllSavingTransactionsByVoucherNosAsync(voucherNos, reversedSavingTxnIds, affectedSavingAccountIds);
            await _context.SaveChangesAsync();

            // 11D. Saving Account Opening Deposit (VCH-SAV-OPN-*)
            bool isSavingOpeningVoucher = voucherNos.Any(v => v.StartsWith("VCH-SAV-OPN-", StringComparison.OrdinalIgnoreCase));
            if (isSavingOpeningVoucher && affectedSavingAccountIds.Any())
            {
                var savBranchesToSync = new HashSet<int>();
                foreach (int savAccId in affectedSavingAccountIds.ToList())
                {
                    var savAcc = await _context.SavingAccountMasters.FindAsync(savAccId);
                    if (savAcc == null || savAcc.IsLegacyAccount) continue;

                    bool hasRemainingTxns = await _context.SavingTransactions.AnyAsync(t => t.SavingAccountID == savAccId);
                    if (hasRemainingTxns)
                    {
                        throw new VoucherRollbackDomainException(
                            StatusCodes.Status400BadRequest,
                            $"बचत खाते क्र. {savAcc.AccountNo} वर पुढील व्यवहार अस्तित्वात असल्यामुळे ओपनिंग ठेव व्हाउचर डिलीट करता येत नाही.");
                    }

                    bool referencedElsewhere =
                        savAcc.LienAmount > 0 ||
                        await _context.SavingAccountClosings.AnyAsync(c => c.SavingAccountID == savAccId) ||
                        await _context.FdAccounts.AnyAsync(f => f.SavingAccountID == savAccId) ||
                        await _context.RdAccounts.AnyAsync(r => r.SavingAccountID == savAccId) ||
                        await _context.LockerAllotments.AnyAsync(l => l.LinkedSavingAccountID == savAccId) ||
                        await _context.FdMisPayouts.AnyAsync(m => m.TargetSavingAccountID == savAccId) ||
                        await _context.LoanCollections.AnyAsync(c => c.SourceSavingAccountID == savAccId);

                    if (!referencedElsewhere)
                    {
                        var jointHolders = await _context.SavingAccountJointHolders
                            .Where(j => j.SavingAccountID == savAccId)
                            .ToListAsync();
                        if (jointHolders.Any()) _context.SavingAccountJointHolders.RemoveRange(jointHolders);

                        var passbooks = await _context.SavingPassbooks
                            .Where(p => p.SavingAccountID == savAccId)
                            .ToListAsync();
                        if (passbooks.Any()) _context.SavingPassbooks.RemoveRange(passbooks);

                        savBranchesToSync.Add(savAcc.BranchID);
                        _context.SavingAccountMasters.Remove(savAcc);
                        affectedSavingAccountIds.Remove(savAccId);
                        await _context.SaveChangesAsync();
                    }
                }

                foreach (int bId in savBranchesToSync.Where(b => b > 0))
                {
                    await SyncBranchSavingSequencesAsync(bId);
                }
            }
        }

        // =====================================================================
        // MODULE 12: CASH MANAGEMENT
        // =====================================================================

        private async Task RollbackCashManagementAsync(HashSet<string> voucherNos)
        {
            if (!voucherNos.Any()) return;
            var vNoList = voucherNos.ToList();

            var allocations = await _context.CashAllocations
                .Where(ca => ca.Remarks != null && vNoList.Any(vn => ca.Remarks.Contains(vn)))
                .ToListAsync();
            if (allocations.Any())
            {
                _context.CashAllocations.RemoveRange(allocations);
            }

            var denominations = await _context.CashDenominations
                .Where(cd => cd.Remarks != null && vNoList.Any(vn => cd.Remarks.Contains(vn)))
                .ToListAsync();
            if (denominations.Any())
            {
                _context.CashDenominations.RemoveRange(denominations);
            }
        }

        // =====================================================================
        // SEQUENCE RESYNC HELPERS (14-DIGIT CBS SAFE)
        // =====================================================================

        private async Task SyncBranchSavingSequencesAsync(int branchId)
        {
            if (branchId <= 0) return;

            var seqRows = await _context.SavingAccountSequences
                .Where(s => s.BranchID == branchId)
                .ToListAsync();
            if (!seqRows.Any()) return;

            var accounts = await _context.SavingAccountMasters
                .Where(a => a.BranchID == branchId && a.AccountNo != null)
                .Select(a => a.AccountNo!)
                .ToListAsync();

            foreach (var seqRow in seqRows)
            {
                int maxSeq = 0;
                string schemeStr = seqRow.SchemeCodeNumeric.ToString("D3", CultureInfo.InvariantCulture);
                foreach (var accNo in accounts)
                {
                    string digits = new string(accNo.Where(char.IsDigit).ToArray());
                    if (digits.Length == 14 && digits.Substring(3, 3) == schemeStr)
                    {
                        if (int.TryParse(digits.Substring(6, 7), out int sVal) && sVal > maxSeq)
                        {
                            maxSeq = sVal;
                        }
                    }
                }

                if (seqRow.LastSequenceNumber != maxSeq)
                {
                    seqRow.LastSequenceNumber = maxSeq;
                    seqRow.UpdatedOn = DateTime.UtcNow;
                    _context.Entry(seqRow).State = EntityState.Modified;
                }
            }
            await _context.SaveChangesAsync();
        }

        private async Task SyncBranchRdSequenceAsync(int branchId)
        {
            if (branchId <= 0) return;

            var seqRows = await _context.RdAccountSequences
                .Where(s => s.BranchID == branchId)
                .ToListAsync();
            if (!seqRows.Any()) return;

            var accounts = await _context.RdAccounts
                .Where(a => a.BranchID == branchId && a.AccountNo != null)
                .Select(a => a.AccountNo!)
                .ToListAsync();

            int overallMax = 0;
            foreach (var accNo in accounts)
            {
                string digits = new string(accNo.Where(char.IsDigit).ToArray());
                if (digits.Length == 14 && int.TryParse(digits.Substring(6, 7), out int sVal) && sVal > overallMax)
                {
                    overallMax = sVal;
                }
            }

            foreach (var seqRow in seqRows)
            {
                int schemeMax = 0;
                string schemeStr = seqRow.SchemeCodeNumeric.ToString("D3", CultureInfo.InvariantCulture);
                foreach (var accNo in accounts)
                {
                    string digits = new string(accNo.Where(char.IsDigit).ToArray());
                    if (digits.Length == 14 && digits.Substring(3, 3) == schemeStr)
                    {
                        if (int.TryParse(digits.Substring(6, 7), out int sVal) && sVal > schemeMax)
                        {
                            schemeMax = sVal;
                        }
                    }
                }

                int targetVal = schemeMax > 0 ? schemeMax : overallMax;
                seqRow.LastSequenceNumber = targetVal;
                seqRow.CurrentValue = targetVal;
                seqRow.UpdatedOn = DateTime.UtcNow;
                _context.Entry(seqRow).State = EntityState.Modified;
            }
            await _context.SaveChangesAsync();
        }

        private async Task SyncBranchPigmySequenceAsync(int branchId)
        {
            if (branchId <= 0) return;

            var seqRows = await _context.PigmyAccountSequences
                .Where(s => s.BranchID == branchId)
                .ToListAsync();
            if (!seqRows.Any()) return;

            var accounts = await _context.PigmyAccounts
                .Where(a => a.BranchID == branchId && a.AccountNo != null)
                .Select(a => a.AccountNo!)
                .ToListAsync();

            foreach (var seqRow in seqRows)
            {
                int maxSeq = 0;
                string schemeStr = seqRow.SchemeCodeNumeric.ToString("D3", CultureInfo.InvariantCulture);
                foreach (var accNo in accounts)
                {
                    string digits = new string(accNo.Where(char.IsDigit).ToArray());
                    if (digits.Length == 14 && digits.Substring(3, 3) == schemeStr)
                    {
                        if (int.TryParse(digits.Substring(6, 7), out int sVal) && sVal > maxSeq)
                        {
                            maxSeq = sVal;
                        }
                    }
                }

                if (seqRow.LastSequenceNumber != maxSeq)
                {
                    seqRow.LastSequenceNumber = maxSeq;
                    seqRow.UpdatedOn = DateTime.UtcNow;
                    _context.Entry(seqRow).State = EntityState.Modified;
                }
            }
            await _context.SaveChangesAsync();
        }

        private async Task SyncBranchInvestmentSequenceAsync(int branchId)
        {
            if (branchId <= 0) return;

            var seqRow = await _context.InvestmentAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "INV");
            if (seqRow == null) return;

            var invNos = await _context.InvestmentAccounts
                .Where(i => i.BranchID == branchId && i.InvestmentNo != null)
                .Select(i => i.InvestmentNo!)
                .ToListAsync();

            int maxSeq = 0;
            foreach (var invNo in invNos)
            {
                string digits = new string(invNo.Where(char.IsDigit).ToArray());
                if (digits.Length == 14)
                {
                    if (int.TryParse(digits.Substring(6, 7), out int sVal) && sVal > maxSeq)
                    {
                        maxSeq = sVal;
                    }
                }
                else
                {
                    int lastDash = invNo.LastIndexOf('-');
                    if (lastDash >= 0 && lastDash < invNo.Length - 1 &&
                        int.TryParse(invNo.Substring(lastDash + 1), out int legacyVal) &&
                        legacyVal > maxSeq)
                    {
                        maxSeq = legacyVal;
                    }
                }
            }

            if (seqRow.CurrentValue != maxSeq)
            {
                seqRow.CurrentValue = maxSeq;
                _context.Entry(seqRow).State = EntityState.Modified;
                await _context.SaveChangesAsync();
            }
        }
    }
}

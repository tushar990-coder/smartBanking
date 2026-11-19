using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public class FdRenewalRollbackResult
    {
        public bool WasRenewal { get; set; }
        public string? OldAccountNo { get; set; }
        public string? NewAccountNo { get; set; }
        public int? OldFdAccountId { get; set; }
        public int? NewFdAccountId { get; set; }
        public List<string> DeletedVoucherNos { get; set; } = new();
    }

    /// <summary>
    /// Strict relational (Zero-Fallback) rollback and self-healing helper for Manual & Auto FD Renewals.
    /// All account, voucher, saving-transfer, and sibling linkages are resolved strictly via
    /// database foreign keys (FdTransactions, FdAutoRenewalLogs, FdAccount.ParentFdAccountID,
    /// Vouchers.RelatedVoucherID, and exact VoucherNo). Incomplete chains fail explicitly.
    /// </summary>
    public static class FdRenewalRollbackHelper
    {
        private static readonly string[] RenewalVoucherPrefixes =
        {
            "JV-FD-AUTOREN-",
            "JV-FD-REN-",
            "PAY-FD-INT-",
            "JV-FD-INT-"
        };

        private static DateTime _lastFullHealUtc = DateTime.MinValue;
        public static void InvalidateHealCooldown() { _lastFullHealUtc = DateTime.MinValue; }

        public static bool IsRenewalVoucherNo(string? voucherNo)
        {
            if (string.IsNullOrWhiteSpace(voucherNo)) return false;
            string vNo = voucherNo.Trim();
            return RenewalVoucherPrefixes.Any(p => vNo.StartsWith(p, StringComparison.OrdinalIgnoreCase));
        }

        private static readonly string[] OpeningMigrationVoucherPrefixes =
        {
            "JV-FD-OP-",
            "REC-FD-OP-",
            "JV-RD-OP-",
            "REC-RD-OP-",
            "JV-SH-OP-",
            "JV-INV-OP-"
        };

        public static bool IsFdRenewalVoucher(Voucher? voucher)
        {
            return voucher != null && IsRenewalVoucherNo(voucher.VoucherNo);
        }

        public static bool IsOpeningOrMigrationVoucher(Voucher? voucher)
        {
            if (voucher == null) return false;
            if (string.Equals(voucher.VoucherType, "Opening", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (string.IsNullOrWhiteSpace(voucher.VoucherNo)) return false;
            string vNo = voucher.VoucherNo.Trim();
            return OpeningMigrationVoucherPrefixes.Any(p => vNo.StartsWith(p, StringComparison.OrdinalIgnoreCase));
        }

        public static List<string> BuildAccountNumberVariants(string? rawAccNo)
        {
            var variants = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(rawAccNo)) return variants.ToList();

            string trimmed = rawAccNo.Trim();
            variants.Add(trimmed);

            string digitsOnly = new string(trimmed.Where(char.IsDigit).ToArray());
            if (digitsOnly.Length == 14)
            {
                variants.Add(digitsOnly);
                variants.Add(AccountNumberHelper.Format14Digit(digitsOnly));
            }

            return variants.ToList();
        }

        public static async Task<FdAccount?> FindFdAccountByAnyNumberAsync(AppDbContext context, string? rawAccNo)
        {
            var variants = BuildAccountNumberVariants(rawAccNo);
            if (!variants.Any()) return null;

            return await context.FdAccounts
                .FirstOrDefaultAsync(f => f.AccountNo != null && variants.Contains(f.AccountNo));
        }

        public static string ExtractAccountSuffixFromRenewalVoucherNo(string? voucherNo)
        {
            if (string.IsNullOrWhiteSpace(voucherNo)) return "";
            string vNo = voucherNo.Trim();
            foreach (var p in RenewalVoucherPrefixes)
            {
                if (vNo.StartsWith(p, StringComparison.OrdinalIgnoreCase))
                {
                    return vNo.Substring(p.Length).Trim();
                }
            }
            return "";
        }

        public static void RestoreOldAccountFromRenewal(FdAccount oldAccount, DateTime? referenceDate = null)
        {
            DateTime refDt = (referenceDate ?? DateTime.Today).Date;
            oldAccount.Status = (oldAccount.MaturityDate.Date <= refDt) ? "Matured" : "Active";
            oldAccount.ModifiedDate = DateTime.Now;

            if (!string.IsNullOrEmpty(oldAccount.Remarks))
            {
                string cleaned = Regex.Replace(
                    oldAccount.Remarks,
                    @"\s*\|\s*(?:नूतनीकरण दिनांक|स्वयंचलित नूतनीकरण|नूतनीकरण\s*->):?[^|]*",
                    "").Trim();
                oldAccount.Remarks = cleaned;
            }
        }

        public static async Task SyncBranchFdSequenceAsync(AppDbContext context, int branchId)
        {
            if (branchId <= 0) return;

            var remainingAccounts = await context.FdAccounts
                .Where(f => f.BranchID == branchId && f.AccountNo != null)
                .Select(f => f.AccountNo!)
                .ToListAsync();

            int remainingMaxSeq = 0;
            foreach (var accStr in remainingAccounts)
            {
                string digitsOnly = new string(accStr.Where(char.IsDigit).ToArray());
                if (digitsOnly.Length == 14)
                {
                    string seqPart = digitsOnly.Substring(6, 7);
                    if (int.TryParse(seqPart, out int sVal) && sVal > remainingMaxSeq)
                    {
                        remainingMaxSeq = sVal;
                    }
                }
                else if (accStr.Contains("-FD-", StringComparison.OrdinalIgnoreCase))
                {
                    int lastDash = accStr.LastIndexOf('-');
                    if (lastDash >= 0 && lastDash < accStr.Length - 1)
                    {
                        if (int.TryParse(accStr.Substring(lastDash + 1), out int parsedSeq) && parsedSeq > remainingMaxSeq)
                        {
                            remainingMaxSeq = parsedSeq;
                        }
                    }
                }
            }

            var branchSeq = await context.FdAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.ProductType == "FD");

            if (branchSeq != null && branchSeq.CurrentValue != remainingMaxSeq)
            {
                branchSeq.CurrentValue = remainingMaxSeq;
                await context.SaveChangesAsync();
            }
        }

        /// <summary>
        /// Zero-fallback strict uniqueness check for renewal vouchers.
        /// Fails fast with InvalidOperationException if the voucher number already exists.
        /// </summary>
        public static async Task<string> BuildCollisionSafeVoucherNoAsync(AppDbContext context, string desiredVoucherNo)
        {
            bool exists = await context.Vouchers.AnyAsync(v => v.VoucherNo == desiredVoucherNo);
            if (exists)
            {
                throw new InvalidOperationException(
                    $"नूतनीकरण व्हाउचर क्र. '{desiredVoucherNo}' आधीच अस्तित्वात आहे. डुप्लिकेट नूतनीकरण व्हाउचर तयार करता येत नाही.");
            }

            return desiredVoucherNo;
        }

        private static async Task ReverseSavingInterestTransfersAsync(
            AppDbContext context,
            IEnumerable<string> exactVoucherNos)
        {
            var vNoSet = exactVoucherNos
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => v.Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (!vNoSet.Any()) return;

            var matchedSbTxs = await context.SavingTransactions
                .Where(st => st.VoucherNo != null && vNoSet.Contains(st.VoucherNo))
                .ToListAsync();

            foreach (var sbTx in matchedSbTxs)
            {
                var sbAcc = await context.SavingAccountMasters.FindAsync(sbTx.SavingAccountID);
                if (sbAcc != null)
                {
                    sbAcc.CurrentBalance -= sbTx.Amount;
                }
                var sbPassbooks = await context.SavingPassbooks
                    .Where(p => p.TransactionID == sbTx.TransactionID)
                    .ToListAsync();
                if (sbPassbooks.Any()) context.SavingPassbooks.RemoveRange(sbPassbooks);
                context.SavingTransactions.Remove(sbTx);
            }
        }

        private static async Task<(FdAccount? OldAccount, FdAccount? NewAccount, List<Voucher> SiblingVouchers)> ResolveRenewalLinkageAsync(
            AppDbContext context,
            Voucher primaryVoucher)
        {
            var primaryTxs = await context.FdTransactions
                .Include(t => t.FdAccount)
                .Where(t => t.VoucherID == primaryVoucher.VoucherID)
                .ToListAsync();

            FdAccount? oldAccount = primaryTxs
                .FirstOrDefault(t => t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout")
                ?.FdAccount;

            FdAccount? newAccount = primaryTxs
                .FirstOrDefault(t => t.TransactionType == "Opening")
                ?.FdAccount;

            var autoLog = await context.FdAutoRenewalLogs
                .FirstOrDefaultAsync(l => l.VoucherID == primaryVoucher.VoucherID);

            if (oldAccount == null && autoLog != null && autoLog.OldFdAccountID > 0)
            {
                oldAccount = await context.FdAccounts.FindAsync(autoLog.OldFdAccountID);
            }

            if (newAccount == null && autoLog?.NewFdAccountID != null && autoLog.NewFdAccountID.Value > 0)
            {
                newAccount = await context.FdAccounts.FindAsync(autoLog.NewFdAccountID.Value);
            }

            // Follow ParentFdAccountID FK strictly when newAccount is known
            if (newAccount != null && oldAccount == null && newAccount.ParentFdAccountID.HasValue && newAccount.ParentFdAccountID.Value > 0)
            {
                oldAccount = await context.FdAccounts.FindAsync(newAccount.ParentFdAccountID.Value);
            }

            // Discover sibling vouchers via RelatedVoucherID FK first
            var candidateSiblingIds = new HashSet<int>();
            if (primaryVoucher.RelatedVoucherID.HasValue && primaryVoucher.RelatedVoucherID.Value > 0 &&
                primaryVoucher.RelatedVoucherID.Value != primaryVoucher.VoucherID)
            {
                candidateSiblingIds.Add(primaryVoucher.RelatedVoucherID.Value);
            }

            var reverseRelatedIds = await context.Vouchers
                .Where(v => v.RelatedVoucherID == primaryVoucher.VoucherID && v.VoucherID != primaryVoucher.VoucherID)
                .Select(v => v.VoucherID)
                .ToListAsync();
            foreach (int rid in reverseRelatedIds) candidateSiblingIds.Add(rid);

            // If started from PAY-FD-INT / JV-FD-INT (only oldAccount known), find paired Opening voucher via FK
            if (oldAccount != null && newAccount == null && candidateSiblingIds.Any())
            {
                var relOpeningTx = await context.FdTransactions
                    .Include(t => t.FdAccount)
                    .FirstOrDefaultAsync(t => candidateSiblingIds.Contains(t.VoucherID) && t.TransactionType == "Opening");
                newAccount = relOpeningTx?.FdAccount;
            }

            if (oldAccount != null && newAccount == null)
            {
                var linkedChild = await context.FdAccounts
                    .FirstOrDefaultAsync(c => c.ParentFdAccountID == oldAccount.FdAccountID &&
                                              context.FdTransactions.Any(ot =>
                                                  ot.FdAccountID == c.FdAccountID &&
                                                  ot.TransactionType == "Opening" &&
                                                  ot.TransactionDate.Date == primaryVoucher.VoucherDate.Date));
                if (linkedChild != null)
                {
                    newAccount = linkedChild;
                }
            }

            var pairedOldIdSet = new HashSet<int>();
            if (newAccount != null)
            {
                var newAccTxVoucherIds = await context.FdTransactions
                    .Where(t => t.FdAccountID == newAccount.FdAccountID &&
                                t.TransactionType == "Opening" &&
                                t.VoucherID > 0 &&
                                t.VoucherID != primaryVoucher.VoucherID)
                    .Select(t => t.VoucherID)
                    .Distinct()
                    .ToListAsync();
                foreach (int vid in newAccTxVoucherIds) candidateSiblingIds.Add(vid);

                if (oldAccount != null)
                {
                    var pairedOldIntVoucherIds = await context.FdTransactions
                        .Where(t => t.FdAccountID == oldAccount.FdAccountID &&
                                    (t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout") &&
                                    t.TransactionDate.Date == newAccount.OpeningDate.Date &&
                                    t.VoucherID > 0 &&
                                    t.VoucherID != primaryVoucher.VoucherID)
                        .Select(t => t.VoucherID)
                        .Distinct()
                        .ToListAsync();
                    foreach (int vid in pairedOldIntVoucherIds)
                    {
                        candidateSiblingIds.Add(vid);
                        pairedOldIdSet.Add(vid);
                    }
                }
            }

            var siblingVouchers = new List<Voucher>();
            if (candidateSiblingIds.Any())
            {
                var fetchedSiblings = await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => candidateSiblingIds.Contains(v.VoucherID))
                    .ToListAsync();

                var newAccVariants = newAccount != null
                    ? BuildAccountNumberVariants(newAccount.AccountNo).ToHashSet(StringComparer.OrdinalIgnoreCase)
                    : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                siblingVouchers.AddRange(fetchedSiblings.Where(sv =>
                {
                    // Strictly exclude parent opening/migration & non-renewal vouchers (Zero-Fallback)
                    if (!IsFdRenewalVoucher(sv) || IsOpeningOrMigrationVoucher(sv))
                    {
                        return false;
                    }

                    bool isDirectRelated =
                        (primaryVoucher.RelatedVoucherID.HasValue && primaryVoucher.RelatedVoucherID.Value == sv.VoucherID) ||
                        sv.RelatedVoucherID == primaryVoucher.VoucherID;

                    if (!isDirectRelated && pairedOldIdSet.Contains(sv.VoucherID) && newAccVariants.Any())
                    {
                        string suffix = ExtractAccountSuffixFromRenewalVoucherNo(sv.VoucherNo);
                        if (!string.IsNullOrEmpty(suffix) && !newAccVariants.Contains(suffix))
                        {
                            return false;
                        }
                    }

                    return true;
                }));
            }

            return (oldAccount, newAccount, siblingVouchers);
        }

        private static async Task ValidateRenewalRollbackGuardsAsync(
            AppDbContext context,
            FdAccount oldAccount,
            FdAccount newAccount,
            List<Voucher> siblingVouchers,
            HashSet<int> allRenewalVoucherIds)
        {
            var approvedSibling = siblingVouchers.FirstOrDefault(sv =>
                string.Equals(sv.Status, "Approved", StringComparison.OrdinalIgnoreCase));
            if (approvedSibling != null)
            {
                throw new InvalidOperationException(
                    $"संलग्न रिन्यूअल/व्याज व्हाउचर ({approvedSibling.VoucherNo}) आधीच मंजूर (Approved) आहे. डिलीट करण्यापूर्वी प्रथम व्हाउचर अन-पास (Unpass) करा.");
            }

            string newAccNo = newAccount.AccountNo ?? string.Empty;
            bool pledgedInLoanSecurity = !string.IsNullOrEmpty(newAccNo) && await context.LoanAccounts
                .AnyAsync(l => l.Status == "Active" && l.SecurityDetails != null && l.SecurityDetails.Contains(newAccNo));
            bool pledgedInCollaterals = await context.LoanDepositCollaterals
                .AnyAsync(c => c.CollateralType == "FixedDeposit" && c.DepositAccountID == newAccount.FdAccountID && c.LienStatus != "Released");

            bool isInheritedFromParent = oldAccount.IsLienMarked &&
                (string.IsNullOrWhiteSpace(newAccount.LienLoanAccountNo) ||
                 string.IsNullOrWhiteSpace(oldAccount.LienLoanAccountNo) ||
                 string.Equals(newAccount.LienLoanAccountNo, oldAccount.LienLoanAccountNo, StringComparison.OrdinalIgnoreCase));

            if ((newAccount.IsLienMarked || pledgedInLoanSecurity || pledgedInCollaterals) && !isInheritedFromParent)
            {
                throw new InvalidOperationException(
                    $"नवीन मुदत ठेव खाते क्र. {newAccount.AccountNo} वर कर्जाचा तारण बोजा (Lien/Collateral) असल्यामुळे रिन्यूअल व्हाउचर डिलीट करता येत नाही.");
            }

            bool hasChildCycle = await context.FdAccounts.AnyAsync(c => c.ParentFdAccountID == newAccount.FdAccountID) ||
                                 await context.FdAutoRenewalLogs.AnyAsync(l => l.OldFdAccountID == newAccount.FdAccountID && !l.IsReverted);

            if (hasChildCycle ||
                string.Equals(newAccount.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(newAccount.Status, "Renewed", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"नवीन मुदत ठेव खाते क्र. {newAccount.AccountNo} पुढे बंद किंवा पुन्हा नूतनीकरण (Next Cycle) झालेले असल्यामुळे या सायकलचे रिन्यूअल व्हाउचर डिलीट करता येत नाही.");
            }

            bool hasSubsequentFdTx = await context.FdTransactions
                .AnyAsync(t => t.FdAccountID == newAccount.FdAccountID &&
                               t.TransactionType != "Opening" &&
                               !allRenewalVoucherIds.Contains(t.VoucherID));
            bool hasMisPayout = await context.FdMisPayouts
                .AnyAsync(m => m.FdAccountID == newAccount.FdAccountID && (!m.VoucherID.HasValue || !allRenewalVoucherIds.Contains(m.VoucherID.Value)));
            bool hasInterestAccrual = await context.FdInterestAccruals
                .AnyAsync(a => a.FdAccountID == newAccount.FdAccountID && !allRenewalVoucherIds.Contains(a.VoucherID));

            if (hasSubsequentFdTx || hasMisPayout || hasInterestAccrual)
            {
                throw new InvalidOperationException(
                    $"नवीन मुदत ठेव खाते क्र. {newAccount.AccountNo} वर पुढील व्याज जमा (Accrual), MIS किंवा इतर व्यवहार झालेले असल्यामुळे रिन्यूअल व्हाउचर डिलीट करता येत नाही.");
            }
        }

        private static async Task RestoreInheritedLienToOldAccountAsync(
            AppDbContext context,
            FdAccount oldAccount,
            FdAccount newAccount)
        {
            if (!oldAccount.IsLienMarked) return;

            var childCollaterals = await context.LoanDepositCollaterals
                .Where(c => c.CollateralType == "FixedDeposit" && c.DepositAccountID == newAccount.FdAccountID)
                .ToListAsync();

            foreach (var col in childCollaterals)
            {
                col.DepositAccountID = oldAccount.FdAccountID;
                col.DepositAccountNo = oldAccount.AccountNo ?? string.Empty;
                col.DepositAmount = oldAccount.DepositAmount;
                col.CurrentDepositBalance = oldAccount.DepositAmount;
                col.MaturityDate = oldAccount.MaturityDate;
                if (!string.IsNullOrEmpty(col.Remarks))
                {
                    col.Remarks = Regex.Replace(
                        col.Remarks,
                        @"(?:\s*\|\s*)?FD नूतनीकरण तारण वर्ग:[^|]*",
                        "").Trim();
                }
            }

            string newAccNo = newAccount.AccountNo ?? string.Empty;
            string oldAccNo = oldAccount.AccountNo ?? string.Empty;
            if (!string.IsNullOrEmpty(newAccNo) && !string.IsNullOrEmpty(oldAccNo))
            {
                var secLoans = await context.LoanAccounts
                    .Where(l => l.SecurityDetails != null && l.SecurityDetails.Contains(newAccNo))
                    .ToListAsync();

                foreach (var ln in secLoans)
                {
                    ln.SecurityDetails = ln.SecurityDetails!.Replace(newAccNo, oldAccNo);
                }
            }
        }

        private static async Task UnlinkAndRemoveVouchersAsync(
            AppDbContext context,
            IEnumerable<Voucher> vouchersToRemove,
            List<string> deletedVoucherNos)
        {
            var removalList = vouchersToRemove
                .GroupBy(v => v.VoucherID)
                .Select(g => g.First())
                .ToList();

            if (!removalList.Any()) return;

            var removalIds = removalList.Select(v => v.VoucherID).ToHashSet();
            var relRefs = await context.Vouchers
                .Where(v => removalIds.Contains(v.VoucherID) ||
                            (v.RelatedVoucherID.HasValue && removalIds.Contains(v.RelatedVoucherID.Value)))
                .ToListAsync();

            bool relModified = false;
            foreach (var rv in relRefs)
            {
                if (rv.RelatedVoucherID.HasValue)
                {
                    rv.RelatedVoucherID = null;
                    relModified = true;
                }
            }
            if (relModified) await context.SaveChangesAsync();

            foreach (var v in removalList)
            {
                if (v.VoucherDetails == null)
                {
                    await context.Entry(v).Collection(x => x.VoucherDetails).LoadAsync();
                }
                if (v.VoucherDetails != null && v.VoucherDetails.Any())
                {
                    context.VoucherDetails.RemoveRange(v.VoucherDetails);
                }
                context.Vouchers.Remove(v);
                if (!string.IsNullOrEmpty(v.VoucherNo)) deletedVoucherNos.Add(v.VoucherNo);
            }
        }

        /// <summary>
        /// Atomically rolls back a Manual or Auto FD Renewal strictly using relational Foreign Keys.
        /// Validates all downstream & approval guards, deletes the newly created child FD account,
        /// cleans sibling renewal vouchers, FdTransactions, FdAutoRenewalLogs & exact-VoucherNo SavingTransactions,
        /// restores the original FD account to Matured/Active as of VoucherDate, and resyncs FdAccountSequences.
        /// </summary>
        public static async Task<FdRenewalRollbackResult> RollbackRenewalByVoucherAsync(
            AppDbContext context,
            Voucher primaryVoucher,
            bool deletePrimaryVoucherRecord)
        {
            var result = new FdRenewalRollbackResult { WasRenewal = true };

            var (oldAccount, newAccount, siblingVouchers) = await ResolveRenewalLinkageAsync(context, primaryVoucher);

            if (oldAccount == null || newAccount == null)
            {
                throw new InvalidOperationException(
                    $"रिन्यूअल व्हाउचर ({primaryVoucher.VoucherNo}) साठी मूळ व नवीन मुदत ठेव खात्याचा संपूर्ण डेटाबेस दुवा (FdTransactions / FdAutoRenewalLogs / ParentFdAccountID) सापडला नाही. अपूर्ण साखळीवर रोलबॅक करता येत नाही.");
            }

            var allRenewalVoucherIds = new HashSet<int> { primaryVoucher.VoucherID };
            foreach (var sv in siblingVouchers) allRenewalVoucherIds.Add(sv.VoucherID);

            var allRenewalVoucherNos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(primaryVoucher.VoucherNo)) allRenewalVoucherNos.Add(primaryVoucher.VoucherNo);
            foreach (var sv in siblingVouchers)
            {
                if (!string.IsNullOrWhiteSpace(sv.VoucherNo)) allRenewalVoucherNos.Add(sv.VoucherNo);
            }

            await ValidateRenewalRollbackGuardsAsync(context, oldAccount, newAccount, siblingVouchers, allRenewalVoucherIds);

            // Reverse any SavingAccount interest payout transfer strictly by exact VoucherNo
            await ReverseSavingInterestTransfersAsync(context, allRenewalVoucherNos);

            // Restore any inherited loan lien / deposit collateral back onto oldAccount before removing newAccount
            await RestoreInheritedLienToOldAccountAsync(context, oldAccount, newAccount);

            // Remove FdTransactions, FdInterestAccruals, FdMisPayouts strictly scoped to this renewal cycle
            var txsToRemove = await context.FdTransactions
                .Where(t => t.FdAccountID == newAccount.FdAccountID ||
                            (t.FdAccountID == oldAccount.FdAccountID && allRenewalVoucherIds.Contains(t.VoucherID)))
                .ToListAsync();
            if (txsToRemove.Any())
            {
                context.FdTransactions.RemoveRange(txsToRemove);
                await context.SaveChangesAsync();
            }

            var cycleAccruals = await context.FdInterestAccruals
                .Where(a => a.FdAccountID == newAccount.FdAccountID && allRenewalVoucherIds.Contains(a.VoucherID))
                .ToListAsync();
            if (cycleAccruals.Any())
            {
                context.FdInterestAccruals.RemoveRange(cycleAccruals);
                await context.SaveChangesAsync();
            }

            var cycleMis = await context.FdMisPayouts
                .Where(m => m.FdAccountID == newAccount.FdAccountID && m.VoucherID.HasValue && allRenewalVoucherIds.Contains(m.VoucherID.Value))
                .ToListAsync();
            if (cycleMis.Any())
            {
                context.FdMisPayouts.RemoveRange(cycleMis);
                await context.SaveChangesAsync();
            }

            // Remove FdAutoRenewalLogs linked by VoucherID or NewFdAccountID & decrement AutoRenewalCount
            var autoRenLogs = await context.FdAutoRenewalLogs
                .Where(l => (l.VoucherID.HasValue && allRenewalVoucherIds.Contains(l.VoucherID.Value)) ||
                            l.NewFdAccountID == newAccount.FdAccountID)
                .ToListAsync();
            if (autoRenLogs.Any())
            {
                oldAccount.AutoRenewalCount = Math.Max(0, oldAccount.AutoRenewalCount - autoRenLogs.Count(l => l.OldFdAccountID == oldAccount.FdAccountID && !l.IsReverted));
                context.FdAutoRenewalLogs.RemoveRange(autoRenLogs);
                await context.SaveChangesAsync();
            }

            // Unlink RelatedVoucherID and delete sibling (and optionally primary) vouchers
            var vouchersToRemove = new List<Voucher>(siblingVouchers);
            if (deletePrimaryVoucherRecord) vouchersToRemove.Add(primaryVoucher);
            await UnlinkAndRemoveVouchersAsync(context, vouchersToRemove, result.DeletedVoucherNos);

            // Remove newly created child FD account and restore original FD account using VoucherDate
            int branchIdToSync = newAccount.BranchID > 0 ? newAccount.BranchID : (oldAccount.BranchID > 0 ? oldAccount.BranchID : primaryVoucher.BranchID);
            result.NewAccountNo = newAccount.AccountNo;
            result.NewFdAccountId = newAccount.FdAccountID;
            context.FdAccounts.Remove(newAccount);

            result.OldAccountNo = oldAccount.AccountNo;
            result.OldFdAccountId = oldAccount.FdAccountID;
            RestoreOldAccountFromRenewal(oldAccount, primaryVoucher.VoucherDate);

            await context.SaveChangesAsync();

            if (branchIdToSync > 0)
            {
                await SyncBranchFdSequenceAsync(context, branchIdToSync);
            }

            InvalidateHealCooldown();
            return result;
        }

        /// <summary>
        /// When a child FD account created via Manual or Auto Renewal is deleted via DeleteFdAccount,
        /// rolls back the parent renewal strictly via FKs (deletes JV-FD-AUTOREN-* / JV-FD-REN-* /
        /// PAY-FD-INT-* / JV-FD-INT-* vouchers, FdAutoRenewalLogs, FdTransactions, and exact-VoucherNo
        /// SavingTransactions, and restores the parent FD account to Matured/Active).
        /// </summary>
        public static async Task<FdRenewalRollbackResult> RollbackParentRenewalOnChildAccountDeleteAsync(
            AppDbContext context,
            FdAccount childNewAccount)
        {
            var result = new FdRenewalRollbackResult();

            var childTxs = await context.FdTransactions
                .Where(t => t.FdAccountID == childNewAccount.FdAccountID && t.VoucherID > 0)
                .ToListAsync();

            var childVoucherIds = childTxs.Select(t => t.VoucherID).Distinct().ToHashSet();

            var autoRenLogs = await context.FdAutoRenewalLogs
                .Where(l => l.NewFdAccountID == childNewAccount.FdAccountID ||
                            (l.VoucherID.HasValue && childVoucherIds.Contains(l.VoucherID.Value)))
                .ToListAsync();

            foreach (var log in autoRenLogs)
            {
                if (log.VoucherID.HasValue && log.VoucherID.Value > 0) childVoucherIds.Add(log.VoucherID.Value);
            }

            var parentRenewalTxs = childVoucherIds.Any()
                ? await context.FdTransactions
                    .Include(t => t.FdAccount)
                    .Where(t => t.FdAccountID != childNewAccount.FdAccountID &&
                                childVoucherIds.Contains(t.VoucherID) &&
                                (t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout"))
                    .ToListAsync()
                : new List<FdTransaction>();

            var renewalVouchers = childVoucherIds.Any()
                ? await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => childVoucherIds.Contains(v.VoucherID) && v.VoucherNo != null &&
                                (v.VoucherNo.StartsWith("JV-FD-AUTOREN-") ||
                                 v.VoucherNo.StartsWith("JV-FD-REN-") ||
                                 v.VoucherNo.StartsWith("PAY-FD-INT-") ||
                                 v.VoucherNo.StartsWith("JV-FD-INT-")))
                    .ToListAsync()
                : new List<Voucher>();

            bool isRenewalChild = childNewAccount.ParentFdAccountID.HasValue ||
                                  autoRenLogs.Any() ||
                                  parentRenewalTxs.Any() ||
                                  renewalVouchers.Any();

            if (!isRenewalChild)
            {
                result.WasRenewal = false;
                InvalidateHealCooldown();
                return result;
            }

            result.WasRenewal = true;
            result.NewAccountNo = childNewAccount.AccountNo;
            result.NewFdAccountId = childNewAccount.FdAccountID;

            FdAccount? oldAccount = parentRenewalTxs.FirstOrDefault()?.FdAccount;
            if (oldAccount == null && autoRenLogs.Any(l => l.OldFdAccountID > 0))
            {
                int oldId = autoRenLogs.First(l => l.OldFdAccountID > 0).OldFdAccountID;
                oldAccount = await context.FdAccounts.FindAsync(oldId);
            }
            if (oldAccount == null && childNewAccount.ParentFdAccountID.HasValue && childNewAccount.ParentFdAccountID.Value > 0)
            {
                oldAccount = await context.FdAccounts.FindAsync(childNewAccount.ParentFdAccountID.Value);
            }

            var allVoucherIds = renewalVouchers.Select(v => v.VoucherID).ToHashSet();
            foreach (int vid in childVoucherIds) allVoucherIds.Add(vid);

            // Include RelatedVoucherID siblings and parent's paired Interest Payout vouchers via FK
            if (allVoucherIds.Any())
            {
                var relatedIds = await context.Vouchers
                    .Where(v => (allVoucherIds.Contains(v.VoucherID) && v.RelatedVoucherID.HasValue) ||
                                (v.RelatedVoucherID.HasValue && allVoucherIds.Contains(v.RelatedVoucherID.Value)))
                    .Select(v => new { v.VoucherID, v.RelatedVoucherID })
                    .ToListAsync();

                foreach (var rel in relatedIds)
                {
                    allVoucherIds.Add(rel.VoucherID);
                    if (rel.RelatedVoucherID.HasValue && rel.RelatedVoucherID.Value > 0) allVoucherIds.Add(rel.RelatedVoucherID.Value);
                }
            }

            if (oldAccount != null)
            {
                var pairedOldVIds = await context.FdTransactions
                    .Where(t => t.FdAccountID == oldAccount.FdAccountID &&
                                (t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout") &&
                                t.TransactionDate.Date == childNewAccount.OpeningDate.Date &&
                                t.VoucherID > 0)
                    .Select(t => t.VoucherID)
                    .Distinct()
                    .ToListAsync();
                foreach (int vid in pairedOldVIds) allVoucherIds.Add(vid);
            }

            renewalVouchers = allVoucherIds.Any()
                ? (await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => allVoucherIds.Contains(v.VoucherID))
                    .ToListAsync())
                    .Where(v => IsFdRenewalVoucher(v) && !IsOpeningOrMigrationVoucher(v))
                    .ToList()
                : new List<Voucher>();

            var approvedVoucher = renewalVouchers.FirstOrDefault(v =>
                string.Equals(v.Status, "Approved", StringComparison.OrdinalIgnoreCase));
            if (approvedVoucher != null)
            {
                throw new InvalidOperationException(
                    $"संलग्न नूतनीकरण व्हाउचर ({approvedVoucher.VoucherNo}) आधीच मंजूर (Approved) आहे. खाते डिलीट करण्यापूर्वी प्रथम व्हाउचर अन-पास (Unpass) करा.");
            }

            var renewalIdsToDelete = renewalVouchers.Select(v => v.VoucherID).ToHashSet();
            var allVoucherNos = renewalVouchers
                .Select(v => v.VoucherNo ?? "")
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .ToList();

            await ReverseSavingInterestTransfersAsync(context, allVoucherNos);

            if (renewalIdsToDelete.Any())
            {
                var linkedParentTxs = await context.FdTransactions
                    .Where(t => t.FdAccountID != childNewAccount.FdAccountID && renewalIdsToDelete.Contains(t.VoucherID))
                    .ToListAsync();
                if (linkedParentTxs.Any())
                {
                    context.FdTransactions.RemoveRange(linkedParentTxs);
                    await context.SaveChangesAsync();
                }
            }

            if (autoRenLogs.Any())
            {
                if (oldAccount != null)
                {
                    oldAccount.AutoRenewalCount = Math.Max(0, oldAccount.AutoRenewalCount - autoRenLogs.Count(l => l.OldFdAccountID == oldAccount.FdAccountID && !l.IsReverted));
                }
                context.FdAutoRenewalLogs.RemoveRange(autoRenLogs);
                await context.SaveChangesAsync();
            }

            if (oldAccount != null)
            {
                await RestoreInheritedLienToOldAccountAsync(context, oldAccount, childNewAccount);
                result.OldAccountNo = oldAccount.AccountNo;
                result.OldFdAccountId = oldAccount.FdAccountID;
                RestoreOldAccountFromRenewal(oldAccount, childNewAccount.OpeningDate);
                await context.SaveChangesAsync();
            }

            if (childTxs.Any())
            {
                context.FdTransactions.RemoveRange(childTxs);
                await context.SaveChangesAsync();
            }

            var removableVouchers = new List<Voucher>();
            foreach (var rv in renewalVouchers)
            {
                bool stillReferenced = await context.FdTransactions.AnyAsync(t => t.VoucherID == rv.VoucherID);
                if (!stillReferenced) removableVouchers.Add(rv);
            }

            await UnlinkAndRemoveVouchersAsync(context, removableVouchers, result.DeletedVoucherNos);
            if (removableVouchers.Any()) await context.SaveChangesAsync();

            InvalidateHealCooldown();
            return result;
        }

        private static async Task<bool> HasExistingRenewedChildByFkAsync(AppDbContext context, int parentFdId)
        {
            if (parentFdId <= 0) return false;
            return await context.FdAccounts.AnyAsync(c => c.ParentFdAccountID == parentFdId) ||
                   await context.FdAutoRenewalLogs.AnyAsync(l => l.OldFdAccountID == parentFdId && !l.IsReverted);
        }

        /// <summary>
        /// Strict Foreign-Key-only orphan reconciliation (Zero text/regex fallback, 100% SQL-translatable).
        /// Reconciles broken FK chains for both Manual (JV-FD-REN-*) and Auto-Renewal (JV-FD-AUTOREN-*):
        /// Pass 1: Pending orphaned renewal vouchers whose child FD account no longer exists.
        /// Pass 2: Orphaned child FD accounts (ParentFdAccountID != null) whose renewal vouchers were deleted.
        /// Pass 3A/3B: Orphaned Renewal FdTransactions or stuck Renewed parent accounts with no child FD FK.
        /// </summary>
        public static async Task HealOrphanedRenewalsAsync(AppDbContext context, int? targetFdAccountId = null, bool force = false)
        {
            try
            {
                bool isScopedHeal = targetFdAccountId.HasValue && targetFdAccountId.Value > 0;
                if (!isScopedHeal)
                {
                    if (!force && (DateTime.UtcNow - _lastFullHealUtc).TotalSeconds < 60) return;
                    _lastFullHealUtc = DateTime.UtcNow;
                }
                var branchesToSync = new HashSet<int>();
                bool modified = false;

                // === PASS 1: Pending Orphaned Renewal Vouchers (Manual + Auto-Renewal) ===
                var renewalVouchersQuery = context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => v.VoucherNo != null &&
                                v.Status != "Approved" &&
                                (v.VoucherNo.StartsWith("JV-FD-AUTOREN-") ||
                                 v.VoucherNo.StartsWith("JV-FD-REN-") ||
                                 v.VoucherNo.StartsWith("PAY-FD-INT-") ||
                                 v.VoucherNo.StartsWith("JV-FD-INT-")));

                if (isScopedHeal)
                {
                    int targetId = targetFdAccountId!.Value;
                    var scopedVoucherIds = await context.FdTransactions
                        .Where(t => t.FdAccountID == targetId ||
                                    context.FdAccounts.Any(c => c.FdAccountID == t.FdAccountID && c.ParentFdAccountID == targetId))
                        .Select(t => t.VoucherID)
                        .Union(context.FdAutoRenewalLogs
                            .Where(l => l.VoucherID.HasValue && (l.OldFdAccountID == targetId || l.NewFdAccountID == targetId))
                            .Select(l => l.VoucherID!.Value))
                        .Distinct()
                        .ToListAsync();

                    var directRelIds = scopedVoucherIds.Any()
                        ? await context.Vouchers
                            .Where(v => scopedVoucherIds.Contains(v.VoucherID) && v.RelatedVoucherID.HasValue)
                            .Select(v => v.RelatedVoucherID!.Value)
                            .ToListAsync()
                        : new List<int>();
                    foreach (var rid in directRelIds) scopedVoucherIds.Add(rid);

                    if (!scopedVoucherIds.Any())
                    {
                        renewalVouchersQuery = renewalVouchersQuery.Where(_ => false);
                    }
                    else
                    {
                        var scopedSet = scopedVoucherIds.Distinct().ToList();
                        renewalVouchersQuery = renewalVouchersQuery.Where(v => scopedSet.Contains(v.VoucherID));
                    }
                }

                var renewalVouchers = await renewalVouchersQuery.ToListAsync();

                foreach (var rv in renewalVouchers)
                {
                    bool hasActiveOpeningChild = await context.FdTransactions
                        .AnyAsync(t => t.VoucherID == rv.VoucherID &&
                                       t.TransactionType == "Opening" &&
                                       context.FdAccounts.Any(f => f.FdAccountID == t.FdAccountID));
                    if (hasActiveOpeningChild) continue;

                    bool hasActiveAutoLogChild = await context.FdAutoRenewalLogs
                        .AnyAsync(l => l.VoucherID == rv.VoucherID &&
                                       l.NewFdAccountID.HasValue &&
                                       context.FdAccounts.Any(f => f.FdAccountID == l.NewFdAccountID.Value));
                    if (hasActiveAutoLogChild) continue;

                    // Decoupled PrincipalOnly interest vouchers (PAY-FD-INT-* / JV-FD-INT-*) attach their
                    // Interest Payout transaction to the parent FD while the child Opening transaction
                    // lives on the paired JV-FD-REN-* / JV-FD-AUTOREN-* voucher. Verify paired FK linkage
                    // before ever treating rv as orphaned.
                    var pairedVoucherIds = new HashSet<int>();
                    if (rv.RelatedVoucherID.HasValue && rv.RelatedVoucherID.Value > 0 && rv.RelatedVoucherID.Value != rv.VoucherID)
                    {
                        pairedVoucherIds.Add(rv.RelatedVoucherID.Value);
                    }
                    var reversePairedIds = await context.Vouchers
                        .Where(v => v.RelatedVoucherID == rv.VoucherID && v.VoucherID != rv.VoucherID)
                        .Select(v => v.VoucherID)
                        .ToListAsync();
                    foreach (var rpid in reversePairedIds) pairedVoucherIds.Add(rpid);

                    if (pairedVoucherIds.Any())
                    {
                        bool hasActivePairedOpening = await context.FdTransactions
                            .AnyAsync(t => pairedVoucherIds.Contains(t.VoucherID) &&
                                           t.TransactionType == "Opening" &&
                                           context.FdAccounts.Any(f => f.FdAccountID == t.FdAccountID));
                        bool hasActivePairedAutoLog = await context.FdAutoRenewalLogs
                            .AnyAsync(l => l.VoucherID.HasValue &&
                                           pairedVoucherIds.Contains(l.VoucherID.Value) &&
                                           l.NewFdAccountID.HasValue &&
                                           context.FdAccounts.Any(f => f.FdAccountID == l.NewFdAccountID.Value));
                        if (hasActivePairedOpening || hasActivePairedAutoLog) continue;
                    }

                    var orphanTxs = await context.FdTransactions
                        .Include(t => t.FdAccount)
                        .Where(t => t.VoucherID == rv.VoucherID)
                        .ToListAsync();

                    var txAccountIds = orphanTxs.Select(t => t.FdAccountID).Distinct().ToList();
                    if (txAccountIds.Any())
                    {
                        bool hasLiveSiblingRenewalOnParent = await context.FdTransactions
                            .AnyAsync(t => txAccountIds.Contains(t.FdAccountID) &&
                                           t.TransactionType == "Renewal" &&
                                           t.VoucherID > 0 &&
                                           t.VoucherID != rv.VoucherID &&
                                           t.TransactionDate.Date == rv.VoucherDate.Date &&
                                           context.FdTransactions.Any(ot =>
                                               ot.VoucherID == t.VoucherID &&
                                               ot.TransactionType == "Opening" &&
                                               context.FdAccounts.Any(f => f.FdAccountID == ot.FdAccountID)));

                        bool hasLiveChildAccountForDate = await context.FdAccounts
                            .AnyAsync(c => c.ParentFdAccountID.HasValue &&
                                           txAccountIds.Contains(c.ParentFdAccountID.Value) &&
                                           context.FdTransactions.Any(ot =>
                                               ot.FdAccountID == c.FdAccountID &&
                                               ot.TransactionType == "Opening" &&
                                               ot.TransactionDate.Date == rv.VoucherDate.Date));

                        if (hasLiveSiblingRenewalOnParent || hasLiveChildAccountForDate) continue;
                    }

                    var orphanLogs = await context.FdAutoRenewalLogs
                        .Where(l => l.VoucherID == rv.VoucherID)
                        .ToListAsync();

                    FdAccount? oldAcc = orphanTxs.FirstOrDefault(t => t.FdAccount != null)?.FdAccount;
                    if (oldAcc == null && orphanLogs.Any(l => l.OldFdAccountID > 0))
                    {
                        int oldId = orphanLogs.First(l => l.OldFdAccountID > 0).OldFdAccountID;
                        oldAcc = await context.FdAccounts.FindAsync(oldId);
                    }

                    if (oldAcc != null)
                    {
                        if (orphanLogs.Any())
                        {
                            oldAcc.AutoRenewalCount = Math.Max(0, oldAcc.AutoRenewalCount - orphanLogs.Count(l => l.OldFdAccountID == oldAcc.FdAccountID && !l.IsReverted));
                        }
                        bool oldAccStillHasChild = await HasExistingRenewedChildByFkAsync(context, oldAcc.FdAccountID);
                        bool oldAccStillHasRenewalTx = await context.FdTransactions
                            .AnyAsync(t => t.FdAccountID == oldAcc.FdAccountID &&
                                           t.VoucherID != rv.VoucherID &&
                                           t.TransactionType == "Renewal" &&
                                           context.Vouchers.Any(v => v.VoucherID == t.VoucherID));
                        if (!oldAccStillHasChild && !oldAccStillHasRenewalTx)
                        {
                            RestoreOldAccountFromRenewal(oldAcc, rv.VoucherDate);
                        }
                        branchesToSync.Add(oldAcc.BranchID);
                    }

                    if (rv.BranchID > 0) branchesToSync.Add(rv.BranchID);

                    if (!string.IsNullOrWhiteSpace(rv.VoucherNo))
                    {
                        await ReverseSavingInterestTransfersAsync(context, new[] { rv.VoucherNo });
                    }

                    if (orphanTxs.Any()) context.FdTransactions.RemoveRange(orphanTxs);
                    if (orphanLogs.Any()) context.FdAutoRenewalLogs.RemoveRange(orphanLogs);
                    await UnlinkAndRemoveVouchersAsync(context, new[] { rv }, new List<string>());
                    modified = true;
                }

                if (modified)
                {
                    await context.SaveChangesAsync();
                    modified = false;
                }

                // === PASS 2: Orphaned Renewed Child FD Accounts (ParentFdAccountID FK present, Voucher gone) ===
                var childQuery = context.FdAccounts.Where(f => f.ParentFdAccountID.HasValue);
                if (targetFdAccountId.HasValue && targetFdAccountId.Value > 0)
                {
                    childQuery = childQuery.Where(f => f.ParentFdAccountID == targetFdAccountId.Value || f.FdAccountID == targetFdAccountId.Value);
                }

                var renewedChildAccounts = await childQuery.ToListAsync();
                foreach (var newAcc in renewedChildAccounts)
                {
                    bool hasOpeningVoucher = await context.FdTransactions
                        .AnyAsync(t => t.FdAccountID == newAcc.FdAccountID &&
                                       t.TransactionType == "Opening" &&
                                       context.Vouchers.Any(v => v.VoucherID == t.VoucherID));

                    bool hasAutoLogVoucher = await context.FdAutoRenewalLogs
                        .AnyAsync(l => l.NewFdAccountID == newAcc.FdAccountID &&
                                       l.VoucherID.HasValue &&
                                       context.Vouchers.Any(v => v.VoucherID == l.VoucherID.Value));

                    if (hasOpeningVoucher || hasAutoLogVoucher) continue;

                    // Protect accounts with accruals, MIS payouts, lien, or child cycles
                    bool hasProtectedData = newAcc.IsLienMarked ||
                                            await context.FdInterestAccruals.AnyAsync(a => a.FdAccountID == newAcc.FdAccountID) ||
                                            await context.FdMisPayouts.AnyAsync(m => m.FdAccountID == newAcc.FdAccountID) ||
                                            await HasExistingRenewedChildByFkAsync(context, newAcc.FdAccountID);
                    if (hasProtectedData) continue;

                    var oldAcc = await context.FdAccounts.FindAsync(newAcc.ParentFdAccountID!.Value);
                    var newAutoLogs = await context.FdAutoRenewalLogs.Where(l => l.NewFdAccountID == newAcc.FdAccountID).ToListAsync();

                    if (oldAcc != null)
                    {
                        if (newAutoLogs.Any())
                        {
                            oldAcc.AutoRenewalCount = Math.Max(0, oldAcc.AutoRenewalCount - newAutoLogs.Count(l => l.OldFdAccountID == oldAcc.FdAccountID && !l.IsReverted));
                        }
                        RestoreOldAccountFromRenewal(oldAcc, newAcc.OpeningDate);
                        branchesToSync.Add(oldAcc.BranchID);

                        var oldOrphanTxs = await context.FdTransactions
                            .Where(t => t.FdAccountID == oldAcc.FdAccountID &&
                                        (t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout") &&
                                        !context.Vouchers.Any(v => v.VoucherID == t.VoucherID))
                            .ToListAsync();
                        if (oldOrphanTxs.Any()) context.FdTransactions.RemoveRange(oldOrphanTxs);
                    }

                    var newTxs = await context.FdTransactions.Where(t => t.FdAccountID == newAcc.FdAccountID).ToListAsync();
                    if (newTxs.Any()) context.FdTransactions.RemoveRange(newTxs);
                    if (newAutoLogs.Any()) context.FdAutoRenewalLogs.RemoveRange(newAutoLogs);

                    branchesToSync.Add(newAcc.BranchID);
                    context.FdAccounts.Remove(newAcc);
                    modified = true;
                }

                if (modified)
                {
                    await context.SaveChangesAsync();
                    modified = false;
                }

                // === PASS 3A: Orphaned Renewal FdTransactions on Parent Accounts (100% SQL-translatable FK check) ===
                var renewalTxQuery = context.FdTransactions
                    .Include(t => t.FdAccount)
                    .Where(t => t.TransactionType == "Renewal");

                if (targetFdAccountId.HasValue && targetFdAccountId.Value > 0)
                {
                    renewalTxQuery = renewalTxQuery.Where(t => t.FdAccountID == targetFdAccountId.Value);
                }

                var parentRenewalTxs = await renewalTxQuery.ToListAsync();
                foreach (var rTx in parentRenewalTxs)
                {
                    bool hasChildOpeningOnSameVoucher = rTx.VoucherID > 0 && await context.FdTransactions
                        .AnyAsync(t => t.VoucherID == rTx.VoucherID &&
                                       t.FdAccountID != rTx.FdAccountID &&
                                       t.TransactionType == "Opening" &&
                                       context.FdAccounts.Any(f => f.FdAccountID == t.FdAccountID));

                    if (hasChildOpeningOnSameVoucher) continue;

                    bool hasExistingRenewedChild = await HasExistingRenewedChildByFkAsync(context, rTx.FdAccountID);
                    if (!hasExistingRenewedChild)
                    {
                        if (rTx.FdAccount != null)
                        {
                            RestoreOldAccountFromRenewal(rTx.FdAccount, rTx.TransactionDate);
                            branchesToSync.Add(rTx.FdAccount.BranchID);
                        }
                        context.FdTransactions.Remove(rTx);
                        modified = true;
                    }
                }

                // === PASS 3B: Stuck Renewed Parent Accounts with zero Closure/Renewal Tx & zero Child FK (100% SQL-translatable) ===
                var stuckRenewedQuery = context.FdAccounts
                    .Where(f => f.Status == "Renewed");

                if (targetFdAccountId.HasValue && targetFdAccountId.Value > 0)
                {
                    stuckRenewedQuery = stuckRenewedQuery.Where(f => f.FdAccountID == targetFdAccountId.Value);
                }

                var stuckRenewedCandidates = await stuckRenewedQuery.ToListAsync();
                foreach (var cand in stuckRenewedCandidates)
                {
                    bool hasActiveCloseOrRenewalTx = await context.FdTransactions
                        .AnyAsync(t => t.FdAccountID == cand.FdAccountID &&
                                       (t.TransactionType == "Renewal" ||
                                        t.TransactionType == "Payout" ||
                                        t.TransactionType == "Premature_Close"));
                    if (hasActiveCloseOrRenewalTx) continue;

                    bool hasChildFd = await HasExistingRenewedChildByFkAsync(context, cand.FdAccountID);
                    if (hasChildFd) continue;

                    var branchDayEnd = await context.BranchDayEndStatuses
                        .AsNoTracking()
                        .Where(b => b.BranchID == (cand.BranchID > 0 ? cand.BranchID : 1) && b.BusinessDate.Year >= 2000)
                        .OrderByDescending(b => b.BusinessDate)
                        .FirstOrDefaultAsync();
                    DateTime branchBizDate = branchDayEnd != null
                        ? (branchDayEnd.IsDayClosed ? branchDayEnd.BusinessDate.Date.AddDays(1) : branchDayEnd.BusinessDate.Date)
                        : DateTime.Today;

                    RestoreOldAccountFromRenewal(cand, branchBizDate);
                    branchesToSync.Add(cand.BranchID);
                    modified = true;
                }

                if (modified)
                {
                    await context.SaveChangesAsync();
                }

                foreach (var bId in branchesToSync.Where(b => b > 0))
                {
                    await SyncBranchFdSequenceAsync(context, bId);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[HealOrphanedRenewalsAsync] Warning: {ex.Message}");
            }
        }
    }
}

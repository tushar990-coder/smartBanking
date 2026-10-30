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

    public static class FdRenewalRollbackHelper
    {
        public static bool IsFdRenewalVoucher(Voucher? voucher)
        {
            if (voucher == null) return false;
            string vNo = voucher.VoucherNo ?? "";
            if (vNo.StartsWith("JV-FD-REN-", StringComparison.OrdinalIgnoreCase) ||
                vNo.StartsWith("PAY-FD-INT-", StringComparison.OrdinalIgnoreCase) ||
                vNo.StartsWith("JV-FD-INT-", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            string narr = voucher.Narration ?? "";
            return narr.Contains("FD Renewal", StringComparison.OrdinalIgnoreCase) ||
                   narr.Contains("मुदत ठेव नूतनीकरण") ||
                   narr.Contains("मुदत ठेव मुद्दल नूतनीकरण");
        }

        public static List<string> BuildAccountNumberVariants(string? rawAccNo)
        {
            var variants = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(rawAccNo)) return variants.ToList();

            string trimmed = rawAccNo.Trim();
            // Strip trailing renewal collision suffixes like -R2 if passed from a voucher number
            var rSuffix = Regex.Match(trimmed, @"^(.*)-R\d+$", RegexOptions.IgnoreCase);
            if (rSuffix.Success)
            {
                trimmed = rSuffix.Groups[1].Value.Trim();
            }

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
            string[] prefixes = { "JV-FD-REN-", "PAY-FD-INT-", "JV-FD-INT-" };
            foreach (var p in prefixes)
            {
                if (vNo.StartsWith(p, StringComparison.OrdinalIgnoreCase))
                {
                    string raw = vNo.Substring(p.Length).Trim();
                    var rSuffix = Regex.Match(raw, @"^(.*)-R\d+$", RegexOptions.IgnoreCase);
                    return rSuffix.Success ? rSuffix.Groups[1].Value.Trim() : raw;
                }
            }
            return "";
        }

        public static (string OldAccNo, string NewAccNo) ExtractOldAndNewAccFromText(string? newAccRemarks, string? voucherNarration)
        {
            string oldAccNo = "";
            string newAccNo = "";

            if (!string.IsNullOrWhiteSpace(newAccRemarks))
            {
                var remMatch = Regex.Match(
                    newAccRemarks,
                    @"(?:Renewed\s*from|नूतनीकरण\s*खाते(?:\s*\(Renewed\s*from\))?):\s*([0-9A-Za-z-]+)",
                    RegexOptions.IgnoreCase);
                if (remMatch.Success)
                {
                    oldAccNo = remMatch.Groups[1].Value.Trim();
                }
            }

            if (!string.IsNullOrWhiteSpace(voucherNarration))
            {
                // Pattern 1: "मुदत ठेव नूतनीकरण (FD Renewal): 001-401-0000212-4 -> 001-401-0000213-1"
                var arrowMatch = Regex.Match(
                    voucherNarration,
                    @"([0-9A-Za-z]+(?:-[0-9A-Za-z]+)+|\d{14})\s*->\s*([0-9A-Za-z]+(?:-[0-9A-Za-z]+)+|\d{14})");
                if (arrowMatch.Success)
                {
                    if (string.IsNullOrEmpty(oldAccNo)) oldAccNo = arrowMatch.Groups[1].Value.Trim();
                    if (string.IsNullOrEmpty(newAccNo)) newAccNo = arrowMatch.Groups[2].Value.Trim();
                }

                // Pattern 2: "खा. क्र. 001-401-0000212-4 (नवीन खा. क्र. 001-401-0000213-1)"
                if (string.IsNullOrEmpty(oldAccNo) || string.IsNullOrEmpty(newAccNo))
                {
                    var intMatch = Regex.Match(
                        voucherNarration,
                        @"खा\.\s*क्र\.\s*([0-9A-Za-z-]+)\s*\(नवीन\s*खा\.\s*क्र\.\s*([0-9A-Za-z-]+)\)");
                    if (intMatch.Success)
                    {
                        if (string.IsNullOrEmpty(oldAccNo)) oldAccNo = intMatch.Groups[1].Value.Trim();
                        if (string.IsNullOrEmpty(newAccNo)) newAccNo = intMatch.Groups[2].Value.Trim();
                    }
                }
            }

            return (oldAccNo, newAccNo);
        }

        public static void RestoreOldAccountFromRenewal(FdAccount oldAccount, DateTime? referenceDate = null)
        {
            DateTime refDt = (referenceDate ?? DateTime.Today).Date;
            oldAccount.Status = (oldAccount.MaturityDate.Date <= refDt) ? "Matured" : "Active";

            if (!string.IsNullOrEmpty(oldAccount.Remarks))
            {
                // Remove any " | नूतनीकरण दिनांक: ..." segment while keeping prior remarks intact
                string cleaned = Regex.Replace(
                    oldAccount.Remarks,
                    @"\s*\|\s*नूतनीकरण दिनांक:[^|]*",
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
                    // 14-digit CBS format: BBB(3) + SSS(3) + SEQ(7) + CHK(1)
                    string seqPart = digitsOnly.Substring(6, 7);
                    if (int.TryParse(seqPart, out int sVal) && sVal > remainingMaxSeq)
                    {
                        remainingMaxSeq = sVal;
                    }
                }
                else if (accStr.Contains("-FD-", StringComparison.OrdinalIgnoreCase))
                {
                    // Legacy format: {Prefix}-{BranchID:D3}-FD-{SeqNo:D6}
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

            if (branchSeq != null)
            {
                if (branchSeq.CurrentValue != remainingMaxSeq)
                {
                    branchSeq.CurrentValue = remainingMaxSeq;
                    await context.SaveChangesAsync();
                }
            }
        }

        public static async Task<string> BuildCollisionSafeVoucherNoAsync(AppDbContext context, string desiredVoucherNo)
        {
            var existing = await context.Vouchers
                .Include(v => v.VoucherDetails)
                .FirstOrDefaultAsync(v => v.VoucherNo == desiredVoucherNo);

            if (existing == null)
            {
                return desiredVoucherNo;
            }

            // If existing voucher is a completely orphaned unapproved renewal voucher with no active renewed child FD, purge it safely
            bool isApproved = string.Equals(existing.Status, "Approved", StringComparison.OrdinalIgnoreCase);
            if (!isApproved && IsFdRenewalVoucher(existing))
            {
                bool hasOpeningFdTx = await context.FdTransactions
                    .AnyAsync(t => t.VoucherID == existing.VoucherID && t.TransactionType == "Opening");

                string suffixAcc = ExtractAccountSuffixFromRenewalVoucherNo(existing.VoucherNo);
                var linkedChildAcc = await FindFdAccountByAnyNumberAsync(context, suffixAcc);

                if (!hasOpeningFdTx && linkedChildAcc == null)
                {
                    var orphanTxs = await context.FdTransactions.Where(t => t.VoucherID == existing.VoucherID).ToListAsync();
                    if (orphanTxs.Any()) context.FdTransactions.RemoveRange(orphanTxs);

                    if (existing.VoucherDetails != null && existing.VoucherDetails.Any())
                    {
                        context.VoucherDetails.RemoveRange(existing.VoucherDetails);
                    }
                    context.Vouchers.Remove(existing);
                    await context.SaveChangesAsync();
                    return desiredVoucherNo;
                }
            }

            // Fallback suffix so IX_Vouchers_VoucherNo can never collide
            int counter = 2;
            string candidate = $"{desiredVoucherNo}-R{counter}";
            while (await context.Vouchers.AnyAsync(v => v.VoucherNo == candidate))
            {
                counter++;
                candidate = $"{desiredVoucherNo}-R{counter}";
            }
            return candidate;
        }

        private static async Task ReverseSavingInterestTransfersAsync(
            AppDbContext context,
            IEnumerable<string> voucherNos,
            IEnumerable<string> newAccVariants,
            DateTime? txDate = null)
        {
            var vNoList = voucherNos.Where(v => !string.IsNullOrWhiteSpace(v)).Distinct().ToList();
            var accList = newAccVariants.Where(a => !string.IsNullOrWhiteSpace(a)).Distinct().ToList();
            if (!vNoList.Any() && !accList.Any()) return;

            var candidateSbTxs = await context.SavingTransactions
                .Where(st =>
                    (st.VoucherNo != null && vNoList.Contains(st.VoucherNo)) ||
                    (st.Narration != null && st.Narration.Contains("FD Renewal Interest")))
                .ToListAsync();

            foreach (var sbTx in candidateSbTxs)
            {
                bool matchesVoucher = sbTx.VoucherNo != null && vNoList.Contains(sbTx.VoucherNo, StringComparer.OrdinalIgnoreCase);
                bool matchesAcc = !matchesVoucher && sbTx.Narration != null && accList.Any(a => sbTx.Narration.Contains(a, StringComparison.OrdinalIgnoreCase));
                if (!matchesVoucher && !matchesAcc) continue;
                if (txDate.HasValue && matchesAcc && sbTx.TransactionDate.Date != txDate.Value.Date) continue;

                var sbAcc = await context.SavingAccountMasters.FindAsync(sbTx.SavingAccountID);
                if (sbAcc != null)
                {
                    sbAcc.CurrentBalance -= sbTx.Amount;
                }
                var sbPassbooks = await context.SavingPassbooks.Where(p => p.TransactionID == sbTx.TransactionID).ToListAsync();
                if (sbPassbooks.Any()) context.SavingPassbooks.RemoveRange(sbPassbooks);
                context.SavingTransactions.Remove(sbTx);
            }
        }

        /// <summary>
        /// Atomically rolls back an FD Renewal starting from either JV-FD-REN-*, PAY-FD-INT-*, or JV-FD-INT-* voucher.
        /// Deletes the newly created renewed FD account, cleans up sibling renewal vouchers & FdTransactions,
        /// reverses any Saving Account interest transfer, restores the old FD account to Matured/Active,
        /// and syncs FdAccountSequences.
        /// </summary>
        public static async Task<FdRenewalRollbackResult> RollbackRenewalByVoucherAsync(
            AppDbContext context,
            Voucher primaryVoucher,
            bool deletePrimaryVoucherRecord)
        {
            var result = new FdRenewalRollbackResult { WasRenewal = true };

            // 1. Primary lookup via FK FdTransactions on primaryVoucher.VoucherID
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

            // 2. Fallback via VoucherNo suffix & Remarks/Narration (14-digit CBS + legacy -FD- safe)
            string suffixNewAccNo = ExtractAccountSuffixFromRenewalVoucherNo(primaryVoucher.VoucherNo);
            if (newAccount == null && !string.IsNullOrEmpty(suffixNewAccNo))
            {
                newAccount = await FindFdAccountByAnyNumberAsync(context, suffixNewAccNo);
            }

            var (parsedOldNo, parsedNewNo) = ExtractOldAndNewAccFromText(newAccount?.Remarks, primaryVoucher.Narration);
            if (newAccount == null && !string.IsNullOrEmpty(parsedNewNo))
            {
                newAccount = await FindFdAccountByAnyNumberAsync(context, parsedNewNo);
                if (newAccount != null && string.IsNullOrEmpty(parsedOldNo))
                {
                    (parsedOldNo, _) = ExtractOldAndNewAccFromText(newAccount.Remarks, null);
                }
            }

            if (oldAccount == null && !string.IsNullOrEmpty(parsedOldNo))
            {
                oldAccount = await FindFdAccountByAnyNumberAsync(context, parsedOldNo);
            }

            // 3. Locate any sibling renewal vouchers (e.g. JV-FD-REN-{newAcc} <-> PAY-FD-INT-{newAcc} / JV-FD-INT-{newAcc})
            var newAccTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var v in BuildAccountNumberVariants(newAccount?.AccountNo)) newAccTokens.Add(v);
            foreach (var v in BuildAccountNumberVariants(suffixNewAccNo)) newAccTokens.Add(v);
            foreach (var v in BuildAccountNumberVariants(parsedNewNo)) newAccTokens.Add(v);

            var expectedSiblingVoucherNos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var tok in newAccTokens)
            {
                expectedSiblingVoucherNos.Add($"JV-FD-REN-{tok}");
                expectedSiblingVoucherNos.Add($"PAY-FD-INT-{tok}");
                expectedSiblingVoucherNos.Add($"JV-FD-INT-{tok}");
            }

            var siblingVouchers = new List<Voucher>();
            if (expectedSiblingVoucherNos.Any())
            {
                siblingVouchers = await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => v.VoucherID != primaryVoucher.VoucherID && v.VoucherNo != null && expectedSiblingVoucherNos.Contains(v.VoucherNo))
                    .ToListAsync();
            }

            // Also check if newAccount has Opening FdTransaction pointing to a JV-FD-REN voucher not yet in siblingVouchers
            if (newAccount != null)
            {
                var newAccVoucherIds = await context.FdTransactions
                    .Where(t => t.FdAccountID == newAccount.FdAccountID && t.VoucherID > 0 && t.VoucherID != primaryVoucher.VoucherID)
                    .Select(t => t.VoucherID)
                    .Distinct()
                    .ToListAsync();

                foreach (var svId in newAccVoucherIds)
                {
                    if (siblingVouchers.All(sv => sv.VoucherID != svId))
                    {
                        var sv = await context.Vouchers.Include(v => v.VoucherDetails).FirstOrDefaultAsync(v => v.VoucherID == svId);
                        if (sv != null && IsFdRenewalVoucher(sv))
                        {
                            siblingVouchers.Add(sv);
                        }
                    }
                }
            }

            // If oldAccount was still null (e.g. primaryVoucher was PAY-FD-INT without Renewal tx), check sibling vouchers' FdTransactions
            if (oldAccount == null && siblingVouchers.Any())
            {
                var sibIds = siblingVouchers.Select(s => s.VoucherID).ToList();
                var sibOldTx = await context.FdTransactions
                    .Include(t => t.FdAccount)
                    .FirstOrDefaultAsync(t => sibIds.Contains(t.VoucherID) && (t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout"));
                oldAccount = sibOldTx?.FdAccount;
            }

            var allRenewalVoucherIds = new HashSet<int> { primaryVoucher.VoucherID };
            foreach (var sv in siblingVouchers) allRenewalVoucherIds.Add(sv.VoucherID);

            var allRenewalVoucherNos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(primaryVoucher.VoucherNo)) allRenewalVoucherNos.Add(primaryVoucher.VoucherNo);
            foreach (var sv in siblingVouchers)
            {
                if (!string.IsNullOrWhiteSpace(sv.VoucherNo)) allRenewalVoucherNos.Add(sv.VoucherNo);
            }

            // 4. Reverse SavingAccount interest payout transfer if any
            var oldAndNewTokens = new HashSet<string>(newAccTokens, StringComparer.OrdinalIgnoreCase);
            foreach (var v in BuildAccountNumberVariants(oldAccount?.AccountNo)) oldAndNewTokens.Add(v);
            await ReverseSavingInterestTransfersAsync(context, allRenewalVoucherNos, oldAndNewTokens, primaryVoucher.VoucherDate);

            // 5. Remove FdTransactions & FdInterestAccruals for all renewal vouchers and newAccount
            int? newAccId = newAccount?.FdAccountID;
            var txsToRemove = await context.FdTransactions
                .Where(t => allRenewalVoucherIds.Contains(t.VoucherID) || (newAccId.HasValue && t.FdAccountID == newAccId.Value))
                .ToListAsync();
            if (txsToRemove.Any())
            {
                context.FdTransactions.RemoveRange(txsToRemove);
                await context.SaveChangesAsync();
            }

            if (newAccount != null)
            {
                var newAccruals = await context.FdInterestAccruals
                    .Where(a => a.FdAccountID == newAccount.FdAccountID)
                    .ToListAsync();
                if (newAccruals.Any())
                {
                    context.FdInterestAccruals.RemoveRange(newAccruals);
                    await context.SaveChangesAsync();
                }
            }

            // 6. Clean AutoRenewalLogs, MisPayouts, RelatedVoucherID cycle & delete sibling renewal vouchers (and primaryVoucher if requested)
            if (newAccount != null)
            {
                var newMis = await context.FdMisPayouts.Where(m => m.FdAccountID == newAccount.FdAccountID).ToListAsync();
                if (newMis.Any())
                {
                    context.FdMisPayouts.RemoveRange(newMis);
                    await context.SaveChangesAsync();
                }
            }

            var autoRenLogs = await context.FdAutoRenewalLogs
                .Where(l => (l.VoucherID.HasValue && allRenewalVoucherIds.Contains(l.VoucherID.Value)) ||
                            (newAccId.HasValue && l.NewFdAccountID == newAccId.Value))
                .ToListAsync();
            if (autoRenLogs.Any())
            {
                if (oldAccount != null)
                {
                    oldAccount.AutoRenewalCount = Math.Max(0, oldAccount.AutoRenewalCount - 1);
                }
                context.FdAutoRenewalLogs.RemoveRange(autoRenLogs);
                await context.SaveChangesAsync();
            }

            var vIdsBeingRemoved = new HashSet<int>(siblingVouchers.Select(s => s.VoucherID));
            if (deletePrimaryVoucherRecord) vIdsBeingRemoved.Add(primaryVoucher.VoucherID);
            if (vIdsBeingRemoved.Any())
            {
                var relRefs = await context.Vouchers
                    .Where(v => vIdsBeingRemoved.Contains(v.VoucherID) || (v.RelatedVoucherID.HasValue && vIdsBeingRemoved.Contains(v.RelatedVoucherID.Value)))
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
            }
            foreach (var sv in siblingVouchers)
            {
                if (sv.VoucherDetails != null && sv.VoucherDetails.Any())
                {
                    context.VoucherDetails.RemoveRange(sv.VoucherDetails);
                }
                context.Vouchers.Remove(sv);
                if (!string.IsNullOrEmpty(sv.VoucherNo)) result.DeletedVoucherNos.Add(sv.VoucherNo);
            }

            if (deletePrimaryVoucherRecord)
            {
                if (primaryVoucher.VoucherDetails == null)
                {
                    await context.Entry(primaryVoucher).Collection(v => v.VoucherDetails).LoadAsync();
                }
                if (primaryVoucher.VoucherDetails != null && primaryVoucher.VoucherDetails.Any())
                {
                    context.VoucherDetails.RemoveRange(primaryVoucher.VoucherDetails);
                }
                context.Vouchers.Remove(primaryVoucher);
                if (!string.IsNullOrEmpty(primaryVoucher.VoucherNo)) result.DeletedVoucherNos.Add(primaryVoucher.VoucherNo);
            }

            // 7. Delete newAccount & restore oldAccount status/remarks
            int branchIdToSync = primaryVoucher.BranchID;
            if (newAccount != null)
            {
                branchIdToSync = newAccount.BranchID > 0 ? newAccount.BranchID : branchIdToSync;
                result.NewAccountNo = newAccount.AccountNo;
                result.NewFdAccountId = newAccount.FdAccountID;
                context.FdAccounts.Remove(newAccount);
            }
            else if (!string.IsNullOrEmpty(suffixNewAccNo))
            {
                result.NewAccountNo = suffixNewAccNo;
            }

            if (oldAccount != null)
            {
                branchIdToSync = oldAccount.BranchID > 0 ? oldAccount.BranchID : branchIdToSync;
                result.OldAccountNo = oldAccount.AccountNo;
                result.OldFdAccountId = oldAccount.FdAccountID;
                RestoreOldAccountFromRenewal(oldAccount);
            }
            else if (!string.IsNullOrEmpty(parsedOldNo))
            {
                result.OldAccountNo = parsedOldNo;
            }

            await context.SaveChangesAsync();

            // 8. Resync branch FD sequence cleanly (14-digit CBS aware)
            if (branchIdToSync > 0)
            {
                await SyncBranchFdSequenceAsync(context, branchIdToSync);
            }

            return result;
        }

        /// <summary>
        /// When a newly renewed FD account is deleted via DeleteFdAccount, rolls back the parent renewal
        /// (deletes JV-FD-REN-* & sibling PAY/JV-FD-INT-* vouchers, deletes oldAccount's Renewal FdTransaction,
        /// reverses Saving interest transfer if any, and restores oldAccount to Matured/Active).
        /// NOTE: Does NOT remove childNewAccount itself if deleteChildAccountRecord is false (caller DeleteFdAccount removes it).
        /// </summary>
        public static async Task<FdRenewalRollbackResult> RollbackParentRenewalOnChildAccountDeleteAsync(
            AppDbContext context,
            FdAccount childNewAccount)
        {
            var result = new FdRenewalRollbackResult();

            // Detect if childNewAccount was created via FD Renewal
            var childOpeningTxs = await context.FdTransactions
                .Where(t => t.FdAccountID == childNewAccount.FdAccountID && t.VoucherID > 0)
                .ToListAsync();

            var childVoucherIds = childOpeningTxs.Select(t => t.VoucherID).Distinct().ToList();

            var parentRenewalTxs = childVoucherIds.Any()
                ? await context.FdTransactions
                    .Include(t => t.FdAccount)
                    .Where(t => t.FdAccountID != childNewAccount.FdAccountID &&
                                childVoucherIds.Contains(t.VoucherID) &&
                                (t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout"))
                    .ToListAsync()
                : new List<FdTransaction>();

            bool hasRenewalRemarks = !string.IsNullOrWhiteSpace(childNewAccount.Remarks) &&
                                     (childNewAccount.Remarks.Contains("नूतनीकरण खाते") ||
                                      childNewAccount.Remarks.Contains("Renewed from", StringComparison.OrdinalIgnoreCase));

            var childVariants = BuildAccountNumberVariants(childNewAccount.AccountNo);
            var expectedRenewalVoucherNos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var cv in childVariants)
            {
                expectedRenewalVoucherNos.Add($"JV-FD-REN-{cv}");
                expectedRenewalVoucherNos.Add($"PAY-FD-INT-{cv}");
                expectedRenewalVoucherNos.Add($"JV-FD-INT-{cv}");
            }

            var renewalVouchers = await context.Vouchers
                .Include(v => v.VoucherDetails)
                .Where(v => (childVoucherIds.Contains(v.VoucherID) && v.VoucherNo != null &&
                             (v.VoucherNo.StartsWith("JV-FD-REN-") || v.VoucherNo.StartsWith("PAY-FD-INT-") || v.VoucherNo.StartsWith("JV-FD-INT-")))
                            || (v.VoucherNo != null && expectedRenewalVoucherNos.Contains(v.VoucherNo)))
                .ToListAsync();

            if (!parentRenewalTxs.Any() && !hasRenewalRemarks && !renewalVouchers.Any())
            {
                result.WasRenewal = false;
                return result;
            }

            result.WasRenewal = true;
            result.NewAccountNo = childNewAccount.AccountNo;
            result.NewFdAccountId = childNewAccount.FdAccountID;

            FdAccount? oldAccount = parentRenewalTxs.FirstOrDefault()?.FdAccount;
            if (oldAccount == null)
            {
                string? sampleNarr = renewalVouchers.FirstOrDefault()?.Narration;
                var (parsedOldNo, _) = ExtractOldAndNewAccFromText(childNewAccount.Remarks, sampleNarr);
                if (!string.IsNullOrEmpty(parsedOldNo))
                {
                    oldAccount = await FindFdAccountByAnyNumberAsync(context, parsedOldNo);
                }
            }

            // Also include any sibling PAY-FD-INT / JV-FD-INT vouchers on oldAccount for the same renewal date
            var allVoucherIds = new HashSet<int>(renewalVouchers.Select(v => v.VoucherID));
            foreach (var vid in childVoucherIds)
            {
                var v = await context.Vouchers.Include(x => x.VoucherDetails).FirstOrDefaultAsync(x => x.VoucherID == vid);
                if (v != null && IsFdRenewalVoucher(v))
                {
                    allVoucherIds.Add(v.VoucherID);
                    if (renewalVouchers.All(rv => rv.VoucherID != v.VoucherID))
                    {
                        renewalVouchers.Add(v);
                    }
                }
            }

            var allVoucherNos = renewalVouchers
                .Select(v => v.VoucherNo ?? "")
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .ToList();

            var tokenSet = new HashSet<string>(childVariants, StringComparer.OrdinalIgnoreCase);
            foreach (var ov in BuildAccountNumberVariants(oldAccount?.AccountNo)) tokenSet.Add(ov);

            await ReverseSavingInterestTransfersAsync(context, allVoucherNos, tokenSet, childNewAccount.OpeningDate);

            // Remove parent's Renewal / Interest Payout / renewal-linked FdTransactions so usedByOtherFd won't block voucher cleanup
            if (allVoucherIds.Any())
            {
                var linkedParentTxs = await context.FdTransactions
                    .Where(t => t.FdAccountID != childNewAccount.FdAccountID && allVoucherIds.Contains(t.VoucherID))
                    .ToListAsync();
                if (linkedParentTxs.Any())
                {
                    context.FdTransactions.RemoveRange(linkedParentTxs);
                    await context.SaveChangesAsync();
                }
            }

            if (oldAccount != null)
            {
                // Also clean any orphaned Renewal FdTransactions on oldAccount whose Voucher no longer has an Opening child
                var extraOrphanRenewalTxs = await context.FdTransactions
                    .Where(t => t.FdAccountID == oldAccount.FdAccountID &&
                                (t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout") &&
                                t.TransactionDate.Date == childNewAccount.OpeningDate.Date)
                    .ToListAsync();

                foreach (var etx in extraOrphanRenewalTxs)
                {
                    bool usedByAnotherChild = await context.FdTransactions
                        .AnyAsync(o => o.VoucherID == etx.VoucherID &&
                                       o.FdAccountID != oldAccount.FdAccountID &&
                                       o.FdAccountID != childNewAccount.FdAccountID &&
                                       o.TransactionType == "Opening");
                    if (!usedByAnotherChild)
                    {
                        context.FdTransactions.Remove(etx);
                        if (etx.VoucherID > 0 && !allVoucherIds.Contains(etx.VoucherID))
                        {
                            var ev = await context.Vouchers.Include(x => x.VoucherDetails).FirstOrDefaultAsync(x => x.VoucherID == etx.VoucherID);
                            if (ev != null && IsFdRenewalVoucher(ev))
                            {
                                allVoucherIds.Add(ev.VoucherID);
                                renewalVouchers.Add(ev);
                            }
                        }
                    }
                }

                result.OldAccountNo = oldAccount.AccountNo;
                result.OldFdAccountId = oldAccount.FdAccountID;
                RestoreOldAccountFromRenewal(oldAccount);
                await context.SaveChangesAsync();
            }

            // Remove child's own FdTransactions before deleting renewal vouchers
            if (childOpeningTxs.Any())
            {
                context.FdTransactions.RemoveRange(childOpeningTxs);
                await context.SaveChangesAsync();
            }

            foreach (var rv in renewalVouchers)
            {
                bool stillReferenced = await context.FdTransactions.AnyAsync(t => t.VoucherID == rv.VoucherID);
                if (stillReferenced) continue;

                if (rv.VoucherDetails != null && rv.VoucherDetails.Any())
                {
                    context.VoucherDetails.RemoveRange(rv.VoucherDetails);
                }
                context.Vouchers.Remove(rv);
                if (!string.IsNullOrEmpty(rv.VoucherNo)) result.DeletedVoucherNos.Add(rv.VoucherNo);
            }

            if (renewalVouchers.Any())
            {
                await context.SaveChangesAsync();
            }

            return result;
        }

        /// <summary>
        /// 3-Way Self-Healing for any half-deleted / orphaned FD Renewals (including 14-digit CBS accounts like 1582 / 001-401-0000212-4):
        /// Pass 1: Orphaned JV-FD-REN-* / PAY-FD-INT-* / JV-FD-INT-* vouchers whose renewed child FD account was already deleted.
        /// Pass 2: Orphaned renewed child FD accounts whose JV-FD-REN-* voucher was already deleted.
        /// Pass 3: Orphaned Renewal FdTransactions or stuck "Closed" parent FD accounts with "| नूतनीकरण दिनांक:" whose child FD & renewal voucher no longer exist.
        /// </summary>
        public static async Task HealOrphanedRenewalsAsync(AppDbContext context, int? targetFdAccountId = null)
        {
            try
            {
                var branchesToSync = new HashSet<int>();
                bool modified = false;

                // === PASS 1: Orphaned Renewal Vouchers (child renewed FD account was deleted) ===
                var renewalVouchers = await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => v.VoucherNo != null &&
                                (v.VoucherNo.StartsWith("JV-FD-REN-") ||
                                 v.VoucherNo.StartsWith("PAY-FD-INT-") ||
                                 v.VoucherNo.StartsWith("JV-FD-INT-")))
                    .ToListAsync();

                foreach (var rv in renewalVouchers)
                {
                    bool hasActiveOpeningChild = await context.FdTransactions
                        .AnyAsync(t => t.VoucherID == rv.VoucherID &&
                                       t.TransactionType == "Opening" &&
                                       context.FdAccounts.Any(f => f.FdAccountID == t.FdAccountID));

                    if (hasActiveOpeningChild) continue;

                    string suffixAccNo = ExtractAccountSuffixFromRenewalVoucherNo(rv.VoucherNo);
                    var childAcc = await FindFdAccountByAnyNumberAsync(context, suffixAccNo);
                    if (childAcc != null) continue;

                    // Neither Opening FdTransaction nor child FdAccount exists -> rv is an ORPHANED renewal voucher!
                    var orphanTxs = await context.FdTransactions
                        .Include(t => t.FdAccount)
                        .Where(t => t.VoucherID == rv.VoucherID)
                        .ToListAsync();

                    FdAccount? oldAcc = orphanTxs.FirstOrDefault(t => t.FdAccount != null)?.FdAccount;
                    if (oldAcc == null)
                    {
                        var (parsedOld, _) = ExtractOldAndNewAccFromText(null, rv.Narration);
                        if (!string.IsNullOrEmpty(parsedOld))
                        {
                            oldAcc = await FindFdAccountByAnyNumberAsync(context, parsedOld);
                        }
                    }

                    if (oldAcc != null)
                    {
                        RestoreOldAccountFromRenewal(oldAcc);
                        branchesToSync.Add(oldAcc.BranchID);
                    }

                    if (rv.BranchID > 0) branchesToSync.Add(rv.BranchID);

                    var vNos = new[] { rv.VoucherNo ?? "" };
                    var accVariants = BuildAccountNumberVariants(suffixAccNo)
                        .Concat(BuildAccountNumberVariants(oldAcc?.AccountNo));
                    await ReverseSavingInterestTransfersAsync(context, vNos, accVariants, rv.VoucherDate);

                    if (orphanTxs.Any()) context.FdTransactions.RemoveRange(orphanTxs);
                    if (rv.VoucherDetails != null && rv.VoucherDetails.Any()) context.VoucherDetails.RemoveRange(rv.VoucherDetails);
                    context.Vouchers.Remove(rv);
                    modified = true;
                }

                if (modified)
                {
                    await context.SaveChangesAsync();
                    modified = false;
                }

                // === PASS 2: Orphaned Renewed Child FD Accounts (whose JV-FD-REN voucher was deleted) ===
                var renewedChildAccounts = await context.FdAccounts
                    .Where(f => f.Remarks != null &&
                                (f.Remarks.Contains("नूतनीकरण खाते") || f.Remarks.Contains("Renewed from")))
                    .ToListAsync();

                foreach (var newAcc in renewedChildAccounts)
                {
                    var variants = BuildAccountNumberVariants(newAcc.AccountNo);
                    var expectedVNos = variants.Select(v => $"JV-FD-REN-{v}").ToList();

                    bool voucherExists = await context.Vouchers
                        .AnyAsync(v => v.VoucherNo != null && expectedVNos.Contains(v.VoucherNo));

                    if (!voucherExists)
                    {
                        // Also check via Opening FdTransaction -> Voucher
                        voucherExists = await context.FdTransactions
                            .AnyAsync(t => t.FdAccountID == newAcc.FdAccountID &&
                                           t.TransactionType == "Opening" &&
                                           context.Vouchers.Any(v => v.VoucherID == t.VoucherID));
                    }

                    if (!voucherExists)
                    {
                        var (oldAccNo, _) = ExtractOldAndNewAccFromText(newAcc.Remarks, null);
                        var oldAcc = await FindFdAccountByAnyNumberAsync(context, oldAccNo);
                        if (oldAcc != null)
                        {
                            RestoreOldAccountFromRenewal(oldAcc);
                            branchesToSync.Add(oldAcc.BranchID);

                            // Remove any leftover Renewal / Interest Payout FdTransactions on oldAcc from that date
                            var oldOrphanTxs = await context.FdTransactions
                                .Where(t => t.FdAccountID == oldAcc.FdAccountID &&
                                            (t.TransactionType == "Renewal" || t.TransactionType == "Interest Payout") &&
                                            !context.Vouchers.Any(v => v.VoucherID == t.VoucherID))
                                .ToListAsync();
                            if (oldOrphanTxs.Any()) context.FdTransactions.RemoveRange(oldOrphanTxs);
                        }

                        var newTxs = await context.FdTransactions.Where(t => t.FdAccountID == newAcc.FdAccountID).ToListAsync();
                        if (newTxs.Any()) context.FdTransactions.RemoveRange(newTxs);

                        var newAccruals = await context.FdInterestAccruals.Where(a => a.FdAccountID == newAcc.FdAccountID).ToListAsync();
                        if (newAccruals.Any()) context.FdInterestAccruals.RemoveRange(newAccruals);
                        var newMis = await context.FdMisPayouts.Where(m => m.FdAccountID == newAcc.FdAccountID).ToListAsync();
                        if (newMis.Any()) context.FdMisPayouts.RemoveRange(newMis);
                        var newAutoLogs = await context.FdAutoRenewalLogs.Where(l => l.NewFdAccountID == newAcc.FdAccountID).ToListAsync();
                        if (newAutoLogs.Any()) context.FdAutoRenewalLogs.RemoveRange(newAutoLogs);

                        branchesToSync.Add(newAcc.BranchID);
                        context.FdAccounts.Remove(newAcc);
                        modified = true;
                    }
                }

                if (modified)
                {
                    await context.SaveChangesAsync();
                    modified = false;
                }

                // === PASS 3A: Orphaned Renewal FdTransactions on Parent Accounts (e.g. reopened via बंद खाते पूर्ववत करा after child FD was deleted) ===
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

                    // Double check if any existing child FdAccount mentions Renewed from this parent account
                    bool hasExistingRenewedChild = false;
                    if (rTx.FdAccount != null && !string.IsNullOrWhiteSpace(rTx.FdAccount.AccountNo))
                    {
                        var parentVariants = BuildAccountNumberVariants(rTx.FdAccount.AccountNo);
                        hasExistingRenewedChild = await context.FdAccounts
                            .AnyAsync(c => c.FdAccountID != rTx.FdAccountID &&
                                           c.Remarks != null &&
                                           parentVariants.Any(pv => c.Remarks.Contains(pv)));
                    }

                    if (!hasExistingRenewedChild)
                    {
                        if (rTx.FdAccount != null)
                        {
                            RestoreOldAccountFromRenewal(rTx.FdAccount);
                            branchesToSync.Add(rTx.FdAccount.BranchID);
                        }
                        context.FdTransactions.Remove(rTx);
                        modified = true;
                    }
                }

                // === PASS 3B: Stuck "Closed" Parent Accounts with "| नूतनीकरण दिनांक:" whose renewal voucher & child FD were BOTH deleted ===
                var stuckClosedQuery = context.FdAccounts
                    .Where(f => f.Status == "Closed" && f.Remarks != null && f.Remarks.Contains("नूतनीकरण दिनांक:"));

                if (targetFdAccountId.HasValue && targetFdAccountId.Value > 0)
                {
                    stuckClosedQuery = stuckClosedQuery.Where(f => f.FdAccountID == targetFdAccountId.Value);
                }

                var stuckClosedCandidates = await stuckClosedQuery.ToListAsync();
                foreach (var cand in stuckClosedCandidates)
                {
                    bool hasActiveCloseOrRenewalTx = await context.FdTransactions
                        .AnyAsync(t => t.FdAccountID == cand.FdAccountID &&
                                       (t.TransactionType == "Renewal" ||
                                        t.TransactionType == "Payout" ||
                                        t.TransactionType == "Premature_Close"));
                    if (hasActiveCloseOrRenewalTx) continue;

                    var candVariants = BuildAccountNumberVariants(cand.AccountNo);
                    bool hasChildFd = candVariants.Any() && await context.FdAccounts
                        .AnyAsync(c => c.FdAccountID != cand.FdAccountID &&
                                       c.Remarks != null &&
                                       candVariants.Any(cv => c.Remarks.Contains(cv)));
                    if (hasChildFd) continue;

                    RestoreOldAccountFromRenewal(cand);
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


using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Centralized CBS helper for RD Installment Collection:
    /// 1. Collision-safe, 50-char-bounded VoucherNo generation (safe for partial installments & cross-branch IBT).
    /// 2. Chronological Saving Passbook BalanceAfterTxn maintenance on debit & reversal.
    /// 3. Deterministic FIFO Waterfall Schedule Reconciliation (supports partial payments, post-maturity extension, and legacy self-healing).
    /// 4. Atomic Rollback of Pending/Rejected/Deleted RD Installment Collection Vouchers (restores RdAccount, partial schedules, Saving/Pigmy balances, and IBT sibling vouchers).
    /// </summary>
    public static class RdInstallmentCollectionRollbackHelper
    {
        public static bool IsRdInstallmentCollectionVoucher(Voucher? voucher)
        {
            if (voucher == null || string.IsNullOrWhiteSpace(voucher.VoucherNo))
                return false;

            string vNo = voucher.VoucherNo.Trim();
            if (vNo.Contains("-OP-", StringComparison.OrdinalIgnoreCase) ||
                RdClosureSettlementHelper.IsRdClosureOrRenewalVoucher(voucher))
            {
                return false;
            }

            return vNo.StartsWith("JV-RD-COLL-", StringComparison.OrdinalIgnoreCase) ||
                   vNo.Contains("-RD-COLL-", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Generates a unique VoucherNo strictly bounded to &lt;= 50 chars (matching Voucher.VoucherNo &amp; SavingTransaction.VoucherNo column limits).
        /// Prevents collisions when multiple partial payments occur on the same installment number or after voucher re-entry.
        /// </summary>
        public static async Task<string> GenerateUniqueRdCollVoucherNoAsync(AppDbContext context, string baseCandidate)
        {
            const int maxLen = 50;
            string cleanBase = (baseCandidate ?? "JV-RD-COLL").Trim();
            if (cleanBase.Length > maxLen)
            {
                cleanBase = cleanBase.Substring(0, maxLen);
            }

            string candidate = cleanBase;
            int suffix = 1;

            while (true)
            {
                bool existsInDb = await context.Vouchers.AnyAsync(v => v.VoucherNo == candidate) ||
                                  await context.SavingTransactions.AnyAsync(s => s.VoucherNo == candidate);
                bool existsLocal = context.Vouchers.Local.Any(v => v.VoucherNo == candidate) ||
                                   context.SavingTransactions.Local.Any(s => s.VoucherNo == candidate);

                if (!existsInDb && !existsLocal)
                {
                    return candidate;
                }

                suffix++;
                string tag = $"-P{suffix}";
                int allowedBaseLen = maxLen - tag.Length;
                string trimmedBase = cleanBase.Length > allowedBaseLen
                    ? cleanBase.Substring(0, allowedBaseLen)
                    : cleanBase;
                candidate = trimmedBase + tag;
            }
        }

        /// <summary>
        /// Debits customer's Saving Account for RD installment transfer while maintaining chronological BalanceAfterTxn
        /// across any subsequent transactions if the login business date is backdated.
        /// </summary>
        public static async Task<SavingTransaction> InsertSavingTransferDebitWithPassbookSyncAsync(
            AppDbContext context,
            SavingAccountMaster sourceSavingAcc,
            int branchId,
            DateTime txnDate,
            decimal amount,
            string voucherNo,
            string narration,
            int createdBy)
        {
            decimal roundedAmt = Math.Round(amount, 2, MidpointRounding.AwayFromZero);

            // Find any transactions strictly after txnDate.Date so chronological passbook running balance stays intact
            var laterTxns = await context.SavingTransactions
                .Where(t => t.SavingAccountID == sourceSavingAcc.SavingAccountID && t.TransactionDate.Date > txnDate.Date)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.TransactionID)
                .ToListAsync();

            sourceSavingAcc.CurrentBalance = Math.Round(sourceSavingAcc.CurrentBalance - roundedAmt, 2, MidpointRounding.AwayFromZero);
            context.Entry(sourceSavingAcc).State = EntityState.Modified;

            decimal balanceAtTxnDate;
            if (!laterTxns.Any())
            {
                balanceAtTxnDate = sourceSavingAcc.CurrentBalance;
            }
            else
            {
                // Compute net effect of transactions strictly after txnDate so BalanceAfterTxn at txnDate is chronologically exact
                decimal laterNetEffect = 0m;
                foreach (var lt in laterTxns)
                {
                    if (lt.TransactionType == "Deposit" || lt.TransactionType == "Interest")
                        laterNetEffect += lt.Amount;
                    else if (lt.TransactionType == "Withdrawal" || lt.TransactionType == "Charges")
                        laterNetEffect -= lt.Amount;

                    lt.BalanceAfterTxn = Math.Round(lt.BalanceAfterTxn - roundedAmt, 2, MidpointRounding.AwayFromZero);
                    context.Entry(lt).State = EntityState.Modified;
                }
                balanceAtTxnDate = Math.Round(sourceSavingAcc.CurrentBalance - laterNetEffect, 2, MidpointRounding.AwayFromZero);
            }

            var savingTxn = new SavingTransaction
            {
                SavingAccountID = sourceSavingAcc.SavingAccountID,
                CustomerID = sourceSavingAcc.CustomerID,
                BranchID = branchId,
                TransactionDate = txnDate,
                TransactionType = "Withdrawal",
                Amount = roundedAmt,
                BalanceAfterTxn = balanceAtTxnDate,
                PaymentMode = "Transfer",
                VoucherNo = voucherNo,
                Narration = narration,
                CreatedBy = createdBy > 0 ? createdBy : 1,
                CreatedOn = DateTime.UtcNow
            };

            context.SavingTransactions.Add(savingTxn);
            return savingTxn;
        }

        /// <summary>
        /// Reverses and cleanly removes SavingTransaction(s) created by a Pending/Rejected/Deleted RD Installment voucher,
        /// restoring SavingAccount.CurrentBalance and updating subsequent passbook BalanceAfterTxn rows.
        /// </summary>
        public static async Task ReverseSavingTransferForRdVoucherAsync(
            AppDbContext context,
            IEnumerable<string> voucherNos)
        {
            var validNos = voucherNos
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => n.Trim())
                .Distinct()
                .ToList();

            if (!validNos.Any()) return;

            var savingTxs = await context.SavingTransactions
                .Where(st => st.VoucherNo != null && validNos.Contains(st.VoucherNo))
                .OrderByDescending(st => st.TransactionDate)
                .ThenByDescending(st => st.TransactionID)
                .ToListAsync();

            foreach (var st in savingTxs)
            {
                var savAcc = await context.SavingAccountMasters.FindAsync(st.SavingAccountID);
                if (savAcc != null)
                {
                    decimal delta = (st.TransactionType == "Withdrawal" || st.TransactionType == "Charges")
                        ? st.Amount
                        : -st.Amount;

                    savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance + delta, 2, MidpointRounding.AwayFromZero);
                    context.Entry(savAcc).State = EntityState.Modified;

                    var subsequentTxns = await context.SavingTransactions
                        .Where(t => t.SavingAccountID == savAcc.SavingAccountID &&
                                    t.TransactionID != st.TransactionID &&
                                    (t.TransactionDate.Date > st.TransactionDate.Date ||
                                     (t.TransactionDate.Date == st.TransactionDate.Date && t.TransactionID > st.TransactionID)))
                        .ToListAsync();

                    foreach (var sub in subsequentTxns)
                    {
                        sub.BalanceAfterTxn = Math.Round(sub.BalanceAfterTxn + delta, 2, MidpointRounding.AwayFromZero);
                        context.Entry(sub).State = EntityState.Modified;
                    }
                }

                var stPassbooks = await context.SavingPassbooks.Where(p => p.TransactionID == st.TransactionID).ToListAsync();
                if (stPassbooks.Any()) context.SavingPassbooks.RemoveRange(stPassbooks);
                context.SavingTransactions.Remove(st);
            }
        }

        /// <summary>
        /// Reverses and removes PigmyTransaction(s) created by a Pending/Rejected/Deleted RD Installment voucher.
        /// </summary>
        public static async Task ReversePigmyTransferForRdVoucherAsync(
            AppDbContext context,
            IEnumerable<string> voucherNos)
        {
            var refCandidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var vNo in voucherNos.Where(n => !string.IsNullOrWhiteSpace(n)))
            {
                string trimmed = vNo.Trim();
                refCandidates.Add(trimmed);
                if (trimmed.StartsWith("JV-", StringComparison.OrdinalIgnoreCase))
                {
                    refCandidates.Add(trimmed.Substring(3)); // e.g. RD-COLL-...
                }
                int idx = trimmed.IndexOf("RD-COLL-", StringComparison.OrdinalIgnoreCase);
                if (idx >= 0)
                {
                    refCandidates.Add(trimmed.Substring(idx));
                }
            }

            if (!refCandidates.Any()) return;

            var candList = refCandidates.ToList();
            var pigmyTxs = await context.PigmyTransactions
                .Where(pt => pt.TransactionType == "RD_TRANSFER" &&
                             pt.ReferenceId != null &&
                             candList.Contains(pt.ReferenceId))
                .ToListAsync();

            foreach (var pt in pigmyTxs)
            {
                var pAcc = await context.PigmyAccounts.FindAsync(pt.PigmyAccountID);
                if (pAcc != null)
                {
                    pAcc.TotalWithdrawnAmount = Math.Max(0m, Math.Round(pAcc.TotalWithdrawnAmount - pt.DrAmount, 2, MidpointRounding.AwayFromZero));
                    context.Entry(pAcc).State = EntityState.Modified;
                }
                context.PigmyTransactions.Remove(pt);
            }
        }

        /// <summary>
        /// Ensures RDInstallmentSchedules for an RdAccount cover both base DurationMonths and any extended post-maturity
        /// deposits, and reconciles PaidAmount / Status strictly in FIFO Waterfall order against account.TotalDepositedAmount.
        /// Idempotent: performs ZERO database writes if schedules are already in sync.
        /// </summary>
        public static async Task<List<RdInstallmentSchedule>> ReconcileRdSchedulesWithDepositedAmountAsync(
            AppDbContext context,
            RdAccount account,
            HashSet<int>? deletedVoucherIds = null,
            DateTime? fallbackPaidDate = null)
        {
            var schedules = await context.RDInstallmentSchedules
                .Include(s => s.Voucher)
                .Where(s => s.RdAccountID == account.RdAccountID)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();

            decimal instAmt = account.InstallmentAmount > 0 ? account.InstallmentAmount : 0m;
            int baseDuration = account.DurationMonths > 0 ? account.DurationMonths : 12;
            int graceDays = account.RdScheme?.GracePeriodDays ?? 5;
            decimal targetDep = Math.Round(Math.Max(0m, account.TotalDepositedAmount), 2, MidpointRounding.AwayFromZero);

            int neededRowsForDeposit = instAmt > 0
                ? (int)Math.Ceiling((double)(targetDep / instAmt) - 1e-6)
                : baseDuration;
            if (targetDep > 0 && neededRowsForDeposit == 0) neededRowsForDeposit = 1;

            int targetRowCount = Math.Max(baseDuration, neededRowsForDeposit);

            // Check whether existing schedule rows are already 100% consistent with targetDep & FIFO waterfall
            if (IsScheduleAlreadyInSync(schedules, targetRowCount, targetDep, instAmt, deletedVoucherIds))
            {
                return schedules;
            }

            // 1. Remove any excess trailing post-maturity rows beyond targetRowCount (e.g. after rolling back an extended installment)
            var excessRows = schedules.Where(s => s.InstallmentNo > targetRowCount).ToList();
            if (excessRows.Any())
            {
                context.RDInstallmentSchedules.RemoveRange(excessRows);
                schedules = schedules.Where(s => s.InstallmentNo <= targetRowCount).OrderBy(s => s.InstallmentNo).ToList();
            }

            // 2. Ensure every InstallmentNo from 1..targetRowCount exists
            var existingByNo = schedules.ToDictionary(s => s.InstallmentNo, s => s);
            var newlyAdded = new List<RdInstallmentSchedule>();
            for (int i = 1; i <= targetRowCount; i++)
            {
                if (!existingByNo.ContainsKey(i))
                {
                    DateTime dueDate = account.OpeningDate.AddMonths(i - 1);
                    var newRow = new RdInstallmentSchedule
                    {
                        RdAccountID = account.RdAccountID,
                        InstallmentNo = i,
                        DueDate = dueDate,
                        GraceDate = dueDate.AddDays(graceDays),
                        ExpectedAmount = instAmt,
                        Status = dueDate.Date < DateTime.Today ? "Overdue" : "Pending",
                        PaidAmount = 0m,
                        PaidDate = null,
                        OverdueDays = dueDate.Date < DateTime.Today ? (int)(DateTime.Today - dueDate.Date).TotalDays : 0,
                        PenaltyCharged = 0m,
                        PenaltyWaived = 0m,
                        VoucherID = null
                    };
                    newlyAdded.Add(newRow);
                    existingByNo[i] = newRow;
                }
            }

            if (newlyAdded.Any())
            {
                context.RDInstallmentSchedules.AddRange(newlyAdded);
            }

            var orderedRows = existingByNo.Values.OrderBy(s => s.InstallmentNo).ToList();

            // 3. Look up remaining valid installment transactions to restore VoucherID/PaidDate accurately when healing or rolling back
            var remainingInstallmentTxs = await context.RdTransactions
                .AsNoTracking()
                .Where(t => t.RdAccountID == account.RdAccountID &&
                            t.TransactionType == "Installment" &&
                            t.DebitCredit == "Cr" &&
                            (deletedVoucherIds == null || !deletedVoucherIds.Contains(t.VoucherID)))
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.RdTransactionID)
                .ToListAsync();

            var latestValidTx = remainingInstallmentTxs.LastOrDefault();
            int? fallbackVoucherId = latestValidTx != null && latestValidTx.VoucherID > 0 ? latestValidTx.VoucherID : null;
            DateTime? latestValidDate = fallbackPaidDate ?? latestValidTx?.TransactionDate;

            // 4. Strictly redistribute targetDep in FIFO Waterfall order
            decimal remaining = targetDep;
            foreach (var s in orderedRows)
            {
                decimal exp = s.ExpectedAmount > 0 ? s.ExpectedAmount : instAmt;
                if (s.ExpectedAmount <= 0 && instAmt > 0)
                {
                    s.ExpectedAmount = instAmt;
                }

                bool hadDeletedVoucher = deletedVoucherIds != null &&
                                         s.VoucherID.HasValue &&
                                         deletedVoucherIds.Contains(s.VoucherID.Value);

                if (hadDeletedVoucher)
                {
                    s.PenaltyCharged = 0m;
                }

                decimal alloc = exp > 0
                    ? Math.Round(Math.Min(exp, remaining), 2, MidpointRounding.AwayFromZero)
                    : 0m;
                remaining = Math.Round(Math.Max(0m, remaining - alloc), 2, MidpointRounding.AwayFromZero);

                if (exp > 0 && alloc >= exp - 0.01m)
                {
                    s.PaidAmount = exp;
                    s.Status = "Paid";
                    if (hadDeletedVoucher)
                    {
                        s.VoucherID = fallbackVoucherId;
                        s.PaidDate = latestValidDate ?? s.DueDate;
                    }
                    else
                    {
                        s.PaidDate ??= latestValidDate ?? s.DueDate;
                        s.VoucherID ??= fallbackVoucherId;
                    }
                }
                else if (alloc > 0.009m)
                {
                    s.PaidAmount = alloc;
                    s.Status = "Partial";
                    if (hadDeletedVoucher)
                    {
                        s.VoucherID = fallbackVoucherId;
                        s.PaidDate = latestValidDate ?? s.DueDate;
                    }
                    else
                    {
                        s.PaidDate ??= latestValidDate ?? s.DueDate;
                        s.VoucherID ??= fallbackVoucherId;
                    }
                }
                else
                {
                    s.PaidAmount = 0m;
                    s.PaidDate = null;
                    s.PaymentMode = null;
                    s.VoucherID = null;
                    s.PenaltyCharged = 0m;
                    bool isOverdue = s.DueDate.Date < DateTime.Today;
                    s.Status = isOverdue ? "Overdue" : "Pending";
                    s.OverdueDays = isOverdue ? (int)(DateTime.Today - s.DueDate.Date).TotalDays : 0;
                }
            }

            // 5. Synchronize RdAccount.TotalPaidInstallments and Status
            int fullyPaidCount = orderedRows.Count(s => s.Status == "Paid");
            if (account.TotalPaidInstallments != fullyPaidCount)
            {
                account.TotalPaidInstallments = fullyPaidCount;
                context.Entry(account).State = EntityState.Modified;
            }

            if (account.Status != "Closed")
            {
                if (fullyPaidCount >= baseDuration && account.Status != "Matured" && !account.IsLegacyAccount)
                {
                    account.Status = "Matured";
                    context.Entry(account).State = EntityState.Modified;
                }
                else if (fullyPaidCount < baseDuration && account.Status == "Matured" && account.MaturityDate.Date > DateTime.Today)
                {
                    account.Status = "Active";
                    context.Entry(account).State = EntityState.Modified;
                }
            }

            await context.SaveChangesAsync();

            return await context.RDInstallmentSchedules
                .Include(s => s.Voucher)
                .Where(s => s.RdAccountID == account.RdAccountID)
                .OrderBy(s => s.InstallmentNo)
                .ToListAsync();
        }

        private static bool IsScheduleAlreadyInSync(
            List<RdInstallmentSchedule> schedules,
            int targetRowCount,
            decimal targetDep,
            decimal instAmt,
            HashSet<int>? deletedVoucherIds)
        {
            if (schedules == null || schedules.Count != targetRowCount || targetRowCount == 0)
                return false;

            if (deletedVoucherIds != null && schedules.Any(s => s.VoucherID.HasValue && deletedVoucherIds.Contains(s.VoucherID.Value)))
                return false;

            decimal sumPaid = Math.Round(schedules.Sum(s => s.PaidAmount), 2, MidpointRounding.AwayFromZero);
            if (Math.Abs(sumPaid - targetDep) > 0.01m)
                return false;

            bool seenNonFull = false;
            for (int i = 0; i < schedules.Count; i++)
            {
                var s = schedules[i];
                if (s.InstallmentNo != i + 1) return false;

                decimal exp = s.ExpectedAmount > 0 ? s.ExpectedAmount : instAmt;
                if (s.PaidAmount >= exp - 0.01m && exp > 0)
                {
                    if (seenNonFull) return false; // Non-FIFO gap detected
                    if (s.Status != "Paid") return false;
                }
                else if (s.PaidAmount > 0.009m)
                {
                    if (seenNonFull) return false; // Cannot have two Partial rows in FIFO waterfall
                    seenNonFull = true;
                    if (s.Status != "Partial") return false;
                }
                else
                {
                    seenNonFull = true;
                    if (s.Status == "Paid" || s.Status == "Partial") return false;
                }
            }

            return true;
        }

        /// <summary>
        /// Full atomic rollback for a Pending/Rejected/Deleted RD Installment Collection Voucher.
        /// Reverses RdAccount.TotalDepositedAmount, FIFO schedules (preserving prior partial payments!),
        /// Saving/Pigmy transfers, and Cross-Branch IBT sibling vouchers.
        /// Returns true if the voucher was an RD Installment Collection voucher and was handled.
        /// </summary>
        public static async Task<bool> RollbackRdInstallmentCollectionByVoucherAsync(
            AppDbContext context,
            Voucher voucher,
            string reason,
            int userId,
            string username)
        {
            if (voucher == null) return false;

            // Never touch opening migration or closure/renewal vouchers here
            if (!string.IsNullOrWhiteSpace(voucher.VoucherNo) &&
                (voucher.VoucherNo.Contains("-OP-", StringComparison.OrdinalIgnoreCase) ||
                 RdClosureSettlementHelper.IsRdClosureOrRenewalVoucher(voucher)))
            {
                return false;
            }

            var voucherIds = new HashSet<int> { voucher.VoucherID };
            var voucherNos = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(voucher.VoucherNo))
            {
                voucherNos.Add(voucher.VoucherNo.Trim());
            }

            Voucher? siblingIbtVoucher = null;
            if (voucher.IsIbtVoucher && voucher.RelatedVoucherID.HasValue && voucher.RelatedVoucherID.Value > 0)
            {
                siblingIbtVoucher = await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .FirstOrDefaultAsync(v => v.VoucherID == voucher.RelatedVoucherID.Value);
                if (siblingIbtVoucher != null)
                {
                    voucherIds.Add(siblingIbtVoucher.VoucherID);
                    if (!string.IsNullOrWhiteSpace(siblingIbtVoucher.VoucherNo))
                    {
                        voucherNos.Add(siblingIbtVoucher.VoucherNo.Trim());
                    }
                }
            }

            var linkedInstallmentTxs = await context.RdTransactions
                .Where(rt => rt.VoucherID > 0 &&
                             voucherIds.Contains(rt.VoucherID) &&
                             rt.TransactionType == "Installment")
                .ToListAsync();

            bool isRdCollVoucher = IsRdInstallmentCollectionVoucher(voucher) ||
                                   (siblingIbtVoucher != null && IsRdInstallmentCollectionVoucher(siblingIbtVoucher)) ||
                                   linkedInstallmentTxs.Any();

            if (!isRdCollVoucher)
            {
                return false;
            }

            // 1. Reverse Saving & Pigmy Account transfers if this RD installment was paid via Transfer
            await ReverseSavingTransferForRdVoucherAsync(context, voucherNos);
            await ReversePigmyTransferForRdVoucherAsync(context, voucherNos);

            // 2. Roll back RdAccount principal & reconcile RDInstallmentSchedules (preserving earlier partial installments)
            var affectedAccountIds = linkedInstallmentTxs.Select(t => t.RdAccountID).Distinct().ToList();

            // Fallback: if RdTransaction was already missing, check schedules linked to voucherIds
            if (!affectedAccountIds.Any())
            {
                var schedAccIds = await context.RDInstallmentSchedules
                    .Where(s => s.VoucherID.HasValue && voucherIds.Contains(s.VoucherID.Value))
                    .Select(s => s.RdAccountID)
                    .Distinct()
                    .ToListAsync();
                affectedAccountIds.AddRange(schedAccIds);
            }

            if (linkedInstallmentTxs.Any())
            {
                context.RdTransactions.RemoveRange(linkedInstallmentTxs);
            }

            foreach (int rdAccId in affectedAccountIds)
            {
                var account = await context.RdAccounts
                    .Include(a => a.RdScheme)
                    .FirstOrDefaultAsync(a => a.RdAccountID == rdAccId);

                if (account == null) continue;

                decimal principalReversed = linkedInstallmentTxs
                    .Where(t => t.RdAccountID == rdAccId && t.DebitCredit == "Cr")
                    .Sum(t => t.PrincipalAmount);

                if (principalReversed > 0)
                {
                    account.TotalDepositedAmount = Math.Max(0m, Math.Round(account.TotalDepositedAmount - principalReversed, 2, MidpointRounding.AwayFromZero));
                    context.Entry(account).State = EntityState.Modified;
                }

                await context.SaveChangesAsync();
                await ReconcileRdSchedulesWithDepositedAmountAsync(context, account, voucherIds);

                context.AuditLogs.Add(new AuditLog
                {
                    UserID = userId > 0 ? userId : null,
                    Username = !string.IsNullOrWhiteSpace(username) ? username : $"User-{userId}",
                    Action = "RD_INSTALLMENT_VOUCHER_REVERSED",
                    EntityName = "RdAccount",
                    EntityID = account.AccountNo,
                    Details = $"आरडी हप्ता व्हाउचर {voucher.VoucherNo} रद्द/डिलीट केले. खाते क्र. {account.AccountNo} मधून मुद्दल ₹{principalReversed:N2} रोलबॅक केले (नवीन जमा शिल्लक: ₹{account.TotalDepositedAmount:N2}, पूर्ण हप्ते: {account.TotalPaidInstallments}). कारण: {reason}",
                    Timestamp = DateTime.Now,
                    Status = "Success"
                });
            }

            // 3. Clean up Cross-Branch IBT sibling voucher if present
            if (siblingIbtVoucher == null)
            {
                siblingIbtVoucher = await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .FirstOrDefaultAsync(v => v.RelatedVoucherID == voucher.VoucherID);
            }
            if (siblingIbtVoucher != null)
            {
                voucher.RelatedVoucherID = null;
                siblingIbtVoucher.RelatedVoucherID = null;
                await context.SaveChangesAsync();

                if (siblingIbtVoucher.VoucherDetails != null && siblingIbtVoucher.VoucherDetails.Any())
                {
                    context.VoucherDetails.RemoveRange(siblingIbtVoucher.VoucherDetails);
                }
                context.Vouchers.Remove(siblingIbtVoucher);
            }

            await context.SaveChangesAsync();
            return true;
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public static class RdClosureSettlementHelper
    {
        public record RdSettlementBreakdown(
            decimal Principal,
            decimal GlProvisionedInterest,
            decimal CalculatedPayout,
            decimal FinalPayout,
            bool IsCustomOverridden,
            decimal EffectiveInterest,
            decimal PrincipalPenalty,
            decimal PayableDebit,
            decimal ExtraExpenseDebit,
            decimal ClawbackExpenseCredit,
            decimal HomeVoucherTotal
        );

        public static async Task<(decimal GlProvisionedInterest, decimal SubLedgerAccruedInterest)> ComputeRdAccrualStateAsync(
            AppDbContext context,
            RdAccount account)
        {
            var accrualTxs = await context.RdTransactions
                .AsNoTracking()
                .Where(t => t.RdAccountID == account.RdAccountID && t.TransactionType == "Accrual")
                .Select(t => new { t.DebitCredit, t.InterestAmount, t.Narration })
                .ToListAsync();

            decimal nonMigrationCr = accrualTxs
                .Where(t => t.DebitCredit == "Cr" && (t.Narration == null || !t.Narration.Contains("मायग्रेटेड आरडी संचित व्याज")))
                .Sum(t => t.InterestAmount);

            decimal allCr = accrualTxs
                .Where(t => t.DebitCredit == "Cr")
                .Sum(t => t.InterestAmount);

            decimal allDr = accrualTxs
                .Where(t => t.DebitCredit == "Dr")
                .Sum(t => t.InterestAmount);

            decimal glProvisioned = Math.Max(0m, nonMigrationCr - allDr + account.LegacyAccruedInt);
            decimal subLedgerAccrued = allCr - allDr;
            return (glProvisioned, subLedgerAccrued);
        }

        public static RdSettlementBreakdown BuildSettlementBreakdown(
            decimal principal,
            decimal glProvisionedInterest,
            decimal calculatedPayout,
            decimal? customPayoutAmount)
        {
            decimal p = Math.Round(Math.Max(0m, principal), 2, MidpointRounding.AwayFromZero);
            decimal a = Math.Round(Math.Max(0m, glProvisionedInterest), 2, MidpointRounding.AwayFromZero);
            decimal calc = Math.Round(Math.Max(0m, calculatedPayout), 2, MidpointRounding.AwayFromZero);
            decimal finalPayout = customPayoutAmount.HasValue
                ? Math.Round(customPayoutAmount.Value, 2, MidpointRounding.AwayFromZero)
                : calc;

            bool isCustom = customPayoutAmount.HasValue && Math.Abs(finalPayout - calc) >= 0.01m;

            decimal effectiveInterest;
            decimal principalPenalty;
            decimal payableDebit = a;
            decimal extraExpenseDebit;
            decimal clawbackExpenseCredit;

            if (finalPayout >= p)
            {
                effectiveInterest = Math.Round(finalPayout - p, 2, MidpointRounding.AwayFromZero);
                principalPenalty = 0m;
                extraExpenseDebit = Math.Max(0m, Math.Round(effectiveInterest - a, 2, MidpointRounding.AwayFromZero));
                clawbackExpenseCredit = Math.Max(0m, Math.Round(a - effectiveInterest, 2, MidpointRounding.AwayFromZero));
            }
            else
            {
                effectiveInterest = 0m;
                principalPenalty = Math.Round(p - finalPayout, 2, MidpointRounding.AwayFromZero);
                extraExpenseDebit = 0m;
                clawbackExpenseCredit = a;
            }

            // Total Dr == p + payableDebit + extraExpenseDebit == finalPayout + principalPenalty + clawbackExpenseCredit == Total Cr
            decimal homeVoucherTotal = Math.Round(p + payableDebit + extraExpenseDebit, 2, MidpointRounding.AwayFromZero);

            return new RdSettlementBreakdown(
                Principal: p,
                GlProvisionedInterest: a,
                CalculatedPayout: calc,
                FinalPayout: finalPayout,
                IsCustomOverridden: isCustom,
                EffectiveInterest: effectiveInterest,
                PrincipalPenalty: principalPenalty,
                PayableDebit: payableDebit,
                ExtraExpenseDebit: extraExpenseDebit,
                ClawbackExpenseCredit: clawbackExpenseCredit,
                HomeVoucherTotal: homeVoucherTotal
            );
        }

        private static async Task<Ledger> GetOrCreateLedgerAsync(AppDbContext context, string ledgerName, string groupName, string type)
        {
            var ledger = await context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName == ledgerName);
            if (ledger == null)
            {
                var group = await context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == groupName);
                int gId = group?.GroupID ?? 1;

                ledger = new Ledger
                {
                    LedgerName = ledgerName,
                    GroupID = gId,
                    OpeningBalance = 0,
                    OpeningBalanceType = type,
                    IsActive = true
                };
                context.Ledgers.Add(ledger);
                await context.SaveChangesAsync();
            }
            return ledger;
        }

        public static async Task<Ledger> GetLiabilityLedgerAsync(AppDbContext context, RdScheme? scheme)
        {
            if (scheme?.RdLiabilityLedgerID.HasValue == true)
            {
                var l = await context.Ledgers.FindAsync(scheme.RdLiabilityLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync(context, "१३ मेंबर आरडी ठेव", "ठेवी", "Cr");
        }

        public static async Task<Ledger> GetExpenseLedgerAsync(AppDbContext context, RdScheme? scheme)
        {
            if (scheme?.InterestExpenseLedgerID.HasValue == true)
            {
                var l = await context.Ledgers.FindAsync(scheme.InterestExpenseLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync(context, "१३४ आरडी ठेवीवरील व्याज", "ठेवीवरील व्याज", "Dr");
        }

        public static async Task<Ledger> GetPayableLedgerAsync(AppDbContext context, RdScheme? scheme)
        {
            if (scheme?.InterestPayableLedgerID.HasValue == true)
            {
                var l = await context.Ledgers.FindAsync(scheme.InterestPayableLedgerID.Value);
                if (l != null) return l;
            }
            return await context.Ledgers.FirstOrDefaultAsync(l =>
                       l.LedgerName.Contains("२३ देणे सभासद ठेव व्याज") ||
                       l.LedgerName.ToLower().Contains("interest payable"))
                   ?? await GetOrCreateLedgerAsync(context, "२३ देणे सभासद ठेव व्याज", "देणे व्याज", "Cr");
        }

        public static async Task<Ledger> GetPenaltyLedgerAsync(AppDbContext context, RdScheme? scheme)
        {
            if (scheme?.PenaltyIncomeLedgerID.HasValue == true)
            {
                var l = await context.Ledgers.FindAsync(scheme.PenaltyIncomeLedgerID.Value);
                if (l != null) return l;
            }
            return await GetOrCreateLedgerAsync(context, "४६ आरडी दंड आकारणी", "इतर किरकोळ खर्च", "Cr");
        }

        private static async Task<(bool IsValid, string? ErrorMessage, Ledger? PayoutLedger, string VoucherType, string ModeLabel, SavingAccountMaster? TargetSavingAccount)> ResolveRdClosurePayoutAsync(
            AppDbContext context,
            int operatingBranchId,
            string? paymentMode,
            int? bankLedgerId,
            int? savingAccountId)
        {
            string mode = (paymentMode ?? "Cash").Trim();
            if (BankLedgerHelper.IsBankPaymentMode(mode))
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(context, bankLedgerId);
                if (!bankCheck.IsValid)
                {
                    return (false, bankCheck.ErrorMessage, null, "Payment", "बँक", null);
                }
                var bLedger = await context.Ledgers.FindAsync(bankCheck.LedgerId);
                if (bLedger == null)
                {
                    return (false, "निवडलेले बँक जी.एल. खाते प्रणालीत आढळले नाही.", null, "Payment", "बँक", null);
                }
                return (true, null, bLedger, "Payment", $"बँक ({bLedger.LedgerName})", null);
            }

            if (mode.Equals("Transfer", StringComparison.OrdinalIgnoreCase) ||
                mode.Equals("Saving", StringComparison.OrdinalIgnoreCase) ||
                mode.Equals("SavingTransfer", StringComparison.OrdinalIgnoreCase))
            {
                if (!savingAccountId.HasValue || savingAccountId.Value <= 0)
                {
                    return (false, "बचत खात्यात वर्ग करण्यासाठी कृपया खातेदाराचे सक्रिय बचत खाते निवडा.", null, "Journal", "बचत वर्ग", null);
                }
                var sbAcc = await context.SavingAccountMasters
                    .Include(s => s.SavingScheme)
                    .FirstOrDefaultAsync(s => s.SavingAccountID == savingAccountId.Value);
                if (sbAcc == null || sbAcc.Status == "Closed" || sbAcc.Status == "Frozen")
                {
                    return (false, "निवडलेले बचत खाते सापडले नाही किंवा सक्रिय (Active) नाही.", null, "Journal", "बचत वर्ग", null);
                }
                int sbLedgerId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(context, sbAcc);
                if (sbLedgerId <= 0)
                {
                    return (false, SavingLedgerHelper.GetMissingMappingErrorMessage(sbAcc.AccountNo), null, "Journal", "बचत वर्ग", null);
                }
                var sbLedger = await context.Ledgers.FindAsync(sbLedgerId);
                if (sbLedger == null)
                {
                    return (false, SavingLedgerHelper.GetMissingMappingErrorMessage(sbAcc.AccountNo), null, "Journal", "बचत वर्ग", null);
                }
                return (true, null, sbLedger, "Journal", $"बचत खात्यात वर्ग ({sbAcc.AccountNo})", sbAcc);
            }

            int branchCashId = await CashLedgerHelper.GetCashLedgerIdAsync(context, operatingBranchId, "RD");
            var cLedger = await context.Ledgers.FindAsync(branchCashId);
            if (cLedger == null)
            {
                return (false, "शाखेचे रोख जी.एल. खाते (Cash Ledger) सापडले नाही.", null, "Payment", "रोख", null);
            }
            return (true, null, cLedger, "Payment", "रोख", null);
        }

        private static void ApplyRdClosureSavingCredit(
            AppDbContext context,
            SavingAccountMaster? targetSavingAcc,
            decimal payoutAmount,
            DateTime txnDate,
            int fallbackBranchId,
            string voucherNo,
            string narration,
            int createdByUserId)
        {
            if (targetSavingAcc == null || payoutAmount <= 0) return;
            targetSavingAcc.CurrentBalance += payoutAmount;
            context.Entry(targetSavingAcc).State = EntityState.Modified;
            context.SavingTransactions.Add(new SavingTransaction
            {
                SavingAccountID = targetSavingAcc.SavingAccountID,
                CustomerID = targetSavingAcc.CustomerID,
                BranchID = targetSavingAcc.BranchID > 0 ? targetSavingAcc.BranchID : fallbackBranchId,
                TransactionDate = txnDate,
                TransactionType = "Deposit",
                PaymentMode = "Transfer",
                Amount = payoutAmount,
                BalanceAfterTxn = targetSavingAcc.CurrentBalance,
                VoucherNo = voucherNo,
                Narration = narration,
                CreatedBy = createdByUserId
            });
        }

        private static async Task<int?> ResolveNextScrollNoIfApprovedAsync(
            AppDbContext context,
            string status,
            int branchId,
            DateTime voucherDate)
        {
            if (!string.Equals(status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            int maxScroll = await context.Vouchers
                .Where(v => v.BranchID == branchId && v.VoucherDate.Date == voucherDate.Date && v.ScrollNo != null)
                .Select(v => (int?)v.ScrollNo)
                .MaxAsync() ?? 0;

            return maxScroll + 1;
        }

        private static async Task AddBalancedHomeSideLinesAsync(
            AppDbContext context,
            int voucherId,
            RdAccount account,
            RdSettlementBreakdown settlement,
            int creditSettlementLedgerId,
            int? linkedMemberId)
        {
            var rdLiabilityLedger = await GetLiabilityLedgerAsync(context, account.RdScheme);

            // 1. Dr RD Liability (Principal cleared 100%)
            if (settlement.Principal > 0)
            {
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucherId,
                    LedgerID = rdLiabilityLedger.LedgerID,
                    DrCr = "Dr",
                    Amount = settlement.Principal,
                    CustomerID = account.CustomerID,
                    MemberID = linkedMemberId
                });
            }

            // 2. Dr Interest Payable (Previously provisioned interest cleared 100%)
            if (settlement.PayableDebit > 0)
            {
                var payableLedger = await GetPayableLedgerAsync(context, account.RdScheme);
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucherId,
                    LedgerID = payableLedger.LedgerID,
                    DrCr = "Dr",
                    Amount = settlement.PayableDebit,
                    CustomerID = account.CustomerID,
                    MemberID = linkedMemberId
                });
            }

            // 3. Dr Interest Expense (Unprovisioned additional interest paid at closure)
            if (settlement.ExtraExpenseDebit > 0)
            {
                var expenseLedger = await GetExpenseLedgerAsync(context, account.RdScheme);
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucherId,
                    LedgerID = expenseLedger.LedgerID,
                    DrCr = "Dr",
                    Amount = settlement.ExtraExpenseDebit,
                    CustomerID = account.CustomerID,
                    MemberID = linkedMemberId
                });
            }

            // 4. Cr Cash / Bank / Saving / FD / IBT (Actual Final Payout Amount M)
            context.VoucherDetails.Add(new VoucherDetail
            {
                VoucherID = voucherId,
                LedgerID = creditSettlementLedgerId,
                DrCr = "Cr",
                Amount = settlement.FinalPayout,
                CustomerID = account.CustomerID,
                MemberID = linkedMemberId
            });

            // 5. Cr Penalty Income (When Final Payout M < Principal P)
            if (settlement.PrincipalPenalty > 0)
            {
                var penaltyLedger = await GetPenaltyLedgerAsync(context, account.RdScheme);
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucherId,
                    LedgerID = penaltyLedger.LedgerID,
                    DrCr = "Cr",
                    Amount = settlement.PrincipalPenalty,
                    CustomerID = account.CustomerID,
                    MemberID = linkedMemberId
                });
            }

            // 6. Cr Interest Expense Reversal / Clawback (When GlProvisionedInterest > EffectiveInterest)
            if (settlement.ClawbackExpenseCredit > 0)
            {
                var clawbackLedger = await GetExpenseLedgerAsync(context, account.RdScheme);
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucherId,
                    LedgerID = clawbackLedger.LedgerID,
                    DrCr = "Cr",
                    Amount = settlement.ClawbackExpenseCredit,
                    CustomerID = account.CustomerID,
                    MemberID = linkedMemberId
                });
            }
        }

        private static async Task RecordZeroBalanceClosureRdTransactionsAsync(
            AppDbContext context,
            RdAccount account,
            RdSettlementBreakdown settlement,
            int txBranchId,
            int voucherId,
            DateTime closureDate,
            string closureTxType,
            string closureNarration,
            int createdByUserId)
        {
            var existingTxs = await context.RdTransactions
                .AsNoTracking()
                .Where(t => t.RdAccountID == account.RdAccountID)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.RdTransactionID)
                .ToListAsync();

            decimal currentRunningBal = 0m;
            foreach (var t in existingTxs)
            {
                var (dr, cr) = ResolveRdKhatavaniLineAmounts(t, currentRunningBal);
                currentRunningBal += (cr - dr);
            }

            if (existingTxs.Count == 0 && account.TotalDepositedAmount > 0)
            {
                currentRunningBal = account.TotalDepositedAmount;
            }

            int activeFyId = account.FinancialYearID > 0 ? account.FinancialYearID : 1;

            if (settlement.FinalPayout >= settlement.Principal)
            {
                decimal diff = Math.Round(settlement.FinalPayout - currentRunningBal, 2, MidpointRounding.AwayFromZero);
                if (diff > 0.009m)
                {
                    // Credit unrecorded closure interest to sub-ledger before final payout
                    context.RdTransactions.Add(new RdTransaction
                    {
                        InstitutionID = account.InstitutionID > 0 ? account.InstitutionID : 1,
                        BranchID = txBranchId,
                        FinancialYearID = activeFyId,
                        RdAccountID = account.RdAccountID,
                        VoucherID = voucherId,
                        TransactionDate = closureDate,
                        TransactionType = "Accrual",
                        DebitCredit = "Cr",
                        PrincipalAmount = 0m,
                        PenaltyAmount = 0m,
                        InterestAmount = diff,
                        BalanceAfterTxn = settlement.FinalPayout,
                        Narration = $"खाते बंद समयी देय व्याज जमा (Closure Interest): {account.AccountNo}",
                        CreatedBy = createdByUserId
                    });
                }
                else if (diff < -0.009m)
                {
                    decimal excessRev = Math.Abs(diff);
                    context.RdTransactions.Add(new RdTransaction
                    {
                        InstitutionID = account.InstitutionID > 0 ? account.InstitutionID : 1,
                        BranchID = txBranchId,
                        FinancialYearID = activeFyId,
                        RdAccountID = account.RdAccountID,
                        VoucherID = voucherId,
                        TransactionDate = closureDate,
                        TransactionType = "Accrual",
                        DebitCredit = "Dr",
                        PrincipalAmount = 0m,
                        PenaltyAmount = 0m,
                        InterestAmount = excessRev,
                        BalanceAfterTxn = settlement.FinalPayout,
                        Narration = $"जादा संचित व्याज तरतूद वजावट (Interest Clawback): {account.AccountNo}",
                        CreatedBy = createdByUserId
                    });
                }

                context.RdTransactions.Add(new RdTransaction
                {
                    InstitutionID = account.InstitutionID > 0 ? account.InstitutionID : 1,
                    BranchID = txBranchId,
                    FinancialYearID = activeFyId,
                    RdAccountID = account.RdAccountID,
                    VoucherID = voucherId,
                    TransactionDate = closureDate,
                    TransactionType = closureTxType,
                    DebitCredit = "Dr",
                    PrincipalAmount = settlement.Principal,
                    PenaltyAmount = 0m,
                    InterestAmount = settlement.EffectiveInterest,
                    BalanceAfterTxn = 0m,
                    Narration = closureNarration,
                    CreatedBy = createdByUserId
                });
            }
            else
            {
                // FinalPayout < Principal (Penalty deducted from Principal)
                decimal excessAbovePrincipal = Math.Round(currentRunningBal - settlement.Principal, 2, MidpointRounding.AwayFromZero);
                if (excessAbovePrincipal > 0.009m)
                {
                    context.RdTransactions.Add(new RdTransaction
                    {
                        InstitutionID = account.InstitutionID > 0 ? account.InstitutionID : 1,
                        BranchID = txBranchId,
                        FinancialYearID = activeFyId,
                        RdAccountID = account.RdAccountID,
                        VoucherID = voucherId,
                        TransactionDate = closureDate,
                        TransactionType = "Accrual",
                        DebitCredit = "Dr",
                        PrincipalAmount = 0m,
                        PenaltyAmount = 0m,
                        InterestAmount = excessAbovePrincipal,
                        BalanceAfterTxn = settlement.Principal,
                        Narration = $"मुदतपूर्व बंद संचित व्याज रद्द (Accrued Interest Reversed): {account.AccountNo}",
                        CreatedBy = createdByUserId
                    });
                }

                if (settlement.PrincipalPenalty > 0.009m)
                {
                    context.RdTransactions.Add(new RdTransaction
                    {
                        InstitutionID = account.InstitutionID > 0 ? account.InstitutionID : 1,
                        BranchID = txBranchId,
                        FinancialYearID = activeFyId,
                        RdAccountID = account.RdAccountID,
                        VoucherID = voucherId,
                        TransactionDate = closureDate,
                        TransactionType = "Penalty",
                        DebitCredit = "Dr",
                        PrincipalAmount = 0m,
                        PenaltyAmount = settlement.PrincipalPenalty,
                        InterestAmount = 0m,
                        BalanceAfterTxn = settlement.FinalPayout,
                        Narration = $"मुदतपूर्व खाते बंद दंड वजावट (Premature Penalty Deduction): {account.AccountNo}",
                        CreatedBy = createdByUserId
                    });
                }

                context.RdTransactions.Add(new RdTransaction
                {
                    InstitutionID = account.InstitutionID > 0 ? account.InstitutionID : 1,
                    BranchID = txBranchId,
                    FinancialYearID = activeFyId,
                    RdAccountID = account.RdAccountID,
                    VoucherID = voucherId,
                    TransactionDate = closureDate,
                    TransactionType = closureTxType,
                    DebitCredit = "Dr",
                    PrincipalAmount = settlement.FinalPayout,
                    PenaltyAmount = settlement.PrincipalPenalty,
                    InterestAmount = 0m,
                    BalanceAfterTxn = 0m,
                    Narration = closureNarration,
                    CreatedBy = createdByUserId
                });
            }
        }

        public static (decimal Debit, decimal Credit) ResolveRdKhatavaniLineAmounts(RdTransaction t, decimal currentRunningBalance)
        {
            if (t.DebitCredit == "Cr")
            {
                decimal cr = t.PrincipalAmount > 0 ? t.PrincipalAmount : (t.InterestAmount > 0 ? t.InterestAmount : t.PenaltyAmount);
                return (0m, cr);
            }

            bool isClosureRow = t.TransactionType == "Payout" ||
                                t.TransactionType == "Premature_Close" ||
                                t.TransactionType == "Renewal";

            if (isClosureRow)
            {
                if (t.BalanceAfterTxn.HasValue)
                {
                    return (t.PrincipalAmount + t.InterestAmount, 0m);
                }

                // Backward-compatible reconciliation for legacy closures recorded without BalanceAfterTxn
                decimal combined = t.PrincipalAmount + t.InterestAmount;
                if (t.InterestAmount > 0 && Math.Abs(currentRunningBalance - combined) < 0.05m)
                {
                    return (combined, 0m);
                }

                decimal legacyDr = t.PrincipalAmount > 0 ? t.PrincipalAmount : t.InterestAmount;
                return (legacyDr, 0m);
            }

            if (t.TransactionType == "Penalty" && t.PrincipalAmount == 0 && t.InterestAmount == 0 && t.PenaltyAmount > 0)
            {
                return (t.PenaltyAmount, 0m);
            }

            decimal dr = t.PrincipalAmount > 0 ? t.PrincipalAmount : (t.InterestAmount > 0 ? t.InterestAmount : t.PenaltyAmount);
            return (dr, 0m);
        }

        private static string BuildSettlementAuditSuffix(RdSettlementBreakdown s, string? remarks)
        {
            var parts = new List<string>
            {
                $"परतावा: ₹{s.FinalPayout:N2}",
                $"मुद्दल: ₹{s.Principal:N2}",
                $"देय व्याज: ₹{s.EffectiveInterest:N2}"
            };

            if (s.PrincipalPenalty > 0)
            {
                parts.Add($"दंड वजावट: ₹{s.PrincipalPenalty:N2}");
            }
            if (s.ClawbackExpenseCredit > 0)
            {
                parts.Add($"तरतूद वजावट: ₹{s.ClawbackExpenseCredit:N2}");
            }
            if (s.IsCustomOverridden)
            {
                parts.Add($"संपादित (मूळ हिशोब: ₹{s.CalculatedPayout:N2})");
            }
            if (!string.IsNullOrWhiteSpace(remarks))
            {
                parts.Add($"टीप: {remarks.Trim()}");
            }

            return $" [{string.Join(" | ", parts)}]";
        }

        public static async Task<IActionResult> ExecuteMaturedCloseAsync(
            AppDbContext context,
            ClaimsPrincipal currentUser,
            int id,
            DateTime? closureDate,
            string paymentMode,
            int? bankLedgerId,
            int? savingAccountId,
            decimal? customPayoutAmount,
            string? remarks)
        {
            var account = await context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return new BadRequestObjectResult("आरडी खाते सापडले नाही किंवा आधीच बंद झालेले आहे.");
            }

            if (account.IsLienMarked)
            {
                return new BadRequestObjectResult($"या आरडी खात्यावर कर्जाचे तारण (Lien: {account.LienLoanAccountNo ?? "सक्रिय कर्ज"}) नोंदवलेले असल्यामुळे तारण मुक्त झाल्याशिवाय खाते बंद करता येणार नाही.");
            }

            DateTime effClosureDate = closureDate?.Date ?? DateTime.Today;
            var closedFy = await context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && effClosureDate.Date >= fy.StartDate.Date && effClosureDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return new BadRequestObjectResult($"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडत असल्याने या तारखेवर खाते बंद करता येत नाही.");
            }

            if (customPayoutAmount.HasValue && customPayoutAmount.Value <= 0)
            {
                return new BadRequestObjectResult("अंतिम देय परताव्याची रक्कम शून्य किंवा उणे असू शकत नाही.");
            }

            var (alreadyAccruedInt, _) = await ComputeRdAccrualStateAsync(context, account);
            bool isTermCompleted = account.Status == "Matured" ||
                                   (account.DurationMonths > 0 && account.TotalPaidInstallments >= account.DurationMonths) ||
                                   effClosureDate.Date >= account.MaturityDate.Date;

            decimal defaultCalculatedPayout = alreadyAccruedInt > 0
                ? (account.TotalDepositedAmount + alreadyAccruedInt)
                : (isTermCompleted && account.MaturityAmount > account.TotalDepositedAmount
                    ? account.MaturityAmount
                    : (account.TotalDepositedAmount + alreadyAccruedInt));

            var settlement = BuildSettlementBreakdown(
                account.TotalDepositedAmount,
                alreadyAccruedInt,
                defaultCalculatedPayout,
                customPayoutAmount);

            if (settlement.FinalPayout <= 0)
            {
                return new BadRequestObjectResult("परताव्याची रक्कम शून्य किंवा उणे असू शकत नाही.");
            }

            int userBranchId = currentUser.GetOperatingBranchId();
            int operatingBranchId = userBranchId > 0 ? userBranchId : (account.BranchID > 0 ? account.BranchID : 1);
            int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;
            bool isCrossBranchTxn = operatingBranchId != homeBranchId;
            int createdByUserId = currentUser.GetUserId();
            if (createdByUserId <= 0) createdByUserId = 1;

            var payoutCheck = await ResolveRdClosurePayoutAsync(context, operatingBranchId, paymentMode, bankLedgerId, savingAccountId);
            if (!payoutCheck.IsValid || payoutCheck.PayoutLedger == null)
            {
                return new BadRequestObjectResult(payoutCheck.ErrorMessage ?? "पेमेंट लेजर सापडले नाही.");
            }

            using var transaction = await context.Database.BeginTransactionAsync();
            try
            {
                account.Status = "Closed";
                account.ClosureDate = effClosureDate;
                account.ClosureType = "MaturityClose";
                account.ClosedPayoutAmount = settlement.FinalPayout;
                account.ModifiedBy = createdByUserId;
                account.ModifiedDate = DateTime.UtcNow;
                await context.SaveChangesAsync();

                var linkedMember = await context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                int? linkedMemberId = linkedMember?.MemberID;
                string auditSuffix = BuildSettlementAuditSuffix(settlement, remarks);
                int finalVoucherId;

                var (vStatus, appBy, appOn) = await ApprovalPolicyHelper.DetermineVoucherStatusAsync(
                    context,
                    settlement.HomeVoucherTotal,
                    createdByUserId);

                if (!isCrossBranchTxn)
                {
                    int? scrollNo = await ResolveNextScrollNoIfApprovedAsync(context, vStatus, homeBranchId, effClosureDate);
                    string vNo = $"JV-RD-CLOSE-{account.AccountNo}";
                    var voucher = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = vNo,
                        VoucherDate = effClosureDate,
                        VoucherType = payoutCheck.VoucherType,
                        Status = vStatus,
                        ApprovedBy = appBy,
                        ApprovedOn = appOn,
                        ScrollNo = scrollNo,
                        TotalAmount = settlement.HomeVoucherTotal,
                        Narration = $"आरडी मुदतपूर्ती पेआउट ({payoutCheck.ModeLabel}): {account.AccountNo}{auditSuffix}",
                        CreatedBy = createdByUserId,
                        CreatedOn = DateTime.Now
                    };
                    context.Vouchers.Add(voucher);
                    await context.SaveChangesAsync();

                    ApplyRdClosureSavingCredit(
                        context,
                        payoutCheck.TargetSavingAccount,
                        settlement.FinalPayout,
                        effClosureDate,
                        homeBranchId,
                        vNo,
                        $"आरडी मुदतपूर्ती परतावा जमा (RD A/C: {account.AccountNo})",
                        createdByUserId);

                    await AddBalancedHomeSideLinesAsync(
                        context,
                        voucher.VoucherID,
                        account,
                        settlement,
                        payoutCheck.PayoutLedger.LedgerID,
                        linkedMemberId);

                    await context.SaveChangesAsync();
                    finalVoucherId = voucher.VoucherID;
                }
                else
                {
                    int ibtLedgerId = await IbtLedgerHelper.GetIbtLedgerIdAsync(context, operatingBranchId, homeBranchId);
                    int? counterScrollNo = await ResolveNextScrollNoIfApprovedAsync(context, vStatus, operatingBranchId, effClosureDate);
                    string counterVNo = $"PV-{operatingBranchId}-{effClosureDate:yyyyMMdd}-RD-CLOSE-{account.AccountNo}";

                    var counterVoucher = new Voucher
                    {
                        BranchID = operatingBranchId,
                        VoucherNo = counterVNo,
                        VoucherDate = effClosureDate,
                        VoucherType = payoutCheck.VoucherType,
                        Status = vStatus,
                        ApprovedBy = appBy,
                        ApprovedOn = appOn,
                        ScrollNo = counterScrollNo,
                        TotalAmount = settlement.FinalPayout,
                        Narration = $"[आंतर-शाखा आरडी मुदतपूर्ती परतावा] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) साठी परतावा अदा ({payoutCheck.ModeLabel}){auditSuffix}",
                        CreatedBy = createdByUserId,
                        CreatedOn = DateTime.Now,
                        IsIbtVoucher = true,
                        TargetBranchID = homeBranchId
                    };
                    context.Vouchers.Add(counterVoucher);
                    await context.SaveChangesAsync();

                    context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = counterVoucher.VoucherID,
                        LedgerID = ibtLedgerId,
                        DrCr = "Dr",
                        Amount = settlement.FinalPayout,
                        CustomerID = account.CustomerID,
                        MemberID = linkedMemberId
                    });

                    ApplyRdClosureSavingCredit(
                        context,
                        payoutCheck.TargetSavingAccount,
                        settlement.FinalPayout,
                        effClosureDate,
                        operatingBranchId,
                        counterVNo,
                        $"आरडी मुदतपूर्ती परतावा जमा (RD A/C: {account.AccountNo})",
                        createdByUserId);

                    context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = counterVoucher.VoucherID,
                        LedgerID = payoutCheck.PayoutLedger.LedgerID,
                        DrCr = "Cr",
                        Amount = settlement.FinalPayout,
                        CustomerID = account.CustomerID,
                        MemberID = linkedMemberId
                    });

                    int? homeScrollNo = await ResolveNextScrollNoIfApprovedAsync(context, vStatus, homeBranchId, effClosureDate);
                    var homeVoucher = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = $"JV-RD-CLOSE-{account.AccountNo}",
                        VoucherDate = effClosureDate,
                        VoucherType = "Journal",
                        Status = vStatus,
                        ApprovedBy = appBy,
                        ApprovedOn = appOn,
                        ScrollNo = homeScrollNo,
                        TotalAmount = settlement.HomeVoucherTotal,
                        Narration = $"[आंतर-शाखा आरडी मुदतपूर्ती क्लोजर] काऊंटर शाखा #{operatingBranchId} वरून परतावा अदा (खाते: {account.AccountNo}){auditSuffix}",
                        CreatedBy = createdByUserId,
                        CreatedOn = DateTime.Now,
                        IsIbtVoucher = true,
                        TargetBranchID = operatingBranchId,
                        RelatedVoucherID = counterVoucher.VoucherID
                    };
                    context.Vouchers.Add(homeVoucher);
                    await context.SaveChangesAsync();

                    counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                    await AddBalancedHomeSideLinesAsync(
                        context,
                        homeVoucher.VoucherID,
                        account,
                        settlement,
                        ibtLedgerId,
                        linkedMemberId);

                    await context.SaveChangesAsync();
                    finalVoucherId = counterVoucher.VoucherID;
                }

                await RecordZeroBalanceClosureRdTransactionsAsync(
                    context,
                    account,
                    settlement,
                    isCrossBranchTxn ? operatingBranchId : homeBranchId,
                    finalVoucherId,
                    effClosureDate,
                    "Payout",
                    $"आरडी मुदतपूर्ती खाते बंद परतावा ({payoutCheck.ModeLabel}){auditSuffix}",
                    createdByUserId);

                await context.SaveChangesAsync();
                await transaction.CommitAsync();

                return new OkObjectResult(new
                {
                    message = $"आरडी मुदतपूर्ती खाते यशस्वीरित्या बंद करण्यात आले! अंतिम परतावा: ₹{settlement.FinalPayout:N2}",
                    voucherId = finalVoucherId,
                    netPayout = settlement.FinalPayout,
                    effectiveInterest = settlement.EffectiveInterest,
                    penaltyDeduction = settlement.PrincipalPenalty,
                    clawback = settlement.ClawbackExpenseCredit
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return new BadRequestObjectResult("मुदतपूर्ती खाते बंद करताना त्रुटी आली: " + ex.Message);
            }
        }

        public static async Task<IActionResult> ExecutePrematureCloseAsync(
            AppDbContext context,
            ClaimsPrincipal currentUser,
            int id,
            DateTime closureDate,
            decimal? customPrematureRate,
            string paymentMode,
            int? bankLedgerId,
            int? savingAccountId,
            decimal? customPayoutAmount,
            string? remarks)
        {
            var account = await context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (account == null || account.Status == "Closed")
            {
                return new BadRequestObjectResult("आरडी खाते सापडले नाही किंवा आधीच बंद झालेले आहे.");
            }

            if (account.IsLienMarked)
            {
                return new BadRequestObjectResult($"या आरडी खात्यावर कर्जाचे तारण (Lien: {account.LienLoanAccountNo ?? "सक्रिय कर्ज"}) नोंदवलेले असल्यामुळे तारण मुक्त झाल्याशिवाय खाते बंद करता येणार नाही.");
            }

            DateTime effClosureDate = closureDate.Date;
            var closedFy = await context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && effClosureDate >= fy.StartDate.Date && effClosureDate <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return new BadRequestObjectResult($"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडत असल्याने या तारखेवर खाते बंद करता येत नाही.");
            }

            if (customPayoutAmount.HasValue && customPayoutAmount.Value <= 0)
            {
                return new BadRequestObjectResult("अंतिम देय परताव्याची रक्कम शून्य किंवा उणे असू शकत नाही.");
            }

            int actualMonths = ((effClosureDate.Year - account.OpeningDate.Year) * 12) + effClosureDate.Month - account.OpeningDate.Month;
            if (actualMonths <= 0) actualMonths = 1;

            decimal penaltyRate = account.RdScheme?.PrematurePenaltyRate ?? 1.00m;
            decimal prematureRate = customPrematureRate ?? (account.InterestRate - penaltyRate);
            if (prematureRate < 0) prematureRate = 0;

            double r = (double)prematureRate;
            double p = (double)account.InstallmentAmount;
            int n = actualMonths;
            double totalPrematureMat = 0;
            for (int k = 1; k <= n; k++)
            {
                int monthsInBank = n - k + 1;
                double factor = Math.Pow(1.0 + (r / 400.0), monthsInBank / 3.0);
                totalPrematureMat += p * factor;
            }
            decimal totalDepositSoFar = account.InstallmentAmount * actualMonths;
            decimal recalculatedInterest = Math.Max(0m, Math.Round((decimal)totalPrematureMat - totalDepositSoFar));

            var (alreadyAccruedInt, _) = await ComputeRdAccrualStateAsync(context, account);
            decimal calculatedPayout = account.TotalDepositedAmount + recalculatedInterest;

            var settlement = BuildSettlementBreakdown(
                account.TotalDepositedAmount,
                alreadyAccruedInt,
                calculatedPayout,
                customPayoutAmount);

            if (settlement.FinalPayout <= 0)
            {
                return new BadRequestObjectResult("परताव्याची रक्कम शून्य किंवा उणे असू शकत नाही.");
            }

            int userBranchId = currentUser.GetOperatingBranchId();
            int operatingBranchId = userBranchId > 0 ? userBranchId : (account.BranchID > 0 ? account.BranchID : 1);
            int homeBranchId = account.BranchID > 0 ? account.BranchID : 1;
            bool isCrossBranchTxn = operatingBranchId != homeBranchId;
            int createdByUserId = currentUser.GetUserId();
            if (createdByUserId <= 0) createdByUserId = 1;

            var payoutCheck = await ResolveRdClosurePayoutAsync(context, operatingBranchId, paymentMode, bankLedgerId, savingAccountId);
            if (!payoutCheck.IsValid || payoutCheck.PayoutLedger == null)
            {
                return new BadRequestObjectResult(payoutCheck.ErrorMessage ?? "पेमेंट लेजर सापडले नाही.");
            }

            using var transaction = await context.Database.BeginTransactionAsync();
            try
            {
                account.Status = "Closed";
                account.ClosureDate = effClosureDate;
                account.ClosureType = "PrematureClose";
                account.ClosedPayoutAmount = settlement.FinalPayout;
                account.ModifiedBy = createdByUserId;
                account.ModifiedDate = DateTime.UtcNow;
                await context.SaveChangesAsync();

                var linkedMember = await context.Members.FirstOrDefaultAsync(m => m.CustomerID == account.CustomerID);
                int? linkedMemberId = linkedMember?.MemberID;
                string auditSuffix = BuildSettlementAuditSuffix(settlement, remarks);
                int finalVoucherId;

                var (vStatus, appBy, appOn) = await ApprovalPolicyHelper.DetermineVoucherStatusAsync(
                    context,
                    settlement.HomeVoucherTotal,
                    createdByUserId);

                if (!isCrossBranchTxn)
                {
                    int? scrollNo = await ResolveNextScrollNoIfApprovedAsync(context, vStatus, homeBranchId, effClosureDate);
                    string vNo = $"JV-RD-PRECLOSE-{account.AccountNo}";
                    var voucher = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = vNo,
                        VoucherDate = effClosureDate,
                        VoucherType = payoutCheck.VoucherType,
                        Status = vStatus,
                        ApprovedBy = appBy,
                        ApprovedOn = appOn,
                        ScrollNo = scrollNo,
                        TotalAmount = settlement.HomeVoucherTotal,
                        Narration = $"आरडी मुदतपूर्व बंद ({payoutCheck.ModeLabel}) - दर: {prematureRate}%: {account.AccountNo}{auditSuffix}",
                        CreatedBy = createdByUserId,
                        CreatedOn = DateTime.Now
                    };
                    context.Vouchers.Add(voucher);
                    await context.SaveChangesAsync();

                    ApplyRdClosureSavingCredit(
                        context,
                        payoutCheck.TargetSavingAccount,
                        settlement.FinalPayout,
                        effClosureDate,
                        homeBranchId,
                        vNo,
                        $"आरडी मुदतपूर्व बंद परतावा जमा (RD A/C: {account.AccountNo})",
                        createdByUserId);

                    await AddBalancedHomeSideLinesAsync(
                        context,
                        voucher.VoucherID,
                        account,
                        settlement,
                        payoutCheck.PayoutLedger.LedgerID,
                        linkedMemberId);

                    await context.SaveChangesAsync();
                    finalVoucherId = voucher.VoucherID;
                }
                else
                {
                    int ibtLedgerId = await IbtLedgerHelper.GetIbtLedgerIdAsync(context, operatingBranchId, homeBranchId);
                    int? counterScrollNo = await ResolveNextScrollNoIfApprovedAsync(context, vStatus, operatingBranchId, effClosureDate);
                    string counterVNo = $"PV-{operatingBranchId}-{effClosureDate:yyyyMMdd}-RD-PRECLOSE-{account.AccountNo}";

                    var counterVoucher = new Voucher
                    {
                        BranchID = operatingBranchId,
                        VoucherNo = counterVNo,
                        VoucherDate = effClosureDate,
                        VoucherType = payoutCheck.VoucherType,
                        Status = vStatus,
                        ApprovedBy = appBy,
                        ApprovedOn = appOn,
                        ScrollNo = counterScrollNo,
                        TotalAmount = settlement.FinalPayout,
                        Narration = $"[आंतर-शाखा आरडी मुदतपूर्व परतावा] खाते: {account.AccountNo} (मूळ शाखा #{homeBranchId}) साठी परतावा अदा ({payoutCheck.ModeLabel}) - दर: {prematureRate}%{auditSuffix}",
                        CreatedBy = createdByUserId,
                        CreatedOn = DateTime.Now,
                        IsIbtVoucher = true,
                        TargetBranchID = homeBranchId
                    };
                    context.Vouchers.Add(counterVoucher);
                    await context.SaveChangesAsync();

                    context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = counterVoucher.VoucherID,
                        LedgerID = ibtLedgerId,
                        DrCr = "Dr",
                        Amount = settlement.FinalPayout,
                        CustomerID = account.CustomerID,
                        MemberID = linkedMemberId
                    });

                    ApplyRdClosureSavingCredit(
                        context,
                        payoutCheck.TargetSavingAccount,
                        settlement.FinalPayout,
                        effClosureDate,
                        operatingBranchId,
                        counterVNo,
                        $"आरडी मुदतपूर्व बंद परतावा जमा (RD A/C: {account.AccountNo})",
                        createdByUserId);

                    context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = counterVoucher.VoucherID,
                        LedgerID = payoutCheck.PayoutLedger.LedgerID,
                        DrCr = "Cr",
                        Amount = settlement.FinalPayout,
                        CustomerID = account.CustomerID,
                        MemberID = linkedMemberId
                    });

                    int? homeScrollNo = await ResolveNextScrollNoIfApprovedAsync(context, vStatus, homeBranchId, effClosureDate);
                    var homeVoucher = new Voucher
                    {
                        BranchID = homeBranchId,
                        VoucherNo = $"JV-RD-PRECLOSE-{account.AccountNo}",
                        VoucherDate = effClosureDate,
                        VoucherType = "Journal",
                        Status = vStatus,
                        ApprovedBy = appBy,
                        ApprovedOn = appOn,
                        ScrollNo = homeScrollNo,
                        TotalAmount = settlement.HomeVoucherTotal,
                        Narration = $"[आंतर-शाखा आरडी मुदतपूर्व क्लोजर] काऊंटर शाखा #{operatingBranchId} वरून परतावा अदा (खाते: {account.AccountNo}) - दर: {prematureRate}%{auditSuffix}",
                        CreatedBy = createdByUserId,
                        CreatedOn = DateTime.Now,
                        IsIbtVoucher = true,
                        TargetBranchID = operatingBranchId,
                        RelatedVoucherID = counterVoucher.VoucherID
                    };
                    context.Vouchers.Add(homeVoucher);
                    await context.SaveChangesAsync();

                    counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;

                    await AddBalancedHomeSideLinesAsync(
                        context,
                        homeVoucher.VoucherID,
                        account,
                        settlement,
                        ibtLedgerId,
                        linkedMemberId);

                    await context.SaveChangesAsync();
                    finalVoucherId = counterVoucher.VoucherID;
                }

                await RecordZeroBalanceClosureRdTransactionsAsync(
                    context,
                    account,
                    settlement,
                    isCrossBranchTxn ? operatingBranchId : homeBranchId,
                    finalVoucherId,
                    effClosureDate,
                    "Premature_Close",
                    $"आरडी मुदतपूर्व खाते बंद परतावा ({payoutCheck.ModeLabel}){auditSuffix}",
                    createdByUserId);

                await context.SaveChangesAsync();
                await transaction.CommitAsync();

                return new OkObjectResult(new
                {
                    Message = $"आरडी मुदतपूर्व खाते यशस्वीरित्या बंद करण्यात आले! अंतिम परतावा: ₹{settlement.FinalPayout:N2}",
                    message = $"आरडी मुदतपूर्व खाते यशस्वीरित्या बंद करण्यात आले! अंतिम परतावा: ₹{settlement.FinalPayout:N2}",
                    VoucherId = finalVoucherId,
                    RecalcInt = settlement.EffectiveInterest,
                    PenaltyDeduction = settlement.PrincipalPenalty,
                    Clawback = settlement.ClawbackExpenseCredit,
                    NetPayout = settlement.FinalPayout
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return new BadRequestObjectResult("मुदतपूर्व खाते बंद करताना त्रुटी आली: " + ex.Message);
            }
        }

        public static async Task<IActionResult> ExecuteRenewAsync(
            AppDbContext context,
            ClaimsPrincipal currentUser,
            int id,
            int targetSchemeId,
            DateTime? closureDate,
            decimal? customPayoutAmount,
            string? remarks)
        {
            var oldAccount = await context.RdAccounts
                .Include(a => a.RdScheme)
                .FirstOrDefaultAsync(a => a.RdAccountID == id);

            if (oldAccount == null || oldAccount.Status == "Closed")
            {
                return new BadRequestObjectResult("आरडी खाते सापडले नाही किंवा आधीच बंद झालेले आहे.");
            }

            if (oldAccount.IsLienMarked)
            {
                return new BadRequestObjectResult($"या आरडी खात्यावर कर्जाचे तारण (Lien: {oldAccount.LienLoanAccountNo ?? "सक्रिय कर्ज"}) नोंदवलेले असल्यामुळे तारण मुक्त झाल्याशिवाय नूतनीकरण करता येणार नाही.");
            }

            var fdScheme = await context.FdSchemes.FindAsync(targetSchemeId);
            if (fdScheme == null)
            {
                return new BadRequestObjectResult("नूतनीकरणासाठी निवडलेली मुदत ठेव योजना वैध नाही.");
            }

            DateTime effClosureDate = closureDate?.Date ?? DateTime.Today;
            var closedFy = await context.FinancialYears
                .FirstOrDefaultAsync(fy => fy.IsClosed && effClosureDate >= fy.StartDate.Date && effClosureDate <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return new BadRequestObjectResult($"निवडलेली तारीख बंद झालेल्या आर्थिक वर्षात ({closedFy.YearCode}) मोडत असल्याने या तारखेवर नूतनीकरण करता येत नाही.");
            }

            if (customPayoutAmount.HasValue && customPayoutAmount.Value <= 0)
            {
                return new BadRequestObjectResult("नूतनीकरण वर्ग रक्कम शून्य किंवा उणे असू शकत नाही.");
            }

            var (alreadyAccruedInt, _) = await ComputeRdAccrualStateAsync(context, oldAccount);
            bool isTermCompleted = oldAccount.Status == "Matured" ||
                                   (oldAccount.DurationMonths > 0 && oldAccount.TotalPaidInstallments >= oldAccount.DurationMonths) ||
                                   effClosureDate >= oldAccount.MaturityDate.Date;

            decimal defaultRenewalAmount = alreadyAccruedInt > 0
                ? (oldAccount.TotalDepositedAmount + alreadyAccruedInt)
                : (isTermCompleted && oldAccount.MaturityAmount > oldAccount.TotalDepositedAmount
                    ? oldAccount.MaturityAmount
                    : (oldAccount.TotalDepositedAmount + alreadyAccruedInt));

            var settlement = BuildSettlementBreakdown(
                oldAccount.TotalDepositedAmount,
                alreadyAccruedInt,
                defaultRenewalAmount,
                customPayoutAmount);

            if (settlement.FinalPayout <= 0)
            {
                return new BadRequestObjectResult("नूतनीकरण वर्ग रक्कम शून्य किंवा उणे असू शकत नाही.");
            }

            int createdByUserId = currentUser.GetUserId();
            if (createdByUserId <= 0) createdByUserId = 1;

            using var transaction = await context.Database.BeginTransactionAsync();
            try
            {
                int resolvedCustId = oldAccount.CustomerID;
                if (resolvedCustId <= 0)
                {
                    return new BadRequestObjectResult("आरडी खातेदाराचा वैध ग्राहक (Customer / CIF) सापडला नाही.");
                }

                var linkedMember = await context.Members.FirstOrDefaultAsync(m => m.CustomerID == resolvedCustId);
                int? linkedMemberId = linkedMember?.MemberID;

                oldAccount.Status = "Closed";
                oldAccount.ClosureDate = effClosureDate;
                oldAccount.ClosureType = "Renewal";
                oldAccount.ClosedPayoutAmount = settlement.FinalPayout;
                oldAccount.ModifiedBy = createdByUserId;
                oldAccount.ModifiedDate = DateTime.UtcNow;
                await context.SaveChangesAsync();

                Ledger? fdLiabilityLedger = null;
                if (fdScheme.FdLiabilityLedgerID.HasValue)
                {
                    fdLiabilityLedger = await context.Ledgers.FindAsync(fdScheme.FdLiabilityLedgerID.Value);
                }
                if (fdLiabilityLedger == null)
                {
                    fdLiabilityLedger = await context.Ledgers.FirstOrDefaultAsync(l =>
                            l.LedgerName.Contains("मुदत ठेव") || l.LedgerName.ToLower().Contains("fixed deposit"))
                        ?? await GetOrCreateLedgerAsync(context, "१२ मुदत ठेव", "ठेवी", "Cr");
                }

                var branch = await context.Branches.FindAsync(oldAccount.BranchID);
                string branchPrefix = branch != null && !string.IsNullOrWhiteSpace(branch.BranchCode) ? branch.BranchCode : "BR";

                var seq = await context.FdAccountSequences
                    .FirstOrDefaultAsync(s => s.BranchID == oldAccount.BranchID && s.ProductType == "FD");

                if (seq == null)
                {
                    seq = new FdAccountSequence { BranchID = oldAccount.BranchID, ProductType = "FD", CurrentValue = 0 };
                    context.FdAccountSequences.Add(seq);
                }
                seq.CurrentValue += 1;
                await context.SaveChangesAsync();

                DateTime newOpeningDate = effClosureDate;
                var matchingFy = await context.FinancialYears
                    .FirstOrDefaultAsync(fy => newOpeningDate >= fy.StartDate.Date && newOpeningDate <= fy.EndDate.Date);

                int targetFinancialYearId = matchingFy?.FinancialYearID
                    ?? (await context.FinancialYears.FirstOrDefaultAsync(fy => fy.IsActive))?.FinancialYearID
                    ?? (oldAccount.FinancialYearID > 0 ? oldAccount.FinancialYearID : 1);

                string auditSuffix = BuildSettlementAuditSuffix(settlement, remarks);

                var newFd = new FdAccount
                {
                    InstitutionID = oldAccount.InstitutionID,
                    BranchID = oldAccount.BranchID,
                    FinancialYearID = targetFinancialYearId,
                    CustomerID = resolvedCustId,
                    FdSchemeID = targetSchemeId,
                    AccountNo = $"{branchPrefix}-{oldAccount.BranchID:D3}-FD-{seq.CurrentValue:D6}",
                    OpeningDate = newOpeningDate,
                    DepositAmount = settlement.FinalPayout,
                    InterestRate = fdScheme.InterestRate,
                    MaturityDate = newOpeningDate.AddMonths(fdScheme.DurationMonths),
                    Status = "Active",
                    NomineeName = oldAccount.NomineeName,
                    NomineeRelation = oldAccount.NomineeRelation,
                    Remarks = $"आरडी नूतनीकरण (Renewed from RD): {oldAccount.AccountNo}{auditSuffix}"
                };

                decimal p = settlement.FinalPayout;
                decimal r = fdScheme.InterestRate;
                decimal t = (decimal)fdScheme.DurationMonths / 12.0m;

                if (fdScheme.InterestType == "Cumulative")
                {
                    newFd.MaturityAmount = Math.Round(p * (decimal)Math.Pow((double)(1 + (r / 400m)), (double)(t * 4)), 2);
                }
                else
                {
                    newFd.MaturityAmount = Math.Round(p + (p * r * t / 100m), 2);
                }

                context.FdAccounts.Add(newFd);
                await context.SaveChangesAsync();

                var (vStatus, appBy, appOn) = await ApprovalPolicyHelper.DetermineVoucherStatusAsync(
                    context,
                    settlement.HomeVoucherTotal,
                    createdByUserId);
                int? scrollNo = await ResolveNextScrollNoIfApprovedAsync(context, vStatus, oldAccount.BranchID, effClosureDate);

                var voucher = new Voucher
                {
                    BranchID = oldAccount.BranchID,
                    VoucherNo = $"JV-RD-REN-{newFd.AccountNo}",
                    VoucherDate = effClosureDate,
                    VoucherType = "Journal",
                    Status = vStatus,
                    ApprovedBy = appBy,
                    ApprovedOn = appOn,
                    ScrollNo = scrollNo,
                    TotalAmount = settlement.HomeVoucherTotal,
                    Narration = $"आरडी मुदतपूर्ती रक्कम एफडी खात्यावर नूतनीकरण केली: {oldAccount.AccountNo} -> {newFd.AccountNo}{auditSuffix}",
                    CreatedBy = createdByUserId,
                    CreatedOn = DateTime.Now
                };
                context.Vouchers.Add(voucher);
                await context.SaveChangesAsync();

                await AddBalancedHomeSideLinesAsync(
                    context,
                    voucher.VoucherID,
                    oldAccount,
                    settlement,
                    fdLiabilityLedger.LedgerID,
                    linkedMemberId);

                await RecordZeroBalanceClosureRdTransactionsAsync(
                    context,
                    oldAccount,
                    settlement,
                    oldAccount.BranchID,
                    voucher.VoucherID,
                    effClosureDate,
                    "Renewal",
                    $"आरडी खाते नूतनीकरण एफडी वर्ग ({newFd.AccountNo}){auditSuffix}",
                    createdByUserId);

                context.FdTransactions.Add(new FdTransaction
                {
                    BranchID = newFd.BranchID,
                    FdAccountID = newFd.FdAccountID,
                    VoucherID = voucher.VoucherID,
                    TransactionDate = effClosureDate,
                    TransactionType = "Opening",
                    DebitCredit = "Cr",
                    Amount = settlement.FinalPayout
                });

                await context.SaveChangesAsync();
                await transaction.CommitAsync();

                return new OkObjectResult(new
                {
                    Message = "RD renewed to FD successfully",
                    FdAccountNo = newFd.AccountNo,
                    fdAccountNo = newFd.AccountNo,
                    TransferredAmount = settlement.FinalPayout
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return new BadRequestObjectResult("आरडी नूतनीकरण करताना त्रुटी आली: " + ex.Message);
            }
        }

        public static async Task<IActionResult> GetClosureByVoucherAsync(AppDbContext context, int voucherId)
        {
            var voucher = await context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return new NotFoundObjectResult(new { message = $"व्हाउचर क्र. {voucherId} सिस्टीममध्ये सापडले नाही." });
            }

            var targetVoucherIds = new List<int> { voucherId };
            if (voucher.RelatedVoucherID.HasValue && voucher.RelatedVoucherID.Value > 0)
            {
                targetVoucherIds.Add(voucher.RelatedVoucherID.Value);
            }

            var tx = await context.RdTransactions
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.Customer)
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.RdScheme)
                .Include(t => t.RdAccount)
                    .ThenInclude(a => a!.Branch)
                .FirstOrDefaultAsync(t =>
                    targetVoucherIds.Contains(t.VoucherID) &&
                    (t.TransactionType == "Payout" || t.TransactionType == "Premature_Close" || t.TransactionType == "Renewal"));

            RdAccount? account = tx?.RdAccount;

            if (account == null)
            {
                string vNo = voucher.VoucherNo ?? "";
                string accNoCandidate = "";
                if (vNo.StartsWith("JV-RD-CLOSE-")) accNoCandidate = vNo.Substring("JV-RD-CLOSE-".Length).Trim();
                else if (vNo.StartsWith("JV-RD-PRECLOSE-")) accNoCandidate = vNo.Substring("JV-RD-PRECLOSE-".Length).Trim();
                else if (vNo.Contains("-RD-CLOSE-")) accNoCandidate = vNo.Substring(vNo.IndexOf("-RD-CLOSE-") + "-RD-CLOSE-".Length).Trim();
                else if (vNo.Contains("-RD-PRECLOSE-")) accNoCandidate = vNo.Substring(vNo.IndexOf("-RD-PRECLOSE-") + "-RD-PRECLOSE-".Length).Trim();

                if (!string.IsNullOrEmpty(accNoCandidate))
                {
                    account = await context.RdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.RdScheme)
                        .Include(a => a.Branch)
                        .FirstOrDefaultAsync(a => a.AccountNo == accNoCandidate);
                }
            }

            if (account == null)
            {
                var custId = voucher.VoucherDetails.FirstOrDefault(vd => vd.CustomerID.HasValue && vd.CustomerID.Value > 0)?.CustomerID;
                if (custId.HasValue)
                {
                    account = await context.RdAccounts
                        .Include(a => a.Customer)
                        .Include(a => a.RdScheme)
                        .Include(a => a.Branch)
                        .Where(a => a.CustomerID == custId.Value)
                        .OrderByDescending(a => a.RdAccountID)
                        .FirstOrDefaultAsync();
                }
            }

            if (account == null)
            {
                return new NotFoundObjectResult(new { message = $"सदर आरडी क्लोजरशी (ID: {voucherId}) संबंधित खाते सापडले नाही." });
            }

            string vNoUpper = (voucher.VoucherNo ?? "").ToUpperInvariant();
            string closureType = vNoUpper.Contains("REN") || tx?.TransactionType == "Renewal"
                ? "Renewal"
                : (vNoUpper.Contains("PRECLOSE") || tx?.TransactionType == "Premature_Close"
                    ? "PrematureClose"
                    : "MaturityClose");

            string closurePaymentMode = "Cash";
            int? closureBankLedgerId = null;
            int? closureSavingAccountId = null;
            decimal? detectedCreditPayout = null;

            var closureCreditDetail = voucher.VoucherDetails
                .FirstOrDefault(vd => vd.DrCr == "Cr" && vd.Ledger != null && BankLedgerHelper.IsBankAccountType(vd.Ledger.AccountType));
            if (closureCreditDetail != null)
            {
                closurePaymentMode = "Bank";
                closureBankLedgerId = closureCreditDetail.LedgerID;
                detectedCreditPayout = closureCreditDetail.Amount;
            }
            else
            {
                foreach (var crLine in voucher.VoucherDetails.Where(vd => vd.DrCr == "Cr"))
                {
                    if (await SavingLedgerHelper.IsConfiguredSavingLiabilityLedgerAsync(context, crLine.LedgerID))
                    {
                        closurePaymentMode = "Transfer";
                        detectedCreditPayout = crLine.Amount;
                        var sbTx = await context.SavingTransactions
                            .FirstOrDefaultAsync(st => st.VoucherNo == voucher.VoucherNo);
                        if (sbTx != null)
                        {
                            closureSavingAccountId = sbTx.SavingAccountID;
                        }
                        else
                        {
                            var sb = await context.SavingAccountMasters
                                .FirstOrDefaultAsync(s => s.CustomerID == account.CustomerID && s.Status == "Active");
                            closureSavingAccountId = sb?.SavingAccountID;
                        }
                        break;
                    }
                }
            }

            decimal resolvedPayoutAmount = account.ClosedPayoutAmount
                ?? (tx != null
                    ? (tx.PenaltyAmount > 0 && tx.InterestAmount == 0
                        ? tx.PrincipalAmount
                        : (tx.PrincipalAmount + tx.InterestAmount))
                    : (detectedCreditPayout ?? voucher.TotalAmount));

            decimal effectiveInterest = resolvedPayoutAmount >= account.TotalDepositedAmount
                ? (resolvedPayoutAmount - account.TotalDepositedAmount)
                : 0m;
            decimal penaltyDeduction = resolvedPayoutAmount < account.TotalDepositedAmount
                ? (account.TotalDepositedAmount - resolvedPayoutAmount)
                : 0m;

            string? renewedFdAccountNo = null;
            int? renewedFdSchemeId = null;
            if (closureType == "Renewal")
            {
                var fdTx = await context.FdTransactions
                    .Include(ft => ft.FdAccount)
                    .FirstOrDefaultAsync(ft => ft.VoucherID == voucher.VoucherID && ft.TransactionType == "Opening");
                if (fdTx?.FdAccount != null)
                {
                    renewedFdAccountNo = fdTx.FdAccount.AccountNo;
                    renewedFdSchemeId = fdTx.FdAccount.FdSchemeID;
                }
            }

            return new OkObjectResult(new
            {
                rdAccount = new
                {
                    account.RdAccountID,
                    account.BranchID,
                    BranchName = account.Branch?.BranchName ?? "",
                    account.CustomerID,
                    CustomerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.MiddleName} {account.Customer.LastName}".Replace("  ", " ").Trim() : "",
                    CIFNo = account.Customer?.CIFNo ?? "",
                    account.RdSchemeID,
                    SchemeName = account.RdScheme?.SchemeName ?? "",
                    PrematurePenaltyRate = account.RdScheme?.PrematurePenaltyRate ?? 1.00m,
                    account.AccountNo,
                    account.LegacyAccountNumber,
                    account.InstallmentAmount,
                    account.DurationMonths,
                    account.InterestRate,
                    account.TotalPaidInstallments,
                    account.TotalDepositedAmount,
                    account.LegacyAccruedInt,
                    account.OpeningDate,
                    account.MaturityDate,
                    account.MaturityAmount,
                    account.Status
                },
                closureDetails = new
                {
                    ClosureDate = tx?.TransactionDate ?? account.ClosureDate ?? voucher.VoucherDate,
                    ClosureType = closureType,
                    TotalPayoutAmount = resolvedPayoutAmount,
                    EffectiveInterest = effectiveInterest,
                    PenaltyDeduction = penaltyDeduction,
                    PaymentMode = closurePaymentMode,
                    BankLedgerID = closureBankLedgerId,
                    SavingAccountID = closureSavingAccountId,
                    TargetFdSchemeID = renewedFdSchemeId,
                    RenewedFdAccountNo = renewedFdAccountNo,
                    Narration = voucher.Narration
                },
                voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.TotalAmount,
                    voucher.Status,
                    voucher.Narration,
                    voucher.ApprovedBy,
                    voucher.ApprovedOn,
                    CanPass = voucher.Status == "Unapproved" || voucher.Status == "Draft" || voucher.Status == "Pending"
                }
            });
        }

        public static bool IsRdClosureOrRenewalVoucher(Voucher? voucher)
        {
            if (voucher == null) return false;
            string vNo = (voucher.VoucherNo ?? "").Trim().ToUpperInvariant();
            if (vNo.StartsWith("JV-RD-CLOSE-") ||
                vNo.StartsWith("JV-RD-PRECLOSE-") ||
                vNo.StartsWith("JV-RD-REN-") ||
                vNo.Contains("-RD-CLOSE-") ||
                vNo.Contains("-RD-PRECLOSE-"))
            {
                return true;
            }
            return false;
        }

        public static async Task<bool> RollbackRdClosureOrRenewalByVoucherAsync(
            AppDbContext context,
            Voucher voucher,
            string reason,
            int userId,
            string username)
        {
            int primaryId = voucher.VoucherID;
            var voucherIds = new List<int> { primaryId };
            var voucherNos = new List<string>();
            if (!string.IsNullOrWhiteSpace(voucher.VoucherNo))
            {
                voucherNos.Add(voucher.VoucherNo);
            }

            Voucher? siblingVoucher = null;
            if (voucher.RelatedVoucherID.HasValue && voucher.RelatedVoucherID.Value > 0)
            {
                siblingVoucher = await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .FirstOrDefaultAsync(v => v.VoucherID == voucher.RelatedVoucherID.Value);
                if (siblingVoucher != null)
                {
                    voucherIds.Add(siblingVoucher.VoucherID);
                    if (!string.IsNullOrWhiteSpace(siblingVoucher.VoucherNo))
                    {
                        voucherNos.Add(siblingVoucher.VoucherNo);
                    }
                }
            }

            var closureTxs = await context.RdTransactions
                .Where(rt => voucherIds.Contains(rt.VoucherID))
                .ToListAsync();

            bool matchesPrefix = IsRdClosureOrRenewalVoucher(voucher) ||
                                 (siblingVoucher != null && IsRdClosureOrRenewalVoucher(siblingVoucher));
            bool hasClosureTx = closureTxs.Any(t =>
                t.TransactionType == "Payout" ||
                t.TransactionType == "Premature_Close" ||
                t.TransactionType == "Renewal");

            if (!matchesPrefix && !hasClosureTx)
            {
                return false;
            }

            var affectedAccountIds = closureTxs.Select(t => t.RdAccountID).Distinct().ToList();

            if (!affectedAccountIds.Any())
            {
                foreach (var vNo in voucherNos)
                {
                    string cand = "";
                    if (vNo.StartsWith("JV-RD-CLOSE-")) cand = vNo.Substring("JV-RD-CLOSE-".Length).Trim();
                    else if (vNo.StartsWith("JV-RD-PRECLOSE-")) cand = vNo.Substring("JV-RD-PRECLOSE-".Length).Trim();
                    else if (vNo.Contains("-RD-CLOSE-")) cand = vNo.Substring(vNo.IndexOf("-RD-CLOSE-") + "-RD-CLOSE-".Length).Trim();
                    else if (vNo.Contains("-RD-PRECLOSE-")) cand = vNo.Substring(vNo.IndexOf("-RD-PRECLOSE-") + "-RD-PRECLOSE-".Length).Trim();

                    if (!string.IsNullOrEmpty(cand))
                    {
                        var acc = await context.RdAccounts.FirstOrDefaultAsync(a =>
                            a.AccountNo == cand ||
                            a.LegacyAccountNumber == cand);
                        if (acc != null && !affectedAccountIds.Contains(acc.RdAccountID))
                        {
                            affectedAccountIds.Add(acc.RdAccountID);
                        }
                    }
                }
            }

            // 1. Reverse any Saving Account transfer credit posted by this RD closure voucher
            if (voucherNos.Any())
            {
                var sbTxs = await context.SavingTransactions
                    .Where(st => st.VoucherNo != null && voucherNos.Contains(st.VoucherNo))
                    .ToListAsync();

                foreach (var sbTx in sbTxs)
                {
                    var sbAcc = await context.SavingAccountMasters.FindAsync(sbTx.SavingAccountID);
                    if (sbAcc != null)
                    {
                        if (sbTx.TransactionType == "Deposit")
                            sbAcc.CurrentBalance -= sbTx.Amount;
                        else if (sbTx.TransactionType == "Withdrawal")
                            sbAcc.CurrentBalance += sbTx.Amount;
                        context.Entry(sbAcc).State = EntityState.Modified;
                    }
                    var sbPassbooks = await context.SavingPassbooks.Where(p => p.TransactionID == sbTx.TransactionID).ToListAsync();
                    if (sbPassbooks.Any()) context.SavingPassbooks.RemoveRange(sbPassbooks);
                    context.SavingTransactions.Remove(sbTx);
                }
            }

            // 2. If RD Renewal (JV-RD-REN-*), clean up the newly opened FD account if untouched
            bool isRenewal = voucherNos.Any(v => v.StartsWith("JV-RD-REN-", StringComparison.OrdinalIgnoreCase)) ||
                             closureTxs.Any(t => t.TransactionType == "Renewal");
            if (isRenewal)
            {
                var fdOpenTxs = await context.FdTransactions
                    .Where(ft => voucherIds.Contains(ft.VoucherID) && ft.TransactionType == "Opening")
                    .ToListAsync();

                var newFdIds = fdOpenTxs.Select(ft => ft.FdAccountID).Distinct().ToList();
                foreach (var fdId in newFdIds)
                {
                    var newFd = await context.FdAccounts.FindAsync(fdId);
                    if (newFd != null)
                    {
                        bool hasSubsequentFdActivity = await context.FdTransactions
                            .AnyAsync(ft => ft.FdAccountID == fdId && !voucherIds.Contains(ft.VoucherID));
                        if (hasSubsequentFdActivity || newFd.IsLienMarked)
                        {
                            throw new InvalidOperationException($"नूतनीकरणातून तयार झालेल्या मुदत ठेव खात्यावर ({newFd.AccountNo}) पुढील व्यवहार किंवा तारण नोंदवले गेले असल्याने हे नूतनीकरण व्हाउचर थेट रद्द करता येणार नाही.");
                        }

                        var allFdTxs = await context.FdTransactions.Where(ft => ft.FdAccountID == fdId).ToListAsync();
                        if (allFdTxs.Any()) context.FdTransactions.RemoveRange(allFdTxs);
                        var allFdAccruals = await context.FdInterestAccruals.Where(fa => fa.FdAccountID == fdId).ToListAsync();
                        if (allFdAccruals.Any()) context.FdInterestAccruals.RemoveRange(allFdAccruals);
                        var allFdMis = await context.FdMisPayouts.Where(fm => fm.FdAccountID == fdId).ToListAsync();
                        if (allFdMis.Any()) context.FdMisPayouts.RemoveRange(allFdMis);
                        var allFdAuto = await context.FdAutoRenewalLogs.Where(fl => fl.NewFdAccountID == fdId).ToListAsync();
                        if (allFdAuto.Any()) context.FdAutoRenewalLogs.RemoveRange(allFdAuto);
                        int fdBranchId = newFd.BranchID;
                        context.FdAccounts.Remove(newFd);
                        await context.SaveChangesAsync();
                        await FdRenewalRollbackHelper.SyncBranchFdSequenceAsync(context, fdBranchId);
                    }
                }
            }

            // 3. Remove closure/adjustment RdTransactions linked to this voucher
            if (closureTxs.Any())
            {
                context.RdTransactions.RemoveRange(closureTxs);
            }

            // 4. Restore RdAccount Status & clear closure metadata
            foreach (var rdId in affectedAccountIds)
            {
                var rdAcc = await context.RdAccounts.FindAsync(rdId);
                if (rdAcc != null)
                {
                    bool isMaturedNow = (rdAcc.DurationMonths > 0 && rdAcc.TotalPaidInstallments >= rdAcc.DurationMonths) ||
                                        rdAcc.MaturityDate.Date <= DateTime.Today.Date;
                    rdAcc.Status = isMaturedNow ? "Matured" : "Active";
                    rdAcc.ClosureDate = null;
                    rdAcc.ClosureType = null;
                    rdAcc.ClosedPayoutAmount = null;
                    rdAcc.ModifiedDate = DateTime.UtcNow;
                    context.Entry(rdAcc).State = EntityState.Modified;

                    context.AuditLogs.Add(new AuditLog
                    {
                        UserID = userId > 0 ? userId : null,
                        Username = !string.IsNullOrWhiteSpace(username) ? username : $"User-{userId}",
                        Action = "RD_CLOSURE_VOUCHER_REVERTED",
                        EntityName = "RdAccount",
                        EntityID = rdAcc.AccountNo,
                        Details = $"आरडी खाते बंद/नूतनीकरण व्हाउचर {voucher.VoucherNo} रद्द/डिलीट केल्यामुळे आरडी खाते {rdAcc.AccountNo} पुन्हा '{rdAcc.Status}' स्थितीत पूर्ववत केले. कारण: {reason}",
                        Timestamp = DateTime.Now,
                        Status = "Success"
                    });
                }
            }

            // 5. If Cross-Branch IBT sibling voucher exists, unlink and remove sibling voucher as well
            if (siblingVoucher == null)
            {
                siblingVoucher = await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .FirstOrDefaultAsync(v => v.RelatedVoucherID == voucher.VoucherID);
            }
            if (siblingVoucher != null)
            {
                voucher.RelatedVoucherID = null;
                siblingVoucher.RelatedVoucherID = null;
                await context.SaveChangesAsync();
                if (siblingVoucher.VoucherDetails != null && siblingVoucher.VoucherDetails.Any())
                {
                    context.VoucherDetails.RemoveRange(siblingVoucher.VoucherDetails);
                }
                context.Vouchers.Remove(siblingVoucher);
            }

            return true;
        }
    }
}

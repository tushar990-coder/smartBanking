using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public sealed class FdOpeningBalanceSyncResult
    {
        public bool Success { get; init; } = true;
        public string Message { get; init; } = string.Empty;
        public int TotalLegacyAccounts { get; init; }
        public decimal TotalDepositsSynced { get; init; }
        public decimal TotalCapitalizedInterestSynced { get; init; }
        public decimal TotalAccruedProvisionSynced { get; init; }
        public decimal TotalAccruedSynced => TotalCapitalizedInterestSynced + TotalAccruedProvisionSynced;
        public List<object> AffectedLedgers { get; init; } = new();
    }

    /// <summary>
    /// Single Source of Truth for synchronizing Legacy FD Opening Balances (Principal + 31/03 Cutoff Accrued Interest)
    /// into CustomerOpeningBalances, MemberOpeningBalances, and BranchLedgerOpeningBalances:
    /// - "On Interest" (व्याजावर व्याज चक्रवाढ): DepositAmount + LegacyAccruedInt -> FdLiabilityLedgerID (ठेवी), Provision = ₹0.
    /// - "On Principal" / "Monthly Payout" (मूळ मुद्दलावर साधे व्याज): DepositAmount -> FdLiabilityLedgerID, LegacyAccruedInt -> InterestPayableLedgerID (देणे व्याज तरतूद).
    /// </summary>
    public static class FdOpeningBalanceSyncHelper
    {
        public static bool IsCompoundCapitalizedScheme(FdScheme? scheme)
        {
            if (scheme == null) return false;
            return string.Equals(scheme.InterestPostingMethod?.Trim(), "On Interest", StringComparison.OrdinalIgnoreCase);
        }

        public static bool IsCompoundCapitalizedMethod(string? interestPostingMethod)
        {
            return string.Equals(interestPostingMethod?.Trim(), "On Interest", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Checks whether changing a scheme's InterestPostingMethod ("On Principal" ⇄ "On Interest")
        /// conflicts with any LegacyAccruedInt > 0 FD accounts that already have post-migration Closure/Renewal
        /// or live Interest Accrual vouchers.
        /// </summary>
        public static async Task<string?> ValidateSchemePostingMethodChangeSafetyAsync(
            AppDbContext context,
            int fdSchemeId,
            string? oldMethod,
            string? newMethod)
        {
            bool wasCompound = IsCompoundCapitalizedMethod(oldMethod);
            bool willBeCompound = IsCompoundCapitalizedMethod(newMethod);
            if (wasCompound == willBeCompound)
            {
                return null;
            }

            var legacyWithInt = await context.FdAccounts
                .AsNoTracking()
                .Where(a => a.FdSchemeID == fdSchemeId && a.IsLegacyAccount && a.LegacyAccruedInt > 0m)
                .Select(a => new { a.FdAccountID, a.AccountNo, a.ReceiptNo, a.LegacyAccountNumber, a.Status })
                .ToListAsync();

            if (legacyWithInt.Count == 0)
            {
                return null;
            }

            var closedOrRenewed = legacyWithInt
                .FirstOrDefault(a => !string.Equals(a.Status, "Active", StringComparison.OrdinalIgnoreCase) &&
                                     !string.Equals(a.Status, "Matured", StringComparison.OrdinalIgnoreCase));
            if (closedOrRenewed != null)
            {
                string dispNo = !string.IsNullOrWhiteSpace(closedOrRenewed.LegacyAccountNumber)
                    ? closedOrRenewed.LegacyAccountNumber
                    : (closedOrRenewed.ReceiptNo ?? closedOrRenewed.AccountNo);
                return $"या योजनेतील जुनी मुदत ठेव पावती क्र. '{dispNo}' ({closedOrRenewed.AccountNo}) सध्या '{closedOrRenewed.Status}' स्थितीत आहे (मोडणी/नूतनीकरण झाले आहे). पास झालेल्या क्लोजर व्हाउचरशी ताळेबंदाची तफावत येऊ नये म्हणून या योजनेची 'व्याज मोजणी पद्धत' बदलण्यापूर्वी संबंधित क्लोजर व्यवहार रिव्हर्स करा किंवा नवीन योजना तयार करा.";
            }

            var legacyIds = legacyWithInt.Select(x => x.FdAccountID).ToList();
            var postedAccrualAccId = await context.FdInterestAccruals
                .AsNoTracking()
                .Where(ia => legacyIds.Contains(ia.FdAccountID) && ia.IsPosted && ia.VoucherID > 0)
                .Select(ia => (int?)ia.FdAccountID)
                .FirstOrDefaultAsync();

            if (postedAccrualAccId.HasValue)
            {
                var matched = legacyWithInt.First(x => x.FdAccountID == postedAccrualAccId.Value);
                string dispNo = !string.IsNullOrWhiteSpace(matched.LegacyAccountNumber)
                    ? matched.LegacyAccountNumber
                    : (matched.ReceiptNo ?? matched.AccountNo);
                return $"या योजनेतील पावती क्र. '{dispNo}' वर चालू आर्थिक वर्षात व्याज तरतूद व्हाउचर पोस्ट झालेले आहे. कृपया आधी ते व्हाउचर रिव्हर्स करा आणि मगच 'व्याज मोजणी पद्धत' बदला.";
            }

            return null;
        }

        /// <summary>
        /// Updates JV-FD-OP-* opening vouchers and FdTransactions for all active/matured legacy accounts
        /// under a scheme when its InterestPostingMethod or mapped GL ledgers change.
        /// </summary>
        public static async Task SyncSchemeLegacyOpeningVouchersAndTransactionsAsync(
            AppDbContext context,
            FdScheme scheme)
        {
            if (scheme == null || scheme.FdSchemeID <= 0) return;

            bool isCompound = IsCompoundCapitalizedScheme(scheme);
            string expectedIntTxType = isCompound ? "Interest_Capitalized" : "Accrual";

            var legacyAccounts = await context.FdAccounts
                .Where(a => a.FdSchemeID == scheme.FdSchemeID &&
                            a.IsLegacyAccount &&
                            (a.Status == "Active" || a.Status == "Matured"))
                .ToListAsync();

            if (legacyAccounts.Count == 0) return;

            var migrationLedger = await context.Ledgers
                .AsNoTracking()
                .FirstOrDefaultAsync(l =>
                    l.AccountType == "Migration" ||
                    (l.LedgerName != null && l.LedgerName.Contains("आरंभिक शिल्लक स्थलांतर")) ||
                    l.LedgerID == 412);
            int migrationLedgerId = migrationLedger?.LedgerID ?? 412;
            int liabilityLedgerId = scheme.FdLiabilityLedgerID ?? 0;

            var voucherNos = legacyAccounts
                .Where(a => !string.IsNullOrWhiteSpace(a.AccountNo))
                .Select(a => $"JV-FD-OP-{a.AccountNo}")
                .Distinct()
                .ToList();

            var opVouchers = voucherNos.Count > 0
                ? await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .Where(v => voucherNos.Contains(v.VoucherNo))
                    .ToDictionaryAsync(v => v.VoucherNo)
                : new Dictionary<string, Voucher>();

            var accIds = legacyAccounts.Select(a => a.FdAccountID).ToList();
            var allTxs = await context.FdTransactions
                .Where(t => accIds.Contains(t.FdAccountID))
                .ToListAsync();

            foreach (var acc in legacyAccounts)
            {
                string opVoucherNo = $"JV-FD-OP-{acc.AccountNo}";
                opVouchers.TryGetValue(opVoucherNo, out var opVoucher);

                decimal expectedVoucherLiabilityAmt = isCompound
                    ? acc.DepositAmount + acc.LegacyAccruedInt
                    : acc.DepositAmount;

                if (opVoucher != null)
                {
                    opVoucher.TotalAmount = expectedVoucherLiabilityAmt;
                    if (opVoucher.VoucherDetails != null)
                    {
                        foreach (var vd in opVoucher.VoucherDetails)
                        {
                            if (vd.DrCr == "Dr" && vd.LedgerID == migrationLedgerId)
                            {
                                vd.Amount = expectedVoucherLiabilityAmt;
                            }
                            else if (vd.DrCr == "Cr")
                            {
                                if (liabilityLedgerId > 0) vd.LedgerID = liabilityLedgerId;
                                vd.Amount = expectedVoucherLiabilityAmt;
                            }
                        }
                    }
                }

                var accTxs = allTxs
                    .Where(t => t.FdAccountID == acc.FdAccountID &&
                                (opVoucher == null || t.VoucherID == opVoucher.VoucherID || t.VoucherID == 0))
                    .ToList();

                var intTx = accTxs.FirstOrDefault(t =>
                    t.TransactionType == "Accrual" || t.TransactionType == "Interest_Capitalized");

                if (acc.LegacyAccruedInt > 0m)
                {
                    if (intTx != null)
                    {
                        intTx.TransactionType = expectedIntTxType;
                        intTx.Amount = acc.LegacyAccruedInt;
                        intTx.TransactionDate = acc.LastInterestPostingDate ?? acc.OpeningDate;
                    }
                    else if (opVoucher != null)
                    {
                        context.FdTransactions.Add(new FdTransaction
                        {
                            BranchID = acc.BranchID,
                            FdAccountID = acc.FdAccountID,
                            VoucherID = opVoucher.VoucherID,
                            TransactionDate = acc.LastInterestPostingDate ?? acc.OpeningDate,
                            TransactionType = expectedIntTxType,
                            DebitCredit = "Cr",
                            Amount = acc.LegacyAccruedInt,
                            CreatedBy = acc.CreatedBy > 0 ? acc.CreatedBy : 1
                        });
                    }
                }
                else if (intTx != null)
                {
                    context.FdTransactions.Remove(intTx);
                }
            }

            await context.SaveChangesAsync();
        }

        public static async Task<FdOpeningBalanceSyncResult> SyncAllFdOpeningBalancesAsync(AppDbContext context)
        {
            var initialFy = await context.FinancialYears
                .AsNoTracking()
                .OrderBy(fy => fy.StartDate)
                .ThenBy(fy => fy.FinancialYearID)
                .FirstOrDefaultAsync();
            DateTime? baselineFyStart = initialFy?.StartDate.Date;

            var allLegacyCandidates = await context.FdAccounts
                .Include(a => a.FdScheme)
                .Where(a => a.IsLegacyAccount)
                .ToListAsync();

            // Include Active/Matured legacy accounts PLUS legacy accounts that were open on baselineFyStart
            // and closed/renewed during or after baselineFyStart (so post-FY-start closure debits don't drive OB negative).
            var nonLiveLegacyIds = allLegacyCandidates
                .Where(a => a.Status != "Active" && a.Status != "Matured")
                .Select(a => a.FdAccountID)
                .ToList();

            var closedAfterBaselineIds = new HashSet<int>();
            var closedLiabilityDebitsByAccount = new Dictionary<int, decimal>();
            if (nonLiveLegacyIds.Count > 0 && baselineFyStart.HasValue)
            {
                var closeTxs = await context.FdTransactions
                    .AsNoTracking()
                    .Include(t => t.Voucher)
                        .ThenInclude(v => v!.VoucherDetails)
                    .Where(t => nonLiveLegacyIds.Contains(t.FdAccountID) &&
                                t.Voucher != null &&
                                t.Voucher.Status != "Rejected" &&
                                t.Voucher.Status != "Cancelled" &&
                                t.Voucher.VoucherDate >= baselineFyStart.Value &&
                                (t.Voucher.VoucherNo.Contains("-FD-CLOSE-") ||
                                 t.Voucher.VoucherNo.Contains("-FD-PRECLOSE-") ||
                                 t.Voucher.VoucherNo.Contains("-FD-REN-") ||
                                 t.Voucher.VoucherNo.Contains("-FD-AUTOREN-")))
                    .ToListAsync();

                foreach (var tx in closeTxs)
                {
                    closedAfterBaselineIds.Add(tx.FdAccountID);
                    var accCandidate = allLegacyCandidates.FirstOrDefault(a => a.FdAccountID == tx.FdAccountID);
                    int liabLedgerId = accCandidate?.FdScheme?.FdLiabilityLedgerID ?? 0;
                    if (liabLedgerId > 0 && tx.Voucher?.VoucherDetails != null)
                    {
                        decimal drOnLiab = tx.Voucher.VoucherDetails
                            .Where(vd => vd.LedgerID == liabLedgerId && vd.DrCr == "Dr")
                            .Sum(vd => vd.Amount);
                        if (!closedLiabilityDebitsByAccount.TryGetValue(tx.FdAccountID, out decimal prevDr) || drOnLiab > prevDr)
                        {
                            closedLiabilityDebitsByAccount[tx.FdAccountID] = drOnLiab;
                        }
                    }
                }
            }

            var legacyAccounts = allLegacyCandidates
                .Where(a => a.Status == "Active" ||
                            a.Status == "Matured" ||
                            closedAfterBaselineIds.Contains(a.FdAccountID))
                .ToList();

            var schemes = await context.FdSchemes.ToListAsync();
            var allLedgers = await context.Ledgers.ToListAsync();
            var allCustObs = await context.CustomerOpeningBalances.ToListAsync();
            var allMemObs = await context.MemberOpeningBalances.ToListAsync();
            var allMembers = await context.Members.Where(m => m.CustomerID.HasValue).ToListAsync();
            var memberByCustId = allMembers
                .GroupBy(m => m.CustomerID!.Value)
                .ToDictionary(g => g.Key, g => g.First());

            var affectedLedgerIds = new HashSet<int>();
            decimal totalDepositsSynced = 0m;
            decimal totalCapitalizedInterestSynced = 0m;
            decimal totalAccruedProvisionSynced = 0m;

            var schemeById = schemes.ToDictionary(s => s.FdSchemeID);
            var schemeLiabilityMap = new Dictionary<int, Ledger>();
            var schemePayableMap = new Dictionary<int, Ledger>();

            foreach (var scheme in schemes)
            {
                Ledger? liabilityLedger = null;
                if (scheme.FdLiabilityLedgerID.HasValue && scheme.FdLiabilityLedgerID.Value > 0)
                {
                    liabilityLedger = allLedgers.FirstOrDefault(l => l.LedgerID == scheme.FdLiabilityLedgerID.Value);
                }
                if (liabilityLedger == null)
                {
                    liabilityLedger = allLedgers.FirstOrDefault(l =>
                        (l.LedgerName != null && l.LedgerName.Trim() == scheme.SchemeName.Trim()) ||
                        (l.LedgerName != null && (l.LedgerName.Contains("मुदत बंद ठेव") || l.LedgerName.Contains("मुदत ठेव") || l.LedgerName.Contains("दामदुप्पट ठेव"))) ||
                        (l.AccountType == "FD" || l.AccountType == "FixedDeposit"));

                    if (liabilityLedger != null && (!scheme.FdLiabilityLedgerID.HasValue || scheme.FdLiabilityLedgerID == 0))
                    {
                        scheme.FdLiabilityLedgerID = liabilityLedger.LedgerID;
                        context.Entry(scheme).State = EntityState.Modified;
                    }
                }
                if (liabilityLedger != null)
                {
                    schemeLiabilityMap[scheme.FdSchemeID] = liabilityLedger;
                    affectedLedgerIds.Add(liabilityLedger.LedgerID);
                }

                Ledger? payableLedger = null;
                if (scheme.InterestPayableLedgerID.HasValue && scheme.InterestPayableLedgerID.Value > 0)
                {
                    payableLedger = allLedgers.FirstOrDefault(l => l.LedgerID == scheme.InterestPayableLedgerID.Value);
                }
                if (payableLedger == null)
                {
                    payableLedger = allLedgers.FirstOrDefault(l =>
                        l.LedgerName != null && (
                            l.LedgerName.Contains("देणे मुदत") ||
                            (l.LedgerName.Contains("देणे") && l.LedgerName.Contains("ठेव") && l.LedgerName.Contains("व्याज")) ||
                            l.LedgerName.Contains("देणे सभासद ठेव व्याज") ||
                            l.LedgerName.Contains("देय व्याज") ||
                            l.LedgerName.ToLower().Contains("interest payable")));

                    if (payableLedger != null && (!scheme.InterestPayableLedgerID.HasValue || scheme.InterestPayableLedgerID == 0))
                    {
                        scheme.InterestPayableLedgerID = payableLedger.LedgerID;
                        context.Entry(scheme).State = EntityState.Modified;
                    }
                }
                if (payableLedger != null)
                {
                    schemePayableMap[scheme.FdSchemeID] = payableLedger;
                    affectedLedgerIds.Add(payableLedger.LedgerID);
                }
            }

            // Compute exact per-(LedgerID, CustomerID) opening credit totals according to scheme.InterestPostingMethod
            var desiredCreditsByLedgerAndCustomer = new Dictionary<(int LedgerId, int CustomerId), decimal>();

            foreach (var acc in legacyAccounts)
            {
                schemeById.TryGetValue(acc.FdSchemeID, out var schemeObj);
                schemeObj ??= acc.FdScheme;
                bool isCompound = IsCompoundCapitalizedScheme(schemeObj);

                // If an account was already closed in the current FY under pre-v2.6.50 logic where only DepositAmount
                // was debited from FdLiabilityLedgerID, preserve its historical split so neither ledger goes negative.
                if (isCompound &&
                    acc.Status != "Active" &&
                    acc.Status != "Matured" &&
                    acc.LegacyAccruedInt > 0m &&
                    closedLiabilityDebitsByAccount.TryGetValue(acc.FdAccountID, out decimal closedLiabDr) &&
                    closedLiabDr < acc.DepositAmount + acc.LegacyAccruedInt - 0.01m)
                {
                    isCompound = false;
                }

                if (schemeLiabilityMap.TryGetValue(acc.FdSchemeID, out var liabLedger))
                {
                    decimal principalPart = acc.DepositAmount;
                    decimal capIntPart = isCompound ? Math.Max(0m, acc.LegacyAccruedInt) : 0m;
                    decimal liabContribution = principalPart + capIntPart;

                    totalDepositsSynced += principalPart;
                    totalCapitalizedInterestSynced += capIntPart;

                    if (liabContribution > 0m)
                    {
                        var key = (liabLedger.LedgerID, acc.CustomerID);
                        desiredCreditsByLedgerAndCustomer.TryGetValue(key, out decimal prev);
                        desiredCreditsByLedgerAndCustomer[key] = prev + liabContribution;
                    }
                }

                if (!isCompound && acc.LegacyAccruedInt > 0m && schemePayableMap.TryGetValue(acc.FdSchemeID, out var payLedger))
                {
                    totalAccruedProvisionSynced += acc.LegacyAccruedInt;
                    var key = (payLedger.LedgerID, acc.CustomerID);
                    desiredCreditsByLedgerAndCustomer.TryGetValue(key, out decimal prev);
                    desiredCreditsByLedgerAndCustomer[key] = prev + acc.LegacyAccruedInt;
                }
            }

            // Reconcile CustomerOpeningBalances & MemberOpeningBalances for every affected FD Liability & Payable Ledger
            foreach (int ledgerId in affectedLedgerIds)
            {
                var desiredForLedger = desiredCreditsByLedgerAndCustomer
                    .Where(kv => kv.Key.LedgerId == ledgerId && kv.Value > 0m)
                    .ToDictionary(kv => kv.Key.CustomerId, kv => Math.Round(kv.Value, 2, MidpointRounding.AwayFromZero));

                var activeCustIdsForLedger = desiredForLedger.Keys.ToHashSet();

                // 1. Purge stale/orphan FD CustomerOpeningBalances for this Ledger (preserving RD/SAVING/PIGMY rows if shared ledger)
                var staleCustObs = allCustObs
                    .Where(c => c.LedgerID == ledgerId &&
                                (string.IsNullOrWhiteSpace(c.SourceModule) || c.SourceModule == "FD") &&
                                !activeCustIdsForLedger.Contains(c.CustomerID))
                    .ToList();
                if (staleCustObs.Count > 0)
                {
                    context.CustomerOpeningBalances.RemoveRange(staleCustObs);
                    foreach (var o in staleCustObs) allCustObs.Remove(o);
                }

                // 2. Purge stale/orphan MemberOpeningBalances for this Ledger (only when no non-FD CustomerOpeningBalance remains)
                var remainingNonFdCustIds = allCustObs
                    .Where(c => c.LedgerID == ledgerId && !string.IsNullOrWhiteSpace(c.SourceModule) && c.SourceModule != "FD")
                    .Select(c => c.CustomerID)
                    .ToHashSet();

                var staleMemObs = allMemObs
                    .Where(m => m.LedgerID == ledgerId &&
                                (!m.CustomerID.HasValue ||
                                 (!activeCustIdsForLedger.Contains(m.CustomerID.Value) && !remainingNonFdCustIds.Contains(m.CustomerID.Value))))
                    .ToList();
                if (staleMemObs.Count > 0)
                {
                    context.MemberOpeningBalances.RemoveRange(staleMemObs);
                    foreach (var o in staleMemObs) allMemObs.Remove(o);
                }

                // 3. Upsert exact CustomerOpeningBalances & MemberOpeningBalances
                foreach (var (custId, targetCrAmount) in desiredForLedger)
                {
                    var custOb = allCustObs.FirstOrDefault(c =>
                        c.CustomerID == custId &&
                        c.LedgerID == ledgerId &&
                        (string.IsNullOrWhiteSpace(c.SourceModule) || c.SourceModule == "FD"));
                    if (custOb != null)
                    {
                        custOb.Amount = targetCrAmount;
                        custOb.BalanceType = "Cr";
                        custOb.SourceModule = "FD";
                        custOb.UpdatedOn = DateTime.Now;
                        context.Entry(custOb).State = EntityState.Modified;
                    }
                    else
                    {
                        var newOb = new CustomerOpeningBalance
                        {
                            CustomerID = custId,
                            LedgerID = ledgerId,
                            Amount = targetCrAmount,
                            BalanceType = "Cr",
                            SourceModule = "FD",
                            CreatedBy = 1,
                            CreatedOn = DateTime.Now
                        };
                        context.CustomerOpeningBalances.Add(newOb);
                        allCustObs.Add(newOb);
                    }

                    if (memberByCustId.TryGetValue(custId, out var mem))
                    {
                        var memOb = allMemObs.FirstOrDefault(m => m.MemberID == mem.MemberID && m.LedgerID == ledgerId);
                        if (memOb != null)
                        {
                            memOb.Amount = targetCrAmount;
                            memOb.BalanceType = "Cr";
                            memOb.UpdatedOn = DateTime.Now;
                            context.Entry(memOb).State = EntityState.Modified;
                        }
                        else
                        {
                            var newMemOb = new MemberOpeningBalance
                            {
                                MemberID = mem.MemberID,
                                CustomerID = custId,
                                LedgerID = ledgerId,
                                Amount = targetCrAmount,
                                BalanceType = "Cr",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            context.MemberOpeningBalances.Add(newMemOb);
                            allMemObs.Add(newMemOb);
                        }
                    }
                }
            }

            await context.SaveChangesAsync();

            // 4. Sync BranchLedgerOpeningBalances for all affected FD Liability & Payable ledgers
            await BranchLedgerBalanceHelper.SyncCustomerOpeningBalancesToBranchAsync(
                context, affectedLedgerIds, "मुदत ठेव सुरुवातीची शिल्लक व साचलेले व्याज सिंक");

            await context.SaveChangesAsync();

            var updatedLedgers = new List<object>();
            var initialFyId = await BranchLedgerBalanceHelper.GetInitialFinancialYearIdAsync(context);
            foreach (var lId in affectedLedgerIds)
            {
                var ledger = allLedgers.FirstOrDefault(l => l.LedgerID == lId);
                if (ledger == null) continue;
                var branchRows = await context.BranchLedgerOpeningBalances
                    .AsNoTracking()
                    .Where(b => b.LedgerID == lId && (initialFyId == 0 || b.FinancialYearID == initialFyId))
                    .ToListAsync();
                decimal totalCr = branchRows.Where(b => b.OpeningBalanceType == "Cr").Sum(b => b.OpeningBalance);
                decimal totalDr = branchRows.Where(b => b.OpeningBalanceType == "Dr").Sum(b => b.OpeningBalance);
                decimal net = totalCr - totalDr;
                updatedLedgers.Add(new
                {
                    ledgerId = ledger.LedgerID,
                    ledgerName = ledger.LedgerName,
                    openingBalance = Math.Abs(net),
                    openingBalanceType = net >= 0 ? "Cr" : "Dr"
                });
            }

            return new FdOpeningBalanceSyncResult
            {
                Success = true,
                Message = "मुदत ठेव सुरुवातीची शिल्लक आणि साचलेले जुने व्याज योजनेच्या व्याज पद्धतीनुसार (On Principal / On Interest) ताळेबंद व तेरीज पत्रकाशी यशस्वीरीत्या सिंक झाले आहे.",
                TotalLegacyAccounts = legacyAccounts.Count,
                TotalDepositsSynced = totalDepositsSynced,
                TotalCapitalizedInterestSynced = totalCapitalizedInterestSynced,
                TotalAccruedProvisionSynced = totalAccruedProvisionSynced,
                AffectedLedgers = updatedLedgers
            };
        }
    }
}

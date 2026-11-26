using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Validates and synchronizes Saving Account sub-ledger transfers entered directly through Voucher Entry
    /// (e.g. Staff Salary / Recovery Officer Honorarium transferred to employee/customer Saving Accounts).
    /// Zero auto-post on entry; applies SavingTransactions strictly on Voucher Approval and reverses safely on Unpass.
    /// </summary>
    public static class VoucherSavingTransferHelper
    {
        public static async Task<HashSet<int>> GetConfiguredSavingControlLedgerIdsAsync(AppDbContext context)
        {
            var result = new HashSet<int>();

            var branchProtectedIds = new HashSet<int>();
            var branchRows = await context.Branches
                .AsNoTracking()
                .Select(b => new { b.DefaultCashLedgerID, b.DefaultIbtLedgerID })
                .ToListAsync();
            foreach (var b in branchRows)
            {
                if (b.DefaultCashLedgerID.HasValue && b.DefaultCashLedgerID.Value > 0)
                    branchProtectedIds.Add(b.DefaultCashLedgerID.Value);
                if (b.DefaultIbtLedgerID.HasValue && b.DefaultIbtLedgerID.Value > 0)
                    branchProtectedIds.Add(b.DefaultIbtLedgerID.Value);
            }

            var candidateIds = new HashSet<int>();

            var schemeLedgerPairs = await context.SavingInterestSettings
                .AsNoTracking()
                .Select(s => new { s.SavingLiabilityLedgerID, s.LedgerID })
                .ToListAsync();
            foreach (var s in schemeLedgerPairs)
            {
                if (s.SavingLiabilityLedgerID.HasValue && s.SavingLiabilityLedgerID.Value > 0)
                    candidateIds.Add(s.SavingLiabilityLedgerID.Value);
                if (s.LedgerID.HasValue && s.LedgerID.Value > 0)
                    candidateIds.Add(s.LedgerID.Value);
            }

            var savingMappingIds = await context.SavingVoucherMappings
                .AsNoTracking()
                .Where(m => m.OperationType == "SavingControl"
                         || m.OperationType == "SavingLiability"
                         || m.OperationType == "Deposit")
                .Select(m => m.LedgerID)
                .ToListAsync();
            foreach (int id in savingMappingIds)
            {
                if (id > 0) candidateIds.Add(id);
            }

            var generalMappingIds = await context.VoucherMappings
                .AsNoTracking()
                .Where(m => m.TransactionType == "Saving Deposit" || m.TransactionType == "SavingControl")
                .Select(m => new { m.CreditLedgerID, m.DebitLedgerID })
                .ToListAsync();
            foreach (var m in generalMappingIds)
            {
                if (m.CreditLedgerID.HasValue && m.CreditLedgerID.Value > 0)
                    candidateIds.Add(m.CreditLedgerID.Value);
                if (m.DebitLedgerID.HasValue && m.DebitLedgerID.Value > 0)
                    candidateIds.Add(m.DebitLedgerID.Value);
            }

            var savingTypeIds = await context.Ledgers
                .AsNoTracking()
                .Where(l => l.IsActive && l.AccountType == "Savings")
                .Select(l => l.LedgerID)
                .ToListAsync();
            foreach (int id in savingTypeIds)
            {
                if (id > 0) candidateIds.Add(id);
            }

            if (candidateIds.Count == 0)
            {
                return result;
            }

            var candidateLedgers = await context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => candidateIds.Contains(l.LedgerID))
                .ToListAsync();

            foreach (var l in candidateLedgers)
            {
                if (SavingLedgerHelper.IsValidSavingLiabilityLedger(l, branchProtectedIds))
                {
                    result.Add(l.LedgerID);
                }
            }

            return result;
        }

        public static async Task<string?> ValidateAndNormalizeVoucherSavingLinksAsync(
            AppDbContext context,
            Voucher voucher,
            int effectiveBranchId)
        {
            if (voucher.VoucherDetails == null || voucher.VoucherDetails.Count == 0)
            {
                return null;
            }

            var savingControlIds = await GetConfiguredSavingControlLedgerIdsAsync(context);
            if (savingControlIds.Count == 0)
            {
                foreach (var d in voucher.VoucherDetails)
                {
                    d.SavingAccountID = null;
                }
                return null;
            }

            bool hasAnySavingRow = voucher.VoucherDetails.Any(d =>
                savingControlIds.Contains(d.LedgerID) || (d.SavingAccountID.HasValue && d.SavingAccountID.Value > 0));

            if (!hasAnySavingRow)
            {
                return null;
            }

            var ledgerNames = await context.Ledgers
                .AsNoTracking()
                .Where(l => voucher.VoucherDetails.Select(d => d.LedgerID).Distinct().Contains(l.LedgerID))
                .ToDictionaryAsync(l => l.LedgerID, l => l.LedgerName);

            var allSchemes = await context.SavingInterestSettings
                .AsNoTracking()
                .OrderByDescending(s => s.SettingID)
                .ToListAsync();

            // Batch-preload all referenced SavingAccountMasters & Customer->Member mappings for fast 500+ row bulk transfers
            var explicitSavingIds = voucher.VoucherDetails
                .Where(d => d.SavingAccountID.HasValue && d.SavingAccountID.Value > 0)
                .Select(d => d.SavingAccountID!.Value)
                .Distinct()
                .ToList();

            var preloadedSavingById = explicitSavingIds.Count > 0
                ? await context.SavingAccountMasters
                    .Include(s => s.Customer)
                    .Include(s => s.SavingScheme)
                    .Where(s => explicitSavingIds.Contains(s.SavingAccountID))
                    .ToDictionaryAsync(s => s.SavingAccountID)
                : new Dictionary<int, SavingAccountMaster>();

            var preloadedCustIds = preloadedSavingById.Values
                .Select(s => s.CustomerID)
                .Concat(voucher.VoucherDetails.Where(d => d.CustomerID.HasValue && d.CustomerID.Value > 0).Select(d => d.CustomerID!.Value))
                .Distinct()
                .ToList();

            var memberIdByCustomerId = new Dictionary<int, int>();
            if (preloadedCustIds.Count > 0)
            {
                var rawMembers = await context.Members
                    .AsNoTracking()
                    .Where(m => m.CustomerID.HasValue && preloadedCustIds.Contains(m.CustomerID.Value))
                    .Select(m => new { CustomerID = m.CustomerID!.Value, m.MemberID })
                    .ToListAsync();

                foreach (var rm in rawMembers)
                {
                    if (!memberIdByCustomerId.ContainsKey(rm.CustomerID))
                    {
                        memberIdByCustomerId[rm.CustomerID] = rm.MemberID;
                    }
                }
            }

            var requestedDebitTotalsBySavingId = new Dictionary<int, decimal>();

            foreach (var d in voucher.VoucherDetails)
            {
                if (!savingControlIds.Contains(d.LedgerID))
                {
                    if (d.SavingAccountID.HasValue && d.SavingAccountID.Value > 0)
                    {
                        string nonSavLedgerName = ledgerNames.TryGetValue(d.LedgerID, out var ln) ? ln : $"Ledger #{d.LedgerID}";
                        return $"'{nonSavLedgerName}' हे बचत ठेव देयता लेजर नसल्यामुळे या ओळीवर बचत खाते निवडता येत नाही.";
                    }
                    d.SavingAccountID = null;
                    continue;
                }

                string ledgerDisplayName = ledgerNames.TryGetValue(d.LedgerID, out var lName) ? lName : "बचत ठेव खाते";
                SavingAccountMaster? savAcc = null;

                if (d.SavingAccountID.HasValue && d.SavingAccountID.Value > 0)
                {
                    preloadedSavingById.TryGetValue(d.SavingAccountID.Value, out savAcc);
                    if (savAcc == null)
                    {
                        savAcc = await context.SavingAccountMasters
                            .Include(s => s.Customer)
                            .Include(s => s.SavingScheme)
                            .FirstOrDefaultAsync(s => s.SavingAccountID == d.SavingAccountID.Value);
                    }

                    if (savAcc == null)
                    {
                        return $"निवडलेले बचत खाते (ID: #{d.SavingAccountID.Value}) सिस्टीममध्ये सापडले नाही.";
                    }
                }
                else if (d.CustomerID.HasValue && d.CustomerID.Value > 0)
                {
                    var candidateAccounts = await context.SavingAccountMasters
                        .Include(s => s.Customer)
                        .Include(s => s.SavingScheme)
                        .Where(s =>
                            (effectiveBranchId <= 0 || s.BranchID == effectiveBranchId || s.BranchID == 0) &&
                            s.Status != "Closed" &&
                            s.Status != "Frozen" &&
                            (s.CustomerID == d.CustomerID.Value || s.JointHolders.Any(jh => jh.CustomerID == d.CustomerID.Value)))
                        .ToListAsync();

                    if (candidateAccounts.Count == 1)
                    {
                        savAcc = candidateAccounts[0];
                        d.SavingAccountID = savAcc.SavingAccountID;
                    }
                    else if (candidateAccounts.Count > 1)
                    {
                        return $"निवडलेल्या खातेदाराकडे या शाखेत {candidateAccounts.Count} सक्रिय बचत खाती आहेत. कृपया '{ledgerDisplayName}' ओळीवर नेमके कोणते बचत खाते ते निवडा.";
                    }
                    else
                    {
                        return $"निवडलेल्या खातेदाराचे सक्रिय बचत खाते या शाखेत आढळले नाही. कृपया प्रथम बचत खाते उघडा किंवा वैध बचत खाते निवडा.";
                    }
                }
                else
                {
                    return $"'{ledgerDisplayName}' या बचत ठेव नियंत्रण खात्यासाठी कर्मचारी / अधिकाऱ्याचे किंवा ग्राहकाचे बचत खाते निवडणे बंधनकारक आहे.";
                }

                if (string.Equals(savAcc.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(savAcc.Status, "Frozen", StringComparison.OrdinalIgnoreCase))
                {
                    return $"बचत खाते (#{savAcc.AccountNo}) सध्या '{savAcc.Status}' स्थितीत असल्यामुळे व्हाउचरमध्ये वापरता येत नाही.";
                }

                if (effectiveBranchId > 0 && savAcc.BranchID > 0 && savAcc.BranchID != effectiveBranchId)
                {
                    return $"आंतर-शाखा बचत वर्ग बंदी! हे व्हाउचर शाखा क्र. #{effectiveBranchId} चे असून निवडलेले बचत खाते (#{savAcc.AccountNo}) शाखा क्र. #{savAcc.BranchID} मधील आहे.";
                }

                int resolvedAccLedgerId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(context, savAcc);
                if (resolvedAccLedgerId > 0 && resolvedAccLedgerId != d.LedgerID && savAcc.LedgerID != d.LedgerID)
                {
                    return $"निवडलेले बचत खाते (#{savAcc.AccountNo}) हे '{ledgerDisplayName}' या लेजरशी संलग्न नाही.";
                }

                if (string.Equals(d.DrCr, "Dr", StringComparison.OrdinalIgnoreCase))
                {
                    if (string.Equals(savAcc.Status, "Dormant", StringComparison.OrdinalIgnoreCase))
                    {
                        return $"बचत खाते (#{savAcc.AccountNo}) 'Dormant' (सुप्त) असल्यामुळे त्यातून रक्कम नावे (Dr) करता येणार नाही.";
                    }

                    requestedDebitTotalsBySavingId.TryGetValue(savAcc.SavingAccountID, out decimal priorDr);
                    decimal totalRequestedDr = priorDr + d.Amount;
                    requestedDebitTotalsBySavingId[savAcc.SavingAccountID] = totalRequestedDr;

                    var (availableBal, effectiveMinBal) = await SavingLedgerHelper.ResolveAvailableBalanceAsync(context, savAcc, allSchemes);
                    if (availableBal + 0.001m < totalRequestedDr)
                    {
                        return $"अपुरी बचत शिल्लक! खाते #{savAcc.AccountNo} मध्ये किमान शिल्लक (₹{effectiveMinBal:N2}) व तारण (₹{savAcc.LienAmount:N2}) वजा जाता फक्त ₹{availableBal:N2} नावे करता येतील (विनंती: ₹{totalRequestedDr:N2}).";
                    }
                }

                d.CustomerID = savAcc.CustomerID;
                if (memberIdByCustomerId.TryGetValue(savAcc.CustomerID, out int cachedMemId))
                {
                    d.MemberID = cachedMemId;
                }
                else
                {
                    var linkedMemberId = await context.Members
                        .AsNoTracking()
                        .Where(m => m.CustomerID == savAcc.CustomerID)
                        .Select(m => (int?)m.MemberID)
                        .FirstOrDefaultAsync();
                    if (linkedMemberId.HasValue)
                    {
                        d.MemberID = linkedMemberId.Value;
                        memberIdByCustomerId[savAcc.CustomerID] = linkedMemberId.Value;
                    }
                }
            }

            return null;
        }

        public static async Task ApplyApprovedVoucherSavingTransfersAsync(
            AppDbContext context,
            Voucher voucher,
            int approverId)
        {
            if (voucher == null || !string.Equals(voucher.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var linkedDetails = voucher.VoucherDetails?
                .Where(d => d.SavingAccountID.HasValue && d.SavingAccountID.Value > 0 && d.Amount > 0)
                .ToList();

            if (linkedDetails == null || linkedDetails.Count == 0)
            {
                return;
            }

            bool alreadyPosted = await context.SavingTransactions.AnyAsync(st =>
                st.VoucherID == voucher.VoucherID ||
                (!string.IsNullOrWhiteSpace(voucher.VoucherNo) && st.VoucherNo == voucher.VoucherNo));

            if (alreadyPosted)
            {
                return;
            }

            var savingControlIds = await GetConfiguredSavingControlLedgerIdsAsync(context);
            var allSchemes = await context.SavingInterestSettings
                .AsNoTracking()
                .OrderByDescending(s => s.SettingID)
                .ToListAsync();

            var detailLedgerIds = voucher.VoucherDetails!
                .Select(d => d.LedgerID)
                .Distinct()
                .ToList();
            var ledgerNames = await context.Ledgers
                .AsNoTracking()
                .Where(l => detailLedgerIds.Contains(l.LedgerID))
                .ToDictionaryAsync(l => l.LedgerID, l => l.LedgerName);

            var affectedSavingIds = new HashSet<int>();
            var batchSavingIds = linkedDetails
                .Select(d => d.SavingAccountID!.Value)
                .Distinct()
                .ToList();
            var batchAccountsById = await context.SavingAccountMasters
                .Where(s => batchSavingIds.Contains(s.SavingAccountID))
                .ToDictionaryAsync(s => s.SavingAccountID);

            foreach (var d in linkedDetails)
            {
                if (!savingControlIds.Contains(d.LedgerID))
                {
                    continue;
                }

                batchAccountsById.TryGetValue(d.SavingAccountID!.Value, out var savAcc);
                if (savAcc == null)
                {
                    savAcc = await context.SavingAccountMasters
                        .FirstOrDefaultAsync(s => s.SavingAccountID == d.SavingAccountID!.Value);
                }

                if (savAcc == null)
                {
                    throw new InvalidOperationException($"व्हाउचर क्र. {voucher.VoucherNo} मध्ये जोडलेले बचत खाते (#{d.SavingAccountID!.Value}) सापडले नाही.");
                }

                if (string.Equals(savAcc.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(savAcc.Status, "Frozen", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException($"बचत खाते (#{savAcc.AccountNo}) सध्या '{savAcc.Status}' स्थितीत असल्यामुळे व्हाउचर क्र. {voucher.VoucherNo} पास करता येणार नाही.");
                }

                if (voucher.BranchID > 0 && savAcc.BranchID > 0 && savAcc.BranchID != voucher.BranchID)
                {
                    throw new InvalidOperationException($"आंतर-शाखा बचत वर्ग अनुमत नाही: व्हाउचर शाखा #{voucher.BranchID} आणि बचत खाते #{savAcc.AccountNo} शाखा #{savAcc.BranchID} भिन्न आहेत.");
                }

                bool isCredit = string.Equals(d.DrCr, "Cr", StringComparison.OrdinalIgnoreCase);
                string oppositeSide = isCredit ? "Dr" : "Cr";
                var counterNames = voucher.VoucherDetails!
                    .Where(other => string.Equals(other.DrCr, oppositeSide, StringComparison.OrdinalIgnoreCase))
                    .Select(other => ledgerNames.TryGetValue(other.LedgerID, out var ln) ? ln : string.Empty)
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct()
                    .Take(2)
                    .ToList();

                string counterPrefix = counterNames.Count > 0 ? string.Join(", ", counterNames) : (isCredit ? "व्हाउचर जमा वर्ग" : "व्हाउचर नावे वर्ग");
                string rawVoucherNarr = !string.IsNullOrWhiteSpace(voucher.Narration)
                    ? $"{counterPrefix} - {voucher.Narration!.Trim()}"
                    : $"{counterPrefix} (व्हाउचर क्र.: {voucher.VoucherNo})";
                if (rawVoucherNarr.Length > 250)
                {
                    rawVoucherNarr = rawVoucherNarr.Substring(0, 250);
                }

                if (isCredit)
                {
                    savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance + d.Amount, 2, MidpointRounding.AwayFromZero);
                    context.Entry(savAcc).State = EntityState.Modified;

                    context.SavingTransactions.Add(new SavingTransaction
                    {
                        SavingAccountID = savAcc.SavingAccountID,
                        CustomerID = savAcc.CustomerID,
                        BranchID = savAcc.BranchID > 0 ? savAcc.BranchID : voucher.BranchID,
                        TransactionDate = voucher.VoucherDate,
                        TransactionType = "Deposit",
                        PaymentMode = "Transfer",
                        Amount = d.Amount,
                        BalanceAfterTxn = savAcc.CurrentBalance,
                        Narration = rawVoucherNarr,
                        VoucherNo = voucher.VoucherNo,
                        VoucherID = voucher.VoucherID,
                        CreatedBy = approverId > 0 ? approverId : (voucher.CreatedBy > 0 ? voucher.CreatedBy : 1),
                        CreatedOn = DateTime.Now
                    });
                }
                else
                {
                    if (string.Equals(savAcc.Status, "Dormant", StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException($"बचत खाते (#{savAcc.AccountNo}) 'Dormant' (सुप्त) असल्यामुळे त्यातून रक्कम नावे करून व्हाउचर पास करता येणार नाही.");
                    }

                    var (availableBal, effectiveMinBal) = await SavingLedgerHelper.ResolveAvailableBalanceAsync(context, savAcc, allSchemes);
                    if (availableBal + 0.001m < d.Amount)
                    {
                        throw new InvalidOperationException($"बचत खाते (#{savAcc.AccountNo}) मध्ये पुरेशी शिल्लक नसल्याने (उपलब्ध: ₹{availableBal:N2}, किमान शिल्लक: ₹{effectiveMinBal:N2}, आवश्यक: ₹{d.Amount:N2}) व्हाउचर क्र. {voucher.VoucherNo} पास करता येणार नाही.");
                    }

                    savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance - d.Amount, 2, MidpointRounding.AwayFromZero);
                    context.Entry(savAcc).State = EntityState.Modified;

                    context.SavingTransactions.Add(new SavingTransaction
                    {
                        SavingAccountID = savAcc.SavingAccountID,
                        CustomerID = savAcc.CustomerID,
                        BranchID = savAcc.BranchID > 0 ? savAcc.BranchID : voucher.BranchID,
                        TransactionDate = voucher.VoucherDate,
                        TransactionType = "Withdrawal",
                        PaymentMode = "Transfer",
                        Amount = d.Amount,
                        BalanceAfterTxn = savAcc.CurrentBalance,
                        Narration = rawVoucherNarr,
                        VoucherNo = voucher.VoucherNo,
                        VoucherID = voucher.VoucherID,
                        CreatedBy = approverId > 0 ? approverId : (voucher.CreatedBy > 0 ? voucher.CreatedBy : 1),
                        CreatedOn = DateTime.Now
                    });
                }

                affectedSavingIds.Add(savAcc.SavingAccountID);
            }

            if (affectedSavingIds.Count > 0)
            {
                await context.SaveChangesAsync();
                await SavingLedgerHelper.RecalculateSavingRunningBalancesAsync(context, affectedSavingIds);
            }
        }

        public static async Task ReverseApprovedVoucherSavingTransfersOnUnpassAsync(
            AppDbContext context,
            Voucher voucher)
        {
            if (voucher == null)
            {
                return;
            }

            bool hasManualSavingLinks = voucher.VoucherDetails != null &&
                voucher.VoucherDetails.Any(d => d.SavingAccountID.HasValue && d.SavingAccountID.Value > 0);
            if (!hasManualSavingLinks)
            {
                return;
            }

            var linkedTxns = await context.SavingTransactions
                .Where(st => st.VoucherID == voucher.VoucherID ||
                             (!string.IsNullOrWhiteSpace(voucher.VoucherNo) && st.VoucherNo == voucher.VoucherNo))
                .ToListAsync();

            if (linkedTxns.Count == 0)
            {
                return;
            }

            var affectedSavingIds = new HashSet<int>();
            var pendingReversals = new List<(Models.SavingTransaction Txn, Models.SavingAccountMaster? Account)>();

            foreach (var st in linkedTxns)
            {
                var savAcc = await context.SavingAccountMasters.FindAsync(st.SavingAccountID);
                if (savAcc != null && (st.TransactionType == "Deposit" || st.TransactionType == "Interest"))
                {
                    decimal priorDeductions = pendingReversals
                        .Where(x => x.Account != null && x.Account.SavingAccountID == savAcc.SavingAccountID &&
                                    (x.Txn.TransactionType == "Deposit" || x.Txn.TransactionType == "Interest"))
                        .Sum(x => x.Txn.Amount);
                    decimal remainingBal = savAcc.CurrentBalance - priorDeductions;
                    if (remainingBal < st.Amount - 0.01m)
                    {
                        throw new InvalidOperationException($"बचत खाते क्र. {savAcc.AccountNo} मधून या व्हाउचरची जमा रक्कम आधीच काढली गेली असल्यामुळे (सध्याची शिल्लक: ₹{remainingBal:N2}, रिव्हर्स रक्कम: ₹{st.Amount:N2}) हे व्हाउचर अन-पास करता येणार नाही.");
                    }
                }
                pendingReversals.Add((st, savAcc));
            }

            foreach (var (st, savAcc) in pendingReversals)
            {
                if (savAcc != null)
                {
                    if (st.TransactionType == "Deposit" || st.TransactionType == "Interest")
                    {
                        savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance - st.Amount, 2, MidpointRounding.AwayFromZero);
                        context.Entry(savAcc).State = EntityState.Modified;
                    }
                    else if (st.TransactionType == "Withdrawal" || st.TransactionType == "Charges")
                    {
                        savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance + st.Amount, 2, MidpointRounding.AwayFromZero);
                        context.Entry(savAcc).State = EntityState.Modified;
                    }
                    affectedSavingIds.Add(savAcc.SavingAccountID);
                }

                var passbooks = await context.SavingPassbooks
                    .Where(p => p.TransactionID == st.TransactionID)
                    .ToListAsync();
                if (passbooks.Any())
                {
                    context.SavingPassbooks.RemoveRange(passbooks);
                }

                context.SavingTransactions.Remove(st);
            }

            if (affectedSavingIds.Count > 0)
            {
                await context.SaveChangesAsync();
                await SavingLedgerHelper.RecalculateSavingRunningBalancesAsync(context, affectedSavingIds);
            }
        }
    }
}

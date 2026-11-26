using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public class SavingBulkTransferItemInput
    {
        public int SavingAccountId { get; set; }
        public decimal Amount { get; set; }
        public int? TargetSavingAccountId { get; set; }
    }

    public class SavingBulkTransferRequestDto
    {
        public int BranchId { get; set; }
        public DateTime TransactionDate { get; set; }
        public int SavingLedgerId { get; set; }
        public int? SavingSchemeId { get; set; }
        public string Direction { get; set; } = "CREDIT"; // CREDIT (जमा) | DEBIT (नावे)
        public string ContraMode { get; set; } = "BANK"; // BANK | SAVING_ACCOUNT | GL_LEDGER | SCHEME_TO_SCHEME
        public int? ContraLedgerId { get; set; }
        public int? ContraSavingAccountId { get; set; }
        public int? ContraTargetSchemeId { get; set; }
        public string? Narration { get; set; }
        public List<SavingBulkTransferItemInput> Items { get; set; } = new();
    }

    public class SavingBulkTransferExecutionResult
    {
        public int VoucherId { get; set; }
        public string VoucherNo { get; set; } = string.Empty;
        public int ProcessedCount { get; set; }
        public decimal TotalAmount { get; set; }
        public string SavingLedgerName { get; set; } = string.Empty;
        public string ContraSummary { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    /// <summary>
    /// Core Banking Bulk Saving Transfer Engine (दूध संस्था KDCC बँक बिल जमा & संस्था सेव्हिंग ➔ रेग्युलर सेव्हिंग ठेव वर्ग).
    /// Strictly 100% CustomerID-First, 100% Dynamic Ledgers (Zero Hardcoding), and Zero Auto-Post Maker-Checker
    /// powered by VoucherDetails.SavingAccountID + VoucherSavingTransferHelper.
    /// </summary>
    public static class SavingBulkTransferHelper
    {
        public static async Task<object> GetBulkTransferOptionsAsync(AppDbContext context, int effectiveBranchId)
        {
            var savingControlIds = await VoucherSavingTransferHelper.GetConfiguredSavingControlLedgerIdsAsync(context);
            var activeSchemes = await context.SavingInterestSettings
                .AsNoTracking()
                .Include(s => s.SavingLiabilityLedger)
                .Include(s => s.Ledger)
                .OrderBy(s => s.SettingID)
                .ToListAsync();

            var allLedgers = await context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => l.IsActive)
                .OrderBy(l => l.LedgerName)
                .ToListAsync();

            var ledgerById = allLedgers.ToDictionary(l => l.LedgerID);

            var branchAccountCounts = await context.SavingAccountMasters
                .AsNoTracking()
                .Where(s => (effectiveBranchId <= 0 || s.BranchID == effectiveBranchId) &&
                            s.Status != "Closed" && s.Status != "Frozen")
                .GroupBy(s => new { s.LedgerID, s.SavingSchemeID })
                .Select(g => new { g.Key.LedgerID, g.Key.SavingSchemeID, Count = g.Count() })
                .ToListAsync();

            // 1. Build Saving Deposit Scheme / Ledger Options (e.g. सेव्हिंग ठेव, महालक्ष्मी सेव्हिंग ठेव, हनुमान सेव्हिंग ठेव)
            var savingOptions = new List<object>();
            var coveredLedgerIds = new HashSet<int>();

            foreach (var scheme in activeSchemes)
            {
                int mappedLedgerId = scheme.SavingLiabilityLedgerID ?? scheme.LedgerID ?? 0;
                if (mappedLedgerId <= 0 || !savingControlIds.Contains(mappedLedgerId)) continue;
                if (!ledgerById.TryGetValue(mappedLedgerId, out var lObj)) continue;

                int schemesSharingSameLedger = activeSchemes.Count(x => (x.SavingLiabilityLedgerID ?? x.LedgerID ?? 0) == mappedLedgerId);
                int accCount = schemesSharingSameLedger == 1
                    ? branchAccountCounts.Where(c => c.LedgerID == mappedLedgerId).Sum(c => c.Count)
                    : branchAccountCounts.Where(c => c.SavingSchemeID == scheme.SettingID || (c.SavingSchemeID == null && c.LedgerID == mappedLedgerId && scheme == activeSchemes.First(x => (x.SavingLiabilityLedgerID ?? x.LedgerID ?? 0) == mappedLedgerId))).Sum(c => c.Count);

                string displayLabel = !string.IsNullOrWhiteSpace(scheme.SchemeName) &&
                                      !string.Equals(scheme.SchemeName.Trim(), lObj.LedgerName.Trim(), StringComparison.OrdinalIgnoreCase)
                    ? $"{scheme.SchemeName.Trim()} ({lObj.LedgerName.Trim()})"
                    : lObj.LedgerName.Trim();

                savingOptions.Add(new
                {
                    optionKey = $"S_{scheme.SettingID}_L_{mappedLedgerId}",
                    ledgerID = mappedLedgerId,
                    ledgerName = lObj.LedgerName,
                    ledgerCode = lObj.LedgerCode ?? "",
                    schemeID = (int?)scheme.SettingID,
                    schemeName = scheme.SchemeName ?? lObj.LedgerName,
                    displayLabel,
                    interestRate = scheme.InterestRate,
                    minimumBalance = scheme.MinimumBalance,
                    accountCount = accCount
                });
                coveredLedgerIds.Add(mappedLedgerId);
            }

            foreach (int savLedId in savingControlIds.Where(id => !coveredLedgerIds.Contains(id)))
            {
                if (!ledgerById.TryGetValue(savLedId, out var lObj)) continue;
                int accCount = branchAccountCounts.Where(c => c.LedgerID == savLedId).Sum(c => c.Count);
                savingOptions.Add(new
                {
                    optionKey = $"S_0_L_{savLedId}",
                    ledgerID = savLedId,
                    ledgerName = lObj.LedgerName,
                    ledgerCode = lObj.LedgerCode ?? "",
                    schemeID = (int?)null,
                    schemeName = lObj.LedgerName,
                    displayLabel = lObj.LedgerName,
                    interestRate = 0m,
                    minimumBalance = 0m,
                    accountCount = accCount
                });
            }

            // 2. Dynamic Bank Ledgers (e.g. के.डी.सी.सी चालु खाते, कुरुंदवाड चालु खाते, कर्मवीर पतसंस्था सेव्हिंग)
            var bankLedgers = allLedgers
                .Where(BankLedgerHelper.IsBankLedger)
                .Select(l => new
                {
                    ledgerID = l.LedgerID,
                    ledgerName = l.LedgerName,
                    ledgerCode = l.LedgerCode ?? "",
                    groupName = l.AccountGroup?.GroupName ?? ""
                })
                .ToList();

            // 3. Safe General Ledgers for Ledger Transfer (excludes Cash, IBT, Bank, and Sub-Ledger Control Ledgers)
            var branchCashIbtIds = new HashSet<int>();
            var branchProtected = await context.Branches
                .AsNoTracking()
                .Select(b => new { b.DefaultCashLedgerID, b.DefaultIbtLedgerID })
                .ToListAsync();
            foreach (var bp in branchProtected)
            {
                if (bp.DefaultCashLedgerID.HasValue && bp.DefaultCashLedgerID.Value > 0) branchCashIbtIds.Add(bp.DefaultCashLedgerID.Value);
                if (bp.DefaultIbtLedgerID.HasValue && bp.DefaultIbtLedgerID.Value > 0) branchCashIbtIds.Add(bp.DefaultIbtLedgerID.Value);
            }

            var protectedSubledgerControlIds = new HashSet<int>(savingControlIds);
            foreach (int lid in await context.LoanRates.AsNoTracking().Where(r => r.LoanLedgerID != null).Select(r => r.LoanLedgerID!.Value).ToListAsync())
                if (lid > 0) protectedSubledgerControlIds.Add(lid);
            foreach (int lid in await context.FdSchemes.AsNoTracking().Where(f => f.FdLiabilityLedgerID != null).Select(f => f.FdLiabilityLedgerID!.Value).ToListAsync())
                if (lid > 0) protectedSubledgerControlIds.Add(lid);
            foreach (int lid in await context.RdSchemes.AsNoTracking().Where(r => r.RdLiabilityLedgerID != null).Select(r => r.RdLiabilityLedgerID!.Value).ToListAsync())
                if (lid > 0) protectedSubledgerControlIds.Add(lid);
            foreach (int lid in await context.PigmySchemes.AsNoTracking().Where(p => p.PigmyLiabilityLedgerID != null).Select(p => p.PigmyLiabilityLedgerID!.Value).ToListAsync())
                if (lid > 0) protectedSubledgerControlIds.Add(lid);
            foreach (int lid in await context.ShareSchemes.AsNoTracking().Where(s => s.ShareCapitalLedgerID != null).Select(s => s.ShareCapitalLedgerID!.Value).ToListAsync())
                if (lid > 0) protectedSubledgerControlIds.Add(lid);

            var generalLedgers = allLedgers
                .Where(l =>
                    !branchCashIbtIds.Contains(l.LedgerID) &&
                    !protectedSubledgerControlIds.Contains(l.LedgerID) &&
                    !BankLedgerHelper.IsCashLedger(l) &&
                    !BankLedgerHelper.IsBankLedger(l) &&
                    !string.Equals(l.AccountType, "IBT", StringComparison.OrdinalIgnoreCase))
                .Select(l => new
                {
                    ledgerID = l.LedgerID,
                    ledgerName = l.LedgerName,
                    ledgerCode = l.LedgerCode ?? "",
                    groupName = l.AccountGroup?.GroupName ?? ""
                })
                .ToList();

            return new
            {
                savingOptions,
                bankLedgers,
                generalLedgers
            };
        }

        private static long ParseSortNumber(string? oldNo, string? legacyNo)
        {
            foreach (var raw in new[] { oldNo, legacyNo })
            {
                if (string.IsNullOrWhiteSpace(raw)) continue;
                var trimmed = raw.Trim();
                if (long.TryParse(trimmed, out long exact) && exact > 0) return exact;
                var match = System.Text.RegularExpressions.Regex.Match(trimmed, @"(\d+)");
                if (match.Success && long.TryParse(match.Groups[1].Value, out long num)) return num;
            }
            return long.MaxValue;
        }

        public static async Task<List<object>> GetBulkTransferAccountsAsync(
            AppDbContext context,
            int effectiveBranchId,
            int savingLedgerId,
            int? savingSchemeId = null,
            int? targetLedgerId = null,
            int? targetSchemeId = null)
        {
            var allSchemes = await context.SavingInterestSettings
                .AsNoTracking()
                .OrderByDescending(s => s.SettingID)
                .ToListAsync();

            int schemesSharingLedger = allSchemes.Count(s => (s.SavingLiabilityLedgerID ?? s.LedgerID ?? 0) == savingLedgerId);

            var query = context.SavingAccountMasters
                .AsNoTracking()
                .Include(s => s.Customer)
                .Include(s => s.SavingScheme)
                .Include(s => s.Ledger)
                .Where(s =>
                    (effectiveBranchId <= 0 || s.BranchID == effectiveBranchId) &&
                    s.Status != "Closed" &&
                    s.Status != "Frozen" &&
                    s.LedgerID == savingLedgerId);

            if (savingSchemeId.HasValue && savingSchemeId.Value > 0 && schemesSharingLedger > 1)
            {
                int firstSchemeForLedger = allSchemes
                    .Where(x => (x.SavingLiabilityLedgerID ?? x.LedgerID ?? 0) == savingLedgerId)
                    .OrderBy(x => x.SettingID)
                    .Select(x => x.SettingID)
                    .FirstOrDefault();

                if (savingSchemeId.Value == firstSchemeForLedger)
                {
                    query = query.Where(s => s.SavingSchemeID == savingSchemeId.Value || s.SavingSchemeID == null);
                }
                else
                {
                    query = query.Where(s => s.SavingSchemeID == savingSchemeId.Value);
                }
            }

            var rawAccounts = await query.ToListAsync();

            // Optional target Saving accounts lookup by CustomerID for Scheme-to-Scheme transfers
            var targetByCustomerId = new Dictionary<int, SavingAccountMaster>();
            if (targetLedgerId.HasValue && targetLedgerId.Value > 0)
            {
                int targetSharedCount = allSchemes.Count(s => (s.SavingLiabilityLedgerID ?? s.LedgerID ?? 0) == targetLedgerId.Value);
                var tgtQuery = context.SavingAccountMasters
                    .AsNoTracking()
                    .Where(s =>
                        (effectiveBranchId <= 0 || s.BranchID == effectiveBranchId) &&
                        s.Status != "Closed" &&
                        s.Status != "Frozen" &&
                        s.LedgerID == targetLedgerId.Value);

                if (targetSchemeId.HasValue && targetSchemeId.Value > 0 && targetSharedCount > 1)
                {
                    tgtQuery = tgtQuery.Where(s => s.SavingSchemeID == targetSchemeId.Value || s.SavingSchemeID == null);
                }

                var tgtAccounts = await tgtQuery.OrderBy(s => s.SavingAccountID).ToListAsync();
                foreach (var ta in tgtAccounts)
                {
                    if (!targetByCustomerId.ContainsKey(ta.CustomerID))
                    {
                        targetByCustomerId[ta.CustomerID] = ta;
                    }
                }
            }

            var sorted = rawAccounts
                .OrderBy(a => ParseSortNumber(a.OldAccountNo, a.LegacyAccountNumber))
                .ThenBy(a => a.AccountNo)
                .ToList();

            var result = new List<object>(sorted.Count);
            foreach (var s in sorted)
            {
                var (availableBal, effectiveMinBal) = await SavingLedgerHelper.ResolveAvailableBalanceAsync(context, s, allSchemes);
                string oldDisplay = !string.IsNullOrWhiteSpace(s.OldAccountNo)
                    ? s.OldAccountNo.Trim()
                    : (!string.IsNullOrWhiteSpace(s.LegacyAccountNumber) ? s.LegacyAccountNumber.Trim() : "");

                string custName = s.Customer != null
                    ? string.Join(" ", new[] { s.Customer.FirstName, s.Customer.MiddleName, s.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                    : "";

                targetByCustomerId.TryGetValue(s.CustomerID, out var matchedTarget);
                string matchedTargetOldNo = matchedTarget != null
                    ? (!string.IsNullOrWhiteSpace(matchedTarget.OldAccountNo) ? matchedTarget.OldAccountNo.Trim() : (matchedTarget.LegacyAccountNumber ?? ""))
                    : "";

                result.Add(new
                {
                    savingAccountID = s.SavingAccountID,
                    branchID = s.BranchID,
                    accountNo = s.AccountNo,
                    oldAccountNo = oldDisplay,
                    customerID = s.CustomerID,
                    cifNo = s.Customer?.CIFNo ?? "",
                    legacyCustomerNo = s.Customer?.LegacyCustomerNo ?? "",
                    customerName = custName,
                    mobileNo = s.Customer?.MobileNo ?? "",
                    ledgerID = s.LedgerID,
                    ledgerName = s.Ledger?.LedgerName ?? "",
                    savingSchemeID = s.SavingSchemeID,
                    schemeName = s.SavingScheme?.SchemeName ?? s.Ledger?.LedgerName ?? "",
                    openingDate = s.OpeningDate,
                    currentBalance = s.CurrentBalance,
                    availableBalance = availableBal,
                    minimumBalance = effectiveMinBal,
                    lienAmount = s.LienAmount,
                    status = s.Status,
                    matchedTargetSavingAccountID = matchedTarget?.SavingAccountID,
                    matchedTargetAccountNo = matchedTarget?.AccountNo ?? "",
                    matchedTargetOldAccountNo = matchedTargetOldNo,
                    matchedTargetCurrentBalance = matchedTarget?.CurrentBalance ?? 0m
                });
            }

            return result;
        }

        public static async Task<SavingBulkTransferExecutionResult> ExecuteBulkSavingTransferAtomicAsync(
            AppDbContext context,
            SavingBulkTransferRequestDto req,
            int effectiveBranchId,
            int userId)
        {
            int branchId = effectiveBranchId > 0 ? effectiveBranchId : (req.BranchId > 0 ? req.BranchId : 1);
            DateTime txnDate = req.TransactionDate.Date;

            // 1. EOD Day-End Closed Guard
            var dayStatus = await context.BranchDayEndStatuses
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.BranchID == branchId && b.BusinessDate.Date == txnDate);
            if (dayStatus != null && dayStatus.IsDayClosed)
            {
                throw new InvalidOperationException($"तारीख {txnDate:dd/MM/yyyy} साठी दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेत बचत बल्क ट्रान्सफर करता येणार नाही.");
            }

            var lastClosed = await context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == branchId && b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();
            if (lastClosed != null && txnDate <= lastClosed.BusinessDate.Date)
            {
                throw new InvalidOperationException($"तारीख {txnDate:dd/MM/yyyy} ही शेवटच्या बंद झालेल्या दिवसापेक्षा ({lastClosed.BusinessDate:dd/MM/yyyy}) जुनी किंवा बंद असलेली तारीख आहे.");
            }

            if (req.SavingLedgerId <= 0)
            {
                throw new InvalidOperationException("कृपया प्रथम वैध बचत ठेव लेजर (ठेव लेजर) निवडा.");
            }

            var savingControlIds = await VoucherSavingTransferHelper.GetConfiguredSavingControlLedgerIdsAsync(context);
            if (!savingControlIds.Contains(req.SavingLedgerId))
            {
                throw new InvalidOperationException("निवडलेले ठेव लेजर हे वैध बचत ठेव देयता लेजर (Saving Liability Ledger) नाही.");
            }

            var validItems = (req.Items ?? new List<SavingBulkTransferItemInput>())
                .Where(i => i != null && i.SavingAccountId > 0 && Math.Round(i.Amount, 2, MidpointRounding.AwayFromZero) > 0m)
                .Select(i => new SavingBulkTransferItemInput
                {
                    SavingAccountId = i.SavingAccountId,
                    Amount = Math.Round(i.Amount, 2, MidpointRounding.AwayFromZero),
                    TargetSavingAccountId = i.TargetSavingAccountId
                })
                .ToList();

            if (validItems.Count == 0)
            {
                throw new InvalidOperationException("कृपया किमान एका बचत खात्यासाठी वैध रक्कम (> ०) निवडा.");
            }

            var dupAccount = validItems
                .GroupBy(x => x.SavingAccountId)
                .FirstOrDefault(g => g.Count() > 1);
            if (dupAccount != null)
            {
                throw new InvalidOperationException($"बचत खाते ID #{dupAccount.Key} एकाच बॅचमध्ये दोनदा निवडले गेले आहे.");
            }

            bool isGridCredit = string.Equals(req.Direction?.Trim(), "CREDIT", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(req.Direction?.Trim(), "जमा", StringComparison.OrdinalIgnoreCase) ||
                                string.Equals(req.Direction?.Trim(), "Cr", StringComparison.OrdinalIgnoreCase);

            string gridDrCr = isGridCredit ? "Cr" : "Dr";
            string contraDrCr = isGridCredit ? "Dr" : "Cr";
            string mode = (req.ContraMode ?? "BANK").Trim().ToUpperInvariant();

            var savingLedgerObj = await context.Ledgers.AsNoTracking().FirstOrDefaultAsync(l => l.LedgerID == req.SavingLedgerId)
                ?? throw new InvalidOperationException("निवडलेले ठेव लेजर सापडले नाही.");

            var allSchemes = await context.SavingInterestSettings
                .AsNoTracking()
                .OrderByDescending(s => s.SettingID)
                .ToListAsync();

            var itemSavingIds = validItems.Select(x => x.SavingAccountId).ToList();
            var accountsById = await context.SavingAccountMasters
                .AsNoTracking()
                .Include(s => s.Customer)
                .Include(s => s.SavingScheme)
                .Where(s => itemSavingIds.Contains(s.SavingAccountID))
                .ToDictionaryAsync(s => s.SavingAccountID);

            decimal totalAmount = 0m;
            var voucherDetails = new List<VoucherDetail>();

            foreach (var item in validItems)
            {
                if (!accountsById.TryGetValue(item.SavingAccountId, out var acc))
                {
                    throw new InvalidOperationException($"बचत खाते (ID #{item.SavingAccountId}) सिस्टीममध्ये सापडले नाही.");
                }
                if (acc.BranchID != branchId)
                {
                    throw new InvalidOperationException($"आंतर-शाखा बचत वर्ग अनुमत नाही: बचत खाते #{acc.AccountNo} शाखा क्र. #{acc.BranchID} मधील आहे.");
                }
                if (string.Equals(acc.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(acc.Status, "Frozen", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException($"बचत खाते #{acc.OldAccountNo ?? acc.AccountNo} सध्या '{acc.Status}' स्थितीत आहे.");
                }
                if (acc.LedgerID != req.SavingLedgerId)
                {
                    throw new InvalidOperationException($"बचत खाते #{acc.OldAccountNo ?? acc.AccountNo} निवडलेल्या ठेव लेजरशी संलग्न नाही.");
                }

                if (!isGridCredit) // DEBIT (नावे) from grid Saving accounts
                {
                    if (string.Equals(acc.Status, "Dormant", StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException($"बचत खाते #{acc.OldAccountNo ?? acc.AccountNo} 'Dormant' (सुप्त) असल्याने त्यातून रक्कम नावे करता येणार नाही.");
                    }
                    var (avail, minBal) = await SavingLedgerHelper.ResolveAvailableBalanceAsync(context, acc, allSchemes);
                    if (avail + 0.001m < item.Amount)
                    {
                        throw new InvalidOperationException($"बचत खाते #{acc.OldAccountNo ?? acc.AccountNo} ({acc.Customer?.FirstName} {acc.Customer?.LastName}) मध्ये किमान शिल्लक (₹{minBal:N2}) व तारण वजा जाता फक्त ₹{avail:N2} उपलब्ध आहेत (विनंती: ₹{item.Amount:N2}).");
                    }
                }

                totalAmount = Math.Round(totalAmount + item.Amount, 2, MidpointRounding.AwayFromZero);

                voucherDetails.Add(new VoucherDetail
                {
                    LedgerID = acc.LedgerID,
                    SavingAccountID = acc.SavingAccountID,
                    CustomerID = acc.CustomerID,
                    DrCr = gridDrCr,
                    Amount = item.Amount
                });
            }

            string contraSummary;

            if (mode == "BANK")
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(context, req.ContraLedgerId);
                if (!bankCheck.IsValid)
                {
                    throw new InvalidOperationException(bankCheck.ErrorMessage ?? "कृपया वैध बँक खाते लेजर निवडा.");
                }
                var bankLedger = await context.Ledgers.AsNoTracking().FirstAsync(l => l.LedgerID == bankCheck.LedgerId);
                contraSummary = bankLedger.LedgerName;

                voucherDetails.Add(new VoucherDetail
                {
                    LedgerID = bankLedger.LedgerID,
                    DrCr = contraDrCr,
                    Amount = totalAmount
                });
            }
            else if (mode == "SAVING_ACCOUNT")
            {
                if (!req.ContraSavingAccountId.HasValue || req.ContraSavingAccountId.Value <= 0)
                {
                    throw new InvalidOperationException("कृपया समोरचे बचत खाते (CIF / संस्था बचत खाते) निवडा.");
                }
                if (itemSavingIds.Contains(req.ContraSavingAccountId.Value))
                {
                    throw new InvalidOperationException("समोरचे बचत खाते आणि यादीतील निवडलेले बचत खाते समान असू शकत नाही.");
                }

                var contraAcc = await context.SavingAccountMasters
                    .AsNoTracking()
                    .Include(s => s.Customer)
                    .Include(s => s.SavingScheme)
                    .Include(s => s.Ledger)
                    .FirstOrDefaultAsync(s => s.SavingAccountID == req.ContraSavingAccountId.Value)
                    ?? throw new InvalidOperationException("समोरचे निवडलेले बचत खाते सापडले नाही.");

                if (contraAcc.BranchID != branchId)
                {
                    throw new InvalidOperationException($"आंतर-शाखा बचत वर्ग अनुमत नाही: समोरचे बचत खाते #{contraAcc.AccountNo} वेगळ्या शाखेतील आहे.");
                }
                if (string.Equals(contraAcc.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(contraAcc.Status, "Frozen", StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException($"समोरचे बचत खाते #{contraAcc.OldAccountNo ?? contraAcc.AccountNo} '{contraAcc.Status}' स्थितीत आहे.");
                }

                if (contraDrCr == "Dr")
                {
                    if (string.Equals(contraAcc.Status, "Dormant", StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException($"समोरचे बचत खाते #{contraAcc.OldAccountNo ?? contraAcc.AccountNo} 'Dormant' असल्यामुळे त्यातून एकूण रक्कम नावे करता येणार नाही.");
                    }
                    var (contraAvail, contraMin) = await SavingLedgerHelper.ResolveAvailableBalanceAsync(context, contraAcc, allSchemes);
                    if (contraAvail + 0.001m < totalAmount)
                    {
                        throw new InvalidOperationException($"समोरच्या बचत खात्यात (#{contraAcc.OldAccountNo ?? contraAcc.AccountNo}) पुरेशी शिल्लक नाही! किमान शिल्लक (₹{contraMin:N2}) वगळून उपलब्ध: ₹{contraAvail:N2}, आवश्यक एकूण: ₹{totalAmount:N2}.");
                    }
                }

                string contraCustName = contraAcc.Customer != null
                    ? $"{contraAcc.Customer.FirstName} {contraAcc.Customer.LastName}".Trim()
                    : "";
                contraSummary = $"{contraAcc.Ledger?.LedgerName ?? "बचत खाते"} #{contraAcc.OldAccountNo ?? contraAcc.AccountNo} ({contraCustName})";

                voucherDetails.Add(new VoucherDetail
                {
                    LedgerID = contraAcc.LedgerID,
                    SavingAccountID = contraAcc.SavingAccountID,
                    CustomerID = contraAcc.CustomerID,
                    DrCr = contraDrCr,
                    Amount = totalAmount
                });
            }
            else if (mode == "GL_LEDGER")
            {
                if (!req.ContraLedgerId.HasValue || req.ContraLedgerId.Value <= 0)
                {
                    throw new InvalidOperationException("कृपया लेजर ट्रान्सफरसाठी वैध जनरल लेजर निवडा.");
                }
                var glLedger = await context.Ledgers
                    .AsNoTracking()
                    .Include(l => l.AccountGroup)
                    .FirstOrDefaultAsync(l => l.LedgerID == req.ContraLedgerId.Value && l.IsActive)
                    ?? throw new InvalidOperationException("निवडलेले जनरल लेजर सापडले नाही किंवा निष्क्रिय आहे.");

                if (BankLedgerHelper.IsCashLedger(glLedger))
                {
                    throw new InvalidOperationException("लेजर ट्रान्सफरमध्ये रोख खाते (Cash In Hand) निवडता येत नाही.");
                }
                if (savingControlIds.Contains(glLedger.LedgerID))
                {
                    throw new InvalidOperationException("समोरचे लेजर हे बचत ठेव नियंत्रण खाते असल्यामुळे कृपया 'CIF / बचत खाते ट्रान्सफर' किंवा 'योजना ते योजना बचत वर्ग' पर्याय वापरा.");
                }

                contraSummary = glLedger.LedgerName;
                voucherDetails.Add(new VoucherDetail
                {
                    LedgerID = glLedger.LedgerID,
                    DrCr = contraDrCr,
                    Amount = totalAmount
                });
            }
            else if (mode == "SCHEME_TO_SCHEME")
            {
                if (!req.ContraLedgerId.HasValue || req.ContraLedgerId.Value <= 0)
                {
                    throw new InvalidOperationException("कृपया समोरची टार्गेट बचत योजना / ठेव लेजर निवडा.");
                }
                if (!savingControlIds.Contains(req.ContraLedgerId.Value))
                {
                    throw new InvalidOperationException("समोरचे निवडलेले लेजर हे वैध बचत ठेव देयता लेजर नाही.");
                }
                if (req.ContraLedgerId.Value == req.SavingLedgerId &&
                    (!req.SavingSchemeId.HasValue || !req.ContraTargetSchemeId.HasValue || req.SavingSchemeId.Value == req.ContraTargetSchemeId.Value))
                {
                    throw new InvalidOperationException("मूळ ठेव योजना/लेजर आणि समोरची टार्गेट ठेव योजना/लेजर समान असू शकत नाही.");
                }

                var tgtLedgerObj = await context.Ledgers.AsNoTracking().FirstAsync(l => l.LedgerID == req.ContraLedgerId.Value);
                contraSummary = tgtLedgerObj.LedgerName;

                var customerIds = validItems
                    .Select(i => accountsById[i.SavingAccountId].CustomerID)
                    .Distinct()
                    .ToList();

                var candidateTargets = await context.SavingAccountMasters
                    .AsNoTracking()
                    .Include(s => s.Customer)
                    .Include(s => s.SavingScheme)
                    .Where(s =>
                        s.BranchID == branchId &&
                        s.Status != "Closed" &&
                        s.Status != "Frozen" &&
                        s.LedgerID == req.ContraLedgerId.Value &&
                        customerIds.Contains(s.CustomerID))
                    .OrderBy(s => s.SavingAccountID)
                    .ToListAsync();

                var targetByAccountId = candidateTargets.ToDictionary(t => t.SavingAccountID);
                var defaultTargetByCustomerId = new Dictionary<int, SavingAccountMaster>();
                foreach (var ct in candidateTargets)
                {
                    if (req.ContraTargetSchemeId.HasValue && req.ContraTargetSchemeId.Value > 0 &&
                        ct.SavingSchemeID.HasValue && ct.SavingSchemeID.Value != req.ContraTargetSchemeId.Value)
                    {
                        continue;
                    }
                    if (!defaultTargetByCustomerId.ContainsKey(ct.CustomerID))
                    {
                        defaultTargetByCustomerId[ct.CustomerID] = ct;
                    }
                }

                foreach (var item in validItems)
                {
                    var srcAcc = accountsById[item.SavingAccountId];
                    SavingAccountMaster? tgtAcc = null;
                    if (item.TargetSavingAccountId.HasValue && item.TargetSavingAccountId.Value > 0)
                    {
                        targetByAccountId.TryGetValue(item.TargetSavingAccountId.Value, out tgtAcc);
                    }
                    if (tgtAcc == null)
                    {
                        defaultTargetByCustomerId.TryGetValue(srcAcc.CustomerID, out tgtAcc);
                    }

                    if (tgtAcc == null)
                    {
                        string cName = $"{srcAcc.Customer?.FirstName} {srcAcc.Customer?.LastName}".Trim();
                        throw new InvalidOperationException($"खातेदार '{cName}' (CIF: {srcAcc.Customer?.CIFNo}) याचे '{tgtLedgerObj.LedgerName}' मध्ये सक्रिय बचत खाते आढळले नाही. कृपया प्रथम त्या योजनेत खाते उघडा किंवा त्या खात्याची टिक काढा.");
                    }

                    if (tgtAcc.SavingAccountID == srcAcc.SavingAccountID)
                    {
                        throw new InvalidOperationException($"मूळ बचत खाते आणि समोरचे टार्गेट बचत खाते (#{srcAcc.AccountNo}) समान असू शकत नाही.");
                    }

                    if (contraDrCr == "Dr")
                    {
                        if (string.Equals(tgtAcc.Status, "Dormant", StringComparison.OrdinalIgnoreCase))
                        {
                            throw new InvalidOperationException($"खाते #{tgtAcc.OldAccountNo ?? tgtAcc.AccountNo} 'Dormant' असल्याने त्यातून नावे करता येणार नाही.");
                        }
                        var (tgtAvail, tgtMin) = await SavingLedgerHelper.ResolveAvailableBalanceAsync(context, tgtAcc, allSchemes);
                        if (tgtAvail + 0.001m < item.Amount)
                        {
                            throw new InvalidOperationException($"समोरच्या बचत खात्यात (#{tgtAcc.OldAccountNo ?? tgtAcc.AccountNo}) अपुरी शिल्लक आहे (उपलब्ध: ₹{tgtAvail:N2}, किमान शिल्लक: ₹{tgtMin:N2}, आवश्यक: ₹{item.Amount:N2}).");
                        }
                    }

                    voucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = tgtAcc.LedgerID,
                        SavingAccountID = tgtAcc.SavingAccountID,
                        CustomerID = tgtAcc.CustomerID,
                        DrCr = contraDrCr,
                        Amount = item.Amount
                    });
                }
            }
            else
            {
                throw new InvalidOperationException($"अवैध ट्रान्सफर प्रकार: '{req.ContraMode}'.");
            }

            using var dbTx = await context.Database.BeginTransactionAsync();
            try
            {
                string voucherNo = await VoucherNumberHelper.NextVoucherNoAsync(context, $"JV-SBK-{txnDate:yyyyMMdd}-", 4);
                string dirLabel = isGridCredit ? "बल्क बचत जमा" : "बल्क बचत नावे";
                string userRemark = !string.IsNullOrWhiteSpace(req.Narration) ? $" | {req.Narration.Trim()}" : "";
                string finalNarration = $"{dirLabel} ({savingLedgerObj.LedgerName} ⇄ {contraSummary} | {validItems.Count} खाती){userRemark}";
                if (finalNarration.Length > 480) finalNarration = finalNarration.Substring(0, 480);

                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = voucherNo,
                    ScrollNo = null, // Zero Auto-Post Maker-Checker: ScrollNo assigned strictly on approval
                    VoucherDate = txnDate,
                    VoucherType = "Journal",
                    TotalAmount = totalAmount,
                    Narration = finalNarration,
                    Status = "Pending",
                    CreatedBy = userId > 0 ? userId : 1,
                    CreatedOn = DateTime.Now,
                    VoucherDetails = voucherDetails
                };

                string? linkValidationErr = await VoucherSavingTransferHelper.ValidateAndNormalizeVoucherSavingLinksAsync(
                    context,
                    voucher,
                    branchId);

                if (!string.IsNullOrEmpty(linkValidationErr))
                {
                    throw new InvalidOperationException(linkValidationErr);
                }

                context.Vouchers.Add(voucher);
                await context.SaveChangesAsync();
                await dbTx.CommitAsync();

                return new SavingBulkTransferExecutionResult
                {
                    VoucherId = voucher.VoucherID,
                    VoucherNo = voucher.VoucherNo,
                    ProcessedCount = validItems.Count,
                    TotalAmount = totalAmount,
                    SavingLedgerName = savingLedgerObj.LedgerName,
                    ContraSummary = contraSummary,
                    Message = $"एकूण {validItems.Count} बचत खात्यांचा ₹{totalAmount:N2} चा बल्क ट्रान्सफर व्हाउचर ({voucher.VoucherNo}) मंजुरीसाठी जतन झाला!"
                };
            }
            catch
            {
                await dbTx.RollbackAsync();
                throw;
            }
        }
    }
}

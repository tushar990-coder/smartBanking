using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public static class FdRenewalPolicyHelper
    {
        public const string PolicyNewReceipt = "NEW_RECEIPT";
        public const string PolicyRetainOriginal = "RETAIN_ORIGINAL";
        public const string PolicyNextLegacy = "NEXT_LEGACY";
        public const string PolicyHybridChoice = "HYBRID_CHOICE";
        public const string ModeCustom = "CUSTOM";

        public static bool TryNormalizePolicy(string? rawPolicy, out string normalizedPolicy)
        {
            string trimmed = (rawPolicy ?? string.Empty).Trim().ToUpperInvariant();
            switch (trimmed)
            {
                case PolicyNewReceipt:
                    normalizedPolicy = PolicyNewReceipt;
                    return true;
                case PolicyRetainOriginal:
                    normalizedPolicy = PolicyRetainOriginal;
                    return true;
                case PolicyNextLegacy:
                    normalizedPolicy = PolicyNextLegacy;
                    return true;
                case PolicyHybridChoice:
                    normalizedPolicy = PolicyHybridChoice;
                    return true;
                default:
                    normalizedPolicy = string.Empty;
                    return false;
            }
        }

        public static string GetEffectiveReceiptNo(FdAccount? account)
        {
            if (account == null) return string.Empty;
            if (!string.IsNullOrWhiteSpace(account.ReceiptNo))
                return account.ReceiptNo.Trim();
            if (!string.IsNullOrWhiteSpace(account.LegacyAccountNumber))
                return account.LegacyAccountNumber.Trim();
            return account.AccountNo?.Trim() ?? string.Empty;
        }

        public static async Task<(string Policy, bool AllowManualOverride, string? PolicyError)> GetSansthaRenewalPolicyAsync(AppDbContext context)
        {
            var sanstha = await context.SansthaDetails
                .AsNoTracking()
                .OrderBy(s => s.SansthaID)
                .FirstOrDefaultAsync();

            if (sanstha == null)
            {
                return (string.Empty, false, "संस्था मास्टर (SansthaDetails) तपशील सापडला नाही. कृपया प्रथम संस्था धोरण सेट करा.");
            }

            if (!TryNormalizePolicy(sanstha.FdRenewalReceiptPolicy, out string policy))
            {
                return (string.Empty, false,
                    $"संस्थेचे मुदत ठेव नूतनीकरण पावती धोरण '{sanstha.FdRenewalReceiptPolicy}' अवैध आहे. कृपया संस्था मास्टरमध्ये वैध धोरण निवडा.");
            }

            bool effectiveAllowManual = policy == PolicyRetainOriginal ? false : sanstha.AllowManualReceiptNoOnRenewal;
            return (policy, effectiveAllowManual, null);
        }

        public static (int ParentFdAccountId, int RootFdAccountId, int NextRenewalCycleNo) ComputeRenewalChainMetadata(FdAccount oldAccount)
        {
            int rootId = (oldAccount.RootFdAccountID.HasValue && oldAccount.RootFdAccountID.Value > 0)
                ? oldAccount.RootFdAccountID.Value
                : oldAccount.FdAccountID;

            int nextCycle = oldAccount.RenewalCycleNo + 1;
            return (oldAccount.FdAccountID, rootId, nextCycle);
        }

        public sealed record ResolvedRenewalReceiptResult(
            string ReceiptNo,
            string? LegacyAccountNumber,
            string EffectiveMode,
            string? ValidationError);

        private static (string EffectiveMode, string? ValidationError) ResolveEffectiveModeStrict(
            string sansthaPolicy,
            bool allowManual,
            string? requestedMode,
            string trimmedCustom)
        {
            string reqModeUpper = (requestedMode ?? string.Empty).Trim().ToUpperInvariant();

            if (string.IsNullOrEmpty(reqModeUpper))
            {
                if (sansthaPolicy == PolicyRetainOriginal) return (PolicyRetainOriginal, null);
                if (sansthaPolicy == PolicyNextLegacy) return (PolicyNextLegacy, null);
                if (sansthaPolicy == PolicyHybridChoice) return (PolicyNewReceipt, null);
                return (PolicyNewReceipt, null);
            }

            if (reqModeUpper != PolicyNewReceipt &&
                reqModeUpper != PolicyRetainOriginal &&
                reqModeUpper != PolicyNextLegacy &&
                reqModeUpper != ModeCustom)
            {
                return (reqModeUpper, $"अवैध पावती क्रमांक मोड '{requestedMode}'. वैध पर्याय: NEW_RECEIPT, RETAIN_ORIGINAL, NEXT_LEGACY, CUSTOM.");
            }

            if (sansthaPolicy == PolicyRetainOriginal)
            {
                if (reqModeUpper != PolicyRetainOriginal)
                {
                    return (reqModeUpper,
                        "संस्थेचे धोरण 'मूळ पावती क्र. कायम ठेवा (RETAIN_ORIGINAL)' असल्यामुळे फक्त मूळ पावती क्रमांकच पुढे नेता येतो.");
                }
                return (PolicyRetainOriginal, null);
            }

            if (reqModeUpper == ModeCustom)
            {
                if (!allowManual)
                {
                    return (ModeCustom,
                        "संस्थेने नूतनीकरणावेळी मॅन्युअल / कस्टम पावती क्रमांकास परवानगी (AllowManualReceiptNoOnRenewal) दिलेली नाही.");
                }
                if (string.IsNullOrWhiteSpace(trimmedCustom))
                {
                    return (ModeCustom, "कस्टम पावती क्रमांक प्रविष्ट करणे आवश्यक आहे.");
                }
                return (ModeCustom, null);
            }

            if (sansthaPolicy == PolicyNextLegacy && reqModeUpper != PolicyNextLegacy)
            {
                return (reqModeUpper,
                    "संस्थेचे धोरण 'पुढील जुना FD क्रमांक द्या (NEXT_LEGACY)' असल्यामुळे फक्त पुढील जुना FD क्रमांक (किंवा परवानगी असल्यास कस्टम) वापरता येतो.");
            }

            if (sansthaPolicy == PolicyNewReceipt && reqModeUpper != PolicyNewReceipt)
            {
                return (reqModeUpper,
                    "संस्थेचे धोरण 'नवीन पावती क्रमांक द्या (NEW_RECEIPT)' असल्यामुळे इतर पावती मोड वापरता येत नाही.");
            }

            return (reqModeUpper, null);
        }

        /// <summary>
        /// Generates the next collision-free sequential LegacyAccountNumber for a Branch + Scheme
        /// without falling back on duplicates or existing live receipt numbers.
        /// </summary>
        public static async Task<string> GenerateNextLegacyAccountNoAsync(
            AppDbContext context,
            int branchId,
            int? schemeId)
        {
            var query = context.FdAccounts
                .AsNoTracking()
                .Where(a => a.BranchID == branchId && a.LegacyAccountNumber != null && a.LegacyAccountNumber != "");

            if (schemeId.HasValue && schemeId.Value > 0)
            {
                query = query.Where(a => a.FdSchemeID == schemeId.Value);
            }

            var legacyList = await query.Select(a => a.LegacyAccountNumber!).ToListAsync();
            long maxLegacySeq = 0;
            var existingSchemeLegacySet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var raw in legacyList)
            {
                if (string.IsNullOrWhiteSpace(raw)) continue;
                string trimmed = raw.Trim();
                existingSchemeLegacySet.Add(trimmed);

                if (long.TryParse(trimmed, out long exactNum) && exactNum > 0 && exactNum < 1000000000L)
                {
                    if (exactNum > maxLegacySeq) maxLegacySeq = exactNum;
                }
                else
                {
                    var match = System.Text.RegularExpressions.Regex.Match(trimmed, @"(\d+)$");
                    if (match.Success && long.TryParse(match.Groups[1].Value, out long suffixNum) && suffixNum > 0 && suffixNum < 1000000000L)
                    {
                        if (suffixNum > maxLegacySeq) maxLegacySeq = suffixNum;
                    }
                }
            }

            long nextSeq = maxLegacySeq > 0 ? maxLegacySeq + 1 : 1;
            while (true)
            {
                string candidate = nextSeq.ToString();
                if (!existingSchemeLegacySet.Contains(candidate))
                {
                    var conflict = await FindUnrelatedActiveReceiptConflictAsync(
                        context, branchId, chainRootId: 0, currentParentId: 0, candidate, schemeId: schemeId);
                    if (conflict == null)
                    {
                        return candidate;
                    }
                }
                nextSeq++;
            }
        }

        private static string FormatConflictScopeText(FdAccount conflict, int targetSchemeId)
        {
            string schemeLabel = !string.IsNullOrWhiteSpace(conflict.FdScheme?.SchemeName)
                ? $" ({conflict.FdScheme!.SchemeName})"
                : string.Empty;
            return conflict.FdSchemeID == targetSchemeId
                ? $"त्याच योजनेतील{schemeLabel} "
                : $"वेगळ्या योजनेतील{schemeLabel} CBS खाते ";
        }

        /// <summary>
        /// Strict Zero-Fallback policy engine for FD renewal ReceiptNo & LegacyAccountNumber.
        /// Validates requested mode against Sanstha policy and AllowManualReceiptNoOnRenewal,
        /// permits same-chain propagation across RootFdAccountID, keeps 14-digit CBS AccountNo
        /// unique branch-wide, and scopes ReceiptNo/LegacyAccountNumber conflict detection to
        /// the target scheme (BranchID + FdSchemeID).
        /// </summary>
        public static async Task<ResolvedRenewalReceiptResult> ResolveRenewalReceiptNumbersAsync(
            AppDbContext context,
            FdAccount oldAccount,
            int targetSchemeId,
            string newCbsAccountNo,
            string formattedNewCbsAccountNo,
            string? requestedMode = null,
            string? customReceiptNo = null)
        {
            var (sansthaPolicy, allowManual, policyError) = await GetSansthaRenewalPolicyAsync(context);
            if (!string.IsNullOrEmpty(policyError))
            {
                return new ResolvedRenewalReceiptResult(string.Empty, null, string.Empty, policyError);
            }

            var (_, rootId, _) = ComputeRenewalChainMetadata(oldAccount);
            string trimmedCustom = (customReceiptNo ?? string.Empty).Trim();

            var (effectiveMode, modeError) = ResolveEffectiveModeStrict(
                sansthaPolicy,
                allowManual,
                requestedMode,
                trimmedCustom);

            if (!string.IsNullOrEmpty(modeError))
            {
                return new ResolvedRenewalReceiptResult(string.Empty, null, effectiveMode, modeError);
            }

            if (effectiveMode == PolicyRetainOriginal)
            {
                string retainedReceipt = GetEffectiveReceiptNo(oldAccount);
                if (string.IsNullOrWhiteSpace(retainedReceipt))
                {
                    return new ResolvedRenewalReceiptResult(
                        string.Empty,
                        null,
                        effectiveMode,
                        $"मूळ ठेव खाते क्र. '{oldAccount.AccountNo}' साठी वैध पावती क्रमांक उपलब्ध नाही.");
                }

                string? retainedLegacy = !string.IsNullOrWhiteSpace(oldAccount.LegacyAccountNumber)
                    ? oldAccount.LegacyAccountNumber.Trim()
                    : null;

                var conflict = await FindUnrelatedActiveReceiptConflictAsync(
                    context, oldAccount.BranchID, rootId, oldAccount.FdAccountID, retainedReceipt, schemeId: targetSchemeId);
                if (conflict != null)
                {
                    return new ResolvedRenewalReceiptResult(
                        retainedReceipt,
                        retainedLegacy,
                        effectiveMode,
                        $"मूळ पावती क्र. '{retainedReceipt}' आधीच {FormatConflictScopeText(conflict, targetSchemeId)}दुसऱ्या सक्रिय ठेव खात्यावर ({conflict.AccountNo}) वापरला जात आहे.");
                }

                return new ResolvedRenewalReceiptResult(retainedReceipt, retainedLegacy, effectiveMode, null);
            }

            if (effectiveMode == ModeCustom)
            {
                var conflict = await FindUnrelatedActiveReceiptConflictAsync(
                    context, oldAccount.BranchID, rootId, oldAccount.FdAccountID, trimmedCustom, schemeId: targetSchemeId);
                if (conflict != null)
                {
                    return new ResolvedRenewalReceiptResult(
                        trimmedCustom,
                        trimmedCustom,
                        effectiveMode,
                        $"पावती क्रमांक '{trimmedCustom}' आधीच {FormatConflictScopeText(conflict, targetSchemeId)}सक्रिय ठेव खाते क्र. '{conflict.AccountNo}' साठी नोंदवला आहे. कृपया वेगळा पावती क्रमांक द्या.");
                }

                return new ResolvedRenewalReceiptResult(trimmedCustom, trimmedCustom, effectiveMode, null);
            }

            if (effectiveMode == PolicyNextLegacy)
            {
                string nextLegacyNo = await GenerateNextLegacyAccountNoAsync(context, oldAccount.BranchID, targetSchemeId);
                return new ResolvedRenewalReceiptResult(nextLegacyNo, nextLegacyNo, PolicyNextLegacy, null);
            }

            // PolicyNewReceipt
            string displayNewNo = !string.IsNullOrWhiteSpace(formattedNewCbsAccountNo)
                ? formattedNewCbsAccountNo.Trim()
                : newCbsAccountNo.Trim();

            var newNoConflict = await FindUnrelatedActiveReceiptConflictAsync(
                context, oldAccount.BranchID, rootId, oldAccount.FdAccountID, displayNewNo, schemeId: targetSchemeId);
            if (newNoConflict != null)
            {
                return new ResolvedRenewalReceiptResult(
                    displayNewNo,
                    null,
                    PolicyNewReceipt,
                    $"नवीन पावती क्र. '{displayNewNo}' आधीच {FormatConflictScopeText(newNoConflict, targetSchemeId)}सक्रिय ठेव खाते क्र. '{newNoConflict.AccountNo}' साठी वापरला जात आहे.");
            }

            return new ResolvedRenewalReceiptResult(displayNewNo, null, PolicyNewReceipt, null);
        }

        public static async Task<FdAccount?> FindUnrelatedActiveReceiptConflictAsync(
            AppDbContext context,
            int branchId,
            int chainRootId,
            int currentParentId,
            string receiptNo,
            int? schemeId = null)
        {
            var variants = FdRenewalRollbackHelper.BuildAccountNumberVariants(receiptNo);
            if (!variants.Any()) return null;

            bool filterByScheme = schemeId.HasValue && schemeId.Value > 0;
            int targetSchemeId = schemeId ?? 0;

            return await context.FdAccounts
                .Include(a => a.FdScheme)
                .AsNoTracking()
                .FirstOrDefaultAsync(a =>
                    a.BranchID == branchId &&
                    a.FdAccountID != currentParentId &&
                    (chainRootId <= 0 || (a.FdAccountID != chainRootId && (a.RootFdAccountID == null || a.RootFdAccountID != chainRootId))) &&
                    a.Status != "Closed" &&
                    a.Status != "Renewed" &&
                    (
                        (a.AccountNo != null && variants.Contains(a.AccountNo.Trim())) ||
                        (
                            (!filterByScheme || a.FdSchemeID == targetSchemeId) &&
                            (
                                (a.ReceiptNo != null && variants.Contains(a.ReceiptNo.Trim())) ||
                                (a.LegacyAccountNumber != null && variants.Contains(a.LegacyAccountNumber.Trim()))
                            )
                        )
                    ));
        }
    }
}

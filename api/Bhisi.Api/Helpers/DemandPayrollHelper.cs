using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    public static class DemandPayrollHelper
    {
        public static string ResolveEmpCode(Customer? customer, Dictionary<string, string> empBankCodeByCif)
        {
            if (customer == null) return string.Empty;
            if (!string.IsNullOrWhiteSpace(customer.EmployeeCode))
                return customer.EmployeeCode.Trim();
            if (!string.IsNullOrWhiteSpace(customer.CIFNo) &&
                empBankCodeByCif.TryGetValue(customer.CIFNo.Trim(), out string? bankEmpId) &&
                !string.IsNullOrWhiteSpace(bankEmpId))
            {
                return bankEmpId.Trim();
            }
            if (!string.IsNullOrWhiteSpace(customer.LegacyCustomerNo))
                return customer.LegacyCustomerNo.Trim();
            return customer.CIFNo ?? string.Empty;
        }

        /// <summary>
        /// Finds the active Thrift/Saving account for the configured scheme (or falls back to active customer saving account),
        /// or provisions a new CBS 14-digit SavingAccountMaster when auto-open is enabled during bulk demand recovery.
        /// </summary>
        public static async Task<(SavingAccountMaster? Account, int LiabilityLedgerId, string? ErrorMessage)> ResolveOrProvisionThriftSavingAccountAsync(
            AppDbContext context,
            int branchId,
            int customerId,
            int? savingSchemeId,
            int? explicitCreditLedgerId,
            DateTime openingDate,
            bool autoCreateIfMissing)
        {
            var query = context.SavingAccountMasters
                .Where(s => s.CustomerID == customerId && s.Status == "Active");

            SavingAccountMaster? acc = null;
            if (savingSchemeId.HasValue && savingSchemeId.Value > 0)
            {
                acc = await query
                    .OrderByDescending(s => s.SavingSchemeID == savingSchemeId.Value ? 1 : 0)
                    .ThenBy(s => s.SavingAccountID)
                    .FirstOrDefaultAsync(s => s.SavingSchemeID == savingSchemeId.Value);
            }

            if (acc == null && (!savingSchemeId.HasValue || savingSchemeId.Value <= 0))
            {
                acc = await query.OrderBy(s => s.SavingAccountID).FirstOrDefaultAsync();
            }

            if (acc != null)
            {
                int liabId = explicitCreditLedgerId ?? 0;
                if (liabId <= 0)
                {
                    liabId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(context, acc, explicitSchemeId: savingSchemeId);
                }
                return (acc, liabId, liabId > 0 ? null : SavingLedgerHelper.GetMissingMappingErrorMessage(acc.AccountNo));
            }

            if (!autoCreateIfMissing)
            {
                return (null, 0, "निवडलेल्या कर्मचाऱ्याचे 'संजीवनी / वर्गणी ठेव' खाते उघडलेले नाही.");
            }

            SavingInterestSetting? scheme = null;
            if (savingSchemeId.HasValue && savingSchemeId.Value > 0)
            {
                scheme = await context.SavingInterestSettings.FindAsync(savingSchemeId.Value);
            }
            scheme ??= await context.SavingInterestSettings.OrderBy(s => s.SettingID).FirstOrDefaultAsync();

            int resolvedLiabLedgerId = explicitCreditLedgerId ?? 0;
            if (resolvedLiabLedgerId <= 0)
            {
                resolvedLiabLedgerId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(context, explicitSchemeId: scheme?.SettingID);
            }
            if (resolvedLiabLedgerId <= 0)
            {
                return (null, 0, SavingLedgerHelper.GetMissingMappingErrorMessage());
            }

            int schemeCodeNum = 101;
            if (scheme != null && !string.IsNullOrWhiteSpace(scheme.SchemeCode))
            {
                var digits = new string(scheme.SchemeCode.Where(char.IsDigit).ToArray());
                if (!string.IsNullOrEmpty(digits) && int.TryParse(digits, out int parsed) && parsed > 0)
                    schemeCodeNum = parsed;
            }

            var branch = await context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == branchId);
            int branchNum = branchId;
            if (branch != null && !string.IsNullOrWhiteSpace(branch.BranchCode))
            {
                var bDigits = new string(branch.BranchCode.Where(char.IsDigit).ToArray());
                if (!string.IsNullOrEmpty(bDigits) && int.TryParse(bDigits, out int bParsed) && bParsed > 0)
                    branchNum = bParsed;
            }

            var existingAccNos = await context.SavingAccountMasters
                .AsNoTracking()
                .Where(s => s.BranchID == branchId && !string.IsNullOrWhiteSpace(s.AccountNo))
                .Select(s => s.AccountNo)
                .ToListAsync();
            var localAccNos = context.SavingAccountMasters.Local
                .Where(s => s.BranchID == branchId && !string.IsNullOrWhiteSpace(s.AccountNo))
                .Select(s => s.AccountNo)
                .ToList();
            var existingSet = new HashSet<string>(existingAccNos.Concat(localAccNos), StringComparer.OrdinalIgnoreCase);

            int maxSeq = 0;
            foreach (var raw in existingSet)
            {
                var d = new string(raw.Where(char.IsDigit).ToArray());
                if (d.Length == 14 && int.TryParse(d.Substring(6, 7), out int parsedSeq) && parsedSeq > maxSeq)
                    maxSeq = parsedSeq;
            }

            var seqRow = await context.SavingAccountSequences
                .FirstOrDefaultAsync(s => s.BranchID == branchId && s.SchemeCodeNumeric == schemeCodeNum);
            if (seqRow == null)
            {
                seqRow = new SavingAccountSequence
                {
                    BranchID = branchId,
                    SchemeCodeNumeric = schemeCodeNum,
                    LastSequenceNumber = maxSeq,
                    UpdatedOn = DateTime.UtcNow
                };
                context.SavingAccountSequences.Add(seqRow);
                await context.SaveChangesAsync();
            }

            int nextSeq = Math.Max(seqRow.LastSequenceNumber, maxSeq) + 1;
            string accountNo = AccountNumberHelper.Generate14DigitAccountNo(branchNum, schemeCodeNum, nextSeq);
            while (existingSet.Contains(accountNo))
            {
                nextSeq++;
                accountNo = AccountNumberHelper.Generate14DigitAccountNo(branchNum, schemeCodeNum, nextSeq);
            }
            seqRow.LastSequenceNumber = nextSeq;
            seqRow.UpdatedOn = DateTime.UtcNow;

            var newAcc = new SavingAccountMaster
            {
                BranchID = branchId,
                AccountNo = accountNo,
                SavingSchemeID = scheme?.SettingID,
                CustomerID = customerId,
                AccountType = scheme?.SchemeName ?? "संजीवनी ठेव",
                OpeningDate = openingDate.Date,
                LedgerID = resolvedLiabLedgerId,
                OpeningBalance = 0m,
                CurrentBalance = 0m,
                InterestRate = scheme?.InterestRate ?? 0m,
                MinimumBalance = scheme?.MinimumBalance ?? 0m,
                Status = "Active",
                CreatedOn = DateTime.Now
            };
            context.SavingAccountMasters.Add(newAcc);
            await context.SaveChangesAsync();

            return (newAcc, resolvedLiabLedgerId, null);
        }
    }
}

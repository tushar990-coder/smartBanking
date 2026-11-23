using System;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    public static class GoldCustodyAndBorrowingHelper
    {
        public static bool HasGoldKeyword(string? text)
        {
            if (string.IsNullOrWhiteSpace(text)) return false;
            var lower = text.Trim().ToLowerInvariant();
            return lower.Contains("gold")
                || lower.Contains("सोने")
                || lower.Contains("सोन्या")
                || lower.Contains("सुवर्ण")
                || lower.Contains("दागिन")
                || lower.Contains("अलंकार")
                || lower.Contains("ornament")
                || lower.Contains("jewel");
        }

        public static bool IsGoldLoanAccount(
            LoanAccount? account,
            LoanRate? rate = null,
            LoanApplication? application = null,
            bool hasGoldDetailRows = false)
        {
            if (hasGoldDetailRows) return true;
            var r = rate ?? account?.LoanRate ?? application?.LoanRate;
            if (r != null)
            {
                if (string.Equals(r.CollateralCategory, "Gold", StringComparison.OrdinalIgnoreCase))
                    return true;
                if (HasGoldKeyword(r.LoanType) || HasGoldKeyword(r.ShortName))
                    return true;
            }
            if (account != null && HasGoldKeyword(account.SecurityDetails))
                return true;
            if (application != null && HasGoldKeyword(application.SecurityDetails))
                return true;

            return false;
        }

        public static string FormatCustodyLocationSummary(
            GoldLoanCustody? custody,
            Locker? ownLocker = null,
            SansthaExternalLocker? extLocker = null,
            SansthaBorrowing? borrowing = null)
        {
            if (custody == null)
                return "तिजोरी नोंद बाकी (Pending Custody Setup)";

            var lkr = ownLocker ?? custody.OwnLocker;
            var ext = extLocker ?? custody.ExternalLocker;
            var brw = borrowing ?? custody.ActiveBorrowing;

            return custody.CustodyStatus switch
            {
                "OWN_LOCKER" => lkr != null
                    ? $"संस्था लॉकर: कपाट {lkr.CabinetNo}, लॉकर क्र. {lkr.LockerNo} (चावी: {lkr.KeyNo})"
                    : $"संस्था लॉकर ID #{custody.OwnLockerID}",
                "EXTERNAL_LOCKER" => ext != null
                    ? $"बाह्य बँक लॉकर: {ext.BankOrSocietyName}{(string.IsNullOrWhiteSpace(ext.BankBranchName) ? "" : $" ({ext.BankBranchName})")} — लॉकर क्र. {ext.LockerNo}"
                    : $"बाह्य बँक लॉकर ID #{custody.ExternalLockerID}",
                "REPLEDGED_BORROWING" => brw != null
                    ? $"पुनर्गहाण (Re-pledged): {brw.LenderName} — कर्ज क्र. {brw.BorrowingNo}{(string.IsNullOrWhiteSpace(brw.ExternalLoanAccountNo) ? "" : $" (A/c: {brw.ExternalLoanAccountNo})")}"
                    : $"पुनर्गहाण बाह्य कर्ज ID #{custody.ActiveBorrowingID}",
                "RELEASED_TO_CUSTOMER" => $"खातेदारास सुपूर्द ({custody.ReleasedDate:dd/MM/yyyy}{(string.IsNullOrWhiteSpace(custody.ReleaseReceiptNo) ? "" : $", पावती: {custody.ReleaseReceiptNo}")})",
                _ => !string.IsNullOrWhiteSpace(custody.VaultRackOrTrayNo)
                    ? $"शाखा तिजोरी (रॅक/ट्रे: {custody.VaultRackOrTrayNo})"
                    : "शाखा मुख्य तिजोरी (Branch Safe)"
            };
        }

        public static async Task<GoldLoanCustody> EnsureOrSyncGoldCustodyAsync(
            AppDbContext db,
            LoanAccount loanAccount,
            int userId = 1,
            DateTime? businessDate = null)
        {
            var goldRows = await db.GoldLoanDetails
                .AsNoTracking()
                .Where(g => g.LoanAccountID == loanAccount.LoanAccountID ||
                            (loanAccount.LoanApplicationID.HasValue && g.LoanApplicationID == loanAccount.LoanApplicationID.Value))
                .ToListAsync();

            int totalQty = goldRows.Sum(g => g.Quantity > 0 ? g.Quantity : 1);
            decimal totalGross = Math.Round(goldRows.Sum(g => g.GrossWeight), 3, MidpointRounding.AwayFromZero);
            decimal totalNet = Math.Round(goldRows.Sum(g => g.NetWeight), 3, MidpointRounding.AwayFromZero);
            decimal totalVal = Math.Round(
                goldRows.Sum(g => g.ValuerValuation > 0 ? g.ValuerValuation : g.EstimatedValue),
                2,
                MidpointRounding.AwayFromZero);

            if (totalVal <= 0m && loanAccount.SecurityValue > 0m)
            {
                totalVal = loanAccount.SecurityValue;
            }

            var custody = await db.GoldLoanCustodies
                .FirstOrDefaultAsync(c => c.LoanAccountID == loanAccount.LoanAccountID);

            DateTime effectiveDate = (businessDate ?? loanAccount.LoanDisbursementDate ?? loanAccount.OpeningDate).Date;

            if (custody == null)
            {
                string accTag = string.IsNullOrWhiteSpace(loanAccount.LoanAccountNo)
                    ? loanAccount.LoanAccountID.ToString("D4")
                    : loanAccount.LoanAccountNo.Trim();

                custody = new GoldLoanCustody
                {
                    LoanAccountID = loanAccount.LoanAccountID,
                    BranchID = loanAccount.BranchID > 0 ? loanAccount.BranchID : 1,
                    PacketNumber = $"PKT-{accTag}",
                    CustodyStatus = "BRANCH_SAFE",
                    VaultRackOrTrayNo = "मुख्य तिजोरी",
                    TotalOrnamentsCount = totalQty,
                    TotalGrossWeight = totalGross,
                    TotalNetWeight = totalNet,
                    TotalValuationAmount = totalVal,
                    CustodyReceivedDate = effectiveDate,
                    LastLocationUpdatedDate = effectiveDate,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                };
                db.GoldLoanCustodies.Add(custody);
                await db.SaveChangesAsync();

                db.GoldCustodyMovementLogs.Add(new GoldCustodyMovementLog
                {
                    GoldCustodyID = custody.GoldCustodyID,
                    LoanAccountID = loanAccount.LoanAccountID,
                    FromStatus = null,
                    ToStatus = "BRANCH_SAFE",
                    FromLocationSummary = "खातेदाराकडून तारण स्वीकारले",
                    ToLocationSummary = FormatCustodyLocationSummary(custody),
                    MovementDate = effectiveDate,
                    MovedByUserID = userId,
                    Remarks = "सोने तारण कर्ज वाटप प्रारंभिक तिजोरी नोंद"
                });
                await db.SaveChangesAsync();
            }
            else
            {
                custody.TotalOrnamentsCount = totalQty;
                custody.TotalGrossWeight = totalGross;
                custody.TotalNetWeight = totalNet;
                custody.TotalValuationAmount = totalVal;
                custody.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }

            return custody;
        }

        public static async Task<(bool IsValid, Ledger? Ledger, string? ErrorMessage)> ValidateBorrowingLiabilityLedgerAsync(
            AppDbContext db,
            int? ledgerId)
        {
            if (!ledgerId.HasValue || ledgerId.Value <= 0)
                return (false, null, "बाह्य कर्जासाठी 'देणे कर्ज (Borrowing Liability) GL लेजर' निवडणे आवश्यक आहे.");

            var ledger = await db.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == ledgerId.Value && l.IsActive);

            if (ledger == null)
                return (false, null, "निवडलेले देणे कर्ज GL लेजर सक्रिय नाही किंवा सापडले नाही.");

            if (BankLedgerHelper.IsCashLedger(ledger) || BankLedgerHelper.IsBankLedger(ledger))
                return (false, ledger, $"देणे कर्ज लेजर म्हणून रोख किंवा बँक खाते ('{ledger.LedgerName}') वापरता येत नाही.");

            string nature = (ledger.AccountGroup?.NatureOfGroup ?? string.Empty).Trim();
            if (!string.Equals(nature, "Liabilities", StringComparison.OrdinalIgnoreCase))
                return (false, ledger, $"देणे कर्ज मुद्दल लेजर '{ledger.LedgerName}' हे 'Liabilities' (देयता) गटातील असणे आवश्यक आहे (सध्या: {nature}).");

            return (true, ledger, null);
        }

        public static async Task<(bool IsValid, Ledger? Ledger, string? ErrorMessage)> ValidateBorrowingInterestExpenseLedgerAsync(
            AppDbContext db,
            int? ledgerId)
        {
            if (!ledgerId.HasValue || ledgerId.Value <= 0)
                return (false, null, "बाह्य कर्जासाठी 'देणे कर्ज व्याज खर्च (Interest Expense) GL लेजर' निवडणे आवश्यक आहे.");

            var ledger = await db.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.LedgerID == ledgerId.Value && l.IsActive);

            if (ledger == null)
                return (false, null, "निवडलेले व्याज खर्च GL लेजर सक्रिय नाही किंवा सापडले नाही.");

            if (BankLedgerHelper.IsCashLedger(ledger) || BankLedgerHelper.IsBankLedger(ledger))
                return (false, ledger, $"व्याज खर्च लेजर म्हणून रोख किंवा बँक खाते ('{ledger.LedgerName}') वापरता येत नाही.");

            string nature = (ledger.AccountGroup?.NatureOfGroup ?? string.Empty).Trim();
            if (!string.Equals(nature, "Expenses", StringComparison.OrdinalIgnoreCase))
                return (false, ledger, $"व्याज खर्च लेजर '{ledger.LedgerName}' हे 'Expenses' (खर्च) गटातील असणे आवश्यक आहे (सध्या: {nature}).");

            return (true, ledger, null);
        }

        public static async Task<(bool IsValid, int LedgerId, string NormalizedMode, string? ErrorMessage)> ResolveSettlementLedgerAsync(
            AppDbContext db,
            int branchId,
            string? paymentMode,
            int? bankLedgerId)
        {
            string mode = string.IsNullOrWhiteSpace(paymentMode) ? "Bank" : paymentMode.Trim();
            if (string.Equals(mode, "Cash", StringComparison.OrdinalIgnoreCase))
            {
                int cashLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(db, branchId, "BORROWING");
                if (cashLedgerId <= 0)
                    return (false, 0, "Cash", "शाखेसाठी रोख (Cash) GL खाते कॉन्फिगर केलेले नाही.");
                return (true, cashLedgerId, "Cash", null);
            }

            if (BankLedgerHelper.IsBankPaymentMode(mode))
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(db, bankLedgerId);
                if (!bankCheck.IsValid)
                    return (false, 0, mode, bankCheck.ErrorMessage);
                return (true, bankCheck.LedgerId, mode, null);
            }

            return (false, 0, mode, $"अवैध पेमेंट पद्धत: '{mode}'. कृपया Bank किंवा Cash निवडा.");
        }
    }
}

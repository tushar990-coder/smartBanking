using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Core Banking Solutions (CBS) Helper for Inter-Branch Transfer (IBT) Accounting.
    /// Resolves or dynamically provisions the Inter-Branch Transfer Ledger for cross-branch operations.
    /// </summary>
    public static class IbtLedgerHelper
    {
        public const string StandardIbtGroupName = "आंतर-शाखा तडजोड (Inter-Branch Adjustments)";
        public const string StandardIbtLedgerName = "आंतर-शाखा हस्तांतरण खाते (Inter-Branch Transfer Account)";
        public const string StandardIbtGroupCode = "2.9";
        public const string StandardIbtLedgerCode = "IBT-001";

        /// <summary>
        /// Gets or auto-creates the Inter-Branch Transfer (IBT) Ledger ID for a branch.
        /// Priority:
        /// 1. Branch.DefaultIbtLedgerID (Explicitly configured on Branch Master)
        /// 2. Dedicated Ledger matching target branch if exists (e.g., "आंतर-शाखा खाते - शाखा २")
        /// 3. Standard IBT Ledger ("आंतर-शाखा हस्तांतरण खाते" / "Inter-Branch Transfer Account")
        /// 4. Auto-provisions Group and Ledger if missing (Self-healing).
        /// </summary>
        public static async Task<int> GetIbtLedgerIdAsync(AppDbContext context, int branchId, int? targetBranchId = null)
        {
            // 1. Check if branch has an explicitly mapped DefaultIbtLedgerID
            if (branchId > 0)
            {
                var branch = await context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == branchId);
                if (branch?.DefaultIbtLedgerID.HasValue == true && branch.DefaultIbtLedgerID.Value > 0)
                {
                    var exists = await context.Ledgers.AnyAsync(l => l.LedgerID == branch.DefaultIbtLedgerID.Value && l.IsActive);
                    if (exists) return branch.DefaultIbtLedgerID.Value;
                }
            }

            // 2. Search for dedicated target-branch IBT ledger if targetBranchId is specified
            if (targetBranchId.HasValue && targetBranchId.Value > 0)
            {
                var targetBranch = await context.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.BranchID == targetBranchId.Value);
                if (targetBranch != null)
                {
                    string targetNameClean = targetBranch.BranchName.Replace("शाखा", "").Replace("ब्रांच", "").Trim();
                    var branchSpecificIbt = await context.Ledgers.AsNoTracking()
                        .FirstOrDefaultAsync(l => l.IsActive &&
                            (l.LedgerName.Contains("आंतर-शाखा") || l.LedgerName.Contains("IBT") || l.LedgerName.Contains("Inter-Branch")) &&
                            (l.LedgerName.Contains(targetNameClean) || (!string.IsNullOrEmpty(targetBranch.BranchCode) && l.LedgerName.Contains(targetBranch.BranchCode))));

                    if (branchSpecificIbt != null)
                    {
                        return branchSpecificIbt.LedgerID;
                    }
                }
            }

            // 3. Search for standard IBT Ledger
            var standardIbt = await context.Ledgers.AsNoTracking()
                .FirstOrDefaultAsync(l => l.IsActive &&
                    (l.LedgerName == StandardIbtLedgerName ||
                     l.LedgerName.Contains("आंतर-शाखा हस्तांतरण") ||
                     l.LedgerName.Contains("Inter-Branch Transfer") ||
                     l.LedgerCode == StandardIbtLedgerCode ||
                     l.LedgerName == "आंतर-शाखा खाते"));

            if (standardIbt != null)
            {
                return standardIbt.LedgerID;
            }

            // 4. Self-Healing: Provision the Standard IBT Account Group & Ledger if missing
            return await EnsureIbtLedgerProvisionedAsync(context);
        }

        /// <summary>
        /// Self-healing method to ensure the IBT Account Group and Ledger exist in the database.
        /// </summary>
        public static async Task<int> EnsureIbtLedgerProvisionedAsync(AppDbContext context)
        {
            var existingLedger = await context.Ledgers
                .FirstOrDefaultAsync(l => l.LedgerName == StandardIbtLedgerName ||
                                         l.LedgerName.Contains("आंतर-शाखा हस्तांतरण") ||
                                         l.LedgerCode == StandardIbtLedgerCode);

            if (existingLedger != null)
            {
                return existingLedger.LedgerID;
            }

            // Ensure Account Group exists
            var group = await context.AccountGroups
                .FirstOrDefaultAsync(g => g.GroupName == StandardIbtGroupName ||
                                         g.GroupName.Contains("आंतर-शाखा") ||
                                         g.GroupName.Contains("Inter-Branch"));

            if (group == null)
            {
                // Find parent liabilities or assets group
                var parentGroup = await context.AccountGroups
                    .FirstOrDefaultAsync(g => g.GroupName.Contains("देयता") || g.GroupName.Contains("देणी") || g.GroupName.Contains("Liabilities") || g.NatureOfGroup == "Liabilities");

                group = new AccountGroup
                {
                    GroupName = StandardIbtGroupName,
                    GroupNameEnglish = "Inter-Branch Adjustments",
                    GroupCode = StandardIbtGroupCode,
                    NatureOfGroup = "Liabilities",
                    ParentGroupID = parentGroup?.GroupID,
                    DisplayOrder = 95,
                    IsActive = true
                };

                context.AccountGroups.Add(group);
                await context.SaveChangesAsync();
            }

            // Create Standard IBT Ledger
            var newLedger = new Ledger
            {
                GroupID = group.GroupID,
                LedgerName = StandardIbtLedgerName,
                LedgerNameEnglish = "Inter-Branch Transfer Account",
                LedgerCode = StandardIbtLedgerCode,
                AccountType = "Nominal",
                ReportType = "BalanceSheet",
                OpeningBalance = 0,
                OpeningBalanceType = "Dr",
                IsActive = true
            };

            context.Ledgers.Add(newLedger);
            await context.SaveChangesAsync();

            return newLedger.LedgerID;
        }

        /// <summary>
        /// Audits and heals historical cross-branch loan collections that were created with only a single voucher,
        /// ensuring past branch trial balances and balance sheets tally cleanly.
        /// </summary>
        public static async Task<int> RepairHistoricalCrossBranchCollectionsAsync(AppDbContext context)
        {
            var unhealedCollections = await context.LoanCollections
                .Include(c => c.LoanAccount)
                .Include(c => c.Voucher)
                    .ThenInclude(v => v!.VoucherDetails)
                .Where(c => c.IsCrossBranch && 
                            c.HomeBranchID.HasValue && 
                            c.BranchID != c.HomeBranchID && 
                            c.VoucherID.HasValue && 
                            !c.HomeBranchVoucherID.HasValue)
                .ToListAsync();

            if (!unhealedCollections.Any()) return 0;

            int repairedCount = 0;
            var activeYear = await context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            string fy = activeYear?.YearCode?.Replace(" ", "") ?? "26-27";

            foreach (var col in unhealedCollections)
            {
                var counterVoucher = col.Voucher;
                if (counterVoucher == null) continue;

                int collectingBranch = col.BranchID;
                int homeBranchId = col.HomeBranchID!.Value;

                int ibtLedgerId = await GetIbtLedgerIdAsync(context, collectingBranch, homeBranchId);

                // Identify non-cash details in counter voucher (Principal, Interest, etc.)
                var detailsToMove = counterVoucher.VoucherDetails
                    .Where(d => d.DrCr == "Cr" && d.LedgerID != ibtLedgerId)
                    .ToList();

                if (!detailsToMove.Any()) continue;

                decimal totalCreditToMove = detailsToMove.Sum(d => d.Amount);

                // 1. Remove non-cash credits from Counter Voucher and replace with Cr IBT
                context.VoucherDetails.RemoveRange(detailsToMove);
                counterVoucher.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = counterVoucher.VoucherID,
                    LedgerID = ibtLedgerId,
                    DrCr = "Cr",
                    Amount = totalCreditToMove,
                    CustomerID = col.LoanAccount?.CustomerID,
                    MemberID = col.LoanAccount?.MemberID
                });
                counterVoucher.IsIbtVoucher = true;
                counterVoucher.TargetBranchID = homeBranchId;

                // 2. Create the missing Home Branch Journal Voucher
                var homeBranch = await context.Branches.FindAsync(homeBranchId);
                string hbCode = homeBranch?.BranchCode ?? "HB";
                int countHb = await context.Vouchers.CountAsync(v => v.BranchID == homeBranchId && v.VoucherType == "Journal") + 1;
                string voucherNoHb = $"{hbCode}-JV-{fy}-{countHb:D5}";

                var homeVoucher = new Voucher
                {
                    BranchID = homeBranchId,
                    VoucherNo = voucherNoHb,
                    VoucherDate = counterVoucher.VoucherDate,
                    VoucherType = "Journal",
                    Narration = $"[आंतर-शाखा ऐतिहासिक तडजोड] काऊंटर शाखा #{collectingBranch} कडून वसुली जमा (खाते: {col.LoanAccount?.LoanAccountNo}, पावती: {col.ReceiptNo})",
                    TotalAmount = totalCreditToMove,
                    Status = counterVoucher.Status,
                    IsIbtVoucher = true,
                    TargetBranchID = collectingBranch,
                    ApprovedBy = counterVoucher.ApprovedBy,
                    ApprovedOn = counterVoucher.ApprovedOn
                };
                context.Vouchers.Add(homeVoucher);
                await context.SaveChangesAsync();

                // Details for Home Voucher: Dr IBT, Cr the original credits (Loan Principal, Interest, etc.)
                context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = homeVoucher.VoucherID,
                    LedgerID = ibtLedgerId,
                    DrCr = "Dr",
                    Amount = totalCreditToMove,
                    CustomerID = col.LoanAccount?.CustomerID,
                    MemberID = col.LoanAccount?.MemberID
                });

                foreach (var moved in detailsToMove)
                {
                    context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = homeVoucher.VoucherID,
                        LedgerID = moved.LedgerID,
                        DrCr = moved.DrCr,
                        Amount = moved.Amount,
                        CustomerID = moved.CustomerID ?? col.LoanAccount?.CustomerID,
                        MemberID = moved.MemberID ?? col.LoanAccount?.MemberID
                    });
                }

                // Link vouchers
                counterVoucher.RelatedVoucherID = homeVoucher.VoucherID;
                homeVoucher.RelatedVoucherID = counterVoucher.VoucherID;
                col.HomeBranchVoucherID = homeVoucher.VoucherID;

                repairedCount++;
            }

            await context.SaveChangesAsync();
            return repairedCount;
        }
    }
}

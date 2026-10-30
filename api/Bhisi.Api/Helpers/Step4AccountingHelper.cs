using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Controllers;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Modular Step-4 CBS Accounting Posting & Double-Entry Balance Helper
    /// covering Cash Vault Allocation/Denomination, Deceased Member Claim Settlement,
    /// Section 101 Legal Expenses, Investment Renewal & Premature Penalty,
    /// Loan Disbursement Deductions, and Loan Collection OTS/Expense/Surcharge Balance.
    /// </summary>
    public static class Step4AccountingHelper
    {
        // =========================================================================
        // 4.1.3 CASH MANAGEMENT: VAULT ALLOCATION (Contra) & DENOMINATION VARIANCE
        // =========================================================================

        public static async Task<Voucher?> PostCashAllocationVoucherIfEnabledAsync(AppDbContext context, CashAllocation allocation)
        {
            if (allocation == null || allocation.Amount <= 0)
            {
                return null;
            }

            int branchId = allocation.BranchId.HasValue && allocation.BranchId.Value > 0 ? allocation.BranchId.Value : 1;
            var setting = await context.CashManagementSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.BranchId == branchId)
                ?? await context.CashManagementSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.BranchId == 1);

            if (setting == null || !setting.AutoGenerateVouchers)
            {
                return null;
            }

            Cashier? fromCashier = allocation.FromCashierId.HasValue && allocation.FromCashierId.Value > 0
                ? await context.Cashiers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == allocation.FromCashierId.Value)
                : null;
            Cashier? toCashier = allocation.ToCashierId > 0
                ? await context.Cashiers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == allocation.ToCashierId)
                : null;

            int defaultVaultId = (setting.MainVaultLedgerId.HasValue && setting.MainVaultLedgerId.Value > 0)
                ? setting.MainVaultLedgerId.Value
                : await CashLedgerHelper.GetCashLedgerIdAsync(context, branchId, "CASH_MGMT");

            int fromLedgerId = (fromCashier?.CashLedgerId.HasValue == true && fromCashier.CashLedgerId.Value > 0)
                ? fromCashier.CashLedgerId.Value
                : defaultVaultId;

            int toLedgerId = (toCashier?.CashLedgerId.HasValue == true && toCashier.CashLedgerId.Value > 0)
                ? toCashier.CashLedgerId.Value
                : defaultVaultId;

            if (fromLedgerId <= 0 || toLedgerId <= 0)
            {
                throw new InvalidOperationException("कॅश व्हॉल्ट वाटपाचे व्हाउचर तयार करण्यासाठी मुख्य तिजोरी किंवा कॅशिअर रोख लेजर मॅपिंग सेटिंग्जमध्ये निवडा.");
            }

            DateTime effDate = allocation.AllocationDate != default ? allocation.AllocationDate : DateTime.Today;
            string vchNo = await VoucherNumberHelper.NextVoucherNoAsync(context, $"VCH-CSH-ALC-{effDate:yyyyMMdd}-", 4);

            string fromLabel = fromCashier != null ? $"{fromCashier.CashierName} ({fromCashier.CounterNumber})" : "मुख्य तिजोरी (Main Vault)";
            string toLabel = toCashier != null ? $"{toCashier.CashierName} ({toCashier.CounterNumber})" : "मुख्य तिजोरी (Main Vault)";

            var voucher = new Voucher
            {
                BranchID = branchId,
                VoucherNo = vchNo,
                VoucherDate = effDate,
                VoucherType = "Contra",
                Status = "Pending",
                TotalAmount = allocation.Amount,
                Narration = $"रोख तिजोरी / काऊंटर वाटप ({allocation.AllocationType}): {fromLabel} -> {toLabel}" +
                            (!string.IsNullOrWhiteSpace(allocation.Remarks) ? $" | {allocation.Remarks}" : ""),
                CreatedBy = 1,
                CreatedOn = DateTime.UtcNow,
                VoucherDetails = new List<VoucherDetail>
                {
                    new VoucherDetail { LedgerID = toLedgerId, DrCr = "Dr", Amount = allocation.Amount },
                    new VoucherDetail { LedgerID = fromLedgerId, DrCr = "Cr", Amount = allocation.Amount }
                }
            };

            VoucherBalanceHelper.EnsureBalanced(voucher);
            context.Vouchers.Add(voucher);
            await context.SaveChangesAsync();

            string tag = $"[व्हाउचर: {voucher.VoucherNo}]";
            allocation.Remarks = string.IsNullOrWhiteSpace(allocation.Remarks)
                ? tag
                : $"{allocation.Remarks} {tag}";
            if (allocation.Remarks.Length > 250)
            {
                allocation.Remarks = allocation.Remarks.Substring(0, 250);
            }

            return voucher;
        }

        public static async Task<Voucher?> PostCashDenominationVarianceVoucherIfEnabledAsync(AppDbContext context, CashDenomination denom)
        {
            if (denom == null || denom.DifferenceAmount == 0 || string.Equals(denom.DifferenceType, "MATCHED", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            int branchId = denom.BranchId.HasValue && denom.BranchId.Value > 0 ? denom.BranchId.Value : 1;
            var setting = await context.CashManagementSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.BranchId == branchId)
                ?? await context.CashManagementSettings
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.BranchId == 1);

            if (setting == null || !setting.AutoGenerateVouchers)
            {
                return null;
            }

            var cashier = denom.CashierId > 0
                ? await context.Cashiers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == denom.CashierId)
                : null;

            int cashLedgerId = (cashier?.CashLedgerId.HasValue == true && cashier.CashLedgerId.Value > 0)
                ? cashier.CashLedgerId.Value
                : ((setting.MainVaultLedgerId.HasValue && setting.MainVaultLedgerId.Value > 0)
                    ? setting.MainVaultLedgerId.Value
                    : await CashLedgerHelper.GetCashLedgerIdAsync(context, branchId, "CASH_MGMT"));

            if (cashLedgerId <= 0)
            {
                throw new InvalidOperationException("कॅश डिनॉमिनेशन तफावतीचे व्हाउचर तयार करण्यासाठी मुख्य तिजोरी / रोख लेजर सेटिंग्जमध्ये निवडा.");
            }

            decimal absDiff = Math.Abs(denom.DifferenceAmount);
            DateTime effDate = denom.DenominationDate != default ? denom.DenominationDate : DateTime.Today;
            string cashierLabel = cashier != null ? $"{cashier.CashierName} ({cashier.CounterNumber})" : $"कॅशिअर #{denom.CashierId}";

            Voucher voucher;
            if (string.Equals(denom.DifferenceType, "SHORT", StringComparison.OrdinalIgnoreCase) || denom.DifferenceAmount < 0)
            {
                int shortageLedgerId = setting.CashShortageLedgerId ?? 0;
                if (shortageLedgerId <= 0)
                {
                    var dynShort = await context.Ledgers
                        .Include(l => l.AccountGroup)
                        .FirstOrDefaultAsync(l => l.IsActive &&
                            (l.LedgerName.Contains("रोख तूट") || l.LedgerName.Contains("कॅश तूट") || l.LedgerName.Contains("Cash Shortage") || l.LedgerName.Contains("Shortage")));
                    shortageLedgerId = dynShort?.LedgerID ?? 0;
                }

                if (shortageLedgerId <= 0)
                {
                    throw new InvalidOperationException("रोख तूट (Cash Shortage) व्हाउचर तयार करण्यासाठी कॅश मॅनेजमेंट सेटिंग्जमध्ये 'Cash Shortage Ledger' निवडा.");
                }

                string vchNo = await VoucherNumberHelper.NextVoucherNoAsync(context, $"VCH-CSH-SHT-{effDate:yyyyMMdd}-", 4);
                voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = vchNo,
                    VoucherDate = effDate,
                    VoucherType = "Payment",
                    Status = "Pending",
                    TotalAmount = absDiff,
                    Narration = $"दिवसअखेर रोख तूट (Cash Shortage) - {cashierLabel}" + (!string.IsNullOrWhiteSpace(denom.Remarks) ? $" | {denom.Remarks}" : ""),
                    CreatedBy = 1,
                    CreatedOn = DateTime.UtcNow,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = shortageLedgerId, DrCr = "Dr", Amount = absDiff },
                        new VoucherDetail { LedgerID = cashLedgerId, DrCr = "Cr", Amount = absDiff }
                    }
                };
            }
            else
            {
                int excessLedgerId = setting.CashExcessLedgerId ?? 0;
                if (excessLedgerId <= 0)
                {
                    var dynExcess = await context.Ledgers
                        .Include(l => l.AccountGroup)
                        .FirstOrDefaultAsync(l => l.IsActive &&
                            (l.LedgerName.Contains("रोख जादा") || l.LedgerName.Contains("कॅश जादा") || l.LedgerName.Contains("Cash Excess") || l.LedgerName.Contains("Excess")));
                    excessLedgerId = dynExcess?.LedgerID ?? 0;
                }

                if (excessLedgerId <= 0)
                {
                    throw new InvalidOperationException("रोख जादा (Cash Excess) व्हाउचर तयार करण्यासाठी कॅश मॅनेजमेंट सेटिंग्जमध्ये 'Cash Excess Ledger' निवडा.");
                }

                string vchNo = await VoucherNumberHelper.NextVoucherNoAsync(context, $"VCH-CSH-EXC-{effDate:yyyyMMdd}-", 4);
                voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = vchNo,
                    VoucherDate = effDate,
                    VoucherType = "Receipt",
                    Status = "Pending",
                    TotalAmount = absDiff,
                    Narration = $"दिवसअखेर रोख जादा (Cash Excess) - {cashierLabel}" + (!string.IsNullOrWhiteSpace(denom.Remarks) ? $" | {denom.Remarks}" : ""),
                    CreatedBy = 1,
                    CreatedOn = DateTime.UtcNow,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = cashLedgerId, DrCr = "Dr", Amount = absDiff },
                        new VoucherDetail { LedgerID = excessLedgerId, DrCr = "Cr", Amount = absDiff }
                    }
                };
            }

            VoucherBalanceHelper.EnsureBalanced(voucher);
            context.Vouchers.Add(voucher);
            await context.SaveChangesAsync();

            string tag = $"[व्हाउचर: {voucher.VoucherNo}]";
            denom.Remarks = string.IsNullOrWhiteSpace(denom.Remarks)
                ? tag
                : $"{denom.Remarks} {tag}";
            if (denom.Remarks.Length > 250)
            {
                denom.Remarks = denom.Remarks.Substring(0, 250);
            }

            return voucher;
        }

        // =========================================================================
        // 4.1.5 DECEASED MEMBER CLAIM SETTLEMENT: COMPOUND DOUBLE-ENTRY VOUCHER
        // =========================================================================

        public static async Task<(DeceasedClaimSettlement Settlement, int? VoucherId, decimal NetAmount)> ExecuteDeceasedClaimSettlementAsync(
            AppDbContext context,
            Member member,
            MembersController.DeceasedClaimRequest req,
            int userId)
        {
            int id = member.MemberID;
            int? customerId = member.CustomerID > 0 ? member.CustomerID : null;
            DateTime effClaimDate = req.SettlementDate?.Date ?? (req.ResolutionDate?.Date ?? DateTime.Today);
            int branchId = req.BranchId > 0 ? req.BranchId : (member.BranchID > 0 ? member.BranchID : 1);

            var activeLoans = await context.LoanAccounts
                .Include(l => l.LoanRate)
                .Where(l => (l.MemberID == id || (customerId.HasValue && l.CustomerID == customerId.Value)) && l.Status != "Closed")
                .ToListAsync();

            var savings = customerId.HasValue
                ? await context.SavingAccountMasters
                    .Include(s => s.SavingScheme)
                    .Where(s => s.CustomerID == customerId.Value && s.Status != "Closed")
                    .ToListAsync()
                : new List<SavingAccountMaster>();

            var fds = customerId.HasValue
                ? await context.FdAccounts
                    .Include(f => f.FdScheme)
                    .Where(f => f.CustomerID == customerId.Value && f.Status == "Active")
                    .ToListAsync()
                : new List<FdAccount>();

            var rds = customerId.HasValue
                ? await context.RdAccounts
                    .Include(r => r.RdScheme)
                    .Where(r => r.CustomerID == customerId.Value && r.Status == "Active")
                    .ToListAsync()
                : new List<RdAccount>();

            var pigmies = customerId.HasValue
                ? await context.PigmyAccounts
                    .Include(p => p.PigmyScheme)
                    .Where(p => p.CustomerID == customerId.Value && p.Status == "Active")
                    .ToListAsync()
                : new List<PigmyAccount>();

            var shareAccount = await context.ShareAccounts.FirstOrDefaultAsync(s => s.MemberId == id);

            decimal savingsBalance = savings.Sum(s => Math.Max(0m, s.CurrentBalance));
            decimal fdBalance = fds.Sum(f => Math.Max(0m, f.DepositAmount));
            decimal rdBalance = rds.Sum(r => Math.Max(0m, r.TotalDepositedAmount));
            decimal pigmyBalance = pigmies.Sum(p => Math.Max(0m, p.TotalDepositedAmount - p.TotalWithdrawnAmount));
            decimal shareAmount = Math.Max(0m, shareAccount?.TotalShareAmount ?? 0m);
            decimal loanBalance = activeLoans.Sum(l => Math.Max(0m, l.PrincipalBalance) + Math.Max(0m, l.InterestBalance) + Math.Max(0m, l.OverdueInterestBalance));

            decimal grossAmount = savingsBalance + fdBalance + rdBalance + pigmyBalance + shareAmount;
            decimal netAmount = grossAmount - loanBalance;

            if (netAmount < -0.01m)
            {
                throw new InvalidOperationException(
                    $"मयत सभासदाकडील थकीत कर्ज रक्कम (₹{loanBalance:N2}) एकूण ठेवी व भाग भांडवलापेक्षा (₹{grossAmount:N2}) जास्त आहे. कृपया आधी उर्वरित कर्ज रक्कम (₹{Math.Abs(netAmount):N2}) जमा करून घ्या.");
            }
            if (netAmount < 0m) netAmount = 0m;

            bool isClaimBankMode = BankLedgerHelper.IsBankPaymentMode(req.PaymentMode);
            int payoutCreditLedgerId = 0;
            if (netAmount > 0m)
            {
                if (isClaimBankMode)
                {
                    var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(context, req.BankLedgerId);
                    if (!bankCheck.IsValid)
                    {
                        throw new InvalidOperationException(bankCheck.ErrorMessage);
                    }
                    payoutCreditLedgerId = bankCheck.LedgerId;
                }
                else
                {
                    payoutCreditLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(context, branchId, "CLAIM");
                    if (payoutCreditLedgerId <= 0)
                    {
                        throw new InvalidOperationException("या शाखेसाठी रोख शिल्लक लेजर सापडले नाही. कृपया शाखा मास्टरमध्ये रोख खाते तपासा.");
                    }
                }
            }

            // Pre-resolve every deposit/share Liability GL and loan GL BEFORE mutating balances
            var savingLedgerPairs = new List<(SavingAccountMaster Account, int LedgerId, decimal Balance)>();
            foreach (var s in savings)
            {
                decimal bal = Math.Max(0m, s.CurrentBalance);
                if (bal > 0m)
                {
                    int savLiabId = await SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(context, s);
                    if (savLiabId <= 0)
                    {
                        throw new InvalidOperationException(SavingLedgerHelper.GetMissingMappingErrorMessage(s.AccountNo));
                    }
                    savingLedgerPairs.Add((s, savLiabId, bal));
                }
            }

            var fdLedgerPairs = new List<(FdAccount Account, int LedgerId, decimal Balance)>();
            foreach (var f in fds)
            {
                decimal bal = Math.Max(0m, f.DepositAmount);
                if (bal > 0m)
                {
                    int fdLiabId = f.FdScheme?.FdLiabilityLedgerID ?? 0;
                    if (fdLiabId <= 0)
                    {
                        var dynFd = await context.Ledgers
                            .Include(l => l.AccountGroup)
                            .FirstOrDefaultAsync(l => l.IsActive &&
                                (l.AccountType == "Liabilities" || (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Liabilities")) &&
                                (l.LedgerName.Contains("मुदत ठेव") || l.LedgerName.Contains("FD") || l.LedgerName.Contains("Fixed Deposit")));
                        fdLiabId = dynFd?.LedgerID ?? 0;
                    }
                    if (fdLiabId <= 0)
                    {
                        throw new InvalidOperationException($"मुदत ठेव खाते (#{f.AccountNo}) योजनेला 'FD देयता लेजर' जोडलेले नाही.");
                    }
                    fdLedgerPairs.Add((f, fdLiabId, bal));
                }
            }

            var rdLedgerPairs = new List<(RdAccount Account, int LedgerId, decimal Balance)>();
            foreach (var r in rds)
            {
                decimal bal = Math.Max(0m, r.TotalDepositedAmount);
                if (bal > 0m)
                {
                    int rdLiabId = r.RdScheme?.RdLiabilityLedgerID ?? 0;
                    if (rdLiabId <= 0)
                    {
                        var dynRd = await context.Ledgers
                            .Include(l => l.AccountGroup)
                            .FirstOrDefaultAsync(l => l.IsActive &&
                                (l.AccountType == "Liabilities" || (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Liabilities")) &&
                                (l.LedgerName.Contains("आवर्ती") || l.LedgerName.Contains("RD") || l.LedgerName.Contains("Recurring")));
                        rdLiabId = dynRd?.LedgerID ?? 0;
                    }
                    if (rdLiabId <= 0)
                    {
                        throw new InvalidOperationException($"आवर्ती ठेव खाते (#{r.AccountNo}) योजनेला 'RD देयता लेजर' जोडलेले नाही.");
                    }
                    rdLedgerPairs.Add((r, rdLiabId, bal));
                }
            }

            var pigmyLedgerPairs = new List<(PigmyAccount Account, int LedgerId, decimal Balance)>();
            foreach (var p in pigmies)
            {
                decimal bal = Math.Max(0m, p.TotalDepositedAmount - p.TotalWithdrawnAmount);
                if (bal > 0m)
                {
                    int pgLiabId = p.PigmyScheme?.PigmyLiabilityLedgerID ?? 0;
                    if (pgLiabId <= 0)
                    {
                        var pgMap = await context.PigmyVoucherMappings.FirstOrDefaultAsync();
                        pgLiabId = pgMap?.CreditLedgerId ?? 0;
                    }
                    if (pgLiabId <= 0)
                    {
                        var dynPg = await context.Ledgers
                            .Include(l => l.AccountGroup)
                            .FirstOrDefaultAsync(l => l.IsActive &&
                                (l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")));
                        pgLiabId = dynPg?.LedgerID ?? 0;
                    }
                    if (pgLiabId <= 0)
                    {
                        throw new InvalidOperationException($"पिग्मी ठेव खाते (#{p.AccountNo}) योजनेला 'पिग्मी देयता लेजर' जोडलेले नाही.");
                    }
                    pigmyLedgerPairs.Add((p, pgLiabId, bal));
                }
            }

            int shareLedgerId = 0;
            if (shareAmount > 0m)
            {
                var shareLedger = await ShareLedgerHelper.GetShareCapitalLedgerAsync(context);
                shareLedgerId = shareLedger.LedgerID;
            }

            var loanLedgerTriples = new List<(LoanAccount Loan, int PrinLedgerId, int IntLedgerId, int PenLedgerId, decimal Prin, decimal IntAmt, decimal PenAmt)>();
            foreach (var l in activeLoans)
            {
                decimal prin = Math.Max(0m, l.PrincipalBalance);
                decimal intAmt = Math.Max(0m, l.InterestBalance);
                decimal penAmt = Math.Max(0m, l.OverdueInterestBalance);
                if (prin + intAmt + penAmt <= 0m) continue;

                int pLid = l.LoanRate?.LoanLedgerID ?? 0;
                int iLid = (l.LoanRate?.ReceivableInterestLedgerID.HasValue == true && l.LoanRate.ReceivableInterestLedgerID.Value > 0)
                    ? l.LoanRate.ReceivableInterestLedgerID.Value
                    : (l.LoanRate?.InterestLedgerID ?? 0);
                int oLid = (l.LoanRate?.OverdueInterestLedgerID.HasValue == true && l.LoanRate.OverdueInterestLedgerID.Value > 0)
                    ? l.LoanRate.OverdueInterestLedgerID.Value
                    : iLid;

                if (prin > 0m && pLid <= 0)
                {
                    throw new InvalidOperationException($"कर्ज खाते (#{l.LoanAccountNo}) योजनेला 'कर्ज मुद्दल लेजर' जोडलेले नाही.");
                }
                if (intAmt > 0m && iLid <= 0)
                {
                    throw new InvalidOperationException($"कर्ज खाते (#{l.LoanAccountNo}) योजनेला 'व्याज लेजर' जोडलेले नाही.");
                }
                if (penAmt > 0m && oLid <= 0)
                {
                    throw new InvalidOperationException($"कर्ज खाते (#{l.LoanAccountNo}) योजनेला 'थकीत/दंड व्याज लेजर' जोडलेले नाही.");
                }

                loanLedgerTriples.Add((l, pLid, iLid, oLid, prin, intAmt, penAmt));
            }

            var activeFy = await context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            int fyId = activeFy?.FinancialYearID ?? 1;

            int? voucherId = null;
            if (grossAmount > 0m)
            {
                string memberCustName = member.Customer != null
                    ? $"{member.Customer.FirstName} {member.Customer.LastName}".Trim()
                    : "Member";

                string vchNo = await VoucherNumberHelper.NextVoucherNoAsync(context, $"VCH-CLM-{effClaimDate:yyyyMMdd}-", 4);
                string voucherType = netAmount > 0m ? "Payment" : "Journal";

                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = vchNo,
                    VoucherDate = effClaimDate,
                    VoucherType = voucherType,
                    Status = "Pending",
                    TotalAmount = grossAmount,
                    Narration = $"मयत सभासद वारसदार क्लेम सेटलमेंट ({(netAmount > 0m ? (isClaimBankMode ? "Bank" : "Cash") : "Loan Set-Off")}): {memberCustName} (वारसदार: {req.NomineeName}{(string.IsNullOrWhiteSpace(req.NomineeBankAccount) ? "" : $", बँक तपशील: {req.NomineeBankAccount}")}, मयत दाखला: {req.DeathCertificateNo}, ठराव: {req.ResolutionNo})",
                    CreatedBy = userId,
                    CreatedOn = DateTime.Now,
                    VoucherDetails = new List<VoucherDetail>()
                };

                // DEBIT LINES: Each closed Deposit & Share Liability GL
                foreach (var (sAcc, sLid, bal) in savingLedgerPairs)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = sLid,
                        DrCr = "Dr",
                        Amount = bal,
                        CustomerID = sAcc.CustomerID,
                        MemberID = member.MemberID
                    });
                }

                foreach (var (fAcc, fLid, bal) in fdLedgerPairs)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = fLid,
                        DrCr = "Dr",
                        Amount = bal,
                        CustomerID = fAcc.CustomerID,
                        MemberID = member.MemberID
                    });
                }

                foreach (var (rAcc, rLid, bal) in rdLedgerPairs)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = rLid,
                        DrCr = "Dr",
                        Amount = bal,
                        CustomerID = rAcc.CustomerID,
                        MemberID = member.MemberID
                    });
                }

                foreach (var (pAcc, pLid, bal) in pigmyLedgerPairs)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = pLid,
                        DrCr = "Dr",
                        Amount = bal,
                        CustomerID = pAcc.CustomerID,
                        MemberID = member.MemberID
                    });
                }

                if (shareAmount > 0m)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = shareLedgerId,
                        DrCr = "Dr",
                        Amount = shareAmount,
                        CustomerID = customerId,
                        MemberID = member.MemberID
                    });
                }

                // CREDIT LINES: Active Loan Set-Offs (Principal, Receivable Interest, Overdue Interest)
                foreach (var (loan, pLid, iLid, oLid, prin, intAmt, penAmt) in loanLedgerTriples)
                {
                    if (prin > 0m)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = pLid,
                            DrCr = "Cr",
                            Amount = prin,
                            CustomerID = loan.CustomerID,
                            MemberID = member.MemberID
                        });
                    }
                    if (intAmt > 0m)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = iLid,
                            DrCr = "Cr",
                            Amount = intAmt,
                            CustomerID = loan.CustomerID,
                            MemberID = member.MemberID
                        });
                    }
                    if (penAmt > 0m)
                    {
                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = oLid,
                            DrCr = "Cr",
                            Amount = penAmt,
                            CustomerID = loan.CustomerID,
                            MemberID = member.MemberID
                        });
                    }
                }

                // CREDIT LINE: Net Payout to Nominee via Bank or Cash (do NOT stamp MemberID on Bank/Cash line)
                if (netAmount > 0m)
                {
                    voucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = payoutCreditLedgerId,
                        DrCr = "Cr",
                        Amount = netAmount
                    });
                }

                VoucherBalanceHelper.EnsureBalanced(voucher);
                context.Vouchers.Add(voucher);
                await context.SaveChangesAsync();
                voucherId = voucher.VoucherID;

                // Record sub-ledger closing transactions linked to Voucher
                foreach (var (sAcc, _, bal) in savingLedgerPairs)
                {
                    context.SavingTransactions.Add(new SavingTransaction
                    {
                        SavingAccountID = sAcc.SavingAccountID,
                        CustomerID = sAcc.CustomerID,
                        BranchID = branchId,
                        TransactionDate = effClaimDate,
                        TransactionType = "Withdrawal",
                        Amount = bal,
                        BalanceAfterTxn = 0m,
                        PaymentMode = "Transfer",
                        VoucherNo = voucher.VoucherNo,
                        Narration = $"मयत सभासद वारसदार दावा सेटलमेंट वर्ग ({voucher.VoucherNo})",
                        CreatedBy = userId,
                        CreatedOn = DateTime.UtcNow
                    });
                }

                foreach (var (fAcc, _, bal) in fdLedgerPairs)
                {
                    context.FdTransactions.Add(new FdTransaction
                    {
                        InstitutionID = fAcc.InstitutionID,
                        BranchID = branchId,
                        FinancialYearID = fyId,
                        FdAccountID = fAcc.FdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = effClaimDate,
                        TransactionType = "Payout",
                        DebitCredit = "Dr",
                        Amount = bal,
                        CreatedBy = userId
                    });
                }

                foreach (var (rAcc, _, bal) in rdLedgerPairs)
                {
                    context.RdTransactions.Add(new RdTransaction
                    {
                        InstitutionID = rAcc.InstitutionID,
                        BranchID = branchId,
                        FinancialYearID = fyId,
                        RdAccountID = rAcc.RdAccountID,
                        VoucherID = voucher.VoucherID,
                        TransactionDate = effClaimDate,
                        TransactionType = "Payout",
                        DebitCredit = "Dr",
                        PrincipalAmount = bal,
                        BalanceAfterTxn = 0m,
                        Narration = $"मयत सभासद वारसदार दावा सेटलमेंट वर्ग ({voucher.VoucherNo})",
                        CreatedBy = userId
                    });
                }

                foreach (var (pAcc, _, bal) in pigmyLedgerPairs)
                {
                    pAcc.TotalWithdrawnAmount += bal;
                    context.PigmyTransactions.Add(new PigmyTransaction
                    {
                        PigmyAccountID = pAcc.PigmyAccountID,
                        TransactionDate = effClaimDate,
                        ValueDate = effClaimDate,
                        TransactionType = "WITHDRAWAL",
                        DrAmount = bal,
                        CrAmount = 0m,
                        BalanceAmount = 0m,
                        Narration = $"मयत सभासद वारसदार दावा सेटलमेंट वर्ग ({voucher.VoucherNo})",
                        ReferenceId = voucher.VoucherNo,
                        MakerId = userId
                    });
                }

                if (shareAccount != null && shareAmount > 0m)
                {
                    context.ShareTransactions.Add(new ShareTransaction
                    {
                        ShareAccountId = shareAccount.ShareAccountId,
                        CustomerID = shareAccount.CustomerID,
                        TransactionDate = effClaimDate,
                        TransactionType = "Refund",
                        NumberOfShares = shareAccount.TotalShareCount,
                        Amount = shareAmount,
                        Narration = $"मयत सभासद वारसदार दावा सेटलमेंट परतावा ({voucher.VoucherNo})",
                        VoucherId = voucher.VoucherID
                    });
                }

                foreach (var (loan, _, _, _, prin, intAmt, penAmt) in loanLedgerTriples)
                {
                    context.LoanCollections.Add(new LoanCollection
                    {
                        LoanAccountID = loan.LoanAccountID,
                        BranchID = branchId,
                        CollectionDate = effClaimDate,
                        ReceiptNo = voucher.VoucherNo,
                        TotalAmountReceived = prin + intAmt + penAmt,
                        PrincipalCollected = prin,
                        ReceivableInterestCollected = intAmt,
                        InterestCollected = 0m,
                        PenaltyInterestCollected = penAmt,
                        PaymentMode = "Transfer",
                        VoucherID = voucher.VoucherID,
                        Remarks = $"मयत सभासद दावा सेटलमेंट वजावट ({voucher.VoucherNo})"
                    });
                }
            }

            // Close all member deposit, share, and active loan accounts
            foreach (var s in savings)
            {
                s.CurrentBalance = 0m;
                s.Status = "Closed";
            }
            foreach (var f in fds)
            {
                f.Status = "Closed";
            }
            foreach (var r in rds)
            {
                r.Status = "Closed";
                r.ClosureDate = effClaimDate;
                r.ClosureType = "DeceasedClaim";
                r.ClosedPayoutAmount = r.TotalDepositedAmount;
            }
            foreach (var p in pigmies)
            {
                p.Status = "Closed";
            }
            if (shareAccount != null)
            {
                shareAccount.TotalShareCount = 0;
                shareAccount.TotalShareAmount = 0m;
                shareAccount.Status = "Closed";
            }
            foreach (var l in activeLoans)
            {
                l.PrincipalBalance = 0m;
                l.PurePrincipalBalance = 0m;
                l.CapitalizedInterestAmount = 0m;
                l.InterestBalance = 0m;
                l.OverdueInterestBalance = 0m;
                l.InterestProvisionBalance = 0m;
                l.Status = "Closed";
                l.LastInstallmentPaidDate = effClaimDate;
            }

            var settlement = new DeceasedClaimSettlement
            {
                MemberID = id,
                BranchID = branchId,
                DeathDate = req.DeathDate,
                DeathCertificateNo = req.DeathCertificateNo,
                NomineeName = string.IsNullOrWhiteSpace(req.NomineeName) ? (member.Customer?.NomineeName ?? "Legal Heir") : req.NomineeName,
                NomineeRelation = req.NomineeRelation ?? member.Customer?.NomineeRelation,
                NomineeAadhaarNo = req.NomineeAadhaarNo,
                NomineeMobileNo = req.NomineeMobileNo,
                NomineeBankAccount = req.NomineeBankAccount,
                TotalSavingsBalance = savingsBalance,
                TotalFdBalance = fdBalance,
                TotalRdBalance = rdBalance,
                TotalPigmyBalance = pigmyBalance,
                TotalShareAmount = shareAmount,
                TotalLoanLiability = loanBalance,
                NetPayableAmount = netAmount,
                ResolutionNo = req.ResolutionNo,
                ResolutionDate = req.ResolutionDate,
                VoucherID = voucherId,
                Status = "Settled",
                SettlementDate = effClaimDate,
                Remarks = req.Remarks,
                CreatedBy = userId,
                CreatedOn = DateTime.Now
            };
            context.DeceasedClaimSettlements.Add(settlement);

            member.Status = "Mayat";
            member.UpdatedBy = userId;
            member.UpdatedOn = DateTime.Now;

            await context.SaveChangesAsync();

            return (settlement, voucherId, netAmount);
        }

        // =========================================================================
        // 4.1.7 SECTION 101 LEGAL EXPENSE: ATOMIC TRANSACTION + NO MemberID ?? 1
        // =========================================================================

        public static async Task<Voucher> ExecuteLegalExpenseAtomicAsync(
            AppDbContext context,
            AddLegalExpenseDto dto,
            int effectiveBranchId,
            int effectiveLoanAccountId)
        {
            int branchId = effectiveBranchId > 0 ? effectiveBranchId : 1;
            string payee = dto.PaidTo ?? dto.PayeeName ?? "कायदेशीर सल्लागार / अधिकारी";
            string rawNarration = !string.IsNullOrWhiteSpace(dto.Remarks)
                ? dto.Remarks!.Trim()
                : $"कायदेशीर खर्च ({dto.ExpenseType}) - {payee}";
            string finalNarration = (!string.IsNullOrWhiteSpace(dto.ReferenceNo) && !rawNarration.Contains(dto.ReferenceNo))
                ? $"{rawNarration} (Ref: {dto.ReferenceNo.Trim()})"
                : rawNarration;

            var mapping = await context.LegalRecoveryLedgerMappings
                .Where(m => (m.BranchId == branchId || m.BranchId == 0) && m.TransactionType == dto.ExpenseType && m.IsActive)
                .OrderByDescending(m => m.BranchId)
                .FirstOrDefaultAsync();

            int debitLedgerId = mapping?.DebitLedgerId ?? 0;
            if (debitLedgerId <= 0)
            {
                var dynDr = await context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && (l.LedgerName.Contains("कायदेशीर") || l.LedgerName.Contains("Legal") || l.LedgerName.Contains("Court")))
                    ?? await context.Ledgers.FirstOrDefaultAsync(l => l.IsActive && (l.LedgerName.Contains("नोटीस") || l.LedgerName.Contains("वसुली खर्च")))
                    ?? await context.Ledgers.Include(l => l.AccountGroup).FirstOrDefaultAsync(l => l.IsActive && (l.AccountType == "Expenses" || l.AccountType == "Expense" || (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Expenses")));
                debitLedgerId = dynDr?.LedgerID ?? 0;
            }

            if (debitLedgerId <= 0)
            {
                throw new InvalidOperationException($"कायदेशीर खर्चाच्या प्रकारासाठी ('{dto.ExpenseType}') कोणतेही वैध खर्च लेजर (Debit Ledger) सापडले नाही. कृपया कायदेशीर लेजर मॅपिंग पूर्ण करा.");
            }

            string mode = (dto.PaymentMode ?? "CASH").Trim();
            bool isBankMode = BankLedgerHelper.IsBankPaymentMode(mode);
            bool isJournalMode = string.Equals(mode, "JOURNAL", StringComparison.OrdinalIgnoreCase);

            int creditLedgerId = 0;
            if (isBankMode)
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(context, dto.BankLedgerId);
                if (!bankCheck.IsValid)
                {
                    throw new InvalidOperationException(bankCheck.ErrorMessage);
                }
                creditLedgerId = bankCheck.LedgerId;
            }
            else if (isJournalMode)
            {
                creditLedgerId = mapping?.CreditLedgerId ?? 0;
                if (creditLedgerId <= 0)
                {
                    throw new InvalidOperationException($"जर्नल (Journal) पद्धतीने कायदेशीर खर्च नोंदवण्यासाठी '{dto.ExpenseType}' प्रकारास क्रेडिट देय लेजर (Credit Payable Ledger) मॅप असणे आवश्यक आहे.");
                }
            }
            else
            {
                creditLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(context, branchId, "LEGAL");
                if (creditLedgerId <= 0)
                {
                    throw new InvalidOperationException("या शाखेसाठी रोख शिल्लक लेजर सापडले नाही. कृपया शाखा मास्टरमध्ये रोख खाते तपासा.");
                }
            }

            LoanAccount? loan = effectiveLoanAccountId > 0
                ? await context.LoanAccounts.AsNoTracking().FirstOrDefaultAsync(l => l.LoanAccountID == effectiveLoanAccountId)
                : null;

            int? memberId = (loan != null && loan.MemberID.HasValue && loan.MemberID.Value > 0) ? loan.MemberID.Value : null;
            int? customerId = (loan != null && loan.CustomerID.HasValue && loan.CustomerID.Value > 0) ? loan.CustomerID.Value : null;

            var ownTx = context.Database.CurrentTransaction == null
                ? await context.Database.BeginTransactionAsync()
                : null;

            try
            {
                string vNo = await VoucherNumberHelper.NextVoucherNoAsync(context, $"LEG-{branchId}-{dto.ExpenseDate:yyyyMMdd}-", 4);
                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = vNo,
                    VoucherDate = dto.ExpenseDate,
                    VoucherType = isJournalMode ? "Journal" : "Payment",
                    Status = "Pending",
                    Narration = finalNarration,
                    TotalAmount = dto.Amount,
                    CreatedBy = 1,
                    CreatedOn = DateTime.UtcNow,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail
                        {
                            LedgerID = debitLedgerId,
                            CustomerID = customerId,
                            MemberID = memberId,
                            DrCr = "Dr",
                            Amount = dto.Amount
                        },
                        new VoucherDetail
                        {
                            LedgerID = creditLedgerId,
                            MemberID = null,
                            DrCr = "Cr",
                            Amount = dto.Amount
                        }
                    }
                };

                VoucherBalanceHelper.EnsureBalanced(voucher);
                context.Vouchers.Add(voucher);
                await context.SaveChangesAsync();

                var expense = new Sec101LegalExpense
                {
                    BranchId = branchId,
                    CaseId = dto.CaseId,
                    LoanAccountId = effectiveLoanAccountId,
                    ExpenseType = dto.ExpenseType,
                    Amount = dto.Amount,
                    ExpenseDate = dto.ExpenseDate,
                    PaidTo = payee,
                    VoucherId = voucher.VoucherID,
                    IsDebitedToLoan = dto.IsDebitedToBorrower,
                    Remarks = finalNarration,
                    CreatedAt = DateTime.UtcNow
                };
                context.Sec101LegalExpenses.Add(expense);

                if (dto.IsDebitedToBorrower && effectiveLoanAccountId > 0 && loan != null)
                {
                    context.OverdueRecoveryLedgers.Add(new OverdueRecoveryLedger
                    {
                        LoanAccountID = effectiveLoanAccountId,
                        TransactionDate = dto.ExpenseDate,
                        DebitAmount = dto.Amount,
                        CreditAmount = 0m,
                        VoucherID = voucher.VoucherID,
                        Particulars = finalNarration.Length > 250 ? finalNarration.Substring(0, 250) : finalNarration
                    });
                }

                await context.SaveChangesAsync();
                if (ownTx != null)
                {
                    await ownTx.CommitAsync();
                }

                return voucher;
            }
            catch
            {
                if (ownTx != null)
                {
                    await ownTx.RollbackAsync();
                }
                throw;
            }
            finally
            {
                if (ownTx != null)
                {
                    await ownTx.DisposeAsync();
                }
            }
        }

        // =========================================================================
        // 4.1.1 & 4.2.4 INVESTMENTS: RENEWAL VOUCHER & PREMATURE PENALTY GL
        // =========================================================================

        public static async Task<int> ResolveInvestmentPenaltyLedgerIdAsync(AppDbContext context, InvestmentVoucherMapping mapping)
        {
            var penaltyExpenseLedger = await context.Ledgers
                .Include(l => l.AccountGroup)
                .FirstOrDefaultAsync(l => l.IsActive &&
                    (l.AccountType == "Expenses" || l.AccountType == "Expense" || (l.AccountGroup != null && (l.AccountGroup.NatureOfGroup == "Expenses" || l.AccountGroup.NatureOfGroup == "Expense"))) &&
                    (l.LedgerName.Contains("गुंतवणूक दंड") || l.LedgerName.Contains("मुदतपूर्व दंड") || l.LedgerName.Contains("Investment Penalty") || l.LedgerName.Contains("दंड खर्च") || l.LedgerName.Contains("Penalty")));

            if (penaltyExpenseLedger != null && penaltyExpenseLedger.LedgerID > 0)
            {
                return penaltyExpenseLedger.LedgerID;
            }

            // Fallback: debit Interest Income GL directly (contra-income reduction) so Dr == Cr strictly holds
            if (mapping != null && mapping.InterestIncomeLedgerID > 0)
            {
                return mapping.InterestIncomeLedgerID;
            }

            throw new InvalidOperationException("गुंतवणूक मुदतपूर्व दंड (Penalty) नोंदवण्यासाठी दंड खर्च किंवा गुंतवणूक व्याज उत्पन्न लेजर सापडले नाही.");
        }

        public static async Task<Voucher> CreateInvestmentRenewalVoucherAsync(
            AppDbContext context,
            InvestmentAccount oldAccount,
            InvestmentAccount newAccount,
            InvestmentRenewal renewal,
            InvestmentVoucherMapping oldMapping,
            InvestmentVoucherMapping newMapping,
            string? paymentMode,
            int? bankLedgerId,
            string? referenceNo,
            decimal interestPayoutAmount)
        {
            if (oldMapping == null || oldMapping.InvestmentLedgerID <= 0)
            {
                throw new InvalidOperationException($"जुन्या गुंतवणूक खात्यास ({oldAccount.InvestmentNo}) वैध 'Investment Asset Ledger' जोडलेले नाही.");
            }
            if (newMapping == null || newMapping.InvestmentLedgerID <= 0)
            {
                throw new InvalidOperationException($"नवीन गुंतवणूक योजनेला वैध 'Investment Asset Ledger' जोडलेले नाही.");
            }

            decimal oldPrincipal = Math.Round(oldAccount.PrincipalAmount, 2, MidpointRounding.AwayFromZero);
            decimal newPrincipal = Math.Round(newAccount.PrincipalAmount, 2, MidpointRounding.AwayFromZero);
            decimal payoutInterest = Math.Max(0m, Math.Round(interestPayoutAmount, 2, MidpointRounding.AwayFromZero));

            decimal principalIncrease = Math.Max(0m, newPrincipal - oldPrincipal); // Capitalized interest
            decimal principalRefund = Math.Max(0m, oldPrincipal - newPrincipal);   // Partial principal withdrawn
            decimal totalCashOrBankReceived = principalRefund + payoutInterest;
            decimal totalInterestRecognized = principalIncrease + payoutInterest;

            int paymentDebitLedgerId = 0;
            if (totalCashOrBankReceived > 0m)
            {
                string effMode = string.IsNullOrWhiteSpace(paymentMode) ? "Bank" : paymentMode.Trim();
                if (string.Equals(effMode, "Cash", StringComparison.OrdinalIgnoreCase))
                {
                    paymentDebitLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(context, oldAccount.BranchID, "INVESTMENT");
                    if (paymentDebitLedgerId <= 0)
                    {
                        throw new InvalidOperationException("या शाखेसाठी रोख शिल्लक लेजर सापडले नाही.");
                    }
                }
                else if (BankLedgerHelper.IsBankPaymentMode(effMode))
                {
                    var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(context, bankLedgerId);
                    if (!bankCheck.IsValid)
                    {
                        throw new InvalidOperationException(bankCheck.ErrorMessage);
                    }
                    paymentDebitLedgerId = bankCheck.LedgerId;
                }
                else
                {
                    throw new InvalidOperationException($"अवैध व्यवहार पद्धत (Invalid Payment Mode): {effMode}");
                }
            }

            // Split recognized interest between already-accrued Interest Receivable and fresh Interest Income
            decimal totalAccruedOnOld = await context.InvestmentInterestAccruals
                .Where(a => a.InvestmentAccountID == oldAccount.InvestmentAccountID)
                .SumAsync(a => (decimal?)a.InterestAmount) ?? 0m;
            decimal totalReceiptsOnOld = await context.InvestmentInterestReceipts
                .Where(r => r.InvestmentAccountID == oldAccount.InvestmentAccountID)
                .SumAsync(r => (decimal?)r.ReceivedAmount) ?? 0m;
            decimal outstandingReceivable = Math.Max(0m, oldAccount.AccruedInterestTillMigration + totalAccruedOnOld - totalReceiptsOnOld);

            decimal receivableCleared = (totalInterestRecognized > 0m && oldMapping.InterestReceivableLedgerID > 0)
                ? Math.Min(totalInterestRecognized, outstandingReceivable)
                : 0m;
            decimal freshInterestIncome = totalInterestRecognized - receivableCleared;

            if (freshInterestIncome > 0m && oldMapping.InterestIncomeLedgerID <= 0)
            {
                throw new InvalidOperationException($"गुंतवणूक व्याजाचे भांडवलीकरण/जमा करण्यासाठी योजनेला 'Interest Income Ledger' जोडलेले नाही.");
            }

            bool hasCashOrBankLeg = totalCashOrBankReceived > 0m;
            string voucherType = hasCashOrBankLeg ? "Receipt" : "Journal";
            string prefix = hasCashOrBankLeg ? "REC-INV-REN-" : "JV-INV-REN-";
            string refSuffix = !string.IsNullOrWhiteSpace(referenceNo) ? $" [संदर्भ/UTR: {referenceNo.Trim()}]" : "";

            decimal totalVoucherDr = newPrincipal + totalCashOrBankReceived;

            var voucher = new Voucher
            {
                BranchID = oldAccount.BranchID,
                VoucherNo = $"{prefix}{newAccount.InvestmentNo}",
                VoucherDate = renewal.RenewalDate,
                VoucherType = voucherType,
                Status = "Pending",
                TotalAmount = totalVoucherDr,
                Narration = $"गुंतवणूक नूतनीकरण ({renewal.RenewalType}): जुने खाते {oldAccount.InvestmentNo} -> नवीन खाते {newAccount.InvestmentNo}{refSuffix}",
                CreatedBy = 1,
                CreatedOn = DateTime.Now,
                VoucherDetails = new List<VoucherDetail>()
            };

            // Dr New Investment Asset GL
            if (newPrincipal > 0m)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = newMapping.InvestmentLedgerID,
                    DrCr = "Dr",
                    Amount = newPrincipal
                });
            }

            // Dr Bank / Cash GL if interest or partial principal received
            if (totalCashOrBankReceived > 0m)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = paymentDebitLedgerId,
                    DrCr = "Dr",
                    Amount = totalCashOrBankReceived
                });
            }

            // Cr Old Investment Asset GL
            if (oldPrincipal > 0m)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = oldMapping.InvestmentLedgerID,
                    DrCr = "Cr",
                    Amount = oldPrincipal
                });
            }

            // Cr Accrued Interest Receivable GL (clearing prior accruals)
            if (receivableCleared > 0m)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = oldMapping.InterestReceivableLedgerID,
                    DrCr = "Cr",
                    Amount = receivableCleared
                });
            }

            // Cr Fresh Interest Income GL
            if (freshInterestIncome > 0m)
            {
                voucher.VoucherDetails.Add(new VoucherDetail
                {
                    LedgerID = oldMapping.InterestIncomeLedgerID,
                    DrCr = "Cr",
                    Amount = freshInterestIncome
                });
            }

            VoucherBalanceHelper.EnsureBalanced(voucher);
            context.Vouchers.Add(voucher);
            await context.SaveChangesAsync();

            renewal.VoucherID = voucher.VoucherID;
            return voucher;
        }

        // =========================================================================
        // 4.2.2 LOAN DISBURSEMENT: STRICT DEDUCTION LEDGER RESOLUTION & BALANCE
        // =========================================================================

        public static async Task NormalizeAndValidateDisbursementDeductionsAsync(
            AppDbContext context,
            LoanDisbursement disbursement,
            Dictionary<int, Ledger> validLedgerDict,
            List<Ledger> allLedgers,
            Ledger shareCapitalLedger,
            int? loanRateId)
        {
            LoanRate? rate = (loanRateId.HasValue && loanRateId.Value > 0)
                ? await context.LoanRates.AsNoTracking().FirstOrDefaultAsync(r => r.LoanRateID == loanRateId.Value)
                : null;

            disbursement.Deductions ??= new List<LoanDisbursementDeduction>();
            var positiveDeductions = disbursement.Deductions.Where(d => d.Amount > 0m).ToList();

            // If caller passed scalar deduction properties without populating Deductions collection, synthesize exact GL lines
            if (!positiveDeductions.Any())
            {
                if (disbursement.ShareDeduction > 0m)
                {
                    disbursement.Deductions.Add(new LoanDisbursementDeduction
                    {
                        LedgerID = shareCapitalLedger.LedgerID,
                        Amount = disbursement.ShareDeduction
                    });
                }

                if (disbursement.ProcessingFee > 0m)
                {
                    int procLedgerId = (rate?.ProcessingFeeLedgerID.HasValue == true && validLedgerDict.ContainsKey(rate.ProcessingFeeLedgerID.Value))
                        ? rate.ProcessingFeeLedgerID.Value
                        : (allLedgers.FirstOrDefault(l => l.IsActive &&
                            (l.LedgerName.Contains("प्रोसेसिंग") || l.LedgerName.ToLower().Contains("processing") || l.LedgerName.Contains("अर्ज फी") || l.LedgerName.Contains("छाननी")))?.LedgerID ?? 0);

                    if (procLedgerId <= 0)
                    {
                        throw new InvalidOperationException($"कर्ज वाटपातील प्रोसेसिंग फी कपातीसाठी (₹{disbursement.ProcessingFee:N2}) वैध उत्पन्न लेजर सापडले नाही. कृपया कर्ज दर पत्रकात 'Processing Fee Ledger' जोडा.");
                    }

                    disbursement.Deductions.Add(new LoanDisbursementDeduction
                    {
                        LedgerID = procLedgerId,
                        Amount = disbursement.ProcessingFee
                    });
                }

                if (disbursement.InsuranceDeduction > 0m)
                {
                    int insLedgerId = allLedgers.FirstOrDefault(l => l.IsActive &&
                        (l.LedgerName.Contains("विमा") || l.LedgerName.ToLower().Contains("insurance")))?.LedgerID ?? 0;

                    if (insLedgerId <= 0)
                    {
                        throw new InvalidOperationException($"कर्ज वाटपातील विमा (Insurance) कपातीसाठी (₹{disbursement.InsuranceDeduction:N2}) वैध जी.एल. लेजर सापडले नाही.");
                    }

                    disbursement.Deductions.Add(new LoanDisbursementDeduction
                    {
                        LedgerID = insLedgerId,
                        Amount = disbursement.InsuranceDeduction
                    });
                }

                if (disbursement.StationeryCharges > 0m)
                {
                    int statLedgerId = allLedgers.FirstOrDefault(l => l.IsActive &&
                        (l.LedgerName.Contains("स्टेशनरी") || l.LedgerName.Contains("फॉर्म") || l.LedgerName.ToLower().Contains("stationery") || l.LedgerName.ToLower().Contains("form")))?.LedgerID ?? 0;

                    if (statLedgerId <= 0)
                    {
                        throw new InvalidOperationException($"कर्ज वाटपातील स्टेशनरी/फॉर्म शुल्क कपातीसाठी (₹{disbursement.StationeryCharges:N2}) वैध जी.एल. लेजर सापडले नाही.");
                    }

                    disbursement.Deductions.Add(new LoanDisbursementDeduction
                    {
                        LedgerID = statLedgerId,
                        Amount = disbursement.StationeryCharges
                    });
                }

                if (disbursement.OtherDeductions > 0m)
                {
                    throw new InvalidOperationException($"कर्ज वाटपातील इतर कपातीसाठी (₹{disbursement.OtherDeductions:N2}) कृपया कपात यादीतून विशिष्ट जी.एल. खाते (Deduction Ledger) निवडा.");
                }
            }

            // Strictly validate every positive deduction line has a real, valid GL LedgerID (NEVER silently dump into Share Capital!)
            foreach (var ded in disbursement.Deductions.Where(d => d.Amount > 0m))
            {
                if (ded.LedgerID <= 0 || !validLedgerDict.ContainsKey(ded.LedgerID))
                {
                    throw new InvalidOperationException($"कर्ज वाटपातील ₹{ded.Amount:N2} कपातीसाठी वैध जी.एल. खाते (Deduction Ledger) निवडलेले नाही.");
                }
            }

            decimal totalDeductions = Math.Round(disbursement.Deductions.Where(d => d.Amount > 0m).Sum(d => d.Amount), 2, MidpointRounding.AwayFromZero);
            decimal expectedDisbursement = Math.Round(disbursement.NetAmountPaid + totalDeductions, 2, MidpointRounding.AwayFromZero);

            if (Math.Abs(disbursement.DisbursementAmount - expectedDisbursement) > 0.01m)
            {
                throw new InvalidOperationException(
                    $"कर्ज वाटप रक्कम (₹{disbursement.DisbursementAmount:N2}) आणि निव्वळ अदा रक्कम (₹{disbursement.NetAmountPaid:N2}) + एकूण कपात (₹{totalDeductions:N2}) यांची बेरीज (₹{expectedDisbursement:N2}) जुळत नाही.");
            }
        }

        // =========================================================================
        // 4.2.1 LOAN COLLECTION: RECOVERY EXPENSE, SURCHARGE & OTS/WAIVER BALANCE
        // =========================================================================

        public static async Task<int> ResolveRecoveryExpenseLedgerIdAsync(AppDbContext context, LoanRate? loanRate, decimal expensesPaid)
        {
            if (expensesPaid <= 0m) return 0;

            if (loanRate?.RecoveryFeeLedgerID.HasValue == true && loanRate.RecoveryFeeLedgerID.Value > 0)
            {
                bool exists = await context.Ledgers.AnyAsync(l => l.LedgerID == loanRate.RecoveryFeeLedgerID.Value);
                if (exists) return loanRate.RecoveryFeeLedgerID.Value;
            }

            var legalMap = await context.LegalRecoveryLedgerMappings
                .AsNoTracking()
                .Where(m => m.IsActive && m.DebitLedgerId > 0)
                .OrderByDescending(m => m.BranchId)
                .FirstOrDefaultAsync();
            if (legalMap != null && legalMap.DebitLedgerId > 0)
            {
                return legalMap.DebitLedgerId;
            }

            var dynLedger = await context.Ledgers
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.IsActive &&
                    (l.LedgerName.Contains("कायदेशीर") || l.LedgerName.Contains("वसुली खर्च") || l.LedgerName.Contains("नोटीस") ||
                     l.LedgerName.Contains("Legal") || l.LedgerName.Contains("Court") || l.LedgerName.Contains("Recovery")));

            if (dynLedger != null)
            {
                return dynLedger.LedgerID;
            }

            throw new InvalidOperationException($"कर्ज वसुलीमधील कायदेशीर/वसुली खर्च (₹{expensesPaid:N2}) जमा करण्यासाठी 'वसुली फी / कायदेशीर खर्च लेजर' सापडले नाही. कृपया कर्ज दर पत्रकात 'Recovery Fee Ledger' जोडा.");
        }

        public static async Task<int> ResolveSurchargeLedgerIdAsync(AppDbContext context, int configuredSurchargeLedgerId, int overdueInterestLedgerId, decimal surchargeCollected)
        {
            if (surchargeCollected <= 0m) return configuredSurchargeLedgerId;
            if (configuredSurchargeLedgerId > 0) return configuredSurchargeLedgerId;

            var dynSurcharge = await context.Ledgers
                .Include(l => l.AccountGroup)
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.IsActive &&
                    (l.AccountType == "Income" || l.AccountType == "Revenue" || (l.AccountGroup != null && (l.AccountGroup.NatureOfGroup == "Income" || l.AccountGroup.NatureOfGroup == "Revenue"))) &&
                    (l.LedgerName.Contains("सरचार्ज") || l.LedgerName.Contains("दंड") || l.LedgerName.Contains("Surcharge") || l.LedgerName.Contains("Penalty")));

            if (dynSurcharge != null)
            {
                return dynSurcharge.LedgerID;
            }

            if (overdueInterestLedgerId > 0)
            {
                return overdueInterestLedgerId;
            }

            throw new InvalidOperationException($"सरचार्ज / दंड रक्कम (₹{surchargeCollected:N2}) जमा करण्यासाठी वैध 'सरचार्ज उत्पन्न लेजर' सापडले नाही. कृपया कर्ज दर पत्रकात लेजर मॅपिंग तपासा.");
        }
    }
}

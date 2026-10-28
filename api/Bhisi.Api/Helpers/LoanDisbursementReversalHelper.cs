using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;

namespace Bhisi.Api.Helpers
{
    public class SavingTransferTargetResult
    {
        public SavingAccountMaster SavingAccount { get; set; } = null!;
        public int SavingLiabilityLedgerId { get; set; }
        public int? SavingHolderCustomerId { get; set; }
        public int? SavingHolderMemberId { get; set; }
        public string SavingHolderFullName { get; set; } = string.Empty;
    }

    public static class LoanDisbursementReversalHelper
    {
        public static bool IsSavingTransferMode(string? paymentMode)
        {
            return paymentMode == "Saving Transfer" || paymentMode == "Saving";
        }

        /// <summary>
        /// Validates the target Saving Account for Loan Disbursement 'Saving Transfer',
        /// enforces Same-Branch restriction, resolves the exact Saving Deposit Liability GL Ledger,
        /// and resolves CustomerID-first party identifiers for the saving account holder.
        /// </summary>
        public static async Task<SavingTransferTargetResult> ResolveSavingTransferTargetAsync(
            AppDbContext context,
            string? transferToSavingAccountNo,
            int expectedBranchId,
            Dictionary<int, Ledger> validLedgerDict,
            List<Ledger> allLedgers)
        {
            if (string.IsNullOrWhiteSpace(transferToSavingAccountNo))
            {
                throw new InvalidOperationException("बचत खाते वर्ग (Saving Transfer) साठी वैध बचत खाते निवडणे बंधनकारक आहे.");
            }

            string cleanAccNo = transferToSavingAccountNo.Trim();
            string digitsOnly = new string(cleanAccNo.Where(char.IsDigit).ToArray());

            var savingAccount = await context.SavingAccountMasters
                .Include(s => s.SavingScheme)
                .Include(s => s.Customer)
                .FirstOrDefaultAsync(s =>
                    s.AccountNo == cleanAccNo ||
                    (digitsOnly.Length == 14 && s.AccountNo == digitsOnly));

            if (savingAccount == null)
            {
                throw new InvalidOperationException($"निवडलेले बचत खाते ({cleanAccNo}) सिस्टीममध्ये सापडले नाही.");
            }

            if (string.Equals(savingAccount.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(savingAccount.Status, "Frozen", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"निवडलेले बचत खाते (#{savingAccount.AccountNo}) सध्या '{savingAccount.Status}' स्थितीत असल्यामुळे त्यावर कर्ज वाटप रक्कम वर्ग करता येणार नाही.");
            }

            if (expectedBranchId > 0 && savingAccount.BranchID > 0 && savingAccount.BranchID != expectedBranchId)
            {
                throw new InvalidOperationException($"आंतर-शाखा बचत वर्ग अनुमत नाही: कर्ज खाते शाखा क्र. #{expectedBranchId} मधील असून निवडलेले बचत खाते (#{savingAccount.AccountNo}) शाखा क्र. #{savingAccount.BranchID} मधील आहे. कृपया एकाच शाखेतील बचत खाते निवडा.");
            }

            int resolvedLedgerId = await SavingLedgerHelper.ResolveSavingLiabilityLedgerIdAsync(
                context,
                savingAccount,
                preloadedLedgers: validLedgerDict);

            if (resolvedLedgerId <= 0 || !validLedgerDict.ContainsKey(resolvedLedgerId))
            {
                throw new InvalidOperationException(SavingLedgerHelper.GetMissingMappingErrorMessage(savingAccount.AccountNo));
            }

            int? holderCustomerId = savingAccount.CustomerID > 0 ? savingAccount.CustomerID : null;
            int? holderMemberId = null;
            if (holderCustomerId.HasValue)
            {
                holderMemberId = await context.Members
                    .AsNoTracking()
                    .Where(m => m.CustomerID == holderCustomerId.Value)
                    .Select(m => (int?)m.MemberID)
                    .FirstOrDefaultAsync();
            }

            string holderName = savingAccount.Customer != null
                ? string.Join(" ", new[] { savingAccount.Customer.FirstName, savingAccount.Customer.MiddleName, savingAccount.Customer.LastName }.Where(p => !string.IsNullOrWhiteSpace(p))).Trim()
                : "";

            return new SavingTransferTargetResult
            {
                SavingAccount = savingAccount,
                SavingLiabilityLedgerId = resolvedLedgerId,
                SavingHolderCustomerId = holderCustomerId,
                SavingHolderMemberId = holderMemberId,
                SavingHolderFullName = holderName
            };
        }

        /// <summary>
        /// Credits the target Saving Account and records the SavingTransaction ONLY when the
        /// Loan Disbursement Voucher is Approved/Posted. Idempotent by VoucherNo.
        /// </summary>
        public static async Task ApplyApprovedSavingTransferCreditAsync(
            AppDbContext context,
            LoanDisbursement disbursement,
            Voucher voucher,
            SavingAccountMaster? preloadedSavingAccount = null,
            string? loanAccountNo = null,
            string? borrowerName = null)
        {
            if (!IsSavingTransferMode(disbursement.PaymentMode) || disbursement.NetAmountPaid <= 0)
            {
                return;
            }

            if (!string.Equals(voucher.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(voucher.VoucherNo))
            {
                bool alreadyCredited = await context.SavingTransactions
                    .AnyAsync(st => st.VoucherNo == voucher.VoucherNo);
                if (alreadyCredited)
                {
                    return;
                }
            }

            SavingAccountMaster? savingAccount = preloadedSavingAccount;
            if (savingAccount == null && !string.IsNullOrWhiteSpace(disbursement.TransferToSavingAccountNo))
            {
                string cleanAccNo = disbursement.TransferToSavingAccountNo.Trim();
                string digitsOnly = new string(cleanAccNo.Where(char.IsDigit).ToArray());
                savingAccount = await context.SavingAccountMasters
                    .Include(s => s.Customer)
                    .FirstOrDefaultAsync(s =>
                        s.AccountNo == cleanAccNo ||
                        (digitsOnly.Length == 14 && s.AccountNo == digitsOnly));
            }

            if (savingAccount == null)
            {
                throw new InvalidOperationException($"कर्ज वाटपासाठी निवडलेले बचत खाते ({disbursement.TransferToSavingAccountNo}) सापडले नाही.");
            }

            if (string.Equals(savingAccount.Status, "Closed", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(savingAccount.Status, "Frozen", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"बचत खाते (#{savingAccount.AccountNo}) सध्या '{savingAccount.Status}' स्थितीत असल्यामुळे व्हाउचर पास करता येणार नाही.");
            }

            int expectedBranchId = disbursement.BranchID > 0
                ? disbursement.BranchID
                : (disbursement.LoanAccount?.BranchID ?? voucher.BranchID);

            if (expectedBranchId > 0 && savingAccount.BranchID > 0 && savingAccount.BranchID != expectedBranchId)
            {
                throw new InvalidOperationException($"आंतर-शाखा बचत वर्ग अनुमत नाही: कर्ज खाते शाखा #{expectedBranchId} आणि बचत खाते #{savingAccount.AccountNo} शाखा #{savingAccount.BranchID} भिन्न आहेत.");
            }

            string effectiveLoanAccNo = loanAccountNo ?? disbursement.LoanAccount?.LoanAccountNo ?? "";
            if (string.IsNullOrWhiteSpace(effectiveLoanAccNo) && disbursement.LoanAccountID > 0)
            {
                effectiveLoanAccNo = await context.LoanAccounts
                    .AsNoTracking()
                    .Where(l => l.LoanAccountID == disbursement.LoanAccountID)
                    .Select(l => l.LoanAccountNo)
                    .FirstOrDefaultAsync() ?? "";
            }

            savingAccount.CurrentBalance += disbursement.NetAmountPaid;
            context.Entry(savingAccount).State = EntityState.Modified;

            string narration = !string.IsNullOrWhiteSpace(borrowerName)
                ? $"Loan Disbursement Credit from Loan A/C: {effectiveLoanAccNo} ({borrowerName})"
                : $"Loan Disbursement Credit from Loan A/C: {effectiveLoanAccNo}";

            var savingTxn = new SavingTransaction
            {
                SavingAccountID = savingAccount.SavingAccountID,
                CustomerID = savingAccount.CustomerID,
                BranchID = savingAccount.BranchID > 0 ? savingAccount.BranchID : (expectedBranchId > 0 ? expectedBranchId : 1),
                TransactionDate = disbursement.DisbursementDate,
                TransactionType = "Deposit",
                Amount = disbursement.NetAmountPaid,
                BalanceAfterTxn = savingAccount.CurrentBalance,
                PaymentMode = "Transfer",
                VoucherNo = voucher.VoucherNo,
                Narration = narration,
                CreatedOn = DateTime.Now
            };

            context.SavingTransactions.Add(savingTxn);
            await context.SaveChangesAsync();
        }

        /// <summary>
        /// Reverses any posted SavingTransaction and SavingAccountMaster.CurrentBalance linked to a VoucherNo.
        /// Safely blocks reversal if the credited funds have already been withdrawn from the saving account.
        /// </summary>
        public static async Task ReverseSavingTransferCreditForVoucherAsync(AppDbContext context, string? voucherNo)
        {
            if (string.IsNullOrWhiteSpace(voucherNo))
            {
                return;
            }

            var linkedSavingTxns = await context.SavingTransactions
                .Where(st => st.VoucherNo == voucherNo)
                .ToListAsync();

            if (!linkedSavingTxns.Any())
            {
                return;
            }

            foreach (var st in linkedSavingTxns)
            {
                var savAcc = await context.SavingAccountMasters.FindAsync(st.SavingAccountID);
                if (savAcc != null && (st.TransactionType == "Deposit" || st.TransactionType == "Interest"))
                {
                    if (savAcc.CurrentBalance < st.Amount - 0.01m)
                    {
                        throw new InvalidOperationException($"बचत खाते क्र. {savAcc.AccountNo} मधून कर्ज वाटपाची रक्कम आधीच काढली गेली असल्यामुळे (सध्याची शिल्लक: ₹{savAcc.CurrentBalance:N2}, रिव्हर्स रक्कम: ₹{st.Amount:N2}) हा व्यवहार अन-पास किंवा रद्द करता येणार नाही.");
                    }

                    savAcc.CurrentBalance -= st.Amount;
                    context.Entry(savAcc).State = EntityState.Modified;
                }

                context.SavingTransactions.Remove(st);
            }
        }

        /// <summary>
        /// Atomically reverses and deletes a LoanDisbursement from either LoanDisbursementsController
        /// or VoucherPostingController (Reject / Delete Pending Voucher).
        /// </summary>
        public static async Task ReverseAndDeleteDisbursementAsync(
            AppDbContext context,
            LoanDisbursement disbursement,
            Voucher? voucher = null,
            bool deleteVoucherRecord = true)
        {
            var loanAcc = await context.LoanAccounts.FindAsync(disbursement.LoanAccountID);
            var remainingDisbursements = await context.LoanDisbursements
                .Where(d => d.LoanAccountID == disbursement.LoanAccountID && d.LoanDisbursementID != disbursement.LoanDisbursementID)
                .ToListAsync();

            if (loanAcc != null)
            {
                bool hasCollections = await context.LoanCollections
                    .AnyAsync(c => c.LoanAccountID == loanAcc.LoanAccountID);

                if (hasCollections && (!remainingDisbursements.Any() || loanAcc.PrincipalBalance < disbursement.DisbursementAmount - 0.01m))
                {
                    throw new InvalidOperationException($"कर्ज खाते क्र. {loanAcc.LoanAccountNo} वर आधीच कर्ज वसुलीच्या नोंदी झाल्या असल्यामुळे हे कर्ज वाटप रद्द / डिलीट करता येणार नाही.");
                }
            }

            int vId = disbursement.VoucherID ?? voucher?.VoucherID ?? disbursement.Voucher?.VoucherID ?? 0;
            Voucher? effectiveVoucher = voucher ?? disbursement.Voucher;
            if (effectiveVoucher == null && vId > 0)
            {
                effectiveVoucher = await context.Vouchers
                    .Include(v => v.VoucherDetails)
                    .FirstOrDefaultAsync(v => v.VoucherID == vId);
            }
            string? effectiveVoucherNo = effectiveVoucher?.VoucherNo;

            // 1. Reverse linked SavingTransactions & SavingAccountMasters.CurrentBalance (if credited)
            if (!string.IsNullOrWhiteSpace(effectiveVoucherNo))
            {
                await ReverseSavingTransferCreditForVoucherAsync(context, effectiveVoucherNo);
            }

            // 2. Reverse linked ShareTransactions, ShareCertificates, and ShareAccount totals
            if (vId > 0)
            {
                var linkedShareTxns = await context.ShareTransactions
                    .Where(st => st.VoucherId == vId)
                    .ToListAsync();

                foreach (var st in linkedShareTxns)
                {
                    var shAcc = await context.ShareAccounts.FindAsync(st.ShareAccountId);
                    if (shAcc != null)
                    {
                        shAcc.TotalShareCount = Math.Max(0, shAcc.TotalShareCount - st.NumberOfShares);
                        shAcc.TotalShareAmount = Math.Max(0, shAcc.TotalShareAmount - st.Amount);
                        context.Entry(shAcc).State = EntityState.Modified;
                    }

                    ShareCertificate? matchedCert = null;
                    if (!string.IsNullOrWhiteSpace(st.Narration))
                    {
                        var certMatch = Regex.Match(st.Narration, @"Cert:\s*([A-Za-z0-9-]+)");
                        if (certMatch.Success)
                        {
                            string certNo = certMatch.Groups[1].Value.Trim();
                            matchedCert = await context.ShareCertificates
                                .FirstOrDefaultAsync(c => c.ShareAccountId == st.ShareAccountId && c.CertificateNo == certNo);
                        }
                    }

                    if (matchedCert == null)
                    {
                        matchedCert = await context.ShareCertificates
                            .Where(c => c.ShareAccountId == st.ShareAccountId &&
                                        c.NumberOfShares == st.NumberOfShares &&
                                        c.IssueDate.Date == st.TransactionDate.Date)
                            .OrderByDescending(c => c.CertificateId)
                            .FirstOrDefaultAsync();
                    }

                    if (matchedCert != null)
                    {
                        var certPrints = await context.ShareCertificatePrintHistories
                            .Where(p => p.CertificateId == matchedCert.CertificateId)
                            .ToListAsync();
                        if (certPrints.Any())
                        {
                            context.ShareCertificatePrintHistories.RemoveRange(certPrints);
                        }
                        context.ShareCertificates.Remove(matchedCert);
                    }

                    context.ShareTransactions.Remove(st);
                }
            }

            // 3. Remove LoanDisbursementDeductions
            var deductions = (disbursement.Deductions != null && disbursement.Deductions.Any())
                ? disbursement.Deductions.ToList()
                : await context.LoanDisbursementDeductions
                    .Where(d => d.LoanDisbursementID == disbursement.LoanDisbursementID)
                    .ToListAsync();

            if (deductions.Any())
            {
                context.LoanDisbursementDeductions.RemoveRange(deductions);
            }

            // 4. Remove CollateralComplianceLogs created by disbursement
            var complianceLogs = await context.CollateralComplianceLogs
                .Where(c => c.LoanAccountID == disbursement.LoanAccountID &&
                            (!remainingDisbursements.Any() || c.ValuationDate.Date == disbursement.DisbursementDate.Date))
                .ToListAsync();
            if (complianceLogs.Any())
            {
                context.CollateralComplianceLogs.RemoveRange(complianceLogs);
            }

            // 5. Remove Disbursement record before optional LoanAccount cleanup
            context.LoanDisbursements.Remove(disbursement);

            // 6. Reverse LoanAccount, Schedules, Gold Ornaments Link, and Deposit Collateral Liens
            if (loanAcc != null)
            {
                loanAcc.PrincipalBalance = Math.Max(0, loanAcc.PrincipalBalance - disbursement.DisbursementAmount);

                if (!remainingDisbursements.Any())
                {
                    var allPendingSchedules = await context.LoanInstallmentSchedules
                        .Where(s => s.LoanAccountID == loanAcc.LoanAccountID)
                        .ToListAsync();
                    if (allPendingSchedules.Any())
                    {
                        context.LoanInstallmentSchedules.RemoveRange(allPendingSchedules);
                    }

                    if (loanAcc.LoanApplicationID.HasValue)
                    {
                        var app = await context.LoanApplications.FindAsync(loanAcc.LoanApplicationID.Value);
                        if (app != null)
                        {
                            app.LoanAccountNo = null;
                            context.Entry(app).State = EntityState.Modified;
                        }
                    }

                    // Unlink GoldLoanDetails back to LoanApplication (preserving ornament valuation data)
                    var linkedGoldDetails = await context.GoldLoanDetails
                        .Where(g => g.LoanAccountID == loanAcc.LoanAccountID)
                        .ToListAsync();
                    foreach (var gold in linkedGoldDetails)
                    {
                        if (gold.LoanApplicationID.HasValue && gold.LoanApplicationID.Value > 0)
                        {
                            gold.LoanAccountID = null;
                            context.Entry(gold).State = EntityState.Modified;
                        }
                        else if (!loanAcc.IsOpeningBalance)
                        {
                            context.GoldLoanDetails.Remove(gold);
                        }
                    }

                    // Release Deposit Collateral Liens back to Pledged
                    var linkedCollaterals = await context.LoanDepositCollaterals
                        .Where(c => c.LoanAccountID == loanAcc.LoanAccountID)
                        .ToListAsync();

                    foreach (var col in linkedCollaterals)
                    {
                        if (col.CollateralType == "FixedDeposit")
                        {
                            var fd = await context.FdAccounts.FindAsync(col.DepositAccountID);
                            if (fd != null && (fd.LienLoanAccountNo == loanAcc.LoanAccountNo || fd.IsLienMarked))
                            {
                                fd.IsLienMarked = false;
                                fd.LienLoanAccountNo = null;
                                fd.LienAmount = 0;
                                context.Entry(fd).State = EntityState.Modified;
                            }
                        }
                        else if (col.CollateralType == "PigmyDeposit")
                        {
                            var pg = await context.PigmyAccounts.FindAsync(col.DepositAccountID);
                            if (pg != null && (pg.LienLoanAccountNo == loanAcc.LoanAccountNo || pg.IsLienMarked))
                            {
                                pg.IsLienMarked = false;
                                pg.LienLoanAccountNo = null;
                                pg.LienAmount = 0;
                                context.Entry(pg).State = EntityState.Modified;
                            }
                        }
                        else if (col.CollateralType == "RecurringDeposit")
                        {
                            var rd = await context.RdAccounts.FindAsync(col.DepositAccountID);
                            if (rd != null && (rd.LienLoanAccountNo == loanAcc.LoanAccountNo || rd.IsLienMarked))
                            {
                                rd.IsLienMarked = false;
                                rd.LienLoanAccountNo = null;
                                rd.LienAmount = 0;
                                context.Entry(rd).State = EntityState.Modified;
                            }
                        }
                        else if (col.CollateralType == "SavingDeposit")
                        {
                            var sav = await context.SavingAccountMasters.FindAsync(col.DepositAccountID);
                            if (sav != null && sav.LienReason != null && sav.LienReason.Contains(loanAcc.LoanAccountNo ?? ""))
                            {
                                sav.LienAmount = 0;
                                sav.LienReason = null;
                                context.Entry(sav).State = EntityState.Modified;
                            }
                        }

                        if (col.LoanApplicationID.HasValue)
                        {
                            col.LoanAccountID = null;
                            col.LienStatus = "Pledged";
                            col.LienMarkedDate = null;
                            context.Entry(col).State = EntityState.Modified;
                        }
                        else if (!loanAcc.IsOpeningBalance)
                        {
                            context.LoanDepositCollaterals.Remove(col);
                        }
                    }

                    // Remove newly created empty LoanAccount if no other records reference it
                    if (!loanAcc.IsOpeningBalance)
                    {
                        var npaStatuses = await context.LoanAccountNpaStatuses
                            .Where(n => n.LoanAccountID == loanAcc.LoanAccountID)
                            .ToListAsync();
                        if (npaStatuses.Any())
                        {
                            context.LoanAccountNpaStatuses.RemoveRange(npaStatuses);
                        }

                        bool hasOtherRefs =
                            await context.LoanCollections.AnyAsync(c => c.LoanAccountID == loanAcc.LoanAccountID) ||
                            await context.LoanDocuments.AnyAsync(d => d.LoanAccountID == loanAcc.LoanAccountID) ||
                            await context.OverdueInterestLedgers.AnyAsync(o => o.LoanAccountID == loanAcc.LoanAccountID) ||
                            await context.OverdueRecoveryLedgers.AnyAsync(o => o.LoanAccountID == loanAcc.LoanAccountID) ||
                            await context.Sec101CaseMasters.AnyAsync(s => s.LoanAccountId == loanAcc.LoanAccountID) ||
                            await context.Sec101NoticeHistories.AnyAsync(s => s.LoanAccountId == loanAcc.LoanAccountID) ||
                            await context.Sec101LegalExpenses.AnyAsync(s => s.LoanAccountId == loanAcc.LoanAccountID) ||
                            await context.FdMisPayouts.AnyAsync(f => f.TargetLoanAccountID == loanAcc.LoanAccountID);

                        if (!hasOtherRefs)
                        {
                            context.LoanAccounts.Remove(loanAcc);
                        }
                        else
                        {
                            loanAcc.LoanApplicationID = null;
                            loanAcc.Status = "Closed";
                            context.Entry(loanAcc).State = EntityState.Modified;
                        }
                    }
                    else
                    {
                        context.Entry(loanAcc).State = EntityState.Modified;
                    }
                }
                else
                {
                    var oldPendingSchedules = await context.LoanInstallmentSchedules
                        .Where(s => s.LoanAccountID == loanAcc.LoanAccountID && s.Status != "Paid")
                        .ToListAsync();
                    if (oldPendingSchedules.Any())
                    {
                        context.LoanInstallmentSchedules.RemoveRange(oldPendingSchedules);
                    }

                    if (loanAcc.PrincipalBalance > 0 && loanAcc.LoanRateID > 0)
                    {
                        var loanRateForCalc = await context.LoanRates.FindAsync(loanAcc.LoanRateID);
                        if (loanRateForCalc != null)
                        {
                            var scheduleRecords = LoanScheduleGenerator.GenerateSchedules(loanAcc, loanRateForCalc);
                            foreach (var s in scheduleRecords)
                            {
                                s.LoanAccountID = loanAcc.LoanAccountID;
                                context.LoanInstallmentSchedules.Add(s);
                            }
                        }
                    }
                    context.Entry(loanAcc).State = EntityState.Modified;
                }
            }

            // 7. Delete Voucher & VoucherDetails when invoked directly from LoanDisbursementsController
            if (deleteVoucherRecord && vId > 0)
            {
                var details = (effectiveVoucher?.VoucherDetails != null && effectiveVoucher.VoucherDetails.Any())
                    ? effectiveVoucher.VoucherDetails.ToList()
                    : await context.VoucherDetails.Where(vd => vd.VoucherID == vId).ToListAsync();

                if (details.Any())
                {
                    context.VoucherDetails.RemoveRange(details);
                }

                if (effectiveVoucher != null)
                {
                    context.Vouchers.Remove(effectiveVoucher);
                }
            }
        }
    }
}

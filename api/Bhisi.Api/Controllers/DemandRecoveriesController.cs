using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DemandRecoveriesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DemandRecoveriesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/DemandRecoveries
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<DemandRecovery>>> GetDemandRecoveries()
        {
            return await _context.DemandRecoveries
                .Include(d => d.Voucher)
                .Include(d => d.DemandNotice)
                    .ThenInclude(dn => dn!.Employer)
                .OrderByDescending(d => d.RecoveryDate)
                .ToListAsync();
        }

        [HttpPost("process")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> ProcessRecovery([FromBody] ProcessRecoveryDto request)
        {
            if (request == null || request.DemandNoticeId <= 0)
            {
                return BadRequest("कृपया वैध डिमान्ड नोटीस निवडा.");
            }

            if (request.TotalReceivedAmount <= 0)
            {
                return BadRequest("मिळालेली एकूण रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }

            var demand = await _context.DemandNotices
                .Include(d => d.Employer)
                .Include(d => d.MemberDetails)
                    .ThenInclude(md => md.Member)
                        .ThenInclude(m => m!.Customer)
                .FirstOrDefaultAsync(d => d.DemandNoticeId == request.DemandNoticeId);

            if (demand == null)
            {
                return NotFound("डिमान्ड नोटीस सापडली नाही. (Demand notice not found.)");
            }

            if (demand.Status == "Received")
            {
                return BadRequest("या डिमान्ड नोटीसची संपूर्ण वसुली यापूर्वीच झालेली आहे.");
            }

            if (demand.MemberDetails == null || !demand.MemberDetails.Any())
            {
                return BadRequest("या डिमान्ड नोटीसमध्ये कोणताही सभासद कपात तपशील आढळला नाही.");
            }

            decimal alreadyRecovered = await _context.DemandRecoveries
                .Where(r => r.DemandNoticeId == demand.DemandNoticeId)
                .SumAsync(r => (decimal?)r.TotalReceivedAmount) ?? 0m;

            decimal pendingDemandAmount = Math.Max(0m, demand.TotalDemandAmount - alreadyRecovered);
            if (pendingDemandAmount > 0 && request.TotalReceivedAmount > pendingDemandAmount + 0.01m)
            {
                return BadRequest($"मिळालेली रक्कम (₹{request.TotalReceivedAmount:N2}) प्रलंबित डिमान्ड रकमेपेक्षा (₹{pendingDemandAmount:N2}) जास्त असू शकत नाही.");
            }

            int branchId = demand.BranchId > 0 ? demand.BranchId : 1;
            string mode = string.IsNullOrWhiteSpace(request.PaymentMode) ? "Bank" : request.PaymentMode.Trim();
            bool isBankMode = Helpers.BankLedgerHelper.IsBankPaymentMode(mode);

            int debitLedgerId;
            if (isBankMode)
            {
                var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerID);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
                debitLedgerId = bankCheck.LedgerId;
            }
            else if (string.Equals(mode, "Cash", StringComparison.OrdinalIgnoreCase))
            {
                debitLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "DEMAND");
                if (debitLedgerId <= 0)
                {
                    return BadRequest("या शाखेसाठी रोख शिल्लक लेजर सापडले नाही. कृपया शाखा मास्टरमध्ये रोख खाते तपासा.");
                }
            }
            else
            {
                return BadRequest($"अवैध पेमेंट पद्धत: {mode}. कृपया 'Bank' किंवा 'Cash' निवडा.");
            }

            var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            int fyId = activeFy?.FinancialYearID ?? 1;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                string refSuffix = !string.IsNullOrWhiteSpace(request.ReferenceNo) ? $" [संदर्भ: {request.ReferenceNo.Trim()}]" : "";
                string employerName = demand.Employer?.Name ?? "संस्था";
                string vchNo = await Helpers.VoucherNumberHelper.NextVoucherNoAsync(_context, $"VCH-DMD-{request.RecoveryDate:yyyyMMdd}-", 4);

                var voucher = new Voucher
                {
                    BranchID = branchId,
                    VoucherNo = vchNo,
                    VoucherDate = request.RecoveryDate,
                    VoucherType = "Receipt",
                    Status = "Pending",
                    TotalAmount = request.TotalReceivedAmount,
                    Narration = $"मासिक पगार डिमान्ड वसुली - नोटीस क्र. {demand.NoticeNumber} ({employerName}, {demand.Month:D2}/{demand.Year}){refSuffix}",
                    CreatedBy = 1,
                    CreatedOn = DateTime.UtcNow
                };

                _context.Vouchers.Add(voucher);
                await _context.SaveChangesAsync();

                // Primary Debit Line (Bank or Cash)
                _context.VoucherDetails.Add(new VoucherDetail
                {
                    VoucherID = voucher.VoucherID,
                    LedgerID = debitLedgerId,
                    DrCr = "Dr",
                    Amount = request.TotalReceivedAmount
                });

                decimal remainingPool = Math.Round(request.TotalReceivedAmount, 2, MidpointRounding.AwayFromZero);
                var targetDetails = demand.MemberDetails
                    .Where(md => !md.IsProcessed)
                    .OrderBy(md => md.DemandMemberDetailId)
                    .ToList();

                if (!targetDetails.Any())
                {
                    targetDetails = demand.MemberDetails.OrderBy(md => md.DemandMemberDetailId).ToList();
                }

                Ledger? shareCapitalLedger = null;

                foreach (var detail in targetDetails)
                {
                    if (remainingPool <= 0m) break;

                    var member = detail.Member ?? await _context.Members
                        .Include(m => m.Customer)
                        .FirstOrDefaultAsync(m => m.MemberID == detail.MemberId);

                    if (member == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest($"डिमान्ड यादीतील सभासद (ID: {detail.MemberId}) प्रणालीत आढळला नाही.");
                    }

                    string memberDisplayName = member.Customer != null
                        ? $"{member.Customer.FirstName} {member.Customer.LastName}".Trim()
                        : $"सभासद #{member.MemberCode ?? member.MemberID.ToString()}";

                    decimal memberAllocated = 0m;
                    decimal memberPlanned = detail.ShareDeposit + detail.SavingDeposit + detail.RdDeposit + detail.PigmyDeposit + detail.LoanInstallment;
                    if (memberPlanned <= 0 && detail.TotalDeduction > 0)
                    {
                        // If only TotalDeduction was populated without breakdown, allocate to Saving account
                        detail.SavingDeposit = detail.TotalDeduction;
                        memberPlanned = detail.TotalDeduction;
                    }

                    // 1. Share Deposit Allocation
                    if (detail.ShareDeposit > 0 && remainingPool > 0)
                    {
                        decimal allocShare = Math.Min(remainingPool, detail.ShareDeposit);
                        shareCapitalLedger ??= await Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(_context);

                        var shareAcc = await _context.ShareAccounts
                            .FirstOrDefaultAsync(s => (s.MemberId == member.MemberID || (member.CustomerID > 0 && s.CustomerID == member.CustomerID)) && s.Status == "Active");

                        if (shareAcc != null)
                        {
                            var activeShareScheme = await _context.ShareSchemes.OrderByDescending(s => s.IsActive).FirstOrDefaultAsync();
                            decimal faceValue = (activeShareScheme != null && activeShareScheme.ShareFaceValue > 0) ? activeShareScheme.ShareFaceValue : 100m;
                            int addedShares = (int)Math.Floor(allocShare / faceValue);

                            shareAcc.TotalShareAmount += allocShare;
                            shareAcc.TotalShareCount += addedShares;

                            _context.ShareTransactions.Add(new ShareTransaction
                            {
                                ShareAccountId = shareAcc.ShareAccountId,
                                CustomerID = shareAcc.CustomerID,
                                TransactionDate = request.RecoveryDate,
                                TransactionType = "Allotment",
                                NumberOfShares = addedShares,
                                Amount = allocShare,
                                Narration = $"डिमान्ड वसुली जमा - नोटीस {demand.NoticeNumber}",
                                VoucherId = voucher.VoucherID
                            });
                        }

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = shareCapitalLedger.LedgerID,
                            DrCr = "Cr",
                            Amount = allocShare,
                            MemberID = member.MemberID,
                            CustomerID = member.CustomerID > 0 ? member.CustomerID : null
                        });

                        remainingPool -= allocShare;
                        memberAllocated += allocShare;
                    }

                    // 2. Saving Deposit Allocation
                    if (detail.SavingDeposit > 0 && remainingPool > 0)
                    {
                        decimal allocSaving = Math.Min(remainingPool, detail.SavingDeposit);
                        var savAcc = await _context.SavingAccountMasters
                            .FirstOrDefaultAsync(s => s.CustomerID == member.CustomerID && s.Status == "Active");

                        if (savAcc == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"{memberDisplayName} यांचे सक्रिय बचत खाते आढळले नाही (डिमान्ड बचत कपात: ₹{allocSaving:N2}).");
                        }

                        int savLiabLedgerId = await Helpers.SavingLedgerHelper.TryResolveSavingLiabilityLedgerIdAsync(_context, savAcc);
                        if (savLiabLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest(Helpers.SavingLedgerHelper.GetMissingMappingErrorMessage(savAcc.AccountNo));
                        }

                        savAcc.CurrentBalance += allocSaving;
                        _context.SavingTransactions.Add(new SavingTransaction
                        {
                            SavingAccountID = savAcc.SavingAccountID,
                            CustomerID = savAcc.CustomerID,
                            BranchID = branchId,
                            TransactionDate = request.RecoveryDate,
                            TransactionType = "Deposit",
                            Amount = allocSaving,
                            BalanceAfterTxn = savAcc.CurrentBalance,
                            PaymentMode = isBankMode ? "Bank" : "Cash",
                            VoucherNo = voucher.VoucherNo,
                            Narration = $"डिमान्ड वसुली जमा - नोटीस {demand.NoticeNumber}",
                            CreatedOn = DateTime.UtcNow
                        });

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = savLiabLedgerId,
                            DrCr = "Cr",
                            Amount = allocSaving,
                            CustomerID = savAcc.CustomerID,
                            MemberID = member.MemberID
                        });

                        remainingPool -= allocSaving;
                        memberAllocated += allocSaving;
                    }

                    // 3. RD Deposit Allocation
                    if (detail.RdDeposit > 0 && remainingPool > 0)
                    {
                        decimal allocRd = Math.Min(remainingPool, detail.RdDeposit);
                        var rdAcc = await _context.RdAccounts
                            .Include(r => r.RdScheme)
                            .FirstOrDefaultAsync(r => r.CustomerID == member.CustomerID && r.Status == "Active");

                        if (rdAcc == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"{memberDisplayName} यांचे सक्रिय आवर्ती ठेव (RD) खाते आढळले नाही (डिमान्ड RD कपात: ₹{allocRd:N2}).");
                        }

                        int rdLiabLedgerId = rdAcc.RdScheme?.RdLiabilityLedgerID ?? 0;
                        if (rdLiabLedgerId <= 0)
                        {
                            var dynRd = await _context.Ledgers
                                .Include(l => l.AccountGroup)
                                .FirstOrDefaultAsync(l => l.IsActive &&
                                    (l.AccountType == "Liabilities" || (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Liabilities")) &&
                                    (l.LedgerName.Contains("आवर्ती") || l.LedgerName.Contains("RD") || l.LedgerName.Contains("Recurring")));
                            rdLiabLedgerId = dynRd?.LedgerID ?? 0;
                        }

                        if (rdLiabLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"RD खाते (#{rdAcc.AccountNo}) योजनेला 'RD देयता लेजर' जोडलेले नाही.");
                        }

                        rdAcc.TotalDepositedAmount += allocRd;
                        rdAcc.TotalPaidInstallments += 1;

                        _context.RdTransactions.Add(new RdTransaction
                        {
                            InstitutionID = rdAcc.InstitutionID,
                            BranchID = branchId,
                            FinancialYearID = fyId,
                            RdAccountID = rdAcc.RdAccountID,
                            VoucherID = voucher.VoucherID,
                            TransactionDate = request.RecoveryDate,
                            TransactionType = "Installment",
                            InstallmentNo = rdAcc.TotalPaidInstallments,
                            DebitCredit = "Cr",
                            PrincipalAmount = allocRd,
                            BalanceAfterTxn = rdAcc.TotalDepositedAmount,
                            Narration = $"डिमान्ड वसुली हप्ता - नोटीस {demand.NoticeNumber}"
                        });

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = rdLiabLedgerId,
                            DrCr = "Cr",
                            Amount = allocRd,
                            CustomerID = rdAcc.CustomerID,
                            MemberID = member.MemberID
                        });

                        remainingPool -= allocRd;
                        memberAllocated += allocRd;
                    }

                    // 4. Pigmy Deposit Allocation
                    if (detail.PigmyDeposit > 0 && remainingPool > 0)
                    {
                        decimal allocPigmy = Math.Min(remainingPool, detail.PigmyDeposit);
                        var pigmyAcc = await _context.PigmyAccounts
                            .Include(p => p.PigmyScheme)
                            .FirstOrDefaultAsync(p => p.CustomerID == member.CustomerID && p.Status == "Active");

                        if (pigmyAcc == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"{memberDisplayName} यांचे सक्रिय पिग्मी ठेव खाते आढळले नाही (डिमान्ड पिग्मी कपात: ₹{allocPigmy:N2}).");
                        }

                        int pigmyLiabId = pigmyAcc.PigmyScheme?.PigmyLiabilityLedgerID ?? 0;
                        if (pigmyLiabId <= 0)
                        {
                            var pigmyMap = await _context.PigmyVoucherMappings.FirstOrDefaultAsync();
                            pigmyLiabId = pigmyMap?.CreditLedgerId ?? 0;
                        }

                        if (pigmyLiabId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"पिग्मी खाते (#{pigmyAcc.AccountNo}) योजनेला 'पिग्मी देयता लेजर' जोडलेले नाही.");
                        }

                        pigmyAcc.TotalDepositedAmount += allocPigmy;
                        decimal netPigmyBal = pigmyAcc.TotalDepositedAmount - pigmyAcc.TotalWithdrawnAmount;

                        _context.PigmyTransactions.Add(new PigmyTransaction
                        {
                            PigmyAccountID = pigmyAcc.PigmyAccountID,
                            TransactionDate = request.RecoveryDate,
                            ValueDate = request.RecoveryDate,
                            TransactionType = "DEPOSIT",
                            DrAmount = 0,
                            CrAmount = allocPigmy,
                            BalanceAmount = netPigmyBal,
                            Narration = $"डिमान्ड वसुली जमा - नोटीस {demand.NoticeNumber}",
                            ReferenceId = voucher.VoucherNo
                        });

                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = pigmyLiabId,
                            DrCr = "Cr",
                            Amount = allocPigmy,
                            CustomerID = pigmyAcc.CustomerID,
                            MemberID = member.MemberID
                        });

                        remainingPool -= allocPigmy;
                        memberAllocated += allocPigmy;
                    }

                    // 5. Loan Installment Allocation
                    if (detail.LoanInstallment > 0 && remainingPool > 0)
                    {
                        decimal allocLoan = Math.Min(remainingPool, detail.LoanInstallment);
                        var loanAcc = await _context.LoanAccounts
                            .Include(l => l.LoanRate)
                            .Where(l => (l.MemberID == member.MemberID || (member.CustomerID > 0 && l.CustomerID == member.CustomerID))
                                        && l.Status != "Closed"
                                        && (l.PrincipalBalance > 0 || l.InterestBalance > 0 || l.OverdueInterestBalance > 0))
                            .OrderBy(l => l.OpeningDate)
                            .FirstOrDefaultAsync();

                        if (loanAcc == null)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"{memberDisplayName} यांचे सक्रिय कर्ज खाते आढळले नाही (डिमान्ड कर्ज हप्ता: ₹{allocLoan:N2}).");
                        }

                        int loanLedgerId = loanAcc.LoanRate?.LoanLedgerID ?? 0;
                        int intLedgerId = loanAcc.LoanRate?.InterestLedgerID ?? 0;
                        int recIntLedgerId = (loanAcc.LoanRate?.ReceivableInterestLedgerID.HasValue == true && loanAcc.LoanRate.ReceivableInterestLedgerID.Value > 0)
                            ? loanAcc.LoanRate.ReceivableInterestLedgerID.Value
                            : intLedgerId;
                        int ovdIntLedgerId = (loanAcc.LoanRate?.OverdueInterestLedgerID.HasValue == true && loanAcc.LoanRate.OverdueInterestLedgerID.Value > 0)
                            ? loanAcc.LoanRate.OverdueInterestLedgerID.Value
                            : intLedgerId;

                        decimal penPaid = Math.Min(allocLoan, loanAcc.OverdueInterestBalance);
                        decimal remAfterPen = allocLoan - penPaid;
                        decimal intPaid = Math.Min(remAfterPen, loanAcc.InterestBalance);
                        decimal prinPaid = remAfterPen - intPaid;

                        if (prinPaid > 0 && loanLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"कर्ज खाते (#{loanAcc.LoanAccountNo}) योजनेला 'मुद्दल लेजर' (Loan Principal Ledger) जोडलेले नाही.");
                        }
                        if (intPaid > 0 && recIntLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"कर्ज खाते (#{loanAcc.LoanAccountNo}) योजनेला 'व्याज लेजर' जोडलेले नाही.");
                        }
                        if (penPaid > 0 && ovdIntLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"कर्ज खाते (#{loanAcc.LoanAccountNo}) योजनेला 'दंड/थकीत व्याज लेजर' जोडलेले नाही.");
                        }

                        loanAcc.OverdueInterestBalance -= penPaid;
                        loanAcc.InterestBalance -= intPaid;
                        loanAcc.PrincipalBalance = Math.Max(0m, loanAcc.PrincipalBalance - prinPaid);
                        loanAcc.PurePrincipalBalance = Math.Max(0m, loanAcc.PurePrincipalBalance - Math.Min(loanAcc.PurePrincipalBalance, prinPaid));
                        loanAcc.LastInstallmentPaidDate = request.RecoveryDate;

                        if (loanAcc.PrincipalBalance <= 0 && loanAcc.InterestBalance <= 0 && loanAcc.OverdueInterestBalance <= 0)
                        {
                            loanAcc.Status = "Closed";
                        }

                        _context.LoanCollections.Add(new LoanCollection
                        {
                            LoanAccountID = loanAcc.LoanAccountID,
                            BranchID = branchId,
                            CollectionDate = request.RecoveryDate,
                            ReceiptNo = voucher.VoucherNo,
                            TotalAmountReceived = allocLoan,
                            PenaltyInterestCollected = penPaid,
                            ReceivableInterestCollected = intPaid,
                            InterestCollected = 0,
                            PrincipalCollected = prinPaid,
                            PaymentMode = isBankMode ? "Bank" : "Cash",
                            BankAccountLedgerID = isBankMode ? debitLedgerId : null,
                            ChequeNo = request.ReferenceNo,
                            VoucherID = voucher.VoucherID,
                            Remarks = $"डिमान्ड वसुली - नोटीस {demand.NoticeNumber}"
                        });

                        if (prinPaid > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = voucher.VoucherID,
                                LedgerID = loanLedgerId,
                                DrCr = "Cr",
                                Amount = prinPaid,
                                MemberID = member.MemberID,
                                CustomerID = loanAcc.CustomerID
                            });
                        }
                        if (intPaid > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = voucher.VoucherID,
                                LedgerID = recIntLedgerId,
                                DrCr = "Cr",
                                Amount = intPaid,
                                MemberID = member.MemberID,
                                CustomerID = loanAcc.CustomerID
                            });
                        }
                        if (penPaid > 0)
                        {
                            _context.VoucherDetails.Add(new VoucherDetail
                            {
                                VoucherID = voucher.VoucherID,
                                LedgerID = ovdIntLedgerId,
                                DrCr = "Cr",
                                Amount = penPaid,
                                MemberID = member.MemberID,
                                CustomerID = loanAcc.CustomerID
                            });
                        }

                        remainingPool -= allocLoan;
                        memberAllocated += allocLoan;
                    }

                    if (memberPlanned > 0 && memberAllocated >= memberPlanned - 0.01m)
                    {
                        detail.IsProcessed = true;
                    }
                }

                if (remainingPool > 0.01m)
                {
                    await transaction.RollbackAsync();
                    return BadRequest($"मिळालेल्या रकमेपैकी ₹{remainingPool:N2} रक्कम कोणत्याही सभासद खात्यात वर्ग करता आली नाही. कृपया प्रलंबित डिमान्ड रक्कम तपासा.");
                }

                await Helpers.VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);

                bool allProcessed = demand.MemberDetails.All(md => md.IsProcessed);
                decimal totalRecoveredNow = alreadyRecovered + request.TotalReceivedAmount;
                demand.Status = (allProcessed || (demand.TotalDemandAmount > 0 && totalRecoveredNow >= demand.TotalDemandAmount - 0.01m))
                    ? "Received"
                    : "PartiallyReceived";

                var recovery = new DemandRecovery
                {
                    DemandNoticeId = request.DemandNoticeId,
                    RecoveryDate = request.RecoveryDate,
                    TotalReceivedAmount = request.TotalReceivedAmount,
                    VoucherId = voucher.VoucherID,
                    Remarks = !string.IsNullOrWhiteSpace(request.Remarks)
                        ? request.Remarks
                        : $"[{mode}] डिमान्ड वसुली ({voucher.VoucherNo}){refSuffix}"
                };

                _context.DemandRecoveries.Add(recovery);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"डिमान्ड वसुली यशस्वीरीत्या नोंदवली व पासिंगसाठी व्हाउचर ({voucher.VoucherNo}) तयार झाले!",
                    recovery.DemandRecoveryId,
                    recovery.DemandNoticeId,
                    recovery.RecoveryDate,
                    recovery.TotalReceivedAmount,
                    recovery.VoucherId,
                    voucherNo = voucher.VoucherNo,
                    demandStatus = demand.Status
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"डिमान्ड वसुली नोंदवताना त्रुटी: {ex.Message}");
            }
        }
    }

    public class ProcessRecoveryDto
    {
        public int DemandNoticeId { get; set; }
        public DateTime RecoveryDate { get; set; }
        public decimal TotalReceivedAmount { get; set; }
        public string? PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public string? Remarks { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DemandRecoveriesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IBusinessDateGuardService? _businessDateGuard;

        public DemandRecoveriesController(AppDbContext context, IBusinessDateGuardService? businessDateGuard = null)
        {
            _context = context;
            _businessDateGuard = businessDateGuard;
        }

        // GET: api/DemandRecoveries
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetDemandRecoveries()
        {
            var recoveries = await _context.DemandRecoveries
                .AsNoTracking()
                .Include(d => d.Voucher)
                .Include(d => d.DemandNotice)
                    .ThenInclude(dn => dn!.Employer)
                .Include(d => d.DemandNotice)
                    .ThenInclude(dn => dn!.Branch)
                .OrderByDescending(d => d.RecoveryDate)
                .ThenByDescending(d => d.DemandRecoveryId)
                .ToListAsync();

            return Ok(recoveries.Select(r => new
            {
                r.DemandRecoveryId,
                r.DemandNoticeId,
                NoticeNumber = r.DemandNotice?.NoticeNumber ?? "",
                EmployerName = r.DemandNotice?.Employer?.Name ?? "",
                BranchName = r.DemandNotice?.Branch?.BranchName ?? "",
                Month = r.DemandNotice?.Month ?? 0,
                Year = r.DemandNotice?.Year ?? 0,
                r.BranchId,
                r.RecoveryDate,
                r.TotalReceivedAmount,
                r.PaymentMode,
                r.ReferenceNo,
                r.BatchReference,
                r.RecoveredMemberCount,
                r.VoucherId,
                VoucherNo = r.Voucher?.VoucherNo ?? "",
                VoucherStatus = r.Voucher?.Status ?? "",
                r.Remarks,
                r.CreatedDate
            }));
        }

        // GET: api/DemandRecoveries/allocation-receipt/5
        [HttpGet("allocation-receipt/{recoveryId}")]
        public async Task<ActionResult<object>> GetAllocationReceipt(int recoveryId)
        {
            var recovery = await _context.DemandRecoveries
                .AsNoTracking()
                .Include(r => r.Voucher)
                .Include(r => r.DemandNotice)
                    .ThenInclude(dn => dn!.Employer)
                .Include(r => r.DemandNotice)
                    .ThenInclude(dn => dn!.Branch)
                .Include(r => r.Allocations)
                    .ThenInclude(a => a.DemandMemberDetail)
                .Include(r => r.Allocations)
                    .ThenInclude(a => a.DemandMemberColumnItem)
                .FirstOrDefaultAsync(r => r.DemandRecoveryId == recoveryId);

            if (recovery == null)
            {
                return NotFound("डिमान्ड वसुली पावती आढळली नाही.");
            }

            var memberGroups = recovery.Allocations
                .GroupBy(a => a.DemandMemberDetailId)
                .Select(g =>
                {
                    var md = g.First().DemandMemberDetail;
                    var itemRows = g.OrderBy(x => x.DemandMemberColumnItem?.SequenceOrder ?? 999)
                        .ThenBy(x => x.DemandMemberColumnItem?.SubRowIndex ?? 0)
                        .Select(x => new
                        {
                            x.DemandRecoveryAllocationId,
                            SequenceOrder = x.DemandMemberColumnItem?.SequenceOrder ?? 0,
                            SubRowIndex = x.DemandMemberColumnItem?.SubRowIndex ?? 0,
                            ItemType = x.DemandMemberColumnItem?.ItemType ?? "",
                            ColumnHeaderMr = x.DemandMemberColumnItem?.ColumnHeaderMr ?? "",
                            DisplaySubLabel = x.DemandMemberColumnItem?.DisplaySubLabel,
                            x.AllocatedPrincipalOrDeposit,
                            x.AllocatedInterest,
                            x.AllocatedPenalInterest,
                            x.TotalAllocated
                        })
                        .ToList();

                    return new
                    {
                        DemandMemberDetailId = g.Key,
                        EmpCode = md?.EmpCode ?? "",
                        CIFNo = md?.CIFNo ?? "",
                        MemberName = md?.MemberName ?? "",
                        TotalAllocated = Math.Round(itemRows.Sum(x => x.TotalAllocated), 2, MidpointRounding.AwayFromZero),
                        Items = itemRows
                    };
                })
                .OrderBy(m => int.TryParse(m.EmpCode, out int n) ? n : int.MaxValue)
                .ThenBy(m => m.EmpCode)
                .ToList();

            return Ok(new
            {
                recovery = new
                {
                    recovery.DemandRecoveryId,
                    recovery.DemandNoticeId,
                    NoticeNumber = recovery.DemandNotice?.NoticeNumber ?? "",
                    EmployerName = recovery.DemandNotice?.Employer?.Name ?? "",
                    BranchName = recovery.DemandNotice?.Branch?.BranchName ?? "",
                    recovery.RecoveryDate,
                    recovery.TotalReceivedAmount,
                    recovery.PaymentMode,
                    recovery.ReferenceNo,
                    recovery.BatchReference,
                    recovery.RecoveredMemberCount,
                    VoucherNo = recovery.Voucher?.VoucherNo ?? "",
                    VoucherStatus = recovery.Voucher?.Status ?? "",
                    recovery.Remarks
                },
                memberGroups
            });
        }

        // POST: api/DemandRecoveries/preview-allocation
        [HttpPost("preview-allocation")]
        public async Task<ActionResult<object>> PreviewAllocation([FromBody] PreviewAllocationRequestDto request)
        {
            if (request == null || request.DemandNoticeId <= 0)
            {
                return BadRequest("कृपया वैध डिमान्ड नोटीस निवडा.");
            }

            var notice = await _context.DemandNotices
                .AsNoTracking()
                .Include(n => n.MemberDetails)
                    .ThenInclude(m => m.ColumnItems)
                .FirstOrDefaultAsync(n => n.DemandNoticeId == request.DemandNoticeId);

            if (notice == null)
            {
                return NotFound("डिमान्ड नोटीस आढळली नाही.");
            }

            var amountOverrides = (request.MemberAmounts ?? new List<BulkMemberRecoveryInputDto>())
                .ToDictionary(x => x.DemandMemberDetailId, x => x);

            var memberPreviews = new List<object>();

            foreach (var md in notice.MemberDetails.OrderBy(m => int.TryParse(m.EmpCode, out int n) ? n : int.MaxValue).ThenBy(m => m.EmpCode))
            {
                var orderedItems = md.ColumnItems
                    .OrderBy(c => c.SequenceOrder)
                    .ThenBy(c => c.SubRowIndex)
                    .ToList();

                decimal pendingTotal = orderedItems.Any()
                    ? Math.Max(0m, Math.Round(orderedItems.Sum(c =>
                        Math.Max(0m, c.DemandPrincipalOrDeposit - c.RecoveredPrincipalOrDeposit) +
                        Math.Max(0m, c.DemandInterest - c.RecoveredInterest - c.RecoveredPenalInterest)), 2, MidpointRounding.AwayFromZero))
                    : Math.Max(0m, Math.Round(md.TotalDeduction - md.RecoveredAmount, 2, MidpointRounding.AwayFromZero));

                decimal actualAmt = amountOverrides.TryGetValue(md.DemandMemberDetailId, out var ov)
                    ? (ov.IsSelected ? Math.Max(0m, Math.Round(ov.ActualReceivedAmount, 2, MidpointRounding.AwayFromZero)) : 0m)
                    : pendingTotal;

                decimal pool = actualAmt;
                var itemAllocations = new List<object>();

                foreach (var ci in orderedItems)
                {
                    var (allocPen, allocInt, allocPrin) = ComputeColumnAllocation(ci, pool);
                    decimal totalCol = Math.Round(allocPen + allocInt + allocPrin, 2, MidpointRounding.AwayFromZero);
                    pool = Math.Max(0m, Math.Round(pool - totalCol, 2, MidpointRounding.AwayFromZero));

                    decimal colPending = Math.Max(0m, Math.Round(
                        (ci.DemandPrincipalOrDeposit - ci.RecoveredPrincipalOrDeposit) +
                        (ci.DemandInterest - ci.RecoveredInterest - ci.RecoveredPenalInterest), 2, MidpointRounding.AwayFromZero));

                    itemAllocations.Add(new
                    {
                        ci.DemandMemberColumnItemId,
                        ci.SequenceOrder,
                        ci.SubRowIndex,
                        ci.ItemType,
                        ci.ColumnHeaderMr,
                        ci.DisplaySubLabel,
                        PendingAmount = colPending,
                        AllocatedPrincipalOrDeposit = allocPrin,
                        AllocatedInterest = Math.Round(allocInt + allocPen, 2, MidpointRounding.AwayFromZero),
                        TotalAllocated = totalCol,
                        RemainingAfter = Math.Max(0m, Math.Round(colPending - totalCol, 2, MidpointRounding.AwayFromZero))
                    });
                }

                memberPreviews.Add(new
                {
                    md.DemandMemberDetailId,
                    md.EmpCode,
                    md.CIFNo,
                    md.MemberName,
                    PendingAmount = pendingTotal,
                    ActualReceivedAmount = actualAmt,
                    UnallocatedExcess = pool,
                    Items = itemAllocations
                });
            }

            return Ok(new { notice.DemandNoticeId, notice.NoticeNumber, members = memberPreviews });
        }

        // POST: api/DemandRecoveries/validate-bulk
        [HttpPost("validate-bulk")]
        public async Task<ActionResult<object>> ValidateBulkRecovery([FromBody] BulkDemandRecoveryRequestDto request)
        {
            var errors = new List<string>();
            var warnings = new List<string>();

            if (request == null || request.Notices == null || !request.Notices.Any())
            {
                errors.Add("कृपया किमान एक डिमान्ड नोटीस निवडा.");
                return Ok(new { isValid = false, errors, warnings });
            }

            DateTime recDate = request.RecoveryDate.Date;
            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.IsClosed && recDate >= f.StartDate.Date && recDate <= f.EndDate.Date);
            if (closedFy != null)
            {
                errors.Add($"दिनांक {recDate:dd/MM/yyyy} ही तारीख बंद केलेल्या आर्थिक वर्षात ({closedFy.YearCode}) येत असल्याने वसुली नोंदवता येत नाही.");
            }

            string mode = string.IsNullOrWhiteSpace(request.PaymentMode) ? "Bank" : request.PaymentMode.Trim();
            bool isBankMode = BankLedgerHelper.IsBankPaymentMode(mode);

            if (isBankMode)
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerID);
                if (!bankCheck.IsValid) errors.Add(bankCheck.ErrorMessage ?? "कृपया वैध बँक खाते निवडा.");
            }
            else if (!string.Equals(mode, "Cash", StringComparison.OrdinalIgnoreCase))
            {
                errors.Add($"अवैध पेमेंट पद्धत '{mode}'. कृपया Bank किंवा Cash निवडा.");
            }

            decimal totalGrandReceived = 0m;
            var noticeIds = request.Notices.Select(n => n.DemandNoticeId).Distinct().ToList();
            var notices = await _context.DemandNotices
                .AsNoTracking()
                .Include(n => n.Employer)
                .Include(n => n.MemberDetails)
                    .ThenInclude(m => m.ColumnItems)
                .Where(n => noticeIds.Contains(n.DemandNoticeId))
                .ToDictionaryAsync(n => n.DemandNoticeId);

            foreach (var nInput in request.Notices)
            {
                if (!notices.TryGetValue(nInput.DemandNoticeId, out var notice))
                {
                    errors.Add($"डिमान्ड नोटीस ID {nInput.DemandNoticeId} आढळली नाही.");
                    continue;
                }

                if (notice.Status == "Cancelled")
                {
                    errors.Add($"नोटीस क्र. {notice.NoticeNumber} रद्द (Cancelled) केलेली आहे.");
                    continue;
                }

                if (_businessDateGuard != null)
                {
                    var dateRes = await _businessDateGuard.ValidateCollectionDateAsync(notice.BranchId > 0 ? notice.BranchId : 1, recDate, isOfflineSync: false);
                    if (!dateRes.IsAllowed && !string.IsNullOrWhiteSpace(dateRes.ErrorMessage))
                    {
                        errors.Add($"{notice.NoticeNumber}: {dateRes.ErrorMessage}");
                    }
                }

                if (!isBankMode)
                {
                    int cashId = await CashLedgerHelper.GetCashLedgerIdAsync(_context, notice.BranchId > 0 ? notice.BranchId : 1, "DEMAND");
                    if (cashId <= 0)
                    {
                        errors.Add($"शाखा #{notice.BranchId} साठी रोख शिल्लक लेजर सापडले नाही.");
                    }
                }

                var pendingVouchers = await _context.DemandRecoveries
                    .AsNoTracking()
                    .Include(r => r.Voucher)
                    .Where(r => r.DemandNoticeId == notice.DemandNoticeId &&
                                r.Voucher != null &&
                                r.Voucher.Status == "Pending")
                    .Select(r => r.Voucher!.VoucherNo)
                    .ToListAsync();

                if (pendingVouchers.Any())
                {
                    errors.Add($"नोटीस क्र. {notice.NoticeNumber} साठी आधीचे वसुली व्हाउचर ({string.Join(", ", pendingVouchers)}) अद्याप पासिंगसाठी प्रलंबित आहे. कृपया प्रथम ते पास किंवा रद्द करा.");
                }

                var selectedMembers = (nInput.Members ?? new List<BulkMemberRecoveryInputDto>())
                    .Where(m => m.IsSelected && m.ActualReceivedAmount > 0m)
                    .ToList();

                if (!selectedMembers.Any())
                {
                    warnings.Add($"नोटीस क्र. {notice.NoticeNumber} मध्ये कोणताही प्रलंबित सभासद रकमेसह निवडलेला नाही.");
                    continue;
                }

                foreach (var memIn in selectedMembers)
                {
                    var detail = notice.MemberDetails.FirstOrDefault(md => md.DemandMemberDetailId == memIn.DemandMemberDetailId);
                    if (detail == null)
                    {
                        errors.Add($"नोटीस {notice.NoticeNumber}: सभासद ओळ ID {memIn.DemandMemberDetailId} आढळली नाही.");
                        continue;
                    }

                    decimal memPending = detail.ColumnItems.Any()
                        ? Math.Max(0m, Math.Round(detail.ColumnItems.Sum(c =>
                            Math.Max(0m, c.DemandPrincipalOrDeposit - c.RecoveredPrincipalOrDeposit) +
                            Math.Max(0m, c.DemandInterest - c.RecoveredInterest - c.RecoveredPenalInterest)), 2, MidpointRounding.AwayFromZero))
                        : Math.Max(0m, Math.Round(detail.TotalDeduction - detail.RecoveredAmount, 2, MidpointRounding.AwayFromZero));

                    if (memIn.ActualReceivedAmount > memPending + 0.01m)
                    {
                        errors.Add($"{detail.MemberName} (Emp {detail.EmpCode}): प्राप्त रक्कम ₹{memIn.ActualReceivedAmount:N2} ही शिल्लक डिमान्डपेक्षा (₹{memPending:N2}) जास्त आहे.");
                    }

                    // Check sub-account existence warnings for Thrift Saving if autoCreate = false
                    decimal simPool = memIn.ActualReceivedAmount;
                    foreach (var ci in detail.ColumnItems.OrderBy(c => c.SequenceOrder).ThenBy(c => c.SubRowIndex))
                    {
                        var (aPen, aInt, aPrin) = ComputeColumnAllocation(ci, simPool);
                        decimal alloc = aPen + aInt + aPrin;
                        if (alloc <= 0m) continue;
                        simPool = Math.Max(0m, simPool - alloc);

                        if (!ci.PrincipalOrDepositLedgerID.HasValue || ci.PrincipalOrDepositLedgerID.Value <= 0)
                        {
                            errors.Add($"{detail.MemberName}: '{ci.ColumnHeaderMr}' साठी Credit लेजर मॅपिंग अपूर्ण आहे.");
                        }

                        if (ci.ItemType == "THRIFT_SAVING" && (!ci.AccountId.HasValue || ci.AccountId.Value <= 0) && !request.AutoCreateMissingThriftAccount)
                        {
                            errors.Add($"{detail.MemberName} (Emp {detail.EmpCode}): '{ci.ColumnHeaderMr}' खाते उघडलेले नाही.");
                        }
                        else if (ci.ItemType == "THRIFT_SAVING" && (!ci.AccountId.HasValue || ci.AccountId.Value <= 0))
                        {
                            warnings.Add($"{detail.MemberName} (Emp {detail.EmpCode}): '{ci.ColumnHeaderMr}' नवीन बचत खाते वसुलीवेळी आपोआप उघडले जाईल.");
                        }
                        else if (ci.ItemType == "PIGMY" && (!ci.AccountId.HasValue || ci.AccountId.Value <= 0))
                        {
                            errors.Add($"{detail.MemberName} (Emp {detail.EmpCode}): '{ci.ColumnHeaderMr}' साठी सक्रिय पिग्मी खाते आढळले नाही.");
                        }
                        else if (ci.ItemType == "SHARE" && (!ci.AccountId.HasValue || ci.AccountId.Value <= 0))
                        {
                            errors.Add($"{detail.MemberName} (Emp {detail.EmpCode}): '{ci.ColumnHeaderMr}' साठी सक्रिय शेअर्स खाते आढळले नाही.");
                        }
                    }

                    totalGrandReceived += memIn.ActualReceivedAmount;
                }
            }

            if (totalGrandReceived <= 0m)
            {
                errors.Add("एकूण प्राप्त वसुली रक्कम ₹0 पेक्षा जास्त असणे आवश्यक आहे.");
            }

            return Ok(new
            {
                isValid = !errors.Any(),
                totalGrandReceived = Math.Round(totalGrandReceived, 2, MidpointRounding.AwayFromZero),
                errors = errors.Distinct().ToList(),
                warnings = warnings.Distinct().ToList()
            });
        }

        // POST: api/DemandRecoveries/process-bulk
        [HttpPost("process-bulk")]
        public async Task<ActionResult<object>> ProcessBulkRecovery([FromBody] BulkDemandRecoveryRequestDto request)
        {
            if (request == null || request.Notices == null || !request.Notices.Any())
            {
                return BadRequest("कृपया वसुलीसाठी किमान एक डिमान्ड नोटीस निवडा.");
            }

            if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
            {
                var existingRecs = await _context.DemandRecoveries
                    .AsNoTracking()
                    .Include(r => r.Voucher)
                    .Where(r => r.IdempotencyKey == request.IdempotencyKey ||
                                (r.IdempotencyKey != null && r.IdempotencyKey.StartsWith(request.IdempotencyKey + ":")))
                    .ToListAsync();

                if (existingRecs.Any())
                {
                    return Ok(new
                    {
                        isDuplicateReplay = true,
                        message = $"ही बल्क वसुली आधीच नोंदवली गेली आहे (व्हाउचर: {string.Join(", ", existingRecs.Select(x => x.Voucher?.VoucherNo).Where(s => !string.IsNullOrWhiteSpace(s)).Distinct())}).",
                        recoveries = existingRecs.Select(r => new
                        {
                            r.DemandRecoveryId,
                            r.DemandNoticeId,
                            r.TotalReceivedAmount,
                            r.VoucherId,
                            voucherNo = r.Voucher?.VoucherNo ?? ""
                        })
                    });
                }
            }

            DateTime recoveryDate = request.RecoveryDate.Date;
            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(f => f.IsClosed && recoveryDate >= f.StartDate.Date && recoveryDate <= f.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest($"दिनांक {recoveryDate:dd/MM/yyyy} ही तारीख बंद केलेल्या आर्थिक वर्षात ({closedFy.YearCode}) येत असल्याने वसुली करता येत नाही.");
            }

            string mode = string.IsNullOrWhiteSpace(request.PaymentMode) ? "Bank" : request.PaymentMode.Trim();
            bool isBankMode = BankLedgerHelper.IsBankPaymentMode(mode);

            int? validatedBankLedgerId = null;
            if (isBankMode)
            {
                var bankCheck = await BankLedgerHelper.ValidateBankLedgerAsync(_context, request.BankLedgerID);
                if (!bankCheck.IsValid)
                {
                    return BadRequest(bankCheck.ErrorMessage);
                }
                validatedBankLedgerId = bankCheck.LedgerId;
            }
            else if (!string.Equals(mode, "Cash", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest($"अवैध पेमेंट पद्धत: {mode}. कृपया 'Bank' किंवा 'Cash' निवडा.");
            }

            var noticeIds = request.Notices.Select(n => n.DemandNoticeId).Distinct().ToList();
            var notices = await _context.DemandNotices
                .Include(n => n.Employer)
                .Include(n => n.MemberDetails)
                    .ThenInclude(md => md.Member)
                        .ThenInclude(m => m!.Customer)
                .Include(n => n.MemberDetails)
                    .ThenInclude(md => md.ColumnItems)
                .Where(n => noticeIds.Contains(n.DemandNoticeId))
                .ToListAsync();

            if (notices.Count != noticeIds.Count)
            {
                return NotFound("निवडलेल्या डिमान्ड नोटीसपैकी एक किंवा अधिक नोटीस सिस्टममध्ये आढळल्या नाहीत.");
            }

            foreach (var n in notices)
            {
                if (n.Status == "Cancelled" || n.Status == "Received")
                {
                    return BadRequest($"नोटीस क्र. {n.NoticeNumber} ची स्थिती '{n.Status}' असल्यामुळे वसुली करता येत नाही.");
                }

                if (_businessDateGuard != null)
                {
                    var dateCheck = await _businessDateGuard.ValidateCollectionDateAsync(n.BranchId > 0 ? n.BranchId : 1, recoveryDate, isOfflineSync: false);
                    if (!dateCheck.IsAllowed)
                    {
                        return BadRequest(dateCheck.ErrorMessage ?? "निवडलेली तारीख शाखेच्या चालू Business Date शी जुळत नाही.");
                    }
                }

                var pendingVchs = await _context.DemandRecoveries
                    .AsNoTracking()
                    .Include(r => r.Voucher)
                    .Where(r => r.DemandNoticeId == n.DemandNoticeId &&
                                r.Voucher != null &&
                                r.Voucher.Status == "Pending")
                    .Select(r => r.Voucher!.VoucherNo)
                    .ToListAsync();

                if (pendingVchs.Any())
                {
                    return BadRequest($"नोटीस क्र. {n.NoticeNumber} वर आधीचे वसुली व्हाउचर ({string.Join(", ", pendingVchs)}) अद्याप पासिंगसाठी प्रलंबित आहे. कृपया प्रथम ते पास किंवा रद्द करा.");
                }
            }

            var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            int fyId = activeFy?.FinancialYearID ?? 1;
            int createdByUserId = User?.GetUserId() is int uid && uid > 0 ? uid : 1;

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                string batchRef = !string.IsNullOrWhiteSpace(request.BatchReference)
                    ? request.BatchReference.Trim()
                    : $"BULK-{recoveryDate:yyyyMMdd}-{DateTime.UtcNow:HHmmss}";
                string refSuffix = !string.IsNullOrWhiteSpace(request.ReferenceNo)
                    ? $" [संदर्भ: {request.ReferenceNo.Trim()}]"
                    : "";

                var noticeGroupsByBranch = request.Notices
                    .Select(ni => new { Input = ni, Notice = notices.First(x => x.DemandNoticeId == ni.DemandNoticeId) })
                    .GroupBy(x => x.Notice.BranchId > 0 ? x.Notice.BranchId : 1)
                    .ToList();

                var createdRecoveries = new List<object>();

                foreach (var branchGroup in noticeGroupsByBranch)
                {
                    int branchId = branchGroup.Key;
                    int debitLedgerId;
                    if (isBankMode)
                    {
                        debitLedgerId = validatedBankLedgerId!.Value;
                    }
                    else
                    {
                        debitLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "DEMAND");
                        if (debitLedgerId <= 0)
                        {
                            await transaction.RollbackAsync();
                            return BadRequest($"शाखा #{branchId} साठी रोख शिल्लक लेजर सापडले नाही.");
                        }
                    }

                    decimal branchVoucherTotal = Math.Round(
                        branchGroup.Sum(g => (g.Input.Members ?? new List<BulkMemberRecoveryInputDto>())
                            .Where(m => m.IsSelected && m.ActualReceivedAmount > 0m)
                            .Sum(m => Math.Round(m.ActualReceivedAmount, 2, MidpointRounding.AwayFromZero))),
                        2, MidpointRounding.AwayFromZero);

                    if (branchVoucherTotal <= 0m) continue;

                    string noticeNumbersCsv = string.Join(", ", branchGroup.Select(g => g.Notice.NoticeNumber).Distinct());
                    string employerNamesCsv = string.Join(", ", branchGroup.Select(g => g.Notice.Employer?.Name ?? "संस्था").Distinct());
                    string vchNo = await VoucherNumberHelper.NextVoucherNoAsync(_context, $"VCH-DMD-{recoveryDate:yyyyMMdd}-", 4);

                    var voucher = new Voucher
                    {
                        BranchID = branchId,
                        VoucherNo = vchNo,
                        VoucherDate = recoveryDate,
                        VoucherType = "Receipt",
                        Status = "Pending",
                        TotalAmount = branchVoucherTotal,
                        Narration = $"बल्क पगार डिमान्ड वसुली - नोटीस {noticeNumbersCsv} ({employerNamesCsv}){refSuffix}",
                        CreatedBy = createdByUserId,
                        CreatedOn = DateTime.UtcNow
                    };
                    _context.Vouchers.Add(voucher);
                    await _context.SaveChangesAsync();

                    _context.VoucherDetails.Add(new VoucherDetail
                    {
                        VoucherID = voucher.VoucherID,
                        LedgerID = debitLedgerId,
                        DrCr = "Dr",
                        Amount = branchVoucherTotal
                    });

                    // Aggregate Credits by LedgerID so 500-employee payroll stays clean & fast in Voucher Passing;
                    // DEPOSIT_LEDGER preserves per-customer lines (with CustomerID/MemberID) for customer sub-ledger continuity.
                    var creditByLedger = new Dictionary<int, decimal>();
                    var customerCreditVoucherLines = new List<(int LedgerId, int? CustomerId, int? MemberId, decimal Amount)>();
                    void AddCreditLedger(int ledgerId, decimal amt)
                    {
                        if (amt <= 0m) return;
                        creditByLedger[ledgerId] = Math.Round((creditByLedger.TryGetValue(ledgerId, out decimal cur) ? cur : 0m) + amt, 2, MidpointRounding.AwayFromZero);
                    }

                    int noticeSeq = 0;
                    foreach (var g in branchGroup)
                    {
                        noticeSeq++;
                        var notice = g.Notice;
                        var selectedMembers = (g.Input.Members ?? new List<BulkMemberRecoveryInputDto>())
                            .Where(m => m.IsSelected && m.ActualReceivedAmount > 0m)
                            .ToList();

                        if (!selectedMembers.Any()) continue;

                        decimal noticeRecoveryTotal = Math.Round(selectedMembers.Sum(m => Math.Round(m.ActualReceivedAmount, 2, MidpointRounding.AwayFromZero)), 2, MidpointRounding.AwayFromZero);

                        var recovery = new DemandRecovery
                        {
                            DemandNoticeId = notice.DemandNoticeId,
                            BranchId = branchId,
                            RecoveryDate = recoveryDate,
                            TotalReceivedAmount = noticeRecoveryTotal,
                            PaymentMode = mode,
                            BankLedgerID = isBankMode ? debitLedgerId : null,
                            ReferenceNo = request.ReferenceNo?.Trim(),
                            BatchReference = batchRef,
                            IdempotencyKey = !string.IsNullOrWhiteSpace(request.IdempotencyKey)
                                ? (noticeIds.Count == 1 ? request.IdempotencyKey.Trim() : $"{request.IdempotencyKey.Trim()}:{notice.DemandNoticeId}")
                                : null,
                            RecoveredMemberCount = selectedMembers.Count,
                            VoucherId = voucher.VoucherID,
                            Remarks = !string.IsNullOrWhiteSpace(request.Remarks)
                                ? request.Remarks.Trim()
                                : $"[{mode}] बल्क डिमान्ड वसुली ({vchNo}){refSuffix}",
                            CreatedBy = createdByUserId,
                            CreatedDate = DateTime.UtcNow
                        };
                        _context.DemandRecoveries.Add(recovery);
                        await _context.SaveChangesAsync();

                        foreach (var memIn in selectedMembers)
                        {
                            var detail = notice.MemberDetails.FirstOrDefault(md => md.DemandMemberDetailId == memIn.DemandMemberDetailId);
                            if (detail == null)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest($"नोटीस {notice.NoticeNumber} मध्ये सभासद ओळ ID {memIn.DemandMemberDetailId} आढळली नाही.");
                            }

                            decimal memberPool = Math.Round(memIn.ActualReceivedAmount, 2, MidpointRounding.AwayFromZero);
                            Member? member = null;
                            if (detail.MemberId.HasValue && detail.MemberId.Value > 0)
                            {
                                member = detail.Member ?? await _context.Members
                                    .Include(m => m.Customer)
                                    .FirstOrDefaultAsync(m => m.MemberID == detail.MemberId.Value);
                            }

                            Customer? customer = member?.Customer;
                            if (customer == null && detail.CustomerId.HasValue && detail.CustomerId.Value > 0)
                            {
                                customer = await _context.Customers
                                    .FirstOrDefaultAsync(c => c.CustomerID == detail.CustomerId.Value);
                            }

                            if (member == null && customer == null)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest($"खातेदार / सभासद ID {detail.CustomerId ?? detail.MemberId} आढळला नाही.");
                            }

                            int custId = detail.CustomerId ?? member?.CustomerID ?? customer?.CustomerID ?? 0;
                            string memberName = !string.IsNullOrWhiteSpace(detail.MemberName)
                                ? detail.MemberName
                                : (customer?.FullName ?? $"Customer #{custId}");

                            var orderedItems = detail.ColumnItems
                                .OrderBy(c => c.SequenceOrder)
                                .ThenBy(c => c.SubRowIndex)
                                .ToList();

                            if (!orderedItems.Any())
                            {
                                await transaction.RollbackAsync();
                                return BadRequest($"{memberName}: डिमान्ड यादीत कॉलम-निहाय ब्रेकडाउन (ColumnItems) आढळले नाही. कृपया डिमांड फॉर्मवरून नोटीस पुन्हा जतन करा.");
                            }

                            foreach (var ci in orderedItems)
                            {
                                if (memberPool <= 0.009m) break;

                                var (allocPen, allocInt, allocPrin) = ComputeColumnAllocation(ci, memberPool);
                                decimal allocItemTotal = Math.Round(allocPen + allocInt + allocPrin, 2, MidpointRounding.AwayFromZero);
                                if (allocItemTotal <= 0m) continue;

                                var generatedSubIds = new List<int>();
                                string subType = ci.ItemType;

                                if (ci.ItemType == "LOAN")
                                {
                                    var loanIds = ParseCsvIds(ci.SourceAccountIdsCsv);
                                    var loanQuery = _context.LoanAccounts
                                        .Include(l => l.LoanRate)
                                        .Where(l => loanIds.Any()
                                            ? loanIds.Contains(l.LoanAccountID)
                                            : (((detail.MemberId.HasValue && l.MemberID == detail.MemberId.Value) || (custId > 0 && l.CustomerID == custId)) &&
                                               (!ci.SchemeId.HasValue || l.LoanRateID == ci.SchemeId.Value)));

                                    var memberLoans = await loanQuery
                                        .OrderBy(l => l.OpeningDate)
                                        .ThenBy(l => l.LoanAccountID)
                                        .ToListAsync();

                                    if (!memberLoans.Any())
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName}: '{ci.ColumnHeaderMr}' अंतर्गत सक्रिय कर्ज खाते आढळले नाही.");
                                    }

                                    decimal remPen = allocPen;
                                    decimal remInt = allocInt;
                                    decimal remPrin = allocPrin;

                                    decimal totalAvailPrin = memberLoans.Sum(l => Math.Max(0m, l.PrincipalBalance));
                                    if (remPrin > totalAvailPrin + 0.01m)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName} ({ci.ColumnHeaderMr}): वसूल मुद्दल ₹{remPrin:N2} ही शिल्लक कर्ज मुद्दलपेक्षा (₹{totalAvailPrin:N2}) जास्त आहे.");
                                    }

                                    // Load schedules & collections for accurate per-loan dues split when multi-loan exists
                                    var lIds = memberLoans.Select(l => l.LoanAccountID).ToList();
                                    var schByLoan = (await _context.LoanInstallmentSchedules
                                        .Where(s => lIds.Contains(s.LoanAccountID))
                                        .ToListAsync())
                                        .GroupBy(s => s.LoanAccountID)
                                        .ToDictionary(x => x.Key, x => x.ToList());
                                    var colByLoan = (await _context.LoanCollections
                                        .Where(c => lIds.Contains(c.LoanAccountID))
                                        .ToListAsync())
                                        .GroupBy(c => c.LoanAccountID)
                                        .ToDictionary(x => x.Key, x => x.ToList());

                                    for (int li = 0; li < memberLoans.Count; li++)
                                    {
                                        var loan = memberLoans[li];
                                        if (remPen <= 0m && remInt <= 0m && remPrin <= 0m) break;

                                        bool isLastLoan = (li == memberLoans.Count - 1);
                                        schByLoan.TryGetValue(loan.LoanAccountID, out var lSch);
                                        colByLoan.TryGetValue(loan.LoanAccountID, out var lCol);
                                        lSch ??= new List<LoanInstallmentSchedule>();
                                        lCol ??= new List<LoanCollection>();

                                        var snap = LegalRecoveryTrackerHelper.ComputeLoanDuesSnapshot(loan, lSch, lCol, notice.DemandDate.Date);

                                        decimal loanPenPaid = isLastLoan
                                            ? remPen
                                            : Math.Min(remPen, Math.Max(0m, snap.TotalPenalInterestDue));

                                        decimal loanIntPaid = isLastLoan
                                            ? remInt
                                            : Math.Min(remInt, Math.Max(0m, snap.TotalRegularInterestDue));

                                        decimal loanPrinCap = Math.Max(0m, loan.PrincipalBalance);
                                        decimal duePrinThis = !lSch.Any() && snap.OverduePrincipal <= 0m && loan.InstallmentAmount > 0m
                                            ? Math.Min(loanPrinCap, loan.InstallmentAmount)
                                            : snap.OverduePrincipal;
                                        decimal loanPrinPaid = isLastLoan
                                            ? Math.Min(remPrin, loanPrinCap)
                                            : Math.Min(remPrin, Math.Min(loanPrinCap, Math.Max(0m, duePrinThis)));

                                        // If last loan hit PrincipalBalance cap before absorbing remPrin, spill back? (totalAvailPrin check prevents excess overall, fill remaining loans first!)
                                        if (!isLastLoan && remPrin > loanPrinPaid && li < memberLoans.Count - 1 && loanPrinPaid < loanPrinCap)
                                        {
                                            // keep FIFO strict up to due first, extra goes on next pass or last loan
                                        }

                                        decimal loanTotalNow = Math.Round(loanPenPaid + loanIntPaid + loanPrinPaid, 2, MidpointRounding.AwayFromZero);
                                        if (loanTotalNow <= 0m) continue;

                                        int loanLedgerId = ci.PrincipalOrDepositLedgerID ?? loan.LoanRate?.LoanLedgerID ?? 0;
                                        int intLedgerId = ci.InterestLedgerID ?? loan.LoanRate?.InterestLedgerID ?? 0;
                                        int recIntLedgerId = (ci.ReceivableInterestLedgerID.HasValue && ci.ReceivableInterestLedgerID.Value > 0)
                                            ? ci.ReceivableInterestLedgerID.Value
                                            : ((loan.LoanRate?.ReceivableInterestLedgerID.HasValue == true && loan.LoanRate.ReceivableInterestLedgerID.Value > 0)
                                                ? loan.LoanRate.ReceivableInterestLedgerID.Value
                                                : intLedgerId);
                                        int ovdIntLedgerId = (ci.OverdueInterestLedgerID.HasValue && ci.OverdueInterestLedgerID.Value > 0)
                                            ? ci.OverdueInterestLedgerID.Value
                                            : ((loan.LoanRate?.OverdueInterestLedgerID.HasValue == true && loan.LoanRate.OverdueInterestLedgerID.Value > 0)
                                                ? loan.LoanRate.OverdueInterestLedgerID.Value
                                                : intLedgerId);

                                        if (loanPrinPaid > 0m && loanLedgerId <= 0)
                                        {
                                            await transaction.RollbackAsync();
                                            return BadRequest($"{ci.ColumnHeaderMr}: मुद्दल लेजर (Loan Principal Ledger) मॅप केलेले नाही.");
                                        }
                                        if (loanIntPaid > 0m && intLedgerId <= 0 && recIntLedgerId <= 0)
                                        {
                                            await transaction.RollbackAsync();
                                            return BadRequest($"{ci.ColumnHeaderMr}: कर्ज व्याज लेजर (Interest Ledger) मॅप केलेले नाही.");
                                        }
                                        if (loanPenPaid > 0m && ovdIntLedgerId <= 0)
                                        {
                                            await transaction.RollbackAsync();
                                            return BadRequest($"{ci.ColumnHeaderMr}: दंड/थकीत व्याज लेजर मॅप केलेले नाही.");
                                        }

                                        // Snapshot pre-recovery interest state for lossless VoucherReject rollback
                                        decimal origIntBal = loan.InterestBalance;
                                        string origIntDtToken = loan.LastInterestPostingDate.HasValue
                                            ? loan.LastInterestPostingDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                                            : "NULL";

                                        decimal penFromBal = Math.Min(loanPenPaid, loan.OverdueInterestBalance);
                                        loan.OverdueInterestBalance = Math.Max(0m, Math.Round(loan.OverdueInterestBalance - penFromBal, 2, MidpointRounding.AwayFromZero));

                                        decimal recIntPaid = Math.Min(loanIntPaid, Math.Max(0m, loan.InterestBalance));
                                        decimal freshIntPaid = Math.Round(loanIntPaid - recIntPaid, 2, MidpointRounding.AwayFromZero);
                                        loan.InterestBalance = Math.Max(0m, Math.Round(loan.InterestBalance - recIntPaid, 2, MidpointRounding.AwayFromZero));

                                        loan.PrincipalBalance = Math.Max(0m, Math.Round(loan.PrincipalBalance - loanPrinPaid, 2, MidpointRounding.AwayFromZero));
                                        loan.PurePrincipalBalance = Math.Max(0m, Math.Round(loan.PurePrincipalBalance - Math.Min(loan.PurePrincipalBalance, loanPrinPaid), 2, MidpointRounding.AwayFromZero));
                                        loan.LastInstallmentPaidDate = recoveryDate;
                                        if (loanIntPaid > 0m)
                                        {
                                            loan.LastInterestPostingDate = recoveryDate;
                                        }

                                        if (loan.PrincipalBalance <= 0m && loan.InterestBalance <= 0m && loan.OverdueInterestBalance <= 0m)
                                        {
                                            loan.Status = "Closed";
                                        }

                                        string snapRemarks = $"बल्क डिमान्ड वसुली - नोटीस {notice.NoticeNumber} [PreIntBal:{origIntBal.ToString("0.##", CultureInfo.InvariantCulture)}|PreIntDt:{origIntDtToken}]";

                                        var lc = new LoanCollection
                                        {
                                            LoanAccountID = loan.LoanAccountID,
                                            BranchID = branchId,
                                            CollectingCashierID = createdByUserId,
                                            CreatedByUserID = createdByUserId,
                                            CollectionDate = recoveryDate,
                                            ReceiptNo = vchNo,
                                            TotalAmountReceived = loanTotalNow,
                                            PenaltyInterestCollected = loanPenPaid,
                                            ReceivableInterestCollected = recIntPaid,
                                            InterestCollected = freshIntPaid,
                                            PrincipalCollected = loanPrinPaid,
                                            PaymentMode = isBankMode ? "Bank" : "Cash",
                                            BankAccountLedgerID = isBankMode ? debitLedgerId : null,
                                            ChequeNo = request.ReferenceNo,
                                            VoucherID = voucher.VoucherID,
                                            Remarks = snapRemarks
                                        };
                                        _context.LoanCollections.Add(lc);
                                        await _context.SaveChangesAsync();
                                        generatedSubIds.Add(lc.LoanCollectionID);

                                        if (lSch.Any())
                                        {
                                            lCol.Add(lc);
                                            LoanScheduleGenerator.SynchronizeSchedules(loan, lSch, lCol);
                                            foreach (var sRow in lSch) _context.Entry(sRow).State = EntityState.Modified;
                                        }

                                        AddCreditLedger(loanLedgerId, loanPrinPaid);
                                        AddCreditLedger(recIntLedgerId > 0 ? recIntLedgerId : intLedgerId, recIntPaid);
                                        AddCreditLedger(intLedgerId > 0 ? intLedgerId : recIntLedgerId, freshIntPaid);
                                        AddCreditLedger(ovdIntLedgerId, loanPenPaid);

                                        remPen = Math.Max(0m, Math.Round(remPen - loanPenPaid, 2, MidpointRounding.AwayFromZero));
                                        remInt = Math.Max(0m, Math.Round(remInt - loanIntPaid, 2, MidpointRounding.AwayFromZero));
                                        remPrin = Math.Max(0m, Math.Round(remPrin - loanPrinPaid, 2, MidpointRounding.AwayFromZero));
                                    }

                                    // Edge-case pass if multiple loans exist & remaining principal sits on another loan's unused balance
                                    if (remPrin > 0.009m)
                                    {
                                        foreach (var loan in memberLoans.Where(l => l.PrincipalBalance > 0.009m))
                                        {
                                            if (remPrin <= 0.009m) break;
                                            decimal extraPrin = Math.Min(remPrin, loan.PrincipalBalance);
                                            int loanLedgerId = ci.PrincipalOrDepositLedgerID ?? loan.LoanRate?.LoanLedgerID ?? 0;
                                            loan.PrincipalBalance = Math.Max(0m, Math.Round(loan.PrincipalBalance - extraPrin, 2, MidpointRounding.AwayFromZero));
                                            loan.PurePrincipalBalance = Math.Max(0m, Math.Round(loan.PurePrincipalBalance - Math.Min(loan.PurePrincipalBalance, extraPrin), 2, MidpointRounding.AwayFromZero));
                                            loan.LastInstallmentPaidDate = recoveryDate;
                                            if (loan.PrincipalBalance <= 0m && loan.InterestBalance <= 0m && loan.OverdueInterestBalance <= 0m) loan.Status = "Closed";

                                            var extraLc = new LoanCollection
                                            {
                                                LoanAccountID = loan.LoanAccountID,
                                                BranchID = branchId,
                                                CollectingCashierID = createdByUserId,
                                                CreatedByUserID = createdByUserId,
                                                CollectionDate = recoveryDate,
                                                ReceiptNo = vchNo,
                                                TotalAmountReceived = extraPrin,
                                                PrincipalCollected = extraPrin,
                                                PaymentMode = isBankMode ? "Bank" : "Cash",
                                                BankAccountLedgerID = isBankMode ? debitLedgerId : null,
                                                ChequeNo = request.ReferenceNo,
                                                VoucherID = voucher.VoucherID,
                                                Remarks = $"बल्क डिमान्ड वसुली (अतिरिक्त मुद्दल) - नोटीस {notice.NoticeNumber}"
                                            };
                                            _context.LoanCollections.Add(extraLc);
                                            await _context.SaveChangesAsync();
                                            generatedSubIds.Add(extraLc.LoanCollectionID);

                                            schByLoan.TryGetValue(loan.LoanAccountID, out var lSch2);
                                            if (lSch2 != null && lSch2.Any())
                                            {
                                                colByLoan.TryGetValue(loan.LoanAccountID, out var lCol2);
                                                lCol2 ??= new List<LoanCollection>();
                                                lCol2.Add(extraLc);
                                                LoanScheduleGenerator.SynchronizeSchedules(loan, lSch2, lCol2);
                                                foreach (var sRow in lSch2) _context.Entry(sRow).State = EntityState.Modified;
                                            }
                                            AddCreditLedger(loanLedgerId, extraPrin);
                                            remPrin = Math.Max(0m, Math.Round(remPrin - extraPrin, 2, MidpointRounding.AwayFromZero));
                                        }
                                    }

                                    if (remPen > 0.01m || remInt > 0.01m || remPrin > 0.01m)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName} ({ci.ColumnHeaderMr}): ₹{(remPen + remInt + remPrin):N2} रक्कम कोणत्याही सक्रिय कर्जात वर्ग होऊ शकली नाही.");
                                    }
                                }
                                else if (ci.ItemType == "THRIFT_SAVING")
                                {
                                    subType = "SAVING";
                                    var (savAcc, savLiabId, err) = await DemandPayrollHelper.ResolveOrProvisionThriftSavingAccountAsync(
                                        _context,
                                        branchId,
                                        custId,
                                        ci.SchemeId,
                                        ci.PrincipalOrDepositLedgerID,
                                        recoveryDate,
                                        request.AutoCreateMissingThriftAccount);

                                    if (savAcc == null || !string.IsNullOrEmpty(err))
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName} (Emp {detail.EmpCode}): {err}");
                                    }

                                    ci.AccountId ??= savAcc.SavingAccountID;
                                    savAcc.CurrentBalance = Math.Round(savAcc.CurrentBalance + allocPrin, 2, MidpointRounding.AwayFromZero);

                                    var savTxn = new SavingTransaction
                                    {
                                        SavingAccountID = savAcc.SavingAccountID,
                                        CustomerID = savAcc.CustomerID,
                                        BranchID = branchId,
                                        TransactionDate = recoveryDate,
                                        TransactionType = "Deposit",
                                        PaymentMode = isBankMode ? "Bank" : "Cash",
                                        Amount = allocPrin,
                                        BalanceAfterTxn = savAcc.CurrentBalance,
                                        VoucherNo = vchNo,
                                        VoucherID = voucher.VoucherID,
                                        Narration = $"बल्क पगार डिमान्ड ({ci.ColumnHeaderMr}) - नोटीस {notice.NoticeNumber}",
                                        CreatedBy = createdByUserId,
                                        CreatedOn = DateTime.UtcNow
                                    };
                                    _context.SavingTransactions.Add(savTxn);
                                    await _context.SaveChangesAsync();
                                    generatedSubIds.Add(savTxn.TransactionID);
                                    AddCreditLedger(savLiabId, allocPrin);
                                }
                                else if (ci.ItemType == "RD")
                                {
                                    subType = "RD";
                                    RdAccount? rdAcc = ci.AccountId.HasValue && ci.AccountId.Value > 0
                                        ? await _context.RdAccounts.Include(r => r.RdScheme).FirstOrDefaultAsync(r => r.RdAccountID == ci.AccountId.Value)
                                        : await _context.RdAccounts.Include(r => r.RdScheme).FirstOrDefaultAsync(r => r.CustomerID == custId && (!ci.SchemeId.HasValue || r.RdSchemeID == ci.SchemeId.Value) && r.Status == "Active");

                                    if (rdAcc == null)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName} (Emp {detail.EmpCode}): '{ci.ColumnHeaderMr}' साठी सक्रिय RD खाते आढळले नाही.");
                                    }

                                    int rdLiabLedgerId = ci.PrincipalOrDepositLedgerID ?? rdAcc.RdScheme?.RdLiabilityLedgerID ?? 0;
                                    if (rdLiabLedgerId <= 0)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"RD खाते #{rdAcc.AccountNo} योजनेला 'RD देयता लेजर' जोडलेले नाही.");
                                    }

                                    rdAcc.TotalDepositedAmount = Math.Round(rdAcc.TotalDepositedAmount + allocPrin, 2, MidpointRounding.AwayFromZero);
                                    int nextInstNo = rdAcc.TotalPaidInstallments + 1;

                                    var rdTxn = new RdTransaction
                                    {
                                        InstitutionID = rdAcc.InstitutionID,
                                        BranchID = branchId,
                                        FinancialYearID = fyId,
                                        RdAccountID = rdAcc.RdAccountID,
                                        VoucherID = voucher.VoucherID,
                                        TransactionDate = recoveryDate,
                                        TransactionType = "Installment",
                                        InstallmentNo = nextInstNo,
                                        DebitCredit = "Cr",
                                        PrincipalAmount = allocPrin,
                                        BalanceAfterTxn = rdAcc.TotalDepositedAmount,
                                        Narration = $"बल्क डिमान्ड RD हप्ता ({ci.DisplaySubLabel ?? rdAcc.AccountNo}) - नोटीस {notice.NoticeNumber}",
                                        CreatedBy = createdByUserId,
                                        CreatedDate = DateTime.UtcNow
                                    };
                                    _context.RdTransactions.Add(rdTxn);
                                    await _context.SaveChangesAsync();
                                    generatedSubIds.Add(rdTxn.RdTransactionID);

                                    await RdInstallmentCollectionRollbackHelper.ReconcileRdSchedulesWithDepositedAmountAsync(
                                        _context, rdAcc, fallbackPaidDate: recoveryDate);

                                    AddCreditLedger(rdLiabLedgerId, allocPrin);
                                }
                                else if (ci.ItemType == "SHARE")
                                {
                                    subType = "SHARE";
                                    var shareAcc = ci.AccountId.HasValue && ci.AccountId.Value > 0
                                        ? await _context.ShareAccounts.FirstOrDefaultAsync(s => s.ShareAccountId == ci.AccountId.Value)
                                        : await _context.ShareAccounts.FirstOrDefaultAsync(s =>
                                            ((member != null && s.MemberId == member.MemberID) || (custId > 0 && s.CustomerID == custId)) &&
                                            s.Status == "Active");

                                    if (shareAcc == null)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName} (Emp {detail.EmpCode}): '{ci.ColumnHeaderMr}' साठी सक्रिय शेअर्स खाते आढळले नाही.");
                                    }

                                    int shareLedgerId = ci.PrincipalOrDepositLedgerID ?? 0;
                                    if (shareLedgerId <= 0)
                                    {
                                        shareLedgerId = (await ShareLedgerHelper.GetShareCapitalLedgerAsync(_context, ci.SchemeId)).LedgerID;
                                    }

                                    var shScheme = ci.SchemeId.HasValue
                                        ? await _context.ShareSchemes.AsNoTracking().FirstOrDefaultAsync(s => s.ShareSchemeId == ci.SchemeId.Value)
                                        : await _context.ShareSchemes.AsNoTracking().OrderByDescending(s => s.IsActive).FirstOrDefaultAsync();

                                    decimal faceVal = (shScheme != null && shScheme.ShareFaceValue > 0m) ? shScheme.ShareFaceValue : 100m;
                                    int addedShares = (int)Math.Floor(allocPrin / faceVal);
                                    shareAcc.TotalShareAmount = Math.Round(shareAcc.TotalShareAmount + allocPrin, 2, MidpointRounding.AwayFromZero);
                                    shareAcc.TotalShareCount += addedShares;

                                    var shTx = new ShareTransaction
                                    {
                                        ShareAccountId = shareAcc.ShareAccountId,
                                        CustomerID = shareAcc.CustomerID,
                                        TransactionDate = recoveryDate,
                                        TransactionType = "Allotment",
                                        NumberOfShares = addedShares,
                                        Amount = allocPrin,
                                        Narration = $"बल्क डिमान्ड शेअर्स जमा - नोटीस {notice.NoticeNumber}",
                                        VoucherId = voucher.VoucherID
                                    };
                                    _context.ShareTransactions.Add(shTx);
                                    await _context.SaveChangesAsync();
                                    generatedSubIds.Add(shTx.TransactionId);

                                    AddCreditLedger(shareLedgerId, allocPrin);
                                }
                                else if (ci.ItemType == "PIGMY")
                                {
                                    subType = "PIGMY";
                                    var pgAcc = ci.AccountId.HasValue && ci.AccountId.Value > 0
                                        ? await _context.PigmyAccounts.Include(p => p.PigmyScheme).FirstOrDefaultAsync(p => p.PigmyAccountID == ci.AccountId.Value)
                                        : await _context.PigmyAccounts.Include(p => p.PigmyScheme).FirstOrDefaultAsync(p => p.CustomerID == custId && (!ci.SchemeId.HasValue || p.PigmySchemeID == ci.SchemeId.Value) && p.Status == "Active");

                                    if (pgAcc == null)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName} (Emp {detail.EmpCode}): '{ci.ColumnHeaderMr}' साठी सक्रिय पिग्मी खाते आढळले नाही.");
                                    }

                                    int pgLiabLedgerId = ci.PrincipalOrDepositLedgerID ?? pgAcc.PigmyScheme?.PigmyLiabilityLedgerID ?? 0;
                                    if (pgLiabLedgerId <= 0)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"पिग्मी खाते #{pgAcc.AccountNo} योजनेला 'पिग्मी देयता लेजर' जोडलेले नाही.");
                                    }

                                    pgAcc.TotalDepositedAmount = Math.Round(pgAcc.TotalDepositedAmount + allocPrin, 2, MidpointRounding.AwayFromZero);

                                    var pgTx = new PigmyTransaction
                                    {
                                        PigmyAccountID = pgAcc.PigmyAccountID,
                                        TransactionDate = recoveryDate,
                                        ValueDate = recoveryDate,
                                        TransactionType = "DEPOSIT",
                                        DrAmount = 0m,
                                        CrAmount = allocPrin,
                                        BalanceAmount = pgAcc.TotalDepositedAmount,
                                        Narration = $"बल्क डिमान्ड पिग्मी ठेव ({ci.ColumnHeaderMr}) - नोटीस {notice.NoticeNumber}",
                                        ReferenceId = vchNo,
                                        MakerId = createdByUserId,
                                        PostedOn = DateTime.UtcNow
                                    };
                                    _context.PigmyTransactions.Add(pgTx);
                                    await _context.SaveChangesAsync();
                                    generatedSubIds.Add(pgTx.PigmyTransactionID);
                                    AddCreditLedger(pgLiabLedgerId, allocPrin);
                                }
                                else if (ci.ItemType == "DEPOSIT_LEDGER")
                                {
                                    subType = "DEPOSIT_LEDGER";
                                    int depLedgerId = ci.PrincipalOrDepositLedgerID ?? 0;
                                    if (depLedgerId <= 0)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName} ({ci.ColumnHeaderMr}): ठेव जमा लेजर मॅप केलेले नाही.");
                                    }
                                    customerCreditVoucherLines.Add((depLedgerId, custId > 0 ? custId : (int?)null, member?.MemberID, allocPrin));
                                }
                                else // LEDGER_OTHER
                                {
                                    subType = "LEDGER_OTHER";
                                    int otherLedgerId = ci.PrincipalOrDepositLedgerID ?? 0;
                                    if (otherLedgerId <= 0)
                                    {
                                        await transaction.RollbackAsync();
                                        return BadRequest($"{memberName} ({ci.ColumnHeaderMr}): जमा लेजर मॅप केलेले नाही.");
                                    }
                                    AddCreditLedger(otherLedgerId, allocPrin);
                                }

                                ci.RecoveredPrincipalOrDeposit = Math.Round(ci.RecoveredPrincipalOrDeposit + allocPrin, 2, MidpointRounding.AwayFromZero);
                                ci.RecoveredInterest = Math.Round(ci.RecoveredInterest + allocInt, 2, MidpointRounding.AwayFromZero);
                                ci.RecoveredPenalInterest = Math.Round(ci.RecoveredPenalInterest + allocPen, 2, MidpointRounding.AwayFromZero);

                                _context.DemandRecoveryAllocations.Add(new DemandRecoveryAllocation
                                {
                                    DemandRecoveryId = recovery.DemandRecoveryId,
                                    DemandMemberDetailId = detail.DemandMemberDetailId,
                                    DemandMemberColumnItemId = ci.DemandMemberColumnItemId,
                                    AllocatedPrincipalOrDeposit = allocPrin,
                                    AllocatedInterest = allocInt,
                                    AllocatedPenalInterest = allocPen,
                                    TotalAllocated = allocItemTotal,
                                    GeneratedSubLedgerType = subType,
                                    GeneratedSubLedgerIdsCsv = generatedSubIds.Any() ? string.Join(",", generatedSubIds) : null
                                });

                                memberPool = Math.Max(0m, Math.Round(memberPool - allocItemTotal, 2, MidpointRounding.AwayFromZero));
                            }

                            if (memberPool > 0.01m)
                            {
                                await transaction.RollbackAsync();
                                return BadRequest($"{memberName} (Emp {detail.EmpCode}): मिळालेल्या रकमेपैकी ₹{memberPool:N2} रक्कम शिल्लक डिमान्डपेक्षा जास्त असल्याने समायोजित करता आली नाही.");
                            }

                            decimal newMemberRecovered = Math.Round(orderedItems.Sum(c => c.RecoveredPrincipalOrDeposit + c.RecoveredInterest + c.RecoveredPenalInterest), 2, MidpointRounding.AwayFromZero);
                            detail.RecoveredAmount = newMemberRecovered;
                            if (detail.TotalDeduction > 0m && newMemberRecovered >= detail.TotalDeduction - 0.01m)
                            {
                                detail.RecoveryStatus = "Recovered";
                                detail.IsProcessed = true;
                            }
                            else if (newMemberRecovered > 0.009m)
                            {
                                detail.RecoveryStatus = "Partial";
                                detail.IsProcessed = false;
                            }
                        }

                        decimal totalRecoveredOnNotice = await _context.DemandRecoveries
                            .Where(r => r.DemandNoticeId == notice.DemandNoticeId)
                            .SumAsync(r => (decimal?)r.TotalReceivedAmount) ?? 0m;
                        notice.TotalRecoveredAmount = Math.Round(totalRecoveredOnNotice, 2, MidpointRounding.AwayFromZero);

                        bool allDone = notice.MemberDetails.All(d => d.IsProcessed);
                        notice.Status = (allDone || (notice.TotalDemandAmount > 0m && notice.TotalRecoveredAmount >= notice.TotalDemandAmount - 0.01m))
                            ? "Received"
                            : "PartiallyReceived";

                        createdRecoveries.Add(new
                        {
                            recovery.DemandRecoveryId,
                            recovery.DemandNoticeId,
                            notice.NoticeNumber,
                            recovery.RecoveryDate,
                            recovery.TotalReceivedAmount,
                            recovery.RecoveredMemberCount,
                            recovery.VoucherId,
                            voucherNo = vchNo,
                            demandStatus = notice.Status
                        });
                    }

                    foreach (var kv in creditByLedger)
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = kv.Key,
                            DrCr = "Cr",
                            Amount = kv.Value
                        });
                    }

                    foreach (var custLine in customerCreditVoucherLines
                        .GroupBy(x => (x.LedgerId, x.CustomerId, x.MemberId))
                        .Select(g => new
                        {
                            g.Key.LedgerId,
                            g.Key.CustomerId,
                            g.Key.MemberId,
                            Amount = Math.Round(g.Sum(i => i.Amount), 2, MidpointRounding.AwayFromZero)
                        })
                        .Where(x => x.Amount > 0m))
                    {
                        _context.VoucherDetails.Add(new VoucherDetail
                        {
                            VoucherID = voucher.VoucherID,
                            LedgerID = custLine.LedgerId,
                            CustomerID = custLine.CustomerId,
                            MemberID = custLine.MemberId,
                            DrCr = "Cr",
                            Amount = custLine.Amount
                        });
                    }

                    await _context.SaveChangesAsync();
                    await VoucherBalanceHelper.EnsureBalancedInContextAsync(_context, voucher.VoucherID, voucher.VoucherNo);
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    message = $"बल्क पगार वसुली यशस्वीरीत्या नोंदवली गेली ({createdRecoveries.Count} डिमान्ड नोटीस) व पासिंगसाठी व्हाउचर तयार झाले!",
                    recoveries = createdRecoveries
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest($"बल्क डिमान्ड वसुली नोंदवताना त्रुटी: {ex.Message}");
            }
        }

        // Backward-compatible single-notice process endpoint (uses new Sequence waterfall automatically when ColumnItems exist)
        [HttpPost("process")]
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

            var notice = await _context.DemandNotices
                .Include(n => n.MemberDetails)
                    .ThenInclude(md => md.ColumnItems)
                .FirstOrDefaultAsync(n => n.DemandNoticeId == request.DemandNoticeId);

            if (notice == null)
            {
                return NotFound("डिमान्ड नोटीस सापडली नाही. (Demand notice not found.)");
            }

            bool hasModernItems = notice.MemberDetails.Any(m => m.ColumnItems.Any());
            if (hasModernItems)
            {
                decimal pool = Math.Round(request.TotalReceivedAmount, 2, MidpointRounding.AwayFromZero);
                var memInputs = new List<BulkMemberRecoveryInputDto>();

                foreach (var md in notice.MemberDetails.Where(m => !m.IsProcessed).OrderBy(m => m.DemandMemberDetailId))
                {
                    if (pool <= 0.009m) break;
                    decimal memPend = Math.Max(0m, Math.Round(md.ColumnItems.Sum(c =>
                        Math.Max(0m, c.DemandPrincipalOrDeposit - c.RecoveredPrincipalOrDeposit) +
                        Math.Max(0m, c.DemandInterest - c.RecoveredInterest - c.RecoveredPenalInterest)), 2, MidpointRounding.AwayFromZero));
                    if (memPend <= 0m) continue;

                    decimal take = Math.Min(pool, memPend);
                    pool = Math.Max(0m, Math.Round(pool - take, 2, MidpointRounding.AwayFromZero));
                    memInputs.Add(new BulkMemberRecoveryInputDto
                    {
                        DemandMemberDetailId = md.DemandMemberDetailId,
                        IsSelected = true,
                        ActualReceivedAmount = take
                    });
                }

                return await ProcessBulkRecovery(new BulkDemandRecoveryRequestDto
                {
                    RecoveryDate = request.RecoveryDate,
                    PaymentMode = request.PaymentMode ?? "Bank",
                    BankLedgerID = request.BankLedgerID,
                    ReferenceNo = request.ReferenceNo,
                    Remarks = request.Remarks,
                    AutoCreateMissingThriftAccount = true,
                    Notices = new List<BulkNoticeRecoveryInputDto>
                    {
                        new BulkNoticeRecoveryInputDto
                        {
                            DemandNoticeId = notice.DemandNoticeId,
                            Members = memInputs
                        }
                    }
                });
            }

            return BadRequest("ही डिमान्ड नोटीस जुन्या स्वरूपातील आहे; कृपया नवीन डिमांड फॉर्ममधून यादी जतन करून बल्क वसुली करा.");
        }

        private static (decimal AllocPenal, decimal AllocInterest, decimal AllocPrincipal) ComputeColumnAllocation(DemandMemberColumnItem ci, decimal availablePool)
        {
            if (availablePool <= 0.009m) return (0m, 0m, 0m);

            decimal remPrin = Math.Max(0m, Math.Round(ci.DemandPrincipalOrDeposit - ci.RecoveredPrincipalOrDeposit, 2, MidpointRounding.AwayFromZero));

            if (ci.ItemType != "LOAN")
            {
                decimal alloc = Math.Round(Math.Min(availablePool, remPrin), 2, MidpointRounding.AwayFromZero);
                return (0m, 0m, alloc);
            }

            decimal totalPenDemanded = Math.Max(0m, Math.Min(ci.DemandInterest, ci.DemandPenalInterest));
            decimal totalRegDemanded = Math.Max(0m, Math.Round(ci.DemandInterest - totalPenDemanded, 2, MidpointRounding.AwayFromZero));

            decimal remPen = Math.Max(0m, Math.Round(totalPenDemanded - ci.RecoveredPenalInterest, 2, MidpointRounding.AwayFromZero));
            decimal remInt = Math.Max(0m, Math.Round(totalRegDemanded - ci.RecoveredInterest, 2, MidpointRounding.AwayFromZero));

            decimal aPen = 0m, aInt = 0m, aPrin = 0m;
            decimal pool = availablePool;

            if (string.Equals(ci.LoanIntraAllocationOrder, "PRINCIPAL_FIRST", StringComparison.OrdinalIgnoreCase))
            {
                aPrin = Math.Round(Math.Min(pool, remPrin), 2, MidpointRounding.AwayFromZero);
                pool = Math.Max(0m, Math.Round(pool - aPrin, 2, MidpointRounding.AwayFromZero));

                aPen = Math.Round(Math.Min(pool, remPen), 2, MidpointRounding.AwayFromZero);
                pool = Math.Max(0m, Math.Round(pool - aPen, 2, MidpointRounding.AwayFromZero));

                aInt = Math.Round(Math.Min(pool, remInt), 2, MidpointRounding.AwayFromZero);
            }
            else
            {
                aPen = Math.Round(Math.Min(pool, remPen), 2, MidpointRounding.AwayFromZero);
                pool = Math.Max(0m, Math.Round(pool - aPen, 2, MidpointRounding.AwayFromZero));

                aInt = Math.Round(Math.Min(pool, remInt), 2, MidpointRounding.AwayFromZero);
                pool = Math.Max(0m, Math.Round(pool - aInt, 2, MidpointRounding.AwayFromZero));

                aPrin = Math.Round(Math.Min(pool, remPrin), 2, MidpointRounding.AwayFromZero);
            }

            return (aPen, aInt, aPrin);
        }

        private static List<int> ParseCsvIds(string? csv)
        {
            if (string.IsNullOrWhiteSpace(csv)) return new List<int>();
            var list = new List<int>();
            foreach (var part in csv.Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                if (int.TryParse(part.Trim(), out int val) && val > 0) list.Add(val);
            }
            return list.Distinct().ToList();
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

    public class BulkDemandRecoveryRequestDto
    {
        public DateTime RecoveryDate { get; set; } = DateTime.Today;
        public string PaymentMode { get; set; } = "Bank";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public string? BatchReference { get; set; }
        public string? IdempotencyKey { get; set; }
        public string? Remarks { get; set; }
        public bool AutoCreateMissingThriftAccount { get; set; } = true;
        public List<BulkNoticeRecoveryInputDto> Notices { get; set; } = new();
    }

    public class BulkNoticeRecoveryInputDto
    {
        public int DemandNoticeId { get; set; }
        public List<BulkMemberRecoveryInputDto> Members { get; set; } = new();
    }

    public class BulkMemberRecoveryInputDto
    {
        public int DemandMemberDetailId { get; set; }
        public bool IsSelected { get; set; } = true;
        public decimal ActualReceivedAmount { get; set; }
    }

    public class PreviewAllocationRequestDto
    {
        public int DemandNoticeId { get; set; }
        public List<BulkMemberRecoveryInputDto> MemberAmounts { get; set; } = new();
    }
}

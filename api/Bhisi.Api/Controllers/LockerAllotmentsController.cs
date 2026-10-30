using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LockerAllotmentsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LockerAllotmentsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/LockerAllotments
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetLockerAllotments([FromQuery] int? branchId, [FromQuery] string? status, [FromQuery] string? searchTerm, [FromQuery] int? customerId = null, [FromQuery] int? memberId = null)
        {
            var query = _context.LockerAllotments
                .Include(a => a.Locker).ThenInclude(l => l!.LockerType)
                .Include(a => a.Customer)
                .Include(a => a.Member)
                .Include(a => a.JointMember1)
                .Include(a => a.JointMember2)
                .Include(a => a.LinkedSavingAccount)
                .AsQueryable();

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(a => a.BranchID == branchId.Value);
            }
            if (customerId.HasValue && customerId.Value > 0)
            {
                query = query.Where(a => a.CustomerID == customerId.Value);
            }
            else if (memberId.HasValue && memberId.Value > 0)
            {
                query = query.Where(a => a.MemberID == memberId.Value);
            }
            if (!string.IsNullOrWhiteSpace(status) && status != "All")
            {
                query = query.Where(a => a.Status == status);
            }
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                var term = searchTerm.Trim().ToLower();
                query = query.Where(a =>
                    a.LockerAccountNo.ToLower().Contains(term) ||
                    (a.Locker != null && a.Locker.LockerNo.ToLower().Contains(term)) ||
                    (a.Customer != null && ((a.Customer.FirstName + " " + a.Customer.LastName).ToLower().Contains(term) || (a.Customer.CIFNo != null && a.Customer.CIFNo.ToLower().Contains(term)))) ||
                    (a.Member != null && a.Member.Customer != null && (((a.Member.Customer.FirstName + " " + a.Member.Customer.LastName).ToLower().Contains(term)) || (a.Member.MemberCode != null && a.Member.MemberCode.ToLower().Contains(term)))) ||
                    (a.NomineeName != null && a.NomineeName.ToLower().Contains(term)));
            }

            var list = await query
                .OrderByDescending(a => a.AllotmentDate)
                .Select(a => new
                {
                    a.AllotmentID,
                    a.BranchID,
                    a.LockerAccountNo,
                    a.LockerID,
                    LockerNo = a.Locker != null ? a.Locker.LockerNo : "",
                    CabinetNo = a.Locker != null ? a.Locker.CabinetNo : "",
                    KeyNo = a.Locker != null ? a.Locker.KeyNo : "",
                    TypeName = a.Locker != null && a.Locker.LockerType != null ? a.Locker.LockerType.TypeName : "",
                    a.CustomerID,
                    a.MemberID,
                    CIFNo = a.Customer != null ? a.Customer.CIFNo : (a.Member != null && a.Member.Customer != null ? a.Member.Customer.CIFNo : ""),
                    MemberNo = a.Member != null ? (a.Member.MemberCode ?? a.Member.MemberID.ToString()) : "",
                    LegacyMemberNo = a.Member != null ? (a.Member.LegacyMemberNo ?? "") : "",
                    LegacyCustomerNo = a.Customer != null ? (a.Customer.LegacyCustomerNo ?? "") : (a.Member != null && a.Member.Customer != null ? (a.Member.Customer.LegacyCustomerNo ?? "") : ""),
                    MemberName = a.Customer != null ? $"{a.Customer.FirstName} {a.Customer.LastName}" : (a.Member != null && a.Member.Customer != null ? $"{a.Member.Customer.FirstName} {a.Member.Customer.LastName}" : ""),
                    MemberPhone = a.Customer != null ? a.Customer.MobileNo : (a.Member != null && a.Member.Customer != null ? a.Member.Customer.MobileNo : ""),
                    MemberAddress = a.Customer != null ? a.Customer.Address : (a.Member != null && a.Member.Customer != null ? a.Member.Customer.Address : ""),
                    a.JointMember1_ID,
                    JointMember1_Name = a.JointMember1 != null && a.JointMember1.Customer != null ? (a.JointMember1.Customer.FirstName + " " + a.JointMember1.Customer.LastName).Trim() : "",
                    a.JointMember2_ID,
                    JointMember2_Name = a.JointMember2 != null && a.JointMember2.Customer != null ? (a.JointMember2.Customer.FirstName + " " + a.JointMember2.Customer.LastName).Trim() : "",
                    a.OperatingInstruction,
                    a.AllotmentDate,
                    a.RentStartDate,
                    a.ExpiryDate,
                    a.AnnualRent,
                    a.SecurityDepositAmount,
                    a.AdvanceRentPaid,
                    a.LinkedSavingAccountID,
                    LinkedSavingAccountNo = a.LinkedSavingAccount != null ? a.LinkedSavingAccount.AccountNo : "",
                    a.IsAutoDebitEnabled,
                    a.NomineeName,
                    a.NomineeRelation,
                    a.NomineeAge,
                    a.NomineeAadhaar,
                    a.NomineeAddress,
                    a.Status,
                    a.Remarks,
                    a.DepositVoucherID,
                    a.AdvanceRentVoucherID
                })
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/LockerAllotments/5
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetLockerAllotment(int id)
        {
            var a = await _context.LockerAllotments
                .Include(x => x.Locker).ThenInclude(l => l!.LockerType)
                .Include(x => x.Customer)
                .Include(x => x.Member).ThenInclude(m => m!.Customer)
                .Include(x => x.JointMember1).ThenInclude(m => m!.Customer)
                .Include(x => x.JointMember2).ThenInclude(m => m!.Customer)
                .Include(x => x.LinkedSavingAccount)
                .FirstOrDefaultAsync(x => x.AllotmentID == id);

            if (a == null)
            {
                return NotFound(new { message = "लॉकर वाटप नोंद आढळली नाही." });
            }

            var visits = await _context.LockerVisitRegisters
                .Where(v => v.AllotmentID == id)
                .OrderByDescending(v => v.VisitDate)
                .ToListAsync();

            var rentPostings = await _context.LockerRentPostings
                .Where(rp => rp.AllotmentID == id)
                .OrderByDescending(rp => rp.PaymentDate)
                .ToListAsync();

            var response = new
            {
                a.AllotmentID,
                a.BranchID,
                a.LockerAccountNo,
                a.LockerID,
                LockerNo = a.Locker?.LockerNo ?? "",
                CabinetNo = a.Locker?.CabinetNo ?? "",
                KeyNo = a.Locker?.KeyNo ?? "",
                TypeName = a.Locker?.LockerType?.TypeName ?? "",
                a.CustomerID,
                a.MemberID,
                CIFNo = a.Customer?.CIFNo ?? a.Member?.Customer?.CIFNo ?? "",
                MemberNo = a.Member?.MemberCode ?? a.Member?.MemberID.ToString() ?? "",
                MemberName = a.Customer != null ? $"{a.Customer.FirstName} {a.Customer.LastName}" : (a.Member?.Customer != null ? $"{a.Member.Customer.FirstName} {a.Member.Customer.LastName}" : ""),
                MemberPhone = a.Customer?.MobileNo ?? a.Member?.Customer?.MobileNo ?? "",
                MemberAddress = a.Customer?.Address ?? a.Member?.Customer?.Address ?? "",
                a.JointMember1_ID,
                JointMember1_Name = a.JointMember1?.Customer != null ? $"{a.JointMember1.Customer.FirstName} {a.JointMember1.Customer.LastName}".Trim() : "",
                a.JointMember2_ID,
                JointMember2_Name = a.JointMember2?.Customer != null ? $"{a.JointMember2.Customer.FirstName} {a.JointMember2.Customer.LastName}".Trim() : "",
                a.OperatingInstruction,
                a.AllotmentDate,
                a.RentStartDate,
                a.ExpiryDate,
                a.AnnualRent,
                a.SecurityDepositAmount,
                a.AdvanceRentPaid,
                a.LinkedSavingAccountID,
                LinkedSavingAccountNo = a.LinkedSavingAccount?.AccountNo ?? "",
                a.IsAutoDebitEnabled,
                a.NomineeName,
                a.NomineeRelation,
                a.NomineeAge,
                a.NomineeAadhaar,
                a.NomineeAddress,
                a.Status,
                a.Remarks,
                a.DepositVoucherID,
                a.AdvanceRentVoucherID,
                Visits = visits,
                RentPostings = rentPostings
            };

            return Ok(response);
        }

        // POST: api/LockerAllotments
        [HttpPost]
        public async Task<ActionResult<object>> PostLockerAllotment([FromBody] LockerAllotmentCreateDto dto)
        {
            var locker = await _context.Lockers
                .Include(l => l.LockerType)
                .FirstOrDefaultAsync(l => l.LockerID == dto.LockerID);

            if (locker == null)
            {
                return BadRequest(new { message = "निवडलेला लॉकर सापडला नाही." });
            }

            if (locker.Status != "Available")
            {
                return BadRequest(new { message = $"हा लॉकर सध्या वाटपासाठी उपलब्ध नाही (स्थिती: {locker.Status})." });
            }

            Customer? customer = null;
            Member? member = null;

            if (dto.CustomerID.HasValue && dto.CustomerID.Value > 0)
            {
                customer = await _context.Customers.FindAsync(dto.CustomerID.Value);
                if (customer == null) return BadRequest(new { message = "निवडलेला ग्राहक सिस्टीममध्ये अस्तित्वात नाही." });
                if (customer.Status != "Active") return BadRequest(new { message = $"ग्राहकाचे स्टेटस '{customer.Status}' असल्यामुळे लॉकर वाटप करता येत नाही." });

                member = await _context.Members.FirstOrDefaultAsync(m => m.CustomerID == customer.CustomerID);
            }
            else if (dto.MemberID.HasValue && dto.MemberID.Value > 0)
            {
                member = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == dto.MemberID.Value);
                if (member == null) return BadRequest(new { message = "निवडलेला सभासद सिस्टीममध्ये अस्तित्वात नाही." });
                if (member.Status != "Active") return BadRequest(new { message = $"सभासदाचे स्टेटस '{member.Status}' असल्यामुळे लॉकर वाटप करता येत नाही." });

                if (member.CustomerID > 0) customer = await _context.Customers.FindAsync(member.CustomerID);
            }
            else
            {
                return BadRequest(new { message = "कृपया खातेदाराची (Customer / Member) निवड करा." });
            }

            int? resolvedCustomerId = customer?.CustomerID ?? (member?.CustomerID > 0 ? member.CustomerID : null);
            int? resolvedMemberId = member?.MemberID;

            int paymentDebitLedgerId = 0;
            bool hasMonetaryReceipt = dto.SecurityDepositAmount > 0 || dto.AdvanceRentPaid > 0;
            if (hasMonetaryReceipt)
            {
                if (Helpers.BankLedgerHelper.IsBankPaymentMode(dto.PaymentMode))
                {
                    var bankCheck = await Helpers.BankLedgerHelper.ValidateBankLedgerAsync(_context, dto.BankLedgerID);
                    if (!bankCheck.IsValid)
                    {
                        return BadRequest(new { message = bankCheck.ErrorMessage });
                    }
                    paymentDebitLedgerId = bankCheck.LedgerId;
                }
                else
                {
                    paymentDebitLedgerId = await Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, dto.BranchID, "LOCKER");
                    if (paymentDebitLedgerId <= 0)
                    {
                        return BadRequest(new { message = "या शाखेसाठी रोख शिल्लक लेजर (Cash Ledger) सापडले नाही. कृपया शाखा मास्टरमध्ये रोख खाते तपासा." });
                    }
                }
            }

            int depositLiabilityLedgerId = locker.LockerType?.DepositLiabilityLedgerID ?? 0;
            if (dto.SecurityDepositAmount > 0 && depositLiabilityLedgerId <= 0)
            {
                var dynDepLedger = await _context.Ledgers
                    .Include(l => l.AccountGroup)
                    .FirstOrDefaultAsync(l => l.IsActive &&
                        (l.AccountType == "Liabilities" || l.AccountType == "Liability" || (l.AccountGroup != null && l.AccountGroup.NatureOfGroup == "Liabilities")) &&
                        (l.LedgerName.Contains("लॉकर अनामत") || l.LedgerName.Contains("लॉकर डिपॉझिट") || l.LedgerName.Contains("Locker Deposit") || l.LedgerName.Contains("Security Deposit")));

                if (dynDepLedger != null)
                {
                    depositLiabilityLedgerId = dynDepLedger.LedgerID;
                }
                else
                {
                    return BadRequest(new { message = $"लॉकर प्रकारास ('{locker.LockerType?.TypeName ?? locker.LockerNo}') 'डिपॉझिट देयता लेजर' (Deposit Liability Ledger) जोडलेले नाही. कृपया लॉकर प्रकार मास्टरमध्ये जी.एल. लेजर मॅपिंग पूर्ण करा." });
                }
            }

            int rentIncomeLedgerId = locker.LockerType?.RentIncomeLedgerID ?? 0;
            if (dto.AdvanceRentPaid > 0 && rentIncomeLedgerId <= 0)
            {
                var dynRentLedger = await _context.Ledgers
                    .Include(l => l.AccountGroup)
                    .FirstOrDefaultAsync(l => l.IsActive &&
                        (l.AccountType == "Income" || l.AccountType == "Revenue" || (l.AccountGroup != null && (l.AccountGroup.NatureOfGroup == "Income" || l.AccountGroup.NatureOfGroup == "Revenue"))) &&
                        (l.LedgerName.Contains("लॉकर भाडे") || l.LedgerName.Contains("Locker Rent")));

                if (dynRentLedger != null)
                {
                    rentIncomeLedgerId = dynRentLedger.LedgerID;
                }
                else
                {
                    return BadRequest(new { message = $"लॉकर प्रकारास ('{locker.LockerType?.TypeName ?? locker.LockerNo}') 'भाडे उत्पन्न लेजर' (Rent Income Ledger) जोडलेले नाही. कृपया लॉकर प्रकार मास्टरमध्ये जी.एल. लेजर मॅपिंग पूर्ण करा." });
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Generate collision-safe Locker Account Number: LKR-26-0001
                string accPrefix = $"LKR-{dto.AllotmentDate:yy}-";
                var existingAccNos = await _context.LockerAllotments
                    .AsNoTracking()
                    .Where(a => a.LockerAccountNo.StartsWith(accPrefix))
                    .Select(a => a.LockerAccountNo)
                    .ToListAsync();
                int maxSeq = 0;
                foreach (var no in existingAccNos)
                {
                    if (no.Length > accPrefix.Length && int.TryParse(no.Substring(accPrefix.Length), out int parsed) && parsed > maxSeq)
                    {
                        maxSeq = parsed;
                    }
                }
                int nextSeq = Math.Max(existingAccNos.Count, maxSeq) + 1;
                string lockerAccountNo = $"{accPrefix}{nextSeq:D4}";

                var allotment = new LockerAllotment
                {
                    BranchID = dto.BranchID,
                    LockerAccountNo = lockerAccountNo,
                    LockerID = dto.LockerID,
                    CustomerID = resolvedCustomerId,
                    MemberID = resolvedMemberId,
                    JointMember1_ID = dto.JointMember1_ID,
                    JointMember2_ID = dto.JointMember2_ID,
                    OperatingInstruction = dto.OperatingInstruction ?? "Self",
                    AllotmentDate = dto.AllotmentDate,
                    RentStartDate = dto.RentStartDate,
                    ExpiryDate = dto.RentStartDate.AddYears(1),
                    AnnualRent = dto.AnnualRent,
                    SecurityDepositAmount = dto.SecurityDepositAmount,
                    AdvanceRentPaid = dto.AdvanceRentPaid,
                    LinkedSavingAccountID = dto.LinkedSavingAccountID,
                    IsAutoDebitEnabled = dto.IsAutoDebitEnabled,
                    NomineeName = dto.NomineeName,
                    NomineeRelation = dto.NomineeRelation,
                    NomineeAge = dto.NomineeAge,
                    NomineeAadhaar = dto.NomineeAadhaar,
                    NomineeAddress = dto.NomineeAddress,
                    Status = "Active",
                    Remarks = dto.Remarks,
                    CreatedAt = DateTime.Now
                };

                // Update Locker Status to Allotted and persist allotment FIRST so AllotmentID > 0 for FK integrity
                locker.Status = "Allotted";
                _context.LockerAllotments.Add(allotment);
                await _context.SaveChangesAsync();

                int? depositVoucherId = null;
                int? rentVoucherId = null;
                string refSuffix = !string.IsNullOrWhiteSpace(dto.ReferenceNo) ? $" [संदर्भ: {dto.ReferenceNo.Trim()}]" : "";

                var accountHolderName = (customer != null
                    ? $"{customer.FirstName} {customer.LastName}".Trim()
                    : (member?.Customer != null
                        ? $"{member.Customer.FirstName} {member.Customer.LastName}".Trim()
                        : "Locker Holder"));

                // 1. Post Security Deposit Voucher if amount > 0
                if (dto.SecurityDepositAmount > 0)
                {
                    string depVchNo = await Helpers.VoucherNumberHelper.NextVoucherNoAsync(_context, $"VCH-LKR-DEP-{dto.AllotmentDate:yyyyMMdd}-", 4);
                    var depositVoucher = new Voucher
                    {
                        BranchID = dto.BranchID,
                        VoucherNo = depVchNo,
                        VoucherDate = dto.AllotmentDate,
                        VoucherType = "Receipt",
                        TotalAmount = dto.SecurityDepositAmount,
                        Narration = $"Locker Security Deposit: {lockerAccountNo} (Locker No: {locker.LockerNo}) - {accountHolderName}{refSuffix}",
                        Status = "Pending",
                        CreatedBy = 1,
                        VoucherDetails = new List<VoucherDetail>
                        {
                            new VoucherDetail { LedgerID = paymentDebitLedgerId, DrCr = "Dr", Amount = dto.SecurityDepositAmount },
                            new VoucherDetail { LedgerID = depositLiabilityLedgerId, DrCr = "Cr", Amount = dto.SecurityDepositAmount, CustomerID = resolvedCustomerId, MemberID = resolvedMemberId }
                        }
                    };
                    Helpers.VoucherBalanceHelper.EnsureBalanced(depositVoucher);
                    _context.Vouchers.Add(depositVoucher);
                    await _context.SaveChangesAsync();
                    depositVoucherId = depositVoucher.VoucherID;
                }

                // 2. Post Advance Rent Voucher if amount > 0
                if (dto.AdvanceRentPaid > 0)
                {
                    string rentVchNo = await Helpers.VoucherNumberHelper.NextVoucherNoAsync(_context, $"VCH-LKR-RNT-{dto.AllotmentDate:yyyyMMdd}-", 4);
                    var rentVoucher = new Voucher
                    {
                        BranchID = dto.BranchID,
                        VoucherNo = rentVchNo,
                        VoucherDate = dto.AllotmentDate,
                        VoucherType = "Receipt",
                        TotalAmount = dto.AdvanceRentPaid,
                        Narration = $"Locker Advance Rent: {lockerAccountNo} (Locker No: {locker.LockerNo}) - {accountHolderName}{refSuffix}",
                        Status = "Pending",
                        CreatedBy = 1,
                        VoucherDetails = new List<VoucherDetail>
                        {
                            new VoucherDetail { LedgerID = paymentDebitLedgerId, DrCr = "Dr", Amount = dto.AdvanceRentPaid },
                            new VoucherDetail { LedgerID = rentIncomeLedgerId, DrCr = "Cr", Amount = dto.AdvanceRentPaid }
                        }
                    };
                    Helpers.VoucherBalanceHelper.EnsureBalanced(rentVoucher);
                    _context.Vouchers.Add(rentVoucher);
                    await _context.SaveChangesAsync();
                    rentVoucherId = rentVoucher.VoucherID;

                    // Create initial RentPosting record with valid persisted AllotmentID
                    var rentPosting = new LockerRentPosting
                    {
                        BranchID = dto.BranchID,
                        AllotmentID = allotment.AllotmentID,
                        FinancialYear = $"{dto.RentStartDate.Year}-{(dto.RentStartDate.Year + 1)}",
                        FromDate = dto.RentStartDate,
                        ToDate = dto.RentStartDate.AddYears(1).AddDays(-1),
                        RentAmount = dto.AdvanceRentPaid,
                        TotalAmount = dto.AdvanceRentPaid,
                        PaymentMode = string.IsNullOrWhiteSpace(dto.PaymentMode) ? "Cash" : dto.PaymentMode.Trim(),
                        PaymentDate = dto.AllotmentDate,
                        ReceiptNo = rentVoucher.VoucherNo,
                        VoucherID = rentVoucherId,
                        IsPaid = true,
                        Remarks = "Initial Advance Rent Paid on Allotment",
                        CreatedAt = DateTime.Now
                    };
                    _context.LockerRentPostings.Add(rentPosting);
                }

                allotment.DepositVoucherID = depositVoucherId;
                allotment.AdvanceRentVoucherID = rentVoucherId;
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new
                {
                    message = "लॉकर यशस्वीरीत्या वाटप करण्यात आला आहे.",
                    allotmentID = allotment.AllotmentID,
                    lockerAccountNo = allotment.LockerAccountNo,
                    depositVoucherId,
                    rentVoucherId
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = $"लॉकर वाटप सेव्ह करताना त्रुटी: {ex.Message}" });
            }
        }

        // PUT: api/LockerAllotments/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutLockerAllotment(int id, [FromBody] LockerAllotmentUpdateDto dto)
        {
            var existing = await _context.LockerAllotments.FindAsync(id);
            if (existing == null)
            {
                return NotFound(new { message = "लॉकर वाटप खाते सापडले नाही." });
            }

            existing.JointMember1_ID = dto.JointMember1_ID;
            existing.JointMember2_ID = dto.JointMember2_ID;
            existing.OperatingInstruction = dto.OperatingInstruction ?? existing.OperatingInstruction;
            existing.LinkedSavingAccountID = dto.LinkedSavingAccountID;
            existing.IsAutoDebitEnabled = dto.IsAutoDebitEnabled;
            existing.NomineeName = dto.NomineeName;
            existing.NomineeRelation = dto.NomineeRelation;
            existing.NomineeAge = dto.NomineeAge;
            existing.NomineeAadhaar = dto.NomineeAadhaar;
            existing.NomineeAddress = dto.NomineeAddress;
            existing.Remarks = dto.Remarks;

            await _context.SaveChangesAsync();
            return Ok(new { message = "लॉकर तपशील यशस्वीरीत्या अपडेट केले." });
        }

        // GET: api/LockerAllotments/by-voucher/{voucherId}
        [HttpGet("by-voucher/{voucherId}")]
        public async Task<IActionResult> GetByVoucher(int voucherId)
        {
            var voucher = await _context.Vouchers
                .Include(v => v.VoucherDetails)
                    .ThenInclude(vd => vd.Ledger)
                .FirstOrDefaultAsync(v => v.VoucherID == voucherId);

            if (voucher == null)
            {
                return NotFound(new { message = "व्हाउचर सापडले नाही." });
            }

            var allotment = await _context.LockerAllotments
                .Include(a => a.Locker).ThenInclude(l => l!.LockerType)
                .Include(a => a.Customer)
                .Include(a => a.Member).ThenInclude(m => m!.Customer)
                .Include(a => a.JointMember1).ThenInclude(j => j!.Customer)
                .Include(a => a.JointMember2).ThenInclude(j => j!.Customer)
                .Include(a => a.LinkedSavingAccount)
                .FirstOrDefaultAsync(a => a.DepositVoucherID == voucherId || a.AdvanceRentVoucherID == voucherId);

            if (allotment == null)
            {
                var rentPosting = await _context.LockerRentPostings
                    .FirstOrDefaultAsync(rp => rp.VoucherID == voucherId);
                if (rentPosting != null)
                {
                    allotment = await _context.LockerAllotments
                        .Include(a => a.Locker).ThenInclude(l => l!.LockerType)
                        .Include(a => a.Customer)
                        .Include(a => a.Member).ThenInclude(m => m!.Customer)
                        .Include(a => a.JointMember1).ThenInclude(j => j!.Customer)
                        .Include(a => a.JointMember2).ThenInclude(j => j!.Customer)
                        .Include(a => a.LinkedSavingAccount)
                        .FirstOrDefaultAsync(a => a.AllotmentID == rentPosting.AllotmentID);
                }
            }

            if (allotment == null && !string.IsNullOrEmpty(voucher.Narration))
            {
                var match = System.Text.RegularExpressions.Regex.Match(voucher.Narration, @"(LKR-\d{2}-\d{4})");
                if (match.Success)
                {
                    var accNo = match.Groups[1].Value;
                    allotment = await _context.LockerAllotments
                        .Include(a => a.Locker).ThenInclude(l => l!.LockerType)
                        .Include(a => a.Customer)
                        .Include(a => a.Member).ThenInclude(m => m!.Customer)
                        .Include(a => a.JointMember1).ThenInclude(j => j!.Customer)
                        .Include(a => a.JointMember2).ThenInclude(j => j!.Customer)
                        .Include(a => a.LinkedSavingAccount)
                        .FirstOrDefaultAsync(a => a.LockerAccountNo == accNo);
                }
            }

            var memberName = allotment?.Customer != null
                ? $"{allotment.Customer.FirstName} {allotment.Customer.LastName}".Trim()
                : (allotment?.Member?.Customer != null
                    ? $"{allotment.Member.Customer.FirstName} {allotment.Member.Customer.LastName}".Trim()
                    : "");

            return Ok(new
            {
                voucher = new
                {
                    voucher.VoucherID,
                    voucher.VoucherNo,
                    voucher.VoucherDate,
                    voucher.VoucherType,
                    voucher.Status,
                    voucher.Narration,
                    voucher.TotalAmount
                },
                canPass = voucher.Status == "Pending" || voucher.Status == "Draft" || voucher.Status != "Approved",
                allotment = allotment != null ? new
                {
                    allotment.AllotmentID,
                    allotment.BranchID,
                    allotment.LockerAccountNo,
                    allotment.LockerID,
                    LockerNo = allotment.Locker?.LockerNo,
                    CabinetNo = allotment.Locker?.CabinetNo,
                    KeyNo = allotment.Locker?.KeyNo,
                    TypeName = allotment.Locker?.LockerType?.TypeName,
                    allotment.CustomerID,
                    allotment.MemberID,
                    MemberNo = allotment.Member != null ? (allotment.Member.MemberCode ?? allotment.Member.MemberID.ToString()) : "",
                    MemberName = memberName,
                    MemberPhone = allotment.Customer?.MobileNo ?? allotment.Member?.Customer?.MobileNo,
                    MemberAddress = allotment.Customer?.Address ?? allotment.Member?.Customer?.Address,
                    allotment.AllotmentDate,
                    allotment.RentStartDate,
                    allotment.ExpiryDate,
                    allotment.AnnualRent,
                    allotment.SecurityDepositAmount,
                    allotment.AdvanceRentPaid,
                    allotment.OperatingInstruction,
                    allotment.LinkedSavingAccountID,
                    LinkedSavingAccountNo = allotment.LinkedSavingAccount?.AccountNo,
                    allotment.IsAutoDebitEnabled,
                    allotment.NomineeName,
                    allotment.NomineeRelation,
                    allotment.NomineeAge,
                    allotment.NomineeAadhaar,
                    allotment.NomineeAddress,
                    allotment.Remarks,
                    allotment.Status
                } : null
            });
        }
    }

    public class LockerAllotmentCreateDto
    {
        public int BranchID { get; set; } = 1;
        public int LockerID { get; set; }
        public int? CustomerID { get; set; }
        public int? MemberID { get; set; }
        public int? JointMember1_ID { get; set; }
        public int? JointMember2_ID { get; set; }
        public string? OperatingInstruction { get; set; } = "Self";
        public DateTime AllotmentDate { get; set; } = DateTime.Today;
        public DateTime RentStartDate { get; set; } = DateTime.Today;
        public decimal AnnualRent { get; set; }
        public decimal SecurityDepositAmount { get; set; }
        public decimal AdvanceRentPaid { get; set; }
        public string? PaymentMode { get; set; } = "Cash";
        public int? BankLedgerID { get; set; }
        public string? ReferenceNo { get; set; }
        public int? LinkedSavingAccountID { get; set; }
        public bool IsAutoDebitEnabled { get; set; }
        public string? NomineeName { get; set; }
        public string? NomineeRelation { get; set; }
        public int? NomineeAge { get; set; }
        public string? NomineeAadhaar { get; set; }
        public string? NomineeAddress { get; set; }
        public string? Remarks { get; set; }
    }

    public class LockerAllotmentUpdateDto
    {
        public int? JointMember1_ID { get; set; }
        public int? JointMember2_ID { get; set; }
        public string? OperatingInstruction { get; set; }
        public int? LinkedSavingAccountID { get; set; }
        public bool IsAutoDebitEnabled { get; set; }
        public string? NomineeName { get; set; }
        public string? NomineeRelation { get; set; }
        public int? NomineeAge { get; set; }
        public string? NomineeAadhaar { get; set; }
        public string? NomineeAddress { get; set; }
        public string? Remarks { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Helpers;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Authorization;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [EnforceBranchScope]
    [Authorize]
    public class VouchersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly VoucherRollbackAndDeleteService _rollbackService;

        public VouchersController(
            AppDbContext context,
            VoucherRollbackAndDeleteService rollbackService)
        {
            _context = context;
            _rollbackService = rollbackService;
        }

        private DateTime? ResolveActiveLoginDate(DateTime? explicitDate = null)
        {
            if (explicitDate.HasValue)
            {
                return explicitDate.Value.Date;
            }
            if (Request?.Headers != null && Request.Headers.TryGetValue("X-Business-Date", out var headerVals))
            {
                var raw = headerVals.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(raw) && DateTime.TryParse(raw, out var parsedHeaderDate))
                {
                    return parsedHeaderDate.Date;
                }
            }
            return null;
        }

        // GET: api/Vouchers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Voucher>>> GetVouchers(
            [FromQuery] string? status,
            [FromQuery] int? branchId = null,
            [FromQuery] int? page = null,
            [FromQuery] int? pageSize = null,
            [FromQuery] DateTime? voucherDate = null,
            [FromQuery] string? voucherType = null,
            [FromQuery] string? search = null)
        {
            var query = _context.Vouchers.AsNoTracking().AsQueryable();

            int? effectiveBranch = User.ResolveOptionalBranchId(branchId);
            if (effectiveBranch.HasValue && effectiveBranch.Value > 0)
            {
                query = query.Where(v => v.BranchID == effectiveBranch.Value);
            }
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(v => v.Status == status);
                if (status == "Pending")
                {
                    var targetLoginDate = ResolveActiveLoginDate(voucherDate);
                    if (targetLoginDate.HasValue)
                    {
                        query = query.Where(v => v.VoucherDate.Date == targetLoginDate.Value);
                    }
                    query = query.Where(v => !v.VoucherNo.Contains("-OP-") &&
                                             !v.VoucherNo.StartsWith("JV-FD-OP-") &&
                                             !v.VoucherNo.StartsWith("REC-FD-OP-") &&
                                             !v.VoucherNo.StartsWith("JV-RD-OP-") &&
                                             !v.VoucherNo.StartsWith("REC-RD-OP-") &&
                                             !v.VoucherNo.StartsWith("JV-SH-OP-") &&
                                             !v.VoucherNo.StartsWith("JV-INV-OP-") &&
                                             v.VoucherType != "Opening" &&
                                             !(v.Narration != null && (v.Narration.Contains("आरंभिक शिल्लक") || v.Narration.Contains("Opening Balance Migration"))));
                }
            }

            if (!string.IsNullOrWhiteSpace(voucherType) && !voucherType.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(v => v.VoucherType == voucherType);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                string s = search.Trim();
                query = query.Where(v =>
                    v.VoucherNo.Contains(s) ||
                    v.VoucherType.Contains(s) ||
                    (v.Narration != null && v.Narration.Contains(s)) ||
                    v.TotalAmount.ToString().Contains(s));
            }

            int totalCount = await query.CountAsync();
            Response.Headers["X-Total-Count"] = totalCount.ToString();

            var orderedQuery = query
                                  .AsSplitQuery()
                                  .Include(v => v.Branch)
                                  .Include(v => v.VoucherDetails)
                                  .ThenInclude(d => d.Ledger)
                                  .Include(v => v.VoucherDetails)
                                  .ThenInclude(d => d.Customer)
                                  .Include(v => v.VoucherDetails)
                                  .ThenInclude(d => d.Member)
                                      .ThenInclude(m => m!.Customer)
                                  .OrderByDescending(v => v.VoucherDate)
                                  .ThenByDescending(v => v.VoucherID);

            if (pageSize.HasValue && (pageSize.Value <= 0 || pageSize.Value >= 10000))
            {
                return await orderedQuery.ToListAsync();
            }

            int p = page ?? 1;
            int ps = pageSize ?? 50;
            if (p < 1) p = 1;
            if (ps < 1 || ps > 5000) ps = 50;

            return await orderedQuery.Skip((p - 1) * ps).Take(ps).ToListAsync();
        }

        // GET: api/Vouchers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Voucher>> GetVoucher(int id)
        {
            var voucher = await _context.Vouchers
                                        .AsNoTracking()
                                        .AsSplitQuery()
                                        .Include(v => v.Branch)
                                        .Include(v => v.VoucherDetails)
                                        .ThenInclude(d => d.Ledger)
                                        .Include(v => v.VoucherDetails)
                                        .ThenInclude(d => d.Customer)
                                        .Include(v => v.VoucherDetails)
                                        .ThenInclude(d => d.Member)
                                            .ThenInclude(m => m!.Customer)
                                        .FirstOrDefaultAsync(v => v.VoucherID == id);

            if (voucher == null)
            {
                return NotFound();
            }

            return voucher;
        }

        // GET: api/Vouchers/next-number
        [HttpGet("next-number")]
        public async Task<ActionResult<object>> GetNextVoucherNo([FromQuery] string type, [FromQuery] int branchId = 1)
        {
            string voucherNo = await GenerateVoucherNo(branchId, type);
            return Ok(new { nextNumber = voucherNo });
        }

        private async Task<string> GenerateVoucherNo(int branchId, string voucherType)
        {
            var branch = await _context.Branches.FindAsync(branchId);
            string branchCode = branch?.BranchCode ?? "B01";

            string typeCode = "V";
            if (voucherType == "Receipt") typeCode = "REC";
            else if (voucherType == "Payment") typeCode = "PAY";
            else if (voucherType == "Contra") typeCode = "CTR";
            else if (voucherType == "Journal") typeCode = "JNL";

            var activeYear = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive);
            string fy = "25-26";
            if (activeYear != null)
            {
                var parts = activeYear.YearCode.Split('-');
                if (parts.Length == 2)
                {
                    string y1 = parts[0].Length >= 4 ? parts[0].Substring(parts[0].Length - 2) : parts[0];
                    string y2 = parts[1].Length >= 4 ? parts[1].Substring(parts[1].Length - 2) : parts[1];
                    fy = $"{y1}-{y2}";
                }
                else
                {
                    fy = activeYear.YearCode;
                }
            }

            // Standard Core Banking Format: BR01/25-26/REC/000001
            string prefix = $"{branchCode}/{fy}/{typeCode}/";
            string altPrefix = $"{branchCode}-{typeCode}-{fy}-";

            var existingNos = await _context.Vouchers
                .Where(v => v.BranchID == branchId && v.VoucherType == voucherType && v.VoucherNo != null)
                .Select(v => v.VoucherNo)
                .ToListAsync();

            int maxNum = 0;
            foreach (var no in existingNos)
            {
                if (string.IsNullOrWhiteSpace(no)) continue;

                string numStr = "";
                if (no.StartsWith(prefix))
                {
                    numStr = no.Substring(prefix.Length);
                }
                else if (no.StartsWith(altPrefix))
                {
                    numStr = no.Substring(altPrefix.Length);
                }
                else
                {
                    // Fallback numeric extraction from last part after '/' or '-'
                    var parts = no.Split('/', '-');
                    if (parts.Length > 0)
                    {
                        numStr = parts[^1];
                    }
                }

                if (int.TryParse(numStr, out int num))
                {
                    if (num > maxNum) maxNum = num;
                }
            }

            return $"{prefix}{(maxNum + 1):D6}";
        }

        private async Task<string?> ValidateVoucherTypeAndLedgersAsync(Voucher voucher, int branchId, int? excludeVoucherId = null)
        {
            if (voucher.VoucherDetails == null || !voucher.VoucherDetails.Any())
            {
                return "कृपया किमान एक व्हाउचर ओळ जोडा.";
            }

            string vType = (voucher.VoucherType ?? string.Empty).Trim();
            if (vType != "Receipt" && vType != "Payment" && vType != "Journal" && vType != "Contra" && vType != "Opening")
            {
                return $"अवैध व्हाउचर प्रकार: '{vType}'. कृपया Receipt, Payment, Journal किंवा Contra निवडा.";
            }

            var ledgerIds = voucher.VoucherDetails.Select(d => d.LedgerID).Distinct().ToList();
            if (ledgerIds.Any(id => id <= 0))
            {
                return "कृपया सर्व ओळींसाठी वैध खाते (Ledger) निवडा.";
            }

            var ledgersMap = await _context.Ledgers
                .AsNoTracking()
                .Include(l => l.AccountGroup)
                .Where(l => ledgerIds.Contains(l.LedgerID))
                .ToDictionaryAsync(l => l.LedgerID);

            foreach (var d in voucher.VoucherDetails)
            {
                if (!ledgersMap.ContainsKey(d.LedgerID))
                {
                    return $"निवडलेले खाते (ID: {d.LedgerID}) सिस्टीममध्ये सापडले नाही.";
                }
            }

            // Prevent debiting and crediting the exact same ledger (with same customer/member sub-ledger) in one voucher
            var drKeys = voucher.VoucherDetails
                .Where(d => d.DrCr == "Dr")
                .Select(d => $"{d.LedgerID}_{d.CustomerID ?? 0}_{d.MemberID ?? 0}")
                .ToHashSet();

            var dupCr = voucher.VoucherDetails
                .FirstOrDefault(d => d.DrCr == "Cr" && drKeys.Contains($"{d.LedgerID}_{d.CustomerID ?? 0}_{d.MemberID ?? 0}"));
            if (dupCr != null && ledgersMap.TryGetValue(dupCr.LedgerID, out var dupLedger))
            {
                return $"एकाच व्हाउचरमध्ये एकाच खात्याला ('{dupLedger.LedgerName}') एकाच वेळी नावे (Dr) आणि जमा (Cr) करता येत नाही.";
            }

            if (vType == "Journal")
            {
                foreach (var d in voucher.VoucherDetails)
                {
                    var ledger = ledgersMap[d.LedgerID];
                    if (BankLedgerHelper.IsCashLedger(ledger))
                    {
                        return $"जर्नल (Journal) व्हाउचरमध्ये रोख खाते ('{ledger.LedgerName}') वापरता येत नाही. रोख व्यवहारासाठी कृपया रिसिप्ट (रोख जमा) किंवा पेमेंट (रोख नावे) व्हाउचर वापरा.";
                    }
                }
            }
            else if (vType == "Contra" && false)
            {
                foreach (var d in voucher.VoucherDetails)
                {
                    var ledger = ledgersMap[d.LedgerID];
                    if (BankLedgerHelper.IsCashLedger(ledger) || BankLedgerHelper.IsBankLedger(ledger))
                    {
                        return $"कॉन्ट्रा (Contra) व्हाउचरमध्ये रोख किंवा बँक खाते ('{ledger.LedgerName}') वापरता येत नाही.";
                    }
                }
            }
            else if (vType == "Receipt")
            {
                bool hasDrCash = voucher.VoucherDetails
                    .Where(d => d.DrCr == "Dr")
                    .Any(d => BankLedgerHelper.IsCashLedger(ledgersMap[d.LedgerID]));
                if (!hasDrCash)
                {
                    return "रिसिप्ट (रोख जमा) व्हाउचरमध्ये नावे (Dr) बाजूला वैध रोख (Cash) खाते असणे आवश्यक आहे.";
                }

                var invalidCr = voucher.VoucherDetails
                    .Where(d => d.DrCr == "Cr")
                    .FirstOrDefault(d => BankLedgerHelper.IsCashLedger(ledgersMap[d.LedgerID]));
                if (invalidCr != null)
                {
                    var lName = ledgersMap[invalidCr.LedgerID].LedgerName;
                    return $"रिसिप्ट (रोख जमा) व्हाउचरमध्ये जमा (Cr) ओळीवर पुन्हा रोख खाते ('{lName}') निवडता येत नाही.";
                }
            }
            else if (vType == "Payment")
            {
                bool hasCrCash = voucher.VoucherDetails
                    .Where(d => d.DrCr == "Cr")
                    .Any(d => BankLedgerHelper.IsCashLedger(ledgersMap[d.LedgerID]));
                if (!hasCrCash)
                {
                    return "पेमेंट (रोख नावे) व्हाउचरमध्ये जमा (Cr) बाजूला वैध रोख (Cash) खाते असणे आवश्यक आहे.";
                }

                var invalidDr = voucher.VoucherDetails
                    .Where(d => d.DrCr == "Dr")
                    .FirstOrDefault(d => BankLedgerHelper.IsCashLedger(ledgersMap[d.LedgerID]));
                if (invalidDr != null)
                {
                    var lName = ledgersMap[invalidDr.LedgerID].LedgerName;
                    return $"पेमेंट (रोख नावे) व्हाउचरमध्ये नावे (Dr) ओळीवर पुन्हा रोख खाते ('{lName}') निवडता येत नाही.";
                }
            }

            return null;
        }

        // POST: api/Vouchers
        [HttpPost]
        public async Task<ActionResult<Voucher>> PostVoucher(Voucher voucher)
        {
            voucher.BranchID = User.ResolveRequiredBranchId(voucher.BranchID);

            // 0. Closed Financial Year Check
            var closedFyOnPost = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed &&
                                           voucher.VoucherDate.Date >= fy.StartDate.Date &&
                                           voucher.VoucherDate.Date <= fy.EndDate.Date);
            if (closedFyOnPost != null)
            {
                return BadRequest($"दिनांक {voucher.VoucherDate:dd/MM/yyyy} ही तारीख बंद केलेल्या आर्थिक वर्षात ({closedFyOnPost.YearCode}) येते. बंद आर्थिक वर्षात नवीन व्हाउचर तयार करता येणार नाही.");
            }

            // 1. Day-End Closed Check
            var dayStatus = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == voucher.BranchID && b.BusinessDate.Date == voucher.VoucherDate.Date)
                .FirstOrDefaultAsync();

            if (dayStatus != null && dayStatus.IsDayClosed)
            {
                return BadRequest($"तारीख {voucher.VoucherDate:dd/MM/yyyy} साठी दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेमध्ये नवीन वॉउचर तयार करता येणार नाही.");
            }

            var lastClosedVoucherCheck = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == voucher.BranchID && b.IsDayClosed)
                .OrderByDescending(b => b.BusinessDate)
                .FirstOrDefaultAsync();

            if (lastClosedVoucherCheck != null && voucher.VoucherDate.Date <= lastClosedVoucherCheck.BusinessDate.Date)
            {
                return BadRequest($"तारीख {voucher.VoucherDate:dd/MM/yyyy} ही शेवटच्या बंद झालेल्या दिवसापेक्षा ({lastClosedVoucherCheck.BusinessDate:dd/MM/yyyy}) जुनी किंवा बंद असलेली तारीख आहे. बंद तारखेत नवीन व्हाउचर तयार करता येणार नाही.");
            }

            // 1.1 Cashier Role Restrictions (Cashiers only allowed Cash Receipt & Cash Payment)
            var userRole = User.GetUserRole();
            if (userRole.Equals("Cashier", StringComparison.OrdinalIgnoreCase) &&
                !User.IsManagerOrAdmin() &&
                !userRole.Equals("Accountant", StringComparison.OrdinalIgnoreCase))
            {
                if (voucher.VoucherType != "Receipt" && voucher.VoucherType != "Payment")
                {
                    return BadRequest("कॅशियर फक्त 'Receipt' (जमा) किंवा 'Payment' (नावे) व्हाऊचर तयार करू शकतात. Journal किंवा Contra व्हाऊचरची परवानगी नाही.");
                }
            }

            int currentUserId = User.GetUserId();
            if (currentUserId > 0)
            {
                voucher.CreatedBy = currentUserId;
            }

            if (string.IsNullOrWhiteSpace(voucher.VoucherNo) || voucher.VoucherNo == "AUTO")
            {
                voucher.VoucherNo = await GenerateVoucherNo(voucher.BranchID, voucher.VoucherType);
            }

            // 2. Validate totals
            var totalDr = voucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount);
            var totalCr = voucher.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount);

            if (totalDr != totalCr)
            {
                return BadRequest("Total Debit must equal Total Credit.");
            }

            if (voucher.TotalAmount != totalDr)
            {
                return BadRequest("Voucher TotalAmount does not match line totals.");
            }

            var typeRuleError = await ValidateVoucherTypeAndLedgersAsync(voucher, voucher.BranchID);
            if (!string.IsNullOrEmpty(typeRuleError))
            {
                return BadRequest(typeRuleError);
            }

            // 2.5 Cross-Branch Customer / Member & Account Isolation Validation Check
            foreach (var detail in voucher.VoucherDetails)
            {
                if (detail.CustomerID.HasValue && detail.CustomerID.Value > 0)
                {
                    var customerBranch = await _context.Customers
                        .Where(c => c.CustomerID == detail.CustomerID.Value)
                        .Select(c => c.BranchID)
                        .FirstOrDefaultAsync();

                    if (customerBranch > 0 && customerBranch != voucher.BranchID)
                    {
                        return BadRequest("क्रॉस-ब्रांच व्यवहार बंदी! निवडलेला खातेदार वेगळ्या शाखेचा असल्यामुळे व्हाऊचर सेव्ह करता येणार नाही.");
                    }
                }
            }
            foreach (var detail in voucher.VoucherDetails)
            {
                if (detail.MemberID.HasValue && detail.MemberID.Value > 0)
                {
                    var memberBranch = await _context.Members
                        .Where(m => m.MemberID == detail.MemberID.Value)
                        .Select(m => m.BranchID)
                        .FirstOrDefaultAsync();

                    if (memberBranch > 0 && memberBranch != voucher.BranchID)
                    {
                        return BadRequest("क्रॉस-ब्रांच व्यवहार बंदी! निवडलेला सभासद वेगळ्या शाखेचा असल्यामुळे व्हाऊचर सेव्ह करता येणार नाही.");
                    }
                }
            }

            // 3. Negative Cash Balance Check
            int branchCashLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(_context, voucher.BranchID);
            var cashLedger = await _context.Ledgers.FindAsync(branchCashLedgerId);
            if (cashLedger != null)
            {
                var cashOutflow = voucher.VoucherDetails.Where(d => d.LedgerID == branchCashLedgerId && d.DrCr == "Cr").Sum(d => d.Amount);

                if (cashOutflow > 0)
                {
                    decimal currentCash = 0;
                    var fyBaseline = await FinancialYearBaselineHelper.ResolveBaselineAsync(_context, voucher.VoucherDate);
                    int activeFyId = fyBaseline.BaselineFinancialYearId;

                    var branchOb = await _context.BranchLedgerOpeningBalances
                        .FirstOrDefaultAsync(b => b.BranchID == voucher.BranchID && b.LedgerID == branchCashLedgerId && (activeFyId == 0 || b.FinancialYearID == activeFyId));
                    if (branchOb != null)
                    {
                        currentCash = branchOb.OpeningBalanceType == "Dr" ? branchOb.OpeningBalance : -branchOb.OpeningBalance;
                    }
                    else if (!fyBaseline.IsCarriedForwardYear && voucher.BranchID == 1)
                    {
                        currentCash = cashLedger.OpeningBalanceType == "Dr" ? cashLedger.OpeningBalance : -cashLedger.OpeningBalance;
                    }
                    var approvedCashQuery = _context.VoucherDetails
                        .Include(vd => vd.Voucher)
                        .Where(vd => vd.LedgerID == branchCashLedgerId && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == voucher.BranchID);
                    if (fyBaseline.BaselineStartDate.HasValue)
                    {
                        approvedCashQuery = approvedCashQuery.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate >= fyBaseline.BaselineStartDate.Value);
                    }
                    var approvedCashVds = await approvedCashQuery.ToListAsync();

                    currentCash += approvedCashVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                    currentCash -= approvedCashVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

                    if (currentCash < cashOutflow)
                    {
                        return BadRequest($"शाखेत पुरेशी रोख शिल्लक उपलब्ध नाही. उपलब्ध रोख: ₹ {currentCash:N2}, आवश्यक रोख: ₹ {cashOutflow:N2}");
                    }
                }
            }

            // 4. Maker-Checker Approval Policy (100% Pending — zero auto-post)
            voucher.Status = "Pending";
            voucher.ApprovedBy = null;
            voucher.ApprovedOn = null;
            voucher.RejectionReason = null;

            _context.Vouchers.Add(voucher);
            await _context.SaveChangesAsync();

            _context.AuditLogs.Add(new AuditLog
            {
                UserID = voucher.CreatedBy > 0 ? voucher.CreatedBy : null,
                Username = "User-" + voucher.CreatedBy,
                Action = "CREATE_VOUCHER",
                EntityName = "Voucher",
                EntityID = voucher.VoucherNo,
                Details = $"Created {voucher.VoucherType} voucher #{voucher.VoucherNo} for amount ₹{voucher.TotalAmount:N2} with status {voucher.Status}",
                Timestamp = DateTime.Now
            });
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetVoucher", new { id = voucher.VoucherID }, voucher);
        }

        // PUT: api/Vouchers/5
        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager,Accountant")]
        public async Task<IActionResult> PutVoucher(int id, Voucher voucher)
        {
            if (id != voucher.VoucherID)
            {
                return BadRequest();
            }

            var totalDr = voucher.VoucherDetails.Where(d => d.DrCr == "Dr").Sum(d => d.Amount);
            var totalCr = voucher.VoucherDetails.Where(d => d.DrCr == "Cr").Sum(d => d.Amount);

            if (totalDr != totalCr) return BadRequest("Total Debit must equal Total Credit.");
            if (voucher.TotalAmount != totalDr) return BadRequest("Voucher TotalAmount does not match line totals.");

            var existingVoucher = await _context.Vouchers.Include(v => v.VoucherDetails).FirstOrDefaultAsync(v => v.VoucherID == id);
            if (existingVoucher == null) return NotFound();

            if (existingVoucher.Status == "Approved" && !User.IsHeadOfficeAdmin())
            {
                return BadRequest("पोस्ट झालेले (Approved) व्हाउचर थेट बदलता येत नाही. आवश्यक असल्यास रिव्हर्सल किंवा कॅन्सलेशन करावे.");
            }

            // Closed Financial Year check
            var closedFyOnPut = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed &&
                                           ((existingVoucher.VoucherDate.Date >= fy.StartDate.Date && existingVoucher.VoucherDate.Date <= fy.EndDate.Date) ||
                                            (voucher.VoucherDate.Date >= fy.StartDate.Date && voucher.VoucherDate.Date <= fy.EndDate.Date)));
            if (closedFyOnPut != null)
            {
                return BadRequest($"दिनांक {existingVoucher.VoucherDate:dd/MM/yyyy} ही तारीख बंद केलेल्या आर्थिक वर्षात ({closedFyOnPut.YearCode}) येते. बंद आर्थिक वर्षातील व्हाउचर बदलता येणार नाही.");
            }

            // Day-End check
            var dayStatus = await _context.BranchDayEndStatuses
                .Where(b => b.BranchID == existingVoucher.BranchID && b.BusinessDate.Date == existingVoucher.VoucherDate.Date)
                .FirstOrDefaultAsync();

            if (dayStatus != null && dayStatus.IsDayClosed && !User.IsHeadOfficeAdmin())
            {
                return BadRequest($"तारीख {existingVoucher.VoucherDate:dd/MM/yyyy} साठी दिवस अखेर (EOD) पूर्ण झाली आहे. बंद झालेल्या तारखेचे वॉउचर बदलता येणार नाही.");
            }

            var putTypeRuleError = await ValidateVoucherTypeAndLedgersAsync(voucher, existingVoucher.BranchID, id);
            if (!string.IsNullOrEmpty(putTypeRuleError))
            {
                return BadRequest(putTypeRuleError);
            }

            // Cross-Branch Customer & Member Isolation Check on Update
            foreach (var detail in voucher.VoucherDetails)
            {
                if (detail.CustomerID.HasValue && detail.CustomerID.Value > 0)
                {
                    var customerBranch = await _context.Customers
                        .Where(c => c.CustomerID == detail.CustomerID.Value)
                        .Select(c => c.BranchID)
                        .FirstOrDefaultAsync();

                    if (customerBranch > 0 && customerBranch != existingVoucher.BranchID)
                    {
                        return BadRequest("क्रॉस-ब्रांच व्यवहार बंदी! निवडलेला खातेदार वेगळ्या शाखेचा असल्यामुळे व्हाऊचर अपडेट करता येणार नाही.");
                    }
                }
                if (detail.MemberID.HasValue && detail.MemberID.Value > 0)
                {
                    var memberBranch = await _context.Members
                        .Where(m => m.MemberID == detail.MemberID.Value)
                        .Select(m => m.BranchID)
                        .FirstOrDefaultAsync();

                    if (memberBranch > 0 && memberBranch != existingVoucher.BranchID)
                    {
                        return BadRequest("क्रॉस-ब्रांच व्यवहार बंदी! निवडलेला सभासद वेगळ्या शाखेचा असल्यामुळे व्हाऊचर अपडेट करता येणार नाही.");
                    }
                }
            }

            // Negative Cash Balance Check on Update
            int branchCashLedgerId = await CashLedgerHelper.GetCashLedgerIdAsync(_context, existingVoucher.BranchID);
            var cashLedger = await _context.Ledgers.FindAsync(branchCashLedgerId);
            if (cashLedger != null)
            {
                var cashOutflow = voucher.VoucherDetails.Where(d => d.LedgerID == branchCashLedgerId && d.DrCr == "Cr").Sum(d => d.Amount);
                if (cashOutflow > 0)
                {
                    decimal currentCash = 0;
                    var fyBaseline = await FinancialYearBaselineHelper.ResolveBaselineAsync(_context, voucher.VoucherDate);
                    int activeFyId = fyBaseline.BaselineFinancialYearId;

                    var branchOb = await _context.BranchLedgerOpeningBalances
                        .FirstOrDefaultAsync(b => b.BranchID == existingVoucher.BranchID && b.LedgerID == branchCashLedgerId && (activeFyId == 0 || b.FinancialYearID == activeFyId));
                    if (branchOb != null)
                    {
                        currentCash = branchOb.OpeningBalanceType == "Dr" ? branchOb.OpeningBalance : -branchOb.OpeningBalance;
                    }
                    else if (!fyBaseline.IsCarriedForwardYear && existingVoucher.BranchID == 1)
                    {
                        currentCash = cashLedger.OpeningBalanceType == "Dr" ? cashLedger.OpeningBalance : -cashLedger.OpeningBalance;
                    }
                    var approvedCashQuery = _context.VoucherDetails
                        .Include(vd => vd.Voucher)
                        .Where(vd => vd.LedgerID == branchCashLedgerId && vd.VoucherID != id && vd.Voucher != null && vd.Voucher.Status == "Approved" && vd.Voucher.BranchID == existingVoucher.BranchID);
                    if (fyBaseline.BaselineStartDate.HasValue)
                    {
                        approvedCashQuery = approvedCashQuery.Where(vd => vd.Voucher != null && vd.Voucher.VoucherDate >= fyBaseline.BaselineStartDate.Value);
                    }
                    var approvedCashVds = await approvedCashQuery.ToListAsync();

                    currentCash += approvedCashVds.Where(vd => vd.DrCr == "Dr").Sum(vd => vd.Amount);
                    currentCash -= approvedCashVds.Where(vd => vd.DrCr == "Cr").Sum(vd => vd.Amount);

                    if (currentCash < cashOutflow)
                    {
                        return BadRequest($"शाखेत पुरेशी रोख शिल्लक उपलब्ध नाही. उपलब्ध रोख: ₹ {currentCash:N2}, आवश्यक रोख: ₹ {cashOutflow:N2}");
                    }
                }
            }

            // Update scalar properties
            existingVoucher.VoucherDate = voucher.VoucherDate;
            existingVoucher.VoucherType = voucher.VoucherType;
            existingVoucher.Narration = voucher.Narration;
            existingVoucher.TotalAmount = voucher.TotalAmount;

            // Update Details
            _context.VoucherDetails.RemoveRange(existingVoucher.VoucherDetails);

            foreach (var d in voucher.VoucherDetails)
            {
                d.VoucherDetailID = 0; // reset
                existingVoucher.VoucherDetails.Add(d);
            }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!VoucherExists(id)) return NotFound();
                else throw;
            }

            return NoContent();
        }

        // DELETE: api/Vouchers/5
        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<IActionResult> DeleteVoucher(
            int id,
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] VoucherDeleteDto? dto = null,
            [FromQuery] string? reason = null)
        {
            string effectiveReason = !string.IsNullOrWhiteSpace(dto?.Reason)
                ? dto!.Reason.Trim()
                : (reason?.Trim() ?? string.Empty);

            int userId = User.GetUserId();
            if (userId <= 0 && dto != null && dto.UserID > 0) userId = dto.UserID;

            string username = User.GetUsername();
            if (string.IsNullOrWhiteSpace(username))
            {
                username = !string.IsNullOrWhiteSpace(dto?.Username) ? dto!.Username.Trim() : $"User-{userId}";
            }

            string userRole = User.GetUserRole();
            if (string.IsNullOrWhiteSpace(userRole) && !string.IsNullOrWhiteSpace(dto?.UserRole))
            {
                userRole = dto!.UserRole.Trim();
            }

            var result = await _rollbackService.DeleteVoucherWithRollbackAsync(
                id,
                new VoucherDeleteRequestContext
                {
                    UserId = userId,
                    Username = username,
                    UserRole = userRole,
                    UserBranchId = User.GetOperatingBranchId(),
                    IsHeadOfficeAdmin = User.IsHeadOfficeAdmin(),
                    Reason = effectiveReason,
                    ActionSource = "VOUCHER_DELETED",
                    EnforceSameBusinessDateForBranchUser = true,
                    RequireMinTenCharReason = true,
                    ClientIpAddress = HttpContext?.Connection?.RemoteIpAddress?.ToString()
                });

            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode, new { message = result.Message });
            }

            return Ok(new
            {
                message = result.Message,
                voucherNo = result.DeletedPrimaryVoucherNo,
                voucherNumbers = result.DeletedVoucherNos
            });
        }

        // GET: api/Vouchers/batch
        [HttpGet("batch")]
        public async Task<ActionResult<IEnumerable<Voucher>>> GetVouchersBatch(
            [FromQuery] DateTime startDate,
            [FromQuery] DateTime endDate,
            [FromQuery] string? type = "All",
            [FromQuery] int? branchId = null,
            [FromQuery] string? status = null)
        {
            var sDate = startDate.Date;
            var eDate = endDate.Date;
            var pigmyCutoff = new DateTime(2026, 3, 31);

            var query = _context.Vouchers
                                .AsNoTracking()
                                .AsSplitQuery()
                                .Include(v => v.Branch)
                                .Include(v => v.VoucherDetails)
                                .ThenInclude(d => d.Ledger)
                                .Include(v => v.VoucherDetails)
                                .ThenInclude(d => d.Member)
                                    .ThenInclude(m => m!.Customer)
                                .Include(v => v.VoucherDetails)
                                .ThenInclude(d => d.Customer)
                                .Where(v => v.VoucherDate.Date >= sDate && v.VoucherDate.Date <= eDate)
                                .Where(v => v.Status != "Rejected" && v.Status != "Cancelled")
                                .Where(v => !v.VoucherNo.Contains("-OP-") &&
                                            !v.VoucherNo.StartsWith("JV-FD-OP-") &&
                                            !v.VoucherNo.StartsWith("REC-FD-OP-") &&
                                            !v.VoucherNo.StartsWith("JV-RD-OP-") &&
                                            !v.VoucherNo.StartsWith("REC-RD-OP-") &&
                                            !v.VoucherNo.StartsWith("JV-SH-OP-") &&
                                            !v.VoucherNo.StartsWith("JV-INV-OP-") &&
                                            v.VoucherType != "Opening" &&
                                            !(v.VoucherDate.Date > pigmyCutoff &&
                                              v.VoucherNo.StartsWith("PV-") &&
                                              (v.VoucherNo.Contains("-IMP-") || v.VoucherNo.Contains("-BLK-"))));

            int? effectiveBranch = User.ResolveOptionalBranchId(branchId);
            if (effectiveBranch.HasValue && effectiveBranch.Value > 0)
            {
                query = query.Where(v => v.BranchID == effectiveBranch.Value);
            }

            if (!string.IsNullOrEmpty(type) && type != "All")
            {
                query = query.Where(v => v.VoucherType == type);
            }

            if (!string.IsNullOrEmpty(status) && status != "All")
            {
                query = query.Where(v => v.Status == status);
            }

            return await query.OrderBy(v => v.VoucherDate)
                              .ThenBy(v => v.VoucherID)
                              .ToListAsync();
        }

        private bool VoucherExists(int id)
        {
            return _context.Vouchers.Any(e => e.VoucherID == id);
        }

        public class ApprovalDto
        {
            public int ApprovedBy { get; set; }
            public DateTime? BusinessDate { get; set; }
        }

        public class RejectionDto
        {
            public int RejectedBy { get; set; }
            public string Reason { get; set; } = string.Empty;
        }

        // POST: api/Vouchers/5/Approve
        [HttpPost("{id}/Approve")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<IActionResult> ApproveVoucher(int id, [FromBody] ApprovalDto dto)
        {
            var voucher = await _context.Vouchers.FindAsync(id);
            if (voucher == null) return NotFound();

            if (voucher.Status == "Approved") return BadRequest("Voucher is already approved.");

            var targetLoginDate = ResolveActiveLoginDate(dto?.BusinessDate);
            if (targetLoginDate.HasValue && voucher.VoucherDate.Date != targetLoginDate.Value)
            {
                return BadRequest($"सुरक्षा नियम: फक्त चालू लॉगिन तारखेचेच ({targetLoginDate.Value:dd/MM/yyyy}) व्हाउचर मंजूर करता येतात. व्हाउचर क्र. {voucher.VoucherNo} ची तारीख ({voucher.VoucherDate:dd/MM/yyyy}) वेगळी आहे.");
            }

            var closedFyOnApprove = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed &&
                                           voucher.VoucherDate.Date >= fy.StartDate.Date &&
                                           voucher.VoucherDate.Date <= fy.EndDate.Date);
            if (closedFyOnApprove != null)
            {
                return BadRequest($"दिनांक {voucher.VoucherDate:dd/MM/yyyy} ही तारीख बंद केलेल्या आर्थिक वर्षात ({closedFyOnApprove.YearCode}) येते. बंद आर्थिक वर्षातील व्हाउचर मंजूर करता येणार नाही.");
            }

            var dayStatus = await _context.BranchDayEndStatuses
                .AsNoTracking()
                .Where(b => b.BranchID == voucher.BranchID && b.BusinessDate.Date == voucher.VoucherDate.Date)
                .FirstOrDefaultAsync();
            if (dayStatus != null && dayStatus.IsDayClosed)
            {
                return BadRequest($"दिनांक {voucher.VoucherDate:dd/MM/yyyy} ची दिवसअखेर (Day-End) पूर्ण झाली आहे. बंद झालेल्या तारखेचा व्हाउचर मंजूर करता येणार नाही.");
            }

            int approverId = User.GetUserId();
            if (approverId <= 0 && dto.ApprovedBy > 0)
            {
                approverId = dto.ApprovedBy;
            }

            if (voucher.CreatedBy > 0 && approverId > 0 && voucher.CreatedBy == approverId && !User.IsHeadOfficeAdmin())
            {
                return BadRequest("व्हाऊचर तयार करणारा वापरकर्ता स्वतःचा व्हाऊचर स्वतः अ‍ॅप्रुव्ह करू शकत नाही (Maker-Checker Rule).");
            }

            voucher.Status = "Approved";
            voucher.ApprovedBy = approverId;
            voucher.ApprovedOn = DateTime.Now;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Voucher approved successfully." });
        }

        // POST: api/Vouchers/5/Reject (100% Physical Hard Delete + State Rollback — zero soft-delete Status = "Rejected")
        [HttpPost("{id}/Reject")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<IActionResult> RejectVoucher(
            int id,
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] RejectionDto? dto = null,
            [FromQuery] string? reason = null)
        {
            string effectiveReason = !string.IsNullOrWhiteSpace(dto?.Reason)
                ? dto!.Reason.Trim()
                : (!string.IsNullOrWhiteSpace(reason) ? reason.Trim() : "व्हाउचर नाकारले व डेटाबेसमधून डिलीट केले");

            int rejecterId = User.GetUserId();
            if (rejecterId <= 0 && dto != null && dto.RejectedBy > 0) rejecterId = dto.RejectedBy;

            var result = await _rollbackService.DeleteVoucherWithRollbackAsync(
                id,
                new VoucherDeleteRequestContext
                {
                    UserId = rejecterId,
                    Username = User.GetUsername() ?? $"User-{rejecterId}",
                    UserRole = User.GetUserRole(),
                    UserBranchId = User.GetOperatingBranchId(),
                    IsHeadOfficeAdmin = User.IsHeadOfficeAdmin(),
                    Reason = effectiveReason,
                    ActionSource = "VOUCHER_REJECTED_HARD_DELETE",
                    EnforceSameBusinessDateForBranchUser = false,
                    RequireMinTenCharReason = false,
                    ClientIpAddress = HttpContext?.Connection?.RemoteIpAddress?.ToString()
                });

            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode, new { message = result.Message });
            }

            return Ok(new
            {
                message = result.Message,
                voucherNo = result.DeletedPrimaryVoucherNo,
                voucherNumbers = result.DeletedVoucherNos
            });
        }

        // POST: api/Vouchers/5/Cancel (100% Physical Hard Delete + State Rollback — blocks Approved vouchers until Unpassed)
        [HttpPost("{id}/Cancel")]
        [Authorize(Roles = "SuperAdmin,Admin,SystemAdmin,HeadOffice,HO_Manager,Manager,BranchManager")]
        public async Task<IActionResult> CancelVoucher(
            int id,
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] RejectionDto? dto = null,
            [FromQuery] string? reason = null)
        {
            string effectiveReason = !string.IsNullOrWhiteSpace(dto?.Reason)
                ? dto!.Reason.Trim()
                : (!string.IsNullOrWhiteSpace(reason) ? reason.Trim() : "व्हाउचर रद्द व डेटाबेसमधून डिलीट केले");

            int cancelUserId = User.GetUserId();
            if (cancelUserId <= 0 && dto != null && dto.RejectedBy > 0) cancelUserId = dto.RejectedBy;

            var result = await _rollbackService.DeleteVoucherWithRollbackAsync(
                id,
                new VoucherDeleteRequestContext
                {
                    UserId = cancelUserId,
                    Username = User.GetUsername() ?? $"User-{cancelUserId}",
                    UserRole = User.GetUserRole(),
                    UserBranchId = User.GetOperatingBranchId(),
                    IsHeadOfficeAdmin = User.IsHeadOfficeAdmin(),
                    Reason = effectiveReason,
                    ActionSource = "VOUCHER_CANCELLED_HARD_DELETE",
                    EnforceSameBusinessDateForBranchUser = false,
                    RequireMinTenCharReason = false,
                    ClientIpAddress = HttpContext?.Connection?.RemoteIpAddress?.ToString()
                });

            if (!result.Success)
            {
                return StatusCode(result.HttpStatusCode, new { message = result.Message });
            }

            return Ok(new
            {
                message = result.Message,
                voucherNo = result.DeletedPrimaryVoucherNo,
                voucherNumbers = result.DeletedVoucherNos
            });
        }
    }

    public class VoucherDeleteDto
    {
        public string Reason { get; set; } = string.Empty;
        public int UserID { get; set; }
        public string UserRole { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
    }
}

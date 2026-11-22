using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
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
    [Microsoft.AspNetCore.Authorization.Authorize]
    public class AgentCustomerRequestsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IBusinessDateGuardService _businessDateGuard;

        public AgentCustomerRequestsController(
            AppDbContext context,
            IBusinessDateGuardService? businessDateGuard = null)
        {
            _context = context;
            _businessDateGuard = businessDateGuard ?? new BusinessDateGuardService(context);
        }

        // GET: api/AgentCustomerRequests/dropdowns
        [HttpGet("dropdowns")]
        public async Task<IActionResult> GetDropdownOptions()
        {
            var schemes = await _context.PigmySchemes
                .Where(s => s.Status == "Active")
                .Select(s => new
                {
                    s.PigmySchemeID,
                    s.SchemeCode,
                    s.SchemeName,
                    s.InterestRate,
                    s.DurationMonths
                })
                .ToListAsync();

            var branches = await _context.Branches
                .Select(b => new
                {
                    b.BranchID,
                    b.BranchCode,
                    b.BranchName
                })
                .ToListAsync();

            return Ok(new
            {
                genders = new[]
                {
                    new { code = "Male", nameMr = "पुरुष (Male)", nameEn = "Male" },
                    new { code = "Female", nameMr = "महिला (Female)", nameEn = "Female" },
                    new { code = "Other", nameMr = "इतर (Other)", nameEn = "Other" }
                },
                casteCategories = new[]
                {
                    new { code = "Open", nameMr = "खुला (Open)", nameEn = "Open" },
                    new { code = "OBC", nameMr = "ओबीसी (OBC)", nameEn = "OBC" },
                    new { code = "SC", nameMr = "एस.सी. (SC)", nameEn = "SC" },
                    new { code = "ST", nameMr = "एस.टी. (ST)", nameEn = "ST" },
                    new { code = "VJNT", nameMr = "व्ही.जे.एन.टी. (VJNT)", nameEn = "VJNT" },
                    new { code = "NT", nameMr = "एन.टी. (NT)", nameEn = "NT" },
                    new { code = "SBC", nameMr = "एस.बी.सी. (SBC)", nameEn = "SBC" },
                    new { code = "EWS", nameMr = "ई.डब्ल्यू.एस. (EWS)", nameEn = "EWS" },
                    new { code = "Other", nameMr = "इतर (Other)", nameEn = "Other" }
                },
                occupations = new[]
                {
                    new { code = "Agriculture", nameMr = "शेती (Agriculture)", nameEn = "Agriculture" },
                    new { code = "Business", nameMr = "व्यवसाय / व्यापारी (Business)", nameEn = "Business" },
                    new { code = "Private Service", nameMr = "खाजगी नोकरी (Private Service)", nameEn = "Private Service" },
                    new { code = "Govt Service", nameMr = "सरकारी नोकरी (Govt Service)", nameEn = "Govt Service" },
                    new { code = "Labor", nameMr = "मजुरी (Labor / Daily Wage)", nameEn = "Labor" },
                    new { code = "Housewife", nameMr = "गृहिणी (Housewife)", nameEn = "Housewife" },
                    new { code = "Other", nameMr = "इतर (Other)", nameEn = "Other" }
                },
                nomineeRelations = new[]
                {
                    new { code = "Wife", nameMr = "पत्नी (Wife)", nameEn = "Wife" },
                    new { code = "Husband", nameMr = "पती (Husband)", nameEn = "Husband" },
                    new { code = "Son", nameMr = "मुलगा (Son)", nameEn = "Son" },
                    new { code = "Daughter", nameMr = "मुलगी (Daughter)", nameEn = "Daughter" },
                    new { code = "Mother", nameMr = "आई (Mother)", nameEn = "Mother" },
                    new { code = "Father", nameMr = "वडील (Father)", nameEn = "Father" },
                    new { code = "Brother", nameMr = "भाऊ (Brother)", nameEn = "Brother" },
                    new { code = "Sister", nameMr = "बहीण (Sister)", nameEn = "Sister" },
                    new { code = "Other", nameMr = "इतर (Other)", nameEn = "Other" }
                },
                pigmySchemes = schemes,
                branches = branches
            });
        }

        // GET: api/AgentCustomerRequests
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AgentCustomerRequest>>> GetAgentCustomerRequests(
            [FromQuery] string? status = null, 
            [FromQuery] int? branchId = null,
            [FromQuery] int? agentId = null)
        {
            var query = _context.AgentCustomerRequests
                .Include(r => r.Branch)
                .Include(r => r.PigmyAgent)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(r => r.Status == status);
            }

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(r => r.BranchID == branchId.Value);
            }

            if (agentId.HasValue && agentId.Value > 0)
            {
                query = query.Where(r => r.PigmyAgentID == agentId.Value);
            }

            return await query.OrderByDescending(r => r.RequestDate).ToListAsync();
        }

        // GET: api/AgentCustomerRequests/pending
        [HttpGet("pending")]
        public async Task<ActionResult<IEnumerable<AgentCustomerRequest>>> GetPendingRequests([FromQuery] int? branchId = null)
        {
            var query = _context.AgentCustomerRequests
                .Include(r => r.Branch)
                .Include(r => r.PigmyAgent)
                .Where(r => r.Status == "Pending");

            if (branchId.HasValue && branchId.Value > 0)
            {
                query = query.Where(r => r.BranchID == branchId.Value);
            }

            return await query.OrderByDescending(r => r.RequestDate).ToListAsync();
        }

        // GET: api/AgentCustomerRequests/5
        [HttpGet("{id}")]
        public async Task<ActionResult<AgentCustomerRequest>> GetAgentCustomerRequest(int id)
        {
            var request = await _context.AgentCustomerRequests
                .Include(r => r.Branch)
                .Include(r => r.PigmyAgent)
                .FirstOrDefaultAsync(r => r.RequestID == id);

            if (request == null)
            {
                return NotFound(new { message = "विनंती सापडली नाही (Request not found)" });
            }

            return request;
        }

        private async Task<string?> ValidateDuplicateKycAsync(string? rawAadhaar, string? rawPan, int excludeCustomerId = 0)
        {
            string? aadhaar = string.IsNullOrWhiteSpace(rawAadhaar)
                ? null
                : rawAadhaar.Trim().Replace(" ", "").Replace("-", "");
            if (!string.IsNullOrEmpty(aadhaar))
            {
                if (!KycValidationHelper.IsValidAadhaar(aadhaar, out var aadhaarError))
                {
                    return aadhaarError ?? "आधार क्रमांक वैध नाही.";
                }

                var dupCustomer = await _context.Customers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.CustomerID != excludeCustomerId && !c.IsDeleted &&
                        c.AadhaarNo != null && c.AadhaarNo.Replace(" ", "").Replace("-", "") == aadhaar);
                if (dupCustomer != null)
                {
                    return $"हा आधार क्रमांक ({aadhaar}) आधीच खातेदार '{dupCustomer.FirstName} {dupCustomer.LastName}' (CIF: {dupCustomer.CIFNo}) यांच्या नावे नोंदवला आहे.";
                }
            }

            string? pan = string.IsNullOrWhiteSpace(rawPan) ? null : rawPan.Trim().ToUpperInvariant();
            if (!string.IsNullOrEmpty(pan))
            {
                if (!KycValidationHelper.IsValidPan(pan, out var panError))
                {
                    return panError ?? "पॅन क्रमांक वैध नाही.";
                }

                var dupPanCustomer = await _context.Customers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.CustomerID != excludeCustomerId && !c.IsDeleted &&
                        c.PANNo != null && c.PANNo.ToUpper() == pan);
                if (dupPanCustomer != null)
                {
                    return $"हा पॅन क्रमांक ({pan}) आधीच खातेदार '{dupPanCustomer.FirstName} {dupPanCustomer.LastName}' (CIF: {dupPanCustomer.CIFNo}) यांच्या नावे नोंदवला आहे.";
                }
            }

            return null;
        }

        // POST: api/AgentCustomerRequests
        [HttpPost]
        public async Task<ActionResult<AgentCustomerRequest>> PostAgentCustomerRequest(AgentCustomerRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
            {
                return BadRequest(new { message = "ग्राहकाचे नाव आणि आडनाव आवश्यक आहे." });
            }

            int branchId = User.ResolveBranchId(request.BranchID > 0 ? request.BranchID : null);
            request.BranchID = branchId;

            string? kycError = await ValidateDuplicateKycAsync(request.AadhaarNo, request.PANNo);
            if (!string.IsNullOrEmpty(kycError))
            {
                return BadRequest(new { message = kycError });
            }

            request.AadhaarNo = string.IsNullOrWhiteSpace(request.AadhaarNo)
                ? null
                : request.AadhaarNo.Trim().Replace(" ", "").Replace("-", "");
            request.PANNo = string.IsNullOrWhiteSpace(request.PANNo)
                ? null
                : request.PANNo.Trim().ToUpperInvariant();

            // Populate AgentName if not provided
            if (request.PigmyAgentID.HasValue && string.IsNullOrWhiteSpace(request.AgentName))
            {
                var agent = await _context.PigmyAgents.FindAsync(request.PigmyAgentID.Value);
                if (agent != null)
                {
                    request.AgentName = agent.AgentName;
                }
            }

            var (businessDate, _) = await _businessDateGuard.GetBranchBusinessDateAsync(branchId);
            request.RequestDate = businessDate;
            request.Status = "Pending";

            _context.AgentCustomerRequests.Add(request);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAgentCustomerRequest), new { id = request.RequestID }, request);
        }

        // PUT: api/AgentCustomerRequests/5/approve
        [HttpPut("{id}/approve")]
        public async Task<IActionResult> ApproveRequest(int id, [FromBody] ApproveRequestDto dto)
        {
            var request = await _context.AgentCustomerRequests.FindAsync(id);
            if (request == null)
            {
                return NotFound(new { message = "विनंती सापडली नाही." });
            }

            request.Status = "Approved";
            request.ApprovalDate = DateTime.Now;
            request.ApprovedByUserID = dto.ApprovedByUserID;
            request.CreatedMemberID = dto.CreatedMemberID;
            request.CreatedCustomerID = dto.CreatedCustomerID;
            request.CreatedPigmyAccountID = dto.CreatedPigmyAccountID;

            await _context.SaveChangesAsync();
            return Ok(new { message = "विनंती यशस्वीरित्या मंजूर झाली.", request });
        }

        // PUT: api/AgentCustomerRequests/5/approve-and-create
        [HttpPut("{id}/approve-and-create")]
        public async Task<IActionResult> ApproveAndCreateRequest(int id, [FromBody] ApproveAndCreateRequestDto dto)
        {
            if (dto?.CustomerData == null ||
                string.IsNullOrWhiteSpace(dto.CustomerData.FirstName) ||
                string.IsNullOrWhiteSpace(dto.CustomerData.LastName))
            {
                return BadRequest(new { message = "ग्राहकाचे पहिले नाव आणि आडनाव आवश्यक आहे." });
            }

            var request = await _context.AgentCustomerRequests.FindAsync(id);
            if (request == null)
            {
                return NotFound(new { message = "विनंती सापडली नाही." });
            }

            if (request.Status == "Approved")
            {
                return BadRequest(new { message = "ही विनंती आधीच मंजूर झाली आहे." });
            }

            int requestedBranch = dto.CustomerData.BranchID > 0 ? dto.CustomerData.BranchID : (request.BranchID > 0 ? request.BranchID : 1);
            int branchId = User.ResolveBranchId(requestedBranch);
            int approverUserId = (dto.ApprovedByUserID.HasValue && dto.ApprovedByUserID.Value > 0)
                ? dto.ApprovedByUserID.Value
                : User.GetUserId();

            var (businessDate, _) = await _businessDateGuard.GetBranchBusinessDateAsync(branchId);
            if (await _businessDateGuard.IsDateClosedAsync(branchId, businessDate))
            {
                return Conflict(new { message = $"दिनांक {businessDate:dd/MM/yyyy} चा दिवस Day-End ने बंद केला आहे. बंद तारखेवर खाते उघडता येणार नाही." });
            }

            var closedFy = await _context.FinancialYears
                .AsNoTracking()
                .FirstOrDefaultAsync(fy => fy.IsClosed && businessDate.Date >= fy.StartDate.Date && businessDate.Date <= fy.EndDate.Date);
            if (closedFy != null)
            {
                return BadRequest(new { message = $"शाखेची चालू तारीख ({businessDate:dd/MM/yyyy}) बंद आर्थिक वर्षात ({closedFy.YearCode}) मोडते. खाते उघडता येणार नाही." });
            }

            string? rawAadhaar = !string.IsNullOrWhiteSpace(dto.CustomerData.AadhaarNo) ? dto.CustomerData.AadhaarNo : request.AadhaarNo;
            string? rawPan = !string.IsNullOrWhiteSpace(dto.CustomerData.PANNo) ? dto.CustomerData.PANNo : request.PANNo;

            string? kycError = await ValidateDuplicateKycAsync(rawAadhaar, rawPan);
            if (!string.IsNullOrEmpty(kycError))
            {
                return BadRequest(new { message = kycError });
            }

            string? aadhaar = string.IsNullOrWhiteSpace(rawAadhaar)
                ? null
                : rawAadhaar.Trim().Replace(" ", "").Replace("-", "");
            string? pan = string.IsNullOrWhiteSpace(rawPan)
                ? null
                : rawPan.Trim().ToUpperInvariant();

            PigmyScheme? scheme = null;
            string? cleanOld = string.IsNullOrWhiteSpace(request.OldAccountNo) ? null : request.OldAccountNo.Trim();
            if (dto.PigmyData != null && dto.PigmyData.OpenPigmyAccount && dto.PigmyData.PigmySchemeID.HasValue && dto.PigmyData.PigmyAgentID.HasValue)
            {
                scheme = await _context.PigmySchemes.FirstOrDefaultAsync(s => s.PigmySchemeID == dto.PigmyData.PigmySchemeID.Value && s.Status == "Active");
                if (scheme == null)
                {
                    return BadRequest(new { message = "निवडलेली पिग्मी योजना सक्रिय नाही किंवा आढळली नाही." });
                }

                if (!string.IsNullOrEmpty(cleanOld))
                {
                    bool legacyExists = await _context.PigmyAccounts.AnyAsync(p =>
                        p.BranchID == branchId &&
                        p.PigmySchemeID == scheme.PigmySchemeID &&
                        ((p.LegacyAccountNumber != null && p.LegacyAccountNumber.Trim() == cleanOld) ||
                         (p.OldAccountNo != null && p.OldAccountNo.Trim() == cleanOld)));
                    if (legacyExists)
                    {
                        return BadRequest(new { message = $"जुना पिग्मी खाते क्रमांक '{cleanOld}' या योजनेखाली आधीच नोंदवला आहे." });
                    }
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Create Customer using active CBS BusinessDate
                var customer = dto.CustomerData;
                customer.BranchID = branchId;
                customer.AadhaarNo = aadhaar;
                customer.PANNo = pan;
                customer.RegistrationDate = businessDate;
                customer.CreatedBy = approverUserId;
                customer.CreatedOn = DateTime.UtcNow;
                customer.Status = "Active";
                customer.IsDeleted = false;
                
                _context.Customers.Add(customer);
                await _context.SaveChangesAsync();

                // Generate Unified 1-to-1 Standard CBS CIF (e.g. CIF000123)
                string standardCif = $"CIF{customer.CustomerID:D6}";
                customer.CIFNo = !await _context.Customers.AnyAsync(c => c.CustomerID != customer.CustomerID && c.CIFNo == standardCif)
                    ? standardCif
                    : await Bhisi.Api.Helpers.AccountNumberHelper.GenerateUniqueCifAsync(_context);
                await _context.SaveChangesAsync();

                PigmyAccount? createdPigmyAccount = null;

                // 2. Create Pigmy Account if requested
                if (scheme != null && dto.PigmyData != null && dto.PigmyData.OpenPigmyAccount && dto.PigmyData.PigmyAgentID.HasValue)
                {
                    // Generate CBS Standard 14-digit Account Number
                    var accountNo = await Bhisi.Api.Helpers.AccountNumberHelper.GenerateNextPigmyAccountNo(
                        _context, 
                        branchId, 
                        scheme.PigmySchemeID, 
                        incrementSequence: true
                    );

                    createdPigmyAccount = new PigmyAccount
                    {
                        AccountNo = accountNo,
                        CustomerID = customer.CustomerID,
                        BranchID = branchId,
                        PigmySchemeID = scheme.PigmySchemeID,
                        PigmyAgentID = dto.PigmyData.PigmyAgentID.Value,
                        OpeningDate = businessDate,
                        MaturityDate = businessDate.AddMonths(scheme.DurationMonths > 0 ? scheme.DurationMonths : 12),
                        InterestRate = scheme.InterestRate,
                        TotalDepositedAmount = dto.PigmyData.OpeningBalance,
                        Status = "Active",
                        OldAccountNo = cleanOld,
                        LegacyAccountNumber = cleanOld,
                        DailyDepositAmount = dto.PigmyData.DailyDepositAmount > 0
                            ? dto.PigmyData.DailyDepositAmount
                            : (request.DailyDepositAmount > 0 ? request.DailyDepositAmount : 100m),
                        CreatedBy = approverUserId,
                        CreatedDate = DateTime.UtcNow
                    };
                    _context.PigmyAccounts.Add(createdPigmyAccount);
                    await _context.SaveChangesAsync();

                    if (dto.PigmyData.OpeningBalance > 0)
                    {
                        var initialTx = new PigmyTransaction
                        {
                            PigmyAccountID = createdPigmyAccount.PigmyAccountID,
                            TransactionDate = businessDate,
                            ValueDate = businessDate,
                            TransactionType = "DEPOSIT",
                            DrAmount = 0,
                            CrAmount = dto.PigmyData.OpeningBalance,
                            BalanceAmount = dto.PigmyData.OpeningBalance,
                            Narration = $"Initial Opening Deposit for A/C {createdPigmyAccount.AccountNo} (प्रारंभिक जमा रक्कम)",
                            MakerId = approverUserId,
                            PostedOn = DateTime.Now
                        };
                        _context.PigmyTransactions.Add(initialTx);

                        // Create GL Accounting Voucher for Opening Deposit on active BusinessDate
                        int cashLedgerId = await Bhisi.Api.Helpers.CashLedgerHelper.GetCashLedgerIdAsync(_context, branchId, "PIGMY");
                        int liabilityLedgerId = (scheme.PigmyLiabilityLedgerID.HasValue && scheme.PigmyLiabilityLedgerID > 0)
                            ? scheme.PigmyLiabilityLedgerID.Value
                            : (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 2;

                        string uniqueVoucherNo = $"PV-{branchId}-{businessDate:yyyyMMdd}-OPN-{Guid.NewGuid().ToString("N").Substring(0, 4)}";
                        var voucher = new Voucher
                        {
                            BranchID = branchId,
                            VoucherNo = uniqueVoucherNo,
                            VoucherDate = businessDate,
                            VoucherType = "Receipt",
                            Status = "Pending",
                            Narration = $"Pigmy Initial Opening Deposit for A/C {createdPigmyAccount.AccountNo} - {customer.FirstName} {customer.LastName}",
                            TotalAmount = dto.PigmyData.OpeningBalance,
                            CreatedBy = approverUserId,
                            CreatedOn = DateTime.Now
                        };

                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = cashLedgerId,
                            CustomerID = customer.CustomerID,
                            DrCr = "Dr",
                            Amount = dto.PigmyData.OpeningBalance
                        });

                        voucher.VoucherDetails.Add(new VoucherDetail
                        {
                            LedgerID = liabilityLedgerId,
                            CustomerID = customer.CustomerID,
                            DrCr = "Cr",
                            Amount = dto.PigmyData.OpeningBalance
                        });

                        _context.Vouchers.Add(voucher);
                    }
                }

                // 3. Mark Request as Approved
                request.Status = "Approved";
                request.ApprovalDate = businessDate;
                request.ApprovedByUserID = approverUserId;
                request.CreatedCustomerID = customer.CustomerID;
                if (createdPigmyAccount != null)
                {
                    request.CreatedPigmyAccountID = createdPigmyAccount.PigmyAccountID;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { 
                    message = "विनंती यशस्वीरित्या मंजूर झाली आणि खाते उघडले.", 
                    customerId = customer.CustomerID,
                    cifNo = customer.CIFNo,
                    pigmyAccountId = createdPigmyAccount?.PigmyAccountID,
                    pigmyAccountNo = createdPigmyAccount?.AccountNo,
                    openingDate = createdPigmyAccount?.OpeningDate.ToString("yyyy-MM-dd")
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = $"Error approving request: {ex.Message}" });
            }
        }

        // PUT: api/AgentCustomerRequests/5/reject
        [HttpPut("{id}/reject")]
        public async Task<IActionResult> RejectRequest(int id, [FromBody] RejectRequestDto dto)
        {
            var request = await _context.AgentCustomerRequests.FindAsync(id);
            if (request == null)
            {
                return NotFound(new { message = "विनंती सापडली नाही." });
            }

            request.Status = "Rejected";
            request.ApprovalDate = DateTime.Now;
            request.ApprovedByUserID = dto.ApprovedByUserID;
            request.RejectionReason = dto.RejectionReason;

            await _context.SaveChangesAsync();
            return Ok(new { message = "विनंती फेटाळण्यात आली.", request });
        }

        // DELETE: api/AgentCustomerRequests/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAgentCustomerRequest(int id)
        {
            var request = await _context.AgentCustomerRequests.FindAsync(id);
            if (request == null)
            {
                return NotFound();
            }

            _context.AgentCustomerRequests.Remove(request);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }

    public class ApproveRequestDto
    {
        public int? ApprovedByUserID { get; set; }
        public int? CreatedMemberID { get; set; }
        public int? CreatedCustomerID { get; set; }
        public int? CreatedPigmyAccountID { get; set; }
    }

    public class RejectRequestDto
    {
        public int? ApprovedByUserID { get; set; }
        public string? RejectionReason { get; set; }
    }

    public class PigmyAccountCreationDto 
    {
        public bool OpenPigmyAccount { get; set; }
        public int? PigmySchemeID { get; set; }
        public int? PigmyAgentID { get; set; }
        public decimal DailyDepositAmount { get; set; }
        public decimal OpeningBalance { get; set; }
    }

    public class ApproveAndCreateRequestDto
    {
        public Customer CustomerData { get; set; }
        public PigmyAccountCreationDto PigmyData { get; set; }
        public int? ApprovedByUserID { get; set; }
    }
}

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
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public class AgentCustomerRequestsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AgentCustomerRequestsController(AppDbContext context)
        {
            _context = context;
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

        // POST: api/AgentCustomerRequests
        [HttpPost]
        public async Task<ActionResult<AgentCustomerRequest>> PostAgentCustomerRequest(AgentCustomerRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
            {
                return BadRequest(new { message = "ग्राहकाचे नाव आणि आडनाव आवश्यक आहे." });
            }

            // Populate AgentName if not provided
            if (request.PigmyAgentID.HasValue && string.IsNullOrWhiteSpace(request.AgentName))
            {
                var agent = await _context.PigmyAgents.FindAsync(request.PigmyAgentID.Value);
                if (agent != null)
                {
                    request.AgentName = agent.AgentName;
                }
            }

            request.RequestDate = DateTime.Now;
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
            var request = await _context.AgentCustomerRequests.FindAsync(id);
            if (request == null)
            {
                return NotFound(new { message = "विनंती सापडली नाही." });
            }

            if (request.Status == "Approved")
            {
                return BadRequest(new { message = "ही विनंती आधीच मंजूर झाली आहे." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Create Customer
                var customer = dto.CustomerData;
                customer.CreatedOn = DateTime.UtcNow;
                customer.Status = "Active";
                
                _context.Customers.Add(customer);
                await _context.SaveChangesAsync();

                // Generate CIF
                customer.CIFNo = $"CIF-{customer.BranchID:D2}-{customer.CustomerID:D6}";
                await _context.SaveChangesAsync();

                PigmyAccount createdPigmyAccount = null;

                // 2. Create Pigmy Account if requested
                if (dto.PigmyData != null && dto.PigmyData.OpenPigmyAccount && dto.PigmyData.PigmySchemeID.HasValue && dto.PigmyData.PigmyAgentID.HasValue)
                {
                    var scheme = await _context.PigmySchemes.FindAsync(dto.PigmyData.PigmySchemeID.Value);
                    if (scheme != null)
                    {
                        var dateStr = DateTime.Now.ToString("yyyyMMdd");
                        var accountNo = $"PGM-{customer.BranchID}-{dateStr}-{customer.CustomerID:D4}";

                        createdPigmyAccount = new PigmyAccount
                        {
                            AccountNo = accountNo,
                            CustomerID = customer.CustomerID,
                            BranchID = customer.BranchID,
                            PigmySchemeID = scheme.PigmySchemeID,
                            PigmyAgentID = dto.PigmyData.PigmyAgentID.Value,
                            OpeningDate = DateTime.Today,
                            MaturityDate = DateTime.Today.AddMonths(scheme.DurationMonths > 0 ? scheme.DurationMonths : 12),
                            InterestRate = scheme.InterestRate,
                            TotalDepositedAmount = dto.PigmyData.OpeningBalance,
                            Status = "Active",
                            CreatedBy = dto.ApprovedByUserID ?? 0,
                            CreatedDate = DateTime.UtcNow
                        };
                        _context.PigmyAccounts.Add(createdPigmyAccount);
                        await _context.SaveChangesAsync();
                    }
                }

                // 3. Mark Request as Approved
                request.Status = "Approved";
                request.ApprovalDate = DateTime.Now;
                request.ApprovedByUserID = dto.ApprovedByUserID;
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
                    pigmyAccountNo = createdPigmyAccount?.AccountNo
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

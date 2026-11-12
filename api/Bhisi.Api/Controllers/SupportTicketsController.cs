using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SupportTicketsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SupportTicketsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/SupportTickets?branchId=1&status=OPEN
        [HttpGet]
        public async Task<IActionResult> GetTickets(
            [FromQuery] int? branchId = null,
            [FromQuery] int? userId = null,
            [FromQuery] string? status = null,
            [FromQuery] string? search = null)
        {
            try
            {
                var query = _context.SupportTickets
                    .Include(t => t.Attachments)
                    .AsNoTracking()
                    .AsQueryable();

                if (branchId.HasValue && branchId.Value > 0)
                {
                    query = query.Where(t => t.BranchID == branchId.Value);
                }

                if (userId.HasValue && userId.Value > 0)
                {
                    query = query.Where(t => t.UserID == userId.Value);
                }

                if (!string.IsNullOrWhiteSpace(status) && status != "ALL")
                {
                    query = query.Where(t => t.Status.ToLower() == status.ToLower());
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim().ToLower();
                    query = query.Where(t => t.TicketNo.ToLower().Contains(s) ||
                                             t.Subject.ToLower().Contains(s) ||
                                             t.Description.ToLower().Contains(s) ||
                                             t.ModuleCategory.ToLower().Contains(s));
                }

                var list = await query
                    .OrderByDescending(t => t.CreatedOn)
                    .Take(100)
                    .ToListAsync();

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "सपोर्ट कॉल्स लोड करताना त्रुटी आली.", detail = ex.Message });
            }
        }

        // GET: api/SupportTickets/5
        [HttpGet("{id}")]
        public async Task<IActionResult> GetTicket(int id)
        {
            try
            {
                var ticket = await _context.SupportTickets
                    .Include(t => t.Attachments)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.TicketID == id);

                if (ticket == null)
                {
                    return NotFound(new { message = "सपोर्ट तिकीट सापडले नाही." });
                }

                return Ok(ticket);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "तपशील लोड करताना त्रुटी आली.", detail = ex.Message });
            }
        }

        // POST: api/SupportTickets (multipart/form-data)
        [HttpPost]
        public async Task<IActionResult> CreateTicket([FromForm] SupportTicketCreateRequest request, [FromForm] List<IFormFile>? screenshots)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.Subject))
                {
                    return BadRequest(new { message = "समस्येचा विषय (Subject) आवश्यक आहे." });
                }

                if (string.IsNullOrWhiteSpace(request.Description))
                {
                    return BadRequest(new { message = "समस्येचे सविस्तर वर्णन (Description) आवश्यक आहे." });
                }

                // Generate Sequential Ticket Number: TKT-yyyyMMdd-001
                var todayStr = DateTime.Now.ToString("yyyyMMdd");
                var todayPrefix = $"TKT-{todayStr}-";
                var countToday = await _context.SupportTickets
                    .Where(t => t.TicketNo.StartsWith(todayPrefix))
                    .CountAsync();

                var ticketNo = $"{todayPrefix}{(countToday + 1):D3}";

                var ticket = new SupportTicket
                {
                    TicketNo = ticketNo,
                    BranchID = request.BranchID > 0 ? request.BranchID : 1,
                    BranchName = string.IsNullOrWhiteSpace(request.BranchName) ? "Main Branch" : request.BranchName.Trim(),
                    UserID = request.UserID > 0 ? request.UserID : 1,
                    Username = string.IsNullOrWhiteSpace(request.Username) ? "User" : request.Username.Trim(),
                    ContactNumber = request.ContactNumber?.Trim(),
                    ModuleCategory = string.IsNullOrWhiteSpace(request.ModuleCategory) ? "General" : request.ModuleCategory.Trim(),
                    Priority = string.IsNullOrWhiteSpace(request.Priority) ? "MEDIUM" : request.Priority.ToUpper().Trim(),
                    Subject = request.Subject.Trim(),
                    Description = request.Description.Trim(),
                    SystemInfoJson = request.SystemInfoJson,
                    Status = "OPEN",
                    CreatedOn = DateTime.Now
                };

                // Handle screenshots attachment upload
                if (screenshots != null && screenshots.Any())
                {
                    var supportFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "support");
                    if (!Directory.Exists(supportFolder))
                    {
                        Directory.CreateDirectory(supportFolder);
                    }

                    var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".pdf" };

                    foreach (var file in screenshots)
                    {
                        if (file == null || file.Length == 0) continue;

                        if (file.Length > 10 * 1024 * 1024)
                        {
                            return BadRequest(new { message = $"फाईल {file.FileName} १० MB पेक्षा मोठी आहे." });
                        }

                        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                        if (string.IsNullOrEmpty(ext)) ext = ".png"; // default for pasted clipboard images

                        if (!allowedExtensions.Contains(ext))
                        {
                            return BadRequest(new { message = $"केवळ .jpg, .jpeg, .png, .webp किंवा .pdf फाईल्स स्वीकारल्या जातात ({file.FileName})." });
                        }

                        var uniqueFileName = $"{Guid.NewGuid():N}{ext}";
                        var filePath = Path.Combine(supportFolder, uniqueFileName);

                        using (var stream = new FileStream(filePath, FileMode.Create))
                        {
                            await file.CopyToAsync(stream);
                        }

                        var publicUrl = $"/uploads/support/{uniqueFileName}";
                        ticket.Attachments.Add(new SupportTicketAttachment
                        {
                            OriginalFileName = string.IsNullOrWhiteSpace(file.FileName) ? "screenshot.png" : file.FileName,
                            FilePath = publicUrl,
                            FileType = file.ContentType,
                            FileSize = file.Length,
                            CreatedOn = DateTime.Now
                        });
                    }
                }

                _context.SupportTickets.Add(ticket);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = $"सपोर्ट कॉल यशस्वीरित्या नोंदवला गेला आहे. (कॉल क्र: {ticket.TicketNo})",
                    ticketId = ticket.TicketID,
                    ticketNo = ticket.TicketNo
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "सपोर्ट कॉल नोंदवताना त्रुटी आली.", detail = ex.Message });
            }
        }

        // PUT: api/SupportTickets/5/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] SupportTicketStatusUpdateRequest request)
        {
            try
            {
                var ticket = await _context.SupportTickets.FindAsync(id);
                if (ticket == null)
                {
                    return NotFound(new { message = "सपोर्ट तिकीट सापडले नाही." });
                }

                if (!string.IsNullOrWhiteSpace(request.Status))
                {
                    ticket.Status = request.Status.ToUpper().Trim();
                }

                if (!string.IsNullOrWhiteSpace(request.ResolutionRemarks))
                {
                    ticket.ResolutionRemarks = request.ResolutionRemarks.Trim();
                }

                if (ticket.Status == "RESOLVED" || ticket.Status == "CLOSED")
                {
                    ticket.ResolvedAt ??= DateTime.Now;
                    if (request.ResolvedByUserID.HasValue)
                    {
                        ticket.ResolvedByUserID = request.ResolvedByUserID.Value;
                    }
                }

                ticket.UpdatedOn = DateTime.Now;
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "स्थिती अद्ययावत केली गेली आहे." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "स्थिती अद्ययावत करताना त्रुटी आली.", detail = ex.Message });
            }
        }
    }

    public class SupportTicketCreateRequest
    {
        public int BranchID { get; set; } = 1;
        public string BranchName { get; set; } = string.Empty;
        public int UserID { get; set; } = 1;
        public string Username { get; set; } = string.Empty;
        public string? ContactNumber { get; set; }
        public string ModuleCategory { get; set; } = "General";
        public string Priority { get; set; } = "MEDIUM";
        public string Subject { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? SystemInfoJson { get; set; }
    }

    public class SupportTicketStatusUpdateRequest
    {
        public string Status { get; set; } = string.Empty; // OPEN, IN_PROGRESS, RESOLVED, CLOSED
        public string? ResolutionRemarks { get; set; }
        public int? ResolvedByUserID { get; set; }
    }
}


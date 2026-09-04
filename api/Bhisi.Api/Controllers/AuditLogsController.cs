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
    public class AuditLogsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuditLogsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AuditLogs
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AuditLog>>> GetAuditLogs(
            [FromQuery] string? action,
            [FromQuery] string? username,
            [FromQuery] string? entityName,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var query = _context.AuditLogs.AsQueryable();

            if (!string.IsNullOrWhiteSpace(action))
                query = query.Where(a => a.Action != null && a.Action.Contains(action));

            if (!string.IsNullOrWhiteSpace(username))
                query = query.Where(a => a.Username != null && a.Username.Contains(username));

            if (!string.IsNullOrWhiteSpace(entityName))
                query = query.Where(a => a.EntityName != null && a.EntityName.Contains(entityName));

            if (fromDate.HasValue)
                query = query.Where(a => a.Timestamp >= fromDate.Value.Date);

            if (toDate.HasValue)
                query = query.Where(a => a.Timestamp <= toDate.Value.Date.AddDays(1).AddTicks(-1));

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 500) pageSize = 100;

            query = query.OrderByDescending(a => a.Timestamp);

            int skip = (page - 1) * pageSize;
            if (skip > 0)
            {
                query = query.Skip(skip);
            }

            return await query.Take(pageSize).ToListAsync();
        }

        // POST: api/AuditLogs
        [HttpPost]
        public async Task<ActionResult<AuditLog>> CreateAuditLog([FromBody] AuditLog log)
        {
            if (log == null) return BadRequest("Audit log data is required.");

            log.Timestamp = DateTime.Now;
            log.IPAddress ??= HttpContext.Connection.RemoteIpAddress?.ToString();

            _context.AuditLogs.Add(log);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAuditLogs), new { id = log.AuditLogID }, log);
        }
    }
}

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
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 1000)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 5000) pageSize = 1000;

            var usersMap = await _context.Users
                .AsNoTracking()
                .Select(u => new { u.UserID, u.Username })
                .ToDictionaryAsync(u => u.UserID, u => u.Username);

            var query = _context.AuditLogs.AsNoTracking().AsQueryable();

            if (fromDate.HasValue)
                query = query.Where(a => a.Timestamp >= fromDate.Value.Date);

            if (toDate.HasValue)
                query = query.Where(a => a.Timestamp <= toDate.Value.Date.AddDays(1).AddTicks(-1));

            var dbLogs = await query
                .OrderByDescending(a => a.Timestamp)
                .Take(5000)
                .ToListAsync();

            // Normalize usernames (e.g., resolve "User-1" or blank username when UserID is present)
            foreach (var item in dbLogs)
            {
                if (string.IsNullOrWhiteSpace(item.Username) || item.Username.StartsWith("User-", StringComparison.OrdinalIgnoreCase))
                {
                    int resolvedUserId = item.UserID ?? 0;
                    if (resolvedUserId <= 0 && item.Username != null && item.Username.StartsWith("User-", StringComparison.OrdinalIgnoreCase))
                    {
                        int.TryParse(item.Username.Substring(5), out resolvedUserId);
                    }
                    if (resolvedUserId > 0 && usersMap.TryGetValue(resolvedUserId, out var realUsername) && !string.IsNullOrWhiteSpace(realUsername))
                    {
                        item.Username = realUsername;
                        item.UserID ??= resolvedUserId;
                    }
                    else if (string.IsNullOrWhiteSpace(item.Username))
                    {
                        item.Username = "System";
                    }
                }
                if (string.IsNullOrWhiteSpace(item.Status))
                {
                    item.Status = "Success";
                }
            }

            // Include UserLoginAudits so login, failed login, and lockout security events appear in the Audit Trail Report
            var loginQuery = _context.UserLoginAudits.AsNoTracking().AsQueryable();
            if (fromDate.HasValue)
                loginQuery = loginQuery.Where(l => l.LoginTime >= fromDate.Value.Date);
            if (toDate.HasValue)
                loginQuery = loginQuery.Where(l => l.LoginTime <= toDate.Value.Date.AddDays(1).AddTicks(-1));

            var loginAudits = await loginQuery
                .OrderByDescending(l => l.LoginTime)
                .Take(2000)
                .ToListAsync();

            var mappedLoginLogs = loginAudits.Select(l =>
            {
                bool isSuccess = l.Status != null && l.Status.StartsWith("Success", StringComparison.OrdinalIgnoreCase);
                bool isLocked = l.Status != null && l.Status.Contains("Locked", StringComparison.OrdinalIgnoreCase);
                string uname = usersMap.TryGetValue(l.UserID, out var u) && !string.IsNullOrWhiteSpace(u)
                    ? u
                    : $"User #{l.UserID}";

                return new AuditLog
                {
                    AuditLogID = 10000000L + l.AuditID,
                    UserID = l.UserID,
                    Username = uname,
                    Action = isLocked ? "ACCOUNT_LOCKED" : (isSuccess ? "USER_LOGIN" : "LOGIN_FAILED"),
                    EntityName = "UserLogin",
                    EntityID = l.UserID.ToString(),
                    Timestamp = l.LoginTime,
                    IPAddress = l.IPAddress,
                    Details = isSuccess
                        ? $"युजर '{uname}' ने सिस्टीममध्ये यशस्वी लॉगिन केले. (Login Status: {l.Status})"
                        : $"युजर '{uname}' चा लॉगिन प्रयत्न अयशस्वी: {l.Status}",
                    Status = isSuccess ? "Success" : "Failed"
                };
            });

            var combined = dbLogs.Concat(mappedLoginLogs);

            if (!string.IsNullOrWhiteSpace(action))
            {
                var act = action.Trim();
                combined = combined.Where(a => a.Action != null && a.Action.Contains(act, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(username))
            {
                var uname = username.Trim();
                combined = combined.Where(a => a.Username != null && a.Username.Contains(uname, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(entityName))
            {
                var ent = entityName.Trim();
                combined = combined.Where(a => a.EntityName != null && a.EntityName.Contains(ent, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
            {
                var st = status.Trim();
                combined = combined.Where(a => a.Status != null && a.Status.Equals(st, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                combined = combined.Where(a =>
                    (a.Details != null && a.Details.Contains(q, StringComparison.OrdinalIgnoreCase)) ||
                    (a.EntityID != null && a.EntityID.Contains(q, StringComparison.OrdinalIgnoreCase)) ||
                    (a.Action != null && a.Action.Contains(q, StringComparison.OrdinalIgnoreCase)) ||
                    (a.EntityName != null && a.EntityName.Contains(q, StringComparison.OrdinalIgnoreCase)) ||
                    (a.Username != null && a.Username.Contains(q, StringComparison.OrdinalIgnoreCase)) ||
                    (a.IPAddress != null && a.IPAddress.Contains(q, StringComparison.OrdinalIgnoreCase)) ||
                    a.AuditLogID.ToString().Contains(q));
            }

            int skip = (page - 1) * pageSize;
            var result = combined
                .OrderByDescending(a => a.Timestamp)
                .ThenByDescending(a => a.AuditLogID)
                .Skip(skip)
                .Take(pageSize)
                .ToList();

            return Ok(result);
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

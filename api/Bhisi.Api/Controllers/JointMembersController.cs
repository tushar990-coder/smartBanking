using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
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
    public class JointMembersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public JointMembersController(AppDbContext context)
        {
            _context = context;
        }

        private (int userId, string username, int branchId, string role, bool isHeadOfficeAdmin) GetCurrentUserContext()
        {
            int userId = 1;
            string username = "System";
            int branchId = 1;
            string role = "Admin";

            var userClaim = User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("UserID") ?? User.FindFirst("sub");
            if (userClaim != null && int.TryParse(userClaim.Value, out int uid)) userId = uid;

            var nameClaim = User.FindFirst(ClaimTypes.Name) ?? User.FindFirst("Username");
            if (nameClaim != null && !string.IsNullOrWhiteSpace(nameClaim.Value)) username = nameClaim.Value;

            var branchClaim = User.FindFirst("BranchID") ?? User.FindFirst("branchID");
            if (branchClaim != null && int.TryParse(branchClaim.Value, out int bid)) branchId = bid;

            var roleClaim = User.FindFirst(ClaimTypes.Role) ?? User.FindFirst("Role") ?? User.FindFirst("role");
            if (roleClaim != null && !string.IsNullOrWhiteSpace(roleClaim.Value)) role = roleClaim.Value;

            bool isHeadOfficeAdmin = role.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                                     role.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                                     role.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                                     role.Equals("HeadOffice", StringComparison.OrdinalIgnoreCase) ||
                                     role.Equals("Auditor", StringComparison.OrdinalIgnoreCase);

            return (userId, username, branchId, role, isHeadOfficeAdmin);
        }

        private async Task LogAuditAsync(string action, string entityId, string details, string status = "Success")
        {
            try
            {
                var (userId, username, _, _, _) = GetCurrentUserContext();
                var log = new AuditLog
                {
                    UserID = userId,
                    Username = username,
                    Action = action,
                    EntityName = "JointMember",
                    EntityID = entityId,
                    Timestamp = DateTime.Now,
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
                    Details = details,
                    Status = status
                };
                _context.AuditLogs.Add(log);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WARNING] JointMember audit logging failed: {ex.Message}");
            }
        }

        // GET: api/JointMembers/by-member/5
        [HttpGet("by-member/{primaryMemberId}")]
        public async Task<ActionResult<IEnumerable<JointMember>>> GetJointMembersByPrimaryMember(int primaryMemberId)
        {
            var (_, _, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var primaryMember = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == primaryMemberId);
            if (primaryMember == null) return NotFound("Member not found.");

            if (!isHeadOfficeAdmin && primaryMember.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपल्याला इतर शाखेतील सह-सभासदांची माहिती पाहण्याची परवानगी नाही." });
            }

            var list = await _context.JointMembers
                .Where(j => j.PrimaryMemberID == primaryMemberId)
                .OrderBy(j => j.JointMemberID)
                .ToListAsync();

            return Ok(list);
        }

        // GET: api/JointMembers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<JointMember>> GetJointMember(int id)
        {
            var jointMember = await _context.JointMembers.FindAsync(id);
            if (jointMember == null)
            {
                return NotFound();
            }
            return Ok(jointMember);
        }

        // POST: api/JointMembers
        [HttpPost]
        public async Task<ActionResult<JointMember>> PostJointMember(JointMember jointMember)
        {
            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();

            if (jointMember.PrimaryMemberID <= 0)
            {
                return BadRequest(new { message = "प्राथमिक सभासद निवडणे आवश्यक आहे." });
            }

            var primaryMember = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == jointMember.PrimaryMemberID);
            if (primaryMember == null)
            {
                return BadRequest(new { message = "प्राथमिक सभासद अस्तित्वात नाही." });
            }

            if (!isHeadOfficeAdmin && primaryMember.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील सभासदासाठी सह-सभासद जोडू शकता." });
            }

            if (string.IsNullOrWhiteSpace(jointMember.FirstName))
            {
                return BadRequest(new { message = "सह-सभासदाचे पहिले नाव आवश्यक आहे." });
            }
            if (string.IsNullOrWhiteSpace(jointMember.LastName))
            {
                return BadRequest(new { message = "सह-सभासदाचे आडनाव आवश्यक आहे." });
            }

            // Clean & sanitize
            jointMember.MobileNo = string.IsNullOrWhiteSpace(jointMember.MobileNo) ? null : jointMember.MobileNo.Trim();
            jointMember.AadhaarNo = string.IsNullOrWhiteSpace(jointMember.AadhaarNo) ? null : jointMember.AadhaarNo.Trim();
            jointMember.PANNo = string.IsNullOrWhiteSpace(jointMember.PANNo) ? null : jointMember.PANNo.Trim().ToUpper();

            if (!string.IsNullOrWhiteSpace(jointMember.AadhaarNo))
            {
                bool aadhaarExists = await _context.JointMembers.AnyAsync(j => j.AadhaarNo == jointMember.AadhaarNo);
                if (aadhaarExists)
                {
                    return BadRequest(new { message = $"हा आधार नंबर ({jointMember.AadhaarNo}) आधीच दुसऱ्या सह-सभासदाकडे नोंदवला आहे." });
                }
            }

            // Auto-generate JointMemberCode
            int currentCount = await _context.JointMembers.CountAsync(j => j.PrimaryMemberID == jointMember.PrimaryMemberID) + 1;
            jointMember.JointMemberCode = $"{primaryMember.MemberCode ?? primaryMember.CIFNo ?? "MEM"}-J{currentCount}";

            jointMember.CreatedBy = userId;
            jointMember.CreatedOn = DateTime.Now;
            jointMember.IsDeleted = false;

            _context.JointMembers.Add(jointMember);
            await _context.SaveChangesAsync();

            await LogAuditAsync("JOINT_MEMBER_CREATE", jointMember.JointMemberID.ToString(), $"सह-सभासद नोंदणी: {jointMember.FirstName} {jointMember.LastName}, मुख्य सभासद: {primaryMember.FirstName} {primaryMember.LastName}");

            return CreatedAtAction("GetJointMember", new { id = jointMember.JointMemberID }, jointMember);
        }

        // PUT: api/JointMembers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutJointMember(int id, JointMember jointMember)
        {
            if (id != jointMember.JointMemberID)
            {
                return BadRequest(new { message = "JointMember ID mismatch." });
            }

            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var existing = await _context.JointMembers.FindAsync(id);
            if (existing == null)
            {
                return NotFound();
            }

            var primaryMember = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == existing.PrimaryMemberID);
            if (!isHeadOfficeAdmin && primaryMember != null && primaryMember.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील सह-सभासदांची माहिती बदलू शकता." });
            }

            if (string.IsNullOrWhiteSpace(jointMember.FirstName))
            {
                return BadRequest(new { message = "सह-सभासदाचे पहिले नाव आवश्यक आहे." });
            }
            if (string.IsNullOrWhiteSpace(jointMember.LastName))
            {
                return BadRequest(new { message = "सह-सभासदाचे आडनाव आवश्यक आहे." });
            }

            // Clean & sanitize
            jointMember.MobileNo = string.IsNullOrWhiteSpace(jointMember.MobileNo) ? null : jointMember.MobileNo.Trim();
            jointMember.AadhaarNo = string.IsNullOrWhiteSpace(jointMember.AadhaarNo) ? null : jointMember.AadhaarNo.Trim();
            jointMember.PANNo = string.IsNullOrWhiteSpace(jointMember.PANNo) ? null : jointMember.PANNo.Trim().ToUpper();

            if (!string.IsNullOrWhiteSpace(jointMember.AadhaarNo))
            {
                bool aadhaarExists = await _context.JointMembers.AnyAsync(j => j.JointMemberID != id && j.AadhaarNo == jointMember.AadhaarNo);
                if (aadhaarExists)
                {
                    return BadRequest(new { message = $"हा आधार नंबर ({jointMember.AadhaarNo}) आधीच दुसऱ्या सह-सभासदाकडे नोंदवला आहे." });
                }
            }

            existing.FirstName = jointMember.FirstName;
            existing.MiddleName = jointMember.MiddleName;
            existing.LastName = jointMember.LastName;
            existing.FirstNameEng = jointMember.FirstNameEng;
            existing.MiddleNameEng = jointMember.MiddleNameEng;
            existing.LastNameEng = jointMember.LastNameEng;
            existing.RelationWithPrimary = jointMember.RelationWithPrimary;
            existing.AadhaarNo = jointMember.AadhaarNo;
            existing.PANNo = jointMember.PANNo;
            existing.MobileNo = jointMember.MobileNo;
            existing.Address = jointMember.Address;
            existing.PhotoPath = jointMember.PhotoPath;
            existing.SignaturePath = jointMember.SignaturePath;
            existing.Status = jointMember.Status;
            existing.UpdatedBy = userId;
            existing.UpdatedOn = DateTime.Now;

            await _context.SaveChangesAsync();
            await LogAuditAsync("JOINT_MEMBER_UPDATE", id.ToString(), $"सह-सभासद माहिती बदल: {existing.FirstName} {existing.LastName}");

            return NoContent();
        }

        // DELETE: api/JointMembers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteJointMember(int id)
        {
            var (userId, username, userBranchId, _, isHeadOfficeAdmin) = GetCurrentUserContext();
            var jointMember = await _context.JointMembers.FindAsync(id);
            if (jointMember == null)
            {
                return NotFound();
            }

            var primaryMember = await _context.Members.Include(m => m.Customer).FirstOrDefaultAsync(m => m.MemberID == jointMember.PrimaryMemberID);
            if (!isHeadOfficeAdmin && primaryMember != null && primaryMember.BranchID != userBranchId)
            {
                return StatusCode(403, new { message = "आपण केवळ आपल्या शाखेतील सह-सभासद हटवू शकता." });
            }

            _context.JointMembers.Remove(jointMember);
            await _context.SaveChangesAsync();
            await LogAuditAsync("JOINT_MEMBER_DELETE", id.ToString(), $"सह-सभासद कायमचा डिलीट केला: {jointMember.FirstName} {jointMember.LastName}");

            return Ok(new { message = "सह-सभासद यशस्वीरित्या डिलीट केला." });
        }
    }
}

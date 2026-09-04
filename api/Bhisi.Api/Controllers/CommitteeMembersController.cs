using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CommitteeMembersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CommitteeMembersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetCommitteeMembers()
        {
            try
            {
                var today = DateTime.Today;

                var rawMembers = await _context.CommitteeMembers
                    .Include(c => c.Member)
                    .ToListAsync();

                // Fetch loan balances and overdue statuses for all committee members
                var memberIds = rawMembers.Select(c => c.MemberID).Distinct().ToList();
                var loans = await _context.LoanAccounts
                    .Where(l => l.MemberID.HasValue && memberIds.Contains(l.MemberID.Value) && l.Status == "Active")
                    .ToListAsync();

                var loanSummary = loans.GroupBy(l => l.MemberID ?? 0).ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        TotalBalance = g.Sum(x => x.PrincipalBalance + x.InterestBalance + x.OverdueInterestBalance),
                        OverdueAmount = g.Where(x => (x.MaturityDate.HasValue && x.MaturityDate.Value < today) || x.OverdueInterestBalance > 0)
                                         .Sum(x => x.PrincipalBalance + x.InterestBalance + x.OverdueInterestBalance),
                        HasOverdue = g.Any(x => (x.MaturityDate.HasValue && x.MaturityDate.Value < today) || x.OverdueInterestBalance > 0)
                    }
                );

                var result = rawMembers.Select(c =>
                {
                    var summary = (loanSummary != null && loanSummary.ContainsKey(c.MemberID)) ? loanSummary[c.MemberID] : null;

                    return new
                    {
                        c.CommitteeMemberID,
                        c.MemberID,
                        MemberCode = c.Member?.MemberCode ?? "",
                        MemberName = c.Member != null ? $"{c.Member.FirstName} {c.Member.MiddleName} {c.Member.LastName}".Trim() : "",
                        MobileNo = c.Member?.MobileNo ?? "",
                        Designation = c.Designation ?? "",
                        JoiningDate = c.JoiningDate,
                        EndDate = c.EndDate,
                        ResolutionNo = c.ResolutionNo ?? "",
                        Status = c.Status ?? "Active",
                        TermYear = c.TermYear ?? "",
                        Category = c.Category ?? "",
                        DINNo = c.DINNo ?? "",
                        Remarks = c.Remarks ?? "",
                        HasOverdue = summary?.HasOverdue ?? false,
                        TotalLoanBalance = summary?.TotalBalance ?? 0m,
                        OverdueAmount = summary?.OverdueAmount ?? 0m
                    };
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CommitteeMembersController] Error in GetCommitteeMembers: {ex.Message}");
                return Ok(new List<object>());
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CommitteeMember>> GetCommitteeMember(int id)
        {
            var committeeMember = await _context.CommitteeMembers.FindAsync(id);

            if (committeeMember == null)
            {
                return NotFound();
            }

            return committeeMember;
        }

        [HttpPost]
        public async Task<ActionResult<CommitteeMember>> PostCommitteeMember(CommitteeMember committeeMember)
        {
            committeeMember.CreatedOn = DateTime.Now;
            committeeMember.UpdatedOn = DateTime.Now;
            
            _context.CommitteeMembers.Add(committeeMember);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetCommitteeMember", new { id = committeeMember.CommitteeMemberID }, committeeMember);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutCommitteeMember(int id, CommitteeMember committeeMember)
        {
            if (id != committeeMember.CommitteeMemberID)
            {
                return BadRequest();
            }

            committeeMember.UpdatedOn = DateTime.Now;
            _context.Entry(committeeMember).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!CommitteeMemberExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCommitteeMember(int id)
        {
            var committeeMember = await _context.CommitteeMembers.FindAsync(id);
            if (committeeMember == null)
            {
                return NotFound();
            }

            _context.CommitteeMembers.Remove(committeeMember);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool CommitteeMemberExists(int id)
        {
            return _context.CommitteeMembers.Any(e => e.CommitteeMemberID == id);
        }
    }
}

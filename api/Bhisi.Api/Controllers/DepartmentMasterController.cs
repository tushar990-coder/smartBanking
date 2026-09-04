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
    [AllowAnonymous]
    public class DepartmentMasterController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DepartmentMasterController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DepartmentMaster>>> GetDepartmentMasters()
        {
            try
            {
                return await _context.DepartmentMasters.AsNoTracking().ToListAsync();
            }
            catch (Exception ex)
            {
                return Ok(new List<DepartmentMaster>());
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<DepartmentMaster>> GetDepartmentMaster(int id)
        {
            var dept = await _context.DepartmentMasters.FindAsync(id);

            if (dept == null)
            {
                return NotFound();
            }

            return dept;
        }

        [HttpPost]
        public async Task<ActionResult<DepartmentMaster>> PostDepartmentMaster([FromBody] DepartmentMaster dept)
        {
            if (dept == null || string.IsNullOrWhiteSpace(dept.DepartmentName))
            {
                return BadRequest("विभागाचे नाव आवश्यक आहे.");
            }

            dept.DepartmentName = dept.DepartmentName.Trim();

            if (string.IsNullOrWhiteSpace(dept.DepartmentCode))
            {
                var count = await _context.DepartmentMasters.CountAsync();
                dept.DepartmentCode = $"DEPT{(count + 1):D2}";
            }
            else
            {
                dept.DepartmentCode = dept.DepartmentCode.Trim();
            }

            try
            {
                var existing = await _context.DepartmentMasters
                    .FirstOrDefaultAsync(d => d.DepartmentName.ToLower() == dept.DepartmentName.ToLower());

                if (existing != null)
                {
                    return Ok(existing);
                }

                dept.CreatedDate = DateTime.Now;
                dept.Status = true;

                _context.DepartmentMasters.Add(dept);
                await _context.SaveChangesAsync();

                return Ok(dept);
            }
            catch (Exception ex)
            {
                if (dept.DepartmentID <= 0)
                {
                    dept.DepartmentID = new Random().Next(1000, 9999);
                }
                return Ok(dept);
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutDepartmentMaster(int id, DepartmentMaster dept)
        {
            if (id != dept.DepartmentID)
            {
                return BadRequest();
            }

            _context.Entry(dept).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!DepartmentMasterExists(id))
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
        public async Task<IActionResult> DeleteDepartmentMaster(int id)
        {
            var dept = await _context.DepartmentMasters.FindAsync(id);
            if (dept == null)
            {
                return NotFound();
            }

            var isUsed = await _context.EmployeeBankDetails.AnyAsync(e => e.DepartmentID == id);
            if (isUsed)
            {
                return BadRequest("हा विभाग कर्मचाऱ्यांसाठी वापरला गेला आहे, त्यामुळे डिलीट करता येणार नाही.");
            }

            _context.DepartmentMasters.Remove(dept);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool DepartmentMasterExists(int id)
        {
            return _context.DepartmentMasters.Any(e => e.DepartmentID == id);
        }
    }
}

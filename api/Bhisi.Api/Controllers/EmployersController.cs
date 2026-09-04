using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EmployersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EmployersController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Employers
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<IEnumerable<EmployerMaster>>> GetEmployerMasters()
        {
            return await _context.EmployerMasters.ToListAsync();
        }

        // GET: api/Employers/5
        [HttpGet("{id}")]
        public async Task<ActionResult<EmployerMaster>> GetEmployerMaster(int id)
        {
            var employerMaster = await _context.EmployerMasters.FindAsync(id);

            if (employerMaster == null)
            {
                return NotFound();
            }

            return employerMaster;
        }

        // PUT: api/Employers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutEmployerMaster(int id, EmployerMaster employerMaster)
        {
            if (id != employerMaster.Id)
            {
                return BadRequest("आयडी जुळत नाही.");
            }

            if (string.IsNullOrWhiteSpace(employerMaster.Name))
            {
                return BadRequest("संस्था/मालकाचे नाव आवश्यक आहे.");
            }

            // Check for duplicate name
            var isDuplicate = await _context.EmployerMasters
                .AnyAsync(e => e.Id != id && e.Name.Trim().ToLower() == employerMaster.Name.Trim().ToLower());
            if (isDuplicate)
            {
                return BadRequest("या नावाचा संस्था / मालक आधीच नोंदणीकृत आहे.");
            }

            employerMaster.UpdatedAt = DateTime.Now;
            _context.Entry(employerMaster).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!EmployerMasterExists(id))
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

        // POST: api/Employers
        [HttpPost]
        public async Task<ActionResult<EmployerMaster>> PostEmployerMaster(EmployerMaster employerMaster)
        {
            if (string.IsNullOrWhiteSpace(employerMaster.Name))
            {
                return BadRequest("संस्था/मालकाचे नाव आवश्यक आहे.");
            }

            // Check for duplicate name
            var isDuplicate = await _context.EmployerMasters
                .AnyAsync(e => e.Name.Trim().ToLower() == employerMaster.Name.Trim().ToLower());
            if (isDuplicate)
            {
                return BadRequest("या नावाचा संस्था / मालक आधीच नोंदणीकृत आहे.");
            }

            employerMaster.CreatedAt = DateTime.Now;
            _context.EmployerMasters.Add(employerMaster);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetEmployerMaster", new { id = employerMaster.Id }, employerMaster);
        }

        // DELETE: api/Employers/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteEmployerMaster(int id)
        {
            var employer = await _context.EmployerMasters.FindAsync(id);
            if (employer == null)
            {
                return NotFound();
            }

            // Check if members are assigned to this employer
            var isUsedInMembers = await _context.Members.AnyAsync(m => m.EmployerId == id);
            if (isUsedInMembers)
            {
                return BadRequest("या संस्थेशी/मालकाशी सभासद जोडलेले आहेत, त्यामुळे ही संस्था डिलीट करता येणार नाही.");
            }

            _context.EmployerMasters.Remove(employer);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool EmployerMasterExists(int id)
        {
            return _context.EmployerMasters.Any(e => e.Id == id);
        }
    }
}

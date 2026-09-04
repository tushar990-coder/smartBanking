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
    public class SecurityTypesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SecurityTypesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/SecurityTypes
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SecurityType>>> GetSecurityTypes()
        {
            return await _context.SecurityTypes.ToListAsync();
        }

        // GET: api/SecurityTypes/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SecurityType>> GetSecurityType(int id)
        {
            var securityType = await _context.SecurityTypes.FindAsync(id);

            if (securityType == null)
            {
                return NotFound();
            }

            return securityType;
        }

        // PUT: api/SecurityTypes/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSecurityType(int id, SecurityType securityType)
        {
            if (id != securityType.SecurityTypeID)
            {
                return BadRequest();
            }

            _context.Entry(securityType).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!SecurityTypeExists(id))
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

        // POST: api/SecurityTypes
        [HttpPost]
        public async Task<ActionResult<SecurityType>> PostSecurityType(SecurityType securityType)
        {
            _context.SecurityTypes.Add(securityType);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetSecurityType", new { id = securityType.SecurityTypeID }, securityType);
        }

        // DELETE: api/SecurityTypes/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSecurityType(int id)
        {
            var securityType = await _context.SecurityTypes.FindAsync(id);
            if (securityType == null)
            {
                return NotFound();
            }

            _context.SecurityTypes.Remove(securityType);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool SecurityTypeExists(int id)
        {
            return _context.SecurityTypes.Any(e => e.SecurityTypeID == id);
        }
    }
}

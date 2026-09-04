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
    public class AssetCategoriesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AssetCategoriesController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/AssetCategories
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AssetCategory>>> GetAssetCategories([FromQuery] int? branchId)
        {
            var query = _context.AssetCategories.AsQueryable();
            if (branchId.HasValue)
            {
                query = query.Where(c => c.BranchID == branchId.Value);
            }
            return await query.OrderBy(c => c.CategoryName).ToListAsync();
        }

        // GET: api/AssetCategories/5
        [HttpGet("{id}")]
        public async Task<ActionResult<AssetCategory>> GetAssetCategory(int id)
        {
            var category = await _context.AssetCategories.FindAsync(id);
            if (category == null)
            {
                return NotFound();
            }
            return category;
        }

        // POST: api/AssetCategories
        [HttpPost]
        public async Task<ActionResult<AssetCategory>> PostAssetCategory(AssetCategory category)
        {
            category.CreatedOn = DateTime.Now;
            _context.AssetCategories.Add(category);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetAssetCategory", new { id = category.CategoryID }, category);
        }

        // PUT: api/AssetCategories/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutAssetCategory(int id, AssetCategory category)
        {
            if (id != category.CategoryID)
            {
                return BadRequest();
            }

            var existing = await _context.AssetCategories.FindAsync(id);
            if (existing == null)
            {
                return NotFound();
            }

            existing.CategoryCode = category.CategoryCode;
            existing.CategoryName = category.CategoryName;
            existing.UsefulLifeMonths = category.UsefulLifeMonths;
            existing.DepreciationRate = category.DepreciationRate;
            existing.DepreciationMethod = category.DepreciationMethod;
            existing.Status = category.Status;
            existing.UpdatedBy = category.UpdatedBy ?? 1;
            existing.UpdatedOn = DateTime.Now;

            _context.Entry(existing).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!AssetCategoryExists(id))
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

        // DELETE: api/AssetCategories/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAssetCategory(int id)
        {
            var category = await _context.AssetCategories.FindAsync(id);
            if (category == null)
            {
                return NotFound();
            }

            // Check if any assets exist in this category
            var hasAssets = await _context.Assets.AnyAsync(a => a.CategoryID == id);
            if (hasAssets)
            {
                return BadRequest("या वर्गामध्ये मालमत्ता असल्यामुळे हा वर्ग काढता येणार नाही. (Cannot delete category because assets exist in it.)");
            }

            _context.AssetCategories.Remove(category);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool AssetCategoryExists(int id)
        {
            return _context.AssetCategories.Any(e => e.CategoryID == id);
        }
    }
}

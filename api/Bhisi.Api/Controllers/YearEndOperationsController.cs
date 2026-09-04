using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Requires authentication
    public class YearEndOperationsController : ControllerBase
    {
        private readonly IYearEndService _yearEndService;

        public YearEndOperationsController(IYearEndService yearEndService)
        {
            _yearEndService = yearEndService;
        }

        [HttpGet("status/{branchId}")]
        public async Task<IActionResult> GetStatus(int branchId)
        {
            var status = await _yearEndService.GetYearEndStatusAsync(branchId);
            return Ok(status);
        }

        [HttpPost("close/{branchId}")]
        public async Task<IActionResult> CloseYear(int branchId)
        {
            // Usually we extract User ID from JWT token claims
            int userId = 1; // Placeholder
            
            bool success = await _yearEndService.CloseFinancialYearAsync(branchId, userId);
            if (success)
                return Ok(new { Message = "Financial Year closed successfully. Balances carried forward." });
            else
                return BadRequest(new { Message = "Failed to close the financial year. Please check Trial Balance or EOD status." });
        }
    }
}

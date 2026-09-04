using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System.Security.Claims;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    public class UnlockDayRequest
    {
        public string Reason { get; set; } = string.Empty;
    }

    [ApiController]
    [AllowAnonymous]
    [Route("api/[controller]")]
    public class EodOperationsController : ControllerBase
    {
        private readonly IEodBodService _eodBodService;

        public EodOperationsController(IEodBodService eodBodService)
        {
            _eodBodService = eodBodService;
        }

        [HttpGet("status/{branchId}")]
        public async Task<IActionResult> GetStatus(int branchId)
        {
            var status = await _eodBodService.GetEodStatusAsync(branchId);
            return Ok(status);
        }

        [HttpGet("logs/{branchId}")]
        public async Task<IActionResult> GetEodLogs(int branchId, [FromQuery] System.DateTime? businessDate)
        {
            var logs = await _eodBodService.GetEodLogsAsync(branchId, businessDate);
            return Ok(logs);
        }

        [HttpPost("close-day/{branchId}")]
        public async Task<IActionResult> CloseDay(int branchId)
        {
            int userId = 1;
            var claimStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                           ?? User.FindFirst("UserId")?.Value;
            if (int.TryParse(claimStr, out int parsedId)) userId = parsedId;

            var result = await _eodBodService.RunEndOfDayAsync(branchId, userId);
            if (result.IsSuccess)
            {
                return Ok(new { Message = result.Message });
            }
            else
            {
                return BadRequest(new { Message = result.Message });
            }
        }

        [HttpPost("unlock-day/{branchId}")]
        public async Task<IActionResult> UnlockDay(int branchId, [FromBody] UnlockDayRequest request)
        {
            int adminUserId = 1;
            var claimStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                           ?? User.FindFirst("UserId")?.Value;
            if (int.TryParse(claimStr, out int parsedId)) adminUserId = parsedId;

            var reason = request?.Reason ?? "Admin emergency day unlock";
            var result = await _eodBodService.UnlockDayAsync(branchId, adminUserId, reason);
            if (result.IsSuccess)
            {
                return Ok(new { Message = result.Message });
            }
            else
            {
                return BadRequest(new { Message = result.Message });
            }
        }
    }
}

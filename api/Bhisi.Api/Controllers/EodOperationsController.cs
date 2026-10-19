using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System.Security.Claims;
using Bhisi.Api.Services;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    public class UnlockDayRequest
    {
        public string Reason { get; set; } = string.Empty;
    }

    public class CloseDayRequest
    {
        public System.DateTime? NextBusinessDate { get; set; }
    }

    public class InitializeGoLiveDateRequest
    {
        public System.DateTime GoLiveDate { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    [ApiController]
    [Authorize]
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
            int userBranch = User.GetOperatingBranchId();
            if (!User.IsHeadOfficeAdmin() && userBranch != branchId)
            {
                return StatusCode(403, new { Message = "आपल्याला केवळ आपल्या शाखेची Day-End स्थिती पाहण्याची परवानगी आहे." });
            }

            var status = await _eodBodService.GetEodStatusAsync(branchId);
            return Ok(status);
        }

        [HttpGet("logs/{branchId}")]
        public async Task<IActionResult> GetEodLogs(int branchId, [FromQuery] System.DateTime? businessDate)
        {
            int userBranch = User.GetOperatingBranchId();
            if (!User.IsHeadOfficeAdmin() && userBranch != branchId)
            {
                return StatusCode(403, new { Message = "आपल्याला केवळ आपल्या शाखेचे Day-End लॉग्ज पाहण्याची परवानगी आहे." });
            }

            var logs = await _eodBodService.GetEodLogsAsync(branchId, businessDate);
            return Ok(logs);
        }

        [HttpPost("close-day/{branchId}")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager,BranchManager")]
        public async Task<IActionResult> CloseDay(int branchId, [FromBody] CloseDayRequest? request = null)
        {
            int userBranch = User.GetOperatingBranchId();
            if (!User.IsHeadOfficeAdmin() && userBranch != branchId)
            {
                return StatusCode(403, new { Message = "आपल्याला दुसऱ्या शाखेचा Day-End बंद करण्याचा अधिकार नाही." });
            }

            int userId = User.GetUserId();
            if (userId <= 0)
            {
                return Unauthorized(new { Message = "अवैध युझर ओळख (Invalid User Identity)." });
            }

            var result = await _eodBodService.RunEndOfDayAsync(branchId, userId, request?.NextBusinessDate);
            if (result.IsSuccess)
            {
                return Ok(new { Message = result.Message });
            }
            else
            {
                return BadRequest(new { Message = result.Message });
            }
        }

        [HttpPost("initialize-golive-date/{branchId}")]
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice,HO_Manager")]
        public async Task<IActionResult> InitializeGoLiveDate(int branchId, [FromBody] InitializeGoLiveDateRequest request)
        {
            if (request == null || request.GoLiveDate == default)
            {
                return BadRequest(new { Message = "कृपया वैध गो-लाईव्ह तारीख निवडा." });
            }

            int adminUserId = User.GetUserId();
            if (adminUserId <= 0)
            {
                return Unauthorized(new { Message = "अवैध युझर ओळख (Invalid User Identity)." });
            }

            string reason = !string.IsNullOrWhiteSpace(request.Reason) 
                ? request.Reason.Trim() 
                : "नवीन संस्था गो-लाईव्ह तारीख निश्चित केली.";

            var result = await _eodBodService.InitializeGoLiveDateAsync(branchId, request.GoLiveDate, adminUserId, reason);
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
        [Authorize(Roles = "Admin,SuperAdmin,HeadOffice")]
        public async Task<IActionResult> UnlockDay(int branchId, [FromBody] UnlockDayRequest request)
        {
            int adminUserId = User.GetUserId();
            if (adminUserId <= 0)
            {
                return Unauthorized(new { Message = "अवैध युझर ओळख (Invalid User Identity)." });
            }

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

using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SystemUpdateController : ControllerBase
    {
        private readonly ISystemUpdateService _updateService;

        public SystemUpdateController(ISystemUpdateService updateService)
        {
            _updateService = updateService;
        }

        [HttpGet("current-version")]
        [AllowAnonymous]
        public async Task<IActionResult> GetCurrentVersion()
        {
            var result = await _updateService.GetCurrentVersionInfoAsync();
            return Ok(result);
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory()
        {
            var result = await _updateService.GetCurrentVersionInfoAsync();
            return Ok(result.History);
        }

        [HttpGet("check-online")]
        public async Task<IActionResult> CheckOnline()
        {
            var result = await _updateService.CheckOnlineUpdatesAsync();
            return Ok(result);
        }

        [HttpPost("upload-patch")]
        [RequestSizeLimit(524288000)] // 500 MB limit
        public async Task<IActionResult> UploadPatch(IFormFile patchFile)
        {
            if (patchFile == null || patchFile.Length == 0)
            {
                return BadRequest(new { message = "कृपया .zip पॅच फाईल निवडा." });
            }

            var result = await _updateService.StageOfflinePatchAsync(patchFile);
            if (!result.IsValid)
            {
                return BadRequest(new { message = result.ErrorMessage });
            }

            return Ok(result);
        }

        public class DownloadOnlineRequest
        {
            public string DownloadUrl { get; set; } = string.Empty;
        }

        [HttpPost("download-online")]
        public async Task<IActionResult> DownloadOnline([FromBody] DownloadOnlineRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.DownloadUrl))
            {
                return BadRequest(new { message = "डाउनलोड URL आवश्यक आहे." });
            }

            var result = await _updateService.DownloadAndStageOnlinePatchAsync(request.DownloadUrl);
            if (!result.IsValid)
            {
                return BadRequest(new { message = result.ErrorMessage });
            }

            return Ok(result);
        }

        [HttpPost("apply")]
        public async Task<IActionResult> ApplyUpdate()
        {
            string username = User?.Identity?.Name ?? "Admin";
            var result = await _updateService.ApplyStagedUpdateAsync(username);

            if (!result.Success)
            {
                return StatusCode(500, result);
            }

            return Ok(result);
        }
    }
}

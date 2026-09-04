using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Bhisi.Api.Helpers;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Bhisi.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous]
    public class LicenseController : ControllerBase
    {
        private readonly ILicenseService _licenseService;

        public LicenseController(ILicenseService licenseService)
        {
            _licenseService = licenseService;
        }

        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            var status = _licenseService.GetLicenseStatus();
            return Ok(status);
        }

        [HttpGet("machine-code")]
        public IActionResult GetMachineCode()
        {
            string code = _licenseService.GetMachineCode();
            return Ok(new { machineCode = code });
        }

        [HttpPost("activate")]
        public async Task<IActionResult> Activate([FromBody] ActivateLicenseRequest request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.LicenseContent))
            {
                return BadRequest(new { success = false, message = "लायसन्स डेटा आवश्यक आहे." });
            }

            var result = await _licenseService.ActivateLicenseAsync(request.LicenseContent);
            if (result.IsValid)
            {
                return Ok(new { success = true, result });
            }

            return BadRequest(new { success = false, result });
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadLicenseFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { success = false, message = "कृपया वैध license.lic फाईल निवडा." });
            }

            using var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8);
            string content = await reader.ReadToEndAsync();

            var result = await _licenseService.ActivateLicenseAsync(content);
            if (result.IsValid)
            {
                return Ok(new { success = true, result });
            }

            return BadRequest(new { success = false, result });
        }
    }
}

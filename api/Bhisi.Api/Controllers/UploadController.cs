using Bhisi.Api.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Threading.Tasks;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class UploadController : ControllerBase
    {
        // POST: api/Upload
        [HttpPost]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            var (isValid, error, _, apiUrl) = await FileUploadSecurityHelper.SaveValidatedKycFileAsync(file);
            if (!isValid)
            {
                return BadRequest(error);
            }

            return Ok(new
            {
                url = apiUrl,
                filePath = apiUrl,
                path = apiUrl
            });
        }

        // GET: api/Upload/kyc/{fileName}
        // Strict 32-hex-char GUID filename guard + nosniff so browser <img>/<a href> previews work securely
        [AllowAnonymous]
        [HttpGet("kyc/{fileName}")]
        public IActionResult GetKycFile(string fileName)
        {
            var safeName = Path.GetFileName(fileName);
            if (string.IsNullOrWhiteSpace(safeName) ||
                !string.Equals(safeName, fileName, System.StringComparison.Ordinal) ||
                !System.Text.RegularExpressions.Regex.IsMatch(safeName, @"^[0-9a-fA-F]{32}\.(jpg|jpeg|png|webp|pdf)$"))
            {
                return BadRequest("Invalid file name.");
            }

            var folder = FileUploadSecurityHelper.GetPrivateUploadDirectory();
            var fullPath = Path.GetFullPath(Path.Combine(folder, safeName));
            if (!fullPath.StartsWith(Path.GetFullPath(folder), System.StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(fullPath))
            {
                return NotFound("File not found.");
            }

            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "private, max-age=3600";
            return PhysicalFile(fullPath, FileUploadSecurityHelper.GetContentType(safeName));
        }
    }
}

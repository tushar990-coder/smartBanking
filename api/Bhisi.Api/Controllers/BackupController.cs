using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Bhisi.Api.Services;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Requires authentication
    public class BackupController : ControllerBase
    {
        private readonly IBackupService _backupService;

        public BackupController(IBackupService backupService)
        {
            _backupService = backupService;
        }

        [HttpPost("generate")]
        public async Task<IActionResult> GenerateBackup()
        {
            try
            {
                string backupPath = await _backupService.GenerateDatabaseBackupAsync();
                
                // We return the file directly for download
                var memory = new MemoryStream();
                using (var stream = new FileStream(backupPath, FileMode.Open))
                {
                    await stream.CopyToAsync(memory);
                }
                memory.Position = 0;

                string fileName = Path.GetFileName(backupPath);
                return File(memory, "application/octet-stream", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = "Failed to generate database backup.", Error = ex.Message });
            }
        }
    }
}

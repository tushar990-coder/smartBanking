using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LoanDocumentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public LoanDocumentsController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // GET: api/LoanDocuments/ByLoanAccount/5
        [HttpGet("ByLoanAccount/{loanAccountId}")]
        public async Task<ActionResult<IEnumerable<LoanDocument>>> GetDocumentsForLoan(int loanAccountId)
        {
            return await _context.LoanDocuments
                .Where(d => d.LoanAccountID == loanAccountId)
                .ToListAsync();
        }

        // POST: api/LoanDocuments/Upload
        [HttpPost("Upload")]
        public async Task<ActionResult<LoanDocument>> UploadDocument([FromForm] int loanAccountId, [FromForm] string documentType, [FromForm] string documentName, IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("No file uploaded.");
            }

            var loanExists = await _context.LoanAccounts.AnyAsync(l => l.LoanAccountID == loanAccountId);
            if (!loanExists)
            {
                return NotFound("Loan account not found.");
            }

            // Create uploads folder if it doesn't exist
            string uploadsFolder = Path.Combine(_env.WebRootPath ?? _env.ContentRootPath, "uploads", "documents");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            // Generate unique filename
            string uniqueFileName = Guid.NewGuid().ToString() + "_" + file.FileName;
            string filePath = Path.Combine(uploadsFolder, uniqueFileName);

            // Save file
            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            // Save database record
            var doc = new LoanDocument
            {
                LoanAccountID = loanAccountId,
                DocumentType = documentType,
                DocumentName = documentName,
                FilePath = $"/uploads/documents/{uniqueFileName}", // Relative path for frontend
                UploadedDate = DateTime.Today
            };

            _context.LoanDocuments.Add(doc);
            await _context.SaveChangesAsync();

            return Ok(doc);
        }

        // DELETE: api/LoanDocuments/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLoanDocument(int id)
        {
            var doc = await _context.LoanDocuments.FindAsync(id);
            if (doc == null)
            {
                return NotFound();
            }

            // Attempt to delete physical file
            string fullPath = Path.Combine(_env.WebRootPath ?? _env.ContentRootPath, doc.FilePath.TrimStart('/'));
            if (System.IO.File.Exists(fullPath))
            {
                try
                {
                    System.IO.File.Delete(fullPath);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Could not delete file {fullPath}: {ex.Message}");
                }
            }

            _context.LoanDocuments.Remove(doc);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}

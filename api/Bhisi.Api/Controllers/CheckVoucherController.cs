using Microsoft.AspNetCore.Mvc;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;

namespace Bhisi.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CheckVoucherController : ControllerBase
    {
        private readonly AppDbContext _context;
        public CheckVoucherController(AppDbContext context) { _context = context; }

        [HttpGet]
        public IActionResult Get() {
            var v46 = _context.Vouchers.Include(v => v.VoucherDetails).FirstOrDefault(v => v.VoucherID == 46);
            var v58 = _context.Vouchers.Include(v => v.VoucherDetails).FirstOrDefault(v => v.VoucherID == 58);
            var disb48 = _context.LoanDisbursements.Include(d => d.Voucher).FirstOrDefault(d => d.LoanDisbursementID == 48);
            return Ok(new { v46, v58, disb48 });
        }
    }
}

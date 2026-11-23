using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Bhisi.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class GoldCustodyController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        private static readonly HashSet<string> AllowedManualCustodyStatuses = new(StringComparer.OrdinalIgnoreCase)
        {
            "BRANCH_SAFE",
            "OWN_LOCKER",
            "EXTERNAL_LOCKER"
        };

        public GoldCustodyController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        private int ResolveUserId()
        {
            var val = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User?.FindFirst("UserID")?.Value;
            return int.TryParse(val, out int id) && id > 0 ? id : 1;
        }

        // GET: api/GoldCustody/masters
        [HttpGet("masters")]
        public async Task<ActionResult<object>> GetCustodyMasters([FromQuery] int? branchId = null)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(branchId);

            var ownLockersQuery = _context.Lockers
                .AsNoTracking()
                .Include(l => l.LockerType)
                .Where(l => l.IsActive);

            var extLockersQuery = _context.SansthaExternalLockers
                .AsNoTracking()
                .Where(e => e.IsActive);

            if (resolvedBranch.HasValue && resolvedBranch.Value > 0)
            {
                ownLockersQuery = ownLockersQuery.Where(l => l.BranchID == resolvedBranch.Value);
                extLockersQuery = extLockersQuery.Where(e => e.BranchID == resolvedBranch.Value);
            }

            var ownLockers = await ownLockersQuery
                .OrderBy(l => l.CabinetNo)
                .ThenBy(l => l.LockerNo)
                .Select(l => new
                {
                    l.LockerID,
                    l.BranchID,
                    l.CabinetNo,
                    l.LockerNo,
                    l.KeyNo,
                    l.Status,
                    TypeName = l.LockerType != null ? l.LockerType.TypeName : ""
                })
                .ToListAsync();

            var externalLockers = await extLockersQuery
                .OrderBy(e => e.BankOrSocietyName)
                .ThenBy(e => e.LockerNo)
                .ToListAsync();

            var institutions = await _context.InvestmentInstitutions
                .AsNoTracking()
                .Where(i => i.IsActive)
                .OrderBy(i => i.InstitutionName)
                .Select(i => new
                {
                    i.InstitutionID,
                    i.InstitutionName,
                    i.InstitutionType,
                    i.InstitutionBranchName
                })
                .ToListAsync();

            return Ok(new { ownLockers, externalLockers, institutions });
        }

        // GET: api/GoldCustody/external-lockers
        [HttpGet("external-lockers")]
        public async Task<ActionResult<IEnumerable<SansthaExternalLocker>>> GetExternalLockers([FromQuery] int? branchId = null)
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(branchId);
            var query = _context.SansthaExternalLockers.AsNoTracking().AsQueryable();
            if (resolvedBranch.HasValue && resolvedBranch.Value > 0)
            {
                query = query.Where(e => e.BranchID == resolvedBranch.Value);
            }
            return await query.OrderByDescending(e => e.IsActive).ThenBy(e => e.BankOrSocietyName).ToListAsync();
        }

        // POST: api/GoldCustody/external-lockers
        [HttpPost("external-lockers")]
        public async Task<ActionResult<SansthaExternalLocker>> CreateExternalLocker([FromBody] SaveExternalLockerDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.BankOrSocietyName) || string.IsNullOrWhiteSpace(dto.LockerNo))
            {
                return BadRequest("बँक/पतसंस्थेचे नाव आणि लॉकर क्रमांक भरणे आवश्यक आहे.");
            }

            int effectiveBranchId = User.ResolveBranchId(dto.BranchID > 0 ? dto.BranchID : 1);

            var entity = new SansthaExternalLocker
            {
                BranchID = effectiveBranchId,
                InstitutionID = dto.InstitutionID > 0 ? dto.InstitutionID : null,
                BankOrSocietyName = dto.BankOrSocietyName.Trim(),
                BankBranchName = dto.BankBranchName?.Trim(),
                LockerNo = dto.LockerNo.Trim(),
                CabinetOrBoxNo = dto.CabinetOrBoxNo?.Trim(),
                KeyNo = dto.KeyNo?.Trim(),
                AnnualRentAmount = Math.Max(0m, dto.AnnualRentAmount),
                AgreementStartDate = dto.AgreementStartDate,
                AgreementExpiryDate = dto.AgreementExpiryDate,
                AuthorizedSignatories = dto.AuthorizedSignatories?.Trim(),
                Remarks = dto.Remarks?.Trim(),
                IsActive = true,
                CreatedBy = ResolveUserId(),
                CreatedAt = DateTime.UtcNow
            };

            _context.SansthaExternalLockers.Add(entity);
            await _context.SaveChangesAsync();
            return Ok(entity);
        }

        // PUT: api/GoldCustody/external-lockers/{id}
        [HttpPut("external-lockers/{id}")]
        public async Task<ActionResult<SansthaExternalLocker>> UpdateExternalLocker(int id, [FromBody] SaveExternalLockerDto dto)
        {
            var entity = await _context.SansthaExternalLockers.FindAsync(id);
            if (entity == null) return NotFound("बाह्य लॉकर सापडले नाही.");

            if (string.IsNullOrWhiteSpace(dto.BankOrSocietyName) || string.IsNullOrWhiteSpace(dto.LockerNo))
            {
                return BadRequest("बँक/पतसंस्थेचे नाव आणि लॉकर क्रमांक आवश्यक आहे.");
            }

            entity.InstitutionID = dto.InstitutionID > 0 ? dto.InstitutionID : null;
            entity.BankOrSocietyName = dto.BankOrSocietyName.Trim();
            entity.BankBranchName = dto.BankBranchName?.Trim();
            entity.LockerNo = dto.LockerNo.Trim();
            entity.CabinetOrBoxNo = dto.CabinetOrBoxNo?.Trim();
            entity.KeyNo = dto.KeyNo?.Trim();
            entity.AnnualRentAmount = Math.Max(0m, dto.AnnualRentAmount);
            entity.AgreementStartDate = dto.AgreementStartDate;
            entity.AgreementExpiryDate = dto.AgreementExpiryDate;
            entity.AuthorizedSignatories = dto.AuthorizedSignatories?.Trim();
            entity.Remarks = dto.Remarks?.Trim();
            entity.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();
            return Ok(entity);
        }

        // GET: api/GoldCustody/accounts
        [HttpGet("accounts")]
        public async Task<ActionResult<IEnumerable<object>>> GetLoanAccountsWithCollateralMeta(
            [FromQuery] int? branchId = null,
            [FromQuery] string? filter = "all")
        {
            int? resolvedBranch = User.ResolveOptionalBranchId(branchId);

            var loansQuery = _context.LoanAccounts
                .AsNoTracking()
                .Include(l => l.Customer)
                .Include(l => l.Member)
                    .ThenInclude(m => m!.Customer)
                .Include(l => l.LoanRate)
                .AsQueryable();

            if (resolvedBranch.HasValue && resolvedBranch.Value > 0)
            {
                loansQuery = loansQuery.Where(l => l.BranchID == resolvedBranch.Value);
            }

            var loans = await loansQuery
                .OrderByDescending(l => l.LoanAccountID)
                .ToListAsync();

            var loanIds = loans.Select(l => l.LoanAccountID).ToList();
            var goldAccIds = (await _context.GoldLoanDetails
                .AsNoTracking()
                .Where(g => g.LoanAccountID.HasValue && loanIds.Contains(g.LoanAccountID.Value))
                .Select(g => g.LoanAccountID!.Value)
                .Distinct()
                .ToListAsync()).ToHashSet();

            var custodies = await _context.GoldLoanCustodies
                .AsNoTracking()
                .Include(c => c.OwnLocker)
                .Include(c => c.ExternalLocker)
                .Include(c => c.ActiveBorrowing)
                .Where(c => loanIds.Contains(c.LoanAccountID))
                .ToDictionaryAsync(c => c.LoanAccountID);

            var docCounts = await _context.LoanDocuments
                .AsNoTracking()
                .Where(d => loanIds.Contains(d.LoanAccountID))
                .GroupBy(d => d.LoanAccountID)
                .Select(g => new { LoanAccountID = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.LoanAccountID, x => x.Count);

            string normFilter = (filter ?? "all").Trim().ToLowerInvariant();

            var result = new List<object>();
            foreach (var l in loans)
            {
                bool isGold = GoldCustodyAndBorrowingHelper.IsGoldLoanAccount(l, l.LoanRate, null, goldAccIds.Contains(l.LoanAccountID));
                custodies.TryGetValue(l.LoanAccountID, out var cust);

                bool isClosed = string.Equals(l.Status, "Closed", StringComparison.OrdinalIgnoreCase)
                             || string.Equals(l.Status, "Closed_OTS", StringComparison.OrdinalIgnoreCase)
                             || l.PrincipalBalance <= 0m;

                bool isPendingRelease = isGold && isClosed && cust?.CustodyStatus != "RELEASED_TO_CUSTOMER";

                if (normFilter == "active" && isClosed && !isPendingRelease) continue;
                if (normFilter == "gold" && !isGold) continue;
                if (normFilter == "pending-release" && !isPendingRelease) continue;

                var c = l.Customer ?? l.Member?.Customer;
                string borrowerName = c != null
                    ? $"{c.FirstName} {c.MiddleName} {c.LastName}".Replace("  ", " ").Trim()
                    : (l.Member?.MemberCode ?? $"खाते #{l.LoanAccountNo}");

                result.Add(new
                {
                    l.LoanAccountID,
                    LoanAccountNo = l.LoanAccountNo ?? l.LoanAccountID.ToString(),
                    l.BranchID,
                    BorrowerName = borrowerName,
                    CifNo = c?.CIFNo ?? "",
                    MobileNo = c?.MobileNo ?? "",
                    SchemeName = l.LoanRate?.ShortName ?? l.LoanRate?.LoanType ?? "कर्ज",
                    l.Status,
                    l.SanctionedAmount,
                    l.PrincipalBalance,
                    IsGoldLoan = isGold,
                    IsPendingGoldRelease = isPendingRelease,
                    PacketNumber = cust?.PacketNumber ?? "",
                    CustodyStatus = cust?.CustodyStatus ?? (isGold ? "BRANCH_SAFE" : "NONE"),
                    CustodyLocationDisplay = isGold ? GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(cust) : "",
                    DocumentCount = docCounts.GetValueOrDefault(l.LoanAccountID, 0)
                });
            }

            return Ok(result);
        }

        // GET: api/GoldCustody/by-loan/{loanAccountId}
        [HttpGet("by-loan/{loanAccountId}")]
        public async Task<ActionResult<object>> GetCustodyByLoanAccount(int loanAccountId)
        {
            var loan = await _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                    .ThenInclude(m => m!.Customer)
                .Include(l => l.LoanRate)
                .Include(l => l.LoanApplication)
                .Include(l => l.Branch)
                .FirstOrDefaultAsync(l => l.LoanAccountID == loanAccountId);

            if (loan == null)
            {
                return NotFound("कर्ज खाते सापडले नाही.");
            }

            var ornaments = await _context.GoldLoanDetails
                .AsNoTracking()
                .Where(g => g.LoanAccountID == loanAccountId ||
                            (loan.LoanApplicationID.HasValue && g.LoanApplicationID == loan.LoanApplicationID.Value))
                .OrderBy(g => g.GoldLoanDetailID)
                .ToListAsync();

            bool isGoldLoan = GoldCustodyAndBorrowingHelper.IsGoldLoanAccount(loan, loan.LoanRate, loan.LoanApplication, ornaments.Any());

            GoldLoanCustody? custody = null;
            if (isGoldLoan)
            {
                custody = await _context.GoldLoanCustodies
                    .Include(c => c.OwnLocker)
                    .Include(c => c.ExternalLocker)
                    .Include(c => c.ActiveBorrowing)
                    .FirstOrDefaultAsync(c => c.LoanAccountID == loanAccountId);

                if (custody == null)
                {
                    await GoldCustodyAndBorrowingHelper.EnsureOrSyncGoldCustodyAsync(_context, loan, ResolveUserId());
                    custody = await _context.GoldLoanCustodies
                        .AsNoTracking()
                        .Include(c => c.OwnLocker)
                        .Include(c => c.ExternalLocker)
                        .Include(c => c.ActiveBorrowing)
                        .FirstOrDefaultAsync(c => c.LoanAccountID == loanAccountId);
                }
            }

            var collectionsWithVouchers = await _context.LoanCollections
                .AsNoTracking()
                .Where(c => c.LoanAccountID == loanAccountId && c.VoucherID.HasValue)
                .Join(_context.Vouchers.AsNoTracking(),
                      lc => lc.VoucherID!.Value,
                      v => v.VoucherID,
                      (lc, v) => v.Status)
                .ToListAsync();

            int pendingCollectionVouchers = collectionsWithVouchers.Count(s => string.Equals(s, "Pending", StringComparison.OrdinalIgnoreCase));

            bool isZeroBalance = loan.PrincipalBalance <= 0.009m
                              && loan.InterestBalance <= 0.009m
                              && loan.OverdueInterestBalance <= 0.009m;

            object? activePledgeInfo = null;
            if (custody != null && custody.ActiveBorrowingID.HasValue)
            {
                var pledge = await _context.SansthaBorrowingGoldPledges
                    .AsNoTracking()
                    .Include(p => p.Borrowing)
                    .Where(p => p.LoanAccountID == loanAccountId && p.PledgeStatus == "Pledged")
                    .OrderByDescending(p => p.BorrowingGoldPledgeID)
                    .FirstOrDefaultAsync();

                if (pledge?.Borrowing != null)
                {
                    activePledgeInfo = new
                    {
                        pledge.BorrowingID,
                        pledge.Borrowing.BorrowingNo,
                        pledge.Borrowing.LenderName,
                        pledge.Borrowing.LenderBranchName,
                        pledge.Borrowing.ExternalLoanAccountNo,
                        pledge.Borrowing.BorrowingInterestRate,
                        pledge.CustomerLoanInterestRate,
                        pledge.InterestSpreadPercent,
                        pledge.AllocatedBorrowedAmount,
                        pledge.LenderPledgeReceiptNo,
                        pledge.PledgedDate,
                        pledge.Borrowing.OutstandingPrincipal
                    };
                }
            }

            var movementLogs = custody != null
                ? await _context.GoldCustodyMovementLogs
                    .AsNoTracking()
                    .Where(m => m.GoldCustodyID == custody.GoldCustodyID)
                    .OrderByDescending(m => m.MovementDate)
                    .ThenByDescending(m => m.MovementLogID)
                    .ToListAsync()
                : new List<GoldCustodyMovementLog>();

            var cust = loan.Customer ?? loan.Member?.Customer;
            string borrowerName = cust != null
                ? $"{cust.FirstName} {cust.MiddleName} {cust.LastName}".Replace("  ", " ").Trim()
                : (loan.Member?.MemberCode ?? "");

            return Ok(new
            {
                isGoldLoan,
                loanSummary = new
                {
                    loan.LoanAccountID,
                    LoanAccountNo = loan.LoanAccountNo ?? "",
                    loan.BranchID,
                    BranchName = loan.Branch?.BranchName ?? "मुख्य शाखा",
                    BorrowerName = borrowerName,
                    CifNo = cust?.CIFNo ?? "",
                    MobileNo = cust?.MobileNo ?? "",
                    Address = cust?.Address ?? "",
                    SchemeName = loan.LoanRate?.ShortName ?? loan.LoanRate?.LoanType ?? "कर्ज",
                    loan.InterestRate,
                    loan.SanctionedAmount,
                    loan.PrincipalBalance,
                    loan.InterestBalance,
                    loan.OverdueInterestBalance,
                    loan.Status,
                    loan.OpeningDate,
                    loan.LoanDisbursementDate,
                    IsZeroBalance = isZeroBalance,
                    PendingCollectionVouchers = pendingCollectionVouchers,
                    CanReleaseToCustomer = isGoldLoan
                        && isZeroBalance
                        && pendingCollectionVouchers == 0
                        && custody != null
                        && custody.CustodyStatus != "REPLEDGED_BORROWING"
                        && custody.CustodyStatus != "RELEASED_TO_CUSTOMER"
                },
                ornaments,
                custody,
                custodyLocationDisplay = isGoldLoan ? GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody) : "",
                activePledge = activePledgeInfo,
                movementLogs
            });
        }

        // POST: api/GoldCustody/assign-location
        [HttpPost("assign-location")]
        public async Task<ActionResult<object>> AssignCustodyLocation([FromBody] AssignGoldCustodyLocationDto dto)
        {
            if (dto == null || dto.LoanAccountID <= 0)
            {
                return BadRequest("वैध कर्ज खाते निवडा.");
            }

            string targetStatus = (dto.CustodyStatus ?? string.Empty).Trim().ToUpperInvariant();
            if (!AllowedManualCustodyStatuses.Contains(targetStatus))
            {
                return BadRequest("कृपया वैध ठिकाण प्रकार (शाखा तिजोरी / संस्था लॉकर / बाह्य बँक लॉकर) निवडा.");
            }

            var loan = await _context.LoanAccounts
                .Include(l => l.LoanRate)
                .Include(l => l.LoanApplication)
                .FirstOrDefaultAsync(l => l.LoanAccountID == dto.LoanAccountID);

            if (loan == null) return NotFound("कर्ज खाते सापडले नाही.");

            var custody = await GoldCustodyAndBorrowingHelper.EnsureOrSyncGoldCustodyAsync(
                _context, loan, ResolveUserId(), dto.MovementDate);

            if (string.Equals(custody.CustodyStatus, "REPLEDGED_BORROWING", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("हे सोने पाकीट सध्या बाह्य कर्जात पुनर्गहाण (Re-pledged) आहे! ठिकाण बदलण्यापूर्वी बाह्य कर्ज विभागातून पाकीट सोडवून घ्या.");
            }

            if (string.Equals(custody.CustodyStatus, "RELEASED_TO_CUSTOMER", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("हे दागिने आधीच खातेदारास सुपूर्द केलेले असल्याने ठिकाण बदलता येत नाही.");
            }

            Locker? ownLocker = null;
            SansthaExternalLocker? extLocker = null;

            if (targetStatus == "OWN_LOCKER")
            {
                if (!dto.OwnLockerID.HasValue || dto.OwnLockerID.Value <= 0)
                    return BadRequest("कृपया संस्थेचे लॉकर निवडा.");
                ownLocker = await _context.Lockers.AsNoTracking().FirstOrDefaultAsync(l => l.LockerID == dto.OwnLockerID.Value && l.IsActive);
                if (ownLocker == null)
                    return BadRequest("निवडलेले संस्था लॉकर सक्रिय नाही किंवा सापडले नाही.");
            }
            else if (targetStatus == "EXTERNAL_LOCKER")
            {
                if (!dto.ExternalLockerID.HasValue || dto.ExternalLockerID.Value <= 0)
                    return BadRequest("कृपया इतर बँक / पतसंस्थेतील भाड्याचे लॉकर निवडा.");
                extLocker = await _context.SansthaExternalLockers.AsNoTracking().FirstOrDefaultAsync(e => e.ExternalLockerID == dto.ExternalLockerID.Value && e.IsActive);
                if (extLocker == null)
                    return BadRequest("निवडलेले बाह्य बँक लॉकर सक्रिय नाही किंवा सापडले नाही.");
            }

            await _context.Entry(custody).Reference(c => c.OwnLocker).LoadAsync();
            await _context.Entry(custody).Reference(c => c.ExternalLocker).LoadAsync();
            string prevStatus = custody.CustodyStatus;
            string prevSummary = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody);

            if (!string.IsNullOrWhiteSpace(dto.PacketNumber))
            {
                custody.PacketNumber = dto.PacketNumber.Trim();
            }
            custody.SealNumber = string.IsNullOrWhiteSpace(dto.SealNumber) ? custody.SealNumber : dto.SealNumber.Trim();
            custody.CustodyStatus = targetStatus;
            custody.VaultRackOrTrayNo = targetStatus == "BRANCH_SAFE"
                ? (string.IsNullOrWhiteSpace(dto.VaultRackOrTrayNo) ? "मुख्य तिजोरी" : dto.VaultRackOrTrayNo.Trim())
                : null;
            custody.OwnLockerID = targetStatus == "OWN_LOCKER" ? dto.OwnLockerID : null;
            custody.ExternalLockerID = targetStatus == "EXTERNAL_LOCKER" ? dto.ExternalLockerID : null;
            custody.LastLocationUpdatedDate = (dto.MovementDate ?? DateTime.Today).Date;
            custody.Remarks = string.IsNullOrWhiteSpace(dto.Remarks) ? custody.Remarks : dto.Remarks.Trim();
            custody.UpdatedAt = DateTime.UtcNow;

            string newSummary = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody, ownLocker, extLocker, null);

            _context.GoldCustodyMovementLogs.Add(new GoldCustodyMovementLog
            {
                GoldCustodyID = custody.GoldCustodyID,
                LoanAccountID = loan.LoanAccountID,
                FromStatus = prevStatus,
                ToStatus = targetStatus,
                FromLocationSummary = prevSummary,
                ToLocationSummary = newSummary,
                MovementDate = (dto.MovementDate ?? DateTime.Today).Date,
                MovedByUserID = ResolveUserId(),
                Remarks = dto.Remarks?.Trim() ?? "कस्टडी ठिकाण अद्यतनित"
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"दागिने पाकीट '{custody.PacketNumber}' चे ठिकाण यशस्वीरीत्या जतन झाले: {newSummary}",
                custody,
                custodyLocationDisplay = newSummary
            });
        }

        // POST: api/GoldCustody/release-to-customer
        [HttpPost("release-to-customer")]
        public async Task<ActionResult<object>> ReleaseGoldToCustomer([FromBody] ReleaseGoldToCustomerDto dto)
        {
            if (dto == null || dto.LoanAccountID <= 0)
                return BadRequest("वैध कर्ज खाते निवडा.");

            if (string.IsNullOrWhiteSpace(dto.ReleasedToName))
                return BadRequest("दागिने स्वीकारणाऱ्या व्यक्तीचे नाव भरणे आवश्यक आहे.");

            var loan = await _context.LoanAccounts
                .Include(l => l.Customer)
                .Include(l => l.Member)
                    .ThenInclude(m => m!.Customer)
                .FirstOrDefaultAsync(l => l.LoanAccountID == dto.LoanAccountID);

            if (loan == null) return NotFound("कर्ज खाते सापडले नाही.");

            var custody = await _context.GoldLoanCustodies
                .Include(c => c.OwnLocker)
                .Include(c => c.ExternalLocker)
                .Include(c => c.ActiveBorrowing)
                .FirstOrDefaultAsync(c => c.LoanAccountID == dto.LoanAccountID);

            if (custody == null)
            {
                custody = await GoldCustodyAndBorrowingHelper.EnsureOrSyncGoldCustodyAsync(_context, loan, ResolveUserId(), dto.ReleaseDate);
            }

            if (string.Equals(custody.CustodyStatus, "RELEASED_TO_CUSTOMER", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest($"हे दागिने पाकीट आधीच दिनांक {custody.ReleasedDate:dd/MM/yyyy} रोजी सुपूर्द केलेले आहे (पावती क्र.: {custody.ReleaseReceiptNo}).");
            }

            if (string.Equals(custody.CustodyStatus, "REPLEDGED_BORROWING", StringComparison.OrdinalIgnoreCase))
            {
                string lender = custody.ActiveBorrowing?.LenderName ?? "बाह्य संस्था";
                string brwNo = custody.ActiveBorrowing?.BorrowingNo ?? $"#{custody.ActiveBorrowingID}";
                return BadRequest($"⛔ हे सोने पाकीट सध्या '{lender}' कडे बाह्य कर्ज क्र. '{brwNo}' खाली पुनर्गहाण (Re-pledged) आहे! आधी बाह्य कर्ज विभागात जाऊन हे पाकीट सोडवून (Unpledge) संस्थेच्या तिजोरीत घ्या, त्यानंतरच खातेदारास सुपूर्द करता येईल.");
            }

            if (loan.PrincipalBalance > 0.009m || loan.InterestBalance > 0.009m || loan.OverdueInterestBalance > 0.009m)
            {
                return BadRequest($"कर्जाची संपूर्ण बाकी शून्य नाही (मुद्दल बाकी: ₹{loan.PrincipalBalance:N2}, व्याज बाकी: ₹{loan.InterestBalance + loan.OverdueInterestBalance:N2}). पूर्ण कर्ज वसुलीनंतरच दागिने सुपूर्द करता येतात.");
            }

            bool hasPendingCollectionVoucher = await _context.LoanCollections
                .AsNoTracking()
                .Where(c => c.LoanAccountID == loan.LoanAccountID && c.VoucherID.HasValue)
                .Join(_context.Vouchers.AsNoTracking(),
                      lc => lc.VoucherID!.Value,
                      v => v.VoucherID,
                      (lc, v) => v.Status)
                .AnyAsync(st => st == "Pending");

            if (hasPendingCollectionVoucher)
            {
                return BadRequest("या कर्जाच्या वसुली पावतीचे व्हाउचर अद्याप प्रलंबित (Pending Passing) आहे. आधी चेकरकडून व्हाउचर पास करा.");
            }

            DateTime relDate = (dto.ReleaseDate ?? DateTime.Today).Date;
            string prevStatus = custody.CustodyStatus;
            string prevSummary = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody);

            int relCount = await _context.GoldLoanCustodies.CountAsync(c => c.CustodyStatus == "RELEASED_TO_CUSTOMER");
            string receiptNo = $"GRL-{loan.BranchID}-{relDate.Year}-{(relCount + 1):D4}";

            string? savedDocPath = null;
            if (!string.IsNullOrWhiteSpace(dto.AcknowledgementBase64Image) && dto.AcknowledgementBase64Image.Contains("base64,"))
            {
                string uploadsFolder = Path.Combine(_env.WebRootPath ?? _env.ContentRootPath, "uploads", "documents");
                if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);
                string base64Part = dto.AcknowledgementBase64Image.Split("base64,")[1];
                byte[] bytes = Convert.FromBase64String(base64Part);
                string fileName = $"gold_release_{loan.LoanAccountID}_{Guid.NewGuid():N}.jpg";
                await System.IO.File.WriteAllBytesAsync(Path.Combine(uploadsFolder, fileName), bytes);
                savedDocPath = $"/uploads/documents/{fileName}";

                _context.LoanDocuments.Add(new LoanDocument
                {
                    LoanAccountID = loan.LoanAccountID,
                    DocumentType = "दागिने परत सुपूर्दगी पावती (Gold Release Acknowledgement)",
                    DocumentName = $"पावती क्र. {receiptNo} - {dto.ReleasedToName.Trim()}",
                    FilePath = savedDocPath,
                    UploadedDate = relDate
                });
            }

            var lastCollectionId = await _context.LoanCollections
                .AsNoTracking()
                .Where(c => c.LoanAccountID == loan.LoanAccountID)
                .OrderByDescending(c => c.LoanCollectionID)
                .Select(c => (int?)c.LoanCollectionID)
                .FirstOrDefaultAsync();

            custody.CustodyStatus = "RELEASED_TO_CUSTOMER";
            custody.OwnLockerID = null;
            custody.ExternalLockerID = null;
            custody.VaultRackOrTrayNo = null;
            custody.ReleasedDate = relDate;
            custody.ReleasedToName = dto.ReleasedToName.Trim();
            custody.ReleasedToRelation = string.IsNullOrWhiteSpace(dto.ReleasedToRelation) ? "स्वतः कर्जदार (Self)" : dto.ReleasedToRelation.Trim();
            custody.ReceiverMobile = dto.ReceiverMobile?.Trim();
            custody.ReceiverIdProof = dto.ReceiverIdProof?.Trim();
            custody.ReleaseReceiptNo = receiptNo;
            custody.ReleasePhotoOrDocPath = savedDocPath;
            custody.SettlementCollectionID = dto.SettlementCollectionID ?? lastCollectionId;
            custody.ReleasedByUserID = ResolveUserId();
            custody.LastLocationUpdatedDate = relDate;
            custody.UpdatedAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(dto.Remarks))
            {
                custody.Remarks = dto.Remarks.Trim();
            }

            string newSummary = GoldCustodyAndBorrowingHelper.FormatCustodyLocationSummary(custody);

            _context.GoldCustodyMovementLogs.Add(new GoldCustodyMovementLog
            {
                GoldCustodyID = custody.GoldCustodyID,
                LoanAccountID = loan.LoanAccountID,
                FromStatus = prevStatus,
                ToStatus = "RELEASED_TO_CUSTOMER",
                FromLocationSummary = prevSummary,
                ToLocationSummary = newSummary,
                MovementDate = relDate,
                MovedByUserID = ResolveUserId(),
                Remarks = $"खातेदारास दागिने सुपूर्द — स्वीकारणार: {custody.ReleasedToName} ({custody.ReleasedToRelation}), पावती: {receiptNo}"
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"दागिने पाकीट '{custody.PacketNumber}' खातेदारास यशस्वीरीत्या सुपूर्द झाले! पावती क्र.: {receiptNo}",
                releaseReceiptNo = receiptNo,
                custody,
                custodyLocationDisplay = newSummary
            });
        }
    }

    public class SaveExternalLockerDto
    {
        public int BranchID { get; set; } = 1;
        public int? InstitutionID { get; set; }
        public string BankOrSocietyName { get; set; } = string.Empty;
        public string? BankBranchName { get; set; }
        public string LockerNo { get; set; } = string.Empty;
        public string? CabinetOrBoxNo { get; set; }
        public string? KeyNo { get; set; }
        public decimal AnnualRentAmount { get; set; }
        public DateTime? AgreementStartDate { get; set; }
        public DateTime? AgreementExpiryDate { get; set; }
        public string? AuthorizedSignatories { get; set; }
        public string? Remarks { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class AssignGoldCustodyLocationDto
    {
        public int LoanAccountID { get; set; }
        public string? PacketNumber { get; set; }
        public string? SealNumber { get; set; }
        public string CustodyStatus { get; set; } = "BRANCH_SAFE";
        public string? VaultRackOrTrayNo { get; set; }
        public int? OwnLockerID { get; set; }
        public int? ExternalLockerID { get; set; }
        public DateTime? MovementDate { get; set; }
        public string? Remarks { get; set; }
    }

    public class ReleaseGoldToCustomerDto
    {
        public int LoanAccountID { get; set; }
        public DateTime? ReleaseDate { get; set; }
        public string ReleasedToName { get; set; } = string.Empty;
        public string? ReleasedToRelation { get; set; }
        public string? ReceiverMobile { get; set; }
        public string? ReceiverIdProof { get; set; }
        public int? SettlementCollectionID { get; set; }
        public string? AcknowledgementBase64Image { get; set; }
        public string? Remarks { get; set; }
    }
}

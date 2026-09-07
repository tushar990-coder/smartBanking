using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PigmyAppController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PigmyAppController(AppDbContext context)
        {
            _context = context;
        }

        public class LoginRequest
        {
            [Required]
            public string MobileNo { get; set; } = string.Empty;
        }

        // POST: api/PigmyApp/Login (UNTOUCHED)
        [HttpPost("Login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.MobileNo == request.MobileNo && a.Status == "Active");
            if (agent == null)
            {
                return Unauthorized("Invalid Mobile Number or Inactive Agent.");
            }

            // In a real production scenario, generate and return a JWT here.
            // For now, return a secure payload with AgentId to use as token header.
            return Ok(new
            {
                agentId = agent.PigmyAgentID,
                agentName = agent.AgentName,
                mobileNo = agent.MobileNo,
                token = $"temp-token-agent-{agent.PigmyAgentID}"
            });
        }

        // GET: api/PigmyApp/Dashboard (UNTOUCHED)
        [HttpGet("Dashboard")]
        public async Task<IActionResult> GetDashboard([FromHeader(Name = "X-Agent-Id")] int agentId)
        {
            if (agentId <= 0) return Unauthorized("Missing X-Agent-Id header");

            var today = DateTime.Today;

            // Today's Collection
            var todaysCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate >= today && c.CollectionDate < today.AddDays(1))
                .ToListAsync();

            var todaysCollectionAmount = todaysCollections.Sum(c => c.CollectionAmount);
            var totalReceipts = todaysCollections.Count;

            var allCollections = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate < today)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            var historicalDeposits = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate < today)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            var openingBalance = allCollections - historicalDeposits;
            var closingBalance = openingBalance + todaysCollectionAmount;

            return Ok(new
            {
                date = today.ToString("yyyy-MM-dd"),
                openingBalance = openingBalance,
                todaysCollection = todaysCollectionAmount,
                totalReceipts = totalReceipts,
                closingBalance = closingBalance
            });
        }

        // GET: api/PigmyApp/Accounts (UNTOUCHED)
        [HttpGet("Accounts")]
        public async Task<IActionResult> GetAssignedAccounts([FromHeader(Name = "X-Agent-Id")] int agentId)
        {
            if (agentId <= 0) return Unauthorized("Missing X-Agent-Id header");

            var accounts = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Where(a => a.PigmyAgentID == agentId && a.Status == "Active")
                .Select(a => new
                {
                    a.PigmyAccountID,
                    a.AccountNo,
                    CustomerName = a.Customer != null ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() : "",
                    MemberName = a.Customer != null ? (a.Customer.FirstName + (string.IsNullOrWhiteSpace(a.Customer.MiddleName) ? "" : " " + a.Customer.MiddleName) + (string.IsNullOrWhiteSpace(a.Customer.LastName) ? "" : " " + a.Customer.LastName)).Trim() : "",
                    MobileNo = a.Customer != null ? a.Customer.MobileNo : "",
                    CurrentBalance = a.TotalDepositedAmount
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // ==================== NEW ANDROID API ENDPOINTS ====================

        public class CreateCustomerDto
        {
            [Required]
            public string FirstName { get; set; } = string.Empty;
            public string? MiddleName { get; set; }
            [Required]
            public string LastName { get; set; } = string.Empty;
            [Required]
            public string MobileNo { get; set; } = string.Empty;
            public string? AadhaarNo { get; set; }
            public string? Address { get; set; }
            public string? Gender { get; set; } = "Male";
            public int BranchID { get; set; } = 1;
            public int? AgentId { get; set; }
        }

        // 1. POST: api/PigmyApp/CreateCustomer
        [HttpPost("CreateCustomer")]
        public async Task<IActionResult> CreateCustomer(
            [FromBody] CreateCustomerDto dto,
            [FromHeader(Name = "X-Agent-Id")] int headerAgentId)
        {
            int agentId = dto.AgentId.HasValue && dto.AgentId.Value > 0 ? dto.AgentId.Value : headerAgentId;
            if (agentId <= 0) return Unauthorized("वैध X-Agent-Id हेडर किंवा AgentId पुरवा.");

            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
            if (agent == null) return BadRequest("नियुक्त एजंट सापडला नाही.");

            int branchId = dto.BranchID > 0 ? dto.BranchID : (agent.BranchID ?? 1);

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Create Customer record
                var customer = new Customer
                {
                    BranchID = branchId,
                    FirstName = dto.FirstName.Trim(),
                    MiddleName = dto.MiddleName?.Trim(),
                    LastName = dto.LastName.Trim(),
                    MobileNo = dto.MobileNo.Trim(),
                    AadhaarNo = !string.IsNullOrWhiteSpace(dto.AadhaarNo) ? dto.AadhaarNo.Trim() : "000000000000",
                    Address = dto.Address?.Trim(),
                    Gender = dto.Gender ?? "Male",
                    CreatedBy = agentId,
                    CreatedOn = DateTime.UtcNow,
                    Status = "Active"
                };

                _context.Customers.Add(customer);
                await _context.SaveChangesAsync();

                // Assign CIF
                customer.CIFNo = $"CIF-{branchId:D2}-{customer.CustomerID:D6}";
                await _context.SaveChangesAsync();

                // Get Default Pigmy Scheme
                var scheme = await _context.PigmySchemes.FirstOrDefaultAsync() 
                    ?? new PigmyScheme { PigmySchemeID = 1 };

                // Generate Account Number
                var todayStr = DateTime.Now.ToString("yyyyMMdd");
                var accountNo = $"PGM-{branchId}-{todayStr}-{customer.CustomerID:D4}";

                // Create Pigmy Account
                var pigmyAccount = new PigmyAccount
                {
                    AccountNo = accountNo,
                    CustomerID = customer.CustomerID,
                    BranchID = branchId,
                    PigmySchemeID = scheme.PigmySchemeID,
                    PigmyAgentID = agentId,
                    OpeningDate = DateTime.Today,
                    MaturityDate = DateTime.Today.AddYears(1),
                    TotalDepositedAmount = 0m,
                    Status = "Active",
                    CreatedBy = agentId,
                    CreatedDate = DateTime.UtcNow
                };

                _context.PigmyAccounts.Add(pigmyAccount);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    message = "नवीन पिग्मी ग्राहक व खाते यशस्वीरीत्या उघडले गेले!",
                    customerId = customer.CustomerID,
                    memberId = customer.CustomerID,
                    pigmyAccountId = pigmyAccount.PigmyAccountID,
                    accountNo = pigmyAccount.AccountNo,
                    customerName = $"{customer.FirstName} {customer.LastName}".Trim(),
                    memberName = $"{customer.FirstName} {customer.LastName}".Trim(),
                    mobileNo = customer.MobileNo,
                    status = pigmyAccount.Status
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "ग्राहक उघडताना त्रुटी आली: " + ex.Message);
            }
        }

        // 2. GET: api/PigmyApp/CollectionStatus
        [HttpGet("CollectionStatus")]
        public async Task<IActionResult> GetCollectionStatus([FromHeader(Name = "X-Agent-Id")] int headerAgentId, [FromQuery] int? agentId)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : headerAgentId;
            if (targetAgentId <= 0) return Unauthorized("वैध X-Agent-Id हेडर किंवा agentId क्वेरी पुरवा.");

            var today = DateTime.Today;
            var day1 = today.AddDays(-1); // Yesterday
            var day2 = today.AddDays(-2); // Day before yesterday

            var last2Days = new List<DateTime> { day2, day1 };
            bool isPendingRemittance = false;
            var detailsList = new List<object>();

            foreach (var date in last2Days)
            {
                var nextDate = date.AddDays(1);

                // Total collected on date
                var totalCollected = await _context.PigmyCollections
                    .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= date && c.CollectionDate < nextDate)
                    .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

                // Total remitted to branch on date
                var totalRemitted = await _context.PigmyAgentCashDeposits
                    .Where(d => d.AgentId == targetAgentId && d.DepositDate >= date && d.DepositDate < nextDate)
                    .SumAsync(d => (decimal?)d.Amount) ?? 0m;

                var pendingCash = totalCollected - totalRemitted;
                bool dayPending = totalCollected > 0 && pendingCash > 0;

                if (dayPending)
                {
                    isPendingRemittance = true;
                }

                detailsList.Add(new
                {
                    date = date.ToString("yyyy-MM-dd"),
                    totalCollected = totalCollected,
                    totalRemitted = totalRemitted,
                    pendingCash = pendingCash > 0 ? pendingCash : 0m,
                    isSubmitted = !dayPending
                });
            }

            int collectPigmiStatus = isPendingRemittance ? 0 : 1;
            int pendingFlag = isPendingRemittance ? 1 : 0;

            string statusMessage = isPendingRemittance
                ? "मागील २ दिवसांचे पिग्मी कलेक्शन शाखेत जमा केलेले नाही. कृपया आधी शाखेत कॅश जमा करा."
                : "कमिशन व पिग्मी कलेक्शनसाठी एजंट अधिकृत आहे.";

            return Ok(new
            {
                agentId = targetAgentId,
                collect_Pigmi = collectPigmiStatus,
                is_pending = pendingFlag,
                status = collectPigmiStatus == 1 ? "ALLOWED" : "LOCKED",
                message = statusMessage,
                previousDaysCollectionDetails = detailsList
            });
        }

        public class AppCollectionItemDto
        {
            [Required]
            public int PigmyAccountId { get; set; }
            [Required]
            public decimal CollectionAmount { get; set; }
            public DateTime? CollectionDate { get; set; }
            public string? ReceiptNo { get; set; }
        }

        public class BulkAppCollectionRequest
        {
            public int? AgentId { get; set; }
            public List<AppCollectionItemDto> Items { get; set; } = new List<AppCollectionItemDto>();
        }

        // 3. POST: api/PigmyApp/BulkCollection
        [HttpPost("BulkCollection")]
        public async Task<IActionResult> BulkCollection(
            [FromBody] BulkAppCollectionRequest request,
            [FromHeader(Name = "X-Agent-Id")] int headerAgentId)
        {
            int agentId = request.AgentId.HasValue && request.AgentId.Value > 0 ? request.AgentId.Value : headerAgentId;
            if (agentId <= 0) return Unauthorized("वैध X-Agent-Id हेडर किंवा AgentId पुरवा.");

            if (request.Items == null || request.Items.Count == 0)
            {
                return BadRequest("जमा करण्यासाठी कोणतीही खाती पाठवलेली नाहीत.");
            }

            // Step 1: Validate 2-Day Remittance Lock
            var today = DateTime.Today;
            var day1 = today.AddDays(-1);
            var day2 = today.AddDays(-2);

            var unremittedPastCash = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && c.CollectionDate >= day2 && c.CollectionDate < today)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            var pastRemittedCash = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId && d.DepositDate >= day2 && d.DepositDate < today)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            if (unremittedPastCash > 0 && (unremittedPastCash - pastRemittedCash) > 0)
            {
                return StatusCode(403, new
                {
                    collect_Pigmi = 0,
                    is_pending = 1,
                    message = "मागील २ दिवसांची रोख रक्कम शाखेत जमा नसल्यामुळे जमा स्वीकारणे बंद केले आहे. कृपया शाखेत कॅश जमा करा."
                });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                int savedCount = 0;
                decimal totalCollectionAmount = 0m;
                var savedReceipts = new List<object>();

                foreach (var item in request.Items)
                {
                    if (item.CollectionAmount <= 0) continue;

                    var account = await _context.PigmyAccounts.FirstOrDefaultAsync(a => a.PigmyAccountID == item.PigmyAccountId);
                    if (account == null || account.Status != "Active") continue;

                    DateTime collDate = item.CollectionDate?.Date ?? DateTime.Today;
                    DateTime nextCollDate = collDate.AddDays(1);

                    // Check if collection already exists on collDate (Upsert)
                    var existingCollection = await _context.PigmyCollections.FirstOrDefaultAsync(c =>
                        c.PigmyAccountId == item.PigmyAccountId &&
                        c.CollectionDate >= collDate && c.CollectionDate < nextCollDate);

                    string receiptNo = !string.IsNullOrWhiteSpace(item.ReceiptNo) 
                        ? item.ReceiptNo 
                        : $"REC-APP-{account.BranchID}-{collDate:yyyyMMdd}-{account.PigmyAccountID}";

                    decimal prevOpening = existingCollection?.OpeningBalance ?? account.TotalDepositedAmount;
                    decimal addedAmount = item.CollectionAmount;

                    if (existingCollection != null)
                    {
                        existingCollection.CollectionAmount += addedAmount;
                        existingCollection.ClosingBalance = existingCollection.OpeningBalance + existingCollection.CollectionAmount;
                        _context.PigmyCollections.Update(existingCollection);
                    }
                    else
                    {
                        var newColl = new PigmyCollection
                        {
                            PigmyAccountId = item.PigmyAccountId,
                            AgentId = agentId,
                            CollectionDate = collDate,
                            OpeningBalance = prevOpening,
                            CollectionAmount = addedAmount,
                            ClosingBalance = prevOpening + addedAmount,
                            ReceiptNo = receiptNo,
                            CollectionSource = "APP",
                            CreatedBy = agentId,
                            CreatedOn = DateTime.UtcNow
                        };
                        _context.PigmyCollections.Add(newColl);
                    }

                    // Update Account Total Balance
                    account.TotalDepositedAmount += addedAmount;
                    _context.PigmyAccounts.Update(account);

                    // Add Ledger Transaction
                    var pigmyTx = new PigmyTransaction
                    {
                        PigmyAccountID = account.PigmyAccountID,
                        TransactionDate = collDate,
                        ValueDate = collDate,
                        TransactionType = "DEPOSIT",
                        DrAmount = 0m,
                        CrAmount = addedAmount,
                        BalanceAmount = account.TotalDepositedAmount,
                        Narration = $"Pigmy Collection via Mobile App (Receipt: {receiptNo})"
                    };
                    _context.PigmyTransactions.Add(pigmyTx);

                    // Create Pending Voucher for Voucher Passing
                    var appBranchId = account.BranchID;
                    var appMapping = await _context.PigmyVoucherMappings.FirstOrDefaultAsync(m => m.BranchId == appBranchId && m.CollectionSource == "APP" && m.IsActive);
                    int appDrLedgerId = appMapping?.DebitLedgerId ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("कॅश") || l.LedgerName.Contains("Cash")))?.LedgerID ?? 1;
                    int appCrLedgerId = appMapping?.CreditLedgerId ?? (await _context.PigmySchemes.FirstOrDefaultAsync(s => s.PigmySchemeID == account.PigmySchemeID))?.PigmyLiabilityLedgerID ?? (await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy")))?.LedgerID ?? 2;

                    string appVoucherNo = $"PV-{appBranchId}-{collDate:yyyyMMdd}-APP-{Guid.NewGuid().ToString("N").Substring(0, 4)}";
                    var appVoucher = new Voucher
                    {
                        BranchID = appBranchId,
                        VoucherNo = appVoucherNo,
                        VoucherDate = collDate,
                        VoucherType = "Receipt",
                        Status = "Pending",
                        Narration = $"Pigmy App Collection for A/C {account.AccountNo}",
                        TotalAmount = addedAmount
                    };

                    appVoucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = appDrLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Dr",
                        Amount = addedAmount
                    });

                    appVoucher.VoucherDetails.Add(new VoucherDetail
                    {
                        LedgerID = appCrLedgerId,
                        CustomerID = account.CustomerID,
                        DrCr = "Cr",
                        Amount = addedAmount
                    });

                    _context.Vouchers.Add(appVoucher);

                    savedCount++;
                    totalCollectionAmount += addedAmount;

                    savedReceipts.Add(new
                    {
                        pigmyAccountId = account.PigmyAccountID,
                        accountNo = account.AccountNo,
                        receiptNo = receiptNo,
                        amount = addedAmount,
                        newBalance = account.TotalDepositedAmount
                    });
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    success = true,
                    collect_Pigmi = 1,
                    message = $"एकूण {savedCount} खात्यांमध्ये ₹{totalCollectionAmount:N2} ची नोंद यशस्वीरीत्या सेव्ह झाली!",
                    savedCount = savedCount,
                    totalAmount = totalCollectionAmount,
                    receipts = savedReceipts
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, "पिग्मी जमा सेव्ह करताना सर्व्हर त्रुटी: " + ex.Message);
            }
        }

        // 4. GET: api/PigmyApp/Passbook
        [HttpGet("Passbook")]
        public async Task<IActionResult> GetPassbook(
            [FromQuery] int pigmyAccountId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            if (pigmyAccountId <= 0) return BadRequest("वैध pigmyAccountId पुरवा.");

            var account = await _context.PigmyAccounts
                .Include(a => a.Customer)
                .Include(a => a.PigmyAgent)
                .FirstOrDefaultAsync(a => a.PigmyAccountID == pigmyAccountId);

            if (account == null) return NotFound("पिग्मी खाते सापडले नाही.");

            DateTime fDate = fromDate?.Date ?? new DateTime(DateTime.Today.Year, 1, 1);
            DateTime tDate = toDate?.Date ?? DateTime.Today;
            DateTime nextTDate = tDate.AddDays(1);

            // Compute Opening Balance before fDate using transactions / migrated balances
            var priorCr = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == pigmyAccountId && t.TransactionDate.Date < fDate)
                .SumAsync(t => (decimal?)t.CrAmount) ?? 0m;

            var priorDr = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == pigmyAccountId && t.TransactionDate.Date < fDate)
                .SumAsync(t => (decimal?)t.DrAmount) ?? 0m;

            decimal openingBalance = priorCr - priorDr;
            if (openingBalance < 0) openingBalance = 0;

            // Fetch transactions in date range
            var transactions = await _context.PigmyTransactions
                .Where(t => t.PigmyAccountID == pigmyAccountId && t.TransactionDate.Date >= fDate && t.TransactionDate.Date < nextTDate)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.PigmyTransactionID)
                .ToListAsync();

            decimal runningBalance = openingBalance;
            var ledgerItems = new List<object>();

            foreach (var t in transactions)
            {
                runningBalance = runningBalance + t.CrAmount - t.DrAmount;
                ledgerItems.Add(new
                {
                    transactionId = t.PigmyTransactionID,
                    date = t.TransactionDate.ToString("yyyy-MM-dd"),
                    transactionType = t.TransactionType,
                    narration = t.Narration,
                    referenceId = t.ReferenceId,
                    drAmount = t.DrAmount,
                    crAmount = t.CrAmount,
                    runningBalance = runningBalance
                });
            }

            return Ok(new
            {
                pigmyAccountId = account.PigmyAccountID,
                accountNo = account.AccountNo,
                customerName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() : "",
                memberName = account.Customer != null ? $"{account.Customer.FirstName} {account.Customer.LastName}".Trim() : "",
                agentName = account.PigmyAgent?.AgentName ?? "",
                openingDate = account.OpeningDate.ToString("yyyy-MM-dd"),
                fromDate = fDate.ToString("yyyy-MM-dd"),
                toDate = tDate.ToString("yyyy-MM-dd"),
                openingBalance = openingBalance,
                totalCredit = transactions.Sum(t => t.CrAmount),
                totalDebit = transactions.Sum(t => t.DrAmount),
                closingBalance = runningBalance,
                currentTotalBalance = account.TotalDepositedAmount,
                transactions = ledgerItems
            });
        }

        // 5. GET: api/PigmyApp/CollectionReport
        [HttpGet("CollectionReport")]
        public async Task<IActionResult> GetCollectionReport(
            [FromHeader(Name = "X-Agent-Id")] int headerAgentId,
            [FromQuery] int? agentId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : headerAgentId;
            if (targetAgentId <= 0) return Unauthorized("वैध X-Agent-Id हेडर किंवा agentId पुरवा.");

            DateTime fDate = fromDate?.Date ?? DateTime.Today;
            DateTime tDate = toDate?.Date ?? DateTime.Today;
            DateTime nextTDate = tDate.AddDays(1);

            var query = _context.PigmyCollections
                .Include(c => c.PigmyAccount)
                    .ThenInclude(a => a!.Customer)
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= fDate && c.CollectionDate < nextTDate)
                .OrderByDescending(c => c.CollectionDate)
                .AsQueryable();

            var collections = await query.ToListAsync();

            var summary = new
            {
                agentId = targetAgentId,
                fromDate = fDate.ToString("yyyy-MM-dd"),
                toDate = tDate.ToString("yyyy-MM-dd"),
                totalCollectedAmount = collections.Sum(c => c.CollectionAmount),
                totalReceiptsCount = collections.Count,
                uniqueAccountsCount = collections.Select(c => c.PigmyAccountId).Distinct().Count(),
                collections = collections.Select(c => new
                {
                    c.CollectionId,
                    c.ReceiptNo,
                    date = c.CollectionDate.ToString("yyyy-MM-dd"),
                    c.PigmyAccountId,
                    accountNo = c.PigmyAccount?.AccountNo ?? "",
                    customerName = c.PigmyAccount?.Customer != null ? $"{c.PigmyAccount.Customer.FirstName} {c.PigmyAccount.Customer.LastName}".Trim() : "",
                    memberName = c.PigmyAccount?.Customer != null ? $"{c.PigmyAccount.Customer.FirstName} {c.PigmyAccount.Customer.LastName}".Trim() : "",
                    amount = c.CollectionAmount,
                    source = c.CollectionSource
                })
            };

            return Ok(summary);
        }

        // 6. GET: api/PigmyApp/CommissionReport
        [HttpGet("CommissionReport")]
        public async Task<IActionResult> GetCommissionReport(
            [FromHeader(Name = "X-Agent-Id")] int headerAgentId,
            [FromQuery] int? agentId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate)
        {
            int targetAgentId = agentId.HasValue && agentId.Value > 0 ? agentId.Value : headerAgentId;
            if (targetAgentId <= 0) return Unauthorized("वैध X-Agent-Id हेडर किंवा agentId पुरवा.");

            DateTime fDate = fromDate?.Date ?? new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1);
            DateTime tDate = toDate?.Date ?? DateTime.Today;
            DateTime nextTDate = tDate.AddDays(1);

            // Fetch active commission rate setting for agent
            var setting = await _context.PigmyCommissionSettings
                .Where(s => (s.AgentId == targetAgentId || s.AgentId == null) && s.IsActive)
                .OrderByDescending(s => s.AgentId)
                .FirstOrDefaultAsync();

            decimal rateValue = setting?.CommissionValue ?? 2.5m;
            string rateType = setting?.CommissionType ?? "PERCENTAGE";

            // Total collections in period
            var totalCollected = await _context.PigmyCollections
                .Where(c => c.AgentId == targetAgentId && c.CollectionDate >= fDate && c.CollectionDate < nextTDate)
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            // Calculated Commission
            decimal calculatedCommission = 0m;
            if (rateType == "PERCENTAGE")
            {
                calculatedCommission = Math.Round((totalCollected * rateValue) / 100m, 2);
            }
            else
            {
                if (totalCollected > 0) calculatedCommission = rateValue;
            }

            // Paid commissions in period
            var paidRecords = await _context.PigmyAgentCommissions
                .Where(c => c.AgentId == targetAgentId && c.Status == "PAID" && c.PeriodStartDate >= fDate && c.PeriodEndDate < nextTDate)
                .ToListAsync();

            decimal paidAmount = paidRecords.Sum(p => p.CalculatedCommission);
            decimal pendingAmount = calculatedCommission > paidAmount ? (calculatedCommission - paidAmount) : 0m;

            return Ok(new
            {
                agentId = targetAgentId,
                fromDate = fDate.ToString("yyyy-MM-dd"),
                toDate = tDate.ToString("yyyy-MM-dd"),
                totalCollectedAmount = totalCollected,
                commissionRate = rateValue,
                rateType = rateType,
                calculatedCommission = calculatedCommission,
                paidCommission = paidAmount,
                pendingCommission = pendingAmount,
                paidVouchersCount = paidRecords.Count
            });
        }
    }
}

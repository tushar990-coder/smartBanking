using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Data;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class LegacyDataImportController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _env;

        public LegacyDataImportController(AppDbContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        private string GetConnectionString(string mdfPath)
        {
            return $@"Server=.\SQLEXPRESS01;AttachDbFilename={mdfPath};Trusted_Connection=True;Pooling=False;MultipleActiveResultSets=true;Encrypt=False;Connect Timeout=120;";
        }

        private void CleanLogFile(string filePath)
        {
            var logFilePath = Path.Combine(Path.GetDirectoryName(filePath) ?? "", Path.GetFileNameWithoutExtension(filePath) + "_log.ldf");
            if (System.IO.File.Exists(logFilePath))
            {
                try { System.IO.File.Delete(logFilePath); } catch { }
            }
        }

        [HttpPost("upload-test")]
        [RequestSizeLimit(524288000)]
        [RequestFormLimits(MultipartBodyLengthLimit = 524288000)]
        public async Task<IActionResult> UploadAndTest(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest(new { message = "No file uploaded." });
            try
            {
                var uploadsFolder = Path.Combine(_env.ContentRootPath, "Uploads");
                if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);
                var uniqueFileName = Path.GetFileNameWithoutExtension(file.FileName) + "_" + Guid.NewGuid().ToString().Substring(0, 8) + Path.GetExtension(file.FileName);
                var filePath = Path.Combine(uploadsFolder, uniqueFileName);
                using (var stream = new FileStream(filePath, FileMode.Create)) await file.CopyToAsync(stream);
                CleanLogFile(filePath);

                var connectionString = GetConnectionString(filePath);
                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();
                    var cmd = new SqlCommand("SELECT COUNT(*) FROM CUSTOMERS", conn);
                    int count = Convert.ToInt32(await cmd.ExecuteScalarAsync() ?? 0);
                    var cmdLedger = new SqlCommand("SELECT COUNT(*) FROM LEDGER", conn);
                    int ledgerCount = Convert.ToInt32(await cmdLedger.ExecuteScalarAsync() ?? 0);
                    return Ok(new { message = $"Connection Successful! Found {ledgerCount} ledgers and", customerCount = count, filePath = filePath });
                }
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPost("import-financial-years")]
        public async Task<IActionResult> ImportFinancialYears([FromBody] LegacyDbRequest request)
        {
            try
            {
                CleanLogFile(request.FilePath);
                var connectionString = GetConnectionString(request.FilePath);
                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();
                    int imported = 0;
                    var cmd = new SqlCommand("SELECT Year_id, Start_date, End_date, Status FROM YEAR_INFO", conn);
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var sDate = Convert.ToDateTime(reader["Start_date"]);
                            var eDate = Convert.ToDateTime(reader["End_date"]);
                            var status = reader["Status"]?.ToString();
                            
                            var existing = await _context.FinancialYears.FirstOrDefaultAsync(y => y.StartDate.Date == sDate.Date);
                            if (existing == null)
                            {
                                _context.FinancialYears.Add(new FinancialYear
                                {
                                    YearCode = $"{sDate.Year}-{eDate.Year}",
                                    StartDate = sDate,
                                    EndDate = eDate,
                                    IsActive = (status == "1"),
                                    IsClosed = false
                                });
                                imported++;
                            }
                        }
                    }
                    await _context.SaveChangesAsync();
                    return Ok(new { message = $"Imported {imported} Financial Years successfully." });
                }
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPost("import-masters")]
        public async Task<IActionResult> ImportMasters([FromBody] LegacyDbRequest request)
        {
            try
            {
                CleanLogFile(request.FilePath);
                var connectionString = GetConnectionString(request.FilePath);
                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();
                    int importedEmployers = 0, importedGroups = 0;

                    var cmdEmp = new SqlCommand("SELECT Cust_type_id, Cust_type FROM CUST_TYPE_MASTER", conn);
                    using (var reader = await cmdEmp.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var legacyId = Convert.ToInt32(reader["Cust_type_id"]);
                            var name = IsmToUnicodeConverter.ConvertIsmToUnicode(reader["Cust_type"].ToString() ?? "");
                            var existing = await _context.EmployerMasters.FirstOrDefaultAsync(e => e.LegacyTypeId == legacyId);
                            if (existing == null) { _context.EmployerMasters.Add(new EmployerMaster { LegacyTypeId = legacyId, Name = name }); importedEmployers++; }
                            else { existing.Name = name; }
                        }
                    }

                    var cmdGrp = new SqlCommand("SELECT L_group_id, L_group_name FROM LEDGER_GROUP", conn);
                    using (var reader = await cmdGrp.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var legacyId = Convert.ToInt32(reader["L_group_id"]);
                            var name = IsmToUnicodeConverter.ConvertIsmToUnicode(reader["L_group_name"].ToString() ?? "");
                            var existing = await _context.AccountGroups.FirstOrDefaultAsync(g => g.LegacyGroupId == legacyId);
                            if (existing == null) { _context.AccountGroups.Add(new AccountGroup { LegacyGroupId = legacyId, GroupName = name, NatureOfGroup = "Assets" }); importedGroups++; }
                            else { existing.GroupName = name; }
                        }
                    }
                    await _context.SaveChangesAsync();
                    return Ok(new { message = $"Imported {importedEmployers} Employers and {importedGroups} Ledger Groups." });
                }
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPost("preview-ledgers")]
        public async Task<IActionResult> PreviewLedgers([FromBody] LegacyDbRequest request)
        {
            try
            {
                CleanLogFile(request.FilePath);
                var connectionString = GetConnectionString(request.FilePath);
                var legacyLedgers = new List<object>();
                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();
                    var cmdLdgr = new SqlCommand(@"
                        SELECT L.Ledger_id, L.Ledger_name, L.Ledger_group_id, G.L_group_name 
                        FROM LEDGER L
                        LEFT JOIN LEDGER_GROUP G ON L.Ledger_group_id = G.L_group_id
                        WHERE EXISTS (SELECT 1 FROM TRANS_DETAILS TD WHERE TD.L_id = L.Ledger_id)
                           OR EXISTS (SELECT 1 FROM OPENING_BAL OB WHERE OB.L_id = L.Ledger_id)", conn);
                    using (var reader = await cmdLdgr.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var legacyId = Convert.ToInt32(reader["Ledger_id"]);
                            var name = IsmToUnicodeConverter.ConvertIsmToUnicode(reader["Ledger_name"].ToString() ?? "");
                            var groupName = IsmToUnicodeConverter.ConvertIsmToUnicode(reader["L_group_name"].ToString() ?? "Uncategorized");
                            legacyLedgers.Add(new { legacyId, name, groupName });
                        }
                    }
                }
                var systemLedgers = await _context.Ledgers.Include(l => l.AccountGroup)
                    .Select(l => new { l.LedgerID, l.LedgerName, l.LegacyLedgerId, GroupName = l.AccountGroup != null ? l.AccountGroup.GroupName : "" })
                    .ToListAsync();
                return Ok(new { legacyLedgers, systemLedgers });
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPost("sync-ledgers")]
        public async Task<IActionResult> SyncLedgers([FromBody] SyncLedgersRequest request)
        {
            try
            {
                // 1. Reset all old mappings first
                var allMapped = await _context.Ledgers.Where(l => l.LegacyLedgerId != null).ToListAsync();
                foreach (var l in allMapped) l.LegacyLedgerId = null;

                // 2. Apply new mappings
                foreach (var mapping in request.MappedLedgers)
                {
                    var systemLedger = await _context.Ledgers.FindAsync(mapping.Value);
                    if (systemLedger != null)
                    {
                        systemLedger.LegacyLedgerId = mapping.Key;
                    }
                }
                await _context.SaveChangesAsync();

                await _context.SaveChangesAsync();
                return Ok(new { message = $"Successfully mapped {request.MappedLedgers.Count} ledgers." });
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPost("import-members-accounts")]
        public async Task<IActionResult> ImportMembersAccounts([FromBody] ImportMembersRequest request)
        {
            try
            {
                CleanLogFile(request.FilePath);
                var connectionString = GetConnectionString(request.FilePath);
                int importedMembers = 0;
                int importedSavings = 0;
                int importedLoans = 0;
                
                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();
                    
                    // 1. IMPORT CUSTOMERS -> MEMBERS
                    var cmdMem = new SqlCommand("SELECT Cust_id, Emp_Code, First_name, Middle_name, Last_name, Cust_type_id, Mobile_no, Adhar_no FROM CUSTOMERS", conn);
                    using (var reader = await cmdMem.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var legacyId = Convert.ToInt32(reader["Cust_id"]);
                            var empCode = reader["Emp_Code"].ToString() ?? "";
                            var fNameUni = IsmToUnicodeConverter.ConvertIsmToUnicode(reader["First_name"].ToString() ?? "").Trim();
                            var mNameUni = IsmToUnicodeConverter.ConvertIsmToUnicode(reader["Middle_name"].ToString() ?? "").Trim();
                            var lNameUni = IsmToUnicodeConverter.ConvertIsmToUnicode(reader["Last_name"].ToString() ?? "").Trim();
                            var typeId = reader["Cust_type_id"] != DBNull.Value ? Convert.ToInt32(reader["Cust_type_id"]) : (int?)null;
                            var mobile = reader["Mobile_no"].ToString() ?? "";
                            var aadhaar = reader["Adhar_no"].ToString() ?? "";

                            var existing = await _context.Members.FirstOrDefaultAsync(m => m.LegacyMemberId == legacyId);
                            if (existing == null)
                            {
                                var mappedEmployerId = 0;
                                if (typeId.HasValue)
                                {
                                    var emp = await _context.EmployerMasters.FirstOrDefaultAsync(e => e.LegacyTypeId == typeId.Value);
                                    if (emp != null) mappedEmployerId = emp.Id;
                                }
                                _context.Members.Add(new Member
                                {
                                    LegacyMemberId = legacyId,
                                    LegacyMemberNo = empCode,
                                    MemberCode = "M" + legacyId,
                                    FirstName = fNameUni,
                                    MiddleName = mNameUni,
                                    LastName = lNameUni,
                                    MobileNo = string.IsNullOrEmpty(mobile) ? "0000000000" : mobile,
                                    AadhaarNo = string.IsNullOrEmpty(aadhaar) ? "NA" + legacyId : aadhaar,
                                    Address = "",
                                    EmployerId = mappedEmployerId == 0 ? (int?)null : mappedEmployerId
                                });
                                importedMembers++;
                            }
                            else
                            {
                                existing.FirstName = fNameUni; existing.MiddleName = mNameUni; existing.LastName = lNameUni;
                            }
                        }
                    }
                    await _context.SaveChangesAsync();

                    // Load Maps
                    var memberMap = await _context.Members.Where(m => m.LegacyMemberId != null).ToDictionaryAsync(m => m.LegacyMemberId!.Value, m => new { m.MemberID, m.CustomerID });
                    var ledgerMap = await _context.Ledgers.Where(l => l.LegacyLedgerId != null).ToDictionaryAsync(l => l.LegacyLedgerId!.Value, l => l.LedgerID);
                    
                    var firstLedger = await _context.Ledgers.FirstOrDefaultAsync();
                    
                    // 1.5 Auto-Import LOAN TYPES as LoanRates
                    var loanRateMap = new Dictionary<int, int>(); // Legacy Loan_type_id -> System LoanRateID
                    var cmdLoanTypes = new SqlCommand("SELECT Loan_type_id, Loan_type FROM LOAN_TYPES", conn);
                    using (var reader = await cmdLoanTypes.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var typeId = Convert.ToInt32(reader["Loan_type_id"]);
                            var typeName = IsmToUnicodeConverter.ConvertIsmToUnicode(reader["Loan_type"].ToString() ?? "");
                            
                            var existingRate = await _context.LoanRates.FirstOrDefaultAsync(lr => lr.LoanType == typeName);
                            if (existingRate == null)
                            {
                                existingRate = new LoanRate { 
                                    LoanType = typeName, 
                                    InterestRate = 12, 
                                    LoanLedgerID = firstLedger?.LedgerID ?? 1 
                                };
                                _context.LoanRates.Add(existingRate);
                                await _context.SaveChangesAsync(); // Save immediately to get ID
                            }
                            loanRateMap[typeId] = existingRate.LoanRateID;
                        }
                    }
                    
                    // Fallback rate if type is missing
                    var defaultLoanRate = await _context.LoanRates.FirstOrDefaultAsync();
                    if (defaultLoanRate == null)
                    {
                        defaultLoanRate = new LoanRate { LoanType = "Default Legacy Rate", InterestRate = 12, LoanLedgerID = firstLedger?.LedgerID ?? 1 };
                        _context.LoanRates.Add(defaultLoanRate);
                        await _context.SaveChangesAsync();
                    }

                    // 2. IMPORT SAVING ACCOUNTS
                    var cmdSav = new SqlCommand("SELECT Acc_id, Cust_id, Acc_no, S_id, Acc_open_date, Opn_bal FROM SAVING_ACCOUNT", conn);
                    using (var reader = await cmdSav.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var legacyCustId = Convert.ToInt32(reader["Cust_id"]);
                            var accNo = reader["Acc_no"].ToString() ?? "";
                            if (!memberMap.ContainsKey(legacyCustId)) continue;
                            
                            var memberInfo = memberMap[legacyCustId];
                            var existing = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.AccountNo == accNo && s.MemberID == memberInfo.MemberID);
                            
                            if (existing == null)
                            {
                                var legacySId = reader["S_id"] != DBNull.Value ? Convert.ToInt32(reader["S_id"]) : (int?)null;
                                int mappedLedgerId = 7; // Default
                                if (legacySId.HasValue && ledgerMap.ContainsKey(legacySId.Value)) {
                                    mappedLedgerId = ledgerMap[legacySId.Value];
                                }
                                
                                var openDate = reader["Acc_open_date"] != DBNull.Value ? Convert.ToDateTime(reader["Acc_open_date"]) : DateTime.Today;
                                var opnBal = reader["Opn_bal"] != DBNull.Value ? Convert.ToDecimal(reader["Opn_bal"]) : 0m;
                                
                                _context.SavingAccountMasters.Add(new SavingAccountMaster {
                                    AccountNo = accNo,
                                    MemberID = memberInfo.MemberID,
                                    CustomerID = memberInfo.CustomerID ?? 1,
                                    OpeningDate = openDate,
                                    LedgerID = mappedLedgerId,
                                    OpeningBalance = opnBal,
                                    CurrentBalance = opnBal,
                                    IsLegacyAccount = true,
                                    LegacyAccountId = reader["Acc_id"] != DBNull.Value ? Convert.ToInt32(reader["Acc_id"]) : (int?)null
                                });
                                importedSavings++;
                            }
                        }
                    }
                    await _context.SaveChangesAsync();
                    
                    // 3. IMPORT LOAN ACCOUNTS (KARZ_ROKHA)
                    var cmdLoan = new SqlCommand(@"
                        SELECT KR.Kr_id, SA.Cust_id, KR.Loan_acc_no, KR.Loan_type_id, KR.Loan_date, KR.Loan_amt, KR.Intr_rate, KR.Tenure 
                        FROM KARZ_ROKHA KR
                        INNER JOIN SAVING_ACCOUNT SA ON KR.Saving_Acc_id = SA.Acc_id", conn);
                        
                    using (var reader = await cmdLoan.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var legacyCustId = Convert.ToInt32(reader["Cust_id"]);
                            var accNo = reader["Loan_acc_no"].ToString() ?? "";
                            if (!memberMap.ContainsKey(legacyCustId)) continue;
                            
                            var memberInfoLoan = memberMap[legacyCustId];
                            var existing = await _context.LoanAccounts.FirstOrDefaultAsync(l => l.LoanAccountNo == accNo && l.MemberID == memberInfoLoan.MemberID);
                            
                            if (existing == null)
                            {
                                var openDate = reader["Loan_date"] != DBNull.Value ? Convert.ToDateTime(reader["Loan_date"]) : DateTime.Today;
                                var amt = reader["Loan_amt"] != DBNull.Value ? Convert.ToDecimal(reader["Loan_amt"]) : 0m;
                                var rate = reader["Intr_rate"] != DBNull.Value ? Convert.ToDecimal(reader["Intr_rate"]) : 12m;
                                var tenure = reader["Tenure"] != DBNull.Value ? Convert.ToInt32(reader["Tenure"]) : 12;
                                var krId = reader["Kr_id"] != DBNull.Value ? Convert.ToInt32(reader["Kr_id"]) : (int?)null;
                                
                                int assignedLoanRateId = defaultLoanRate.LoanRateID;
                                var legacyLoanTypeId = reader["Loan_type_id"] != DBNull.Value ? Convert.ToInt32(reader["Loan_type_id"]) : (int?)null;
                                if (legacyLoanTypeId.HasValue && loanRateMap.ContainsKey(legacyLoanTypeId.Value)) {
                                    assignedLoanRateId = loanRateMap[legacyLoanTypeId.Value];
                                }
                                
                                _context.LoanAccounts.Add(new LoanAccount {
                                    LoanAccountNo = accNo,
                                    MemberID = memberInfoLoan.MemberID,
                                    CustomerID = memberInfoLoan.CustomerID ?? 1,
                                    LoanRateID = assignedLoanRateId,
                                    OpeningDate = openDate,
                                    LoanDisbursementDate = openDate,
                                    SanctionedAmount = amt,
                                    PrincipalBalance = amt,
                                    InterestRate = rate,
                                    DurationMonths = tenure,
                                    IsOpeningBalance = true,
                                    LegacyAccountId = krId
                                });
                                importedLoans++;
                            }
                        }
                    }
                    await _context.SaveChangesAsync();
                }
                return Ok(new { message = $"Imported/Updated {importedMembers} Members, {importedSavings} Saving Accounts, and {importedLoans} Loan Accounts." });
            }
            catch (Exception ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpDelete("clear-existing-data")]
        public async Task<IActionResult> ClearExistingData()
        {
            try
            {
                // Deleting all related data. Order matters due to foreign keys.
                // 1. Demand & Recoveries
                await _context.DemandRecoveries.ExecuteDeleteAsync();
                await _context.DemandMemberDetails.ExecuteDeleteAsync();
                await _context.DemandNotices.ExecuteDeleteAsync();
                
                // 2. Loan Dependents
                await _context.LoanCollectionFees.ExecuteDeleteAsync();
                await _context.LoanCollections.ExecuteDeleteAsync();
                await _context.LoanDisbursementDeductions.ExecuteDeleteAsync();
                await _context.LoanDisbursements.ExecuteDeleteAsync();
                await _context.LoanInstallmentSchedules.ExecuteDeleteAsync();
                await _context.LoanAccountNpaStatuses.ExecuteDeleteAsync();
                await _context.GoldLoanDetails.ExecuteDeleteAsync();
                await _context.LoanDocuments.ExecuteDeleteAsync();
                await _context.BorrowerLinkedAccounts.ExecuteDeleteAsync();

                // 3. Saving Dependents
                await _context.SavingTransactions.ExecuteDeleteAsync();
                await _context.SavingInterestPostings.ExecuteDeleteAsync();
                await _context.SavingAccountClosings.ExecuteDeleteAsync();
                await _context.SavingPassbooks.ExecuteDeleteAsync();
                await _context.SavingAccountJointHolders.ExecuteDeleteAsync();

                // 4. Share Dependents
                await _context.ShareTransactions.ExecuteDeleteAsync();
                await _context.ShareCertificates.ExecuteDeleteAsync();

                // 5. Member Opening Balances
                await _context.MemberOpeningBalances.ExecuteDeleteAsync();

                // 6. Parent Accounts
                await _context.SavingAccountMasters.ExecuteDeleteAsync();
                await _context.LoanAccounts.ExecuteDeleteAsync();
                await _context.ShareAccounts.ExecuteDeleteAsync();
                
                // 7. Core Masters
                await _context.Members.ExecuteDeleteAsync();
                await _context.EmployerMasters.ExecuteDeleteAsync();
                
                await _context.SaveChangesAsync();
                
                return Ok(new { message = "All existing customer data has been deleted successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Failed to clear data: {ex.InnerException?.Message ?? ex.Message}" });
            }
        }

        [HttpGet("test-import")]
        public async Task<IActionResult> TestImport()
        {
            try
            {
                var req = new ImportMembersRequest { FilePath = @"D:\Bhisi Software\api\Bhisi.Api\Uploads\FinEx_48b1ada3.mdf", FinancialYearId = 1 };
                return await ImportFinancialData(req);
            }
            catch (Exception ex)
            {
                return Ok(new { error = ex.ToString() });
            }
        }

        [HttpPost("import-financial-data")]
        public async Task<IActionResult> ImportFinancialData([FromBody] ImportMembersRequest req)
        {
            if (string.IsNullOrEmpty(req.FilePath) || !System.IO.File.Exists(req.FilePath))
                return BadRequest(new { message = "Invalid database file path." });
            if (req.FinancialYearId <= 0)
                return BadRequest(new { message = "Please select a valid Financial Year." });

            string connStr = GetConnectionString(req.FilePath);
            try
            {
                // 1. Map Legacy L_id -> System LedgerID
                var ledgers = await _context.Ledgers.Where(l => l.LegacyLedgerId != null).ToListAsync();
                var ledgerMap = ledgers.ToDictionary(l => l.LegacyLedgerId!.Value, l => l.LedgerID);
                var accountGroups = await _context.AccountGroups.ToListAsync();

                int importedOpeningBalances = 0;
                int importedVouchers = 0;
                int importedVoucherDetails = 0;

                using (var conn = new SqlConnection(connStr))
                {
                    await conn.OpenAsync();

                    // 2. Fetch OPENING_BAL
                    var cmdOb = new SqlCommand("SELECT L_id, Amt FROM OPENING_BAL", conn);
                    using (var reader = await cmdOb.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            int legacyLId = reader["L_id"] != DBNull.Value ? Convert.ToInt32(reader["L_id"]) : 0;
                            decimal amt = reader["Amt"] != DBNull.Value ? Convert.ToDecimal(reader["Amt"]) : 0;
                            
                            if (amt > 0 && ledgerMap.ContainsKey(legacyLId))
                            {
                                int systemLedgerId = ledgerMap[legacyLId];
                                var ledgerToUpdate = ledgers.FirstOrDefault(l => l.LedgerID == systemLedgerId);
                                if (ledgerToUpdate != null)
                                {
                                    string drCr = "Dr";
                                    var grp = accountGroups.FirstOrDefault(g => g.GroupID == ledgerToUpdate.GroupID);
                                    if (grp != null && (grp.NatureOfGroup == "Income" || grp.NatureOfGroup == "Liabilities"))
                                    {
                                        drCr = "Cr";
                                    }
                                    
                                    ledgerToUpdate.OpeningBalance = amt;
                                    ledgerToUpdate.OpeningBalanceType = drCr;
                                    importedOpeningBalances++;
                                }
                            }
                        }
                    }
                    await _context.SaveChangesAsync();

                    // 3. Fetch TRANS (Vouchers) & TRANS_DETAILS
                    var legacyVouchers = new Dictionary<int, Voucher>();
                    var cmdTrans = new SqlCommand("SELECT Trans_id, Trans_type_id, Trans_no, Trans_date, Effective_date, Trans_amt, Particulars, Trans_code FROM TRANS", conn);
                    using (var reader = await cmdTrans.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            int transId = reader["Trans_id"] != DBNull.Value ? Convert.ToInt32(reader["Trans_id"]) : 0;
                            DateTime date = reader["Trans_date"] != DBNull.Value ? Convert.ToDateTime(reader["Trans_date"]) : DateTime.Today;
                            string particulars = reader["Particulars"].ToString() ?? "";
                            if (particulars.Length > 500) particulars = particulars.Substring(0, 500);

                            string transCode = reader["Trans_code"].ToString()?.Trim().ToUpper() ?? "J";
                            
                            string voucherType = "Journal";
                            if (transCode == "R") voucherType = "Receipt";
                            else if (transCode == "P") voucherType = "Payment";
                            else if (transCode == "C") voucherType = "Contra";

                            decimal transAmt = reader["Trans_amt"] != DBNull.Value ? Convert.ToDecimal(reader["Trans_amt"]) : 0;
                            string vNo = reader["Trans_no"].ToString() ?? "";
                            if (vNo.Length > 50) vNo = vNo.Substring(0, 50);

                            var v = new Voucher
                            {
                                BranchID = 1, // Default
                                VoucherType = voucherType,
                                VoucherDate = date,
                                VoucherNo = vNo,
                                Narration = particulars,
                                TotalAmount = transAmt,
                                Status = "Approved",
                                CreatedBy = 1,
                                CreatedOn = DateTime.Now
                            };
                            _context.Vouchers.Add(v);
                            legacyVouchers[transId] = v;
                            importedVouchers++;
                        }
                    }
                    await _context.SaveChangesAsync(); // To get VoucherIDs

                    // Now import details
                    var memberMap = await _context.Members
                        .Where(m => m.LegacyMemberId != null)
                        .ToDictionaryAsync(m => m.LegacyMemberId!.Value, m => m.MemberID);

                    var cmdDetails = new SqlCommand("SELECT Trans_id, L_id, Cust_id, Amount, Crdr FROM TRANS_DETAILS", conn);
                    using (var reader = await cmdDetails.ExecuteReaderAsync())
                    {
                        var newDetails = new List<VoucherDetail>();
                        while (await reader.ReadAsync())
                        {
                            int transId = reader["Trans_id"] != DBNull.Value ? Convert.ToInt32(reader["Trans_id"]) : 0;
                            int legacyLId = reader["L_id"] != DBNull.Value ? Convert.ToInt32(reader["L_id"]) : 0;
                            
                            if (!legacyVouchers.ContainsKey(transId) || !ledgerMap.ContainsKey(legacyLId))
                                continue; 
                                
                            int sysVoucherId = legacyVouchers[transId].VoucherID;
                            int sysLedgerId = ledgerMap[legacyLId];
                            decimal amt = reader["Amount"] != DBNull.Value ? Convert.ToDecimal(reader["Amount"]) : 0;
                            string crdr = reader["Crdr"].ToString()?.Trim().ToUpper() ?? "D";
                            crdr = (crdr == "C") ? "Cr" : "Dr";
                            
                            int? legacyCustId = reader["Cust_id"] != DBNull.Value ? Convert.ToInt32(reader["Cust_id"]) : (int?)null;
                            int? sysMemberId = null;
                            if (legacyCustId.HasValue && memberMap.ContainsKey(legacyCustId.Value))
                                sysMemberId = memberMap[legacyCustId.Value];

                            newDetails.Add(new VoucherDetail
                            {
                                VoucherID = sysVoucherId,
                                LedgerID = sysLedgerId,
                                MemberID = sysMemberId,
                                DrCr = crdr,
                                Amount = amt
                            });
                            importedVoucherDetails++;
                        }
                        
                        // We might want to batch this if the list is huge, but EF Core 7+ is good at batching.
                        _context.VoucherDetails.AddRange(newDetails);
                        await _context.SaveChangesAsync();
                    }
                }
                
                return Ok(new { message = $"Phase 2 Import completed! {importedOpeningBalances} Ledgers updated. {importedVouchers} Vouchers and {importedVoucherDetails} Voucher Details imported." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.InnerException?.ToString() ?? ex.ToString() });
            }
        }
    }

    public class LegacyDbRequest
    {
        public string FilePath { get; set; } = string.Empty;
    }
    
    public class SyncLedgersRequest : LegacyDbRequest
    {
        public Dictionary<int, int> MappedLedgers { get; set; } = new Dictionary<int, int>();
    }

    public class ImportMembersRequest : LegacyDbRequest
    {
        public int FinancialYearId { get; set; }
    }
}

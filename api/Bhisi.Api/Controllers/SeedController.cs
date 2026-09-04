using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class SeedController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SeedController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("FixVoucherStatus")]
        public async Task<IActionResult> FixVoucherStatus()
        {
            await _context.Database.ExecuteSqlRawAsync("UPDATE Vouchers SET Status = 'Approved' WHERE Status = '' OR Status IS NULL");
            return Ok("Fixed");
        }

        [HttpPost("FixMarathiNames")]
        public async Task<IActionResult> FixMarathiNames()
        {
            var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
            if (sanstha != null)
            {
                sanstha.SansthaName = "गुरुदेव कर्मचारी सहकारी संस्था";
                sanstha.Address = "मुख्य शाखा, सांगली";
                sanstha.District = "सांगली";
            }

            var branch = await _context.Branches.FirstOrDefaultAsync(b => b.BranchCode == "MAIN");
            if (branch != null)
            {
                branch.BranchName = "मुख्य शाखा";
            }

            await _context.SaveChangesAsync();
            return Ok("Marathi names fixed successfully");
        }

        [HttpPost("SeedAdmin")]
        public async Task<IActionResult> SeedAdmin()
        {
            var existingAdmin = await _context.Users.FirstOrDefaultAsync(u => u.Username == "admin");
            if (existingAdmin != null) return Ok("Admin already exists");

            var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "Admin");
            if (adminRole == null)
            {
                adminRole = new Role { RoleName = "Admin", Description = "System Administrator" };
                _context.Roles.Add(adminRole);
                await _context.SaveChangesAsync();
            }

            var adminUser = new User
            {
                Username = "admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                RoleID = adminRole.RoleID,
                IsActive = true,
                RequirePasswordChange = true,
                DefaultBranchID = null
            };
            
            _context.Users.Add(adminUser);
            await _context.SaveChangesAsync();
            return Ok("Admin created with username 'admin' and password 'admin123'");
        }
        [HttpPost("UnlockAdmin")]
        public async Task<IActionResult> UnlockAdmin()
        {
            var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == "admin");
            if (adminUser != null)
            {
                adminUser.IsLocked = false;
                adminUser.FailedLoginAttempts = 0;
                adminUser.IsActive = true;
                adminUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123");
                await _context.SaveChangesAsync();
                return Ok("Admin unlocked and password reset to admin123");
            }
            return NotFound("Admin not found");
        }


        [HttpPost]
        public async Task<IActionResult> Seed()
        {
            // 1. Create Groups
            var groupsToCreate = new List<(string Name, string Nature)>
            {
                ("वसुल भाग भांडवल", "Liabilities"),
                ("राखीव व इतर निधी", "Liabilities"),
                ("ठेवी", "Liabilities"),
                ("इतर देणे", "Liabilities"),
                
                ("रोख शिल्लक", "Assets"),
                ("बँकातील शिल्लक", "Assets"),
                ("गुंतवणूक", "Assets"),
                ("कर्जे", "Assets"),
                ("मालमत्ता", "Assets"),
                ("इतर येणे", "Assets"),

                ("मिळालेले व्याज", "Income"),
                ("गुंतवणूकीवरील लाभांश", "Income"),
                ("इतर उत्पन्न", "Income"),

                ("ठेवीवरील व्याज", "Expenses"),
                ("पगार व भत्ते", "Expenses"),
                ("स्टेशनरी व प्रिंटींग", "Expenses"),
                ("कर व वीज", "Expenses"),
                ("इतर किरकोळ खर्च", "Expenses")
            };

            var groupMap = new Dictionary<string, int>();

            foreach (var g in groupsToCreate)
            {
                var existing = _context.AccountGroups.FirstOrDefault(x => x.GroupName == g.Name);
                if (existing == null)
                {
                    existing = new AccountGroup { GroupName = g.Name, NatureOfGroup = g.Nature, IsActive = true };
                    _context.AccountGroups.Add(existing);
                    await _context.SaveChangesAsync();
                }
                groupMap[g.Name] = existing.GroupID;
            }

            // 2. Create Ledgers
            var ledgersToCreate = new List<(string Group, string Name, decimal OpeningBalance, string Type)>
            {
                ("वसुल भाग भांडवल", "१ सभासद भाग", 2292000.00m, "Cr"),
                
                ("राखीव व इतर निधी", "२ रिझर्व्ह फंड", 3470580.70m, "Cr"),
                ("राखीव व इतर निधी", "३ इमारत निधी (फंड)", 6325960.00m, "Cr"),
                ("राखीव व इतर निधी", "४ लाभांश समीकरण निधी", 400000.00m, "Cr"),
                ("राखीव व इतर निधी", "५ अधिलाभांश निधी", 800000.85m, "Cr"),
                
                ("ठेवी", "१० सेव्हींग ठेव", 2158210.00m, "Cr"),
                ("ठेवी", "११ श्री दत्त ठेव", 11876010.00m, "Cr"),
                ("ठेवी", "१२ मेंबर मुदत ठेव", 116925125.00m, "Cr"),

                ("इतर देणे", "२३ देणे सभासद ठेव व्याज", 0.00m, "Cr"),
                ("इतर देणे", "३२ सभासद अनामत", 28188.00m, "Cr"),
                
                ("रोख शिल्लक", "५१ हातातील रोख शिल्लक", 100975.00m, "Dr"),
                
                ("बँकातील शिल्लक", "५३ नांदणी सह.बँक सेव्हिंग", 2106028.00m, "Dr"),
                ("बँकातील शिल्लक", "५४ सारस्वत बँक बचत", 111714.00m, "Dr"),
                ("बँकातील शिल्लक", "५५ बँक ऑफ महाराष्ट्र करंट", 245938.00m, "Dr"),
                ("बँकातील शिल्लक", "५६ विदर्भ कोकण ग्रामिण बँक", 47363.00m, "Dr"),
                
                ("गुंतवणूक", "५७ सां. जि. मध्य.बँक शेअर्स", 30000.00m, "Dr"),
                ("गुंतवणूक", "५९ सां. जि. मध्य.बँक कायम मुदत ठेव", 1800000.00m, "Dr"),
                ("गुंतवणूक", "६० सां. जि. मध्य.बँक रिझर्व्ह ठेव", 3300000.00m, "Dr"),
                ("गुंतवणूक", "६१ शेतकरी बँक मुदत ठेव", 35397.00m, "Dr"),
                
                ("कर्जे", "७१ मेंबर कर्ज", 85737782.00m, "Dr"),
                ("कर्जे", "७२ सोने तारण कर्ज", 4350555.00m, "Dr"),
                ("कर्जे", "७४ मुदत ठेव तारण कर्ज", 7475033.00m, "Dr"),
                
                ("मालमत्ता", "७९ जागा व इमारत", 2480983.65m, "Dr"),
                ("मालमत्ता", "८० संगणक", 73920.00m, "Dr"),
                
                ("इतर येणे", "८१ डेडस्टॉक", 121418.00m, "Dr"),
                ("इतर येणे", "९८ लाईट कनेक्शन डिपॉझीट", 1400.00m, "Dr"),

                // Income / Expenses (typically 0 opening balance for year, but adding for completeness)
                ("मिळालेले व्याज", "२०१ में व्याज सोने तारण", 0m, "Cr"),
                ("मिळालेले व्याज", "१९६ में व्याज मेंबर कर्जे", 0m, "Cr"),
                
                ("ठेवीवरील व्याज", "१३२ मुदत ठेवीवरील व्याज", 0m, "Dr"),
                ("ठेवीवरील व्याज", "१३३ दामदुप्पट ठेवीवरिल व्याज", 0m, "Dr"),

                ("पगार व भत्ते", "१४१ नोकर पगार", 0m, "Dr"),

                ("स्टेशनरी व प्रिंटींग", "१४८ स्टेशनरी खर्च", 0m, "Dr"),
                ("कर व वीज", "१५१ लाईट बील", 0m, "Dr"),
                ("इतर किरकोळ खर्च", "३० बँक व्याज नावे", 0m, "Dr")
            };

            foreach (var l in ledgersToCreate)
            {
                int gId = groupMap[l.Group];
                var existing = _context.Ledgers.FirstOrDefault(x => x.LedgerName == l.Name);
                if (existing == null)
                {
                    existing = new Ledger
                    {
                        LedgerName = l.Name,
                        GroupID = gId,
                        OpeningBalance = l.OpeningBalance,
                        OpeningBalanceType = l.Type,
                        IsActive = true
                    };
                    _context.Ledgers.Add(existing);
                }
            }

            await _context.SaveChangesAsync();

            // Also seed a few vouchers for Income / Expense to test P&L
            var mLoanInt = _context.Ledgers.FirstOrDefault(x => x.LedgerName == "१९६ में व्याज मेंबर कर्जे");
            var fdInt = _context.Ledgers.FirstOrDefault(x => x.LedgerName == "१३२ मुदत ठेवीवरील व्याज");
            var cash = _context.Ledgers.FirstOrDefault(x => x.LedgerName == "५१ हातातील रोख शिल्लक");

            if (mLoanInt != null && cash != null && !_context.Vouchers.Any(v => v.Narration == "Test Income Seed"))
            {
                var vInc = new Voucher
                {
                    VoucherNo = "V-INC-01",
                    VoucherDate = DateTime.Today,
                    VoucherType = "Receipt",
                    Narration = "Test Income Seed",
                    TotalAmount = 5000,
                    CreatedBy = 1,
                    CreatedOn = DateTime.Now,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = cash.LedgerID, DrCr = "Dr", Amount = 5000 },
                        new VoucherDetail { LedgerID = mLoanInt.LedgerID, DrCr = "Cr", Amount = 5000 }
                    }
                };
                _context.Vouchers.Add(vInc);
            }

            if (fdInt != null && cash != null && !_context.Vouchers.Any(v => v.Narration == "Test Expense Seed"))
            {
                var vExp = new Voucher
                {
                    VoucherNo = "V-EXP-01",
                    VoucherDate = DateTime.Today,
                    VoucherType = "Payment",
                    Narration = "Test Expense Seed",
                    TotalAmount = 2000,
                    CreatedBy = 1,
                    CreatedOn = DateTime.Now,
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = fdInt.LedgerID, DrCr = "Dr", Amount = 2000 },
                        new VoucherDetail { LedgerID = cash.LedgerID, DrCr = "Cr", Amount = 2000 }
                    }
                };
                _context.Vouchers.Add(vExp);
            }

            await _context.SaveChangesAsync();

            return Ok("Database seeded successfully with PDF data.");
        }

        [HttpPost("FixCIFs")]
        public async Task<IActionResult> FixCIFs()
        {
            var members = _context.Members.Where(m => string.IsNullOrEmpty(m.CIFNo)).ToList();
            foreach(var member in members)
            {
                member.CIFNo = "CIF" + member.MemberID.ToString("D6");
            }
            await _context.SaveChangesAsync();
            return Ok($"Fixed {members.Count} members.");
        }
        [HttpPost("FixLegacySavingAccounts")]
        public async Task<IActionResult> FixLegacySavingAccounts()
        {
            var legacyAccounts = await _context.SavingAccountMasters
                .Where(a => a.IsLegacyAccount && a.OpeningBalance > 0)
                .ToListAsync();

            int count = 0;
            foreach(var acc in legacyAccounts)
            {
                var hasTxn = await _context.SavingTransactions.AnyAsync(t => t.SavingAccountID == acc.SavingAccountID && t.Narration == "Opening Balance");
                if (!hasTxn)
                {
                    var txn = new SavingTransaction
                    {
                        SavingAccountID = acc.SavingAccountID,
                        CustomerID = acc.CustomerID,
                        TransactionDate = acc.OpeningDate,
                        TransactionType = "Deposit",
                        PaymentMode = "Cash",
                        Amount = acc.OpeningBalance,
                        BalanceAfterTxn = acc.OpeningBalance,
                        Narration = "Opening Balance",
                        CreatedBy = acc.CreatedBy,
                        CreatedOn = DateTime.Now
                    };
                    _context.SavingTransactions.Add(txn);
                    count++;
                }
            }
            await _context.SaveChangesAsync();
            return Ok($"Fixed {count} legacy saving accounts.");
        }

        [HttpPost("SeedDemoData")]
        public async Task<IActionResult> SeedDemoData()
        {
            try
            {
                // 1. Sanstha Master
                var sanstha = await _context.SansthaDetails.FirstOrDefaultAsync();
                if (sanstha == null)
                {
                    sanstha = new SansthaDetail
                    {
                        SansthaName = "श्री गणेश नागरी सहकारी पतसंस्था मर्यादित, पुणे",
                        RegistrationNo = "PNE/PNE/PAT/1234/2015",
                        Address = "१०५, शुक्रवार पेठ, शिवाजी रोड, पुणे",
                        Email = "info@ganeshpatpedhi.org",
                        State = "महाराष्ट्र",
                        District = "पुणे",
                        Taluka = "हवेली",
                        PinCode = "411002"
                    };
                    _context.SansthaDetails.Add(sanstha);
                    await _context.SaveChangesAsync();
                }

                // 2. Branch Master
                var branch = await _context.Branches.FirstOrDefaultAsync();
                if (branch == null)
                {
                    branch = new Branch
                    {
                        BranchCode = "BR01",
                        BranchName = "मुख्य शाखा - पुणे",
                        Address = "१०५, शुक्रवार पेठ, पुणे",
                        IsActive = true
                    };
                    _context.Branches.Add(branch);
                    await _context.SaveChangesAsync();
                }

                // 3. Admin User
                var adminRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleName == "Admin") 
                                ?? new Role { RoleName = "Admin", Description = "System Administrator" };
                if (adminRole.RoleID == 0) { _context.Roles.Add(adminRole); await _context.SaveChangesAsync(); }

                var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == "admin");
                if (adminUser == null)
                {
                    adminUser = new User
                    {
                        Username = "admin",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                        RoleID = adminRole.RoleID,
                        IsActive = true,
                        RequirePasswordChange = false,
                        DefaultBranchID = branch.BranchID
                    };
                    _context.Users.Add(adminUser);
                    await _context.SaveChangesAsync();
                }

                // 4. Financial Year
                var activeFy = await _context.FinancialYears.FirstOrDefaultAsync(f => f.IsActive)
                               ?? await _context.FinancialYears.FirstOrDefaultAsync();
                if (activeFy == null)
                {
                    activeFy = new FinancialYear
                    {
                        YearCode = "2025-26",
                        StartDate = new DateTime(2025, 4, 1),
                        EndDate = new DateTime(2026, 3, 31),
                        IsActive = true,
                        IsClosed = false
                    };
                    _context.FinancialYears.Add(activeFy);
                    await _context.SaveChangesAsync();
                }

                // 5. Groups & Ledgers
                var assetGroup = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == "रोख व बँक शिल्लक" || g.GroupName == "रोख शिल्लक")
                                 ?? new AccountGroup { GroupName = "रोख व बँक शिल्लक", NatureOfGroup = "Assets" };
                if (assetGroup.GroupID == 0) { _context.AccountGroups.Add(assetGroup); await _context.SaveChangesAsync(); }

                var liabGroup = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == "ठेवी" || g.GroupName == "सभासद ठेवी")
                                ?? new AccountGroup { GroupName = "ठेवी", NatureOfGroup = "Liabilities" };
                if (liabGroup.GroupID == 0) { _context.AccountGroups.Add(liabGroup); await _context.SaveChangesAsync(); }

                var loanGroup = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == "कर्जे")
                                ?? new AccountGroup { GroupName = "कर्जे", NatureOfGroup = "Assets" };
                if (loanGroup.GroupID == 0) { _context.AccountGroups.Add(loanGroup); await _context.SaveChangesAsync(); }

                var shareGroup = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == "वसुल भाग भांडवल")
                                 ?? new AccountGroup { GroupName = "वसुल भाग भांडवल", NatureOfGroup = "Liabilities" };
                if (shareGroup.GroupID == 0) { _context.AccountGroups.Add(shareGroup); await _context.SaveChangesAsync(); }

                var incGroup = await _context.AccountGroups.FirstOrDefaultAsync(g => g.GroupName == "मिळालेले व्याज" || g.GroupName == "उत्पन्न")
                               ?? new AccountGroup { GroupName = "मिळालेले व्याज", NatureOfGroup = "Income" };
                if (incGroup.GroupID == 0) { _context.AccountGroups.Add(incGroup); await _context.SaveChangesAsync(); }

                // Standard Ledgers
                var cashLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("रोख शिल्लक") || l.LedgerName.Contains("Cash"))
                                 ?? new Ledger { LedgerName = "रोख शिल्लक (Cash in Hand)", GroupID = assetGroup.GroupID, OpeningBalance = 500000, OpeningBalanceType = "Dr" };
                if (cashLedger.LedgerID == 0) { _context.Ledgers.Add(cashLedger); await _context.SaveChangesAsync(); }

                var bankLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("बँक ऑफ महाराष्ट्र"))
                                 ?? new Ledger { LedgerName = "बँक ऑफ महाराष्ट्र चालू खाते", GroupID = assetGroup.GroupID, OpeningBalance = 1500000, OpeningBalanceType = "Dr" };
                if (bankLedger.LedgerID == 0) { _context.Ledgers.Add(bankLedger); await _context.SaveChangesAsync(); }

                var savingLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("बचत ठेव"))
                                   ?? new Ledger { LedgerName = "बचत ठेव (Saving Deposit)", GroupID = liabGroup.GroupID, OpeningBalance = 0, OpeningBalanceType = "Cr" };
                if (savingLedger.LedgerID == 0) { _context.Ledgers.Add(savingLedger); await _context.SaveChangesAsync(); }

                var shareLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("शेअर भांडवल"))
                                  ?? new Ledger { LedgerName = "सभासद शेअर भांडवल", GroupID = shareGroup.GroupID, OpeningBalance = 0, OpeningBalanceType = "Cr" };
                if (shareLedger.LedgerID == 0) { _context.Ledgers.Add(shareLedger); await _context.SaveChangesAsync(); }

                // 5.1 Saving Interest Setting
                var savingSetting = await _context.SavingInterestSettings.FirstOrDefaultAsync();
                if (savingSetting == null)
                {
                    savingSetting = new SavingInterestSetting
                    {
                        InterestRate = 4.0m,
                        CalculationMethod = "DailyProduct",
                        PostingFrequency = "Quarterly",
                        EffectiveDate = new DateTime(2025, 4, 1),
                        LedgerID = savingLedger.LedgerID,
                        SavingLiabilityLedgerID = savingLedger.LedgerID
                    };
                    _context.SavingInterestSettings.Add(savingSetting);
                    await _context.SaveChangesAsync();
                }

                // 5.1.1 Saving Voucher Mappings (ClosingCharges, SavingControl)
                var closingChargeMapping = await _context.SavingVoucherMappings.FirstOrDefaultAsync(m => m.OperationType == "ClosingCharges");
                if (closingChargeMapping == null)
                {
                    var feeLedger = await _context.Ledgers.FirstOrDefaultAsync(l => l.LedgerName.Contains("इतर फी") || l.LedgerName.Contains("Closing Charges") || l.AccountType == "Income") ?? savingLedger;
                    _context.SavingVoucherMappings.Add(new SavingVoucherMapping
                    {
                        OperationType = "ClosingCharges",
                        LedgerID = feeLedger.LedgerID,
                        Description = "बचत खाते बंद करताना आकारण्यात येणारे क्लोजिंग शुल्क उत्पन्न"
                    });
                }

                var savingControlMapping = await _context.SavingVoucherMappings.FirstOrDefaultAsync(m => m.OperationType == "SavingControl");
                if (savingControlMapping == null)
                {
                    _context.SavingVoucherMappings.Add(new SavingVoucherMapping
                    {
                        OperationType = "SavingControl",
                        LedgerID = savingLedger.LedgerID,
                        Description = "सर्वसाधारण बचत ठेव देयता खाते (Saving Control Liability)"
                    });
                }
                await _context.SaveChangesAsync();

                // 5.2 Fixed Deposit (FD) Schemes
                var fdScheme1 = await _context.FdSchemes.FirstOrDefaultAsync(s => s.SchemeCode == "FD-12M");
                if (fdScheme1 == null)
                {
                    _context.FdSchemes.Add(new FdScheme
                    {
                        InstitutionID = 1,
                        BranchID = branch.BranchID,
                        SchemeCode = "FD-12M",
                        SchemeName = "धनलक्ष्मी मुदत ठेव योजना (१२ महिने)",
                        DurationMonths = 12,
                        InterestRate = 9.5m,
                        SeniorCitizenInterestRate = 10.0m
                    });
                }
                var fdScheme2 = await _context.FdSchemes.FirstOrDefaultAsync(s => s.SchemeCode == "FD-24M");
                if (fdScheme2 == null)
                {
                    _context.FdSchemes.Add(new FdScheme
                    {
                        InstitutionID = 1,
                        BranchID = branch.BranchID,
                        SchemeCode = "FD-24M",
                        SchemeName = "कल्याण मुदत ठेव योजना (२४ महिने)",
                        DurationMonths = 24,
                        InterestRate = 10.5m,
                        SeniorCitizenInterestRate = 11.0m
                    });
                }
                await _context.SaveChangesAsync();

                // 5.3 Recurring Deposit (RD) Schemes
                var rdScheme1 = await _context.RdSchemes.FirstOrDefaultAsync(s => s.SchemeCode == "RD-12M");
                if (rdScheme1 == null)
                {
                    _context.RdSchemes.Add(new RdScheme
                    {
                        InstitutionID = 1,
                        BranchID = branch.BranchID,
                        SchemeCode = "RD-12M",
                        SchemeName = "लखपती आवर्ती ठेव योजना (१२ महिने)",
                        DurationMonths = 12,
                        InstallmentAmount = 1000m,
                        MinimumInstallment = 100m
                    });
                }
                var rdScheme2 = await _context.RdSchemes.FirstOrDefaultAsync(s => s.SchemeCode == "RD-24M");
                if (rdScheme2 == null)
                {
                    _context.RdSchemes.Add(new RdScheme
                    {
                        InstitutionID = 1,
                        BranchID = branch.BranchID,
                        SchemeCode = "RD-24M",
                        SchemeName = "सौभाग्य आवर्ती ठेव योजना (२४ महिने)",
                        DurationMonths = 24,
                        InstallmentAmount = 2000m,
                        MinimumInstallment = 200m
                    });
                }
                await _context.SaveChangesAsync();

                // 5.4 Pigmy Schemes
                var pigmyScheme = await _context.PigmySchemes.FirstOrDefaultAsync(s => s.SchemeName.Contains("पिग्मी"));
                if (pigmyScheme == null)
                {
                    _context.PigmySchemes.Add(new PigmyScheme
                    {
                        SchemeName = "दैनिक बचत पिग्मी योजना (३६५ दिवस)",
                        DurationMonths = 12,
                        InterestRate = 6.0m,
                        Status = "Active"
                    });
                    await _context.SaveChangesAsync();
                }

                // 5.5 Loan Rates & Schemes
                var loanRate1 = await _context.LoanRates.FirstOrDefaultAsync(l => l.LoanCode == "LN-PERS");
                if (loanRate1 == null)
                {
                    _context.LoanRates.Add(new LoanRate
                    {
                        LoanType = "वैयक्तिक कर्ज योजना",
                        LoanCode = "LN-PERS",
                        InterestRate = 12.0m,
                        OverdueInterestRate = 2.0m,
                        InterestPostingFrequency = "मासिक",
                        InterestCalculationMethod = "Reducing"
                    });
                }
                var loanRate2 = await _context.LoanRates.FirstOrDefaultAsync(l => l.LoanCode == "LN-GOLD");
                if (loanRate2 == null)
                {
                    _context.LoanRates.Add(new LoanRate
                    {
                        LoanType = "सुवर्ण तारण कर्ज योजना",
                        LoanCode = "LN-GOLD",
                        InterestRate = 10.5m,
                        OverdueInterestRate = 2.0m,
                        InterestPostingFrequency = "मासिक",
                        InterestCalculationMethod = "Reducing"
                    });
                }
                var loanRate3 = await _context.LoanRates.FirstOrDefaultAsync(l => l.LoanCode == "LN-VEH");
                if (loanRate3 == null)
                {
                    _context.LoanRates.Add(new LoanRate
                    {
                        LoanType = "वाहन कर्ज योजना",
                        LoanCode = "LN-VEH",
                        InterestRate = 11.0m,
                        OverdueInterestRate = 2.0m,
                        InterestPostingFrequency = "मासिक",
                        InterestCalculationMethod = "Reducing"
                    });
                }
                await _context.SaveChangesAsync();

                // 6. Members Seeding (10 Members)
                var demoMembersData = new List<(string Code, string First, string Middle, string Last, string Mobile, string City, string Aadhaar)>
                {
                    ("M-101", "रमेश", "ज्ञानदेव", "पाटील", "9822012345", "कोल्हापूर", "990112345601"),
                    ("M-102", "सचिन", "मारुती", "शिंदे", "9822023456", "पुणे", "990112345602"),
                    ("M-103", "अनिता", "सुरेश", "देशमुख", "9822034567", "सातारा", "990112345603"),
                    ("M-104", "विजय", "बाळासाहेब", "चव्हाण", "9822045678", "सांगली", "990112345604"),
                    ("M-105", "प्रकाश", "आनंदा", "जाधव", "9822056789", "नाशिक", "990112345605"),
                    ("M-106", "सुनीता", "रामचंद्र", "कांबळे", "9822067890", "सोलापूर", "990112345606"),
                    ("M-107", "गणेश", "विठ्ठल", "मोरे", "9822078901", "अहमदनगर", "990112345607"),
                    ("M-108", "दिपक", "किसन", "पवार", "9822089012", "पुणे", "990112345608"),
                    ("M-109", "नीलेश", "जयसिंग", "जगताप", "9822090123", "बारामती", "990112345609"),
                    ("M-110", "वर्षा", "संभाजी", "कदम", "9822101234", "औरंगाबाद", "990112345610")
                };

                var memberList = new List<Member>();
                foreach (var item in demoMembersData)
                {
                    var existingM = await _context.Members.FirstOrDefaultAsync(m => m.MemberCode == item.Code);
                    if (existingM == null)
                    {
                        existingM = new Member
                        {
                            MemberCode = item.Code,
                            FirstName = item.First,
                            MiddleName = item.Middle,
                            LastName = item.Last,
                            MobileNo = item.Mobile,
                            AadhaarNo = item.Aadhaar,
                            Address = $"{item.City}, महाराष्ट्र",
                            BranchID = branch.BranchID,
                            JoiningDate = DateTime.Today.AddDays(-120)
                        };
                        _context.Members.Add(existingM);
                        await _context.SaveChangesAsync();

                        // Member Opening Balance
                        _context.MemberOpeningBalances.Add(new MemberOpeningBalance
                        {
                            MemberID = existingM.MemberID,
                            LedgerID = shareLedger.LedgerID,
                            Amount = 5000,
                            BalanceType = "Cr"
                        });
                    }
                    memberList.Add(existingM);
                }
                await _context.SaveChangesAsync();

                // 7. Saving Accounts Seeding (10 Accounts)
                int accCounter = 1001;
                foreach (var member in memberList)
                {
                    string accNo = $"SB-{accCounter++}";
                    var existingAcc = await _context.SavingAccountMasters.FirstOrDefaultAsync(s => s.AccountNo == accNo);
                    if (existingAcc == null)
                    {
                        existingAcc = new SavingAccountMaster
                        {
                            AccountNo = accNo,
                            CustomerID = member.CustomerID ?? 1,
                            MemberID = member.MemberID,
                            BranchID = branch.BranchID,
                            LedgerID = savingLedger.LedgerID,
                            OpeningBalance = 1000,
                            CurrentBalance = 15000,
                            OpeningDate = DateTime.Today.AddDays(-90)
                        };
                        _context.SavingAccountMasters.Add(existingAcc);
                        await _context.SaveChangesAsync();

                        // Add initial deposit transaction
                        _context.SavingTransactions.Add(new SavingTransaction
                        {
                            SavingAccountID = existingAcc.SavingAccountID,
                            CustomerID = member.CustomerID ?? 1,
                            TransactionDate = DateTime.Today.AddDays(-30),
                            TransactionType = "Deposit",
                            Amount = 14000,
                            PaymentMode = "Cash",
                            Narration = "आरंभीची ठेवा रोख जमा"
                        });
                    }
                }
                await _context.SaveChangesAsync();

                // 8. Sample Receipt & Payment Vouchers
                var ramesh = memberList[0];
                var receiptVoucher = new Voucher
                {
                    VoucherNo = $"BR01/{activeFy.YearCode}/REC/000001",
                    VoucherType = "Receipt",
                    VoucherDate = DateTime.Today,
                    BranchID = branch.BranchID,
                    TotalAmount = 25000,
                    Narration = "सभासद ठेवी रोख जमा वॉउचर",
                    Status = "Approved",
                    VoucherDetails = new List<VoucherDetail>
                    {
                        new VoucherDetail { LedgerID = cashLedger.LedgerID, DrCr = "Dr", Amount = 25000 },
                        new VoucherDetail { LedgerID = savingLedger.LedgerID, MemberID = ramesh.MemberID, DrCr = "Cr", Amount = 25000 }
                    }
                };
                _context.Vouchers.Add(receiptVoucher);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    Success = true,
                    Message = "सॉफ्टवेअर प्रात्यक्षिकासाठी (Demo Data) वास्तववादी १० सभासद, बचत खाती व वॉउचर्स यशस्वीपणे समाविष्ट केले!",
                    Sanstha = sanstha.SansthaName,
                    Branch = branch.BranchName,
                    TotalMembers = await _context.Members.CountAsync(),
                    TotalSavingAccounts = await _context.SavingAccountMasters.CountAsync(),
                    TotalVouchers = await _context.Vouchers.CountAsync(),
                    AdminCredentials = "Username: admin | Password: admin123"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Success = false, Message = $"Error seeding demo data: {ex.Message}" });
            }
        }

        [HttpPost("ResetDatabase")]
        public async Task<IActionResult> ResetDatabase()
        {
            try
            {
                // Disable foreign key constraints temporarily
                await _context.Database.ExecuteSqlRawAsync("EXEC sp_MSforeachtable \"ALTER TABLE ? NOCHECK CONSTRAINT ALL\";");

                // Clear Savings module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingTransactions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingPassbooks;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingInterestPostings;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingAccountClosings;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingAccountJointHolders;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingVoucherMappings;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingAccountMasters;");

                // Clear Loans module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanCollectionFees;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanCollections;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanInstallmentSchedules;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanDisbursementDeductions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanDisbursements;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM GoldLoanDetails;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanDocuments;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanAccounts;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanApplications;");

                // Clear Fixed Deposits module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM FdTransactions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM FdInterestAccruals;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM FdAccounts;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM FdAccountSequences;");

                // Clear Recurring Deposits module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM RdTransactions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM RdInterestAccruals;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM RdAccounts;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM RdAccountSequences;");

                // Clear Pigmy Deposits module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyTransactions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyCollections;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyVoucherMappings;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyOpeningBalances;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyInterestLogs;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyAgentCommissions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyAgentCashDeposits;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyAccounts;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyAgents;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM PigmyAccountSequences;");

                // Clear Investments module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM InvestmentInterestReceipts;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM InvestmentInterestAccruals;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM InvestmentMaturities;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM InvestmentRenewals;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM InvestmentPrematureWithdrawals;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM InvestmentVoucherMappings;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM InvestmentAccounts;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM InvestmentAccountSequences;");

                // Clear Shares module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM ShareTransactions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM ShareCertificates;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM ShareCertificatePrintHistories;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM DividendDistributions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM ShareAccounts;");

                // Clear Asset Management module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM AssetPurchases;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM AssetAllocations;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM AssetTransfers;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM AssetMaintenances;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM AssetDepreciations;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM AssetVerifications;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM AssetDisposals;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM Assets;");

                // Clear Demand & Recovery module
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM DemandMemberDetails;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM DemandRecoveries;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM DemandNotices;");

                // Clear NPA & Overdue Tracking
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM CollateralComplianceLogs;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM LoanAccountNpaStatuses;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM NpaClassificationRuns;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM OverdueInterestLedgers;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM OverdueRecoveryLedgers;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM BorrowerLinkedAccounts;");

                // Clear Accounting Vouchers
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM VoucherDetails;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM Vouchers;");

                // Clear Members
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM MemberOpeningBalances;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM CommitteeMembers;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM EmployeeBankDetails;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM Members;");

                // Clear Logs & Audits
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM AuditLogs;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SystemNotifications;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM UserLoginAudits;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM EodBatchProcessLogs;");

                // Re-enable foreign key constraints
                await _context.Database.ExecuteSqlRawAsync("EXEC sp_MSforeachtable \"ALTER TABLE ? CHECK CONSTRAINT ALL\";");

                // Ensure Admin User exists and is unlocked for login
                await SeedAdmin();

                return Ok(new
                {
                    Success = true,
                    Message = "डेटाबेस पूर्णपणे रिकामा (Blank Clean Database) केला गेला आहे! सर्व व्यवहार, खाती व सभासद माहिती हटवली आहे. लॉगिनसाठी ॲडमिन खाते आणि मास्टर कॉन्फिगरेशन सुरक्षित आहे.",
                    AdminCredentials = "Username: admin | Password: admin123"
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { Success = false, Message = $"Error resetting database: {ex.Message}" });
            }
        }

        [HttpPost("ClearSavingModule")]
        public async Task<IActionResult> ClearSavingModule()
        {
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // 1. Temporarily disable foreign key constraints
                await _context.Database.ExecuteSqlRawAsync("EXEC sp_MSforeachtable \"ALTER TABLE ? NOCHECK CONSTRAINT ALL\";");

                // 2. Delete Saving Vouchers & details (Vouchers with VoucherNo starting with 'VCH-SAV-' or 'PV-SAV-')
                await _context.Database.ExecuteSqlRawAsync(@"
                    DELETE FROM VoucherDetails WHERE VoucherID IN (SELECT VoucherID FROM Vouchers WHERE VoucherNo LIKE '%SAV%');
                    DELETE FROM Vouchers WHERE VoucherNo LIKE '%SAV%';
                ");

                // 3. Clear Saving module tables (DO NOT DELETE Ledgers as requested)
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingPassbooks;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingVoucherMappings;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingAccountJointHolders;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingAccountClosings;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingTransactions;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingAccountMasters;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingInterestPostings;");
                await _context.Database.ExecuteSqlRawAsync("DELETE FROM SavingInterestSettings;");

                // 4. Clean up MemberOpeningBalances for Saving Ledgers if any
                await _context.Database.ExecuteSqlRawAsync(@"
                    DELETE FROM MemberOpeningBalances WHERE LedgerID IN (SELECT LedgerID FROM Ledgers WHERE LedgerName LIKE '%बचत%' OR LedgerName LIKE '%Saving%');
                ");

                // 5. Re-enable foreign key constraints
                await _context.Database.ExecuteSqlRawAsync("EXEC sp_MSforeachtable \"ALTER TABLE ? CHECK CONSTRAINT ALL\";");

                await transaction.CommitAsync();

                return Ok(new
                {
                    Success = true,
                    Message = "बचत ठेव (Saving Deposit Module) मधील सर्व खाती, व्यवहार, व्याज मोजणी नोंदी आणि व्याज योजना (Schemes) यशस्वीरीत्या पुसून (Clear) टाकल्या आहेत! (लेजर खाती पूर्णपणे सुरक्षित आहेत)."
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { Success = false, Message = $"बचत ठेव डेटा क्लिअर करताना त्रुटी आली: {ex.Message}" });
            }
        }
    }
}


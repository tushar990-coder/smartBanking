using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.IdentityModel.Tokens;

namespace AuditRunner
{
    class Program
    {
        static async Task<int> Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine("================================================================================");
            Console.WriteLine(" 🌐 CORE BANKING REST API SYSTEM AUDIT & ENDPOINT VERIFICATION");
            Console.WriteLine(" Host URL: http://127.0.0.1:5242");
            Console.WriteLine(" Timestamp: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            Console.WriteLine("================================================================================\n");

            // 1. Generate valid Admin JWT Token
            var keyStr = "BhisiSoftware-SecureMasterKey-2026-ShriUpdated-MinLength32Chars!";
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(keyStr);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, "1"),
                    new Claim(ClaimTypes.Name, "admin"),
                    new Claim(ClaimTypes.Role, "Admin"),
                    new Claim("BranchID", "1")
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);
            var jwtToken = tokenHandler.WriteToken(token);

            Console.WriteLine($"[INFO] Generated Admin Test JWT Bearer Token for API Authentication.\n");

            using var http = new HttpClient { BaseAddress = new Uri("http://127.0.0.1:5242"), Timeout = TimeSpan.FromSeconds(15) };
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwtToken);

            // Wait for API to be available
            int waitSeconds = 0;
            bool connected = false;
            while (waitSeconds < 15)
            {
                try
                {
                    var ping = await http.GetAsync("/api/Branches");
                    if (ping.IsSuccessStatusCode)
                    {
                        connected = true;
                        break;
                    }
                }
                catch { }
                await Task.Delay(1000);
                waitSeconds++;
            }

            if (!connected)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] Could not connect to API server at http://127.0.0.1:5242");
                Console.ResetColor();
                return 1;
            }

            Console.WriteLine($"[INFO] Connected to API server successfully! Starting endpoint audit...\n");

            // 2. Endpoint Audit List
            var endpointsToAudit = new List<(string Name, string Url, string Module)>
            {
                // Customer & Member
                ("Customers List", "/api/Customers?branchId=1", "Customer (CIF)"),
                ("Members List", "/api/Members?branchId=1", "Shareholder (Member)"),
                ("Member Opening Balances", "/api/MemberOpeningBalances", "Shareholder"),

                // Pigmy Module
                ("Pigmy Accounts List", "/api/PigmyAccounts?branchId=1", "Pigmy (पिग्मी ठेव)"),
                ("Pigmy Schemes List", "/api/PigmySchemes", "Pigmy Schemes"),
                ("Pigmy Agents List", "/api/PigmyAgents?branchId=1", "Pigmy Agents"),

                // Saving Module
                ("Saving Accounts List", "/api/SavingAccounts?branchId=1", "Savings (बचत खाते)"),
                ("Saving Transactions", "/api/SavingTransactions?savingAccountId=1", "Savings Transactions"),

                // FD & RD Module
                ("FD Accounts List", "/api/FdAccounts?branchId=1", "Fixed Deposit (मुदत ठेव)"),
                ("FD Schemes List", "/api/FdSchemes", "FD Schemes"),
                ("RD Accounts List", "/api/RdAccounts?branchId=1", "Recurring Deposit (आवर्ती ठेव)"),
                ("RD Schemes List", "/api/RdSchemes", "RD Schemes"),

                // Loan Module
                ("Loan Applications", "/api/LoanApplications?branchId=1", "Loan Applications"),
                ("Loan Pending Disbursements", "/api/LoanApplications/pending-disbursements?branchId=1", "Loan Applications"),
                ("Loan Accounts List", "/api/LoanAccounts?branchId=1", "Loan Accounts"),
                ("Loan Rates Master", "/api/LoanRates", "Loan Schemes & Rates"),
                ("Security Types", "/api/SecurityTypes", "Loan Securities"),

                // Locker Module
                ("Locker Allotments List", "/api/LockerAllotments?branchId=1", "Locker Management"),
                ("Lockers Inventory", "/api/Lockers?branchId=1", "Lockers"),
                ("Locker Types", "/api/LockerTypes", "Locker Types"),

                // Core Masters & Accounts
                ("Branches List", "/api/Branches", "Core Masters"),
                ("Ledgers List", "/api/Ledgers", "Accounts & GL"),
                ("Account Groups", "/api/AccountGroups", "Accounts & GL"),
                ("Financial Years", "/api/FinancialYears", "Core Masters"),
                ("Committee Members", "/api/CommitteeMembers", "Governance"),
                ("Sanstha Details", "/api/SansthaDetails", "Sanstha Profile"),
                ("Bank Masters", "/api/BankMasters", "Banking"),
                ("Department Master", "/api/DepartmentMaster", "Core Masters"),
                ("License Info", "/api/License/status", "System & Licensing")
            };

            int passed = 0;
            int failed = 0;

            Console.WriteLine("--------------------------------------------------------------------------------");
            Console.WriteLine(" AUDITING CONTROLLER ENDPOINTS (HTTP STATUS, TIMING & PAYLOAD)");
            Console.WriteLine("--------------------------------------------------------------------------------");

            foreach (var ep in endpointsToAudit)
            {
                var sw = Stopwatch.StartNew();
                try
                {
                    var res = await http.GetAsync(ep.Url);
                    sw.Stop();
                    var content = await res.Content.ReadAsStringAsync();
                    int byteSize = Encoding.UTF8.GetByteCount(content);

                    if (res.IsSuccessStatusCode)
                    {
                        passed++;
                        Console.ForegroundColor = ConsoleColor.Green;
                        Console.Write(" [200 OK] ");
                        Console.ResetColor();
                        Console.WriteLine($"[{ep.Module,-18}] {ep.Name,-26} -> {sw.ElapsedMilliseconds,4}ms | Size: {byteSize,6} B | URL: {ep.Url}");
                    }
                    else
                    {
                        failed++;
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.Write($" [{(int)res.StatusCode} {res.StatusCode}] ");
                        Console.ResetColor();
                        Console.WriteLine($"[{ep.Module,-18}] {ep.Name,-26} -> {sw.ElapsedMilliseconds,4}ms | URL: {ep.Url} | Response: {(content.Length > 80 ? content.Substring(0, 80) + "..." : content)}");
                    }
                }
                catch (Exception ex)
                {
                    sw.Stop();
                    failed++;
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.Write(" [ERROR]  ");
                    Console.ResetColor();
                    Console.WriteLine($"[{ep.Module,-18}] {ep.Name,-26} -> Exception: {ex.Message} | URL: {ep.Url}");
                }
            }

            Console.WriteLine("\n================================================================================");
            Console.WriteLine($" 🏁 API AUDIT SUMMARY: TOTAL = {endpointsToAudit.Count} | PASSED = {passed} | FAILED = {failed} | SUCCESS RATE = {(passed * 100 / endpointsToAudit.Count)}%");
            Console.WriteLine("================================================================================\n");

            return failed > 0 ? 1 : 0;
        }
    }
}

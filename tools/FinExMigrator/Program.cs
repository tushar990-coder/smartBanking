using System;
using System.Collections.Generic;
using System.Data;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace FinExMigrator
{
    class Program
    {
        static string sourceConnStr = "Server=.;Database=FinEx;Trusted_Connection=True;Encrypt=False;";
        static string targetConnStr = "Server=.;Database=SmartBanking_FinEx;Trusted_Connection=True;Encrypt=False;";

        static void Main(string[] args)
        {
            Console.OutputEncoding = System.Text.Encoding.UTF8;
            Console.WriteLine("==========================================================");
            Console.WriteLine("  FinEx to SmartBanking_FinEx Direct Migration Engine     ");
            Console.WriteLine("==========================================================");

            try
            {
                if (args.Length > 0 && (args[0] == "--dry-run" || args[0] == "--fix-db"))
                {
                    using var fixConn = new SqlConnection(targetConnStr);
                    fixConn.Open();
                    CleanDatabaseMarathi(fixConn, args[0] == "--fix-db");
                    return;
                }

                using var sourceConn = new SqlConnection(sourceConnStr);
                using var targetConn = new SqlConnection(targetConnStr);
                sourceConn.Open();
                targetConn.Open();

                // 0. Sanstha & Branch Info from BANK_DETAILS
                Console.WriteLine("\n[0/10] Migrating Sanstha & Branch Details...");
                MigrateSansthaAndBranch(sourceConn, targetConn);
                Console.WriteLine("  ✓ Sanstha & Branch info synchronized.");

                // 1. Financial Years
                Console.WriteLine("\n[1/10] Migrating Financial Years...");
                int fyCount = MigrateFinancialYears(sourceConn, targetConn);
                Console.WriteLine($"  ✓ Financial Years imported: {fyCount}");

                // 2. Masters (Employers & Ledger Groups)
                Console.WriteLine("\n[2/10] Migrating Employers & Account Groups...");
                var (empCount, grpCount) = MigrateMasters(sourceConn, targetConn);
                Console.WriteLine($"  ✓ Employers: {empCount}, Account Groups: {grpCount}");

                // 3. Ledgers
                Console.WriteLine("\n[3/10] Migrating Ledgers...");
                int ledgerCount = MigrateLedgers(sourceConn, targetConn);
                Console.WriteLine($"  ✓ Ledgers imported: {ledgerCount}");

                // 4. Loan Rates / Types
                Console.WriteLine("\n[4/10] Migrating Loan Types...");
                var loanRateMap = MigrateLoanRates(sourceConn, targetConn);
                Console.WriteLine($"  ✓ Loan Rates mapped: {loanRateMap.Count}");

                // 5. Agents
                Console.WriteLine("\n[5/10] Migrating Agents...");
                var agentMap = MigrateAgents(sourceConn, targetConn);
                Console.WriteLine($"  ✓ Agents mapped: {agentMap.Count}");

                // 6. Customers & Members
                Console.WriteLine("\n[6/10] Migrating Customers & Members (Converting ISM font -> Unicode)...");
                using (var cleanCmd = new SqlCommand(@"
                    DELETE FROM PigmyAccounts;
                    DELETE FROM FdAccounts;
                    DELETE FROM ShareAccounts;
                    DELETE FROM LoanAccounts;
                    DELETE FROM SavingAccountMasters;", targetConn))
                {
                    cleanCmd.ExecuteNonQuery();
                }
                var (custMap, memMap) = MigrateCustomersAndMembers(sourceConn, targetConn);
                Console.WriteLine($"  ✓ Customers: {custMap.Count}, Members: {memMap.Count}");

                // 7. Savings Accounts
                Console.WriteLine("\n[7/10] Migrating Savings Accounts...");
                int savCount = MigrateSavingsAccounts(sourceConn, targetConn, custMap);
                Console.WriteLine($"  ✓ Savings Accounts imported: {savCount}");

                // 8. Loan Accounts
                Console.WriteLine("\n[8/10] Migrating Loan Accounts (KARZ_ROKHA)...");
                int loanCount = MigrateLoanAccounts(sourceConn, targetConn, custMap, memMap, loanRateMap);
                Console.WriteLine($"  ✓ Loan Accounts imported: {loanCount}");

                // 9. Shares Allocation
                Console.WriteLine("\n[9/10] Migrating Share Accounts...");
                int shareCount = MigrateShareAccounts(sourceConn, targetConn, custMap, memMap);
                Console.WriteLine($"  ✓ Share Accounts imported: {shareCount}");

                // 10. Pigmy & FD Accounts
                Console.WriteLine("\n[10/10] Migrating Pigmy & FD Accounts...");
                int pigmyCount = MigratePigmyAccounts(sourceConn, targetConn, custMap, agentMap);
                int fdCount = MigrateFdAccounts(sourceConn, targetConn, custMap);
                Console.WriteLine($"  ✓ Pigmy Accounts: {pigmyCount}, FD Accounts: {fdCount}");

                Console.WriteLine("\n==========================================================");
                Console.WriteLine("  MIGRATION SUCCESSFULLY COMPLETED!                       ");
                Console.WriteLine("==========================================================");
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"\nFATAL ERROR: {ex.Message}\n{ex.StackTrace}");
                Console.ResetColor();
            }
        }

        static void MigrateSansthaAndBranch(SqlConnection src, SqlConnection tgt)
        {
            string sansthaName = "";
            string regNo = "";
            DateTime? regDate = null;
            using (var cmdSrc = new SqlCommand("SELECT TOP 1 Bank_name, Reg_no, Reg_date FROM BANK_DETAILS", src))
            using (var r = cmdSrc.ExecuteReader())
            {
                if (r.Read())
                {
                    sansthaName = MarathiUnicodeEngine.ConvertFromRawIsm(r["Bank_name"]?.ToString() ?? "");
                    regNo = r["Reg_no"]?.ToString()?.Trim() ?? "";
                    if (r["Reg_date"] != DBNull.Value) regDate = Convert.ToDateTime(r["Reg_date"]);
                }
            }

            string branchName = "मुख्य शाखा (Main Branch)";
            string address = "मु. पो. यड्राव, ता. शिरोळ, जि. कोल्हापूर";
            string contact = "7841901899";
            using (var cmdBr = new SqlCommand("SELECT TOP 1 Branch_name, Contact_no FROM BRANCH_DETAILS WHERE Is_main_branch = 1", src))
            using (var r = cmdBr.ExecuteReader())
            {
                if (r.Read())
                {
                    string brRaw = r["Branch_name"]?.ToString() ?? "";
                    if (!string.IsNullOrWhiteSpace(brRaw)) branchName = MarathiUnicodeEngine.ConvertFromRawIsm(brRaw) + " (Main Branch)";
                    string c = r["Contact_no"]?.ToString()?.Trim() ?? "";
                    if (!string.IsNullOrWhiteSpace(c)) contact = c;
                }
            }

            if (!string.IsNullOrWhiteSpace(sansthaName))
            {
                using var updSanstha = new SqlCommand(@"
                    IF EXISTS (SELECT 1 FROM SansthaDetails WHERE SansthaID = 1)
                    BEGIN
                        UPDATE SansthaDetails SET 
                            SansthaName = @name,
                            RegistrationNo = @regNo,
                            RegistrationDate = ISNULL(@regDate, RegistrationDate),
                            Address = @add,
                            Village = N'यड्राव',
                            Taluka = N'शिरोळ',
                            District = N'कोल्हापूर',
                            State = N'महाराष्ट्र',
                            ContactNo = @contact
                        WHERE SansthaID = 1;
                    END
                    ELSE
                    BEGIN
                        INSERT INTO SansthaDetails (SansthaID, SansthaName, RegistrationNo, RegistrationDate, Address, Village, Taluka, District, State, ContactNo, AutoPostVouchers, AutoPostVoucherLimit)
                        VALUES (1, @name, @regNo, ISNULL(@regDate, GETDATE()), @add, N'यड्राव', N'शिरोळ', N'कोल्हापूर', N'महाराष्ट्र', @contact, 1, 50000);
                    END", tgt);
                updSanstha.Parameters.AddWithValue("@name", sansthaName);
                updSanstha.Parameters.AddWithValue("@regNo", regNo);
                updSanstha.Parameters.AddWithValue("@regDate", (object)regDate ?? DBNull.Value);
                updSanstha.Parameters.AddWithValue("@add", address);
                updSanstha.Parameters.AddWithValue("@contact", contact);
                updSanstha.ExecuteNonQuery();

                using var updBranch = new SqlCommand(@"
                    IF EXISTS (SELECT 1 FROM Branches WHERE BranchID = 1)
                    BEGIN
                        UPDATE Branches SET 
                            BranchName = @bname,
                            Address = @add,
                            MobileNo = @contact
                        WHERE BranchID = 1;
                    END", tgt);
                updBranch.Parameters.AddWithValue("@bname", branchName);
                updBranch.Parameters.AddWithValue("@add", address);
                updBranch.Parameters.AddWithValue("@contact", contact);
                updBranch.ExecuteNonQuery();
            }
        }

        static int MigrateFinancialYears(SqlConnection src, SqlConnection tgt)
        {
            int count = 0;
            using var cmdSrc = new SqlCommand("SELECT Year_id, Start_date, End_date, Status FROM YEAR_INFO", src);
            using var reader = cmdSrc.ExecuteReader();
            var list = new List<(string code, DateTime s, DateTime e, bool active)>();
            while (reader.Read())
            {
                var s = Convert.ToDateTime(reader["Start_date"]);
                var e = Convert.ToDateTime(reader["End_date"]);
                var st = reader["Status"]?.ToString() == "1";
                list.Add(($"{s.Year}-{e.Year}", s, e, st));
            }
            reader.Close();

            foreach (var item in list)
            {
                using var checkCmd = new SqlCommand("SELECT COUNT(*) FROM FinancialYears WHERE StartDate = @s", tgt);
                checkCmd.Parameters.AddWithValue("@s", item.s);
                if (Convert.ToInt32(checkCmd.ExecuteScalar()) == 0)
                {
                    using var insCmd = new SqlCommand(@"
                        INSERT INTO FinancialYears (YearCode, StartDate, EndDate, IsActive, IsClosed)
                        VALUES (@c, @s, @e, @a, 0)", tgt);
                    insCmd.Parameters.AddWithValue("@c", item.code);
                    insCmd.Parameters.AddWithValue("@s", item.s);
                    insCmd.Parameters.AddWithValue("@e", item.e);
                    insCmd.Parameters.AddWithValue("@a", item.active);
                    insCmd.ExecuteNonQuery();
                    count++;
                }
            }
            return count;
        }

        static (int employers, int groups) MigrateMasters(SqlConnection src, SqlConnection tgt)
        {
            int emp = 0, grp = 0;
            using (var cmdSrc = new SqlCommand("SELECT Cust_type_id, Cust_type FROM CUST_TYPE_MASTER", src))
            using (var r = cmdSrc.ExecuteReader())
            {
                var emps = new List<(int id, string name)>();
                while (r.Read())
                {
                    emps.Add((Convert.ToInt32(r["Cust_type_id"]), IsmConverter.Convert(r["Cust_type"]?.ToString() ?? "")));
                }
                r.Close();

                foreach (var (id, name) in emps)
                {
                    using var checkCmd = new SqlCommand("SELECT COUNT(*) FROM EmployerMasters WHERE LegacyTypeId = @id", tgt);
                    checkCmd.Parameters.AddWithValue("@id", id);
                    if (Convert.ToInt32(checkCmd.ExecuteScalar()) == 0)
                    {
                        using var ins = new SqlCommand("INSERT INTO EmployerMasters (LegacyTypeId, Name, IsActive, CreatedAt) VALUES (@id, @name, 1, GETDATE())", tgt);
                        ins.Parameters.AddWithValue("@id", id);
                        ins.Parameters.AddWithValue("@name", name);
                        ins.ExecuteNonQuery();
                        emp++;
                    }
                }
            }

            using (var cmdSrc = new SqlCommand("SELECT L_group_id, L_group_name FROM LEDGER_GROUP", src))
            using (var r = cmdSrc.ExecuteReader())
            {
                var groups = new List<(int id, string name)>();
                while (r.Read())
                {
                    groups.Add((Convert.ToInt32(r["L_group_id"]), IsmConverter.Convert(r["L_group_name"]?.ToString() ?? "")));
                }
                r.Close();

                foreach (var (id, name) in groups)
                {
                    using var checkCmd = new SqlCommand("SELECT COUNT(*) FROM AccountGroups WHERE LegacyGroupId = @id", tgt);
                    checkCmd.Parameters.AddWithValue("@id", id);
                    if (Convert.ToInt32(checkCmd.ExecuteScalar()) == 0)
                    {
                        using var ins = new SqlCommand("INSERT INTO AccountGroups (GroupName, NatureOfGroup, IsActive, LegacyGroupId, DisplayOrder) VALUES (@name, 'Assets', 1, @id, 0)", tgt);
                        ins.Parameters.AddWithValue("@id", id);
                        ins.Parameters.AddWithValue("@name", name);
                        ins.ExecuteNonQuery();
                        grp++;
                    }
                }
            }
            return (emp, grp);
        }

        static int MigrateLedgers(SqlConnection src, SqlConnection tgt)
        {
            // Map LegacyGroupId to Target GroupID
            var groupMap = new Dictionary<int, int>();
            using (var cmd = new SqlCommand("SELECT GroupID, LegacyGroupId FROM AccountGroups WHERE LegacyGroupId IS NOT NULL", tgt))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read()) groupMap[Convert.ToInt32(r["LegacyGroupId"])] = Convert.ToInt32(r["GroupID"]);
            }
            int defaultGroupId = 1;
            using (var cmd = new SqlCommand("SELECT TOP 1 GroupID FROM AccountGroups", tgt))
            {
                var obj = cmd.ExecuteScalar();
                if (obj != null) defaultGroupId = Convert.ToInt32(obj);
            }

            int count = 0;
            using (var cmdSrc = new SqlCommand("SELECT Ledger_id, Ledger_name, Ledger_group_id FROM LEDGER", src))
            using (var r = cmdSrc.ExecuteReader())
            {
                var ledgers = new List<(int id, string name, int? grpId)>();
                while (r.Read())
                {
                    int? g = r["Ledger_group_id"] != DBNull.Value ? Convert.ToInt32(r["Ledger_group_id"]) : (int?)null;
                    ledgers.Add((Convert.ToInt32(r["Ledger_id"]), IsmConverter.Convert(r["Ledger_name"]?.ToString() ?? ""), g));
                }
                r.Close();

                foreach (var (id, name, grpId) in ledgers)
                {
                    int mappedGrp = (grpId.HasValue && groupMap.ContainsKey(grpId.Value)) ? groupMap[grpId.Value] : defaultGroupId;
                    using var checkCmd = new SqlCommand("SELECT COUNT(*) FROM Ledgers WHERE LegacyLedgerId = @id", tgt);
                    checkCmd.Parameters.AddWithValue("@id", id);
                    if (Convert.ToInt32(checkCmd.ExecuteScalar()) == 0)
                    {
                        using var ins = new SqlCommand(@"
                            INSERT INTO Ledgers (LedgerName, GroupID, OpeningBalance, OpeningBalanceType, IsActive, LegacyLedgerId, DisplayOrder, ExcludeFromRule35Swanidhi)
                            VALUES (@name, @grp, 0, 'Dr', 1, @id, 0, 0)", tgt);
                        ins.Parameters.AddWithValue("@name", name);
                        ins.Parameters.AddWithValue("@grp", mappedGrp);
                        ins.Parameters.AddWithValue("@id", id);
                        ins.ExecuteNonQuery();
                        count++;
                    }
                }
            }
            return count;
        }

        static Dictionary<int, int> MigrateLoanRates(SqlConnection src, SqlConnection tgt)
        {
            var map = new Dictionary<int, int>();
            using var cmdSrc = new SqlCommand("SELECT Loan_type_id, Loan_type FROM LOAN_TYPES", src);
            using var r = cmdSrc.ExecuteReader();
            var list = new List<(int id, string name)>();
            while (r.Read()) list.Add((Convert.ToInt32(r["Loan_type_id"]), IsmConverter.Convert(r["Loan_type"]?.ToString() ?? "")));
            r.Close();

            foreach (var (id, name) in list)
            {
                using var checkCmd = new SqlCommand("SELECT LoanRateID FROM LoanRates WHERE LoanType = @name", tgt);
                checkCmd.Parameters.AddWithValue("@name", name);
                var existing = checkCmd.ExecuteScalar();
                if (existing != null)
                {
                    map[id] = Convert.ToInt32(existing);
                }
                else
                {
                    using var ins = new SqlCommand(@"
                        INSERT INTO LoanRates (
                            LoanType, LoanCode, InterestRate, OverdueInterestRate, InterestPostingType,
                            InterestCalculationMethod, ShortName, DurationMonths, InstallmentType,
                            InstallmentCount, LoanInstallmentType, SecurityType, IsCcOrOd, IsActive,
                            InterestPostingFrequency
                        )
                        OUTPUT INSERTED.LoanRateID
                        VALUES (
                            @name, @code, 12.0, 2.0, 'Simple',
                            'Reducing', @sname, 12, 'Equated',
                            12, 'Monthly', 'Personal', 0, 1,
                            'Monthly'
                        )", tgt);
                    ins.Parameters.AddWithValue("@name", name);
                    ins.Parameters.AddWithValue("@code", "LT" + id);
                    ins.Parameters.AddWithValue("@sname", name.Length > 10 ? name.Substring(0, 10) : name);
                    int newId = Convert.ToInt32(ins.ExecuteScalar());
                    map[id] = newId;
                }
            }
            return map;
        }

        static Dictionary<int, int> MigrateAgents(SqlConnection src, SqlConnection tgt)
        {
            var map = new Dictionary<int, int>();
            using var cmdSrc = new SqlCommand("SELECT id, Code, F_name, M_name, L_name, Mobile_no FROM Agent_master", src);
            using var r = cmdSrc.ExecuteReader();
            var list = new List<(int id, string code, string name, string mobile)>();
            while (r.Read())
            {
                string fn = IsmConverter.Convert(r["F_name"]?.ToString() ?? "");
                string ln = IsmConverter.Convert(r["L_name"]?.ToString() ?? "");
                string fullName = (fn + " " + ln).Trim();
                list.Add((Convert.ToInt32(r["id"]), r["Code"]?.ToString()?.Trim() ?? ("AG" + r["id"]), fullName, r["Mobile_no"]?.ToString()?.Trim() ?? ""));
            }
            r.Close();

            foreach (var item in list)
            {
                using var checkCmd = new SqlCommand("SELECT PigmyAgentID FROM PigmyAgents WHERE Username = @c OR AgentName = @n", tgt);
                checkCmd.Parameters.AddWithValue("@c", item.code);
                checkCmd.Parameters.AddWithValue("@n", item.name);
                var existing = checkCmd.ExecuteScalar();
                if (existing != null)
                {
                    map[item.id] = Convert.ToInt32(existing);
                }
                else
                {
                    using var ins = new SqlCommand(@"
                        INSERT INTO PigmyAgents (
                            Username, AgentName, MobileNo, Status, BranchID, JoiningDate,
                            CreatedBy, CreatedDate, MaxCashLimit
                        )
                        OUTPUT INSERTED.PigmyAgentID
                        VALUES (
                            @c, @n, @m, 'Active', 1, @d,
                            1, GETDATE(), 50000.0
                        )", tgt);
                    ins.Parameters.AddWithValue("@c", item.code);
                    ins.Parameters.AddWithValue("@n", string.IsNullOrWhiteSpace(item.name) ? ("Agent " + item.code) : item.name);
                    ins.Parameters.AddWithValue("@m", string.IsNullOrEmpty(item.mobile) ? "0000000000" : item.mobile);
                    ins.Parameters.AddWithValue("@d", DateTime.Today);
                    int newId = Convert.ToInt32(ins.ExecuteScalar());
                    map[item.id] = newId;
                }
            }
            return map;
        }

        static (Dictionary<int, int> custMap, Dictionary<int, int> memMap) MigrateCustomersAndMembers(SqlConnection src, SqlConnection tgt)
        {
            var custMap = new Dictionary<int, int>(); // Legacy Cust_id -> Target CustomerID
            var memMap = new Dictionary<int, int>();  // Legacy Cust_id -> Target MemberID

            // 0. Clean any partial members / customers in target first
            using (var cleanCmd = new SqlCommand("DELETE FROM Members; DELETE FROM Customers;", tgt))
            {
                cleanCmd.ExecuteNonQuery();
            }

            // 1. Read existing employer mapping
            var empMap = new Dictionary<int, int>();
            using (var cmd = new SqlCommand("SELECT Id, LegacyTypeId FROM EmployerMasters WHERE LegacyTypeId IS NOT NULL", tgt))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read()) empMap[Convert.ToInt32(r["LegacyTypeId"])] = Convert.ToInt32(r["Id"]);
            }

            // 2. Read Sabhasad_info for Sabhasad_no
            var sabhasadNoMap = new Dictionary<int, string>();
            using (var cmd = new SqlCommand("SELECT Cust_id, Sabhasad_no FROM SABHASAD_INFO", src))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    int cId = Convert.ToInt32(r["Cust_id"]);
                    sabhasadNoMap[cId] = r["Sabhasad_no"]?.ToString() ?? cId.ToString();
                }
            }

            // 3. Read CUSTOMERS
            using (var cmdSrc = new SqlCommand(@"
                SELECT Cust_id, CIF, First_name, Middle_name, Last_name, Eng_first_nm, Eng_mid_nm, Eng_last_nm, 
                       Mobile_no, Adhar_no, Pan_no, DOB, Gender_id, Cust_type_id, Acc_open_date 
                FROM CUSTOMERS", src))
            using (var r = cmdSrc.ExecuteReader())
            {
                var customers = new List<dynamic>();
                while (r.Read())
                {
                    int cid = Convert.ToInt32(r["Cust_id"]);
                    string fn = IsmConverter.Convert(r["First_name"]?.ToString() ?? "");
                    string mn = IsmConverter.Convert(r["Middle_name"]?.ToString() ?? "");
                    string ln = IsmConverter.Convert(r["Last_name"]?.ToString() ?? "");
                    string fnEng = r["Eng_first_nm"]?.ToString()?.Trim() ?? "";
                    string mnEng = r["Eng_mid_nm"]?.ToString()?.Trim() ?? "";
                    string lnEng = r["Eng_last_nm"]?.ToString()?.Trim() ?? "";
                    string mob = r["Mobile_no"]?.ToString()?.Trim() ?? "";
                    string adh = r["Adhar_no"]?.ToString()?.Trim() ?? "";
                    string pan = r["Pan_no"]?.ToString()?.Trim() ?? "";
                    DateTime? dob = r["DOB"] != DBNull.Value ? Convert.ToDateTime(r["DOB"]) : (DateTime?)null;
                    DateTime regDate = r["Acc_open_date"] != DBNull.Value ? Convert.ToDateTime(r["Acc_open_date"]) : DateTime.Today;
                    int? gid = r["Gender_id"] != DBNull.Value ? Convert.ToInt32(r["Gender_id"]) : (int?)null;
                    int? typeId = r["Cust_type_id"] != DBNull.Value ? Convert.ToInt32(r["Cust_type_id"]) : (int?)null;

                    customers.Add(new {
                        CustId = cid,
                        CIF = r["CIF"]?.ToString() ?? cid.ToString(),
                        FirstName = fn, MiddleName = mn, LastName = ln,
                        FirstNameEng = fnEng, MiddleNameEng = mnEng, LastNameEng = lnEng,
                        Mobile = mob, Aadhaar = adh, PAN = pan, DOB = dob, RegDate = regDate,
                        Gender = gid == 2 ? "Female" : "Male",
                        TypeId = typeId
                    });
                }
                r.Close();

                foreach (var c in customers)
                {
                    int? employerId = (c.TypeId != null && empMap.ContainsKey((int)c.TypeId)) ? empMap[(int)c.TypeId] : (int?)null;
                    
                    // Insert Customer
                    using var insCust = new SqlCommand(@"
                        INSERT INTO Customers (
                            BranchID, CIFNo, FirstName, MiddleName, LastName, FirstNameEng, MiddleNameEng, LastNameEng,
                            MobileNo, AadhaarNo, PANNo, BirthDate, Gender, Status, CustomerType, KYCStatus, RiskCategory,
                            RegistrationDate, EmployerId, LegacyCustomerNo, IsDeleted, CreatedBy, CreatedOn
                        )
                        OUTPUT INSERTED.CustomerID
                        VALUES (
                            1, @cif, @fn, @mn, @ln, @fne, @mne, @lne,
                            @mob, @adh, @pan, @dob, @gen, 'Active', 'Member', 'Verified', 'Low',
                            @reg, @emp, @leg, 0, 1, GETDATE()
                        )", tgt);
                    
                    insCust.Parameters.AddWithValue("@cif", $"CIF{c.CustId:D6}");
                    insCust.Parameters.AddWithValue("@fn", string.IsNullOrWhiteSpace(c.FirstName) ? "सभासद" : c.FirstName);
                    insCust.Parameters.AddWithValue("@mn", (object)c.MiddleName ?? DBNull.Value);
                    insCust.Parameters.AddWithValue("@ln", string.IsNullOrWhiteSpace(c.LastName) ? "पाटील" : c.LastName);
                    insCust.Parameters.AddWithValue("@fne", (object)c.FirstNameEng ?? DBNull.Value);
                    insCust.Parameters.AddWithValue("@mne", (object)c.MiddleNameEng ?? DBNull.Value);
                    insCust.Parameters.AddWithValue("@lne", (object)c.LastNameEng ?? DBNull.Value);
                    insCust.Parameters.AddWithValue("@mob", string.IsNullOrEmpty(c.Mobile) ? "0000000000" : c.Mobile);
                    insCust.Parameters.AddWithValue("@adh", string.IsNullOrEmpty(c.Aadhaar) ? ("NA" + c.CustId) : c.Aadhaar);
                    insCust.Parameters.AddWithValue("@pan", (object)c.PAN ?? DBNull.Value);
                    insCust.Parameters.AddWithValue("@dob", (object)c.DOB ?? DBNull.Value);
                    insCust.Parameters.AddWithValue("@gen", c.Gender);
                    insCust.Parameters.AddWithValue("@reg", c.RegDate);
                    insCust.Parameters.AddWithValue("@emp", (object)employerId ?? DBNull.Value);
                    insCust.Parameters.AddWithValue("@leg", c.CustId.ToString());

                    int customerId = Convert.ToInt32(insCust.ExecuteScalar());
                    custMap[c.CustId] = customerId;

                    // Insert Member
                    string memNo = sabhasadNoMap.ContainsKey(c.CustId) ? sabhasadNoMap[c.CustId] : c.CustId.ToString();
                    using var insMem = new SqlCommand(@"
                        INSERT INTO Members (
                            BranchID, CustomerID, MemberCode, LegacyMemberNo, JoiningDate, Status, MembershipType,
                            IsDeleted, CreatedBy, CreatedOn
                        )
                        OUTPUT INSERTED.MemberID
                        VALUES (
                            1, @cid, @code, @leg, @join, 'Active', 'Regular',
                            0, 1, GETDATE()
                        )", tgt);
                    insMem.Parameters.AddWithValue("@cid", customerId);
                    insMem.Parameters.AddWithValue("@code", "M" + c.CustId);
                    insMem.Parameters.AddWithValue("@leg", memNo);
                    insMem.Parameters.AddWithValue("@join", c.RegDate);

                    int memberId = Convert.ToInt32(insMem.ExecuteScalar());
                    memMap[c.CustId] = memberId;
                }
            }
            return (custMap, memMap);
        }

        static int MigrateSavingsAccounts(SqlConnection src, SqlConnection tgt, Dictionary<int, int> custMap)
        {
            // Default Saving Ledger
            int defaultLedger = 1;
            using (var cmd = new SqlCommand("SELECT TOP 1 LedgerID FROM Ledgers WHERE LedgerName LIKE '%बचत%' OR LedgerName LIKE '%Saving%'", tgt))
            {
                var obj = cmd.ExecuteScalar();
                if (obj != null) defaultLedger = Convert.ToInt32(obj);
                else
                {
                    using var cmdFirst = new SqlCommand("SELECT TOP 1 LedgerID FROM Ledgers", tgt);
                    defaultLedger = Convert.ToInt32(cmdFirst.ExecuteScalar() ?? 1);
                }
            }

            int count = 0;
            using var cmdSrc = new SqlCommand(@"
                SELECT Acc_id, Cust_id, Acc_no, Acc_open_date, Opn_bal 
                FROM SAVING_ACCOUNT 
                ORDER BY CASE WHEN ISNUMERIC(Acc_no) = 1 THEN CAST(Acc_no AS INT) ELSE 999999 END ASC, Acc_open_date ASC, Acc_id ASC", src);
            using var r = cmdSrc.ExecuteReader();
            var list = new List<dynamic>();
            while (r.Read())
            {
                int cid = Convert.ToInt32(r["Cust_id"]);
                if (!custMap.ContainsKey(cid)) continue;
                list.Add(new {
                    AccId = Convert.ToInt32(r["Acc_id"]),
                    CustId = cid,
                    AccNo = r["Acc_no"]?.ToString() ?? "",
                    OpenDate = r["Acc_open_date"] != DBNull.Value ? Convert.ToDateTime(r["Acc_open_date"]) : DateTime.Today,
                    OpnBal = r["Opn_bal"] != DBNull.Value ? Convert.ToDecimal(r["Opn_bal"]) : 0m
                });
            }
            r.Close();

            int seq = 1;
            foreach (var item in list)
            {
                string standard14 = AccountNumberHelper.Format14Digit(AccountNumberHelper.Generate14DigitAccountNo(1, 101, seq));
                using var ins = new SqlCommand(@"
                    INSERT INTO SavingAccountMasters (
                        BranchID, CustomerID, AccountNo, AccountType, OpeningDate, IsLegacyAccount, LedgerID,
                        OpeningBalance, CurrentBalance, InterestRate, MinimumBalance, Status, CreatedBy, CreatedOn,
                        LegacyAccountId, LegacyAccountNumber, OldAccountNo, LienAmount
                    )
                    VALUES (
                        1, @cid, @acc, 'Regular', @opDate, 1, @lid,
                        @bal, @bal, 4.0, 500, 'Active', 1, GETDATE(),
                        @aid, @legAcc, @legAcc, 0
                    )", tgt);
                ins.Parameters.AddWithValue("@cid", custMap[item.CustId]);
                ins.Parameters.AddWithValue("@acc", standard14);
                ins.Parameters.AddWithValue("@opDate", item.OpenDate);
                ins.Parameters.AddWithValue("@lid", defaultLedger);
                ins.Parameters.AddWithValue("@bal", item.OpnBal);
                ins.Parameters.AddWithValue("@aid", item.AccId);
                ins.Parameters.AddWithValue("@legAcc", item.AccNo);
                ins.ExecuteNonQuery();
                seq++;
                count++;
            }

            if (count > 0)
            {
                using var updSeq = new SqlCommand(@"
                    IF EXISTS (SELECT 1 FROM SavingAccountSequences WHERE BranchID = 1 AND SchemeCodeNumeric = 101)
                        UPDATE SavingAccountSequences SET LastSequenceNumber = CASE WHEN @cur > LastSequenceNumber THEN @cur ELSE LastSequenceNumber END, UpdatedOn = GETDATE() WHERE BranchID = 1 AND SchemeCodeNumeric = 101;
                    ELSE
                        INSERT INTO SavingAccountSequences (BranchID, SchemeCodeNumeric, LastSequenceNumber, UpdatedOn) VALUES (1, 101, @cur, GETDATE());", tgt);
                updSeq.Parameters.AddWithValue("@cur", seq - 1);
                updSeq.ExecuteNonQuery();
            }
            return count;
        }

        static int MigrateLoanAccounts(SqlConnection src, SqlConnection tgt, Dictionary<int, int> custMap, Dictionary<int, int> memMap, Dictionary<int, int> loanRateMap)
        {
            int defaultRateId = loanRateMap.Count > 0 ? loanRateMap.Values.GetEnumerator().Current : 1;
            using (var cmd = new SqlCommand("SELECT TOP 1 LoanRateID FROM LoanRates", tgt))
            {
                var obj = cmd.ExecuteScalar();
                if (obj != null) defaultRateId = Convert.ToInt32(obj);
            }

            int count = 0;
            using var cmdSrc = new SqlCommand(@"
                SELECT KR.Kr_id, SA.Cust_id, KR.Loan_acc_no, KR.Loan_type_id, KR.Loan_date, KR.Loan_amt, KR.Intr_rate, KR.Tenure 
                FROM KARZ_ROKHA KR
                INNER JOIN SAVING_ACCOUNT SA ON KR.Saving_Acc_id = SA.Acc_id", src);
            using var r = cmdSrc.ExecuteReader();
            var list = new List<dynamic>();
            while (r.Read())
            {
                int cid = Convert.ToInt32(r["Cust_id"]);
                if (!custMap.ContainsKey(cid) || !memMap.ContainsKey(cid)) continue;
                list.Add(new {
                    KrId = Convert.ToInt32(r["Kr_id"]),
                    CustId = cid,
                    AccNo = r["Loan_acc_no"]?.ToString() ?? "",
                    TypeId = r["Loan_type_id"] != DBNull.Value ? Convert.ToInt32(r["Loan_type_id"]) : (int?)null,
                    Date = r["Loan_date"] != DBNull.Value ? Convert.ToDateTime(r["Loan_date"]) : DateTime.Today,
                    Amt = r["Loan_amt"] != DBNull.Value ? Convert.ToDecimal(r["Loan_amt"]) : 0m,
                    Rate = r["Intr_rate"] != DBNull.Value ? Convert.ToDecimal(r["Intr_rate"]) : 12m,
                    Tenure = r["Tenure"] != DBNull.Value ? Convert.ToInt32(r["Tenure"]) : 12
                });
            }
            r.Close();

            foreach (var item in list)
            {
                int rateId = (item.TypeId != null && loanRateMap.ContainsKey((int)item.TypeId)) ? loanRateMap[(int)item.TypeId] : defaultRateId;
                using var ins = new SqlCommand(@"
                    INSERT INTO LoanAccounts (
                        BranchID, CustomerID, MemberID, LoanRateID, LoanAccountNo, PrincipalBalance, InterestBalance,
                        OverdueInterestBalance, SanctionedAmount, InterestRate, DurationMonths, OpeningDate,
                        LoanDisbursementDate, InstallmentFrequency, InstallmentAmount, NoOfInstallments, SecurityValue,
                        IsOpeningBalance, Status, LegacyAccountId, LegacyAccountNumber
                    )
                    VALUES (
                        1, @cid, @mid, @lrid, @acc, @amt, 0,
                        0, @amt, @rate, @ten, @date,
                        @date, 'Monthly', 0, @ten, 0,
                        1, 'Active', @krid, @acc
                    )", tgt);
                ins.Parameters.AddWithValue("@cid", custMap[item.CustId]);
                ins.Parameters.AddWithValue("@mid", memMap[item.CustId]);
                ins.Parameters.AddWithValue("@lrid", rateId);
                ins.Parameters.AddWithValue("@acc", item.AccNo);
                ins.Parameters.AddWithValue("@amt", item.Amt);
                ins.Parameters.AddWithValue("@rate", item.Rate);
                ins.Parameters.AddWithValue("@ten", item.Tenure);
                ins.Parameters.AddWithValue("@date", item.Date);
                ins.Parameters.AddWithValue("@krid", item.KrId);
                ins.ExecuteNonQuery();
                count++;
            }
            return count;
        }

        static int MigrateShareAccounts(SqlConnection src, SqlConnection tgt, Dictionary<int, int> custMap, Dictionary<int, int> memMap)
        {
            int count = 0;
            using var cmdSrc = new SqlCommand(@"
                SELECT SA.Allocation_id, SI.Cust_id, SA.Date, SA.Quantity, SA.Amount, SA.No_from, SA.No_to 
                FROM SHARES_ALLOCATION SA
                INNER JOIN SABHASAD_INFO SI ON SA.Sabhasad_id = SI.Sabhasad_id", src);
            using var r = cmdSrc.ExecuteReader();
            var list = new List<dynamic>();
            while (r.Read())
            {
                int cid = Convert.ToInt32(r["Cust_id"]);
                if (!custMap.ContainsKey(cid) || !memMap.ContainsKey(cid)) continue;
                list.Add(new {
                    AllocId = Convert.ToInt32(r["Allocation_id"]),
                    CustId = cid,
                    Date = r["Date"] != DBNull.Value ? Convert.ToDateTime(r["Date"]) : DateTime.Today,
                    Qty = r["Quantity"] != DBNull.Value ? Convert.ToInt32(r["Quantity"]) : 1,
                    Amt = r["Amount"] != DBNull.Value ? Convert.ToDecimal(r["Amount"]) : 100m,
                    NoFrom = r["No_from"]?.ToString() ?? "",
                    NoTo = r["No_to"]?.ToString() ?? ""
                });
            }
            r.Close();

            foreach (var item in list)
            {
                using var ins = new SqlCommand(@"
                    INSERT INTO ShareAccounts (
                        CustomerID, MemberId, AccountNo, TotalShareAmount, TotalShareCount, DividendPayableBalance,
                        Status, OpeningDate, LegacyAccountId, LegacyAccountNumber
                    )
                    VALUES (
                        @cid, @mid, @acc, @amt, @qty, 0,
                        'Active', @date, @aid, @acc
                    )", tgt);
                ins.Parameters.AddWithValue("@cid", custMap[item.CustId]);
                ins.Parameters.AddWithValue("@mid", memMap[item.CustId]);
                ins.Parameters.AddWithValue("@acc", $"SH-{item.AllocId}");
                ins.Parameters.AddWithValue("@amt", item.Amt);
                ins.Parameters.AddWithValue("@qty", item.Qty);
                ins.Parameters.AddWithValue("@date", item.Date);
                ins.Parameters.AddWithValue("@aid", item.AllocId);
                ins.ExecuteNonQuery();
                count++;
            }
            return count;
        }

        static int MigratePigmyAccounts(SqlConnection src, SqlConnection tgt, Dictionary<int, int> custMap, Dictionary<int, int> agentMap)
        {
            int defaultAgent = agentMap.Count > 0 ? agentMap.Values.GetEnumerator().Current : 1;
            using (var cmd = new SqlCommand("SELECT TOP 1 PigmyAgentID FROM PigmyAgents", tgt))
            {
                var obj = cmd.ExecuteScalar();
                if (obj != null) defaultAgent = Convert.ToInt32(obj);
            }
            int defaultScheme = 1;
            using (var cmd = new SqlCommand("SELECT TOP 1 PigmySchemeID FROM PigmySchemes", tgt))
            {
                var obj = cmd.ExecuteScalar();
                if (obj != null) defaultScheme = Convert.ToInt32(obj);
                else
                {
                    using var insScheme = new SqlCommand(@"
                        INSERT INTO PigmySchemes (SchemeName, InterestRate, DurationMonths, Status, CreatedBy, CreatedDate)
                        OUTPUT INSERTED.PigmySchemeID
                        VALUES ('दैनिक पिग्मी ठेव (Legacy)', 0.0, 12, 'Active', 1, GETDATE())", tgt);
                    defaultScheme = Convert.ToInt32(insScheme.ExecuteScalar());
                }
            }

            int count = 0;
            using var cmdSrc = new SqlCommand("SELECT Pigmi_acc_id, Cust_id, Pigmi_acc_no, Pigmi_start_date, Pigmi_bal, Agent_id FROM PIGMI_ACCOUNT", src);
            using var r = cmdSrc.ExecuteReader();
            var list = new List<dynamic>();
            while (r.Read())
            {
                int cid = Convert.ToInt32(r["Cust_id"]);
                if (!custMap.ContainsKey(cid)) continue;
                list.Add(new {
                    AccId = Convert.ToInt32(r["Pigmi_acc_id"]),
                    CustId = cid,
                    AccNo = r["Pigmi_acc_no"]?.ToString() ?? "",
                    Date = r["Pigmi_start_date"] != DBNull.Value ? Convert.ToDateTime(r["Pigmi_start_date"]) : DateTime.Today,
                    Bal = r["Pigmi_bal"] != DBNull.Value ? Convert.ToDecimal(r["Pigmi_bal"]) : 0m,
                    AgentId = r["Agent_id"] != DBNull.Value ? Convert.ToInt32(r["Agent_id"]) : (int?)null
                });
            }
            r.Close();

            foreach (var item in list)
            {
                int agId = (item.AgentId != null && agentMap.ContainsKey((int)item.AgentId)) ? agentMap[(int)item.AgentId] : defaultAgent;
                using var ins = new SqlCommand(@"
                    INSERT INTO PigmyAccounts (
                        BranchID, CustomerID, AccountNo, PigmySchemeID, PigmyAgentID, OpeningDate, InterestRate,
                        MaturityDate, TotalDepositedAmount, Status, CreatedBy, CreatedDate, LegacyAccountId,
                        LegacyAccountNumber
                    )
                    VALUES (
                        1, @cid, @acc, @sid, @agid, @date, 0,
                        DATEADD(YEAR, 1, @date), @bal, 'Active', 1, GETDATE(), @aid, @acc
                    )", tgt);
                ins.Parameters.AddWithValue("@cid", custMap[item.CustId]);
                ins.Parameters.AddWithValue("@acc", item.AccNo);
                ins.Parameters.AddWithValue("@sid", defaultScheme);
                ins.Parameters.AddWithValue("@agid", agId);
                ins.Parameters.AddWithValue("@date", item.Date);
                ins.Parameters.AddWithValue("@bal", item.Bal);
                ins.Parameters.AddWithValue("@aid", item.AccId);
                ins.ExecuteNonQuery();
                count++;
            }
            return count;
        }

        static int MigrateFdAccounts(SqlConnection src, SqlConnection tgt, Dictionary<int, int> custMap)
        {
            int defaultScheme = 1;
            using (var cmd = new SqlCommand("SELECT TOP 1 FdSchemeID FROM FdSchemes", tgt))
            {
                var obj = cmd.ExecuteScalar();
                if (obj != null) defaultScheme = Convert.ToInt32(obj);
                else
                {
                    using var insScheme = new SqlCommand(@"
                        INSERT INTO FdSchemes (
                            InstitutionID, BranchID, SchemeCode, SchemeName, DurationMonths, InterestRate,
                            SeniorCitizenInterestRate, InterestType, InterestPostingMethod, InterestCompoundingFrequency,
                            MinimumAmount, MaximumAmount, PrematureInterestRate, EffectiveDate, IsActive, CreatedBy, CreatedDate
                        )
                        OUTPUT INSERTED.FdSchemeID
                        VALUES (
                            1, 1, 'FD-LEGACY', 'मुदत ठेव (Legacy)', 12, 7.5,
                            8.0, 'Cumulative', 'Simple', 'Quarterly',
                            1000.0, 10000000.0, 5.0, GETDATE(), 1, 1, GETDATE()
                        )", tgt);
                    defaultScheme = Convert.ToInt32(insScheme.ExecuteScalar());
                }
            }

            int count = 0;
            using var cmdSrc = new SqlCommand("SELECT Fd_acc_id, Fd_acc_no, Cust_id, Start_date, Fd_amt, Intr_rate, Maturity_date, Total_amt FROM FD_ACCOUNT", src);
            using var r = cmdSrc.ExecuteReader();
            var list = new List<dynamic>();
            while (r.Read())
            {
                int cid = Convert.ToInt32(r["Cust_id"]);
                if (!custMap.ContainsKey(cid)) continue;
                list.Add(new {
                    AccId = Convert.ToInt32(r["Fd_acc_id"]),
                    AccNo = r["Fd_acc_no"]?.ToString() ?? "",
                    CustId = cid,
                    Date = r["Start_date"] != DBNull.Value ? Convert.ToDateTime(r["Start_date"]) : DateTime.Today,
                    Amt = r["Fd_amt"] != DBNull.Value ? Convert.ToDecimal(r["Fd_amt"]) : 0m,
                    Rate = r["Intr_rate"] != DBNull.Value ? Convert.ToDecimal(r["Intr_rate"]) : 7m,
                    MatDate = r["Maturity_date"] != DBNull.Value ? Convert.ToDateTime(r["Maturity_date"]) : DateTime.Today.AddYears(1),
                    MatAmt = r["Total_amt"] != DBNull.Value ? Convert.ToDecimal(r["Total_amt"]) : 0m
                });
            }
            r.Close();

            int seq = 1;
            foreach (var item in list)
            {
                string standard14 = AccountNumberHelper.Format14Digit(AccountNumberHelper.Generate14DigitAccountNo(1, 401, seq));
                using var ins = new SqlCommand(@"
                    INSERT INTO FdAccounts (
                        InstitutionID, BranchID, FinancialYearID, FdSchemeID, CustomerID, AccountNo, OpeningDate,
                        DepositAmount, InterestRate, MaturityDate, MaturityAmount, IsLegacyAccount, LegacyAccruedInt, Status,
                        PaymentMode, CreatedBy, CreatedDate, LegacyAccountId, LegacyAccountNumber
                    )
                    VALUES (
                        1, 1, 1, @sid, @cid, @acc, @date,
                        @amt, @rate, @mdate, @mamt, 1, 0.0, 'Active',
                        'Cash', 1, GETDATE(), @aid, @legAcc
                    )", tgt);
                ins.Parameters.AddWithValue("@sid", defaultScheme);
                ins.Parameters.AddWithValue("@cid", custMap[item.CustId]);
                ins.Parameters.AddWithValue("@acc", standard14);
                ins.Parameters.AddWithValue("@date", item.Date);
                ins.Parameters.AddWithValue("@amt", item.Amt);
                ins.Parameters.AddWithValue("@rate", item.Rate);
                ins.Parameters.AddWithValue("@mdate", item.MatDate);
                ins.Parameters.AddWithValue("@mamt", item.MatAmt);
                ins.Parameters.AddWithValue("@aid", item.AccId);
                ins.Parameters.AddWithValue("@legAcc", item.AccNo);
                ins.ExecuteNonQuery();
                seq++;
                count++;
            }

            if (count > 0)
            {
                using var updSeq = new SqlCommand(@"
                    IF EXISTS (SELECT 1 FROM FdAccountSequences WHERE BranchID = 1 AND ProductType = 'FD')
                        UPDATE FdAccountSequences SET CurrentValue = CASE WHEN @cur > CurrentValue THEN @cur ELSE CurrentValue END WHERE BranchID = 1 AND ProductType = 'FD';
                    ELSE
                        INSERT INTO FdAccountSequences (BranchID, ProductType, CurrentValue) VALUES (1, 'FD', @cur);", tgt);
                updSeq.Parameters.AddWithValue("@cur", seq - 1);
                updSeq.ExecuteNonQuery();
            }
            return count;
        }

        static void CleanDatabaseMarathi(SqlConnection tgt, bool commitChanges)
        {
            Console.WriteLine(commitChanges 
                ? "\n>>> APPLYING MARATHI UNICODE FIX TO DATABASE <<<" 
                : "\n>>> RUNNING DRY-RUN PREVIEW (NO CHANGES WILL BE COMMITTED) <<<");

            using var trans = commitChanges ? tgt.BeginTransaction() : null;
            
            // 1. Customers
            int custChanged = 0;
            var custUpdates = new List<(int id, string fn, string mn, string ln)>();
            using (var cmd = new SqlCommand("SELECT CustomerID, FirstName, MiddleName, LastName FROM Customers", tgt, trans))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    int id = Convert.ToInt32(r["CustomerID"]);
                    string fn = r["FirstName"]?.ToString() ?? "";
                    string mn = r["MiddleName"]?.ToString() ?? "";
                    string ln = r["LastName"]?.ToString() ?? "";

                    string newFn = MarathiUnicodeEngine.CleanExistingText(fn);
                    string newMn = MarathiUnicodeEngine.CleanExistingText(mn);
                    string newLn = MarathiUnicodeEngine.CleanExistingText(ln);

                    if (newFn != fn || newMn != mn || newLn != ln)
                    {
                        custUpdates.Add((id, newFn, newMn, newLn));
                        custChanged++;
                        if (custChanged <= 10 || id == 1 || id == 2 || id == 3 || id == 11 || id == 14)
                        {
                            Console.WriteLine($"  [Customer #{id}]");
                            Console.WriteLine($"    Before: '{fn}' '{mn}' '{ln}'");
                            Console.WriteLine($"    After:  '{newFn}' '{newMn}' '{newLn}'");
                        }
                    }
                }
            }

            if (commitChanges)
            {
                foreach (var u in custUpdates)
                {
                    using var upd = new SqlCommand("UPDATE Customers SET FirstName = @fn, MiddleName = @mn, LastName = @ln WHERE CustomerID = @id", tgt, trans);
                    upd.Parameters.AddWithValue("@fn", u.fn);
                    upd.Parameters.AddWithValue("@mn", string.IsNullOrEmpty(u.mn) ? (object)DBNull.Value : u.mn);
                    upd.Parameters.AddWithValue("@ln", u.ln);
                    upd.Parameters.AddWithValue("@id", u.id);
                    upd.ExecuteNonQuery();
                }
            }
            Console.WriteLine($"\n  ✓ Total Customers to update: {custChanged}");

            // 2. Ledgers
            int ledgChanged = 0;
            var ledgUpdates = new List<(int id, string name)>();
            using (var cmd = new SqlCommand("SELECT LedgerID, LedgerName FROM Ledgers", tgt, trans))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    int id = Convert.ToInt32(r["LedgerID"]);
                    string name = r["LedgerName"]?.ToString() ?? "";
                    string newName = MarathiUnicodeEngine.CleanExistingText(name);
                    if (newName != name)
                    {
                        ledgUpdates.Add((id, newName));
                        ledgChanged++;
                        if (ledgChanged <= 5)
                        {
                            Console.WriteLine($"  [Ledger #{id}] '{name}' -> '{newName}'");
                        }
                    }
                }
            }

            if (commitChanges)
            {
                foreach (var u in ledgUpdates)
                {
                    using var upd = new SqlCommand("UPDATE Ledgers SET LedgerName = @name WHERE LedgerID = @id", tgt, trans);
                    upd.Parameters.AddWithValue("@name", u.name);
                    upd.Parameters.AddWithValue("@id", u.id);
                    upd.ExecuteNonQuery();
                }
            }
            Console.WriteLine($"  ✓ Total Ledgers to update: {ledgChanged}");

            // 3. EmployerMasters
            int empChanged = 0;
            var empUpdates = new List<(int id, string name)>();
            using (var cmd = new SqlCommand("SELECT Id, Name FROM EmployerMasters", tgt, trans))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    int id = Convert.ToInt32(r["Id"]);
                    string name = r["Name"]?.ToString() ?? "";
                    string newName = MarathiUnicodeEngine.CleanExistingText(name);
                    if (newName != name)
                    {
                        empUpdates.Add((id, newName));
                        empChanged++;
                        Console.WriteLine($"  [Employer #{id}] '{name}' -> '{newName}'");
                    }
                }
            }

            if (commitChanges)
            {
                foreach (var u in empUpdates)
                {
                    using var upd = new SqlCommand("UPDATE EmployerMasters SET Name = @name WHERE Id = @id", tgt, trans);
                    upd.Parameters.AddWithValue("@name", u.name);
                    upd.Parameters.AddWithValue("@id", u.id);
                    upd.ExecuteNonQuery();
                }
                trans?.Commit();
                Console.WriteLine("\n>>> DATABASE SUCCESSFULLY UPDATED AND COMMITTED! <<<");
            }
            else
            {
                Console.WriteLine("\n>>> DRY-RUN COMPLETE: NO CHANGES WERE WRITTEN TO DATABASE <<<");
            }
        }
    }

    public static class IsmConverter
    {
        public static string Convert(string ismText)
        {
            return MarathiUnicodeEngine.ConvertFromRawIsm(ismText);
        }
    }

    public static class AccountNumberHelper
    {
        public static int CalculateCheckDigit(string digits)
        {
            if (string.IsNullOrWhiteSpace(digits)) return 0;
            int sum = 0;
            bool alternate = true;
            for (int i = digits.Length - 1; i >= 0; i--)
            {
                if (!char.IsDigit(digits[i])) continue;
                int d = digits[i] - '0';
                if (alternate)
                {
                    d *= 2;
                    if (d > 9) d -= 9;
                }
                sum += d;
                alternate = !alternate;
            }
            int mod = sum % 10;
            return (mod == 0) ? 0 : 10 - mod;
        }

        public static string Generate14DigitAccountNo(int branchId, int schemeCodeNum, int sequenceNumber)
        {
            string branch3 = Math.Max(1, branchId).ToString("D3");
            string scheme3 = Math.Max(1, schemeCodeNum).ToString("D3");
            string seq7 = Math.Max(1, sequenceNumber).ToString("D7");
            string thirteen = $"{branch3}{scheme3}{seq7}";
            int checkDigit = CalculateCheckDigit(thirteen);
            return $"{thirteen}{checkDigit}";
        }

        public static string Format14Digit(string? accountNo)
        {
            if (string.IsNullOrWhiteSpace(accountNo)) return "-";
            var d = new string(accountNo.Where(char.IsDigit).ToArray());
            if (d.Length == 14)
            {
                return $"{d.Substring(0, 3)}-{d.Substring(3, 3)}-{d.Substring(6, 7)}-{d.Substring(13, 1)}";
            }
            return accountNo;
        }
    }
}

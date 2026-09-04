$head_name = -join [char[]]@(0x092e, 0x0941, 0x0916, 0x094d, 0x092f, 0x0020, 0x0915, 0x0945, 0x0936, 0x093f, 0x0905, 0x0930, 0x0020, 0x0028, 0x0048, 0x0065, 0x0061, 0x0064, 0x0020, 0x0043, 0x0061, 0x0073, 0x0068, 0x0069, 0x0065, 0x0072, 0x0029)
$head_cnt  = -join [char[]]@(0x0924, 0x093f, 0x091c, 0x094b, 0x0930, 0x0940, 0x0020, 0x0915, 0x0915, 0x094d, 0x0937, 0x0020, 0x0028, 0x004d, 0x0061, 0x0069, 0x006e, 0x0020, 0x0056, 0x0061, 0x0075, 0x006c, 0x0074, 0x0029)
$head_rem  = -join [char[]]@(0x092e, 0x0941, 0x0916, 0x094d, 0x092f, 0x0020, 0x0924, 0x093f, 0x091c, 0x094b, 0x0930, 0x0940, 0x0020, 0x0935, 0x0020, 0x092c, 0x0901, 0x0915, 0x0020, 0x0930, 0x094b, 0x0916, 0x0020, 0x0935, 0x094d, 0x092f, 0x0935, 0x0938, 0x094d, 0x0925, 0x093e, 0x092a, 0x0928)

$c1_name   = -join [char[]]@(0x0915, 0x093e, 0x0909, 0x0902, 0x091f, 0x0930, 0x0020, 0x0967, 0x0020, 0x0028, 0x091c, 0x092e, 0x093e, 0x002d, 0x0928, 0x093e, 0x0935, 0x0947, 0x0020, 0x091f, 0x0947, 0x0932, 0x0930, 0x0029)
$c1_cnt    = -join [char[]]@(0x0915, 0x093e, 0x0909, 0x0902, 0x091f, 0x0930, 0x0020, 0x0967)
$c1_rem    = -join [char[]]@(0x0926, 0x0948, 0x0928, 0x0902, 0x0926, 0x093f, 0x0928, 0x0020, 0x092c, 0x091a, 0x0924, 0x002c, 0x0020, 0x0920, 0x0947, 0x0935, 0x0020, 0x0935, 0x0020, 0x0915, 0x0930, 0x094d, 0x091c, 0x0020, 0x0930, 0x094b, 0x0916, 0x0020, 0x0935, 0x094d, 0x092f, 0x0935, 0x0939, 0x093e, 0x0930)

$c2_name   = -join [char[]]@(0x0915, 0x093e, 0x0909, 0x0902, 0x091f, 0x0930, 0x0020, 0x0968, 0x0020, 0x0028, 0x092a, 0x093f, 0x0917, 0x094d, 0x092e, 0x0940, 0x0020, 0x0935, 0x0020, 0x0907, 0x0924, 0x0930, 0x0020, 0x0938, 0x0902, 0x0915, 0x0932, 0x0928, 0x0029)
$c2_cnt    = -join [char[]]@(0x0915, 0x093e, 0x0909, 0x0902, 0x091f, 0x0930, 0x0020, 0x0968)
$c2_rem    = -join [char[]]@(0x092a, 0x093f, 0x0917, 0x094d, 0x092e, 0x0940, 0x0020, 0x090f, 0x091c, 0x0902, 0x091f, 0x0020, 0x0938, 0x0902, 0x0915, 0x0932, 0x0928, 0x0020, 0x0935, 0x0020, 0x0907, 0x0924, 0x0930, 0x0020, 0x0930, 0x094b, 0x0916, 0x0020, 0x092a, 0x093e, 0x0935, 0x0924, 0x094d, 0x092f, 0x093e)

$set_rem   = -join [char[]]@(0x092e, 0x0941, 0x0916, 0x094d, 0x092f, 0x0020, 0x0924, 0x093f, 0x091c, 0x094b, 0x0930, 0x0940, 0x0020, 0x0935, 0x0020, 0x0930, 0x094b, 0x0916, 0x0020, 0x092f, 0x094b, 0x091c, 0x0928, 0x093e, 0x0020, 0x0938, 0x0947, 0x091f, 0x093f, 0x0902, 0x0917)

$dbs = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")

foreach ($db in $dbs) {
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;")
        $conn.Open()
        
        # Clear tables
        $cmdDel = $conn.CreateCommand()
        $cmdDel.CommandText = "DELETE FROM Cashiers; DELETE FROM CashManagementSettings;"
        $cmdDel.ExecuteNonQuery()

        # Insert Cashier 1 (Head)
        $cmd1 = $conn.CreateCommand()
        $cmd1.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (1, @Name, @Counter, 1, 1, 2500000.00, @Remarks, GETDATE())"
        $cmd1.Parameters.Add("@Name", [System.Data.SqlDbType]::NVarChar, 100).Value = $head_name
        $cmd1.Parameters.Add("@Counter", [System.Data.SqlDbType]::NVarChar, 50).Value = $head_cnt
        $cmd1.Parameters.Add("@Remarks", [System.Data.SqlDbType]::NVarChar, 250).Value = $head_rem
        $cmd1.ExecuteNonQuery()

        # Insert Cashier 2 (Counter 1)
        $cmd2 = $conn.CreateCommand()
        $cmd2.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (1, @Name, @Counter, 0, 1, 500000.00, @Remarks, GETDATE())"
        $cmd2.Parameters.Add("@Name", [System.Data.SqlDbType]::NVarChar, 100).Value = $c1_name
        $cmd2.Parameters.Add("@Counter", [System.Data.SqlDbType]::NVarChar, 50).Value = $c1_cnt
        $cmd2.Parameters.Add("@Remarks", [System.Data.SqlDbType]::NVarChar, 250).Value = $c1_rem
        $cmd2.ExecuteNonQuery()

        # Insert Cashier 3 (Counter 2)
        $cmd3 = $conn.CreateCommand()
        $cmd3.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (1, @Name, @Counter, 0, 1, 300000.00, @Remarks, GETDATE())"
        $cmd3.Parameters.Add("@Name", [System.Data.SqlDbType]::NVarChar, 100).Value = $c2_name
        $cmd3.Parameters.Add("@Counter", [System.Data.SqlDbType]::NVarChar, 50).Value = $c2_cnt
        $cmd3.Parameters.Add("@Remarks", [System.Data.SqlDbType]::NVarChar, 250).Value = $c2_rem
        $cmd3.ExecuteNonQuery()

        # Insert Setting
        $cmdSet = $conn.CreateCommand()
        $cmdSet.CommandText = "INSERT INTO CashManagementSettings (BranchId, AutoGenerateVouchers, EnableDenominationMandatory, MaxBranchVaultLimit, DefaultCounterLimit, Remarks, LastUpdated) VALUES (1, 0, 1, 5000000.00, 500000.00, @Remarks, GETDATE())"
        $cmdSet.Parameters.Add("@Remarks", [System.Data.SqlDbType]::NVarChar, 250).Value = $set_rem
        $cmdSet.ExecuteNonQuery()

        Write-Host "PERFECT UNICODE APPLIED TO: $db" -ForegroundColor Green
        $conn.Close()
    } catch {
        Write-Host "Error for '$db': $($_.Exception.Message)" -ForegroundColor Red
    }
}

$databases = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")

foreach ($db in $databases) {
    $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        # 1. Clear garbled records
        $cmdDel = $conn.CreateCommand()
        $cmdDel.CommandText = "DELETE FROM Cashiers; DELETE FROM CashManagementSettings;"
        $cmdDel.ExecuteNonQuery()

        # 2. Insert Head Cashier
        $cmd1 = $conn.CreateCommand()
        $cmd1.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (1, @Name, @Counter, 1, 1, 2500000.00, @Remarks, GETDATE())"
        $cmd1.Parameters.AddWithValue("@Name", "मुख्य कॅशिअर (Head Cashier)")
        $cmd1.Parameters.AddWithValue("@Counter", "तिजोरी कक्ष (Main Vault)")
        $cmd1.Parameters.AddWithValue("@Remarks", "मुख्य तिजोरी व बँक रोख व्यवस्थापन")
        $cmd1.ExecuteNonQuery()

        # 3. Insert Counter 1
        $cmd2 = $conn.CreateCommand()
        $cmd2.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (1, @Name, @Counter, 0, 1, 500000.00, @Remarks, GETDATE())"
        $cmd2.Parameters.AddWithValue("@Name", "काउंटर १ (जमा-नावे टेलर)")
        $cmd2.Parameters.AddWithValue("@Counter", "काउंटर १")
        $cmd2.Parameters.AddWithValue("@Remarks", "दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार")
        $cmd2.ExecuteNonQuery()

        # 4. Insert Counter 2
        $cmd3 = $conn.CreateCommand()
        $cmd3.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (1, @Name, @Counter, 0, 1, 300000.00, @Remarks, GETDATE())"
        $cmd3.Parameters.AddWithValue("@Name", "काउंटर २ (पिग्मी व इतर संकलन)")
        $cmd3.Parameters.AddWithValue("@Counter", "काउंटर २")
        $cmd3.Parameters.AddWithValue("@Remarks", "पिग्मी एजंट संकलन व इतर रोख पावत्या")
        $cmd3.ExecuteNonQuery()

        # 5. Insert Scheme Settings
        $cmd4 = $conn.CreateCommand()
        $cmd4.CommandText = "INSERT INTO CashManagementSettings (BranchId, AutoGenerateVouchers, EnableDenominationMandatory, MaxBranchVaultLimit, DefaultCounterLimit, Remarks, LastUpdated) VALUES (1, 0, 1, 5000000.00, 500000.00, @Remarks, GETDATE())"
        $cmd4.Parameters.AddWithValue("@Remarks", "मुख्य तिजोरी व रोख योजना सेटिंग")
        $cmd4.ExecuteNonQuery()

        Write-Host "SUCCESS: Database '$db' updated with clean Marathi text!" -ForegroundColor Green

        $conn.Close()
    } catch {
        Write-Host "Error on '$db': $($_.Exception.Message)" -ForegroundColor Red
    }
}

$databases = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")

foreach ($db in $databases) {
    $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        # Delete old garbled entries
        $cmdDel = $conn.CreateCommand()
        $cmdDel.CommandText = "DELETE FROM Cashiers; DELETE FROM CashManagementSettings;"
        $cmdDel.ExecuteNonQuery()

        # Insert Cashier 1: Head Cashier
        $cmd1 = $conn.CreateCommand()
        $cmd1.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (@BranchId, @Name, @Counter, @IsHead, 1, 2500000.00, @Remarks, GETDATE())"
        $cmd1.Parameters.Add("@BranchId", [System.Data.SqlDbType]::Int).Value = 1
        $cmd1.Parameters.Add("@Name", [System.Data.SqlDbType]::NVarChar).Value = "मुख्य कॅशिअर (Head Cashier)"
        $cmd1.Parameters.Add("@Counter", [System.Data.SqlDbType]::NVarChar).Value = "तिजोरी कक्ष (Main Vault)"
        $cmd1.Parameters.Add("@IsHead", [System.Data.SqlDbType]::Bit).Value = $true
        $cmd1.Parameters.Add("@Remarks", [System.Data.SqlDbType]::NVarChar).Value = "मुख्य तिजोरी व बँक रोख व्यवस्थापन"
        $cmd1.ExecuteNonQuery()

        # Insert Cashier 2: Counter 1
        $cmd2 = $conn.CreateCommand()
        $cmd2.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (@BranchId, @Name, @Counter, @IsHead, 1, 500000.00, @Remarks, GETDATE())"
        $cmd2.Parameters.Add("@BranchId", [System.Data.SqlDbType]::Int).Value = 1
        $cmd2.Parameters.Add("@Name", [System.Data.SqlDbType]::NVarChar).Value = "काउंटर १ (जमा-नावे टेलर)"
        $cmd2.Parameters.Add("@Counter", [System.Data.SqlDbType]::NVarChar).Value = "काउंटर १"
        $cmd2.Parameters.Add("@IsHead", [System.Data.SqlDbType]::Bit).Value = $false
        $cmd2.Parameters.Add("@Remarks", [System.Data.SqlDbType]::NVarChar).Value = "दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार"
        $cmd2.ExecuteNonQuery()

        # Insert Cashier 3: Counter 2
        $cmd3 = $conn.CreateCommand()
        $cmd3.CommandText = "INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt) VALUES (@BranchId, @Name, @Counter, @IsHead, 1, 300000.00, @Remarks, GETDATE())"
        $cmd3.Parameters.Add("@BranchId", [System.Data.SqlDbType]::Int).Value = 1
        $cmd3.Parameters.Add("@Name", [System.Data.SqlDbType]::NVarChar).Value = "काउंटर २ (पिग्मी व इतर संकलन)"
        $cmd3.Parameters.Add("@Counter", [System.Data.SqlDbType]::NVarChar).Value = "काउंटर २"
        $cmd3.Parameters.Add("@IsHead", [System.Data.SqlDbType]::Bit).Value = $false
        $cmd3.Parameters.Add("@Remarks", [System.Data.SqlDbType]::NVarChar).Value = "पिग्मी एजंट संकलन व इतर रोख पावत्या"
        $cmd3.ExecuteNonQuery()

        # Insert CashManagementSetting
        $cmdSet = $conn.CreateCommand()
        $cmdSet.CommandText = "INSERT INTO CashManagementSettings (BranchId, AutoGenerateVouchers, EnableDenominationMandatory, MaxBranchVaultLimit, DefaultCounterLimit, Remarks, LastUpdated) VALUES (1, 0, 1, 5000000.00, 500000.00, @Remarks, GETDATE())"
        $cmdSet.Parameters.Add("@Remarks", [System.Data.SqlDbType]::NVarChar).Value = "मुख्य तिजोरी व रोख योजना सेटिंग"
        $cmdSet.ExecuteNonQuery()

        Write-Host "SUCCESS: Clean UTF-16 Unicode rows inserted into '$db'!" -ForegroundColor Green

        $conn.Close()
    } catch {
        Write-Host "Error for '$db': $($_.Exception.Message)" -ForegroundColor Red
    }
}

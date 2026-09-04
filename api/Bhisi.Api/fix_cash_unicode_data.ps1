$databases = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")

foreach ($db in $databases) {
    $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()

        Write-Host "Connected to $db. Updating Unicode text..." -ForegroundColor Cyan

        # Clean existing garbled records and insert fresh properly-encoded records
        $sql = @"
DELETE FROM Cashiers WHERE CashierName LIKE '%à%' OR Remarks LIKE '%à%' OR CounterNumber LIKE '%à%';

IF NOT EXISTS (SELECT 1 FROM Cashiers)
BEGIN
    INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt)
    VALUES 
    (1, N'मुख्य कॅशिअर (Head Cashier)', N'तिजोरी कक्ष (Main Vault)', 1, 1, 2500000.00, N'मुख्य तिजोरी व बँक रोख व्यवस्थापन', GETDATE()),
    (1, N'काउंटर १ (जमा-नावे टेलर)', N'काउंटर १', 0, 1, 500000.00, N'दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार', GETDATE()),
    (1, N'काउंटर २ (पिग्मी व इतर संकलन)', N'काउंटर २', 0, 1, 300000.00, N'पिग्मी एजंट संकलन व इतर रोख पावत्या', GETDATE());
END
ELSE
BEGIN
    -- Update existing if names are garbled
    UPDATE Cashiers 
    SET CashierName = N'मुख्य कॅशिअर (Head Cashier)', 
        CounterNumber = N'तिजोरी कक्ष (Main Vault)', 
        Remarks = N'मुख्य तिजोरी व बँक रोख व्यवस्थापन'
    WHERE IsHeadCashier = 1;

    UPDATE Cashiers 
    SET CashierName = N'काउंटर १ (जमा-नावे टेलर)', 
        CounterNumber = N'काउंटर १', 
        Remarks = N'दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार'
    WHERE IsHeadCashier = 0 AND (CounterNumber LIKE '%१%' OR CounterNumber LIKE '%1%' OR Id = 2);

    UPDATE Cashiers 
    SET CashierName = N'काउंटर २ (पिग्मी व इतर संकलन)', 
        CounterNumber = N'काउंटर २', 
        Remarks = N'पिग्मी एजंट संकलन व इतर रोख पावत्या'
    WHERE IsHeadCashier = 0 AND (CounterNumber LIKE '%२%' OR CounterNumber LIKE '%2%' OR Id = 3);
END

-- Update CashManagementSettings remarks
UPDATE CashManagementSettings 
SET Remarks = N'मुख्य तिजोरी व रोख योजना सेटिंग'
WHERE Remarks LIKE '%à%' OR Remarks IS NULL;

"@

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        $cmd.ExecuteNonQuery()

        Write-Host "SUCCESS: Unicode data fixed on database '$db'!" -ForegroundColor Green

        # Verify query output
        $cmdSelect = $conn.CreateCommand()
        $cmdSelect.CommandText = "SELECT Id, CashierName, CounterNumber, Remarks FROM Cashiers"
        $reader = $cmdSelect.ExecuteReader()
        while ($reader.Read()) {
            Write-Host "Row: $($reader['Id']) | $($reader['CashierName']) | $($reader['CounterNumber'])" -ForegroundColor Yellow
        }
        $reader.Close()

        $conn.Close()
    } catch {
        Write-Host "Error for '$db': $($_.Exception.Message)" -ForegroundColor Red
    }
}

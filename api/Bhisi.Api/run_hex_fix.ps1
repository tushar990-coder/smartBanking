$head_name = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("मुख्य कॅशिअर (Head Cashier)")).Replace("-","")
$head_cnt = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("तिजोरी कक्ष (Main Vault)")).Replace("-","")
$head_rem = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("मुख्य तिजोरी व बँक रोख व्यवस्थापन")).Replace("-","")

$c1_name = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("काउंटर १ (जमा-नावे टेलर)")).Replace("-","")
$c1_cnt = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("काउंटर १")).Replace("-","")
$c1_rem = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार")).Replace("-","")

$c2_name = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("काउंटर २ (पिग्मी व इतर संकलन)")).Replace("-","")
$c2_cnt = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("काउंटर २")).Replace("-","")
$c2_rem = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("पिग्मी एजंट संकलन व इतर रोख पावत्या")).Replace("-","")

$set_rem = "0x" + [System.BitConverter]::ToString([System.Text.Encoding]::Unicode.GetBytes("मुख्य तिजोरी व रोख योजना सेटिंग")).Replace("-","")

$dbs = @("SmartBanking", "SmartBanking_ShareTest", "SmartBanking_Gurudev")

foreach ($db in $dbs) {
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;")
        $conn.Open()
        
        $sql = @"
DELETE FROM Cashiers;
DELETE FROM CashManagementSettings;

INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt)
VALUES 
(1, CAST($head_name AS NVARCHAR(100)), CAST($head_cnt AS NVARCHAR(50)), 1, 1, 2500000.00, CAST($head_rem AS NVARCHAR(250)), GETDATE()),
(1, CAST($c1_name AS NVARCHAR(100)), CAST($c1_cnt AS NVARCHAR(50)), 0, 1, 500000.00, CAST($c1_rem AS NVARCHAR(250)), GETDATE()),
(1, CAST($c2_name AS NVARCHAR(100)), CAST($c2_cnt AS NVARCHAR(50)), 0, 1, 300000.00, CAST($c2_rem AS NVARCHAR(250)), GETDATE());

INSERT INTO CashManagementSettings (BranchId, AutoGenerateVouchers, EnableDenominationMandatory, MaxBranchVaultLimit, DefaultCounterLimit, Remarks, LastUpdated)
VALUES 
(1, 0, 1, 5000000.00, 500000.00, CAST($set_rem AS NVARCHAR(250)), GETDATE());
"@

        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        $cmd.ExecuteNonQuery()

        Write-Host "SUCCESS: 100% Binary UTF-16 records written to '$db'!" -ForegroundColor Green
        $conn.Close()
    } catch {
        Write-Host "Error for '$db': $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Script to fix Head Office branch and remove duplicate branch 01 in both databases

$databases = @("SmartBanking_ShareTest", "SmartBanking")

foreach ($db in $databases) {
    try {
        $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = @"
        -- 1. Ensure BranchID 1 / BR001 is HeadOffice
        UPDATE Branches 
        SET BranchType = 'HeadOffice'
        WHERE BranchID = 1 OR BranchCode = 'BR001';

        -- 2. Remove duplicate test branch 01 / मेन शाखा if exists
        DELETE FROM Branches 
        WHERE (BranchCode = '01' OR BranchName LIKE N'%मेन शाखा%') AND BranchID != 1;
"@
        $count = $cmd.ExecuteNonQuery()
        $conn.Close()
        Write-Host "Database $db updated successfully!" -ForegroundColor Green
    } catch {
        Write-Host "Error updating database" -ForegroundColor Red
    }
}

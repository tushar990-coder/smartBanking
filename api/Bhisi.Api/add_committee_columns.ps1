$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()

    $columnsToAdd = @(
        @{ Name = "TermYear"; Type = "NVARCHAR(50) NULL" },
        @{ Name = "Category"; Type = "NVARCHAR(100) NULL" },
        @{ Name = "DINNo"; Type = "NVARCHAR(50) NULL" },
        @{ Name = "Remarks"; Type = "NVARCHAR(500) NULL" }
    )

    foreach ($col in $columnsToAdd) {
        $colName = $col.Name
        $colType = $col.Type
        $cmd.CommandText = @"
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('CommitteeMembers') AND name = '$colName'
)
BEGIN
    ALTER TABLE CommitteeMembers ADD $colName $colType;
END
"@
        $cmd.ExecuteNonQuery()
        Write-Host "Checked/Added column $colName" -ForegroundColor Cyan
    }

    Write-Host "SUCCESS: CommitteeMembers columns updated successfully!" -ForegroundColor Green
    $conn.Close()
} catch {
    Write-Host "Note SQL Server connection message: $($_.Exception.Message)" -ForegroundColor Yellow
}

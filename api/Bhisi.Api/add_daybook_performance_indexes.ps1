$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()

    $cmd.CommandText = @"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vouchers_VoucherDate_BranchID' AND object_id = OBJECT_ID('Vouchers'))
BEGIN
    CREATE INDEX IX_Vouchers_VoucherDate_BranchID ON Vouchers(VoucherDate, BranchID, Status);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VoucherDetails_LedgerID_DrCr' AND object_id = OBJECT_ID('VoucherDetails'))
BEGIN
    CREATE INDEX IX_VoucherDetails_LedgerID_DrCr ON VoucherDetails(LedgerID, DrCr) INCLUDE (Amount, VoucherID);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoanDisbursements_DisbursementDate' AND object_id = OBJECT_ID('LoanDisbursements'))
BEGIN
    CREATE INDEX IX_LoanDisbursements_DisbursementDate ON LoanDisbursements(DisbursementDate);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoanCollections_CollectionDate' AND object_id = OBJECT_ID('LoanCollections'))
BEGIN
    CREATE INDEX IX_LoanCollections_CollectionDate ON LoanCollections(CollectionDate);
END
"@
    $cmd.ExecuteNonQuery()
    Write-Host "SUCCESS: Daybook performance indexes created successfully!" -ForegroundColor Green
    $conn.Close()
} catch {
    Write-Host "SQL Server Error: $($_.Exception.Message)" -ForegroundColor Red
}

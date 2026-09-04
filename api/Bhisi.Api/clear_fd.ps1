$connectionString = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = @"
        DELETE FROM FdTransactions;
        DELETE FROM FdInterestAccruals;
        DELETE FROM VoucherDetails WHERE VoucherID IN (SELECT VoucherID FROM Vouchers WHERE VoucherNo LIKE 'JV-FD-%');
        DELETE FROM Vouchers WHERE VoucherNo LIKE 'JV-FD-%';
        DELETE FROM FdAccounts;
        UPDATE FdAccountSequences SET CurrentValue = 0 WHERE ProductType = 'FD';
        DELETE FROM FdSchemes WHERE SchemeCode IS NULL OR SchemeCode = '' OR SchemeName IS NULL OR SchemeName = '';
"@
    $rows = $cmd.ExecuteNonQuery()
    Write-Host "✅ SQL Server: FD Data Cleared Successfully! Rows affected: $rows"
    $conn.Close()
} catch {
    Write-Host "SQL Server Error: $_"
}

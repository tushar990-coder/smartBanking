$databases = @("SmartBanking_ShareTest", "SmartBanking")

foreach ($db in $databases) {
    try {
        $connStr = "Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True;"
        $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $conn.Open()
        
        # Update Allotment Vouchers where member no is not yet present
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = @"
        UPDATE v
        SET v.Narration = REPLACE(v.Narration, ' for ' + m.FirstName + ' ' + m.LastName + '.', ' for ' + m.FirstName + ' ' + m.LastName + N' (सभासद क्र.: ' + COALESCE(NULLIF(m.LegacyMemberNo, ''), NULLIF(m.MemberCode, ''), CAST(m.MemberID AS NVARCHAR)) + ').')
        FROM Vouchers v
        JOIN ShareAccounts sa ON 1=1
        JOIN Members m ON sa.MemberId = m.MemberID
        WHERE (v.VoucherNo LIKE 'VCH-SHR-%' OR v.Narration LIKE '%Share Allotment%' OR v.Narration LIKE '%Share Withdrawal%')
          AND v.Narration LIKE '%' + m.FirstName + ' ' + m.LastName + '%'
          AND v.Narration NOT LIKE N'%(सभासद क्र.%';
"@
        $updated = $cmd.ExecuteNonQuery()
        $conn.Close()
        Write-Host "Database $db updated $updated existing Share Voucher Narrations with Member No/ID!" -ForegroundColor Green
    } catch {
        Write-Host "Error updating database $db : $($_.Exception.Message)" -ForegroundColor Red
    }
}

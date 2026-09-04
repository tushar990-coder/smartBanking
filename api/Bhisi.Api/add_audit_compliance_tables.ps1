$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
try {
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    $cmd = $conn.CreateCommand()

    $cmd.CommandText = @"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditLedgerMappings')
BEGIN
    CREATE TABLE AuditLedgerMappings (
        AuditLedgerMappingID INT IDENTITY(1,1) PRIMARY KEY,
        CategoryCode NVARCHAR(50) NOT NULL,
        CategoryName NVARCHAR(150) NOT NULL,
        LedgerID INT NOT NULL,
        CreatedOn DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedOn DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_AuditLedgerMappings_Ledgers FOREIGN KEY (LedgerID) REFERENCES Ledgers(LedgerID) ON DELETE CASCADE
    );
    CREATE INDEX IX_AuditLedgerMappings_CategoryCode ON AuditLedgerMappings(CategoryCode);
END
"@
    $cmd.ExecuteNonQuery()
    Write-Host "SUCCESS: AuditLedgerMappings table created/verified successfully!" -ForegroundColor Green
    $conn.Close()
} catch {
    Write-Host "SQL Server Connection message: $($_.Exception.Message)" -ForegroundColor Yellow
}

$connStr = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()

# Add column if not exists
$cmd.CommandText = @"
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'LoanRates' AND COLUMN_NAME = 'InterestPostingFrequency')
BEGIN
    ALTER TABLE LoanRates ADD InterestPostingFrequency NVARCHAR(100) NULL;
END
"@
$cmd.ExecuteNonQuery()

# Update NULL values across all string columns in LoanRates
$cmd.CommandText = @"
UPDATE LoanRates SET 
    LoanType = ISNULL(LoanType, ''),
    LoanCode = ISNULL(LoanCode, ''),
    InterestPostingType = ISNULL(InterestPostingType, ''),
    InterestPostingFrequency = ISNULL(InterestPostingFrequency, N'मासिक'),
    InterestCalculationMethod = ISNULL(InterestCalculationMethod, N'Flat (फ्लॅट)'),
    ShortName = ISNULL(ShortName, ''),
    InstallmentType = ISNULL(InstallmentType, ''),
    LoanInstallmentType = ISNULL(LoanInstallmentType, ''),
    SecurityType = ISNULL(SecurityType, '')
WHERE LoanType IS NULL OR LoanCode IS NULL OR InterestPostingType IS NULL 
   OR InterestPostingFrequency IS NULL OR InterestCalculationMethod IS NULL 
   OR ShortName IS NULL OR InstallmentType IS NULL OR LoanInstallmentType IS NULL OR SecurityType IS NULL;
"@
$rows = $cmd.ExecuteNonQuery()
Write-Host "Database fix applied successfully. Updated $rows rows." -ForegroundColor Green
$conn.Close()

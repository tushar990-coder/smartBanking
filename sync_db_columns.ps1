[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=SmartBanking_Gurudev;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()
$cmd = $conn.CreateCommand()

Write-Host "Checking and applying missing columns in SmartBanking_Gurudev..." -ForegroundColor Cyan

$sqls = @(
    "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AccountGroups') AND name = 'DisplayOrder')
     BEGIN
         ALTER TABLE AccountGroups ADD DisplayOrder INT NOT NULL CONSTRAINT DF_AccountGroups_DisplayOrder DEFAULT (0);
         PRINT 'Added DisplayOrder to AccountGroups';
     END",

    "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Ledgers') AND name = 'LedgerCode')
     BEGIN
         ALTER TABLE Ledgers ADD LedgerCode NVARCHAR(50) NULL;
         PRINT 'Added LedgerCode to Ledgers';
     END",

    "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Ledgers') AND name = 'DisplayOrder')
     BEGIN
         ALTER TABLE Ledgers ADD DisplayOrder INT NOT NULL CONSTRAINT DF_Ledgers_DisplayOrder DEFAULT (0);
         PRINT 'Added DisplayOrder to Ledgers';
     END"
)

foreach ($sql in $sqls) {
    $cmd.CommandText = $sql
    $cmd.ExecuteNonQuery() | Out-Null
    Write-Host "Executed: $sql" -ForegroundColor Green
}

$conn.Close()
Write-Host "Database columns synchronized successfully!" -ForegroundColor Green

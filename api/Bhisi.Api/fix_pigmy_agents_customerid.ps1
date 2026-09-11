$connStr = "Server=.;Database=SmartBanking_Template;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
$conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()

Write-Host "Checking columns in PigmyAgents table..." -ForegroundColor Yellow

$cmd.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'PigmyAgents'"
$reader = $cmd.ExecuteReader()
$cols = @()
while ($reader.Read()) {
    $cols += $reader[0]
}
$reader.Close()

if ($cols -notcontains "CustomerID") {
    Write-Host "Adding column CustomerID..." -ForegroundColor Yellow
    $cmd.CommandText = "ALTER TABLE PigmyAgents ADD CustomerID INT NULL;"
    $cmd.ExecuteNonQuery()
    
    Write-Host "Adding Foreign Key constraint..." -ForegroundColor Yellow
    $cmd.CommandText = "ALTER TABLE PigmyAgents ADD CONSTRAINT FK_PigmyAgents_Customers FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID);"
    $cmd.ExecuteNonQuery()
    
    Write-Host "CustomerID added successfully!" -ForegroundColor Green
} else {
    Write-Host "CustomerID already exists." -ForegroundColor Cyan
}

$conn.Close()

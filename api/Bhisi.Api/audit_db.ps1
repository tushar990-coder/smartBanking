$connectionString = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True"

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    Write-Host "Connected to SQL Server database 'SmartBanking' successfully." -ForegroundColor Green

    $queries = @(
        @{ Title = "LoanAccounts with NULL or empty LoanAccountNo"; Sql = "SELECT COUNT(*) FROM LoanAccounts WHERE LoanAccountNo IS NULL OR LoanAccountNo = ''" },
        @{ Title = "LoanAccounts with NULL PrincipalBalance"; Sql = "SELECT COUNT(*) FROM LoanAccounts WHERE PrincipalBalance IS NULL" },
        @{ Title = "LoanCollections with NULL PrincipalCollected"; Sql = "SELECT COUNT(*) FROM LoanCollections WHERE PrincipalCollected IS NULL" },
        @{ Title = "SansthaDetails AutoPostVoucherLimit NULL Count"; Sql = "SELECT COUNT(*) FROM SansthaDetails WHERE AutoPostVoucherLimit IS NULL" },
        @{ Title = "Members with NULL FirstName or LastName"; Sql = "SELECT COUNT(*) FROM Members WHERE FirstName IS NULL OR LastName IS NULL" },
        @{ Title = "Total Members Count"; Sql = "SELECT COUNT(*) FROM Members" },
        @{ Title = "Total LoanAccounts Count"; Sql = "SELECT COUNT(*) FROM LoanAccounts" },
        @{ Title = "Total LoanCollections Count"; Sql = "SELECT COUNT(*) FROM LoanCollections" },
        @{ Title = "Total Vouchers Count"; Sql = "SELECT COUNT(*) FROM Vouchers" }
    )

    foreach ($q in $queries) {
        $cmd = $connection.CreateCommand()
        $cmd.CommandText = $q.Sql
        $result = $cmd.ExecuteScalar()
        Write-Host "$($q.Title): $result"
    }

    $connection.Close()
} catch {
    Write-Host "SQL Server Connection error: $_" -ForegroundColor Yellow
}

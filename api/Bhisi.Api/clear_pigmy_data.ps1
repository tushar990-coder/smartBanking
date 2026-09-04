# PowerShell script to clear all Pigmy module data
try {
    Write-Host "Attempting to clear Pigmy module data via API..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "http://localhost:5242/api/PigmyAccounts/ClearAllPigmyData" -Method Post -TimeoutSec 10 -ErrorAction Stop
    Write-Host "API Response: $($response.message)" -ForegroundColor Green
}
catch {
    Write-Host "API call failed or server restarting. Executing direct SQL cleanup..." -ForegroundColor Yellow
    $sql = @"
DELETE FROM [PigmyCollections];
DELETE FROM [PigmyTransactions];
DELETE FROM [PigmyInterestLogs];
DELETE FROM [PigmyOpeningBalances];
DELETE FROM [PigmyAgentCommissions];
DELETE FROM [PigmyAgentCashDeposits];
DELETE FROM [PigmyAccounts];
DELETE FROM [PigmyAccountSequences];
DELETE FROM [PigmyAgents];
DELETE FROM [PigmySchemes];
DELETE FROM [PigmyCommissionSettings];
"@
    $connectionString = "Server=.;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    try {
        $connection.Open()
        $command = $connection.CreateCommand()
        $command.CommandText = $sql
        $rows = $command.ExecuteNonQuery()
        Write-Host "Successfully cleared all Pigmy module data directly from SQL Database (Rows affected: $rows)!" -ForegroundColor Green
    }
    catch {
        # Try SQLEXPRESS if . fails
        $connectionString2 = "Server=.\SQLEXPRESS;Database=SmartBanking;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
        $connection2 = New-Object System.Data.SqlClient.SqlConnection($connectionString2)
        try {
            $connection2.Open()
            $command2 = $connection2.CreateCommand()
            $command2.CommandText = $sql
            $rows2 = $command2.ExecuteNonQuery()
            Write-Host "Successfully cleared all Pigmy module data directly from SQLEXPRESS Database (Rows affected: $rows2)!" -ForegroundColor Green
        }
        catch {
            Write-Host "SqlConnect error: $_" -ForegroundColor Red
        }
        finally {
            $connection2.Close()
        }
    }
    finally {
        $connection.Close()
    }
}

Add-Type -AssemblyName "System.Data"
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=Test2;Trusted_Connection=True;TrustServerCertificate=True;")
$conn.Open()

function Get-Count($tbl) {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(*) FROM [$tbl]"
    return $cmd.ExecuteScalar()
}

Write-Host "================ TEST2 DATABASE STATUS ================" -ForegroundColor Cyan
Write-Host "Preserved Master Records:" -ForegroundColor Green
Write-Host "  Users (Login):           " (Get-Count "Users")
Write-Host "  Roles:                   " (Get-Count "Roles")
Write-Host "  SansthaDetails (संस्था):   " (Get-Count "SansthaDetails")
Write-Host "  FinancialYears:          " (Get-Count "FinancialYears")
Write-Host "  Branches:                " (Get-Count "Branches")
Write-Host "  Ledgers (खातेवही):       " (Get-Count "Ledgers")
Write-Host "  AccountGroups:           " (Get-Count "AccountGroups")
Write-Host "  BankMasters:             " (Get-Count "BankMasters")
Write-Host "  LoanRates / Schemes:     " (Get-Count "LoanRates")
Write-Host "  FdSchemes:               " (Get-Count "FdSchemes")
Write-Host "  RdSchemes:               " (Get-Count "RdSchemes")
Write-Host "  PigmySchemes:            " (Get-Count "PigmySchemes")
Write-Host ""
Write-Host "Cleaned / Empty Records (Should be 0):" -ForegroundColor Yellow
Write-Host "  Members (सभासद):         " (Get-Count "Members")
Write-Host "  Vouchers (व्हाऊचर्स):     " (Get-Count "Vouchers")
Write-Host "  VoucherDetails:          " (Get-Count "VoucherDetails")
Write-Host "  LoanAccounts (कर्ज):     " (Get-Count "LoanAccounts")
Write-Host "  LoanDisbursements:       " (Get-Count "LoanDisbursements")
Write-Host "  LoanCollections:         " (Get-Count "LoanCollections")
Write-Host "  SavingAccountMasters:    " (Get-Count "SavingAccountMasters")
Write-Host "  SavingTransactions:      " (Get-Count "SavingTransactions")
Write-Host "  PigmyAccounts:           " (Get-Count "PigmyAccounts")
Write-Host "  PigmyCollections:        " (Get-Count "PigmyCollections")
Write-Host "  FdAccounts:              " (Get-Count "FdAccounts")
Write-Host "  RdAccounts:              " (Get-Count "RdAccounts")
Write-Host "  ShareAccounts:           " (Get-Count "ShareAccounts")
Write-Host "  AuditLogs:               " (Get-Count "AuditLogs")

$conn.Close()

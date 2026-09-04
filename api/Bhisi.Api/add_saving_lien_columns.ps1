$Server = "."
$Database = "SmartBanking"
$Query = @"
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SavingAccountMasters' AND COLUMN_NAME='LienAmount')
BEGIN
    ALTER TABLE SavingAccountMasters ADD LienAmount DECIMAL(18,2) NOT NULL DEFAULT 0;
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='SavingAccountMasters' AND COLUMN_NAME='LienReason')
BEGIN
    ALTER TABLE SavingAccountMasters ADD LienReason NVARCHAR(250) NULL;
END
"@

Invoke-Sqlcmd -ServerInstance $Server -Database $Database -Query $Query
Write-Host "SavingAccountMasters Lien columns check completed successfully."

Add-Type -AssemblyName 'System.Data'
$masterConn = New-Object System.Data.SqlClient.SqlConnection('Server=.;Database=master;Trusted_Connection=True;TrustServerCertificate=True')
$masterConn.Open()
$cmd = $masterConn.CreateCommand()
$cmd.CommandText = "SELECT name FROM sys.databases WHERE name LIKE 'SmartBanking%'"
$reader = $cmd.ExecuteReader()
$dbs = @()
while ($reader.Read()) {
    $dbs += $reader['name'].ToString()
}
$reader.Close()
$masterConn.Close()

Write-Host "Found $($dbs.Count) SmartBanking databases to update."

foreach ($db in $dbs) {
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=.;Database=$db;Trusted_Connection=True;TrustServerCertificate=True")
    try {
        $conn.Open()
        $sql = @"
-- 1. LoanAccounts
IF OBJECT_ID('LoanAccounts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanAccounts') AND name = 'IsAgentCollectionAllowed')
        ALTER TABLE LoanAccounts ADD IsAgentCollectionAllowed BIT NOT NULL DEFAULT 0;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanAccounts') AND name = 'AssignedAgentID')
        ALTER TABLE LoanAccounts ADD AssignedAgentID INT NULL;
END

-- 2. SavingAccountMasters
IF OBJECT_ID('SavingAccountMasters', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingAccountMasters') AND name = 'IsAgentCollectionAllowed')
        ALTER TABLE SavingAccountMasters ADD IsAgentCollectionAllowed BIT NOT NULL DEFAULT 0;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingAccountMasters') AND name = 'AssignedAgentID')
        ALTER TABLE SavingAccountMasters ADD AssignedAgentID INT NULL;
END

-- 3. RdAccounts
IF OBJECT_ID('RdAccounts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RdAccounts') AND name = 'IsAgentCollectionAllowed')
        ALTER TABLE RdAccounts ADD IsAgentCollectionAllowed BIT NOT NULL DEFAULT 0;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RdAccounts') AND name = 'AssignedAgentID')
        ALTER TABLE RdAccounts ADD AssignedAgentID INT NULL;
END

-- 4. PigmyAccounts
IF OBJECT_ID('PigmyAccounts', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PigmyAccounts') AND name = 'DailyDepositAmount')
        ALTER TABLE PigmyAccounts ADD DailyDepositAmount DECIMAL(18,2) NOT NULL DEFAULT 100;
END

-- 5. LoanCollections
IF OBJECT_ID('LoanCollections', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanCollections') AND name = 'AgentID')
        ALTER TABLE LoanCollections ADD AgentID INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanCollections') AND name = 'CollectionSource')
        ALTER TABLE LoanCollections ADD CollectionSource VARCHAR(20) NOT NULL DEFAULT 'COUNTER';

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanCollections') AND name = 'SyncReferenceId')
        ALTER TABLE LoanCollections ADD SyncReferenceId VARCHAR(100) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanCollections') AND name = 'TransactionId')
        ALTER TABLE LoanCollections ADD TransactionId VARCHAR(100) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanCollections') AND name = 'ReceivableInterestCollected')
        ALTER TABLE LoanCollections ADD ReceivableInterestCollected DECIMAL(18,2) NOT NULL DEFAULT 0;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_LoanCollections_TransactionId' AND object_id = OBJECT_ID('LoanCollections'))
    BEGIN
        EXEC('CREATE UNIQUE NONCLUSTERED INDEX UQ_LoanCollections_TransactionId ON LoanCollections(TransactionId) WHERE TransactionId IS NOT NULL;');
    END
END

-- 6. SavingTransactions
IF OBJECT_ID('SavingTransactions', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingTransactions') AND name = 'AgentID')
        ALTER TABLE SavingTransactions ADD AgentID INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingTransactions') AND name = 'CollectionSource')
        ALTER TABLE SavingTransactions ADD CollectionSource VARCHAR(20) NOT NULL DEFAULT 'COUNTER';

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingTransactions') AND name = 'SyncReferenceId')
        ALTER TABLE SavingTransactions ADD SyncReferenceId VARCHAR(100) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SavingTransactions') AND name = 'TransactionId')
        ALTER TABLE SavingTransactions ADD TransactionId VARCHAR(100) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_SavingTransactions_TransactionId' AND object_id = OBJECT_ID('SavingTransactions'))
    BEGIN
        EXEC('CREATE UNIQUE NONCLUSTERED INDEX UQ_SavingTransactions_TransactionId ON SavingTransactions(TransactionId) WHERE TransactionId IS NOT NULL;');
    END
END

-- 7. RdTransactions
IF OBJECT_ID('RdTransactions', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RdTransactions') AND name = 'AgentID')
        ALTER TABLE RdTransactions ADD AgentID INT NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RdTransactions') AND name = 'CollectionSource')
        ALTER TABLE RdTransactions ADD CollectionSource VARCHAR(20) NOT NULL DEFAULT 'COUNTER';

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RdTransactions') AND name = 'SyncReferenceId')
        ALTER TABLE RdTransactions ADD SyncReferenceId VARCHAR(100) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('RdTransactions') AND name = 'TransactionId')
        ALTER TABLE RdTransactions ADD TransactionId VARCHAR(100) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_RdTransactions_TransactionId' AND object_id = OBJECT_ID('RdTransactions'))
    BEGIN
        EXEC('CREATE UNIQUE NONCLUSTERED INDEX UQ_RdTransactions_TransactionId ON RdTransactions(TransactionId) WHERE TransactionId IS NOT NULL;');
    END
END

-- 8. PigmyCommissionSettings & PigmyAgentCommissions
IF OBJECT_ID('PigmyCommissionSettings', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PigmyCommissionSettings') AND name = 'ProductType')
        ALTER TABLE PigmyCommissionSettings ADD ProductType VARCHAR(20) NOT NULL DEFAULT 'PIGMY';
END

IF OBJECT_ID('PigmyAgentCommissions', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PigmyAgentCommissions') AND name = 'ProductType')
        ALTER TABLE PigmyAgentCommissions ADD ProductType VARCHAR(20) NOT NULL DEFAULT 'PIGMY';
END
"@
        $c = $conn.CreateCommand()
        $c.CommandText = $sql
        $c.ExecuteNonQuery() | Out-Null
        Write-Host "SUCCESS: Updated schema on $db"
        $conn.Close()
    } catch {
        Write-Host "ERROR on $db : $_"
    }
}

-- SQL Script to Create CashManagementSettings Table and Update Cashiers Table

-- 1. Ensure CashLedgerId column in Cashiers table
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Cashiers') AND name = 'CashLedgerId'
)
BEGIN
    ALTER TABLE Cashiers ADD CashLedgerId INT NULL;
    PRINT 'Added CashLedgerId column to Cashiers table.';
END

-- 2. Create CashManagementSettings Table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CashManagementSettings')
BEGIN
    CREATE TABLE CashManagementSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        BranchId INT NULL,
        MainVaultLedgerId INT NULL,
        CashShortageLedgerId INT NULL,
        CashExcessLedgerId INT NULL,
        AutoGenerateVouchers BIT NOT NULL DEFAULT 0,
        EnableDenominationMandatory BIT NOT NULL DEFAULT 1,
        MaxBranchVaultLimit DECIMAL(18,2) NOT NULL DEFAULT 5000000.00,
        DefaultCounterLimit DECIMAL(18,2) NOT NULL DEFAULT 500000.00,
        Remarks NVARCHAR(250) NULL,
        LastUpdated DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Created CashManagementSettings table.';
END

-- 3. Seed default CashManagementSettings if empty
IF NOT EXISTS (SELECT 1 FROM CashManagementSettings)
BEGIN
    DECLARE @defaultCashId INT = (SELECT TOP 1 LedgerID FROM Ledgers WHERE LedgerName LIKE N'%रोख%' OR LOWER(LedgerName) LIKE '%cash%');

    INSERT INTO CashManagementSettings (BranchId, MainVaultLedgerId, AutoGenerateVouchers, EnableDenominationMandatory, MaxBranchVaultLimit, DefaultCounterLimit, Remarks, LastUpdated)
    VALUES (1, @defaultCashId, 0, 1, 5000000.00, 500000.00, N'मुख्य तिजोरी व रोख योजना सेटिंग', GETDATE());
    
    PRINT 'Seeded default CashManagementSettings.';
END

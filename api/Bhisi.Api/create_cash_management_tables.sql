-- SQL Script to Create Cash Management and Cashier Window Module Tables in SQL Server

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Cashiers')
BEGIN
    CREATE TABLE Cashiers (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        BranchId INT NULL,
        CashierName NVARCHAR(100) NOT NULL,
        CounterNumber NVARCHAR(50) NOT NULL DEFAULT N'कॅश काउंटर १',
        UserId INT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        IsHeadCashier BIT NOT NULL DEFAULT 0,
        MaxCashLimit DECIMAL(18,2) NOT NULL DEFAULT 500000.00,
        Remarks NVARCHAR(250) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CashAllocations')
BEGIN
    CREATE TABLE CashAllocations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        BranchId INT NULL,
        FromCashierId INT NULL,
        ToCashierId INT NOT NULL,
        Amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        AllocationDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        AllocationType NVARCHAR(50) NOT NULL DEFAULT 'HEAD_TO_TELLER',
        Status NVARCHAR(20) NOT NULL DEFAULT 'ACCEPTED',
        Remarks NVARCHAR(250) NULL,
        IsReturn BIT NOT NULL DEFAULT 0,
        CreatedBy NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CashDenominations')
BEGIN
    CREATE TABLE CashDenominations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        BranchId INT NULL,
        CashierId INT NOT NULL,
        DenominationDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        EntryType NVARCHAR(50) NOT NULL DEFAULT 'CLOSING',
        Count2000 INT NOT NULL DEFAULT 0,
        Count500 INT NOT NULL DEFAULT 0,
        Count200 INT NOT NULL DEFAULT 0,
        Count100 INT NOT NULL DEFAULT 0,
        Count50 INT NOT NULL DEFAULT 0,
        Count20 INT NOT NULL DEFAULT 0,
        Count10 INT NOT NULL DEFAULT 0,
        Count5 INT NOT NULL DEFAULT 0,
        CountCoins INT NOT NULL DEFAULT 0,
        TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        ExpectedAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        DifferenceAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        DifferenceType NVARCHAR(20) NOT NULL DEFAULT 'MATCHED',
        Remarks NVARCHAR(250) NULL,
        VerifiedBy NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CashierBalances')
BEGIN
    CREATE TABLE CashierBalances (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        BranchId INT NULL,
        CashierId INT NOT NULL,
        BalanceDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        OpeningBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        ReceivedFromHead DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        TotalReceipts DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        TotalPayments DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        ReturnedToHead DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        ClosingBalance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        PhysicalCashTally DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        CashDifference DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        Status NVARCHAR(20) NOT NULL DEFAULT 'OPEN',
        LastUpdated DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END

-- Seed sample default Cashiers if none exist
IF NOT EXISTS (SELECT 1 FROM Cashiers)
BEGIN
    INSERT INTO Cashiers (BranchId, CashierName, CounterNumber, IsHeadCashier, IsActive, MaxCashLimit, Remarks, CreatedAt)
    VALUES 
    (1, N'मुख्य कॅशिअर (Head Cashier)', N'तिजोरी कक्ष (Main Vault)', 1, 1, 2500000.00, N'मुख्य तिजोरी व बँक रोख व्यवस्थापन', GETDATE()),
    (1, N'काउंटर १ (जमा-नावे टेलर)', N'काउंटर १', 0, 1, 500000.00, N'दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार', GETDATE()),
    (1, N'काउंटर २ (पिग्मी व इतर संकलन)', N'काउंटर २', 0, 1, 300000.00, N'पिग्मी एजंट संकलन व इतर रोख पावत्या', GETDATE());
END

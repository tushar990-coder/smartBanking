-- SQL Script to Create Locker Management Module Tables in SQL Server

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LockerTypes')
BEGIN
    CREATE TABLE LockerTypes (
        LockerTypeID INT IDENTITY(1,1) PRIMARY KEY,
        BranchID INT NOT NULL DEFAULT 1,
        TypeCode NVARCHAR(50) NOT NULL,
        TypeName NVARCHAR(100) NOT NULL,
        Dimensions NVARCHAR(100) NULL,
        AnnualRent DECIMAL(18,2) NOT NULL DEFAULT 0,
        SecurityDeposit DECIMAL(18,2) NOT NULL DEFAULT 0,
        LateFeePerMonth DECIMAL(18,2) NOT NULL DEFAULT 0,
        GstRate DECIMAL(5,2) NOT NULL DEFAULT 0,
        DepositLiabilityLedgerID INT NULL,
        RentIncomeLedgerID INT NULL,
        LateFeeIncomeLedgerID INT NULL,
        GstLiabilityLedgerID INT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Lockers')
BEGIN
    CREATE TABLE Lockers (
        LockerID INT IDENTITY(1,1) PRIMARY KEY,
        BranchID INT NOT NULL DEFAULT 1,
        CabinetNo NVARCHAR(50) NOT NULL DEFAULT 'C-1',
        LockerNo NVARCHAR(50) NOT NULL,
        KeyNo NVARCHAR(50) NOT NULL,
        LockerTypeID INT NOT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Available',
        Remarks NVARCHAR(250) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Lockers_LockerTypes FOREIGN KEY (LockerTypeID) REFERENCES LockerTypes(LockerTypeID)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LockerAllotments')
BEGIN
    CREATE TABLE LockerAllotments (
        AllotmentID INT IDENTITY(1,1) PRIMARY KEY,
        BranchID INT NOT NULL DEFAULT 1,
        LockerAccountNo NVARCHAR(50) NOT NULL,
        LockerID INT NOT NULL,
        MemberID INT NOT NULL,
        JointMember1_ID INT NULL,
        JointMember2_ID INT NULL,
        OperatingInstruction NVARCHAR(50) NOT NULL DEFAULT 'Self',
        AllotmentDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        RentStartDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        ExpiryDate DATETIME2 NOT NULL,
        AnnualRent DECIMAL(18,2) NOT NULL DEFAULT 0,
        SecurityDepositAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        AdvanceRentPaid DECIMAL(18,2) NOT NULL DEFAULT 0,
        LinkedSavingAccountID INT NULL,
        IsAutoDebitEnabled BIT NOT NULL DEFAULT 0,
        NomineeName NVARCHAR(150) NULL,
        NomineeRelation NVARCHAR(50) NULL,
        NomineeAge INT NULL,
        NomineeAadhaar NVARCHAR(20) NULL,
        NomineeAddress NVARCHAR(200) NULL,
        DepositVoucherID INT NULL,
        AdvanceRentVoucherID INT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'Active',
        Remarks NVARCHAR(250) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_LockerAllotments_Lockers FOREIGN KEY (LockerID) REFERENCES Lockers(LockerID),
        CONSTRAINT FK_LockerAllotments_Members FOREIGN KEY (MemberID) REFERENCES Members(MemberID)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LockerVisitRegisters')
BEGIN
    CREATE TABLE LockerVisitRegisters (
        VisitID INT IDENTITY(1,1) PRIMARY KEY,
        BranchID INT NOT NULL DEFAULT 1,
        AllotmentID INT NOT NULL,
        VisitDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        TimeIn NVARCHAR(20) NOT NULL,
        TimeOut NVARCHAR(20) NULL,
        OperatedBy NVARCHAR(50) NOT NULL DEFAULT 'PrimaryMember',
        OperatorName NVARCHAR(150) NOT NULL,
        IsSignatureVerified BIT NOT NULL DEFAULT 1,
        BankOfficerName NVARCHAR(100) NULL,
        Remarks NVARCHAR(250) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_LockerVisits_Allotments FOREIGN KEY (AllotmentID) REFERENCES LockerAllotments(AllotmentID)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LockerRentPostings')
BEGIN
    CREATE TABLE LockerRentPostings (
        PostingID INT IDENTITY(1,1) PRIMARY KEY,
        BranchID INT NOT NULL DEFAULT 1,
        AllotmentID INT NOT NULL,
        FinancialYear NVARCHAR(20) NOT NULL,
        FromDate DATETIME2 NOT NULL,
        ToDate DATETIME2 NOT NULL,
        RentAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        GstAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        PenaltyAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        TotalAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        PaymentMode NVARCHAR(50) NOT NULL DEFAULT 'Cash',
        PaymentDate DATETIME2 NULL,
        ReceiptNo NVARCHAR(50) NULL,
        VoucherID INT NULL,
        IsPaid BIT NOT NULL DEFAULT 0,
        Remarks NVARCHAR(250) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_LockerRent_Allotments FOREIGN KEY (AllotmentID) REFERENCES LockerAllotments(AllotmentID)
    );
END

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LockerSurrenders')
BEGIN
    CREATE TABLE LockerSurrenders (
        SurrenderID INT IDENTITY(1,1) PRIMARY KEY,
        BranchID INT NOT NULL DEFAULT 1,
        AllotmentID INT NOT NULL,
        SurrenderDate DATETIME2 NOT NULL DEFAULT GETDATE(),
        KeyReceived BIT NOT NULL DEFAULT 1,
        KeysCondition NVARCHAR(100) NOT NULL DEFAULT 'Good',
        DepositAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        UnpaidRentDeduction DECIMAL(18,2) NOT NULL DEFAULT 0,
        DamagePenaltyDeduction DECIMAL(18,2) NOT NULL DEFAULT 0,
        NetRefundAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        RefundPaymentMode NVARCHAR(50) NOT NULL DEFAULT 'Cash',
        VoucherID INT NULL,
        Remarks NVARCHAR(250) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_LockerSurrender_Allotments FOREIGN KEY (AllotmentID) REFERENCES LockerAllotments(AllotmentID)
    );
END

-- Seed sample default Locker Types if none exist
IF NOT EXISTS (SELECT 1 FROM LockerTypes)
BEGIN
    INSERT INTO LockerTypes (BranchID, TypeCode, TypeName, Dimensions, AnnualRent, SecurityDeposit, LateFeePerMonth, GstRate, IsActive, CreatedAt)
    VALUES 
    (1, 'SML', N'लहान लॉकर (Small)', '5" x 7" x 20"', 1200.00, 3000.00, 50.00, 0.00, 1, GETDATE()),
    (1, 'MED', N'मध्यम लॉकर (Medium)', '6" x 11" x 20"', 2000.00, 5000.00, 100.00, 0.00, 1, GETDATE()),
    (1, 'LRG', N'मोठे लॉकर (Large)', '12" x 15" x 20"', 3500.00, 8000.00, 150.00, 0.00, 1, GETDATE());
END

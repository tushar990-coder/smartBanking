-- ==========================================
-- SQL Server Schema Migration Script
-- NPA Classification & Provisioning Module
-- ==========================================

-- 1. Create NpaConfigs Table
CREATE TABLE NpaConfigs (
    FinancialYear NVARCHAR(10) NOT NULL PRIMARY KEY,
    ConcessionPeriodDays INT NOT NULL DEFAULT 180
);

-- 2. Create NpaProvisionSlabs Table
CREATE TABLE NpaProvisionSlabs (
    NpaProvisionSlabID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FinancialYear NVARCHAR(10) NOT NULL,
    Category NVARCHAR(50) NOT NULL,
    SecurityType NVARCHAR(20) NOT NULL,
    OverdueOrOutOfOrderMonthsFrom DECIMAL(18,2) NOT NULL,
    OverdueOrOutOfOrderMonthsTo DECIMAL(18,2) NOT NULL,
    NpaMonthsFrom DECIMAL(18,2) NOT NULL,
    NpaMonthsTo DECIMAL(18,2) NOT NULL,
    MinProvisionPercent DECIMAL(18,2) NOT NULL
);

-- 3. Create CollateralComplianceLogs Table
CREATE TABLE CollateralComplianceLogs (
    CollateralComplianceLogID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    LoanAccountID INT NOT NULL,
    CollateralType NVARCHAR(50) NOT NULL,
    ValuationDate DATETIME2 NOT NULL,
    ValuationValue DECIMAL(18,2) NOT NULL,
    ValuersCount INT NOT NULL DEFAULT 1,
    LastInspectionDate DATETIME2 NOT NULL,
    InsuranceExpiryDate DATETIME2 NOT NULL,
    LastStockStatementDate DATETIME2 NULL,
    IsAuditorVerified BIT NOT NULL DEFAULT 0,
    IsMarginMaintained BIT NOT NULL DEFAULT 1,
    CreatedOn DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_CollateralComplianceLogs_LoanAccounts FOREIGN KEY (LoanAccountID) REFERENCES LoanAccounts (LoanAccountID) ON DELETE CASCADE
);

-- 4. Create NpaClassificationRuns Table
CREATE TABLE NpaClassificationRuns (
    NpaClassificationRunID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RunDate DATETIME2 NOT NULL DEFAULT GETDATE(),
    TriggeredBy NVARCHAR(100) NOT NULL,
    RecordsProcessed INT NOT NULL DEFAULT 0,
    Status NVARCHAR(50) NOT NULL,
    Remarks NVARCHAR(500) NULL
);

-- 5. Create LoanAccountNpaStatuses Table
CREATE TABLE LoanAccountNpaStatuses (
    LoanAccountNpaStatusID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    LoanAccountID INT NOT NULL,
    AsOfDate DATETIME2 NOT NULL,
    OverdueDate DATETIME2 NULL,
    OutOfOrderDate DATETIME2 NULL,
    Category NVARCHAR(50) NOT NULL DEFAULT 'Standard',
    SecurityType NVARCHAR(50) NOT NULL DEFAULT 'Unsecured',
    OutstandingBalance DECIMAL(18,2) NOT NULL,
    CompliantCollateralValue DECIMAL(18,2) NOT NULL,
    ProvisionRequired DECIMAL(18,2) NOT NULL,
    ProvisionHeld DECIMAL(18,2) NOT NULL,
    IsAutoClassified BIT NOT NULL DEFAULT 1,
    LastClassificationRunId INT NOT NULL,
    AuditorRemarks NVARCHAR(500) NULL,
    CONSTRAINT FK_LoanAccountNpaStatuses_LoanAccounts FOREIGN KEY (LoanAccountID) REFERENCES LoanAccounts (LoanAccountID) ON DELETE CASCADE,
    CONSTRAINT FK_LoanAccountNpaStatuses_Runs FOREIGN KEY (LastClassificationRunId) REFERENCES NpaClassificationRuns (NpaClassificationRunID) ON DELETE CASCADE
);

-- 6. Create OverdueInterestLedgers Table
CREATE TABLE OverdueInterestLedgers (
    OverdueInterestLedgerID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    LoanAccountID INT NOT NULL,
    TransactionDate DATETIME2 NOT NULL,
    DebitAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    CreditAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    VoucherID INT NULL,
    Particulars NVARCHAR(250) NOT NULL,
    CONSTRAINT FK_OverdueInterestLedgers_LoanAccounts FOREIGN KEY (LoanAccountID) REFERENCES LoanAccounts (LoanAccountID) ON DELETE CASCADE,
    CONSTRAINT FK_OverdueInterestLedgers_Vouchers FOREIGN KEY (VoucherID) REFERENCES Vouchers (VoucherID)
);

-- 7. Create OverdueRecoveryLedgers Table
CREATE TABLE OverdueRecoveryLedgers (
    OverdueRecoveryLedgerID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    LoanAccountID INT NOT NULL,
    TransactionDate DATETIME2 NOT NULL,
    DebitAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    CreditAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    VoucherID INT NULL,
    Particulars NVARCHAR(250) NOT NULL,
    CONSTRAINT FK_OverdueRecoveryLedgers_LoanAccounts FOREIGN KEY (LoanAccountID) REFERENCES LoanAccounts (LoanAccountID) ON DELETE CASCADE,
    CONSTRAINT FK_OverdueRecoveryLedgers_Vouchers FOREIGN KEY (VoucherID) REFERENCES Vouchers (VoucherID)
);

-- 8. Create BorrowerLinkedAccounts Table
CREATE TABLE BorrowerLinkedAccounts (
    BorrowerLinkedAccountID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ParentMemberID INT NOT NULL,
    LinkedMemberID INT NOT NULL,
    LinkType NVARCHAR(50) NOT NULL DEFAULT 'Relative',
    Remarks NVARCHAR(250) NULL,
    CONSTRAINT FK_BorrowerLinkedAccounts_ParentMember FOREIGN KEY (ParentMemberID) REFERENCES Members (MemberID),
    CONSTRAINT FK_BorrowerLinkedAccounts_LinkedMember FOREIGN KEY (LinkedMemberID) REFERENCES Members (MemberID)
);

-- ==========================================
-- Seed Data for NPA Slabs (FY 24-25 to 27-28)
-- ==========================================

-- FY 2024-25 Slabs
INSERT INTO NpaProvisionSlabs (FinancialYear, Category, SecurityType, OverdueOrOutOfOrderMonthsFrom, OverdueOrOutOfOrderMonthsTo, NpaMonthsFrom, NpaMonthsTo, MinProvisionPercent) VALUES
('2024-25', 'Standard', 'Both', 0, 6, 0, 0, 0.25),
('2024-25', 'Sub-Standard', 'Both', 6, 18, 0, 12, 5.00),
('2024-25', 'Doubtful-1', 'Secured', 18, 42, 12, 36, 15.00),
('2024-25', 'Doubtful-1', 'Unsecured', 18, 42, 12, 36, 60.00),
('2024-25', 'Doubtful-2', 'Secured', 42, 54, 36, 48, 20.00),
('2024-25', 'Doubtful-2', 'Unsecured', 42, 54, 36, 48, 70.00),
('2024-25', 'Doubtful-3', 'Secured', 54, 999, 48, 999, 25.00),
('2024-25', 'Doubtful-3', 'Unsecured', 54, 999, 48, 999, 80.00),
('2024-25', 'Loss', 'Both', 0, 999, 0, 0, 100.00);

-- FY 2025-26 Slabs
INSERT INTO NpaProvisionSlabs (FinancialYear, Category, SecurityType, OverdueOrOutOfOrderMonthsFrom, OverdueOrOutOfOrderMonthsTo, NpaMonthsFrom, NpaMonthsTo, MinProvisionPercent) VALUES
('2025-26', 'Standard', 'Both', 0, 6, 0, 0, 0.25),
('2025-26', 'Sub-Standard', 'Both', 6, 18, 0, 12, 6.00),
('2025-26', 'Doubtful-1', 'Secured', 18, 42, 12, 36, 20.00),
('2025-26', 'Doubtful-1', 'Unsecured', 18, 42, 12, 36, 70.00),
('2025-26', 'Doubtful-2', 'Secured', 42, 54, 36, 48, 25.00),
('2025-26', 'Doubtful-2', 'Unsecured', 42, 54, 36, 48, 80.00),
('2025-26', 'Doubtful-3', 'Secured', 54, 999, 48, 999, 30.00),
('2025-26', 'Doubtful-3', 'Unsecured', 54, 999, 48, 999, 90.00),
('2025-26', 'Loss', 'Both', 0, 999, 0, 0, 100.00);

-- FY 2026-27 Slabs
INSERT INTO NpaProvisionSlabs (FinancialYear, Category, SecurityType, OverdueOrOutOfOrderMonthsFrom, OverdueOrOutOfOrderMonthsTo, NpaMonthsFrom, NpaMonthsTo, MinProvisionPercent) VALUES
('2026-27', 'Standard', 'Both', 0, 6, 0, 0, 0.25),
('2026-27', 'Sub-Standard', 'Both', 6, 18, 0, 12, 8.00),
('2026-27', 'Doubtful-1', 'Secured', 18, 42, 12, 36, 25.00),
('2026-27', 'Doubtful-1', 'Unsecured', 18, 42, 12, 36, 80.00),
('2026-27', 'Doubtful-2', 'Secured', 42, 54, 36, 48, 30.00),
('2026-27', 'Doubtful-2', 'Unsecured', 42, 54, 36, 48, 90.00),
('2026-27', 'Doubtful-3', 'Secured', 54, 999, 48, 999, 40.00),
('2026-27', 'Doubtful-3', 'Unsecured', 54, 999, 48, 999, 100.00),
('2026-27', 'Loss', 'Both', 0, 999, 0, 0, 100.00);

-- FY 2027-28 Slabs
INSERT INTO NpaProvisionSlabs (FinancialYear, Category, SecurityType, OverdueOrOutOfOrderMonthsFrom, OverdueOrOutOfOrderMonthsTo, NpaMonthsFrom, NpaMonthsTo, MinProvisionPercent) VALUES
('2027-28', 'Standard', 'Both', 0, 6, 0, 0, 0.25),
('2027-28', 'Sub-Standard', 'Both', 6, 18, 0, 12, 10.00),
('2027-28', 'Doubtful-1', 'Secured', 18, 42, 12, 36, 30.00),
('2027-28', 'Doubtful-1', 'Unsecured', 18, 42, 12, 36, 100.00),
('2027-28', 'Doubtful-2', 'Secured', 42, 54, 36, 48, 40.00),
('2027-28', 'Doubtful-2', 'Unsecured', 42, 54, 36, 48, 100.00),
('2027-28', 'Doubtful-3', 'Secured', 54, 999, 48, 999, 50.00),
('2027-28', 'Doubtful-3', 'Unsecured', 54, 999, 48, 999, 100.00),
('2027-28', 'Loss', 'Both', 0, 999, 0, 0, 100.00);

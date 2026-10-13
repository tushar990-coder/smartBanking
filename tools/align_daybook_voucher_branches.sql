-- =====================================================================================
-- Multi-Branch Accounting Alignment: Align Daybook & Cash Vouchers to Operating Branches
-- =====================================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

PRINT 'Starting Multi-Branch Daybook & Cash Voucher Alignment...';

-- 1. Auto-assign Branches.DefaultCashLedgerID if NULL
PRINT '1. Auto-assigning DefaultCashLedgerID on Branches...';

-- 1a. Head Office / Main Branch
UPDATE b
SET b.DefaultCashLedgerID = (
    SELECT TOP 1 l.LedgerID 
    FROM Ledgers l
    WHERE (l.LedgerName LIKE N'%मेन%' OR l.LedgerName LIKE N'%मुख्य%' OR l.LedgerName LIKE N'%Main%' OR l.LedgerName = N'हातावरील रोख शिल्लक' OR l.LedgerName = N'हातातील रोख शिल्लक')
      AND (l.LedgerName LIKE N'%रोख%' OR l.LedgerName LIKE N'%हात%' OR l.AccountType = 'Cash' OR l.LedgerName LIKE '%Cash%')
    ORDER BY CASE 
        WHEN l.LedgerName LIKE N'%मेन शाखा%' THEN 1 
        WHEN l.LedgerName LIKE N'%मुख्य%' THEN 2 
        ELSE 3 
    END, l.LedgerID
)
FROM Branches b
WHERE (b.BranchID = 1 OR b.BranchType = 'HeadOffice' OR b.BranchName LIKE N'%मुख्य%')
  AND b.DefaultCashLedgerID IS NULL;

-- 1b. Other Branches
UPDATE b
SET b.DefaultCashLedgerID = (
    SELECT TOP 1 l.LedgerID 
    FROM Ledgers l
    WHERE (l.LedgerName LIKE N'%' + LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(b.BranchName, N'शाखा', ''), N'ब्रांच', ''), N'कार्यालय', ''))) + N'%')
      AND (l.LedgerName LIKE N'%रोख%' OR l.LedgerName LIKE N'%हात%' OR l.AccountType = 'Cash' OR l.LedgerName LIKE '%Cash%')
    ORDER BY l.LedgerID
)
FROM Branches b
WHERE b.DefaultCashLedgerID IS NULL
  AND b.BranchID <> 1
  AND LEN(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(b.BranchName, N'शाखा', ''), N'ब्रांच', ''), N'कार्यालय', '')))) > 1;

-- 2. Align Vouchers to LoanCollections.BranchID
PRINT '2. Aligning Vouchers.BranchID with LoanCollections.BranchID...';

DECLARE @AlignedLoanColVouchers INT = 0;

UPDATE v
SET v.BranchID = lc.BranchID
FROM [dbo].[Vouchers] v
INNER JOIN [dbo].[LoanCollections] lc ON v.VoucherID = lc.VoucherID
WHERE v.BranchID <> lc.BranchID AND lc.BranchID > 0;

SET @AlignedLoanColVouchers = @@ROWCOUNT;
PRINT '   Aligned ' + CAST(@AlignedLoanColVouchers AS VARCHAR(10)) + ' Loan Collection vouchers.';

-- 3. Align Vouchers to LoanDisbursements.BranchID
PRINT '3. Aligning Vouchers.BranchID with LoanDisbursements.BranchID...';

DECLARE @AlignedLoanDisbVouchers INT = 0;

UPDATE v
SET v.BranchID = ld.BranchID
FROM [dbo].[Vouchers] v
INNER JOIN [dbo].[LoanDisbursements] ld ON v.VoucherID = ld.VoucherID
WHERE ld.BranchID > 0 AND v.BranchID <> ld.BranchID;

SET @AlignedLoanDisbVouchers = @@ROWCOUNT;
PRINT '   Aligned ' + CAST(@AlignedLoanDisbVouchers AS VARCHAR(10)) + ' Loan Disbursement vouchers.';

-- 4. Align Cash VoucherDetails to the Voucher Branch's DefaultCashLedgerID if mismatched
PRINT '4. Checking and aligning cash ledger entries in vouchers...';

UPDATE vd
SET vd.LedgerID = b.DefaultCashLedgerID
FROM [dbo].[VoucherDetails] vd
INNER JOIN [dbo].[Vouchers] v ON vd.VoucherID = v.VoucherID
INNER JOIN [dbo].[Branches] b ON v.BranchID = b.BranchID
INNER JOIN [dbo].[Ledgers] l ON vd.LedgerID = l.LedgerID
WHERE b.DefaultCashLedgerID IS NOT NULL
  AND vd.LedgerID <> b.DefaultCashLedgerID
  AND (l.AccountType = 'Cash' OR l.AccountType = 'Cash In Hand' OR l.LedgerName LIKE N'%रोख%' OR l.LedgerName LIKE N'%हात%')
  -- Only update if the current ledger belongs to another branch's cash
  AND EXISTS (
      SELECT 1 FROM Branches otherB 
      WHERE otherB.DefaultCashLedgerID = vd.LedgerID 
        AND otherB.BranchID <> v.BranchID
  );

PRINT 'Multi-Branch Daybook & Cash Voucher Alignment Complete!';

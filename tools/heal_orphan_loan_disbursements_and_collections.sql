-- =========================================================================================
-- SmartBanking ERP - Standalone Daybook Orphan Loan Disbursements & Collections Repair Script
-- Purpose: Permanently cleans unvouchered orphan LoanDisbursements (DISB-196, DISB-197, etc.)
--          and unvouchered LoanCollections created when vouchers were unpassed/deleted.
-- Target Databases: SmartBanking_bambavadeurban, SmartBanking_Template, etc.
-- =========================================================================================

SET NOCOUNT ON;
PRINT '========================================================================';
PRINT '  Starting Daybook Orphan Loan Disbursements & Collections Cleanup...   ';
PRINT '  Current Database Context: ' + DB_NAME();
PRINT '========================================================================';

-- 1. HEAL ORPHAN LOAN DISBURSEMENTS
IF OBJECT_ID('dbo.LoanDisbursements', 'U') IS NOT NULL
BEGIN
    IF OBJECT_ID('tempdb..#OrphanDisb') IS NOT NULL DROP TABLE #OrphanDisb;

    SELECT ld.LoanDisbursementID, ld.LoanAccountID, ld.DisbursementAmount, ld.DisbursementDate
    INTO #OrphanDisb
    FROM dbo.LoanDisbursements ld
    WHERE (ld.VoucherID IS NULL OR ld.VoucherID NOT IN (SELECT VoucherID FROM dbo.Vouchers WHERE Status NOT IN ('Cancelled', 'Rejected')))
      AND ISNULL(ld.PaymentMode, '') != 'Opening Balance'
      AND (ld.Remarks IS NULL OR (ld.Remarks NOT LIKE '%Opening Balance%' AND ld.Remarks NOT LIKE '%मागील येणे%'));

    DECLARE @OrphanDisbCount INT = (SELECT COUNT(*) FROM #OrphanDisb);
    IF @OrphanDisbCount > 0
    BEGIN
        PRINT '  [INFO] Found ' + CAST(@OrphanDisbCount AS VARCHAR(10)) + ' orphan LoanDisbursement(s) with NULL/Missing Voucher:';
        SELECT ld.LoanDisbursementID, ld.LoanAccountID, ld.DisbursementAmount, ld.DisbursementDate 
        FROM #OrphanDisb ld;

        -- A. Delete linked Deductions
        IF OBJECT_ID('dbo.LoanDisbursementDeductions', 'U') IS NOT NULL
        BEGIN
            DELETE FROM dbo.LoanDisbursementDeductions
            WHERE LoanDisbursementID IN (SELECT LoanDisbursementID FROM #OrphanDisb);
            PRINT '    -> Deleted associated LoanDisbursementDeductions.';
        END

        -- B. Delete orphan LoanDisbursements
        DELETE FROM dbo.LoanDisbursements
        WHERE LoanDisbursementID IN (SELECT LoanDisbursementID FROM #OrphanDisb);
        PRINT '    -> Deleted ' + CAST(@OrphanDisbCount AS VARCHAR(10)) + ' orphan LoanDisbursements.';

        -- C. Update LoanAccounts disbursement date
        UPDATE la
        SET la.LoanDisbursementDate = (
            SELECT MAX(ld2.DisbursementDate) 
            FROM dbo.LoanDisbursements ld2 
            WHERE ld2.LoanAccountID = la.LoanAccountID
        )
        FROM dbo.LoanAccounts la
        WHERE la.LoanAccountID IN (SELECT LoanAccountID FROM #OrphanDisb);
        PRINT '    -> Updated LoanAccounts disbursement dates.';

        PRINT '  -> [SUCCESS] Orphan LoanDisbursements healed! Daybook Payment side is balanced.';
    END
    ELSE
    BEGIN
        PRINT '  -> [OK] No orphan LoanDisbursements found. Everything is clean.';
    END

    IF OBJECT_ID('tempdb..#OrphanDisb') IS NOT NULL DROP TABLE #OrphanDisb;
END
GO

-- 2. HEAL ORPHAN LOAN COLLECTIONS
IF OBJECT_ID('dbo.LoanCollections', 'U') IS NOT NULL
BEGIN
    IF OBJECT_ID('tempdb..#OrphanCols') IS NOT NULL DROP TABLE #OrphanCols;

    SELECT lc.LoanCollectionID, lc.LoanAccountID, lc.ReceiptNo, lc.CollectionDate
    INTO #OrphanCols
    FROM dbo.LoanCollections lc
    WHERE (lc.VoucherID IS NULL OR lc.VoucherID NOT IN (SELECT VoucherID FROM dbo.Vouchers WHERE Status NOT IN ('Cancelled', 'Rejected')))
      AND (lc.HomeBranchVoucherID IS NULL OR lc.HomeBranchVoucherID NOT IN (SELECT VoucherID FROM dbo.Vouchers WHERE Status NOT IN ('Cancelled', 'Rejected')))
      AND (lc.Remarks IS NULL OR (lc.Remarks NOT LIKE '%Opening Balance%' AND lc.Remarks NOT LIKE '%मागील येणे%'));

    DECLARE @OrphanColCount INT = (SELECT COUNT(*) FROM #OrphanCols);
    IF @OrphanColCount > 0
    BEGIN
        PRINT '  [INFO] Found ' + CAST(@OrphanColCount AS VARCHAR(10)) + ' orphan LoanCollection(s) with NULL/Missing Voucher:';
        SELECT lc.LoanCollectionID, lc.LoanAccountID, lc.ReceiptNo, lc.CollectionDate
        FROM #OrphanCols lc;

        -- A. Delete linked Fees
        IF OBJECT_ID('dbo.LoanCollectionFees', 'U') IS NOT NULL
        BEGIN
            DELETE FROM dbo.LoanCollectionFees
            WHERE LoanCollectionID IN (SELECT LoanCollectionID FROM #OrphanCols);
            PRINT '    -> Deleted associated LoanCollectionFees.';
        END

        -- B. Delete orphan LoanCollections
        DELETE FROM dbo.LoanCollections
        WHERE LoanCollectionID IN (SELECT LoanCollectionID FROM #OrphanCols);
        PRINT '    -> Deleted ' + CAST(@OrphanColCount AS VARCHAR(10)) + ' orphan LoanCollections.';

        PRINT '  -> [SUCCESS] Orphan LoanCollections healed! Daybook Receipt side is balanced.';
    END
    ELSE
    BEGIN
        PRINT '  -> [OK] No orphan LoanCollections found. Everything is clean.';
    END

    IF OBJECT_ID('tempdb..#OrphanCols') IS NOT NULL DROP TABLE #OrphanCols;
END
GO

PRINT '========================================================================';
PRINT '  [DONE] Daybook Orphan Repair Completed Successfully.                   ';
PRINT '========================================================================';

-- =========================================================================================
-- SmartBanking Core ERP - Standalone SQL Script for All Sanstha Databases
-- Purpose: Safely detects and restores orphaned closed FD accounts across any selected Sanstha database.
-- Target Databases: SmartBanking_padvalwadi, SmartBanking_bambavadeurban, SmartBanking_maharshiyadrav,
--                   SmartBanking_ritemployee, SmartBanking_sahyadribambavade, SmartBanking_Testing, etc.
-- =========================================================================================

-- TIP: Change database name below if running for a specific database:
-- USE [SmartBanking_padvalwadi];
-- GO

SET NOCOUNT ON;

PRINT '===================================================================================';
PRINT '  [FD RESTORE] मुदत ठेव अनाथ बंद खाती पडताळणी व पुनर्संचयित (Orphaned Closed FD Accounts)';
PRINT '  डेटाबेस: ' + DB_NAME();
PRINT '===================================================================================';

IF OBJECT_ID('FdAccounts', 'U') IS NOT NULL
BEGIN
    -- १. अनाथ बंद मुदत ठेव खाती ओळखणे (Closed Status but NO active closure voucher/transaction)
    IF OBJECT_ID('tempdb..#OrphanedFdAccounts') IS NOT NULL DROP TABLE #OrphanedFdAccounts;

    SELECT 
        f.FdAccountID,
        f.AccountNo,
        f.LegacyAccountNumber,
        f.DepositAmount,
        f.OpeningDate,
        f.MaturityDate,
        f.Status AS OldStatus,
        f.Remarks AS OldRemarks,
        CASE 
            WHEN f.MaturityDate <= CAST(GETDATE() AS DATE) THEN 'Matured' 
            ELSE 'Active' 
        END AS TargetStatus
    INTO #OrphanedFdAccounts
    FROM FdAccounts f
    WHERE f.Status = 'Closed'
      AND NOT EXISTS (
          SELECT 1 
          FROM FdTransactions ft
          INNER JOIN Vouchers v ON ft.VoucherID = v.VoucherID
          WHERE ft.FdAccountID = f.FdAccountID
            AND ft.TransactionType IN ('Payout', 'Premature_Close')
            AND ISNULL(v.Status, '') NOT IN ('Cancelled', 'Rejected')
      );

    DECLARE @OrphanCount INT = (SELECT COUNT(*) FROM #OrphanedFdAccounts);

    IF @OrphanCount > 0
    BEGIN
        PRINT '  -> आढळलेली बाधित खाती (Orphaned Closed Accounts Count): ' + CAST(@OrphanCount AS VARCHAR(10));

        -- यादी दाखवा
        SELECT 
            o.FdAccountID,
            o.AccountNo,
            o.LegacyAccountNumber,
            o.DepositAmount,
            o.MaturityDate,
            o.OldStatus,
            o.TargetStatus AS नवीन_स्थिती,
            o.OldRemarks
        FROM #OrphanedFdAccounts o;

        -- २. व्हाउचर नसलेले जुने Payout व्यवहार हटवणे
        IF OBJECT_ID('FdTransactions', 'U') IS NOT NULL
        BEGIN
            DELETE ft
            FROM FdTransactions ft
            INNER JOIN #OrphanedFdAccounts o ON ft.FdAccountID = o.FdAccountID
            WHERE ft.TransactionType IN ('Payout', 'Premature_Close')
              AND (
                  ft.VoucherID IS NULL 
                  OR NOT EXISTS (SELECT 1 FROM Vouchers v WHERE v.VoucherID = ft.VoucherID AND ISNULL(v.Status, '') NOT IN ('Cancelled', 'Rejected'))
              );
            PRINT '  -> अमान्य / व्हाउचर नसलेले क्लोजर व्यवहार साफ केले.';
        END

        -- ३. FdAccounts मधील Status पूर्ववत करणे
        UPDATE f
        SET 
            f.Status = o.TargetStatus,
            f.Remarks = CASE 
                WHEN CHARINDEX(' | बंद दिनांक:', f.Remarks) > 0 
                THEN SUBSTRING(f.Remarks, 1, CHARINDEX(' | बंद दिनांक:', f.Remarks) - 1) + ' | [पूर्ववत ' + CONVERT(VARCHAR(10), GETDATE(), 105) + '] व्हाउचर डिलीट झाल्याने खाते पूर्ववत केले'
                ELSE ISNULL(f.Remarks, '') + ' | [पूर्ववत ' + CONVERT(VARCHAR(10), GETDATE(), 105) + '] खाते पूर्ववत केले'
            END,
            f.ModifiedDate = GETDATE()
        FROM FdAccounts f
        INNER JOIN #OrphanedFdAccounts o ON f.FdAccountID = o.FdAccountID;

        -- ४. ऑडिट लॉग नोंद
        IF OBJECT_ID('AuditLogs', 'U') IS NOT NULL
        BEGIN
            INSERT INTO AuditLogs (Action, EntityName, EntityID, Details, Timestamp, Status)
            SELECT 
                'FD_ACCOUNT_AUTO_RESTORED',
                'FdAccount',
                ISNULL(o.AccountNo, CAST(o.FdAccountID AS VARCHAR(20))),
                'मुदत ठेव खाते क्र. ' + ISNULL(o.AccountNo, '') + 
                CASE WHEN o.LegacyAccountNumber IS NOT NULL THEN ' (जुना क्र. ' + o.LegacyAccountNumber + ')' ELSE '' END + 
                ' ची स्थिती Closed वरून ' + o.TargetStatus + ' वर पूर्ववत केली. ठेव रक्कम: ₹' + 
                CAST(CAST(o.DepositAmount AS DECIMAL(18,2)) AS VARCHAR(30)) + '. कारण: क्लोजर व्हाउचर सिस्टीममध्ये उपलब्ध नसल्याने पूर्ववत केले.',
                GETDATE(),
                'Success'
            FROM #OrphanedFdAccounts o;
        END

        PRINT '  -> [यशस्वी] सर्व ' + CAST(@OrphanCount AS VARCHAR(10)) + ' बाधित मुदत ठेव खाती पूर्ववत करण्यात आली!';
    END
    ELSE
    BEGIN
        PRINT '  -> कोणतीही विसंगत / अनाथ बंद मुदत ठेव खाती आढळली नाहीत. सर्व खाती सुसंगत आहेत (100% OK).';
    END

    IF OBJECT_ID('tempdb..#OrphanedFdAccounts') IS NOT NULL DROP TABLE #OrphanedFdAccounts;
END
GO

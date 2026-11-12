-- =========================================================================================
-- SmartBanking ERP - Multi-Database Pigmy Transaction Date & Voucher Sync Script
-- This script automatically loops through all active 'SmartBanking_%' databases
-- EXCEPT the databases you list in the NOT IN filter below.
-- =========================================================================================

SET NOCOUNT ON;

DECLARE @dbName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT name 
FROM sys.databases 
WHERE name LIKE 'SmartBanking_%' 
  AND state_desc = 'ONLINE'
  AND name NOT IN (
      'master', 'tempdb', 'model', 'msdb',
      -- >>> Excluded Databases (या डेटाबेसेसवर स्क्रिप्ट चालणार नाही) <<<
      'SmartBanking_abc',
      'SmartBanking_FinEx',
      'SmartBanking_JotirlingPdw',
      'SmartBanking_maharshiyadravkar',
      'SmartBanking_nivruttisangha',
      'SmartBanking_ritemployee',
      'SmartBanking_sanghatesting'
  )
ORDER BY name;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @dbName;

PRINT '============================================================';
PRINT 'Starting Pigmy Transaction Date Sync on Databases (with Exclusions)';
PRINT '============================================================';

WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT '------------------------------------------------------------';
    PRINT 'Processing Database: [' + @dbName + ']';

    SET @sql = N'
    USE [' + @dbName + '];

    IF OBJECT_ID(''dbo.PigmyTransactions'', ''U'') IS NOT NULL 
       AND OBJECT_ID(''dbo.PigmyCollections'', ''U'') IS NOT NULL
       AND OBJECT_ID(''dbo.Vouchers'', ''U'') IS NOT NULL
    BEGIN
        DECLARE @rowsUpdated INT = 0;

        UPDATE pt
        SET pt.TransactionDate = v.VoucherDate,
            pt.ReferenceId = v.VoucherNo
        FROM PigmyTransactions pt
        JOIN PigmyCollections c ON c.PigmyAccountId = pt.PigmyAccountID 
            AND (pt.Narration LIKE ''%'' + c.ReceiptNo + ''%'' OR (pt.ValueDate = c.CollectionDate AND pt.CrAmount = c.CollectionAmount AND pt.TransactionType = ''DEPOSIT''))
        JOIN Vouchers v ON v.VoucherID = c.VoucherId
        WHERE pt.TransactionDate != v.VoucherDate 
           OR pt.ReferenceId IS NULL 
           OR pt.ReferenceId != v.VoucherNo;

        SET @rowsUpdated = @@ROWCOUNT;
        PRINT ''  [SUCCESS] Updated '' + CAST(@rowsUpdated AS VARCHAR(10)) + '' transaction(s) in ['' + @dbName + ''].'';
    END
    ELSE
    BEGIN
        PRINT ''  [SKIPPED] Pigmy tables do not exist in ['' + @dbName + ''].'';
    END';

    BEGIN TRY
        EXEC sp_executesql @sql;
    END TRY
    BEGIN CATCH
        PRINT '  [ERROR in ' + @dbName + ']: ' + ERROR_MESSAGE();
    END CATCH;

    FETCH NEXT FROM db_cursor INTO @dbName;
END;

CLOSE db_cursor;
DEALLOCATE db_cursor;

PRINT '============================================================';
PRINT 'All selected databases processed successfully!';
PRINT '============================================================';

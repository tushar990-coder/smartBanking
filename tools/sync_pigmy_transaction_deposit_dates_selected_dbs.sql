-- =========================================================================================
-- SmartBanking ERP - Pigmy Transaction Date & Voucher Sync on SELECTED Databases
-- =========================================================================================
-- Simply add or remove database names in the list below (@TargetDatabases).
-- The script will loop ONLY through the databases you specify.
-- =========================================================================================

SET NOCOUNT ON;

DECLARE @TargetDatabases TABLE (DatabaseName NVARCHAR(128));

-- >>> खाली तुम्हाला ज्या डेटाबेसेसवर सिंक रन करायचा आहे त्यांची नावे टाका <<<
INSERT INTO @TargetDatabases (DatabaseName)
VALUES 
    ('SmartBanking_bambavadeurban'),
    ('SmartBanking_maharshiyadrav'),
    ('SmartBanking_padvalwadi'),
    ('SmartBanking_ritemp'),
    ('SmartBanking_sahyadribambavade'),
    ('SmartBanking_sahyadrikarmachari'),
    ('SmartBanking_Testing'),
    ('SmartBanking_testing1'),
    ('SmartBanking_vidyasagarkavathesar')
    -- आणखी डेटाबेस जोडण्यासाठी खाली नवीन ओळ जोडा:
    -- ,('SmartBanking_नवीन_डेटाबेस')
;

DECLARE @dbName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT t.DatabaseName 
FROM @TargetDatabases t
JOIN sys.databases d ON d.name = t.DatabaseName
WHERE d.state_desc = 'ONLINE'
ORDER BY t.DatabaseName;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @dbName;

PRINT '============================================================';
PRINT 'Starting Pigmy Transaction Date Sync on Selected Databases';
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
        PRINT ''  [SUCCESS] Updated '' + CAST(@rowsUpdated AS VARCHAR(10)) + '' Pigmy transaction row(s) in ['' + @dbName + ''].'';
    END
    ELSE
    BEGIN
        PRINT ''  [SKIPPED] Pigmy tables not found in ['' + @dbName + ''].'';
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
PRINT 'Selected databases processing finished!';
PRINT '============================================================';


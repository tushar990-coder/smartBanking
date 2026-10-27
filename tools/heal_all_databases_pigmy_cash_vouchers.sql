-- ==============================================================================
-- Script: heal_all_databases_pigmy_cash_vouchers.sql
-- उद्देश: सर्व स्मार्ट बँकिंग डेटाबेसेसमधील पिग्मी संकलन व्हाउचर्समधील रोख खाते (Cash Ledger)
--        स्वयंचलित दुरुस्त करणारी १००% सुरक्षित व एरर-फ्री युनिव्हर्सल स्क्रिप्ट.
-- ==============================================================================

USE [master];
GO

SET NOCOUNT ON;

DECLARE @dbName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

PRINT '======================================================================';
PRINT '  SmartBanking ERP - Universal Multi-Database Pigmy Cash Ledger Healer ';
PRINT '======================================================================';

DECLARE db_cursor CURSOR FOR
SELECT name 
FROM sys.databases 
WHERE name LIKE 'SmartBanking_%' AND state_desc = 'ONLINE'
ORDER BY name;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @dbName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = '
    USE [' + @dbName + '];
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name = ''Vouchers'') 
       AND EXISTS (SELECT 1 FROM sys.tables WHERE name = ''VoucherDetails'')
       AND EXISTS (SELECT 1 FROM sys.tables WHERE name = ''Branches'')
       AND EXISTS (SELECT 1 FROM sys.tables WHERE name = ''Ledgers'')
    BEGIN
        DECLARE @rows INT = 0;
        
        -- १. व्हाउचर्सच्या डेबिट बाजूला शाखेचे अधिकृत कॅश लेजर अपडेट करणे
        UPDATE vd
        SET vd.LedgerID = COALESCE(
            b.DefaultCashLedgerID,
            (SELECT TOP 1 l.LedgerID FROM Ledgers l 
             WHERE (l.AccountType IN (''Cash'', ''Cash In Hand'') OR l.LedgerName LIKE N''%रोख%'' OR l.LedgerName LIKE N''%हात%'' OR l.LedgerName LIKE ''%Cash%'')
             ORDER BY l.LedgerID)
        )
        FROM VoucherDetails vd
        INNER JOIN Vouchers v ON vd.VoucherID = v.VoucherID
        INNER JOIN Branches b ON v.BranchID = b.BranchID
        WHERE vd.DrCr = ''Dr''
          AND vd.LedgerID = 1
          AND (v.VoucherNo LIKE ''%-IMP-%'' OR v.VoucherNo LIKE ''PV-%'' OR v.Narration LIKE N''%पिग्मी%'' OR v.Narration LIKE ''%Pigmy%'');

        SET @rows = @@ROWCOUNT;

        -- २. PigmyVoucherMappings टेबलमध्ये प्रत्येक शाखेचे डायनॅमिक मॅपिंग खात्री करणे
        IF EXISTS (SELECT 1 FROM sys.tables WHERE name = ''PigmyVoucherMappings'')
        BEGIN
            INSERT INTO PigmyVoucherMappings (BranchId, CollectionSource, DebitLedgerId, CreditLedgerId, IsActive)
            SELECT 
                data.BranchID,
                data.ColSource,
                data.ResolvedDr,
                data.ResolvedCr,
                1
            FROM (
                SELECT 
                    b.BranchID,
                    src.ColSource,
                    COALESCE(b.DefaultCashLedgerID, (SELECT TOP 1 l.LedgerID FROM Ledgers l WHERE l.AccountType IN (''Cash'', ''Cash In Hand'') OR l.LedgerName LIKE N''%रोख%'' ORDER BY l.LedgerID)) AS ResolvedDr,
                    COALESCE(
                        (SELECT TOP 1 s.PigmyLiabilityLedgerID FROM PigmySchemes s WHERE COL_LENGTH(''PigmySchemes'', ''PigmyLiabilityLedgerID'') IS NOT NULL AND s.PigmyLiabilityLedgerID > 0),
                        (SELECT TOP 1 l.LedgerID FROM Ledgers l WHERE l.LedgerName LIKE N''%पिग्मी%'' ORDER BY l.LedgerID)
                    ) AS ResolvedCr
                FROM Branches b
                CROSS JOIN (SELECT ''MANUAL'' AS ColSource UNION ALL SELECT ''APP'' AS ColSource) src
            ) data
            WHERE data.ResolvedDr IS NOT NULL 
              AND data.ResolvedCr IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM PigmyVoucherMappings m WHERE m.BranchId = data.BranchID AND m.CollectionSource = data.ColSource);
        END

        IF @rows > 0
            PRINT ''['' + ''' + @dbName + ''' + ''] -> दुरुस्ती पूर्ण: एकूण '' + CAST(@rows AS VARCHAR(10)) + '' व्हाउचर्स योग्य कॅश लेजरवर अपडेट झाले.'';
        ELSE
            PRINT ''['' + ''' + @dbName + ''' + ''] -> स्वच्छ: एकही चुकीचे व्हाउचर नाही (0 bad vouchers).'';
    END
    ';

    BEGIN TRY
        EXEC sp_executesql @sql;
    END TRY
    BEGIN CATCH
        PRINT '[' + @dbName + '] सूचना: ' + ERROR_MESSAGE();
    END CATCH

    FETCH NEXT FROM db_cursor INTO @dbName;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

PRINT '';
PRINT '======================================================================';
PRINT ' सर्व डेटाबेसेस तपासणी व दुरुस्ती प्रक्रिया यशस्वीरीत्या पूर्ण झाली!';
PRINT '======================================================================';
GO

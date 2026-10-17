-- =========================================================================================
-- SmartBanking ERP - Add OldInvestmentNo to ALL SmartBanking Databases
-- Automatically iterates over all online SmartBanking_* databases on the SQL Server instance
-- =========================================================================================

SET NOCOUNT ON;

DECLARE @dbName NVARCHAR(128);
DECLARE @sqlQuery NVARCHAR(MAX);

DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT name 
FROM sys.databases 
WHERE name LIKE 'SmartBanking_%'
  AND state_desc = 'ONLINE'
  AND is_read_only = 0
ORDER BY name;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @dbName;

PRINT '============================================================';
PRINT '  SmartBanking ERP: Adding OldInvestmentNo Column';
PRINT '============================================================';

WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT '';
    PRINT '>> Processing Database: [' + @dbName + ']';
    
    SET @sqlQuery = N'
    USE [' + @dbName + N'];
    
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ''InvestmentAccounts'')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ''InvestmentAccounts'' AND COLUMN_NAME = ''OldInvestmentNo'')
        BEGIN
            ALTER TABLE InvestmentAccounts ADD OldInvestmentNo NVARCHAR(50) NULL;
            PRINT ''   [+] Added OldInvestmentNo column (NVARCHAR(50) NULL).'';
        END
        ELSE
        BEGIN
            PRINT ''   [i] OldInvestmentNo column already exists.'';
        END
    END
    ELSE
    BEGIN
        PRINT ''   [!] InvestmentAccounts table does not exist in this database.'';
    END';

    EXEC sp_executesql @sqlQuery;
    
    FETCH NEXT FROM db_cursor INTO @dbName;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

PRINT '';
PRINT '============================================================';
PRINT '  SUCCESS: OldInvestmentNo column added across all databases!';
PRINT '============================================================';

-- =========================================================================================
-- SmartBanking ERP - Apply Investment Duration Columns to ALL SmartBanking Databases
-- Automatically iterates over all online SmartBanking_* databases on the SQL Server instance
-- =========================================================================================

SET NOCOUNT ON;

DECLARE @dbName NVARCHAR(128);
DECLARE @sqlQuery NVARCHAR(MAX);
DECLARE @safeConstraintName NVARCHAR(128);

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
PRINT '  SmartBanking ERP: Multi-Database Schema Update';
PRINT '  Adding: DurationType & DurationDays to InvestmentSchemes';
PRINT '============================================================';

WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT '';
    PRINT '>> Processing Database: [' + @dbName + ']';

    SET @safeConstraintName = 'DF_InvSchemes_' + SUBSTRING(REPLACE(REPLACE(@dbName, '-', '_'), ' ', '_'), 1, 40) + '_DurationType';
    
    SET @sqlQuery = N'
    USE [' + @dbName + N'];
    
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ''InvestmentSchemes'')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ''InvestmentSchemes'' AND COLUMN_NAME = ''DurationType'')
        BEGIN
            ALTER TABLE InvestmentSchemes ADD DurationType NVARCHAR(20) NOT NULL CONSTRAINT [' + @safeConstraintName + N'] DEFAULT ''Months'';
            PRINT ''   [+] Added DurationType column (Default: Months).'';
        END
        ELSE
        BEGIN
            PRINT ''   [i] DurationType column already exists.'';
        END

        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ''InvestmentSchemes'' AND COLUMN_NAME = ''DurationDays'')
        BEGIN
            ALTER TABLE InvestmentSchemes ADD DurationDays INT NULL;
            PRINT ''   [+] Added DurationDays column (INT NULL).'';
        END
        ELSE
        BEGIN
            PRINT ''   [i] DurationDays column already exists.'';
        END
    END
    ELSE
    BEGIN
        PRINT ''   [!] InvestmentSchemes table does not exist in this database.'';
    END';

    EXEC sp_executesql @sqlQuery;
    
    FETCH NEXT FROM db_cursor INTO @dbName;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

PRINT '';
PRINT '============================================================';
PRINT '  SUCCESS: All SmartBanking databases processed cleanly!';
PRINT '============================================================';

-- ============================================================================
-- SmartBanking ERP - Database Dynamic Cleanup Script
-- सुरक्षितपणे Branch, Financial Year, User आणि Role सोडून इतर सर्व डेटा डिलीट करतो
-- सर्व टेबल्सचा Identity Seed पुन्हा 0 वर रिसेट करतो
-- ============================================================================

USE [SmartBanking_ShareTest]; -- तुमच्या डेटाबेसचे नाव
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '=======================================================';
PRINT '१. फॉरेन की कन्सट्रेंट्स डिसेबल करत आहे...';
PRINT '=======================================================';
EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT all";
GO

DECLARE @TableName NVARCHAR(256);
DECLARE @Sql NVARCHAR(MAX);

-- ज्या टेबल्सचा डेटा सुरक्षित ठेवायचा आहे त्यांची यादी
DECLARE @KeepTables TABLE (TableName NVARCHAR(256));
INSERT INTO @KeepTables (TableName) VALUES 
('Branches'),
('BranchMasters'),
('FinancialYears'),
('Users'),
('Roles'),
('RolePermissions'),
('SansthaDetails'),
('__EFMigrationsHistory');

-- शाखेचे जुने कॅश लेजर आयडी क्लिअर करा (कारण सर्व लेजर्स नव्याने तयार होणार आहेत)
UPDATE [dbo].[Branches] SET [DefaultCashLedgerID] = NULL;

PRINT '२. डेटा डिलीट करण्यास सुरुवात करत आहे...';

DECLARE table_cursor CURSOR FOR
SELECT t.name 
FROM sys.tables t
WHERE t.name NOT IN (SELECT TableName FROM @KeepTables)
ORDER BY t.name;

OPEN table_cursor;
FETCH NEXT FROM table_cursor INTO @TableName;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        SET @Sql = N'DELETE FROM [dbo].[' + @TableName + N'];';
        EXEC sp_executesql @Sql;
        PRINT '✓ डिलीट पूर्ण: ' + @TableName;
    END TRY
    BEGIN CATCH
        PRINT '❌ त्रुटी (' + @TableName + '): ' + ERROR_MESSAGE();
    END CATCH;

    FETCH NEXT FROM table_cursor INTO @TableName;
END;

CLOSE table_cursor;
DEALLOCATE table_cursor;
GO

PRINT '=======================================================';
PRINT '३. आयडेंटिटी सीड्स (Identity Seeds) 0 वर रिसेट करत आहे...';
PRINT '=======================================================';

DECLARE @IdTable NVARCHAR(256);
DECLARE @ReseedSql NVARCHAR(MAX);

DECLARE reseed_cursor CURSOR FOR
SELECT t.name 
FROM sys.tables t
INNER JOIN sys.identity_columns c ON t.object_id = c.object_id
WHERE t.name NOT IN ('Branches', 'BranchMasters', 'FinancialYears', 'Users', 'Roles', 'RolePermissions', 'SansthaDetails', '__EFMigrationsHistory')
ORDER BY t.name;

OPEN reseed_cursor;
FETCH NEXT FROM reseed_cursor INTO @IdTable;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        SET @ReseedSql = N'
            IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID(''[dbo].[' + @IdTable + N']'') AND last_value IS NOT NULL)
            BEGIN
                DBCC CHECKIDENT (''[dbo].[' + @IdTable + N']'', RESEED, 0);
            END
            ELSE
            BEGIN
                DBCC CHECKIDENT (''[dbo].[' + @IdTable + N']'', RESEED, 1);
            END
        ';
        EXEC sp_executesql @ReseedSql;
        PRINT '✓ Reseeded to start at 1: ' + @IdTable;
    END TRY
    BEGIN CATCH
        PRINT '⚠️ Reseed चेतावणी (' + @IdTable + '): ' + ERROR_MESSAGE();
    END CATCH;

    FETCH NEXT FROM reseed_cursor INTO @IdTable;
END;

CLOSE reseed_cursor;
DEALLOCATE reseed_cursor;
GO

PRINT '=======================================================';
PRINT '४. फॉरेन की कन्सट्रेंट्स पुन्हा एनेबल करत आहे...';
PRINT '=======================================================';
EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";
GO

PRINT '=======================================================';
PRINT 'अभिनंदन! सर्व डेटा पूर्णपणे क्लिअर झाला आहे.';
PRINT 'Branch, Financial Year, User आणि Role डेटा सुरक्षित आहे.';
PRINT 'सर्व नवीन खाती / व्यवहारांचे क्रमांक आता 1 पासून सुरू होतील.';
PRINT '=======================================================';
GO

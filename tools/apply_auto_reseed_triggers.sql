-- ==============================================================================
-- DATABASE SELF-HEALING ARCHITECTURE: AUTOMATIC IDENTITY RE-SEED & GAP PREVENTER
-- ==============================================================================
-- Purpose:
-- 1. Creates AFTER DELETE triggers on every user table with an IDENTITY column.
-- 2. Whenever a hard delete occurs (single or bulk), the trigger automatically
--    and silently checks if IDENT_CURRENT > MAX(ID).
--    If tail records were deleted, it executes DBCC CHECKIDENT(table, RESEED, MAX(ID))
--    so that the internal SQL Server counter rewinds back to the actual maximum ID.
-- 3. If a table becomes completely empty, it reseeds to 0 so the next insert receives 1.
-- 4. Intermediate row deletions do not trigger reseed, preserving relational integrity.
-- 5. Defines stored procedure [dbo].[sp_SyncDatabaseIdentities] for startup & maintenance.
-- ==============================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_SyncDatabaseIdentities]
AS
BEGIN
    SET NOCOUNT ON;
    SET ANSI_NULLS ON;
    SET QUOTED_IDENTIFIER ON;

    DECLARE @tbl NVARCHAR(256), @col NVARCHAR(256);
    DECLARE @sql NVARCHAR(MAX);
    DECLARE @reseededCount INT = 0;
    DECLARE @triggerCount INT = 0;

    -- Cursor across all user tables that contain an identity column
    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT t.name, c.name
    FROM sys.tables t
    INNER JOIN sys.identity_columns c ON t.object_id = c.object_id
    WHERE t.is_ms_shipped = 0
    ORDER BY t.name;

    OPEN cur;
    FETCH NEXT FROM cur INTO @tbl, @col;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- A. Create / Alter AFTER DELETE self-healing trigger
        SET @sql = '
        CREATE OR ALTER TRIGGER [dbo].[trg_AutoReseed_' + REPLACE(@tbl, ' ', '_') + ']
        ON [dbo].[' + @tbl + ']
        AFTER DELETE
        AS
        BEGIN
            SET NOCOUNT ON;
            BEGIN TRY
                DECLARE @maxId BIGINT;
                SELECT @maxId = MAX([' + @col + ']) FROM [dbo].[' + @tbl + '];
                
                IF @maxId IS NOT NULL
                BEGIN
                    DECLARE @currId BIGINT = CAST(IDENT_CURRENT(''[dbo].[' + @tbl + ']'') AS BIGINT);
                    IF @currId > @maxId
                    BEGIN
                        DBCC CHECKIDENT (''[dbo].[' + @tbl + ']'', RESEED, @maxId) WITH NO_INFOMSGS;
                    END
                END
                ELSE
                BEGIN
                    DBCC CHECKIDENT (''[dbo].[' + @tbl + ']'', RESEED, 0) WITH NO_INFOMSGS;
                END
            END TRY
            BEGIN CATCH
                -- Prevent blocking application deletes
            END CATCH
        END;';

        BEGIN TRY
            EXEC sp_executesql @sql;
            SET @triggerCount = @triggerCount + 1;
        END TRY
        BEGIN CATCH
            PRINT 'Failed creating trigger for ' + @tbl + ': ' + ERROR_MESSAGE();
        END CATCH

        -- B. Check if table is currently desynchronized (IDENT_CURRENT > MAX)
        BEGIN TRY
            DECLARE @actualMax BIGINT = NULL;
            DECLARE @maxQuery NVARCHAR(MAX) = 'SELECT @m = MAX([' + @col + ']) FROM [' + @tbl + ']';
            EXEC sp_executesql @maxQuery, N'@m BIGINT OUTPUT', @m = @actualMax OUTPUT;

            DECLARE @currentIdent BIGINT = CAST(IDENT_CURRENT(@tbl) AS BIGINT);

            IF @actualMax IS NOT NULL
            BEGIN
                IF @currentIdent > @actualMax
                BEGIN
                    DBCC CHECKIDENT (@tbl, RESEED, @actualMax) WITH NO_INFOMSGS;
                    PRINT 'Reseeded ' + @tbl + ' from ' + CAST(@currentIdent AS NVARCHAR) + ' to ' + CAST(@actualMax AS NVARCHAR);
                    SET @reseededCount = @reseededCount + 1;
                END
            END
            ELSE
            BEGIN
                -- Table is empty. If it was previously inserted into, currentIdent > 0
                IF @currentIdent > 0
                BEGIN
                    DBCC CHECKIDENT (@tbl, RESEED, 0) WITH NO_INFOMSGS;
                    PRINT 'Reseeded empty table ' + @tbl + ' to 0';
                    SET @reseededCount = @reseededCount + 1;
                END
            END
        END TRY
        BEGIN CATCH
            PRINT 'Failed checking ident for ' + @tbl + ': ' + ERROR_MESSAGE();
        END CATCH

        FETCH NEXT FROM cur INTO @tbl, @col;
    END

    CLOSE cur;
    DEALLOCATE cur;

    PRINT 'Completed: ' + CAST(@triggerCount AS NVARCHAR) + ' triggers ensured, ' + CAST(@reseededCount AS NVARCHAR) + ' tables reseeded.';
END;
GO

-- Execute procedure once right now to apply triggers and synchronize database
EXEC [dbo].[sp_SyncDatabaseIdentities];
GO

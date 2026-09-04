-- ==========================================================================================
-- SCRIPT: Reset 'admin' Password to 'Shri@2026' Across All SmartBanking Client Databases
-- ==========================================================================================
-- New Password : Shri@2026
-- BCrypt Hash  : $2a$11$6fxAYBVHsmYhkIWjlMOe0OG98hAkMMAUUifrbG4Ju.jE/SMOyJtAK
-- ==========================================================================================

SET NOCOUNT ON;

DECLARE @AdminHash NVARCHAR(255) = N'$2a$11$6fxAYBVHsmYhkIWjlMOe0OG98hAkMMAUUifrbG4Ju.jE/SMOyJtAK';
DECLARE @DbName NVARCHAR(128);
DECLARE @Sql NVARCHAR(MAX);

PRINT '====================================================================================';
PRINT '  🔐 BATCH RESET: Updating admin password to Shri@2026 across all databases...';
PRINT '====================================================================================';

DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT name 
FROM sys.databases 
WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
  AND state_desc = 'ONLINE'
ORDER BY name;

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @DbName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @Sql = N'
    IF EXISTS (SELECT 1 FROM [' + @DbName + N'].INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = ''Users'')
    BEGIN
        IF EXISTS (SELECT 1 FROM [' + @DbName + N'].[dbo].[Users] WHERE Username = ''admin'')
        BEGIN
            UPDATE [' + @DbName + N'].[dbo].[Users]
            SET PasswordHash = @Hash,
                IsLocked = 0,
                IsActive = 1,
                FailedLoginAttempts = 0,
                RequirePasswordChange = 0
            WHERE Username = ''admin'';
            PRINT ''  [SUCCESS] Updated admin password in database: [' + @DbName + ']'';
        END
        ELSE
        BEGIN
            DECLARE @RoleId INT = (SELECT TOP 1 RoleID FROM [' + @DbName + N'].[dbo].[Roles] WHERE RoleName = ''Admin'');
            IF @RoleId IS NULL
            BEGIN
                INSERT INTO [' + @DbName + N'].[dbo].[Roles] (RoleName, Description) VALUES (''Admin'', ''System Administrator'');
                SET @RoleId = SCOPE_IDENTITY();
            END

            INSERT INTO [' + @DbName + N'].[dbo].[Users] (Username, PasswordHash, RoleID, IsActive, IsLocked, FailedLoginAttempts, RequirePasswordChange)
            VALUES (''admin'', @Hash, @RoleId, 1, 0, 0, 0);
            PRINT ''  [SUCCESS] Created admin user with new password in database: [' + @DbName + ']'';
        END
    END
    ELSE
    BEGIN
        PRINT ''  [SKIPPED] Database [' + @DbName + '] does not contain Users table.'';
    END';

    BEGIN TRY
        EXEC sp_executesql @Sql, N'@Hash NVARCHAR(255)', @Hash = @AdminHash;
    END TRY
    BEGIN CATCH
        PRINT '  [ERROR] Database [' + @DbName + ']: ' + ERROR_MESSAGE();
    END CATCH

    FETCH NEXT FROM db_cursor INTO @DbName;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

PRINT '====================================================================================';
PRINT '  🎉 DONE: All admin accounts have been reset to: Shri@2026';
PRINT '====================================================================================';

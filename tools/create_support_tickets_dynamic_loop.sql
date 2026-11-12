-- =========================================================================================
-- SmartBanking ERP - Dynamic Auto-Loop with Strict Exclusions
-- Excludes the 7 specific databases:
--   - SmartBanking_abc
--   - SmartBanking_FinEx
--   - SmartBanking_JotirlingPdw
--   - SmartBanking_maharshiyadravkar
--   - SmartBanking_nivruttisangha
--   - SmartBanking_ritemployee
--   - SmartBanking_sanghatesting
-- =========================================================================================

DECLARE @dbName NVARCHAR(128);
DECLARE @sql NVARCHAR(MAX);

DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT name 
FROM sys.databases 
WHERE name LIKE 'SmartBanking_%' 
  AND state_desc = 'ONLINE'
  AND name NOT IN (
      'master', 'tempdb', 'model', 'msdb',
      -- User Excluded Databases:
      'SmartBanking_abc',
      'SmartBanking_FinEx',
      'SmartBanking_JotirlingPdw',
      'SmartBanking_maharshiyadravkar',
      'SmartBanking_nivruttisangha',
      'SmartBanking_ritemployee',
      'SmartBanking_sanghatesting'
  );

OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @dbName;

WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT '------------------------------------------------------------';
    PRINT 'Processing Database: [' + @dbName + ']';

    SET @sql = N'
    USE [' + @dbName + '];

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = ''SupportTickets'')
    BEGIN
        CREATE TABLE [dbo].[SupportTickets] (
            [TicketID] INT IDENTITY(1,1) NOT NULL,
            [TicketNo] NVARCHAR(50) NOT NULL,
            [BranchID] INT NOT NULL DEFAULT (1),
            [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''''),
            [UserID] INT NOT NULL,
            [Username] NVARCHAR(100) NOT NULL DEFAULT (''''),
            [ContactNumber] NVARCHAR(30) NULL,
            [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT (''General''),
            [Priority] NVARCHAR(20) NOT NULL DEFAULT (''MEDIUM''),
            [Subject] NVARCHAR(250) NOT NULL,
            [Description] NVARCHAR(MAX) NOT NULL,
            [SystemInfoJson] NVARCHAR(MAX) NULL,
            [Status] NVARCHAR(30) NOT NULL DEFAULT (''OPEN''),
            [ResolutionRemarks] NVARCHAR(MAX) NULL,
            [ResolvedByUserID] INT NULL,
            [ResolvedAt] DATETIME NULL,
            [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
            [UpdatedOn] DATETIME NULL,
            CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
        );

        CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] 
            ON [dbo].[SupportTickets]([TicketNo] ASC);

        CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] 
            ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);

        CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] 
            ON [dbo].[SupportTickets]([CreatedOn] DESC);

        PRINT ''[CREATED] SupportTickets table created in [' + @dbName + ']'';
    END
    ELSE
    BEGIN
        PRINT ''[EXISTS] SupportTickets already exists in [' + @dbName + ']'';
    END

    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = ''SupportTicketAttachments'')
    BEGIN
        CREATE TABLE [dbo].[SupportTicketAttachments] (
            [AttachmentID] INT IDENTITY(1,1) NOT NULL,
            [TicketID] INT NOT NULL,
            [OriginalFileName] NVARCHAR(255) NOT NULL,
            [FilePath] NVARCHAR(500) NOT NULL,
            [FileType] NVARCHAR(100) NULL,
            [FileSize] BIGINT NULL,
            [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
            CONSTRAINT [PK_SupportTicketAttachments] PRIMARY KEY CLUSTERED ([AttachmentID] ASC),
            CONSTRAINT [FK_SupportTicketAttachments_SupportTickets] FOREIGN KEY ([TicketID]) 
                REFERENCES [dbo].[SupportTickets] ([TicketID]) ON DELETE CASCADE
        );

        CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] 
            ON [dbo].[SupportTicketAttachments]([TicketID] ASC);

        PRINT ''[CREATED] SupportTicketAttachments table created in [' + @dbName + ']'';
    END
    ELSE
    BEGIN
        PRINT ''[EXISTS] SupportTicketAttachments already exists in [' + @dbName + ']'';
    END
    ';

    EXEC sp_executesql @sql;

    FETCH NEXT FROM db_cursor INTO @dbName;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

PRINT '============================================================';
PRINT '  ALL FILTERED DATABASES UPDATED SUCCESSFULLY!';
PRINT '============================================================';

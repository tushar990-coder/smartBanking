-- =========================================================================================
-- SmartBanking ERP - Direct Batch Schema Update for All 17 SmartBanking Databases
-- Feature: SupportTickets and SupportTicketAttachments (Helpdesk & Call Registration)
-- Safe: Uses IF NOT EXISTS - will NOT drop or overwrite any existing data
-- =========================================================================================

-- Macro Template Definition for each database
-- 1. SmartBanking_abc
USE [SmartBanking_abc];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_abc updated.';
GO

-- 2. SmartBanking_bambavadeurban
USE [SmartBanking_bambavadeurban];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_bambavadeurban updated.';
GO

-- 3. SmartBanking_FinEx
USE [SmartBanking_FinEx];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_FinEx updated.';
GO

-- 4. SmartBanking_JotirlingPdw
USE [SmartBanking_JotirlingPdw];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_JotirlingPdw updated.';
GO

-- 5. SmartBanking_maharshiyadrav
USE [SmartBanking_maharshiyadrav];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_maharshiyadrav updated.';
GO

-- 6. SmartBanking_maharshiyadravkar
USE [SmartBanking_maharshiyadravkar];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_maharshiyadravkar updated.';
GO

-- 7. SmartBanking_nivruttisangha
USE [SmartBanking_nivruttisangha];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_nivruttisangha updated.';
GO

-- 8. SmartBanking_padvalwadi
USE [SmartBanking_padvalwadi];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_padvalwadi updated.';
GO

-- 9. SmartBanking_ritemp
USE [SmartBanking_ritemp];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_ritemp updated.';
GO

-- 10. SmartBanking_ritemployee
USE [SmartBanking_ritemployee];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_ritemployee updated.';
GO

-- 11. SmartBanking_sahyadribambavade
USE [SmartBanking_sahyadribambavade];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_sahyadribambavade updated.';
GO

-- 12. SmartBanking_sahyadrikarmachari
USE [SmartBanking_sahyadrikarmachari];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_sahyadrikarmachari updated.';
GO

-- 13. SmartBanking_sanghatesting
USE [SmartBanking_sanghatesting];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_sanghatesting updated.';
GO

-- 14. SmartBanking_Template
USE [SmartBanking_Template];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_Template updated.';
GO

-- 15. SmartBanking_Testing
USE [SmartBanking_Testing];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_Testing updated.';
GO

-- 16. SmartBanking_testing1
USE [SmartBanking_testing1];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_testing1 updated.';
GO

-- 17. SmartBanking_vidyasagarkavathesar
USE [SmartBanking_vidyasagarkavathesar];
GO
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTickets')
BEGIN
    CREATE TABLE [dbo].[SupportTickets] (
        [TicketID] INT IDENTITY(1,1) NOT NULL,
        [TicketNo] NVARCHAR(50) NOT NULL,
        [BranchID] INT NOT NULL DEFAULT (1),
        [BranchName] NVARCHAR(100) NOT NULL DEFAULT (''),
        [UserID] INT NOT NULL,
        [Username] NVARCHAR(100) NOT NULL DEFAULT (''),
        [ContactNumber] NVARCHAR(30) NULL,
        [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT ('General'),
        [Priority] NVARCHAR(20) NOT NULL DEFAULT ('MEDIUM'),
        [Subject] NVARCHAR(250) NOT NULL,
        [Description] NVARCHAR(MAX) NOT NULL,
        [SystemInfoJson] NVARCHAR(MAX) NULL,
        [Status] NVARCHAR(30) NOT NULL DEFAULT ('OPEN'),
        [ResolutionRemarks] NVARCHAR(MAX) NULL,
        [ResolvedByUserID] INT NULL,
        [ResolvedAt] DATETIME NULL,
        [CreatedOn] DATETIME NOT NULL DEFAULT (GETDATE()),
        [UpdatedOn] DATETIME NULL,
        CONSTRAINT [PK_SupportTickets] PRIMARY KEY CLUSTERED ([TicketID] ASC)
    );
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SupportTickets_TicketNo] ON [dbo].[SupportTickets]([TicketNo] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_BranchID_Status] ON [dbo].[SupportTickets]([BranchID] ASC, [Status] ASC);
    CREATE NONCLUSTERED INDEX [IX_SupportTickets_CreatedOn] ON [dbo].[SupportTickets]([CreatedOn] DESC);
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SupportTicketAttachments')
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
    CREATE NONCLUSTERED INDEX [IX_SupportTicketAttachments_TicketID] ON [dbo].[SupportTicketAttachments]([TicketID] ASC);
END
PRINT '[OK] SmartBanking_vidyasagarkavathesar updated.';
GO

PRINT '========================================================================';
PRINT '  SUCCESS: ALL 17 DATABASES UPDATED WITH SUPPORT TICKET SCHEMA!';
PRINT '========================================================================';


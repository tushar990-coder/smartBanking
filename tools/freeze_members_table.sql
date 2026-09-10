-- ============================================================================
-- SCRIPT: freeze_members_table.sql
-- PURPOSE: Enforce Permanent Schema Freeze on [dbo].[Members]
--
-- FROZEN COLUMNS (Strictly 13 Columns Only):
--   1. [MemberID]        INT NOT NULL IDENTITY(1,1) PRIMARY KEY
--   2. [BranchID]        INT NOT NULL
--   3. [MemberCode]      NVARCHAR(20) NULL
--   4. [JoiningDate]     DATETIME2 NOT NULL
--   5. [Status]          NVARCHAR(20) NOT NULL
--   6. [CreatedBy]       INT NOT NULL
--   7. [CreatedOn]       DATETIME2 NOT NULL
--   8. [UpdatedBy]       INT NULL
--   9. [UpdatedOn]       DATETIME2 NULL
--  10. [LegacyMemberNo]  NVARCHAR(50) NULL
--  11. [MembershipType]  NVARCHAR(30) NOT NULL
--  12. [IsDeleted]       BIT NOT NULL
--  13. [CustomerID]      INT NULL
--
-- All demographic, contact, KYC, nominee, and guardian details are stored
-- strictly in [dbo].[Customers] and referenced via [CustomerID].
--
-- This script creates a Database-Level DDL Trigger that permanently blocks
-- any ALTER TABLE, DROP TABLE, or RENAME on [dbo].[Members].
-- ============================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_Freeze_Members_Schema' AND parent_class = 0)
    DROP TRIGGER trg_Freeze_Members_Schema ON DATABASE;
GO

CREATE TRIGGER trg_Freeze_Members_Schema
ON DATABASE
FOR ALTER_TABLE, DROP_TABLE, RENAME
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @EventData XML = EVENTDATA();
    DECLARE @ObjectName NVARCHAR(256) = @EventData.value('(/EVENT_INSTANCE/ObjectName)[1]', 'NVARCHAR(256)');
    DECLARE @TargetObjectName NVARCHAR(256) = @EventData.value('(/EVENT_INSTANCE/TargetObjectName)[1]', 'NVARCHAR(256)');

    IF @ObjectName = 'Members' OR @TargetObjectName = 'Members'
    BEGIN
        RAISERROR('CRITICAL POLICY VIOLATION: The schema for table [dbo].[Members] is PERMANENTLY FROZEN. No ALTER, DROP, or RENAME operations are permitted on this table under any circumstances.', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

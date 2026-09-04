using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncMemberNullableFields : Migration
    {
        /// <inheritdoc />
                protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Incident on 2026-08-02: The index drop and some column adds were manually verified 
            // as already-applied on the dev DB, and the migration history row was manually inserted.
            // This method has been rewritten to use guarded raw SQL for idempotency to prevent 
            // crashes if schema and history drift apart.

            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.indexes 
                    WHERE object_id = OBJECT_ID('Members') 
                    AND name = 'IX_Members_MemberCode'
                )
                BEGIN
                    DROP INDEX IX_Members_MemberCode ON Members;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns 
                    WHERE object_id = OBJECT_ID('SavingTransactions') 
                    AND name = 'TargetSavingAccountID'
                )
                BEGIN
                    ALTER TABLE SavingTransactions ADD TargetSavingAccountID int NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns 
                    WHERE object_id = OBJECT_ID('SansthaDetails') 
                    AND name = 'AutoPostVoucherLimit'
                )
                BEGIN
                    ALTER TABLE SansthaDetails ADD AutoPostVoucherLimit decimal(18,2) NOT NULL DEFAULT 0;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SansthaDetails') AND name = 'District')
                BEGIN
                    ALTER TABLE SansthaDetails ADD District nvarchar(100) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SansthaDetails') AND name = 'PinCode')
                BEGIN
                    ALTER TABLE SansthaDetails ADD PinCode nvarchar(20) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SansthaDetails') AND name = 'RegistrationDate')
                BEGIN
                    ALTER TABLE SansthaDetails ADD RegistrationDate datetime2 NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SansthaDetails') AND name = 'State')
                BEGIN
                    ALTER TABLE SansthaDetails ADD State nvarchar(100) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SansthaDetails') AND name = 'Taluka')
                BEGIN
                    ALTER TABLE SansthaDetails ADD Taluka nvarchar(100) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('SansthaDetails') AND name = 'Village')
                BEGIN
                    ALTER TABLE SansthaDetails ADD Village nvarchar(100) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                -- Altering columns cannot easily be guarded by EXISTS in the same way, but we can just run it.
                -- However, it is safer to just run it as it will just alter the column type.
                ALTER TABLE Roles ALTER COLUMN RoleName nvarchar(100) NOT NULL;
                ALTER TABLE Roles ALTER COLUMN Description nvarchar(250) NULL;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Roles') AND name = 'IsSystemRole')
                BEGIN
                    ALTER TABLE Roles ADD IsSystemRole bit NOT NULL DEFAULT 0;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Roles') AND name = 'RoleCode')
                BEGIN
                    ALTER TABLE Roles ADD RoleCode nvarchar(30) NOT NULL DEFAULT '';
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Roles') AND name = 'Status')
                BEGIN
                    ALTER TABLE Roles ADD Status bit NOT NULL DEFAULT 0;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Members') AND name = 'AddressEng')
                BEGIN
                    ALTER TABLE Members ADD AddressEng nvarchar(500) NULL;
                    ALTER TABLE Members ADD Caste nvarchar(100) NULL;
                    ALTER TABLE Members ADD CasteCategory nvarchar(50) NULL;
                    ALTER TABLE Members ADD Email nvarchar(150) NULL;
                    ALTER TABLE Members ADD FirstNameEng nvarchar(50) NULL;
                    ALTER TABLE Members ADD GuardianAadhaarNo nvarchar(12) NULL;
                    ALTER TABLE Members ADD GuardianAddress nvarchar(500) NULL;
                    ALTER TABLE Members ADD GuardianMobileNo nvarchar(15) NULL;
                    ALTER TABLE Members ADD GuardianName nvarchar(150) NULL;
                    ALTER TABLE Members ADD GuardianNameEng nvarchar(150) NULL;
                    ALTER TABLE Members ADD GuardianRelation nvarchar(50) NULL;
                    ALTER TABLE Members ADD IsMinor bit NOT NULL DEFAULT 0;
                    ALTER TABLE Members ADD LastNameEng nvarchar(50) NULL;
                    ALTER TABLE Members ADD MiddleNameEng nvarchar(50) NULL;
                    ALTER TABLE Members ADD NomineeNameEng nvarchar(150) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('LoanRates') AND name = 'InterestPostingFrequency')
                BEGIN
                    ALTER TABLE LoanRates ADD InterestPostingFrequency nvarchar(100) NOT NULL DEFAULT '';
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('EmployerMasters') AND name = 'Address')
                BEGIN
                    ALTER TABLE EmployerMasters ADD Address nvarchar(500) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('BranchMasters') AND name = 'BranchType')
                BEGIN
                    ALTER TABLE BranchMasters ADD BranchType nvarchar(20) NOT NULL DEFAULT '';
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Branches') AND name = 'BranchType')
                BEGIN
                    ALTER TABLE Branches ADD BranchType nvarchar(20) NULL;
                    ALTER TABLE Branches ADD Email nvarchar(100) NULL;
                    ALTER TABLE Branches ADD MobileNo nvarchar(15) NULL;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditLogs')
                BEGIN
                    CREATE TABLE AuditLogs (
                        AuditLogID bigint IDENTITY(1, 1) NOT NULL PRIMARY KEY,
                        UserID int NULL,
                        Username nvarchar(100) NOT NULL,
                        Action nvarchar(100) NOT NULL,
                        EntityName nvarchar(100) NOT NULL,
                        EntityID nvarchar(50) NULL,
                        Timestamp datetime2 NOT NULL,
                        IPAddress nvarchar(50) NULL,
                        Details nvarchar(max) NULL,
                        Status nvarchar(20) NOT NULL
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EodBatchProcessLogs')
                BEGIN
                    CREATE TABLE EodBatchProcessLogs (
                        LogID bigint IDENTITY(1, 1) NOT NULL PRIMARY KEY,
                        BranchID int NOT NULL,
                        BusinessDate datetime2 NOT NULL,
                        StepNumber int NOT NULL,
                        StepName nvarchar(100) NOT NULL,
                        Status nvarchar(20) NOT NULL,
                        RecordsProcessed int NOT NULL,
                        ErrorMessage nvarchar(max) NULL,
                        StartTime datetime2 NOT NULL,
                        EndTime datetime2 NULL
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RolePermissions')
                BEGIN
                    CREATE TABLE RolePermissions (
                        RolePermissionID int IDENTITY(1, 1) NOT NULL PRIMARY KEY,
                        RoleID int NOT NULL,
                        ModuleCode nvarchar(50) NOT NULL,
                        CanView bit NOT NULL,
                        CanAdd bit NOT NULL,
                        CanEdit bit NOT NULL,
                        CanDelete bit NOT NULL,
                        CanPrint bit NOT NULL,
                        CanApprove bit NOT NULL,
                        ScopeLevel nvarchar(20) NOT NULL
                    );
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('SavingTransactions') AND name = 'IX_SavingTransactions_TargetSavingAccountID')
                BEGIN
                    CREATE INDEX IX_SavingTransactions_TargetSavingAccountID ON SavingTransactions (TargetSavingAccountID);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('Members') AND name = 'IX_Members_MemberCode')
                BEGIN
                    CREATE UNIQUE INDEX IX_Members_MemberCode ON Members (MemberCode) WHERE [MemberCode] IS NOT NULL AND [MemberCode] <> '';
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('EodBatchProcessLogs') AND name = 'IX_EodBatchProcessLogs_BranchID')
                BEGIN
                    CREATE INDEX IX_EodBatchProcessLogs_BranchID ON EodBatchProcessLogs (BranchID);
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.foreign_keys 
                    WHERE object_id = OBJECT_ID('FK_SavingTransactions_SavingAccountMasters_TargetSavingAccountID')
                )
                BEGIN
                    ALTER TABLE SavingTransactions ADD CONSTRAINT FK_SavingTransactions_SavingAccountMasters_TargetSavingAccountID 
                    FOREIGN KEY (TargetSavingAccountID) REFERENCES SavingAccountMasters (SavingAccountID) ON DELETE NO ACTION;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.foreign_keys 
                    WHERE object_id = OBJECT_ID('FK_EodBatchProcessLogs_Branches_BranchID')
                )
                BEGIN
                    ALTER TABLE EodBatchProcessLogs ADD CONSTRAINT FK_EodBatchProcessLogs_Branches_BranchID 
                    FOREIGN KEY (BranchID) REFERENCES Branches (BranchID) ON DELETE NO ACTION;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SavingTransactions_SavingAccountMasters_TargetSavingAccountID",
                table: "SavingTransactions");

            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "EodBatchProcessLogs");

            migrationBuilder.DropTable(
                name: "RolePermissions");

            migrationBuilder.DropIndex(
                name: "IX_SavingTransactions_TargetSavingAccountID",
                table: "SavingTransactions");

            migrationBuilder.DropIndex(
                name: "IX_Members_MemberCode",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "TargetSavingAccountID",
                table: "SavingTransactions");

            migrationBuilder.DropColumn(
                name: "AutoPostVoucherLimit",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "District",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "PinCode",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "RegistrationDate",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "State",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "Taluka",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "Village",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "IsSystemRole",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "RoleCode",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Roles");

            migrationBuilder.DropColumn(
                name: "AddressEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Caste",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "CasteCategory",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "FirstNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "GuardianAadhaarNo",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "GuardianAddress",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "GuardianMobileNo",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "GuardianName",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "GuardianNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "GuardianRelation",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "IsMinor",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "LastNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "MiddleNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "NomineeNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "InterestPostingFrequency",
                table: "LoanRates");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "EmployerMasters");

            migrationBuilder.DropColumn(
                name: "BranchType",
                table: "BranchMasters");

            migrationBuilder.DropColumn(
                name: "BranchType",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "MobileNo",
                table: "Branches");

            migrationBuilder.AlterColumn<string>(
                name: "RoleName",
                table: "Roles",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Roles",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(250)",
                oldMaxLength: 250,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Members_MemberCode",
                table: "Members",
                column: "MemberCode",
                unique: true);
        }
    }
}


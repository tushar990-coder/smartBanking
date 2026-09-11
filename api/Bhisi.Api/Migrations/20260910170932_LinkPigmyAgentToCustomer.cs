using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class LinkPigmyAgentToCustomer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FdAccounts_Members_MemberID",
                table: "FdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_Members_EmployerMasters_EmployerId",
                table: "Members");

            migrationBuilder.DropForeignKey(
                name: "FK_PigmyAccounts_Members_MemberID",
                table: "PigmyAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_RdAccounts_Members_JointMemberID",
                table: "RdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_RdAccounts_Members_MemberID",
                table: "RdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_SavingAccountJointHolders_Members_MemberID",
                table: "SavingAccountJointHolders");

            migrationBuilder.DropForeignKey(
                name: "FK_SavingAccountMasters_Members_MemberID",
                table: "SavingAccountMasters");

            migrationBuilder.DropIndex(
                name: "IX_SavingAccountJointHolders_MemberID",
                table: "SavingAccountJointHolders");

            migrationBuilder.DropIndex(
                name: "IX_PigmyCollections_AgentId",
                table: "PigmyCollections");

            migrationBuilder.DropIndex(
                name: "IX_Members_AadhaarNo",
                table: "Members");

            migrationBuilder.DropIndex(
                name: "IX_Members_EmployerId",
                table: "Members");

            migrationBuilder.DropIndex(
                name: "IX_Members_MobileNo",
                table: "Members");

            migrationBuilder.DropIndex(
                name: "IX_Members_Village",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "MemberID",
                table: "SavingAccountJointHolders");

            migrationBuilder.DropColumn(
                name: "AadhaarDocPath",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "AadhaarNo",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "AddressEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "BirthDate",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "CIFNo",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Caste",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "CasteCategory",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "District",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "EmployerId",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "FirstNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Gender",
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
                name: "LastName",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "LastNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "MiddleName",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "MiddleNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "MobileNo",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "NickName",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "NomineeName",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "NomineeNameEng",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "NomineeRelation",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Occupation",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "OldMemberCode",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "PANNo",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "PanDocPath",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "PhotoPath",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "SignaturePath",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Taluka",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "Village",
                table: "Members");

            migrationBuilder.RenameColumn(
                name: "MemberID",
                table: "SavingAccountMasters",
                newName: "CustomerID");

            migrationBuilder.RenameIndex(
                name: "IX_SavingAccountMasters_MemberID",
                table: "SavingAccountMasters",
                newName: "IX_SavingAccountMasters_CustomerID");

            migrationBuilder.RenameColumn(
                name: "MemberID",
                table: "RdAccounts",
                newName: "CustomerID");

            migrationBuilder.RenameColumn(
                name: "JointMemberID",
                table: "RdAccounts",
                newName: "JointCustomerID");

            migrationBuilder.RenameIndex(
                name: "IX_RdAccounts_MemberID",
                table: "RdAccounts",
                newName: "IX_RdAccounts_CustomerID");

            migrationBuilder.RenameIndex(
                name: "IX_RdAccounts_JointMemberID",
                table: "RdAccounts",
                newName: "IX_RdAccounts_JointCustomerID");

            migrationBuilder.RenameColumn(
                name: "MemberID",
                table: "PigmyAccounts",
                newName: "CustomerID");

            migrationBuilder.RenameIndex(
                name: "IX_PigmyAccounts_MemberID",
                table: "PigmyAccounts",
                newName: "IX_PigmyAccounts_CustomerID");

            migrationBuilder.RenameColumn(
                name: "LegacyMemberId",
                table: "Members",
                newName: "CustomerID");

            migrationBuilder.RenameColumn(
                name: "IsMinor",
                table: "Members",
                newName: "IsDeleted");

            migrationBuilder.RenameColumn(
                name: "MemberID",
                table: "FdAccounts",
                newName: "CustomerID");

            migrationBuilder.RenameIndex(
                name: "IX_FdAccounts_MemberID",
                table: "FdAccounts",
                newName: "IX_FdAccounts_CustomerID");

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "VoucherDetails",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "ShareTransactions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsMobileCompulsory",
                table: "ShareSchemes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "ShareCertificates",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "ShareAccounts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "SavingTransactions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "SavingPassbooks",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SchemeCode",
                table: "SavingInterestSettings",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LastInterestAmount",
                table: "SavingAccountMasters",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastInterestPostingDate",
                table: "SavingAccountMasters",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OldAccountNo",
                table: "SavingAccountMasters",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "SavingAccountJointHolders",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "SavingAccountClosings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsAadhaarCompulsory",
                table: "SansthaDetails",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsMobileCompulsory",
                table: "SansthaDetails",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPanCompulsory",
                table: "SansthaDetails",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SchemeCode",
                table: "PigmySchemes",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "PigmyCollections",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMode",
                table: "PigmyCollections",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TransactionId",
                table: "PigmyCollections",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "PigmyAgents",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MaxCashLimit",
                table: "PigmyAgents",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "PigmyAgents",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Pin",
                table: "PigmyAgents",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MembershipType",
                table: "Members",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "MemberOpeningBalances",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "MemberID",
                table: "LockerAllotments",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "LockerAllotments",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "ShortName",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "SecurityType",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "LoanInstallmentType",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "InterestPostingType",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "InterestPostingFrequency",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "InterestCalculationMethod",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "InstallmentType",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<int>(
                name: "InstallmentCount",
                table: "LoanRates",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "DurationMonths",
                table: "LoanRates",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "ReceiptNo",
                table: "LoanCollections",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<int>(
                name: "MemberID",
                table: "LoanApplications",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "ApplicationNo",
                table: "LoanApplications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AddColumn<int>(
                name: "CoCustomer2ID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CoCustomerID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Guarantor1CustomerID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Guarantor2CustomerID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "MemberID",
                table: "LoanAccounts",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<string>(
                name: "LoanAccountNo",
                table: "LoanAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50);

            migrationBuilder.AddColumn<int>(
                name: "CoCustomer2ID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CoCustomerID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CustomerID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Guarantor1CustomerID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Guarantor2CustomerID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "FdSchemes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastInterestPostingDate",
                table: "FdAccounts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "__SystemVersionHistory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VersionNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AppliedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PatchName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AppliedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK___SystemVersionHistory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Cashiers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: true),
                    CashierName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CounterNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CashLedgerId = table.Column<int>(type: "int", nullable: true),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsHeadCashier = table.Column<bool>(type: "bit", nullable: false),
                    MaxCashLimit = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cashiers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Cashiers_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cashiers_Ledgers_CashLedgerId",
                        column: x => x.CashLedgerId,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Cashiers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CashManagementSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: true),
                    MainVaultLedgerId = table.Column<int>(type: "int", nullable: true),
                    CashShortageLedgerId = table.Column<int>(type: "int", nullable: true),
                    CashExcessLedgerId = table.Column<int>(type: "int", nullable: true),
                    AutoGenerateVouchers = table.Column<bool>(type: "bit", nullable: false),
                    EnableDenominationMandatory = table.Column<bool>(type: "bit", nullable: false),
                    MaxBranchVaultLimit = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DefaultCounterLimit = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    LastUpdated = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashManagementSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashManagementSettings_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashManagementSettings_Ledgers_CashExcessLedgerId",
                        column: x => x.CashExcessLedgerId,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashManagementSettings_Ledgers_CashShortageLedgerId",
                        column: x => x.CashShortageLedgerId,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashManagementSettings_Ledgers_MainVaultLedgerId",
                        column: x => x.MainVaultLedgerId,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CifSequences",
                columns: table => new
                {
                    SequenceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SequenceCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Prefix = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CurrentValue = table.Column<long>(type: "bigint", nullable: false),
                    PaddingLength = table.Column<int>(type: "int", nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CifSequences", x => x.SequenceID);
                });

            migrationBuilder.CreateTable(
                name: "CustomerImportBatches",
                columns: table => new
                {
                    BatchID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    InputMode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    HomeBranchID = table.Column<int>(type: "int", nullable: false),
                    TotalRecords = table.Column<int>(type: "int", nullable: false),
                    ValidRecords = table.Column<int>(type: "int", nullable: false),
                    InvalidRecords = table.Column<int>(type: "int", nullable: false),
                    ImportedRecords = table.Column<int>(type: "int", nullable: false),
                    MergedRecords = table.Column<int>(type: "int", nullable: false),
                    SkippedRecords = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    MakerUserID = table.Column<int>(type: "int", nullable: false),
                    MakerUsername = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SubmittedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CheckerUserID = table.Column<int>(type: "int", nullable: true),
                    CheckerUsername = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ApprovedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StartCif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    EndCif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ExecutionTimeMs = table.Column<long>(type: "bigint", nullable: false),
                    RolledBackBy = table.Column<int>(type: "int", nullable: true),
                    RolledBackUsername = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RolledBackOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RollbackReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SummaryJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ErrorLogJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerImportBatches", x => x.BatchID);
                });

            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    CustomerID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    CIFNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    LegacyCustomerNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    FirstName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MiddleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LastName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NickName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FirstNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    MiddleNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LastNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AddressEng = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Village = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Taluka = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    District = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MobileNo = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    AadhaarNo = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    PANNo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    RegistrationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NomineeName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NomineeNameEng = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NomineeAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    NomineeBirthDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NomineeIsMinor = table.Column<bool>(type: "bit", nullable: false),
                    NomineeGuardianName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    PhotoPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SignaturePath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AadhaarDocPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PanDocPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    BirthDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Occupation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CasteCategory = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Caste = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    IsMinor = table.Column<bool>(type: "bit", nullable: false),
                    GuardianName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    GuardianNameEng = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    GuardianRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    GuardianAadhaarNo = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    GuardianMobileNo = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    GuardianAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CustomerType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    KYCStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CKYCNo = table.Column<string>(type: "nvarchar(14)", maxLength: 14, nullable: true),
                    RiskCategory = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    HomeBranchID = table.Column<int>(type: "int", nullable: true),
                    ImportBatchID = table.Column<long>(type: "bigint", nullable: true),
                    EmployerId = table.Column<int>(type: "int", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.CustomerID);
                    table.ForeignKey(
                        name: "FK_Customers_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Customers_EmployerMasters_EmployerId",
                        column: x => x.EmployerId,
                        principalTable: "EmployerMasters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DeceasedClaimSettlements",
                columns: table => new
                {
                    ClaimID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    DeathDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DeathCertificateNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    NomineeName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NomineeAadhaarNo = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    NomineeMobileNo = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    NomineeBankAccount = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TotalSavingsBalance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalFdBalance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalRdBalance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalPigmyBalance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalShareAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalLoanLiability = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    NetPayableAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ResolutionNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ResolutionDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SettlementDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeceasedClaimSettlements", x => x.ClaimID);
                    table.ForeignKey(
                        name: "FK_DeceasedClaimSettlements_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DeceasedClaimSettlements_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DeceasedClaimSettlements_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "JointMembers",
                columns: table => new
                {
                    JointMemberID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PrimaryMemberID = table.Column<int>(type: "int", nullable: false),
                    JointMemberCode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    FirstName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MiddleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LastName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FirstNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    MiddleNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LastNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    RelationWithPrimary = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AadhaarNo = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    PANNo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    MobileNo = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PhotoPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SignaturePath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_JointMembers", x => x.JointMemberID);
                    table.ForeignKey(
                        name: "FK_JointMembers_Members_PrimaryMemberID",
                        column: x => x.PrimaryMemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CashAllocations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: true),
                    FromCashierId = table.Column<int>(type: "int", nullable: true),
                    ToCashierId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AllocationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AllocationType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    IsReturn = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashAllocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashAllocations_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashAllocations_Cashiers_FromCashierId",
                        column: x => x.FromCashierId,
                        principalTable: "Cashiers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashAllocations_Cashiers_ToCashierId",
                        column: x => x.ToCashierId,
                        principalTable: "Cashiers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CashDenominations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: true),
                    CashierId = table.Column<int>(type: "int", nullable: false),
                    DenominationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EntryType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Count2000 = table.Column<int>(type: "int", nullable: false),
                    Count500 = table.Column<int>(type: "int", nullable: false),
                    Count200 = table.Column<int>(type: "int", nullable: false),
                    Count100 = table.Column<int>(type: "int", nullable: false),
                    Count50 = table.Column<int>(type: "int", nullable: false),
                    Count20 = table.Column<int>(type: "int", nullable: false),
                    Count10 = table.Column<int>(type: "int", nullable: false),
                    Count5 = table.Column<int>(type: "int", nullable: false),
                    CountCoins = table.Column<int>(type: "int", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ExpectedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DifferenceAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    DifferenceType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    VerifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashDenominations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashDenominations_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashDenominations_Cashiers_CashierId",
                        column: x => x.CashierId,
                        principalTable: "Cashiers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CashierBalances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: true),
                    CashierId = table.Column<int>(type: "int", nullable: false),
                    BalanceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OpeningBalance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ReceivedFromHead = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalReceipts = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TotalPayments = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ReturnedToHead = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    ClosingBalance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PhysicalCashTally = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CashDifference = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    LastUpdated = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashierBalances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CashierBalances_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CashierBalances_Cashiers_CashierId",
                        column: x => x.CashierId,
                        principalTable: "Cashiers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AgentCustomerRequests",
                columns: table => new
                {
                    RequestID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    PigmyAgentID = table.Column<int>(type: "int", nullable: true),
                    AgentName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RequestDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ApprovalDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovedByUserID = table.Column<int>(type: "int", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedMemberID = table.Column<int>(type: "int", nullable: true),
                    CreatedCustomerID = table.Column<int>(type: "int", nullable: true),
                    CreatedPigmyAccountID = table.Column<int>(type: "int", nullable: true),
                    FirstName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MiddleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LastName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FirstNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    MiddleNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LastNameEng = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    BirthDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Occupation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CasteCategory = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    MobileNo = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AadhaarNo = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    PANNo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AddressEng = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Village = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Taluka = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    District = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Pincode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    NomineeName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NomineeNameEng = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NomineeAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    NomineeBirthDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NomineeAge = table.Column<int>(type: "int", nullable: true),
                    PhotoPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SignaturePath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AadhaarDocPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PanDocPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    OpenPigmyAccount = table.Column<bool>(type: "bit", nullable: false),
                    PigmySchemeID = table.Column<int>(type: "int", nullable: true),
                    DailyDepositAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    InitialDepositAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgentCustomerRequests", x => x.RequestID);
                    table.ForeignKey(
                        name: "FK_AgentCustomerRequests_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AgentCustomerRequests_Customers_CreatedCustomerID",
                        column: x => x.CreatedCustomerID,
                        principalTable: "Customers",
                        principalColumn: "CustomerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AgentCustomerRequests_PigmyAgents_PigmyAgentID",
                        column: x => x.PigmyAgentID,
                        principalTable: "PigmyAgents",
                        principalColumn: "PigmyAgentID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CustomerOpeningBalances",
                columns: table => new
                {
                    CustomerOpeningBalanceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerID = table.Column<int>(type: "int", nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    BalanceType = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomerOpeningBalances", x => x.CustomerOpeningBalanceID);
                    table.ForeignKey(
                        name: "FK_CustomerOpeningBalances_Customers_CustomerID",
                        column: x => x.CustomerID,
                        principalTable: "Customers",
                        principalColumn: "CustomerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CustomerOpeningBalances_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VoucherDetails_CustomerID",
                table: "VoucherDetails",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_ShareTransactions_CustomerID",
                table: "ShareTransactions",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_ShareCertificates_CustomerID",
                table: "ShareCertificates",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_ShareAccounts_CustomerID",
                table: "ShareAccounts",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingTransactions_CustomerID",
                table: "SavingTransactions",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingPassbooks_CustomerID",
                table: "SavingPassbooks",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountJointHolders_CustomerID",
                table: "SavingAccountJointHolders",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountClosings_CustomerID",
                table: "SavingAccountClosings",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyCollections_AgentId_CollectionDate",
                table: "PigmyCollections",
                columns: new[] { "AgentId", "CollectionDate" });

            migrationBuilder.CreateIndex(
                name: "IX_PigmyCollections_TransactionId",
                table: "PigmyCollections",
                column: "TransactionId",
                unique: true,
                filter: "[TransactionId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgents_CustomerID",
                table: "PigmyAgents",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_Members_CustomerID",
                table: "Members",
                column: "CustomerID",
                unique: true,
                filter: "[CustomerID] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_MemberOpeningBalances_CustomerID",
                table: "MemberOpeningBalances",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAllotments_CustomerID",
                table: "LockerAllotments",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_CoCustomer2ID",
                table: "LoanApplications",
                column: "CoCustomer2ID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_CoCustomerID",
                table: "LoanApplications",
                column: "CoCustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_CustomerID",
                table: "LoanApplications",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_Guarantor1CustomerID",
                table: "LoanApplications",
                column: "Guarantor1CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_Guarantor2CustomerID",
                table: "LoanApplications",
                column: "Guarantor2CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_CoCustomer2ID",
                table: "LoanAccounts",
                column: "CoCustomer2ID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_CoCustomerID",
                table: "LoanAccounts",
                column: "CoCustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_CustomerID",
                table: "LoanAccounts",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_Guarantor1CustomerID",
                table: "LoanAccounts",
                column: "Guarantor1CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_Guarantor2CustomerID",
                table: "LoanAccounts",
                column: "Guarantor2CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCustomerRequests_BranchID",
                table: "AgentCustomerRequests",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCustomerRequests_CreatedCustomerID",
                table: "AgentCustomerRequests",
                column: "CreatedCustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_AgentCustomerRequests_PigmyAgentID",
                table: "AgentCustomerRequests",
                column: "PigmyAgentID");

            migrationBuilder.CreateIndex(
                name: "IX_CashAllocations_BranchId",
                table: "CashAllocations",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_CashAllocations_FromCashierId",
                table: "CashAllocations",
                column: "FromCashierId");

            migrationBuilder.CreateIndex(
                name: "IX_CashAllocations_ToCashierId",
                table: "CashAllocations",
                column: "ToCashierId");

            migrationBuilder.CreateIndex(
                name: "IX_CashDenominations_BranchId",
                table: "CashDenominations",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_CashDenominations_CashierId",
                table: "CashDenominations",
                column: "CashierId");

            migrationBuilder.CreateIndex(
                name: "IX_CashierBalances_BranchId",
                table: "CashierBalances",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_CashierBalances_CashierId",
                table: "CashierBalances",
                column: "CashierId");

            migrationBuilder.CreateIndex(
                name: "IX_Cashiers_BranchId",
                table: "Cashiers",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Cashiers_CashLedgerId",
                table: "Cashiers",
                column: "CashLedgerId");

            migrationBuilder.CreateIndex(
                name: "IX_Cashiers_UserId",
                table: "Cashiers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_CashManagementSettings_BranchId",
                table: "CashManagementSettings",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_CashManagementSettings_CashExcessLedgerId",
                table: "CashManagementSettings",
                column: "CashExcessLedgerId");

            migrationBuilder.CreateIndex(
                name: "IX_CashManagementSettings_CashShortageLedgerId",
                table: "CashManagementSettings",
                column: "CashShortageLedgerId");

            migrationBuilder.CreateIndex(
                name: "IX_CashManagementSettings_MainVaultLedgerId",
                table: "CashManagementSettings",
                column: "MainVaultLedgerId");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerOpeningBalances_CustomerID",
                table: "CustomerOpeningBalances",
                column: "CustomerID");

            migrationBuilder.CreateIndex(
                name: "IX_CustomerOpeningBalances_LedgerID",
                table: "CustomerOpeningBalances",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_AadhaarNo",
                table: "Customers",
                column: "AadhaarNo",
                unique: true,
                filter: "[AadhaarNo] IS NOT NULL AND [AadhaarNo] <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_BranchID",
                table: "Customers",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_CIFNo",
                table: "Customers",
                column: "CIFNo",
                unique: true,
                filter: "[CIFNo] IS NOT NULL AND [CIFNo] <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_CKYCNo",
                table: "Customers",
                column: "CKYCNo",
                unique: true,
                filter: "[CKYCNo] IS NOT NULL AND [CKYCNo] <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_EmployerId",
                table: "Customers",
                column: "EmployerId");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_MobileNo",
                table: "Customers",
                column: "MobileNo");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_PANNo",
                table: "Customers",
                column: "PANNo",
                unique: true,
                filter: "[PANNo] IS NOT NULL AND [PANNo] <> ''");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_Village",
                table: "Customers",
                column: "Village");

            migrationBuilder.CreateIndex(
                name: "IX_DeceasedClaimSettlements_BranchID",
                table: "DeceasedClaimSettlements",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_DeceasedClaimSettlements_MemberID",
                table: "DeceasedClaimSettlements",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_DeceasedClaimSettlements_VoucherID",
                table: "DeceasedClaimSettlements",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_JointMembers_PrimaryMemberID",
                table: "JointMembers",
                column: "PrimaryMemberID");

            migrationBuilder.AddForeignKey(
                name: "FK_FdAccounts_Customers_CustomerID",
                table: "FdAccounts",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Customers_CoCustomer2ID",
                table: "LoanAccounts",
                column: "CoCustomer2ID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Customers_CoCustomerID",
                table: "LoanAccounts",
                column: "CoCustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Customers_CustomerID",
                table: "LoanAccounts",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Customers_Guarantor1CustomerID",
                table: "LoanAccounts",
                column: "Guarantor1CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Customers_Guarantor2CustomerID",
                table: "LoanAccounts",
                column: "Guarantor2CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Customers_CoCustomer2ID",
                table: "LoanApplications",
                column: "CoCustomer2ID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Customers_CoCustomerID",
                table: "LoanApplications",
                column: "CoCustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Customers_CustomerID",
                table: "LoanApplications",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Customers_Guarantor1CustomerID",
                table: "LoanApplications",
                column: "Guarantor1CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Customers_Guarantor2CustomerID",
                table: "LoanApplications",
                column: "Guarantor2CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LockerAllotments_Customers_CustomerID",
                table: "LockerAllotments",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_MemberOpeningBalances_Customers_CustomerID",
                table: "MemberOpeningBalances",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Members_Customers_CustomerID",
                table: "Members",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PigmyAccounts_Customers_CustomerID",
                table: "PigmyAccounts",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PigmyAgents_Customers_CustomerID",
                table: "PigmyAgents",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RdAccounts_Customers_CustomerID",
                table: "RdAccounts",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RdAccounts_Customers_JointCustomerID",
                table: "RdAccounts",
                column: "JointCustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingAccountClosings_Customers_CustomerID",
                table: "SavingAccountClosings",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingAccountJointHolders_Customers_CustomerID",
                table: "SavingAccountJointHolders",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingAccountMasters_Customers_CustomerID",
                table: "SavingAccountMasters",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingPassbooks_Customers_CustomerID",
                table: "SavingPassbooks",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingTransactions_Customers_CustomerID",
                table: "SavingTransactions",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShareAccounts_Customers_CustomerID",
                table: "ShareAccounts",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShareCertificates_Customers_CustomerID",
                table: "ShareCertificates",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ShareTransactions_Customers_CustomerID",
                table: "ShareTransactions",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_VoucherDetails_Customers_CustomerID",
                table: "VoucherDetails",
                column: "CustomerID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FdAccounts_Customers_CustomerID",
                table: "FdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Customers_CoCustomer2ID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Customers_CoCustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Customers_CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Customers_Guarantor1CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Customers_Guarantor2CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Customers_CoCustomer2ID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Customers_CoCustomerID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Customers_CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Customers_Guarantor1CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Customers_Guarantor2CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LockerAllotments_Customers_CustomerID",
                table: "LockerAllotments");

            migrationBuilder.DropForeignKey(
                name: "FK_MemberOpeningBalances_Customers_CustomerID",
                table: "MemberOpeningBalances");

            migrationBuilder.DropForeignKey(
                name: "FK_Members_Customers_CustomerID",
                table: "Members");

            migrationBuilder.DropForeignKey(
                name: "FK_PigmyAccounts_Customers_CustomerID",
                table: "PigmyAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_PigmyAgents_Customers_CustomerID",
                table: "PigmyAgents");

            migrationBuilder.DropForeignKey(
                name: "FK_RdAccounts_Customers_CustomerID",
                table: "RdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_RdAccounts_Customers_JointCustomerID",
                table: "RdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_SavingAccountClosings_Customers_CustomerID",
                table: "SavingAccountClosings");

            migrationBuilder.DropForeignKey(
                name: "FK_SavingAccountJointHolders_Customers_CustomerID",
                table: "SavingAccountJointHolders");

            migrationBuilder.DropForeignKey(
                name: "FK_SavingAccountMasters_Customers_CustomerID",
                table: "SavingAccountMasters");

            migrationBuilder.DropForeignKey(
                name: "FK_SavingPassbooks_Customers_CustomerID",
                table: "SavingPassbooks");

            migrationBuilder.DropForeignKey(
                name: "FK_SavingTransactions_Customers_CustomerID",
                table: "SavingTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_ShareAccounts_Customers_CustomerID",
                table: "ShareAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_ShareCertificates_Customers_CustomerID",
                table: "ShareCertificates");

            migrationBuilder.DropForeignKey(
                name: "FK_ShareTransactions_Customers_CustomerID",
                table: "ShareTransactions");

            migrationBuilder.DropForeignKey(
                name: "FK_VoucherDetails_Customers_CustomerID",
                table: "VoucherDetails");

            migrationBuilder.DropTable(
                name: "__SystemVersionHistory");

            migrationBuilder.DropTable(
                name: "AgentCustomerRequests");

            migrationBuilder.DropTable(
                name: "CashAllocations");

            migrationBuilder.DropTable(
                name: "CashDenominations");

            migrationBuilder.DropTable(
                name: "CashierBalances");

            migrationBuilder.DropTable(
                name: "CashManagementSettings");

            migrationBuilder.DropTable(
                name: "CifSequences");

            migrationBuilder.DropTable(
                name: "CustomerImportBatches");

            migrationBuilder.DropTable(
                name: "CustomerOpeningBalances");

            migrationBuilder.DropTable(
                name: "DeceasedClaimSettlements");

            migrationBuilder.DropTable(
                name: "JointMembers");

            migrationBuilder.DropTable(
                name: "Cashiers");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropIndex(
                name: "IX_VoucherDetails_CustomerID",
                table: "VoucherDetails");

            migrationBuilder.DropIndex(
                name: "IX_ShareTransactions_CustomerID",
                table: "ShareTransactions");

            migrationBuilder.DropIndex(
                name: "IX_ShareCertificates_CustomerID",
                table: "ShareCertificates");

            migrationBuilder.DropIndex(
                name: "IX_ShareAccounts_CustomerID",
                table: "ShareAccounts");

            migrationBuilder.DropIndex(
                name: "IX_SavingTransactions_CustomerID",
                table: "SavingTransactions");

            migrationBuilder.DropIndex(
                name: "IX_SavingPassbooks_CustomerID",
                table: "SavingPassbooks");

            migrationBuilder.DropIndex(
                name: "IX_SavingAccountJointHolders_CustomerID",
                table: "SavingAccountJointHolders");

            migrationBuilder.DropIndex(
                name: "IX_SavingAccountClosings_CustomerID",
                table: "SavingAccountClosings");

            migrationBuilder.DropIndex(
                name: "IX_PigmyCollections_AgentId_CollectionDate",
                table: "PigmyCollections");

            migrationBuilder.DropIndex(
                name: "IX_PigmyCollections_TransactionId",
                table: "PigmyCollections");

            migrationBuilder.DropIndex(
                name: "IX_PigmyAgents_CustomerID",
                table: "PigmyAgents");

            migrationBuilder.DropIndex(
                name: "IX_Members_CustomerID",
                table: "Members");

            migrationBuilder.DropIndex(
                name: "IX_MemberOpeningBalances_CustomerID",
                table: "MemberOpeningBalances");

            migrationBuilder.DropIndex(
                name: "IX_LockerAllotments_CustomerID",
                table: "LockerAllotments");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_CoCustomer2ID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_CoCustomerID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_Guarantor1CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_Guarantor2CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_CoCustomer2ID",
                table: "LoanAccounts");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_CoCustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_Guarantor1CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_Guarantor2CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "VoucherDetails");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "ShareTransactions");

            migrationBuilder.DropColumn(
                name: "IsMobileCompulsory",
                table: "ShareSchemes");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "ShareCertificates");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "ShareAccounts");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "SavingTransactions");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "SavingPassbooks");

            migrationBuilder.DropColumn(
                name: "SchemeCode",
                table: "SavingInterestSettings");

            migrationBuilder.DropColumn(
                name: "LastInterestAmount",
                table: "SavingAccountMasters");

            migrationBuilder.DropColumn(
                name: "LastInterestPostingDate",
                table: "SavingAccountMasters");

            migrationBuilder.DropColumn(
                name: "OldAccountNo",
                table: "SavingAccountMasters");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "SavingAccountJointHolders");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "SavingAccountClosings");

            migrationBuilder.DropColumn(
                name: "IsAadhaarCompulsory",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "IsMobileCompulsory",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "IsPanCompulsory",
                table: "SansthaDetails");

            migrationBuilder.DropColumn(
                name: "SchemeCode",
                table: "PigmySchemes");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "PigmyCollections");

            migrationBuilder.DropColumn(
                name: "PaymentMode",
                table: "PigmyCollections");

            migrationBuilder.DropColumn(
                name: "TransactionId",
                table: "PigmyCollections");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "PigmyAgents");

            migrationBuilder.DropColumn(
                name: "MaxCashLimit",
                table: "PigmyAgents");

            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "PigmyAgents");

            migrationBuilder.DropColumn(
                name: "Pin",
                table: "PigmyAgents");

            migrationBuilder.DropColumn(
                name: "MembershipType",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "MemberOpeningBalances");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "LockerAllotments");

            migrationBuilder.DropColumn(
                name: "CoCustomer2ID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CoCustomerID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "Guarantor1CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "Guarantor2CustomerID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CoCustomer2ID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "CoCustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "Guarantor1CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "Guarantor2CustomerID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "LastInterestPostingDate",
                table: "FdAccounts");

            migrationBuilder.RenameColumn(
                name: "CustomerID",
                table: "SavingAccountMasters",
                newName: "MemberID");

            migrationBuilder.RenameIndex(
                name: "IX_SavingAccountMasters_CustomerID",
                table: "SavingAccountMasters",
                newName: "IX_SavingAccountMasters_MemberID");

            migrationBuilder.RenameColumn(
                name: "JointCustomerID",
                table: "RdAccounts",
                newName: "JointMemberID");

            migrationBuilder.RenameColumn(
                name: "CustomerID",
                table: "RdAccounts",
                newName: "MemberID");

            migrationBuilder.RenameIndex(
                name: "IX_RdAccounts_JointCustomerID",
                table: "RdAccounts",
                newName: "IX_RdAccounts_JointMemberID");

            migrationBuilder.RenameIndex(
                name: "IX_RdAccounts_CustomerID",
                table: "RdAccounts",
                newName: "IX_RdAccounts_MemberID");

            migrationBuilder.RenameColumn(
                name: "CustomerID",
                table: "PigmyAccounts",
                newName: "MemberID");

            migrationBuilder.RenameIndex(
                name: "IX_PigmyAccounts_CustomerID",
                table: "PigmyAccounts",
                newName: "IX_PigmyAccounts_MemberID");

            migrationBuilder.RenameColumn(
                name: "IsDeleted",
                table: "Members",
                newName: "IsMinor");

            migrationBuilder.RenameColumn(
                name: "CustomerID",
                table: "Members",
                newName: "LegacyMemberId");

            migrationBuilder.RenameColumn(
                name: "CustomerID",
                table: "FdAccounts",
                newName: "MemberID");

            migrationBuilder.RenameIndex(
                name: "IX_FdAccounts_CustomerID",
                table: "FdAccounts",
                newName: "IX_FdAccounts_MemberID");

            migrationBuilder.AddColumn<int>(
                name: "MemberID",
                table: "SavingAccountJointHolders",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "AadhaarDocPath",
                table: "Members",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AadhaarNo",
                table: "Members",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "Members",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AddressEng",
                table: "Members",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BirthDate",
                table: "Members",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CIFNo",
                table: "Members",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Caste",
                table: "Members",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CasteCategory",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "District",
                table: "Members",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Members",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmployerId",
                table: "Members",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "FirstNameEng",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "Members",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuardianAadhaarNo",
                table: "Members",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuardianAddress",
                table: "Members",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuardianMobileNo",
                table: "Members",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuardianName",
                table: "Members",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuardianNameEng",
                table: "Members",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuardianRelation",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LastNameEng",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MiddleName",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MiddleNameEng",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MobileNo",
                table: "Members",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NickName",
                table: "Members",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomineeName",
                table: "Members",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomineeNameEng",
                table: "Members",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomineeRelation",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Occupation",
                table: "Members",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OldMemberCode",
                table: "Members",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PANNo",
                table: "Members",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PanDocPath",
                table: "Members",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhotoPath",
                table: "Members",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignaturePath",
                table: "Members",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Taluka",
                table: "Members",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Village",
                table: "Members",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "MemberID",
                table: "LockerAllotments",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "ShortName",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "SecurityType",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "LoanInstallmentType",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "InterestPostingType",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "InterestPostingFrequency",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "InterestCalculationMethod",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "InstallmentType",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "InstallmentCount",
                table: "LoanRates",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "DurationMonths",
                table: "LoanRates",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "ReceiptNo",
                table: "LoanCollections",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "MemberID",
                table: "LoanApplications",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "ApplicationNo",
                table: "LoanApplications",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "MemberID",
                table: "LoanAccounts",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "LoanAccountNo",
                table: "LoanAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountJointHolders_MemberID",
                table: "SavingAccountJointHolders",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyCollections_AgentId",
                table: "PigmyCollections",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_Members_AadhaarNo",
                table: "Members",
                column: "AadhaarNo",
                unique: true,
                filter: "[AadhaarNo] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Members_EmployerId",
                table: "Members",
                column: "EmployerId");

            migrationBuilder.CreateIndex(
                name: "IX_Members_MobileNo",
                table: "Members",
                column: "MobileNo");

            migrationBuilder.CreateIndex(
                name: "IX_Members_Village",
                table: "Members",
                column: "Village");

            migrationBuilder.AddForeignKey(
                name: "FK_FdAccounts_Members_MemberID",
                table: "FdAccounts",
                column: "MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Members_EmployerMasters_EmployerId",
                table: "Members",
                column: "EmployerId",
                principalTable: "EmployerMasters",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PigmyAccounts_Members_MemberID",
                table: "PigmyAccounts",
                column: "MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RdAccounts_Members_JointMemberID",
                table: "RdAccounts",
                column: "JointMemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RdAccounts_Members_MemberID",
                table: "RdAccounts",
                column: "MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingAccountJointHolders_Members_MemberID",
                table: "SavingAccountJointHolders",
                column: "MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingAccountMasters_Members_MemberID",
                table: "SavingAccountMasters",
                column: "MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);
        }
    }
}

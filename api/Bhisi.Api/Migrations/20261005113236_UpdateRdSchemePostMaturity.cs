using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateRdSchemePostMaturity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Members_CoMember2ID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Members_CoMemberID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Members_Guarantor1MemberID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanAccounts_Members_Guarantor2MemberID",
                table: "LoanAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Members_CoMember2ID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Members_CoMemberID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Members_Guarantor1MemberID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Members_Guarantor2MemberID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Members_MemberID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Members_RecommendedByDirectorID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_CoMember2ID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_CoMemberID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_Guarantor1MemberID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_Guarantor2MemberID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_MemberID",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_CoMember2ID",
                table: "LoanAccounts");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_CoMemberID",
                table: "LoanAccounts");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_Guarantor1MemberID",
                table: "LoanAccounts");

            migrationBuilder.DropIndex(
                name: "IX_LoanAccounts_Guarantor2MemberID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "InstallmentAmount",
                table: "RdSchemes");

            migrationBuilder.DropColumn(
                name: "MobileNo",
                table: "PigmyAgents");

            migrationBuilder.DropColumn(
                name: "CoMember2ID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CoMemberID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "Guarantor1MemberID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "Guarantor2MemberID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "MemberID",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CoMember2ID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "CoMemberID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "Guarantor1MemberID",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "Guarantor2MemberID",
                table: "LoanAccounts");

            migrationBuilder.RenameColumn(
                name: "ID",
                table: "PigmyAccountSequences",
                newName: "SequenceID");

            migrationBuilder.AddColumn<int>(
                name: "SavingSchemeID",
                table: "SavingAccountMasters",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BalanceAfterTxn",
                table: "RdTransactions",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Narration",
                table: "RdTransactions",
                type: "nvarchar(250)",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowOverdueInterest",
                table: "RdSchemes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CompoundingFrequency",
                table: "RdSchemes",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "GracePeriodDays",
                table: "RdSchemes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "OverdueInterestRate",
                table: "RdSchemes",
                type: "decimal(5,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SchemeCodeNumeric",
                table: "RdSchemes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "LastSequenceNumber",
                table: "RdAccountSequences",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SchemeCodeNumeric",
                table: "RdAccountSequences",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedOn",
                table: "RdAccountSequences",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AutoDebitDay",
                table: "RdAccounts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "ClosedPayoutAmount",
                table: "RdAccounts",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClosureDate",
                table: "RdAccounts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClosureType",
                table: "RdAccounts",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CumulativeInterestAccrued",
                table: "RdAccounts",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsLienMarked",
                table: "RdAccounts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "LienAmount",
                table: "RdAccounts",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LienLoanAccountNo",
                table: "RdAccounts",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InterestPostingFrequency",
                table: "PigmySchemes",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SchemeCodeNumeric",
                table: "PigmyAccountSequences",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedOn",
                table: "PigmyAccountSequences",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CurrentCycleNumber",
                table: "PigmyAccounts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "EffectiveStartDate",
                table: "PigmyAccounts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastWithdrawalDate",
                table: "PigmyAccounts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreviousAccountNo",
                table: "PigmyAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalWithdrawnAmount",
                table: "PigmyAccounts",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastInterestPostingDate",
                table: "LoanAccounts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowOverdueInterest",
                table: "FdSchemes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "DurationType",
                table: "FdSchemes",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "InterestPayoutFrequency",
                table: "FdSchemes",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "MaxDurationDays",
                table: "FdSchemes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinDurationDays",
                table: "FdSchemes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OverdueGraceDays",
                table: "FdSchemes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "OverdueInterestRate",
                table: "FdSchemes",
                type: "decimal(5,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OverdueRenewalPolicy",
                table: "FdSchemes",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "SchemeDurationModel",
                table: "FdSchemes",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "AutoRenewalCount",
                table: "FdAccounts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "AutoRenewalOption",
                table: "FdAccounts",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "DurationInDays",
                table: "FdAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DurationType",
                table: "FdAccounts",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationValue",
                table: "FdAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAutoRenewable",
                table: "FdAccounts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "MaxAutoRenewalCycles",
                table: "FdAccounts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ParentFdAccountID",
                table: "FdAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FdAutoRenewalLogs",
                columns: table => new
                {
                    LogID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    BatchDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OldFdAccountID = table.Column<int>(type: "int", nullable: false),
                    NewFdAccountID = table.Column<int>(type: "int", nullable: true),
                    OldAccountNo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    NewAccountNo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    CustomerID = table.Column<int>(type: "int", nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    RenewalOption = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    RenewedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    InterestPaidOut = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AppliedRate = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ExecutedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ExecutionTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsReverted = table.Column<bool>(type: "bit", nullable: false),
                    RevertedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RevertedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RevertReason = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FdAutoRenewalLogs", x => x.LogID);
                    table.ForeignKey(
                        name: "FK_FdAutoRenewalLogs_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdAutoRenewalLogs_FdAccounts_NewFdAccountID",
                        column: x => x.NewFdAccountID,
                        principalTable: "FdAccounts",
                        principalColumn: "FdAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdAutoRenewalLogs_FdAccounts_OldFdAccountID",
                        column: x => x.OldFdAccountID,
                        principalTable: "FdAccounts",
                        principalColumn: "FdAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FdSchemeInterestSlabs",
                columns: table => new
                {
                    SlabID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FdSchemeID = table.Column<int>(type: "int", nullable: false),
                    FromDays = table.Column<int>(type: "int", nullable: false),
                    ToDays = table.Column<int>(type: "int", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    SeniorCitizenRate = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    PrematureRate = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FdSchemeInterestSlabs", x => x.SlabID);
                    table.ForeignKey(
                        name: "FK_FdSchemeInterestSlabs_FdSchemes_FdSchemeID",
                        column: x => x.FdSchemeID,
                        principalTable: "FdSchemes",
                        principalColumn: "FdSchemeID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyAgentAccountTransfers",
                columns: table => new
                {
                    TransferID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FromAgentID = table.Column<int>(type: "int", nullable: false),
                    ToAgentID = table.Column<int>(type: "int", nullable: false),
                    PigmyAccountID = table.Column<int>(type: "int", nullable: false),
                    TotalBalanceAtTransfer = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    TransferredOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TransferredBy = table.Column<int>(type: "int", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    TransferType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyAgentAccountTransfers", x => x.TransferID);
                    table.ForeignKey(
                        name: "FK_PigmyAgentAccountTransfers_PigmyAccounts_PigmyAccountID",
                        column: x => x.PigmyAccountID,
                        principalTable: "PigmyAccounts",
                        principalColumn: "PigmyAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyAgentAccountTransfers_PigmyAgents_FromAgentID",
                        column: x => x.FromAgentID,
                        principalTable: "PigmyAgents",
                        principalColumn: "PigmyAgentID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyAgentAccountTransfers_PigmyAgents_ToAgentID",
                        column: x => x.ToAgentID,
                        principalTable: "PigmyAgents",
                        principalColumn: "PigmyAgentID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmySchemeInterestSlabs",
                columns: table => new
                {
                    SlabID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PigmySchemeID = table.Column<int>(type: "int", nullable: false),
                    FromDays = table.Column<int>(type: "int", nullable: false),
                    ToDays = table.Column<int>(type: "int", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    PenaltyRate = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    SlabDescription = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmySchemeInterestSlabs", x => x.SlabID);
                    table.ForeignKey(
                        name: "FK_PigmySchemeInterestSlabs_PigmySchemes_PigmySchemeID",
                        column: x => x.PigmySchemeID,
                        principalTable: "PigmySchemes",
                        principalColumn: "PigmySchemeID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RDInstallmentSchedules",
                columns: table => new
                {
                    ScheduleID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RdAccountID = table.Column<int>(type: "int", nullable: false),
                    InstallmentNo = table.Column<int>(type: "int", nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    GraceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpectedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PaidDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PaidAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    OverdueDays = table.Column<int>(type: "int", nullable: false),
                    PenaltyCharged = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PenaltyWaived = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PaymentMode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RDInstallmentSchedules", x => x.ScheduleID);
                    table.ForeignKey(
                        name: "FK_RDInstallmentSchedules_RdAccounts_RdAccountID",
                        column: x => x.RdAccountID,
                        principalTable: "RdAccounts",
                        principalColumn: "RdAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RDInstallmentSchedules_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingAccountSequences",
                columns: table => new
                {
                    SequenceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    SchemeCodeNumeric = table.Column<int>(type: "int", nullable: false),
                    LastSequenceNumber = table.Column<int>(type: "int", nullable: false),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingAccountSequences", x => x.SequenceID);
                    table.ForeignKey(
                        name: "FK_SavingAccountSequences_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyWithdrawals",
                columns: table => new
                {
                    WithdrawalID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PigmyAccountID = table.Column<int>(type: "int", nullable: false),
                    WithdrawalDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CycleNumber = table.Column<int>(type: "int", nullable: false),
                    CycleStartSnapshot = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ElapsedDays = table.Column<int>(type: "int", nullable: false),
                    ElapsedMonths = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    RequestedAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    AppliedSlabID = table.Column<int>(type: "int", nullable: true),
                    PenaltyRate = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    PenaltyAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", precision: 18, scale: 2, nullable: false),
                    InterestAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    NetPaidAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    RemainingBalance = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    VoucherNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Narration = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyWithdrawals", x => x.WithdrawalID);
                    table.ForeignKey(
                        name: "FK_PigmyWithdrawals_PigmyAccounts_PigmyAccountID",
                        column: x => x.PigmyAccountID,
                        principalTable: "PigmyAccounts",
                        principalColumn: "PigmyAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyWithdrawals_PigmySchemeInterestSlabs_AppliedSlabID",
                        column: x => x.AppliedSlabID,
                        principalTable: "PigmySchemeInterestSlabs",
                        principalColumn: "SlabID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountMasters_SavingSchemeID",
                table: "SavingAccountMasters",
                column: "SavingSchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAccountSequences_BranchID",
                table: "PigmyAccountSequences",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "UQ_FdSchemes_SchemeCode",
                table: "FdSchemes",
                column: "SchemeCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FdAutoRenewalLogs_BranchID",
                table: "FdAutoRenewalLogs",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_FdAutoRenewalLogs_NewFdAccountID",
                table: "FdAutoRenewalLogs",
                column: "NewFdAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_FdAutoRenewalLogs_OldFdAccountID",
                table: "FdAutoRenewalLogs",
                column: "OldFdAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_FdSchemeInterestSlabs_FdSchemeID",
                table: "FdSchemeInterestSlabs",
                column: "FdSchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgentAccountTransfers_FromAgentID",
                table: "PigmyAgentAccountTransfers",
                column: "FromAgentID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgentAccountTransfers_PigmyAccountID",
                table: "PigmyAgentAccountTransfers",
                column: "PigmyAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgentAccountTransfers_ToAgentID",
                table: "PigmyAgentAccountTransfers",
                column: "ToAgentID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmySchemeInterestSlabs_PigmySchemeID",
                table: "PigmySchemeInterestSlabs",
                column: "PigmySchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyWithdrawals_AppliedSlabID",
                table: "PigmyWithdrawals",
                column: "AppliedSlabID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyWithdrawals_PigmyAccountID",
                table: "PigmyWithdrawals",
                column: "PigmyAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_RDInstallmentSchedules_RdAccountID",
                table: "RDInstallmentSchedules",
                column: "RdAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_RDInstallmentSchedules_VoucherID",
                table: "RDInstallmentSchedules",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountSequences_BranchID",
                table: "SavingAccountSequences",
                column: "BranchID");

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Customers_RecommendedByDirectorID",
                table: "LoanApplications",
                column: "RecommendedByDirectorID",
                principalTable: "Customers",
                principalColumn: "CustomerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PigmyAccountSequences_Branches_BranchID",
                table: "PigmyAccountSequences",
                column: "BranchID",
                principalTable: "Branches",
                principalColumn: "BranchID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SavingAccountMasters_SavingInterestSettings_SavingSchemeID",
                table: "SavingAccountMasters",
                column: "SavingSchemeID",
                principalTable: "SavingInterestSettings",
                principalColumn: "SettingID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LoanApplications_Customers_RecommendedByDirectorID",
                table: "LoanApplications");

            migrationBuilder.DropForeignKey(
                name: "FK_PigmyAccountSequences_Branches_BranchID",
                table: "PigmyAccountSequences");

            migrationBuilder.DropForeignKey(
                name: "FK_SavingAccountMasters_SavingInterestSettings_SavingSchemeID",
                table: "SavingAccountMasters");

            migrationBuilder.DropTable(
                name: "FdAutoRenewalLogs");

            migrationBuilder.DropTable(
                name: "FdSchemeInterestSlabs");

            migrationBuilder.DropTable(
                name: "PigmyAgentAccountTransfers");

            migrationBuilder.DropTable(
                name: "PigmyWithdrawals");

            migrationBuilder.DropTable(
                name: "RDInstallmentSchedules");

            migrationBuilder.DropTable(
                name: "SavingAccountSequences");

            migrationBuilder.DropTable(
                name: "PigmySchemeInterestSlabs");

            migrationBuilder.DropIndex(
                name: "IX_SavingAccountMasters_SavingSchemeID",
                table: "SavingAccountMasters");

            migrationBuilder.DropIndex(
                name: "IX_PigmyAccountSequences_BranchID",
                table: "PigmyAccountSequences");

            migrationBuilder.DropIndex(
                name: "UQ_FdSchemes_SchemeCode",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "SavingSchemeID",
                table: "SavingAccountMasters");

            migrationBuilder.DropColumn(
                name: "BalanceAfterTxn",
                table: "RdTransactions");

            migrationBuilder.DropColumn(
                name: "Narration",
                table: "RdTransactions");

            migrationBuilder.DropColumn(
                name: "AllowOverdueInterest",
                table: "RdSchemes");

            migrationBuilder.DropColumn(
                name: "CompoundingFrequency",
                table: "RdSchemes");

            migrationBuilder.DropColumn(
                name: "GracePeriodDays",
                table: "RdSchemes");

            migrationBuilder.DropColumn(
                name: "OverdueInterestRate",
                table: "RdSchemes");

            migrationBuilder.DropColumn(
                name: "SchemeCodeNumeric",
                table: "RdSchemes");

            migrationBuilder.DropColumn(
                name: "LastSequenceNumber",
                table: "RdAccountSequences");

            migrationBuilder.DropColumn(
                name: "SchemeCodeNumeric",
                table: "RdAccountSequences");

            migrationBuilder.DropColumn(
                name: "UpdatedOn",
                table: "RdAccountSequences");

            migrationBuilder.DropColumn(
                name: "AutoDebitDay",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "ClosedPayoutAmount",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "ClosureDate",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "ClosureType",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "CumulativeInterestAccrued",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "IsLienMarked",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "LienAmount",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "LienLoanAccountNo",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "InterestPostingFrequency",
                table: "PigmySchemes");

            migrationBuilder.DropColumn(
                name: "SchemeCodeNumeric",
                table: "PigmyAccountSequences");

            migrationBuilder.DropColumn(
                name: "UpdatedOn",
                table: "PigmyAccountSequences");

            migrationBuilder.DropColumn(
                name: "CurrentCycleNumber",
                table: "PigmyAccounts");

            migrationBuilder.DropColumn(
                name: "EffectiveStartDate",
                table: "PigmyAccounts");

            migrationBuilder.DropColumn(
                name: "LastWithdrawalDate",
                table: "PigmyAccounts");

            migrationBuilder.DropColumn(
                name: "PreviousAccountNo",
                table: "PigmyAccounts");

            migrationBuilder.DropColumn(
                name: "TotalWithdrawnAmount",
                table: "PigmyAccounts");

            migrationBuilder.DropColumn(
                name: "LastInterestPostingDate",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "AllowOverdueInterest",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "DurationType",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "InterestPayoutFrequency",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "MaxDurationDays",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "MinDurationDays",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "OverdueGraceDays",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "OverdueInterestRate",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "OverdueRenewalPolicy",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "SchemeDurationModel",
                table: "FdSchemes");

            migrationBuilder.DropColumn(
                name: "AutoRenewalCount",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "AutoRenewalOption",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "DurationInDays",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "DurationType",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "DurationValue",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "IsAutoRenewable",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "MaxAutoRenewalCycles",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "ParentFdAccountID",
                table: "FdAccounts");

            migrationBuilder.RenameColumn(
                name: "SequenceID",
                table: "PigmyAccountSequences",
                newName: "ID");

            migrationBuilder.AddColumn<decimal>(
                name: "InstallmentAmount",
                table: "RdSchemes",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "MobileNo",
                table: "PigmyAgents",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CoMember2ID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CoMemberID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Guarantor1MemberID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Guarantor2MemberID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MemberID",
                table: "LoanApplications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CoMember2ID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CoMemberID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Guarantor1MemberID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Guarantor2MemberID",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_CoMember2ID",
                table: "LoanApplications",
                column: "CoMember2ID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_CoMemberID",
                table: "LoanApplications",
                column: "CoMemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_Guarantor1MemberID",
                table: "LoanApplications",
                column: "Guarantor1MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_Guarantor2MemberID",
                table: "LoanApplications",
                column: "Guarantor2MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_MemberID",
                table: "LoanApplications",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_CoMember2ID",
                table: "LoanAccounts",
                column: "CoMember2ID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_CoMemberID",
                table: "LoanAccounts",
                column: "CoMemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_Guarantor1MemberID",
                table: "LoanAccounts",
                column: "Guarantor1MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_Guarantor2MemberID",
                table: "LoanAccounts",
                column: "Guarantor2MemberID");

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Members_CoMember2ID",
                table: "LoanAccounts",
                column: "CoMember2ID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Members_CoMemberID",
                table: "LoanAccounts",
                column: "CoMemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Members_Guarantor1MemberID",
                table: "LoanAccounts",
                column: "Guarantor1MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanAccounts_Members_Guarantor2MemberID",
                table: "LoanAccounts",
                column: "Guarantor2MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Members_CoMember2ID",
                table: "LoanApplications",
                column: "CoMember2ID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Members_CoMemberID",
                table: "LoanApplications",
                column: "CoMemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Members_Guarantor1MemberID",
                table: "LoanApplications",
                column: "Guarantor1MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Members_Guarantor2MemberID",
                table: "LoanApplications",
                column: "Guarantor2MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Members_MemberID",
                table: "LoanApplications",
                column: "MemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoanApplications_Members_RecommendedByDirectorID",
                table: "LoanApplications",
                column: "RecommendedByDirectorID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);
        }
    }
}

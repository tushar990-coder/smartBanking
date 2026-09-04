using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class LatestUpdates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ActiveSessionToken",
                table: "Users",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255,
                oldNullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LienAmount",
                table: "SavingAccountMasters",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "LienReason",
                table: "SavingAccountMasters",
                type: "nvarchar(250)",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AccountType",
                table: "RdAccounts",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "AgentID",
                table: "RdAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuardianName",
                table: "RdAccounts",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GuardianRelation",
                table: "RdAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "JointMemberID",
                table: "RdAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MaturityInstruction",
                table: "RdAccounts",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PassbookNo",
                table: "RdAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentMode",
                table: "RdAccounts",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "SavingAccountID",
                table: "RdAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "JoiningDate",
                table: "PigmyAgents",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NickName",
                table: "Members",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByUserID",
                table: "LoanCollections",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "InterestWaived",
                table: "LoanCollections",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsOTS",
                table: "LoanCollections",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PenaltyWaived",
                table: "LoanCollections",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ResolutionNo",
                table: "LoanCollections",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SystemNotifications",
                columns: table => new
                {
                    NotificationID = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    UserID = table.Column<int>(type: "int", nullable: true),
                    RoleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ModuleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NotificationType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TargetTab = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    EntityID = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedBy = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemNotifications", x => x.NotificationID);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RdAccounts_AgentID",
                table: "RdAccounts",
                column: "AgentID");

            migrationBuilder.CreateIndex(
                name: "IX_RdAccounts_JointMemberID",
                table: "RdAccounts",
                column: "JointMemberID");

            migrationBuilder.CreateIndex(
                name: "IX_RdAccounts_SavingAccountID",
                table: "RdAccounts",
                column: "SavingAccountID");

            migrationBuilder.AddForeignKey(
                name: "FK_RdAccounts_Members_JointMemberID",
                table: "RdAccounts",
                column: "JointMemberID",
                principalTable: "Members",
                principalColumn: "MemberID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RdAccounts_PigmyAgents_AgentID",
                table: "RdAccounts",
                column: "AgentID",
                principalTable: "PigmyAgents",
                principalColumn: "PigmyAgentID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_RdAccounts_SavingAccountMasters_SavingAccountID",
                table: "RdAccounts",
                column: "SavingAccountID",
                principalTable: "SavingAccountMasters",
                principalColumn: "SavingAccountID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RdAccounts_Members_JointMemberID",
                table: "RdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_RdAccounts_PigmyAgents_AgentID",
                table: "RdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_RdAccounts_SavingAccountMasters_SavingAccountID",
                table: "RdAccounts");

            migrationBuilder.DropTable(
                name: "SystemNotifications");

            migrationBuilder.DropIndex(
                name: "IX_RdAccounts_AgentID",
                table: "RdAccounts");

            migrationBuilder.DropIndex(
                name: "IX_RdAccounts_JointMemberID",
                table: "RdAccounts");

            migrationBuilder.DropIndex(
                name: "IX_RdAccounts_SavingAccountID",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "LienAmount",
                table: "SavingAccountMasters");

            migrationBuilder.DropColumn(
                name: "LienReason",
                table: "SavingAccountMasters");

            migrationBuilder.DropColumn(
                name: "AccountType",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "AgentID",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "GuardianName",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "GuardianRelation",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "JointMemberID",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "MaturityInstruction",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "PassbookNo",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "PaymentMode",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "SavingAccountID",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "JoiningDate",
                table: "PigmyAgents");

            migrationBuilder.DropColumn(
                name: "NickName",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserID",
                table: "LoanCollections");

            migrationBuilder.DropColumn(
                name: "InterestWaived",
                table: "LoanCollections");

            migrationBuilder.DropColumn(
                name: "IsOTS",
                table: "LoanCollections");

            migrationBuilder.DropColumn(
                name: "PenaltyWaived",
                table: "LoanCollections");

            migrationBuilder.DropColumn(
                name: "ResolutionNo",
                table: "LoanCollections");

            migrationBuilder.AlterColumn<string>(
                name: "ActiveSessionToken",
                table: "Users",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(2000)",
                oldMaxLength: 2000,
                oldNullable: true);
        }
    }
}

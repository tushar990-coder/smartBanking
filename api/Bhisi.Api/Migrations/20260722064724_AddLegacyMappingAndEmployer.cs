using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLegacyMappingAndEmployer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LegacyAccountId",
                table: "ShareAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegacyAccountNumber",
                table: "ShareAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyAccountId",
                table: "SavingAccountMasters",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegacyAccountNumber",
                table: "SavingAccountMasters",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyAccountId",
                table: "RdAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegacyAccountNumber",
                table: "RdAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyAccountId",
                table: "PigmyAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegacyAccountNumber",
                table: "PigmyAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmployerId",
                table: "Members",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyMemberId",
                table: "Members",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegacyMemberNo",
                table: "Members",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyAccountId",
                table: "LoanAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegacyAccountNumber",
                table: "LoanAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyAccountId",
                table: "FdAccounts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LegacyAccountNumber",
                table: "FdAccounts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmployerMasters",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ContactNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LegacyTypeId = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployerMasters", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Members_EmployerId",
                table: "Members",
                column: "EmployerId");

            migrationBuilder.AddForeignKey(
                name: "FK_Members_EmployerMasters_EmployerId",
                table: "Members",
                column: "EmployerId",
                principalTable: "EmployerMasters",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Members_EmployerMasters_EmployerId",
                table: "Members");

            migrationBuilder.DropTable(
                name: "EmployerMasters");

            migrationBuilder.DropIndex(
                name: "IX_Members_EmployerId",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "LegacyAccountId",
                table: "ShareAccounts");

            migrationBuilder.DropColumn(
                name: "LegacyAccountNumber",
                table: "ShareAccounts");

            migrationBuilder.DropColumn(
                name: "LegacyAccountId",
                table: "SavingAccountMasters");

            migrationBuilder.DropColumn(
                name: "LegacyAccountNumber",
                table: "SavingAccountMasters");

            migrationBuilder.DropColumn(
                name: "LegacyAccountId",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "LegacyAccountNumber",
                table: "RdAccounts");

            migrationBuilder.DropColumn(
                name: "LegacyAccountId",
                table: "PigmyAccounts");

            migrationBuilder.DropColumn(
                name: "LegacyAccountNumber",
                table: "PigmyAccounts");

            migrationBuilder.DropColumn(
                name: "EmployerId",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "LegacyMemberId",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "LegacyMemberNo",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "LegacyAccountId",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "LegacyAccountNumber",
                table: "LoanAccounts");

            migrationBuilder.DropColumn(
                name: "LegacyAccountId",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "LegacyAccountNumber",
                table: "FdAccounts");
        }
    }
}

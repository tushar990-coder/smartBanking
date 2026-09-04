using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInvestmentTypeAndGlLedgerMappings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InterestIncomeLedgerID",
                table: "InvestmentSchemes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InterestReceivableLedgerID",
                table: "InvestmentSchemes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "InvestmentAssetLedgerID",
                table: "InvestmentSchemes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvestmentType",
                table: "InvestmentSchemes",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentSchemes_InterestIncomeLedgerID",
                table: "InvestmentSchemes",
                column: "InterestIncomeLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentSchemes_InterestReceivableLedgerID",
                table: "InvestmentSchemes",
                column: "InterestReceivableLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentSchemes_InvestmentAssetLedgerID",
                table: "InvestmentSchemes",
                column: "InvestmentAssetLedgerID");

            migrationBuilder.AddForeignKey(
                name: "FK_InvestmentSchemes_Ledgers_InterestIncomeLedgerID",
                table: "InvestmentSchemes",
                column: "InterestIncomeLedgerID",
                principalTable: "Ledgers",
                principalColumn: "LedgerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InvestmentSchemes_Ledgers_InterestReceivableLedgerID",
                table: "InvestmentSchemes",
                column: "InterestReceivableLedgerID",
                principalTable: "Ledgers",
                principalColumn: "LedgerID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_InvestmentSchemes_Ledgers_InvestmentAssetLedgerID",
                table: "InvestmentSchemes",
                column: "InvestmentAssetLedgerID",
                principalTable: "Ledgers",
                principalColumn: "LedgerID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InvestmentSchemes_Ledgers_InterestIncomeLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropForeignKey(
                name: "FK_InvestmentSchemes_Ledgers_InterestReceivableLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropForeignKey(
                name: "FK_InvestmentSchemes_Ledgers_InvestmentAssetLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropIndex(
                name: "IX_InvestmentSchemes_InterestIncomeLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropIndex(
                name: "IX_InvestmentSchemes_InterestReceivableLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropIndex(
                name: "IX_InvestmentSchemes_InvestmentAssetLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropColumn(
                name: "InterestIncomeLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropColumn(
                name: "InterestReceivableLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropColumn(
                name: "InvestmentAssetLedgerID",
                table: "InvestmentSchemes");

            migrationBuilder.DropColumn(
                name: "InvestmentType",
                table: "InvestmentSchemes");
        }
    }
}

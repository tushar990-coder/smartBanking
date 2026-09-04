using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLegacyIdsForMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LegacyLedgerId",
                table: "Ledgers",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LegacyGroupId",
                table: "AccountGroups",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LegacyLedgerId",
                table: "Ledgers");

            migrationBuilder.DropColumn(
                name: "LegacyGroupId",
                table: "AccountGroups");
        }
    }
}

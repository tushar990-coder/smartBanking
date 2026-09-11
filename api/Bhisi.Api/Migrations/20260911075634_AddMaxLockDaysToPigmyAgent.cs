using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMaxLockDaysToPigmyAgent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MobileNo",
                table: "PigmyAgents");

            migrationBuilder.AddColumn<int>(
                name: "MaxLockDays",
                table: "PigmyAgents",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxLockDays",
                table: "PigmyAgents");

            migrationBuilder.AddColumn<string>(
                name: "MobileNo",
                table: "PigmyAgents",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: false,
                defaultValue: "");
        }
    }
}

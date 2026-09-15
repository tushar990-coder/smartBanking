using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPigmySchemeAdvancedRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InterestCalculationMethod",
                table: "PigmySchemes",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinDurationMonths",
                table: "PigmySchemes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PenaltyInterestRate",
                table: "PigmySchemes",
                type: "decimal(5,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PrematureInterestRate",
                table: "PigmySchemes",
                type: "decimal(5,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MobileNo",
                table: "PigmyAgents",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InterestCalculationMethod",
                table: "PigmySchemes");

            migrationBuilder.DropColumn(
                name: "MinDurationMonths",
                table: "PigmySchemes");

            migrationBuilder.DropColumn(
                name: "PenaltyInterestRate",
                table: "PigmySchemes");

            migrationBuilder.DropColumn(
                name: "PrematureInterestRate",
                table: "PigmySchemes");

            migrationBuilder.DropColumn(
                name: "MobileNo",
                table: "PigmyAgents");
        }
    }
}

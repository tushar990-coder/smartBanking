using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateModels_Fixes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CollateralDescription",
                table: "CollateralComplianceLogs",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CollateralValue",
                table: "CollateralComplianceLogs",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InspectorName",
                table: "CollateralComplianceLogs",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MarginPercent",
                table: "CollateralComplianceLogs",
                type: "decimal(5,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Remarks",
                table: "CollateralComplianceLogs",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CollateralDescription",
                table: "CollateralComplianceLogs");

            migrationBuilder.DropColumn(
                name: "CollateralValue",
                table: "CollateralComplianceLogs");

            migrationBuilder.DropColumn(
                name: "InspectorName",
                table: "CollateralComplianceLogs");

            migrationBuilder.DropColumn(
                name: "MarginPercent",
                table: "CollateralComplianceLogs");

            migrationBuilder.DropColumn(
                name: "Remarks",
                table: "CollateralComplianceLogs");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInterestPostingFrequencyToLoanRate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InterestPostingFrequency",
                table: "LoanRates",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                defaultValue: "मासिक");

            migrationBuilder.Sql("UPDATE LoanRates SET InterestPostingFrequency = N'मासिक' WHERE InterestPostingFrequency IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InterestPostingFrequency",
                table: "LoanRates");
        }
    }
}

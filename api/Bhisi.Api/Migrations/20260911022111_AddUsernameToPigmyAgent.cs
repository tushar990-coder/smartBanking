using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUsernameToPigmyAgent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Username",
                table: "PigmyAgents",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Username",
                table: "PigmyAgents");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class MakeMemberCodeNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // MemberCode was originally created as NOT NULL but the model has been
            // updated to string? (nullable). This migration aligns the DB schema with
            // the model and fixes the SqlNullValueException on the Members endpoint
            // caused by EF reading NULLs from a column it believes is non-nullable.
            migrationBuilder.AlterColumn<string>(
                name: "MemberCode",
                table: "Members",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Note: Running Down requires all MemberCode values to be non-null first.
            // Run: UPDATE Members SET MemberCode = CAST(MemberID AS NVARCHAR(20)) WHERE MemberCode IS NULL
            migrationBuilder.AlterColumn<string>(
                name: "MemberCode",
                table: "Members",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20,
                oldNullable: true);
        }
    }
}

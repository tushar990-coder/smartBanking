using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchIDToPigmyAgent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BranchID",
                table: "PigmyAgents",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgents_BranchID",
                table: "PigmyAgents",
                column: "BranchID");

            migrationBuilder.AddForeignKey(
                name: "FK_PigmyAgents_Branches_BranchID",
                table: "PigmyAgents",
                column: "BranchID",
                principalTable: "Branches",
                principalColumn: "BranchID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PigmyAgents_Branches_BranchID",
                table: "PigmyAgents");

            migrationBuilder.DropIndex(
                name: "IX_PigmyAgents_BranchID",
                table: "PigmyAgents");

            migrationBuilder.DropColumn(
                name: "BranchID",
                table: "PigmyAgents");
        }
    }
}

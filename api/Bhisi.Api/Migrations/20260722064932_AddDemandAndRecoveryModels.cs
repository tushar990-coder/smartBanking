using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDemandAndRecoveryModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DemandNotices",
                columns: table => new
                {
                    DemandNoticeId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NoticeNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Month = table.Column<int>(type: "int", nullable: false),
                    Year = table.Column<int>(type: "int", nullable: false),
                    EmployerId = table.Column<int>(type: "int", nullable: false),
                    BranchId = table.Column<int>(type: "int", nullable: false),
                    TotalDemandAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemandNotices", x => x.DemandNoticeId);
                    table.ForeignKey(
                        name: "FK_DemandNotices_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DemandNotices_EmployerMasters_EmployerId",
                        column: x => x.EmployerId,
                        principalTable: "EmployerMasters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DemandMemberDetails",
                columns: table => new
                {
                    DemandMemberDetailId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DemandNoticeId = table.Column<int>(type: "int", nullable: false),
                    MemberId = table.Column<int>(type: "int", nullable: false),
                    LoanInstallment = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SavingDeposit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ShareDeposit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PigmyDeposit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RdDeposit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalDeduction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsProcessed = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemandMemberDetails", x => x.DemandMemberDetailId);
                    table.ForeignKey(
                        name: "FK_DemandMemberDetails_DemandNotices_DemandNoticeId",
                        column: x => x.DemandNoticeId,
                        principalTable: "DemandNotices",
                        principalColumn: "DemandNoticeId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DemandMemberDetails_Members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DemandRecoveries",
                columns: table => new
                {
                    DemandRecoveryId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DemandNoticeId = table.Column<int>(type: "int", nullable: false),
                    RecoveryDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalReceivedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherId = table.Column<int>(type: "int", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemandRecoveries", x => x.DemandRecoveryId);
                    table.ForeignKey(
                        name: "FK_DemandRecoveries_DemandNotices_DemandNoticeId",
                        column: x => x.DemandNoticeId,
                        principalTable: "DemandNotices",
                        principalColumn: "DemandNoticeId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DemandRecoveries_Vouchers_VoucherId",
                        column: x => x.VoucherId,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DemandMemberDetails_DemandNoticeId",
                table: "DemandMemberDetails",
                column: "DemandNoticeId");

            migrationBuilder.CreateIndex(
                name: "IX_DemandMemberDetails_MemberId",
                table: "DemandMemberDetails",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_DemandNotices_BranchId",
                table: "DemandNotices",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_DemandNotices_EmployerId",
                table: "DemandNotices",
                column: "EmployerId");

            migrationBuilder.CreateIndex(
                name: "IX_DemandRecoveries_DemandNoticeId",
                table: "DemandRecoveries",
                column: "DemandNoticeId");

            migrationBuilder.CreateIndex(
                name: "IX_DemandRecoveries_VoucherId",
                table: "DemandRecoveries",
                column: "VoucherId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DemandMemberDetails");

            migrationBuilder.DropTable(
                name: "DemandRecoveries");

            migrationBuilder.DropTable(
                name: "DemandNotices");
        }
    }
}

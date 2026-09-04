using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncBranchDefaultCashLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Members_AadhaarNo",
                table: "Members");

            migrationBuilder.AddColumn<int>(
                name: "ScrollNo",
                table: "Vouchers",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SchemeName",
                table: "SavingInterestSettings",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "AadhaarNo",
                table: "Members",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(12)",
                oldMaxLength: 12);

            migrationBuilder.AddColumn<string>(
                name: "AadhaarDocPath",
                table: "Members",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PanDocPath",
                table: "Members",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LedgerNameEnglish",
                table: "Ledgers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "CommitteeMembers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DINNo",
                table: "CommitteeMembers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Remarks",
                table: "CommitteeMembers",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TermYear",
                table: "CommitteeMembers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DefaultCashLedgerID",
                table: "Branches",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GroupCode",
                table: "AccountGroups",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GroupNameEnglish",
                table: "AccountGroups",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AuditLedgerMappings",
                columns: table => new
                {
                    AuditLedgerMappingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CategoryCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CategoryName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLedgerMappings", x => x.AuditLedgerMappingID);
                    table.ForeignKey(
                        name: "FK_AuditLedgerMappings_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LegalRecoveryLedgerMappings",
                columns: table => new
                {
                    MappingId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DebitLedgerId = table.Column<int>(type: "int", nullable: false),
                    CreditLedgerId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LegalRecoveryLedgerMappings", x => x.MappingId);
                    table.ForeignKey(
                        name: "FK_LegalRecoveryLedgerMappings_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LegalRecoveryLedgerMappings_Ledgers_CreditLedgerId",
                        column: x => x.CreditLedgerId,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LegalRecoveryLedgerMappings_Ledgers_DebitLedgerId",
                        column: x => x.DebitLedgerId,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LockerTypes",
                columns: table => new
                {
                    LockerTypeID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    TypeCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TypeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Dimensions = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AnnualRent = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SecurityDeposit = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LateFeePerMonth = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    GstRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    DepositLiabilityLedgerID = table.Column<int>(type: "int", nullable: true),
                    RentIncomeLedgerID = table.Column<int>(type: "int", nullable: true),
                    LateFeeIncomeLedgerID = table.Column<int>(type: "int", nullable: true),
                    GstLiabilityLedgerID = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LockerTypes", x => x.LockerTypeID);
                    table.ForeignKey(
                        name: "FK_LockerTypes_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerTypes_Ledgers_DepositLiabilityLedgerID",
                        column: x => x.DepositLiabilityLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerTypes_Ledgers_GstLiabilityLedgerID",
                        column: x => x.GstLiabilityLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerTypes_Ledgers_LateFeeIncomeLedgerID",
                        column: x => x.LateFeeIncomeLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerTypes_Ledgers_RentIncomeLedgerID",
                        column: x => x.RentIncomeLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sec101CaseMasters",
                columns: table => new
                {
                    CaseId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: false),
                    LoanAccountId = table.Column<int>(type: "int", nullable: false),
                    MemberId = table.Column<int>(type: "int", nullable: false),
                    CaseNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CourtName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    AdvocateName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FilingDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PrincipalClaim = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestClaim = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PenalInterestClaim = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OtherChargesClaim = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalClaimAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CourtFeeAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CourtFeeChallanNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CertificateNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CertificateDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SanctionedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    FutureInterestRate = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sec101CaseMasters", x => x.CaseId);
                    table.ForeignKey(
                        name: "FK_Sec101CaseMasters_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sec101CaseMasters_LoanAccounts_LoanAccountId",
                        column: x => x.LoanAccountId,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sec101CaseMasters_Members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sec101NoticeHistories",
                columns: table => new
                {
                    NoticeId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: false),
                    LoanAccountId = table.Column<int>(type: "int", nullable: false),
                    MemberId = table.Column<int>(type: "int", nullable: false),
                    NoticeType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NoticeNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NoticeDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PrincipalDue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestDue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PenalInterestDue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NoticeFee = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalDemandAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PostalTrackingNo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PostalStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DeliveredDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sec101NoticeHistories", x => x.NoticeId);
                    table.ForeignKey(
                        name: "FK_Sec101NoticeHistories_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sec101NoticeHistories_LoanAccounts_LoanAccountId",
                        column: x => x.LoanAccountId,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sec101NoticeHistories_Members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShareSchemes",
                columns: table => new
                {
                    ShareSchemeId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    SchemeCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SchemeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MemberType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ShareFaceValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MinSharesCount = table.Column<int>(type: "int", nullable: false),
                    MaxSharesCount = table.Column<int>(type: "int", nullable: false),
                    EntranceFee = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BuildingFund = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ShareTransferFee = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DividendRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    HasVotingRights = table.Column<bool>(type: "bit", nullable: false),
                    IsAadhaarCompulsory = table.Column<bool>(type: "bit", nullable: false),
                    IsPanCompulsory = table.Column<bool>(type: "bit", nullable: false),
                    LoanEligibilityMultiplier = table.Column<int>(type: "int", nullable: false),
                    EffectiveDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    ShareCapitalLedgerID = table.Column<int>(type: "int", nullable: true),
                    EntranceFeeLedgerID = table.Column<int>(type: "int", nullable: true),
                    ShareTransferFeeLedgerID = table.Column<int>(type: "int", nullable: true),
                    BuildingFundLedgerID = table.Column<int>(type: "int", nullable: true),
                    DividendPayableLedgerID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShareSchemes", x => x.ShareSchemeId);
                    table.ForeignKey(
                        name: "FK_ShareSchemes_Ledgers_BuildingFundLedgerID",
                        column: x => x.BuildingFundLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShareSchemes_Ledgers_DividendPayableLedgerID",
                        column: x => x.DividendPayableLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShareSchemes_Ledgers_EntranceFeeLedgerID",
                        column: x => x.EntranceFeeLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShareSchemes_Ledgers_ShareCapitalLedgerID",
                        column: x => x.ShareCapitalLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShareSchemes_Ledgers_ShareTransferFeeLedgerID",
                        column: x => x.ShareTransferFeeLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Lockers",
                columns: table => new
                {
                    LockerID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    CabinetNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LockerNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    KeyNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LockerTypeID = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lockers", x => x.LockerID);
                    table.ForeignKey(
                        name: "FK_Lockers_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Lockers_LockerTypes_LockerTypeID",
                        column: x => x.LockerTypeID,
                        principalTable: "LockerTypes",
                        principalColumn: "LockerTypeID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sec101AttachmentAuctions",
                columns: table => new
                {
                    ExecutionId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CaseId = table.Column<int>(type: "int", nullable: false),
                    SroName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ExecutionType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PropertyDetails = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ValuationAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    WarrantIssueDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PanchanamaDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AuctionNoticeDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AuctionDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReservePrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    HighestBidAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BuyerName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    BuyerContact = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SaleCertificateDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SaleCertificateNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sec101AttachmentAuctions", x => x.ExecutionId);
                    table.ForeignKey(
                        name: "FK_Sec101AttachmentAuctions_Sec101CaseMasters_CaseId",
                        column: x => x.CaseId,
                        principalTable: "Sec101CaseMasters",
                        principalColumn: "CaseId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sec101HearingLogs",
                columns: table => new
                {
                    HearingId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CaseId = table.Column<int>(type: "int", nullable: false),
                    HearingDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NextHearingDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Stage = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BorrowerPresence = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    GuarantorPresence = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CourtOrderSummary = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AdvocateNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sec101HearingLogs", x => x.HearingId);
                    table.ForeignKey(
                        name: "FK_Sec101HearingLogs_Sec101CaseMasters_CaseId",
                        column: x => x.CaseId,
                        principalTable: "Sec101CaseMasters",
                        principalColumn: "CaseId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Sec101LegalExpenses",
                columns: table => new
                {
                    ExpenseId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: false),
                    CaseId = table.Column<int>(type: "int", nullable: true),
                    LoanAccountId = table.Column<int>(type: "int", nullable: false),
                    ExpenseType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ExpenseDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PaidTo = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    VoucherId = table.Column<int>(type: "int", nullable: true),
                    IsDebitedToLoan = table.Column<bool>(type: "bit", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sec101LegalExpenses", x => x.ExpenseId);
                    table.ForeignKey(
                        name: "FK_Sec101LegalExpenses_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sec101LegalExpenses_LoanAccounts_LoanAccountId",
                        column: x => x.LoanAccountId,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sec101LegalExpenses_Sec101CaseMasters_CaseId",
                        column: x => x.CaseId,
                        principalTable: "Sec101CaseMasters",
                        principalColumn: "CaseId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Sec101LegalExpenses_Vouchers_VoucherId",
                        column: x => x.VoucherId,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LockerAllotments",
                columns: table => new
                {
                    AllotmentID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    LockerAccountNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LockerID = table.Column<int>(type: "int", nullable: false),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    JointMember1_ID = table.Column<int>(type: "int", nullable: true),
                    JointMember2_ID = table.Column<int>(type: "int", nullable: true),
                    OperatingInstruction = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AllotmentDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RentStartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiryDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AnnualRent = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SecurityDepositAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AdvanceRentPaid = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LinkedSavingAccountID = table.Column<int>(type: "int", nullable: true),
                    IsAutoDebitEnabled = table.Column<bool>(type: "bit", nullable: false),
                    NomineeName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NomineeAge = table.Column<int>(type: "int", nullable: true),
                    NomineeAadhaar = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    NomineeAddress = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DepositVoucherID = table.Column<int>(type: "int", nullable: true),
                    AdvanceRentVoucherID = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LockerAllotments", x => x.AllotmentID);
                    table.ForeignKey(
                        name: "FK_LockerAllotments_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerAllotments_Lockers_LockerID",
                        column: x => x.LockerID,
                        principalTable: "Lockers",
                        principalColumn: "LockerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerAllotments_Members_JointMember1_ID",
                        column: x => x.JointMember1_ID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerAllotments_Members_JointMember2_ID",
                        column: x => x.JointMember2_ID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerAllotments_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerAllotments_SavingAccountMasters_LinkedSavingAccountID",
                        column: x => x.LinkedSavingAccountID,
                        principalTable: "SavingAccountMasters",
                        principalColumn: "SavingAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LockerRentPostings",
                columns: table => new
                {
                    PostingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    AllotmentID = table.Column<int>(type: "int", nullable: false),
                    FinancialYear = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FromDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ToDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    GstAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PenaltyAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentMode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PaymentDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReceiptNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    IsPaid = table.Column<bool>(type: "bit", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LockerRentPostings", x => x.PostingID);
                    table.ForeignKey(
                        name: "FK_LockerRentPostings_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerRentPostings_LockerAllotments_AllotmentID",
                        column: x => x.AllotmentID,
                        principalTable: "LockerAllotments",
                        principalColumn: "AllotmentID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerRentPostings_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LockerSurrenders",
                columns: table => new
                {
                    SurrenderID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    AllotmentID = table.Column<int>(type: "int", nullable: false),
                    SurrenderDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    KeyReceived = table.Column<bool>(type: "bit", nullable: false),
                    KeysCondition = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DepositAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnpaidRentDeduction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DamagePenaltyDeduction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NetRefundAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RefundPaymentMode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LockerSurrenders", x => x.SurrenderID);
                    table.ForeignKey(
                        name: "FK_LockerSurrenders_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerSurrenders_LockerAllotments_AllotmentID",
                        column: x => x.AllotmentID,
                        principalTable: "LockerAllotments",
                        principalColumn: "AllotmentID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerSurrenders_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LockerVisitRegisters",
                columns: table => new
                {
                    VisitID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    AllotmentID = table.Column<int>(type: "int", nullable: false),
                    VisitDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TimeIn = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TimeOut = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    OperatedBy = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OperatorName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    IsSignatureVerified = table.Column<bool>(type: "bit", nullable: false),
                    BankOfficerName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LockerVisitRegisters", x => x.VisitID);
                    table.ForeignKey(
                        name: "FK_LockerVisitRegisters_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LockerVisitRegisters_LockerAllotments_AllotmentID",
                        column: x => x.AllotmentID,
                        principalTable: "LockerAllotments",
                        principalColumn: "AllotmentID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Members_AadhaarNo",
                table: "Members",
                column: "AadhaarNo",
                unique: true,
                filter: "[AadhaarNo] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Branches_BranchCode",
                table: "Branches",
                column: "BranchCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Branches_DefaultCashLedgerID",
                table: "Branches",
                column: "DefaultCashLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLedgerMappings_LedgerID",
                table: "AuditLedgerMappings",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_LegalRecoveryLedgerMappings_BranchId",
                table: "LegalRecoveryLedgerMappings",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_LegalRecoveryLedgerMappings_CreditLedgerId",
                table: "LegalRecoveryLedgerMappings",
                column: "CreditLedgerId");

            migrationBuilder.CreateIndex(
                name: "IX_LegalRecoveryLedgerMappings_DebitLedgerId",
                table: "LegalRecoveryLedgerMappings",
                column: "DebitLedgerId");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAllotments_BranchID",
                table: "LockerAllotments",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAllotments_JointMember1_ID",
                table: "LockerAllotments",
                column: "JointMember1_ID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAllotments_JointMember2_ID",
                table: "LockerAllotments",
                column: "JointMember2_ID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAllotments_LinkedSavingAccountID",
                table: "LockerAllotments",
                column: "LinkedSavingAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAllotments_LockerID",
                table: "LockerAllotments",
                column: "LockerID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerAllotments_MemberID",
                table: "LockerAllotments",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerRentPostings_AllotmentID",
                table: "LockerRentPostings",
                column: "AllotmentID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerRentPostings_BranchID",
                table: "LockerRentPostings",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerRentPostings_VoucherID",
                table: "LockerRentPostings",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_Lockers_BranchID",
                table: "Lockers",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_Lockers_LockerTypeID",
                table: "Lockers",
                column: "LockerTypeID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerSurrenders_AllotmentID",
                table: "LockerSurrenders",
                column: "AllotmentID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerSurrenders_BranchID",
                table: "LockerSurrenders",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerSurrenders_VoucherID",
                table: "LockerSurrenders",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerTypes_BranchID",
                table: "LockerTypes",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerTypes_DepositLiabilityLedgerID",
                table: "LockerTypes",
                column: "DepositLiabilityLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerTypes_GstLiabilityLedgerID",
                table: "LockerTypes",
                column: "GstLiabilityLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerTypes_LateFeeIncomeLedgerID",
                table: "LockerTypes",
                column: "LateFeeIncomeLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerTypes_RentIncomeLedgerID",
                table: "LockerTypes",
                column: "RentIncomeLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerVisitRegisters_AllotmentID",
                table: "LockerVisitRegisters",
                column: "AllotmentID");

            migrationBuilder.CreateIndex(
                name: "IX_LockerVisitRegisters_BranchID",
                table: "LockerVisitRegisters",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101AttachmentAuctions_CaseId",
                table: "Sec101AttachmentAuctions",
                column: "CaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101CaseMasters_BranchId",
                table: "Sec101CaseMasters",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101CaseMasters_LoanAccountId",
                table: "Sec101CaseMasters",
                column: "LoanAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101CaseMasters_MemberId",
                table: "Sec101CaseMasters",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101HearingLogs_CaseId",
                table: "Sec101HearingLogs",
                column: "CaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101LegalExpenses_BranchId",
                table: "Sec101LegalExpenses",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101LegalExpenses_CaseId",
                table: "Sec101LegalExpenses",
                column: "CaseId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101LegalExpenses_LoanAccountId",
                table: "Sec101LegalExpenses",
                column: "LoanAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101LegalExpenses_VoucherId",
                table: "Sec101LegalExpenses",
                column: "VoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101NoticeHistories_BranchId",
                table: "Sec101NoticeHistories",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101NoticeHistories_LoanAccountId",
                table: "Sec101NoticeHistories",
                column: "LoanAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Sec101NoticeHistories_MemberId",
                table: "Sec101NoticeHistories",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_ShareSchemes_BuildingFundLedgerID",
                table: "ShareSchemes",
                column: "BuildingFundLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_ShareSchemes_DividendPayableLedgerID",
                table: "ShareSchemes",
                column: "DividendPayableLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_ShareSchemes_EntranceFeeLedgerID",
                table: "ShareSchemes",
                column: "EntranceFeeLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_ShareSchemes_ShareCapitalLedgerID",
                table: "ShareSchemes",
                column: "ShareCapitalLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_ShareSchemes_ShareTransferFeeLedgerID",
                table: "ShareSchemes",
                column: "ShareTransferFeeLedgerID");

            migrationBuilder.AddForeignKey(
                name: "FK_Branches_Ledgers_DefaultCashLedgerID",
                table: "Branches",
                column: "DefaultCashLedgerID",
                principalTable: "Ledgers",
                principalColumn: "LedgerID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Branches_Ledgers_DefaultCashLedgerID",
                table: "Branches");

            migrationBuilder.DropTable(
                name: "AuditLedgerMappings");

            migrationBuilder.DropTable(
                name: "LegalRecoveryLedgerMappings");

            migrationBuilder.DropTable(
                name: "LockerRentPostings");

            migrationBuilder.DropTable(
                name: "LockerSurrenders");

            migrationBuilder.DropTable(
                name: "LockerVisitRegisters");

            migrationBuilder.DropTable(
                name: "Sec101AttachmentAuctions");

            migrationBuilder.DropTable(
                name: "Sec101HearingLogs");

            migrationBuilder.DropTable(
                name: "Sec101LegalExpenses");

            migrationBuilder.DropTable(
                name: "Sec101NoticeHistories");

            migrationBuilder.DropTable(
                name: "ShareSchemes");

            migrationBuilder.DropTable(
                name: "LockerAllotments");

            migrationBuilder.DropTable(
                name: "Sec101CaseMasters");

            migrationBuilder.DropTable(
                name: "Lockers");

            migrationBuilder.DropTable(
                name: "LockerTypes");

            migrationBuilder.DropIndex(
                name: "IX_Members_AadhaarNo",
                table: "Members");

            migrationBuilder.DropIndex(
                name: "IX_Branches_BranchCode",
                table: "Branches");

            migrationBuilder.DropIndex(
                name: "IX_Branches_DefaultCashLedgerID",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "ScrollNo",
                table: "Vouchers");

            migrationBuilder.DropColumn(
                name: "SchemeName",
                table: "SavingInterestSettings");

            migrationBuilder.DropColumn(
                name: "AadhaarDocPath",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "PanDocPath",
                table: "Members");

            migrationBuilder.DropColumn(
                name: "LedgerNameEnglish",
                table: "Ledgers");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "DINNo",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "Remarks",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "TermYear",
                table: "CommitteeMembers");

            migrationBuilder.DropColumn(
                name: "DefaultCashLedgerID",
                table: "Branches");

            migrationBuilder.DropColumn(
                name: "GroupCode",
                table: "AccountGroups");

            migrationBuilder.DropColumn(
                name: "GroupNameEnglish",
                table: "AccountGroups");

            migrationBuilder.AlterColumn<string>(
                name: "AadhaarNo",
                table: "Members",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(12)",
                oldMaxLength: 12,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Members_AadhaarNo",
                table: "Members",
                column: "AadhaarNo",
                unique: true);
        }
    }
}

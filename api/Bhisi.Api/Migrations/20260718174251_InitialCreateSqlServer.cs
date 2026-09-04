using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreateSqlServer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AccountGroups",
                columns: table => new
                {
                    GroupID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GroupName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ParentGroupID = table.Column<int>(type: "int", nullable: true),
                    NatureOfGroup = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountGroups", x => x.GroupID);
                    table.ForeignKey(
                        name: "FK_AccountGroups_AccountGroups_ParentGroupID",
                        column: x => x.ParentGroupID,
                        principalTable: "AccountGroups",
                        principalColumn: "GroupID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Branches",
                columns: table => new
                {
                    BranchID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    BranchName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    IFSCCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Branches", x => x.BranchID);
                });

            migrationBuilder.CreateTable(
                name: "BranchMasters",
                columns: table => new
                {
                    BranchID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BranchName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    City = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    District = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    State = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Pincode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    MobileNo = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchMasters", x => x.BranchID);
                });

            migrationBuilder.CreateTable(
                name: "DepartmentMasters",
                columns: table => new
                {
                    DepartmentID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DepartmentCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DepartmentName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Status = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DepartmentMasters", x => x.DepartmentID);
                });

            migrationBuilder.CreateTable(
                name: "FinancialYears",
                columns: table => new
                {
                    FinancialYearID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    YearCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsClosed = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialYears", x => x.FinancialYearID);
                });

            migrationBuilder.CreateTable(
                name: "LoanRates",
                columns: table => new
                {
                    LoanRateID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    LoanCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LoanLedgerID = table.Column<int>(type: "int", nullable: true),
                    InterestLedgerID = table.Column<int>(type: "int", nullable: true),
                    OverdueInterestLedgerID = table.Column<int>(type: "int", nullable: true),
                    ReceivableInterestLedgerID = table.Column<int>(type: "int", nullable: true),
                    SurchargeLedgerID = table.Column<int>(type: "int", nullable: true),
                    RecoveryFeeLedgerID = table.Column<int>(type: "int", nullable: true),
                    ProcessingFeeLedgerID = table.Column<int>(type: "int", nullable: true),
                    InterestRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OverdueInterestRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestPostingType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    InterestCalculationMethod = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ShortName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    InstallmentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    InstallmentCount = table.Column<int>(type: "int", nullable: false),
                    LoanInstallmentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SecurityType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsCcOrOd = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanRates", x => x.LoanRateID);
                });

            migrationBuilder.CreateTable(
                name: "NpaClassificationRuns",
                columns: table => new
                {
                    NpaClassificationRunID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RunDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TriggeredBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RecordsProcessed = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NpaClassificationRuns", x => x.NpaClassificationRunID);
                });

            migrationBuilder.CreateTable(
                name: "NpaConfigs",
                columns: table => new
                {
                    FinancialYear = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ConcessionPeriodDays = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NpaConfigs", x => x.FinancialYear);
                });

            migrationBuilder.CreateTable(
                name: "NpaProvisionSlabs",
                columns: table => new
                {
                    NpaProvisionSlabID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FinancialYear = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SecurityType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OverdueOrOutOfOrderMonthsFrom = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OverdueOrOutOfOrderMonthsTo = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NpaMonthsFrom = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NpaMonthsTo = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MinProvisionPercent = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NpaProvisionSlabs", x => x.NpaProvisionSlabID);
                });

            migrationBuilder.CreateTable(
                name: "PigmyAccountSequences",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    LastSequenceNumber = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyAccountSequences", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "PigmyAgents",
                columns: table => new
                {
                    PigmyAgentID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    MobileNo = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyAgents", x => x.PigmyAgentID);
                });

            migrationBuilder.CreateTable(
                name: "PigmySchemes",
                columns: table => new
                {
                    PigmySchemeID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SchemeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmySchemes", x => x.PigmySchemeID);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    RoleID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.RoleID);
                });

            migrationBuilder.CreateTable(
                name: "SansthaDetails",
                columns: table => new
                {
                    SansthaID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SansthaName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ContactNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RegistrationNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    GSTNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LogoPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsMigrationLocked = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SansthaDetails", x => x.SansthaID);
                });

            migrationBuilder.CreateTable(
                name: "SecurityTypes",
                columns: table => new
                {
                    SecurityTypeID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SecurityTypes", x => x.SecurityTypeID);
                });

            migrationBuilder.CreateTable(
                name: "Ledgers",
                columns: table => new
                {
                    LedgerID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LedgerName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    GroupID = table.Column<int>(type: "int", nullable: false),
                    OpeningBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OpeningBalanceType = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    ReportType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    AccountType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ExcludeFromRule35Swanidhi = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Ledgers", x => x.LedgerID);
                    table.ForeignKey(
                        name: "FK_Ledgers_AccountGroups_GroupID",
                        column: x => x.GroupID,
                        principalTable: "AccountGroups",
                        principalColumn: "GroupID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BranchDayEndStatuses",
                columns: table => new
                {
                    StatusID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    BusinessDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsDayClosed = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BranchDayEndStatuses", x => x.StatusID);
                    table.ForeignKey(
                        name: "FK_BranchDayEndStatuses_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FdAccountSequences",
                columns: table => new
                {
                    SequenceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    ProductType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CurrentValue = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FdAccountSequences", x => x.SequenceID);
                    table.ForeignKey(
                        name: "FK_FdAccountSequences_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FdSchemes",
                columns: table => new
                {
                    FdSchemeID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    SchemeCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SchemeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    SeniorCitizenInterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    InterestType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    InterestPostingMethod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    InterestCompoundingFrequency = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MinimumAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MaximumAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PrematureInterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    EffectiveDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FdSchemes", x => x.FdSchemeID);
                    table.ForeignKey(
                        name: "FK_FdSchemes_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentAccountSequences",
                columns: table => new
                {
                    SequenceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    ProductType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CurrentValue = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentAccountSequences", x => x.SequenceID);
                    table.ForeignKey(
                        name: "FK_InvestmentAccountSequences_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentInstitutions",
                columns: table => new
                {
                    InstitutionID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionMasterID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    InstitutionName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    InstitutionType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    InstitutionBranchName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    ContactPerson = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MobileNumber = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    EmailID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentInstitutions", x => x.InstitutionID);
                    table.ForeignKey(
                        name: "FK_InvestmentInstitutions_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentVoucherMappings",
                columns: table => new
                {
                    MappingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    InvestmentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    InvestmentLedgerID = table.Column<int>(type: "int", nullable: false),
                    InterestIncomeLedgerID = table.Column<int>(type: "int", nullable: false),
                    InterestReceivableLedgerID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentVoucherMappings", x => x.MappingID);
                    table.ForeignKey(
                        name: "FK_InvestmentVoucherMappings_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Members",
                columns: table => new
                {
                    MemberID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    MemberCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OldMemberCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CIFNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    FirstName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MiddleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LastName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Village = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Taluka = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    District = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MobileNo = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    AadhaarNo = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    PANNo = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    JoiningDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NomineeName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PhotoPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    BirthDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Occupation = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SignaturePath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Members", x => x.MemberID);
                    table.ForeignKey(
                        name: "FK_Members_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RdAccountSequences",
                columns: table => new
                {
                    SequenceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    ProductType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CurrentValue = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RdAccountSequences", x => x.SequenceID);
                    table.ForeignKey(
                        name: "FK_RdAccountSequences_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RdSchemes",
                columns: table => new
                {
                    RdSchemeID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    SchemeCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SchemeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    InstallmentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MinimumInstallment = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MaximumInstallment = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    InterestMethod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PenaltyAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    EffectiveDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RdSchemes", x => x.RdSchemeID);
                    table.ForeignKey(
                        name: "FK_RdSchemes_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Vouchers",
                columns: table => new
                {
                    VoucherID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    VoucherNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    VoucherDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    VoucherType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Narration = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ApprovedBy = table.Column<int>(type: "int", nullable: true),
                    ApprovedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vouchers", x => x.VoucherID);
                    table.ForeignKey(
                        name: "FK_Vouchers_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EmployeeBankDetails",
                columns: table => new
                {
                    EmployeeBankDetailID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CIFNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    EmployeeID = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DepartmentID = table.Column<int>(type: "int", nullable: false),
                    JoiningDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EmployeeStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MobileNumber = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    BankName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IFSCCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AccountNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AccountType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmployeeBankDetails", x => x.EmployeeBankDetailID);
                    table.ForeignKey(
                        name: "FK_EmployeeBankDetails_BranchMasters_BranchID",
                        column: x => x.BranchID,
                        principalTable: "BranchMasters",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EmployeeBankDetails_DepartmentMasters_DepartmentID",
                        column: x => x.DepartmentID,
                        principalTable: "DepartmentMasters",
                        principalColumn: "DepartmentID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetCategories",
                columns: table => new
                {
                    CategoryID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    CategoryCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CategoryName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    UsefulLifeMonths = table.Column<int>(type: "int", nullable: false),
                    DepreciationRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    DepreciationMethod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetCategories", x => x.CategoryID);
                    table.ForeignKey(
                        name: "FK_AssetCategories_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetCategories_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingInterestPostings",
                columns: table => new
                {
                    PostingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    PeriodStart = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PeriodEnd = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalInterest = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PostedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PostedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingInterestPostings", x => x.PostingID);
                    table.ForeignKey(
                        name: "FK_SavingInterestPostings_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyCommissionSettings",
                columns: table => new
                {
                    SettingId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentId = table.Column<int>(type: "int", nullable: true),
                    CommissionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CommissionValue = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    CalculationFrequency = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    EffectiveFrom = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EffectiveTo = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyCommissionSettings", x => x.SettingId);
                    table.ForeignKey(
                        name: "FK_PigmyCommissionSettings_PigmyAgents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "PigmyAgents",
                        principalColumn: "PigmyAgentID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    RoleID = table.Column<int>(type: "int", nullable: false),
                    DefaultBranchID = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsLocked = table.Column<bool>(type: "bit", nullable: false),
                    FailedLoginAttempts = table.Column<int>(type: "int", nullable: false),
                    RequirePasswordChange = table.Column<bool>(type: "bit", nullable: false),
                    LastPasswordChangeDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastLoginDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ActiveSessionToken = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MobileNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserID);
                    table.ForeignKey(
                        name: "FK_Users_Branches_DefaultBranchID",
                        column: x => x.DefaultBranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Users_Roles_RoleID",
                        column: x => x.RoleID,
                        principalTable: "Roles",
                        principalColumn: "RoleID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyVoucherMappings",
                columns: table => new
                {
                    MappingId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchId = table.Column<int>(type: "int", nullable: false),
                    CollectionSource = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DebitLedgerId = table.Column<int>(type: "int", nullable: false),
                    CreditLedgerId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyVoucherMappings", x => x.MappingId);
                    table.ForeignKey(
                        name: "FK_PigmyVoucherMappings_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyVoucherMappings_Ledgers_CreditLedgerId",
                        column: x => x.CreditLedgerId,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyVoucherMappings_Ledgers_DebitLedgerId",
                        column: x => x.DebitLedgerId,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingInterestSettings",
                columns: table => new
                {
                    SettingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    CalculationMethod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PostingFrequency = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    EffectiveDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingInterestSettings", x => x.SettingID);
                    table.ForeignKey(
                        name: "FK_SavingInterestSettings_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingVoucherMappings",
                columns: table => new
                {
                    MappingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OperationType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingVoucherMappings", x => x.MappingID);
                    table.ForeignKey(
                        name: "FK_SavingVoucherMappings_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VoucherMappings",
                columns: table => new
                {
                    MappingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TransactionType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DebitLedgerID = table.Column<int>(type: "int", nullable: true),
                    CreditLedgerID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoucherMappings", x => x.MappingID);
                    table.ForeignKey(
                        name: "FK_VoucherMappings_Ledgers_CreditLedgerID",
                        column: x => x.CreditLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VoucherMappings_Ledgers_DebitLedgerID",
                        column: x => x.DebitLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentSchemes",
                columns: table => new
                {
                    SchemeID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    InvestmentInstitutionID = table.Column<int>(type: "int", nullable: false),
                    SchemeCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SchemeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    InterestCalculationMethod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PrematureWithdrawalRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentSchemes", x => x.SchemeID);
                    table.ForeignKey(
                        name: "FK_InvestmentSchemes_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentSchemes_InvestmentInstitutions_InvestmentInstitutionID",
                        column: x => x.InvestmentInstitutionID,
                        principalTable: "InvestmentInstitutions",
                        principalColumn: "InstitutionID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "BorrowerLinkedAccounts",
                columns: table => new
                {
                    BorrowerLinkedAccountID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ParentMemberID = table.Column<int>(type: "int", nullable: false),
                    LinkedMemberID = table.Column<int>(type: "int", nullable: false),
                    LinkType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BorrowerLinkedAccounts", x => x.BorrowerLinkedAccountID);
                    table.ForeignKey(
                        name: "FK_BorrowerLinkedAccounts_Members_LinkedMemberID",
                        column: x => x.LinkedMemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BorrowerLinkedAccounts_Members_ParentMemberID",
                        column: x => x.ParentMemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FdAccounts",
                columns: table => new
                {
                    FdAccountID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    FdSchemeID = table.Column<int>(type: "int", nullable: false),
                    AccountNo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    OpeningDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DepositAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    MaturityDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MaturityAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsLegacyAccount = table.Column<bool>(type: "bit", nullable: false),
                    LegacyAccruedInt = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NomineeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FdAccounts", x => x.FdAccountID);
                    table.ForeignKey(
                        name: "FK_FdAccounts_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdAccounts_FdSchemes_FdSchemeID",
                        column: x => x.FdSchemeID,
                        principalTable: "FdSchemes",
                        principalColumn: "FdSchemeID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdAccounts_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdAccounts_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanApplications",
                columns: table => new
                {
                    LoanApplicationID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ApplicationNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ApplicationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    CoMemberID = table.Column<int>(type: "int", nullable: true),
                    CoMember2ID = table.Column<int>(type: "int", nullable: true),
                    LoanRateID = table.Column<int>(type: "int", nullable: false),
                    RequestedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    InstallmentFrequency = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    InstallmentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NoOfInstallments = table.Column<int>(type: "int", nullable: false),
                    FirstInstallmentDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MaturityDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RecommendedByDirectorID = table.Column<int>(type: "int", nullable: true),
                    Purpose = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Guarantor1MemberID = table.Column<int>(type: "int", nullable: true),
                    Guarantor2MemberID = table.Column<int>(type: "int", nullable: true),
                    SecurityDetails = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SecurityValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LoanAccountNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanApplications", x => x.LoanApplicationID);
                    table.ForeignKey(
                        name: "FK_LoanApplications_LoanRates_LoanRateID",
                        column: x => x.LoanRateID,
                        principalTable: "LoanRates",
                        principalColumn: "LoanRateID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanApplications_Members_CoMember2ID",
                        column: x => x.CoMember2ID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanApplications_Members_CoMemberID",
                        column: x => x.CoMemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanApplications_Members_Guarantor1MemberID",
                        column: x => x.Guarantor1MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanApplications_Members_Guarantor2MemberID",
                        column: x => x.Guarantor2MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanApplications_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanApplications_Members_RecommendedByDirectorID",
                        column: x => x.RecommendedByDirectorID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MemberOpeningBalances",
                columns: table => new
                {
                    MemberOpeningBalanceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BalanceType = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MemberOpeningBalances", x => x.MemberOpeningBalanceID);
                    table.ForeignKey(
                        name: "FK_MemberOpeningBalances_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MemberOpeningBalances_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyAccounts",
                columns: table => new
                {
                    PigmyAccountID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AccountNo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    PigmySchemeID = table.Column<int>(type: "int", nullable: false),
                    PigmyAgentID = table.Column<int>(type: "int", nullable: false),
                    OpeningDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    MaturityDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalDepositedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyAccounts", x => x.PigmyAccountID);
                    table.ForeignKey(
                        name: "FK_PigmyAccounts_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyAccounts_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyAccounts_PigmyAgents_PigmyAgentID",
                        column: x => x.PigmyAgentID,
                        principalTable: "PigmyAgents",
                        principalColumn: "PigmyAgentID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyAccounts_PigmySchemes_PigmySchemeID",
                        column: x => x.PigmySchemeID,
                        principalTable: "PigmySchemes",
                        principalColumn: "PigmySchemeID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingAccountMasters",
                columns: table => new
                {
                    SavingAccountID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    AccountNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    AccountType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OpeningDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsLegacyAccount = table.Column<bool>(type: "bit", nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: false),
                    OpeningBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CurrentBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    MinimumBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ClosingDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NomineeName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    NomineeAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingAccountMasters", x => x.SavingAccountID);
                    table.ForeignKey(
                        name: "FK_SavingAccountMasters_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SavingAccountMasters_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SavingAccountMasters_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShareAccounts",
                columns: table => new
                {
                    ShareAccountId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AccountNo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MemberId = table.Column<int>(type: "int", nullable: false),
                    TotalShareAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalShareCount = table.Column<int>(type: "int", nullable: false),
                    DividendPayableBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OpeningDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShareAccounts", x => x.ShareAccountId);
                    table.ForeignKey(
                        name: "FK_ShareAccounts_Members_MemberId",
                        column: x => x.MemberId,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RdAccounts",
                columns: table => new
                {
                    RdAccountID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    RdSchemeID = table.Column<int>(type: "int", nullable: false),
                    AccountNo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    OpeningDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InstallmentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    MaturityDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MaturityAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalPaidInstallments = table.Column<int>(type: "int", nullable: false),
                    TotalDepositedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsLegacyAccount = table.Column<bool>(type: "bit", nullable: false),
                    LegacyAccruedInt = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NomineeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RdAccounts", x => x.RdAccountID);
                    table.ForeignKey(
                        name: "FK_RdAccounts_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdAccounts_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdAccounts_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdAccounts_RdSchemes_RdSchemeID",
                        column: x => x.RdSchemeID,
                        principalTable: "RdSchemes",
                        principalColumn: "RdSchemeID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetPurchases",
                columns: table => new
                {
                    PurchaseID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    SupplierName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    InvoiceNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    InvoiceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TaxableAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    GstAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentMode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    BankLedgerID = table.Column<int>(type: "int", nullable: true),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    AssetIdsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetPurchases", x => x.PurchaseID);
                    table.ForeignKey(
                        name: "FK_AssetPurchases_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetPurchases_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetPurchases_Ledgers_BankLedgerID",
                        column: x => x.BankLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetPurchases_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyAgentCashDeposits",
                columns: table => new
                {
                    DepositId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentId = table.Column<int>(type: "int", nullable: false),
                    DepositDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReceiptNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Narration = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    VoucherId = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyAgentCashDeposits", x => x.DepositId);
                    table.ForeignKey(
                        name: "FK_PigmyAgentCashDeposits_PigmyAgents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "PigmyAgents",
                        principalColumn: "PigmyAgentID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyAgentCashDeposits_Vouchers_VoucherId",
                        column: x => x.VoucherId,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyAgentCommissions",
                columns: table => new
                {
                    CommissionId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentId = table.Column<int>(type: "int", nullable: false),
                    CalculationFrequency = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PeriodStartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PeriodEndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TotalCollectionAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CalculatedCommission = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    VoucherId = table.Column<int>(type: "int", nullable: true),
                    CalculatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyAgentCommissions", x => x.CommissionId);
                    table.ForeignKey(
                        name: "FK_PigmyAgentCommissions_PigmyAgents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "PigmyAgents",
                        principalColumn: "PigmyAgentID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyAgentCommissions_Vouchers_VoucherId",
                        column: x => x.VoucherId,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VoucherDetails",
                columns: table => new
                {
                    VoucherDetailID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VoucherID = table.Column<int>(type: "int", nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: false),
                    MemberID = table.Column<int>(type: "int", nullable: true),
                    DrCr = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VoucherDetails", x => x.VoucherDetailID);
                    table.ForeignKey(
                        name: "FK_VoucherDetails_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VoucherDetails_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VoucherDetails_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Assets",
                columns: table => new
                {
                    AssetID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    CategoryID = table.Column<int>(type: "int", nullable: false),
                    AssetCode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    AssetName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    PurchaseDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OriginalCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AccumulatedDepreciation = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CurrentBookValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Location = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Custodian = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsOpeningBalance = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Assets", x => x.AssetID);
                    table.ForeignKey(
                        name: "FK_Assets_AssetCategories_CategoryID",
                        column: x => x.CategoryID,
                        principalTable: "AssetCategories",
                        principalColumn: "CategoryID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Assets_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Assets_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserLoginAudits",
                columns: table => new
                {
                    AuditID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserID = table.Column<int>(type: "int", nullable: false),
                    LoginTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LogoutTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IPAddress = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DeviceDetails = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserLoginAudits", x => x.AuditID);
                    table.ForeignKey(
                        name: "FK_UserLoginAudits_Users_UserID",
                        column: x => x.UserID,
                        principalTable: "Users",
                        principalColumn: "UserID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentAccounts",
                columns: table => new
                {
                    InvestmentAccountID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    InvestmentInstitutionID = table.Column<int>(type: "int", nullable: false),
                    SchemeID = table.Column<int>(type: "int", nullable: false),
                    InvestmentNo = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    InvestmentDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PrincipalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    MaturityDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpectedMaturityAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AccruedInterestTillMigration = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BookValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsLegacyAccount = table.Column<bool>(type: "bit", nullable: false),
                    NomineeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    NomineeRelation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentAccounts", x => x.InvestmentAccountID);
                    table.ForeignKey(
                        name: "FK_InvestmentAccounts_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentAccounts_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentAccounts_InvestmentInstitutions_InvestmentInstitutionID",
                        column: x => x.InvestmentInstitutionID,
                        principalTable: "InvestmentInstitutions",
                        principalColumn: "InstitutionID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentAccounts_InvestmentSchemes_SchemeID",
                        column: x => x.SchemeID,
                        principalTable: "InvestmentSchemes",
                        principalColumn: "SchemeID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FdInterestAccruals",
                columns: table => new
                {
                    AccrualID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    FdAccountID = table.Column<int>(type: "int", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: false),
                    AccrualDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CalculatedDays = table.Column<int>(type: "int", nullable: false),
                    InterestAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsPosted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FdInterestAccruals", x => x.AccrualID);
                    table.ForeignKey(
                        name: "FK_FdInterestAccruals_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdInterestAccruals_FdAccounts_FdAccountID",
                        column: x => x.FdAccountID,
                        principalTable: "FdAccounts",
                        principalColumn: "FdAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdInterestAccruals_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdInterestAccruals_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FdTransactions",
                columns: table => new
                {
                    FdTransactionID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    FdAccountID = table.Column<int>(type: "int", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DebitCredit = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FdTransactions", x => x.FdTransactionID);
                    table.ForeignKey(
                        name: "FK_FdTransactions_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdTransactions_FdAccounts_FdAccountID",
                        column: x => x.FdAccountID,
                        principalTable: "FdAccounts",
                        principalColumn: "FdAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdTransactions_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FdTransactions_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanAccounts",
                columns: table => new
                {
                    LoanAccountID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    LoanApplicationID = table.Column<int>(type: "int", nullable: true),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    CoMemberID = table.Column<int>(type: "int", nullable: true),
                    CoMember2ID = table.Column<int>(type: "int", nullable: true),
                    LoanRateID = table.Column<int>(type: "int", nullable: false),
                    LoanAccountNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PrincipalBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OverdueInterestBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OpeningDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LoanDisbursementDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SanctionedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DurationMonths = table.Column<int>(type: "int", nullable: false),
                    InstallmentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    FirstInstallmentDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MaturityDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    InstallmentFrequency = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LastInstallmentPaidDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NoOfInstallments = table.Column<int>(type: "int", nullable: false),
                    RecommendedByDirectorID = table.Column<int>(type: "int", nullable: true),
                    Guarantor1MemberID = table.Column<int>(type: "int", nullable: true),
                    Guarantor2MemberID = table.Column<int>(type: "int", nullable: true),
                    SecurityDetails = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SecurityValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsOpeningBalance = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanAccounts", x => x.LoanAccountID);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_LoanApplications_LoanApplicationID",
                        column: x => x.LoanApplicationID,
                        principalTable: "LoanApplications",
                        principalColumn: "LoanApplicationID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_LoanRates_LoanRateID",
                        column: x => x.LoanRateID,
                        principalTable: "LoanRates",
                        principalColumn: "LoanRateID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_Members_CoMember2ID",
                        column: x => x.CoMember2ID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_Members_CoMemberID",
                        column: x => x.CoMemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_Members_Guarantor1MemberID",
                        column: x => x.Guarantor1MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_Members_Guarantor2MemberID",
                        column: x => x.Guarantor2MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccounts_Members_RecommendedByDirectorID",
                        column: x => x.RecommendedByDirectorID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyCollections",
                columns: table => new
                {
                    CollectionId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PigmyAccountId = table.Column<int>(type: "int", nullable: false),
                    AgentId = table.Column<int>(type: "int", nullable: false),
                    CollectionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OpeningBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CollectionAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ClosingBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReceiptNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CollectionSource = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ImportBatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SyncReferenceId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsVoucherGenerated = table.Column<bool>(type: "bit", nullable: false),
                    VoucherId = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyCollections", x => x.CollectionId);
                    table.ForeignKey(
                        name: "FK_PigmyCollections_PigmyAccounts_PigmyAccountId",
                        column: x => x.PigmyAccountId,
                        principalTable: "PigmyAccounts",
                        principalColumn: "PigmyAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyCollections_PigmyAgents_AgentId",
                        column: x => x.AgentId,
                        principalTable: "PigmyAgents",
                        principalColumn: "PigmyAgentID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyCollections_Vouchers_VoucherId",
                        column: x => x.VoucherId,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyInterestLogs",
                columns: table => new
                {
                    LogId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PigmyAccountId = table.Column<int>(type: "int", nullable: false),
                    CalculationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PeriodStartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PeriodEndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InterestAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherId = table.Column<int>(type: "int", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyInterestLogs", x => x.LogId);
                    table.ForeignKey(
                        name: "FK_PigmyInterestLogs_PigmyAccounts_PigmyAccountId",
                        column: x => x.PigmyAccountId,
                        principalTable: "PigmyAccounts",
                        principalColumn: "PigmyAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PigmyInterestLogs_Vouchers_VoucherId",
                        column: x => x.VoucherId,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyOpeningBalances",
                columns: table => new
                {
                    PigmyOpeningBalanceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PigmyAccountID = table.Column<int>(type: "int", nullable: false),
                    FinancialYear = table.Column<string>(type: "nvarchar(9)", maxLength: 9, nullable: false),
                    AsOfDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MigratedBalanceAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MigrationRemarks = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsPostedToLedger = table.Column<bool>(type: "bit", nullable: false),
                    MigratedBy = table.Column<int>(type: "int", nullable: false),
                    MigratedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyOpeningBalances", x => x.PigmyOpeningBalanceID);
                    table.ForeignKey(
                        name: "FK_PigmyOpeningBalances_PigmyAccounts_PigmyAccountID",
                        column: x => x.PigmyAccountID,
                        principalTable: "PigmyAccounts",
                        principalColumn: "PigmyAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PigmyTransactions",
                columns: table => new
                {
                    PigmyTransactionID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PigmyAccountID = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ValueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DrAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CrAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BalanceAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Narration = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ReferenceId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    MakerId = table.Column<int>(type: "int", nullable: false),
                    PostedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PigmyTransactions", x => x.PigmyTransactionID);
                    table.ForeignKey(
                        name: "FK_PigmyTransactions_PigmyAccounts_PigmyAccountID",
                        column: x => x.PigmyAccountID,
                        principalTable: "PigmyAccounts",
                        principalColumn: "PigmyAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingAccountClosings",
                columns: table => new
                {
                    ClosingID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SavingAccountID = table.Column<int>(type: "int", nullable: false),
                    ClosureDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    GrossBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ClosingCharges = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NetPayable = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentMode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    VoucherNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingAccountClosings", x => x.ClosingID);
                    table.ForeignKey(
                        name: "FK_SavingAccountClosings_SavingAccountMasters_SavingAccountID",
                        column: x => x.SavingAccountID,
                        principalTable: "SavingAccountMasters",
                        principalColumn: "SavingAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingAccountJointHolders",
                columns: table => new
                {
                    JointHolderID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SavingAccountID = table.Column<int>(type: "int", nullable: false),
                    MemberID = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingAccountJointHolders", x => x.JointHolderID);
                    table.ForeignKey(
                        name: "FK_SavingAccountJointHolders_Members_MemberID",
                        column: x => x.MemberID,
                        principalTable: "Members",
                        principalColumn: "MemberID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SavingAccountJointHolders_SavingAccountMasters_SavingAccountID",
                        column: x => x.SavingAccountID,
                        principalTable: "SavingAccountMasters",
                        principalColumn: "SavingAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingTransactions",
                columns: table => new
                {
                    TransactionID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SavingAccountID = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PaymentMode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BalanceAfterTxn = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Narration = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    VoucherNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsPrintedOnPassbook = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingTransactions", x => x.TransactionID);
                    table.ForeignKey(
                        name: "FK_SavingTransactions_SavingAccountMasters_SavingAccountID",
                        column: x => x.SavingAccountID,
                        principalTable: "SavingAccountMasters",
                        principalColumn: "SavingAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DividendDistributions",
                columns: table => new
                {
                    DividendId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShareAccountId = table.Column<int>(type: "int", nullable: false),
                    FinancialYear = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DividendPercentage = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    DividendAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PayoutDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsPaid = table.Column<bool>(type: "bit", nullable: false),
                    VoucherId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DividendDistributions", x => x.DividendId);
                    table.ForeignKey(
                        name: "FK_DividendDistributions_ShareAccounts_ShareAccountId",
                        column: x => x.ShareAccountId,
                        principalTable: "ShareAccounts",
                        principalColumn: "ShareAccountId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DividendDistributions_Vouchers_VoucherId",
                        column: x => x.VoucherId,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShareCertificates",
                columns: table => new
                {
                    CertificateId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShareAccountId = table.Column<int>(type: "int", nullable: false),
                    CertificateNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IssueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FromShareNo = table.Column<long>(type: "bigint", nullable: false),
                    ToShareNo = table.Column<long>(type: "bigint", nullable: false),
                    NumberOfShares = table.Column<int>(type: "int", nullable: false),
                    FaceValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PrintCount = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<int>(type: "int", nullable: true),
                    ModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancellationReason = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShareCertificates", x => x.CertificateId);
                    table.ForeignKey(
                        name: "FK_ShareCertificates_ShareAccounts_ShareAccountId",
                        column: x => x.ShareAccountId,
                        principalTable: "ShareAccounts",
                        principalColumn: "ShareAccountId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShareTransactions",
                columns: table => new
                {
                    TransactionId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShareAccountId = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NumberOfShares = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Narration = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    VoucherId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShareTransactions", x => x.TransactionId);
                    table.ForeignKey(
                        name: "FK_ShareTransactions_ShareAccounts_ShareAccountId",
                        column: x => x.ShareAccountId,
                        principalTable: "ShareAccounts",
                        principalColumn: "ShareAccountId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ShareTransactions_Vouchers_VoucherId",
                        column: x => x.VoucherId,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RdInterestAccruals",
                columns: table => new
                {
                    AccrualID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    RdAccountID = table.Column<int>(type: "int", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: false),
                    AccrualDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InterestAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsPosted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RdInterestAccruals", x => x.AccrualID);
                    table.ForeignKey(
                        name: "FK_RdInterestAccruals_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdInterestAccruals_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdInterestAccruals_RdAccounts_RdAccountID",
                        column: x => x.RdAccountID,
                        principalTable: "RdAccounts",
                        principalColumn: "RdAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdInterestAccruals_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RdTransactions",
                columns: table => new
                {
                    RdTransactionID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    RdAccountID = table.Column<int>(type: "int", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    InstallmentNo = table.Column<int>(type: "int", nullable: true),
                    DebitCredit = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    PrincipalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PenaltyAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RdTransactions", x => x.RdTransactionID);
                    table.ForeignKey(
                        name: "FK_RdTransactions_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdTransactions_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdTransactions_RdAccounts_RdAccountID",
                        column: x => x.RdAccountID,
                        principalTable: "RdAccounts",
                        principalColumn: "RdAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RdTransactions_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetAllocations",
                columns: table => new
                {
                    AllocationID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    AssetID = table.Column<int>(type: "int", nullable: false),
                    AllocatedBranchID = table.Column<int>(type: "int", nullable: false),
                    AllocationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Department = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CustodianName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetAllocations", x => x.AllocationID);
                    table.ForeignKey(
                        name: "FK_AssetAllocations_Assets_AssetID",
                        column: x => x.AssetID,
                        principalTable: "Assets",
                        principalColumn: "AssetID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetAllocations_Branches_AllocatedBranchID",
                        column: x => x.AllocatedBranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetAllocations_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetAllocations_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetDepreciations",
                columns: table => new
                {
                    DepreciationID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    AssetID = table.Column<int>(type: "int", nullable: false),
                    CalculationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Method = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Rate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    DepreciationAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BookValueBefore = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BookValueAfter = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetDepreciations", x => x.DepreciationID);
                    table.ForeignKey(
                        name: "FK_AssetDepreciations_Assets_AssetID",
                        column: x => x.AssetID,
                        principalTable: "Assets",
                        principalColumn: "AssetID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetDepreciations_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetDepreciations_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetDepreciations_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetDisposals",
                columns: table => new
                {
                    DisposalID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    AssetID = table.Column<int>(type: "int", nullable: false),
                    DisposalDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DisposalType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    BookValueAtDisposal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SaleAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ProfitOrLoss = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BuyerName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetDisposals", x => x.DisposalID);
                    table.ForeignKey(
                        name: "FK_AssetDisposals_Assets_AssetID",
                        column: x => x.AssetID,
                        principalTable: "Assets",
                        principalColumn: "AssetID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetDisposals_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetDisposals_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetDisposals_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetMaintenances",
                columns: table => new
                {
                    MaintenanceID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    AssetID = table.Column<int>(type: "int", nullable: false),
                    MaintenanceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MaintenanceType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ServiceProvider = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Cost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    NextServiceDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetMaintenances", x => x.MaintenanceID);
                    table.ForeignKey(
                        name: "FK_AssetMaintenances_Assets_AssetID",
                        column: x => x.AssetID,
                        principalTable: "Assets",
                        principalColumn: "AssetID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetMaintenances_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetMaintenances_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetMaintenances_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetTransfers",
                columns: table => new
                {
                    TransferID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    AssetID = table.Column<int>(type: "int", nullable: false),
                    FromBranchID = table.Column<int>(type: "int", nullable: false),
                    ToBranchID = table.Column<int>(type: "int", nullable: false),
                    TransferDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FromCustodian = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ToCustodian = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetTransfers", x => x.TransferID);
                    table.ForeignKey(
                        name: "FK_AssetTransfers_Assets_AssetID",
                        column: x => x.AssetID,
                        principalTable: "Assets",
                        principalColumn: "AssetID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetTransfers_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetTransfers_Branches_FromBranchID",
                        column: x => x.FromBranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetTransfers_Branches_ToBranchID",
                        column: x => x.ToBranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetTransfers_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "AssetVerifications",
                columns: table => new
                {
                    VerificationID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    AssetID = table.Column<int>(type: "int", nullable: false),
                    VerificationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AuditorName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PhysicalStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetVerifications", x => x.VerificationID);
                    table.ForeignKey(
                        name: "FK_AssetVerifications_Assets_AssetID",
                        column: x => x.AssetID,
                        principalTable: "Assets",
                        principalColumn: "AssetID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetVerifications_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AssetVerifications_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentInterestAccruals",
                columns: table => new
                {
                    AccrualID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    InvestmentAccountID = table.Column<int>(type: "int", nullable: false),
                    AccrualDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InterestAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    IsPosted = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentInterestAccruals", x => x.AccrualID);
                    table.ForeignKey(
                        name: "FK_InvestmentInterestAccruals_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentInterestAccruals_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentInterestAccruals_InvestmentAccounts_InvestmentAccountID",
                        column: x => x.InvestmentAccountID,
                        principalTable: "InvestmentAccounts",
                        principalColumn: "InvestmentAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentInterestAccruals_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentInterestReceipts",
                columns: table => new
                {
                    ReceiptID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    InvestmentAccountID = table.Column<int>(type: "int", nullable: false),
                    ReceiptDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReceivedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentInterestReceipts", x => x.ReceiptID);
                    table.ForeignKey(
                        name: "FK_InvestmentInterestReceipts_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentInterestReceipts_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentInterestReceipts_InvestmentAccounts_InvestmentAccountID",
                        column: x => x.InvestmentAccountID,
                        principalTable: "InvestmentAccounts",
                        principalColumn: "InvestmentAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentInterestReceipts_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentMaturities",
                columns: table => new
                {
                    MaturityID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    InvestmentAccountID = table.Column<int>(type: "int", nullable: false),
                    MaturityDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PrincipalReceived = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestReceived = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalReceived = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentMaturities", x => x.MaturityID);
                    table.ForeignKey(
                        name: "FK_InvestmentMaturities_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentMaturities_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentMaturities_InvestmentAccounts_InvestmentAccountID",
                        column: x => x.InvestmentAccountID,
                        principalTable: "InvestmentAccounts",
                        principalColumn: "InvestmentAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentMaturities_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentPrematureWithdrawals",
                columns: table => new
                {
                    WithdrawalID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    InvestmentAccountID = table.Column<int>(type: "int", nullable: false),
                    WithdrawalDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PrincipalPaid = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RevisedInterestRate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    InterestPaid = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PenaltyAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NetPayout = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentPrematureWithdrawals", x => x.WithdrawalID);
                    table.ForeignKey(
                        name: "FK_InvestmentPrematureWithdrawals_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentPrematureWithdrawals_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentPrematureWithdrawals_InvestmentAccounts_InvestmentAccountID",
                        column: x => x.InvestmentAccountID,
                        principalTable: "InvestmentAccounts",
                        principalColumn: "InvestmentAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentPrematureWithdrawals_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "InvestmentRenewals",
                columns: table => new
                {
                    RenewalID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InstitutionID = table.Column<int>(type: "int", nullable: false),
                    BranchID = table.Column<int>(type: "int", nullable: false),
                    FinancialYearID = table.Column<int>(type: "int", nullable: false),
                    OldInvestmentAccountID = table.Column<int>(type: "int", nullable: false),
                    NewInvestmentAccountID = table.Column<int>(type: "int", nullable: false),
                    RenewalType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    RenewalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RenewalDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<int>(type: "int", nullable: false),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvestmentRenewals", x => x.RenewalID);
                    table.ForeignKey(
                        name: "FK_InvestmentRenewals_Branches_BranchID",
                        column: x => x.BranchID,
                        principalTable: "Branches",
                        principalColumn: "BranchID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentRenewals_FinancialYears_FinancialYearID",
                        column: x => x.FinancialYearID,
                        principalTable: "FinancialYears",
                        principalColumn: "FinancialYearID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentRenewals_InvestmentAccounts_NewInvestmentAccountID",
                        column: x => x.NewInvestmentAccountID,
                        principalTable: "InvestmentAccounts",
                        principalColumn: "InvestmentAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentRenewals_InvestmentAccounts_OldInvestmentAccountID",
                        column: x => x.OldInvestmentAccountID,
                        principalTable: "InvestmentAccounts",
                        principalColumn: "InvestmentAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InvestmentRenewals_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CollateralComplianceLogs",
                columns: table => new
                {
                    CollateralComplianceLogID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    CollateralType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ValuationDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ValuationValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ValuersCount = table.Column<int>(type: "int", nullable: false),
                    LastInspectionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InsuranceExpiryDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastStockStatementDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsAuditorVerified = table.Column<bool>(type: "bit", nullable: false),
                    IsMarginMaintained = table.Column<bool>(type: "bit", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CollateralComplianceLogs", x => x.CollateralComplianceLogID);
                    table.ForeignKey(
                        name: "FK_CollateralComplianceLogs_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GoldLoanDetails",
                columns: table => new
                {
                    GoldLoanDetailID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    OrnamentName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    GrossWeight = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                    NetWeight = table.Column<decimal>(type: "decimal(18,3)", nullable: false),
                    Purity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    GoldRatePerGram = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    EstimatedValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ImagePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoldLoanDetails", x => x.GoldLoanDetailID);
                    table.ForeignKey(
                        name: "FK_GoldLoanDetails_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanAccountNpaStatuses",
                columns: table => new
                {
                    LoanAccountNpaStatusID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    AsOfDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OverdueDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    OutOfOrderDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SecurityType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OutstandingBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CompliantCollateralValue = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ProvisionRequired = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ProvisionHeld = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsAutoClassified = table.Column<bool>(type: "bit", nullable: false),
                    LastClassificationRunId = table.Column<int>(type: "int", nullable: false),
                    AuditorRemarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanAccountNpaStatuses", x => x.LoanAccountNpaStatusID);
                    table.ForeignKey(
                        name: "FK_LoanAccountNpaStatuses_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanAccountNpaStatuses_NpaClassificationRuns_LastClassificationRunId",
                        column: x => x.LastClassificationRunId,
                        principalTable: "NpaClassificationRuns",
                        principalColumn: "NpaClassificationRunID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanCollections",
                columns: table => new
                {
                    LoanCollectionID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    CollectionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReceiptNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TotalAmountReceived = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SurchargeCollected = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PenaltyInterestCollected = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestCollected = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PrincipalCollected = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentMode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    BankName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ChequeNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BankAccountLedgerID = table.Column<int>(type: "int", nullable: true),
                    TransferFromSavingAccountNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanCollections", x => x.LoanCollectionID);
                    table.ForeignKey(
                        name: "FK_LoanCollections_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanCollections_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanDisbursements",
                columns: table => new
                {
                    LoanDisbursementID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    DisbursementDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SanctionedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DisbursementAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ProcessingFee = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ShareDeduction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InsuranceDeduction = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    StationeryCharges = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OtherDeductions = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NetAmountPaid = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    PaymentMode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    BankName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ChequeNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BankAccountLedgerID = table.Column<int>(type: "int", nullable: true),
                    TransferToSavingAccountNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    LoanInstallmentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanDisbursements", x => x.LoanDisbursementID);
                    table.ForeignKey(
                        name: "FK_LoanDisbursements_Ledgers_BankAccountLedgerID",
                        column: x => x.BankAccountLedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanDisbursements_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanDisbursements_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanDocuments",
                columns: table => new
                {
                    LoanDocumentID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    DocumentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DocumentName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    UploadedDate = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanDocuments", x => x.LoanDocumentID);
                    table.ForeignKey(
                        name: "FK_LoanDocuments_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanInstallmentSchedules",
                columns: table => new
                {
                    ScheduleID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    InstallmentNo = table.Column<int>(type: "int", nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PrincipalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InterestAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    BalanceAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PaidDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    OpeningBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ClosingBalance = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Days = table.Column<int>(type: "int", nullable: false),
                    InterestRate = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanInstallmentSchedules", x => x.ScheduleID);
                    table.ForeignKey(
                        name: "FK_LoanInstallmentSchedules_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OverdueInterestLedgers",
                columns: table => new
                {
                    OverdueInterestLedgerID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DebitAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreditAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    Particulars = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OverdueInterestLedgers", x => x.OverdueInterestLedgerID);
                    table.ForeignKey(
                        name: "FK_OverdueInterestLedgers_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OverdueInterestLedgers_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OverdueRecoveryLedgers",
                columns: table => new
                {
                    OverdueRecoveryLedgerID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanAccountID = table.Column<int>(type: "int", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DebitAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CreditAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VoucherID = table.Column<int>(type: "int", nullable: true),
                    Particulars = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OverdueRecoveryLedgers", x => x.OverdueRecoveryLedgerID);
                    table.ForeignKey(
                        name: "FK_OverdueRecoveryLedgers_LoanAccounts_LoanAccountID",
                        column: x => x.LoanAccountID,
                        principalTable: "LoanAccounts",
                        principalColumn: "LoanAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OverdueRecoveryLedgers_Vouchers_VoucherID",
                        column: x => x.VoucherID,
                        principalTable: "Vouchers",
                        principalColumn: "VoucherID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SavingPassbooks",
                columns: table => new
                {
                    PassbookLogID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SavingAccountID = table.Column<int>(type: "int", nullable: false),
                    TransactionID = table.Column<int>(type: "int", nullable: false),
                    PrintedLineNo = table.Column<int>(type: "int", nullable: false),
                    PrintedPageNo = table.Column<int>(type: "int", nullable: false),
                    PrintedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    PrintedBy = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavingPassbooks", x => x.PassbookLogID);
                    table.ForeignKey(
                        name: "FK_SavingPassbooks_SavingAccountMasters_SavingAccountID",
                        column: x => x.SavingAccountID,
                        principalTable: "SavingAccountMasters",
                        principalColumn: "SavingAccountID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SavingPassbooks_SavingTransactions_TransactionID",
                        column: x => x.TransactionID,
                        principalTable: "SavingTransactions",
                        principalColumn: "TransactionID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ShareCertificatePrintHistories",
                columns: table => new
                {
                    PrintHistoryId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CertificateId = table.Column<int>(type: "int", nullable: false),
                    ActionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PrintedBy = table.Column<int>(type: "int", nullable: false),
                    PrintedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IPAddress = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShareCertificatePrintHistories", x => x.PrintHistoryId);
                    table.ForeignKey(
                        name: "FK_ShareCertificatePrintHistories_ShareCertificates_CertificateId",
                        column: x => x.CertificateId,
                        principalTable: "ShareCertificates",
                        principalColumn: "CertificateId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanCollectionFees",
                columns: table => new
                {
                    LoanCollectionFeeID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanCollectionID = table.Column<int>(type: "int", nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanCollectionFees", x => x.LoanCollectionFeeID);
                    table.ForeignKey(
                        name: "FK_LoanCollectionFees_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanCollectionFees_LoanCollections_LoanCollectionID",
                        column: x => x.LoanCollectionID,
                        principalTable: "LoanCollections",
                        principalColumn: "LoanCollectionID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LoanDisbursementDeductions",
                columns: table => new
                {
                    LoanDisbursementDeductionID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoanDisbursementID = table.Column<int>(type: "int", nullable: false),
                    LedgerID = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanDisbursementDeductions", x => x.LoanDisbursementDeductionID);
                    table.ForeignKey(
                        name: "FK_LoanDisbursementDeductions_Ledgers_LedgerID",
                        column: x => x.LedgerID,
                        principalTable: "Ledgers",
                        principalColumn: "LedgerID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LoanDisbursementDeductions_LoanDisbursements_LoanDisbursementID",
                        column: x => x.LoanDisbursementID,
                        principalTable: "LoanDisbursements",
                        principalColumn: "LoanDisbursementID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountGroups_ParentGroupID",
                table: "AccountGroups",
                column: "ParentGroupID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetAllocations_AllocatedBranchID",
                table: "AssetAllocations",
                column: "AllocatedBranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetAllocations_AssetID",
                table: "AssetAllocations",
                column: "AssetID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetAllocations_BranchID",
                table: "AssetAllocations",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetAllocations_FinancialYearID",
                table: "AssetAllocations",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetCategories_BranchID",
                table: "AssetCategories",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetCategories_FinancialYearID",
                table: "AssetCategories",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDepreciations_AssetID",
                table: "AssetDepreciations",
                column: "AssetID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDepreciations_BranchID",
                table: "AssetDepreciations",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDepreciations_FinancialYearID",
                table: "AssetDepreciations",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDepreciations_VoucherID",
                table: "AssetDepreciations",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDisposals_AssetID",
                table: "AssetDisposals",
                column: "AssetID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDisposals_BranchID",
                table: "AssetDisposals",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDisposals_FinancialYearID",
                table: "AssetDisposals",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetDisposals_VoucherID",
                table: "AssetDisposals",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetMaintenances_AssetID",
                table: "AssetMaintenances",
                column: "AssetID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetMaintenances_BranchID",
                table: "AssetMaintenances",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetMaintenances_FinancialYearID",
                table: "AssetMaintenances",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetMaintenances_VoucherID",
                table: "AssetMaintenances",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetPurchases_BankLedgerID",
                table: "AssetPurchases",
                column: "BankLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetPurchases_BranchID",
                table: "AssetPurchases",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetPurchases_FinancialYearID",
                table: "AssetPurchases",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetPurchases_VoucherID",
                table: "AssetPurchases",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_BranchID",
                table: "Assets",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_CategoryID",
                table: "Assets",
                column: "CategoryID");

            migrationBuilder.CreateIndex(
                name: "IX_Assets_FinancialYearID",
                table: "Assets",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTransfers_AssetID",
                table: "AssetTransfers",
                column: "AssetID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTransfers_BranchID",
                table: "AssetTransfers",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTransfers_FinancialYearID",
                table: "AssetTransfers",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTransfers_FromBranchID",
                table: "AssetTransfers",
                column: "FromBranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTransfers_ToBranchID",
                table: "AssetTransfers",
                column: "ToBranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetVerifications_AssetID",
                table: "AssetVerifications",
                column: "AssetID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetVerifications_BranchID",
                table: "AssetVerifications",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_AssetVerifications_FinancialYearID",
                table: "AssetVerifications",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_BorrowerLinkedAccounts_LinkedMemberID",
                table: "BorrowerLinkedAccounts",
                column: "LinkedMemberID");

            migrationBuilder.CreateIndex(
                name: "IX_BorrowerLinkedAccounts_ParentMemberID",
                table: "BorrowerLinkedAccounts",
                column: "ParentMemberID");

            migrationBuilder.CreateIndex(
                name: "IX_BranchDayEndStatuses_BranchID",
                table: "BranchDayEndStatuses",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_CollateralComplianceLogs_LoanAccountID",
                table: "CollateralComplianceLogs",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_DividendDistributions_ShareAccountId",
                table: "DividendDistributions",
                column: "ShareAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_DividendDistributions_VoucherId",
                table: "DividendDistributions",
                column: "VoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeBankDetails_BranchID",
                table: "EmployeeBankDetails",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeBankDetails_CIFNo",
                table: "EmployeeBankDetails",
                column: "CIFNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeBankDetails_DepartmentID",
                table: "EmployeeBankDetails",
                column: "DepartmentID");

            migrationBuilder.CreateIndex(
                name: "IX_EmployeeBankDetails_EmployeeID",
                table: "EmployeeBankDetails",
                column: "EmployeeID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FdAccounts_BranchID",
                table: "FdAccounts",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_FdAccounts_FdSchemeID",
                table: "FdAccounts",
                column: "FdSchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_FdAccounts_FinancialYearID",
                table: "FdAccounts",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_FdAccounts_MemberID",
                table: "FdAccounts",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_FdAccountSequences_BranchID",
                table: "FdAccountSequences",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_FdInterestAccruals_BranchID",
                table: "FdInterestAccruals",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_FdInterestAccruals_FdAccountID",
                table: "FdInterestAccruals",
                column: "FdAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_FdInterestAccruals_FinancialYearID",
                table: "FdInterestAccruals",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_FdInterestAccruals_VoucherID",
                table: "FdInterestAccruals",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_FdSchemes_BranchID",
                table: "FdSchemes",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_FdTransactions_BranchID",
                table: "FdTransactions",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_FdTransactions_FdAccountID",
                table: "FdTransactions",
                column: "FdAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_FdTransactions_FinancialYearID",
                table: "FdTransactions",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_FdTransactions_VoucherID",
                table: "FdTransactions",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_GoldLoanDetails_LoanAccountID",
                table: "GoldLoanDetails",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentAccounts_BranchID",
                table: "InvestmentAccounts",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentAccounts_FinancialYearID",
                table: "InvestmentAccounts",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentAccounts_InvestmentInstitutionID",
                table: "InvestmentAccounts",
                column: "InvestmentInstitutionID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentAccounts_SchemeID",
                table: "InvestmentAccounts",
                column: "SchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentAccountSequences_BranchID",
                table: "InvestmentAccountSequences",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInstitutions_BranchID",
                table: "InvestmentInstitutions",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInterestAccruals_BranchID",
                table: "InvestmentInterestAccruals",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInterestAccruals_FinancialYearID",
                table: "InvestmentInterestAccruals",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInterestAccruals_InvestmentAccountID",
                table: "InvestmentInterestAccruals",
                column: "InvestmentAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInterestAccruals_VoucherID",
                table: "InvestmentInterestAccruals",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInterestReceipts_BranchID",
                table: "InvestmentInterestReceipts",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInterestReceipts_FinancialYearID",
                table: "InvestmentInterestReceipts",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInterestReceipts_InvestmentAccountID",
                table: "InvestmentInterestReceipts",
                column: "InvestmentAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentInterestReceipts_VoucherID",
                table: "InvestmentInterestReceipts",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentMaturities_BranchID",
                table: "InvestmentMaturities",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentMaturities_FinancialYearID",
                table: "InvestmentMaturities",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentMaturities_InvestmentAccountID",
                table: "InvestmentMaturities",
                column: "InvestmentAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentMaturities_VoucherID",
                table: "InvestmentMaturities",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentPrematureWithdrawals_BranchID",
                table: "InvestmentPrematureWithdrawals",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentPrematureWithdrawals_FinancialYearID",
                table: "InvestmentPrematureWithdrawals",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentPrematureWithdrawals_InvestmentAccountID",
                table: "InvestmentPrematureWithdrawals",
                column: "InvestmentAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentPrematureWithdrawals_VoucherID",
                table: "InvestmentPrematureWithdrawals",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentRenewals_BranchID",
                table: "InvestmentRenewals",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentRenewals_FinancialYearID",
                table: "InvestmentRenewals",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentRenewals_NewInvestmentAccountID",
                table: "InvestmentRenewals",
                column: "NewInvestmentAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentRenewals_OldInvestmentAccountID",
                table: "InvestmentRenewals",
                column: "OldInvestmentAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentRenewals_VoucherID",
                table: "InvestmentRenewals",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentSchemes_BranchID",
                table: "InvestmentSchemes",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentSchemes_InvestmentInstitutionID",
                table: "InvestmentSchemes",
                column: "InvestmentInstitutionID");

            migrationBuilder.CreateIndex(
                name: "IX_InvestmentVoucherMappings_BranchID",
                table: "InvestmentVoucherMappings",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_Ledgers_GroupID",
                table: "Ledgers",
                column: "GroupID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccountNpaStatuses_LastClassificationRunId",
                table: "LoanAccountNpaStatuses",
                column: "LastClassificationRunId");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccountNpaStatuses_LoanAccountID",
                table: "LoanAccountNpaStatuses",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_BranchID",
                table: "LoanAccounts",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_CoMember2ID",
                table: "LoanAccounts",
                column: "CoMember2ID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_CoMemberID",
                table: "LoanAccounts",
                column: "CoMemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_Guarantor1MemberID",
                table: "LoanAccounts",
                column: "Guarantor1MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_Guarantor2MemberID",
                table: "LoanAccounts",
                column: "Guarantor2MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_LoanApplicationID",
                table: "LoanAccounts",
                column: "LoanApplicationID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_LoanRateID",
                table: "LoanAccounts",
                column: "LoanRateID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_MemberID",
                table: "LoanAccounts",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanAccounts_RecommendedByDirectorID",
                table: "LoanAccounts",
                column: "RecommendedByDirectorID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_CoMember2ID",
                table: "LoanApplications",
                column: "CoMember2ID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_CoMemberID",
                table: "LoanApplications",
                column: "CoMemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_Guarantor1MemberID",
                table: "LoanApplications",
                column: "Guarantor1MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_Guarantor2MemberID",
                table: "LoanApplications",
                column: "Guarantor2MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_LoanRateID",
                table: "LoanApplications",
                column: "LoanRateID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_MemberID",
                table: "LoanApplications",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_RecommendedByDirectorID",
                table: "LoanApplications",
                column: "RecommendedByDirectorID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanCollectionFees_LedgerID",
                table: "LoanCollectionFees",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanCollectionFees_LoanCollectionID",
                table: "LoanCollectionFees",
                column: "LoanCollectionID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanCollections_LoanAccountID",
                table: "LoanCollections",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanCollections_VoucherID",
                table: "LoanCollections",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanDisbursementDeductions_LedgerID",
                table: "LoanDisbursementDeductions",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanDisbursementDeductions_LoanDisbursementID",
                table: "LoanDisbursementDeductions",
                column: "LoanDisbursementID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanDisbursements_BankAccountLedgerID",
                table: "LoanDisbursements",
                column: "BankAccountLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanDisbursements_LoanAccountID",
                table: "LoanDisbursements",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanDisbursements_VoucherID",
                table: "LoanDisbursements",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanDocuments_LoanAccountID",
                table: "LoanDocuments",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_LoanInstallmentSchedules_LoanAccountID",
                table: "LoanInstallmentSchedules",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_MemberOpeningBalances_LedgerID",
                table: "MemberOpeningBalances",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_MemberOpeningBalances_MemberID",
                table: "MemberOpeningBalances",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_Members_AadhaarNo",
                table: "Members",
                column: "AadhaarNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Members_BranchID",
                table: "Members",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_Members_MemberCode",
                table: "Members",
                column: "MemberCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Members_MobileNo",
                table: "Members",
                column: "MobileNo");

            migrationBuilder.CreateIndex(
                name: "IX_Members_Village",
                table: "Members",
                column: "Village");

            migrationBuilder.CreateIndex(
                name: "IX_OverdueInterestLedgers_LoanAccountID",
                table: "OverdueInterestLedgers",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_OverdueInterestLedgers_VoucherID",
                table: "OverdueInterestLedgers",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_OverdueRecoveryLedgers_LoanAccountID",
                table: "OverdueRecoveryLedgers",
                column: "LoanAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_OverdueRecoveryLedgers_VoucherID",
                table: "OverdueRecoveryLedgers",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAccounts_BranchID",
                table: "PigmyAccounts",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAccounts_MemberID",
                table: "PigmyAccounts",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAccounts_PigmyAgentID",
                table: "PigmyAccounts",
                column: "PigmyAgentID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAccounts_PigmySchemeID",
                table: "PigmyAccounts",
                column: "PigmySchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgentCashDeposits_AgentId",
                table: "PigmyAgentCashDeposits",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgentCashDeposits_VoucherId",
                table: "PigmyAgentCashDeposits",
                column: "VoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgentCommissions_AgentId",
                table: "PigmyAgentCommissions",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyAgentCommissions_VoucherId",
                table: "PigmyAgentCommissions",
                column: "VoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyCollections_AgentId",
                table: "PigmyCollections",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyCollections_PigmyAccountId_CollectionDate",
                table: "PigmyCollections",
                columns: new[] { "PigmyAccountId", "CollectionDate" },
                unique: true,
                filter: "[CollectionSource] IN ('MANUAL', 'IMPORT')");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyCollections_VoucherId",
                table: "PigmyCollections",
                column: "VoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyCommissionSettings_AgentId",
                table: "PigmyCommissionSettings",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyInterestLogs_PigmyAccountId",
                table: "PigmyInterestLogs",
                column: "PigmyAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyInterestLogs_VoucherId",
                table: "PigmyInterestLogs",
                column: "VoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyOpeningBalances_PigmyAccountID",
                table: "PigmyOpeningBalances",
                column: "PigmyAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyTransactions_PigmyAccountID",
                table: "PigmyTransactions",
                column: "PigmyAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyVoucherMappings_BranchId",
                table: "PigmyVoucherMappings",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyVoucherMappings_CreditLedgerId",
                table: "PigmyVoucherMappings",
                column: "CreditLedgerId");

            migrationBuilder.CreateIndex(
                name: "IX_PigmyVoucherMappings_DebitLedgerId",
                table: "PigmyVoucherMappings",
                column: "DebitLedgerId");

            migrationBuilder.CreateIndex(
                name: "IX_RdAccounts_BranchID",
                table: "RdAccounts",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_RdAccounts_FinancialYearID",
                table: "RdAccounts",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_RdAccounts_MemberID",
                table: "RdAccounts",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_RdAccounts_RdSchemeID",
                table: "RdAccounts",
                column: "RdSchemeID");

            migrationBuilder.CreateIndex(
                name: "IX_RdAccountSequences_BranchID",
                table: "RdAccountSequences",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_RdInterestAccruals_BranchID",
                table: "RdInterestAccruals",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_RdInterestAccruals_FinancialYearID",
                table: "RdInterestAccruals",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_RdInterestAccruals_RdAccountID",
                table: "RdInterestAccruals",
                column: "RdAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_RdInterestAccruals_VoucherID",
                table: "RdInterestAccruals",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_RdSchemes_BranchID",
                table: "RdSchemes",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_RdTransactions_BranchID",
                table: "RdTransactions",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_RdTransactions_FinancialYearID",
                table: "RdTransactions",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_RdTransactions_RdAccountID",
                table: "RdTransactions",
                column: "RdAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_RdTransactions_VoucherID",
                table: "RdTransactions",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountClosings_SavingAccountID",
                table: "SavingAccountClosings",
                column: "SavingAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountJointHolders_MemberID",
                table: "SavingAccountJointHolders",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountJointHolders_SavingAccountID",
                table: "SavingAccountJointHolders",
                column: "SavingAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountMasters_BranchID",
                table: "SavingAccountMasters",
                column: "BranchID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountMasters_LedgerID",
                table: "SavingAccountMasters",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingAccountMasters_MemberID",
                table: "SavingAccountMasters",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingInterestPostings_FinancialYearID",
                table: "SavingInterestPostings",
                column: "FinancialYearID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingInterestSettings_LedgerID",
                table: "SavingInterestSettings",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingPassbooks_SavingAccountID",
                table: "SavingPassbooks",
                column: "SavingAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingPassbooks_TransactionID",
                table: "SavingPassbooks",
                column: "TransactionID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingTransactions_SavingAccountID",
                table: "SavingTransactions",
                column: "SavingAccountID");

            migrationBuilder.CreateIndex(
                name: "IX_SavingVoucherMappings_LedgerID",
                table: "SavingVoucherMappings",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_ShareAccounts_MemberId",
                table: "ShareAccounts",
                column: "MemberId");

            migrationBuilder.CreateIndex(
                name: "IX_ShareCertificatePrintHistories_CertificateId",
                table: "ShareCertificatePrintHistories",
                column: "CertificateId");

            migrationBuilder.CreateIndex(
                name: "IX_ShareCertificates_ShareAccountId",
                table: "ShareCertificates",
                column: "ShareAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ShareTransactions_ShareAccountId",
                table: "ShareTransactions",
                column: "ShareAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ShareTransactions_VoucherId",
                table: "ShareTransactions",
                column: "VoucherId");

            migrationBuilder.CreateIndex(
                name: "IX_UserLoginAudits_UserID",
                table: "UserLoginAudits",
                column: "UserID");

            migrationBuilder.CreateIndex(
                name: "IX_Users_DefaultBranchID",
                table: "Users",
                column: "DefaultBranchID");

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleID",
                table: "Users",
                column: "RoleID");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherDetails_LedgerID",
                table: "VoucherDetails",
                column: "LedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherDetails_MemberID",
                table: "VoucherDetails",
                column: "MemberID");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherDetails_VoucherID",
                table: "VoucherDetails",
                column: "VoucherID");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherMappings_CreditLedgerID",
                table: "VoucherMappings",
                column: "CreditLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_VoucherMappings_DebitLedgerID",
                table: "VoucherMappings",
                column: "DebitLedgerID");

            migrationBuilder.CreateIndex(
                name: "IX_Vouchers_BranchID",
                table: "Vouchers",
                column: "BranchID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AssetAllocations");

            migrationBuilder.DropTable(
                name: "AssetDepreciations");

            migrationBuilder.DropTable(
                name: "AssetDisposals");

            migrationBuilder.DropTable(
                name: "AssetMaintenances");

            migrationBuilder.DropTable(
                name: "AssetPurchases");

            migrationBuilder.DropTable(
                name: "AssetTransfers");

            migrationBuilder.DropTable(
                name: "AssetVerifications");

            migrationBuilder.DropTable(
                name: "BorrowerLinkedAccounts");

            migrationBuilder.DropTable(
                name: "BranchDayEndStatuses");

            migrationBuilder.DropTable(
                name: "CollateralComplianceLogs");

            migrationBuilder.DropTable(
                name: "DividendDistributions");

            migrationBuilder.DropTable(
                name: "EmployeeBankDetails");

            migrationBuilder.DropTable(
                name: "FdAccountSequences");

            migrationBuilder.DropTable(
                name: "FdInterestAccruals");

            migrationBuilder.DropTable(
                name: "FdTransactions");

            migrationBuilder.DropTable(
                name: "GoldLoanDetails");

            migrationBuilder.DropTable(
                name: "InvestmentAccountSequences");

            migrationBuilder.DropTable(
                name: "InvestmentInterestAccruals");

            migrationBuilder.DropTable(
                name: "InvestmentInterestReceipts");

            migrationBuilder.DropTable(
                name: "InvestmentMaturities");

            migrationBuilder.DropTable(
                name: "InvestmentPrematureWithdrawals");

            migrationBuilder.DropTable(
                name: "InvestmentRenewals");

            migrationBuilder.DropTable(
                name: "InvestmentVoucherMappings");

            migrationBuilder.DropTable(
                name: "LoanAccountNpaStatuses");

            migrationBuilder.DropTable(
                name: "LoanCollectionFees");

            migrationBuilder.DropTable(
                name: "LoanDisbursementDeductions");

            migrationBuilder.DropTable(
                name: "LoanDocuments");

            migrationBuilder.DropTable(
                name: "LoanInstallmentSchedules");

            migrationBuilder.DropTable(
                name: "MemberOpeningBalances");

            migrationBuilder.DropTable(
                name: "NpaConfigs");

            migrationBuilder.DropTable(
                name: "NpaProvisionSlabs");

            migrationBuilder.DropTable(
                name: "OverdueInterestLedgers");

            migrationBuilder.DropTable(
                name: "OverdueRecoveryLedgers");

            migrationBuilder.DropTable(
                name: "PigmyAccountSequences");

            migrationBuilder.DropTable(
                name: "PigmyAgentCashDeposits");

            migrationBuilder.DropTable(
                name: "PigmyAgentCommissions");

            migrationBuilder.DropTable(
                name: "PigmyCollections");

            migrationBuilder.DropTable(
                name: "PigmyCommissionSettings");

            migrationBuilder.DropTable(
                name: "PigmyInterestLogs");

            migrationBuilder.DropTable(
                name: "PigmyOpeningBalances");

            migrationBuilder.DropTable(
                name: "PigmyTransactions");

            migrationBuilder.DropTable(
                name: "PigmyVoucherMappings");

            migrationBuilder.DropTable(
                name: "RdAccountSequences");

            migrationBuilder.DropTable(
                name: "RdInterestAccruals");

            migrationBuilder.DropTable(
                name: "RdTransactions");

            migrationBuilder.DropTable(
                name: "SansthaDetails");

            migrationBuilder.DropTable(
                name: "SavingAccountClosings");

            migrationBuilder.DropTable(
                name: "SavingAccountJointHolders");

            migrationBuilder.DropTable(
                name: "SavingInterestPostings");

            migrationBuilder.DropTable(
                name: "SavingInterestSettings");

            migrationBuilder.DropTable(
                name: "SavingPassbooks");

            migrationBuilder.DropTable(
                name: "SavingVoucherMappings");

            migrationBuilder.DropTable(
                name: "SecurityTypes");

            migrationBuilder.DropTable(
                name: "ShareCertificatePrintHistories");

            migrationBuilder.DropTable(
                name: "ShareTransactions");

            migrationBuilder.DropTable(
                name: "UserLoginAudits");

            migrationBuilder.DropTable(
                name: "VoucherDetails");

            migrationBuilder.DropTable(
                name: "VoucherMappings");

            migrationBuilder.DropTable(
                name: "Assets");

            migrationBuilder.DropTable(
                name: "BranchMasters");

            migrationBuilder.DropTable(
                name: "DepartmentMasters");

            migrationBuilder.DropTable(
                name: "FdAccounts");

            migrationBuilder.DropTable(
                name: "InvestmentAccounts");

            migrationBuilder.DropTable(
                name: "NpaClassificationRuns");

            migrationBuilder.DropTable(
                name: "LoanCollections");

            migrationBuilder.DropTable(
                name: "LoanDisbursements");

            migrationBuilder.DropTable(
                name: "PigmyAccounts");

            migrationBuilder.DropTable(
                name: "RdAccounts");

            migrationBuilder.DropTable(
                name: "SavingTransactions");

            migrationBuilder.DropTable(
                name: "ShareCertificates");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "AssetCategories");

            migrationBuilder.DropTable(
                name: "FdSchemes");

            migrationBuilder.DropTable(
                name: "InvestmentSchemes");

            migrationBuilder.DropTable(
                name: "LoanAccounts");

            migrationBuilder.DropTable(
                name: "Vouchers");

            migrationBuilder.DropTable(
                name: "PigmyAgents");

            migrationBuilder.DropTable(
                name: "PigmySchemes");

            migrationBuilder.DropTable(
                name: "RdSchemes");

            migrationBuilder.DropTable(
                name: "SavingAccountMasters");

            migrationBuilder.DropTable(
                name: "ShareAccounts");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "FinancialYears");

            migrationBuilder.DropTable(
                name: "InvestmentInstitutions");

            migrationBuilder.DropTable(
                name: "LoanApplications");

            migrationBuilder.DropTable(
                name: "Ledgers");

            migrationBuilder.DropTable(
                name: "LoanRates");

            migrationBuilder.DropTable(
                name: "Members");

            migrationBuilder.DropTable(
                name: "AccountGroups");

            migrationBuilder.DropTable(
                name: "Branches");
        }
    }
}

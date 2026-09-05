using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Helpers;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/bhisi-erp-log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    Log.Information("Starting web application");
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog();

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.Limits.MaxRequestBodySize = 524288000; // 500 MB
});

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 524288000; // 500 MB
});

// Add services to the container.
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    options.JsonSerializerOptions.Converters.Add(new SafeNullableDateTimeConverter());
    options.JsonSerializerOptions.Converters.Add(new SafeDateTimeConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Global Authorization — सर्व API ला login आवश्यक (AllowAnonymous ने override करता येतो)
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// Configure JWT Authentication
var keyStr = builder.Configuration["Jwt:Key"] ?? "super_secret_key_for_bhisi_software_backend_12345!@#";
var key = System.Text.Encoding.ASCII.GetBytes(keyStr);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

// Configure Entity Framework with Smart SQL Server Auto-Discovery
var rawConnStr = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=.;Database=SmartBanking_Gurudev;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;Connect Timeout=60;";

var resolvedConnStr = ResolveWorkingConnectionString(rawConnStr);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(
        resolvedConnStr,
        sqlServerOptionsAction: sqlOptions =>
        {
            sqlOptions.CommandTimeout(60);
        })
        .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

// Register Services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<Bhisi.Api.Services.IAgentLockService, Bhisi.Api.Services.AgentLockService>();
builder.Services.AddScoped<Bhisi.Api.Services.IPigmySyncService, Bhisi.Api.Services.PigmySyncService>();
builder.Services.AddScoped<Bhisi.Api.Services.NpaEngineService>();
builder.Services.AddScoped<Bhisi.Api.Services.IEodBodService, Bhisi.Api.Services.EodBodService>();
builder.Services.AddScoped<Bhisi.Api.Services.IYearEndService, Bhisi.Api.Services.YearEndService>();
builder.Services.AddScoped<Bhisi.Api.Services.IBackupService, Bhisi.Api.Services.BackupService>();
builder.Services.AddScoped<Bhisi.Api.Services.INotificationEngineService, Bhisi.Api.Services.NotificationEngineService>();
builder.Services.AddSingleton<Bhisi.Api.Services.ILicenseService, Bhisi.Api.Services.LicenseService>();
builder.Services.AddScoped<Bhisi.Api.Services.ISystemUpdateService, Bhisi.Api.Services.SystemUpdateService>();

// Configure CORS for React client
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

var app = builder.Build();

// Automatically apply database migrations and schema on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    // Check if core tables exist (Users, Branches, Roles)
    bool tablesExist = false;
    try
    {
        var count = db.Database.SqlQueryRaw<int>("SELECT COUNT(*) as Value FROM sys.tables WHERE name IN ('Users', 'Branches', 'Roles')").AsEnumerable().FirstOrDefault();
        tablesExist = count >= 3;
    }
    catch { }

    if (!tablesExist)
    {
        Log.Information("Core tables not found in database. Initializing database schema...");
        
        // 1. Try applying Full Deploy SQL file if present in app directory
        string[] candidateSqlPaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "SmartBanking_Clean_Master_Deploy.sql"),
            Path.Combine(Directory.GetCurrentDirectory(), "SmartBanking_Clean_Master_Deploy.sql"),
            Path.Combine(AppContext.BaseDirectory, "SmartBanking_Gurudev_Full_Deploy.sql"),
            Path.Combine(Directory.GetCurrentDirectory(), "SmartBanking_Gurudev_Full_Deploy.sql")
        };

        foreach (var sqlPath in candidateSqlPaths)
        {
            if (File.Exists(sqlPath))
            {
                try
                {
                    string fullSql = File.ReadAllText(sqlPath);
                    var batches = System.Text.RegularExpressions.Regex.Split(fullSql, @"(?im)^\s*GO\s*$", System.Text.RegularExpressions.RegexOptions.Multiline);
                    foreach (var batch in batches)
                    {
                        var trimmed = batch.Trim();
                        if (!string.IsNullOrWhiteSpace(trimmed))
                        {
                            try { db.Database.ExecuteSqlRaw(trimmed); } catch { }
                        }
                    }
                    Log.Information("Full Database Schema applied successfully from {SqlPath}!", sqlPath);
                    break;
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to apply full deploy SQL script.");
                }
            }
        }

        // 2. Also run EF Core Migrate to ensure all latest schema is present
        try
        {
            db.Database.Migrate();
            Log.Information("EF Core Database migrations applied successfully!");
        }
        catch (Exception ex)
        {
            Log.Warning("EF Core migrate warning: {Message}", ex.Message);
        }
    }

    try
    {
        db.Database.ExecuteSqlRaw(@"
            SET ANSI_NULLS ON;
            SET QUOTED_IDENTIFIER ON;

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Vouchers')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Vouchers]') AND name = 'Status')
                BEGIN
                    ALTER TABLE [Vouchers] ADD [Status] nvarchar(20) NOT NULL DEFAULT 'Approved';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Vouchers]') AND name = 'ApprovedBy')
                BEGIN
                    ALTER TABLE [Vouchers] ADD [ApprovedBy] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Vouchers]') AND name = 'ApprovedOn')
                BEGIN
                    ALTER TABLE [Vouchers] ADD [ApprovedOn] datetime2 NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Vouchers]') AND name = 'RejectionReason')
                BEGIN
                    ALTER TABLE [Vouchers] ADD [RejectionReason] nvarchar(500) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Vouchers]') AND name = 'ScrollNo')
                BEGIN
                    ALTER TABLE [Vouchers] ADD [ScrollNo] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Members')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'AadhaarDocPath')
                BEGIN
                    ALTER TABLE [Members] ADD [AadhaarDocPath] nvarchar(max) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'PanDocPath')
                BEGIN
                    ALTER TABLE [Members] ADD [PanDocPath] nvarchar(max) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'IsDeleted')
                BEGIN
                    ALTER TABLE [Members] ADD [IsDeleted] bit NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'NomineeAddress')
                BEGIN
                    ALTER TABLE [Members] ADD [NomineeAddress] nvarchar(500) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'NomineeBirthDate')
                BEGIN
                    ALTER TABLE [Members] ADD [NomineeBirthDate] datetime2 NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'NomineeIsMinor')
                BEGIN
                    ALTER TABLE [Members] ADD [NomineeIsMinor] bit NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'NomineeGuardianName')
                BEGIN
                    ALTER TABLE [Members] ADD [NomineeGuardianName] nvarchar(150) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'MembershipType')
                BEGIN
                    ALTER TABLE [Members] ADD [MembershipType] nvarchar(30) NOT NULL DEFAULT 'Regular';
                END

                -- Drop redundant MembershipType from Customers table if it exists
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Customers]') AND name = 'MembershipType')
                BEGIN
                    DECLARE @CustMemConstraint nvarchar(200);
                    SELECT @CustMemConstraint = d.name
                    FROM sys.default_constraints d
                    JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
                    WHERE d.parent_object_id = OBJECT_ID(N'[Customers]') AND c.name = 'MembershipType';

                    IF @CustMemConstraint IS NOT NULL
                    BEGIN
                        EXEC('ALTER TABLE [Customers] DROP CONSTRAINT [' + @CustMemConstraint + ']');
                    END

                    ALTER TABLE [Customers] DROP COLUMN [MembershipType];
                END

                UPDATE [Members] SET [IsDeleted] = 0 WHERE [IsDeleted] IS NULL;
                UPDATE [Members] SET [MembershipType] = 'Regular' WHERE [MembershipType] IS NULL OR [MembershipType] = '';

                -- Ensure all existing members have valid, unique CIF numbers
                UPDATE [Members] 
                SET [CIFNo] = 'CIF' + RIGHT('000000' + CAST([MemberID] AS VARCHAR(10)), 6)
                WHERE [CIFNo] IS NULL OR [CIFNo] = '';

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Members_CIFNo' AND object_id = OBJECT_ID('Members'))
                BEGIN
                    CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_CIFNo] ON [Members]([CIFNo])
                    WHERE [CIFNo] IS NOT NULL AND [CIFNo] <> '';
                END
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Members_PANNo' AND object_id = OBJECT_ID('Members'))
                BEGIN
                    CREATE UNIQUE NONCLUSTERED INDEX [IX_Members_PANNo] ON [Members]([PANNo])
                    WHERE [PANNo] IS NOT NULL AND [PANNo] <> '';
                END

                -- Allow NULL MemberCode and ensure non-members without shares don't hold invalid/temporary MemberCodes
                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts')
                BEGIN
                    UPDATE [Members]
                    SET [MemberCode] = NULL
                    WHERE ([MemberCode] = '' OR [MemberCode] LIKE 'TEMP%')
                      AND [MemberID] NOT IN (
                          SELECT DISTINCT [MemberId] FROM [ShareAccounts] WHERE [TotalShareCount] > 0
                      );
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingTransactions')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingTransactions]') AND name = 'CustomerID')
                BEGIN
                    ALTER TABLE [SavingTransactions] ADD [CustomerID] int NOT NULL DEFAULT 1;
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AgentCustomerRequests')
            BEGIN
                CREATE TABLE [AgentCustomerRequests] (
                    [RequestID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [PigmyAgentID] int NULL,
                    [AgentName] nvarchar(100) NULL,
                    [RequestDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Pending',
                    [ApprovalDate] datetime2 NULL,
                    [ApprovedByUserID] int NULL,
                    [RejectionReason] nvarchar(500) NULL,
                    [CreatedMemberID] int NULL,
                    [CreatedPigmyAccountID] int NULL,
                    [FirstName] nvarchar(50) NOT NULL,
                    [MiddleName] nvarchar(50) NULL,
                    [LastName] nvarchar(50) NOT NULL,
                    [FirstNameEng] nvarchar(50) NULL,
                    [MiddleNameEng] nvarchar(50) NULL,
                    [LastNameEng] nvarchar(50) NULL,
                    [Gender] nvarchar(10) NULL DEFAULT 'Male',
                    [BirthDate] datetime2 NULL,
                    [Occupation] nvarchar(50) NULL,
                    [CasteCategory] nvarchar(50) NULL,
                    [MobileNo] nvarchar(15) NULL,
                    [Email] nvarchar(100) NULL,
                    [AadhaarNo] nvarchar(12) NULL,
                    [PANNo] nvarchar(10) NULL,
                    [Address] nvarchar(500) NULL,
                    [AddressEng] nvarchar(500) NULL,
                    [Village] nvarchar(100) NULL,
                    [Taluka] nvarchar(100) NULL,
                    [District] nvarchar(100) NULL,
                    [Pincode] nvarchar(10) NULL,
                    [NomineeName] nvarchar(150) NULL,
                    [NomineeNameEng] nvarchar(150) NULL,
                    [NomineeRelation] nvarchar(50) NULL,
                    [NomineeAddress] nvarchar(500) NULL,
                    [NomineeBirthDate] datetime2 NULL,
                    [NomineeAge] int NULL,
                    [PhotoPath] nvarchar(max) NULL,
                    [SignaturePath] nvarchar(max) NULL,
                    [AadhaarDocPath] nvarchar(max) NULL,
                    [PanDocPath] nvarchar(max) NULL,
                    [OpenPigmyAccount] bit NOT NULL DEFAULT 1,
                    [PigmySchemeID] int NULL,
                    [DailyDepositAmount] decimal(18,2) NOT NULL DEFAULT 100,
                    [InitialDepositAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [Remarks] nvarchar(500) NULL,
                    CONSTRAINT [FK_AgentCustomerRequests_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'JointMembers')
            BEGIN
                CREATE TABLE [JointMembers] (
                    [JointMemberID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [PrimaryMemberID] int NOT NULL,
                    [JointMemberCode] nvarchar(30) NULL,
                    [FirstName] nvarchar(50) NOT NULL,
                    [MiddleName] nvarchar(50) NULL,
                    [LastName] nvarchar(50) NOT NULL,
                    [FirstNameEng] nvarchar(50) NULL,
                    [MiddleNameEng] nvarchar(50) NULL,
                    [LastNameEng] nvarchar(50) NULL,
                    [RelationWithPrimary] nvarchar(50) NOT NULL DEFAULT 'Spouse',
                    [AadhaarNo] nvarchar(12) NULL,
                    [PANNo] nvarchar(10) NULL,
                    [MobileNo] nvarchar(15) NULL,
                    [Address] nvarchar(500) NULL,
                    [PhotoPath] nvarchar(max) NULL,
                    [SignaturePath] nvarchar(max) NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
                    [IsDeleted] bit NOT NULL DEFAULT 0,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [UpdatedBy] int NULL,
                    [UpdatedOn] datetime2 NULL,
                    CONSTRAINT [FK_JointMembers_Members_PrimaryMemberID] FOREIGN KEY ([PrimaryMemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DeceasedClaimSettlements')
            BEGIN
                CREATE TABLE [DeceasedClaimSettlements] (
                    [ClaimID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [MemberID] int NOT NULL,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [DeathDate] datetime2 NOT NULL,
                    [DeathCertificateNo] nvarchar(100) NULL,
                    [NomineeName] nvarchar(150) NOT NULL,
                    [NomineeRelation] nvarchar(50) NULL,
                    [NomineeAadhaarNo] nvarchar(12) NULL,
                    [NomineeMobileNo] nvarchar(15) NULL,
                    [NomineeBankAccount] nvarchar(100) NULL,
                    [TotalSavingsBalance] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalFdBalance] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalRdBalance] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalPigmyBalance] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalShareAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalLoanLiability] decimal(18,2) NOT NULL DEFAULT 0,
                    [NetPayableAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [ResolutionNo] nvarchar(100) NULL,
                    [ResolutionDate] datetime2 NULL,
                    [VoucherID] int NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Settled',
                    [SettlementDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [Remarks] nvarchar(500) NULL,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT [FK_DeceasedClaimSettlements_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE NO ACTION
                );
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AuditLogs]') AND name = 'Status')
                BEGIN
                    ALTER TABLE [AuditLogs] ADD [Status] nvarchar(20) NOT NULL DEFAULT 'SUCCESS';
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'BranchDayEndStatuses')
            BEGIN
                UPDATE [BranchDayEndStatuses] SET [IsDayClosed] = 0;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SansthaDetails')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'AutoPostVoucherLimit')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [AutoPostVoucherLimit] decimal(18,2) NOT NULL DEFAULT 50000.00;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'IsMobileCompulsory')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [IsMobileCompulsory] bit NOT NULL DEFAULT 1;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'IsAadhaarCompulsory')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [IsAadhaarCompulsory] bit NOT NULL DEFAULT 1;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'IsPanCompulsory')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [IsPanCompulsory] bit NOT NULL DEFAULT 0;
                END
            END

            -- -----------------------------------------------------------------------------------------
            -- SHARE MODULE TABLES & SCHEMA SYNCHRONIZATION
            -- -----------------------------------------------------------------------------------------
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareSchemes')
            BEGIN
                CREATE TABLE [ShareSchemes] (
                    [ShareSchemeId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [SchemeCode] nvarchar(50) NOT NULL,
                    [SchemeName] nvarchar(100) NOT NULL,
                    [MemberType] nvarchar(50) NOT NULL DEFAULT 'Regular',
                    [ShareFaceValue] decimal(18,2) NOT NULL DEFAULT 100.00,
                    [MinSharesCount] int NOT NULL DEFAULT 1,
                    [MaxSharesCount] int NOT NULL DEFAULT 1000,
                    [EntranceFee] decimal(18,2) NOT NULL DEFAULT 10.00,
                    [BuildingFund] decimal(18,2) NOT NULL DEFAULT 0.00,
                    [ShareTransferFee] decimal(18,2) NOT NULL DEFAULT 25.00,
                    [DividendRate] decimal(18,2) NOT NULL DEFAULT 10.00,
                    [HasVotingRights] bit NOT NULL DEFAULT 1,
                    [IsMobileCompulsory] bit NOT NULL DEFAULT 1,
                    [IsAadhaarCompulsory] bit NOT NULL DEFAULT 1,
                    [IsPanCompulsory] bit NOT NULL DEFAULT 0,
                    [LoanEligibilityMultiplier] int NOT NULL DEFAULT 10,
                    [EffectiveDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [IsActive] bit NOT NULL DEFAULT 1,
                    [ShareCapitalLedgerID] int NULL,
                    [EntranceFeeLedgerID] int NULL,
                    [ShareTransferFeeLedgerID] int NULL,
                    [BuildingFundLedgerID] int NULL,
                    [DividendPayableLedgerID] int NULL
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('ShareSchemes', 'BranchID') IS NULL ALTER TABLE [ShareSchemes] ADD [BranchID] int NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareSchemes', 'SchemeCode') IS NULL ALTER TABLE [ShareSchemes] ADD [SchemeCode] nvarchar(50) NOT NULL DEFAULT 'SHR-01';
                IF COL_LENGTH('ShareSchemes', 'SchemeName') IS NULL ALTER TABLE [ShareSchemes] ADD [SchemeName] nvarchar(100) NOT NULL DEFAULT '';
                IF COL_LENGTH('ShareSchemes', 'MemberType') IS NULL ALTER TABLE [ShareSchemes] ADD [MemberType] nvarchar(50) NOT NULL DEFAULT 'Regular';
                IF COL_LENGTH('ShareSchemes', 'ShareFaceValue') IS NULL ALTER TABLE [ShareSchemes] ADD [ShareFaceValue] decimal(18,2) NOT NULL DEFAULT 100.00;
                IF COL_LENGTH('ShareSchemes', 'MinSharesCount') IS NULL ALTER TABLE [ShareSchemes] ADD [MinSharesCount] int NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareSchemes', 'MaxSharesCount') IS NULL ALTER TABLE [ShareSchemes] ADD [MaxSharesCount] int NOT NULL DEFAULT 1000;
                IF COL_LENGTH('ShareSchemes', 'EntranceFee') IS NULL ALTER TABLE [ShareSchemes] ADD [EntranceFee] decimal(18,2) NOT NULL DEFAULT 10.00;
                IF COL_LENGTH('ShareSchemes', 'BuildingFund') IS NULL ALTER TABLE [ShareSchemes] ADD [BuildingFund] decimal(18,2) NOT NULL DEFAULT 0.00;
                IF COL_LENGTH('ShareSchemes', 'ShareTransferFee') IS NULL ALTER TABLE [ShareSchemes] ADD [ShareTransferFee] decimal(18,2) NOT NULL DEFAULT 25.00;
                IF COL_LENGTH('ShareSchemes', 'DividendRate') IS NULL ALTER TABLE [ShareSchemes] ADD [DividendRate] decimal(18,2) NOT NULL DEFAULT 10.00;
                IF COL_LENGTH('ShareSchemes', 'HasVotingRights') IS NULL ALTER TABLE [ShareSchemes] ADD [HasVotingRights] bit NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareSchemes', 'IsMobileCompulsory') IS NULL ALTER TABLE [ShareSchemes] ADD [IsMobileCompulsory] bit NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareSchemes', 'IsAadhaarCompulsory') IS NULL ALTER TABLE [ShareSchemes] ADD [IsAadhaarCompulsory] bit NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareSchemes', 'IsPanCompulsory') IS NULL ALTER TABLE [ShareSchemes] ADD [IsPanCompulsory] bit NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareSchemes', 'LoanEligibilityMultiplier') IS NULL ALTER TABLE [ShareSchemes] ADD [LoanEligibilityMultiplier] int NOT NULL DEFAULT 10;
                IF COL_LENGTH('ShareSchemes', 'EffectiveDate') IS NULL ALTER TABLE [ShareSchemes] ADD [EffectiveDate] datetime2 NOT NULL DEFAULT GETDATE();
                IF COL_LENGTH('ShareSchemes', 'IsActive') IS NULL ALTER TABLE [ShareSchemes] ADD [IsActive] bit NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareSchemes', 'ShareCapitalLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [ShareCapitalLedgerID] int NULL;
                IF COL_LENGTH('ShareSchemes', 'EntranceFeeLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [EntranceFeeLedgerID] int NULL;
                IF COL_LENGTH('ShareSchemes', 'ShareTransferFeeLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [ShareTransferFeeLedgerID] int NULL;
                IF COL_LENGTH('ShareSchemes', 'BuildingFundLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [BuildingFundLedgerID] int NULL;
                IF COL_LENGTH('ShareSchemes', 'DividendPayableLedgerID') IS NULL ALTER TABLE [ShareSchemes] ADD [DividendPayableLedgerID] int NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts')
            BEGIN
                CREATE TABLE [ShareAccounts] (
                    [ShareAccountId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [AccountNo] nvarchar(20) NOT NULL,
                    [MemberId] int NOT NULL,
                    [CustomerID] int NOT NULL DEFAULT 0,
                    [TotalShareAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalShareCount] int NOT NULL DEFAULT 0,
                    [DividendPayableBalance] decimal(18,2) NOT NULL DEFAULT 0,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
                    [OpeningDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [LegacyAccountId] int NULL,
                    [LegacyAccountNumber] nvarchar(50) NULL
                );
                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Members')
                BEGIN
                    ALTER TABLE [ShareAccounts] ADD CONSTRAINT [FK_ShareAccounts_Members_MemberId] FOREIGN KEY ([MemberId]) REFERENCES [Members] ([MemberID]);
                END
            END
            ELSE
            BEGIN
                IF COL_LENGTH('ShareAccounts', 'CustomerID') IS NULL ALTER TABLE [ShareAccounts] ADD [CustomerID] int NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareAccounts', 'TotalShareAmount') IS NULL ALTER TABLE [ShareAccounts] ADD [TotalShareAmount] decimal(18,2) NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareAccounts', 'TotalShareCount') IS NULL ALTER TABLE [ShareAccounts] ADD [TotalShareCount] int NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareAccounts', 'DividendPayableBalance') IS NULL ALTER TABLE [ShareAccounts] ADD [DividendPayableBalance] decimal(18,2) NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareAccounts', 'Status') IS NULL ALTER TABLE [ShareAccounts] ADD [Status] nvarchar(20) NOT NULL DEFAULT 'Active';
                IF COL_LENGTH('ShareAccounts', 'OpeningDate') IS NULL ALTER TABLE [ShareAccounts] ADD [OpeningDate] datetime2 NOT NULL DEFAULT GETDATE();
                IF COL_LENGTH('ShareAccounts', 'LegacyAccountId') IS NULL ALTER TABLE [ShareAccounts] ADD [LegacyAccountId] int NULL;
                IF COL_LENGTH('ShareAccounts', 'LegacyAccountNumber') IS NULL ALTER TABLE [ShareAccounts] ADD [LegacyAccountNumber] nvarchar(50) NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts') AND EXISTS (SELECT * FROM sys.tables WHERE name = 'Members')
            BEGIN
                UPDATE sa
                SET sa.[CustomerID] = ISNULL(m.[CustomerID], m.[MemberID])
                FROM [ShareAccounts] sa
                INNER JOIN [Members] m ON sa.[MemberId] = m.[MemberID]
                WHERE sa.[CustomerID] = 0 OR sa.[CustomerID] IS NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareCertificates')
            BEGIN
                CREATE TABLE [ShareCertificates] (
                    [CertificateId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [ShareAccountId] int NOT NULL,
                    [CustomerID] int NOT NULL DEFAULT 0,
                    [CertificateNo] nvarchar(50) NOT NULL,
                    [IssueDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [FromShareNo] bigint NOT NULL DEFAULT 1,
                    [ToShareNo] bigint NOT NULL DEFAULT 1,
                    [NumberOfShares] int NOT NULL DEFAULT 1,
                    [FaceValue] decimal(18,2) NOT NULL DEFAULT 100.00,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
                    [PrintCount] int NOT NULL DEFAULT 0,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [ModifiedBy] int NULL,
                    [ModifiedDate] datetime2 NULL,
                    [CancellationReason] nvarchar(max) NULL
                );
                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts')
                BEGIN
                    ALTER TABLE [ShareCertificates] ADD CONSTRAINT [FK_ShareCertificates_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES [ShareAccounts] ([ShareAccountId]);
                END
            END
            ELSE
            BEGIN
                IF COL_LENGTH('ShareCertificates', 'CustomerID') IS NULL ALTER TABLE [ShareCertificates] ADD [CustomerID] int NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareCertificates', 'FromShareNo') IS NULL ALTER TABLE [ShareCertificates] ADD [FromShareNo] bigint NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareCertificates', 'ToShareNo') IS NULL ALTER TABLE [ShareCertificates] ADD [ToShareNo] bigint NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareCertificates', 'NumberOfShares') IS NULL ALTER TABLE [ShareCertificates] ADD [NumberOfShares] int NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareCertificates', 'FaceValue') IS NULL ALTER TABLE [ShareCertificates] ADD [FaceValue] decimal(18,2) NOT NULL DEFAULT 100.00;
                IF COL_LENGTH('ShareCertificates', 'Status') IS NULL ALTER TABLE [ShareCertificates] ADD [Status] nvarchar(20) NOT NULL DEFAULT 'Active';
                IF COL_LENGTH('ShareCertificates', 'PrintCount') IS NULL ALTER TABLE [ShareCertificates] ADD [PrintCount] int NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareCertificates', 'CreatedBy') IS NULL ALTER TABLE [ShareCertificates] ADD [CreatedBy] int NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareCertificates', 'CreatedDate') IS NULL ALTER TABLE [ShareCertificates] ADD [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE();
                IF COL_LENGTH('ShareCertificates', 'ModifiedBy') IS NULL ALTER TABLE [ShareCertificates] ADD [ModifiedBy] int NULL;
                IF COL_LENGTH('ShareCertificates', 'ModifiedDate') IS NULL ALTER TABLE [ShareCertificates] ADD [ModifiedDate] datetime2 NULL;
                IF COL_LENGTH('ShareCertificates', 'CancellationReason') IS NULL ALTER TABLE [ShareCertificates] ADD [CancellationReason] nvarchar(max) NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareCertificates') AND EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts')
            BEGIN
                UPDATE sc
                SET sc.[CustomerID] = sa.[CustomerID]
                FROM [ShareCertificates] sc
                INNER JOIN [ShareAccounts] sa ON sc.[ShareAccountId] = sa.[ShareAccountId]
                WHERE sc.[CustomerID] = 0 OR sc.[CustomerID] IS NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareTransactions')
            BEGIN
                CREATE TABLE [ShareTransactions] (
                    [TransactionId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [ShareAccountId] int NOT NULL,
                    [CustomerID] int NOT NULL DEFAULT 0,
                    [TransactionDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [TransactionType] nvarchar(50) NOT NULL DEFAULT 'Allotment',
                    [NumberOfShares] int NOT NULL DEFAULT 1,
                    [Amount] decimal(18,2) NOT NULL DEFAULT 0,
                    [Narration] nvarchar(255) NOT NULL DEFAULT '',
                    [VoucherId] int NULL
                );
                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts')
                BEGIN
                    ALTER TABLE [ShareTransactions] ADD CONSTRAINT [FK_ShareTransactions_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES [ShareAccounts] ([ShareAccountId]);
                END
            END
            ELSE
            BEGIN
                IF COL_LENGTH('ShareTransactions', 'CustomerID') IS NULL ALTER TABLE [ShareTransactions] ADD [CustomerID] int NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareTransactions', 'TransactionType') IS NULL ALTER TABLE [ShareTransactions] ADD [TransactionType] nvarchar(50) NOT NULL DEFAULT 'Allotment';
                IF COL_LENGTH('ShareTransactions', 'NumberOfShares') IS NULL ALTER TABLE [ShareTransactions] ADD [NumberOfShares] int NOT NULL DEFAULT 1;
                IF COL_LENGTH('ShareTransactions', 'Amount') IS NULL ALTER TABLE [ShareTransactions] ADD [Amount] decimal(18,2) NOT NULL DEFAULT 0;
                IF COL_LENGTH('ShareTransactions', 'Narration') IS NULL ALTER TABLE [ShareTransactions] ADD [Narration] nvarchar(255) NOT NULL DEFAULT '';
                IF COL_LENGTH('ShareTransactions', 'VoucherId') IS NULL ALTER TABLE [ShareTransactions] ADD [VoucherId] int NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareTransactions') AND EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts')
            BEGIN
                UPDATE st
                SET st.[CustomerID] = sa.[CustomerID]
                FROM [ShareTransactions] st
                INNER JOIN [ShareAccounts] sa ON st.[ShareAccountId] = sa.[ShareAccountId]
                WHERE st.[CustomerID] = 0 OR st.[CustomerID] IS NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DividendDistributions')
            BEGIN
                CREATE TABLE [DividendDistributions] (
                    [DividendId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [ShareAccountId] int NOT NULL,
                    [FinancialYear] nvarchar(20) NOT NULL,
                    [DividendPercentage] decimal(5,2) NOT NULL DEFAULT 0,
                    [DividendAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [PayoutDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [IsPaid] bit NOT NULL DEFAULT 0,
                    [VoucherId] int NULL
                );
                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts')
                BEGIN
                    ALTER TABLE [DividendDistributions] ADD CONSTRAINT [FK_DividendDistributions_ShareAccounts_ShareAccountId] FOREIGN KEY ([ShareAccountId]) REFERENCES [ShareAccounts] ([ShareAccountId]);
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareCertificatePrintHistories')
            BEGIN
                CREATE TABLE [ShareCertificatePrintHistories] (
                    [PrintHistoryId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CertificateId] int NOT NULL,
                    [ActionType] nvarchar(20) NOT NULL DEFAULT 'Print',
                    [PrintedBy] int NOT NULL DEFAULT 1,
                    [PrintedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [IPAddress] nvarchar(50) NULL
                );
            END

            -- Harmonize Customer & Member CIF numbers strictly 1-to-1 with CustomerID
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Customers')
            BEGIN
                UPDATE c
                SET c.[CIFNo] = 'CIF' + RIGHT('000000' + CAST(c.[CustomerID] AS VARCHAR(10)), 6)
                FROM [Customers] c
                WHERE c.[CIFNo] IS NULL OR c.[CIFNo] = '' OR c.[CIFNo] LIKE 'TEMP%';

                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Members')
                BEGIN
                    UPDATE m
                    SET m.[CIFNo] = ISNULL(c.[CIFNo], 'CIF' + RIGHT('000000' + CAST(m.[MemberID] AS VARCHAR(10)), 6))
                    FROM [Members] m
                    LEFT JOIN [Customers] c ON (m.[CustomerID] = c.[CustomerID] OR m.[MemberID] = c.[CustomerID])
                    WHERE m.[CIFNo] IS NULL OR m.[CIFNo] = '';
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FdSchemes')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdSchemes]') AND name = 'FdLiabilityLedgerID')
                BEGIN
                    ALTER TABLE [FdSchemes] ADD [FdLiabilityLedgerID] int NULL;
                    ALTER TABLE [FdSchemes] ADD [InterestExpenseLedgerID] int NULL;
                    ALTER TABLE [FdSchemes] ADD [InterestPayableLedgerID] int NULL;
                    ALTER TABLE [FdSchemes] ADD [PrematurePenaltyLedgerID] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FdAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'PaymentMode')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [PaymentMode] nvarchar(20) NOT NULL DEFAULT 'Cash';
                    ALTER TABLE [FdAccounts] ADD [BankAccountLedgerID] int NULL;
                    ALTER TABLE [FdAccounts] ADD [ChequeNo] nvarchar(50) NULL;
                    ALTER TABLE [FdAccounts] ADD [ChequeDate] datetime2 NULL;
                    ALTER TABLE [FdAccounts] ADD [SavingAccountID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'SavingAccountID')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [SavingAccountID] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RdSchemes')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdSchemes]') AND name = 'PrematurePenaltyRate')
                BEGIN
                    ALTER TABLE [RdSchemes] ADD [PrematurePenaltyRate] decimal(5,2) NOT NULL DEFAULT 1.00;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdSchemes]') AND name = 'RdLiabilityLedgerID')
                BEGIN
                    ALTER TABLE [RdSchemes] ADD [RdLiabilityLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdSchemes]') AND name = 'InterestExpenseLedgerID')
                BEGIN
                    ALTER TABLE [RdSchemes] ADD [InterestExpenseLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdSchemes]') AND name = 'InterestPayableLedgerID')
                BEGIN
                    ALTER TABLE [RdSchemes] ADD [InterestPayableLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdSchemes]') AND name = 'PenaltyIncomeLedgerID')
                BEGIN
                    ALTER TABLE [RdSchemes] ADD [PenaltyIncomeLedgerID] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmySchemes')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmySchemes]') AND name = 'SchemeCode')
                BEGIN
                    ALTER TABLE [PigmySchemes] ADD [SchemeCode] nvarchar(50) NULL;
                    EXEC(N'UPDATE p SET SchemeCode = ''PGS'' + RIGHT(''000'' + CAST(p.PigmySchemeID AS VARCHAR(10)), 3) FROM [PigmySchemes] p WHERE SchemeCode IS NULL OR SchemeCode = '''';');
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmySchemes]') AND name = 'PigmyLiabilityLedgerID')
                BEGIN
                    ALTER TABLE [PigmySchemes] ADD [PigmyLiabilityLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmySchemes]') AND name = 'InterestExpenseLedgerID')
                BEGIN
                    ALTER TABLE [PigmySchemes] ADD [InterestExpenseLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmySchemes]') AND name = 'InterestPayableLedgerID')
                BEGIN
                    ALTER TABLE [PigmySchemes] ADD [InterestPayableLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmySchemes]') AND name = 'CommissionExpenseLedgerID')
                BEGIN
                    ALTER TABLE [PigmySchemes] ADD [CommissionExpenseLedgerID] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAgents')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgents]') AND name = 'MaxCashLimit')
                BEGIN
                    ALTER TABLE [PigmyAgents] ADD [MaxCashLimit] decimal(18,2) NOT NULL DEFAULT 20000.00;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgents]') AND name = 'PasswordHash')
                BEGIN
                    ALTER TABLE [PigmyAgents] ADD [PasswordHash] nvarchar(255) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgents]') AND name = 'Pin')
                BEGIN
                    ALTER TABLE [PigmyAgents] ADD [Pin] nvarchar(10) NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyCollections')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyCollections]') AND name = 'TransactionId')
                BEGIN
                    ALTER TABLE [PigmyCollections] ADD [TransactionId] nvarchar(64) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyCollections]') AND name = 'PaymentMode')
                BEGIN
                    ALTER TABLE [PigmyCollections] ADD [PaymentMode] nvarchar(10) NOT NULL DEFAULT 'CASH';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyCollections]') AND name = 'Notes')
                BEGIN
                    ALTER TABLE [PigmyCollections] ADD [Notes] nvarchar(255) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_PigmyCollections_TransactionId' AND object_id = OBJECT_ID(N'[PigmyCollections]'))
                BEGIN
                    CREATE UNIQUE NONCLUSTERED INDEX [UQ_PigmyCollections_TransactionId] 
                    ON [PigmyCollections]([TransactionId]) 
                    WHERE [TransactionId] IS NOT NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingAccountMasters')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountMasters]') AND name = 'LastInterestPostingDate')
                BEGIN
                    ALTER TABLE [SavingAccountMasters] ADD [LastInterestPostingDate] datetime2 NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountMasters]') AND name = 'LastInterestAmount')
                BEGIN
                    ALTER TABLE [SavingAccountMasters] ADD [LastInterestAmount] decimal(18,2) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountMasters]') AND name = 'OldAccountNo')
                BEGIN
                    ALTER TABLE [SavingAccountMasters] ADD [OldAccountNo] nvarchar(50) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountMasters]') AND name = 'LegacyAccountNumber')
                BEGIN
                    ALTER TABLE [SavingAccountMasters] ADD [LegacyAccountNumber] nvarchar(50) NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingInterestSettings')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingInterestSettings]') AND name = 'SchemeCode')
                BEGIN
                    ALTER TABLE [SavingInterestSettings] ADD [SchemeCode] nvarchar(50) NULL;
                    EXEC(N'UPDATE s SET SchemeCode = ''SAV'' + RIGHT(''000'' + CAST(s.SettingID AS VARCHAR(10)), 3) FROM [SavingInterestSettings] s WHERE SchemeCode IS NULL OR SchemeCode = '''';');
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingInterestSettings]') AND name = 'SchemeName')
                BEGIN
                    ALTER TABLE [SavingInterestSettings] ADD [SchemeName] nvarchar(100) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingInterestSettings]') AND name = 'SavingLiabilityLedgerID')
                BEGIN
                    ALTER TABLE [SavingInterestSettings] ADD [SavingLiabilityLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingInterestSettings]') AND name = 'InterestExpenseLedgerID')
                BEGIN
                    ALTER TABLE [SavingInterestSettings] ADD [InterestExpenseLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingInterestSettings]') AND name = 'InterestPayableLedgerID')
                BEGIN
                    ALTER TABLE [SavingInterestSettings] ADD [InterestPayableLedgerID] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentSchemes')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[InvestmentSchemes]') AND name = 'InvestmentType')
                BEGIN
                    ALTER TABLE [InvestmentSchemes] ADD [InvestmentType] nvarchar(30) NOT NULL DEFAULT 'Deposit';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[InvestmentSchemes]') AND name = 'InvestmentAssetLedgerID')
                BEGIN
                    ALTER TABLE [InvestmentSchemes] ADD [InvestmentAssetLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[InvestmentSchemes]') AND name = 'InterestIncomeLedgerID')
                BEGIN
                    ALTER TABLE [InvestmentSchemes] ADD [InterestIncomeLedgerID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[InvestmentSchemes]') AND name = 'InterestReceivableLedgerID')
                BEGIN
                    ALTER TABLE [InvestmentSchemes] ADD [InterestReceivableLedgerID] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[InvestmentAccounts]') AND name = 'DepositReceiptNo')
                BEGIN
                    ALTER TABLE [InvestmentAccounts] ADD [DepositReceiptNo] nvarchar(50) NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanCollections')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanCollections]') AND name = 'ApprovedByUserID')
                BEGIN
                    ALTER TABLE [LoanCollections] ADD [InterestWaived] decimal(18,2) NOT NULL DEFAULT 0;
                    ALTER TABLE [LoanCollections] ADD [PenaltyWaived] decimal(18,2) NOT NULL DEFAULT 0;
                    ALTER TABLE [LoanCollections] ADD [IsOTS] bit NOT NULL DEFAULT 0;
                    ALTER TABLE [LoanCollections] ADD [ResolutionNo] nvarchar(100) NULL;
                    ALTER TABLE [LoanCollections] ADD [ApprovedByUserID] int NULL;
                END
            END


            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'AccountGroups')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AccountGroups]') AND name = 'GroupCode')
                BEGIN
                    ALTER TABLE [AccountGroups] ADD [GroupCode] nvarchar(50) NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'EmployerMasters')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[EmployerMasters]') AND name = 'Address')
                BEGIN
                    ALTER TABLE [EmployerMasters] ADD [Address] nvarchar(500) NULL;
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CommitteeMembers')
            BEGIN
                CREATE TABLE [CommitteeMembers] (
                    [CommitteeMemberID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [MemberID] int NOT NULL,
                    [Designation] nvarchar(100) NOT NULL,
                    [JoiningDate] datetime2 NOT NULL,
                    [EndDate] datetime2 NULL,
                    [ResolutionNo] nvarchar(100) NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
                    [TermYear] nvarchar(50) NULL,
                    [Category] nvarchar(100) NULL,
                    [DINNo] nvarchar(50) NULL,
                    [Remarks] nvarchar(500) NULL,
                    [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [CreatedBy] nvarchar(100) NOT NULL DEFAULT 'System',
                    [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [UpdatedBy] nvarchar(100) NOT NULL DEFAULT 'System',
                    CONSTRAINT [FK_CommitteeMembers_Members_MemberID] FOREIGN KEY ([MemberID]) REFERENCES [Members] ([MemberID]) ON DELETE CASCADE
                );
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CommitteeMembers]') AND name = 'TermYear')
                    ALTER TABLE [CommitteeMembers] ADD [TermYear] nvarchar(50) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CommitteeMembers]') AND name = 'Category')
                    ALTER TABLE [CommitteeMembers] ADD [Category] nvarchar(100) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CommitteeMembers]') AND name = 'DINNo')
                    ALTER TABLE [CommitteeMembers] ADD [DINNo] nvarchar(50) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CommitteeMembers]') AND name = 'ResolutionNo')
                    ALTER TABLE [CommitteeMembers] ADD [ResolutionNo] nvarchar(100) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CommitteeMembers]') AND name = 'Remarks')
                    ALTER TABLE [CommitteeMembers] ADD [Remarks] nvarchar(500) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CommitteeMembers]') AND name = 'Status')
                    ALTER TABLE [CommitteeMembers] ADD [Status] nvarchar(20) NOT NULL DEFAULT 'Active';
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingTransactions')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingTransactions]') AND name = 'TargetSavingAccountID')
                BEGIN
                    ALTER TABLE [SavingTransactions] ADD [TargetSavingAccountID] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Members')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'FirstNameEng')
                BEGIN
                    ALTER TABLE [Members] ADD [FirstNameEng] nvarchar(50) NULL;
                    ALTER TABLE [Members] ADD [MiddleNameEng] nvarchar(50) NULL;
                    ALTER TABLE [Members] ADD [LastNameEng] nvarchar(50) NULL;
                    ALTER TABLE [Members] ADD [AddressEng] nvarchar(500) NULL;
                    ALTER TABLE [Members] ADD [NomineeNameEng] nvarchar(150) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'CasteCategory')
                BEGIN
                    ALTER TABLE [Members] ADD [CasteCategory] nvarchar(50) NULL;
                    ALTER TABLE [Members] ADD [Caste] nvarchar(100) NULL;
                    ALTER TABLE [Members] ADD [Email] nvarchar(150) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'IsMinor')
                BEGIN
                    ALTER TABLE [Members] ADD [IsMinor] bit NOT NULL DEFAULT 0;
                    ALTER TABLE [Members] ADD [GuardianName] nvarchar(150) NULL;
                    ALTER TABLE [Members] ADD [GuardianNameEng] nvarchar(150) NULL;
                    ALTER TABLE [Members] ADD [GuardianRelation] nvarchar(50) NULL;
                    ALTER TABLE [Members] ADD [GuardianAadhaarNo] nvarchar(12) NULL;
                    ALTER TABLE [Members] ADD [GuardianMobileNo] nvarchar(15) NULL;
                    ALTER TABLE [Members] ADD [GuardianAddress] nvarchar(500) NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'AccountGroups')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AccountGroups]') AND name = 'GroupNameEnglish')
                BEGIN
                    ALTER TABLE [AccountGroups] ADD [GroupNameEnglish] nvarchar(100) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AccountGroups]') AND name = 'GroupCode')
                BEGIN
                    ALTER TABLE [AccountGroups] ADD [GroupCode] nvarchar(50) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AccountGroups]') AND name = 'DisplayOrder')
                BEGIN
                    ALTER TABLE [AccountGroups] ADD [DisplayOrder] int NOT NULL DEFAULT 0;
                END
            END
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Ledgers')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Ledgers]') AND name = 'LedgerNameEnglish')
                BEGIN
                    ALTER TABLE [Ledgers] ADD [LedgerNameEnglish] nvarchar(100) NULL;
                END
            END
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Branches')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Branches]') AND name = 'BranchType')
                BEGIN
                    ALTER TABLE [Branches] ADD [BranchType] nvarchar(20) NOT NULL DEFAULT 'Branch';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Branches]') AND name = 'MobileNo')
                BEGIN
                    ALTER TABLE [Branches] ADD [MobileNo] nvarchar(15) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Branches]') AND name = 'Email')
                BEGIN
                    ALTER TABLE [Branches] ADD [Email] nvarchar(100) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Branches]') AND name = 'DefaultCashLedgerID')
                BEGIN
                    ALTER TABLE [Branches] ADD [DefaultCashLedgerID] int NULL;
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AgentCustomerRequests')
            BEGIN
                CREATE TABLE [AgentCustomerRequests] (
                    [RequestID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [PigmyAgentID] int NULL,
                    [AgentName] nvarchar(100) NULL,
                    [RequestDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Pending',
                    [ApprovalDate] datetime2 NULL,
                    [ApprovedByUserID] int NULL,
                    [RejectionReason] nvarchar(500) NULL,
                    [CreatedMemberID] int NULL,
                    [CreatedPigmyAccountID] int NULL,
                    [FirstName] nvarchar(50) NOT NULL,
                    [MiddleName] nvarchar(50) NULL,
                    [LastName] nvarchar(50) NOT NULL,
                    [FirstNameEng] nvarchar(50) NULL,
                    [MiddleNameEng] nvarchar(50) NULL,
                    [LastNameEng] nvarchar(50) NULL,
                    [Gender] nvarchar(10) NULL DEFAULT 'Male',
                    [BirthDate] datetime2 NULL,
                    [Occupation] nvarchar(50) NULL,
                    [CasteCategory] nvarchar(50) NULL,
                    [MobileNo] nvarchar(15) NULL,
                    [Email] nvarchar(100) NULL,
                    [AadhaarNo] nvarchar(12) NULL,
                    [PANNo] nvarchar(10) NULL,
                    [Address] nvarchar(500) NULL,
                    [AddressEng] nvarchar(500) NULL,
                    [Village] nvarchar(100) NULL,
                    [Taluka] nvarchar(100) NULL,
                    [District] nvarchar(100) NULL,
                    [Pincode] nvarchar(10) NULL,
                    [NomineeName] nvarchar(150) NULL,
                    [NomineeNameEng] nvarchar(150) NULL,
                    [NomineeRelation] nvarchar(50) NULL,
                    [NomineeAddress] nvarchar(500) NULL,
                    [NomineeBirthDate] datetime2 NULL,
                    [NomineeAge] int NULL,
                    [PhotoPath] nvarchar(max) NULL,
                    [SignaturePath] nvarchar(max) NULL,
                    [AadhaarDocPath] nvarchar(max) NULL,
                    [PanDocPath] nvarchar(max) NULL,
                    [OpenPigmyAccount] bit NOT NULL DEFAULT 1,
                    [PigmySchemeID] int NULL,
                    [DailyDepositAmount] decimal(18,2) NOT NULL DEFAULT 100,
                    [InitialDepositAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [Remarks] nvarchar(500) NULL
                );
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'BranchMasters')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[BranchMasters]') AND name = 'BranchType')
                BEGIN
                    ALTER TABLE [BranchMasters] ADD [BranchType] nvarchar(20) NOT NULL DEFAULT 'Branch';
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RdAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'AccountType')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [AccountType] nvarchar(20) NOT NULL DEFAULT 'Single';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'JointMemberID')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [JointMemberID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'GuardianName')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [GuardianName] nvarchar(100) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'GuardianRelation')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [GuardianRelation] nvarchar(50) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'PaymentMode')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [PaymentMode] nvarchar(30) NOT NULL DEFAULT 'Cash';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'SavingAccountID')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [SavingAccountID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'MaturityInstruction')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [MaturityInstruction] nvarchar(30) NOT NULL DEFAULT 'Cash_Payout';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'AgentID')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [AgentID] int NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'PassbookNo')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [PassbookNo] nvarchar(50) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'NomineeName')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [NomineeName] nvarchar(100) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'NomineeRelation')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [NomineeRelation] nvarchar(50) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'Remarks')
                BEGIN
                    ALTER TABLE [RdAccounts] ADD [Remarks] nvarchar(250) NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAgents')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgents]') AND name = 'JoiningDate')
                BEGIN
                    ALTER TABLE [PigmyAgents] ADD [JoiningDate] datetime2 NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgents]') AND name = 'BranchID')
                BEGIN
                    ALTER TABLE [PigmyAgents] ADD [BranchID] int NULL;
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RolePermissions')
            BEGIN
                CREATE TABLE [RolePermissions] (
                    [RolePermissionID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [RoleID] int NOT NULL,
                    [ModuleCode] nvarchar(50) NOT NULL,
                    [CanView] bit NOT NULL DEFAULT 0,
                    [CanAdd] bit NOT NULL DEFAULT 0,
                    [CanEdit] bit NOT NULL DEFAULT 0,
                    [CanDelete] bit NOT NULL DEFAULT 0,
                    [CanPrint] bit NOT NULL DEFAULT 0,
                    [CanApprove] bit NOT NULL DEFAULT 0,
                    [ScopeLevel] nvarchar(20) NOT NULL DEFAULT 'BranchOnly'
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs')
            BEGIN
                CREATE TABLE [AuditLogs] (
                    [AuditLogID] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [UserID] int NULL,
                    [Username] nvarchar(100) NOT NULL,
                    [Action] nvarchar(100) NOT NULL,
                    [EntityName] nvarchar(100) NOT NULL,
                    [EntityID] nvarchar(50) NULL,
                    [Timestamp] datetime2 NOT NULL DEFAULT GETDATE(),
                    [IPAddress] nvarchar(50) NULL,
                    [Details] nvarchar(max) NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EodBatchProcessLogs')
            BEGIN
                CREATE TABLE [EodBatchProcessLogs] (
                    [LogID] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL,
                    [BusinessDate] datetime2 NOT NULL,
                    [StepNumber] int NOT NULL,
                    [StepName] nvarchar(100) NOT NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'SUCCESS',
                    [RecordsProcessed] int NOT NULL DEFAULT 0,
                    [ErrorMessage] nvarchar(max) NULL,
                    [StartTime] datetime2 NOT NULL DEFAULT GETDATE(),
                    [EndTime] datetime2 NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLedgerMappings')
            BEGIN
                CREATE TABLE [AuditLedgerMappings] (
                    [AuditLedgerMappingID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CategoryCode] nvarchar(50) NOT NULL,
                    [CategoryName] nvarchar(150) NOT NULL,
                    [LedgerID] int NOT NULL,
                    [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT [FK_AuditLedgerMappings_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID])
                );
            END

            -- Section 101/91 Legal Recovery Tables Safety Creation
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LegalRecoveryLedgerMappings')
            BEGIN
                CREATE TABLE [LegalRecoveryLedgerMappings] (
                    [MappingId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchId] int NOT NULL DEFAULT 0,
                    [TransactionType] nvarchar(50) NOT NULL,
                    [DebitLedgerId] int NOT NULL DEFAULT 0,
                    [CreditLedgerId] int NOT NULL DEFAULT 0,
                    [IsActive] bit NOT NULL DEFAULT 1,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [UpdatedDate] datetime2 NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101CaseMasters')
            BEGIN
                CREATE TABLE [Sec101CaseMasters] (
                    [CaseId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchId] int NOT NULL DEFAULT 1,
                    [LoanAccountId] int NOT NULL,
                    [MemberId] int NOT NULL,
                    [CaseNumber] nvarchar(100) NOT NULL,
                    [CourtName] nvarchar(200) NOT NULL,
                    [AdvocateName] nvarchar(150) NULL,
                    [FilingDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [PrincipalClaim] decimal(18,2) NOT NULL DEFAULT 0,
                    [InterestClaim] decimal(18,2) NOT NULL DEFAULT 0,
                    [PenalInterestClaim] decimal(18,2) NOT NULL DEFAULT 0,
                    [OtherChargesClaim] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalClaimAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [CourtFeeAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [CourtFeeChallanNo] nvarchar(100) NULL,
                    [CaseStatus] nvarchar(50) NOT NULL DEFAULT 'FILED',
                    [CertificateNumber] nvarchar(100) NULL,
                    [CertificateDate] datetime2 NULL,
                    [GrantedAmount] decimal(18,2) NULL,
                    [GrantedInterestRate] decimal(5,2) NULL,
                    [Remarks] nvarchar(500) NULL,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE()
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101NoticeHistories')
            BEGIN
                CREATE TABLE [Sec101NoticeHistories] (
                    [NoticeId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchId] int NOT NULL DEFAULT 1,
                    [LoanAccountId] int NOT NULL,
                    [MemberId] int NOT NULL,
                    [NoticeType] nvarchar(50) NOT NULL,
                    [NoticeNumber] nvarchar(100) NOT NULL,
                    [NoticeDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [DueDate] datetime2 NOT NULL,
                    [PrincipalDue] decimal(18,2) NOT NULL DEFAULT 0,
                    [InterestDue] decimal(18,2) NOT NULL DEFAULT 0,
                    [PenalInterestDue] decimal(18,2) NOT NULL DEFAULT 0,
                    [NoticeFee] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalDemandAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [PostalTrackingNo] nvarchar(100) NULL,
                    [PostalStatus] nvarchar(50) NOT NULL DEFAULT 'DISPATCHED',
                    [DeliveredDate] datetime2 NULL,
                    [Remarks] nvarchar(500) NULL,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE()
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101HearingLogs')
            BEGIN
                CREATE TABLE [Sec101HearingLogs] (
                    [HearingLogId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CaseId] int NOT NULL,
                    [HearingDate] datetime2 NOT NULL,
                    [HearingStage] nvarchar(50) NOT NULL,
                    [PresenceType] nvarchar(100) NOT NULL DEFAULT 'Present',
                    [CourtOrderSummary] nvarchar(1000) NULL,
                    [NextHearingDate] datetime2 NULL,
                    [NextHearingPurpose] nvarchar(250) NULL,
                    [AdvocateNotes] nvarchar(1000) NULL,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE()
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101AttachmentAuctions')
            BEGIN
                CREATE TABLE [Sec101AttachmentAuctions] (
                    [ExecutionId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CaseId] int NOT NULL,
                    [ExecutionType] nvarchar(50) NOT NULL,
                    [ExecutionOrderNo] nvarchar(100) NOT NULL,
                    [OrderDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [SroName] nvarchar(150) NULL,
                    [EmployerName] nvarchar(200) NULL,
                    [EmployerAddress] nvarchar(500) NULL,
                    [MonthlyDeductionAmount] decimal(18,2) NULL,
                    [PropertyDetails] nvarchar(1000) NULL,
                    [EstimatedValue] decimal(18,2) NULL,
                    [ReservePrice] decimal(18,2) NULL,
                    [AuctionDate] datetime2 NULL,
                    [ExecutionStatus] nvarchar(50) NOT NULL DEFAULT 'ISSUED',
                    [RecoveredAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [Remarks] nvarchar(500) NULL,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE()
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101LegalExpenses')
            BEGIN
                CREATE TABLE [Sec101LegalExpenses] (
                    [LegalExpenseId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchId] int NOT NULL DEFAULT 1,
                    [CaseId] int NULL,
                    [LoanAccountId] int NOT NULL,
                    [ExpenseType] nvarchar(50) NOT NULL,
                    [ExpenseDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [Amount] decimal(18,2) NOT NULL DEFAULT 0,
                    [PayeeName] nvarchar(150) NULL,
                    [VoucherNumber] nvarchar(100) NULL,
                    [VoucherId] int NULL,
                    [PaymentMode] nvarchar(50) NOT NULL DEFAULT 'CASH',
                    [IsDebitedToBorrower] bit NOT NULL DEFAULT 1,
                    [DebitLedgerId] int NULL,
                    [CreditLedgerId] int NULL,
                    [Remarks] nvarchar(500) NULL,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE()
                );
            END

            -- ==========================================
            -- Share Module Safety Tables & Columns
            -- ==========================================
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareSchemes')
            BEGIN
                CREATE TABLE [ShareSchemes] (
                    [ShareSchemeId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [SchemeCode] nvarchar(50) NOT NULL,
                    [SchemeName] nvarchar(100) NOT NULL,
                    [MemberType] nvarchar(50) NOT NULL DEFAULT 'Regular',
                    [ShareFaceValue] decimal(18,2) NOT NULL DEFAULT 100.00,
                    [MinSharesCount] int NOT NULL DEFAULT 1,
                    [MaxSharesCount] int NOT NULL DEFAULT 1000,
                    [EntranceFee] decimal(18,2) NOT NULL DEFAULT 10.00,
                    [BuildingFund] decimal(18,2) NOT NULL DEFAULT 0.00,
                    [ShareTransferFee] decimal(18,2) NOT NULL DEFAULT 25.00,
                    [DividendRate] decimal(18,2) NOT NULL DEFAULT 10.00,
                    [HasVotingRights] bit NOT NULL DEFAULT 1,
                    [IsMobileCompulsory] bit NOT NULL DEFAULT 1,
                    [IsAadhaarCompulsory] bit NOT NULL DEFAULT 1,
                    [IsPanCompulsory] bit NOT NULL DEFAULT 0,
                    [LoanEligibilityMultiplier] int NOT NULL DEFAULT 10,
                    [EffectiveDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [IsActive] bit NOT NULL DEFAULT 1,
                    [ShareCapitalLedgerID] int NULL,
                    [EntranceFeeLedgerID] int NULL,
                    [ShareTransferFeeLedgerID] int NULL,
                    [BuildingFundLedgerID] int NULL,
                    [DividendPayableLedgerID] int NULL
                );
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'BranchID')
                    ALTER TABLE [ShareSchemes] ADD [BranchID] int NOT NULL DEFAULT 1;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'BuildingFund')
                    ALTER TABLE [ShareSchemes] ADD [BuildingFund] decimal(18,2) NOT NULL DEFAULT 0.00;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'ShareTransferFee')
                    ALTER TABLE [ShareSchemes] ADD [ShareTransferFee] decimal(18,2) NOT NULL DEFAULT 25.00;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'DividendRate')
                    ALTER TABLE [ShareSchemes] ADD [DividendRate] decimal(18,2) NOT NULL DEFAULT 10.00;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'HasVotingRights')
                    ALTER TABLE [ShareSchemes] ADD [HasVotingRights] bit NOT NULL DEFAULT 1;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'IsMobileCompulsory')
                    ALTER TABLE [ShareSchemes] ADD [IsMobileCompulsory] bit NOT NULL DEFAULT 1;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'IsAadhaarCompulsory')
                    ALTER TABLE [ShareSchemes] ADD [IsAadhaarCompulsory] bit NOT NULL DEFAULT 1;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'IsPanCompulsory')
                    ALTER TABLE [ShareSchemes] ADD [IsPanCompulsory] bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'LoanEligibilityMultiplier')
                    ALTER TABLE [ShareSchemes] ADD [LoanEligibilityMultiplier] int NOT NULL DEFAULT 10;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'ShareCapitalLedgerID')
                    ALTER TABLE [ShareSchemes] ADD [ShareCapitalLedgerID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'EntranceFeeLedgerID')
                    ALTER TABLE [ShareSchemes] ADD [EntranceFeeLedgerID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'ShareTransferFeeLedgerID')
                    ALTER TABLE [ShareSchemes] ADD [ShareTransferFeeLedgerID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'BuildingFundLedgerID')
                    ALTER TABLE [ShareSchemes] ADD [BuildingFundLedgerID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[ShareSchemes]') AND name = 'DividendPayableLedgerID')
                    ALTER TABLE [ShareSchemes] ADD [DividendPayableLedgerID] int NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareAccounts')
            BEGIN
                CREATE TABLE [ShareAccounts] (
                    [ShareAccountId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [AccountNo] nvarchar(20) NOT NULL,
                    [MemberId] int NOT NULL,
                    [CustomerID] int NOT NULL DEFAULT 1,
                    [TotalShareAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalShareCount] int NOT NULL DEFAULT 0,
                    [DividendPayableBalance] decimal(18,2) NOT NULL DEFAULT 0,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
                    [OpeningDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [LegacyAccountId] int NULL,
                    [LegacyAccountNumber] nvarchar(50) NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareCertificates')
            BEGIN
                CREATE TABLE [ShareCertificates] (
                    [CertificateId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [ShareAccountId] int NOT NULL,
                    [CustomerID] int NOT NULL DEFAULT 1,
                    [CertificateNo] nvarchar(50) NOT NULL,
                    [IssueDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [FromShareNo] bigint NOT NULL DEFAULT 1,
                    [ToShareNo] bigint NOT NULL DEFAULT 1,
                    [NumberOfShares] int NOT NULL DEFAULT 1,
                    [FaceValue] decimal(18,2) NOT NULL DEFAULT 100.00,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
                    [PrintCount] int NOT NULL DEFAULT 0,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [ModifiedBy] int NULL,
                    [ModifiedDate] datetime2 NULL,
                    [CancellationReason] nvarchar(500) NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareCertificatePrintHistories')
            BEGIN
                CREATE TABLE [ShareCertificatePrintHistories] (
                    [PrintHistoryId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CertificateId] int NOT NULL,
                    [ActionType] nvarchar(20) NOT NULL DEFAULT 'Print',
                    [PrintedBy] int NOT NULL DEFAULT 1,
                    [PrintedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [IPAddress] nvarchar(50) NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShareTransactions')
            BEGIN
                CREATE TABLE [ShareTransactions] (
                    [TransactionId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [ShareAccountId] int NOT NULL,
                    [CustomerID] int NOT NULL DEFAULT 1,
                    [TransactionDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [TransactionType] nvarchar(50) NOT NULL DEFAULT 'Allotment',
                    [NumberOfShares] int NOT NULL DEFAULT 1,
                    [Amount] decimal(18,2) NOT NULL DEFAULT 0,
                    [Narration] nvarchar(255) NOT NULL DEFAULT '',
                    [VoucherId] int NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DividendDistributions')
            BEGIN
                CREATE TABLE [DividendDistributions] (
                    [DividendId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [ShareAccountId] int NOT NULL,
                    [FinancialYear] nvarchar(20) NOT NULL,
                    [DividendPercentage] decimal(5,2) NOT NULL DEFAULT 0,
                    [DividendAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [PayoutDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [IsPaid] bit NOT NULL DEFAULT 0,
                    [VoucherId] int NULL
                );
            END

            -- ==========================================
            -- NPA Module Safety Tables & Initial Slabs Seed
            -- ==========================================
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NpaConfigs')
            BEGIN
                CREATE TABLE [NpaConfigs] (
                    [FinancialYear] nvarchar(10) NOT NULL PRIMARY KEY,
                    [ConcessionPeriodDays] int NOT NULL DEFAULT 180
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NpaProvisionSlabs')
            BEGIN
                CREATE TABLE [NpaProvisionSlabs] (
                    [NpaProvisionSlabID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [FinancialYear] nvarchar(10) NOT NULL,
                    [Category] nvarchar(50) NOT NULL,
                    [SecurityType] nvarchar(20) NOT NULL,
                    [OverdueOrOutOfOrderMonthsFrom] decimal(18,2) NOT NULL,
                    [OverdueOrOutOfOrderMonthsTo] decimal(18,2) NOT NULL,
                    [NpaMonthsFrom] decimal(18,2) NOT NULL DEFAULT 0,
                    [NpaMonthsTo] decimal(18,2) NOT NULL DEFAULT 0,
                    [MinProvisionPercent] decimal(18,2) NOT NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CollateralComplianceLogs')
            BEGIN
                CREATE TABLE [CollateralComplianceLogs] (
                    [CollateralComplianceLogID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [LoanAccountID] int NOT NULL,
                    [CollateralType] nvarchar(50) NOT NULL,
                    [ValuationDate] datetime2 NOT NULL,
                    [ValuationValue] decimal(18,2) NOT NULL,
                    [ValuersCount] int NOT NULL DEFAULT 1,
                    [LastInspectionDate] datetime2 NOT NULL,
                    [InsuranceExpiryDate] datetime2 NOT NULL,
                    [LastStockStatementDate] datetime2 NULL,
                    [IsAuditorVerified] bit NOT NULL DEFAULT 0,
                    [IsMarginMaintained] bit NOT NULL DEFAULT 1,
                    [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE()
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'NpaClassificationRuns')
            BEGIN
                CREATE TABLE [NpaClassificationRuns] (
                    [NpaClassificationRunID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [RunDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [TriggeredBy] nvarchar(100) NOT NULL,
                    [RecordsProcessed] int NOT NULL DEFAULT 0,
                    [Status] nvarchar(50) NOT NULL,
                    [Remarks] nvarchar(500) NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanAccountNpaStatuses')
            BEGIN
                CREATE TABLE [LoanAccountNpaStatuses] (
                    [LoanAccountNpaStatusID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [LoanAccountID] int NOT NULL,
                    [AsOfDate] datetime2 NOT NULL,
                    [OverdueDate] datetime2 NULL,
                    [OutOfOrderDate] datetime2 NULL,
                    [Category] nvarchar(50) NOT NULL DEFAULT 'Standard',
                    [SecurityType] nvarchar(50) NOT NULL DEFAULT 'Unsecured',
                    [OutstandingBalance] decimal(18,2) NOT NULL,
                    [CompliantCollateralValue] decimal(18,2) NOT NULL,
                    [ProvisionRequired] decimal(18,2) NOT NULL,
                    [ProvisionHeld] decimal(18,2) NOT NULL,
                    [IsAutoClassified] bit NOT NULL DEFAULT 1,
                    [LastClassificationRunId] int NOT NULL DEFAULT 0,
                    [AuditorRemarks] nvarchar(500) NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OverdueInterestLedgers')
            BEGIN
                CREATE TABLE [OverdueInterestLedgers] (
                    [OverdueInterestLedgerID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [LoanAccountID] int NOT NULL,
                    [TransactionDate] datetime2 NOT NULL,
                    [DebitAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [CreditAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [VoucherID] int NULL,
                    [Particulars] nvarchar(250) NOT NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OverdueRecoveryLedgers')
            BEGIN
                CREATE TABLE [OverdueRecoveryLedgers] (
                    [OverdueRecoveryLedgerID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [LoanAccountID] int NOT NULL,
                    [TransactionDate] datetime2 NOT NULL,
                    [DebitAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [CreditAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [VoucherID] int NULL,
                    [Particulars] nvarchar(250) NOT NULL
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BorrowerLinkedAccounts')
            BEGIN
                CREATE TABLE [BorrowerLinkedAccounts] (
                    [BorrowerLinkedAccountID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [ParentMemberID] int NOT NULL,
                    [LinkedMemberID] int NOT NULL,
                    [LinkType] nvarchar(50) NOT NULL DEFAULT 'Relative',
                    [Remarks] nvarchar(250) NULL
                );
            END

            -- Seed NPA Slabs if empty
            IF NOT EXISTS (SELECT * FROM [NpaProvisionSlabs])
            BEGIN
                INSERT INTO [NpaProvisionSlabs] ([FinancialYear], [Category], [SecurityType], [OverdueOrOutOfOrderMonthsFrom], [OverdueOrOutOfOrderMonthsTo], [NpaMonthsFrom], [NpaMonthsTo], [MinProvisionPercent]) VALUES
                ('2026-27', 'Standard', 'Both', 0, 6, 0, 0, 0.25),
                ('2026-27', 'Sub-Standard', 'Both', 6, 18, 0, 12, 8.00),
                ('2026-27', 'Doubtful-1', 'Secured', 18, 42, 12, 36, 25.00),
                ('2026-27', 'Doubtful-1', 'Unsecured', 18, 42, 12, 36, 80.00),
                ('2026-27', 'Doubtful-2', 'Secured', 42, 54, 36, 48, 30.00),
                ('2026-27', 'Doubtful-2', 'Unsecured', 42, 54, 36, 48, 90.00),
                ('2026-27', 'Doubtful-3', 'Secured', 54, 999, 48, 999, 40.00),
                ('2026-27', 'Doubtful-3', 'Unsecured', 54, 999, 48, 999, 100.00),
                ('2026-27', 'Loss', 'Both', 0, 999, 0, 0, 100.00);
            END

            IF NOT EXISTS (SELECT * FROM [NpaConfigs] WHERE [FinancialYear] = '2026-27')
            BEGIN
                INSERT INTO [NpaConfigs] ([FinancialYear], [ConcessionPeriodDays]) VALUES ('2026-27', 180);
            END

            -- Seed Essential Financial Year, Branch, Roles, and Sanstha Details if empty
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FinancialYears')
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM [FinancialYears])
                BEGIN
                    INSERT INTO [FinancialYears] ([YearCode], [StartDate], [EndDate], [IsActive], [IsClosed])
                    VALUES ('2026-2027', '2026-04-01', '2027-03-31', 1, 0);
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Branches')
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM [Branches])
                BEGIN
                    INSERT INTO [Branches] ([BranchCode], [BranchName], [Address], [BranchType], [IsActive])
                    VALUES ('001', N'मुख्य शाखा (Main Branch)', N'Head Office', 'Branch', 1);
                END
                ELSE
                BEGIN
                    -- Auto-Repair Mojibake / Corrupted Devanagari Strings in Branches
                    UPDATE [Branches]
                    SET [BranchName] = N'मुख्य शाखा (Main Branch)'
                    WHERE [BranchName] LIKE '%à¤%' OR [BranchName] LIKE '%Ã%' OR ([BranchID] = 1 AND ([BranchName] = 'MAIN' OR [BranchName] LIKE '%Main Branch%'));

                    UPDATE [Branches]
                    SET [Address] = N'मुख्य कार्यालय'
                    WHERE [Address] LIKE '%à¤%' OR [Address] LIKE '%Ã%';
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles')
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM [Roles])
                BEGIN
                    INSERT INTO [Roles] ([RoleName], [RoleCode]) VALUES ('Admin', 'Admin'), ('Manager', 'Manager'), ('Cashier', 'Cashier');
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SansthaDetails')
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM [SansthaDetails])
                BEGIN
                    INSERT INTO [SansthaDetails] ([SansthaName], [RegistrationNo], [Address], [Village], [State], [PinCode], [ContactNo], [Email])
                    VALUES (N'श्री जोतिर्लिंग नागरी सहकारी पतसंस्था मर्या.', 'REG123456789', 'Main Branch', 'Pune', 'Maharashtra', '411001', '020-1234567', 'info@smartbanking.com');
                END
                ELSE
                BEGIN
                    -- Auto-Repair Sanstha Details Mojibake
                    UPDATE [SansthaDetails]
                    SET [SansthaName] = N'श्री जोतिर्लिंग नागरी सहकारी पतसंस्था मर्या.', [Address] = N'मुख्य रस्ता', [Village] = N'पुणे', [State] = N'महाराष्ट्र'
                    WHERE [SansthaName] LIKE '%à¤%' OR [Address] LIKE '%à¤%';
                END
            END

            -- Auto-Repair Account Groups Mojibake if found
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'AccountGroups')
            BEGIN
                UPDATE [AccountGroups] SET [GroupName] = N'रोकड व बँक शिल्लक (Cash & Bank)' WHERE [GroupName] LIKE '%à¤%' AND ([NatureOfGroup] = 'Asset' OR [GroupID] = 1);
                UPDATE [AccountGroups] SET [GroupName] = N'ठेवी (Deposits)' WHERE [GroupName] LIKE '%à¤%' AND ([NatureOfGroup] = 'Liability' OR [GroupID] = 2);
                UPDATE [AccountGroups] SET [GroupName] = N'कर्ज वाटप (Loans & Advances)' WHERE [GroupName] LIKE '%à¤%' AND [GroupID] = 3;
                UPDATE [AccountGroups] SET [GroupName] = N'भाग भांडवल (Share Capital)' WHERE [GroupName] LIKE '%à¤%' AND [GroupID] = 4;
                UPDATE [AccountGroups] SET [GroupName] = N'उत्पन्न (Income)' WHERE [GroupName] LIKE '%à¤%' AND [GroupID] = 5;
                UPDATE [AccountGroups] SET [GroupName] = N'खर्च (Expenditure)' WHERE [GroupName] LIKE '%à¤%' AND [GroupID] = 6;
            END

            -- Auto-Repair Cashiers & Cash Management Mojibake if found
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Cashiers')
            BEGIN
                UPDATE [Cashiers]
                SET [CashierName] = N'मुख्य कॅशिअर (Head Cashier)',
                    [CounterNumber] = N'तिजोरी कक्ष (Main Vault)',
                    [Remarks] = N'मुख्य तिजोरी व बँक रोख व्यवस्थापन'
                WHERE [IsHeadCashier] = 1 AND ([CashierName] LIKE '%à¤%' OR [CashierName] LIKE '%?%');

                UPDATE [Cashiers]
                SET [CashierName] = N'काउंटर १ (जमा-नावे टेलर)',
                    [CounterNumber] = N'काउंटर १',
                    [Remarks] = N'दैनंदिन बचत, ठेव व कर्ज रोख व्यवहार'
                WHERE [IsHeadCashier] = 0 AND ([CashierName] LIKE '%à¤%' OR [CashierName] LIKE '%?%') AND ([CounterNumber] LIKE '%1%' OR [CounterNumber] LIKE '%१%' OR [Id] = 2);

                UPDATE [Cashiers]
                SET [CashierName] = N'काउंटर २ (पिग्मी व इतर संकलन)',
                    [CounterNumber] = N'काउंटर २',
                    [Remarks] = N'पिग्मी एजंट संकलन व इतर रोख पावत्या'
                WHERE [IsHeadCashier] = 0 AND ([CashierName] LIKE '%à¤%' OR [CashierName] LIKE '%?%') AND ([CounterNumber] LIKE '%2%' OR [CounterNumber] LIKE '%२%' OR [Id] = 3);
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CashManagementSettings')
            BEGIN
                UPDATE [CashManagementSettings]
                SET [Remarks] = N'मुख्य तिजोरी व रोख योजना सेटिंग'
                WHERE [Remarks] LIKE '%à¤%' OR [Remarks] LIKE '%?%';
            END

            -- System Version Tracking
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '__SystemVersionHistory')
            BEGIN
                CREATE TABLE [__SystemVersionHistory] (
                    [Id] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [VersionNumber] nvarchar(50) NOT NULL,
                    [AppliedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [PatchName] nvarchar(200) NOT NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'SUCCESS',
                    [Remarks] nvarchar(max) NULL,
                    [AppliedBy] nvarchar(100) NULL
                );

                INSERT INTO [__SystemVersionHistory] ([VersionNumber], [AppliedOn], [PatchName], [Status], [Remarks], [AppliedBy])
                VALUES ('1.0.0', GETDATE(), 'Initial Master Release', 'SUCCESS', 'Base system initialized', 'System');
            END
        ");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Failed to check or add auto-migrations columns");
    }

    try
    {
        db.Database.ExecuteSqlRaw(@"
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AgentCustomerRequests')
            BEGIN
                CREATE TABLE [AgentCustomerRequests] (
                    [RequestID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [PigmyAgentID] int NULL,
                    [AgentName] nvarchar(100) NULL,
                    [RequestDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Pending',
                    [ApprovalDate] datetime2 NULL,
                    [ApprovedByUserID] int NULL,
                    [RejectionReason] nvarchar(500) NULL,
                    [CreatedMemberID] int NULL,
                    [CreatedPigmyAccountID] int NULL,
                    [FirstName] nvarchar(50) NOT NULL,
                    [MiddleName] nvarchar(50) NULL,
                    [LastName] nvarchar(50) NOT NULL,
                    [FirstNameEng] nvarchar(50) NULL,
                    [MiddleNameEng] nvarchar(50) NULL,
                    [LastNameEng] nvarchar(50) NULL,
                    [Gender] nvarchar(10) NULL DEFAULT 'Male',
                    [BirthDate] datetime2 NULL,
                    [Occupation] nvarchar(50) NULL,
                    [CasteCategory] nvarchar(50) NULL,
                    [MobileNo] nvarchar(15) NULL,
                    [Email] nvarchar(100) NULL,
                    [AadhaarNo] nvarchar(12) NULL,
                    [PANNo] nvarchar(10) NULL,
                    [Address] nvarchar(500) NULL,
                    [AddressEng] nvarchar(500) NULL,
                    [Village] nvarchar(100) NULL,
                    [Taluka] nvarchar(100) NULL,
                    [District] nvarchar(100) NULL,
                    [Pincode] nvarchar(10) NULL,
                    [NomineeName] nvarchar(150) NULL,
                    [NomineeNameEng] nvarchar(150) NULL,
                    [NomineeRelation] nvarchar(50) NULL,
                    [NomineeAddress] nvarchar(500) NULL,
                    [NomineeBirthDate] datetime2 NULL,
                    [NomineeAge] int NULL,
                    [PhotoPath] nvarchar(max) NULL,
                    [SignaturePath] nvarchar(max) NULL,
                    [AadhaarDocPath] nvarchar(max) NULL,
                    [PanDocPath] nvarchar(max) NULL,
                    [OpenPigmyAccount] bit NOT NULL DEFAULT 1,
                    [PigmySchemeID] int NULL,
                    [DailyDepositAmount] decimal(18,2) NOT NULL DEFAULT 100,
                    [InitialDepositAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [Remarks] nvarchar(500) NULL
                );
            END
        ");
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Failed to create AgentCustomerRequests table");
    }

    try
    {
        // Core Banking Share Scheme & Voucher Mapping Startup Auto-Sync
        var activeShareScheme = db.ShareSchemes
            .OrderByDescending(s => s.IsActive)
            .ThenByDescending(s => s.EffectiveDate)
            .FirstOrDefault();

        if (activeShareScheme != null)
        {
            Bhisi.Api.Helpers.ShareLedgerHelper.SyncSchemeToVoucherMappingsAsync(db, activeShareScheme).GetAwaiter().GetResult();
        }
        else
        {
            Bhisi.Api.Helpers.ShareLedgerHelper.GetShareCapitalLedgerAsync(db).GetAwaiter().GetResult();
        }
    }
    catch (Exception ex)
    {
        Log.Warning(ex, "Failed to auto-sync ShareScheme mappings on startup");
    }
}

// Enable Swagger UI for easy testing
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Bhisi API v1");
});

// Global Exception Handler — catches ALL unhandled exceptions (including SqlNullValueException)
// and returns a clean JSON error response with full logging
app.UseExceptionHandler(exApp =>
{
    exApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";

        var exFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        if (exFeature != null)
        {
            var ex = exFeature.Error;
            Log.Error(ex, "Unhandled exception on {Method} {Path}",
                context.Request.Method, context.Request.Path);

            var errorResponse = new
            {
                status = 500,
                message = "सर्व्हरवर त्रुटी आली (Internal Server Error)",
                detail = app.Environment.IsDevelopment() ? ex.ToString() : ex.Message,
                path = context.Request.Path.Value
            };

            await context.Response.WriteAsJsonAsync(errorResponse);
        }
    });
});

if (!app.Environment.IsDevelopment())
{
    // app.UseHsts();
    // app.UseHttpsRedirection(); // Temporarily disabled for HTTP API calls
}

app.UseCors("AllowReactApp");

// Marathi Devanagari Unicode Numerals Normalization Middleware (Converts ०-९ to 0-9 in Path, Query & Body)
app.Use(async (context, next) =>
{
    if (context.Request.Path.HasValue)
    {
        string path = context.Request.Path.Value!;
        if (path.Any(c => c >= '०' && c <= '९'))
        {
            var normalizedPath = new string(path.Select(c => (c >= '०' && c <= '९') ? (char)('0' + (c - '०')) : c).ToArray());
            context.Request.Path = new PathString(normalizedPath);
        }
    }

    if (context.Request.QueryString.HasValue)
    {
        string query = context.Request.QueryString.Value!;
        if (query.Any(c => c >= '०' && c <= '९'))
        {
            var normalizedQuery = new string(query.Select(c => (c >= '०' && c <= '९') ? (char)('0' + (c - '०')) : c).ToArray());
            context.Request.QueryString = new QueryString(normalizedQuery);
        }
    }

    if (context.Request.ContentLength > 0 && context.Request.ContentType != null && context.Request.ContentType.Contains("application/json"))
    {
        context.Request.EnableBuffering();
        using var reader = new StreamReader(context.Request.Body, System.Text.Encoding.UTF8, leaveOpen: true);
        string body = await reader.ReadToEndAsync();
        context.Request.Body.Position = 0;

        if (!string.IsNullOrEmpty(body) && body.Any(c => c >= '०' && c <= '९'))
        {
            string normalizedBody = new string(body.Select(c => (c >= '०' && c <= '९') ? (char)('0' + (c - '०')) : c).ToArray());
            var memoryStream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(normalizedBody));
            context.Request.Body = memoryStream;
        }
    }

    await next();
});

app.UseDefaultFiles(); // Serves index.html automatically
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
        ctx.Context.Response.Headers.Append("Expires", "-1");
    }
});

app.UseCors("AllowReactApp");

app.UseMiddleware<Bhisi.Api.Filters.LicenseEnforcementMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/favicon.ico", (IWebHostEnvironment env) =>
{
    var path = Path.Combine(env.WebRootPath ?? "wwwroot", "favicon.ico");
    if (File.Exists(path))
    {
        return Results.File(path, "image/x-icon");
    }
    return Results.NoContent();
}).AllowAnonymous();

app.MapFallbackToFile("index.html").AllowAnonymous(); // Handles React routing without requiring JWT


app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

static string ResolveWorkingConnectionString(string configuredConnStr)
{
    try
    {
        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(configuredConnStr);
        string originalServer = string.IsNullOrWhiteSpace(builder.DataSource) ? "." : builder.DataSource;
        string targetDb = string.IsNullOrWhiteSpace(builder.InitialCatalog) ? "SmartBanking_Gurudev" : builder.InitialCatalog;

        string[] candidateServers = new[] { originalServer, @".\SQLEXPRESS", @".", @"(local)", @"localhost", @"localhost\SQLEXPRESS" }
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        foreach (var server in candidateServers)
        {
            try
            {
                var masterBuilder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(configuredConnStr)
                {
                    DataSource = server,
                    InitialCatalog = "master",
                    ConnectTimeout = 3
                };

                using var conn = new Microsoft.Data.SqlClient.SqlConnection(masterBuilder.ConnectionString);
                conn.Open();

                // Connected to SQL Server instance! Now verify or create target database
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $"IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '{targetDb}') CREATE DATABASE [{targetDb}];";
                    cmd.ExecuteNonQuery();
                }

                Log.Information("SQL Server connection verified on instance '{Server}' for database '{Database}'.", server, targetDb);
                
                var workingBuilder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(configuredConnStr)
                {
                    DataSource = server,
                    InitialCatalog = targetDb,
                    ConnectTimeout = 60
                };
                return workingBuilder.ConnectionString;
            }
            catch (Exception ex)
            {
                Log.Warning("Could not connect to SQL Server candidate '{Server}': {Message}", server, ex.Message);
            }
        }
    }
    catch (Exception ex)
    {
        Log.Warning("Error resolving connection string: {Message}", ex.Message);
    }

    return configuredConnStr;
}


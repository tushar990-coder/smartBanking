using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Threading.RateLimiting;
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
    LoadEnvFile();
    var builder = WebApplication.CreateBuilder(args);

    var envOnlineDb = Environment.GetEnvironmentVariable("OnlineDB")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__OnlineDB");
    if (!string.IsNullOrWhiteSpace(envOnlineDb))
    {
        builder.Configuration["ConnectionStrings:OnlineDB"] = envOnlineDb;
        builder.Configuration["ConnectionStrings:DefaultConnection"] = envOnlineDb;
    }

    var envConnStr = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
        ?? Environment.GetEnvironmentVariable("DefaultConnection");
    if (!string.IsNullOrWhiteSpace(envConnStr))
    {
        builder.Configuration["ConnectionStrings:DefaultConnection"] = envConnStr;
    }

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
    builder.Services.AddControllers(options =>
    {
        options.Filters.Add<EnforceBranchScopeAttribute>();
        options.Filters.Add<Bhisi.Api.Filters.EnforceRoleBoundaryAttribute>();
    }).AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.Converters.Add(new SafeNullableDateTimeConverter());
        options.JsonSerializerOptions.Converters.Add(new SafeDateTimeConverter());
    });
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen();
    builder.Services.AddMemoryCache();
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.AddPolicy("AuthRateLimit", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 25,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));
    });

    // Global Authorization — सर्व API ला login आवश्यक (AllowAnonymous ने override करता येतो)
    builder.Services.AddAuthorization(options =>
    {
        options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();
    });

    // Configure JWT Authentication
    var jwtService = new Bhisi.Api.Services.JwtTokenService(builder.Configuration);
    var keyStr = jwtService.GetSigningKey();
    var key = System.Text.Encoding.UTF8.GetBytes(keyStr);
    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.SaveToken = true;
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var principal = context.Principal;
                if (principal == null) return;

                string authHeader = context.Request.Headers["Authorization"].ToString();
                string? rawToken = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                    ? authHeader.Substring(7).Trim()
                    : null;

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                string role = principal.GetUserRole();

                if (string.Equals(role, "AGENT", StringComparison.OrdinalIgnoreCase))
                {
                    var agentClaim = principal.FindFirst("agentId")?.Value
                        ?? principal.FindFirst("AgentId")?.Value
                        ?? principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                    if (!int.TryParse(agentClaim, out int aid) || aid <= 0)
                    {
                        context.Fail("Invalid agent token claims.");
                        return;
                    }

                    var dbAgent = await db.PigmyAgents.AsNoTracking()
                        .Where(a => a.PigmyAgentID == aid)
                        .Select(a => new
                        {
                            a.Status,
                            a.IsLocked,
                            a.ActiveSessionToken,
                            a.BranchID
                        })
                        .FirstOrDefaultAsync();

                    if (dbAgent == null || dbAgent.Status != "Active" || dbAgent.IsLocked)
                    {
                        context.Fail("Agent account is inactive or locked.");
                        return;
                    }

                    if (!string.IsNullOrEmpty(rawToken) && !string.IsNullOrEmpty(dbAgent.ActiveSessionToken) &&
                        !string.Equals(dbAgent.ActiveSessionToken, rawToken, StringComparison.Ordinal))
                    {
                        context.Fail("Agent session expired or invalidated by a newer login.");
                        return;
                    }

                    if (dbAgent.BranchID.HasValue && dbAgent.BranchID.Value > 0 &&
                        principal.GetOperatingBranchId() != dbAgent.BranchID.Value)
                    {
                        context.Fail("Agent branch assignment mismatch.");
                    }
                    return;
                }

                if (string.Equals(role, "CUSTOMER", StringComparison.OrdinalIgnoreCase))
                {
                    var custClaim = principal.FindFirst("CustomerId")?.Value
                        ?? principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                    if (!int.TryParse(custClaim, out int cid) || cid <= 0)
                    {
                        context.Fail("Invalid customer token claims.");
                        return;
                    }

                    var dbCustomer = await db.Customers.AsNoTracking()
                        .Where(c => c.CustomerID == cid)
                        .Select(c => new
                        {
                            c.IsDeleted,
                            c.Status,
                            c.IsPortalLocked,
                            c.PortalSessionToken,
                            c.BranchID
                        })
                        .FirstOrDefaultAsync();

                    if (dbCustomer == null || dbCustomer.IsDeleted || dbCustomer.Status != "Active" || dbCustomer.IsPortalLocked)
                    {
                        context.Fail("Customer portal account is inactive or locked.");
                        return;
                    }

                    if (!string.IsNullOrEmpty(rawToken) && !string.IsNullOrEmpty(dbCustomer.PortalSessionToken) &&
                        !string.Equals(dbCustomer.PortalSessionToken, rawToken, StringComparison.Ordinal))
                    {
                        context.Fail("Customer session expired or invalidated by a newer login.");
                        return;
                    }

                    if (dbCustomer.BranchID > 0 && principal.GetOperatingBranchId() != dbCustomer.BranchID)
                    {
                        context.Fail("Customer branch assignment mismatch.");
                    }
                    return;
                }

                var idClaim = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (!int.TryParse(idClaim, out int uid) || uid <= 0) return;

                var dbUser = await db.Users.AsNoTracking()
                    .Where(u => u.UserID == uid)
                    .Select(u => new
                    {
                        u.IsActive,
                        u.IsLocked,
                        u.ActiveSessionToken,
                        u.DefaultBranchID,
                        RoleName = u.Role != null ? u.Role.RoleName : null
                    })
                    .FirstOrDefaultAsync();

                if (dbUser == null || !dbUser.IsActive || dbUser.IsLocked)
                {
                    context.Fail("User account is inactive or locked.");
                    return;
                }

                if (!string.IsNullOrEmpty(rawToken) && !string.IsNullOrEmpty(dbUser.ActiveSessionToken) &&
                    !string.Equals(dbUser.ActiveSessionToken, rawToken, StringComparison.Ordinal))
                {
                    context.Fail("Session expired or invalidated by branch switch / new login.");
                    return;
                }

                if (!UserContextExtensions.IsHeadOfficeRole(dbUser.RoleName) &&
                    dbUser.DefaultBranchID.HasValue && dbUser.DefaultBranchID.Value > 0 &&
                    principal.GetOperatingBranchId() != dbUser.DefaultBranchID.Value)
                {
                    context.Fail("Branch assignment mismatch.");
                }
            }
        };
    });

    // Configure Entity Framework with Standard Enterprise Core Banking Connection
    var rawConnStr = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? builder.Configuration.GetConnectionString("MainConnection")
        ?? builder.Configuration.GetConnectionString("LocalDB")
        ?? builder.Configuration.GetConnectionString("OnlineDB")
        ?? (builder.Configuration["ActiveDatabase"] != null ? builder.Configuration.GetConnectionString(builder.Configuration["ActiveDatabase"]!) : null)
        ?? "Server=.;Database=SmartBanking_Template;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;Connect Timeout=60;";

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
    builder.Services.AddSingleton<Bhisi.Api.Services.IJwtTokenService, Bhisi.Api.Services.JwtTokenService>();
    builder.Services.AddScoped<Bhisi.Api.Services.IBusinessDateGuardService, Bhisi.Api.Services.BusinessDateGuardService>();
    builder.Services.AddScoped<Bhisi.Api.Services.IAgentLockService, Bhisi.Api.Services.AgentLockService>();
    builder.Services.AddScoped<Bhisi.Api.Services.IPigmySyncService, Bhisi.Api.Services.PigmySyncService>();
    builder.Services.AddScoped<Bhisi.Api.Services.NpaEngineService>();
    builder.Services.AddScoped<Bhisi.Api.Services.IEodBodService, Bhisi.Api.Services.EodBodService>();
    builder.Services.AddScoped<Bhisi.Api.Services.IYearEndService, Bhisi.Api.Services.YearEndService>();
    builder.Services.AddScoped<Bhisi.Api.Services.IBackupService, Bhisi.Api.Services.BackupService>();
    builder.Services.AddScoped<Bhisi.Api.Services.INotificationEngineService, Bhisi.Api.Services.NotificationEngineService>();
    builder.Services.AddSingleton<Bhisi.Api.Services.ILicenseService, Bhisi.Api.Services.LicenseService>();
    builder.Services.AddScoped<Bhisi.Api.Services.ISystemUpdateService, Bhisi.Api.Services.SystemUpdateService>();
    builder.Services.AddScoped<Bhisi.Api.Services.VoucherRollbackAndDeleteService>();

    // Configure CORS for React client
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowReactApp",
            policy =>
            {
                policy.AllowAnyOrigin()
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .WithExposedHeaders("X-Total-Count", "X-Next-Legacy-Member-No", "Content-Disposition");
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
            IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoanRates_LoanType' AND object_id = OBJECT_ID('dbo.LoanRates'))
            BEGIN
                DROP INDEX [IX_LoanRates_LoanType] ON [dbo].[LoanRates];
            END
        ");
            Log.Information("IX_LoanRates_LoanType drop verified successfully.");
        }
        catch (Exception ex)
        {
            Log.Warning("Could not drop IX_LoanRates_LoanType: {Message}", ex.Message);
        }

        // CRITICAL CORE SCHEMA SELF-HEAL: Ensure Branches and BranchLedgerOpeningBalances exist BEFORE any controllers or queries
        try
        {
            db.Database.ExecuteSqlRaw(@"
            IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Branches')
            BEGIN
                IF COL_LENGTH('Branches', 'DefaultIbtLedgerID') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[Branches] ADD [DefaultIbtLedgerID] int NULL;
                END
                IF COL_LENGTH('Branches', 'DefaultCashLedgerID') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[Branches] ADD [DefaultCashLedgerID] int NULL;
                END
            END

            IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BranchLedgerOpeningBalances')
            BEGIN
                CREATE TABLE [dbo].[BranchLedgerOpeningBalances] (
                    [BranchLedgerOpeningBalanceID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [LedgerID] INT NOT NULL,
                    [BranchID] INT NOT NULL,
                    [FinancialYearID] INT NOT NULL,
                    [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                    [OpeningBalanceType] NVARCHAR(2) NOT NULL DEFAULT 'Dr',
                    [Remarks] NVARCHAR(250) NULL,
                    [CreatedBy] INT NOT NULL DEFAULT 1,
                    [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                    [UpdatedBy] INT NULL,
                    [UpdatedOn] DATETIME2 NULL
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('BranchLedgerOpeningBalances', 'CreatedOn') IS NULL
                    ALTER TABLE [dbo].[BranchLedgerOpeningBalances] ADD [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
                IF COL_LENGTH('BranchLedgerOpeningBalances', 'CreatedBy') IS NULL
                    ALTER TABLE [dbo].[BranchLedgerOpeningBalances] ADD [CreatedBy] INT NOT NULL DEFAULT 1;
                IF COL_LENGTH('BranchLedgerOpeningBalances', 'UpdatedOn') IS NULL
                    ALTER TABLE [dbo].[BranchLedgerOpeningBalances] ADD [UpdatedOn] DATETIME2 NULL;
                IF COL_LENGTH('BranchLedgerOpeningBalances', 'UpdatedBy') IS NULL
                    ALTER TABLE [dbo].[BranchLedgerOpeningBalances] ADD [UpdatedBy] INT NULL;
            END

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes 
                WHERE name = 'UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY' 
                  AND object_id = OBJECT_ID('dbo.BranchLedgerOpeningBalances')
            )
            BEGIN
                CREATE UNIQUE NONCLUSTERED INDEX [UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY]
                ON [dbo].[BranchLedgerOpeningBalances] ([LedgerID], [BranchID], [FinancialYearID]);
            END
        ");
            Log.Information("Branches core columns & BranchLedgerOpeningBalances self-heal verified successfully.");
        }
        catch (Exception ex)
        {
            Log.Warning("Branches core columns self-heal warning: {Message}", ex.Message);
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

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'AssetCategories')
            BEGIN
                IF COL_LENGTH('AssetCategories', 'AssetLedgerID') IS NULL
                    ALTER TABLE [dbo].[AssetCategories] ADD [AssetLedgerID] INT NULL;
                IF COL_LENGTH('AssetCategories', 'DepreciationExpenseLedgerID') IS NULL
                    ALTER TABLE [dbo].[AssetCategories] ADD [DepreciationExpenseLedgerID] INT NULL;
                IF COL_LENGTH('AssetCategories', 'AccumulatedDepreciationLedgerID') IS NULL
                    ALTER TABLE [dbo].[AssetCategories] ADD [AccumulatedDepreciationLedgerID] INT NULL;
                IF COL_LENGTH('AssetCategories', 'DisposalProfitLossLedgerID') IS NULL
                    ALTER TABLE [dbo].[AssetCategories] ADD [DisposalProfitLossLedgerID] INT NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingAccountClosings')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountClosings]') AND name = 'CustomerID')
                BEGIN
                    ALTER TABLE [SavingAccountClosings] ADD [CustomerID] int NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanCollections')
            BEGIN
                IF COL_LENGTH('LoanCollections', 'ReceivableInterestCollected') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [ReceivableInterestCollected] decimal(18,2) NOT NULL DEFAULT 0.00;
                IF COL_LENGTH('LoanCollections', 'InterestWaived') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [InterestWaived] decimal(18,2) NOT NULL DEFAULT 0.00;
                IF COL_LENGTH('LoanCollections', 'PenaltyWaived') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [PenaltyWaived] decimal(18,2) NOT NULL DEFAULT 0.00;
                IF COL_LENGTH('LoanCollections', 'IsOTS') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [IsOTS] bit NOT NULL DEFAULT 0;
                IF COL_LENGTH('LoanCollections', 'ResolutionNo') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [ResolutionNo] nvarchar(100) NULL;
                IF COL_LENGTH('LoanCollections', 'ApprovedByUserID') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [ApprovedByUserID] int NULL;
                IF COL_LENGTH('LoanCollections', 'HomeBranchVoucherID') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [HomeBranchVoucherID] int NULL;
                IF COL_LENGTH('LoanCollections', 'AgentID') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [AgentID] int NULL;
                IF COL_LENGTH('LoanCollections', 'CollectionSource') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [CollectionSource] nvarchar(20) NOT NULL DEFAULT 'COUNTER';
                IF COL_LENGTH('LoanCollections', 'TransactionId') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [TransactionId] nvarchar(100) NULL;
                IF COL_LENGTH('LoanCollections', 'SyncReferenceId') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [SyncReferenceId] nvarchar(100) NULL;
                IF COL_LENGTH('LoanCollections', 'SourcePigmyAccountID') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [SourcePigmyAccountID] int NULL;
                IF COL_LENGTH('LoanCollections', 'TransferFromPigmyAccountNo') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [TransferFromPigmyAccountNo] nvarchar(50) NULL;
                IF COL_LENGTH('LoanCollections', 'PigmyTransferType') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [PigmyTransferType] nvarchar(20) NULL;
                IF COL_LENGTH('LoanCollections', 'PigmyBalanceBefore') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [PigmyBalanceBefore] decimal(18,2) NULL;
                IF COL_LENGTH('LoanCollections', 'PigmyBalanceAfter') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [PigmyBalanceAfter] decimal(18,2) NULL;
                IF COL_LENGTH('LoanCollections', 'PigmyConsentRemark') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [PigmyConsentRemark] nvarchar(255) NULL;
                IF COL_LENGTH('LoanCollections', 'SourceSavingAccountID') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [SourceSavingAccountID] int NULL;
                IF COL_LENGTH('LoanCollections', 'SavingCustomerName') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [SavingCustomerName] nvarchar(150) NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanCollectionFees')
            BEGIN
                CREATE TABLE [dbo].[LoanCollectionFees] (
                    [LoanCollectionFeeID] int NOT NULL IDENTITY(1,1) PRIMARY KEY,
                    [LoanCollectionID] int NOT NULL,
                    [LedgerID] int NOT NULL,
                    [Amount] decimal(18,2) NOT NULL DEFAULT 0.00
                );
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAgents')
            BEGIN
                IF COL_LENGTH('PigmyAgents', 'Username') IS NULL ALTER TABLE [PigmyAgents] ADD [Username] nvarchar(100) NULL;
                IF COL_LENGTH('PigmyAgents', 'PasswordHash') IS NULL ALTER TABLE [PigmyAgents] ADD [PasswordHash] nvarchar(255) NULL;
                IF COL_LENGTH('PigmyAgents', 'Pin') IS NULL ALTER TABLE [PigmyAgents] ADD [Pin] nvarchar(10) NULL;
                IF COL_LENGTH('PigmyAgents', 'CustomerID') IS NULL ALTER TABLE [PigmyAgents] ADD [CustomerID] int NULL;
                IF COL_LENGTH('PigmyAgents', 'MaxCashLimit') IS NULL ALTER TABLE [PigmyAgents] ADD [MaxCashLimit] decimal(18,2) NOT NULL DEFAULT 20000.00;
                IF COL_LENGTH('PigmyAgents', 'MaxLockDays') IS NULL ALTER TABLE [PigmyAgents] ADD [MaxLockDays] int NOT NULL DEFAULT 2;
                IF COL_LENGTH('PigmyAgents', 'JoiningDate') IS NULL ALTER TABLE [PigmyAgents] ADD [JoiningDate] datetime2 NULL;
                IF COL_LENGTH('PigmyAgents', 'CreatedBy') IS NULL ALTER TABLE [PigmyAgents] ADD [CreatedBy] int NOT NULL DEFAULT 1;
                IF COL_LENGTH('PigmyAgents', 'CreatedDate') IS NULL ALTER TABLE [PigmyAgents] ADD [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE();
                IF COL_LENGTH('PigmyAgents', 'FailedLoginAttempts') IS NULL ALTER TABLE [PigmyAgents] ADD [FailedLoginAttempts] int NOT NULL DEFAULT 0;
                IF COL_LENGTH('PigmyAgents', 'IsLocked') IS NULL ALTER TABLE [PigmyAgents] ADD [IsLocked] bit NOT NULL DEFAULT 0;
                IF COL_LENGTH('PigmyAgents', 'ActiveSessionToken') IS NULL ALTER TABLE [PigmyAgents] ADD [ActiveSessionToken] nvarchar(2000) NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Customers')
            BEGIN
                IF COL_LENGTH('Customers', 'PortalPinHash') IS NULL ALTER TABLE [dbo].[Customers] ADD [PortalPinHash] nvarchar(255) NULL;
                IF COL_LENGTH('Customers', 'PortalFailedAttempts') IS NULL ALTER TABLE [dbo].[Customers] ADD [PortalFailedAttempts] int NOT NULL DEFAULT 0;
                IF COL_LENGTH('Customers', 'IsPortalLocked') IS NULL ALTER TABLE [dbo].[Customers] ADD [IsPortalLocked] bit NOT NULL DEFAULT 0;
                IF COL_LENGTH('Customers', 'PortalSessionToken') IS NULL ALTER TABLE [dbo].[Customers] ADD [PortalSessionToken] nvarchar(2000) NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanCollections') AND COL_LENGTH('LoanCollections', 'RemittanceDepositId') IS NULL
                ALTER TABLE [dbo].[LoanCollections] ADD [RemittanceDepositId] int NULL;
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingTransactions')
            BEGIN
                IF COL_LENGTH('SavingTransactions', 'VoucherID') IS NULL ALTER TABLE [dbo].[SavingTransactions] ADD [VoucherID] int NULL;
                IF COL_LENGTH('SavingTransactions', 'RemittanceDepositId') IS NULL ALTER TABLE [dbo].[SavingTransactions] ADD [RemittanceDepositId] int NULL;
            END
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RdTransactions')
            BEGIN
                IF COL_LENGTH('RdTransactions', 'RemittanceDepositId') IS NULL ALTER TABLE [dbo].[RdTransactions] ADD [RemittanceDepositId] int NULL;
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.RdTransactions') AND name = 'VoucherID' AND is_nullable = 0)
                    ALTER TABLE [dbo].[RdTransactions] ALTER COLUMN [VoucherID] int NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAccounts') AND COL_LENGTH('PigmyAccounts', 'RowVersion') IS NULL
                ALTER TABLE [dbo].[PigmyAccounts] ADD [RowVersion] rowversion NOT NULL;
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanAccounts') AND COL_LENGTH('LoanAccounts', 'RowVersion') IS NULL
                ALTER TABLE [dbo].[LoanAccounts] ADD [RowVersion] rowversion NOT NULL;
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingAccountMasters') AND COL_LENGTH('SavingAccountMasters', 'RowVersion') IS NULL
                ALTER TABLE [dbo].[SavingAccountMasters] ADD [RowVersion] rowversion NOT NULL;
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RdAccounts') AND COL_LENGTH('RdAccounts', 'RowVersion') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [RowVersion] rowversion NOT NULL;

            IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LoanCollections')
               AND COL_LENGTH('LoanCollections', 'SyncReferenceId') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_LoanCollections_SyncReferenceId' AND object_id = OBJECT_ID('dbo.LoanCollections'))
                CREATE UNIQUE NONCLUSTERED INDEX [UQ_LoanCollections_SyncReferenceId] ON [dbo].[LoanCollections] ([SyncReferenceId]) WHERE [SyncReferenceId] IS NOT NULL;
            IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SavingTransactions')
               AND COL_LENGTH('SavingTransactions', 'SyncReferenceId') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_SavingTransactions_SyncReferenceId' AND object_id = OBJECT_ID('dbo.SavingTransactions'))
                CREATE UNIQUE NONCLUSTERED INDEX [UQ_SavingTransactions_SyncReferenceId] ON [dbo].[SavingTransactions] ([SyncReferenceId]) WHERE [SyncReferenceId] IS NOT NULL;
            IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RdTransactions')
               AND COL_LENGTH('RdTransactions', 'SyncReferenceId') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_RdTransactions_SyncReferenceId' AND object_id = OBJECT_ID('dbo.RdTransactions'))
                CREATE UNIQUE NONCLUSTERED INDEX [UQ_RdTransactions_SyncReferenceId] ON [dbo].[RdTransactions] ([SyncReferenceId]) WHERE [SyncReferenceId] IS NOT NULL;

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAccounts')
            BEGIN
                IF COL_LENGTH('PigmyAccounts', 'PreviousAccountNo') IS NULL
                BEGIN
                    ALTER TABLE [PigmyAccounts] ADD [PreviousAccountNo] nvarchar(50) NULL;
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAccountSequences')
            BEGIN
                CREATE TABLE [PigmyAccountSequences] (
                    [SequenceID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [SchemeCodeNumeric] int NOT NULL DEFAULT 301,
                    [LastSequenceNumber] int NOT NULL DEFAULT 0,
                    [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE()
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('PigmyAccountSequences', 'SequenceID') IS NULL AND COL_LENGTH('PigmyAccountSequences', 'ID') IS NOT NULL
                BEGIN
                    EXEC sp_rename 'PigmyAccountSequences.ID', 'SequenceID', 'COLUMN';
                END
                IF COL_LENGTH('PigmyAccountSequences', 'SchemeCodeNumeric') IS NULL
                BEGIN
                    ALTER TABLE [PigmyAccountSequences] ADD [SchemeCodeNumeric] int NOT NULL DEFAULT 301;
                END
                IF COL_LENGTH('PigmyAccountSequences', 'LastSequenceNumber') IS NULL AND COL_LENGTH('PigmyAccountSequences', 'CurrentSequenceNumber') IS NOT NULL
                BEGIN
                    EXEC sp_rename 'PigmyAccountSequences.CurrentSequenceNumber', 'LastSequenceNumber', 'COLUMN';
                END
                IF COL_LENGTH('PigmyAccountSequences', 'LastSequenceNumber') IS NULL
                BEGIN
                    ALTER TABLE [PigmyAccountSequences] ADD [LastSequenceNumber] int NOT NULL DEFAULT 0;
                END
            END

            -- RD Module CBS Standardization: Tables and Columns
            IF COL_LENGTH('PigmySchemeInterestSlabs', 'FromMonths') IS NOT NULL
                ALTER TABLE [dbo].[PigmySchemeInterestSlabs] ALTER COLUMN [FromMonths] int NULL;

            IF COL_LENGTH('PigmySchemeInterestSlabs', 'ToMonths') IS NOT NULL
                ALTER TABLE [dbo].[PigmySchemeInterestSlabs] ALTER COLUMN [ToMonths] int NULL;

            IF COL_LENGTH('PigmySchemes', 'InterestPostingFrequency') IS NULL
                ALTER TABLE [dbo].[PigmySchemes] ADD [InterestPostingFrequency] nvarchar(50) NULL;

            IF OBJECT_ID(N'[dbo].[RDInstallmentSchedules]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[RDInstallmentSchedules] (
                    [ScheduleID] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [RdAccountID] int NOT NULL,
                    [InstallmentNo] int NOT NULL,
                    [DueDate] date NOT NULL,
                    [GraceDate] date NOT NULL,
                    [ExpectedAmount] decimal(18,2) NOT NULL,
                    [PaidDate] datetime2 NULL,
                    [PaidAmount] decimal(18,2) NOT NULL DEFAULT 0.00,
                    [OverdueDays] int NOT NULL DEFAULT 0,
                    [PenaltyCharged] decimal(18,2) NOT NULL DEFAULT 0.00,
                    [PenaltyWaived] decimal(18,2) NOT NULL DEFAULT 0.00,
                    [PaymentMode] nvarchar(30) NULL,
                    [VoucherID] int NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Pending',
                    CONSTRAINT [FK_RDInstallmentSchedules_RdAccounts] FOREIGN KEY ([RdAccountID]) 
                        REFERENCES [dbo].[RdAccounts]([RdAccountID]) ON DELETE CASCADE
                );
                CREATE NONCLUSTERED INDEX [IX_RDInstallmentSchedules_Account_Due] 
                    ON [dbo].[RDInstallmentSchedules] ([RdAccountID], [DueDate], [Status]);
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RdAccountSequences')
            BEGIN
                CREATE TABLE [RdAccountSequences] (
                    [SequenceID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [SchemeCodeNumeric] int NOT NULL DEFAULT 501,
                    [LastSequenceNumber] int NOT NULL DEFAULT 0,
                    [ProductType] nvarchar(10) NOT NULL DEFAULT 'RD',
                    [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE()
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('RdAccountSequences', 'SchemeCodeNumeric') IS NULL
                    ALTER TABLE [RdAccountSequences] ADD [SchemeCodeNumeric] int NOT NULL DEFAULT 501;
                IF COL_LENGTH('RdAccountSequences', 'LastSequenceNumber') IS NULL
                    ALTER TABLE [RdAccountSequences] ADD [LastSequenceNumber] int NOT NULL DEFAULT 0;
                IF COL_LENGTH('RdAccountSequences', 'UpdatedOn') IS NULL
                    ALTER TABLE [RdAccountSequences] ADD [UpdatedOn] datetime2 NULL;
            END

            IF COL_LENGTH('RdAccounts', 'CumulativeInterestAccrued') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [CumulativeInterestAccrued] decimal(18,2) NOT NULL DEFAULT 0.00;
            IF COL_LENGTH('RdAccounts', 'IsLienMarked') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [IsLienMarked] bit NOT NULL DEFAULT 0;
            IF COL_LENGTH('RdAccounts', 'LienLoanAccountNo') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [LienLoanAccountNo] nvarchar(30) NULL;
            IF COL_LENGTH('RdAccounts', 'LienAmount') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [LienAmount] decimal(18,2) NULL;
            IF COL_LENGTH('RdAccounts', 'AutoDebitDay') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [AutoDebitDay] int NOT NULL DEFAULT 10;
            IF COL_LENGTH('RdAccounts', 'ClosureDate') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [ClosureDate] datetime2 NULL;
            IF COL_LENGTH('RdAccounts', 'ClosureType') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [ClosureType] nvarchar(30) NULL;
            IF COL_LENGTH('RdAccounts', 'ClosedPayoutAmount') IS NULL
                ALTER TABLE [dbo].[RdAccounts] ADD [ClosedPayoutAmount] decimal(18,2) NULL;

            IF COL_LENGTH('RdTransactions', 'BalanceAfterTxn') IS NULL
                ALTER TABLE [dbo].[RdTransactions] ADD [BalanceAfterTxn] decimal(18,2) NULL;
            IF COL_LENGTH('RdTransactions', 'Narration') IS NULL
                ALTER TABLE [dbo].[RdTransactions] ADD [Narration] nvarchar(250) NULL;

            IF COL_LENGTH('RdSchemes', 'SchemeCodeNumeric') IS NULL
                ALTER TABLE [dbo].[RdSchemes] ADD [SchemeCodeNumeric] int NOT NULL DEFAULT 501;
            IF COL_LENGTH('RdSchemes', 'CompoundingFrequency') IS NULL
                ALTER TABLE [dbo].[RdSchemes] ADD [CompoundingFrequency] nvarchar(20) NOT NULL DEFAULT 'Quarterly';
            IF COL_LENGTH('RdSchemes', 'GracePeriodDays') IS NULL
                ALTER TABLE [dbo].[RdSchemes] ADD [GracePeriodDays] int NOT NULL DEFAULT 5;

            IF COL_LENGTH('RdSchemes', 'InstallmentAmount') IS NOT NULL
            BEGIN
                DECLARE @ConstraintName nvarchar(200);
                SELECT @ConstraintName = d.name FROM sys.default_constraints d
                JOIN sys.columns c ON d.parent_object_id = c.object_id AND d.parent_column_id = c.column_id
                WHERE d.parent_object_id = OBJECT_ID(N'[RdSchemes]') AND c.name = 'InstallmentAmount';
                IF @ConstraintName IS NOT NULL EXEC('ALTER TABLE [RdSchemes] DROP CONSTRAINT [' + @ConstraintName + ']');
                ALTER TABLE [dbo].[RdSchemes] DROP COLUMN [InstallmentAmount];
            END
            
            IF COL_LENGTH('RdSchemes', 'AllowOverdueInterest') IS NULL
                ALTER TABLE [dbo].[RdSchemes] ADD [AllowOverdueInterest] bit NOT NULL DEFAULT 0;
            
            IF COL_LENGTH('RdSchemes', 'OverdueInterestRate') IS NULL
                ALTER TABLE [dbo].[RdSchemes] ADD [OverdueInterestRate] decimal(5,2) NULL;

            -- Deposit Collateral & Lien Tracking Migration Checks
            IF COL_LENGTH('LoanRates', 'CollateralCategory') IS NULL
                ALTER TABLE [dbo].[LoanRates] ADD [CollateralCategory] nvarchar(50) NOT NULL DEFAULT 'None';
            IF COL_LENGTH('LoanRates', 'MaxLtvPercentage') IS NULL
                ALTER TABLE [dbo].[LoanRates] ADD [MaxLtvPercentage] decimal(5,2) NOT NULL DEFAULT 85.00;
            IF COL_LENGTH('LoanRates', 'IsLienRequired') IS NULL
                ALTER TABLE [dbo].[LoanRates] ADD [IsLienRequired] bit NOT NULL DEFAULT 0;
            IF COL_LENGTH('LoanRates', 'IsCollateralMandatoryForOpeningBalance') IS NULL
                ALTER TABLE [dbo].[LoanRates] ADD [IsCollateralMandatoryForOpeningBalance] bit NOT NULL DEFAULT 0;

            -- Gold Loan Collateral & Valuer Tracking Migration Checks
            IF COL_LENGTH('GoldLoanDetails', 'LoanApplicationID') IS NULL
                ALTER TABLE [dbo].[GoldLoanDetails] ADD [LoanApplicationID] int NULL;
            IF COL_LENGTH('GoldLoanDetails', 'ValuerName') IS NULL
                ALTER TABLE [dbo].[GoldLoanDetails] ADD [ValuerName] nvarchar(200) NULL;
            IF COL_LENGTH('GoldLoanDetails', 'ValuerValuation') IS NULL
                ALTER TABLE [dbo].[GoldLoanDetails] ADD [ValuerValuation] decimal(18,2) NOT NULL DEFAULT 0.00;
            IF COL_LENGTH('GoldLoanDetails', 'ValuationReceiptNo') IS NULL
                ALTER TABLE [dbo].[GoldLoanDetails] ADD [ValuationReceiptNo] nvarchar(100) NULL;
            IF COL_LENGTH('GoldLoanDetails', 'ValuationDate') IS NULL
                ALTER TABLE [dbo].[GoldLoanDetails] ADD [ValuationDate] datetime2 NULL;
            IF COL_LENGTH('GoldLoanDetails', 'Remarks') IS NULL
                ALTER TABLE [dbo].[GoldLoanDetails] ADD [Remarks] nvarchar(500) NULL;
            IF COL_LENGTH('GoldLoanDetails', 'ImagePath') IS NOT NULL
                ALTER TABLE [dbo].[GoldLoanDetails] ALTER COLUMN [ImagePath] nvarchar(max) NULL;
            IF COL_LENGTH('GoldLoanDetails', 'LoanAccountID') IS NOT NULL
                ALTER TABLE [dbo].[GoldLoanDetails] ALTER COLUMN [LoanAccountID] int NULL;
            IF COL_LENGTH('LoanApplications', 'SecurityDetails') IS NOT NULL
                ALTER TABLE [dbo].[LoanApplications] ALTER COLUMN [SecurityDetails] nvarchar(max) NULL;
            IF COL_LENGTH('LoanAccounts', 'SecurityDetails') IS NOT NULL
                ALTER TABLE [dbo].[LoanAccounts] ALTER COLUMN [SecurityDetails] nvarchar(max) NULL;

            -- Multi-Branch Migration: Add BranchID to LoanApplications
            IF COL_LENGTH('LoanApplications', 'BranchID') IS NULL
            BEGIN
                ALTER TABLE [dbo].[LoanApplications] ADD [BranchID] int NOT NULL CONSTRAINT [DF_LoanApplications_BranchID] DEFAULT 1;
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanApplications_Branches_BranchID')
                BEGIN
                    ALTER TABLE [dbo].[LoanApplications] ADD CONSTRAINT [FK_LoanApplications_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches] ([BranchID]);
                END
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanApplications_BranchID' AND object_id = OBJECT_ID('LoanApplications'))
                BEGIN
                    CREATE INDEX [IX_LoanApplications_BranchID] ON [dbo].[LoanApplications] ([BranchID]);
                END
            END

            -- Multi-Branch Migration: Add BranchID to LoanDisbursements
            IF COL_LENGTH('LoanDisbursements', 'BranchID') IS NULL
            BEGIN
                ALTER TABLE [dbo].[LoanDisbursements] ADD [BranchID] int NOT NULL CONSTRAINT [DF_LoanDisbursements_BranchID] DEFAULT 1;
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanDisbursements_Branches_BranchID')
                BEGIN
                    ALTER TABLE [dbo].[LoanDisbursements] ADD CONSTRAINT [FK_LoanDisbursements_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches] ([BranchID]);
                END
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanDisbursements_BranchID' AND object_id = OBJECT_ID('LoanDisbursements'))
                BEGIN
                    CREATE INDEX [IX_LoanDisbursements_BranchID] ON [dbo].[LoanDisbursements] ([BranchID]);
                END
            END

            -- Backfill existing disbursements with their LoanAccount BranchID
            IF COL_LENGTH('LoanDisbursements', 'BranchID') IS NOT NULL
            BEGIN
                EXEC(N'UPDATE ld SET ld.BranchID = ISNULL(la.BranchID, 1) FROM [dbo].[LoanDisbursements] ld INNER JOIN [dbo].[LoanAccounts] la ON ld.LoanAccountID = la.LoanAccountID WHERE ld.BranchID = 1 AND la.BranchID IS NOT NULL AND la.BranchID <> 1;');
            END

            -- Multi-Branch Migration: Add BranchID & Multi-Branch Tracking to LoanCollections
            IF COL_LENGTH('LoanCollections', 'BranchID') IS NULL
            BEGIN
                ALTER TABLE [dbo].[LoanCollections] ADD [BranchID] int NOT NULL CONSTRAINT [DF_LoanCollections_BranchID] DEFAULT 1;
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_LoanCollections_Branches_BranchID')
                BEGIN
                    ALTER TABLE [dbo].[LoanCollections] ADD CONSTRAINT [FK_LoanCollections_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches] ([BranchID]);
                END
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanCollections_BranchID' AND object_id = OBJECT_ID('LoanCollections'))
                BEGIN
                    CREATE INDEX [IX_LoanCollections_BranchID] ON [dbo].[LoanCollections] ([BranchID]);
                END
            END

            IF COL_LENGTH('LoanCollections', 'CollectingCashierID') IS NULL
                ALTER TABLE [dbo].[LoanCollections] ADD [CollectingCashierID] int NULL;

            IF COL_LENGTH('LoanCollections', 'CreatedByUserID') IS NULL
                ALTER TABLE [dbo].[LoanCollections] ADD [CreatedByUserID] int NULL;

            IF COL_LENGTH('LoanCollections', 'IsCrossBranch') IS NULL
                ALTER TABLE [dbo].[LoanCollections] ADD [IsCrossBranch] bit NOT NULL CONSTRAINT [DF_LoanCollections_IsCrossBranch] DEFAULT 0;

            IF COL_LENGTH('LoanCollections', 'HomeBranchID') IS NULL
                ALTER TABLE [dbo].[LoanCollections] ADD [HomeBranchID] int NULL;

            IF COL_LENGTH('LoanCollections', 'HomeBranchVoucherID') IS NULL
            BEGIN
                ALTER TABLE [dbo].[LoanCollections] ADD [HomeBranchVoucherID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanCollections_HomeBranchVoucherID' AND object_id = OBJECT_ID('LoanCollections'))
                BEGIN
                    CREATE INDEX [IX_LoanCollections_HomeBranchVoucherID] ON [dbo].[LoanCollections] ([HomeBranchVoucherID]);
                END
            END

            IF COL_LENGTH('Vouchers', 'RelatedVoucherID') IS NULL
            BEGIN
                ALTER TABLE [dbo].[Vouchers] ADD [RelatedVoucherID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Vouchers_RelatedVoucherID' AND object_id = OBJECT_ID('Vouchers'))
                BEGIN
                    CREATE INDEX [IX_Vouchers_RelatedVoucherID] ON [dbo].[Vouchers] ([RelatedVoucherID]);
                END
            END

            IF COL_LENGTH('Vouchers', 'IsIbtVoucher') IS NULL
                ALTER TABLE [dbo].[Vouchers] ADD [IsIbtVoucher] bit NOT NULL CONSTRAINT [DF_Vouchers_IsIbtVoucher] DEFAULT 0;

            IF COL_LENGTH('Vouchers', 'TargetBranchID') IS NULL
                ALTER TABLE [dbo].[Vouchers] ADD [TargetBranchID] int NULL;

            IF COL_LENGTH('Branches', 'DefaultIbtLedgerID') IS NULL
                ALTER TABLE [dbo].[Branches] ADD [DefaultIbtLedgerID] int NULL;

            -- Backfill existing collections with their LoanAccount BranchID
            IF COL_LENGTH('LoanCollections', 'BranchID') IS NOT NULL
            BEGIN
                EXEC(N'UPDATE lc SET lc.BranchID = ISNULL(la.BranchID, 1), lc.HomeBranchID = ISNULL(la.BranchID, 1) FROM [dbo].[LoanCollections] lc INNER JOIN [dbo].[LoanAccounts] la ON lc.LoanAccountID = la.LoanAccountID WHERE lc.BranchID = 1 AND la.BranchID IS NOT NULL AND la.BranchID <> 1;');
            END

            IF COL_LENGTH('FdAccounts', 'IsLienMarked') IS NULL
                ALTER TABLE [dbo].[FdAccounts] ADD [IsLienMarked] bit NOT NULL DEFAULT 0;
            IF COL_LENGTH('FdAccounts', 'LienLoanAccountNo') IS NULL
                ALTER TABLE [dbo].[FdAccounts] ADD [LienLoanAccountNo] nvarchar(50) NULL;
            IF COL_LENGTH('FdAccounts', 'LienAmount') IS NULL
                ALTER TABLE [dbo].[FdAccounts] ADD [LienAmount] decimal(18,2) NULL;
            IF COL_LENGTH('FdAccounts', 'ReceiptNo') IS NULL
                ALTER TABLE [dbo].[FdAccounts] ADD [ReceiptNo] nvarchar(50) NULL;
            IF COL_LENGTH('FdAccounts', 'RootFdAccountID') IS NULL
                ALTER TABLE [dbo].[FdAccounts] ADD [RootFdAccountID] int NULL;
            IF COL_LENGTH('FdAccounts', 'RenewalCycleNo') IS NULL
                ALTER TABLE [dbo].[FdAccounts] ADD [RenewalCycleNo] int NOT NULL DEFAULT 0;

            IF OBJECT_ID('FdAccounts', 'U') IS NOT NULL
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = 'FdAccounts' AND COLUMN_NAME = 'Remarks'
                      AND CHARACTER_MAXIMUM_LENGTH IS NOT NULL AND CHARACTER_MAXIMUM_LENGTH > 0 AND CHARACTER_MAXIMUM_LENGTH < 1000
                )
                BEGIN
                    ALTER TABLE [dbo].[FdAccounts] ALTER COLUMN [Remarks] nvarchar(1000) NULL;
                END

                -- Ensure no legacy accidental UNIQUE index on LegacyAccountNumber / ReceiptNo blocks RETAIN_ORIGINAL renewals
                DECLARE @dropUqFdSql nvarchar(max) = N'';
                SELECT @dropUqFdSql = @dropUqFdSql + N'DROP INDEX [' + i.name + N'] ON [dbo].[FdAccounts];'
                FROM sys.indexes i
                WHERE i.object_id = OBJECT_ID('dbo.FdAccounts')
                  AND i.is_unique = 1
                  AND i.is_primary_key = 0
                  AND i.is_unique_constraint = 0
                  AND EXISTS (
                      SELECT 1
                      FROM sys.index_columns ic
                      INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                      WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                        AND c.name IN ('LegacyAccountNumber', 'ReceiptNo')
                  );
                IF LEN(@dropUqFdSql) > 0 EXEC(@dropUqFdSql);
            END

            IF OBJECT_ID('FdAccounts', 'U') IS NOT NULL AND COL_LENGTH('FdAccounts', 'ReceiptNo') IS NOT NULL
            BEGIN
                EXEC(N'UPDATE [dbo].[FdAccounts] SET [ReceiptNo] = COALESCE(NULLIF(LTRIM(RTRIM([LegacyAccountNumber])), ''''), [AccountNo]) WHERE [ReceiptNo] IS NULL OR LTRIM(RTRIM([ReceiptNo])) = '''';');
                EXEC(N'UPDATE [dbo].[FdAccounts] SET [RootFdAccountID] = [FdAccountID] WHERE [RootFdAccountID] IS NULL AND [ParentFdAccountID] IS NULL;');
            END

            IF OBJECT_ID('FdAutoRenewalLogs', 'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH('FdAutoRenewalLogs', 'OldReceiptNo') IS NULL
                    ALTER TABLE [dbo].[FdAutoRenewalLogs] ADD [OldReceiptNo] nvarchar(50) NULL;
                IF COL_LENGTH('FdAutoRenewalLogs', 'NewReceiptNo') IS NULL
                    ALTER TABLE [dbo].[FdAutoRenewalLogs] ADD [NewReceiptNo] nvarchar(50) NULL;
            END

            IF COL_LENGTH('PigmyAccounts', 'IsLienMarked') IS NULL
                ALTER TABLE [dbo].[PigmyAccounts] ADD [IsLienMarked] bit NOT NULL DEFAULT 0;
            IF COL_LENGTH('PigmyAccounts', 'LienLoanAccountNo') IS NULL
                ALTER TABLE [dbo].[PigmyAccounts] ADD [LienLoanAccountNo] nvarchar(50) NULL;
            IF COL_LENGTH('PigmyAccounts', 'LienAmount') IS NULL
                ALTER TABLE [dbo].[PigmyAccounts] ADD [LienAmount] decimal(18,2) NULL;

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanDepositCollaterals')
            BEGIN
                CREATE TABLE [LoanDepositCollaterals] (
                    [CollateralID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [LoanApplicationID] int NULL,
                    [LoanAccountID] int NULL,
                    [CustomerID] int NOT NULL,
                    [CollateralType] nvarchar(50) NOT NULL,
                    [DepositAccountID] int NOT NULL,
                    [DepositAccountNo] nvarchar(50) NOT NULL,
                    [DepositAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [CurrentDepositBalance] decimal(18,2) NOT NULL DEFAULT 0,
                    [MaturityDate] datetime2 NULL,
                    [LienAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [LienStatus] nvarchar(20) NOT NULL DEFAULT 'Pledged',
                    [LienMarkedDate] datetime2 NULL,
                    [LienReleasedDate] datetime2 NULL,
                    [Remarks] nvarchar(250) NULL,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE()
                );
                CREATE INDEX [IX_LoanDepositCollaterals_App] ON [LoanDepositCollaterals] ([LoanApplicationID]);
                CREATE INDEX [IX_LoanDepositCollaterals_Acc] ON [LoanDepositCollaterals] ([LoanAccountID]);
                CREATE INDEX [IX_LoanDepositCollaterals_Cust] ON [LoanDepositCollaterals] ([CustomerID]);
                CREATE INDEX [IX_LoanDepositCollaterals_Deposit] ON [LoanDepositCollaterals] ([CollateralType], [DepositAccountID]);
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAgentAccountTransfers')
            BEGIN
                CREATE TABLE [PigmyAgentAccountTransfers] (
                    [TransferID] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BatchNumber] nvarchar(50) NOT NULL,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [FromAgentID] int NOT NULL,
                    [ToAgentID] int NOT NULL,
                    [PigmyAccountID] int NOT NULL,
                    [TotalBalanceAtTransfer] decimal(18,2) NOT NULL DEFAULT 0,
                    [TransferredOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [TransferredBy] int NOT NULL DEFAULT 1,
                    [Reason] nvarchar(500) NOT NULL,
                    [TransferType] nvarchar(20) NOT NULL DEFAULT 'BULK'
                );
                CREATE INDEX [IX_PigmyAgentAccountTransfers_FromAgent] ON [PigmyAgentAccountTransfers] ([FromAgentID]);
                CREATE INDEX [IX_PigmyAgentAccountTransfers_ToAgent] ON [PigmyAgentAccountTransfers] ([ToAgentID]);
                CREATE INDEX [IX_PigmyAgentAccountTransfers_Account] ON [PigmyAgentAccountTransfers] ([PigmyAccountID]);
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanAccounts_Branch_AccountNo' AND object_id = OBJECT_ID('LoanAccounts'))
                BEGIN
                    SET QUOTED_IDENTIFIER ON;
                    SET ANSI_NULLS ON;
                    CREATE UNIQUE NONCLUSTERED INDEX [IX_LoanAccounts_Branch_AccountNo]
                    ON [dbo].[LoanAccounts] ([BranchID], [LoanAccountNo])
                    WHERE [LoanAccountNo] IS NOT NULL AND [LoanAccountNo] <> '';
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanAccounts_Branch_Scheme_Legacy' AND object_id = OBJECT_ID('LoanAccounts'))
                BEGIN
                    SET QUOTED_IDENTIFIER ON;
                    SET ANSI_NULLS ON;
                    CREATE NONCLUSTERED INDEX [IX_LoanAccounts_Branch_Scheme_Legacy]
                    ON [dbo].[LoanAccounts] ([BranchID], [LoanRateID], [LegacyAccountNumber])
                    WHERE [LegacyAccountNumber] IS NOT NULL AND [LegacyAccountNumber] <> '';
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Customers')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Customers_Branch_LegacyCustomerNo' AND object_id = OBJECT_ID('Customers'))
                BEGIN
                    SET QUOTED_IDENTIFIER ON;
                    SET ANSI_NULLS ON;
                    CREATE NONCLUSTERED INDEX [IX_Customers_Branch_LegacyCustomerNo]
                    ON [dbo].[Customers] ([BranchID], [LegacyCustomerNo])
                    WHERE [IsDeleted] = 0 AND [LegacyCustomerNo] IS NOT NULL AND [LegacyCustomerNo] <> '';
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FdAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FdAccounts_Branch_Scheme_Legacy' AND object_id = OBJECT_ID('FdAccounts'))
                BEGIN
                    SET QUOTED_IDENTIFIER ON;
                    SET ANSI_NULLS ON;
                    CREATE NONCLUSTERED INDEX [IX_FdAccounts_Branch_Scheme_Legacy]
                    ON [dbo].[FdAccounts] ([BranchID], [FdSchemeID], [LegacyAccountNumber])
                    WHERE [LegacyAccountNumber] IS NOT NULL AND [LegacyAccountNumber] <> '';
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Members')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Members_Branch_LegacyMemberNo' AND object_id = OBJECT_ID('Members'))
                BEGIN
                    SET QUOTED_IDENTIFIER ON;
                    SET ANSI_NULLS ON;
                    CREATE NONCLUSTERED INDEX [IX_Members_Branch_LegacyMemberNo]
                    ON [dbo].[Members] ([BranchID], [LegacyMemberNo])
                    WHERE [IsDeleted] = 0 AND [LegacyMemberNo] IS NOT NULL AND [LegacyMemberNo] <> '';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'IsDeleted')
                BEGIN
                    ALTER TABLE [Members] ADD [IsDeleted] bit NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'MembershipType')
                BEGIN
                    ALTER TABLE [Members] ADD [MembershipType] nvarchar(30) NOT NULL DEFAULT 'Regular';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[Members]') AND name = 'CustomerID')
                BEGIN
                    ALTER TABLE [Members] ADD [CustomerID] int NULL;
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

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingTransactions]') AND name = 'BranchID')
                BEGIN
                    ALTER TABLE [SavingTransactions] ADD [BranchID] int NOT NULL CONSTRAINT [DF_SavingTransactions_BranchID] DEFAULT 1;
                    
                    IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Branches')
                    BEGIN
                        ALTER TABLE [SavingTransactions] WITH CHECK ADD CONSTRAINT [FK_SavingTransactions_Branches_BranchID] FOREIGN KEY([BranchID]) REFERENCES [Branches] ([BranchID]);
                    END

                    -- Backfill existing SavingTransactions with their parent account's BranchID
                    UPDATE st
                    SET st.[BranchID] = ISNULL(sam.[BranchID], 1)
                    FROM [SavingTransactions] st
                    INNER JOIN [SavingAccountMasters] sam ON st.[SavingAccountID] = sam.[SavingAccountID]
                    WHERE sam.[BranchID] IS NOT NULL;

                    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SavingTransactions_BranchID_TransactionDate')
                    BEGIN
                        CREATE NONCLUSTERED INDEX [IX_SavingTransactions_BranchID_TransactionDate]
                        ON [SavingTransactions] ([BranchID], [TransactionDate]);
                    END
                END
            END

            -- FdSchemes & RdSchemes: Allow NULL BranchID for Global Bank-Wide Scoping
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FdSchemes')
            BEGIN
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdSchemes]') AND name = 'BranchID' AND is_nullable = 0)
                BEGIN
                    DECLARE @dfNameFd nvarchar(200);
                    SELECT @dfNameFd = dc.name FROM sys.default_constraints dc
                    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                    WHERE dc.parent_object_id = OBJECT_ID(N'[FdSchemes]') AND c.name = 'BranchID';
                    IF @dfNameFd IS NOT NULL EXEC('ALTER TABLE [FdSchemes] DROP CONSTRAINT ' + @dfNameFd);

                    ALTER TABLE [FdSchemes] ALTER COLUMN [BranchID] int NULL;

                    -- Existing BranchID = 1 schemes become Global (null)
                    UPDATE [FdSchemes] SET [BranchID] = NULL WHERE [BranchID] = 1;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RdSchemes')
            BEGIN
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdSchemes]') AND name = 'BranchID' AND is_nullable = 0)
                BEGIN
                    DECLARE @dfNameRd nvarchar(200);
                    SELECT @dfNameRd = dc.name FROM sys.default_constraints dc
                    JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                    WHERE dc.parent_object_id = OBJECT_ID(N'[RdSchemes]') AND c.name = 'BranchID';
                    IF @dfNameRd IS NOT NULL EXEC('ALTER TABLE [RdSchemes] DROP CONSTRAINT ' + @dfNameRd);

                    ALTER TABLE [RdSchemes] ALTER COLUMN [BranchID] int NULL;

                    -- Existing BranchID = 1 schemes become Global (null)
                    UPDATE [RdSchemes] SET [BranchID] = NULL WHERE [BranchID] = 1;
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
                    ALTER TABLE [SansthaDetails] ADD [AutoPostVoucherLimit] decimal(18,2) NOT NULL DEFAULT 0.00;
                END
                UPDATE [SansthaDetails] SET [AutoPostVouchers] = 0, [AutoPostVoucherLimit] = 0.00 WHERE [AutoPostVouchers] <> 0 OR [AutoPostVoucherLimit] <> 0; IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'IsMobileCompulsory')
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
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'FdRenewalReceiptPolicy')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [FdRenewalReceiptPolicy] nvarchar(30) NOT NULL DEFAULT 'NEW_RECEIPT';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'AllowManualReceiptNoOnRenewal')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [AllowManualReceiptNoOnRenewal] bit NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'AuthorizedShareCapital')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [AuthorizedShareCapital] decimal(18,2) NOT NULL DEFAULT 0.00;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'ShareFaceValue')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [ShareFaceValue] decimal(18,2) NOT NULL DEFAULT 100.00;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SansthaDetails]') AND name = 'AuthorizedShareCount')
                BEGIN
                    ALTER TABLE [SansthaDetails] ADD [AuthorizedShareCount] int NOT NULL DEFAULT 0;
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SansthaAuthorizedCapitalHistories')
            BEGIN
                CREATE TABLE [SansthaAuthorizedCapitalHistories] (
                    [HistoryID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [SansthaID] int NOT NULL DEFAULT 1,
                    [EffectiveDate] datetime2 NOT NULL,
                    [AuthorizedCapitalAmount] decimal(18,2) NOT NULL,
                    [ShareFaceValue] decimal(18,2) NOT NULL DEFAULT 100.00,
                    [AuthorizedShareCount] int NOT NULL DEFAULT 0,
                    [ResolutionNo] nvarchar(100) NULL,
                    [RegistrarApprovalNo] nvarchar(100) NULL,
                    [Remarks] nvarchar(500) NULL,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETDATE()
                );
                CREATE INDEX [IX_SansthaAuthorizedCapitalHistories_EffectiveDate]
                    ON [SansthaAuthorizedCapitalHistories]([SansthaID], [EffectiveDate] DESC);
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FdInterestAccruals')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdInterestAccruals]') AND name = 'PostingTarget')
                BEGIN
                    ALTER TABLE [FdInterestAccruals] ADD [PostingTarget] nvarchar(20) NOT NULL DEFAULT 'Provision';
                END
            END

            IF OBJECT_ID('dbo.FdTransactions', 'U') IS NOT NULL AND OBJECT_ID('dbo.Vouchers', 'U') IS NOT NULL
            BEGIN
                -- 1. Clean orphaned pre-v2.6.33 Accrual rows left behind when a closure voucher was deleted
                IF OBJECT_ID('dbo.FdInterestAccruals', 'U') IS NOT NULL
                BEGIN
                    DELETE t
                    FROM [dbo].[FdTransactions] t
                    WHERE t.TransactionType = 'Accrual'
                      AND NOT EXISTS (
                          SELECT 1 FROM [dbo].[FdInterestAccruals] a
                          WHERE a.FdAccountID = t.FdAccountID AND a.VoucherID = t.VoucherID
                      )
                      AND (
                          t.VoucherID IS NULL
                          OR NOT EXISTS (SELECT 1 FROM [dbo].[Vouchers] v WHERE v.VoucherID = t.VoucherID)
                      );
                END
                ELSE
                BEGIN
                    DELETE t
                    FROM [dbo].[FdTransactions] t
                    WHERE t.TransactionType = 'Accrual'
                      AND (
                          t.VoucherID IS NULL
                          OR NOT EXISTS (SELECT 1 FROM [dbo].[Vouchers] v WHERE v.VoucherID = t.VoucherID)
                      );
                END

                -- 2. Relabel live Closure/Renewal voucher Accrual rows as Closure_Interest
                UPDATE t
                SET t.TransactionType = 'Closure_Interest'
                FROM [dbo].[FdTransactions] t
                INNER JOIN [dbo].[Vouchers] v ON v.VoucherID = t.VoucherID
                WHERE t.TransactionType = 'Accrual'
                  AND (
                      v.VoucherNo LIKE '%-FD-CLOSE-%'
                      OR v.VoucherNo LIKE '%-FD-PRECLOSE-%'
                      OR v.VoucherNo LIKE '%-FD-REN-%'
                      OR v.VoucherNo LIKE '%-FD-AUTOREN-%'
                  );
            END

            -- -----------------------------------------------------------------------------------------
            -- CUSTOMER BULK & CIF SEQUENCE MODULE SELF-HEALING
            -- -----------------------------------------------------------------------------------------
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CifSequences')
            BEGIN
                CREATE TABLE [CifSequences] (
                    [SequenceID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [SequenceCode] nvarchar(50) NOT NULL UNIQUE,
                    [Prefix] nvarchar(10) NOT NULL DEFAULT 'CIF',
                    [CurrentValue] bigint NOT NULL DEFAULT 0,
                    [PaddingLength] int NOT NULL DEFAULT 6,
                    [LastUpdated] datetime2 NOT NULL DEFAULT GETUTCDATE()
                );
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CifSequences')
            BEGIN
                IF COL_LENGTH('CifSequences', 'SequenceCode') IS NULL ALTER TABLE [CifSequences] ADD [SequenceCode] nvarchar(50) NULL;
                IF COL_LENGTH('CifSequences', 'CurrentValue') IS NULL ALTER TABLE [CifSequences] ADD [CurrentValue] bigint NOT NULL DEFAULT 0;
                IF COL_LENGTH('CifSequences', 'PaddingLength') IS NULL ALTER TABLE [CifSequences] ADD [PaddingLength] int NOT NULL DEFAULT 6;
                IF COL_LENGTH('CifSequences', 'LastUpdated') IS NULL ALTER TABLE [CifSequences] ADD [LastUpdated] datetime2 NOT NULL DEFAULT GETUTCDATE();
            END

            -- Seed CifSequences with current max numeric CIF in Customers table
            IF NOT EXISTS (SELECT 1 FROM [CifSequences] WHERE [SequenceCode] = 'CORE_CIF_SEQ')
            BEGIN
                DECLARE @InitialCifNum bigint = 0;
                SELECT @InitialCifNum = ISNULL(MAX(CAST(SUBSTRING([CIFNo], 4, 10) AS bigint)), 0)
                FROM [Customers]
                WHERE [CIFNo] LIKE 'CIF%' AND ISNUMERIC(SUBSTRING([CIFNo], 4, 10)) = 1;

                INSERT INTO [CifSequences] ([SequenceCode], [Prefix], [CurrentValue], [PaddingLength], [LastUpdated])
                VALUES ('CORE_CIF_SEQ', 'CIF', @InitialCifNum, 6, GETUTCDATE());
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomerImportBatches')
            BEGIN
                CREATE TABLE [CustomerImportBatches] (
                    [BatchID] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BatchNumber] nvarchar(50) NOT NULL UNIQUE,
                    [FileName] nvarchar(255) NOT NULL DEFAULT 'DirectGridEntry',
                    [InputMode] nvarchar(20) NOT NULL DEFAULT 'DirectGrid',
                    [InstitutionID] int NOT NULL DEFAULT 1,
                    [HomeBranchID] int NOT NULL DEFAULT 1,
                    [TotalRecords] int NOT NULL DEFAULT 0,
                    [ValidRecords] int NOT NULL DEFAULT 0,
                    [InvalidRecords] int NOT NULL DEFAULT 0,
                    [ImportedRecords] int NOT NULL DEFAULT 0,
                    [SkippedRecords] int NOT NULL DEFAULT 0,
                    [Status] nvarchar(30) NOT NULL DEFAULT 'Completed',
                    [MakerUserID] int NOT NULL DEFAULT 1,
                    [MakerUsername] nvarchar(100) NOT NULL DEFAULT 'System',
                    [SubmittedOn] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [CheckerUserID] int NULL,
                    [CheckerUsername] nvarchar(100) NULL,
                    [ApprovedOn] datetime2 NULL,
                    [StartCif] nvarchar(20) NULL,
                    [EndCif] nvarchar(20) NULL,
                    [ExecutionTimeMs] bigint NOT NULL DEFAULT 0,
                    [RolledBackBy] int NULL,
                    [RolledBackUsername] nvarchar(100) NULL,
                    [RolledBackOn] datetime2 NULL,
                    [RollbackReason] nvarchar(500) NULL,
                    [SummaryJson] nvarchar(max) NULL,
                    [ErrorLogJson] nvarchar(max) NULL,
                    [CreatedOn] datetime2 NOT NULL DEFAULT GETUTCDATE()
                );
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomerImportBatches')
            BEGIN
                IF COL_LENGTH('CustomerImportBatches', 'InputMode') IS NULL ALTER TABLE [CustomerImportBatches] ADD [InputMode] nvarchar(20) NOT NULL DEFAULT 'DirectGrid';
                IF COL_LENGTH('CustomerImportBatches', 'MergedRecords') IS NULL ALTER TABLE [CustomerImportBatches] ADD [MergedRecords] int NOT NULL DEFAULT 0;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Customers')
            BEGIN
                IF COL_LENGTH('Customers', 'CustomerType') IS NULL ALTER TABLE [Customers] ADD [CustomerType] nvarchar(30) NOT NULL DEFAULT 'Individual';
                IF COL_LENGTH('Customers', 'KYCStatus') IS NULL ALTER TABLE [Customers] ADD [KYCStatus] nvarchar(20) NOT NULL DEFAULT 'Verified';
                IF COL_LENGTH('Customers', 'CKYCNo') IS NULL ALTER TABLE [Customers] ADD [CKYCNo] nvarchar(14) NULL;
                IF COL_LENGTH('Customers', 'RiskCategory') IS NULL ALTER TABLE [Customers] ADD [RiskCategory] nvarchar(20) NOT NULL DEFAULT 'Low';
                IF COL_LENGTH('Customers', 'HomeBranchID') IS NULL ALTER TABLE [Customers] ADD [HomeBranchID] int NULL;
                IF COL_LENGTH('Customers', 'ImportBatchID') IS NULL ALTER TABLE [Customers] ADD [ImportBatchID] bigint NULL;
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

            -- Auto-heal any invalid CustomerID = 0 and CIF000000 permanently
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Customers')
            BEGIN
                IF EXISTS (SELECT 1 FROM [Customers] WHERE [CustomerID] = 0)
                BEGIN
                    DECLARE @TargetCustId INT = 1;
                    IF EXISTS (SELECT 1 FROM [Customers] WHERE [CustomerID] = 1)
                        SET @TargetCustId = (SELECT ISNULL(MAX([CustomerID]), 1) + 1 FROM [Customers]);

                    DECLARE @CorrectedCif NVARCHAR(20) = 'CIF' + RIGHT('000000' + CAST(@TargetCustId AS VARCHAR(10)), 6);

                    SET IDENTITY_INSERT [Customers] ON;
                    INSERT INTO [Customers] (
                        [CustomerID], [BranchID], [CIFNo], [LegacyCustomerNo], [FirstName], [MiddleName], [LastName],
                        [NickName], [FirstNameEng], [MiddleNameEng], [LastNameEng], [Address], [AddressEng], [Village],
                        [Taluka], [District], [MobileNo], [AadhaarNo], [PANNo], [RegistrationDate], [NomineeName],
                        [NomineeNameEng], [NomineeRelation], [NomineeAddress], [NomineeBirthDate], [NomineeIsMinor],
                        [NomineeGuardianName], [PhotoPath], [SignaturePath], [AadhaarDocPath], [PanDocPath], [Gender],
                        [BirthDate], [Occupation], [CasteCategory], [Caste], [Email], [IsMinor], [GuardianName],
                        [GuardianNameEng], [GuardianRelation], [GuardianAadhaarNo], [GuardianMobileNo], [GuardianAddress],
                        [Status], [EmployerId], [IsDeleted], [CreatedBy], [CreatedOn], [UpdatedBy], [UpdatedOn]
                    )
                    SELECT 
                        @TargetCustId, [BranchID], @CorrectedCif, [LegacyCustomerNo],
                        [FirstName], [MiddleName], [LastName], [NickName], [FirstNameEng], [MiddleNameEng], [LastNameEng],
                        [Address], [AddressEng], [Village], [Taluka], [District], [MobileNo], [AadhaarNo], [PANNo],
                        [RegistrationDate], [NomineeName], [NomineeNameEng], [NomineeRelation], [NomineeAddress],
                        [NomineeBirthDate], [NomineeIsMinor], [NomineeGuardianName], [PhotoPath], [SignaturePath],
                        [AadhaarDocPath], [PanDocPath], [Gender], [BirthDate], [Occupation], [CasteCategory], [Caste],
                        [Email], [IsMinor], [GuardianName], [GuardianNameEng], [GuardianRelation], [GuardianAadhaarNo],
                        [GuardianMobileNo], [GuardianAddress], [Status], [EmployerId], [IsDeleted], [CreatedBy],
                        [CreatedOn], [UpdatedBy], [UpdatedOn]
                    FROM [Customers]
                    WHERE [CustomerID] = 0;
                    SET IDENTITY_INSERT [Customers] OFF;

                    IF OBJECT_ID(N'[Members]', N'U') IS NOT NULL
                    BEGIN
                        UPDATE [Members] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF COL_LENGTH('Members', 'CIFNo') IS NOT NULL
                            EXEC('UPDATE [Members] SET [CIFNo] = ''' + @CorrectedCif + ''' WHERE [CIFNo] = ''CIF000000'';');
                    END
                    IF OBJECT_ID(N'[SavingAccountMasters]', N'U') IS NOT NULL
                        UPDATE [SavingAccountMasters] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                    IF OBJECT_ID(N'[LoanAccounts]', N'U') IS NOT NULL
                        UPDATE [LoanAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                    IF OBJECT_ID(N'[FdAccounts]', N'U') IS NOT NULL
                        UPDATE [FdAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                    IF OBJECT_ID(N'[RdAccounts]', N'U') IS NOT NULL
                        UPDATE [RdAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                    IF OBJECT_ID(N'[PigmyAccounts]', N'U') IS NOT NULL
                        UPDATE [PigmyAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                    IF OBJECT_ID(N'[CustomerOpeningBalances]', N'U') IS NOT NULL
                    BEGIN
                        UPDATE [CustomerOpeningBalances] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CustomerOpeningBalances]') AND name = 'SourceModule')
                        BEGIN
                            ALTER TABLE [CustomerOpeningBalances] ADD [SourceModule] nvarchar(50) NOT NULL CONSTRAINT DF_CustomerOpeningBalances_SourceModule DEFAULT 'CustomerOpeningBalance';
                        END
                    END
                    IF OBJECT_ID(N'[LockerAllotments]', N'U') IS NOT NULL
                        UPDATE [LockerAllotments] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;
                    IF OBJECT_ID(N'[ShareAccounts]', N'U') IS NOT NULL
                        UPDATE [ShareAccounts] SET [CustomerID] = @TargetCustId WHERE [CustomerID] = 0;

                    DELETE FROM [Customers] WHERE [CustomerID] = 0;

                    DECLARE @MaxIdNow INT = (SELECT ISNULL(MAX([CustomerID]), 1) FROM [Customers]);
                    DBCC CHECKIDENT ('Customers', RESEED, @MaxIdNow);
                END

                -- Harmonize Customer & Member CIF numbers strictly 1-to-1 with CustomerID
                UPDATE c
                SET c.[CIFNo] = 'CIF' + RIGHT('000000' + CAST(c.[CustomerID] AS VARCHAR(10)), 6)
                FROM [Customers] c
                WHERE c.[CIFNo] IS NULL OR c.[CIFNo] = '' OR c.[CIFNo] LIKE 'TEMP%' OR c.[CIFNo] = 'CIF000000';

                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Members') AND COL_LENGTH('Members', 'CIFNo') IS NOT NULL
                BEGIN
                    EXEC('
                        UPDATE m
                        SET m.[CIFNo] = ISNULL(c.[CIFNo], ''CIF'' + RIGHT(''000000'' + CAST(m.[MemberID] AS VARCHAR(10)), 6))
                        FROM [Members] m
                        LEFT JOIN [Customers] c ON (m.[CustomerID] = c.[CustomerID] OR m.[MemberID] = c.[CustomerID])
                        WHERE m.[CIFNo] IS NULL OR m.[CIFNo] = '''' OR m.[CIFNo] = ''CIF000000'';
                    ');
                END
            END

            -- Universal verification for CustomerOpeningBalances SourceModule and other tables
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'CustomerOpeningBalances')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[CustomerOpeningBalances]') AND name = 'SourceModule')
                BEGIN
                    ALTER TABLE [CustomerOpeningBalances] ADD [SourceModule] nvarchar(50) NOT NULL CONSTRAINT DF_CustomerOpeningBalances_SourceModule DEFAULT 'CustomerOpeningBalance';
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingAccountJointHolders')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountJointHolders]') AND name = 'MemberID')
                    ALTER TABLE [SavingAccountJointHolders] ADD [MemberID] int NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingInterestSettings')
            BEGIN
                IF COL_LENGTH('SavingInterestSettings', 'MinimumBalance') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[SavingInterestSettings]
                    ADD [MinimumBalance] decimal(18,2) NOT NULL
                    CONSTRAINT [DF_SavingInterestSettings_MinimumBalance] DEFAULT 500.00;
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
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdSchemes]') AND name = 'AllowOverdueInterest')
                BEGIN
                    ALTER TABLE [FdSchemes] ADD [AllowOverdueInterest] bit NOT NULL CONSTRAINT [DF_FdSchemes_AllowOverdueInterest] DEFAULT 0;
                    ALTER TABLE [FdSchemes] ADD [OverdueInterestRate] decimal(5,2) NULL;
                    ALTER TABLE [FdSchemes] ADD [OverdueGraceDays] int NOT NULL CONSTRAINT [DF_FdSchemes_OverdueGraceDays] DEFAULT 0;
                    ALTER TABLE [FdSchemes] ADD [OverdueRenewalPolicy] nvarchar(50) NOT NULL CONSTRAINT [DF_FdSchemes_OverdueRenewalPolicy] DEFAULT 'ClosureDate';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdSchemes]') AND name = 'InterestPayoutFrequency')
                BEGIN
                    ALTER TABLE [FdSchemes] ADD [InterestPayoutFrequency] nvarchar(30) NOT NULL CONSTRAINT [DF_FdSchemes_InterestPayoutFrequency] DEFAULT 'At Maturity';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdSchemes]') AND name = 'InterestCalculationMethod')
                BEGIN
                    ALTER TABLE [FdSchemes] ADD [InterestCalculationMethod] nvarchar(20) NOT NULL CONSTRAINT [DF_FdSchemes_InterestCalculationMethod] DEFAULT 'Monthly';
                    EXEC(N'UPDATE [FdSchemes] SET [InterestCalculationMethod] = ''Daily'' WHERE [DurationType] = ''Days'' OR [SchemeDurationModel] = ''Slab'';');
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

                -- Ensure FdAccounts is strictly CustomerID (CIF-First) architecture
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_FdAccounts_Members_MemberID')
                    ALTER TABLE [FdAccounts] DROP CONSTRAINT [FK_FdAccounts_Members_MemberID];
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FdAccounts_MemberID' AND object_id = OBJECT_ID('FdAccounts'))
                    DROP INDEX [IX_FdAccounts_MemberID] ON [FdAccounts];
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('FdAccounts') AND name = 'MemberID')
                    ALTER TABLE [FdAccounts] DROP COLUMN [MemberID];
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FdAccounts_CustomerID' AND object_id = OBJECT_ID('FdAccounts'))
                    CREATE INDEX [IX_FdAccounts_CustomerID] ON [FdAccounts] ([CustomerID]);

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'IsAutoRenewable')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [IsAutoRenewable] bit NOT NULL CONSTRAINT [DF_FdAccounts_IsAutoRenewable] DEFAULT 0;
                    ALTER TABLE [FdAccounts] ADD [AutoRenewalOption] nvarchar(30) NOT NULL CONSTRAINT [DF_FdAccounts_AutoRenewalOption] DEFAULT 'PrincipalPlusInterest';
                    ALTER TABLE [FdAccounts] ADD [MaxAutoRenewalCycles] int NOT NULL CONSTRAINT [DF_FdAccounts_MaxAutoRenewalCycles] DEFAULT 3;
                    ALTER TABLE [FdAccounts] ADD [AutoRenewalCount] int NOT NULL CONSTRAINT [DF_FdAccounts_AutoRenewalCount] DEFAULT 0;
                    ALTER TABLE [FdAccounts] ADD [ParentFdAccountID] int NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FdAutoRenewalLogs')
                BEGIN
                    CREATE TABLE [dbo].[FdAutoRenewalLogs] (
                        [LogID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [InstitutionID] int NOT NULL DEFAULT 1,
                        [BranchID] int NOT NULL DEFAULT 1,
                        [BatchDate] datetime2 NOT NULL DEFAULT GETDATE(),
                        [OldFdAccountID] int NOT NULL,
                        [NewFdAccountID] int NULL,
                        [OldAccountNo] nvarchar(30) NOT NULL DEFAULT '',
                        [NewAccountNo] nvarchar(30) NULL,
                        [CustomerID] int NOT NULL DEFAULT 0,
                        [CustomerName] nvarchar(150) NOT NULL DEFAULT '',
                        [RenewalOption] nvarchar(30) NOT NULL DEFAULT 'PrincipalPlusInterest',
                        [RenewedAmount] decimal(18,2) NOT NULL DEFAULT 0,
                        [InterestPaidOut] decimal(18,2) NOT NULL DEFAULT 0,
                        [AppliedRate] decimal(5,2) NOT NULL DEFAULT 0,
                        [VoucherID] int NULL,
                        [Status] nvarchar(20) NOT NULL DEFAULT 'Success',
                        [ErrorMessage] nvarchar(500) NULL,
                        [ExecutedBy] nvarchar(100) NOT NULL DEFAULT 'System-EOD',
                        [ExecutionTime] datetime2 NOT NULL DEFAULT GETDATE(),
                        [IsReverted] bit NOT NULL DEFAULT 0,
                        [RevertedDate] datetime2 NULL,
                        [RevertedBy] nvarchar(100) NULL,
                        [RevertReason] nvarchar(250) NULL
                    );
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

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAgentCashDeposits')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgentCashDeposits]') AND name = 'CollectionDateFrom')
                BEGIN
                    ALTER TABLE [PigmyAgentCashDeposits] ADD [CollectionDateFrom] datetime2 NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgentCashDeposits]') AND name = 'CollectionDateTo')
                BEGIN
                    ALTER TABLE [PigmyAgentCashDeposits] ADD [CollectionDateTo] datetime2 NULL;
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

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAccounts]') AND name = 'OldAccountNo')
                BEGIN
                    ALTER TABLE [PigmyAccounts] ADD [OldAccountNo] nvarchar(50) NULL;
                    EXEC(N'UPDATE [PigmyAccounts] SET [OldAccountNo] = COALESCE([LegacyAccountNumber], [PreviousAccountNo]) WHERE [OldAccountNo] IS NULL AND ([LegacyAccountNumber] IS NOT NULL OR [PreviousAccountNo] IS NOT NULL);');
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAccounts]') AND name = 'DailyDepositAmount')
                BEGIN
                    ALTER TABLE [PigmyAccounts] ADD [DailyDepositAmount] decimal(18,2) NOT NULL DEFAULT 100;
                END
            END

            -- Doorstep Multi-Product Collection & Privacy Control Self-Healing
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'IsAgentCollectionAllowed')
                    ALTER TABLE [LoanAccounts] ADD [IsAgentCollectionAllowed] bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'AssignedAgentID')
                    ALTER TABLE [LoanAccounts] ADD [AssignedAgentID] int NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingAccountMasters')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountMasters]') AND name = 'IsAgentCollectionAllowed')
                    ALTER TABLE [SavingAccountMasters] ADD [IsAgentCollectionAllowed] bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingAccountMasters]') AND name = 'AssignedAgentID')
                    ALTER TABLE [SavingAccountMasters] ADD [AssignedAgentID] int NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RdAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'IsAgentCollectionAllowed')
                    ALTER TABLE [RdAccounts] ADD [IsAgentCollectionAllowed] bit NOT NULL DEFAULT 0;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'AssignedAgentID')
                    ALTER TABLE [RdAccounts] ADD [AssignedAgentID] int NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanCollections')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanCollections]') AND name = 'AgentID')
                    ALTER TABLE [LoanCollections] ADD [AgentID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanCollections]') AND name = 'CollectionSource')
                    ALTER TABLE [LoanCollections] ADD [CollectionSource] varchar(20) NOT NULL DEFAULT 'COUNTER';
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanCollections]') AND name = 'SyncReferenceId')
                    ALTER TABLE [LoanCollections] ADD [SyncReferenceId] varchar(100) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanCollections]') AND name = 'TransactionId')
                    ALTER TABLE [LoanCollections] ADD [TransactionId] varchar(100) NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SavingTransactions')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingTransactions]') AND name = 'AgentID')
                    ALTER TABLE [SavingTransactions] ADD [AgentID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingTransactions]') AND name = 'CollectionSource')
                    ALTER TABLE [SavingTransactions] ADD [CollectionSource] varchar(20) NOT NULL DEFAULT 'COUNTER';
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingTransactions]') AND name = 'SyncReferenceId')
                    ALTER TABLE [SavingTransactions] ADD [SyncReferenceId] varchar(100) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[SavingTransactions]') AND name = 'TransactionId')
                    ALTER TABLE [SavingTransactions] ADD [TransactionId] varchar(100) NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RdTransactions')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdTransactions]') AND name = 'AgentID')
                    ALTER TABLE [RdTransactions] ADD [AgentID] int NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdTransactions]') AND name = 'CollectionSource')
                    ALTER TABLE [RdTransactions] ADD [CollectionSource] varchar(20) NOT NULL DEFAULT 'COUNTER';
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdTransactions]') AND name = 'SyncReferenceId')
                    ALTER TABLE [RdTransactions] ADD [SyncReferenceId] varchar(100) NULL;
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdTransactions]') AND name = 'TransactionId')
                    ALTER TABLE [RdTransactions] ADD [TransactionId] varchar(100) NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyCommissionSettings')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyCommissionSettings]') AND name = 'ProductType')
                    ALTER TABLE [PigmyCommissionSettings] ADD [ProductType] varchar(20) NOT NULL DEFAULT 'PIGMY';
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'PigmyAgentCommissions')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgentCommissions]') AND name = 'ProductType')
                    ALTER TABLE [PigmyAgentCommissions] ADD [ProductType] varchar(20) NOT NULL DEFAULT 'PIGMY';
            END


            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'AgentCustomerRequests')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[AgentCustomerRequests]') AND name = 'OldAccountNo')
                BEGIN
                    ALTER TABLE [AgentCustomerRequests] ADD [OldAccountNo] nvarchar(50) NULL;
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

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FdAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'LastInterestPostingDate')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [LastInterestPostingDate] datetime2 NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'LastInterestPostingDate')
                BEGIN
                    ALTER TABLE [LoanAccounts] ADD [LastInterestPostingDate] datetime2 NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'PurePrincipalBalance')
                BEGIN
                    ALTER TABLE [LoanAccounts] ADD [PurePrincipalBalance] decimal(18,2) NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'CapitalizedInterestAmount')
                BEGIN
                    ALTER TABLE [LoanAccounts] ADD [CapitalizedInterestAmount] decimal(18,2) NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'InterestProvisionBalance')
                BEGIN
                    ALTER TABLE [LoanAccounts] ADD [InterestProvisionBalance] decimal(18,2) NOT NULL DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'InitialNpaClassification')
                BEGIN
                    ALTER TABLE [LoanAccounts] ADD [InitialNpaClassification] nvarchar(20) NOT NULL DEFAULT 'Standard';
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[LoanAccounts]') AND name = 'ChargeInterestOnCapitalizedAmount')
                BEGIN
                    ALTER TABLE [LoanAccounts] ADD [ChargeInterestOnCapitalizedAmount] bit NOT NULL DEFAULT 1;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanDisbursements') AND EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanAccounts')
            BEGIN
                -- Self-healing: Ensure Opening Balance LoanDisbursements record SanctionedAmount as DisbursementAmount
                UPDATE ld
                SET ld.SanctionedAmount = la.SanctionedAmount,
                    ld.DisbursementAmount = la.SanctionedAmount,
                    ld.NetAmountPaid = la.SanctionedAmount
                FROM [LoanDisbursements] ld
                INNER JOIN [LoanAccounts] la ON ld.LoanAccountID = la.LoanAccountID
                WHERE (ld.PaymentMode = 'Opening Balance' OR ld.Remarks LIKE '%Opening Balance%')
                  AND la.IsOpeningBalance = 1
                  AND (ld.DisbursementAmount <> la.SanctionedAmount OR ld.NetAmountPaid <> la.SanctionedAmount OR ld.SanctionedAmount <> la.SanctionedAmount);
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanRates')
            BEGIN
                -- Fix NULL or empty LoanCode
                UPDATE [dbo].[LoanRates]
                SET [LoanCode] = 'LN' + RIGHT('00' + CAST([LoanRateID] AS NVARCHAR(10)), 2)
                WHERE [LoanCode] IS NULL OR LTRIM(RTRIM([LoanCode])) = '';

                -- Trim whitespace
                UPDATE [dbo].[LoanRates]
                SET [LoanCode] = LTRIM(RTRIM([LoanCode]))
                WHERE [LoanCode] <> LTRIM(RTRIM([LoanCode]));

                -- Auto-heal duplicate LoanCode before creating UNIQUE INDEX
                ;WITH DupCodeCTE AS (
                    SELECT LoanRateID, LoanCode,
                           ROW_NUMBER() OVER(PARTITION BY LOWER(LTRIM(RTRIM(LoanCode))) ORDER BY LoanRateID) as rn
                    FROM [dbo].[LoanRates]
                )
                UPDATE lr
                SET lr.LoanCode = 'LN' + RIGHT('00' + CAST(lr.LoanRateID AS NVARCHAR(10)), 2)
                FROM [dbo].[LoanRates] lr
                INNER JOIN DupCodeCTE cte ON lr.LoanRateID = cte.LoanRateID
                WHERE cte.rn > 1;

                -- Ensure Unique Index on LoanCode
                IF NOT EXISTS (
                    SELECT * FROM sys.indexes 
                    WHERE name = 'IX_LoanRates_LoanCode' 
                      AND object_id = OBJECT_ID('dbo.LoanRates')
                )
                BEGIN
                    CREATE UNIQUE NONCLUSTERED INDEX [IX_LoanRates_LoanCode] 
                    ON [dbo].[LoanRates]([LoanCode]) 
                    WHERE [LoanCode] IS NOT NULL AND [LoanCode] <> '';
                END

                -- Fix NULL or empty LoanType
                UPDATE [dbo].[LoanRates]
                SET [LoanType] = N'कर्ज योजना ' + CAST([LoanRateID] AS NVARCHAR(10))
                WHERE [LoanType] IS NULL OR LTRIM(RTRIM([LoanType])) = '';

                -- Trim whitespace
                UPDATE [dbo].[LoanRates]
                SET [LoanType] = LTRIM(RTRIM([LoanType]))
                WHERE [LoanType] <> LTRIM(RTRIM([LoanType]));

                -- Drop Unique Index on LoanType if it exists so multiple schemes of same LoanType (e.g. multiple vehicle loans) can be created
                IF EXISTS (
                    SELECT * FROM sys.indexes 
                    WHERE name = 'IX_LoanRates_LoanType' 
                      AND object_id = OBJECT_ID('dbo.LoanRates')
                )
                BEGIN
                    DROP INDEX [IX_LoanRates_LoanType] ON [dbo].[LoanRates];
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanRateHistories')
            BEGIN
                CREATE TABLE [dbo].[LoanRateHistories] (
                    [HistoryID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [LoanRateID] INT NOT NULL,
                    [OldInterestRate] DECIMAL(18,2) NOT NULL,
                    [NewInterestRate] DECIMAL(18,2) NOT NULL,
                    [OldOverdueInterestRate] DECIMAL(18,2) NOT NULL,
                    [NewOverdueInterestRate] DECIMAL(18,2) NOT NULL,
                    [ResolutionNo] NVARCHAR(100) NOT NULL DEFAULT '',
                    [ResolutionDate] DATETIME2 NULL,
                    [EffectiveDate] DATETIME2 NOT NULL DEFAULT GETDATE(),
                    [Reason] NVARCHAR(500) NULL,
                    [ChangedByUserID] INT NOT NULL DEFAULT 1,
                    [ChangedByUsername] NVARCHAR(100) NOT NULL DEFAULT 'System',
                    [ChangedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
                    [IPAddress] NVARCHAR(50) NULL,
                    CONSTRAINT [FK_LoanRateHistories_LoanRates] FOREIGN KEY ([LoanRateID]) 
                        REFERENCES [dbo].[LoanRates]([LoanRateID]) ON DELETE CASCADE
                );

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanRateHistories_LoanRateID' AND object_id = OBJECT_ID('dbo.LoanRateHistories'))
                BEGIN
                    CREATE NONCLUSTERED INDEX [IX_LoanRateHistories_LoanRateID] ON [dbo].[LoanRateHistories]([LoanRateID] ASC);
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanRateHistories_EffectiveDate' AND object_id = OBJECT_ID('dbo.LoanRateHistories'))
                BEGIN
                    CREATE NONCLUSTERED INDEX [IX_LoanRateHistories_EffectiveDate] ON [dbo].[LoanRateHistories]([EffectiveDate] DESC);
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
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InvestmentSchemes' AND COLUMN_NAME = 'InterestRate' AND NUMERIC_PRECISION < 18)
                BEGIN
                    ALTER TABLE [dbo].[InvestmentSchemes] ALTER COLUMN [InterestRate] DECIMAL(18,2) NOT NULL;
                END
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InvestmentSchemes' AND COLUMN_NAME = 'PrematureWithdrawalRate' AND NUMERIC_PRECISION < 18)
                BEGIN
                    ALTER TABLE [dbo].[InvestmentSchemes] ALTER COLUMN [PrematureWithdrawalRate] DECIMAL(18,2) NOT NULL;
                END
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentAccounts')
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[InvestmentAccounts]') AND name = 'DepositReceiptNo')
                BEGIN
                    ALTER TABLE [InvestmentAccounts] ADD [DepositReceiptNo] nvarchar(50) NULL;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[InvestmentAccounts]') AND name = 'OldInvestmentNo')
                BEGIN
                    ALTER TABLE [InvestmentAccounts] ADD [OldInvestmentNo] nvarchar(50) NULL;
                END
                IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InvestmentAccounts' AND COLUMN_NAME = 'InterestRate' AND NUMERIC_PRECISION < 18)
                BEGIN
                    ALTER TABLE [dbo].[InvestmentAccounts] ALTER COLUMN [InterestRate] DECIMAL(18,2) NOT NULL;
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

            -- Maharashtra Circular Swanidhi (Rule 35) Tables Safety Creation
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SwanidhiLedgerMappings')
            BEGIN
                CREATE TABLE [SwanidhiLedgerMappings] (
                    [MappingID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CategoryCode] nvarchar(50) NOT NULL,
                    [CategoryName] nvarchar(150) NOT NULL,
                    [LedgerID] int NOT NULL,
                    [CreatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT [FK_SwanidhiLedgerMappings_Ledgers_LedgerID] FOREIGN KEY ([LedgerID]) REFERENCES [Ledgers] ([LedgerID])
                );
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SwanidhiSettings')
            BEGIN
                CREATE TABLE [SwanidhiSettings] (
                    [SettingID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [BorrowingLimitMultiplier] decimal(5,2) NOT NULL DEFAULT 10.00,
                    [Year1DividendRate] decimal(5,2) NOT NULL DEFAULT 0.00,
                    [Year2DividendRate] decimal(5,2) NOT NULL DEFAULT 0.00,
                    [Year3DividendRate] decimal(5,2) NOT NULL DEFAULT 0.00,
                    [ManualCertifiedNetProfit] decimal(18,2) NULL,
                    [UpdatedOn] datetime2 NOT NULL DEFAULT GETDATE()
                );

                INSERT INTO [SwanidhiSettings] ([BranchID], [BorrowingLimitMultiplier], [Year1DividendRate], [Year2DividendRate], [Year3DividendRate], [UpdatedOn])
                VALUES (1, 10.00, 9.00, 9.00, 9.00, GETDATE());
            END

            -- Initial smart auto-seed for Swanidhi mappings if empty
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'SwanidhiLedgerMappings') AND (SELECT COUNT(*) FROM [SwanidhiLedgerMappings]) = 0
            BEGIN
                -- 1. Paid-up Share Capital
                INSERT INTO [SwanidhiLedgerMappings] ([CategoryCode], [CategoryName], [LedgerID], [CreatedOn], [UpdatedOn])
                SELECT 'PAID_UP_CAPITAL', N'१. वसूल भाग भांडवल', [LedgerID], GETDATE(), GETDATE()
                FROM [Ledgers]
                WHERE [IsActive] = 1 AND ([LedgerName] LIKE N'%भाग भांडवल%' OR [LedgerName] LIKE N'%सभासद भाग%' OR [LedgerName] LIKE N'%Share%');

                -- 2. Statutory Reserve Fund
                INSERT INTO [SwanidhiLedgerMappings] ([CategoryCode], [CategoryName], [LedgerID], [CreatedOn], [UpdatedOn])
                SELECT 'STATUTORY_RESERVE', N'२. राखीव निधी', [LedgerID], GETDATE(), GETDATE()
                FROM [Ledgers]
                WHERE [IsActive] = 1 AND ([LedgerName] LIKE N'%राखीव निधी%' OR [LedgerName] LIKE N'%Reserve Fund%');

                -- 3. Building Fund
                INSERT INTO [SwanidhiLedgerMappings] ([CategoryCode], [CategoryName], [LedgerID], [CreatedOn], [UpdatedOn])
                SELECT 'BUILDING_FUND', N'३. इमारत निधी', [LedgerID], GETDATE(), GETDATE()
                FROM [Ledgers]
                WHERE [IsActive] = 1 AND ([LedgerName] LIKE N'%इमारत निधी%' OR [LedgerName] LIKE N'%Building Fund%');

                -- 4. Free and Development Reserves
                INSERT INTO [SwanidhiLedgerMappings] ([CategoryCode], [CategoryName], [LedgerID], [CreatedOn], [UpdatedOn])
                SELECT 'FREE_AND_DEVELOPMENT_RESERVE', N'४. मुक्त व विकास निधी (स्पष्टीकरण-१)', [LedgerID], GETDATE(), GETDATE()
                FROM [Ledgers]
                WHERE [IsActive] = 1 AND ([LedgerName] LIKE N'%लाभांश सम%' OR [LedgerName] LIKE N'%तंत्रज्ञान विकास%' OR [LedgerName] LIKE N'%Dividend Equal%');

                -- 5. Standard Asset Provision
                INSERT INTO [SwanidhiLedgerMappings] ([CategoryCode], [CategoryName], [LedgerID], [CreatedOn], [UpdatedOn])
                SELECT 'STANDARD_ASSET_PROVISION', N'५. उत्तम जिंदगी तरतूद', [LedgerID], GETDATE(), GETDATE()
                FROM [Ledgers]
                WHERE [IsActive] = 1 AND ([LedgerName] LIKE N'%उत्तम जिंदगी%' OR [LedgerName] LIKE N'%Standard Asset%');

                -- 6. Accumulated Loss
                INSERT INTO [SwanidhiLedgerMappings] ([CategoryCode], [CategoryName], [LedgerID], [CreatedOn], [UpdatedOn])
                SELECT 'ACCUMULATED_LOSS', N'ब. संचित तोटा', [LedgerID], GETDATE(), GETDATE()
                FROM [Ledgers]
                WHERE [IsActive] = 1 AND ([LedgerName] LIKE N'%संचित तोटा%' OR [LedgerName] LIKE N'%चालू तोटा%');

                -- 7. Excluded Reserves
                INSERT INTO [SwanidhiLedgerMappings] ([CategoryCode], [CategoryName], [LedgerID], [CreatedOn], [UpdatedOn])
                SELECT 'EXCLUDED_RESERVES', N'वगळलेले बाह्य देयता निधी', [LedgerID], GETDATE(), GETDATE()
                FROM [Ledgers]
                WHERE [IsActive] = 1 AND ([LedgerName] LIKE N'%कल्याण%' OR [LedgerName] LIKE N'%धर्मादाय%' OR [LedgerName] LIKE N'%घसारा%' OR [LedgerName] LIKE N'%संशयित बुडीत%' OR [ExcludeFromRule35Swanidhi] = 1)
                  AND [LedgerID] NOT IN (SELECT [LedgerID] FROM [SwanidhiLedgerMappings]);
            END

            -- Section 101/91 Legal Recovery Tables & Customer-First Column Sync
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LegalRecoveryLedgerMappings')
            BEGIN
                CREATE TABLE [dbo].[LegalRecoveryLedgerMappings] (
                    [MappingId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchId] int NULL,
                    [TransactionType] nvarchar(50) NOT NULL,
                    [DebitLedgerId] int NOT NULL,
                    [CreditLedgerId] int NOT NULL,
                    [IsActive] bit NOT NULL DEFAULT 1,
                    [UpdatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    CONSTRAINT [FK_LegalRecoveryLedgerMappings_Branches_BranchId] FOREIGN KEY ([BranchId]) REFERENCES [dbo].[Branches]([BranchID]),
                    CONSTRAINT [FK_LegalRecoveryLedgerMappings_Ledgers_DebitLedgerId] FOREIGN KEY ([DebitLedgerId]) REFERENCES [dbo].[Ledgers]([LedgerID]),
                    CONSTRAINT [FK_LegalRecoveryLedgerMappings_Ledgers_CreditLedgerId] FOREIGN KEY ([CreditLedgerId]) REFERENCES [dbo].[Ledgers]([LedgerID])
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('LegalRecoveryLedgerMappings', 'UpdatedAt') IS NULL
                    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ADD [UpdatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE();
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'LegalRecoveryLedgerMappings' AND COLUMN_NAME = 'BranchId' AND IS_NULLABLE = 'NO')
                BEGIN
                    ALTER TABLE [dbo].[LegalRecoveryLedgerMappings] ALTER COLUMN [BranchId] int NULL;
                    UPDATE [dbo].[LegalRecoveryLedgerMappings] SET [BranchId] = NULL WHERE [BranchId] = 0;
                END
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101CaseMasters')
            BEGIN
                CREATE TABLE [dbo].[Sec101CaseMasters] (
                    [CaseId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchId] int NOT NULL DEFAULT 1,
                    [LoanAccountId] int NOT NULL,
                    [CustomerId] int NULL,
                    [MemberId] int NULL,
                    [CaseType] nvarchar(20) NOT NULL DEFAULT 'SEC_101',
                    [CaseNumber] nvarchar(100) NOT NULL,
                    [CourtName] nvarchar(200) NOT NULL DEFAULT N'मा. सहाय्यक निबंधक, सहकारी संस्था',
                    [AdvocateName] nvarchar(100) NULL,
                    [FilingDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [PrincipalClaim] decimal(18,2) NOT NULL DEFAULT 0,
                    [InterestClaim] decimal(18,2) NOT NULL DEFAULT 0,
                    [PenalInterestClaim] decimal(18,2) NOT NULL DEFAULT 0,
                    [OtherChargesClaim] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalClaimAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [CourtFeeAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [CourtFeeChallanNo] nvarchar(50) NULL,
                    [CertificateNo] nvarchar(50) NULL,
                    [CertificateDate] datetime2 NULL,
                    [SanctionedAmount] decimal(18,2) NULL,
                    [FutureInterestRate] decimal(18,2) NULL,
                    [AwardNumber] nvarchar(100) NULL,
                    [AwardDate] datetime2 NULL,
                    [TransferCertificateNo] nvarchar(100) NULL,
                    [StayOrderNo] nvarchar(100) NULL,
                    [StayOrderDate] datetime2 NULL,
                    [ClosedReason] nvarchar(500) NULL,
                    [ClosedDate] datetime2 NULL,
                    [Status] nvarchar(50) NOT NULL DEFAULT 'FILED',
                    [Remarks] nvarchar(max) NULL,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [CreatedBy] int NOT NULL DEFAULT 1
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('Sec101CaseMasters', 'CustomerId') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CustomerId] int NULL;
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Sec101CaseMasters' AND COLUMN_NAME = 'MemberId' AND IS_NULLABLE = 'NO')
                    ALTER TABLE [dbo].[Sec101CaseMasters] ALTER COLUMN [MemberId] int NULL;
                IF COL_LENGTH('Sec101CaseMasters', 'CaseType') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [CaseType] nvarchar(20) NOT NULL CONSTRAINT [DF_Sec101CaseMasters_CaseType] DEFAULT 'SEC_101';
                IF COL_LENGTH('Sec101CaseMasters', 'AwardNumber') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [AwardNumber] nvarchar(100) NULL;
                IF COL_LENGTH('Sec101CaseMasters', 'AwardDate') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [AwardDate] datetime2 NULL;
                IF COL_LENGTH('Sec101CaseMasters', 'TransferCertificateNo') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [TransferCertificateNo] nvarchar(100) NULL;
                IF COL_LENGTH('Sec101CaseMasters', 'StayOrderNo') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [StayOrderNo] nvarchar(100) NULL;
                IF COL_LENGTH('Sec101CaseMasters', 'StayOrderDate') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [StayOrderDate] datetime2 NULL;
                IF COL_LENGTH('Sec101CaseMasters', 'ClosedReason') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [ClosedReason] nvarchar(500) NULL;
                IF COL_LENGTH('Sec101CaseMasters', 'ClosedDate') IS NULL
                    ALTER TABLE [dbo].[Sec101CaseMasters] ADD [ClosedDate] datetime2 NULL;
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Sec101CaseMasters' AND COLUMN_NAME = 'CaseNumber' AND CHARACTER_MAXIMUM_LENGTH < 100)
                    ALTER TABLE [dbo].[Sec101CaseMasters] ALTER COLUMN [CaseNumber] nvarchar(100) NOT NULL;
                IF COL_LENGTH('Sec101CaseMasters', 'CustomerId') IS NOT NULL
                    EXEC(N'UPDATE cm SET cm.[CustomerId] = COALESCE(la.[CustomerID], m.[CustomerID]) FROM [dbo].[Sec101CaseMasters] cm LEFT JOIN [dbo].[LoanAccounts] la ON cm.[LoanAccountId] = la.[LoanAccountID] LEFT JOIN [dbo].[Members] m ON cm.[MemberId] = m.[MemberID] WHERE cm.[CustomerId] IS NULL;');
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101NoticeHistories')
            BEGIN
                CREATE TABLE [dbo].[Sec101NoticeHistories] (
                    [NoticeId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchId] int NOT NULL DEFAULT 1,
                    [LoanAccountId] int NOT NULL,
                    [CustomerId] int NULL,
                    [MemberId] int NULL,
                    [CaseType] nvarchar(20) NOT NULL DEFAULT 'SEC_101',
                    [RecipientType] nvarchar(30) NOT NULL DEFAULT 'BORROWER',
                    [RecipientCustomerId] int NULL,
                    [RecipientName] nvarchar(200) NULL,
                    [RecipientAddress] nvarchar(500) NULL,
                    [NoticeType] nvarchar(50) NOT NULL DEFAULT 'NOTICE_1',
                    [NoticeNumber] nvarchar(100) NOT NULL,
                    [NoticeDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [DueDate] datetime2 NOT NULL DEFAULT DATEADD(day, 15, GETDATE()),
                    [PrincipalDue] decimal(18,2) NOT NULL DEFAULT 0,
                    [InterestDue] decimal(18,2) NOT NULL DEFAULT 0,
                    [PenalInterestDue] decimal(18,2) NOT NULL DEFAULT 0,
                    [NoticeFee] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalDemandAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [PostalTrackingNo] nvarchar(100) NULL,
                    [PostalStatus] nvarchar(50) NOT NULL DEFAULT 'DISPATCHED',
                    [DeliveredDate] datetime2 NULL,
                    [Remarks] nvarchar(max) NULL,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [CreatedBy] int NOT NULL DEFAULT 1
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('Sec101NoticeHistories', 'CustomerId') IS NULL
                    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [CustomerId] int NULL;
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Sec101NoticeHistories' AND COLUMN_NAME = 'MemberId' AND IS_NULLABLE = 'NO')
                    ALTER TABLE [dbo].[Sec101NoticeHistories] ALTER COLUMN [MemberId] int NULL;
                IF COL_LENGTH('Sec101NoticeHistories', 'CaseType') IS NULL
                    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [CaseType] nvarchar(20) NOT NULL CONSTRAINT [DF_Sec101NoticeHistories_CaseType] DEFAULT 'SEC_101';
                IF COL_LENGTH('Sec101NoticeHistories', 'RecipientType') IS NULL
                    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [RecipientType] nvarchar(30) NOT NULL CONSTRAINT [DF_Sec101NoticeHistories_RecipientType] DEFAULT 'BORROWER';
                IF COL_LENGTH('Sec101NoticeHistories', 'RecipientCustomerId') IS NULL
                    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [RecipientCustomerId] int NULL;
                IF COL_LENGTH('Sec101NoticeHistories', 'RecipientName') IS NULL
                    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [RecipientName] nvarchar(200) NULL;
                IF COL_LENGTH('Sec101NoticeHistories', 'RecipientAddress') IS NULL
                    ALTER TABLE [dbo].[Sec101NoticeHistories] ADD [RecipientAddress] nvarchar(500) NULL;
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Sec101NoticeHistories' AND COLUMN_NAME = 'NoticeNumber' AND CHARACTER_MAXIMUM_LENGTH < 100)
                    ALTER TABLE [dbo].[Sec101NoticeHistories] ALTER COLUMN [NoticeNumber] nvarchar(100) NOT NULL;
                IF COL_LENGTH('Sec101NoticeHistories', 'CustomerId') IS NOT NULL
                    EXEC(N'UPDATE nh SET nh.[CustomerId] = COALESCE(la.[CustomerID], m.[CustomerID]) FROM [dbo].[Sec101NoticeHistories] nh LEFT JOIN [dbo].[LoanAccounts] la ON nh.[LoanAccountId] = la.[LoanAccountID] LEFT JOIN [dbo].[Members] m ON nh.[MemberId] = m.[MemberID] WHERE nh.[CustomerId] IS NULL;');
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101HearingLogs')
            BEGIN
                CREATE TABLE [dbo].[Sec101HearingLogs] (
                    [HearingId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CaseId] int NOT NULL,
                    [HearingDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [NextHearingDate] datetime2 NULL,
                    [NextHearingPurpose] nvarchar(250) NULL,
                    [Stage] nvarchar(100) NOT NULL DEFAULT N'समन्स / नोटीस पूर्तता',
                    [BorrowerPresence] nvarchar(20) NOT NULL DEFAULT 'ABSENT',
                    [GuarantorPresence] nvarchar(20) NOT NULL DEFAULT 'ABSENT',
                    [CourtOrderSummary] nvarchar(max) NULL,
                    [AdvocateNotes] nvarchar(max) NULL,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [CreatedBy] int NOT NULL DEFAULT 1
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('Sec101HearingLogs', 'NextHearingPurpose') IS NULL
                    ALTER TABLE [dbo].[Sec101HearingLogs] ADD [NextHearingPurpose] nvarchar(250) NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101AttachmentAuctions')
            BEGIN
                CREATE TABLE [dbo].[Sec101AttachmentAuctions] (
                    [ExecutionId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [CaseId] int NOT NULL,
                    [SroName] nvarchar(100) NOT NULL DEFAULT N'विशेष वसुली अधिकारी',
                    [ExecutionType] nvarchar(50) NOT NULL DEFAULT 'IMMOVABLE_PROPERTY',
                    [PropertyDetails] nvarchar(500) NULL,
                    [EmployerName] nvarchar(200) NULL,
                    [EmployerAddress] nvarchar(500) NULL,
                    [MonthlyDeductionAmount] decimal(18,2) NULL,
                    [ValuationAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [WarrantIssueDate] datetime2 NULL,
                    [PanchanamaDate] datetime2 NULL,
                    [AuctionNoticeDate] datetime2 NULL,
                    [AuctionDate] datetime2 NULL,
                    [ReservePrice] decimal(18,2) NOT NULL DEFAULT 0,
                    [HighestBidAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [SpotDepositAmount] decimal(18,2) NULL,
                    [BalancePaymentDueDate] datetime2 NULL,
                    [SurplusAmount] decimal(18,2) NULL,
                    [SettlementVoucherId] int NULL,
                    [BuyerName] nvarchar(150) NULL,
                    [BuyerContact] nvarchar(100) NULL,
                    [SaleCertificateDate] datetime2 NULL,
                    [SaleCertificateNo] nvarchar(100) NULL,
                    [Status] nvarchar(50) NOT NULL DEFAULT 'WARRANT_ISSUED',
                    [Remarks] nvarchar(max) NULL,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [CreatedBy] int NOT NULL DEFAULT 1
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('Sec101AttachmentAuctions', 'EmployerName') IS NULL
                    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [EmployerName] nvarchar(200) NULL;
                IF COL_LENGTH('Sec101AttachmentAuctions', 'EmployerAddress') IS NULL
                    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [EmployerAddress] nvarchar(500) NULL;
                IF COL_LENGTH('Sec101AttachmentAuctions', 'MonthlyDeductionAmount') IS NULL
                    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [MonthlyDeductionAmount] decimal(18,2) NULL;
                IF COL_LENGTH('Sec101AttachmentAuctions', 'SpotDepositAmount') IS NULL
                    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [SpotDepositAmount] decimal(18,2) NULL;
                IF COL_LENGTH('Sec101AttachmentAuctions', 'BalancePaymentDueDate') IS NULL
                    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [BalancePaymentDueDate] datetime2 NULL;
                IF COL_LENGTH('Sec101AttachmentAuctions', 'SurplusAmount') IS NULL
                    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [SurplusAmount] decimal(18,2) NULL;
                IF COL_LENGTH('Sec101AttachmentAuctions', 'SettlementVoucherId') IS NULL
                    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ADD [SettlementVoucherId] int NULL;
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Sec101AttachmentAuctions' AND COLUMN_NAME = 'SaleCertificateNo' AND CHARACTER_MAXIMUM_LENGTH < 100)
                    ALTER TABLE [dbo].[Sec101AttachmentAuctions] ALTER COLUMN [SaleCertificateNo] nvarchar(100) NULL;
            END

            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sec101LegalExpenses')
            BEGIN
                CREATE TABLE [dbo].[Sec101LegalExpenses] (
                    [ExpenseId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchId] int NOT NULL DEFAULT 1,
                    [CaseId] int NULL,
                    [NoticeId] int NULL,
                    [LoanAccountId] int NOT NULL,
                    [CustomerId] int NULL,
                    [ExpenseType] nvarchar(50) NOT NULL DEFAULT 'COURT_FEE',
                    [Amount] decimal(18,2) NOT NULL DEFAULT 0,
                    [ExpenseDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [PaidTo] nvarchar(150) NULL,
                    [VoucherId] int NULL,
                    [IsDebitedToLoan] bit NOT NULL DEFAULT 1,
                    [Remarks] nvarchar(max) NULL,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [CreatedBy] int NOT NULL DEFAULT 1
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('Sec101LegalExpenses', 'NoticeId') IS NULL
                    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [NoticeId] int NULL;
                IF COL_LENGTH('Sec101LegalExpenses', 'CustomerId') IS NULL
                    ALTER TABLE [dbo].[Sec101LegalExpenses] ADD [CustomerId] int NULL;
                IF COL_LENGTH('Sec101LegalExpenses', 'CustomerId') IS NOT NULL
                    EXEC(N'UPDATE le SET le.[CustomerId] = COALESCE(la.[CustomerID], cm.[CustomerId]) FROM [dbo].[Sec101LegalExpenses] le LEFT JOIN [dbo].[LoanAccounts] la ON le.[LoanAccountId] = la.[LoanAccountID] LEFT JOIN [dbo].[Sec101CaseMasters] cm ON le.[CaseId] = cm.[CaseId] WHERE le.[CustomerId] IS NULL;');
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
            // FD & RD CustomerID-First Schema Migration Auto-Sync
            db.Database.ExecuteSqlRaw(@"
            -- 1. FdAccounts CIF-First Migration
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'FdAccounts')
            BEGIN
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'MemberID')
                BEGIN
                    EXEC('
                        DECLARE @fdFkName nvarchar(200);
                        SELECT @fdFkName = f.name FROM sys.foreign_keys f 
                        JOIN sys.foreign_key_columns fkc ON f.object_id = fkc.constraint_object_id
                        JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
                        WHERE f.parent_object_id = OBJECT_ID(N''[FdAccounts]'') AND c.name = ''MemberID'';
                        IF @fdFkName IS NOT NULL EXEC(''ALTER TABLE [FdAccounts] DROP CONSTRAINT ['' + @fdFkName + '']'');

                        IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N''[FdAccounts]'') AND name = ''IX_FdAccounts_MemberID'')
                            DROP INDEX [IX_FdAccounts_MemberID] ON [FdAccounts];

                        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N''[FdAccounts]'') AND name = ''CustomerID'')
                        BEGIN
                            UPDATE fd
                            SET fd.CustomerID = ISNULL(m.CustomerID, 1)
                            FROM [FdAccounts] fd
                            LEFT JOIN [Members] m ON fd.MemberID = m.MemberID
                            WHERE fd.CustomerID IS NULL OR fd.CustomerID = 0;
                        END

                        ALTER TABLE [FdAccounts] DROP COLUMN [MemberID];
                    ');
                END

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'CustomerID' AND is_nullable = 1)
                BEGIN
                    IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'IX_FdAccounts_CustomerID')
                        EXEC('DROP INDEX [IX_FdAccounts_CustomerID] ON [FdAccounts];');

                    EXEC('ALTER TABLE [FdAccounts] ALTER COLUMN [CustomerID] int NOT NULL;');
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'IX_FdAccounts_CustomerID')
                    EXEC('CREATE NONCLUSTERED INDEX [IX_FdAccounts_CustomerID] ON [FdAccounts]([CustomerID]);');
            END

            -- 2. RdAccounts CIF-First Migration
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'RdAccounts')
            BEGIN
                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'MemberID')
                BEGIN
                    EXEC('
                        DECLARE @rdFkName nvarchar(200);
                        SELECT @rdFkName = f.name FROM sys.foreign_keys f 
                        JOIN sys.foreign_key_columns fkc ON f.object_id = fkc.constraint_object_id
                        JOIN sys.columns c ON fkc.parent_object_id = c.object_id AND fkc.parent_column_id = c.column_id
                        WHERE f.parent_object_id = OBJECT_ID(N''[RdAccounts]'') AND c.name = ''MemberID'';
                        IF @rdFkName IS NOT NULL EXEC(''ALTER TABLE [RdAccounts] DROP CONSTRAINT ['' + @rdFkName + '']'');

                        IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N''[RdAccounts]'') AND name = ''IX_RdAccounts_MemberID'')
                            DROP INDEX [IX_RdAccounts_MemberID] ON [RdAccounts];

                        IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N''[RdAccounts]'') AND name = ''CustomerID'')
                        BEGIN
                            UPDATE rd
                            SET rd.CustomerID = ISNULL(m.CustomerID, 1)
                            FROM [RdAccounts] rd
                            LEFT JOIN [Members] m ON rd.MemberID = m.MemberID
                            WHERE rd.CustomerID IS NULL OR rd.CustomerID = 0;
                        END

                        ALTER TABLE [RdAccounts] DROP COLUMN [MemberID];
                    ');
                END

                IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'CustomerID' AND is_nullable = 1)
                BEGIN
                    IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'IX_RdAccounts_CustomerID')
                        EXEC('DROP INDEX [IX_RdAccounts_CustomerID] ON [RdAccounts];');

                    EXEC('ALTER TABLE [RdAccounts] ALTER COLUMN [CustomerID] int NOT NULL;');
                END

                IF COL_LENGTH('RdAccounts', 'JointCustomerID') IS NULL
                    EXEC('ALTER TABLE [RdAccounts] ADD [JointCustomerID] int NULL;');

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'IX_RdAccounts_CustomerID')
                    EXEC('CREATE NONCLUSTERED INDEX [IX_RdAccounts_CustomerID] ON [RdAccounts]([CustomerID]);');

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[RdAccounts]') AND name = 'IX_RdAccounts_JointCustomerID')
                    EXEC('CREATE NONCLUSTERED INDEX [IX_RdAccounts_JointCustomerID] ON [RdAccounts]([JointCustomerID]);');
            END
        ");
            Log.Information("FD and RD CustomerID-First schema auto-migration verified.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to apply FD/RD CustomerID-First auto-migrations");
        }

        try
        {
            db.Database.ExecuteSqlRaw(@"
            IF OBJECT_ID(N'[dbo].[PigmySchemeInterestSlabs]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[PigmySchemeInterestSlabs] (
                    [SlabID] INT IDENTITY(1,1) NOT NULL,
                    [PigmySchemeID] INT NOT NULL,
                    [FromDays] INT NOT NULL,
                    [ToDays] INT NOT NULL,
                    [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    [PenaltyRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    [SlabDescription] NVARCHAR(100) NULL,
                    [IsActive] BIT NOT NULL DEFAULT 1,
                    [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
                    CONSTRAINT [PK_PigmySchemeInterestSlabs] PRIMARY KEY CLUSTERED ([SlabID] ASC),
                    CONSTRAINT [FK_PigmySchemeInterestSlabs_PigmySchemes] FOREIGN KEY ([PigmySchemeID]) 
                        REFERENCES [dbo].[PigmySchemes]([PigmySchemeID]) ON DELETE CASCADE
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('PigmySchemeInterestSlabs', 'FromMonths') IS NOT NULL AND COL_LENGTH('PigmySchemeInterestSlabs', 'FromDays') IS NULL
                BEGIN
                    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PigmySchemeInterestSlabs_Scheme' AND object_id = OBJECT_ID('dbo.PigmySchemeInterestSlabs'))
                        DROP INDEX [IX_PigmySchemeInterestSlabs_Scheme] ON [dbo].[PigmySchemeInterestSlabs];

                    ALTER TABLE [dbo].[PigmySchemeInterestSlabs] ADD [FromDays] INT NULL;
                    ALTER TABLE [dbo].[PigmySchemeInterestSlabs] ADD [ToDays] INT NULL;
                END
            END

            IF COL_LENGTH('PigmySchemeInterestSlabs', 'FromMonths') IS NOT NULL AND COL_LENGTH('PigmySchemeInterestSlabs', 'FromDays') IS NOT NULL
            BEGIN
                EXEC('
                    UPDATE [dbo].[PigmySchemeInterestSlabs]
                    SET [FromDays] = ISNULL([FromMonths] * 30, 0),
                        [ToDays] = CASE WHEN [ToMonths] = 12 THEN 365 ELSE ISNULL([ToMonths] * 30, 365) END
                    WHERE [FromDays] IS NULL;
                ');

                ALTER TABLE [dbo].[PigmySchemeInterestSlabs] ALTER COLUMN [FromDays] INT NOT NULL;
                ALTER TABLE [dbo].[PigmySchemeInterestSlabs] ALTER COLUMN [ToDays] INT NOT NULL;
            END

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PigmySchemeInterestSlabs_Scheme' AND object_id = OBJECT_ID('dbo.PigmySchemeInterestSlabs'))
            BEGIN
                CREATE NONCLUSTERED INDEX [IX_PigmySchemeInterestSlabs_Scheme] 
                    ON [dbo].[PigmySchemeInterestSlabs] ([PigmySchemeID], [FromDays], [ToDays]);
            END

            IF COL_LENGTH('PigmyAccounts', 'EffectiveStartDate') IS NULL
                ALTER TABLE [dbo].[PigmyAccounts] ADD [EffectiveStartDate] DATETIME NULL;

            IF COL_LENGTH('PigmyAccounts', 'CurrentCycleNumber') IS NULL
                ALTER TABLE [dbo].[PigmyAccounts] ADD [CurrentCycleNumber] INT NOT NULL CONSTRAINT DF_PigmyAccounts_CurrentCycleNumber DEFAULT 1;

            IF COL_LENGTH('PigmyAccounts', 'LastWithdrawalDate') IS NULL
                ALTER TABLE [dbo].[PigmyAccounts] ADD [LastWithdrawalDate] DATETIME NULL;

            IF COL_LENGTH('PigmyAccounts', 'TotalWithdrawnAmount') IS NULL
                ALTER TABLE [dbo].[PigmyAccounts] ADD [TotalWithdrawnAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_PigmyAccounts_TotalWithdrawnAmount DEFAULT 0.00;

            UPDATE [dbo].[PigmyAccounts]
            SET [EffectiveStartDate] = ISNULL([OpeningDate], GETDATE()),
                [CurrentCycleNumber] = 1,
                [TotalWithdrawnAmount] = 0.00
            WHERE [EffectiveStartDate] IS NULL;

            IF OBJECT_ID(N'[dbo].[PigmyWithdrawals]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[PigmyWithdrawals] (
                    [WithdrawalID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [PigmyAccountID] INT NOT NULL,
                    [WithdrawalDate] DATETIME NOT NULL,
                    [CycleNumber] INT NOT NULL DEFAULT 1,
                    [CycleStartSnapshot] DATETIME NOT NULL,
                    [ElapsedDays] INT NOT NULL DEFAULT 0,
                    [ElapsedMonths] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    [RequestedAmount] DECIMAL(18,2) NOT NULL,
                    [AppliedSlabID] INT NULL,
                    [PenaltyRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    [PenaltyAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                    [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                    [InterestAmount] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                    [NetPaidAmount] DECIMAL(18,2) NOT NULL,
                    [RemainingBalance] DECIMAL(18,2) NOT NULL,
                    [VoucherNo] NVARCHAR(50) NULL,
                    [Narration] NVARCHAR(250) NULL,
                    [CreatedBy] INT NOT NULL DEFAULT 1,
                    [CreatedDate] DATETIME NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT [FK_PigmyWithdrawals_PigmyAccounts] FOREIGN KEY ([PigmyAccountID]) 
                        REFERENCES [dbo].[PigmyAccounts]([PigmyAccountID]) ON DELETE CASCADE
                );

                CREATE NONCLUSTERED INDEX [IX_PigmyWithdrawals_PigmyAccountID] ON [dbo].[PigmyWithdrawals]([PigmyAccountID]);
                CREATE NONCLUSTERED INDEX [IX_PigmyWithdrawals_WithdrawalDate] ON [dbo].[PigmyWithdrawals]([WithdrawalDate]);
            END
        ");
            Log.Information("Pigmy Dynamic Slabs & Partial Withdrawal schema auto-migration verified.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to apply Pigmy Dynamic Slabs auto-migrations");
        }

        try
        {
            db.Database.ExecuteSqlRaw(@"
            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentSchemes') AND COL_LENGTH('InvestmentSchemes', 'TdsLedgerID') IS NULL
                ALTER TABLE [dbo].[InvestmentSchemes] ADD [TdsLedgerID] INT NULL;

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentVoucherMappings') AND COL_LENGTH('InvestmentVoucherMappings', 'TdsLedgerID') IS NULL
                ALTER TABLE [dbo].[InvestmentVoucherMappings] ADD [TdsLedgerID] INT NULL;

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentMaturities')
            BEGIN
                IF COL_LENGTH('InvestmentMaturities', 'TdsAmount') IS NULL
                    ALTER TABLE [dbo].[InvestmentMaturities] ADD [TdsAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_InvestmentMaturities_TdsAmount DEFAULT 0.00;
                IF COL_LENGTH('InvestmentMaturities', 'TdsLedgerID') IS NULL
                    ALTER TABLE [dbo].[InvestmentMaturities] ADD [TdsLedgerID] INT NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentPrematureWithdrawals')
            BEGIN
                IF COL_LENGTH('InvestmentPrematureWithdrawals', 'TdsAmount') IS NULL
                    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [TdsAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_InvestmentPrematureWithdrawals_TdsAmount DEFAULT 0.00;
                IF COL_LENGTH('InvestmentPrematureWithdrawals', 'TdsLedgerID') IS NULL
                    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [TdsLedgerID] INT NULL;
                IF COL_LENGTH('InvestmentPrematureWithdrawals', 'AccruedInterestReversed') IS NULL
                    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [AccruedInterestReversed] DECIMAL(18,2) NOT NULL CONSTRAINT DF_InvestmentPrematureWithdrawals_AccruedIntReversed DEFAULT 0.00;
                IF COL_LENGTH('InvestmentPrematureWithdrawals', 'InterestClawbackAmount') IS NULL
                    ALTER TABLE [dbo].[InvestmentPrematureWithdrawals] ADD [InterestClawbackAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_InvestmentPrematureWithdrawals_InterestClawback DEFAULT 0.00;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentRenewals')
            BEGIN
                IF COL_LENGTH('InvestmentRenewals', 'TdsAmount') IS NULL
                    ALTER TABLE [dbo].[InvestmentRenewals] ADD [TdsAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_InvestmentRenewals_TdsAmount DEFAULT 0.00;
                IF COL_LENGTH('InvestmentRenewals', 'TdsLedgerID') IS NULL
                    ALTER TABLE [dbo].[InvestmentRenewals] ADD [TdsLedgerID] INT NULL;
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentInterestReceipts')
            BEGIN
                IF COL_LENGTH('InvestmentInterestReceipts', 'ReceiptType') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [ReceiptType] NVARCHAR(30) NOT NULL CONSTRAINT DF_InvestmentInterestReceipts_ReceiptType DEFAULT N'DepositInterest';
                IF COL_LENGTH('InvestmentInterestReceipts', 'GrossAmount') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [GrossAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_InvestmentInterestReceipts_GrossAmount DEFAULT 0.00;
                IF COL_LENGTH('InvestmentInterestReceipts', 'TdsAmount') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [TdsAmount] DECIMAL(18,2) NOT NULL CONSTRAINT DF_InvestmentInterestReceipts_TdsAmount DEFAULT 0.00;
                IF COL_LENGTH('InvestmentInterestReceipts', 'TdsLedgerID') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [TdsLedgerID] INT NULL;
                IF COL_LENGTH('InvestmentInterestReceipts', 'PaymentMode') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [PaymentMode] NVARCHAR(20) NULL;
                IF COL_LENGTH('InvestmentInterestReceipts', 'BankLedgerID') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [BankLedgerID] INT NULL;
                IF COL_LENGTH('InvestmentInterestReceipts', 'ReferenceNo') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [ReferenceNo] NVARCHAR(100) NULL;
                IF COL_LENGTH('InvestmentInterestReceipts', 'Remarks') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestReceipts] ADD [Remarks] NVARCHAR(300) NULL;

                IF COL_LENGTH('InvestmentInterestReceipts', 'GrossAmount') IS NOT NULL
                    EXEC(N'UPDATE [dbo].[InvestmentInterestReceipts] SET [GrossAmount] = [ReceivedAmount] WHERE [GrossAmount] = 0 AND [ReceivedAmount] > 0;');
            END

            IF EXISTS (SELECT * FROM sys.tables WHERE name = 'InvestmentInterestAccruals')
            BEGIN
                IF COL_LENGTH('InvestmentInterestAccruals', 'FromDate') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [FromDate] DATETIME2 NULL;
                IF COL_LENGTH('InvestmentInterestAccruals', 'CalculationDays') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [CalculationDays] INT NULL;
                IF COL_LENGTH('InvestmentInterestAccruals', 'CalculationMethod') IS NULL
                    ALTER TABLE [dbo].[InvestmentInterestAccruals] ADD [CalculationMethod] NVARCHAR(30) NULL;
            END
        ");
            Log.Information("Investment Dynamic TDS Ledger & Amount schema auto-migration verified.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to apply Investment Dynamic TDS auto-migrations");
        }

        try
        {
            // Auto-heal database identity gaps and synchronize triggers across all tables
            db.Database.ExecuteSqlRaw("IF OBJECT_ID('[dbo].[sp_SyncDatabaseIdentities]', 'P') IS NOT NULL EXEC [dbo].[sp_SyncDatabaseIdentities];");
            Log.Information("Database identity synchronization and self-healing triggers verified.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to run sp_SyncDatabaseIdentities");
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

        try
        {
            // Core Banking Multi-Branch & IBT Schema DDL Verification (Vouchers, LoanCollections, BranchLedgerOpeningBalances)
            db.Database.ExecuteSqlRaw(@"
            IF OBJECT_ID(N'[Vouchers]', N'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH('Vouchers', 'IsIbtVoucher') IS NULL
                    ALTER TABLE [dbo].[Vouchers] ADD [IsIbtVoucher] bit NOT NULL CONSTRAINT [DF_Vouchers_IsIbtVoucher] DEFAULT 0;
                IF COL_LENGTH('Vouchers', 'RelatedVoucherID') IS NULL
                    ALTER TABLE [dbo].[Vouchers] ADD [RelatedVoucherID] int NULL;
                IF COL_LENGTH('Vouchers', 'TargetBranchID') IS NULL
                    ALTER TABLE [dbo].[Vouchers] ADD [TargetBranchID] int NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vouchers_IsIbtVoucher' AND object_id = OBJECT_ID('Vouchers'))
                    EXEC(N'CREATE NONCLUSTERED INDEX [IX_Vouchers_IsIbtVoucher] ON [dbo].[Vouchers] ([IsIbtVoucher], [BranchID]);');
            END

            IF OBJECT_ID(N'[LoanCollections]', N'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH('LoanCollections', 'HomeBranchVoucherID') IS NULL
                    ALTER TABLE [dbo].[LoanCollections] ADD [HomeBranchVoucherID] int NULL;
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoanCollections_HomeBranchVoucherID' AND object_id = OBJECT_ID('LoanCollections'))
                    EXEC(N'CREATE NONCLUSTERED INDEX [IX_LoanCollections_HomeBranchVoucherID] ON [dbo].[LoanCollections] ([HomeBranchVoucherID]);');
            END

            IF OBJECT_ID(N'[Branches]', N'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH('Branches', 'DefaultIbtLedgerID') IS NULL
                    ALTER TABLE [dbo].[Branches] ADD [DefaultIbtLedgerID] int NULL;
                IF COL_LENGTH('Branches', 'DefaultCashLedgerID') IS NULL
                    ALTER TABLE [dbo].[Branches] ADD [DefaultCashLedgerID] int NULL;
            END

            IF OBJECT_ID(N'[dbo].[BranchLedgerOpeningBalances]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[BranchLedgerOpeningBalances] (
                    [OpeningBalanceID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] INT NOT NULL,
                    [LedgerID] INT NOT NULL,
                    [FinancialYearID] INT NOT NULL,
                    [OpeningBalance] DECIMAL(18,2) NOT NULL DEFAULT 0.00,
                    [OpeningBalanceType] NVARCHAR(2) NOT NULL DEFAULT 'Dr',
                    [Remarks] NVARCHAR(500) NULL,
                    [CreatedOn] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
                    [CreatedBy] INT NOT NULL DEFAULT 1,
                    [UpdatedOn] DATETIME2 NULL,
                    [UpdatedBy] INT NULL,
                    CONSTRAINT [FK_BranchLedgerOpeningBalances_Branches] FOREIGN KEY ([BranchID]) REFERENCES [dbo].[Branches]([BranchID]),
                    CONSTRAINT [FK_BranchLedgerOpeningBalances_Ledgers] FOREIGN KEY ([LedgerID]) REFERENCES [dbo].[Ledgers]([LedgerID]),
                    CONSTRAINT [FK_BranchLedgerOpeningBalances_FinancialYears] FOREIGN KEY ([FinancialYearID]) REFERENCES [dbo].[FinancialYears]([FinancialYearID])
                );
                CREATE UNIQUE NONCLUSTERED INDEX [UQ_BranchLedgerOpeningBalances_Ledger_Branch_FY]
                ON [dbo].[BranchLedgerOpeningBalances] ([LedgerID] ASC, [BranchID] ASC, [FinancialYearID] ASC);
            END
        ");
            Log.Information("Core Banking Multi-Branch & IBT Schema DDL verified successfully.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to verify or apply Multi-Branch & IBT schema DDL");
        }

        try
        {
            // Ensure EmployeeBankDetails allows nullable JoiningDate, DepartmentID, and BranchID
            db.Database.ExecuteSqlRaw(@"
            IF OBJECT_ID(N'[dbo].[EmployeeBankDetails]', N'U') IS NOT NULL
            BEGIN
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'EmployeeBankDetails' AND COLUMN_NAME = 'JoiningDate' AND IS_NULLABLE = 'NO')
                    ALTER TABLE [dbo].[EmployeeBankDetails] ALTER COLUMN [JoiningDate] datetime2 NULL;
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'EmployeeBankDetails' AND COLUMN_NAME = 'DepartmentID' AND IS_NULLABLE = 'NO')
                    ALTER TABLE [dbo].[EmployeeBankDetails] ALTER COLUMN [DepartmentID] int NULL;
                IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'EmployeeBankDetails' AND COLUMN_NAME = 'BranchID' AND IS_NULLABLE = 'NO')
                    ALTER TABLE [dbo].[EmployeeBankDetails] ALTER COLUMN [BranchID] int NULL;
            END
        ");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to verify EmployeeBankDetails nullable columns DDL");
        }

        try
        {
            // Ensure FdMisPayouts, SupportTickets & SupportTicketAttachments exist (missing from EF snapshot; required by VoucherRollbackAndDeleteService & controllers)
            db.Database.ExecuteSqlRaw(@"
            SET QUOTED_IDENTIFIER ON;
            SET ANSI_NULLS ON;

            IF OBJECT_ID(N'[dbo].[FdMisPayouts]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[FdMisPayouts] (
                    [PayoutID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [InstitutionID] INT NOT NULL DEFAULT 1,
                    [BranchID] INT NOT NULL DEFAULT 1,
                    [FinancialYearID] INT NOT NULL DEFAULT 1,
                    [FdAccountID] INT NOT NULL,
                    [PayoutYear] INT NOT NULL,
                    [PayoutMonth] INT NOT NULL,
                    [PayoutDate] DATETIME2 NOT NULL,
                    [PeriodFromDate] DATETIME2 NULL,
                    [PeriodToDate] DATETIME2 NULL,
                    [ElapsedDays] INT NOT NULL DEFAULT 0,
                    [DepositPrincipal] DECIMAL(18,2) NOT NULL DEFAULT 0,
                    [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0,
                    [GrossInterest] DECIMAL(18,2) NOT NULL DEFAULT 0,
                    [TdsAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
                    [LoanAdjustedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
                    [NetDisbursedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
                    [DisbursementMode] NVARCHAR(30) NOT NULL DEFAULT 'SavingTransfer',
                    [TargetSavingAccountID] INT NULL,
                    [TargetLoanAccountID] INT NULL,
                    [VoucherID] INT NULL,
                    [Status] NVARCHAR(20) NOT NULL DEFAULT 'Success',
                    [CreatedBy] INT NOT NULL DEFAULT 1,
                    [CreatedDate] DATETIME2 NOT NULL DEFAULT GETDATE(),
                    [Remarks] NVARCHAR(250) NULL
                );
                IF OBJECT_ID(N'[dbo].[FdAccounts]', N'U') IS NOT NULL
                    ALTER TABLE [dbo].[FdMisPayouts] WITH CHECK ADD CONSTRAINT [FK_FdMisPayouts_FdAccounts] FOREIGN KEY ([FdAccountID]) REFERENCES [dbo].[FdAccounts]([FdAccountID]) ON DELETE CASCADE;
            END
            ELSE
            BEGIN
                IF COL_LENGTH('FdMisPayouts', 'PeriodFromDate') IS NULL ALTER TABLE [dbo].[FdMisPayouts] ADD [PeriodFromDate] DATETIME2 NULL;
                IF COL_LENGTH('FdMisPayouts', 'PeriodToDate') IS NULL ALTER TABLE [dbo].[FdMisPayouts] ADD [PeriodToDate] DATETIME2 NULL;
                IF COL_LENGTH('FdMisPayouts', 'ElapsedDays') IS NULL ALTER TABLE [dbo].[FdMisPayouts] ADD [ElapsedDays] INT NOT NULL DEFAULT 0;
                IF COL_LENGTH('FdMisPayouts', 'TdsAmount') IS NULL ALTER TABLE [dbo].[FdMisPayouts] ADD [TdsAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
                IF COL_LENGTH('FdMisPayouts', 'LoanAdjustedAmount') IS NULL ALTER TABLE [dbo].[FdMisPayouts] ADD [LoanAdjustedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0;
                IF COL_LENGTH('FdMisPayouts', 'TargetSavingAccountID') IS NULL ALTER TABLE [dbo].[FdMisPayouts] ADD [TargetSavingAccountID] INT NULL;
                IF COL_LENGTH('FdMisPayouts', 'TargetLoanAccountID') IS NULL ALTER TABLE [dbo].[FdMisPayouts] ADD [TargetLoanAccountID] INT NULL;
                IF COL_LENGTH('FdMisPayouts', 'VoucherID') IS NULL ALTER TABLE [dbo].[FdMisPayouts] ADD [VoucherID] INT NULL;
            END

            IF OBJECT_ID(N'[dbo].[FdMisPayouts]', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FdMisPayouts_Account_Year_Month' AND object_id = OBJECT_ID(N'[dbo].[FdMisPayouts]'))
            BEGIN
                EXEC(N'CREATE UNIQUE INDEX [IX_FdMisPayouts_Account_Year_Month] ON [dbo].[FdMisPayouts] ([FdAccountID], [PayoutYear], [PayoutMonth]) WHERE [Status] = ''Success'';');
            END

            IF OBJECT_ID(N'[dbo].[SupportTickets]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SupportTickets] (
                    [TicketID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [TicketNo] NVARCHAR(50) NOT NULL,
                    [BranchID] INT NOT NULL DEFAULT 1,
                    [BranchName] NVARCHAR(100) NOT NULL DEFAULT '',
                    [UserID] INT NOT NULL DEFAULT 1,
                    [Username] NVARCHAR(100) NOT NULL DEFAULT '',
                    [ContactNumber] NVARCHAR(30) NULL,
                    [ModuleCategory] NVARCHAR(100) NOT NULL DEFAULT 'General',
                    [Priority] NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                    [Subject] NVARCHAR(250) NOT NULL DEFAULT '',
                    [Description] NVARCHAR(MAX) NOT NULL DEFAULT '',
                    [SystemInfoJson] NVARCHAR(MAX) NULL,
                    [Status] NVARCHAR(30) NOT NULL DEFAULT 'OPEN',
                    [ResolutionRemarks] NVARCHAR(MAX) NULL,
                    [ResolvedByUserID] INT NULL,
                    [ResolvedAt] DATETIME2 NULL,
                    [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE(),
                    [UpdatedOn] DATETIME2 NULL
                );
            END

            IF OBJECT_ID(N'[dbo].[SupportTicketAttachments]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SupportTicketAttachments] (
                    [AttachmentID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [TicketID] INT NOT NULL,
                    [OriginalFileName] NVARCHAR(255) NOT NULL,
                    [FilePath] NVARCHAR(500) NOT NULL,
                    [FileType] NVARCHAR(100) NULL,
                    [FileSize] BIGINT NULL,
                    [CreatedOn] DATETIME2 NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT [FK_SupportTicketAttachments_SupportTickets] FOREIGN KEY ([TicketID]) REFERENCES [dbo].[SupportTickets]([TicketID]) ON DELETE CASCADE
                );
            END
        ");
            Log.Information("FdMisPayouts and SupportTickets runtime schema DDL verified successfully.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to verify FdMisPayouts / SupportTickets runtime schema DDL");
        }

        try
        {
            // Employee Salary Demand Settings, Multi-RD Sub-Row Breakdown & Bulk Recovery Schema DDL Verification
            db.Database.ExecuteSqlRaw(@"
            IF OBJECT_ID(N'[dbo].[Customers]', N'U') IS NOT NULL AND COL_LENGTH('Customers', 'EmployeeCode') IS NULL
                ALTER TABLE [dbo].[Customers] ADD [EmployeeCode] nvarchar(50) NULL;

            IF OBJECT_ID(N'[dbo].[DemandNotices]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[DemandNotices] (
                    [DemandNoticeId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [NoticeNumber] nvarchar(50) NOT NULL DEFAULT '',
                    [Month] int NOT NULL DEFAULT 1,
                    [Year] int NOT NULL DEFAULT 2026,
                    [EmployerId] int NOT NULL DEFAULT 0,
                    [BranchId] int NOT NULL DEFAULT 1,
                    [TotalDemandAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalRecoveredAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [DemandDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [OnlyBorrowers] bit NOT NULL DEFAULT 0,
                    [ContributionInputAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [Remarks] nvarchar(500) NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Pending',
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [CreatedBy] int NOT NULL DEFAULT 1
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('DemandNotices', 'NoticeNumber') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[DemandNotices] ADD [NoticeNumber] nvarchar(50) NOT NULL CONSTRAINT [DF_DemandNotices_NoticeNumber] DEFAULT '';
                    IF COL_LENGTH('DemandNotices', 'NoticeNo') IS NOT NULL
                        EXEC(N'UPDATE [dbo].[DemandNotices] SET [NoticeNumber] = ISNULL([NoticeNo], '''') WHERE [NoticeNumber] = '''';');
                END
                IF COL_LENGTH('DemandNotices', 'Month') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [Month] int NOT NULL CONSTRAINT [DF_DemandNotices_Month] DEFAULT 1;
                IF COL_LENGTH('DemandNotices', 'Year') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [Year] int NOT NULL CONSTRAINT [DF_DemandNotices_Year] DEFAULT 2026;
                IF COL_LENGTH('DemandNotices', 'BranchId') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [BranchId] int NOT NULL CONSTRAINT [DF_DemandNotices_BranchId] DEFAULT 1;
                IF COL_LENGTH('DemandNotices', 'TotalRecoveredAmount') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [TotalRecoveredAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandNotices_TotalRecoveredAmount] DEFAULT 0;
                IF COL_LENGTH('DemandNotices', 'DemandDate') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [DemandDate] datetime2 NOT NULL CONSTRAINT [DF_DemandNotices_DemandDate] DEFAULT GETDATE();
                IF COL_LENGTH('DemandNotices', 'OnlyBorrowers') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [OnlyBorrowers] bit NOT NULL CONSTRAINT [DF_DemandNotices_OnlyBorrowers] DEFAULT 0;
                IF COL_LENGTH('DemandNotices', 'ContributionInputAmount') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [ContributionInputAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandNotices_ContributionInputAmount] DEFAULT 0;
                IF COL_LENGTH('DemandNotices', 'Remarks') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [Remarks] nvarchar(500) NULL;
                IF COL_LENGTH('DemandNotices', 'CreatedDate') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [CreatedDate] datetime2 NOT NULL CONSTRAINT [DF_DemandNotices_CreatedDate] DEFAULT GETUTCDATE();
                IF COL_LENGTH('DemandNotices', 'CreatedBy') IS NULL
                    ALTER TABLE [dbo].[DemandNotices] ADD [CreatedBy] int NOT NULL CONSTRAINT [DF_DemandNotices_CreatedBy] DEFAULT 1;
            END

            IF OBJECT_ID(N'[dbo].[DemandMemberDetails]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[DemandMemberDetails] (
                    [DemandMemberDetailId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [DemandNoticeId] int NOT NULL,
                    [MemberId] int NOT NULL,
                    [CustomerId] int NULL,
                    [EmpCode] nvarchar(50) NULL,
                    [CIFNo] nvarchar(20) NULL,
                    [MemberName] nvarchar(200) NULL,
                    [IsSelected] bit NOT NULL DEFAULT 1,
                    [LoanInstallment] decimal(18,2) NOT NULL DEFAULT 0,
                    [SavingDeposit] decimal(18,2) NOT NULL DEFAULT 0,
                    [ShareDeposit] decimal(18,2) NOT NULL DEFAULT 0,
                    [PigmyDeposit] decimal(18,2) NOT NULL DEFAULT 0,
                    [RdDeposit] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalDeduction] decimal(18,2) NOT NULL DEFAULT 0,
                    [RecoveredAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [RecoveryStatus] nvarchar(20) NOT NULL DEFAULT 'Pending',
                    [Remarks] nvarchar(250) NULL,
                    [IsProcessed] bit NOT NULL DEFAULT 0
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('DemandMemberDetails', 'DetailID') IS NOT NULL AND COL_LENGTH('DemandMemberDetails', 'DemandMemberDetailId') IS NULL
                    EXEC sp_rename 'dbo.DemandMemberDetails.DetailID', 'DemandMemberDetailId', 'COLUMN';
                IF COL_LENGTH('DemandMemberDetails', 'CustomerId') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [CustomerId] int NULL;
                IF COL_LENGTH('DemandMemberDetails', 'EmpCode') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [EmpCode] nvarchar(50) NULL;
                IF COL_LENGTH('DemandMemberDetails', 'CIFNo') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [CIFNo] nvarchar(20) NULL;
                IF COL_LENGTH('DemandMemberDetails', 'MemberName') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [MemberName] nvarchar(200) NULL;
                IF COL_LENGTH('DemandMemberDetails', 'IsSelected') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [IsSelected] bit NOT NULL CONSTRAINT [DF_DemandMemberDetails_IsSelected] DEFAULT 1;
                IF COL_LENGTH('DemandMemberDetails', 'LoanInstallment') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [LoanInstallment] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandMemberDetails_LoanInstallment] DEFAULT 0;
                IF COL_LENGTH('DemandMemberDetails', 'SavingDeposit') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [SavingDeposit] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandMemberDetails_SavingDeposit] DEFAULT 0;
                IF COL_LENGTH('DemandMemberDetails', 'ShareDeposit') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [ShareDeposit] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandMemberDetails_ShareDeposit] DEFAULT 0;
                IF COL_LENGTH('DemandMemberDetails', 'PigmyDeposit') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [PigmyDeposit] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandMemberDetails_PigmyDeposit] DEFAULT 0;
                IF COL_LENGTH('DemandMemberDetails', 'RdDeposit') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [RdDeposit] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandMemberDetails_RdDeposit] DEFAULT 0;
                IF COL_LENGTH('DemandMemberDetails', 'TotalDeduction') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [TotalDeduction] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandMemberDetails_TotalDeduction] DEFAULT 0;
                IF COL_LENGTH('DemandMemberDetails', 'RecoveredAmount') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [RecoveredAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandMemberDetails_RecoveredAmount] DEFAULT 0;
                IF COL_LENGTH('DemandMemberDetails', 'RecoveryStatus') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [RecoveryStatus] nvarchar(20) NOT NULL CONSTRAINT [DF_DemandMemberDetails_RecoveryStatus] DEFAULT 'Pending';
                IF COL_LENGTH('DemandMemberDetails', 'Remarks') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [Remarks] nvarchar(250) NULL;
                IF COL_LENGTH('DemandMemberDetails', 'IsProcessed') IS NULL
                    ALTER TABLE [dbo].[DemandMemberDetails] ADD [IsProcessed] bit NOT NULL CONSTRAINT [DF_DemandMemberDetails_IsProcessed] DEFAULT 0;
            END

            IF OBJECT_ID(N'[dbo].[DemandRecoveries]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[DemandRecoveries] (
                    [DemandRecoveryId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [DemandNoticeId] int NOT NULL,
                    [BranchId] int NOT NULL DEFAULT 1,
                    [RecoveryDate] datetime2 NOT NULL DEFAULT GETDATE(),
                    [TotalReceivedAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [PaymentMode] nvarchar(30) NOT NULL DEFAULT 'Bank',
                    [BankLedgerID] int NULL,
                    [ReferenceNo] nvarchar(100) NULL,
                    [BatchReference] nvarchar(100) NULL,
                    [IdempotencyKey] nvarchar(100) NULL,
                    [RecoveredMemberCount] int NOT NULL DEFAULT 0,
                    [VoucherId] int NULL,
                    [Remarks] nvarchar(250) NULL,
                    [CreatedDate] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [CreatedBy] int NOT NULL DEFAULT 1
                );
            END
            ELSE
            BEGIN
                IF COL_LENGTH('DemandRecoveries', 'RecoveryID') IS NOT NULL AND COL_LENGTH('DemandRecoveries', 'DemandRecoveryId') IS NULL
                    EXEC sp_rename 'dbo.DemandRecoveries.RecoveryID', 'DemandRecoveryId', 'COLUMN';
                IF COL_LENGTH('DemandRecoveries', 'BranchId') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [BranchId] int NOT NULL CONSTRAINT [DF_DemandRecoveries_BranchId] DEFAULT 1;
                IF COL_LENGTH('DemandRecoveries', 'TotalReceivedAmount') IS NULL
                BEGIN
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [TotalReceivedAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_DemandRecoveries_TotalReceivedAmount] DEFAULT 0;
                    IF COL_LENGTH('DemandRecoveries', 'TotalAmount') IS NOT NULL
                        EXEC(N'UPDATE [dbo].[DemandRecoveries] SET [TotalReceivedAmount] = ISNULL([TotalAmount], 0) WHERE [TotalReceivedAmount] = 0;');
                END
                IF COL_LENGTH('DemandRecoveries', 'PaymentMode') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [PaymentMode] nvarchar(30) NOT NULL CONSTRAINT [DF_DemandRecoveries_PaymentMode] DEFAULT 'Bank';
                IF COL_LENGTH('DemandRecoveries', 'BankLedgerID') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [BankLedgerID] int NULL;
                IF COL_LENGTH('DemandRecoveries', 'ReferenceNo') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [ReferenceNo] nvarchar(100) NULL;
                IF COL_LENGTH('DemandRecoveries', 'BatchReference') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [BatchReference] nvarchar(100) NULL;
                IF COL_LENGTH('DemandRecoveries', 'IdempotencyKey') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [IdempotencyKey] nvarchar(100) NULL;
                IF COL_LENGTH('DemandRecoveries', 'RecoveredMemberCount') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [RecoveredMemberCount] int NOT NULL CONSTRAINT [DF_DemandRecoveries_RecoveredMemberCount] DEFAULT 0;
                IF COL_LENGTH('DemandRecoveries', 'CreatedDate') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [CreatedDate] datetime2 NOT NULL CONSTRAINT [DF_DemandRecoveries_CreatedDate] DEFAULT GETUTCDATE();
                IF COL_LENGTH('DemandRecoveries', 'CreatedBy') IS NULL
                    ALTER TABLE [dbo].[DemandRecoveries] ADD [CreatedBy] int NOT NULL CONSTRAINT [DF_DemandRecoveries_CreatedBy] DEFAULT 1;
            END

            IF OBJECT_ID(N'[dbo].[DemandRecoveries]', N'U') IS NOT NULL
               AND COL_LENGTH('DemandRecoveries', 'IdempotencyKey') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DemandRecoveries_IdempotencyKey' AND object_id = OBJECT_ID('dbo.DemandRecoveries'))
                EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UQ_DemandRecoveries_IdempotencyKey] ON [dbo].[DemandRecoveries] ([IdempotencyKey]) WHERE [IdempotencyKey] IS NOT NULL;');

            IF OBJECT_ID(N'[dbo].[DemandColumnSettings]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[DemandColumnSettings] (
                    [DemandColumnSettingId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [SequenceOrder] int NOT NULL DEFAULT 1,
                    [ColumnHeaderMr] nvarchar(100) NOT NULL,
                    [ItemType] nvarchar(30) NOT NULL DEFAULT 'LOAN',
                    [LoanRateID] int NULL,
                    [SavingSchemeID] int NULL,
                    [RdSchemeID] int NULL,
                    [ShareSchemeId] int NULL,
                    [PrincipalOrDepositLedgerID] int NULL,
                    [InterestLedgerID] int NULL,
                    [ReceivableInterestLedgerID] int NULL,
                    [OverdueInterestLedgerID] int NULL,
                    [ShowBalanceColumn] bit NOT NULL DEFAULT 1,
                    [IncludeOverduePenalInterest] bit NOT NULL DEFAULT 0,
                    [LoanIntraAllocationOrder] nvarchar(20) NOT NULL DEFAULT 'INTEREST_FIRST',
                    [IsContributionTarget] bit NOT NULL DEFAULT 0,
                    [DefaultAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [IsActive] bit NOT NULL DEFAULT 1,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [UpdatedAt] datetime2 NULL
                );
            END

            IF OBJECT_ID(N'[dbo].[DemandMemberColumnItems]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[DemandMemberColumnItems] (
                    [DemandMemberColumnItemId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [DemandMemberDetailId] int NOT NULL,
                    [DemandColumnSettingId] int NULL,
                    [SequenceOrder] int NOT NULL DEFAULT 1,
                    [ItemType] nvarchar(30) NOT NULL DEFAULT 'LOAN',
                    [ColumnHeaderMr] nvarchar(100) NOT NULL DEFAULT '',
                    [SchemeId] int NULL,
                    [AccountId] int NULL,
                    [SourceAccountIdsCsv] nvarchar(500) NULL,
                    [SubRowIndex] int NOT NULL DEFAULT 0,
                    [DisplaySubLabel] nvarchar(150) NULL,
                    [PrincipalOrDepositLedgerID] int NULL,
                    [InterestLedgerID] int NULL,
                    [ReceivableInterestLedgerID] int NULL,
                    [OverdueInterestLedgerID] int NULL,
                    [LoanIntraAllocationOrder] nvarchar(20) NOT NULL DEFAULT 'INTEREST_FIRST',
                    [CurrentBalanceAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [DemandPrincipalOrDeposit] decimal(18,2) NOT NULL DEFAULT 0,
                    [DemandInterest] decimal(18,2) NOT NULL DEFAULT 0,
                    [DemandPenalInterest] decimal(18,2) NOT NULL DEFAULT 0,
                    [RecoveredPrincipalOrDeposit] decimal(18,2) NOT NULL DEFAULT 0,
                    [RecoveredInterest] decimal(18,2) NOT NULL DEFAULT 0,
                    [RecoveredPenalInterest] decimal(18,2) NOT NULL DEFAULT 0
                );
                CREATE NONCLUSTERED INDEX [IX_DemandMemberColumnItems_Member_Seq] ON [dbo].[DemandMemberColumnItems] ([DemandMemberDetailId], [SequenceOrder], [SubRowIndex]);
            END

            IF OBJECT_ID(N'[dbo].[DemandRecoveryAllocations]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[DemandRecoveryAllocations] (
                    [DemandRecoveryAllocationId] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [DemandRecoveryId] int NOT NULL,
                    [DemandMemberDetailId] int NOT NULL,
                    [DemandMemberColumnItemId] int NOT NULL,
                    [AllocatedPrincipalOrDeposit] decimal(18,2) NOT NULL DEFAULT 0,
                    [AllocatedInterest] decimal(18,2) NOT NULL DEFAULT 0,
                    [AllocatedPenalInterest] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalAllocated] decimal(18,2) NOT NULL DEFAULT 0,
                    [GeneratedSubLedgerType] nvarchar(30) NULL,
                    [GeneratedSubLedgerIdsCsv] nvarchar(500) NULL
                );
                CREATE NONCLUSTERED INDEX [IX_DemandRecoveryAllocations_RecoveryId] ON [dbo].[DemandRecoveryAllocations] ([DemandRecoveryId]);
                CREATE NONCLUSTERED INDEX [IX_DemandRecoveryAllocations_ColumnItemId] ON [dbo].[DemandRecoveryAllocations] ([DemandMemberColumnItemId]);
            END

            IF OBJECT_ID(N'[dbo].[DemandColumnSettings]', N'U') IS NOT NULL
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DemandColumnSettings_Active_Loan' AND object_id = OBJECT_ID('dbo.DemandColumnSettings'))
                   AND NOT EXISTS (SELECT 1 FROM [dbo].[DemandColumnSettings] WHERE [IsActive] = 1 AND [ItemType] = 'LOAN' AND [LoanRateID] IS NOT NULL GROUP BY [LoanRateID] HAVING COUNT(*) > 1)
                    EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UQ_DemandColumnSettings_Active_Loan] ON [dbo].[DemandColumnSettings] ([LoanRateID]) WHERE [IsActive] = 1 AND [ItemType] = ''LOAN'' AND [LoanRateID] IS NOT NULL;');

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DemandColumnSettings_Active_Saving' AND object_id = OBJECT_ID('dbo.DemandColumnSettings'))
                   AND NOT EXISTS (SELECT 1 FROM [dbo].[DemandColumnSettings] WHERE [IsActive] = 1 AND [ItemType] = 'THRIFT_SAVING' AND [SavingSchemeID] IS NOT NULL GROUP BY [SavingSchemeID] HAVING COUNT(*) > 1)
                    EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UQ_DemandColumnSettings_Active_Saving] ON [dbo].[DemandColumnSettings] ([SavingSchemeID]) WHERE [IsActive] = 1 AND [ItemType] = ''THRIFT_SAVING'' AND [SavingSchemeID] IS NOT NULL;');

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DemandColumnSettings_Active_Rd' AND object_id = OBJECT_ID('dbo.DemandColumnSettings'))
                   AND NOT EXISTS (SELECT 1 FROM [dbo].[DemandColumnSettings] WHERE [IsActive] = 1 AND [ItemType] = 'RD' AND [RdSchemeID] IS NOT NULL GROUP BY [RdSchemeID] HAVING COUNT(*) > 1)
                    EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UQ_DemandColumnSettings_Active_Rd] ON [dbo].[DemandColumnSettings] ([RdSchemeID]) WHERE [IsActive] = 1 AND [ItemType] = ''RD'' AND [RdSchemeID] IS NOT NULL;');

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DemandColumnSettings_Active_Share' AND object_id = OBJECT_ID('dbo.DemandColumnSettings'))
                   AND NOT EXISTS (SELECT 1 FROM [dbo].[DemandColumnSettings] WHERE [IsActive] = 1 AND [ItemType] = 'SHARE' AND [ShareSchemeId] IS NOT NULL GROUP BY [ShareSchemeId] HAVING COUNT(*) > 1)
                    EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UQ_DemandColumnSettings_Active_Share] ON [dbo].[DemandColumnSettings] ([ShareSchemeId]) WHERE [IsActive] = 1 AND [ItemType] = ''SHARE'' AND [ShareSchemeId] IS NOT NULL;');

                IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_DemandColumnSettings_Active_ContribTarget' AND object_id = OBJECT_ID('dbo.DemandColumnSettings'))
                   AND NOT EXISTS (SELECT 1 FROM [dbo].[DemandColumnSettings] WHERE [IsActive] = 1 AND [IsContributionTarget] = 1 HAVING COUNT(*) > 1)
                    EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX [UQ_DemandColumnSettings_Active_ContribTarget] ON [dbo].[DemandColumnSettings] ([IsContributionTarget]) WHERE [IsActive] = 1 AND [IsContributionTarget] = 1;');
            END
        ");
            Log.Information("Employee Salary Demand schema DDL verified successfully.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to verify Employee Salary Demand schema DDL");
        }

        try
        {
            db.Database.ExecuteSqlRaw(@"
            IF OBJECT_ID(N'[dbo].[SansthaExternalLockers]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SansthaExternalLockers] (
                    [ExternalLockerID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [InstitutionID] int NULL,
                    [BankOrSocietyName] nvarchar(150) NOT NULL,
                    [BankBranchName] nvarchar(100) NULL,
                    [LockerNo] nvarchar(50) NOT NULL,
                    [CabinetOrBoxNo] nvarchar(50) NULL,
                    [KeyNo] nvarchar(50) NULL,
                    [AnnualRentAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [AgreementStartDate] datetime2 NULL,
                    [AgreementExpiryDate] datetime2 NULL,
                    [AuthorizedSignatories] nvarchar(200) NULL,
                    [Remarks] nvarchar(300) NULL,
                    [IsActive] bit NOT NULL DEFAULT 1,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE()
                );
            END

            IF OBJECT_ID(N'[dbo].[SansthaBorrowings]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SansthaBorrowings] (
                    [BorrowingID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [FinancialYearID] int NOT NULL DEFAULT 1,
                    [BorrowingNo] nvarchar(50) NOT NULL,
                    [LenderInstitutionID] int NULL,
                    [LenderName] nvarchar(150) NOT NULL,
                    [LenderBranchName] nvarchar(100) NULL,
                    [ExternalLoanAccountNo] nvarchar(80) NULL,
                    [BorrowingType] nvarchar(40) NOT NULL DEFAULT 'GOLD_REPLEDGE',
                    [PledgedInvestmentAccountID] int NULL,
                    [SanctionDate] datetime2 NOT NULL,
                    [DisbursementDate] datetime2 NOT NULL,
                    [MaturityDate] datetime2 NULL,
                    [SanctionedAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [DisbursedAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [OutstandingPrincipal] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalInterestPaid] decimal(18,2) NOT NULL DEFAULT 0,
                    [BorrowingInterestRate] decimal(18,2) NOT NULL DEFAULT 0,
                    [InterestCalculationMethod] nvarchar(40) NOT NULL DEFAULT 'Reducing',
                    [InstallmentAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [BorrowingLiabilityLedgerID] int NOT NULL,
                    [InterestExpenseLedgerID] int NOT NULL,
                    [PaymentMode] nvarchar(30) NOT NULL DEFAULT 'Bank',
                    [BankLedgerID] int NULL,
                    [ReferenceNo] nvarchar(80) NULL,
                    [DisbursementVoucherID] int NULL,
                    [PurposeOrLinkedLoansNote] nvarchar(300) NULL,
                    [Remarks] nvarchar(300) NULL,
                    [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
                    [ClosedDate] datetime2 NULL,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [UpdatedAt] datetime2 NULL
                );
                CREATE UNIQUE NONCLUSTERED INDEX [UQ_SansthaBorrowings_BorrowingNo] ON [dbo].[SansthaBorrowings] ([BorrowingNo]);
            END

            IF OBJECT_ID(N'[dbo].[GoldLoanCustodies]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[GoldLoanCustodies] (
                    [GoldCustodyID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [LoanAccountID] int NOT NULL,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [PacketNumber] nvarchar(60) NOT NULL,
                    [SealNumber] nvarchar(60) NULL,
                    [TotalOrnamentsCount] int NOT NULL DEFAULT 0,
                    [TotalGrossWeight] decimal(18,3) NOT NULL DEFAULT 0,
                    [TotalNetWeight] decimal(18,3) NOT NULL DEFAULT 0,
                    [TotalValuationAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [CustodyStatus] nvarchar(40) NOT NULL DEFAULT 'BRANCH_SAFE',
                    [VaultRackOrTrayNo] nvarchar(100) NULL,
                    [OwnLockerID] int NULL,
                    [ExternalLockerID] int NULL,
                    [ActiveBorrowingID] int NULL,
                    [CustodyReceivedDate] datetime2 NOT NULL,
                    [LastLocationUpdatedDate] datetime2 NULL,
                    [ReleasedDate] datetime2 NULL,
                    [ReleasedToName] nvarchar(150) NULL,
                    [ReleasedToRelation] nvarchar(60) NULL,
                    [ReceiverMobile] nvarchar(20) NULL,
                    [ReceiverIdProof] nvarchar(100) NULL,
                    [ReleaseReceiptNo] nvarchar(60) NULL,
                    [ReleasePhotoOrDocPath] nvarchar(500) NULL,
                    [SettlementCollectionID] int NULL,
                    [ReleasedByUserID] int NULL,
                    [Remarks] nvarchar(500) NULL,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
                    [UpdatedAt] datetime2 NULL
                );
                CREATE UNIQUE NONCLUSTERED INDEX [UQ_GoldLoanCustodies_LoanAccountID] ON [dbo].[GoldLoanCustodies] ([LoanAccountID]);
            END

            IF OBJECT_ID(N'[dbo].[GoldCustodyMovementLogs]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[GoldCustodyMovementLogs] (
                    [MovementLogID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [GoldCustodyID] int NOT NULL,
                    [LoanAccountID] int NOT NULL,
                    [FromStatus] nvarchar(40) NULL,
                    [ToStatus] nvarchar(40) NOT NULL,
                    [FromLocationSummary] nvarchar(250) NULL,
                    [ToLocationSummary] nvarchar(250) NOT NULL,
                    [ReferenceBorrowingID] int NULL,
                    [Remarks] nvarchar(300) NULL,
                    [MovementDate] datetime2 NOT NULL,
                    [MovedByUserID] int NOT NULL DEFAULT 1,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE()
                );
                CREATE NONCLUSTERED INDEX [IX_GoldCustodyMovementLogs_Custody] ON [dbo].[GoldCustodyMovementLogs] ([GoldCustodyID], [MovementDate]);
            END

            IF OBJECT_ID(N'[dbo].[SansthaBorrowingGoldPledges]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SansthaBorrowingGoldPledges] (
                    [BorrowingGoldPledgeID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BorrowingID] int NOT NULL,
                    [LoanAccountID] int NOT NULL,
                    [GoldCustodyID] int NOT NULL,
                    [CustomerLoanInterestRate] decimal(18,2) NOT NULL DEFAULT 0,
                    [InterestSpreadPercent] decimal(18,2) NOT NULL DEFAULT 0,
                    [AllocatedBorrowedAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [LenderPledgeReceiptNo] nvarchar(80) NULL,
                    [PledgedDate] datetime2 NOT NULL,
                    [PreviousCustodyStatus] nvarchar(40) NOT NULL DEFAULT 'BRANCH_SAFE',
                    [PreviousOwnLockerID] int NULL,
                    [PreviousExternalLockerID] int NULL,
                    [PreviousVaultRackNo] nvarchar(100) NULL,
                    [PledgeStatus] nvarchar(20) NOT NULL DEFAULT 'Pledged',
                    [ReleasedDate] datetime2 NULL,
                    [ReleasedOnRepaymentID] int NULL,
                    [ReleaseRemarks] nvarchar(250) NULL
                );
                CREATE NONCLUSTERED INDEX [IX_SansthaBorrowingGoldPledges_Borrowing] ON [dbo].[SansthaBorrowingGoldPledges] ([BorrowingID], [PledgeStatus]);
                CREATE NONCLUSTERED INDEX [IX_SansthaBorrowingGoldPledges_Loan] ON [dbo].[SansthaBorrowingGoldPledges] ([LoanAccountID], [PledgeStatus]);
            END

            IF OBJECT_ID(N'[dbo].[SansthaBorrowingRepayments]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[SansthaBorrowingRepayments] (
                    [BorrowingRepaymentID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [BorrowingID] int NOT NULL,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [RepaymentDate] datetime2 NOT NULL,
                    [PrincipalPaid] decimal(18,2) NOT NULL DEFAULT 0,
                    [InterestPaid] decimal(18,2) NOT NULL DEFAULT 0,
                    [PenalOrChargesPaid] decimal(18,2) NOT NULL DEFAULT 0,
                    [TotalPaid] decimal(18,2) NOT NULL DEFAULT 0,
                    [PaymentMode] nvarchar(30) NOT NULL DEFAULT 'Bank',
                    [BankLedgerID] int NULL,
                    [ReferenceNo] nvarchar(80) NULL,
                    [VoucherID] int NULL,
                    [Remarks] nvarchar(300) NULL,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE()
                );
                CREATE NONCLUSTERED INDEX [IX_SansthaBorrowingRepayments_Borrowing] ON [dbo].[SansthaBorrowingRepayments] ([BorrowingID], [RepaymentDate]);
            END

            IF COL_LENGTH(N'[dbo].[PigmySchemes]', N'PrematureDeductionLedgerID') IS NULL
                ALTER TABLE [dbo].[PigmySchemes] ADD [PrematureDeductionLedgerID] int NULL;

            IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'DeductPrematureWithdrawals') IS NULL
                ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [DeductPrematureWithdrawals] bit NOT NULL CONSTRAINT [DF_PigmyCommSettings_DeductPrem] DEFAULT 0;

            IF COL_LENGTH(N'[dbo].[PigmyCommissionSettings]', N'PrematureLockInDays') IS NULL
                ALTER TABLE [dbo].[PigmyCommissionSettings] ADD [PrematureLockInDays] int NOT NULL CONSTRAINT [DF_PigmyCommSettings_LockDays] DEFAULT 90;

            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'VoucherID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [VoucherID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'PaymentMode') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [PaymentMode] nvarchar(30) NOT NULL CONSTRAINT [DF_PigmyWithdrawals_PayMode] DEFAULT 'Cash';
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'BankLedgerID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [BankLedgerID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'SavingAccountID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [SavingAccountID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'ReferenceNo') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [ReferenceNo] nvarchar(80) NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'AdjustInLoan') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [AdjustInLoan] bit NOT NULL CONSTRAINT [DF_PigmyWithdrawals_AdjLoan] DEFAULT 0;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'TargetLoanAccountID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [TargetLoanAccountID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'LoanAdjustedAmount') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [LoanAdjustedAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_PigmyWithdrawals_LoanAdjAmt] DEFAULT 0;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'LinkedLoanCollectionID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [LinkedLoanCollectionID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'SurplusPayoutAmount') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [SurplusPayoutAmount] decimal(18,2) NOT NULL CONSTRAINT [DF_PigmyWithdrawals_SurplusAmt] DEFAULT 0;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'SurplusPaymentMode') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [SurplusPaymentMode] nvarchar(30) NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'SurplusBankLedgerID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [SurplusBankLedgerID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'SurplusSavingAccountID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [SurplusSavingAccountID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'DeductionLedgerID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [DeductionLedgerID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'InterestDebitLedgerID') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [InterestDebitLedgerID] int NULL;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'IsManualOverride') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [IsManualOverride] bit NOT NULL CONSTRAINT [DF_PigmyWithdrawals_ManOvr] DEFAULT 0;
            IF COL_LENGTH(N'[dbo].[PigmyWithdrawals]', N'OverrideReason') IS NULL
                ALTER TABLE [dbo].[PigmyWithdrawals] ADD [OverrideReason] nvarchar(250) NULL;

            IF OBJECT_ID(N'[dbo].[PigmyAccountClosures]', N'U') IS NULL
            BEGIN
                CREATE TABLE [dbo].[PigmyAccountClosures] (
                    [PigmyClosureID] int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    [PigmyAccountID] int NOT NULL,
                    [BranchID] int NOT NULL DEFAULT 1,
                    [ClosureDate] datetime2 NOT NULL,
                    [IsPremature] bit NOT NULL DEFAULT 0,
                    [CycleNumber] int NOT NULL DEFAULT 1,
                    [CycleStartSnapshot] datetime2 NOT NULL,
                    [ElapsedDays] int NOT NULL DEFAULT 0,
                    [GrossDepositBalance] decimal(18,2) NOT NULL DEFAULT 0,
                    [AlreadyCapitalizedInterest] decimal(18,2) NOT NULL DEFAULT 0,
                    [VerifiedProvisionedInterest] decimal(18,2) NOT NULL DEFAULT 0,
                    [AppliedSlabID] int NULL,
                    [CalculatedPenaltyRate] decimal(5,2) NOT NULL DEFAULT 0,
                    [CommissionOrPenaltyAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [DeductionLedgerID] int NULL,
                    [CalculatedInterestRate] decimal(5,2) NOT NULL DEFAULT 0,
                    [FinalInterestAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [InterestDebitMode] nvarchar(30) NOT NULL DEFAULT 'Expense',
                    [InterestDebitLedgerID] int NULL,
                    [NetPayableAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [PaymentMode] nvarchar(30) NOT NULL DEFAULT 'Cash',
                    [BankLedgerID] int NULL,
                    [SavingAccountID] int NULL,
                    [ReferenceNo] nvarchar(80) NULL,
                    [AdjustInLoan] bit NOT NULL DEFAULT 0,
                    [TargetLoanAccountID] int NULL,
                    [LoanAdjustedAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [LinkedLoanCollectionID] int NULL,
                    [SurplusPayoutAmount] decimal(18,2) NOT NULL DEFAULT 0,
                    [SurplusPaymentMode] nvarchar(30) NULL,
                    [SurplusBankLedgerID] int NULL,
                    [SurplusSavingAccountID] int NULL,
                    [PreviousAccountStatus] nvarchar(20) NOT NULL DEFAULT 'Active',
                    [WasLienMarked] bit NOT NULL DEFAULT 0,
                    [PreviousLienLoanAccountNo] nvarchar(50) NULL,
                    [PreviousLienAmount] decimal(18,2) NULL,
                    [IsManualOverride] bit NOT NULL DEFAULT 0,
                    [OverrideReason] nvarchar(250) NULL,
                    [VoucherID] int NULL,
                    [VoucherNo] nvarchar(60) NULL,
                    [Narration] nvarchar(500) NULL,
                    [CreatedBy] int NOT NULL DEFAULT 1,
                    [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE()
                );
                CREATE NONCLUSTERED INDEX [IX_PigmyAccountClosures_Account] ON [dbo].[PigmyAccountClosures] ([PigmyAccountID]);
                CREATE NONCLUSTERED INDEX [IX_PigmyAccountClosures_Voucher] ON [dbo].[PigmyAccountClosures] ([VoucherID]);
            END
            ");
            Log.Information("Gold Custody & Sanstha Borrowing schema DDL verified successfully.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to verify Gold Custody & Sanstha Borrowing schema DDL");
        }

        try
        {
            // Core Banking Inter-Branch Transfer (IBT) Startup Auto-Sync & Historical Self-Healing
            Bhisi.Api.Helpers.IbtLedgerHelper.EnsureIbtLedgerProvisionedAsync(db).GetAwaiter().GetResult();
            int repaired = Bhisi.Api.Helpers.IbtLedgerHelper.RepairHistoricalCrossBranchCollectionsAsync(db).GetAwaiter().GetResult();
            int syncedHalfIbt = Bhisi.Api.Helpers.IbtLedgerHelper.RepairHalfApprovedIbtPairsAsync(db).GetAwaiter().GetResult();
            Log.Information("Core Banking Inter-Branch Transfer (IBT) ledger provisioned. Repaired collections: {RepairedCount}, Synced half-approved IBT pairs: {SyncedCount}", repaired, syncedHalfIbt);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to auto-provision IBT ledger or repair historical cross-branch collections on startup");
        }

        try
        {
            // Core Banking Loan Opening Balance to Branch GL Auto-Sync Startup Initialization
            int initialFyId = Bhisi.Api.Helpers.BranchLedgerBalanceHelper.GetInitialFinancialYearIdAsync(db).GetAwaiter().GetResult();
            var branchIds = db.Branches.Select(b => b.BranchID).ToList();
            if (initialFyId > 0 && branchIds.Any())
            {
                var loanLedgerGroups = db.LoanRates
                    .Where(r => r.LoanLedgerID.HasValue && r.LoanLedgerID.Value > 0)
                    .ToList()
                    .GroupBy(r => r.LoanLedgerID!.Value)
                    .Select(g => new { LedgerID = g.Key, RateIds = g.Select(r => r.LoanRateID).ToList() })
                    .ToList();

                foreach (var item in loanLedgerGroups)
                {
                    if (db.Ledgers.Find(item.LedgerID) == null) continue;

                    foreach (int bId in branchIds)
                    {
                        bool exists = db.BranchLedgerOpeningBalances.Any(b =>
                            b.BranchID == bId && b.LedgerID == item.LedgerID && b.FinancialYearID == initialFyId);
                        if (exists) continue;

                        decimal totalPrincipal = db.LoanAccounts
                            .Where(a => a.BranchID == bId && item.RateIds.Contains(a.LoanRateID) && a.IsOpeningBalance)
                            .Sum(a => a.PrincipalBalance);

                        if (totalPrincipal > 0)
                        {
                            Bhisi.Api.Helpers.BranchLedgerBalanceHelper.SetBranchLedgerOpeningBalanceAsync(
                                db, bId, item.LedgerID, totalPrincipal, "Dr",
                                "Startup Loan SL->Branch OB Backfill", initialFyId).GetAwaiter().GetResult();
                        }
                    }
                }
                db.SaveChanges();
            }
            Log.Information("Loan Schemes Branch GL Opening Balances checked on startup.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to auto-sync Loan Schemes GL Opening Balances on startup");
        }

        try
        {
            // Core Banking Pigmy Opening Balance to Branch GL Auto-Sync Startup Initialization
            var pigmySchemes = db.PigmySchemes.ToList();
            int initialFyId = Bhisi.Api.Helpers.BranchLedgerBalanceHelper.GetInitialFinancialYearIdAsync(db).GetAwaiter().GetResult();
            var branchIds = db.Branches.Select(b => b.BranchID).ToList();

            foreach (var scheme in pigmySchemes)
            {
                int liabilityLedgerId = 0;
                if (scheme.PigmyLiabilityLedgerID.HasValue && scheme.PigmyLiabilityLedgerID.Value > 0)
                {
                    liabilityLedgerId = scheme.PigmyLiabilityLedgerID.Value;
                }
                else
                {
                    var fallback = db.Ledgers.FirstOrDefault(l => l.LedgerName.Contains("पिग्मी") || l.LedgerName.Contains("Pigmy"));
                    if (fallback != null)
                    {
                        liabilityLedgerId = fallback.LedgerID;
                        scheme.PigmyLiabilityLedgerID = liabilityLedgerId;
                    }
                }

                if (liabilityLedgerId > 0 && initialFyId > 0 && branchIds.Any() && db.Ledgers.Find(liabilityLedgerId) != null)
                {
                    var mappedSchemeIds = db.PigmySchemes
                        .Where(s => s.PigmyLiabilityLedgerID == liabilityLedgerId)
                        .Select(s => s.PigmySchemeID)
                        .ToList();
                    if (!mappedSchemeIds.Contains(scheme.PigmySchemeID))
                    {
                        mappedSchemeIds.Add(scheme.PigmySchemeID);
                    }

                    foreach (int bId in branchIds)
                    {
                        bool exists = db.BranchLedgerOpeningBalances.Any(b =>
                            b.BranchID == bId && b.LedgerID == liabilityLedgerId && b.FinancialYearID == initialFyId);
                        if (exists) continue;

                        var accounts = db.PigmyAccounts
                            .Where(a => a.BranchID == bId && mappedSchemeIds.Contains(a.PigmySchemeID) && a.Status == "Active")
                            .Select(a => a.PigmyAccountID)
                            .ToList();

                        decimal totalOpeningCr = 0;
                        if (accounts.Any())
                        {
                            totalOpeningCr = db.PigmyOpeningBalances
                                .Where(o => accounts.Contains(o.PigmyAccountID))
                                .GroupBy(o => o.PigmyAccountID)
                                .Select(g => g.OrderByDescending(x => x.PigmyOpeningBalanceID).Select(x => x.MigratedBalanceAmount).FirstOrDefault())
                                .Sum();
                        }

                        if (totalOpeningCr > 0)
                        {
                            Bhisi.Api.Helpers.BranchLedgerBalanceHelper.SetBranchLedgerOpeningBalanceAsync(
                                db, bId, liabilityLedgerId, totalOpeningCr, "Cr",
                                "Startup Pigmy SL->Branch OB Backfill", initialFyId).GetAwaiter().GetResult();
                        }
                    }
                }
            }
            db.SaveChanges();
            Log.Information("Pigmy Schemes Branch GL Opening Balances checked on startup.");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to auto-sync Pigmy Schemes GL Opening Balances on startup");
        }

        try
        {
            // Core Banking Pigmy Duplicate Per-Customer Import/Bulk Voucher Cleanup (Post 31/03/2026)
            // Ensures individual customer collections stay strictly in PigmyCollections/PigmyTransactions (Collection List)
            // while Daybook & GL only retain consolidated Agent Remittance vouchers (PV-...-AGT-...).
            var cutoffDate = new DateTime(2026, 3, 31, 23, 59, 59);
            var depositVoucherIds = db.PigmyAgentCashDeposits
                .Where(d => d.VoucherId.HasValue)
                .Select(d => d.VoucherId!.Value)
                .ToHashSet();

            var badPigmyVouchers = db.Vouchers
                .Where(v => v.VoucherDate > cutoffDate &&
                            v.VoucherNo != null &&
                            v.VoucherNo.StartsWith("PV-") &&
                            !v.VoucherNo.Contains("-AGT-") &&
                            !v.VoucherNo.Contains("-OP-") &&
                            !v.VoucherNo.Contains("-PIGMY-") &&
                            (v.VoucherNo.Contains("-IMP-") ||
                             v.VoucherNo.Contains("-BLK-") ||
                             (v.Narration != null && (
                                 v.Narration.StartsWith("Pigmy Chart ") ||
                                 v.Narration.StartsWith("Pigmy Bulk Manual Collection") ||
                                 v.Narration.StartsWith("Pigmy Manual Collection") ||
                                 v.Narration.StartsWith("Pigmy App Collection") ||
                                 v.Narration.StartsWith("पिग्मी मासिक एक्सेल संकलन")))))
                .Select(v => v.VoucherID)
                .ToList()
                .Where(id => !depositVoucherIds.Contains(id))
                .ToList();

            if (badPigmyVouchers.Count > 0)
            {
                var badSet = badPigmyVouchers.ToHashSet();

                // 1. Re-link collections covered by PigmyAgentCashDeposits to their consolidated AGT voucher
                var allDeposits = db.PigmyAgentCashDeposits
                    .Where(d => d.VoucherId.HasValue)
                    .OrderBy(d => d.DepositDate)
                    .ThenBy(d => d.DepositId)
                    .ToList();

                foreach (var dep in allDeposits)
                {
                    DateTime? cFrom = dep.CollectionDateFrom?.Date;
                    DateTime? cTo = dep.CollectionDateTo?.Date ?? cFrom;
                    if (!cFrom.HasValue && !string.IsNullOrEmpty(dep.Narration) && dep.Narration.Contains("[संकलन:"))
                    {
                        try
                        {
                            int sIdx = dep.Narration.IndexOf("[संकलन:") + 7;
                            int eIdx = dep.Narration.IndexOf("]", sIdx);
                            if (eIdx > sIdx)
                            {
                                string tag = dep.Narration.Substring(sIdx, eIdx - sIdx).Trim();
                                if (tag.Contains("ते"))
                                {
                                    var parts = tag.Split(new[] { "ते" }, StringSplitOptions.None);
                                    if (parts.Length == 2 &&
                                        DateTime.TryParseExact(parts[0].Trim(), "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out var pf) &&
                                        DateTime.TryParseExact(parts[1].Trim(), "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out var pt))
                                    {
                                        cFrom = pf.Date;
                                        cTo = pt.Date;
                                    }
                                }
                                else if (DateTime.TryParseExact(tag, "dd/MM/yyyy", null, System.Globalization.DateTimeStyles.None, out var ps))
                                {
                                    cFrom = ps.Date;
                                    cTo = ps.Date;
                                }
                            }
                        }
                        catch { }
                    }

                    if (cFrom.HasValue && cTo.HasValue)
                    {
                        var fDate = cFrom.Value.Date;
                        var tDate = cTo.Value.Date.AddDays(1);
                        var matchedCols = db.PigmyCollections
                            .Where(c => c.AgentId == dep.AgentId &&
                                        c.CollectionDate >= fDate &&
                                        c.CollectionDate < tDate &&
                                        c.CollectionDate > cutoffDate)
                            .ToList();
                        foreach (var col in matchedCols)
                        {
                            col.VoucherId = dep.VoucherId;
                            col.IsVoucherGenerated = true;
                        }
                    }
                }
                db.SaveChanges();

                // 2. Unlink any remaining PigmyCollections still pointing to bad per-customer vouchers
                var remainingCols = db.PigmyCollections
                    .Where(c => c.VoucherId.HasValue && badSet.Contains(c.VoucherId.Value))
                    .ToList();
                foreach (var col in remainingCols)
                {
                    col.VoucherId = null;
                    col.IsVoucherGenerated = false;
                }
                db.SaveChanges();

                // 3. Delete VoucherDetails and Vouchers in safe batches
                foreach (var chunk in badPigmyVouchers.Chunk(500))
                {
                    var chunkList = chunk.ToList();
                    var detailsToRemove = db.VoucherDetails.Where(vd => chunkList.Contains(vd.VoucherID)).ToList();
                    if (detailsToRemove.Any())
                    {
                        db.VoucherDetails.RemoveRange(detailsToRemove);
                    }
                    var vouchersToRemove = db.Vouchers.Where(v => chunkList.Contains(v.VoucherID)).ToList();
                    if (vouchersToRemove.Any())
                    {
                        db.Vouchers.RemoveRange(vouchersToRemove);
                    }
                    db.SaveChanges();
                }

                Log.Information("Cleaned up {Count} duplicate per-customer Pigmy import/bulk vouchers (post 31/03/2026) and aligned collections to consolidated Agent Remittance vouchers.", badPigmyVouchers.Count);
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to clean up duplicate Pigmy per-customer import vouchers on startup");
        }

        try
        {
            int healedOrphanSbDebits = Bhisi.Api.Helpers.SavingLedgerHelper.HealVerifiedOrphanFdSbDebitsAsync(db).GetAwaiter().GetResult();
            if (healedOrphanSbDebits > 0)
            {
                Log.Information("Healed {Count} verified orphan FD Opening SB Debit SavingTransactions on startup.", healedOrphanSbDebits);
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to auto-heal orphan FD Opening SB Debit transactions on startup");
        }

        try
        {
            db.Database.ExecuteSqlRaw(@"
                IF OBJECT_ID('dbo.SansthaBorrowings', 'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('SansthaBorrowings', 'SanctionLetterNo') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [SanctionLetterNo] NVARCHAR(80) NULL;
                    IF COL_LENGTH('SansthaBorrowings', 'PenalInterestRate') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [PenalInterestRate] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_SansthaBrw_PenRate] DEFAULT 0;
                    IF COL_LENGTH('SansthaBorrowings', 'InstallmentType') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [InstallmentType] NVARCHAR(30) NOT NULL CONSTRAINT [DF_SansthaBrw_InstType] DEFAULT 'EMI';
                    IF COL_LENGTH('SansthaBorrowings', 'InstallmentFrequency') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [InstallmentFrequency] NVARCHAR(30) NOT NULL CONSTRAINT [DF_SansthaBrw_InstFreq] DEFAULT 'Monthly';
                    IF COL_LENGTH('SansthaBorrowings', 'TenureMonths') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [TenureMonths] INT NOT NULL CONSTRAINT [DF_SansthaBrw_TenureM] DEFAULT 12;
                    IF COL_LENGTH('SansthaBorrowings', 'TotalInstallments') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [TotalInstallments] INT NOT NULL CONSTRAINT [DF_SansthaBrw_TotInst] DEFAULT 12;
                    IF COL_LENGTH('SansthaBorrowings', 'MoratoriumMonths') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [MoratoriumMonths] INT NOT NULL CONSTRAINT [DF_SansthaBrw_MoratM] DEFAULT 0;
                    IF COL_LENGTH('SansthaBorrowings', 'FirstInstallmentDueDate') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [FirstInstallmentDueDate] DATETIME2 NULL;
                    IF COL_LENGTH('SansthaBorrowings', 'LastInterestPaidDate') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [LastInterestPaidDate] DATETIME2 NULL;
                    IF COL_LENGTH('SansthaBorrowings', 'IsOpeningBalance') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [IsOpeningBalance] BIT NOT NULL CONSTRAINT [DF_SansthaBrw_IsOB] DEFAULT 0;
                    IF COL_LENGTH('SansthaBorrowings', 'ProcessingChargesLedgerID') IS NULL ALTER TABLE [dbo].[SansthaBorrowings] ADD [ProcessingChargesLedgerID] INT NULL;
                END

                IF OBJECT_ID('dbo.SansthaBorrowingGoldPledges', 'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('SansthaBorrowingGoldPledges', 'BorrowingDisbursementID') IS NULL
                        ALTER TABLE [dbo].[SansthaBorrowingGoldPledges] ADD [BorrowingDisbursementID] INT NULL;
                END

                IF OBJECT_ID('dbo.SansthaBorrowingRepayments', 'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('SansthaBorrowingRepayments', 'RepaymentNo') IS NULL ALTER TABLE [dbo].[SansthaBorrowingRepayments] ADD [RepaymentNo] NVARCHAR(60) NULL;
                    IF COL_LENGTH('SansthaBorrowingRepayments', 'RepaymentType') IS NULL ALTER TABLE [dbo].[SansthaBorrowingRepayments] ADD [RepaymentType] NVARCHAR(30) NOT NULL CONSTRAINT [DF_SansthaBrwRep_Type] DEFAULT 'RegularEMI';
                    IF COL_LENGTH('SansthaBorrowingRepayments', 'InstallmentsCovered') IS NULL ALTER TABLE [dbo].[SansthaBorrowingRepayments] ADD [InstallmentsCovered] NVARCHAR(120) NULL;
                    IF COL_LENGTH('SansthaBorrowingRepayments', 'ChargesLedgerID') IS NULL ALTER TABLE [dbo].[SansthaBorrowingRepayments] ADD [ChargesLedgerID] INT NULL;
                    IF COL_LENGTH('SansthaBorrowingRepayments', 'BalanceBeforeRepayment') IS NULL ALTER TABLE [dbo].[SansthaBorrowingRepayments] ADD [BalanceBeforeRepayment] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_SansthaBrwRep_BalBefore] DEFAULT 0;
                    IF COL_LENGTH('SansthaBorrowingRepayments', 'BalanceAfterRepayment') IS NULL ALTER TABLE [dbo].[SansthaBorrowingRepayments] ADD [BalanceAfterRepayment] DECIMAL(18,2) NOT NULL CONSTRAINT [DF_SansthaBrwRep_BalAfter] DEFAULT 0;
                    IF COL_LENGTH('SansthaBorrowingRepayments', 'PreviousLastInterestPaidDate') IS NULL ALTER TABLE [dbo].[SansthaBorrowingRepayments] ADD [PreviousLastInterestPaidDate] DATETIME2 NULL;
                END

                IF OBJECT_ID('dbo.SansthaBorrowingDisbursements', 'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[SansthaBorrowingDisbursements] (
                        [BorrowingDisbursementID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [BorrowingID] INT NOT NULL,
                        [BranchID] INT NOT NULL DEFAULT 1,
                        [DisbursementNo] NVARCHAR(60) NOT NULL,
                        [DisbursementDate] DATETIME2 NOT NULL,
                        [GrossDisbursedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [ProcessingFeeDeducted] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [OtherDeductionsAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [DeductionLedgerID] INT NULL,
                        [NetReceivedAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [PaymentMode] NVARCHAR(30) NOT NULL DEFAULT 'Bank',
                        [BankLedgerID] INT NULL,
                        [ReferenceNo] NVARCHAR(80) NULL,
                        [VoucherID] INT NULL,
                        [Remarks] NVARCHAR(300) NULL,
                        [CreatedBy] INT NOT NULL DEFAULT 1,
                        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
                    );
                    CREATE NONCLUSTERED INDEX [IX_SansthaBorrowingDisbursements_Borrowing] ON [dbo].[SansthaBorrowingDisbursements] ([BorrowingID], [DisbursementDate]);
                    CREATE NONCLUSTERED INDEX [IX_SansthaBorrowingDisbursements_Voucher] ON [dbo].[SansthaBorrowingDisbursements] ([VoucherID]);
                END

                IF OBJECT_ID('dbo.SansthaBorrowingInstallmentSchedules', 'U') IS NULL
                BEGIN
                    CREATE TABLE [dbo].[SansthaBorrowingInstallmentSchedules] (
                        [ScheduleID] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [BorrowingID] INT NOT NULL,
                        [InstallmentNo] INT NOT NULL,
                        [DueDate] DATETIME2 NOT NULL,
                        [OpeningPrincipal] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [PrincipalDue] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [InterestDue] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [TotalInstallmentAmount] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [ClosingPrincipal] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [PrincipalPaid] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [InterestPaid] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [PenaltyPaid] DECIMAL(18,2) NOT NULL DEFAULT 0,
                        [PaidDate] DATETIME2 NULL,
                        [Status] NVARCHAR(20) NOT NULL DEFAULT 'Pending',
                        [Remarks] NVARCHAR(200) NULL
                    );
                    CREATE NONCLUSTERED INDEX [IX_SansthaBorrowingSchedules_Borrowing] ON [dbo].[SansthaBorrowingInstallmentSchedules] ([BorrowingID], [InstallmentNo]);
                    CREATE NONCLUSTERED INDEX [IX_SansthaBorrowingSchedules_DueDate] ON [dbo].[SansthaBorrowingInstallmentSchedules] ([DueDate], [Status]);
                END

                IF OBJECT_ID('dbo.PigmySchemes', 'U') IS NOT NULL
                BEGIN
                    IF COL_LENGTH('PigmySchemes', 'TenureDays') IS NULL
                        ALTER TABLE [dbo].[PigmySchemes] ADD [TenureDays] INT NOT NULL CONSTRAINT [DF_PigmySchemes_TenureDays] DEFAULT 365;
                    IF COL_LENGTH('PigmySchemes', 'InterestDaysInYear') IS NULL
                        ALTER TABLE [dbo].[PigmySchemes] ADD [InterestDaysInYear] INT NOT NULL CONSTRAINT [DF_PigmySchemes_IntDays] DEFAULT 365;
                END
            ");

            await db.Database.ExecuteSqlRawAsync(@"
                IF OBJECT_ID('dbo.PigmySchemes', 'U') IS NOT NULL
                BEGIN
                    UPDATE [dbo].[PigmySchemes]
                    SET [TenureDays] = [DurationMonths],
                        [DurationMonths] = CASE WHEN ROUND([DurationMonths] / 30.0, 0) < 1 THEN 1 ELSE CAST(ROUND([DurationMonths] / 30.0, 0) AS INT) END
                    WHERE [DurationMonths] > 60;

                    IF OBJECT_ID('dbo.PigmySchemeInterestSlabs', 'U') IS NOT NULL
                    BEGIN
                        ;WITH SlabMax AS (
                            SELECT [PigmySchemeID], MAX([ToDays]) AS MaxToDays
                            FROM [dbo].[PigmySchemeInterestSlabs]
                            WHERE [IsActive] = 1
                            GROUP BY [PigmySchemeID]
                        )
                        UPDATE s
                        SET s.[TenureDays] = sm.MaxToDays
                        FROM [dbo].[PigmySchemes] s
                        INNER JOIN SlabMax sm ON s.[PigmySchemeID] = sm.[PigmySchemeID]
                        WHERE sm.MaxToDays > 0;
                    END

                    IF OBJECT_ID('dbo.PigmyAccounts', 'U') IS NOT NULL
                    BEGIN
                        UPDATE a
                        SET a.[MaturityDate] = DATEADD(DAY, CASE WHEN s.[TenureDays] > 0 THEN s.[TenureDays] ELSE 365 END, a.[OpeningDate])
                        FROM [dbo].[PigmyAccounts] a
                        INNER JOIN [dbo].[PigmySchemes] s ON a.[PigmySchemeID] = s.[PigmySchemeID]
                        WHERE a.[Status] <> 'Closed'
                          AND DATEDIFF(YEAR, a.[OpeningDate], a.[MaturityDate]) > 10;
                    END
                END
            ");
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to run SansthaBorrowing full lifecycle DDL upgrade on startup");
        }
    }

    // Enable Swagger UI only in Development
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Bhisi API v1");
        });
    }

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

    app.UseMiddleware<Bhisi.Api.Filters.LicenseEnforcementMiddleware>();
    app.UseRateLimiter();

    app.Use(async (context, next) =>
    {
        await next();

        // Prevent 302 Redirects for API Routes (Convert to 401 Unauthorized)
        if (context.Response.StatusCode == 302 && context.Request.Path.StartsWithSegments("/api"))
        {
            context.Response.Clear();
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"error\":\"Unauthorized\",\"message\":\"Authentication is required to access this resource.\"}");
        }
    });

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

    // Ensure unhandled /api/* paths return 404 JSON and DO NOT hit the SPA fallback
    app.MapFallback("/api/{**catchall}", async context =>
    {
        context.Response.StatusCode = 404;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync("{\"error\":\"Not Found\",\"message\":\"The requested API endpoint does not exist.\"}");
    });

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

static void LoadEnvFile()
{
    try
    {
        var candidates = new List<string>
        {
            Path.Combine(Directory.GetCurrentDirectory(), ".env"),
            Path.Combine(Directory.GetCurrentDirectory(), "api", "Bhisi.Api", ".env"),
            Path.Combine(AppContext.BaseDirectory, ".env"),
            Path.Combine(AppContext.BaseDirectory, "api", "Bhisi.Api", ".env")
        };

        var curr = new DirectoryInfo(Directory.GetCurrentDirectory());
        for (int i = 0; i < 7 && curr != null; i++)
        {
            candidates.Add(Path.Combine(curr.FullName, ".env"));
            candidates.Add(Path.Combine(curr.FullName, "api", "Bhisi.Api", ".env"));
            curr = curr.Parent;
        }

        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        for (int i = 0; i < 7 && dir != null; i++)
        {
            candidates.Add(Path.Combine(dir.FullName, ".env"));
            candidates.Add(Path.Combine(dir.FullName, "api", "Bhisi.Api", ".env"));
            dir = dir.Parent;
        }

        string? targetEnv = candidates.Distinct(StringComparer.OrdinalIgnoreCase).FirstOrDefault(File.Exists);
        if (!string.IsNullOrEmpty(targetEnv))
        {
            int loadedCount = 0;
            foreach (var rawLine in File.ReadAllLines(targetEnv))
            {
                var line = rawLine.Trim();
                if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#") || line.StartsWith("//"))
                    continue;

                var idx = line.IndexOf('=');
                if (idx > 0)
                {
                    var key = line.Substring(0, idx).Trim();
                    var val = line.Substring(idx + 1).Trim().Trim('"', '\'');
                    Environment.SetEnvironmentVariable(key, val);
                    loadedCount++;
                }
            }

            if (loadedCount > 0)
            {
                Log.Information(".env loaded successfully from '{EnvPath}' ({Count} active variables).", targetEnv, loadedCount);
            }
            else
            {
                Log.Information(".env detected at '{EnvPath}' (all entries commented / local mode active).", targetEnv);
            }
        }
    }
    catch (Exception ex)
    {
        Log.Warning("Could not load .env file: {Message}", ex.Message);
    }
}

static string ResolveWorkingConnectionString(string configuredConnStr)
{
    try
    {
        var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(configuredConnStr);
        string originalServer = string.IsNullOrWhiteSpace(builder.DataSource) ? "." : builder.DataSource;
        string targetDb = string.IsNullOrWhiteSpace(builder.InitialCatalog) ? "SmartBanking_Gurudev" : builder.InitialCatalog;

        bool isLocalServer = originalServer.Equals(".", StringComparison.OrdinalIgnoreCase)
            || originalServer.Equals("(local)", StringComparison.OrdinalIgnoreCase)
            || originalServer.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || originalServer.StartsWith(@".\", StringComparison.OrdinalIgnoreCase)
            || originalServer.StartsWith(@"localhost\", StringComparison.OrdinalIgnoreCase)
            || originalServer.StartsWith(@"(local)\", StringComparison.OrdinalIgnoreCase);

        if (!isLocalServer)
        {
            // Remote / Cloud / VPS SQL Server
            Log.Information("Connecting directly to remote SQL Server instance '{Server}' for database '{Database}'...", originalServer, targetDb);
            try
            {
                var remoteBuilder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(configuredConnStr)
                {
                    ConnectTimeout = 30
                };
                using var conn = new Microsoft.Data.SqlClient.SqlConnection(remoteBuilder.ConnectionString);
                conn.Open();
                Log.Information("SQL Server connection verified on remote instance '{Server}' for database '{Database}'.", originalServer, targetDb);
                return remoteBuilder.ConnectionString;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to connect to remote SQL Server '{Server}' database '{Database}': {Message}", originalServer, targetDb, ex.Message);
                return configuredConnStr;
            }
        }

        // Local candidate fallback chain
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


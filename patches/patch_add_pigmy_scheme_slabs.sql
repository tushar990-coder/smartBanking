-- =========================================================================================
-- SmartBanking CBS - Pigmy Scheme Dynamic Interest & Penalty Slabs Migration Script
-- Slabs modeled after FdSchemeInterestSlabs: FromMonths, ToMonths, InterestRate, PenaltyRate
-- Zero Data Loss - Safe and Idempotent
-- =========================================================================================

SET NOCOUNT ON;

PRINT '>>> Creating Table [dbo].[PigmySchemeInterestSlabs] if not exists...';

IF OBJECT_ID(N'[dbo].[PigmySchemeInterestSlabs]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PigmySchemeInterestSlabs] (
        [SlabID] INT IDENTITY(1,1) NOT NULL,
        [PigmySchemeID] INT NOT NULL,
        [FromMonths] INT NOT NULL,
        [ToMonths] INT NOT NULL,
        [InterestRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        [PenaltyRate] DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        [SlabDescription] NVARCHAR(100) NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_PigmySchemeInterestSlabs] PRIMARY KEY CLUSTERED ([SlabID] ASC),
        CONSTRAINT [FK_PigmySchemeInterestSlabs_PigmySchemes] FOREIGN KEY ([PigmySchemeID]) 
            REFERENCES [dbo].[PigmySchemes]([PigmySchemeID]) ON DELETE CASCADE
    );
    PRINT '  + Created Table [dbo].[PigmySchemeInterestSlabs]';
END
ELSE
BEGIN
    PRINT '  - Table [dbo].[PigmySchemeInterestSlabs] already exists.';
END;

-- Create Index for high performance query lookups
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PigmySchemeInterestSlabs_Scheme' AND object_id = OBJECT_ID('dbo.PigmySchemeInterestSlabs'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PigmySchemeInterestSlabs_Scheme] 
        ON [dbo].[PigmySchemeInterestSlabs] ([PigmySchemeID], [FromMonths], [ToMonths]);
    PRINT '  + Created Index [IX_PigmySchemeInterestSlabs_Scheme]';
END;

-- Seed default 4 standard slabs for existing schemes that don't have slabs yet
PRINT '>>> Seeding standard 4 slabs for existing PigmySchemes...';

DECLARE @SchemeID INT;
DECLARE @InterestRate DECIMAL(5,2);
DECLARE @PrematureRate DECIMAL(5,2);
DECLARE @PenaltyRate DECIMAL(5,2);
DECLARE @DurationMonths INT;

DECLARE scheme_cursor CURSOR FOR 
    SELECT PigmySchemeID, InterestRate, ISNULL(PrematureInterestRate, 5.50), ISNULL(PenaltyInterestRate, 2.00), ISNULL(DurationMonths, 12)
    FROM [dbo].[PigmySchemes];

OPEN scheme_cursor;
FETCH NEXT FROM scheme_cursor INTO @SchemeID, @InterestRate, @PrematureRate, @PenaltyRate, @DurationMonths;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM [dbo].[PigmySchemeInterestSlabs] WHERE PigmySchemeID = @SchemeID)
    BEGIN
        -- Slab 1: 0 to 3 Months (2% Penalty, 0% Interest)
        INSERT INTO [dbo].[PigmySchemeInterestSlabs] (PigmySchemeID, FromMonths, ToMonths, InterestRate, PenaltyRate, SlabDescription, IsActive, CreatedAt)
        VALUES (@SchemeID, 0, 3, 0.00, @PenaltyRate, N'० ते ३ महिने (२% दंड कपात)', 1, GETUTCDATE());

        -- Slab 2: 3 to 6 Months (1% Penalty, 0% Interest)
        INSERT INTO [dbo].[PigmySchemeInterestSlabs] (PigmySchemeID, FromMonths, ToMonths, InterestRate, PenaltyRate, SlabDescription, IsActive, CreatedAt)
        VALUES (@SchemeID, 3, 6, 0.00, 1.00, N'३ ते ६ महिने (१% दंड कपात)', 1, GETUTCDATE());

        -- Slab 3: 6 to 11 Months (Premature Interest, 0% Penalty)
        INSERT INTO [dbo].[PigmySchemeInterestSlabs] (PigmySchemeID, FromMonths, ToMonths, InterestRate, PenaltyRate, SlabDescription, IsActive, CreatedAt)
        VALUES (@SchemeID, 6, 11, @PrematureRate, 0.00, N'६ ते ११ महिने (अकाली व्याजदर)', 1, GETUTCDATE());

        -- Slab 4: 11 to Duration Months (Full Regular Interest, 0% Penalty)
        INSERT INTO [dbo].[PigmySchemeInterestSlabs] (PigmySchemeID, FromMonths, ToMonths, InterestRate, PenaltyRate, SlabDescription, IsActive, CreatedAt)
        VALUES (@SchemeID, 11, CASE WHEN @DurationMonths > 11 THEN @DurationMonths ELSE 12 END, @InterestRate, 0.00, N'११ ते १२ महिने (पूर्ण नियमित व्याज)', 1, GETUTCDATE());

        PRINT '  + Seeded 4 standard slabs for SchemeID: ' + CAST(@SchemeID AS NVARCHAR(10));
    END

    FETCH NEXT FROM scheme_cursor INTO @SchemeID, @InterestRate, @PrematureRate, @PenaltyRate, @DurationMonths;
END;

CLOSE scheme_cursor;
DEALLOCATE scheme_cursor;

PRINT '>>> Migration completed successfully.';

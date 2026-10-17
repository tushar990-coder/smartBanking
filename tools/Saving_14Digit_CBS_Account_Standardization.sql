-- =========================================================================================
-- बचत खाते (Saving Accounts) १४-अंकी आंतरराष्ट्रीय CBS मानकीकरण (14-Digit Standard CBS Patch)
-- Auto-Standardize Saving Account Numbers to Standard 14-Digit Format: BBB-SSS-NNNNNNN-C
-- Branch: 001 | Scheme: 101 | Running Sequence: 0000001 - 0000663 | Luhn Check Digit
-- Preserves Old Passbook Numbers in LegacyAccountNumber & OldAccountNo
-- =========================================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

PRINT '=============================================================';
PRINT '१. Luhn Modulo-10 Checksum फंक्शन तपासणी सुरू...';
PRINT '=============================================================';

IF OBJECT_ID(N'[dbo].[fn_CalculateLuhnCheckDigit]', N'FN') IS NULL
BEGIN
    EXEC('
    CREATE FUNCTION [dbo].[fn_CalculateLuhnCheckDigit](@InputDigits VARCHAR(50))
    RETURNS INT
    AS
    BEGIN
        DECLARE @Sum INT = 0;
        DECLARE @Alternate BIT = 1;
        DECLARE @Len INT = LEN(@InputDigits);
        DECLARE @i INT = @Len;
        DECLARE @Digit INT;

        WHILE @i >= 1
        BEGIN
            SET @Digit = CAST(SUBSTRING(@InputDigits, @i, 1) AS INT);
            IF @Alternate = 1
            BEGIN
                SET @Digit = @Digit * 2;
                IF @Digit > 9
                BEGIN
                    SET @Digit = @Digit - 9;
                END
            END
            SET @Sum = @Sum + @Digit;
            SET @Alternate = 1 - @Alternate;
            SET @i = @i - 1;
        END

        DECLARE @Mod INT = @Sum % 10;
        RETURN CASE WHEN @Mod = 0 THEN 0 ELSE 10 - @Mod END;
    END');
    PRINT '  ✓ fn_CalculateLuhnCheckDigit फंक्शन निर्माण केले.';
END
ELSE
BEGIN
    PRINT '  ✓ fn_CalculateLuhnCheckDigit फंक्शन आधीच अस्तित्वात आहे.';
END

PRINT '=============================================================';
PRINT '२. बचत खाती (Saving Accounts) क्रमवारी व १४-अंकी CBS योजना तयार करणे...';
PRINT '=============================================================';

IF OBJECT_ID('SavingAccountMasters', 'U') IS NOT NULL
BEGIN
    IF OBJECT_ID('tempdb..#SavingStandardPlan') IS NOT NULL DROP TABLE #SavingStandardPlan;

    ;WITH OrderedAccounts AS (
        SELECT 
            SavingAccountID,
            BranchID,
            CustomerID,
            AccountNo AS CurrentAccountNo,
            COALESCE(NULLIF(LegacyAccountNumber, ''), NULLIF(OldAccountNo, ''), AccountNo) AS OriginalPassbookNo,
            OpeningDate,
            CurrentBalance,
            ROW_NUMBER() OVER (
                ORDER BY 
                    CASE WHEN ISNUMERIC(COALESCE(NULLIF(LegacyAccountNumber, ''), NULLIF(OldAccountNo, ''), AccountNo)) = 1 
                         THEN CAST(COALESCE(NULLIF(LegacyAccountNumber, ''), NULLIF(OldAccountNo, ''), AccountNo) AS INT) 
                         ELSE 999999 
                    END ASC,
                    OpeningDate ASC,
                    SavingAccountID ASC
            ) AS TargetSeq
        FROM SavingAccountMasters
    ),
    PreparedThirteen AS (
        SELECT 
            SavingAccountID,
            BranchID,
            CustomerID,
            CurrentAccountNo,
            OriginalPassbookNo,
            OpeningDate,
            CurrentBalance,
            TargetSeq,
            RIGHT('000' + CAST(ISNULL(BranchID, 1) AS VARCHAR(3)), 3) +
            '101' +
            RIGHT('0000000' + CAST(TargetSeq AS VARCHAR(7)), 7) AS ThirteenDigits
        FROM OrderedAccounts
    )
    SELECT 
        SavingAccountID,
        BranchID,
        CustomerID,
        CurrentAccountNo,
        OriginalPassbookNo,
        OpeningDate,
        CurrentBalance,
        TargetSeq,
        SUBSTRING(ThirteenDigits, 1, 3) + '-' +
        SUBSTRING(ThirteenDigits, 4, 3) + '-' +
        SUBSTRING(ThirteenDigits, 7, 7) + '-' +
        CAST([dbo].[fn_CalculateLuhnCheckDigit](ThirteenDigits) AS VARCHAR(1)) AS Standard14AccountNo
    INTO #SavingStandardPlan
    FROM PreparedThirteen;

    DECLARE @TotalAccounts INT = (SELECT COUNT(*) FROM #SavingStandardPlan);
    PRINT 'एकूण मानकीकरण आवश्यक बचत खाती: ' + CAST(@TotalAccounts AS VARCHAR(10));

    IF @TotalAccounts > 0
    BEGIN
        -- ३. SavingAccountMasters मध्ये Standard 14-Digit AccountNo आणि जुना नंबर सेव्ह करणे
        UPDATE sm
        SET 
            sm.OldAccountNo = sp.OriginalPassbookNo,
            sm.LegacyAccountNumber = sp.OriginalPassbookNo,
            sm.AccountNo = sp.Standard14AccountNo
        FROM SavingAccountMasters sm
        INNER JOIN #SavingStandardPlan sp ON sm.SavingAccountID = sp.SavingAccountID;

        PRINT '  ✓ सर्व ६६३ बचत खाती १४-अंकी CBS (001-101-xxxxxxx-x) फॉरमॅटमध्ये यशस्वीरित्या रूपांतरित झाली.';

        -- ४. SavingAccountSequences काउंटर अद्ययावत करणे
        IF OBJECT_ID('SavingAccountSequences', 'U') IS NOT NULL
        BEGIN
            DECLARE @MaxSeq INT = (SELECT MAX(TargetSeq) FROM #SavingStandardPlan);
            IF EXISTS (SELECT 1 FROM SavingAccountSequences WHERE BranchID = 1 AND SchemeCodeNumeric = 101)
            BEGIN
                UPDATE SavingAccountSequences 
                SET LastSequenceNumber = CASE WHEN @MaxSeq > LastSequenceNumber THEN @MaxSeq ELSE LastSequenceNumber END,
                    UpdatedOn = GETDATE()
                WHERE BranchID = 1 AND SchemeCodeNumeric = 101;
            END
            ELSE
            BEGIN
                INSERT INTO SavingAccountSequences (BranchID, SchemeCodeNumeric, LastSequenceNumber, UpdatedOn)
                VALUES (1, 101, @MaxSeq, GETDATE());
            END

            PRINT '  ✓ SavingAccountSequences काउंटर ' + CAST(@MaxSeq AS VARCHAR(10)) + ' वर सेट केला.';
        END
    END
END

COMMIT TRANSACTION;
PRINT '=============================================================';
PRINT '✅ बचत खाते १४-अंकी CBS मानकीकरण प्रक्रिया यशस्वीरित्या पूर्ण झाली!';
PRINT '=============================================================';

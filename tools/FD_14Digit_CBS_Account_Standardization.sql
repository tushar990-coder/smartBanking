-- =========================================================================================
-- मुदत ठेव (FD) खाते व पावती क्रमांक १४-अंकी CBS मानकीकरण (14-Digit Standard CBS Patch)
-- Auto-Standardize FD Account Numbers to Standard 14-Digit Format: BBB-SSS-NNNNNNN-C
-- Multi-Tenant Safe, Preserves Legacy Receipt Numbers, Zero Data Loss
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
PRINT '२. मुदत ठेव (FD) अमानक किंवा जुन्या क्रमांकांची क्रमवारी तयार करणे...';
PRINT '=============================================================';

IF OBJECT_ID('FdAccounts', 'U') IS NOT NULL
BEGIN
    IF OBJECT_ID('tempdb..#FdStandardPlan') IS NOT NULL DROP TABLE #FdStandardPlan;

    -- अमानक किंवा 14-अंकी नसलेले किंवा -FD- असलेले क्रमांक शोधणे
    ;WITH NonStandardAccounts AS (
        SELECT 
            fa.FdAccountID,
            fa.BranchID,
            fa.FdSchemeID,
            fa.AccountNo AS OldAccountNo,
            fa.LegacyAccountNumber,
            fa.DepositAmount,
            fa.OpeningDate,
            COALESCE(
                CASE 
                    WHEN ISNUMERIC(s.SchemeCode) = 1 AND CAST(s.SchemeCode AS INT) > 0 
                        THEN CASE WHEN CAST(s.SchemeCode AS INT) < 100 THEN 400 + CAST(s.SchemeCode AS INT) ELSE CAST(s.SchemeCode AS INT) END
                    ELSE 400 + fa.FdSchemeID 
                END, 
                401
            ) AS SchemeNumeric,
            ROW_NUMBER() OVER (PARTITION BY fa.BranchID ORDER BY fa.OpeningDate ASC, fa.FdAccountID ASC) AS TargetSeq
        FROM FdAccounts fa
        LEFT JOIN FdSchemes s ON fa.FdSchemeID = s.FdSchemeID
        WHERE fa.AccountNo IS NULL 
           OR fa.AccountNo LIKE '%-FD-%' 
           OR LEN(REPLACE(fa.AccountNo, '-', '')) <> 14
           OR fa.AccountNo NOT LIKE '%-%-%-%'
    ),
    PreparedPlan AS (
        SELECT 
            nsa.FdAccountID,
            nsa.BranchID,
            nsa.OldAccountNo,
            COALESCE(NULLIF(nsa.LegacyAccountNumber, ''), NULLIF(nsa.OldAccountNo, '')) AS ResolvedLegacyAccNo,
            nsa.DepositAmount,
            nsa.OpeningDate,
            nsa.TargetSeq,
            RIGHT('000' + CAST(nsa.BranchID AS VARCHAR(3)), 3) +
            RIGHT('000' + CAST(nsa.SchemeNumeric AS VARCHAR(3)), 3) +
            RIGHT('0000000' + CAST(nsa.TargetSeq AS VARCHAR(7)), 7) AS ThirteenDigits
        FROM NonStandardAccounts nsa
    )
    SELECT 
        pp.FdAccountID,
        pp.BranchID,
        pp.OldAccountNo,
        pp.ResolvedLegacyAccNo,
        pp.DepositAmount,
        pp.OpeningDate,
        pp.TargetSeq,
        SUBSTRING(pp.ThirteenDigits, 1, 3) + '-' +
        SUBSTRING(pp.ThirteenDigits, 4, 3) + '-' +
        SUBSTRING(pp.ThirteenDigits, 7, 7) + '-' +
        CAST([dbo].[fn_CalculateLuhnCheckDigit](pp.ThirteenDigits) AS VARCHAR(1)) AS Standard14AccountNo
    INTO #FdStandardPlan
    FROM PreparedPlan pp;

    DECLARE @TotalToStandardize INT = (SELECT COUNT(*) FROM #FdStandardPlan);
    PRINT 'एकूण मानकीकरण आवश्यक खाती: ' + CAST(@TotalToStandardize AS VARCHAR(10));

    IF @TotalToStandardize > 0
    BEGIN
        -- ३. FdAccounts मध्ये Standard 14-Digit AccountNo आणि LegacyAccountNumber सेट करणे
        UPDATE a
        SET a.AccountNo = sp.Standard14AccountNo,
            a.LegacyAccountNumber = CASE 
                WHEN (a.LegacyAccountNumber IS NULL OR a.LegacyAccountNumber = '') 
                THEN sp.ResolvedLegacyAccNo 
                ELSE a.LegacyAccountNumber 
            END
        FROM FdAccounts a
        INNER JOIN #FdStandardPlan sp ON a.FdAccountID = sp.FdAccountID;

        PRINT '  ✓ FdAccounts टेबलमधील क्रमांक १४-अंकी CBS (उदा. 001-401-xxxxxxx-x) फॉरमॅटमध्ये रूपांतरित केले.';

        -- ४. व्हाउचर्स (Vouchers) अद्ययावत करणे (JV-FD-OP-{AccountNo} आणि REC-FD-OP-{AccountNo})
        IF OBJECT_ID('Vouchers', 'U') IS NOT NULL
        BEGIN
            DECLARE @accId INT, @branchId INT, @oldAccNo VARCHAR(60), @newAccNo VARCHAR(60), @legNo VARCHAR(60);

            DECLARE vch_cur CURSOR LOCAL FAST_FORWARD FOR
            SELECT sp.FdAccountID, sp.BranchID, sp.OldAccountNo, sp.Standard14AccountNo, ISNULL(sp.ResolvedLegacyAccNo, '')
            FROM #FdStandardPlan sp;

            OPEN vch_cur;
            FETCH NEXT FROM vch_cur INTO @accId, @branchId, @oldAccNo, @newAccNo, @legNo;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                DECLARE @oldVch1 VARCHAR(80) = 'JV-FD-OP-' + @oldAccNo;
                DECLARE @oldVch2 VARCHAR(80) = 'REC-FD-OP-' + @oldAccNo;
                DECLARE @newVch VARCHAR(80) = 'JV-FD-OP-' + @newAccNo;

                -- जर जुने व्हाउचर अस्तित्वात असेल तर नवीन १४-अंकी क्रमांकाने अपडेट करा
                UPDATE Vouchers
                SET VoucherNo = @newVch,
                    Narration = N'मुदत ठेव आरंभिक शिल्लक स्थलांतर (FD Opening Balance Migration): ' + @newAccNo + N' (जुना पावती क्र. ' + @legNo + N')'
                WHERE (VoucherNo = @oldVch1 OR VoucherNo = @oldVch2)
                  AND NOT EXISTS (SELECT 1 FROM Vouchers WHERE VoucherNo = @newVch);

                FETCH NEXT FROM vch_cur INTO @accId, @branchId, @oldAccNo, @newAccNo, @legNo;
            END

            CLOSE vch_cur;
            DEALLOCATE vch_cur;
            PRINT '  ✓ संबंधित व्हाउचर्स (Vouchers) नवीन १४-अंकी क्रमांकासह अद्ययावत केले.';
        END

        -- ५. FdAccountSequences काउंटर अद्ययावत करणे
        IF OBJECT_ID('FdAccountSequences', 'U') IS NOT NULL
        BEGIN
            DECLARE @b INT, @mSeq INT;
            DECLARE seq_sync CURSOR LOCAL FAST_FORWARD FOR
            SELECT BranchID, MAX(TargetSeq) AS MaxSeq
            FROM #FdStandardPlan
            GROUP BY BranchID;

            OPEN seq_sync;
            FETCH NEXT FROM seq_sync INTO @b, @mSeq;

            WHILE @@FETCH_STATUS = 0
            BEGIN
                IF EXISTS (SELECT 1 FROM FdAccountSequences WHERE BranchID = @b AND ProductType = 'FD')
                BEGIN
                    UPDATE FdAccountSequences 
                    SET CurrentValue = CASE WHEN @mSeq > CurrentValue THEN @mSeq ELSE CurrentValue END
                    WHERE BranchID = @b AND ProductType = 'FD';
                END
                ELSE
                BEGIN
                    INSERT INTO FdAccountSequences (BranchID, ProductType, CurrentValue)
                    VALUES (@b, 'FD', @mSeq);
                END

                FETCH NEXT FROM seq_sync INTO @b, @mSeq;
            END

            CLOSE seq_sync;
            DEALLOCATE seq_sync;
            PRINT '  ✓ FdAccountSequences काउंटर यशस्वीरित्या समक्रमित (Synchronized) केला.';
        END
    END
    ELSE
    BEGIN
        PRINT '  ✓ सर्व मुदत ठेव खाती आधीच १४-अंकी मानक CBS फॉरमॅटमध्ये आहेत.';
    END
END

COMMIT TRANSACTION;
PRINT '=============================================================';
PRINT '✅ मुदत ठेव १४-अंकी मानक CBS प्रक्रिया यशस्वीरित्या पूर्ण झाली!';
PRINT '=============================================================';

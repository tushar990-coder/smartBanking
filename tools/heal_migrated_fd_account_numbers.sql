-- =========================================================================================
-- मुदत ठेव आरंभिक शिल्लक स्थलांतर: पावती क्रमांक क्रमवारी व व्हाउचर दुरुस्ती स्क्रिप्ट
-- Auto-Heal Duplicate Migrated Fixed Deposit Accounts and Accounting Vouchers
-- Purpose: Resolves duplicate '001-001-FD-000001' account numbers across migrated FD accounts
-- Compatible with all Sanstha databases (Pure Multi-Tenant Safe, Zero Data Loss)
-- =========================================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

PRINT '=============================================================';
PRINT '१. मुदत ठेव स्थलांतरित खाती व अनुक्रमांक तपासणी सुरू...';
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
END

IF OBJECT_ID('FdAccounts', 'U') IS NOT NULL AND OBJECT_ID('FdAccountSequences', 'U') IS NOT NULL
BEGIN
    -- १. प्रत्येक शाखेतील स्थलांतरित खात्यांना OpeningDate आणि FdAccountID नुसार योग्य क्रम देणे
    IF OBJECT_ID('tempdb..#HealPlan') IS NOT NULL DROP TABLE #HealPlan;

    ;WITH NumberedLegacy AS (
        SELECT 
            fa.FdAccountID,
            fa.BranchID,
            fa.FdSchemeID,
            fa.AccountNo AS OldAssignedAccountNo,
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
        WHERE fa.IsLegacyAccount = 1
    ),
    PreparedPlan AS (
        SELECT 
            nl.FdAccountID,
            nl.BranchID,
            nl.LegacyAccountNumber AS OldReceiptNo,
            nl.OldAssignedAccountNo AS BeforeFix,
            nl.TargetSeq,
            RIGHT('000' + CAST(nl.BranchID AS VARCHAR(3)), 3) +
            RIGHT('000' + CAST(nl.SchemeNumeric AS VARCHAR(3)), 3) +
            RIGHT('0000000' + CAST(nl.TargetSeq AS VARCHAR(7)), 7) AS ThirteenDigits
        FROM NumberedLegacy nl
    )
    SELECT 
        pp.FdAccountID,
        pp.BranchID,
        pp.OldReceiptNo,
        pp.BeforeFix,
        SUBSTRING(pp.ThirteenDigits, 1, 3) + '-' +
        SUBSTRING(pp.ThirteenDigits, 4, 3) + '-' +
        SUBSTRING(pp.ThirteenDigits, 7, 7) + '-' +
        CAST([dbo].[fn_CalculateLuhnCheckDigit](pp.ThirteenDigits) AS VARCHAR(1)) AS AfterFixSeq,
        pp.TargetSeq
    INTO #HealPlan
    FROM PreparedPlan pp;

    DECLARE @TotalMigratedCount INT = (SELECT COUNT(*) FROM #HealPlan);
    PRINT 'एकूण स्थलांतरित खाती: ' + CAST(@TotalMigratedCount AS VARCHAR(10));

    IF @TotalMigratedCount > 0
    BEGIN
        -- २. FdAccounts मधील AccountNo अद्ययावत करणे (केवळ बदल आवश्यक असल्यास)
        UPDATE a
        SET a.AccountNo = hp.AfterFixSeq
        FROM FdAccounts a
        INNER JOIN #HealPlan hp ON a.FdAccountID = hp.FdAccountID
        WHERE a.AccountNo <> hp.AfterFixSeq;

        PRINT '२. FdAccounts टेबलमधील पावती क्रमांक सुरक्षितपणे अद्ययावत केले.';

        -- ३. व्हाउचर (JV-FD-OP-{AccountNo}) अद्ययावत करणे किंवा निर्माण करणे
        DECLARE @accId INT, @branchId INT, @oldAccNo VARCHAR(50), @newAccNo VARCHAR(50), 
                @depAmt DECIMAL(18,2), @opDate DATETIME, @legNo VARCHAR(50);

        DECLARE heal_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT hp.FdAccountID, hp.BranchID, hp.BeforeFix, hp.AfterFixSeq, fa.DepositAmount, fa.OpeningDate, ISNULL(fa.LegacyAccountNumber, '')
        FROM #HealPlan hp
        INNER JOIN FdAccounts fa ON hp.FdAccountID = fa.FdAccountID;

        OPEN heal_cur;
        FETCH NEXT FROM heal_cur INTO @accId, @branchId, @oldAccNo, @newAccNo, @depAmt, @opDate, @legNo;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            DECLARE @newVchNo VARCHAR(60) = 'JV-FD-OP-' + @newAccNo;
            DECLARE @oldVchNo VARCHAR(60) = 'JV-FD-OP-' + @oldAccNo;
            DECLARE @vchId INT = 0;

            -- प्रथम जुने व्हाउचर उपलब्ध असल्यास रीनेम करा
            IF @oldAccNo <> @newAccNo AND EXISTS (SELECT 1 FROM Vouchers WHERE VoucherNo = @oldVchNo) AND NOT EXISTS (SELECT 1 FROM Vouchers WHERE VoucherNo = @newVchNo)
            BEGIN
                UPDATE Vouchers 
                SET VoucherNo = @newVchNo,
                    Narration = N'मुदत ठेव आरंभिक शिल्लक स्थलांतर (FD Opening Balance Migration): ' + @newAccNo + N' (जुना पावती क्र. ' + @legNo + N')'
                WHERE VoucherNo = @oldVchNo;
            END

            SELECT @vchId = VoucherID FROM Vouchers WHERE VoucherNo = @newVchNo;

            IF @vchId IS NULL OR @vchId = 0
            BEGIN
                INSERT INTO Vouchers (
                    BranchID, VoucherNo, VoucherDate, VoucherType, TotalAmount, 
                    Narration, Status, ApprovedBy, ApprovedOn, CreatedBy, CreatedOn
                )
                VALUES (
                    @branchId, @newVchNo, @opDate, 'Journal', @depAmt,
                    N'मुदत ठेव आरंभिक शिल्लक स्थलांतर (FD Opening Balance Migration): ' + @newAccNo + N' (जुना पावती क्र. ' + @legNo + N')',
                    'Approved', 1, GETDATE(), 1, GETDATE()
                );
                SET @vchId = SCOPE_IDENTITY();
            END

            -- FdTransactions ला व्हाउचरशी लिंक करा
            IF OBJECT_ID('FdTransactions', 'U') IS NOT NULL
            BEGIN
                UPDATE FdTransactions 
                SET VoucherID = @vchId 
                WHERE FdAccountID = @accId;
            END

            FETCH NEXT FROM heal_cur INTO @accId, @branchId, @oldAccNo, @newAccNo, @depAmt, @opDate, @legNo;
        END

        CLOSE heal_cur;
        DEALLOCATE heal_cur;

        -- ४. FdAccountSequences मधील CurrentValue दुरुस्त करणे
        DECLARE @seqBranchId INT, @maxSeq INT;
        DECLARE seq_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT BranchID, MAX(TargetSeq) AS MaxTargetSeq
        FROM #HealPlan
        GROUP BY BranchID;

        OPEN seq_cur;
        FETCH NEXT FROM seq_cur INTO @seqBranchId, @maxSeq;

        WHILE @@FETCH_STATUS = 0
        BEGIN
            IF EXISTS (SELECT 1 FROM FdAccountSequences WHERE BranchID = @seqBranchId AND ProductType = 'FD')
            BEGIN
                UPDATE FdAccountSequences 
                SET CurrentValue = CASE WHEN @maxSeq > CurrentValue THEN @maxSeq ELSE CurrentValue END
                WHERE BranchID = @seqBranchId AND ProductType = 'FD';
            END
            ELSE
            BEGIN
                INSERT INTO FdAccountSequences (BranchID, ProductType, CurrentValue)
                VALUES (@seqBranchId, 'FD', @maxSeq);
            END

            FETCH NEXT FROM seq_cur INTO @seqBranchId, @maxSeq;
        END

        CLOSE seq_cur;
        DEALLOCATE seq_cur;

        PRINT '३. FdAccountSequences चे CurrentValue सुरक्षितपणे अद्ययावत केले.';
    END
    ELSE
    BEGIN
        PRINT 'ℹ️ कोणतीही स्थलांतरित खाती (IsLegacyAccount = 1) आढळली नाहीत.';
    END

    IF OBJECT_ID('tempdb..#HealPlan') IS NOT NULL DROP TABLE #HealPlan;
END
ELSE
BEGIN
    PRINT 'ℹ️ FdAccounts किंवा FdAccountSequences टेबल अस्तित्वात नाही. प्रक्रिया वगळली.';
END

PRINT '=============================================================';
PRINT '✅ मुदत ठेव पावती क्रमांक व व्हाउचर दुरुस्ती यशस्वी!';
PRINT '=============================================================';

COMMIT TRANSACTION;

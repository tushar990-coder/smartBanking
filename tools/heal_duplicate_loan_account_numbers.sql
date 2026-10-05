-- =========================================================================================
-- कर्ज खाते क्रमांक डुप्लिकेशन दुरुस्ती व युनिक इंडेक्स निर्मिती स्क्रिप्ट
-- Auto-Heal Duplicate Loan Account Numbers and Enforce IX_LoanAccounts_Branch_AccountNo
-- Compatible with all Sanstha databases (Multi-Tenant Safe, Zero Financial Data Loss)
-- =========================================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

PRINT '=============================================================';
PRINT '१. कर्ज खाती व डुप्लिकेट खाते क्रमांक तपासणी सुरू...';
PRINT '=============================================================';

IF OBJECT_ID('LoanAccounts', 'U') IS NOT NULL
BEGIN
    -- १. डुप्लिकेट खाती शोधून तात्पुरत्या टेबलमध्ये घेणे
    IF OBJECT_ID('tempdb..#DuplicateLoans') IS NOT NULL DROP TABLE #DuplicateLoans;

    ;WITH DuplicateSummary AS (
        SELECT 
            BranchID, 
            LoanAccountNo, 
            COUNT(*) AS CollisionCount
        FROM LoanAccounts
        WHERE LoanAccountNo IS NOT NULL AND LoanAccountNo <> ''
        GROUP BY BranchID, LoanAccountNo
        HAVING COUNT(*) > 1
    ),
    RankedDuplicates AS (
        SELECT 
            la.LoanAccountID,
            la.BranchID,
            la.LoanAccountNo,
            la.OpeningDate,
            la.PrincipalBalance,
            ROW_NUMBER() OVER (
                PARTITION BY la.BranchID, la.LoanAccountNo 
                ORDER BY la.OpeningDate ASC, la.LoanAccountID ASC
            ) AS RowSeq
        FROM LoanAccounts la
        INNER JOIN DuplicateSummary ds 
            ON la.BranchID = ds.BranchID AND la.LoanAccountNo = ds.LoanAccountNo
    )
    SELECT *
    INTO #DuplicateLoans
    FROM RankedDuplicates
    WHERE RowSeq > 1; -- मूळ (पहिले) खाते तसेच ठेवून केवळ नंतरच्या डुप्लिकेट्सना नवा अनुक्रमांक देणे

    DECLARE @TotalDuplicates INT = (SELECT COUNT(*) FROM #DuplicateLoans);
    PRINT 'एकूण डुप्लिकेट कर्ज खाती आढळली: ' + CAST(@TotalDuplicates AS VARCHAR(10));

    IF @TotalDuplicates > 0
    BEGIN
        PRINT '२. डुप्लिकेट खात्यांना सुधारात्मक अनुक्रमांक (-D2, -D3...) देत आहे...';

        UPDATE la
        SET la.LoanAccountNo = la.LoanAccountNo + '-D' + CAST(dl.RowSeq AS VARCHAR(5))
        FROM LoanAccounts la
        INNER JOIN #DuplicateLoans dl ON la.LoanAccountID = dl.LoanAccountID;

        PRINT '२. डुप्लिकेट कर्ज खाते क्रमांक यशस्वीरित्या दुरुस्त केले.';
    END
    ELSE
    BEGIN
        PRINT 'कोणतेही डुप्लिकेट खाते क्रमांक आढळले नाहीत.';
    END

    -- २. आता सुरक्षितपणे युनिक इंडेक्स तयार करणे
    SET QUOTED_IDENTIFIER ON;
    SET ANSI_NULLS ON;

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoanAccounts_Branch_AccountNo' AND object_id = OBJECT_ID('LoanAccounts'))
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX [IX_LoanAccounts_Branch_AccountNo]
        ON [dbo].[LoanAccounts] ([BranchID], [LoanAccountNo])
        WHERE [LoanAccountNo] IS NOT NULL AND [LoanAccountNo] <> '';

        PRINT '३. IX_LoanAccounts_Branch_AccountNo युनिक इंडेक्स यशस्वीरीत्या तयार केला.';
    END
    ELSE
    BEGIN
        PRINT '३. IX_LoanAccounts_Branch_AccountNo युनिक इंडेक्स आधीपासूनच अस्तित्वात आहे.';
    END
END
ELSE
BEGIN
    PRINT 'LoanAccounts टेबल उपलब्ध नाही.';
END

COMMIT TRANSACTION;
PRINT '=============================================================';
PRINT 'कर्ज खाते क्रमांक युनिकनेस प्रक्रिया यशस्वीरित्या संपन्न!';
PRINT '=============================================================';

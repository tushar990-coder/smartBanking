-- =========================================================================================
-- SmartBanking ERP - 1:1 MemberID & MemberCode Exact Alignment & Lock Script (Zero Data Loss)
-- Sets MemberCode = 'MEM' + MemberID:D4 (e.g., 1 -> MEM0001, 2 -> MEM0002, 573 -> MEM0573)
-- Also updates ShareAccounts.AccountNo = 'SA-' + MemberCode
-- =========================================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRANSACTION;
BEGIN TRY
    PRINT '>> Step 1: Temporarily assigning TMP codes to avoid unique index conflict during alignment...';
    UPDATE Members 
    SET MemberCode = 'TMP_' + CAST(MemberID AS VARCHAR(10)) + '_' + SUBSTRING(CONVERT(VARCHAR(40), NEWID()), 1, 8)
    WHERE MemberID > 0;

    PRINT '>> Step 2: Setting 1:1 MemberCode strictly matching MemberID (1 -> MEM0001, 2 -> MEM0002...)...';
    UPDATE Members
    SET MemberCode = 'MEM' + RIGHT('0000' + CAST(MemberID AS VARCHAR(10)), 4)
    WHERE MemberID > 0;

    PRINT '>> Step 3: Synchronizing ShareAccounts AccountNo to match new MemberCode...';
    UPDATE sa
    SET sa.AccountNo = 'SA-' + m.MemberCode
    FROM ShareAccounts sa
    INNER JOIN Members m ON sa.MemberId = m.MemberID
    WHERE m.MemberCode IS NOT NULL;

    COMMIT TRANSACTION;
    PRINT '>> SUCCESS: 1:1 MemberCode alignment completed with 0 errors!';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT '>> ERROR aligning member codes: ' + @ErrMsg;
    RAISERROR(@ErrMsg, 16, 1);
END CATCH

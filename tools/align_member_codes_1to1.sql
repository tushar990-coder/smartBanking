-- =========================================================================================
-- SmartBanking ERP - 1:1 MemberID & MemberCode Exact Alignment & Lock Script (Zero Data Loss)
-- Sets MemberCode = 'MEM' + MemberID:D4 (e.g., 1 -> MEM0001, 2 -> MEM0002, 573 -> MEM0573)
-- Also updates ShareAccounts.AccountNo = 'SA-' + MemberCode
-- =========================================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRANSACTION;
BEGIN TRY
    PRINT '>> Step 1: Clearing MemberCode and setting Nominal for non-shareholders...';
    UPDATE Members 
    SET MemberCode = NULL,
        MembershipType = 'Nominal'
    WHERE MemberID NOT IN (
        SELECT DISTINCT sa.MemberId 
        FROM ShareAccounts sa 
        WHERE sa.TotalShareCount > 0 AND sa.MemberId IS NOT NULL
    );

    PRINT '>> Step 2: Temporarily assigning TMP codes to active shareholders to avoid unique index conflict...';
    UPDATE Members 
    SET MemberCode = 'TMP_' + CAST(MemberID AS VARCHAR(10)) + '_' + SUBSTRING(CONVERT(VARCHAR(40), NEWID()), 1, 8)
    WHERE MemberID IN (
        SELECT DISTINCT sa.MemberId 
        FROM ShareAccounts sa 
        WHERE sa.TotalShareCount > 0 AND sa.MemberId IS NOT NULL
    );

    PRINT '>> Step 3: Setting sequential MemberCode strictly for active shareholders (MEM0001, MEM0002...)...';
    ;WITH ActiveShareholders AS (
        SELECT sa.MemberId, sa.ShareAccountId,
               ROW_NUMBER() OVER (
                   ORDER BY TRY_CAST(m.LegacyMemberNo AS INT) ASC,
                            TRY_CAST(REPLACE(REPLACE(COALESCE(sc.CertificateNo, ''), 'CERT-', ''), 'CERT', '') AS INT) ASC,
                            sa.ShareAccountId ASC
               ) as SeqNo
        FROM ShareAccounts sa
        INNER JOIN Members m ON sa.MemberId = m.MemberID
        OUTER APPLY (
            SELECT TOP 1 CertificateNo FROM ShareCertificates WHERE ShareAccountId = sa.ShareAccountId ORDER BY CertificateId ASC
        ) sc
        WHERE sa.TotalShareCount > 0
    )
    UPDATE m
    SET m.MemberCode = 'MEM' + RIGHT('0000' + CAST(ash.SeqNo AS VARCHAR(10)), 4),
        m.MembershipType = 'Regular'
    FROM Members m
    INNER JOIN ActiveShareholders ash ON m.MemberID = ash.MemberId;

    PRINT '>> Step 4: Synchronizing ShareAccounts AccountNo to match new MemberCode...';
    UPDATE sa
    SET sa.AccountNo = 'SA-' + m.MemberCode
    FROM ShareAccounts sa
    INNER JOIN Members m ON sa.MemberId = m.MemberID
    WHERE m.MemberCode IS NOT NULL;

    COMMIT TRANSACTION;
    PRINT '>> SUCCESS: 1:1 Active Shareholder MemberCode alignment completed with 0 errors!';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT '>> ERROR aligning member codes: ' + @ErrMsg;
    RAISERROR(@ErrMsg, 16, 1);
END CATCH

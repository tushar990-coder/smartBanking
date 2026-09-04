-- ==============================================================================
-- Core Banking System: Master Resequencing Script (MEM0001 to MEM0216...)
-- Script: Resequence_All_Members_1_To_N.sql
-- Description: Renumbers all active Shareholding Members with clean, sequential
--              Member Codes (MEM0001 to MEM0216) without any gaps, and isolates
--              non-shareholding members to MEM0217+.
-- ==============================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

BEGIN TRANSACTION;

BEGIN TRY
    PRINT '>>> Step 1: Temporarily assigning unique TMP codes to all members to avoid IX_Members_MemberCode collision...';
    UPDATE Members 
    SET MemberCode = 'TMP_' + CAST(MemberID AS VARCHAR(10)) + '_' + SUBSTRING(CONVERT(VARCHAR(40), NEWID()), 1, 8);

    PRINT '>>> Step 2: Sequencing all active shareholding members strictly 1 to N (MEM0001..MEM0216)...';
    ;WITH RankedShareholders AS (
        SELECT 
            sa.MemberId,
            ROW_NUMBER() OVER (
                ORDER BY 
                    TRY_CAST(REPLACE(REPLACE(COALESCE(sc.CertificateNo, ''), 'CERT-', ''), 'CERT', '') AS INT) ASC,
                    TRY_CAST(m.LegacyMemberNo AS INT) ASC,
                    sa.ShareAccountId ASC
            ) as SeqNo
        FROM ShareAccounts sa
        INNER JOIN Members m ON sa.MemberId = m.MemberID
        LEFT JOIN ShareCertificates sc ON sc.ShareAccountId = sa.ShareAccountId
        WHERE sa.TotalShareCount > 0
    )
    UPDATE m
    SET 
        m.MemberCode = 'MEM' + RIGHT('0000' + CAST(r.SeqNo AS VARCHAR(10)), 4),
        m.MembershipType = 'Regular'
    FROM Members m
    INNER JOIN RankedShareholders r ON m.MemberID = r.MemberId;

    PRINT '>>> Step 3: Updating ShareAccounts AccountNo to match new MemberCode (SA-MEM0001...)...';
    UPDATE sa
    SET sa.AccountNo = 'SA-' + m.MemberCode
    FROM ShareAccounts sa
    INNER JOIN Members m ON sa.MemberId = m.MemberID
    WHERE sa.TotalShareCount > 0;

    PRINT '>>> Step 4: Sequencing remaining non-shareholding members starting from MEM0217+...';
    DECLARE @TotalShareholders INT = (SELECT COUNT(DISTINCT MemberId) FROM ShareAccounts WHERE TotalShareCount > 0);

    ;WITH RankedNonShareholders AS (
        SELECT 
            m.MemberID,
            @TotalShareholders + ROW_NUMBER() OVER (ORDER BY m.MemberID ASC) as SeqNo
        FROM Members m
        WHERE m.MemberID NOT IN (SELECT MemberId FROM ShareAccounts WHERE TotalShareCount > 0)
    )
    UPDATE m
    SET m.MemberCode = 'MEM' + RIGHT('0000' + CAST(r.SeqNo AS VARCHAR(10)), 4)
    FROM Members m
    INNER JOIN RankedNonShareholders r ON m.MemberID = r.MemberID;

    COMMIT TRANSACTION;
    PRINT '>>> SUCCESS: All Shareholding Member Codes resequenced successfully (1 to ' + CAST(@TotalShareholders AS VARCHAR(10)) + ') with zero gaps!';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT '>>> ERROR: ' + @ErrMsg;
    THROW;
END CATCH;
GO

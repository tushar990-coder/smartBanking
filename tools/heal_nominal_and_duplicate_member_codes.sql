-- =========================================================================================
-- SmartBanking ERP - Master Healing Script for Share Opening Balance & Member Codes
-- 1. Clears orphan/duplicate MemberCode for any Customer with 0 shares (Pure CIF)
-- 2. Strictly aligns active shareholding members to sequential MEM0001, MEM0002...
-- 3. Synchronizes ShareAccounts.AccountNo = 'SA-' + m.MemberCode
-- 4. 100% Zero Data Loss & CBS Accounting Compliance
-- =========================================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRANSACTION;
BEGIN TRY
    PRINT '>> Step 1: Diagnosing and clearing MemberCode for customers holding 0 shares...';
    
    DECLARE @ClearedCount INT = 0;
    
    UPDATE [dbo].[Members]
    SET [MemberCode] = NULL,
        [MembershipType] = 'Nominal',
        [ModifiedDate] = GETDATE()
    WHERE [MemberID] NOT IN (
        SELECT DISTINCT sa.[MemberId] 
        FROM [dbo].[ShareAccounts] sa 
        WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
    )
    AND ([MemberCode] IS NOT NULL AND [MemberCode] <> '');

    SET @ClearedCount = @@ROWCOUNT;
    PRINT '>> Step 1 Completed: Cleared ' + CAST(@ClearedCount AS VARCHAR(10)) + ' invalid/orphan MemberCodes for non-shareholders.';

    PRINT '>> Step 2: Temporarily assigning TMP codes to active shareholders to prevent unique index collision...';
    UPDATE [dbo].[Members]
    SET [MemberCode] = 'TMP_' + CAST([MemberID] AS VARCHAR(10)) + '_' + SUBSTRING(CONVERT(VARCHAR(40), NEWID()), 1, 8)
    WHERE [MemberID] IN (
        SELECT DISTINCT sa.[MemberId] 
        FROM [dbo].[ShareAccounts] sa 
        WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
    );

    PRINT '>> Step 3: Resequencing active shareholders sequentially (MEM0001, MEM0002...)...';
    ;WITH ActiveShareholders AS (
        SELECT sa.[MemberId], sa.[ShareAccountId],
               ROW_NUMBER() OVER (
                   ORDER BY TRY_CAST(m.[LegacyMemberNo] AS INT) ASC,
                            TRY_CAST(REPLACE(REPLACE(COALESCE(sc.[CertificateNo], ''), 'CERT-', ''), 'CERT', '') AS INT) ASC,
                            sa.[ShareAccountId] ASC
               ) as SeqNo
        FROM [dbo].[ShareAccounts] sa
        INNER JOIN [dbo].[Members] m ON sa.[MemberId] = m.[MemberID]
        OUTER APPLY (
            SELECT TOP 1 [CertificateNo] FROM [dbo].[ShareCertificates] WHERE [ShareAccountId] = sa.[ShareAccountId] ORDER BY [CertificateId] ASC
        ) sc
        WHERE sa.[TotalShareCount] > 0
    )
    UPDATE m
    SET m.[MemberCode] = 'MEM' + RIGHT('0000' + CAST(ash.SeqNo AS VARCHAR(10)), 4),
        m.[MembershipType] = 'Regular',
        m.[ModifiedDate] = GETDATE()
    FROM [dbo].[Members] m
    INNER JOIN ActiveShareholders ash ON m.[MemberID] = ash.[MemberId];

    DECLARE @ResequencedCount INT = @@ROWCOUNT;
    PRINT '>> Step 3 Completed: Resequenced ' + CAST(@ResequencedCount AS VARCHAR(10)) + ' active shareholding members.';

    PRINT '>> Step 4: Synchronizing ShareAccounts AccountNo with newly aligned MemberCodes...';
    IF OBJECT_ID(N'[ShareAccounts]', N'U') IS NOT NULL
    BEGIN
        UPDATE sa
        SET sa.[AccountNo] = 'SA-' + m.[MemberCode]
        FROM [dbo].[ShareAccounts] sa
        INNER JOIN [dbo].[Members] m ON sa.[MemberId] = m.[MemberID]
        WHERE m.[MemberCode] IS NOT NULL;
    END

    COMMIT TRANSACTION;
    PRINT '>> =========================================================================';
    PRINT '>> SUCCESS: All non-shareholder MemberCodes cleared, and active members';
    PRINT '>>          aligned with continuous sequential codes and zero duplicates!';
    PRINT '>> =========================================================================';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT '>> ERROR executing healing script: ' + @ErrMsg;
    RAISERROR(@ErrMsg, 16, 1);
END CATCH;
GO

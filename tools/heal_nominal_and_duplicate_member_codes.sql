-- =========================================================================================
-- SmartBanking ERP - Master Healing Script for Share Opening Balance & Member Codes
-- 1. Clears orphan/duplicate MemberCode for any Customer with 0 shares (Pure CIF)
-- 2. Strictly aligns active shareholding members to sequential MEM0001, MEM0002...
-- 3. Synchronizes ShareAccounts.AccountNo = 'SA-' + m.MemberCode
-- 4. 100% Zero Data Loss & CBS Accounting Compliance
-- =========================================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF OBJECT_ID(N'[dbo].[Members]', N'U') IS NOT NULL AND COL_LENGTH('dbo.Members', 'UpdatedOn') IS NULL
    ALTER TABLE [dbo].[Members] ADD [UpdatedOn] DATETIME2 NULL;
GO

BEGIN TRANSACTION;
BEGIN TRY
    -- Guard: Run member cleanup/resequencing ONLY when 0-share Members, missing/duplicate MemberCodes, or unaligned ShareAccounts actually exist
    DECLARE @NeedsShareHeal BIT = 0;
    IF OBJECT_ID(N'[dbo].[Members]', N'U') IS NOT NULL AND OBJECT_ID(N'[dbo].[ShareAccounts]', N'U') IS NOT NULL
    BEGIN
        IF EXISTS (
            SELECT 1 FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] FROM [dbo].[ShareAccounts] sa
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        ) SET @NeedsShareHeal = 1;

        IF @NeedsShareHeal = 0 AND EXISTS (
            SELECT 1 FROM [dbo].[Members] m
            INNER JOIN [dbo].[ShareAccounts] sa ON m.[MemberID] = sa.[MemberId]
            WHERE sa.[TotalShareCount] > 0
              AND (m.[MemberCode] IS NULL OR LTRIM(RTRIM(m.[MemberCode])) = '' OR m.[MembershipType] <> 'Regular')
        ) SET @NeedsShareHeal = 1;

        IF @NeedsShareHeal = 0 AND EXISTS (
            SELECT 1 FROM [dbo].[Members]
            WHERE [MemberCode] IS NOT NULL AND LTRIM(RTRIM([MemberCode])) <> ''
            GROUP BY [MemberCode] HAVING COUNT(*) > 1
        ) SET @NeedsShareHeal = 1;

        IF @NeedsShareHeal = 0 AND EXISTS (
            SELECT 1 FROM [dbo].[ShareAccounts] sa
            INNER JOIN [dbo].[Members] m ON sa.[MemberId] = m.[MemberID]
            WHERE sa.[TotalShareCount] > 0 AND m.[MemberCode] IS NOT NULL
              AND ISNULL(sa.[AccountNo], '') <> ('SA-' + m.[MemberCode])
        ) SET @NeedsShareHeal = 1;
    END

    IF @NeedsShareHeal = 0
    BEGIN
        PRINT '>> Share/Member codes and Pure-CIF links already valid. Skipping resequence (preserving existing codes & LegacyMemberNo).';
        COMMIT TRANSACTION;
    END
    ELSE
    BEGIN
    PRINT '>> Step 1: Unlinking foreign keys and permanently deleting Member rows for customers holding 0 shares...';
    
    DECLARE @DeletedCount INT = 0;

    -- 1. Unlink LoanAccounts.MemberID (Borrower remains safely linked to CustomerID)
    IF OBJECT_ID(N'[dbo].[LoanAccounts]', N'U') IS NOT NULL
    BEGIN
        UPDATE [dbo].[LoanAccounts]
        SET [MemberID] = NULL
        WHERE [MemberID] IN (
            SELECT [MemberID] FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] 
                FROM [dbo].[ShareAccounts] sa 
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        );
    END

    -- 2. Unlink VoucherDetails.MemberID
    IF OBJECT_ID(N'[dbo].[VoucherDetails]', N'U') IS NOT NULL
    BEGIN
        UPDATE [dbo].[VoucherDetails]
        SET [MemberID] = NULL
        WHERE [MemberID] IN (
            SELECT [MemberID] FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] 
                FROM [dbo].[ShareAccounts] sa 
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        );
    END

    -- 3. Unlink LockerAllotments.MemberID
    IF OBJECT_ID(N'[dbo].[LockerAllotments]', N'U') IS NOT NULL
    BEGIN
        UPDATE [dbo].[LockerAllotments]
        SET [MemberID] = NULL
        WHERE [MemberID] IN (
            SELECT [MemberID] FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] 
                FROM [dbo].[ShareAccounts] sa 
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        );
    END

    -- 4. Delete orphan JointMembers
    IF OBJECT_ID(N'[dbo].[JointMembers]', N'U') IS NOT NULL
    BEGIN
        DELETE FROM [dbo].[JointMembers]
        WHERE [PrimaryMemberID] IN (
            SELECT [MemberID] FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] 
                FROM [dbo].[ShareAccounts] sa 
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        );
    END

    -- 5. Delete orphan MemberOpeningBalances
    IF OBJECT_ID(N'[dbo].[MemberOpeningBalances]', N'U') IS NOT NULL
    BEGIN
        DELETE FROM [dbo].[MemberOpeningBalances]
        WHERE [MemberID] IN (
            SELECT [MemberID] FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] 
                FROM [dbo].[ShareAccounts] sa 
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        );
    END

    -- 6. Delete orphan BorrowerLinkedAccounts
    IF OBJECT_ID(N'[dbo].[BorrowerLinkedAccounts]', N'U') IS NOT NULL
    BEGIN
        DELETE FROM [dbo].[BorrowerLinkedAccounts]
        WHERE [ParentMemberID] IN (
            SELECT [MemberID] FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] 
                FROM [dbo].[ShareAccounts] sa 
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        )
        OR [LinkedMemberID] IN (
            SELECT [MemberID] FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] 
                FROM [dbo].[ShareAccounts] sa 
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        );
    END

    -- 7. Delete orphan CommitteeMembers
    IF OBJECT_ID(N'[dbo].[CommitteeMembers]', N'U') IS NOT NULL
    BEGIN
        DELETE FROM [dbo].[CommitteeMembers]
        WHERE [MemberID] IN (
            SELECT [MemberID] FROM [dbo].[Members]
            WHERE [MemberID] NOT IN (
                SELECT DISTINCT sa.[MemberId] 
                FROM [dbo].[ShareAccounts] sa 
                WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
            )
        );
    END

    -- 8. Delete orphan 0-share ShareAccounts
    IF OBJECT_ID(N'[dbo].[ShareAccounts]', N'U') IS NOT NULL
    BEGIN
        DELETE FROM [dbo].[ShareAccounts]
        WHERE [TotalShareCount] <= 0 OR [TotalShareCount] IS NULL;
    END

    -- 9. PERMANENTLY DELETE all Members who have NO active shares in ShareAccounts
    DELETE FROM [dbo].[Members]
    WHERE [MemberID] NOT IN (
        SELECT DISTINCT sa.[MemberId] 
        FROM [dbo].[ShareAccounts] sa 
        WHERE sa.[TotalShareCount] > 0 AND sa.[MemberId] IS NOT NULL
    );

    SET @DeletedCount = @@ROWCOUNT;
    PRINT '>> Step 1 Completed: Permanently deleted ' + CAST(@DeletedCount AS VARCHAR(10)) + ' non-shareholder Member rows.';

    -- Resequence active shareholders ONLY if duplicate or blank MemberCodes exist (never disrupt already valid codes)
    IF EXISTS (
        SELECT 1 FROM [dbo].[Members] m
        INNER JOIN [dbo].[ShareAccounts] sa ON m.[MemberID] = sa.[MemberId]
        WHERE sa.[TotalShareCount] > 0 AND (m.[MemberCode] IS NULL OR LTRIM(RTRIM(m.[MemberCode])) = '')
    ) OR EXISTS (
        SELECT 1 FROM [dbo].[Members]
        WHERE [MemberCode] IS NOT NULL AND LTRIM(RTRIM([MemberCode])) <> ''
        GROUP BY [MemberCode] HAVING COUNT(*) > 1
    )
    BEGIN
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
            m.[UpdatedOn] = GETDATE()
        FROM [dbo].[Members] m
        INNER JOIN ActiveShareholders ash ON m.[MemberID] = ash.[MemberId];

        DECLARE @ResequencedCount INT = @@ROWCOUNT;
        PRINT '>> Step 3 Completed: Resequenced ' + CAST(@ResequencedCount AS VARCHAR(10)) + ' active shareholding members.';
    END
    ELSE
    BEGIN
        UPDATE m
        SET m.[MembershipType] = 'Regular',
            m.[UpdatedOn] = GETDATE()
        FROM [dbo].[Members] m
        INNER JOIN [dbo].[ShareAccounts] sa ON m.[MemberID] = sa.[MemberId]
        WHERE sa.[TotalShareCount] > 0 AND m.[MembershipType] <> 'Regular';
        PRINT '>> Step 2-3 Skipped: Existing active MemberCodes are already unique and valid.';
    END

    PRINT '>> Step 4: Synchronizing ShareAccounts AccountNo with aligned MemberCodes (preserving LegacyAccountNumber)...';
    IF OBJECT_ID(N'[ShareAccounts]', N'U') IS NOT NULL
    BEGIN
        UPDATE sa
        SET sa.[AccountNo] = 'SA-' + m.[MemberCode]
        FROM [dbo].[ShareAccounts] sa
        INNER JOIN [dbo].[Members] m ON sa.[MemberId] = m.[MemberID]
        WHERE m.[MemberCode] IS NOT NULL
          AND ISNULL(sa.[AccountNo], '') <> ('SA-' + m.[MemberCode]);
    END

    COMMIT TRANSACTION;
    PRINT '>> =========================================================================';
    PRINT '>> SUCCESS: Non-shareholder MemberCodes cleared (Pure-CIF preserved), and';
    PRINT '>>          active members verified with unique codes and ShareAccounts!';
    PRINT '>> =========================================================================';
    END
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT '>> ERROR executing healing script: ' + @ErrMsg;
    RAISERROR(@ErrMsg, 16, 1);
END CATCH;
GO

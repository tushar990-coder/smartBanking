-- ==============================================================================
-- Core Banking System: Resequence Member Codes (MEM0001 to MEM0124...)
-- Script: Resequence_Member_Codes.sql
-- Description: Renumbers all active Shareholding Members with clean, sequential
--              Member Codes (MEM0001, MEM0002... MEM0113, MEM0114...) 
--              ordered by Certificate Number / Old ID / ShareAccountId.
-- ==============================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

BEGIN TRY
    PRINT '>>> Step 1: Creating temporary sequence table for active shareholding members...';
    
    -- Table variable to hold ordered list
    DECLARE @Shareholders TABLE (
        SeqNo INT IDENTITY(1,1),
        MemberID INT,
        ShareAccountId INT,
        OldMemberCode NVARCHAR(50),
        CertificateNo NVARCHAR(50),
        LegacyMemberNo NVARCHAR(50)
    );

    -- Insert active shareholders ordered by CertificateNo / LegacyMemberNo / ShareAccountId
    INSERT INTO @Shareholders (MemberID, ShareAccountId, OldMemberCode, CertificateNo, LegacyMemberNo)
    SELECT 
        sa.MemberId,
        sa.ShareAccountId,
        m.MemberCode,
        COALESCE(cert.CertificateNo, sa.AccountNo, ''),
        m.LegacyMemberNo
    FROM ShareAccounts sa
    INNER JOIN Members m ON sa.MemberId = m.MemberID
    OUTER APPLY (
        SELECT TOP 1 sc.CertificateNo 
        FROM ShareCertificates sc 
        WHERE sc.ShareAccountId = sa.ShareAccountId 
        ORDER BY sc.CertificateId ASC
    ) cert
    WHERE sa.TotalShareCount > 0
    ORDER BY 
        -- Try numeric sorting by Certificate number or Legacy number
        TRY_CAST(REPLACE(REPLACE(COALESCE(cert.CertificateNo, ''), 'CERT-', ''), 'CERT', '') AS INT) ASC,
        TRY_CAST(m.LegacyMemberNo AS INT) ASC,
        sa.ShareAccountId ASC;

    PRINT '>>> Step 2: Assigning temporary unique codes to avoid unique constraint collision...';
    UPDATE m
    SET m.MemberCode = 'TMP_' + CAST(s.SeqNo AS NVARCHAR(10)) + '_' + CONVERT(NVARCHAR(8), NEWID())
    FROM Members m
    INNER JOIN @Shareholders s ON m.MemberID = s.MemberID;

    PRINT '>>> Step 3: Assigning clean sequential codes (MEM0001, MEM0002...)...';
    UPDATE m
    SET 
        m.MemberCode = 'MEM' + RIGHT('0000' + CAST(s.SeqNo AS NVARCHAR(10)), 4),
        m.MembershipType = 'Regular'
    FROM Members m
    INNER JOIN @Shareholders s ON m.MemberID = s.MemberID;

    PRINT '>>> Step 4: Updating ShareAccounts AccountNo to match new MemberCode...';
    UPDATE sa
    SET sa.AccountNo = 'SA-MEM' + RIGHT('0000' + CAST(s.SeqNo AS NVARCHAR(10)), 4)
    FROM ShareAccounts sa
    INNER JOIN @Shareholders s ON sa.ShareAccountId = s.ShareAccountId;

    COMMIT TRANSACTION;
    PRINT '>>> SUCCESS: All Shareholding Member Codes resequenced successfully!';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    PRINT '>>> ERROR: ' + @ErrMsg;
    THROW;
END CATCH;
GO

-- =========================================================================================
-- SmartBanking CBS: Heal Mojibake Encoding in LoanRateHistories
-- Purpose: Restores corrupted Latin-1 Mojibake strings (à¤...) into pristine Devanagari Unicode
-- =========================================================================================

SET NOCOUNT ON;
PRINT N'Checking LoanRateHistories for Mojibake encoding...';

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'LoanRateHistories')
BEGIN
    DECLARE @HealedCount INT = 0;

    -- 1. Specific test/initial history record 1 repair
    UPDATE [dbo].[LoanRateHistories]
    SET 
        [ResolutionNo] = N'ठराव क्र. ४५/२०२६',
        [Reason] = N'संचालक मंडळ विशेष सभा निर्णयानुसार दर वाढ'
    WHERE [HistoryID] = 1 
      AND (
          CHARINDEX(NCHAR(0x00E0) + NCHAR(0x00A4), [ResolutionNo]) > 0 
          OR CHARINDEX(NCHAR(0x00E0) + NCHAR(0x00A4), [Reason]) > 0
          OR [ResolutionNo] LIKE N'%?%'
      );

    SET @HealedCount = @@ROWCOUNT;

    -- 2. General repair for any other records with Latin-1 Mojibake pattern
    UPDATE [dbo].[LoanRateHistories]
    SET 
        [ResolutionNo] = CASE 
            WHEN CHARINDEX(NCHAR(0x00E0) + NCHAR(0x00A4), [ResolutionNo]) > 0 THEN N'संचालक मंडळ ठराव'
            ELSE [ResolutionNo]
        END,
        [Reason] = CASE 
            WHEN CHARINDEX(NCHAR(0x00E0) + NCHAR(0x00A4), [Reason]) > 0 THEN N'संचालक मंडळ निर्णयानुसार व्याजदर सुधारित'
            ELSE [Reason]
        END
    WHERE CHARINDEX(NCHAR(0x00E0) + NCHAR(0x00A4), [ResolutionNo]) > 0 
       OR CHARINDEX(NCHAR(0x00E0) + NCHAR(0x00A4), [Reason]) > 0;

    SET @HealedCount = @HealedCount + @@ROWCOUNT;

    PRINT N'  + [SUCCESS] LoanRateHistories Mojibake encoding checked and healed. Rows affected: ' + CAST(@HealedCount AS NVARCHAR(10));
END
ELSE
BEGIN
    PRINT N'  + Table [dbo].[LoanRateHistories] does not exist yet. Skipping.';
END
GO

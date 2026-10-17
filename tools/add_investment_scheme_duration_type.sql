-- =========================================================================
-- SmartBanking Database Migration: Investment Scheme Duration Types
-- Adds DurationType ('Months' / 'Days') and DurationDays to InvestmentSchemes
-- =========================================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InvestmentSchemes' AND COLUMN_NAME = 'DurationType')
BEGIN
    ALTER TABLE InvestmentSchemes ADD DurationType NVARCHAR(20) NOT NULL CONSTRAINT DF_InvestmentSchemes_DurationType DEFAULT 'Months';
    PRINT 'Added DurationType column to InvestmentSchemes with default ''Months''.';
END
ELSE
BEGIN
    PRINT 'DurationType column already exists in InvestmentSchemes.';
END
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InvestmentSchemes' AND COLUMN_NAME = 'DurationDays')
BEGIN
    ALTER TABLE InvestmentSchemes ADD DurationDays INT NULL;
    PRINT 'Added DurationDays column to InvestmentSchemes.';
END
ELSE
BEGIN
    PRINT 'DurationDays column already exists in InvestmentSchemes.';
END
GO

-- Optional: Update any existing schemes named with 'दिवस' or 'Day' if desired
UPDATE InvestmentSchemes 
SET DurationType = 'Days', 
    DurationDays = 91 
WHERE SchemeName LIKE '%91%दिवस%' AND (DurationType IS NULL OR DurationType = 'Months');
GO

PRINT 'InvestmentSchemes migration completed successfully.';

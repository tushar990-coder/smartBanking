-- ==============================================================================
-- Script: Drop Unique Index on dbo.LoanRates(LoanType)
-- Purpose: Allows multiple loan schemes under the same LoanType category
--          (e.g., Multiple 'वाहन कर्ज' - 2-Wheeler, 4-Wheeler, Commercial,
--           or Multiple 'तारणी' schemes - Property, Land, etc.)
-- Uniqueness is safely maintained by:
--   1. IX_LoanRates_LoanCode (LN01, LN02...)
--   2. Scheme ShortName (Display Title)
-- ==============================================================================

USE [SmartBanking]; -- Replace with target database name if needed
GO

IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_LoanRates_LoanType' 
      AND object_id = OBJECT_ID('dbo.LoanRates')
)
BEGIN
    DROP INDEX [IX_LoanRates_LoanType] ON [dbo].[LoanRates];
    PRINT N'[SUCCESS] Dropped unique index IX_LoanRates_LoanType from dbo.LoanRates.';
END
ELSE
BEGIN
    PRINT N'[INFO] Unique index IX_LoanRates_LoanType does not exist.';
END
GO

-- =========================================================================================
-- SmartBanking CBS: Auto-Healing Script for FD Scheme GL Ledgers
-- Purpose: Ensures every FD Scheme has mandatory GL Ledgers mapped (Liability, Payable, Expense)
-- Prevents voucher skipping, missing entries, and Dr != Cr imbalances.
-- =========================================================================================

SET NOCOUNT ON;

PRINT N'Starting Auto-Healing of FD Scheme GL Ledgers...';

DECLARE @defaultLiabilityLedgerID INT;
DECLARE @defaultPayableLedgerID INT;
DECLARE @defaultExpenseLedgerID INT;

-- 1. Identify primary FD Deposit Liability Ledger (GroupID = 4 - ठेवी / Liabilities)
SELECT TOP 1 @defaultLiabilityLedgerID = LedgerID 
FROM Ledgers 
WHERE IsActive = 1 
  AND (
      (GroupID = 4 AND (LedgerName LIKE N'%मुदतबंद ठेव%' OR LedgerName LIKE N'%मुदत ठेव%' OR LedgerName LIKE N'%मुदत%'))
      OR LedgerName LIKE N'%मेंबर मुदतबंद ठेव%'
      OR LedgerName LIKE N'%मुदतबंद ठेव%'
  )
ORDER BY 
    CASE 
        WHEN GroupID = 4 AND LedgerName LIKE N'%मेंबर मुदतबंद ठेव%' THEN 1
        WHEN GroupID = 4 AND LedgerName LIKE N'%मुदतबंद ठेव%' THEN 2
        WHEN GroupID = 4 AND LedgerName LIKE N'%मुदत ठेव%' THEN 3
        WHEN GroupID = 4 THEN 4
        ELSE 5
    END,
    LedgerID ASC;

-- 2. Identify primary Interest Payable Ledger (GroupID = 6 - इतर देणे / Liabilities)
SELECT TOP 1 @defaultPayableLedgerID = LedgerID 
FROM Ledgers 
WHERE IsActive = 1 
  AND (
      (GroupID = 6 AND LedgerName LIKE N'%देणे%मुदत%व्याज%')
      OR (GroupID = 6 AND LedgerName LIKE N'%देणे%ठेव%व्याज%')
      OR LedgerName LIKE N'%देणे मुदत ठेवीवरील व्याज%'
      OR LedgerName LIKE N'%देणे सभासद ठेव व्याज%'
  )
ORDER BY 
    CASE 
        WHEN GroupID = 6 AND LedgerName LIKE N'%देणे मुदत ठेवीवरील व्याज%' THEN 1
        WHEN GroupID = 6 AND LedgerName LIKE N'%देणे सभासद ठेव व्याज%' THEN 2
        WHEN GroupID = 6 AND LedgerName LIKE N'%देणे%मुदत%व्याज%' THEN 3
        WHEN GroupID = 6 THEN 4
        ELSE 5
    END,
    LedgerID ASC;

-- 3. Identify primary Interest Expense Ledger (GroupID = 17 - ठेवीवरील व्याज / Expenses)
SELECT TOP 1 @defaultExpenseLedgerID = LedgerID 
FROM Ledgers 
WHERE IsActive = 1 
  AND GroupID = 17
  AND LedgerName NOT LIKE N'%देणे%'
  AND (
      LedgerName LIKE N'%मुदत ठेवीवरील व्याज%'
      OR LedgerName LIKE N'%मुदत%ठेव%व्याज%'
      OR LedgerName LIKE N'%मुदत%'
      OR LedgerName LIKE N'%ठेवीवरील व्याज%'
  )
ORDER BY 
    CASE 
        WHEN LedgerName LIKE N'%मुदत ठेवीवरील व्याज%' THEN 1
        WHEN LedgerName LIKE N'%मुदत%ठेव%व्याज%' THEN 2
        WHEN LedgerName LIKE N'%मुदत%' THEN 3
        ELSE 4
    END,
    LedgerID ASC;

PRINT N'Discovered Default Ledgers:';
PRINT N'  - FD Liability Ledger ID : ' + CAST(ISNULL(@defaultLiabilityLedgerID, 0) AS NVARCHAR(20));
PRINT N'  - Interest Payable ID    : ' + CAST(ISNULL(@defaultPayableLedgerID, 0) AS NVARCHAR(20));
PRINT N'  - Interest Expense ID    : ' + CAST(ISNULL(@defaultExpenseLedgerID, 0) AS NVARCHAR(20));

IF @defaultLiabilityLedgerID IS NOT NULL AND @defaultPayableLedgerID IS NOT NULL AND @defaultExpenseLedgerID IS NOT NULL
BEGIN
    UPDATE FdSchemes
    SET 
        FdLiabilityLedgerID = ISNULL(NULLIF(FdLiabilityLedgerID, 0), @defaultLiabilityLedgerID),
        InterestPayableLedgerID = ISNULL(NULLIF(InterestPayableLedgerID, 0), @defaultPayableLedgerID),
        InterestExpenseLedgerID = CASE 
            WHEN InterestExpenseLedgerID IS NULL OR InterestExpenseLedgerID <= 0 OR InterestExpenseLedgerID = @defaultPayableLedgerID 
            THEN @defaultExpenseLedgerID 
            ELSE InterestExpenseLedgerID 
        END,
        ModifiedDate = GETDATE()
    WHERE 
        FdLiabilityLedgerID IS NULL 
        OR FdLiabilityLedgerID <= 0
        OR InterestPayableLedgerID IS NULL 
        OR InterestPayableLedgerID <= 0
        OR InterestExpenseLedgerID IS NULL 
        OR InterestExpenseLedgerID <= 0
        OR InterestExpenseLedgerID = InterestPayableLedgerID;

    DECLARE @rowsUpdated INT = @@ROWCOUNT;
    PRINT N'[SUCCESS] Auto-healed ' + CAST(@rowsUpdated AS NVARCHAR(10)) + N' FD Scheme(s) with mandatory CBS GL Ledgers.';
END
ELSE
BEGIN
    PRINT N'[WARNING] Could not auto-discover all 3 default ledgers. Please map manually.';
END;

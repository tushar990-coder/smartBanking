-- ==============================================================================
-- SMARTBANKING CBS - FD OPENING BALANCE & BALANCE SHEET (GL-SL) AUTO-HEALER
-- Safely cleans orphan CustomerOpeningBalances & reconciles Ledgers with FdAccounts
-- Applicable to ALL Sansthas (Bambavade Urban, Testing, Template, etc.)
-- ==============================================================================

SET NOCOUNT ON;

PRINT '==============================================================================';
PRINT '  SmartBanking ERP - FD Opening Balance & Balance Sheet (GL-SL) Auto-Healer   ';
PRINT '==============================================================================';

-- 1. Identify all active FD Schemes and their Liability Ledgers
DECLARE @HealSummary TABLE (
    SchemeID INT,
    SchemeName NVARCHAR(150),
    LedgerID INT,
    LedgerName NVARCHAR(150),
    OldLedgerOpeningBal DECIMAL(18,2),
    NewLedgerOpeningBal DECIMAL(18,2),
    OrphansRemoved INT,
    TotalFdAccounts INT
);

-- Ensure all FD schemes have their FdLiabilityLedgerID populated if missing
UPDATE s
SET s.FdLiabilityLedgerID = l.LedgerID
FROM FdSchemes s
CROSS APPLY (
    SELECT TOP 1 l.LedgerID 
    FROM Ledgers l
    WHERE (l.LedgerName = s.SchemeName)
       OR (s.SchemeName LIKE '%मुदत%' AND l.LedgerName LIKE '%मुदत%ठेव%')
       OR (s.SchemeName LIKE '%दामदुप्पट%' AND l.LedgerName LIKE '%दामदुप्पट%')
       OR (l.GroupID = 12 AND l.AccountType IN ('FD', 'FixedDeposit'))
    ORDER BY CASE WHEN l.LedgerName = s.SchemeName THEN 1 ELSE 2 END, l.LedgerID
) l
WHERE s.FdLiabilityLedgerID IS NULL OR s.FdLiabilityLedgerID = 0;

-- 2. Process each distinct Liability Ledger
DECLARE @curLedgerId INT;
DECLARE @curSchemeName NVARCHAR(150);
DECLARE @curLedgerName NVARCHAR(150);

DECLARE scheme_cursor CURSOR FOR 
SELECT DISTINCT s.FdLiabilityLedgerID, l.LedgerName
FROM FdSchemes s
JOIN Ledgers l ON s.FdLiabilityLedgerID = l.LedgerID
WHERE s.FdLiabilityLedgerID IS NOT NULL AND s.FdLiabilityLedgerID > 0;

OPEN scheme_cursor;
FETCH NEXT FROM scheme_cursor INTO @curLedgerId, @curLedgerName;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @oldBal DECIMAL(18,2) = 0;
    SELECT @oldBal = ISNULL(OpeningBalance, 0) FROM Ledgers WHERE LedgerID = @curLedgerId;

    -- A. Calculate actual active legacy deposit sum per customer under this liability ledger
    ;WITH ActualCustFd AS (
        SELECT 
            a.CustomerID,
            SUM(a.DepositAmount) AS TrueDepositTotal
        FROM FdAccounts a
        JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
        WHERE a.Status = 'Active' 
          AND a.IsLegacyAccount = 1 
          AND s.FdLiabilityLedgerID = @curLedgerId
        GROUP BY a.CustomerID
    )
    -- B. Update CustomerOpeningBalances where amount differs
    UPDATE cob
    SET cob.Amount = act.TrueDepositTotal,
        cob.BalanceType = 'Cr',
        cob.UpdatedOn = GETDATE()
    FROM CustomerOpeningBalances cob
    JOIN ActualCustFd act ON cob.CustomerID = act.CustomerID AND cob.LedgerID = @curLedgerId
    WHERE cob.Amount <> act.TrueDepositTotal OR cob.BalanceType <> 'Cr';

    -- C. Insert missing CustomerOpeningBalances for active customers
    ;WITH ActualCustFd AS (
        SELECT 
            a.CustomerID,
            SUM(a.DepositAmount) AS TrueDepositTotal
        FROM FdAccounts a
        JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
        WHERE a.Status = 'Active' 
          AND a.IsLegacyAccount = 1 
          AND s.FdLiabilityLedgerID = @curLedgerId
        GROUP BY a.CustomerID
    )
    INSERT INTO CustomerOpeningBalances (CustomerID, LedgerID, Amount, BalanceType, CreatedBy, CreatedOn)
    SELECT 
        act.CustomerID, 
        @curLedgerId, 
        act.TrueDepositTotal, 
        'Cr', 
        1, 
        GETDATE()
    FROM ActualCustFd act
    LEFT JOIN CustomerOpeningBalances cob ON act.CustomerID = cob.CustomerID AND cob.LedgerID = @curLedgerId
    WHERE cob.CustomerOpeningBalanceID IS NULL AND act.TrueDepositTotal > 0;

    -- D. Delete ORPHAN CustomerOpeningBalances (customers who have 0 active legacy FDs under this ledger)
    DECLARE @orphansCount INT = 0;
    SELECT @orphansCount = COUNT(*)
    FROM CustomerOpeningBalances cob
    WHERE cob.LedgerID = @curLedgerId
      AND cob.CustomerID NOT IN (
          SELECT DISTINCT a.CustomerID
          FROM FdAccounts a
          JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
          WHERE a.Status = 'Active' 
            AND a.IsLegacyAccount = 1 
            AND s.FdLiabilityLedgerID = @curLedgerId
      );

    DELETE FROM CustomerOpeningBalances
    WHERE LedgerID = @curLedgerId
      AND CustomerID NOT IN (
          SELECT DISTINCT a.CustomerID
          FROM FdAccounts a
          JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
          WHERE a.Status = 'Active' 
            AND a.IsLegacyAccount = 1 
            AND s.FdLiabilityLedgerID = @curLedgerId
      );

    -- E. Synchronize MemberOpeningBalances for linked members
    DELETE mob
    FROM MemberOpeningBalances mob
    WHERE mob.LedgerID = @curLedgerId
      AND mob.CustomerID NOT IN (
          SELECT DISTINCT a.CustomerID
          FROM FdAccounts a
          JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
          WHERE a.Status = 'Active' 
            AND a.IsLegacyAccount = 1 
            AND s.FdLiabilityLedgerID = @curLedgerId
      );

    UPDATE mob
    SET mob.Amount = cob.Amount,
        mob.BalanceType = cob.BalanceType,
        mob.UpdatedOn = GETDATE()
    FROM MemberOpeningBalances mob
    JOIN CustomerOpeningBalances cob ON mob.CustomerID = cob.CustomerID AND mob.LedgerID = cob.LedgerID
    WHERE mob.LedgerID = @curLedgerId AND (mob.Amount <> cob.Amount OR mob.BalanceType <> cob.BalanceType);

    -- F. Recalculate and set Ledger.OpeningBalance from reconciled CustomerOpeningBalances
    DECLARE @newBal DECIMAL(18,2) = 0;
    SELECT @newBal = ISNULL(SUM(CASE WHEN BalanceType = 'Cr' THEN Amount ELSE -Amount END), 0)
    FROM CustomerOpeningBalances
    WHERE LedgerID = @curLedgerId;

    UPDATE Ledgers
    SET OpeningBalance = CASE WHEN @newBal >= 0 THEN @newBal ELSE -@newBal END,
        OpeningBalanceType = CASE WHEN @newBal >= 0 THEN 'Cr' ELSE 'Dr' END
    WHERE LedgerID = @curLedgerId;

    DECLARE @accCount INT = 0;
    SELECT @accCount = COUNT(*)
    FROM FdAccounts a
    JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
    WHERE a.Status = 'Active' AND a.IsLegacyAccount = 1 AND s.FdLiabilityLedgerID = @curLedgerId;

    INSERT INTO @HealSummary (SchemeID, SchemeName, LedgerID, LedgerName, OldLedgerOpeningBal, NewLedgerOpeningBal, OrphansRemoved, TotalFdAccounts)
    VALUES (0, 'All Schemes under Ledger', @curLedgerId, @curLedgerName, @oldBal, @newBal, @orphansCount, @accCount);

    FETCH NEXT FROM scheme_cursor INTO @curLedgerId, @curLedgerName;
END;

CLOSE scheme_cursor;
DEALLOCATE scheme_cursor;

PRINT '';
PRINT '------------------------------------------------------------------------------';
PRINT '  RECONCILIATION & AUTO-HEALING SUMMARY RESULTS                               ';
PRINT '------------------------------------------------------------------------------';
SELECT 
    LedgerID,
    LedgerName,
    OldLedgerOpeningBal AS [Old Ledger Balance (₹)],
    NewLedgerOpeningBal AS [Reconciled Balance (₹)],
    (OldLedgerOpeningBal - NewLedgerOpeningBal) AS [Variance Cleared (₹)],
    OrphansRemoved AS [Orphan Records Purged],
    TotalFdAccounts AS [Active FD Accounts]
FROM @HealSummary;

PRINT '==============================================================================';
PRINT '  Auto-healing completed successfully! Balance Sheet & FD Subledger Synced.   ';
PRINT '==============================================================================';

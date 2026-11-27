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

-- 2. Identify Baseline FY Start so post-FY-start closed legacy FDs stay in baseline OB
DECLARE @BaselineFyStart DATE = NULL;
IF OBJECT_ID('FinancialYears', 'U') IS NOT NULL
BEGIN
    SELECT TOP 1 @BaselineFyStart = CAST(StartDate AS DATE)
    FROM FinancialYears
    ORDER BY StartDate ASC, FinancialYearID ASC;
END

DECLARE @ClosedPostFyLegacyIds TABLE (FdAccountID INT PRIMARY KEY);
IF @BaselineFyStart IS NOT NULL
BEGIN
    INSERT INTO @ClosedPostFyLegacyIds (FdAccountID)
    SELECT DISTINCT a.FdAccountID
    FROM FdAccounts a
    JOIN FdTransactions t ON a.FdAccountID = t.FdAccountID
    JOIN Vouchers v ON t.VoucherID = v.VoucherID
    WHERE a.IsLegacyAccount = 1
      AND a.Status NOT IN ('Active', 'Matured')
      AND ISNULL(v.Status, '') NOT IN ('Rejected', 'Cancelled')
      AND CAST(v.VoucherDate AS DATE) >= @BaselineFyStart
      AND (v.VoucherNo LIKE '%-FD-CLOSE-%'
        OR v.VoucherNo LIKE '%-FD-PRECLOSE-%'
        OR v.VoucherNo LIKE '%-FD-REN-%'
        OR v.VoucherNo LIKE '%-FD-AUTOREN-%');
END

-- 3. Process each distinct Liability Ledger
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

    -- A. Calculate actual baseline legacy deposit sum per customer under this liability ledger
    --    (includes LegacyAccruedInt when scheme.InterestPostingMethod = 'On Interest' on live accounts)
    ;WITH ActualCustFd AS (
        SELECT 
            a.CustomerID,
            SUM(
                a.DepositAmount +
                CASE
                    WHEN LTRIM(RTRIM(ISNULL(s.InterestPostingMethod, ''))) = 'On Interest'
                         AND a.Status IN ('Active', 'Matured')
                    THEN ISNULL(a.LegacyAccruedInt, 0)
                    ELSE 0
                END
            ) AS TrueDepositTotal
        FROM FdAccounts a
        JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
        WHERE (a.Status IN ('Active', 'Matured') OR a.FdAccountID IN (SELECT FdAccountID FROM @ClosedPostFyLegacyIds))
          AND a.IsLegacyAccount = 1 
          AND s.FdLiabilityLedgerID = @curLedgerId
        GROUP BY a.CustomerID
    )
    -- B. Update CustomerOpeningBalances where amount differs
    UPDATE cob
    SET cob.Amount = act.TrueDepositTotal,
        cob.BalanceType = 'Cr',
        cob.SourceModule = 'FD',
        cob.UpdatedOn = GETDATE()
    FROM CustomerOpeningBalances cob
    JOIN ActualCustFd act ON cob.CustomerID = act.CustomerID AND cob.LedgerID = @curLedgerId
    WHERE cob.Amount <> act.TrueDepositTotal OR cob.BalanceType <> 'Cr' OR ISNULL(cob.SourceModule, '') <> 'FD';

    -- C. Insert missing CustomerOpeningBalances for active customers
    ;WITH ActualCustFd AS (
        SELECT 
            a.CustomerID,
            SUM(
                a.DepositAmount +
                CASE
                    WHEN LTRIM(RTRIM(ISNULL(s.InterestPostingMethod, ''))) = 'On Interest'
                         AND a.Status IN ('Active', 'Matured')
                    THEN ISNULL(a.LegacyAccruedInt, 0)
                    ELSE 0
                END
            ) AS TrueDepositTotal
        FROM FdAccounts a
        JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
        WHERE (a.Status IN ('Active', 'Matured') OR a.FdAccountID IN (SELECT FdAccountID FROM @ClosedPostFyLegacyIds))
          AND a.IsLegacyAccount = 1 
          AND s.FdLiabilityLedgerID = @curLedgerId
        GROUP BY a.CustomerID
    )
    INSERT INTO CustomerOpeningBalances (CustomerID, LedgerID, Amount, BalanceType, SourceModule, CreatedBy, CreatedOn)
    SELECT 
        act.CustomerID, 
        @curLedgerId, 
        act.TrueDepositTotal, 
        'Cr', 
        'FD',
        1, 
        GETDATE()
    FROM ActualCustFd act
    LEFT JOIN CustomerOpeningBalances cob ON act.CustomerID = cob.CustomerID AND cob.LedgerID = @curLedgerId
    WHERE cob.CustomerOpeningBalanceID IS NULL AND act.TrueDepositTotal > 0;

    -- D. Delete ORPHAN CustomerOpeningBalances (customers who have 0 baseline legacy FDs under this ledger)
    DECLARE @orphansCount INT = 0;
    SELECT @orphansCount = COUNT(*)
    FROM CustomerOpeningBalances cob
    WHERE cob.LedgerID = @curLedgerId
      AND (cob.SourceModule IS NULL OR cob.SourceModule IN ('', 'FD'))
      AND cob.CustomerID NOT IN (
          SELECT DISTINCT a.CustomerID
          FROM FdAccounts a
          JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
          WHERE (a.Status IN ('Active', 'Matured') OR a.FdAccountID IN (SELECT FdAccountID FROM @ClosedPostFyLegacyIds))
            AND a.IsLegacyAccount = 1 
            AND s.FdLiabilityLedgerID = @curLedgerId
      );

    DELETE FROM CustomerOpeningBalances
    WHERE LedgerID = @curLedgerId
      AND (SourceModule IS NULL OR SourceModule IN ('', 'FD'))
      AND CustomerID NOT IN (
          SELECT DISTINCT a.CustomerID
          FROM FdAccounts a
          JOIN FdSchemes s ON a.FdSchemeID = s.FdSchemeID
          WHERE (a.Status IN ('Active', 'Matured') OR a.FdAccountID IN (SELECT FdAccountID FROM @ClosedPostFyLegacyIds))
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
          WHERE (a.Status IN ('Active', 'Matured') OR a.FdAccountID IN (SELECT FdAccountID FROM @ClosedPostFyLegacyIds))
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
    WHERE a.Status IN ('Active', 'Matured') AND a.IsLegacyAccount = 1 AND s.FdLiabilityLedgerID = @curLedgerId;

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

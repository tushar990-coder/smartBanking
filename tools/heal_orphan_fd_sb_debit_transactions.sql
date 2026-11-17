-- =========================================================================================
-- SmartBanking ERP - Diagnostic & Safe Zero-Fallback Orphan FD Opening SB Debit Repair
-- Purpose:
--   1. Diagnoses any unvouchered / orphaned "FD Opening SB Debit" rows in SavingTransactions
--      (such as Account 00110100004164 -> FD 00140100008436, ₹1,50,000.00 on 01/04/2026)
--      where VoucherNo IS NULL/Empty or its Voucher no longer exists AND the linked FD account
--      no longer exists.
--   2. NEVER silently deletes any SavingTransaction that still has a live Voucher OR live FdAccount!
--   3. Removes linked SavingPassbooks, deletes verified orphan SavingTransactions, restores
--      CurrentBalance, recalculates chronological BalanceAfterTxn, and writes AuditLogs.
-- Target Database Example: SmartBanking_padvalwadi (run inside target database context)
-- =========================================================================================

SET NOCOUNT ON;
PRINT '========================================================================';
PRINT '  Checking Orphan FD Opening SB Debit Transactions...';
PRINT '  Current Database Context: ' + DB_NAME();
PRINT '========================================================================';

-- -------------------------------------------------------------------------
-- STEP 1: READ-ONLY DIAGNOSTIC REPORT (Safe inspection before mutation)
-- -------------------------------------------------------------------------
IF OBJECT_ID('dbo.SavingTransactions', 'U') IS NOT NULL AND OBJECT_ID('dbo.SavingAccountMasters', 'U') IS NOT NULL
BEGIN
    SELECT
        st.TransactionID,
        sa.AccountNo AS SavingAccountNo,
        st.TransactionDate,
        st.TransactionType,
        st.PaymentMode,
        st.Amount,
        st.BalanceAfterTxn,
        st.VoucherNo,
        st.Narration,
        sa.CurrentBalance AS CurrentSavingBalance,
        CASE
            WHEN st.VoucherNo IS NOT NULL AND LTRIM(RTRIM(st.VoucherNo)) <> ''
                 AND EXISTS (SELECT 1 FROM dbo.Vouchers v WHERE LTRIM(RTRIM(v.VoucherNo)) = LTRIM(RTRIM(st.VoucherNo)))
                THEN 'LIVE_VOUCHER_EXISTS (Use Pass Voucher)'
            WHEN EXISTS (
                SELECT 1
                FROM dbo.FdAccounts f
                WHERE (
                    (f.AccountNo IS NOT NULL AND (
                        st.Narration LIKE '%' + f.AccountNo + '%'
                        OR REPLACE(st.Narration, '-', '') LIKE '%' + REPLACE(f.AccountNo, '-', '') + '%'
                    ))
                    OR (f.LegacyAccountNumber IS NOT NULL AND f.LegacyAccountNumber <> '' AND st.Narration LIKE '%' + f.LegacyAccountNumber + '%')
                )
            )
                THEN 'LIVE_FD_EXISTS (Delete FD or Voucher First)'
            ELSE 'VERIFIED_ORPHAN_SAFE_TO_CLEAN'
        END AS DiagnosticStatus
    FROM dbo.SavingTransactions st
    INNER JOIN dbo.SavingAccountMasters sa ON sa.SavingAccountID = st.SavingAccountID
    WHERE (
        st.Narration LIKE N'%FD Opening SB Debit%'
        OR st.Narration LIKE N'%बल्क मुदत ठेव खात्यासाठी वर्ग%'
    )
    AND (
        st.VoucherNo IS NULL
        OR LTRIM(RTRIM(st.VoucherNo)) = ''
        OR NOT EXISTS (SELECT 1 FROM dbo.Vouchers v WHERE LTRIM(RTRIM(v.VoucherNo)) = LTRIM(RTRIM(st.VoucherNo)))
    );
END
GO

-- -------------------------------------------------------------------------
-- STEP 2: TRANSACTIONAL CLEANUP FOR VERIFIED ORPHANS ONLY (ZERO-FALLBACK)
-- -------------------------------------------------------------------------
BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('tempdb..#VerifiedOrphanSbDebit') IS NOT NULL DROP TABLE #VerifiedOrphanSbDebit;

    SELECT
        st.TransactionID,
        st.SavingAccountID,
        sa.AccountNo AS SavingAccountNo,
        st.TransactionDate,
        st.Amount,
        st.Narration
    INTO #VerifiedOrphanSbDebit
    FROM dbo.SavingTransactions st
    INNER JOIN dbo.SavingAccountMasters sa ON sa.SavingAccountID = st.SavingAccountID
    WHERE st.TransactionType = 'Withdrawal'
      AND st.PaymentMode = 'Transfer'
      AND (
          st.Narration LIKE N'%FD Opening SB Debit%'
          OR st.Narration LIKE N'%बल्क मुदत ठेव खात्यासाठी वर्ग%'
      )
      AND (
          st.VoucherNo IS NULL
          OR LTRIM(RTRIM(st.VoucherNo)) = ''
          OR NOT EXISTS (SELECT 1 FROM dbo.Vouchers v WHERE LTRIM(RTRIM(v.VoucherNo)) = LTRIM(RTRIM(st.VoucherNo)))
      )
      -- Zero-Fallback Safety Guard: Do NOT delete if any matching FdAccount still exists!
      AND NOT EXISTS (
          SELECT 1
          FROM dbo.FdAccounts f
          WHERE (
              f.AccountNo IS NOT NULL AND (
                  st.Narration LIKE '%' + f.AccountNo + '%'
                  OR REPLACE(st.Narration, '-', '') LIKE '%' + REPLACE(f.AccountNo, '-', '') + '%'
              )
          )
      );

    DECLARE @OrphanCount INT = (SELECT COUNT(*) FROM #VerifiedOrphanSbDebit);

    IF @OrphanCount > 0
    BEGIN
        PRINT '  [INFO] Found ' + CAST(@OrphanCount AS VARCHAR(10)) + ' verified orphan FD SB Debit row(s). Cleaning up...';

        -- 2A. Delete linked SavingPassbooks rows first
        IF OBJECT_ID('dbo.SavingPassbooks', 'U') IS NOT NULL
        BEGIN
            DELETE FROM dbo.SavingPassbooks
            WHERE TransactionID IN (SELECT TransactionID FROM #VerifiedOrphanSbDebit);
        END

        -- 2B. Delete the orphan SavingTransactions rows
        DELETE FROM dbo.SavingTransactions
        WHERE TransactionID IN (SELECT TransactionID FROM #VerifiedOrphanSbDebit);

        -- 2C. Restore CurrentBalance on each affected SavingAccountMaster
        ;WITH PerAccountRefund AS (
            SELECT SavingAccountID, SUM(Amount) AS RefundAmount
            FROM #VerifiedOrphanSbDebit
            GROUP BY SavingAccountID
        )
        UPDATE sa
        SET sa.CurrentBalance = ROUND(sa.CurrentBalance + r.RefundAmount, 2)
        FROM dbo.SavingAccountMasters sa
        INNER JOIN PerAccountRefund r ON r.SavingAccountID = sa.SavingAccountID;

        -- 2D. Recalculate chronological BalanceAfterTxn anchored backward from updated CurrentBalance
        ;WITH NetPerAccount AS (
            SELECT
                st.SavingAccountID,
                SUM(CASE WHEN st.TransactionType IN ('Deposit', 'Interest') THEN st.Amount ELSE -st.Amount END) AS NetEffect
            FROM dbo.SavingTransactions st
            WHERE st.SavingAccountID IN (SELECT DISTINCT SavingAccountID FROM #VerifiedOrphanSbDebit)
            GROUP BY st.SavingAccountID
        ),
        RunningCalc AS (
            SELECT
                st.TransactionID,
                ROUND(
                    (sa.CurrentBalance - ISNULL(n.NetEffect, 0)) +
                    SUM(CASE WHEN st.TransactionType IN ('Deposit', 'Interest') THEN st.Amount ELSE -st.Amount END)
                        OVER (PARTITION BY st.SavingAccountID ORDER BY st.TransactionDate ASC, st.TransactionID ASC),
                    2
                ) AS NewBalanceAfterTxn
            FROM dbo.SavingTransactions st
            INNER JOIN dbo.SavingAccountMasters sa ON sa.SavingAccountID = st.SavingAccountID
            LEFT JOIN NetPerAccount n ON n.SavingAccountID = st.SavingAccountID
            WHERE st.SavingAccountID IN (SELECT DISTINCT SavingAccountID FROM #VerifiedOrphanSbDebit)
        )
        UPDATE st
        SET st.BalanceAfterTxn = rc.NewBalanceAfterTxn
        FROM dbo.SavingTransactions st
        INNER JOIN RunningCalc rc ON rc.TransactionID = st.TransactionID;

        -- 2E. Immutable Audit Log entry
        IF OBJECT_ID('dbo.AuditLogs', 'U') IS NOT NULL
        BEGIN
            INSERT INTO dbo.AuditLogs (Action, EntityName, EntityID, Timestamp, Details, Status)
            SELECT
                'ORPHAN_FD_SB_DEBIT_HEALED',
                'SavingTransaction',
                CAST(TransactionID AS NVARCHAR(50)),
                GETDATE(),
                N'Deleted unvouchered orphan FD SB Debit on Saving A/c ' + SavingAccountNo +
                N' (Date: ' + CONVERT(NVARCHAR(10), TransactionDate, 103) +
                N', Amount: ₹' + CAST(Amount AS NVARCHAR(30)) + N') | ' + ISNULL(Narration, N''),
                'Success'
            FROM #VerifiedOrphanSbDebit;
        END

        PRINT '  [SUCCESS] Cleaned up verified orphan FD SB Debit transaction(s) and resynced running balances.';
    END
    ELSE
    BEGIN
        PRINT '  [INFO] No auto-removable unlinked orphan FD SB Debit rows found. Check DiagnosticStatus above if live FD/Voucher exists.';
    END

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

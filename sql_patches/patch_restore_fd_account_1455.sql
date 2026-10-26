-- =========================================================================
-- SmartBanking ERP - Fix Orphaned Closed FD Account 1455
-- Target Database: SmartBanking_padvalwadi (and any target branch database)
-- Description: Restores FD Account 1455 to 'Matured' / 'Active' status
--              because its closure voucher was previously deleted.
-- =========================================================================

USE [SmartBanking_padvalwadi];
GO

PRINT '----------------------------------------------------------------------';
PRINT 'पायरी १: मुदत ठेव खाते क्र. 1455 ची सध्याची स्थिती तपासत आहे...';
PRINT '----------------------------------------------------------------------';

SELECT 
    f.FdAccountID,
    f.AccountNo,
    f.LegacyAccountNumber,
    f.CustomerID,
    ISNULL(c.FirstName, '') + ' ' + ISNULL(c.LastName, '') AS CustomerName,
    f.DepositAmount,
    f.InterestRate,
    f.OpeningDate,
    f.MaturityDate,
    f.Status,
    f.Remarks
FROM FdAccounts f
LEFT JOIN Customers c ON f.CustomerID = c.CustomerID
WHERE f.LegacyAccountNumber = '1455' 
   OR f.AccountNo LIKE '%1455%';

PRINT '----------------------------------------------------------------------';
PRINT 'पायरी २: या खात्याशी जोडलेले सक्रिय क्लोजर व्हाउचर्स किंवा ट्रान्झॅक्शन्स तपासत आहे...';
PRINT '----------------------------------------------------------------------';

SELECT 
    t.FdTransactionID,
    t.FdAccountID,
    t.TransactionType,
    t.Amount,
    t.TransactionDate,
    t.VoucherID,
    v.VoucherNo,
    v.Status AS VoucherStatus
FROM FdTransactions t
LEFT JOIN Vouchers v ON t.VoucherID = v.VoucherID
WHERE t.FdAccountID IN (
    SELECT FdAccountID FROM FdAccounts 
    WHERE LegacyAccountNumber = '1455' OR AccountNo LIKE '%1455%'
) AND (t.TransactionType = 'Payout' OR t.TransactionType = 'Premature_Close');

PRINT '----------------------------------------------------------------------';
PRINT 'पायरी ३: मुदत ठेव खाते क्र. 1455 ची स्थिती Matured / Active पूर्ववत करत आहे...';
PRINT '----------------------------------------------------------------------';

UPDATE f
SET 
    f.Status = CASE 
        WHEN f.MaturityDate <= CAST(GETDATE() AS DATE) THEN 'Matured' 
        ELSE 'Active' 
    END,
    f.Remarks = CASE 
        WHEN CHARINDEX(' | बंद दिनांक:', f.Remarks) > 0 
        THEN SUBSTRING(f.Remarks, 1, CHARINDEX(' | बंद दिनांक:', f.Remarks) - 1) + ' | [Reopened ' + CONVERT(VARCHAR(10), GETDATE(), 120) + '] व्हाउचर डिलीट झाल्याने खाते पूर्ववत केले'
        ELSE ISNULL(f.Remarks, '') + ' | [Reopened ' + CONVERT(VARCHAR(10), GETDATE(), 120) + '] खाते पूर्ववत केले'
    END,
    f.ModifiedDate = GETDATE()
FROM FdAccounts f
WHERE (f.LegacyAccountNumber = '1455' OR f.AccountNo LIKE '%1455%')
  AND f.Status = 'Closed';

PRINT '----------------------------------------------------------------------';
PRINT 'पायरी ४: अद्ययावत स्थिती पडताळणी (Verification):';
PRINT '----------------------------------------------------------------------';

SELECT 
    f.FdAccountID,
    f.AccountNo,
    f.LegacyAccountNumber,
    f.Status AS NewStatus,
    f.DepositAmount,
    f.MaturityDate,
    f.Remarks
FROM FdAccounts f
WHERE f.LegacyAccountNumber = '1455' 
   OR f.AccountNo LIKE '%1455%';

PRINT '----------------------------------------------------------------------';
PRINT 'मुदत ठेव खाते क्र. 1455 यशस्वीरीत्या पूर्ववत (Reopened) झाले!';
PRINT '----------------------------------------------------------------------';
GO

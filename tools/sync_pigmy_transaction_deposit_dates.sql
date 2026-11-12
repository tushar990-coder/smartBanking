-- ==============================================================================
-- PIGMY TRANSACTION DATE & DEPOSIT DATE SYNCHRONIZATION SCRIPT
-- ==============================================================================
-- 1. Vasuli Dinank (वसुली दिनांक / Collection Date / Value Date):
--    The date when agent collected money from customer (PigmyCollection.CollectionDate).
-- 2. Vyavahar Dinank (व्यवहार दिनांक / Branch Remittance / Deposit Date):
--    The date when cash was remitted at branch on Agent Day Book (Voucher.VoucherDate).
--
-- This script synchronizes existing PigmyTransactions that are linked to branch
-- Day Book remittance vouchers so that:
--   pt.TransactionDate = v.VoucherDate  (व्यवहार दिनांक / शाखेत भरणा दिनांक)
--   pt.ReferenceId     = v.VoucherNo    (शाखा व्हाउचर क्र.)
-- ==============================================================================

SET NOCOUNT ON;

PRINT 'Starting Pigmy Transaction Date & Voucher Sync...';

UPDATE pt
SET pt.TransactionDate = v.VoucherDate,
    pt.ReferenceId = v.VoucherNo
FROM PigmyTransactions pt
JOIN PigmyCollections c ON c.PigmyAccountId = pt.PigmyAccountID 
    AND (pt.Narration LIKE '%' + c.ReceiptNo + '%' OR (pt.ValueDate = c.CollectionDate AND pt.CrAmount = c.CollectionAmount AND pt.TransactionType = 'DEPOSIT'))
JOIN Vouchers v ON v.VoucherID = c.VoucherId
WHERE pt.TransactionDate != v.VoucherDate 
   OR pt.ReferenceId IS NULL 
   OR pt.ReferenceId != v.VoucherNo;

PRINT 'Updated ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' Pigmy transaction rows with branch deposit date & voucher numbers.';
PRINT 'Synchronization completed successfully.';


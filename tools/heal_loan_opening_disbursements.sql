-- ==============================================================================
-- HEALING SCRIPT: Fix LoanDisbursement amounts for Opening Balance loans
-- Issue #8: Set DisbursementAmount = SanctionedAmount & NetAmountPaid = SanctionedAmount
-- ==============================================================================

SET NOCOUNT ON;

PRINT 'Beginning healing of LoanDisbursements for Opening Balance loans...';

-- 1. Preview mismatched records before updating
SELECT 
    ld.LoanDisbursementID,
    ld.LoanAccountID,
    la.LoanAccountNo,
    la.SanctionedAmount AS AccountSanctionedAmount,
    ld.SanctionedAmount AS DisbSanctionedAmount,
    ld.DisbursementAmount AS OldDisbursementAmount,
    ld.NetAmountPaid AS OldNetAmountPaid,
    la.PrincipalBalance AS AccountPrincipalBalance
FROM [LoanDisbursements] ld
INNER JOIN [LoanAccounts] la ON ld.LoanAccountID = la.LoanAccountID
WHERE (ld.PaymentMode = 'Opening Balance' OR ld.Remarks LIKE '%Opening Balance%')
  AND la.IsOpeningBalance = 1
  AND (ld.DisbursementAmount <> la.SanctionedAmount OR ld.NetAmountPaid <> la.SanctionedAmount OR ld.SanctionedAmount <> la.SanctionedAmount);

-- 2. Execute healing update
UPDATE ld
SET ld.SanctionedAmount = la.SanctionedAmount,
    ld.DisbursementAmount = la.SanctionedAmount,
    ld.NetAmountPaid = la.SanctionedAmount
FROM [LoanDisbursements] ld
INNER JOIN [LoanAccounts] la ON ld.LoanAccountID = la.LoanAccountID
WHERE (ld.PaymentMode = 'Opening Balance' OR ld.Remarks LIKE '%Opening Balance%')
  AND la.IsOpeningBalance = 1
  AND (ld.DisbursementAmount <> la.SanctionedAmount OR ld.NetAmountPaid <> la.SanctionedAmount OR ld.SanctionedAmount <> la.SanctionedAmount);

DECLARE @UpdatedCount INT = @@ROWCOUNT;
PRINT CONCAT('Successfully healed ', @UpdatedCount, ' opening balance disbursement records.');

-- =====================================================================================
-- Auto-Heal Corrupted FD Opening Balance Voucher Narrations (Unicode Restoration)
-- Fixes ??? ??? ?????? into clean Marathi: 'मुदत ठेव आरंभिक शिल्लक स्थलांतर...'
-- =====================================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

PRINT 'Starting Unicode restoration for FD Opening Balance Voucher Narrations...';

DECLARE @HealedCount INT = 0;

-- 1. Via FdTransactions Link
UPDATE v
SET v.Narration = N'मुदत ठेव आरंभिक शिल्लक स्थलांतर (FD Opening Balance Migration): ' 
                  + f.AccountNo 
                  + CASE 
                        WHEN f.LegacyAccountNumber IS NOT NULL AND LTRIM(RTRIM(f.LegacyAccountNumber)) <> '' 
                        THEN N' (जुना पावती क्र. ' + LTRIM(RTRIM(f.LegacyAccountNumber)) + N')' 
                        ELSE N'' 
                    END
FROM Vouchers v
INNER JOIN FdTransactions t ON t.VoucherID = v.VoucherID
INNER JOIN FdAccounts f ON f.FdAccountID = t.FdAccountID
WHERE (v.VoucherNo LIKE 'JV-FD-OP-%' OR t.TransactionType = 'Opening' OR v.Narration LIKE '%FD Opening Balance Migration%')
  AND (v.Narration LIKE '%?%' OR v.Narration IS NULL OR v.Narration = '');

SET @HealedCount = @@ROWCOUNT;

-- 2. Via VoucherNo Match
UPDATE v
SET v.Narration = N'मुदत ठेव आरंभिक शिल्लक स्थलांतर (FD Opening Balance Migration): ' 
                  + f.AccountNo 
                  + CASE 
                        WHEN f.LegacyAccountNumber IS NOT NULL AND LTRIM(RTRIM(f.LegacyAccountNumber)) <> '' 
                        THEN N' (जुना पावती क्र. ' + LTRIM(RTRIM(f.LegacyAccountNumber)) + N')' 
                        ELSE N'' 
                    END
FROM Vouchers v
INNER JOIN FdAccounts f ON v.VoucherNo = ('JV-FD-OP-' + f.AccountNo)
WHERE (v.Narration LIKE N'%????%' OR v.Narration IS NULL OR v.Narration = '');

SET @HealedCount = @HealedCount + @@ROWCOUNT;

PRINT '✅ Successfully healed ' + CAST(@HealedCount AS VARCHAR(10)) + ' corrupted FD voucher narrations to clean Unicode Marathi.';

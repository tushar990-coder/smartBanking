IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'LoanCollections') AND name = 'ReceivableInterestCollected')
BEGIN
    ALTER TABLE LoanCollections ADD ReceivableInterestCollected DECIMAL(18, 2) NOT NULL DEFAULT (0.00);
    PRINT 'Added to ' + DB_NAME();
END
ELSE
BEGIN
    PRINT 'Already exists in ' + DB_NAME();
END
GO

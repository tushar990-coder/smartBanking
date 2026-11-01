-- =========================================================================
-- PADVALWADI CBS: DELETE ORPHANED FD ACCOUNT 00140100008444 (जुना क्र. 1)
-- Database: SmartBanking_padvalwadi
-- Institution: Padvalwadi (पडवळवाडी नागरी सहकारी पतसंस्था मर्या.)
-- Target Account: 00140100008444 | शामराव सुर्वे (CIF000001) | ठेव: ₹ 100 | 01/05/2026
-- =========================================================================

USE SmartBanking_padvalwadi;
GO

SET NOCOUNT ON;
BEGIN TRANSACTION;

BEGIN TRY
    DECLARE @FdAccountID INT;
    DECLARE @AccountNo NVARCHAR(50) = '00140100008444';
    DECLARE @LegacyNo NVARCHAR(50) = '1';
    DECLARE @DepositAmount DECIMAL(18,2);
    DECLARE @SavingAccountID INT;
    DECLARE @BranchID INT;
    DECLARE @CustomerID INT;

    -- १. लक्ष्य मुदत ठेव खाते शोधणे
    SELECT 
        @FdAccountID = FdAccountID,
        @DepositAmount = DepositAmount,
        @SavingAccountID = SavingAccountID,
        @BranchID = BranchID,
        @CustomerID = CustomerID
    FROM FdAccounts
    WHERE AccountNo = @AccountNo 
       OR (LegacyAccountNumber = @LegacyNo AND DepositAmount = 100.00);

    IF @FdAccountID IS NULL
    BEGIN
        PRINT N'⚠️ मुदत ठेव खाते क्र. 00140100008444 डेटाबेसमध्ये आढळले नाही किंवा आधीच हटवले गेले आहे.';
        ROLLBACK TRANSACTION;
        RETURN;
    END

    PRINT N'✅ सापडलेले FD खाते ID: ' + CAST(@FdAccountID AS NVARCHAR(20)) 
        + N' | पावती क्र: ' + @AccountNo 
        + N' | रक्कम: ₹' + CAST(@DepositAmount AS NVARCHAR(20));

    -- २. सुरक्षा तपासणी: सदर खात्यावर कर्जाचा थेट तारण बोजा (Lien/Collateral) आहे का?
    IF EXISTS (SELECT 1 FROM LoanDepositCollaterals WHERE CollateralType = 'FixedDeposit' AND DepositAccountID = @FdAccountID)
       OR EXISTS (SELECT 1 FROM FdAccounts WHERE FdAccountID = @FdAccountID AND IsLienMarked = 1)
    BEGIN
        RAISERROR(N'सदर खात्यावर कर्जाचा तारण बोजा (Lien) असल्यामुळे हे खाते डिलीट करता येणार नाही.', 16, 1);
    END

    -- ३. संबंधित मुदत ठेव व्यवहार (FdTransactions) डिलीट करणे
    DELETE FROM FdTransactions WHERE FdAccountID = @FdAccountID;
    PRINT N'✅ FdTransactions रेकॉर्ड्स हटवले.';

    -- ४. संबंधित व्याज तरतूद (Accruals), मासिक व्याज परतावा (MIS) व ऑटो-रिन्यूव्हल लॉग्स हटवणे
    DELETE FROM FdInterestAccruals WHERE FdAccountID = @FdAccountID;
    DELETE FROM FdMisPayouts WHERE FdAccountID = @FdAccountID;
    DELETE FROM FdAutoRenewalLogs WHERE OldFdAccountID = @FdAccountID OR NewFdAccountID = @FdAccountID;
    PRINT N'✅ FdInterestAccruals / MIS / Renewal Logs तपासले व हटवले.';

    -- ५. पास व्हाउचरमधील शिल्लक अनाथ व्हाउचर / व्हाउचर्स डिटेल्स हटवणे (असल्यास)
    DECLARE @VoucherIDs TABLE (VoucherID INT);
    INSERT INTO @VoucherIDs (VoucherID)
    SELECT VoucherID FROM Vouchers 
    WHERE VoucherNo IN ('JV-FD-' + @AccountNo, 'REC-FD-' + @AccountNo, 'JV-FD-OP-' + @AccountNo, 'REC-FD-OP-' + @AccountNo)
       OR (Narration LIKE '%' + @AccountNo + '%');

    IF EXISTS (SELECT 1 FROM @VoucherIDs)
    BEGIN
        DELETE FROM VoucherDetails WHERE VoucherID IN (SELECT VoucherID FROM @VoucherIDs);
        DELETE FROM Vouchers WHERE VoucherID IN (SELECT VoucherID FROM @VoucherIDs);
        PRINT N'✅ संबंधित शिल्लक व्हाउचर्स व व्हाउचर्स डिटेल्स हटवले.';
    END
    ELSE
    BEGIN
        PRINT N'ℹ️ संबंधित कोणतेही प्रलंबित व्हाउचर शिल्लक नव्हते (आधीच डिलीट झाले होते).';
    END

    -- ६. बचत खात्यातील वर्ग व्यवहार (Saving Transfer) तपासणी व परतावा
    -- जर बचत खात्यातून ₹ १०० डेबिट झाले असतील आणि व्हाउचर डिलीट करताना रिफंड झाले नसतील तर रिफंड करणे
    IF @SavingAccountID IS NOT NULL AND @SavingAccountID > 0
    BEGIN
        DECLARE @SbTxnID INT;
        SELECT TOP 1 @SbTxnID = TransactionID 
        FROM SavingTransactions
        WHERE SavingAccountID = @SavingAccountID 
          AND (Narration LIKE '%' + @AccountNo + '%' OR VoucherNo = 'JV-FD-' + @AccountNo)
          AND TransactionType = 'Withdrawal';

        IF @SbTxnID IS NOT NULL
        BEGIN
            DELETE FROM SavingPassbooks WHERE TransactionID = @SbTxnID;
            DELETE FROM SavingTransactions WHERE TransactionID = @SbTxnID;
            UPDATE SavingAccountMasters 
            SET CurrentBalance = CurrentBalance + @DepositAmount
            WHERE SavingAccountID = @SavingAccountID;
            PRINT N'✅ शामराव सुर्वे यांच्या बचत खात्यातील ₹' + CAST(@DepositAmount AS NVARCHAR(20)) + N' शिल्लक पूर्ववत (Refund) केली.';
        END
        ELSE
        BEGIN
            PRINT N'ℹ️ बचत खात्यातील व्यवहार आधीच पूर्ववत (Reversed) झालेला होता.';
        END
    END

    -- ७. मूळ मुदत ठेव खाते (FdAccount) नष्ट करणे
    DELETE FROM FdAccounts WHERE FdAccountID = @FdAccountID;
    PRINT N'✅ FdAccount क्र. 00140100008444 (जुना क्र. 1) डेटाबेसमधून यशस्वीरीत्या नष्ट केले.';

    -- ८. पावती अनुक्रमांक (Account Sequence Counter) सिंक करणे
    DECLARE @MaxRemainingSeq INT = 0;
    SELECT @MaxRemainingSeq = ISNULL(MAX(
        TRY_CAST(SUBSTRING(REPLACE(AccountNo, '-', ''), 7, 7) AS INT)
    ), 0)
    FROM FdAccounts
    WHERE BranchID = @BranchID AND LEN(REPLACE(AccountNo, '-', '')) = 14;

    UPDATE FdAccountSequences 
    SET CurrentValue = @MaxRemainingSeq,
        LastSequenceNumber = @MaxRemainingSeq,
        UpdatedOn = GETDATE()
    WHERE BranchID = @BranchID AND ProductType = 'FD';
    PRINT N'✅ FD अनुक्रमांक सिंक झाला -> नवीन कमाल मूल्य: ' + CAST(@MaxRemainingSeq AS NVARCHAR(20));

    -- ९. ऑडिट लॉग नोंदवणे
    INSERT INTO AuditLogs (UserID, Username, Action, EntityName, EntityID, Details, Timestamp)
    VALUES (1, 'Admin', 'FD_ACCOUNT_MANUAL_PURGE', 'FdAccount', @AccountNo, 
            N'अनाथ मुदत ठेव खाते क्र. ' + @AccountNo + N' (जुना क्र: ' + @LegacyNo + N', रक्कम: ₹' + CAST(@DepositAmount AS NVARCHAR(20)) + N') पडवळवाडी डेटाबेसमधून पूर्णपणे सुरक्षित डिलीट केले.', GETDATE());

    COMMIT TRANSACTION;
    PRINT N'🎉 पडवळवाडी संस्था: मुदत ठेव खाते 00140100008444 यशस्वीरीत्या व सुरक्षितरीत्या हटवले (COMMIT TRANSACTION).';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT N'❌ त्रुटी आढळल्यामुळे सर्व बदल पूर्ववत (ROLLBACK) करण्यात आले: ' + ERROR_MESSAGE();
END CATCH;
GO


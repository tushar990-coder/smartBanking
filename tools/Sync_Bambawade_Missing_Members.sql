-- =========================================================================================
-- SCRIPT: Sync All Missing Customers (322 to 666) to Members in SmartBanking_Bambawade
-- =========================================================================================

SET NOCOUNT ON;
PRINT 'Starting Customer to Member synchronization for: ' + DB_NAME();

IF OBJECT_ID('Customers', 'U') IS NOT NULL AND OBJECT_ID('Members', 'U') IS NOT NULL
BEGIN
    DECLARE @MaxExistingCodeNum INT = 0;
    SELECT @MaxExistingCodeNum = ISNULL(MAX(CAST(SUBSTRING(MemberCode, 4, 10) AS INT)), 0)
    FROM Members
    WHERE MemberCode LIKE 'MEM%' AND ISNUMERIC(SUBSTRING(MemberCode, 4, 10)) = 1;

    PRINT 'Current Max MemberCode Num: ' + CAST(@MaxExistingCodeNum AS VARCHAR(20));

    ;WITH MissingCustList AS (
        SELECT 
            c.CustomerID,
            c.BranchID,
            c.CIFNo,
            c.LegacyCustomerNo,
            c.FirstName,
            c.MiddleName,
            c.LastName,
            c.NickName,
            c.FirstNameEng,
            c.MiddleNameEng,
            c.LastNameEng,
            c.Address,
            c.AddressEng,
            c.Village,
            c.Taluka,
            c.District,
            c.MobileNo,
            c.AadhaarNo,
            c.PANNo,
            c.Gender,
            c.BirthDate,
            c.Occupation,
            c.CasteCategory,
            c.Caste,
            c.Email,
            c.PhotoPath,
            c.SignaturePath,
            c.AadhaarDocPath,
            c.PanDocPath,
            c.NomineeName,
            c.NomineeRelation,
            c.NomineeAddress,
            c.NomineeBirthDate,
            c.NomineeIsMinor,
            c.NomineeGuardianName,
            c.IsMinor,
            c.GuardianName,
            c.GuardianRelation,
            c.GuardianMobileNo,
            c.GuardianAadhaarNo,
            c.GuardianAddress,
            c.GuardianNameEng,
            c.NomineeNameEng,
            c.EmployerId,
            c.Status,
            c.CreatedBy,
            c.CreatedOn,
            c.UpdatedBy,
            c.UpdatedOn,
            c.IsDeleted,
            ROW_NUMBER() OVER (ORDER BY c.CustomerID) AS RowNum
        FROM Customers c
        LEFT JOIN Members m ON c.CustomerID = m.CustomerID
        WHERE m.MemberID IS NULL
    )
    INSERT INTO Members (
        BranchID, CustomerID, CIFNo, MemberCode, OldMemberCode, LegacyMemberNo,
        FirstName, MiddleName, LastName, NickName, FirstNameEng, MiddleNameEng, LastNameEng,
        Address, AddressEng, Village, Taluka, District, MobileNo, AadhaarNo, PANNo,
        Gender, BirthDate, Occupation, CasteCategory, Caste, Email,
        PhotoPath, SignaturePath, AadhaarDocPath, PanDocPath,
        NomineeName, NomineeRelation, NomineeAddress, NomineeBirthDate, NomineeIsMinor, NomineeGuardianName,
        IsMinor, GuardianName, GuardianRelation, GuardianMobileNo, GuardianAadhaarNo, GuardianAddress, GuardianNameEng, NomineeNameEng,
        EmployerId, MembershipType, JoiningDate, Status, CreatedBy, CreatedOn, UpdatedBy, UpdatedOn, IsDeleted
    )
    SELECT 
        BranchID, CustomerID, CIFNo,
        'MEM' + RIGHT('0000' + CAST((@MaxExistingCodeNum + RowNum) AS VARCHAR(10)), 4),
        LegacyCustomerNo, LegacyCustomerNo,
        FirstName, MiddleName, LastName, NickName, FirstNameEng, MiddleNameEng, LastNameEng,
        Address, AddressEng, Village, Taluka, District, MobileNo, AadhaarNo, PANNo,
        Gender, BirthDate, Occupation, CasteCategory, Caste, Email,
        PhotoPath, SignaturePath, AadhaarDocPath, PanDocPath,
        NomineeName, NomineeRelation, NomineeAddress, NomineeBirthDate, NomineeIsMinor, NomineeGuardianName,
        IsMinor, GuardianName, GuardianRelation, GuardianMobileNo, GuardianAadhaarNo, GuardianAddress, GuardianNameEng, NomineeNameEng,
        EmployerId, 'Regular', ISNULL(CreatedOn, GETDATE()), Status, CreatedBy, CreatedOn, UpdatedBy, UpdatedOn, IsDeleted
    FROM MissingCustList;

    PRINT 'SUCCESS: Synchronized ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' missing Customers into Members table!';
END
GO

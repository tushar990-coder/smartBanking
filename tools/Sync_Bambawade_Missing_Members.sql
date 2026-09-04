-- =========================================================================================
-- SCRIPT: Sync All Missing Customers (322 to 666) to Members in SmartBanking_Bambawade
-- NOTE: Pure Customers DO NOT receive a MemberCode until shares are allotted!
-- =========================================================================================

SET NOCOUNT ON;
PRINT 'Starting Customer to Member synchronization for: ' + DB_NAME();

IF OBJECT_ID('Customers', 'U') IS NOT NULL AND OBJECT_ID('Members', 'U') IS NOT NULL
BEGIN
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
            c.IsDeleted
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
        NULL, -- Pure Customer has NO MemberCode until Shares are allotted!
        LegacyCustomerNo, LegacyCustomerNo,
        FirstName, MiddleName, LastName, NickName, FirstNameEng, MiddleNameEng, LastNameEng,
        Address, AddressEng, Village, Taluka, District, MobileNo, AadhaarNo, PANNo,
        Gender, BirthDate, Occupation, CasteCategory, Caste, Email,
        PhotoPath, SignaturePath, AadhaarDocPath, PanDocPath,
        NomineeName, NomineeRelation, NomineeAddress, NomineeBirthDate, NomineeIsMinor, NomineeGuardianName,
        IsMinor, GuardianName, GuardianRelation, GuardianMobileNo, GuardianAadhaarNo, GuardianAddress, GuardianNameEng, NomineeNameEng,
        EmployerId, 'Nominal', ISNULL(CreatedOn, GETDATE()), Status, CreatedBy, CreatedOn, UpdatedBy, UpdatedOn, IsDeleted
    FROM MissingCustList;

    PRINT 'SUCCESS: Synchronized missing Customers into Members table with NULL MemberCode (Nominal)!';

    -- CRITICAL REPAIR: Reset MemberCode to NULL and MembershipType to Nominal for any Member who has NO active Share Account!
    UPDATE m
    SET m.[MemberCode] = NULL,
        m.[MembershipType] = 'Nominal'
    FROM [Members] m
    WHERE m.[MemberID] NOT IN (
        SELECT DISTINCT sa.[MemberId] 
        FROM [ShareAccounts] sa 
        WHERE sa.[TotalShareCount] > 0 
          AND sa.[IsDeleted] = 0
    )
    AND (m.[MemberCode] IS NOT NULL OR m.[MembershipType] = 'Regular');

    PRINT 'Repaired Members: Cleared MemberCode for all non-shareholders.';
END
GO

-- ==============================================================================
-- Audit & Healing Script: Auto-Heal Nominal Members Holding Active Share Capital
-- MCS Act 1960 / Cooperative Bye-Laws Compliance
-- Description:
--   According to Cooperative Law, any member holding share capital / share certificates
--   must be classified as 'Regular' (Class A Member). They cannot remain 'Nominal' (Class C).
--   This script audits and safely updates existing members who have shares.
-- ==============================================================================

PRINT '----------------------------------------------------------------------';
PRINT 'STEP 1: Diagnosing Nominal Members holding Share Accounts / Certificates...';
PRINT '----------------------------------------------------------------------';

SELECT 
    m.MemberID,
    m.MemberCode,
    m.MembershipType AS CurrentMembershipType,
    c.FirstName + ' ' + ISNULL(c.LastName, '') AS CustomerName,
    ISNULL(sa.TotalShareCount, 0) AS TotalSharesHeld,
    ISNULL(sa.TotalShareAmount, 0) AS TotalShareCapital
FROM Members m
LEFT JOIN Customers c ON m.CustomerID = c.CustomerID
LEFT JOIN ShareAccounts sa ON sa.MemberId = m.MemberID
WHERE m.MembershipType = 'Nominal'
  AND (
      ISNULL(sa.TotalShareCount, 0) > 0
      OR EXISTS (SELECT 1 FROM ShareCertificates sc WHERE sc.CustomerID = m.CustomerID OR sc.ShareAccountId = sa.ShareAccountId)
  );

DECLARE @AnomaliesCount INT;
SELECT @AnomaliesCount = COUNT(DISTINCT m.MemberID)
FROM Members m
LEFT JOIN ShareAccounts sa ON sa.MemberId = m.MemberID
WHERE m.MembershipType = 'Nominal'
  AND (
      ISNULL(sa.TotalShareCount, 0) > 0
      OR EXISTS (SELECT 1 FROM ShareCertificates sc WHERE sc.CustomerID = m.CustomerID OR sc.ShareAccountId = sa.ShareAccountId)
  );

PRINT 'Found ' + CAST(@AnomaliesCount AS VARCHAR(10)) + ' members with Nominal status holding shares.';

IF @AnomaliesCount > 0
BEGIN
    PRINT '----------------------------------------------------------------------';
    PRINT 'STEP 2: Upgrading Nominal Members with Shareholding to "Regular"...';
    PRINT '----------------------------------------------------------------------';

    UPDATE m
    SET m.MembershipType = 'Regular'
    FROM Members m
    LEFT JOIN ShareAccounts sa ON sa.MemberId = m.MemberID
    WHERE m.MembershipType = 'Nominal'
      AND (
          ISNULL(sa.TotalShareCount, 0) > 0
          OR EXISTS (SELECT 1 FROM ShareCertificates sc WHERE sc.CustomerID = m.CustomerID OR sc.ShareAccountId = sa.ShareAccountId)
      );

    PRINT 'Successfully updated ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' members to Regular (Class A).';
END
ELSE
BEGIN
    PRINT 'No anomalies found. All shareholding members are properly classified as Regular.';
END

PRINT '----------------------------------------------------------------------';
PRINT 'STEP 3: Verification Check...';
PRINT '----------------------------------------------------------------------';

SELECT COUNT(*) AS RemainingNominalShareholders
FROM Members m
LEFT JOIN ShareAccounts sa ON sa.MemberId = m.MemberID
WHERE m.MembershipType = 'Nominal'
  AND (
      ISNULL(sa.TotalShareCount, 0) > 0
      OR EXISTS (SELECT 1 FROM ShareCertificates sc WHERE sc.CustomerID = m.CustomerID OR sc.ShareAccountId = sa.ShareAccountId)
  );

PRINT 'Audit & Healing Completed Successfully!';

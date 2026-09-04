using System;
using System.Collections.Generic;

namespace Bhisi.Api.Helpers
{
    public class LicensePayload
    {
        public string LicenseType { get; set; } = "OFFLINE_NODE"; // "OFFLINE_NODE", "ONLINE_VPS", "HYBRID"
        public string ClientName { get; set; } = string.Empty;
        public string SansthaName { get; set; } = string.Empty;
        public string SansthaRegistrationNo { get; set; } = string.Empty;
        public string MachineCode { get; set; } = string.Empty;
        public List<string> AllowedDomains { get; set; } = new();
        public DateTime IssuedDate { get; set; }
        public DateTime ExpiryDate { get; set; }
        public int MaxBranches { get; set; } = 1;
        public string PlanName { get; set; } = "SmartBanking-Enterprise";
        public List<string> EnabledFeatures { get; set; } = new();
    }

    public class SignedLicense
    {
        public string PayloadJson { get; set; } = string.Empty;
        public string Signature { get; set; } = string.Empty;
    }

    public class LicenseStatusDto
    {
        public bool IsValid { get; set; }
        public string StatusCode { get; set; } = "NOT_FOUND"; // ACTIVE, EXPIRED, MACHINE_MISMATCH, TAMPERED, NOT_FOUND, CLOCK_TAMPERED, ACTIVE_ONLINE_WILDCARD
        public string Message { get; set; } = string.Empty;
        public string MachineCode { get; set; } = string.Empty;
        public string? LicenseType { get; set; }
        public string? ClientName { get; set; }
        public string? SansthaName { get; set; }
        public string? ActiveDomain { get; set; }
        public DateTime? IssuedDate { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public int DaysRemaining { get; set; }
        public string? PlanName { get; set; }
        public List<string> EnabledFeatures { get; set; } = new();
    }

    public class ActivateLicenseRequest
    {
        public string LicenseContent { get; set; } = string.Empty;
    }
}


using System;
using System.Security.Claims;

namespace Bhisi.Api.Helpers
{
    public static class UserContextExtensions
    {
        /// <summary>
        /// Determines whether the authenticated user has Head Office or Administrative privileges across branches.
        /// STRICT CBS RULE: Privilege is based on user ROLE, NEVER on operating BranchID == 1.
        /// </summary>
        public static bool IsHeadOfficeAdmin(this ClaimsPrincipal? user)
        {
            if (user == null) return false;

            var roleClaim = user.FindFirst(ClaimTypes.Role)?.Value 
                            ?? user.FindFirst("Role")?.Value 
                            ?? user.FindFirst("role")?.Value;

            if (string.IsNullOrWhiteSpace(roleClaim)) return false;

            return roleClaim.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("HeadOffice", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("HO_Manager", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("HO Manager", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("Auditor", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("GeneralManager", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("CEO", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("SystemAdmin", StringComparison.OrdinalIgnoreCase) ||
                   roleClaim.Equals("Chairman", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Extracts the authenticated user's operating BranchID from the JWT token claims.
        /// </summary>
        public static int GetOperatingBranchId(this ClaimsPrincipal? user)
        {
            if (user == null) return 1;

            var branchClaim = user.FindFirst("BranchID")?.Value 
                              ?? user.FindFirst("branchId")?.Value 
                              ?? user.FindFirst("branch")?.Value;

            if (!string.IsNullOrEmpty(branchClaim) && int.TryParse(branchClaim, out int bid) && bid > 0)
            {
                return bid;
            }

            return 1;
        }

        /// <summary>
        /// Resolves the effective BranchID for a request.
        /// If user is Head Office Admin and requests a specific branch, that branch is permitted.
        /// Otherwise, branch operator is strictly locked to their operating BranchID.
        /// </summary>
        public static int ResolveBranchId(this ClaimsPrincipal? user, int? requestedBranchId)
        {
            return user.ResolveRequiredBranchId(requestedBranchId);
        }

        /// <summary>
        /// Resolves optional BranchID for filtering reports/queries.
        /// If user is Head Office Admin: allows null (Consolidated / All Branches) or a specific branch.
        /// If user is a branch operator: strictly forces their operating BranchID, preventing data leaks.
        /// </summary>
        public static int? ResolveOptionalBranchId(this ClaimsPrincipal? user, int? requestedBranchId)
        {
            if (user == null) return requestedBranchId;

            if (user.IsHeadOfficeAdmin())
            {
                // Head Office / Admin is allowed to view Consolidated (null) or a specific branch
                return requestedBranchId;
            }

            // Branch users are strictly locked to their assigned operating branch
            return user.GetOperatingBranchId();
        }

        /// <summary>
        /// Resolves required BranchID for transactional writes (e.g. creating vouchers, loans, accounts).
        /// If user is Head Office Admin and requests a specific valid branch, it is permitted.
        /// Otherwise, branch operator is strictly locked to their operating BranchID.
        /// </summary>
        public static int ResolveRequiredBranchId(this ClaimsPrincipal? user, int? requestedBranchId)
        {
            int operatingBranch = user.GetOperatingBranchId();

            if (user != null && user.IsHeadOfficeAdmin() && requestedBranchId.HasValue && requestedBranchId.Value > 0)
            {
                return requestedBranchId.Value;
            }

            return operatingBranch;
        }

        /// <summary>
        /// Validates whether the authenticated user has permission to read or modify a specific branch.
        /// </summary>
        public static bool CanAccessBranch(this ClaimsPrincipal? user, int targetBranchId)
        {
            if (user == null) return false;
            if (user.IsHeadOfficeAdmin()) return true;
            if (targetBranchId <= 0) return false;

            return user.GetOperatingBranchId() == targetBranchId;
        }

        /// <summary>
        /// Extracts UserID from Claims.
        /// </summary>
        public static int GetUserId(this ClaimsPrincipal? user)
        {
            if (user == null) return 1;

            var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                          ?? user.FindFirst("UserID")?.Value 
                          ?? user.FindFirst("sub")?.Value 
                          ?? user.FindFirst("id")?.Value;

            if (!string.IsNullOrEmpty(idClaim) && int.TryParse(idClaim, out int uid) && uid > 0)
            {
                return uid;
            }

            return 1;
        }

        /// <summary>
        /// Extracts Username from Claims.
        /// </summary>
        public static string GetUsername(this ClaimsPrincipal? user)
        {
            if (user == null) return "System";

            return user.FindFirst(ClaimTypes.Name)?.Value 
                   ?? user.FindFirst("Username")?.Value 
                   ?? "System";
        }
    }
}

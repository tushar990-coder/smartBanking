using System;
using System.Security.Claims;

namespace Bhisi.Api.Helpers
{
    public static class UserContextExtensions
    {
        /// <summary>
        /// Returns true if the role represents the highest-authority Super Administrator role.
        /// </summary>
        public static bool IsSuperAdminRole(string? roleName)
        {
            if (string.IsNullOrWhiteSpace(roleName)) return false;
            string trimmed = roleName.Trim();
            return trimmed.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("Super_Admin", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Returns true if the role represents an Administrator role (Admin / SystemAdmin).
        /// </summary>
        public static bool IsAdminRole(string? roleName)
        {
            if (string.IsNullOrWhiteSpace(roleName)) return false;
            string trimmed = roleName.Trim();
            return trimmed.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("SystemAdmin", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Normalizes Super Admin variants to canonical "SuperAdmin" for [Authorize(Roles = ...)] compatibility.
        /// </summary>
        public static string NormalizeRoleClaim(string? roleName)
        {
            if (string.IsNullOrWhiteSpace(roleName)) return "User";
            if (IsSuperAdminRole(roleName)) return "SuperAdmin";
            return roleName.Trim();
        }

        /// <summary>
        /// Determines whether the authenticated user holds the SuperAdmin role.
        /// </summary>
        public static bool IsSuperAdmin(this ClaimsPrincipal? user)
        {
            if (user == null) return false;
            return IsSuperAdminRole(user.GetUserRole());
        }

        /// <summary>
        /// Single Source of Truth for Head Office / Multi-Branch roles.
        /// Non-HO roles (Manager, BranchManager, Cashier, Clerk, Accountant, User, AGENT) are strictly locked to DefaultBranchID.
        /// </summary>
        public static bool IsHeadOfficeRole(string? roleName)
        {
            if (string.IsNullOrWhiteSpace(roleName)) return false;

            string trimmed = roleName.Trim();
            return trimmed.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("Super Admin", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("HeadOffice", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("HO_Manager", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("HO Manager", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("Auditor", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("GeneralManager", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("CEO", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("SystemAdmin", StringComparison.OrdinalIgnoreCase) ||
                   trimmed.Equals("Chairman", StringComparison.OrdinalIgnoreCase);
        }

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

            return IsHeadOfficeRole(roleClaim);
        }

        /// <summary>
        /// Returns true if the authenticated user is a branch-level operator locked to their DefaultBranchID.
        /// </summary>
        public static bool IsBranchLockedUser(this ClaimsPrincipal? user)
        {
            return user != null && !user.IsHeadOfficeAdmin();
        }

        /// <summary>
        /// Extracts the authenticated user's operating BranchID from the JWT token claims.
        /// </summary>
        public static int GetOperatingBranchId(this ClaimsPrincipal? user)
        {
            if (user == null) return 1;

            var branchClaim = user.FindFirst("BranchID")?.Value 
                              ?? user.FindFirst("branchId")?.Value 
                              ?? user.FindFirst("DefaultBranchID")?.Value
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

        /// <summary>
        /// Extracts User Role from Claims.
        /// </summary>
        public static string GetUserRole(this ClaimsPrincipal? user)
        {
            if (user == null) return string.Empty;

            return user.FindFirst(ClaimTypes.Role)?.Value 
                   ?? user.FindFirst("Role")?.Value 
                   ?? user.FindFirst("role")?.Value 
                   ?? string.Empty;
        }

        /// <summary>
        /// Checks whether the user has Manager, HeadOffice, or Admin authority.
        /// </summary>
        public static bool IsManagerOrAdmin(this ClaimsPrincipal? user)
        {
            if (user == null) return false;
            if (user.IsHeadOfficeAdmin()) return true;

            var role = user.GetUserRole();
            return role.Equals("Manager", StringComparison.OrdinalIgnoreCase) ||
                   role.Equals("BranchManager", StringComparison.OrdinalIgnoreCase) ||
                   role.Equals("Branch_Manager", StringComparison.OrdinalIgnoreCase);
        }
    }
}

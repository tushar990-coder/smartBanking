using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Core Banking Security Filter:
    /// Enforces strict branch isolation based on the authenticated user's JWT token claims.
    /// - If the user is a Head Office Admin / Auditor, requested branch parameters are respected.
    /// - If the user is a branch operator (Clerk/Cashier/Agent), parameters are forcibly locked
    ///   to their assigned token BranchID to prevent horizontal privilege escalation and data leaks.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class EnforceBranchScopeAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var user = context.HttpContext.User;
            if (user == null || user.Identity?.IsAuthenticated != true)
            {
                base.OnActionExecuting(context);
                return;
            }

            // Head Office Admins are allowed cross-branch and consolidated views
            if (user.IsHeadOfficeAdmin())
            {
                base.OnActionExecuting(context);
                return;
            }

            int operatingBranch = user.GetOperatingBranchId();

            // 1. Intercept standard query / route arguments
            string[] branchParamNames = { "branchId", "branchID", "targetBranchId", "targetBranchID" };
            foreach (var param in branchParamNames)
            {
                if (context.ActionArguments.ContainsKey(param))
                {
                    context.ActionArguments[param] = operatingBranch;
                }
            }

            // 2. Intercept complex model properties if passed in request body
            foreach (var arg in context.ActionArguments.Values)
            {
                if (arg != null && arg.GetType().IsClass && arg.GetType() != typeof(string))
                {
                    var prop = arg.GetType().GetProperty("BranchID") ?? arg.GetType().GetProperty("BranchId");
                    if (prop != null && prop.CanWrite && prop.PropertyType == typeof(int))
                    {
                        prop.SetValue(arg, operatingBranch);
                    }
                }
            }

            base.OnActionExecuting(context);
        }
    }
}

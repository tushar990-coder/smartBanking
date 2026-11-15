using System;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Marks a controller or action as intentionally handling its own cross-branch query logic
    /// (for example IBT pair views or HO system endpoints).
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class SkipBranchScopeAttribute : Attribute
    {
    }

    /// <summary>
    /// Core Banking Security Filter:
    /// Enforces strict branch isolation based on the authenticated user's JWT token claims.
    /// - If the user is a Head Office Admin / Auditor, requested branch parameters are respected.
    /// - If the user is a branch operator (Clerk/Cashier/Manager/Agent), parameters are forcibly locked
    ///   to their assigned token BranchID to prevent horizontal privilege escalation and data leaks.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class EnforceBranchScopeAttribute : ActionFilterAttribute
    {
        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var endpointMetadata = context.ActionDescriptor?.EndpointMetadata;
            if (endpointMetadata != null &&
                (endpointMetadata.OfType<SkipBranchScopeAttribute>().Any() ||
                 endpointMetadata.OfType<IAllowAnonymous>().Any()))
            {
                base.OnActionExecuting(context);
                return;
            }

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

            // 1. Intercept standard query / route arguments (both int and int?)
            string[] branchParamNames = { "branchId", "branchID", "targetBranchId", "targetBranchID", "queryBranchId", "operatingBranchId" };
            foreach (var param in branchParamNames)
            {
                if (context.ActionArguments.ContainsKey(param))
                {
                    context.ActionArguments[param] = operatingBranch;
                }
            }

            // 2. Intercept complex model properties (both int and int?) if passed in request body
            foreach (var arg in context.ActionArguments.Values)
            {
                if (arg != null && arg.GetType().IsClass && arg.GetType() != typeof(string))
                {
                    foreach (var propName in new[] { "BranchID", "BranchId" })
                    {
                        var prop = arg.GetType().GetProperty(propName);
                        if (prop != null && prop.CanWrite)
                        {
                            if (prop.PropertyType == typeof(int))
                            {
                                prop.SetValue(arg, operatingBranch);
                            }
                            else if (prop.PropertyType == typeof(int?))
                            {
                                prop.SetValue(arg, (int?)operatingBranch);
                            }
                        }
                    }
                }
            }

            base.OnActionExecuting(context);
        }
    }
}

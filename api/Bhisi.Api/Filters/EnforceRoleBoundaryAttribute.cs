using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Bhisi.Api.Filters
{
    /// <summary>
    /// Enforces strict controller/action boundaries for non-staff mobile roles (CUSTOMER and AGENT)
    /// so authenticated Pigmy Agents or Customers can never access internal CBS Staff/Admin endpoints.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class EnforceRoleBoundaryAttribute : ActionFilterAttribute
    {
        private static readonly HashSet<string> AgentAllowedControllers = new(StringComparer.OrdinalIgnoreCase)
        {
            "PigmyMobileApi",
            "PigmyApp",
            "Branches",
            "FinancialYears",
            "SansthaDetails",
            "SystemUpdate"
        };

        private static readonly Dictionary<string, HashSet<string>> AgentAllowedActions = new(StringComparer.OrdinalIgnoreCase)
        {
            ["PigmyAgents"] = new(StringComparer.OrdinalIgnoreCase) { "GetPigmyAgent", "GetAgentCustomers" },
            ["PigmyAccounts"] = new(StringComparer.OrdinalIgnoreCase) { "GetAccountsByAgent" },
            ["AgentCustomerRequests"] = new(StringComparer.OrdinalIgnoreCase) { "GetDropdownOptions", "PostAgentCustomerRequest" },
            ["Upload"] = new(StringComparer.OrdinalIgnoreCase) { "Upload" },
            ["Auth"] = new(StringComparer.OrdinalIgnoreCase) { "ChangePassword" }
        };

        public override void OnActionExecuting(ActionExecutingContext context)
        {
            var endpointMetadata = context.ActionDescriptor?.EndpointMetadata;
            if (endpointMetadata != null && endpointMetadata.OfType<IAllowAnonymous>().Any())
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

            var cad = context.ActionDescriptor as ControllerActionDescriptor;
            string controller = cad?.ControllerName ?? string.Empty;
            string action = cad?.ActionName ?? string.Empty;
            string role = user.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value ?? string.Empty;

            if (string.Equals(role, "CUSTOMER", StringComparison.OrdinalIgnoreCase))
            {
                bool allowed = string.Equals(controller, "CustomerPortal", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(controller, "SansthaDetails", StringComparison.OrdinalIgnoreCase)
                    || (string.Equals(controller, "Branches", StringComparison.OrdinalIgnoreCase) &&
                        context.HttpContext.Request.Method.Equals("GET", StringComparison.OrdinalIgnoreCase));

                if (!allowed)
                {
                    context.Result = new ForbidResult();
                    return;
                }
            }
            else if (string.Equals(role, "AGENT", StringComparison.OrdinalIgnoreCase))
            {
                bool allowed = AgentAllowedControllers.Contains(controller);
                if (!allowed && AgentAllowedActions.TryGetValue(controller, out var allowedActions))
                {
                    allowed = allowedActions.Contains(action);
                }

                if (!allowed)
                {
                    context.Result = new ForbidResult();
                    return;
                }
            }

            base.OnActionExecuting(context);
        }
    }
}

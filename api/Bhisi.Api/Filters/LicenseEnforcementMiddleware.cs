using System.Threading.Tasks;
using Bhisi.Api.Services;
using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace Bhisi.Api.Filters
{
    public class LicenseEnforcementMiddleware
    {
        private readonly RequestDelegate _next;

        public LicenseEnforcementMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, ILicenseService licenseService)
        {
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? "";

            // Whitelist static files, license activation, and login screen prerequisites
            if (path.StartsWith("/api/license") ||
                path.StartsWith("/api/auth") ||
                path.StartsWith("/api/branches") ||
                path.StartsWith("/api/financialyears") ||
                path.StartsWith("/api/sansthadetails") ||
                path.StartsWith("/swagger") ||
                path.EndsWith(".js") ||
                path.EndsWith(".css") ||
                path.EndsWith(".ico") ||
                path.EndsWith(".png") ||
                path.EndsWith(".jpg") ||
                path.EndsWith(".svg") ||
                path.EndsWith(".woff") ||
                path.EndsWith(".woff2") ||
                path.EndsWith(".ttf") ||
                path == "/" ||
                path == "/index.html" ||
                !path.StartsWith("/api/"))
            {
                await _next(context);
                return;
            }

            // For all other API requests, check license validity
            var licenseStatus = licenseService.GetLicenseStatus();
            if (!licenseStatus.IsValid)
            {
                context.Response.StatusCode = StatusCodes.Status423Locked; // 423 Locked
                context.Response.ContentType = "application/json";

                var errorResponse = new
                {
                    error = "LICENSE_REQUIRED",
                    message = licenseStatus.Message,
                    status = licenseStatus
                };

                await context.Response.WriteAsync(JsonSerializer.Serialize(errorResponse));
                return;
            }

            await _next(context);
        }
    }
}

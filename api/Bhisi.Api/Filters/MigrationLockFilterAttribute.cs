using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;
using Bhisi.Api.Data;

namespace Bhisi.Api.Filters
{
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public class MigrationLockFilterAttribute : ActionFilterAttribute
    {
        public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            var dbContext = context.HttpContext.RequestServices.GetService<AppDbContext>();
            if (dbContext != null)
            {
                var sanstha = dbContext.SansthaDetails.FirstOrDefault();
                if (sanstha != null && sanstha.IsMigrationLocked)
                {
                    context.Result = new ObjectResult(new { message = "Migration is locked. Opening balance entries cannot be added or modified." })
                    {
                        StatusCode = 403
                    };
                    return;
                }
            }

            await base.OnActionExecutionAsync(context, next);
        }
    }
}

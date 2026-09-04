using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using System.IO;

namespace Bhisi.Api.Data
{
    public class DesignDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            IConfigurationRoot configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: true)
                .AddEnvironmentVariables()
                .Build();

            var builder = new DbContextOptionsBuilder<AppDbContext>();
            var connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? "Server=.;Database=SmartBanking_Gurudev;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true";

            builder.UseSqlServer(connectionString, sqlOptions =>
                   {
                       sqlOptions.CommandTimeout(60);
                   })
                   .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));

            return new AppDbContext(builder.Options);
        }
    }
}

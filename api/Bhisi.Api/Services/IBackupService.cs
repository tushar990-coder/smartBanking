using System.Threading.Tasks;

namespace Bhisi.Api.Services
{
    public interface IBackupService
    {
        Task<string> GenerateDatabaseBackupAsync();
    }
}

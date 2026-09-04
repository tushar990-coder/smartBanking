using System.Threading.Tasks;
using Bhisi.Api.Helpers;

namespace Bhisi.Api.Services
{
    public interface ILicenseService
    {
        LicenseStatusDto GetLicenseStatus();
        Task<LicenseStatusDto> ActivateLicenseAsync(string licenseContent);
        string GetMachineCode();
    }
}

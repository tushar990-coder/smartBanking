using System.Threading.Tasks;

namespace Bhisi.Api.Services
{
    public class AgentLockStatusResult
    {
        public int AgentId { get; set; }
        public string Status { get; set; } = "ALLOWED"; // ALLOWED | LOCKED
        public decimal PendingCash { get; set; }
        public decimal MaxCashLimit { get; set; } = 20000.00m;
        public string Message { get; set; } = string.Empty;
        public bool IsLocked => Status == "LOCKED";
    }

    public interface IAgentLockService
    {
        Task<AgentLockStatusResult> GetLockStatusAsync(int agentId);
        Task<(bool IsAllowed, string? ErrorMessage)> ValidateCollectionAllowedAsync(int agentId, decimal incomingAmount, string paymentMode);
    }
}

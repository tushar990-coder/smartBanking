using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Bhisi.Api.Data;
using Bhisi.Api.Models;

namespace Bhisi.Api.Services
{
    public class AgentLockService : IAgentLockService
    {
        private readonly AppDbContext _context;

        public AgentLockService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<AgentLockStatusResult> GetLockStatusAsync(int agentId)
        {
            var agent = await _context.PigmyAgents.FirstOrDefaultAsync(a => a.PigmyAgentID == agentId);
            if (agent == null)
            {
                return new AgentLockStatusResult
                {
                    AgentId = agentId,
                    Status = "LOCKED",
                    PendingCash = 0,
                    MaxCashLimit = 20000m,
                    Message = "एजंट सापडला नाही (Agent not found)."
                };
            }

            if (agent.Status != "Active")
            {
                return new AgentLockStatusResult
                {
                    AgentId = agentId,
                    Status = "LOCKED",
                    PendingCash = 0,
                    MaxCashLimit = agent.MaxCashLimit > 0 ? agent.MaxCashLimit : 20000m,
                    Message = "एजंट खाते निष्क्रिय किंवा निलंबित आहे (Agent account is inactive/suspended)."
                };
            }

            decimal maxLimit = agent.MaxCashLimit > 0 ? agent.MaxCashLimit : 20000.00m;

            // 1. Total CASH collections by Agent (UPI payments do not count towards agent cash in hand)
            var totalCashCollected = await _context.PigmyCollections
                .Where(c => c.AgentId == agentId && (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"))
                .SumAsync(c => (decimal?)c.CollectionAmount) ?? 0m;

            // 2. Total Cash remitted to branch by Agent
            var totalCashRemitted = await _context.PigmyAgentCashDeposits
                .Where(d => d.AgentId == agentId)
                .SumAsync(d => (decimal?)d.Amount) ?? 0m;

            decimal pendingCash = totalCashCollected - totalCashRemitted;
            if (pendingCash < 0) pendingCash = 0m;

            bool isLocked = pendingCash > maxLimit;
            string message = isLocked
                ? $"Agent locked. Pending cash (₹{pendingCash:N2}) exceeds ₹{maxLimit:N2} limit. Please remit cash to branch."
                : "Agent active and allowed to collect.";

            // 3. Time Rule: Lock if there are pending cash collections older than MaxLockDays
            if (!isLocked && pendingCash > 0)
            {
                var lastDepositDate = await _context.PigmyAgentCashDeposits
                    .Where(d => d.AgentId == agentId)
                    .OrderByDescending(d => d.DepositDate)
                    .Select(d => (DateTime?)d.DepositDate)
                    .FirstOrDefaultAsync();

                var unremittedCollectionsQuery = _context.PigmyCollections
                    .Where(c => c.AgentId == agentId && (c.PaymentMode == null || c.PaymentMode == "" || c.PaymentMode.ToUpper() == "CASH"));

                if (lastDepositDate.HasValue)
                {
                    unremittedCollectionsQuery = unremittedCollectionsQuery.Where(c => c.CollectionDate > lastDepositDate.Value);
                }

                var oldestUnremittedCollectionDate = await unremittedCollectionsQuery
                    .OrderBy(c => c.CollectionDate)
                    .Select(c => (DateTime?)c.CollectionDate)
                    .FirstOrDefaultAsync();

                if (oldestUnremittedCollectionDate.HasValue)
                {
                    if ((DateTime.UtcNow - oldestUnremittedCollectionDate.Value).TotalDays >= agent.MaxLockDays)
                    {
                        isLocked = true;
                        message = $"Agent locked. You have pending cash collections older than {agent.MaxLockDays} days. Please remit pending cash (₹{pendingCash:N2}) to branch.";
                    }
                }
            }

            return new AgentLockStatusResult
            {
                AgentId = agentId,
                Status = isLocked ? "LOCKED" : "ALLOWED",
                PendingCash = pendingCash,
                MaxCashLimit = maxLimit,
                Message = message
            };
        }

        public async Task<(bool IsAllowed, string? ErrorMessage)> ValidateCollectionAllowedAsync(int agentId, decimal incomingAmount, string paymentMode)
        {
            // UPI collections bypass physical cash risk lock
            if (!string.IsNullOrWhiteSpace(paymentMode) && paymentMode.ToUpper() == "UPI")
            {
                return (true, null);
            }

            var lockStatus = await GetLockStatusAsync(agentId);
            if (lockStatus.IsLocked)
            {
                return (false, lockStatus.Message);
            }

            return (true, null);
        }
    }
}

using System;

namespace Bhisi.Api.Models
{
    /// <summary>
    /// Public projection for PigmyAgent that omits PasswordHash, Pin, and session tokens.
    /// </summary>
    public class PigmyAgentPublicDto
    {
        public int PigmyAgentID { get; set; }
        public string AgentName { get; set; } = string.Empty;
        public DateTime? JoiningDate { get; set; }
        public string Status { get; set; } = "Active";
        public int? BranchID { get; set; }
        public string? BranchName { get; set; }
        public int? CustomerID { get; set; }
        public string? MobileNo { get; set; }
        public decimal MaxCashLimit { get; set; }
        public int MaxLockDays { get; set; }
        public string? Username { get; set; }
        public bool IsLocked { get; set; }
        public DateTime CreatedDate { get; set; }

        public static PigmyAgentPublicDto FromEntity(PigmyAgent agent) => new PigmyAgentPublicDto
        {
            PigmyAgentID = agent.PigmyAgentID,
            AgentName = agent.AgentName,
            JoiningDate = agent.JoiningDate,
            Status = agent.Status,
            BranchID = agent.BranchID,
            BranchName = agent.Branch?.BranchName,
            CustomerID = agent.CustomerID,
            MobileNo = agent.Customer?.MobileNo,
            MaxCashLimit = agent.MaxCashLimit,
            MaxLockDays = agent.MaxLockDays,
            Username = agent.Username,
            IsLocked = agent.IsLocked,
            CreatedDate = agent.CreatedDate
        };
    }
}

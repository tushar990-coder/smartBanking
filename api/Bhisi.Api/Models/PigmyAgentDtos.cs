using System;

namespace Bhisi.Api.Models
{
    public class PigmyAgentBranchSummaryDto
    {
        public int BranchID { get; set; }
        public string BranchName { get; set; } = string.Empty;
    }

    public class PigmyAgentCustomerSummaryDto
    {
        public int CustomerID { get; set; }
        public string? MobileNo { get; set; }
    }

    /// <summary>
    /// Public projection for PigmyAgent that omits PasswordHash, Pin, and session tokens
    /// while remaining backward-compatible with nested branch/customer bindings in the web UI.
    /// </summary>
    public class PigmyAgentPublicDto
    {
        public int PigmyAgentID { get; set; }
        public string AgentName { get; set; } = string.Empty;
        public DateTime? JoiningDate { get; set; }
        public string Status { get; set; } = "Active";
        public int? BranchID { get; set; }
        public string? BranchName { get; set; }
        public PigmyAgentBranchSummaryDto? Branch { get; set; }
        public int? CustomerID { get; set; }
        public string? MobileNo { get; set; }
        public PigmyAgentCustomerSummaryDto? Customer { get; set; }
        public decimal MaxCashLimit { get; set; }
        public int MaxLockDays { get; set; }
        public string? Username { get; set; }
        public bool IsLocked { get; set; }
        public int FailedLoginAttempts { get; set; }
        public DateTime CreatedDate { get; set; }

        public static PigmyAgentPublicDto FromEntity(PigmyAgent agent) => new PigmyAgentPublicDto
        {
            PigmyAgentID = agent.PigmyAgentID,
            AgentName = agent.AgentName,
            JoiningDate = agent.JoiningDate,
            Status = agent.Status,
            BranchID = agent.BranchID,
            BranchName = agent.Branch?.BranchName,
            Branch = agent.Branch != null
                ? new PigmyAgentBranchSummaryDto { BranchID = agent.Branch.BranchID, BranchName = agent.Branch.BranchName }
                : null,
            CustomerID = agent.CustomerID,
            MobileNo = agent.Customer?.MobileNo,
            Customer = agent.Customer != null
                ? new PigmyAgentCustomerSummaryDto { CustomerID = agent.Customer.CustomerID, MobileNo = agent.Customer.MobileNo }
                : null,
            MaxCashLimit = agent.MaxCashLimit,
            MaxLockDays = agent.MaxLockDays,
            Username = agent.Username,
            IsLocked = agent.IsLocked,
            FailedLoginAttempts = agent.FailedLoginAttempts,
            CreatedDate = agent.CreatedDate
        };
    }

    /// <summary>
    /// Input DTO for creating/updating PigmyAgent from Web ERP so Password is accepted cleanly
    /// while PigmyAgent entity retains [JsonIgnore] on PasswordHash/Pin/Password/ActiveSessionToken.
    /// </summary>
    public class PigmyAgentUpsertDto
    {
        public int PigmyAgentID { get; set; }
        public string AgentName { get; set; } = string.Empty;
        public DateTime? JoiningDate { get; set; }
        public string Status { get; set; } = "Active";
        public int? BranchID { get; set; }
        public int? CustomerID { get; set; }
        public decimal MaxCashLimit { get; set; } = 20000;
        public int MaxLockDays { get; set; } = 2;
        public string? Username { get; set; }
        public string? Password { get; set; }
        public bool IsLocked { get; set; } = false;
    }
}

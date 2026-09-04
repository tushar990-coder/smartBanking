using System;
using System.Collections.Generic;

namespace Bhisi.Api.Models
{
    public class Member360Dto
    {
        public MemberInfoDto MemberInfo { get; set; } = new();
        public BalanceSummaryDto Balances { get; set; } = new();
        public PortfolioSummaryDto Portfolio { get; set; } = new();
        public List<RecentTransactionDto> RecentTransactions { get; set; } = new();
    }

    public class MemberInfoDto
    {
        public int? CustomerID { get; set; }
        public int MemberID { get; set; }
        public string MemberCode { get; set; } = string.Empty;
        public string? OldMemberCode { get; set; }
        public string? CIFNo { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string? MiddleName { get; set; }
        public string LastName { get; set; } = string.Empty;
        public string? NickName { get; set; }
        public string MobileNo { get; set; } = string.Empty;
        public string AadhaarNo { get; set; } = string.Empty;
        public string? PANNo { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public DateTime JoiningDate { get; set; }
        public string Status { get; set; } = "Active";
        public string? PhotoPath { get; set; }
    }

    public class BalanceSummaryDto
    {
        public decimal TotalDeposits { get; set; }
        public decimal TotalLoansOutstanding { get; set; }
        public decimal ShareCapital { get; set; }
    }

    public class PortfolioSummaryDto
    {
        public ProductSummaryDto Savings { get; set; } = new();
        public ProductSummaryDto FixedDeposits { get; set; } = new();
        public ProductSummaryDto RecurringDeposits { get; set; } = new();
        public ProductSummaryDto Pigmy { get; set; } = new();
        public ProductSummaryDto Loans { get; set; } = new();
        public ProductSummaryDto Shares { get; set; } = new();
    }

    public class ProductSummaryDto
    {
        public int Accounts { get; set; }
        public decimal Balance { get; set; }
        public string StatusColor { get; set; } = "Gray"; // Green, Yellow, Red, Gray
        public string? LastTxDate { get; set; }
        public string? FolioNo { get; set; } // Only for shares
    }

    public class RecentTransactionDto
    {
        public string Date { get; set; } = string.Empty;
        public string Module { get; set; } = string.Empty;
        public string TransactionType { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Branch { get; set; } = string.Empty;
        public string VoucherNo { get; set; } = string.Empty;
    }
}

using System;
using System.Collections.Generic;

namespace Bhisi.Api.Models
{
    public class IbtBranchItemDto
    {
        public int BranchID { get; set; }
        public string BranchCode { get; set; } = string.Empty;
        public string BranchName { get; set; } = string.Empty;
        public string BranchType { get; set; } = "Branch";
        public int? DefaultIbtLedgerID { get; set; }
        public string? DefaultIbtLedgerName { get; set; }
        public int? DefaultCashLedgerID { get; set; }
        public string? DefaultCashLedgerName { get; set; }
    }

    public class IbtMatrixCellDto
    {
        public int SourceBranchID { get; set; }
        public string SourceBranchName { get; set; } = string.Empty;
        public int TargetBranchID { get; set; }
        public string TargetBranchName { get; set; } = string.Empty;
        public decimal OpeningBalance { get; set; }
        public decimal DebitAmount { get; set; }
        public decimal CreditAmount { get; set; }
        public decimal NetMovement => DebitAmount - CreditAmount;
        public decimal ClosingBalance => OpeningBalance + NetMovement;
        public decimal ContraClosingBalance { get; set; }
        public decimal Difference => ClosingBalance + ContraClosingBalance;
        public bool IsTallied => Math.Abs(Difference) < 0.01m;
        public int TotalVouchersCount { get; set; }
    }

    public class IbtPairSummaryDto
    {
        public int BranchAId { get; set; }
        public string BranchAName { get; set; } = string.Empty;
        public string BranchACode { get; set; } = string.Empty;
        public int BranchBId { get; set; }
        public string BranchBName { get; set; } = string.Empty;
        public string BranchBCode { get; set; } = string.Empty;

        /// <summary>
        /// Net Position in Branch A's books towards Branch B (>0 is Dr / Receivable, <0 is Cr / Payable)
        /// </summary>
        public decimal BranchAPosition { get; set; }

        /// <summary>
        /// Net Position in Branch B's books towards Branch A (>0 is Dr / Receivable, <0 is Cr / Payable)
        /// </summary>
        public decimal BranchBPosition { get; set; }

        /// <summary>
        /// Contra Difference = BranchAPosition + BranchBPosition. In CBS, must equal 0.00!
        /// </summary>
        public decimal Difference => BranchAPosition + BranchBPosition;
        public bool IsTallied => Math.Abs(Difference) < 0.01m;
        public decimal TotalTurnover { get; set; }
        public int VoucherCount { get; set; }
    }

    public class IbtMatrixResponseDto
    {
        public int FinancialYearID { get; set; }
        public string FinancialYearCode { get; set; } = string.Empty;
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public List<IbtBranchItemDto> Branches { get; set; } = new();
        public List<IbtPairSummaryDto> Pairs { get; set; } = new();
        public List<IbtMatrixCellDto> MatrixCells { get; set; } = new();
        public decimal TotalInterBranchTurnover { get; set; }
        public int TotalVouchersCount { get; set; }
        public decimal TotalDiscrepancy { get; set; }
        public string OverallStatus { get; set; } = "ALL_TALLIED";
    }

    public class IbtVoucherRowDto
    {
        public int VoucherID { get; set; }
        public string VoucherNo { get; set; } = string.Empty;
        public DateTime VoucherDate { get; set; }
        public string VoucherType { get; set; } = string.Empty;
        public int BranchID { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int? TargetBranchID { get; set; }
        public string? TargetBranchName { get; set; }
        public int? RelatedVoucherID { get; set; }
        public string? RelatedVoucherNo { get; set; }
        public decimal Amount { get; set; }
        public string IbtDrCr { get; set; } = "Dr";
        public string Narration { get; set; } = string.Empty;
        public string? CustomerName { get; set; }
        public string? MemberNo { get; set; }
        public string Module { get; set; } = "GENERAL";
        public string Status { get; set; } = "Approved";
        public bool IsContraMatched { get; set; }
    }

    public class IbtPairStatementResponseDto
    {
        public IbtBranchItemDto BranchA { get; set; } = new();
        public IbtBranchItemDto BranchB { get; set; } = new();
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        public decimal OpeningBalanceInA { get; set; }
        public decimal OpeningBalanceInB { get; set; }
        public decimal TotalDebitInA { get; set; }
        public decimal TotalCreditInA { get; set; }
        public decimal TotalDebitInB { get; set; }
        public decimal TotalCreditInB { get; set; }
        public decimal ClosingBalanceInA { get; set; }
        public decimal ClosingBalanceInB { get; set; }
        public decimal Difference => ClosingBalanceInA + ClosingBalanceInB;
        public bool IsTallied => Math.Abs(Difference) < 0.01m;
        public List<IbtVoucherRowDto> Vouchers { get; set; } = new();
    }

    public class IbtUnreconciledVoucherItemDto
    {
        public int VoucherID { get; set; }
        public string VoucherNo { get; set; } = string.Empty;
        public DateTime VoucherDate { get; set; }
        public int BranchID { get; set; }
        public string BranchName { get; set; } = string.Empty;
        public int? TargetBranchID { get; set; }
        public string? TargetBranchName { get; set; }
        public decimal Amount { get; set; }
        public string DrCr { get; set; } = "Dr";
        public string Status { get; set; } = "Pending";
        public string Reason { get; set; } = string.Empty;
        public int? RelatedVoucherID { get; set; }
        public string? RelatedVoucherStatus { get; set; }
        public string Narration { get; set; } = string.Empty;
    }

    public class IbtUnreconciledResponseDto
    {
        public int TotalUnreconciled { get; set; }
        public decimal TotalDiscrepancyAmount { get; set; }
        public List<IbtUnreconciledVoucherItemDto> Vouchers { get; set; } = new();
    }

    public class IbtSettlementRequestDto
    {
        public int FromBranchID { get; set; }
        public int ToBranchID { get; set; }
        public DateTime SettlementDate { get; set; } = DateTime.Today;
        public decimal SettlementAmount { get; set; }
        public string PaymentMode { get; set; } = "Bank"; // "Bank" or "Cash"
        public int? BankLedgerID { get; set; }
        public int? FromBankLedgerID { get; set; }
        public int? ToBankLedgerID { get; set; }
        public string? Narration { get; set; }
        public int? CreatedBy { get; set; }
    }
}

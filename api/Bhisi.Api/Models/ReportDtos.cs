using System;
using System.Collections.Generic;

namespace Bhisi.Api.Models
{
    public class MemberBalanceReportDto
    {
        public int MemberId { get; set; }
        public string MemberCode { get; set; } = string.Empty;
        public string LegacyMemberNo { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public decimal Balance { get; set; }
        public string BalanceType { get; set; } = string.Empty; // "Dr" or "Cr"
    }

    public class TrialBalanceItemDto
    {
        public string LedgerName { get; set; } = string.Empty;
        public decimal OpeningBalance { get; set; }
        public string OpeningType { get; set; } = string.Empty; // "Dr" or "Cr"
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
        public decimal ClosingBalance { get; set; }
        public string ClosingType { get; set; } = string.Empty; // "Dr" or "Cr"
    }

    public class ReportNodeDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsGroup { get; set; }

        // For P&L and Balance Sheet
        public decimal Amount { get; set; }
        public decimal PreviousYearAmount { get; set; }

        // For Trial Balance
        public decimal OpeningBalance { get; set; }
        public string OpeningType { get; set; } = string.Empty;
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
        public decimal ClosingBalance { get; set; }
        public string ClosingType { get; set; } = string.Empty;

        public List<ReportNodeDto> Children { get; set; } = new();
    }

    public class ProfitAndLossDto
    {
        public List<ReportNodeDto> Expenses { get; set; } = new();
        public List<ReportNodeDto> Incomes { get; set; } = new();
        public decimal TotalExpense { get; set; }
        public decimal TotalIncome { get; set; }
        public decimal TotalPreviousYearExpense { get; set; }
        public decimal TotalPreviousYearIncome { get; set; }
        public decimal NetProfit { get; set; }
        public decimal NetLoss { get; set; }
        public decimal PreviousYearNetProfit { get; set; }
        public decimal PreviousYearNetLoss { get; set; }
        public string? PreviousYearLabel { get; set; }
        public string? CurrentYearLabel { get; set; }
    }

    public class BalanceSheetDto
    {
        public List<ReportNodeDto> Liabilities { get; set; } = new();
        public List<ReportNodeDto> Assets { get; set; } = new();
        public decimal TotalLiabilities { get; set; }
        public decimal TotalAssets { get; set; }
        public decimal TotalPreviousYearLiabilities { get; set; }
        public decimal TotalPreviousYearAssets { get; set; }
        public string? PreviousYearLabel { get; set; }
        public string? CurrentYearLabel { get; set; }
    }

    public class GeneralLedgerDto
    {
        public string LedgerName { get; set; } = string.Empty;
        public decimal OpeningBalance { get; set; }
        public string OpeningType { get; set; } = string.Empty;
        public List<GeneralLedgerTransactionDto> Transactions { get; set; } = new();
        public decimal TotalDebit { get; set; }
        public decimal TotalCredit { get; set; }
        public decimal ClosingBalance { get; set; }
        public string ClosingType { get; set; } = string.Empty;
    }

    public class GeneralLedgerTransactionDto
    {
        public DateTime Date { get; set; }
        public string VoucherNo { get; set; } = string.Empty;
        public string VoucherType { get; set; } = string.Empty;
        public string Narration { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal Balance { get; set; }
        public string BalanceType { get; set; } = string.Empty;
    }

    public class DaybookResponseDto
    {
        public decimal OpeningBalance { get; set; }
        public decimal ClosingBalance { get; set; }
        public List<DaybookGroupDto> Receipts { get; set; } = new List<DaybookGroupDto>();
        public List<DaybookGroupDto> Payments { get; set; } = new List<DaybookGroupDto>();
        public decimal TotalReceiptsCash { get; set; }
        public decimal TotalReceiptsTransfer { get; set; }
        public decimal TotalPaymentsCash { get; set; }
        public decimal TotalPaymentsTransfer { get; set; }
    }

    public class DaybookGroupDto
    {
        public int LedgerId { get; set; }
        public string LedgerName { get; set; } = string.Empty;
        public decimal TotalCash { get; set; }
        public decimal TotalTransfer { get; set; }
        public List<DaybookEntryDto> Entries { get; set; } = new List<DaybookEntryDto>();
    }

    public class DaybookEntryDto
    {
        public string VoucherNo { get; set; } = string.Empty;
        public string Narration { get; set; } = string.Empty;
        public decimal CashAmount { get; set; }
        public decimal TransferAmount { get; set; }
    }

    public class DaybookBatchResponseDto
    {
        public List<DaybookDayDto> Days { get; set; } = new();
    }

    public class DaybookDayDto
    {
        public string Date { get; set; } = string.Empty;
        public DaybookResponseDto Data { get; set; } = new();
    }

    public class CashBookResponseDto
    {
        public decimal OpeningBalance { get; set; }
        public string OpeningType { get; set; } = string.Empty;
        public decimal ClosingBalance { get; set; }
        public string ClosingType { get; set; } = string.Empty;
        public List<CashBookGroupDto> Receipts { get; set; } = new();
        public List<CashBookGroupDto> Payments { get; set; } = new();
        public decimal TotalReceipts { get; set; }
        public decimal TotalPayments { get; set; }
    }

    public class CashBookGroupDto
    {
        public int LedgerId { get; set; }
        public string LedgerName { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public List<CashBookEntryDto> Entries { get; set; } = new();
    }

    public class CashBookEntryDto
    {
        public string VoucherNo { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }

    public class CashBookBatchResponseDto
    {
        public List<CashBookDayDto> Days { get; set; } = new();
    }

    public class CashBookDayDto
    {
        public string Date { get; set; } = string.Empty;
        public CashBookResponseDto Data { get; set; } = new();
    }

    public class LoanDisbursementRegisterDto
    {
        public int LoanDisbursementID { get; set; }
        public DateTime DisbursementDate { get; set; }
        public string LoanAccountNo { get; set; } = string.Empty;
        public string CifNo { get; set; } = string.Empty;
        public string MemberCode { get; set; } = string.Empty;
        public string BorrowerName { get; set; } = string.Empty;
        public string LoanType { get; set; } = string.Empty;
        public decimal SanctionedAmount { get; set; }
        public decimal ShareDeduction { get; set; }
        public decimal DepositDeduction { get; set; }
        public decimal OtherDeductions { get; set; }
        public decimal NetAmountPaid { get; set; }
        public string Guarantor1Name { get; set; } = string.Empty;
        public string Guarantor2Name { get; set; } = string.Empty;
    }

    public class LoanCollectionRegisterDto
    {
        public int LoanCollectionID { get; set; }
        public DateTime CollectionDate { get; set; }
        public string ReceiptNo { get; set; } = string.Empty;
        public string LoanAccountNo { get; set; } = string.Empty;
        public string CifNo { get; set; } = string.Empty;
        public string MemberCode { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public string LoanType { get; set; } = string.Empty;
        public decimal PrincipalCollected { get; set; }
        public decimal InterestCollected { get; set; }
        public decimal PenaltyInterestCollected { get; set; }
        public decimal SurchargeCollected { get; set; }
        public decimal TotalAmountReceived { get; set; }
        public string PaymentMode { get; set; } = string.Empty;
    }

    public class LoanTrancheDetailDto
    {
        public int DisbursementID { get; set; }
        public DateTime DisbursementDate { get; set; }
        public decimal DisbursementAmount { get; set; }
        public string PaymentMode { get; set; } = string.Empty;
        public decimal NetAmountPaid { get; set; }
    }

    public class AccountDetailsAndScheduleDto
    {
        public decimal SanctionedAmount { get; set; }
        public DateTime? DisbursementDate { get; set; }
        public decimal March31Balance { get; set; }
        public bool IsOpeningBalance { get; set; }
        public decimal CurrentPrincipalBalance { get; set; }
        public decimal CurrentInterestBalance { get; set; }
        public decimal CurrentOverdueInterestBalance { get; set; }
        public decimal TotalDisbursedAmount { get; set; }
        public int DisbursementCount { get; set; }
        public decimal PendingSanctionedAmount { get; set; }
        public List<LoanTrancheDetailDto> Tranches { get; set; } = new();
        public List<LoanInstallmentScheduleDto> Schedule { get; set; } = new();
    }

    public class LoanInstallmentScheduleDto
    {
        public int InstallmentNo { get; set; }
        public DateTime DueDate { get; set; }
        public decimal PrincipalAmount { get; set; }
        public decimal InterestAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? PaidDate { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal ClosingBalance { get; set; }
        public int Days { get; set; }
        public decimal InterestRate { get; set; }
        public decimal PaidPrincipal { get; set; }
        public decimal PaidInterest { get; set; }
        public decimal RemainingPrincipal { get; set; }
        public int OverdueDays { get; set; }
        public string? ReceiptNo { get; set; }
    }

    public class LoanOpeningBalanceDto
    {
        public int BranchID { get; set; } = 1;
        public int MemberID { get; set; }
        public int LoanRateID { get; set; }
        public string LoanAccountNo { get; set; } = string.Empty;
        public string? LegacyAccountNumber { get; set; }
        public decimal PrincipalBalance { get; set; }
        public decimal InterestBalance { get; set; }
        public decimal OverdueInterestBalance { get; set; }
        public DateTime OpeningDate { get; set; }
        public DateTime? LoanDisbursementDate { get; set; }
        public decimal SanctionedAmount { get; set; }
        public decimal InterestRate { get; set; }
        public int DurationMonths { get; set; }
        public decimal InstallmentAmount { get; set; }
        public DateTime? FirstInstallmentDate { get; set; }
        public DateTime? MaturityDate { get; set; }
        public string InstallmentFrequency { get; set; } = "मासिक (Monthly)";
        public DateTime? LastInstallmentPaidDate { get; set; }
        public string Guarantor1 { get; set; } = string.Empty;
        public string Guarantor2 { get; set; } = string.Empty;
        public int? Guarantor1MemberID { get; set; }
        public int? Guarantor2MemberID { get; set; }
        public string SecurityDetails { get; set; } = string.Empty;
        public decimal SecurityValue { get; set; }
        public int NoOfInstallments { get; set; }
        public List<OpeningBalanceScheduleDto> Schedule { get; set; } = new();
    }

    public class OpeningBalanceScheduleDto
    {
        public int No { get; set; }
        public DateTime Date { get; set; }
        public decimal Principal { get; set; }
        public decimal Interest { get; set; }
        public decimal Total { get; set; }
        public decimal Balance { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal ClosingBalance { get; set; }
        public int Days { get; set; }
        public decimal InterestRate { get; set; }
    }
    public class LoanLedgerReportDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public string LoanType { get; set; } = string.Empty;
        public string LoanAccountNo { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public decimal SanctionedAmount { get; set; }
        public string MemberName { get; set; } = string.Empty;
        public decimal InterestRate { get; set; }
        public DateTime? DisbursementDate { get; set; }
        public decimal InstallmentAmount { get; set; }
        public string AadhaarNo { get; set; } = string.Empty;
        public string PanNo { get; set; } = string.Empty;
        public string CifNo { get; set; } = string.Empty;
        public DateTime? MaturityDate { get; set; }
        public int DurationMonths { get; set; }
        public int OverdueInstallmentCount { get; set; }
        public decimal OverdueAmount { get; set; }
        
        public List<LoanLedgerGuarantorDto> Guarantors { get; set; } = new();
        public List<LoanLedgerTransactionDto> Transactions { get; set; } = new();
        public List<OpeningBalanceScheduleDto> InstallmentChart { get; set; } = new();
    }

    public class LoanLedgerGuarantorDto
    {
        public string Name { get; set; } = string.Empty;
    }

    public class LoanLedgerTransactionDto
    {
        public DateTime Date { get; set; }
        public string ReceiptNo { get; set; } = string.Empty;
        public string Particulars { get; set; } = string.Empty;
        public decimal LoanDisbursement { get; set; }
        public decimal PrincipalDeposit { get; set; }
        public decimal Interest { get; set; }
        public decimal PenalInterest { get; set; }
        public decimal ReceivableInterest { get; set; }
        public decimal RecoveryCharges { get; set; }
        public decimal Total { get; set; }
        public int Days { get; set; }
        public decimal Balance { get; set; }
    }

    public class OverdueLoanReportDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public List<OverdueLoanRowDto> Rows { get; set; } = new();
    }

    public class OverdueLoanRowDto
    {
        public int LoanAccountID { get; set; }
        public string LoanAccountNo { get; set; } = string.Empty;
        public string LoanType { get; set; } = string.Empty;
        public int? CustomerID { get; set; }
        public string CifNo { get; set; } = string.Empty;
        public int MemberID { get; set; }
        public string MemberCode { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public string MobileNo { get; set; } = string.Empty;
        public DateTime LoanDate { get; set; }
        public decimal SanctionedAmount { get; set; }
        public decimal PrincipalBalance { get; set; }
        public decimal OverduePrincipal { get; set; }
        public DateTime? OverdueSinceDate { get; set; }
        public int OverdueInstallmentsCount { get; set; }
        public decimal InstallmentAmount { get; set; }
        public decimal OutstandingInterest { get; set; }
        public string GuarantorDetails { get; set; } = string.Empty;
        public DateTime? MaturityDate { get; set; }
        public string Remarks { get; set; } = string.Empty;
    }

    public class LoanSchedulePreviewRequest
    {
        public int LoanRateID { get; set; }
        public decimal LoanAmount { get; set; }
        public decimal InterestRate { get; set; }
        public int NoOfInstallments { get; set; }
        public int DurationMonths { get; set; }
        public string InstallmentFrequency { get; set; } = "मासिक (Monthly)";
        public DateTime LoanDisbursementDate { get; set; }
        public DateTime? FirstInstallmentDate { get; set; }
        public decimal? CustomInstallmentAmount { get; set; }
    }

    public class DaybookSummaryResponseDto
    {
        public decimal OpeningBalance { get; set; }
        public decimal ClosingBalance { get; set; }
        public List<DaybookSummaryGroupDto> Groups { get; set; } = new();
        public decimal TotalReceiptsCash { get; set; }
        public decimal TotalReceiptsTransfer { get; set; }
        public decimal TotalPaymentsCash { get; set; }
        public decimal TotalPaymentsTransfer { get; set; }
    }

    public class DaybookSummaryBatchResponseDto
    {
        public List<DaybookSummaryDayDto> Days { get; set; } = new();
    }

    public class DaybookSummaryDayDto
    {
        public string Date { get; set; } = string.Empty;
        public DaybookSummaryResponseDto Data { get; set; } = new();
    }

    public class DaybookSummaryGroupDto
    {
        public int GroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;
        public List<DaybookSummaryLedgerDto> Ledgers { get; set; } = new();
    }

    public class DaybookSummaryLedgerDto
    {
        public int LedgerId { get; set; }
        public string LedgerName { get; set; } = string.Empty;
        public string VoucherNo { get; set; } = string.Empty;
        public string MemberDetails { get; set; } = string.Empty;
        public string Narration { get; set; } = string.Empty;
        public decimal ReceiptCash { get; set; }
        public decimal ReceiptTransfer { get; set; }
        public decimal ReceiptTotal => ReceiptCash + ReceiptTransfer;
        public decimal PaymentCash { get; set; }
        public decimal PaymentTransfer { get; set; }
        public decimal PaymentTotal => PaymentCash + PaymentTransfer;
    }

    public class SavingKhatavaniReportDto
    {
        public SansthaDetail? SansthaDetail { get; set; }
        public string AccountNo { get; set; } = string.Empty;
        public string? OldAccountNo { get; set; }
        public string MemberCode { get; set; } = string.Empty;
        public string CIFNo { get; set; } = string.Empty;
        public string MemberName { get; set; } = string.Empty;
        public string AccountType { get; set; } = string.Empty;
        public string LedgerName { get; set; } = string.Empty;
        public DateTime OpeningDate { get; set; }
        public decimal OpeningBalance { get; set; }
        public decimal CurrentBalance { get; set; }
        public decimal InterestRate { get; set; }
        public decimal PeriodOpeningBalance { get; set; }
        public decimal PeriodTotalDebit { get; set; }
        public decimal PeriodTotalCredit { get; set; }
        public decimal ClosingBalance { get; set; }
        public List<SavingKhatavaniTransactionDto> Transactions { get; set; } = new();
    }

    public class SavingKhatavaniTransactionDto
    {
        public DateTime Date { get; set; }
        public string Particulars { get; set; } = string.Empty;
        public decimal Debit { get; set; }
        public decimal Credit { get; set; }
        public decimal Balance { get; set; }
    }

    public class GoldJewelryReportItemDto
    {
        public int SrNo { get; set; }
        public int GoldLoanDetailID { get; set; }
        public int LoanAccountID { get; set; }
        public string LoanAccountNo { get; set; } = string.Empty;
        public int? CustomerID { get; set; }
        public string CifNo { get; set; } = string.Empty;
        public int MemberID { get; set; }
        public string MemberCode { get; set; } = string.Empty;
        public string BorrowerName { get; set; } = string.Empty;
        public string OrnamentName { get; set; } = string.Empty;
        public decimal EstimatedValue { get; set; }
        public decimal NetWeight { get; set; }
        public decimal GrossWeight { get; set; }
        public int Quantity { get; set; }
        public decimal Purity { get; set; }
        public decimal GoldRatePerGram { get; set; }
        public string LoanStatus { get; set; } = "Active";
        public decimal SanctionedAmount { get; set; }
        public decimal PrincipalBalance { get; set; }
        public DateTime? LoanDisbursementDate { get; set; }
    }

    public class GoldJewelryReportResponseDto
    {
        public SansthaDetail? SansthaInfo { get; set; }
        public string ReportDate { get; set; } = string.Empty;
        public string BranchName { get; set; } = "सर्व शाखा";
        public List<GoldJewelryReportItemDto> Items { get; set; } = new();
        public decimal TotalEstimatedValue { get; set; }
        public decimal TotalNetWeight { get; set; }
        public decimal TotalGrossWeight { get; set; }
        public int TotalQuantity { get; set; }
        public int TotalAccountsCount { get; set; }
    }

    public class AlphanumericComparer : IComparer<string?>
    {
        public int Compare(string? x, string? y)
        {
            if (x == null && y == null) return 0;
            if (x == null) return -1;
            if (y == null) return 1;

            string[] xParts = System.Text.RegularExpressions.Regex.Split(x.Trim(), "([0-9]+)");
            string[] yParts = System.Text.RegularExpressions.Regex.Split(y.Trim(), "([0-9]+)");

            for (int i = 0; i < Math.Min(xParts.Length, yParts.Length); i++)
            {
                if (xParts[i] != yParts[i])
                {
                    if (int.TryParse(xParts[i], out int xNum) && int.TryParse(yParts[i], out int yNum))
                    {
                        return xNum.CompareTo(yNum);
                    }
                    return string.Compare(xParts[i], yParts[i], StringComparison.OrdinalIgnoreCase);
                }
            }

            return xParts.Length.CompareTo(yParts.Length);
        }
    }
}


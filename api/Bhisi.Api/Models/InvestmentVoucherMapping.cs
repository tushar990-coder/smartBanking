using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class InvestmentVoucherMapping
    {
        [Key]
        public int MappingID { get; set; }

        [Required]
        public int InstitutionID { get; set; } = 1;

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(50)]
        public string InvestmentType { get; set; } = string.Empty; // BankFD, PatpedhiFD, Bonds, MutualFunds, GSec

        [Required]
        public int InvestmentLedgerID { get; set; }

        [Required]
        public int InterestIncomeLedgerID { get; set; }

        [Required]
        public int InterestReceivableLedgerID { get; set; }
    }
}

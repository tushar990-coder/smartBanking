using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class PigmyAgentAccountTransfer
    {
        [Key]
        public long TransferID { get; set; }

        [Required]
        [StringLength(50)]
        public string BatchNumber { get; set; } = string.Empty;

        public int BranchID { get; set; } = 1;

        [Required]
        public int FromAgentID { get; set; }

        [ForeignKey("FromAgentID")]
        public virtual PigmyAgent? FromAgent { get; set; }

        [Required]
        public int ToAgentID { get; set; }

        [ForeignKey("ToAgentID")]
        public virtual PigmyAgent? ToAgent { get; set; }

        [Required]
        public int PigmyAccountID { get; set; }

        [ForeignKey("PigmyAccountID")]
        public virtual PigmyAccount? PigmyAccount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalBalanceAtTransfer { get; set; }

        public DateTime TransferredOn { get; set; } = DateTime.Now;

        public int TransferredBy { get; set; } = 1;

        [Required]
        [StringLength(500)]
        public string Reason { get; set; } = string.Empty;

        [Required]
        [StringLength(20)]
        public string TransferType { get; set; } = "BULK"; // BULK or SELECTIVE
    }
}

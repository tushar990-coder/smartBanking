using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class GoldLoanCustody
    {
        [Key]
        public int GoldCustodyID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(60)]
        public string PacketNumber { get; set; } = string.Empty;

        [StringLength(60)]
        public string? SealNumber { get; set; }

        public int TotalOrnamentsCount { get; set; } = 0;

        [Column(TypeName = "decimal(18,3)")]
        public decimal TotalGrossWeight { get; set; } = 0m;

        [Column(TypeName = "decimal(18,3)")]
        public decimal TotalNetWeight { get; set; } = 0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalValuationAmount { get; set; } = 0m;

        /// <summary>
        /// BRANCH_SAFE | OWN_LOCKER | EXTERNAL_LOCKER | REPLEDGED_BORROWING | RELEASED_TO_CUSTOMER
        /// </summary>
        [Required]
        [StringLength(40)]
        public string CustodyStatus { get; set; } = "BRANCH_SAFE";

        [StringLength(100)]
        public string? VaultRackOrTrayNo { get; set; }

        public int? OwnLockerID { get; set; }

        [ForeignKey("OwnLockerID")]
        public virtual Locker? OwnLocker { get; set; }

        public int? ExternalLockerID { get; set; }

        [ForeignKey("ExternalLockerID")]
        public virtual SansthaExternalLocker? ExternalLocker { get; set; }

        public int? ActiveBorrowingID { get; set; }

        [ForeignKey("ActiveBorrowingID")]
        public virtual SansthaBorrowing? ActiveBorrowing { get; set; }

        public DateTime CustodyReceivedDate { get; set; } = DateTime.Today;
        public DateTime? LastLocationUpdatedDate { get; set; }

        // Customer Release / Handover Metadata
        public DateTime? ReleasedDate { get; set; }

        [StringLength(150)]
        public string? ReleasedToName { get; set; }

        [StringLength(60)]
        public string? ReleasedToRelation { get; set; }

        [StringLength(20)]
        public string? ReceiverMobile { get; set; }

        [StringLength(100)]
        public string? ReceiverIdProof { get; set; }

        [StringLength(60)]
        public string? ReleaseReceiptNo { get; set; }

        [StringLength(500)]
        public string? ReleasePhotoOrDocPath { get; set; }

        public int? SettlementCollectionID { get; set; }
        public int? ReleasedByUserID { get; set; }

        [StringLength(500)]
        public string? Remarks { get; set; }

        public int CreatedBy { get; set; } = 1;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}

using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LockerAllotment
    {
        [Key]
        public int AllotmentID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(50)]
        public string LockerAccountNo { get; set; } = string.Empty; // लॉकर खाते क्रमांक (e.g. LKR-0001)

        [Required]
        public int LockerID { get; set; }

        [ForeignKey("LockerID")]
        public virtual Locker? Locker { get; set; }

        public int? CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        public int? MemberID { get; set; }

        [ForeignKey("MemberID")]
        public virtual Member? Member { get; set; }

        public int? JointMember1_ID { get; set; }
        [ForeignKey("JointMember1_ID")]
        public virtual Member? JointMember1 { get; set; }

        public int? JointMember2_ID { get; set; }
        [ForeignKey("JointMember2_ID")]
        public virtual Member? JointMember2 { get; set; }

        [Required]
        [StringLength(50)]
        public string OperatingInstruction { get; set; } = "Self"; // Self (स्वतः), EitherOrSurvivor (दोघांपैकी एकाने), Jointly (एकत्रित), AnyOne (कोणीही एकाने)

        [Required]
        public DateTime AllotmentDate { get; set; } = DateTime.Today;

        [Required]
        public DateTime RentStartDate { get; set; } = DateTime.Today;

        [Required]
        public DateTime ExpiryDate { get; set; } = DateTime.Today.AddYears(1); // भाडे नूतनीकरण दिनांक

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal AnnualRent { get; set; } = 0;

        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal SecurityDepositAmount { get; set; } = 0;

        [Column(TypeName = "decimal(18,2)")]
        public decimal AdvanceRentPaid { get; set; } = 0;

        // Auto-Debit Linking
        public int? LinkedSavingAccountID { get; set; }
        [ForeignKey("LinkedSavingAccountID")]
        public virtual SavingAccountMaster? LinkedSavingAccount { get; set; }

        public bool IsAutoDebitEnabled { get; set; } = false;

        // Nominee Information (वारसदार तपशील)
        [StringLength(150)]
        public string? NomineeName { get; set; }

        [StringLength(50)]
        public string? NomineeRelation { get; set; }

        public int? NomineeAge { get; set; }

        [StringLength(20)]
        public string? NomineeAadhaar { get; set; }

        [StringLength(200)]
        public string? NomineeAddress { get; set; }

        // Vouchers
        public int? DepositVoucherID { get; set; }
        public int? AdvanceRentVoucherID { get; set; }

        [Required]
        [StringLength(30)]
        public string Status { get; set; } = "Active"; // Active, Surrendered, BreakOpen

        [StringLength(250)]
        public string? Remarks { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}

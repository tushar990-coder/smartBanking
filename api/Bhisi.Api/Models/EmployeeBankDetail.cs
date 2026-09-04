using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class EmployeeBankDetail
    {
        [Key]
        public int EmployeeBankDetailID { get; set; }

        [Required]
        [MaxLength(20)]
        public string CIFNo { get; set; } = string.Empty;

        // Navigation property for MemberMaster (assuming Member class exists and has CIFNo as key or unique property)
        // [ForeignKey("CIFNo")]
        // public Member? Member { get; set; }

        [Required]
        [MaxLength(50)]
        public string EmployeeID { get; set; } = string.Empty;

        [Required]
        public int DepartmentID { get; set; }

        [ForeignKey("DepartmentID")]
        public DepartmentMaster? Department { get; set; }

        [Required]
        public DateTime JoiningDate { get; set; }

        [Required]
        [MaxLength(20)]
        public string EmployeeStatus { get; set; } = "Active";

        [MaxLength(15)]
        public string? MobileNumber { get; set; }

        [Required]
        [MaxLength(100)]
        public string BankName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string IFSCCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string AccountNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string AccountType { get; set; } = "Savings";

        [Required]
        public int BranchID { get; set; }

        [ForeignKey("BranchID")]
        public BranchMaster? Branch { get; set; }

        public int? CreatedBy { get; set; }
        public DateTime? CreatedDate { get; set; }
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedDate { get; set; }
    }
}

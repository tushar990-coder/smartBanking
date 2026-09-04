using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class Locker
    {
        [Key]
        public int LockerID { get; set; }

        [Required]
        public int BranchID { get; set; } = 1;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }

        [Required]
        [StringLength(50)]
        public string CabinetNo { get; set; } = "C-1"; // कपाट / रॅक क्रमांक

        [Required]
        [StringLength(50)]
        public string LockerNo { get; set; } = string.Empty; // लॉकर क्रमांक

        [Required]
        [StringLength(50)]
        public string KeyNo { get; set; } = string.Empty; // चावी क्रमांक

        [Required]
        public int LockerTypeID { get; set; }

        [ForeignKey("LockerTypeID")]
        public virtual LockerType? LockerType { get; set; }

        [Required]
        [StringLength(50)]
        public string Status { get; set; } = "Available"; // Available, Allotted, UnderMaintenance, Sealed

        [StringLength(250)]
        public string? Remarks { get; set; }

        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}

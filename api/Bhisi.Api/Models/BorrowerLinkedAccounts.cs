using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class BorrowerLinkedAccounts
    {
        [Key]
        public int BorrowerLinkedAccountID { get; set; }

        [Required]
        public int ParentMemberID { get; set; }

        [ForeignKey("ParentMemberID")]
        public virtual Member? ParentMember { get; set; }

        [Required]
        public int LinkedMemberID { get; set; }

        [ForeignKey("LinkedMemberID")]
        public virtual Member? LinkedMember { get; set; }

        [Required]
        [StringLength(50)]
        public string LinkType { get; set; } = "Relative"; // Relative, Co-Collateral

        [StringLength(250)]
        public string? Remarks { get; set; }
    }
}

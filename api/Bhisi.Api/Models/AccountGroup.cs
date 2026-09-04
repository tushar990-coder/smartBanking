using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class AccountGroup
    {
        [Key]
        public int GroupID { get; set; }
        
        [Required]
        [StringLength(100)]
        public required string GroupName { get; set; }

        [StringLength(50)]
        public string? GroupCode { get; set; } // e.g. "1", "1.1", "1.2", "1.1.1"

        [StringLength(100)]
        public string? GroupNameEnglish { get; set; }
        
        public int? ParentGroupID { get; set; }
        
        [ForeignKey("ParentGroupID")]
        [System.Text.Json.Serialization.JsonIgnore]
        public virtual AccountGroup? ParentGroup { get; set; }
        
        [Required]
        [StringLength(50)]
        public required string NatureOfGroup { get; set; } // Assets, Liabilities, Income, Expenses
        
        [Required]
        public bool IsActive { get; set; } = true;
        
        public int DisplayOrder { get; set; } = 0;
        
        [System.Text.Json.Serialization.JsonIgnore]
        public virtual ICollection<AccountGroup> SubGroups { get; set; } = new List<AccountGroup>();
        
        [System.Text.Json.Serialization.JsonIgnore]
        public virtual ICollection<Ledger> Ledgers { get; set; } = new List<Ledger>();

        // Legacy Mapping Fields for Migration
        public int? LegacyGroupId { get; set; }
    }
}

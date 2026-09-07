using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingAccountJointHolder
    {
        [Key]
        public int JointHolderID { get; set; }

        [Required]
        public int SavingAccountID { get; set; }

        [ForeignKey("SavingAccountID")]
        public virtual SavingAccountMaster? SavingAccount { get; set; }

        public int? CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        [NotMapped]
        public int? MemberID
        {
            get => Customer?.MemberProfile?.MemberID;
            set { /* backward compatibility no-op */ }
        }

        [NotMapped]
        public virtual Member? Member => Customer?.MemberProfile;

        [NotMapped]
        public int? ResolvedMemberID => Customer?.MemberProfile?.MemberID;

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}

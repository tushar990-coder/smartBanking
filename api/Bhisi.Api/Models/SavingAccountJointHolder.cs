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

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }
}

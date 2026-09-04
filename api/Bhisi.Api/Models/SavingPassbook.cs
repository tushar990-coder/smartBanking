using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SavingPassbook
    {
        [Key]
        public int PassbookLogID { get; set; }

        [Required]
        public int SavingAccountID { get; set; }
        
        [ForeignKey("SavingAccountID")]
        public virtual SavingAccountMaster? SavingAccount { get; set; }

        [Required]
        public int TransactionID { get; set; }
        
        [ForeignKey("TransactionID")]
        public virtual SavingTransaction? SavingTransaction { get; set; }

        public int? CustomerID { get; set; }

        [ForeignKey("CustomerID")]
        public virtual Customer? Customer { get; set; }

        public int PrintedLineNo { get; set; }
        public int PrintedPageNo { get; set; }

        public DateTime PrintedOn { get; set; } = DateTime.Now;
        public int PrintedBy { get; set; } = 1;
    }
}

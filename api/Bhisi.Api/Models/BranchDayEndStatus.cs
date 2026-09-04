using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class BranchDayEndStatus
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int StatusID { get; set; }

        public int BranchID { get; set; }

        public DateTime BusinessDate { get; set; }

        public bool IsDayClosed { get; set; } = false;

        [ForeignKey("BranchID")]
        public virtual Branch? Branch { get; set; }
    }
}

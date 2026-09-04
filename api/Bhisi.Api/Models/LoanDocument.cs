using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class LoanDocument
    {
        [Key]
        public int LoanDocumentID { get; set; }

        [Required]
        public int LoanAccountID { get; set; }

        [ForeignKey("LoanAccountID")]
        public virtual LoanAccount? LoanAccount { get; set; }

        [Required]
        [StringLength(100)]
        public string DocumentType { get; set; } = string.Empty; // उदा. आधार कार्ड, 7/12

        [StringLength(200)]
        public string DocumentName { get; set; } = string.Empty; // कागदपत्राचे नाव / वर्णन

        [Required]
        [StringLength(500)]
        public string FilePath { get; set; } = string.Empty; // अपलोड केलेल्या फाईलचा मार्ग (Local path or URL)

        public DateTime UploadedDate { get; set; } = DateTime.Today;
    }
}

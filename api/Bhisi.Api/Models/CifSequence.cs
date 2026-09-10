using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    /// <summary>
    /// Independent CIF Sequence Generator for Core Banking.
    /// Completely decoupled from database CustomerID identity.
    /// </summary>
    public class CifSequence
    {
        [Key]
        public int SequenceID { get; set; }

        [Required]
        [MaxLength(50)]
        public string SequenceCode { get; set; } = "CORE_CIF_SEQ";

        [Required]
        [MaxLength(10)]
        public string Prefix { get; set; } = "CIF";

        public long CurrentValue { get; set; } = 0;

        public int PaddingLength { get; set; } = 6;

        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
    }

    public class SequenceReservationResult
    {
        public long StartRange { get; set; }
        public long EndRange { get; set; }
        public string Prefix { get; set; } = "CIF";
        public int PaddingLength { get; set; } = 6;
    }
}

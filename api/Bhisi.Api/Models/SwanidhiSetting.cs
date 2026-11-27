using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Bhisi.Api.Models
{
    public class SwanidhiSetting
    {
        [Key]
        public int SettingID { get; set; }

        public int BranchID { get; set; } = 1;

        [Column(TypeName = "decimal(5,2)")]
        public decimal BorrowingLimitMultiplier { get; set; } = 10.0m;

        [Column(TypeName = "decimal(5,2)")]
        public decimal Year1DividendRate { get; set; } = 0.0m;

        [Column(TypeName = "decimal(5,2)")]
        public decimal Year2DividendRate { get; set; } = 0.0m;

        [Column(TypeName = "decimal(5,2)")]
        public decimal Year3DividendRate { get; set; } = 0.0m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal? ManualCertifiedNetProfit { get; set; }

        public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;

        [NotMapped]
        public decimal AverageDividendRate
        {
            get
            {
                // Official Maharashtra Circular Explanation-2:
                // Exact consecutive 3-year average dividend rate = (Y1 + Y2 + Y3) / 3
                decimal sum = Math.Max(0m, Year1DividendRate)
                            + Math.Max(0m, Year2DividendRate)
                            + Math.Max(0m, Year3DividendRate);
                return Math.Round(sum / 3m, 2, MidpointRounding.AwayFromZero);
            }
        }
    }
}

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
                var rates = new[] { Year1DividendRate, Year2DividendRate, Year3DividendRate };
                var validRates = rates.Where(r => r > 0).ToList();
                if (validRates.Count == 0) return 0.0m;
                return Math.Round(validRates.Average(), 2);
            }
        }
    }
}

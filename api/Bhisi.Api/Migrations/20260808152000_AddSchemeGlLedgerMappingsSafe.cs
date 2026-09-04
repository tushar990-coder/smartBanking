using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSchemeGlLedgerMappingsSafe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'RdSchemes') AND name = N'PrematurePenaltyRate')
                    ALTER TABLE [RdSchemes] ADD [PrematurePenaltyRate] decimal(5,2) NOT NULL DEFAULT 1.00;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'RdSchemes') AND name = N'RdLiabilityLedgerID')
                    ALTER TABLE [RdSchemes] ADD [RdLiabilityLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'RdSchemes') AND name = N'InterestExpenseLedgerID')
                    ALTER TABLE [RdSchemes] ADD [InterestExpenseLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'RdSchemes') AND name = N'InterestPayableLedgerID')
                    ALTER TABLE [RdSchemes] ADD [InterestPayableLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'RdSchemes') AND name = N'PenaltyIncomeLedgerID')
                    ALTER TABLE [RdSchemes] ADD [PenaltyIncomeLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'PigmySchemes') AND name = N'PigmyLiabilityLedgerID')
                    ALTER TABLE [PigmySchemes] ADD [PigmyLiabilityLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'PigmySchemes') AND name = N'InterestExpenseLedgerID')
                    ALTER TABLE [PigmySchemes] ADD [InterestExpenseLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'PigmySchemes') AND name = N'InterestPayableLedgerID')
                    ALTER TABLE [PigmySchemes] ADD [InterestPayableLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'PigmySchemes') AND name = N'CommissionExpenseLedgerID')
                    ALTER TABLE [PigmySchemes] ADD [CommissionExpenseLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'SavingInterestSettings') AND name = N'SavingLiabilityLedgerID')
                    ALTER TABLE [SavingInterestSettings] ADD [SavingLiabilityLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'SavingInterestSettings') AND name = N'InterestExpenseLedgerID')
                    ALTER TABLE [SavingInterestSettings] ADD [InterestExpenseLedgerID] int NULL;

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'SavingInterestSettings') AND name = N'InterestPayableLedgerID')
                    ALTER TABLE [SavingInterestSettings] ADD [InterestPayableLedgerID] int NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}

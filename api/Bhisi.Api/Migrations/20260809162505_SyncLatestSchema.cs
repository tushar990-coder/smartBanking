using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bhisi.Api.Migrations
{
    /// <inheritdoc />
    public partial class SyncLatestSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgents]') AND name = 'BranchID')
                BEGIN
                    ALTER TABLE [PigmyAgents] ADD [BranchID] int NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[PigmyAgentCashDeposits]') AND name = 'PaymentMode')
                BEGIN
                    ALTER TABLE [PigmyAgentCashDeposits] ADD [PaymentMode] nvarchar(50) NOT NULL DEFAULT '';
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[InvestmentAccounts]') AND name = 'DepositReceiptNo')
                BEGIN
                    ALTER TABLE [InvestmentAccounts] ADD [DepositReceiptNo] nvarchar(50) NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'BankAccountLedgerID')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [BankAccountLedgerID] int NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'ChequeDate')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [ChequeDate] datetime2 NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'ChequeNo')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [ChequeNo] nvarchar(50) NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'PaymentMode')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [PaymentMode] nvarchar(20) NOT NULL DEFAULT '';
                END

                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[FdAccounts]') AND name = 'SavingAccountID')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD [SavingAccountID] int NULL;
                END

                IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BankMasters')
                BEGIN
                    CREATE TABLE [BankMasters] (
                        [BankID] int NOT NULL IDENTITY(1, 1),
                        [BankName] nvarchar(100) NOT NULL,
                        CONSTRAINT [PK_BankMasters] PRIMARY KEY ([BankID])
                    );
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PigmyAgents_BranchID' AND object_id = OBJECT_ID(N'[PigmyAgents]'))
                BEGIN
                    CREATE INDEX [IX_PigmyAgents_BranchID] ON [PigmyAgents] ([BranchID]);
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FdAccounts_BankAccountLedgerID' AND object_id = OBJECT_ID(N'[FdAccounts]'))
                BEGIN
                    CREATE INDEX [IX_FdAccounts_BankAccountLedgerID] ON [FdAccounts] ([BankAccountLedgerID]);
                END

                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FdAccounts_SavingAccountID' AND object_id = OBJECT_ID(N'[FdAccounts]'))
                BEGIN
                    CREATE INDEX [IX_FdAccounts_SavingAccountID] ON [FdAccounts] ([SavingAccountID]);
                END

                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_FdAccounts_Ledgers_BankAccountLedgerID')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD CONSTRAINT [FK_FdAccounts_Ledgers_BankAccountLedgerID] FOREIGN KEY ([BankAccountLedgerID]) REFERENCES [Ledgers] ([LedgerID]) ON DELETE NO ACTION;
                END

                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_FdAccounts_SavingAccountMasters_SavingAccountID')
                BEGIN
                    ALTER TABLE [FdAccounts] ADD CONSTRAINT [FK_FdAccounts_SavingAccountMasters_SavingAccountID] FOREIGN KEY ([SavingAccountID]) REFERENCES [SavingAccountMasters] ([SavingAccountID]) ON DELETE NO ACTION;
                END

                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_PigmyAgents_Branches_BranchID')
                BEGIN
                    ALTER TABLE [PigmyAgents] ADD CONSTRAINT [FK_PigmyAgents_Branches_BranchID] FOREIGN KEY ([BranchID]) REFERENCES [Branches] ([BranchID]) ON DELETE NO ACTION;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FdAccounts_Ledgers_BankAccountLedgerID",
                table: "FdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_FdAccounts_SavingAccountMasters_SavingAccountID",
                table: "FdAccounts");

            migrationBuilder.DropForeignKey(
                name: "FK_PigmyAgents_Branches_BranchID",
                table: "PigmyAgents");

            migrationBuilder.DropTable(
                name: "BankMasters");

            migrationBuilder.DropIndex(
                name: "IX_PigmyAgents_BranchID",
                table: "PigmyAgents");

            migrationBuilder.DropIndex(
                name: "IX_FdAccounts_BankAccountLedgerID",
                table: "FdAccounts");

            migrationBuilder.DropIndex(
                name: "IX_FdAccounts_SavingAccountID",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "BranchID",
                table: "PigmyAgents");

            migrationBuilder.DropColumn(
                name: "PaymentMode",
                table: "PigmyAgentCashDeposits");

            migrationBuilder.DropColumn(
                name: "DepositReceiptNo",
                table: "InvestmentAccounts");

            migrationBuilder.DropColumn(
                name: "BankAccountLedgerID",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "ChequeDate",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "ChequeNo",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "PaymentMode",
                table: "FdAccounts");

            migrationBuilder.DropColumn(
                name: "SavingAccountID",
                table: "FdAccounts");
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Bhisi.Api.Services;

namespace Bhisi.Api.Tests
{
    public class PigmySyncAndLockTests
    {
        private AppDbContext GetInMemoryDbContext(string dbName)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
                .Options;

            return new AppDbContext(options);
        }

        [Fact]
        public async Task AgentLockService_ShouldReturnAllowed_WhenPendingCashBelow20000()
        {
            using var context = GetInMemoryDbContext("AgentLock_Allowed_Db");

            var agent = new PigmyAgent
            {
                PigmyAgentID = 1,
                AgentName = "Santosh Shinde",
                MobileNo = "9890012345",
                MaxCashLimit = 20000m,
                Status = "Active"
            };
            context.PigmyAgents.Add(agent);

            // Agent collected ₹15,000 in cash
            context.PigmyCollections.Add(new PigmyCollection
            {
                PigmyAccountId = 1,
                AgentId = 1,
                CollectionDate = DateTime.Today,
                OpeningBalance = 0,
                CollectionAmount = 15000m,
                ClosingBalance = 15000m,
                ReceiptNo = "REC-1",
                PaymentMode = "CASH",
                CollectionSource = "APP",
                TransactionId = Guid.NewGuid().ToString()
            });

            await context.SaveChangesAsync();

            var lockService = new AgentLockService(context);
            var result = await lockService.GetLockStatusAsync(1);

            Assert.Equal("ALLOWED", result.Status);
            Assert.False(result.IsLocked);
            Assert.Equal(15000m, result.PendingCash);
        }

        [Fact]
        public async Task AgentLockService_ShouldReturnLocked_WhenPendingCashExceeds20000()
        {
            using var context = GetInMemoryDbContext("AgentLock_Locked_Db");

            var agent = new PigmyAgent
            {
                PigmyAgentID = 2,
                AgentName = "Ramesh Pawar",
                MobileNo = "9890054321",
                MaxCashLimit = 20000m,
                Status = "Active"
            };
            context.PigmyAgents.Add(agent);

            // Agent collected ₹25,000 in cash
            context.PigmyCollections.Add(new PigmyCollection
            {
                PigmyAccountId = 1,
                AgentId = 2,
                CollectionDate = DateTime.Today,
                OpeningBalance = 0,
                CollectionAmount = 25000m,
                ClosingBalance = 25000m,
                ReceiptNo = "REC-2",
                PaymentMode = "CASH",
                CollectionSource = "APP",
                TransactionId = Guid.NewGuid().ToString()
            });

            // Agent remitted ₹3,000 to branch (Pending cash = ₹22,000)
            context.PigmyAgentCashDeposits.Add(new PigmyAgentCashDeposit
            {
                DepositId = 1,
                AgentId = 2,
                DepositDate = DateTime.Today,
                Amount = 3000m,
                ReceiptNo = "DEP-01",
                CreatedBy = 1
            });

            await context.SaveChangesAsync();

            var lockService = new AgentLockService(context);
            var result = await lockService.GetLockStatusAsync(2);

            Assert.Equal("LOCKED", result.Status);
            Assert.True(result.IsLocked);
            Assert.Equal(22000m, result.PendingCash);
        }

        [Fact]
        public async Task PigmySyncService_ShouldProcessCollection_AndEnforceIdempotency()
        {
            using var context = GetInMemoryDbContext("PigmySync_Idempotency_Db");

            var agent = new PigmyAgent
            {
                PigmyAgentID = 10,
                AgentName = "Vikas Patil",
                MobileNo = "9822011223",
                MaxCashLimit = 20000m,
                Status = "Active"
            };
            context.PigmyAgents.Add(agent);

            var member = new Member
            {
                MemberID = 100,
                FirstName = "Rajesh",
                LastName = "Kadam",
                MobileNo = "9922334455",
                BranchID = 1
            };
            context.Members.Add(member);

            var account = new PigmyAccount
            {
                PigmyAccountID = 50,
                AccountNo = "PGM-1-20260827-0100",
                MemberID = 100,
                BranchID = 1,
                PigmySchemeID = 1,
                PigmyAgentID = 10,
                OpeningDate = DateTime.Today,
                MaturityDate = DateTime.Today.AddYears(1),
                TotalDepositedAmount = 1000m,
                Status = "Active"
            };
            context.PigmyAccounts.Add(account);
            await context.SaveChangesAsync();

            var lockService = new AgentLockService(context);
            var syncService = new PigmySyncService(context, lockService);

            string clientUUID = "tx-uuid-offline-101";

            var requestDto = new SingleCollectionRequestDto
            {
                TransactionId = clientUUID,
                AccountId = 50,
                Amount = 500m,
                PaymentMode = "CASH",
                Notes = "Daily collection ₹500"
            };

            // First Sync (New Transaction)
            var firstResult = await syncService.ProcessSingleCollectionAsync(10, requestDto);

            Assert.True(firstResult.Success);
            Assert.False(firstResult.IsDuplicate);
            Assert.Equal(200, firstResult.StatusCode);
            Assert.Equal(1500m, firstResult.CurrentBalance);
            Assert.NotEmpty(firstResult.ReceiptNo);

            // Verify Account Balance updated in DB
            var updatedAccount = await context.PigmyAccounts.FindAsync(50);
            Assert.Equal(1500m, updatedAccount!.TotalDepositedAmount);

            // Second Sync with SAME UUID (Idempotency Simulation)
            var duplicateResult = await syncService.ProcessSingleCollectionAsync(10, requestDto);

            Assert.True(duplicateResult.Success);
            Assert.True(duplicateResult.IsDuplicate);
            Assert.Equal(200, duplicateResult.StatusCode);
            Assert.Equal(firstResult.ReceiptNo, duplicateResult.ReceiptNo);
            Assert.Equal(1500m, duplicateResult.CurrentBalance); // Balance must NOT become 2000!

            // Verify Account Balance still 1500 (NO double credit)
            var finalAccount = await context.PigmyAccounts.FindAsync(50);
            Assert.Equal(1500m, finalAccount!.TotalDepositedAmount);

            // Verify only 1 record in PigmyCollections
            var collectionsCount = await context.PigmyCollections.CountAsync(c => c.TransactionId == clientUUID);
            Assert.Equal(1, collectionsCount);
        }

        [Fact]
        public async Task PigmySyncService_ShouldRejectCollection_WhenAgentHoldingExceedsLimit()
        {
            using var context = GetInMemoryDbContext("PigmySync_Lock_Rejection_Db");

            var agent = new PigmyAgent
            {
                PigmyAgentID = 20,
                AgentName = "Mahesh More",
                MobileNo = "9822099887",
                MaxCashLimit = 20000m,
                Status = "Active"
            };
            context.PigmyAgents.Add(agent);

            // Preload with ₹21,000 unremitted cash
            context.PigmyCollections.Add(new PigmyCollection
            {
                PigmyAccountId = 1,
                AgentId = 20,
                CollectionDate = DateTime.Today,
                OpeningBalance = 0,
                CollectionAmount = 21000m,
                ClosingBalance = 21000m,
                ReceiptNo = "REC-PRE",
                PaymentMode = "CASH",
                CollectionSource = "APP",
                TransactionId = "tx-pre-existing"
            });

            var account = new PigmyAccount
            {
                PigmyAccountID = 60,
                AccountNo = "PGM-1-20260827-0200",
                MemberID = 1,
                BranchID = 1,
                PigmyAgentID = 20,
                OpeningDate = DateTime.Today,
                MaturityDate = DateTime.Today.AddYears(1),
                TotalDepositedAmount = 500m,
                Status = "Active"
            };
            context.PigmyAccounts.Add(account);
            await context.SaveChangesAsync();

            var lockService = new AgentLockService(context);
            var syncService = new PigmySyncService(context, lockService);

            var requestDto = new SingleCollectionRequestDto
            {
                TransactionId = "tx-uuid-blocked-attempt",
                AccountId = 60,
                Amount = 200m,
                PaymentMode = "CASH"
            };

            var result = await syncService.ProcessSingleCollectionAsync(20, requestDto);

            Assert.False(result.Success);
            Assert.Equal(403, result.StatusCode);
            Assert.Contains("Agent locked", result.Message);

            // Account balance must remain unchanged
            var unchangedAccount = await context.PigmyAccounts.FindAsync(60);
            Assert.Equal(500m, unchangedAccount!.TotalDepositedAmount);
        }

        [Fact]
        public async Task PigmySyncService_ShouldProcessBulkSync_WithMixedNewAndDuplicateItems()
        {
            using var context = GetInMemoryDbContext("PigmySync_BulkSync_Db");

            var agent = new PigmyAgent
            {
                PigmyAgentID = 30,
                AgentName = "Anil Shinde",
                MobileNo = "9822000111",
                MaxCashLimit = 50000m,
                Status = "Active"
            };
            context.PigmyAgents.Add(agent);

            for (int i = 1; i <= 3; i++)
            {
                context.Members.Add(new Member
                {
                    MemberID = i,
                    BranchID = 1,
                    FirstName = $"Customer{i}",
                    LastName = "Test",
                    MobileNo = $"982200000{i}"
                });

                context.PigmyAccounts.Add(new PigmyAccount
                {
                    PigmyAccountID = 100 + i,
                    AccountNo = $"PGM-1-20260827-{100 + i}",
                    MemberID = i,
                    BranchID = 1,
                    PigmyAgentID = 30,
                    OpeningDate = DateTime.Today,
                    MaturityDate = DateTime.Today.AddYears(1),
                    TotalDepositedAmount = 1000m,
                    Status = "Active"
                });
            }
            await context.SaveChangesAsync();


            var lockService = new AgentLockService(context);
            var syncService = new PigmySyncService(context, lockService);

            // Sync item 1 first
            await syncService.ProcessSingleCollectionAsync(30, new SingleCollectionRequestDto
            {
                TransactionId = "bulk-item-1",
                AccountId = 101,
                Amount = 300m,
                PaymentMode = "CASH"
            });

            // Now send bulk batch of 3 items (item 1 is duplicate, items 2 and 3 are new)
            var bulkItems = new List<SingleCollectionRequestDto>
            {
                new SingleCollectionRequestDto { TransactionId = "bulk-item-1", AccountId = 101, Amount = 300m, PaymentMode = "CASH" },
                new SingleCollectionRequestDto { TransactionId = "bulk-item-2", AccountId = 102, Amount = 400m, PaymentMode = "CASH" },
                new SingleCollectionRequestDto { TransactionId = "bulk-item-3", AccountId = 103, Amount = 500m, PaymentMode = "UPI" }
            };

            var bulkResult = await syncService.ProcessBulkSyncAsync(30, bulkItems);

            Assert.True(bulkResult.Success);
            Assert.Equal(3, bulkResult.TotalCount);
            Assert.Equal(2, bulkResult.SuccessCount);
            Assert.Equal(1, bulkResult.DuplicateCount);
            Assert.Equal(0, bulkResult.FailedCount);
            Assert.Equal(900m, bulkResult.TotalAmount); // 400 + 500 (item 1 duplicate not added again)
        }
    }
}

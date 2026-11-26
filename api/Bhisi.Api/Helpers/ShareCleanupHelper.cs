using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Centralized hard-delete & orphan cleanup engine for Share Opening Balance, Share Accounts,
    /// Share Certificates, and zero-share Member records (100% CustomerID-First compliant).
    /// Ensures deleted Share entries never leave behind 0-share ShareAccounts or orphan Member rows
    /// that lock LegacyMemberNo or MemberCode.
    /// </summary>
    public static class ShareCleanupHelper
    {
        public static void InvalidateCustomerListCache(IMemoryCache? cache = null, HttpContext? httpContext = null)
        {
            try
            {
                var resolvedCache = cache ?? httpContext?.RequestServices?.GetService<IMemoryCache>();
                if (resolvedCache != null)
                {
                    int current = resolvedCache.GetOrCreate("customers_cache_ver", _ => 1);
                    resolvedCache.Set("customers_cache_ver", current + 1);
                }
            }
            catch
            {
                // Ignore cache invalidation errors cleanly
            }
        }

        /// <summary>
        /// Physically deletes a ShareAccount if its TotalShareCount &lt;= 0 and it has no remaining active/historical
        /// ShareTransactions, and physically deletes the linked Member record if the Member holds 0 active shares
        /// across all ShareAccounts (safely unlinking all nullable MemberID foreign keys while keeping Customer intact).
        /// </summary>
        public static async Task<(bool ShareAccountRemoved, bool MemberRemoved)> PurgeZeroShareAccountAndOrphanMemberAsync(
            AppDbContext context,
            int? shareAccountId,
            int? memberId,
            bool reseedIdentities = true)
        {
            bool shareAccountRemoved = false;
            bool memberRemoved = false;
            int resolvedMemberId = memberId ?? 0;

            // 1. Purge target ShareAccount if it now has 0 shares and 0 remaining transactions
            if (shareAccountId.HasValue && shareAccountId.Value > 0)
            {
                var account = await context.ShareAccounts
                    .Include(a => a.Certificates)
                    .Include(a => a.Transactions)
                    .FirstOrDefaultAsync(a => a.ShareAccountId == shareAccountId.Value);

                if (account != null)
                {
                    if (resolvedMemberId <= 0 && account.MemberId > 0)
                    {
                        resolvedMemberId = account.MemberId;
                    }

                    if (account.TotalShareCount <= 0)
                    {
                        bool hasRemainingTxns = await context.ShareTransactions
                            .AnyAsync(t => t.ShareAccountId == account.ShareAccountId);

                        if (!hasRemainingTxns)
                        {
                            var certIds = await context.ShareCertificates
                                .Where(c => c.ShareAccountId == account.ShareAccountId)
                                .Select(c => c.CertificateId)
                                .ToListAsync();

                            if (certIds.Count > 0)
                            {
                                var prints = await context.ShareCertificatePrintHistories
                                    .Where(p => certIds.Contains(p.CertificateId))
                                    .ToListAsync();
                                if (prints.Count > 0)
                                {
                                    context.ShareCertificatePrintHistories.RemoveRange(prints);
                                }

                                var certs = await context.ShareCertificates
                                    .Where(c => c.ShareAccountId == account.ShareAccountId)
                                    .ToListAsync();
                                if (certs.Count > 0)
                                {
                                    context.ShareCertificates.RemoveRange(certs);
                                }
                            }

                            int resolvedCustId = account.CustomerID;
                            var orphanShareMobs = await context.MemberOpeningBalances
                                .Include(m => m.Ledger)
                                .Where(m => (m.MemberID == account.MemberId || (resolvedCustId > 0 && m.CustomerID == resolvedCustId)) &&
                                            m.Ledger != null &&
                                            (m.Ledger.AccountType == "Share Capital" ||
                                             m.Ledger.AccountType == "Dividend Payable" ||
                                             m.Ledger.LedgerName.Contains("भाग") ||
                                             m.Ledger.LedgerName.Contains("शेअर्स") ||
                                             m.Ledger.LedgerName.Contains("लाभांश") ||
                                             m.Ledger.LedgerName.ToLower().Contains("share") ||
                                             m.Ledger.LedgerName.ToLower().Contains("dividend")))
                                .ToListAsync();

                            var affectedLedgerIds = orphanShareMobs.Select(m => m.LedgerID).Distinct().ToList();
                            if (orphanShareMobs.Count > 0)
                            {
                                context.MemberOpeningBalances.RemoveRange(orphanShareMobs);
                            }

                            context.ShareAccounts.Remove(account);
                            await context.SaveChangesAsync();
                            shareAccountRemoved = true;

                            if (affectedLedgerIds.Count > 0)
                            {
                                await BranchLedgerBalanceHelper.SyncMemberOpeningBalancesToBranchAsync(
                                    context,
                                    affectedLedgerIds,
                                    "शेअर्स खाते शून्य झाल्यामुळे सिंक");
                                await context.SaveChangesAsync();
                            }
                        }
                    }
                }
            }

            // 2. Purge Member row if it holds 0 active shares across all ShareAccounts
            if (resolvedMemberId > 0)
            {
                var member = await context.Members.FirstOrDefaultAsync(m => m.MemberID == resolvedMemberId);
                if (member != null)
                {
                    bool hasActiveShares = await context.ShareAccounts
                        .AnyAsync(s => s.MemberId == resolvedMemberId && s.TotalShareCount > 0);

                    if (!hasActiveShares)
                    {
                        // Remove any leftover 0-share ShareAccounts for this member that have 0 transactions
                        var zeroShareAccounts = await context.ShareAccounts
                            .Where(s => s.MemberId == resolvedMemberId && s.TotalShareCount <= 0)
                            .ToListAsync();

                        foreach (var zAcc in zeroShareAccounts)
                        {
                            bool zHasTxns = await context.ShareTransactions
                                .AnyAsync(t => t.ShareAccountId == zAcc.ShareAccountId);
                            if (!zHasTxns)
                            {
                                var zCertIds = await context.ShareCertificates
                                    .Where(c => c.ShareAccountId == zAcc.ShareAccountId)
                                    .Select(c => c.CertificateId)
                                    .ToListAsync();
                                if (zCertIds.Count > 0)
                                {
                                    var zPrints = await context.ShareCertificatePrintHistories
                                        .Where(p => zCertIds.Contains(p.CertificateId))
                                        .ToListAsync();
                                    if (zPrints.Count > 0) context.ShareCertificatePrintHistories.RemoveRange(zPrints);

                                    var zCerts = await context.ShareCertificates
                                        .Where(c => c.ShareAccountId == zAcc.ShareAccountId)
                                        .ToListAsync();
                                    if (zCerts.Count > 0) context.ShareCertificates.RemoveRange(zCerts);
                                }
                                context.ShareAccounts.Remove(zAcc);
                                shareAccountRemoved = true;
                            }
                        }

                        await context.SaveChangesAsync();

                        bool anyRemainingShareAccounts = await context.ShareAccounts
                            .AnyAsync(s => s.MemberId == resolvedMemberId);
                        bool hasDeceasedClaims = await context.DeceasedClaimSettlements
                            .AnyAsync(d => d.MemberID == resolvedMemberId);
                        bool hasActiveCommitteeRole = await context.CommitteeMembers
                            .AnyAsync(c => c.MemberID == resolvedMemberId && c.Status == "Active");

                        if (!anyRemainingShareAccounts && !hasDeceasedClaims && !hasActiveCommitteeRole)
                        {
                            // Unlink all nullable MemberID foreign keys (CustomerID remains intact 100%)
                            var linkedLoans = await context.LoanAccounts.Where(l => l.MemberID == resolvedMemberId).ToListAsync();
                            foreach (var l in linkedLoans) l.MemberID = null;

                            var linkedLockers = await context.LockerAllotments.Where(l => l.MemberID == resolvedMemberId).ToListAsync();
                            foreach (var l in linkedLockers) l.MemberID = null;

                            var linkedVoucherDetails = await context.VoucherDetails.Where(v => v.MemberID == resolvedMemberId).ToListAsync();
                            foreach (var v in linkedVoucherDetails) v.MemberID = null;

                            var linkedDemandDetails = await context.DemandMemberDetails.Where(d => d.MemberId == resolvedMemberId).ToListAsync();
                            foreach (var d in linkedDemandDetails) d.MemberId = null;

                            var linkedCases = await context.Sec101CaseMasters.Where(s => s.MemberId == resolvedMemberId).ToListAsync();
                            foreach (var s in linkedCases) s.MemberId = null;

                            var linkedNotices = await context.Sec101NoticeHistories.Where(n => n.MemberId == resolvedMemberId).ToListAsync();
                            foreach (var n in linkedNotices) n.MemberId = null;

                            var linkedAgentRequests = await context.AgentCustomerRequests.Where(r => r.CreatedMemberID == resolvedMemberId).ToListAsync();
                            foreach (var r in linkedAgentRequests) r.CreatedMemberID = null;

                            // Remove strict Member-only child rows
                            var linkedJoints = await context.JointMembers.Where(j => j.PrimaryMemberID == resolvedMemberId).ToListAsync();
                            if (linkedJoints.Count > 0) context.JointMembers.RemoveRange(linkedJoints);

                            var linkedBorrowers = await context.BorrowerLinkedAccounts
                                .Where(b => b.ParentMemberID == resolvedMemberId || b.LinkedMemberID == resolvedMemberId)
                                .ToListAsync();
                            if (linkedBorrowers.Count > 0) context.BorrowerLinkedAccounts.RemoveRange(linkedBorrowers);

                            var inactiveCommittee = await context.CommitteeMembers.Where(c => c.MemberID == resolvedMemberId).ToListAsync();
                            if (inactiveCommittee.Count > 0) context.CommitteeMembers.RemoveRange(inactiveCommittee);

                            var remainingMobs = await context.MemberOpeningBalances.Where(m => m.MemberID == resolvedMemberId).ToListAsync();
                            var remMobLedgerIds = remainingMobs.Select(m => m.LedgerID).Distinct().ToList();
                            if (remainingMobs.Count > 0) context.MemberOpeningBalances.RemoveRange(remainingMobs);

                            context.Members.Remove(member);
                            await context.SaveChangesAsync();
                            memberRemoved = true;

                            if (remMobLedgerIds.Count > 0)
                            {
                                await BranchLedgerBalanceHelper.SyncMemberOpeningBalancesToBranchAsync(
                                    context,
                                    remMobLedgerIds,
                                    "अनाथ सभासद डिलीट सिंक");
                                await context.SaveChangesAsync();
                            }
                        }
                        else
                        {
                            // Even if historical records prevent full Member row deletion, release LegacyMemberNo & MemberCode
                            if (!string.IsNullOrEmpty(member.LegacyMemberNo) || !string.IsNullOrEmpty(member.MemberCode))
                            {
                                member.LegacyMemberNo = null;
                                member.MemberCode = null;
                                context.Members.Update(member);
                                await context.SaveChangesAsync();
                            }
                        }
                    }
                }
            }

            if (reseedIdentities && (shareAccountRemoved || memberRemoved))
            {
                await TryReseedShareAndMemberIdentitiesAsync(context);
            }

            return (shareAccountRemoved, memberRemoved);
        }

        /// <summary>
        /// Fast idempotent sweep for any previously half-deleted 0-share ShareAccounts and 0-share Member rows.
        /// </summary>
        public static async Task<int> PurgeAllOrphanZeroShareRecordsAsync(AppDbContext context)
        {
            int cleanedCount = 0;

            var zeroShareAccIds = await context.ShareAccounts
                .AsNoTracking()
                .Where(sa => sa.TotalShareCount <= 0 && !context.ShareTransactions.Any(t => t.ShareAccountId == sa.ShareAccountId))
                .Select(sa => new { sa.ShareAccountId, sa.MemberId })
                .ToListAsync();

            foreach (var z in zeroShareAccIds)
            {
                var (accRemoved, memRemoved) = await PurgeZeroShareAccountAndOrphanMemberAsync(
                    context,
                    z.ShareAccountId,
                    z.MemberId,
                    reseedIdentities: false);
                if (accRemoved || memRemoved) cleanedCount++;
            }

            var orphanMemberIds = await context.Members
                .AsNoTracking()
                .Where(m => !context.ShareAccounts.Any(sa => sa.MemberId == m.MemberID && sa.TotalShareCount > 0))
                .Select(m => m.MemberID)
                .ToListAsync();

            foreach (var mId in orphanMemberIds)
            {
                var (_, memRemoved) = await PurgeZeroShareAccountAndOrphanMemberAsync(
                    context,
                    shareAccountId: null,
                    memberId: mId,
                    reseedIdentities: false);
                if (memRemoved) cleanedCount++;
            }

            if (cleanedCount > 0)
            {
                await TryReseedShareAndMemberIdentitiesAsync(context);
            }

            return cleanedCount;
        }

        public static async Task TryReseedShareAndMemberIdentitiesAsync(AppDbContext context)
        {
            try
            {
                if (!context.Database.IsRelational()) return;
                string? provider = context.Database.ProviderName;
                if (provider == null || !provider.Contains("SqlServer", StringComparison.OrdinalIgnoreCase)) return;

                int maxCertId = await context.ShareCertificates.MaxAsync(c => (int?)c.CertificateId) ?? 0;
                int maxShareAccId = await context.ShareAccounts.MaxAsync(a => (int?)a.ShareAccountId) ?? 0;
                int maxMemberId = await context.Members.MaxAsync(m => (int?)m.MemberID) ?? 0;

                await context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('ShareCertificates', RESEED, {maxCertId});");
                await context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('ShareAccounts', RESEED, {maxShareAccId});");
                await context.Database.ExecuteSqlInterpolatedAsync($"DBCC CHECKIDENT ('Members', RESEED, {maxMemberId});");
            }
            catch
            {
                // Ignore DBCC CHECKIDENT warnings on restricted environments
            }
        }
    }
}

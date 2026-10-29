using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Dedicated formatting and 8-module batch account/legacy-account resolution engine
    /// for Legacy Daybook (लेगसी रोजकीर्द व कच्ची लेगसी रोजकीर्द).
    /// Leaves the standard CBS Daybook 100% untouched.
    /// </summary>
    public static class LegacyDaybookHelper
    {
        public sealed class ResolvedAccountRef
        {
            public string Module { get; init; } = string.Empty;
            public string? LegacyAccountNo { get; init; }
            public string? NewAccountNo { get; init; }
            public string? ExtraRef { get; init; }
            public string? InstitutionLabel { get; init; }
            public int? CustomerId { get; init; }
            public int? MemberId { get; init; }
            public string? DrCrHint { get; init; }
            public HashSet<int> MatchedLedgerIds { get; init; } = new();
        }

        public sealed class FormattedLegacyLine
        {
            public string Narration { get; init; } = string.Empty;
            public string? DisplayCustomerNo { get; init; }
            public string? DisplayAccountNo { get; init; }
            public bool IsLegacyCustomerNo { get; init; }
            public bool IsLegacyAccountNo { get; init; }
        }

        public sealed class VoucherAccountContext
        {
            internal readonly Dictionary<int, List<ResolvedAccountRef>> ByVoucherId = new();
            internal readonly Dictionary<int, List<ResolvedAccountRef>> ByCustomerId = new();

            internal void AddVoucherRef(int voucherId, ResolvedAccountRef item)
            {
                if (voucherId <= 0) return;
                if (string.IsNullOrWhiteSpace(item.LegacyAccountNo) && string.IsNullOrWhiteSpace(item.NewAccountNo))
                    return;

                if (!ByVoucherId.TryGetValue(voucherId, out var list))
                {
                    list = new List<ResolvedAccountRef>();
                    ByVoucherId[voucherId] = list;
                }

                bool alreadyExists = list.Any(existing =>
                    existing.Module == item.Module &&
                    string.Equals(existing.LegacyAccountNo, item.LegacyAccountNo, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(existing.NewAccountNo, item.NewAccountNo, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(existing.DrCrHint, item.DrCrHint, StringComparison.OrdinalIgnoreCase));

                if (!alreadyExists)
                {
                    list.Add(item);
                }
                else
                {
                    var match = list.First(existing =>
                        existing.Module == item.Module &&
                        string.Equals(existing.LegacyAccountNo, item.LegacyAccountNo, StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(existing.NewAccountNo, item.NewAccountNo, StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(existing.DrCrHint, item.DrCrHint, StringComparison.OrdinalIgnoreCase));
                    foreach (var lid in item.MatchedLedgerIds)
                        match.MatchedLedgerIds.Add(lid);
                }
            }

            internal void AddCustomerRef(int customerId, ResolvedAccountRef item)
            {
                if (customerId <= 0) return;
                if (string.IsNullOrWhiteSpace(item.LegacyAccountNo) && string.IsNullOrWhiteSpace(item.NewAccountNo))
                    return;

                if (!ByCustomerId.TryGetValue(customerId, out var list))
                {
                    list = new List<ResolvedAccountRef>();
                    ByCustomerId[customerId] = list;
                }
                list.Add(item);
            }

            public ResolvedAccountRef? ResolveForDetail(Voucher voucher, VoucherDetail vd)
            {
                int? custId = vd.CustomerID ?? vd.Member?.CustomerID;
                var candidates = new List<ResolvedAccountRef>();

                if (ByVoucherId.TryGetValue(voucher.VoucherID, out var directList))
                    candidates.AddRange(directList);

                if (voucher.RelatedVoucherID.HasValue &&
                    ByVoucherId.TryGetValue(voucher.RelatedVoucherID.Value, out var relList))
                {
                    candidates.AddRange(relList);
                }

                if (candidates.Count > 0)
                {
                    // Tier 1A: Exact LedgerID + DrCrHint match (crucial for FD Renewal where Old FD = Dr & New FD = Cr)
                    var exactLedgerAndDrCr = candidates.FirstOrDefault(c =>
                        c.MatchedLedgerIds.Contains(vd.LedgerID) &&
                        !string.IsNullOrWhiteSpace(c.DrCrHint) &&
                        string.Equals(c.DrCrHint, vd.DrCr, StringComparison.OrdinalIgnoreCase) &&
                        (!custId.HasValue || !c.CustomerId.HasValue || c.CustomerId == custId));
                    if (exactLedgerAndDrCr != null)
                        return exactLedgerAndDrCr;

                    // Tier 1B: Exact LedgerID match (matching customer if present)
                    var exactLedger = candidates.FirstOrDefault(c =>
                        c.MatchedLedgerIds.Contains(vd.LedgerID) &&
                        (!custId.HasValue || !c.CustomerId.HasValue || c.CustomerId == custId));
                    if (exactLedger != null)
                        return exactLedger;

                    // Tier 1C: Exact LedgerID match regardless of customer
                    var anyExactLedger = candidates.FirstOrDefault(c => c.MatchedLedgerIds.Contains(vd.LedgerID));
                    if (anyExactLedger != null)
                        return anyExactLedger;
                }

                // Tier 2: Customer + LedgerID fallback (for Manual Vouchers / Opening Vouchers without sub-ledger tx row)
                if (custId.HasValue && ByCustomerId.TryGetValue(custId.Value, out var custAccounts))
                {
                    var ledgerMatches = custAccounts
                        .Where(a => a.MatchedLedgerIds.Contains(vd.LedgerID))
                        .ToList();

                    if (ledgerMatches.Count == 1)
                        return ledgerMatches[0];

                    if (ledgerMatches.Count > 1)
                    {
                        string narr = voucher.Narration ?? string.Empty;
                        var mentioned = ledgerMatches.FirstOrDefault(a =>
                            (!string.IsNullOrWhiteSpace(a.NewAccountNo) && narr.Contains(a.NewAccountNo, StringComparison.OrdinalIgnoreCase)) ||
                            (!string.IsNullOrWhiteSpace(a.LegacyAccountNo) && narr.Contains(a.LegacyAccountNo, StringComparison.OrdinalIgnoreCase)));
                        if (mentioned != null)
                            return mentioned;

                        return ledgerMatches[0];
                    }
                }

                // Tier 3: Contra Bank / Cash / IBT line on a voucher that already resolved a primary module account
                if (candidates.Count > 0)
                {
                    if (custId.HasValue)
                    {
                        var custDrCrMatch = candidates.FirstOrDefault(c =>
                            c.CustomerId == custId.Value &&
                            !string.IsNullOrWhiteSpace(c.DrCrHint) &&
                            string.Equals(c.DrCrHint, vd.DrCr, StringComparison.OrdinalIgnoreCase));
                        if (custDrCrMatch != null)
                            return custDrCrMatch;

                        var custMatch = candidates.FirstOrDefault(c => c.CustomerId == custId.Value);
                        if (custMatch != null)
                            return custMatch;
                    }

                    return candidates[0];
                }

                return null;
            }
        }

        private static string? FirstNonEmpty(params string?[] values)
        {
            foreach (var val in values)
            {
                if (!string.IsNullOrWhiteSpace(val))
                    return val.Trim();
            }
            return null;
        }

        private static IEnumerable<List<T>> ChunkBy<T>(IEnumerable<T> source, int chunkSize = 800)
        {
            var bucket = new List<T>(chunkSize);
            foreach (var item in source)
            {
                bucket.Add(item);
                if (bucket.Count >= chunkSize)
                {
                    yield return bucket;
                    bucket = new List<T>(chunkSize);
                }
            }
            if (bucket.Count > 0)
                yield return bucket;
        }

        private static string StripLeadingZeros(string digits)
        {
            if (string.IsNullOrWhiteSpace(digits)) return "0";
            string trimmed = digits.TrimStart('0');
            return trimmed.Length == 0 ? "0" : trimmed;
        }

        /// <summary>
        /// Extracts the clean account serial without mistaking the trailing check digit of 14-digit CBS account numbers
        /// (e.g., 001-401-0000212-4 -> 212; 001-001-FD-000007 -> 7; 001-001-FD-000007-R2 -> 7-R2).
        /// </summary>
        private static string ExtractShortAccountSerial(string rawAccPart)
        {
            if (string.IsNullOrWhiteSpace(rawAccPart)) return string.Empty;
            string part = rawAccPart.Trim();
            string collisionSuffix = string.Empty;

            var colMatch = Regex.Match(part, @"^(.*?)(-R\d+)$", RegexOptions.IgnoreCase);
            if (colMatch.Success)
            {
                part = colMatch.Groups[1].Value;
                collisionSuffix = colMatch.Groups[2].Value.ToUpperInvariant();
            }

            // 14-digit CBS Account format: BBB-SSS-NNNNNNN-C (e.g. 001-401-0000212-4)
            var cbs14 = Regex.Match(part, @"(?:^|-)(\d{3})-(\d{3})-(\d{4,8})-(\d)$");
            if (cbs14.Success)
            {
                return StripLeadingZeros(cbs14.Groups[3].Value) + collisionSuffix;
            }

            // Product-tagged serial format: 001-001-FD-000007 or 001-INV-000005 or SH-0012
            var prodSerial = Regex.Match(part, @"(?:FD|RD|SB|SAV|PG|PIGMY|LN|LOAN|INV|SH|SHR|LKR)-0*(\d+)$", RegexOptions.IgnoreCase);
            if (prodSerial.Success)
            {
                return StripLeadingZeros(prodSerial.Groups[1].Value) + collisionSuffix;
            }

            // Generic trailing numeric token
            var tailDigits = Regex.Match(part, @"(?:^|[-/])(\d+)$");
            if (tailDigits.Success)
            {
                return StripLeadingZeros(tailDigits.Groups[1].Value) + collisionSuffix;
            }

            return part + collisionSuffix;
        }

        /// <summary>
        /// Converts verbose system voucher numbers (e.g. 001-PAY-26-27-00013, JV-FD-REN-001-001-FD-000007)
        /// into concise single-line voucher codes (e.g. PAY-13, FD-REN-7).
        /// </summary>
        public static string FormatShortVoucherNo(string? rawVoucherNo)
        {
            if (string.IsNullOrWhiteSpace(rawVoucherNo))
                return string.Empty;

            string v = rawVoucherNo.Trim();

            // 1A. Standard CBS format: 001-PAY-26-27-00013 / HQ-JV-26-27-00005
            var mStd = Regex.Match(v, @"^(?:[A-Za-z0-9]+[-/])?(PAY|REC|JV|JNL|CTR|CON|RV|PV)[-/](?:\d{2,4}[-/]\d{2,4}[-/])?(\d+)$", RegexOptions.IgnoreCase);
            if (mStd.Success)
            {
                return $"{mStd.Groups[1].Value.ToUpperInvariant()}-{StripLeadingZeros(mStd.Groups[2].Value)}";
            }

            // 1B. Slash CBS format: BR01/26-27/REC/000012
            var mSlash = Regex.Match(v, @"^[A-Za-z0-9]+[-/]\d{2,4}[-/]\d{2,4}[-/](PAY|REC|JV|JNL|CTR|CON|RV|PV)[-/](\d+)$", RegexOptions.IgnoreCase);
            if (mSlash.Success)
            {
                return $"{mSlash.Groups[1].Value.ToUpperInvariant()}-{StripLeadingZeros(mSlash.Groups[2].Value)}";
            }

            // 2. Fixed Deposit (FD) patterns
            var mFdOp = Regex.Match(v, @"^(?:REC|JV)-FD-OP-(.+)$", RegexOptions.IgnoreCase);
            if (mFdOp.Success) return $"FD-OP-{ExtractShortAccountSerial(mFdOp.Groups[1].Value)}";

            var mFdRen = Regex.Match(v, @"^(?:JV|RV)-FD-(?:AUTO)?REN-(.+)$", RegexOptions.IgnoreCase);
            if (mFdRen.Success) return $"FD-REN-{ExtractShortAccountSerial(mFdRen.Groups[1].Value)}";

            var mFdInt = Regex.Match(v, @"^(?:JV|PAY)-FD-INT-(.+)$", RegexOptions.IgnoreCase);
            if (mFdInt.Success) return $"FD-INT-{ExtractShortAccountSerial(mFdInt.Groups[1].Value)}";

            var mFdPre = Regex.Match(v, @"^(?:JV|PV-[^-]+-\d{8})-FD-PRECLOSE-(.+)$", RegexOptions.IgnoreCase);
            if (mFdPre.Success) return $"FD-PCLS-{ExtractShortAccountSerial(mFdPre.Groups[1].Value)}";

            var mFdCls = Regex.Match(v, @"^(?:JV|PV-[^-]+-\d{8})-FD-CLOSE-(.+)$", RegexOptions.IgnoreCase);
            if (mFdCls.Success) return $"FD-CLS-{ExtractShortAccountSerial(mFdCls.Groups[1].Value)}";

            if (v.StartsWith("JV-FD-PROV-", StringComparison.OrdinalIgnoreCase)) return "FD-PROV";
            if (v.StartsWith("REC-FD-BLK-", StringComparison.OrdinalIgnoreCase)) return "FD-BLK";
            if (Regex.IsMatch(v, @"-MIS-BR\d+-", RegexOptions.IgnoreCase)) return "FD-MIS";

            // 3. Recurring Deposit (RD) patterns
            var mRdOp = Regex.Match(v, @"^JV-RD-OP-(.+)$", RegexOptions.IgnoreCase);
            if (mRdOp.Success) return $"RD-OP-{ExtractShortAccountSerial(mRdOp.Groups[1].Value)}";

            var mRdColl = Regex.Match(v, @"^(?:JV|RV-[^-]+-\d{8})-RD-COLL-(.+)-(\d+)$", RegexOptions.IgnoreCase);
            if (mRdColl.Success)
                return $"RD-{ExtractShortAccountSerial(mRdColl.Groups[1].Value)}/#{StripLeadingZeros(mRdColl.Groups[2].Value)}";

            var mRdPre = Regex.Match(v, @"^(?:JV|PV-[^-]+-\d{8})-RD-PRECLOSE-(.+)$", RegexOptions.IgnoreCase);
            if (mRdPre.Success) return $"RD-PCLS-{ExtractShortAccountSerial(mRdPre.Groups[1].Value)}";

            var mRdCls = Regex.Match(v, @"^(?:JV|PV-[^-]+-\d{8})-RD-CLOSE-(.+)$", RegexOptions.IgnoreCase);
            if (mRdCls.Success) return $"RD-CLS-{ExtractShortAccountSerial(mRdCls.Groups[1].Value)}";

            var mRdRen = Regex.Match(v, @"^JV-RD-REN-(.+)$", RegexOptions.IgnoreCase);
            if (mRdRen.Success) return $"RD-REN-{ExtractShortAccountSerial(mRdRen.Groups[1].Value)}";

            if (v.StartsWith("JV-RD-PROV-", StringComparison.OrdinalIgnoreCase)) return "RD-PROV";

            // 4. Investment patterns
            var mInv = Regex.Match(v, @"^(?:PAY|REC|JV)-INV-(OP|MAT|PRE|INT)-(.+)$", RegexOptions.IgnoreCase);
            if (mInv.Success)
                return $"INV-{mInv.Groups[1].Value.ToUpperInvariant()}-{ExtractShortAccountSerial(mInv.Groups[2].Value)}";

            if (v.StartsWith("JV-INV-ACC-", StringComparison.OrdinalIgnoreCase)) return "INV-ACC";

            // 5. Saving / Share / Locker / Pigmy date-stamped patterns
            var mSav = Regex.Match(v, @"^VCH-SAV-(OPN|CLS|INT)-(?:[^-]+-)?\d{8}-(\d+)$", RegexOptions.IgnoreCase);
            if (mSav.Success)
                return $"SAV-{mSav.Groups[1].Value.ToUpperInvariant()}-{StripLeadingZeros(mSav.Groups[2].Value)}";

            var mShr = Regex.Match(v, @"^VCH-SHR-(?:(WD|FEE|CNL)-)?\d{8}-(\d+)$", RegexOptions.IgnoreCase);
            if (mShr.Success)
            {
                string tag = mShr.Groups[1].Success && !string.IsNullOrWhiteSpace(mShr.Groups[1].Value)
                    ? $"{mShr.Groups[1].Value.ToUpperInvariant()}-"
                    : string.Empty;
                return $"SHR-{tag}{StripLeadingZeros(mShr.Groups[2].Value)}";
            }

            var mShOp = Regex.Match(v, @"^JV-SH-OP-(.+)$", RegexOptions.IgnoreCase);
            if (mShOp.Success) return $"SHR-OP-{ExtractShortAccountSerial(mShOp.Groups[1].Value)}";

            var mClm = Regex.Match(v, @"^VCH-CLM-\d{8}-(\d+)$", RegexOptions.IgnoreCase);
            if (mClm.Success) return $"CLM-{StripLeadingZeros(mClm.Groups[1].Value)}";

            var mLkr = Regex.Match(v, @"^VCH-LKR-(DEP|RNT|REN|REF)-\d{8}-(\d+)$", RegexOptions.IgnoreCase);
            if (mLkr.Success)
                return $"LKR-{mLkr.Groups[1].Value.ToUpperInvariant()}-{StripLeadingZeros(mLkr.Groups[2].Value)}";

            var mPgWdrClo = Regex.Match(v, @"^(?:VCH|JV-PIGMY|PV-[^-]+-\d{8}-PIGMY)-(WDR|CLO)-\d{8}-(\d+)$", RegexOptions.IgnoreCase);
            if (mPgWdrClo.Success)
                return $"PG-{mPgWdrClo.Groups[1].Value.ToUpperInvariant()}-{StripLeadingZeros(mPgWdrClo.Groups[2].Value)}";

            var mPgWdrClo2 = Regex.Match(v, @"^PV-[^-]+-\d{8}-PIGMY-(WDR|CLO)-(\d+)$", RegexOptions.IgnoreCase);
            if (mPgWdrClo2.Success)
                return $"PG-{mPgWdrClo2.Groups[1].Value.ToUpperInvariant()}-{StripLeadingZeros(mPgWdrClo2.Groups[2].Value)}";

            var mPgInt = Regex.Match(v, @"^VCH-INT-\d{8}-(\d+)$", RegexOptions.IgnoreCase);
            if (mPgInt.Success) return $"PG-INT-{StripLeadingZeros(mPgInt.Groups[1].Value)}";

            var mPgPvTag = Regex.Match(v, @"^PV-\d+-\d{8}-(APP|BLK|OPN|AUD)(?:-(\d+))?(?:-([A-Za-z0-9]{4}))?$", RegexOptions.IgnoreCase);
            if (mPgPvTag.Success)
            {
                string tag = mPgPvTag.Groups[1].Value.ToUpperInvariant();
                string seqPart = mPgPvTag.Groups[2].Success && !string.IsNullOrWhiteSpace(mPgPvTag.Groups[2].Value)
                    ? StripLeadingZeros(mPgPvTag.Groups[2].Value)
                    : (mPgPvTag.Groups[3].Success ? mPgPvTag.Groups[3].Value : string.Empty);
                return string.IsNullOrEmpty(seqPart) ? $"PG-{tag}" : $"PG-{tag}-{seqPart}";
            }

            var mPgPvHash = Regex.Match(v, @"^PV-\d+-\d{8}-\d{6}-([A-Za-z0-9]{4})$", RegexOptions.IgnoreCase);
            if (mPgPvHash.Success) return $"PG-{mPgPvHash.Groups[1].Value}";

            var mComm = Regex.Match(v, @"^VCH-COMM-\d+-\d{8}-([A-Za-z0-9]{4})$", RegexOptions.IgnoreCase);
            if (mComm.Success) return $"COMM-{mComm.Groups[1].Value}";

            var mSbAgt = Regex.Match(v, @"^SB-AGT-(\d+)-\d+$", RegexOptions.IgnoreCase);
            if (mSbAgt.Success) return $"SB-AGT-{mSbAgt.Groups[1].Value}";

            var mVchSimple = Regex.Match(v, @"^VCH-\d{8}-(\d+)$", RegexOptions.IgnoreCase);
            if (mVchSimple.Success) return $"VCH-{StripLeadingZeros(mVchSimple.Groups[1].Value)}";

            // 6. Clean fallback for any custom long voucher string
            if (v.Length <= 12)
                return v;

            string compact = Regex.Replace(v, @"[-/]\d{8}(?=[-/]|$)", string.Empty);
            compact = Regex.Replace(compact, @"[-/]\d{2}-\d{2}(?=[-/])", string.Empty);
            compact = Regex.Replace(compact, @"^\d{3}-(?=[A-Za-z])", string.Empty);
            compact = Regex.Replace(compact, @"(?<=[-/])0+(\d+)", "$1");
            return compact;
        }

        private static string? TryExtractEmbeddedAccountNo(string? voucherNo, string marker)
        {
            if (string.IsNullOrWhiteSpace(voucherNo)) return null;
            int idx = voucherNo.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (idx < 0) return null;
            string tail = voucherNo.Substring(idx + marker.Length).Trim();
            tail = Regex.Replace(tail, @"-R\d+$", string.Empty, RegexOptions.IgnoreCase);
            return string.IsNullOrWhiteSpace(tail) ? null : tail;
        }

        /// <summary>
        /// Batch-loads account and legacy-account mappings across all 8 banking modules
        /// for the given list of vouchers in chunked AsNoTracking queries (Zero N+1 queries).
        /// </summary>
        public static async Task<VoucherAccountContext> BuildVoucherAccountContextAsync(
            AppDbContext context,
            IReadOnlyList<Voucher> vouchers,
            IReadOnlyList<Ledger> allLedgers)
        {
            var ctx = new VoucherAccountContext();
            if (vouchers == null || vouchers.Count == 0)
                return ctx;

            var voucherIdSet = new HashSet<int>();
            var voucherNoToIds = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
            var customerIdSet = new HashSet<int>();

            foreach (var v in vouchers)
            {
                if (v.VoucherID > 0)
                    voucherIdSet.Add(v.VoucherID);
                if (v.RelatedVoucherID.HasValue && v.RelatedVoucherID.Value > 0)
                    voucherIdSet.Add(v.RelatedVoucherID.Value);

                if (!string.IsNullOrWhiteSpace(v.VoucherNo))
                {
                    string vNo = v.VoucherNo.Trim();
                    if (!voucherNoToIds.TryGetValue(vNo, out var idList))
                    {
                        idList = new List<int>();
                        voucherNoToIds[vNo] = idList;
                    }
                    if (!idList.Contains(v.VoucherID))
                        idList.Add(v.VoucherID);
                }

                foreach (var vd in v.VoucherDetails)
                {
                    int? cid = vd.CustomerID ?? vd.Member?.CustomerID;
                    if (cid.HasValue && cid.Value > 0)
                        customerIdSet.Add(cid.Value);
                }
            }

            // Resolve global Saving, Share, and Investment fallback ledger sets
            var savingLedgerIds = (await context.SavingVoucherMappings.AsNoTracking()
                .Select(m => m.LedgerID)
                .ToListAsync()).ToHashSet();

            foreach (var l in allLedgers)
            {
                string ln = l.LedgerName ?? string.Empty;
                if (ln.Contains("सेव्हिंग", StringComparison.OrdinalIgnoreCase) ||
                    ln.Contains("बचत", StringComparison.OrdinalIgnoreCase) ||
                    ln.Contains("Saving", StringComparison.OrdinalIgnoreCase))
                {
                    savingLedgerIds.Add(l.LedgerID);
                }
            }

            var shareSchemes = await context.ShareSchemes.AsNoTracking().ToListAsync();
            var shareLedgerIds = new HashSet<int>();
            foreach (var ss in shareSchemes)
            {
                if (ss.ShareCapitalLedgerID.HasValue) shareLedgerIds.Add(ss.ShareCapitalLedgerID.Value);
                if (ss.EntranceFeeLedgerID.HasValue) shareLedgerIds.Add(ss.EntranceFeeLedgerID.Value);
                if (ss.ShareTransferFeeLedgerID.HasValue) shareLedgerIds.Add(ss.ShareTransferFeeLedgerID.Value);
                if (ss.BuildingFundLedgerID.HasValue) shareLedgerIds.Add(ss.BuildingFundLedgerID.Value);
                if (ss.DividendPayableLedgerID.HasValue) shareLedgerIds.Add(ss.DividendPayableLedgerID.Value);
            }
            foreach (var l in allLedgers)
            {
                string ln = l.LedgerName ?? string.Empty;
                if (ln.Contains("शेअर", StringComparison.OrdinalIgnoreCase) ||
                    ln.Contains("भाग भांडवल", StringComparison.OrdinalIgnoreCase) ||
                    ln.Contains("Share", StringComparison.OrdinalIgnoreCase))
                {
                    shareLedgerIds.Add(l.LedgerID);
                }
            }

            var invVoucherMappings = await context.InvestmentVoucherMappings.AsNoTracking().ToListAsync();
            var globalInvLedgerIds = new HashSet<int>();
            foreach (var im in invVoucherMappings)
            {
                if (im.InvestmentLedgerID > 0) globalInvLedgerIds.Add(im.InvestmentLedgerID);
                if (im.InterestIncomeLedgerID > 0) globalInvLedgerIds.Add(im.InterestIncomeLedgerID);
                if (im.InterestReceivableLedgerID > 0) globalInvLedgerIds.Add(im.InterestReceivableLedgerID);
            }

            static HashSet<int> BuildFdLedgers(int? l1, int? l2, int? l3)
            {
                var s = new HashSet<int>();
                if (l1.HasValue && l1.Value > 0) s.Add(l1.Value);
                if (l2.HasValue && l2.Value > 0) s.Add(l2.Value);
                if (l3.HasValue && l3.Value > 0) s.Add(l3.Value);
                return s;
            }

            static HashSet<int> BuildRdLedgers(int? l1, int? l2, int? l3, int? l4)
            {
                var s = BuildFdLedgers(l1, l2, l3);
                if (l4.HasValue && l4.Value > 0) s.Add(l4.Value);
                return s;
            }

            static HashSet<int> BuildLoanLedgers(
                int? loanL, int? intL, int? ovdL, int? recL, int? surL, int? recFeeL, int? procFeeL,
                IEnumerable<int>? extraLedgers = null)
            {
                var s = new HashSet<int>();
                if (loanL.HasValue && loanL.Value > 0) s.Add(loanL.Value);
                if (intL.HasValue && intL.Value > 0) s.Add(intL.Value);
                if (ovdL.HasValue && ovdL.Value > 0) s.Add(ovdL.Value);
                if (recL.HasValue && recL.Value > 0) s.Add(recL.Value);
                if (surL.HasValue && surL.Value > 0) s.Add(surL.Value);
                if (recFeeL.HasValue && recFeeL.Value > 0) s.Add(recFeeL.Value);
                if (procFeeL.HasValue && procFeeL.Value > 0) s.Add(procFeeL.Value);
                if (extraLedgers != null)
                {
                    foreach (var el in extraLedgers)
                        if (el > 0) s.Add(el);
                }
                return s;
            }

            // =========================================================================
            // CHUNKED QUERIES BY VOUCHER ID (FD, Loan, RD, Pigmy, Investment, Shares)
            // =========================================================================
            foreach (var idChunk in ChunkBy(voucherIdSet, 800))
            {
                // 1. FD Module (FdTransactions, FdInterestAccruals, FdMisPayouts, FdAutoRenewalLogs)
                var fdTxs = await context.FdTransactions.AsNoTracking()
                    .Where(t => idChunk.Contains(t.VoucherID) && t.FdAccount != null)
                    .Select(t => new
                    {
                        t.VoucherID,
                        t.TransactionType,
                        t.DebitCredit,
                        t.FdAccount!.CustomerID,
                        t.FdAccount.AccountNo,
                        t.FdAccount.LegacyAccountNumber,
                        LiabL = t.FdAccount.FdScheme != null ? t.FdAccount.FdScheme.FdLiabilityLedgerID : null,
                        ExpL = t.FdAccount.FdScheme != null ? t.FdAccount.FdScheme.InterestExpenseLedgerID : null,
                        PayL = t.FdAccount.FdScheme != null ? t.FdAccount.FdScheme.InterestPayableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in fdTxs)
                {
                    bool isAccrualOnly = string.Equals(row.TransactionType, "Accrual", StringComparison.OrdinalIgnoreCase);
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "FD",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.AccountNo),
                        CustomerId = row.CustomerID,
                        DrCrHint = FirstNonEmpty(row.DebitCredit),
                        MatchedLedgerIds = isAccrualOnly
                            ? BuildFdLedgers(null, row.ExpL, row.PayL)
                            : BuildFdLedgers(row.LiabL, row.ExpL, row.PayL)
                    });
                }

                var fdAccruals = await context.FdInterestAccruals.AsNoTracking()
                    .Where(a => idChunk.Contains(a.VoucherID) && a.FdAccount != null)
                    .Select(a => new
                    {
                        a.VoucherID,
                        a.FdAccount!.CustomerID,
                        a.FdAccount.AccountNo,
                        a.FdAccount.LegacyAccountNumber,
                        LiabL = a.FdAccount.FdScheme != null ? a.FdAccount.FdScheme.FdLiabilityLedgerID : null,
                        ExpL = a.FdAccount.FdScheme != null ? a.FdAccount.FdScheme.InterestExpenseLedgerID : null,
                        PayL = a.FdAccount.FdScheme != null ? a.FdAccount.FdScheme.InterestPayableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in fdAccruals)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "FD",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.AccountNo),
                        CustomerId = row.CustomerID,
                        MatchedLedgerIds = BuildFdLedgers(row.LiabL, row.ExpL, row.PayL)
                    });
                }

                var fdMis = await context.FdMisPayouts.AsNoTracking()
                    .Where(p => p.VoucherID.HasValue && idChunk.Contains(p.VoucherID.Value) && p.FdAccount != null)
                    .Select(p => new
                    {
                        VoucherID = p.VoucherID!.Value,
                        p.FdAccount!.CustomerID,
                        p.FdAccount.AccountNo,
                        p.FdAccount.LegacyAccountNumber,
                        LiabL = p.FdAccount.FdScheme != null ? p.FdAccount.FdScheme.FdLiabilityLedgerID : null,
                        ExpL = p.FdAccount.FdScheme != null ? p.FdAccount.FdScheme.InterestExpenseLedgerID : null,
                        PayL = p.FdAccount.FdScheme != null ? p.FdAccount.FdScheme.InterestPayableLedgerID : null,
                        SavAccNo = p.TargetSavingAccount != null ? p.TargetSavingAccount.AccountNo : null,
                        SavLegNo = p.TargetSavingAccount != null ? (p.TargetSavingAccount.LegacyAccountNumber ?? p.TargetSavingAccount.OldAccountNo ?? p.TargetSavingAccount.PreviousAccountNo) : null
                    })
                    .ToListAsync();

                foreach (var row in fdMis)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "FD",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.AccountNo),
                        CustomerId = row.CustomerID,
                        DrCrHint = "Dr",
                        MatchedLedgerIds = BuildFdLedgers(row.LiabL, row.ExpL, row.PayL)
                    });

                    if (!string.IsNullOrWhiteSpace(row.SavAccNo) || !string.IsNullOrWhiteSpace(row.SavLegNo))
                    {
                        ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                        {
                            Module = "Saving",
                            LegacyAccountNo = FirstNonEmpty(row.SavLegNo),
                            NewAccountNo = FirstNonEmpty(row.SavAccNo),
                            CustomerId = row.CustomerID,
                            DrCrHint = "Cr",
                            MatchedLedgerIds = new HashSet<int>(savingLedgerIds)
                        });
                    }
                }

                var fdAutoRen = await context.FdAutoRenewalLogs.AsNoTracking()
                    .Where(r => r.VoucherID.HasValue && idChunk.Contains(r.VoucherID.Value))
                    .Select(r => new
                    {
                        VoucherID = r.VoucherID!.Value,
                        r.CustomerID,
                        r.OldAccountNo,
                        OldLegNo = r.OldFdAccount != null ? r.OldFdAccount.LegacyAccountNumber : null,
                        OldL1 = r.OldFdAccount != null && r.OldFdAccount.FdScheme != null ? r.OldFdAccount.FdScheme.FdLiabilityLedgerID : null,
                        OldL2 = r.OldFdAccount != null && r.OldFdAccount.FdScheme != null ? r.OldFdAccount.FdScheme.InterestExpenseLedgerID : null,
                        OldL3 = r.OldFdAccount != null && r.OldFdAccount.FdScheme != null ? r.OldFdAccount.FdScheme.InterestPayableLedgerID : null,
                        r.NewAccountNo,
                        NewLegNo = r.NewFdAccount != null ? r.NewFdAccount.LegacyAccountNumber : null,
                        NewL1 = r.NewFdAccount != null && r.NewFdAccount.FdScheme != null ? r.NewFdAccount.FdScheme.FdLiabilityLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in fdAutoRen)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "FD",
                        LegacyAccountNo = FirstNonEmpty(row.OldLegNo),
                        NewAccountNo = FirstNonEmpty(row.OldAccountNo),
                        CustomerId = row.CustomerID,
                        DrCrHint = "Dr",
                        MatchedLedgerIds = BuildFdLedgers(row.OldL1, row.OldL2, row.OldL3)
                    });
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "FD",
                        LegacyAccountNo = FirstNonEmpty(row.NewLegNo),
                        NewAccountNo = FirstNonEmpty(row.NewAccountNo),
                        CustomerId = row.CustomerID,
                        DrCrHint = "Cr",
                        MatchedLedgerIds = BuildFdLedgers(row.NewL1, null, null)
                    });
                }

                // 2. Loan Collection & Overdue Recovery
                var loanCols = await context.LoanCollections.AsNoTracking()
                    .Where(lc => ((lc.VoucherID.HasValue && idChunk.Contains(lc.VoucherID.Value)) ||
                                  (lc.HomeBranchVoucherID.HasValue && idChunk.Contains(lc.HomeBranchVoucherID.Value)))
                                 && lc.LoanAccount != null)
                    .Select(lc => new
                    {
                        lc.VoucherID,
                        lc.HomeBranchVoucherID,
                        lc.LoanAccount!.CustomerID,
                        lc.LoanAccount.MemberID,
                        lc.LoanAccount.LoanAccountNo,
                        lc.LoanAccount.LegacyAccountNumber,
                        L1 = lc.LoanAccount.LoanRate != null ? lc.LoanAccount.LoanRate.LoanLedgerID : null,
                        L2 = lc.LoanAccount.LoanRate != null ? lc.LoanAccount.LoanRate.InterestLedgerID : null,
                        L3 = lc.LoanAccount.LoanRate != null ? lc.LoanAccount.LoanRate.OverdueInterestLedgerID : null,
                        L4 = lc.LoanAccount.LoanRate != null ? lc.LoanAccount.LoanRate.ReceivableInterestLedgerID : null,
                        L5 = lc.LoanAccount.LoanRate != null ? lc.LoanAccount.LoanRate.SurchargeLedgerID : null,
                        L6 = lc.LoanAccount.LoanRate != null ? lc.LoanAccount.LoanRate.RecoveryFeeLedgerID : null,
                        L7 = lc.LoanAccount.LoanRate != null ? lc.LoanAccount.LoanRate.ProcessingFeeLedgerID : null,
                        FeeLedgers = lc.Fees.Select(f => f.LedgerID).ToList()
                    })
                    .ToListAsync();

                foreach (var row in loanCols)
                {
                    var refObj = new ResolvedAccountRef
                    {
                        Module = "Loan",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.LoanAccountNo),
                        CustomerId = row.CustomerID,
                        MemberId = row.MemberID,
                        DrCrHint = "Cr",
                        MatchedLedgerIds = BuildLoanLedgers(row.L1, row.L2, row.L3, row.L4, row.L5, row.L6, row.L7, row.FeeLedgers)
                    };
                    if (row.VoucherID.HasValue) ctx.AddVoucherRef(row.VoucherID.Value, refObj);
                    if (row.HomeBranchVoucherID.HasValue) ctx.AddVoucherRef(row.HomeBranchVoucherID.Value, refObj);
                }

                // 3. Loan Disbursement
                var loanDisbs = await context.LoanDisbursements.AsNoTracking()
                    .Where(ld => ld.VoucherID.HasValue && idChunk.Contains(ld.VoucherID.Value) && ld.LoanAccount != null)
                    .Select(ld => new
                    {
                        VoucherID = ld.VoucherID!.Value,
                        ld.LoanAccount!.CustomerID,
                        ld.LoanAccount.MemberID,
                        ld.LoanAccount.LoanAccountNo,
                        ld.LoanAccount.LegacyAccountNumber,
                        L1 = ld.LoanAccount.LoanRate != null ? ld.LoanAccount.LoanRate.LoanLedgerID : null,
                        L2 = ld.LoanAccount.LoanRate != null ? ld.LoanAccount.LoanRate.InterestLedgerID : null,
                        L3 = ld.LoanAccount.LoanRate != null ? ld.LoanAccount.LoanRate.OverdueInterestLedgerID : null,
                        L4 = ld.LoanAccount.LoanRate != null ? ld.LoanAccount.LoanRate.ReceivableInterestLedgerID : null,
                        L5 = ld.LoanAccount.LoanRate != null ? ld.LoanAccount.LoanRate.SurchargeLedgerID : null,
                        L6 = ld.LoanAccount.LoanRate != null ? ld.LoanAccount.LoanRate.RecoveryFeeLedgerID : null,
                        L7 = ld.LoanAccount.LoanRate != null ? ld.LoanAccount.LoanRate.ProcessingFeeLedgerID : null,
                        DedLedgers = ld.Deductions.Select(d => d.LedgerID).ToList()
                    })
                    .ToListAsync();

                foreach (var row in loanDisbs)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Loan",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.LoanAccountNo),
                        CustomerId = row.CustomerID,
                        MemberId = row.MemberID,
                        DrCrHint = "Dr",
                        MatchedLedgerIds = BuildLoanLedgers(row.L1, row.L2, row.L3, row.L4, row.L5, row.L6, row.L7, row.DedLedgers)
                    });
                }

                var ovdRecs = await context.OverdueRecoveryLedgers.AsNoTracking()
                    .Where(o => o.VoucherID.HasValue && idChunk.Contains(o.VoucherID.Value) && o.LoanAccount != null)
                    .Select(o => new
                    {
                        VoucherID = o.VoucherID!.Value,
                        o.LoanAccount!.CustomerID,
                        o.LoanAccount.MemberID,
                        o.LoanAccount.LoanAccountNo,
                        o.LoanAccount.LegacyAccountNumber,
                        L1 = o.LoanAccount.LoanRate != null ? o.LoanAccount.LoanRate.LoanLedgerID : null,
                        L2 = o.LoanAccount.LoanRate != null ? o.LoanAccount.LoanRate.InterestLedgerID : null,
                        L3 = o.LoanAccount.LoanRate != null ? o.LoanAccount.LoanRate.OverdueInterestLedgerID : null,
                        L4 = o.LoanAccount.LoanRate != null ? o.LoanAccount.LoanRate.ReceivableInterestLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in ovdRecs)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Loan",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.LoanAccountNo),
                        CustomerId = row.CustomerID,
                        MemberId = row.MemberID,
                        MatchedLedgerIds = BuildLoanLedgers(row.L1, row.L2, row.L3, row.L4, null, null, null)
                    });
                }

                // 4. RD Module (RdTransactions, RDInstallmentSchedules, RdInterestAccruals)
                var rdTxs = await context.RdTransactions.AsNoTracking()
                    .Where(t => idChunk.Contains(t.VoucherID) && t.RdAccount != null)
                    .Select(t => new
                    {
                        t.VoucherID,
                        t.DebitCredit,
                        t.RdAccount!.CustomerID,
                        t.RdAccount.AccountNo,
                        t.RdAccount.LegacyAccountNumber,
                        L1 = t.RdAccount.RdScheme != null ? t.RdAccount.RdScheme.RdLiabilityLedgerID : null,
                        L2 = t.RdAccount.RdScheme != null ? t.RdAccount.RdScheme.InterestExpenseLedgerID : null,
                        L3 = t.RdAccount.RdScheme != null ? t.RdAccount.RdScheme.InterestPayableLedgerID : null,
                        L4 = t.RdAccount.RdScheme != null ? t.RdAccount.RdScheme.PenaltyIncomeLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in rdTxs)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "RD",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.AccountNo),
                        CustomerId = row.CustomerID,
                        DrCrHint = FirstNonEmpty(row.DebitCredit),
                        MatchedLedgerIds = BuildRdLedgers(row.L1, row.L2, row.L3, row.L4)
                    });
                }

                var rdScheds = await context.RDInstallmentSchedules.AsNoTracking()
                    .Where(s => s.VoucherID.HasValue && idChunk.Contains(s.VoucherID.Value) && s.RdAccount != null)
                    .Select(s => new
                    {
                        VoucherID = s.VoucherID!.Value,
                        s.RdAccount!.CustomerID,
                        s.RdAccount.AccountNo,
                        s.RdAccount.LegacyAccountNumber,
                        L1 = s.RdAccount.RdScheme != null ? s.RdAccount.RdScheme.RdLiabilityLedgerID : null,
                        L2 = s.RdAccount.RdScheme != null ? s.RdAccount.RdScheme.InterestExpenseLedgerID : null,
                        L3 = s.RdAccount.RdScheme != null ? s.RdAccount.RdScheme.InterestPayableLedgerID : null,
                        L4 = s.RdAccount.RdScheme != null ? s.RdAccount.RdScheme.PenaltyIncomeLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in rdScheds)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "RD",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.AccountNo),
                        CustomerId = row.CustomerID,
                        DrCrHint = "Cr",
                        MatchedLedgerIds = BuildRdLedgers(row.L1, row.L2, row.L3, row.L4)
                    });
                }

                var rdAccruals = await context.RdInterestAccruals.AsNoTracking()
                    .Where(a => idChunk.Contains(a.VoucherID) && a.RdAccount != null)
                    .Select(a => new
                    {
                        a.VoucherID,
                        a.RdAccount!.CustomerID,
                        a.RdAccount.AccountNo,
                        a.RdAccount.LegacyAccountNumber,
                        L1 = a.RdAccount.RdScheme != null ? a.RdAccount.RdScheme.RdLiabilityLedgerID : null,
                        L2 = a.RdAccount.RdScheme != null ? a.RdAccount.RdScheme.InterestExpenseLedgerID : null,
                        L3 = a.RdAccount.RdScheme != null ? a.RdAccount.RdScheme.InterestPayableLedgerID : null,
                        L4 = a.RdAccount.RdScheme != null ? a.RdAccount.RdScheme.PenaltyIncomeLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in rdAccruals)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "RD",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(row.AccountNo),
                        CustomerId = row.CustomerID,
                        MatchedLedgerIds = BuildRdLedgers(row.L1, row.L2, row.L3, row.L4)
                    });
                }

                // 5. Pigmy Module (PigmyCollections, PigmyInterestLogs)
                var pgCols = await context.PigmyCollections.AsNoTracking()
                    .Where(p => p.VoucherId.HasValue && idChunk.Contains(p.VoucherId.Value) && p.PigmyAccount != null)
                    .Select(p => new
                    {
                        VoucherID = p.VoucherId!.Value,
                        p.PigmyAccount!.CustomerID,
                        p.PigmyAccount.AccountNo,
                        p.PigmyAccount.LegacyAccountNumber,
                        p.PigmyAccount.OldAccountNo,
                        p.PigmyAccount.PreviousAccountNo,
                        L1 = p.PigmyAccount.PigmyScheme != null ? p.PigmyAccount.PigmyScheme.PigmyLiabilityLedgerID : null,
                        L2 = p.PigmyAccount.PigmyScheme != null ? p.PigmyAccount.PigmyScheme.InterestExpenseLedgerID : null,
                        L3 = p.PigmyAccount.PigmyScheme != null ? p.PigmyAccount.PigmyScheme.InterestPayableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in pgCols)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Pigmy",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber, row.OldAccountNo, row.PreviousAccountNo),
                        NewAccountNo = FirstNonEmpty(row.AccountNo),
                        CustomerId = row.CustomerID,
                        DrCrHint = "Cr",
                        MatchedLedgerIds = BuildFdLedgers(row.L1, row.L2, row.L3)
                    });
                }

                var pgInts = await context.PigmyInterestLogs.AsNoTracking()
                    .Where(p => p.VoucherId.HasValue && idChunk.Contains(p.VoucherId.Value) && p.PigmyAccount != null)
                    .Select(p => new
                    {
                        VoucherID = p.VoucherId!.Value,
                        p.PigmyAccount!.CustomerID,
                        p.PigmyAccount.AccountNo,
                        p.PigmyAccount.LegacyAccountNumber,
                        p.PigmyAccount.OldAccountNo,
                        p.PigmyAccount.PreviousAccountNo,
                        L1 = p.PigmyAccount.PigmyScheme != null ? p.PigmyAccount.PigmyScheme.PigmyLiabilityLedgerID : null,
                        L2 = p.PigmyAccount.PigmyScheme != null ? p.PigmyAccount.PigmyScheme.InterestExpenseLedgerID : null,
                        L3 = p.PigmyAccount.PigmyScheme != null ? p.PigmyAccount.PigmyScheme.InterestPayableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in pgInts)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Pigmy",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber, row.OldAccountNo, row.PreviousAccountNo),
                        NewAccountNo = FirstNonEmpty(row.AccountNo),
                        CustomerId = row.CustomerID,
                        MatchedLedgerIds = BuildFdLedgers(row.L1, row.L2, row.L3)
                    });
                }

                // 6. Investment Module (InterestReceipts, Maturities, PrematureWithdrawals, InterestAccruals, Renewals)
                HashSet<int> BuildInvLedgers(int? l1, int? l2, int? l3)
                {
                    var s = BuildFdLedgers(l1, l2, l3);
                    foreach (var gl in globalInvLedgerIds) s.Add(gl);
                    return s;
                }

                var invReceipts = await context.InvestmentInterestReceipts.AsNoTracking()
                    .Where(x => x.VoucherID.HasValue && idChunk.Contains(x.VoucherID.Value) && x.InvestmentAccount != null)
                    .Select(x => new
                    {
                        VoucherID = x.VoucherID!.Value,
                        x.InvestmentAccount!.InvestmentNo,
                        x.InvestmentAccount.OldInvestmentNo,
                        x.InvestmentAccount.DepositReceiptNo,
                        InstName = x.InvestmentAccount.InvestmentInstitution != null ? x.InvestmentAccount.InvestmentInstitution.InstitutionName : null,
                        SchemeName = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.SchemeName : null,
                        L1 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InvestmentAssetLedgerID : null,
                        L2 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InterestIncomeLedgerID : null,
                        L3 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InterestReceivableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in invReceipts)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Investment",
                        LegacyAccountNo = FirstNonEmpty(row.OldInvestmentNo),
                        NewAccountNo = FirstNonEmpty(row.InvestmentNo),
                        ExtraRef = FirstNonEmpty(row.DepositReceiptNo),
                        InstitutionLabel = string.Join(" - ", new[] { row.InstName, row.SchemeName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                        MatchedLedgerIds = BuildInvLedgers(row.L1, row.L2, row.L3)
                    });
                }

                var invMats = await context.InvestmentMaturities.AsNoTracking()
                    .Where(x => x.VoucherID.HasValue && idChunk.Contains(x.VoucherID.Value) && x.InvestmentAccount != null)
                    .Select(x => new
                    {
                        VoucherID = x.VoucherID!.Value,
                        x.InvestmentAccount!.InvestmentNo,
                        x.InvestmentAccount.OldInvestmentNo,
                        x.InvestmentAccount.DepositReceiptNo,
                        InstName = x.InvestmentAccount.InvestmentInstitution != null ? x.InvestmentAccount.InvestmentInstitution.InstitutionName : null,
                        SchemeName = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.SchemeName : null,
                        L1 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InvestmentAssetLedgerID : null,
                        L2 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InterestIncomeLedgerID : null,
                        L3 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InterestReceivableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in invMats)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Investment",
                        LegacyAccountNo = FirstNonEmpty(row.OldInvestmentNo),
                        NewAccountNo = FirstNonEmpty(row.InvestmentNo),
                        ExtraRef = FirstNonEmpty(row.DepositReceiptNo),
                        InstitutionLabel = string.Join(" - ", new[] { row.InstName, row.SchemeName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                        MatchedLedgerIds = BuildInvLedgers(row.L1, row.L2, row.L3)
                    });
                }

                var invPres = await context.InvestmentPrematureWithdrawals.AsNoTracking()
                    .Where(x => x.VoucherID.HasValue && idChunk.Contains(x.VoucherID.Value) && x.InvestmentAccount != null)
                    .Select(x => new
                    {
                        VoucherID = x.VoucherID!.Value,
                        x.InvestmentAccount!.InvestmentNo,
                        x.InvestmentAccount.OldInvestmentNo,
                        x.InvestmentAccount.DepositReceiptNo,
                        InstName = x.InvestmentAccount.InvestmentInstitution != null ? x.InvestmentAccount.InvestmentInstitution.InstitutionName : null,
                        SchemeName = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.SchemeName : null,
                        L1 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InvestmentAssetLedgerID : null,
                        L2 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InterestIncomeLedgerID : null,
                        L3 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InterestReceivableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in invPres)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Investment",
                        LegacyAccountNo = FirstNonEmpty(row.OldInvestmentNo),
                        NewAccountNo = FirstNonEmpty(row.InvestmentNo),
                        ExtraRef = FirstNonEmpty(row.DepositReceiptNo),
                        InstitutionLabel = string.Join(" - ", new[] { row.InstName, row.SchemeName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                        MatchedLedgerIds = BuildInvLedgers(row.L1, row.L2, row.L3)
                    });
                }

                var invAccs = await context.InvestmentInterestAccruals.AsNoTracking()
                    .Where(x => x.VoucherID.HasValue && idChunk.Contains(x.VoucherID.Value) && x.InvestmentAccount != null)
                    .Select(x => new
                    {
                        VoucherID = x.VoucherID!.Value,
                        x.InvestmentAccount!.InvestmentNo,
                        x.InvestmentAccount.OldInvestmentNo,
                        x.InvestmentAccount.DepositReceiptNo,
                        InstName = x.InvestmentAccount.InvestmentInstitution != null ? x.InvestmentAccount.InvestmentInstitution.InstitutionName : null,
                        SchemeName = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.SchemeName : null,
                        L1 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InvestmentAssetLedgerID : null,
                        L2 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InterestIncomeLedgerID : null,
                        L3 = x.InvestmentAccount.InvestmentScheme != null ? x.InvestmentAccount.InvestmentScheme.InterestReceivableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in invAccs)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Investment",
                        LegacyAccountNo = FirstNonEmpty(row.OldInvestmentNo),
                        NewAccountNo = FirstNonEmpty(row.InvestmentNo),
                        ExtraRef = FirstNonEmpty(row.DepositReceiptNo),
                        InstitutionLabel = string.Join(" - ", new[] { row.InstName, row.SchemeName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                        MatchedLedgerIds = BuildInvLedgers(row.L1, row.L2, row.L3)
                    });
                }

                var invRens = await context.InvestmentRenewals.AsNoTracking()
                    .Where(x => x.VoucherID.HasValue && idChunk.Contains(x.VoucherID.Value))
                    .Select(x => new
                    {
                        VoucherID = x.VoucherID!.Value,
                        OldNo = x.OldInvestmentAccount != null ? x.OldInvestmentAccount.InvestmentNo : null,
                        OldLeg = x.OldInvestmentAccount != null ? x.OldInvestmentAccount.OldInvestmentNo : null,
                        OldRec = x.OldInvestmentAccount != null ? x.OldInvestmentAccount.DepositReceiptNo : null,
                        OldInst = x.OldInvestmentAccount != null && x.OldInvestmentAccount.InvestmentInstitution != null ? x.OldInvestmentAccount.InvestmentInstitution.InstitutionName : null,
                        NewNo = x.NewInvestmentAccount != null ? x.NewInvestmentAccount.InvestmentNo : null,
                        NewLeg = x.NewInvestmentAccount != null ? x.NewInvestmentAccount.OldInvestmentNo : null,
                        NewRec = x.NewInvestmentAccount != null ? x.NewInvestmentAccount.DepositReceiptNo : null,
                        NewInst = x.NewInvestmentAccount != null && x.NewInvestmentAccount.InvestmentInstitution != null ? x.NewInvestmentAccount.InvestmentInstitution.InstitutionName : null
                    })
                    .ToListAsync();

                foreach (var row in invRens)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Investment",
                        LegacyAccountNo = FirstNonEmpty(row.OldLeg),
                        NewAccountNo = FirstNonEmpty(row.OldNo),
                        ExtraRef = FirstNonEmpty(row.OldRec),
                        InstitutionLabel = row.OldInst,
                        DrCrHint = "Cr",
                        MatchedLedgerIds = new HashSet<int>(globalInvLedgerIds)
                    });
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Investment",
                        LegacyAccountNo = FirstNonEmpty(row.NewLeg),
                        NewAccountNo = FirstNonEmpty(row.NewNo),
                        ExtraRef = FirstNonEmpty(row.NewRec),
                        InstitutionLabel = row.NewInst,
                        DrCrHint = "Dr",
                        MatchedLedgerIds = new HashSet<int>(globalInvLedgerIds)
                    });
                }

                // 7. Shares Module (ShareTransactions, DividendDistributions)
                var shareTxs = await context.ShareTransactions.AsNoTracking()
                    .Where(s => s.VoucherId.HasValue && idChunk.Contains(s.VoucherId.Value) && s.ShareAccount != null)
                    .Select(s => new
                    {
                        VoucherID = s.VoucherId!.Value,
                        s.ShareAccount!.CustomerID,
                        s.ShareAccount.MemberId,
                        s.ShareAccount.AccountNo,
                        s.ShareAccount.LegacyAccountNumber,
                        LegMemNo = s.ShareAccount.Member != null ? s.ShareAccount.Member.LegacyMemberNo : null,
                        MemCode = s.ShareAccount.Member != null ? s.ShareAccount.Member.MemberCode : null
                    })
                    .ToListAsync();

                foreach (var row in shareTxs)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Share",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber, row.LegMemNo),
                        NewAccountNo = FirstNonEmpty(row.AccountNo, row.MemCode),
                        CustomerId = row.CustomerID,
                        MemberId = row.MemberId,
                        MatchedLedgerIds = new HashSet<int>(shareLedgerIds)
                    });
                }

                var divTxs = await context.DividendDistributions.AsNoTracking()
                    .Where(d => d.VoucherId.HasValue && idChunk.Contains(d.VoucherId.Value) && d.ShareAccount != null)
                    .Select(d => new
                    {
                        VoucherID = d.VoucherId!.Value,
                        d.ShareAccount!.CustomerID,
                        d.ShareAccount.MemberId,
                        d.ShareAccount.AccountNo,
                        d.ShareAccount.LegacyAccountNumber,
                        LegMemNo = d.ShareAccount.Member != null ? d.ShareAccount.Member.LegacyMemberNo : null,
                        MemCode = d.ShareAccount.Member != null ? d.ShareAccount.Member.MemberCode : null
                    })
                    .ToListAsync();

                foreach (var row in divTxs)
                {
                    ctx.AddVoucherRef(row.VoucherID, new ResolvedAccountRef
                    {
                        Module = "Share",
                        LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber, row.LegMemNo),
                        NewAccountNo = FirstNonEmpty(row.AccountNo, row.MemCode),
                        CustomerId = row.CustomerID,
                        MemberId = row.MemberId,
                        MatchedLedgerIds = new HashSet<int>(shareLedgerIds)
                    });
                }
            }

            // =========================================================================
            // CHUNKED QUERIES BY VOUCHER NO (Saving & Pigmy Withdrawals + Embedded AccNos)
            // =========================================================================
            var allVoucherNos = voucherNoToIds.Keys.ToList();
            foreach (var noChunk in ChunkBy(allVoucherNos, 800))
            {
                // 8. Saving Transactions & Saving Account Closings
                var savTxs = await context.SavingTransactions.AsNoTracking()
                    .Where(st => st.VoucherNo != null && noChunk.Contains(st.VoucherNo) && st.SavingAccount != null)
                    .Select(st => new
                    {
                        VoucherNo = st.VoucherNo!,
                        st.TransactionType,
                        st.SavingAccount!.CustomerID,
                        st.SavingAccount.AccountNo,
                        st.SavingAccount.LegacyAccountNumber,
                        st.SavingAccount.OldAccountNo,
                        st.SavingAccount.PreviousAccountNo,
                        TargetCustId = st.TargetSavingAccount != null ? (int?)st.TargetSavingAccount.CustomerID : null,
                        TargetAccNo = st.TargetSavingAccount != null ? st.TargetSavingAccount.AccountNo : null,
                        TargetLegNo = st.TargetSavingAccount != null
                            ? (st.TargetSavingAccount.LegacyAccountNumber ?? st.TargetSavingAccount.OldAccountNo ?? st.TargetSavingAccount.PreviousAccountNo)
                            : null
                    })
                    .ToListAsync();

                foreach (var row in savTxs)
                {
                    if (!voucherNoToIds.TryGetValue(row.VoucherNo.Trim(), out var vIds)) continue;
                    string drCr = (row.TransactionType == "Deposit" || row.TransactionType == "Interest") ? "Cr" : "Dr";

                    foreach (var vid in vIds)
                    {
                        ctx.AddVoucherRef(vid, new ResolvedAccountRef
                        {
                            Module = "Saving",
                            LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber, row.OldAccountNo, row.PreviousAccountNo),
                            NewAccountNo = FirstNonEmpty(row.AccountNo),
                            CustomerId = row.CustomerID,
                            DrCrHint = drCr,
                            MatchedLedgerIds = new HashSet<int>(savingLedgerIds)
                        });

                        if (!string.IsNullOrWhiteSpace(row.TargetAccNo) || !string.IsNullOrWhiteSpace(row.TargetLegNo))
                        {
                            ctx.AddVoucherRef(vid, new ResolvedAccountRef
                            {
                                Module = "Saving",
                                LegacyAccountNo = FirstNonEmpty(row.TargetLegNo),
                                NewAccountNo = FirstNonEmpty(row.TargetAccNo),
                                CustomerId = row.TargetCustId,
                                DrCrHint = drCr == "Dr" ? "Cr" : "Dr",
                                MatchedLedgerIds = new HashSet<int>(savingLedgerIds)
                            });
                        }
                    }
                }

                var savClosings = await context.SavingAccountClosings.AsNoTracking()
                    .Where(sc => sc.VoucherNo != null && noChunk.Contains(sc.VoucherNo) && sc.SavingAccount != null)
                    .Select(sc => new
                    {
                        VoucherNo = sc.VoucherNo!,
                        sc.SavingAccount!.CustomerID,
                        sc.SavingAccount.AccountNo,
                        sc.SavingAccount.LegacyAccountNumber,
                        sc.SavingAccount.OldAccountNo,
                        sc.SavingAccount.PreviousAccountNo
                    })
                    .ToListAsync();

                foreach (var row in savClosings)
                {
                    if (!voucherNoToIds.TryGetValue(row.VoucherNo.Trim(), out var vIds)) continue;
                    foreach (var vid in vIds)
                    {
                        ctx.AddVoucherRef(vid, new ResolvedAccountRef
                        {
                            Module = "Saving",
                            LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber, row.OldAccountNo, row.PreviousAccountNo),
                            NewAccountNo = FirstNonEmpty(row.AccountNo),
                            CustomerId = row.CustomerID,
                            DrCrHint = "Dr",
                            MatchedLedgerIds = new HashSet<int>(savingLedgerIds)
                        });
                    }
                }

                var pgWithdrawals = await context.PigmyWithdrawals.AsNoTracking()
                    .Where(pw => pw.VoucherNo != null && noChunk.Contains(pw.VoucherNo) && pw.PigmyAccount != null)
                    .Select(pw => new
                    {
                        VoucherNo = pw.VoucherNo!,
                        pw.PigmyAccount!.CustomerID,
                        pw.PigmyAccount.AccountNo,
                        pw.PigmyAccount.LegacyAccountNumber,
                        pw.PigmyAccount.OldAccountNo,
                        pw.PigmyAccount.PreviousAccountNo,
                        L1 = pw.PigmyAccount.PigmyScheme != null ? pw.PigmyAccount.PigmyScheme.PigmyLiabilityLedgerID : null,
                        L2 = pw.PigmyAccount.PigmyScheme != null ? pw.PigmyAccount.PigmyScheme.InterestExpenseLedgerID : null,
                        L3 = pw.PigmyAccount.PigmyScheme != null ? pw.PigmyAccount.PigmyScheme.InterestPayableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in pgWithdrawals)
                {
                    if (!voucherNoToIds.TryGetValue(row.VoucherNo.Trim(), out var vIds)) continue;
                    foreach (var vid in vIds)
                    {
                        ctx.AddVoucherRef(vid, new ResolvedAccountRef
                        {
                            Module = "Pigmy",
                            LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber, row.OldAccountNo, row.PreviousAccountNo),
                            NewAccountNo = FirstNonEmpty(row.AccountNo),
                            CustomerId = row.CustomerID,
                            DrCrHint = "Dr",
                            MatchedLedgerIds = BuildFdLedgers(row.L1, row.L2, row.L3)
                        });
                    }
                }
            }

            // =========================================================================
            // EMBEDDED VOUCHER-NO PATTERN LOOKUP (Investment Opening, FD Opening, RD Opening)
            // =========================================================================
            var invNoToVoucherIds = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
            var fdNoToVoucherIds = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
            var rdNoToVoucherIds = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);

            foreach (var v in vouchers)
            {
                string vn = v.VoucherNo ?? string.Empty;
                if (string.IsNullOrWhiteSpace(vn)) continue;

                // Investment: PAY-INV-OP-{InvestmentNo}, REC-INV-MAT-{InvestmentNo}, REC-INV-PRE-{InvestmentNo}, REC-INV-INT-{InvestmentNo}
                foreach (var marker in new[] { "PAY-INV-OP-", "REC-INV-MAT-", "REC-INV-PRE-", "REC-INV-INT-" })
                {
                    var invNo = TryExtractEmbeddedAccountNo(vn, marker);
                    if (!string.IsNullOrWhiteSpace(invNo))
                    {
                        if (!invNoToVoucherIds.TryGetValue(invNo, out var list))
                        {
                            list = new List<int>();
                            invNoToVoucherIds[invNo] = list;
                        }
                        list.Add(v.VoucherID);
                    }
                }

                // FD: REC-FD-OP-{AccountNo}, JV-FD-OP-{AccountNo}, -FD-CLOSE-{AccountNo}, -FD-PRECLOSE-{AccountNo}
                foreach (var marker in new[] { "REC-FD-OP-", "JV-FD-OP-", "FD-PRECLOSE-", "FD-CLOSE-" })
                {
                    var fdNo = TryExtractEmbeddedAccountNo(vn, marker);
                    if (!string.IsNullOrWhiteSpace(fdNo))
                    {
                        if (!fdNoToVoucherIds.TryGetValue(fdNo, out var list))
                        {
                            list = new List<int>();
                            fdNoToVoucherIds[fdNo] = list;
                        }
                        list.Add(v.VoucherID);
                        break;
                    }
                }

                // RD: JV-RD-OP-{AccountNo}, RD-PRECLOSE-{AccountNo}, RD-CLOSE-{AccountNo}
                foreach (var marker in new[] { "JV-RD-OP-", "RD-PRECLOSE-", "RD-CLOSE-" })
                {
                    var rdNo = TryExtractEmbeddedAccountNo(vn, marker);
                    if (!string.IsNullOrWhiteSpace(rdNo))
                    {
                        if (!rdNoToVoucherIds.TryGetValue(rdNo, out var list))
                        {
                            list = new List<int>();
                            rdNoToVoucherIds[rdNo] = list;
                        }
                        list.Add(v.VoucherID);
                        break;
                    }
                }
            }

            foreach (var chunk in ChunkBy(invNoToVoucherIds.Keys, 800))
            {
                var invAccounts = await context.InvestmentAccounts.AsNoTracking()
                    .Where(a => a.InvestmentNo != null && chunk.Contains(a.InvestmentNo))
                    .Select(a => new
                    {
                        InvestmentNo = a.InvestmentNo!,
                        a.OldInvestmentNo,
                        a.DepositReceiptNo,
                        InstName = a.InvestmentInstitution != null ? a.InvestmentInstitution.InstitutionName : null,
                        SchemeName = a.InvestmentScheme != null ? a.InvestmentScheme.SchemeName : null,
                        L1 = a.InvestmentScheme != null ? a.InvestmentScheme.InvestmentAssetLedgerID : null,
                        L2 = a.InvestmentScheme != null ? a.InvestmentScheme.InterestIncomeLedgerID : null,
                        L3 = a.InvestmentScheme != null ? a.InvestmentScheme.InterestReceivableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in invAccounts)
                {
                    if (!invNoToVoucherIds.TryGetValue(row.InvestmentNo, out var vIds)) continue;
                    var matched = BuildFdLedgers(row.L1, row.L2, row.L3);
                    foreach (var gl in globalInvLedgerIds) matched.Add(gl);

                    foreach (var vid in vIds)
                    {
                        ctx.AddVoucherRef(vid, new ResolvedAccountRef
                        {
                            Module = "Investment",
                            LegacyAccountNo = FirstNonEmpty(row.OldInvestmentNo),
                            NewAccountNo = FirstNonEmpty(row.InvestmentNo),
                            ExtraRef = FirstNonEmpty(row.DepositReceiptNo),
                            InstitutionLabel = string.Join(" - ", new[] { row.InstName, row.SchemeName }.Where(s => !string.IsNullOrWhiteSpace(s))),
                            MatchedLedgerIds = matched
                        });
                    }
                }
            }

            foreach (var chunk in ChunkBy(fdNoToVoucherIds.Keys, 800))
            {
                var fdAccounts = await context.FdAccounts.AsNoTracking()
                    .Where(a => chunk.Contains(a.AccountNo))
                    .Select(a => new
                    {
                        a.AccountNo,
                        a.LegacyAccountNumber,
                        a.CustomerID,
                        L1 = a.FdScheme != null ? a.FdScheme.FdLiabilityLedgerID : null,
                        L2 = a.FdScheme != null ? a.FdScheme.InterestExpenseLedgerID : null,
                        L3 = a.FdScheme != null ? a.FdScheme.InterestPayableLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in fdAccounts)
                {
                    if (!fdNoToVoucherIds.TryGetValue(row.AccountNo, out var vIds)) continue;
                    foreach (var vid in vIds)
                    {
                        ctx.AddVoucherRef(vid, new ResolvedAccountRef
                        {
                            Module = "FD",
                            LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                            NewAccountNo = FirstNonEmpty(row.AccountNo),
                            CustomerId = row.CustomerID,
                            MatchedLedgerIds = BuildFdLedgers(row.L1, row.L2, row.L3)
                        });
                    }
                }
            }

            foreach (var chunk in ChunkBy(rdNoToVoucherIds.Keys, 800))
            {
                var rdAccounts = await context.RdAccounts.AsNoTracking()
                    .Where(a => chunk.Contains(a.AccountNo))
                    .Select(a => new
                    {
                        a.AccountNo,
                        a.LegacyAccountNumber,
                        a.CustomerID,
                        L1 = a.RdScheme != null ? a.RdScheme.RdLiabilityLedgerID : null,
                        L2 = a.RdScheme != null ? a.RdScheme.InterestExpenseLedgerID : null,
                        L3 = a.RdScheme != null ? a.RdScheme.InterestPayableLedgerID : null,
                        L4 = a.RdScheme != null ? a.RdScheme.PenaltyIncomeLedgerID : null
                    })
                    .ToListAsync();

                foreach (var row in rdAccounts)
                {
                    if (!rdNoToVoucherIds.TryGetValue(row.AccountNo, out var vIds)) continue;
                    foreach (var vid in vIds)
                    {
                        ctx.AddVoucherRef(vid, new ResolvedAccountRef
                        {
                            Module = "RD",
                            LegacyAccountNo = FirstNonEmpty(row.LegacyAccountNumber),
                            NewAccountNo = FirstNonEmpty(row.AccountNo),
                            CustomerId = row.CustomerID,
                            MatchedLedgerIds = BuildRdLedgers(row.L1, row.L2, row.L3, row.L4)
                        });
                    }
                }
            }

            // =========================================================================
            // TIER-2 CUSTOMER + LEDGER FALLBACK (Manual Vouchers / Opening Vouchers)
            // =========================================================================
            foreach (var custChunk in ChunkBy(customerIdSet, 800))
            {
                var savs = await context.SavingAccountMasters.AsNoTracking()
                    .Where(a => custChunk.Contains(a.CustomerID))
                    .Select(a => new { a.CustomerID, a.AccountNo, a.LegacyAccountNumber, a.OldAccountNo, a.PreviousAccountNo })
                    .ToListAsync();
                foreach (var s in savs)
                {
                    ctx.AddCustomerRef(s.CustomerID, new ResolvedAccountRef
                    {
                        Module = "Saving",
                        LegacyAccountNo = FirstNonEmpty(s.LegacyAccountNumber, s.OldAccountNo, s.PreviousAccountNo),
                        NewAccountNo = FirstNonEmpty(s.AccountNo),
                        CustomerId = s.CustomerID,
                        MatchedLedgerIds = new HashSet<int>(savingLedgerIds)
                    });
                }

                var fds = await context.FdAccounts.AsNoTracking()
                    .Where(a => custChunk.Contains(a.CustomerID))
                    .Select(a => new
                    {
                        a.CustomerID,
                        a.AccountNo,
                        a.LegacyAccountNumber,
                        L1 = a.FdScheme != null ? a.FdScheme.FdLiabilityLedgerID : null,
                        L2 = a.FdScheme != null ? a.FdScheme.InterestExpenseLedgerID : null,
                        L3 = a.FdScheme != null ? a.FdScheme.InterestPayableLedgerID : null
                    })
                    .ToListAsync();
                foreach (var f in fds)
                {
                    ctx.AddCustomerRef(f.CustomerID, new ResolvedAccountRef
                    {
                        Module = "FD",
                        LegacyAccountNo = FirstNonEmpty(f.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(f.AccountNo),
                        CustomerId = f.CustomerID,
                        MatchedLedgerIds = BuildFdLedgers(f.L1, f.L2, f.L3)
                    });
                }

                var rds = await context.RdAccounts.AsNoTracking()
                    .Where(a => custChunk.Contains(a.CustomerID))
                    .Select(a => new
                    {
                        a.CustomerID,
                        a.AccountNo,
                        a.LegacyAccountNumber,
                        L1 = a.RdScheme != null ? a.RdScheme.RdLiabilityLedgerID : null,
                        L2 = a.RdScheme != null ? a.RdScheme.InterestExpenseLedgerID : null,
                        L3 = a.RdScheme != null ? a.RdScheme.InterestPayableLedgerID : null,
                        L4 = a.RdScheme != null ? a.RdScheme.PenaltyIncomeLedgerID : null
                    })
                    .ToListAsync();
                foreach (var r in rds)
                {
                    ctx.AddCustomerRef(r.CustomerID, new ResolvedAccountRef
                    {
                        Module = "RD",
                        LegacyAccountNo = FirstNonEmpty(r.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(r.AccountNo),
                        CustomerId = r.CustomerID,
                        MatchedLedgerIds = BuildRdLedgers(r.L1, r.L2, r.L3, r.L4)
                    });
                }

                var pgs = await context.PigmyAccounts.AsNoTracking()
                    .Where(a => custChunk.Contains(a.CustomerID))
                    .Select(a => new
                    {
                        a.CustomerID,
                        a.AccountNo,
                        a.LegacyAccountNumber,
                        a.OldAccountNo,
                        a.PreviousAccountNo,
                        L1 = a.PigmyScheme != null ? a.PigmyScheme.PigmyLiabilityLedgerID : null,
                        L2 = a.PigmyScheme != null ? a.PigmyScheme.InterestExpenseLedgerID : null,
                        L3 = a.PigmyScheme != null ? a.PigmyScheme.InterestPayableLedgerID : null
                    })
                    .ToListAsync();
                foreach (var p in pgs)
                {
                    ctx.AddCustomerRef(p.CustomerID, new ResolvedAccountRef
                    {
                        Module = "Pigmy",
                        LegacyAccountNo = FirstNonEmpty(p.LegacyAccountNumber, p.OldAccountNo, p.PreviousAccountNo),
                        NewAccountNo = FirstNonEmpty(p.AccountNo),
                        CustomerId = p.CustomerID,
                        MatchedLedgerIds = BuildFdLedgers(p.L1, p.L2, p.L3)
                    });
                }

                var loans = await context.LoanAccounts.AsNoTracking()
                    .Where(a => a.CustomerID.HasValue && custChunk.Contains(a.CustomerID.Value))
                    .Select(a => new
                    {
                        CustomerID = a.CustomerID!.Value,
                        a.LoanAccountNo,
                        a.LegacyAccountNumber,
                        L1 = a.LoanRate != null ? a.LoanRate.LoanLedgerID : null,
                        L2 = a.LoanRate != null ? a.LoanRate.InterestLedgerID : null,
                        L3 = a.LoanRate != null ? a.LoanRate.OverdueInterestLedgerID : null,
                        L4 = a.LoanRate != null ? a.LoanRate.ReceivableInterestLedgerID : null,
                        L5 = a.LoanRate != null ? a.LoanRate.SurchargeLedgerID : null,
                        L6 = a.LoanRate != null ? a.LoanRate.RecoveryFeeLedgerID : null,
                        L7 = a.LoanRate != null ? a.LoanRate.ProcessingFeeLedgerID : null
                    })
                    .ToListAsync();
                foreach (var l in loans)
                {
                    ctx.AddCustomerRef(l.CustomerID, new ResolvedAccountRef
                    {
                        Module = "Loan",
                        LegacyAccountNo = FirstNonEmpty(l.LegacyAccountNumber),
                        NewAccountNo = FirstNonEmpty(l.LoanAccountNo),
                        CustomerId = l.CustomerID,
                        MatchedLedgerIds = BuildLoanLedgers(l.L1, l.L2, l.L3, l.L4, l.L5, l.L6, l.L7)
                    });
                }

                var shs = await context.ShareAccounts.AsNoTracking()
                    .Where(a => custChunk.Contains(a.CustomerID))
                    .Select(a => new
                    {
                        a.CustomerID,
                        a.AccountNo,
                        a.LegacyAccountNumber,
                        LegMemNo = a.Member != null ? a.Member.LegacyMemberNo : null,
                        MemCode = a.Member != null ? a.Member.MemberCode : null
                    })
                    .ToListAsync();
                foreach (var sh in shs)
                {
                    ctx.AddCustomerRef(sh.CustomerID, new ResolvedAccountRef
                    {
                        Module = "Share",
                        LegacyAccountNo = FirstNonEmpty(sh.LegacyAccountNumber, sh.LegMemNo),
                        NewAccountNo = FirstNonEmpty(sh.AccountNo, sh.MemCode),
                        CustomerId = sh.CustomerID,
                        MatchedLedgerIds = new HashSet<int>(shareLedgerIds)
                    });
                }
            }

            return ctx;
        }

        private static string BuildAccountSuffix(ResolvedAccountRef? accRef, out string? displayAccNo, out bool isLegacyAcc)
        {
            displayAccNo = null;
            isLegacyAcc = false;
            if (accRef == null) return string.Empty;

            if (!string.IsNullOrWhiteSpace(accRef.LegacyAccountNo))
            {
                displayAccNo = accRef.LegacyAccountNo;
                isLegacyAcc = true;
                return !string.IsNullOrWhiteSpace(accRef.ExtraRef)
                    ? $"(जुना खाते: {accRef.LegacyAccountNo} | पावती: {accRef.ExtraRef})"
                    : $"(जुना खाते: {accRef.LegacyAccountNo})";
            }

            if (!string.IsNullOrWhiteSpace(accRef.NewAccountNo))
            {
                displayAccNo = accRef.NewAccountNo;
                isLegacyAcc = false;
                return !string.IsNullOrWhiteSpace(accRef.ExtraRef)
                    ? $"(खाते: {accRef.NewAccountNo} | पावती: {accRef.ExtraRef})"
                    : $"(खाते: {accRef.NewAccountNo})";
            }

            return string.Empty;
        }

        /// <summary>
        /// Formats a Legacy Daybook entry line giving 1st priority to Legacy CIF (fallback -> New CIF)
        /// and 1st priority to Legacy Account No (fallback -> New Account No).
        /// </summary>
        public static FormattedLegacyLine FormatLegacyEntry(
            Voucher voucher,
            VoucherDetail vd,
            string fallbackNarration,
            VoucherAccountContext accountCtx)
        {
            var resolvedAcc = accountCtx.ResolveForDetail(voucher, vd);
            string accSuffix = BuildAccountSuffix(resolvedAcc, out string? displayAccNo, out bool isLegacyAcc);

            var customer = vd.Customer ?? vd.Member?.Customer;
            string? legacyCif = FirstNonEmpty(customer?.LegacyCustomerNo, vd.Member?.LegacyMemberNo);
            string? newCif = null;
            if (customer != null)
            {
                newCif = !string.IsNullOrWhiteSpace(customer.CIFNo)
                    ? customer.CIFNo.Trim()
                    : (customer.CustomerID > 0 ? $"CIF{customer.CustomerID:D6}" : null);
            }
            if (string.IsNullOrWhiteSpace(newCif) && vd.Member != null)
            {
                newCif = !string.IsNullOrWhiteSpace(vd.Member.MemberCode)
                    ? vd.Member.MemberCode.Trim()
                    : $"MEM{vd.Member.MemberID:D4}";
            }

            bool isLegacyCust = !string.IsNullOrWhiteSpace(legacyCif);
            string? displayCustNo = isLegacyCust ? legacyCif : newCif;
            string? formattedCustLabel = isLegacyCust
                ? $"जुना CIF: {legacyCif}"
                : newCif;

            string fullName = customer != null
                ? string.Join(" ", new[] { customer.FirstName, customer.MiddleName, customer.LastName }
                    .Where(s => !string.IsNullOrWhiteSpace(s))).Trim()
                : string.Empty;

            if (!string.IsNullOrWhiteSpace(formattedCustLabel) || !string.IsNullOrWhiteSpace(fullName))
            {
                string partyText = (!string.IsNullOrWhiteSpace(formattedCustLabel) && !string.IsNullOrWhiteSpace(fullName))
                    ? $"{formattedCustLabel} - {fullName}"
                    : (!string.IsNullOrWhiteSpace(fullName) ? fullName : formattedCustLabel!);

                string combined = !string.IsNullOrWhiteSpace(accSuffix)
                    ? $"{partyText} {accSuffix}"
                    : partyText;

                return new FormattedLegacyLine
                {
                    Narration = combined,
                    DisplayCustomerNo = displayCustNo,
                    DisplayAccountNo = displayAccNo,
                    IsLegacyCustomerNo = isLegacyCust,
                    IsLegacyAccountNo = isLegacyAcc
                };
            }

            // Investment / Institution / Non-customer vouchers with a resolved account (e.g. InvestmentAccount)
            if (resolvedAcc != null && !string.IsNullOrWhiteSpace(accSuffix))
            {
                string baseLabel = !string.IsNullOrWhiteSpace(resolvedAcc.InstitutionLabel)
                    ? resolvedAcc.InstitutionLabel
                    : fallbackNarration;

                return new FormattedLegacyLine
                {
                    Narration = !string.IsNullOrWhiteSpace(baseLabel) ? $"{baseLabel} {accSuffix}" : accSuffix,
                    DisplayCustomerNo = null,
                    DisplayAccountNo = displayAccNo,
                    IsLegacyCustomerNo = false,
                    IsLegacyAccountNo = isLegacyAcc
                };
            }

            return new FormattedLegacyLine
            {
                Narration = fallbackNarration ?? string.Empty
            };
        }

        /// <summary>
        /// Formats unvouchered Loan Disbursement / Loan Collection entries for Draft (Kacchi) Legacy Daybook.
        /// </summary>
        public static FormattedLegacyLine FormatUnvoucheredLoanLine(LoanAccount? loanAcc, string fallbackText)
        {
            if (loanAcc == null)
            {
                return new FormattedLegacyLine { Narration = fallbackText };
            }

            var customer = loanAcc.Customer ?? loanAcc.Member?.Customer;
            string? legacyCif = FirstNonEmpty(customer?.LegacyCustomerNo, loanAcc.Member?.LegacyMemberNo);
            string? newCif = null;
            if (customer != null)
            {
                newCif = !string.IsNullOrWhiteSpace(customer.CIFNo)
                    ? customer.CIFNo.Trim()
                    : (customer.CustomerID > 0 ? $"CIF{customer.CustomerID:D6}" : null);
            }
            if (string.IsNullOrWhiteSpace(newCif) && loanAcc.Member != null)
            {
                newCif = !string.IsNullOrWhiteSpace(loanAcc.Member.MemberCode)
                    ? loanAcc.Member.MemberCode.Trim()
                    : $"MEM{loanAcc.Member.MemberID:D4}";
            }

            bool isLegacyCust = !string.IsNullOrWhiteSpace(legacyCif);
            string? displayCustNo = isLegacyCust ? legacyCif : newCif;
            string? custLabel = isLegacyCust ? $"जुना CIF: {legacyCif}" : newCif;

            string fullName = customer != null
                ? string.Join(" ", new[] { customer.FirstName, customer.MiddleName, customer.LastName }
                    .Where(s => !string.IsNullOrWhiteSpace(s))).Trim()
                : string.Empty;

            string? legacyAcc = FirstNonEmpty(loanAcc.LegacyAccountNumber);
            string? newAcc = FirstNonEmpty(loanAcc.LoanAccountNo);
            bool isLegacyAcc = !string.IsNullOrWhiteSpace(legacyAcc);
            string? displayAccNo = isLegacyAcc ? legacyAcc : newAcc;
            string accSuffix = isLegacyAcc
                ? $"(जुना खाते: {legacyAcc})"
                : (!string.IsNullOrWhiteSpace(newAcc) ? $"(खाते: {newAcc})" : string.Empty);

            string partyText = (!string.IsNullOrWhiteSpace(custLabel) && !string.IsNullOrWhiteSpace(fullName))
                ? $"{custLabel} - {fullName}"
                : (!string.IsNullOrWhiteSpace(fullName) ? fullName : (custLabel ?? fallbackText));

            string narration = !string.IsNullOrWhiteSpace(accSuffix)
                ? $"{partyText} {accSuffix}"
                : partyText;

            return new FormattedLegacyLine
            {
                Narration = narration,
                DisplayCustomerNo = displayCustNo,
                DisplayAccountNo = displayAccNo,
                IsLegacyCustomerNo = isLegacyCust,
                IsLegacyAccountNo = isLegacyAcc
            };
        }
    }
}

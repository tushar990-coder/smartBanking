using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Bhisi.Api.Data;
using Bhisi.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bhisi.Api.Helpers
{
    /// <summary>
    /// Enriches Voucher rows with linked sub-ledger account numbers and old/legacy account numbers
    /// using batched lookups (no N+1 queries) across Loan, FD, RD, Saving, Pigmy, Share, Investment, and Locker modules.
    /// </summary>
    public static class VoucherLinkedAccountHelper
    {
        private static string? FirstNonEmpty(params string?[] candidates)
        {
            foreach (var candidate in candidates)
            {
                if (!string.IsNullOrWhiteSpace(candidate))
                {
                    return candidate.Trim();
                }
            }
            return null;
        }

        private static void AddAccount(
            Dictionary<int, List<VoucherLinkedAccountDto>> map,
            int voucherId,
            string accountType,
            string accountTypeLabel,
            string? accountNo,
            string? oldAccountNo,
            string? receiptNo = null,
            string? roleLabel = null)
        {
            var trimmedAccNo = accountNo?.Trim();
            var trimmedOldNo = oldAccountNo?.Trim();
            var trimmedReceiptNo = receiptNo?.Trim();

            if (string.IsNullOrWhiteSpace(trimmedAccNo) && string.IsNullOrWhiteSpace(trimmedOldNo) && string.IsNullOrWhiteSpace(trimmedReceiptNo))
            {
                return;
            }

            if (!map.TryGetValue(voucherId, out var list))
            {
                list = new List<VoucherLinkedAccountDto>();
                map[voucherId] = list;
            }

            string normalizedKeyAcc = (trimmedAccNo ?? string.Empty).ToUpperInvariant();
            string normalizedKeyOld = (trimmedOldNo ?? string.Empty).ToUpperInvariant();

            var existing = list.FirstOrDefault(x =>
                string.Equals(x.AccountType, accountType, StringComparison.OrdinalIgnoreCase) &&
                ((!string.IsNullOrEmpty(normalizedKeyAcc) && string.Equals(x.AccountNo, trimmedAccNo, StringComparison.OrdinalIgnoreCase)) ||
                 (string.IsNullOrEmpty(normalizedKeyAcc) && string.Equals(x.OldAccountNo ?? string.Empty, trimmedOldNo ?? string.Empty, StringComparison.OrdinalIgnoreCase))));

            if (existing != null)
            {
                if (string.IsNullOrWhiteSpace(existing.OldAccountNo) && !string.IsNullOrWhiteSpace(trimmedOldNo))
                    existing.OldAccountNo = trimmedOldNo;
                if (string.IsNullOrWhiteSpace(existing.ReceiptNo) && !string.IsNullOrWhiteSpace(trimmedReceiptNo))
                    existing.ReceiptNo = trimmedReceiptNo;
                if (string.IsNullOrWhiteSpace(existing.RoleLabel) && !string.IsNullOrWhiteSpace(roleLabel))
                    existing.RoleLabel = roleLabel;
                return;
            }

            // Do not repeat receiptNo if it duplicates oldAccountNo or accountNo
            if (!string.IsNullOrWhiteSpace(trimmedReceiptNo) &&
                (string.Equals(trimmedReceiptNo, trimmedOldNo, StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(trimmedReceiptNo, trimmedAccNo, StringComparison.OrdinalIgnoreCase)))
            {
                trimmedReceiptNo = null;
            }

            list.Add(new VoucherLinkedAccountDto
            {
                AccountType = accountType,
                AccountTypeLabel = accountTypeLabel,
                AccountNo = trimmedAccNo ?? string.Empty,
                OldAccountNo = string.IsNullOrWhiteSpace(trimmedOldNo) ? null : trimmedOldNo,
                ReceiptNo = string.IsNullOrWhiteSpace(trimmedReceiptNo) ? null : trimmedReceiptNo,
                RoleLabel = string.IsNullOrWhiteSpace(roleLabel) ? null : roleLabel.Trim()
            });
        }

        public static async Task EnrichVouchersAsync(AppDbContext db, IList<Voucher> vouchers)
        {
            if (db == null || vouchers == null || vouchers.Count == 0)
            {
                return;
            }

            var voucherIds = vouchers.Select(v => v.VoucherID).Where(id => id > 0).Distinct().ToList();
            if (voucherIds.Count == 0)
            {
                return;
            }

            var voucherNoToIds = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
            foreach (var v in vouchers)
            {
                if (v.VoucherID > 0 && !string.IsNullOrWhiteSpace(v.VoucherNo))
                {
                    var key = v.VoucherNo.Trim();
                    if (!voucherNoToIds.TryGetValue(key, out var ids))
                    {
                        ids = new List<int>();
                        voucherNoToIds[key] = ids;
                    }
                    ids.Add(v.VoucherID);
                }
            }
            var voucherNos = voucherNoToIds.Keys.ToList();

            var map = new Dictionary<int, List<VoucherLinkedAccountDto>>();

            void AddLoans(IEnumerable<(int VoucherId, string? LoanNo, string? OldNo)> rows)
            {
                foreach (var r in rows)
                    AddAccount(map, r.VoucherId, "Loan", "कर्ज", r.LoanNo, r.OldNo);
            }

            void AddInvestments(IEnumerable<(int VoucherId, string? InvNo, string? OldNo, string? RecNo)> rows)
            {
                foreach (var r in rows)
                    AddAccount(map, r.VoucherId, "Investment", "गुंतवणूक", r.InvNo, r.OldNo, r.RecNo);
            }

            // 1. Loan Collections (Primary & IBT Home Branch + Source Saving/Pigmy)
            var loanCollections = await db.LoanCollections.AsNoTracking()
                .Where(c => (c.VoucherID.HasValue && voucherIds.Contains(c.VoucherID.Value)) ||
                            (c.HomeBranchVoucherID.HasValue && voucherIds.Contains(c.HomeBranchVoucherID.Value)))
                .Select(c => new
                {
                    c.VoucherID,
                    c.HomeBranchVoucherID,
                    c.SourceSavingAccountID,
                    c.TransferFromSavingAccountNo,
                    c.SourcePigmyAccountID,
                    c.TransferFromPigmyAccountNo,
                    LoanNo = c.LoanAccount != null ? c.LoanAccount.LoanAccountNo : null,
                    LoanOldNo = c.LoanAccount != null ? c.LoanAccount.LegacyAccountNumber : null
                })
                .ToListAsync();

            var srcSavIds = loanCollections
                .Where(c => c.SourceSavingAccountID.HasValue)
                .Select(c => c.SourceSavingAccountID!.Value)
                .Distinct()
                .ToList();
            var srcSavMap = srcSavIds.Count > 0
                ? await db.SavingAccountMasters.AsNoTracking()
                    .Where(s => srcSavIds.Contains(s.SavingAccountID))
                    .Select(s => new { s.SavingAccountID, s.AccountNo, OldNo = s.OldAccountNo ?? s.LegacyAccountNumber })
                    .ToDictionaryAsync(s => s.SavingAccountID)
                : null;

            var srcPigmyIds = loanCollections
                .Where(c => c.SourcePigmyAccountID.HasValue)
                .Select(c => c.SourcePigmyAccountID!.Value)
                .Distinct()
                .ToList();
            var srcPigmyMap = srcPigmyIds.Count > 0
                ? await db.PigmyAccounts.AsNoTracking()
                    .Where(p => srcPigmyIds.Contains(p.PigmyAccountID))
                    .Select(p => new { p.PigmyAccountID, p.AccountNo, OldNo = p.OldAccountNo ?? p.LegacyAccountNumber ?? p.PreviousAccountNo })
                    .ToDictionaryAsync(p => p.PigmyAccountID)
                : null;

            foreach (var lc in loanCollections)
            {
                if (lc.VoucherID.HasValue)
                {
                    AddAccount(map, lc.VoucherID.Value, "Loan", "कर्ज", lc.LoanNo, lc.LoanOldNo);
                    if (lc.SourceSavingAccountID.HasValue && srcSavMap != null && srcSavMap.TryGetValue(lc.SourceSavingAccountID.Value, out var srcSav))
                    {
                        AddAccount(map, lc.VoucherID.Value, "Saving", "बचत", FirstNonEmpty(srcSav.AccountNo, lc.TransferFromSavingAccountNo), srcSav.OldNo, roleLabel: "स्रोत बचत");
                    }
                    else if (!string.IsNullOrWhiteSpace(lc.TransferFromSavingAccountNo))
                    {
                        AddAccount(map, lc.VoucherID.Value, "Saving", "बचत", lc.TransferFromSavingAccountNo, null, roleLabel: "स्रोत बचत");
                    }

                    if (lc.SourcePigmyAccountID.HasValue && srcPigmyMap != null && srcPigmyMap.TryGetValue(lc.SourcePigmyAccountID.Value, out var srcPig))
                    {
                        AddAccount(map, lc.VoucherID.Value, "Pigmy", "पिग्मी", FirstNonEmpty(srcPig.AccountNo, lc.TransferFromPigmyAccountNo), srcPig.OldNo, roleLabel: "स्रोत पिग्मी");
                    }
                    else if (!string.IsNullOrWhiteSpace(lc.TransferFromPigmyAccountNo))
                    {
                        AddAccount(map, lc.VoucherID.Value, "Pigmy", "पिग्मी", lc.TransferFromPigmyAccountNo, null, roleLabel: "स्रोत पिग्मी");
                    }
                }
                if (lc.HomeBranchVoucherID.HasValue)
                {
                    AddAccount(map, lc.HomeBranchVoucherID.Value, "Loan", "कर्ज", lc.LoanNo, lc.LoanOldNo);
                }
            }

            // 2. Loan Disbursements, Overdue Interest/Recovery, Sec 101 Legal Expenses
            var loanDisb = await db.LoanDisbursements.AsNoTracking()
                .Where(d => d.VoucherID.HasValue && voucherIds.Contains(d.VoucherID.Value))
                .Select(d => new { VoucherID = d.VoucherID!.Value, LoanNo = d.LoanAccount != null ? d.LoanAccount.LoanAccountNo : null, LoanOldNo = d.LoanAccount != null ? d.LoanAccount.LegacyAccountNumber : null })
                .ToListAsync();
            AddLoans(loanDisb.Select(x => (x.VoucherID, x.LoanNo, x.LoanOldNo)));

            var overdueInt = await db.OverdueInterestLedgers.AsNoTracking()
                .Where(o => o.VoucherID.HasValue && voucherIds.Contains(o.VoucherID.Value))
                .Select(o => new { VoucherID = o.VoucherID!.Value, LoanNo = o.LoanAccount != null ? o.LoanAccount.LoanAccountNo : null, LoanOldNo = o.LoanAccount != null ? o.LoanAccount.LegacyAccountNumber : null })
                .ToListAsync();
            AddLoans(overdueInt.Select(x => (x.VoucherID, x.LoanNo, x.LoanOldNo)));

            var overdueRec = await db.OverdueRecoveryLedgers.AsNoTracking()
                .Where(o => o.VoucherID.HasValue && voucherIds.Contains(o.VoucherID.Value))
                .Select(o => new { VoucherID = o.VoucherID!.Value, LoanNo = o.LoanAccount != null ? o.LoanAccount.LoanAccountNo : null, LoanOldNo = o.LoanAccount != null ? o.LoanAccount.LegacyAccountNumber : null })
                .ToListAsync();
            AddLoans(overdueRec.Select(x => (x.VoucherID, x.LoanNo, x.LoanOldNo)));

            var legalExp = await db.Sec101LegalExpenses.AsNoTracking()
                .Where(e => e.VoucherId.HasValue && voucherIds.Contains(e.VoucherId.Value))
                .Select(e => new { VoucherID = e.VoucherId!.Value, LoanNo = e.LoanAccount != null ? e.LoanAccount.LoanAccountNo : null, LoanOldNo = e.LoanAccount != null ? e.LoanAccount.LegacyAccountNumber : null })
                .ToListAsync();
            AddLoans(legalExp.Select(x => (x.VoucherID, x.LoanNo, x.LoanOldNo)));

            // 3. Fixed Deposits (Transactions, Accruals, MIS Payouts, Auto-Renewal Logs)
            var fdTxns = await db.FdTransactions.AsNoTracking()
                .Where(f => voucherIds.Contains(f.VoucherID))
                .Select(f => new
                {
                    f.VoucherID,
                    f.TransactionType,
                    AccNo = f.FdAccount != null ? f.FdAccount.AccountNo : null,
                    OldNo = f.FdAccount != null ? f.FdAccount.LegacyAccountNumber : null,
                    ReceiptNo = f.FdAccount != null ? f.FdAccount.ReceiptNo : null
                })
                .ToListAsync();
            foreach (var f in fdTxns)
            {
                string? role = string.Equals(f.TransactionType, "Renewal", StringComparison.OrdinalIgnoreCase) ? "जुनी ठेव" : null;
                AddAccount(map, f.VoucherID, "FD", "मुदत ठेव", f.AccNo, f.OldNo, f.ReceiptNo, role);
            }

            var fdAccruals = await db.FdInterestAccruals.AsNoTracking()
                .Where(f => voucherIds.Contains(f.VoucherID))
                .Select(f => new
                {
                    f.VoucherID,
                    AccNo = f.FdAccount != null ? f.FdAccount.AccountNo : null,
                    OldNo = f.FdAccount != null ? f.FdAccount.LegacyAccountNumber : null,
                    ReceiptNo = f.FdAccount != null ? f.FdAccount.ReceiptNo : null
                })
                .ToListAsync();
            foreach (var f in fdAccruals)
                AddAccount(map, f.VoucherID, "FD", "मुदत ठेव", f.AccNo, f.OldNo, f.ReceiptNo);

            var fdMis = await db.FdMisPayouts.AsNoTracking()
                .Where(m => m.VoucherID.HasValue && voucherIds.Contains(m.VoucherID.Value))
                .Select(m => new
                {
                    VoucherID = m.VoucherID!.Value,
                    AccNo = m.FdAccount != null ? m.FdAccount.AccountNo : null,
                    OldNo = m.FdAccount != null ? m.FdAccount.LegacyAccountNumber : null,
                    ReceiptNo = m.FdAccount != null ? m.FdAccount.ReceiptNo : null,
                    SavNo = m.TargetSavingAccount != null ? m.TargetSavingAccount.AccountNo : null,
                    SavOldNo = m.TargetSavingAccount != null ? (m.TargetSavingAccount.OldAccountNo ?? m.TargetSavingAccount.LegacyAccountNumber) : null,
                    LoanNo = m.TargetLoanAccount != null ? m.TargetLoanAccount.LoanAccountNo : null,
                    LoanOldNo = m.TargetLoanAccount != null ? m.TargetLoanAccount.LegacyAccountNumber : null
                })
                .ToListAsync();
            foreach (var m in fdMis)
            {
                AddAccount(map, m.VoucherID, "FD", "मुदत ठेव", m.AccNo, m.OldNo, m.ReceiptNo);
                if (!string.IsNullOrWhiteSpace(m.SavNo) || !string.IsNullOrWhiteSpace(m.SavOldNo))
                    AddAccount(map, m.VoucherID, "Saving", "बचत", m.SavNo, m.SavOldNo, roleLabel: "जमा बचत");
                if (!string.IsNullOrWhiteSpace(m.LoanNo) || !string.IsNullOrWhiteSpace(m.LoanOldNo))
                    AddAccount(map, m.VoucherID, "Loan", "कर्ज", m.LoanNo, m.LoanOldNo, roleLabel: "कर्ज वळती");
            }

            var fdAutoRenewals = await db.FdAutoRenewalLogs.AsNoTracking()
                .Where(l => l.VoucherID.HasValue && voucherIds.Contains(l.VoucherID.Value))
                .Select(l => new
                {
                    VoucherID = l.VoucherID!.Value,
                    OldAcc = l.OldFdAccount != null ? l.OldFdAccount.AccountNo : l.OldAccountNo,
                    OldLegacy = l.OldFdAccount != null ? l.OldFdAccount.LegacyAccountNumber : null,
                    OldRec = l.OldFdAccount != null ? l.OldFdAccount.ReceiptNo : l.OldReceiptNo,
                    NewAcc = l.NewFdAccount != null ? l.NewFdAccount.AccountNo : l.NewAccountNo,
                    NewLegacy = l.NewFdAccount != null ? l.NewFdAccount.LegacyAccountNumber : null,
                    NewRec = l.NewFdAccount != null ? l.NewFdAccount.ReceiptNo : l.NewReceiptNo
                })
                .ToListAsync();
            foreach (var l in fdAutoRenewals)
            {
                AddAccount(map, l.VoucherID, "FD", "मुदत ठेव", l.OldAcc, l.OldLegacy, l.OldRec, "जुनी ठेव");
                AddAccount(map, l.VoucherID, "FD", "मुदत ठेव", l.NewAcc, l.NewLegacy, l.NewRec, "नवीन ठेव");
            }

            // 4. Recurring Deposits (RD)
            var rdTxns = await db.RdTransactions.AsNoTracking()
                .Where(r => r.VoucherID.HasValue && voucherIds.Contains(r.VoucherID.Value))
                .Select(r => new
                {
                    VoucherID = r.VoucherID!.Value,
                    AccNo = r.RdAccount != null ? r.RdAccount.AccountNo : null,
                    OldNo = r.RdAccount != null ? r.RdAccount.LegacyAccountNumber : null
                })
                .ToListAsync();
            foreach (var r in rdTxns)
                AddAccount(map, r.VoucherID, "RD", "आरडी", r.AccNo, r.OldNo);

            var rdSched = await db.RDInstallmentSchedules.AsNoTracking()
                .Where(s => s.VoucherID.HasValue && voucherIds.Contains(s.VoucherID.Value))
                .Select(s => new
                {
                    VoucherID = s.VoucherID!.Value,
                    AccNo = s.RdAccount != null ? s.RdAccount.AccountNo : null,
                    OldNo = s.RdAccount != null ? s.RdAccount.LegacyAccountNumber : null
                })
                .ToListAsync();
            foreach (var s in rdSched)
                AddAccount(map, s.VoucherID, "RD", "आरडी", s.AccNo, s.OldNo);

            var rdAccruals = await db.RdInterestAccruals.AsNoTracking()
                .Where(a => voucherIds.Contains(a.VoucherID))
                .Select(a => new
                {
                    a.VoucherID,
                    AccNo = a.RdAccount != null ? a.RdAccount.AccountNo : null,
                    OldNo = a.RdAccount != null ? a.RdAccount.LegacyAccountNumber : null
                })
                .ToListAsync();
            foreach (var a in rdAccruals)
                AddAccount(map, a.VoucherID, "RD", "आरडी", a.AccNo, a.OldNo);

            // 5. Saving Accounts (Transactions & Closings linked by VoucherNo)
            if (voucherNos.Count > 0)
            {
                var savTxns = await db.SavingTransactions.AsNoTracking()
                    .Where(st => st.VoucherNo != null && voucherNos.Contains(st.VoucherNo))
                    .Select(st => new
                    {
                        st.VoucherNo,
                        AccNo = st.SavingAccount != null ? st.SavingAccount.AccountNo : null,
                        OldNo = st.SavingAccount != null ? st.SavingAccount.OldAccountNo : null,
                        LegacyNo = st.SavingAccount != null ? st.SavingAccount.LegacyAccountNumber : null,
                        TargetAccNo = st.TargetSavingAccount != null ? st.TargetSavingAccount.AccountNo : null,
                        TargetOldNo = st.TargetSavingAccount != null ? st.TargetSavingAccount.OldAccountNo : null,
                        TargetLegacyNo = st.TargetSavingAccount != null ? st.TargetSavingAccount.LegacyAccountNumber : null
                    })
                    .ToListAsync();
                foreach (var st in savTxns)
                {
                    if (st.VoucherNo != null && voucherNoToIds.TryGetValue(st.VoucherNo.Trim(), out var matchedVIds))
                    {
                        foreach (var vId in matchedVIds)
                        {
                            AddAccount(map, vId, "Saving", "बचत", st.AccNo, FirstNonEmpty(st.OldNo, st.LegacyNo));
                            if (!string.IsNullOrWhiteSpace(st.TargetAccNo) || !string.IsNullOrWhiteSpace(st.TargetOldNo) || !string.IsNullOrWhiteSpace(st.TargetLegacyNo))
                                AddAccount(map, vId, "Saving", "बचत", st.TargetAccNo, FirstNonEmpty(st.TargetOldNo, st.TargetLegacyNo), roleLabel: "हस्तांतरण");
                        }
                    }
                }

                var savClosings = await db.SavingAccountClosings.AsNoTracking()
                    .Where(sc => sc.VoucherNo != null && voucherNos.Contains(sc.VoucherNo))
                    .Select(sc => new
                    {
                        sc.VoucherNo,
                        AccNo = sc.SavingAccount != null ? sc.SavingAccount.AccountNo : null,
                        OldNo = sc.SavingAccount != null ? sc.SavingAccount.OldAccountNo : null,
                        LegacyNo = sc.SavingAccount != null ? sc.SavingAccount.LegacyAccountNumber : null
                    })
                    .ToListAsync();
                foreach (var sc in savClosings)
                {
                    if (sc.VoucherNo != null && voucherNoToIds.TryGetValue(sc.VoucherNo.Trim(), out var matchedVIds))
                    {
                        foreach (var vId in matchedVIds)
                            AddAccount(map, vId, "Saving", "बचत", sc.AccNo, FirstNonEmpty(sc.OldNo, sc.LegacyNo));
                    }
                }
            }

            // 6. Pigmy Deposits
            var pigmyColls = await db.PigmyCollections.AsNoTracking()
                .Where(p => p.VoucherId.HasValue && voucherIds.Contains(p.VoucherId.Value))
                .Select(p => new
                {
                    VoucherID = p.VoucherId!.Value,
                    AccNo = p.PigmyAccount != null ? p.PigmyAccount.AccountNo : null,
                    OldNo = p.PigmyAccount != null ? p.PigmyAccount.OldAccountNo : null,
                    LegacyNo = p.PigmyAccount != null ? p.PigmyAccount.LegacyAccountNumber : null,
                    PrevNo = p.PigmyAccount != null ? p.PigmyAccount.PreviousAccountNo : null
                })
                .ToListAsync();
            foreach (var p in pigmyColls)
                AddAccount(map, p.VoucherID, "Pigmy", "पिग्मी", p.AccNo, FirstNonEmpty(p.OldNo, p.LegacyNo, p.PrevNo));

            var pigmyLogs = await db.PigmyInterestLogs.AsNoTracking()
                .Where(p => p.VoucherId.HasValue && voucherIds.Contains(p.VoucherId.Value))
                .Select(p => new
                {
                    VoucherID = p.VoucherId!.Value,
                    AccNo = p.PigmyAccount != null ? p.PigmyAccount.AccountNo : null,
                    OldNo = p.PigmyAccount != null ? p.PigmyAccount.OldAccountNo : null,
                    LegacyNo = p.PigmyAccount != null ? p.PigmyAccount.LegacyAccountNumber : null,
                    PrevNo = p.PigmyAccount != null ? p.PigmyAccount.PreviousAccountNo : null
                })
                .ToListAsync();
            foreach (var p in pigmyLogs)
                AddAccount(map, p.VoucherID, "Pigmy", "पिग्मी", p.AccNo, FirstNonEmpty(p.OldNo, p.LegacyNo, p.PrevNo));

            if (voucherNos.Count > 0)
            {
                var pigmyWithdrawals = await db.PigmyWithdrawals.AsNoTracking()
                    .Where(pw => pw.VoucherNo != null && voucherNos.Contains(pw.VoucherNo))
                    .Select(pw => new
                    {
                        pw.VoucherNo,
                        AccNo = pw.PigmyAccount != null ? pw.PigmyAccount.AccountNo : null,
                        OldNo = pw.PigmyAccount != null ? pw.PigmyAccount.OldAccountNo : null,
                        LegacyNo = pw.PigmyAccount != null ? pw.PigmyAccount.LegacyAccountNumber : null,
                        PrevNo = pw.PigmyAccount != null ? pw.PigmyAccount.PreviousAccountNo : null
                    })
                    .ToListAsync();
                foreach (var pw in pigmyWithdrawals)
                {
                    if (pw.VoucherNo != null && voucherNoToIds.TryGetValue(pw.VoucherNo.Trim(), out var matchedVIds))
                    {
                        foreach (var vId in matchedVIds)
                            AddAccount(map, vId, "Pigmy", "पिग्मी", pw.AccNo, FirstNonEmpty(pw.OldNo, pw.LegacyNo, pw.PrevNo));
                    }
                }
            }

            // 7. Share Capital
            var shareTxns = await db.ShareTransactions.AsNoTracking()
                .Where(st => st.VoucherId.HasValue && voucherIds.Contains(st.VoucherId.Value))
                .Select(st => new
                {
                    VoucherID = st.VoucherId!.Value,
                    AccNo = st.ShareAccount != null ? st.ShareAccount.AccountNo : null,
                    OldNo = st.ShareAccount != null ? st.ShareAccount.LegacyAccountNumber : null
                })
                .ToListAsync();
            foreach (var st in shareTxns)
                AddAccount(map, st.VoucherID, "Share", "शेअर्स", st.AccNo, st.OldNo);

            // 8. Investment Accounts
            var invMaturities = await db.InvestmentMaturities.AsNoTracking()
                .Where(i => i.VoucherID.HasValue && voucherIds.Contains(i.VoucherID.Value))
                .Select(i => new { VoucherID = i.VoucherID!.Value, InvNo = i.InvestmentAccount != null ? i.InvestmentAccount.InvestmentNo : null, OldNo = i.InvestmentAccount != null ? i.InvestmentAccount.OldInvestmentNo : null, RecNo = i.InvestmentAccount != null ? i.InvestmentAccount.DepositReceiptNo : null })
                .ToListAsync();
            AddInvestments(invMaturities.Select(x => (x.VoucherID, x.InvNo, x.OldNo, x.RecNo)));

            var invPremature = await db.InvestmentPrematureWithdrawals.AsNoTracking()
                .Where(i => i.VoucherID.HasValue && voucherIds.Contains(i.VoucherID.Value))
                .Select(i => new { VoucherID = i.VoucherID!.Value, InvNo = i.InvestmentAccount != null ? i.InvestmentAccount.InvestmentNo : null, OldNo = i.InvestmentAccount != null ? i.InvestmentAccount.OldInvestmentNo : null, RecNo = i.InvestmentAccount != null ? i.InvestmentAccount.DepositReceiptNo : null })
                .ToListAsync();
            AddInvestments(invPremature.Select(x => (x.VoucherID, x.InvNo, x.OldNo, x.RecNo)));

            var invReceipts = await db.InvestmentInterestReceipts.AsNoTracking()
                .Where(i => i.VoucherID.HasValue && voucherIds.Contains(i.VoucherID.Value))
                .Select(i => new { VoucherID = i.VoucherID!.Value, InvNo = i.InvestmentAccount != null ? i.InvestmentAccount.InvestmentNo : null, OldNo = i.InvestmentAccount != null ? i.InvestmentAccount.OldInvestmentNo : null, RecNo = i.InvestmentAccount != null ? i.InvestmentAccount.DepositReceiptNo : null })
                .ToListAsync();
            AddInvestments(invReceipts.Select(x => (x.VoucherID, x.InvNo, x.OldNo, x.RecNo)));

            var invAccruals = await db.InvestmentInterestAccruals.AsNoTracking()
                .Where(i => i.VoucherID.HasValue && voucherIds.Contains(i.VoucherID.Value))
                .Select(i => new { VoucherID = i.VoucherID!.Value, InvNo = i.InvestmentAccount != null ? i.InvestmentAccount.InvestmentNo : null, OldNo = i.InvestmentAccount != null ? i.InvestmentAccount.OldInvestmentNo : null, RecNo = i.InvestmentAccount != null ? i.InvestmentAccount.DepositReceiptNo : null })
                .ToListAsync();
            AddInvestments(invAccruals.Select(x => (x.VoucherID, x.InvNo, x.OldNo, x.RecNo)));

            // Investment Opening Vouchers (PAY-INV-OP-{InvestmentNo})
            var invOpNos = voucherNos
                .Where(vn => vn.StartsWith("PAY-INV-OP-", StringComparison.OrdinalIgnoreCase))
                .Select(vn => vn.Substring("PAY-INV-OP-".Length).Trim())
                .Where(invNo => !string.IsNullOrWhiteSpace(invNo))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (invOpNos.Count > 0)
            {
                var invAccounts = await db.InvestmentAccounts.AsNoTracking()
                    .Where(ia => ia.InvestmentNo != null && invOpNos.Contains(ia.InvestmentNo))
                    .Select(ia => new { ia.InvestmentNo, ia.OldInvestmentNo, ia.DepositReceiptNo })
                    .ToListAsync();
                foreach (var ia in invAccounts)
                {
                    if (!string.IsNullOrWhiteSpace(ia.InvestmentNo) &&
                        voucherNoToIds.TryGetValue($"PAY-INV-OP-{ia.InvestmentNo.Trim()}", out var matchedVIds))
                    {
                        foreach (var vId in matchedVIds)
                            AddAccount(map, vId, "Investment", "गुंतवणूक", ia.InvestmentNo, ia.OldInvestmentNo, ia.DepositReceiptNo);
                    }
                }
            }

            var invRenewals = await db.InvestmentRenewals.AsNoTracking()
                .Where(i => i.VoucherID.HasValue && voucherIds.Contains(i.VoucherID.Value))
                .Select(i => new
                {
                    VoucherID = i.VoucherID!.Value,
                    OldInvNo = i.OldInvestmentAccount != null ? i.OldInvestmentAccount.InvestmentNo : null,
                    OldLegacy = i.OldInvestmentAccount != null ? i.OldInvestmentAccount.OldInvestmentNo : null,
                    OldRec = i.OldInvestmentAccount != null ? i.OldInvestmentAccount.DepositReceiptNo : null,
                    NewInvNo = i.NewInvestmentAccount != null ? i.NewInvestmentAccount.InvestmentNo : null,
                    NewLegacy = i.NewInvestmentAccount != null ? i.NewInvestmentAccount.OldInvestmentNo : null,
                    NewRec = i.NewInvestmentAccount != null ? i.NewInvestmentAccount.DepositReceiptNo : null
                })
                .ToListAsync();
            foreach (var i in invRenewals)
            {
                AddAccount(map, i.VoucherID, "Investment", "गुंतवणूक", i.OldInvNo, i.OldLegacy, i.OldRec, "जुनी गुंतवणूक");
                AddAccount(map, i.VoucherID, "Investment", "गुंतवणूक", i.NewInvNo, i.NewLegacy, i.NewRec, "नवीन गुंतवणूक");
            }

            // 9. Lockers
            var lockerAllots = await db.LockerAllotments.AsNoTracking()
                .Where(l => (l.DepositVoucherID.HasValue && voucherIds.Contains(l.DepositVoucherID.Value)) ||
                            (l.AdvanceRentVoucherID.HasValue && voucherIds.Contains(l.AdvanceRentVoucherID.Value)))
                .Select(l => new
                {
                    l.DepositVoucherID,
                    l.AdvanceRentVoucherID,
                    l.LockerAccountNo
                })
                .ToListAsync();
            foreach (var l in lockerAllots)
            {
                if (l.DepositVoucherID.HasValue)
                    AddAccount(map, l.DepositVoucherID.Value, "Locker", "लॉकर", l.LockerAccountNo, null);
                if (l.AdvanceRentVoucherID.HasValue)
                    AddAccount(map, l.AdvanceRentVoucherID.Value, "Locker", "लॉकर", l.LockerAccountNo, null);
            }

            var lockerRents = await db.LockerRentPostings.AsNoTracking()
                .Where(r => r.VoucherID.HasValue && voucherIds.Contains(r.VoucherID.Value))
                .Select(r => new
                {
                    VoucherID = r.VoucherID!.Value,
                    LockerNo = r.Allotment != null ? r.Allotment.LockerAccountNo : null
                })
                .ToListAsync();
            foreach (var r in lockerRents)
                AddAccount(map, r.VoucherID, "Locker", "लॉकर", r.LockerNo, null);

            var lockerSurrenders = await db.LockerSurrenders.AsNoTracking()
                .Where(s => s.VoucherID.HasValue && voucherIds.Contains(s.VoucherID.Value))
                .Select(s => new
                {
                    VoucherID = s.VoucherID!.Value,
                    LockerNo = s.Allotment != null ? s.Allotment.LockerAccountNo : null
                })
                .ToListAsync();
            foreach (var s in lockerSurrenders)
                AddAccount(map, s.VoucherID, "Locker", "लॉकर", s.LockerNo, null);

            foreach (var v in vouchers)
            {
                v.LinkedAccounts = map.TryGetValue(v.VoucherID, out var linked)
                    ? linked
                    : new List<VoucherLinkedAccountDto>();
            }
        }
    }
}

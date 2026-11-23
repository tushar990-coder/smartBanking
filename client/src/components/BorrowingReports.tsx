import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { BookOpen, Calendar, Building2, Printer, Download } from 'lucide-react';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';

interface BorrowingReportsProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const fmtAmt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN');
};

export default function BorrowingReports({ onNavigate }: BorrowingReportsProps) {
  const searchParams = new URLSearchParams(window.location.search);
  const urlBorrowingId = Number(searchParams.get('borrowingId') || 0);
  const initialTab = (searchParams.get('subTab') as 'ledger' | 'emis' | 'register') || 'ledger';

  const [activeSubTab, setActiveSubTab] = useState<'ledger' | 'emis' | 'register'>(initialTab);
  const [sansthaName, setSansthaName] = useState('पतसंस्था मर्यादित');
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [selectedBorrowingId, setSelectedBorrowingId] = useState<number>(urlBorrowingId);
  const [ledgerStatement, setLedgerStatement] = useState<any | null>(null);
  const [upcomingEmis, setUpcomingEmis] = useState<any[]>([]);
  const [emiHorizonDays, setEmiHorizonDays] = useState<number>(30);
  const [regStatusFilter, setRegStatusFilter] = useState<string>('all');
  const [regTypeFilter, setRegTypeFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get('/api/SansthaDetails')
      .then((r) => {
        const row = Array.isArray(r.data) ? r.data[0] : r.data;
        if (row?.sansthaName) setSansthaName(row.sansthaName);
      })
      .catch(() => {});

    loadBaseBorrowings();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'emis') {
      loadUpcomingEmis(emiHorizonDays);
    }
  }, [activeSubTab, emiHorizonDays]);

  const loadBaseBorrowings = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/Borrowings', { params: { status: 'all' } });
      const items = res.data?.items || [];
      setBorrowings(items);
      const defaultId = urlBorrowingId || items[0]?.borrowingID || 0;
      if (defaultId > 0) {
        setSelectedBorrowingId(defaultId);
        await loadLedger(defaultId);
      }
    } catch (err) {
      toast.error('बाह्य कर्ज अहवाल माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (id: number) => {
    if (!id) return;
    try {
      const res = await axios.get(`/api/Borrowings/${id}/ledger`);
      setLedgerStatement(res.data);
    } catch (err) {
      toast.error('खाते खतावणी लोड करताना त्रुटी आली.');
    }
  };

  const loadUpcomingEmis = async (days: number) => {
    try {
      const res = await axios.get('/api/Borrowings/upcoming-emis', { params: { days } });
      setUpcomingEmis(res.data?.items || []);
    } catch (err) {
      toast.error('देय हप्ते कॅलेंडर लोड करताना त्रुटी आली.');
    }
  };

  const accountOptions = useMemo<SearchableSelectOption[]>(() => {
    return borrowings.map((b) => ({
      value: String(b.borrowingID),
      label: `${b.borrowingNo} — ${b.lenderName}${b.externalLoanAccountNo ? ` (A/c: ${b.externalLoanAccountNo})` : ''}`,
      subLabel: `स्थिती: ${b.status} • उचल: ₹${fmtAmt(b.disbursedAmount)} • येणे बाकी: ₹${fmtAmt(b.outstandingPrincipal)}`,
      badge: b.status
    }));
  }, [borrowings]);

  const filteredRegister = useMemo(() => {
    return borrowings.filter((b) => {
      if (regStatusFilter !== 'all' && b.status !== regStatusFilter) return false;
      if (regTypeFilter !== 'all' && b.borrowingType !== regTypeFilter) return false;
      return true;
    });
  }, [borrowings, regStatusFilter, regTypeFilter]);

  const exportEmisCsv = () => {
    const headers = [
      'BorrowingNo',
      'LenderName',
      'ExternalAccountNo',
      'InstallmentNo',
      'DueDate',
      'PrincipalDue',
      'InterestDue',
      'TotalDue',
      'Status'
    ];
    const rows = upcomingEmis.map((r) => [
      r.borrowingNo,
      `"${(r.lenderName || '').replace(/"/g, '""')}"`,
      r.externalLoanAccountNo || '',
      r.installmentNo,
      fmtDate(r.dueDate),
      r.principalDue,
      r.interestDue,
      r.totalDue,
      r.status
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Borrowing_Due_EMIs_${emiHorizonDays}Days.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* Top Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              ५. बाह्य कर्ज खतावणी, देय हप्ते कॅलेंडर व रजिस्टर (Borrowing Reports)
            </h1>
            <p className="text-xs text-slate-500">
              संपूर्ण पासबुक स्टेटमेंट, हप्त्यांचे देय कॅलेंडर व बँक/पतसंस्थानिहाय एकत्रित कर्ज रजिस्टर
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> अहवाल प्रिंट करा
          </button>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('borrowing-dashboard')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              ← डॅशबोर्ड
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {[
          { id: 'ledger', label: '📖 १. बाह्य कर्ज खाते खतावणी (Account Khatavani)', icon: BookOpen },
          { id: 'emis', label: '📅 २. देय व थकीत हप्ते कॅलेंडर (Due EMIs Calendar)', icon: Calendar },
          { id: 'register', label: '🏛️ ३. बँक / पतसंस्थानिहाय रजिस्टर (Borrowing Register)', icon: Building2 }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveSubTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
              activeSubTab === t.id
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =====================================================================
          SUB-TAB 1: ACCOUNT KHATAVANI & SCHEDULE
         ===================================================================== */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="max-w-xl print:hidden">
            <label className="block text-xs font-bold text-slate-700 mb-1">बाह्य कर्ज खाते निवडा</label>
            <SearchableSelect
              options={accountOptions}
              value={selectedBorrowingId ? String(selectedBorrowingId) : ''}
              onChange={(val) => {
                const id = Number(val);
                setSelectedBorrowingId(id);
                if (id > 0) loadLedger(id);
              }}
              placeholder="कर्ज क्र. किंवा बँक नावाने शोधा..."
            />
          </div>

          {ledgerStatement?.account && (
            <div className="space-y-4">
              <div className="text-center border-b border-slate-300 pb-3">
                <div className="text-base font-black text-slate-900">{sansthaName}</div>
                <div className="text-xs font-bold text-slate-600">
                  बाह्य कर्ज खाते खतावणी व हप्ता विवरणपत्र (External Borrowing Account Ledger)
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500">संस्था कर्ज क्र.:</span>{' '}
                  <strong>{ledgerStatement.account.borrowingNo}</strong>
                </div>
                <div>
                  <span className="text-slate-500">बँक / पतसंस्था:</span>{' '}
                  <strong>{ledgerStatement.account.lenderName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">बाह्य खाते क्र.:</span>{' '}
                  <strong>{ledgerStatement.account.externalLoanAccountNo || '—'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">स्थिती:</span>{' '}
                  <strong>{ledgerStatement.account.status}</strong>
                </div>
                <div>
                  <span className="text-slate-500">मंजूर मर्यादा:</span>{' '}
                  <strong>₹{fmtAmt(ledgerStatement.account.sanctionedAmount)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">एकूण उचल:</span>{' '}
                  <strong>₹{fmtAmt(ledgerStatement.account.disbursedAmount)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">सध्या येणे मुद्दल:</span>{' '}
                  <strong className="text-rose-700">₹{fmtAmt(ledgerStatement.account.outstandingPrincipal)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">व्याजदर व हप्ता:</span>{' '}
                  <strong>
                    {ledgerStatement.account.borrowingInterestRate}% • ₹{fmtAmt(ledgerStatement.account.installmentAmount)}
                  </strong>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 mb-2">१. कालक्रमानुसार व्यवहार पासबुक (Passbook Entries)</h3>
                <table className="w-full text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-2.5 py-2 text-left border">अ.क्र.</th>
                      <th className="px-2.5 py-2 text-left border">तारीख</th>
                      <th className="px-2.5 py-2 text-left border">संदर्भ व तपशील</th>
                      <th className="px-2.5 py-2 text-right border">कर्ज उचल जमा (Cr ₹)</th>
                      <th className="px-2.5 py-2 text-right border">मुद्दल परतफेड (Dr ₹)</th>
                      <th className="px-2.5 py-2 text-right border">दिलेले व्याज/शुल्क (₹)</th>
                      <th className="px-2.5 py-2 text-right border">येणे मुद्दल बाकी (₹)</th>
                      <th className="px-2.5 py-2 text-left border">व्हाउचर क्र.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ledgerStatement.entries || []).map((e: any) => (
                      <tr key={e.srNo} className="hover:bg-slate-50">
                        <td className="px-2.5 py-1.5 border">{e.srNo}</td>
                        <td className="px-2.5 py-1.5 border">{fmtDate(e.date)}</td>
                        <td className="px-2.5 py-1.5 border">
                          <span className="font-semibold">{e.refNo}</span> — {e.particulars}
                        </td>
                        <td className="px-2.5 py-1.5 border text-right font-semibold text-indigo-700">
                          {e.creditBorrowed > 0 ? fmtAmt(e.creditBorrowed) : '—'}
                        </td>
                        <td className="px-2.5 py-1.5 border text-right font-semibold text-emerald-700">
                          {e.debitPrincipalPaid > 0 ? fmtAmt(e.debitPrincipalPaid) : '—'}
                        </td>
                        <td className="px-2.5 py-1.5 border text-right">
                          {e.interestAndChargesPaid > 0 ? fmtAmt(e.interestAndChargesPaid) : '—'}
                        </td>
                        <td className="px-2.5 py-1.5 border text-right font-bold text-slate-900">
                          ₹{fmtAmt(e.runningPrincipalBalance)}
                        </td>
                        <td className="px-2.5 py-1.5 border text-[11px]">{e.voucherNo}</td>
                      </tr>
                    ))}
                    {(ledgerStatement.entries || []).length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                          अद्याप कोणताही उचल किंवा परतफेड व्यवहार नोंदवलेला नाही.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: UPCOMING & OVERDUE EMIS CALENDAR
         ===================================================================== */}
      {activeSubTab === 'emis' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">कालावधी निवडा:</span>
              {[7, 15, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setEmiHorizonDays(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                    emiHorizonDays === d
                      ? 'bg-indigo-600 text-white border-indigo-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  पुढील {d} दिवस (व सर्व थकीत)
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportEmisCsv}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Excel / CSV डाउनलोड
            </button>
          </div>

          <table className="w-full text-xs border border-slate-200">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left border">देय तारीख</th>
                <th className="px-3 py-2 text-left border">बँक / पतसंस्था व खाते</th>
                <th className="px-3 py-2 text-center border">हप्ता #</th>
                <th className="px-3 py-2 text-right border">देय मुद्दल (₹)</th>
                <th className="px-3 py-2 text-right border">देय व्याज (₹)</th>
                <th className="px-3 py-2 text-right border">एकूण देय (₹)</th>
                <th className="px-3 py-2 text-center border">स्थिती</th>
                <th className="px-3 py-2 text-center border print:hidden">कृती</th>
              </tr>
            </thead>
            <tbody>
              {upcomingEmis.map((r, idx) => (
                <tr key={idx} className={r.isOverdue ? 'bg-rose-50/60' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2 border font-bold">{fmtDate(r.dueDate)}</td>
                  <td className="px-3 py-2 border">
                    <div className="font-bold text-slate-900">{r.lenderName}</div>
                    <div className="text-[11px] text-slate-500">
                      {r.borrowingNo} {r.externalLoanAccountNo ? `• A/c: ${r.externalLoanAccountNo}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 border text-center font-bold">#{r.installmentNo}</td>
                  <td className="px-3 py-2 border text-right">₹{fmtAmt(r.principalDue)}</td>
                  <td className="px-3 py-2 border text-right">₹{fmtAmt(r.interestDue)}</td>
                  <td className="px-3 py-2 border text-right font-black text-rose-800">₹{fmtAmt(r.totalDue)}</td>
                  <td className="px-3 py-2 border text-center">
                    {r.isOverdue ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                        {r.overdueDays} दिवस थकीत
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        {r.daysRemaining === 0 ? 'आज देय' : `${r.daysRemaining} दिवसांत`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 border text-center print:hidden">
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('borrowing-repayment', { borrowingId: r.borrowingID })}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold"
                      >
                        हप्ता भरा →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {upcomingEmis.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    निवडलेल्या कालावधीत कोणताही थकीत किंवा येणारा बाह्य कर्ज हप्ता नाही.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: LENDER-WISE MASTER REGISTER
         ===================================================================== */}
      {activeSubTab === 'register' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap gap-3 print:hidden">
            <select
              value={regStatusFilter}
              onChange={(e) => setRegStatusFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              <option value="all">सर्व स्थिती (All Status)</option>
              <option value="Sanctioned">Sanctioned (मंजूर)</option>
              <option value="Active">Active (सक्रिय)</option>
              <option value="Closed">Closed (बंद)</option>
            </select>
            <select
              value={regTypeFilter}
              onChange={(e) => setRegTypeFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              <option value="all">सर्व कर्ज प्रकार (All Types)</option>
              <option value="GOLD_REPLEDGE">सोने पुनर्गहाण (Gold Re-pledge)</option>
              <option value="TERM_LOAN">सामान्य मुदत कर्ज (Term Loan)</option>
              <option value="CASH_CREDIT_OD">कॅश क्रेडिट / OD</option>
              <option value="FD_AGAINST_LOAN">FD तारण कर्ज</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-2.5 py-2 text-left border">कर्ज क्र.</th>
                  <th className="px-2.5 py-2 text-left border">बँक / पतसंस्था</th>
                  <th className="px-2.5 py-2 text-left border">प्रकार</th>
                  <th className="px-2.5 py-2 text-right border">मंजूर (₹)</th>
                  <th className="px-2.5 py-2 text-right border">उचल (₹)</th>
                  <th className="px-2.5 py-2 text-right border">येणे बाकी (₹)</th>
                  <th className="px-2.5 py-2 text-right border">दिलेले व्याज (₹)</th>
                  <th className="px-2.5 py-2 text-center border">दर %</th>
                  <th className="px-2.5 py-2 text-right border">गहाण सोने (ग्रॅम)</th>
                  <th className="px-2.5 py-2 text-center border">स्थिती</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegister.map((b) => (
                  <tr key={b.borrowingID} className="hover:bg-slate-50">
                    <td className="px-2.5 py-1.5 border font-bold">{b.borrowingNo}</td>
                    <td className="px-2.5 py-1.5 border">
                      <div className="font-semibold">{b.lenderName}</div>
                      {b.externalLoanAccountNo && (
                        <div className="text-[10px] text-slate-500">A/c: {b.externalLoanAccountNo}</div>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 border text-[11px]">{b.borrowingType}</td>
                    <td className="px-2.5 py-1.5 border text-right">{fmtAmt(b.sanctionedAmount)}</td>
                    <td className="px-2.5 py-1.5 border text-right">{fmtAmt(b.disbursedAmount)}</td>
                    <td className="px-2.5 py-1.5 border text-right font-bold text-rose-700">
                      {fmtAmt(b.outstandingPrincipal)}
                    </td>
                    <td className="px-2.5 py-1.5 border text-right">{fmtAmt(b.totalInterestPaid)}</td>
                    <td className="px-2.5 py-1.5 border text-center">{b.borrowingInterestRate}%</td>
                    <td className="px-2.5 py-1.5 border text-right">
                      {b.totalPledgedNetWeight > 0 ? `${fmtWt(b.totalPledgedNetWeight)} g` : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 border text-center font-bold">{b.status}</td>
                  </tr>
                ))}
                {filteredRegister.length > 0 && (
                  <tr className="bg-slate-100 font-black">
                    <td colSpan={3} className="px-2.5 py-2 border text-right">एकूण (Total):</td>
                    <td className="px-2.5 py-2 border text-right">
                      ₹{fmtAmt(filteredRegister.reduce((s, x) => s + Number(x.sanctionedAmount || 0), 0))}
                    </td>
                    <td className="px-2.5 py-2 border text-right">
                      ₹{fmtAmt(filteredRegister.reduce((s, x) => s + Number(x.disbursedAmount || 0), 0))}
                    </td>
                    <td className="px-2.5 py-2 border text-right text-rose-800">
                      ₹{fmtAmt(filteredRegister.reduce((s, x) => s + Number(x.outstandingPrincipal || 0), 0))}
                    </td>
                    <td className="px-2.5 py-2 border text-right">
                      ₹{fmtAmt(filteredRegister.reduce((s, x) => s + Number(x.totalInterestPaid || 0), 0))}
                    </td>
                    <td className="px-2.5 py-2 border"></td>
                    <td className="px-2.5 py-2 border text-right">
                      {fmtWt(filteredRegister.reduce((s, x) => s + Number(x.totalPledgedNetWeight || 0), 0))} g
                    </td>
                    <td className="px-2.5 py-2 border"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Building2,
  PlusCircle,
  ArrowDownCircle,
  Banknote,
  Unlock,
  FileText,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  Coins,
  ArrowRight
} from 'lucide-react';

interface BorrowingDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const fmtAmt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWt = (n?: number | null) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function BorrowingDashboard({ onNavigate }: BorrowingDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any>(null);
  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [upcomingEmis, setUpcomingEmis] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [brwRes, emiRes] = await Promise.all([
        axios.get('/api/Borrowings', { params: { status: 'all' } }),
        axios.get('/api/Borrowings/upcoming-emis', { params: { days: 30 } })
      ]);
      setKpis(brwRes.data?.kpis || null);
      setBorrowings(brwRes.data?.items || []);
      setUpcomingEmis(emiRes.data?.items || []);
    } catch (err) {
      console.error('Failed to load Borrowing Dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const nav = (tab: string, params?: any) => {
    if (onNavigate) onNavigate(tab, params);
  };

  const activeAndSanctioned = borrowings.filter((b) => b.status !== 'Closed');

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Header Banner */}
      <div className="bg-primary px-3.5 py-2.5 text-white rounded-sm shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-white/15">
            <Building2 size={18} />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-bold">
              बाह्य कर्जे व सोने पुनर्गहाण मुख्य डॅशबोर्ड (Bank &amp; Patsanstha Borrowings Hub)
            </h1>
            <p className="text-[10.5px] text-amber-100">
              खाते उघडणे (Sanction) → निधी उचल (Disbursement) → हप्ता वेळापत्रक व परतफेड (Loan Repaid) → दागिने सुटका व खतावणी
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => nav('borrowing-account')}
            className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center gap-1 cursor-pointer"
          >
            <PlusCircle size={13} /> १. नवीन बाह्य कर्ज खाते
          </button>
          <button
            type="button"
            onClick={() => nav('borrowing-disbursement')}
            className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
          >
            <ArrowDownCircle size={13} /> २. रक्कम उचल (Disbursement)
          </button>
          <button
            type="button"
            onClick={() => nav('borrowing-repayment')}
            className="px-2.5 py-1 rounded bg-white text-primary hover:bg-amber-50 font-bold flex items-center gap-1 cursor-pointer"
          >
            <Banknote size={13} /> ३. हप्ता भरणा (Repaid)
          </button>
        </div>
      </div>

      {/* Closed Customer Loan Alert */}
      {kpis?.closedMemberLoanAlertCount > 0 && (
        <div className="p-2.5 bg-red-50 border border-red-300 rounded-sm flex flex-wrap items-center justify-between gap-2 text-red-900">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <span>
              अत्यंत महत्त्वाची सूचना: {kpis.closedMemberLoanAlertCount} ग्राहकांचे सुवर्ण कर्ज संस्थेत पूर्ण फिटले आहे, परंतु त्यांचे सोने पाकीट अद्याप बाह्य बँक/पतसंस्थेकडे पुनर्गहाण आहे!
            </span>
          </div>
          <button
            type="button"
            onClick={() => nav('borrowing-custody')}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[11px] cursor-pointer flex items-center gap-1"
          >
            <Unlock size={12} /> तात्काळ पाकीट सोडवा
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className="bg-white border border-slate-300 rounded-sm p-2.5 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-bold">मंजूर बाह्य कर्ज मर्यादा</div>
            <div className="text-sm font-extrabold text-[#5A1A14] font-mono">₹{fmtAmt(kpis.totalSanctionedAmount)}</div>
            <div className="text-[10px] text-amber-700 font-semibold">
              {kpis.sanctionedAccountsCount} खाती उचल प्रलंबित (Sanctioned)
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-sm p-2.5 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-bold">चालू देणे मुद्दल बाकी</div>
            <div className="text-sm font-extrabold text-rose-700 font-mono">₹{fmtAmt(kpis.totalOutstandingPrincipal)}</div>
            <div className="text-[10px] text-slate-600">{kpis.activeBorrowingsCount} सक्रिय बाह्य कर्ज खाती</div>
          </div>

          <div className={`border rounded-sm p-2.5 shadow-2xs ${kpis.overdueInstallmentsCount > 0 ? 'bg-red-50 border-red-300' : 'bg-white border-slate-300'}`}>
            <div className="text-[10px] text-red-800 font-bold flex items-center gap-1">
              <CalendarClock size={12} /> थकीत हप्ते (Overdue EMIs)
            </div>
            <div className="text-sm font-extrabold text-red-700 font-mono">
              {kpis.overdueInstallmentsCount} हप्ते (₹{fmtAmt(kpis.overdueInstallmentsAmount)})
            </div>
            <div className="text-[10px] text-slate-600">
              पुढील १५ दि.: {kpis.upcoming15DaysEmisCount} हप्ते (₹{fmtAmt(kpis.upcoming15DaysEmisAmount)})
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-sm p-2.5 shadow-2xs">
            <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
              <Coins size={12} /> पुनर्गहाण सोने पाकिटे
            </div>
            <div className="text-sm font-extrabold text-purple-800 font-mono">
              {kpis.activeRepledgedPacketsCount} पाकिटे
            </div>
            <div className="text-[10px] text-slate-600">निव्वळ वजन: {fmtWt(kpis.totalRepledgedNetWeight)} ग्रॅम</div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-300 rounded-sm p-2.5 shadow-2xs">
            <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1">
              <TrendingUp size={12} /> निव्वळ व्याज मार्जिन (Spread)
            </div>
            <div className="text-sm font-extrabold text-emerald-800 font-mono">
              {kpis.netInterestSpreadPercent >= 0 ? '+' : ''}{kpis.netInterestSpreadPercent}%
            </div>
            <div className="text-[10px] text-emerald-700">
              बाह्य दर: {kpis.weightedBorrowingRate}% vs ग्राहक: {kpis.avgCustomerLendingRate}%
            </div>
          </div>
        </div>
      )}

      {/* 5-Stage Module Quick Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { tab: 'borrowing-account', title: '१. नवीन खाते उघडणे', sub: 'मंजुरी अटी व EMI तक्ता', icon: PlusCircle, color: 'text-[#9A3412] bg-amber-50 border-amber-200' },
          { tab: 'borrowing-disbursement', title: '२. कर्ज रक्कम उचल', sub: 'निधी जमा व सोने पुनर्गहाण', icon: ArrowDownCircle, color: 'text-amber-800 bg-amber-50 border-amber-200' },
          { tab: 'borrowing-repayment', title: '३. हप्ता भरणा (Repaid)', sub: 'EMI ट्रॅकिंग व परतफेड', icon: Banknote, color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
          { tab: 'borrowing-custody', title: '४. सोने पाकीट सुटका', sub: 'दागिने परत तिजोरीत घ्या', icon: Unlock, color: 'text-purple-800 bg-purple-50 border-purple-200' },
          { tab: 'borrowing-reports', title: '५. खतावणी व अहवाल', sub: 'लेजर स्टेटमेंट व रजिस्टर', icon: FileText, color: 'text-slate-800 bg-slate-100 border-slate-300' }
        ].map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.tab}
              type="button"
              onClick={() => nav(c.tab)}
              className={`p-2.5 rounded border text-left transition hover:shadow-sm cursor-pointer flex items-start justify-between ${c.color}`}
            >
              <div>
                <div className="font-bold text-xs flex items-center gap-1">
                  <Icon size={14} /> <span>{c.title}</span>
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">{c.sub}</div>
              </div>
              <ArrowRight size={13} className="mt-0.5 shrink-0 opacity-70" />
            </button>
          );
        })}
      </div>

      {/* Upcoming & Overdue EMIs Tracker */}
      <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between border-b pb-1.5">
          <h2 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <CalendarClock size={15} className="text-rose-600" />
            <span>थकीत व पुढील ३० दिवसांतील देय बाह्य कर्ज हप्ते (Upcoming &amp; Overdue EMI Tracker)</span>
          </h2>
          <button
            type="button"
            onClick={() => nav('borrowing-reports', { subTab: 'emis' })}
            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
          >
            संपूर्ण हप्ते कॅलेंडर पहा →
          </button>
        </div>

        {loading ? (
          <div className="py-6 text-center text-slate-500">लोड होत आहे...</div>
        ) : upcomingEmis.length === 0 ? (
          <div className="py-5 text-center text-emerald-700 font-semibold bg-emerald-50/40 rounded border border-emerald-200">
            ✓ सध्या कोणताही बाह्य कर्ज हप्ता थकीत नाही किंवा पुढील ३० दिवसांत देय नाही.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="border px-2 py-1.5 text-left">बाह्य कर्ज खाते</th>
                  <th className="border px-2 py-1.5 text-left">बँक / पतसंस्था</th>
                  <th className="border px-2 py-1.5 text-center">हप्ता क्र.</th>
                  <th className="border px-2 py-1.5 text-center">देय दिनांक (Due Date)</th>
                  <th className="border px-2 py-1.5 text-right">मुद्दल हप्ता</th>
                  <th className="border px-2 py-1.5 text-right">व्याज</th>
                  <th className="border px-2 py-1.5 text-right">एकूण देय EMI</th>
                  <th className="border px-2 py-1.5 text-center">स्थिती</th>
                  <th className="border px-2 py-1.5 text-center">कृती</th>
                </tr>
              </thead>
              <tbody>
                {upcomingEmis.slice(0, 10).map((emi) => (
                  <tr key={emi.scheduleID} className={emi.isOverdue ? 'bg-red-50/60' : 'hover:bg-slate-50'}>
                    <td className="border px-2 py-1 font-mono font-bold text-primary">{emi.borrowingNo}</td>
                    <td className="border px-2 py-1 font-semibold">
                      {emi.lenderName}
                      {emi.externalLoanAccountNo && <span className="text-[10px] text-slate-500 block">A/c: {emi.externalLoanAccountNo}</span>}
                    </td>
                    <td className="border px-2 py-1 text-center font-mono font-bold">#{emi.installmentNo}</td>
                    <td className="border px-2 py-1 text-center font-mono">{new Date(emi.dueDate).toLocaleDateString('en-GB')}</td>
                    <td className="border px-2 py-1 text-right font-mono">₹{fmtAmt(emi.principalDue)}</td>
                    <td className="border px-2 py-1 text-right font-mono">₹{fmtAmt(emi.interestDue)}</td>
                    <td className="border px-2 py-1 text-right font-mono font-extrabold text-rose-700">₹{fmtAmt(emi.totalDue)}</td>
                    <td className="border px-2 py-1 text-center">
                      {emi.isOverdue ? (
                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-300 font-bold text-[10px]">
                          🔴 {emi.overdueDays} दि. थकीत
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]">
                          ⏳ {emi.daysRemaining === 0 ? 'आज देय' : `${emi.daysRemaining} दिवसांत`}
                        </span>
                      )}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => nav('borrowing-repayment', { borrowingId: emi.borrowingID })}
                        className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                      >
                        💸 हप्ता भरा
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active & Sanctioned Borrowings Summary Table */}
      <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between border-b pb-1.5">
          <h2 className="font-bold text-xs text-slate-900">
            चालू व मंजूर बाह्य कर्ज खाती सारांश ({activeAndSanctioned.length})
          </h2>
          <button
            type="button"
            onClick={() => nav('borrowing-reports')}
            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
          >
            बंद व सर्व खाती पहा →
          </button>
        </div>

        {activeAndSanctioned.length === 0 ? (
          <div className="py-6 text-center text-slate-500">
            कोणतेही चालू बाह्य कर्ज खाते नाही. सुरू करण्यासाठी <strong>१. नवीन बाह्य कर्ज खाते</strong> वर क्लिक करा.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px]">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="border px-2 py-1.5 text-left">खाते क्र.</th>
                  <th className="border px-2 py-1.5 text-left">बँक / पतसंस्था</th>
                  <th className="border px-2 py-1.5 text-left">प्रकार</th>
                  <th className="border px-2 py-1.5 text-right">मंजूर मर्यादा</th>
                  <th className="border px-2 py-1.5 text-right">उचललेली रक्कम</th>
                  <th className="border px-2 py-1.5 text-right">देणे बाकी</th>
                  <th className="border px-2 py-1.5 text-center">हप्ते प्रगती</th>
                  <th className="border px-2 py-1.5 text-center">स्थिती</th>
                  <th className="border px-2 py-1.5 text-center">कृती</th>
                </tr>
              </thead>
              <tbody>
                {activeAndSanctioned.map((b) => (
                  <tr key={b.borrowingID} className="hover:bg-slate-50">
                    <td className="border px-2 py-1.5 font-mono font-bold text-primary">{b.borrowingNo}</td>
                    <td className="border px-2 py-1.5">
                      <div className="font-bold text-slate-900">{b.lenderName}</div>
                      {b.externalLoanAccountNo && <div className="text-[10px] text-slate-500">A/c: {b.externalLoanAccountNo}</div>}
                    </td>
                    <td className="border px-2 py-1.5 text-[10px] font-semibold">
                      {b.borrowingType === 'GOLD_REPLEDGE'
                        ? '🏅 सोने पुनर्गहाण'
                        : b.borrowingType === 'TERM_LOAN'
                        ? '🏦 मुदत कर्ज'
                        : b.borrowingType === 'CASH_CREDIT_OD'
                        ? '💳 CC / OD'
                        : '📜 ठेव तारण'}
                    </td>
                    <td className="border px-2 py-1.5 text-right font-mono">₹{fmtAmt(b.sanctionedAmount)}</td>
                    <td className="border px-2 py-1.5 text-right font-mono">₹{fmtAmt(b.disbursedAmount)}</td>
                    <td className="border px-2 py-1.5 text-right font-mono font-bold text-rose-700">₹{fmtAmt(b.outstandingPrincipal)}</td>
                    <td className="border px-2 py-1.5 text-center font-mono text-[10.5px]">
                      {b.totalScheduleCount > 0 ? `${b.paidInstallmentsCount} / ${b.totalScheduleCount} पूर्ण` : '-'}
                      {b.overdueEmiCount > 0 && (
                        <span className="block text-[9.5px] text-red-600 font-bold">({b.overdueEmiCount} थकीत!)</span>
                      )}
                    </td>
                    <td className="border px-2 py-1.5 text-center">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        b.status === 'Sanctioned'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {b.status === 'Sanctioned' ? 'मंजूर (उचल बाकी)' : 'सक्रिय (Active)'}
                      </span>
                    </td>
                    <td className="border px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {b.remainingSanctionLimit > 0 && (
                          <button
                            type="button"
                            onClick={() => nav('borrowing-disbursement', { borrowingId: b.borrowingID })}
                            className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] cursor-pointer"
                          >
                            उचल करा
                          </button>
                        )}
                        {b.status === 'Active' && (
                          <button
                            type="button"
                            onClick={() => nav('borrowing-repayment', { borrowingId: b.borrowingID })}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                          >
                            हप्ता भरा
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => nav('borrowing-reports', { borrowingId: b.borrowingID })}
                          className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] cursor-pointer"
                        >
                          खतावणी
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

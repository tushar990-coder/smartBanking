import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FileSpreadsheet, Download, Search, Printer, Plus, RefreshCw } from 'lucide-react';
import AddLoanRecoveryExpenseModal from './common/AddLoanRecoveryExpenseModal';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';

interface CaseReportItem {
  caseId: number;
  caseType?: string;
  caseNumber: string;
  loanAccountId: number;
  loanAccountNo: string;
  cifNo?: string;
  memberCode: string;
  customerName?: string;
  memberName: string;
  courtName: string;
  filingDate: string;
  totalClaimAmount: number;
  courtFeeAmount: number;
  totalLegalExpenses: number;
  status?: string;
  caseStatus: string;
  certificateNumber?: string;
  certificateDate?: string;
  awardNumber?: string;
  awardDate?: string;
  grantedAmount?: number;
}

interface ExpenseItem {
  legalExpenseId: number;
  caseId?: number | null;
  caseNumber?: string;
  caseType?: string;
  customerName?: string;
  memberName?: string;
  cifNo?: string;
  loanAccountId: number;
  loanAccountNo?: string;
  expenseType: string;
  expenseDate: string;
  amount: number;
  payeeName?: string;
  voucherNumber?: string;
  voucherStatus?: string;
  paymentMode?: string;
  isDebitedToBorrower: boolean;
  capitalizeToLoanPrincipal?: boolean;
  isPrincipalApplied?: boolean;
  remarks?: string;
}

interface Sec101LegalReportsProps {
  branchId?: number;
  effectiveBranch?: number | 'all' | null;
  embedded?: boolean;
  onDataChanged?: () => void;
  onNavigate?: (tab: string, params?: any) => void;
}

export default function Sec101LegalReports({
  branchId: propBranchId,
  effectiveBranch: propEffectiveBranch,
  embedded = false,
  onDataChanged,
  onNavigate,
}: Sec101LegalReportsProps = {}) {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const bizDateStr = getBusinessDateStr(user?.businessDate);

  const [selectedBranchId, setSelectedBranchId] = useState<number>(() => {
    if (propEffectiveBranch === 'all') return 0;
    if (propBranchId && propBranchId > 0) return propBranchId;
    const eff = getEffectiveBranchId(user, globalBranchId);
    return typeof eff === 'number' && eff > 0 ? eff : isHOUser ? 0 : user?.branchID || 1;
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [sanstha, setSanstha] = useState<any>(null);
  const [cases, setCases] = useState<CaseReportItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [activeReportTab, setActiveReportTab] = useState<'cases' | 'expenses'>('cases');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Add Expense Modal State
  const [showAddExpenseModal, setShowAddExpenseModal] = useState<boolean>(false);

  useEffect(() => {
    if (!isHOUser && lockedBranchId) {
      setSelectedBranchId(lockedBranchId);
    } else if (propEffectiveBranch === 'all') {
      setSelectedBranchId(0);
    } else if (propBranchId && propBranchId > 0) {
      setSelectedBranchId(propBranchId);
    }
  }, [isHOUser, lockedBranchId, propEffectiveBranch, propBranchId]);

  useEffect(() => {
    axios.get('/api/Branches').then((r) => Array.isArray(r.data) && setBranches(r.data)).catch(console.error);
    axios.get('/api/SansthaDetails').then((r) => {
      if (Array.isArray(r.data) && r.data.length > 0) setSanstha(r.data[0]);
      else if (r.data && !Array.isArray(r.data)) setSanstha(r.data);
    }).catch(console.error);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchQuery = selectedBranchId > 0 ? `?branchId=${selectedBranchId}` : '';
      const [casesRes, expRes] = await Promise.all([
        axios.get(`/api/LegalRecovery/cases${branchQuery}`),
        axios.get(`/api/LegalRecovery/expenses${branchQuery}`),
      ]);
      setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
      setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranchId]);

  const filteredCases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return cases.filter((c) => {
      const name = (c.customerName || c.memberName || '').toLowerCase();
      const cNo = (c.caseNumber || '').toLowerCase();
      const lNo = (c.loanAccountNo || '').toLowerCase();
      const cif = (c.cifNo || c.memberCode || '').toLowerCase();
      if (q && !name.includes(q) && !cNo.includes(q) && !lNo.includes(q) && !cif.includes(q)) return false;
      if (caseTypeFilter !== 'ALL' && (c.caseType || 'SEC_101') !== caseTypeFilter) return false;
      const st = (c.status || c.caseStatus || '').toUpperCase();
      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (fromDate && (c.filingDate || '') < fromDate) return false;
      if (toDate && (c.filingDate || '') > toDate) return false;
      return true;
    });
  }, [cases, searchTerm, caseTypeFilter, statusFilter, fromDate, toDate]);

  const filteredExpenses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return expenses.filter((e) => {
      const name = (e.customerName || e.memberName || '').toLowerCase();
      const cNo = (e.caseNumber || '').toLowerCase();
      const lNo = (e.loanAccountNo || '').toLowerCase();
      const cif = (e.cifNo || '').toLowerCase();
      const payee = (e.payeeName || '').toLowerCase();
      const vNo = (e.voucherNumber || '').toLowerCase();
      if (q && !name.includes(q) && !cNo.includes(q) && !lNo.includes(q) && !cif.includes(q) && !payee.includes(q) && !vNo.includes(q)) return false;
      if (caseTypeFilter !== 'ALL' && e.caseId && (e.caseType || 'SEC_101') !== caseTypeFilter) return false;
      if (fromDate && (e.expenseDate || '') < fromDate) return false;
      if (toDate && (e.expenseDate || '') > toDate) return false;
      return true;
    });
  }, [expenses, searchTerm, caseTypeFilter, fromDate, toDate]);

  const caseTotals = useMemo(
    () =>
      filteredCases.reduce(
        (acc, c) => ({
          claim: acc.claim + Number(c.totalClaimAmount || 0),
          courtFee: acc.courtFee + Number(c.courtFeeAmount || 0),
          expenses: acc.expenses + Number(c.totalLegalExpenses || 0),
        }),
        { claim: 0, courtFee: 0, expenses: 0 }
      ),
    [filteredCases]
  );

  const expenseTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let rows: string[] = [];
    if (activeReportTab === 'cases') {
      rows.push(['Case No', 'Case Type', 'Filing Date', 'CIF No', 'Customer Name', 'Loan A/c', 'Court', 'Total Claim', 'Court Fee', 'Legal Expenses', 'Status', 'Certificate/Award'].map(esc).join(','));
      filteredCases.forEach((c) => {
        rows.push(
          [
            c.caseNumber,
            c.caseType === 'SEC_91' ? 'Sec 91' : 'Sec 101',
            c.filingDate,
            c.cifNo || c.memberCode,
            c.customerName || c.memberName,
            c.loanAccountNo,
            c.courtName,
            c.totalClaimAmount,
            c.courtFeeAmount,
            c.totalLegalExpenses,
            c.status || c.caseStatus,
            c.certificateNumber || c.awardNumber || '-',
          ]
            .map(esc)
            .join(',')
        );
      });
    } else {
      rows.push(['Date', 'Voucher No', 'Voucher Status', 'CIF No', 'Customer Name', 'Loan A/c', 'Case No', 'Expense Type', 'Payee', 'Amount', 'Mode', 'Debited To Borrower'].map(esc).join(','));
      filteredExpenses.forEach((e) => {
        rows.push(
          [
            e.expenseDate,
            e.voucherNumber || '-',
            e.voucherStatus || '-',
            e.cifNo || '-',
            e.customerName || e.memberName || '-',
            e.loanAccountNo || '-',
            e.caseNumber || '-',
            e.expenseType,
            e.payeeName || '-',
            e.amount,
            e.paymentMode || '-',
            e.isDebitedToBorrower ? 'Yes' : 'No',
          ]
            .map(esc)
            .join(',')
        );
      });
    }

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Sec101_${activeReportTab}_${bizDateStr}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className={embedded ? 'max-w-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5' : 'p-2.5 max-w-full h-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5'}>
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } }`}</style>

      {/* Print-Only Header */}
      <div className="hidden print:block text-center border-b-2 border-slate-900 pb-2 mb-2">
        <div className="text-base font-black text-slate-900">{sanstha?.sansthaNameMarathi || sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</div>
        <div className="text-xs text-slate-700">{sanstha?.address || ''}</div>
        <div className="text-sm font-bold mt-1">
          {activeReportTab === 'cases' ? 'कलम १०१ / ९१ केस नोंदवही (Case Register)' : 'कायदेशीर खर्च खतावणी (Legal Expenses Register)'}
        </div>
      </div>

      {/* Screen Header (Standalone CBS Header vs Embedded Filter Strip Action) */}
      {!embedded && (
        <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 print:hidden">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-sm font-bold text-primary tracking-wide">कायदेशीर वसुली अहवाल व खर्च खतावणी (Sec 101 / 91 Reports)</h1>
            </div>
            <p className="text-slate-500 text-[10.5px] mt-0.5">
              कलम १०१ व ९१ केस नोंदवही, खर्च खतावणी, व्हाउचर पासिंग स्थिती व एक्सेल/CSV एक्सपोर्ट.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('loan-bulk-charges')}
                className="bg-rose-700 hover:bg-rose-800 text-white px-3 py-1.5 rounded-sm text-xs font-bold shadow-xs flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> बल्क वसुली खर्च नावे
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddExpenseModal(true)}
              className="bg-primary hover:opacity-95 text-white px-3 py-1.5 rounded-sm text-xs font-bold shadow-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> वसूली / पोसटेज / कायदेशीर खर्च नोंदवा
            </button>
          </div>
        </div>
      )}

      {/* Filters & Controls */}
      <div className="bg-white p-3 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs space-y-2.5 print:hidden">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-gray-700">शाखा:</label>
            <select
              value={selectedBranchId}
              disabled={!isHOUser}
              onChange={(e) => setSelectedBranchId(Number(e.target.value))}
              className="border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-semibold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-slate-100"
            >
              {isHOUser && <option value={0}>सर्व शाखा (All Branches)</option>}
              {(isHOUser || !lockedBranchId ? branches : branches.filter((b) => Number(b.branchID) === Number(lockedBranchId))).map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>

            <div className="flex bg-slate-100 p-0.5 rounded-sm border border-gray-200">
              <button
                type="button"
                onClick={() => setActiveReportTab('cases')}
                className={`px-3 py-1 rounded-sm text-xs font-bold transition ${
                  activeReportTab === 'cases' ? 'bg-primary text-white shadow-xs' : 'text-gray-700 hover:text-primary'
                }`}
              >
                १. केस नोंदवही ({filteredCases.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveReportTab('expenses')}
                className={`px-3 py-1 rounded-sm text-xs font-bold transition ${
                  activeReportTab === 'expenses' ? 'bg-primary text-white shadow-xs' : 'text-gray-700 hover:text-primary'
                }`}
              >
                २. खर्च खतावणी ({filteredExpenses.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {embedded && (
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(true)}
                className="bg-primary hover:opacity-95 text-white px-2.5 py-1 rounded-sm text-xs font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> वसूली / पोसटेज / कायदेशीर खर्च
              </button>
            )}
            <button type="button" onClick={fetchData} className="p-1.5 bg-white hover:bg-primary/10 hover:text-primary rounded-sm border border-gray-300 text-gray-700 transition" title="रिफ्रेश">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={exportCsv} className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded-sm text-xs font-bold flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Excel / CSV
            </button>
            <button type="button" onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-1 rounded-sm text-xs font-bold flex items-center gap-1">
              <Printer className="w-3.5 h-3.5" /> प्रिंट
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-gray-100">
          <div className="relative">
            <input
              type="text"
              placeholder="CIF / नाव / केस क्र. / खाते क्र. / व्हाउचर..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md pl-7 pr-2 py-1 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
          </div>
          <select value={caseTypeFilter} onChange={(e) => setCaseTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white font-semibold">
            <option value="ALL">सर्व कलमे (१०१ व ९१)</option>
            <option value="SEC_101">कलम १०१ (वसुली दाखला)</option>
            <option value="SEC_91">कलम ९१ (सहकारी न्यायालय)</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1 text-xs bg-white font-semibold">
            <option value="ALL">सर्व केस स्थिती</option>
            <option value="FILED">दाखल (FILED)</option>
            <option value="HEARING">सुनावणी (HEARING)</option>
            <option value="CERTIFIED">दाखला मंजूर (CERTIFIED)</option>
            <option value="AWARDED">निवाडा मंजूर (AWARDED)</option>
            <option value="EXECUTION_RULE107">नियम १०७ जप्ती (EXECUTION_RULE107)</option>
            <option value="EXECUTION">जप्ती (EXECUTION)</option>
            <option value="STAYED">स्थगिती (STAYED)</option>
            <option value="CLOSED_RECOVERED">वसूल / बंद</option>
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="या तारखेपासून" className="border border-gray-300 rounded-md px-2 py-1 text-xs" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} title="या तारखेपर्यंत" className="border border-gray-300 rounded-md px-2 py-1 text-xs" />
        </div>
      </div>

      {activeReportTab === 'cases' ? (
        <div className="bg-white rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead className="bg-slate-100 text-[11px] font-bold text-gray-700 uppercase border-b">
                <tr>
                  <th className="p-2.5">दावा क्र. व कलम</th>
                  <th className="p-2.5">कर्जदार व खाते (CIF)</th>
                  <th className="p-2.5">न्यायालय</th>
                  <th className="p-2.5 text-right">दावा रक्कम</th>
                  <th className="p-2.5 text-right">कोर्ट फी</th>
                  <th className="p-2.5 text-right">कायदेशीर खर्च</th>
                  <th className="p-2.5">केस स्थिती</th>
                  <th className="p-2.5">दाखला / निवाडा तपशील</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-gray-400">
                      कोणत्याही केसेस आढळल्या नाहीत.
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((c) => {
                    const st = c.status || c.caseStatus;
                    return (
                      <tr key={c.caseId} className="hover:bg-primary/5 transition">
                        <td className="p-2.5">
                          <div className="font-bold text-gray-900">{c.caseNumber}</div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {c.filingDate} • {c.caseType === 'SEC_91' ? 'कलम ९१' : 'कलम १०१'}
                          </div>
                        </td>
                        <td className="p-2.5">
                          <div className="font-bold text-gray-900">{c.customerName || c.memberName}</div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            खाते: {c.loanAccountNo} | CIF: {c.cifNo || c.memberCode || '-'}
                          </div>
                        </td>
                        <td className="p-2.5 text-[10px] text-gray-600 max-w-[160px] truncate">{c.courtName}</td>
                        <td className="p-2.5 font-bold text-gray-900 text-right">₹{Number(c.totalClaimAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 font-bold text-rose-700 text-right">₹{Number(c.courtFeeAmount || 0).toLocaleString('en-IN')}</td>
                        <td className="p-2.5 font-bold text-amber-700 text-right">₹{Number(c.totalLegalExpenses || 0).toLocaleString('en-IN')}</td>
                        <td className="p-2.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20">{st}</span>
                        </td>
                        <td className="p-2.5 text-[10px]">
                          {c.certificateNumber || c.awardNumber ? (
                            <div>
                              <div className="font-bold text-emerald-800">{c.certificateNumber || c.awardNumber}</div>
                              <div className="text-gray-500">
                                {c.certificateDate || c.awardDate} | ₹{Number(c.grantedAmount || 0).toLocaleString('en-IN')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">प्रलंबित</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredCases.length > 0 && (
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="p-2.5 text-right">एकूण बेरीज ({filteredCases.length} केसेस):</td>
                    <td className="p-2.5 text-right">₹{caseTotals.claim.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right text-rose-800">₹{caseTotals.courtFee.toLocaleString('en-IN')}</td>
                    <td className="p-2.5 text-right text-amber-800">₹{caseTotals.expenses.toLocaleString('en-IN')}</td>
                    <td colSpan={2} className="p-2.5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead className="bg-slate-100 text-[11px] font-bold text-gray-700 uppercase border-b">
                <tr>
                  <th className="p-2.5">तारीख व व्हाउचर क्र.</th>
                  <th className="p-2.5">कर्जदार, CIF व केस क्र.</th>
                  <th className="p-2.5">खर्च प्रकार</th>
                  <th className="p-2.5">देय व्यक्ती / तपशील</th>
                  <th className="p-2.5 text-right">रक्कम (₹)</th>
                  <th className="p-2.5">पद्धत</th>
                  <th className="p-2.5">खाते नावे / स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400">
                      कोणत्याही खर्च नोंदी आढळल्या नाहीत.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((e) => (
                    <tr key={e.legalExpenseId} className="hover:bg-primary/5 transition">
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900">{e.expenseDate}</div>
                        <div className="text-[10px] font-mono text-gray-600">{e.voucherNumber || 'थेट नोंद'}</div>
                      </td>
                      <td className="p-2.5">
                        <div className="font-bold text-gray-900">{e.customerName || e.memberName || '-'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          CIF: {e.cifNo || '-'} | खाते: {e.loanAccountNo || '-'}
                          {e.caseNumber ? ` | केस: ${e.caseNumber}` : ' | (थेट कर्ज / नोटीस खर्च)'}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-sm">{e.expenseType}</span>
                      </td>
                      <td className="p-2.5 font-medium">{e.payeeName || '-'}</td>
                      <td className="p-2.5 font-bold text-rose-700 text-right">₹{Number(e.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2.5 text-[10px]">{e.paymentMode || '-'}</td>
                      <td className="p-2.5">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-sm ${e.capitalizeToLoanPrincipal ? 'bg-amber-100 text-[#5A1A14]' : (e.isDebitedToBorrower ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700')}`}>
                            {e.capitalizeToLoanPrincipal
                              ? (e.isPrincipalApplied ? 'कर्ज मुद्दल नावे (लागू)' : 'कर्ज मुद्दल नावे (प्रलंबित)')
                              : (e.isDebitedToBorrower ? 'कर्जदार नावे (येणे खर्च)' : 'संस्था खर्च')}
                          </span>
                          {e.voucherStatus && e.voucherStatus !== 'None' && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-sm ${e.voucherStatus === 'Approved' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-900'}`}>
                              Voucher: {e.voucherStatus}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredExpenses.length > 0 && (
                <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={4} className="p-2.5 text-right">एकूण कायदेशीर खर्च ({filteredExpenses.length} नोंदी):</td>
                    <td className="p-2.5 text-right text-rose-800">₹{expenseTotal.toLocaleString('en-IN')}</td>
                    <td colSpan={2} className="p-2.5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Shared Add Loan Recovery & Legal Expense Modal (works with or without Sec 101 Case) */}
      <AddLoanRecoveryExpenseModal
        isOpen={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        branchId={selectedBranchId > 0 ? selectedBranchId : user?.branchID || 1}
        onSuccess={async () => {
          await fetchData();
          if (onDataChanged) onDataChanged();
        }}
      />
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';
import { useAuth } from '../context/AuthContext';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  BookOpen
} from 'lucide-react';

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function GeneralLedger() {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(user?.businessDate || '');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const ledgerOptions = useMemo(() => [
    { value: '', label: '-- खाते निवडा (Select Ledger) --' },
    ...ledgers.map(l => {
      const legacyPart = l.legacyLedgerId ? ` [जुना क्र: ${l.legacyLedgerId}]` : '';
      const engPart = l.ledgerNameEnglish ? ` (${l.ledgerNameEnglish})` : '';
      const groupPart = l.accountGroup?.groupName ? ` - ${l.accountGroup.groupName}` : '';
      return {
        value: l.ledgerID.toString(),
        label: `${l.ledgerID} - ${l.ledgerName}${engPart}${legacyPart}${groupPart}`
      };
    })
  ], [ledgers]);

  useEffect(() => {
    fetchInitData();
    fetchSansthaDetails();
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const response = await axios.get('/api/SansthaDetails');
      if (response.data) {
        if (Array.isArray(response.data) && response.data.length > 0) {
          setSansthaDetail(response.data[0]);
        } else if (!Array.isArray(response.data)) {
          setSansthaDetail(response.data);
        }
      }
    } catch (error) {
      console.error('Error fetching sanstha details', error);
    }
  };

  const fetchInitData = async () => {
    try {
      const [ledgersRes, branchesRes, fyRes] = await Promise.all([
        axios.get('/api/Ledgers'),
        axios.get('/api/Branches'),
        axios.get('/api/FinancialYears')
      ]);

      setLedgers(ledgersRes.data || []);
      setBranches(branchesRes.data || []);

      const fyList = fyRes.data || [];
      const activeFy = fyList.find((f: any) => f.isActive);
      if (activeFy && activeFy.startDate) {
        setFromDate(activeFy.startDate.split('T')[0]);
      } else {
        const today = new Date();
        let startYear = today.getFullYear();
        if (today.getMonth() < 3) startYear -= 1;
        setFromDate(`${startYear}-04-01`);
      }

      if (!toDate) {
        setToDate(new Date().toISOString().split('T')[0]);
      }
    } catch (error) {
      console.error('Error fetching initial data', error);
    }
  };

  const fetchReport = async () => {
    if (!selectedLedgerId) {
      alert('कृपया खाते (Ledger) निवडा.');
      return;
    }
    setLoading(true);
    try {
      let url = `/api/Reports/GeneralLedger?ledgerId=${selectedLedgerId}`;
      if (fromDate) url += `&fromDate=${fromDate}`;
      if (toDate) url += `&toDate=${toDate}`;
      if (selectedBranchId !== 'all') url += `&branchId=${selectedBranchId}`;

      const res = await axios.get(url);
      setReportData(res.data);
    } catch (error) {
      console.error('Error fetching general ledger', error);
      alert('जनरल लेजर डेटा लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const selectedLedgerName = ledgers.find(l => l.ledgerID.toString() === selectedLedgerId)?.ledgerName || '';

  const handleExportExcel = () => {
    if (!reportData || !reportData.transactions || reportData.transactions.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी माहिती नाही.');
      return;
    }

    const excelData: any[] = [];
    excelData.push({
      'तारीख': formatDisplayDate(fromDate),
      'तपशील': 'आरंभीची शिल्लक (Opening Balance)',
      'पावती / व्हाउचर क्र.': '-',
      'नावे रक्कम (Debit ₹)': 0,
      'जमा रक्कम (Credit ₹)': 0,
      'शिल्लक (Balance ₹)': `${fmtCurrency(reportData.openingBalance)} ${reportData.openingType}`
    });

    reportData.transactions.forEach((tx: any) => {
      excelData.push({
        'तारीख': formatDisplayDate(tx.date),
        'तपशील': tx.narration,
        'पावती / व्हाउचर क्र.': tx.voucherNo || '-',
        'नावे रक्कम (Debit ₹)': tx.debit || 0,
        'जमा रक्कम (Credit ₹)': tx.credit || 0,
        'शिल्लक (Balance ₹)': `${fmtCurrency(tx.balance)} ${tx.balanceType}`
      });
    });

    excelData.push({
      'तारीख': formatDisplayDate(toDate),
      'तपशील': 'एकूण व्यवहार / अखेर शिल्लक',
      'पावती / व्हाउचर क्र.': '',
      'नावे रक्कम (Debit ₹)': reportData.totalDebit || 0,
      'जमा रक्कम (Credit ₹)': reportData.totalCredit || 0,
      'शिल्लक (Balance ₹)': `${fmtCurrency(reportData.closingBalance)} ${reportData.closingType}`
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'General Ledger');
    XLSX.writeFile(workbook, `General_Ledger_${selectedLedgerName || 'Report'}.xlsx`);
  };

  const getBranchName = () => {
    if (selectedBranchId === 'all') return 'सर्व शाखा';
    const b = branches.find((item: any) => item.branchID?.toString() === selectedBranchId);
    return b ? b.branchName : 'मुख्य शाखा';
  };

  // Filter toolbar controls
  const filterControls = (
    <>
      {/* Branch */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
        <select
          value={selectedBranchId}
          disabled={hasGlobalBranch}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28 sm:w-32"
        >
          <option value="all">सर्व शाखा (All)</option>
          {branches.map((b: any) => (
            <option key={b.branchID} value={b.branchID.toString()}>
              {b.branchName}
            </option>
          ))}
        </select>
      </div>

      {/* Ledger Searchable Select */}
      <div className="w-56 sm:w-72">
        <SearchableSelect
          name="selectedLedgerId"
          options={ledgerOptions}
          value={selectedLedgerId}
          onChange={(val) => setSelectedLedgerId(val)}
          placeholder="-- खाते निवडा / शोधा --"
        />
      </div>

      {/* From Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
        />
      </div>

      {/* To Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
        />
      </div>

      {/* View Button */}
      <button
        onClick={fetchReport}
        disabled={loading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-xs text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        <span>पहा</span>
      </button>
    </>
  );

  return (
    <CbsReportLayout
      defaultPaperSize="a4-landscape"
      allowPaperSizeToggle={true}
      reportTitle={`सामान्य खतावणी (General Ledger): ${selectedLedgerName || 'खाते'}`}
      reportSubtitle="General Ledger Statement"
      periodText={`${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`}
      branchName={getBranchName()}
      sansthaInfo={sansthaDetail}
      signatureTier="3-tier"
      signatureTitles={[
        { title: 'लिपिक / खतावणी लेखक', subtitle: '(Clerk / Ledger Writer)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' }
      ]}
      onExportExcel={handleExportExcel}
      extraToolbarControls={filterControls}
      isLoading={loading}
      hasData={Boolean(reportData)}
      emptyState={
        <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
          <BookOpen size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">कृपया लेजर व कालावधी निवडून "पहा" बटणावर क्लिक करा.</p>
        </div>
      }
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">तारीख</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">पावती / व्हाउचर क्र.</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[40%] text-left">तपशील (Narration)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">नावे रक्कम (Dr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">जमा रक्कम (Cr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right font-extrabold">शिल्लक रक्कम (₹)</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening Balance */}
          <tr className="bg-amber-50/60 font-bold text-slate-900 text-[11px]">
            <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(fromDate)}</td>
            <td className="border border-slate-900 py-1 px-2 text-center font-mono">-</td>
            <td className="border border-slate-900 py-1 px-3 italic text-primary">
              आरंभीची शिल्लक (Opening Balance)
            </td>
            <td className="border border-slate-900 py-1 px-2 text-right font-mono">-</td>
            <td className="border border-slate-900 py-1 px-2 text-right font-mono">-</td>
            <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-bold text-indigo-950">
              {fmtCurrency(reportData.openingBalance)} {reportData.openingType}
            </td>
          </tr>

          {reportData.transactions.map((t: any, idx: number) => (
            <tr key={idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
              <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(t.date)}</td>
              <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold">{t.voucherNo || '-'}</td>
              <td className="border border-slate-900 py-1 px-3 text-left">{t.narration}</td>
              <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-dr">
                {t.debit > 0 ? fmtCurrency(t.debit) : '-'}
              </td>
              <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-cr font-bold">
                {t.credit > 0 ? fmtCurrency(t.credit) : '-'}
              </td>
              <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-bold">
                {fmtCurrency(t.balance)} {t.balanceType}
              </td>
            </tr>
          ))}

          {reportData.transactions.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-slate-500 font-semibold border border-slate-900">
                या कालावधीत कोणतेही व्यवहार आढळले नाहीत.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
            <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
              एकूण व्यवहार / अखेर शिल्लक:
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-dr font-bold">
              ₹ {fmtCurrency(reportData.totalDebit)}
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-cr font-bold">
              ₹ {fmtCurrency(reportData.totalCredit)}
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-bal font-black text-primary bg-primary/10">
              ₹ {fmtCurrency(reportData.closingBalance)} {reportData.closingType}
            </td>
          </tr>
        </tfoot>
      </table>
    </CbsReportLayout>
  );
}

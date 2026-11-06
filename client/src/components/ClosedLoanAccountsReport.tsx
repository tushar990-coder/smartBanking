import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { RefreshCw, Search, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import CbsReportLayout, { formatDisplayDate, CbsPaperSize } from './common/CbsReportLayout';

interface SansthaHeaderInfo {
  sansthaID?: number;
  sansthaName?: string;
  address?: string;
  village?: string;
  taluka?: string;
  district?: string;
  pinCode?: string;
  registrationNo?: string;
  registrationDate?: string;
}

interface LoanRateOption {
  loanRateID: number;
  loanType: string;
  shortName?: string;
}

interface BranchOption {
  branchID: number;
  branchName: string;
}

interface ClosedLoanReportRow {
  srNo: number;
  loanAccountID: number;
  loanRateID: number;
  loanType: string;
  loanAccountNo: string;
  legacyAccountNumber?: string;
  cifNo: string;
  memberCode: string;
  borrowerName: string;
  mobileNo: string;
  disbursementDate: string;
  disbursementDateDisplay: string;
  closedDate: string;
  closedDateDisplay: string;
  tenureMonths: number;
  interestRate: number;
  sanctionedAmount: number;
  principalPaid: number;
  interestPaid: number;
  penaltyInterestPaid: number;
  waivedAmount: number;
  totalCollected: number;
  lastReceiptNo: string;
  lastPaymentMode: string;
  closureType: string;
  isOTS: boolean;
  status: string;
}

interface ClosedLoanSchemeGroup {
  loanRateID: number;
  loanType: string;
  accountCount: number;
  totalSanctionedAmount: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalPenaltyInterestPaid: number;
  totalWaivedAmount: number;
  totalCollected: number;
  accounts: ClosedLoanReportRow[];
}

interface ClosedLoanReportResponse {
  sansthaInfo: SansthaHeaderInfo | null;
  allDates: boolean;
  fromDate?: string;
  fromDateDisplay: string;
  toDate?: string;
  toDateDisplay: string;
  selectedLoanRateId?: number;
  selectedLoanTypeName: string;
  closureTypeFilter: string;
  totalClosedAccounts: number;
  normalClosedCount: number;
  otsClosedCount: number;
  grandTotalSanctionedAmount: number;
  grandTotalPrincipalPaid: number;
  grandTotalInterestPaid: number;
  grandTotalPenaltyInterestPaid: number;
  grandTotalWaivedAmount: number;
  grandTotalCollected: number;
  rows: ClosedLoanReportRow[];
  schemeGroups: ClosedLoanSchemeGroup[];
}

// Convert English digits to Marathi Devnagari digits
const toMarathiDigits = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const map: Record<string, string> = {
    '0': '०',
    '1': '१',
    '2': '२',
    '3': '३',
    '4': '४',
    '5': '५',
    '6': '६',
    '7': '७',
    '8': '८',
    '9': '९',
  };
  return String(val).replace(/[0-9]/g, d => map[d] || d);
};

// Format currency in Indian Locale with optional Marathi digits
const fmtCurrency = (val: number | undefined | null, useMarathiDigits: boolean): string => {
  const num = Number(val || 0);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return useMarathiDigits ? toMarathiDigits(formatted) : formatted;
};

export default function ClosedLoanAccountsReport() {
  const todayStr = localStorage.getItem('businessDate') || new Date().toISOString().split('T')[0];
  const defaultFromDate = (() => {
    const d = new Date(todayStr);
    const fyStartYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return `${fyStartYear}-04-01`;
  })();

  // Filter States
  const [allDates, setAllDates] = useState<boolean>(true);
  const [fromDate, setFromDate] = useState<string>(defaultFromDate);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [selectedLoanRateId, setSelectedLoanRateId] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const active = localStorage.getItem('selectedBranchId');
    return active && active !== 'all' ? String(active) : 'all';
  });
  const [closureType, setClosureType] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'grouped' | 'flat'>('grouped');
  const [digitMode, setDigitMode] = useState<'marathi' | 'english'>('marathi');
  const [paperSize] = useState<CbsPaperSize>('a4-landscape');

  // Master Data States
  const [loanRates, setLoanRates] = useState<LoanRateOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [sansthaInfo, setSansthaInfo] = useState<SansthaHeaderInfo | null>(null);

  // Report Data States
  const [reportData, setReportData] = useState<ClosedLoanReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const fetchMasters = async () => {
      try {
        const [ratesRes, branchRes, sansthaRes] = await Promise.allSettled([
          axios.get('/api/LoanRates'),
          axios.get('/api/Branches'),
          axios.get('/api/SansthaDetails'),
        ]);
        if (!isMountedRef.current) return;

        if (ratesRes.status === 'fulfilled') {
          const parsedRates = typeof ratesRes.value.data === 'string' ? JSON.parse(ratesRes.value.data) : ratesRes.value.data;
          if (Array.isArray(parsedRates)) setLoanRates(parsedRates);
        }
        if (branchRes.status === 'fulfilled') {
          const parsedBranches = typeof branchRes.value.data === 'string' ? JSON.parse(branchRes.value.data) : branchRes.value.data;
          if (Array.isArray(parsedBranches)) setBranches(parsedBranches);
        }
        if (sansthaRes.status === 'fulfilled') {
          const parsedSanstha = typeof sansthaRes.value.data === 'string' ? JSON.parse(sansthaRes.value.data) : sansthaRes.value.data;
          if (Array.isArray(parsedSanstha) && parsedSanstha.length > 0) {
            setSansthaInfo(parsedSanstha[0]);
          } else if (parsedSanstha && !Array.isArray(parsedSanstha)) {
            setSansthaInfo(parsedSanstha);
          }
        }
      } catch (err) {
        console.error('Error loading master data for Closed Loan Report:', err);
      }
    };
    fetchMasters();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        allDates,
        closureType,
      };
      if (!allDates) {
        if (fromDate) params.fromDate = fromDate;
        if (toDate) params.toDate = toDate;
      }
      if (selectedLoanRateId !== 'all') {
        params.loanRateId = Number(selectedLoanRateId);
      }
      if (selectedBranchId !== 'all') {
        params.branchId = Number(selectedBranchId);
      }

      const res = await axios.get<ClosedLoanReportResponse>('/api/Reports/ClosedLoanReport', { params });
      if (isMountedRef.current && res.data) {
        setReportData(res.data);
        if (res.data.sansthaInfo) {
          setSansthaInfo(res.data.sansthaInfo);
        }
      }
    } catch (err: any) {
      console.error('Error fetching Closed Loan Report:', err);
      if (isMountedRef.current) {
        setError(err.response?.data?.message || 'बंद कर्ज खाते अहवाल लोड करताना त्रुटी आली.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const matchesSearch = (r: ClosedLoanReportRow): boolean => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (r.loanAccountNo || '').toLowerCase().includes(term) ||
      (r.legacyAccountNumber || '').toLowerCase().includes(term) ||
      (r.borrowerName || '').toLowerCase().includes(term) ||
      (r.loanType || '').toLowerCase().includes(term) ||
      (r.memberCode || '').toLowerCase().includes(term) ||
      (r.cifNo || '').toLowerCase().includes(term) ||
      (r.lastReceiptNo || '').toLowerCase().includes(term) ||
      (r.mobileNo || '').toLowerCase().includes(term)
    );
  };

  const allRows = reportData?.rows || [];
  const filteredRows = allRows.filter(matchesSearch);

  const filteredGroups: ClosedLoanSchemeGroup[] = [];
  if (reportData?.schemeGroups) {
    reportData.schemeGroups.forEach(grp => {
      const matchedAccounts = grp.accounts.filter(matchesSearch);
      if (matchedAccounts.length > 0) {
        filteredGroups.push({
          ...grp,
          accountCount: matchedAccounts.length,
          totalSanctionedAmount: matchedAccounts.reduce((s, a) => s + (a.sanctionedAmount || 0), 0),
          totalPrincipalPaid: matchedAccounts.reduce((s, a) => s + (a.principalPaid || 0), 0),
          totalInterestPaid: matchedAccounts.reduce((s, a) => s + (a.interestPaid || 0), 0),
          totalPenaltyInterestPaid: matchedAccounts.reduce((s, a) => s + (a.penaltyInterestPaid || 0), 0),
          totalWaivedAmount: matchedAccounts.reduce((s, a) => s + (a.waivedAmount || 0), 0),
          totalCollected: matchedAccounts.reduce((s, a) => s + (a.totalCollected || 0), 0),
          accounts: matchedAccounts,
        });
      }
    });
  }

  // Grand Totals for currently filtered rows
  const totalFilteredSanctioned = filteredRows.reduce((s, r) => s + (r.sanctionedAmount || 0), 0);
  const totalFilteredPrincipalPaid = filteredRows.reduce((s, r) => s + (r.principalPaid || 0), 0);
  const totalFilteredInterestPaid = filteredRows.reduce((s, r) => s + (r.interestPaid || 0), 0);
  const totalFilteredPenaltyPaid = filteredRows.reduce((s, r) => s + (r.penaltyInterestPaid || 0), 0);
  const totalFilteredWaived = filteredRows.reduce((s, r) => s + (r.waivedAmount || 0), 0);
  const totalFilteredCollected = filteredRows.reduce((s, r) => s + (r.totalCollected || 0), 0);
  const normalClosedFilteredCount = filteredRows.filter(r => !r.isOTS).length;
  const otsClosedFilteredCount = filteredRows.filter(r => r.isOTS).length;

  const currentSchemeName =
    selectedLoanRateId === 'all'
      ? 'सर्व कर्ज प्रकार (एकत्रित)'
      : loanRates.find(lr => String(lr.loanRateID) === String(selectedLoanRateId))?.shortName ||
        loanRates.find(lr => String(lr.loanRateID) === String(selectedLoanRateId))?.loanType ||
        'कर्ज प्रकार';

  const isMarathiDigits = digitMode === 'marathi';

  const handleExportExcel = () => {
    if (!filteredRows || filteredRows.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी कोणताही डेटा उपलब्ध नाही.');
      return;
    }

    const rowsForExport: any[] = filteredRows.map((r, idx) => ({
      'अनु.क्र.': idx + 1,
      'कर्ज प्रकार': r.loanType,
      'कर्ज खाते नं.': r.legacyAccountNumber ? `${r.loanAccountNo} (जुना: ${r.legacyAccountNumber})` : r.loanAccountNo,
      'सभासद / CIF क्र.': r.memberCode || r.cifNo || '-',
      'कर्जदाराचे नाव': r.borrowerName,
      'मोबाईल क्र.': r.mobileNo || '-',
      'वाटप दिनांक': r.disbursementDateDisplay || formatDisplayDate(r.disbursementDate),
      'बंद दिनांक': r.closedDateDisplay || formatDisplayDate(r.closedDate),
      'व्याजदर (%)': r.interestRate,
      'मंजूर रक्कम (₹)': r.sanctionedAmount,
      'मुद्दल वसूल (₹)': r.principalPaid,
      'व्याज वसूल (₹)': r.interestPaid,
      'दंड व्याज वसूल (₹)': r.penaltyInterestPaid,
      'सूट / OTS माफ (₹)': r.waivedAmount,
      'एकूण वसूल (₹)': r.totalCollected,
      'शेवटची पावती क्र.': r.lastReceiptNo || '-',
      'बंद प्रकार': r.closureType,
    }));

    rowsForExport.push({
      'अनु.क्र.': 'एकूण',
      'कर्ज प्रकार': `एकूण बंद खाती: ${filteredRows.length}`,
      'कर्ज खाते नं.': '',
      'सभासद / CIF क्र.': '',
      'कर्जदाराचे नाव': `नियमित: ${normalClosedFilteredCount} | OTS: ${otsClosedFilteredCount}`,
      'मोबाईल क्र.': '',
      'वाटप दिनांक': '',
      'बंद दिनांक': '',
      'व्याजदर (%)': '',
      'मंजूर रक्कम (₹)': totalFilteredSanctioned,
      'मुद्दल वसूल (₹)': totalFilteredPrincipalPaid,
      'व्याज वसूल (₹)': totalFilteredInterestPaid,
      'दंड व्याज वसूल (₹)': totalFilteredPenaltyPaid,
      'सूट / OTS माफ (₹)': totalFilteredWaived,
      'एकूण वसूल (₹)': totalFilteredCollected,
      'शेवटची पावती क्र.': '',
      'बंद प्रकार': '',
    });

    const worksheet = XLSX.utils.json_to_sheet(rowsForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'बंद कर्ज खाती');
    XLSX.writeFile(workbook, `Closed_Loan_Accounts_Report_${todayStr}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const filterToolbarControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* All Dates Toggle */}
      <label className="inline-flex items-center text-[10.5px] text-slate-700 font-semibold cursor-pointer bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
        <input
          type="checkbox"
          checked={allDates}
          onChange={e => setAllDates(e.target.checked)}
          className="rounded border-slate-300 text-primary w-3 h-3 mr-1"
        />
        सर्व तारखा
      </label>

      {/* Date Range Pickers (Enabled when !allDates) */}
      {!allDates && (
        <>
          <div className="flex items-center gap-1">
            <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">पासून:</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="h-6 border border-slate-300 rounded px-1.5 text-[10.5px] font-mono bg-white focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">पर्यंत:</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="h-6 border border-slate-300 rounded px-1.5 text-[10.5px] font-mono bg-white focus:outline-none focus:border-primary"
            />
          </div>
        </>
      )}

      {/* Loan Scheme Selector */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">कर्ज प्रकार:</label>
        <select
          value={selectedLoanRateId}
          onChange={e => setSelectedLoanRateId(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary max-w-[155px]"
        >
          <option value="all">सर्व कर्ज प्रकार (एकत्रित)</option>
          {loanRates.map(rate => (
            <option key={rate.loanRateID} value={rate.loanRateID}>
              {rate.shortName || rate.loanType}
            </option>
          ))}
        </select>
      </div>

      {/* Closure Type Selector */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">बंद प्रकार:</label>
        <select
          value={closureType}
          onChange={e => setClosureType(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary"
        >
          <option value="All">सर्व (नियमित + OTS)</option>
          <option value="Normal">नियमित पूर्ण फेड</option>
          <option value="OTS">एकवेळ तडजोड (OTS)</option>
        </select>
      </div>

      {/* Branch Selector if multiple */}
      {branches.length > 1 && (
        <div className="flex items-center gap-1">
          <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">शाखा:</label>
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary max-w-[110px]"
          >
            <option value="all">सर्व शाखा</option>
            {branches.map(b => (
              <option key={b.branchID} value={b.branchID}>
                {b.branchName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Numerals Format Toggle */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">अंक:</label>
        <select
          value={digitMode}
          onChange={e => setDigitMode(e.target.value as 'marathi' | 'english')}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-semibold bg-white focus:outline-none focus:border-primary"
        >
          <option value="marathi">मराठी अंक (१, २, ३)</option>
          <option value="english">इंग्रजी अंक (1, 2, 3)</option>
        </select>
      </div>

      {/* Grouping View Toggle */}
      <div className="flex items-center gap-1">
        <select
          value={displayMode}
          onChange={e => setDisplayMode(e.target.value as 'grouped' | 'flat')}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary"
        >
          <option value="grouped">प्रकारानुसार गटवार</option>
          <option value="flat">एकत्रित सलग यादी</option>
        </select>
      </div>

      {/* In-table Search */}
      <div className="relative w-36 sm:w-44">
        <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="कर्जदार / खाते / पावती क्र..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-5 pr-1 py-0.5 h-6 border border-slate-300 rounded text-[10.5px] focus:outline-none focus:border-primary bg-white"
        />
      </div>

      {/* View / Fetch Button */}
      <button
        type="button"
        onClick={loadReport}
        disabled={isLoading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
        <span>पहा</span>
      </button>
    </div>
  );

  // Summary Banner
  const summaryBanner = (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">कर्ज योजना / प्रकार</span>
        <strong className="text-primary text-[11px] truncate block">{currentSchemeName}</strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">एकूण बंद कर्ज खाती</span>
        <strong className="text-slate-900 font-mono text-[11px]">
          {isMarathiDigits ? toMarathiDigits(filteredRows.length) : filteredRows.length} खाती
          <span className="text-[9.5px] text-slate-500 font-normal ml-1">
            (OTS: {isMarathiDigits ? toMarathiDigits(otsClosedFilteredCount) : otsClosedFilteredCount})
          </span>
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">एकूण मंजूर रक्कम</span>
        <strong className="text-slate-900 font-mono text-[11px]">
          ₹ {fmtCurrency(totalFilteredSanctioned, isMarathiDigits)}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">एकूण मुद्दल वसूल</span>
        <strong className="text-emerald-800 font-mono text-[11px]">
          ₹ {fmtCurrency(totalFilteredPrincipalPaid, isMarathiDigits)}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">व्याज + दंड वसूल</span>
        <strong className="text-indigo-800 font-mono text-[11px]">
          ₹ {fmtCurrency(totalFilteredInterestPaid + totalFilteredPenaltyPaid, isMarathiDigits)}
        </strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">एकूण जमा रक्कम</span>
        <strong className="text-slate-950 font-mono text-xs font-black">
          ₹ {fmtCurrency(totalFilteredCollected, isMarathiDigits)}
        </strong>
      </div>
    </div>
  );

  const periodTextStr = allDates
    ? 'कालावधी : सर्व बंद झालेली कर्ज खाती (आजअखेर)'
    : `बंद दिनांक : ${
        isMarathiDigits ? toMarathiDigits(formatDisplayDate(fromDate)) : formatDisplayDate(fromDate)
      } ते ${isMarathiDigits ? toMarathiDigits(formatDisplayDate(toDate)) : formatDisplayDate(toDate)}`;

  const renderAccountRow = (row: ClosedLoanReportRow, idx: number) => {
    const srText = isMarathiDigits ? toMarathiDigits(idx + 1) : String(idx + 1);
    const accNoText = isMarathiDigits ? toMarathiDigits(row.loanAccountNo) : row.loanAccountNo;
    const disbDateRaw = row.disbursementDateDisplay || formatDisplayDate(row.disbursementDate);
    const disbDateText = isMarathiDigits ? toMarathiDigits(disbDateRaw) : disbDateRaw;
    const closedDateRaw = row.closedDateDisplay || formatDisplayDate(row.closedDate);
    const closedDateText = isMarathiDigits ? toMarathiDigits(closedDateRaw) : closedDateRaw;
    const rateText = isMarathiDigits ? toMarathiDigits(row.interestRate) : String(row.interestRate);
    const receiptText = isMarathiDigits ? toMarathiDigits(row.lastReceiptNo) : row.lastReceiptNo;

    return (
      <tr key={row.loanAccountID} className="hover:bg-slate-50 text-slate-900 text-[11px]">
        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
          {srText}
        </td>
        <td className="border border-slate-900 py-1 px-1.5 text-left">
          {row.loanType}
        </td>
        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold">
          <div>{accNoText}</div>
          {row.legacyAccountNumber && (
            <span className="inline-block mt-0.5 bg-purple-100 text-purple-950 border border-purple-300 px-1 py-0.2 rounded font-mono font-bold text-[9px]">
              🏷️ {isMarathiDigits ? toMarathiDigits(row.legacyAccountNumber) : row.legacyAccountNumber}
            </span>
          )}
        </td>
        <td className="border border-slate-900 py-1 px-2 text-left font-medium">
          <div>{row.borrowerName}</div>
          {(row.memberCode || row.cifNo) && (
            <div className="text-[9.5px] text-slate-500 font-mono">
              {row.memberCode ? `सभासद: ${row.memberCode}` : `CIF: ${row.cifNo}`}
            </div>
          )}
        </td>
        <td className="border border-slate-900 py-1 px-1 text-center font-mono">
          {disbDateText}
        </td>
        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold text-emerald-900">
          {closedDateText}
        </td>
        <td className="border border-slate-900 py-1 px-1 text-center font-mono">
          {rateText}%
        </td>
        <td className="border border-slate-900 py-1 px-1.5 text-right font-mono">
          {fmtCurrency(row.sanctionedAmount, isMarathiDigits)}
        </td>
        <td className="border border-slate-900 py-1 px-1.5 text-right font-mono">
          {fmtCurrency(row.principalPaid, isMarathiDigits)}
        </td>
        <td className="border border-slate-900 py-1 px-1.5 text-right font-mono">
          {fmtCurrency(row.interestPaid + row.penaltyInterestPaid, isMarathiDigits)}
        </td>
        <td className="border border-slate-900 py-1 px-1.5 text-right font-mono">
          {row.waivedAmount > 0 ? fmtCurrency(row.waivedAmount, isMarathiDigits) : '-'}
        </td>
        <td className="border border-slate-900 py-1 px-1.5 text-right font-mono font-bold">
          {fmtCurrency(row.totalCollected, isMarathiDigits)}
        </td>
        <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[10px]">
          <div>{receiptText || '-'}</div>
          <span
            className={`inline-block mt-0.5 px-1 rounded text-[9px] font-bold ${
              row.isOTS
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {row.isOTS ? 'OTS तडजोड' : 'पूर्ण फेड'}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      titleStyle="classic-badge"
      reportTitle="बंद (क्लोज / निरंक) झालेले कर्ज खाते अहवाल"
      reportSubtitle={currentSchemeName}
      periodText={periodTextStr}
      sansthaInfo={sansthaInfo}
      summaryBanner={summaryBanner}
      signatureTier="4-tier"
      signatureTitles={[
        { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Branch Head)' },
        { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' },
      ]}
      onExportExcel={handleExportExcel}
      onPrint={handlePrint}
      extraToolbarControls={filterToolbarControls}
      isLoading={isLoading}
      hasData={filteredRows.length > 0}
      preparedBy="Admin"
      emptyState={
        <div className="bg-white p-12 text-center text-slate-500 rounded-xs border border-slate-200 shadow-xs max-w-4xl mx-auto">
          <CheckCircle2 size={36} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs text-slate-700">निवडलेल्या फिल्टरनुसार कोणतेही बंद झालेले कर्ज खाते आढळले नाही.</p>
          <p className="text-[11px] text-slate-500 mt-1">कृपया वरील तारीख किंवा कर्ज प्रकार फिल्टर बदलून 'पहा' बटणावर क्लिक करा.</p>
        </div>
      }
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-950 border-b border-slate-900 text-center font-bold text-[10.5px] sm:text-xs">
            <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[10%] text-left">कर्ज प्रकार</th>
            <th className="border border-slate-900 py-1.5 px-1 w-[7%] text-center leading-tight">
              कर्ज खाते<br />नं.
            </th>
            <th className="border border-slate-900 py-1.5 px-2 text-left">कर्जदाराचे नाव</th>
            <th className="border border-slate-900 py-1.5 px-1 w-[7.5%] text-center leading-tight">
              वाटप<br />दिनांक
            </th>
            <th className="border border-slate-900 py-1.5 px-1 w-[7.5%] text-center leading-tight">
              बंद<br />दिनांक
            </th>
            <th className="border border-slate-900 py-1.5 px-1 w-[4.5%] text-center leading-tight">
              व्याज<br />दर
            </th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[9.5%] text-right leading-tight">
              मंजूर कर्ज<br />रक्कम
            </th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[9.5%] text-right leading-tight">
              एकूण मुद्दल<br />वसूल
            </th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[8.5%] text-right leading-tight">
              व्याज व दंड<br />वसूल
            </th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[6.5%] text-right leading-tight">
              सूट / OTS<br />माफ
            </th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[9.5%] text-right font-extrabold leading-tight">
              एकूण जमा<br />रक्कम
            </th>
            <th className="border border-slate-900 py-1.5 px-1 w-[8%] text-center leading-tight">
              शेवटची पावती<br />व स्थिती
            </th>
          </tr>
        </thead>
        <tbody>
          {displayMode === 'grouped' && filteredGroups.length > 0 ? (
            filteredGroups.map(grp => (
              <React.Fragment key={grp.loanRateID}>
                {/* Scheme Group Header */}
                <tr className="bg-slate-50 font-bold border-t border-b border-slate-900 text-[11px]">
                  <td colSpan={13} className="border border-slate-900 py-1 px-3 text-primary">
                    {grp.loanType}{' '}
                    <span className="text-slate-600 font-normal ml-2">
                      (बंद खाते संख्या: {isMarathiDigits ? toMarathiDigits(grp.accountCount) : grp.accountCount})
                    </span>
                  </td>
                </tr>

                {/* Scheme Account Rows */}
                {grp.accounts.map((row, idx) => renderAccountRow(row, idx))}

                {/* Scheme Sub-total Row */}
                <tr className="bg-slate-100 font-bold text-slate-950 border-t border-b border-slate-900 text-[11px]">
                  <td colSpan={4} className="border border-slate-900 py-1.5 px-2 text-right">
                    उप-एकूण ({grp.loanType}) — खाती:{' '}
                    {isMarathiDigits ? toMarathiDigits(grp.accountCount) : grp.accountCount}
                  </td>
                  <td colSpan={3} className="border border-slate-900 py-1.5 px-1 text-center">
                    -
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono">
                    {fmtCurrency(grp.totalSanctionedAmount, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono">
                    {fmtCurrency(grp.totalPrincipalPaid, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono">
                    {fmtCurrency(grp.totalInterestPaid + grp.totalPenaltyInterestPaid, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono">
                    {grp.totalWaivedAmount > 0 ? fmtCurrency(grp.totalWaivedAmount, isMarathiDigits) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono font-bold">
                    {fmtCurrency(grp.totalCollected, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1 text-center">-</td>
                </tr>
              </React.Fragment>
            ))
          ) : (
            filteredRows.map((row, idx) => renderAccountRow(row, idx))
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-200 font-bold text-slate-950 border-t-2 border-b-2 border-slate-900 text-xs">
            <td colSpan={4} className="border border-slate-900 py-2 px-2 text-center uppercase tracking-wider">
              सर्वसमावेशक एकूण (Grand Total) — एकूण बंद खाती:{' '}
              {isMarathiDigits ? toMarathiDigits(filteredRows.length) : filteredRows.length}
            </td>
            <td colSpan={3} className="border border-slate-900 py-2 px-1 text-center text-[10.5px]">
              नियमित: {isMarathiDigits ? toMarathiDigits(normalClosedFilteredCount) : normalClosedFilteredCount} | OTS:{' '}
              {isMarathiDigits ? toMarathiDigits(otsClosedFilteredCount) : otsClosedFilteredCount}
            </td>
            <td className="border border-slate-900 py-2 px-1.5 text-right font-mono">
              {fmtCurrency(totalFilteredSanctioned, isMarathiDigits)}
            </td>
            <td className="border border-slate-900 py-2 px-1.5 text-right font-mono">
              {fmtCurrency(totalFilteredPrincipalPaid, isMarathiDigits)}
            </td>
            <td className="border border-slate-900 py-2 px-1.5 text-right font-mono">
              {fmtCurrency(totalFilteredInterestPaid + totalFilteredPenaltyPaid, isMarathiDigits)}
            </td>
            <td className="border border-slate-900 py-2 px-1.5 text-right font-mono">
              {totalFilteredWaived > 0 ? fmtCurrency(totalFilteredWaived, isMarathiDigits) : '-'}
            </td>
            <td className="border border-slate-900 py-2 px-1.5 text-right font-mono font-black text-sm">
              {fmtCurrency(totalFilteredCollected, isMarathiDigits)}
            </td>
            <td className="border border-slate-900 py-2 px-1 text-center">-</td>
          </tr>
        </tfoot>
      </table>
    </CbsReportLayout>
  );
}


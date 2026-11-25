import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  CalendarClock, 
  Building2,
  Calendar
} from 'lucide-react';

interface ReportRow {
  accountNo: string;
  memberName: string;
  memberCode: string;
  schemeName: string;
  openingDate: string;
  installmentAmount: number;
  interestRate: number;
  durationMonths: number;
  maturityDate: string;
  maturityAmount: number;
  totalPaidInstallments: number;
  totalDepositedAmount: number;
  legacyAccruedInt: number;
  status: string;
  penaltyAmount?: number;
  transactionDate?: string;
  payoutAmount?: number;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatDisplayDate = (dStr?: string | null) => {
  if (!dStr) return '-';
  try {
    const clean = dStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dStr;
  }
};

export default function RdReports() {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const parseReportType = (): string => {
    const params = new URLSearchParams(window.location.search);
    const fullTab = params.get('tab') || '';
    let rType = '';
    if (fullTab.includes('reportType=')) {
      rType = fullTab.split('reportType=')[1] || '';
    } else {
      rType = params.get('reportType') || '';
    }
    return rType.split('&')[0].trim() || 'register';
  };

  const [reportType, setReportType] = useState<string>(parseReportType);
  const [accounts, setAccounts] = useState<ReportRow[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [branches, setBranches] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>('all');

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const initialBranchId = effectiveBranch === null ? 'all' : String(effectiveBranch);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const reportRef = useRef<HTMLDivElement>(null);

  // Filters
  const getLocalTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const initialCbsDateStr = user?.businessDate ? user.businessDate.split('T')[0] : getLocalTodayStr();
  const getFyStartForDate = (dateStr: string) => {
    const [yStr, mStr] = dateStr.split('-');
    const y = parseInt(yStr, 10) || new Date().getFullYear();
    const m = parseInt(mStr, 10) || 1;
    return `${m >= 4 ? y : y - 1}-04-01`;
  };
  const [hasSyncedCbsDate, setHasSyncedCbsDate] = useState<boolean>(Boolean(user?.businessDate));
  const [fromDate, setFromDate] = useState<string>(() => getFyStartForDate(initialCbsDateStr));
  const [toDate, setToDate] = useState<string>(() => initialCbsDateStr);

  useEffect(() => {
    fetchSansthaDetail();
    fetchBranches();
    fetchSchemes();

    const handlePopState = () => {
      setReportType(parseReportType());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (user?.businessDate && !hasSyncedCbsDate) {
      const bDate = user.businessDate.split('T')[0];
      setFromDate(getFyStartForDate(bDate));
      setToDate(bDate);
      setHasSyncedCbsDate(true);
    }
  }, [user?.businessDate, hasSyncedCbsDate]);

  useEffect(() => {
    fetchReportData(selectedBranchId, selectedSchemeId);
  }, [reportType, fromDate, toDate, selectedBranchId, selectedSchemeId]);

  const fetchSchemes = async () => {
    try {
      const res = await axios.get('/api/RdSchemes');
      setSchemes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching RD schemes', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchSansthaDetail = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSansthaDetail(res.data[0]);
      } else if (res.data && !Array.isArray(res.data)) {
        setSansthaDetail(res.data);
      }
    } catch (err) {
      console.error('Error fetching sanstha detail', err);
    }
  };

  const fetchReportData = async (bId?: string, sId?: string) => {
    setLoading(true);
    try {
      const activeBranch = bId !== undefined ? bId : selectedBranchId;
      const activeScheme = sId !== undefined ? sId : selectedSchemeId;
      const queryParams = new URLSearchParams();
      queryParams.append('reportType', reportType || 'outstanding');
      if (activeBranch && activeBranch !== 'all') {
        queryParams.append('branchId', activeBranch);
      }
      if (activeScheme && activeScheme !== 'all') {
        queryParams.append('schemeId', activeScheme);
      }
      if ((reportType === 'register' || reportType === 'closed') && fromDate) {
        queryParams.append('fromDate', fromDate);
      }
      if (toDate) {
        queryParams.append('toDate', toDate);
        queryParams.append('asOfDate', toDate);
      }

      const res = await axios.get(`/api/Reports/rd-report?${queryParams.toString()}`);
      const payload = res.data;
      const data: ReportRow[] = Array.isArray(payload) ? payload : (payload?.rows || []);
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch RD data', err);
    } finally {
      setLoading(false);
    }
  };

  const getBranchName = () => {
    if (!selectedBranchId || selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const b = branches.find((item: any) => item.branchID.toString() === selectedBranchId.toString());
    return b ? b.branchName : 'मुख्य शाखा';
  };

  const getSelectedSchemeName = () => {
    if (!selectedSchemeId || selectedSchemeId === 'all') return 'सर्व योजना (All Schemes)';
    const s = schemes.find((item: any) => item.rdSchemeID?.toString() === selectedSchemeId.toString());
    return s ? `${s.schemeName} (${s.schemeCode})` : 'विशिष्ट योजना';
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredAccounts = accounts.filter((a) => {
    if (selectedSchemeId && selectedSchemeId !== 'all') {
      const sId = (a as any).rdSchemeID ?? (a as any).rdSchemeId;
      if (sId && sId.toString() !== selectedSchemeId.toString()) {
        return false;
      }
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (a.accountNo && a.accountNo.toLowerCase().includes(term)) ||
      (a.memberName && a.memberName.toLowerCase().includes(term)) ||
      (a.schemeName && a.schemeName.toLowerCase().includes(term)) ||
      (a.memberCode && a.memberCode.toLowerCase().includes(term))
    );
  });

  const totalDepositSum = filteredAccounts.reduce((s, a) => s + (a.totalDepositedAmount || 0), 0);
  const totalMaturitySum = filteredAccounts.reduce((s, a) => s + (a.maturityAmount || 0), 0);

  const getReportTitle = () => {
    switch (reportType) {
      case 'register': return 'आवर्ती ठेव नोंदवही (RD Register)';
      case 'outstanding': return 'आवर्ती ठेव बाकी अहवाल (RD Outstanding Report)';
      case 'defaulters': return 'थकीत आवर्ती ठेव खातेदार (RD Defaulters List)';
      case 'maturity': return 'मुदतपूर्ती देय आवर्ती ठेवी (Maturity Due Report)';
      case 'closed': return 'बंद आवर्ती खाती अहवाल (Closed RD Accounts)';
      default: return 'आवर्ती ठेव अहवाल (RD Report)';
    }
  };

  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const excelRows = filteredAccounts.map((a, i) => ({
      'अ.क्र.': i + 1,
      'खाते क्र.': a.accountNo,
      'ग्राहक CIF / कोड': (a as any).cifNo || a.memberCode || '-',
      'खातेदाराचे नाव': a.memberName,
      'योजनेचे नाव': a.schemeName || '-',
      'चालू दिनांक': formatDisplayDate(a.openingDate),
      'मासिक हप्ता (₹)': a.installmentAmount || 0,
      'कालावधी (महिने)': a.durationMonths,
      'व्याज दर (%)': a.interestRate,
      'मुदतपूर्ती दिनांक': formatDisplayDate(a.maturityDate),
      'मुदतपूर्ती रक्कम (₹)': a.maturityAmount || 0,
      'भरलेले हप्ते': a.totalPaidInstallments,
      'एकूण ठेव जमा (₹)': a.totalDepositedAmount || 0,
      'स्थिती': a.status
    }));

    excelRows.push({
      'अ.क्र.': '' as any,
      'खाते क्र.': '',
      'ग्राहक CIF / कोड': '',
      'खातेदाराचे नाव': 'एकूण बेरीज (Grand Total):',
      'योजनेचे नाव': '',
      'चालू दिनांक': '',
      'मासिक हप्ता (₹)': 0,
      'कालावधी (महिने)': 0,
      'व्याज दर (%)': 0,
      'मुदतपूर्ती दिनांक': '',
      'मुदतपूर्ती रक्कम (₹)': totalMaturitySum,
      'भरलेले हप्ते': 0,
      'एकूण ठेव जमा (₹)': totalDepositSum,
      'स्थिती': ''
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RD Report');
    const schemeSuffix = selectedSchemeId !== 'all' ? `_Scheme_${selectedSchemeId}` : '_AllSchemes';
    XLSX.writeFile(wb, `RD_Report_${reportType}${schemeSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 8mm 8mm;
            }
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: transparent !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            tfoot {
              display: table-footer-group;
            }
          }
        `}
      </style>

      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5">
        
        {/* Row 1: Title + Inline Filters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          
          {/* Left: Compact Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <CalendarClock size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>आवर्ती ठेव अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(RD Reports Center)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Branch */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranchId}
                disabled={!isHOUser}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-26 sm:w-30 disabled:bg-slate-100 disabled:text-slate-600"
              >
                {isHOUser && <option value="all">सर्व शाखा (All)</option>}
                {(isHOUser || !lockedBranchId ? branches : branches.filter((b: any) => Number(b.branchID) === Number(lockedBranchId))).map((b: any) => (
                  <option key={b.branchID} value={b.branchID.toString()}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Scheme Filter */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">योजना:</label>
              <select
                value={selectedSchemeId}
                onChange={(e) => setSelectedSchemeId(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-36 text-gray-800"
              >
                <option value="all">सर्व योजना (All Schemes)</option>
                {schemes.map((s: any) => (
                  <option key={s.rdSchemeID} value={s.rdSchemeID.toString()}>
                    {s.schemeName} ({s.schemeCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Report Type */}
            <div className="w-44 sm:w-50">
              <select
                value={reportType}
                onChange={(e) => {
                  if (e.target.value === 'khatavani') {
                    window.history.pushState({}, '', '?tab=rd-khatavani-report');
                    window.dispatchEvent(new Event('popstate'));
                    return;
                  }
                  setReportType(e.target.value);
                }}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full text-primary"
              >
                <option value="register">१. आरडी नोंदवही (RD Register)</option>
                <option value="outstanding">२. आरडी बाकी अहवाल (Outstanding)</option>
                <option value="defaulters">३. थकीत खातेदार (Defaulters)</option>
                <option value="maturity">४. मुदतपूर्ती देय (Maturity Due)</option>
                <option value="closed">५. खाते बंद अहवाल (Closure Report)</option>
                <option value="khatavani">📖 ६. आरडी खतावणी (RD Khatavani)</option>
              </select>
            </div>

            <a
              href="?tab=rd-khatavani-report"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '?tab=rd-khatavani-report');
                window.dispatchEvent(new Event('popstate'));
              }}
              className="h-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 rounded-sm text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="आरडी खतावणी उघडा"
            >
              <span>📖</span>
              <span className="hidden sm:inline">आरडी खतावणी</span>
            </a>

            {/* Dates */}
            {(reportType === 'register' || reportType === 'closed') && (
              <div className="flex items-center gap-1">
                <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
                />
              </div>
            )}

            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">
                {reportType === 'register' || reportType === 'closed' ? 'पर्यंत:' : 'पर्यंत (दिनांक):'}
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* View Button */}
            <button
              onClick={() => fetchReportData()}
              disabled={loading}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
              <span>पहा</span>
            </button>
          </div>

          {/* Right: Export & Print Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={filteredAccounts.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredAccounts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={filteredAccounts.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredAccounts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="A4 प्रिंट काढा"
            >
              <Printer size={12} />
              <span>प्रिंट (A4)</span>
            </button>
          </div>

        </div>

        {/* Row 2: In-Table Search + Summary Metrics Strip */}
        <div className="pt-1.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="relative w-64 max-w-full">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="नाव, खाते क्र. किंवा कोड शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="bg-indigo-50 px-2 py-0.5 rounded text-indigo-800 border border-indigo-200 font-medium">
              {reportType === 'register' || reportType === 'closed'
                ? `${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`
                : `दि. ${formatDisplayDate(toDate)} अखेर`}
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              एकूण खाती: <strong className="text-primary font-bold">{filteredAccounts.length}</strong>
            </span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
              एकूण ठेव जमा: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalDepositSum)}</strong>
            </span>
          </div>
        </div>

      </div>

      {/* Main Printable A4 Document Frame */}
      <div 
        ref={reportRef} 
        className="print-area bg-white mx-auto max-w-5xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between text-xs"
      >
        <div>
          
          {/* Official Bank Header Box (Exact Reference Format) */}
          <div className="border border-gray-900 p-3 relative text-center">
            
            {/* Registration Top Bar */}
            <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
              <div>
                <span>रजि. नं. - </span>
                <span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span>
              </div>
              <div>
                <span>शाखा: </span>
                <span className="text-primary font-bold">{getBranchName()}</span>
              </div>
              <div>
                <span>रजि. दि. - </span>
                <span className="font-mono">{sansthaDetail?.registrationDate ? formatDisplayDate(sansthaDetail.registrationDate) : '-'}</span>
              </div>
            </div>

            {/* Central Sanstha Name */}
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
              {sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
            </h1>

            {/* Subtitle / Address */}
            <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
              {sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
            </p>
          </div>

          {/* Report Title Banner Section */}
          <div className="mt-3 mb-2 flex flex-wrap items-center justify-between gap-1 border-b border-gray-300 pb-2">
            <div className="text-left text-xs font-bold text-gray-800">
              <span>योजना : </span>
              <span className="text-primary font-bold">{getSelectedSchemeName()}</span>
            </div>

            {/* Title Banner Box */}
            <div className="inline-block border border-gray-400 bg-gray-50/80 px-6 py-1 rounded-xs shadow-2xs text-center">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif">
                {getReportTitle()}
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>{reportType === 'register' || reportType === 'closed' ? 'कालावधी : ' : 'अखेर दिनांक : '}</span>
              <span className="font-mono">
                {reportType === 'register' || reportType === 'closed'
                  ? `${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`
                  : `${formatDisplayDate(toDate)} पर्यंत`}
              </span>
            </div>
          </div>

          {/* RD Accounts Data Table */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse border border-gray-900 text-xs">
              <thead>
                <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                  <th className="border border-gray-900 py-1.5 px-1 w-[5%] text-center">#</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-center">खाते क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-3 w-[26%] text-left">खातेदाराचे नाव</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-center">चालू दिनांक</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-right">मासिक हप्ता</th>
                  <th className="border border-gray-900 py-1.5 px-1 w-[6%] text-center">व्याज %</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-center">मुदतपूर्ती</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right font-extrabold">एकूण ठेव बाकी</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                      माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                      कोणतीही आवर्ती ठेव नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((a, idx) => (
                    <tr key={a.accountNo || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                      <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                      <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-900">{a.accountNo}</td>
                      <td className="border border-gray-900 py-1 px-3 font-medium">
                        <div className="text-gray-900 font-semibold">{a.memberName}</div>
                        {selectedSchemeId === 'all' && a.schemeName && (
                          <div className="text-[9.5px] font-sans text-indigo-700 font-medium tracking-tight">
                            योजना: {a.schemeName}
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(a.openingDate)}</td>
                      <td className="border border-gray-900 py-1 px-2 text-right font-mono">{fmtCurrency(a.installmentAmount)}</td>
                      <td className="border border-gray-900 py-1 px-1 text-center font-mono">{a.interestRate}%</td>
                      <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(a.maturityDate)}</td>
                      <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(a.totalDepositedAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredAccounts.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                    <td colSpan={7} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण आवर्ती ठेव बाकी बेरीज:
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                      ₹ {fmtCurrency(totalDepositSum)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

        </div>

        {/* Verification Signatures Section */}
        <div className="mt-14 pt-4 border-t border-dashed border-gray-400 grid grid-cols-3 text-center text-xs font-bold text-gray-900">
          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">लिपिक / रोखपाल</p>
            <span className="text-[10px] text-gray-500 font-normal">(Clerk / Cashier)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">लेखापाल / आवर्ती तपासनीस</p>
            <span className="text-[10px] text-gray-500 font-normal">(Accountant / Inspector)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">शाखा व्यवस्थापक / मानद सचिव</p>
            <span className="text-[10px] text-gray-500 font-normal">(Manager / Secretary)</span>
          </div>
        </div>

      </div>

    </div>
  );
}

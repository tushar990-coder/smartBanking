import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  PiggyBank, 
  Building2,
  Calendar,
  Layers
} from 'lucide-react';

interface PigmyAccountRow {
  pigmyAccountID: number;
  accountNo: string;
  memberID: number;
  member?: { memberCode: string; memberName: string; mobileNo?: string };
  pigmySchemeID: number;
  pigmyScheme?: { schemeName: string };
  pigmyAgentID: number;
  pigmyAgent?: { agentName: string; agentCode?: string; agentNumber?: string };
  branchID: number;
  openingDate: string;
  openingBalance: number;
  totalDepositedAmount: number;
  status: string;
}

interface Agent {
  pigmyAgentID: number;
  agentName: string;
  branchID?: number;
}

interface Branch {
  branchID: number;
  branchName: string;
  branchCode: string;
}

interface CollectionRow {
  collectionId: number;
  receiptNo: string;
  collectionDate: string;
  collectionAmount: number;
  collectionSource: string;
  openingBalance: number;
  closingBalance: number;
  pigmyAccountNo?: string;
  memberName?: string;
  memberCode?: string;
  agentName?: string;
  agentId?: number;
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

export default function PigmyReports() {
  const [reportType, setReportType] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const fullTab = params.get('tab') || '';
    if (fullTab.includes('reportType=')) {
      return fullTab.split('reportType=')[1] || 'collection-register';
    }
    return params.get('reportType') || 'collection-register';
  });

  const [branches, setBranches] = useState<Branch[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [accounts, setAccounts] = useState<PigmyAccountRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  // Filters
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId);
  const [selectedAgentId, setSelectedAgentId] = useState<number | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');

  useEffect(() => {
    fetchSansthaDetail();
    fetchBranches();
    fetchAgents();
    fetchAccountsMaster();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [reportType, selectedBranchId, selectedAgentId, fromDate, toDate, selectedAccountId]);

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

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await axios.get('/api/PigmyAgents');
      setAgents(res.data || []);
    } catch (err) {
      console.error('Error fetching agents', err);
    }
  };

  const fetchAccountsMaster = async () => {
    try {
      const res = await axios.get('/api/PigmyAccounts');
      setAccounts(res.data || []);
    } catch (err) {
      console.error('Error fetching pigmy accounts', err);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (reportType === 'collection-register') {
        let url = `/api/PigmyCollections?fromDate=${fromDate}&toDate=${toDate}`;
        if (selectedBranchId > 0) url += `&branchId=${selectedBranchId}`;
        if (selectedAgentId !== 'ALL') url += `&agentId=${selectedAgentId}`;
        
        const res = await axios.get(url);
        setCollections(res.data || []);
      } else if (reportType === 'account-register') {
        const res = await axios.get('/api/PigmyAccounts');
        let data: PigmyAccountRow[] = res.data || [];

        if (selectedBranchId > 0) {
          data = data.filter((a) => a.branchID === selectedBranchId);
        }
        if (selectedAgentId !== 'ALL') {
          data = data.filter((a) => a.pigmyAgentID === Number(selectedAgentId));
        }
        setAccounts(data);
      }
    } catch (err) {
      console.error('Failed to fetch pigmy report data', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter collections
  const filteredCollections = collections.filter((c) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (c.receiptNo && c.receiptNo.toLowerCase().includes(term)) ||
      (c.pigmyAccountNo && c.pigmyAccountNo.toLowerCase().includes(term)) ||
      (c.memberName && c.memberName.toLowerCase().includes(term)) ||
      (c.agentName && c.agentName.toLowerCase().includes(term))
    );
  });

  const totalRegisterCollection = filteredCollections.reduce((sum, c) => sum + (c.collectionAmount || 0), 0);

  // Filter accounts
  const filteredAccounts = accounts.filter((a) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const name = (a.member?.memberName || '').toLowerCase();
    const acc = (a.accountNo || '').toLowerCase();
    const code = (a.member?.memberCode || '').toLowerCase();
    const agent = (a.pigmyAgent?.agentName || '').toLowerCase();
    return name.includes(term) || acc.includes(term) || code.includes(term) || agent.includes(term);
  });

  const totalAccountsBalance = filteredAccounts.reduce((sum, a) => sum + (a.totalDepositedAmount || 0), 0);

  const getReportTitle = () => {
    switch (reportType) {
      case 'collection-register': return 'पिग्मी दैनंदिन जमा नोंदवही (Daily Collection Register)';
      case 'account-register': return 'पिग्मी खाती नोंदवही (Pigmy Account Register)';
      case 'settlement': return 'एजंट दैनंदिन रोख ताळमेळ अहवाल (Daily Settlement)';
      case 'commission': return 'एजंट कमिशन विवरणपत्रक (Commission Statement)';
      default: return 'पिग्मी अहवाल (Pigmy Report)';
    }
  };

  const handleExportExcel = () => {
    if (reportType === 'collection-register') {
      if (filteredCollections.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const excelRows = filteredCollections.map((c, i) => ({
        'अ.क्र.': i + 1,
        'पावती क्र.': c.receiptNo,
        'तारीख': formatDisplayDate(c.collectionDate),
        'खाते क्र.': c.pigmyAccountNo || '-',
        'सभासदाचे नाव': c.memberName || '-',
        'पिग्मी एजंट': c.agentName || '-',
        'आरंभी शिल्लक (₹)': c.openingBalance || 0,
        'जमा रक्कम (₹)': c.collectionAmount || 0,
        'अखेर शिल्लक (₹)': c.closingBalance || 0,
        'माध्यम': c.collectionSource || 'App'
      }));
      excelRows.push({
        'अ.क्र.': '' as any,
        'पावती क्र.': '',
        'तारीख': '',
        'खाते क्र.': '',
        'सभासदाचे नाव': 'एकूण जमा बेरीज:',
        'पिग्मी एजंट': '',
        'आरंभी शिल्लक (₹)': 0,
        'जमा रक्कम (₹)': totalRegisterCollection,
        'अखेर शिल्लक (₹)': 0,
        'माध्यम': ''
      });
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Collection');
      XLSX.writeFile(wb, `Pigmy_Collection_${fromDate}_to_${toDate}.xlsx`);
    } else if (reportType === 'account-register') {
      if (filteredAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const excelRows = filteredAccounts.map((a, i) => ({
        'अ.क्र.': i + 1,
        'खाते क्र.': a.accountNo,
        'सभासद कोड': a.member?.memberCode || a.memberID,
        'खातेदाराचे नाव': a.member?.memberName || '-',
        'एजंट नाव': a.pigmyAgent?.agentName || '-',
        'उघडल्याचा दिनांक': formatDisplayDate(a.openingDate),
        'शिल्लक रक्कम (₹)': a.totalDepositedAmount || 0,
        'स्थिती': a.status
      }));
      excelRows.push({
        'अ.क्र.': '' as any,
        'खाते क्र.': '',
        'सभासद कोड': '',
        'खातेदाराचे नाव': 'एकूण ठेव शिल्लक बेरीज:',
        'एजंट नाव': '',
        'उघडल्याचा दिनांक': '',
        'शिल्लक रक्कम (₹)': totalAccountsBalance,
        'स्थिती': ''
      });
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pigmy Accounts');
      XLSX.writeFile(wb, `Pigmy_Accounts_${todayStr}.xlsx`);
    }
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
              <PiggyBank size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>पिग्मी ठेवी अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Pigmy Deposit Reports)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Report Type */}
            <div className="w-44 sm:w-52">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full text-primary"
              >
                <option value="collection-register">१. दैनंदिन जमा नोंदवही (Collection)</option>
                <option value="account-register">२. पिग्मी खाती नोंदवही (Accounts)</option>
              </select>
            </div>

            {/* Branch */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranchId}
                disabled={hasGlobalBranch}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
              >
                <option value={0}>सर्व शाखा (All)</option>
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Agent */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">एजंट:</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
              >
                <option value="ALL">सर्व एजंट (All)</option>
                {agents
                  .filter((a) => selectedBranchId === 0 || a.branchID === selectedBranchId)
                  .map((a) => (
                    <option key={a.pigmyAgentID} value={a.pigmyAgentID}>
                      {a.agentName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Dates (For Collection Register) */}
            {reportType === 'collection-register' && (
              <>
                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
                  />
                </div>
              </>
            )}

            {/* View Button */}
            <button
              onClick={fetchReportData}
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
              className="h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              className="h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
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
              placeholder="नाव, पावती किंवा खाते क्र. शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            {reportType === 'collection-register' ? (
              <>
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                  एकूण पावत्या: <strong className="text-primary font-bold">{filteredCollections.length}</strong>
                </span>
                <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
                  एकूण जमा: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalRegisterCollection)}</strong>
                </span>
              </>
            ) : (
              <>
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                  एकूण खाती: <strong className="text-primary font-bold">{filteredAccounts.length}</strong>
                </span>
                <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
                  एकूण ठेव शिल्लक: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalAccountsBalance)}</strong>
                </span>
              </>
            )}
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
          <div className="mt-3 mb-2 flex items-center justify-between">
            <div className="w-28 hidden sm:block"></div>

            {/* Title Banner Box */}
            <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs text-center">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif">
                {getReportTitle()}
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>कालावधी : </span>
              <span className="font-mono">
                {reportType === 'collection-register' ? `${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}` : formatDisplayDate(todayStr)}
              </span>
            </div>
          </div>

          {/* Table 1: Daily Collection Register */}
          {reportType === 'collection-register' && (
            <div className="overflow-x-auto mt-2">
              <table className="w-full border-collapse border border-gray-900 text-xs">
                <thead>
                  <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                    <th className="border border-gray-900 py-1.5 px-1 w-[5%] text-center">#</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[12%] text-center">पावती क्र.</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[12%] text-center">तारीख</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-center">खाते क्र.</th>
                    <th className="border border-gray-900 py-1.5 px-3 w-[25%] text-left">सभासदाचे नाव</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-left">एजंट</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right font-extrabold">जमा रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                        माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                      </td>
                    </tr>
                  ) : filteredCollections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                        निवडलेल्या कालावधीत कोणतीही पिग्मी जमा नोंद आढळली नाही.
                      </td>
                    </tr>
                  ) : (
                    filteredCollections.map((c, idx) => (
                      <tr key={c.collectionId || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                        <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                        <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-900">{c.receiptNo}</td>
                        <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(c.collectionDate)}</td>
                        <td className="border border-gray-900 py-1 px-2 text-center font-mono text-primary font-bold">{c.pigmyAccountNo || '-'}</td>
                        <td className="border border-gray-900 py-1 px-3 font-medium">{c.memberName || '-'}</td>
                        <td className="border border-gray-900 py-1 px-2 text-gray-700">{c.agentName || '-'}</td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(c.collectionAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredCollections.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                      <td colSpan={6} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                        एकूण पिग्मी जमा बेरीज:
                      </td>
                      <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                        ₹ {fmtCurrency(totalRegisterCollection)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Table 2: Accounts Master Register */}
          {reportType === 'account-register' && (
            <div className="overflow-x-auto mt-2">
              <table className="w-full border-collapse border border-gray-900 text-xs">
                <thead>
                  <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                    <th className="border border-gray-900 py-1.5 px-1 w-[5%] text-center">#</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[15%] text-center">खाते क्र.</th>
                    <th className="border border-gray-900 py-1.5 px-3 w-[35%] text-left">खातेदाराचे नाव</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[20%] text-left">पिग्मी एजंट</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[13%] text-center">चालू दिनांक</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[12%] text-right font-extrabold">शिल्लक (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                        माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                      </td>
                    </tr>
                  ) : filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                        कोणतीही पिग्मी खाते नोंद आढळली नाही.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((a, idx) => (
                      <tr key={a.pigmyAccountID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                        <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                        <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-900">{a.accountNo}</td>
                        <td className="border border-gray-900 py-1 px-3 font-medium">{a.member?.memberName || '-'}</td>
                        <td className="border border-gray-900 py-1 px-2 text-gray-700">{a.pigmyAgent?.agentName || '-'}</td>
                        <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(a.openingDate)}</td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-gray-950">{fmtCurrency(a.totalDepositedAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredAccounts.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                      <td colSpan={5} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                        एकूण पिग्मी ठेव बाकी बेरीज:
                      </td>
                      <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                        ₹ {fmtCurrency(totalAccountsBalance)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

        </div>

        {/* Verification Signatures Section */}
        <div className="mt-14 pt-4 border-t border-dashed border-gray-400 grid grid-cols-3 text-center text-xs font-bold text-gray-900">
          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">पिग्मी एजंट / रोखपाल</p>
            <span className="text-[10px] text-gray-500 font-normal">(Agent / Cashier)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">लेखापाल / तपासनीस</p>
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

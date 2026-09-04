import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  FileText, 
  Building2,
  Calendar
} from 'lucide-react';

interface ReportNode {
  id: number;
  name: string;
  code?: string;
  isGroup: boolean;
  openingBalance: number;
  openingType: string;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingType: string;
  children: ReportNode[];
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

export default function TrialBalanceNamunaN() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState<ReportNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'transactionsOnly' | 'active' | 'all'>('transactionsOnly');
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);
  
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? globalBranchStr as string : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

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
    } catch (err) {
      console.error('Failed to fetch sanstha detail', err);
    }
  };

  const fetchInitData = async () => {
    try {
      const [resFy, resBranches] = await Promise.all([
        axios.get('/api/FinancialYears'),
        axios.get('/api/Branches')
      ]);

      if (resFy.data && Array.isArray(resFy.data)) {
        const active = resFy.data.find((y: any) => y.isActive);
        if (active) {
          setFromDate(active.startDate.split('T')[0]);
          setToDate(active.endDate.split('T')[0]);
        }
      }

      if (resBranches.data) {
        setBranches(resBranches.data);
      }
    } catch (error) {
      console.error('Failed to fetch active financial year', error);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = '/api/Reports/TrialBalance';
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (selectedBranchId !== 'all') params.append('branchId', selectedBranchId);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url);
      setReportData(res.data || []);
    } catch (error) {
      console.error('Error fetching trial balance', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fromDate && toDate) {
      fetchReport();
    }
  }, [fromDate, toDate, selectedBranchId]);

  const handlePrint = () => {
    window.print();
  };

  const flattenLedgers = (nodes: ReportNode[]): ReportNode[] => {
    let result: ReportNode[] = [];
    for (const node of nodes) {
      if (!node.isGroup) {
        const hasTransactions = node.totalDebit !== 0 || node.totalCredit !== 0;
        const hasBalance = node.openingBalance !== 0 || node.closingBalance !== 0;

        if (filterMode === 'transactionsOnly') {
          if (hasTransactions) result.push(node);
        } else if (filterMode === 'active') {
          if (hasTransactions || hasBalance) result.push(node);
        } else {
          result.push(node);
        }
      }
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenLedgers(node.children));
      }
    }
    return result;
  };

  const flatList = flattenLedgers(reportData).filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(term) ||
      (item.code && item.code.toLowerCase().includes(term)) ||
      item.id.toString().includes(term)
    );
  });

  let totalOpeningDr = 0;
  let totalOpeningCr = 0;
  let totalTransDr = 0;
  let totalTransCr = 0;
  let totalClosingDr = 0;
  let totalClosingCr = 0;

  flatList.forEach(item => {
    if (item.openingType === 'Dr') totalOpeningDr += item.openingBalance;
    if (item.openingType === 'Cr') totalOpeningCr += item.openingBalance;
    
    totalTransDr += item.totalDebit;
    totalTransCr += item.totalCredit;
    
    if (item.closingType === 'Dr') totalClosingDr += item.closingBalance;
    if (item.closingType === 'Cr') totalClosingCr += item.closingBalance;
  });

  const handleExportExcel = () => {
    if (flatList.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const excelRows = flatList.map((node, i) => ({
      'अ.क्र.': i + 1,
      'खाते कोड': node.code || node.id,
      'खाते नाव': node.name,
      'आरंभीची शिल्लक (₹)': node.openingBalance ? `${fmtCurrency(node.openingBalance)} ${node.openingType}` : '-',
      'नावे व्यवहार (Debit ₹)': node.totalDebit || 0,
      'जमा व्यवहार (Credit ₹)': node.totalCredit || 0,
      'अखेरची शिल्लक (₹)': node.closingBalance ? `${fmtCurrency(node.closingBalance)} ${node.closingType}` : '-'
    }));

    excelRows.push({
      'अ.क्र.': '' as any,
      'खाते कोड': '',
      'खाते नाव': 'एकूण बेरीज (Grand Total):',
      'आरंभीची शिल्लक (₹)': `Dr: ₹${fmtCurrency(totalOpeningDr)} / Cr: ₹${fmtCurrency(totalOpeningCr)}`,
      'नावे व्यवहार (Debit ₹)': totalTransDr,
      'जमा व्यवहार (Credit ₹)': totalTransCr,
      'अखेरची शिल्लक (₹)': `Dr: ₹${fmtCurrency(totalClosingDr)} / Cr: ₹${fmtCurrency(totalClosingCr)}`
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Namuna N Trial Balance');
    XLSX.writeFile(wb, `Namuna_N_Trial_Balance_${new Date().toISOString().split('T')[0]}.xlsx`);
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
              <FileText size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>नमुना 'न' तेरीज पत्रक</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Namuna N Trial Balance)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Branch */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
              >
                <option value="all">सर्व शाखा (All)</option>
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID.toString()}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
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

            {/* Filter Mode */}
            <div className="w-36">
              <select
                value={filterMode}
                onChange={(e: any) => setFilterMode(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-bold bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full text-primary"
              >
                <option value="transactionsOnly">फक्त व्यवहार झालेली खाती</option>
                <option value="active">सक्रिय शिल्लक खाती</option>
                <option value="all">सर्व खाती</option>
              </select>
            </div>

            {/* View Button */}
            <button
              onClick={fetchReport}
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
              disabled={flatList.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${flatList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={flatList.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${flatList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              placeholder="खाते नाव किंवा कोड शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              एकूण खाती: <strong className="text-primary font-bold">{flatList.length}</strong>
            </span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
              नावे व्यवहार: <strong className="text-red-700 font-bold">₹ {fmtCurrency(totalTransDr)}</strong> | जमा व्यवहार: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalTransCr)}</strong>
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
                नमुना 'न' तेरीज पत्रक
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>कालावधी : </span>
              <span className="font-mono">{formatDisplayDate(fromDate)} ते {formatDisplayDate(toDate)}</span>
            </div>
          </div>

          {/* Trial Balance Data Table */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse border border-gray-900 text-xs">
              <thead>
                <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                  <th className="border border-gray-900 py-1.5 px-1 w-[6%] text-center">अ. क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-3 w-[34%] text-left">खाते / लेजर नाव</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right">आरंभीची शिल्लक (₹)</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-right">नावे व्यवहार (Dr ₹)</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-right">जमा व्यवहार (Cr ₹)</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right font-extrabold">अखेरची शिल्लक (₹)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                      तेरीज अहवाल तयार होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : flatList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                      या कालावधीत कोणतीही तेरीज नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  flatList.map((node, index) => {
                    let opStr = '-';
                    if (node.openingBalance !== 0) {
                      opStr = `${fmtCurrency(node.openingBalance)} ${node.openingType}`;
                    }

                    let closingStr = '-';
                    if (node.closingBalance !== 0) {
                      closingStr = `${fmtCurrency(node.closingBalance)} ${node.closingType}`;
                    }

                    return (
                      <tr key={node.id} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                        <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{index + 1}</td>
                        <td className="border border-gray-900 py-1 px-3">
                          <span className="text-primary font-mono font-bold mr-1.5">{node.code || node.id} -</span>
                          <span className="font-medium">{node.name}</span>
                        </td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono">{opStr}</td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono text-red-700">
                          {node.totalDebit > 0 ? fmtCurrency(node.totalDebit) : '-'}
                        </td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono text-emerald-800 font-medium">
                          {node.totalCredit > 0 ? fmtCurrency(node.totalCredit) : '-'}
                        </td>
                        <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-gray-950">{closingStr}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {flatList.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                    <td colSpan={2} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण तेरीज बेरीज (Grand Total):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono text-[11px]">
                      <div>Dr: ₹{fmtCurrency(totalOpeningDr)}</div>
                      <div>Cr: ₹{fmtCurrency(totalOpeningCr)}</div>
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-bold text-red-700">
                      ₹ {fmtCurrency(totalTransDr)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-bold text-emerald-800">
                      ₹ {fmtCurrency(totalTransCr)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black bg-primary/10 text-primary text-[11px]">
                      <div>Dr: ₹{fmtCurrency(totalClosingDr)}</div>
                      <div>Cr: ₹{fmtCurrency(totalClosingCr)}</div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

        </div>

        {/* Verification Signatures Section */}
        <div className="mt-14 pt-4 border-t border-dashed border-gray-400 grid grid-cols-4 text-center text-xs font-bold text-gray-900">
          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-3 pt-1">अध्यक्ष</p>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-3 pt-1">संचालक मंडळ</p>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-3 pt-1">व्यवस्थापक / सचिव</p>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-3 pt-1">वैधानिक लेखापरीक्षक</p>
          </div>
        </div>

      </div>

    </div>
  );
}

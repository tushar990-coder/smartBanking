import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  TrendingUp, 
  Building2,
  Calendar
} from 'lucide-react';

interface ReportNode {
  id: number;
  name: string;
  code?: string;
  displayOrder?: number;
  isGroup: boolean;
  amount: number;
  previousYearAmount?: number;
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

const TreeNode: React.FC<{ node: ReportNode, level: number }> = ({ node, level }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isHead = level === 0 || node.isGroup;
  
  return (
    <React.Fragment>
      <tr className={`border-b transition-colors ${
        isHead 
          ? 'bg-blue-50/75 hover:bg-blue-100/60 font-bold text-gray-950 border-gray-400 print:bg-slate-100/90' 
          : 'bg-white hover:bg-slate-50 font-normal text-gray-800 border-gray-200'
      }`}>
        <td className={`py-1 px-1.5 text-right border-r border-gray-900 w-[24%] align-top font-mono ${
          isHead ? 'font-bold text-gray-900 text-[11px]' : 'font-normal text-gray-500 text-[10.5px]'
        }`}>
          {node.previousYearAmount ? fmtCurrency(Math.abs(node.previousYearAmount)) : '-'}
        </td>
        <td className="py-1 px-1.5 border-r border-gray-900 w-[52%] align-top text-[11px]" style={{ paddingLeft: `${(level * 0.8) + 0.3}rem` }}>
          {hasChildren ? (
            <button 
              onClick={() => setExpanded(!expanded)} 
              className="mr-1 w-3.5 h-3.5 inline-flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-[9px] cursor-pointer print:hidden select-none"
            >
              {expanded ? '-' : '+'}
            </button>
          ) : (
            <span className="mr-1 w-3.5 inline-block print:hidden"></span>
          )}
          <span className={`font-mono mr-1.5 ${isHead ? 'text-blue-900 font-bold' : 'text-gray-500 font-normal'}`}>
            {node.isGroup 
              ? (node.displayOrder && node.displayOrder > 0 ? `${node.displayOrder} -` : (node.code ? `${node.code} -` : '')) 
              : `${node.code || node.id} -`}
          </span>
          <span className={isHead ? 'text-gray-950 font-extrabold tracking-tight' : 'text-gray-800 font-normal'}>{node.name}</span>
        </td>
        <td className={`py-1 px-1.5 text-right w-[24%] align-top font-mono ${
          isHead ? 'font-bold text-gray-950 text-[11.5px]' : 'font-normal text-gray-700 text-[11px]'
        }`}>
          {fmtCurrency(Math.abs(node.amount))}
        </td>
      </tr>
      {expanded && hasChildren && node.children.map((child, idx) => (
        <TreeNode key={`${child.id}-${idx}`} node={child} level={level + 1} />
      ))}
    </React.Fragment>
  );
};

export default function ProfitAndLoss() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
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
      let url = '/api/Reports/ProfitAndLoss';
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (selectedBranchId !== 'all') params.append('branchId', selectedBranchId);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axios.get(url);
      setReportData(res.data);
    } catch (error) {
      console.error('Error fetching P&L', error);
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

  const handleExportExcel = () => {
    if (!reportData) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const rows: any[] = [];
    rows.push(['नफा-तोटा पत्रक (Profit & Loss Statement)']);
    rows.push([`कालावधी: ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`]);
    rows.push([]);
    rows.push(['खर्च बाजू (Expenses)', 'मागील वर्ष (₹)', 'चालू वर्ष (₹)', '', 'उत्पन्न बाजू (Income)', 'मागील वर्ष (₹)', 'चालू वर्ष (₹)']);

    const flattenForExport = (nodes: ReportNode[], level = 0): { name: string; prev: number; curr: number }[] => {
      let res: { name: string; prev: number; curr: number }[] = [];
      for (const n of nodes) {
        const numPrefix = n.isGroup 
          ? (n.displayOrder && n.displayOrder > 0 ? `${n.displayOrder} - ` : (n.code ? `${n.code} - ` : '')) 
          : `${n.code || n.id} - `;
        const prefix = '  '.repeat(level) + numPrefix;
        res.push({
          name: `${prefix}${n.name}`,
          prev: n.previousYearAmount || 0,
          curr: n.amount || 0
        });
        if (n.children && n.children.length > 0) {
          res = res.concat(flattenForExport(n.children, level + 1));
        }
      }
      return res;
    };

    const expList = flattenForExport(reportData.expenses || []);
    const incList = flattenForExport(reportData.incomes || []);

    const maxRows = Math.max(expList.length, incList.length);
    for (let i = 0; i < maxRows; i++) {
      const exp = expList[i];
      const inc = incList[i];
      rows.push([
        exp?.name || '',
        exp ? exp.prev : '',
        exp ? exp.curr : '',
        '',
        inc?.name || '',
        inc ? inc.prev : '',
        inc ? inc.curr : ''
      ]);
    }

    if (reportData.netProfit > 0 || reportData.previousYearNetProfit > 0) {
      rows.push([
        'चालू वर्षाचा निव्वळ नफा (Net Profit)',
        reportData.previousYearNetProfit || '',
        reportData.netProfit || '',
        '',
        '',
        '',
        ''
      ]);
    }
    if (reportData.netLoss > 0 || reportData.previousYearNetLoss > 0) {
      rows.push([
        '',
        '',
        '',
        '',
        'चालू वर्षाचा निव्वळ तोटा (Net Loss)',
        reportData.previousYearNetLoss || '',
        reportData.netLoss || ''
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'P&L Statement');
    XLSX.writeFile(wb, `Profit_And_Loss_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800 print:p-0 print:m-0 print:bg-white print:min-h-0">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 landscape;
              margin: 6mm 8mm 6mm 8mm;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              color: black !important;
              overflow: visible !important;
              height: auto !important;
            }
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: auto !important;
              height: auto !important;
              padding: 0 !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              overflow: visible !important;
              display: block !important;
            }
            .no-print {
              display: none !important;
            }
            .overflow-x-auto, .overflow-y-auto {
              overflow: visible !important;
            }
            table {
              page-break-inside: auto !important;
              break-inside: auto !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            thead {
              display: table-header-group !important;
            }
            tfoot {
              display: table-footer-group !important;
            }
          }
        `}
      </style>

      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5 max-w-[1280px] mx-auto">
        
        {/* Row 1: Title + Inline Filters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          
          {/* Left: Compact Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <TrendingUp size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>नफा-तोटा पत्रक</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Profit & Loss Statement)</span>
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
              disabled={!reportData}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${!reportData ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={!reportData}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${!reportData ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="A4 Landscape प्रिंट काढा"
            >
              <Printer size={12} />
              <span>प्रिंट (Landscape)</span>
            </button>
          </div>

        </div>

      </div>

      {/* Main Printable A4 Document Frame */}
      {reportData ? (
        <div 
          ref={reportRef} 
          className="print-area bg-white mx-auto max-w-[1280px] p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] print:min-h-0 print:border-none print:shadow-none print:p-0 print:m-0 flex flex-col justify-between text-xs"
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
                  नफा-तोटा पत्रक (Profit & Loss Statement)
                </h2>
              </div>

              {/* Date Tag on Right */}
              <div className="text-right text-xs font-bold text-gray-800">
                <span>दिनांक : </span>
                <span className="font-mono">{toDate ? formatDisplayDate(toDate) : ''} अखेर</span>
              </div>
            </div>

            {/* T-Format P&L Grid */}
            <div className="overflow-x-auto mt-2">
              <div className="flex w-full border border-gray-900">
                
                {/* Expenditure Side (Left / खर्च व तोटा बाजू) */}
                <div className="w-1/2 border-r border-gray-900 flex flex-col">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-900 bg-gray-100/90 text-gray-900 font-bold">
                        <th className="py-1.5 px-1 font-bold text-center border-r border-gray-900 w-[24%] text-[10px]">
                          मागील वर्ष<br/>{reportData.previousYearLabel || '३१/०३/२०२५'}
                        </th>
                        <th className="py-1.5 px-1 font-extrabold text-center border-r border-gray-900 w-[52%] text-xs">
                          खर्च व तोटा बाजू (Expenditure)
                        </th>
                        <th className="py-1.5 px-1 font-bold text-center w-[24%] text-[10px]">
                          चालू वर्ष<br/>{reportData.currentYearLabel || (toDate ? formatDisplayDate(toDate) : '३१/०३/२०२६')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="flex-1 divide-y divide-gray-200">
                      {reportData.expenses.map((node: ReportNode, i: number) => (
                        <TreeNode key={`exp-${node.id}-${i}`} node={node} level={0} />
                      ))}
                      {(reportData.netProfit > 0 || reportData.previousYearNetProfit > 0) && (
                        <tr className="border-b border-gray-900 font-bold text-gray-950 bg-emerald-50 text-[11px]">
                          <td className="py-1 px-1.5 text-right border-r border-gray-900 font-mono text-emerald-800">
                            {reportData.previousYearNetProfit ? fmtCurrency(reportData.previousYearNetProfit) : '-'}
                          </td>
                          <td className="py-1 px-1.5 border-r border-gray-900 text-center text-emerald-950">
                            चालू वर्षाचा निव्वळ नफा (Net Profit)
                          </td>
                          <td className="py-1 px-1.5 text-right font-mono font-black text-emerald-900">
                            {reportData.netProfit ? fmtCurrency(reportData.netProfit) : '-'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Income Side (Right / जमा व उत्पन्न बाजू) */}
                <div className="w-1/2 flex flex-col">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-gray-900 bg-gray-100/90 text-gray-900 font-bold">
                        <th className="py-1.5 px-1 font-bold text-center border-r border-gray-900 w-[24%] text-[10px]">
                          मागील वर्ष<br/>{reportData.previousYearLabel || '३१/०३/२०२५'}
                        </th>
                        <th className="py-1.5 px-1 font-extrabold text-center border-r border-gray-900 w-[52%] text-xs">
                          जमा व उत्पन्न बाजू (Income)
                        </th>
                        <th className="py-1.5 px-1 font-bold text-center w-[24%] text-[10px]">
                          चालू वर्ष<br/>{reportData.currentYearLabel || (toDate ? formatDisplayDate(toDate) : '३१/०३/२०२६')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="flex-1 divide-y divide-gray-200">
                      {reportData.incomes.map((node: ReportNode, i: number) => (
                        <TreeNode key={`inc-${node.id}-${i}`} node={node} level={0} />
                      ))}
                      {(reportData.netLoss > 0 || reportData.previousYearNetLoss > 0) && (
                        <tr className="border-b border-gray-900 font-bold text-gray-950 bg-rose-50 text-[11px]">
                          <td className="py-1 px-1.5 text-right border-r border-gray-900 font-mono text-rose-800">
                            {reportData.previousYearNetLoss ? fmtCurrency(reportData.previousYearNetLoss) : '-'}
                          </td>
                          <td className="py-1 px-1.5 border-r border-gray-900 text-center text-rose-950">
                            चालू वर्षाचा निव्वळ तोटा (Net Loss)
                          </td>
                          <td className="py-1 px-1.5 text-right font-mono font-black text-rose-900">
                            {reportData.netLoss ? fmtCurrency(reportData.netLoss) : '-'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Totals Row */}
              <div className="flex w-full border-b-2 border-l border-r border-gray-900 font-bold text-gray-950 bg-gray-200/90 text-[11px]">
                <div className="w-1/2 flex border-r border-gray-900">
                  <div className="w-[24%] py-1.5 px-1 text-right border-r border-gray-900 font-mono">
                    {fmtCurrency(reportData.totalPreviousYearExpense + (reportData.previousYearNetProfit > 0 ? reportData.previousYearNetProfit : 0))}
                  </div>
                  <div className="w-[52%] py-1.5 px-1 text-center border-r border-gray-900 font-bold">एकूण खर्च व नफा:</div>
                  <div className="w-[24%] py-1.5 px-1 text-right font-mono font-black text-gray-950">
                    ₹ {fmtCurrency(reportData.totalExpense + (reportData.netProfit > 0 ? reportData.netProfit : 0))}
                  </div>
                </div>
                <div className="w-1/2 flex">
                  <div className="w-[24%] py-1.5 px-1 text-right border-r border-gray-900 font-mono">
                    {fmtCurrency(reportData.totalPreviousYearIncome + (reportData.previousYearNetLoss > 0 ? reportData.previousYearNetLoss : 0))}
                  </div>
                  <div className="w-[52%] py-1.5 px-1 text-center border-r border-gray-900 font-bold">एकूण उत्पन्न:</div>
                  <div className="w-[24%] py-1.5 px-1 text-right font-mono font-black text-gray-950">
                    ₹ {fmtCurrency(reportData.totalIncome + (reportData.netLoss > 0 ? reportData.netLoss : 0))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Ultra-Compact Official Verification Signatures & Metadata Footer Section */}
          <div className="mt-3 pt-1.5 border-t border-gray-900 break-inside-avoid print:break-inside-avoid text-gray-950">
            
            {/* 3 Verification Signatures (Compact) */}
            <div className="grid grid-cols-3 gap-6 text-center text-[11px] font-bold">
              <div className="flex flex-col justify-end pt-4">
                <p className="border-t border-gray-800 mx-6 pt-0.5 font-extrabold text-gray-950">लेखापाल / मुख्य हिशोबनीस</p>
                <span className="text-[9.5px] text-gray-500 font-medium">(Accountant)</span>
              </div>

              <div className="flex flex-col justify-end pt-4">
                <p className="border-t border-gray-800 mx-6 pt-0.5 font-extrabold text-gray-950">शाखा व्यवस्थापक / मानद सचिव</p>
                <span className="text-[9.5px] text-gray-500 font-medium">(Manager / Secretary)</span>
              </div>

              <div className="flex flex-col justify-end pt-4">
                <p className="border-t border-gray-800 mx-6 pt-0.5 font-extrabold text-gray-950">चेअरमन / व्हाईस चेअरमन</p>
                <span className="text-[9.5px] text-gray-500 font-medium">(Chairman / Vice-Chairman)</span>
              </div>
            </div>

            {/* Ultra-Compact Bottom Print Timestamp & Certification Bar */}
            <div className="flex justify-between items-center text-[9px] font-medium text-gray-600 border-t border-gray-300 mt-2 pt-1 px-1 font-mono">
              <div>
                <span>मुद्रण दिनांक: </span>
                <span>{new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="ml-1 text-gray-400">| वापरकर्ता: {user?.username || 'Admin'}</span>
              </div>
              <div className="text-right text-gray-600 font-sans">
                {sansthaDetail?.sansthaName || ''} - SmartBanking CBS
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="bg-white p-12 text-center text-gray-500 rounded-sm border border-gray-200 shadow-xs max-w-5xl mx-auto">
          <TrendingUp size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">माहिती लोड होत आहे किंवा उपलब्ध नाही.</p>
        </div>
      )}

    </div>
  );
}

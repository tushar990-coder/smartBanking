import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  Coins, 
  Filter, 
  Layers, 
  Building2,
  Calendar,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface GoldJewelryItem {
  srNo: number;
  goldLoanDetailID: number;
  loanAccountID: number;
  loanAccountNo: string;
  memberID: number;
  memberCode: string;
  borrowerName: string;
  ornamentName: string;
  estimatedValue: number;
  netWeight: number;
  grossWeight: number;
  quantity: number;
  purity: number;
  goldRatePerGram: number;
  loanStatus: string;
  sanctionedAmount: number;
  principalBalance: number;
  loanDisbursementDate?: string;
}

interface GoldJewelryReportResponse {
  sansthaInfo: any;
  reportDate: string;
  branchName: string;
  items: GoldJewelryItem[];
  totalEstimatedValue: number;
  totalNetWeight: number;
  totalGrossWeight: number;
  totalQuantity: number;
  totalAccountsCount: number;
}

const fmtCurrency = (n: number) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const fmtWeight = (n: number) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
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

export default function GoldJewelryReport() {
  const [reportData, setReportData] = useState<GoldJewelryReportResponse | null>(null);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loanAccounts, setLoanAccounts] = useState<any[]>([]);
  
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSansthaDetails();
    fetchBranches();
    fetchLoanAccounts();
    handleFetchReport();
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const res = await fetch('/api/SansthaDetails');
      if (res.ok) {
        const details = await res.json();
        if (Array.isArray(details) && details.length > 0) {
          setSansthaDetail(details[0]);
        } else if (details && !Array.isArray(details)) {
          setSansthaDetail(details);
        }
      }
    } catch (err) {
      console.error('Error fetching sanstha details:', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/Branches');
      if (res.ok) {
        setBranches(await res.json());
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const fetchLoanAccounts = async () => {
    try {
      const res = await fetch('/api/LoanAccounts');
      if (res.ok) {
        const data = await res.json();
        setLoanAccounts(data || []);
      }
    } catch (err) {
      console.error('Error fetching loan accounts:', err);
    }
  };

  const handleFetchReport = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (selectedBranchId && selectedBranchId !== 'all') {
        params.branchId = parseInt(selectedBranchId);
      }
      if (selectedLoanId) {
        params.loanAccountId = parseInt(selectedLoanId);
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      if (asOfDate) {
        params.asOfDate = asOfDate;
      }

      const res = await axios.get('/api/Reports/GoldJewelryReport', { params });
      if (res.data) {
        setReportData(res.data);
        if (res.data.sansthaInfo) {
          setSansthaDetail(res.data.sansthaInfo);
        }
      }
    } catch (err) {
      console.error('Error fetching Gold Jewelry report:', err);
      alert('सोने जिन्नस अहवाल लोड करताना त्रुटी आली.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!reportData || !reportData.items || reportData.items.length === 0) {
      alert('एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }

    const excelRows = reportData.items.map((item, idx) => ({
      'अ.क्र.': idx + 1,
      'कर्ज खाते नं': item.loanAccountNo,
      'कर्जदाराचे नाव': item.borrowerName,
      'सोने जिन्नस तपशील': item.ornamentName,
      'किंमत (₹)': item.estimatedValue,
      'शुध्द वजन (ग्रॅम)': item.netWeight,
      'एकूण वजन (ग्रॅम)': item.grossWeight,
      'नग': item.quantity,
      'शुद्धता (Karat)': item.purity,
      'प्रति ग्रॅम दर (₹)': item.goldRatePerGram,
      'कर्ज स्थिती': item.loanStatus === 'Active' ? 'चालू' : 'बंद'
    }));

    // Summary Row
    excelRows.push({
      'अ.क्र.': '' as any,
      'कर्ज खाते नं': '',
      'कर्जदाराचे नाव': 'एकूण (Grand Total):',
      'सोने जिन्नस तपशील': `एकूण खाती: ${reportData.totalAccountsCount}`,
      'किंमत (₹)': reportData.totalEstimatedValue,
      'शुध्द वजन (ग्रॅम)': reportData.totalNetWeight,
      'एकूण वजन (ग्रॅम)': reportData.totalGrossWeight,
      'नग': reportData.totalQuantity,
      'शुद्धता (Karat)': '' as any,
      'प्रति ग्रॅम दर (₹)': '' as any,
      'कर्ज स्थिती': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'सोने जिन्नस यादी');
    
    const fileName = `Sone_Jinnas_Yadi_${asOfDate || new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const activeSanstha = reportData?.sansthaInfo || sansthaDetail;

  const filteredItems = (reportData?.items || []).filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      item.loanAccountNo.toLowerCase().includes(term) ||
      item.borrowerName.toLowerCase().includes(term) ||
      item.ornamentName.toLowerCase().includes(term) ||
      item.memberCode.toLowerCase().includes(term)
    );
  });

  const displayTotalEstimatedValue = filteredItems.reduce((sum, i) => sum + (i.estimatedValue || 0), 0);
  const displayTotalNetWeight = filteredItems.reduce((sum, i) => sum + (i.netWeight || 0), 0);
  const displayTotalGrossWeight = filteredItems.reduce((sum, i) => sum + (i.grossWeight || 0), 0);
  const displayTotalQuantity = filteredItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 10mm 8mm;
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
              <Coins size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>सोने जिन्नस यादी</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Gold Jewelry)</span>
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
                {branches.map((b: any) => (
                  <option key={b.branchID} value={b.branchID.toString()}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Loan Account */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">कर्ज खाते:</label>
              <select
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-32 sm:w-44"
              >
                <option value="">सर्व कर्ज खाती (All)</option>
                {loanAccounts.map((l: any) => (
                  <option key={l.loanAccountID} value={l.loanAccountID.toString()}>
                    {l.loanAccountNo} - {l.member ? `${l.member.firstName} ${l.member.lastName}` : `ID: ${l.loanAccountID}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Loan Status */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">स्थिती:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-24 sm:w-28"
              >
                <option value="Active">चालू (Active)</option>
                <option value="Closed">बंद (Closed)</option>
                <option value="All">सर्व (All)</option>
              </select>
            </div>

            {/* Date */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">दिनांक:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* Search View Button */}
            <button
              onClick={handleFetchReport}
              disabled={isLoading}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
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
              placeholder="खाते क्र., नाव किंवा दागिना शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              एकूण जिन्नस: <strong className="text-primary font-bold">{filteredItems.length}</strong>
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              एकूण वजन: <strong className="text-primary font-bold">{fmtWeight(displayTotalGrossWeight)} ग्रॅम</strong>
            </span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
              एकूण किंमत: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(displayTotalEstimatedValue)}</strong>
            </span>
          </div>
        </div>

      </div>

      {/* Main Printable A4 Document Frame */}
      <div 
        ref={reportRef} 
        className="print-area bg-white mx-auto max-w-4xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between"
      >
        <div>
          
          {/* Official Bank Header Box (Exact Reference Format) */}
          <div className="border border-gray-900 p-3 relative text-center">
            
            {/* Registration Top Bar */}
            <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
              <div>
                <span>रजि. नं. - </span>
                <span className="font-mono">{activeSanstha?.registrationNo || '-'}</span>
              </div>
              <div>
                <span>रजि. दि. - </span>
                <span className="font-mono">{activeSanstha?.registrationDate ? formatDisplayDate(activeSanstha.registrationDate) : '-'}</span>
              </div>
            </div>

            {/* Central Sanstha Name */}
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
              {activeSanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
            </h1>

            {/* Subtitle / Address */}
            <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
              {activeSanstha?.address || ''} {activeSanstha?.village ? `मु. ${activeSanstha.village}, ` : ''}{activeSanstha?.taluka ? `ता. ${activeSanstha.taluka}, ` : ''}{activeSanstha?.district ? `जि. ${activeSanstha.district}` : ''}
            </p>
          </div>

          {/* Report Title Banner Section */}
          <div className="mt-3 mb-2 flex items-center justify-between">
            {/* Hidden spacer to center the title */}
            <div className="w-28 hidden sm:block"></div>

            {/* Title Banner Box */}
            <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif text-center">
                सोने जिन्नस यादी
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>दिनांक : </span>
              <span className="font-mono">{formatDisplayDate(asOfDate)}</span>
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse border border-gray-900 text-xs">
              <thead>
                <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                  <th className="border border-gray-900 py-1.5 px-1 w-[6%] text-center">अ.क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-center">कर्ज खाते नं</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[26%] text-left">कर्जदाराचे नाव</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[22%] text-left">सोने जिन्नस तपशील</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[12%] text-right">किंमत (₹)</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[7%] text-right">शुध्द वजन</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[7%] text-right">एकूण वजन</th>
                  <th className="border border-gray-900 py-1.5 px-1 w-[6%] text-center">नग</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      निवडलेल्या कालावधीत व निकषांनुसार सोने जिन्नस नोंदी आढळल्या नाहीत.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={item.goldLoanDetailID || idx} className="hover:bg-slate-50 text-gray-900 text-[11.5px]">
                      <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">
                        {idx + 1}
                      </td>
                      <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-900">
                        {item.loanAccountNo}
                      </td>
                      <td className="border border-gray-900 py-1 px-2 font-medium">
                        {item.borrowerName}
                      </td>
                      <td className="border border-gray-900 py-1 px-2 font-medium">
                        {item.ornamentName || 'सोने दागिना'}
                      </td>
                      <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold">
                        {fmtCurrency(item.estimatedValue)}
                      </td>
                      <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                        {fmtWeight(item.netWeight)}
                      </td>
                      <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                        {fmtWeight(item.grossWeight)}
                      </td>
                      <td className="border border-gray-900 py-1 px-1 text-center font-mono font-semibold">
                        {item.quantity || 1}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              
              {/* Table Footer with Totals */}
              {filteredItems.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                    <td colSpan={4} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण (Grand Total):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-extrabold text-gray-950">
                      ₹ {fmtCurrency(displayTotalEstimatedValue)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-gray-950">
                      {fmtWeight(displayTotalNetWeight)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-gray-950">
                      {fmtWeight(displayTotalGrossWeight)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1 text-center font-mono font-extrabold text-gray-950">
                      {displayTotalQuantity}
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
            <p className="border-t border-gray-800 mx-4 pt-1">सुवर्णकार / व्हॅल्यूअर</p>
            <span className="text-[10px] text-gray-500 font-normal">(Gold Valuer)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">शाखा व्यवस्थापक / सचिव</p>
            <span className="text-[10px] text-gray-500 font-normal">(Manager / Secretary)</span>
          </div>
        </div>

      </div>

    </div>
  );
}

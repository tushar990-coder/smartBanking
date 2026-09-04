import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  Wallet, 
  Filter, 
  Calendar,
  Building2,
  BadgeIndianRupee
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface LoanDisbursementRegisterDto {
  loanDisbursementID: number;
  disbursementDate: string;
  loanAccountNo: string;
  cifNo?: string;
  memberCode?: string;
  borrowerName: string;
  loanType: string;
  sanctionedAmount: number;
  shareDeduction: number;
  depositDeduction: number;
  otherDeductions: number;
  netAmountPaid: number;
  guarantor1Name: string;
  guarantor2Name: string;
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

export default function LoanDisbursementRegister() {
  const [fromDate, setFromDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  const [reportMode, setReportMode] = useState<'All' | 'ByLoanType'>('All');
  const [selectedLoanType, setSelectedLoanType] = useState<string>('');
  const [loanTypes, setLoanTypes] = useState<string[]>([]);

  const [data, setData] = useState<LoanDisbursementRegisterDto[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSanstha();
    fetchBranches();
    fetchLoanRates();
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate, selectedBranchId]);

  const fetchSanstha = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data) {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSansthaDetail(res.data[0]);
        } else if (!Array.isArray(res.data)) {
          setSansthaDetail(res.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sanstha details', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLoanRates = async () => {
    try {
      const res = await axios.get('/api/LoanRates');
      if (Array.isArray(res.data)) {
        const types = Array.from(new Set(res.data.map((r: any) => r.shortName || r.loanType).filter(Boolean))) as string[];
        setLoanTypes(types);
      }
    } catch (err) {
      console.error('Failed to fetch loan rates', err);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        fromDate: fromDate,
        toDate: toDate
      };
      if (selectedBranchId && selectedBranchId !== 'all') {
        params.branchId = parseInt(selectedBranchId);
      }
      const res = await axios.get('/api/Reports/LoanDisbursementRegister', { params });
      setData(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch report data', err);
      alert('कर्ज वाटप नोंदवही लोड करताना त्रुटी आली.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter items based on Loan Type and Search Term
  const filteredData = data.filter(item => {
    if (reportMode === 'ByLoanType' && selectedLoanType && item.loanType !== selectedLoanType) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      item.loanAccountNo.toLowerCase().includes(term) ||
      item.borrowerName.toLowerCase().includes(term) ||
      (item.cifNo && item.cifNo.toLowerCase().includes(term)) ||
      (item.memberCode && item.memberCode.toLowerCase().includes(term)) ||
      item.loanType.toLowerCase().includes(term) ||
      (item.guarantor1Name && item.guarantor1Name.toLowerCase().includes(term)) ||
      (item.guarantor2Name && item.guarantor2Name.toLowerCase().includes(term))
    );
  });

  // Group data by loanType
  const groupedData: { [key: string]: LoanDisbursementRegisterDto[] } = {};
  filteredData.forEach(item => {
    const type = item.loanType || 'इतर (Other)';
    if (!groupedData[type]) {
      groupedData[type] = [];
    }
    groupedData[type].push(item);
  });

  // Calculate Grand Totals
  const totalSanctionedSum = filteredData.reduce((sum, r) => sum + (r.sanctionedAmount || 0), 0);
  const totalShareSum = filteredData.reduce((sum, r) => sum + (r.shareDeduction || 0), 0);
  const totalDepositSum = filteredData.reduce((sum, r) => sum + (r.depositDeduction || 0), 0);
  const totalOtherSum = filteredData.reduce((sum, r) => sum + (r.otherDeductions || 0), 0);
  const totalNetSum = filteredData.reduce((sum, r) => sum + (r.netAmountPaid || 0), 0);

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      alert('एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }

    const excelRows: any[] = [];
    let sr = 1;

    filteredData.forEach((r) => {
      excelRows.push({
        'अ.क्र.': sr++,
        'दिनांक': formatDisplayDate(r.disbursementDate),
        'कर्ज खाते नं': r.loanAccountNo,
        'कर्जदाराचे नाव': r.borrowerName,
        'कर्ज प्रकार': r.loanType,
        'मंजूर / वाटप रक्कम (₹)': r.sanctionedAmount || 0,
        'शेअर्स कपात (₹)': r.shareDeduction || 0,
        'ठेव कपात (₹)': r.depositDeduction || 0,
        'इतर कपात (₹)': r.otherDeductions || 0,
        'निव्वळ अदा रक्कम (₹)': r.netAmountPaid || 0,
        'जामीनदार १': r.guarantor1Name || '-',
        'जामीनदार २': r.guarantor2Name || '-'
      });
    });

    // Summary Row
    excelRows.push({
      'अ.क्र.': '' as any,
      'दिनांक': '',
      'कर्ज खाते नं': '',
      'कर्जदाराचे नाव': 'एकूण बेरीज (Grand Total):',
      'कर्ज प्रकार': `एकूण नोंदी: ${filteredData.length}`,
      'मंजूर / वाटप रक्कम (₹)': totalSanctionedSum,
      'शेअर्स कपात (₹)': totalShareSum,
      'ठेव कपात (₹)': totalDepositSum,
      'इतर कपात (₹)': totalOtherSum,
      'निव्वळ अदा रक्कम (₹)': totalNetSum,
      'जामीनदार १': '',
      'जामीनदार २': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'कर्ज वाटप रजिस्टर');
    
    const fileName = `Karj_Vatap_Register_${fromDate}_to_${toDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 landscape;
              margin: 6mm 6mm 8mm 6mm;
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
              <Wallet size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>कर्ज वाटप रजिस्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Loan Disbursement)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Branch */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranchId}
                disabled={hasGlobalBranch}
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

            {/* Mode: All / By Type */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">प्रकार:</label>
              <select
                value={reportMode}
                onChange={(e) => setReportMode(e.target.value as 'All' | 'ByLoanType')}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-24 sm:w-28 font-semibold text-primary"
              >
                <option value="All">सर्व (All)</option>
                <option value="ByLoanType">प्रकारानुसार</option>
              </select>
            </div>

            {/* Loan Type Filter (if ByLoanType) */}
            {reportMode === 'ByLoanType' && (
              <div className="flex items-center gap-1">
                <select
                  value={selectedLoanType}
                  onChange={(e) => setSelectedLoanType(e.target.value)}
                  className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-32 sm:w-40 font-semibold"
                >
                  {loanTypes.map((lt) => (
                    <option key={lt} value={lt}>{lt}</option>
                  ))}
                </select>
              </div>
            )}

            {/* From Date */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* Search View Button */}
            <button
              onClick={fetchData}
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
              disabled={filteredData.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={filteredData.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              placeholder="खाते क्र., कर्जदाराचे नाव किंवा जामीनदार शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              एकूण नोंदी: <strong className="text-primary font-bold">{filteredData.length}</strong>
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              मंजूर रक्कम: <strong className="text-primary font-bold">₹ {fmtCurrency(totalSanctionedSum)}</strong>
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              शेअर्स कपात: <strong className="text-amber-800 font-bold">₹ {fmtCurrency(totalShareSum)}</strong>
            </span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
              निव्वळ वाटप: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalNetSum)}</strong>
            </span>
          </div>
        </div>

      </div>

      {/* Main Printable A4 Document Frame */}
      <div 
        ref={reportRef} 
        className="print-area bg-white mx-auto max-w-7xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between"
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
            {/* Hidden spacer */}
            <div className="w-28 hidden sm:block"></div>

            {/* Title Banner Box */}
            <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif text-center">
                कर्ज वाटप रजिस्टर
              </h2>
            </div>

            {/* Date Range on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>कालावधी : </span>
              <span className="font-mono">{formatDisplayDate(fromDate)} ते {formatDisplayDate(toDate)}</span>
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse border border-gray-900 text-xs">
              <thead>
                <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                  <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[8%] text-center">दिनांक</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[9%] text-center">खाते नं.</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[18%] text-left">कर्जदाराचे नाव</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[11%] text-left">कर्ज प्रकार</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-right">मंजूर / वाटप रक्कम</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[8%] text-right">शेअर्स कपात</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[7%] text-right">ठेव कपात</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[7%] text-right">इतर कपात</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-right font-extrabold">निव्वळ अदा रक्कम</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[11%] text-left">जामीनदार १</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[11%] text-left">जामीनदार २</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      निवडलेल्या कालावधीत कोणतीही कर्ज वाटप नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  Object.keys(groupedData).map((typeStr) => {
                    const rows = groupedData[typeStr];
                    const subSanctioned = rows.reduce((sum, r) => sum + (r.sanctionedAmount || 0), 0);
                    const subShare = rows.reduce((sum, r) => sum + (r.shareDeduction || 0), 0);
                    const subDeposit = rows.reduce((sum, r) => sum + (r.depositDeduction || 0), 0);
                    const subOther = rows.reduce((sum, r) => sum + (r.otherDeductions || 0), 0);
                    const subNet = rows.reduce((sum, r) => sum + (r.netAmountPaid || 0), 0);

                    return (
                      <React.Fragment key={typeStr}>
                        {/* Section Sub-heading if All mode or multiple types */}
                        {Object.keys(groupedData).length > 1 && (
                          <tr className="bg-gray-50 font-bold text-gray-950 border-t border-b border-gray-900">
                            <td colSpan={12} className="py-1 px-2 text-left text-primary font-bold">
                              › कर्ज प्रकार: {typeStr} ({rows.length} खाती)
                            </td>
                          </tr>
                        )}

                        {rows.map((row, idx) => (
                          <tr key={row.loanDisbursementID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                            <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">
                              {idx + 1}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-center font-mono">
                              {formatDisplayDate(row.disbursementDate)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-center font-mono font-bold text-gray-900">
                              {row.loanAccountNo}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 font-medium">
                              {row.borrowerName}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-gray-700">
                              {row.loanType}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-gray-900">
                              {fmtCurrency(row.sanctionedAmount)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                              {fmtCurrency(row.shareDeduction)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                              {fmtCurrency(row.depositDeduction)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                              {fmtCurrency(row.otherDeductions)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">
                              {fmtCurrency(row.netAmountPaid)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-left text-[10.5px]">
                              {row.guarantor1Name || '-'}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-left text-[10.5px]">
                              {row.guarantor2Name || '-'}
                            </td>
                          </tr>
                        ))}

                        {/* Subtotal row if multiple types */}
                        {Object.keys(groupedData).length > 1 && (
                          <tr className="bg-gray-50/80 font-bold text-gray-900 border-t border-b border-gray-800 text-[11px]">
                            <td colSpan={5} className="border border-gray-900 py-1 px-2 text-right italic">
                              उप-एकूण ({typeStr}):
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold">
                              {fmtCurrency(subSanctioned)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                              {fmtCurrency(subShare)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                              {fmtCurrency(subDeposit)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                              {fmtCurrency(subOther)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">
                              {fmtCurrency(subNet)}
                            </td>
                            <td colSpan={2} className="border border-gray-900"></td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              
              {/* Grand Total Footer */}
              {filteredData.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                    <td colSpan={5} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण (Grand Total):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-extrabold text-gray-950">
                      ₹ {fmtCurrency(totalSanctionedSum)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-gray-950">
                      {fmtCurrency(totalShareSum)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-gray-950">
                      {fmtCurrency(totalDepositSum)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-gray-950">
                      {fmtCurrency(totalOtherSum)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-extrabold text-emerald-900">
                      ₹ {fmtCurrency(totalNetSum)}
                    </td>
                    <td colSpan={2} className="border border-gray-900"></td>
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
            <p className="border-t border-gray-800 mx-4 pt-1">कर्ज अधिकारी / तपासनीस</p>
            <span className="text-[10px] text-gray-500 font-normal">(Loan Officer / Inspector)</span>
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

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  Building2,
  Calendar,
  Layers,
  Coins
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface OverdueLoanRow {
  loanAccountID: number;
  loanAccountNo: string;
  loanType: string;
  customerID?: number;
  cifNo?: string;
  memberID: number;
  memberCode?: string;
  memberName: string;
  mobileNo: string;
  loanDate: string;
  sanctionedAmount: number;
  principalBalance: number;
  overduePrincipal: number;
  overdueSinceDate: string | null;
  overdueInstallmentsCount: number;
  installmentAmount: number;
  outstandingInterest: number;
  guarantorDetails?: string;
  maturityDate?: string | null;
  remarks: string;
}

interface SansthaInfo {
  sansthaID?: number;
  sansthaName?: string;
  address?: string;
  village?: string;
  taluka?: string;
  district?: string;
  pinCode?: string;
  contactNo?: string;
  email?: string;
  gstNo?: string;
  registrationNo?: string;
  registrationDate?: string;
  logoPath?: string | null;
}

interface OverdueLoanReportResponse {
  sansthaInfo: SansthaInfo | null;
  rows: OverdueLoanRow[];
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

export default function LoanOverdueReport() {
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<string>('All'); // All, Secured, Unsecured
  const [loanRateId, setLoanRateId] = useState<number | ''>('');
  const [loanRates, setLoanRates] = useState<any[]>([]);
  const [reportData, setReportData] = useState<OverdueLoanReportResponse | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBranches();
    fetchLoanRates();
    fetchReport();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchLoanRates = async () => {
    try {
      const response = await axios.get('/api/LoanRates');
      setLoanRates(response.data || []);
    } catch (err) {
      console.error('Error fetching loan rates', err);
    }
  };

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('toDate', toDate);
      params.append('filterType', filterType);
      if (loanRateId) {
        params.append('loanRateId', loanRateId.toString());
      }
      if (selectedBranchId && selectedBranchId !== 'all') {
        params.append('branchId', selectedBranchId);
      }
      const response = await axios.get(`/api/Reports/OverdueLoans?${params.toString()}`);
      setReportData(response.data);
    } catch (err) {
      console.error('Error fetching overdue loans report', err);
      alert('थकीत कर्ज अहवाल लोड करताना त्रुटी आली.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getBranchName = () => {
    if (!selectedBranchId || selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const b = branches.find((item: any) => item.branchID.toString() === selectedBranchId.toString());
    return b ? b.branchName : 'मुख्य शाखा';
  };

  const activeSanstha = reportData?.sansthaInfo;

  // Filter items by search term
  const filteredRows = (reportData?.rows || []).filter(row => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      row.loanAccountNo.toLowerCase().includes(term) ||
      row.memberName.toLowerCase().includes(term) ||
      (row.cifNo && row.cifNo.toLowerCase().includes(term)) ||
      (row.memberCode && row.memberCode.toLowerCase().includes(term)) ||
      (row.mobileNo && row.mobileNo.includes(term)) ||
      (row.guarantorDetails && row.guarantorDetails.toLowerCase().includes(term)) ||
      row.loanType.toLowerCase().includes(term)
    );
  });

  // Group by loan type
  const groupedRows: { [key: string]: OverdueLoanRow[] } = {};
  filteredRows.forEach(row => {
    const type = row.loanType || 'इतर कर्ज (Other Loans)';
    if (!groupedRows[type]) {
      groupedRows[type] = [];
    }
    groupedRows[type].push(row);
  });

  // Calculate Totals
  const totalSanctioned = filteredRows.reduce((sum, r) => sum + (r.sanctionedAmount || 0), 0);
  const totalPrincipalBal = filteredRows.reduce((sum, r) => sum + (r.principalBalance || 0), 0);
  const totalOverduePrincipal = filteredRows.reduce((sum, r) => sum + (r.overduePrincipal || 0), 0);
  const totalOutstandingInterest = filteredRows.reduce((sum, r) => sum + (r.outstandingInterest || 0), 0);
  const totalOverdueDemand = totalOverduePrincipal + totalOutstandingInterest;

  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }

    const excelRows: any[] = [];
    let sr = 1;

    filteredRows.forEach(r => {
      excelRows.push({
        'अ.क्र.': sr++,
        'कर्ज खाते नं': r.loanAccountNo,
        'कर्जदाराचे नाव': r.memberName,
        'मोबाईल नं': r.mobileNo || '-',
        'कर्ज प्रकार': r.loanType,
        'कर्ज दिनांक': formatDisplayDate(r.loanDate),
        'मंजूर रक्कम (₹)': r.sanctionedAmount || 0,
        'मुद्दल शिल्लक (₹)': r.principalBalance || 0,
        'थकीत मुद्दल (₹)': r.overduePrincipal || 0,
        'थकीत व्याज (₹)': r.outstandingInterest || 0,
        'एकूण थकीत मागणी (₹)': (r.overduePrincipal || 0) + (r.outstandingInterest || 0),
        'थकीत हप्ते': r.overdueInstallmentsCount || 0,
        'थकीत दिनांक': formatDisplayDate(r.overdueSinceDate),
        'जामीनदार तपशील': r.guarantorDetails || '-'
      });
    });

    // Summary Row
    excelRows.push({
      'अ.क्र.': '' as any,
      'कर्ज खाते नं': '',
      'कर्जदाराचे नाव': 'एकूण बेरीज (Grand Total):',
      'मोबाईल नं': `एकूण थकीत खाती: ${filteredRows.length}`,
      'कर्ज प्रकार': '',
      'कर्ज दिनांक': '',
      'मंजूर रक्कम (₹)': totalSanctioned,
      'मुद्दल शिल्लक (₹)': totalPrincipalBal,
      'थकीत मुद्दल (₹)': totalOverduePrincipal,
      'थकीत व्याज (₹)': totalOutstandingInterest,
      'एकूण थकीत मागणी (₹)': totalOverdueDemand,
      'थकीत हप्ते': '',
      'थकीत दिनांक': '',
      'जामीनदार तपशील': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'थकीत कर्ज यादी');
    
    const fileName = `Thakit_Karj_Yadi_${toDate}.xlsx`;
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
              <AlertTriangle size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>थकीत कर्ज यादी</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Overdue Loans List)</span>
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

            {/* Filter Type: All, Secured, Unsecured */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">तारण प्रकार:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
              >
                <option value="All">सर्व (All)</option>
                <option value="Secured">तारण कर्ज (Secured)</option>
                <option value="Unsecured">विनातारण (Unsecured)</option>
              </select>
            </div>

            {/* Loan Rate Scheme Filter */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">योजना:</label>
              <select
                value={loanRateId}
                onChange={(e) => setLoanRateId(e.target.value ? Number(e.target.value) : '')}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-32 sm:w-40 font-semibold"
              >
                <option value="">सर्व कर्ज योजना (All Schemes)</option>
                {loanRates.map((lr) => (
                  <option key={lr.loanRateID} value={lr.loanRateID}>
                    {lr.shortName || lr.loanType} ({lr.interestRate}%)
                  </option>
                ))}
              </select>
            </div>

            {/* As of Date */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">दिनांक:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* Search View Button */}
            <button
              onClick={fetchReport}
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
              disabled={filteredRows.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredRows.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={filteredRows.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredRows.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              थकीत खाती: <strong className="text-primary font-bold">{filteredRows.length}</strong>
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              मुद्दल शिल्लक: <strong className="text-primary font-bold">₹ {fmtCurrency(totalPrincipalBal)}</strong>
            </span>
            <span className="bg-red-50 px-2 py-0.5 rounded text-red-800 border border-red-200">
              थकीत मुद्दल: <strong className="text-red-700 font-bold">₹ {fmtCurrency(totalOverduePrincipal)}</strong>
            </span>
            <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-800 border border-amber-200">
              थकीत व्याज: <strong className="text-amber-800 font-bold">₹ {fmtCurrency(totalOutstandingInterest)}</strong>
            </span>
            <span className="bg-red-100/80 px-2 py-0.5 rounded text-red-950 border border-red-300 font-extrabold">
              एकूण थकीत: ₹ {fmtCurrency(totalOverdueDemand)}
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
                <span className="font-mono">{activeSanstha?.registrationNo || '-'}</span>
              </div>
              <div>
                <span>शाखा: </span>
                <span className="text-primary font-bold">{getBranchName()}</span>
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
            {/* Hidden spacer */}
            <div className="w-28 hidden sm:block"></div>

            {/* Title Banner Box */}
            <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif text-center">
                थकीत कर्ज यादी (Overdue Loans List)
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>दिनांक : </span>
              <span className="font-mono">{formatDisplayDate(toDate)} पर्यंत</span>
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse border border-gray-900 text-xs">
              <thead>
                <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                  <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[8%] text-center">खाते नं.</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[18%] text-left">कर्जदाराचे नाव व मोबाईल</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[10%] text-left">कर्ज प्रकार</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[7%] text-center">कर्ज दिनांक</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-right">मंजूर रक्कम</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-right">मुद्दल शिल्लक</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[9%] text-right text-red-900">थकीत मुद्दल</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[8%] text-right text-amber-900">थकीत व्याज</th>
                  <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-right font-extrabold text-red-950">एकूण थकीत</th>
                  <th className="border border-gray-900 py-1.5 px-1 w-[5%] text-center">हप्ते</th>
                  <th className="border border-gray-900 py-1.5 px-1.5 w-[11%] text-left">जामीनदार</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                      निवडलेल्या कालावधीत कोणतीही थकीत कर्ज नोंद आढळली नाही.
                    </td>
                  </tr>
                ) : (
                  Object.keys(groupedRows).map((typeStr) => {
                    const rows = groupedRows[typeStr];
                    const subSanctioned = rows.reduce((sum, r) => sum + (r.sanctionedAmount || 0), 0);
                    const subBal = rows.reduce((sum, r) => sum + (r.principalBalance || 0), 0);
                    const subOverduePrin = rows.reduce((sum, r) => sum + (r.overduePrincipal || 0), 0);
                    const subOverdueInt = rows.reduce((sum, r) => sum + (r.outstandingInterest || 0), 0);
                    const subTotalOverdue = subOverduePrin + subOverdueInt;

                    return (
                      <React.Fragment key={typeStr}>
                        {/* Section Sub-heading if multiple types */}
                        {Object.keys(groupedRows).length > 1 && (
                          <tr className="bg-gray-50 font-bold text-gray-950 border-t border-b border-gray-900">
                            <td colSpan={12} className="py-1 px-2 text-left text-primary font-bold">
                              › कर्ज प्रकार: {typeStr} ({rows.length} थकीत खाती)
                            </td>
                          </tr>
                        )}

                        {rows.map((row, idx) => (
                          <tr key={row.loanAccountID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                            <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">
                              {idx + 1}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-center font-mono font-bold text-gray-900">
                              {row.loanAccountNo}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 font-medium">
                              <div>{row.memberName}</div>
                              {row.mobileNo && <div className="text-[10px] text-gray-500 font-mono">{row.mobileNo}</div>}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-gray-700">
                              {row.loanType}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-center font-mono">
                              {formatDisplayDate(row.loanDate)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono text-gray-900">
                              {fmtCurrency(row.sanctionedAmount)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-gray-900">
                              {fmtCurrency(row.principalBalance)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-red-700">
                              {fmtCurrency(row.overduePrincipal)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono text-amber-800">
                              {fmtCurrency(row.outstandingInterest)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-extrabold text-red-900 bg-red-50/50">
                              {fmtCurrency((row.overduePrincipal || 0) + (row.outstandingInterest || 0))}
                            </td>
                            <td className="border border-gray-900 py-1 px-1 text-center font-mono font-bold text-red-600">
                              {row.overdueInstallmentsCount || 0}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-left text-[10px] text-gray-700">
                              {row.guarantorDetails || '-'}
                            </td>
                          </tr>
                        ))}

                        {/* Subtotal row if multiple types */}
                        {Object.keys(groupedRows).length > 1 && (
                          <tr className="bg-gray-50/80 font-bold text-gray-900 border-t border-b border-gray-800 text-[11px]">
                            <td colSpan={5} className="border border-gray-900 py-1 px-2 text-right italic">
                              उप-एकूण ({typeStr}):
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold">
                              {fmtCurrency(subSanctioned)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold">
                              {fmtCurrency(subBal)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-red-700">
                              {fmtCurrency(subOverduePrin)}
                            </td>
                            <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold text-amber-800">
                              {fmtCurrency(subOverdueInt)}
                            </td>
                            <td className="border border-gray-900 py-1 px-2 text-right font-mono font-extrabold text-red-900">
                              {fmtCurrency(subTotalOverdue)}
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
              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                    <td colSpan={5} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण थकीत बेरीज (Grand Total):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-extrabold text-gray-950">
                      ₹ {fmtCurrency(totalSanctioned)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-extrabold text-gray-950">
                      ₹ {fmtCurrency(totalPrincipalBal)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-extrabold text-red-700">
                      ₹ {fmtCurrency(totalOverduePrincipal)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-amber-800">
                      ₹ {fmtCurrency(totalOutstandingInterest)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-red-950 bg-red-100/60">
                      ₹ {fmtCurrency(totalOverdueDemand)}
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
            <p className="border-t border-gray-800 mx-4 pt-1">लिपिक / वसुली अधिकारी</p>
            <span className="text-[10px] text-gray-500 font-normal">(Recovery Officer / Clerk)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">कर्ज अधिकारी / लेखापाल</p>
            <span className="text-[10px] text-gray-500 font-normal">(Loan Officer / Accountant)</span>
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

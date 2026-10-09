import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CbsReportLayout, { formatDisplayDate, CbsPaperSize } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  Calendar, 
  Wallet, 
  Filter, 
  Layers, 
  Building2, 
  FileSpreadsheet,
  LayoutGrid
} from 'lucide-react';

interface SansthaDetails {
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

interface Branch {
  branchID: number;
  branchName: string;
}

interface LoanRate {
  loanRateID: number;
  loanType: string;
  shortName?: string;
}

export interface LoanOutstandingReportRow {
  srNo: number;
  loanAccountID: number;
  loanRateID: number;
  loanType: string;
  loanAccountNo: string;
  borrowerName: string;
  memberCode: string;
  disbursementDate: string | null;
  disbursementDateDisplay: string;
  sanctionedAmount: number; // कर्ज रक्कम (वाटप रक्कम)
  outstandingAmount: number; // येणे बाकी (निवडलेल्या तारखेअखेर) / शिल्लक रक्कम
  principalPaid?: number; // आज अखेर मुद्दल जमा
  interestPaid?: number; // आज अखेर व्याज जमा
  penaltyInterestPaid?: number; // दंड व्याज जमा
  interestRate: number;
  status: string;
}

export interface LoanOutstandingSchemeGroup {
  loanRateID: number;
  loanType: string;
  accountCount: number;
  totalSanctionedAmount: number;
  totalOutstandingAmount: number;
  totalPrincipalPaid?: number;
  totalInterestPaid?: number;
  totalPenaltyInterestPaid?: number;
  accounts: LoanOutstandingReportRow[];
}

export interface LoanOutstandingReportResponse {
  sansthaInfo?: SansthaDetails;
  asOnDate: string;
  asOnDateDisplay: string;
  selectedLoanRateId?: number | null;
  selectedLoanTypeName: string;
  totalAccounts: number;
  grandTotalSanctionedAmount: number;
  grandTotalOutstandingAmount: number;
  grandTotalPrincipalPaid?: number;
  grandTotalInterestPaid?: number;
  grandTotalPenaltyInterestPaid?: number;
  rows: LoanOutstandingReportRow[];
  schemeGroups: LoanOutstandingSchemeGroup[];
}

// Convert English numerals to Marathi Devanagari numerals
export const toMarathiDigits = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  const marathiDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return str.replace(/[0-9]/g, d => marathiDigits[parseInt(d, 10)]);
};

const fmtCurrency = (n: number | null | undefined, isMarathi: boolean = false) => {
  const formatted = (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return isMarathi ? toMarathiDigits(formatted) : formatted;
};

export default function LoanOutstandingReport() {
  const isMountedRef = useRef(true);

  // Filters State
  const [asOnDate, setAsOnDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [selectedLoanRateId, setSelectedLoanRateId] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [includeZeroBalance, setIncludeZeroBalance] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayMode, setDisplayMode] = useState<'grouped' | 'flat'>('grouped');
  const [digitMode, setDigitMode] = useState<'marathi' | 'english'>('marathi');
  const [reportFormat, setReportFormat] = useState<'format2' | 'format1'>('format2');
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-landscape');

  // Master Data State
  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sansthaInfo, setSansthaInfo] = useState<SansthaDetails | null>(null);

  // Report Data State
  const [reportData, setReportData] = useState<LoanOutstandingReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    isMountedRef.current = true;
    fetchInitialMasters();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchInitialMasters = async () => {
    try {
      const [ratesRes, branchRes, sansthaRes] = await Promise.allSettled([
        axios.get('/api/LoanRates'),
        axios.get('/api/Branches'),
        axios.get('/api/SansthaDetails')
      ]);

      if (isMountedRef.current) {
        if (ratesRes.status === 'fulfilled' && Array.isArray(ratesRes.value.data)) {
          setLoanRates(ratesRes.value.data);
        }
        if (branchRes.status === 'fulfilled' && Array.isArray(branchRes.value.data)) {
          setBranches(branchRes.value.data);
        }
        if (sansthaRes.status === 'fulfilled') {
          const sData = Array.isArray(sansthaRes.value.data) ? sansthaRes.value.data[0] : sansthaRes.value.data;
          setSansthaInfo(sData || null);
        }
      }
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  };

  const loadReport = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: any = {
        asOnDate: asOnDate,
        includeZeroBalance: includeZeroBalance
      };

      if (selectedLoanRateId && selectedLoanRateId !== 'all') {
        params.loanRateId = parseInt(selectedLoanRateId, 10);
      }

      if (selectedBranchId && selectedBranchId !== 'all') {
        params.branchId = parseInt(selectedBranchId, 10);
      }

      const res = await axios.get<LoanOutstandingReportResponse>('/api/Reports/LoanOutstandingReport', { params });
      if (isMountedRef.current) {
        setReportData(res.data);
        if (res.data.sansthaInfo) {
          setSansthaInfo(res.data.sansthaInfo);
        }
      }
    } catch (err: any) {
      console.error('Error fetching Loan Outstanding Report:', err);
      if (isMountedRef.current) {
        setError(err.response?.data?.message || 'कर्ज येणे बाकी अहवाल लोड करताना त्रुटी आली.');
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

  // Filter rows by search term
  const allRows = reportData?.rows || [];
  const filteredRows = allRows.filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (r.loanAccountNo || '').toLowerCase().includes(term) ||
      (r.borrowerName || '').toLowerCase().includes(term) ||
      (r.loanType || '').toLowerCase().includes(term) ||
      (r.memberCode || '').toLowerCase().includes(term)
    );
  });

  // Calculate Grouped data if displayMode === 'grouped'
  const filteredGroups: LoanOutstandingSchemeGroup[] = [];
  if (reportData?.schemeGroups) {
    reportData.schemeGroups.forEach(grp => {
      const matchedAccounts = grp.accounts.filter(r => {
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase().trim();
        return (
          (r.loanAccountNo || '').toLowerCase().includes(term) ||
          (r.borrowerName || '').toLowerCase().includes(term) ||
          (r.loanType || '').toLowerCase().includes(term) ||
          (r.memberCode || '').toLowerCase().includes(term)
        );
      });

      if (matchedAccounts.length > 0) {
        filteredGroups.push({
          ...grp,
          accountCount: matchedAccounts.length,
          totalSanctionedAmount: matchedAccounts.reduce((sum, a) => sum + (a.sanctionedAmount || 0), 0),
          totalOutstandingAmount: matchedAccounts.reduce((sum, a) => sum + (a.outstandingAmount || 0), 0),
          totalPrincipalPaid: matchedAccounts.reduce((sum, a) => sum + (a.principalPaid || 0), 0),
          totalInterestPaid: matchedAccounts.reduce((sum, a) => sum + (a.interestPaid || 0), 0),
          totalPenaltyInterestPaid: matchedAccounts.reduce((sum, a) => sum + (a.penaltyInterestPaid || 0), 0),
          accounts: matchedAccounts
        });
      }
    });
  }

  // Current grand totals based on active search filter
  const totalFilteredSanctioned = filteredRows.reduce((sum, r) => sum + (r.sanctionedAmount || 0), 0);
  const totalFilteredPrincipalPaid = filteredRows.reduce((sum, r) => sum + (r.principalPaid || 0), 0);
  const totalFilteredInterestPaid = filteredRows.reduce((sum, r) => sum + (r.interestPaid || 0), 0);
  const totalFilteredPenaltyPaid = filteredRows.reduce((sum, r) => sum + (r.penaltyInterestPaid || 0), 0);
  const totalFilteredOutstanding = filteredRows.reduce((sum, r) => sum + (r.outstandingAmount || 0), 0);

  // Selected scheme title
  const currentSchemeName = selectedLoanRateId === 'all'
    ? 'सर्व कर्ज प्रकार (एकत्रित)'
    : loanRates.find(lr => String(lr.loanRateID) === String(selectedLoanRateId))?.loanType || 'कर्ज प्रकार';

  const isMarathiDigits = digitMode === 'marathi';

  // Excel Export
  const handleExportExcel = () => {
    if (!filteredRows || filteredRows.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी कोणताही डेटा उपलब्ध नाही.');
      return;
    }

    const rowsForExport: any[] = [];
    if (reportFormat === 'format2') {
      // 10-column Detailed Format (मुद्दल, व्याज, दंड व्याज व शिल्लक)
      filteredRows.forEach((r, idx) => {
        rowsForExport.push({
          'अनु.क्र.': idx + 1,
          'कर्ज प्रकार': r.loanType,
          'कर्ज खाते नं.': r.loanAccountNo,
          'कर्जदाराचे नाव': r.borrowerName,
          'कर्ज दिनांक': r.disbursementDateDisplay || formatDisplayDate(r.disbursementDate),
          'कर्ज रक्कम': r.sanctionedAmount,
          'आज अखेर मुद्दल जमा': r.principalPaid || 0,
          'आज अखेर व्याज जमा': r.interestPaid || 0,
          'दंड व्याज जमा': r.penaltyInterestPaid || 0,
          'शिल्लक रक्कम': r.outstandingAmount
        });
      });

      // Total Row
      rowsForExport.push({
        'अनु.क्र.': 'एकूण',
        'कर्ज प्रकार': `एकूण खाती: ${filteredRows.length}`,
        'कर्ज खाते नं.': '',
        'कर्जदाराचे नाव': '',
        'कर्ज दिनांक': '',
        'कर्ज रक्कम': totalFilteredSanctioned,
        'आज अखेर मुद्दल जमा': totalFilteredPrincipalPaid,
        'आज अखेर व्याज जमा': totalFilteredInterestPaid,
        'दंड व्याज जमा': totalFilteredPenaltyPaid,
        'शिल्लक रक्कम': totalFilteredOutstanding
      });
    } else {
      // Format 1: 7-column Compact Format
      filteredRows.forEach((r, idx) => {
        rowsForExport.push({
          'अनु. क्र.': idx + 1,
          'कर्ज प्रकार': r.loanType,
          'कर्ज नं.': r.loanAccountNo,
          'कर्जदाराचे नाव': r.borrowerName,
          'कर्ज दिनांक': r.disbursementDateDisplay || formatDisplayDate(r.disbursementDate),
          'कर्ज रक्कम (वाटप)': r.sanctionedAmount,
          'येणे बाकी': r.outstandingAmount
        });
      });

      // Add Total Row
      rowsForExport.push({
        'अनु. क्र.': 'एकूण',
        'कर्ज प्रकार': `एकूण खाती: ${filteredRows.length}`,
        'कर्ज नं.': '',
        'कर्जदाराचे नाव': '',
        'कर्ज दिनांक': '',
        'कर्ज रक्कम (वाटप)': totalFilteredSanctioned,
        'येणे बाकी': totalFilteredOutstanding
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rowsForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'कर्ज येणे बाकी');
    XLSX.writeFile(workbook, `Loan_Outstanding_Report_${reportFormat}_${asOnDate}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // 1. CBS Standard Unified Toolbar Controls (Passed to CbsReportLayout)
  const filterToolbarControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* Format Selector: General vs Yene Baki V Vasuli */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-bold text-blue-900 whitespace-nowrap">फॉरमॅट:</label>
        <select
          value={reportFormat}
          onChange={e => setReportFormat(e.target.value as 'format2' | 'format1')}
          className="h-6 border border-blue-400 bg-blue-50/80 text-blue-950 font-bold rounded px-1 text-[10.5px] focus:outline-none focus:border-primary shadow-2xs cursor-pointer"
        >
          <option value="format1">जनरल (General)</option>
          <option value="format2">येणे बाकी व वसुली रिपोर्ट (Yene Baki V Vasuli)</option>
        </select>
      </div>

      {/* As-On Date Picker */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">दिनांक:</label>
        <input
          type="date"
          value={asOnDate}
          onChange={e => setAsOnDate(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1.5 text-[10.5px] font-mono bg-white focus:outline-none focus:border-primary"
        />
      </div>

      {/* Loan Scheme Selector */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">कर्ज प्रकार:</label>
        <select
          value={selectedLoanRateId}
          onChange={e => setSelectedLoanRateId(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary max-w-[160px]"
        >
          <option value="all">सर्व कर्ज प्रकार (एकत्रित)</option>
          {loanRates.map(rate => (
            <option key={rate.loanRateID} value={rate.loanRateID}>
              {rate.loanType}
            </option>
          ))}
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

      {/* Numerals Format Toggle: Marathi Devnagari vs English */}
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

      {/* Zero balance toggle */}
      <label className="inline-flex items-center text-[10px] text-slate-600 font-medium cursor-pointer ml-1">
        <input
          type="checkbox"
          checked={includeZeroBalance}
          onChange={e => setIncludeZeroBalance(e.target.checked)}
          className="rounded border-slate-300 text-primary w-3 h-3 mr-1"
        />
        शून्य बाकी
      </label>

      {/* In-table Search */}
      <div className="relative w-32 sm:w-40">
        <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="कर्जदार / खाते क्र..."
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

  // 2. Compact CBS Summary Strip (Inside Paper Container)
  const summaryBanner = (
    <div className={`grid ${reportFormat === 'format2' ? 'grid-cols-2 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4'} gap-2 items-center text-xs`}>
      <div>
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">कर्ज योजना / प्रकार</span>
        <strong className="text-primary text-[11px] truncate block">{currentSchemeName}</strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">एकूण कर्जदार खाती</span>
        <strong className="text-slate-900 font-mono text-[11px]">
          {isMarathiDigits ? toMarathiDigits(filteredRows.length) : filteredRows.length} खाती
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">एकूण कर्ज वाटप</span>
        <strong className="text-slate-900 font-mono text-[11px]">
          ₹ {fmtCurrency(totalFilteredSanctioned, isMarathiDigits)}
        </strong>
      </div>

      {reportFormat === 'format2' && (
        <>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-semibold">आज अखेर मुद्दल जमा</span>
            <strong className="text-emerald-800 font-mono text-[11px]">
              ₹ {fmtCurrency(totalFilteredPrincipalPaid, isMarathiDigits)}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase font-semibold">आज अखेर व्याज जमा</span>
            <strong className="text-indigo-800 font-mono text-[11px]">
              ₹ {fmtCurrency(totalFilteredInterestPaid, isMarathiDigits)}
            </strong>
          </div>
        </>
      )}

      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9px] uppercase font-semibold">
          {reportFormat === 'format2' ? 'शिल्लक येणे बाकी' : 'दिनांक अखेर येणे बाकी'}
        </span>
        <strong className="text-slate-950 font-mono text-xs font-black">
          ₹ {fmtCurrency(totalFilteredOutstanding, isMarathiDigits)}
        </strong>
      </div>
    </div>
  );

  // Period text formatted in Marathi / English
  const asOnDateFormatted = formatDisplayDate(asOnDate);
  const periodTextStr = `दिनांक : ${isMarathiDigits ? toMarathiDigits(asOnDateFormatted) : asOnDateFormatted}(अखेर)`;

  // Sanstha Info text
  const sansthaDisplayName = sansthaInfo?.sansthaName || 'श्री गुरुदेव पगारदार नोकरांची सहकारी पतसंस्था मर्यादित';
  const regNoText = sansthaInfo?.registrationNo || 'SAN/BNK/११२ ऑफ १९६५';
  const regDateRaw = sansthaInfo?.registrationDate ? formatDisplayDate(sansthaInfo.registrationDate) : '०१/१०/१९६५';
  const regDateText = isMarathiDigits ? toMarathiDigits(regDateRaw) : regDateRaw;
  const addressLine = [
    sansthaInfo?.village || 'सांगली',
    sansthaInfo?.taluka ? `ता - ${sansthaInfo.taluka}` : 'ता - मिरज',
    sansthaInfo?.district ? `जि - ${sansthaInfo.district}` : 'जि - सांगली'
  ].filter(Boolean).join(' ');

  // 3. Custom Boxed Header for Format 2 (Exact match to uploaded photo)
  const format2CustomHeader = (
    <div className="mb-2">
      {/* Outer Border Box */}
      <div className="border border-slate-900 px-3 py-2 text-center text-slate-950 bg-white">
        {/* Top Header Row with Registration No & Date */}
        <div className="flex justify-between items-center text-xs font-semibold px-1 mb-1">
          <div className="text-left font-medium">
            <span>रजि. नं. - </span>
            <span className="font-semibold">{isMarathiDigits ? toMarathiDigits(regNoText) : regNoText}</span>
          </div>
          <div className="text-right font-medium">
            <span>रजि. दि. - </span>
            <span className="font-semibold">{regDateText}</span>
          </div>
        </div>

        {/* Institution Name */}
        <h1 className="text-base sm:text-lg font-bold tracking-wide text-slate-950 mt-0.5">
          {sansthaDisplayName}
        </h1>

        {/* Village / Taluka / District Subtitle */}
        <p className="text-xs font-semibold text-slate-800 mt-0.5">
          {addressLine}
        </p>
      </div>

      {/* Pill Box in Center: 'कर्ज येणे बाकी' and Date on right */}
      <div className="flex justify-between items-center my-2 relative px-1">
        <div className="flex-1"></div>
        <div className="inline-block border border-slate-400 bg-white px-10 py-1 text-center font-bold text-sm text-slate-950 shadow-sm rounded-xs tracking-wider">
          कर्ज येणे बाकी
        </div>
        <div className="flex-1 text-right text-xs font-bold text-slate-900 font-mono">
          {periodTextStr}
        </div>
      </div>
    </div>
  );

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      titleStyle="classic-badge"
      reportTitle={reportFormat === 'format2' ? 'येणे बाकी व वसुली रिपोर्ट' : 'कर्ज येणे बाकी (जनरल)'}
      reportSubtitle={currentSchemeName}
      periodText={periodTextStr}
      sansthaInfo={sansthaInfo}
      customHeader={reportFormat === 'format2' ? format2CustomHeader : undefined}
      summaryBanner={summaryBanner}
      signatureTier="4-tier"
      signatureTitles={[
        { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Branch Head)' },
        { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' }
      ]}
      onExportExcel={handleExportExcel}
      onPrint={handlePrint}
      extraToolbarControls={filterToolbarControls}
      isLoading={isLoading}
      hasData={filteredRows.length > 0}
      preparedBy="Admin"
      emptyState={
        <div className="bg-white p-12 text-center text-slate-500 rounded-xs border border-slate-200 shadow-xs max-w-4xl mx-auto">
          <Wallet size={36} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs text-slate-700">कोणत्याही कर्ज खात्यांची माहिती उपलब्ध नाही.</p>
          <p className="text-[11px] text-slate-500 mt-1">कृपया वरील फिल्टर निवडून 'पहा' बटणावर क्लिक करा.</p>
        </div>
      }
    >
      {/* 4. CONDITIONAL TABLE RENDERING BASED ON SELECTED FORMAT */}
      {reportFormat === 'format2' ? (
        /* ========================================================================= */
        /* FORMET 2: सविस्तर कर्ज येणे बाकी (१० कॉलम्स - फोटोप्रमाणे)                   */
        /* [अनु.क्र. | कर्ज प्रकार | कर्ज खाते नं. | कर्जदाराचे नाव | कर्ज दिनांक |    */
        /*  कर्ज रक्कम | आज अखेर मुद्दल जमा | आज अखेर व्याज जमा | दंड व्याज जमा | शिल्लक रक्कम] */
        /* ========================================================================= */
        <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
          <thead>
            <tr className="bg-white text-slate-950 border-b border-slate-900 text-center font-bold text-[11px] sm:text-xs">
              <th className="border border-slate-900 py-1.5 px-1 w-[4.5%] text-center">अनु.क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-left">कर्ज प्रकार</th>
              <th className="border border-slate-900 py-1.5 px-1 w-[7.5%] text-center leading-tight">
                कर्ज खाते<br />नं.
              </th>
              <th className="border border-slate-900 py-1.5 px-2 text-left">कर्जदाराचे नाव</th>
              <th className="border border-slate-900 py-1.5 px-1 w-[9%] text-center">कर्ज दिनांक</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right">कर्ज रक्कम</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right leading-tight">
                आज अखेर<br />मुद्दल जमा
              </th>
              <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right leading-tight">
                आज अखेर<br />व्याज जमा
              </th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-right leading-tight">
                दंड व्याज जमा
              </th>
              <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right font-extrabold">
                शिल्लक रक्कम
              </th>
            </tr>
          </thead>
          <tbody>
            {displayMode === 'grouped' && filteredGroups.length > 0 ? (
              // Grouped by Scheme with Sub-totals
              filteredGroups.map(grp => (
                <React.Fragment key={grp.loanRateID}>
                  {/* Scheme Group Header */}
                  <tr className="bg-slate-50 font-bold border-t border-b border-slate-900 text-[11px]">
                    <td colSpan={10} className="border border-slate-900 py-1 px-3 text-primary">
                      {grp.loanType} {selectedLoanRateId === 'all' && (
                        <span className="text-slate-600 font-normal ml-2">
                          (खाते संख्या: {isMarathiDigits ? toMarathiDigits(grp.accountCount) : grp.accountCount})
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Scheme Account Rows */}
                  {grp.accounts.map((row, idx) => {
                    const srText = isMarathiDigits ? toMarathiDigits(idx + 1) : String(idx + 1);
                    const accNoText = isMarathiDigits ? toMarathiDigits(row.loanAccountNo) : row.loanAccountNo;
                    const dateRaw = row.disbursementDateDisplay || formatDisplayDate(row.disbursementDate);
                    const dateText = isMarathiDigits ? toMarathiDigits(dateRaw) : dateRaw;

                    return (
                      <tr key={row.loanAccountID} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                          {srText}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-left">
                          {row.loanType}
                        </td>
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold">
                          {accNoText}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-left font-medium">
                          {row.borrowerName}
                        </td>
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                          {dateText}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono">
                          {fmtCurrency(row.sanctionedAmount, isMarathiDigits)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono">
                          {fmtCurrency(row.principalPaid, isMarathiDigits)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono">
                          {fmtCurrency(row.interestPaid, isMarathiDigits)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-right font-mono">
                          {fmtCurrency(row.penaltyInterestPaid, isMarathiDigits)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold">
                          {fmtCurrency(row.outstandingAmount, isMarathiDigits)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Scheme Sub-total Row */}
                  <tr className="bg-slate-100 font-bold text-slate-950 border-t border-b border-slate-900 text-[11px]">
                    <td colSpan={3} className="border border-slate-900 py-1.5 px-2 text-center">
                      उप-एकूण ({grp.loanType})
                    </td>
                    <td colSpan={2} className="border border-slate-900 py-1.5 px-2 text-left text-[10.5px]">
                      खाती: {isMarathiDigits ? toMarathiDigits(grp.accountCount) : grp.accountCount}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                      {fmtCurrency(grp.totalSanctionedAmount, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                      {fmtCurrency(grp.totalPrincipalPaid, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                      {fmtCurrency(grp.totalInterestPaid, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-1.5 text-right font-mono">
                      {fmtCurrency(grp.totalPenaltyInterestPaid, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold">
                      {fmtCurrency(grp.totalOutstandingAmount, isMarathiDigits)}
                    </td>
                  </tr>
                </React.Fragment>
              ))
            ) : (
              // Flat View
              filteredRows.map((row, idx) => {
                const srText = isMarathiDigits ? toMarathiDigits(idx + 1) : String(idx + 1);
                const accNoText = isMarathiDigits ? toMarathiDigits(row.loanAccountNo) : row.loanAccountNo;
                const dateRaw = row.disbursementDateDisplay || formatDisplayDate(row.disbursementDate);
                const dateText = isMarathiDigits ? toMarathiDigits(dateRaw) : dateRaw;

                return (
                  <tr key={row.loanAccountID} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                      {srText}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-left">
                      {row.loanType}
                    </td>
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold">
                      {accNoText}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-left font-medium">
                      {row.borrowerName}
                    </td>
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                      {dateText}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right font-mono">
                      {fmtCurrency(row.sanctionedAmount, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right font-mono">
                      {fmtCurrency(row.principalPaid, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right font-mono">
                      {fmtCurrency(row.interestPaid, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1 px-1.5 text-right font-mono">
                      {fmtCurrency(row.penaltyInterestPaid, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold">
                      {fmtCurrency(row.outstandingAmount, isMarathiDigits)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            {/* Grand Total Row */}
            <tr className="bg-slate-200 font-bold text-slate-950 border-t-2 border-b-2 border-slate-900 text-xs">
              <td colSpan={3} className="border border-slate-900 py-2 px-2 text-center uppercase tracking-wider">
                सर्वसमावेशक एकूण (Grand Total)
              </td>
              <td colSpan={2} className="border border-slate-900 py-2 px-2 text-left">
                एकूण खाती: {isMarathiDigits ? toMarathiDigits(filteredRows.length) : filteredRows.length}
              </td>
              <td className="border border-slate-900 py-2 px-2 text-right font-mono">
                {fmtCurrency(totalFilteredSanctioned, isMarathiDigits)}
              </td>
              <td className="border border-slate-900 py-2 px-2 text-right font-mono">
                {fmtCurrency(totalFilteredPrincipalPaid, isMarathiDigits)}
              </td>
              <td className="border border-slate-900 py-2 px-2 text-right font-mono">
                {fmtCurrency(totalFilteredInterestPaid, isMarathiDigits)}
              </td>
              <td className="border border-slate-900 py-2 px-1.5 text-right font-mono">
                {fmtCurrency(totalFilteredPenaltyPaid, isMarathiDigits)}
              </td>
              <td className="border border-slate-900 py-2 px-2 text-right font-mono font-black text-sm">
                {fmtCurrency(totalFilteredOutstanding, isMarathiDigits)}
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        /* ========================================================================= */
        /* FORMET 1: संक्षिप्त कर्ज येणे बाकी (७ कॉलम्स - Standard CBS)             */
        /* [अनु. क्र. | कर्ज प्रकार | कर्ज नं. | कर्जदाराचे नाव | कर्ज दिनांक | कर्ज रक्कम | येणे बाकी] */
        /* ========================================================================= */
        <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-950 border-b border-slate-900 text-center font-bold">
              <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">अनु. क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[17%] text-left">कर्ज प्रकार</th>
              <th className="border border-slate-900 py-1.5 px-1 w-[8%] text-center">कर्ज नं.</th>
              <th className="border border-slate-900 py-1.5 px-3 text-left">कर्जदाराचे नाव</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-center">कर्ज दिनांक</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right">कर्ज रक्कम</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right font-extrabold">येणे बाकी</th>
            </tr>
          </thead>
          <tbody>
            {displayMode === 'grouped' && filteredGroups.length > 0 ? (
              // Grouped by Loan Scheme with Scheme Subtotals
              filteredGroups.map(grp => (
                <React.Fragment key={grp.loanRateID}>
                  {/* Scheme Group Section Header */}
                  <tr className="bg-slate-50 font-bold border-t border-b border-slate-900 text-[11px]">
                    <td colSpan={7} className="border border-slate-900 py-1 px-3 text-primary">
                      {grp.loanType} {selectedLoanRateId === 'all' && (
                        <span className="text-slate-600 font-normal ml-2">
                          (खाते संख्या: {isMarathiDigits ? toMarathiDigits(grp.accountCount) : grp.accountCount})
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Scheme Account Rows */}
                  {grp.accounts.map((row, idx) => {
                    const srText = isMarathiDigits ? toMarathiDigits(idx + 1) : String(idx + 1);
                    const accNoText = isMarathiDigits ? toMarathiDigits(row.loanAccountNo) : row.loanAccountNo;
                    const dateRaw = row.disbursementDateDisplay || formatDisplayDate(row.disbursementDate);
                    const dateText = isMarathiDigits ? toMarathiDigits(dateRaw) : dateRaw;

                    return (
                      <tr key={row.loanAccountID} className="hover:bg-slate-50 text-slate-900 text-[11.5px]">
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                          {srText}
                        </td>
                        <td className="border border-slate-900 py-1 px-2">
                          {row.loanType}
                        </td>
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold">
                          {accNoText}
                        </td>
                        <td className="border border-slate-900 py-1 px-3 font-medium">
                          {row.borrowerName}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                          {dateText}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 cbs-num-cell font-mono">
                          {fmtCurrency(row.sanctionedAmount, isMarathiDigits)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-bold">
                          {fmtCurrency(row.outstandingAmount, isMarathiDigits)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Scheme Sub-total Row */}
                  <tr className="bg-slate-100 font-bold text-slate-950 border-t border-b border-slate-900 text-[11.5px]">
                    <td colSpan={3} className="border border-slate-900 py-1.5 px-2 text-center">
                      उप-एकूण ({grp.loanType})
                    </td>
                    <td colSpan={2} className="border border-slate-900 py-1.5 px-3 text-left text-[10.5px]">
                      खाती: {isMarathiDigits ? toMarathiDigits(grp.accountCount) : grp.accountCount}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell font-mono">
                      {fmtCurrency(grp.totalSanctionedAmount, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-bal font-extrabold">
                      {fmtCurrency(grp.totalOutstandingAmount, isMarathiDigits)}
                    </td>
                  </tr>
                </React.Fragment>
              ))
            ) : (
              // Flat List View
              filteredRows.map((row, idx) => {
                const srText = isMarathiDigits ? toMarathiDigits(idx + 1) : String(idx + 1);
                const accNoText = isMarathiDigits ? toMarathiDigits(row.loanAccountNo) : row.loanAccountNo;
                const dateRaw = row.disbursementDateDisplay || formatDisplayDate(row.disbursementDate);
                const dateText = isMarathiDigits ? toMarathiDigits(dateRaw) : dateRaw;

                return (
                  <tr key={row.loanAccountID} className="hover:bg-slate-50 text-slate-900 text-[11.5px]">
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                      {srText}
                    </td>
                    <td className="border border-slate-900 py-1 px-2">
                      {row.loanType}
                    </td>
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold">
                      {accNoText}
                    </td>
                    <td className="border border-slate-900 py-1 px-3 font-medium">
                      {row.borrowerName}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                      {dateText}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 cbs-num-cell font-mono">
                      {fmtCurrency(row.sanctionedAmount, isMarathiDigits)}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-bold">
                      {fmtCurrency(row.outstandingAmount, isMarathiDigits)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            {/* Grand Total Row */}
            <tr className="bg-slate-200 font-bold text-slate-950 border-t-2 border-b-2 border-slate-900 text-xs">
              <td colSpan={3} className="border border-slate-900 py-2 px-2 text-center uppercase tracking-wider">
                सर्वसमावेशक एकूण (Grand Total)
              </td>
              <td colSpan={2} className="border border-slate-900 py-2 px-3 text-left">
                एकूण खाती: {isMarathiDigits ? toMarathiDigits(filteredRows.length) : filteredRows.length}
              </td>
              <td className="border border-slate-900 py-2 px-2 cbs-num-cell font-mono text-xs">
                {fmtCurrency(totalFilteredSanctioned, isMarathiDigits)}
              </td>
              <td className="border border-slate-900 py-2 px-2 cbs-num-cell cbs-amt-bal font-black text-sm">
                {fmtCurrency(totalFilteredOutstanding, isMarathiDigits)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </CbsReportLayout>
  );
}

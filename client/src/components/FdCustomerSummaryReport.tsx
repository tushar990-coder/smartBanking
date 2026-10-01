import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CbsReportLayout, { formatDisplayDate, CbsPaperSize } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  Users, 
  Receipt, 
  Calendar,
  Building2,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export interface FdCustomerSummaryAccountItem {
  fdAccountID: number;
  accountNo: string;
  legacyAccountNumber?: string | null;
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  schemeName: string;
}

export interface FdCustomerSummaryRow {
  srNo: number;
  customerID: number;
  cifNo: string;
  accountNo: string;
  customerName: string;
  mobileNo?: string;
  depositAmount: number;
  maturityAmount: number;
  fdCount: number;
  accounts: FdCustomerSummaryAccountItem[];
}

export interface FdCustomerSummaryResponse {
  asOfDate: string;
  branchID: number;
  totalCustomers: number;
  totalDepositAmount: number;
  totalMaturityAmount: number;
  totalFdCount: number;
  data: FdCustomerSummaryRow[];
}

interface FdCustomerSummaryReportProps {
  initialBranchId?: string | number;
  initialAsOfDate?: string;
  onNavigate?: (tab: string, params?: any) => void;
}

export default function FdCustomerSummaryReport({
  initialBranchId,
  initialAsOfDate,
  onNavigate
}: FdCustomerSummaryReportProps) {
  const { user } = useAuth();

  // Paper & layout settings
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-portrait');
  const [summaryViewMode, setSummaryViewMode] = useState<'DualColumn' | 'Detailed'>('DualColumn');
  const [signatureTier, setSignatureTier] = useState<'3-tier' | '4-tier'>('3-tier');
  const [rowsPerColumn, setRowsPerColumn] = useState<number>(30);

  // Filter States
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    if (initialAsOfDate) return initialAsOfDate;
    return new Date().toISOString().split('T')[0];
  });

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const [branchId, setBranchId] = useState<string>(() => {
    if (initialBranchId) return String(initialBranchId);
    if (globalBranchStr && globalBranchStr !== 'all') return globalBranchStr;
    return '1';
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [reportData, setReportData] = useState<FdCustomerSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedCustomers, setExpandedCustomers] = useState<Record<number, boolean>>({});

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchSanstha();
    fetchBranches();
    loadReportData();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchSanstha = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data && isMountedRef.current) {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSansthaDetail(res.data[0]);
        } else if (!Array.isArray(res.data)) {
          setSansthaDetail(res.data);
        }
      }
    } catch (err) {
      console.error('Error fetching sanstha details:', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/branches');
      if (res.data && isMountedRef.current) {
        setBranches(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  };

  const loadReportData = async (targetDate?: string, targetBranch?: string) => {
    setIsLoading(true);
    setError('');
    try {
      const qDate = targetDate || asOfDate;
      const qBranch = targetBranch || branchId;
      const bParam = qBranch && qBranch !== 'all' ? `&branchID=${qBranch}` : '';
      const res = await axios.get<FdCustomerSummaryResponse>(
        `/api/reports/fd-customer-summary?asOfDate=${qDate}${bParam}`
      );
      if (isMountedRef.current) {
        setReportData(res.data || null);
      }
    } catch (err: any) {
      console.error('Error loading FD Customer Summary:', err);
      if (isMountedRef.current) {
        setError(err.response?.data?.message || 'मुदतबंद ठेव यादी लोड करण्यात त्रुटी आली.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const toggleCustomerExpand = (custId: number) => {
    setExpandedCustomers(prev => ({
      ...prev,
      [custId]: !prev[custId]
    }));
  };

  // Filtered rows by search term (search by CIF, Customer Name, Mobile)
  const rows: FdCustomerSummaryRow[] = reportData?.data || [];
  const filteredRows = rows.filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const cif = (r.cifNo || r.accountNo || '').toLowerCase();
    const name = (r.customerName || '').toLowerCase();
    const mob = (r.mobileNo || '');
    return cif.includes(term) || name.includes(term) || mob.includes(term);
  });

  const totalFilteredDeposit = filteredRows.reduce((sum, r) => sum + (Number(r.depositAmount) || 0), 0);
  const totalFilteredFdCount = filteredRows.reduce((sum, r) => sum + (Number(r.fdCount) || 0), 0);
  const avgDepositPerCust = filteredRows.length > 0 ? totalFilteredDeposit / filteredRows.length : 0;

  // Selected branch name display
  const selectedBranchName = branchId === 'all'
    ? 'सर्व शाखा (All Branches)'
    : branches.find(b => String(b.branchID) === String(branchId))?.branchName || `शाखा #${branchId}`;

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!filteredRows || filteredRows.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी कोणताही डेटा उपलब्ध नाही.');
      return;
    }

    const exportRows: any[] = [];
    filteredRows.forEach((r, idx) => {
      exportRows.push({
        'अ.नं.': idx + 1,
        'खाते / CIF क्र.': r.cifNo || r.accountNo,
        'खातेदाराचे नाव': r.customerName,
        'मोबाईल क्र.': r.mobileNo || '',
        'एकूण ठेवी (पावत्या)': r.fdCount,
        'एकूण ठेव रक्कम (₹)': Number(r.depositAmount) || 0,
        'मुदतपूर्ती रक्कम (₹)': Number(r.maturityAmount) || 0
      });

      // Include detail receipt sub-rows if present
      if (r.accounts && r.accounts.length > 0) {
        r.accounts.forEach((acc, aIdx) => {
          exportRows.push({
            'अ.नं.': '',
            'खाते / CIF क्र.': `  ↳ पावती क्र: ${acc.accountNo}${acc.legacyAccountNumber ? ` (जुनी: ${acc.legacyAccountNumber})` : ''}`,
            'खातेदाराचे नाव': `     योजना: ${acc.schemeName} | ठेव दि.: ${formatDisplayDate(acc.openingDate)} | मुदत दि.: ${formatDisplayDate(acc.maturityDate)}`,
            'मोबाईल क्र.': `व्याज दर: ${acc.interestRate}%`,
            'एकूण ठेवी (पावत्या)': '',
            'एकूण ठेव रक्कम (₹)': Number(acc.depositAmount) || 0,
            'मुदतपूर्ती रक्कम (₹)': Number(acc.maturityAmount) || 0
          });
        });
      }
    });

    // Grand total row
    exportRows.push({
      'अ.नं.': 'एकूण',
      'खाते / CIF क्र.': `एकूण खातेदार: ${filteredRows.length}`,
      'खातेदाराचे नाव': '',
      'मोबाईल क्र.': '',
      'एकूण ठेवी (पावत्या)': totalFilteredFdCount,
      'एकूण ठेव रक्कम (₹)': totalFilteredDeposit,
      'मुदतपूर्ती रक्कम (₹)': reportData?.totalMaturityAmount || 0
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'मुदतबंद_ठेव_यादी');
    XLSX.writeFile(wb, `Mudatband_Thev_Yadi_${asOfDate}.xlsx`);
  };

  // 1. CBS Standard Summary Banner (4-column executive metric strip)
  const summaryBanner = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण खातेदार</span>
        <strong className="text-primary font-mono text-xs">
          {filteredRows.length.toLocaleString('en-IN')}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण ठेव पावत्या</span>
        <strong className="text-blue-700 font-mono text-xs">
          {totalFilteredFdCount.toLocaleString('en-IN')} ठेवी
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण एकत्रित ठेव रक्कम</span>
        <strong className="text-emerald-700 font-mono text-xs">
          ₹ {fmtCurrency(totalFilteredDeposit)}
        </strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सरासरी ठेव / खातेदार</span>
        <strong className="text-slate-900 font-mono text-xs">
          ₹ {fmtCurrency(avgDepositPerCust)}
        </strong>
      </div>
    </div>
  );

  // 2. Extra Toolbar Controls (Compliance badge, Date picker, Branch, Search, Layout mode)
  const toolbarControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* Official CBS Reference Badge */}
      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold shrink-0">
        ✓ CBS Standard Reference Model v2.4
      </span>

      {/* As-of Date Filter */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
        <Calendar size={11} className="text-slate-500" />
        <label className="text-[10px] text-slate-600 font-semibold">अखेर तारीख:</label>
        <input
          type="date"
          value={asOfDate}
          onChange={(e) => {
            setAsOfDate(e.target.value);
            loadReportData(e.target.value, branchId);
          }}
          className="h-5 text-[11px] font-mono border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-bold"
        />
      </div>

      {/* Branch Selector */}
      {branches.length > 1 && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <Building2 size={11} className="text-slate-500" />
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              loadReportData(asOfDate, e.target.value);
            }}
            className="h-5 text-[10.5px] border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-semibold cursor-pointer"
          >
            <option value="all">सर्व शाखा (All)</option>
            {branches.map(b => (
              <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Quick Search */}
      <div className="relative w-44">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="CIF, नाव शोधा..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-6 pr-1.5 h-6 text-[10.5px] border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:border-primary"
        />
      </div>

      {/* View Layout Switcher */}
      <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300 text-[10px]">
        <button
          type="button"
          onClick={() => setSummaryViewMode('DualColumn')}
          className={`px-1.5 py-0.5 rounded-xs font-semibold cursor-pointer transition-colors ${
            summaryViewMode === 'DualColumn' 
              ? 'bg-blue-800 text-white font-bold shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="२-स्तंभी फोटो प्रिंट फॉरमॅट"
        >
          २-स्तंभी (फोटो)
        </button>
        <button
          type="button"
          onClick={() => setSummaryViewMode('Detailed')}
          className={`px-1.5 py-0.5 rounded-xs font-semibold cursor-pointer transition-colors ${
            summaryViewMode === 'Detailed' 
              ? 'bg-blue-800 text-white font-bold shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title="पावतीनिहाय ड्रिलडाऊन"
        >
          तपशीलवार
        </button>
      </div>

      {/* Column Capacity Selector (Rows per column) */}
      {summaryViewMode === 'DualColumn' && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <label className="text-[10px] text-slate-600 font-semibold whitespace-nowrap">स्तंभ क्षमता:</label>
          <select
            value={rowsPerColumn}
            onChange={(e) => setRowsPerColumn(Number(e.target.value))}
            className="h-5 text-[10.5px] border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-semibold cursor-pointer"
            title="एका स्तंभात कमाल ओळी (३० ओळी पूर्ण झाल्यावर उजवा स्तंभ सुरू होईल)"
          >
            <option value={25}>२५ ओळी</option>
            <option value={30}>३० ओळी (मानक)</option>
            <option value={35}>३५ ओळी</option>
            <option value={40}>४० ओळी</option>
          </select>
        </div>
      )}

      {/* Refresh Button */}
      <button
        type="button"
        onClick={() => loadReportData()}
        disabled={isLoading}
        className="h-6 bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 rounded border border-slate-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
        title="रिफ्रेश करा"
      >
        <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm no-print">
          {error}
        </div>
      )}

      <CbsReportLayout
        defaultPaperSize={paperSize}
        allowPaperSizeToggle={true}
        reportTitle="मुदतबंद ठेव यादी"
        reportSubtitle="Customer-wise Fixed Deposit Summary"
        periodText={`दि. ${formatDisplayDate(asOfDate)} अखेर`}
        branchName={selectedBranchName}
        sansthaInfo={sansthaDetail}
        summaryBanner={summaryBanner}
        signatureTier={signatureTier}
        signatureTitles={[
          { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
          { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
          { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' }
        ]}
        onExportExcel={handleExportExcel}
        extraToolbarControls={toolbarControls}
        isLoading={isLoading}
        hasData={filteredRows.length > 0}
        preparedBy={user?.username || 'Admin'}
        emptyState={
          <div className="py-12 text-center text-slate-500 font-medium border border-dashed border-slate-300 rounded bg-white">
            <Users size={32} className="mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-xs font-bold text-slate-700">दिलेल्या अखेर तारखेनुसार कोणतीही मुदत ठेव आढळली नाही.</p>
          </div>
        }
      >
        {/* ==========================================================
            VIEW 1: DUAL-COLUMN PRINT LAYOUT (Reference Photo Identical)
            Repeats Left & Right: अ.नं. | खाते नं. | खातेदाराचे नाव | रक्कम
            ========================================================== */}
        {summaryViewMode === 'DualColumn' && (
          <div className="overflow-x-auto space-y-6">
            {(() => {
              const ROWS_PER_PAGE = rowsPerColumn * 2;
              const totalPages = Math.ceil(filteredRows.length / ROWS_PER_PAGE) || 1;

              return Array.from({ length: totalPages }).map((_, pageIdx) => {
                const pageStart = pageIdx * ROWS_PER_PAGE;
                const pageRows = filteredRows.slice(pageStart, pageStart + ROWS_PER_PAGE);

                // Left column fills first (1..rowsPerColumn)
                const leftRows = pageRows.slice(0, rowsPerColumn);

                // Right column fills next (rowsPerColumn + 1 .. rowsPerColumn * 2)
                const rightRows = pageRows.slice(rowsPerColumn, ROWS_PER_PAGE);

                // Row count to render in this table
                const rowCount = Math.max(leftRows.length, rightRows.length);
                const isLastPage = pageIdx === totalPages - 1;

                return (
                  <div 
                    key={`cbs-summary-page-${pageIdx}`}
                    className={`${pageIdx > 0 ? 'print:break-before-page pt-3 border-t-2 border-dashed border-slate-300' : ''}`}
                  >
                    {totalPages > 1 && (
                      <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-600 mb-1 px-1">
                        <span>पान क्र. {pageIdx + 1} / {totalPages}</span>
                        <span>नोंदी: {pageStart + 1} ते {pageStart + pageRows.length} (एकूण {filteredRows.length})</span>
                      </div>
                    )}

                    <table className="cbs-table w-full border-collapse border-2 border-slate-950 text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-950 border-b-2 border-slate-950 text-center font-bold text-[11px]">
                          {/* Left Column Header */}
                          <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.नं.</th>
                          <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center font-mono">खाते नं.</th>
                          <th className="border border-slate-900 py-1.5 px-2.5 w-[24%] text-left">खातेदाराचे नाव</th>
                          <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right font-extrabold">रक्कम</th>
                          
                          {/* Divider / Right Column Header */}
                          <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center border-l-2 border-l-slate-950">अ.नं.</th>
                          <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center font-mono">खाते नं.</th>
                          <th className="border border-slate-900 py-1.5 px-2.5 w-[24%] text-left">खातेदाराचे नाव</th>
                          <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right font-extrabold">रक्कम</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: rowCount }).map((_, i) => {
                          const left = leftRows[i];
                          const right = rightRows[i];
                          const leftSr = pageStart + i + 1;
                          const rightSr = pageStart + rowsPerColumn + i + 1;

                          return (
                            <tr key={`cbs-dual-row-${pageIdx}-${i}`} className="hover:bg-slate-50 text-slate-900 text-[11px] leading-tight">
                              {/* Left Data Cells */}
                              <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                                {left ? leftSr : ''}
                              </td>
                              <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-900">
                                {left ? (left.cifNo || left.accountNo) : ''}
                              </td>
                              <td className="border border-slate-900 py-1 px-2.5 text-left font-medium truncate max-w-[200px]" title={left?.customerName}>
                                {left ? left.customerName : ''}
                              </td>
                              <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950">
                                {left ? Number(left.depositAmount).toFixed(2) : ''}
                              </td>

                              {/* Right Data Cells (only filled when right side entries exist, otherwise blank) */}
                              <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium border-l-2 border-l-slate-950">
                                {right ? rightSr : ''}
                              </td>
                              <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-900">
                                {right ? (right.cifNo || right.accountNo) : ''}
                              </td>
                              <td className="border border-slate-900 py-1 px-2.5 text-left font-medium truncate max-w-[200px]" title={right?.customerName}>
                                {right ? right.customerName : ''}
                              </td>
                              <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950">
                                {right ? Number(right.depositAmount).toFixed(2) : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {isLastPage && (
                        <tfoot>
                          <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-950 text-xs">
                            <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                              एकूण खातेदार: <strong className="font-mono">{filteredRows.length}</strong>
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                              ₹ {fmtCurrency(totalFilteredDeposit)}
                            </td>
                            <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider border-l-2 border-l-slate-950">
                              एकूण ठेवी: <strong className="font-mono">{totalFilteredFdCount}</strong>
                            </td>
                            <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                              ₹ {fmtCurrency(totalFilteredDeposit)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* ==========================================================
            VIEW 2: DETAILED INTERACTIVE DRILLDOWN
            Shows each customer row with expandable "+" for all FD receipts
            ========================================================== */}
        {summaryViewMode === 'Detailed' && (
          <div className="overflow-x-auto">
            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-950 border-b border-slate-900 text-center font-bold text-[11px]">
                  <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">#</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center font-mono">खाते / CIF क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-left">खातेदाराचे पूर्ण नाव</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center font-mono">मोबाईल क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">ठेवी संख्या</th>
                  <th className="border border-slate-900 py-1.5 px-2.5 w-[14%] text-right font-extrabold">एकूण ठेव रक्कम (₹)</th>
                  <th className="border border-slate-900 py-1.5 px-2.5 w-[14%] text-right font-bold">मुदतपूर्ती रक्कम (₹)</th>
                  <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center no-print">तपशील</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, idx) => {
                  const isExpanded = Boolean(expandedCustomers[r.customerID]);
                  return (
                    <React.Fragment key={`cust-${r.customerID || idx}`}>
                      <tr className={`hover:bg-slate-50 text-slate-900 text-[11px] ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}>
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-primary">
                          {r.cifNo || r.accountNo}
                        </td>
                        <td className="border border-slate-900 py-1 px-3 text-left font-bold text-slate-900">
                          {r.customerName}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px]">
                          {r.mobileNo || '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-800">
                          <span className="bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded border border-blue-200">
                            {r.fdCount} ठेवी
                          </span>
                        </td>
                        <td className="border border-slate-900 py-1 px-2.5 text-right font-mono font-bold text-emerald-800">
                          {fmtCurrency(r.depositAmount)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2.5 text-right font-mono font-bold text-slate-900">
                          {fmtCurrency(r.maturityAmount)}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center no-print">
                          <button
                            type="button"
                            onClick={() => toggleCustomerExpand(r.customerID)}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold border border-slate-300 flex items-center justify-center gap-0.5 mx-auto cursor-pointer"
                            title="पावतीनिहाय तपशील पहा"
                          >
                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            <span>{isExpanded ? 'बंद' : 'उघडा'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Expandable nested table of all active FD receipts for this customer */}
                      {isExpanded && r.accounts && r.accounts.length > 0 && (
                        <tr className="bg-blue-50/50">
                          <td colSpan={8} className="border border-slate-900 p-2.5">
                            <div className="bg-white rounded border border-blue-200 shadow-2xs p-2">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 mb-1.5 pb-1 border-b border-blue-100">
                                <Receipt size={13} className="text-primary" />
                                <span>{r.customerName} - एकूण सक्रिय मुदत ठेव पावत्या ({r.accounts.length})</span>
                              </div>
                              <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-800 font-bold text-center">
                                    <th className="border border-slate-300 p-1">पावती क्र.</th>
                                    <th className="border border-slate-300 p-1">योजना</th>
                                    <th className="border border-slate-300 p-1">ठेव दिनांक</th>
                                    <th className="border border-slate-300 p-1">व्याज दर</th>
                                    <th className="border border-slate-300 p-1 text-right">ठेव रक्कम (₹)</th>
                                    <th className="border border-slate-300 p-1">मुदत दिनांक</th>
                                    <th className="border border-slate-300 p-1 text-right">मुदत रक्कम (₹)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {r.accounts.map((acc, aIdx) => (
                                    <tr key={acc.fdAccountID || aIdx} className="hover:bg-blue-50/30">
                                      <td className="border border-slate-300 p-1 text-center font-mono font-bold text-primary">
                                        {acc.accountNo}
                                        {acc.legacyAccountNumber && (
                                          <span className="ml-1 text-[9.5px] bg-amber-50 text-amber-900 border border-amber-300 px-1 py-0.2 rounded font-mono font-bold" title="जुना पावती क्र.">
                                            (जुनी: {acc.legacyAccountNumber})
                                          </span>
                                        )}
                                      </td>
                                      <td className="border border-slate-300 p-1 text-slate-700">{acc.schemeName}</td>
                                      <td className="border border-slate-300 p-1 text-center font-mono">{formatDisplayDate(acc.openingDate)}</td>
                                      <td className="border border-slate-300 p-1 text-center font-mono font-bold text-slate-900">{acc.interestRate}%</td>
                                      <td className="border border-slate-300 p-1 text-right font-mono font-bold text-emerald-800">{fmtCurrency(acc.depositAmount)}</td>
                                      <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{formatDisplayDate(acc.maturityDate)}</td>
                                      <td className="border border-slate-300 p-1 text-right font-mono font-bold text-slate-900">{fmtCurrency(acc.maturityAmount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    एकूण बेरीज ({filteredRows.length} खातेदार):
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-center font-mono font-black text-blue-900">
                    {totalFilteredFdCount} ठेवी
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2.5 text-right font-mono font-black text-emerald-950 bg-emerald-100/40">
                    ₹ {fmtCurrency(totalFilteredDeposit)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2.5 text-right font-mono font-black text-slate-950 bg-slate-200/40">
                    ₹ {fmtCurrency(reportData?.totalMaturityAmount || 0)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-1.5 no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CbsReportLayout>
    </div>
  );
}

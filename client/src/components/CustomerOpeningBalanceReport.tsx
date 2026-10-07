import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CbsReportLayout, { CbsPaperSize } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  Layers,
  Table as TableIcon,
  ChevronRight,
  Filter
} from 'lucide-react';

interface LedgerOption {
  ledgerID: number;
  ledgerName: string;
  accountType: string;
  entryCount: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  netBalanceType: string;
}

interface CustomerOpeningBalanceRow {
  srNo: number;
  customerOpeningBalanceID: number;
  customerID: number;
  cifNo: string;
  legacyCustomerNo?: string | null;
  memberNo?: string | null;
  customerName: string;
  mobileNo?: string | null;
  village?: string | null;
  address?: string | null;
  ledgerID: number;
  ledgerName: string;
  amount: number;
  balanceType: string;
  debitAmount: number;
  creditAmount: number;
  createdOn: string;
}

interface ReportDataResponse {
  selectedLedgerId: number | null;
  selectedLedgerName: string;
  totalCustomers: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  netBalanceType: string;
  rows: CustomerOpeningBalanceRow[];
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function CustomerOpeningBalanceReport() {
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [ledgersWithEntries, setLedgersWithEntries] = useState<LedgerOption[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('all');
  const [balanceTypeFilter, setBalanceTypeFilter] = useState<string>('सर्व');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>('detailed');

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const [reportData, setReportData] = useState<ReportDataResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-landscape');
  const [signatureTier, setSignatureTier] = useState<'3-tier' | '4-tier'>('3-tier');

  const isMountedRef = useRef(true);

  // Check URL query parameters for initial ledger selection
  useEffect(() => {
    isMountedRef.current = true;
    const urlParams = new URLSearchParams(window.location.search);
    const ledgerParam = urlParams.get('ledgerId');
    if (ledgerParam && ledgerParam !== 'all') {
      setSelectedLedgerId(ledgerParam);
    }

    fetchInitialDetails();
    fetchLedgersWithEntries();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    fetchReport();
  }, [selectedLedgerId, balanceTypeFilter, selectedBranchId]);

  const fetchInitialDetails = async () => {
    try {
      const [sansthaRes, branchesRes] = await Promise.all([
        axios.get('/api/SansthaDetails'),
        axios.get('/api/Branches')
      ]);

      if (sansthaRes.data && isMountedRef.current) {
        if (Array.isArray(sansthaRes.data) && sansthaRes.data.length > 0) {
          setSansthaDetail(sansthaRes.data[0]);
        } else if (!Array.isArray(sansthaRes.data)) {
          setSansthaDetail(sansthaRes.data);
        }
      }

      if (branchesRes.data && isMountedRef.current) {
        setBranches(branchesRes.data || []);
      }
    } catch (err) {
      console.error('Error fetching initial sanstha/branches info', err);
    }
  };

  const isSchemeLedger = (ledgerName?: string) => {
    if (!ledgerName) return false;
    const l = ledgerName.toLowerCase();
    return l.includes('मुदत') || l.includes('ठेव योजना') || l.includes('सेव्हिंग') || 
           l.includes('बचत ठेव') || l.includes('पिग्मी') || l.includes('आवर्ती') || 
           l.includes('भाग भांडवल') || l.includes('शेअर्स') || l.includes('ठेव व्याज') ||
           l.includes('कर्ज') || l.includes('loan') || l.includes('fixed deposit');
  };

  const fetchLedgersWithEntries = async () => {
    try {
      const res = await axios.get('/api/Reports/CustomerOpeningBalanceLedgers?sourceModule=CustomerOpeningBalance');
      if (res.data && isMountedRef.current) {
        const cleanLedgers = (res.data || []).filter((l: LedgerOption) => !isSchemeLedger(l.ledgerName));
        setLedgersWithEntries(cleanLedgers);
      }
    } catch (err) {
      console.error('Error loading ledgers with entries', err);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {
        sourceModule: 'CustomerOpeningBalance'
      };
      if (selectedLedgerId && selectedLedgerId !== 'all') {
        params.ledgerId = selectedLedgerId;
      }
      if (balanceTypeFilter && balanceTypeFilter !== 'सर्व') {
        params.balanceType = balanceTypeFilter;
      }
      if (selectedBranchId !== 'all') {
        params.branchId = selectedBranchId;
      }

      const res = await axios.get('/api/Reports/CustomerOpeningBalanceReport', { params });
      if (isMountedRef.current) {
        setReportData(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching report data', err);
      if (isMountedRef.current) {
        setError('अहवाल माहिती लोड करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    fetchLedgersWithEntries();
    fetchReport();
  };

  // Natural alphanumeric sort for CIF No. (e.g. CIF000001 < CIF000002 < CIF000020)
  const compareCif = (a: CustomerOpeningBalanceRow, b: CustomerOpeningBalanceRow) => {
    const cifA = (a.cifNo || '').trim();
    const cifB = (b.cifNo || '').trim();
    return cifA.localeCompare(cifB, undefined, { numeric: true, sensitivity: 'base' });
  };

  // Client-side quick search and scheme ledger filtering
  const filteredRows = useMemo(() => {
    const list = (reportData?.rows || []).filter(row => {
      if (isSchemeLedger(row.ledgerName)) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        (row.customerName && row.customerName.toLowerCase().includes(term)) ||
        (row.cifNo && row.cifNo.toLowerCase().includes(term)) ||
        (row.legacyCustomerNo && row.legacyCustomerNo.toLowerCase().includes(term)) ||
        (row.memberNo && row.memberNo.toLowerCase().includes(term)) ||
        (row.mobileNo && row.mobileNo.toLowerCase().includes(term)) ||
        (row.village && row.village.toLowerCase().includes(term)) ||
        (row.ledgerName && row.ledgerName.toLowerCase().includes(term))
      );
    });
    return list.sort(compareCif);
  }, [reportData, searchTerm]);

  // Group rows ledger-wise for structured CBS presentation (sorted by CIF No inside each ledger)
  const groupedByLedger = useMemo(() => {
    const groupsMap: { [ledgerID: number]: {
      ledgerID: number;
      ledgerName: string;
      accountType: string;
      rows: CustomerOpeningBalanceRow[];
      totalDr: number;
      totalCr: number;
      netBalance: number;
      netType: string;
    } } = {};

    for (const r of filteredRows) {
      if (!groupsMap[r.ledgerID]) {
        const meta = ledgersWithEntries.find(l => l.ledgerID === r.ledgerID);
        groupsMap[r.ledgerID] = {
          ledgerID: r.ledgerID,
          ledgerName: r.ledgerName,
          accountType: meta?.accountType || 'Personal Account',
          rows: [],
          totalDr: 0,
          totalCr: 0,
          netBalance: 0,
          netType: 'Dr'
        };
      }
      groupsMap[r.ledgerID].rows.push(r);
      groupsMap[r.ledgerID].totalDr += (r.debitAmount || 0);
      groupsMap[r.ledgerID].totalCr += (r.creditAmount || 0);
    }

    const groupsList = Object.values(groupsMap);
    groupsList.forEach(g => {
      g.rows.sort(compareCif);
      g.netBalance = Math.abs(g.totalDr - g.totalCr);
      g.netType = g.totalDr >= g.totalCr ? 'Dr' : 'Cr';
    });

    return groupsList.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName));
  }, [filteredRows, ledgersWithEntries]);

  // Overall totals
  const displayTotalDebit = filteredRows.reduce((sum, r) => sum + (r.debitAmount || 0), 0);
  const displayTotalCredit = filteredRows.reduce((sum, r) => sum + (r.creditAmount || 0), 0);
  const displayNetBalance = Math.abs(displayTotalDebit - displayTotalCredit);
  const displayNetType = displayTotalDebit >= displayTotalCredit ? 'Dr' : 'Cr';

  const selectedLedgerObj = ledgersWithEntries.find(l => String(l.ledgerID) === selectedLedgerId);
  const isSingleLedgerSelected = Boolean(selectedLedgerObj);

  const handleExportExcel = () => {
    if (!filteredRows.length) {
      alert('एक्सपोर्ट करण्यासाठी कोणताही डेटा उपलब्ध नाही.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Ledger Summary Sheet
    const summarySheetData = ledgersWithEntries.map((l, idx) => ({
      'अ.क्र.': idx + 1,
      'लेजर खाते नाव': l.ledgerName,
      'खाते प्रकार': l.accountType,
      'खातेदार संख्या': l.entryCount,
      'नावे शिल्लक (Dr ₹)': l.totalDebit,
      'जमा शिल्लक (Cr ₹)': l.totalCredit,
      'निव्वळ शिल्लक': `${fmtCurrency(l.netBalance)} ${l.netBalanceType}`
    }));

    summarySheetData.push({
      'अ.क्र.': '' as any,
      'लेजर खाते नाव': 'एकूण बेरीज (Grand Total)',
      'खाते प्रकार': '',
      'खातेदार संख्या': ledgersWithEntries.reduce((s, l) => s + l.entryCount, 0),
      'नावे शिल्लक (Dr ₹)': ledgersWithEntries.reduce((s, l) => s + l.totalDebit, 0),
      'जमा शिल्लक (Cr ₹)': ledgersWithEntries.reduce((s, l) => s + l.totalCredit, 0),
      'निव्वळ शिल्लक': `${fmtCurrency(displayNetBalance)} ${displayNetType}`
    });

    const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'लेजर_गोषवारा');

    // 2. Detailed Ledger-Wise Sheet
    const detailedData: any[] = [];
    let overallSr = 1;

    groupedByLedger.forEach(group => {
      // Group header
      detailedData.push({
        'अ.क्र.': `--- [लेजर: ${group.ledgerName} (${group.accountType})] ---`,
        'सीआयएफ क्र.': '',
        'सभासद क्र.': '',
        'खातेदाराचे पूर्ण नाव': '',
        'मोबाईल क्र.': '',
        'गाव / पत्ता': '',
        'नावे रक्कम (Dr ₹)': '',
        'जमा रक्कम (Cr ₹)': ''
      });

      group.rows.forEach(r => {
        detailedData.push({
          'अ.क्र.': overallSr++,
          'सीआयएफ क्र.': r.cifNo || '-',
          'सभासद क्र.': r.memberNo || '-',
          'खातेदाराचे पूर्ण नाव': r.customerName,
          'मोबाईल क्र.': r.mobileNo || '-',
          'गाव / पत्ता': r.village || r.address || '-',
          'नावे रक्कम (Dr ₹)': r.debitAmount > 0 ? r.debitAmount : '',
          'जमा रक्कम (Cr ₹)': r.creditAmount > 0 ? r.creditAmount : '',
          'शिल्लक बाकी (Balance ₹)': r.amount,
          'प्रकार (Dr/Cr)': r.balanceType
        });
      });

      // Subtotal row if multiple ledgers
      if (groupedByLedger.length > 1) {
        detailedData.push({
          'अ.क्र.': '',
          'सीआयएफ क्र.': '',
          'सभासद क्र.': '',
          'खातेदाराचे पूर्ण नाव': `उप-एकूण: ${group.ledgerName}`,
          'मोबाईल क्र.': `खातेदार: ${group.rows.length}`,
          'गाव / पत्ता': '',
          'नावे रक्कम (Dr ₹)': group.totalDr,
          'जमा रक्कम (Cr ₹)': group.totalCr,
          'शिल्लक बाकी (Balance ₹)': group.netBalance,
          'प्रकार (Dr/Cr)': group.netType
        });
      }
    });

    // Grand total
    detailedData.push({
      'अ.क्र.': '',
      'सीआयएफ क्र.': '',
      'सभासद क्र.': '',
      'खातेदाराचे पूर्ण नाव': 'एकूण (Grand Total)',
      'मोबाईल क्र.': `एकूण खातेदार: ${filteredRows.length}`,
      'गाव / पत्ता': '',
      'नावे रक्कम (Dr ₹)': displayTotalDebit,
      'जमा रक्कम (Cr ₹)': displayTotalCredit,
      'शिल्लक बाकी (Balance ₹)': displayNetBalance,
      'प्रकार (Dr/Cr)': displayNetType
    });

    const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
    const detailSheetName = selectedLedgerObj 
      ? selectedLedgerObj.ledgerName.substring(0, 25).replace(/[:\\\/\?\*\[\]]/g, '_') 
      : 'लेजरनिहाय_तपशील';
    XLSX.utils.book_append_sheet(wb, wsDetailed, detailSheetName);
    
    const fileName = `Customer_Opening_Balances_${selectedLedgerObj ? selectedLedgerObj.ledgerName.replace(/\s+/g, '_') : 'LedgerWise'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Professional Minimalist CBS Summary Strip
  const summaryBanner = (
    <div className="border border-slate-900 bg-white p-2.5 my-1.5 text-xs">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
        <div className="border-r border-slate-300 pr-2">
          <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">
            {isSingleLedgerSelected ? 'निवडलेले लेजर' : 'एकूण लेजर्स / खातेदार'}
          </span>
          <strong className="text-slate-950 font-bold text-xs truncate block mt-0.5">
            {isSingleLedgerSelected ? (
              <span>{selectedLedgerObj?.ledgerName} <span className="text-slate-500 font-normal">({filteredRows.length} खातेदार)</span></span>
            ) : (
              <span>{groupedByLedger.length} लेजर्स ({filteredRows.length} खातेदार)</span>
            )}
          </strong>
        </div>

        <div className="border-r border-slate-300 pr-2">
          <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">
            एकूण नावे शिल्लक (Total Dr)
          </span>
          <strong className="text-slate-950 font-mono text-xs block mt-0.5">
            ₹ {fmtCurrency(displayTotalDebit)}
          </strong>
        </div>

        <div className="border-r border-slate-300 pr-2">
          <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">
            एकूण जमा शिल्लक (Total Cr)
          </span>
          <strong className="text-slate-950 font-mono text-xs block mt-0.5">
            ₹ {fmtCurrency(displayTotalCredit)}
          </strong>
        </div>

        <div>
          <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">
            निव्वळ बाकी (Net Balance)
          </span>
          <strong className="text-slate-950 font-mono text-xs block mt-0.5">
            ₹ {fmtCurrency(displayNetBalance)} <span className="font-bold text-[11px]">({displayNetType})</span>
          </strong>
        </div>
      </div>
    </div>
  );

  // Professional CBS Filter Toolbar Controls (Placed OUTSIDE the paper in the action bar)
  const extraToolbarControls = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* View Mode Toggle */}
      <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300">
        <button
          type="button"
          onClick={() => setViewMode('detailed')}
          className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
            viewMode === 'detailed' 
              ? 'bg-primary text-white shadow-2xs' 
              : 'text-slate-700 hover:text-slate-950'
          }`}
          title="तपशीलवार नोंदवही पाहा"
        >
          <TableIcon className="w-3 h-3" />
          <span>तपशीलवार पत्रक</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('summary')}
          className={`px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
            viewMode === 'summary' 
              ? 'bg-primary text-white shadow-2xs' 
              : 'text-slate-700 hover:text-slate-950'
          }`}
          title="लेजरनिहाय गोषवारा पाहा"
        >
          <Layers className="w-3 h-3" />
          <span>लेजर गोषवारा</span>
        </button>
      </div>

      {/* Ledger Selector - PRIMARY FILTER */}
      <div className="flex items-center gap-1">
        <label className="text-[11px] font-bold text-slate-800 shrink-0 flex items-center gap-1">
          <Filter className="w-3 h-3 text-primary" />
          <span>लेजर:</span>
        </label>
        <select
          value={selectedLedgerId}
          onChange={e => setSelectedLedgerId(e.target.value)}
          className="h-6 border border-slate-400 rounded px-1.5 text-xs bg-white text-slate-950 font-bold focus:ring-1 focus:ring-primary max-w-[260px]"
        >
          <option value="all">
            सर्व लेजर्स (लेजरनिहाय गटवारी - {ledgersWithEntries.reduce((s, l) => s + l.entryCount, 0)} नोंदी)
          </option>
          {ledgersWithEntries.map(l => (
            <option key={l.ledgerID} value={l.ledgerID}>
              {l.ledgerName} ({l.entryCount} नोंदी - {l.accountType})
            </option>
          ))}
        </select>
      </div>

      {/* Balance Type Filter */}
      <div className="flex items-center gap-1">
        <label className="text-[11px] font-semibold text-slate-700 shrink-0">प्रकार:</label>
        <select
          value={balanceTypeFilter}
          onChange={e => setBalanceTypeFilter(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1.5 text-xs bg-white text-slate-900 focus:ring-1 focus:ring-primary"
        >
          <option value="सर्व">सर्व (Dr & Cr)</option>
          <option value="Dr">नावे (Dr)</option>
          <option value="Cr">जमा (Cr)</option>
        </select>
      </div>

      {/* Branch Selector if multiple */}
      {branches.length > 1 && (
        <div className="flex items-center gap-1">
          <label className="text-[11px] font-semibold text-slate-700 shrink-0">शाखा:</label>
          <select
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
            className="h-6 border border-slate-300 rounded px-1.5 text-xs bg-white text-slate-900 focus:ring-1 focus:ring-primary"
          >
            <option value="all">सर्व शाखा</option>
            {branches.map(b => (
              <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3 h-3 absolute left-1.5 top-1.5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="नाव, CIF शोधा..."
          className="h-6 pl-5 pr-1.5 border border-slate-300 rounded text-xs w-36 bg-white focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Signature Tier */}
      <div className="flex items-center gap-1">
        <select
          value={signatureTier}
          onChange={e => setSignatureTier(e.target.value as '3-tier' | '4-tier')}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-700"
          title="स्वाक्षरी स्तर"
        >
          <option value="3-tier">३-स्तरीय स्वाक्षरी</option>
          <option value="4-tier">४-स्तरीय स्वाक्षरी</option>
        </select>
      </div>

      {/* Refresh Button */}
      <button
        type="button"
        onClick={handleRefresh}
        className="h-6 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded flex items-center gap-1 cursor-pointer transition text-xs"
        title="रिफ्रेश करा"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-primary' : ''}`} />
        <span>रिफ्रेश</span>
      </button>
    </div>
  );

  const activeBranchName = selectedBranchId !== 'all' 
    ? (branches.find(b => String(b.branchID) === selectedBranchId)?.branchName || 'शाखा')
    : 'सर्व शाखा (All Branches)';

  const periodSubtitle = isSingleLedgerSelected
    ? `बाकी स्थिती | लेजर: ${selectedLedgerObj?.ledgerName} (${selectedLedgerObj?.accountType})`
    : `बाकी स्थिती | लेजरनिहाय वर्गीकरण (${groupedByLedger.length} लेजर्स)`;

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      reportTitle="खातेदार बाकी रिपोर्ट (लेजर खाते प्रमाणे)"
      reportSubtitle="Customer Balance Report - Ledger Wise"
      periodText={periodSubtitle}
      branchName={activeBranchName}
      sansthaInfo={sansthaDetail}
      summaryBanner={summaryBanner}
      signatureTier={signatureTier}
      signatureTitles={
        signatureTier === '4-tier'
          ? [
              { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
              { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
              { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' },
              { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Director)' }
            ]
          : [
              { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
              { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
              { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' }
            ]
      }
      onExportExcel={handleExportExcel}
      extraToolbarControls={extraToolbarControls}
      isLoading={loading}
      hasData={filteredRows.length > 0}
      preparedBy="Admin"
    >
      {error && (
        <div className="p-2 mb-2 bg-red-50 border border-red-300 text-red-800 text-xs rounded">
          {error}
        </div>
      )}

      {/* VIEW 1: LEDGER ABSTRACT / SUMMARY TABLE */}
      {viewMode === 'summary' && (
        <table className="w-full border-collapse border border-slate-900 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 font-bold uppercase text-[10.5px]">
              <th className="border border-slate-900 py-1.5 px-1 text-center w-[5%]">अ.क्र.</th>
              <th className="border border-slate-900 py-1.5 px-3 text-left w-[35%]">लेजर खाते नाव</th>
              <th className="border border-slate-900 py-1.5 px-2 text-left w-[18%]">खाते प्रकार</th>
              <th className="border border-slate-900 py-1.5 px-2 text-center w-[10%]">खातेदार संख्या</th>
              <th className="border border-slate-900 py-1.5 px-2 text-right w-[14%] font-bold">नावे शिल्लक (Dr ₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 text-right w-[14%] font-bold">जमा शिल्लक (Cr ₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 text-right w-[14%] font-bold">निव्वळ बाकी (Net ₹)</th>
            </tr>
          </thead>
          <tbody>
            {ledgersWithEntries.map((l, idx) => (
              <tr 
                key={l.ledgerID}
                onClick={() => {
                  setSelectedLedgerId(String(l.ledgerID));
                  setViewMode('detailed');
                }}
                className={`border-b border-slate-900 transition-colors hover:bg-slate-50 cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                title="या लेजरचा तपशील उघडण्यासाठी क्लिक करा"
              >
                <td className="border border-slate-900 py-1 px-1 text-center font-mono text-slate-700">
                  {idx + 1}
                </td>
                <td className="border border-slate-900 py-1 px-3 font-bold text-slate-950 flex items-center justify-between">
                  <span>{l.ledgerName}</span>
                  <span className="text-[10px] text-primary underline no-print">तपशील पहा ›</span>
                </td>
                <td className="border border-slate-900 py-1 px-2 text-slate-700">
                  {l.accountType}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">
                  {l.entryCount}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-right font-mono text-slate-950 font-semibold">
                  {l.totalDebit > 0 ? fmtCurrency(l.totalDebit) : '-'}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-right font-mono text-slate-950 font-semibold">
                  {l.totalCredit > 0 ? fmtCurrency(l.totalCredit) : '-'}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950">
                  ₹ {fmtCurrency(l.netBalance)} <span className="text-[10px] font-semibold">{l.netBalanceType}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-900 font-bold text-slate-950 text-xs">
              <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-left uppercase">
                एकूण बेरीज (Grand Total) - {ledgersWithEntries.length} लेजर्स
              </td>
              <td className="border border-slate-900 py-1.5 px-2 text-center font-mono font-extrabold">
                {ledgersWithEntries.reduce((s, l) => s + l.entryCount, 0)}
              </td>
              <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-extrabold text-slate-950">
                ₹ {fmtCurrency(displayTotalDebit)}
              </td>
              <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-extrabold text-slate-950">
                ₹ {fmtCurrency(displayTotalCredit)}
              </td>
              <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                ₹ {fmtCurrency(displayNetBalance)} ({displayNetType})
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* VIEW 2: AUTHENTIC CBS DETAILED REGISTER */}
      {viewMode === 'detailed' && (
        <table className="w-full border-collapse border border-slate-900 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 font-bold uppercase text-[10px] text-center">
              <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[11%] text-center">सीआयएफ क्र.</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[9%] text-center">सभासद क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2.5 w-[24%] text-left">खातेदाराचे पूर्ण नाव</th>
              <th className="border border-slate-900 py-1.5 px-1.5 w-[11%] text-center">मोबाईल क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-left">गाव / पत्ता</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[8.5%] text-right font-bold">नावे रक्कम (Dr ₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[8.5%] text-right font-bold">जमा रक्कम (Cr ₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-right font-bold bg-slate-200/50">शिल्लक बाकी (Balance ₹)</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-600 font-medium border border-slate-900 bg-slate-50">
                  {loading ? 'माहिती लोड होत आहे, कृपया प्रतीक्षा करा...' : 'कोणतीही खातेदार बाकी नोंद उपलब्ध नाही.'}
                </td>
              </tr>
            ) : (
              groupedByLedger.map((group) => {
                return (
                  <React.Fragment key={group.ledgerID}>
                    {/* Section Header: only show distinct sub-header if multiple ledgers are listed */}
                    {!isSingleLedgerSelected && groupedByLedger.length > 1 && (
                      <tr className="bg-slate-100/90 font-bold text-slate-950 border-t-2 border-b border-slate-900 text-[11px]">
                        <td colSpan={6} className="border border-slate-900 py-1 px-2.5 text-left">
                          › लेजर खाते: <span className="font-extrabold uppercase">{group.ledgerName}</span> <span className="font-normal text-slate-600">({group.accountType})</span> — <span className="font-mono">{group.rows.length}</span> खातेदार
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-900">
                          {group.totalDr > 0 ? fmtCurrency(group.totalDr) : '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-900">
                          {group.totalCr > 0 ? fmtCurrency(group.totalCr) : '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-extrabold text-slate-950 bg-slate-200/40">
                          ₹ {fmtCurrency(group.netBalance)} <span className="text-[9.5px] font-bold">{group.netType}</span>
                        </td>
                      </tr>
                    )}

                    {/* Customer Data Rows */}
                    {group.rows.map((row, index) => (
                      <tr 
                        key={row.customerOpeningBalanceID} 
                        className={`text-slate-900 text-[11px] transition-colors hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                      >
                        <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium text-slate-700">
                          {index + 1}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-900">
                          {row.cifNo || '-'}
                          {row.legacyCustomerNo && (
                            <span className="block text-[8.5px] text-slate-500 font-normal">जुना: {row.legacyCustomerNo}</span>
                          )}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center font-mono text-slate-800">
                          {row.memberNo || '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-2.5 font-bold text-slate-950">
                          {row.customerName}
                        </td>
                        <td className="border border-slate-900 py-1 px-1.5 text-center font-mono text-slate-700">
                          {row.mobileNo || '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-slate-700 truncate max-w-[140px]">
                          {row.village || row.address || '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono text-slate-950 font-semibold">
                          {row.debitAmount > 0 ? fmtCurrency(row.debitAmount) : '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono text-slate-950 font-semibold">
                          {row.creditAmount > 0 ? fmtCurrency(row.creditAmount) : '-'}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950 bg-slate-50/60">
                          ₹ {fmtCurrency(row.amount)} <span className={`text-[9.5px] font-bold ${row.balanceType === 'Dr' ? 'text-red-700' : 'text-emerald-700'}`}>{row.balanceType}</span>
                        </td>
                      </tr>
                    ))}

                    {/* Subtotal row ONLY if multiple ledgers are being displayed */}
                    {!isSingleLedgerSelected && groupedByLedger.length > 1 && (
                      <tr className="bg-slate-50 font-bold text-slate-950 border-t border-b border-slate-900 text-[11px]">
                        <td colSpan={6} className="border border-slate-900 py-1 px-3 text-right italic font-bold">
                          उप-एकूण ({group.ledgerName}) - {group.rows.length} खातेदार:
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-900">
                          ₹ {fmtCurrency(group.totalDr)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-900">
                          ₹ {fmtCurrency(group.totalCr)}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-extrabold text-slate-950 bg-slate-100">
                          ₹ {fmtCurrency(group.netBalance)} <span className="text-[9.5px] font-bold">({group.netType})</span>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* Clean Grand Total Footer */}
          {filteredRows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                <td colSpan={6} className="border border-slate-900 py-1.5 px-3 text-left uppercase tracking-wider font-extrabold">
                  {isSingleLedgerSelected 
                    ? `एकूण बेरीज (${selectedLedgerObj?.ledgerName}) - ${filteredRows.length} खातेदार`
                    : `एकूण (Grand Total) - ${groupedByLedger.length} लेजर्स, ${filteredRows.length} खातेदार`}
                </td>
                <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                  ₹ {fmtCurrency(displayTotalDebit)}
                </td>
                <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                  ₹ {fmtCurrency(displayTotalCredit)}
                </td>
                <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950 bg-slate-200">
                  ₹ {fmtCurrency(displayNetBalance)} <span className="text-[10px]">({displayNetType})</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </CbsReportLayout>
  );
}

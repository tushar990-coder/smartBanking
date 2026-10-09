import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CbsReportLayout, { formatDisplayDate, CbsPaperSize } from './common/CbsReportLayout';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  RefreshCw, 
  LayoutGrid, 
  ListFilter,
  CheckCircle2,
  AlertTriangle,
  BookOpen
} from 'lucide-react';

interface ReportNode {
  id: number;
  name: string;
  code?: string;
  displayOrder?: number;
  isGroup: boolean;
  openingBalance: number;
  openingType: string;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingType: string;
  children: ReportNode[];
}

interface NodeTotals {
  opDr: number;
  opCr: number;
  transDr: number;
  transCr: number;
  clDr: number;
  clCr: number;
}

// Marathi Digits Converter
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

const getNodeTotals = (node: ReportNode): NodeTotals => {
  if (!node.isGroup) {
    return {
      opDr: node.openingType === 'Dr' ? node.openingBalance : 0,
      opCr: node.openingType === 'Cr' ? node.openingBalance : 0,
      transDr: node.totalDebit,
      transCr: node.totalCredit,
      clDr: node.closingType === 'Dr' ? node.closingBalance : 0,
      clCr: node.closingType === 'Cr' ? node.closingBalance : 0,
    };
  }

  let totals: NodeTotals = { opDr: 0, opCr: 0, transDr: 0, transCr: 0, clDr: 0, clCr: 0 };
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const childTotals = getNodeTotals(child);
      totals.opDr += childTotals.opDr;
      totals.opCr += childTotals.opCr;
      totals.transDr += childTotals.transDr;
      totals.transCr += childTotals.transCr;
      totals.clDr += childTotals.clDr;
      totals.clCr += childTotals.clCr;
    }
  }
  return totals;
};

// Tree Node Component for Group Tree View
const TreeNode: React.FC<{ 
  node: ReportNode; 
  level: number; 
  indexStr: string; 
  isMarathiDigits: boolean; 
}> = ({ node, level, indexStr, isMarathiDigits }) => {
  const [expanded, setExpanded] = useState(true);

  const hasChildren = node.children && node.children.length > 0;
  const totals = getNodeTotals(node);
  
  let netOpStr = '-';
  if (totals.opDr > totals.opCr) {
    netOpStr = `${fmtCurrency(totals.opDr - totals.opCr, isMarathiDigits)} Dr`;
  } else if (totals.opCr > totals.opDr) {
    netOpStr = `${fmtCurrency(totals.opCr - totals.opDr, isMarathiDigits)} Cr`;
  }

  let netClosingStr = '-';
  if (totals.clDr > totals.clCr) {
    netClosingStr = `${fmtCurrency(totals.clDr - totals.clCr, isMarathiDigits)} Dr`;
  } else if (totals.clCr > totals.clDr) {
    netClosingStr = `${fmtCurrency(totals.clCr - totals.clDr, isMarathiDigits)} Cr`;
  }

  const idxText = isMarathiDigits ? toMarathiDigits(indexStr) : indexStr;
  const codeRaw = node.isGroup 
    ? (node.displayOrder && node.displayOrder > 0 ? `${node.displayOrder} -` : (node.code ? `${node.code} -` : '')) 
    : `${node.code || node.id} -`;
  const codeText = isMarathiDigits ? toMarathiDigits(codeRaw) : codeRaw;

  return (
    <React.Fragment>
      <tr className={`hover:bg-slate-50 border-b border-slate-900 ${node.isGroup ? 'font-bold bg-slate-100/80 text-[11px] text-slate-950' : 'text-[11px] text-slate-900'}`}>
        <td className="border border-slate-900 p-1 text-center font-mono font-medium text-slate-700">
          {idxText}
        </td>
        <td className="border border-slate-900 p-1 align-middle" style={{ paddingLeft: `${level * 0.8 + 0.4}rem` }}>
          {hasChildren ? (
            <button 
              type="button"
              onClick={() => setExpanded(!expanded)} 
              className="mr-1.5 w-3.5 h-3.5 inline-flex items-center justify-center rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[9px] cursor-pointer print:hidden select-none"
            >
              {expanded ? '−' : '+'}
            </button>
          ) : (
            <span className="mr-1.5 w-3.5 inline-block print:hidden"></span>
          )}

          <span className="text-primary font-mono font-bold text-[11px] mr-1.5">
            {codeText}
          </span>
          <span>{node.name}</span>
        </td>
        
        <td className="border border-slate-900 p-1 text-right font-mono font-medium whitespace-nowrap cbs-num-cell">
          {netOpStr}
        </td>
        <td className="border border-slate-900 p-1 text-right font-mono font-medium whitespace-nowrap text-red-700 cbs-num-cell">
          {totals.transDr > 0 ? fmtCurrency(totals.transDr, isMarathiDigits) : '-'}
        </td>
        <td className="border border-slate-900 p-1 text-right font-mono font-medium whitespace-nowrap text-emerald-800 cbs-num-cell">
          {totals.transCr > 0 ? fmtCurrency(totals.transCr, isMarathiDigits) : '-'}
        </td>
        <td className="border border-slate-900 p-1 text-right font-mono font-bold whitespace-nowrap text-slate-950 cbs-num-cell">
          {netClosingStr}
        </td>
      </tr>

      {expanded && hasChildren && node.children.map((child, idx) => (
        <TreeNode 
          key={`${child.id}-${idx}`} 
          node={child} 
          level={level + 1} 
          indexStr={`${indexStr}.${idx + 1}`}
          isMarathiDigits={isMarathiDigits}
        />
      ))}
    </React.Fragment>
  );
};

export default function TrialBalance() {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState<ReportNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'active' | 'transactionsOnly' | 'all'>('active');
  const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat');
  const [digitMode, setDigitMode] = useState<'marathi' | 'english'>('marathi');
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-portrait');
  const [searchTerm, setSearchTerm] = useState('');

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
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
          if (!user?.businessDate) {
            setToDate(active.endDate.split('T')[0]);
          } else {
            setToDate(user.businessDate);
          }
        }
      }

      if (resBranches.data) {
        setBranches(resBranches.data);
      }
    } catch (error) {
      console.error('Failed to initialize data', error);
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

  // Recursively flatten ledgers for Flat list view
  const flattenLedgers = (nodes: ReportNode[]): ReportNode[] => {
    let result: ReportNode[] = [];
    for (const node of nodes) {
      if (!node.isGroup) {
        const hasTransactions = Math.abs(node.totalDebit) >= 0.01 || Math.abs(node.totalCredit) >= 0.01;
        const hasBalance = Math.abs(node.openingBalance) >= 0.01 || Math.abs(node.closingBalance) >= 0.01;

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

  const filterTreeNodes = (nodes: ReportNode[]): ReportNode[] => {
    return nodes
      .map(node => {
        if (!node.isGroup) {
          const hasTransactions = Math.abs(node.totalDebit) >= 0.01 || Math.abs(node.totalCredit) >= 0.01;
          const hasBalance = Math.abs(node.openingBalance) >= 0.01 || Math.abs(node.closingBalance) >= 0.01;
          let matchFilter = true;

          if (filterMode === 'transactionsOnly') matchFilter = hasTransactions;
          else if (filterMode === 'active') matchFilter = hasTransactions || hasBalance;

          let matchSearch = true;
          if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            matchSearch = itemMatchesSearch(node, term);
          }

          return matchFilter && matchSearch ? node : null;
        }

        const filteredChildren = filterTreeNodes(node.children);
        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter((n): n is ReportNode => n !== null);
  };

  const itemMatchesSearch = (item: ReportNode, term: string) => {
    return (
      item.name.toLowerCase().includes(term) ||
      (item.code && item.code.toLowerCase().includes(term)) ||
      item.id.toString().includes(term)
    );
  };

  const filteredReportData = filterTreeNodes(reportData);

  // Gross Totals for Gross Trial Balance
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

  const isMarathiDigits = digitMode === 'marathi';

  // Balance Integrity check: Difference between Total Dr and Total Cr
  const closingDifference = Math.abs(totalClosingDr - totalClosingCr);
  const isBalanced = closingDifference < 0.01;

  // Excel Export
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
    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');
    XLSX.writeFile(wb, `Trial_Balance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // CBS Unified Toolbar Controls
  const filterToolbarControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* View Type Flat/Tree */}
      <div className="inline-flex rounded-sm border border-slate-300 p-0.5 bg-slate-50 h-6 items-center">
        <button
          type="button"
          onClick={() => setViewMode('flat')}
          className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs transition-all flex items-center gap-0.5 cursor-pointer ${
            viewMode === 'flat' ? 'bg-primary text-white shadow-2xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <LayoutGrid size={10} />
          <span>सरळ यादी</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('tree')}
          className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs transition-all flex items-center gap-0.5 cursor-pointer ${
            viewMode === 'tree' ? 'bg-primary text-white shadow-2xs' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          <ListFilter size={10} />
          <span>ग्रुप ट्री</span>
        </button>
      </div>

      {/* Branch */}
      {branches.length > 1 && (
        <div className="flex items-center gap-1">
          <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">शाखा:</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary max-w-[110px]"
          >
            <option value="all">सर्व शाखा (All)</option>
            {branches.map((b) => (
              <option key={b.branchID} value={b.branchID.toString()}>
                {b.branchName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Dates */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">पासून:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-mono bg-white focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">पर्यंत:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-mono bg-white focus:outline-none focus:border-primary"
        />
      </div>

      {/* Filter Mode */}
      <div className="flex items-center gap-1">
        <select
          value={filterMode}
          onChange={(e: any) => setFilterMode(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-semibold bg-white focus:outline-none focus:border-primary text-primary"
        >
          <option value="active">सक्रिय खाती (Active)</option>
          <option value="transactionsOnly">व्यवहार झालेली खाती</option>
          <option value="all">सर्व खाती (शून्य शिल्लकसह)</option>
        </select>
      </div>

      {/* Numerals Format Toggle */}
      <div className="flex items-center gap-1">
        <select
          value={digitMode}
          onChange={(e) => setDigitMode(e.target.value as 'marathi' | 'english')}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-semibold bg-white focus:outline-none focus:border-primary"
        >
          <option value="marathi">मराठी अंक (१, २, ३)</option>
          <option value="english">इंग्रजी अंक (1, 2, 3)</option>
        </select>
      </div>

      {/* Search */}
      <div className="relative w-32 sm:w-40">
        <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="खाते / लेजर शोधा..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-5 pr-1 py-0.5 h-6 border border-slate-300 rounded text-[10.5px] focus:outline-none focus:border-primary bg-white"
        />
      </div>

      {/* View Button */}
      <button
        type="button"
        onClick={fetchReport}
        disabled={loading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        <span>पहा</span>
      </button>
    </div>
  );

  // Compact CBS Summary Strip
  const summaryBanner = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण लेजर्स संख्या</span>
        <strong className="text-primary text-[11px] font-mono">
          {isMarathiDigits ? toMarathiDigits(flatList.length) : flatList.length} खाती
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कालावधी नावे व्यवहार</span>
        <strong className="text-red-700 font-mono text-[11px]">
          ₹ {fmtCurrency(totalTransDr, isMarathiDigits)}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कालावधी जमा व्यवहार</span>
        <strong className="text-emerald-700 font-mono text-[11px]">
          ₹ {fmtCurrency(totalTransCr, isMarathiDigits)}
        </strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">तेरीज ताळा स्थिती</span>
        {isBalanced ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs font-mono">
            <CheckCircle2 size={13} className="stroke-[2.5]" />
            संतुलित (₹ {fmtCurrency(0, isMarathiDigits)})
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-xs font-mono">
            <AlertTriangle size={13} className="stroke-[2.5]" />
            तफावत: ₹ {fmtCurrency(closingDifference, isMarathiDigits)}
          </span>
        )}
      </div>
    </div>
  );

  // Formatted Period
  const fromDisplay = formatDisplayDate(fromDate);
  const toDisplay = formatDisplayDate(toDate);
  const periodTextStr = isMarathiDigits 
    ? `कालावधी : ${toMarathiDigits(fromDisplay)} ते ${toMarathiDigits(toDisplay)}`
    : `कालावधी : ${fromDisplay} ते ${toDisplay}`;

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      titleStyle="classic-badge"
      reportTitle="तेरीज पत्रक"
      reportSubtitle="Trial Balance Report"
      periodText={periodTextStr}
      sansthaInfo={sansthaDetail}
      summaryBanner={summaryBanner}
      signatureTier="4-tier"
      signatureTitles={[
        { title: 'लिपिक / तेरीज लेखक', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' },
        { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' }
      ]}
      onExportExcel={handleExportExcel}
      onPrint={handlePrint}
      extraToolbarControls={filterToolbarControls}
      isLoading={loading}
      hasData={flatList.length > 0}
      preparedBy="Admin"
      emptyState={
        <div className="bg-white p-12 text-center text-slate-500 rounded-xs border border-slate-200 shadow-xs max-w-4xl mx-auto">
          <BookOpen size={36} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs text-slate-700">या कालावधीत कोणतीही तेरीज नोंद आढळली नाही.</p>
          <p className="text-[11px] text-slate-500 mt-1">कृपया कालावधी निवडून 'पहा' बटणावर क्लिक करा.</p>
        </div>
      }
    >
      {/* Official CBS Table */}
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-950 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">अ. क्र.</th>
            <th className="border border-slate-900 py-1.5 px-3 text-left">खाते / लेजर नाव</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-right">आरंभीची शिल्लक (₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-right">नावे व्यवहार (Dr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-right">जमा व्यवहार (Cr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right font-extrabold">अखेरची शिल्लक (₹)</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="py-6 text-center text-slate-500 font-semibold border border-slate-900">
                तेरीज अहवाल तयार होत आहे, कृपया प्रतीक्षा करा...
              </td>
            </tr>
          ) : viewMode === 'flat' ? (
            // Flat List View
            flatList.map((node, index) => {
              let opStr = '-';
              if (node.openingBalance !== 0) {
                opStr = `${fmtCurrency(node.openingBalance, isMarathiDigits)} ${node.openingType}`;
              }

              let closingStr = '-';
              if (node.closingBalance !== 0) {
                closingStr = `${fmtCurrency(node.closingBalance, isMarathiDigits)} ${node.closingType}`;
              }

              const idxText = isMarathiDigits ? toMarathiDigits(index + 1) : String(index + 1);
              const codeRaw = `${node.code || node.id} -`;
              const codeText = isMarathiDigits ? toMarathiDigits(codeRaw) : codeRaw;

              return (
                <tr key={node.id} className="hover:bg-slate-50 text-slate-900 text-[11.5px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idxText}</td>
                  <td className="border border-slate-900 py-1 px-3">
                    <span className="text-primary font-mono font-bold mr-1.5">{codeText}</span>
                    <span className="font-medium">{node.name}</span>
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono cbs-num-cell">{opStr}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono text-red-700 cbs-num-cell">
                    {node.totalDebit > 0 ? fmtCurrency(node.totalDebit, isMarathiDigits) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono text-emerald-800 font-medium cbs-num-cell">
                    {node.totalCredit > 0 ? fmtCurrency(node.totalCredit, isMarathiDigits) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950 cbs-num-cell">
                    {closingStr}
                  </td>
                </tr>
              );
            })
          ) : (
            // Group Tree View
            filteredReportData.map((node, index) => (
              <TreeNode 
                key={node.id} 
                node={node} 
                level={0} 
                indexStr={`${index + 1}`}
                isMarathiDigits={isMarathiDigits}
              />
            ))
          )}
        </tbody>
        {flatList.length > 0 && (
          <tfoot>
            <tr className="bg-slate-200 font-bold text-slate-950 border-t-2 border-b-2 border-slate-900 text-xs">
              <td colSpan={2} className="border border-slate-900 py-2 px-3 text-right uppercase tracking-wider">
                एकूण तेरीज बेरीज (Grand Total):
              </td>
              <td className="border border-slate-900 py-2 px-2 text-right font-mono text-[11px] cbs-num-cell">
                <div>Dr: ₹{fmtCurrency(totalOpeningDr, isMarathiDigits)}</div>
                <div>Cr: ₹{fmtCurrency(totalOpeningCr, isMarathiDigits)}</div>
              </td>
              <td className="border border-slate-900 py-2 px-2 text-right font-mono font-bold text-red-700 cbs-num-cell">
                ₹ {fmtCurrency(totalTransDr, isMarathiDigits)}
              </td>
              <td className="border border-slate-900 py-2 px-2 text-right font-mono font-bold text-emerald-800 cbs-num-cell">
                ₹ {fmtCurrency(totalTransCr, isMarathiDigits)}
              </td>
              <td className="border border-slate-900 py-2 px-2 text-right font-mono font-black text-slate-950 text-[11px] cbs-num-cell">
                <div>Dr: ₹{fmtCurrency(totalClosingDr, isMarathiDigits)}</div>
                <div>Cr: ₹{fmtCurrency(totalClosingCr, isMarathiDigits)}</div>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </CbsReportLayout>
  );
}

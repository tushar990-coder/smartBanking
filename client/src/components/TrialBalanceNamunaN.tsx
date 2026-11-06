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
  CheckCircle2,
  AlertTriangle,
  ListFilter,
} from 'lucide-react';
import { enrichTreeWithNature, toMarathiDigits } from './TrialBalance';

interface ReportNode {
  id: number;
  name: string;
  code?: string;
  displayOrder?: number;
  groupDisplayOrder?: number;
  nature?: string;
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

interface TerijSectionRow {
  id: number;
  code: string;
  name: string;
  nature: string;
  signedOpening: number;
  debit: number;
  credit: number;
  signedClosing: number;
}

const fmtCurrency = (n: number | null | undefined, isMarathi: boolean = false) => {
  const num = Number(n || 0);
  const absFormatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const signedStr = num < -0.004 ? `-${absFormatted}` : absFormatted;
  return isMarathi ? toMarathiDigits(signedStr) : signedStr;
};

const fmtTerijAmount = (n: number | null | undefined, isMarathi: boolean = false) => {
  const num = Number(n || 0);
  const fixedStr = Math.abs(num).toFixed(2);
  const signedStr = num < -0.004 ? `-${fixedStr}` : fixedStr;
  return isMarathi ? toMarathiDigits(signedStr) : signedStr;
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

  const totals: NodeTotals = { opDr: 0, opCr: 0, transDr: 0, transCr: 0, clDr: 0, clCr: 0 };
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

const NamunaTreeNode: React.FC<{
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
    ? node.displayOrder && node.displayOrder > 0
      ? `${node.displayOrder} -`
      : node.code
      ? `${node.code} -`
      : ''
    : `${node.code || node.id} -`;
  const codeText = isMarathiDigits ? toMarathiDigits(codeRaw) : codeRaw;

  return (
    <React.Fragment>
      <tr
        className={`hover:bg-slate-50 border-b border-gray-900 ${
          node.isGroup ? 'font-bold bg-slate-100/80 text-[11px] text-gray-950' : 'text-[11px] text-gray-900'
        }`}
      >
        <td className="border border-gray-900 p-1 text-center font-mono font-medium text-gray-700">
          {idxText}
        </td>
        <td className="border border-gray-900 p-1 align-middle" style={{ paddingLeft: `${level * 0.8 + 0.4}rem` }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mr-1.5 w-3.5 h-3.5 inline-flex items-center justify-center rounded bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[9px] cursor-pointer no-print select-none"
            >
              {expanded ? '−' : '+'}
            </button>
          ) : (
            <span className="mr-1.5 w-3.5 inline-block no-print"></span>
          )}
          <span className="text-primary font-mono font-bold text-[11px] mr-1.5">{codeText}</span>
          <span>{node.name}</span>
        </td>
        <td className="border border-gray-900 p-1 text-right font-mono font-medium whitespace-nowrap">
          {netOpStr}
        </td>
        <td className="border border-gray-900 p-1 text-right font-mono font-medium whitespace-nowrap text-red-700">
          {totals.transDr > 0 ? fmtCurrency(totals.transDr, isMarathiDigits) : '-'}
        </td>
        <td className="border border-gray-900 p-1 text-right font-mono font-medium whitespace-nowrap text-emerald-800">
          {totals.transCr > 0 ? fmtCurrency(totals.transCr, isMarathiDigits) : '-'}
        </td>
        <td className="border border-gray-900 p-1 text-right font-mono font-bold whitespace-nowrap text-gray-950">
          {netClosingStr}
        </td>
      </tr>
      {expanded &&
        hasChildren &&
        node.children.map((child, idx) => (
          <NamunaTreeNode
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

export default function TrialBalanceNamunaN() {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reportData, setReportData] = useState<ReportNode[]>([]);
  const [accountGroups, setAccountGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'transactionsOnly' | 'active' | 'all'>('active');
  const [viewMode, setViewMode] = useState<'terij1' | 'tree'>('terij1');
  const [digitMode, setDigitMode] = useState<'marathi' | 'english'>('marathi');
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

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
        const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSansthaDetail(parsed[0]);
        } else if (parsed && !Array.isArray(parsed)) {
          setSansthaDetail(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sanstha detail', err);
    }
  };

  const fetchInitData = async () => {
    try {
      const [resFy, resBranches, resGroups] = await Promise.all([
        axios.get('/api/FinancialYears'),
        axios.get('/api/Branches'),
        axios.get('/api/AccountGroups').catch(() => ({ data: [] })),
      ]);

      const fyData = typeof resFy.data === 'string' ? JSON.parse(resFy.data) : resFy.data;
      if (fyData && Array.isArray(fyData)) {
        const active = fyData.find((y: any) => y.isActive);
        if (active) {
          setFromDate(active.startDate.split('T')[0]);
          if (user?.businessDate) {
            setToDate(user.businessDate.split('T')[0]);
          } else {
            setToDate(active.endDate.split('T')[0]);
          }
        }
      }

      const branchData = typeof resBranches.data === 'string' ? JSON.parse(resBranches.data) : resBranches.data;
      if (Array.isArray(branchData)) {
        setBranches(branchData);
      }

      const groupsData = typeof resGroups.data === 'string' ? JSON.parse(resGroups.data) : resGroups.data;
      if (Array.isArray(groupsData)) {
        setAccountGroups(groupsData);
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

  const enrichedReportData = enrichTreeWithNature(reportData, accountGroups);

  const flattenLedgers = (nodes: ReportNode[], inheritedNature: string = ''): ReportNode[] => {
    let result: ReportNode[] = [];
    for (const node of nodes) {
      const currentNature = node.nature || inheritedNature || '';
      if (!node.isGroup) {
        const hasTransactions = Math.abs(node.totalDebit) >= 0.01 || Math.abs(node.totalCredit) >= 0.01;
        const hasBalance = Math.abs(node.openingBalance) >= 0.01 || Math.abs(node.closingBalance) >= 0.01;

        const enriched: ReportNode = { ...node, nature: currentNature };
        if (filterMode === 'transactionsOnly') {
          if (hasTransactions) result.push(enriched);
        } else if (filterMode === 'active') {
          if (hasTransactions || hasBalance) result.push(enriched);
        } else {
          result.push(enriched);
        }
      }
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenLedgers(node.children, currentNature));
      }
    }
    return result;
  };

  const flatList = flattenLedgers(enrichedReportData).filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(term) ||
      (item.code && item.code.toLowerCase().includes(term)) ||
      item.id.toString().includes(term)
    );
  });

  // Classify into Section 1 (भांडवल / देयता-) and Section 2 (संपत्ती / मालमत्ता)
  const liabilityRows: TerijSectionRow[] = [];
  const incomeRows: TerijSectionRow[] = [];
  const assetRows: TerijSectionRow[] = [];
  const expenseRows: TerijSectionRow[] = [];

  flatList.forEach(node => {
    const nat = (node.nature || '').trim();
    const opDr = node.openingType === 'Dr' ? node.openingBalance : 0;
    const opCr = node.openingType === 'Cr' ? node.openingBalance : 0;
    const dr = node.totalDebit || 0;
    const cr = node.totalCredit || 0;

    const isLiabilitySide =
      nat === 'Liabilities' ||
      nat === 'Income' ||
      (!nat && (node.closingType === 'Cr' || (node.closingBalance === 0 && node.openingType === 'Cr')));

    if (isLiabilitySide) {
      const signedOp = opCr - opDr;
      const signedCl = signedOp - dr + cr;
      const row: TerijSectionRow = {
        id: node.id,
        code: String(node.code || node.id),
        name: node.name,
        nature: nat || 'Liabilities',
        signedOpening: signedOp,
        debit: dr,
        credit: cr,
        signedClosing: signedCl,
      };
      if (nat === 'Income') {
        incomeRows.push(row);
      } else {
        liabilityRows.push(row);
      }
    } else {
      const signedOp = opDr - opCr;
      const signedCl = signedOp + dr - cr;
      const row: TerijSectionRow = {
        id: node.id,
        code: String(node.code || node.id),
        name: node.name,
        nature: nat || 'Assets',
        signedOpening: signedOp,
        debit: dr,
        credit: cr,
        signedClosing: signedCl,
      };
      if (nat === 'Expenses') {
        expenseRows.push(row);
      } else {
        assetRows.push(row);
      }
    }
  });

  const parseCodeNum = (c: string) => {
    const n = parseInt(c, 10);
    return isNaN(n) ? 999999 : n;
  };

  liabilityRows.sort((a, b) => parseCodeNum(a.code) - parseCodeNum(b.code));
  assetRows.sort((a, b) => {
    const aIsCash = a.name.includes('रोख शिल्लक') || a.name.toLowerCase().includes('cash in hand') ? 0 : 1;
    const bIsCash = b.name.includes('रोख शिल्लक') || b.name.toLowerCase().includes('cash in hand') ? 0 : 1;
    if (aIsCash !== bIsCash) return aIsCash - bIsCash;
    return 0;
  });

  const section1Rows: TerijSectionRow[] = [...liabilityRows, ...incomeRows];
  const section2Rows: TerijSectionRow[] = [...assetRows, ...expenseRows];

  const sec1OpeningTotal = section1Rows.reduce((s, r) => s + r.signedOpening, 0);
  const sec1DebitTotal = section1Rows.reduce((s, r) => s + r.debit, 0);
  const sec1CreditTotal = section1Rows.reduce((s, r) => s + r.credit, 0);
  const sec1ClosingTotal = section1Rows.reduce((s, r) => s + r.signedClosing, 0);

  const sec2OpeningTotal = section2Rows.reduce((s, r) => s + r.signedOpening, 0);
  const sec2DebitTotal = section2Rows.reduce((s, r) => s + r.debit, 0);
  const sec2CreditTotal = section2Rows.reduce((s, r) => s + r.credit, 0);
  const sec2ClosingTotal = section2Rows.reduce((s, r) => s + r.signedClosing, 0);

  const grandTotalDebit = sec1DebitTotal + sec2DebitTotal;
  const grandTotalCredit = sec1CreditTotal + sec2CreditTotal;

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
            matchSearch =
              node.name.toLowerCase().includes(term) ||
              Boolean(node.code && node.code.toLowerCase().includes(term)) ||
              node.id.toString().includes(term);
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

  const filteredReportData = filterTreeNodes(enrichedReportData);

  const sortTreeGroups = (a: ReportNode, b: ReportNode) => {
    const orderA = a.displayOrder && a.displayOrder > 0 ? a.displayOrder : 9999;
    const orderB = b.displayOrder && b.displayOrder > 0 ? b.displayOrder : 9999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id || 0) - (b.id || 0);
  };

  const liabilityTreeNodes = filteredReportData
    .filter(n => n.nature === 'Liabilities' || (!n.nature && getNodeTotals(n).clCr >= getNodeTotals(n).clDr))
    .sort(sortTreeGroups);
  const incomeTreeNodes = filteredReportData.filter(n => n.nature === 'Income').sort(sortTreeGroups);
  const assetTreeNodes = filteredReportData
    .filter(n => n.nature === 'Assets' || (!n.nature && getNodeTotals(n).clDr > getNodeTotals(n).clCr))
    .sort(sortTreeGroups);
  const expenseTreeNodes = filteredReportData.filter(n => n.nature === 'Expenses').sort(sortTreeGroups);

  const section1TreeNodes: ReportNode[] = [...liabilityTreeNodes, ...incomeTreeNodes];
  const section2TreeNodes: ReportNode[] = [...assetTreeNodes, ...expenseTreeNodes];

  const isMarathiDigits = digitMode === 'marathi';
  const closingDifference = Math.abs(sec1ClosingTotal - sec2ClosingTotal);
  const isBalanced = closingDifference < 0.05 && Math.abs(grandTotalDebit - grandTotalCredit) < 0.05;

  const handleExportExcel = () => {
    if (flatList.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const aoa: any[][] = [];
    aoa.push([sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित']);
    aoa.push([`तेरीज पत्रक नं - १ | दिनांक : ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)} अखेर`]);
    aoa.push([]);

    aoa.push(['भांडवल / देयता-']);
    aoa.push([
      'खाते नाव',
      `आरंभीची शिल्लक (${formatDisplayDate(fromDate)})`,
      'नावे',
      'जमा',
      `अखेरची शिल्लक (${formatDisplayDate(toDate)})`,
    ]);
    section1Rows.forEach(r => {
      aoa.push([`${r.code} ${r.name}`, r.signedOpening, r.debit, r.credit, r.signedClosing]);
    });
    aoa.push(['एकूण (भांडवल / देयता)', sec1OpeningTotal, sec1DebitTotal, sec1CreditTotal, sec1ClosingTotal]);
    aoa.push([]);

    aoa.push(['संपत्ती / मालमत्ता']);
    aoa.push([
      'खाते नाव',
      `आरंभीची शिल्लक (${formatDisplayDate(fromDate)})`,
      'नावे',
      'जमा',
      `अखेरची शिल्लक (${formatDisplayDate(toDate)})`,
    ]);
    section2Rows.forEach(r => {
      aoa.push([`${r.code} ${r.name}`, r.signedOpening, r.debit, r.credit, r.signedClosing]);
    });
    aoa.push(['एकूण (संपत्ती / मालमत्ता)', sec2OpeningTotal, grandTotalDebit, grandTotalCredit, sec2ClosingTotal]);
    aoa.push([]);

    aoa.push(['ताळमेळ सारांश', 'आरंभीची शिल्लक', 'अखेरची शिल्लक', 'एकूण जमा', 'एकूण नावे']);
    aoa.push(['भांडवल / देयता-', sec1OpeningTotal, sec1ClosingTotal, grandTotalCredit, grandTotalDebit]);
    aoa.push(['संपत्ती / मालमत्ता -', sec2OpeningTotal, sec2ClosingTotal, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'तेरीज पत्रक नं १');
    XLSX.writeFile(wb, `Namuna_N_Terij_Patrak_${toDate || new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const fromDisplayRaw = formatDisplayDate(fromDate);
  const toDisplayRaw = formatDisplayDate(toDate);
  const fromDisplay = isMarathiDigits ? toMarathiDigits(fromDisplayRaw) : fromDisplayRaw;
  const toDisplay = isMarathiDigits ? toMarathiDigits(toDisplayRaw) : toDisplayRaw;
  const periodTextStr = `दिनांक :${fromDisplay} ते ${toDisplay} अखेर`;

  const sansthaDisplayName =
    sansthaDetail?.sansthaName || 'श्री गुरुदेव पगारदार नोकरांची सहकारी पतसंस्था मर्यादीत';
  const regNoRaw = sansthaDetail?.registrationNo || 'SAN/BNK/११२ ऑफ १९६५';
  const regNoText = isMarathiDigits ? toMarathiDigits(regNoRaw) : regNoRaw;
  const regDateRaw = sansthaDetail?.registrationDate
    ? formatDisplayDate(sansthaDetail.registrationDate)
    : '०१/१०/१९६५';
  const regDateText = isMarathiDigits ? toMarathiDigits(regDateRaw) : regDateRaw;
  const addressLine = [
    sansthaDetail?.village || 'सांगली',
    sansthaDetail?.taluka ? `ता - ${sansthaDetail.taluka}` : 'ता - मिरज',
    sansthaDetail?.district ? `जि - ${sansthaDetail.district}` : 'जि - सांगली',
  ]
    .filter(Boolean)
    .join(' ');

  const renderTerijSectionHeader = (sectionTitle: string) => (
    <div className="mb-1.5">
      <div className="border border-gray-900 px-3 py-2 text-center text-gray-950 bg-white">
        <div className="flex justify-between items-center text-xs font-bold px-1 mb-0.5">
          <div className="text-left">
            <span>रजि. नं.- </span>
            <span>{regNoText}</span>
          </div>
          <div className="text-right">
            <span>रजि.दि.- </span>
            <span>{regDateText}</span>
          </div>
        </div>
        <h1 className="text-base sm:text-lg font-extrabold tracking-wide text-gray-950">
          {sansthaDisplayName}
        </h1>
        <p className="text-xs font-bold text-gray-900 mt-0.5">{addressLine}</p>
      </div>

      <div className="flex items-end justify-between mt-2 mb-1 px-0.5">
        <div className="w-1/3 text-left font-extrabold text-xs sm:text-sm text-gray-950">
          {sectionTitle}
        </div>
        <div className="w-1/3 text-center">
          <span className="inline-block border border-gray-500 px-5 py-0.5 font-extrabold text-sm sm:text-base text-gray-950 bg-white">
            {isMarathiDigits ? 'तेरीज पत्रक नं -१' : 'तेरीज पत्रक नं -1'}
          </span>
        </div>
        <div className="w-1/3 text-right font-bold text-[11px] sm:text-xs text-gray-950">
          {periodTextStr}
        </div>
      </div>
    </div>
  );

  const renderReconciliationBlock = () => (
    <div className="mt-2 border-t-2 border-b border-gray-900 py-2.5 px-3 text-xs text-gray-950 break-inside-avoid">
      <div className="grid grid-cols-5 gap-2 font-bold text-center mb-1.5">
        <div className="text-left"></div>
        <div>आरंभीची शिल्लक</div>
        <div>अखेरची शिल्लक</div>
        <div>एकूण जमा</div>
        <div>एकूण नावे</div>
      </div>

      <div className="grid grid-cols-5 gap-2 font-bold items-center py-0.5">
        <div className="text-right pr-3">भांडवल /देयता-</div>
        <div className="text-center font-mono">{fmtTerijAmount(sec1OpeningTotal, isMarathiDigits)}</div>
        <div className="text-center font-mono">{fmtTerijAmount(sec1ClosingTotal, isMarathiDigits)}</div>
        <div className="text-center font-mono">{fmtTerijAmount(grandTotalCredit, isMarathiDigits)}</div>
        <div className="text-center font-mono">{fmtTerijAmount(grandTotalDebit, isMarathiDigits)}</div>
      </div>

      <div className="grid grid-cols-5 gap-2 font-bold items-center py-0.5 mt-0.5">
        <div className="text-right pr-3">संपत्ती / मालमत्ता -</div>
        <div className="text-center font-mono">{fmtTerijAmount(sec2OpeningTotal, isMarathiDigits)}</div>
        <div className="text-center font-mono">{fmtTerijAmount(sec2ClosingTotal, isMarathiDigits)}</div>
        <div></div>
        <div></div>
      </div>

      <div className="text-center mt-2">
        {isBalanced ? (
          <span className="font-extrabold text-sm tracking-wide text-red-800">Account Tallied...</span>
        ) : (
          <span className="font-extrabold text-sm tracking-wide text-rose-700">
            Account Not Tallied (फरक: {fmtTerijAmount(closingDifference, isMarathiDigits)})
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
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

      {/* Filter Control Panel */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>तेरीज पत्रक नं - १ (नमुना 'न')</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">
                (Namuna N Trial Balance)
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-sm border border-gray-300 p-0.5 bg-slate-50 h-6 items-center">
              <button
                type="button"
                onClick={() => setViewMode('terij1')}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs transition-all flex items-center gap-0.5 cursor-pointer ${
                  viewMode === 'terij1' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <FileText size={10} />
                <span>तेरीज पत्रक नं-१</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs transition-all flex items-center gap-0.5 cursor-pointer ${
                  viewMode === 'tree' ? 'bg-primary text-white shadow-2xs' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <ListFilter size={10} />
                <span>ग्रुप ट्री</span>
              </button>
            </div>

            {branches.length > 1 && (
              <div className="flex items-center gap-1">
                <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary w-28 sm:w-32"
                >
                  <option value="all">सर्व शाखा (All)</option>
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID.toString()}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary w-28"
              />
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary w-28"
              />
            </div>

            <div className="w-auto min-w-[160px]">
              <select
                value={filterMode}
                onChange={(e: any) => setFilterMode(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary w-full text-primary"
              >
                <option value="active">● सक्रिय खाती (Active)</option>
                <option value="transactionsOnly">फक्त व्यवहार झालेली खाती</option>
                <option value="all">सर्व खाती (शून्य शिल्लक सह)</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <select
                value={digitMode}
                onChange={e => setDigitMode(e.target.value as 'marathi' | 'english')}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-semibold bg-white focus:outline-none focus:border-primary"
              >
                <option value="marathi">मराठी अंक (१, २, ३)</option>
                <option value="english">इंग्रजी अंक (1, 2, 3)</option>
              </select>
            </div>

            <button
              onClick={fetchReport}
              disabled={loading}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
              <span>पहा</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={flatList.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${
                flatList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={flatList.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${
                flatList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
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
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
              एकूण खाती: <strong className="text-primary font-bold">{flatList.length}</strong> (भांडवल/देयता:{' '}
              <strong>{section1Rows.length}</strong> | संपत्ती/मालमत्ता: <strong>{section2Rows.length}</strong>)
            </span>
            <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
              एकूण नावे: <strong className="text-red-700 font-bold">₹ {fmtCurrency(grandTotalDebit, isMarathiDigits)}</strong> |
              एकूण जमा: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(grandTotalCredit, isMarathiDigits)}</strong>
            </span>
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold">
                <CheckCircle2 size={12} /> Account Tallied...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-bold">
                <AlertTriangle size={12} /> फरक: ₹ {fmtCurrency(closingDifference, isMarathiDigits)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Printable A4 Container */}
      <div
        ref={reportRef}
        className="print-area bg-white mx-auto max-w-5xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between text-xs"
      >
        {viewMode === 'terij1' ? (
          <div className="space-y-8 print:space-y-0">
            {/* ================================================================= */}
            {/* PAGE 1: भांडवल / देयता-                                            */}
            {/* ================================================================= */}
            <div>
              {renderTerijSectionHeader('भांडवल /देयता-')}

              <table className="w-full border-collapse border border-gray-900 text-xs">
                <thead>
                  <tr className="bg-white text-gray-950 border-b border-gray-900 text-center font-bold text-xs">
                    <th className="border border-gray-900 py-1.5 px-2 w-[36%] text-center">खाते नाव</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center leading-tight">
                      आरंभीची शिल्लक
                      <br />
                      <span className="font-mono text-[11px]">{fromDisplay}</span>
                    </th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center">नावे</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center">जमा</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center leading-tight">
                      अखेरची शिल्लक
                      <br />
                      <span className="font-mono text-[11px]">{toDisplay}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section1Rows.map(row => {
                    const codeText = isMarathiDigits ? toMarathiDigits(row.code) : row.code;
                    return (
                      <tr key={`s1-${row.id}`} className="hover:bg-slate-50 text-gray-950 text-[11.5px]">
                        <td className="border border-gray-900 py-0.5 px-2.5 text-left font-medium">
                          <span className="font-mono mr-1.5">{codeText}</span>
                          <span>{row.name}</span>
                        </td>
                        <td className="border border-gray-900 py-0.5 px-2 text-right font-mono">
                          {fmtTerijAmount(row.signedOpening, isMarathiDigits)}
                        </td>
                        <td className="border border-gray-900 py-0.5 px-2 text-right font-mono">
                          {fmtTerijAmount(row.debit, isMarathiDigits)}
                        </td>
                        <td className="border border-gray-900 py-0.5 px-2 text-right font-mono">
                          {fmtTerijAmount(row.credit, isMarathiDigits)}
                        </td>
                        <td className="border border-gray-900 py-0.5 px-2 text-right font-mono">
                          {fmtTerijAmount(row.signedClosing, isMarathiDigits)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-white font-extrabold text-gray-950 border-t-2 border-b-2 border-gray-900 text-xs">
                    <td className="border border-gray-900 py-1.5 px-4 text-right">एकूण</td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtTerijAmount(sec1OpeningTotal, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtTerijAmount(sec1DebitTotal, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtTerijAmount(sec1CreditTotal, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtTerijAmount(sec1ClosingTotal, isMarathiDigits)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ================================================================= */}
            {/* PAGE 2: संपत्ती / मालमत्ता (Starts on New Page)                     */}
            {/* ================================================================= */}
            <div className="pt-4 print:pt-0 break-before-page" style={{ pageBreakBefore: 'always' }}>
              {renderTerijSectionHeader('संपत्ती / मालमत्ता')}

              <table className="w-full border-collapse border border-gray-900 text-xs">
                <thead>
                  <tr className="bg-white text-gray-950 border-b border-gray-900 text-center font-bold text-xs">
                    <th className="border border-gray-900 py-1.5 px-2 w-[36%] text-center">खाते नाव</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center leading-tight">
                      आरंभीची शिल्लक
                      <br />
                      <span className="font-mono text-[11px]">{fromDisplay}</span>
                    </th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center">नावे</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center">जमा</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center leading-tight">
                      अखेरची शिल्लक
                      <br />
                      <span className="font-mono text-[11px]">{toDisplay}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section2Rows.map(row => {
                    const codeText = isMarathiDigits ? toMarathiDigits(row.code) : row.code;
                    return (
                      <tr key={`s2-${row.id}`} className="hover:bg-slate-50 text-gray-950 text-[11.5px]">
                        <td className="border border-gray-900 py-0.5 px-2.5 text-left font-medium">
                          <span className="font-mono mr-1.5">{codeText}</span>
                          <span>{row.name}</span>
                        </td>
                        <td className="border border-gray-900 py-0.5 px-2 text-right font-mono">
                          {fmtTerijAmount(row.signedOpening, isMarathiDigits)}
                        </td>
                        <td className="border border-gray-900 py-0.5 px-2 text-right font-mono">
                          {fmtTerijAmount(row.debit, isMarathiDigits)}
                        </td>
                        <td className="border border-gray-900 py-0.5 px-2 text-right font-mono">
                          {fmtTerijAmount(row.credit, isMarathiDigits)}
                        </td>
                        <td className="border border-gray-900 py-0.5 px-2 text-right font-mono">
                          {fmtTerijAmount(row.signedClosing, isMarathiDigits)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-white font-extrabold text-gray-950 border-t-2 border-b-2 border-gray-900 text-xs">
                    <td className="border border-gray-900 py-1.5 px-4 text-right">एकूण</td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtTerijAmount(sec2OpeningTotal, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtTerijAmount(grandTotalDebit, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtTerijAmount(grandTotalCredit, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtTerijAmount(sec2ClosingTotal, isMarathiDigits)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {renderReconciliationBlock()}
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* GROUP TREE VIEW — TWO-SECTION LAYOUT                                */
          /* Page 1: भांडवल / देयता-  |  Page 2: संपत्ती / मालमत्ता               */
          /* =================================================================== */
          <div className="space-y-8 print:space-y-0">
            {/* Page 1: भांडवल / देयता- Group Tree */}
            <div>
              {renderTerijSectionHeader('भांडवल /देयता-')}

              <table className="w-full border-collapse border border-gray-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-gray-950 border-b border-gray-900 text-center font-bold">
                    <th className="border border-gray-900 py-1.5 px-1 w-[6%] text-center">अ. क्र.</th>
                    <th className="border border-gray-900 py-1.5 px-3 text-left">
                      खाते / लेजर नाव (भांडवल / देयता)
                    </th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right">
                      आरंभीची शिल्लक ({fromDisplay})
                    </th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[15%] text-right">नावे व्यवहार (Dr ₹)</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[15%] text-right">जमा व्यवहार (Cr ₹)</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right font-extrabold">
                      अखेरची शिल्लक ({toDisplay})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section1TreeNodes.map((node, index) => (
                    <NamunaTreeNode
                      key={`namuna-s1-${node.id}`}
                      node={node}
                      level={0}
                      indexStr={`${index + 1}`}
                      isMarathiDigits={isMarathiDigits}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 font-extrabold text-gray-950 border-t-2 border-b-2 border-gray-900 text-xs">
                    <td colSpan={2} className="border border-gray-900 py-1.5 px-3 text-right">
                      एकूण (भांडवल / देयता-):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtCurrency(Math.abs(sec1OpeningTotal), isMarathiDigits)}{' '}
                      {sec1OpeningTotal >= 0 ? 'Cr' : 'Dr'}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono text-red-700">
                      ₹ {fmtCurrency(sec1DebitTotal, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono text-emerald-800">
                      ₹ {fmtCurrency(sec1CreditTotal, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono text-gray-950">
                      {fmtCurrency(Math.abs(sec1ClosingTotal), isMarathiDigits)}{' '}
                      {sec1ClosingTotal >= 0 ? 'Cr' : 'Dr'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Page 2: संपत्ती / मालमत्ता Group Tree */}
            <div className="pt-4 print:pt-0 break-before-page" style={{ pageBreakBefore: 'always' }}>
              {renderTerijSectionHeader('संपत्ती / मालमत्ता')}

              <table className="w-full border-collapse border border-gray-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-gray-950 border-b border-gray-900 text-center font-bold">
                    <th className="border border-gray-900 py-1.5 px-1 w-[6%] text-center">अ. क्र.</th>
                    <th className="border border-gray-900 py-1.5 px-3 text-left">
                      खाते / लेजर नाव (संपत्ती / मालमत्ता)
                    </th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right">
                      आरंभीची शिल्लक ({fromDisplay})
                    </th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[15%] text-right">नावे व्यवहार (Dr ₹)</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[15%] text-right">जमा व्यवहार (Cr ₹)</th>
                    <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right font-extrabold">
                      अखेरची शिल्लक ({toDisplay})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {section2TreeNodes.map((node, index) => (
                    <NamunaTreeNode
                      key={`namuna-s2-${node.id}`}
                      node={node}
                      level={0}
                      indexStr={`${index + 1}`}
                      isMarathiDigits={isMarathiDigits}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 font-extrabold text-gray-950 border-t-2 border-b-2 border-gray-900 text-xs">
                    <td colSpan={2} className="border border-gray-900 py-1.5 px-3 text-right">
                      एकूण (संपत्ती / मालमत्ता):
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono">
                      {fmtCurrency(Math.abs(sec2OpeningTotal), isMarathiDigits)}{' '}
                      {sec2OpeningTotal >= 0 ? 'Dr' : 'Cr'}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono text-red-700">
                      ₹ {fmtCurrency(sec2DebitTotal, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono text-emerald-800">
                      ₹ {fmtCurrency(sec2CreditTotal, isMarathiDigits)}
                    </td>
                    <td className="border border-gray-900 py-1.5 px-2 text-right font-mono text-gray-950">
                      {fmtCurrency(Math.abs(sec2ClosingTotal), isMarathiDigits)}{' '}
                      {sec2ClosingTotal >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {renderReconciliationBlock()}
            </div>
          </div>
        )}

        {/* Verification Signatures Section */}
        <div className="mt-10 pt-4 border-t border-dashed border-gray-400 grid grid-cols-4 text-center text-xs font-bold text-gray-900 break-inside-avoid">
          <div>
            <div className="h-8"></div>
            <p className="border-t border-gray-800 mx-3 pt-1">अध्यक्ष</p>
          </div>
          <div>
            <div className="h-8"></div>
            <p className="border-t border-gray-800 mx-3 pt-1">संचालक मंडळ</p>
          </div>
          <div>
            <div className="h-8"></div>
            <p className="border-t border-gray-800 mx-3 pt-1">व्यवस्थापक / सचिव</p>
          </div>
          <div>
            <div className="h-8"></div>
            <p className="border-t border-gray-800 mx-3 pt-1">वैधानिक लेखापरीक्षक</p>
          </div>
        </div>
      </div>
    </div>
  );
}

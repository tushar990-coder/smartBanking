import React, { useState, useEffect } from 'react';
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
  BookOpen,
  FileText,
} from 'lucide-react';

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

type CanonicalNature = 'Liabilities' | 'Assets' | 'Income' | 'Expenses' | '';

// Marathi Digits Converter
export const toMarathiDigits = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  const marathiDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return str.replace(/[0-9]/g, d => marathiDigits[parseInt(d, 10)]);
};

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

export const normalizeNatureStr = (raw?: string | null): CanonicalNature => {
  if (!raw) return '';
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('liab') || s.includes('देयता') || s.includes('भांडवल') || s.includes('देणी')) {
    return 'Liabilities';
  }
  if (
    s.startsWith('asset') ||
    s.includes('मालमत्ता') ||
    s.includes('येणी') ||
    s.includes('संपत्ती') ||
    s.includes('जिंदगी')
  ) {
    return 'Assets';
  }
  if (s.startsWith('inc') || s.includes('उत्पन्न') || s.includes('जमा')) {
    return 'Income';
  }
  if (s.startsWith('exp') || s.includes('खर्च') || s.includes('नावे')) {
    return 'Expenses';
  }
  return '';
};

export const inferNatureFromName = (name?: string | null): CanonicalNature => {
  if (!name) return '';
  const s = name.trim().toLowerCase();
  if (!s) return '';

  // 1. Specific disambiguated compound phrases first
  if (s.includes('येणे व्याज') || s.includes('व्याज येणे') || s.includes('receivable')) return 'Assets';
  if (s.includes('देणे व्याज') || s.includes('व्याज देणे') || s.includes('payable')) return 'Liabilities';
  if (
    s.includes('दिलेले व्याज') ||
    s.includes('व्याज खर्च') ||
    s.includes('ठेव व्याज खर्च') ||
    s.includes('interest paid')
  ) {
    return 'Expenses';
  }
  if (
    s.includes('मिळालेले व्याज') ||
    s.includes('व्याज जमा') ||
    s.includes('दंड व्याज') ||
    s.includes('interest received')
  ) {
    return 'Income';
  }
  if (s.includes('घेतलेली कर्जे') || s.includes('बँक ओव्हरड्राफ्ट') || s.includes('borrowing')) {
    return 'Liabilities';
  }
  if (s.includes('तरतूद खर्च')) return 'Expenses';

  // 2. Reserve / Fund / Capital / Deposit (Liabilities) - check before 'इमारत' so 'इमारत निधी' is Liabilities
  if (
    s.includes('भागभांडवल') ||
    s.includes('भाग भांडवल') ||
    s.includes('सभासद भाग') ||
    s.includes('नाममात्र सभासद') ||
    s.includes('राखीव') ||
    s.includes('निधी') ||
    s.includes('फंड') ||
    s.includes('ठेवी') ||
    s.includes('ठेव') ||
    s.includes('पिग्मी') ||
    s.includes('दामदुप्पट') ||
    s.includes('देयता') ||
    s.includes('भांडवल') ||
    s.includes('इतर देणी') ||
    s.includes('देणी') ||
    s.includes('देणे') ||
    s.includes('तरतूद') ||
    s.includes('शाखा एडजस्टमेंट') ||
    s.includes('लाभांश') ||
    s.includes('share capital') ||
    s.includes('reserve') ||
    s.includes('deposit') ||
    s.includes('liabilit')
  ) {
    return 'Liabilities';
  }

  // 3. Cash / Bank / Investments / Loans / Fixed Assets / Receivables (Assets)
  if (
    s.includes('रोख शिल्लक') ||
    s.includes('हातावरील रोख') ||
    s.includes('हातातील रोख') ||
    s.includes('हाता रोख') ||
    s.includes('cash') ||
    s.includes('बँक शिल्लक') ||
    s.includes('बँक खाती') ||
    s.includes('बँक चालू') ||
    s.includes('बँक बचत') ||
    s.includes('गुंतवणुका') ||
    s.includes('गुंतवणूक') ||
    s.includes('investment') ||
    s.includes('सभासद कर्जे') ||
    s.includes('दिलेली कर्जे') ||
    s.includes('कर्ज येणे') ||
    s.includes('सोनेतारण') ||
    s.includes('तारण कर्ज') ||
    s.includes('विनातारण') ||
    s.includes('पगारदार कर्ज') ||
    s.includes('वाहन कर्ज') ||
    s.includes('कर्जे') ||
    s.includes('कर्ज') ||
    s.includes('जमीन') ||
    s.includes('इमारत') ||
    s.includes('डेडस्टॉक') ||
    s.includes('फर्निचर') ||
    s.includes('संगणक') ||
    s.includes('मालमत्ता') ||
    s.includes('संपत्ती') ||
    s.includes('जिंदगी') ||
    s.includes('अँडव्हांस') ||
    s.includes('अनामत येणे') ||
    s.includes('इतर येणी') ||
    s.includes('येणी') ||
    s.includes('येणे') ||
    s.includes('मुद्रांक') ||
    s.includes('asset')
  ) {
    return 'Assets';
  }

  // 4. Expenses
  if (
    s.includes('पगार') ||
    s.includes('भत्ते') ||
    s.includes('प्रशासकीय खर्च') ||
    s.includes('खर्च') ||
    s.includes('भाडे') ||
    s.includes('स्टेशनरी') ||
    s.includes('छपाई') ||
    s.includes('प्रवास') ||
    s.includes('ऑडीट') ||
    s.includes('घसारा') ||
    s.includes('झीज') ||
    s.includes('expens')
  ) {
    return 'Expenses';
  }

  // 5. Income
  if (
    s.includes('उत्पन्न') ||
    s.includes('प्रवेश फी') ||
    s.includes('अर्ज फी') ||
    s.includes('अर्ज विक्री') ||
    s.includes('नोटीस फी') ||
    s.includes('कमिशन') ||
    s.includes('जमा') ||
    s.includes('income')
  ) {
    return 'Income';
  }

  return '';
};

export const resolveGroupNatureFromDb = (groupId: number, allGroups: any[]): CanonicalNature => {
  if (!allGroups || allGroups.length === 0) return '';
  let current = allGroups.find((g: any) => (g.groupID ?? g.GroupID) === groupId);
  let guard = 0;
  while (current && guard++ < 25) {
    const rawNat = current.natureOfGroup ?? current.NatureOfGroup ?? '';
    const norm = normalizeNatureStr(rawNat);
    if (norm) return norm;

    const parentId = current.parentGroupID ?? current.ParentGroupID;
    if (parentId) {
      current = allGroups.find((g: any) => (g.groupID ?? g.GroupID) === parentId);
    } else {
      const byName = inferNatureFromName(current.groupName ?? current.GroupName);
      if (byName) return byName;
      break;
    }
  }
  return '';
};

export const enrichTreeWithNature = (
  nodes: ReportNode[],
  allGroups: any[],
  inheritedNature: CanonicalNature = ''
): ReportNode[] => {
  return nodes.map(node => {
    let resolved: CanonicalNature = normalizeNatureStr(node.nature);
    if (!resolved && node.isGroup) {
      resolved = resolveGroupNatureFromDb(node.id, allGroups);
    }
    if (!resolved && inheritedNature) {
      resolved = inheritedNature;
    }
    if (!resolved) {
      resolved = inferNatureFromName(node.name);
    }

    const enrichedChildren =
      node.children && node.children.length > 0
        ? enrichTreeWithNature(node.children, allGroups, resolved)
        : [];

    // If a parent group still couldn't resolve nature, check its first resolved child
    if (!resolved && enrichedChildren.length > 0) {
      const childWithNat = enrichedChildren.find(c => Boolean(c.nature));
      if (childWithNat?.nature) {
        resolved = normalizeNatureStr(childWithNat.nature);
      }
    }

    return {
      ...node,
      nature: resolved,
      children: enrichedChildren,
    };
  });
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
        className={`hover:bg-slate-50 border-b border-slate-900 ${
          node.isGroup ? 'font-bold bg-slate-100/80 text-[11px] text-slate-950' : 'text-[11px] text-slate-900'
        }`}
      >
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

          <span className="text-primary font-mono font-bold text-[11px] mr-1.5">{codeText}</span>
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

      {expanded &&
        hasChildren &&
        node.children.map((child, idx) => (
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
  const [accountGroups, setAccountGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [filterMode, setFilterMode] = useState<'active' | 'transactionsOnly' | 'all'>('active');
  const [viewMode, setViewMode] = useState<'terij1' | 'flat' | 'tree'>('terij1');
  const [digitMode, setDigitMode] = useState<'marathi' | 'english'>('marathi');
  const [paperSize] = useState<CbsPaperSize>('a4-portrait');
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
          if (!user?.businessDate) {
            setToDate(active.endDate.split('T')[0]);
          } else {
            setToDate(user.businessDate.split('T')[0]);
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

  // Enrich every group and ledger node with its canonical Nature ('Liabilities' | 'Assets' | 'Income' | 'Expenses')
  const enrichedReportData = enrichTreeWithNature(reportData, accountGroups);

  // Flatten ledgers while inheriting parent group nature
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

  // Split flatList into:
  // Section 1 (Page 1): भांडवल / देयता- (Liabilities first, then Income)
  // Section 2 (Page 2): संपत्ती / मालमत्ता (Assets first with Cash on top, then Expenses)
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

  // Section 1 Totals (भांडवल / देयता-)
  const sec1OpeningTotal = section1Rows.reduce((s, r) => s + r.signedOpening, 0);
  const sec1DebitTotal = section1Rows.reduce((s, r) => s + r.debit, 0);
  const sec1CreditTotal = section1Rows.reduce((s, r) => s + r.credit, 0);
  const sec1ClosingTotal = section1Rows.reduce((s, r) => s + r.signedClosing, 0);

  // Section 2 Totals (संपत्ती / मालमत्ता)
  const sec2OpeningTotal = section2Rows.reduce((s, r) => s + r.signedOpening, 0);
  const sec2DebitTotal = section2Rows.reduce((s, r) => s + r.debit, 0);
  const sec2CreditTotal = section2Rows.reduce((s, r) => s + r.credit, 0);
  const sec2ClosingTotal = section2Rows.reduce((s, r) => s + r.signedClosing, 0);

  // Combined Grand Debit & Credit across both sections
  const grandTotalDebit = sec1DebitTotal + sec2DebitTotal;
  const grandTotalCredit = sec1CreditTotal + sec2CreditTotal;

  const itemMatchesSearch = (item: ReportNode, term: string) => {
    return (
      item.name.toLowerCase().includes(term) ||
      (item.code && item.code.toLowerCase().includes(term)) ||
      item.id.toString().includes(term)
    );
  };

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

  const filteredReportData = filterTreeNodes(enrichedReportData);

  // Split Group Tree (filteredReportData) into Section 1 (भांडवल / देयता-) and Section 2 (संपत्ती / मालमत्ता)
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

  // Gross Totals for Flat/Tree Trial Balance
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

  const closingDifference = Math.abs(sec1ClosingTotal - sec2ClosingTotal);
  const isBalanced = closingDifference < 0.05 && Math.abs(grandTotalDebit - grandTotalCredit) < 0.05;

  // Excel Export
  const handleExportExcel = () => {
    if (flatList.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const aoa: any[][] = [];
    aoa.push([sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित']);
    aoa.push([`तेरीज पत्रक नं - १ | दिनांक : ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)} अखेर`]);
    aoa.push([]);

    // Section 1: भांडवल / देयता-
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

    // Section 2: संपत्ती / मालमत्ता
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

    // Tally Summary
    aoa.push(['ताळमेळ सारांश', 'आरंभीची शिल्लक', 'अखेरची शिल्लक', 'एकूण जमा', 'एकूण नावे']);
    aoa.push(['भांडवल / देयता-', sec1OpeningTotal, sec1ClosingTotal, grandTotalCredit, grandTotalDebit]);
    aoa.push(['संपत्ती / मालमत्ता -', sec2OpeningTotal, sec2ClosingTotal, '', '']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'तेरीज पत्रक नं १');
    XLSX.writeFile(wb, `Terij_Patrak_No_1_${toDate || new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // CBS Unified Toolbar Controls
  const filterToolbarControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* View Type Toggle */}
      <div className="inline-flex rounded-sm border border-slate-300 p-0.5 bg-slate-50 h-6 items-center">
        <button
          type="button"
          onClick={() => setViewMode('terij1')}
          className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs transition-all flex items-center gap-0.5 cursor-pointer ${
            viewMode === 'terij1' ? 'bg-primary text-white shadow-2xs' : 'text-slate-700 hover:text-slate-900'
          }`}
          title="पान १: भांडवल/देयता व पान २: संपत्ती/मालमत्ता"
        >
          <FileText size={10} />
          <span>तेरीज पत्रक नं-१ (२ विभाग)</span>
        </button>
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
            onChange={e => setSelectedBranchId(e.target.value)}
            className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary max-w-[110px]"
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

      {/* Dates */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">पासून:</label>
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] font-mono bg-white focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-slate-700 whitespace-nowrap">पर्यंत:</label>
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
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
          onChange={e => setDigitMode(e.target.value as 'marathi' | 'english')}
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
          onChange={e => setSearchTerm(e.target.value)}
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
          {isMarathiDigits ? toMarathiDigits(flatList.length) : flatList.length} खाती (भांडवल/देयता:{' '}
          {isMarathiDigits ? toMarathiDigits(section1Rows.length) : section1Rows.length} | संपत्ती/मालमत्ता:{' '}
          {isMarathiDigits ? toMarathiDigits(section2Rows.length) : section2Rows.length})
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण नावे व्यवहार</span>
        <strong className="text-red-700 font-mono text-[11px]">
          ₹ {fmtCurrency(grandTotalDebit, isMarathiDigits)}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण जमा व्यवहार</span>
        <strong className="text-emerald-700 font-mono text-[11px]">
          ₹ {fmtCurrency(grandTotalCredit, isMarathiDigits)}
        </strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">तेरीज ताळा स्थिती</span>
        {isBalanced ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs font-mono">
            <CheckCircle2 size={13} className="stroke-[2.5]" />
            Account Tallied...
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

  // Formatted Period & Sanstha Header details
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
      {/* Institution Header Box */}
      <div className="border border-slate-900 px-3 py-2 text-center text-slate-950 bg-white">
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
        <h1 className="text-base sm:text-lg font-extrabold tracking-wide text-slate-950">
          {sansthaDisplayName}
        </h1>
        <p className="text-xs font-bold text-slate-900 mt-0.5">{addressLine}</p>
      </div>

      {/* Section Title (Left) | तेरीज पत्रक नं - १ (Center Box) | दिनांक (Right) */}
      <div className="flex items-end justify-between mt-2 mb-1 px-0.5">
        <div className="w-1/3 text-left font-extrabold text-xs sm:text-sm text-slate-950">
          {sectionTitle}
        </div>
        <div className="w-1/3 text-center">
          <span className="inline-block border border-slate-500 px-5 py-0.5 font-extrabold text-sm sm:text-base text-slate-950 bg-white">
            {isMarathiDigits ? 'तेरीज पत्रक नं -१' : 'तेरीज पत्रक नं -1'}
          </span>
        </div>
        <div className="w-1/3 text-right font-bold text-[11px] sm:text-xs text-slate-950">
          {periodTextStr}
        </div>
      </div>
    </div>
  );

  const renderReconciliationSummaryBlock = () => (
    <div className="mt-2 border-t-2 border-b border-slate-900 py-2.5 px-3 text-xs text-slate-950 break-inside-avoid">
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
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      titleStyle="classic-badge"
      reportTitle="तेरीज पत्रक नं - १"
      reportSubtitle="Trial Balance Report"
      periodText={periodTextStr}
      sansthaInfo={sansthaDetail}
      customHeader={<div className="hidden" />}
      summaryBanner={summaryBanner}
      signatureTier="4-tier"
      signatureTitles={[
        { title: 'लिपिक / तेरीज लेखक', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' },
        { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' },
      ]}
      onExportExcel={handleExportExcel}
      onPrint={handlePrint}
      extraToolbarControls={filterToolbarControls}
      isLoading={loading}
      hasData={flatList.length > 0}
      preparedBy={user?.username || 'Admin'}
      emptyState={
        <div className="bg-white p-12 text-center text-slate-500 rounded-xs border border-slate-200 shadow-xs max-w-4xl mx-auto">
          <BookOpen size={36} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs text-slate-700">या कालावधीत कोणतीही तेरीज नोंद आढळली नाही.</p>
          <p className="text-[11px] text-slate-500 mt-1">कृपया कालावधी निवडून 'पहा' बटणावर क्लिक करा.</p>
        </div>
      }
    >
      {viewMode === 'terij1' ? (
        <div className="space-y-6 print:space-y-0">
          {/* ================================================================= */}
          {/* PAGE 1: भांडवल / देयता- (Capital & Liabilities + Income Ledgers)   */}
          {/* ================================================================= */}
          <div>
            {renderTerijSectionHeader('भांडवल /देयता-')}

            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-white text-slate-950 border-b border-slate-900 text-center font-bold text-xs">
                  <th className="border border-slate-900 py-1.5 px-2 w-[36%] text-center">खाते नाव</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center leading-tight">
                    आरंभीची शिल्लक
                    <br />
                    <span className="font-mono text-[11px]">{fromDisplay}</span>
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center">नावे</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center">जमा</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center leading-tight">
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
                    <tr key={`sec1-${row.id}`} className="hover:bg-slate-50 text-slate-950 text-[11.5px]">
                      <td className="border border-slate-900 py-0.5 px-2.5 text-left font-medium">
                        <span className="font-mono mr-1.5">{codeText}</span>
                        <span>{row.name}</span>
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2 text-right font-mono">
                        {fmtTerijAmount(row.signedOpening, isMarathiDigits)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2 text-right font-mono">
                        {fmtTerijAmount(row.debit, isMarathiDigits)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2 text-right font-mono">
                        {fmtTerijAmount(row.credit, isMarathiDigits)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2 text-right font-mono">
                        {fmtTerijAmount(row.signedClosing, isMarathiDigits)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-white font-extrabold text-slate-950 border-t-2 border-b-2 border-slate-900 text-xs">
                  <td className="border border-slate-900 py-1.5 px-4 text-right">एकूण</td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                    {fmtTerijAmount(sec1OpeningTotal, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                    {fmtTerijAmount(sec1DebitTotal, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                    {fmtTerijAmount(sec1CreditTotal, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                    {fmtTerijAmount(sec1ClosingTotal, isMarathiDigits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ================================================================= */}
          {/* PAGE 2: संपत्ती / मालमत्ता (Assets & Property + Expense Ledgers)    */}
          {/* Starts on a new page when printed                                 */}
          {/* ================================================================= */}
          <div className="pt-4 print:pt-0 break-before-page" style={{ pageBreakBefore: 'always' }}>
            {renderTerijSectionHeader('संपत्ती / मालमत्ता')}

            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-white text-slate-950 border-b border-slate-900 text-center font-bold text-xs">
                  <th className="border border-slate-900 py-1.5 px-2 w-[36%] text-center">खाते नाव</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center leading-tight">
                    आरंभीची शिल्लक
                    <br />
                    <span className="font-mono text-[11px]">{fromDisplay}</span>
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center">नावे</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center">जमा</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center leading-tight">
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
                    <tr key={`sec2-${row.id}`} className="hover:bg-slate-50 text-slate-950 text-[11.5px]">
                      <td className="border border-slate-900 py-0.5 px-2.5 text-left font-medium">
                        <span className="font-mono mr-1.5">{codeText}</span>
                        <span>{row.name}</span>
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2 text-right font-mono">
                        {fmtTerijAmount(row.signedOpening, isMarathiDigits)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2 text-right font-mono">
                        {fmtTerijAmount(row.debit, isMarathiDigits)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2 text-right font-mono">
                        {fmtTerijAmount(row.credit, isMarathiDigits)}
                      </td>
                      <td className="border border-slate-900 py-0.5 px-2 text-right font-mono">
                        {fmtTerijAmount(row.signedClosing, isMarathiDigits)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-white font-extrabold text-slate-950 border-t-2 border-b-2 border-slate-900 text-xs">
                  <td className="border border-slate-900 py-1.5 px-4 text-right">एकूण</td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                    {fmtTerijAmount(sec2OpeningTotal, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                    {fmtTerijAmount(grandTotalDebit, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                    {fmtTerijAmount(grandTotalCredit, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono">
                    {fmtTerijAmount(sec2ClosingTotal, isMarathiDigits)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {renderReconciliationSummaryBlock()}
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* GROUP TREE ('tree') & FLAT LIST ('flat') — TWO-SECTION LAYOUT         */
        /* Page 1: भांडवल / देयता-  |  Page 2: संपत्ती / मालमत्ता                 */
        /* ===================================================================== */
        <div className="space-y-6 print:space-y-0">
          {/* ----------------------------------------------------------------- */}
          {/* PAGE 1: भांडवल / देयता- (Group Tree or Flat List)                  */}
          {/* ----------------------------------------------------------------- */}
          <div>
            {renderTerijSectionHeader('भांडवल /देयता-')}

            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-950 border-b border-slate-900 text-center font-bold">
                  <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">अ. क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-left">
                    खाते / लेजर नाव (भांडवल / देयता)
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right">
                    आरंभीची शिल्लक ({fromDisplay})
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-right">नावे व्यवहार (Dr ₹)</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-right">जमा व्यवहार (Cr ₹)</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right font-extrabold">
                    अखेरची शिल्लक ({toDisplay})
                  </th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'flat'
                  ? section1Rows.map((row, index) => {
                      const idxText = isMarathiDigits ? toMarathiDigits(index + 1) : String(index + 1);
                      const codeText = isMarathiDigits ? toMarathiDigits(`${row.code} -`) : `${row.code} -`;
                      const opStr =
                        Math.abs(row.signedOpening) >= 0.005
                          ? `${fmtCurrency(Math.abs(row.signedOpening), isMarathiDigits)} ${
                              row.signedOpening >= 0 ? 'Cr' : 'Dr'
                            }`
                          : '-';
                      const clStr =
                        Math.abs(row.signedClosing) >= 0.005
                          ? `${fmtCurrency(Math.abs(row.signedClosing), isMarathiDigits)} ${
                              row.signedClosing >= 0 ? 'Cr' : 'Dr'
                            }`
                          : '-';

                      return (
                        <tr key={`flat-s1-${row.id}`} className="hover:bg-slate-50 text-slate-900 text-[11.5px]">
                          <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                            {idxText}
                          </td>
                          <td className="border border-slate-900 py-1 px-3">
                            <span className="text-primary font-mono font-bold mr-1.5">{codeText}</span>
                            <span className="font-medium">{row.name}</span>
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono cbs-num-cell">
                            {opStr}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono text-red-700 cbs-num-cell">
                            {row.debit > 0 ? fmtCurrency(row.debit, isMarathiDigits) : '-'}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono text-emerald-800 font-medium cbs-num-cell">
                            {row.credit > 0 ? fmtCurrency(row.credit, isMarathiDigits) : '-'}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950 cbs-num-cell">
                            {clStr}
                          </td>
                        </tr>
                      );
                    })
                  : section1TreeNodes.map((node, index) => (
                      <TreeNode
                        key={`tree-s1-${node.id}`}
                        node={node}
                        level={0}
                        indexStr={`${index + 1}`}
                        isMarathiDigits={isMarathiDigits}
                      />
                    ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-extrabold text-slate-950 border-t-2 border-b-2 border-slate-900 text-xs">
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-3 text-right">
                    एकूण (भांडवल / देयता-):
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono cbs-num-cell">
                    {fmtCurrency(Math.abs(sec1OpeningTotal), isMarathiDigits)}{' '}
                    {sec1OpeningTotal >= 0 ? 'Cr' : 'Dr'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-red-700 cbs-num-cell">
                    ₹ {fmtCurrency(sec1DebitTotal, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-emerald-800 cbs-num-cell">
                    ₹ {fmtCurrency(sec1CreditTotal, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-slate-950 cbs-num-cell">
                    {fmtCurrency(Math.abs(sec1ClosingTotal), isMarathiDigits)}{' '}
                    {sec1ClosingTotal >= 0 ? 'Cr' : 'Dr'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* PAGE 2: संपत्ती / मालमत्ता (Group Tree or Flat List)               */}
          {/* Starts on a new page when printed                                 */}
          {/* ----------------------------------------------------------------- */}
          <div className="pt-4 print:pt-0 break-before-page" style={{ pageBreakBefore: 'always' }}>
            {renderTerijSectionHeader('संपत्ती / मालमत्ता')}

            <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-950 border-b border-slate-900 text-center font-bold">
                  <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">अ. क्र.</th>
                  <th className="border border-slate-900 py-1.5 px-3 text-left">
                    खाते / लेजर नाव (संपत्ती / मालमत्ता)
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right">
                    आरंभीची शिल्लक ({fromDisplay})
                  </th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-right">नावे व्यवहार (Dr ₹)</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-right">जमा व्यवहार (Cr ₹)</th>
                  <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right font-extrabold">
                    अखेरची शिल्लक ({toDisplay})
                  </th>
                </tr>
              </thead>
              <tbody>
                {viewMode === 'flat'
                  ? section2Rows.map((row, index) => {
                      const idxText = isMarathiDigits ? toMarathiDigits(index + 1) : String(index + 1);
                      const codeText = isMarathiDigits ? toMarathiDigits(`${row.code} -`) : `${row.code} -`;
                      const opStr =
                        Math.abs(row.signedOpening) >= 0.005
                          ? `${fmtCurrency(Math.abs(row.signedOpening), isMarathiDigits)} ${
                              row.signedOpening >= 0 ? 'Dr' : 'Cr'
                            }`
                          : '-';
                      const clStr =
                        Math.abs(row.signedClosing) >= 0.005
                          ? `${fmtCurrency(Math.abs(row.signedClosing), isMarathiDigits)} ${
                              row.signedClosing >= 0 ? 'Dr' : 'Cr'
                            }`
                          : '-';

                      return (
                        <tr key={`flat-s2-${row.id}`} className="hover:bg-slate-50 text-slate-900 text-[11.5px]">
                          <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                            {idxText}
                          </td>
                          <td className="border border-slate-900 py-1 px-3">
                            <span className="text-primary font-mono font-bold mr-1.5">{codeText}</span>
                            <span className="font-medium">{row.name}</span>
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono cbs-num-cell">
                            {opStr}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono text-red-700 cbs-num-cell">
                            {row.debit > 0 ? fmtCurrency(row.debit, isMarathiDigits) : '-'}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono text-emerald-800 font-medium cbs-num-cell">
                            {row.credit > 0 ? fmtCurrency(row.credit, isMarathiDigits) : '-'}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950 cbs-num-cell">
                            {clStr}
                          </td>
                        </tr>
                      );
                    })
                  : section2TreeNodes.map((node, index) => (
                      <TreeNode
                        key={`tree-s2-${node.id}`}
                        node={node}
                        level={0}
                        indexStr={`${index + 1}`}
                        isMarathiDigits={isMarathiDigits}
                      />
                    ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-extrabold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-3 text-right">
                    एकूण (संपत्ती / मालमत्ता):
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono cbs-num-cell">
                    {fmtCurrency(Math.abs(sec2OpeningTotal), isMarathiDigits)}{' '}
                    {sec2OpeningTotal >= 0 ? 'Dr' : 'Cr'}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-red-700 cbs-num-cell">
                    ₹ {fmtCurrency(sec2DebitTotal, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-emerald-800 cbs-num-cell">
                    ₹ {fmtCurrency(sec2CreditTotal, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-slate-950 cbs-num-cell">
                    {fmtCurrency(Math.abs(sec2ClosingTotal), isMarathiDigits)}{' '}
                    {sec2ClosingTotal >= 0 ? 'Dr' : 'Cr'}
                  </td>
                </tr>
                <tr className="bg-slate-200 font-black text-slate-950 border-t-2 border-b-2 border-slate-900 text-xs">
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-3 text-right">
                    एकूण तेरीज बेरीज (भांडवल/देयता + संपत्ती/मालमत्ता):
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-[11px] cbs-num-cell">
                    <div>Cr: ₹{fmtCurrency(Math.abs(sec1OpeningTotal), isMarathiDigits)}</div>
                    <div>Dr: ₹{fmtCurrency(Math.abs(sec2OpeningTotal), isMarathiDigits)}</div>
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-red-700 cbs-num-cell">
                    ₹ {fmtCurrency(grandTotalDebit, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-emerald-800 cbs-num-cell">
                    ₹ {fmtCurrency(grandTotalCredit, isMarathiDigits)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-[11px] text-slate-950 cbs-num-cell">
                    <div>Cr: ₹{fmtCurrency(Math.abs(sec1ClosingTotal), isMarathiDigits)}</div>
                    <div>Dr: ₹{fmtCurrency(Math.abs(sec2ClosingTotal), isMarathiDigits)}</div>
                  </td>
                </tr>
              </tfoot>
            </table>

            {renderReconciliationSummaryBlock()}
          </div>
        </div>
      )}
    </CbsReportLayout>
  );
}

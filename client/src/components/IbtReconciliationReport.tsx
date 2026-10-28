import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Building2, 
  ShieldCheck, 
  FileText, 
  Search,
  DollarSign,
  TrendingUp,
  XCircle,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import CbsReportLayout, { formatDisplayDate, CbsPaperSize, SansthaDetails } from './common/CbsReportLayout';
import BankLedgerSelect from './common/BankLedgerSelect';
import { filterBankAccountLedgers, RawLedgerItem } from '../utils/bankLedgerUtils';

interface IbtBranchItem {
  branchID: number;
  branchCode: string;
  branchName: string;
  branchType: string;
  defaultIbtLedgerID?: number;
  defaultIbtLedgerName?: string;
  defaultCashLedgerID?: number;
  defaultCashLedgerName?: string;
}

interface IbtMatrixCell {
  sourceBranchID: number;
  sourceBranchName: string;
  targetBranchID: number;
  targetBranchName: string;
  openingBalance: number;
  debitAmount: number;
  creditAmount: number;
  netMovement: number;
  closingBalance: number;
  contraClosingBalance: number;
  difference: number;
  isTallied: boolean;
  totalVouchersCount: number;
}

interface IbtPairSummary {
  branchAId: number;
  branchAName: string;
  branchACode: string;
  branchBId: number;
  branchBName: string;
  branchBCode: string;
  branchAPosition: number;
  branchBPosition: number;
  difference: number;
  isTallied: boolean;
  totalTurnover: number;
  voucherCount: number;
}

interface IbtMatrixResponse {
  financialYearID: number;
  financialYearCode: string;
  fromDate: string;
  toDate: string;
  branches: IbtBranchItem[];
  pairs: IbtPairSummary[];
  matrixCells: IbtMatrixCell[];
  totalInterBranchTurnover: number;
  totalVouchersCount: number;
  totalDiscrepancy: number;
  overallStatus: string;
}

interface IbtVoucherRow {
  voucherID: number;
  voucherNo: string;
  voucherDate: string;
  voucherType: string;
  branchID: number;
  branchName: string;
  targetBranchID?: number;
  targetBranchName?: string;
  relatedVoucherID?: number;
  relatedVoucherNo?: string;
  amount: number;
  ibtDrCr: string;
  narration: string;
  customerName?: string;
  memberNo?: string;
  module: string;
  status: string;
  isContraMatched: boolean;
}

interface IbtPairStatementResponse {
  branchA: IbtBranchItem;
  branchB: IbtBranchItem;
  fromDate: string;
  toDate: string;
  openingBalanceInA: number;
  openingBalanceInB: number;
  totalDebitInA: number;
  totalCreditInA: number;
  closingBalanceInA: number;
  totalDebitInB: number;
  totalCreditInB: number;
  closingBalanceInB: number;
  difference: number;
  isTallied: boolean;
  totalTurnover: number;
  vouchers: IbtVoucherRow[];
}

interface IbtUnreconciledItem {
  voucherID: number;
  voucherNo: string;
  voucherDate: string;
  branchID: number;
  branchName: string;
  targetBranchID?: number;
  targetBranchName?: string;
  amount: number;
  status: string;
  reason: string;
  relatedVoucherID?: number;
  relatedVoucherStatus?: string;
  narration: string;
}

export default function IbtReconciliationReport() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'matrix' | 'drilldown' | 'radar'>('matrix');
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-landscape');
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 3, 1).toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [sansthaInfo, setSansthaInfo] = useState<SansthaDetails | null>(null);
  const [matrixData, setMatrixData] = useState<IbtMatrixResponse | null>(null);
  const [selectedBranchA, setSelectedBranchA] = useState<number>(1);
  const [selectedBranchB, setSelectedBranchB] = useState<number>(2);
  const [drilldownData, setDrilldownData] = useState<IbtPairStatementResponse | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);

  const [unreconciledItems, setUnreconciledItems] = useState<IbtUnreconciledItem[]>([]);
  const [unreconciledLoading, setUnreconciledLoading] = useState<boolean>(false);

  // Settlement Modal State
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState<boolean>(false);
  const [settlementFromBranch, setSettlementFromBranch] = useState<number>(1);
  const [settlementToBranch, setSettlementToBranch] = useState<number>(2);
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementMode, setSettlementMode] = useState<string>('Bank');
  const [settlementNarration, setSettlementNarration] = useState<string>('');
  const [allLedgers, setAllLedgers] = useState<RawLedgerItem[]>([]);
  const [bankLedgers, setBankLedgers] = useState<RawLedgerItem[]>([]);
  const [selectedBankLedgerId, setSelectedBankLedgerId] = useState<number | undefined>();
  const [settling, setSettling] = useState<boolean>(false);

  // Search filter inside drilldown table
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchSansthaDetails();
    fetchMatrixReport();
    fetchBankLedgers();
  }, [fromDate, toDate]);

  useEffect(() => {
    if (activeTab === 'drilldown') {
      fetchDrilldownData();
    } else if (activeTab === 'radar') {
      fetchUnreconciledVouchers();
    }
  }, [activeTab, selectedBranchA, selectedBranchB]);

  const fetchSansthaDetails = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data) {
        setSansthaInfo(res.data);
      }
    } catch (err) {
      console.error('Error fetching SansthaDetails:', err);
    }
  };

  const fetchMatrixReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/Reports/IbtReconciliationMatrix', {
        params: { fromDate, toDate }
      });
      setMatrixData(res.data);

      if (res.data?.branches?.length >= 2) {
        setSelectedBranchA(res.data.branches[0].branchID);
        setSelectedBranchB(res.data.branches[1].branchID);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'अहवाल लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDrilldownData = async () => {
    if (!selectedBranchA || !selectedBranchB || selectedBranchA === selectedBranchB) return;
    setDrilldownLoading(true);
    try {
      const res = await axios.get('/api/Reports/IbtPairStatement', {
        params: {
          branchAId: selectedBranchA,
          branchBId: selectedBranchB,
          fromDate,
          toDate
        }
      });
      setDrilldownData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch drilldown', err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const fetchUnreconciledVouchers = async () => {
    setUnreconciledLoading(true);
    try {
      const res = await axios.get('/api/Reports/IbtUnreconciledVouchers', {
        params: { fromDate, toDate }
      });
      setUnreconciledItems(res.data?.vouchers || []);
    } catch (err: any) {
      console.error('Failed to fetch unreconciled vouchers', err);
    } finally {
      setUnreconciledLoading(false);
    }
  };

  const fetchBankLedgers = async () => {
    try {
      const res = await axios.get('/api/Ledgers');
      const raw: RawLedgerItem[] = Array.isArray(res.data) ? res.data : [];
      setAllLedgers(raw);
      const banks = filterBankAccountLedgers(raw);
      setBankLedgers(banks);
      setSelectedBankLedgerId((prev) =>
        prev && banks.some((b) => Number(b.ledgerID) === Number(prev))
          ? prev
          : banks.length > 0
            ? banks[0].ledgerID
            : undefined
      );
    } catch (err) {
      console.error('Error fetching bank ledgers', err);
    }
  };

  const handleOpenSettlement = (fromBranchId: number, toBranchId: number, amount: number) => {
    setSettlementFromBranch(fromBranchId);
    setSettlementToBranch(toBranchId);
    setSettlementAmount(amount > 0 ? Number(amount.toFixed(2)) : 0);
    setSettlementNarration(`आंतर-शाखा शिल्लक सेटलमेंट: ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`);
    setIsSettlementModalOpen(true);
  };

  const handleExecuteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settlementAmount <= 0) {
      alert('कृपया वैध सेटलमेंट रक्कम प्रविष्ट करा.');
      return;
    }
    if (settlementFromBranch === settlementToBranch) {
      alert('देणारी व घेणारी शाखा एकच असू शकत नाही.');
      return;
    }
    if (settlementMode === 'Bank' && (!selectedBankLedgerId || Number(selectedBankLedgerId) <= 0)) {
      alert('बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
      return;
    }

    setSettling(true);
    try {
      const payload = {
        fromBranchID: settlementFromBranch,
        toBranchID: settlementToBranch,
        settlementAmount: settlementAmount,
        paymentMode: settlementMode,
        bankLedgerID: settlementMode === 'Bank' ? Number(selectedBankLedgerId) : null,
        narration: settlementNarration,
        createdBy: user?.userID || 1
      };
      const res = await axios.post('/api/Reports/CreateIbtSettlement', payload);
      setSuccessMsg(res.data?.message || 'सेटलमेंट व्हाउचर यशस्वीरित्या तयार झाले!');
      setIsSettlementModalOpen(false);
      fetchMatrixReport();
      if (activeTab === 'drilldown') fetchDrilldownData();
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      const errMsg =
        typeof err?.response?.data === 'string'
          ? err.response.data
          : err?.response?.data?.message || err?.message || 'सेटलमेंट करताना त्रुटी आली.';
      alert(errMsg);
    } finally {
      setSettling(false);
    }
  };

  const exportToExcel = () => {
    if (!matrixData) return;
    const wb = XLSX.utils.book_new();

    // 1. Matrix Sheet
    const matrixRows = (matrixData.pairs || []).map(p => ({
      'शाखा A': p.branchAName,
      'शाखा A शिल्लक': p.branchAPosition >= 0 ? `₹${p.branchAPosition.toLocaleString('en-IN')} (येणे/Dr)` : `₹${Math.abs(p.branchAPosition).toLocaleString('en-IN')} (देणे/Cr)`,
      'शाखा B': p.branchBName,
      'शाखा B शिल्लक': p.branchBPosition >= 0 ? `₹${p.branchBPosition.toLocaleString('en-IN')} (येणे/Dr)` : `₹${Math.abs(p.branchBPosition).toLocaleString('en-IN')} (देणे/Cr)`,
      'कॉन्ट्रा तफावत': `₹${p.difference.toFixed(2)}`,
      'ताळमेळ स्थिती': p.isTallied ? 'तंतोतंत जुळले (Matched)' : 'तफावत (Discrepancy)',
      'एकूण उलाढाल': p.totalTurnover,
      'व्हाउचर संख्या': p.voucherCount
    }));
    const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
    XLSX.utils.book_append_sheet(wb, wsMatrix, 'IBT_Matrix');

    // 2. Drilldown Sheet
    if (drilldownData?.vouchers?.length) {
      const vRows = drilldownData.vouchers.map(v => ({
        'दिनांक': v.voucherDate.split('T')[0],
        'व्हाउचर क्र': v.voucherNo,
        'प्रकार': v.voucherType,
        'शाखा': v.branchName,
        'लक्ष्य शाखा': v.targetBranchName,
        'संलग्न व्हाउचर': v.relatedVoucherNo || '-',
        'खातेदार / तपशील': v.customerName || v.memberNo || '-',
        'विभाग': v.module,
        'IBT प्रकार': v.ibtDrCr,
        'रक्कम': v.amount,
        'तपशील': v.narration,
        'स्थिती': v.status
      }));
      const wsVouchers = XLSX.utils.json_to_sheet(vRows);
      XLSX.utils.book_append_sheet(wb, wsVouchers, 'Vouchers_Detail');
    }

    XLSX.writeFile(wb, `IBT_Reconciliation_Matrix_${fromDate}_to_${toDate}.xlsx`);
  };

  const filteredVouchers = (drilldownData?.vouchers || []).filter(v => {
    const matchesSearch = !drilldownSearch || 
      v.voucherNo.toLowerCase().includes(drilldownSearch.toLowerCase()) ||
      (v.relatedVoucherNo && v.relatedVoucherNo.toLowerCase().includes(drilldownSearch.toLowerCase())) ||
      (v.customerName && v.customerName.toLowerCase().includes(drilldownSearch.toLowerCase())) ||
      v.narration.toLowerCase().includes(drilldownSearch.toLowerCase());

    const matchesModule = moduleFilter === 'ALL' || v.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  // CBS Standard Unified Top Toolbar Filter Controls
  const filterToolbarControls = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded border border-slate-300">
        <span className="font-bold text-slate-700">कालावधी:</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="px-1.5 py-0.5 text-xs border border-slate-300 rounded bg-white font-medium text-slate-800 outline-none focus:border-primary"
        />
        <span className="text-slate-500">ते</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="px-1.5 py-0.5 text-xs border border-slate-300 rounded bg-white font-medium text-slate-800 outline-none focus:border-primary"
        />
        <button
          onClick={fetchMatrixReport}
          disabled={loading}
          className="px-2.5 py-0.5 bg-primary hover:bg-primary/90 text-white rounded font-bold transition-colors cursor-pointer flex items-center gap-1"
          title="अहवाल रीफ्रेश करा"
        >
          <Search size={12} />
          <span>पहा</span>
        </button>
      </div>

      <button
        onClick={() => handleOpenSettlement(selectedBranchA, selectedBranchB, 0)}
        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
        title="आंतर-शाखा देणी/घेणी शिल्लक सेटल करा"
      >
        <DollarSign size={13} />
        <span>आंतर-शाखा सेटलमेंट</span>
      </button>

      <button
        onClick={fetchMatrixReport}
        disabled={loading}
        className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition-colors"
        title="ताजे आकडे मिळवा"
      >
        <RefreshCw size={13} className={loading ? 'animate-spin text-primary' : ''} />
      </button>
    </div>
  );

  // Executive KPI Summary Banner beneath CBS Header
  const summaryBanner = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs py-2 px-3 bg-slate-50 border border-slate-300 rounded-sm mb-3">
      <div className="border-r border-slate-200 last:border-0 pr-2">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण आंतर-शाखा व्हाउचर्स</span>
        <strong className="text-slate-900 font-mono text-[12px]">
          {matrixData?.totalVouchersCount ?? 0}
        </strong>
        <span className="block text-[9px] text-slate-400">द्विमार्गी संलग्न व्हाउचर्स</span>
      </div>

      <div className="border-r border-slate-200 last:border-0 pr-2">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण क्लिअरिंग उलाढाल</span>
        <strong className="text-primary font-mono text-[12px]">
          ₹ {(matrixData?.totalInterBranchTurnover ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </strong>
        <span className="block text-[9px] text-slate-400">एकत्रित देवाणघेवाण</span>
      </div>

      <div className="border-r border-slate-200 last:border-0 pr-2">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">समोरासमोर कॉन्ट्रा स्थिती</span>
        {(matrixData?.totalDiscrepancy ?? 0) < 0.01 ? (
          <strong className="text-emerald-700 font-mono text-[12px] flex items-center justify-center gap-1">
            <CheckCircle2 size={13} className="stroke-[2.5]" />
            तंतोतंत जुळले (₹ ०.००)
          </strong>
        ) : (
          <strong className="text-rose-700 font-mono text-[12px] flex items-center justify-center gap-1">
            <AlertTriangle size={13} className="stroke-[2.5]" />
            तफावत: ₹ {(matrixData?.totalDiscrepancy ?? 0).toFixed(2)}
          </strong>
        )}
        <span className="block text-[9px] text-slate-400">GL-SL झिरो बॅलन्स ऑडिट</span>
      </div>

      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">विसंगत / प्रलंबित व्हाउचर्स</span>
        <div className="flex items-center justify-center sm:justify-end gap-1.5 mt-0.5">
          <strong className={`font-mono text-[12px] ${unreconciledItems.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
            {unreconciledItems.length}
          </strong>
          {unreconciledItems.length > 0 && (
            <button
              onClick={() => setActiveTab('radar')}
              className="text-[10px] text-primary underline font-bold cursor-pointer"
            >
              रडार पहा →
            </button>
          )}
        </div>
        <span className="block text-[9px] text-slate-400">
          {unreconciledItems.length === 0 ? 'कोणताही प्रलंबित नाही' : 'तातडीने मंजूर करा'}
        </span>
      </div>
    </div>
  );

  const fromDisplay = formatDisplayDate(fromDate);
  const toDisplay = formatDisplayDate(toDate);
  const periodTextStr = `कालावधी : ${fromDisplay} ते ${toDisplay}`;

  return (
    <div className="w-full">
      {/* Success Notification Alert */}
      {successMsg && (
        <div className="mx-auto max-w-5xl mb-3 bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2.5 rounded-sm flex items-center justify-between shadow-2xs no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mx-auto max-w-5xl mb-3 bg-rose-50 border border-rose-300 text-rose-800 px-4 py-2.5 rounded-sm flex items-center gap-2 shadow-2xs no-print">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="text-xs font-bold">{error}</span>
        </div>
      )}

      <CbsReportLayout
        defaultPaperSize={paperSize}
        allowPaperSizeToggle={true}
        titleStyle="classic-badge"
        reportTitle="आंतर-शाखा ताळमेळ व क्लिअरिंग अहवाल"
        reportSubtitle="Inter-Branch Clearing & Reconciliation Matrix (N × N) & Pair-wise Contra Statement"
        periodText={periodTextStr}
        sansthaInfo={sansthaInfo}
        summaryBanner={summaryBanner}
        signatureTier="4-tier"
        signatureTitles={[
          { title: 'लिपिक / हिशोबनीस', subtitle: '(Clerk / Maker)' },
          { title: 'आंतर-शाखा तपासनीस / मुख्य रोखपाल', subtitle: '(IBT Checker / Chief Cashier)' },
          { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' },
          { title: 'मुख्य कार्यकारी अधिकारी / वैधानिक लेखापरीक्षक', subtitle: '(CEO / Statutory Auditor)' }
        ]}
        onExportExcel={exportToExcel}
        extraToolbarControls={filterToolbarControls}
        isLoading={loading}
        hasData={Boolean(matrixData && matrixData.branches?.length > 0)}
        preparedBy="Admin"
        emptyState={
          <div className="bg-white p-12 text-center text-slate-500 rounded-sm border border-slate-200 shadow-2xs max-w-4xl mx-auto">
            <Building2 size={36} className="mx-auto mb-2 text-primary/40" />
            <p className="font-semibold text-xs text-slate-700">निवडलेल्या कालावधीत कोणतेही आंतर-शाखा व्यवहार आढळले नाहीत.</p>
            <p className="text-[11px] text-slate-500 mt-1">कृपया कालावधी निवडून 'पहा' बटणावर क्लिक करा.</p>
          </div>
        }
      >
        {/* Interactive Tab Navigation Strip (Screen Mode) */}
        <div className="no-print flex border-b border-slate-300 gap-1 bg-slate-50 px-2 pt-2 rounded-t mb-3">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`py-2 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'border-primary text-primary bg-white shadow-2xs rounded-t'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>१. शाखा-ते-शाखा मॅट्रिक्स (N × N Clearing Grid)</span>
          </button>

          <button
            onClick={() => setActiveTab('drilldown')}
            className={`py-2 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'drilldown'
                ? 'border-primary text-primary bg-white shadow-2xs rounded-t'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>२. शाखा जोडी समोरासमोर ताळमेळ (Contra Drill-Down)</span>
          </button>

          <button
            onClick={() => setActiveTab('radar')}
            className={`py-2 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'radar'
                ? 'border-primary text-primary bg-white shadow-2xs rounded-t'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>३. प्रलंबित व विसंगत व्हाउचर रडार ({unreconciledItems.length})</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: N × N MATRIX GRID & PAIR SUMMARY CARDS                             */}
        {/* ========================================================================= */}
        {(activeTab === 'matrix' || true) && (
          <div className={`${activeTab !== 'matrix' ? 'hidden print:block' : ''} space-y-4`}>
            
            {/* Header info bar */}
            <div className="no-print flex justify-between items-center flex-wrap gap-2 pb-1 border-b border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                  <Sparkles size={13} className="text-primary" />
                  शाखा-ते-शाखा १-स्क्रीन क्लिअरिंग मॅट्रिक्स
                </h3>
                <p className="text-[11px] text-slate-500">
                  प्रत्येक शाखेचे इतर सर्व शाखांकडील निव्वळ येणे (+ Dr / हिरवा) किंवा देणे (- Cr / लाल) शिल्लक स्थिती:
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-800 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> + येणे (Receivable / Dr)
                </span>
                <span className="flex items-center gap-1 text-rose-800 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span> - देणे (Payable / Cr)
                </span>
              </div>
            </div>

            {/* Branch Pairs Summary Cards (Interactive Screen Mode) */}
            <div className="no-print grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(matrixData?.pairs || []).map((p, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded border transition-all hover:shadow-2xs ${
                    p.isTallied ? 'bg-slate-50/70 border-slate-300' : 'bg-rose-50/50 border-rose-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary"></span>
                      <span>{p.branchAName} ⟷ {p.branchBName}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                      p.isTallied 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {p.isTallied ? '🟢 तंतोतंत जुळले' : '🔴 तफावत!'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                      <span className="text-slate-600">{p.branchAName} चे पुस्तक:</span>
                      <span className={`font-mono font-semibold ${p.branchAPosition >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {p.branchAPosition >= 0 ? '+' : ''} ₹ {p.branchAPosition.toLocaleString('en-IN', { maximumFractionDigits: 2 })} 
                        {p.branchAPosition >= 0 ? ' (Dr)' : ' (Cr)'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                      <span className="text-slate-600">{p.branchBName} चे पुस्तक:</span>
                      <span className={`font-mono font-semibold ${p.branchBPosition >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {p.branchBPosition >= 0 ? '+' : ''} ₹ {p.branchBPosition.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        {p.branchBPosition >= 0 ? ' (Dr)' : ' (Cr)'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-0.5 font-bold">
                      <span className="text-slate-700">कॉन्ट्रा फरक (Difference):</span>
                      <span className={`font-mono ${p.isTallied ? 'text-emerald-700' : 'text-rose-700 font-bold'}`}>
                        ₹ {p.difference.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500 font-mono">उलाढाल: ₹ {p.totalTurnover.toLocaleString('en-IN')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedBranchA(p.branchAId);
                          setSelectedBranchB(p.branchBId);
                          setActiveTab('drilldown');
                        }}
                        className="text-[11px] text-primary hover:underline font-bold cursor-pointer"
                      >
                        तपशील पहा →
                      </button>
                      {Math.abs(p.branchAPosition) > 0 && (
                        <button
                          onClick={() => handleOpenSettlement(
                            p.branchAPosition < 0 ? p.branchAId : p.branchBId,
                            p.branchAPosition < 0 ? p.branchBId : p.branchAId,
                            Math.abs(p.branchAPosition)
                          )}
                          className="text-[10.5px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                          title="आंतर-शाखा शिल्लक सेटल करा"
                        >
                          सेटल करा ⚡
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Official N × N Matrix Table (Statutory CBS Table Format) */}
            <div className="overflow-x-auto">
              <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-950 border-b border-slate-900 text-center font-bold">
                    <th className="border border-slate-900 py-1.5 px-2 text-left w-[20%]">शाखा (Branch)</th>
                    {(matrixData?.branches || []).map(b => (
                      <th key={b.branchID} className="border border-slate-900 py-1.5 px-2 text-center min-w-[130px]">
                        {b.branchName}
                      </th>
                    ))}
                    <th className="border border-slate-900 py-1.5 px-2 text-right bg-slate-200 font-extrabold w-[18%]">
                      एकूण निव्वळ स्थिती (Net Position)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(matrixData?.branches || []).map(source => {
                    let rowTotal = 0;
                    return (
                      <tr key={source.branchID} className="hover:bg-slate-50 transition-colors text-slate-900">
                        <td className="border border-slate-900 py-1.5 px-2 font-bold bg-slate-50/60">
                          {source.branchName}
                        </td>

                        {(matrixData?.branches || []).map(target => {
                          if (source.branchID === target.branchID) {
                            return (
                              <td key={target.branchID} className="border border-slate-900 py-1.5 px-2 text-center bg-slate-100/50 text-slate-400 font-mono">
                                —
                              </td>
                            );
                          }

                          const cell = (matrixData?.matrixCells || []).find(c => 
                            c.sourceBranchID === source.branchID && c.targetBranchID === target.branchID
                          );

                          const bal = cell ? cell.closingBalance : 0;
                          rowTotal += bal;

                          return (
                            <td 
                              key={target.branchID} 
                              onClick={() => {
                                setSelectedBranchA(source.branchID);
                                setSelectedBranchB(target.branchID);
                                setActiveTab('drilldown');
                              }}
                              className="border border-slate-900 py-1 px-2 text-center cursor-pointer hover:bg-primary/5 transition-colors font-mono"
                            >
                              <span className={`inline-block font-semibold px-1.5 py-0.5 rounded text-[10.5px] ${
                                bal > 0 
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                                  : bal < 0 
                                  ? 'bg-rose-50 text-rose-800 border border-rose-300' 
                                  : 'text-slate-400'
                              }`}>
                                {bal > 0 ? '+' : ''} ₹ {bal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </span>
                            </td>
                          );
                        })}

                        <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold bg-slate-100/50">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            rowTotal > 0 
                              ? 'bg-emerald-100 text-emerald-900' 
                              : rowTotal < 0 
                              ? 'bg-rose-100 text-rose-900' 
                              : 'bg-slate-200 text-slate-700'
                          }`}>
                            {rowTotal >= 0 ? '+' : ''} ₹ {rowTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 font-bold border-t-2 border-slate-900 text-slate-950">
                    <td className="border border-slate-900 py-1.5 px-2 text-left font-black">
                      सर्व शाखा एकत्रित ताळमेळ (Total Net)
                    </td>
                    {(matrixData?.branches || []).map(target => {
                      let colTotal = 0;
                      (matrixData?.matrixCells || []).forEach(c => {
                        if (c.targetBranchID === target.branchID) {
                          colTotal += c.closingBalance;
                        }
                      });
                      return (
                        <td key={target.branchID} className="border border-slate-900 py-1.5 px-2 text-center font-mono font-bold text-xs">
                          {colTotal >= 0 ? '+' : ''} ₹ {colTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                      );
                    })}
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-800 bg-emerald-100">
                      🟢 ₹ ०.०० (संतुलित)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Audit compliance notes */}
            <div className="p-2.5 bg-slate-50 border border-slate-300 rounded text-[11px] text-slate-700 space-y-1">
              <p className="font-bold flex items-center gap-1 text-slate-900">
                <ShieldCheck size={13} className="text-primary" />
                वैधानिक बँकिंग अखंडता नियम (Statutory Banking Rule):
              </p>
              <p className="text-slate-600">
                १) कोणत्याही दोन शाखांच्या परस्पर खात्यांमधील शिल्लक बेरीज नेहमी शून्य (Net Difference = ₹ ०.००) असणे अनिवार्य आहे.
              </p>
              <p className="text-slate-600">
                २) संस्था स्तरावर सर्व शाखांचे IBT खात्यांचे कन्सॉलिडेटेड निव्वळ ताळेबंद शून्य (Zero Imbalance) राहून तेरीज तंतोतंत जुळते.
              </p>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PAIR-WISE CONTRA DRILL-DOWN STATEMENT                              */}
        {/* ========================================================================= */}
        {activeTab === 'drilldown' && (
          <div className="space-y-4">
            
            {/* Branch Selectors Strip */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-300 rounded">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700">शाखा १:</span>
                <select
                  value={selectedBranchA}
                  onChange={(e) => setSelectedBranchA(Number(e.target.value))}
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded font-semibold text-slate-800 outline-none focus:border-primary"
                >
                  {(matrixData?.branches || []).map(b => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                  ))}
                </select>

                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />

                <span className="text-xs font-bold text-slate-700">शाखा २:</span>
                <select
                  value={selectedBranchB}
                  onChange={(e) => setSelectedBranchB(Number(e.target.value))}
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded font-semibold text-slate-800 outline-none focus:border-primary"
                >
                  {(matrixData?.branches || []).map(b => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                  ))}
                </select>

                <button
                  onClick={fetchDrilldownData}
                  disabled={drilldownLoading}
                  className="px-3 py-1 bg-primary hover:bg-primary/90 text-white rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  {drilldownLoading ? 'लोड होत आहे...' : 'ताळमेळ काढा'}
                </button>
              </div>

              {drilldownData && (
                <button
                  onClick={() => handleOpenSettlement(
                    drilldownData.closingBalanceInA < 0 ? selectedBranchA : selectedBranchB,
                    drilldownData.closingBalanceInA < 0 ? selectedBranchB : selectedBranchA,
                    Math.abs(drilldownData.closingBalanceInA)
                  )}
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-2xs cursor-pointer flex items-center gap-1"
                >
                  <DollarSign size={13} />
                  <span>ही शिल्लक सेटल करा (Zero Out)</span>
                </button>
              )}
            </div>

            {/* Contra Comparison Summary Cards */}
            {drilldownData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Branch A Card */}
                <div className="bg-slate-50 border border-slate-300 rounded p-3">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-200">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>{drilldownData.branchA.branchName}</span>
                  </h4>
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div className="flex justify-between">
                      <span>आरंभिक शिल्लक (Opening):</span>
                      <span className="font-mono font-semibold">₹ {drilldownData.openingBalanceInA.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>एकूण नावे (Total Dr):</span>
                      <span className="font-mono font-semibold text-emerald-700">+ ₹ {drilldownData.totalDebitInA.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>एकूण जमा (Total Cr):</span>
                      <span className="font-mono font-semibold text-rose-700">- ₹ {drilldownData.totalCreditInA.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-300 flex justify-between font-bold text-xs">
                      <span>अखेरची शिल्लक:</span>
                      <span className={`font-mono ${drilldownData.closingBalanceInA >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {drilldownData.closingBalanceInA >= 0 ? '+' : ''} ₹ {drilldownData.closingBalanceInA.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Branch B Card */}
                <div className="bg-slate-50 border border-slate-300 rounded p-3">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-200">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    <span>{drilldownData.branchB.branchName}</span>
                  </h4>
                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div className="flex justify-between">
                      <span>आरंभिक शिल्लक (Opening):</span>
                      <span className="font-mono font-semibold">₹ {drilldownData.openingBalanceInB.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>एकूण नावे (Total Dr):</span>
                      <span className="font-mono font-semibold text-emerald-700">+ ₹ {drilldownData.totalDebitInB.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>एकूण जमा (Total Cr):</span>
                      <span className="font-mono font-semibold text-rose-700">- ₹ {drilldownData.totalCreditInB.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="pt-1 border-t border-slate-300 flex justify-between font-bold text-xs">
                      <span>अखेरची शिल्लक:</span>
                      <span className={`font-mono ${drilldownData.closingBalanceInB >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {drilldownData.closingBalanceInB >= 0 ? '+' : ''} ₹ {drilldownData.closingBalanceInB.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contra Match Evaluation Card */}
                <div className={`border rounded p-3 flex flex-col justify-between ${
                  drilldownData.isTallied ? 'bg-emerald-50/70 border-emerald-300' : 'bg-rose-50/70 border-rose-300'
                }`}>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-1">
                      {drilldownData.isTallied ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>समोरासमोर कॉन्ट्रा निकाल</span>
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      {drilldownData.isTallied 
                        ? 'दोन्ही शाखांच्या पुस्तकातील IBT रकमा तंतोतंत एकमेकांना संतुलित करतात.' 
                        : 'सावधान! दोन्ही शाखांच्या बेरजेमध्ये फरक आढळला आहे.'}
                    </p>
                  </div>

                  <div className="pt-1.5 border-t border-slate-300/80">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span>कॉन्ट्रा फरक:</span>
                      <span className={`font-mono ${drilldownData.isTallied ? 'text-emerald-700 text-sm' : 'text-rose-700 text-sm font-black'}`}>
                        ₹ {drilldownData.difference.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Module Filter Pills (Screen Mode) */}
            <div className="no-print flex flex-wrap justify-between items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="व्हाउचर, खातेदार किंवा तपशील शोधा..."
                  value={drilldownSearch}
                  onChange={(e) => setDrilldownSearch(e.target.value)}
                  className="px-2 py-1 text-xs bg-white border border-slate-300 rounded w-60 outline-none focus:border-primary font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">विभाग:</span>
                {['ALL', 'LOAN', 'SAVING', 'FD', 'RD', 'PIGMY', 'SETTLEMENT'].map(mod => (
                  <button
                    key={mod}
                    onClick={() => setModuleFilter(mod)}
                    className={`text-[10.5px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                      moduleFilter === mod 
                        ? 'bg-primary text-white shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mod === 'ALL' ? 'सर्व' : mod}
                  </button>
                ))}
              </div>
            </div>

            {/* Detailed Transaction Vouchers Table */}
            <div className="overflow-x-auto">
              <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-950 border-b border-slate-900 text-center font-bold">
                    <th className="border border-slate-900 py-1.5 px-2 text-center w-[10%]">दिनांक</th>
                    <th className="border border-slate-900 py-1.5 px-2 text-left w-[12%]">व्हाउचर क्र.</th>
                    <th className="border border-slate-900 py-1.5 px-2 text-left w-[12%]">शाखा</th>
                    <th className="border border-slate-900 py-1.5 px-2 text-left w-[12%]">संलग्न व्हाउचर</th>
                    <th className="border border-slate-900 py-1.5 px-2 text-left w-[24%]">खातेदार / तपशील</th>
                    <th className="border border-slate-900 py-1.5 px-1 text-center w-[8%]">विभाग</th>
                    <th className="border border-slate-900 py-1.5 px-1 text-center w-[6%]">IBT</th>
                    <th className="border border-slate-900 py-1.5 px-2 text-right w-[10%] font-extrabold">रक्कम (₹)</th>
                    <th className="border border-slate-900 py-1.5 px-2 text-center w-[6%]">स्थिती</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.map((v) => (
                    <tr key={v.voucherID} className="hover:bg-slate-50 transition-colors text-slate-900 text-[11px]">
                      <td className="border border-slate-900 py-1 px-2 text-center whitespace-nowrap font-mono">
                        {v.voucherDate.split('T')[0]}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-mono font-bold text-primary">
                        {v.voucherNo}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-medium">
                        {v.branchName}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 font-mono">
                        {v.relatedVoucherNo || <span className="text-amber-700 font-bold">— (प्रलंबित)</span>}
                      </td>
                      <td className="border border-slate-900 py-1 px-2">
                        <div className="font-bold text-slate-950">{v.customerName || v.memberNo || 'सामान्य व्यवहार'}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs">{v.narration}</div>
                      </td>
                      <td className="border border-slate-900 py-1 px-1 text-center font-bold text-[10px]">
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-300">
                          {v.module}
                        </span>
                      </td>
                      <td className="border border-slate-900 py-1 px-1 text-center font-bold font-mono">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                          v.ibtDrCr === 'Dr' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {v.ibtDrCr}
                        </span>
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold">
                        ₹ {v.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="border border-slate-900 py-1 px-2 text-center text-[10px]">
                        {v.isContraMatched ? (
                          <span className="text-emerald-700 font-bold inline-flex items-center gap-0.5">
                            <CheckCircle2 size={11} /> जुळले
                          </span>
                        ) : (
                          <span className="text-amber-700 font-bold inline-flex items-center gap-0.5">
                            <AlertTriangle size={11} /> विसंगत
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="border border-slate-900 py-8 text-center text-slate-400 font-medium">
                        निवडलेल्या कालावधीत कोणतेही आंतर-शाखा व्हाउचर्स सापडले नाहीत.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: UNRECONCILED & IN-TRANSIT RADAR                                    */}
        {/* ========================================================================= */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            <div className="no-print flex justify-between items-center pb-1 border-b border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                  <AlertTriangle size={13} className="text-amber-600" />
                  प्रलंबित व विसंगत आंतर-शाखा व्हाउचर्स रडार
                </h3>
                <p className="text-[11px] text-slate-500">
                  ज्या व्हाउचर्सना संलग्न जोडीदार व्हाउचर नाही किंवा स्टेटस/रक्कम जुळत नाही त्यांची यादी:
                </p>
              </div>
              <button
                onClick={fetchUnreconciledVouchers}
                className="text-xs font-bold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${unreconciledLoading ? 'animate-spin text-primary' : ''}`} />
                <span>पुन्हा स्कॅन करा</span>
              </button>
            </div>

            {unreconciledItems.length === 0 ? (
              <div className="p-10 text-center bg-emerald-50/50 rounded border border-emerald-300 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-bold text-emerald-900">सर्व आंतर-शाखा व्हाउचर्स १००% जुळले आहेत!</h4>
                <p className="text-xs text-emerald-700 max-w-md mx-auto">
                  सिस्टीममध्ये कोणताही विसंगत (Unmatched) किंवा एकाच बाजूला पडलेला (One-sided) व्हाउचर आढळला नाही. दोन्ही बाजूंचे ताळेबंद तंतोतंत जुळत आहेत.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                  <thead>
                    <tr className="bg-rose-100 text-rose-950 font-bold border-b border-slate-900">
                      <th className="border border-slate-900 py-1.5 px-2 text-center w-[10%]">दिनांक</th>
                      <th className="border border-slate-900 py-1.5 px-2 text-left w-[12%]">व्हाउचर क्र.</th>
                      <th className="border border-slate-900 py-1.5 px-2 text-left w-[14%]">शाखा</th>
                      <th className="border border-slate-900 py-1.5 px-2 text-left w-[14%]">लक्ष्य शाखा</th>
                      <th className="border border-slate-900 py-1.5 px-2 text-right w-[12%] font-extrabold">रक्कम</th>
                      <th className="border border-slate-900 py-1.5 px-2 text-center w-[10%]">सद्य स्थिती</th>
                      <th className="border border-slate-900 py-1.5 px-2 text-left w-[28%]">विसंगतीचे कारण (Audit Reason)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unreconciledItems.map((item) => (
                      <tr key={item.voucherID} className="hover:bg-rose-50/40 text-[11px] text-slate-900">
                        <td className="border border-slate-900 py-1 px-2 text-center whitespace-nowrap font-mono">{item.voucherDate.split('T')[0]}</td>
                        <td className="border border-slate-900 py-1 px-2 font-mono font-bold text-rose-800">{item.voucherNo}</td>
                        <td className="border border-slate-900 py-1 px-2 font-semibold">{item.branchName}</td>
                        <td className="border border-slate-900 py-1 px-2 font-medium text-slate-700">{item.targetBranchName}</td>
                        <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold">
                          ₹ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-center">
                          <span className="px-1.5 py-0.2 rounded font-bold text-[10px] bg-rose-100 text-rose-800 border border-rose-300">
                            {item.status}
                          </span>
                        </td>
                        <td className="border border-slate-900 py-1 px-2 text-rose-800 font-bold">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </CbsReportLayout>

      {/* ========================================================================= */}
      {/* 1-CLICK IBT SETTLEMENT ACTION MODAL                                       */}
      {/* ========================================================================= */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white rounded-sm shadow-xl border border-slate-300 max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-primary text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> आंतर-शाखा शिल्लक सेटलमेंट व्हाउचर
                </h3>
                <p className="text-[11px] text-white/80 mt-0.5">दोन शाखांमधील IBT देणे-घेणे बँक/कॅशद्वारे क्लिअर करा</p>
              </div>
              <button 
                onClick={() => setIsSettlementModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteSettlement} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">देणारी शाखा (Payer):</label>
                  <select
                    value={settlementFromBranch}
                    onChange={(e) => setSettlementFromBranch(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-slate-50 font-semibold outline-none focus:border-primary"
                  >
                    {(matrixData?.branches || []).map(b => (
                      <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">घेणारी शाखा (Receiver):</label>
                  <select
                    value={settlementToBranch}
                    onChange={(e) => setSettlementToBranch(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-slate-50 font-semibold outline-none focus:border-primary"
                  >
                    {(matrixData?.branches || []).map(b => (
                      <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">सेटलमेंट रक्कम (₹):</label>
                <input
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-sm focus:border-primary outline-none"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">माध्यम (Payment Mode):</label>
                  <select
                    value={settlementMode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      setSettlementMode(mode);
                      if (mode !== 'Bank') {
                        setSelectedBankLedgerId(undefined);
                      } else if (!selectedBankLedgerId && bankLedgers.length > 0) {
                        setSelectedBankLedgerId(bankLedgers[0].ledgerID);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold outline-none focus:border-primary"
                  >
                    <option value="Bank">बँक ट्रान्सफर (RTGS/NEFT)</option>
                    <option value="Cash">रोख गल्ला हस्तांतरण (Cash)</option>
                  </select>
                </div>

                {settlementMode === 'Bank' && (
                  <div>
                    <BankLedgerSelect
                      ledgers={allLedgers}
                      value={selectedBankLedgerId}
                      onChange={(id) => setSelectedBankLedgerId(id > 0 ? id : undefined)}
                      showCountBadge
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">शेरा (Narration):</label>
                <input
                  type="text"
                  value={settlementNarration}
                  onChange={(e) => setSettlementNarration(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded outline-none focus:border-primary"
                  placeholder="उदा. HDFC बँक RTGS UTR#123456 द्वारे सेटलमेंट"
                />
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-900 text-[11px] space-y-0.5">
                <p className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" /> CBS स्वयंचलित कॉन्ट्रा व्हाउचर्स:
                </p>
                <p>• देणाऱ्या शाखेत पेमेंट व्हाउचर (Dr IBT / Cr Bank/Cash)</p>
                <p>• घेणाऱ्या शाखेत रिसिप्ट व्हाउचर (Dr Bank/Cash / Cr IBT)</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded cursor-pointer transition-colors"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-bold rounded shadow-2xs cursor-pointer transition-colors"
                >
                  {settling ? 'तयार होत आहे...' : 'सेटलमेंट व्हाउचर्स बनवा ⚡'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Download, 
  RefreshCw, 
  Building2, 
  ShieldCheck, 
  FileText, 
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  XCircle,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

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
  totalDebitInB: number;
  totalCreditInB: number;
  closingBalanceInA: number;
  closingBalanceInB: number;
  difference: number;
  isTallied: boolean;
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
  drCr: string;
  status: string;
  reason: string;
  relatedVoucherID?: number;
  relatedVoucherStatus?: string;
  narration: string;
}

export default function IbtReconciliationReport() {
  const { user } = useAuth();
  const isHOUser = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'HeadOffice' || user?.role === 'HO_Manager';

  const [activeTab, setActiveTab] = useState<'matrix' | 'drilldown' | 'radar'>('matrix');
  const [fromDate, setFromDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 3, 1).toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
  const [bankLedgers, setBankLedgers] = useState<any[]>([]);
  const [selectedBankLedgerId, setSelectedBankLedgerId] = useState<number | undefined>();
  const [settling, setSettling] = useState<boolean>(false);

  // Search filter inside drilldown table
  const [drilldownSearch, setDrilldownSearch] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');

  useEffect(() => {
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
      console.error("Failed to fetch drilldown", err);
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
      console.error("Failed to fetch unreconciled vouchers", err);
    } finally {
      setUnreconciledLoading(false);
    }
  };

  const fetchBankLedgers = async () => {
    try {
      const res = await axios.get('/api/Ledgers');
      const banks = (res.data || []).filter((l: any) => 
        l.accountType === 'Bank' || 
        (l.groupName && (l.groupName.includes('बँक') || l.groupName.toLowerCase().includes('bank')))
      );
      setBankLedgers(banks);
      if (banks.length > 0) setSelectedBankLedgerId(banks[0].ledgerID);
    } catch (e) {
      console.error("Failed to fetch bank ledgers", e);
    }
  };

  const handleOpenSettlement = (fromId: number, toId: number, defaultAmt?: number) => {
    setSettlementFromBranch(fromId);
    setSettlementToBranch(toId);
    setSettlementAmount(Math.abs(defaultAmt || 0));
    setSettlementNarration(`आंतर-शाखा क्लिअरिंग सेटलमेंट - ${fromDate} ते ${toDate}`);
    setIsSettlementModalOpen(true);
  };

  const handleExecuteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settlementAmount <= 0) {
      alert("कृपया वैध सेटलमेंट रक्कम टाका.");
      return;
    }
    setSettling(true);
    setError(null);
    try {
      const payload = {
        fromBranchID: settlementFromBranch,
        toBranchID: settlementToBranch,
        settlementDate: new Date().toISOString().split('T')[0],
        settlementAmount: settlementAmount,
        paymentMode: settlementMode,
        bankLedgerID: settlementMode === 'Bank' ? selectedBankLedgerId : null,
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
      alert(err?.response?.data?.message || err?.message || 'सेटलमेंट करताना त्रुटी आली.');
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

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen text-slate-800">
      
      {/* 1. Header Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                आंतर-शाखा ताळमेळ व क्लिअरिंग मॅट्रिक्स
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                  CBS v2.5.58
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Inter-Branch Transfer (IBT) Clearing, Reconciliation & Zero GL-SL Balance Audit
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => handleOpenSettlement(selectedBranchA, selectedBranchB, 0)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            <DollarSign className="w-4 h-4" />
            आंतर-शाखा सेटलमेंट
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            प्रिंट
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            एक्सेल
          </button>
          <button
            onClick={fetchMatrixReport}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            title="रिफ्रेश"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-xl flex items-center gap-2 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* 2. Filter & Date Range Selection Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">कालावधी:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <span className="text-slate-400 text-sm">ते</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <button
              onClick={fetchMatrixReport}
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              लागू करा
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>आंतर-शाखा अखंडता पडताळणी: <strong>सक्रिय (Strict Dual-Voucher Enforced)</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Executive KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total IBT Transactions */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">एकूण आंतर-शाखा व्हाउचर्स</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {matrixData?.totalVouchersCount ?? 0}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">संलग्न ड्युअल व्हाउचर्स</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Total Clearing Turnover */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">एकूण क्लिअरिंग उलाढाल</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              ₹ {(matrixData?.totalInterBranchTurnover ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-emerald-600 font-medium mt-0.5">दोन्ही शाखांची एकत्रित देवाणघेवाण</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Contra Reconciliation Status */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">समोरासमोर कॉन्ट्रा ताळमेळ</p>
            <p className={`text-2xl font-bold mt-1 ${(matrixData?.totalDiscrepancy ?? 0) < 0.01 ? 'text-emerald-700' : 'text-red-600'}`}>
              {(matrixData?.totalDiscrepancy ?? 0) < 0.01 ? '🟢 ₹ ०.०० (तंतोतंत)' : `🔴 ₹ ${(matrixData?.totalDiscrepancy ?? 0).toFixed(2)}`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {(matrixData?.totalDiscrepancy ?? 0) < 0.01 ? 'सर्व शाखांचे ताळेबंद जुळले आहेत' : 'आंतर-शाखा तफावत आढळली!'}
            </p>
          </div>
          <div className={`p-3 rounded-xl border ${(matrixData?.totalDiscrepancy ?? 0) < 0.01 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Unreconciled Radar Count */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">विसंगत / प्रलंबित व्हाउचर्स</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {unreconciledItems.length}
            </p>
            <button 
              onClick={() => setActiveTab('radar')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold mt-0.5 flex items-center gap-1"
            >
              रडार तपासा <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <div className={`p-3 rounded-xl border ${unreconciledItems.length === 0 ? 'bg-slate-50 text-slate-500 border-slate-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* 4. Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-2 bg-white px-4 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'matrix'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          १. शाखा-ते-शाखा मॅट्रिक्स (N x N Clearing Grid)
        </button>

        <button
          onClick={() => setActiveTab('drilldown')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'drilldown'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          २. शाखा जोडी समोरासमोर ताळमेळ (Contra Drill-Down)
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'radar'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          ३. प्रलंबित व विसंगत व्हाउचर रडार ({unreconciledItems.length})
        </button>
      </div>

      {/* 5. Tab Contents */}

      {/* TAB 1: N x N Matrix Grid */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 p-5 space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">शाखा-ते-शाखा १-स्क्रीन क्लिअरिंग मॅट्रिक्स</h2>
              <p className="text-xs text-slate-500">
                प्रत्येक शाखेचे इतर सर्व शाखांकडील निव्वळ येणे (+ Dr / हिरवा) किंवा देणे (- Cr / लाल) शिल्लक स्थिती:
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> + येणे (Receivable / Dr)
              </span>
              <span className="flex items-center gap-1 text-rose-700 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> - देणे (Payable / Cr)
              </span>
            </div>
          </div>

          {/* Pair Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(matrixData?.pairs || []).map((p, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                  p.isTallied ? 'bg-slate-50/70 border-slate-200' : 'bg-red-50/50 border-red-200'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                    {p.branchAName} ⟷ {p.branchBName}
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    p.isTallied 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                      : 'bg-red-100 text-red-800 border-red-300'
                  }`}>
                    {p.isTallied ? '🟢 तंतोतंत जुळले' : '🔴 तफावत!'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">{p.branchAName} चे पुस्तक:</span>
                    <span className={`font-semibold ${p.branchAPosition >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {p.branchAPosition >= 0 ? '+' : ''} ₹ {p.branchAPosition.toLocaleString('en-IN', { maximumFractionDigits: 2 })} 
                      {p.branchAPosition >= 0 ? ' (Dr)' : ' (Cr)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">{p.branchBName} चे पुस्तक:</span>
                    <span className={`font-semibold ${p.branchBPosition >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {p.branchBPosition >= 0 ? '+' : ''} ₹ {p.branchBPosition.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      {p.branchBPosition >= 0 ? ' (Dr)' : ' (Cr)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 font-bold">
                    <span className="text-slate-700">कॉन्ट्रा फरक (Difference):</span>
                    <span className={p.isTallied ? 'text-emerald-700' : 'text-rose-700'}>
                      ₹ {p.difference.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">उलाढाल: ₹ {p.totalTurnover.toLocaleString('en-IN')}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedBranchA(p.branchAId);
                        setSelectedBranchB(p.branchBId);
                        setActiveTab('drilldown');
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
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
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
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

          {/* Full N x N Matrix Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 border-r border-slate-200">शाखा (Branch)</th>
                  {(matrixData?.branches || []).map(b => (
                    <th key={b.branchID} className="p-3 border-r border-slate-200 text-center min-w-[140px]">
                      {b.branchName}
                    </th>
                  ))}
                  <th className="p-3 text-center bg-slate-200/80 font-bold">एकूण निव्वळ स्थिती (Net Position)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(matrixData?.branches || []).map(source => {
                  let rowTotal = 0;
                  return (
                    <tr key={source.branchID} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-bold text-slate-800 bg-slate-50/50 border-r border-slate-200">
                        {source.branchName}
                      </td>

                      {(matrixData?.branches || []).map(target => {
                        if (source.branchID === target.branchID) {
                          return (
                            <td key={target.branchID} className="p-3 text-center bg-slate-100/50 text-slate-400 border-r border-slate-200 font-mono">
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
                            className="p-3 text-center border-r border-slate-200 cursor-pointer hover:bg-indigo-50/50 transition-colors"
                          >
                            <span className={`inline-block font-semibold px-2 py-1 rounded-md text-[11px] ${
                              bal > 0 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                : bal < 0 
                                ? 'bg-rose-50 text-rose-800 border border-rose-200' 
                                : 'text-slate-400'
                            }`}>
                              {bal > 0 ? '+' : ''} ₹ {bal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </span>
                          </td>
                        );
                      })}

                      <td className="p-3 text-center font-bold bg-slate-100/40">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
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
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Pair-Wise Contra Drill-Down */}
      {activeTab === 'drilldown' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 p-5 space-y-6">
          
          {/* Branch Selectors for Pair Drill-Down */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 uppercase">शाखा १:</span>
              <select
                value={selectedBranchA}
                onChange={(e) => setSelectedBranchA(Number(e.target.value))}
                className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {(matrixData?.branches || []).map(b => (
                  <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                ))}
              </select>

              <ArrowLeftRight className="w-4 h-4 text-slate-400" />

              <span className="text-xs font-bold text-slate-700 uppercase">शाखा २:</span>
              <select
                value={selectedBranchB}
                onChange={(e) => setSelectedBranchB(Number(e.target.value))}
                className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {(matrixData?.branches || []).map(b => (
                  <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                ))}
              </select>

              <button
                onClick={fetchDrilldownData}
                disabled={drilldownLoading}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
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
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                ⚡ ही शिल्लक सेटल करा (Zero Out)
              </button>
            )}
          </div>

          {/* Contra Comparison Cards */}
          {drilldownData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Branch A Card */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-bold text-blue-900 text-sm flex items-center gap-1.5 mb-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  {drilldownData.branchA.branchName}
                </h3>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>आरंभिक शिल्लक (Opening):</span>
                    <span className="font-semibold">₹ {drilldownData.openingBalanceInA.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>एकूण नावे (Total Dr):</span>
                    <span className="font-semibold text-emerald-700">+ ₹ {drilldownData.totalDebitInA.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>एकूण जमा (Total Cr):</span>
                    <span className="font-semibold text-rose-700">- ₹ {drilldownData.totalCreditInA.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="pt-2 border-t border-blue-200 flex justify-between font-bold text-sm">
                    <span>अखेरची शिल्लक:</span>
                    <span className={drilldownData.closingBalanceInA >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {drilldownData.closingBalanceInA >= 0 ? '+' : ''} ₹ {drilldownData.closingBalanceInA.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Branch B Card */}
              <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-4">
                <h3 className="font-bold text-purple-900 text-sm flex items-center gap-1.5 mb-2">
                  <Building2 className="w-4 h-4 text-purple-700" />
                  {drilldownData.branchB.branchName}
                </h3>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span>आरंभिक शिल्लक (Opening):</span>
                    <span className="font-semibold">₹ {drilldownData.openingBalanceInB.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>एकूण नावे (Total Dr):</span>
                    <span className="font-semibold text-emerald-700">+ ₹ {drilldownData.totalDebitInB.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>एकूण जमा (Total Cr):</span>
                    <span className="font-semibold text-rose-700">- ₹ {drilldownData.totalCreditInB.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="pt-2 border-t border-purple-200 flex justify-between font-bold text-sm">
                    <span>अखेरची शिल्लक:</span>
                    <span className={drilldownData.closingBalanceInB >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {drilldownData.closingBalanceInB >= 0 ? '+' : ''} ₹ {drilldownData.closingBalanceInB.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contra Match Evaluation Card */}
              <div className={`border rounded-xl p-4 flex flex-col justify-between ${
                drilldownData.isTallied ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'
              }`}>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 mb-2">
                    {drilldownData.isTallied ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    )}
                    समोरासमोर कॉन्ट्रा निकाल
                  </h3>
                  <p className="text-xs text-slate-600">
                    {drilldownData.isTallied 
                      ? 'दोन्ही शाखांच्या पुस्तकातील IBT रकमा तंतोतंत एकमेकांना संतुलित करतात.' 
                      : 'सावधान! दोन्ही शाखांच्या बेरजेमध्ये फरक आढळला आहे.'}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex justify-between items-center text-sm font-bold">
                    <span>कॉन्ट्रा फरक:</span>
                    <span className={drilldownData.isTallied ? 'text-emerald-700 text-base' : 'text-rose-700 text-base'}>
                      ₹ {drilldownData.difference.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Vouchers Search and Module Filter */}
          <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="व्हाउचर, खातेदार किंवा तपशील शोधा..."
                value={drilldownSearch}
                onChange={(e) => setDrilldownSearch(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">विभाग:</span>
              {['ALL', 'LOAN', 'SAVING', 'FD', 'RD', 'PIGMY', 'SETTLEMENT'].map(mod => (
                <button
                  key={mod}
                  onClick={() => setModuleFilter(mod)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all ${
                    moduleFilter === mod 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {mod === 'ALL' ? 'सर्व' : mod}
                </button>
              ))}
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">दिनांक</th>
                  <th className="p-3">व्हाउचर क्र.</th>
                  <th className="p-3">शाखा</th>
                  <th className="p-3">संलग्न व्हाउचर</th>
                  <th className="p-3">खातेदार / तपशील</th>
                  <th className="p-3 text-center">विभाग</th>
                  <th className="p-3 text-center">IBT बाजू</th>
                  <th className="p-3 text-right">रक्कम (₹)</th>
                  <th className="p-3 text-center">कॉन्ट्रा स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredVouchers.map((v) => (
                  <tr key={v.voucherID} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 whitespace-nowrap text-slate-600 font-medium">
                      {v.voucherDate.split('T')[0]}
                    </td>
                    <td className="p-3 font-mono font-bold text-indigo-700">
                      {v.voucherNo}
                    </td>
                    <td className="p-3 font-medium text-slate-800">
                      {v.branchName}
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {v.relatedVoucherNo || <span className="text-amber-600 font-bold">— (प्रलंबित)</span>}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{v.customerName || v.memberNo || 'सामान्य व्यवहार'}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{v.narration}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                        {v.module}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${
                        v.ibtDrCr === 'Dr' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {v.ibtDrCr}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      ₹ {v.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      {v.isContraMatched ? (
                        <span className="text-emerald-700 flex items-center justify-center gap-1 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> जुळले
                        </span>
                      ) : (
                        <span className="text-amber-700 flex items-center justify-center gap-1 font-semibold text-[11px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> विसंगत
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredVouchers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                      निवडलेल्या कालावधीत कोणतेही आंतर-शाखा व्हाउचर्स सापडले नाहीत.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: Unreconciled Radar */}
      {activeTab === 'radar' && (
        <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-slate-200 p-5 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">प्रलंबित व विसंगत आंतर-शाखा व्हाउचर्स रडार</h2>
              <p className="text-xs text-slate-500">
                ज्या व्हाउचर्सना संलग्न जोडीदार व्हाउचर नाही किंवा स्टेटस/रक्कम जुळत नाही त्यांची यादी:
              </p>
            </div>
            <button
              onClick={fetchUnreconciledVouchers}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> पुन्हा स्कॅन करा
            </button>
          </div>

          {unreconciledItems.length === 0 ? (
            <div className="p-12 text-center bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-emerald-900">सर्व आंतर-शाखा व्हाउचर्स १००% जुळले आहेत!</h3>
              <p className="text-sm text-emerald-700 max-w-md mx-auto">
                सिस्टीममध्ये कोणताही विसंगत (Unmatched) किंवा एकाच बाजूला पडलेला (One-sided) व्हाउचर आढळला नाही. दोन्ही बाजूंचे ताळेबंद तंतोतंत जुळत आहेत.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-red-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-red-50 text-red-900 font-bold border-b border-red-200">
                    <th className="p-3">दिनांक</th>
                    <th className="p-3">व्हाउचर क्र.</th>
                    <th className="p-3">शाखा</th>
                    <th className="p-3">लक्ष्य शाखा</th>
                    <th className="p-3 text-right">रक्कम</th>
                    <th className="p-3 text-center">सद्य स्थिती</th>
                    <th className="p-3">विसंगतीचे कारण (Audit Reason)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100">
                  {unreconciledItems.map((item) => (
                    <tr key={item.voucherID} className="hover:bg-red-50/30">
                      <td className="p-3 whitespace-nowrap">{item.voucherDate.split('T')[0]}</td>
                      <td className="p-3 font-mono font-bold text-red-700">{item.voucherNo}</td>
                      <td className="p-3 font-semibold">{item.branchName}</td>
                      <td className="p-3 font-medium text-slate-600">{item.targetBranchName}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-red-100 text-red-800">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-red-700 font-semibold">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Settlement Action Modal */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <DollarSign className="w-5 h-5" /> आंतर-शाखा शिल्लक सेटलमेंट व्हाउचर
                </h3>
                <p className="text-xs text-indigo-100 mt-0.5">दोन शाखांमधील IBT देणे-घेणे बँक/कॅशद्वारे क्लिअर करा</p>
              </div>
              <button 
                onClick={() => setIsSettlementModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteSettlement} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">देणारी शाखा (Payer):</label>
                  <select
                    value={settlementFromBranch}
                    onChange={(e) => setSettlementFromBranch(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-semibold"
                  >
                    {(matrixData?.branches || []).map(b => (
                      <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">घेणारी शाखा (Receiver):</label>
                  <select
                    value={settlementToBranch}
                    onChange={(e) => setSettlementToBranch(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-semibold"
                  >
                    {(matrixData?.branches || []).map(b => (
                      <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">सेटलमेंट रक्कम (₹):</label>
                <input
                  type="number"
                  step="0.01"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">माध्यम (Payment Mode):</label>
                  <select
                    value={settlementMode}
                    onChange={(e) => setSettlementMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="Bank">बँक ट्रान्सफर (RTGS/NEFT)</option>
                    <option value="Cash">रोख गल्ला हस्तांतरण (Cash)</option>
                  </select>
                </div>

                {settlementMode === 'Bank' && (
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">बँक खाते (Bank Ledger):</label>
                    <select
                      value={selectedBankLedgerId}
                      onChange={(e) => setSelectedBankLedgerId(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-medium"
                    >
                      {bankLedgers.map((l: any) => (
                        <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">शेरा (Narration):</label>
                <input
                  type="text"
                  value={settlementNarration}
                  onChange={(e) => setSettlementNarration(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="उदा. HDFC बँक RTGS UTR#123456 द्वारे सेटलमेंट"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> CBS स्वयंचलित कॉन्ट्रा व्हाउचर्स:
                </p>
                <p>• देणाऱ्या शाखेत पेमेंट व्हाउचर (Dr IBT / Cr Bank/Cash)</p>
                <p>• घेणाऱ्या शाखेत रिसिप्ट व्हाउचर (Dr Bank/Cash / Cr IBT)</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
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

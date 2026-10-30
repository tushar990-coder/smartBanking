import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRightLeft, 
  Search, 
  Printer, 
  CheckSquare, 
  Square,
  ShieldAlert,
  Wallet,
  Clock,
  Coins,
  History,
  Info
} from 'lucide-react';
import BankLedgerSelect from './common/BankLedgerSelect';

type MisDisbursementMode = 'SavingTransfer' | 'LoanRecovery' | 'Suspense' | 'Bank' | 'Cash';

interface PreviewItem {
  fdAccountID: number;
  accountNo: string;
  customerID: number;
  customerName: string;
  cifNo: string;
  memberID?: number;
  memberNo: string;
  schemeName: string;
  openingDate: string;
  maturityDate: string;
  depositPrincipal: number;
  interestRate: number;
  elapsedDays: number;
  periodFromDate: string;
  periodToDate: string;
  isBrokenPeriod: boolean;
  grossInterest: number;
  tdsAmount: number;
  loanAdjustedAmount: number;
  netDisbursedAmount: number;
  disbursementMode: MisDisbursementMode;
  originalDisbursementMode?: MisDisbursementMode;
  targetSavingAccountID?: number;
  targetSavingAccountNo?: string;
  targetSavingAccountBalance?: number;
  targetLoanAccountID?: number;
  targetLoanAccountNo?: string;
  targetLoanBalance?: number;
  isAlreadyPaid: boolean;
  isLienMarked: boolean;
  warningNote?: string;
  isSelected: boolean;
}

interface RegisterRow {
  payoutID: number;
  branchID: number;
  payoutYear: number;
  payoutMonth: number;
  payoutDate: string;
  elapsedDays: number;
  depositPrincipal: number;
  interestRate: number;
  grossInterest: number;
  tdsAmount: number;
  loanAdjustedAmount: number;
  netDisbursedAmount: number;
  disbursementMode: string;
  status: string;
  remarks?: string;
  voucherNo?: string;
  accountNo: string;
  customerName: string;
  targetSavingAccountNo?: string;
  targetLoanAccountNo?: string;
}

const MARATHI_MONTHS = [
  { value: 1, label: 'जानेवारी (January)' },
  { value: 2, label: 'फेब्रुवारी (February)' },
  { value: 3, label: 'मार्च (March)' },
  { value: 4, label: 'एप्रिल (April)' },
  { value: 5, label: 'मे (May)' },
  { value: 6, label: 'जून (June)' },
  { value: 7, label: 'जुलै (July)' },
  { value: 8, label: 'ऑगस्ट (August)' },
  { value: 9, label: 'सप्टेंबर (September)' },
  { value: 10, label: 'ऑक्टोबर (October)' },
  { value: 11, label: 'नोव्हेंबर (November)' },
  { value: 12, label: 'डिसेंबर (December)' },
];

export const FdMisInterestPayout: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'payout' | 'register'>('payout');

  // Branch & Filter states
  const [branches, setBranches] = useState<any[]>([]);
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = user?.branchID ? user.branchID : (hasGlobalBranch ? parseInt(globalBranchStr as string) : 1);
  const [branchID, setBranchID] = useState<number>(initialBranchId);

  const getBizDateStr = (b?: string) => {
    if (b && b.trim()) return b.split('T')[0];
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  };
  const initialBizStr = getBizDateStr(user?.businessDate);
  const initialBizParts = initialBizStr.split('-').map(Number);
  const [payoutYear, setPayoutYear] = useState<number>(initialBizParts[0] || new Date().getFullYear());
  const [payoutMonth, setPayoutMonth] = useState<number>(initialBizParts[1] || (new Date().getMonth() + 1));
  const [payoutDate, setPayoutDate] = useState<string>(initialBizStr);

  useEffect(() => {
    if (user?.businessDate) {
      const bStr = getBizDateStr(user.businessDate);
      const parts = bStr.split('-').map(Number);
      if (parts.length === 3 && !parts.some(Number.isNaN)) {
        setPayoutYear(parts[0]);
        setPayoutMonth(parts[1]);
      }
      setPayoutDate(bStr);
    }
  }, [user?.businessDate]);
  const [accountingMode, setAccountingMode] = useState<'DirectExpense' | 'ClearPayable'>('DirectExpense');
  const [batchPayoutOverride, setBatchPayoutOverride] = useState<'Auto' | 'Bank' | 'Cash'>('Auto');
  const [bankLedgerID, setBankLedgerID] = useState<number>(0);

  // Preview & Processing states
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Register states
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [registerSearch, setRegisterSearch] = useState('');

  const API_URL = '/api';

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/Branches`);
      setBranches(res.data || []);
    } catch (err) {
      console.error('Branches fetch error', err);
    }
  };

  // 1. Fetch Preview
  const handleFetchPreview = async () => {
    setError('');
    setSuccess('');
    setLoadingPreview(true);
    setPreviewItems([]);

    try {
      const payload = {
        branchID,
        payoutYear,
        payoutMonth,
        payoutDate,
        accountingMode
      };

      const res = await axios.post(`${API_URL}/FdMisPayout/Preview`, payload);
      const data = res.data;
      const items: PreviewItem[] = (data.Items || data.items || []).map((i: any) => {
        const origMode: MisDisbursementMode = i.disbursementMode || 'SavingTransfer';
        const canOverride = !i.isAlreadyPaid && i.grossInterest > 0 && !i.isLienMarked;
        const effectiveMode: MisDisbursementMode =
          canOverride && batchPayoutOverride !== 'Auto' ? batchPayoutOverride : origMode;
        const netAmt = Math.max(0, (i.grossInterest || 0) - (i.tdsAmount || 0));
        return {
          ...i,
          originalDisbursementMode: origMode,
          disbursementMode: effectiveMode,
          loanAdjustedAmount: effectiveMode === 'LoanRecovery' ? i.loanAdjustedAmount : 0,
          netDisbursedAmount: effectiveMode === 'LoanRecovery' ? 0 : netAmt,
          isSelected: !i.isAlreadyPaid && i.grossInterest > 0
        };
      });

      setPreviewItems(items);
      if (items.length === 0) {
        setError('निवडलेल्या महिना व शाखेसाठी कोणतेही सक्रिय मुदत ठेव (MIS) खाते सापडले नाही.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'प्रिव्ह्यू आणताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingPreview(false);
    }
  };

  // 2. Fetch Register
  const handleFetchRegister = async () => {
    setLoadingRegister(true);
    try {
      const res = await axios.get(`${API_URL}/FdMisPayout/Register`, {
        params: {
          branchId: branchID,
          payoutYear,
          payoutMonth
        }
      });
      setRegisterRows(res.data || []);
    } catch (err: any) {
      console.error('Register fetch error', err);
    } finally {
      setLoadingRegister(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'register') {
      handleFetchRegister();
    }
  }, [activeTab, branchID, payoutYear, payoutMonth]);

  // Selection handlers
  const toggleSelect = (id: number) => {
    setPreviewItems(prev =>
      prev.map(i => i.fdAccountID === id ? { ...i, isSelected: !i.isSelected } : i)
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setPreviewItems(prev =>
      prev.map(i => (!i.isAlreadyPaid && i.grossInterest > 0 ? { ...i, isSelected: checked } : i))
    );
  };

  const handleRowModeChange = (fdAccountId: number, newMode: MisDisbursementMode) => {
    setPreviewItems(prev =>
      prev.map(i => {
        if (i.fdAccountID !== fdAccountId || i.isAlreadyPaid || i.isLienMarked) return i;
        const netAmt = Math.max(0, i.grossInterest - i.tdsAmount);
        if (newMode === 'LoanRecovery' && i.targetLoanAccountID) {
          return { ...i, disbursementMode: 'LoanRecovery', loanAdjustedAmount: netAmt, netDisbursedAmount: 0 };
        }
        return { ...i, disbursementMode: newMode, loanAdjustedAmount: 0, netDisbursedAmount: netAmt };
      })
    );
  };

  const handleBatchPayoutOverrideChange = (mode: 'Auto' | 'Bank' | 'Cash') => {
    setBatchPayoutOverride(mode);
    setPreviewItems(prev =>
      prev.map(i => {
        if (i.isAlreadyPaid || i.grossInterest <= 0 || i.isLienMarked) return i;
        const netAmt = Math.max(0, i.grossInterest - i.tdsAmount);
        if (mode === 'Auto') {
          const restored: MisDisbursementMode = i.originalDisbursementMode || 'SavingTransfer';
          return {
            ...i,
            disbursementMode: restored,
            loanAdjustedAmount: restored === 'LoanRecovery' ? netAmt : 0,
            netDisbursedAmount: restored === 'LoanRecovery' ? 0 : netAmt
          };
        }
        return {
          ...i,
          disbursementMode: mode,
          loanAdjustedAmount: 0,
          netDisbursedAmount: netAmt
        };
      })
    );
  };

  // Summary Metrics
  const selectableItems = previewItems.filter(i => !i.isAlreadyPaid && i.grossInterest > 0);
  const selectedItems = previewItems.filter(i => i.isSelected && !i.isAlreadyPaid && i.grossInterest > 0);
  const totalSelectedGross = selectedItems.reduce((sum, i) => sum + i.grossInterest, 0);
  const totalSelectedLoanAdj = selectedItems.reduce((sum, i) => sum + i.loanAdjustedAmount, 0);
  const totalSelectedSbDisb = selectedItems
    .filter(i => i.disbursementMode === 'SavingTransfer')
    .reduce((sum, i) => sum + i.netDisbursedAmount, 0);
  const totalSelectedBankDisb = selectedItems
    .filter(i => i.disbursementMode === 'Bank')
    .reduce((sum, i) => sum + i.netDisbursedAmount, 0);
  const totalSelectedCashDisb = selectedItems
    .filter(i => i.disbursementMode === 'Cash')
    .reduce((sum, i) => sum + i.netDisbursedAmount, 0);
  const totalSelectedSuspense = selectedItems
    .filter(i => i.disbursementMode === 'Suspense')
    .reduce((sum, i) => sum + i.netDisbursedAmount, 0);
  const anySelectedUsesBank =
    batchPayoutOverride === 'Bank' || selectedItems.some(i => i.disbursementMode === 'Bank');

  const handleOpenConfirmModal = () => {
    if (selectedItems.length === 0) {
      setError('कृपया किमान एक खाते निवडा.');
      return;
    }
    if (selectedItems.some(i => i.disbursementMode === 'Bank') && (!bankLedgerID || bankLedgerID <= 0)) {
      setError('बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
      return;
    }
    setError('');
    setShowConfirmModal(true);
  };

  // Execute Batch
  const handleExecuteBatch = async () => {
    if (selectedItems.length === 0) {
      setError('कृपया किमान एक खाते निवडा.');
      setShowConfirmModal(false);
      return;
    }

    const usesBank = selectedItems.some(i => i.disbursementMode === 'Bank');
    if (usesBank && (!bankLedgerID || bankLedgerID <= 0)) {
      setError('बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
      setShowConfirmModal(false);
      return;
    }

    setError('');
    setSuccess('');
    setLoadingExecute(true);

    try {
      const payload = {
        branchID,
        payoutYear,
        payoutMonth,
        payoutDate,
        accountingMode,
        bankLedgerID: usesBank ? bankLedgerID : null,
        selectedItems: selectedItems.map(i => ({
          fdAccountID: i.fdAccountID,
          grossInterest: i.grossInterest,
          tdsAmount: i.tdsAmount,
          loanAdjustedAmount: i.loanAdjustedAmount,
          netDisbursedAmount: i.netDisbursedAmount,
          disbursementMode: i.disbursementMode,
          targetSavingAccountID: i.targetSavingAccountID,
          targetLoanAccountID: i.targetLoanAccountID,
          bankLedgerID: i.disbursementMode === 'Bank' ? bankLedgerID : null,
          remarks: `MIS Payout ${payoutMonth}/${payoutYear}`
        }))
      };

      const res = await axios.post(`${API_URL}/FdMisPayout/ExecuteBatch`, payload);
      setSuccess(`✅ ${res.data.message} (व्हाउचर क्र: ${res.data.voucherNo})`);
      setShowConfirmModal(false);
      // Refresh preview list
      handleFetchPreview();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'व्याज ट्रान्सफर करताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setShowConfirmModal(false);
    } finally {
      setLoadingExecute(false);
    }
  };

  const filteredPreview = previewItems.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.accountNo.toLowerCase().includes(q) ||
      item.customerName.toLowerCase().includes(q) ||
      item.cifNo.toLowerCase().includes(q) ||
      item.memberNo.toLowerCase().includes(q) ||
      (item.targetSavingAccountNo && item.targetSavingAccountNo.toLowerCase().includes(q))
    );
  });

  const filteredRegister = registerRows.filter(row => {
    if (!registerSearch) return true;
    const q = registerSearch.toLowerCase();
    return (
      row.accountNo.toLowerCase().includes(q) ||
      row.customerName.toLowerCase().includes(q) ||
      (row.voucherNo && row.voucherNo.toLowerCase().includes(q)) ||
      (row.targetSavingAccountNo && row.targetSavingAccountNo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-2.5 font-sans text-xs">
      {/* Top ERP Header Banner matching CBS theme */}
      <div className="bg-primary px-3 py-2 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs rounded-sm">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-blue-100 shrink-0" />
          <div>
            <h1 className="text-sm font-bold tracking-wide flex items-center gap-2">
              मुदत ठेव मासिक व्याज ट्रान्सफर व परतावा
              <span className="text-[10px] bg-white/20 text-white font-semibold px-2 py-0.5 rounded-sm font-mono">
                FD MIS Payout
              </span>
            </h1>
            <p className="text-[10px] text-blue-100 font-normal">
              दरमहा ठेवीदारांच्या बचत खात्यात व्याज जमा करणे, तारण कर्जात वळती व संतुलित दुहेरी-नोंद व्हाउचर
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-black/20 p-0.5 rounded-sm border border-white/20 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('payout')}
            className={`px-3 py-1 text-xs font-semibold rounded-sm transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'payout'
                ? 'bg-white text-gray-900 shadow-xs font-bold'
                : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
          >
            <Coins size={13} />
            मासिक वाटप विझार्ड
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-3 py-1 text-xs font-semibold rounded-sm transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-white text-gray-900 shadow-xs font-bold'
                : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
          >
            <History size={13} />
            मासिक वाटप नोंदवही
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-gray-50/80 p-2.5 rounded-sm border border-gray-200 shadow-2xs">
        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center justify-between">
          <span>१. वाटप निकष व शाखा निवड (Payout Criteria & Branch Selection)</span>
          <span className="text-[10px] text-gray-500 font-normal normal-case">
            💡 {accountingMode === 'DirectExpense' ? 'थेट ठेवीवरील व्याज खर्च (P&L Expense)' : 'मुदत ठेव देणे व्याज वळती (Clear Payable)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
          {/* Branch */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शाखा (Branch) *</label>
            {user?.role === 'Admin' ? (
              <select
                value={branchID}
                onChange={(e) => setBranchID(parseInt(e.target.value, 10))}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white"
              >
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName} ({b.branchCode})
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-gray-100 font-bold text-gray-800 flex items-center gap-1">
                <span>🔒</span>
                <span>{branches.find(b => b.branchID === branchID)?.branchName || user?.branchName || 'Branch'}</span>
              </div>
            )}
          </div>

          {/* Year */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वर्ष (Year) *</label>
            <select
              value={payoutYear}
              onChange={(e) => setPayoutYear(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">महिना (Month) *</label>
            <select
              value={payoutMonth}
              onChange={(e) => setPayoutMonth(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white"
            >
              {MARATHI_MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Payout Date */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वाटप तारीख (Date) *</label>
            <input
              type="date"
              value={payoutDate}
              onChange={(e) => setPayoutDate(e.target.value)}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white"
            />
          </div>

          {/* Accounting Mode */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">लेखांकन पद्धत</label>
            <select
              value={accountingMode}
              onChange={(e) => setAccountingMode(e.target.value as any)}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white font-medium"
            >
              <option value="DirectExpense">थेट व्याज खर्च (P&L)</option>
              <option value="ClearPayable">देणे व्याज वळती</option>
            </select>
          </div>
        </div>

        {/* Action Button Row */}
        <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-200">
          {activeTab === 'payout' ? (
            <button
              type="button"
              onClick={handleFetchPreview}
              disabled={loadingPreview}
              className="bg-primary hover:opacity-90 text-white px-4 py-1.5 rounded-sm shadow-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {loadingPreview ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  शोधत आहे...
                </>
              ) : (
                <>
                  <Search size={14} />
                  प्रिव्ह्यू पहा (Preview Interest)
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFetchRegister}
              disabled={loadingRegister}
              className="bg-primary hover:opacity-90 text-white px-4 py-1.5 rounded-sm shadow-xs text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <History size={14} />
              नोंदवही रिफ्रेश (Refresh Register)
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 text-red-800 px-3 py-2 rounded-sm text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 text-emerald-900 px-3 py-2 rounded-sm text-xs flex items-center gap-2 font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="whitespace-pre-line">{success}</span>
        </div>
      )}

      {/* MAIN TAB 1: PAYOUT WIZARD */}
      {activeTab === 'payout' && (
        <div className="space-y-2.5">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">एकूण पात्र खाती</span>
              <span className="text-base font-bold text-gray-800 mt-0.5 block">
                {previewItems.length} <span className="text-[11px] font-medium text-gray-500">({selectedItems.length} निवडलेली)</span>
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-primary">
              <span className="text-[10px] font-bold text-primary uppercase block">एकूण देय मासिक व्याज</span>
              <span className="text-base font-bold text-primary mt-0.5 block">
                ₹ {totalSelectedGross.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-amber-500">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">तारण कर्जात वळती</span>
              <span className="text-base font-bold text-amber-800 mt-0.5 block">
                ₹ {totalSelectedLoanAdj.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-emerald-600">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">बचत खात्यात निव्वळ जमा</span>
              <span className="text-base font-bold text-emerald-800 mt-0.5 block">
                ₹ {totalSelectedSbDisb.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-rose-500">
              <span className="text-[10px] font-bold text-rose-700 uppercase block">उचंत खात्यात जमा</span>
              <span className="text-base font-bold text-rose-800 mt-0.5 block">
                ₹ {totalSelectedSuspense.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-sm shadow-xs border border-gray-200 p-2.5 space-y-2">
            {/* Batch Payout Mode Override & Bank GL Account Selector */}
            <div className="bg-blue-50/50 border border-blue-200 rounded-sm p-2.5 grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                  वाटप माध्यम / पेमेंट पद्धत (Batch Payout Mode)
                </label>
                <select
                  value={batchPayoutOverride}
                  onChange={(e) => handleBatchPayoutOverrideChange(e.target.value as 'Auto' | 'Bank' | 'Cash')}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white font-semibold cursor-pointer h-[30px]"
                >
                  <option value="Auto">स्वयंचलित (Auto: बचत खाते / तारण कर्ज / उचंत)</option>
                  <option value="Bank">🏦 बँक ट्रान्सफर / धनादेश (All Non-Lien via Bank)</option>
                  <option value="Cash">💵 रोख पेमेंट (All Non-Lien via Cash)</option>
                </select>
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  खालील तक्त्यात प्रत्येक खात्याची वाटप पद्धत स्वतंत्रपणे देखील बदलता येईल.
                </span>
              </div>

              {anySelectedUsesBank && (
                <div className="md:col-span-2">
                  <BankLedgerSelect
                    value={bankLedgerID}
                    onChange={(id) => setBankLedgerID(id)}
                    showCountBadge
                  />
                </div>
              )}
            </div>

            {/* Table Header Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-800">
                  २. खातेदार-निहाय मासिक व्याज वाटप तक्ता (Customer-wise List)
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  एकूण खाती: <strong className="text-primary font-bold">{previewItems.length}</strong> | निवडलेले: <strong className="text-emerald-700 font-bold">{selectedItems.length}</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(selectedItems.length !== selectableItems.length)}
                  disabled={selectableItems.length === 0}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  {selectedItems.length === selectableItems.length && selectableItems.length > 0 ? (
                    <CheckSquare size={14} className="text-primary" />
                  ) : (
                    <Square size={14} className="text-gray-400" />
                  )}
                  सर्व निवडा ({selectedItems.length}/{selectableItems.length})
                </button>

                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="खाते क्र., नाव किंवा बचत क्र. शोधा..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 pr-2 py-1 text-xs bg-white border border-gray-300 rounded-sm w-56 focus:outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleOpenConfirmModal}
                  disabled={selectedItems.length === 0 || loadingExecute}
                  className="bg-primary hover:opacity-90 text-white px-3 py-1 rounded-sm shadow-xs text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Wallet size={14} />
                  निवडलेल्या खात्यांचे व्याज ट्रान्सफर करा ({selectedItems.length})
                </button>
              </div>
            </div>

            {/* Grid Table */}
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto border border-gray-200 rounded-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 uppercase font-bold tracking-wider text-[10px] sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="p-2 w-10 text-center">निवड</th>
                    <th className="p-2">FD खाते क्र.</th>
                    <th className="p-2">खातेदार / सभासद</th>
                    <th className="p-2 text-right">ठेव मुद्दल</th>
                    <th className="p-2 text-center">व्याजदर</th>
                    <th className="p-2 text-center">कालावधी (दिवस)</th>
                    <th className="p-2 text-right">देय मासिक व्याज</th>
                    <th className="p-2 text-right">कर्जात वळती</th>
                    <th className="p-2 text-right font-bold">निव्वळ बचत जमा</th>
                    <th className="p-2">संलग्न बचत / कर्ज खाते</th>
                    <th className="p-2 text-center">स्थिती व शेरा</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredPreview.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-gray-400 font-semibold">
                        {loadingPreview ? 'माहिती गोळा केली जात आहे...' : 'प्रदर्शनासाठी कोणतेही रेकॉर्ड सापडले नाही.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPreview.map((item) => {
                      const isDisabled = item.isAlreadyPaid || item.grossInterest <= 0;
                      return (
                        <tr
                          key={item.fdAccountID}
                          className={`transition-colors hover:bg-blue-50/40 ${
                            item.isSelected ? 'bg-blue-50/30' : (isDisabled ? 'bg-gray-50/70 opacity-60' : '')
                          }`}
                        >
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.isSelected}
                              disabled={isDisabled}
                              onChange={() => toggleSelect(item.fdAccountID)}
                              className="rounded-sm border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>

                          <td className="p-2">
                            <span className="font-bold text-gray-900 block">{item.accountNo}</span>
                            <span className="text-[10px] text-gray-500 block truncate max-w-[140px]">
                              {item.schemeName}
                            </span>
                          </td>

                          <td className="p-2">
                            <span className="font-bold text-gray-800 block">{item.customerName}</span>
                            <span className="text-[10px] text-gray-500">
                              CIF: {item.cifNo || '-'} {item.memberNo ? `| सभासद: ${item.memberNo}` : ''}
                            </span>
                          </td>

                          <td className="p-2 text-right font-bold text-gray-800">
                            ₹ {item.depositPrincipal.toLocaleString('en-IN')}
                          </td>

                          <td className="p-2 text-center font-bold text-primary">
                            {item.interestRate}%
                          </td>

                          <td className="p-2 text-center">
                            <span className="font-bold text-gray-800 block">{item.elapsedDays} दिवस</span>
                            {item.isBrokenPeriod && (
                              <span className="text-[9px] bg-amber-50 border border-amber-200 text-amber-800 px-1 py-0.2 rounded-sm font-semibold">
                                अपूर्ण महिना (Odd Days)
                              </span>
                            )}
                          </td>

                          <td className="p-2 text-right font-bold text-gray-900 text-xs">
                            ₹ {item.grossInterest.toLocaleString('en-IN')}
                          </td>

                          <td className="p-2 text-right font-semibold text-amber-700">
                            {item.loanAdjustedAmount > 0 ? `₹ ${item.loanAdjustedAmount.toLocaleString('en-IN')}` : '-'}
                          </td>

                          <td className="p-2 text-right font-bold text-emerald-700">
                            {item.netDisbursedAmount > 0 ? `₹ ${item.netDisbursedAmount.toLocaleString('en-IN')}` : '₹ ०'}
                          </td>

                          <td className="p-2">
                            {item.disbursementMode === 'LoanRecovery' ? (
                              <div>
                                <span className="font-bold text-amber-800 block text-xs">
                                  कर्ज: {item.targetLoanAccountNo || 'तारण कर्ज'}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  शिल्लक: ₹ {(item.targetLoanBalance || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            ) : item.targetSavingAccountNo ? (
                              <div>
                                <span className="font-bold text-gray-800 block text-xs">
                                  बचत: {item.targetSavingAccountNo}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  चालू शिल्लक: ₹ {(item.targetSavingAccountBalance || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-rose-600 font-bold text-[10px]">
                                बचत खाते उपलब्ध नाही
                              </span>
                            )}
                          </td>

                          <td className="p-2 text-center">
                            {item.isAlreadyPaid ? (
                              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[10px] px-1.5 py-0.5 rounded-sm font-semibold border border-gray-200">
                                <CheckCircle2 size={10} /> आधीच जमा झाले
                              </span>
                            ) : item.isLienMarked && item.disbursementMode === 'LoanRecovery' ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-sm font-semibold border border-amber-200">
                                <ShieldAlert size={10} /> तारण कर्जात वळती
                              </span>
                            ) : (
                              <select
                                value={item.disbursementMode}
                                disabled={isDisabled}
                                onChange={(e) => handleRowModeChange(item.fdAccountID, e.target.value as MisDisbursementMode)}
                                className="border border-gray-300 rounded-sm px-1.5 py-0.5 text-[11px] font-bold bg-white text-gray-800 focus:outline-none focus:border-primary cursor-pointer"
                              >
                                {item.targetSavingAccountID && (
                                  <option value="SavingTransfer">बचत खात्यात (SB)</option>
                                )}
                                <option value="Bank">🏦 बँक (Bank)</option>
                                <option value="Cash">💵 रोख (Cash)</option>
                                <option value="Suspense">उचंत (Suspense)</option>
                                {item.targetLoanAccountID && (
                                  <option value="LoanRecovery">तारण कर्जात वळती</option>
                                )}
                              </select>
                            )}

                            {item.warningNote && (
                              <span className="block text-[9px] text-gray-500 mt-0.5 truncate max-w-[160px]" title={item.warningNote}>
                                {item.warningNote}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MAIN TAB 2: REGISTER VIEW */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-sm shadow-xs border border-gray-200 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200">
            <div>
              <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <History size={15} className="text-primary" />
                मासिक व्याज वाटप नोंदवही (MIS Payout Register)
              </h2>
              <p className="text-[11px] text-gray-500">
                वर्ष: <b>{payoutYear}</b> | महिना: <b>{MARATHI_MONTHS.find(m => m.value === payoutMonth)?.label}</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  placeholder="खाते क्र., व्हाउचर किंवा नाव शोधा..."
                  value={registerSearch}
                  onChange={(e) => setRegisterSearch(e.target.value)}
                  className="pl-7 pr-2 py-1 text-xs bg-white border border-gray-300 rounded-sm w-56 focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-sm border border-gray-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={13} />
                प्रिंट नोंदवही
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px] overflow-y-auto border border-gray-200 rounded-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 text-gray-700 uppercase font-bold tracking-wider text-[10px] sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="p-2">वाटप तारीख</th>
                  <th className="p-2">व्हाउचर क्र.</th>
                  <th className="p-2">FD खाते क्र.</th>
                  <th className="p-2">खातेदार नाव</th>
                  <th className="p-2 text-right">ठेव मुद्दल</th>
                  <th className="p-2 text-center">व्याजदर</th>
                  <th className="p-2 text-right">एकूण व्याज</th>
                  <th className="p-2 text-right">कर्जात वळती</th>
                  <th className="p-2 text-right font-bold">बचत खात्यात जमा</th>
                  <th className="p-2">वर्ग केलेले खाते</th>
                  <th className="p-2 text-center">वाटप पद्धत</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredRegister.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-6 text-center text-gray-400 font-semibold">
                      {loadingRegister ? 'नोंदवही लोड होत आहे...' : 'या महिन्यासाठी कोणतीही वाटप नोंद आढळली नाही.'}
                    </td>
                  </tr>
                ) : (
                  filteredRegister.map((row) => (
                    <tr key={row.payoutID} className="hover:bg-blue-50/40 transition-colors">
                      <td className="p-2 text-gray-700 font-semibold">
                        {new Date(row.payoutDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="p-2 font-mono font-bold text-primary text-xs">
                        {row.voucherNo || '-'}
                      </td>
                      <td className="p-2 font-bold text-gray-900">
                        {row.accountNo}
                      </td>
                      <td className="p-2 text-gray-800 font-semibold">
                        {row.customerName}
                      </td>
                      <td className="p-2 text-right font-bold text-gray-700">
                        ₹ {row.depositPrincipal.toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-center font-bold text-primary">
                        {row.interestRate}%
                      </td>
                      <td className="p-2 text-right font-bold text-gray-900">
                        ₹ {row.grossInterest.toLocaleString('en-IN')}
                      </td>
                      <td className="p-2 text-right font-semibold text-amber-700">
                        {row.loanAdjustedAmount > 0 ? `₹ ${row.loanAdjustedAmount.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="p-2 text-right font-bold text-emerald-700">
                        {row.netDisbursedAmount > 0 ? `₹ ${row.netDisbursedAmount.toLocaleString('en-IN')}` : '₹ ०'}
                      </td>
                      <td className="p-2 text-gray-600 text-xs">
                        {row.disbursementMode === 'Bank'
                          ? 'बँक ट्रान्सफर (Bank)'
                          : row.disbursementMode === 'Cash'
                            ? 'रोख पेमेंट (Cash)'
                            : row.targetSavingAccountNo
                              ? `बचत: ${row.targetSavingAccountNo}`
                              : row.targetLoanAccountNo
                                ? `कर्ज: ${row.targetLoanAccountNo}`
                                : 'उचंत खाते'}
                      </td>
                      <td className="p-2 text-center">
                        <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-sm font-semibold border border-gray-200">
                          {row.disbursementMode}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRMATION & BALANCED VOUCHER MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-2xs overflow-y-auto">
          <div className="bg-white rounded-sm shadow-xl border border-gray-300 w-full max-w-2xl overflow-hidden animate-in fade-in duration-150">
            {/* Header */}
            <div className="bg-primary px-3 py-2 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-blue-100" />
                <h3 className="text-xs font-bold tracking-wide">
                  मासिक व्याज ट्रान्सफर अंतिम पुष्टी (Confirm Batch Payout)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-white/80 hover:text-white text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-3 space-y-2.5 text-xs">
              <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">निवडलेली खाती:</span>
                  <span className="font-bold text-gray-900">{selectedItems.length} खाती</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">कालावधी (महिना व वर्ष):</span>
                  <span className="font-bold text-primary">
                    {MARATHI_MONTHS.find(m => m.value === payoutMonth)?.label} {payoutYear}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">व्हाउचर / वाटप तारीख:</span>
                  <span className="font-bold text-gray-900">
                    {new Date(payoutDate).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">लेखांकन पद्धत:</span>
                  <span className="font-bold text-gray-900">
                    {accountingMode === 'DirectExpense' ? 'थेट ठेवीवरील व्याज खर्च (P&L)' : 'मुदत ठेव देणे व्याज वळती'}
                  </span>
                </div>
              </div>

              {/* Financial Balance Breakdown */}
              <div className="border border-gray-200 rounded-sm p-2.5 space-y-1.5 bg-white">
                <span className="text-[11px] font-bold text-gray-700 block uppercase tracking-wider">
                  व्हाउचर संतुलित लेजर सारांश (Balanced Multi-Leg Voucher):
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">डेबिट बाजू (Dr.):</span>
                    <div className="flex justify-between bg-gray-50 p-1.5 rounded-sm border border-gray-200">
                      <span className="font-medium text-gray-700">
                        {accountingMode === 'DirectExpense' ? 'ठेवीवरील व्याज खर्च' : 'मुदत ठेव देणे व्याज'}
                      </span>
                      <span className="font-bold text-primary">₹ {totalSelectedGross.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">क्रेडिट बाजू (Cr.):</span>
                    <div className="space-y-1">
                      {totalSelectedSbDisb > 0 && (
                        <div className="flex justify-between bg-gray-50 p-1 rounded-sm border border-gray-200 text-[11px]">
                          <span className="font-medium text-emerald-800">बचत ठेवी (SB Credits)</span>
                          <span className="font-bold text-emerald-700">₹ {totalSelectedSbDisb.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {totalSelectedBankDisb > 0 && (
                        <div className="flex justify-between bg-gray-50 p-1 rounded-sm border border-gray-200 text-[11px]">
                          <span className="font-medium text-blue-800">बँक जी.एल. खाते (Bank Payout)</span>
                          <span className="font-bold text-blue-700">₹ {totalSelectedBankDisb.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {totalSelectedCashDisb > 0 && (
                        <div className="flex justify-between bg-gray-50 p-1 rounded-sm border border-gray-200 text-[11px]">
                          <span className="font-medium text-teal-800">रोख खाते (Cash Payout)</span>
                          <span className="font-bold text-teal-700">₹ {totalSelectedCashDisb.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {totalSelectedLoanAdj > 0 && (
                        <div className="flex justify-between bg-gray-50 p-1 rounded-sm border border-gray-200 text-[11px]">
                          <span className="font-medium text-amber-800">तारण कर्ज वळती</span>
                          <span className="font-bold text-amber-700">₹ {totalSelectedLoanAdj.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                      {totalSelectedSuspense > 0 && (
                        <div className="flex justify-between bg-gray-50 p-1 rounded-sm border border-gray-200 text-[11px]">
                          <span className="font-medium text-rose-800">उचंत खाते (Suspense)</span>
                          <span className="font-bold text-rose-700">₹ {totalSelectedSuspense.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm text-xs flex items-center gap-2">
                <Info size={15} className="shrink-0 text-amber-700" />
                <span>
                  खात्री करा: ही कृती पूर्ण होताच सभासदांच्या बचत खात्यात शिल्लक त्वरित जमा होईल आणि संबंधित जनरल लेजर व्हाउचर पोस्ट होईल.
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-gray-100 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3 py-1 bg-white border border-gray-300 text-gray-700 font-semibold text-xs rounded-sm hover:bg-gray-50 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleExecuteBatch}
                disabled={loadingExecute}
                className="bg-primary hover:opacity-90 text-white px-4 py-1 rounded-sm font-bold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {loadingExecute ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    पोस्ट होत आहे...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    होय, व्याज ट्रान्सफर करा
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FdMisInterestPayout;

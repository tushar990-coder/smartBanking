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
  CheckSquare, 
  Square,
  ShieldAlert,
  Wallet,
  Coins,
  History,
  X,
  RotateCcw
} from 'lucide-react';
import BankLedgerSelect from './common/BankLedgerSelect';

type MisDisbursementMode = 'SavingTransfer' | 'LoanRecovery' | 'Suspense' | 'Bank' | 'Cash';

interface CustomerSavingAccountOption {
  savingAccountID: number;
  accountNo: string;
  currentBalance: number;
  branchID: number;
  branchName: string;
}

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
  autoElapsedDays?: number;
  periodFromDate: string;
  periodToDate: string;
  isBrokenPeriod: boolean;
  grossInterest: number;
  autoGrossInterest?: number;
  tdsAmount: number;
  loanAdjustedAmount: number;
  netDisbursedAmount: number;
  disbursementMode: MisDisbursementMode;
  originalDisbursementMode?: MisDisbursementMode;
  targetSavingAccountID?: number;
  targetSavingAccountNo?: string;
  targetSavingAccountBalance?: number;
  customerSavingAccounts?: CustomerSavingAccountOption[];
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
  { value: 1, label: 'जानेवारी (Jan)' },
  { value: 2, label: 'फेब्रुवारी (Feb)' },
  { value: 3, label: 'मार्च (Mar)' },
  { value: 4, label: 'एप्रिल (Apr)' },
  { value: 5, label: 'मे (May)' },
  { value: 6, label: 'जून (Jun)' },
  { value: 7, label: 'जुलै (Jul)' },
  { value: 8, label: 'ऑगस्ट (Aug)' },
  { value: 9, label: 'सप्टेंबर (Sep)' },
  { value: 10, label: 'ऑक्टोबर (Oct)' },
  { value: 11, label: 'नोव्हेंबर (Nov)' },
  { value: 12, label: 'डिसेंबर (Dec)' },
];

export const FdMisInterestPayout: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'payout' | 'register'>('payout');

  // Branch & Filter states
  const [branches, setBranches] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | ''>('');

  const isHeadOfficeOrAdmin = Boolean(
    user?.role === 'Admin' ||
    (user as any)?.roleName === 'Admin' ||
    (user as any)?.isHeadOffice ||
    user?.branchID === 0 ||
    !user?.branchID
  );

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

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, idx) => currentYear - 3 + idx);

  // Calculation Method: 'Monthly' ((P*R)/1200) or 'Daily' ((P*R*Days)/36500)
  const [calcMethod, setCalcMethod] = useState<'Monthly' | 'Daily'>('Monthly');
  const [accountingMode, setAccountingMode] = useState<'DirectExpense' | 'ClearPayable'>('DirectExpense');
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

  // Quick Saving Account Search Modal
  const [searchModalItem, setSearchModalItem] = useState<PreviewItem | null>(null);
  const [sbSearchTerm, setSbSearchTerm] = useState('');
  const [sbSearchResults, setSbSearchResults] = useState<any[]>([]);
  const [sbSearchLoading, setSbSearchLoading] = useState(false);

  // Register states
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [registerSearch, setRegisterSearch] = useState('');

  const API_URL = '/api';

  useEffect(() => {
    fetchBranches();
    fetchSchemes();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/Branches`);
      setBranches(res.data || []);
    } catch (err) {
      console.error('Branches fetch error', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await axios.get(`${API_URL}/FdSchemes`);
      setSchemes(res.data || []);
    } catch (err) {
      console.error('Schemes fetch error', err);
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
        fdSchemeID: selectedSchemeId ? Number(selectedSchemeId) : null,
        payoutYear,
        payoutMonth,
        payoutDate,
        accountingMode,
        calculationMethod: calcMethod
      };

      const res = await axios.post(`${API_URL}/FdMisPayout/Preview`, payload);
      const data = res.data;
      const items: PreviewItem[] = (data.Items || data.items || []).map((i: any) => {
        const origMode: MisDisbursementMode = i.disbursementMode || 'SavingTransfer';
        const netAmt = Math.max(0, (i.grossInterest || 0) - (i.tdsAmount || 0));
        return {
          ...i,
          autoGrossInterest: i.autoGrossInterest ?? i.grossInterest,
          autoElapsedDays: i.autoElapsedDays ?? i.elapsedDays,
          originalDisbursementMode: origMode,
          disbursementMode: origMode,
          loanAdjustedAmount: origMode === 'LoanRecovery' ? netAmt : 0,
          netDisbursedAmount: origMode === 'LoanRecovery' ? 0 : netAmt,
          isSelected: !i.isAlreadyPaid && i.grossInterest > 0
        };
      });

      setPreviewItems(items);
      if (items.length === 0) {
        setError('निवडलेल्या महिना व शाखेसाठी कोणतेही सक्रिय मुदत ठेव खाते सापडले नाही.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'प्रिव्ह्यू आणताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingPreview(false);
    }
  };

  // Toggle Calculation Method in UI (Monthly vs Daily)
  const handleCalcMethodChange = (newMethod: 'Monthly' | 'Daily') => {
    setCalcMethod(newMethod);
    setPreviewItems(prev =>
      prev.map(i => {
        if (i.isAlreadyPaid) return i;
        let newGross = 0;
        if (newMethod === 'Daily') {
          newGross = Math.round((i.depositPrincipal * i.interestRate * i.elapsedDays) / 36500);
        } else {
          if (i.isBrokenPeriod) {
            newGross = Math.round((i.depositPrincipal * i.interestRate * i.elapsedDays) / 36500);
          } else {
            newGross = Math.round((i.depositPrincipal * i.interestRate) / 1200);
          }
        }
        const netAmt = Math.max(0, newGross - i.tdsAmount);
        if (i.disbursementMode === 'LoanRecovery') {
          return { ...i, grossInterest: newGross, loanAdjustedAmount: netAmt, netDisbursedAmount: 0 };
        }
        return { ...i, grossInterest: newGross, loanAdjustedAmount: 0, netDisbursedAmount: netAmt };
      })
    );
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

  const handleGrossInterestChange = (fdAccountId: number, newGross: number) => {
    setPreviewItems(prev =>
      prev.map(i => {
        if (i.fdAccountID !== fdAccountId || i.isAlreadyPaid) return i;
        const gross = Math.max(0, newGross);
        const netAmt = Math.max(0, gross - i.tdsAmount);
        if (i.disbursementMode === 'LoanRecovery') {
          return {
            ...i,
            grossInterest: gross,
            loanAdjustedAmount: netAmt,
            netDisbursedAmount: 0
          };
        }
        return {
          ...i,
          grossInterest: gross,
          loanAdjustedAmount: 0,
          netDisbursedAmount: netAmt
        };
      })
    );
  };

  const handleResetGrossInterest = (fdAccountId: number) => {
    setPreviewItems(prev =>
      prev.map(i => {
        if (i.fdAccountID !== fdAccountId || i.isAlreadyPaid) return i;
        let gross = 0;
        if (calcMethod === 'Daily') {
          gross = Math.round((i.depositPrincipal * i.interestRate * i.elapsedDays) / 36500);
        } else {
          gross = i.isBrokenPeriod 
            ? Math.round((i.depositPrincipal * i.interestRate * i.elapsedDays) / 36500)
            : Math.round((i.depositPrincipal * i.interestRate) / 1200);
        }
        const netAmt = Math.max(0, gross - i.tdsAmount);
        if (i.disbursementMode === 'LoanRecovery') {
          return {
            ...i,
            grossInterest: gross,
            loanAdjustedAmount: netAmt,
            netDisbursedAmount: 0
          };
        }
        return {
          ...i,
          grossInterest: gross,
          loanAdjustedAmount: 0,
          netDisbursedAmount: netAmt
        };
      })
    );
  };

  const handleSavingAccountChange = (fdAccountId: number, savingAccountId: number) => {
    setPreviewItems(prev =>
      prev.map(i => {
        if (i.fdAccountID !== fdAccountId) return i;
        const selectedSb = i.customerSavingAccounts?.find(s => s.savingAccountID === savingAccountId);
        if (!selectedSb) return i;
        const netAmt = Math.max(0, i.grossInterest - i.tdsAmount);
        return {
          ...i,
          targetSavingAccountID: selectedSb.savingAccountID,
          targetSavingAccountNo: selectedSb.accountNo,
          targetSavingAccountBalance: selectedSb.currentBalance,
          disbursementMode: 'SavingTransfer',
          netDisbursedAmount: netAmt,
          loanAdjustedAmount: 0,
          warningNote: undefined
        };
      })
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

  // Quick Saving Account Search Modal Handlers
  const handleOpenSbSearchModal = (item: PreviewItem) => {
    setSearchModalItem(item);
    setSbSearchTerm(item.customerName || '');
    setSbSearchResults([]);
    performSbSearch(item.customerName || '');
  };

  const performSbSearch = async (term: string) => {
    if (!term || term.trim().length < 2) return;
    setSbSearchLoading(true);
    try {
      const res = await axios.get(`${API_URL}/SavingAccounts`, {
        params: { search: term.trim() }
      });
      setSbSearchResults(res.data || []);
    } catch (err) {
      console.error('Saving account search error', err);
    } finally {
      setSbSearchLoading(false);
    }
  };

  const handleSelectSearchedSb = (sb: any) => {
    if (!searchModalItem) return;
    const sbId = sb.savingAccountID || sb.id;
    const accNo = sb.accountNo;
    const bal = sb.currentBalance ?? sb.balance ?? 0;

    setPreviewItems(prev =>
      prev.map(i => {
        if (i.fdAccountID !== searchModalItem.fdAccountID) return i;
        const netAmt = Math.max(0, i.grossInterest - i.tdsAmount);
        return {
          ...i,
          targetSavingAccountID: sbId,
          targetSavingAccountNo: accNo,
          targetSavingAccountBalance: bal,
          disbursementMode: 'SavingTransfer',
          netDisbursedAmount: netAmt,
          loanAdjustedAmount: 0,
          warningNote: undefined
        };
      })
    );
    setSearchModalItem(null);
  };

  // Summary Metrics
  const selectableItems = previewItems.filter(i => !i.isAlreadyPaid && i.grossInterest > 0);
  const selectedItems = previewItems.filter(i => i.isSelected && !i.isAlreadyPaid && i.grossInterest > 0);
  const totalSelectedGross = selectedItems.reduce((sum, i) => sum + i.grossInterest, 0);
  const totalSelectedLoanAdj = selectedItems.reduce((sum, i) => sum + i.loanAdjustedAmount, 0);
  const totalSelectedSbDisb = selectedItems
    .filter(i => i.disbursementMode === 'SavingTransfer')
    .reduce((sum, i) => sum + i.netDisbursedAmount, 0);

  const handleOpenConfirmModal = () => {
    if (selectedItems.length === 0) {
      setError('कृपया किमान एक खाते निवडा.');
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
        bankLedgerID: bankLedgerID > 0 ? bankLedgerID : null,
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
              दरमहा ठेवीदारांच्या बचत खात्यात मासिक व्याज थेट वर्ग करणे किंवा कर्जात वळती
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
            मासिक वाटप
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

      {/* Simplified, Clean Filter Bar */}
      <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
          {/* Branch */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शाखा (Branch) *</label>
            {isHeadOfficeOrAdmin ? (
              <select
                value={branchID}
                onChange={(e) => {
                  setBranchID(parseInt(e.target.value, 10));
                  setPreviewItems([]);
                  setError('');
                }}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white font-medium"
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
                <span className="truncate">{branches.find(b => b.branchID === branchID)?.branchName || user?.branchName || 'Branch'}</span>
              </div>
            )}
          </div>

          {/* Scheme Filter */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">मुदत ठेव योजना (Scheme)</label>
            <select
              value={selectedSchemeId}
              onChange={(e) => {
                setSelectedSchemeId(e.target.value ? parseInt(e.target.value, 10) : '');
                setPreviewItems([]);
              }}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white font-medium"
            >
              <option value="">सर्व योजना (All Schemes)</option>
              {schemes.map((s) => (
                <option key={s.fdSchemeID || s.schemeID} value={s.fdSchemeID || s.schemeID}>
                  {s.schemeName}
                </option>
              ))}
            </select>
          </div>

          {/* Year & Month Grouped */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वर्ष व महिना *</label>
            <div className="flex gap-1">
              <select
                value={payoutYear}
                onChange={(e) => {
                  setPayoutYear(parseInt(e.target.value, 10));
                  setPreviewItems([]);
                }}
                className="w-20 border border-gray-300 rounded-sm px-1.5 py-1 text-xs focus:outline-none focus:border-primary bg-white font-bold"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={payoutMonth}
                onChange={(e) => {
                  setPayoutMonth(parseInt(e.target.value, 10));
                  setPreviewItems([]);
                }}
                className="flex-1 border border-gray-300 rounded-sm px-1.5 py-1 text-xs focus:outline-none focus:border-primary bg-white font-bold"
              >
                {MARATHI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
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

          {/* Fetch Preview Button */}
          <div>
            {activeTab === 'payout' ? (
              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={loadingPreview}
                className="w-full bg-primary hover:opacity-90 text-white px-3 py-1.5 rounded-sm shadow-xs text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {loadingPreview ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    शोधत आहे...
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    प्रिव्ह्यू पहा (Preview)
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFetchRegister}
                disabled={loadingRegister}
                className="w-full bg-primary hover:opacity-90 text-white px-3 py-1.5 rounded-sm shadow-xs text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <History size={14} />
                नोंदवही रिफ्रेश
              </button>
            )}
          </div>
        </div>

        {/* Calculation Formula Toggle Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700">व्याज गणना पद्धत:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-gray-800 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-sm">
              <input
                type="radio"
                name="calcMethod"
                value="Monthly"
                checked={calcMethod === 'Monthly'}
                onChange={() => handleCalcMethodChange('Monthly')}
                className="text-primary focus:ring-primary"
              />
              <span>१. दरमहा समान हप्ता <strong>((P×R)/1200)</strong> - उदा. ₹ ७५०</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-gray-800 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-sm">
              <input
                type="radio"
                name="calcMethod"
                value="Daily"
                checked={calcMethod === 'Daily'}
                onChange={() => handleCalcMethodChange('Daily')}
                className="text-primary focus:ring-primary"
              />
              <span>२. प्रत्यक्ष दिवसानुसार <strong>((P×R×दिवस)/३६५००)</strong> - उदा. मे (३१ दिवस): ₹ ७६४</span>
            </label>
          </div>

          <div className="text-[11px] text-gray-500">
            💡 तक्त्यातील कोणत्याही ओळीत व्याज किंवा बचत खाते थेट बदलता येईल.
          </div>
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

      {/* MAIN TAB 1: PAYOUT VIEW */}
      {activeTab === 'payout' && (
        <div className="space-y-2">
          {/* Streamlined Single-Row Summary & Action Bar */}
          <div className="bg-white px-3 py-2 rounded-sm border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span>एकूण खाती: <strong className="text-gray-900 font-bold">{previewItems.length}</strong></span>
              <span className="text-gray-300">|</span>
              <span>निवडलेली: <strong className="text-primary font-bold">{selectedItems.length}</strong></span>
              <span className="text-gray-300">|</span>
              <span>देय मासिक व्याज: <strong className="text-primary font-bold text-sm">₹ {totalSelectedGross.toLocaleString('en-IN')}</strong></span>
              <span className="text-gray-300">|</span>
              <span>बचत जमा: <strong className="text-emerald-700 font-bold">₹ {totalSelectedSbDisb.toLocaleString('en-IN')}</strong></span>
              {totalSelectedLoanAdj > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>कर्ज वळती: <strong className="text-amber-700 font-bold">₹ {totalSelectedLoanAdj.toLocaleString('en-IN')}</strong></span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
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
                  placeholder="खाते क्र., नाव किंवा CIF शोधा..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2 py-1 text-xs bg-white border border-gray-300 rounded-sm w-52 focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                onClick={handleOpenConfirmModal}
                disabled={selectedItems.length === 0 || loadingExecute}
                className="bg-primary hover:opacity-90 text-white px-3 py-1 rounded-sm shadow-xs text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Wallet size={14} />
                व्याज ट्रान्सफर करा ({selectedItems.length})
              </button>
            </div>
          </div>

          {/* Clean 8-Column Grid Table */}
          <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 uppercase font-bold tracking-wider text-[10px] sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="p-2 w-10 text-center">निवड</th>
                    <th className="p-2 min-w-[200px]">FD खाते क्र. व खातेदार</th>
                    <th className="p-2 text-right min-w-[120px]">ठेव मुद्दल व दर</th>
                    <th className="p-2 text-center min-w-[90px]">कालावधी</th>
                    <th className="p-2 text-right min-w-[140px]">देय मासिक व्याज (₹)</th>
                    <th className="p-2 min-w-[220px]">जमा / वळती बचत खाते</th>
                    <th className="p-2 min-w-[130px]">वाटप प्रकार</th>
                    <th className="p-2 text-center w-24">स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredPreview.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-400 font-semibold">
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
                          {/* 1. Checkbox */}
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.isSelected}
                              disabled={isDisabled}
                              onChange={() => toggleSelect(item.fdAccountID)}
                              className="rounded-sm border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* 2. FD Account & Customer */}
                          <td className="p-2">
                            <div className="font-bold text-gray-900">{item.accountNo}</div>
                            <div className="text-gray-800 font-semibold">{item.customerName}</div>
                            <div className="text-[10px] text-gray-500">
                              CIF: {item.cifNo || '-'} | {item.schemeName}
                            </div>
                          </td>

                          {/* 3. Deposit Amount & Rate */}
                          <td className="p-2 text-right">
                            <div className="font-bold text-gray-900">₹ {item.depositPrincipal.toLocaleString('en-IN')}</div>
                            <div className="text-[11px] font-semibold text-primary">{item.interestRate}% वार्षिक</div>
                          </td>

                          {/* 4. Days */}
                          <td className="p-2 text-center">
                            <div className="font-bold text-gray-800">{item.elapsedDays} दिवस</div>
                            {item.isBrokenPeriod && (
                              <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.2 rounded-sm font-semibold inline-block mt-0.5">
                                अपूर्ण महिना
                              </span>
                            )}
                          </td>

                          {/* 5. Gross Monthly Interest (Editable with Reset) */}
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-500 font-bold">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                disabled={isDisabled}
                                value={item.grossInterest}
                                onChange={(e) => handleGrossInterestChange(item.fdAccountID, parseFloat(e.target.value) || 0)}
                                className="w-20 text-right font-bold text-gray-900 border border-gray-300 rounded-sm px-1.5 py-0.5 text-xs focus:outline-none focus:border-primary disabled:bg-gray-100"
                                title="मासिक व्याज मॅन्युअल भरा"
                              />
                              <button
                                type="button"
                                title="मूळ सिस्टीम गणना पूर्ववत करा"
                                disabled={isDisabled}
                                onClick={() => handleResetGrossInterest(item.fdAccountID)}
                                className="p-0.5 text-gray-400 hover:text-primary transition rounded-sm cursor-pointer font-bold text-sm"
                              >
                                ↺
                              </button>
                            </div>
                          </td>

                          {/* 6. Saving Account Display / Selector */}
                          <td className="p-2">
                            {item.disbursementMode === 'LoanRecovery' ? (
                              <div className="text-amber-800">
                                <span className="font-bold block text-xs">कर्ज: {item.targetLoanAccountNo || 'तारण कर्ज'}</span>
                                <span className="text-[10px] text-gray-500">शिल्लक: ₹ {(item.targetLoanBalance || 0).toLocaleString('en-IN')}</span>
                              </div>
                            ) : item.customerSavingAccounts && item.customerSavingAccounts.length > 1 ? (
                              <div>
                                <select
                                  value={item.targetSavingAccountID || ''}
                                  disabled={isDisabled}
                                  onChange={(e) => handleSavingAccountChange(item.fdAccountID, Number(e.target.value))}
                                  className="w-full border border-gray-300 rounded-sm px-1.5 py-0.5 text-xs font-bold bg-white text-gray-800 focus:outline-none focus:border-primary cursor-pointer"
                                >
                                  {item.customerSavingAccounts.map((sb) => (
                                    <option key={sb.savingAccountID} value={sb.savingAccountID}>
                                      {sb.accountNo} (₹ {sb.currentBalance.toLocaleString('en-IN')})
                                    </option>
                                  ))}
                                </select>
                                <span className="text-[9px] text-gray-500 block mt-0.5 font-medium">
                                  {item.customerSavingAccounts.length} बचत खाती उपलब्ध
                                </span>
                              </div>
                            ) : item.targetSavingAccountNo ? (
                              <div>
                                <span className="font-bold text-gray-900 block text-xs">
                                  बचत: {item.targetSavingAccountNo}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-semibold">
                                  चालू शिल्लक: ₹ {(item.targetSavingAccountBalance || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-gray-400 text-xs">बचत खाते नाही</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenSbSearchModal(item)}
                                  className="text-primary hover:underline text-[11px] font-bold cursor-pointer"
                                >
                                  + शोधा
                                </button>
                              </div>
                            )}
                          </td>

                          {/* 7. Disbursement Mode Badge / Selector */}
                          <td className="p-2">
                            {item.disbursementMode === 'LoanRecovery' ? (
                              <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-sm font-bold text-[11px]">
                                कर्जात वळती ₹ {item.loanAdjustedAmount.toLocaleString('en-IN')}
                              </span>
                            ) : item.disbursementMode === 'SavingTransfer' ? (
                              <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-sm font-bold text-[11px]">
                                बचत जमा ₹ {item.netDisbursedAmount.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <select
                                value={item.disbursementMode}
                                disabled={isDisabled}
                                onChange={(e) => handleRowModeChange(item.fdAccountID, e.target.value as MisDisbursementMode)}
                                className="border border-gray-300 rounded-sm px-1.5 py-0.5 text-xs font-semibold bg-white text-gray-800 focus:outline-none focus:border-primary cursor-pointer"
                              >
                                {(item.targetSavingAccountID || (item.customerSavingAccounts && item.customerSavingAccounts.length > 0)) && (
                                  <option value="SavingTransfer">बचत खात्यात (SB)</option>
                                )}
                                <option value="Bank">बँक (Bank)</option>
                                <option value="Cash">रोख (Cash)</option>
                                <option value="Suspense">उचंत (Suspense)</option>
                                {item.targetLoanAccountID && (
                                  <option value="LoanRecovery">कर्जात वळती</option>
                                )}
                              </select>
                            )}
                          </td>

                          {/* 8. Status */}
                          <td className="p-2 text-center">
                            {item.isAlreadyPaid ? (
                              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[10px] px-1.5 py-0.5 rounded-sm font-semibold border border-gray-200">
                                <CheckCircle2 size={11} className="text-gray-500" /> जमा झाले
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-primary text-[10px] px-1.5 py-0.5 rounded-sm font-semibold border border-blue-200">
                                वाटप तयार
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
                  placeholder="नोंदवहीत शोधा..."
                  value={registerSearch}
                  onChange={(e) => setRegisterSearch(e.target.value)}
                  className="pl-7 pr-2 py-1 text-xs bg-white border border-gray-300 rounded-sm w-52 focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px] overflow-y-auto border border-gray-200 rounded-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 text-gray-700 uppercase font-bold tracking-wider text-[10px] sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="p-2">वाटप दिनांक</th>
                  <th className="p-2">व्हाउचर क्र.</th>
                  <th className="p-2">FD खाते क्र.</th>
                  <th className="p-2">खातेदार</th>
                  <th className="p-2 text-right">ठेव मुद्दल</th>
                  <th className="p-2 text-center">व्याजदर</th>
                  <th className="p-2 text-right">मासिक व्याज</th>
                  <th className="p-2">जमा बचत खाते</th>
                  <th className="p-2">वळती कर्ज खाते</th>
                  <th className="p-2 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredRegister.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-gray-400 font-semibold">
                      {loadingRegister ? 'नोंदवही लोड होत आहे...' : 'या कालावधीसाठी कोणतीही नोंद आढळली नाही.'}
                    </td>
                  </tr>
                ) : (
                  filteredRegister.map((r) => (
                    <tr key={r.payoutID} className="hover:bg-gray-50/50">
                      <td className="p-2 font-mono">{r.payoutDate ? r.payoutDate.split('T')[0] : '-'}</td>
                      <td className="p-2 font-bold text-primary font-mono">{r.voucherNo || '-'}</td>
                      <td className="p-2 font-bold text-gray-800">{r.accountNo}</td>
                      <td className="p-2 text-gray-800 font-semibold">{r.customerName}</td>
                      <td className="p-2 text-right font-bold text-gray-800">₹ {r.depositPrincipal.toLocaleString('en-IN')}</td>
                      <td className="p-2 text-center font-bold text-gray-700">{r.interestRate}%</td>
                      <td className="p-2 text-right font-bold text-primary">₹ {r.grossInterest.toLocaleString('en-IN')}</td>
                      <td className="p-2 text-emerald-800 font-bold">{r.targetSavingAccountNo || '-'}</td>
                      <td className="p-2 text-amber-800 font-bold">{r.targetLoanAccountNo || '-'}</td>
                      <td className="p-2 text-center">
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-sm text-[10px] font-bold">
                          ✓ यशस्वी
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-sm shadow-xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="bg-primary px-4 py-2.5 text-white flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-1.5">
                <Wallet size={16} /> मासिक व्याज ट्रान्सफर पुष्टीकरण
              </span>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-gray-700 font-medium">
                आपण निवडलेल्या <b>{selectedItems.length}</b> मुदत ठेव खात्यांचे मासिक व्याज वर्ग करत आहात:
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-sm p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">एकूण देय मासिक व्याज:</span>
                  <span className="font-bold text-gray-900 text-sm">₹ {totalSelectedGross.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-700 font-medium">बचत खात्यात थेट जमा:</span>
                  <span className="font-bold text-emerald-800">₹ {totalSelectedSbDisb.toLocaleString('en-IN')}</span>
                </div>
                {totalSelectedLoanAdj > 0 && (
                  <div className="flex justify-between">
                    <span className="text-amber-700 font-medium">तारण कर्जात वळती:</span>
                    <span className="font-bold text-amber-800">₹ {totalSelectedLoanAdj.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-1.5">
                  <span className="text-gray-600">वाटप दिनांक:</span>
                  <span className="font-bold text-gray-900">{payoutDate}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={loadingExecute}
                  className="px-3 py-1.5 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatch}
                  disabled={loadingExecute}
                  className="bg-primary hover:opacity-90 text-white px-4 py-1.5 rounded-sm font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingExecute ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ट्रान्सफर होत आहे...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} /> होय, व्याज वर्ग करा
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Saving Account Search Modal */}
      {searchModalItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-sm shadow-xl max-w-lg w-full border border-gray-200 overflow-hidden">
            <div className="bg-primary px-4 py-2.5 text-white flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-1.5">
                <Search size={16} /> बचत खाते शोधा व जोडा
              </span>
              <button
                type="button"
                onClick={() => setSearchModalItem(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="bg-blue-50/60 border border-blue-200 rounded-sm p-2 text-gray-800">
                FD खाते क्र: <b>{searchModalItem.accountNo}</b> | खातेदार: <b>{searchModalItem.customerName}</b>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="बचत खाते क्र., नाव किंवा CIF शोधा..."
                  value={sbSearchTerm}
                  onChange={(e) => setSbSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performSbSearch(sbSearchTerm)}
                  className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => performSbSearch(sbSearchTerm)}
                  disabled={sbSearchLoading}
                  className="bg-primary text-white px-3 py-1.5 rounded-sm font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Search size={13} /> शोधा
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-sm divide-y divide-gray-100">
                {sbSearchLoading ? (
                  <div className="p-4 text-center text-gray-500">शोधत आहे...</div>
                ) : sbSearchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">कोणतेही खाते आढळले नाही. वर खाते क्र. टाईप करून शोधा.</div>
                ) : (
                  sbSearchResults.map((sb) => (
                    <div
                      key={sb.savingAccountID || sb.id}
                      onClick={() => handleSelectSearchedSb(sb)}
                      className="p-2 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition"
                    >
                      <div>
                        <span className="font-bold text-gray-900 block">{sb.accountNo}</span>
                        <span className="text-[11px] text-gray-600">
                          {sb.customerName || sb.name} {sb.cifNo ? `| CIF: ${sb.cifNo}` : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-800 block">
                          ₹ {(sb.currentBalance ?? sb.balance ?? 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-primary font-bold">निवडा →</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSearchModalItem(null)}
                  className="px-3 py-1.5 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                >
                  बंद करा
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FdMisInterestPayout;

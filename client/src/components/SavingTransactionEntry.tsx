import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  Layers,
  Search,
  Trash2,
  CheckCircle,
  XCircle,
  Calendar,
  CreditCard,
  Building,
  RotateCcw,
  Save,
  Plus,
  TrendingUp,
  TrendingDown,
  Percent,
  Receipt,
  FileText,
  X
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface SavingAccount {
  savingAccountID: number;
  branchID?: number;
  branchName?: string;
  branchCode?: string;
  accountNo: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  cifNo?: string;
  memberID: number;
  memberCode?: string;
  memberName?: string;
  memberNameEng?: string;
  accountType?: string;
  openingDate?: string;
  isLegacyAccount?: boolean;
  ledgerID?: number;
  ledgerName?: string;
  openingBalance?: number;
  currentBalance: number;
  interestRate?: number;
  minimumBalance: number;
  lienAmount?: number;
  lienReason?: string;
  status: string;
  nomineeName?: string;
  nomineeRelation?: string;
  lastInterestPostingDate?: string;
}

interface Ledger {
  ledgerID: number;
  ledgerName: string;
}

interface SavingTransaction {
  transactionID: number;
  savingAccountID: number;
  transactionDate: string;
  transactionType: string;
  paymentMode: string;
  amount: number;
  balanceAfterTxn: number;
  narration?: string;
  voucherNo?: string;
  accountNo?: string;
  memberName?: string;
}

const formatDisplayDate = (dStr?: string | null) => {
  if (!dStr) return '-';
  try {
    const clean = dStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  } catch {
    return dStr;
  }
};

const SavingTransactionEntry: React.FC = () => {
  const [accounts, setAccounts] = useState<SavingAccount[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [bankLedgers, setBankLedgers] = useState<Ledger[]>([]);
  const [transactions, setTransactions] = useState<SavingTransaction[]>([]);
  
  const [selectedLedgerID, setSelectedLedgerID] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<SavingAccount | null>(null);

  const [selectedTargetLedgerID, setSelectedTargetLedgerID] = useState<number>(0);
  const [selectedTargetAccount, setSelectedTargetAccount] = useState<SavingAccount | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTxnModal, setShowTxnModal] = useState(false);

  const API_URL = '/api';

  const [formData, setFormData] = useState({
    savingAccountID: 0,
    targetSavingAccountID: 0,
    bankLedgerID: 0,
    transactionDate: new Date().toISOString().split('T')[0],
    transactionType: 'Deposit',
    paymentMode: 'Cash',
    amount: '',
    narration: '',
    checkNo: ''
  });

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
    fetchBankLedgers();
  }, []);

  const fetchBankLedgers = async () => {
    try {
      const res = await axios.get(`${API_URL}/Ledgers`);
      const allLedgers: Ledger[] = Array.isArray(res.data) ? res.data : [];
      const bLedgers = allLedgers.filter((l: any) => {
        if (!l) return false;
        const name = (l.ledgerName || '').toLowerCase();
        const type = (l.accountType || '').toLowerCase();
        const group = l.groupID || 0;
        return (
          type.includes('bank') ||
          name.includes('bank') ||
          name.includes('बँक') ||
          group === 12 || group === 8 || group === 9
        );
      });
      setBankLedgers(bLedgers.length > 0 ? bLedgers : allLedgers);
    } catch (e) {
      console.error('Error fetching bank ledgers', e);
    }
  };

  const fetchAccounts = async (preserveAccountId?: number) => {
    try {
      const [accRes, interestRes, ledgersRes] = await Promise.all([
        axios.get(`${API_URL}/SavingAccounts`),
        axios.get(`${API_URL}/SavingSettings/Interest`).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/Ledgers`).catch(() => ({ data: [] }))
      ]);
      const accData: SavingAccount[] = accRes.data || [];
      setAccounts(accData);

      // Re-sync selectedAccount with the latest fresh balance from API
      const targetAccId = preserveAccountId || selectedAccount?.savingAccountID || formData.savingAccountID;
      if (targetAccId && targetAccId > 0) {
        const freshAcc = accData.find(a => a.savingAccountID === targetAccId);
        if (freshAcc) {
          setSelectedAccount(freshAcc);
          if (freshAcc.ledgerID) {
            setSelectedLedgerID(freshAcc.ledgerID);
          }
        }
      }

      // Also re-sync selectedTargetAccount if in Transfer mode
      if (formData.targetSavingAccountID && formData.targetSavingAccountID > 0) {
        const freshTarget = accData.find(a => a.savingAccountID === formData.targetSavingAccountID);
        if (freshTarget) {
          setSelectedTargetAccount(freshTarget);
        }
      }

      const allLedgersList: any[] = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
      const uniqueLedgerMap = new Map<number, string>();

      // 1. Prioritize schemes created in Saving Scheme Master
      if (Array.isArray(interestRes.data) && interestRes.data.length > 0) {
        interestRes.data.forEach((s: any) => {
          const targetLid = s.savingLiabilityLedgerID || s.ledgerID || s.interestExpenseLedgerID;
          if (targetLid && targetLid > 0) {
            const rawName = s.schemeName || s.savingLiabilityLedger?.ledgerName || s.ledger?.ledgerName || 'बचत योजना';
            const rateInfo = (s.interestRate !== undefined && s.interestRate !== null) ? ` (${s.interestRate}%)` : '';
            uniqueLedgerMap.set(targetLid, `${rawName}${rateInfo}`);
          }
        });
      }

      // 2. Fallback: Saving ledgers from /api/Ledgers
      if (uniqueLedgerMap.size === 0) {
        allLedgersList.forEach((l: any) => {
          if (!l || !l.ledgerID) return;
          const typeMatch = Boolean(l.accountType && l.accountType.toLowerCase().includes('saving'));
          const nameMatch = Boolean(l.ledgerName && (l.ledgerName.includes('बचत') || l.ledgerName.toLowerCase().includes('saving')));
          if (typeMatch || nameMatch) {
            uniqueLedgerMap.set(l.ledgerID, l.ledgerName);
          }
        });
      }

      // 3. Add ledgers from existing saving accounts to ensure complete coverage
      accData.forEach((acc: any) => {
        const lid = acc.ledgerID;
        const lname = acc.ledgerName || 'बचत ठेव';
        if (lid && !uniqueLedgerMap.has(lid)) {
          uniqueLedgerMap.set(lid, lname);
        }
      });

      const ledgerList = Array.from(uniqueLedgerMap.entries()).map(([ledgerID, ledgerName]) => ({ ledgerID, ledgerName }));
      setLedgers(ledgerList);

      const params = new URLSearchParams(window.location.search);
      const memberIdStr = params.get('memberId');
      const accountIdStr = params.get('accountId') || params.get('savingAccountId');
      const typeStr = params.get('type');

      if (!preserveAccountId) {
        if (accountIdStr) {
          const accId = parseInt(accountIdStr, 10);
          const matchedAcc = accData.find((a: any) => a.savingAccountID === accId);
          if (matchedAcc) {
            setSelectedLedgerID(matchedAcc.ledgerID || 7);
            setFormData((prev) => ({
              ...prev,
              savingAccountID: matchedAcc.savingAccountID,
              transactionType: typeStr || prev.transactionType
            }));
            setSelectedAccount(matchedAcc);
          }
        } else if (memberIdStr) {
          const mId = parseInt(memberIdStr, 10);
          const matchedAcc = accData.find((a: any) => a.memberID === mId);
          if (matchedAcc) {
            setSelectedLedgerID(matchedAcc.ledgerID || 7);
            setFormData((prev) => ({
              ...prev,
              savingAccountID: matchedAcc.savingAccountID,
              transactionType: typeStr || prev.transactionType
            }));
            setSelectedAccount(matchedAcc);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching accounts or interest settings', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/SavingTransactions`);
      setTransactions(response.data || []);
    } catch (err) {
      console.error('Error fetching transactions', err);
    }
  };

  const handleLedgerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lid = parseInt(e.target.value, 10) || 0;
    setSelectedLedgerID(lid);
    setFormData(prev => ({ ...prev, savingAccountID: 0 }));
    setSelectedAccount(null);
    setError('');
  };

  const handleTargetLedgerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lid = parseInt(e.target.value, 10) || 0;
    setSelectedTargetLedgerID(lid);
    setFormData(prev => ({ ...prev, targetSavingAccountID: 0 }));
    setSelectedTargetAccount(null);
    setError('');
  };

  const handleAccountChange = (e: any) => {
    const accountId = parseInt(e.target.value, 10) || 0;
    setFormData((prev) => ({ ...prev, savingAccountID: accountId }));
    const acc = accounts.find(a => a.savingAccountID === accountId) || null;
    setSelectedAccount(acc);
    if (acc && acc.ledgerID) {
      setSelectedLedgerID(acc.ledgerID);
    }
    setError('');
    setSuccess('');
  };

  const handleTargetAccountChange = (e: any) => {
    const accountId = parseInt(e.target.value, 10) || 0;
    setFormData((prev) => ({ ...prev, targetSavingAccountID: accountId }));
    const acc = accounts.find(a => a.savingAccountID === accountId) || null;
    setSelectedTargetAccount(acc);
    if (acc && acc.ledgerID) {
      setSelectedTargetLedgerID(acc.ledgerID);
    }
    setError('');
    setSuccess('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.savingAccountID) {
      setError('कृपया बचत खाते निवडा (Please select an account.)');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('रक्कम 0 पेक्षा जास्त असावी (Amount must be greater than zero.)');
      return;
    }

    if (formData.paymentMode === 'Bank' && (!formData.bankLedgerID || formData.bankLedgerID === 0)) {
      setError('कृपया बँक ट्रान्सफरसाठी बँक जी.एल. खाते निवडा (Please select a Bank GL Account.)');
      return;
    }

    if (formData.paymentMode === 'Transfer' && (!formData.targetSavingAccountID || formData.targetSavingAccountID === 0)) {
      setError('कृपया हस्तांतरणासाठी टार्गेट बचत खाते निवडा (Please select a target saving account.)');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload: any = {
        savingAccountID: formData.savingAccountID,
        transactionDate: formData.transactionDate,
        transactionType: formData.transactionType,
        paymentMode: formData.paymentMode,
        amount: parseFloat(formData.amount),
        narration: formData.narration,
        checkNo: formData.checkNo
      };

      if (formData.paymentMode === 'Bank') {
        payload.bankLedgerID = Number(formData.bankLedgerID);
      }

      if (formData.paymentMode === 'Transfer') {
        payload.targetSavingAccountID = Number(formData.targetSavingAccountID);
      }

      const response = await axios.post(`${API_URL}/SavingTransactions`, payload);
      
      const newBal = response.data?.currentBalance !== undefined 
        ? ` | चालू शिल्लक: ₹${Number(response.data.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` 
        : '';
      const voucherInfo = response.data?.voucherNo ? ` [व्हाउचर क्र.: ${response.data.voucherNo}]` : '';

      setSuccess(`व्यवहार यशस्वीरित्या नोंदवला गेला!${voucherInfo}${newBal}`);
      
      const currentAccId = formData.savingAccountID;
      setFormData((prev) => ({
        ...prev,
        amount: '',
        narration: '',
        checkNo: ''
      }));
      
      fetchTransactions();
      await fetchAccounts(currentAccId);
    } catch (err: any) {
      console.error('Error saving transaction', err);
      setError(err.response?.data?.message || 'व्यवहार जतन करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Filter accounts by selected deposit ledger
  const filteredAccounts = selectedLedgerID > 0
    ? accounts.filter(acc => (acc.ledgerID || 7) === selectedLedgerID)
    : accounts;

  const accountOptions = filteredAccounts.map((acc) => {
    const codePart = acc.memberCode ? ` [${acc.memberCode}]` : '';
    const oldAccPart = (acc.oldAccountNo || acc.legacyAccountNumber) ? ` (जुने: ${acc.oldAccountNo || acc.legacyAccountNumber})` : '';
    const engPart = acc.memberNameEng ? ` (${acc.memberNameEng})` : '';
    const balPart = ` - शिल्लक: ₹${(acc.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return {
      value: acc.savingAccountID,
      label: `${acc.accountNo}${oldAccPart}${codePart} - ${acc.memberName || 'अज्ञात'}${engPart}${balPart}`
    };
  });

  // Target accounts filtered by selected target deposit ledger (and excluding source account)
  const filteredTargetAccounts = selectedTargetLedgerID > 0
    ? accounts.filter(acc => (acc.ledgerID || 7) === selectedTargetLedgerID && acc.savingAccountID !== formData.savingAccountID)
    : accounts.filter(acc => acc.savingAccountID !== formData.savingAccountID);

  const targetAccountOptions = filteredTargetAccounts.map((acc) => {
    const codePart = acc.memberCode ? ` [${acc.memberCode}]` : '';
    const oldAccPart = (acc.oldAccountNo || acc.legacyAccountNumber) ? ` (जुने: ${acc.oldAccountNo || acc.legacyAccountNumber})` : '';
    const engPart = acc.memberNameEng ? ` (${acc.memberNameEng})` : '';
    const balPart = ` - शिल्लक: ₹${(acc.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return {
      value: acc.savingAccountID,
      label: `${acc.accountNo}${oldAccPart}${codePart} - ${acc.memberName || 'अज्ञात'}${engPart}${balPart}`
    };
  });

  // Filter transactions by search query (Exclude Opening Balance migration entries)
  const filteredTransactions = transactions.filter((t) => {
    const isOpeningBal = t.narration && (t.narration.toLowerCase().includes('opening balance') || t.narration.includes('आरंभीची शिल्लक'));
    if (isOpeningBal) return false;

    const query = searchQuery.toLowerCase();
    return (
      (t.accountNo && t.accountNo.toLowerCase().includes(query)) ||
      (t.memberName && t.memberName.toLowerCase().includes(query)) ||
      (t.transactionType && t.transactionType.toLowerCase().includes(query)) ||
      (t.voucherNo && t.voucherNo.toLowerCase().includes(query))
    );
  });

  const handleDeleteTransaction = async (id: number) => {
    if (!window.confirm('तुम्हाला खरोखर हा व्यवहार डिलीट करायचा आहे का? (Are you sure you want to delete this transaction?)')) {
      return;
    }

    try {
      const currentAccId = formData.savingAccountID;
      const res = await fetch(`/api/SavingTransactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccess('व्यवहार यशस्वीरित्या डिलीट केला (Transaction deleted successfully).');
        fetchTransactions();
        await fetchAccounts(currentAccId);
      } else {
        const data = await res.json();
        setError(data.message || 'व्यवहार डिलीट करताना त्रुटी आली.');
      }
    } catch (err) {
      setError('Network error while deleting transaction.');
    }
  };

  // Live Real-Time Projected Balance Calculations
  const txnAmountNum = parseFloat(formData.amount) || 0;
  const currentBalNum = selectedAccount?.currentBalance || 0;
  const openingBalNum = selectedAccount?.openingBalance || 0;
  const lienNum = selectedAccount?.lienAmount || 0;
  const minBalNum = selectedAccount?.minimumBalance || 500;
  const availableToWithdraw = Math.max(0, currentBalNum - lienNum - minBalNum);

  let simulatedBalance = currentBalNum;
  if (formData.transactionType === 'Deposit') {
    simulatedBalance = currentBalNum + txnAmountNum;
  } else if (formData.transactionType === 'Withdrawal' || formData.transactionType === 'Charges') {
    simulatedBalance = currentBalNum - txnAmountNum;
  }
  const isInsufficient = formData.transactionType === 'Withdrawal' && txnAmountNum > availableToWithdraw;

  // KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTxns = transactions.filter(t => t.transactionDate && t.transactionDate.startsWith(todayStr));
  const todayTxnCount = todayTxns.length;
  const todayDepositSum = todayTxns
    .filter(t => t.transactionType === 'Deposit' || t.transactionType === 'Interest')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const todayWithdrawalSum = todayTxns
    .filter(t => t.transactionType === 'Withdrawal' || t.transactionType === 'Charges')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <ArrowDownCircle size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>बचत जमा व नावे नोंद</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Saving Deposit / Withdrawal Entry)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              बचत खात्यात रोख, बँक व ट्रान्सफर रक्कम जमा व नावे व्यवहार नोंदणी आणि खात्याची चालू शिल्लक व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchTransactions();
              setShowTxnModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="अलीकडील सर्व बचत व्यवहार यादी पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 अलीकडील व्यवहार यादी ({filteredTransactions.length})</span>
          </button>
        </div>
      </div>

      {/* 4-KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण बचत खाती</div>
            <div className="text-sm font-black text-gray-900">{accounts.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">आजचे व्यवहार</div>
            <div className="text-sm font-black text-indigo-950">{todayTxnCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">आजची जमा रक्कम (Cr ₹)</div>
            <div className="text-sm font-black text-emerald-800">
              ₹ {todayDepositSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">आजची नावे रक्कम (Dr ₹)</div>
            <div className="text-sm font-black text-rose-800">
              ₹ {todayWithdrawalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Content Layout - Form & Details Card side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-3">
        
        {/* Form Container */}
        <div className="lg:col-span-3 bg-white p-3.5 rounded-sm shadow-xs border border-gray-200">
          <div className="border-b border-gray-200 pb-2 mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 border-l-4 border-primary pl-2 text-primary font-bold text-xs">
              📝 व्यवहार तपशील (Transaction Details)
            </span>
            <span className="text-[11px] font-normal text-gray-500">
              एकूण खाती: <b>{accounts.length}</b>
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Transaction Type Segmented Toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded border border-gray-200 inline-flex">
              <label className={`cursor-pointer px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${formData.transactionType === 'Deposit' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:bg-slate-200'}`}>
                <input
                  type="radio"
                  name="transactionType"
                  value="Deposit"
                  checked={formData.transactionType === 'Deposit'}
                  onChange={handleInputChange}
                  className="hidden"
                />
                <ArrowDownCircle size={14} className="stroke-[2.5]" />
                <span>जमा (Deposit)</span>
              </label>
              <label className={`cursor-pointer px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${formData.transactionType === 'Withdrawal' ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-600 hover:bg-slate-200'}`}>
                <input
                  type="radio"
                  name="transactionType"
                  value="Withdrawal"
                  checked={formData.transactionType === 'Withdrawal'}
                  onChange={handleInputChange}
                  className="hidden"
                />
                <ArrowUpCircle size={14} className="stroke-[2.5]" />
                <span>नावे (Withdrawal)</span>
              </label>
            </div>

            {/* Account Selection and Ledger Filter Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Saving Ledger / Scheme Filter */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                  बचत ठेव योजना / प्रकार (Filter Scheme)
                </label>
                <select
                  value={selectedLedgerID}
                  onChange={handleLedgerChange}
                  className="w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium h-[30px]"
                >
                  <option value={0}>-- सर्व बचत योजना (All Schemes) --</option>
                  {ledgers.map((l) => (
                    <option key={l.ledgerID} value={l.ledgerID}>
                      {l.ledgerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Searchable Select */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                  बचत खाते निवडा (Select Saving Account) *
                </label>
                <SearchableSelect
                  options={accountOptions}
                  value={formData.savingAccountID}
                  onChange={handleAccountChange}
                  name="savingAccountID"
                  placeholder="-- खाते क्रमांक, जुना क्र. किंवा नाव शोधा --"
                />
              </div>
            </div>

            {/* Transaction Core Details: Date, Mode, Amount, Ref No */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              {/* Date */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                  व्यवहार दिनांक (Date) *
                </label>
                <input
                  type="date"
                  name="transactionDate"
                  value={formData.transactionDate}
                  onChange={handleInputChange}
                  required
                  className="w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium h-[30px]"
                />
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                  पद्धत (Payment Mode) *
                </label>
                <select
                  name="paymentMode"
                  value={formData.paymentMode}
                  onChange={handleInputChange}
                  className="w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-bold h-[30px]"
                >
                  <option value="Cash">💵 रोख (Cash)</option>
                  <option value="Bank">🏦 बँक ट्रान्सफर (Bank Transfer)</option>
                  <option value="Transfer">🔄 अंतर्गत ट्रान्सफर (Internal Transfer)</option>
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                  रक्कम (Amount ₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="1"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                    className="w-full text-[11px] border border-gray-300 pl-6 pr-2.5 py-1 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-black h-[30px]"
                  />
                </div>
              </div>

              {/* Check / Ref No (When not Bank, but still needed optionally) */}
              {formData.paymentMode !== 'Bank' && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                    संदर्भ क्र. (Ref / Voucher No)
                  </label>
                  <input
                    type="text"
                    name="checkNo"
                    value={formData.checkNo}
                    onChange={handleInputChange}
                    placeholder="ऐच्छिक संदर्भ क्रमांक"
                    className="w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium h-[30px]"
                  />
                </div>
              )}

              {/* Narration */}
              <div className={formData.paymentMode === 'Bank' ? 'md:col-span-1' : 'md:col-span-4'}>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                  तपशील (Narration)
                </label>
                <input
                  type="text"
                  name="narration"
                  value={formData.narration}
                  onChange={handleInputChange}
                  placeholder="उदा. रोख भरणा / बँक जमा / ट्रान्सफर"
                  className="w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium h-[30px]"
                />
              </div>
            </div>

            {/* Cash Ledger Reflection Banner (Shown when Payment Mode is Cash) */}
            {formData.paymentMode === 'Cash' && (
              <CashLedgerReflectBadge 
                transactionType={formData.transactionType === 'Deposit' ? 'Deposit' : 'Withdrawal'} 
              />
            )}

            {/* Bank GL Account Selection Card (Shown when Payment Mode is Bank Transfer) */}
            {formData.paymentMode === 'Bank' && (
              <div className="bg-slate-50 p-3 rounded-sm border border-blue-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between border-b border-blue-200 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-blue-700" />
                    <h3 className="text-xs font-bold text-blue-950 tracking-wide">
                      बँक ट्रान्सफर व बँक जी.एल. तपशील (Bank GL Transfer Details)
                    </h3>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-300">
                    {bankLedgers.length} बँक जी.एल. खाती उपलब्ध
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-0.5">
                      🏦 बँक जी.एल. खाते निवडा (Select Bank GL Account) *
                    </label>
                    <select
                      name="bankLedgerID"
                      value={formData.bankLedgerID}
                      onChange={handleInputChange}
                      className="w-full text-[11px] border border-blue-400 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 focus:outline-none bg-white text-blue-950 font-bold h-[30px] shadow-2xs"
                      required
                    >
                      <option value={0}>-- बँक जी.एल. खाते निवडा --</option>
                      {bankLedgers.map((bl) => (
                        <option key={bl.ledgerID} value={bl.ledgerID}>
                          {bl.ledgerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-0.5">
                      चेक / युटीआर / संदर्भ क्र. (Cheque / UTR / Ref No)
                    </label>
                    <input
                      type="text"
                      name="checkNo"
                      value={formData.checkNo}
                      onChange={handleInputChange}
                      placeholder="उदा. CHQ-984512 / UTR12345678"
                      className="w-full text-[11px] border border-blue-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none bg-white font-medium text-slate-800 h-[30px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Selected Member Quick Info Badge */}
            {selectedAccount && (
              <div className="p-2.5 bg-slate-100 rounded-sm border border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    👤
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">{selectedAccount.memberName}</span>
                    {selectedAccount.memberCode && (
                      <span className="ml-1.5 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                        {selectedAccount.memberCode}
                      </span>
                    )}
                    <span className="ml-2 text-slate-500 font-mono">({selectedAccount.accountNo})</span>
                    {(selectedAccount.oldAccountNo || selectedAccount.legacyAccountNumber) && (
                      <span className="ml-1.5 text-[10px] text-amber-950 font-bold bg-amber-100 border border-amber-300 rounded px-1">
                        जुने: {selectedAccount.oldAccountNo || selectedAccount.legacyAccountNumber}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 font-semibold text-xs">
                  <span>ठेव प्रकार: <b className="text-slate-800">{selectedAccount.ledgerName || 'बचत ठेव'}</b></span>
                  <span>उपलब्ध शिल्लक: <b className="text-emerald-700 font-bold">₹ {availableToWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
                </div>
              </div>
            )}

            {/* Transfer Target Account Details */}
            {formData.paymentMode === 'Transfer' && (
              <div className="bg-slate-50 p-3 rounded-sm border border-indigo-200 shadow-2xs space-y-2">
                <div className="flex items-center gap-1.5 border-b border-indigo-200 pb-1">
                  <CreditCard className="w-4 h-4 text-indigo-700" />
                  <h3 className="text-xs font-bold text-indigo-900 tracking-wide">
                    हस्तांतरण टार्गेट खाते माहिती (Target Account Details)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-950 mb-0.5">
                      🎯 टार्गेट बचत ठेव प्रकार (Target Scheme) *
                    </label>
                    <select
                      value={selectedTargetLedgerID}
                      onChange={handleTargetLedgerChange}
                      className="w-full text-[11px] border border-indigo-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 focus:outline-none bg-white font-medium text-slate-800 h-[30px]"
                    >
                      <option value={0}>-- सर्व टार्गेट प्रकार (All Target Ledgers) --</option>
                      {ledgers.map((l) => (
                        <option key={l.ledgerID} value={l.ledgerID}>
                          {l.ledgerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-indigo-950 mb-0.5">
                      🎯 हस्तांतरित करायचे टार्गेट खाते (Target Account) *
                    </label>
                    <SearchableSelect
                      options={targetAccountOptions}
                      value={formData.targetSavingAccountID}
                      onChange={handleTargetAccountChange}
                      name="targetSavingAccountID"
                      placeholder="-- टार्गेट खाते निवडा --"
                    />
                  </div>

                  {selectedTargetAccount ? (
                    <div className="md:col-span-1 bg-emerald-50 border border-emerald-300 rounded-sm px-3 py-1.5 flex flex-col justify-center shadow-2xs">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        👤 खातेदार: {selectedTargetAccount.memberName}
                      </span>
                      <span className="text-xs font-black text-emerald-950">
                        💳 शिल्लक: ₹ {selectedTargetAccount.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <div className="md:col-span-1 text-[11px] text-slate-400 italic flex items-center">
                      टार्गेट खाते निवडल्यावर शिल्लक दिसेल
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading || isInsufficient}
                className={`px-6 py-2 rounded-sm font-bold text-xs text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  formData.transactionType === 'Deposit'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Save size={14} />
                <span>
                  {loading ? 'जतन करत आहे...' : (
                    formData.transactionType === 'Deposit' 
                      ? 'रक्कम जमा करा (Save Deposit)' 
                      : 'रक्कम नावे करा (Save Withdrawal)'
                  )}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Account Details Side Card */}
        <div className="rounded-sm border border-gray-200 shadow-xs overflow-hidden flex flex-col justify-between bg-white">
          {/* Card Header matching App Primary Theme */}
          <div className="px-3.5 py-2 flex items-center justify-between bg-primary text-white">
            <div className="flex items-center gap-1.5">
              <Wallet size={15} />
              <span className="text-xs font-bold tracking-wide">खाते माहिती (Account Info)</span>
            </div>
            {selectedAccount && (
              <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-xs font-mono font-bold">
                {selectedAccount.branchName || 'मुख्य शाखा'}
              </span>
            )}
          </div>

          <div className="p-3 flex-1 flex flex-col justify-between bg-slate-50/50 space-y-2.5">
            {selectedAccount ? (
              <>
                {/* Member Details */}
                <div className="bg-white rounded-sm p-2.5 border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">खातेदार नाव</span>
                      <p className="font-bold text-sm text-slate-900 truncate leading-tight">{selectedAccount.memberName}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {selectedAccount.memberCode && (
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                            कोड: {selectedAccount.memberCode}
                          </span>
                        )}
                        {selectedAccount.cifNo && (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 font-mono">
                            CIF: {selectedAccount.cifNo}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded tracking-wide shrink-0 ${
                      selectedAccount.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      selectedAccount.status === 'Frozen' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                      selectedAccount.status === 'Dormant' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {selectedAccount.status === 'Active' ? '● सक्रिय' :
                       selectedAccount.status === 'Frozen' ? '🔒 फ्रीझ' :
                       selectedAccount.status === 'Dormant' ? '⚠️ सुप्त' : '● बंद'}
                    </span>
                  </div>

                  {/* Account Numbers & Ledger */}
                  <div className="pt-1.5 border-t border-slate-100 flex flex-wrap justify-between items-center text-xs gap-1">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">बचत खाते क्र. (CBS)</span>
                      <span className="font-mono font-extrabold text-primary text-xs">{selectedAccount.accountNo}</span>
                      {(selectedAccount.oldAccountNo || selectedAccount.legacyAccountNumber) && (
                        <div className="text-[10px] text-amber-950 font-bold bg-amber-100/90 border border-amber-300 rounded px-1 mt-0.5 inline-block">
                          जुने क्र.: {selectedAccount.oldAccountNo || selectedAccount.legacyAccountNumber}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">ठेव योजना (GL)</span>
                      <span className="font-bold text-slate-800 text-[11px]">{selectedAccount.ledgerName || 'बचत ठेव'}</span>
                      {selectedAccount.openingDate && (
                        <span className="text-[10px] text-slate-500 block font-mono">
                          उघडले: {formatDisplayDate(selectedAccount.openingDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4-Card Financial Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Opening Balance */}
                  <div className="bg-white rounded-sm p-2 border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-xs">🏁</span>
                      <span className="text-[10px] text-slate-500 font-bold">सुरुवातीची शिल्लक</span>
                    </div>
                    <p className="font-black text-xs text-slate-800 font-mono">
                      ₹{openingBalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Current Ledger Balance */}
                  <div className={`rounded-sm p-2 border shadow-2xs ${currentBalNum < minBalNum ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-xs">💰</span>
                      <span className="text-[10px] text-slate-700 font-bold">सध्याची चालू शिल्लक</span>
                    </div>
                    <p className={`font-black text-sm font-mono ${currentBalNum < minBalNum ? 'text-rose-700' : 'text-emerald-800'}`}>
                      ₹{currentBalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Minimum Balance */}
                  <div className="bg-white rounded-sm p-2 border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-xs">🛡️</span>
                      <span className="text-[10px] text-slate-500 font-bold">किमान मर्यादा</span>
                    </div>
                    <p className="font-bold text-xs text-slate-700 font-mono">
                      ₹{minBalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Lien Hold */}
                  <div className={`rounded-sm p-2 border shadow-2xs ${lienNum > 0 ? 'bg-amber-100/70 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-xs">🔒</span>
                      <span className="text-[10px] text-slate-700 font-bold">तारण होल्ड</span>
                    </div>
                    <p className={`font-bold text-xs font-mono ${lienNum > 0 ? 'text-amber-900 font-black' : 'text-slate-600'}`}>
                      ₹{lienNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Live Projected Balance Simulation Banner */}
                {txnAmountNum > 0 ? (
                  <div className={`rounded-sm p-2.5 border shadow-2xs transition-all ${
                    isInsufficient
                      ? 'bg-rose-50 border-rose-400 text-rose-950'
                      : formData.transactionType === 'Deposit'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-blue-50 border-blue-300 text-blue-950'
                  }`}>
                    <div className="flex justify-between items-center text-[10px] font-bold mb-1 border-b border-black/10 pb-1">
                      <span>
                        {formData.transactionType === 'Deposit' ? '📥 जमा सिम्युलेशन (+)' : '📤 नावे सिम्युलेशन (-)'}
                      </span>
                      <span className="font-mono">
                        रक्कम: ₹{txnAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold">नवीन शिल्लक:</span>
                      <span className="text-sm font-black font-mono">
                        ₹{simulatedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {isInsufficient && (
                      <div className="mt-1.5 text-[10px] font-bold text-rose-700 bg-rose-100 border border-rose-300 rounded px-1.5 py-0.5 flex items-center gap-1">
                        <span>⚠️</span> अपुरी शिल्लक! खात्यातून जास्तीत जास्त ₹{availableToWithdraw.toFixed(2)} काढता येतील.
                      </div>
                    )}
                  </div>
                ) : (
                  /* Default Withdrawable Balance Banner */
                  <div className="rounded-sm px-3 py-2 bg-slate-900 text-white shadow-2xs flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">📤</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">काढता येणारी शिल्लक</span>
                    </div>
                    <p className="font-black text-sm text-emerald-400 font-mono">
                      ₹{availableToWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
                  <Wallet size={24} />
                </div>
                <p className="text-xs text-slate-600 font-bold">व्यवहारासाठी खाते निवडा</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Select an account to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction List Summary Bar */}
      <div className="bg-white p-3 rounded-sm shadow-xs border border-gray-200 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-primary/10 text-primary rounded">
            <Layers className="w-4 h-4" />
          </div>
          <h2 className="text-xs font-bold text-gray-800">नुकतेच झालेले बचत व्यवहार (Recent Transactions)</h2>
          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
            {filteredTransactions.length} नोंदी
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="नाव किंवा खाते क्र. शोधा..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 pl-8 pr-2.5 py-1 rounded-sm focus:outline-none focus:border-primary text-xs w-52 bg-white"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowTxnModal(true)}
            className="bg-primary hover:opacity-90 text-white text-xs px-3.5 py-1 rounded-sm shadow-2xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Layers size={13} />
            <span>व्यवहार यादी पॉपअप</span>
          </button>
        </div>
      </div>

      {/* Full Screen Modal Popup Window for Transactions */}
      {showTxnModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-sm shadow-2xl border border-gray-300 w-full max-w-7xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header Banner */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <h2 className="text-xs sm:text-sm font-bold">बचत जमा व नावे व्यवहार यादी (Saving Transactions Directory)</h2>
                <span className="bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-bold border border-white/20">
                  {filteredTransactions.length} नोंदी
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTxnModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/20 w-7 h-7 rounded-full flex items-center justify-center text-lg font-bold transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Search Bar & Filter Options */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <label className="text-xs font-bold text-gray-700 whitespace-nowrap">शोधा (Search):</label>
                <div className="relative w-full sm:w-80">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="नाव, खाते क्र. किंवा व्हाउचर क्र. शोधा..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="border border-gray-300 pl-8 pr-2.5 py-1.5 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs w-full bg-white font-medium"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold border border-emerald-200">
                  🟢 जमा व्यवहार
                </span>
                <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded font-bold border border-rose-200">
                  🔴 नावे व्यवहार
                </span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold border border-blue-200">
                  🔵 ट्रान्सफर
                </span>
              </div>
            </div>

            {/* Modal Body - Grid Table */}
            <div className="overflow-auto flex-1 p-2">
              <table className="min-w-full divide-y divide-slate-200 text-xs text-center border border-slate-200">
                <thead className="bg-slate-100 text-slate-900 border-b border-slate-300 sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-center">अ. क्र.</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-left">दिनांक (Date)</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-left">खाते क्र. (A/c No)</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-left">खातेदाराचे नाव (Member Name)</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-center">प्रकार (Type)</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-center">मोड (Mode)</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-right">रक्कम (Amount ₹)</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-right">नवीन शिल्लक (Balance ₹)</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-left">तपशील (Narration)</th>
                    <th className="px-2 py-2 border-r border-slate-300 font-bold text-center">व्हाउचर (Voucher No)</th>
                    <th className="px-2 py-2 font-bold text-center w-24 sticky right-0 bg-slate-100 shadow-xs">कारवाई (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-500 font-medium">
                        कोणतेही व्यवहार आढळले नाहीत.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t: any, index: number) => (
                      <tr key={t.transactionID} className="hover:bg-slate-50 transition-colors">
                        <td className="px-2 py-1.5 border-r border-slate-200 text-center font-semibold text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-left whitespace-nowrap text-slate-700">
                          {new Date(t.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-left font-bold text-primary font-mono whitespace-nowrap">
                          {t.accountNo}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-left font-semibold text-slate-900 min-w-[160px]">
                          {t.memberName}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded ${
                            t.transactionType === 'Deposit' || t.transactionType === 'Interest'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {t.transactionType === 'Deposit' ? '🟢 जमा' : t.transactionType === 'Withdrawal' ? '🔴 नावे' : t.transactionType}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-center whitespace-nowrap font-medium text-slate-700">
                          {t.paymentMode === 'Cash' ? '💵 रोख' : t.paymentMode === 'Transfer' ? '🔄 हस्तांतरण' : '🏦 बँक'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-right font-bold text-slate-900 font-mono whitespace-nowrap">
                          ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                          ₹{t.balanceAfterTxn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-left text-slate-600 max-w-[200px] truncate" title={t.narration || ''}>
                          {t.narration || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-slate-200 text-center font-bold text-indigo-700 whitespace-nowrap font-mono">
                          {t.voucherNo || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center sticky right-0 bg-white shadow-xs">
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(t.transactionID)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded text-[11px] font-bold border border-rose-200 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            title="डिलिट करा (Delete Transaction)"
                          >
                            <Trash2 size={12} />
                            <span>डिलीट</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-slate-600 font-medium">एकूण व्यवहार नोंदी: <b>{filteredTransactions.length}</b></span>
              <button
                type="button"
                onClick={() => setShowTxnModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer"
              >
                पॉपअप बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingTransactionEntry;

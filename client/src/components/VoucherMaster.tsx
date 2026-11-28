import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Receipt, RefreshCw, CheckCircle2, AlertCircle, Plus, RotateCcw, 
  CheckSquare, FileText, ArrowDownLeft, ArrowUpRight, Calendar, 
  Search, Printer, Edit2, Trash2, Layers, BookOpen, Building2, 
  CreditCard, UserCheck, X
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import VoucherPrint from './VoucherPrint';
import MemberSearchSelect from './common/MemberSearchSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import { filterBankLedgers, isBankAccountLedger, isCashLedgerOption } from '../utils/bankLedgerUtils';
import { getCachedMasterData } from '../utils/apiCache';
import { useAuth } from '../context/AuthContext';
import { isHeadOfficeUser, resolveWriteBranchId } from '../utils/branchAccess';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  ledgerNameEnglish?: string;
  accountType?: string;
  legacyLedgerId?: string | number;
  ledgerCode?: string;
  accountGroup?: {
    groupID?: number;
    groupCode?: string;
    groupName?: string;
    groupNameEnglish?: string;
    natureOfGroup?: string;
    displayOrder?: number;
  };
}

interface Customer {
  customerID: number;
  branchID?: number;
  cifNo?: string;
  legacyCustomerNo?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  nickName?: string;
  mobileNo?: string;
  aadhaarNo?: string;
}

interface SavingAccountSummary {
  savingAccountID?: number;
  accountNo?: string;
  formattedAccountNo?: string;
  oldAccountNo?: string;
  previousAccountNo?: string;
  legacyAccountNumber?: string;
  customerID?: number;
}

interface SavingAccountOption {
  savingAccountID: number;
  branchID: number;
  accountNo: string;
  formattedAccountNo?: string;
  previousAccountNo?: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  savingSchemeID?: number | null;
  schemeName?: string;
  customerID: number;
  cifNo?: string;
  customerName?: string;
  customerNameEng?: string;
  mobileNo?: string;
  ledgerID: number;
  ledgerName?: string;
  currentBalance: number;
  minimumBalance: number;
  availableBalance: number;
  lienAmount: number;
  status: string;
}

interface VoucherDetail {
  ledgerID: number;
  drCr: 'Dr' | 'Cr';
  amount: number;
  searchQuery?: string;
  ledgerBalance?: number;
  ledgerBalanceType?: string;
  ledgerPath?: string;
  isLocked?: boolean;
  customerID?: number | '';
  savingAccountID?: number | '';
  savingAccount?: SavingAccountSummary | null;
  chargeLoanAccountID?: number | '';
  chargeExpenseType?: string;
  chargeLoanAccount?: { loanAccountID?: number; loanAccountNo?: string; legacyAccountNumber?: string } | null;
  accountType?: string;
  showCustomerSelect?: boolean;
}

interface Voucher {
  voucherID: number;
  voucherNo: string;
  scrollNo?: number;
  voucherDate: string;
  voucherType: string;
  status?: string;
  narration: string;
  totalAmount: number;
  voucherDetails: {
    voucherDetailID: number;
    ledgerID: number;
    ledger?: Ledger;
    drCr: string;
    amount: number;
    customerID?: number;
    customer?: Customer;
    savingAccountID?: number | null;
    savingAccount?: SavingAccountSummary | null;
    chargeLoanAccountID?: number | null;
    chargeExpenseType?: string | null;
    chargeLoanAccount?: { loanAccountID?: number; loanAccountNo?: string; legacyAccountNumber?: string } | null;
    memberID?: number;
    member?: any;
  }[];
}

interface VoucherMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

export default function VoucherMaster({ onNavigate }: VoucherMasterProps = {}) {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const [ledgers, setLedgers] = useState<Ledger[]>(() => getCachedMasterData<Ledger[]>('/api/Ledgers') || []);
  const [customers, setCustomers] = useState<Customer[]>(() => getCachedMasterData<Customer[]>('/api/Customers') || []);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [branches, setBranches] = useState<any[]>(() => getCachedMasterData<any[]>('/api/Branches') || []);
  const initialBranchId = resolveWriteBranchId(user, globalBranchId);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId);
  const [expandedVoucherId, setExpandedVoucherId] = useState<number | null>(null);
  const [printingVoucherId, setPrintingVoucherId] = useState<number | null>(null);
  
  // List Modal & Search States
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listTypeFilter, setListTypeFilter] = useState('All');
  const [listPage, setListPage] = useState<number>(1);
  const [listPageSize, setListPageSize] = useState<number>(100);

  // 🔒 Core Banking Passing Mode States (तपासणी व मंजुरी मोड)
  const [isPassingMode, setIsPassingMode] = useState(false);
  const [passingVoucher, setPassingVoucher] = useState<Voucher | null>(null);
  const [passingActionLoading, setPassingActionLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  const userRoleLower = String(user?.roleName || user?.role || '').trim().toLowerCase();
  const isStrictlyCashier = userRoleLower === 'cashier';
  
  useEffect(() => {
    if (user?.branchID) {
      setSelectedBranchId(user.branchID);
      fetchCustomers(user.branchID);
      fetchSavingAccounts(user.branchID);
    }
  }, [user?.branchID]);
  
  // Form State - Rich Searchable Ledger Options
  const buildLedgerOption = (l: Ledger) => {
    const legacyPart = l.legacyLedgerId ? ` [जुना क्र: ${l.legacyLedgerId}]` : '';
    const engPart = l.ledgerNameEnglish ? ` (${l.ledgerNameEnglish})` : '';
    const grpCode = l.accountGroup?.groupCode ? `[${l.accountGroup.groupCode}] ` : (l.accountGroup?.displayOrder ? `[${l.accountGroup.displayOrder}] ` : '');
    const grpName = l.accountGroup?.groupName ? `${grpCode}${l.accountGroup.groupName}` : '';
    const groupPart = grpName ? ` - ${grpName}` : '';
    
    const natureText = l.accountGroup?.natureOfGroup === 'Expenses' ? 'खर्च (Expenses)' :
                       l.accountGroup?.natureOfGroup === 'Income' ? 'उत्पन्न (Income)' :
                       l.accountGroup?.natureOfGroup === 'Assets' ? 'मालमत्ता (Assets)' :
                       l.accountGroup?.natureOfGroup === 'Liabilities' ? 'देयता (Liabilities)' :
                       (l.accountType || '');

    return {
      value: l.ledgerID.toString(),
      label: `${l.ledgerID} - ${l.ledgerName}${engPart}${legacyPart}${groupPart}`,
      subLabel: grpName ? `गट: ${grpName}${l.accountGroup?.groupNameEnglish ? ' (' + l.accountGroup.groupNameEnglish + ')' : ''}` : undefined,
      badge: natureText,
      badgeColor: l.accountGroup?.natureOfGroup === 'Expenses' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  l.accountGroup?.natureOfGroup === 'Income' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  l.accountGroup?.natureOfGroup === 'Assets' ? 'bg-amber-50 text-[#9A3412] border-amber-200' :
                  'bg-slate-100 text-slate-700 border-slate-200'
    };
  };

  const ledgerOptions = useMemo(() => {
    return ledgers.map(buildLedgerOption);
  }, [ledgers]);

  const nonCashLedgerOptions = useMemo(() => {
    return ledgers
      .filter(l => !isCashLedgerOption(l as any))
      .map(buildLedgerOption);
  }, [ledgers]);

  const nonCashBankLedgerOptions = useMemo(() => {
    return ledgers
      .filter(l => !isCashLedgerOption(l as any) && !isBankAccountLedger(l as any))
      .map(buildLedgerOption);
  }, [ledgers]);

  const getRowLedgerOptions = (detail: VoucherDetail) => {
    if (detail.isLocked) return ledgerOptions;
    let baseOptions = ledgerOptions;
    if (voucherType === 'Contra') {
      baseOptions = ledgerOptions;
    } else if (voucherType === 'Journal' || voucherType === 'Receipt' || voucherType === 'Payment') {
      baseOptions = nonCashLedgerOptions;
    }
    if (detail.ledgerID > 0 && !baseOptions.some(o => o.value === detail.ledgerID.toString())) {
      const existing = ledgers.find(l => l.ledgerID === detail.ledgerID);
      if (existing) {
        return [buildLedgerOption(existing), ...baseOptions];
      }
    }
    return baseOptions;
  };

  const [editingVoucherId, setEditingVoucherId] = useState<number | null>(null);
  const [voucherNo, setVoucherNo] = useState('AUTO');
  const [voucherDate, setVoucherDate] = useState(
    user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [voucherType, setVoucherType] = useState('Receipt');
  const [voucherPaymentMode, setVoucherPaymentMode] = useState<'Cash' | 'Bank'>('Cash');
  const [narration, setNarration] = useState('');
  const [details, setDetails] = useState<VoucherDetail[]>([]);
  const [savingControlLedgerIds, setSavingControlLedgerIds] = useState<number[]>([]);
  const [savingAccounts, setSavingAccounts] = useState<SavingAccountOption[]>([]);
  const [loanChargeControlLedgerIds, setLoanChargeControlLedgerIds] = useState<number[]>([]);
  const [dynamicIncomeLedgers, setDynamicIncomeLedgers] = useState<{ ledgerID: number; ledgerName: string; ledgerCode?: string; groupName?: string }[]>([]);
  const [loanAccountsForCharges, setLoanAccountsForCharges] = useState<any[]>([]);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const narrationInputRef = useRef<HTMLTextAreaElement>(null);

  const API_URL = '/api/Vouchers';
  const LEDGER_API = '/api/Ledgers';
  const CUSTOMER_API = '/api/Customers';
  const BRANCH_API = '/api/Branches';
  const SAVING_ACCOUNTS_API = '/api/SavingAccounts';

  const defaultSavingControlLedgerId = useMemo(() => {
    if (savingControlLedgerIds.length > 0) return savingControlLedgerIds[0];
    const fallback = ledgers.find(l => (l.accountType || '').toLowerCase() === 'savings');
    return fallback ? fallback.ledgerID : 0;
  }, [savingControlLedgerIds, ledgers]);

  const isSavingControlLedger = (ledgerId: number): boolean => {
    if (!ledgerId || ledgerId <= 0) return false;
    if (savingControlLedgerIds.includes(ledgerId)) return true;
    if (savingControlLedgerIds.length === 0) {
      const l = ledgers.find(item => item.ledgerID === ledgerId);
      return (l?.accountType || '').toLowerCase() === 'savings';
    }
    return false;
  };

  const isLoanControlLedger = (ledgerId: number): boolean => {
    return ledgerId > 0 && loanChargeControlLedgerIds.includes(ledgerId);
  };

  const buildLoanChargeAccountOptions = (detail: VoucherDetail) => {
    const todayStr = voucherDate || new Date().toISOString().split('T')[0];
    return loanAccountsForCharges
      .filter(a => {
        if (!a || a.status === 'Closed') return false;
        const rateLId = Number(a.loanRate?.loanLedgerID || 0);
        if (detail.ledgerID > 0 && rateLId > 0) {
          return rateLId === Number(detail.ledgerID);
        }
        return true;
      })
      .map(a => {
        const cust = a.customer || a.member?.customer;
        const name = cust
          ? [cust.firstName, cust.middleName, cust.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
          : '';
        const oldTag = a.legacyAccountNumber ? ` [जुना: ${a.legacyAccountNumber}]` : '';
        const isOverdue = Boolean(a.maturityDate && String(a.maturityDate).split('T')[0] <= todayStr);
        const overdueTag = isOverdue ? ' [थकबाकी/मुदतपूर्ती]' : '';
        return {
          value: String(a.loanAccountID),
          label: `${a.loanAccountNo}${oldTag} — ${name || 'कर्जदार'}${cust?.cifNo ? ` (${cust.cifNo})` : ''} | मुद्दल: ₹${Number(a.principalBalance || 0).toLocaleString('en-IN')}${overdueTag}`,
        };
      });
  };

  useEffect(() => {
    if (user?.businessDate && !editingVoucherId && !isPassingMode) {
      setVoucherDate(user.businessDate.split('T')[0]);
    }
  }, [user?.businessDate, editingVoucherId, isPassingMode]);

  useEffect(() => {
    fetchNextVoucherNo('Receipt', selectedBranchId);
    fetchBranches();
    fetchLedgers();
    fetchSavingControlLedgers();
    fetchLoanChargeLedgers();
    const timer = setTimeout(() => {
      fetchCustomers(selectedBranchId);
      fetchSavingAccounts(selectedBranchId);
      fetchLoanAccountsForCharges(selectedBranchId);
      fetchVouchers();
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  // Check URL params for Passing Mode (उदा. व्हाउचर पासिंग स्क्रीनवरून आलेली तपासणी विनंती)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pMode = params.get('passingMode') === 'true';
    const vIdStr = params.get('voucherId') || params.get('id');
    if (pMode && vIdStr) {
      const vId = parseInt(vIdStr, 10);
      setIsPassingMode(true);
      loadVoucherForPassing(vId);
    }
  }, [ledgers]);

  const loadVoucherForPassing = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/${id}`);
      if (res.ok) {
        const v: Voucher = await res.json();
        setPassingVoucher(v);
        handleEdit(v);
      }
    } catch (err) {
      console.error('Failed to load voucher for passing', err);
    }
  };

  const handlePassVoucher = async () => {
    const vId = passingVoucher?.voucherID || editingVoucherId;
    const vNo = passingVoucher?.voucherNo || voucherNo;
    if (!vId) return;
    if (!window.confirm(`तुम्हाला खात्री आहे का की व्हाउचर क्र. ${vNo} मंजूर व पास करायचे आहे?`)) return;

    setPassingActionLoading(true);
    try {
      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: [vId],
          approvedBy: user?.userID || 1,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        const scrollInfo = resData?.vouchers?.[0]?.scrollNo ? ` (स्क्रॉल क्र.: #${resData.vouchers[0].scrollNo})` : '';
        alert(`✅ व्हाउचर क्र. ${vNo} यशस्वीरीत्या पास झाले!${scrollInfo}`);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        const errText = await res.text();
        alert(`त्रुटी: ${errText}`);
      }
    } catch (e) {
      alert('व्हाउचर पास करताना नेटवर्क त्रुटी आली.');
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    const vId = passingVoucher?.voucherID || editingVoucherId;
    const vNo = passingVoucher?.voucherNo || voucherNo;
    if (!vId) return;
    if (!rejectionReason.trim()) {
      alert('कृपया नामंजूर करण्याचे कारण लिहा.');
      return;
    }

    setPassingActionLoading(true);
    try {
      const res = await fetch(`/api/VoucherPosting/${vId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {})
        },
        body: JSON.stringify({
          reason: rejectionReason.trim(),
          userId: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin',
        }),
      });

      const resData = await res.json().catch(() => null);
      if (res.ok) {
        alert(resData?.message || `व्हाउचर क्र. ${vNo} नामंजूर / रद्द करण्यात आले.`);
        setRejectModalOpen(false);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        alert(resData?.message || resData || 'व्हाउचर नामंजूर करताना त्रुटी आली.');
      }
    } catch (e) {
      alert('व्हाउचर नामंजूर करताना त्रुटी आली.');
    } finally {
      setPassingActionLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch(BRANCH_API);
      if (response.ok) {
        setBranches(await response.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getCashLedger = (
    ledgersList: Ledger[] = ledgers,
    branchId: number = selectedBranchId,
    branchesList: any[] = branches
  ): number => {
    if (!ledgersList || ledgersList.length === 0) return 0;

    const currentBranch = branchesList.find(b => b.branchID === branchId);

    const nonBankLedgers = ledgersList.filter(l => !isBankAccountLedger(l as any));

    // 1. Check if the branch has a mapped defaultCashLedgerID
    if (currentBranch?.defaultCashLedgerID) {
      const mappedLedger = nonBankLedgers.find(l => l.ledgerID === currentBranch.defaultCashLedgerID);
      if (mappedLedger) return mappedLedger.ledgerID;
    }

    // 2. If branch is Head Office / मुख्य शाखा, prioritize main cash ledger
    const isHeadOffice = currentBranch?.branchType === 'HeadOffice' || branchId === 1 || (currentBranch?.branchName && currentBranch.branchName.includes('मुख्य'));
    if (isHeadOffice) {
      const mainCash = nonBankLedgers.find(l => 
        (l.ledgerName.includes('हातातील रोख शिल्लक') || l.ledgerName.includes('हातावरील रोख शिल्लक (मुख्य') || l.ledgerName.includes('हाता. रोख') || l.ledgerName === 'हातावरील रोख शिल्लक' || l.ledgerName === 'रोख खाते' || l.ledgerName.toLowerCase() === 'cash') &&
        (!l.ledgerName.includes('शाखा') || l.ledgerName.includes('मेन') || l.ledgerName.includes('मुख्य'))
      );
      if (mainCash) return mainCash.ledgerID;
    }

    // 3. Match branch name inside ledger name (e.g. 'हातावरील रोख शिल्लक (ढंबावडे शाखा)')
    if (currentBranch?.branchName) {
      const cleanBranchName = currentBranch.branchName.replace(/शाखा/g, '').trim();
      if (cleanBranchName) {
        const branchCash = nonBankLedgers.find(l => 
          isCashLedgerOption(l as any) && 
          l.ledgerName.includes(cleanBranchName)
        );
        if (branchCash) return branchCash.ledgerID;
      }
    }

    // 4. Fallback: First true Cash ledger (strictly excluding Bank ledgers)
    const fallbackCash = nonBankLedgers.find(l => isCashLedgerOption(l as any));
    return fallbackCash?.ledgerID || 0;
  };

  const getDefaultPrimaryLedgerId = (
    mode: 'Cash' | 'Bank' = voucherPaymentMode,
    ledgersList: Ledger[] = ledgers,
    branchId: number = selectedBranchId,
    branchesList: any[] = branches
  ): number => {
    if (mode === 'Bank') {
      const bankList = filterBankLedgers(ledgersList as any);
      return bankList.length === 1 ? bankList[0].ledgerID : 0;
    }
    return getCashLedger(ledgersList, branchId, branchesList);
  };

  const fetchNextVoucherNo = async (type: string, branchId: number = selectedBranchId) => {
    try {
      const res = await fetch(`${API_URL}/next-number?type=${type}&branchId=${branchId}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setVoucherNo(typeof data === 'string' ? data : (data.nextNumber || data.voucherNo || text));
        } catch {
          setVoucherNo(text.trim() || 'AUTO');
        }
      }
    } catch (e) {
      console.error('Failed to get next voucher number', e);
      setVoucherNo('AUTO');
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await fetch(LEDGER_API);
      if (response.ok) {
        const data = await response.json();
        setLedgers(data);
        return data;
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const fetchCustomers = async (branchId: number = selectedBranchId) => {
    try {
      const url = branchId > 0 ? `${CUSTOMER_API}?branchId=${branchId}` : CUSTOMER_API;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavingControlLedgers = async () => {
    try {
      const response = await fetch(`${API_URL}/saving-control-ledgers`);
      if (response.ok) {
        const data = await response.json();
        const rawList = Array.isArray(data?.ledgerIds)
          ? data.ledgerIds
          : (Array.isArray(data?.LedgerIds) ? data.LedgerIds : (Array.isArray(data) ? data : []));
        const ids = rawList
          .map((x: any) => Number(typeof x === 'object' ? (x?.ledgerID ?? x?.LedgerID ?? 0) : x))
          .filter((id: number) => id > 0);
        setSavingControlLedgerIds(ids);
      }
    } catch (err) {
      console.error('Failed to fetch saving control ledgers', err);
    }
  };

  const fetchSavingAccounts = async (branchId: number = selectedBranchId) => {
    try {
      const url = branchId > 0 ? `${SAVING_ACCOUNTS_API}?branchId=${branchId}` : SAVING_ACCOUNTS_API;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSavingAccounts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch saving accounts', err);
    }
  };

  const fetchLoanChargeLedgers = async () => {
    try {
      const response = await fetch(`${API_URL}/loan-charge-ledgers`);
      if (response.ok) {
        const data = await response.json();
        const lIds = Array.isArray(data?.loanLedgerIds) ? data.loanLedgerIds : [];
        setLoanChargeControlLedgerIds(lIds.map((x: any) => Number(x)).filter((id: number) => id > 0));
        setDynamicIncomeLedgers(Array.isArray(data?.incomeLedgers) ? data.incomeLedgers : []);
      }
    } catch (err) {
      console.error('Failed to fetch loan charge ledgers', err);
    }
  };

  const fetchLoanAccountsForCharges = async (branchId: number = selectedBranchId) => {
    try {
      const url = branchId > 0
        ? `/api/LoanAccounts?branchId=${branchId}&status=Active&lightweight=true`
        : `/api/LoanAccounts?status=Active&lightweight=true`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setLoanAccountsForCharges(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch loan accounts for charge link', err);
    }
  };

  const fetchVouchers = async () => {
    try {
      const response = await fetch(`${API_URL}?pageSize=0`);
      if (response.ok) {
        const data = await response.json();
        setVouchers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const initDefaultRowsForType = (
    type: string,
    mode: 'Cash' | 'Bank' = voucherPaymentMode,
    ledgersList: Ledger[] = ledgers,
    branchId: number = selectedBranchId,
    branchesList: any[] = branches
  ) => {
    const primaryLId = getDefaultPrimaryLedgerId(mode, ledgersList, branchId, branchesList);
    const sel = primaryLId > 0 ? ledgersList.find(l => l.ledgerID === primaryLId) : undefined;

    if (type === 'Receipt') {
      setDetails([
        { ledgerID: 0, drCr: 'Cr', amount: 0, searchQuery: '' },
        {
          ledgerID: primaryLId,
          drCr: 'Dr',
          amount: 0,
          isLocked: true,
          searchQuery: sel?.ledgerName || '',
          accountType: sel?.accountType || ''
        }
      ]);
      if (primaryLId > 0) {
        fetchLedgerBalanceAndPath(primaryLId, 1);
      }
    } else if (type === 'Payment') {
      setDetails([
        {
          ledgerID: primaryLId,
          drCr: 'Cr',
          amount: 0,
          isLocked: true,
          searchQuery: sel?.ledgerName || '',
          accountType: sel?.accountType || ''
        },
        { ledgerID: 0, drCr: 'Dr', amount: 0, searchQuery: '' }
      ]);
      if (primaryLId > 0) {
        fetchLedgerBalanceAndPath(primaryLId, 0);
      }
    } else {
      setDetails([
        { ledgerID: 0, drCr: 'Cr', amount: 0, searchQuery: '' },
        { ledgerID: 0, drCr: 'Dr', amount: 0, searchQuery: '' }
      ]);
    }
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBranchId = parseInt(e.target.value);
    setSelectedBranchId(newBranchId);
    fetchNextVoucherNo(voucherType, newBranchId);
    fetchCustomers(newBranchId);
    fetchSavingAccounts(newBranchId);
    fetchLoanAccountsForCharges(newBranchId);

    // शाखा बदलल्यावर मागील शाखेची बचत व कर्ज खाते लिंक काढून टाका (Same-Branch सुरक्षा)
    setDetails(prev =>
      prev.map(d => (d.savingAccountID || d.chargeLoanAccountID
        ? { ...d, savingAccountID: '', savingAccount: null, chargeLoanAccountID: '', chargeExpenseType: '', chargeLoanAccount: null, customerID: '', showCustomerSelect: false }
        : d))
    );

    if ((voucherType === 'Receipt' || voucherType === 'Payment') && voucherPaymentMode === 'Cash') {
      const cashLId = getCashLedger(ledgers, newBranchId, branches);
      const sel = cashLId > 0 ? ledgers.find(l => l.ledgerID === cashLId) : undefined;
      let lockedRowIdx = -1;
      setDetails(prev => {
        return prev.map((d, idx) => {
          if (d.isLocked) {
            lockedRowIdx = idx;
            return {
              ...d,
              ledgerID: cashLId,
              searchQuery: sel?.ledgerName || '',
              accountType: sel?.accountType || '',
              ledgerBalance: undefined,
              ledgerBalanceType: undefined,
              ledgerPath: undefined
            };
          }
          return d;
        });
      });
      if (cashLId > 0 && lockedRowIdx >= 0) {
        fetchLedgerBalanceAndPath(cashLId, lockedRowIdx);
      }
    }
  };

  const handleVoucherPaymentModeChange = (newMode: 'Cash' | 'Bank') => {
    setVoucherPaymentMode(newMode);
    if (voucherType !== 'Receipt' && voucherType !== 'Payment') return;

    const primaryLId = getDefaultPrimaryLedgerId(newMode, ledgers, selectedBranchId, branches);
    const sel = primaryLId > 0 ? ledgers.find(l => l.ledgerID === primaryLId) : undefined;
    let lockedRowIdx = -1;

    setDetails(prev =>
      prev.map((d, idx) => {
        if (!d.isLocked) return d;
        lockedRowIdx = idx;
        return {
          ...d,
          ledgerID: primaryLId,
          searchQuery: sel?.ledgerName || '',
          accountType: sel?.accountType || '',
          ledgerBalance: undefined,
          ledgerBalanceType: undefined,
          ledgerPath: undefined,
        };
      })
    );

    if (primaryLId > 0 && lockedRowIdx >= 0) {
      fetchLedgerBalanceAndPath(primaryLId, lockedRowIdx);
    }
  };

  // पेमेंट / इतर व्हाउचर थेट 'सेव्हिंग खात्यावर वर्ग (Journal)' मध्ये रूपांतरित करणे (पगार / मानधन इ. साठी)
  const handleSwitchToSavingTransferMode = () => {
    if (isStrictlyCashier) {
      alert("कॅशियरसाठी जर्नल / सेव्हिंग वर्ग व्हाउचर तयार करण्याची परवानगी नाही.");
      return;
    }

    const savLId = defaultSavingControlLedgerId;
    const savLedger = savLId > 0 ? ledgers.find(l => l.ledgerID === savLId) : undefined;
    const existingDrRows = details
      .filter(d => !d.isLocked && d.drCr === 'Dr' && d.ledgerID > 0)
      .map(d => ({ ...d, isLocked: false }));

    const drRows: VoucherDetail[] = existingDrRows.length > 0
      ? existingDrRows
      : [{ ledgerID: 0, drCr: 'Dr', amount: 0, searchQuery: '', savingAccountID: '' }];

    const drSum = drRows.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const crSavingRow: VoucherDetail = {
      ledgerID: savLId,
      drCr: 'Cr',
      amount: Number(drSum.toFixed(2)),
      savingAccountID: '',
      customerID: '',
      showCustomerSelect: false,
      isLocked: false,
      searchQuery: savLedger?.ledgerName || '',
      accountType: savLedger?.accountType || 'Savings'
    };

    const nextRows = [...drRows, crSavingRow];
    setVoucherType('Journal');
    setVoucherPaymentMode('Cash');
    fetchNextVoucherNo('Journal', selectedBranchId);
    setDetails(nextRows);

    if (savLId > 0) {
      fetchLedgerBalanceAndPath(savLId, nextRows.length - 1);
    }
  };

  const handleAddSavingTransferRow = () => {
    const savLId = defaultSavingControlLedgerId;
    const savLedger = savLId > 0 ? ledgers.find(l => l.ledgerID === savLId) : undefined;
    const curDr = details.filter(d => d.drCr === 'Dr').reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const curCr = details.filter(d => d.drCr === 'Cr').reduce((s, d) => s + (Number(d.amount) || 0), 0);
    const diff = curDr > curCr ? Number((curDr - curCr).toFixed(2)) : 0;

    const newRowIdx = details.length;
    const newRow: VoucherDetail = {
      ledgerID: savLId,
      drCr: 'Cr',
      amount: diff,
      savingAccountID: '',
      customerID: '',
      showCustomerSelect: false,
      isLocked: false,
      searchQuery: savLedger?.ledgerName || '',
      accountType: savLedger?.accountType || 'Savings'
    };

    setDetails(prev => [...prev, newRow]);
    if (savLId > 0) {
      fetchLedgerBalanceAndPath(savLId, newRowIdx);
    }
  };

  // थकबाकीदार कर्ज वसूली / पोसटेज खर्च थेट कर्जाच्या मुद्दलात (Dr कर्ज / Cr उत्पन्न - Journal) मोड
  const handleSwitchToLoanRecoveryChargeMode = () => {
    if (isStrictlyCashier) {
      alert("कॅशियरसाठी जर्नल / कर्ज खर्च व्हाउचर तयार करण्याची परवानगी नाही.");
      return;
    }

    const defaultLoanLId = loanChargeControlLedgerIds[0] || 0;
    const defaultLoanLedger = defaultLoanLId > 0 ? ledgers.find(l => l.ledgerID === defaultLoanLId) : undefined;
    const preferredIncome =
      dynamicIncomeLedgers.find(l => (l.ledgerName || '').includes('इतर उत्पन्न') || (l.ledgerName || '').toLowerCase().includes('other income')) ||
      dynamicIncomeLedgers[0];
    const defaultIncLId = preferredIncome?.ledgerID || 0;
    const defaultIncLedger = defaultIncLId > 0 ? ledgers.find(l => l.ledgerID === defaultIncLId) : undefined;

    const drLoanRow: VoucherDetail = {
      ledgerID: defaultLoanLId,
      drCr: 'Dr',
      amount: 0,
      chargeLoanAccountID: '',
      chargeExpenseType: 'RECOVERY_EXPENSE',
      chargeLoanAccount: null,
      savingAccountID: '',
      customerID: '',
      showCustomerSelect: false,
      isLocked: false,
      searchQuery: defaultLoanLedger?.ledgerName || '',
      accountType: defaultLoanLedger?.accountType || ''
    };
    const crIncomeRow: VoucherDetail = {
      ledgerID: defaultIncLId,
      drCr: 'Cr',
      amount: 0,
      savingAccountID: '',
      customerID: '',
      showCustomerSelect: false,
      isLocked: false,
      searchQuery: preferredIncome?.ledgerName || defaultIncLedger?.ledgerName || '',
      accountType: defaultIncLedger?.accountType || 'Income'
    };

    setVoucherType('Journal');
    setVoucherPaymentMode('Cash');
    fetchNextVoucherNo('Journal', selectedBranchId);
    setDetails([drLoanRow, crIncomeRow]);
    if (!narration.trim()) {
      setNarration('थकबाकीदार कर्ज वसूली / पोसटेज खर्च कर्जाच्या मुद्दलात नावे');
    }
    if (defaultLoanLId > 0) fetchLedgerBalanceAndPath(defaultLoanLId, 0);
    if (defaultIncLId > 0) fetchLedgerBalanceAndPath(defaultIncLId, 1);
  };

  const handleChargeLoanAccountSelect = (index: number, rawValue: string | number, expenseTypeOverride?: string) => {
    const lAccId = parseInt(String(rawValue), 10) || 0;
    const matchedLoan = lAccId > 0 ? loanAccountsForCharges.find(a => Number(a.loanAccountID) === lAccId) : undefined;

    setDetails(prev => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      const nextExpType = expenseTypeOverride ?? (updated[index].chargeExpenseType || 'RECOVERY_EXPENSE');
      updated[index] = {
        ...updated[index],
        chargeLoanAccountID: lAccId > 0 ? lAccId : '',
        chargeExpenseType: lAccId > 0 ? nextExpType : '',
        chargeLoanAccount: matchedLoan
          ? {
              loanAccountID: matchedLoan.loanAccountID,
              loanAccountNo: matchedLoan.loanAccountNo,
              legacyAccountNumber: matchedLoan.legacyAccountNumber,
            }
          : null,
        customerID: matchedLoan?.customerID || matchedLoan?.customer?.customerID || matchedLoan?.member?.customerID || '',
        showCustomerSelect: false,
      };
      return updated;
    });

    if (matchedLoan) {
      const cust = matchedLoan.customer || matchedLoan.member?.customer;
      const custName = cust ? [cust.firstName, cust.lastName].filter(Boolean).join(' ').trim() : '';
      const curExp = expenseTypeOverride ?? (details[index]?.chargeExpenseType || 'RECOVERY_EXPENSE');
      const expLabel = curExp === 'POSTAGE_EXPENSE' ? 'पोसटेज खर्च' : curExp === 'NOTICE_FEE' ? 'नोटीस फी' : 'वसूली खर्च';
      setNarration(prev => {
        if (!prev.trim() || prev.includes('थकबाकीदार कर्ज वसूली / पोसटेज खर्च')) {
          return `थकबाकीदार ${expLabel} कर्ज खात्यात (${matchedLoan.loanAccountNo}${custName ? ` - ${custName}` : ''}) मुद्दलात नावे`;
        }
        return prev;
      });
    }
  };

  const handleLockedBankLedgerSelect = (index: number, bankLedgerId: number, selectedLedger?: any) => {
    const lId = Number(bankLedgerId) || 0;
    const sel = selectedLedger || (lId > 0 ? ledgers.find(l => l.ledgerID === lId) : undefined);

    setDetails(prev => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        ledgerID: lId,
        searchQuery: sel?.ledgerName || '',
        accountType: sel?.accountType || 'Bank Account',
        ledgerBalance: undefined,
        ledgerBalanceType: undefined,
        ledgerPath: undefined,
      };
      return updated;
    });

    if (lId > 0) {
      fetchLedgerBalanceAndPath(lId, index);
    }
  };

  const handleVoucherTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    if (isStrictlyCashier && newType !== 'Receipt' && newType !== 'Payment') {
      alert("कॅशियर फक्त 'Receipt' (जमा) किंवा 'Payment' (नावे) व्हाउचर तयार करू शकतात. Journal किंवा Contra व्हाउचरची परवानगी नाही.");
      return;
    }
    setVoucherType(newType);
    fetchNextVoucherNo(newType, selectedBranchId);

    setVoucherPaymentMode('Cash');
    initDefaultRowsForType(newType, 'Cash', ledgers, selectedBranchId, branches);
  };

  useEffect(() => {
    if (ledgers.length > 0 && details.length === 0 && editingVoucherId === null) {
      initDefaultRowsForType(voucherType, voucherPaymentMode, ledgers, selectedBranchId, branches);
    }
  }, [ledgers, branches]);

  const handleAddRow = () => {
    let defaultDrCr: 'Dr' | 'Cr' = 'Cr';
    let defaultAmount = 0;
    if (voucherType === 'Receipt') {
      defaultDrCr = 'Cr';
    } else if (voucherType === 'Payment') {
      defaultDrCr = 'Dr';
    } else {
      const curDr = details.filter(d => d.drCr === 'Dr').reduce((s, d) => s + (Number(d.amount) || 0), 0);
      const curCr = details.filter(d => d.drCr === 'Cr').reduce((s, d) => s + (Number(d.amount) || 0), 0);
      if (curCr > curDr) {
        defaultDrCr = 'Dr';
        defaultAmount = Number((curCr - curDr).toFixed(2));
      } else if (curDr > curCr) {
        defaultDrCr = 'Cr';
        defaultAmount = Number((curDr - curCr).toFixed(2));
      }
    }

    const newRow: VoucherDetail = { ledgerID: 0, drCr: defaultDrCr, amount: defaultAmount, searchQuery: '' };
    setDetails(prev => {
      if (voucherType === 'Receipt') {
        const lockedDrIdx = prev.findIndex(d => d.isLocked && d.drCr === 'Dr');
        if (lockedDrIdx !== -1) {
          const next = [...prev];
          next.splice(lockedDrIdx, 0, newRow);
          return next;
        }
      }
      return [...prev, newRow];
    });
  };

  const handleRemoveRow = (index: number) => {
    setDetails(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (voucherType === 'Receipt' || voucherType === 'Payment') {
        const targetDrCr = voucherType === 'Receipt' ? 'Cr' : 'Dr';
        const totalOther = next
          .filter(d => !d.isLocked && d.drCr === targetDrCr)
          .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        return next.map(d => (d.isLocked ? { ...d, amount: totalOther } : d));
      }
      return next;
    });
  };

  const fetchLedgerBalanceAndPath = async (ledgerId: number, index: number) => {
    if (!ledgerId || ledgerId <= 0) return;
    try {
      const [infoSettled, ledgerSettled] = await Promise.allSettled([
        fetch(`/api/Ledgers/${ledgerId}/info`),
        fetch(`/api/Ledgers/${ledgerId}`)
      ]);

      let infoData: any = null;
      if (infoSettled.status === 'fulfilled' && infoSettled.value.ok) {
        infoData = await infoSettled.value.json();
      }

      let ledgerData: any = null;
      if (ledgerSettled.status === 'fulfilled' && ledgerSettled.value.ok) {
        ledgerData = await ledgerSettled.value.json();
      }

      if (!infoData && !ledgerData) return;

      setDetails(prev => {
        if (!prev[index] || prev[index].ledgerID !== ledgerId) {
          return prev;
        }
        const updated = [...prev];
        const current = updated[index];
        updated[index] = {
          ...current,
          ledgerBalance: infoData
            ? Number(infoData.balance ?? infoData.Balance ?? infoData.currentBalance ?? 0)
            : current.ledgerBalance,
          ledgerBalanceType: infoData
            ? (infoData.balanceType ?? infoData.BalanceType ?? '')
            : current.ledgerBalanceType,
          ledgerPath:
            infoData?.path ??
            infoData?.Path ??
            ledgerData?.pathString ??
            current.ledgerPath ??
            '',
          accountType:
            ledgerData?.accountType ??
            ledgerData?.AccountType ??
            current.accountType ??
            ''
        };
        return updated;
      });
    } catch (e) {
      console.error('Error fetching ledger details', e);
    }
  };

  const handleLedgerSelect = (index: number, rawValue: string | number) => {
    const lId = parseInt(String(rawValue), 10) || 0;
    const sel = lId > 0 ? ledgers.find(l => l.ledgerID === lId) : undefined;

    setDetails(prev => {
      if (!prev[index] || prev[index].isLocked) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        ledgerID: lId,
        searchQuery: sel?.ledgerName || '',
        accountType: sel?.accountType || '',
        customerID: '',
        savingAccountID: '',
        savingAccount: null,
        chargeLoanAccountID: '',
        chargeExpenseType: '',
        chargeLoanAccount: null,
        showCustomerSelect: false,
        ledgerBalance: undefined,
        ledgerBalanceType: undefined,
        ledgerPath: undefined
      };
      return updated;
    });

    if (lId > 0) {
      fetchLedgerBalanceAndPath(lId, index);
    }
  };

  const handleSavingAccountSelect = (index: number, rawValue: string | number) => {
    const savId = parseInt(String(rawValue), 10) || 0;
    const matched = savId > 0 ? savingAccounts.find(a => a.savingAccountID === savId) : undefined;

    setDetails(prev => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        savingAccountID: savId > 0 ? savId : '',
        savingAccount: matched
          ? {
              savingAccountID: matched.savingAccountID,
              accountNo: matched.formattedAccountNo || matched.accountNo,
              oldAccountNo: matched.oldAccountNo,
              previousAccountNo: matched.previousAccountNo,
              legacyAccountNumber: matched.legacyAccountNumber,
              customerID: matched.customerID
            }
          : null,
        customerID: matched?.customerID ? matched.customerID : '',
        showCustomerSelect: false
      };
      return updated;
    });
  };

  const buildSavingAccountOptions = (detail: VoucherDetail) => {
    const selectedId = Number(detail.savingAccountID || 0);
    const filtered = savingAccounts.filter(acc => {
      if (acc.savingAccountID === selectedId) return true;
      const statusLower = (acc.status || '').toLowerCase();
      if (statusLower === 'closed' || statusLower === 'frozen') return false;
      if (detail.ledgerID > 0 && acc.ledgerID > 0 && acc.ledgerID !== detail.ledgerID) return false;
      return true;
    });

    const opts = filtered.map(acc => {
      const accNo = (acc.formattedAccountNo || acc.accountNo || '').toString().trim();
      const oldNo = (acc.oldAccountNo || acc.previousAccountNo || acc.legacyAccountNumber || '').toString().trim();
      const oldPart = oldNo ? ` [जुना: ${oldNo}]` : '';
      const statusLower = (acc.status || '').toLowerCase();
      const statusText = statusLower === 'dormant' ? 'निष्क्रिय' : 'सक्रिय';
      return {
        value: acc.savingAccountID.toString(),
        label: `${accNo}${oldPart} - ${acc.customerName || 'खातेदार'}`,
        subLabel: `${oldNo ? `🏷️ जुना बचत नं.: ${oldNo} | ` : ''}${acc.cifNo ? `CIF: ${acc.cifNo} | ` : ''}शिल्लक: ₹${Number(acc.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} | उपलब्ध: ₹${Number(acc.availableBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}${acc.schemeName ? ` | ${acc.schemeName}` : ''}`,
        badge: oldNo ? `${statusText} • जुना: ${oldNo}` : (statusLower === 'dormant' ? 'निष्क्रिय (Dormant)' : 'सक्रिय'),
        badgeColor: statusLower === 'dormant'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : (oldNo ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
      };
    });

    if (selectedId > 0 && !opts.some(o => Number(o.value) === selectedId)) {
      const fallbackNo = detail.savingAccount?.formattedAccountNo || detail.savingAccount?.accountNo || `#${selectedId}`;
      const fallbackOld = (detail.savingAccount?.oldAccountNo || detail.savingAccount?.previousAccountNo || detail.savingAccount?.legacyAccountNumber || '').toString().trim();
      opts.unshift({
        value: selectedId.toString(),
        label: `${fallbackNo}${fallbackOld ? ` [जुना: ${fallbackOld}]` : ''} (संलग्न बचत खाते)`,
        subLabel: `${fallbackOld ? `🏷️ जुना बचत नं.: ${fallbackOld} | ` : ''}खाते आयडी: #${selectedId}`,
        badge: fallbackOld ? `सक्रिय • जुना: ${fallbackOld}` : 'सक्रिय',
        badgeColor: fallbackOld ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      });
    }

    return opts;
  };

  const handleDetailChange = (index: number, field: keyof VoucherDetail, value: any) => {
    if (field === 'ledgerID') {
      handleLedgerSelect(index, value);
      return;
    }

    setDetails(prev => {
      if (!prev[index]) return prev;
      const isEditingLocked = prev[index].isLocked;
      if (isEditingLocked && field !== 'amount') return prev;

      const newDetails = [...prev];
      const nextValue = field === 'amount' ? (parseFloat(value) || 0) : value;
      newDetails[index] = { ...newDetails[index], [field]: nextValue };

      if (field === 'amount' || field === 'drCr') {
        if (voucherType === 'Receipt') {
          const totalOther = newDetails
            .filter(d => !d.isLocked && d.drCr === 'Cr')
            .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
          const lockedIndex = newDetails.findIndex(d => d.isLocked);
          if (lockedIndex !== -1) {
            newDetails[lockedIndex] = { ...newDetails[lockedIndex], amount: totalOther };
          }
        } else if (voucherType === 'Payment') {
          const totalOther = newDetails
            .filter(d => !d.isLocked && d.drCr === 'Dr')
            .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
          const lockedIndex = newDetails.findIndex(d => d.isLocked);
          if (lockedIndex !== -1) {
            newDetails[lockedIndex] = { ...newDetails[lockedIndex], amount: totalOther };
          }
        }
      }

      return newDetails;
    });
  };

  const totalDr = details.filter(d => d.drCr === 'Dr').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalCr = details.filter(d => d.drCr === 'Cr').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (details.length === 0) {
      alert("कृपया किमान एक व्हाउचर ओळ जोडा.");
      return;
    }

    if ((voucherType === 'Receipt' || voucherType === 'Payment') && voucherPaymentMode === 'Bank') {
      const lockedRow = details.find(d => d.isLocked);
      const selectedBankLedger = lockedRow?.ledgerID ? ledgers.find(l => l.ledgerID === lockedRow.ledgerID) : undefined;
      if (!lockedRow || !lockedRow.ledgerID || !isBankAccountLedger(selectedBankLedger as any)) {
        alert("बँक रिसिप्ट / पेमेंट व्हाउचरसाठी कृपया वैध बँक जी.एल. खाते (Bank GL Account) निवडा.");
        return;
      }
    }

    const hasZeroLedger = details.some(d => !d.ledgerID);
    if (hasZeroLedger) {
      alert("कृपया सर्व ओळींसाठी खाते (Ledger) निवडा.");
      return;
    }

    const hasZeroAmount = details.some(d => !d.amount || d.amount <= 0);
    if (hasZeroAmount) {
      alert("कृपया सर्व ओळींसाठी वैध रक्कम प्रविष्ट करा.");
      return;
    }

    if (Math.abs(totalDr - totalCr) > 0.01) {
      alert(`Dr आणि Cr रकमा जुळत नाहीत! (Dr: ${totalDr.toFixed(2)}, Cr: ${totalCr.toFixed(2)})`);
      return;
    }

    // Strict Voucher Type Ledger Rule Validations
    if (voucherType === 'Journal') {
      const invalidJournalRow = details.find(d => {
        const l = ledgers.find(item => item.ledgerID === d.ledgerID);
        return l && isCashLedgerOption(l as any);
      });
      if (invalidJournalRow) {
        const lName = ledgers.find(item => item.ledgerID === invalidJournalRow.ledgerID)?.ledgerName || '';
        alert(`जर्नल (Journal) व्हाउचरमध्ये 'रोख (Cash)' खाते (${lName}) वापरता येत नाही. रोख व्यवहारासाठी कृपया रिसिप्ट (रोख जमा) किंवा पेमेंट (रोख नावे) व्हाउचर वापरा.`);
        return;
      }
    } else if (voucherType === 'Receipt' || voucherType === 'Payment') {
      const invalidCounterRow = details.find(d => {
        if (d.isLocked) return false;
        const l = ledgers.find(item => item.ledgerID === d.ledgerID);
        return l && isCashLedgerOption(l as any);
      });
      if (invalidCounterRow) {
        const lName = ledgers.find(item => item.ledgerID === invalidCounterRow.ledgerID)?.ledgerName || '';
        alert(`रिसिप्ट / पेमेंट व्हाउचरमध्ये समोरच्या ओळीवर पुन्हा रोख खाते ('${lName}') निवडता येत नाही.`);
        return;
      }
    }

    // Validate mandatory Saving Account selection for Saving Control Ledgers (e.g. 46 - सेव्हिंग ठेव)
    const missingSavingRow = details.find(d => isSavingControlLedger(d.ledgerID) && !Number(d.savingAccountID || 0));
    if (missingSavingRow) {
      const lName = ledgers.find(item => item.ledgerID === missingSavingRow.ledgerID)?.ledgerName || 'सेव्हिंग ठेव';
      alert(`बचत खाते निवडा: '${lName}' या बचत खात्यासाठी संबंधित सभासद / कर्मचाऱ्याचे बचत खाते (Saving Account) निवडणे आवश्यक आहे.`);
      return;
    }

    const crossBranchSavingRow = details.find(d => {
      const savId = Number(d.savingAccountID || 0);
      if (savId <= 0) return false;
      const matched = savingAccounts.find(a => a.savingAccountID === savId);
      return matched && matched.branchID !== selectedBranchId;
    });
    if (crossBranchSavingRow) {
      alert("निवडलेले बचत खाते सध्याच्या शाखेतील (Same Branch) नाही. कृपया त्याच शाखेचे बचत खाते निवडा.");
      return;
    }

    const crossBranchLoanChargeRow = details.find(d => {
      const lAccId = Number(d.chargeLoanAccountID || 0);
      if (lAccId <= 0) return false;
      if (d.drCr !== 'Dr') return true;
      const matched = loanAccountsForCharges.find(a => Number(a.loanAccountID) === lAccId);
      return matched && matched.branchID && Number(matched.branchID) !== Number(selectedBranchId);
    });
    if (crossBranchLoanChargeRow) {
      alert(crossBranchLoanChargeRow.drCr !== 'Dr'
        ? "कर्जाच्या मुद्दलात वसूली/पोसटेज खर्च जोडताना कर्ज खात्याची ओळ 'Dr' (नावे) असणे आवश्यक आहे."
        : "निवडलेले कर्ज खाते सध्याच्या शाखेतील (Same Branch) नाही.");
      return;
    }

    // Prevent debiting and crediting the exact same ledger (with same customer/saving/loan-charge sub-ledger) in one voucher
    const drKeys = new Set(details.filter(d => d.drCr === 'Dr').map(d => `${d.ledgerID}_${d.customerID || 0}_${d.savingAccountID || 0}_${d.chargeLoanAccountID || 0}`));
    const duplicateCr = details.find(d => d.drCr === 'Cr' && drKeys.has(`${d.ledgerID}_${d.customerID || 0}_${d.savingAccountID || 0}_${d.chargeLoanAccountID || 0}`));
    if (duplicateCr) {
      const lName = ledgers.find(item => item.ledgerID === duplicateCr.ledgerID)?.ledgerName || '';
      alert(`एकाच व्हाउचरमध्ये एकाच खात्याला ('${lName}') एकाच वेळी नावे (Dr) आणि जमा (Cr) करता येत नाही.`);
      return;
    }

    const payload = {
      voucherNo: voucherNo && voucherNo.trim() ? voucherNo.trim() : 'AUTO',
      voucherDate,
      voucherType,
      narration: narration || '',
      branchID: selectedBranchId,
      totalAmount: Number(totalDr.toFixed(2)),
      createdBy: user?.userID || 1,
      voucherDetails: details.map(d => ({
        ledgerID: d.ledgerID,
        drCr: d.drCr,
        amount: d.amount,
        customerID: d.customerID ? Number(d.customerID) : null,
        savingAccountID: d.savingAccountID ? Number(d.savingAccountID) : null,
        chargeLoanAccountID: d.chargeLoanAccountID ? Number(d.chargeLoanAccountID) : null,
        chargeExpenseType: d.chargeLoanAccountID ? (d.chargeExpenseType || 'RECOVERY_EXPENSE') : null,
        memberID: null
      }))
    };

    try {
      let response;
      if (editingVoucherId !== null) {
        response = await fetch(`${API_URL}/${editingVoucherId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, voucherID: editingVoucherId })
        });
      } else {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const resData = await response.json().catch(() => null);

      if (response.ok) {
        alert(editingVoucherId ? "व्हाउचर यशस्वीरित्या अपडेट झाले!" : "व्हाउचर यशस्वीरित्या सेव्ह झाले!");
        cancelEdit();
        fetchVouchers();
      } else {
        alert(resData?.message || resData || "व्हाउचर सेव्ह करण्यात त्रुटी आली.");
      }
    } catch (err) {
      console.error(err);
      alert("सर्व्हरशी संपर्क होऊ शकला नाही.");
    }
  };

  const handleEdit = (v: Voucher) => {
    setEditingVoucherId(v.voucherID);
    setVoucherNo(v.voucherNo);
    setVoucherDate(v.voucherDate.split('T')[0]);
    setVoucherType(v.voucherType);
    setNarration(v.narration || '');
    if ((v as any).branchID) {
      setSelectedBranchId((v as any).branchID);
      if ((v as any).branchID !== selectedBranchId) {
        fetchCustomers((v as any).branchID);
        fetchSavingAccounts((v as any).branchID);
      }
    }

    const cashLId = getCashLedger(ledgers, (v as any).branchID || selectedBranchId, branches);
    const primarySide = v.voucherType === 'Receipt' ? 'Dr' : v.voucherType === 'Payment' ? 'Cr' : null;
    const rawVds = [...(v.voucherDetails || [])].sort((a, b) =>
      a.drCr === 'Cr' && b.drCr !== 'Cr' ? -1 : a.drCr !== 'Cr' && b.drCr === 'Cr' ? 1 : 0
    );
    const firstCashPrimaryIdx = primarySide
      ? rawVds.findIndex(vd => vd.drCr === primarySide && vd.ledgerID === cashLId)
      : -1;
    let firstBankPrimaryIdx = -1;
    if (primarySide && firstCashPrimaryIdx === -1) {
      firstBankPrimaryIdx = rawVds.findIndex(vd => {
        if (vd.drCr !== primarySide) return false;
        const mLedger = vd.ledger || ledgers.find(l => l.ledgerID === vd.ledgerID);
        return isBankAccountLedger(mLedger as any);
      });
    }
    setVoucherPaymentMode(firstBankPrimaryIdx >= 0 ? 'Bank' : 'Cash');

    const loadedDetails: VoucherDetail[] = rawVds.map((vd, idx) => {
      const isAutoCashRow = idx === firstCashPrimaryIdx;
      const isAutoBankRow = idx === firstBankPrimaryIdx;
      const matchedLedger = vd.ledger || ledgers.find(l => l.ledgerID === vd.ledgerID);
      const resolvedSavId = vd.savingAccountID ?? (vd as any).SavingAccountID ?? vd.savingAccount?.savingAccountID ?? '';
      const resolvedCustId = vd.customerID || vd.customer?.customerID || vd.savingAccount?.customerID || vd.member?.customerID || vd.member?.customer?.customerID || '';
      return {
        ledgerID: vd.ledgerID,
        drCr: vd.drCr as 'Dr' | 'Cr',
        amount: vd.amount,
        customerID: resolvedCustId,
        savingAccountID: resolvedSavId,
        savingAccount: vd.savingAccount || null,
        chargeLoanAccountID: vd.chargeLoanAccountID ?? (vd as any).ChargeLoanAccountID ?? '',
        chargeExpenseType: vd.chargeExpenseType ?? (vd as any).ChargeExpenseType ?? '',
        chargeLoanAccount: vd.chargeLoanAccount || (vd as any).ChargeLoanAccount || null,
        showCustomerSelect: Boolean(resolvedCustId) && !resolvedSavId && !(vd.chargeLoanAccountID ?? (vd as any).ChargeLoanAccountID),
        isLocked: isAutoCashRow || isAutoBankRow,
        searchQuery: matchedLedger?.ledgerName || '',
        accountType: matchedLedger?.accountType || ''
      };
    });

    setDetails(loadedDetails);

    loadedDetails.forEach((d, idx) => {
      if (d.ledgerID) {
        fetchLedgerBalanceAndPath(d.ledgerID, idx);
      }
    });

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelEdit = () => {
    setEditingVoucherId(null);
    setNarration('');
    setVoucherPaymentMode('Cash');
    fetchNextVoucherNo(voucherType, selectedBranchId);
    initDefaultRowsForType(voucherType, 'Cash', ledgers, selectedBranchId, branches);
  };

  const handleDelete = async (id: number) => {
    const rawReason = window.prompt("व्हाउचर कायमस्वरूपी डिलीट (Hard Delete) करण्याचे कारण नमूद करा (किमान १० अक्षरे):");
    if (rawReason === null) return;
    const cleanReason = rawReason.trim();
    if (cleanReason.length < 10) {
      alert("ऑडिट नियमांनुसार व्हाउचर डिलीट करण्याचे किमान १० अक्षरांचे स्पष्ट कारण देणे आवश्यक आहे.");
      return;
    }
    if (!window.confirm("तुम्हाला खात्री आहे का की हे व्हाउचर आणि संलग्न व्यवहार कायमस्वरूपी डिलीट करायचे आहेत?")) return;

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {})
        },
        body: JSON.stringify({ reason: cleanReason })
      });

      const resData = await response.json().catch(() => null);

      if (response.ok) {
        alert(resData?.message || "व्हाउचर यशस्वीरित्या डिलीट झाले!");
        fetchVouchers();
      } else {
        alert(resData?.message || resData || "व्हाउचर डिलीट करण्यात त्रुटी आली.");
      }
    } catch (err) {
      console.error(err);
      alert("सर्व्हरशी संपर्क होऊ शकला नाही.");
    }
  };

  const toggleVoucher = (id: number) => {
    if (expandedVoucherId === id) setExpandedVoucherId(null);
    else setExpandedVoucherId(id);
  };

  const filteredVouchers = vouchers.filter(v => {
    const matchesType = listTypeFilter === 'All' || v.voucherType === listTypeFilter;
    const q = listSearchQuery.trim().toLowerCase();
    if (!q) return matchesType;

    const dateStr = new Date(v.voucherDate).toLocaleDateString('en-GB');
    const branchName = (v as any).branch?.branchName || '';
    const matchNo = (v.voucherNo || '').toLowerCase().includes(q);
    const matchType = (v.voucherType || '').toLowerCase().includes(q);
    const matchNarration = (v.narration || '').toLowerCase().includes(q);
    const matchAmount = (v.totalAmount || 0).toString().includes(q);
    const matchDate = dateStr.includes(q);
    const matchBranch = branchName.toLowerCase().includes(q);

    const matchLedger = v.voucherDetails?.some(vd => {
      const cust = vd.customer || vd.member?.customer;
      const custStr = cust
        ? `${cust.cifNo || ''} ${cust.legacyCustomerNo || ''} ${cust.firstName || ''} ${cust.middleName || ''} ${cust.lastName || ''}`.toLowerCase()
        : '';
      const savStr = vd.savingAccount
        ? `${vd.savingAccount.accountNo || ''} ${vd.savingAccount.oldAccountNo || ''} ${vd.savingAccount.previousAccountNo || ''} ${vd.savingAccount.legacyAccountNumber || ''}`.toLowerCase()
        : '';
      return (vd.ledger?.ledgerName || '').toLowerCase().includes(q) || custStr.includes(q) || savStr.includes(q);
    });

    return matchesType && (matchNo || matchType || matchNarration || matchAmount || matchDate || matchBranch || matchLedger);
  });

  const totalVoucherPages = listPageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredVouchers.length / listPageSize));
  const safeVoucherPage = Math.min(listPage, totalVoucherPages);
  const paginatedVouchers = listPageSize === 0
    ? filteredVouchers
    : filteredVouchers.slice((safeVoucherPage - 1) * listPageSize, safeVoucherPage * listPageSize);

  if (printingVoucherId) {
    return <VoucherPrint voucherId={printingVoucherId} onBack={() => setPrintingVoucherId(null)} />;
  }

  const todayStr = user?.businessDate || new Date().toISOString().split('T')[0];
  const receiptCount = vouchers.filter(v => v.voucherType === 'Receipt').length;
  const paymentCount = vouchers.filter(v => v.voucherType === 'Payment').length;
  const todayCount = vouchers.filter(v => (v.voucherDate || '').startsWith(todayStr)).length;

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans pb-8">
      
      {/* 🌟 1. TOP SLEEK CBS HEADER BANNER */}
      {isPassingMode ? (
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-900 text-white px-3.5 py-2.5 rounded-sm shadow-md border border-amber-500 mb-3 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/20 rounded shadow-xs">
              <CheckCircle2 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-wide flex items-center gap-2">
                <span>🔒 व्हाउचर तपासणी व पासिंग मोड (Checker Passing Mode)</span>
                <span className="bg-amber-950 px-2 py-0.5 rounded text-[10px] font-mono border border-amber-300 font-bold">
                  {passingVoucher?.voucherNo || voucherNo}
                </span>
              </h2>
              <p className="text-[10.5px] text-amber-100 font-normal">
                कोअर बँकिंग नियंत्रण: ही नोंद केवळ तपासणी व मंजुरीसाठी उघडली आहे. यात बदल किंवा डिलीट करता येणार नाही.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs font-bold border border-white/30 transition-all flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>पासिंग यादीवर परत जा (Back)</span>
          </button>
        </div>
      ) : (
        <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
              <Receipt size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <span>व्हाउचर एंट्री मास्टर</span>
                <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Voucher & Journal Entry Master)</span>
                {editingVoucherId !== null && (
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                    ✏️ संपादन चालू (#{editingVoucherId})
                  </span>
                )}
              </h1>
              <p className="text-[11px] text-gray-500 font-medium">
                रिसिप्ट (Receipt), पेमेंट (Payment), जर्नल (Journal) व कॉन्ट्रा (Contra) रोजकीर्द नोंदी व खतावणी
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2">
            {editingVoucherId !== null && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                title="संपादन रद्द करा"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>रद्द करा</span>
              </button>
            )}

            <button
              type="button"
              onClick={cancelEdit}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="नवीन नोंद (Reset)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>नवीन व्हाउचर</span>
            </button>

            <button
              type="button"
              onClick={() => setIsListModalOpen(true)}
              className="px-2.5 py-1 bg-primary hover:opacity-90 text-white rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="नोंदणीकृत व्हाउचर्स यादी पहा"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>📋 व्हाउचर्स यादी ({vouchers.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 📊 2. SUMMARY KPI CARDS */}
      {!isPassingMode && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण व्हाउचर्स</div>
              <div className="text-sm font-black text-gray-900">{vouchers.length}</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">रिसिप्ट नोंदी (Receipts)</div>
              <div className="text-sm font-black text-emerald-800">{receiptCount}</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">पेमेंट नोंदी (Payments)</div>
              <div className="text-sm font-black text-rose-800">{paymentCount}</div>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">आजच्या नोंदी (Today)</div>
              <div className="text-sm font-black text-amber-800">{todayCount}</div>
            </div>
          </div>
        </div>
      )}

      {/* 📝 3. MAIN VOUCHER FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 rounded-sm shadow-xs border transition-all duration-300 mb-3 ${
          editingVoucherId !== null ? 'border-primary ring-2 ring-primary/20 bg-amber-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* SECTION 1: व्हाउचर मूलभूत माहिती */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">
                  {editingVoucherId ? `१. व्हाउचर संपादन चालू (Voucher ID: #${editingVoucherId})` : "१. व्हाउचर मूलभूत माहिती (Voucher Header & Type)"}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                <select 
                  value={selectedBranchId} 
                  onChange={handleBranchChange} 
                  disabled={isPassingMode || editingVoucherId !== null || !isHOUser}
                  className={`${inputClass} font-bold disabled:bg-slate-100 disabled:text-slate-500`}
                >
                  {(isHOUser ? branches : branches.filter(b => Number(b.branchID) === (user?.branchID || selectedBranchId))).map(b => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>व्हाउचरचा प्रकार (Voucher Type) <span className="text-red-500">*</span></label>
                <select 
                  value={voucherType} 
                  onChange={handleVoucherTypeChange} 
                  disabled={isPassingMode || editingVoucherId !== null}
                  className={`${inputClass} font-bold disabled:bg-slate-100 disabled:text-slate-500`}
                >
                  <option value="Receipt">📥 रिसिप्ट (Receipt - रोख जमा)</option>
                  <option value="Payment">📤 पेमेंट (Payment - रोख नावे)</option>
                  <option value="Journal" disabled={isStrictlyCashier && !isPassingMode && editingVoucherId === null}>
                    🔄 जर्नल (Journal - ट्रान्सफर नोंद){isStrictlyCashier ? ' [कॅशियरसाठी बंद]' : ''}
                  </option>
                  <option value="Contra" disabled={isStrictlyCashier && !isPassingMode && editingVoucherId === null}>
                    🏦 कॉन्ट्रा (Contra){isStrictlyCashier ? ' [कॅशियरसाठी बंद]' : ''}
                  </option>
                </select>
              </div>

              <div>
                <label className={labelClass}>व्हाउचर तारीख (Voucher Date) <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  value={voucherDate} 
                  readOnly={true}
                  disabled={true}
                  required
                  className={`${inputClass} bg-slate-100 font-mono font-bold text-slate-800 cursor-not-allowed select-none`} 
                />
              </div>

              <div>
                <label className={labelClass}>व्हाउचर नंबर (Voucher No)</label>
                <input 
                  type="text" 
                  value={voucherNo === 'AUTO' ? 'लोड होत आहे...' : voucherNo} 
                  readOnly
                  className={`${inputClass} bg-slate-100 font-bold font-mono text-primary cursor-not-allowed`} 
                />
              </div>
            </div>

            {(voucherType === 'Receipt' || voucherType === 'Payment') && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-700 mr-1">व्यवहार माध्यम (Mode):</span>
                  <button
                    type="button"
                    disabled={isPassingMode}
                    onClick={() => handleVoucherPaymentModeChange('Cash')}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-bold border transition-all cursor-pointer ${
                      voucherPaymentMode === 'Cash'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    💵 रोख (Cash)
                  </button>
                  <button
                    type="button"
                    disabled={isPassingMode}
                    onClick={() => handleVoucherPaymentModeChange('Bank')}
                    className={`px-2.5 py-1 rounded-sm text-[11px] font-bold border transition-all cursor-pointer ${
                      voucherPaymentMode === 'Bank'
                        ? 'bg-[#B44814] text-white border-[#7C2418] shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    🏦 बँक (Bank)
                  </button>
                  {!isPassingMode && editingVoucherId === null && voucherType === 'Payment' && !isStrictlyCashier && (
                    <button
                      type="button"
                      onClick={handleSwitchToSavingTransferMode}
                      className="px-2.5 py-1 rounded-sm text-[11px] font-bold border bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-300 transition-all cursor-pointer shadow-2xs"
                      title="नोकर पगार, वसूली अधिकारी मानधन किंवा इतर खर्च थेट सेव्हिंग खात्यावर वर्ग करण्यासाठी जर्नल व्हाउचर तयार करा"
                    >
                      💳 सेव्हिंग खात्यावर वर्ग (Saving Transfer)
                    </button>
                  )}
                  {!isPassingMode && editingVoucherId === null && !isStrictlyCashier && (
                    <button
                      type="button"
                      onClick={handleSwitchToLoanRecoveryChargeMode}
                      className="px-2.5 py-1 rounded-sm text-[11px] font-bold border bg-amber-50 hover:bg-amber-100 text-[#5A1A14] border-amber-300 transition-all cursor-pointer shadow-2xs"
                      title="थकबाकीदार कर्जाचे वसूली खर्च किंवा पोसटेज खर्च थेट कर्जाच्या मुद्दलात (Dr कर्ज / Cr उत्पन्न - Journal) जोडण्यासाठी तयार करा"
                    >
                      🏷️ कर्जात वसूली/पोसटेज खर्च
                    </button>
                  )}
                </div>
                {voucherType === 'Payment' && !isPassingMode && !isStrictlyCashier && (
                  <span className="text-[10.5px] text-slate-500">
                    टीप: पगार / मानधन सेव्हिंग खात्यावर वर्ग करण्यासाठी <strong>सेव्हिंग खात्यावर वर्ग</strong> निवडा किंवा <strong>Journal</strong> व्हाउचर वापरा.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* SECTION 2: व्हाउचर खतावणी तपशील */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">२. व्हाउचर खतावणी तपशील (Account Ledgers & Amount Allocation)</h2>
              </div>

              {!isPassingMode && (
                <div className="flex items-center gap-1.5">
                  {voucherType === 'Journal' && !isStrictlyCashier && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={handleSwitchToLoanRecoveryChargeMode}
                      className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-[#5A1A14] border border-amber-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                      title="थकबाकीदार कर्ज वसूली/पोसटेज खर्च (Dr कर्ज / Cr उत्पन्न)"
                    >
                      <span>🏷️ कर्जात वसूली/पोसटेज खर्च</span>
                    </button>
                  )}
                  {voucherType === 'Journal' && defaultSavingControlLedgerId > 0 && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={handleAddSavingTransferRow}
                      className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                      title="अजून एका कर्मचाऱ्याच्या / वसूली अधिकाऱ्याच्या बचत खात्यात वर्ग ओळ जोडा"
                    >
                      <span>💳 + बचत वर्ग ओळ (Add Saving Cr)</span>
                    </button>
                  )}
                  <button 
                    type="button" 
                    tabIndex={-1}
                    onClick={handleAddRow} 
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>ओळ जोडा (Add Row)</span>
                  </button>
                </div>
              )}
            </div>

            {voucherType === 'Journal' && !isPassingMode && (
              <div className="px-2.5 py-1.5 bg-teal-50/70 border border-teal-200 rounded-sm text-[11px] text-teal-950 flex items-center gap-2">
                <span>💡</span>
                <span>
                  <strong>पगार / मानधन / सेव्हिंग वर्ग मार्गदर्शन:</strong> खर्चाचे खाते (उदा. <em>नोकर पगार</em> किंवा <em>कर्मचारी मानधन</em>) <strong>Dr</strong> निवडा आणि समोर <strong>सेव्हिंग ठेव (Cr)</strong> निवडून संबंधित कर्मचाऱ्याचे / अधिकाऱ्याचे बचत खाते निवडा. एकाच व्हाउचरमध्ये अनेक कर्मचाऱ्यांच्या खात्यात भाग-वार वर्ग करता येतो.
                </span>
              </div>
            )}

            <div className="overflow-x-auto border border-gray-200 rounded-sm max-h-[420px] shadow-2xs">
              <table className="min-w-full divide-y divide-gray-200 text-[11px] text-center border-collapse leading-tight">
                <thead className="bg-[#5A1A14] text-amber-50 font-bold sticky top-0 z-10 shadow-xs border-b border-amber-400/30">
                  <tr>
                    <th className="px-2 py-1.5 border-r border-amber-400/25 text-center w-16 whitespace-nowrap">Cr / Dr</th>
                    <th className="px-2 py-1.5 border-r border-amber-400/25 text-left whitespace-nowrap">खाते (Ledger Name & Code)</th>
                    <th className="px-2 py-1.5 border-r border-amber-400/25 text-right w-36 whitespace-nowrap">रक्कम (Amount ₹)</th>
                    <th className="px-2 py-1.5 text-center w-16 whitespace-nowrap">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 bg-white">
                  {details.map((detail, index) => (
                    <tr key={index} className="hover:bg-amber-50/50 transition-colors">
                      <td className="px-2 py-1 border-r border-gray-200 text-center align-middle">
                        <select 
                          value={detail.drCr} 
                          onChange={e => handleDetailChange(index, 'drCr', e.target.value)} 
                          disabled={isPassingMode || detail.isLocked || voucherType === 'Payment' || voucherType === 'Receipt'}
                          className="w-full text-center border border-gray-300 rounded-sm px-1 py-1 text-[11px] bg-white disabled:bg-slate-100 disabled:text-slate-500 font-bold cursor-pointer h-[28px]"
                        >
                          <option value="Cr">Cr</option>
                          <option value="Dr">Dr</option>
                        </select>
                      </td>

                      <td className="px-2 py-1 border-r border-gray-200 text-left min-w-[280px] align-middle">
                        {detail.isLocked && (voucherType === 'Receipt' || voucherType === 'Payment') && voucherPaymentMode === 'Bank' ? (
                          <BankLedgerSelect
                            label=""
                            required={false}
                            ledgers={ledgers as any}
                            value={detail.ledgerID}
                            disabled={isPassingMode}
                            onChange={(bankLId, selectedLedger) => handleLockedBankLedgerSelect(index, bankLId, selectedLedger)}
                            placeholder="-- बँक जी.एल. खाते निवडा (Select Bank GL Account) --"
                            className="w-full border border-amber-400 px-2 py-1 rounded-sm text-[11px] bg-amber-50/40 font-bold text-slate-800 focus:outline-none focus:border-primary h-[28px]"
                          />
                        ) : (
                          <SearchableSelect
                            id={`voucher-ledger-${index}`}
                            disabled={isPassingMode || detail.isLocked}
                            value={detail.ledgerID ? detail.ledgerID.toString() : ''}
                            onChange={(e) => handleLedgerSelect(index, e.target.value)}
                            options={getRowLedgerOptions(detail)}
                            placeholder="-- खाते नाव किंवा नंबर शोधा (Search Ledger) --"
                            className={isPassingMode || detail.isLocked 
                              ? "w-full border border-gray-300 px-2 py-1 rounded-sm text-[11px] bg-slate-100 font-bold text-gray-700 cursor-not-allowed flex justify-between items-center h-[28px]"
                              : "w-full border border-gray-300 px-2 py-1 rounded-sm text-[11px] bg-white flex justify-between items-center hover:border-primary cursor-pointer focus-within:border-primary focus-within:ring-1 focus-within:ring-primary h-[28px]"
                            }
                          />
                        )}

                        {detail.ledgerID > 0 && (
                          detail.ledgerPath ||
                          detail.ledgerBalance !== undefined ||
                          (!isPassingMode && !detail.isLocked && !isSavingControlLedger(detail.ledgerID) && !detail.showCustomerSelect && !detail.customerID && detail.accountType !== 'Cash In Hand')
                        ) && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            {detail.ledgerPath && (
                              <p className="text-[10px] text-gray-500 truncate" title={detail.ledgerPath}>
                                📍 {detail.ledgerPath}
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              {detail.ledgerBalance !== undefined ? (
                                <p className="text-[10.5px] font-bold text-[#9A3412]">
                                  शिल्लक (Balance): ₹{Number(detail.ledgerBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} {detail.ledgerBalanceType || ''}
                                </p>
                              ) : <span />}
                              {!isPassingMode && !detail.isLocked && !isSavingControlLedger(detail.ledgerID) && !detail.showCustomerSelect && !detail.customerID && detail.accountType !== 'Cash In Hand' && (
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  onClick={() => handleDetailChange(index, 'showCustomerSelect', true)}
                                  className="text-[10.5px] font-bold text-primary hover:text-[#003657] underline cursor-pointer shrink-0"
                                >
                                  + खातेदार जोडा
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {detail.ledgerID > 0 && !detail.isLocked && isSavingControlLedger(detail.ledgerID) && (() => {
                          const selectedSavAcc = detail.savingAccountID
                            ? savingAccounts.find(a => a.savingAccountID === Number(detail.savingAccountID))
                            : undefined;
                          const displaySavAccNo = (
                            selectedSavAcc?.formattedAccountNo ||
                            selectedSavAcc?.accountNo ||
                            detail.savingAccount?.formattedAccountNo ||
                            detail.savingAccount?.accountNo ||
                            ''
                          ).toString().trim();
                          const displaySavOldNo = (
                            selectedSavAcc?.oldAccountNo ||
                            selectedSavAcc?.previousAccountNo ||
                            selectedSavAcc?.legacyAccountNumber ||
                            detail.savingAccount?.oldAccountNo ||
                            detail.savingAccount?.previousAccountNo ||
                            detail.savingAccount?.legacyAccountNumber ||
                            ''
                          ).toString().trim();
                          const isLowBal = Boolean(
                            selectedSavAcc &&
                            detail.drCr === 'Dr' &&
                            Number(detail.amount || 0) > Number(selectedSavAcc.availableBalance || 0)
                          );
                          return (
                            <div className="mt-1.5 p-1.5 bg-teal-50/70 border border-teal-200 rounded-sm space-y-1 text-left">
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[10.5px]">
                                <span className="font-bold text-teal-900">
                                  💳 बचत खाते निवडा ({detail.drCr === 'Dr' ? 'कपात Dr' : 'जमा Cr'}) <span className="text-red-500">*</span>
                                </span>
                                {selectedSavAcc && (
                                  <span className={`font-mono font-bold ${isLowBal ? 'text-rose-700' : 'text-teal-800'}`}>
                                    उपलब्ध शिल्लक: ₹{Number(selectedSavAcc.availableBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                              <SearchableSelect
                                id={`voucher-saving-${index}`}
                                disabled={isPassingMode}
                                value={detail.savingAccountID ? detail.savingAccountID.toString() : ''}
                                onChange={(e) => handleSavingAccountSelect(index, e.target.value)}
                                options={buildSavingAccountOptions(detail)}
                                minMenuWidth={440}
                                searchPlaceholder="बचत खाते क्र., जुना बचत नं, नाव किंवा CIF शोधा..."
                                countLabel="उपलब्ध बचत खाती"
                                emptyMessage="या शाखेत व योजनेत कोणतेही सक्रिय बचत खाते आढळले नाही."
                                emptySubMessage="खाते सक्रिय असणे आणि त्याच शाखेचे असणे आवश्यक आहे."
                                placeholder="-- सभासद / कर्मचाऱ्याचे बचत खाते निवडा --"
                                className={isPassingMode
                                  ? "w-full border border-teal-300 px-2 py-1 rounded-sm text-[11px] bg-slate-100 font-bold text-gray-700 cursor-not-allowed flex justify-between items-center h-[28px]"
                                  : "w-full border border-teal-400 px-2 py-1 rounded-sm text-[11px] bg-white flex justify-between items-center hover:border-teal-600 cursor-pointer h-[28px]"
                                }
                              />
                              {(selectedSavAcc || displaySavAccNo || displaySavOldNo) && (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-teal-900">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {displaySavAccNo && (
                                      <span className="font-mono font-bold text-teal-950">
                                        खाते: {displaySavAccNo}
                                      </span>
                                    )}
                                    {displaySavOldNo && (
                                      <span className="px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-950 border border-amber-300 font-mono font-bold">
                                        🏷️ जुना बचत नं.: {displaySavOldNo}
                                      </span>
                                    )}
                                    {selectedSavAcc && (
                                      <span>
                                        खातेदार: <strong>{selectedSavAcc.customerName || '-'}</strong>
                                        {selectedSavAcc.cifNo ? ` (${selectedSavAcc.cifNo})` : ''}
                                      </span>
                                    )}
                                  </div>
                                  {isLowBal && (
                                    <span className="text-rose-700 font-bold">
                                      ⚠ उपलब्ध शिल्लक अपुरी आहे!
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {detail.ledgerID > 0 && !detail.isLocked && isLoanControlLedger(detail.ledgerID) && detail.drCr === 'Dr' && (() => {
                          const selectedChgLoan = detail.chargeLoanAccountID
                            ? loanAccountsForCharges.find(a => Number(a.loanAccountID) === Number(detail.chargeLoanAccountID))
                            : undefined;
                          const dispLoanNo = selectedChgLoan?.loanAccountNo || detail.chargeLoanAccount?.loanAccountNo || '';
                          const dispOldNo = selectedChgLoan?.legacyAccountNumber || detail.chargeLoanAccount?.legacyAccountNumber || '';
                          return (
                            <div className="mt-1.5 p-1.5 bg-amber-50/70 border border-amber-200 rounded-sm space-y-1.5 text-left">
                              <div className="flex flex-wrap items-center justify-between gap-1 text-[10.5px]">
                                <span className="font-bold text-[#5A1A14]">
                                  🏷️ कर्जात वसूली / पोसटेज खर्च जोडायचा असल्यास कर्ज खाते निवडा (Dr मुद्दल नावे):
                                </span>
                                {selectedChgLoan && (
                                  <span className="font-mono font-bold text-[#4A1410]">
                                    चालू मुद्दल: ₹{Number(selectedChgLoan.principalBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5">
                                <div className="sm:col-span-8">
                                  <SearchableSelect
                                    id={`voucher-charge-loan-${index}`}
                                    disabled={isPassingMode}
                                    value={detail.chargeLoanAccountID ? String(detail.chargeLoanAccountID) : ''}
                                    onChange={(e) => handleChargeLoanAccountSelect(index, e.target.value)}
                                    options={buildLoanChargeAccountOptions(detail)}
                                    minMenuWidth={440}
                                    searchPlaceholder="कर्ज खाते क्र., जुना नं., नाव शोधा..."
                                    placeholder="-- कर्ज खाते निवडा (ऐच्छिक / वसूली-पोसटेज खर्चासाठी) --"
                                    className={isPassingMode
                                      ? "w-full border border-amber-300 px-2 py-1 rounded-sm text-[11px] bg-slate-100 font-bold text-gray-700 cursor-not-allowed flex justify-between items-center h-[28px]"
                                      : "w-full border border-amber-400 px-2 py-1 rounded-sm text-[11px] bg-white flex justify-between items-center hover:border-[#9A3412] cursor-pointer h-[28px]"
                                    }
                                  />
                                </div>
                                <div className="sm:col-span-4">
                                  <select
                                    disabled={isPassingMode || !detail.chargeLoanAccountID}
                                    value={detail.chargeExpenseType || 'RECOVERY_EXPENSE'}
                                    onChange={(e) => {
                                      const nextT = e.target.value;
                                      setDetails(prev => {
                                        const next = [...prev];
                                        if (next[index]) next[index] = { ...next[index], chargeExpenseType: nextT };
                                        return next;
                                      });
                                    }}
                                    className="w-full h-[28px] border border-amber-300 rounded-sm px-1.5 text-[10.5px] font-bold bg-white disabled:bg-slate-100"
                                  >
                                    <option value="RECOVERY_EXPENSE">वसूली खर्च</option>
                                    <option value="POSTAGE_EXPENSE">पोसटेज / टपाल खर्च</option>
                                    <option value="NOTICE_FEE">नोटीस फी</option>
                                    <option value="OTHER_RECOVERY">इतर वसूली खर्च</option>
                                  </select>
                                </div>
                              </div>
                              {(dispLoanNo || dispOldNo) && (
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#4A1410] font-mono">
                                  <span className="font-bold">खाते: {dispLoanNo}</span>
                                  {dispOldNo && (
                                    <span className="px-1.5 py-0.2 rounded-sm bg-amber-100 text-amber-950 border border-amber-300 font-bold">
                                      जुना: {dispOldNo}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {detail.ledgerID > 0 && Boolean(detail.showCustomerSelect || detail.customerID) && (!isSavingControlLedger(detail.ledgerID) || (isPassingMode && !detail.savingAccountID)) && !detail.chargeLoanAccountID && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <div className="flex-1 min-w-0">
                              <MemberSearchSelect
                                members={customers}
                                value={detail.customerID || ''}
                                isDisabled={isPassingMode}
                                valueType="customerId"
                                hideMemberRef={true}
                                onChange={(val) => !isPassingMode && handleDetailChange(index, 'customerID', val)}
                                placeholder="-- खातेदार निवडा (नाव, CIF किंवा जुना खातेदार नं शोधा) --"
                                className="w-full text-[11px]"
                              />
                            </div>
                            {!isPassingMode && !detail.isLocked && (
                              <button
                                type="button"
                                tabIndex={-1}
                                title="खातेदार काढून टाका"
                                onClick={() => {
                                  setDetails(prev => {
                                    if (!prev[index]) return prev;
                                    const updated = [...prev];
                                    updated[index] = { ...updated[index], customerID: '', showCustomerSelect: false };
                                    return updated;
                                  });
                                }}
                                className="px-1.5 h-[28px] bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-gray-300 rounded-sm text-[11px] font-bold cursor-pointer shrink-0"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-2 py-1 border-r border-gray-200 align-middle">
                        <input 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          value={detail.amount || ''} 
                          onChange={e => handleDetailChange(index, 'amount', e.target.value)} 
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                            }
                          }}
                          readOnly={isPassingMode || detail.isLocked}
                          placeholder="0.00"
                          className={`w-full text-right font-mono font-bold text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[28px] ${
                            isPassingMode || detail.isLocked ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-900'
                          }`} 
                        />
                      </td>

                      <td className="px-2 py-1 text-center align-middle">
                        {!isPassingMode && !detail.isLocked ? (
                          <button 
                            type="button" 
                            tabIndex={-1}
                            onClick={() => handleRemoveRow(index)} 
                            disabled={details.filter(d => !d.isLocked).length <= 1}
                            className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer disabled:opacity-30"
                          >
                            बाद
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold">लॉक</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-[11px] sticky bottom-0 z-10 shadow-xs border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={2} className="p-2 text-right border-r border-slate-300 font-bold text-gray-800">
                      एकूण बेरीज (Total Allocation):
                    </td>
                    <td className="p-2 text-right border-r border-slate-300 font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-primary font-bold">Cr: ₹{totalCr.toFixed(2)}</span>
                        <span className="text-emerald-700 font-bold">Dr: ₹{totalDr.toFixed(2)}</span>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalDr !== totalCr && (
              <div className="mt-1.5 bg-rose-50 text-[11px] text-rose-700 font-bold p-2 rounded-sm border border-rose-200 flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Dr आणि Cr रकमा जुळत नाहीत! फरक (Difference): <strong>₹{Math.abs(totalDr - totalCr).toFixed(2)}</strong></span>
              </div>
            )}
          </div>

          {/* SECTION 3: व्यवहार तपशील */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2">
            <label className={labelClass}>व्यवहार सविस्तर तपशील (Narration / Remark)</label>
            <textarea 
              ref={narrationInputRef}
              value={narration} 
              onChange={e => setNarration(e.target.value)} 
              readOnly={isPassingMode}
              placeholder="व्यवहाराचा सविस्तर तपशील (उदा. चेक नंबर, बँकेचे नाव, कुणाकडून मिळाले, कशाबद्दल दिले इत्यादी)..."
              rows={2}
              className={`w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1.5 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none text-gray-900 font-medium ${
                isPassingMode ? 'bg-slate-100 cursor-not-allowed' : 'bg-slate-50/50'
              }`} 
            />
          </div>

          {/* Form Action Footer */}
          {isPassingMode ? (
            <div className="pt-2.5 flex flex-wrap justify-between items-center gap-2 border-t-2 border-amber-400 bg-amber-50/70 p-2.5 rounded-b-sm">
              <button 
                type="button" 
                onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
                disabled={passingActionLoading}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-sm text-xs cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
              >
                <span>↩️ मागे जा (Back to Passing Queue)</span>
              </button>

              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => setRejectModalOpen(true)}
                  disabled={passingActionLoading}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>❌ व्हाउचर नामंजूर / रद्द करा (Reject)</span>
                </button>

                <button 
                  type="button" 
                  onClick={handlePassVoucher}
                  disabled={passingActionLoading}
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-sm text-xs cursor-pointer shadow-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{passingActionLoading ? 'पास होत आहे...' : '✅ व्हाउचर पास करा (Pass & Approve)'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex justify-end items-center gap-2 border-t border-gray-200">
              {editingVoucherId && (
                <button 
                  type="button" 
                  onClick={cancelEdit}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>रद्द करा</span>
                </button>
              )}

              <button 
                type="submit" 
                disabled={totalDr !== totalCr || totalDr === 0}
                className="px-6 py-2 bg-primary hover:opacity-90 disabled:bg-slate-400 text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{editingVoucherId ? '✏️ व्हाउचर अपडेट करा (Update)' : '💾 व्हाउचर सेव्ह करा (Save Voucher)'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 📜 4. REGISTERED VOUCHERS LIST MODAL POPUP */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-[97vw] xl:max-w-[1460px] max-h-[92vh] flex flex-col overflow-hidden border border-gray-300 border-t-4 border-t-primary animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <span className="text-sm font-bold flex items-center gap-1.5">
                  <span>नोंदवलेले व्हाउचर्स यादी (Registered Vouchers Directory)</span>
                </span>
                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {filteredVouchers.length} / {vouchers.length}
                </span>
              </div>
              <button 
                onClick={() => setIsListModalOpen(false)} 
                className="text-white hover:bg-red-600 text-sm font-bold w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer"
                title="बंद करा"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row gap-2 justify-between items-center">
              <div className="relative w-full sm:w-96">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="व्हाउचर क्र., प्रकार, तारीख, तपशील किंवा रक्कमेने शोधा..."
                  className="w-full pl-8 pr-8 py-1 text-[11px] border border-gray-300 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white h-[28px]"
                  autoFocus
                />
                {listSearchQuery && (
                  <button
                    onClick={() => setListSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">प्रकारनुसार (Type):</label>
                <select
                  value={listTypeFilter}
                  onChange={(e) => {
                    setListTypeFilter(e.target.value);
                    setListPage(1);
                  }}
                  className="border border-gray-300 px-2 py-1 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-white h-[28px] font-bold"
                >
                  <option value="All">सर्व व्हाउचर प्रकार (All)</option>
                  <option value="Receipt">📥 रिसिप्ट (Receipt)</option>
                  <option value="Payment">📤 पेमेंट (Payment)</option>
                  <option value="Journal">🔄 जर्नल (Journal)</option>
                  <option value="Contra">🏦 कॉन्ट्रा (Contra)</option>
                </select>

                <label className="text-[11px] font-bold text-gray-700 whitespace-nowrap ml-1">प्रति पान:</label>
                <select
                  value={listPageSize}
                  onChange={(e) => {
                    setListPageSize(Number(e.target.value));
                    setListPage(1);
                  }}
                  className="border border-gray-300 px-2 py-1 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-white h-[28px] font-bold text-primary"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={0}>सर्व ({filteredVouchers.length})</option>
                </select>
              </div>
            </div>

            {/* Modal Body Table */}
            <div className="p-3 overflow-y-auto flex-1 bg-slate-50">
              <div className="overflow-x-auto bg-white rounded-sm shadow-xs border border-gray-200">
                <table className="w-full text-[11px] text-center border-collapse whitespace-nowrap leading-tight">
                  <thead className="bg-[#5A1A14] text-amber-50 font-bold border-b border-amber-400/30">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-amber-400/25 text-left whitespace-nowrap">शाखा (Branch)</th>
                      <th className="px-2 py-1.5 border-r border-amber-400/25 text-left whitespace-nowrap">तारीख (Date)</th>
                      <th className="px-2 py-1.5 border-r border-amber-400/25 text-left whitespace-nowrap">प्रकार (Type)</th>
                      <th className="px-2 py-1.5 border-r border-amber-400/25 text-left whitespace-nowrap">नंबर (No)</th>
                      <th className="px-2 py-1.5 border-r border-amber-400/25 text-left whitespace-nowrap">तपशील (Narration)</th>
                      <th className="px-2 py-1.5 border-r border-amber-400/25 text-right whitespace-nowrap">रक्कम (Amount ₹)</th>
                      <th className="px-2 py-1.5 text-center w-36 whitespace-nowrap">क्रिया (Actions)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 bg-white">
                    {paginatedVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                          कोणतेही व्हाउचर सापडले नाही.
                        </td>
                      </tr>
                    ) : (
                      paginatedVouchers.map(v => (
                        <React.Fragment key={v.voucherID}>
                          <tr className="hover:bg-amber-50/60 cursor-pointer transition-colors" onClick={() => toggleVoucher(v.voucherID)}>
                            <td className="px-2 py-1 border-r border-gray-200 text-left text-gray-700 font-bold align-middle">
                              {(v as any).branch?.branchName || '-'}
                            </td>
                            <td className="px-2 py-1 border-r border-gray-200 text-left text-gray-900 font-medium align-middle">
                              <span className="mr-1 text-gray-400 font-mono">{expandedVoucherId === v.voucherID ? '▼' : '▶'}</span>
                              {new Date(v.voucherDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="px-2 py-1 border-r border-gray-200 text-left align-middle">
                              <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded ${
                                v.voucherType === 'Receipt' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                v.voucherType === 'Payment' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                v.voucherType === 'Journal' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                'bg-amber-100 text-[#7C2418] border border-amber-300'
                              }`}>
                                {v.voucherType}
                              </span>
                            </td>
                            <td className="px-2 py-1 border-r border-gray-200 text-left font-bold text-primary font-mono align-middle">{v.voucherNo}</td>
                            <td className="px-2 py-1 border-r border-gray-200 text-left text-gray-600 truncate max-w-[200px] align-middle" title={v.narration || ''}>
                              {v.narration || '-'}
                            </td>
                            <td className="px-2 py-1 border-r border-gray-200 text-right font-bold text-gray-900 font-mono align-middle">
                              ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-1 text-center align-middle">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setPrintingVoucherId(v.voucherID); }} 
                                  className="px-2 py-0.5 rounded-sm bg-orange-50 hover:bg-orange-100 text-[#9A3412] border border-amber-200 font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                  title="प्रिंट करा"
                                >
                                  <Printer size={11} />
                                  <span>प्रिंट</span>
                                </button>
                                
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setIsListModalOpen(false); handleEdit(v); }} 
                                  className="px-2 py-0.5 rounded-sm bg-amber-50 hover:bg-amber-100 text-primary border border-amber-200 font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                  title="बदला"
                                >
                                  <Edit2 size={11} />
                                  <span>बदला</span>
                                </button>
                                
                                {v.status !== 'Approved' && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(v.voucherID); }} 
                                    className="px-2 py-0.5 rounded-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                    title="डिलीट करा"
                                  >
                                    <Trash2 size={11} />
                                    <span>बाद</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          
                          {/* Accordion Expanded Ledger Details */}
                          {expandedVoucherId === v.voucherID && (
                            <tr className="bg-slate-50">
                              <td colSpan={7} className="p-3 border-l-4 border-primary">
                                <div className="text-[10.5px] font-bold text-primary mb-1.5 uppercase tracking-wider flex items-center gap-1">
                                  <BookOpen size={13} />
                                  <span>व्हाउचर मधील खाती व खतावणी तपशील (Ledger Breakdown):</span>
                                </div>
                                <table className="w-full bg-white border border-gray-200 rounded-sm text-[11px] shadow-xs">
                                  <thead className="bg-[#5A1A14] text-amber-50 font-bold text-left">
                                    <tr>
                                      <th className="p-1.5 border-r border-amber-400/25 whitespace-nowrap">खाते (Ledger Name)</th>
                                      <th className="p-1.5 border-r border-amber-400/25 text-right w-32 whitespace-nowrap">नावे रक्कम (Dr ₹)</th>
                                      <th className="p-1.5 text-right w-32 whitespace-nowrap">जमा रक्कम (Cr ₹)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-amber-100">
                                    {v.voucherDetails && v.voucherDetails.map((vd, i) => {
                                      const linkedCust = vd.customer || vd.member?.customer;
                                      const custCif = linkedCust?.cifNo || (linkedCust as any)?.CIFNo || '';
                                      const custLegacy = linkedCust?.legacyCustomerNo || (linkedCust as any)?.LegacyCustomerNo || '';
                                      const custName = linkedCust
                                        ? [linkedCust.firstName || (linkedCust as any).FirstName, linkedCust.middleName || (linkedCust as any).MiddleName, linkedCust.lastName || (linkedCust as any).LastName].filter(Boolean).join(' ').trim()
                                        : '';
                                      const linkedSavAccNo = vd.savingAccount?.accountNo || (vd.savingAccountID ? `#${vd.savingAccountID}` : '');
                                      const linkedSavOldNo = vd.savingAccount?.oldAccountNo || vd.savingAccount?.previousAccountNo || vd.savingAccount?.legacyAccountNumber || '';
                                      return (
                                        <tr key={i} className="hover:bg-slate-50">
                                          <td className="p-1.5 border-r border-gray-200 text-gray-900 font-medium align-middle">
                                            <div>{vd.ledger?.ledgerName || 'Unknown Ledger'}</div>
                                            {linkedSavAccNo && (
                                              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                                                <span className="px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-100 text-emerald-950 border border-emerald-200">
                                                  💳 बचत खाते: {linkedSavAccNo}
                                                </span>
                                                {linkedSavOldNo && (
                                                  <span className="px-1.5 py-0.5 rounded font-mono font-bold bg-amber-100 text-amber-950 border border-amber-300">
                                                    जुना बचत नं: {linkedSavOldNo}
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                            {(custCif || custName) && (
                                              <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                                                {custCif && (
                                                  <span className="px-1.5 py-0.5 rounded font-mono font-bold bg-amber-100 text-[#4A1410] border border-amber-200">
                                                    {custCif}
                                                  </span>
                                                )}
                                                {custLegacy && (
                                                  <span className="px-1.5 py-0.5 rounded font-mono font-bold bg-purple-100 text-purple-950 border border-purple-200">
                                                    जुना खातेदार नं: {custLegacy}
                                                  </span>
                                                )}
                                                {custName && (
                                                  <span className="font-bold text-slate-700">{custName}</span>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                          <td className="p-1.5 border-r border-gray-200 text-right text-emerald-700 font-bold font-mono align-middle">
                                            {vd.drCr === 'Dr' ? `₹${vd.amount.toFixed(2)}` : '-'}
                                          </td>
                                          <td className="p-1.5 text-right text-primary font-bold font-mono align-middle">
                                            {vd.drCr === 'Cr' ? `₹${vd.amount.toFixed(2)}` : '-'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 p-2.5 px-4 border-t border-gray-200 flex flex-wrap justify-between items-center gap-2 text-[11px] text-gray-600">
              <span>
                दाखवत आहे:{' '}
                <strong className="text-slate-900">
                  {filteredVouchers.length === 0
                    ? 0
                    : listPageSize === 0
                      ? `1 ते ${filteredVouchers.length}`
                      : `${(safeVoucherPage - 1) * listPageSize + 1} ते ${Math.min(safeVoucherPage * listPageSize, filteredVouchers.length)}`}
                </strong>{' '}
                (एकूण व्हाउचर्स: <strong className="text-primary">{filteredVouchers.length}</strong>)
              </span>

              <div className="flex items-center gap-1.5">
                {listPageSize > 0 && totalVoucherPages > 1 && (
                  <>
                    <button
                      type="button"
                      disabled={safeVoucherPage <= 1}
                      onClick={() => setListPage(1)}
                      className="px-2 py-1 bg-white border border-gray-300 rounded-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                    >
                      ⏮️ पहिले
                    </button>
                    <button
                      type="button"
                      disabled={safeVoucherPage <= 1}
                      onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 bg-white border border-gray-300 rounded-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                    >
                      ⬅️ मागील पान
                    </button>
                    <span className="px-2.5 py-1 bg-primary text-white rounded-sm font-bold font-mono">
                      पान {safeVoucherPage} / {totalVoucherPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeVoucherPage >= totalVoucherPages}
                      onClick={() => setListPage((p) => Math.min(totalVoucherPages, p + 1))}
                      className="px-2.5 py-1 bg-white border border-gray-300 rounded-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                    >
                      पुढील पान ➡️
                    </button>
                    <button
                      type="button"
                      disabled={safeVoucherPage >= totalVoucherPages}
                      onClick={() => setListPage(totalVoucherPages)}
                      className="px-2 py-1 bg-white border border-gray-300 rounded-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                    >
                      शेवटचे ⏭️
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setIsListModalOpen(false)}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-1 rounded-sm font-bold transition-colors cursor-pointer shadow-2xs ml-2"
                >
                  बंद करा (Close)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛑 Rejection Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-md overflow-hidden border border-rose-300 border-t-4 border-t-rose-600 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-50 px-4 py-3 border-b border-rose-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <div>
                <h3 className="text-sm font-bold text-rose-900">व्हाउचर नामंजूर / रद्द करा (Reject Voucher)</h3>
                <p className="text-[11px] text-rose-700">व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucher?.voucherNo || voucherNo}</span></p>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <label className="block text-xs font-semibold text-gray-700">
                नामंजूर करण्याचे कारण लिहा (Reason for Rejection): <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="उदा. खात्याचा तपशील चुकीचा आहे / रक्कम जुळत नाही / सपोर्टिंग डॉक्युमेंट नाही..."
                rows={3}
                className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                autoFocus
              />
            </div>

            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectionReason('');
                }}
                disabled={passingActionLoading}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded transition-colors"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                onClick={handleRejectVoucher}
                disabled={passingActionLoading || !rejectionReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{passingActionLoading ? 'प्रक्रिया सुरू आहे...' : 'नामंजूर निश्चित करा (Confirm Reject)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  Layers,
  Search,
  Trash2,
  CheckCircle,
  XCircle,
  CreditCard,
  Building,
  RotateCcw,
  RefreshCw,
  Save,
  X,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { filterBankAccountLedgers, buildBankLedgerOptions } from '../utils/bankLedgerUtils';

interface SavingAccount {
  savingAccountID: number;
  branchID?: number;
  branchName?: string;
  branchCode?: string;
  accountNo: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  cifNo?: string;
  customerID?: number;
  memberID?: number;
  customerName?: string;
  customerNameEng?: string;
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
  ledgerNameEnglish?: string;
  accountType?: string;
  groupID?: number;
  isActive?: boolean;
  accountGroup?: {
    groupID?: number;
    groupCode?: string;
    groupName?: string;
  };
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
  customerName?: string;
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

const format14DigitDisplay = (num?: string) => {
  if (!num) return '-';
  const clean = num.replace(/\D/g, '');
  if (clean.length === 14) {
    return `${clean.substring(0, 3)}-${clean.substring(3, 3)}-${clean.substring(6, 7)}-${clean.substring(13, 1)}`;
  }
  return num;
};

interface SavingTransactionEntryProps {
  voucherId?: number;
  isReadOnly?: boolean;
  onNavigate?: (tab: string, params?: any) => void;
}

const SavingTransactionEntry: React.FC<SavingTransactionEntryProps> = ({ voucherId, isReadOnly, onNavigate }) => {
  const queryParams = new URLSearchParams(window.location.search);
  const voucherIdFromUrl = voucherId || (queryParams.get('voucherId') ? Number(queryParams.get('voucherId')) : undefined);
  const isPassingMode = Boolean(isReadOnly || queryParams.get('passingMode') === 'true');

  const [passingVoucher, setPassingVoucher] = useState<any>(null);
  const [passingActionLoading, setPassingActionLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { user } = useAuth();

  const [accounts, setAccounts] = useState<SavingAccount[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [bankLedgers, setBankLedgers] = useState<Ledger[]>([]);
  const [allRawLedgers, setAllRawLedgers] = useState<Ledger[]>([]);
  const [transactions, setTransactions] = useState<SavingTransaction[]>([]);

  const [selectedLedgerID, setSelectedLedgerID] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<SavingAccount | null>(null);

  const [selectedTargetLedgerID, setSelectedTargetLedgerID] = useState<number>(0);
  const [selectedTargetAccount, setSelectedTargetAccount] = useState<SavingAccount | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTxnModal, setShowTxnModal] = useState(false);

  // CIF-First Multi-Account Selection State
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [showMultiAccountModal, setShowMultiAccountModal] = useState(false);
  const [customerMatchingAccounts, setCustomerMatchingAccounts] = useState<SavingAccount[]>([]);
  const [multiAccountCustomerInfo, setMultiAccountCustomerInfo] = useState<{
    name: string;
    cifNo: string;
    customerId: number;
  } | null>(null);
  const [noAccountFoundAlert, setNoAccountFoundAlert] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const isAbortError = (err: any) =>
    axios.isCancel(err) || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';

  const API_URL = '/api';

  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    savingAccountID: 0,
    targetSavingAccountID: 0,
    bankLedgerID: 0,
    transactionDate: activeBusinessDate,
    transactionType: 'Deposit',
    paymentMode: 'Cash',
    amount: '',
    narration: '',
    checkNo: ''
  });

  useEffect(() => {
    if (user?.businessDate) {
      setFormData((prev) => ({ ...prev, transactionDate: user.businessDate.split('T')[0] }));
    }
  }, [user?.businessDate]);

  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();
    fetchAccounts(undefined, controller.signal);
    fetchTransactions(controller.signal);
    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, []);

  // Voucher Passing Mode: Fetch transaction details linked to voucher
  useEffect(() => {
    if (!isPassingMode || !voucherIdFromUrl) return;
    const controller = new AbortController();

    const loadPassingTxn = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/SavingTransactions/by-voucher/${voucherIdFromUrl}`, { signal: controller.signal });
        if (!isMountedRef.current || controller.signal.aborted) return;
        const d = res.data;
        if (!d) return;

        setPassingVoucher(d.voucher);
        setFormData({
          savingAccountID: d.savingAccountID || d.savingAccount?.savingAccountID || 0,
          targetSavingAccountID: d.targetSavingAccountID || 0,
          bankLedgerID: d.bankLedgerID || 0,
          transactionDate: d.transactionDate ? d.transactionDate.split('T')[0] : new Date().toISOString().split('T')[0],
          transactionType: d.transactionType || 'Deposit',
          paymentMode: d.paymentMode || 'Cash',
          amount: String(d.amount || ''),
          narration: d.narration || '',
          checkNo: d.checkNo || ''
        });

        if (d.savingAccount) {
          setSelectedAccount({
            savingAccountID: d.savingAccount.savingAccountID,
            accountNo: d.savingAccount.accountNo,
            openingBalance: Number(d.savingAccount.openingBalance ?? 0),
            currentBalance: Number(d.savingAccount.currentBalance ?? 0),
            minimumBalance: Number(d.savingAccount.minimumBalance ?? 0),
            lienAmount: Number(d.savingAccount.lienAmount ?? 0),
            customerName: d.savingAccount.customer?.fullName || '',
            cifNo: d.savingAccount.customer?.cifNo || '',
            status: d.savingAccount.status
          } as any);
        }
        if (d.targetSavingAccount) {
          setSelectedTargetAccount({
            savingAccountID: d.targetSavingAccount.savingAccountID,
            accountNo: d.targetSavingAccount.accountNo,
            currentBalance: Number(d.targetSavingAccount.currentBalance ?? 0),
            minimumBalance: Number(d.targetSavingAccount.minimumBalance ?? 0),
            lienAmount: Number(d.targetSavingAccount.lienAmount ?? 0),
            status: d.targetSavingAccount.status,
            customerName: d.targetSavingAccount.customer?.fullName || ''
          } as any);
        }
      } catch (err) {
        if (isAbortError(err)) return;
        if (!isMountedRef.current || controller.signal.aborted) return;
        console.error('Failed to load saving transaction for passing:', err);
        setError('बचत व्हाउचर नोंद लोड करताना त्रुटी आली.');
      } finally {
        if (isMountedRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadPassingTxn();
    return () => controller.abort();
  }, [isPassingMode, voucherIdFromUrl]);

  const parseBankLedgers = (allLedgers: any[]) => {
    setAllRawLedgers(allLedgers);
    setBankLedgers(filterBankAccountLedgers(allLedgers));
  };

  const fetchAccounts = async (preserveAccountId?: number, signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams(window.location.search);
      let cifStr = params.get('cifNo') || params.get('cif');
      let customerIdStr = params.get('customerId') || params.get('customerID');
      let memberIdStr = params.get('memberId') || params.get('memberID');
      let accountIdStr = params.get('accountId') || params.get('savingAccountId');
      let typeStr = params.get('type');
      let customerNameStr = params.get('customerName');

      // Also read from sessionStorage backup bridge if URL params were not provided
      if (!cifStr && !customerIdStr && !memberIdStr && !accountIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              cifStr = bridgeData.cifNo || bridgeData.cif;
              customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
              memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
              typeStr = bridgeData.type || typeStr;
              customerNameStr = bridgeData.customerName || customerNameStr;
            }
          }
        } catch (e) {
          console.error('Failed to read sessionStorage transfer:', e);
        }
      }

      const getAccCustomerId = (a: any) => Number(a.customerId ?? a.customerID ?? a.CustomerID ?? 0);
      const getAccMemberId = (a: any) => Number(a.memberId ?? a.memberID ?? a.MemberID ?? 0);
      const getAccCif = (a: any) => String(a.cifNo ?? a.CIFNo ?? a.cif ?? '').trim().toUpperCase();

      // FAST PATH: Targeted Customer/Account lookup if navigated from Member360 or URL
      const hasSpecificTarget = Boolean(!preserveAccountId && !isPassingMode && (customerIdStr || accountIdStr));
      if (hasSpecificTarget) {
        try {
          let fastRes: any = null;
          if (accountIdStr) {
            fastRes = await axios.get(`${API_URL}/SavingAccounts/${accountIdStr}`, { signal }).catch((err) => {
              if (isAbortError(err)) throw err;
              return null;
            });
          } else if (customerIdStr) {
            fastRes = await axios.get(`${API_URL}/SavingAccounts?customerId=${customerIdStr}`, { signal }).catch((err) => {
              if (isAbortError(err)) throw err;
              return null;
            });
          }
          if (!isMountedRef.current || signal?.aborted) return;
          if (fastRes?.data) {
            const matchedList: SavingAccount[] = Array.isArray(fastRes.data) ? fastRes.data : [fastRes.data];
            if (matchedList.length === 1) {
              applySelectedAccount(matchedList[0], typeStr);
              setCustomerMatchingAccounts(matchedList);
              setNoAccountFoundAlert(null);
            } else if (matchedList.length > 1) {
              setCustomerMatchingAccounts(matchedList);
              const primaryName = customerNameStr || matchedList[0].customerName || 'खातेदार';
              const primaryCif = (cifStr ? cifStr.trim().toUpperCase() : '') || getAccCif(matchedList[0]) || '-';
              setMultiAccountCustomerInfo({
                name: primaryName,
                cifNo: primaryCif,
                customerId: Number(customerIdStr) || getAccCustomerId(matchedList[0])
              });
              if (typeStr) {
                const finalType: string = typeStr;
                setFormData((prev) => ({ ...prev, transactionType: finalType }));
              }
              setShowMultiAccountModal(true);
              setNoAccountFoundAlert(null);
            }
          }
        } catch (fastErr) {
          if (isAbortError(fastErr)) return;
          console.error('Fast target lookup error, falling back to full list', fastErr);
        }
      }

      const [accRes, interestRes, ledgersRes] = await Promise.all([
        axios.get(`${API_URL}/SavingAccounts`, { signal }),
        axios.get(`${API_URL}/SavingSettings/Interest`, { signal }).catch((err) => {
          if (isAbortError(err)) throw err;
          return { data: [] };
        }),
        axios.get(`${API_URL}/Ledgers`, { signal }).catch((err) => {
          if (isAbortError(err)) throw err;
          return { data: [] };
        })
      ]);

      if (!isMountedRef.current || signal?.aborted) return;

      const accData: SavingAccount[] = accRes.data || [];
      setAccounts(accData);

      const allLedgersList: any[] = Array.isArray(ledgersRes.data) ? ledgersRes.data : [];
      parseBankLedgers(allLedgersList);

      const targetAccId = preserveAccountId || selectedAccount?.savingAccountID || formData.savingAccountID;
      if (targetAccId && targetAccId > 0) {
        const freshAcc = accData.find((a) => a.savingAccountID === targetAccId);
        if (freshAcc) {
          setSelectedAccount(freshAcc);
          if (freshAcc.ledgerID) {
            setSelectedLedgerID(freshAcc.ledgerID);
          }
        }
      }

      if (formData.targetSavingAccountID && formData.targetSavingAccountID > 0) {
        const freshTarget = accData.find((a) => a.savingAccountID === formData.targetSavingAccountID);
        if (freshTarget) {
          setSelectedTargetAccount(freshTarget);
        }
      }

      const uniqueLedgerMap = new Map<number, string>();

      if (Array.isArray(interestRes.data) && interestRes.data.length > 0) {
        interestRes.data.forEach((s: any) => {
          const targetLid = s.savingLiabilityLedgerID || s.ledgerID || s.interestExpenseLedgerID;
          if (targetLid && targetLid > 0) {
            const rawName = s.schemeName || s.savingLiabilityLedger?.ledgerName || s.ledger?.ledgerName || 'बचत योजना';
            const rateInfo = s.interestRate !== undefined && s.interestRate !== null ? ` (${s.interestRate}%)` : '';
            uniqueLedgerMap.set(targetLid, `${rawName}${rateInfo}`);
          }
        });
      }

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

      accData.forEach((acc: any) => {
        const lid = acc.ledgerID;
        const lname = acc.ledgerName || 'बचत ठेव';
        if (lid && !uniqueLedgerMap.has(lid)) {
          uniqueLedgerMap.set(lid, lname);
        }
      });

      const ledgerList = Array.from(uniqueLedgerMap.entries()).map(([ledgerID, ledgerName]) => ({ ledgerID, ledgerName }));
      setLedgers(ledgerList);

      if (!preserveAccountId && !isPassingMode && !selectedAccount) {
        if (accountIdStr) {
          const accId = parseInt(accountIdStr, 10);
          const matchedAcc = accData.find((a: any) => a.savingAccountID === accId);
          if (matchedAcc) {
            applySelectedAccount(matchedAcc, typeStr);
            setCustomerMatchingAccounts([matchedAcc]);
          }
        } else if (cifStr || customerIdStr || memberIdStr) {
          const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
          const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
          const cleanCif = cifStr ? cifStr.trim().toUpperCase() : '';
          const cleanDigits = cleanCif ? cleanCif.replace(/\D/g, '') : '';

          let matched: SavingAccount[] = [];

          if (cleanCif) {
            matched = accData.filter((a) => {
              const aCif = getAccCif(a);
              if (!aCif) return false;
              if (aCif === cleanCif) return true;
              if (cleanDigits && aCif.replace(/\D/g, '') === cleanDigits) return true;
              return false;
            });
          }

          if (matched.length === 0 && cId > 0) {
            matched = accData.filter((a) => getAccCustomerId(a) === cId);
          }

          if (matched.length === 0 && mId > 0) {
            matched = accData.filter((a) => getAccMemberId(a) === mId || getAccCustomerId(a) === mId);
          }

          if (matched.length === 1) {
            applySelectedAccount(matched[0], typeStr);
            setCustomerMatchingAccounts(matched);
            setNoAccountFoundAlert(null);
          } else if (matched.length > 1) {
            setCustomerMatchingAccounts(matched);
            const primaryName = customerNameStr || matched[0].customerName || 'खातेदार';
            const primaryCif = cleanCif || getAccCif(matched[0]) || '-';
            setMultiAccountCustomerInfo({
              name: primaryName,
              cifNo: primaryCif,
              customerId: cId || getAccCustomerId(matched[0])
            });
            if (typeStr) {
              const finalType: string = typeStr;
              setFormData((prev) => ({ ...prev, transactionType: finalType }));
            }
            setShowMultiAccountModal(true);
            setNoAccountFoundAlert(null);
          } else {
            setCustomerMatchingAccounts([]);
            const identifier = cleanCif ? `CIF: ${cleanCif}` : cId ? `ID: ${cId}` : `Member: ${mId}`;
            setNoAccountFoundAlert(`निवडलेल्या खातेदाराचे (${customerNameStr || identifier}) कोणतेही बचत खाते आढळले नाही.`);
          }
        }
      }
    } catch (err) {
      if (isAbortError(err)) return;
      console.error('Error fetching accounts or interest settings', err);
    }
  };

  const applySelectedAccount = (acc: SavingAccount, overrideType?: string | null) => {
    if (!isMountedRef.current) return;
    setSelectedLedgerID(acc.ledgerID || 0);
    setFormData((prev) => ({
      ...prev,
      savingAccountID: acc.savingAccountID,
      transactionType: overrideType || prev.transactionType
    }));
    setSelectedAccount(acc);
    setError('');
    setTimeout(() => {
      if (isMountedRef.current) {
        amountInputRef.current?.focus();
      }
    }, 150);
  };

  const handleSelectCustomerAccount = (acc: SavingAccount) => {
    applySelectedAccount(acc, formData.transactionType);
    setShowMultiAccountModal(false);
  };

  const fetchTransactions = async (signal?: AbortSignal) => {
    try {
      const response = await axios.get(`${API_URL}/SavingTransactions?page=1&pageSize=30`, { signal });
      if (!isMountedRef.current || signal?.aborted) return;
      setTransactions(response.data || []);
    } catch (err) {
      if (isAbortError(err)) return;
      console.error('Error fetching transactions', err);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchAccounts(formData.savingAccountID || undefined), fetchTransactions()]);
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  };

  const handleResetForm = () => {
    setSelectedLedgerID(0);
    setSelectedAccount(null);
    setSelectedTargetLedgerID(0);
    setSelectedTargetAccount(null);
    setFormData((prev) => ({
      ...prev,
      savingAccountID: 0,
      targetSavingAccountID: 0,
      bankLedgerID: 0,
      paymentMode: 'Cash',
      amount: '',
      narration: '',
      checkNo: ''
    }));
    setError('');
    setSuccess('');
  };

  const handleLedgerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lid = parseInt(e.target.value, 10) || 0;
    setSelectedLedgerID(lid);
    setFormData((prev) => ({ ...prev, savingAccountID: 0 }));
    setSelectedAccount(null);
    setError('');
  };

  const handleTargetLedgerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lid = parseInt(e.target.value, 10) || 0;
    setSelectedTargetLedgerID(lid);
    setFormData((prev) => ({ ...prev, targetSavingAccountID: 0 }));
    setSelectedTargetAccount(null);
    setError('');
  };

  const handleAccountChange = (e: any) => {
    const accountId = parseInt(e.target.value, 10) || 0;
    setFormData((prev) => ({ ...prev, savingAccountID: accountId }));
    const acc = accounts.find((a) => a.savingAccountID === accountId) || null;
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
    const acc = accounts.find((a) => a.savingAccountID === accountId) || null;
    setSelectedTargetAccount(acc);
    if (acc && acc.ledgerID) {
      setSelectedTargetLedgerID(acc.ledgerID);
    }
    setError('');
    setSuccess('');
  };

  const handleBankLedgerChange = (e: any) => {
    const lid = parseInt(String(e?.target?.value ?? 0), 10) || 0;
    setFormData((prev) => ({
      ...prev,
      bankLedgerID: lid
    }));
    setError('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
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

    const reqAmt = parseFloat(formData.amount) || 0;
    if (formData.transactionType === 'Withdrawal' && selectedAccount) {
      const srcMin = Number(selectedAccount.minimumBalance ?? 0);
      const srcLien = Number(selectedAccount.lienAmount ?? 0);
      const srcAvail = Math.max(0, Number(selectedAccount.currentBalance ?? 0) - srcLien - srcMin);
      if (reqAmt > srcAvail) {
        setError(`बचत खात्यात अपुरी शिल्लक! (किमान शिल्लक ₹${srcMin.toFixed(2)} व तारण ₹${srcLien.toFixed(2)} वगळून काढता येणारी रक्कम: ₹${srcAvail.toFixed(2)})`);
        return;
      }
    }

    if (formData.transactionType === 'Deposit' && formData.paymentMode === 'Transfer' && selectedTargetAccount) {
      const tgtMin = Number(selectedTargetAccount.minimumBalance ?? 0);
      const tgtLien = Number(selectedTargetAccount.lienAmount ?? 0);
      const tgtAvail = Math.max(0, Number(selectedTargetAccount.currentBalance ?? 0) - tgtLien - tgtMin);
      if (reqAmt > tgtAvail) {
        setError(`टार्गेट बचत खात्यात (${selectedTargetAccount.accountNo}) अपुरी शिल्लक! (किमान शिल्लक ₹${tgtMin.toFixed(2)} व तारण ₹${tgtLien.toFixed(2)} वगळून जास्तीत जास्त ₹${tgtAvail.toFixed(2)} वर्ग करता येतील.)`);
        return;
      }
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

      const newBal =
        response.data?.currentBalance !== undefined
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
  const filteredAccounts =
    selectedLedgerID > 0 ? accounts.filter((acc) => (acc.ledgerID || 7) === selectedLedgerID) : accounts;

  const accountOptions = filteredAccounts.map((acc: any) => {
    const accDisplay = acc.formattedAccountNo || format14DigitDisplay(acc.accountNo);
    const cifPart = acc.cifNo ? ` [CIF: ${acc.cifNo}]` : '';
    const oldNo = acc.oldAccountNo || acc.previousAccountNo || acc.legacyAccountNumber;
    const oldAccPart = oldNo && oldNo !== acc.accountNo ? ` (जुना: ${oldNo})` : '';
    const namePart = acc.customerName || 'अज्ञात';
    const engPart = acc.customerNameEng ? ` (${acc.customerNameEng})` : '';
    const balPart = ` - शिल्लक: ₹${(acc.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return {
      value: acc.savingAccountID,
      label: `${accDisplay}${oldAccPart}${cifPart} - ${namePart}${engPart}${balPart}`
    };
  });

  // Target accounts filtered by selected target deposit ledger (excluding source account)
  const filteredTargetAccounts =
    selectedTargetLedgerID > 0
      ? accounts.filter((acc) => (acc.ledgerID || 7) === selectedTargetLedgerID && acc.savingAccountID !== formData.savingAccountID)
      : accounts.filter((acc) => acc.savingAccountID !== formData.savingAccountID);

  const targetAccountOptions = filteredTargetAccounts.map((acc: any) => {
    const accDisplay = acc.formattedAccountNo || format14DigitDisplay(acc.accountNo);
    const cifPart = acc.cifNo ? ` [CIF: ${acc.cifNo}]` : '';
    const oldNo = acc.oldAccountNo || acc.previousAccountNo || acc.legacyAccountNumber;
    const oldAccPart = oldNo && oldNo !== acc.accountNo ? ` (जुना: ${oldNo})` : '';
    const namePart = acc.customerName || 'अज्ञात';
    const engPart = acc.customerNameEng ? ` (${acc.customerNameEng})` : '';
    const balPart = ` - शिल्लक: ₹${(acc.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return {
      value: acc.savingAccountID,
      label: `${accDisplay}${oldAccPart}${cifPart} - ${namePart}${engPart}${balPart}`
    };
  });

  // Filter transactions by search query (Exclude Opening Balance migration entries)
  const filteredTransactions = transactions.filter((t) => {
    const isOpeningBal =
      t.narration && (t.narration.toLowerCase().includes('opening balance') || t.narration.includes('आरंभीची शिल्लक'));
    if (isOpeningBal) return false;

    const query = searchQuery.toLowerCase();
    return (
      (t.accountNo && t.accountNo.toLowerCase().includes(query)) ||
      (t.customerName && t.customerName.toLowerCase().includes(query)) ||
      (t.transactionType && t.transactionType.toLowerCase().includes(query)) ||
      (t.voucherNo && t.voucherNo.toLowerCase().includes(query))
    );
  });

  const handlePassVoucher = async () => {
    const vId = passingVoucher?.voucherID || voucherIdFromUrl;
    const vNo = passingVoucher?.voucherNo || `Voucher #${vId}`;
    if (!vId) return;

    if (!window.confirm(`तुम्हाला बचत व्यवहार व्हाउचर क्र. ${vNo} पास व मंजूर करायचे आहे का?`)) {
      return;
    }

    setPassingActionLoading(true);
    try {
      const payload = {
        voucherIds: [Number(vId)],
        approvedBy: user?.userID || 1
      };

      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const scrollInfo = data.results && data.results[0] ? ` (Scroll No: ${data.results[0].scrollNo})` : '';
        alert(`बचत व्यवहार व्हाउचर क्र. ${vNo} यशस्वीरीत्या पास करण्यात आले!${scrollInfo}`);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        const errText = await res.text();
        alert(`त्रुटी: ${errText}`);
      }
    } catch {
      alert('व्हाउचर पास करताना नेटवर्क त्रुटी आली.');
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    const vId = passingVoucher?.voucherID || voucherIdFromUrl;
    const vNo = passingVoucher?.voucherNo || `Voucher #${vId}`;
    if (!vId) return;
    if (!rejectionReason.trim()) {
      alert('कृपया नामंजूर करण्याचे कारण लिहा.');
      return;
    }

    setPassingActionLoading(true);
    try {
      const res = await fetch(`/api/VoucherPosting/${vId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason.trim(),
          userId: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin'
        })
      });

      const resData = await res.json().catch(() => null);
      if (res.ok) {
        alert(resData?.message || `बचत व्हाउचर क्र. ${vNo} नामंजूर / रद्द करण्यात आले.`);
        setRejectModalOpen(false);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        alert(resData?.message || resData || 'व्हाउचर नामंजूर करताना त्रुटी आली.');
      }
    } catch {
      alert('व्हाउचर नामंजूर करताना नेटवर्क त्रुटी आली.');
    } finally {
      setPassingActionLoading(false);
    }
  };

  // Live Real-Time Projected Balance Calculations
  const txnAmountNum = parseFloat(formData.amount) || 0;
  const currentBalNum = Number(selectedAccount?.currentBalance ?? 0);
  const openingBalNum = Number(selectedAccount?.openingBalance ?? 0);
  const lienNum = Number(selectedAccount?.lienAmount ?? 0);
  const minBalNum = Number(selectedAccount?.minimumBalance ?? 0);
  const availableToWithdraw = Math.max(0, currentBalNum - lienNum - minBalNum);

  const targetCurrentBalNum = Number(selectedTargetAccount?.currentBalance ?? 0);
  const targetLienNum = Number(selectedTargetAccount?.lienAmount ?? 0);
  const targetMinBalNum = Number(selectedTargetAccount?.minimumBalance ?? 0);
  const targetAvailableToWithdraw = Math.max(0, targetCurrentBalNum - targetLienNum - targetMinBalNum);

  let simulatedBalance = currentBalNum;
  if (formData.transactionType === 'Deposit') {
    simulatedBalance = currentBalNum + txnAmountNum;
  } else if (formData.transactionType === 'Withdrawal' || formData.transactionType === 'Charges') {
    simulatedBalance = currentBalNum - txnAmountNum;
  }
  const isInsufficient = formData.transactionType === 'Withdrawal' && txnAmountNum > availableToWithdraw;
  const isTargetInsufficient =
    formData.transactionType === 'Deposit' &&
    formData.paymentMode === 'Transfer' &&
    Boolean(selectedTargetAccount) &&
    txnAmountNum > targetAvailableToWithdraw;

  // Compact Today Summary Metrics
  const todayTxns = transactions.filter((t) => t.transactionDate && t.transactionDate.startsWith(activeBusinessDate));
  const todayDepositSum = todayTxns
    .filter((t) => t.transactionType === 'Deposit' || t.transactionType === 'Interest')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const todayWithdrawalSum = todayTxns
    .filter((t) => t.transactionType === 'Withdrawal' || t.transactionType === 'Charges')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass =
    'w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium h-[30px]';

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-full flex flex-col bg-slate-50 text-[11px] font-sans pb-10">
      {/* 1. STANDARD CBS THEME HEADER BANNER (Matches VoucherPosting & Dynamic ERP Theme) */}
      <div className="bg-white px-3.5 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs shrink-0">
            <Wallet size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-1.5 flex-wrap">
              <span>बचत जमा व नावे नोंद</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">
                (Saving Deposit & Withdrawal)
              </span>
              {isPassingMode && (
                <span className="px-2 py-0.5 rounded-sm bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                  चेकर तपासणी मोड
                </span>
              )}
            </h1>
            <p className="text-[10.5px] text-gray-500 font-medium">
              बचत खाते रोख, बँक व अंतर्गत ट्रान्सफर जमा-नावे व्यवहार व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Recent Directory + Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              fetchTransactions();
              setShowTxnModal(true);
            }}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs h-[28px]"
            title="अलीकडील सर्व बचत व्यवहार यादी पहा"
          >
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>व्यवहार यादी ({filteredTransactions.length})</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={refreshing || loading}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-gray-700 border border-gray-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs h-[28px] disabled:opacity-50"
            title="खाती व व्यवहार ताजे करा (Refresh)"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">रीफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Passing Checker Verification Strip */}
      {isPassingMode && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-sm flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>व्हाउचर पासिंग तपासणी मोड (Read-Only)</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 font-semibold">
            <span className="bg-white text-primary px-2 py-0.5 rounded-sm font-mono font-bold border border-amber-300">
              व्हाउचर क्र.: {passingVoucher?.voucherNo || voucherIdFromUrl}
            </span>
            <span className="text-amber-950 font-mono">
              रक्कम: <b>₹{Number(formData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
            </span>
            <span className="bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded-sm text-[11px] font-bold">
              {formData.transactionType === 'Deposit' ? 'बचत जमा (Deposit)' : 'बचत नावे (Withdrawal)'}
            </span>
          </div>
        </div>
      )}

      {/* Compact Dismissible Alerts */}
      {error && (
        <div className="mb-2 p-2 bg-rose-50 border border-rose-300 text-rose-900 rounded-sm flex items-center justify-between gap-2 text-xs font-bold shadow-2xs">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-700 hover:text-rose-950 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-2 p-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-sm flex items-center justify-between gap-2 text-xs font-bold shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-700 hover:text-emerald-950 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {noAccountFoundAlert && (
        <div className="mb-2 p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-sm flex flex-wrap items-center justify-between gap-2 text-xs font-semibold shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{noAccountFoundAlert}</span>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('saving-account')}
              className="px-2.5 py-1 bg-primary hover:opacity-90 text-white rounded-sm text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
            >
              + नवीन बचत खाते उघडा
            </button>
          )}
        </div>
      )}

      {/* 2. MAIN WORKSPACE: ENTRY FORM + ACCOUNT BALANCE PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {/* LEFT: SAVING TRANSACTION ENTRY CARD (border-t-2 border-primary) */}
        <div className="lg:col-span-8 bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary flex flex-col overflow-hidden">
          {/* Card Strip: Form Title + Inline Today Summary Chips */}
          <div className="px-3.5 py-2 bg-slate-50/80 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="border-l-4 border-primary pl-2 text-primary font-bold text-xs">
                व्यवहार तपशील (Transaction Entry)
              </span>
              <span
                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border ${
                  formData.transactionType === 'Deposit'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {formData.transactionType === 'Deposit' ? 'जमा नोंद (Cr)' : 'नावे नोंद (Dr)'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
              <span className="px-2 py-0.5 rounded-sm bg-white border border-gray-300 text-gray-700 font-semibold">
                खाती: <b className="font-mono text-gray-900">{accounts.length}</b>
              </span>
              <span className="px-2 py-0.5 rounded-sm bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                आज जमा: <b className="font-mono">₹{todayDepositSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
              </span>
              <span className="px-2 py-0.5 rounded-sm bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                आज नावे: <b className="font-mono">₹{todayWithdrawalSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
              </span>
              {!isPassingMode && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-2 py-0.5 rounded-sm bg-white hover:bg-slate-100 text-gray-700 border border-gray-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title="फॉर्म रिकामा करा (Reset)"
                >
                  <RotateCcw className="w-3 h-3 text-primary" />
                  <span>रीसेट</span>
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <fieldset disabled={isPassingMode} className="contents space-y-3">
                {/* Deposit / Withdrawal Action Buttons inside Transaction Entry */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div className="inline-flex items-center p-1 bg-slate-100 border border-gray-200 rounded-sm gap-1">
                    <button
                      type="button"
                      disabled={isPassingMode}
                      onClick={() => setFormData((prev) => ({ ...prev, transactionType: 'Deposit' }))}
                      className={`px-4 py-1.5 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed ${
                        formData.transactionType === 'Deposit'
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-gray-700 hover:bg-slate-200/80'
                      }`}
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                      <span>जमा (Deposit)</span>
                    </button>

                    <button
                      type="button"
                      disabled={isPassingMode}
                      onClick={() => setFormData((prev) => ({ ...prev, transactionType: 'Withdrawal' }))}
                      className={`px-4 py-1.5 rounded-sm text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed ${
                        formData.transactionType === 'Withdrawal'
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-gray-700 hover:bg-slate-200/80'
                      }`}
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      <span>नावे (Withdrawal)</span>
                    </button>
                  </div>
                </div>

                {/* Row 1: Scheme Filter + Account Selection */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4">
                    <label className={labelClass}>बचत ठेव योजना / प्रकार (Scheme Filter)</label>
                    <select
                      value={selectedLedgerID}
                      onChange={handleLedgerChange}
                      disabled={isPassingMode}
                      className={inputClass}
                    >
                      <option value={0}>-- सर्व बचत योजना (All Schemes) --</option>
                      {ledgers.map((l) => (
                        <option key={l.ledgerID} value={l.ledgerID}>
                          {l.ledgerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-8">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[11px] font-bold text-gray-700">
                        बचत खाते निवडा (Select Saving Account) <span className="text-rose-600">*</span>
                      </label>
                      {customerMatchingAccounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setShowMultiAccountModal(true)}
                          className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 px-2 py-0.2 rounded-sm flex items-center gap-1 transition-all cursor-pointer"
                          title="या खातेदाराचे दुसरे बचत खाते निवडा"
                        >
                          <RotateCcw size={10} className="text-primary" />
                          <span>खाते बदला ({customerMatchingAccounts.length} खाती)</span>
                        </button>
                      )}
                    </div>
                    <SearchableSelect
                      options={accountOptions}
                      value={formData.savingAccountID}
                      onChange={handleAccountChange}
                      name="savingAccountID"
                      disabled={isPassingMode}
                      placeholder="-- खाते क्र., जुना क्र., CIF किंवा खातेदाराचे नाव शोधा --"
                    />
                  </div>
                </div>

                {/* Row 2: Date, Payment Mode, Amount, Ref No */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className={labelClass}>
                      व्यवहार दिनांक (Date) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      name="transactionDate"
                      value={formData.transactionDate}
                      readOnly={true}
                      disabled={true}
                      required
                      className="w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1 bg-slate-100 text-slate-800 font-mono font-bold h-[30px] cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      पेमेंट पद्धत (Mode) <span className="text-rose-600">*</span>
                    </label>
                    <select
                      name="paymentMode"
                      value={formData.paymentMode}
                      onChange={handleInputChange}
                      className={`${inputClass} font-bold`}
                    >
                      <option value="Cash">रोख (Cash)</option>
                      <option value="Bank">बँक ट्रान्सफर (Bank)</option>
                      <option value="Transfer">अंतर्गत ट्रान्सफर (Saving Transfer)</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>
                      रक्कम (Amount ₹) <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-primary">₹</span>
                      <input
                        ref={amountInputRef}
                        type="number"
                        name="amount"
                        step="0.01"
                        min="1"
                        value={formData.amount}
                        onChange={handleInputChange}
                        onWheel={(e) => e.currentTarget.blur()}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        required
                        className="w-full text-xs border border-gray-300 pl-6 pr-2.5 py-1 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-mono font-black h-[30px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>
                      {formData.paymentMode === 'Bank' ? 'चेक / UTR / संदर्भ क्र.' : 'संदर्भ क्र. (Ref No)'}
                    </label>
                    <input
                      type="text"
                      name="checkNo"
                      value={formData.checkNo}
                      onChange={handleInputChange}
                      placeholder={formData.paymentMode === 'Bank' ? 'CHQ / UTR क्र.' : 'ऐच्छिक संदर्भ क्र.'}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Row 3: Mode-Specific Reflection / Selection Sub-Panel (100% Theme-Matched) */}
                {formData.paymentMode === 'Cash' && (
                  <CashLedgerReflectBadge
                    transactionType={formData.transactionType === 'Deposit' ? 'Deposit' : 'Withdrawal'}
                  />
                )}

                {formData.paymentMode === 'Bank' &&
                  (() => {
                    const bankLedgerOptions = buildBankLedgerOptions(
                      bankLedgers,
                      formData.bankLedgerID,
                      isPassingMode ? allRawLedgers : undefined
                    );

                    return (
                      <div className="bg-slate-50/90 p-3 rounded-sm border border-gray-200 border-l-4 border-l-primary space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-primary" />
                            <h3 className="text-xs font-bold text-primary">
                              बँक जी.एल. खाते निवड (Bank GL Account) <span className="text-rose-600">*</span>
                            </h3>
                          </div>
                          <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-sm border border-primary/20">
                            {bankLedgers.length} बँक खाती उपलब्ध
                          </span>
                        </div>

                        {!isPassingMode && bankLedgers.length === 0 && (
                          <div className="p-2 bg-amber-50 border border-amber-300 rounded-sm text-[11px] text-amber-900 font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              कोणत्याही लेजरला <b>Bank Account</b> प्रकार दिलेला नाही. कृपया <b>Ledger Master</b> मध्ये बँक खात्याचा प्रकार निवडा.
                            </span>
                          </div>
                        )}

                        <SearchableSelect
                          options={bankLedgerOptions}
                          value={formData.bankLedgerID || ''}
                          onChange={handleBankLedgerChange}
                          name="bankLedgerID"
                          disabled={isPassingMode}
                          placeholder="-- लेजर क्र. किंवा बँक जी.एल. खात्याचे नाव शोधा --"
                        />
                      </div>
                    );
                  })()}

                {formData.paymentMode === 'Transfer' && (
                  <div className="bg-slate-50/90 p-3 rounded-sm border border-gray-200 border-l-4 border-l-primary space-y-2">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-primary" />
                      <h3 className="text-xs font-bold text-primary">
                        अंतर्गत हस्तांतरण टार्गेट बचत खाते (Target Saving Account)
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4">
                        <label className={labelClass}>टार्गेट बचत योजना</label>
                        <select
                          value={selectedTargetLedgerID}
                          onChange={handleTargetLedgerChange}
                          className={inputClass}
                        >
                          <option value={0}>-- सर्व योजना --</option>
                          {ledgers.map((l) => (
                            <option key={l.ledgerID} value={l.ledgerID}>
                              {l.ledgerName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-5">
                        <label className={labelClass}>
                          टार्गेट बचत खाते निवडा <span className="text-rose-600">*</span>
                        </label>
                        <SearchableSelect
                          options={targetAccountOptions}
                          value={formData.targetSavingAccountID}
                          onChange={handleTargetAccountChange}
                          name="targetSavingAccountID"
                          disabled={isPassingMode}
                          placeholder="-- टार्गेट बचत खाते निवडा --"
                        />
                      </div>

                      <div className="md:col-span-3">
                        {selectedTargetAccount ? (
                          <div
                            className={`border rounded-sm px-2.5 py-1.5 ${
                              isTargetInsufficient ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-white border-gray-300 text-gray-800'
                            }`}
                          >
                            <div className="text-[10px] font-bold truncate">{selectedTargetAccount.customerName}</div>
                            <div className="text-[11px] font-mono font-black text-primary">
                              शिल्लक: ₹{targetCurrentBalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            {formData.transactionType === 'Deposit' && (
                              <div className={`text-[9.5px] font-bold ${isTargetInsufficient ? 'text-rose-700' : 'text-emerald-700'}`}>
                                वर्गपात्र: ₹{targetAvailableToWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-[30px] px-2.5 border border-dashed border-gray-300 rounded-sm flex items-center text-[10.5px] text-gray-400">
                            टार्गेट शिल्लक येथे दिसेल
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 4: Narration */}
                <div>
                  <label className={labelClass}>तपशील (Narration)</label>
                  <input
                    type="text"
                    name="narration"
                    value={formData.narration}
                    onChange={handleInputChange}
                    placeholder="उदा. बचत खात्यात रोख भरणा / बँक ट्रान्सफर / अंतर्गत वर्ग"
                    className={inputClass}
                  />
                </div>
              </fieldset>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-3 mt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10.5px] text-gray-500">
                {isPassingMode
                  ? 'तपासणी करून व्हाउचर पास किंवा नामंजूर करा.'
                  : 'नोंद जतन केल्यावर व्हाउचर पासिंगसाठी प्रलंबित (Pending) यादीत जाईल.'}
              </span>

              <div className="flex items-center gap-2 ml-auto">
                {isPassingMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => (onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting'))}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-gray-700 font-bold rounded-sm text-xs border border-gray-300 cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-primary" />
                      <span>परत जा</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={passingActionLoading}
                      className="px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold rounded-sm text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>नामंजूर / रद्द करा</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePassVoucher}
                      disabled={passingActionLoading}
                      className="px-5 py-1.5 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{passingActionLoading ? 'पास होत आहे...' : 'व्हाउचर पास करा'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    disabled={loading || isInsufficient || isTargetInsufficient}
                    className="px-5 py-1.5 rounded-sm font-bold text-xs bg-primary hover:opacity-90 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save size={14} />
                    <span>
                      {loading
                        ? 'जतन करत आहे...'
                        : formData.transactionType === 'Deposit'
                          ? 'रक्कम जमा करा (Save Deposit)'
                          : 'रक्कम नावे करा (Save Withdrawal)'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT: THEME-MATCHED ACCOUNT INFO & LIVE BALANCE CARD (border-t-2 border-primary) */}
        <div className="lg:col-span-4 bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary flex flex-col overflow-hidden">
          <div className="px-3.5 py-2 bg-slate-50/80 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Wallet size={15} />
              <span>खाते माहिती व शिल्लक (Account Info)</span>
            </div>
            {selectedAccount && (
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-sm font-bold">
                {selectedAccount.branchName || 'मुख्य शाखा'}
              </span>
            )}
          </div>

          <div className="p-3 flex-1 flex flex-col justify-between space-y-2.5">
            {selectedAccount ? (
              <>
                <div className="bg-slate-50/70 rounded-sm p-2.5 border border-gray-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-500 font-semibold block">खातेदाराचे नाव</span>
                      <p className="font-bold text-xs sm:text-sm text-gray-900 truncate leading-snug">
                        {selectedAccount.customerName}
                      </p>
                      {selectedAccount.cifNo && (
                        <span className="inline-block mt-1 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded-sm border border-primary/20 font-mono">
                          CIF: {selectedAccount.cifNo}
                        </span>
                      )}
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-sm shrink-0 border ${
                        selectedAccount.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : selectedAccount.status === 'Frozen'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : selectedAccount.status === 'Dormant'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {selectedAccount.status === 'Active'
                        ? 'सक्रिय'
                        : selectedAccount.status === 'Frozen'
                          ? 'फ्रीझ'
                          : selectedAccount.status === 'Dormant'
                            ? 'सुप्त'
                            : 'बंद'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-200 flex flex-wrap justify-between items-start gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 block font-semibold">बचत खाते क्र.</span>
                      <span className="font-mono font-bold text-primary">{selectedAccount.accountNo}</span>
                      {(selectedAccount.oldAccountNo || selectedAccount.legacyAccountNumber) && (
                        <div className="text-[10px] text-amber-900 font-bold bg-amber-50 border border-amber-200 rounded-sm px-1.5 mt-0.5 inline-block">
                          जुना क्र.: {selectedAccount.oldAccountNo || selectedAccount.legacyAccountNumber}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 block font-semibold">ठेव योजना</span>
                      <span className="font-bold text-gray-800 text-[11px]">{selectedAccount.ledgerName || 'बचत ठेव'}</span>
                      {selectedAccount.openingDate && (
                        <span className="text-[10px] text-gray-500 block font-mono">
                          उघडले: {formatDisplayDate(selectedAccount.openingDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Clean 2x2 Balance Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-sm p-2 border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-bold block">आरंभीची शिल्लक</span>
                    <p className="font-bold text-xs text-gray-800 font-mono mt-0.5">
                      ₹{openingBalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div
                    className={`rounded-sm p-2 border ${
                      currentBalNum < minBalNum ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50/70 border-emerald-200'
                    }`}
                  >
                    <span className="text-[10px] text-gray-700 font-bold block">सध्याची चालू शिल्लक</span>
                    <p
                      className={`font-black text-xs sm:text-sm font-mono mt-0.5 ${
                        currentBalNum < minBalNum ? 'text-rose-700' : 'text-emerald-800'
                      }`}
                    >
                      ₹{currentBalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-white rounded-sm p-2 border border-gray-200">
                    <span className="text-[10px] text-gray-500 font-bold block">किमान शिल्लक मर्यादा</span>
                    <p className="font-bold text-xs text-gray-800 font-mono mt-0.5">
                      ₹{minBalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className={`rounded-sm p-2 border ${lienNum > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
                    <span className="text-[10px] text-gray-500 font-bold block">तारण होल्ड (Lien)</span>
                    <p className={`font-bold text-xs font-mono mt-0.5 ${lienNum > 0 ? 'text-amber-900 font-black' : 'text-gray-700'}`}>
                      ₹{lienNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Live Balance Simulation OR Theme-Matched Withdrawable Balance */}
                {txnAmountNum > 0 ? (
                  <div
                    className={`rounded-sm p-2.5 border transition-all ${
                      isInsufficient
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : 'bg-primary/10 border-primary/25 text-gray-900'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10.5px] font-bold pb-1 mb-1 border-b border-gray-300/60">
                      <span className={isInsufficient ? 'text-rose-800' : 'text-primary'}>
                        {formData.transactionType === 'Deposit' ? 'जमा सिम्युलेशन (+)' : 'नावे सिम्युलेशन (-)'}
                      </span>
                      <span className="font-mono">
                        ₹{txnAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">व्यवहारानंतर नवीन शिल्लक:</span>
                      <span className={`text-sm font-black font-mono ${isInsufficient ? 'text-rose-700' : 'text-primary'}`}>
                        ₹{simulatedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {isInsufficient && (
                      <div className="mt-1.5 text-[10px] font-bold text-rose-800 bg-white border border-rose-300 rounded-sm px-2 py-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>अपुरी शिल्लक! काढता येणारी कमाल रक्कम: ₹{availableToWithdraw.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-sm px-3 py-2 bg-primary/10 border border-primary/25 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-primary">काढता येणारी शिल्लक (Withdrawable)</span>
                    <span className="font-black text-sm text-primary font-mono">
                      ₹{availableToWithdraw.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-10 my-auto">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto mb-2">
                  <Wallet size={20} />
                </div>
                <p className="text-xs text-gray-700 font-bold">व्यवहारासाठी बचत खाते निवडा</p>
                <p className="text-[10.5px] text-gray-400 mt-0.5">खाते निवडल्यावर येथे सविस्तर शिल्लक दिसेल</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          RECENT SAVING TRANSACTIONS DIRECTORY MODAL (Theme-Matched)
          ======================================================== */}
      {showTxnModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-sm shadow-2xl border border-gray-300 w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                <h2 className="text-xs sm:text-sm font-bold">बचत जमा व नावे व्यवहार यादी (Recent Saving Transactions)</h2>
                <span className="bg-white/20 text-white text-[11px] px-2 py-0.2 rounded-full font-mono font-bold">
                  {filteredTransactions.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTxnModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
                title="बंद करा"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-3 py-2 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="नाव, खाते क्र. किंवा व्हाउचर क्र. शोधा..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-gray-300 pl-8 pr-6 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs w-full bg-white h-[28px]"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-600 font-semibold">
                एकूण नोंदी: <b className="text-primary font-mono">{filteredTransactions.length}</b>
              </span>
            </div>

            <div className="overflow-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200 text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 sticky top-0 z-10 font-bold">
                  <tr>
                    <th className="px-2 py-2 border-r border-gray-200 text-center w-12">#</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 text-left w-24">दिनांक</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 text-left">खाते क्र.</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 text-left">खातेदाराचे नाव</th>
                    <th className="px-2 py-2 border-r border-gray-200 text-center w-20">प्रकार</th>
                    <th className="px-2 py-2 border-r border-gray-200 text-center w-24">पद्धत</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 text-right w-28">रक्कम (₹)</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 text-right w-28">शिल्लक (₹)</th>
                    <th className="px-2.5 py-2 border-r border-gray-200 text-left">तपशील</th>
                    <th className="px-2.5 py-2 text-left w-32">व्हाउचर क्र.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-gray-500 font-semibold">
                        कोणतेही व्यवहार आढळले नाहीत.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t: any, index: number) => (
                      <tr key={t.transactionID} className="hover:bg-slate-50 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500 font-mono">
                          {index + 1}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-left whitespace-nowrap text-gray-700">
                          {new Date(t.transactionDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-left font-bold text-primary font-mono whitespace-nowrap">
                          {t.accountNo}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-left font-semibold text-gray-900">
                          {t.customerName}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm border ${
                              t.transactionType === 'Deposit' || t.transactionType === 'Interest'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {t.transactionType === 'Deposit'
                              ? 'जमा'
                              : t.transactionType === 'Withdrawal'
                                ? 'नावे'
                                : t.transactionType}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap font-semibold text-gray-700">
                          {t.paymentMode === 'Cash' ? 'रोख' : t.paymentMode === 'Transfer' ? 'ट्रान्सफर' : 'बँक'}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-bold text-gray-900 font-mono whitespace-nowrap">
                          ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                          ₹{t.balanceAfterTxn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-left text-gray-600 max-w-[200px] truncate" title={t.narration || ''}>
                          {t.narration || '-'}
                        </td>
                        <td className="px-2.5 py-1.5 text-left font-bold text-primary whitespace-nowrap font-mono">
                          {t.voucherNo || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2 bg-slate-50 border-t border-gray-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowTxnModal(false)}
                className="bg-primary hover:opacity-90 text-white px-4 py-1.5 rounded-sm text-xs font-bold cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MULTI-ACCOUNT SELECTION MODAL (Theme-Matched)
          ======================================================== */}
      {showMultiAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3">
          <div className="bg-white rounded-sm shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-300">
            <div className="bg-primary px-4 py-2.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-white" />
                <div>
                  <h3 className="font-bold text-xs sm:text-sm leading-tight">बचत खाते निवडा (Select Saving Account)</h3>
                  <p className="text-[10.5px] text-white/85">
                    {multiAccountCustomerInfo?.name || 'खातेदार'}{' '}
                    {multiAccountCustomerInfo?.cifNo ? `(CIF: ${multiAccountCustomerInfo.cifNo})` : ''} — एकूण{' '}
                    {customerMatchingAccounts.length} खाती उपलब्ध
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMultiAccountModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 max-h-[68vh] overflow-y-auto space-y-2 bg-slate-50">
              {customerMatchingAccounts.map((acc, idx) => {
                const isCurrent = formData.savingAccountID === acc.savingAccountID;
                const displayAccNo = acc.accountNo ? format14DigitDisplay(acc.accountNo) : '-';
                const oldAcc = acc.oldAccountNo || acc.legacyAccountNumber;
                const schemeName = acc.ledgerName || 'सर्वसाधारण बचत ठेव';

                return (
                  <div
                    key={acc.savingAccountID || idx}
                    onClick={() => handleSelectCustomerAccount(acc)}
                    className={`p-3 rounded-sm border transition-all cursor-pointer flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-primary/5 border-primary ring-1 ring-primary/30'
                        : 'bg-white border-gray-200 hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-sm flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                          isCurrent ? 'bg-primary text-white' : 'bg-slate-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-primary">{displayAccNo}</span>
                          {oldAcc && oldAcc !== acc.accountNo && (
                            <span className="text-[10px] bg-amber-50 text-amber-900 px-1.5 py-0.2 rounded-sm border border-amber-200 font-semibold">
                              जुना: {oldAcc}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {acc.status || 'Active'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600 mt-0.5">
                          योजना: <b className="text-gray-800">{schemeName}</b>
                          {acc.openingDate && (
                            <span className="text-gray-400 ml-2">(उघडले: {formatDisplayDate(acc.openingDate)})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="sm:text-right">
                        <div className="text-[10px] text-gray-500 font-bold">चालू शिल्लक</div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700 font-mono">
                          ₹{(acc.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCustomerAccount(acc);
                        }}
                        className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                          isCurrent
                            ? 'bg-primary text-white'
                            : 'bg-white hover:bg-primary hover:text-white text-primary border border-primary/40'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{isCurrent ? 'निवडलेले' : 'निवडा'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white px-4 py-2 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMultiAccountModal(false)}
                className="px-3.5 py-1 bg-slate-100 hover:bg-slate-200 text-gray-700 border border-gray-300 rounded-sm text-xs font-bold cursor-pointer"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          REJECTION REASON MODAL (Theme-Matched)
          ======================================================== */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3">
          <div className="bg-white rounded-sm shadow-2xl max-w-md w-full overflow-hidden border border-gray-300">
            <div className="bg-primary px-4 py-2.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs">
                <Trash2 className="w-4 h-4" />
                <span>बचत व्हाउचर नामंजूर / रद्द करणे (Reject & Rollback)</span>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="bg-slate-50 border border-gray-200 rounded-sm px-3 py-2 flex justify-between items-center">
                <span className="text-gray-600 font-semibold">व्हाउचर क्र.:</span>
                <b className="font-mono text-primary">{passingVoucher?.voucherNo || voucherIdFromUrl}</b>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  नामंजूर करण्याचे कारण (Reason) <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="उदा. चुकीची रक्कम किंवा चुकीचे खाते निवडले..."
                  rows={3}
                  className="w-full text-xs border border-gray-300 rounded-sm p-2 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-sm text-xs font-bold cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleRejectVoucher}
                disabled={passingActionLoading || !rejectionReason.trim()}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{passingActionLoading ? 'रद्द होत आहे...' : 'खात्रीपूर्वक नामंजूर करा'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingTransactionEntry;

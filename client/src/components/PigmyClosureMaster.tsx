import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, resolveWriteBranchId } from '../utils/branchAccess';
import BankLedgerSelect from './common/BankLedgerSelect';
import SearchableSelect, { SearchableSelectOption } from './SearchableSelect';
import {
  ShieldExclamationIcon,
  ArrowPathIcon,
  BanknotesIcon,
  XCircleIcon,
  PrinterIcon,
  CheckCircleIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';

interface ActiveLoan {
  loanAccountId: number;
  loanAccountNo: string;
  loanType: string;
  principalBalance: number;
  interestBalance?: number;
  accruedInterest?: number;
  overduePenaltyBalance?: number;
  overdueInterest: number;
  totalOutstanding: number;
  isDirectLienLoan?: boolean;
}

interface ClosurePreview {
  pigmyAccountId: number;
  customerId?: number;
  branchId?: number;
  accountNo: string;
  legacyAccountNumber?: string;
  customerName?: string;
  memberName?: string;
  cifNo?: string;
  schemeName?: string;
  agentName?: string;
  businessDate?: string;
  openingDate: string;
  maturityDate: string;
  cycleStartDate: string;
  currentCycleNumber: number;
  tenureDaysInCycle: number;
  tenureMonthsInCycle: number;
  totalDepositedAmount: number;
  totalWithdrawnAmount: number;
  alreadyCapitalizedInterest?: number;
  verifiedProvisionedInterest?: number;
  isPremature: boolean;
  prematurePenaltyRate: number;
  prematurePenaltyAmount: number;
  prematureInterestRate: number;
  grossSlabInterestAmount?: number;
  prematureInterestAmount: number;
  netPayable: number;
  policyNote: string;
  calculationMethodLabel?: string;
  hasDirectLien?: boolean;
  directLienLoanAccountId?: number | null;
  directLienLoanNo?: string | null;
  directLienAmount?: number;
  hasActiveLoanLien: boolean;
  totalLoanLiability: number;
  activeLoans: ActiveLoan[];
  schemeLiabilityLedgerId?: number | null;
  schemeLiabilityLedgerName?: string | null;
  schemePrematureDeductionLedgerId?: number | null;
  schemePrematureDeductionLedgerName?: string | null;
  schemeInterestExpenseLedgerId?: number | null;
  schemeInterestExpenseLedgerName?: string | null;
  schemeInterestPayableLedgerId?: number | null;
  schemeInterestPayableLedgerName?: string | null;
  schemeCommissionExpenseLedgerId?: number | null;
  schemeCommissionExpenseLedgerName?: string | null;
}

interface WithdrawalPreview {
  pigmyAccountId: number;
  customerId?: number;
  branchId?: number;
  accountNo: string;
  legacyAccountNumber?: string;
  customerName?: string;
  memberName: string;
  cifNo: string;
  schemeName?: string;
  currentBalance: number;
  requestedAmount: number;
  currentCycleNumber: number;
  cycleStartDate: string;
  elapsedDays: number;
  elapsedMonths: number;
  appliedPenaltyRate: number;
  appliedPenaltyAmount: number;
  appliedInterestRate: number;
  appliedInterestAmount: number;
  netPaidAmount: number;
  remainingBalance: number;
  policyNote: string;
  calculationMethodLabel?: string;
  nextCycleStartDate: string;
  fixedMaturityDate: string;
  hasDirectLien?: boolean;
  directLienLoanAccountId?: number | null;
  directLienLoanNo?: string | null;
  directLienAmount?: number;
  freeWithdrawableBalance?: number;
  hasActiveLoanLien: boolean;
  totalLoanLiability: number;
  activeLoans: ActiveLoan[];
  schemeLiabilityLedgerId?: number | null;
  schemeLiabilityLedgerName?: string | null;
  schemePrematureDeductionLedgerId?: number | null;
  schemePrematureDeductionLedgerName?: string | null;
  schemeInterestExpenseLedgerId?: number | null;
  schemeInterestExpenseLedgerName?: string | null;
  schemeInterestPayableLedgerId?: number | null;
  schemeInterestPayableLedgerName?: string | null;
  schemeCommissionExpenseLedgerId?: number | null;
  schemeCommissionExpenseLedgerName?: string | null;
}

interface WithdrawalHistoryItem {
  withdrawalID: number;
  withdrawalDate: string;
  cycleNumber: number;
  cycleStartSnapshot: string;
  elapsedDays: number;
  elapsedMonths: number;
  requestedAmount: number;
  penaltyRate: number;
  penaltyAmount: number;
  interestRate: number;
  interestAmount: number;
  netPaidAmount: number;
  remainingBalance: number;
  paymentMode?: string;
  adjustInLoan?: boolean;
  loanAdjustedAmount?: number;
  surplusPayoutAmount?: number;
  voucherNo?: string;
  narration?: string;
  deductionLedgerName?: string;
  slabDescription?: string;
}

interface LedgerItem {
  ledgerID: number;
  ledgerName: string;
  accountType?: string;
  isActive?: boolean;
  accountGroup?: {
    groupID?: number;
    groupName?: string;
    natureOfGroup?: string;
  };
}

interface ReceiptSnapshot {
  type: 'Withdrawal' | 'Closure';
  date: string;
  accountNo: string;
  legacyAccountNo?: string;
  customerName: string;
  cifNo?: string;
  schemeName?: string;
  cycleNumber: number;
  principalAmount: number;
  penaltyAmount: number;
  deductionLedgerName?: string;
  interestAmount: number;
  loanAdjustedAmount: number;
  targetLoanNo?: string;
  surplusPayoutAmount: number;
  surplusPaymentMode?: string;
  netPayableAmount: number;
  remainingBalance: number;
  paymentMode: string;
  voucherNo: string;
  narration?: string;
}

type PaymentModeOption = 'Cash' | 'Bank' | 'Saving Transfer' | 'Adjust in Loan';
type SurplusModeOption = 'Cash' | 'Bank' | 'Saving Transfer';

interface PigmyClosureMasterProps {
  voucherId?: number;
  isPassingMode?: boolean;
  onNavigate?: (tab: string, subTab?: string) => void;
}

const isCashOrBankLedger = (l: LedgerItem): boolean => {
  const accType = (l.accountType || '').trim().toLowerCase();
  if (['cash', 'cash in hand', 'bank', 'bank account', 'bank accounts'].includes(accType)) return true;
  const gName = (l.accountGroup?.groupName || '').trim().toLowerCase();
  if (gName.includes('रोकड') || gName.includes('बँकेतील शिल्लक') || gName.includes('cash') || gName.includes('bank')) return true;
  return false;
};

const PigmyClosureMaster: React.FC<PigmyClosureMasterProps> = ({
  voucherId: propVoucherId,
  isPassingMode: propIsPassingMode,
  onNavigate
}) => {
  const { user, globalBranchId } = useAuth();
  const queryParams = new URLSearchParams(window.location.search);
  const voucherId = propVoucherId || (queryParams.get('voucherId') ? parseInt(queryParams.get('voucherId')!, 10) : undefined);
  const isPassingMode = propIsPassingMode ?? (queryParams.get('passingMode') === 'true');

  const [passingVoucherData, setPassingVoucherData] = useState<any>(null);
  const [passingDetailsData, setPassingDetailsData] = useState<any>(null);
  const [passingAccountData, setPassingAccountData] = useState<any>(null);
  const [passingLoading, setPassingLoading] = useState<boolean>(false);
  const [passingActionLoading, setPassingActionLoading] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'withdrawal' | 'closure'>('withdrawal');
  const [accountNo, setAccountNo] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [pigmyAccounts, setPigmyAccounts] = useState<any[]>([]);
  const [pigmyAgents, setPigmyAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number>(0);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [allLedgers, setAllLedgers] = useState<LedgerItem[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  // Previews
  const [closurePreview, setClosurePreview] = useState<ClosurePreview | null>(null);
  const [withdrawalPreview, setWithdrawalPreview] = useState<WithdrawalPreview | null>(null);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalHistoryItem[]>([]);

  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];

  // Form States
  const [transactionDate, setTransactionDate] = useState<string>(activeBusinessDate);
  const [narration, setNarration] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentModeOption>('Cash');
  const [bankLedgerId, setBankLedgerId] = useState<number>(0);
  const [savingAccountId, setSavingAccountId] = useState<number>(0);
  const [customerSavingAccounts, setCustomerSavingAccounts] = useState<any[]>([]);
  const [referenceNo, setReferenceNo] = useState<string>('');

  // Editable Commission/Penalty & Interest Amount States (GL Ledgers are strictly resolved from Pigmy Scheme Master)
  const [customPenaltyAmount, setCustomPenaltyAmount] = useState<string>('');
  const [customInterestAmount, setCustomInterestAmount] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');

  // Loan Adjustment & Surplus Payout States
  const [targetLoanAccountId, setTargetLoanAccountId] = useState<number>(0);
  const [loanAdjustAmountInput, setLoanAdjustAmountInput] = useState<string>('');
  const [surplusPaymentMode, setSurplusPaymentMode] = useState<SurplusModeOption>('Cash');
  const [surplusBankLedgerId, setSurplusBankLedgerId] = useState<number>(0);
  const [surplusSavingAccountId, setSurplusSavingAccountId] = useState<number>(0);

  const [managerOverride, setManagerOverride] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptModalData, setReceiptModalData] = useState<ReceiptSnapshot | null>(null);

  useEffect(() => {
    if (user?.businessDate) {
      setTransactionDate(user.businessDate.split('T')[0]);
    }
  }, [user?.businessDate]);

  useEffect(() => {
    api.get('/api/Ledgers')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data.filter((l: any) => l.isActive !== false) : [];
        setAllLedgers(list);
      })
      .catch((err) => console.error('Failed to load ledgers:', err));

    api.get('/api/SansthaDetails')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) setSansthaDetail(res.data[0]);
        else if (res.data) setSansthaDetail(res.data);
      })
      .catch(() => {});
  }, []);

  const fetchCustomerSavingAccounts = async (custId?: number, cif?: string) => {
    try {
      const url = custId && custId > 0 ? `/api/SavingAccounts?customerId=${custId}` : '/api/SavingAccounts';
      const res = await api.get(url);
      let list = Array.isArray(res.data) ? res.data.filter((s: any) => s.status === 'Active') : [];
      if ((!custId || custId <= 0) && cif) {
        const cleanCif = cif.trim().toUpperCase();
        const cifFiltered = list.filter((s: any) => String(s.cifNo || s.customer?.cifNo || '').trim().toUpperCase() === cleanCif);
        if (cifFiltered.length > 0) list = cifFiltered;
      }
      setCustomerSavingAccounts(list);
      if (list.length > 0) {
        setSavingAccountId(list[0].savingAccountID);
        setSurplusSavingAccountId(list[0].savingAccountID);
      } else {
        setSavingAccountId(0);
        setSurplusSavingAccountId(0);
      }
    } catch (e) {
      console.error('Failed to load saving accounts for Pigmy transfer:', e);
      setCustomerSavingAccounts([]);
      setSavingAccountId(0);
      setSurplusSavingAccountId(0);
    }
  };

  const applySchemeDefaultsFromPreview = (preview: ClosurePreview | WithdrawalPreview, isClosureTab: boolean) => {
    if (isClosureTab) {
      const cp = preview as ClosurePreview;
      setCustomPenaltyAmount(String(cp.prematurePenaltyAmount ?? 0));
      setCustomInterestAmount(String(cp.prematureInterestAmount ?? 0));
      if (cp.hasDirectLien) {
        setPaymentMode('Adjust in Loan');
        const directId = cp.directLienLoanAccountId || cp.activeLoans?.[0]?.loanAccountId || 0;
        setTargetLoanAccountId(directId);
        const selLoan = cp.activeLoans?.find((l) => l.loanAccountId === directId) || cp.activeLoans?.[0];
        if (selLoan) {
          const maxAdj = Math.min(cp.netPayable, selLoan.totalOutstanding);
          setLoanAdjustAmountInput(maxAdj.toFixed(2));
        }
      } else {
        setPaymentMode('Cash');
        setTargetLoanAccountId(cp.activeLoans?.[0]?.loanAccountId || 0);
        setLoanAdjustAmountInput('');
      }
    } else {
      const wp = preview as WithdrawalPreview;
      setCustomPenaltyAmount(String(wp.appliedPenaltyAmount ?? 0));
      setCustomInterestAmount(String(wp.appliedInterestAmount ?? 0));
      const directId = wp.directLienLoanAccountId || wp.activeLoans?.[0]?.loanAccountId || 0;
      setTargetLoanAccountId(directId);
      const selLoan = wp.activeLoans?.find((l) => l.loanAccountId === directId) || wp.activeLoans?.[0];
      if (selLoan && paymentMode === 'Adjust in Loan') {
        setLoanAdjustAmountInput(Math.min(wp.netPaidAmount, selLoan.totalOutstanding).toFixed(2));
      }
    }
    setOverrideReason('');
  };

  const loadPassingClosure = async (vId: number) => {
    setPassingLoading(true);
    try {
      const res = await api.get(`/api/PigmyClosure/by-voucher/${vId}`);
      const { pigmyAccount, closureDetails, voucher } = res.data;
      setPassingVoucherData(voucher);
      setPassingDetailsData(closureDetails);
      setPassingAccountData(pigmyAccount);

      if (pigmyAccount?.accountNo) {
        setAccountNo(pigmyAccount.accountNo);
        if (closureDetails?.closureType === 'Withdrawal') {
          setActiveTab('withdrawal');
          setWithdrawalAmount(String(closureDetails.requestedAmount ?? ''));
        } else {
          setActiveTab('closure');
        }
        if (closureDetails?.narration) {
          setNarration(closureDetails.narration);
        }
        fetchWithdrawalsHistory(pigmyAccount.accountNo);
      }
    } catch (err: any) {
      console.error('Error loading Pigmy closure voucher:', err);
      toast.error('व्हाउचर लोड करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    if (!window.confirm('आपण खात्रीपूर्वक हे पिग्मी व्हाउचर मंजूर व पास करू इच्छिता?')) return;
    setPassingActionLoading(true);
    try {
      await api.post('/api/VoucherPosting/Post', {
        voucherIds: [voucherId],
        approvedBy: user?.userID || 1,
        businessDate: activeBusinessDate
      });
      toast.success('व्हाउचर यशस्वीरीत्या मंजूर व पास करण्यात आले!');
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      toast.error('व्हाउचर पास करताना त्रुटी: ' + (err.response?.data?.message || err.response?.data || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    if (!voucherId) return;
    if (!rejectReason.trim()) {
      toast.error('कृपया नामंजूर / रद्द करण्याचे कारण नमूद करा.');
      return;
    }
    setPassingActionLoading(true);
    try {
      await api.delete(`/api/VoucherPosting/${voucherId}?reason=${encodeURIComponent(rejectReason.trim())}`);
      toast.success('व्हाउचर यशस्वीरित्या नामंजूर / रद्द करून खात्याची स्थिती पूर्ववत करण्यात आली!');
      setRejectModalOpen(false);
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      toast.error('व्हाउचर रद्द करताना त्रुटी: ' + (err.response?.data?.message || err.response?.data || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  useEffect(() => {
    if (voucherId) {
      loadPassingClosure(voucherId);
    }
  }, [voucherId]);

  const fetchWithdrawalsHistory = async (accNo: string) => {
    try {
      const res = await api.get(`/api/PigmyClosure/WithdrawalsHistory/${encodeURIComponent(accNo.trim())}`);
      setWithdrawalHistory(res.data || []);
    } catch {
      setWithdrawalHistory([]);
    }
  };

  const fetchActivePigmyAccounts = async (autoSelectFromUrl = false) => {
    setAccountsLoading(true);
    try {
      const effBranch = getEffectiveBranchId(user, globalBranchId);
      const branchQuery = typeof effBranch === 'number' && effBranch > 0 ? { branchId: effBranch } : {};
      const [accRes, agRes] = await Promise.all([
        api.get('/api/PigmyAccounts', {
          params: { excludeClosed: true, sortOrder: 'asc', ...branchQuery }
        }),
        api.get('/api/PigmyAgents').catch(() => ({ data: [] }))
      ]);

      const rawAccs = Array.isArray(accRes.data) ? accRes.data.filter((a: any) => a.status !== 'Closed') : [];
      rawAccs.sort((a: any, b: any) => {
        const aLeg = String(a.legacyAccountNumber || a.oldAccountNo || '').trim();
        const bLeg = String(b.legacyAccountNumber || b.oldAccountNo || '').trim();
        if (aLeg && bLeg) return aLeg.localeCompare(bLeg, undefined, { numeric: true, sensitivity: 'base' });
        if (aLeg && !bLeg) return -1;
        if (!aLeg && bLeg) return 1;
        return String(a.accountNo || '').localeCompare(String(b.accountNo || ''), undefined, { numeric: true });
      });
      setPigmyAccounts(rawAccs);

      const rawAgents = Array.isArray(agRes.data) ? agRes.data : [];
      const filteredAgents = typeof effBranch === 'number' && effBranch > 0
        ? rawAgents.filter((ag: any) => !ag.branchID || Number(ag.branchID) === effBranch)
        : rawAgents;
      setPigmyAgents(filteredAgents);

      if (autoSelectFromUrl && !voucherId && rawAccs.length > 0) {
        const urlParams = new URLSearchParams(window.location.search);
        const targetAccNo = (urlParams.get('accountNo') || '').trim();
        const targetAccId = parseInt(urlParams.get('accountId') || '0', 10);
        const targetCustId = parseInt(urlParams.get('customerId') || '0', 10);
        const targetCif = (urlParams.get('cifNo') || '').trim().toUpperCase();

        if (targetAccNo || targetAccId > 0 || targetCustId > 0 || targetCif) {
          const matched = rawAccs.find((a: any) =>
            (targetAccNo && (a.accountNo === targetAccNo || a.legacyAccountNumber === targetAccNo || a.oldAccountNo === targetAccNo)) ||
            (targetAccId > 0 && Number(a.pigmyAccountID) === targetAccId) ||
            (targetCustId > 0 && Number(a.customerID) === targetCustId) ||
            (targetCif && String(a.customer?.cifNo || '').trim().toUpperCase() === targetCif)
          );
          if (matched?.accountNo) {
            setAccountNo(matched.accountNo);
            handleSearch(matched.accountNo);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load active Pigmy accounts:', err);
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    if (!isPassingMode) {
      fetchActivePigmyAccounts(true);
    }
  }, [globalBranchId, user?.branchID, isPassingMode]);

  const accountOptions: SearchableSelectOption[] = useMemo(() => {
    const baseList = selectedAgentId > 0
      ? pigmyAccounts.filter((a: any) => Number(a.pigmyAgentID) === selectedAgentId)
      : pigmyAccounts;

    return baseList.map((a: any) => {
      const custName = (
        a.customerName ||
        a.fullName ||
        [a.customer?.firstName, a.customer?.middleName, a.customer?.lastName].filter(Boolean).join(' ')
      ).trim() || 'पिग्मी खातेदार';
      const engName = [a.customer?.firstNameEng, a.customer?.middleNameEng, a.customer?.lastNameEng].filter(Boolean).join(' ').trim();
      const legacyNo = String(a.legacyAccountNumber || a.oldAccountNo || a.previousAccountNo || '').trim();
      const dispNo = String(a.formattedAccountNo || a.accountNo || '').trim();
      const cif = String(a.customer?.cifNo || '').trim();
      const scheme = String(a.pigmyScheme?.schemeName || '').trim();
      const agent = String(a.pigmyAgent?.agentName || '').trim();
      const mobile = String(a.customer?.mobileNo || '').trim();
      const bal = Number(a.totalDepositedAmount || 0);

      return {
        value: String(a.accountNo || ''),
        label: `${custName} — ${dispNo}${legacyNo ? ` [जुना क्र.: ${legacyNo}]` : ''}`,
        subLabel: [
          cif ? `CIF: ${cif}` : '',
          scheme ? `योजना: ${scheme}` : '',
          agent ? `एजंट: ${agent}` : '',
          mobile ? `मो.: ${mobile}` : '',
          engName
        ].filter(Boolean).join(' • '),
        badge: `शिल्लक: ₹ ${bal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-300'
      };
    });
  }, [pigmyAccounts, selectedAgentId]);

  const handleSearch = async (overrideAccNo?: string | React.MouseEvent | React.KeyboardEvent) => {
    const lookupNo = (typeof overrideAccNo === 'string' ? overrideAccNo : accountNo).trim();
    if (!lookupNo) return;
    setLoading(true);
    setMessage('');
    setClosurePreview(null);
    setWithdrawalPreview(null);
    setWithdrawalHistory([]);
    setManagerOverride(false);

    try {
      const effBranch = getEffectiveBranchId(user, globalBranchId);
      const previewParams: any = { asOfDate: transactionDate };
      if (typeof effBranch === 'number' && effBranch > 0) previewParams.branchId = effBranch;

      const [cRes, hRes] = await Promise.all([
        api.get(`/api/PigmyClosure/Preview/${encodeURIComponent(lookupNo)}`, { params: previewParams }),
        api.get(`/api/PigmyClosure/WithdrawalsHistory/${encodeURIComponent(lookupNo)}`).catch(() => ({ data: [] }))
      ]);
      setClosurePreview(cRes.data);
      if (cRes.data?.accountNo) setAccountNo(cRes.data.accountNo);
      setWithdrawalHistory(hRes.data || []);
      fetchCustomerSavingAccounts(cRes.data?.customerId, cRes.data?.cifNo);
      applySchemeDefaultsFromPreview(cRes.data, activeTab === 'closure');
      toast.success('पिग्मी खाते माहिती व सायकल इतिहास लोड झाला.');
    } catch (error: any) {
      const errMsg = error.response?.data?.message || error.response?.data || 'खाते शोधताना त्रुटी आली किंवा खाते सापडले नाही.';
      setMessage(typeof errMsg === 'string' ? errMsg : 'खाते शोधताना त्रुटी आली.');
      toast.error(typeof errMsg === 'string' ? errMsg : 'खाते शोधताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewWithdrawal = async (amountToTest?: number) => {
    const amt = amountToTest ?? parseFloat(withdrawalAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('कृपया वैध विड्रॉल रक्कम टाका.');
      return;
    }
    if (closurePreview && amt > closurePreview.totalDepositedAmount) {
      toast.error(`खात्यात फक्त ₹${closurePreview.totalDepositedAmount.toLocaleString('en-IN')} जमा आहेत.`);
      return;
    }

    setLoading(true);
    try {
      const effBranch = getEffectiveBranchId(user, globalBranchId);
      const wdrParams: any = { amount: amt, asOfDate: transactionDate };
      if (typeof effBranch === 'number' && effBranch > 0) wdrParams.branchId = effBranch;

      const res = await api.get(`/api/PigmyClosure/PreviewWithdrawal/${encodeURIComponent(accountNo.trim())}`, {
        params: wdrParams
      });
      setWithdrawalPreview(res.data);
      applySchemeDefaultsFromPreview(res.data, false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'विड्रॉल तपासताना त्रुटी आली.';
      toast.error(typeof msg === 'string' ? msg : 'विड्रॉल तपासताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // Live computed settlement numbers for active tab
  const activePrincipal = activeTab === 'closure'
    ? (closurePreview?.totalDepositedAmount || 0)
    : (withdrawalPreview?.requestedAmount || 0);

  const defaultPenalty = activeTab === 'closure'
    ? (closurePreview?.prematurePenaltyAmount || 0)
    : (withdrawalPreview?.appliedPenaltyAmount || 0);

  const defaultInterest = activeTab === 'closure'
    ? (closurePreview?.prematureInterestAmount || 0)
    : (withdrawalPreview?.appliedInterestAmount || 0);

  const effectivePenalty = Math.max(0, Math.round((parseFloat(customPenaltyAmount) || 0) * 100) / 100);
  const effectiveInterest = Math.max(0, Math.round((parseFloat(customInterestAmount) || 0) * 100) / 100);
  const effectiveNetPayable = Math.max(0, Math.round((activePrincipal - effectivePenalty + effectiveInterest) * 100) / 100);
  const effectivePenaltyPct = activePrincipal > 0 ? ((effectivePenalty / activePrincipal) * 100).toFixed(2) : '0.00';

  const isAmountOverridden =
    Math.abs(effectivePenalty - defaultPenalty) > 0.009 ||
    Math.abs(effectiveInterest - defaultInterest) > 0.009;

  const activeLoanList = (activeTab === 'closure' ? closurePreview?.activeLoans : withdrawalPreview?.activeLoans) || closurePreview?.activeLoans || [];
  const selectedLoan = activeLoanList.find((l) => l.loanAccountId === targetLoanAccountId) || activeLoanList[0] || null;
  const maxLoanAdjustable = selectedLoan ? Math.min(effectiveNetPayable, selectedLoan.totalOutstanding) : 0;
  const effectiveLoanAdjustAmount = paymentMode === 'Adjust in Loan' && selectedLoan
    ? Math.min(
        Math.max(0, loanAdjustAmountInput !== '' ? (parseFloat(loanAdjustAmountInput) || 0) : maxLoanAdjustable),
        maxLoanAdjustable
      )
    : 0;
  const effectiveSurplusAmount = paymentMode === 'Adjust in Loan'
    ? Math.max(0, Math.round((effectiveNetPayable - effectiveLoanAdjustAmount) * 100) / 100)
    : 0;

  // Sync Loan Adjustment amount when NetPayable or Target Loan changes
  useEffect(() => {
    if (paymentMode === 'Adjust in Loan' && selectedLoan) {
      const maxAdj = Math.min(effectiveNetPayable, selectedLoan.totalOutstanding);
      if (activeTab === 'closure' && closurePreview?.hasDirectLien) {
        setLoanAdjustAmountInput(maxAdj.toFixed(2));
      } else if (!loanAdjustAmountInput || parseFloat(loanAdjustAmountInput) > maxAdj) {
        setLoanAdjustAmountInput(maxAdj.toFixed(2));
      }
    }
  }, [paymentMode, targetLoanAccountId, effectiveNetPayable]);

  const resolveLedgerNameById = (id?: number | null, fallback?: string | null) => {
    if (!id || id <= 0) return fallback || 'मॅप नाही (Unmapped)';
    const found = allLedgers.find((l) => l.ledgerID === id);
    return found ? `${found.ledgerName} (#${found.ledgerID})` : (fallback || `Ledger #${id}`);
  };

  // Scheme-mapped GL Ledgers resolved automatically from PigmyScheme Master
  const activePreviewObj = activeTab === 'closure' ? closurePreview : withdrawalPreview;
  const schemeDeductionLedgerId = activePreviewObj?.schemePrematureDeductionLedgerId || 0;
  const schemeDeductionLedgerName = activePreviewObj?.schemePrematureDeductionLedgerName || '';
  const hasProvisionCoverage =
    activeTab === 'closure' &&
    (closurePreview?.verifiedProvisionedInterest || 0) >= effectiveInterest &&
    !!closurePreview?.schemeInterestPayableLedgerId;
  const schemeInterestLedgerId = hasProvisionCoverage
    ? (closurePreview?.schemeInterestPayableLedgerId || 0)
    : (activePreviewObj?.schemeInterestExpenseLedgerId || 0);
  const schemeInterestLedgerName = hasProvisionCoverage
    ? (closurePreview?.schemeInterestPayableLedgerName || '')
    : (activePreviewObj?.schemeInterestExpenseLedgerName || '');

  // Live Voucher Preview Lines
  const voucherPreviewLines = useMemo(() => {
    const activePreview = activeTab === 'closure' ? closurePreview : withdrawalPreview;
    if (!activePreview || activePrincipal <= 0) return [];

    const lines: Array<{ drCr: 'Dr' | 'Cr'; ledgerLabel: string; amount: number; warning?: boolean }> = [];
    lines.push({
      drCr: 'Dr',
      ledgerLabel: `पिग्मी ठेव देयता: ${resolveLedgerNameById(activePreview.schemeLiabilityLedgerId, activePreview.schemeLiabilityLedgerName)}`,
      amount: activePrincipal,
      warning: !activePreview.schemeLiabilityLedgerId
    });

    if (effectiveInterest > 0) {
      lines.push({
        drCr: 'Dr',
        ledgerLabel: `देय व्याज (${hasProvisionCoverage ? 'तरतूद' : 'खर्च'}): ${resolveLedgerNameById(schemeInterestLedgerId, schemeInterestLedgerName)}`,
        amount: effectiveInterest,
        warning: !schemeInterestLedgerId
      });
    }

    if (effectivePenalty > 0) {
      lines.push({
        drCr: 'Cr',
        ledgerLabel: `कमिशन / दंड कपात: ${resolveLedgerNameById(schemeDeductionLedgerId, schemeDeductionLedgerName)}`,
        amount: effectivePenalty,
        warning: !schemeDeductionLedgerId
      });
    }

    if (paymentMode === 'Adjust in Loan') {
      if (effectiveLoanAdjustAmount > 0) {
        lines.push({
          drCr: 'Cr',
          ledgerLabel: `कर्ज वसुली समायोजन (${selectedLoan?.loanAccountNo || 'कर्ज खाते'} — दंड/व्याज/मुद्दल Waterfall)`,
          amount: effectiveLoanAdjustAmount,
          warning: !selectedLoan
        });
      }
      if (effectiveSurplusAmount > 0) {
        const sLabel = surplusPaymentMode === 'Bank'
          ? `शिल्लक बँक परतावा: ${resolveLedgerNameById(surplusBankLedgerId)}`
          : surplusPaymentMode === 'Saving Transfer'
            ? `शिल्लक बचत खाते जमा (चेकर पासिंगनंतर जमा)`
            : `शिल्लक रोख परतावा (Branch Cash GL)`;
        lines.push({
          drCr: 'Cr',
          ledgerLabel: sLabel,
          amount: effectiveSurplusAmount
        });
      }
    } else if (effectiveNetPayable > 0) {
      const pLabel = paymentMode === 'Bank'
        ? `बँक खाते परतावा: ${resolveLedgerNameById(bankLedgerId)}`
        : paymentMode === 'Saving Transfer'
          ? `बचत खाते वर्ग जमा (चेकर पासिंगनंतर जमा)`
          : `शाखा रोख खाते (Branch Cash-in-Hand GL)`;
      lines.push({
        drCr: 'Cr',
        ledgerLabel: pLabel,
        amount: effectiveNetPayable
      });
    }

    return lines;
  }, [
    activeTab,
    closurePreview,
    withdrawalPreview,
    activePrincipal,
    effectiveInterest,
    effectivePenalty,
    effectiveNetPayable,
    hasProvisionCoverage,
    schemeInterestLedgerId,
    schemeInterestLedgerName,
    schemeDeductionLedgerId,
    schemeDeductionLedgerName,
    paymentMode,
    bankLedgerId,
    selectedLoan,
    effectiveLoanAdjustAmount,
    effectiveSurplusAmount,
    surplusPaymentMode,
    surplusBankLedgerId,
    allLedgers
  ]);

  const totalPreviewDr = voucherPreviewLines.filter((l) => l.drCr === 'Dr').reduce((s, l) => s + l.amount, 0);
  const totalPreviewCr = voucherPreviewLines.filter((l) => l.drCr === 'Cr').reduce((s, l) => s + l.amount, 0);
  const isVoucherBalanced = Math.abs(totalPreviewDr - totalPreviewCr) <= 0.01;

  const validateCommonInputs = (hasAmount: boolean, hasDirectLien: boolean, hasActiveLoan: boolean): boolean => {
    if (!hasAmount) return true;

    if (effectivePenalty > activePrincipal + effectiveInterest) {
      toast.error('कपात रक्कम ही मुद्दल व व्याजाच्या बेरजेपेक्षा जास्त असू शकत नाही.');
      return false;
    }

    if (effectivePenalty > 0 && (!schemeDeductionLedgerId || schemeDeductionLedgerId <= 0)) {
      toast.error('या पिग्मी योजनेसाठी "पिग्मी योजना मास्टर" मध्ये कमिशन/दंड कपात जी.एल. लेजर मॅप केलेले नाही. कृपया आधी योजना सेटिंगमध्ये लेजर मॅप करा.');
      return false;
    }

    if (effectiveInterest > 0 && (!schemeInterestLedgerId || schemeInterestLedgerId <= 0)) {
      toast.error('या पिग्मी योजनेसाठी "पिग्मी योजना मास्टर" मध्ये व्याज खर्च जी.एल. लेजर मॅप केलेले नाही. कृपया आधी योजना सेटिंगमध्ये लेजर मॅप करा.');
      return false;
    }

    if (hasActiveLoan && paymentMode !== 'Adjust in Loan' && !managerOverride) {
      toast.error('सक्रिय कर्ज बाकी असताना कृपया "कर्ज खात्यात समायोजन" निवडा किंवा व्यवस्थापक संमती द्या.');
      return false;
    }

    if (paymentMode === 'Bank' && effectiveNetPayable > 0 && (!bankLedgerId || bankLedgerId <= 0)) {
      toast.error('बँक व्यवहारासाठी कृपया बँक जी.एल. खाते निवडा.');
      return false;
    }

    if (paymentMode === 'Saving Transfer' && effectiveNetPayable > 0 && (!savingAccountId || savingAccountId <= 0)) {
      toast.error('रक्कम वर्ग करण्यासाठी कृपया ग्राहकाचे सक्रिय बचत खाते निवडा.');
      return false;
    }

    if (paymentMode === 'Adjust in Loan') {
      if (!selectedLoan || effectiveLoanAdjustAmount <= 0) {
        toast.error('कर्ज समायोजनासाठी वैध सक्रिय कर्ज खाते आणि रक्कम निवडा.');
        return false;
      }
      if (activeTab === 'closure' && hasDirectLien && effectiveLoanAdjustAmount + 0.01 < maxLoanAdjustable) {
        toast.error(`तारण बोजा असल्याने किमान ₹${maxLoanAdjustable.toFixed(2)} रक्कम कर्जात समायोजित करणे आवश्यक आहे.`);
        return false;
      }
      if (effectiveSurplusAmount > 0) {
        if (surplusPaymentMode === 'Bank' && (!surplusBankLedgerId || surplusBankLedgerId <= 0)) {
          toast.error('शिल्लक परताव्यासाठी कृपया बँक जी.एल. लेजर निवडा.');
          return false;
        }
        if (surplusPaymentMode === 'Saving Transfer' && (!surplusSavingAccountId || surplusSavingAccountId <= 0)) {
          toast.error('शिल्लक परताव्यासाठी कृपया सक्रिय बचत खाते निवडा.');
          return false;
        }
      }
    }

    return true;
  };

  const handleExecuteWithdrawal = async () => {
    if (!withdrawalPreview) return;
    if (!validateCommonInputs(true, !!withdrawalPreview.hasDirectLien, withdrawalPreview.hasActiveLoanLien)) return;

    const confirmMsg = `खाते '${withdrawalPreview.accountNo}' मधून ₹${withdrawalPreview.requestedAmount.toLocaleString('en-IN')} विड्रॉल करून (निव्वळ देय: ₹${effectiveNetPayable.toLocaleString('en-IN')}) उर्वरित ₹${withdrawalPreview.remainingBalance.toLocaleString('en-IN')} साठी नवीन सायकल #${withdrawalPreview.currentCycleNumber + 1} सुरू करायची का?`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await api.post('/api/PigmyClosure/Withdraw', {
        accountNo: withdrawalPreview.accountNo,
        amount: withdrawalPreview.requestedAmount,
        branchId: resolveWriteBranchId(user),
        withdrawalDate: transactionDate,
        paymentMode,
        bankLedgerId: paymentMode === 'Bank' ? bankLedgerId : null,
        savingAccountId: paymentMode === 'Saving Transfer' ? savingAccountId : null,
        referenceNo: referenceNo.trim() ? referenceNo.trim() : null,
        narration,
        managerOverrideConfirmed: managerOverride,
        customPenaltyAmount: effectivePenalty,
        deductionLedgerId: null,
        customInterestAmount: effectiveInterest,
        interestDebitMode: 'Auto',
        interestDebitLedgerId: null,
        overrideReason: isAmountOverridden ? (overrideReason.trim() || 'मॅन्युअल कमिशन/व्याज दुरुस्ती') : null,
        adjustInLoan: paymentMode === 'Adjust in Loan',
        targetLoanAccountId: paymentMode === 'Adjust in Loan' ? selectedLoan?.loanAccountId : null,
        loanAdjustmentAmount: paymentMode === 'Adjust in Loan' ? effectiveLoanAdjustAmount : null,
        surplusPaymentMode: paymentMode === 'Adjust in Loan' && effectiveSurplusAmount > 0 ? surplusPaymentMode : null,
        surplusBankLedgerId: paymentMode === 'Adjust in Loan' && effectiveSurplusAmount > 0 && surplusPaymentMode === 'Bank' ? surplusBankLedgerId : null,
        surplusSavingAccountId: paymentMode === 'Adjust in Loan' && effectiveSurplusAmount > 0 && surplusPaymentMode === 'Saving Transfer' ? surplusSavingAccountId : null
      });

      const vNo = res.data?.voucherNo || '';
      const successMsg = (res.data?.message || 'विड्रॉल यशस्वी!') + (vNo ? ` (व्हाउचर क्र.: ${vNo})` : '');
      setMessage(successMsg);
      toast.success(successMsg);

      setReceiptModalData({
        type: 'Withdrawal',
        date: transactionDate,
        accountNo: withdrawalPreview.accountNo,
        legacyAccountNo: withdrawalPreview.legacyAccountNumber,
        customerName: withdrawalPreview.customerName || withdrawalPreview.memberName,
        cifNo: withdrawalPreview.cifNo,
        schemeName: withdrawalPreview.schemeName || closurePreview?.schemeName,
        cycleNumber: withdrawalPreview.currentCycleNumber,
        principalAmount: withdrawalPreview.requestedAmount,
        penaltyAmount: effectivePenalty,
        deductionLedgerName: effectivePenalty > 0 ? resolveLedgerNameById(schemeDeductionLedgerId, schemeDeductionLedgerName) : '',
        interestAmount: effectiveInterest,
        loanAdjustedAmount: paymentMode === 'Adjust in Loan' ? effectiveLoanAdjustAmount : 0,
        targetLoanNo: paymentMode === 'Adjust in Loan' ? selectedLoan?.loanAccountNo : undefined,
        surplusPayoutAmount: paymentMode === 'Adjust in Loan' ? effectiveSurplusAmount : 0,
        surplusPaymentMode: paymentMode === 'Adjust in Loan' ? surplusPaymentMode : undefined,
        netPayableAmount: effectiveNetPayable,
        remainingBalance: withdrawalPreview.remainingBalance,
        paymentMode,
        voucherNo: vNo,
        narration
      });

      await handleSearch(withdrawalPreview.accountNo);
      fetchActivePigmyAccounts(false);
      setWithdrawalPreview(null);
      setWithdrawalAmount('');
      setNarration('');
      setReferenceNo('');
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data || 'विड्रॉल करताना त्रुटी आली.';
      setMessage(typeof errMsg === 'string' ? errMsg : 'विड्रॉल करताना त्रुटी आली.');
      toast.error(typeof errMsg === 'string' ? errMsg : 'विड्रॉल करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!closurePreview) return;

    if (closurePreview.hasDirectLien && paymentMode !== 'Adjust in Loan') {
      toast.error(`या पिग्मी खात्यावर कर्ज क्र. '${closurePreview.directLienLoanNo || ''}' चा तारण बोजा आहे. कृपया "कर्ज खात्यात समायोजन (Adjust in Loan)" निवडा.`);
      return;
    }

    if (!validateCommonInputs(closurePreview.totalDepositedAmount > 0 || effectiveInterest > 0, !!closurePreview.hasDirectLien, closurePreview.hasActiveLoanLien)) {
      return;
    }

    const confirmMsg = `खाते '${closurePreview.accountNo}' कायमस्वरूपी बंद करायचे का?\n• जमा मुद्दल: ₹${closurePreview.totalDepositedAmount.toLocaleString('en-IN')}\n• कमिशन/दंड कपात: ₹${effectivePenalty.toLocaleString('en-IN')}\n• देय व्याज: ₹${effectiveInterest.toLocaleString('en-IN')}\n• निव्वळ देय परतावा: ₹${effectiveNetPayable.toLocaleString('en-IN')}`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await api.post('/api/PigmyClosure/Close', {
        accountNo: closurePreview.accountNo,
        branchId: resolveWriteBranchId(user),
        closureDate: transactionDate,
        paymentMode,
        bankLedgerId: paymentMode === 'Bank' ? bankLedgerId : null,
        savingAccountId: paymentMode === 'Saving Transfer' ? savingAccountId : null,
        referenceNo: referenceNo.trim() ? referenceNo.trim() : null,
        narration,
        managerOverrideConfirmed: managerOverride,
        customPenaltyAmount: effectivePenalty,
        deductionLedgerId: null,
        customInterestAmount: effectiveInterest,
        interestDebitMode: 'Auto',
        interestDebitLedgerId: null,
        overrideReason: isAmountOverridden ? (overrideReason.trim() || 'मॅन्युअल कमिशन/व्याज दुरुस्ती') : null,
        adjustInLoan: paymentMode === 'Adjust in Loan',
        targetLoanAccountId: paymentMode === 'Adjust in Loan' ? selectedLoan?.loanAccountId : null,
        loanAdjustmentAmount: paymentMode === 'Adjust in Loan' ? effectiveLoanAdjustAmount : null,
        surplusPaymentMode: paymentMode === 'Adjust in Loan' && effectiveSurplusAmount > 0 ? surplusPaymentMode : null,
        surplusBankLedgerId: paymentMode === 'Adjust in Loan' && effectiveSurplusAmount > 0 && surplusPaymentMode === 'Bank' ? surplusBankLedgerId : null,
        surplusSavingAccountId: paymentMode === 'Adjust in Loan' && effectiveSurplusAmount > 0 && surplusPaymentMode === 'Saving Transfer' ? surplusSavingAccountId : null
      });

      const vNo = res.data?.voucherNo || '';
      const successMsg = (res.data?.message || 'खाते यशस्वीरीत्या बंद झाले.') + (vNo ? ` (व्हाउचर क्र.: ${vNo})` : '');
      setMessage(successMsg);
      toast.success(successMsg);

      setReceiptModalData({
        type: 'Closure',
        date: transactionDate,
        accountNo: closurePreview.accountNo,
        legacyAccountNo: closurePreview.legacyAccountNumber,
        customerName: closurePreview.customerName || closurePreview.memberName || '',
        cifNo: closurePreview.cifNo,
        schemeName: closurePreview.schemeName,
        cycleNumber: closurePreview.currentCycleNumber,
        principalAmount: closurePreview.totalDepositedAmount,
        penaltyAmount: effectivePenalty,
        deductionLedgerName: effectivePenalty > 0 ? resolveLedgerNameById(schemeDeductionLedgerId, schemeDeductionLedgerName) : '',
        interestAmount: effectiveInterest,
        loanAdjustedAmount: paymentMode === 'Adjust in Loan' ? effectiveLoanAdjustAmount : 0,
        targetLoanNo: paymentMode === 'Adjust in Loan' ? selectedLoan?.loanAccountNo : undefined,
        surplusPayoutAmount: paymentMode === 'Adjust in Loan' ? effectiveSurplusAmount : 0,
        surplusPaymentMode: paymentMode === 'Adjust in Loan' ? surplusPaymentMode : undefined,
        netPayableAmount: effectiveNetPayable,
        remainingBalance: 0,
        paymentMode,
        voucherNo: vNo,
        narration
      });

      setClosurePreview(null);
      setAccountNo('');
      fetchActivePigmyAccounts(false);
      setNarration('');
      setPaymentMode('Cash');
      setBankLedgerId(0);
      setReferenceNo('');
      setManagerOverride(false);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data || 'खाते बंद करताना सर्व्हर त्रुटी आली.';
      setMessage(typeof errMsg === 'string' ? errMsg : 'खाते बंद करताना त्रुटी आली.');
      toast.error(typeof errMsg === 'string' ? errMsg : 'खाते बंद करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const renderSettlementControlsAndVoucherPreview = () => (
    <div className="space-y-3">
      {/* 4-Card Editable Settlement Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
        {/* Card 1: Principal */}
        <div className="bg-white p-2.5 rounded border border-gray-200 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-gray-500 uppercase block font-bold">
              १. {activeTab === 'closure' ? 'एकूण जमा मुद्दल (Deposit)' : 'मागितलेली मुद्दल (Requested)'}
            </span>
            <span className="text-base font-black font-mono text-slate-900">
              ₹ {activePrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 mt-1">
            {activeTab === 'closure'
              ? `सायकल कालावधी: ${closurePreview?.tenureDaysInCycle || 0} दिवस (${closurePreview?.tenureMonthsInCycle || 0} महिने)`
              : `सायकल कालावधी: ${withdrawalPreview?.elapsedDays || 0} दिवस`}
          </span>
        </div>

        {/* Card 2: Editable Commission / Penalty Deduction (Ledger auto-resolved from Pigmy Scheme) */}
        <div className="bg-rose-50/50 p-2.5 rounded border border-rose-200 flex flex-col justify-between space-y-1.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-rose-900 uppercase font-bold">
                २. कमिशन / दंड कपात (-)
              </span>
              <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-1.5 rounded">
                {effectivePenaltyPct}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={customPenaltyAmount}
                onChange={(e) => setCustomPenaltyAmount(e.target.value)}
                className="w-full border border-rose-300 rounded px-2 py-1 text-xs font-mono font-bold text-rose-700 bg-white"
              />
              {Math.abs(effectivePenalty - defaultPenalty) > 0.01 && (
                <button
                  type="button"
                  onClick={() => setCustomPenaltyAmount(String(defaultPenalty))}
                  title="स्लॅब डीफॉल्टवर रीसेट करा"
                  className="px-1.5 py-1 text-[10px] bg-white border border-rose-300 rounded text-rose-700 font-bold cursor-pointer"
                >
                  ↺
                </button>
              )}
            </div>
          </div>
          {effectivePenalty > 0 && !schemeDeductionLedgerId ? (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('pigmy-scheme')}
              className="text-left text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-100 cursor-pointer"
            >
              ⚠️ पिग्मी योजना सेटिंगमध्ये कमिशन लेजर मॅप करा →
            </button>
          ) : (
            <span className="text-[10px] text-rose-800">
              स्लॅब कपात दर: {activeTab === 'closure' ? (closurePreview?.prematurePenaltyRate ?? 0) : (withdrawalPreview?.appliedPenaltyRate ?? 0)}%
            </span>
          )}
        </div>

        {/* Card 3: Scheme-Calculated Interest (Ledger auto-resolved from Pigmy Scheme) */}
        <div className="bg-blue-50/50 p-2.5 rounded border border-blue-200 flex flex-col justify-between space-y-1.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-blue-900 uppercase font-bold">
                ३. देय व्याज (+)
              </span>
              <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-100 px-1.5 rounded">
                {activeTab === 'closure' ? (closurePreview?.prematureInterestRate ?? 0) : (withdrawalPreview?.appliedInterestRate ?? 0)}% p.a.
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                min="0"
                value={customInterestAmount}
                onChange={(e) => setCustomInterestAmount(e.target.value)}
                className="w-full border border-blue-300 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-700 bg-white"
              />
              {Math.abs(effectiveInterest - defaultInterest) > 0.01 && (
                <button
                  type="button"
                  onClick={() => setCustomInterestAmount(String(defaultInterest))}
                  title="योजना डीफॉल्टवर रीसेट करा"
                  className="px-1.5 py-1 text-[10px] bg-white border border-blue-300 rounded text-blue-700 font-bold cursor-pointer"
                >
                  ↺
                </button>
              )}
            </div>
          </div>
          {activeTab === 'closure' && (closurePreview?.alreadyCapitalizedInterest || 0) > 0 ? (
            <div className="text-[9.5px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
              आधी जमा व्याज: ₹{(closurePreview?.alreadyCapitalizedInterest || 0).toFixed(2)} वजा केले
            </div>
          ) : effectiveInterest > 0 && !schemeInterestLedgerId ? (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('pigmy-scheme')}
              className="text-left text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-100 cursor-pointer"
            >
              ⚠️ पिग्मी योजना सेटिंगमध्ये व्याज लेजर मॅप करा →
            </button>
          ) : (
            <span className="text-[10px] text-blue-800 truncate" title={activePreviewObj?.calculationMethodLabel || ''}>
              {activePreviewObj?.calculationMethodLabel || 'योजना नियमांनुसार व्याज'}
            </span>
          )}
        </div>

        {/* Card 4: Net Payable */}
        <div className="bg-emerald-50 p-2.5 rounded border border-emerald-300 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-emerald-900 uppercase block font-bold">
              ४. निव्वळ देय परतावा (Net Payable)
            </span>
            <span className="text-lg font-black font-mono text-emerald-800">
              ₹ {effectiveNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          {isAmountOverridden ? (
            <div className="mt-1">
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="रक्कम बदलाचे कारण (ऐच्छिक)..."
                className="w-full border border-emerald-300 rounded px-1.5 py-0.5 text-[10px] bg-white text-gray-800"
              />
            </div>
          ) : (
            <span className="text-[10px] text-emerald-800">
              {activeTab === 'closure' ? closurePreview?.policyNote : withdrawalPreview?.policyNote}
            </span>
          )}
        </div>
      </div>

      {/* Payment Mode + Date + Narration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">पेमेंट माध्यम (Payment Mode) *</label>
          <select
            value={paymentMode}
            onChange={(e) => {
              const mode = e.target.value as PaymentModeOption;
              setPaymentMode(mode);
              if (mode !== 'Bank') {
                setBankLedgerId(0);
                setReferenceNo('');
              }
            }}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-bold bg-white text-gray-900"
          >
            <option value="Cash">💵 रोख (Cash)</option>
            <option value="Bank">🏦 बँक खाते / NEFT / RTGS (Bank)</option>
            <option value="Saving Transfer">🔄 बचत खात्यात वर्ग (Saving Transfer)</option>
            <option value="Adjust in Loan">📉 कर्ज खात्यात समायोजन (Adjust in Loan)</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">व्यवहार तारीख (Business Date)</label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-slate-100 font-mono font-bold text-slate-800 cursor-not-allowed"
            value={transactionDate}
            readOnly
            disabled
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">शेरा / टिप्पणी (Narration)</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
            placeholder="कारण किंवा विशेष शेरा..."
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
          />
        </div>
      </div>

      {/* Mode 2: Bank */}
      {paymentMode === 'Bank' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-2.5 bg-blue-50/50 border border-blue-200 rounded">
          <BankLedgerSelect
            value={bankLedgerId}
            onChange={setBankLedgerId}
            disabled={isPassingMode}
            showCountBadge
          />
          <div>
            <label className="block text-[11px] font-bold text-blue-950 mb-0.5">चेक / UTR संदर्भ क्र. (Cheque / UTR Ref No)</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-white h-[30px]"
              placeholder="उदा. Chq No / UTR"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Mode 3: Saving Transfer */}
      {paymentMode === 'Saving Transfer' && (
        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded space-y-1.5">
          <label className="block text-[11px] font-bold text-emerald-950">
            रक्कम जमा करण्याचे सक्रिय बचत खाते (Target Saving Account) <span className="text-red-500">*</span>
          </label>
          {customerSavingAccounts.length === 0 ? (
            <div className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 p-2 rounded">
              ⚠️ या ग्राहकाचे कोणतेही सक्रिय बचत खाते आढळले नाही. कृपया प्रथम बचत खाते उघडा किंवा रोख / बँक पर्याय निवडा.
            </div>
          ) : (
            <>
              <select
                value={savingAccountId}
                onChange={(e) => setSavingAccountId(parseInt(e.target.value, 10) || 0)}
                disabled={isPassingMode}
                className="w-full border border-emerald-300 rounded px-2 py-1.5 text-xs font-bold bg-white text-gray-900"
              >
                <option value={0}>-- सक्रिय बचत खाते निवडा --</option>
                {customerSavingAccounts.map((sa: any) => (
                  <option key={sa.savingAccountID} value={sa.savingAccountID}>
                    {sa.accountNo} - {sa.customerName || sa.customer?.firstName || ''} (शिल्लक: ₹{Number(sa.currentBalance || 0).toFixed(2)})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-emerald-800 font-semibold">
                ℹ️ सुरक्षा नियम: बचत खात्यातील शिल्लक चेकरने व्हाउचर मंजूर (Approve) केल्यावरच वाढेल.
              </p>
            </>
          )}
        </div>
      )}

      {/* Mode 4: Adjust in Loan */}
      {paymentMode === 'Adjust in Loan' && (
        <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded space-y-2.5">
          <div className="font-bold text-xs text-indigo-950 flex items-center justify-between">
            <span>📉 कर्ज खाते समायोजन व Waterfall वसुली (Loan Set-Off)</span>
            {closurePreview?.hasDirectLien && (
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px]">
                🔒 तारण बोजा मुक्ती (Lien Release on Closure)
              </span>
            )}
          </div>

          {activeLoanList.length === 0 ? (
            <div className="text-xs font-bold text-red-700 bg-white border border-red-200 p-2 rounded">
              या ग्राहकाकडे समायोजनासाठी कोणतेही सक्रिय थकीत कर्ज खाते आढळले नाही.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-indigo-950 mb-0.5">सक्रिय कर्ज खाते निवडा *</label>
                  <select
                    value={targetLoanAccountId}
                    onChange={(e) => setTargetLoanAccountId(Number(e.target.value) || 0)}
                    disabled={activeTab === 'closure' && !!closurePreview?.hasDirectLien && !!closurePreview?.directLienLoanAccountId}
                    className="w-full border border-indigo-300 rounded px-2 py-1.5 text-xs font-bold bg-white text-gray-900"
                  >
                    {activeLoanList.map((ln) => (
                      <option key={ln.loanAccountId} value={ln.loanAccountId}>
                        {ln.loanAccountNo} ({ln.loanType}) — मुद्दल: ₹{ln.principalBalance.toFixed(2)} | व्याज/दंड: ₹{ln.overdueInterest.toFixed(2)} | एकूण येणे: ₹{ln.totalOutstanding.toFixed(2)}
                        {ln.isDirectLienLoan ? ' [तारण कर्ज]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-indigo-950 mb-0.5">
                    कर्जात जमा होणारी रक्कम (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={maxLoanAdjustable}
                    readOnly={activeTab === 'closure' && !!closurePreview?.hasDirectLien}
                    value={loanAdjustAmountInput}
                    onChange={(e) => setLoanAdjustAmountInput(e.target.value)}
                    className="w-full border border-indigo-300 rounded px-2 py-1.5 text-xs font-mono font-bold text-indigo-900 bg-white"
                  />
                </div>
              </div>

              {/* Surplus Payout Mode when NetPayable > Loan Adjustment */}
              {effectiveSurplusAmount > 0 && (
                <div className="p-2.5 bg-white border border-emerald-300 rounded space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span>कर्ज पूर्ण भागल्यानंतर उरणारा शिल्लक परतावा (Surplus Payout):</span>
                    <span className="font-mono text-sm text-emerald-700">₹ {effectiveSurplusAmount.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 mb-0.5">शिल्लक परतावा माध्यम *</label>
                      <select
                        value={surplusPaymentMode}
                        onChange={(e) => setSurplusPaymentMode(e.target.value as SurplusModeOption)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-bold bg-white"
                      >
                        <option value="Cash">💵 रोख (Cash)</option>
                        <option value="Bank">🏦 बँक खाते (Bank)</option>
                        <option value="Saving Transfer">🔄 बचत खाते वर्ग (Saving)</option>
                      </select>
                    </div>
                    {surplusPaymentMode === 'Bank' && (
                      <div className="md:col-span-2">
                        <BankLedgerSelect
                          value={surplusBankLedgerId}
                          onChange={setSurplusBankLedgerId}
                          showCountBadge
                        />
                      </div>
                    )}
                    {surplusPaymentMode === 'Saving Transfer' && (
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-700 mb-0.5">शिल्लक जमा बचत खाते *</label>
                        <select
                          value={surplusSavingAccountId}
                          onChange={(e) => setSurplusSavingAccountId(Number(e.target.value) || 0)}
                          className="w-full border border-emerald-300 rounded px-2 py-1 text-xs font-bold bg-white"
                        >
                          <option value={0}>-- सक्रिय बचत खाते निवडा --</option>
                          {customerSavingAccounts.map((sa: any) => (
                            <option key={sa.savingAccountID} value={sa.savingAccountID}>
                              {sa.accountNo} (शिल्लक: ₹{Number(sa.currentBalance || 0).toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Live Balanced Dr / Cr Voucher Preview */}
      {voucherPreviewLines.length > 0 && (
        <div className="border border-slate-200 rounded overflow-hidden bg-white">
          <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between border-b border-slate-200">
            <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1">
              <ScaleIcon className="w-3.5 h-3.5 text-primary" />
              <span>प्रस्तावित लेखा व्हाउचर प्रिव्ह्यू (Live Accounting Voucher Preview)</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isVoucherBalanced
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-red-100 text-red-800 border border-red-300'
            }`}>
              Dr ₹{totalPreviewDr.toFixed(2)} = Cr ₹{totalPreviewCr.toFixed(2)} {isVoucherBalanced ? '✓ संतुलित' : '⚠️ असंतुलित'}
            </span>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 text-[10px] text-gray-600 font-bold border-b">
              <tr>
                <th className="p-1.5 text-left">जी.एल. खाते तपशील (GL Ledger)</th>
                <th className="p-1.5 text-center w-20">प्रकार</th>
                <th className="p-1.5 text-right w-32">नावे (Dr ₹)</th>
                <th className="p-1.5 text-right w-32">जमा (Cr ₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-[11px]">
              {voucherPreviewLines.map((ln, idx) => (
                <tr key={idx} className={ln.warning ? 'bg-red-50' : ''}>
                  <td className={`p-1.5 font-semibold ${ln.warning ? 'text-red-700' : 'text-gray-800'}`}>
                    {ln.ledgerLabel}
                  </td>
                  <td className="p-1.5 text-center font-mono font-bold">
                    <span className={ln.drCr === 'Dr' ? 'text-amber-700' : 'text-emerald-700'}>{ln.drCr}</span>
                  </td>
                  <td className="p-1.5 text-right font-mono font-bold text-gray-900">
                    {ln.drCr === 'Dr' ? ln.amount.toFixed(2) : '-'}
                  </td>
                  <td className="p-1.5 text-right font-mono font-bold text-gray-900">
                    {ln.drCr === 'Cr' ? ln.amount.toFixed(2) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="p-2.5 sm:p-3.5 w-full min-h-full font-sans text-xs"
      style={{
        background:
          'linear-gradient(135deg, #eef2ff 0%, #f8fbff 45%, #e0f2fe 100%)',
      }}
    >
      <div className="max-w-[1640px] mx-auto space-y-3">
      {/* Passing Mode Banner */}
      {isPassingMode && (
        <div className="bg-amber-500 text-white p-3 rounded-xl shadow flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-sm">व्हाउचर तपासणी व पासिंग मोड (Checker Inspection Mode)</p>
              <p className="text-xs text-amber-100">
                व्हाउचर क्र: <span className="font-mono font-bold text-white">{passingVoucherData?.voucherNo || voucherId}</span> |{' '}
                रक्कम: <span className="font-bold text-white">₹{Number(passingVoucherData?.totalAmount || 0).toLocaleString('en-IN')}</span> |{' '}
                स्थिती: <span className="font-bold text-white">{passingVoucherData?.status || 'तपासणीसाठी प्रलंबित'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => (onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting'))}
            className="px-3 py-1 bg-white text-amber-800 text-xs font-bold rounded-lg shadow hover:bg-amber-50 cursor-pointer"
          >
            ↩️ पासिंग यादीवर परत जा
          </button>
        </div>
      )}

      {/* Main Aurora Card */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_28px_rgba(37,99,235,0.09)] border border-blue-200/75 overflow-hidden flex flex-col print:hidden">
        {/* Aurora Sapphire Header */}
        <div
          className="px-4 py-3 text-white flex flex-wrap items-center justify-between gap-2.5"
          style={{
            background:
              'linear-gradient(125deg, #0F2454 0%, #1E3A8A 46%, #2563EB 82%, #4F46E5 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shadow-xs shrink-0">
              <BanknotesIcon className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight flex items-center gap-2 flex-wrap">
                <span>पिग्मी विड्रॉल व खाते बंद व्यवस्थापन</span>
                <span className="text-[11px] font-semibold text-sky-200 hidden sm:inline">(Pigmy Withdrawal &amp; Closure)</span>
                {isPassingMode && (
                  <span className="ml-1 text-[10.5px] font-bold text-amber-100 bg-amber-600/60 px-2 py-0.5 rounded-full border border-amber-300/50">
                    चेकर तपासणी मोड
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-blue-100/90 font-medium">
                डायनॅमिक कमिशन/दंड जी.एल. लेजर, कर्ज खाते समायोजन (Waterfall), बचत वर्ग व सायकल ट्रॅकिंग
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-white/12 p-1 rounded-xl border border-white/25 backdrop-blur-xs">
            <button
              type="button"
              disabled={isPassingMode}
              onClick={() => {
                setActiveTab('withdrawal');
                setWithdrawalPreview(null);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'withdrawal' ? 'bg-white text-[#0F2454] shadow-xs' : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <BanknotesIcon className="w-4 h-4" />
              <span>१. अंशतः विड्रॉल (Day 1 Reset)</span>
            </button>
            <button
              type="button"
              disabled={isPassingMode}
              onClick={() => {
                setActiveTab('closure');
                setWithdrawalPreview(null);
                if (closurePreview) applySchemeDefaultsFromPreview(closurePreview, true);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'closure' ? 'bg-white text-rose-700 shadow-xs' : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <XCircleIcon className="w-4 h-4" />
              <span>२. पूर्ण खाते बंद (Closure)</span>
            </button>
          </div>
        </div>

        {/* CHECKER PASSING SNAPSHOT VIEW */}
        {isPassingMode ? (
          <div className="p-4 space-y-4">
            {passingLoading ? (
              <div className="py-8 text-center text-gray-500 font-bold">व्हाउचर तपशील लोड होत आहे...</div>
            ) : passingDetailsData && passingAccountData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">खातेदार नाव</p>
                    <p className="font-bold text-gray-900">{passingAccountData.customerName}</p>
                    <p className="text-[10px] text-gray-500 font-mono">CIF: {passingAccountData.cifNo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">पिग्मी खाते क्र.</p>
                    <p className="font-mono font-bold text-blue-900">{passingAccountData.accountNo}</p>
                    <p className="text-[10px] text-gray-500">{passingAccountData.schemeName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">व्यवहार प्रकार</p>
                    <p className="font-bold text-indigo-800">
                      {passingDetailsData.closureType === 'Withdrawal' ? 'अंशतः विड्रॉल (Partial)' : 'पूर्ण खाते बंद (Closure)'}
                    </p>
                    <p className="text-[10px] text-gray-500">पेमेंट: {passingDetailsData.paymentMode}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">मुद्दल / कपात / व्याज</p>
                    <p className="font-mono font-bold text-gray-800">
                      ₹{Number(passingDetailsData.requestedAmount || 0).toFixed(2)}{' '}
                      <span className="text-rose-600">-₹{Number(passingDetailsData.penaltyAmount || 0).toFixed(2)}</span>{' '}
                      <span className="text-emerald-700">+₹{Number(passingDetailsData.interestAmount || 0).toFixed(2)}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-800 font-bold uppercase">निव्वळ परतावा (Net Payable)</p>
                    <p className="font-mono font-black text-base text-emerald-700">
                      ₹{Number(passingDetailsData.netPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    {passingDetailsData.adjustInLoan && (
                      <p className="text-[10px] text-indigo-700 font-bold">
                        कर्ज वजावट: ₹{Number(passingDetailsData.loanAdjustedAmount || 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {Array.isArray(passingVoucherData?.voucherDetails) && passingVoucherData.voucherDetails.length > 0 && (
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="bg-slate-100 px-3 py-1.5 font-bold text-xs text-slate-800 border-b">
                      व्हाउचर लेखा नोंदी (Voucher GL Lines — {passingVoucherData.voucherNo})
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] text-gray-600 font-bold border-b">
                        <tr>
                          <th className="p-2 text-left">जी.एल. खाते नाव (Ledger Name)</th>
                          <th className="p-2 text-center w-20">Dr / Cr</th>
                          <th className="p-2 text-right w-32">नावे (Dr ₹)</th>
                          <th className="p-2 text-right w-32">जमा (Cr ₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {passingVoucherData.voucherDetails.map((vd: any) => (
                          <tr key={vd.voucherDetailID}>
                            <td className="p-2 font-semibold text-gray-800">{vd.ledgerName}</td>
                            <td className="p-2 text-center font-mono font-bold">{vd.drCr}</td>
                            <td className="p-2 text-right font-mono font-bold">
                              {vd.drCr === 'Dr' ? Number(vd.amount || 0).toFixed(2) : '-'}
                            </td>
                            <td className="p-2 text-right font-mono font-bold">
                              {vd.drCr === 'Cr' ? Number(vd.amount || 0).toFixed(2) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="py-6 text-center text-red-600 font-bold">व्हाउचर तपशील आढळला नाही.</div>
            )}
          </div>
        ) : (
          /* MAKER ENTRY MODE */
          <div className="p-3 space-y-3">
            {message && (
              <div className={`p-2.5 rounded-sm border text-xs font-bold flex items-center justify-between ${
                message.includes('Error') || message.includes('त्रुटी') || message.includes('already') || message.includes('थकीत')
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-green-50 text-green-800 border-green-200'
              }`}>
                <span>{message}</span>
                {receiptModalData && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-2.5 py-1 bg-white border border-green-400 text-green-900 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <PrinterIcon className="w-3.5 h-3.5" />
                    <span>पावती पहा</span>
                  </button>
                )}
              </div>
            )}

            {/* Search Account Card */}
            <div className="bg-[#f8fbff] p-3.5 rounded-xl border border-blue-200/75 shadow-2xs">
              <div className="text-[11px] font-extrabold text-[#0F2454] uppercase tracking-wider mb-2 pb-1.5 border-b border-blue-100 flex items-center justify-between">
                <span>१. खाते शोध (Search Pigmy Account)</span>
                <span className="text-[10px] text-primary font-bold">
                  {activeTab === 'withdrawal' ? 'मोड: अंशतः विड्रॉल (Partial Withdrawal)' : 'मोड: पूर्ण खाते बंद (Full Closure)'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                <div className="md:col-span-3">
                  <label className="block text-[11px] font-medium text-gray-600 mb-0.5">पिग्मी एजंट फिल्टर (ऐच्छिक)</label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(parseInt(e.target.value, 10) || 0)}
                    className="w-full h-[30px] border border-gray-300 rounded-sm px-2 text-xs bg-white font-semibold text-gray-800"
                  >
                    <option value={0}>सर्व एजंट ({pigmyAccounts.length} खाती)</option>
                    {pigmyAgents.map((ag: any) => (
                      <option key={ag.pigmyAgentID} value={ag.pigmyAgentID}>
                        {ag.agentName}{ag.username ? ` (${ag.username})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-6">
                  <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                    पिग्मी खातेदार नाव / खाते क्र. निवडा *
                  </label>
                  <SearchableSelect
                    options={accountOptions}
                    value={accountNo}
                    onChange={(e) => {
                      const selectedVal = String(e.target.value || '').trim();
                      setAccountNo(selectedVal);
                      if (selectedVal) {
                        handleSearch(selectedVal);
                      } else {
                        setClosurePreview(null);
                        setWithdrawalPreview(null);
                        setWithdrawalHistory([]);
                        setMessage('');
                      }
                    }}
                    placeholder={accountsLoading ? 'पिग्मी खाती लोड होत आहेत...' : 'पिग्मीदाराचे नाव, जुना क्र., खाते क्र. किंवा CIF ने शोधा...'}
                    searchPlaceholder="पिग्मीदाराचे नाव, जुना क्र., खाते क्र., CIF किंवा मोबाईल..."
                    countLabel="सक्रिय पिग्मी खाती"
                    emptyMessage="कोणतेही सक्रिय पिग्मी खाते आढळले नाही."
                    minMenuWidth={460}
                  />
                </div>

                <div className="md:col-span-3 flex gap-1.5 items-end">
                  <div className="flex-1 min-w-0">
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">थेट खाते / जुना क्र.</label>
                    <input
                      type="text"
                      className="w-full h-[30px] border border-gray-300 rounded-sm px-2 text-xs bg-white font-bold text-blue-900"
                      placeholder="PG / जुना क्र."
                      value={accountNo}
                      onChange={(e) => setAccountNo(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                  <button
                    type="button"
                    className="bg-primary hover:bg-[#004a75] text-white h-[30px] px-3 rounded-sm font-bold text-xs shadow-xs transition disabled:opacity-50 cursor-pointer shrink-0"
                    onClick={handleSearch}
                    disabled={loading || !accountNo.trim()}
                  >
                    {loading ? '...' : '🔍 शोधा'}
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchActivePigmyAccounts(false)}
                    disabled={accountsLoading}
                    title="पिग्मी खाती यादी रिफ्रेश करा"
                    className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 h-[30px] px-2 rounded-sm font-bold text-xs cursor-pointer shrink-0 flex items-center justify-center"
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${accountsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Account Snapshot Card */}
            {closurePreview && (
              <div className="bg-white rounded-sm border border-gray-200 overflow-hidden space-y-3 p-3">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider pb-1 border-b border-gray-200 flex justify-between items-center">
                  <span>२. खाते तपशील व चालू सायकल माहिती (Account Snapshot)</span>
                  <div className="flex items-center gap-2">
                    {closurePreview.schemeName && (
                      <span className="bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        योजना: {closurePreview.schemeName}
                      </span>
                    )}
                    <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold">
                      सायकल #{closurePreview.currentCycleNumber}
                    </span>
                    {closurePreview.isPremature ? (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        ⚠️ मुदतपूर्व • {closurePreview.tenureDaysInCycle} दिवस ({closurePreview.tenureMonthsInCycle} महिने)
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        ✓ मुदत पूर्ण (Matured)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-gray-50 p-2.5 rounded border border-gray-200">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">खातेदाराचे नाव</p>
                    <p className="font-bold text-xs text-gray-900">{closurePreview.customerName || closurePreview.memberName}</p>
                    {closurePreview.cifNo && <p className="text-[10px] text-gray-500 font-mono">CIF: {closurePreview.cifNo}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">खाते क्र.</p>
                    <p className="font-mono font-bold text-xs text-blue-900 flex items-center gap-1 flex-wrap">
                      <span>{closurePreview.accountNo}</span>
                      {closurePreview.legacyAccountNumber && (
                        <span className="bg-purple-100 text-purple-950 border border-purple-300 px-1.5 rounded font-mono font-bold text-[9.5px]">
                          जुना: {closurePreview.legacyAccountNumber}
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">चालू जमा शिल्लक</p>
                    <p className="font-mono font-black text-sm text-emerald-700">
                      ₹ {closurePreview.totalDepositedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">चालू सायकल सुरुवात (Day 1)</p>
                    <p className="font-medium text-xs text-gray-800 font-mono">
                      {new Date(closurePreview.cycleStartDate).toLocaleDateString('en-GB')} ({closurePreview.tenureDaysInCycle} दि.)
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">मूळ मुदत तारीख (Fixed Expiry)</p>
                    <p className="font-medium text-xs text-gray-800 font-mono">
                      {new Date(closurePreview.maturityDate).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                {/* Direct Lien / Active Loan Alert */}
                {closurePreview.hasDirectLien ? (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                      <ShieldExclamationIcon className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        🔒 थेट कर्ज तारण बोजा (Direct Lien): हे पिग्मी खाते कर्ज क्र. <strong>{closurePreview.directLienLoanNo || 'सक्रिय कर्ज'}</strong> साठी तारण ठेवलेले आहे (बोजा रक्कम: ₹{(closurePreview.directLienAmount || 0).toLocaleString('en-IN')}). खाते बंद करताना रक्कम कर्जात समायोजित करणे बंधनकारक आहे.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('Adjust in Loan')}
                      className="px-2.5 py-1 bg-rose-700 text-white rounded text-[11px] font-bold cursor-pointer"
                    >
                      📉 कर्जात समायोजित करा
                    </button>
                  </div>
                ) : closurePreview.hasActiveLoanLien ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-300 rounded space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-amber-950 font-bold text-xs">
                        <ShieldExclamationIcon className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          ⚠️ सक्रिय कर्ज सूचना: या खातेदाराकडे एकूण ₹ {closurePreview.totalLoanLiability.toLocaleString('en-IN', { minimumFractionDigits: 2 })} चे सक्रिय कर्ज बाकी आहे.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaymentMode('Adjust in Loan')}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold cursor-pointer"
                      >
                        📉 कर्ज खात्यात समायोजन निवडा
                      </button>
                    </div>
                    {paymentMode !== 'Adjust in Loan' && (
                      <label className="flex items-center gap-2 bg-white/80 p-2 rounded border border-amber-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={managerOverride}
                          onChange={(e) => setManagerOverride(e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded"
                        />
                        <span className="text-xs font-bold text-amber-950">
                          व्यवस्थापक विशेष परवानगी (Manager Override): कर्ज बाकी असतानाही रोख/बँक/बचत परतावा करण्यास संमती देतो.
                        </span>
                      </label>
                    )}
                  </div>
                ) : null}

                {/* TAB 1: PARTIAL WITHDRAWAL */}
                {activeTab === 'withdrawal' && (
                  <div className="space-y-3 pt-1">
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-blue-950 flex items-center gap-1">
                          <BanknotesIcon className="w-4 h-4 text-primary" />
                          <span>३. अंशतः विड्रॉल रक्कम व परतावा हिशोब (Partial Withdrawal Settlement)</span>
                        </h4>
                        <span className="text-[10px] text-blue-800 font-medium">
                          लागू स्लॅब: <span className="font-bold text-primary">{closurePreview.policyNote}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-end">
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                            काढायची मुद्दल रक्कम (Withdrawal Principal ₹) *
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="100"
                              min="1"
                              max={closurePreview.totalDepositedAmount}
                              placeholder={`कमाल ₹ ${closurePreview.totalDepositedAmount}`}
                              value={withdrawalAmount}
                              onChange={(e) => setWithdrawalAmount(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handlePreviewWithdrawal()}
                              className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-primary bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handlePreviewWithdrawal()}
                              disabled={loading || !withdrawalAmount}
                              className="px-3.5 py-1.5 bg-primary hover:bg-[#004a75] text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                            >
                              हिशोब तपासा
                            </button>
                          </div>
                        </div>

                        <div className="text-[11px] text-gray-600 bg-white p-2 rounded border border-blue-200">
                          <span className="block text-[10px] text-gray-500 font-bold uppercase">खात्यात शिल्लक राहणारी रक्कम</span>
                          <span className="font-mono font-bold text-gray-900">
                            ₹ {Math.max(0, closurePreview.totalDepositedAmount - (parseFloat(withdrawalAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {withdrawalPreview && (
                        <div className="mt-3 pt-2.5 border-t border-blue-200 space-y-3">
                          {renderSettlementControlsAndVoucherPreview()}

                          <div className="p-2 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-950">
                            🔄 <strong>सायकल रीसेट नियम:</strong> विड्रॉलनंतर उर्वरित <strong>₹{withdrawalPreview.remainingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> साठी आजपासून नवीन <strong>सायकल #{withdrawalPreview.currentCycleNumber + 1} (Day 1)</strong> सुरू होईल आणि मूळ मुदत तारीख ({new Date(withdrawalPreview.fixedMaturityDate).toLocaleDateString('en-GB')}) कायम राहील.
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleExecuteWithdrawal}
                              disabled={loading || !isVoucherBalanced}
                              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 transition"
                            >
                              <BanknotesIcon className="w-4 h-4" />
                              <span>💸 विड्रॉल सेव्ह करा व व्हाउचर जनरेट करा (₹ {effectiveNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Past Withdrawals History */}
                    {withdrawalHistory.length > 0 && (
                      <div className="border border-gray-200 rounded overflow-hidden">
                        <div className="bg-slate-100 px-3 py-1.5 font-bold text-[11px] text-gray-700 border-b border-gray-200 flex items-center justify-between">
                          <span>📜 या खात्याचा पूर्वीचा विड्रॉल इतिहास (Past Withdrawals & Cycles)</span>
                          <span className="text-[10px] font-mono text-gray-500">{withdrawalHistory.length} नोंदी</span>
                        </div>
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 text-gray-600 text-[10px] font-bold border-b">
                            <tr>
                              <th className="p-1.5 text-center">सायकल #</th>
                              <th className="p-1.5">तारीख</th>
                              <th className="p-1.5 text-right">मुद्दल</th>
                              <th className="p-1.5 text-right">कपात</th>
                              <th className="p-1.5 text-right">देय परतावा</th>
                              <th className="p-1.5">पेमेंट माध्यम</th>
                              <th className="p-1.5 text-right">उर्वरित शिल्लक</th>
                              <th className="p-1.5">व्हाउचर क्र.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-[11px]">
                            {withdrawalHistory.map((item) => (
                              <tr key={item.withdrawalID} className="hover:bg-slate-50 font-mono">
                                <td className="p-1.5 text-center font-bold text-indigo-700">#{item.cycleNumber}</td>
                                <td className="p-1.5">{new Date(item.withdrawalDate).toLocaleDateString('en-GB')}</td>
                                <td className="p-1.5 text-right font-bold text-gray-800">₹{item.requestedAmount.toFixed(2)}</td>
                                <td className="p-1.5 text-right text-rose-600">₹{item.penaltyAmount.toFixed(2)}</td>
                                <td className="p-1.5 text-right font-bold text-emerald-700">₹{item.netPaidAmount.toFixed(2)}</td>
                                <td className="p-1.5 font-sans text-[10px] font-bold text-slate-700">{item.paymentMode || 'Cash'}</td>
                                <td className="p-1.5 text-right font-bold text-blue-900">₹{item.remainingBalance.toFixed(2)}</td>
                                <td className="p-1.5 text-gray-500 font-sans text-[10px]">{item.voucherNo || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: FULL ACCOUNT CLOSURE */}
                {activeTab === 'closure' && (
                  <div className="space-y-3 pt-1">
                    <div className="p-3 bg-rose-50/40 border border-rose-200 rounded space-y-3">
                      <h4 className="font-bold text-xs text-rose-950">
                        ३. पूर्ण खाते बंद परतावा हिशोब (Full Closure Settlement — योजना लेजर मॅपिंगनुसार)
                      </h4>

                      {renderSettlementControlsAndVoucherPreview()}

                      <div className="pt-2 border-t border-rose-200 flex justify-end">
                        <button
                          type="button"
                          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-5 py-2 rounded font-bold text-xs transition shadow-xs cursor-pointer flex items-center gap-1.5"
                          onClick={handleClose}
                          disabled={loading || !isVoucherBalanced}
                        >
                          <XCircleIcon className="w-4 h-4" />
                          <span>
                            खाते कायमस्वरूपी बंद करा आणि व्हाउचर जनरेट करा (₹ {effectiveNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })})
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Passing Mode Action Bar */}
      {isPassingMode && (
        <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200 flex justify-between items-center print:hidden">
          <button
            type="button"
            onClick={() => (onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting'))}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded text-xs border border-gray-300 transition cursor-pointer"
          >
            ↩️ पासिंग यादीवर परत जा (Back to Queue)
          </button>
          <div className="flex space-x-3">
            <button
              type="button"
              disabled={passingActionLoading}
              onClick={() => setRejectModalOpen(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs shadow transition disabled:opacity-50 cursor-pointer"
            >
              ❌ नामंजूर / रद्द करा (Reject & Rollback)
            </button>
            <button
              type="button"
              disabled={passingActionLoading || !passingVoucherData?.canPass}
              onClick={handlePassVoucher}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow transition disabled:opacity-50 cursor-pointer"
            >
              {passingActionLoading ? 'पास करत आहे...' : '✅ मंजूर व पास करा (Approve & Pass)'}
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-md max-w-md w-full p-4 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-red-600">व्हाउचर नामंजूर / रद्द करा</h3>
            <p className="text-xs text-gray-600">
              हे व्हाउचर रद्द केल्यास पिग्मी खाते, सायकल, कर्ज वजावट व तारण बोजा मूळ स्थितीवर पूर्ववत (Lossless Rollback) केले जातील. कृपया कारण नमूद करा:
            </p>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-xs"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="नामंजूरीचे कारण लिहा..."
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold hover:bg-gray-50 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                disabled={passingActionLoading || !rejectReason.trim()}
                onClick={handleRejectVoucher}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {passingActionLoading ? 'प्रक्रिया सुरू...' : 'पुष्टी करा व रद्द करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable A4/A5 Pigmy Settlement Receipt Modal */}
      {receiptModalData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 print:static print:bg-transparent print:p-0">
          <div className="bg-white rounded-md max-w-2xl w-full p-6 shadow-2xl border border-gray-300 space-y-4 print:shadow-none print:border print:max-w-full">
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-sm">
                <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                <span>पिग्मी परतावा पावती तयार (Settlement Receipt)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-primary hover:bg-[#004a75] text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <PrinterIcon className="w-4 h-4" />
                  <span>प्रिंट करा (Print)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptModalData(null)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  बंद करा
                </button>
              </div>
            </div>

            {/* Printable Receipt Content */}
            <div className="border-2 border-gray-800 p-4 space-y-3 text-gray-900">
              <div className="text-center border-b border-gray-400 pb-2">
                <h2 className="text-base font-extrabold">
                  {sansthaDetail?.sansthaNameMarathi || sansthaDetail?.sansthaName || 'पतसंस्था मर्यादित'}
                </h2>
                {sansthaDetail?.address && <p className="text-[11px] text-gray-600">{sansthaDetail.address}</p>}
                <div className="mt-1 inline-block px-3 py-0.5 bg-gray-900 text-white text-xs font-bold rounded">
                  {receiptModalData.type === 'Closure'
                    ? 'पिग्मी ठेव खाते बंद परतावा पावती (Pigmy Closure Settlement Voucher)'
                    : 'पिग्मी अंशतः विड्रॉल परतावा पावती (Pigmy Withdrawal Voucher)'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-b border-gray-300 pb-2">
                <div><strong>खातेदाराचे नाव:</strong> {receiptModalData.customerName}</div>
                <div className="text-right"><strong>दिनांक:</strong> {new Date(receiptModalData.date).toLocaleDateString('en-GB')}</div>
                <div><strong>पिग्मी खाते क्र.:</strong> {receiptModalData.accountNo} {receiptModalData.legacyAccountNo ? `(जुना: ${receiptModalData.legacyAccountNo})` : ''}</div>
                <div className="text-right"><strong>व्हाउचर क्र.:</strong> <span className="font-mono">{receiptModalData.voucherNo}</span></div>
                <div><strong>योजना:</strong> {receiptModalData.schemeName || '-'} (सायकल #{receiptModalData.cycleNumber})</div>
                <div className="text-right"><strong>पेमेंट माध्यम:</strong> {receiptModalData.paymentMode}</div>
              </div>

              <table className="w-full text-xs border border-gray-400 border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-400">
                    <th className="p-2 text-left border-r border-gray-400">तपशील (Particulars)</th>
                    <th className="p-2 text-right w-36">रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  <tr>
                    <td className="p-2 border-r border-gray-400">
                      {receiptModalData.type === 'Closure' ? 'एकूण जमा पिग्मी ठेव मुद्दल' : 'मागितलेली पिग्मी विड्रॉल मुद्दल'}
                    </td>
                    <td className="p-2 text-right font-mono font-bold">{receiptModalData.principalAmount.toFixed(2)}</td>
                  </tr>
                  {receiptModalData.penaltyAmount > 0 && (
                    <tr>
                      <td className="p-2 border-r border-gray-400 text-rose-800">
                        वजा: मुदतपूर्व पिग्मी कमिशन / दंड कपात
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-rose-700">- {receiptModalData.penaltyAmount.toFixed(2)}</td>
                    </tr>
                  )}
                  {receiptModalData.interestAmount > 0 && (
                    <tr>
                      <td className="p-2 border-r border-gray-400 text-emerald-800">अधिक: देय पिग्मी व्याज</td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-700">+ {receiptModalData.interestAmount.toFixed(2)}</td>
                    </tr>
                  )}
                  <tr className="bg-gray-50 font-extrabold">
                    <td className="p-2 border-r border-gray-400">एकूण निव्वळ देय रक्कम (Net Payable)</td>
                    <td className="p-2 text-right font-mono text-sm">₹ {receiptModalData.netPayableAmount.toFixed(2)}</td>
                  </tr>
                  {receiptModalData.loanAdjustedAmount > 0 && (
                    <>
                      <tr>
                        <td className="p-2 border-r border-gray-400 text-indigo-900">
                          वजा: कर्ज खाते समायोजन ({receiptModalData.targetLoanNo || 'Loan Account'})
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-indigo-800">- {receiptModalData.loanAdjustedAmount.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="p-2 border-r border-gray-400 font-bold">
                          खातेदारास अदा शिल्लक परतावा ({receiptModalData.surplusPaymentMode || 'Cash'})
                        </td>
                        <td className="p-2 text-right font-mono font-bold">₹ {receiptModalData.surplusPayoutAmount.toFixed(2)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>

              {receiptModalData.type === 'Withdrawal' && (
                <div className="text-[11px] text-gray-700">
                  <strong>उर्वरित पिग्मी खाते शिल्लक:</strong> ₹ {receiptModalData.remainingBalance.toFixed(2)} (नवीन सायकल #{receiptModalData.cycleNumber + 1})
                </div>
              )}

              <div className="pt-8 grid grid-cols-3 gap-4 text-center text-[11px] font-bold">
                <div className="border-t border-gray-500 pt-1">रक्कम घेणाऱ्याची सही (खातेदार)</div>
                <div className="border-t border-gray-500 pt-1">लिपिक / कॅशियर सही</div>
                <div className="border-t border-gray-500 pt-1">शाखा व्यवस्थापक सही</div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PigmyClosureMaster;

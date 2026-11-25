import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getCachedMasterData } from '../utils/apiCache';
import { 
  BookOpen, 
  Layers, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  DollarSign, 
  Clock, 
  Scale,
  Calendar,
  Check,
  Info,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Edit3,
  RotateCcw,
  Lock,
  Unlock,
  X,
  Printer
} from 'lucide-react';
import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import BankLedgerSelect from './common/BankLedgerSelect';
import SearchableSelect from './SearchableSelect';
import { RawLedgerItem, filterBankAccountLedgers } from '../utils/bankLedgerUtils';
import { FdInterestScheduleModal, FdScheduleOverdueInfo } from './FdInterestScheduleModal';
import { generateFdInterestSchedule, FdScheduleSummary } from '../utils/fdInterestSchedule';
import FdReceiptPrintModal from './FdReceiptPrintModal';
import { formatDateDDMMYYYY } from '../utils/dateFormat';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountType?: string;
  groupID?: number;
}

interface SavingAccount {
  savingAccountID: number;
  accountNo: string;
  memberID: number;
  currentBalance: number;
  minimumBalance?: number;
  lienAmount?: number;
  status: string;
  ledger?: Ledger;
}

interface ActiveLoanItem {
  loanAccountId: number;
  loanAccountNo: string;
  loanType: string;
  principalBalance: number;
  interestBalance: number;
  accruedInterest?: number;
  accruedDays?: number;
  interestCalculatedFrom?: string;
  overdueInterestBalance: number;
  totalDue: number;
  openingDate: string;
  sanctionedAmount: number;
  interestRate: number;
  interestCalculationMethod?: string;
}

interface ActiveLoansResponse {
  hasActiveLoan: boolean;
  hasDirectLien?: boolean;
  directLienLoanNo?: string | null;
  totalOutstandingLiability: number;
  loans: ActiveLoanItem[];
}

interface FdAccount {
  fdAccountID: number;
  branchID: number;
  accountNo: string;
  receiptNo?: string | null;
  parentFdAccountID?: number | null;
  renewalCycleNo?: number;
  customerID?: number;
  customerName?: string;
  cifNo?: string;
  memberID?: number;
  memberName?: string;
  memberCode?: string;
  schemeName: string;
  fdSchemeID: number;
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  legacyAccruedInt: number;
  lastInterestPostingDate?: string | null;
  status: string;
  isLienMarked?: boolean;
  lienLoanAccountNo?: string | null;
  lienAmount?: number | null;
  fdLiabilityLedgerID?: number | null;
  fdLiabilityLedgerName?: string;
  interestExpenseLedgerID?: number | null;
  interestExpenseLedgerName?: string;
  interestPayableLedgerID?: number | null;
  interestPayableLedgerName?: string;
  prematurePenaltyLedgerID?: number | null;
  prematurePenaltyLedgerName?: string;
  birthDate?: string | null;
  isSeniorCitizen?: boolean;
  legacyAccountNumber?: string | null;
  isLegacyAccount?: boolean;
  alreadyPostedInterest?: number;
  backedLegacyProvision?: number;
  effectiveProvisionInterest?: number;
  alreadyCapitalizedInterest?: number;
  totalPostedInterest?: number;
  interestPostingMethod?: string;
  interestCompoundingFrequency?: string;
  branchName?: string;
}

// प्रभावी स्थिती: API status + मुदतपूर्ती तारीख (CBS व्यवसाय तारखेनुसार Matured / Active / इतर)
const getFdEffectiveStatus = (
  acc: Pick<FdAccount, 'status' | 'maturityDate'>,
  referenceDateIso?: string
): { key: string; label: string } => {
  const raw = (acc.status || '').trim();
  const rawLower = raw.toLowerCase();
  const now = new Date();
  const fallbackTodayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const refIso = (referenceDateIso || fallbackTodayIso).split('T')[0];
  const matIso = acc.maturityDate ? acc.maturityDate.split('T')[0] : '';

  if (rawLower === '' || rawLower === 'active' || rawLower === 'matured') {
    if (matIso && matIso > refIso) {
      return { key: 'Active', label: 'चालू (Active)' };
    }
    if (rawLower === 'matured' || (matIso && matIso <= refIso)) {
      return { key: 'Matured', label: 'मुदतपूर्ण (Matured)' };
    }
    return { key: 'Active', label: 'चालू (Active)' };
  }
  return { key: raw, label: raw };
};

export interface FdSchemeInterestSlab {
  slabID?: number;
  fdSchemeID?: number;
  fromDays: number | string;
  toDays: number | string;
  interestRate: number | string;
  seniorCitizenRate: number | string;
  prematureRate?: number | string;
  isActive?: boolean;
}

export interface PrematureRateResolution {
  prematureRate: number;
  slabRate: number;
  penaltyRate: number;
  matchedSlabText: string;
  isMinimumPeriodViolated: boolean;
  resolutionNote: string;
}

interface FdScheme {
  fdSchemeID: number;
  schemeName: string;
  schemeCode?: string;
  interestRate: number;
  seniorCitizenInterestRate?: number;
  interestType?: string;
  durationMonths: number;
  durationType?: string;
  schemeDurationModel?: string;
  prematureInterestRate?: number;
  fdLiabilityLedgerID?: number | null;
  fdLiabilityLedger?: Ledger | null;
  fdLiabilityLedgerName?: string;
  interestExpenseLedgerID?: number | null;
  interestExpenseLedger?: Ledger | null;
  interestExpenseLedgerName?: string;
  interestPayableLedgerID?: number | null;
  interestPayableLedger?: Ledger | null;
  interestPayableLedgerName?: string;
  prematurePenaltyLedgerID?: number | null;
  prematurePenaltyLedger?: Ledger | null;
  prematurePenaltyLedgerName?: string;
  allowOverdueInterest?: boolean;
  overdueInterestRate?: number | null;
  overdueGraceDays?: number | null;
  overdueRenewalPolicy?: string | null;
  slabs?: FdSchemeInterestSlab[];
  branchID?: number | null;
  branch?: { branchID: number; branchName: string } | null;
}

// ---------- CBS-style layout primitives (label left, field right) ----------
const FormRow: React.FC<{ label: string; required?: boolean; align?: 'center' | 'start'; children: React.ReactNode }> = ({
  label,
  required,
  align = 'center',
  children
}) => (
  <div className={`grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-x-3 gap-y-1 ${align === 'start' ? 'sm:items-start' : 'sm:items-center'}`}>
    <label className={`text-[12px] font-semibold text-slate-600 sm:text-right leading-tight ${align === 'start' ? 'sm:pt-1.5' : ''}`}>
      {label}
      {required && <span className="text-red-600 ml-0.5">*</span>}
    </label>
    <div className="min-w-0">{children}</div>
  </div>
);

const SectionTitle: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div className="flex items-center justify-between gap-2 mb-2">
    <h2 className="text-[12px] font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
      <span className="w-1 h-4 bg-primary rounded-sm" />
      {title}
    </h2>
    {right}
  </div>
);

const InfoItem: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline gap-2 min-w-0">
    <span className="w-28 shrink-0 text-[11px] text-slate-500">{label}</span>
    <span className="text-xs font-semibold text-slate-900 truncate">{children}</span>
  </div>
);

export interface FdWithdrawalMaturityProps {
  voucherId?: number;
  isPassingMode?: boolean;
  onNavigate?: (tab: string) => void;
}

const FdWithdrawalMaturity: React.FC<FdWithdrawalMaturityProps> = ({
  voucherId: propVoucherId,
  isPassingMode: propIsPassingMode,
  onNavigate
}) => {
  const { user } = useAuth();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const isHOUser = user?.role === 'Admin' || user?.role === 'SuperAdmin' || user?.role === 'HeadOffice' || user?.role === 'HO_Manager';
  const [allowDateOverride, setAllowDateOverride] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const voucherIdFromUrl = urlParams.get('voucherId') ? parseInt(urlParams.get('voucherId')!) : undefined;
  const isPassingModeFromUrl = urlParams.get('passingMode') === 'true';

  const voucherId = propVoucherId || voucherIdFromUrl;
  const isPassingMode = propIsPassingMode || isPassingModeFromUrl;

  const [passingVoucherData, setPassingVoucherData] = useState<any | null>(null);
  const [passingLoading, setPassingLoading] = useState<boolean>(false);
  const [passingActionLoading, setPassingActionLoading] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [accounts, setAccounts] = useState<FdAccount[]>([]);
  const [schemes, setSchemes] = useState<FdScheme[]>(() => getCachedMasterData('/api/FdSchemes') || []);
  const [allLedgers, setAllLedgers] = useState<RawLedgerItem[]>(() => getCachedMasterData('/api/Ledgers') || []);
  const [bankLedgers, setBankLedgers] = useState<Ledger[]>(() => filterBankAccountLedgers(getCachedMasterData('/api/Ledgers') || []) as Ledger[]);
  const [selectedAccId, setSelectedAccId] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<FdAccount | null>(null);

  // Multi-FD Selection Modal State (CIF-First)
  const [customerMatchingFds, setCustomerMatchingFds] = useState<FdAccount[]>([]);
  const [showMultiFdModal, setShowMultiFdModal] = useState<boolean>(false);
  const [multiFdCustomerInfo, setMultiFdCustomerInfo] = useState<{
    name: string;
    cifNo: string;
    customerId?: number;
  } | null>(null);
  const [noFdFoundAlert, setNoFdFoundAlert] = useState<string | null>(null);

  // Reopen Closed Account Modal State (Explicit Manual Reopen)
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenSearchTerm, setReopenSearchTerm] = useState<string>('');
  const [reopenReason, setReopenReason] = useState<string>('क्लोजर व्हाउचर डिलीट झाल्याने खाते पूर्ववत');
  const [reopenLoading, setReopenLoading] = useState<boolean>(false);
  const [allClosedAccounts, setAllClosedAccounts] = useState<FdAccount[]>([]);

  const [actionType, setActionType] = useState<string>('MaturityClose'); // MaturityClose, PrematureClose, Renewal
  const manualActionChoiceAccIdRef = React.useRef<number>(0);
  const [closureDate, setClosureDate] = useState<string>(activeBusinessDate);
  const [renewalType, setRenewalType] = useState<string>('PrincipalPlusInterest'); // PrincipalOnly, PrincipalPlusInterest
  const [targetSchemeId, setTargetSchemeId] = useState<number>(0);
  const [renewalDurationValue, setRenewalDurationValue] = useState<number>(12);
  const [renewalDurationType, setRenewalDurationType] = useState<'Days' | 'Months' | 'Years'>('Months');
  const [renewalInterestRateInput, setRenewalInterestRateInput] = useState<string>('');
  const [isRenewalRateManuallyEdited, setIsRenewalRateManuallyEdited] = useState<boolean>(false);
  const [renewedSuccessData, setRenewedSuccessData] = useState<any | null>(null);
  const [showReceiptPrintModal, setShowReceiptPrintModal] = useState<boolean>(false);
  const [printInitialSide, setPrintInitialSide] = useState<'front' | 'endorsement'>('front');
  const [printAccountData, setPrintAccountData] = useState<any | null>(null);
  const openRenewedPrintModal = (data: any, side: 'front' | 'endorsement') => {
    setPrintAccountData({
      fdAccountID: data.fdAccountID || 0,
      accountNo: data.newAccountNo,
      receiptNo: data.newReceiptNo || data.newAccountNo,
      oldReceiptNo: data.oldReceiptNo,
      oldAccountNo: data.oldAccountNo,
      oldDepositAmount: data.oldDepositAmount,
      effectivePolicy: data.effectivePolicy,
      durationText: data.duration,
      branchName: data.branchName,
      renewalCycleNo: data.renewalCycleNo || 1,
      parentFdAccountID: data.parentFdAccountID || null,
      customerName: data.customerName,
      cifNo: data.cifNo,
      schemeName: data.schemeName,
      schemeCode: data.schemeCode,
      depositAmount: data.depositAmount,
      interestRate: data.interestRate,
      openingDate: data.openingDateIso || data.openingDate,
      maturityDate: data.maturityDateIso || data.maturityDate,
      maturityAmount: data.maturityAmount,
      status: 'Active',
      interestType: data.interestType,
      monthlyInterestAmount: data.monthlyInterestAmount
    });
    setPrintInitialSide(side);
    setShowReceiptPrintModal(true);
  };
  const [sansthaRenewalPolicy, setSansthaRenewalPolicy] = useState<'NEW_RECEIPT' | 'RETAIN_ORIGINAL' | 'NEXT_LEGACY' | 'HYBRID_CHOICE'>('NEW_RECEIPT');
  const [allowManualRenewalReceipt, setAllowManualRenewalReceipt] = useState<boolean>(false);
  const [sansthaPolicyError, setSansthaPolicyError] = useState<string>('');
  const [receiptNoMode, setReceiptNoMode] = useState<'NEW_RECEIPT' | 'RETAIN_ORIGINAL' | 'NEXT_LEGACY' | 'CUSTOM'>('NEW_RECEIPT');
  const [customReceiptNo, setCustomReceiptNo] = useState<string>('');
  const [nextLegacyPreview, setNextLegacyPreview] = useState<string>('');

  const computeDaysForTenor = (baseDateStr: string, dType: 'Days' | 'Months' | 'Years', dVal: number): number => {
    const start = new Date((baseDateStr || activeBusinessDate) + 'T00:00:00');
    if (isNaN(start.getTime())) return dVal;
    if (dType === 'Days') return Math.max(1, dVal);
    const end = new Date(start);
    if (dType === 'Years') {
      end.setFullYear(end.getFullYear() + dVal);
    } else {
      end.setMonth(end.getMonth() + dVal);
    }
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const resolveDefaultRenewalTenorForScheme = (
    sch: FdScheme | undefined,
    acc?: FdAccount | null
  ): { durType: 'Days' | 'Months' | 'Years'; durVal: number } => {
    let contractedDays = Number((acc as any)?.durationInDays || 0);
    if (contractedDays <= 0 && acc?.openingDate && acc?.maturityDate) {
      const oDt = new Date(acc.openingDate.split('T')[0] + 'T00:00:00');
      const mDt = new Date(acc.maturityDate.split('T')[0] + 'T00:00:00');
      if (!isNaN(oDt.getTime()) && !isNaN(mDt.getTime()) && mDt > oDt) {
        contractedDays = Math.round((mDt.getTime() - oDt.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    let durType: 'Days' | 'Months' | 'Years' = ((sch?.durationType as any) || 'Months');
    let durVal: number = sch && sch.durationMonths > 0 ? sch.durationMonths : 12;

    if (acc && sch && acc.fdSchemeID === sch.fdSchemeID) {
      const accDurVal = Number((acc as any).durationValue || 0);
      const accDurType = (acc as any).durationType as ('Days' | 'Months' | 'Years' | undefined);
      if (accDurVal > 0 && (accDurType === 'Days' || accDurType === 'Months' || accDurType === 'Years')) {
        durType = accDurType;
        durVal = accDurVal;
      } else if (contractedDays > 0) {
        durType = 'Days';
        durVal = contractedDays;
      }
    }

    if (sch && sch.schemeDurationModel === 'Slab' && sch.slabs && sch.slabs.length > 0) {
      const activeSlabs = sch.slabs.filter(s => s.isActive !== false);
      if (activeSlabs.length > 0) {
        const candidateDays = computeDaysForTenor(closureDate, durType, durVal);
        const fitsCurrent = activeSlabs.some(s => candidateDays >= Number(s.fromDays) && candidateDays <= Number(s.toDays));
        if (!fitsCurrent) {
          if (contractedDays > 0 && activeSlabs.some(s => contractedDays >= Number(s.fromDays) && contractedDays <= Number(s.toDays))) {
            durType = 'Days';
            durVal = contractedDays;
          } else {
            const sortedSlabs = [...activeSlabs].sort(
              (a, b) => Math.abs(Number(a.fromDays) - candidateDays) - Math.abs(Number(b.fromDays) - candidateDays)
            );
            durType = 'Days';
            durVal = Math.max(1, Number(sortedSlabs[0].fromDays));
          }
        }
      }
    }

    return { durType, durVal };
  };

  const handleTargetSchemeChange = (nextSchemeId: number) => {
    setTargetSchemeId(nextSchemeId);
    setIsRenewalRateManuallyEdited(false);
    const sch = schemes.find(s => s.fdSchemeID === nextSchemeId);
    if (sch) {
      const { durType, durVal } = resolveDefaultRenewalTenorForScheme(sch, selectedAccount);
      setRenewalDurationType(durType);
      setRenewalDurationValue(durVal);
    }
  };

  // Automatically sync renewal scheme & valid tenor whenever selected FD account or schemes list loads/changes
  useEffect(() => {
    setIsRenewalRateManuallyEdited(false);
    if (schemes.length === 0) return;
    if (selectedAccount) {
      const matchedSch =
        schemes.find(s => s.fdSchemeID === selectedAccount.fdSchemeID) ||
        schemes.find(s => s.schemeName === selectedAccount.schemeName) ||
        schemes[0];
      if (matchedSch) {
        setTargetSchemeId(matchedSch.fdSchemeID);
        const { durType, durVal } = resolveDefaultRenewalTenorForScheme(matchedSch, selectedAccount);
        setRenewalDurationType(durType);
        setRenewalDurationValue(durVal);
      }
    }
  }, [selectedAccount?.fdAccountID, schemes.length]);

  // Sync CBS Business Date if changed
  useEffect(() => {
    if (user?.businessDate) {
      const bDate = user.businessDate.split('T')[0];
      setClosureDate(bDate);
      setChequeDate(bDate);
    }
  }, [user?.businessDate]);

  // Overdue interest & Renewal Effective controls
  const [applyOverdueInterest, setApplyOverdueInterest] = useState<boolean>(true);
  const [overdueInterestRate, setOverdueInterestRate] = useState<number>(3.00); // Standard SB / Overdue Rate 3%
  const [renewalEffectiveFrom, setRenewalEffectiveFrom] = useState<'ClosureDate' | 'MaturityDate'>('ClosureDate');

  // Payment Mode states
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'Transfer'>('Cash');
  const [bankAccountLedgerID, setBankAccountLedgerID] = useState<number>(0);
  const [chequeNo, setChequeNo] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(activeBusinessDate);
  const [memberSavingAccounts, setMemberSavingAccounts] = useState<SavingAccount[]>([]);
  const [selectedSavingAccountId, setSelectedSavingAccountId] = useState<number | ''>('');
  const [adjustInLoan, setAdjustInLoan] = useState<boolean>(false);
  const [targetLoanAccountId, setTargetLoanAccountId] = useState<number>(0);
  const [loanAdjustmentAmount, setLoanAdjustmentAmount] = useState<string>('');
  const [surplusPaymentMode, setSurplusPaymentMode] = useState<'Cash' | 'Bank' | 'Transfer'>('Cash');
  const [surplusBankLedgerID, setSurplusBankLedgerID] = useState<number>(0);
  const [surplusSavingAccountId, setSurplusSavingAccountId] = useState<number | ''>('');
  const [surplusChequeNo, setSurplusChequeNo] = useState<string>('');
  const [narration, setNarration] = useState<string>('');

  // Active Loans Info state (Informational only)
  const [activeLoansData, setActiveLoansData] = useState<ActiveLoansResponse | null>(null);
  const [loadingLoans, setLoadingLoans] = useState<boolean>(false);

  // UI toggle states
  const [showVoucherPreview, setShowVoucherPreview] = useState<boolean>(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [showInlineSchedule, setShowInlineSchedule] = useState<boolean>(false);

  // 🛡️ Live Premature Preview State from Backend (RBI Tenor Slabs Resolution)
  const [prematurePreview, setPrematurePreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // ✍️ Manual Amount Override states (Legacy Reconciliation)
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [manualOverrideReason, setManualOverrideReason] = useState<string>('');
  const [customAccruedInterest, setCustomAccruedInterest] = useState<string>('');
  const [customOverdueInterest, setCustomOverdueInterest] = useState<string>('');
  const [customPrematureInterest, setCustomPrematureInterest] = useState<string>('');
  const getDefaultDebitModeForAccount = (_acc?: FdAccount | null): 'Split' => 'Split';

  const [interestDebitMode, setInterestDebitMode] = useState<'Split'>('Split');
  const [postedIntrDebitInput, setPostedIntrDebitInput] = useState<string>('');
  const [postedIntrLedgerId, setPostedIntrLedgerId] = useState<number | ''>('');
  const [expenseIntrDebitInput, setExpenseIntrDebitInput] = useState<string>('');
  const [expenseIntrLedgerId, setExpenseIntrLedgerId] = useState<number | ''>('');
  const [enablePrematureReversal, setEnablePrematureReversal] = useState<boolean>(false);
  const [prematureReversalInput, setPrematureReversalInput] = useState<string>('');
  const [reversalCreditLedgerId, setReversalCreditLedgerId] = useState<number | ''>('');

  const handleResetManualOverride = (targetAcc?: FdAccount | null) => {
    const accRef = targetAcc !== undefined ? targetAcc : selectedAccount;
    setIsManualOverride(false);
    setManualOverrideReason('');
    setCustomAccruedInterest('');
    setCustomOverdueInterest('');
    setCustomPrematureInterest('');
    setInterestDebitMode(getDefaultDebitModeForAccount(accRef));
    setPostedIntrDebitInput('');
    setPostedIntrLedgerId('');
    setExpenseIntrDebitInput('');
    setExpenseIntrLedgerId('');
    setEnablePrematureReversal(false);
    setPrematureReversalInput('');
    setReversalCreditLedgerId('');
  };

  useEffect(() => {
    if (!selectedAccount || isPassingMode) return;
    setInterestDebitMode(getDefaultDebitModeForAccount(selectedAccount));
    setPostedIntrDebitInput('');
    setPostedIntrLedgerId('');
    setExpenseIntrDebitInput('');
    setExpenseIntrLedgerId('');
    setEnablePrematureReversal(false);
    setPrematureReversalInput('');
    setReversalCreditLedgerId('');
  }, [selectedAccount?.fdAccountID, isPassingMode]);

  useEffect(() => {
    if (!selectedAccount || isPassingMode) return;
    setPostedIntrDebitInput('');
    setExpenseIntrDebitInput('');
    setEnablePrematureReversal(false);
    setPrematureReversalInput('');
  }, [actionType]);

  useEffect(() => {
    if (isPassingMode && voucherId) {
      loadPassingClosure(voucherId);
    }
  }, [isPassingMode, voucherId]);

  const loadPassingClosure = async (vId: number) => {
    setPassingLoading(true);
    try {
      const res = await axios.get(`/api/FdAccounts/closure-by-voucher/${vId}`);
      const { fdAccount, closureDetails, voucher } = res.data;
      setPassingVoucherData(voucher);

      if (fdAccount) {
        setSelectedAccId(fdAccount.fdAccountID);
        setSelectedAccount(fdAccount);
      }
      if (closureDetails) {
        setActionType(closureDetails.closureType || 'MaturityClose');
        if (closureDetails.closureDate) {
          setClosureDate(closureDetails.closureDate.split('T')[0]);
        }
        if (closureDetails.narration) {
          setNarration(closureDetails.narration);
        }
      }
    } catch (err: any) {
      console.error('Error loading FD closure/renewal voucher:', err);
      alert('मुदत ठेव व्हाउचर लोड करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    const actionLabel = actionType === 'Renewal' ? 'नूतनीकरण' : 'क्लोजर';
    if (!window.confirm(`आपण खात्रीपूर्वक हे मुदत ठेव ${actionLabel} व्हाउचर मंजूर व पास करू इच्छिता?`)) return;
    setPassingActionLoading(true);
    try {
      await axios.post('/api/VoucherPosting/Post', [voucherId]);
      alert('व्हाउचर यशस्वीरीत्या मंजूर व पास करण्यात आले!');
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      alert('व्हाउचर पास करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    if (!voucherId) return;
    if (!rejectReason.trim()) {
      alert('कृपया नामंजूर / रद्द करण्याचे कारण नमूद करा.');
      return;
    }
    setPassingActionLoading(true);
    try {
      await axios.delete(`/api/VoucherPosting/${voucherId}?reason=${encodeURIComponent(rejectReason)}`);
      alert('व्हाउचर यशस्वीरित्या नामंजूर / रद्द करण्यात आले!');
      setRejectModalOpen(false);
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      alert('व्हाउचर रद्द करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingActionLoading(false);
    }
  };

  const calculatePrematureRate = (
    account: FdAccount,
    scheme: FdScheme | null | undefined,
    actualDays: number
  ): number => {
    return resolvePrematureRateDetails(account, scheme, actualDays).prematureRate;
  };

  const resolvePrematureRateDetails = (
    account: FdAccount,
    scheme: FdScheme | null | undefined,
    actualDays: number
  ): PrematureRateResolution => {
    const isSenior = account.isSeniorCitizen || (account.birthDate ? (new Date(closureDate).getTime() - new Date(account.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000) >= 60 : false);

    if (scheme?.slabs && scheme.slabs.length > 0) {
      const activeSlabs = scheme.slabs.filter(s => s.isActive !== false);
      if (activeSlabs.length > 0) {
        let minFromDays = Math.min(...activeSlabs.map(s => Number(s.fromDays)));
        if ((scheme as any)?.minDurationDays && Number((scheme as any).minDurationDays) > 0) {
          minFromDays = Math.min(minFromDays, Number((scheme as any).minDurationDays));
        }

        // 1. Minimum Holding Period Rule: RBI & MCS Act mandates 0% interest if closed before minimum tenor
        if (actualDays < minFromDays) {
          return {
            prematureRate: 0,
            slabRate: 0,
            penaltyRate: 0,
            matchedSlabText: `किमान ${minFromDays} दिवस आवश्यक (ठेव फक्त ${actualDays} दिवस)`,
            isMinimumPeriodViolated: true,
            resolutionNote: `आरबीआय नियमानुसार किमान ठेव कालावधीपूर्वी (${actualDays} दिवस < ${minFromDays} दिवस) बंद केल्याने ०.००% (शून्य) व्याज देय आहे.`
          };
        }

        // 2. Exact Run Period Slab Match
        const matched = activeSlabs.find(s => actualDays >= Number(s.fromDays) && actualDays <= Number(s.toDays));
        if (matched) {
          const sRate = isSenior && Number(matched.seniorCitizenRate) > 0 ? Number(matched.seniorCitizenRate) : Number(matched.interestRate);
          if (Number(matched.prematureRate) > 0) {
            const finalPrematureRate = Math.min(account.interestRate, Number(matched.prematureRate));
            const penalty = Math.max(0, account.interestRate - finalPrematureRate);
            return {
              prematureRate: finalPrematureRate,
              slabRate: sRate,
              penaltyRate: penalty,
              matchedSlabText: `${matched.fromDays} ते ${matched.toDays} दिवस (स्लॅब दर: ${sRate}%)`,
              isMinimumPeriodViolated: false,
              resolutionNote: `कालावधी स्लॅब (${matched.fromDays}-${matched.toDays} दिवस) पूर्वनिर्धारित मुदतपूर्व दर ${finalPrematureRate}% थेट लागू.`
            };
          }

          const penalty = 1.0;
          const baseRate = Math.min(account.interestRate, sRate);
          const finalPrematureRate = Math.max(0, baseRate - penalty);
          return {
            prematureRate: finalPrematureRate,
            slabRate: sRate,
            penaltyRate: penalty,
            matchedSlabText: `${matched.fromDays} ते ${matched.toDays} दिवस (स्लॅब दर: ${sRate}%)`,
            isMinimumPeriodViolated: false,
            resolutionNote: `आरबीआय स्लॅब नियम: प्रत्यक्ष ${actualDays} दिवस स्लॅब (${matched.fromDays}-${matched.toDays} दिवस) दर ${sRate}%, मूळ करार दर ${account.interestRate}%, दंड -${penalty}% -> अंतिम लागू मुदतपूर्व दर: ${finalPrematureRate}%`
          };
        }

        // Held beyond max slab
        const sorted = [...activeSlabs].sort((a, b) => Number(b.toDays) - Number(a.toDays));
        const maxSlab = sorted[0];
        if (maxSlab && actualDays > Number(maxSlab.toDays)) {
          const sRate = isSenior && Number(maxSlab.seniorCitizenRate) > 0 ? Number(maxSlab.seniorCitizenRate) : Number(maxSlab.interestRate);
          const penalty = 1.0;
          const baseRate = Math.min(account.interestRate, sRate);
          const finalPrematureRate = Math.max(0, baseRate - penalty);
          return {
            prematureRate: finalPrematureRate,
            slabRate: sRate,
            penaltyRate: penalty,
            matchedSlabText: `${maxSlab.fromDays} ते ${maxSlab.toDays}+ दिवस (कमाल स्लॅब दर: ${sRate}%)`,
            isMinimumPeriodViolated: false,
            resolutionNote: `आरबीआय स्लॅब नियम: प्रत्यक्ष ${actualDays} दिवस कमाल स्लॅब (${maxSlab.fromDays}-${maxSlab.toDays} दिवस) दर ${sRate}%, करार दर ${account.interestRate}%, दंड -${penalty}% -> अंतिम लागू मुदतपूर्व दर: ${finalPrematureRate}%`
          };
        }
      }
    }

    // Fallback for Fixed schemes with no active slabs
    const minHoldingDays = (scheme as any)?.minDurationDays || 7;
    if (actualDays < minHoldingDays) {
      return {
        prematureRate: 0,
        slabRate: 0,
        penaltyRate: 0,
        matchedSlabText: `किमान ${minHoldingDays} दिवस आवश्यक (ठेव फक्त ${actualDays} दिवस)`,
        isMinimumPeriodViolated: true,
        resolutionNote: `आरबीआय नियमानुसार किमान ठेव कालावधीपूर्वी (${actualDays} दिवस < ${minHoldingDays} दिवस) बंद केल्याने ०.००% (शून्य) व्याज देय आहे.`
      };
    }

    const fixedPenalty = 1.0;
    const fixedPremature = (scheme?.prematureInterestRate && scheme.prematureInterestRate > 0)
      ? Math.min(account.interestRate, Number(scheme.prematureInterestRate))
      : Math.max(0, account.interestRate - fixedPenalty);
    const effPenalty = (scheme?.prematureInterestRate && scheme.prematureInterestRate > 0)
      ? Math.max(0, account.interestRate - fixedPremature)
      : fixedPenalty;

    return {
      prematureRate: fixedPremature,
      slabRate: account.interestRate,
      penaltyRate: effPenalty,
      matchedSlabText: 'फिक्स्ड योजना (विना-स्लॅब)',
      isMinimumPeriodViolated: false,
      resolutionNote: `फिक्स्ड योजना करार दर: ${account.interestRate}%, दंड: -${effPenalty}% -> अंतिम मुदतपूर्व दर: ${fixedPremature}%`
    };
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = '/api';

  useEffect(() => {
    fetchAccounts();
    fetchSchemes();
    fetchBankLedgers();
    axios
      .get(`${API_URL}/SansthaDetails`)
      .then((res) => {
        const row = Array.isArray(res.data) ? res.data[0] : res.data;
        if (!row) {
          setSansthaPolicyError('संस्था पावती क्रमांक धोरण माहिती उपलब्ध नाही. कृपया संस्था मास्टर तपासा.');
          return;
        }
        setSansthaPolicyError('');
        const pol = (row.fdRenewalReceiptPolicy || 'NEW_RECEIPT') as 'NEW_RECEIPT' | 'RETAIN_ORIGINAL' | 'NEXT_LEGACY' | 'HYBRID_CHOICE';
        setSansthaRenewalPolicy(pol);
        const allowManual = pol === 'RETAIN_ORIGINAL' ? false : Boolean(row.allowManualReceiptNoOnRenewal);
        setAllowManualRenewalReceipt(allowManual);
        setReceiptNoMode(
          pol === 'RETAIN_ORIGINAL'
            ? 'RETAIN_ORIGINAL'
            : pol === 'NEXT_LEGACY'
            ? 'NEXT_LEGACY'
            : 'NEW_RECEIPT'
        );
      })
      .catch((err) => {
        console.error('Failed to fetch SansthaDetails FD renewal policy', err);
        setSansthaPolicyError('संस्था पावती धोरण लोड करण्यात त्रुटी आली. कृपया नेटवर्क तपासून पेज रिफ्रेश करा.');
      });
  }, []);

  useEffect(() => {
    const branchId = selectedAccount?.branchID;
    const schemeId = targetSchemeId > 0 ? targetSchemeId : selectedAccount?.fdSchemeID;
    const needsNextLegacyPreview =
      Boolean(branchId && branchId > 0) &&
      (sansthaRenewalPolicy === 'NEXT_LEGACY' ||
        receiptNoMode === 'NEXT_LEGACY' ||
        sansthaRenewalPolicy === 'HYBRID_CHOICE');

    if (!needsNextLegacyPreview || !branchId) {
      setNextLegacyPreview('');
      return;
    }

    let cancelled = false;
    const qs = schemeId && schemeId > 0 ? `?schemeId=${schemeId}` : '';
    axios
      .get(`${API_URL}/FdAccounts/next-account-no/${branchId}${qs}`)
      .then((res) => {
        if (!cancelled) {
          setNextLegacyPreview(res.data?.nextLegacyAccountNo ? String(res.data.nextLegacyAccountNo) : '');
        }
      })
      .catch((err) => {
        console.error('Failed to fetch next legacy FD number preview', err);
        if (!cancelled) setNextLegacyPreview('');
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAccount?.branchID, selectedAccount?.fdSchemeID, targetSchemeId, sansthaRenewalPolicy, receiptNoMode]);

  const fetchBankLedgers = async () => {
    try {
      const res = await axios.get(`${API_URL}/Ledgers`);
      const rawLedgers: RawLedgerItem[] = Array.isArray(res.data) ? res.data : [];
      setAllLedgers(rawLedgers);
      const filteredBanks = filterBankAccountLedgers(rawLedgers);
      setBankLedgers(filteredBanks as Ledger[]);
    } catch (e) {
      console.error('Error fetching bank ledgers', e);
    }
  };

  const fetchCustomerSavingsAccounts = async (customerId?: number, memberId?: number) => {
    if ((!customerId || customerId <= 0) && (!memberId || memberId <= 0)) {
      setMemberSavingAccounts([]);
      setSelectedSavingAccountId('');
      setSurplusSavingAccountId('');
      return;
    }
    try {
      const url = customerId 
        ? `${API_URL}/SavingAccounts?customerId=${customerId}`
        : `${API_URL}/SavingAccounts?memberId=${memberId}`;
      const res = await axios.get(url);
      const list: SavingAccount[] = Array.isArray(res.data)
        ? res.data.filter((a: any) => a.status === 'Active' || !a.status)
        : [];
      setMemberSavingAccounts(list);
      if (list.length > 0) {
        setSelectedSavingAccountId(list[0].savingAccountID);
        setSurplusSavingAccountId(list[0].savingAccountID);
      } else {
        setSelectedSavingAccountId('');
      }
    } catch (err) {
      console.error('Error fetching customer savings accounts', err);
      setMemberSavingAccounts([]);
      setSelectedSavingAccountId('');
    }
  };

  const fetchActiveLoans = async (fdAccountId: number, asOfDateStr?: string) => {
    if (!fdAccountId || fdAccountId <= 0) {
      setActiveLoansData(null);
      return;
    }
    setLoadingLoans(true);
    try {
      const qDate = asOfDateStr || closureDate;
      const res = await axios.get(`${API_URL}/FdAccounts/${fdAccountId}/ActiveLoans`, {
        params: qDate ? { asOfDate: qDate } : {}
      });
      const data: ActiveLoansResponse = res.data;
      setActiveLoansData(data);
      if (data?.hasActiveLoan && Array.isArray(data.loans) && data.loans.length > 0) {
        const directMatch = data.directLienLoanNo
          ? data.loans.find(l => l.loanAccountNo === data.directLienLoanNo)
          : undefined;
        setTargetLoanAccountId(prev =>
          directMatch
            ? directMatch.loanAccountId
            : (prev > 0 && data.loans.some(l => l.loanAccountId === prev) ? prev : data.loans[0].loanAccountId)
        );
        if (!isPassingMode) {
          const matchedAcc =
            (selectedAccount && selectedAccount.fdAccountID === fdAccountId ? selectedAccount : null) ||
            accounts.find(a => a.fdAccountID === fdAccountId);
          const isDirectLien = Boolean(data.hasDirectLien || matchedAcc?.isLienMarked);
          setAdjustInLoan(isDirectLien);
          if (isDirectLien && matchedAcc && manualActionChoiceAccIdRef.current !== fdAccountId) {
            const cDt = new Date((asOfDateStr || closureDate || activeBusinessDate) + 'T00:00:00');
            const mDt = new Date(matchedAcc.maturityDate.split('T')[0] + 'T00:00:00');
            if (!isNaN(cDt.getTime()) && !isNaN(mDt.getTime()) && cDt.getTime() >= mDt.getTime()) {
              setActionType('Renewal');
            }
          }
        }
      } else {
        setTargetLoanAccountId(0);
        setAdjustInLoan(false);
      }
    } catch (err) {
      console.error('Error fetching active loans', err);
      setActiveLoansData(null);
    } finally {
      setLoadingLoans(false);
    }
  };

  // 🛡️ Fetch Live Premature Preview from Server API
  const fetchPrematurePreview = async (accId: number, asOfDateStr?: string) => {
    if (!accId || accId <= 0) {
      setPrematurePreview(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const qDate = asOfDateStr || closureDate;
      const res = await axios.get(`${API_URL}/FdAccounts/${accId}/PrematurePreview`, {
        params: qDate ? { closureDate: qDate } : {}
      });
      setPrematurePreview(res.data);
    } catch (err) {
      console.error('Error fetching premature preview', err);
      setPrematurePreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // 🔄 Re-fetch premature preview whenever closureDate, selectedAccId or actionType changes
  useEffect(() => {
    if (actionType === 'PrematureClose' && selectedAccId && selectedAccId > 0 && closureDate) {
      fetchPrematurePreview(selectedAccId, closureDate);
    } else if (actionType !== 'PrematureClose') {
      setPrematurePreview(null);
    }
  }, [actionType, selectedAccId, closureDate]);

  // 🔄 Re-fetch active loans with recalculated accrued interest whenever closureDate or selectedAccount changes
  useEffect(() => {
    if (selectedAccId && selectedAccId > 0 && closureDate) {
      fetchActiveLoans(selectedAccId, closureDate);
    }
  }, [selectedAccId, closureDate]);

  const fetchAccounts = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      let entityIdStr = params.get('entityId');
      let fdAccountIdStr = params.get('fdAccountId') || params.get('id');
      let customerIdStr = params.get('customerId') || params.get('customerID');
      let cifStr = params.get('cifNo') || params.get('cif');
      let memberIdStr = params.get('memberId') || params.get('memberID');
      let customerNameStr = params.get('customerName');

      // Also read universal sessionStorage transfer bridge
      if (!cifStr && !customerIdStr && !memberIdStr && !fdAccountIdStr && !entityIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              cifStr = bridgeData.cifNo || bridgeData.cif;
              customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
              memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
              customerNameStr = bridgeData.customerName || customerNameStr;
            }
          }
        } catch (e) {
          console.error('Failed to read sessionStorage transfer:', e);
        }
      }

      const getAccCustId = (a: any) => Number(a.customerID ?? a.customerId ?? a.CustomerID ?? 0);
      const getAccMemId = (a: any) => Number(a.memberID ?? a.memberId ?? a.MemberID ?? 0);
      const getAccCif = (a: any) => String(a.cifNo ?? a.CIFNo ?? a.cif ?? '').trim().toUpperCase();

      const applySelectedFd = (acc: FdAccount) => {
        manualActionChoiceAccIdRef.current = 0;
        setSelectedAccId(acc.fdAccountID);
        setSelectedAccount(acc);
        if (paymentMode === 'Transfer' || surplusPaymentMode === 'Transfer') {
          fetchCustomerSavingsAccounts(acc.customerID, acc.memberID);
        }
      };

      const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
      const targetAccId = fdAccountIdStr ? parseInt(fdAccountIdStr, 10) : (entityIdStr ? parseInt(entityIdStr, 10) : 0);
      let fastTrackDone = false;

      // ⚡ FAST-TRACK 1: Direct targeted account ID lookup (~15-20ms)
      if (targetAccId > 0) {
        try {
          const singleRes = await axios.get(`${API_URL}/FdAccounts/${targetAccId}`);
          if (singleRes.data && singleRes.data.fdAccountID) {
            const acc: FdAccount = singleRes.data;
            applySelectedFd(acc);
            setAccounts([acc]);
            setCustomerMatchingFds([acc]);
            fastTrackDone = true;
          }
        } catch (err) {
          console.warn('Fast-track targeted FD account lookup failed, falling back', err);
        }
      }
      // ⚡ FAST-TRACK 2: Direct targeted customer ID lookup (~20-30ms)
      else if (cId > 0) {
        try {
          const custRes = await axios.get(`${API_URL}/FdAccounts?customerId=${cId}`);
          const custAccounts: FdAccount[] = (custRes.data || []).filter((a: any) => a.status !== 'Closed');
          if (custAccounts.length > 0) {
            setAccounts(custAccounts);
            if (custAccounts.length === 1) {
              applySelectedFd(custAccounts[0]);
              setCustomerMatchingFds(custAccounts);
              setNoFdFoundAlert(null);
            } else {
              setCustomerMatchingFds(custAccounts);
              const custName = customerNameStr || custAccounts[0].customerName || custAccounts[0].memberName || 'खातेदार';
              const primaryCif = cifStr || custAccounts[0].cifNo || '-';
              setMultiFdCustomerInfo({
                name: custName,
                cifNo: primaryCif,
                customerId: cId
              });
              setShowMultiFdModal(true);
              setNoFdFoundAlert(null);
            }
            fastTrackDone = true;
          }
        } catch (err) {
          console.warn('Fast-track customer FD lookup failed, falling back', err);
        }
      }

      // Background loading of full accounts list for dropdown searches
      axios.get(`${API_URL}/FdAccounts`).then(response => {
        const rawList: FdAccount[] = response.data || [];
        setAllClosedAccounts(rawList.filter((a: any) => a.status === 'Closed' || a.status === 'Renewed'));
        const activeList: FdAccount[] = rawList.filter((a: any) => a.status !== 'Closed' && a.status !== 'Renewed');
        setAccounts(prev => {
          // Keep current selection intact when updating full list
          if (prev.length > 0 && fastTrackDone) {
            return activeList;
          }
          return activeList;
        });

        // If fast-track did not trigger (e.g. CIF without CustomerID), process in-memory
        if (!fastTrackDone && (cifStr || customerIdStr || memberIdStr || entityIdStr || fdAccountIdStr)) {
          const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
          const cleanCif = cifStr ? cifStr.trim().toUpperCase() : '';
          const cleanDigits = cleanCif ? cleanCif.replace(/\D/g, '') : '';

          let matched: FdAccount[] = [];

          if (targetAccId > 0) {
            matched = activeList.filter((a: any) => a.fdAccountID === targetAccId);
          } else if (cleanCif) {
            matched = activeList.filter((a: any) => {
              const aCif = getAccCif(a);
              if (!aCif) return false;
              if (aCif === cleanCif) return true;
              if (cleanDigits && aCif.replace(/\D/g, '') === cleanDigits) return true;
              return false;
            });
          } else if (cId > 0) {
            matched = activeList.filter((a: any) => getAccCustId(a) === cId);
          } else if (mId > 0) {
            matched = activeList.filter((a: any) => getAccMemId(a) === mId || getAccCustId(a) === mId);
          }

          if (matched.length === 1) {
            applySelectedFd(matched[0]);
            setCustomerMatchingFds(matched);
            setNoFdFoundAlert(null);
          } else if (matched.length > 1) {
            setCustomerMatchingFds(matched);
            const custName = customerNameStr || matched[0].customerName || matched[0].memberName || 'खातेदार';
            const primaryCif = cleanCif || getAccCif(matched[0]) || '-';
            setMultiFdCustomerInfo({
              name: custName,
              cifNo: primaryCif,
              customerId: cId || getAccCustId(matched[0])
            });
            setShowMultiFdModal(true);
            setNoFdFoundAlert(null);
          } else {
            setCustomerMatchingFds([]);
            const identifier = cleanCif ? `CIF: ${cleanCif}` : (cId ? `ID: ${cId}` : `Member: ${mId}`);
            setNoFdFoundAlert(`निवडलेल्या खातेदाराची (${customerNameStr || identifier}) कोणतीही सक्रिय मुदत ठेव (FD) आढळली नाही.`);
          }
        }
      }).catch(err => {
        console.error('Error fetching full FD accounts list', err);
      });
    } catch (err) {
      console.error('Error in fetchAccounts:', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdSchemes`);
      const list: FdScheme[] = response.data || [];
      setSchemes(list);
      if (list.length > 0) {
        setTargetSchemeId(list[0].fdSchemeID);
        setRenewalDurationValue(list[0].durationMonths > 0 ? list[0].durationMonths : 12);
        setRenewalDurationType((list[0].durationType as any) || 'Months');
      }
    } catch (err) {
      console.error('Error fetching schemes', err);
    }
  };

  const handleAccountSelect = (val: any) => {
    const accId = typeof val === 'object' && val?.target ? parseInt(val.target.value) : parseInt(String(val || 0));
    manualActionChoiceAccIdRef.current = 0;
    setSelectedAccId(accId);
    const selected = accounts.find((a) => a.fdAccountID === accId) || null;
    setSelectedAccount(selected);
    setError('');
    setSuccess('');
    setAdjustInLoan(false);
    setLoanAdjustmentAmount('');
    setSurplusPaymentMode('Cash');
    setSurplusBankLedgerID(0);
    setSurplusChequeNo('');
    handleResetManualOverride(selected);
    if (selected) {
      if (paymentMode === 'Transfer' || surplusPaymentMode === 'Transfer') {
        fetchCustomerSavingsAccounts(selected.customerID, selected.memberID);
      }
    } else {
      setMemberSavingAccounts([]);
      setSelectedSavingAccountId('');
      setActiveLoansData(null);
    }
  };

  useEffect(() => {
    if (selectedAccount && (paymentMode === 'Transfer' || surplusPaymentMode === 'Transfer')) {
      fetchCustomerSavingsAccounts(selectedAccount.customerID, selectedAccount.memberID);
    }
  }, [paymentMode, surplusPaymentMode, selectedAccount?.fdAccountID]);

  const handleReopenAccount = async (targetAcc: FdAccount) => {
    if (!targetAcc) return;
    const confirmMsg = `आपण खात्रीपूर्वक मुदत ठेव खाते क्र. ${targetAcc.accountNo}${targetAcc.legacyAccountNumber ? ` (जुना क्र. ${targetAcc.legacyAccountNumber})` : ''} पुन्हा सक्रिय (Reopen) करू इच्छिता?`;
    if (!window.confirm(confirmMsg)) return;

    setReopenLoading(true);
    try {
      const res = await axios.post(`${API_URL}/FdAccounts/${targetAcc.fdAccountID}/Reopen`, {
        reason: reopenReason || 'क्लोजर व्हाउचर डिलीट झाल्याने खाते पूर्ववत'
      });

      alert(res.data?.message || 'खाते यशस्वीरीत्या पूर्ववत करण्यात आले आहे.');

      // Refresh accounts list
      const accRes = await axios.get(`${API_URL}/FdAccounts`);
      const rawList: FdAccount[] = accRes.data || [];
      const updatedClosed = rawList.filter((a: any) => a.status === 'Closed' || a.status === 'Renewed');
      const updatedActive = rawList.filter((a: any) => a.status !== 'Closed' && a.status !== 'Renewed');
      setAllClosedAccounts(updatedClosed);
      setAccounts(updatedActive);

      // Automatically select the reopened account
      const reopened = updatedActive.find(a => a.fdAccountID === targetAcc.fdAccountID) || targetAcc;
      setSelectedAccId(reopened.fdAccountID);
      setSelectedAccount(reopened);
      fetchCustomerSavingsAccounts(reopened.customerID, reopened.memberID);
      fetchActiveLoans(reopened.fdAccountID);

      setShowReopenModal(false);
      setReopenSearchTerm('');
    } catch (err: any) {
      console.error('Reopen account error:', err);
      alert('खाते पूर्ववत करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setReopenLoading(false);
    }
  };

  const accountScheme = schemes.find(
    (s) => s.fdSchemeID === selectedAccount?.fdSchemeID || s.schemeName === selectedAccount?.schemeName
  );

  useEffect(() => {
    if (accountScheme) {
      const allowed = accountScheme.allowOverdueInterest ?? false;
      setApplyOverdueInterest(allowed);
      if (accountScheme.overdueInterestRate !== null && accountScheme.overdueInterestRate !== undefined) {
        setOverdueInterestRate(Number(accountScheme.overdueInterestRate));
      }
      if (accountScheme.overdueRenewalPolicy === 'MaturityDate' || accountScheme.overdueRenewalPolicy === 'ClosureDate') {
        setRenewalEffectiveFrom(accountScheme.overdueRenewalPolicy as 'ClosureDate' | 'MaturityDate');
      }
    }
  }, [accountScheme]);

  // Maturity Date validation helper
  const checkIsMatured = () => {
    if (!selectedAccount) return false;
    const closureDt = new Date(closureDate || activeBusinessDate);
    closureDt.setHours(0, 0, 0, 0);

    const matDt = new Date(selectedAccount.maturityDate);
    matDt.setHours(0, 0, 0, 0);

    return closureDt.getTime() >= matDt.getTime();
  };

  const isMatured = checkIsMatured();
  const isPendingMaturityAction = Boolean((actionType === 'MaturityClose' || actionType === 'Renewal') && selectedAccount && !isMatured);

  // Synchronize Action Type with Maturity Status automatically so form is never in an invalid/error state
  useEffect(() => {
    if (!selectedAccount) return;
    const closureDt = new Date(closureDate || activeBusinessDate);
    closureDt.setHours(0, 0, 0, 0);

    const matDt = new Date(selectedAccount.maturityDate);
    matDt.setHours(0, 0, 0, 0);

    const accountIsMatured = closureDt.getTime() >= matDt.getTime();

    if (!accountIsMatured) {
      if (actionType !== 'PrematureClose') {
        setActionType('PrematureClose');
      }
    } else {
      if (
        !isPassingMode &&
        selectedAccount.isLienMarked &&
        manualActionChoiceAccIdRef.current !== selectedAccount.fdAccountID
      ) {
        setActionType('Renewal');
      } else if (actionType === 'PrematureClose') {
        setActionType('MaturityClose');
      }
    }
  }, [selectedAccount, closureDate]);

  // Opening Date validation helper (Prevent Backdating before Opening Date)
  const isBeforeOpeningDate = Boolean(
    selectedAccount &&
    closureDate &&
    new Date(closureDate + 'T00:00:00').getTime() < new Date(selectedAccount.openingDate.split('T')[0] + 'T00:00:00').getTime()
  );

  const todayStr = activeBusinessDate;
  const isFutureDate = Boolean(closureDate && closureDate > todayStr);

  // Accrual Date validation helper (Prevent Backdating before Last Interest Accrual)
  const isBeforeLastAccrual = Boolean(
    selectedAccount?.lastInterestPostingDate &&
    closureDate &&
    new Date(closureDate + 'T00:00:00').getTime() < new Date(selectedAccount.lastInterestPostingDate.split('T')[0] + 'T00:00:00').getTime()
  );

  // Minimum allowed date: whichever is later between OpeningDate and LastInterestPostingDate
  const effectiveMinDate = selectedAccount
    ? (selectedAccount.lastInterestPostingDate && selectedAccount.lastInterestPostingDate > selectedAccount.openingDate
        ? selectedAccount.lastInterestPostingDate.split('T')[0]
        : selectedAccount.openingDate.split('T')[0])
    : undefined;

  // Savings Transfer Backdating Validation (Prevent Scrambling Passbook Running Balance & SMS Mismatch)
  const isBackdatedSavingsTransfer = Boolean(
    ((actionType === 'MaturityClose' || actionType === 'PrematureClose') && !adjustInLoan && paymentMode === 'Transfer' && closureDate < todayStr) ||
    ((actionType === 'MaturityClose' || actionType === 'PrematureClose') && adjustInLoan && surplusPaymentMode === 'Transfer' && closureDate < todayStr) ||
    (actionType === 'Renewal' && renewalType === 'PrincipalOnly' && paymentMode === 'Transfer' && Boolean(selectedSavingAccountId) && closureDate < todayStr)
  );

  // Overdue calculation helper
  const getOverdueDetails = () => {
    if (!selectedAccount) return { isOverdue: false, overdueDays: 0, overdueInterest: 0, baseAmount: 0, isAllowedByScheme: false, effectiveOverdueRate: 0 };
    const closureDt = new Date(closureDate || activeBusinessDate);
    closureDt.setHours(0, 0, 0, 0);

    const matDt = new Date(selectedAccount.maturityDate);
    matDt.setHours(0, 0, 0, 0);

    const diffTime = closureDt.getTime() - matDt.getTime();
    const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const isOverdue = overdueDays > 0;

    // CBS Banking Rule: Overdue interest is strictly calculated on Principal (depositAmount)
    const baseAmount = selectedAccount.depositAmount;

    const isAllowedByScheme = accountScheme ? Boolean(accountScheme.allowOverdueInterest) : false;
    const effectiveOverdueRate = accountScheme?.overdueInterestRate != null ? Number(accountScheme.overdueInterestRate) : overdueInterestRate;

    let overdueInterest = 0;
    if (isOverdue && isAllowedByScheme && applyOverdueInterest && effectiveOverdueRate > 0) {
      if (actionType === 'Renewal' && renewalEffectiveFrom === 'MaturityDate') {
        overdueInterest = 0;
      } else {
        overdueInterest = Math.round((baseAmount * effectiveOverdueRate * overdueDays) / 36500);
      }
    }

    return { isOverdue, overdueDays, overdueInterest, baseAmount, isAllowedByScheme, effectiveOverdueRate };
  };

  const { isOverdue, overdueDays, overdueInterest, baseAmount: overdueBaseAmount, isAllowedByScheme, effectiveOverdueRate } = getOverdueDetails();

  // Helper to format date in Indian DD/MM/YYYY standard
  const formatDateDisplay = (dateStr?: string | null): string => {
    if (!dateStr) return '-';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Generate Period-wise Contracted Interest Schedule
  const scheduleSummary = React.useMemo(() => {
    if (!selectedAccount) return null;
    const scheme = accountScheme;
    return generateFdInterestSchedule({
      depositAmount: selectedAccount.depositAmount,
      interestRate: selectedAccount.interestRate,
      openingDate: selectedAccount.openingDate,
      maturityDate: selectedAccount.maturityDate,
      schemeType: scheme?.interestType || 'Cumulative',
      compoundingFrequency: (scheme as any)?.interestCompoundingFrequency || 'Quarterly',
      targetMaturityAmount: selectedAccount.maturityAmount,
    });
  }, [selectedAccount, accountScheme]);

  const overdueModalDetails: FdScheduleOverdueInfo | undefined = isOverdue && overdueInterest > 0 ? {
    isOverdue: true,
    overdueDays,
    overdueInterest,
    closureDate,
    effectiveOverdueRate,
    baseAmount: overdueBaseAmount
  } : undefined;

  // 📅 Calculate Elapsed / Run Days from Opening Date up to Transaction Closure Date
  const elapsedDaysInfo = React.useMemo(() => {
    if (!selectedAccount) return null;
    try {
      const startDt = new Date(selectedAccount.openingDate.split('T')[0] + 'T00:00:00');
      const matDt = new Date(selectedAccount.maturityDate.split('T')[0] + 'T00:00:00');
      const txnDt = new Date((closureDate || activeBusinessDate).split('T')[0] + 'T00:00:00');

      const contractedDays = Math.max(0, Math.round((matDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)));
      const elapsedDays = Math.max(0, Math.round((txnDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)));
      const overdueDays = Math.max(0, Math.round((txnDt.getTime() - matDt.getTime()) / (1000 * 60 * 60 * 24)));
      const remainingDays = Math.max(0, contractedDays - elapsedDays);

      return {
        contractedDays,
        elapsedDays,
        overdueDays,
        remainingDays,
        isMatured: txnDt.getTime() >= matDt.getTime(),
        isOverdue: overdueDays > 0,
        isExactMaturity: txnDt.getTime() === matDt.getTime(),
        isPremature: txnDt.getTime() < matDt.getTime()
      };
    } catch {
      return null;
    }
  }, [selectedAccount, closureDate, activeBusinessDate]);

  // 🔄 Live Renewal Simulation & Maturity Calculator
  const renewalSimulation = React.useMemo(() => {
    if (actionType !== 'Renewal' || !selectedAccount || targetSchemeId <= 0) return null;
    const targetScheme = schemes.find(s => s.fdSchemeID === targetSchemeId);
    if (!targetScheme) return null;

    const principal = selectedAccount.depositAmount;
    const totalMaturity = selectedAccount.maturityAmount && selectedAccount.maturityAmount > selectedAccount.depositAmount
      ? selectedAccount.maturityAmount
      : (selectedAccount.depositAmount + (selectedAccount.legacyAccruedInt || 0));
    const systemAccruedInt = Math.max(0, totalMaturity - principal);
    const systemOverdueInt = (isOverdue && renewalEffectiveFrom === 'ClosureDate') ? overdueInterest : 0;

    const effAccrued = isManualOverride && customAccruedInterest !== ''
      ? Math.max(0, parseFloat(customAccruedInterest) || 0)
      : systemAccruedInt;
    const effOverdue = isManualOverride && customOverdueInterest !== ''
      ? Math.max(0, parseFloat(customOverdueInterest) || 0)
      : systemOverdueInt;

    const totalAvailable = principal + effAccrued + effOverdue;
    const newDepositAmount = renewalType === 'PrincipalPlusInterest' ? totalAvailable : principal;
    const interestPayoutAmount = renewalType === 'PrincipalOnly' ? (effAccrued + effOverdue) : 0;

    // Simulation effective start date
    const isRetroactive = isOverdue && renewalEffectiveFrom === 'MaturityDate';
    const effectiveStartDateStr = isRetroactive ? selectedAccount.maturityDate.split('T')[0] : closureDate;
    const simOpeningDate = new Date(effectiveStartDateStr + 'T00:00:00');

    // Compute duration in days and new maturity date
    const durVal = renewalDurationValue > 0 ? renewalDurationValue : 12;
    const durType = renewalDurationType || 'Months';
    const simMaturityDate = new Date(simOpeningDate);
    let totalDays = 0;

    if (durType === 'Days') {
      totalDays = durVal;
      simMaturityDate.setDate(simMaturityDate.getDate() + totalDays);
    } else if (durType === 'Years') {
      simMaturityDate.setFullYear(simMaturityDate.getFullYear() + durVal);
      totalDays = Math.max(1, Math.round((simMaturityDate.getTime() - simOpeningDate.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      // Months
      simMaturityDate.setMonth(simMaturityDate.getMonth() + durVal);
      totalDays = Math.max(1, Math.round((simMaturityDate.getTime() - simOpeningDate.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Senior citizen eligibility check
    const isSenior = Boolean(selectedAccount.isSeniorCitizen);

    // Resolve rate (1-to-1 match with Backend FdAccountsController.Renew Slab check)
    let schemeDefaultRate = targetScheme.interestRate;
    let matchedSlab: FdSchemeInterestSlab | null = null;
    const activeSlabs = (targetScheme.slabs || []).filter(s => s.isActive !== false);
    const isSlabModel = targetScheme.schemeDurationModel === 'Slab' && activeSlabs.length > 0;

    if (isSlabModel) {
      const matched = activeSlabs.find(s => totalDays >= Number(s.fromDays) && totalDays <= Number(s.toDays));
      if (matched) {
        matchedSlab = matched;
        schemeDefaultRate = isSenior && Number(matched.seniorCitizenRate) > 0 ? Number(matched.seniorCitizenRate) : Number(matched.interestRate);
      } else {
        schemeDefaultRate = isSenior && Number(targetScheme.seniorCitizenInterestRate) > 0 ? Number(targetScheme.seniorCitizenInterestRate) : Number(targetScheme.interestRate);
      }
    } else {
      schemeDefaultRate = isSenior && Number(targetScheme.seniorCitizenInterestRate) > 0 ? Number(targetScheme.seniorCitizenInterestRate) : Number(targetScheme.interestRate);
    }

    const parsedManualRate = parseFloat(renewalInterestRateInput);
    const hasValidManualRate =
      isRenewalRateManuallyEdited &&
      renewalInterestRateInput.trim() !== '' &&
      Number.isFinite(parsedManualRate) &&
      parsedManualRate > 0;
    const appliedRate = hasValidManualRate ? Number(parsedManualRate.toFixed(2)) : schemeDefaultRate;
    const isCustomInterestRate = Math.abs(appliedRate - schemeDefaultRate) >= 0.01;

    const isSlabValid = !isSlabModel || matchedSlab !== null;
    const validSlabsText = isSlabModel
      ? activeSlabs.map(s => `${s.fromDays} ते ${s.toDays} दिवस`).join(', ')
      : '';

    // Maturity Amount Calculation (Exact CBS 365-day basis)
    const p = newDepositAmount;
    const r = appliedRate;
    let simMaturityAmount = 0;

    if (targetScheme.interestType === 'Cumulative') {
      let n = 4; // Quarterly
      const freq = (targetScheme as any).interestCompoundingFrequency || 'Quarterly';
      if (freq === 'Half-Yearly') n = 2;
      if (freq === 'Yearly') n = 1;
      if (freq === 'Monthly') n = 12;

      const baseVal = 1.0 + (r / (n * 100.0));
      const exponent = n * (totalDays / 365.0);
      simMaturityAmount = Math.round(p * Math.pow(baseVal, exponent));
    } else if (targetScheme.interestType === 'MIS' || targetScheme.interestType === 'Monthly Interest') {
      simMaturityAmount = p;
    } else {
      // Simple Interest
      simMaturityAmount = Math.round(p * (1.0 + (r * totalDays) / (36500.0)));
    }

    const estimatedInterest = Math.max(0, simMaturityAmount - newDepositAmount);
    const monthlyPayout = (targetScheme.interestType === 'MIS' || targetScheme.interestType === 'Monthly Interest')
      ? Math.round((p * r) / 1200.0)
      : 0;

    return {
      targetScheme,
      newDepositAmount,
      interestPayoutAmount,
      effectiveStartDateStr,
      simOpeningDate,
      simMaturityDate,
      simMaturityDateStr: `${String(simMaturityDate.getDate()).padStart(2, '0')}/${String(simMaturityDate.getMonth() + 1).padStart(2, '0')}/${simMaturityDate.getFullYear()}`,
      durVal,
      durType,
      totalDays,
      schemeDefaultRate,
      appliedRate,
      isCustomInterestRate,
      isSenior,
      matchedSlab,
      isSlabModel,
      isSlabValid,
      validSlabsText,
      simMaturityAmount,
      estimatedInterest,
      monthlyPayout
    };
  }, [
    actionType,
    selectedAccount,
    targetSchemeId,
    schemes,
    renewalType,
    renewalEffectiveFrom,
    isOverdue,
    overdueInterest,
    isManualOverride,
    customAccruedInterest,
    customOverdueInterest,
    closureDate,
    renewalDurationValue,
    renewalDurationType,
    renewalInterestRateInput,
    isRenewalRateManuallyEdited
  ]);

  // Auto-populate Renewal Interest Rate from scheme/slab/senior resolution unless operator manually edited it
  useEffect(() => {
    if (actionType !== 'Renewal' || !renewalSimulation) return;
    if (!isRenewalRateManuallyEdited) {
      setRenewalInterestRateInput(String(Number(renewalSimulation.schemeDefaultRate || 0)));
    }
  }, [
    actionType,
    renewalSimulation?.schemeDefaultRate,
    isRenewalRateManuallyEdited,
    selectedAccount?.fdAccountID,
    targetSchemeId
  ]);

  // Helper to resolve mapped ledgers for selected account scheme
  const resolveLedgerLabelFromId = (customId: number | '', fallbackName: string) => {
    if (customId && Number(customId) > 0) {
      const found = allLedgers.find(l => Number(l.ledgerID ?? l.LedgerID) === Number(customId));
      const nm = found?.ledgerName ?? found?.LedgerName;
      if (nm) return `${customId} - ${nm}`;
    }
    return fallbackName;
  };

  const getSchemeLedgers = () => {
    if (!selectedAccount) return null;
    const scheme = schemes.find(s => s.fdSchemeID === selectedAccount.fdSchemeID || s.schemeName === selectedAccount.schemeName);

    const fdLiability = selectedAccount.fdLiabilityLedgerName 
      || scheme?.fdLiabilityLedger?.ledgerName 
      || scheme?.fdLiabilityLedgerName 
      || '१२ मुदत ठेव देयता खाते (Fixed Deposit Liability)';

    const defaultInterestPayable = selectedAccount.interestPayableLedgerName 
      || scheme?.interestPayableLedger?.ledgerName 
      || scheme?.interestPayableLedgerName 
      || '२३ देणे मुदत ठेव व्याज (POSTING_INTR / Interest Payable)';

    const defaultInterestExpense = selectedAccount.interestExpenseLedgerName 
      || scheme?.interestExpenseLedger?.ledgerName 
      || scheme?.interestExpenseLedgerName 
      || '१३२ मुदत ठेवीवरील व्याज (NAFATOTA DEY VYAJ / Interest Expense)';

    const defaultPrematurePenalty = selectedAccount.prematurePenaltyLedgerName 
      || scheme?.prematurePenaltyLedger?.ledgerName 
      || scheme?.prematurePenaltyLedgerName 
      || defaultInterestExpense;

    const interestPayable = resolveLedgerLabelFromId(postedIntrLedgerId, defaultInterestPayable);
    const interestExpense = resolveLedgerLabelFromId(expenseIntrLedgerId, defaultInterestExpense);
    const prematurePenalty = resolveLedgerLabelFromId(reversalCreditLedgerId, defaultPrematurePenalty);

    let payoutLedgerName = '५१ हातातील रोख शिल्लक (Cash Account)';
    if (paymentMode === 'Bank') {
      const b = bankLedgers.find(l => l.ledgerID === bankAccountLedgerID);
      payoutLedgerName = b ? `${b.ledgerID} - ${b.ledgerName} (Bank A/c)` : 'बँक खाते लेजर (Bank GL)';
    } else if (paymentMode === 'Transfer') {
      const sAcc = memberSavingAccounts.find(s => s.savingAccountID === selectedSavingAccountId);
      payoutLedgerName = sAcc ? `७ - बचत ठेव खाते (${sAcc.accountNo})` : '७ - खातेदार बचत ठेव देयता खाते (SB Liability)';
    }

    return {
      fdLiability,
      interestPayable,
      interestExpense,
      prematurePenalty,
      defaultInterestPayable,
      defaultInterestExpense,
      defaultPrematurePenalty,
      cashLedger: payoutLedgerName,
      scheme
    };
  };

  // Helper to calculate total FD payout for the current action
  const getTotalFdPayout = () => {
    if (!selectedAccount) return 0;
    if (actionType === 'MaturityClose') {
      const principal = selectedAccount.depositAmount;
      const totalMaturity = selectedAccount.maturityAmount && selectedAccount.maturityAmount > selectedAccount.depositAmount
        ? selectedAccount.maturityAmount
        : (selectedAccount.depositAmount + (selectedAccount.legacyAccruedInt || 0));
      const systemAccruedInt = Math.max(0, totalMaturity - principal);
      const systemOverdueInt = isOverdue ? overdueInterest : 0;

      const effAccrued = isManualOverride && customAccruedInterest !== ''
        ? Math.max(0, parseFloat(customAccruedInterest) || 0)
        : systemAccruedInt;
      const effOverdue = isManualOverride && customOverdueInterest !== ''
        ? Math.max(0, parseFloat(customOverdueInterest) || 0)
        : systemOverdueInt;

      return principal + effAccrued + effOverdue;
    } else if (actionType === 'PrematureClose') {
      const principal = selectedAccount.depositAmount;
      const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
      const ledgers = getSchemeLedgers();
      const resolution = resolvePrematureRateDetails(selectedAccount, ledgers?.scheme, actualDays);
      const prematureRate = prematurePreview?.prematureRate ?? resolution.prematureRate;
      const systemRecalcInt = prematurePreview?.recalculatedInterest ?? Math.round((principal * prematureRate * actualDays) / 36500);

      const effRecalcInt = (isManualOverride || customPrematureInterest !== '') && customPrematureInterest !== ''
        ? Math.max(0, parseFloat(customPrematureInterest) || 0)
        : systemRecalcInt;

      const isPeriodic = ledgers?.scheme?.interestType === 'MIS' || ledgers?.scheme?.interestType === 'Monthly Interest';
      if (isPeriodic) {
        const cap = Number(prematurePreview?.alreadyCapitalizedInterest ?? selectedAccount.alreadyCapitalizedInterest ?? 0);
        const misPaid = Number(prematurePreview?.alreadyAccruedInterest ?? 0);
        const misAlready = misPaid + cap;
        if (misAlready > effRecalcInt) {
          return Math.max(0, principal - (misAlready - effRecalcInt));
        }
        return principal + Math.max(0, effRecalcInt - misAlready);
      }
      return principal + effRecalcInt;
    }
    return 0;
  };

  // Resolves 1-to-1 with Backend FdInterestSettlementHelper how interest is split across Capitalized (On Interest),
  // POSTING_INTR (Provision), NAFATOTA DEY VYAJ (Expense), and Premature Reversal (Clawback)
  const resolveInterestAccountingSplit = (
    acc: FdAccount,
    currentInterest: number,
    isPremature: boolean
  ) => {
    const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
    const safeInt = r2(Math.max(0, Number.isFinite(currentInterest) ? currentInterest : 0));
    const verifiedProvision = r2(
      isPremature
        ? Number(prematurePreview?.verifiedProvisionInterest ?? acc.alreadyPostedInterest ?? 0)
        : Number(acc.alreadyPostedInterest ?? 0)
    );
    const backedLegacyProvision = r2(
      isPremature
        ? Number(prematurePreview?.backedLegacyProvision ?? acc.backedLegacyProvision ?? 0)
        : Number(acc.backedLegacyProvision ?? 0)
    );
    const effectiveProvision = r2(verifiedProvision + backedLegacyProvision);
    const verifiedCapitalized = r2(
      isPremature
        ? Number(prematurePreview?.alreadyCapitalizedInterest ?? acc.alreadyCapitalizedInterest ?? 0)
        : Number(acc.alreadyCapitalizedInterest ?? 0)
    );
    const rawLegacyAccrued = r2(
      Math.max(
        0,
        Number(isPremature ? (prematurePreview?.legacyAccruedInterest ?? acc.legacyAccruedInt ?? 0) : (acc.legacyAccruedInt ?? 0))
      )
    );
    const unbackedLegacyMemo = r2(Math.max(0, rawLegacyAccrued - backedLegacyProvision));
    const legacyProvisionFallback = r2(Math.max(effectiveProvision, verifiedProvision + rawLegacyAccrued));
    const totalPostedAvailable = r2(effectiveProvision + verifiedCapitalized);
    const accountScheme = schemes.find(s => s.fdSchemeID === acc.fdSchemeID || s.schemeName === acc.schemeName);
    const isPeriodic = accountScheme?.interestType === 'MIS' || accountScheme?.interestType === 'Monthly Interest';

    const hasExplicitInputs =
      postedIntrDebitInput !== '' ||
      expenseIntrDebitInput !== '' ||
      (isPremature && (enablePrematureReversal || prematureReversalInput !== ''));

    if (isPremature && isPeriodic) {
      const misPaid = r2(Number(prematurePreview?.alreadyAccruedInterest ?? 0));
      const misAlready = r2(misPaid + verifiedCapitalized);
      const baseClawback = r2(Math.max(0, misAlready - safeInt));
      const extraPosted = postedIntrDebitInput !== '' ? r2(Math.max(0, parseFloat(postedIntrDebitInput) || 0)) : 0;
      const baseUnpaid = r2(Math.max(0, safeInt - misAlready));
      const expensePortion = expenseIntrDebitInput !== '' ? r2(Math.max(0, parseFloat(expenseIntrDebitInput) || 0)) : baseUnpaid;
      const extraRev = enablePrematureReversal && prematureReversalInput !== ''
        ? r2(Math.max(0, parseFloat(prematureReversalInput) || 0))
        : extraPosted;
      return {
        verifiedProvision,
        backedLegacyProvision,
        effectiveProvision,
        unbackedLegacyMemo,
        verifiedCapitalized,
        clearedCapitalized: verifiedCapitalized,
        legacyProvisionFallback,
        totalPostedAvailable,
        payablePortion: extraPosted > 0 ? extraPosted : Math.max(0, extraRev - baseClawback),
        expensePortion,
        clawbackAmount: r2(baseClawback + (extraPosted > 0 ? extraPosted : Math.max(0, extraRev - baseClawback))),
        effectiveMode: 'Split' as const
      };
    }

    // Default (no manual box edits yet): include VerifiedProvision + CustomerOpeningBalances-backed Legacy provision
    if (!hasExplicitInputs) {
      if (!isPremature) {
        const clearedCapitalized = Math.min(safeInt, verifiedCapitalized);
        const rem = r2(Math.max(0, safeInt - clearedCapitalized));
        const payablePortion = effectiveProvision > 0 ? Math.min(rem, effectiveProvision) : 0;
        const expensePortion = r2(Math.max(0, rem - payablePortion));
        return {
          verifiedProvision,
          backedLegacyProvision,
          effectiveProvision,
          unbackedLegacyMemo,
          verifiedCapitalized,
          clearedCapitalized,
          legacyProvisionFallback,
          totalPostedAvailable,
          payablePortion,
          expensePortion,
          clawbackAmount: 0,
          effectiveMode: 'Split' as const
        };
      }

      const clearedCapitalized = verifiedCapitalized;
      const payablePortion = effectiveProvision;
      const alreadyEffective = r2(clearedCapitalized + payablePortion);
      const expensePortion = r2(Math.max(0, safeInt - alreadyEffective));
      const clawbackAmount = r2(Math.max(0, alreadyEffective - safeInt));
      return {
        verifiedProvision,
        backedLegacyProvision,
        effectiveProvision,
        unbackedLegacyMemo,
        verifiedCapitalized,
        clearedCapitalized,
        legacyProvisionFallback,
        totalPostedAvailable,
        payablePortion,
        expensePortion,
        clawbackAmount,
        effectiveMode: 'Split' as const
      };
    }

    // Explicit Dual-Head Split (POSTING_INTR + NAFATOTA DEY VYAJ + Premature Reversal)
    if (!isPremature) {
      const clearedCapitalized = Math.min(safeInt, verifiedCapitalized);
      const rem = r2(Math.max(0, safeInt - clearedCapitalized));
      let payablePortion = 0;
      let expensePortion = rem;

      if (postedIntrDebitInput !== '' && expenseIntrDebitInput !== '') {
        payablePortion = r2(Math.max(0, parseFloat(postedIntrDebitInput) || 0));
        expensePortion = r2(Math.max(0, parseFloat(expenseIntrDebitInput) || 0));
      } else if (postedIntrDebitInput !== '') {
        payablePortion = Math.min(rem, r2(Math.max(0, parseFloat(postedIntrDebitInput) || 0)));
        expensePortion = r2(Math.max(0, rem - payablePortion));
      } else if (expenseIntrDebitInput !== '') {
        expensePortion = Math.min(rem, r2(Math.max(0, parseFloat(expenseIntrDebitInput) || 0)));
        payablePortion = r2(Math.max(0, rem - expensePortion));
      }

      return {
        verifiedProvision,
        backedLegacyProvision,
        effectiveProvision,
        unbackedLegacyMemo,
        verifiedCapitalized,
        clearedCapitalized,
        legacyProvisionFallback,
        totalPostedAvailable,
        payablePortion,
        expensePortion,
        clawbackAmount: 0,
        effectiveMode: 'Split' as const
      };
    }

    // Premature Explicit Dual-Head Split / Reversal
    const clearedCapitalized = verifiedCapitalized;
    const hasPostedStr = postedIntrDebitInput !== '';
    const hasExpenseStr = expenseIntrDebitInput !== '';
    const hasRevStr = enablePrematureReversal && prematureReversalInput !== '';

    let payablePortion = 0;
    let expensePortion = 0;
    let clawbackAmount = 0;

    if (hasPostedStr && hasExpenseStr) {
      payablePortion = r2(Math.max(0, parseFloat(postedIntrDebitInput) || 0));
      expensePortion = r2(Math.max(0, parseFloat(expenseIntrDebitInput) || 0));
      clawbackAmount = r2(Math.max(0, clearedCapitalized + payablePortion + expensePortion - safeInt));
    } else if (hasPostedStr) {
      payablePortion = r2(Math.max(0, parseFloat(postedIntrDebitInput) || 0));
      const revTarget = hasRevStr ? r2(Math.max(0, parseFloat(prematureReversalInput) || 0)) : 0;
      expensePortion = r2(Math.max(0, safeInt + revTarget - clearedCapitalized - payablePortion));
      clawbackAmount = r2(Math.max(0, clearedCapitalized + payablePortion + expensePortion - safeInt));
    } else if (hasRevStr) {
      const targetRev = r2(Math.max(0, parseFloat(prematureReversalInput) || 0));
      expensePortion = r2(Math.max(0, safeInt - clearedCapitalized));
      const neededTotalDr = safeInt + targetRev;
      let candPosted = r2(neededTotalDr - clearedCapitalized - expensePortion);
      if (candPosted < 0) {
        expensePortion = r2(Math.max(0, neededTotalDr - clearedCapitalized));
        candPosted = r2(Math.max(0, neededTotalDr - clearedCapitalized - expensePortion));
      }
      payablePortion = Math.max(0, candPosted);
      clawbackAmount = r2(Math.max(0, clearedCapitalized + payablePortion + expensePortion - safeInt));
    } else if (hasExpenseStr) {
      expensePortion = r2(Math.max(0, parseFloat(expenseIntrDebitInput) || 0));
      payablePortion = r2(Math.max(0, safeInt - clearedCapitalized - expensePortion));
      clawbackAmount = r2(Math.max(0, clearedCapitalized + payablePortion + expensePortion - safeInt));
    } else {
      payablePortion = effectiveProvision;
      expensePortion = r2(Math.max(0, safeInt - clearedCapitalized - payablePortion));
      clawbackAmount = r2(Math.max(0, clearedCapitalized + payablePortion - safeInt));
    }

    return {
      verifiedProvision,
      backedLegacyProvision,
      effectiveProvision,
      unbackedLegacyMemo,
      verifiedCapitalized,
      clearedCapitalized,
      legacyProvisionFallback,
      totalPostedAvailable,
      payablePortion,
      expensePortion,
      clawbackAmount,
      effectiveMode: 'Split' as const
    };
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedAccount) {
      setError('कृपया खाते निवडा.');
      return;
    }

    if (isBeforeOpeningDate) {
      setError(`⚠️ अवैध व्यवहाराची तारीख! व्यवहाराची तारीख (${closureDate.split('-').reverse().join('/')}) ही मुदत ठेव खाते उघडल्याच्या तारखेपेक्षा (${selectedAccount.openingDate.split('T')[0].split('-').reverse().join('/')}) आधीची असू शकत नाही.`);
      return;
    }

    if (isBeforeLastAccrual && selectedAccount?.lastInterestPostingDate) {
      setError(`⚠️ अवैध व्यवहाराची तारीख! या खात्यावर ${selectedAccount.lastInterestPostingDate.split('T')[0].split('-').reverse().join('/')} रोजी व्याज तरतूद (Interest Accrual) झालेली आहे. व्यवहाराची तारीख शेवटच्या व्याज तरतुदीच्या आधीची असू शकत नाही, अन्यथा ताळेबंदात देणे व्याज खात्यात निगेटिव्ह शिल्लक निर्माण होईल.`);
      return;
    }

    if (isFutureDate) {
      setError(`⚠️ अवैध व्यवहाराची तारीख! भविष्यातील तारीख (${closureDate.split('-').reverse().join('/')}) अनुज्ञेय नाही. व्यवहार आजच्या किंवा आजपूर्वीच्या तारखेचाच असावा.`);
      return;
    }

    if (isPendingMaturityAction) {
      setError(`⚠️ सदर मुदत ठेव पावती अद्याप मुदतपूर्ण (Matured) झालेली नाही! मुदतपूर्ती तारीख ${selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')} आहे.`);
      return;
    }

    if (isManualOverride && !manualOverrideReason.trim()) {
      setError('⚠️ मॅन्युअल रक्कम बदल सक्षम असल्यामुळे लेखापरीक्षणासाठी (Audit Trail) बदलाचे कारण देणे बंधनकारक आहे.');
      return;
    }

    const isClosureAction = actionType === 'MaturityClose' || actionType === 'PrematureClose';
    const hasActiveLoanForAdjust = Boolean(activeLoansData?.hasActiveLoan && Array.isArray(activeLoansData?.loans) && activeLoansData.loans.length > 0);
    const hasDirectLienBlock = Boolean(
      hasActiveLoanForAdjust
        ? Boolean(activeLoansData?.hasDirectLien)
        : Boolean(selectedAccount.isLienMarked)
    );
    const isLoanAdjustActive = Boolean(isClosureAction && adjustInLoan && hasActiveLoanForAdjust);

    if (isClosureAction && hasDirectLienBlock && !isLoanAdjustActive) {
      const lNo = activeLoansData?.directLienLoanNo || selectedAccount.lienLoanAccountNo || 'सक्रिय कर्ज';
      setError(`🚫 सदर मुदत ठेव पावतीवर कर्ज खाते क्र. '${lNo}' चा तारण बोजा नोंदवला आहे. कर्ज बाकी असताना ठेव मोडून परतावा घेता येत नाही — कृपया ठेव 'नूतनीकरण (FD Renewal)' करा किंवा 'सक्रिय कर्ज खात्यात समायोजित (Adjust in Loan)' निवडा.`);
      return;
    }

    let effectiveTargetLoanId = 0;
    let effectiveLoanAdjustVal = 0;
    let surplusVal = 0;

    if (isLoanAdjustActive && activeLoansData) {
      const totalPayoutForAdjust = getTotalFdPayout();
      const targetLoanObj =
        activeLoansData.loans.find(l => l.loanAccountId === targetLoanAccountId) || activeLoansData.loans[0];
      if (!targetLoanObj || !targetLoanObj.loanAccountId) {
        setError('कृपया मुदत ठेवीची रक्कम समायोजित करण्यासाठी कर्ज खाते निवडा.');
        return;
      }
      effectiveTargetLoanId = targetLoanObj.loanAccountId;
      const maxAdj = Math.min(totalPayoutForAdjust, targetLoanObj.totalDue);
      effectiveLoanAdjustVal =
        loanAdjustmentAmount !== ''
          ? Math.min(Math.max(0, parseFloat(loanAdjustmentAmount) || 0), maxAdj)
          : maxAdj;
      if (effectiveLoanAdjustVal <= 0) {
        setError('कर्जात समायोजित करावयाची रक्कम शून्यापेक्षा जास्त असणे आवश्यक आहे.');
        return;
      }
      if (hasDirectLienBlock && effectiveLoanAdjustVal + 0.01 < maxAdj) {
        setError(`🚫 सदर मुदत ठेव पावतीवर कर्जाचा तारण बोजा असल्यामुळे ठेव मोडताना किमान ₹${maxAdj.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} रक्कम तारण कर्जात समायोजित करणे बंधनकारक आहे (ठेव कायम ठेवायची असल्यास 'नूतनीकरण' निवडा).`);
        return;
      }
      surplusVal = Math.max(0, Number((totalPayoutForAdjust - effectiveLoanAdjustVal).toFixed(2)));

      if (surplusVal > 0) {
        if (surplusPaymentMode === 'Bank' && (!surplusBankLedgerID || surplusBankLedgerID <= 0)) {
          setError('शिल्लक परतावा बँकेद्वारे अदा करण्यासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
          return;
        }
        if (surplusPaymentMode === 'Transfer') {
          if (!surplusSavingAccountId || Number(surplusSavingAccountId) <= 0) {
            setError('⚠️ शिल्लक परतावा वर्ग करण्यासाठी खातेदाराचे कोणतेही सक्रिय बचत खाते निवडलेले नाही.');
            return;
          }
          if (closureDate < todayStr) {
            setError(`⚠️ बचत खात्यातील पासबुक विसंगती प्रतिबंध! शिल्लक परतावा बचत खात्यात वर्ग करताना मागील तारीख (${closureDate.split('-').reverse().join('/')}) अनुज्ञेय नाही.`);
            return;
          }
        }
      }
    } else {
      // Standard Payment Mode Validations
      if ((isClosureAction || (actionType === 'Renewal' && renewalType === 'PrincipalOnly')) && paymentMode === 'Bank') {
        if (!bankAccountLedgerID || bankAccountLedgerID <= 0) {
          setError('बँक व्यवहारासाठी बँक जी.एल. खाते (Bank GL Account) निवडणे बंधनकारक आहे.');
          return;
        }
      }

      if ((isClosureAction || (actionType === 'Renewal' && renewalType === 'PrincipalOnly')) && paymentMode === 'Transfer') {
        if (!selectedSavingAccountId || selectedSavingAccountId <= 0) {
          setError('⚠️ रक्कम वर्ग करण्यासाठी खातेदाराचे कोणतेही सक्रिय बचत खाते निवडलेले नाही.');
          return;
        }

        if (isBackdatedSavingsTransfer) {
          setError(`⚠️ बचत खात्यातील पासबुक विसंगती प्रतिबंध! बचत खात्यात (Saving Account Transfer) परतावा वर्ग करताना मागील तारीख (${closureDate.split('-').reverse().join('/')}) अनुज्ञेय नाही. पासबुकमधील रनिंग शिल्लक व एसएमएस ताळमेळ अचूक राहण्यासाठी हस्तांतरण आजच्याच तारखेने (${todayStr.split('-').reverse().join('/')}) होणे आवश्यक आहे.`);
          return;
        }
      }
    }

    const submitPrincipal = selectedAccount.depositAmount;
    const submitTotalMat = selectedAccount.maturityAmount && selectedAccount.maturityAmount > submitPrincipal
      ? selectedAccount.maturityAmount
      : (submitPrincipal + (selectedAccount.legacyAccruedInt || 0));
    const submitSysAccrued = Math.max(0, submitTotalMat - submitPrincipal);
    const submitActualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
    const submitLedgers = getSchemeLedgers();
    const submitRes = resolvePrematureRateDetails(selectedAccount, submitLedgers?.scheme, submitActualDays);
    const submitPremRate = prematurePreview?.prematureRate ?? submitRes.prematureRate;
    const submitSysRecalc = prematurePreview?.recalculatedInterest ?? Math.round((submitPrincipal * submitPremRate * submitActualDays) / 36500);
    const submitEffInterest = actionType === 'PrematureClose'
      ? (customPrematureInterest !== '' ? Math.max(0, parseFloat(customPrematureInterest) || 0) : (isManualOverride && customAccruedInterest !== '' ? Math.max(0, parseFloat(customAccruedInterest) || 0) : submitSysRecalc))
      : (isManualOverride && customAccruedInterest !== '' ? Math.max(0, parseFloat(customAccruedInterest) || 0) : submitSysAccrued);
    const submitSplit = resolveInterestAccountingSplit(selectedAccount, submitEffInterest, actionType === 'PrematureClose');
    const isSubmitPeriodic =
      submitLedgers?.scheme?.interestType === 'MIS' ||
      submitLedgers?.scheme?.interestType === 'Monthly Interest';
    const submitMisPaid = isSubmitPeriodic ? Number(prematurePreview?.alreadyAccruedInterest ?? 0) : 0;
    const submitMisBaseClawback = (actionType === 'PrematureClose' && isSubmitPeriodic)
      ? Math.max(0, (submitMisPaid + submitSplit.clearedCapitalized) - submitEffInterest)
      : 0;
    const effectiveDebitModeToSend: 'Split' = 'Split';

    {
      const drSum = submitSplit.clearedCapitalized + submitSplit.payablePortion + submitSplit.expensePortion;
      if (actionType === 'PrematureClose') {
        if ((isSubmitPeriodic ? (submitMisPaid + drSum) : drSum) + 0.05 < submitEffInterest) {
          setError(`⚠️ नावे केलेले एकूण व्याज (₹${drSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) हे मुदतपूर्व व्याजापेक्षा (₹${submitEffInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) कमी आहे.`);
          return;
        }
      } else {
        if (Math.abs(drSum - submitEffInterest) > 0.05) {
          setError(`⚠️ POSTING_INTR आणि नफा-तोटा/खर्च व्याज यांची एकूण नावे विभागणी (₹${drSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) ही देय व्याजाशी (₹${submitEffInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) जुळत नाही.`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const basePayload: any = {
        closureDate: closureDate,
        paymentMode: paymentMode,
        bankAccountLedgerID: !isLoanAdjustActive && paymentMode === 'Bank' ? bankAccountLedgerID : null,
        chequeNo: !isLoanAdjustActive && paymentMode === 'Bank' ? chequeNo : null,
        chequeDate: !isLoanAdjustActive && paymentMode === 'Bank' ? chequeDate : null,
        savingAccountID: !isLoanAdjustActive && paymentMode === 'Transfer' ? selectedSavingAccountId : null,
        narration: narration || null,
        // 🛡️ Lien & Loan Recovery + Surplus Payout Support
        adjustInLoan: isLoanAdjustActive,
        targetLoanAccountID: isLoanAdjustActive ? effectiveTargetLoanId : null,
        loanAdjustmentAmount: isLoanAdjustActive ? effectiveLoanAdjustVal : null,
        surplusPaymentMode: isLoanAdjustActive ? surplusPaymentMode : 'Cash',
        surplusBankLedgerID: isLoanAdjustActive && surplusVal > 0 && surplusPaymentMode === 'Bank' ? surplusBankLedgerID : null,
        surplusSavingAccountID: isLoanAdjustActive && surplusVal > 0 && surplusPaymentMode === 'Transfer' ? Number(surplusSavingAccountId) : null,
        surplusChequeNo: isLoanAdjustActive && surplusVal > 0 && surplusPaymentMode === 'Bank' ? (surplusChequeNo.trim() || null) : null,
        surplusChequeDate: isLoanAdjustActive && surplusVal > 0 && surplusPaymentMode === 'Bank' ? chequeDate : null,
        // ✍️ Manual Amount Override (Legacy Reconciliation)
        isManualAmountOverride: Boolean(isManualOverride || customPrematureInterest !== '' || customAccruedInterest !== '' || customOverdueInterest !== ''),
        customAccruedInterest: (isManualOverride || customPrematureInterest !== '' || customAccruedInterest !== '')
          ? (actionType === 'PrematureClose' 
              ? (customPrematureInterest !== '' ? parseFloat(customPrematureInterest) : (customAccruedInterest !== '' ? parseFloat(customAccruedInterest) : null)) 
              : (customAccruedInterest !== '' ? parseFloat(customAccruedInterest) : (customPrematureInterest !== '' ? parseFloat(customPrematureInterest) : null))) 
          : null,
        customOverdueInterest: (isManualOverride || customOverdueInterest !== '') && customOverdueInterest !== '' ? parseFloat(customOverdueInterest) : null,
        manualOverrideReason: (isManualOverride || customPrematureInterest !== '' || customAccruedInterest !== '' || customOverdueInterest !== '') ? (manualOverrideReason.trim() || 'थेट सेटलमेंट संपादन') : null,
        interestDebitMode: effectiveDebitModeToSend,
        postedInterestDebitAmount: effectiveDebitModeToSend === 'Split' ? submitSplit.payablePortion : null,
        postedInterestDebitLedgerID: postedIntrLedgerId && Number(postedIntrLedgerId) > 0 ? Number(postedIntrLedgerId) : null,
        expenseInterestDebitAmount: effectiveDebitModeToSend === 'Split' ? submitSplit.expensePortion : null,
        expenseInterestDebitLedgerID: expenseIntrLedgerId && Number(expenseIntrLedgerId) > 0 ? Number(expenseIntrLedgerId) : null,
        reversePostedInterestAmount: actionType === 'PrematureClose' && effectiveDebitModeToSend === 'Split'
          ? (isSubmitPeriodic ? Math.max(0, Number((submitSplit.clawbackAmount - submitMisBaseClawback).toFixed(2))) : submitSplit.clawbackAmount)
          : null,
        reversalCreditLedgerID: actionType === 'PrematureClose' && reversalCreditLedgerId && Number(reversalCreditLedgerId) > 0 ? Number(reversalCreditLedgerId) : null
      };

      if (actionType === 'MaturityClose') {
        const payload = {
          ...basePayload,
          applyOverdueInterest: isOverdue && isAllowedByScheme ? applyOverdueInterest : false,
          overdueInterestRate: isOverdue && isAllowedByScheme && applyOverdueInterest ? effectiveOverdueRate : null,
          overdueInterestAmount: isOverdue && isAllowedByScheme && applyOverdueInterest 
            ? (isManualOverride && customOverdueInterest !== '' ? parseFloat(customOverdueInterest) : overdueInterest) 
            : null
        };
        const response = await axios.post(`${API_URL}/FdAccounts/${selectedAccount.fdAccountID}/MaturedClose`, payload);
        const resData = response.data;
        if (typeof resData === 'string') {
          setSuccess(resData);
        } else if (resData?.message) {
          setSuccess(`✅ ${resData.message}`);
        } else {
          setSuccess('✅ मुदत ठेव परतावा यशस्वीरित्या पूर्ण करण्यात आला.');
        }
      } else if (actionType === 'PrematureClose') {
        const response = await axios.post(
          `${API_URL}/FdAccounts/${selectedAccount.fdAccountID}/PrematureClose`,
          basePayload
        );
        const resData = response.data;
        if (typeof resData === 'string') {
          setSuccess(resData);
        } else if (resData?.message || resData?.Message) {
          const msg = resData.message || resData.Message;
          const aDays = resData.actualDays ?? resData.ActualDays;
          const sText = resData.matchedSlab ?? resData.MatchedSlab;
          const pRate = resData.prematureRate ?? resData.PrematureRate;
          const nPayout = resData.netPayout ?? resData.NetPayout;
          const cBack = resData.clawback ?? resData.Clawback;
          setSuccess(`✅ ${msg} [कालावधी: ${aDays} दिवस | लागू स्लॅब: ${sText || '-'} | अंतिम दर: ${pRate}% | परतावा: ₹${Number(nPayout || 0).toLocaleString()}${cBack > 0 ? ` | संस्थेची बचत: ₹${Number(cBack).toLocaleString()}` : ''}]`);
        } else {
          setSuccess(`✅ मुदत पूर्व बंद यशस्वी (${paymentMode})! दिवसांची संख्या: ${resData.actualDays || resData.ActualDays}, मूळ मुद्दल: ₹${selectedAccount.depositAmount.toLocaleString()}, पुनर्गणना केलेले व्याज: ₹${resData.recalcInt || resData.RecalcInt}, दंडात्मक कपात: ₹${resData.clawback || resData.Clawback}, अंतिम पेआउट: ₹${resData.netPayout || resData.NetPayout}`);
        }
      } else if (actionType === 'Renewal') {
        if (targetSchemeId === 0) {
          setError('कृपया नूतनीकरणासाठी नवीन ठेव योजना निवडा.');
          setLoading(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (renewalSimulation && !renewalSimulation.isSlabValid) {
          setError(
            `निवडलेला नूतनीकरण कालावधी (${renewalSimulation.totalDays} दिवस) '${renewalSimulation.targetScheme.schemeName}' योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही. कृपया मंजूर स्लॅबमधील कालावधी निवडा (${renewalSimulation.validSlabsText}).`
          );
          setLoading(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (receiptNoMode === 'CUSTOM' && !customReceiptNo.trim()) {
          setError('कस्टम पावती क्र. निवडला असल्यास कृपया नवीन प्री-प्रिंटेड पावती क्रमांक प्रविष्ट करा.');
          setLoading(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        const parsedEditedRate = parseFloat(renewalInterestRateInput);
        if (renewalInterestRateInput.trim() !== '' && (!Number.isFinite(parsedEditedRate) || parsedEditedRate <= 0 || parsedEditedRate > 30)) {
          setError('⚠️ नवीन मुदत ठेवीचा व्याजदर ०.०१% ते ३०% दरम्यान असणे आवश्यक आहे.');
          setLoading(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        const targetScheme = schemes.find(s => s.fdSchemeID === targetSchemeId);
        const payload = {
          targetSchemeID: targetSchemeId,
          renewalType: renewalType,
          closureDate: closureDate,
          durationType: renewalDurationType || targetScheme?.durationType || 'Months',
          durationValue: renewalDurationValue > 0 ? renewalDurationValue : (targetScheme?.durationMonths || 12),
          paymentMode: renewalType === 'PrincipalOnly' ? paymentMode : 'BookTransfer',
          bankAccountLedgerID: renewalType === 'PrincipalOnly' && paymentMode === 'Bank' ? bankAccountLedgerID : null,
          chequeNo: renewalType === 'PrincipalOnly' && paymentMode === 'Bank' ? chequeNo : null,
          chequeDate: renewalType === 'PrincipalOnly' && paymentMode === 'Bank' ? chequeDate : null,
          savingAccountID: renewalType === 'PrincipalOnly' && paymentMode === 'Transfer' ? selectedSavingAccountId : null,
          narration: narration || null,
          renewalEffectiveFrom: isOverdue ? renewalEffectiveFrom : 'ClosureDate',
          applyOverdueInterest: isOverdue && isAllowedByScheme && renewalEffectiveFrom === 'ClosureDate' ? applyOverdueInterest : false,
          overdueInterestRate: isOverdue && isAllowedByScheme && renewalEffectiveFrom === 'ClosureDate' && applyOverdueInterest ? effectiveOverdueRate : null,
          // ✍️ Manual Amount Override (Legacy Reconciliation)
          isManualAmountOverride: Boolean(isManualOverride || customAccruedInterest !== '' || customPrematureInterest !== '' || customOverdueInterest !== ''),
          customAccruedInterest: (isManualOverride || customAccruedInterest !== '' || customPrematureInterest !== '')
            ? (customAccruedInterest !== '' ? parseFloat(customAccruedInterest) : (customPrematureInterest !== '' ? parseFloat(customPrematureInterest) : null))
            : null,
          customOverdueInterest: (isManualOverride || customOverdueInterest !== '') && customOverdueInterest !== '' ? parseFloat(customOverdueInterest) : null,
          manualOverrideReason: (isManualOverride || customAccruedInterest !== '' || customPrematureInterest !== '' || customOverdueInterest !== '') ? (manualOverrideReason.trim() || 'थेट सेटलमेंट संपादन') : null,
          interestDebitMode: effectiveDebitModeToSend,
          postedInterestDebitAmount: effectiveDebitModeToSend === 'Split' ? submitSplit.payablePortion : null,
          postedInterestDebitLedgerID: postedIntrLedgerId && Number(postedIntrLedgerId) > 0 ? Number(postedIntrLedgerId) : null,
          expenseInterestDebitAmount: effectiveDebitModeToSend === 'Split' ? submitSplit.expensePortion : null,
          expenseInterestDebitLedgerID: expenseIntrLedgerId && Number(expenseIntrLedgerId) > 0 ? Number(expenseIntrLedgerId) : null,
          // Auto-populated & Editable Renewal Interest Rate
          customInterestRate:
            isRenewalRateManuallyEdited && renewalInterestRateInput.trim() !== '' && Number.isFinite(parsedEditedRate) && parsedEditedRate > 0
              ? Number(parsedEditedRate.toFixed(2))
              : null,
          // पावती क्रमांक धोरण
          receiptNoMode: receiptNoMode,
          customReceiptNo: receiptNoMode === 'CUSTOM' && customReceiptNo.trim() ? customReceiptNo.trim() : null
        };

        const response = await axios.post(
          `${API_URL}/FdAccounts/${selectedAccount.fdAccountID}/Renew`,
          payload
        );
        const resData = response.data;
        const shownReceiptNo = resData.newReceiptNo || resData.newAccountNo;
        setSuccess(`✅ ${resData.message} (पावती क्र: ${shownReceiptNo}${shownReceiptNo !== resData.newAccountNo ? ` | CBS: ${resData.newAccountNo}` : ''}${resData.voucherNo ? ` | व्हाउचर: ${resData.voucherNo} [Pass Voucher ला Pending]` : ''}${resData.interestVoucherNo ? ` | व्याज व्हाउचर: ${resData.interestVoucherNo}` : ''})${resData.overdueInterest > 0 ? ` [समाविष्ट Overdue व्याज: ₹${resData.overdueInterest.toLocaleString()}]` : ''}`);

        // Set rich post-renewal data for instant review and printing
        const sim = renewalSimulation;
        const openingIso = resData.openingDate || sim?.effectiveStartDateStr || closureDate;
        const maturityIso = resData.maturityDate || sim?.simMaturityDateStr || '';
        setRenewedSuccessData({
          oldAccountNo: selectedAccount.accountNo,
          oldReceiptNo: resData.oldReceiptNo || selectedAccount.receiptNo || selectedAccount.legacyAccountNumber || selectedAccount.accountNo,
          oldDepositAmount: selectedAccount.depositAmount,
          parentFdAccountID: selectedAccount.fdAccountID,
          branchName: selectedAccount.branchName || '',
          newAccountNo: resData.newAccountNo,
          newReceiptNo: shownReceiptNo,
          effectivePolicy: resData.effectivePolicy || sansthaRenewalPolicy,
          renewalCycleNo: resData.renewalCycleNo || ((selectedAccount.renewalCycleNo || 0) + 1),
          voucherNo: resData.voucherNo || '',
          interestVoucherNo: resData.interestVoucherNo || '',
          voucherStatus: resData.voucherStatus || 'Pending',
          depositAmount: resData.newDeposit || sim?.newDepositAmount || 0,
          schemeName: resData.schemeName || targetScheme?.schemeName || '',
          schemeCode: resData.schemeCode || targetScheme?.schemeCode || '',
          interestRate: resData.interestRate || sim?.appliedRate || 0,
          duration: `${renewalDurationValue} ${renewalDurationType === 'Days' ? 'दिवस' : renewalDurationType === 'Years' ? 'वर्षे' : 'महिने'} (${sim?.totalDays || 0} दिवस)`,
          openingDateIso: openingIso,
          maturityDateIso: maturityIso,
          openingDate: formatDateDDMMYYYY(openingIso),
          maturityDate: formatDateDDMMYYYY(maturityIso),
          maturityAmount: resData.maturityAmount || sim?.simMaturityAmount || 0,
          customerName: resData.customerName || selectedAccount.customerName || '',
          cifNo: resData.cifNo || selectedAccount.cifNo || '',
          fdAccountID: resData.newFdAccountId || 0,
          interestType: targetScheme?.interestType || 'Simple',
          monthlyInterestAmount: sim?.monthlyPayout || 0
        });
        setCustomReceiptNo('');
      }

      // Refresh list & Reset
      handleResetManualOverride();
      setSelectedAccount(null);
      setSelectedAccId(0);
      setNarration('');
      setActiveLoansData(null);
      fetchAccounts();
    } catch (err: any) {
      const respData = err?.response?.data;
      let errMsg = 'व्यवहार पूर्ण करताना त्रुटी आली.';
      if (typeof respData === 'string' && respData.trim()) {
        errMsg = respData.trim();
      } else if (respData?.message && typeof respData.message === 'string') {
        errMsg = respData.message;
      } else if (respData?.errors && typeof respData.errors === 'object') {
        const flatErrors = Object.values(respData.errors).flat().filter(Boolean).join(' | ');
        if (flatErrors) errMsg = flatErrors;
      } else if (respData?.title && typeof respData.title === 'string') {
        errMsg = respData.title;
      } else if (err?.message) {
        errMsg = err.message;
      }
      setError(errMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  // Generate Voucher Entries Preview
  const getVoucherEntriesPreview = () => {
    if (!selectedAccount) return null;
    const ledgers = getSchemeLedgers();
    if (!ledgers) return null;

    const entries: { 
      drCr: 'Dr' | 'Cr'; 
      ledgerName: string; 
      note: string; 
      amount: number;
      isEditable?: boolean;
      editKey?: 'accrued' | 'overdue' | 'premature';
      isLockedPrincipal?: boolean;
      isBalancing?: boolean;
      voucherGroup?: string;
    }[] = [];

    if (actionType === 'MaturityClose') {
      const principal = selectedAccount.depositAmount;
      const totalMaturity = selectedAccount.maturityAmount && selectedAccount.maturityAmount > selectedAccount.depositAmount
        ? selectedAccount.maturityAmount
        : (selectedAccount.depositAmount + (selectedAccount.legacyAccruedInt || 0));
      const systemAccruedInt = Math.max(0, totalMaturity - principal);
      const systemOverdueInt = isOverdue ? overdueInterest : 0;

      const accruedInt = isManualOverride && customAccruedInterest !== ''
        ? Math.max(0, parseFloat(customAccruedInterest) || 0)
        : systemAccruedInt;
      const effOverdueInt = isManualOverride && customOverdueInterest !== ''
        ? Math.max(0, parseFloat(customOverdueInterest) || 0)
        : systemOverdueInt;

      const split = resolveInterestAccountingSplit(selectedAccount, accruedInt, false);
      const clearedCapitalized = split.clearedCapitalized;
      const payableAmount = split.payablePortion;
      const expenseAmount = split.expensePortion;

      const totalPayout = principal + accruedInt + effOverdueInt;

      entries.push({
        drCr: 'Dr',
        ledgerName: ledgers.fdLiability,
        note: clearedCapitalized > 0
          ? `मुद्दल ₹${principal.toLocaleString('en-IN')} + व्याजवर व्याज (On Interest) कॅपिटलाइझ्ड ₹${clearedCapitalized.toLocaleString('en-IN')} निरंक`
          : 'मुदत ठेव मुद्दल खाते कमी करणे (Principal Liability Cleared)',
        amount: principal + clearedCapitalized,
        isLockedPrincipal: true
      });

      if (payableAmount > 0) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestPayable,
          note: 'आधी पोस्ट/तरतूद केलेले व्याज (POSTING_INTR) नावे करणे',
          amount: payableAmount
        });
      }

      const totalExpense = expenseAmount + effOverdueInt;
      if (totalExpense > 0 || isManualOverride) {
        const noteParts: string[] = [];
        if (expenseAmount > 0) {
          noteParts.push('चालू खर्च / नफा-तोटा देय व्याज (NAFATOTA DEY VYAJ)');
        }
        if (effOverdueInt > 0) {
          noteParts.push(`ओव्हरड्यू व्याज (@ ${effectiveOverdueRate}%)`);
        }
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestExpense,
          note: (noteParts.join(' + ') || 'मुदत ठेव व्याज खर्च (Interest Expense)') + (isManualOverride && (customAccruedInterest !== '' || customOverdueInterest !== '') ? ' [✍️ मॅन्युअल संपादन]' : ''),
          amount: totalExpense,
          isEditable: isManualOverride,
          editKey: 'overdue'
        });
      }

      entries.push({
        drCr: 'Cr',
        ledgerName: ledgers.cashLedger,
        note: paymentMode === 'Cash' 
          ? 'खातेदारास रोख पेमेंट (Cash Payout to Customer)' 
          : (paymentMode === 'Bank' ? 'बँक ट्रान्सफर / धनादेश परतावा (Bank Payout)' : 'खातेदाराच्या बचत खात्यात वर्ग (SB Credit Payout)'),
        amount: totalPayout,
        isBalancing: true
      });

    } else if (actionType === 'PrematureClose') {
      const principal = selectedAccount.depositAmount;
      const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
      const resolution = resolvePrematureRateDetails(selectedAccount, ledgers.scheme, actualDays);
      const prematureRate = prematurePreview?.prematureRate ?? resolution.prematureRate;
      const systemRecalcInt = prematurePreview?.recalculatedInterest ?? Math.round((principal * prematureRate * actualDays) / 36500);

      const recalculatedInterest = (isManualOverride || customPrematureInterest !== '') && customPrematureInterest !== ''
        ? Math.max(0, parseFloat(customPrematureInterest) || 0)
        : systemRecalcInt;

      const split = resolveInterestAccountingSplit(selectedAccount, recalculatedInterest, true);
      const isPeriodicPayout = ledgers.scheme?.interestType === 'MIS' || ledgers.scheme?.interestType === 'Monthly Interest';
      const clearedCapitalized = split.clearedCapitalized;
      const payableAmount = split.payablePortion;
      const expenseAmount = split.expensePortion;
      const clawback = split.clawbackAmount;
      const misAlready = isPeriodicPayout
        ? Number(prematurePreview?.alreadyAccruedInterest ?? 0) + clearedCapitalized
        : 0;
      const misPrincipalClawback = isPeriodicPayout ? Math.max(0, misAlready - recalculatedInterest) : 0;
      const netPayout = isPeriodicPayout
        ? (misPrincipalClawback > 0
            ? Math.max(0, principal - misPrincipalClawback)
            : principal + Math.max(0, recalculatedInterest - misAlready))
        : (principal + recalculatedInterest);

      entries.push({
        drCr: 'Dr',
        ledgerName: ledgers.fdLiability,
        note: clearedCapitalized > 0
          ? `मुद्दल ₹${principal.toLocaleString('en-IN')} + व्याजवर व्याज (On Interest) कॅपिटलाइझ्ड ₹${clearedCapitalized.toLocaleString('en-IN')} निरंक`
          : 'मुदत ठेव मुद्दल खाते निरंक करणे (Principal Liability Cleared)',
        amount: principal + clearedCapitalized,
        isLockedPrincipal: true
      });

      if (payableAmount > 0) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestPayable,
          note: 'आधी पोस्ट/तरतूद केलेले व्याज (POSTING_INTR) नावे करणे',
          amount: payableAmount
        });
      }

      if (expenseAmount > 0) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestExpense,
          note: 'चालू कालावधीचे / नफा-तोटा देय व्याज (NAFATOTA DEY VYAJ / Interest Expense)' + (isManualOverride && customPrematureInterest !== '' ? ' [✍️ मॅन्युअल संपादन]' : ''),
          amount: expenseAmount,
          isEditable: isManualOverride,
          editKey: 'premature'
        });
      }

      entries.push({
        drCr: 'Cr',
        ledgerName: ledgers.cashLedger,
        note: paymentMode === 'Cash' ? 'प्रत्यक्ष अंतिम रोख पेआउट रक्कम (Net Cash Paid)' : (paymentMode === 'Bank' ? 'प्रत्यक्ष अंतिम बँक पेआउट (Net Bank Payout)' : 'बचत खात्यात वर्ग अंतिम पेआउट (Net SB Transfer)'),
        amount: netPayout,
        isBalancing: true
      });

      if (clawback > 0) {
        entries.push({
          drCr: 'Cr',
          ledgerName: ledgers.prematurePenalty,
          note: isPeriodicPayout && misPrincipalClawback >= clawback
            ? 'मासिक मिळालेल्या जास्तीच्या व्याजाची मुद्दलातून कपात (Clawback Deduction)'
            : 'जास्तीच्या पोस्टिंग व्याजाची रिव्हर्सल जमा (POSTING_INTR / Capitalized Reversal to P&L / Expense)',
          amount: clawback
        });
      }

    } else if (actionType === 'Renewal') {
      const targetScheme = schemes.find(s => s.fdSchemeID === targetSchemeId);
      const targetLiabilityLedger = targetScheme?.fdLiabilityLedger?.ledgerName 
        || targetScheme?.fdLiabilityLedgerName 
        || `${targetScheme?.schemeName || 'नवीन योजना'} - मुदत ठेव देयता खाते`;

      const principal = selectedAccount.depositAmount;
      const totalMaturity = selectedAccount.maturityAmount && selectedAccount.maturityAmount > selectedAccount.depositAmount
        ? selectedAccount.maturityAmount
        : (selectedAccount.depositAmount + (selectedAccount.legacyAccruedInt || 0));
      const systemAccruedInt = Math.max(0, totalMaturity - principal);

      const isRetroactive = isOverdue && renewalEffectiveFrom === 'MaturityDate';
      const systemOverdueInt = isRetroactive ? 0 : (isOverdue ? overdueInterest : 0);

      const accruedInt = isManualOverride && customAccruedInterest !== ''
        ? Math.max(0, parseFloat(customAccruedInterest) || 0)
        : systemAccruedInt;
      const effOverdueInt = isManualOverride && customOverdueInterest !== ''
        ? Math.max(0, parseFloat(customOverdueInterest) || 0)
        : systemOverdueInt;

      const split = resolveInterestAccountingSplit(selectedAccount, accruedInt, false);
      const clearedCapitalized = split.clearedCapitalized;
      const payableAmount = split.payablePortion;
      const expenseAmount = split.expensePortion;

      const totalVal = principal + accruedInt + effOverdueInt;

      const newDepositAmount = renewalType === 'PrincipalPlusInterest' ? totalVal : principal;
      const interestPayout = renewalType === 'PrincipalOnly' ? (accruedInt + effOverdueInt) : 0;

      if (renewalType === 'PrincipalOnly') {
        // Voucher 1: मुदत ठेव मुद्दल नूतनीकरण (कीर्द - JV)
        const v1Group = 'व्हाउचर १ (कीर्द - JV): मुदत ठेव मुद्दल नूतनीकरण';
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.fdLiability,
          note: 'जुने मुदत ठेव खाते बंद करणे (Old FD Liability Cleared)',
          amount: principal,
          isLockedPrincipal: true,
          voucherGroup: v1Group
        });

        entries.push({
          drCr: 'Cr',
          ledgerName: targetLiabilityLedger,
          note: `नवीन मुदत ठेव खात्यात मुद्दल जमा (${targetScheme?.schemeName || 'New FD Account'})` + (isRetroactive ? ` [सुरुवात दिनांक: ${selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')}]` : ''),
          amount: newDepositAmount,
          isBalancing: false,
          voucherGroup: v1Group
        });

        // Voucher 2: व्याज परतावा (Payment / JV)
        if (interestPayout > 0 || isManualOverride || clearedCapitalized > 0) {
          const v2Group = `व्हाउचर २ (${paymentMode === 'Transfer' ? 'कीर्द - JV' : 'पेमेंट - Payment'}): व्याज परतावा (${paymentMode === 'Cash' ? 'रोख' : paymentMode === 'Bank' ? 'बँक' : 'बचत'})`;

          if (clearedCapitalized > 0) {
            entries.push({
              drCr: 'Dr',
              ledgerName: ledgers.fdLiability,
              note: 'पूर्वी व्याजवर व्याज (On Interest) कॅपिटलाइझ्ड रक्कम समायोजित करणे',
              amount: clearedCapitalized,
              voucherGroup: v2Group
            });
          }

          if (payableAmount > 0) {
            entries.push({
              drCr: 'Dr',
              ledgerName: ledgers.interestPayable,
              note: 'आधी पोस्ट/तरतूद केलेले व्याज (POSTING_INTR) नावे करणे',
              amount: payableAmount,
              voucherGroup: v2Group
            });
          }

          const totalExpense = expenseAmount + effOverdueInt;
          if (totalExpense > 0 || isManualOverride) {
            const noteParts: string[] = [];
            if (expenseAmount > 0) {
              noteParts.push('चालू कालावधीतील / नफा-तोटा देय व्याज (NAFATOTA DEY VYAJ)');
            }
            if (effOverdueInt > 0) {
              noteParts.push(`ओव्हरड्यू व्याज (@ ${effectiveOverdueRate}%)`);
            }
            entries.push({
              drCr: 'Dr',
              ledgerName: ledgers.interestExpense,
              note: (noteParts.join(' + ') || 'मुदत ठेव व्याज खर्च (Interest Expense)') + (isManualOverride && (customAccruedInterest !== '' || customOverdueInterest !== '') ? ' [✍️ मॅन्युअल संपादन]' : ''),
              amount: totalExpense,
              isEditable: isManualOverride,
              editKey: 'overdue',
              voucherGroup: v2Group
            });
          }

          entries.push({
            drCr: 'Cr',
            ledgerName: ledgers.cashLedger,
            note: (paymentMode === 'Cash' 
              ? 'केवळ व्याजाची रक्कम रोखीने अदा करणे (Interest Cash Payout)' 
              : (paymentMode === 'Bank' ? 'व्याज बँक ट्रान्सफरने अदा करणे (Interest Bank Payout)' : 'व्याज बचत खात्यात वर्ग करणे (Interest SB Credit)')) + (isManualOverride ? ' [⚡ स्वयंचलित संतुलित]' : ''),
            amount: interestPayout,
            isBalancing: true,
            voucherGroup: v2Group
          });
        }
      } else {
        // PrincipalPlusInterest: Single compound JV
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.fdLiability,
          note: clearedCapitalized > 0
            ? `जुने मुद्दल ₹${principal.toLocaleString('en-IN')} + व्याजवर व्याज (On Interest) कॅपिटलाइझ्ड ₹${clearedCapitalized.toLocaleString('en-IN')} निरंक`
            : 'जुने मुदत ठेव खाते बंद करणे (Old FD Liability Cleared)',
          amount: principal + clearedCapitalized,
          isLockedPrincipal: true
        });

        if (payableAmount > 0) {
          entries.push({
            drCr: 'Dr',
            ledgerName: ledgers.interestPayable,
            note: 'आधी पोस्ट/तरतूद केलेले व्याज (POSTING_INTR) नावे करणे',
            amount: payableAmount
          });
        }

        const totalExpense = expenseAmount + effOverdueInt;
        if (totalExpense > 0 || isManualOverride) {
          const noteParts: string[] = [];
          if (expenseAmount > 0) {
            noteParts.push('चालू कालावधीतील / नफा-तोटा देय व्याज (NAFATOTA DEY VYAJ) नवीन मुद्दलात');
          }
          if (effOverdueInt > 0) {
            noteParts.push(`ओव्हरड्यू व्याज (@ ${effectiveOverdueRate}%)`);
          }
          entries.push({
            drCr: 'Dr',
            ledgerName: ledgers.interestExpense,
            note: (noteParts.join(' + ') || 'मुदत ठेव व्याज खर्च (Interest Expense)') + (isManualOverride && (customAccruedInterest !== '' || customOverdueInterest !== '') ? ' [✍️ मॅन्युअल संपादन]' : ''),
            amount: totalExpense,
            isEditable: isManualOverride,
            editKey: 'overdue'
          });
        }

        entries.push({
          drCr: 'Cr',
          ledgerName: targetLiabilityLedger,
          note: `नवीन मुदत ठेव खात्यात मुद्दल जमा (${targetScheme?.schemeName || 'New FD Account'})` + (isRetroactive ? ` [सुरुवात दिनांक: ${selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')}]` : ''),
          amount: newDepositAmount,
          isBalancing: true
        });
      }
    }

    return entries;
  };

  const settlementLedgerOptions = allLedgers
    .filter(l => (l.isActive ?? l.IsActive ?? true))
    .map(l => {
      const lid = Number(l.ledgerID ?? l.LedgerID ?? 0);
      const lName = l.ledgerName ?? l.LedgerName ?? `Ledger #${lid}`;
      const lType = l.accountType ?? l.AccountType ?? '';
      return {
        value: String(lid),
        label: `${lid} - ${lName}`,
        subLabel: lType || undefined
      };
    });

  const labelClass = 'block text-xs font-bold text-gray-700 mb-1';
  const inputClass = 'w-full text-xs border border-gray-300 rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-primary bg-white';

  const voucherPreview = getVoucherEntriesPreview();

  // Format account options for SearchableSelect
  const accountOptions = [
    { value: '0', label: '--- मुदत ठेव खाते निवडा (Select FD Account) ---' },
    ...accounts.map(a => {
      const cifDisplay = a.cifNo || (a.customerID ? `CIF-${a.customerID}` : '-');
      const custName = a.customerName || a.memberName || 'खातेदार';
      const legacyNo = (a.legacyAccountNumber || '').trim();
      const legacyPart = legacyNo ? ` [जुना: ${legacyNo}]` : '';
      const statusObj = getFdEffectiveStatus(a, closureDate || activeBusinessDate);
      const isMatured = statusObj.key.toLowerCase() === 'matured';
      const matDateStr = a.maturityDate ? a.maturityDate.split('T')[0].split('-').reverse().join('/') : '';
      return {
        value: a.fdAccountID.toString(),
        label: `${a.accountNo}${legacyPart} • ${custName}`,
        badge: statusObj.label,
        badgeColor: isMatured
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
          : 'bg-amber-50 text-amber-800 border-amber-300',
        subLabel: `ठेव: ₹${a.depositAmount.toLocaleString()} • मुदतपूर्ती: ${matDateStr} • CIF: ${cifDisplay} • ${a.schemeName}`
      };
    })
  ];

  return (
    <div className="p-2.5 sm:p-3 max-w-6xl mx-auto space-y-2.5 font-sans text-xs">
      {/* ================= TITLE BAR ================= */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-2xs border-l-4 border-l-primary">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-primary shrink-0" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                मुदत ठेव क्लोजर आणि नूतनीकरण (FD Closures &amp; Renewals)
              </h1>
              <p className="text-[11px] text-slate-500 leading-tight">
                मुदत संपलेल्या किंवा मुदतपूर्व ठेवींचा परतावा (Payout) अथवा नूतनीकरण (Renewal)
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-600">
            {selectedAccount && (
              <>
                <span>शाखा: <strong className="text-slate-900">{selectedAccount.branchID}</strong></span>
                <span className="h-3 w-px bg-slate-300" />
                <span>खाते: <strong className="font-mono text-primary">{selectedAccount.accountNo}</strong></span>
                <span className="h-3 w-px bg-slate-300" />
              </>
            )}
            <span>व्यवहार दिनांक: <strong className="text-slate-900">{formatDateDisplay(closureDate)}</strong></span>
          </div>
        </div>
      </div>

      {/* Checker Mode Banner */}
      {isPassingMode && (
        <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 px-3 py-2 rounded-sm flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold">मुदत ठेव बंद व्हाउचर तपासणी (Checker Mode):</span>{' '}
              व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucherData?.voucherNo || voucherId}</span>
              <span className="mx-1.5 text-amber-400">|</span>
              रक्कम: <span className="font-bold">₹{passingVoucherData?.totalAmount?.toLocaleString('en-IN') || (selectedAccount?.maturityAmount ?? selectedAccount?.depositAmount)}</span>
              <span className="mx-1.5 text-amber-400">|</span>
              तारीख: <span className="font-bold">{passingVoucherData?.voucherDate ? new Date(passingVoucherData.voucherDate).toLocaleDateString('mr-IN') : closureDate}</span>
            </div>
          </div>
          <div className="text-[11px] font-bold bg-white text-amber-900 px-2 py-0.5 rounded-sm border border-amber-300 flex items-center gap-1">
            <Lock className="w-3 h-3" /> तपासणी मोड (Read-Only)
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 text-red-800 text-xs px-3 py-2 rounded-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 text-emerald-900 text-xs px-3 py-2 rounded-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {noFdFoundAlert && (
        <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 text-amber-900 text-xs px-3 py-2 rounded-sm font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{noFdFoundAlert}</span>
          </div>
          <button type="button" onClick={() => setNoFdFoundAlert(null)} className="text-amber-700 hover:text-black cursor-pointer" title="बंद करा">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Post-Renewal Confirmation & Receipt Printing Card */}
      {renewedSuccessData && (
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-md p-4 shadow-lg border-2 border-emerald-400 space-y-3 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-700/60 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/20 rounded-full border border-emerald-400">
                <CheckCircle className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  मुदत ठेव नूतनीकरण यशस्वीरीत्या पूर्ण झाले! (FD Renewal Completed)
                </h3>
                <p className="text-[11px] text-emerald-200">
                  नवीन मुदत ठेव पावती जनरेट झाली आहे.
                  {renewedSuccessData.voucherNo && (
                    <span className="ml-1.5 inline-block bg-amber-400/20 border border-amber-300/60 text-amber-200 px-2 py-0.2 rounded font-bold">
                      🧾 व्हाउचर: {renewedSuccessData.voucherNo}
                      {renewedSuccessData.interestVoucherNo ? ` / ${renewedSuccessData.interestVoucherNo}` : ''} (Pass Voucher ला Pending)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openRenewedPrintModal(renewedSuccessData, 'front')}
                className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold px-3.5 py-1.5 rounded-sm text-xs shadow-md flex items-center gap-1.5 cursor-pointer transition-all border border-amber-300"
              >
                <Printer className="w-4 h-4 text-amber-900" />
                <span>नवीन ठेव पावती प्रिंट करा</span>
              </button>
              <button
                type="button"
                onClick={() => openRenewedPrintModal(renewedSuccessData, 'endorsement')}
                className="bg-sky-100 hover:bg-sky-200 text-sky-950 font-bold px-3 py-1.5 rounded-sm text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all border border-sky-300"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-800" />
                <span>मागील शेरा प्रिंट (Endorsement)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenewedSuccessData(null);
                  setSelectedAccount(null);
                  setSelectedAccId(0);
                  setSuccess('');
                  fetchAccounts();
                }}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-sm text-xs cursor-pointer border border-white/20 transition-all"
              >
                नवीन व्यवहार करा (New Entry)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-black/20 p-3 rounded-sm border border-emerald-600/40 text-[11.5px]">
            <div>
              <span className="text-emerald-300 block text-[10px]">मूळ पावती / खाते (Old FD):</span>
              <strong className="font-mono text-white">{renewedSuccessData.oldReceiptNo || renewedSuccessData.oldAccountNo}</strong>
            </div>
            <div>
              <span className="text-emerald-300 block text-[10px]">नूतनीकृत पावती क्र. (Receipt No):</span>
              <strong className="font-mono text-amber-300 text-xs font-black">
                {renewedSuccessData.newReceiptNo || renewedSuccessData.newAccountNo}
              </strong>
              {renewedSuccessData.newReceiptNo && renewedSuccessData.newReceiptNo !== renewedSuccessData.newAccountNo && (
                <span className="block text-[9.5px] text-emerald-200 font-mono">CBS: {renewedSuccessData.newAccountNo}</span>
              )}
            </div>
            <div>
              <span className="text-emerald-300 block text-[10px]">नवीन योजना (Scheme):</span>
              <span className="text-white font-bold">{renewedSuccessData.schemeName} ({renewedSuccessData.interestRate}%)</span>
            </div>
            <div>
              <span className="text-emerald-300 block text-[10px]">नूतनीकरण कालावधी (Tenor):</span>
              <span className="text-white font-bold">{renewedSuccessData.duration}</span>
            </div>
            <div>
              <span className="text-emerald-300 block text-[10px]">नवीन ठेव मुद्दल (New Deposit):</span>
              <strong className="font-mono text-white text-xs">₹{renewedSuccessData.depositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div>
              <span className="text-emerald-300 block text-[10px]">नूतनीकरण दिनांक (Opening Date):</span>
              <span className="text-white font-bold">{renewedSuccessData.openingDate}</span>
            </div>
            <div>
              <span className="text-emerald-300 block text-[10px]">नवीन मुदतपूर्ती दिनांक (Maturity Date):</span>
              <span className="text-amber-200 font-bold">{renewedSuccessData.maturityDate}</span>
            </div>
            <div>
              <span className="text-emerald-300 block text-[10px]">नवीन मुदतपूर्ती रक्कम (Maturity Amount):</span>
              <strong className="font-mono text-emerald-200 text-xs font-black">₹{renewedSuccessData.maturityAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {(() => {
          const acc = selectedAccount;

          // ---------- Settlement computations (unchanged business logic) ----------
          let principal = 0;
          let interestPayable = 0;
          let clawback = 0;
          let systemAccruedInt = 0;
          let systemRecalcInt = 0;
          let effOverdue = 0;
          let netPayout = 0;
          let totalDr = 0;
          let totalCr = 0;

          if (acc) {
            principal = acc.depositAmount;
            const totalMaturity = acc.maturityAmount && acc.maturityAmount > acc.depositAmount
              ? acc.maturityAmount
              : (acc.depositAmount + (acc.legacyAccruedInt || 0));
            systemAccruedInt = Math.max(0, totalMaturity - principal);

            if (actionType === 'PrematureClose') {
              const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(acc.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
              const ledgers = getSchemeLedgers();
              const resolution = resolvePrematureRateDetails(acc, ledgers?.scheme, actualDays);
              const prematureRate = prematurePreview?.prematureRate ?? resolution.prematureRate;
              systemRecalcInt = prematurePreview?.recalculatedInterest ?? Math.round((principal * prematureRate * actualDays) / 36500);

              const effInt = (isManualOverride && customPrematureInterest !== '')
                ? (parseFloat(customPrematureInterest) || 0)
                : systemRecalcInt;

              interestPayable = effInt;
              const prematureSplit = resolveInterestAccountingSplit(acc, interestPayable, true);
              clawback = prematureSplit.clawbackAmount;
            } else {
              const effAccrued = (isManualOverride && customAccruedInterest !== '')
                ? Math.max(0, parseFloat(customAccruedInterest) || 0)
                : systemAccruedInt;
              interestPayable = effAccrued;
            }

            effOverdue = (actionType !== 'PrematureClose' && isOverdue)
              ? (isManualOverride && customOverdueInterest !== '' ? (parseFloat(customOverdueInterest) || 0) : overdueInterest)
              : 0;

            netPayout = getTotalFdPayout();
            totalDr = voucherPreview ? voucherPreview.filter(e => e.drCr === 'Dr').reduce((s, e) => s + e.amount, 0) : 0;
            totalCr = voucherPreview ? voucherPreview.filter(e => e.drCr === 'Cr').reduce((s, e) => s + e.amount, 0) : 0;
          }

          const isBalanced = Math.abs(totalDr - totalCr) < 0.01;
          const hasAnyActiveLoan = Boolean(
            activeLoansData?.hasActiveLoan &&
            Array.isArray(activeLoansData?.loans) &&
            activeLoansData.loans.length > 0 &&
            (activeLoansData?.totalOutstandingLiability || 0) > 0.01
          );
          const hasDirectLien = Boolean(
            activeLoansData
              ? activeLoansData.hasDirectLien
              : acc?.isLienMarked
          );
          const hasLien = hasDirectLien || hasAnyActiveLoan;
          const isFullRoll = actionType === 'Renewal' && renewalType === 'PrincipalPlusInterest';
          const finalAmount = isFullRoll ? (principal + interestPayable + effOverdue) : (actionType === 'Renewal' ? principal : netPayout);
          const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const hasDateError = isBeforeOpeningDate || isBeforeLastAccrual || isFutureDate || isBackdatedSavingsTransfer;
          const submitDisabled =
            loading ||
            !acc ||
            isPendingMaturityAction ||
            hasDateError;
          const paymentModeLabel = paymentMode === 'Cash' ? 'रोख (Cash)' : paymentMode === 'Bank' ? 'बँक (Bank)' : 'बचत खात्यात वर्ग (Transfer)';
          const ctrl = 'w-full h-8 text-xs border border-slate-300 rounded-sm px-2 bg-white text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-100 disabled:text-slate-600';
          const segBase = 'flex-1 h-8 px-3 text-xs font-semibold border-y border-r first:border-l first:rounded-l-sm last:rounded-r-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors select-none';
          const segOn = 'bg-primary text-white border-primary';
          const segOff = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50';

          return (
            <>
              <fieldset disabled={isPassingMode} className="min-w-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                  {/* ================= LEFT: DATA ENTRY (GROUP BOXES) ================= */}
                  <div className={`${acc ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3.5`}>

                    {/* Group Box 1: Account Selection */}
                    <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3 bg-white shadow-2xs">
                      <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>१. मुदत ठेव खाते व तारीख निवड (Account &amp; Date Selection)</span>
                      </legend>

                      {customerMatchingFds.length > 1 && (
                        <div className="flex justify-end -mt-6 mb-2">
                          <button
                            type="button"
                            onClick={() => {
                              const first = customerMatchingFds[0];
                              setMultiFdCustomerInfo({
                                name: first.customerName || first.memberName || 'खातेदार',
                                cifNo: first.cifNo || '-',
                                customerId: first.customerID
                              });
                              setShowMultiFdModal(true);
                            }}
                            className="text-[10px] text-primary hover:underline font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Layers className="w-3 h-3" />
                            <span>{customerMatchingFds.length} मुदत ठेवी उपलब्ध – निवडा</span>
                          </button>
                        </div>
                      )}

                      <div className="space-y-2 mt-1">
                        <FormRow label="मुदत ठेव खाते (FD Account)" required>
                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <div className="flex-1 w-full">
                              <SearchableSelect
                                options={accountOptions}
                                value={selectedAccId.toString()}
                                onChange={handleAccountSelect}
                                placeholder="पावती क्र., जुना क्र., खातेदार नाव किंवा CIF ने शोधा..."
                                disabled={isPassingMode}
                              />
                            </div>
                            {!isPassingMode && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowReopenModal(true);
                                  setReopenSearchTerm('');
                                }}
                                className="text-[11px] font-semibold text-slate-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1.5 rounded-sm shrink-0 flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                title="जर या खात्याचा क्लोजर व्हाउचर पूर्वी डिलीट केला असेल तर बंद खाते पुन्हा पूर्ववत करा"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                <span>बंद खाते पूर्ववत करा</span>
                              </button>
                            )}
                          </div>
                        </FormRow>

                        <FormRow label="व्यवहार तारीख (Txn Date)" required>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="date"
                              value={closureDate || activeBusinessDate}
                              min={effectiveMinDate}
                              max={todayStr}
                              onChange={(e) => setClosureDate(e.target.value)}
                              className={`${ctrl} !w-[170px] font-semibold ${hasDateError ? '!border-red-500 !bg-red-50 !text-red-900' : ''} ${(!allowDateOverride || isPassingMode) ? '!bg-slate-100 !text-slate-800 cursor-not-allowed select-none' : 'bg-white border-amber-400'}`}
                              required
                              disabled={isPassingMode || !allowDateOverride}
                              readOnly={!allowDateOverride}
                            />
                            {!allowDateOverride && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                                <Lock size={9} /> लॉक
                              </span>
                            )}
                            {isHOUser && !isPassingMode && (
                              <label className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1 cursor-pointer font-normal select-none">
                                <input
                                  type="checkbox"
                                  checked={allowDateOverride}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setAllowDateOverride(checked);
                                    if (!checked) {
                                      setClosureDate(activeBusinessDate);
                                    }
                                  }}
                                  className="w-3 h-3 text-primary rounded"
                                />
                                <span className="flex items-center gap-0.5">
                                  {allowDateOverride ? <Unlock size={10} className="text-amber-600" /> : <Lock size={10} className="text-gray-400" />}
                                  तारीख बदला (Override)
                                </span>
                              </label>
                            )}
                            {isOverdue && acc && (
                              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-sm border border-amber-200">
                                मुदतपूर्तीनंतर {overdueDays} दिवस
                              </span>
                            )}
                          </div>
                          {isBeforeOpeningDate && acc && (
                            <p className="mt-1 text-[11px] text-red-700 font-medium">
                              तारीख खाते उघडण्याच्या ({formatDateDisplay(acc.openingDate)}) आधीची असू शकत नाही.
                            </p>
                          )}
                          {isFutureDate && (
                            <p className="mt-1 text-[11px] text-red-700 font-medium">
                              भविष्यातील तारीख प्रतिबंधित आहे. कृपया आजची किंवा मागील तारीख निवडा.
                            </p>
                          )}
                          {isBeforeLastAccrual && acc?.lastInterestPostingDate && (
                            <p className="mt-1 text-[11px] text-red-700 font-medium">
                              तारीख शेवटच्या व्याज तरतुदीच्या ({formatDateDisplay(acc.lastInterestPostingDate)}) आधीची असू शकत नाही.
                            </p>
                          )}
                          {isBackdatedSavingsTransfer && (
                            <p className="mt-1 text-[11px] text-red-700 font-medium flex items-center gap-2">
                              <span>बचत खात्यात वर्ग करताना आजचीच तारीख लागते.</span>
                              <button type="button" onClick={() => setClosureDate(todayStr)} className="text-primary font-bold underline cursor-pointer">
                                आजची तारीख घ्या
                              </button>
                            </p>
                          )}
                        </FormRow>
                      </div>
                    </fieldset>

                    {!acc && (
                      <div className="p-8 text-center space-y-1.5 border border-dashed border-slate-300 rounded-sm bg-white">
                        <BookOpen className="w-6 h-6 text-slate-400 mx-auto" />
                        <h3 className="text-xs font-bold text-slate-700">कोणतेही मुदत ठेव खाते निवडलेले नाही</h3>
                        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                          कृपया वरील शोध पट्टीमधून खाते क्रमांक, पावती क्रमांक, जुना क्रमांक, खातेदाराचे नाव किंवा CIF प्रविष्ट करून मुदत ठेव निवडा.
                        </p>
                      </div>
                    )}

                    {acc && (
                      <>
                        {/* Group Box 2: Deposit Details */}
                        <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3 bg-white shadow-2xs">
                          <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>२. मुदत ठेव तपशील (Deposit Details - Read Only)</span>
                          </legend>

                          <div className="overflow-x-auto mt-1 border border-slate-200 rounded-sm">
                            <table className="w-full border-collapse text-[11.5px] bg-white">
                              <tbody>
                                <tr className="border-b border-slate-200">
                                  <th className="w-28 sm:w-32 bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    खातेदार
                                  </th>
                                  <td className="px-2.5 py-1.5 font-bold text-slate-900 border-r border-slate-200">
                                    {acc.customerName || acc.memberName || '-'}
                                  </td>
                                  <th className="w-24 sm:w-28 bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    CIF क्र.
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono text-slate-800">
                                    {acc.cifNo || (acc.customerID ? `CIF-${acc.customerID}` : '-')}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    खाते क्र.
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono font-bold text-primary border-r border-slate-200">
                                    {acc.accountNo}
                                  </td>
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    जुना क्र.
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono font-bold text-slate-800">
                                    {acc.legacyAccountNumber?.trim() || '-'}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    ठेव योजना
                                  </th>
                                  <td className="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200">
                                    {acc.schemeName}
                                  </td>
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    खाते स्थिती
                                  </th>
                                  <td className="px-2.5 py-1.5">
                                    {!isPassingMode && (acc.status === 'Closed' || acc.status === 'Renewed') ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm border bg-rose-50 text-rose-800 border-rose-300">
                                        {acc.status === 'Renewed' ? 'नूतनीकरण झालेले (Renewed)' : 'बंद झालेले (Closed)'}
                                      </span>
                                    ) : (
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm border ${
                                        isMatured ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                                      }`}>
                                        {isMatured ? 'मुदत संपली (Matured)' : 'मुदत चालू (Premature)'}
                                      </span>
                                    )}
                                    {isOverdue && (
                                      <span className="ml-2 text-[10.5px] font-semibold text-amber-700">
                                        ({overdueDays} दिवस ओव्हरड्यू)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    सुरू दिनांक
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono text-slate-800 border-r border-slate-200">
                                    {formatDateDisplay(acc.openingDate)}
                                  </td>
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    मुदतपूर्ती दिनांक
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono font-bold text-slate-900">
                                    {formatDateDisplay(acc.maturityDate)}
                                    {elapsedDaysInfo && elapsedDaysInfo.contractedDays > 0 && (
                                      <span className="ml-1.5 text-[10px] font-normal text-slate-500 font-sans">
                                        (करार मुदत: {elapsedDaysInfo.contractedDays} दिवस)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200 bg-amber-50/20">
                                  <th className="bg-amber-50/70 px-2.5 py-1.5 text-left font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                    व्यवहार दिनांक
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono font-bold text-slate-900 border-r border-slate-200">
                                    {formatDateDisplay(closureDate)}
                                    <span className="ml-1.5 text-[9.5px] font-normal text-slate-500 font-sans">
                                      (सक्रिय सीबीएस)
                                    </span>
                                  </td>
                                  <th className="bg-amber-50/70 px-2.5 py-1.5 text-left font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                    व्यवहार दिनांक पर्यंतचे दिवस
                                  </th>
                                  <td className="px-2.5 py-1.5">
                                    {elapsedDaysInfo ? (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-mono font-black text-xs text-primary">
                                          {elapsedDaysInfo.elapsedDays} दिवस
                                        </span>
                                        {elapsedDaysInfo.isPremature && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-sm">
                                            🏃‍♂️ मुदतीपूर्वी {elapsedDaysInfo.remainingDays} दिवस बाकी
                                          </span>
                                        )}
                                        {elapsedDaysInfo.isExactMaturity && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 px-1.5 py-0.5 rounded-sm">
                                            🎯 तंतोतंत मुदतपूर्ती
                                          </span>
                                        )}
                                        {elapsedDaysInfo.isOverdue && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-300 px-1.5 py-0.5 rounded-sm">
                                            ⏳ मुदतीनंतर +{elapsedDaysInfo.overdueDays} दिवस ओव्हरड्यू
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                </tr>
                                <tr className="border-b border-slate-200">
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    ठेव मुद्दल
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono font-bold text-slate-900 border-r border-slate-200">
                                    ₹ {fmt(acc.depositAmount)}
                                  </td>
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    व्याजदर
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono font-bold text-blue-700">
                                    {acc.interestRate}% p.a.
                                    {acc.isSeniorCitizen && (
                                      <span className="ml-1.5 text-[10px] text-amber-700 font-normal">
                                        (ज्येष्ठ नागरिक)
                                      </span>
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    मुदतपूर्ती रक्कम
                                  </th>
                                  <td className="px-2.5 py-1.5 font-mono font-bold text-emerald-700 border-r border-slate-200">
                                    ₹ {fmt(acc.maturityAmount || 0)}
                                  </td>
                                  <th className="bg-slate-50/80 px-2.5 py-1.5 text-left font-medium text-slate-600 border-r border-slate-200 whitespace-nowrap">
                                    इतर तपशील
                                  </th>
                                  <td className="px-2.5 py-1.5 text-slate-700">
                                    {acc.isSeniorCitizen ? 'ज्येष्ठ नागरिक ठेव' : 'नियमित ठेव'}
                                    {acc.legacyAccruedInt > 0 ? ` • जुने संचित व्याज: ₹ ${fmt(acc.legacyAccruedInt)}` : ''}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </fieldset>

                        {/* Group Box 3: Transaction Action */}
                        <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3 bg-white shadow-2xs">
                          <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>३. व्यवहार प्रकार व कृती (Transaction Action)</span>
                          </legend>

                          <div className="space-y-2 mt-1">
                            <FormRow label="कृती (Action)" required>
                              {!isMatured ? (
                                <div className="flex">
                                  <span className={`${segBase} ${segOn} !cursor-default !flex-none`}>
                                    <Clock className="w-3.5 h-3.5" />
                                    मुदतपूर्व बंद व परतावा (Premature Close)
                                  </span>
                                </div>
                              ) : (
                                <div className="flex">
                                  <label className={`${segBase} ${actionType === 'MaturityClose' ? segOn : segOff}`}>
                                    <input
                                      type="radio"
                                      name="actionType"
                                      value="MaturityClose"
                                      checked={actionType === 'MaturityClose'}
                                      onChange={(e) => {
                                        manualActionChoiceAccIdRef.current = acc.fdAccountID;
                                        setActionType(e.target.value);
                                        if (hasDirectLien && activeLoansData?.loans?.length) {
                                          setAdjustInLoan(true);
                                        }
                                      }}
                                      className="sr-only"
                                    />
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    मुदतपूर्ती पेमेंट (Maturity Payout)
                                  </label>
                                  <label className={`${segBase} ${actionType === 'Renewal' ? segOn : segOff}`}>
                                    <input
                                      type="radio"
                                      name="actionType"
                                      value="Renewal"
                                      checked={actionType === 'Renewal'}
                                      onChange={(e) => {
                                        manualActionChoiceAccIdRef.current = acc.fdAccountID;
                                        setActionType(e.target.value);
                                        setError('');
                                        if (!targetSchemeId && schemes.length > 0) {
                                          setTargetSchemeId(acc.fdSchemeID || schemes[0].fdSchemeID);
                                        }
                                      }}
                                      className="sr-only"
                                    />
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    नूतनीकरण (FD Renewal)
                                  </label>
                                </div>
                              )}
                            </FormRow>

                            {actionType === 'PrematureClose' && (
                              <FormRow label="लागू सवलत दर (Rate)">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="h-8 inline-flex items-center px-2.5 border border-slate-200 bg-slate-50 rounded-sm font-mono font-bold text-xs text-slate-900">
                                    {prematurePreview?.prematureRate ?? acc.interestRate}% p.a.
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    प्रत्यक्ष पूर्ण कालावधीच्या स्लॅब दरानुसार व्याज पुनर्गणना (RBI नियम)
                                  </span>
                                </div>
                              </FormRow>
                            )}

                            {actionType === 'Renewal' && (
                              <>
                                <FormRow label="नूतनीकरण प्रकार (Mode)" required>
                                  <div className="flex">
                                    <label className={`${segBase} ${renewalType === 'PrincipalPlusInterest' ? segOn : segOff}`}>
                                      <input
                                        type="radio"
                                        name="renewalType"
                                        value="PrincipalPlusInterest"
                                        checked={renewalType === 'PrincipalPlusInterest'}
                                        onChange={(e) => setRenewalType(e.target.value)}
                                        className="sr-only"
                                      />
                                      मुद्दल + व्याज (Full Roll)
                                    </label>
                                    <label className={`${segBase} ${renewalType === 'PrincipalOnly' ? segOn : segOff}`}>
                                      <input
                                        type="radio"
                                        name="renewalType"
                                        value="PrincipalOnly"
                                        checked={renewalType === 'PrincipalOnly'}
                                        onChange={(e) => setRenewalType(e.target.value)}
                                        className="sr-only"
                                      />
                                      केवळ मूळ मुद्दल (Principal Only)
                                    </label>
                                  </div>
                                </FormRow>
                                <FormRow label="नवीन योजना (New Scheme)" required>
                                  <select
                                    value={targetSchemeId}
                                    onChange={(e) => handleTargetSchemeChange(parseInt(e.target.value))}
                                    className={`${ctrl} font-semibold cursor-pointer`}
                                    required
                                  >
                                    {schemes.map(s => (
                                      <option key={s.fdSchemeID} value={s.fdSchemeID}>
                                        {s.schemeName} ({s.interestRate}%, {s.durationMonths} {s.durationType === 'Days' ? 'दिवस' : s.durationType === 'Years' ? 'वर्षे' : 'महिने'}{s.schemeDurationModel === 'Slab' ? ' - स्लॅब' : ''})
                                      </option>
                                    ))}
                                  </select>
                                </FormRow>

                                {renewalSimulation?.targetScheme && (
                                  <div className="bg-slate-50 border border-slate-300 rounded-sm p-3 space-y-2.5 shadow-2xs mt-1">
                                    {/* Scheme Header Badge */}
                                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-800 text-xs">
                                          {renewalSimulation.targetScheme.schemeName}
                                        </span>
                                        {renewalSimulation.targetScheme.schemeCode && (
                                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono font-bold">
                                            {renewalSimulation.targetScheme.schemeCode}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10.5px]">
                                        <span className={`px-2 py-0.5 rounded font-bold border ${
                                          renewalSimulation.targetScheme.interestType === 'Cumulative'
                                            ? 'bg-purple-50 text-purple-800 border-purple-300'
                                            : renewalSimulation.targetScheme.interestType === 'MIS' || renewalSimulation.targetScheme.interestType === 'Monthly Interest'
                                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                        }`}>
                                          {renewalSimulation.targetScheme.interestType === 'Cumulative'
                                            ? 'चक्रवाढ व्याज (Cumulative)'
                                            : renewalSimulation.targetScheme.interestType === 'MIS' || renewalSimulation.targetScheme.interestType === 'Monthly Interest'
                                            ? 'मासिक व्याज (Monthly Interest / MIS)'
                                            : 'सरळ व्याज (Simple Interest)'}
                                        </span>
                                        <span className="px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                          {renewalSimulation.targetScheme.schemeDurationModel === 'Slab' ? 'कालावधी स्लॅब (Slab-based)' : 'फिक्स्ड कालावधी (Fixed)'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Key Rates and Features */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                      <div className="bg-white p-2 rounded border border-slate-200">
                                        <span className="text-gray-500 block text-[10px]">सामान्य व्याजदर (General):</span>
                                        <span className="font-bold text-slate-900 font-mono text-xs">
                                          {renewalSimulation.targetScheme.interestRate}%
                                        </span>
                                      </div>
                                      <div className="bg-white p-2 rounded border border-slate-200">
                                        <span className="text-gray-500 block text-[10px]">ज्येष्ठ नागरिक दर (Senior):</span>
                                        <span className="font-bold text-emerald-700 font-mono text-xs">
                                          {renewalSimulation.targetScheme.seniorCitizenInterestRate || renewalSimulation.targetScheme.interestRate}%
                                        </span>
                                      </div>
                                      <div className="bg-white p-2 rounded border border-slate-200">
                                        <span className="text-gray-500 block text-[10px]">मूळ कालावधी (Default Tenor):</span>
                                        <span className="font-bold text-slate-900">
                                          {renewalSimulation.targetScheme.durationMonths} {renewalSimulation.targetScheme.durationType === 'Days' ? 'दिवस' : renewalSimulation.targetScheme.durationType === 'Years' ? 'वर्षे' : 'महिने'}
                                        </span>
                                      </div>
                                      <div className="bg-white p-2 rounded border border-slate-200">
                                        <span className="text-gray-500 block text-[10px]">व्याज आकारणी वारंवारता:</span>
                                        <span className="font-bold text-slate-800">
                                          {(renewalSimulation.targetScheme as any).interestCompoundingFrequency || 'वार्षिक / मुदतीअखेर'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Senior Citizen Indicator if applicable */}
                                    {renewalSimulation.isSenior && (
                                      <div className="bg-emerald-50 border border-emerald-300 rounded p-1.5 text-[11px] text-emerald-900 font-bold flex items-center gap-1.5">
                                        <span>👴</span>
                                        <span>खातेदार ज्येष्ठ नागरिक (Senior Citizen 60+) असल्याने सवलत दर {renewalSimulation.appliedRate}% लागू केला आहे.</span>
                                      </div>
                                    )}

                                    {/* Slabs breakdown if Slab model */}
                                    {renewalSimulation.targetScheme.schemeDurationModel === 'Slab' && renewalSimulation.targetScheme.slabs && renewalSimulation.targetScheme.slabs.length > 0 && (
                                      <div className="space-y-1">
                                        <span className="text-[10.5px] font-bold text-slate-700 block">
                                          योजना कालावधी स्लॅब दर तक्ता (Tenor Slabs):
                                        </span>
                                        <div className="overflow-x-auto max-h-32 border border-slate-200 rounded bg-white">
                                          <table className="w-full text-left text-[10.5px] border-collapse">
                                            <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 font-bold">
                                              <tr>
                                                <th className="p-1.5 border-r border-slate-200">कालावधी (दिवस)</th>
                                                <th className="p-1.5 border-r border-slate-200 text-right">सामान्य दर (%)</th>
                                                <th className="p-1.5 border-r border-slate-200 text-right">ज्येष्ठ नागरिक (%)</th>
                                                <th className="p-1.5 text-center">स्थिती</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {renewalSimulation.targetScheme.slabs.filter(s => s.isActive !== false).map((slab, idx) => {
                                                const isMatched = renewalSimulation.matchedSlab === slab;
                                                return (
                                                  <tr key={idx} className={`border-b border-slate-100 last:border-0 ${isMatched ? 'bg-emerald-100/70 font-bold text-emerald-950' : 'text-slate-700'}`}>
                                                    <td className="p-1.5 border-r border-slate-200">
                                                      {slab.fromDays} ते {slab.toDays} दिवस
                                                    </td>
                                                    <td className="p-1.5 border-r border-slate-200 text-right font-mono">
                                                      {slab.interestRate}%
                                                    </td>
                                                    <td className="p-1.5 border-r border-slate-200 text-right font-mono text-emerald-700">
                                                      {slab.seniorCitizenRate}%
                                                    </td>
                                                    <td className="p-1.5 text-center">
                                                      {isMatched ? (
                                                        <span className="bg-emerald-700 text-white text-[9px] px-1.5 py-0.2 rounded font-black">
                                                          ✓ लागू स्लॅब
                                                        </span>
                                                      ) : (
                                                        <span className="text-gray-400 text-[10px]">-</span>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Custom Tenor / Duration Inputs */}
                                <FormRow label="नूतनीकरण कालावधी (Tenor)" required>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      max="3650"
                                      value={renewalDurationValue}
                                      onChange={(e) => setRenewalDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
                                      className={`${ctrl} w-24 font-bold text-center`}
                                      required
                                    />
                                    <select
                                      value={renewalDurationType}
                                      onChange={(e) => setRenewalDurationType(e.target.value as 'Days' | 'Months' | 'Years')}
                                      className={`${ctrl} w-32 font-semibold cursor-pointer`}
                                    >
                                      <option value="Months">महिने (Months)</option>
                                      <option value="Days">दिवस (Days)</option>
                                      <option value="Years">वर्षे (Years)</option>
                                    </select>
                                    <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded border border-primary/20 whitespace-nowrap">
                                      एकूण ~{renewalSimulation?.totalDays || 0} दिवस
                                    </span>
                                  </div>
                                  {renewalSimulation && !renewalSimulation.isSlabValid && (
                                    <div className="mt-1.5 p-2 bg-red-50 border border-red-300 rounded text-[11px] text-red-900 space-y-1">
                                      <div className="font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                        <span>
                                          निवडलेला कालावधी ({renewalSimulation.totalDays} दिवस) या योजनेच्या कोणत्याही मंजूर स्लॅबमध्ये बसत नाही!
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10.5px] text-red-800">मंजूर स्लॅब निवडा:</span>
                                        {(renewalSimulation.targetScheme.slabs || [])
                                          .filter(s => s.isActive !== false)
                                          .map((slab, sIdx) => (
                                            <button
                                              key={sIdx}
                                              type="button"
                                              onClick={() => {
                                                setRenewalDurationType('Days');
                                                setRenewalDurationValue(Number(slab.fromDays));
                                                setError('');
                                              }}
                                              className="px-2 py-0.5 bg-white hover:bg-red-100 text-red-900 border border-red-300 rounded font-bold text-[10px] cursor-pointer"
                                            >
                                              {slab.fromDays}–{slab.toDays} दिवस ({slab.interestRate}%)
                                            </button>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </FormRow>

                                {/* Auto-filled & Editable New FD Interest Rate */}
                                <FormRow label="नवीन ठेव व्याजदर (% p.a.)" required>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative flex items-center">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max="30"
                                        value={renewalInterestRateInput}
                                        onChange={(e) => {
                                          setIsRenewalRateManuallyEdited(true);
                                          setRenewalInterestRateInput(e.target.value);
                                          setError('');
                                        }}
                                        placeholder="उदा. 9.00"
                                        className={`${ctrl} w-28 pr-6 font-bold font-mono text-center ${
                                          renewalSimulation?.isCustomInterestRate
                                            ? 'border-amber-500 bg-amber-50/70 text-amber-950'
                                            : ''
                                        }`}
                                        required
                                      />
                                      <span className="absolute right-2 text-[11px] font-bold text-gray-500 pointer-events-none">%</span>
                                    </div>
                                    {renewalSimulation && (
                                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-1 rounded">
                                        योजना दर (Auto): <b className="font-mono text-slate-900">{renewalSimulation.schemeDefaultRate}%</b>
                                      </span>
                                    )}
                                    {renewalSimulation?.isCustomInterestRate && (
                                      <>
                                        <span className="text-[10.5px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                                          ✍️ मॅन्युअल दर लागू
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIsRenewalRateManuallyEdited(false);
                                            if (renewalSimulation) {
                                              setRenewalInterestRateInput(String(Number(renewalSimulation.schemeDefaultRate || 0)));
                                            }
                                            setError('');
                                          }}
                                          className="text-[11px] font-bold text-primary hover:underline bg-primary/5 border border-primary/25 px-2 py-0.5 rounded cursor-pointer"
                                          title="योजनेचा मूळ ऑटो दर परत लागू करा"
                                        >
                                          ↺ ऑटो दर
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </FormRow>

                                {isOverdue && (
                                  <FormRow label="प्रभावी दिनांक (Effective)">
                                    <select
                                      value={renewalEffectiveFrom}
                                      onChange={(e) => setRenewalEffectiveFrom(e.target.value as 'ClosureDate' | 'MaturityDate')}
                                      className={`${ctrl} font-semibold cursor-pointer`}
                                    >
                                      <option value="ClosureDate">आजपासून (Closure Date) - ओव्हरड्यू व्याज जोडून</option>
                                      <option value="MaturityDate">मुदतपूर्तीपासून (Retroactive) - मुदतपूर्ती तारखेपासून थेट</option>
                                    </select>
                                  </FormRow>
                                )}

                                {/* पावती क्रमांक धोरण व संदर्भ (Receipt Numbering Option) */}
                                <FormRow label="पावती क्रमांक (Receipt No)">
                                  <div className="space-y-1.5">
                                    {sansthaPolicyError && (
                                      <div className="px-2.5 py-1 bg-rose-50 border border-rose-300 rounded text-[10.5px] font-bold text-rose-800">
                                        ⚠️ {sansthaPolicyError}
                                      </div>
                                    )}
                                    {(sansthaRenewalPolicy === 'HYBRID_CHOICE' || allowManualRenewalReceipt) ? (
                                      <div className="flex flex-wrap items-center gap-2">
                                        {(sansthaRenewalPolicy === 'NEW_RECEIPT' || sansthaRenewalPolicy === 'HYBRID_CHOICE') && (
                                          <button
                                            type="button"
                                            onClick={() => setReceiptNoMode('NEW_RECEIPT')}
                                            className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                                              receiptNoMode === 'NEW_RECEIPT'
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                            }`}
                                          >
                                            नवीन CBS पावती क्र.
                                          </button>
                                        )}
                                        {(sansthaRenewalPolicy === 'RETAIN_ORIGINAL' || sansthaRenewalPolicy === 'HYBRID_CHOICE') && (
                                          <button
                                            type="button"
                                            onClick={() => setReceiptNoMode('RETAIN_ORIGINAL')}
                                            className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                                              receiptNoMode === 'RETAIN_ORIGINAL'
                                                ? 'bg-amber-600 text-white border-amber-700'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                            }`}
                                          >
                                            मूळ क्र. कायम ({acc.receiptNo || acc.legacyAccountNumber || acc.accountNo})
                                          </button>
                                        )}
                                        {(sansthaRenewalPolicy === 'NEXT_LEGACY' || sansthaRenewalPolicy === 'HYBRID_CHOICE') && (
                                          <button
                                            type="button"
                                            onClick={() => setReceiptNoMode('NEXT_LEGACY')}
                                            className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                                              receiptNoMode === 'NEXT_LEGACY'
                                                ? 'bg-emerald-600 text-white border-emerald-700'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                            }`}
                                          >
                                            पुढील जुना FD क्र.{nextLegacyPreview ? ` (${nextLegacyPreview})` : ''}
                                          </button>
                                        )}
                                        {allowManualRenewalReceipt && (
                                          <button
                                            type="button"
                                            onClick={() => setReceiptNoMode('CUSTOM')}
                                            className={`px-2.5 py-1 rounded text-[11px] font-bold border cursor-pointer ${
                                              receiptNoMode === 'CUSTOM'
                                                ? 'bg-indigo-600 text-white border-indigo-700'
                                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                            }`}
                                          >
                                            कस्टम / प्री-प्रिंटेड क्र.
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-bold text-slate-800">
                                        {sansthaRenewalPolicy === 'RETAIN_ORIGINAL'
                                          ? `📌 मूळ पावती क्र. "${acc.receiptNo || acc.legacyAccountNumber || acc.accountNo}" कायम राहील (नूतनीकरण सायकल #${(acc.renewalCycleNo || 0) + 1})`
                                          : sansthaRenewalPolicy === 'NEXT_LEGACY'
                                          ? `🔢 पुढील जुना FD क्रमांक आपोआप तयार होईल${nextLegacyPreview ? `: ${nextLegacyPreview}` : ''} (संस्था धोरणानुसार)`
                                          : '🆕 नवीन १४-अंकी CBS पावती क्रमांक आपोआप तयार होईल (संस्था धोरणानुसार)'}
                                      </div>
                                    )}

                                    {receiptNoMode === 'CUSTOM' && allowManualRenewalReceipt && (
                                      <input
                                        type="text"
                                        value={customReceiptNo}
                                        onChange={(e) => setCustomReceiptNo(e.target.value)}
                                        placeholder="नवीन प्री-प्रिंटेड पावती क्रमांक टाका (उदा. 895)..."
                                        className={`${ctrl} font-mono font-bold`}
                                      />
                                    )}
                                  </div>
                                </FormRow>

                                {/* Live Renewal Simulation & Maturity Calculator Card */}
                                {renewalSimulation && (
                                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border-2 border-indigo-200 rounded-sm p-3 space-y-2 text-xs shadow-2xs mt-2">
                                    <div className="flex items-center justify-between border-b border-indigo-200/80 pb-1.5 font-bold text-indigo-950">
                                      <div className="flex items-center gap-1.5">
                                        <Scale className="w-4 h-4 text-indigo-700" />
                                        <span>📊 नूतनीकरण मुदतपूर्ती अंदाजपत्रक (Live Renewal Calculation Preview)</span>
                                      </div>
                                      <span className="text-[10px] bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded font-black">
                                        लागू दर: {renewalSimulation.appliedRate}%
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                                      <div className="bg-white p-2 rounded border border-indigo-100 shadow-2xs">
                                        <span className="text-gray-500 block text-[10px]">नवीन ठेव मुद्दल (New Deposit):</span>
                                        <strong className="text-slate-900 font-mono text-xs">
                                          ₹{renewalSimulation.newDepositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </strong>
                                      </div>

                                      <div className="bg-white p-2 rounded border border-indigo-100 shadow-2xs">
                                        <span className="text-gray-500 block text-[10px]">नूतनीकरण सुरुवात दिनांक:</span>
                                        <span className="font-bold text-slate-800">
                                          {formatDateDisplay(renewalSimulation.effectiveStartDateStr)}
                                        </span>
                                      </div>

                                      <div className="bg-white p-2 rounded border border-indigo-100 shadow-2xs">
                                        <span className="text-gray-500 block text-[10px]">नवीन मुदतपूर्ती दिनांक:</span>
                                        <span className="font-bold text-amber-800 font-mono">
                                          {renewalSimulation.simMaturityDateStr}
                                        </span>
                                      </div>

                                      <div className="bg-white p-2 rounded border border-indigo-100 shadow-2xs">
                                        <span className="text-gray-500 block text-[10px]">नवीन मुदतपूर्ती रक्कम (Maturity Amount):</span>
                                        <strong className="text-emerald-700 font-mono text-xs font-black">
                                          ₹{renewalSimulation.simMaturityAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </strong>
                                      </div>

                                      <div className="bg-white p-2 rounded border border-indigo-100 shadow-2xs">
                                        <span className="text-gray-500 block text-[10px]">अपेक्षित एकूण परतावा / व्याज:</span>
                                        <strong className="text-primary font-mono text-xs">
                                          ₹{renewalSimulation.estimatedInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </strong>
                                      </div>

                                      {renewalSimulation.monthlyPayout > 0 && (
                                        <div className="bg-white p-2 rounded border border-indigo-100 shadow-2xs">
                                          <span className="text-gray-500 block text-[10px]">मासिक व्याज परतावा (Monthly Payout):</span>
                                          <strong className="text-blue-700 font-mono text-xs">
                                            ₹{renewalSimulation.monthlyPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / महिना
                                          </strong>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </fieldset>

                        {/* Group Box 4: Payment Details */}
                        <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3 bg-white shadow-2xs">
                          <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>
                              {isFullRoll
                                ? '४. नूतनीकरण नोंद (Renewal Details)'
                                : actionType === 'Renewal'
                                ? '४. व्याज परतावा तपशील (Interest Payout)'
                                : '४. परतावा पेमेंट तपशील व खाती (Payment Details)'}
                            </span>
                          </legend>

                          <div className="space-y-2 mt-1">
                            {isFullRoll ? (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-sm px-3 py-2 text-xs text-emerald-950 flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span>
                                  मूळ मुद्दल (₹{fmt(principal)}) + साचलेले व्याज (₹{fmt(interestPayable)})
                                  {effOverdue > 0 && <> + ओव्हरड्यू व्याज (₹{fmt(effOverdue)})</>} = <b>₹{fmt(finalAmount)}</b> संपूर्ण रक्कम नवीन मुदत ठेव पावतीमध्ये जमा होईल. रोख/बँक पेआउटची आवश्यकता नाही.
                                </span>
                              </div>
                            ) : (
                              <>
                                {(actionType === 'MaturityClose' || actionType === 'PrematureClose') &&
                                  hasDirectLien &&
                                  !adjustInLoan && (
                                    <div className="bg-red-50 border border-red-300 border-l-4 border-l-red-600 rounded-sm p-2.5 space-y-2 mb-1.5 text-xs text-red-950">
                                      <div className="flex items-start gap-2 font-semibold">
                                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                        <span>
                                          सदर मुदत ठेव पावतीवर कर्ज खाते क्र. <b>{activeLoansData?.directLienLoanNo || acc.lienLoanAccountNo || 'सक्रिय कर्ज'}</b> चा तारण बोजा आहे. नियम: कर्ज बाकी असताना ठेव मोडून परतावा घेता येत नाही.
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 pl-6">
                                        {isMatured && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              manualActionChoiceAccIdRef.current = acc.fdAccountID;
                                              setActionType('Renewal');
                                              setError('');
                                            }}
                                            className="h-7 px-2.5 text-[11px] font-bold bg-primary text-white rounded-sm hover:opacity-90 flex items-center gap-1 cursor-pointer"
                                          >
                                            <RefreshCw className="w-3 h-3" />
                                            नूतनीकरण करा (FD Renewal)
                                          </button>
                                        )}
                                        {activeLoansData?.loans && activeLoansData.loans.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const firstLn =
                                                activeLoansData.loans.find(l => l.loanAccountId === targetLoanAccountId) ||
                                                activeLoansData.loans[0];
                                              setAdjustInLoan(true);
                                              if (firstLn) {
                                                setTargetLoanAccountId(firstLn.loanAccountId);
                                                setLoanAdjustmentAmount(String(Math.min(netPayout, firstLn.totalDue)));
                                              }
                                              setError('');
                                            }}
                                            className="h-7 px-2.5 text-[11px] font-bold bg-amber-600 text-white rounded-sm hover:bg-amber-700 flex items-center gap-1 cursor-pointer"
                                          >
                                            🛡️ कर्जात समायोजित करा (Adjust in Loan)
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                {(actionType === 'MaturityClose' || actionType === 'PrematureClose') &&
                                  hasLien &&
                                  activeLoansData &&
                                  Array.isArray(activeLoansData.loans) &&
                                  activeLoansData.loans.length > 0 && (() => {
                                    const selectedLoanObj =
                                      activeLoansData.loans.find(l => l.loanAccountId === targetLoanAccountId) ||
                                      activeLoansData.loans[0];
                                    const maxLoanAdj = selectedLoanObj ? Math.min(netPayout, selectedLoanObj.totalDue) : 0;
                                    const effLoanAdj = adjustInLoan
                                      ? (loanAdjustmentAmount !== ''
                                          ? Math.min(Math.max(0, parseFloat(loanAdjustmentAmount) || 0), maxLoanAdj)
                                          : maxLoanAdj)
                                      : 0;
                                    const surplusAmt = adjustInLoan
                                      ? Math.max(0, Number((netPayout - effLoanAdj).toFixed(2)))
                                      : 0;

                                    return (
                                      <div className="bg-amber-50/70 border border-amber-300 rounded-sm p-2.5 space-y-2 mb-1">
                                        <label className="flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={adjustInLoan}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setAdjustInLoan(checked);
                                              if (checked && selectedLoanObj) {
                                                setTargetLoanAccountId(selectedLoanObj.loanAccountId);
                                                setLoanAdjustmentAmount(String(Math.min(netPayout, selectedLoanObj.totalDue)));
                                              }
                                            }}
                                            disabled={isPassingMode}
                                            className="w-3.5 h-3.5 text-amber-600 rounded"
                                          />
                                          <span>
                                            🛡️ सक्रिय कर्ज खात्यात परतावा रक्कम समायोजित करा (Adjust in Active Loan — एकूण कर्ज बाकी: ₹{fmt(activeLoansData.totalOutstandingLiability || 0)})
                                          </span>
                                        </label>

                                        {!hasDirectLien && !adjustInLoan && (
                                          <p className="text-[11px] text-slate-600 pl-5">
                                            सदर पावती तारण नाही — थेट बचत/रोख/बँक परतावा घेता येईल किंवा ऐच्छिकपणे कर्जात समायोजित करता येईल.
                                          </p>
                                        )}

                                        {adjustInLoan && (
                                          <div className="space-y-2 pt-1.5 border-t border-amber-200">
                                            <FormRow label="कर्ज खाते (Loan A/c)" required>
                                              <select
                                                value={selectedLoanObj?.loanAccountId || 0}
                                                onChange={(e) => {
                                                  const newLoanId = parseInt(e.target.value) || 0;
                                                  setTargetLoanAccountId(newLoanId);
                                                  const foundLoan = activeLoansData.loans.find(l => l.loanAccountId === newLoanId);
                                                  if (foundLoan) {
                                                    setLoanAdjustmentAmount(String(Math.min(netPayout, foundLoan.totalDue)));
                                                  }
                                                }}
                                                className={`${ctrl} font-semibold cursor-pointer`}
                                              >
                                                {activeLoansData.loans.map(ln => (
                                                  <option key={ln.loanAccountId} value={ln.loanAccountId}>
                                                    {ln.loanAccountNo} - {ln.loanType} (एकूण येणे: ₹{fmt(ln.totalDue)})
                                                  </option>
                                                ))}
                                              </select>
                                            </FormRow>

                                            <FormRow label="कर्जात जमा रक्कम (₹)" required>
                                              <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                  type="number"
                                                  step="0.01"
                                                  min="0.01"
                                                  max={maxLoanAdj}
                                                  value={loanAdjustmentAmount !== '' ? loanAdjustmentAmount : maxLoanAdj}
                                                  onChange={(e) => setLoanAdjustmentAmount(e.target.value)}
                                                  className={`${ctrl} !w-40 font-mono font-bold`}
                                                />
                                                <span className="text-[11px] text-amber-900 font-semibold">
                                                  कमाल मर्यादा: ₹{fmt(maxLoanAdj)} • उर्वरित शिल्लक परतावा (Surplus):{' '}
                                                  <strong className="text-emerald-800 font-mono">₹{fmt(surplusAmt)}</strong>
                                                </span>
                                              </div>
                                            </FormRow>

                                            {surplusAmt > 0 && (
                                              <div className="bg-white border border-blue-200 rounded-sm p-2.5 space-y-2">
                                                <div className="text-[11px] font-bold text-blue-900">
                                                  शिल्लक परतावा वाटप (Surplus Payout: ₹{fmt(surplusAmt)})
                                                </div>

                                                <FormRow label="शिल्लक परतावा पद्धत" required>
                                                  <select
                                                    value={surplusPaymentMode}
                                                    onChange={(e) => setSurplusPaymentMode(e.target.value as 'Cash' | 'Bank' | 'Transfer')}
                                                    className={`${ctrl} font-semibold cursor-pointer`}
                                                  >
                                                    <option value="Cash">रोख (Cash)</option>
                                                    <option value="Bank">बँक (Bank)</option>
                                                    <option value="Transfer">बचत खात्यात वर्ग (Saving Transfer)</option>
                                                  </select>
                                                </FormRow>

                                                {surplusPaymentMode === 'Cash' && (
                                                  <FormRow label="रोख खाते (Cash Ledger)" align="start">
                                                    <CashLedgerReflectBadge
                                                      branchId={acc.branchID}
                                                      transactionType="Withdrawal"
                                                      customTitle="शिल्लक रोख परतावा खाते"
                                                      className="!py-1.5 !px-2"
                                                    />
                                                  </FormRow>
                                                )}

                                                {surplusPaymentMode === 'Bank' && (
                                                  <>
                                                    <FormRow label="शिल्लक बँक लेजर (Bank GL)" required align="start">
                                                      <BankLedgerSelect
                                                        ledgers={allLedgers}
                                                        value={surplusBankLedgerID}
                                                        onChange={(id) => setSurplusBankLedgerID(id)}
                                                        disabled={isPassingMode}
                                                        showCountBadge
                                                      />
                                                    </FormRow>
                                                    <FormRow label="धनादेश / UTR क्र.">
                                                      <input
                                                        type="text"
                                                        value={surplusChequeNo}
                                                        onChange={(e) => setSurplusChequeNo(e.target.value)}
                                                        placeholder="उदा. Cheque 123456 / UTR"
                                                        className={`${ctrl} font-semibold`}
                                                      />
                                                    </FormRow>
                                                  </>
                                                )}

                                                {surplusPaymentMode === 'Transfer' && (
                                                  <FormRow label="शिल्लक बचत खाते (Saving A/c)" required>
                                                    <select
                                                      value={surplusSavingAccountId}
                                                      onChange={(e) => setSurplusSavingAccountId(e.target.value ? parseInt(e.target.value) : '')}
                                                      className={`${ctrl} font-semibold cursor-pointer`}
                                                      required
                                                    >
                                                      <option value="">-- बचत खाते निवडा --</option>
                                                      {memberSavingAccounts.map(s => (
                                                        <option key={s.savingAccountID} value={s.savingAccountID}>
                                                          {s.accountNo} (शिल्लक: ₹{s.currentBalance.toLocaleString()})
                                                        </option>
                                                      ))}
                                                    </select>
                                                  </FormRow>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                {!((actionType === 'MaturityClose' || actionType === 'PrematureClose') && adjustInLoan && hasLien) && (
                                  <>
                                    <FormRow label={actionType === 'Renewal' ? 'व्याज पेमेंट पद्धत (Mode)' : 'पेमेंट पद्धत (Mode)'} required>
                                      <select
                                        value={paymentMode}
                                        onChange={(e) => setPaymentMode(e.target.value as 'Cash' | 'Bank' | 'Transfer')}
                                        className={`${ctrl} font-semibold cursor-pointer`}
                                      >
                                        <option value="Cash">रोख (Cash)</option>
                                        <option value="Bank">बँक (Bank)</option>
                                        <option value="Transfer">बचत खात्यात वर्ग (Saving Transfer)</option>
                                      </select>
                                    </FormRow>

                                    {paymentMode === 'Cash' && (
                                      <FormRow label="रोख खाते (Cash Ledger)" align="start">
                                        <CashLedgerReflectBadge
                                          branchId={acc.branchID}
                                          transactionType="Withdrawal"
                                          customTitle="रोख खाते (Cash Ledger)"
                                          className="!py-1.5 !px-2"
                                        />
                                      </FormRow>
                                    )}

                                    {paymentMode === 'Bank' && (
                                      <>
                                        <FormRow label="बँक लेजर (Bank GL)" required align="start">
                                          <BankLedgerSelect
                                            ledgers={allLedgers}
                                            value={bankAccountLedgerID}
                                            onChange={(id) => setBankAccountLedgerID(id)}
                                            disabled={isPassingMode}
                                            showCountBadge
                                          />
                                        </FormRow>
                                        <FormRow label="धनादेश / UTR क्र.">
                                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2">
                                            <input
                                              type="text"
                                              value={chequeNo}
                                              onChange={(e) => setChequeNo(e.target.value)}
                                              placeholder="उदा. Cheque 123456 / UTR"
                                              className={`${ctrl} font-semibold`}
                                            />
                                            <input
                                              type="date"
                                              value={chequeDate}
                                              onChange={(e) => setChequeDate(e.target.value)}
                                              className={ctrl}
                                              title="धनादेश तारीख (Cheque Date)"
                                            />
                                          </div>
                                        </FormRow>
                                      </>
                                    )}

                                    {paymentMode === 'Transfer' && (
                                      <FormRow label="बचत खाते (Saving A/c)" required>
                                        <select
                                          value={selectedSavingAccountId}
                                          onChange={(e) => setSelectedSavingAccountId(e.target.value ? parseInt(e.target.value) : '')}
                                          className={`${ctrl} font-semibold cursor-pointer`}
                                          required
                                        >
                                          <option value="">-- बचत खाते निवडा --</option>
                                          {memberSavingAccounts.map(s => (
                                            <option key={s.savingAccountID} value={s.savingAccountID}>
                                              {s.accountNo} (शिल्लक: ₹{s.currentBalance.toLocaleString()})
                                            </option>
                                          ))}
                                        </select>
                                      </FormRow>
                                    )}
                                  </>
                                )}

                                <FormRow label="तपशील / शेरा (Narration)">
                                  <input
                                    type="text"
                                    value={narration}
                                    onChange={(e) => setNarration(e.target.value)}
                                    placeholder="उदा. मुदत ठेव परतावा / मुदतपूर्व बंद"
                                    className={ctrl}
                                  />
                                </FormRow>
                              </>
                            )}
                          </div>
                        </fieldset>

                        {/* Inline Interest Schedule (toggle from action bar) */}
                        {showInlineSchedule && scheduleSummary && (
                          <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3 bg-white shadow-2xs">
                            <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span>कालावधीनिहाय व्याज आकारणी वेळापत्रक (Interest Schedule)</span>
                            </legend>
                            <div className="flex justify-end -mt-6 mb-2">
                              <span className="text-[11px] text-slate-500">एकूण टप्पे: {scheduleSummary.periods.length}</span>
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-sm mt-1">
                              <table className="w-full border-collapse text-[11px]">
                                <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold sticky top-0">
                                  <tr>
                                    <th className="px-2 py-1 text-left">टप्पा</th>
                                    <th className="px-2 py-1 text-center">कालावधी</th>
                                    <th className="px-2 py-1 text-center">दिवस</th>
                                    <th className="px-2 py-1 text-right">आरंभी शिल्लक (₹)</th>
                                    <th className="px-2 py-1 text-right">व्याज (₹)</th>
                                    <th className="px-2 py-1 text-right">अंतिम शिल्लक (₹)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {scheduleSummary.periods.map((q, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                      <td className="px-2 py-1 font-semibold text-slate-800">{q.periodLabel}</td>
                                      <td className="px-2 py-1 text-center text-slate-600">{q.fromDate} ते {q.toDate}</td>
                                      <td className="px-2 py-1 text-center font-mono">{q.days}</td>
                                      <td className="px-2 py-1 text-right font-mono">{fmt(q.openingBalance)}</td>
                                      <td className="px-2 py-1 text-right font-mono font-semibold text-primary">{fmt(q.interestAmount)}</td>
                                      <td className="px-2 py-1 text-right font-mono font-semibold text-slate-900">{fmt(q.closingBalance)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </fieldset>
                        )}
                      </>
                    )}
                  </div>

                  {/* ================= RIGHT: SETTLEMENT PANEL (GROUP BOXES) ================= */}
                  {acc && (
                    <div className="lg:col-span-5 space-y-3.5 lg:sticky lg:top-2">
                      {/* Group Box 5: Settlement Summary */}
                      <fieldset className="border border-slate-200 rounded-md px-3.5 pt-2 pb-3.5 bg-white shadow-2xs">
                        <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-sky-50/70 border border-slate-200 rounded-sm inline-flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>थेट सेटलमेंट सारांश (Settlement Summary)</span>
                        </legend>

                        <div className="mt-1 mb-2.5 pb-2 border-b border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-[10.5px] font-medium text-slate-500">व्यवहार तपशील</span>
                          <div className="flex items-center gap-1.5">
                            {elapsedDaysInfo && (
                              <span className="text-[10px] font-mono font-semibold text-sky-700 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-sm">
                                कालावधी: {elapsedDaysInfo.elapsedDays} दिवस
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-sm">
                              {actionType === 'PrematureClose' ? 'मुदतपूर्व बंद' : actionType === 'Renewal' ? 'नूतनीकरण' : 'मुदतपूर्ती पेमेंट'}
                            </span>
                          </div>
                        </div>

                        <dl className="text-xs space-y-2">
                          {/* Row 1: Principal */}
                          <div className="flex justify-between items-center px-2.5 py-2 rounded-sm bg-slate-50/80 border border-slate-200/70">
                            <dt className="text-slate-600 font-medium">ठेव मुद्दल (Principal)</dt>
                            <dd className="font-mono font-bold text-slate-700 text-[13px]">₹ {fmt(principal)}</dd>
                          </div>

                          {/* Row 1B: Posted / Capitalized Posting Interest Audit (Shown only when > 0) */}
                          {(() => {
                            const previewSplit = resolveInterestAccountingSplit(acc, interestPayable, actionType === 'PrematureClose');
                            const hasCap = previewSplit.verifiedCapitalized > 0;
                            const hasProv = previewSplit.effectiveProvision > 0;
                            const hasMemo = previewSplit.unbackedLegacyMemo > 0;
                            if (!hasCap && !hasProv && !hasMemo) return null;
                            return (
                              <div className="px-2.5 py-2 bg-sky-50/60 rounded-sm border border-sky-200/80 space-y-1">
                                <div className="flex justify-between items-center text-[11px]">
                                  <dt className="text-sky-700 font-semibold">
                                    आधी पोस्ट केलेले व्याज (Posting Intr Audit)
                                  </dt>
                                  <dd className="font-mono font-bold text-sky-700">
                                    ₹ {fmt(previewSplit.totalPostedAvailable)}
                                  </dd>
                                </div>
                                <div className="text-[10px] text-sky-600 space-y-0.5 pt-0.5 border-t border-sky-200/50">
                                  {hasCap && (
                                    <div className="flex justify-between">
                                      <span>• कॅपिटलाइझ्ड व्याज (On Interest — FD दायित्व)</span>
                                      <span className="font-mono font-medium">₹ {fmt(previewSplit.verifiedCapitalized)}</span>
                                    </div>
                                  )}
                                  {hasProv && (
                                    <div className="flex justify-between">
                                      <span>• देणे व्याज तरतूद (POSTING_INTR)</span>
                                      <span className="font-mono font-medium">₹ {fmt(previewSplit.effectiveProvision)}</span>
                                    </div>
                                  )}
                                  {hasMemo && (
                                    <div className="flex justify-between text-amber-700">
                                      <span>• जुने संचित व्याज मेमो (लेजर OB नाही)</span>
                                      <span className="font-mono font-medium">₹ {fmt(previewSplit.unbackedLegacyMemo)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Row 2: Editable Interest with Clean Pastel Dual-Head Card */}
                          {(() => {
                            const currentInt = actionType === 'PrematureClose'
                              ? (customPrematureInterest !== '' ? (parseFloat(customPrematureInterest) || 0) : systemRecalcInt)
                              : (customAccruedInterest !== '' ? (parseFloat(customAccruedInterest) || 0) : systemAccruedInt);
                            const split = resolveInterestAccountingSplit(acc, currentInt, actionType === 'PrematureClose');
                            const clearedCap = split.clearedCapitalized;
                            const payablePortion = split.payablePortion;
                            const expensePortion = split.expensePortion;
                            const ledgersPreview = getSchemeLedgers();
                            const isPeriodic = ledgersPreview?.scheme?.interestType === 'MIS' || ledgersPreview?.scheme?.interestType === 'Monthly Interest';
                            const ledgerOptions = settlementLedgerOptions;
                            const remainingAfterCapForSplit = Math.max(0, Number((currentInt - clearedCap).toFixed(2)));
                            const activePremRev = actionType === 'PrematureClose' && enablePrematureReversal && prematureReversalInput !== ''
                              ? Math.max(0, parseFloat(prematureReversalInput) || 0)
                              : 0;

                            const rowLabel = actionType === 'PrematureClose'
                              ? 'मुदतपूर्व व्याज (रक्कम):'
                              : 'करारानुसार व्याज (रक्कम):';

                            return (
                              <div className="rounded-sm border border-slate-200/90 bg-slate-50/40 overflow-hidden">
                                {/* Total Interest Header Row */}
                                <div className="px-2.5 py-2 bg-white flex items-center justify-between gap-2 border-b border-slate-100">
                                  <dt className="text-slate-600 font-medium">
                                    {rowLabel}
                                  </dt>
                                  <dd className="flex items-center gap-1.5">
                                    {(customPrematureInterest !== '' || customAccruedInterest !== '') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCustomPrematureInterest('');
                                          setCustomAccruedInterest('');
                                          setPostedIntrDebitInput('');
                                          setExpenseIntrDebitInput('');
                                          setPrematureReversalInput('');
                                          if (customOverdueInterest === '') {
                                            setIsManualOverride(false);
                                            setManualOverrideReason('');
                                          }
                                        }}
                                        className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded cursor-pointer transition"
                                        title="सिस्टीम गणनेनुसार पूर्ववत करा"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </button>
                                    )}
                                    <span className="text-slate-400 font-mono text-xs">+ ₹</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={
                                        actionType === 'PrematureClose'
                                          ? (customPrematureInterest !== '' ? customPrematureInterest : (customAccruedInterest !== '' ? customAccruedInterest : systemRecalcInt))
                                          : (customAccruedInterest !== '' ? customAccruedInterest : (customPrematureInterest !== '' ? customPrematureInterest : systemAccruedInt))
                                      }
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setIsManualOverride(true);
                                        setManualOverrideReason('थेट सेटलमेंट संपादन');
                                        setCustomPrematureInterest(val);
                                        setCustomAccruedInterest(val);
                                        setPostedIntrDebitInput('');
                                        setExpenseIntrDebitInput('');
                                        setPrematureReversalInput('');
                                      }}
                                      className="w-28 h-7 text-right font-mono font-bold text-xs bg-amber-50/50 border border-amber-200 rounded-sm px-2 text-slate-700 focus:outline-none focus:border-sky-400 focus:bg-white"
                                      title="व्याज रक्कम थेट येथे बदला"
                                    />
                                  </dd>
                                </div>

                                {/* Subheader */}
                                <div className="px-2.5 py-1.5 bg-sky-50/60 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-1.5">
                                  <span className="text-[10.5px] font-semibold text-sky-700">
                                    व्याज नावे लेजर विभागणी (POSTING + नफा-तोटा)
                                  </span>
                                  {!isPeriodic && split.unbackedLegacyMemo > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const rem = remainingAfterCapForSplit;
                                        const targetLegacyTotal = split.effectiveProvision + split.unbackedLegacyMemo;
                                        const fillPosted = rem > 0
                                          ? Math.min(rem, targetLegacyTotal)
                                          : targetLegacyTotal;
                                        const fillExpense = Math.max(0, Number((rem - fillPosted).toFixed(2)));
                                        setPostedIntrDebitInput(fillPosted.toFixed(2));
                                        setExpenseIntrDebitInput(fillExpense.toFixed(2));
                                        if (actionType === 'PrematureClose' && rem === 0 && fillPosted > 0) {
                                          setEnablePrematureReversal(true);
                                          setPrematureReversalInput(fillPosted.toFixed(2));
                                        }
                                      }}
                                      className="px-2 py-0.5 text-[10px] font-semibold rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer transition"
                                      title="या खात्यातील जुने संचित व्याज POSTING_INTR खात्यातून नावे करण्यासाठी क्लिक करा"
                                    >
                                      जुनी तरतूद ₹{fmt(split.unbackedLegacyMemo)} वापरा
                                    </button>
                                  )}
                                </div>

                                {/* Soft Pastel Inputs + Styled Dropdowns */}
                                <div className="p-2.5 space-y-2">
                                  {/* 1) POSTING_INTR */}
                                  <div className="p-2 rounded-sm bg-emerald-50/45 border border-emerald-200/80 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <label className="text-[11px] font-semibold text-emerald-700">
                                        १) POSTING_INTR नावे (आधी तरतूद Dr)
                                      </label>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] font-mono text-slate-400">₹</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={postedIntrDebitInput !== '' ? postedIntrDebitInput : payablePortion.toFixed(2)}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setPostedIntrDebitInput(v);
                                            if (!isPeriodic) {
                                              const num = Math.max(0, parseFloat(v) || 0);
                                              if (actionType !== 'PrematureClose') {
                                                const autoExp = Math.max(0, Number((remainingAfterCapForSplit - num).toFixed(2)));
                                                setExpenseIntrDebitInput(autoExp.toFixed(2));
                                              } else {
                                                const targetTotalDr = Number((currentInt + activePremRev - clearedCap).toFixed(2));
                                                const autoExp = Math.max(0, Number((targetTotalDr - num).toFixed(2)));
                                                setExpenseIntrDebitInput(autoExp.toFixed(2));
                                              }
                                            }
                                          }}
                                          className="w-28 h-7 text-right font-mono font-semibold text-xs bg-white border border-emerald-200 rounded-sm px-2 text-slate-700 focus:outline-none focus:border-emerald-400"
                                        />
                                      </div>
                                    </div>
                                    <SearchableSelect
                                      options={[{ value: '', label: `डीफॉल्ट: ${ledgersPreview?.defaultInterestPayable || 'POSTING_INTR'}` }, ...ledgerOptions]}
                                      value={postedIntrLedgerId ? String(postedIntrLedgerId) : ''}
                                      onChange={(e) => setPostedIntrLedgerId(e.target.value ? Number(e.target.value) : '')}
                                      placeholder="POSTING_INTR लेजर निवडा..."
                                      searchPlaceholder="लेजर शोधा..."
                                      className="w-full border border-emerald-200/90 px-2.5 py-1.5 rounded-sm flex justify-between items-center bg-white hover:border-emerald-300 text-[11px] font-medium text-slate-700 cursor-pointer transition"
                                    />
                                  </div>

                                  {/* 2) NAFATOTA DEY VYAJ */}
                                  <div className="p-2 rounded-sm bg-amber-50/45 border border-amber-200/80 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <label className="text-[11px] font-semibold text-amber-700">
                                        २) नफा-तोटा देय व्याज / चालू खर्च (Dr)
                                      </label>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] font-mono text-slate-400">₹</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={expenseIntrDebitInput !== '' ? expenseIntrDebitInput : expensePortion.toFixed(2)}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setExpenseIntrDebitInput(v);
                                            if (!isPeriodic) {
                                              const num = Math.max(0, parseFloat(v) || 0);
                                              if (actionType !== 'PrematureClose') {
                                                const autoPost = Math.max(0, Number((remainingAfterCapForSplit - num).toFixed(2)));
                                                setPostedIntrDebitInput(autoPost.toFixed(2));
                                              } else {
                                                const targetTotalDr = Number((currentInt + activePremRev - clearedCap).toFixed(2));
                                                const autoPost = Math.max(0, Number((targetTotalDr - num).toFixed(2)));
                                                setPostedIntrDebitInput(autoPost.toFixed(2));
                                              }
                                            }
                                          }}
                                          className="w-28 h-7 text-right font-mono font-semibold text-xs bg-white border border-amber-200 rounded-sm px-2 text-slate-700 focus:outline-none focus:border-amber-400"
                                        />
                                      </div>
                                    </div>
                                    <SearchableSelect
                                      options={[{ value: '', label: `डीफॉल्ट: ${ledgersPreview?.defaultInterestExpense || 'NAFATOTA DEY VYAJ'}` }, ...ledgerOptions]}
                                      value={expenseIntrLedgerId ? String(expenseIntrLedgerId) : ''}
                                      onChange={(e) => setExpenseIntrLedgerId(e.target.value ? Number(e.target.value) : '')}
                                      placeholder="नफा-तोटा देय व्याज / खर्च लेजर निवडा..."
                                      searchPlaceholder="लेजर शोधा..."
                                      className="w-full border border-amber-200/90 px-2.5 py-1.5 rounded-sm flex justify-between items-center bg-white hover:border-amber-300 text-[11px] font-medium text-slate-700 cursor-pointer transition"
                                    />
                                  </div>
                                </div>

                                {/* Compact Single Balance Strip */}
                                <div className="px-2.5 py-1.5 bg-white/90 border-t border-slate-200/70 text-[10.5px] text-slate-500 flex flex-wrap items-center justify-between gap-1">
                                  <span className="font-mono">
                                    संतुलन: {fmt(payablePortion)} + {fmt(expensePortion)}
                                    {clearedCap > 0 ? ` + कॅपिटलाइझ्ड ${fmt(clearedCap)}` : ''}
                                  </span>
                                  <span className="font-mono font-semibold text-slate-700">
                                    = ₹{fmt(currentInt)}
                                    {split.clawbackAmount > 0 ? ` (+ रिव्हर्सल ₹${fmt(split.clawbackAmount)})` : ''}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Row 3: Premature Posted Interest Reversal (POSTING_INTR Reverse Cr / Clawback) */}
                          {actionType === 'PrematureClose' && (() => {
                            const ledgersPreview = getSchemeLedgers();
                            const isPeriodic = ledgersPreview?.scheme?.interestType === 'MIS' || ledgersPreview?.scheme?.interestType === 'Monthly Interest';
                            const currentIntPrem = customPrematureInterest !== '' ? (parseFloat(customPrematureInterest) || 0) : systemRecalcInt;
                            const premSplit = resolveInterestAccountingSplit(acc, currentIntPrem, true);
                            const ledgerOptions = settlementLedgerOptions;
                            const showRevControls = clawback > 0 || enablePrematureReversal || prematureReversalInput !== '';
                            return (
                              <div className="px-2.5 py-2 rounded-sm bg-rose-50/40 border border-rose-200/80 space-y-2">
                                <div className="flex justify-between items-center gap-2">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-rose-700 select-none">
                                    <input
                                      type="checkbox"
                                      checked={showRevControls}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        if (checked) {
                                          setEnablePrematureReversal(true);
                                          setPrematureReversalInput((clawback > 0 ? clawback : 0).toFixed(2));
                                        } else {
                                          setEnablePrematureReversal(false);
                                          setPrematureReversalInput('');
                                          setReversalCreditLedgerId('');
                                          if (!isPeriodic) {
                                            const remAfterCap = Math.max(0, Number((currentIntPrem - premSplit.clearedCapitalized).toFixed(2)));
                                            const keptPosted = Math.min(remAfterCap, premSplit.payablePortion);
                                            const keptExpense = Math.max(0, Number((remAfterCap - keptPosted).toFixed(2)));
                                            setPostedIntrDebitInput(keptPosted.toFixed(2));
                                            setExpenseIntrDebitInput(keptExpense.toFixed(2));
                                          }
                                        }
                                      }}
                                      className="rounded border-rose-300 text-rose-500 focus:ring-rose-400"
                                    />
                                    <span>POSTING_INTR रिव्हर्सल / जादा व्याज कपात (Cr)</span>
                                  </label>
                                  <span className={`font-mono font-semibold text-xs ${clawback > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                    {clawback > 0 ? `- ₹${fmt(clawback)}` : '₹ 0.00'}
                                  </span>
                                </div>

                                {showRevControls && (
                                  <div className="pt-1.5 border-t border-rose-200/60 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10.5px] font-medium text-rose-700">
                                        रिव्हर्स करावयाची रक्कम (Cr):
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-mono text-rose-400">₹</span>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={enablePrematureReversal && prematureReversalInput !== '' ? prematureReversalInput : clawback.toFixed(2)}
                                          onChange={(e) => {
                                            const v = e.target.value;
                                            setEnablePrematureReversal(true);
                                            setPrematureReversalInput(v);
                                            if (!isPeriodic) {
                                              const revNum = Math.max(0, parseFloat(v) || 0);
                                              const neededTotalDr = Math.max(0, Number((currentIntPrem + revNum - premSplit.clearedCapitalized).toFixed(2)));
                                              const currExp = expenseIntrDebitInput !== ''
                                                ? Math.max(0, parseFloat(expenseIntrDebitInput) || 0)
                                                : premSplit.expensePortion;
                                              const keptExp = Math.min(neededTotalDr, currExp);
                                              const updatedPosted = Math.max(0, Number((neededTotalDr - keptExp).toFixed(2)));
                                              setPostedIntrDebitInput(updatedPosted.toFixed(2));
                                              setExpenseIntrDebitInput(keptExp.toFixed(2));
                                            }
                                          }}
                                          className="w-28 h-7 text-right font-mono font-semibold text-xs bg-white border border-rose-200 rounded-sm px-2 text-rose-700 focus:outline-none focus:border-rose-400"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-medium text-rose-700 mb-1">
                                        रिव्हर्सल जमा लेजर (Cr — परत खर्च / नफा-तोटा / दंड खाते):
                                      </div>
                                      <SearchableSelect
                                        options={[{ value: '', label: `डीफॉल्ट: ${ledgersPreview?.defaultPrematurePenalty || 'व्याज खर्च परत / दंड खाते'}` }, ...ledgerOptions]}
                                        value={reversalCreditLedgerId ? String(reversalCreditLedgerId) : ''}
                                        onChange={(e) => setReversalCreditLedgerId(e.target.value ? Number(e.target.value) : '')}
                                        placeholder="रिव्हर्सल क्रेडिट लेजर निवडा..."
                                        searchPlaceholder="लेजर शोधा..."
                                        className="w-full border border-rose-200/90 px-2.5 py-1.5 rounded-sm flex justify-between items-center bg-white hover:border-rose-300 text-[11px] font-medium text-slate-700 cursor-pointer transition"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Row 4: Editable Overdue Interest (if applicable) */}
                          {(isOverdue || effOverdue > 0) && (
                            <div className="px-2.5 py-2 rounded-sm bg-amber-50/40 border border-amber-200/70 flex items-center justify-between gap-2">
                              <dt className="text-slate-600 font-medium">
                                ओव्हरड्यू व्याज ({overdueDays} दिवस):
                              </dt>
                              <dd className="flex items-center gap-1.5">
                                {customOverdueInterest !== '' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomOverdueInterest('');
                                      if (customAccruedInterest === '' && customPrematureInterest === '') {
                                        setIsManualOverride(false);
                                        setManualOverrideReason('');
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded cursor-pointer transition"
                                    title="सिस्टीम गणनेनुसार पूर्ववत करा"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                                <span className="text-slate-400 font-mono text-xs">+ ₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={customOverdueInterest !== '' ? customOverdueInterest : overdueInterest}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setIsManualOverride(true);
                                    setManualOverrideReason('थेट सेटलमेंट संपादन');
                                    setCustomOverdueInterest(val);
                                  }}
                                  className="w-28 h-7 text-right font-mono font-bold text-xs bg-white border border-amber-200 rounded-sm px-2 text-slate-700 focus:outline-none focus:border-sky-400"
                                  title="ओव्हरड्यू व्याज थेट येथे बदला"
                                />
                              </dd>
                            </div>
                          )}
                        </dl>

                        {/* Inline override indicator if any amount is manually edited */}
                        {isManualOverride && (
                          <div className="flex items-center justify-between text-[11px] text-amber-700 bg-amber-50/70 border border-amber-200/80 px-2.5 py-1.5 rounded-sm mt-2">
                            <span className="flex items-center gap-1.5 font-medium">
                              <Edit3 className="w-3 h-3 text-amber-500" />
                              रक्कम मॅन्युअल संपादित आहे
                            </span>
                            <button
                              type="button"
                              onClick={() => handleResetManualOverride()}
                              className="text-amber-700 underline font-semibold hover:text-amber-800 cursor-pointer text-[10.5px]"
                            >
                              सर्व पूर्ववत करा
                            </button>
                          </div>
                        )}

                        {actionType === 'Renewal' && renewalType === 'PrincipalOnly' && (interestPayable + effOverdue) > 0 && (
                          <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-200/80 px-2.5 py-1.5 rounded-sm mt-2">
                            <span className="font-semibold flex items-center gap-1.5">
                              <span>💵 व्याज परतावा ({paymentModeLabel}):</span>
                            </span>
                            <span className="font-mono font-bold">
                              ₹ {fmt(interestPayable + effOverdue)}
                            </span>
                          </div>
                        )}

                        <div className="mt-2.5 px-3 py-2.5 rounded-sm bg-sky-50/70 border border-sky-200/90 flex items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                              {actionType === 'Renewal'
                                ? (isFullRoll ? 'नवीन मुदत ठेव रक्कम' : 'नवीन ठेव मुद्दल')
                                : 'अंतिम देय रक्कम (Net Payable)'}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {actionType === 'Renewal' ? 'नवीन मुदत ठेव पावतीमध्ये जमा' : `पद्धत: ${paymentModeLabel}`}
                            </div>
                          </div>
                          <div className="text-xl font-mono font-bold text-sky-700 tracking-tight">₹ {fmt(finalAmount)}</div>
                        </div>
                      </fieldset>

                      {/* Group Box 6: Voucher Entries (Clean, without separate override box) */}
                      {voucherPreview && (
                        <fieldset className="border border-slate-200 rounded-md px-3.5 pt-2 pb-3 bg-white shadow-2xs">
                          <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-sky-50/70 border border-slate-200 rounded-sm inline-flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>लेखा व्हाउचर नोंदी (Accounting Voucher)</span>
                          </legend>

                          <div className="mt-1 mb-2 pb-1.5 border-b border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-medium text-slate-500">व्हाउचर प्रिव्ह्यू</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-sm border ${
                                isBalanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {isBalanced ? 'संतुलित' : 'असंतुलित'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowVoucherPreview(!showVoucherPreview)}
                                className="text-[11px] text-sky-700 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                              >
                                {showVoucherPreview ? <>लपवा <ChevronUp className="w-3 h-3" /></> : <>पाहा <ChevronDown className="w-3 h-3" /></>}
                              </button>
                            </div>
                          </div>

                          <div className="mt-1 space-y-2">
                            {showVoucherPreview && (
                              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-sm">
                                <table className="w-full border-collapse text-[11px]">
                                  <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-bold sticky top-0 border-b border-slate-200">
                                    <tr>
                                      <th className="py-1 px-3 text-left w-12">Dr/Cr</th>
                                      <th className="py-1 px-2 text-left">खाते (Ledger)</th>
                                      <th className="py-1 px-3 text-right w-28">रक्कम (₹)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {voucherPreview.map((entry, idx) => {
                                      const prevGroup = idx > 0 ? voucherPreview[idx - 1].voucherGroup : null;
                                      const isNewGroup = entry.voucherGroup && entry.voucherGroup !== prevGroup;
                                      return (
                                        <React.Fragment key={idx}>
                                          {isNewGroup && (
                                            <tr className="bg-slate-100 font-bold text-[10px] text-primary border-y border-slate-200">
                                              <td colSpan={3} className="py-1 px-3">
                                                📑 {entry.voucherGroup}
                                              </td>
                                            </tr>
                                          )}
                                          <tr>
                                            <td className="py-1 px-3 font-bold text-slate-600">{entry.drCr}</td>
                                            <td className="py-1 px-2 font-medium text-slate-800 truncate max-w-[160px]" title={entry.ledgerName}>
                                              {entry.ledgerName}
                                            </td>
                                            <td className="py-1 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                                              {fmt(entry.amount)}
                                            </td>
                                          </tr>
                                        </React.Fragment>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot className="bg-slate-50 border-t border-slate-200 font-mono text-[10px] font-bold text-slate-700">
                                    <tr>
                                      <td colSpan={2} className="py-1 px-3">एकूण Dr: {fmt(totalDr)}</td>
                                      <td className="py-1 px-3 text-right">Cr: {fmt(totalCr)}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                          </div>
                        </fieldset>
                      )}
                    </div>
                  )}
                </div>
              </fieldset>

              {/* ================= STICKY ACTION BAR ================= */}
              {acc && (
                <div className="sticky bottom-0 z-20 mt-3 bg-white border border-slate-200 rounded-sm shadow-[0_-2px_8px_rgba(15,23,42,0.08)] px-3 py-2 space-y-1.5">
                  {error && (
                    <div className="bg-red-50 border border-red-300 border-l-4 border-l-red-600 text-red-900 text-xs px-2.5 py-1.5 rounded-sm font-semibold flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>{error}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setError('')}
                        className="text-red-700 hover:text-red-950 cursor-pointer shrink-0"
                        title="त्रुटी बंद करा"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[11px] min-w-0">
                    {hasLien ? (
                      actionType === 'Renewal' ? (
                        <span className="flex items-center gap-1.5 text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-sm px-2 py-1 font-medium">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {hasDirectLien ? (
                            <>
                              पावतीवर कर्ज तारण ({activeLoansData?.directLienLoanNo || acc.lienLoanAccountNo || 'सक्रिय कर्ज'}) — <b>नूतनीकरण अनुज्ञेय</b> (तारण बोजा नवीन पावतीवर पुढे जाईल).
                            </>
                          ) : (
                            <>
                              सक्रिय कर्ज बाकी: <b>₹{fmt(activeLoansData?.totalOutstandingLiability || 0)}</b> — <b>मुदत ठेव नूतनीकरण</b> (मुद्दल + व्याज / फक्त मुद्दल) करण्यास पूर्ण परवानगी आहे.
                            </>
                          )}
                        </span>
                      ) : !adjustInLoan ? (
                        hasDirectLien ? (
                          <span className="flex items-center gap-1.5 text-red-900 bg-red-50 border border-red-300 rounded-sm px-2 py-1 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            पावतीवर कर्ज तारण ({activeLoansData?.directLienLoanNo || acc.lienLoanAccountNo || 'सक्रिय कर्ज'}) – कर्जात समायोजित केल्याशिवाय ठेव मोडता येणार नाही (नूतनीकरण करा).
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-blue-900 bg-blue-50 border border-blue-200 rounded-sm px-2 py-1 font-medium">
                            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            खातेदाराकडे सक्रिय कर्ज बाकी <b>₹{fmt(activeLoansData?.totalOutstandingLiability || 0)}</b> आहे (ही पावती तारण नाही — थेट परतावा अनुज्ञेय).
                          </span>
                        )
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-900 bg-amber-50 border border-amber-200 rounded-sm px-2 py-1 font-medium">
                          <CheckCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          सक्रिय कर्ज बाकी: <b>₹{fmt(activeLoansData?.totalOutstandingLiability || 0)}</b> – परतावा प्रथम सक्रिय कर्ज खात्यात जमा केला जाईल.
                        </span>
                      )
                    ) : hasDateError ? (
                      <span className="flex items-center gap-1.5 text-red-700 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        व्यवहार तारीख तपासा.
                      </span>
                    ) : isManualOverride ? (
                      <span className="flex items-center gap-1.5 text-amber-800 font-medium">
                        <Edit3 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        रक्कम मॅन्युअल संपादित आहे.
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        {acc.accountNo} • {acc.customerName || acc.memberName} • <b className="text-slate-800">₹ {fmt(finalAmount)}</b>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowInlineSchedule(!showInlineSchedule)}
                      className="h-8 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      {showInlineSchedule ? 'वेळापत्रक लपवा' : 'व्याज वेळापत्रक'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="h-8 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      प्रिंट वेळापत्रक
                    </button>

                    {isPassingMode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectModalOpen(true)}
                          disabled={passingActionLoading}
                          className="h-8 px-4 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          नामंजूर करा (Reject)
                        </button>
                        <button
                          type="button"
                          onClick={handlePassVoucher}
                          disabled={passingActionLoading}
                          className="h-8 px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {passingActionLoading ? 'मंजूर होत आहे...' : 'मंजूर व पास करा (Pass)'}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccId(0);
                            setSelectedAccount(null);
                            handleResetManualOverride();
                          }}
                          className="h-8 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          पूर्ववत (Reset)
                        </button>
                        <button
                          type="submit"
                          disabled={submitDisabled}
                          className={`h-8 px-5 text-xs font-bold rounded-sm flex items-center gap-1.5 transition-colors ${
                            submitDisabled
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : actionType === 'PrematureClose'
                              ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                              : actionType === 'Renewal'
                              ? 'bg-primary hover:opacity-90 text-white cursor-pointer'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                          }`}
                        >
                          {loading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              प्रक्रिया सुरू आहे...
                            </>
                          ) : actionType === 'PrematureClose' ? (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              मुदतपूर्व परतावा जतन करा
                            </>
                          ) : actionType === 'Renewal' ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              नूतनीकरण जतन करा
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              मुदतपूर्ती पेमेंट जतन करा
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </form>


      {/* FD Interest Accrual & Amortization Chart Modal */}
      {isScheduleModalOpen && scheduleSummary && selectedAccount && (
        <FdInterestScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          summary={scheduleSummary}
          customerName={selectedAccount.customerName || selectedAccount.memberName || 'ठेवीदार'}
          memberCode={selectedAccount.memberCode || ''}
          cifNo={selectedAccount.cifNo || (selectedAccount.customerID ? `CIF-${selectedAccount.customerID}` : '')}
          schemeName={selectedAccount.schemeName || 'मुदत ठेव योजना'}
          isSeniorCitizen={selectedAccount.isSeniorCitizen}
          overdueDetails={overdueModalDetails}
        />
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 border-b border-rose-100 pb-2">
              <span className="text-xl">❌</span>
              <h3 className="font-bold text-sm">मुदत ठेव क्लोजर व्हाउचर नामंजूर / रद्द करा</h3>
            </div>

            <p className="text-xs text-gray-600">
              व्हाउचर क्र. <strong className="text-gray-900 font-mono">{passingVoucherData?.voucherNo || voucherId}</strong> नामंजूर करण्याचे कारण खालीलप्रमाणे नोंदवा:
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="नामंजूर / रद्द करण्याचे कारण प्रविष्ट करा..."
              rows={3}
              className="w-full text-xs border border-gray-300 rounded p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500 font-sans"
              required
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                disabled={passingActionLoading}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                मागे फिरा
              </button>
              <button
                type="button"
                onClick={handleRejectVoucher}
                disabled={passingActionLoading || !rejectReason.trim()}
                className="px-4 py-1.5 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer disabled:opacity-50"
              >
                {passingActionLoading ? 'रद्द होत आहे...' : 'होय, व्हाउचर रद्द करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Multi-FD Account Selector Modal (CIF-First) */}
      {showMultiFdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full overflow-hidden border border-blue-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/10 rounded-sm">
                  <BookOpen className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="font-bold text-sm flex items-center gap-2">
                    <span>मुदत ठेव पावती निवडा (Select FD Receipt)</span>
                    <span className="text-[10px] bg-amber-400 text-blue-950 font-black px-2 py-0.5 rounded-full">
                      एकूण {customerMatchingFds.length} मुदत ठेवी
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5">
                    खातेदार: <strong className="text-white">{multiFdCustomerInfo?.name || 'खातेदार'}</strong>
                    {multiFdCustomerInfo?.cifNo && multiFdCustomerInfo.cifNo !== '-' && (
                      <span className="ml-2 font-mono text-amber-200">
                        [CIF: {multiFdCustomerInfo.cifNo}]
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMultiFdModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded cursor-pointer transition-colors"
                title="बंद करा"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: List of FD Accounts */}
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2.5 bg-slate-50">
              <div className="text-xs text-slate-700 font-semibold mb-2 flex items-center justify-between">
                <span>कृपया मुदतपूर्ती / मुदतपूर्व बंद / नूतनीकरणासाठी योग्य मुदत ठेव (FD) निवडा:</span>
                <span className="text-[11px] text-slate-500">क्लिक करून निवडा</span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {customerMatchingFds.map((acc: FdAccount) => {
                  const isCurrent = selectedAccId === acc.fdAccountID;
                  return (
                    <div
                      key={acc.fdAccountID}
                      onClick={() => {
                        if (selectedAccId !== acc.fdAccountID) {
                          handleResetManualOverride();
                        }
                        setSelectedAccId(acc.fdAccountID);
                        setSelectedAccount(acc);
                        fetchCustomerSavingsAccounts(acc.customerID, acc.memberID);
                        fetchActiveLoans(acc.fdAccountID);
                        setShowMultiFdModal(false);
                      }}
                      className={`p-3 rounded border text-left cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400 shadow-sm'
                          : 'bg-white hover:bg-blue-50/40 border-slate-200 hover:border-blue-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-sm mt-0.5 ${isCurrent ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-slate-900 tracking-wide">
                              {acc.receiptNo || acc.accountNo}
                            </span>
                            {acc.receiptNo && acc.receiptNo !== acc.accountNo && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                                CBS: {acc.accountNo}
                              </span>
                            )}
                            {(acc.renewalCycleNo || 0) > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                नूतनीकरण #{acc.renewalCycleNo}
                              </span>
                            )}
                            {acc.legacyAccountNumber && acc.legacyAccountNumber.trim() && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                                जुना: {acc.legacyAccountNumber.trim()}
                              </span>
                            )}
                            {(() => {
                              const st = getFdEffectiveStatus(acc, closureDate || activeBusinessDate);
                              const cls = st.key === 'Matured'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : st.key === 'Active'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200';
                              return (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
                                  {st.label}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="text-[11px] text-slate-600 font-semibold mt-1">
                            योजना: <span className="text-slate-800 font-bold">{acc.schemeName}</span>
                            <span className="text-slate-500 ml-2 font-medium">({acc.interestRate}% व्याजदर)</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-2">
                            <span>सुरू: {acc.openingDate ? new Date(acc.openingDate).toLocaleDateString('en-GB') : '-'}</span>
                            <span>•</span>
                            <span className="text-amber-800 font-semibold">मुदतपूर्ती: {acc.maturityDate ? new Date(acc.maturityDate).toLocaleDateString('en-GB') : '-'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:text-right w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        <div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ठेव रक्कम</div>
                          <div className="text-sm font-black text-primary font-mono">
                            ₹ {(acc.depositAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-bold">
                            मुदतपूर्ती: ₹ {(acc.maturityAmount || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedAccId !== acc.fdAccountID) {
                              handleResetManualOverride();
                            }
                            setSelectedAccId(acc.fdAccountID);
                            setSelectedAccount(acc);
                            fetchCustomerSavingsAccounts(acc.customerID, acc.memberID);
                            fetchActiveLoans(acc.fdAccountID);
                            setShowMultiFdModal(false);
                          }}
                          className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isCurrent
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-300'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{isCurrent ? 'निवडलेले आहे' : 'ही ठेव निवडा'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">
                मुदत ठेव निवडल्यावर त्याचे व्याज व मुदतपूर्ती तपशील आपोआप लोड होतील.
              </span>
              <button
                type="button"
                onClick={() => setShowMultiFdModal(false)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer transition-colors"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔄 Reopen Closed FD Account Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl max-w-xl w-full border border-slate-300 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-3 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    बंद झालेले मुदत ठेव खाते पूर्ववत करा (Reopen Closed FD Account)
                  </h3>
                  <p className="text-[11px] text-amber-100">
                    क्लोजर व्हाउचर डिलीट झाल्यावर खाते पुन्हा सक्रिय (Active / Matured) करण्यासाठी
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="text-white/80 hover:text-white hover:bg-amber-800/50 p-1 rounded-sm transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  खाते शोधा (पावती क्र. किंवा जुना खाते क्र.)
                </label>
                <input
                  type="text"
                  value={reopenSearchTerm}
                  onChange={(e) => setReopenSearchTerm(e.target.value)}
                  placeholder="उदा. 1455 किंवा खाते क्र. किंवा खातेदाराचे नाव..."
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-amber-600 bg-white"
                  autoFocus
                />
              </div>

              {/* Matching Closed Accounts List */}
              <div className="space-y-2 mt-2">
                {allClosedAccounts
                  .filter((a) => {
                    if (!reopenSearchTerm.trim()) return false;
                    const term = reopenSearchTerm.trim().toLowerCase();
                    const accNo = (a.accountNo || '').toLowerCase();
                    const legNo = (a.legacyAccountNumber || '').toLowerCase();
                    const cName = (a.customerName || a.memberName || '').toLowerCase();
                    const cif = (a.cifNo || '').toLowerCase();
                    return accNo.includes(term) || legNo.includes(term) || cName.includes(term) || cif.includes(term);
                  })
                  .slice(0, 10)
                  .map((acc) => {
                    const isMatured = acc.maturityDate ? new Date(acc.maturityDate) <= new Date() : false;
                    return (
                      <div
                        key={acc.fdAccountID}
                        className="p-3 bg-amber-50/60 border border-amber-200 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-amber-100/60 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{acc.accountNo}</span>
                            {acc.legacyAccountNumber && (
                              <span className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded text-[10px] border border-purple-200">
                                जुना क्र: {acc.legacyAccountNumber}
                              </span>
                            )}
                            <span className="bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded text-[10px] border border-red-200">
                              {acc.status}
                            </span>
                          </div>
                          <div className="text-slate-700 font-semibold mt-0.5">
                            {acc.customerName || acc.memberName || 'खातेदार'}
                            {acc.cifNo && <span className="text-slate-500 font-normal ml-2">CIF: {acc.cifNo}</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            ठेव: ₹{(acc.depositAmount || 0).toLocaleString()} • मुदतपूर्ती: {acc.maturityDate ? new Date(acc.maturityDate).toLocaleDateString('en-GB') : '-'} ({isMatured ? 'मुदतपूर्ण' : 'सक्रिय'}) • {acc.schemeName}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={reopenLoading}
                          onClick={() => handleReopenAccount(acc)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs shrink-0 flex items-center gap-1 cursor-pointer transition shadow-2xs disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{reopenLoading ? 'पूर्ववत होत आहे...' : 'खाते पूर्ववत करा'}</span>
                        </button>
                      </div>
                    );
                  })}

                {reopenSearchTerm.trim() && allClosedAccounts.filter((a) => {
                  const term = reopenSearchTerm.trim().toLowerCase();
                  return (a.accountNo || '').toLowerCase().includes(term) ||
                         (a.legacyAccountNumber || '').toLowerCase().includes(term) ||
                         (a.customerName || a.memberName || '').toLowerCase().includes(term) ||
                         (a.cifNo || '').toLowerCase().includes(term);
                }).length === 0 && (
                  <div className="p-4 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded">
                    '{reopenSearchTerm}' शी जुळणारे कोणतेही बंद (Closed) मुदत ठेव खाते आढळले नाही.
                  </div>
                )}

                {!reopenSearchTerm.trim() && (
                  <div className="p-3 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded text-[11px]">
                    कृपया वर शोध पेटीत जुना खाते क्रमांक (उदा. 1455) किंवा पावती क्रमांक टाईप करा.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-[11px] text-slate-500">
                खाते पूर्ववत केल्यावर ते आपोआप क्लोजर व नूतनीकरण फॉर्मवर निवडले जाईल.
              </span>
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer transition"
              >
                रद्द करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct FD Receipt Print Modal */}
      {showReceiptPrintModal && printAccountData && (
        <FdReceiptPrintModal
          account={printAccountData}
          initialSide={printInitialSide}
          onClose={() => setShowReceiptPrintModal(false)}
        />
      )}
    </div>
  );
};

export default FdWithdrawalMaturity;

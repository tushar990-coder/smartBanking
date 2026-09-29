import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  Lock
} from 'lucide-react';
import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import SearchableSelect from './SearchableSelect';
import { FdInterestScheduleModal, FdScheduleOverdueInfo } from './FdInterestScheduleModal';
import { generateFdInterestSchedule, FdScheduleSummary } from '../utils/fdInterestSchedule';

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
  totalOutstandingLiability: number;
  loans: ActiveLoanItem[];
}

interface FdAccount {
  fdAccountID: number;
  branchID: number;
  accountNo: string;
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
}

const FdWithdrawalMaturity: React.FC = () => {
  const [accounts, setAccounts] = useState<FdAccount[]>([]);
  const [schemes, setSchemes] = useState<FdScheme[]>([]);
  const [bankLedgers, setBankLedgers] = useState<Ledger[]>([]);
  const [selectedAccId, setSelectedAccId] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<FdAccount | null>(null);

  const [actionType, setActionType] = useState<string>('MaturityClose'); // MaturityClose, PrematureClose, Renewal
  const [closureDate, setClosureDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [renewalType, setRenewalType] = useState<string>('PrincipalPlusInterest'); // PrincipalOnly, PrincipalPlusInterest
  const [targetSchemeId, setTargetSchemeId] = useState<number>(0);

  // Overdue interest & Renewal Effective controls
  const [applyOverdueInterest, setApplyOverdueInterest] = useState<boolean>(true);
  const [overdueInterestRate, setOverdueInterestRate] = useState<number>(3.00); // Standard SB / Overdue Rate 3%
  const [renewalEffectiveFrom, setRenewalEffectiveFrom] = useState<'ClosureDate' | 'MaturityDate'>('ClosureDate');

  // Payment Mode states
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'Transfer'>('Cash');
  const [bankAccountLedgerID, setBankAccountLedgerID] = useState<number>(0);
  const [chequeNo, setChequeNo] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [memberSavingAccounts, setMemberSavingAccounts] = useState<SavingAccount[]>([]);
  const [selectedSavingAccountId, setSelectedSavingAccountId] = useState<number | ''>('');
  const [narration, setNarration] = useState<string>('');

  // Active Loans Info state (Informational only)
  const [activeLoansData, setActiveLoansData] = useState<ActiveLoansResponse | null>(null);
  const [loadingLoans, setLoadingLoans] = useState<boolean>(false);

  // UI toggle states
  const [showVoucherPreview, setShowVoucherPreview] = useState<boolean>(true);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [showInlineSchedule, setShowInlineSchedule] = useState<boolean>(false);

  // ✍️ Manual Amount Override states (Legacy Reconciliation)
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);
  const [manualOverrideReason, setManualOverrideReason] = useState<string>('');
  const [customAccruedInterest, setCustomAccruedInterest] = useState<string>('');
  const [customOverdueInterest, setCustomOverdueInterest] = useState<string>('');
  const [customPrematureInterest, setCustomPrematureInterest] = useState<string>('');

  const handleResetManualOverride = () => {
    setIsManualOverride(false);
    setManualOverrideReason('');
    setCustomAccruedInterest('');
    setCustomOverdueInterest('');
    setCustomPrematureInterest('');
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = '/api';

  useEffect(() => {
    fetchAccounts();
    fetchSchemes();
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
      const finalBankList = bLedgers.length > 0 ? bLedgers : allLedgers;
      setBankLedgers(finalBankList);
      if (finalBankList.length > 0) {
        setBankAccountLedgerID(finalBankList[0].ledgerID);
        setSurplusBankLedgerID(finalBankList[0].ledgerID);
      }
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
    } catch (err) {
      console.error('Error fetching active loans', err);
      setActiveLoansData(null);
    } finally {
      setLoadingLoans(false);
    }
  };

  // 🔄 Re-fetch active loans with recalculated accrued interest whenever closureDate or selectedAccount changes
  useEffect(() => {
    if (selectedAccId && selectedAccId > 0 && closureDate) {
      fetchActiveLoans(selectedAccId, closureDate);
    }
  }, [selectedAccId, closureDate]);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdAccounts`);
      const activeList = response.data.filter((a: any) => a.status !== 'Closed');
      setAccounts(activeList);

      const params = new URLSearchParams(window.location.search);
      const entityIdStr = params.get('entityId');
      const fdAccountIdStr = params.get('fdAccountId') || params.get('id');
      const customerIdStr = params.get('customerId') || params.get('cif');
      const memberIdStr = params.get('memberId');

      let matched: FdAccount | undefined = undefined;
      if (fdAccountIdStr) {
        const accId = parseInt(fdAccountIdStr);
        matched = activeList.find((a: any) => a.fdAccountID === accId);
      } else if (customerIdStr) {
        const cId = parseInt(customerIdStr);
        matched = activeList.find((a: any) => a.customerID === cId || a.cifNo === customerIdStr);
      } else if (entityIdStr) {
        const eId = parseInt(entityIdStr);
        matched = activeList.find((a: any) => a.fdAccountID === eId || a.customerID === eId || a.cifNo === entityIdStr || a.memberID === eId);
      } else if (memberIdStr) {
        const mId = parseInt(memberIdStr);
        matched = activeList.find((a: any) => a.customerID === mId || a.memberID === mId);
      }

      if (matched) {
        setSelectedAccId(matched.fdAccountID);
        setSelectedAccount(matched);
        fetchCustomerSavingsAccounts(matched.customerID, matched.memberID);
        fetchActiveLoans(matched.fdAccountID);
      }
    } catch (err) {
      console.error('Error fetching accounts', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdSchemes`);
      const list: FdScheme[] = response.data || [];
      setSchemes(list);
      if (list.length > 0) {
        setTargetSchemeId(list[0].fdSchemeID);
      }
    } catch (err) {
      console.error('Error fetching schemes', err);
    }
  };

  const handleAccountSelect = (val: any) => {
    const accId = typeof val === 'object' && val?.target ? parseInt(val.target.value) : parseInt(String(val || 0));
    setSelectedAccId(accId);
    const selected = accounts.find((a) => a.fdAccountID === accId) || null;
    setSelectedAccount(selected);
    setError('');
    setSuccess('');
    handleResetManualOverride();
    if (selected) {
      fetchCustomerSavingsAccounts(selected.customerID, selected.memberID);
      fetchActiveLoans(selected.fdAccountID);
    } else {
      setMemberSavingAccounts([]);
      setSelectedSavingAccountId('');
      fetchActiveLoans(0);
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
    const closureDt = new Date(closureDate || new Date().toISOString().split('T')[0]);
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
    const closureDt = new Date(closureDate || new Date().toISOString().split('T')[0]);
    closureDt.setHours(0, 0, 0, 0);

    const matDt = new Date(selectedAccount.maturityDate);
    matDt.setHours(0, 0, 0, 0);

    const accountIsMatured = closureDt.getTime() >= matDt.getTime();

    if (!accountIsMatured) {
      if (actionType !== 'PrematureClose') {
        setActionType('PrematureClose');
      }
    } else {
      if (actionType === 'PrematureClose') {
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

  const todayStr = new Date().toISOString().split('T')[0];
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
    ((actionType === 'MaturityClose' || actionType === 'PrematureClose') && paymentMode === 'Transfer' && closureDate < todayStr) ||
    (actionType === 'Renewal' && renewalType === 'PrincipalOnly' && paymentMode === 'Transfer' && Boolean(selectedSavingAccountId) && closureDate < todayStr)
  );

  // Overdue calculation helper
  const getOverdueDetails = () => {
    if (!selectedAccount) return { isOverdue: false, overdueDays: 0, overdueInterest: 0, baseAmount: 0, isAllowedByScheme: false, effectiveOverdueRate: 0 };
    const closureDt = new Date(closureDate || new Date().toISOString().split('T')[0]);
    closureDt.setHours(0, 0, 0, 0);

    const matDt = new Date(selectedAccount.maturityDate);
    matDt.setHours(0, 0, 0, 0);

    const diffTime = closureDt.getTime() - matDt.getTime();
    const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const isOverdue = overdueDays > 0;

    const baseAmount = selectedAccount.maturityAmount && selectedAccount.maturityAmount > selectedAccount.depositAmount
      ? selectedAccount.maturityAmount
      : (selectedAccount.depositAmount + (selectedAccount.legacyAccruedInt || 0));

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

  // Helper to resolve mapped ledgers for selected account scheme
  const getSchemeLedgers = () => {
    if (!selectedAccount) return null;
    const scheme = schemes.find(s => s.fdSchemeID === selectedAccount.fdSchemeID || s.schemeName === selectedAccount.schemeName);

    const fdLiability = selectedAccount.fdLiabilityLedgerName 
      || scheme?.fdLiabilityLedger?.ledgerName 
      || scheme?.fdLiabilityLedgerName 
      || '१२ मुदत ठेव देयता खाते (Fixed Deposit Liability)';

    const interestPayable = selectedAccount.interestPayableLedgerName 
      || scheme?.interestPayableLedger?.ledgerName 
      || scheme?.interestPayableLedgerName 
      || '२३ देणे मुदत ठेव व्याज (Interest Payable)';

    const interestExpense = selectedAccount.interestExpenseLedgerName 
      || scheme?.interestExpenseLedger?.ledgerName 
      || scheme?.interestExpenseLedgerName 
      || '१३२ मुदत ठेवीवरील व्याज (Interest Expense)';

    const prematurePenalty = selectedAccount.prematurePenaltyLedgerName 
      || scheme?.prematurePenaltyLedger?.ledgerName 
      || scheme?.prematurePenaltyLedgerName 
      || '१३२ मुदत पूर्व कपात दंड उत्पन्न खाते (Premature Clawback)';

    let payoutLedgerName = '५१ हातातील रोख शिल्लक (Cash Account)';
    if (paymentMode === 'Bank') {
      const b = bankLedgers.find(l => l.ledgerID === bankAccountLedgerID);
      payoutLedgerName = b ? `${b.ledgerID} - ${b.ledgerName} (Bank A/c)` : 'बँक खाते लेजर (Bank GL)';
    } else if (paymentMode === 'Transfer') {
      const sAcc = memberSavingAccounts.find(s => s.savingAccountID === selectedSavingAccountId);
      payoutLedgerName = sAcc ? `७ - बचत ठेव खाते (${sAcc.accountNo})` : '७ - खातेदार बचत ठेव देयता खाते (SB Liability)';
    }

    return { fdLiability, interestPayable, interestExpense, prematurePenalty, cashLedger: payoutLedgerName, scheme };
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
      const prematureRate = ledgers?.scheme?.prematureInterestRate ?? Math.max(0, selectedAccount.interestRate - 1.0);
      const systemRecalcInt = Math.round((principal * prematureRate * actualDays) / 36500);

      const effRecalcInt = isManualOverride && customPrematureInterest !== ''
        ? Math.max(0, parseFloat(customPrematureInterest) || 0)
        : systemRecalcInt;

      const alreadyAccrued = selectedAccount.legacyAccruedInt || 0;
      const isPeriodic = ledgers?.scheme?.interestType === 'MIS' || ledgers?.scheme?.interestType === 'Monthly Interest';
      if (isPeriodic && alreadyAccrued > effRecalcInt) {
        return Math.max(0, principal - (alreadyAccrued - effRecalcInt));
      }
      return principal + effRecalcInt;
    }
    return 0;
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

    // Standard Payment Mode Validations
    if ((actionType === 'MaturityClose' || actionType === 'PrematureClose' || (actionType === 'Renewal' && renewalType === 'PrincipalOnly')) && paymentMode === 'Bank') {
      if (!bankAccountLedgerID || bankAccountLedgerID <= 0) {
        setError('कृपया बँक खाते लेजर निवडा.');
        return;
      }
    }

    if ((actionType === 'MaturityClose' || actionType === 'PrematureClose' || (actionType === 'Renewal' && renewalType === 'PrincipalOnly')) && paymentMode === 'Transfer') {
      if (!selectedSavingAccountId || selectedSavingAccountId <= 0) {
        setError('⚠️ रक्कम वर्ग करण्यासाठी खातेदाराचे कोणतेही सक्रिय बचत खाते निवडलेले नाही.');
        return;
      }

      if (isBackdatedSavingsTransfer) {
        setError(`⚠️ बचत खात्यातील पासबुक विसंगती प्रतिबंध! बचत खात्यात (Saving Account Transfer) परतावा वर्ग करताना मागील तारीख (${closureDate.split('-').reverse().join('/')}) अनुज्ञेय नाही. पासबुकमधील रनिंग शिल्लक व एसएमएस ताळमेळ अचूक राहण्यासाठी हस्तांतरण आजच्याच तारखेने (${todayStr.split('-').reverse().join('/')}) होणे आवश्यक आहे.`);
        return;
      }
    }

    setLoading(true);
    try {
      const basePayload: any = {
        closureDate: closureDate,
        paymentMode: paymentMode,
        bankAccountLedgerID: paymentMode === 'Bank' ? bankAccountLedgerID : null,
        chequeNo: paymentMode === 'Bank' ? chequeNo : null,
        chequeDate: paymentMode === 'Bank' ? chequeDate : null,
        savingAccountID: paymentMode === 'Transfer' ? selectedSavingAccountId : null,
        narration: narration || null,
        // ✍️ Manual Amount Override (Legacy Reconciliation)
        isManualAmountOverride: isManualOverride,
        customAccruedInterest: isManualOverride 
          ? (actionType === 'PrematureClose' 
              ? (customPrematureInterest !== '' ? parseFloat(customPrematureInterest) : null) 
              : (customAccruedInterest !== '' ? parseFloat(customAccruedInterest) : null)) 
          : null,
        customOverdueInterest: isManualOverride && customOverdueInterest !== '' ? parseFloat(customOverdueInterest) : null,
        manualOverrideReason: isManualOverride ? manualOverrideReason.trim() : null
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
        } else if (resData?.message) {
          setSuccess(`✅ ${resData.message}`);
        } else {
          setSuccess(`✅ मुदत पूर्व बंद यशस्वी (${paymentMode})! दिवसांची संख्या: ${resData.actualDays}, मूळ मुद्दल: ₹${selectedAccount.depositAmount.toLocaleString()}, पुनर्गणना केलेले व्याज: ₹${resData.recalcInt}, दंडात्मक कपात: ₹${resData.clawback}, अंतिम पेआउट: ₹${resData.netPayout}`);
        }
      } else if (actionType === 'Renewal') {
        if (targetSchemeId === 0) {
          setError('कृपया नूतनीकरणासाठी नवीन ठेव योजना निवडा.');
          setLoading(false);
          return;
        }

        const targetScheme = schemes.find(s => s.fdSchemeID === targetSchemeId);
        const payload = {
          targetSchemeID: targetSchemeId,
          renewalType: renewalType,
          closureDate: closureDate,
          durationType: targetScheme?.durationType || 'Months',
          durationValue: targetScheme?.durationMonths || 12,
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
          isManualAmountOverride: isManualOverride,
          customAccruedInterest: isManualOverride && customAccruedInterest !== '' ? parseFloat(customAccruedInterest) : null,
          customOverdueInterest: isManualOverride && customOverdueInterest !== '' ? parseFloat(customOverdueInterest) : null,
          manualOverrideReason: isManualOverride ? manualOverrideReason.trim() : null
        };

        const response = await axios.post(
          `${API_URL}/FdAccounts/${selectedAccount.fdAccountID}/Renew`,
          payload
        );
        const resData = response.data;
        setSuccess(`✅ ${resData.message} (नवीन पावती क्र: ${resData.newAccountNo})${resData.overdueInterest > 0 ? ` [समाविष्ट Overdue व्याज: ₹${resData.overdueInterest.toLocaleString()}]` : ''}`);
      }

      // Refresh list & Reset
      handleResetManualOverride();
      setSelectedAccount(null);
      setSelectedAccId(0);
      setNarration('');
      setActiveLoansData(null);
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'व्यवहार पूर्ण करताना त्रुटी आली.');
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

      const totalPayout = principal + accruedInt + effOverdueInt;

      entries.push({
        drCr: 'Dr',
        ledgerName: ledgers.fdLiability,
        note: 'मुदत ठेव मुद्दल खाते कमी करणे (Principal Liability Cleared)',
        amount: principal,
        isLockedPrincipal: true
      });

      if (accruedInt > 0 || isManualOverride) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestPayable,
          note: 'करारानुसार साचलेले देय व्याज चुकता करणे (Contracted Matured Interest Payable)' + (isManualOverride && customAccruedInterest !== '' ? ' [✍️ मॅन्युअल संपादन]' : ''),
          amount: accruedInt,
          isEditable: isManualOverride,
          editKey: 'accrued'
        });
      }

      if (effOverdueInt > 0 || (isManualOverride && isOverdue)) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestExpense,
          note: `मुदत संपल्यापासूनच्या (${overdueDays} दिवस) कालावधीचे ओव्हरड्यू व्याज खर्च (Overdue Interest Expense @ ${effectiveOverdueRate}%)` + (isManualOverride && customOverdueInterest !== '' ? ' [✍️ मॅन्युअल संपादन]' : ''),
          amount: effOverdueInt,
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
      const prematureRate = ledgers.scheme?.prematureInterestRate ?? Math.max(0, selectedAccount.interestRate - 1.0);
      const systemRecalcInt = Math.round((principal * prematureRate * actualDays) / 36500);

      const recalculatedInterest = isManualOverride && customPrematureInterest !== ''
        ? Math.max(0, parseFloat(customPrematureInterest) || 0)
        : systemRecalcInt;

      const alreadyAccruedInt = selectedAccount.legacyAccruedInt || 0;
      const isPeriodicPayout = ledgers.scheme?.interestType === 'MIS' || ledgers.scheme?.interestType === 'Monthly Interest';
      
      let clawback = 0;
      let netPayout = principal + recalculatedInterest;

      if (isPeriodicPayout) {
        if (alreadyAccruedInt > recalculatedInterest) {
          clawback = alreadyAccruedInt - recalculatedInterest;
          netPayout = Math.max(0, principal - clawback);
        }
      } else {
        netPayout = principal + recalculatedInterest;
        if (alreadyAccruedInt > recalculatedInterest) {
          clawback = alreadyAccruedInt - recalculatedInterest;
        }
      }

      entries.push({
        drCr: 'Dr',
        ledgerName: ledgers.fdLiability,
        note: 'मुदत ठेव मुद्दल खाते निरंक करणे (Principal Liability Cleared)',
        amount: principal,
        isLockedPrincipal: true
      });

      if (!isPeriodicPayout && alreadyAccruedInt > 0) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestPayable,
          note: 'आधी तरतूद केलेले देय व्याज निरंक करणे (Accrued Interest Payable Debited)',
          amount: alreadyAccruedInt
        });
      }

      if (recalculatedInterest > alreadyAccruedInt) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestExpense,
          note: 'चालू कालावधीचे पुनर्गणना केलेले मुदत ठेव व्याज खर्च (Interest Expense)' + (isManualOverride && customPrematureInterest !== '' ? ' [✍️ मॅन्युअल संपादन]' : ''),
          amount: recalculatedInterest - alreadyAccruedInt,
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
          note: isPeriodicPayout 
            ? 'मासिक मिळालेल्या जास्तीच्या व्याजाची मुद्दलातून कपात (Clawback Deduction)'
            : 'जास्तीच्या व्याज तरतुदीची नफा-तोट्यात जमा (Excess Provision Reversal to P&L)',
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

      const totalVal = principal + accruedInt + effOverdueInt;

      const newDepositAmount = renewalType === 'PrincipalPlusInterest' ? totalVal : principal;
      const interestPayout = renewalType === 'PrincipalOnly' ? (accruedInt + effOverdueInt) : 0;

      entries.push({
        drCr: 'Dr',
        ledgerName: ledgers.fdLiability,
        note: 'जुने मुदत ठेव खाते बंद करणे (Old FD Liability Cleared)',
        amount: principal,
        isLockedPrincipal: true
      });

      if (accruedInt > 0 || isManualOverride) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestPayable,
          note: (renewalType === 'PrincipalPlusInterest'
            ? 'करारानुसार साचलेले देय व्याज मुद्दलात पुनर्गठित करणे (Contracted Interest Capitalized to New FD)'
            : 'करारानुसार साचलेले देय व्याज चुकता करणे (Contracted Matured Interest Payable)') + (isManualOverride && customAccruedInterest !== '' ? ' [✍️ मॅन्युअल संपादन]' : ''),
          amount: accruedInt,
          isEditable: isManualOverride,
          editKey: 'accrued'
        });
      }

      if (effOverdueInt > 0 || (isManualOverride && isOverdue)) {
        entries.push({
          drCr: 'Dr',
          ledgerName: ledgers.interestExpense,
          note: `मुदत संपल्यापासूनच्या (${overdueDays} दिवस) कालावधीचे ओव्हरड्यू व्याज (Overdue Interest Expense @ ${effectiveOverdueRate}%)` + (isManualOverride && customOverdueInterest !== '' ? ' [✍️ मॅन्युअल संपादन]' : ''),
          amount: effOverdueInt,
          isEditable: isManualOverride,
          editKey: 'overdue'
        });
      }

      entries.push({
        drCr: 'Cr',
        ledgerName: targetLiabilityLedger,
        note: `नवीन मुदत ठेव खात्यात मुद्दल जमा (${targetScheme?.schemeName || 'New FD Account'})` + (isRetroactive ? ` [सुरुवात दिनांक: ${selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')}]` : ''),
        amount: newDepositAmount,
        isBalancing: renewalType === 'PrincipalPlusInterest'
      });

      if (renewalType === 'PrincipalOnly' && (interestPayout > 0 || isManualOverride)) {
        entries.push({
          drCr: 'Cr',
          ledgerName: ledgers.cashLedger,
          note: (paymentMode === 'Cash' 
            ? 'केवळ व्याजाची रक्कम रोखीने अदा करणे (Interest Cash Payout)' 
            : (paymentMode === 'Bank' ? 'व्याज बँक ट्रान्सफरने अदा करणे (Interest Bank Payout)' : 'व्याज बचत खात्यात वर्ग करणे (Interest SB Credit)')) + (isManualOverride ? ' [⚡ स्वयंचलित संतुलित]' : ''),
          amount: interestPayout,
          isBalancing: true
        });
      }
    }

    return entries;
  };

  const labelClass = 'block text-xs font-bold text-gray-700 mb-1';
  const inputClass = 'w-full text-xs border border-gray-300 rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-primary bg-white';

  const voucherPreview = getVoucherEntriesPreview();

  // Format account options for SearchableSelect
  const accountOptions = [
    { value: '0', label: '--- मुदत ठेव खाते निवडा (Select FD Account) ---' },
    ...accounts.map(a => {
      const cifDisplay = a.cifNo || (a.customerID ? `CIF-${a.customerID}` : '-');
      const custName = a.customerName || a.memberName || 'खातेदार';
      return {
        value: a.fdAccountID.toString(),
        label: `${a.accountNo} - ${custName} (CIF: ${cifDisplay}) | ठेव: ₹${a.depositAmount.toLocaleString()} | मुदतपूर्ती: ${a.maturityDate ? a.maturityDate.split('T')[0].split('-').reverse().join('/') : ''} [${a.schemeName}]`
      };
    })
  ];

  return (
    <div className="p-3 max-w-6xl mx-auto space-y-4 font-sans text-xs">
      {/* Top ERP Header Banner */}
      <div className="bg-primary px-3.5 py-2.5 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-blue-200" />
          <div>
            <h1 className="text-sm font-bold tracking-wide">मुदत ठेव क्लोजर आणि नूतनीकरण (FD Closures & Renewals)</h1>
            <p className="text-[10px] text-blue-100 font-normal">
              मुदत संपलेल्या किंवा मुदतपूर्व ठेवींचा परतावा (Payout) अथवा नवीन मुदत ठेव नूतनीकरण (FD Renewal)
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 bg-blue-800/60 border border-blue-400/40 text-blue-100 text-[10px] px-2.5 py-1 rounded font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span>सुरक्षित बँकिंग व ऑटो-व्हाउचर सक्षम</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-xs p-3 rounded-sm font-medium flex items-center gap-2 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-3 rounded-sm font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-4 rounded-sm shadow-sm border border-gray-200 space-y-4">
        {/* ================= STEP 1: ACCOUNT & TRANSACTION DATE ================= */}
        <div className="bg-slate-50/70 p-3.5 rounded border border-slate-200 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-wide">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">१</span>
              <span>मुदत ठेव खाते व तारीख निवडा (Select FD Account & Transaction Date)</span>
            </h2>
            {selectedAccount && (
              <span className="text-[11px] font-mono text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                शाखा: <strong>{selectedAccount.branchID}</strong> | खाते क्र.: <strong className="text-primary">{selectedAccount.accountNo}</strong>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            <div className="md:col-span-2">
              <label className={labelClass}>मुदत ठेव खाते शोधा व निवडा *</label>
              <SearchableSelect
                options={accountOptions}
                value={selectedAccId.toString()}
                onChange={handleAccountSelect}
                placeholder="पावती क्र., खातेदार नाव किंवा CIF ने शोधा..."
              />
            </div>

            <div>
              <label className={labelClass}>व्यवहाराची तारीख (Transaction Date) *</label>
              <input
                type="date"
                value={closureDate}
                min={effectiveMinDate}
                max={todayStr}
                onChange={(e) => setClosureDate(e.target.value)}
                className={`w-full text-xs font-bold border rounded-sm px-2.5 py-1.5 focus:outline-none shadow-2xs h-[34px] ${
                  isBeforeOpeningDate || isBeforeLastAccrual || isFutureDate || isBackdatedSavingsTransfer
                    ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-600' 
                    : 'border-gray-300 bg-white text-gray-900 focus:border-primary'
                }`}
                required
              />

              {/* Contextual Date Alerts */}
              {isBeforeOpeningDate && selectedAccount && (
                <div className="mt-1 text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>तारीख खाते उघडण्याच्या ({selectedAccount.openingDate.split('T')[0].split('-').reverse().join('/')}) आधीची असू शकत नाही.</span>
                </div>
              )}
              {isFutureDate && (
                <div className="mt-1 text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>भविष्यातील तारीख प्रतिबंधित आहे. कृपया आजची तारीख निवडा.</span>
                </div>
              )}
              {isBeforeLastAccrual && selectedAccount?.lastInterestPostingDate && (
                <div className="mt-1 text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>तारीख शेवटच्या व्याज तरतुदीच्या ({selectedAccount.lastInterestPostingDate.split('T')[0].split('-').reverse().join('/')}) आधीची असू शकत नाही.</span>
                </div>
              )}
              {isBackdatedSavingsTransfer && (
                <div className="mt-1 text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 font-semibold flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>बचत खात्यात वर्ग करताना आजचीच तारीख लागते.</span>
                  </div>
                  <button type="button" onClick={() => setClosureDate(todayStr)} className="text-[10px] bg-red-200 hover:bg-red-300 text-red-900 px-1.5 py-0.5 rounded font-bold cursor-pointer">
                    आजची करा
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Compact Selected Account Details Strip */}
          {selectedAccount && (() => {
            const hasLien = Boolean(activeLoansData?.hasActiveLoan && (activeLoansData?.totalOutstandingLiability || 0) > 0);

            return (
              <div className="bg-white rounded border border-slate-300 px-3 py-2 flex flex-wrap items-center gap-2 shadow-2xs">
                <span className="text-sm">👤</span>
                <strong className="text-xs text-gray-900">{selectedAccount.customerName || selectedAccount.memberName}</strong>
                <span className="font-mono text-[11px] text-primary font-bold">
                  (CIF: {selectedAccount.cifNo || (selectedAccount.customerID ? `CIF-${selectedAccount.customerID}` : '-')})
                </span>
                <span className="text-[11px] text-gray-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  योजना: <strong className="text-blue-900">{selectedAccount.schemeName}</strong>
                </span>
                {selectedAccount.isSeniorCitizen && (
                  <span className="bg-purple-100 text-purple-900 text-[10px] px-1.5 py-0.5 rounded font-bold border border-purple-200">
                    👴 ज्येष्ठ नागरिक
                  </span>
                )}
                {hasLien && (
                  <span className="bg-amber-50 text-amber-900 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-200 flex items-center gap-1">
                    ℹ️ सक्रिय कर्ज बाकी: ₹ {(activeLoansData?.totalOutstandingLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (बचत खात्यातून कर्ज वसुली करावी)
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* ================= STEP 2: SELECT ACTION TYPE ================= */}
        {selectedAccount && (
          <div className="bg-slate-50/70 p-3.5 rounded border border-slate-200 space-y-3">
            <h2 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-wide">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">२</span>
              <span>व्यवहाराचा प्रकार (Select Transaction Action)</span>
            </h2>

            {!isMatured ? (
              /* Case A: Deposit is NOT Matured yet -> Clear, friendly Premature Banner (No confusing error!) */
              <div className="bg-amber-50/90 border-2 border-amber-300 rounded p-3 flex items-start gap-3 shadow-2xs">
                <div className="p-2 bg-amber-200/80 text-amber-900 rounded-full shrink-0 mt-0.5">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-amber-950">⚡ मुदतपूर्व बंद व परतावा (Premature Close & Payout)</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                      स्वयंचलित निवड (Auto-Detected)
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    सदर मुदत ठेव पावतीची अधिकृत मुदतपूर्ती तारीख <strong className="font-mono font-bold">{selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')}</strong> आहे (अद्याप मुदत पूर्ण झालेली नाही). त्यामुळे नियमानुसार हा व्यवहार <strong>'मुदतपूर्व बंद (Premature Close)'</strong> म्हणून केला जाईल. ठेव कालावधीच्या प्रत्यक्ष दिवसांनुसार पुनर्गणित व्याज आकारणी केली जाईल.
                  </p>
                </div>
              </div>
            ) : (
              /* Case B: Deposit IS Matured -> 2 clear selectable cards */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() => setActionType('MaturityClose')}
                  className={`p-3 rounded border-2 cursor-pointer transition flex items-start gap-3 shadow-2xs ${
                    actionType === 'MaturityClose'
                      ? 'bg-blue-50/80 border-primary ring-1 ring-primary'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="actionSelection"
                    checked={actionType === 'MaturityClose'}
                    onChange={() => setActionType('MaturityClose')}
                    className="mt-1 text-primary focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-xs text-gray-900 font-bold">💰 १. मुदतपूर्ती पेमेंट (Maturity Payout)</strong>
                      {actionType === 'MaturityClose' && (
                        <span className="text-[10px] bg-blue-100 text-primary px-1.5 py-0.2 rounded font-bold">निवडलेले</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                      मुदत पूर्ण झालेली ठेव रक्कम (मुद्दल + साचलेले व्याज) खातेदारास रोख, बँकेद्वारे किंवा बचत खात्यात अदा करणे.
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setActionType('Renewal')}
                  className={`p-3 rounded border-2 cursor-pointer transition flex items-start gap-3 shadow-2xs ${
                    actionType === 'Renewal'
                      ? 'bg-indigo-50/80 border-indigo-600 ring-1 ring-indigo-600'
                      : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="actionSelection"
                    checked={actionType === 'Renewal'}
                    onChange={() => setActionType('Renewal')}
                    className="mt-1 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-xs text-indigo-950 font-bold">🔄 २. मुदत ठेव नूतनीकरण (FD Renewal)</strong>
                      {actionType === 'Renewal' && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold">निवडलेले</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                      मुदत ठेव पुढील कालावधीसाठी नवीन पावतीमध्ये रोलओव्हर (नूतनीकरण) करणे (मुद्दल + व्याज किंवा केवळ मुद्दल).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 3: SETTLEMENT, LIEN SET-OFF & PAYMENT ================= */}
        {selectedAccount && (
          <div className="bg-slate-50/70 p-3.5 rounded border border-slate-200 space-y-4">
            <h2 className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-wide">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">३</span>
              <span>परतावा व पेमेंट तपशील (Payout & Payment Details)</span>
            </h2>

            {/* A: Premature Close Calculation Card */}
            {actionType === 'PrematureClose' && (
              <div className="space-y-3">
                {(() => {
                  const ledgers = getSchemeLedgers();
                  const principal = selectedAccount.depositAmount;
                  const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
                  const prematureRate = ledgers?.scheme?.prematureInterestRate ?? Math.max(0, selectedAccount.interestRate - 1.0);
                  const recalcInt = Math.round((principal * prematureRate * actualDays) / 36500);
                  const alreadyAccrued = selectedAccount.legacyAccruedInt || 0;
                  const isPeriodic = ledgers?.scheme?.interestType === 'MIS' || ledgers?.scheme?.interestType === 'Monthly Interest';
                  const clawback = alreadyAccrued > recalcInt ? (alreadyAccrued - recalcInt) : 0;
                  const netPayout = isPeriodic 
                    ? (alreadyAccrued > recalcInt ? principal - clawback : principal + recalcInt)
                    : principal + recalcInt;

                  return (
                    <div className="bg-emerald-50/70 border border-emerald-300 rounded p-3 text-xs grid grid-cols-2 md:grid-cols-4 gap-3 shadow-2xs">
                      <div className="bg-white p-2 rounded border border-emerald-200">
                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">मूळ मुद्दल:</span>
                        <strong className="text-gray-900 font-mono text-sm">₹ {principal.toLocaleString()}</strong>
                      </div>
                      <div className="bg-white p-2 rounded border border-emerald-200">
                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">मुदतपूर्व व्याज ({actualDays} दिवस):</span>
                        <strong className="text-blue-900 font-mono text-sm">{prematureRate}% (₹ {recalcInt.toLocaleString()})</strong>
                      </div>
                      <div className="bg-white p-2 rounded border border-emerald-200">
                        <span className="text-gray-500 block text-[10px] font-semibold uppercase">
                          {isPeriodic ? 'मुद्दलातून कपात (Clawback):' : 'तरतूद रिव्हर्सल (To P&L):'}
                        </span>
                        <strong className={`font-mono text-sm ${clawback > 0 ? 'text-amber-800' : 'text-gray-600'}`}>
                          ₹ {clawback.toLocaleString()}
                        </strong>
                      </div>
                      <div className="bg-emerald-100/80 p-2 rounded border border-emerald-300">
                        <span className="text-emerald-900 block text-[10px] font-bold uppercase">एकूण मुदतपूर्व परतावा:</span>
                        <strong className="text-emerald-950 font-mono text-base font-black">₹ {netPayout.toLocaleString()}</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* B: Maturity Close Calculation Card */}
            {actionType === 'MaturityClose' && (
              <div className="space-y-3">
                {(() => {
                  const principal = selectedAccount.depositAmount;
                  const totalMaturity = selectedAccount.maturityAmount && selectedAccount.maturityAmount > selectedAccount.depositAmount
                    ? selectedAccount.maturityAmount
                    : (selectedAccount.depositAmount + (selectedAccount.legacyAccruedInt || 0));
                  const accruedInt = Math.max(0, totalMaturity - principal);
                  const effOverdueInt = isOverdue ? overdueInterest : 0;
                  const totalPayout = principal + accruedInt + effOverdueInt;

                  return (
                    <div className="space-y-2">
                      <div className="bg-blue-50/70 border border-blue-200 rounded p-3 text-xs grid grid-cols-2 md:grid-cols-4 gap-3 shadow-2xs">
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <span className="text-gray-500 block text-[10px] font-semibold uppercase">मूळ मुद्दल:</span>
                          <strong className="text-gray-900 font-mono text-sm">₹ {principal.toLocaleString()}</strong>
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <span className="text-gray-500 block text-[10px] font-semibold uppercase">करारानुसार साचलेले व्याज:</span>
                          <strong className="text-blue-900 font-mono text-sm">+ ₹ {accruedInt.toLocaleString()}</strong>
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-100">
                          <span className="text-gray-500 block text-[10px] font-semibold uppercase">ओव्हरड्यू व्याज ({overdueDays} दिवस):</span>
                          <strong className="text-amber-800 font-mono text-sm">
                            {effOverdueInt > 0 ? `+ ₹ ${effOverdueInt.toLocaleString()} (@ ${effectiveOverdueRate}%)` : '₹ ०.००'}
                          </strong>
                        </div>
                        <div className="bg-blue-100/90 p-2 rounded border border-blue-300">
                          <span className="text-blue-950 block text-[10px] font-bold uppercase">एकूण मुदतपूर्ती परतावा:</span>
                          <strong className="text-primary font-mono text-base font-black">₹ {totalPayout.toLocaleString()}</strong>
                        </div>
                      </div>

                      {/* Overdue Checkbox if Overdue */}
                      {isOverdue && isAllowedByScheme && (
                        <div className="flex items-center justify-between gap-3 bg-white p-2 rounded border border-amber-300 text-xs shadow-2xs">
                          <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                            <input
                              type="checkbox"
                              checked={applyOverdueInterest}
                              onChange={(e) => setApplyOverdueInterest(e.target.checked)}
                              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                            />
                            <span>योजनेनुसार मंजूर ओव्हरड्यू व्याज लागू करा (@ {effectiveOverdueRate}% p.a.)</span>
                          </label>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                            🔒 संस्था धोरण मंजूर
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* C: Renewal Configuration Card */}
            {actionType === 'Renewal' && (
              <div className="bg-white p-3.5 rounded border border-indigo-200 space-y-3 shadow-2xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>नूतनीकरण प्रकार (Renewal Mode) *</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setRenewalType('PrincipalPlusInterest')}
                        className={`p-2 rounded border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          renewalType === 'PrincipalPlusInterest'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50'
                        }`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>१. मुद्दल + व्याज (Full Roll)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRenewalType('PrincipalOnly')}
                        className={`p-2 rounded border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          renewalType === 'PrincipalOnly'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50'
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>२. केवळ मुद्दल (Interest Payout)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>नवीन ठेव योजना (Target Scheme) *</label>
                    <select
                      value={targetSchemeId}
                      onChange={(e) => setTargetSchemeId(parseInt(e.target.value))}
                      className="w-full text-xs font-bold border border-indigo-300 bg-white rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-primary text-indigo-950 mt-1 h-[34px]"
                      required
                    >
                      {schemes.map((s) => {
                        const isSenior = selectedAccount?.isSeniorCitizen;
                        const hasSeniorRate = isSenior && s.seniorCitizenInterestRate && s.seniorCitizenInterestRate > 0;
                        const displayRate = hasSeniorRate ? s.seniorCitizenInterestRate : s.interestRate;
                        const durUnit = s.durationType === 'Days' ? 'दिवस' : s.durationType === 'Years' ? 'वर्षे' : 'महिने';
                        return (
                          <option key={s.fdSchemeID} value={s.fdSchemeID}>
                            {s.schemeName} ({s.durationMonths} {durUnit} @ {displayRate}%{hasSeniorRate ? ' - ज्येष्ठ नागरिक' : ''})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Overdue Effective Date Choice */}
                {isOverdue && (
                  <div className="bg-amber-50/80 p-2.5 rounded border border-amber-200 text-xs space-y-2">
                    <span className="font-bold text-amber-950 block">नूतनीकरणाची प्रभावी तारीख निवडा:</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <label className={`p-2 rounded border cursor-pointer flex items-center gap-2 ${
                        renewalEffectiveFrom === 'ClosureDate' ? 'bg-white border-primary ring-1 ring-primary' : 'bg-amber-100/40 border-amber-200'
                      }`}>
                        <input
                          type="radio"
                          name="renewalEffectiveFrom"
                          value="ClosureDate"
                          checked={renewalEffectiveFrom === 'ClosureDate'}
                          onChange={() => setRenewalEffectiveFrom('ClosureDate')}
                          className="text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-gray-800">
                          १. आजच्या तारखेपासून ({closureDate ? closureDate.split('-').reverse().join('/') : '-'})
                        </span>
                      </label>

                      <label className={`p-2 rounded border cursor-pointer flex items-center gap-2 ${
                        renewalEffectiveFrom === 'MaturityDate' ? 'bg-white border-primary ring-1 ring-primary' : 'bg-amber-100/40 border-amber-200'
                      }`}>
                        <input
                          type="radio"
                          name="renewalEffectiveFrom"
                          value="MaturityDate"
                          checked={renewalEffectiveFrom === 'MaturityDate'}
                          onChange={() => setRenewalEffectiveFrom('MaturityDate')}
                          className="text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="text-[11px] font-bold text-emerald-900">
                          २. मूळ मुदतपूर्तीपासून (पूर्वलक्षी / {selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')})
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Calculation Summary for Renewed Deposit */}
                <div className="bg-slate-50 p-2.5 rounded border border-indigo-100 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">नवीन पावती चालू दिनांक:</span>
                    <strong className="font-mono text-indigo-950 font-bold">
                      {isOverdue && renewalEffectiveFrom === 'MaturityDate'
                        ? selectedAccount.maturityDate.split('T')[0].split('-').reverse().join('/')
                        : (closureDate ? closureDate.split('-').reverse().join('/') : '-')}
                    </strong>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">नवीन पावती मुदतपूर्ती दिनांक:</span>
                    <strong className="font-mono text-emerald-800 font-bold">
                      {(() => {
                        const targetScheme = schemes.find(s => s.fdSchemeID === targetSchemeId);
                        if (!targetScheme) return '-';
                        const startDateStr = isOverdue && renewalEffectiveFrom === 'MaturityDate' 
                          ? selectedAccount.maturityDate 
                          : closureDate;
                        if (!startDateStr) return '-';
                        const d = new Date(startDateStr);
                        const durType = targetScheme.durationType || 'Months';
                        const durVal = targetScheme.durationMonths || 12;
                        if (durType === 'Days') {
                          d.setDate(d.getDate() + durVal);
                        } else if (durType === 'Years') {
                          d.setFullYear(d.getFullYear() + durVal);
                        } else {
                          d.setMonth(d.getMonth() + durVal);
                        }
                        const day = String(d.getDate()).padStart(2, '0');
                        const mon = String(d.getMonth() + 1).padStart(2, '0');
                        const yr = d.getFullYear();
                        return `${day}/${mon}/${yr} (${durVal} ${durType === 'Days' ? 'दिवस' : durType === 'Years' ? 'वर्षे' : 'महिने'})`;
                      })()}
                    </strong>
                  </div>

                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">लागू व्याजदर:</span>
                    {(() => {
                      const targetScheme = schemes.find(s => s.fdSchemeID === targetSchemeId);
                      if (!targetScheme) return <strong>-</strong>;
                      const isSenior = selectedAccount?.isSeniorCitizen;
                      const hasSeniorRate = isSenior && targetScheme.seniorCitizenInterestRate && targetScheme.seniorCitizenInterestRate > 0;
                      const rate = hasSeniorRate ? targetScheme.seniorCitizenInterestRate : targetScheme.interestRate;
                      return (
                        <span className="font-bold text-indigo-900 font-mono">
                          {rate} %
                          {hasSeniorRate && (
                            <span className="ml-1 text-[10px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-bold border border-purple-200">
                              👴 ज्येष्ठ नागरिक सवलत दर
                            </span>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* INTEREST CALCULATION & AMORTIZATION CHART (मुदत ठेव व्याज वेळापत्रक व हिशोब तक्ता) */}
            {scheduleSummary && (
              <div className="bg-white rounded border border-slate-300 shadow-2xs overflow-hidden">
                {/* Header with KPI badges and toggle */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📊</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold tracking-tight">
                          मुदत ठेव व्याज वेळापत्रक व हिशोब तक्ता (Interest Calculation Chart)
                        </h4>
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                          {scheduleSummary.schemeType === 'Cumulative' ? 'तिमाही चक्रवाढ' : (scheduleSummary.isPeriodicPayout ? 'मासिक परतावा' : 'साधी मुदत ठेव')}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-200/90 mt-0.5">
                        ठेव दिनांक {formatDateDisplay(selectedAccount.openingDate)} ते मुदतपूर्ती {formatDateDisplay(selectedAccount.maturityDate)} पर्यंतचा टप्पानिहाय अधिकृत हिशोब
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold transition cursor-pointer"
                      title="संपूर्ण तक्ता पॉपअपमध्ये पहा किंवा प्रिंट करा"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>🖨️ संपूर्ण तक्ता / प्रिंट</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInlineSchedule(!showInlineSchedule)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white/15 hover:bg-white/25 text-white rounded text-xs font-bold transition cursor-pointer"
                    >
                      {showInlineSchedule ? 'तक्ता लपवा ▲' : 'तक्ता पहा ▼'}
                    </button>
                  </div>
                </div>

                <div className="p-3 space-y-3 bg-slate-50/50">
                  {/* Reconciled Summary Highlights */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-gray-500 uppercase font-bold block">ठेव मुद्दल (Principal):</span>
                      <strong className="text-sm font-bold text-gray-900 font-mono">
                        ₹ {selectedAccount.depositAmount.toLocaleString()}
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-gray-500 uppercase font-bold block">करारानुसार देय व्याज:</span>
                      <strong className="text-sm font-bold text-blue-900 font-mono">
                        + ₹ {scheduleSummary.totalInterest.toLocaleString()}
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-gray-500 uppercase font-bold block">
                        {isOverdue ? `ओव्हरड्यू व्याज (${overdueDays} दिवस @ ${effectiveOverdueRate}%):` : 'ओव्हरड्यू व्याज:'}
                      </span>
                      <strong className={`text-sm font-bold font-mono ${isOverdue && overdueInterest > 0 ? 'text-amber-800' : 'text-gray-500'}`}>
                        {isOverdue && overdueInterest > 0 ? `+ ₹ ${overdueInterest.toLocaleString()}` : '₹ ०.००'}
                      </strong>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded border border-emerald-300">
                      <span className="text-[10px] text-emerald-900 uppercase font-bold block">
                        {actionType === 'PrematureClose' ? 'एकूण मुदतपूर्व परतावा:' : 'एकूण अंतिम देय परतावा:'}
                      </span>
                      <strong className="text-base font-black text-emerald-950 font-mono">
                        ₹ {getTotalFdPayout().toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Premature Close Comparison Banner if Premature */}
                  {actionType === 'PrematureClose' && (() => {
                    const principal = selectedAccount.depositAmount;
                    const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
                    const ledgers = getSchemeLedgers();
                    const prematureRate = ledgers?.scheme?.prematureInterestRate ?? Math.max(0, selectedAccount.interestRate - 1.0);
                    const recalcInt = Math.round((principal * prematureRate * actualDays) / 36500);
                    const alreadyAccrued = selectedAccount.legacyAccruedInt || 0;
                    const clawback = alreadyAccrued > recalcInt ? (alreadyAccrued - recalcInt) : 0;

                    return (
                      <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-950">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>⚠️ मुदतपूर्व बंद हिशोब पुनर्गणना (Premature Closure Recalculation):</span>
                        </div>
                        <p className="text-[11px] text-amber-900">
                          ठेवीदाराने करार मुदत ({formatDateDisplay(selectedAccount.maturityDate)}) पूर्ण न करता {actualDays} दिवसांतच ठेव बंद केली आहे. 
                          नियमानुसार नियमित दर {selectedAccount.interestRate}% ऐवजी मुदतपूर्व सवलत दर <b>{prematureRate}%</b> लागू केला आहे.
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-amber-950 pt-1 border-t border-amber-200">
                          <span>पुनर्गणित व्याज: <b>₹ {recalcInt.toLocaleString()}</b></span>
                          <span>लेजरमध्ये साचलेली तरतूद: <b>₹ {alreadyAccrued.toLocaleString()}</b></span>
                          {clawback > 0 && <span className="text-red-700">P&L रिव्हर्सल / कपात: <b>₹ {clawback.toLocaleString()}</b></span>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Collapsible Amortization Table */}
                  {showInlineSchedule && (
                    <div className="border border-slate-200 rounded overflow-hidden bg-white shadow-2xs">
                      <div className="overflow-x-auto max-h-80">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-slate-100 text-slate-700 text-[11px] uppercase font-bold sticky top-0 border-b border-slate-300">
                            <tr>
                              <th className="p-2 text-center w-10 border-r border-slate-200">क्र.</th>
                              <th className="p-2 text-left border-r border-slate-200">टप्पा (Period)</th>
                              <th className="p-2 text-center border-r border-slate-200">कालावधी (From - To)</th>
                              <th className="p-2 text-center w-14 border-r border-slate-200">दिवस</th>
                              <th className="p-2 text-right border-r border-slate-200">आरंभी मुद्दल (₹)</th>
                              <th className="p-2 text-center w-16 border-r border-slate-200">दर %</th>
                              <th className="p-2 text-right border-r border-slate-200">या टप्प्याचे व्याज (₹)</th>
                              <th className="p-2 text-right border-r border-slate-200">एकूण साचलेले व्याज (₹)</th>
                              <th className="p-2 text-right border-r border-slate-200">अखेर शिल्लक (₹)</th>
                              <th className="p-2 text-left">लेखांकन नोंद / स्थिती</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {scheduleSummary.periods.map((item, idx) => {
                              const isLast = idx === scheduleSummary.periods.length - 1;
                              return (
                                <tr
                                  key={item.periodNo}
                                  className={isLast ? 'bg-blue-50/70 font-semibold' : (idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-50')}
                                >
                                  <td className="p-2 text-center text-slate-500 font-mono border-r border-slate-100">{item.periodNo}</td>
                                  <td className="p-2 font-bold text-slate-800 whitespace-nowrap border-r border-slate-100">{item.periodLabel}</td>
                                  <td className="p-2 text-center font-mono text-[11px] whitespace-nowrap border-r border-slate-100">
                                    <span className="text-slate-800">{formatDateDisplay(item.fromDate)}</span>
                                    <span className="text-slate-400 font-sans mx-1 font-normal">ते</span>
                                    <span className="text-slate-800">{formatDateDisplay(item.toDate)}</span>
                                  </td>
                                  <td className="p-2 text-center font-mono text-slate-700 border-r border-slate-100">{item.days}</td>
                                  <td className="p-2 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap border-r border-slate-100">
                                    ₹ {item.openingBalance.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-center font-mono text-blue-900 border-r border-slate-100">{item.interestRate}%</td>
                                  <td className="p-2 text-right font-mono text-emerald-700 font-bold tabular-nums whitespace-nowrap border-r border-slate-100">
                                    + ₹ {item.interestAmount.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap border-r border-slate-100">
                                    ₹ {item.cumulativeInterest.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-right font-mono text-slate-900 font-bold tabular-nums whitespace-nowrap border-r border-slate-100">
                                    ₹ {item.closingBalance.toLocaleString()}
                                  </td>
                                  <td className="p-2 text-[11px] text-slate-600 whitespace-nowrap">
                                    {isLast ? (
                                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                        🎯 मुदतपूर्ती समाप्ती
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 font-mono text-[10px]">
                                        {scheduleSummary.schemeType === 'Cumulative' ? 'चक्रवाढ तरतूद (Accrued)' : item.statusNote}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Overdue Period Row if applicable */}
                            {isOverdue && overdueInterest > 0 && (
                              <tr className="bg-amber-100/90 font-bold text-amber-950 border-t-2 border-amber-300">
                                <td className="p-2 text-center text-amber-900 font-mono border-r border-amber-200">+</td>
                                <td className="p-2 font-bold text-amber-950 whitespace-nowrap border-r border-amber-200">
                                  ⚠️ ओव्हरड्यू व्याज (Overdue)
                                </td>
                                <td className="p-2 text-center font-mono text-[11px] whitespace-nowrap border-r border-amber-200">
                                  <span className="text-amber-900">{formatDateDisplay(selectedAccount.maturityDate)}</span>
                                  <span className="text-amber-600 font-sans mx-1 font-normal">ते</span>
                                  <span className="text-amber-900">{formatDateDisplay(closureDate)}</span>
                                </td>
                                <td className="p-2 text-center font-mono text-amber-900 border-r border-amber-200">
                                  {overdueDays}d
                                </td>
                                <td className="p-2 text-right font-mono text-amber-900 tabular-nums whitespace-nowrap border-r border-amber-200">
                                  ₹ {overdueBaseAmount.toLocaleString()}
                                </td>
                                <td className="p-2 text-center font-mono text-amber-950 border-r border-amber-200">
                                  {effectiveOverdueRate}%
                                </td>
                                <td className="p-2 text-right font-mono text-amber-900 font-black tabular-nums whitespace-nowrap border-r border-amber-200">
                                  + ₹ {overdueInterest.toLocaleString()}
                                </td>
                                <td className="p-2 text-right font-mono text-amber-900 tabular-nums whitespace-nowrap border-r border-amber-200">
                                  ₹ {(scheduleSummary.totalInterest + overdueInterest).toLocaleString()}
                                </td>
                                <td className="p-2 text-right font-mono text-amber-950 font-black tabular-nums whitespace-nowrap border-r border-amber-200">
                                  ₹ {(scheduleSummary.maturityAmount + overdueInterest).toLocaleString()}
                                </td>
                                <td className="p-2 text-[11px] text-amber-900 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 bg-amber-200 text-amber-950 border border-amber-300 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                    ओव्हरड्यू व्याज खर्च (@ {effectiveOverdueRate}%)
                                  </span>
                                </td>
                              </tr>
                            )}
                          </tbody>
                          <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                            <tr>
                              <td colSpan={3} className="p-2 text-right font-bold text-slate-800 border-r border-slate-200">
                                {isOverdue && overdueInterest > 0 ? 'एकूण अंतिम देय परतावा (Total Reconciled):' : 'एकूण करार परतावा (Total Contracted):'}
                              </td>
                              <td className="p-2 text-center font-mono border-r border-slate-200">
                                {scheduleSummary.totalDays + (isOverdue ? overdueDays : 0)}d
                              </td>
                              <td className="p-2 text-right font-mono tabular-nums whitespace-nowrap border-r border-slate-200">
                                ₹ {selectedAccount.depositAmount.toLocaleString()}
                              </td>
                              <td className="p-2 text-center font-mono border-r border-slate-200">-</td>
                              <td className="p-2 text-right font-mono text-emerald-800 font-black tabular-nums whitespace-nowrap border-r border-slate-200">
                                + ₹ {(scheduleSummary.totalInterest + (isOverdue ? overdueInterest : 0)).toLocaleString()}
                              </td>
                              <td className="p-2 text-right font-mono text-emerald-800 tabular-nums whitespace-nowrap border-r border-slate-200">
                                ₹ {(scheduleSummary.totalInterest + (isOverdue ? overdueInterest : 0)).toLocaleString()}
                              </td>
                              <td className="p-2 text-right font-mono text-indigo-950 font-black text-sm tabular-nums whitespace-nowrap border-r border-slate-200">
                                ₹ {(scheduleSummary.maturityAmount + (isOverdue ? overdueInterest : 0)).toLocaleString()}
                              </td>
                              <td className="p-2 text-[11px] text-emerald-800 font-bold whitespace-nowrap">
                                ✅ व्हाऊचर लेजर नोंदींशी तंतोतंत जुळवणी
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Informative Note for Active Loans if any */}
            {(actionType === 'MaturityClose' || actionType === 'PrematureClose') && activeLoansData?.hasActiveLoan && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2.5 text-xs text-blue-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <b>सूचना:</b> या खातेदाराकडे एकूण ₹{(activeLoansData.totalOutstandingLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} चे सक्रिय कर्ज बाकी आहे. मुदत ठेवीचा परतावा <u>'बचत खात्यात वर्ग (Transfer)'</u> करून नंतर <b>कर्ज वसुली (Loan Collection)</b> मधून हप्ता भरावा.
                </span>
              </div>
            )}

            {/* E: STANDARD PAYMENT MODE */}
            {(actionType === 'MaturityClose' || actionType === 'PrematureClose' || (actionType === 'Renewal' && renewalType === 'PrincipalOnly')) && (
              <div className="bg-white p-3.5 rounded border border-slate-300 space-y-3 shadow-2xs">
                <div>
                  <label className={labelClass}>
                    {actionType === 'Renewal' ? 'व्याज परतावा पेमेंट पद्धत (Interest Payout Mode) *' : 'परतावा पेमेंट पद्धत (Payout Payment Mode) *'}
                  </label>
                  <div className="mt-1">
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as 'Cash' | 'Bank' | 'Transfer')}
                      className={`${inputClass} font-semibold text-gray-800 cursor-pointer`}
                    >
                      <option value="Cash">💵 रोख (Cash)</option>
                      <option value="Bank">🏦 बँक (Bank)</option>
                      <option value="Transfer">🔄 बचत खात्यात वर्ग (Saving Account Transfer)</option>
                    </select>
                  </div>
                </div>

                {/* Conditional Cash Badge */}
                {paymentMode === 'Cash' && (
                  <CashLedgerReflectBadge 
                    branchId={selectedAccount.branchID} 
                    transactionType="Withdrawal" 
                    customTitle="परतावा अदा करण्याचे रोख खाते (Payout Cash Ledger)"
                  />
                )}

                {/* Conditional Bank Details */}
                {paymentMode === 'Bank' && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">बँक लेजर निवडा (Select Bank GL) *</label>
                        <SearchableSelect
                          options={bankLedgers.map(b => ({
                            value: b.ledgerID.toString(),
                            label: `${b.ledgerID} - ${b.ledgerName} (${b.accountType || 'Bank'})`
                          }))}
                          value={bankAccountLedgerID.toString()}
                          onChange={(val: any) => {
                            const v = typeof val === 'object' && val?.target ? val.target.value : val;
                            setBankAccountLedgerID(parseInt(String(v || 0)));
                          }}
                          placeholder="बँक खाते शोधा..."
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">धनादेश / संदर्भ क्र.</label>
                        <input
                          type="text"
                          value={chequeNo}
                          onChange={(e) => setChequeNo(e.target.value)}
                          placeholder="उदा. Cheque 123456 / UTR"
                          className="w-full border border-amber-300 px-2 py-1 rounded-sm text-xs bg-white font-bold text-gray-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">धनादेश तारीख</label>
                        <input
                          type="date"
                          value={chequeDate}
                          onChange={(e) => setChequeDate(e.target.value)}
                          className="w-full border border-amber-300 px-2 py-1 rounded-sm text-xs bg-white text-gray-800 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional Saving Transfer */}
                {paymentMode === 'Transfer' && (
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded space-y-2">
                    <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">
                      रक्कम जमा करण्यासाठी खातेदाराचे बचत खाते निवडा *
                    </label>
                    {memberSavingAccounts.length > 0 ? (
                      <select
                        value={selectedSavingAccountId}
                        onChange={(e) => setSelectedSavingAccountId(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full border border-indigo-300 px-2.5 py-1.5 rounded-sm text-xs bg-white font-bold text-indigo-950 shadow-2xs"
                        required
                      >
                        {memberSavingAccounts.map((acc) => {
                          const avail = Math.max(0, acc.currentBalance - (acc.lienAmount || 0) - (acc.minimumBalance || 0));
                          return (
                            <option key={acc.savingAccountID} value={acc.savingAccountID}>
                              {acc.accountNo} | चालू शिल्लक: ₹{acc.currentBalance.toFixed(2)} (उपलब्ध: ₹{avail.toFixed(2)})
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <div className="text-xs text-red-600 font-bold bg-white p-2 rounded border border-red-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>⚠️ या खातेदाराचे कोणतेही सक्रिय बचत खाते उपलब्ध नाही! कृपया रोख किंवा बँक पर्याय निवडा.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Narration */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">तपशील / शेरा (Narration - Optional)</label>
                  <input
                    type="text"
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="उदा. मुदत ठेव परतावा / मुदतपूर्व बंद परतावा"
                    className="w-full border border-gray-300 px-2.5 py-1.5 rounded-sm text-xs bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 4: VOUCHER PREVIEW & CONFIRMATION ================= */}
        {selectedAccount && voucherPreview && (
          <div className="bg-slate-50/70 p-3.5 rounded border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">४</span>
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="font-bold text-xs text-gray-800">व्हाऊचर लेजर नोंदी (Accounting Preview)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold border border-emerald-200">
                  संतुलित (Balanced)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-gray-600">
                  व्हाऊचर दिनांक: <strong className="text-gray-900">{closureDate ? closureDate.split('-').reverse().join('/') : '-'}</strong>
                </span>
                {scheduleSummary && (
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="text-[11px] font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 px-2 py-0.5 rounded cursor-pointer transition shadow-2xs flex items-center gap-1"
                    title="या व्हाऊचरमधील व्याजाचा संपूर्ण हिशोब तक्ता पहा"
                  >
                    <span>📊 व्याज हिशोब तक्ता पहा</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowVoucherPreview(!showVoucherPreview)}
                  className="text-[11px] font-bold text-primary bg-white hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded cursor-pointer transition shadow-2xs"
                >
                  {showVoucherPreview ? 'नोंदी लपवा ▲' : 'नोंदी पहा ▼'}
                </button>
              </div>
            </div>

            {/* Manual Override Controls Banner */}
            <div className="bg-amber-50/90 border border-amber-300 rounded p-2.5 space-y-2 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isManualOverride}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsManualOverride(checked);
                      if (checked) {
                        if (actionType === 'PrematureClose') {
                          if (!customPrematureInterest) {
                            const principal = selectedAccount.depositAmount;
                            const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
                            const ledgers = getSchemeLedgers();
                            const prematureRate = ledgers?.scheme?.prematureInterestRate ?? Math.max(0, selectedAccount.interestRate - 1.0);
                            const systemRecalcInt = Math.round((principal * prematureRate * actualDays) / 36500);
                            setCustomPrematureInterest(systemRecalcInt.toString());
                          }
                        } else {
                          if (!customAccruedInterest) {
                            const principal = selectedAccount.depositAmount;
                            const totalMaturity = selectedAccount.maturityAmount && selectedAccount.maturityAmount > selectedAccount.depositAmount
                              ? selectedAccount.maturityAmount
                              : (selectedAccount.depositAmount + (selectedAccount.legacyAccruedInt || 0));
                            const systemAccruedInt = Math.max(0, totalMaturity - principal);
                            setCustomAccruedInterest(systemAccruedInt.toString());
                          }
                          if (isOverdue && !customOverdueInterest) {
                            setCustomOverdueInterest(overdueInterest.toString());
                          }
                        }
                      }
                    }}
                    className="w-4 h-4 text-amber-600 rounded border-amber-400 focus:ring-amber-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                      संस्थेच्या जुन्या नोंदीनुसार रक्कम संपादित करा (Manual Amount Override)
                    </span>
                    <span className="text-[11px] text-amber-800 block">
                      (गो-लाईव्ह पूर्वी संस्थेने मॅन्युअल हिशोबानुसार व्याज किंवा परतावा दिला असल्यास व्हाऊचर जुळवण्यासाठी रक्कम बदला)
                    </span>
                  </div>
                </label>

                {isManualOverride && (
                  <button
                    type="button"
                    onClick={handleResetManualOverride}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded shadow-2xs transition cursor-pointer"
                    title="सिस्टीमने केलेल्या स्वयंचलित गणनेवर पूर्ववत करा"
                  >
                    <RotateCcw className="w-3 h-3" />
                    पूर्ववत करा (Reset to Auto)
                  </button>
                )}
              </div>

              {/* Quick editable values strip when manual override is enabled */}
              {isManualOverride && (
                <div className="bg-white/80 border border-amber-200 rounded p-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-amber-700" />
                    <span>व्हाऊचरमधील व्याजाची रक्कम बदला (खालील टेबलमध्ये परतावा आपोआप समतोल होईल):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {actionType === 'PrematureClose' ? (
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] font-bold text-gray-700">मुदतपूर्व व्याज (₹):</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customPrematureInterest}
                          onChange={(e) => setCustomPrematureInterest(e.target.value)}
                          placeholder="0.00"
                          className="w-28 text-right font-mono font-bold text-xs bg-amber-50 border border-amber-400 rounded px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] font-bold text-gray-700">देणे व्याज (₹):</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={customAccruedInterest}
                            onChange={(e) => setCustomAccruedInterest(e.target.value)}
                            placeholder="0.00"
                            className="w-28 text-right font-mono font-bold text-xs bg-amber-50 border border-amber-400 rounded px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                          />
                        </div>
                        {isOverdue && (
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] font-bold text-gray-700">ओव्हरड्यू व्याज (₹):</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={customOverdueInterest}
                              onChange={(e) => setCustomOverdueInterest(e.target.value)}
                              placeholder="0.00"
                              className="w-28 text-right font-mono font-bold text-xs bg-amber-50 border border-amber-400 rounded px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {showVoucherPreview && (
              <div className="border rounded-sm overflow-hidden shadow-2xs bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b text-[11px] font-bold text-gray-700">
                      <th className="p-2 w-16 text-center">प्रकार (Dr/Cr)</th>
                      <th className="p-2">लेजर खाते (Ledger Account)</th>
                      <th className="p-2">लेखांकन कारण / शेरा (Particulars)</th>
                      <th className="p-2 text-right w-36">रक्कम (Amount ₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voucherPreview.map((entry, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-2 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            entry.drCr === 'Dr' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {entry.drCr}
                          </span>
                        </td>
                        <td className="p-2 font-bold text-gray-900">{entry.ledgerName}</td>
                        <td className="p-2 text-gray-600 text-[11px]">{entry.note}</td>
                        <td className="p-2 text-right font-mono font-bold text-gray-900">
                          {entry.isEditable ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-1 py-0.5 rounded border border-amber-200">
                                ✍️
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={entry.editKey === 'overdue' ? customOverdueInterest : (actionType === 'PrematureClose' ? customPrematureInterest : customAccruedInterest)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (entry.editKey === 'overdue') setCustomOverdueInterest(val);
                                  else if (actionType === 'PrematureClose') setCustomPrematureInterest(val);
                                  else setCustomAccruedInterest(val);
                                }}
                                className="w-24 text-right font-mono font-bold text-xs bg-amber-50 border border-amber-400 rounded px-1.5 py-0.5 text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner"
                              />
                            </div>
                          ) : entry.isLockedPrincipal ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[9px] text-slate-500 font-normal bg-slate-100 px-1 py-0.5 rounded border border-slate-200 flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> स्थिर
                              </span>
                              <span>₹ {entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          ) : entry.isBalancing && isManualOverride ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[9px] text-emerald-800 font-medium bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                                ⚡ संतुलित
                              </span>
                              <span>₹ {entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          ) : (
                            <span>₹ {entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {(() => {
                    const totalDr = voucherPreview.filter(e => e.drCr === 'Dr').reduce((s, e) => s + e.amount, 0);
                    const totalCr = voucherPreview.filter(e => e.drCr === 'Cr').reduce((s, e) => s + e.amount, 0);
                    const isBalanced = Math.abs(totalDr - totalCr) < 0.01;
                    return (
                      <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs">
                        <tr>
                          <td colSpan={3} className="p-2 text-right text-gray-700">
                            एकूण व्हाऊचर बेरीज (Voucher Totals):
                          </td>
                          <td className="p-2 text-right font-mono whitespace-nowrap">
                            <div className="space-y-0.5 text-[11px]">
                              <div className="text-blue-900">Dr: ₹ {totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              <div className="text-emerald-900">Cr: ₹ {totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                          </td>
                        </tr>
                        <tr className={isBalanced ? 'bg-emerald-50/80 text-emerald-900' : 'bg-red-50 text-red-900'}>
                          <td colSpan={4} className="p-2 text-center text-xs font-bold">
                            {isBalanced ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-800">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>✅ द्विनोंद पद्धतीनुसार व्हाऊचर तंतोतंत संतुलित आहे (Total Dr == Total Cr)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-red-800">
                                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                <span>⚠️ व्हाऊचर असंतुलित आहे! फरक: ₹{Math.abs(totalDr - totalCr).toFixed(2)}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                </table>
              </div>
            )}

            {/* Mandatory Audit Reason for Manual Override */}
            {isManualOverride && (
              <div className="bg-amber-50/90 border border-amber-300 rounded p-3 space-y-1.5 shadow-2xs">
                <label className="block text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  लेखांकन बदलाचे कारण / शेरा (Manual Override Reason for Audit Trail) *
                </label>
                <input
                  type="text"
                  value={manualOverrideReason}
                  onChange={(e) => setManualOverrideReason(e.target.value)}
                  placeholder="उदा. गो-लाईव्ह पूर्वी संस्थेने प्रत्यक्ष दिलेल्या पावती/व्हाऊचरनुसार रकमेची जुळवणी (Reconciled with Legacy Physical Voucher)"
                  className="w-full text-xs border border-amber-400 rounded px-2.5 py-2 bg-white text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner"
                  required
                />
                <p className="text-[11px] text-amber-800">
                  🛡️ <b>ऑडिट सुरक्षा सूचना:</b> आपण सिस्टीमच्या स्वयंचलित गणनेत बदल करत आहात. हे कारण व्हाऊचरच्या नॅरेशन (Narration) आणि मुदत ठेव खात्याच्या शेऱ्यामध्ये (Audit Trail) कायमस्वरूपी नोंदवले जाईल.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottom Submission Bar */}
        <div className="bg-slate-100 p-3 rounded border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-gray-600 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>व्यवहार पूर्ण केल्यावर मुदत ठेव खाते अद्ययावत होऊन व्हाऊचर त्वरित लेजरमध्ये पोस्ट केले जाईल.</span>
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              !selectedAccount ||
              isPendingMaturityAction ||
              isBeforeOpeningDate ||
              isBeforeLastAccrual ||
              isFutureDate ||
              isBackdatedSavingsTransfer ||
              (isManualOverride && !manualOverrideReason.trim())
            }
            className={`px-5 py-2.5 rounded font-bold text-xs shadow-xs transition duration-150 flex items-center gap-2 cursor-pointer ${
              loading ||
              !selectedAccount ||
              isPendingMaturityAction ||
              isBeforeOpeningDate ||
              isBeforeLastAccrual ||
              isFutureDate ||
              isBackdatedSavingsTransfer ||
              (isManualOverride && !manualOverrideReason.trim())
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : actionType === 'PrematureClose'
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20'
                : actionType === 'Renewal'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/20'
                : 'bg-primary hover:bg-[#004a75] text-white shadow-blue-900/20'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>प्रक्रिया होत आहे...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>
                  {actionType === 'MaturityClose'
                    ? 'मुदतपूर्ती पेमेंट पूर्ण करा (Process Maturity Payout)'
                    : actionType === 'PrematureClose'
                    ? 'मुदतपूर्व बंद व पेआउट करा (Process Premature Close)'
                    : 'नूतनीकरण पूर्ण करा (Process Renewal)'}
                </span>
              </>
            )}
          </button>
        </div>
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
    </div>
  );
};

export default FdWithdrawalMaturity;

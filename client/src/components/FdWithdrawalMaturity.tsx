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
  Lock,
  X
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
  const [schemes, setSchemes] = useState<FdScheme[]>([]);
  const [bankLedgers, setBankLedgers] = useState<Ledger[]>([]);
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
  const [surplusBankLedgerID, setSurplusBankLedgerID] = useState<number>(0);
  const [surplusSavingAccountId, setSurplusSavingAccountId] = useState<number | ''>('');
  const [narration, setNarration] = useState<string>('');

  // Active Loans Info state (Informational only)
  const [activeLoansData, setActiveLoansData] = useState<ActiveLoansResponse | null>(null);
  const [loadingLoans, setLoadingLoans] = useState<boolean>(false);

  // UI toggle states
  const [showVoucherPreview, setShowVoucherPreview] = useState<boolean>(true);
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

  const handleResetManualOverride = () => {
    setIsManualOverride(false);
    setManualOverrideReason('');
    setCustomAccruedInterest('');
    setCustomOverdueInterest('');
    setCustomPrematureInterest('');
  };

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
      console.error('Error loading FD closure voucher:', err);
      alert('मुदत ठेव क्लोजर व्हाउचर लोड करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    if (!window.confirm('आपण खात्रीपूर्वक हे मुदत ठेव क्लोजर व्हाउचर मंजूर व पास करू इच्छिता?')) return;
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
      const response = await axios.get(`${API_URL}/FdAccounts`);
      const activeList: FdAccount[] = response.data.filter((a: any) => a.status !== 'Closed');
      setAccounts(activeList);

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
        setSelectedAccId(acc.fdAccountID);
        setSelectedAccount(acc);
        fetchCustomerSavingsAccounts(acc.customerID, acc.memberID);
        fetchActiveLoans(acc.fdAccountID);
      };

      if (fdAccountIdStr) {
        const accId = parseInt(fdAccountIdStr);
        const matched = activeList.find((a: any) => a.fdAccountID === accId);
        if (matched) {
          applySelectedFd(matched);
          setCustomerMatchingFds([matched]);
        }
      } else if (cifStr || customerIdStr || memberIdStr || entityIdStr) {
        const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
        const mId = memberIdStr ? parseInt(memberIdStr, 10) : (entityIdStr ? parseInt(entityIdStr, 10) : 0);
        const cleanCif = cifStr ? cifStr.trim().toUpperCase() : '';
        const cleanDigits = cleanCif ? cleanCif.replace(/\D/g, '') : '';

        let matched: FdAccount[] = [];

        // Tier 1: CIF
        if (cleanCif) {
          matched = activeList.filter((a: any) => {
            const aCif = getAccCif(a);
            if (!aCif) return false;
            if (aCif === cleanCif) return true;
            if (cleanDigits && aCif.replace(/\D/g, '') === cleanDigits) return true;
            return false;
          });
        }

        // Tier 2: CustomerID
        if (matched.length === 0 && cId > 0) {
          matched = activeList.filter((a: any) => getAccCustId(a) === cId);
        }

        // Tier 3: MemberID
        if (matched.length === 0 && mId > 0) {
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
      const resolution = resolvePrematureRateDetails(selectedAccount, ledgers?.scheme, actualDays);
      const prematureRate = prematurePreview?.prematureRate ?? resolution.prematureRate;
      const systemRecalcInt = prematurePreview?.recalculatedInterest ?? Math.round((principal * prematureRate * actualDays) / 36500);

      const effRecalcInt = isManualOverride && customPrematureInterest !== ''
        ? Math.max(0, parseFloat(customPrematureInterest) || 0)
        : systemRecalcInt;

      const alreadyAccrued = prematurePreview?.alreadyAccruedInterest ?? (selectedAccount.legacyAccruedInt || 0);
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
      const resolution = resolvePrematureRateDetails(selectedAccount, ledgers.scheme, actualDays);
      const prematureRate = prematurePreview?.prematureRate ?? resolution.prematureRate;
      const systemRecalcInt = prematurePreview?.recalculatedInterest ?? Math.round((principal * prematureRate * actualDays) / 36500);

      const recalculatedInterest = isManualOverride && customPrematureInterest !== ''
        ? Math.max(0, parseFloat(customPrematureInterest) || 0)
        : systemRecalcInt;

      const alreadyAccruedInt = prematurePreview?.alreadyAccruedInterest ?? (selectedAccount.legacyAccruedInt || 0);
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
    <div className="p-2.5 sm:p-3 max-w-6xl mx-auto space-y-2.5 font-sans text-xs">
      {/* 1. ERP Header Banner */}
      <div className="bg-primary px-3.5 py-2 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-blue-200" />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-wide flex items-center gap-2">
              <span>मुदत ठेव क्लोजर आणि नूतनीकरण (FD Closures & Renewals)</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono font-semibold">CBS ERP</span>
            </h1>
            <p className="text-[10px] text-blue-100 font-normal">
              मुदत संपलेल्या किंवा मुदतपूर्व ठेवींचा परतावा (Payout) अथवा नवीन मुदत ठेव नूतनीकरण (FD Renewal)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedAccount && (
            <div className="hidden md:flex items-center gap-1.5 bg-blue-900/70 border border-blue-400/30 text-blue-100 text-[11px] px-2 py-0.5 rounded">
              <span>शाखा: <strong className="text-white">{selectedAccount.branchID}</strong></span>
              <span className="text-blue-300">|</span>
              <span>खाते: <strong className="text-amber-300 font-mono">{selectedAccount.accountNo}</strong></span>
            </div>
          )}
          <div className="hidden sm:flex items-center gap-1 bg-blue-800/60 border border-blue-400/40 text-blue-100 text-[10px] px-2 py-0.5 rounded font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>सुरक्षित बँकिंग व ऑटो-व्हाउचर सक्षम</span>
          </div>
        </div>
      </div>

      {/* Checker Mode Amber Alert Banner */}
      {isPassingMode && (
        <div className="bg-amber-500 text-slate-950 p-2.5 rounded shadow-sm border-2 border-amber-600 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
            <div>
              <span className="font-extrabold uppercase tracking-wide">मुदत ठेव बंद व्हाउचर तपासणी (FD Withdrawal Checker Mode):</span>{' '}
              व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucherData?.voucherNo || voucherId}</span> |
              रक्कम: <span className="font-bold">₹{passingVoucherData?.totalAmount?.toLocaleString('en-IN') || (selectedAccount?.maturityAmount ?? selectedAccount?.depositAmount)}</span> |
              तारीख: <span className="font-bold">{passingVoucherData?.voucherDate ? new Date(passingVoucherData.voucherDate).toLocaleDateString('mr-IN') : closureDate}</span>
            </div>
          </div>
          <div className="text-[11px] font-bold bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-400">
            🔒 तपासणी मोड (Read-Only)
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-xs p-2.5 rounded-sm font-medium flex items-center gap-2 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs p-2.5 rounded-sm font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {noFdFoundAlert && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-2.5 rounded-sm font-medium flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{noFdFoundAlert}</span>
          </div>
          <button type="button" onClick={() => setNoFdFoundAlert(null)} className="font-bold text-amber-700 hover:text-black cursor-pointer">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <fieldset disabled={isPassingMode} className="space-y-2.5">

          {/* ================= STEP 1: ACCOUNT & DATE SELECTION ================= */}
          <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <h2 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide">
                <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">१</span>
                <span>मुदत ठेव खाते व तारीख निवडा (Select FD Account & Transaction Date)</span>
              </h2>
              {selectedAccount && (
                <span className="text-[11px] font-mono text-gray-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  शाखा: <strong className="text-slate-800">{selectedAccount.branchID}</strong> | खाते क्र.: <strong className="text-primary">{selectedAccount.accountNo}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              {/* Account Dropdown (8 cols) */}
              <div className="md:col-span-8">
                <div className="flex items-center justify-between mb-1">
                  <label className={`${labelClass} !mb-0`}>
                    मुदत ठेव खाते शोधा व निवडा *
                  </label>
                  {customerMatchingFds.length > 1 && (
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
                      className="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200"
                    >
                      <Layers className="w-3 h-3 text-blue-600" />
                      <span>{customerMatchingFds.length} मुदत ठेवी उपलब्ध (निवडा ⚡)</span>
                    </button>
                  )}
                </div>
                <SearchableSelect
                  options={accountOptions}
                  value={selectedAccId.toString()}
                  onChange={handleAccountSelect}
                  placeholder="पावती क्र., खातेदार नाव किंवा CIF ने शोधा..."
                  disabled={isPassingMode}
                />
              </div>

              {/* Transaction Date (4 cols) */}
              <div className="md:col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <label className={`${labelClass} !mb-0`}>
                    व्यवहाराची तारीख (Transaction Date) *
                  </label>
                  {isOverdue && selectedAccount && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      {overdueDays} दिवस ओव्हरड्यू
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={closureDate}
                  min={effectiveMinDate}
                  max={todayStr}
                  onChange={(e) => setClosureDate(e.target.value)}
                  className={`w-full text-xs font-bold border rounded-sm px-2.5 py-1 focus:outline-none shadow-2xs h-[34px] ${
                    isBeforeOpeningDate || isBeforeLastAccrual || isFutureDate || isBackdatedSavingsTransfer
                      ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-600' 
                      : 'border-gray-300 bg-white text-gray-900 focus:border-primary'
                  }`}
                  required
                  disabled={isPassingMode}
                />
              </div>
            </div>

            {/* Contextual Date Alerts */}
            {isBeforeOpeningDate && selectedAccount && (
              <div className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>तारीख खाते उघडण्याच्या ({formatDateDisplay(selectedAccount.openingDate)}) आधीची असू शकत नाही.</span>
              </div>
            )}
            {isFutureDate && (
              <div className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>भविष्यातील तारीख प्रतिबंधित आहे. कृपया आजची किंवा मागील तारीख निवडा.</span>
              </div>
            )}
            {isBeforeLastAccrual && selectedAccount?.lastInterestPostingDate && (
              <div className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>तारीख शेवटच्या व्याज तरतुदीच्या ({formatDateDisplay(selectedAccount.lastInterestPostingDate)}) आधीची असू शकत नाही.</span>
              </div>
            )}
            {isBackdatedSavingsTransfer && (
              <div className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 font-semibold flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>बचत खात्यात वर्ग करताना आजचीच तारीख लागते.</span>
                </div>
                <button type="button" onClick={() => setClosureDate(todayStr)} className="text-[10px] bg-red-200 hover:bg-red-300 text-red-900 px-2 py-0.5 rounded font-bold cursor-pointer">
                  आजची करा
                </button>
              </div>
            )}

            {/* Compact Customer Info Ribbon (Replaces large cards with 1 clean strip) */}
            {selectedAccount && (() => {
              const hasLien = Boolean(activeLoansData?.hasActiveLoan && (activeLoansData?.totalOutstandingLiability || 0) > 0);
              return (
                <div className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-900 flex items-center gap-1">
                      <span>👤</span> {selectedAccount.customerName || selectedAccount.memberName}
                    </span>
                    <span className="font-mono text-[11px] text-primary font-bold">
                      (CIF: {selectedAccount.cifNo || (selectedAccount.customerID ? `CIF-${selectedAccount.customerID}` : '-')})
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-700">
                      योजना: <strong className="text-blue-900">{selectedAccount.schemeName}</strong>
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>
                      मुद्दल: <strong className="font-mono text-gray-900">₹{selectedAccount.depositAmount.toLocaleString()}</strong>
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>
                      व्याजदर: <strong className="font-mono text-blue-800">{selectedAccount.interestRate}%</strong>
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>
                      मुदतपूर्ती: <strong className="font-mono text-gray-800">{formatDateDisplay(selectedAccount.maturityDate)}</strong>
                    </span>
                    {selectedAccount.isSeniorCitizen && (
                      <span className="bg-purple-100 text-purple-900 text-[10px] px-1.5 py-0.2 rounded-full font-bold border border-purple-200">
                        👴 ज्येष्ठ नागरिक
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold border ${
                      isMatured ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-amber-100 text-amber-900 border-amber-300'
                    }`}>
                      {isMatured ? '✅ मुदत संपली (Matured)' : '⏳ मुदत चालू (Premature)'}
                    </span>
                  </div>
                  {hasLien && (
                    <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-300 flex items-center gap-1 shrink-0">
                      ⚠️ सक्रिय कर्ज बाकी: ₹ {(activeLoansData?.totalOutstandingLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (बचत खात्यातून कर्ज वसुली करावी)
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {selectedAccount && (() => {
            const principal = selectedAccount.depositAmount;
            const totalMaturity = selectedAccount.maturityAmount && selectedAccount.maturityAmount > selectedAccount.depositAmount
              ? selectedAccount.maturityAmount
              : (selectedAccount.depositAmount + (selectedAccount.legacyAccruedInt || 0));
            const systemAccruedInt = Math.max(0, totalMaturity - principal);

            let interestPayable = 0;
            let clawback = 0;

            if (actionType === 'PrematureClose') {
              const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
              const ledgers = getSchemeLedgers();
              const resolution = resolvePrematureRateDetails(selectedAccount, ledgers?.scheme, actualDays);
              const prematureRate = prematurePreview?.prematureRate ?? resolution.prematureRate;
              const systemRecalcInt = prematurePreview?.recalculatedInterest ?? Math.round((principal * prematureRate * actualDays) / 36500);

              const effInt = (isManualOverride && customPrematureInterest !== '')
                ? (parseFloat(customPrematureInterest) || 0)
                : systemRecalcInt;

              interestPayable = effInt;
              const accruedInt = selectedAccount.legacyAccruedInt || 0;
              clawback = Math.max(0, accruedInt - interestPayable);
            } else {
              const effAccrued = (isManualOverride && customAccruedInterest !== '')
                ? Math.max(0, parseFloat(customAccruedInterest) || 0)
                : systemAccruedInt;
              interestPayable = effAccrued;
            }

            const effOverdue = (actionType !== 'PrematureClose' && isOverdue)
              ? (isManualOverride && customOverdueInterest !== '' ? (parseFloat(customOverdueInterest) || 0) : overdueInterest)
              : 0;

            const netPayout = getTotalFdPayout();
            const totalDr = voucherPreview ? voucherPreview.filter(e => e.drCr === 'Dr').reduce((s, e) => s + e.amount, 0) : 0;
            const totalCr = voucherPreview ? voucherPreview.filter(e => e.drCr === 'Cr').reduce((s, e) => s + e.amount, 0) : 0;
            const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
                {/* ================= LEFT COLUMN: OPERATIONAL WORKSPACE (7 Cols - No Tabs, Minimal Scroll) ================= */}
                <div className="lg:col-span-7 space-y-2">
                  <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-2xs space-y-2.5">
                    {/* SECTION 1: TRANSACTION ACTION SELECTOR */}
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1 mb-2">
                        <h2 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide">
                          <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">१</span>
                          <span>व्यवहाराचा प्रकार व कृती (Transaction Action)</span>
                        </h2>
                        <span className="text-[11px] text-gray-500 font-semibold">
                          {isMatured ? 'ठेव मुदत पूर्ण झालेली आहे' : 'मुदतपूर्व बंद व्यवहार'}
                        </span>
                      </div>

                      {!isMatured ? (
                        /* Premature Close Action Card */
                        <div className="bg-amber-50 border border-amber-300 rounded p-2 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-amber-200 text-amber-900 rounded-full shrink-0">
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-amber-950">⚡ मुदतपूर्व बंद व परतावा (Premature Close & Payout)</span>
                                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
                                  स्वयंचलित निवड
                                </span>
                              </div>
                              <p className="text-[11px] text-amber-900 leading-tight">
                                मुदतपूर्तीपूर्वी बंद करत असल्याने आरबीआय नियमानुसार प्रत्यक्ष पूर्ण केलेल्या कालावधीच्या स्लॅब दरानुसार व्याज पुनर्गणना होईल.
                              </p>
                            </div>
                          </div>
                          {prematurePreview && (
                            <div className="text-right shrink-0 bg-white/90 px-2 py-0.5 rounded border border-amber-200 text-xs">
                              <span className="text-[10px] text-gray-500 block">सवलतीचा लागू दर</span>
                              <strong className="text-amber-900 font-mono text-xs font-black">{prematurePreview.prematureRate}%</strong>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Matured: 2 Side-by-Side Compact Action Cards */
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Action 1: Maturity Payout */}
                          <label className={`p-2 rounded-sm border cursor-pointer transition-all flex items-start gap-2 ${
                            actionType === 'MaturityClose'
                              ? 'border-2 border-emerald-600 bg-emerald-50/70 shadow-2xs ring-1 ring-emerald-500'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}>
                            <input
                              type="radio"
                              name="actionType"
                              value="MaturityClose"
                              checked={actionType === 'MaturityClose'}
                              onChange={(e) => setActionType(e.target.value)}
                              className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-gray-900">
                                  १. मुदतपूर्ती पेमेंट (Maturity Payout)
                                </span>
                                {actionType === 'MaturityClose' && (
                                  <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                                    निवडलेले
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                                मुदत पूर्ण झालेली ठेव रक्कम (मुद्दल + साचलेले व्याज) खातेदारास अदा करणे.
                              </p>
                            </div>
                          </label>

                          {/* Action 2: FD Renewal */}
                          <label className={`p-2 rounded-sm border cursor-pointer transition-all flex items-start gap-2 ${
                            actionType === 'Renewal'
                              ? 'border-2 border-blue-600 bg-blue-50/70 shadow-2xs ring-1 ring-blue-500'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}>
                            <input
                              type="radio"
                              name="actionType"
                              value="Renewal"
                              checked={actionType === 'Renewal'}
                              onChange={(e) => {
                                setActionType(e.target.value);
                                if (!targetSchemeId && schemes.length > 0) {
                                  setTargetSchemeId(selectedAccount?.fdSchemeID || schemes[0].fdSchemeID);
                                }
                              }}
                              className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-xs text-gray-900">
                                  २. मुदत ठेव नूतनीकरण (FD Renewal)
                                </span>
                                {actionType === 'Renewal' && (
                                  <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                                    निवडलेले
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">
                                पुढील कालावधीसाठी नवीन पावतीमध्ये रोलओव्हर (नूतनीकरण) करणे.
                              </p>
                            </div>
                          </label>
                        </div>
                      )}

                      {/* Sub-panel if Renewal Selected */}
                      {actionType === 'Renewal' && (
                        <div className="mt-2 bg-blue-50/60 p-2 rounded border border-blue-200 space-y-1.5 text-xs animate-in fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                            {/* Renewal Type Radio */}
                            <div className="sm:col-span-5">
                              <label className={`${labelClass} !mb-0.5 text-blue-900 text-[11px]`}>नूतनीकरण प्रकार (Renewal Mode) *</label>
                              <div className="grid grid-cols-2 gap-1">
                                <label className={`p-1 rounded border text-center cursor-pointer transition ${
                                  renewalType === 'PrincipalPlusInterest' ? 'bg-blue-600 text-white font-bold border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}>
                                  <input
                                    type="radio"
                                    name="renewalType"
                                    value="PrincipalPlusInterest"
                                    checked={renewalType === 'PrincipalPlusInterest'}
                                    onChange={(e) => setRenewalType(e.target.value)}
                                    className="sr-only"
                                  />
                                  <span className="block text-[10px]">मुद्दल + व्याज (Full Roll)</span>
                                </label>
                                <label className={`p-1 rounded border text-center cursor-pointer transition ${
                                  renewalType === 'PrincipalOnly' ? 'bg-blue-600 text-white font-bold border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}>
                                  <input
                                    type="radio"
                                    name="renewalType"
                                    value="PrincipalOnly"
                                    checked={renewalType === 'PrincipalOnly'}
                                    onChange={(e) => setRenewalType(e.target.value)}
                                    className="sr-only"
                                  />
                                  <span className="block text-[10px]">केवळ मूळ मुद्दल</span>
                                </label>
                              </div>
                            </div>

                            {/* New Scheme Selection */}
                            <div className={isOverdue ? 'sm:col-span-4' : 'sm:col-span-7'}>
                              <label className={`${labelClass} !mb-0.5 text-blue-900 text-[11px]`}>नवीन मुदत ठेव योजना (New Scheme) *</label>
                              <select
                                value={targetSchemeId}
                                onChange={(e) => setTargetSchemeId(parseInt(e.target.value))}
                                className={`${inputClass} font-semibold h-[30px]`}
                                required
                              >
                                {schemes.map(s => (
                                  <option key={s.fdSchemeID} value={s.fdSchemeID}>
                                    {s.schemeName} ({s.interestRate}%, {s.durationMonths} महिने)
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Renewal Effective Date Policy (Overdue handling) */}
                            {isOverdue && (
                              <div className="sm:col-span-3">
                                <label className={`${labelClass} !mb-0.5 text-amber-900 text-[11px]`}>नूतनीकरण प्रभावी दिनांक</label>
                                <select
                                  value={renewalEffectiveFrom}
                                  onChange={(e) => setRenewalEffectiveFrom(e.target.value as 'ClosureDate' | 'MaturityDate')}
                                  className={`${inputClass} font-semibold bg-amber-50 border-amber-300 h-[30px]`}
                                >
                                  <option value="ClosureDate">आजपासून (Closure Date)</option>
                                  <option value="MaturityDate">मुदतपूर्तीपासून (Retroactive)</option>
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SECTION 2: PAYMENT METHOD, SETTLEMENT & NARRATION */}
                    <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                        <h2 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide">
                          <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">२</span>
                          <span>
                            {actionType === 'Renewal' && renewalType === 'PrincipalPlusInterest'
                              ? 'नूतनीकरण नोंदणी तपशील (Renewal Details)'
                              : actionType === 'Renewal'
                              ? 'शिल्लक व्याज परतावा पद्धत व खाती (Interest Payout Settlement)'
                              : 'परतावा पेमेंट पद्धत व खाती (Payout Method & Accounts)'}
                          </span>
                        </h2>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {actionType === 'Renewal' && renewalType === 'PrincipalPlusInterest'
                            ? 'संपूर्ण रक्कम नवीन मुदत ठेवीत रोलओव्हर होईल'
                            : 'पेमेंट पद्धतीनुसार लेजर व शेरा निवडा'}
                        </span>
                      </div>

                      {/* Active Loans Warning Banner (if any) */}
                      {activeLoansData?.hasActiveLoan && (
                        <div className="bg-amber-50 border border-amber-300 rounded p-1.5 text-xs text-amber-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            <b>कर्ज सूचना:</b> या खातेदाराकडे <b>₹{(activeLoansData.totalOutstandingLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b> चे सक्रिय कर्ज बाकी आहे. मुदत ठेवीचा परतावा <u>'बचत खात्यात वर्ग (Transfer)'</u> करून नंतर कर्ज वसुली करावी.
                          </span>
                        </div>
                      )}

                      {/* If Full Roll Renewal, inform user that no cash/bank disbursement is required */}
                      {actionType === 'Renewal' && renewalType === 'PrincipalPlusInterest' ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-950 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            मूळ मुद्दल (₹{principal.toLocaleString()}) + साचलेले व्याज (₹{interestPayable.toLocaleString()}) = <b>₹{(principal + interestPayable + effOverdue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b> संपूर्ण रक्कम नवीन मुदत ठेव पावतीमध्ये जमा होईल. बाह्य रोख/बँक पेआउटची आवश्यकता नाही.
                          </span>
                        </div>
                      ) : (
                        /* Compact Payout Controls Grid */
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                          {/* Col 1 (4 cols): Payment Mode */}
                          <div className="sm:col-span-4">
                            <label className={`${labelClass} !mb-0.5 text-[11px]`}>
                              {actionType === 'Renewal' ? 'व्याज पेमेंट पद्धत (Mode) *' : 'परतावा पेमेंट पद्धत (Mode) *'}
                            </label>
                            <select
                              value={paymentMode}
                              onChange={(e) => setPaymentMode(e.target.value as 'Cash' | 'Bank' | 'Transfer')}
                              className={`${inputClass} font-bold text-gray-900 h-[32px] cursor-pointer text-xs`}
                            >
                              <option value="Cash">💵 रोख (Cash)</option>
                              <option value="Bank">🏦 बँक (Bank)</option>
                              <option value="Transfer">🔄 बचत खात्यात वर्ग (Saving Transfer)</option>
                            </select>
                          </div>

                          {/* Col 2 (4 cols): Payout Ledger / Bank Account / Savings Account */}
                          <div className="sm:col-span-4">
                            {paymentMode === 'Cash' && (
                              <div>
                                <label className={`${labelClass} !mb-0.5 text-gray-700 text-[11px]`}>
                                  परतावा रोख खाते (Cash Ledger)
                                </label>
                                <div className="h-[32px] flex items-center">
                                  <CashLedgerReflectBadge 
                                    branchId={selectedAccount.branchID} 
                                    transactionType="Withdrawal" 
                                    customTitle="रोख खाते (Cash Ledger)"
                                  />
                                </div>
                              </div>
                            )}

                            {paymentMode === 'Bank' && (
                              <div>
                                <label className={`${labelClass} !mb-0.5 text-gray-700 text-[11px]`}>
                                  बँक लेजर निवडा (Bank GL) *
                                </label>
                                <div className="h-[32px]">
                                  <SearchableSelect
                                    options={bankLedgers.map(b => ({
                                      value: b.ledgerID.toString(),
                                      label: `${b.ledgerID} - ${b.ledgerName}`
                                    }))}
                                    value={bankAccountLedgerID.toString()}
                                    onChange={(val: any) => {
                                      const v = typeof val === 'object' && val?.target ? val.target.value : val;
                                      setBankAccountLedgerID(parseInt(String(v || 0)));
                                    }}
                                    placeholder="बँक खाते शोधा..."
                                    disabled={isPassingMode}
                                  />
                                </div>
                              </div>
                            )}

                            {paymentMode === 'Transfer' && (
                              <div>
                                <label className={`${labelClass} !mb-0.5 text-gray-700 text-[11px]`}>
                                  बचत खाते निवडा (Saving Account) *
                                </label>
                                <select
                                  value={selectedSavingAccountId}
                                  onChange={(e) => setSelectedSavingAccountId(e.target.value ? parseInt(e.target.value) : '')}
                                  className={`${inputClass} font-semibold h-[32px] cursor-pointer text-xs`}
                                  required
                                >
                                  <option value="">-- बचत खाते निवडा --</option>
                                  {memberSavingAccounts.map(s => (
                                    <option key={s.savingAccountID} value={s.savingAccountID}>
                                      {s.accountNo} (शिल्लक: ₹{s.currentBalance.toLocaleString()})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Col 3 (4 cols): Narration */}
                          <div className="sm:col-span-4">
                            <label className={`${labelClass} !mb-0.5 text-gray-700 text-[11px]`}>
                              तपशील / शेरा (Narration)
                            </label>
                            <input
                              type="text"
                              value={narration}
                              onChange={(e) => setNarration(e.target.value)}
                              placeholder="उदा. मुदत ठेव परतावा / मुदतपूर्व बंद"
                              className={`${inputClass} h-[32px] text-xs`}
                            />
                          </div>
                        </div>
                      )}

                      {/* Bank Cheque / UTR row if Bank mode */}
                      {paymentMode === 'Bank' && !(actionType === 'Renewal' && renewalType === 'PrincipalPlusInterest') && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-0.5">धनादेश / संदर्भ क्र. (Cheque / UTR)</label>
                            <input
                              type="text"
                              value={chequeNo}
                              onChange={(e) => setChequeNo(e.target.value)}
                              placeholder="उदा. Cheque 123456 / UTR"
                              className={`${inputClass} h-[28px] font-bold text-xs`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-700 mb-0.5">धनादेश तारीख (Cheque Date)</label>
                            <input
                              type="date"
                              value={chequeDate}
                              onChange={(e) => setChequeDate(e.target.value)}
                              className={`${inputClass} h-[28px] text-xs`}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SECTION 3: INTEREST SNAPSHOT & SCHEDULE QUICK ACTIONS */}
                    <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-gray-600 text-[11px]">
                        <span>लागू व्याजदर: <strong className="text-blue-900 font-mono font-bold">{actionType === 'PrematureClose' ? (prematurePreview?.prematureRate ?? selectedAccount.interestRate) : selectedAccount.interestRate}% p.a.</strong></span>
                        <span>•</span>
                        <span>मुदतपूर्ती: <strong className="text-gray-900">{formatDateDisplay(selectedAccount.maturityDate)}</strong></span>
                        {isOverdue && (
                          <>
                            <span>•</span>
                            <span className="text-amber-800 font-bold">ओव्हरड्यू: {overdueDays} दिवस</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowInlineSchedule(!showInlineSchedule)}
                          className="text-[11px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 transition-colors shadow-2xs"
                        >
                          <BookOpen className="w-3 h-3 text-blue-600" />
                          <span>{showInlineSchedule ? 'शेड्युल लपवा ▲' : 'शेड्युल तक्ता पाहा ▼'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsScheduleModalOpen(true)}
                          className="text-[11px] text-gray-700 hover:text-gray-900 font-bold flex items-center gap-1 cursor-pointer bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded border border-gray-300 transition-colors shadow-2xs"
                        >
                          <span>🖨️ प्रिंट वेळापत्रक</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Interest Schedule Accordion (Type-safe with scheduleSummary.periods) */}
                    {showInlineSchedule && scheduleSummary && (
                      <div className="bg-slate-50 border border-slate-200 rounded p-2 space-y-1.5 text-xs animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-800 text-[11px]">
                            📊 कालावधीनिहाय व्याज आकारणी वेळापत्रक (Interest Accrual Schedule)
                          </span>
                          <span className="text-[10px] text-gray-500">
                            एकूण टप्पे: {scheduleSummary.periods.length}
                          </span>
                        </div>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded bg-white">
                          <table className="w-full border-collapse text-[11px]">
                            <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold sticky top-0">
                              <tr>
                                <th className="p-1 text-left">टप्पा</th>
                                <th className="p-1 text-center">कालावधी</th>
                                <th className="p-1 text-center">दिवस</th>
                                <th className="p-1 text-right">आरंभी शिल्लक (₹)</th>
                                <th className="p-1 text-right">व्याज (₹)</th>
                                <th className="p-1 text-right">अंतिम शिल्लक (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {scheduleSummary.periods.map((q, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="p-1 font-bold text-gray-800">{q.periodLabel}</td>
                                  <td className="p-1 text-center text-gray-600">{q.fromDate} ते {q.toDate}</td>
                                  <td className="p-1 text-center font-mono">{q.days}</td>
                                  <td className="p-1 text-right font-mono">₹{q.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-1 text-right font-mono font-bold text-blue-900">+₹{q.interestAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td className="p-1 text-right font-mono font-bold text-emerald-900">₹{q.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ================= RIGHT COLUMN: STICKY REAL-TIME COCKPIT (5 Cols) ================= */}
                <div className="lg:col-span-5 space-y-2.5 sticky top-2">
                  {/* Card 1: Live Financial Settlement Card */}
                  <div className="bg-white p-3 rounded-sm border border-slate-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <h3 className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
                        <Scale className="w-4 h-4 text-primary" />
                        <span>थेट सेटलमेंट सारांश (Live Cockpit)</span>
                      </h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                        isMatured ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}>
                        {isMatured ? 'मुदत संपली' : 'मुदतपूर्व बंद'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs font-medium divide-y divide-slate-100">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-600">ठेव मुद्दल (Principal):</span>
                        <span className="font-mono font-bold text-gray-900 text-xs">
                          ₹ {principal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 text-blue-900">
                        <span>{actionType === 'PrematureClose' ? 'सवलतीचे देय व्याज:' : 'करारानुसार साचलेले व्याज:'}</span>
                        <span className="font-mono font-bold text-xs">
                          + ₹ {interestPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {actionType === 'PrematureClose' && clawback > 0 && (
                        <div className="flex justify-between items-center py-1 text-rose-700">
                          <span>जादा व्याज कपात (Clawback):</span>
                          <span className="font-mono font-bold text-xs">
                            - ₹ {clawback.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      {effOverdue > 0 && (
                        <div className="flex justify-between items-center py-1 text-amber-800">
                          <span>ओव्हरड्यू व्याज ({overdueDays} दिवस):</span>
                          <span className="font-mono font-bold text-xs">
                            + ₹ {effOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Net Payout Banner Box */}
                    <div className="bg-emerald-50 border-2 border-emerald-500 rounded p-2 text-center shadow-xs">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                        {actionType === 'Renewal'
                          ? (renewalType === 'PrincipalPlusInterest' ? 'नवीन मुदत ठेव रक्कम (Full Roll)' : 'नवीन ठेव मुद्दल')
                          : 'अंतिम देय रक्कम (Net Payable Payout)'}
                      </span>
                      <div className="text-lg font-mono font-black text-emerald-950 tracking-tight mt-0.5">
                        ₹ {(actionType === 'Renewal' && renewalType === 'PrincipalPlusInterest' ? (principal + interestPayable + effOverdue) : netPayout).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                        {actionType === 'Renewal' ? 'नवीन मुदत ठेव पावतीमध्ये जमा होईल' : `पेमेंट पद्धत: ${paymentMode}`}
                      </span>
                    </div>

                    {/* Active Loans Caution Badge */}
                    {activeLoansData?.hasActiveLoan && (
                      <div className="text-[11px] bg-amber-50 text-amber-900 border border-amber-300 rounded p-1.5 flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>सक्रिय कर्ज बाकी: ₹{(activeLoansData.totalOutstandingLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Accounting Preview (Voucher Table & Manual Override) */}
                  {voucherPreview && (
                    <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-primary uppercase">व्हाउचर स्थिती</h3>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            isBalanced ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-red-100 text-red-900 border-red-300'
                          }`}>
                            {isBalanced ? 'संतुलित ✅' : 'असंतुलित ⚠️'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowVoucherPreview(!showVoucherPreview)}
                          className="text-[11px] text-blue-700 hover:text-blue-900 font-bold cursor-pointer"
                        >
                          {showVoucherPreview ? 'नोंदी लपवा ▲' : 'नोंदी पाहा ▼'}
                        </button>
                      </div>

                      {/* Voucher Table Drawer */}
                      {showVoucherPreview && (
                        <div className="border border-slate-200 rounded overflow-hidden max-h-52 overflow-y-auto">
                          <table className="w-full border-collapse text-[11px]">
                            <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold sticky top-0 border-b border-slate-200">
                              <tr>
                                <th className="py-1 px-1.5 text-center w-12">Dr/Cr</th>
                                <th className="py-1 px-1.5 text-left">खाते (Ledger)</th>
                                <th className="py-1 px-1.5 text-right w-24">रक्कम (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {voucherPreview.map((entry, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="py-1 px-1.5 text-center">
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                      entry.drCr === 'Dr' ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'
                                    }`}>
                                      {entry.drCr}
                                    </span>
                                  </td>
                                  <td className="py-1 px-1.5 font-bold text-gray-800 truncate max-w-[140px]" title={entry.ledgerName}>
                                    {entry.ledgerName}
                                  </td>
                                  <td className="py-1 px-1.5 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                                    ₹ {entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200 font-mono text-[10px]">
                              <tr>
                                <td colSpan={2} className="py-1 px-1.5 text-left font-bold text-gray-700">
                                  Dr: ₹ {totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-1 px-1.5 text-right font-bold text-emerald-900">
                                  Cr: ₹ {totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Manual Amount Override Accordion */}
                      <div className="pt-1 border-t border-slate-100">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px]">
                          <input
                            type="checkbox"
                            checked={isManualOverride}
                            onChange={(e) => {
                              const willEnable = e.target.checked;
                              setIsManualOverride(willEnable);
                              if (!willEnable) {
                                handleResetManualOverride();
                              } else {
                                if (actionType === 'PrematureClose') {
                                  if (!customPrematureInterest) {
                                    const actualDays = Math.max(1, Math.floor((new Date(closureDate).getTime() - new Date(selectedAccount.openingDate).getTime()) / (1000 * 60 * 60 * 24)));
                                    const ledgers = getSchemeLedgers();
                                    const resolution = resolvePrematureRateDetails(selectedAccount, ledgers?.scheme, actualDays);
                                    const prematureRate = prematurePreview?.prematureRate ?? resolution.prematureRate;
                                    const systemRecalcInt = prematurePreview?.recalculatedInterest ?? Math.round((principal * prematureRate * actualDays) / 36500);
                                    setCustomPrematureInterest(systemRecalcInt.toString());
                                  }
                                } else {
                                  if (!customAccruedInterest) {
                                    setCustomAccruedInterest(systemAccruedInt.toString());
                                  }
                                  if (isOverdue && !customOverdueInterest) {
                                    setCustomOverdueInterest(overdueInterest.toString());
                                  }
                                }
                              }
                            }}
                            className="w-3.5 h-3.5 text-amber-600 rounded border-amber-400 focus:ring-amber-500 cursor-pointer"
                          />
                          <span className="font-bold text-amber-950 flex items-center gap-1">
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            रक्कम मॅन्युअल बदल (Manual Override)
                          </span>
                        </label>

                        {isManualOverride && (
                          <div className="bg-amber-50 border border-amber-300 rounded p-2 mt-1.5 space-y-1.5 text-xs animate-in fade-in">
                            <div className="flex flex-wrap items-center gap-2">
                              {actionType === 'PrematureClose' ? (
                                <div className="flex-1 min-w-[120px]">
                                  <label className="text-[10px] font-bold text-gray-700 block">मुदतपूर्व व्याज (₹):</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={customPrematureInterest}
                                    onChange={(e) => setCustomPrematureInterest(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full text-right font-mono font-bold text-xs bg-white border border-amber-400 rounded px-2 py-0.5 text-gray-900"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1 min-w-[100px]">
                                    <label className="text-[10px] font-bold text-gray-700 block">देणे व्याज (₹):</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={customAccruedInterest}
                                      onChange={(e) => setCustomAccruedInterest(e.target.value)}
                                      placeholder="0.00"
                                      className="w-full text-right font-mono font-bold text-xs bg-white border border-amber-400 rounded px-2 py-0.5 text-gray-900"
                                    />
                                  </div>
                                  {isOverdue && (
                                    <div className="flex-1 min-w-[100px]">
                                      <label className="text-[10px] font-bold text-gray-700 block">ओव्हरड्यू व्याज (₹):</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={customOverdueInterest}
                                        onChange={(e) => setCustomOverdueInterest(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full text-right font-mono font-bold text-xs bg-white border border-amber-400 rounded px-2 py-0.5 text-gray-900"
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-amber-950 mb-0.5">
                                बदलाचे कारण / शेरा *
                              </label>
                              <input
                                type="text"
                                value={manualOverrideReason}
                                onChange={(e) => setManualOverrideReason(e.target.value)}
                                placeholder="उदा. जुन्या पावतीनुसार रकमेची जुळवणी"
                                className="w-full text-xs border border-amber-400 rounded px-2 py-0.5 bg-white text-gray-900 font-medium"
                                required
                              />
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={handleResetManualOverride}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded shadow-2xs transition cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" />
                                पूर्ववत करा
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card 3: Sticky Action Execution Buttons */}
                  <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-2xs space-y-2">
                    {isPassingMode ? (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={handlePassVoucher}
                          disabled={passingActionLoading}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <span>✅</span> {passingActionLoading ? 'मंजूर होत आहे...' : 'मंजूर व पास करा (Pass Voucher)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectModalOpen(true)}
                          disabled={passingActionLoading}
                          className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-xs text-xs flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-50"
                        >
                          <span>❌</span> नामंजूर करा (Reject)
                        </button>
                      </div>
                    ) : (
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
                        className={`w-full py-2.5 rounded font-bold text-xs shadow-sm transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
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
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/20'
                        }`}
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>प्रक्रिया सुरू आहे...</span>
                          </>
                        ) : actionType === 'PrematureClose' ? (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>⚡ मुदतपूर्व परतावा करा (Submit Premature)</span>
                          </>
                        ) : actionType === 'Renewal' ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>🔄 मुदत ठेव नूतनीकरण करा (Submit Renewal)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>✔️ मुदतपूर्ती पेमेंट करा (Submit Payout)</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Secondary utility buttons */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <span>🖨️</span>
                        <span>व्याज वेळापत्रक</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAccId(0);
                          setSelectedAccount(null);
                          handleResetManualOverride();
                        }}
                        className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <span>🔄 पूर्ववत (Reset)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {!selectedAccount && (
            <div className="bg-white rounded-sm border border-dashed border-slate-300 p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto text-lg font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-gray-800">कोणतेही मुदत ठेव खाते निवडलेले नाही</h3>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                कृपया वरील शोध पट्टीमधून खाते क्रमांक, पावती क्रमांक, खातेदाराचे नाव किंवा CIF प्रविष्ट करून मुदत ठेव निवडा.
              </p>
            </div>
          )}
        </fieldset>
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
                              {acc.accountNo}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {acc.status || 'Active'}
                            </span>
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
    </div>
  );
};

export default FdWithdrawalMaturity;

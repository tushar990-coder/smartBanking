import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Landmark,
  Coins,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  TrendingUp,
  AlertTriangle,
  Search,
  Calendar,
  Lock,
  Unlock,
  Scale,
  BookOpen,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';

interface InvestmentAccountItem {
  investmentAccountID: number;
  branchID: number;
  branchName?: string;
  investmentInstitutionID: number;
  institutionName: string;
  schemeID: number;
  schemeName: string;
  schemeCode?: string;
  investmentType: string;
  durationType?: string;
  durationMonths: number;
  durationDays?: number | null;
  prematureWithdrawalRate?: number;
  interestCalculationMethod?: string;
  investmentAssetLedgerID?: number | null;
  interestIncomeLedgerID?: number | null;
  interestReceivableLedgerID?: number | null;
  tdsLedgerID?: number | null;
  investmentNo: string;
  oldInvestmentNo?: string | null;
  depositReceiptNo?: string | null;
  investmentDate: string;
  principalAmount: number;
  interestRate: number;
  maturityDate: string;
  expectedMaturityAmount: number;
  accruedInterestTillMigration?: number;
  accruedInterest?: number;
  receivedInterest?: number;
  interestReceivable?: number;
  lastAccrualDate?: string | null;
  pendingAccruedInterest?: number;
  pendingAccrualCount?: number;
  reversedPostingInterest?: number;
  clawbackAmount?: number;
  reversalMode?: string | null;
  bookValue: number;
  status: string;
}

interface FormRowProps {
  label: string;
  required?: boolean;
  align?: 'center' | 'start';
  hint?: string;
  children: React.ReactNode;
}

const FormRow: React.FC<FormRowProps> = ({ label, required, align = 'center', hint, children }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-2.5 ${align === 'start' ? 'items-start' : 'items-center'}`}>
    <label className={`sm:col-span-4 text-[11.5px] font-semibold text-slate-700 ${align === 'start' ? 'sm:pt-1.5' : ''}`}>
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      {hint && <span className="block text-[9.5px] font-normal text-slate-400 leading-tight">{hint}</span>}
    </label>
    <div className="sm:col-span-8 min-w-0">{children}</div>
  </div>
);

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const InvestmentMaturityClaim: React.FC = () => {
  const { user } = useAuth();
  const getLocalTodayStr = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  };
  const todayStr = getLocalTodayStr();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : todayStr;
  const isHOUser =
    user?.role === 'Admin' ||
    user?.role === 'SuperAdmin' ||
    user?.role === 'HeadOffice' ||
    user?.role === 'HO_Manager';

  const [allowDateOverride, setAllowDateOverride] = useState(false);
  const [txnDate, setTxnDate] = useState<string>(activeBusinessDate);

  const [accounts, setAccounts] = useState<InvestmentAccountItem[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [voucherMappings, setVoucherMappings] = useState<any[]>([]);

  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [activeMode, setActiveMode] = useState<'maturity' | 'premature' | 'renewal'>('maturity');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showVoucherPreview, setShowVoucherPreview] = useState(true);

  // Mode 1: Maturity state
  const [matPrincipal, setMatPrincipal] = useState<number>(0);
  const [matInterest, setMatInterest] = useState<number>(0);
  const [matTds, setMatTds] = useState<number>(0);

  // Mode 2: Premature state
  const [prePrincipalPaid, setPrePrincipalPaid] = useState<number>(0);
  const [preRevisedRate, setPreRevisedRate] = useState<number>(0);
  const [preInterestPaid, setPreInterestPaid] = useState<number>(0);
  const [isPreInterestManual, setIsPreInterestManual] = useState<boolean>(false);
  const [prePenalty, setPrePenalty] = useState<number>(0);
  const [preTds, setPreTds] = useState<number>(0);
  const [enablePostingReversal, setEnablePostingReversal] = useState<boolean>(false);
  const [reversalMode, setReversalMode] = useState<'ReceivableReversal' | 'PayoutDeduction'>('ReceivableReversal');
  const [reversePostingAmount, setReversePostingAmount] = useState<number>(0);
  const [reversePostingInput, setReversePostingInput] = useState<string>('');
  const [isReverseAmtManual, setIsReverseAmtManual] = useState<boolean>(false);
  const [reversalDebitLedgerID, setReversalDebitLedgerID] = useState<number>(0);
  const [postingCreditLedgerID, setPostingCreditLedgerID] = useState<number>(0);

  const syncReversePostingAmount = (amount: number, explicitText?: string) => {
    const clean = Math.max(0, round2(amount || 0));
    setReversePostingAmount(clean);
    setReversePostingInput(explicitText !== undefined ? explicitText : clean > 0 ? String(clean) : '');
  };

  // Mode 3: Renewal state
  const [renewalType, setRenewalType] = useState<'PrincipalOnly' | 'PrincipalAndInterest'>('PrincipalOnly');
  const [newSchemeID, setNewSchemeID] = useState<number>(0);
  const [renewalDurationType, setRenewalDurationType] = useState<'Months' | 'Days'>('Months');
  const [renewalDurationValue, setRenewalDurationValue] = useState<number>(12);
  const [newInterestRate, setNewInterestRate] = useState<number>(0);
  const [newDepositReceiptNo, setNewDepositReceiptNo] = useState<string>('');
  const [renewalAmount, setRenewalAmount] = useState<number>(0);
  const [isRenewalAmtManual, setIsRenewalAmtManual] = useState<boolean>(false);
  const [renInterestPayout, setRenInterestPayout] = useState<number>(0);
  const [renTds, setRenTds] = useState<number>(0);

  // Shared settlement & TDS controls
  const [tdsLedgerID, setTdsLedgerID] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'Bank' | 'Cash'>('Bank');
  const [bankLedgerID, setBankLedgerID] = useState<number>(0);
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [narration, setNarration] = useState<string>('');

  const API_URL = '/api';

  useEffect(() => {
    if (user?.businessDate) {
      setTxnDate(user.businessDate.split('T')[0]);
    }
  }, [user?.businessDate]);

  useEffect(() => {
    fetchAccounts();
    fetchSchemes();
    fetchLedgers();
    fetchVoucherMappings();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/InvestmentAccounts?status=Active`);
      const allAccs: InvestmentAccountItem[] = Array.isArray(res.data) ? res.data : [];
      const depositAccs = allAccs.filter((a) => a.investmentType !== 'Share' && a.durationMonths !== 0);
      setAccounts(depositAccs);
    } catch {
      // handled gracefully
    } finally {
      setLoading(false);
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentSchemes`);
      const list = (Array.isArray(res.data) ? res.data : []).filter((s: any) => s.investmentType !== 'Share');
      setSchemes(list);
    } catch {}
  };

  const fetchLedgers = async () => {
    try {
      const res = await axios.get(`${API_URL}/Ledgers`);
      setLedgers(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const fetchVoucherMappings = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentAccounts/VoucherMappings`);
      setVoucherMappings(Array.isArray(res.data) ? res.data : []);
    } catch {}
  };

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.investmentAccountID === Number(selectedAccountId)) || null,
    [accounts, selectedAccountId]
  );

  const calcElapsedDays = (invDateStr?: string, closeDateStr?: string) => {
    if (!invDateStr || !closeDateStr) return 0;
    const d1 = new Date(invDateStr.split('T')[0]);
    const d2 = new Date(closeDateStr.split('T')[0]);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
    return Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  };

  const computeAutoPrematureInterest = (principal: number, rate: number, days: number) => {
    if (principal <= 0 || rate <= 0 || days <= 0) return 0;
    return round2((principal * rate * days) / 36500);
  };

  const initializeAccountDefaults = (acc: InvestmentAccountItem, effectiveDate: string) => {
    const principal = Number(acc.principalAmount || 0);
    const expectedTotal = Number(acc.expectedMaturityAmount || principal);
    const expectedInt = round2(Math.max(0, expectedTotal - principal));

    const matchedScheme = schemes.find((s) => Number(s.schemeID) === Number(acc.schemeID));
    const defaultTdsLedger = Number(acc.tdsLedgerID || matchedScheme?.tdsLedgerID || 0);
    const branchMap = voucherMappings.find(
      (m: any) =>
        Number(m.branchID || m.BranchID) === Number(acc.branchID) &&
        (!m.investmentType || m.investmentType === acc.investmentType)
    );

    const matDateClean = acc.maturityDate ? acc.maturityDate.split('T')[0] : '';
    const isBeforeMaturity = Boolean(matDateClean && effectiveDate < matDateClean);
    setActiveMode(isBeforeMaturity ? 'premature' : 'maturity');

    // Maturity defaults
    setMatPrincipal(principal);
    setMatInterest(expectedInt);
    setMatTds(0);

    // Premature defaults
    const schemePremRate = Number(acc.prematureWithdrawalRate ?? matchedScheme?.prematureWithdrawalRate ?? 0);
    const defaultPremRate = schemePremRate > 0 ? schemePremRate : Math.max(0, round2((acc.interestRate || 0) - 1));
    const daysHeld = calcElapsedDays(acc.investmentDate, effectiveDate);
    const initPreInterest = computeAutoPrematureInterest(principal, defaultPremRate, daysHeld);
    setPrePrincipalPaid(principal);
    setPreRevisedRate(defaultPremRate);
    setPreInterestPaid(initPreInterest);
    setIsPreInterestManual(false);
    setPrePenalty(0);
    setPreTds(0);

    const standingRecv = round2(acc.interestReceivable || 0);
    const autoExcessRev = round2(Math.max(0, standingRecv - Math.min(initPreInterest, standingRecv)));
    const defaultRevDrId = Number(acc.interestIncomeLedgerID || branchMap?.interestIncomeLedgerID || 0);
    const defaultPostCrId = Number(acc.interestReceivableLedgerID || branchMap?.interestReceivableLedgerID || 0);

    setEnablePostingReversal(autoExcessRev > 0);
    setReversalMode('ReceivableReversal');
    syncReversePostingAmount(autoExcessRev);
    setIsReverseAmtManual(false);
    setReversalDebitLedgerID(defaultRevDrId);
    setPostingCreditLedgerID(defaultPostCrId);

    // Renewal defaults
    const targetScheme = matchedScheme || schemes[0] || null;
    const durType: 'Months' | 'Days' =
      (targetScheme?.durationType || acc.durationType || 'Months').toLowerCase() === 'days' ? 'Days' : 'Months';
    const durVal =
      durType === 'Days'
        ? Number(targetScheme?.durationDays || acc.durationDays || 365)
        : Number(targetScheme?.durationMonths || acc.durationMonths || 12);

    setRenewalType('PrincipalOnly');
    setNewSchemeID(Number(acc.schemeID || targetScheme?.schemeID || 0));
    setRenewalDurationType(durType);
    setRenewalDurationValue(durVal > 0 ? durVal : 12);
    setNewInterestRate(Number(targetScheme?.interestRate ?? acc.interestRate ?? 0));
    setNewDepositReceiptNo(acc.depositReceiptNo || '');
    setRenewalAmount(principal);
    setIsRenewalAmtManual(false);
    setRenInterestPayout(expectedInt);
    setRenTds(0);

    setTdsLedgerID(defaultTdsLedger);
    setReferenceNo('');
    setNarration('');
  };

  const handleSelectAccount = (accountId: number) => {
    setError('');
    setSuccess('');
    setSelectedAccountId(accountId);
    const acc = accounts.find((a) => a.investmentAccountID === accountId);
    if (acc) {
      initializeAccountDefaults(acc, txnDate);
    }
  };

  // Recalculate auto premature interest when txnDate or preRevisedRate changes (unless manually edited)
  useEffect(() => {
    if (!selectedAccount || isPreInterestManual) return;
    const days = calcElapsedDays(selectedAccount.investmentDate, txnDate);
    setPreInterestPaid(computeAutoPrematureInterest(selectedAccount.principalAmount || 0, preRevisedRate, days));
  }, [selectedAccount, txnDate, preRevisedRate, isPreInterestManual]);

  // Keep auto-reversal amount synced when in ReceivableReversal mode and not manually edited
  useEffect(() => {
    if (!selectedAccount || !enablePostingReversal || reversalMode !== 'ReceivableReversal' || isReverseAmtManual) {
      return;
    }
    const standing = round2(selectedAccount.interestReceivable || 0);
    const autoExcess = round2(Math.max(0, standing - Math.min(preInterestPaid || 0, standing)));
    syncReversePostingAmount(autoExcess);
  }, [selectedAccount, preInterestPaid, enablePostingReversal, reversalMode, isReverseAmtManual]);

  // Recalculate renewal amount when renewalType or renTds changes (unless manually edited)
  useEffect(() => {
    if (!selectedAccount || isRenewalAmtManual) return;
    const principal = Number(selectedAccount.principalAmount || 0);
    const expectedInt = Math.max(0, Number(selectedAccount.expectedMaturityAmount || principal) - principal);
    if (renewalType === 'PrincipalAndInterest') {
      setRenewalAmount(round2(Math.max(0, principal + expectedInt - (renTds || 0))));
    } else {
      setRenewalAmount(principal);
    }
  }, [selectedAccount, renewalType, renTds, isRenewalAmtManual]);

  const elapsedDays = useMemo(
    () => (selectedAccount ? calcElapsedDays(selectedAccount.investmentDate, txnDate) : 0),
    [selectedAccount, txnDate]
  );

  const isBeforeInvestmentDate = useMemo(() => {
    if (!selectedAccount?.investmentDate || !txnDate) return false;
    return txnDate < selectedAccount.investmentDate.split('T')[0];
  }, [selectedAccount, txnDate]);

  const isFutureDate = useMemo(() => Boolean(txnDate && txnDate > todayStr), [txnDate, todayStr]);

  const isPrematureByDate = useMemo(() => {
    if (!selectedAccount?.maturityDate || !txnDate) return false;
    return txnDate < selectedAccount.maturityDate.split('T')[0];
  }, [selectedAccount, txnDate]);

  // Ledger helper lookup
  const getLedgerDisplayName = (ledgerId?: number | null, fallbackName = 'संबंधित जी.एल. लेजर') => {
    if (!ledgerId || ledgerId <= 0) return fallbackName;
    const found = ledgers.find((l: any) => Number(l.ledgerID || l.LedgerID) === Number(ledgerId));
    if (!found) return `GL #${ledgerId} (${fallbackName})`;
    const code = found.ledgerCode || found.LedgerCode || ledgerId;
    const name = found.ledgerName || found.LedgerName || fallbackName;
    return `${code} - ${name}`;
  };

  const resolvedOldGlIds = useMemo(() => {
    if (!selectedAccount) {
      return { assetId: 0, incomeId: 0, receivableId: 0 };
    }
    const branchMap = voucherMappings.find(
      (m: any) =>
        Number(m.branchID || m.BranchID) === Number(selectedAccount.branchID) &&
        (!m.investmentType || m.investmentType === selectedAccount.investmentType)
    );
    return {
      assetId: Number(selectedAccount.investmentAssetLedgerID || branchMap?.investmentLedgerID || 0),
      incomeId: Number(selectedAccount.interestIncomeLedgerID || branchMap?.interestIncomeLedgerID || 0),
      receivableId: Number(selectedAccount.interestReceivableLedgerID || branchMap?.interestReceivableLedgerID || 0)
    };
  }, [selectedAccount, voucherMappings]);

  useEffect(() => {
    if (!selectedAccount) return;
    if (reversalDebitLedgerID === 0 && resolvedOldGlIds.incomeId > 0) {
      setReversalDebitLedgerID(resolvedOldGlIds.incomeId);
    }
    if (postingCreditLedgerID === 0 && resolvedOldGlIds.receivableId > 0) {
      setPostingCreditLedgerID(resolvedOldGlIds.receivableId);
    }
  }, [selectedAccount, resolvedOldGlIds.incomeId, resolvedOldGlIds.receivableId, reversalDebitLedgerID, postingCreditLedgerID]);

  // Renewal live maturity preview
  const renewalPreview = useMemo(() => {
    if (!selectedAccount) return null;
    const targetScheme = schemes.find((s) => Number(s.schemeID) === Number(newSchemeID));
    const calcMethod = targetScheme?.interestCalculationMethod || selectedAccount.interestCalculationMethod || 'Simple';
    const p = Number(renewalAmount || 0);
    const r = Number(newInterestRate || 0);
    const durVal = Math.max(1, Number(renewalDurationValue || 1));

    const startDt = new Date(txnDate);
    const matDt = new Date(txnDate);
    if (!isNaN(startDt.getTime())) {
      if (renewalDurationType === 'Days') {
        matDt.setDate(matDt.getDate() + durVal);
      } else {
        matDt.setMonth(matDt.getMonth() + durVal);
      }
    }

    let expectedMat = p;
    if (p > 0 && r > 0) {
      if (calcMethod.toLowerCase() === 'cumulative') {
        const tYears = renewalDurationType === 'Days' ? durVal / 365.0 : durVal / 12.0;
        expectedMat = round2(p * Math.pow(1 + r / 400.0, 4 * tYears));
      } else {
        const interest = renewalDurationType === 'Days' ? (p * r * durVal) / 36500.0 : (p * r * durVal) / 1200.0;
        expectedMat = round2(p + interest);
      }
    }

    const matIso = !isNaN(matDt.getTime())
      ? `${matDt.getFullYear()}-${String(matDt.getMonth() + 1).padStart(2, '0')}-${String(matDt.getDate()).padStart(2, '0')}`
      : '';

    return {
      schemeName: targetScheme?.schemeName || selectedAccount.schemeName,
      calcMethod,
      newMaturityIso: matIso,
      expectedMaturityAmount: expectedMat,
      expectedInterest: round2(Math.max(0, expectedMat - p))
    };
  }, [selectedAccount, schemes, newSchemeID, renewalAmount, newInterestRate, renewalDurationType, renewalDurationValue, txnDate]);

  // Core live settlement & double-entry voucher simulation
  const settlement = useMemo(() => {
    if (!selectedAccount) return null;

    const originalPrincipal = round2(selectedAccount.principalAmount || 0);
    const standingReceivable = round2(selectedAccount.interestReceivable || 0);
    const paymentLedgerLabel =
      paymentMode === 'Bank'
        ? bankLedgerID > 0
          ? getLedgerDisplayName(bankLedgerID, 'बँक खाते')
          : 'बँक खाते (Bank GL निवडा)'
        : 'शाखा मुख्य रोख खाते (Cash GL)';

    if (activeMode === 'maturity') {
      const principalIn = round2(matPrincipal || 0);
      const grossInterest = round2(Math.max(0, matInterest || 0));
      const tds = round2(Math.max(0, matTds || 0));
      const netReceipt = round2(principalIn + grossInterest - tds);

      const receivableCleared = Math.min(grossInterest, standingReceivable);
      const accruedReversed = round2(Math.max(0, standingReceivable - receivableCleared));
      const totalReceivableCr = round2(receivableCleared + accruedReversed);
      const freshIncome = round2(Math.max(0, grossInterest - receivableCleared));

      const voucherLines: { drCr: 'Dr' | 'Cr'; ledger: string; note: string; amount: number; isReversal?: boolean }[] = [];
      if (netReceipt > 0) {
        voucherLines.push({ drCr: 'Dr', ledger: paymentLedgerLabel, note: 'मुदतपूर्ती निव्वळ जमा', amount: netReceipt });
      }
      if (tds > 0) {
        voucherLines.push({
          drCr: 'Dr',
          ledger: getLedgerDisplayName(tdsLedgerID, 'TDS कपात जी.एल.'),
          note: 'बँक TDS कपात',
          amount: tds
        });
      }
      if (accruedReversed > 0) {
        voucherLines.push({
          drCr: 'Dr',
          ledger: getLedgerDisplayName(resolvedOldGlIds.incomeId, 'गुंतवणूक व्याज उत्पन्न'),
          note: 'जादा येणे व्याज रिव्हर्सल (Reverse Entry)',
          amount: accruedReversed,
          isReversal: true
        });
      }
      if (principalIn > 0) {
        voucherLines.push({
          drCr: 'Cr',
          ledger: getLedgerDisplayName(resolvedOldGlIds.assetId, 'गुंतवणूक मुद्दल (Asset)'),
          note: 'मुदत ठेव मुद्दल निरंक',
          amount: principalIn
        });
      }
      if (totalReceivableCr > 0) {
        voucherLines.push({
          drCr: 'Cr',
          ledger: getLedgerDisplayName(resolvedOldGlIds.receivableId, 'येणे व्याज गुंतवणुकीवरील'),
          note: accruedReversed > 0 ? `प्राप्त ₹${receivableCleared.toFixed(2)} + रिव्हर्स ₹${accruedReversed.toFixed(2)}` : 'येणे व्याज समायोजन',
          amount: totalReceivableCr
        });
      }
      if (freshIncome > 0) {
        voucherLines.push({
          drCr: 'Cr',
          ledger: getLedgerDisplayName(resolvedOldGlIds.incomeId, 'गुंतवणूक व्याज उत्पन्न'),
          note: 'चालू व्याज उत्पन्न जमा',
          amount: freshIncome
        });
      }

      return {
        originalPrincipal,
        principalReturned: principalIn,
        standingReceivable,
        grossInterest,
        receivableCleared,
        accruedReversed,
        interestClawback: 0,
        payoutDeductionAmount: 0,
        manualPostingReversal: 0,
        sysExtraRev: 0,
        totalReversalDr: accruedReversed,
        freshIncome,
        penalty: 0,
        tds,
        netCashOrBankReceipt: netReceipt,
        newRenewalDeposit: 0,
        voucherLines
      };
    }

    if (activeMode === 'premature') {
      const principalIn = round2(Math.max(0, prePrincipalPaid || 0));
      const grossInterest = round2(Math.max(0, preInterestPaid || 0));
      const penalty = round2(Math.max(0, prePenalty || 0));
      const tds = round2(Math.max(0, preTds || 0));
      const principalClawback = round2(Math.max(0, originalPrincipal - principalIn));
      const effRevDrId = reversalDebitLedgerID > 0 ? reversalDebitLedgerID : resolvedOldGlIds.incomeId;
      const effPostCrId = postingCreditLedgerID > 0 ? postingCreditLedgerID : resolvedOldGlIds.receivableId;

      let receivableCleared = 0;
      let accruedReversed = 0;
      let schemeReceivableCr = 0;
      let postingCreditAmt = 0;
      let freshIncome = 0;
      let payoutDeductionAmount = 0;
      let manualPostingReversal = 0;
      let sysExtraRev = 0;
      let interestClawback = principalClawback;
      let netReceipt = round2(principalIn + grossInterest - penalty - tds);

      if (!enablePostingReversal) {
        receivableCleared = Math.min(grossInterest, standingReceivable);
        accruedReversed = round2(Math.max(0, standingReceivable - receivableCleared));
        schemeReceivableCr = round2(receivableCleared + accruedReversed);
        freshIncome = round2(Math.max(0, grossInterest - receivableCleared));
      } else if (reversalMode === 'ReceivableReversal') {
        const manualRev = round2(Math.max(0, reversePostingAmount || 0));
        manualPostingReversal = manualRev;
        const targetsCustomPostingLedger =
          (postingCreditLedgerID > 0 && postingCreditLedgerID !== resolvedOldGlIds.receivableId) ||
          resolvedOldGlIds.receivableId <= 0;

        if (targetsCustomPostingLedger) {
          receivableCleared = Math.min(grossInterest, standingReceivable);
          sysExtraRev = round2(Math.max(0, standingReceivable - receivableCleared));
          schemeReceivableCr = round2(receivableCleared + sysExtraRev);
          freshIncome = round2(Math.max(0, grossInterest - receivableCleared));
          postingCreditAmt = manualRev;
        } else {
          const remainingRecvForInterest = round2(Math.max(0, standingReceivable - manualRev));
          receivableCleared = Math.min(grossInterest, remainingRecvForInterest);
          sysExtraRev = round2(Math.max(0, standingReceivable - manualRev - receivableCleared));
          freshIncome = round2(Math.max(0, grossInterest - receivableCleared));
          schemeReceivableCr = round2(manualRev + receivableCleared + sysExtraRev);
          postingCreditAmt = 0;
        }
        accruedReversed = round2(manualRev + sysExtraRev);
      } else {
        // PayoutDeduction mode: bank deducts previously credited/posted interest from net bank payout
        const payoutDed = round2(Math.max(0, reversePostingAmount || 0));
        payoutDeductionAmount = payoutDed;
        manualPostingReversal = payoutDed;
        netReceipt = round2(principalIn + grossInterest - payoutDed - penalty - tds);
        receivableCleared = Math.min(grossInterest, standingReceivable);
        sysExtraRev = round2(Math.max(0, standingReceivable - receivableCleared));
        schemeReceivableCr = round2(receivableCleared + sysExtraRev);
        freshIncome = round2(Math.max(0, grossInterest - receivableCleared));
        accruedReversed = sysExtraRev;
        interestClawback = round2(payoutDed + principalClawback);
      }

      const totalReversalDr = round2(accruedReversed + interestClawback);

      const voucherLines: { drCr: 'Dr' | 'Cr'; ledger: string; note: string; amount: number; isReversal?: boolean }[] = [];
      if (netReceipt > 0) {
        voucherLines.push({ drCr: 'Dr', ledger: paymentLedgerLabel, note: 'मुदतपूर्व निव्वळ जमा रक्कम', amount: netReceipt });
      }
      if (tds > 0) {
        voucherLines.push({
          drCr: 'Dr',
          ledger: getLedgerDisplayName(tdsLedgerID, 'TDS कपात जी.एल.'),
          note: 'मुदतपूर्व TDS कपात',
          amount: tds
        });
      }
      if (totalReversalDr > 0) {
        const revNotes: string[] = [];
        if (accruedReversed > 0) revNotes.push(`पोस्टिंग/येणे व्याज रिव्हर्सल ₹${accruedReversed.toFixed(2)}`);
        if (payoutDeductionAmount > 0) revNotes.push(`परतावा पोस्टिंग व्याज वजावट ₹${payoutDeductionAmount.toFixed(2)}`);
        if (principalClawback > 0) revNotes.push(`मुद्दल व्याज कपात ₹${principalClawback.toFixed(2)}`);
        voucherLines.push({
          drCr: 'Dr',
          ledger: getLedgerDisplayName(effRevDrId, 'गुंतवणूक व्याज उत्पन्न / समायोजन (Reverse)'),
          note: revNotes.join(' + ') || 'मुदतपूर्व व्याज रिव्हर्सल एंट्री',
          amount: totalReversalDr,
          isReversal: true
        });
      }
      if (penalty > 0) {
        voucherLines.push({
          drCr: 'Dr',
          ledger: 'गुंतवणूक मुदतपूर्व दंड खर्च / व्याज उत्पन्न',
          note: 'मुदतपूर्व मोडणी दंड',
          amount: penalty
        });
      }
      if (originalPrincipal > 0) {
        voucherLines.push({
          drCr: 'Cr',
          ledger: getLedgerDisplayName(resolvedOldGlIds.assetId, 'गुंतवणूक मुद्दल (Asset)'),
          note: 'संपूर्ण मूळ मुद्दल निरंक (Asset Zero)',
          amount: originalPrincipal
        });
      }
      if (schemeReceivableCr > 0) {
        voucherLines.push({
          drCr: 'Cr',
          ledger: getLedgerDisplayName(resolvedOldGlIds.receivableId, 'येणे व्याज गुंतवणुकीवरील'),
          note: `येणे व्याज समायोजन (प्राप्त ₹${receivableCleared.toFixed(2)} + रिव्हर्स ₹${round2(schemeReceivableCr - receivableCleared).toFixed(2)})`,
          amount: schemeReceivableCr,
          isReversal: enablePostingReversal && reversalMode === 'ReceivableReversal' && postingCreditAmt === 0
        });
      }
      if (postingCreditAmt > 0) {
        voucherLines.push({
          drCr: 'Cr',
          ledger: getLedgerDisplayName(effPostCrId, 'पोस्टिंग व्याज / येणे व्याज (Reverse Cr)'),
          note: 'निवडलेल्या पोस्टिंग व्याज खात्यावर रिव्हर्सल जमा',
          amount: postingCreditAmt,
          isReversal: true
        });
      }
      if (freshIncome > 0) {
        voucherLines.push({
          drCr: 'Cr',
          ledger: getLedgerDisplayName(resolvedOldGlIds.incomeId, 'गुंतवणूक व्याज उत्पन्न'),
          note: 'चालू / अतिरिक्त व्याज उत्पन्न',
          amount: freshIncome
        });
      }

      return {
        originalPrincipal,
        principalReturned: principalIn,
        standingReceivable,
        grossInterest,
        receivableCleared,
        accruedReversed,
        interestClawback,
        payoutDeductionAmount,
        manualPostingReversal,
        sysExtraRev,
        totalReversalDr,
        freshIncome,
        penalty,
        tds,
        netCashOrBankReceipt: netReceipt,
        newRenewalDeposit: 0,
        voucherLines
      };
    }

    // Mode 3: Renewal
    const newPrincipal = round2(Math.max(0, renewalAmount || 0));
    const tds = round2(Math.max(0, renTds || 0));
    const payoutGross = renewalType === 'PrincipalOnly' ? round2(Math.max(0, renInterestPayout || 0)) : 0;
    const netPayoutInterest = renewalType === 'PrincipalOnly' ? round2(Math.max(0, payoutGross - tds)) : 0;
    const principalIncrease = round2(Math.max(0, newPrincipal - originalPrincipal));
    const principalRefund = round2(Math.max(0, originalPrincipal - newPrincipal));
    const totalCashOrBankReceived = round2(principalRefund + netPayoutInterest);
    const totalInterestRecognized = round2(principalIncrease + netPayoutInterest + tds);

    const receivableCleared = Math.min(totalInterestRecognized, standingReceivable);
    const accruedReversed = round2(Math.max(0, standingReceivable - receivableCleared));
    const totalReceivableCr = round2(receivableCleared + accruedReversed);
    const freshIncome = round2(Math.max(0, totalInterestRecognized - receivableCleared));

    const targetSchemeObj = schemes.find((s) => Number(s.schemeID) === Number(newSchemeID));
    const newAssetLedgerId = Number(targetSchemeObj?.investmentAssetLedgerID || resolvedOldGlIds.assetId || 0);

    const voucherLines: { drCr: 'Dr' | 'Cr'; ledger: string; note: string; amount: number; isReversal?: boolean }[] = [];
    if (newPrincipal > 0) {
      voucherLines.push({
        drCr: 'Dr',
        ledger: getLedgerDisplayName(newAssetLedgerId, 'नवीन गुंतवणूक मुद्दल (New Asset)'),
        note: 'नूतनीकृत नवीन ठेव मुद्दल',
        amount: newPrincipal
      });
    }
    if (totalCashOrBankReceived > 0) {
      voucherLines.push({
        drCr: 'Dr',
        ledger: paymentLedgerLabel,
        note: 'नूतनीकरण व्याज / आंशिक मुद्दल परतावा',
        amount: totalCashOrBankReceived
      });
    }
    if (tds > 0) {
      voucherLines.push({
        drCr: 'Dr',
        ledger: getLedgerDisplayName(tdsLedgerID, 'TDS कपात जी.एल.'),
        note: 'नूतनीकरण TDS कपात',
        amount: tds
      });
    }
    if (accruedReversed > 0) {
      voucherLines.push({
        drCr: 'Dr',
        ledger: getLedgerDisplayName(resolvedOldGlIds.incomeId, 'गुंतवणूक व्याज उत्पन्न (Reverse)'),
        note: 'अतिरिक्त येणे व्याज रिव्हर्सल',
        amount: accruedReversed,
        isReversal: true
      });
    }
    if (originalPrincipal > 0) {
      voucherLines.push({
        drCr: 'Cr',
        ledger: getLedgerDisplayName(resolvedOldGlIds.assetId, 'जुनी गुंतवणूक मुद्दल (Old Asset)'),
        note: 'जुनी मुदत ठेव निरंक',
        amount: originalPrincipal
      });
    }
    if (totalReceivableCr > 0) {
      voucherLines.push({
        drCr: 'Cr',
        ledger: getLedgerDisplayName(resolvedOldGlIds.receivableId, 'येणे व्याज गुंतवणुकीवरील'),
        note: 'जुने येणे व्याज समायोजन',
        amount: totalReceivableCr
      });
    }
    if (freshIncome > 0) {
      voucherLines.push({
        drCr: 'Cr',
        ledger: getLedgerDisplayName(resolvedOldGlIds.incomeId, 'गुंतवणूक व्याज उत्पन्न'),
        note: 'नूतनीकरण व्याज उत्पन्न',
        amount: freshIncome
      });
    }

    return {
      originalPrincipal,
      principalReturned: principalRefund,
      standingReceivable,
      grossInterest: totalInterestRecognized,
      receivableCleared,
      accruedReversed,
      interestClawback: 0,
      payoutDeductionAmount: 0,
      manualPostingReversal: 0,
      sysExtraRev: 0,
      totalReversalDr: accruedReversed,
      freshIncome,
      penalty: 0,
      tds,
      netCashOrBankReceipt: totalCashOrBankReceived,
      newRenewalDeposit: newPrincipal,
      voucherLines
    };
  }, [
    selectedAccount,
    activeMode,
    matPrincipal,
    matInterest,
    matTds,
    prePrincipalPaid,
    preInterestPaid,
    prePenalty,
    preTds,
    enablePostingReversal,
    reversalMode,
    reversePostingAmount,
    reversalDebitLedgerID,
    postingCreditLedgerID,
    renewalType,
    renewalAmount,
    renInterestPayout,
    renTds,
    newSchemeID,
    schemes,
    paymentMode,
    bankLedgerID,
    tdsLedgerID,
    resolvedOldGlIds,
    ledgers
  ]);

  const activeTdsAmount =
    activeMode === 'maturity' ? matTds : activeMode === 'premature' ? preTds : renTds;

  const setActiveTdsAmount = (val: number) => {
    const clean = Math.max(0, val || 0);
    if (activeMode === 'maturity') setMatTds(clean);
    else if (activeMode === 'premature') setPreTds(clean);
    else setRenTds(clean);
  };

  const baseLedgerItems = useMemo(
    () =>
      ledgers
        .filter((l: any) => l.isActive !== false && l.IsActive !== false)
        .map((l: any) => {
          const id = Number(l.ledgerID || l.LedgerID || 0);
          const code = l.ledgerCode || l.LedgerCode || id;
          const name = l.ledgerName || l.LedgerName || '';
          const grp = l.accountGroup?.groupName || (typeof l.accountGroup === 'string' ? l.accountGroup : '');
          return {
            value: id,
            label: `${code} - ${name}${grp ? ` (${grp})` : ''}`
          };
        }),
    [ledgers]
  );

  const buildLedgerOptions = (placeholderLabel: string) => [
    { value: 0, label: placeholderLabel },
    ...baseLedgerItems
  ];

  const ledgerOptions = useMemo(
    () => buildLedgerOptions('-- डायनॅमिक TDS / कपात जी.एल. लेजर निवडा --'),
    [baseLedgerItems]
  );
  const reversalDrLedgerOptions = useMemo(
    () => buildLedgerOptions('-- स्कीम डीफॉल्ट व्याज उत्पन्न लेजर (किंवा इतर निवडा) --'),
    [baseLedgerItems]
  );
  const postingCrLedgerOptions = useMemo(
    () => buildLedgerOptions('-- स्कीम येणे व्याज लेजर (किंवा POSTING_INTR निवडा) --'),
    [baseLedgerItems]
  );

  const accountOptions = useMemo(
    () => [
      { value: 0, label: '-- मुदत ठेव खाते, जुना क्र. किंवा पावती क्र. निवडा --' },
      ...accounts.map((a) => {
        const oldPart = a.oldInvestmentNo ? ` [जुना: ${a.oldInvestmentNo}]` : '';
        const recPart = a.depositReceiptNo ? ` | पावती: ${a.depositReceiptNo}` : '';
        return {
          value: a.investmentAccountID,
          label: `${a.investmentNo}${oldPart}${recPart} | ${a.institutionName} (${a.schemeName}) | ₹${(a.principalAmount || 0).toLocaleString('en-IN')} @ ${a.interestRate}% | मुदत: ${formatDate(a.maturityDate)}`
        };
      })
    ],
    [accounts]
  );

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return '-';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB');
  }

  const fmt = (n: number) =>
    (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedAccount || !settlement) {
      setError('कृपया प्रथम गुंतवणूक मुदत ठेव खाते निवडा.');
      return;
    }
    if (isBeforeInvestmentDate) {
      setError(`व्यवहार तारीख (${formatDate(txnDate)}) ही ठेव तारखेपेक्षा (${formatDate(selectedAccount.investmentDate)}) आधीची असू शकत नाही.`);
      return;
    }
    if (isFutureDate) {
      setError('भविष्यातील व्यवहार तारीख अनुज्ञेय नाही.');
      return;
    }
    if (activeTdsAmount > 0 && (!tdsLedgerID || Number(tdsLedgerID) <= 0)) {
      setError('TDS कपात रक्कम नोंदवण्यासाठी कृपया डायनॅमिक TDS जी.एल. लेजर निवडा.');
      return;
    }
    if (activeMode === 'premature' && enablePostingReversal) {
      if ((reversePostingAmount || 0) <= 0) {
        setError('बँकेचे पोस्टिंग व्याज रिव्हर्सल चालू असल्यास कृपया ₹0 पेक्षा जास्त रक्कम प्रविष्ट करा.');
        return;
      }
      const effDrId = reversalDebitLedgerID > 0 ? reversalDebitLedgerID : resolvedOldGlIds.incomeId;
      const effCrId = postingCreditLedgerID > 0 ? postingCreditLedgerID : resolvedOldGlIds.receivableId;
      if (reversalMode === 'ReceivableReversal' && effDrId > 0 && effCrId > 0 && effDrId === effCrId) {
        setError('रिव्हर्सल नावे (Dr) आणि पोस्टिंग व्याज जमा (Cr) जी.एल. लेजर एकच असू शकत नाही.');
        return;
      }
    }
    if (settlement.netCashOrBankReceipt < 0) {
      setError('पोस्टिंग व्याज वजावट, दंड व TDS कपात रक्कम ही एकूण मुद्दल व व्याजापेक्षा जास्त असू शकत नाही.');
      return;
    }
    if (
      settlement.netCashOrBankReceipt > 0 &&
      paymentMode === 'Bank' &&
      (!bankLedgerID || Number(bankLedgerID) <= 0)
    ) {
      setError('बँक जमा व्यवहारासाठी कृपया बँक जी.एल. खाते (Bank GL) निवडा.');
      return;
    }

    setSaving(true);
    try {
      if (activeMode === 'maturity') {
        const res = await axios.post(`${API_URL}/InvestmentAccounts/Maturity`, {
          investmentAccountID: selectedAccount.investmentAccountID,
          maturityDate: txnDate,
          principalReceived: matPrincipal,
          interestReceived: matInterest,
          tdsAmount: matTds || 0,
          tdsLedgerID: (matTds || 0) > 0 ? Number(tdsLedgerID) : null,
          totalReceived: settlement.netCashOrBankReceipt,
          paymentMode,
          bankLedgerID: paymentMode === 'Bank' ? Number(bankLedgerID) : null,
          referenceNo: referenceNo.trim() || null,
          narration: narration.trim() || null
        });
        setSuccess(
          `✅ ${res.data?.message || 'मुदतपूर्ती यशस्वी!'} ${res.data?.voucherNo ? `(व्हाउचर क्र.: ${res.data.voucherNo})` : ''}`
        );
      } else if (activeMode === 'premature') {
        if (prePrincipalPaid > selectedAccount.principalAmount) {
          setError('परत मिळालेले मुद्दल हे मूळ गुंतवलेल्या मुद्दलापेक्षा जास्त असू शकत नाही.');
          setSaving(false);
          return;
        }
        const res = await axios.post(`${API_URL}/InvestmentAccounts/PrematureWithdraw`, {
          investmentAccountID: selectedAccount.investmentAccountID,
          withdrawalDate: txnDate,
          principalPaid: prePrincipalPaid,
          revisedInterestRate: preRevisedRate,
          interestPaid: preInterestPaid,
          penaltyAmount: prePenalty || 0,
          tdsAmount: preTds || 0,
          tdsLedgerID: (preTds || 0) > 0 ? Number(tdsLedgerID) : null,
          netPayout: settlement.netCashOrBankReceipt,
          enablePostingInterestReversal: enablePostingReversal,
          reversalMode: enablePostingReversal ? reversalMode : 'Auto',
          reversePostingInterestAmount: enablePostingReversal ? round2(reversePostingAmount || 0) : null,
          reversalDebitLedgerID:
            enablePostingReversal && reversalDebitLedgerID > 0 ? Number(reversalDebitLedgerID) : null,
          postingCreditLedgerID:
            enablePostingReversal && reversalMode === 'ReceivableReversal' && postingCreditLedgerID > 0
              ? Number(postingCreditLedgerID)
              : null,
          paymentMode,
          bankLedgerID: paymentMode === 'Bank' ? Number(bankLedgerID) : null,
          referenceNo: referenceNo.trim() || null,
          narration: narration.trim() || null
        });
        setSuccess(
          `✅ ${res.data?.message || 'मुदतपूर्व मोडणी यशस्वी!'} ${res.data?.voucherNo ? `(व्हाउचर क्र.: ${res.data.voucherNo})` : ''}`
        );
      } else {
        if (renewalType === 'PrincipalOnly' && (renTds || 0) > (renInterestPayout || 0)) {
          setError('फक्त मुद्दल नूतनीकरणामध्ये TDS रक्कम ही प्राप्त व्याज परताव्यापेक्षा जास्त असू शकत नाही.');
          setSaving(false);
          return;
        }
        const res = await axios.post(`${API_URL}/InvestmentAccounts/Renew`, {
          oldInvestmentAccountID: selectedAccount.investmentAccountID,
          renewalDate: txnDate,
          renewalType,
          renewalAmount,
          newSchemeID,
          newInterestRate,
          durationType: renewalDurationType,
          durationValue: renewalDurationValue,
          newDepositReceiptNo: newDepositReceiptNo.trim() || null,
          interestPayoutAmount: renewalType === 'PrincipalOnly' ? renInterestPayout || 0 : 0,
          tdsAmount: renTds || 0,
          tdsLedgerID: (renTds || 0) > 0 ? Number(tdsLedgerID) : null,
          paymentMode,
          bankLedgerID:
            settlement.netCashOrBankReceipt > 0 && paymentMode === 'Bank' ? Number(bankLedgerID) : null,
          referenceNo: referenceNo.trim() || null,
          narration: narration.trim() || null
        });
        setSuccess(
          `✅ ${res.data?.message || 'नूतनीकरण यशस्वी!'} ${
            res.data?.newAccountNo ? `| नवीन खाते: ${res.data.newAccountNo}` : ''
          } ${res.data?.voucherNo ? `| व्हाउचर: ${res.data.voucherNo}` : ''}`
        );
      }

      setSelectedAccountId(0);
      fetchAccounts();
    } catch (err: any) {
      const resp = err?.response?.data;
      setError(typeof resp === 'string' ? resp : resp?.message || 'व्यवहार सेव्ह करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  // Compact top KPI stats
  const totalPrincipal = useMemo(
    () => accounts.reduce((s, a) => s + (a.principalAmount || 0), 0),
    [accounts]
  );
  const dueSoonCount = useMemo(() => {
    const now = new Date(txnDate || todayStr);
    const limit = new Date(now);
    limit.setDate(now.getDate() + 90);
    return accounts.filter((a) => {
      if (!a.maturityDate) return false;
      const m = new Date(a.maturityDate);
      return m >= now && m <= limit;
    }).length;
  }, [accounts, txnDate, todayStr]);

  const ctrl =
    'w-full h-8 text-xs border border-slate-300 rounded-sm px-2 bg-white text-slate-900 font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:bg-slate-100 disabled:text-slate-600';
  const segBase =
    'flex-1 h-8 px-2.5 text-xs font-bold border-y border-r first:border-l first:rounded-l-sm last:rounded-r-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors select-none';

  const totalDr = settlement
    ? round2(settlement.voucherLines.filter((l) => l.drCr === 'Dr').reduce((s, l) => s + l.amount, 0))
    : 0;
  const totalCr = settlement
    ? round2(settlement.voucherLines.filter((l) => l.drCr === 'Cr').reduce((s, l) => s + l.amount, 0))
    : 0;
  const isVoucherBalanced = Math.abs(totalDr - totalCr) < 0.01;

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen bg-slate-50 text-xs font-sans space-y-2.5">
      {/* Compact CBS Header Bar with Inline Portfolio Chips */}
      <div className="bg-white px-3.5 py-2 rounded-sm shadow-2xs border border-slate-200 border-b-2 border-primary flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Coins size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
              <span>गुंतवणूक मुदतपूर्ती, मोडणी व नूतनीकरण</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden md:inline">
                (Investment Closure &amp; Renewal)
              </span>
            </h1>
            <p className="text-[10.5px] text-slate-500">
              बँक गुंतवणूक मुदतपूर्ती जमा, मुदतपूर्व मोडणी (व्याज रिव्हर्सलसह) व मुदत ठेव नूतनीकरण
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="px-2.5 py-1 rounded-sm bg-slate-100 border border-slate-200 text-slate-800 font-semibold flex items-center gap-1">
            <Landmark className="w-3.5 h-3.5 text-primary" />
            सक्रिय ठेवी: <strong className="font-mono text-slate-950">{accounts.length}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-sm bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-700" />
            एकूण मुद्दल: <strong className="font-mono">₹{fmt(totalPrincipal)}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-sm bg-amber-50 border border-amber-200 text-amber-900 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-700" />
            ९० दिवसांत देय: <strong className="font-mono">{dueSoonCount}</strong>
          </span>
        </div>
      </div>

      {/* Error / Success Banners */}
      {error && (
        <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 text-red-800 text-xs px-3 py-2 rounded-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-800 font-bold cursor-pointer">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 text-emerald-900 text-xs px-3 py-2 rounded-sm font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess('')} className="text-emerald-600 hover:text-emerald-900 font-bold cursor-pointer">
            ×
          </button>
        </div>
      )}

      {/* 2-COLUMN FD-STYLE CBS FORM */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* ================= LEFT COLUMN: ENTRY FIELDSETS ================= */}
          <div className={`${selectedAccount ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
            {/* Group Box 1: Account & Transaction Date Selection */}
            <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3 bg-white shadow-2xs">
              <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>१. गुंतवणूक मुदत ठेव व व्यवहार तारीख निवड (Account &amp; Date)</span>
              </legend>

              <div className="space-y-2 mt-1">
                <FormRow label="मुदत ठेव खाते (FD Investment)" required>
                  <SearchableSelect
                    name="investmentAccountID"
                    value={selectedAccountId}
                    onChange={(e) => handleSelectAccount(Number(e.target.value))}
                    options={accountOptions}
                    placeholder={loading ? 'खाती लोड होत आहेत...' : '-- खाते क्र., जुना क्र., पावती क्र. किंवा बँक नावाने शोधा --'}
                  />
                </FormRow>

                <FormRow label="व्यवहार तारीख (Txn Date)" required>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={txnDate}
                      max={todayStr}
                      onChange={(e) => setTxnDate(e.target.value)}
                      disabled={!allowDateOverride}
                      readOnly={!allowDateOverride}
                      className={`${ctrl} !w-[165px] font-mono font-bold ${
                        isBeforeInvestmentDate || isFutureDate ? '!border-red-500 !bg-red-50' : ''
                      } ${!allowDateOverride ? '!bg-slate-100 cursor-not-allowed' : 'border-amber-400'}`}
                      required
                    />
                    {!allowDateOverride && (
                      <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <Lock size={9} /> लॉक
                      </span>
                    )}
                    {isHOUser && (
                      <label className="text-[10.5px] text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allowDateOverride}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAllowDateOverride(checked);
                            if (!checked) setTxnDate(activeBusinessDate);
                          }}
                          className="w-3 h-3 text-primary rounded"
                        />
                        <span className="flex items-center gap-0.5">
                          {allowDateOverride ? <Unlock size={10} className="text-amber-600" /> : <Lock size={10} className="text-slate-400" />}
                          तारीख बदला (Override)
                        </span>
                      </label>
                    )}
                    {selectedAccount && (
                      <span
                        className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                          isPrematureByDate
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {isPrematureByDate ? '⏳ मुदतपूर्व कालावधी' : '✅ मुदत पूर्ण (Matured)'}
                      </span>
                    )}
                  </div>
                  {isBeforeInvestmentDate && selectedAccount && (
                    <p className="mt-1 text-[10.5px] text-red-700 font-semibold">
                      व्यवहार तारीख ठेव तारखेपेक्षा ({formatDate(selectedAccount.investmentDate)}) आधीची असू शकत नाही.
                    </p>
                  )}
                </FormRow>
              </div>
            </fieldset>

            {!selectedAccount ? (
              <div className="p-8 text-center space-y-1.5 border border-dashed border-slate-300 rounded-sm bg-white">
                <Search className="w-6 h-6 text-slate-400 mx-auto" />
                <h3 className="text-xs font-bold text-slate-700">कोणतेही गुंतवणूक मुदत ठेव खाते निवडलेले नाही</h3>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  कृपया वरील ड्रॉपडाउनमधून गुंतवणूक खाते क्र., जुना क्रमांक, पावती क्रमांक किंवा बँकेच्या नावाने खाते निवडा.
                </p>
              </div>
            ) : (
              <>
                {/* Group Box 2: Compact Read-Only Deposit & Accrual Details Table */}
                <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3 bg-white shadow-2xs">
                  <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>२. गुंतवणूक व येणे व्याज तपशील (Deposit &amp; Accrual Details)</span>
                  </legend>

                  <div className="overflow-x-auto mt-1 border border-slate-200 rounded-sm">
                    <table className="w-full border-collapse text-[11px] bg-white">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <th className="w-28 bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-600 border-r border-slate-200">
                            बँक / संस्था
                          </th>
                          <td className="px-2.5 py-1.5 font-bold text-slate-900 border-r border-slate-200">
                            {selectedAccount.institutionName}
                          </td>
                          <th className="w-28 bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-600 border-r border-slate-200">
                            योजना
                          </th>
                          <td className="px-2.5 py-1.5 font-semibold text-slate-800">
                            {selectedAccount.schemeName}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <th className="bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-600 border-r border-slate-200">
                            खाते / पावती क्र.
                          </th>
                          <td className="px-2.5 py-1.5 font-mono border-r border-slate-200">
                            <span className="font-bold text-primary">{selectedAccount.investmentNo}</span>
                            {selectedAccount.oldInvestmentNo && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-amber-50 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                                जुना: {selectedAccount.oldInvestmentNo}
                              </span>
                            )}
                            {selectedAccount.depositReceiptNo && (
                              <span className="ml-1.5 px-1.5 py-0.2 bg-sky-50 text-sky-900 border border-sky-200 rounded text-[10px] font-bold">
                                पावती: {selectedAccount.depositReceiptNo}
                              </span>
                            )}
                          </td>
                          <th className="bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-600 border-r border-slate-200">
                            ठेव ते मुदतपूर्ती
                          </th>
                          <td className="px-2.5 py-1.5 font-mono font-semibold text-slate-800">
                            {formatDate(selectedAccount.investmentDate)} →{' '}
                            <span className="text-orange-700 font-bold">{formatDate(selectedAccount.maturityDate)}</span>
                            <span className="ml-1.5 text-[10px] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-300">
                              {elapsedDays} दिवस पूर्ण
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <th className="bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-600 border-r border-slate-200">
                            मूळ मुद्दल व दर
                          </th>
                          <td className="px-2.5 py-1.5 font-mono border-r border-slate-200">
                            <strong className="text-emerald-800">₹{fmt(selectedAccount.principalAmount)}</strong>
                            <span className="ml-1.5 text-slate-600 font-bold">@ {selectedAccount.interestRate}%</span>
                          </td>
                          <th className="bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-600 border-r border-slate-200">
                            येणे व्याज शिल्लक
                          </th>
                          <td className="px-2.5 py-1.5 font-mono">
                            <strong className={(selectedAccount.interestReceivable || 0) > 0 ? 'text-indigo-800' : 'text-slate-600'}>
                              ₹{fmt(selectedAccount.interestReceivable || 0)}
                            </strong>
                            {(selectedAccount.receivedInterest || 0) > 0 && (
                              <span className="ml-1.5 text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                पूर्वी प्राप्त: ₹{fmt(selectedAccount.receivedInterest || 0)}
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <th className="bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-600 border-r border-slate-200">
                            एकूण पोस्टिंग व्याज
                          </th>
                          <td colSpan={3} className="px-2.5 py-1.5 font-mono">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <strong className="text-slate-900">₹{fmt(selectedAccount.accruedInterest || 0)}</strong>
                              {(selectedAccount.accruedInterestTillMigration || 0) > 0 && (
                                <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.2 rounded">
                                  स्थलांतर व्याज: ₹{fmt(selectedAccount.accruedInterestTillMigration || 0)}
                                </span>
                              )}
                              {selectedAccount.lastAccrualDate && (
                                <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded">
                                  शेवटची तरतूद: {formatDate(selectedAccount.lastAccrualDate)}
                                </span>
                              )}
                              {(selectedAccount.pendingAccruedInterest || 0) > 0 && (
                                <span className="text-[10px] bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                                  ⚠️ प्रलंबित (Pending) तरतूद ({selectedAccount.pendingAccrualCount || 1}): ₹{fmt(selectedAccount.pendingAccruedInterest || 0)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </fieldset>

                {/* Group Box 3: Action Parameters */}
                <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3.5 bg-white shadow-2xs">
                  <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>३. व्यवहार प्रकार व रक्कम तपशील (Settlement / Renewal Parameters)</span>
                  </legend>

                  <div className="space-y-2.5 mt-1">
                    {/* Segmented Action Selector */}
                    <FormRow label="व्यवहार प्रकार (Action)" required>
                      <div className="flex w-full">
                        <button
                          type="button"
                          onClick={() => setActiveMode('maturity')}
                          className={`${segBase} ${
                            activeMode === 'maturity'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>१. नियमित मुदतपूर्ती</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMode('premature')}
                          className={`${segBase} ${
                            activeMode === 'premature'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>२. मुदतपूर्व मोडणी</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMode('renewal')}
                          className={`${segBase} ${
                            activeMode === 'renewal'
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>३. ठेव नूतनीकरण</span>
                        </button>
                      </div>
                    </FormRow>

                    {/* ---- MODE 1: REGULAR MATURITY ---- */}
                    {activeMode === 'maturity' && (
                      <>
                        {isPrematureByDate && (
                          <div className="bg-amber-50 border border-amber-300 rounded-sm px-2.5 py-1.5 text-[11px] text-amber-900 flex items-center justify-between gap-2">
                            <span>
                              ⚠️ या ठेवीची मुदतपूर्ती <b>{formatDate(selectedAccount.maturityDate)}</b> रोजी आहे. मुदतपूर्व मोडण्यासाठी कृपया &ldquo;२. मुदतपूर्व मोडणी&rdquo; निवडा.
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveMode('premature')}
                              className="px-2 py-0.5 bg-amber-600 text-white rounded-xs font-bold text-[10.5px] shrink-0 cursor-pointer"
                            >
                              मुदतपूर्व निवडा
                            </button>
                          </div>
                        )}

                        <FormRow label="परत मिळालेले मुद्दल (₹)" required>
                          <input
                            type="number"
                            step="0.01"
                            value={matPrincipal || ''}
                            onChange={(e) => setMatPrincipal(parseFloat(e.target.value) || 0)}
                            className={`${ctrl} font-mono font-bold text-slate-900`}
                            required
                          />
                        </FormRow>

                        <FormRow label="मिळालेले एकूण व्याज (Gross ₹)" required>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={matInterest === 0 ? 0 : matInterest || ''}
                              onChange={(e) => setMatInterest(Math.max(0, parseFloat(e.target.value) || 0))}
                              className={`${ctrl} font-mono font-bold text-emerald-800`}
                              required
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setMatInterest(
                                  round2(
                                    Math.max(
                                      0,
                                      (selectedAccount.expectedMaturityAmount || selectedAccount.principalAmount) -
                                        selectedAccount.principalAmount
                                    )
                                  )
                                )
                              }
                              className="h-8 px-2.5 text-[10.5px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm shrink-0 cursor-pointer"
                              title="अपेक्षित मुदतपूर्ती व्याज लागू करा"
                            >
                              ↺ अपेक्षित व्याज
                            </button>
                          </div>
                        </FormRow>
                      </>
                    )}

                    {/* ---- MODE 2: PREMATURE ENCASHMENT ---- */}
                    {activeMode === 'premature' && (
                      <>
                        <FormRow label="सुधारित व्याजदर (% p.a.)" hint="कमी झालेला लागू मुदतपूर्व दर">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={preRevisedRate === 0 ? 0 : preRevisedRate || ''}
                              onChange={(e) => {
                                setIsPreInterestManual(false);
                                setPreRevisedRate(Math.max(0, parseFloat(e.target.value) || 0));
                              }}
                              className={`${ctrl} font-mono font-bold text-amber-900`}
                            />
                            <span className="px-2 py-1 bg-amber-50 border border-amber-200 rounded-sm text-[10.5px] font-mono font-bold text-amber-900 shrink-0">
                              {elapsedDays} दिवस
                            </span>
                          </div>
                        </FormRow>

                        <FormRow label="प्राप्त एकूण व्याज (Gross ₹)" hint="बँकेने दिलेले मुदतपूर्व व्याज">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={preInterestPaid === 0 ? 0 : preInterestPaid || ''}
                              onChange={(e) => {
                                setIsPreInterestManual(true);
                                setPreInterestPaid(Math.max(0, parseFloat(e.target.value) || 0));
                              }}
                              className={`${ctrl} font-mono font-bold text-emerald-800`}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setIsPreInterestManual(false);
                                setPreInterestPaid(
                                  computeAutoPrematureInterest(
                                    selectedAccount.principalAmount || 0,
                                    preRevisedRate,
                                    elapsedDays
                                  )
                                );
                              }}
                              className="h-8 px-2.5 text-[10.5px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-sm shrink-0 cursor-pointer"
                              title="प्रत्यक्ष दिवस व दरावरून पुन्हा मोजा"
                            >
                              ↺ ऑटो गणना
                            </button>
                          </div>
                        </FormRow>

                        <FormRow label="परत मिळालेले मुद्दल (₹)" hint="पूर्वीच्या व्याजाची मुद्दलातून कपात झाल्यास बदला" required>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={selectedAccount.principalAmount}
                              value={prePrincipalPaid === 0 ? 0 : prePrincipalPaid || ''}
                              onChange={(e) => setPrePrincipalPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                              className={`${ctrl} font-mono font-bold`}
                              required
                            />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-600 font-semibold whitespace-nowrap">दंड (Penalty ₹):</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={prePenalty || ''}
                                onChange={(e) => setPrePenalty(Math.max(0, parseFloat(e.target.value) || 0))}
                                placeholder="0.00"
                                className={`${ctrl} font-mono font-bold text-rose-700`}
                              />
                            </div>
                          </div>
                        </FormRow>

                        {/* Posting Interest Reversal Panel */}
                        <div className="border border-rose-300 rounded-sm bg-rose-50/40 p-2.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none font-bold text-rose-950 text-[11.5px]">
                              <input
                                type="checkbox"
                                checked={enablePostingReversal}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setEnablePostingReversal(checked);
                                  if (!checked) {
                                    setIsReverseAmtManual(false);
                                    syncReversePostingAmount(0, '');
                                  } else if ((reversePostingAmount || 0) <= 0) {
                                    const standingRecv = round2(selectedAccount.interestReceivable || 0);
                                    const autoRev = round2(Math.max(0, standingRecv - Math.min(preInterestPaid || 0, standingRecv)));
                                    const suggested = autoRev > 0 ? autoRev : standingRecv;
                                    syncReversePostingAmount(suggested);
                                    setIsReverseAmtManual(false);
                                  }
                                }}
                                className="w-3.5 h-3.5 text-rose-600 rounded border-rose-400"
                              />
                              <span>🔄 बँकेने केलेले पोस्टिंग व्याज रिव्हर्स करा (Reverse Posting Interest)</span>
                            </label>
                            {settlement && settlement.totalReversalDr > 0 && (
                              <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">
                                एकूण रिव्हर्सल: ₹{fmt(settlement.totalReversalDr)} Dr
                              </span>
                            )}
                          </div>

                          <div className="pt-1.5 border-t border-rose-200/80 space-y-2">
                            <FormRow
                              label="रिव्हर्स पोस्टिंग व्याज (₹)"
                              hint={
                                !enablePostingReversal
                                  ? 'थेट रक्कम बदला / टाका — ₹0 पेक्षा जास्त रक्कम टाकताच रिव्हर्सल सक्रिय होईल'
                                  : reversalMode === 'ReceivableReversal'
                                  ? 'बुक्समधील येणे/पोस्टिंग व्याज रिव्हर्सल (रोख परतावा बदलत नाही)'
                                  : 'आधी जमा केलेले व्याज बँक परताव्यातून वजा होईल (Net Receipt कमी होईल)'
                              }
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={reversePostingInput}
                                  placeholder="0.00 (रिव्हर्सल असल्यास रक्कम टाका)"
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    setReversePostingInput(raw);
                                    setIsReverseAmtManual(true);
                                    const parsed = raw.trim() === '' ? 0 : Math.max(0, round2(parseFloat(raw) || 0));
                                    setReversePostingAmount(parsed);
                                    if (parsed > 0 && !enablePostingReversal) {
                                      setEnablePostingReversal(true);
                                    }
                                  }}
                                  onBlur={() => {
                                    const clean = Math.max(0, round2(parseFloat(reversePostingInput) || 0));
                                    syncReversePostingAmount(clean);
                                    if (clean <= 0) {
                                      setEnablePostingReversal(false);
                                    }
                                  }}
                                  className={`${ctrl} flex-1 min-w-[120px] font-mono font-bold text-rose-900 border-rose-300`}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const standingRecv = round2(selectedAccount.interestReceivable || 0);
                                    const autoBal = round2(Math.max(0, standingRecv - Math.min(preInterestPaid || 0, standingRecv)));
                                    setIsReverseAmtManual(false);
                                    setEnablePostingReversal(autoBal > 0);
                                    syncReversePostingAmount(autoBal);
                                  }}
                                  className="h-8 px-2 text-[10px] font-bold bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-sm shrink-0 cursor-pointer"
                                  title="येणे व्याज वजा प्राप्त व्याज"
                                >
                                  ↺ ऑटो शिल्लक
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const fullRecv = round2(selectedAccount.interestReceivable || 0);
                                    setIsReverseAmtManual(true);
                                    setEnablePostingReversal(fullRecv > 0);
                                    syncReversePostingAmount(fullRecv);
                                  }}
                                  className="h-8 px-2 text-[10px] font-bold bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-300 rounded-sm shrink-0 cursor-pointer"
                                  title="संपूर्ण येणे व्याज रक्कम रिव्हर्स करा"
                                >
                                  ↺ पूर्ण (₹{fmt(selectedAccount.interestReceivable || 0)})
                                </button>
                              </div>
                            </FormRow>

                            {enablePostingReversal ? (
                              <div className="space-y-2 pt-1">
                                <FormRow label="रिव्हर्सल प्रकार (Mode)" required>
                                  <div className="flex w-full">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReversalMode('ReceivableReversal');
                                        setIsReverseAmtManual(false);
                                      }}
                                      className={`${segBase} ${
                                        reversalMode === 'ReceivableReversal'
                                          ? 'bg-rose-700 text-white border-rose-700'
                                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      १. बुक्स / येणे व्याज रिव्हर्स करा
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReversalMode('PayoutDeduction');
                                        setIsReverseAmtManual(true);
                                      }}
                                      className={`${segBase} ${
                                        reversalMode === 'PayoutDeduction'
                                          ? 'bg-orange-700 text-white border-orange-700'
                                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                      }`}
                                    >
                                      २. बँक परतावा रकमेतून वजा करा
                                    </button>
                                  </div>
                                </FormRow>

                                <FormRow label="रिव्हर्सल नावे लेजर (Dr)" hint="व्याज उत्पन्न / मागील वर्ष समायोजन" align="start">
                                  <SearchableSelect
                                    name="reversalDebitLedgerID"
                                    value={reversalDebitLedgerID}
                                    onChange={(e) => setReversalDebitLedgerID(Number(e.target.value))}
                                    options={reversalDrLedgerOptions}
                                    placeholder="-- रिव्हर्सल नावे (Dr) जी.एल. लेजर निवडा --"
                                  />
                                </FormRow>

                                {reversalMode === 'ReceivableReversal' && (
                                  <FormRow label="पोस्टिंग व्याज जमा लेजर (Cr)" hint="येणे व्याज किंवा मॅन्युअल POSTING_INTR" align="start">
                                    <SearchableSelect
                                      name="postingCreditLedgerID"
                                      value={postingCreditLedgerID}
                                      onChange={(e) => setPostingCreditLedgerID(Number(e.target.value))}
                                      options={postingCrLedgerOptions}
                                      placeholder="-- पोस्टिंग व्याज जमा (Cr) जी.एल. लेजर निवडा --"
                                    />
                                  </FormRow>
                                )}

                                {reversalMode === 'ReceivableReversal' &&
                                  (reversalDebitLedgerID > 0 ? reversalDebitLedgerID : resolvedOldGlIds.incomeId) > 0 &&
                                  (reversalDebitLedgerID > 0 ? reversalDebitLedgerID : resolvedOldGlIds.incomeId) ===
                                    (postingCreditLedgerID > 0 ? postingCreditLedgerID : resolvedOldGlIds.receivableId) && (
                                    <div className="text-[10.5px] bg-red-50 border border-red-300 text-red-800 px-2 py-1 rounded-sm font-semibold">
                                      ⚠️ रिव्हर्सल नावे (Dr) आणि पोस्टिंग व्याज जमा (Cr) लेजर एकच असू शकत नाही. कृपया वेगवेगळी लेजर्स निवडा.
                                    </div>
                                  )}

                                {settlement && settlement.sysExtraRev > 0 && (
                                  <div className="text-[10.5px] bg-amber-50 border border-amber-300 text-amber-900 px-2 py-1 rounded-sm font-medium">
                                    ℹ️ सिस्टीममधील उर्वरित येणे व्याज <b>₹{fmt(settlement.sysExtraRev)}</b> देखील खाते बंद करताना स्वयंचलित रिव्हर्स होऊन येणे व्याज शून्य (₹0.00) केले जाईल.
                                  </div>
                                )}
                              </div>
                            ) : (
                              settlement && settlement.totalReversalDr > 0 && (
                                <p className="text-[10.5px] text-rose-800">
                                  {settlement.accruedReversed > 0 && (
                                    <>
                                      ऑटो रिव्हर्सल सक्रिय: पूर्वी तरतूद केलेले येणे व्याज (₹{fmt(settlement.standingReceivable)}) प्रत्यक्ष व्याजापेक्षा (₹{fmt(settlement.grossInterest)}) जास्त असल्याने{' '}
                                      <b>₹{fmt(settlement.accruedReversed)}</b> ची <b>Dr व्याज उत्पन्न / Cr येणे व्याज</b> रिव्हर्सल नोंद पडेल.{' '}
                                    </>
                                  )}
                                  {settlement.interestClawback > 0 && (
                                    <>
                                      मूळ मुद्दलातून कपात केलेले <b>₹{fmt(settlement.interestClawback)}</b> व्याज उत्पन्नाला रिव्हर्स (Dr) करून संपूर्ण मुद्दल निरंक केले जाईल.
                                    </>
                                  )}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* ---- MODE 3: RENEWAL ---- */}
                    {activeMode === 'renewal' && (
                      <>
                        <FormRow label="नूतनीकरण प्रकार (Type)" required>
                          <div className="flex w-full">
                            <button
                              type="button"
                              onClick={() => {
                                setIsRenewalAmtManual(false);
                                setRenewalType('PrincipalOnly');
                              }}
                              className={`${segBase} ${
                                renewalType === 'PrincipalOnly'
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              फक्त मुद्दल (Principal Only)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsRenewalAmtManual(false);
                                setRenewalType('PrincipalAndInterest');
                              }}
                              className={`${segBase} ${
                                renewalType === 'PrincipalAndInterest'
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              मुद्दल + व्याज (Principal + Interest)
                            </button>
                          </div>
                        </FormRow>

                        <FormRow label="नवीन गुंतवणूक योजना" required>
                          <select
                            value={newSchemeID}
                            onChange={(e) => {
                              const sid = parseInt(e.target.value, 10);
                              setNewSchemeID(sid);
                              const sc = schemes.find((s) => Number(s.schemeID) === sid);
                              if (sc) {
                                setNewInterestRate(Number(sc.interestRate || 0));
                                const dType: 'Months' | 'Days' =
                                  (sc.durationType || 'Months').toLowerCase() === 'days' ? 'Days' : 'Months';
                                setRenewalDurationType(dType);
                                setRenewalDurationValue(
                                  dType === 'Days' ? Number(sc.durationDays || 365) : Number(sc.durationMonths || 12)
                                );
                              }
                            }}
                            className={`${ctrl} font-semibold`}
                          >
                            {schemes.map((s: any) => (
                              <option key={s.schemeID} value={s.schemeID}>
                                {s.schemeName} ({s.interestRate}%)
                              </option>
                            ))}
                          </select>
                        </FormRow>

                        <FormRow label="नूतनीकरण कालावधी व दर" required>
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="number"
                              min="1"
                              value={renewalDurationValue || ''}
                              onChange={(e) => setRenewalDurationValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className={`${ctrl} font-mono font-bold`}
                              required
                            />
                            <select
                              value={renewalDurationType}
                              onChange={(e) => setRenewalDurationType(e.target.value as 'Months' | 'Days')}
                              className={`${ctrl} font-semibold`}
                            >
                              <option value="Months">महिने (Months)</option>
                              <option value="Days">दिवस (Days)</option>
                            </select>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={newInterestRate || ''}
                                onChange={(e) => setNewInterestRate(Math.max(0, parseFloat(e.target.value) || 0))}
                                className={`${ctrl} font-mono font-bold text-primary pr-6`}
                                title="नवीन व्याजदर (% p.a.)"
                                required
                              />
                              <span className="absolute right-2 text-[11px] font-bold text-slate-500">%</span>
                            </div>
                          </div>
                        </FormRow>

                        <FormRow label="नवीन ठेव मुद्दल व पावती क्र." required>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              value={renewalAmount || ''}
                              onChange={(e) => {
                                setIsRenewalAmtManual(true);
                                setRenewalAmount(Math.max(0, parseFloat(e.target.value) || 0));
                              }}
                              className={`${ctrl} font-mono font-bold text-emerald-800`}
                              required
                            />
                            <input
                              type="text"
                              value={newDepositReceiptNo}
                              onChange={(e) => setNewDepositReceiptNo(e.target.value)}
                              placeholder="बँक पावती / FDR क्र. (ऐच्छिक)"
                              className={`${ctrl} font-mono`}
                            />
                          </div>
                        </FormRow>

                        {renewalType === 'PrincipalOnly' && (
                          <FormRow label="प्राप्त व्याज परतावा (Gross ₹)" hint="बँकेत/रोख मिळणारे व्याज">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={renInterestPayout === 0 ? 0 : renInterestPayout || ''}
                              onChange={(e) => setRenInterestPayout(Math.max(0, parseFloat(e.target.value) || 0))}
                              placeholder="0.00"
                              className={`${ctrl} font-mono font-bold text-emerald-700`}
                            />
                          </FormRow>
                        )}

                        {/* Live Renewal Preview Strip */}
                        {renewalPreview && (
                          <div className="bg-indigo-50/70 border border-indigo-200 rounded-sm p-2.5 grid grid-cols-3 gap-2 text-[11px]">
                            <div>
                              <span className="text-slate-500 block text-[10px]">नवीन मुदतपूर्ती दिनांक:</span>
                              <strong className="font-mono text-indigo-950">{formatDate(renewalPreview.newMaturityIso)}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">अपेक्षित नवीन व्याज:</span>
                              <strong className="font-mono text-emerald-800">₹{fmt(renewalPreview.expectedInterest)}</strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[10px]">नवीन मुदतपूर्ती रक्कम:</span>
                              <strong className="font-mono text-blue-900">₹{fmt(renewalPreview.expectedMaturityAmount)}</strong>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Shared TDS Input + Conditional Dynamic TDS GL Selector */}
                    <FormRow label="वजा: TDS कर कपात (₹)" hint="कपात असल्यासच रक्कम टाका">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={activeTdsAmount || ''}
                        onChange={(e) => setActiveTdsAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00 (TDS नसल्यास रिकामे ठेवा)"
                        className={`${ctrl} font-mono font-bold ${activeTdsAmount > 0 ? 'border-rose-400 text-rose-800 bg-rose-50/30' : ''}`}
                      />
                    </FormRow>

                    {activeTdsAmount > 0 && (
                      <FormRow label="TDS जी.एल. लेजर (TDS GL)" required align="start">
                        <SearchableSelect
                          name="tdsLedgerID"
                          value={tdsLedgerID}
                          onChange={(e) => setTdsLedgerID(Number(e.target.value))}
                          options={ledgerOptions}
                          placeholder="-- डायनॅमिक TDS जी.एल. लेजर शोधा व निवडा --"
                        />
                      </FormRow>
                    )}

                    {/* Conditional Receipt Mode & Bank GL (only when cash/bank inflow > 0) */}
                    {settlement && settlement.netCashOrBankReceipt > 0 && (
                      <>
                        <FormRow label="जमा पद्धत (Receipt Mode)" required>
                          <select
                            value={paymentMode}
                            onChange={(e) => {
                              const mode = e.target.value as 'Bank' | 'Cash';
                              setPaymentMode(mode);
                              if (mode !== 'Bank') {
                                setBankLedgerID(0);
                                setReferenceNo('');
                              }
                            }}
                            className={`${ctrl} font-bold text-blue-950`}
                          >
                            <option value="Bank">🏦 बँक खाते (Bank Account)</option>
                            <option value="Cash">💵 रोख खाते (Branch Cash)</option>
                          </select>
                        </FormRow>

                        {paymentMode === 'Bank' && (
                          <>
                            <FormRow label="बँक जी.एल. खाते (Bank GL)" required align="start">
                              <BankLedgerSelect
                                value={bankLedgerID}
                                onChange={(id) => setBankLedgerID(id)}
                                showCountBadge
                              />
                            </FormRow>
                            <FormRow label="UTR / धनादेश / संदर्भ क्र.">
                              <input
                                type="text"
                                value={referenceNo}
                                onChange={(e) => setReferenceNo(e.target.value)}
                                placeholder="उदा. UTR / NEFT / Cheque क्र."
                                className={`${ctrl} font-mono`}
                              />
                            </FormRow>
                          </>
                        )}
                      </>
                    )}

                    <FormRow label="तपशील / शेरा (Narration)">
                      <input
                        type="text"
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        placeholder="ऐच्छिक शेरा / बँक पावती संदर्भ..."
                        className={ctrl}
                      />
                    </FormRow>
                  </div>
                </fieldset>
              </>
            )}
          </div>

          {/* ================= RIGHT STICKY COLUMN: SETTLEMENT & VOUCHER PREVIEW ================= */}
          {selectedAccount && settlement && (
            <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-2">
              {/* Card 1: Live Settlement Summary */}
              <fieldset className="border border-slate-300 rounded-sm px-3.5 pt-1.5 pb-3.5 bg-white shadow-xs">
                <legend className="float-none w-auto text-[11px] font-bold text-primary px-2.5 py-0.5 bg-white border border-slate-300 rounded-sm shadow-2xs inline-flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>थेट सेटलमेंट सारांश (Live Settlement Summary)</span>
                </legend>

                <div className="flex items-center justify-end gap-1.5 -mt-5 mb-2">
                  <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-sm">
                    {elapsedDays} दिवस
                  </span>
                  <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-sm">
                    {activeMode === 'maturity'
                      ? 'नियमित मुदतपूर्ती'
                      : activeMode === 'premature'
                      ? 'मुदतपूर्व मोडणी'
                      : 'ठेव नूतनीकरण'}
                  </span>
                </div>

                <dl className="text-xs divide-y divide-slate-100">
                  <div className="flex justify-between items-center py-1.5">
                    <dt className="text-slate-600">मूळ गुंतवलेली मुद्दल (Principal)</dt>
                    <dd className="font-mono font-bold text-slate-900">₹{fmt(settlement.originalPrincipal)}</dd>
                  </div>

                  <div className="flex justify-between items-center py-1.5">
                    <dt className="text-slate-600">आधीचे येणे व्याज शिल्लक (Receivable)</dt>
                    <dd className="font-mono font-semibold text-indigo-800">₹{fmt(settlement.standingReceivable)}</dd>
                  </div>

                  <div className="py-1.5">
                    <div className="flex justify-between items-center">
                      <dt className="text-slate-700 font-semibold">चालू मंजूर एकूण व्याज (Gross)</dt>
                      <dd className="font-mono font-bold text-emerald-700">+ ₹{fmt(settlement.grossInterest)}</dd>
                    </div>
                    {(settlement.receivableCleared > 0 || settlement.freshIncome > 0) && (
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex justify-end gap-2">
                        <span>येणे समायोजन: ₹{fmt(settlement.receivableCleared)}</span>
                        <span>|</span>
                        <span>नवीन उत्पन्न: ₹{fmt(settlement.freshIncome)}</span>
                      </div>
                    )}
                  </div>

                  {settlement.payoutDeductionAmount > 0 && (
                    <div className="flex justify-between items-center py-1.5 bg-orange-50/70 px-2 -mx-2 rounded-xs">
                      <dt className="text-orange-800 font-bold">वजा: परतावा पोस्टिंग व्याज कपात</dt>
                      <dd className="font-mono font-black text-orange-800">- ₹{fmt(settlement.payoutDeductionAmount)}</dd>
                    </div>
                  )}

                  {settlement.totalReversalDr > 0 && (
                    <div className="py-1.5 bg-rose-50/70 px-2 -mx-2 rounded-xs">
                      <div className="flex justify-between items-center">
                        <dt className="text-rose-800 font-bold">
                          व्याज रिव्हर्सल एंट्री (Dr{' '}
                          {activeMode === 'premature' && reversalDebitLedgerID > 0
                            ? getLedgerDisplayName(reversalDebitLedgerID, 'रिव्हर्सल लेजर')
                            : 'व्याज उत्पन्न'}
                          )
                        </dt>
                        <dd className="font-mono font-black text-rose-800">₹{fmt(settlement.totalReversalDr)}</dd>
                      </div>
                      {(settlement.manualPostingReversal > 0 || settlement.sysExtraRev > 0 || settlement.interestClawback > 0) && (
                        <div className="text-[10px] text-rose-700 font-mono mt-0.5 flex flex-wrap justify-end gap-2">
                          {settlement.accruedReversed > 0 && (
                            <span>येणे/पोस्टिंग रिव्हर्सल: ₹{fmt(settlement.accruedReversed)}</span>
                          )}
                          {settlement.interestClawback > 0 && (
                            <span>परतावा/मुद्दल कपात: ₹{fmt(settlement.interestClawback)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {settlement.penalty > 0 && (
                    <div className="flex justify-between items-center py-1.5">
                      <dt className="text-rose-700">वजा: मुदतपूर्व दंड (Penalty)</dt>
                      <dd className="font-mono font-bold text-rose-700">- ₹{fmt(settlement.penalty)}</dd>
                    </div>
                  )}

                  {settlement.tds > 0 && (
                    <div className="flex justify-between items-center py-1.5">
                      <dt className="text-rose-700">वजा: TDS कर कपात</dt>
                      <dd className="font-mono font-bold text-rose-700">- ₹{fmt(settlement.tds)}</dd>
                    </div>
                  )}

                  {activeMode === 'renewal' && (
                    <div className="flex justify-between items-center py-2 bg-primary/5 px-2 -mx-2 rounded-xs mt-1">
                      <dt className="text-primary font-bold">नवीन गुंतवणूक मुद्दल (New Deposit)</dt>
                      <dd className="font-mono font-black text-primary text-sm">₹{fmt(settlement.newRenewalDeposit)}</dd>
                    </div>
                  )}
                </dl>

                {/* Highlight Net Payout Box */}
                <div className="mt-2.5 p-2.5 rounded-sm bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <div className="text-[10.5px] text-slate-300 font-medium">
                      {activeMode === 'renewal'
                        ? 'निव्वळ बँक/रोख परतावा जमा (Net Inflow)'
                        : 'निव्वळ बँक/रोख जमा रक्कम (Net Receipt)'}
                    </div>
                    <div className="text-[10px] text-emerald-300 font-mono">
                      {settlement.netCashOrBankReceipt > 0
                        ? paymentMode === 'Bank'
                          ? 'बँक खात्यात नावे (Debit)'
                          : 'रोख खात्यात नावे (Debit)'
                        : 'पुस्तकी नूतनीकरण हस्तांतरण (Journal)'}
                    </div>
                  </div>
                  <div className="text-base font-mono font-black text-emerald-300">
                    ₹{fmt(settlement.netCashOrBankReceipt)}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => initializeAccountDefaults(selectedAccount, txnDate)}
                    className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>पूर्ववत (Reset)</span>
                  </button>

                  <button
                    type="submit"
                    disabled={saving || isBeforeInvestmentDate || isFutureDate || !isVoucherBalanced}
                    className={`flex-1 h-8 px-4 text-white font-bold rounded-sm text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all ${
                      activeMode === 'maturity'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : activeMode === 'premature'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-primary hover:opacity-95'
                    }`}
                  >
                    {activeMode === 'maturity' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : activeMode === 'premature' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    <span>
                      {saving
                        ? 'प्रक्रिया सुरू आहे...'
                        : activeMode === 'maturity'
                        ? 'मुदतपूर्ती जतन करा'
                        : activeMode === 'premature'
                        ? 'मुदतपूर्व मोडणी जतन करा'
                        : 'नूतनीकरण जतन करा'}
                    </span>
                  </button>
                </div>
              </fieldset>

              {/* Card 2: Live Accounting Voucher Preview */}
              <div className="bg-white border border-slate-300 rounded-sm shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowVoucherPreview((p) => !p)}
                  className="w-full px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>लेखा व्हाउचर नोंदी (Accounting Voucher Preview)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded border font-bold ${
                        isVoucherBalanced
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                      }`}
                    >
                      {isVoucherBalanced ? 'संतुलित' : 'असंतुलित'}
                    </span>
                    {showVoucherPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                {showVoucherPreview && (
                  <div className="p-2.5 overflow-x-auto">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                          <th className="py-1 px-2 text-left">जी.एल. खाते व तपशील</th>
                          <th className="py-1 px-2 text-right text-rose-800 w-24">नावे Dr (₹)</th>
                          <th className="py-1 px-2 text-right text-emerald-800 w-24">जमा Cr (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {settlement.voucherLines.map((line, idx) => (
                          <tr key={idx} className={line.isReversal ? 'bg-rose-50/60 font-semibold' : ''}>
                            <td className="py-1.5 px-2">
                              <div className={`font-semibold ${line.isReversal ? 'text-rose-900' : 'text-slate-900'}`}>
                                {line.ledger}
                              </div>
                              <div className="text-[10px] text-slate-500">{line.note}</div>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-800">
                              {line.drCr === 'Dr' ? fmt(line.amount) : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold text-emerald-800">
                              {line.drCr === 'Cr' ? fmt(line.amount) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-slate-950">
                          <td className="py-1.5 px-2 text-right">एकूण ताळमेळ:</td>
                          <td className="py-1.5 px-2 text-right font-mono text-rose-900">₹{fmt(totalDr)}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-emerald-900">₹{fmt(totalCr)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default InvestmentMaturityClaim;

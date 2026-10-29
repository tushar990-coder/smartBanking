import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from './SearchableSelect';
import BankLedgerSelect from './common/BankLedgerSelect';
import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';

interface RdAccount {
  rdAccountID: number;
  accountNo: string;
  legacyAccountNumber?: string;
  memberCode: string;
  memberName: string;
  customerName?: string;
  cifNo?: string;
  schemeName: string;
  installmentAmount: number;
  totalPaidInstallments: number;
  totalDepositedAmount: number;
  durationMonths: number;
  interestRate: number;
  prematurePenaltyRate?: number;
  effectiveAccruedInt?: number;
  legacyAccruedInt?: number;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  openingDate: string;
  branchID?: number;
  customerID?: number;
  memberID?: number;
  isLienMarked?: boolean;
  lienLoanAccountNo?: string;
  rdLiabilityLedgerName?: string;
  interestPayableLedgerName?: string;
  interestExpenseLedgerName?: string;
  penaltyIncomeLedgerName?: string;
}

interface FdScheme {
  fdSchemeID: number;
  schemeName: string;
  interestRate: number;
  durationMonths: number;
  branchID?: number | null;
  branch?: { branchID: number; branchName: string } | null;
}

interface RdWithdrawalMaturityProps {
  voucherId?: number;
  isPassingMode?: boolean;
  onNavigate?: (tab: string, subTab?: string) => void;
}

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

function normalizeNumericText(raw: string, allowNegative = false): string {
  if (!raw) return '';
  let converted = '';
  for (const ch of raw) {
    converted += DEVANAGARI_DIGITS[ch] ?? ch;
  }
  converted = converted.replace(/,/g, '').replace(/\s+/g, '');
  let cleaned = '';
  let hasDot = false;
  for (let i = 0; i < converted.length; i++) {
    const c = converted[i];
    if (c >= '0' && c <= '9') {
      cleaned += c;
    } else if (c === '.' && !hasDot) {
      hasDot = true;
      cleaned += c;
    } else if (allowNegative && c === '-' && cleaned.length === 0) {
      cleaned += c;
    }
  }
  return cleaned;
}

function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function formatINR(val: number): string {
  return round2(val).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RdWithdrawalMaturity({
  voucherId: propVoucherId,
  isPassingMode: propIsPassingMode,
  onNavigate,
}: RdWithdrawalMaturityProps = {}) {
  const queryParams = new URLSearchParams(window.location.search);
  const voucherId =
    propVoucherId ||
    (queryParams.get('voucherId') ? parseInt(queryParams.get('voucherId')!, 10) : undefined);
  const isPassingMode = propIsPassingMode ?? queryParams.get('passingMode') === 'true';

  const [passingVoucherData, setPassingVoucherData] = useState<any>(null);
  const [passingClosureMeta, setPassingClosureMeta] = useState<any>(null);
  const [, setPassingLoading] = useState<boolean>(false);
  const [passingActionLoading, setPassingActionLoading] = useState<boolean>(false);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [accounts, setAccounts] = useState<RdAccount[]>([]);
  const [selectedAccId, setSelectedAccId] = useState('');
  const [selectedAcc, setSelectedAcc] = useState<RdAccount | null>(null);
  const [accruedInterest, setAccruedInterest] = useState(0);

  const [fdSchemes, setFdSchemes] = useState<FdScheme[]>([]);
  const [targetFdSchemeId, setTargetFdSchemeId] = useState('');

  const { user } = useAuth();
  const activeBusinessDate = user?.businessDate
    ? user.businessDate.split('T')[0]
    : new Date().toISOString().split('T')[0];

  const [closureDate, setClosureDate] = useState(activeBusinessDate);

  useEffect(() => {
    if (user?.businessDate && !isPassingMode) {
      setClosureDate(user.businessDate.split('T')[0]);
    }
  }, [user?.businessDate, isPassingMode]);

  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'Transfer'>('Cash');
  const [bankLedgerId, setBankLedgerId] = useState<number>(0);
  const [savingAccountId, setSavingAccountId] = useState<number>(0);
  const [customerSavingAccounts, setCustomerSavingAccounts] = useState<any[]>([]);
  const [loadingSavingAccounts, setLoadingSavingAccounts] = useState<boolean>(false);

  const [activeSubTab, setActiveSubTab] = useState<'matured' | 'premature' | 'renew'>('matured');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Editable Payout & Interest/Penalty two-way sync state
  const [payoutInputStr, setPayoutInputStr] = useState<string>('');
  const [netAdjustmentInputStr, setNetAdjustmentInputStr] = useState<string>('');
  const [isPayoutManuallyEdited, setIsPayoutManuallyEdited] = useState<boolean>(false);
  const [closureRemarks, setClosureRemarks] = useState<string>('');
  const [showVoucherPreview, setShowVoucherPreview] = useState<boolean>(false);

  const isTermCompletedForAccount = (acc: RdAccount | null, refDateStr: string): boolean => {
    if (!acc) return false;
    if (acc.status === 'Matured') return true;
    if (Number(acc.durationMonths) > 0 && Number(acc.totalPaidInstallments) >= Number(acc.durationMonths)) {
      return true;
    }
    if (acc.maturityDate) {
      const matDatePart = acc.maturityDate.split('T')[0];
      if (matDatePart && refDatePart(refDateStr) >= matDatePart) {
        return true;
      }
    }
    return false;
  };

  function refDatePart(d: string): string {
    return d ? d.split('T')[0] : new Date().toISOString().split('T')[0];
  }

  // Formula-calculated default payout & premature metadata for current tab
  const formulaCalculation = useMemo(() => {
    if (!selectedAcc) {
      return {
        principal: 0,
        provisionedInterest: 0,
        defaultPayout: 0,
        defaultAdjustment: 0,
        prematureMonths: 0,
        prematureRate: 0,
        penaltyRate: 1,
        recalcPrematureInt: 0,
      };
    }

    const principal = round2(Number(selectedAcc.totalDepositedAmount) || 0);
    const provisioned = round2(Math.max(0, Number(accruedInterest) || 0));
    const penaltyRate = Number(selectedAcc.prematurePenaltyRate ?? 1.0);
    const baseRate = Number(selectedAcc.interestRate) || 0;
    const prematureRate = Math.max(0, round2(baseRate - penaltyRate));

    const opening = new Date(selectedAcc.openingDate);
    const closing = new Date(closureDate || activeBusinessDate);
    let actualMonths =
      (closing.getFullYear() - opening.getFullYear()) * 12 +
      (closing.getMonth() - opening.getMonth());
    if (!Number.isFinite(actualMonths) || actualMonths <= 0) actualMonths = 1;

    const p = Number(selectedAcc.installmentAmount) || 0;
    let totalPrematureMat = 0;
    for (let k = 1; k <= actualMonths; k++) {
      const monthsInBank = actualMonths - k + 1;
      const factor = Math.pow(1.0 + prematureRate / 400.0, monthsInBank / 3.0);
      totalPrematureMat += p * factor;
    }
    const recalcPrematureInt = Math.max(0, Math.round(totalPrematureMat - p * actualMonths));

    let defaultPayout = principal + provisioned;
    if (activeSubTab === 'premature') {
      defaultPayout = round2(principal + recalcPrematureInt);
    } else {
      // Matured or Renewal
      const termDone = isTermCompletedForAccount(selectedAcc, closureDate);
      const schemeMatAmt = round2(Number(selectedAcc.maturityAmount) || 0);
      if (provisioned > 0) {
        defaultPayout = round2(principal + provisioned);
      } else if (termDone && schemeMatAmt > principal) {
        defaultPayout = schemeMatAmt;
      } else {
        defaultPayout = round2(principal + provisioned);
      }
    }

    return {
      principal,
      provisionedInterest: provisioned,
      defaultPayout,
      defaultAdjustment: round2(defaultPayout - principal),
      prematureMonths: actualMonths,
      prematureRate,
      penaltyRate,
      recalcPrematureInt,
    };
  }, [selectedAcc, accruedInterest, activeSubTab, closureDate, activeBusinessDate]);

  // Keep editable inputs synced to formula default unless manually overridden (or in passing mode)
  useEffect(() => {
    if (!selectedAcc || isPassingMode) return;
    if (!isPayoutManuallyEdited) {
      setPayoutInputStr(String(round2(formulaCalculation.defaultPayout)));
      setNetAdjustmentInputStr(String(round2(formulaCalculation.defaultAdjustment)));
    }
  }, [
    selectedAcc,
    formulaCalculation.defaultPayout,
    formulaCalculation.defaultAdjustment,
    isPayoutManuallyEdited,
    isPassingMode,
  ]);

  // Live Double-Entry Settlement Breakdown (100% mirror of RdClosureSettlementHelper.BuildSettlementBreakdown)
  const liveSettlement = useMemo(() => {
    const p = formulaCalculation.principal;
    const a = formulaCalculation.provisionedInterest;
    const calc = formulaCalculation.defaultPayout;

    const parsedPayout = parseFloat(payoutInputStr);
    const finalPayout = Number.isFinite(parsedPayout) ? round2(parsedPayout) : calc;
    const isCustom = isPayoutManuallyEdited || Math.abs(finalPayout - calc) >= 0.01;

    let effectiveInterest = 0;
    let principalPenalty = 0;
    const payableDebit = a;
    let extraExpenseDebit = 0;
    let clawbackExpenseCredit = 0;

    if (finalPayout >= p) {
      effectiveInterest = round2(finalPayout - p);
      principalPenalty = 0;
      extraExpenseDebit = Math.max(0, round2(effectiveInterest - a));
      clawbackExpenseCredit = Math.max(0, round2(a - effectiveInterest));
    } else {
      effectiveInterest = 0;
      principalPenalty = round2(p - Math.max(0, finalPayout));
      extraExpenseDebit = 0;
      clawbackExpenseCredit = a;
    }

    const totalDr = round2(p + payableDebit + extraExpenseDebit);
    const totalCr = round2(Math.max(0, finalPayout) + principalPenalty + clawbackExpenseCredit);

    return {
      principal: p,
      provisionedInterest: a,
      calculatedPayout: calc,
      finalPayout,
      isCustom,
      effectiveInterest,
      principalPenalty,
      payableDebit,
      extraExpenseDebit,
      clawbackExpenseCredit,
      totalDr,
      totalCr,
      isBalanced: finalPayout > 0 && Math.abs(totalDr - totalCr) < 0.01,
    };
  }, [formulaCalculation, payoutInputStr, isPayoutManuallyEdited]);

  const handlePayoutInputChange = (rawValue: string) => {
    const normalized = normalizeNumericText(rawValue, false);
    setPayoutInputStr(normalized);
    setIsPayoutManuallyEdited(true);

    const parsed = parseFloat(normalized);
    if (Number.isFinite(parsed)) {
      const adj = round2(parsed - formulaCalculation.principal);
      setNetAdjustmentInputStr(String(adj));
    } else {
      setNetAdjustmentInputStr('');
    }
  };

  const handleNetAdjustmentInputChange = (rawValue: string) => {
    const normalized = normalizeNumericText(rawValue, true);
    setNetAdjustmentInputStr(normalized);
    setIsPayoutManuallyEdited(true);

    if (normalized === '' || normalized === '-') {
      return;
    }
    const parsedAdj = parseFloat(normalized);
    if (Number.isFinite(parsedAdj)) {
      const nextPayout = round2(formulaCalculation.principal + parsedAdj);
      setPayoutInputStr(String(Math.max(0, nextPayout)));
    }
  };

  const handleResetToDefaultCalculation = () => {
    setIsPayoutManuallyEdited(false);
    setPayoutInputStr(String(round2(formulaCalculation.defaultPayout)));
    setNetAdjustmentInputStr(String(round2(formulaCalculation.defaultAdjustment)));
  };

  const loadCustomerSavingAccounts = async (custId?: number, preferredSavingId?: number) => {
    if (!custId || custId <= 0) {
      setCustomerSavingAccounts([]);
      setSavingAccountId(preferredSavingId || 0);
      return;
    }
    setLoadingSavingAccounts(true);
    try {
      const sbRes = await axios.get(`/api/SavingAccounts?customerId=${custId}`);
      const activeSbs = (sbRes.data || []).filter((s: any) => !s.status || s.status === 'Active');
      setCustomerSavingAccounts(activeSbs);
      if (preferredSavingId && preferredSavingId > 0) {
        setSavingAccountId(preferredSavingId);
      } else if (activeSbs.length > 0) {
        setSavingAccountId(activeSbs[0].savingAccountID);
      } else {
        setSavingAccountId(0);
      }
    } catch (err) {
      console.error('Failed to load customer saving accounts:', err);
      setCustomerSavingAccounts([]);
    } finally {
      setLoadingSavingAccounts(false);
    }
  };

  const loadPassingClosure = async (vId: number) => {
    setPassingLoading(true);
    try {
      const res = await axios.get(`/api/RdAccounts/closure-by-voucher/${vId}`);
      const { rdAccount, closureDetails, voucher } = res.data;
      setPassingVoucherData(voucher);
      setPassingClosureMeta(closureDetails || null);

      if (rdAccount) {
        setSelectedAccId(rdAccount.rdAccountID.toString());
        const hydratedAcc: RdAccount = {
          rdAccountID: rdAccount.rdAccountID,
          accountNo: rdAccount.accountNo,
          legacyAccountNumber: rdAccount.legacyAccountNumber,
          memberCode: rdAccount.cifNo || '',
          memberName: rdAccount.customerName || '',
          schemeName: rdAccount.schemeName || '',
          installmentAmount: rdAccount.installmentAmount,
          totalPaidInstallments: rdAccount.totalPaidInstallments,
          totalDepositedAmount: rdAccount.totalDepositedAmount,
          durationMonths: rdAccount.durationMonths,
          interestRate: Number(rdAccount.interestRate || 0),
          prematurePenaltyRate: Number(rdAccount.prematurePenaltyRate ?? 1.0),
          legacyAccruedInt: Number(rdAccount.legacyAccruedInt || 0),
          maturityDate: rdAccount.maturityDate,
          maturityAmount: rdAccount.maturityAmount,
          status: rdAccount.status,
          openingDate: rdAccount.openingDate,
          branchID: rdAccount.branchID,
          customerID: rdAccount.customerID,
        };
        setSelectedAcc(hydratedAcc);

        const hydratedPayout = round2(
          Number(closureDetails?.totalPayoutAmount ?? voucher?.totalAmount ?? rdAccount.totalDepositedAmount)
        );
        const intDiff = round2(hydratedPayout - Number(rdAccount.totalDepositedAmount || 0));
        setAccruedInterest(Math.max(0, intDiff));
        setPayoutInputStr(String(hydratedPayout));
        setNetAdjustmentInputStr(String(intDiff));
        setIsPayoutManuallyEdited(false);

        if (closureDetails?.closureType === 'PrematureClose') {
          setActiveSubTab('premature');
        } else if (closureDetails?.closureType === 'Renewal') {
          setActiveSubTab('renew');
          if (closureDetails?.targetFdSchemeID) {
            setTargetFdSchemeId(String(closureDetails.targetFdSchemeID));
          }
        } else {
          setActiveSubTab('matured');
        }

        if (closureDetails?.closureDate) {
          setClosureDate(closureDetails.closureDate.split('T')[0]);
        }

        const hydratedMode =
          closureDetails?.paymentMode === 'Bank'
            ? 'Bank'
            : closureDetails?.paymentMode === 'Transfer'
              ? 'Transfer'
              : 'Cash';
        setPaymentMode(hydratedMode);
        setBankLedgerId(Number(closureDetails?.bankLedgerID || 0));
        const hydratedSbId = Number(closureDetails?.savingAccountID || 0);
        setSavingAccountId(hydratedSbId);
        await loadCustomerSavingAccounts(rdAccount.customerID, hydratedSbId);
      }
    } catch (err: any) {
      console.error('Error loading RD closure voucher:', err);
      alert('आरडी क्लोजर व्हाउचर लोड करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    if (!window.confirm('आपण खात्रीपूर्वक हे आरडी क्लोजर व्हाउचर मंजूर व पास करू इच्छिता?')) return;
    setPassingActionLoading(true);
    try {
      await axios.post('/api/VoucherPosting/Post', {
        voucherIds: [voucherId],
        approvedBy: user?.userID || 1,
      });
      alert('व्हाउचर यशस्वीरीत्या मंजूर व पास करण्यात आले!');
      if (onNavigate) {
        onNavigate('voucher-posting');
      } else {
        window.location.href = '/?tab=voucher-posting';
      }
    } catch (err: any) {
      const msg =
        typeof err.response?.data === 'string'
          ? err.response.data
          : err.response?.data?.message || err.message;
      alert('व्हाउचर पास करताना त्रुटी: ' + msg);
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
      alert('व्हाउचर यशस्वीरित्या नामंजूर / रद्द करण्यात आले व आरडी खाते पूर्ववत केले!');
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

  const fetchAccounts = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      let cifStr = params.get('cifNo') || params.get('cif');
      let customerIdStr = params.get('customerId') || params.get('customerID');
      let memberIdStr = params.get('memberId') || params.get('memberID');
      let rdAccountIdStr = params.get('rdAccountId') || params.get('accountId') || params.get('id');

      if (!cifStr && !customerIdStr && !memberIdStr && !rdAccountIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              cifStr = bridgeData.cifNo || bridgeData.cif;
              customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
              memberIdStr = bridgeData.memberId ? String(bridgeData.memberId) : null;
              rdAccountIdStr = bridgeData.rdAccountId ? String(bridgeData.rdAccountId) : null;
            }
          }
        } catch (e) {
          console.error('Failed to read sessionStorage transfer:', e);
        }
      }

      const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;
      const mId = memberIdStr ? parseInt(memberIdStr, 10) : 0;
      const targetAccId = rdAccountIdStr ? parseInt(rdAccountIdStr, 10) : 0;
      let fastTrackDone = false;

      if (targetAccId > 0) {
        try {
          const singleRes = await axios.get(`/api/RdAccounts/${targetAccId}`);
          const accDetails = singleRes.data?.AccountDetails || singleRes.data?.accountDetails || singleRes.data;
          if (accDetails && accDetails.rdAccountID) {
            setAccounts([accDetails]);
            setSelectedAccId(accDetails.rdAccountID.toString());
            handleAccountChange(accDetails.rdAccountID.toString());
            fastTrackDone = true;
          }
        } catch (err) {
          console.warn('Fast-track targeted RD account lookup failed, falling back', err);
        }
      } else if (cId > 0 || mId > 0) {
        try {
          const queryParam = cId > 0 ? `customerId=${cId}` : `memberId=${mId}`;
          const custRes = await axios.get(`/api/RdAccounts?${queryParam}`);
          const active = (custRes.data || []).filter((a: any) => a.status === 'Active' || a.status === 'Matured');
          if (active.length > 0) {
            setAccounts(active);
            setSelectedAccId(active[0].rdAccountID.toString());
            handleAccountChange(active[0].rdAccountID.toString());
            fastTrackDone = true;
          }
        } catch (err) {
          console.warn('Fast-track customer RD lookup failed, falling back', err);
        }
      }

      if (!fastTrackDone) {
        const res = await axios.get('/api/RdAccounts');
        const active = (res.data || []).filter((a: any) => a.status === 'Active' || a.status === 'Matured');
        setAccounts(active);

        if (cId > 0 || mId > 0 || cifStr) {
          const matchedAcc = active.find(
            (a: any) =>
              (cId > 0 && a.customerID === cId) ||
              (mId > 0 && a.memberID === mId) ||
              (cifStr && a.cifNo && a.cifNo.trim().toUpperCase() === cifStr.trim().toUpperCase())
          );
          if (matchedAcc) {
            setSelectedAccId(matchedAcc.rdAccountID.toString());
            handleAccountChange(matchedAcc.rdAccountID.toString());
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFdSchemes = async () => {
    try {
      const res = await axios.get('/api/FdSchemes');
      setFdSchemes((res.data || []).filter((s: any) => s.isActive));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchFdSchemes();
    if (voucherId) {
      loadPassingClosure(voucherId);
    }
  }, [voucherId]);

  const computeDeduplicatedAccruedInterest = (accDetails: any, historyList: any[]): number => {
    if (typeof accDetails?.effectiveAccruedInt === 'number' && Number.isFinite(accDetails.effectiveAccruedInt)) {
      return round2(Math.max(0, accDetails.effectiveAccruedInt));
    }
    const nonMigratedCr = (historyList || [])
      .filter(
        (t: any) =>
          t.transactionType === 'Accrual' &&
          (t.debitCredit || 'Cr') === 'Cr' &&
          !String(t.narration || '').includes('मायग्रेटेड आरडी संचित व्याज')
      )
      .reduce((sum: number, t: any) => sum + Number(t.interestAmount || 0), 0);

    const accrualDr = (historyList || [])
      .filter((t: any) => t.transactionType === 'Accrual' && t.debitCredit === 'Dr')
      .reduce((sum: number, t: any) => sum + Number(t.interestAmount || 0), 0);

    return round2(Math.max(0, nonMigratedCr - accrualDr + Number(accDetails?.legacyAccruedInt || 0)));
  };

  const handleAccountChange = async (e: any) => {
    const val = e?.target?.value ?? e;
    setSelectedAccId(val);
    setIsPayoutManuallyEdited(false);
    setClosureRemarks('');
    setMessage('');

    if (val) {
      try {
        const res = await axios.get(`/api/RdAccounts/${val}`);
        const accDetails = res.data.accountDetails || res.data.AccountDetails || res.data;
        const historyList = res.data.history || res.data.History || [];

        const effectiveAccrued = computeDeduplicatedAccruedInterest(accDetails, historyList);
        setSelectedAcc(accDetails);
        setAccruedInterest(effectiveAccrued);

        await loadCustomerSavingAccounts(
          accDetails.customerID,
          accDetails.savingAccountID ? Number(accDetails.savingAccountID) : undefined
        );

        // Smart tab default: Matured if status is Matured OR all installments paid OR maturity date reached
        const shouldDefaultMatured = isTermCompletedForAccount(accDetails, closureDate || activeBusinessDate);
        setActiveSubTab(shouldDefaultMatured ? 'matured' : 'premature');
      } catch (err) {
        console.error(err);
      }
    } else {
      setSelectedAcc(null);
      setAccruedInterest(0);
      setPayoutInputStr('');
      setNetAdjustmentInputStr('');
      setCustomerSavingAccounts([]);
      setSavingAccountId(0);
    }
  };

  const handleTabSwitch = (nextTab: 'matured' | 'premature' | 'renew') => {
    setActiveSubTab(nextTab);
    setIsPayoutManuallyEdited(false);
    setMessage('');
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPassingMode) return;
    if (!selectedAcc) return;

    if (selectedAcc.isLienMarked) {
      setMessage(
        `या आरडी खात्यावर कर्जाचे तारण (Lien: ${selectedAcc.lienLoanAccountNo || 'सक्रिय कर्ज'}) नोंदवलेले असल्यामुळे खाते बंद करता येत नाही.`
      );
      return;
    }

    const parsedFinalPayout = parseFloat(payoutInputStr);
    if (!Number.isFinite(parsedFinalPayout) || parsedFinalPayout <= 0) {
      setMessage('कृपया वैध अंतिम देय परतावा रक्कम (शून्यापेक्षा जास्त) प्रविष्ट करा.');
      return;
    }

    if (activeSubTab === 'matured' || activeSubTab === 'premature') {
      if (paymentMode === 'Bank' && (!bankLedgerId || bankLedgerId <= 0)) {
        setMessage('बँक पेमेंटसाठी कृपया बँक जी.एल. खाते (Bank GL Account) निवडा.');
        return;
      }
      if (paymentMode === 'Transfer' && (!savingAccountId || savingAccountId <= 0)) {
        setMessage('बचत खात्यात वर्ग करण्यासाठी कृपया खातेदाराचे सक्रिय बचत खाते निवडा.');
        return;
      }
    } else if (activeSubTab === 'renew') {
      if (!targetFdSchemeId) {
        setMessage('कृपया नूतनीकरणासाठी टार्गेट मुदत ठेव योजना निवडा.');
        return;
      }
    }

    setLoading(true);
    setMessage('');
    try {
      const finalAmtRounded = round2(parsedFinalPayout);
      const qParams = new URLSearchParams({
        closureDate,
      });

      if (activeSubTab === 'matured' || activeSubTab === 'premature') {
        qParams.set('paymentMode', paymentMode);
        if (paymentMode === 'Bank' && bankLedgerId > 0) {
          qParams.set('bankLedgerId', String(bankLedgerId));
        }
        if (paymentMode === 'Transfer' && savingAccountId > 0) {
          qParams.set('savingAccountId', String(savingAccountId));
        }
      }

      if (isPayoutManuallyEdited || Math.abs(finalAmtRounded - formulaCalculation.defaultPayout) >= 0.01) {
        qParams.set('customPayoutAmount', finalAmtRounded.toFixed(2));
      }
      if (closureRemarks.trim()) {
        qParams.set('remarks', closureRemarks.trim());
      }

      if (activeSubTab === 'matured') {
        const res = await axios.post(`/api/RdAccounts/${selectedAcc.rdAccountID}/MaturedClose?${qParams.toString()}`);
        setMessage(
          typeof res.data === 'string'
            ? res.data
            : res.data?.message || `आरडी मुदतपूर्ती खाते यशस्वीरित्या बंद करण्यात आले! अंतिम परतावा: ₹${formatINR(finalAmtRounded)}`
        );
      } else if (activeSubTab === 'premature') {
        const res = await axios.post(`/api/RdAccounts/${selectedAcc.rdAccountID}/PrematureClose?${qParams.toString()}`);
        setMessage(
          res.data?.message || `मुदतपूर्व खाते यशस्वीरित्या बंद करण्यात आले! अंतिम परतावा: ₹${formatINR(finalAmtRounded)}`
        );
      } else if (activeSubTab === 'renew') {
        qParams.set('targetSchemeId', targetFdSchemeId);
        const res = await axios.post(`/api/RdAccounts/${selectedAcc.rdAccountID}/Renew?${qParams.toString()}`);
        const newFdNo = res.data?.fdAccountNo || res.data?.FdAccountNo || '';
        setMessage(
          `नूतनीकरण यशस्वी! नवीन एफडी खाते क्रमांक: ${newFdNo} (वर्ग रक्कम: ₹${formatINR(finalAmtRounded)})`
        );
      }

      setSelectedAccId('');
      setSelectedAcc(null);
      setAccruedInterest(0);
      setPayoutInputStr('');
      setNetAdjustmentInputStr('');
      setIsPayoutManuallyEdited(false);
      setClosureRemarks('');
      setPaymentMode('Cash');
      setBankLedgerId(0);
      setSavingAccountId(0);
      setCustomerSavingAccounts([]);
      fetchAccounts();
    } catch (err: any) {
      const errMsg =
        typeof err.response?.data === 'string'
          ? err.response.data
          : err.response?.data?.message || err.response?.data?.title || 'खाते बंद करताना काही तांत्रिक त्रुटी आली.';
      setMessage(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const labelClass = 'block text-xs font-bold text-gray-700 mb-1';
  const inputClass =
    'w-full text-xs border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary bg-white text-gray-900';

  const resolveSettlementCreditLedgerLabel = (): string => {
    if (activeSubTab === 'renew') {
      const fdSch = fdSchemes.find((s) => String(s.fdSchemeID) === String(targetFdSchemeId));
      return fdSch ? `मुदत ठेव खाते (${fdSch.schemeName})` : '१२ मुदत ठेव खाते (FD Liability)';
    }
    if (paymentMode === 'Bank') {
      return 'निवडलेले बँक जी.एल. खाते (Bank GL)';
    }
    if (paymentMode === 'Transfer') {
      const sb = customerSavingAccounts.find((s) => Number(s.savingAccountID) === Number(savingAccountId));
      return sb ? `बचत ठेव खाते (${sb.accountNo || sb.accountNumber})` : 'बचत ठेव खाते (Saving Liability)';
    }
    return 'रोख खाते (Cash in Hand GL)';
  };

  const renderPayoutDestinationSection = () => (
    <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-sm">
      <div>
        <label className={labelClass}>
          पेमेंट पद्धत (Payout Mode) <span className="text-red-500">*</span>
        </label>
        <select
          value={paymentMode}
          onChange={(e) => setPaymentMode(e.target.value as 'Cash' | 'Bank' | 'Transfer')}
          className={inputClass}
          disabled={isPassingMode}
          required
        >
          <option value="Cash">💵 रोख परतावा (Cash Payout)</option>
          <option value="Bank">🏦 बँक ट्रान्सफर (Bank Account)</option>
          <option value="Transfer">💳 बचत खात्यात वर्ग (Transfer to Saving Account)</option>
        </select>
      </div>

      {paymentMode === 'Cash' && (
        <CashLedgerReflectBadge
          branchId={selectedAcc?.branchID}
          transactionType="Withdrawal"
          customTitle="रोख परतावा खाते (Cash Payout Ledger)"
        />
      )}

      {paymentMode === 'Bank' && (
        <BankLedgerSelect
          value={bankLedgerId}
          onChange={(id) => setBankLedgerId(id)}
          disabled={isPassingMode}
          required
          showCountBadge
        />
      )}

      {paymentMode === 'Transfer' && (
        <div className="space-y-1.5">
          <label className={labelClass}>
            जमा करावयाचे बचत खाते निवडा (Target Saving Account) <span className="text-red-500">*</span>
          </label>
          <select
            value={savingAccountId || ''}
            onChange={(e) => setSavingAccountId(Number(e.target.value) || 0)}
            className={inputClass}
            disabled={isPassingMode || loadingSavingAccounts}
            required
          >
            <option value="">
              {loadingSavingAccounts ? 'बचत खाती लोड होत आहेत...' : '--- बचत खाते निवडा ---'}
            </option>
            {customerSavingAccounts.map((sb: any) => (
              <option key={sb.savingAccountID} value={sb.savingAccountID}>
                {sb.accountNo || sb.accountNumber} ({sb.schemeName || 'बचत खाते'}) — शिल्लक: ₹
                {Number(sb.currentBalance ?? sb.balance ?? 0).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                })}
              </option>
            ))}
          </select>
          {!loadingSavingAccounts && customerSavingAccounts.length === 0 && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-300 rounded-sm px-2.5 py-1.5 font-medium">
              ⚠️ या ग्राहकाचे कोणतेही सक्रिय बचत खाते आढळले नाही. कृपया रोख किंवा बँक पेमेंट पद्धत निवडा, अथवा प्रथम बचत खाते उघडा.
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderEditableSettlementPanel = () => {
    if (!selectedAcc) return null;

    const rdLiabilityName = selectedAcc.rdLiabilityLedgerName || '१३ मेंबर आरडी ठेव';
    const intPayableName = selectedAcc.interestPayableLedgerName || '२३ देणे सभासद ठेव व्याज';
    const intExpenseName = selectedAcc.interestExpenseLedgerName || '१३४ आरडी ठेवीवरील व्याज';
    const penaltyLedgerName = selectedAcc.penaltyIncomeLedgerName || '४६ आरडी दंड आकारणी';
    const payoutTitle =
      activeSubTab === 'renew'
        ? 'अंतिम नूतनीकरण वर्ग रक्कम (Editable Renewal Amount ₹)'
        : 'अंतिम देय परतावा रक्कम (Editable Net Payout ₹)';

    return (
      <div className="bg-emerald-50/50 border border-emerald-200 rounded-sm p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>💰 परतावा हिशोब व संपादन पॅनेल (Settlement & Editable Payout)</span>
              {liveSettlement.isCustom && !isPassingMode && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded">
                  ✏️ संपादित (मूळ हिशोब: ₹{formatINR(liveSettlement.calculatedPayout)})
                </span>
              )}
            </h3>
            {activeSubTab === 'premature' && !isPassingMode && (
              <p className="text-[11px] text-slate-600 mt-0.5">
                कालावधी: <strong>{formulaCalculation.prematureMonths} महिने</strong> | लागू व्याजदर:{' '}
                <strong>{formulaCalculation.prematureRate}%</strong> ({selectedAcc.interestRate}% -{' '}
                {formulaCalculation.penaltyRate}% दंड) | सूत्रानुसार व्याज:{' '}
                <strong>₹{formatINR(formulaCalculation.recalcPrematureInt)}</strong>
              </p>
            )}
          </div>

          {!isPassingMode && (
            <button
              type="button"
              onClick={handleResetToDefaultCalculation}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-sm text-[11px] border border-slate-300 shadow-sm transition"
              title="सूत्रानुसार मूळ परतावा रक्कम पूर्ववत करा"
            >
              🔄 मूळ हिशोब पूर्ववत करा (Reset)
            </button>
          )}
        </div>

        {/* Summary breakdown cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="bg-white p-2.5 rounded-sm border border-slate-200">
            <span className="block text-[11px] text-slate-500">१. एकूण जमा मुद्दल (Principal)</span>
            <span className="text-sm font-bold text-blue-700">₹ {formatINR(liveSettlement.principal)}</span>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-slate-200">
            <span className="block text-[11px] text-slate-500">२. पूर्वी तरतूद व्याज (Accrued GL)</span>
            <span className="text-sm font-bold text-teal-700">
              ₹ {formatINR(liveSettlement.provisionedInterest)}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-slate-200">
            <span className="block text-[11px] text-slate-500">
              {liveSettlement.principalPenalty > 0
                ? '३. मुद्दलातून दंड वजावट (Penalty)'
                : '३. प्रत्यक्ष देय व्याज (Payable Interest)'}
            </span>
            {liveSettlement.principalPenalty > 0 ? (
              <span className="text-sm font-bold text-red-600">
                - ₹ {formatINR(liveSettlement.principalPenalty)}
              </span>
            ) : (
              <span className="text-sm font-bold text-emerald-700">
                + ₹ {formatINR(liveSettlement.effectiveInterest)}
              </span>
            )}
          </div>
        </div>

        {/* Two-way synced editable inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              निव्वळ देय व्याज (+) / दंड वजावट (-) (₹)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="text"
                value={netAdjustmentInputStr}
                onChange={(e) => handleNetAdjustmentInputChange(e.target.value)}
                disabled={isPassingMode}
                placeholder="उदा. 500 किंवा -150"
                className="w-full text-sm font-bold border border-slate-300 rounded-sm px-2.5 py-1.5 focus:outline-none focus:border-primary bg-white text-slate-900"
              />
            </div>
            <p className="text-[10.5px] text-slate-500 mt-1">
              धन (+) रक्कम = देय व्याज; उणे (-) रक्कम = मुद्दलातून दंड कपात.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-emerald-900 mb-1">
              {payoutTitle} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-700">
                ₹
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={payoutInputStr}
                onChange={(e) => handlePayoutInputChange(e.target.value)}
                disabled={isPassingMode}
                required
                placeholder="परतावा रक्कम टाका..."
                className="w-full text-base font-black border-2 border-emerald-500 rounded-sm pl-7 pr-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white text-emerald-800 shadow-sm"
              />
            </div>
            <p className="text-[10.5px] text-emerald-800 mt-1 font-medium">
              मराठी (०-९) व इंग्रजी (0-9) दोन्ही अंकास सपोर्ट; गरजेनुसार रक्कम संपादित करा.
            </p>
          </div>
        </div>

        {/* Accounting adjustment pills */}
        {(liveSettlement.extraExpenseDebit > 0 ||
          liveSettlement.clawbackExpenseCredit > 0 ||
          liveSettlement.principalPenalty > 0) && (
          <div className="flex flex-wrap gap-2 text-[11px] pt-1">
            {liveSettlement.payableDebit > 0 && (
              <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded font-medium">
                देणे व्याज तरतूद नावे (Dr): ₹{formatINR(liveSettlement.payableDebit)}
              </span>
            )}
            {liveSettlement.extraExpenseDebit > 0 && (
              <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded font-medium">
                अतिरिक्त व्याज खर्च नावे (Dr): ₹{formatINR(liveSettlement.extraExpenseDebit)}
              </span>
            )}
            {liveSettlement.clawbackExpenseCredit > 0 && (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-medium">
                जास्तीची व्याज तरतूद परत जमा (Cr Clawback): ₹{formatINR(liveSettlement.clawbackExpenseCredit)}
              </span>
            )}
            {liveSettlement.principalPenalty > 0 && (
              <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded font-medium">
                आरडी दंड उत्पन्न जमा (Cr Penalty): ₹{formatINR(liveSettlement.principalPenalty)}
              </span>
            )}
          </div>
        )}

        {/* Optional Audit Remarks when edited */}
        {!isPassingMode && (
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              शेरा / टीप (Remarks - ऐच्छिक)
            </label>
            <input
              type="text"
              value={closureRemarks}
              onChange={(e) => setClosureRemarks(e.target.value)}
              placeholder="परतावा रकमेत बदल केल्यास कारण / शेरा येथे लिहा..."
              className={inputClass}
            />
          </div>
        )}

        {/* Collapsible Accounting Voucher Preview */}
        <div className="pt-1 border-t border-emerald-200/80">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowVoucherPreview((prev) => !prev)}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>{showVoucherPreview ? '▾' : '▸'} लेखा व्हाउचर नोंदी प्रिव्ह्यू पहा (Accounting Voucher Preview)</span>
            </button>
            <span
              className={`text-[10.5px] font-bold px-2 py-0.5 rounded ${
                liveSettlement.isBalanced
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-red-100 text-red-700 border border-red-300'
              }`}
            >
              {liveSettlement.isBalanced
                ? `✓ संतुलित (Dr = Cr = ₹${formatINR(liveSettlement.totalDr)})`
                : '⚠️ असंतुलित रक्कम'}
            </span>
          </div>

          {showVoucherPreview && (
            <div className="mt-2 bg-white border border-slate-200 rounded-sm overflow-hidden">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-2.5 py-1.5">लेजर खाते (GL Account)</th>
                    <th className="text-center px-2 py-1.5 w-16">प्रकार</th>
                    <th className="text-right px-2.5 py-1.5 w-28">नावे (Dr ₹)</th>
                    <th className="text-right px-2.5 py-1.5 w-28">जमा (Cr ₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {liveSettlement.principal > 0 && (
                    <tr>
                      <td className="px-2.5 py-1 font-medium text-slate-800">
                        {rdLiabilityName} <span className="text-slate-400">(मुद्दल निर्लेखन)</span>
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-rose-700">Dr</td>
                      <td className="px-2.5 py-1 text-right font-semibold">{formatINR(liveSettlement.principal)}</td>
                      <td className="px-2.5 py-1 text-right text-slate-400">-</td>
                    </tr>
                  )}
                  {liveSettlement.payableDebit > 0 && (
                    <tr>
                      <td className="px-2.5 py-1 font-medium text-slate-800">
                        {intPayableName} <span className="text-slate-400">(तरतूद निर्लेखन)</span>
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-rose-700">Dr</td>
                      <td className="px-2.5 py-1 text-right font-semibold">{formatINR(liveSettlement.payableDebit)}</td>
                      <td className="px-2.5 py-1 text-right text-slate-400">-</td>
                    </tr>
                  )}
                  {liveSettlement.extraExpenseDebit > 0 && (
                    <tr>
                      <td className="px-2.5 py-1 font-medium text-slate-800">
                        {intExpenseName} <span className="text-slate-400">(चालू व्याज खर्च)</span>
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-rose-700">Dr</td>
                      <td className="px-2.5 py-1 text-right font-semibold">
                        {formatINR(liveSettlement.extraExpenseDebit)}
                      </td>
                      <td className="px-2.5 py-1 text-right text-slate-400">-</td>
                    </tr>
                  )}
                  {liveSettlement.finalPayout > 0 && (
                    <tr className="bg-emerald-50/40">
                      <td className="px-2.5 py-1 font-bold text-emerald-900">
                        {resolveSettlementCreditLedgerLabel()} <span className="text-emerald-700">(अंतिम परतावा)</span>
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-emerald-700">Cr</td>
                      <td className="px-2.5 py-1 text-right text-slate-400">-</td>
                      <td className="px-2.5 py-1 text-right font-bold text-emerald-800">
                        {formatINR(liveSettlement.finalPayout)}
                      </td>
                    </tr>
                  )}
                  {liveSettlement.clawbackExpenseCredit > 0 && (
                    <tr>
                      <td className="px-2.5 py-1 font-medium text-slate-800">
                        {intExpenseName} <span className="text-slate-400">(जास्तीची तरतूद परत / Clawback)</span>
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-emerald-700">Cr</td>
                      <td className="px-2.5 py-1 text-right text-slate-400">-</td>
                      <td className="px-2.5 py-1 text-right font-semibold">
                        {formatINR(liveSettlement.clawbackExpenseCredit)}
                      </td>
                    </tr>
                  )}
                  {liveSettlement.principalPenalty > 0 && (
                    <tr>
                      <td className="px-2.5 py-1 font-medium text-slate-800">
                        {penaltyLedgerName} <span className="text-slate-400">(मुद्दलातून दंड वजावट)</span>
                      </td>
                      <td className="px-2 py-1 text-center font-bold text-emerald-700">Cr</td>
                      <td className="px-2.5 py-1 text-right text-slate-400">-</td>
                      <td className="px-2.5 py-1 text-right font-semibold">
                        {formatINR(liveSettlement.principalPenalty)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                  <tr>
                    <td className="px-2.5 py-1.5" colSpan={2}>
                      एकूण व्हाउचर बेरीज (Total)
                    </td>
                    <td className="px-2.5 py-1.5 text-right">₹ {formatINR(liveSettlement.totalDr)}</td>
                    <td className="px-2.5 py-1.5 text-right">₹ {formatINR(liveSettlement.totalCr)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 space-y-4">
      {/* Passing Mode Banner */}
      {isPassingMode && (
        <div className="bg-amber-500 text-white p-3 rounded-sm shadow flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold text-sm">व्हाउचर तपासणी व पासिंग मोड (Checker Inspection Mode)</p>
              <p className="text-xs text-amber-100">
                व्हाउचर क्र:{' '}
                <span className="font-mono font-bold text-white">{passingVoucherData?.voucherNo || voucherId}</span> |
                परतावा रक्कम:{' '}
                <span className="font-bold text-white">
                  ₹
                  {formatINR(
                    Number(
                      passingClosureMeta?.totalPayoutAmount ??
                        passingVoucherData?.totalAmount ??
                        selectedAcc?.totalDepositedAmount ??
                        0
                    )
                  )}
                </span>{' '}
                | स्थिती:{' '}
                <span className="font-bold text-white">{passingVoucherData?.status || 'तपासणीसाठी प्रलंबित'}</span>
                {passingClosureMeta?.renewedFdAccountNo && (
                  <>
                    {' '}
                    | नवीन एफडी:{' '}
                    <span className="font-mono font-bold text-white">{passingClosureMeta.renewedFdAccountNo}</span>
                  </>
                )}
                {passingVoucherData?.narration && ` | तपशील: ${passingVoucherData.narration}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() =>
                onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')
              }
              className="px-3 py-1 bg-white text-amber-800 text-xs font-bold rounded shadow hover:bg-amber-50"
            >
              ↩️ पासिंग यादीवर परत जा
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-2 rounded-sm shadow-sm border border-gray-200">
        <div>
          <h1 className="text-base font-bold text-primary">
            आरडी मुदतपूर्ती पेमेंट आणि खाते बंद (Payout & Closure)
            {isPassingMode && (
              <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                (फक्त वाचन मोड)
              </span>
            )}
          </h1>
        </div>
      </div>

      {message && (
        <div
          className={`text-xs p-2.5 rounded-sm border font-medium ${
            message.includes('यशस्वी') || message.includes('completed')
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'bg-red-100 border-red-300 text-red-700'
          }`}
        >
          {message}
        </div>
      )}

      {/* Main Layout */}
      <fieldset disabled={isPassingMode} className="contents">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Account Details Panel */}
          <div className="lg:col-span-1 bg-white p-3 rounded-sm shadow-sm border border-gray-200 space-y-3 h-fit">
            <h2 className="text-xs font-bold text-primary border-b pb-1">खाते निवडा (Select Account)</h2>
            <div>
              <SearchableSelect
                options={accounts.map((a) => {
                  const legBadge = a.legacyAccountNumber ? ` [🏷️ जुने: ${a.legacyAccountNumber}]` : '';
                  const holderLabel = a.memberName || a.customerName || '';
                  return {
                    value: a.rdAccountID,
                    label: `${a.accountNo}${legBadge} - ${holderLabel}`,
                  };
                })}
                value={selectedAccId}
                onChange={handleAccountChange}
                placeholder="नाव, जुना किंवा नवीन खाते क्रमांकाने शोधा..."
                disabled={isPassingMode}
              />
            </div>

            {selectedAcc && (
              <div className="border-t border-gray-200 pt-3 space-y-2.5 text-xs text-gray-700">
                <div className="flex justify-between items-center">
                  <span>खातेदार नाव:</span>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">
                      {selectedAcc.memberName || selectedAcc.customerName}
                    </span>
                    {selectedAcc.legacyAccountNumber && (
                      <span className="block text-[9.5px] font-mono font-bold text-purple-950 bg-purple-100 border border-purple-300 px-1 py-0.2 rounded mt-0.5">
                        🏷️ जुने आरडी: {selectedAcc.legacyAccountNumber}
                      </span>
                    )}
                  </div>
                </div>
                {selectedAcc.schemeName && (
                  <div className="flex justify-between">
                    <span>आरडी योजना ( व्याजदर ):</span>
                    <span className="font-semibold text-gray-800">
                      {selectedAcc.schemeName} ({selectedAcc.interestRate}%)
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>मासिक हप्ता:</span>
                  <span className="font-semibold text-gray-800">₹ {formatINR(selectedAcc.installmentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>भरलेले एकूण हप्ते:</span>
                  <span className="font-semibold">
                    {selectedAcc.totalPaidInstallments} / {selectedAcc.durationMonths} महिने
                  </span>
                </div>
                {selectedAcc.maturityDate && (
                  <div className="flex justify-between">
                    <span>मुदतपूर्ती दिनांक:</span>
                    <span className="font-medium text-gray-800">
                      {new Date(selectedAcc.maturityDate).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>एकूण जमा मुद्दल:</span>
                  <span className="font-bold text-blue-700">₹ {formatINR(selectedAcc.totalDepositedAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>जमा व्याज (Accrued):</span>
                  <span className="font-bold text-emerald-600">₹ {formatINR(accruedInterest)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>सध्याची खाते स्थिती:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      selectedAcc.status === 'Matured' ||
                      isTermCompletedForAccount(selectedAcc, closureDate || activeBusinessDate)
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-green-100 text-green-700 border border-green-200'
                    }`}
                  >
                    {selectedAcc.status}
                    {selectedAcc.status === 'Active' &&
                      isTermCompletedForAccount(selectedAcc, closureDate || activeBusinessDate) &&
                      ' (मुदत पूर्ण)'}
                  </span>
                </div>

                {selectedAcc.isLienMarked && (
                  <div className="p-2 bg-red-50 border border-red-300 rounded-sm text-[11px] text-red-700 font-semibold">
                    🔒 या आरडी खात्यावर कर्जाचे तारण (Lien: {selectedAcc.lienLoanAccountNo || 'सक्रिय कर्ज'}) नोंदवलेले
                    आहे. तारण मुक्त झाल्याशिवाय खाते बंद करता येणार नाही.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Panel Column */}
          <div className="lg:col-span-2 space-y-4">
            {selectedAcc ? (
              <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200 space-y-3">
                {/* Internal Tab Headers */}
                <div className="flex border-b border-gray-200 pb-2 mb-3">
                  <button
                    type="button"
                    disabled={isPassingMode}
                    onClick={() => handleTabSwitch('matured')}
                    className={`flex-1 pb-1.5 text-xs font-bold text-center border-b-2 transition duration-200 ${
                      activeSubTab === 'matured'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    मुदतपूर्ती बंद (Matured)
                  </button>
                  <button
                    type="button"
                    disabled={isPassingMode}
                    onClick={() => handleTabSwitch('premature')}
                    className={`flex-1 pb-1.5 text-xs font-bold text-center border-b-2 transition duration-200 ${
                      activeSubTab === 'premature'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    मुदतपूर्व बंद (Premature)
                  </button>
                  <button
                    type="button"
                    disabled={isPassingMode}
                    onClick={() => handleTabSwitch('renew')}
                    className={`flex-1 pb-1.5 text-xs font-bold text-center border-b-2 transition duration-200 ${
                      activeSubTab === 'renew'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    नूतनीकरण (Renewal)
                  </button>
                </div>

                {/* Form Content depending on active tab */}
                <form onSubmit={handleCloseSubmit} className="space-y-4">
                  {activeSubTab === 'matured' && (
                    <div className="space-y-3">
                      {!isTermCompletedForAccount(selectedAcc, closureDate) && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-800">
                          <strong>सूचना:</strong> या खात्याचे सर्व हप्ते ({selectedAcc.totalPaidInstallments}/
                          {selectedAcc.durationMonths}) अद्याप पूर्ण भरलेले नाहीत; मुदतपूर्व बंदसाठी{' '}
                          <strong>मुदतपूर्व बंद (Premature)</strong> टॅब वापरू शकता किंवा खालील देय परतावा रक्कम तपासून
                          सबमिट करू शकता.
                        </div>
                      )}
                      <div>
                        <label className={labelClass}>
                          मुदतपूर्ती पावती तारीख (Maturity Payout Date) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={closureDate}
                          onChange={(e) => setClosureDate(e.target.value)}
                          className={inputClass}
                          required
                        />
                      </div>
                      {renderPayoutDestinationSection()}
                      {renderEditableSettlementPanel()}
                    </div>
                  )}

                  {activeSubTab === 'premature' && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          बंद केल्याची तारीख (Closure Date) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={closureDate}
                          onChange={(e) => {
                            setClosureDate(e.target.value);
                            setIsPayoutManuallyEdited(false);
                          }}
                          className={inputClass}
                          required
                        />
                      </div>
                      {renderPayoutDestinationSection()}
                      {renderEditableSettlementPanel()}
                    </div>
                  )}

                  {activeSubTab === 'renew' && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          नूतनीकरण तारीख (Renewal Date) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={closureDate}
                          onChange={(e) => setClosureDate(e.target.value)}
                          className={inputClass}
                          required
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          नूतनीकरण योजना निवडा (Select Target FD Scheme) <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={targetFdSchemeId}
                          onChange={(e) => setTargetFdSchemeId(e.target.value)}
                          className={inputClass}
                          required
                        >
                          <option value="">--- मुदत ठेव (FD) योजना निवडा ---</option>
                          {fdSchemes
                            .filter((s) => !selectedAcc?.branchID || !s.branchID || s.branchID === selectedAcc.branchID)
                            .map((s) => (
                              <option key={s.fdSchemeID} value={s.fdSchemeID}>
                                {s.branchID ? `🏢 [${s.branch?.branchName || 'विशिष्ट शाखा'}] ` : '🌐 [सर्व शाखा] '}
                                {s.schemeName} ({s.interestRate}% - {s.durationMonths} महिने)
                              </option>
                            ))}
                        </select>
                      </div>
                      {renderEditableSettlementPanel()}
                    </div>
                  )}

                  {!isPassingMode && (
                    <div className="flex justify-end pt-3 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={loading || !!selectedAcc.isLienMarked || !liveSettlement.isBalanced}
                        className="px-5 py-1.5 bg-primary hover:bg-[#004a75] text-white font-semibold rounded-sm text-xs shadow-sm transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading
                          ? 'प्रक्रिया चालू आहे...'
                          : activeSubTab === 'renew'
                            ? `आरडी नूतनीकरण सबमिट करा (₹${formatINR(liveSettlement.finalPayout)})`
                            : `खाते बंद व्यवहार सबमिट करा (₹${formatINR(liveSettlement.finalPayout)})`}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-sm p-8 text-center text-gray-500 font-medium text-xs">
                खाते बंद / मॅच्युरिटी व्यवहार करण्यासाठी डाव्या बाजूकडील पॅनेलमधून सक्रीय खाते निवडा.
              </div>
            )}
          </div>
        </div>
      </fieldset>

      {/* Passing Mode Actions Bar */}
      {isPassingMode && (
        <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200 flex justify-between items-center">
          <button
            type="button"
            onClick={() =>
              onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')
            }
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-750 font-bold rounded text-xs border border-gray-300 transition"
          >
            ↩️ पासिंग यादीवर परत जा (Back to Queue)
          </button>
          <div className="flex space-x-3">
            <button
              type="button"
              disabled={passingActionLoading}
              onClick={() => setRejectModalOpen(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs shadow transition disabled:opacity-50"
            >
              ❌ नामंजूर / रद्द करा (Reject Voucher)
            </button>
            <button
              type="button"
              disabled={passingActionLoading || passingVoucherData?.canPass === false}
              onClick={handlePassVoucher}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs shadow transition disabled:opacity-50"
            >
              {passingActionLoading ? 'पास करत आहे...' : '✅ मंजूर व पास करा (Approve & Pass)'}
            </button>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-md w-full p-4 space-y-3 shadow-xl">
            <h3 className="text-sm font-bold text-red-600">व्हाउचर नामंजूर / रद्द करा</h3>
            <p className="text-xs text-gray-600">
              कृपया हे व्हाउचर का नामंजूर किंवा रद्द करत आहात याचे स्पष्ट कारण लिहा (व्हाउचर रद्द केल्यावर आरडी खाते व
              बचत/एफडी शिल्लक सुरक्षितपणे पूर्ववत होईल):
            </p>
            <textarea
              className="w-full border border-gray-300 rounded p-2 text-xs focus:ring-1 focus:ring-red-500"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="नामंजूरीचे कारण नमूद करा..."
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold hover:bg-gray-50"
              >
                रद्द करा (Cancel)
              </button>
              <button
                type="button"
                disabled={passingActionLoading || !rejectReason.trim()}
                onClick={handleRejectVoucher}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition disabled:opacity-50"
              >
                {passingActionLoading ? 'प्रक्रिया सुरू...' : 'पुष्टी करा व रद्द करा'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

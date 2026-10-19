import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import { MemberOption } from './common/MemberSearchSelect';
import FdReceiptPrintModal from './FdReceiptPrintModal';
import { FdInterestScheduleModal } from './FdInterestScheduleModal';
import { generateFdInterestSchedule } from '../utils/fdInterestSchedule';

interface Member extends MemberOption {}

interface FdScheme {
  fdSchemeID: number;
  schemeName: string;
  schemeCode: string;
  interestRate: number;
  seniorCitizenInterestRate: number;
  durationMonths: number;
  interestType: string;
  interestCompoundingFrequency: string;
  minimumAmount: number;
  maximumAmount: number;
  schemeDurationModel?: string;
  durationType?: string;
  slabs?: any[];
}

export interface BulkReceiptRow {
  id: string;
  accountNo: string;
  legacyAccountNumber: string;
  depositAmount: number | '';
  durationType: 'Days' | 'Months' | 'Years';
  durationValue: number;
  durationInDays: number;
  interestRate: number;
  maturityDate: string;
  maturityAmount: number;
}

interface FdAccount {
  fdAccountID: number;
  accountNo: string;
  legacyAccountNumber?: string;
  customerName?: string;
  memberName: string;
  memberCode: string;
  cifNo?: string;
  schemeName: string;
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  nomineeName: string;
  paymentMode?: string;
}

export interface FdAccountOpeningProps {
  voucherId?: number;
  isPassingMode?: boolean;
  onNavigate?: (tab: string) => void;
}

const FdAccountOpening: React.FC<FdAccountOpeningProps> = ({
  voucherId: propVoucherId,
  isPassingMode: propIsPassingMode,
  onNavigate
}) => {
  const { user } = useAuth();
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

  const [view, setView] = useState<'form' | 'list'>('form');
  const [customers, setCustomers] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<FdScheme[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [bankLedgers, setBankLedgers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Entry Mode: 'single' | 'bulk'
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single');
  const [totalDepositAmount, setTotalDepositAmount] = useState<number | ''>(1000000);
  const [splitCount, setSplitCount] = useState<number | ''>(5);
  const [amountPerReceipt, setAmountPerReceipt] = useState<number | ''>(200000);
  const [receiptRows, setReceiptRows] = useState<BulkReceiptRow[]>([]);

  // Payment Mode & Customer SB Accounts State
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank' | 'Transfer'>('Cash');
  const [bankAccountLedgerID, setBankAccountLedgerID] = useState<number>(0);
  const [chequeNo, setChequeNo] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>('');
  const [customerSavingsAccounts, setCustomerSavingsAccounts] = useState<any[]>([]);
  const [selectedSavingAccountID, setSelectedSavingAccountID] = useState<number>(0);

  // Next account number preview and editable manual override
  const [nextAccountNo, setNextAccountNo] = useState('');
  const [suggestedAccountNo, setSuggestedAccountNo] = useState('');
  const [isManualAccountNo, setIsManualAccountNo] = useState(false);
  const [loadingAccountNo, setLoadingAccountNo] = useState(false);

  // List view state
  const [fdList, setFdList] = useState<FdAccount[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [listError, setListError] = useState('');
  const [listSuccess, setListSuccess] = useState('');

  // Delete confirmation & print modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; accountNo: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedPrintAccount, setSelectedPrintAccount] = useState<any | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  const API_URL = '/api';
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    branchID: user?.branchID || 1,
    customerID: 0,
    memberID: 0,
    fdSchemeID: 0,
    legacyAccountNumber: '',
    durationType: 'Months', // 'Days' | 'Months' | 'Years'
    durationValue: 12,
    openingDate: activeBusinessDate,
    depositAmount: 50000,
    nomineeName: '',
    nomineeRelation: '',
    remarks: 'नवीन मुदत ठेव खाते उघडले (New FD Opened)',
    isSeniorCitizen: false,
    isAutoRenewable: false,
    autoRenewalOption: 'PrincipalPlusInterest',
    maxAutoRenewalCycles: 3,
  });

  useEffect(() => {
    if (user?.branchID && user.role !== 'Admin') {
      setFormData(prev => ({ ...prev, branchID: user.branchID }));
    }
    if (user?.businessDate) {
      setFormData(prev => ({ ...prev, openingDate: user.businessDate.split('T')[0] }));
    }
  }, [user]);

  const [calcData, setCalcData] = useState({
    interestRate: 0,
    durationMonths: 0,
    durationValue: 12,
    durationType: 'Months',
    durationInDays: 365,
    matchedSlab: null as any,
    interestType: '',
    maturityDate: '',
    maturityAmount: 0,
    isPeriodicPayout: false,
    monthlyInterestAmount: 0,
    totalInterestPayout: 0,
    totalBenefitAmount: 0,
  });

  useEffect(() => {
    fetchCustomers();
    fetchBranches();
    fetchBankLedgers();
    fetchSchemes(formData.branchID);
    if (!isPassingMode) {
      fetchFdList(formData.branchID);
    }
  }, [isPassingMode]);

  useEffect(() => {
    fetchSchemes(formData.branchID);
    if (!isPassingMode) {
      fetchNextAccountNo(formData.branchID);
      fetchFdList(formData.branchID);
    }
  }, [formData.branchID, isPassingMode]);

  useEffect(() => {
    if (view === 'list' && !isPassingMode) {
      fetchFdList(formData.branchID);
    }
  }, [view, isPassingMode]);

  useEffect(() => {
    if (isPassingMode && voucherId) {
      loadPassingVoucher(voucherId);
    }
  }, [isPassingMode, voucherId]);

  const loadPassingVoucher = async (vId: number) => {
    setPassingLoading(true);
    try {
      const res = await axios.get(`${API_URL}/FdAccounts/by-voucher/${vId}`);
      const { fdAccount, voucher } = res.data;
      setPassingVoucherData(voucher);

      if (fdAccount) {
        setNextAccountNo(fdAccount.accountNo);
        setPaymentMode(fdAccount.paymentMode || 'Cash');
        if (fdAccount.bankAccountLedgerID) setBankAccountLedgerID(fdAccount.bankAccountLedgerID);
        if (fdAccount.savingAccountID) setSelectedSavingAccountID(fdAccount.savingAccountID);

        setFormData(prev => ({
          ...prev,
          branchID: fdAccount.branchID || 1,
          customerID: fdAccount.customerID,
          memberID: fdAccount.customerID,
          fdSchemeID: fdAccount.fdSchemeID,
          durationType: fdAccount.durationType || 'Months',
          durationValue: fdAccount.durationValue || 12,
          openingDate: fdAccount.openingDate ? fdAccount.openingDate.split('T')[0] : prev.openingDate,
          depositAmount: fdAccount.depositAmount,
          nomineeName: fdAccount.nomineeName || '',
          nomineeRelation: fdAccount.nomineeRelation || '',
          remarks: fdAccount.remarks || '',
          legacyAccountNumber: fdAccount.legacyAccountNumber || '',
          isSeniorCitizen: !!fdAccount.isSeniorCitizen
        }));
      }
    } catch (err: any) {
      console.error('Error loading FD voucher:', err);
      setError('व्हाउचरशी संबंधित मुदत ठेव माहिती लोड करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setPassingLoading(false);
    }
  };

  const handlePassVoucher = async () => {
    if (!voucherId) return;
    if (!window.confirm('आपण खात्रीपूर्वक हे मुदत ठेव व्हाउचर मंजूर व पास करू इच्छिता?')) return;
    setPassingActionLoading(true);
    try {
      await axios.post(`${API_URL}/VoucherPosting/Post`, [voucherId]);
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
      await axios.delete(`${API_URL}/VoucherPosting/${voucherId}?reason=${encodeURIComponent(rejectReason)}`);
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

  // Fetch Customer's Savings Accounts when customerID changes
  useEffect(() => {
    const custId = formData.customerID || formData.memberID;
    if (custId > 0) {
      fetchCustomerSavingsAccounts(custId);
    } else {
      setCustomerSavingsAccounts([]);
      setSelectedSavingAccountID(0);
    }
  }, [formData.customerID, formData.memberID]);

  const fetchCustomerSavingsAccounts = async (cId: number) => {
    try {
      const selected = customers.find((c: any) => (c.customerID || c.memberID || c.id) === cId);
      const custId = selected?.customerID || selected?.id || cId;
      const memId = selected?.memberProfile?.memberID || selected?.memberID || custId;

      const response = await axios.get(`${API_URL}/SavingAccounts?customerId=${custId}&memberId=${memId}`);
      const accs = response.data || [];
      setCustomerSavingsAccounts(accs);
      if (accs.length > 0) {
        setSelectedSavingAccountID(accs[0].savingAccountID || accs[0].savingAccountId || 0);
      } else {
        setSelectedSavingAccountID(0);
      }
    } catch (err) {
      console.error('Error fetching customer savings accounts', err);
    }
  };

  const fetchBankLedgers = async () => {
    try {
      const response = await axios.get(`${API_URL}/Ledgers`);
      const allLedgers = response.data || [];
      const filteredBanks = allLedgers.filter((l: any) =>
        l.groupName?.toLowerCase().includes('bank') ||
        l.ledgerName?.toLowerCase().includes('bank') ||
        l.ledgerName?.includes('बँक') ||
        l.ledgerName?.includes('बेंक')
      );
      setBankLedgers(filteredBanks.length > 0 ? filteredBanks : allLedgers);
    } catch (err) {
      console.error('Error fetching bank ledgers', err);
    }
  };

  const getSchemeId = (s: any) => s?.fdSchemeID ?? s?.fdSchemeId ?? s?.FdSchemeID ?? 0;
  const selectedScheme = schemes.find((s: any) => getSchemeId(s) === Number(formData.fdSchemeID));

  // Check Digit and Sequential Account Number Prediction Helper (Luhn Mod 10)
  const calculateCheckDigit = (digits: string): number => {
    if (!digits) return 0;
    let sum = 0;
    let alternate = true;
    for (let i = digits.length - 1; i >= 0; i--) {
      const d = parseInt(digits[i], 10);
      if (isNaN(d)) continue;
      let val = d;
      if (alternate) {
        val *= 2;
        if (val > 9) val -= 9;
      }
      sum += val;
      alternate = !alternate;
    }
    const mod = sum % 10;
    return mod === 0 ? 0 : 10 - mod;
  };

  const predictSequentialAccountNo = (baseAccountNo: string, offsetIndex: number): string => {
    if (!baseAccountNo || baseAccountNo === '---' || baseAccountNo.trim() === '' || baseAccountNo === 'AUTO') {
      return 'AUTO';
    }

    const clean = baseAccountNo.replace(/\D/g, '');
    if (clean.length === 14) {
      const branchPart = clean.substring(0, 3);
      const schemePart = clean.substring(3, 6);
      const seqPart = parseInt(clean.substring(6, 13), 10);
      if (!isNaN(seqPart)) {
        const nextSeq = seqPart + offsetIndex;
        const seqStr = String(nextSeq).padStart(7, '0');
        const thirteen = `${branchPart}${schemePart}${seqStr}`;
        const chk = calculateCheckDigit(thirteen);
        return `${branchPart}-${schemePart}-${seqStr}-${chk}`;
      }
    }

    // Fallback for custom formatted numbers ending with digits
    const match = baseAccountNo.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const numStr = match[2];
      const num = parseInt(numStr, 10);
      if (!isNaN(num)) {
        const nextNum = num + offsetIndex;
        return `${prefix}${String(nextNum).padStart(numStr.length, '0')}`;
      }
    }

    return offsetIndex === 0 ? baseAccountNo : `${baseAccountNo}-${offsetIndex + 1}`;
  };

  // Dynamic Row Calculation Helper
  const calculateRowDetails = (
    p: number,
    durType: 'Days' | 'Months' | 'Years',
    durVal: number,
    scheme: FdScheme | undefined,
    opDateStr: string,
    isSenior: boolean
  ) => {
    if (!scheme || p <= 0 || durVal <= 0) {
      return {
        durationInDays: 0,
        interestRate: 0,
        maturityDate: '',
        maturityAmount: 0,
      };
    }

    const opDate = new Date(opDateStr);
    let totalDays = 0;
    let maturityDateStr = '';

    if (!isNaN(opDate.getTime())) {
      const targetDate = new Date(opDate);
      if (durType === 'Days') {
        targetDate.setDate(targetDate.getDate() + durVal);
        totalDays = durVal;
      } else if (durType === 'Years') {
        targetDate.setFullYear(targetDate.getFullYear() + durVal);
        totalDays = Math.round((targetDate.getTime() - opDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        const targetMonth = targetDate.getMonth() + durVal;
        const targetDay = targetDate.getDate();
        targetDate.setMonth(targetMonth);
        if (targetDate.getDate() !== targetDay) {
          targetDate.setDate(0);
        }
        totalDays = Math.round((targetDate.getTime() - opDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      maturityDateStr = targetDate.toISOString().split('T')[0];
    }

    let rate = 0;
    if (scheme.schemeDurationModel === 'Slab' && scheme.slabs && scheme.slabs.length > 0) {
      const matchedSlab = scheme.slabs.find(
        (s: any) => totalDays >= Number(s.fromDays) && totalDays <= Number(s.toDays) && s.isActive !== false
      );
      if (matchedSlab) {
        rate = Number(isSenior ? (matchedSlab.seniorCitizenRate || matchedSlab.interestRate) : matchedSlab.interestRate) || 0;
      } else {
        rate = Number(isSenior ? (scheme.seniorCitizenInterestRate || scheme.interestRate) : scheme.interestRate) || 0;
      }
    } else {
      rate = Number(isSenior ? (scheme.seniorCitizenInterestRate || scheme.interestRate) : scheme.interestRate) || 0;
    }

    const type = scheme.interestType || 'Simple';
    let matAmount = 0;

    if (p > 0 && totalDays > 0) {
      const r = rate;
      if (type === 'Cumulative') {
        let n = 4;
        if (scheme.interestCompoundingFrequency === 'Half-Yearly') n = 2;
        if (scheme.interestCompoundingFrequency === 'Yearly') n = 1;
        if (scheme.interestCompoundingFrequency === 'Monthly') n = 12;
        matAmount = p * Math.pow(1 + r / (n * 100), n * (totalDays / 365));
      } else if (type === 'MIS' || type === 'Monthly Interest') {
        matAmount = p;
      } else {
        matAmount = p * (1 + (r * totalDays) / (365 * 100));
      }
    }

    return {
      durationInDays: totalDays,
      interestRate: rate,
      maturityDate: maturityDateStr,
      maturityAmount: Math.round(matAmount),
    };
  };

  // Generate or Re-allocate Receipt Rows
  const generateReceiptRows = (
    count: number,
    totalAmt: number,
    scheme: FdScheme | undefined,
    baseDurType: string,
    baseDurVal: number,
    opDate: string,
    isSenior: boolean,
    existingRows?: BulkReceiptRow[],
    startAccountNo?: string
  ): BulkReceiptRow[] => {
    if (count <= 0) return [];

    const durType = (baseDurType as 'Days' | 'Months' | 'Years') || 'Months';
    const durVal = baseDurVal > 0 ? baseDurVal : 12;

    const basePerReceipt = totalAmt > 0 ? Math.floor((totalAmt / count) * 100) / 100 : 0;
    const remainder = totalAmt > 0 ? Math.round((totalAmt - basePerReceipt * (count - 1)) * 100) / 100 : 0;

    const baseAcc = startAccountNo || (existingRows && existingRows[0]?.accountNo && existingRows[0].accountNo !== 'AUTO' ? existingRows[0].accountNo : '') || nextAccountNo || suggestedAccountNo || '';
    const rows: BulkReceiptRow[] = [];

    for (let i = 0; i < count; i++) {
      const amt = i === count - 1 ? remainder : basePerReceipt;
      const existing = existingRows && existingRows[i];
      const rowDurType = (existing?.durationType as any) || durType;
      const rowDurVal = existing?.durationValue || durVal;
      
      const accNo = (existing?.accountNo && existing.accountNo !== 'AUTO')
        ? existing.accountNo
        : predictSequentialAccountNo(baseAcc, i);
      const legacyNo = existing?.legacyAccountNumber || '';

      const calcs = calculateRowDetails(
        amt,
        rowDurType,
        rowDurVal,
        scheme,
        opDate,
        isSenior
      );

      rows.push({
        id: existing?.id || `receipt-${Date.now()}-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
        accountNo: accNo,
        legacyAccountNumber: legacyNo,
        depositAmount: amt,
        durationType: rowDurType,
        durationValue: rowDurVal,
        durationInDays: calcs.durationInDays,
        interestRate: calcs.interestRate,
        maturityDate: calcs.maturityDate,
        maturityAmount: calcs.maturityAmount,
      });
    }

    return rows;
  };

  // Re-sequence all rows based on row 1 or nextAccountNo
  const handleReSequenceAccountNumbers = (startNo?: string) => {
    const base = startNo || (receiptRows.length > 0 && receiptRows[0].accountNo && receiptRows[0].accountNo !== 'AUTO' ? receiptRows[0].accountNo : '') || nextAccountNo || suggestedAccountNo || '';
    if (!base || base === '---' || base === 'AUTO') return;

    setReceiptRows(prev => prev.map((row, idx) => ({
      ...row,
      accountNo: predictSequentialAccountNo(base, idx)
    })));
  };

  // Synchronize Bulk Split Amount Calculations
  const handleTotalAmountChange = (val: number | '') => {
    setTotalDepositAmount(val);
    const count = Number(splitCount) > 0 ? Number(splitCount) : 5;
    if (val !== '') {
      setAmountPerReceipt(Math.round((Number(val) / count) * 100) / 100);
      setReceiptRows(generateReceiptRows(
        count,
        Number(val),
        selectedScheme,
        formData.durationType,
        formData.durationValue,
        formData.openingDate,
        formData.isSeniorCitizen,
        receiptRows
      ));
    }
  };

  const handleSplitCountChange = (val: number | '') => {
    setSplitCount(val);
    const total = Number(totalDepositAmount) > 0 ? Number(totalDepositAmount) : 0;
    if (val !== '' && Number(val) > 0) {
      setAmountPerReceipt(Math.round((total / Number(val)) * 100) / 100);
      setReceiptRows(generateReceiptRows(
        Number(val),
        total,
        selectedScheme,
        formData.durationType,
        formData.durationValue,
        formData.openingDate,
        formData.isSeniorCitizen,
        receiptRows
      ));
    }
  };

  const handleAmountPerReceiptChange = (val: number | '') => {
    setAmountPerReceipt(val);
    if (val !== '' && totalDepositAmount !== '' && Number(val) > 0) {
      const calculatedCount = Math.max(1, Math.round(Number(totalDepositAmount) / Number(val)));
      setSplitCount(calculatedCount);
      setReceiptRows(generateReceiptRows(
        calculatedCount,
        Number(totalDepositAmount),
        selectedScheme,
        formData.durationType,
        formData.durationValue,
        formData.openingDate,
        formData.isSeniorCitizen,
        receiptRows
      ));
    }
  };

  const handleRowAmountChange = (index: number, val: number | '') => {
    setReceiptRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      row.depositAmount = val;
      const numAmt = val === '' ? 0 : Number(val);
      const calcs = calculateRowDetails(
        numAmt,
        row.durationType,
        row.durationValue,
        selectedScheme,
        formData.openingDate,
        formData.isSeniorCitizen
      );
      row.durationInDays = calcs.durationInDays;
      row.interestRate = calcs.interestRate;
      row.maturityDate = calcs.maturityDate;
      row.maturityAmount = calcs.maturityAmount;
      updated[index] = row;
      return updated;
    });
  };

  const handleRowDurationChange = (index: number, durType: 'Days' | 'Months' | 'Years', durVal: number) => {
    setReceiptRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      row.durationType = durType;
      row.durationValue = durVal;
      const calcs = calculateRowDetails(
        Number(row.depositAmount) || 0,
        durType,
        durVal,
        selectedScheme,
        formData.openingDate,
        formData.isSeniorCitizen
      );
      row.durationInDays = calcs.durationInDays;
      row.interestRate = calcs.interestRate;
      row.maturityDate = calcs.maturityDate;
      row.maturityAmount = calcs.maturityAmount;
      updated[index] = row;
      return updated;
    });
  };

  const handleRowAccountNoChange = (index: number, val: string) => {
    setReceiptRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], accountNo: val };
      return updated;
    });
    if (index === 0 && val && val.trim() !== '') {
      setNextAccountNo(val);
      setIsManualAccountNo(true);
    }
  };

  const handleRowLegacyNoChange = (index: number, val: string) => {
    setReceiptRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], legacyAccountNumber: val };
      return updated;
    });
  };

  const handleBalanceLastReceipt = () => {
    if (receiptRows.length === 0) return;
    const target = Number(totalDepositAmount) || 0;
    const sumExceptLast = receiptRows.slice(0, -1).reduce((sum, r) => sum + (Number(r.depositAmount) || 0), 0);
    const balancedAmount = Math.max(0, Math.round((target - sumExceptLast) * 100) / 100);

    setReceiptRows(prev => {
      const updated = [...prev];
      const lastIndex = updated.length - 1;
      const lastRow = { ...updated[lastIndex] };
      lastRow.depositAmount = balancedAmount;
      const calcs = calculateRowDetails(
        balancedAmount,
        lastRow.durationType,
        lastRow.durationValue,
        selectedScheme,
        formData.openingDate,
        formData.isSeniorCitizen
      );
      lastRow.durationInDays = calcs.durationInDays;
      lastRow.interestRate = calcs.interestRate;
      lastRow.maturityDate = calcs.maturityDate;
      lastRow.maturityAmount = calcs.maturityAmount;
      updated[lastIndex] = lastRow;
      return updated;
    });
  };

  const handleDistributeEqually = () => {
    const count = receiptRows.length > 0 ? receiptRows.length : (Number(splitCount) > 0 ? Number(splitCount) : 5);
    const total = Number(totalDepositAmount) || 0;
    const newRows = generateReceiptRows(
      count,
      total,
      selectedScheme,
      formData.durationType,
      formData.durationValue,
      formData.openingDate,
      formData.isSeniorCitizen,
      receiptRows
    );
    setReceiptRows(newRows);
  };

  const handleAddReceiptRow = () => {
    const target = Number(totalDepositAmount) || 0;
    const currentSum = receiptRows.reduce((sum, r) => sum + (Number(r.depositAmount) || 0), 0);
    const rem = Math.max(0, Math.round((target - currentSum) * 100) / 100);
    const newIndex = receiptRows.length;
    const durType = (formData.durationType as any) || 'Months';
    const durVal = formData.durationValue > 0 ? formData.durationValue : 12;

    const baseAcc = (receiptRows.length > 0 && receiptRows[0].accountNo && receiptRows[0].accountNo !== 'AUTO' ? receiptRows[0].accountNo : '') || nextAccountNo || suggestedAccountNo || '';
    const accNo = predictSequentialAccountNo(baseAcc, newIndex);

    const calcs = calculateRowDetails(
      rem,
      durType,
      durVal,
      selectedScheme,
      formData.openingDate,
      formData.isSeniorCitizen
    );

    const newRow: BulkReceiptRow = {
      id: `receipt-${Date.now()}-${newIndex + 1}-${Math.random().toString(36).substring(2, 7)}`,
      accountNo: accNo,
      legacyAccountNumber: '',
      depositAmount: rem,
      durationType: durType,
      durationValue: durVal,
      durationInDays: calcs.durationInDays,
      interestRate: calcs.interestRate,
      maturityDate: calcs.maturityDate,
      maturityAmount: calcs.maturityAmount,
    };

    const nextRows = [...receiptRows, newRow];
    setReceiptRows(nextRows);
    setSplitCount(nextRows.length);
  };

  const handleDeleteReceiptRow = (index: number) => {
    if (receiptRows.length <= 1) {
      alert('कमीत कमी १ पावती असणे आवश्यक आहे.');
      return;
    }
    const nextRows = receiptRows.filter((_, idx) => idx !== index);
    setReceiptRows(nextRows);
    setSplitCount(nextRows.length);
  };

  // Reconcile and Financial Balance Metrics
  const gridTotal = React.useMemo(() => {
    return receiptRows.reduce((sum, r) => sum + (Number(r.depositAmount) || 0), 0);
  }, [receiptRows]);

  const roundedGridTotal = Math.round(gridTotal * 100) / 100;

  const gridMaturityTotal = React.useMemo(() => {
    return receiptRows.reduce((sum, r) => sum + (Number(r.maturityAmount) || 0), 0);
  }, [receiptRows]);

  const targetTotal = Number(totalDepositAmount) || 0;
  const difference = Math.round((targetTotal - roundedGridTotal) * 100) / 100;
  const isDifferenceZero = Math.abs(difference) < 0.01;
  const hasInvalidRow = receiptRows.length === 0 || receiptRows.some(r => Number(r.depositAmount) <= 0);
  const isBulkSubmitDisabled = entryMode === 'bulk' && (!isDifferenceZero || hasInvalidRow);

  // Initialize receiptRows when entering bulk mode
  useEffect(() => {
    if (entryMode === 'bulk' && receiptRows.length === 0) {
      const count = Number(splitCount) > 0 ? Number(splitCount) : 5;
      const total = Number(totalDepositAmount) > 0 ? Number(totalDepositAmount) : 500000;
      setReceiptRows(generateReceiptRows(
        count,
        total,
        selectedScheme,
        formData.durationType,
        formData.durationValue,
        formData.openingDate,
        formData.isSeniorCitizen
      ));
    }
  }, [entryMode, selectedScheme]);

  // Synchronize receiptRows with sequential numbers when nextAccountNo is fetched or updated
  useEffect(() => {
    if (entryMode === 'bulk' && nextAccountNo && nextAccountNo !== '---' && receiptRows.length > 0) {
      const hasAuto = receiptRows.some(r => !r.accountNo || r.accountNo === 'AUTO');
      if (hasAuto) {
        setReceiptRows(prev => prev.map((row, idx) => {
          if (!row.accountNo || row.accountNo === 'AUTO') {
            return {
              ...row,
              accountNo: predictSequentialAccountNo(nextAccountNo, idx)
            };
          }
          return row;
        }));
      }
    }
  }, [nextAccountNo, entryMode, receiptRows.length]);

  // Recalculate row details if scheme or senior citizen status or openingDate changes
  useEffect(() => {
    if (receiptRows.length > 0 && selectedScheme) {
      setReceiptRows(prev => prev.map(row => {
        const calcs = calculateRowDetails(
          Number(row.depositAmount) || 0,
          row.durationType,
          row.durationValue,
          selectedScheme,
          formData.openingDate,
          formData.isSeniorCitizen
        );
        return {
          ...row,
          durationInDays: calcs.durationInDays,
          interestRate: calcs.interestRate,
          maturityDate: calcs.maturityDate,
          maturityAmount: calcs.maturityAmount,
        };
      }));
    }
  }, [formData.fdSchemeID, formData.openingDate, formData.isSeniorCitizen]);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      let custIdStr = params.get('customerId') || params.get('memberId');
      
      if (!custIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              custIdStr = bridgeData.customerId ? String(bridgeData.customerId) : (bridgeData.memberId ? String(bridgeData.memberId) : null);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Fast-track targeted single customer load (~20ms)
      if (custIdStr) {
        const cId = parseInt(custIdStr, 10);
        try {
          const singleRes = await axios.get(`${API_URL}/Customers/${cId}`);
          if (singleRes.data && (singleRes.data.customerID || singleRes.data.id)) {
            const cust = singleRes.data;
            setCustomers([cust]);
            setFormData((prev) => ({ ...prev, customerID: cId, memberID: cId }));
          }
        } catch (err) {
          console.warn('Fast-track customer fetch failed, falling back', err);
        }
      }

      // Full customers list loads in background asynchronously
      axios.get(`${API_URL}/Customers`).then(response => {
        const allCusts = response.data || [];
        setCustomers(allCusts);
        if (custIdStr && allCusts.length > 0) {
          const cId = parseInt(custIdStr, 10);
          const matchedCustomer = allCusts.find((m: any) => (m.customerID || m.memberID || m.id) === cId);
          if (matchedCustomer) {
            setFormData((prev) => ({ ...prev, customerID: cId, memberID: cId }));
          }
        }
      }).catch(err => console.error('Error fetching full customers list', err));
    } catch (err) {
      console.error('Error in fetchCustomers', err);
    }
  };

  const fetchSchemes = async (bId?: number) => {
    try {
      const activeBranch = bId !== undefined ? bId : (formData.branchID || 1);
      const response = await axios.get(`${API_URL}/FdSchemes?branchId=${activeBranch}`);
      const data = response.data || [];
      setSchemes(data);
      if (data.length > 0) {
        setFormData(prev => {
          const schemeExists = data.some((s: any) => getSchemeId(s) === prev.fdSchemeID);
          if (prev.fdSchemeID === 0 || !schemeExists) {
            const firstScheme = data[0];
            const isSlab = firstScheme.schemeDurationModel === 'Slab';
            return {
              ...prev,
              fdSchemeID: getSchemeId(firstScheme),
              durationType: isSlab ? (firstScheme.durationType || 'Days') : (firstScheme.durationType || 'Months'),
              durationValue: isSlab ? (firstScheme.slabs?.[0]?.toDays || 90) : (firstScheme.durationMonths || 12),
            };
          }
          return prev;
        });
      } else {
        setFormData(prev => ({
          ...prev,
          fdSchemeID: 0,
        }));
      }
    } catch (err) {
      console.error('Error fetching schemes', err);
    }
  };

  const fetchNextAccountNo = async (branchId: number, schemeId?: number) => {
    if (isPassingMode) return;
    setLoadingAccountNo(true);
    try {
      const activeSchemeId = schemeId !== undefined ? schemeId : formData.fdSchemeID;
      const url = activeSchemeId && activeSchemeId > 0
        ? `${API_URL}/FdAccounts/next-account-no/${branchId}?schemeId=${activeSchemeId}`
        : `${API_URL}/FdAccounts/next-account-no/${branchId}`;
      const response = await axios.get(url);
      const val = typeof response.data === 'string'
        ? response.data
        : (response.data.formattedAccountNo || response.data.displayAccountNo || response.data.accountNo || response.data.nextAccountNo || '');
      setSuggestedAccountNo(val);
      if (!isManualAccountNo) {
        setNextAccountNo(val);
      }
    } catch (err) {
      if (!isManualAccountNo) {
        setNextAccountNo('---');
      }
    } finally {
      setLoadingAccountNo(false);
    }
  };

  const fetchFdList = async (targetBranchId?: number) => {
    const bId = targetBranchId !== undefined ? targetBranchId : formData.branchID;
    setListLoading(true);
    setListError('');
    setListSuccess('');
    try {
      const url = bId && bId > 0 ? `${API_URL}/FdAccounts?branchId=${bId}` : `${API_URL}/FdAccounts`;
      const response = await axios.get(url);
      setFdList(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error fetching FD list', err);
    } finally {
      setListLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setListError('');
    setListSuccess('');
    try {
      await axios.delete(`${API_URL}/FdAccounts/${deleteConfirm.id}`);
      setListSuccess(`✅ खाते '${deleteConfirm.accountNo}' यशस्वीरित्या डिलीट (Delete) केले.`);
      setDeleteConfirm(null);
      fetchFdList(formData.branchID);
      fetchNextAccountNo(formData.branchID);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'Delete करताना त्रुटी आली.';
      setListError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  // Dynamic Maturity & Slabs calculations with ROUND UP (nearest whole rupee)
  useEffect(() => {
    const selected = schemes.find((s: any) => getSchemeId(s) === Number(formData.fdSchemeID));
    if (!selected) {
      setCalcData({
        interestRate: 0,
        durationMonths: 0,
        durationValue: 0,
        durationType: 'Months',
        durationInDays: 0,
        matchedSlab: null,
        interestType: '',
        maturityDate: '',
        maturityAmount: 0,
        isPeriodicPayout: false,
        monthlyInterestAmount: 0,
        totalInterestPayout: 0,
        totalBenefitAmount: 0,
      });
      return;
    }

    const durType = formData.durationType || (selected.durationType ?? 'Months');
    const durVal = Number(formData.durationValue) > 0 ? Number(formData.durationValue) : (Number(selected.durationMonths) || 12);
    const type = selected.interestType || 'Simple';
    const opDate = new Date(formData.openingDate);

    let maturityDateStr = '';
    let totalDays = 0;

    if (!isNaN(opDate.getTime()) && durVal > 0) {
      const targetDate = new Date(opDate);
      if (durType === 'Days') {
        targetDate.setDate(targetDate.getDate() + durVal);
        totalDays = durVal;
      } else if (durType === 'Years') {
        targetDate.setFullYear(targetDate.getFullYear() + durVal);
        totalDays = Math.round((targetDate.getTime() - opDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Months
        const targetMonth = targetDate.getMonth() + durVal;
        const targetDay = targetDate.getDate();
        targetDate.setMonth(targetMonth);
        if (targetDate.getDate() !== targetDay) {
          targetDate.setDate(0);
        }
        totalDays = Math.round((targetDate.getTime() - opDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      maturityDateStr = targetDate.toISOString().split('T')[0];
    }

    // Rate Resolution from Slabs or Fixed
    let rate = 0;
    let matchedSlab: any = null;

    if (selected.schemeDurationModel === 'Slab' && selected.slabs && selected.slabs.length > 0) {
      matchedSlab = selected.slabs.find((s: any) => totalDays >= Number(s.fromDays) && totalDays <= Number(s.toDays) && s.isActive !== false);
      if (matchedSlab) {
        rate = Number(formData.isSeniorCitizen ? (matchedSlab.seniorCitizenRate || matchedSlab.interestRate) : matchedSlab.interestRate) || 0;
      } else {
        rate = Number(formData.isSeniorCitizen ? (selected.seniorCitizenInterestRate || selected.interestRate) : selected.interestRate) || 0;
      }
    } else {
      rate = Number(formData.isSeniorCitizen ? (selected.seniorCitizenInterestRate || selected.interestRate) : selected.interestRate) || 0;
    }

    const isMis = type === 'MIS' || type === 'Monthly Interest';
    let matAmount = 0;
    let monthlyInt = 0;
    let totalPeriodicInt = 0;
    let totalBenefit = 0;

    const currentDepositAmt = entryMode === 'bulk'
      ? (Number(amountPerReceipt) || 0)
      : (Number(formData.depositAmount) || 0);

    const p = currentDepositAmt;
    if (p > 0 && totalDays > 0) {
      const r = rate;
      if (type === 'Cumulative') {
        let n = 4;
        if (selected.interestCompoundingFrequency === 'Half-Yearly') n = 2;
        if (selected.interestCompoundingFrequency === 'Yearly') n = 1;
        if (selected.interestCompoundingFrequency === 'Monthly') n = 12;
        matAmount = p * Math.pow(1 + r / (n * 100), n * (totalDays / 365));
        totalPeriodicInt = Math.round(matAmount - p);
        totalBenefit = Math.round(matAmount);
      } else if (isMis) {
        matAmount = p; // Principal returned at maturity
        monthlyInt = Math.round((p * r) / 1200);
        const monthsCount = durType === 'Months' 
          ? durVal 
          : (durType === 'Years' ? durVal * 12 : Math.max(1, Math.round(totalDays / 30.416)));
        totalPeriodicInt = monthlyInt * monthsCount;
        totalBenefit = p + totalPeriodicInt;
      } else {
        matAmount = p * (1 + (r * totalDays) / (365 * 100));
        totalPeriodicInt = Math.round(matAmount - p);
        totalBenefit = Math.round(matAmount);
      }
    }

    setCalcData({
      interestRate: rate,
      durationMonths: Math.round(totalDays / 30.416),
      durationValue: durVal,
      durationType: durType,
      durationInDays: totalDays,
      matchedSlab: matchedSlab,
      interestType: type,
      maturityDate: maturityDateStr,
      maturityAmount: Math.round(matAmount),
      isPeriodicPayout: isMis,
      monthlyInterestAmount: monthlyInt,
      totalInterestPayout: totalPeriodicInt,
      totalBenefitAmount: totalBenefit,
    });
  }, [formData.depositAmount, formData.fdSchemeID, formData.durationType, formData.durationValue, formData.openingDate, formData.isSeniorCitizen, entryMode, amountPerReceipt, schemes]);

  // Active customer details for schedule modal
  const activeCustId = formData.customerID || formData.memberID;
  const currentCust = customers.find((c: any) => (c.customerID || c.memberID || c.id) === Number(activeCustId));
  const activeCustomerName = currentCust 
    ? `${currentCust.firstName || ''} ${currentCust.middleName || ''} ${currentCust.lastName || ''}`.replace(/\s+/g, ' ').trim() || currentCust.name || currentCust.label || 'ठेवीदार'
    : 'ठेवीदार';
  const activeCustomerCode = currentCust?.memberCode || currentCust?.code || '';
  const activeCustomerCif = currentCust?.cifNo || currentCust?.cif || '';

  // Generate real-time interest schedule
  const scheduleSummary = React.useMemo(() => {
    const currentDepositAmt = entryMode === 'bulk'
      ? (Number(amountPerReceipt) || 0)
      : (Number(formData.depositAmount) || 0);

    return generateFdInterestSchedule({
      depositAmount: currentDepositAmt,
      interestRate: calcData.interestRate,
      openingDate: formData.openingDate,
      maturityDate: calcData.maturityDate,
      schemeType: calcData.interestType,
      compoundingFrequency: selectedScheme?.interestCompoundingFrequency || 'Quarterly',
      targetMaturityAmount: calcData.maturityAmount,
    });
  }, [
    entryMode,
    amountPerReceipt,
    formData.depositAmount,
    calcData.interestRate,
    formData.openingDate,
    calcData.maturityDate,
    calcData.interestType,
    selectedScheme?.interestCompoundingFrequency,
    calcData.maturityAmount
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | any) => {
    const { name, value, type, checked } = e.target;
    let val: any = value;
    if (type === 'checkbox') {
      val = checked;
    } else if (name === 'depositAmount' || name === 'durationValue') {
      val = value === '' ? '' : value;
    } else if (name.endsWith('ID') || name === 'branchID' || name === 'fdSchemeID' || name === 'customerID' || name === 'memberID') {
      val = value === '' ? '' : (parseInt(value, 10) || 0);
    }

    // Auto-update duration defaults when changing scheme
    if (name === 'fdSchemeID') {
      const schemeId = parseInt(value, 10) || 0;
      const s = schemes.find((sc: any) => getSchemeId(sc) === schemeId);
      if (s) {
        const isSlab = s.schemeDurationModel === 'Slab';
        setFormData(prev => ({
          ...prev,
          fdSchemeID: schemeId,
          durationType: isSlab ? (s.durationType || 'Days') : (s.durationType || 'Months'),
          durationValue: isSlab ? (s.slabs?.[0]?.toDays || 90) : (s.durationMonths || 12),
        }));
        return;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const activeCustId = formData.customerID || formData.memberID;
    if (!activeCustId || activeCustId === 0) { setError('कृपया खातेदार निवडा.'); return; }
    if (formData.fdSchemeID === 0) { setError('कृपया ठेव योजना निवडा.'); return; }
    if (paymentMode === 'Bank' && bankAccountLedgerID === 0) { setError('कृपया बँक खातावणी लेजर निवडा.'); return; }
    if (paymentMode === 'Transfer') {
      if (selectedSavingAccountID === 0) {
        setError('कृपया वर्ग करण्यासाठी खातेदाराचे बचत खाते निवडा.');
        return;
      }
      const requiredTotal = entryMode === 'bulk' ? (Number(totalDepositAmount) || 0) : (parseFloat(formData.depositAmount as any) || 0);
      const selectedSb = customerSavingsAccounts.find(a => (a.savingAccountID || a.savingAccountId) === selectedSavingAccountID);
      if (selectedSb && Number(selectedSb.currentBalance || 0) < requiredTotal) {
        setError(`अपुऱ्या शिल्लकेमुळे बचत खात्यातून वर्ग करता येणार नाही! निवडलेल्या बचत खात्यात फक्त ₹${Number(selectedSb.currentBalance).toLocaleString('en-IN', {minimumFractionDigits: 2})} शिल्लक आहेत (हवी असलेली एकूण रक्कम ₹${requiredTotal.toLocaleString('en-IN', {minimumFractionDigits: 2})}).`);
        return;
      }
    }

    setLoading(true);
    try {
      const selectedCust = customers.find((c: any) => (c.customerID || c.memberID || c.id) === Number(activeCustId));
      const resolvedCustId = Number(selectedCust?.customerID || selectedCust?.id || activeCustId);

      if (entryMode === 'single') {
        const depAmt = parseFloat(formData.depositAmount as any) || 0;
        if (depAmt <= 0) { setError('ठेव रक्कम ० पेक्षा जास्त असावी.'); setLoading(false); return; }

        const payload = {
          ...formData,
          customerID: resolvedCustId,
          memberID: resolvedCustId,
          depositAmount: depAmt,
          durationType: calcData.durationType,
          durationValue: calcData.durationValue,
          durationInDays: calcData.durationInDays,
          accountNo: (nextAccountNo && nextAccountNo.trim() !== '---') ? nextAccountNo.trim() : 'AUTO',
          legacyAccountNumber: formData.legacyAccountNumber ? formData.legacyAccountNumber.trim() : null,
          interestRate: calcData.interestRate,
          maturityDate: calcData.maturityDate,
          maturityAmount: calcData.maturityAmount,
          paymentMode: paymentMode,
          bankAccountLedgerID: paymentMode === 'Bank' ? bankAccountLedgerID : null,
          chequeNo: paymentMode === 'Bank' ? chequeNo : null,
          chequeDate: paymentMode === 'Bank' && chequeDate ? chequeDate : null,
          savingAccountID: paymentMode === 'Transfer' ? selectedSavingAccountID : null,
          isAutoRenewable: formData.isAutoRenewable,
          autoRenewalOption: formData.autoRenewalOption,
          maxAutoRenewalCycles: formData.maxAutoRenewalCycles,
        };

        const response = await axios.post(`${API_URL}/FdAccounts`, payload);
        const createdNo = response.data.accountNo;
        setSuccess(`✅ मुदत ठेव खाते यशस्वीरित्या उघडले! (पावती क्र: ${createdNo})`);

      } else {
        // BULK SPLIT MODE
        const totalAmt = Number(totalDepositAmount) || 0;
        const count = receiptRows.length;
        const perReceipt = receiptRows.length > 0 ? (Number(receiptRows[0].depositAmount) || 0) : 0;

        if (totalAmt <= 0) { setError('एकूण ठेव रक्कम ० पेक्षा जास्त असावी.'); setLoading(false); return; }
        if (count <= 0) { setError('पावत्यांची यादी रिकामी असू शकत नाही.'); setLoading(false); return; }
        if (!isDifferenceZero) {
          setError(`एकूण ठेव रक्कम (₹${totalAmt.toLocaleString('en-IN')}) आणि ग्रिडमधील पावत्यांची बेरीज (₹${roundedGridTotal.toLocaleString('en-IN')}) जुळत नाही. तफावत: ₹${difference.toLocaleString('en-IN')}.`);
          setLoading(false);
          return;
        }
        if (hasInvalidRow) {
          setError('ग्रिडमधील प्रत्येक पावतीची ठेव रक्कम ० पेक्षा जास्त असणे बंधनकारक आहे.');
          setLoading(false);
          return;
        }

        const bulkPayload = {
          branchID: formData.branchID,
          customerID: resolvedCustId,
          fdSchemeID: formData.fdSchemeID,
          openingDate: formData.openingDate,
          totalAmount: totalAmt,
          splitCount: count,
          amountPerReceipt: perReceipt,
          durationType: calcData.durationType,
          durationValue: calcData.durationValue,
          nomineeName: formData.nomineeName,
          nomineeRelation: formData.nomineeRelation,
          remarks: formData.remarks,
          isSeniorCitizen: formData.isSeniorCitizen,
          startAccountNo: (nextAccountNo && nextAccountNo.trim() !== '---') ? nextAccountNo.trim() : null,
          legacyAccountNumber: formData.legacyAccountNumber ? formData.legacyAccountNumber.trim() : null,
          paymentMode: paymentMode,
          bankAccountLedgerID: paymentMode === 'Bank' ? bankAccountLedgerID : null,
          chequeNo: paymentMode === 'Bank' ? chequeNo : null,
          chequeDate: paymentMode === 'Bank' && chequeDate ? chequeDate : null,
          savingAccountID: paymentMode === 'Transfer' ? selectedSavingAccountID : null,
          isAutoRenewable: formData.isAutoRenewable,
          autoRenewalOption: formData.autoRenewalOption,
          maxAutoRenewalCycles: formData.maxAutoRenewalCycles,
          receipts: receiptRows.map(r => ({
            accountNo: r.accountNo && r.accountNo.trim() !== 'AUTO' ? r.accountNo.trim() : null,
            legacyAccountNumber: r.legacyAccountNumber ? r.legacyAccountNumber.trim() : null,
            depositAmount: Number(r.depositAmount) || 0,
            durationType: r.durationType,
            durationValue: Number(r.durationValue) || 12,
          }))
        };

        try {
          const response = await axios.post(`${API_URL}/FdAccounts/BulkCreate`, bulkPayload);
          setSuccess(`✅ ${response.data.message}`);
          fetchNextAccountNo(formData.branchID);
          fetchFdList(formData.branchID);
        } catch (bulkErr: any) {
          const errMsg = bulkErr.response?.data?.message || bulkErr.response?.data || bulkErr.message || 'बल्क पावत्या सेव्ह करताना त्रुटी आली.';
          setError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        }
      }

      setFormData((prev) => ({
        ...prev,
        depositAmount: 50000,
        legacyAccountNumber: '',
        nomineeName: '',
        nomineeRelation: '',
        remarks: 'नवीन मुदत ठेव खाते उघडले (New FD Opened)',
      }));
      setChequeNo('');
      setChequeDate('');
      setIsManualAccountNo(false);
      fetchNextAccountNo(formData.branchID);
      fetchFdList(formData.branchID);
      if (activeCustId > 0) {
        fetchCustomerSavingsAccounts(activeCustId);
      }

    } catch (err: any) {
      console.error(err);
      if (err.response?.data) {
        if (typeof err.response.data === 'string') setError(err.response.data);
        else if (err.response.data.title) setError(err.response.data.title);
        else if (err.response.data.message) setError(err.response.data.message);
        else setError(JSON.stringify(err.response.data));
      } else {
        setError(err.message || 'खाते उघडताना त्रुटी आली.');
      }
    } finally {
      setLoading(false);
    }
  };

  const labelClass = 'block text-xs font-bold text-gray-700 mb-1';
  const inputClass = 'w-full text-xs border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white shadow-sm transition-all';

  const filteredList = fdList.filter((fd: any) =>
    fd.accountNo?.toLowerCase().includes(listSearch.toLowerCase()) ||
    fd.legacyAccountNumber?.toLowerCase().includes(listSearch.toLowerCase()) ||
    (fd.customerName || fd.memberName)?.toLowerCase().includes(listSearch.toLowerCase()) ||
    (fd.cifNo || fd.memberCode)?.toLowerCase().includes(listSearch.toLowerCase()) ||
    fd.schemeName?.toLowerCase().includes(listSearch.toLowerCase())
  );

  const formatCurrency = (amount: number) =>
    `₹ ${Math.round(amount || 0).toLocaleString('en-IN')}`;

  // Standard Indian Core Banking Date Format DD/MM/YYYY
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'Active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'Matured') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'Closed') return 'bg-slate-100 text-slate-600 border-slate-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  const formatCustomerLabel = (m: any) => {
    const nameParts = [m.firstName, m.middleName, m.lastName].filter(Boolean);
    let fullName = nameParts.join(' ').trim();
    if (!fullName) {
      const engParts = [m.firstNameEng, m.middleNameEng, m.lastNameEng].filter(Boolean);
      fullName = engParts.join(' ').trim();
    }
    if (!fullName) fullName = `खातेदार ID: ${m.customerID || m.memberID || m.id}`;

    const cifStr = m.cifNo ? `CIF: ${m.cifNo}` : '';
    const codeStr = m.memberCode ? `कोड: ${m.memberCode}` : '';
    const oldNo = m.oldMemberCode || m.legacyMemberNo || m.legacyCustomerNo;
    const oldNoStr = oldNo ? `जुना नं: ${oldNo}` : '';

    const details = [cifStr, codeStr, oldNoStr].filter(Boolean).join(' | ');
    return details ? `${fullName} (${details})` : fullName;
  };

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">

        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
              <span>🏦 नवीन मुदत ठेव खाते अर्ज (New FD Account Opening)</span>
            </h2>
            <p className="text-[10px] text-blue-100 font-normal">नवीन मुदत ठेव खाते नोंदणी, ऑटो-इंटरेस्ट कॅल्क्युलेशन आणि पावती जनरेशन</p>
          </div>

          <div className="flex items-center gap-2">
            {!isPassingMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setView('form')}
                  className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                    view === 'form' ? 'bg-white text-primary font-bold border-white' : 'bg-blue-800/60 hover:bg-blue-800 text-white border-blue-400/40'
                  }`}
                >
                  <span>✍️ नवीन अर्ज (New Form)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView('list')}
                  className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                    view === 'list' ? 'bg-white text-primary font-bold border-white' : 'bg-blue-800/60 hover:bg-blue-800 text-white border-blue-400/40'
                  }`}
                >
                  <span>👁️ खाती यादी ({fdList.length})</span>
                </button>
              </>
            ) : (
              <span className="bg-amber-400 text-slate-950 font-bold px-2.5 py-0.5 rounded text-xs flex items-center gap-1">
                🔒 व्हाउचर तपासणी मोड (Checker Mode)
              </span>
            )}
          </div>
        </div>

        {/* Checker Mode Amber Alert Banner */}
        {isPassingMode && (
          <div className="bg-amber-500 text-slate-950 p-3 mx-3 mt-3 rounded shadow-md border-2 border-amber-600 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-extrabold text-sm uppercase tracking-wide">
                  मुदत ठेव पावती व्हाउचर तपासणी (FD Opening Voucher Checker Mode)
                </div>
                <div className="text-xs text-amber-950 font-medium mt-0.5">
                  व्हाउचर क्र: <span className="font-mono font-bold">{passingVoucherData?.voucherNo || voucherId}</span> |
                  रक्कम: <span className="font-bold">₹{passingVoucherData?.totalAmount?.toLocaleString('en-IN') || formData.depositAmount}</span> |
                  तारीख: <span className="font-bold">{passingVoucherData?.voucherDate ? new Date(passingVoucherData.voucherDate).toLocaleDateString('mr-IN') : formData.openingDate}</span> |
                  स्थिती: <span className="bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold text-[10px]">{passingVoucherData?.status || 'Pending'}</span>
                </div>
              </div>
            </div>
            <div className="text-xs font-bold bg-amber-100 text-amber-950 px-2.5 py-1 rounded border border-amber-400">
              🔒 तपासणी मोड: फक्त वाचन अनुज्ञेय (Read Only Lockdown)
            </div>
          </div>
        )}

        {/* ==================== FORM VIEW ==================== */}
        {view === 'form' && (
          <div className="p-3">
            
            {/* Top Receipt Bar & Mode Selector */}
            <div className="bg-gray-50 p-2 rounded border border-gray-200 mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-700">ठेव पावती क्र. (Receipt No) *:</span>
                {loadingAccountNo ? (
                  <span className="text-xs text-blue-600 font-medium animate-pulse">क्रमांक तयार होत आहे...</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={nextAccountNo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNextAccountNo(val);
                        setIsManualAccountNo(true);
                        if (entryMode === 'bulk') {
                          handleReSequenceAccountNumbers(val);
                        }
                      }}
                      placeholder="उदा. 001-401-0000006-2 किंवा क्र."
                      className="w-48 font-mono font-bold text-blue-900 bg-white border border-blue-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                    />
                    {isManualAccountNo && suggestedAccountNo && (
                      <button
                        type="button"
                        onClick={() => {
                          setNextAccountNo(suggestedAccountNo);
                          setIsManualAccountNo(false);
                          if (entryMode === 'bulk') {
                            handleReSequenceAccountNumbers(suggestedAccountNo);
                          }
                        }}
                        title="सिस्टीमने सुचवलेला पुढील क्रमांक पूर्ववत करा"
                        className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 font-semibold cursor-pointer"
                      >
                        ↺ रीसेट
                      </button>
                    )}
                    <span className="text-[10px] text-slate-500">
                      {isManualAccountNo ? '(मॅन्युअल संपादित)' : '(स्वयंचलित पुढील क्र.)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Mode Selection Pills */}
              {!isPassingMode && (
                <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-gray-300">
                  <button
                    type="button"
                    onClick={() => setEntryMode('single')}
                    className={`px-2.5 py-0.5 text-xs font-bold rounded cursor-pointer transition ${
                      entryMode === 'single' ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    एकेरी पावती (Single)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode('bulk')}
                    className={`px-2.5 py-0.5 text-xs font-bold rounded cursor-pointer transition ${
                      entryMode === 'bulk' ? 'bg-blue-800 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    ✨ बल्क स्प्लिट (Bulk Split)
                  </button>
                </div>
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-sm text-xs mb-2">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-sm text-xs mb-2">{success}</div>}

            <form onSubmit={handleSubmit}>
              <fieldset disabled={isPassingMode} className="contents">
              
              {/* Section 1: बेसिक व खातेदार माहिती */}
              <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 mb-3">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center justify-between">
                  <span>१. प्राथमिक व खातेदार माहिती (Basic & Customer Details)</span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.2 rounded">
                    {entryMode === 'bulk' ? 'बल्क स्प्लिट मोड' : 'एकेरी मोड'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शाखा (Branch) *</label>
                    {user?.role === 'Admin' ? (
                      <select name="branchID" value={formData.branchID} onChange={handleChange} required
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                        {branches.map((b) => (
                          <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-gray-100 font-bold text-gray-800 flex items-center gap-1">
                        <span>🔒</span>
                        <span>{branches.find(b => b.branchID === formData.branchID)?.branchName || user?.branchName || 'Bambavade Branch'}</span>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">खातेदार निवडा (Select Customer / CIF) *</label>
                    <CustomerSearchSelect
                      customers={customers}
                      value={formData.customerID ? Number(formData.customerID) : (formData.memberID ? Number(formData.memberID) : '')}
                      onChange={(val) => {
                        const numVal = val ? Number(val) : 0;
                        setFormData((prev) => ({ ...prev, customerID: numVal, memberID: numVal }));
                      }}
                      placeholder="-- खातेदार (CIF / नाव / मोबाईलने शोधा) --"
                      isDisabled={isPassingMode}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">मुदत ठेव योजना (FD Scheme) *</label>
                    <select name="fdSchemeID" value={formData.fdSchemeID} onChange={handleChange} required
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                      <option value="0">--- योजना निवडा ---</option>
                      {schemes.map((s: any) => {
                        const durationInfo = s.schemeDurationModel === 'Slab'
                          ? 'स्लॅब आधारित'
                          : `${s.durationMonths} महिने`;
                        const rateInfo = s.interestRate ? `@ ${s.interestRate}%` : '';
                        const codeInfo = s.schemeCode ? `(${s.schemeCode})` : '';
                        return (
                          <option key={getSchemeId(s)} value={getSchemeId(s)}>
                            {s.schemeName} {codeInfo} - {durationInfo} {rateInfo}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                      जुना ठेव / पावती क्र. (Legacy No)
                    </label>
                    <input
                      type="text"
                      name="legacyAccountNumber"
                      value={formData.legacyAccountNumber}
                      onChange={handleChange}
                      placeholder="उदा. 45 / जुना पावती क्र."
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs font-mono font-bold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: ठेव रक्कम व मुदत माहिती */}
              <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 mb-3">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center justify-between">
                  <span>२. ठेव रक्कम व मुदत गणित (Deposit & Duration Calculations)</span>
                  {selectedScheme && (
                    <span className="text-[10px] font-bold text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded">
                      {selectedScheme.schemeDurationModel === 'Slab' 
                        ? `स्लॅब आधारित योजना (${selectedScheme.slabs?.length || 0} स्लॅब्स) | ${selectedScheme.interestType}` 
                        : `निश्चित मुदत: ${selectedScheme.durationMonths} महिने | ${selectedScheme.interestType}`}
                    </span>
                  )}
                </div>

                {entryMode === 'single' && (
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">खाते उघडल्याची तारीख *</label>
                      <input type="date" name="openingDate" value={formData.openingDate} onChange={handleChange} required
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">ठेव रक्कम (Deposit ₹) *</label>
                      <input type="number" name="depositAmount" value={formData.depositAmount} onChange={handleChange} onFocus={(e) => e.target.select()} required
                        className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-blue-900" />
                    </div>

                    {/* Duration input depending on scheme model */}
                    {selectedScheme?.schemeDurationModel === 'Slab' ? (
                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[11px] font-medium text-gray-600">कालावधी (Duration) *</label>
                          <span className="text-[10px] text-blue-700 font-semibold font-mono">({calcData.durationInDays || 0} दिवस)</span>
                        </div>
                        <div className="flex gap-1">
                          <input 
                            type="number" 
                            name="durationValue" 
                            value={formData.durationValue} 
                            onChange={handleChange} 
                            onFocus={(e) => e.target.select()}
                            required 
                            min="1"
                            className="w-1/2 border border-gray-300 rounded-sm px-2 py-1 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" 
                            placeholder="संख्या"
                          />
                          <select 
                            name="durationType" 
                            value={formData.durationType} 
                            onChange={handleChange}
                            className="w-1/2 border border-gray-300 rounded-sm px-1 py-1 text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-400">
                            <option value="Days">दिवस (Days)</option>
                            <option value="Months">महिने (Months)</option>
                            <option value="Years">वर्षे (Years)</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">कालावधी (Duration)</label>
                        <input 
                          type="text" 
                          value={selectedScheme ? `${selectedScheme.durationMonths} महिने (${calcData.durationInDays || 0} दिवस)` : 'योजना निवडा'} 
                          readOnly
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-slate-100 text-slate-800 cursor-not-allowed font-medium" 
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                        व्याजदर (%) <span className="text-[10px] text-emerald-600">(Locked)</span>
                      </label>
                      <input type="text" value={formData.fdSchemeID === 0 ? 'योजना निवडा' : `${calcData.interestRate} %`} readOnly
                        className="w-full border border-emerald-300 rounded-sm px-2 py-1 text-xs bg-emerald-50 font-bold text-emerald-800 cursor-not-allowed" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">मुदतपूर्ती तारीख (Maturity)</label>
                      <input type="text" value={calcData.maturityDate ? new Date(calcData.maturityDate).toLocaleDateString('en-GB') : (formData.fdSchemeID === 0 ? 'योजना निवडा' : '-')} readOnly
                        className="w-full border border-blue-200 rounded-sm px-2 py-1 text-xs bg-blue-50 font-bold text-blue-900 cursor-not-allowed font-mono" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5 truncate" title={calcData.isPeriodicPayout ? 'मुदतपूर्ती मुद्दल परतावा (Principal ₹)' : 'मुदतपूर्ती रक्कम (Maturity ₹)'}>
                        {calcData.isPeriodicPayout ? 'मुदतपूर्ती मुद्दल (₹)' : 'मुदतपूर्ती रक्कम (Maturity ₹)'}
                      </label>
                      <input type="text" value={formData.fdSchemeID === 0 ? 'योजना निवडा' : (calcData.maturityAmount > 0 ? `₹ ${Math.round(calcData.maturityAmount).toLocaleString('en-IN')}` : '₹ 0')} readOnly
                        className="w-full border border-emerald-300 rounded-sm px-2 py-1 text-xs bg-emerald-100 font-extrabold text-emerald-950 cursor-not-allowed font-mono shadow-2xs" />
                    </div>
                  </div>
                )}

                {entryMode === 'bulk' && (
                  <div className="space-y-3">
                    {/* Bulk Header Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2.5 bg-white p-2.5 rounded border border-blue-200 shadow-2xs">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">खाते उघडल्याची तारीख *</label>
                        <input
                          type="date"
                          name="openingDate"
                          value={formData.openingDate}
                          onChange={handleChange}
                          required
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                          🎯 एकूण लक्ष्य ठेव (Total ₹) *
                        </label>
                        <input
                          type="number"
                          value={totalDepositAmount}
                          onChange={(e) => handleTotalAmountChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          required
                          className="w-full border border-blue-400 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50/50 font-black text-blue-950 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                          पावत्यांची संख्या (Count) *
                        </label>
                        <input
                          type="number"
                          value={splitCount}
                          onChange={(e) => handleSplitCountChange(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                          required
                          min="1"
                          max="50"
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-black text-center font-mono"
                        />
                      </div>

                      {/* Default Duration Controls */}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                          डिफॉल्ट कालावधी (Default Duration)
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            name="durationValue"
                            value={formData.durationValue}
                            onChange={(e) => {
                              handleChange(e);
                              const val = parseInt(e.target.value, 10) || 12;
                              setReceiptRows(prev => prev.map(r => {
                                const calcs = calculateRowDetails(
                                  Number(r.depositAmount) || 0,
                                  r.durationType,
                                  val,
                                  selectedScheme,
                                  formData.openingDate,
                                  formData.isSeniorCitizen
                                );
                                return {
                                  ...r,
                                  durationValue: val,
                                  durationInDays: calcs.durationInDays,
                                  interestRate: calcs.interestRate,
                                  maturityDate: calcs.maturityDate,
                                  maturityAmount: calcs.maturityAmount
                                };
                              }));
                            }}
                            onFocus={(e) => e.target.select()}
                            min="1"
                            className="w-1/2 border border-gray-300 rounded-sm px-1.5 py-1 text-xs font-bold text-center bg-white"
                          />
                          <select
                            name="durationType"
                            value={formData.durationType}
                            onChange={(e) => {
                              handleChange(e);
                              const t = e.target.value as any;
                              setReceiptRows(prev => prev.map(r => {
                                const calcs = calculateRowDetails(
                                  Number(r.depositAmount) || 0,
                                  t,
                                  r.durationValue,
                                  selectedScheme,
                                  formData.openingDate,
                                  formData.isSeniorCitizen
                                );
                                return {
                                  ...r,
                                  durationType: t,
                                  durationInDays: calcs.durationInDays,
                                  interestRate: calcs.interestRate,
                                  maturityDate: calcs.maturityDate,
                                  maturityAmount: calcs.maturityAmount
                                };
                              }));
                            }}
                            className="w-1/2 border border-gray-300 rounded-sm px-1 py-1 text-xs bg-white font-medium"
                          >
                            <option value="Days">दिवस</option>
                            <option value="Months">महिने</option>
                            <option value="Years">वर्षे</option>
                          </select>
                        </div>
                      </div>

                      {/* Quick Action Helpers */}
                      <div className="md:col-span-2 flex items-end gap-1.5 pb-0.5">
                        <button
                          type="button"
                          onClick={handleDistributeEqually}
                          className="flex-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 px-2 py-1 rounded text-[11px] font-bold shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="एकूण रक्कम सर्व पावत्यांमध्ये समान वाटा"
                        >
                          <span>🔄</span>
                          <span>समान वाटप</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleBalanceLastReceipt}
                          className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded text-[11px] font-bold shadow-2xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          title="उर्वरित तफावत शेवटच्या पावतीमध्ये आपोआप ॲडजस्ट करा"
                        >
                          <span>⚖️</span>
                          <span>शेवटची ॲडजस्ट</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleAddReceiptRow}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-[11px] font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          title="नवीन पावती जोडा"
                        >
                          <span>➕</span>
                          <span>पावती जोडा</span>
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Interactive Receipt Rows Grid */}
                    <div className="overflow-x-auto border border-blue-200 rounded bg-white shadow-2xs">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                            <th className="py-1.5 px-2 text-center w-8">#</th>
                            <th className="py-1.5 px-2 w-48">
                              <div className="flex items-center justify-between gap-1">
                                <span>पावती / खाते क्र.</span>
                                <button
                                  type="button"
                                  onClick={() => handleReSequenceAccountNumbers()}
                                  title="पहिल्या पावती क्रमांकावरून पुढील सर्व पावत्या सलग करा (Auto-Sequence All Rows)"
                                  className="text-[9px] px-1.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 rounded font-bold cursor-pointer transition-colors"
                                >
                                  ⚡ सलग करा
                                </button>
                              </div>
                            </th>
                            <th className="py-1.5 px-2 w-32">जुना पावती क्र.</th>
                            <th className="py-1.5 px-2 w-36 text-right">ठेव रक्कम (₹) *</th>
                            <th className="py-1.5 px-2 w-36">कालावधी</th>
                            <th className="py-1.5 px-2 text-center w-20">व्याजदर</th>
                            <th className="py-1.5 px-2 text-center w-28">मुदतपूर्ती तारीख</th>
                            <th className="py-1.5 px-2 text-right w-32">मुदतपूर्ती (₹)</th>
                            <th className="py-1.5 px-2 text-center w-12">क्रिया</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {receiptRows.map((row, idx) => (
                            <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                              <td className="py-1 px-2 text-center font-bold text-slate-500 bg-slate-50/50">
                                {idx + 1}
                              </td>
                              <td className="py-1 px-2">
                                <input
                                  type="text"
                                  value={row.accountNo}
                                  onChange={(e) => handleRowAccountNoChange(idx, e.target.value)}
                                  placeholder={predictSequentialAccountNo(nextAccountNo, idx)}
                                  className="w-full border border-blue-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-blue-950 bg-blue-50/20 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
                                />
                              </td>
                              <td className="py-1 px-2">
                                <input
                                  type="text"
                                  value={row.legacyAccountNumber}
                                  onChange={(e) => handleRowLegacyNoChange(idx, e.target.value)}
                                  placeholder="उदा. 45"
                                  className="w-full border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                              </td>
                              <td className="py-1 px-2 text-right">
                                <input
                                  type="number"
                                  value={row.depositAmount}
                                  onChange={(e) => handleRowAmountChange(idx, e.target.value === '' ? '' : parseFloat(e.target.value))}
                                  onFocus={(e) => e.target.select()}
                                  min="1"
                                  step="1"
                                  placeholder="0"
                                  className={`w-full border rounded px-2 py-0.5 text-xs text-right font-black focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                    Number(row.depositAmount) <= 0
                                      ? 'border-red-400 bg-red-50 text-red-700'
                                      : 'border-blue-300 bg-blue-50/20 text-blue-950 font-mono'
                                  }`}
                                />
                              </td>
                              <td className="py-1 px-2">
                                <div className="flex gap-1 items-center">
                                  <input
                                    type="number"
                                    value={row.durationValue}
                                    onChange={(e) => handleRowDurationChange(idx, row.durationType, parseInt(e.target.value, 10) || 1)}
                                    onFocus={(e) => e.target.select()}
                                    min="1"
                                    className="w-14 border border-slate-200 rounded px-1 py-0.5 text-xs text-center font-bold bg-white"
                                  />
                                  <select
                                    value={row.durationType}
                                    onChange={(e) => handleRowDurationChange(idx, e.target.value as any, row.durationValue)}
                                    className="border border-slate-200 rounded px-1 py-0.5 text-[10px] bg-white text-slate-700"
                                  >
                                    <option value="Days">दिवस</option>
                                    <option value="Months">महिने</option>
                                    <option value="Years">वर्षे</option>
                                  </select>
                                </div>
                              </td>
                              <td className="py-1 px-2 text-center">
                                <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold font-mono text-[11px]">
                                  {row.interestRate} %
                                </span>
                              </td>
                              <td className="py-1 px-2 text-center font-mono text-slate-700 text-xs">
                                {row.maturityDate ? new Date(row.maturityDate).toLocaleDateString('en-GB') : '-'}
                              </td>
                              <td className="py-1 px-2 text-right">
                                <span className="font-extrabold text-emerald-900 font-mono text-xs">
                                  ₹ {Number(row.maturityAmount || 0).toLocaleString('en-IN')}
                                </span>
                              </td>
                              <td className="py-1 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteReceiptRow(idx)}
                                  disabled={receiptRows.length <= 1}
                                  className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 p-0.5 transition-colors cursor-pointer"
                                  title={receiptRows.length <= 1 ? 'किमान १ पावती आवश्यक आहे' : 'ही पावती काढून टाका'}
                                >
                                  ❌
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800">
                          <tr>
                            <td colSpan={3} className="py-2 px-2 text-right uppercase tracking-wider text-[11px]">
                              ग्रिड बेरीज (Grid Total):
                            </td>
                            <td className="py-2 px-2 text-right font-black text-blue-950 font-mono text-xs">
                              ₹ {roundedGridTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td colSpan={3} className="py-2 px-2 text-right text-[11px] text-slate-600">
                              एकूण मुदतपूर्ती रक्कम:
                            </td>
                            <td className="py-2 px-2 text-right font-extrabold text-emerald-950 font-mono text-xs">
                              ₹ {gridMaturityTotal.toLocaleString('en-IN')}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Financial Reconciliation Cockpit (हिशोब ताळेबंद बार) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 p-2.5 rounded border shadow-2xs transition-all bg-white border-slate-200">
                      {/* Target Total Card */}
                      <div className="bg-slate-50 border border-slate-200 rounded p-2 flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          🎯 एकूण लक्ष्य ठेव (Target Total)
                        </span>
                        <span className="text-base font-black text-slate-900 font-mono mt-0.5">
                          ₹ {targetTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          एकूण पावत्या: <b>{receiptRows.length}</b>
                        </span>
                      </div>

                      {/* Grid Sum Card */}
                      <div className="bg-blue-50/50 border border-blue-200 rounded p-2 flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                          📊 पावत्यांची बेरीज (Grid Sum)
                        </span>
                        <span className="text-base font-black text-blue-950 font-mono mt-0.5">
                          ₹ {roundedGridTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-blue-700">
                          सरासरी प्रति पावती: ₹ {receiptRows.length > 0 ? Math.round(roundedGridTotal / receiptRows.length).toLocaleString('en-IN') : 0}
                        </span>
                      </div>

                      {/* Reconciliation Variance Card */}
                      <div
                        className={`rounded p-2 border flex flex-col justify-between transition-colors ${
                          isDifferenceZero
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : difference > 0
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : 'bg-rose-50 border-rose-300 text-rose-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider">
                            ⚖️ हिशोब ताळेबंद (Reconciliation)
                          </span>
                          <span
                            className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${
                              isDifferenceZero
                                ? 'bg-emerald-200 text-emerald-900 border-emerald-400'
                                : difference > 0
                                ? 'bg-amber-200 text-amber-950 border-amber-400'
                                : 'bg-rose-200 text-rose-950 border-rose-400'
                            }`}
                          >
                            {isDifferenceZero ? 'तंतोतंत जुळले' : 'तफावत'}
                          </span>
                        </div>

                        <div className="mt-1 flex items-baseline justify-between">
                          <span className="text-sm font-extrabold font-mono">
                            तफावत: ₹ {Math.abs(difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {!isDifferenceZero && (
                            <button
                              type="button"
                              onClick={handleBalanceLastReceipt}
                              className="text-[10px] font-black underline hover:no-underline text-blue-800 cursor-pointer"
                            >
                              शेवटची ॲडजस्ट करा
                            </button>
                          )}
                        </div>

                        <div className="text-[10px] font-medium leading-snug mt-1">
                          {isDifferenceZero ? (
                            <span className="text-emerald-800 font-semibold flex items-center gap-1">
                              <span>✅</span> ०.०० तफावत - सर्व पावत्या सेव्ह करण्यासाठी तयार आहेत.
                            </span>
                          ) : difference > 0 ? (
                            <span className="text-amber-800 font-semibold flex items-center gap-1">
                              <span>⚠️</span> अजून ₹ {difference.toLocaleString('en-IN', { minimumFractionDigits: 2 })} वाटप बाकी आहे.
                            </span>
                          ) : (
                            <span className="text-rose-800 font-semibold flex items-center gap-1">
                              <span>❌</span> बेरीज ₹ {Math.abs(difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ने जास्त झाली आहे!
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Calculation Info Banner */}
                {selectedScheme && (
                  <div className="mt-2.5 p-2 bg-gradient-to-r from-emerald-50 via-slate-50 to-teal-50 border border-emerald-200 rounded flex flex-wrap justify-between items-center gap-2 text-xs shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{calcData.isPeriodicPayout ? '💰' : '📊'}</span>
                      <div>
                        <span className="font-bold text-slate-800">{selectedScheme.schemeName} ({selectedScheme.schemeCode})</span>
                        <span className="ml-2 text-[11px] text-slate-500 font-medium">
                          कालावधी: <b>{calcData.durationValue} {calcData.durationType === 'Days' ? 'दिवस' : calcData.durationType === 'Years' ? 'वर्षे' : 'महिने'} ({calcData.durationInDays} दिवस)</b> | व्याज प्रकार: <b>{selectedScheme.interestType}</b>
                        </span>
                        {calcData.matchedSlab && (
                          <span className="ml-2 bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            🎯 लागू स्लॅब: {calcData.matchedSlab.fromDays} ते {calcData.matchedSlab.toDays} दिवस ({calcData.matchedSlab.interestRate}%)
                          </span>
                        )}
                        {calcData.isPeriodicPayout && (
                          <span className="ml-2 bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-black animate-pulse">
                            ⚡ मासिक परतावा योजना (MIS)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 font-semibold text-slate-700">
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                        व्याजदर: <b className="text-emerald-700 font-bold">{calcData.interestRate} %</b> {formData.isSeniorCitizen && <span className="text-[10px] text-amber-700 bg-amber-100 px-1 rounded">(ज्येष्ठ नागरिक)</span>}
                      </span>
                      <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                        मुदतपूर्ती तारीख: <b className="text-indigo-950 font-bold">{calcData.maturityDate ? new Date(calcData.maturityDate).toLocaleDateString('en-GB') : '-'}</b>
                      </span>
                      {calcData.isPeriodicPayout ? (
                        <>
                          <span className="bg-emerald-600 text-white px-2.5 py-1 rounded font-extrabold shadow-2xs flex items-center gap-1">
                            <span>दरमहा व्याज परतावा:</span>
                            <span className="text-amber-200 text-sm font-black">₹ {calcData.monthlyInterestAmount.toLocaleString('en-IN')}</span>
                            <span className="text-[10px] opacity-90">/महा</span>
                          </span>
                          <span className="bg-blue-700 text-white px-2.5 py-1 rounded font-bold shadow-2xs">
                            मुदतपूर्ती मुद्दल परत: ₹ {calcData.maturityAmount.toLocaleString('en-IN')}
                          </span>
                          <span className="bg-slate-800 text-white px-2 py-1 rounded font-medium text-[11px] shadow-2xs" title="मुद्दल + एकूण कालावधीत मिळालेले मासिक व्याज">
                            एकूण परतावा लाभ: ₹ {calcData.totalBenefitAmount.toLocaleString('en-IN')}
                          </span>
                        </>
                      ) : (
                        <span className="bg-emerald-700 text-white px-3 py-1 rounded font-extrabold shadow-2xs">
                          {entryMode === 'bulk' ? `प्रति पावती मुदतपूर्ती: ₹ ${calcData.maturityAmount.toLocaleString('en-IN')}` : `एकूण मुदतपूर्ती: ₹ ${calcData.maturityAmount.toLocaleString('en-IN')}`}
                        </span>
                      )}

                      {/* View Interest Chart Modal Button */}
                      {calcData.maturityAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => setIsScheduleModalOpen(true)}
                          className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-2.5 py-1 rounded font-bold shadow-xs hover:shadow text-xs flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                          title="सविस्तर तिमाही/मासिक व्याज तक्ता व वेळापत्रक पहा"
                        >
                          <span>📊</span>
                          <span>व्याज तक्ता</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: भरणा पद्धत व वारसदार */}
              <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 mb-3">
                <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200">
                  ३. भरणा पद्धत व वारसदार माहिती (Payment Mode & Nominee)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end">
                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">भरणा प्रकार (Payment Mode) *</label>
                    <select value={paymentMode} onChange={(e: any) => setPaymentMode(e.target.value)}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-blue-900">
                      <option value="Cash">💵 रोख (Cash)</option>
                      <option value="Bank">🏦 बँक ट्रान्सफर</option>
                      <option value="Transfer">🔄 बचत ट्रान्सफर</option>
                    </select>
                  </div>

                  {/* Reflecting Cash Ledger Badge */}
                  {paymentMode === 'Cash' && (
                    <div className="md:col-span-3">
                      <CashLedgerReflectBadge 
                        branchId={formData.branchID} 
                        transactionType="Deposit" 
                        customTitle="ठेव जमा होणारे रोख खाते (Cash Deposit Ledger)"
                      />
                    </div>
                  )}

                  {/* Conditional Fields for Bank Payment */}
                  {paymentMode === 'Bank' && (
                    <>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">बँक लेजर निवडा *</label>
                        <select value={bankAccountLedgerID} onChange={(e) => setBankAccountLedgerID(parseInt(e.target.value, 10) || 0)} required
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-slate-800">
                          <option value={0}>-- बँक खाते लेजर निवडा --</option>
                          {bankLedgers.map((l: any) => (
                            <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">चेक / संदर्भ क्र. (Ref/Cheque No)</label>
                        <input type="text" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} placeholder="चेक क्र. किंवा UTR"
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-0.5">चेक तारीख (Cheque Date)</label>
                        <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)}
                          className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-white" />
                      </div>
                    </>
                  )}

                  {/* Conditional Fields for SB Transfer Payment */}
                  {paymentMode === 'Transfer' && (
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                        खातेदाराचे बचत खाते निवडा (Select SB Account for Transfer) *
                      </label>
                      {customerSavingsAccounts.length > 0 ? (
                        <select
                          value={selectedSavingAccountID}
                          onChange={(e) => setSelectedSavingAccountID(parseInt(e.target.value, 10) || 0)}
                          required
                          className="w-full border border-emerald-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-emerald-50 font-bold text-emerald-950"
                        >
                          {customerSavingsAccounts.map((acc: any) => {
                            const accId = acc.savingAccountID || acc.savingAccountId;
                            const bal = Number(acc.currentBalance || 0);
                            return (
                              <option key={accId} value={accId}>
                                {acc.accountNo} - {acc.customerName || acc.memberName || 'बचत खाते'} | उपलब्ध शिल्लक: ₹ {bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <div className="p-1.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] font-semibold flex items-center justify-between">
                          <span>⚠️ या खातेदाराचे कोणतेही बचत खाते उघडलेले नाही!</span>
                          <span className="text-[10px] text-amber-700">कृपया रोख किंवा बँक पर्याय वापरा.</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वारसदाराचे नाव (Nominee Name)</label>
                    <input type="text" name="nomineeName" value={formData.nomineeName} onChange={handleChange}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" placeholder="वारसदाराचे नाव" />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वारसदाराशी नाते (Relation)</label>
                    <select name="nomineeRelation" value={formData.nomineeRelation} onChange={handleChange}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                      <option value="">-- नाते निवडा --</option>
                      <option value="स्वतः (Self)">स्वतः (Self)</option>
                      <option value="पती (Husband)">पती (Husband)</option>
                      <option value="पत्नी (Wife)">पत्नी (Wife)</option>
                      <option value="मुलगा (Son)">मुलगा (Son)</option>
                      <option value="मुलगी (Daughter)">मुलगी (Daughter)</option>
                      <option value="वडील (Father)">वडील (Father)</option>
                      <option value="आई (Mother)">आई (Mother)</option>
                      <option value="भाऊ (Brother)">भाऊ (Brother)</option>
                      <option value="बहीण (Sister)">बहीण (Sister)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शेरा (Remarks)</label>
                    <input type="text" name="remarks" value={formData.remarks} onChange={handleChange}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" placeholder="शेरा टाका..." />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" name="isSeniorCitizen" checked={formData.isSeniorCitizen} onChange={handleChange}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300" />
                    <span>👴 खातेदार ज्येष्ठ नागरिक (Senior Citizen) सवलत लागू करा</span>
                  </label>

                  {paymentMode === 'Transfer' && selectedSavingAccountID > 0 && (
                    <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                      💳 बचत खात्यातून एकूण वर्ग होणारी रक्कम: ₹ {(entryMode === 'bulk' ? (Number(totalDepositAmount) || 0) : (parseFloat(formData.depositAmount as any) || 0)).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: स्वयंचलित नूतनीकरण सुविधा (CBS Auto-Renewal Facility) */}
              <div className="bg-sky-50/80 p-2.5 rounded border border-sky-200 mb-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between pb-1.5 mb-2 border-b border-sky-200 gap-2">
                  <div className="text-[11px] font-bold text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🔄</span> ४. स्वयंचलित नूतनीकरण सुविधा (CBS Auto-Renewal Facility)
                  </div>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-950 cursor-pointer bg-white px-2.5 py-0.5 rounded border border-sky-300 shadow-2xs hover:bg-sky-50 transition-colors">
                    <input
                      type="checkbox"
                      name="isAutoRenewable"
                      checked={formData.isAutoRenewable}
                      onChange={handleChange}
                      className="w-3.5 h-3.5 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
                    />
                    <span>स्वयंचलित नूतनीकरण पर्याय लागू करा (Enable Auto-Renewal)</span>
                  </label>
                </div>

                {formData.isAutoRenewable ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center bg-white p-2.5 rounded border border-sky-200">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                        नूतनीकरण पर्याय (Renewal Mode) *
                      </label>
                      <select
                        name="autoRenewalOption"
                        value={formData.autoRenewalOption}
                        onChange={handleChange}
                        className="w-full border border-sky-300 rounded px-2 py-1 text-xs bg-sky-50/50 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="PrincipalPlusInterest">
                          💰 मुद्दल + जमा व्याज (Principal + Interest Reinvestment)
                        </option>
                        <option value="PrincipalOnly">
                          💵 केवळ मुद्दल (Principal Only - Interest to SB)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                        कमाल नूतनीकरण मर्यादा (वेळा)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          name="maxAutoRenewalCycles"
                          min={1}
                          max={10}
                          value={formData.maxAutoRenewalCycles || 3}
                          onChange={handleChange}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-center font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <span className="text-[10px] text-slate-500 font-medium">वेळा (डिफॉल्ट: ३)</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-600 bg-sky-50/50 p-2 rounded border border-sky-100 leading-snug">
                      ℹ️ <strong className="text-slate-800">आरबीआय नियम:</strong> मुदतपूर्ती दिवशी प्रचलित (Prevailing) व्याजदराने ऑटो-रिन्यू होईल. ठेवीदारास १४ दिवसांचा विनामूल्य रिव्हर्सल कालावधी मिळतो.
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 italic">
                    मुदतपूर्तीनंतर ऑटो-नूतनीकरण होणार नाही; ठेवीदारास शाखेत येऊन नूतनीकरण किंवा परतावा घ्यावा लागेल.
                  </p>
                )}
              </div>

              </fieldset>

              {/* Form Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 mt-2">
                {isPassingMode ? (
                  <div className="w-full flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate ? onNavigate('voucher-posting') : (window.location.href = '/?tab=voucher-posting')}
                      className="px-4 py-1.5 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded shadow-xs text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>↩️</span> पासिंग यादीवर परत जा
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRejectModalOpen(true)}
                        disabled={passingActionLoading}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-xs text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span>❌</span> नामंजूर / रद्द करा
                      </button>

                      <button
                        type="button"
                        onClick={handlePassVoucher}
                        disabled={passingActionLoading}
                        className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span>✅</span> {passingActionLoading ? 'मंजूर होत आहे...' : 'मंजूर व पास करा (Pass)'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {entryMode === 'bulk' && isBulkSubmitDisabled && (
                        <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded flex items-center gap-1.5 shadow-2xs">
                          <span>⛔</span>
                          {hasInvalidRow ? (
                            <span>सर्व पावत्यांची रक्कम ० पेक्षा जास्त असणे बंधनकारक आहे.</span>
                          ) : (
                            <span>
                              हिशोब तंतोतंत जुळत नाही (तफावत: ₹ {Math.abs(difference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}). CBS नियमानुसार ०.०० तफावत असल्याशिवाय सेव्ह करता येत नाही.
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || (entryMode === 'bulk' && isBulkSubmitDisabled)}
                      className={`px-4 py-1.5 rounded-sm shadow-xs text-xs font-bold transition-all flex items-center gap-1.5 ${
                        entryMode === 'bulk' && isBulkSubmitDisabled
                          ? 'bg-slate-300 text-slate-500 border border-slate-300 cursor-not-allowed opacity-80'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                      }`}
                      title={
                        entryMode === 'bulk' && isBulkSubmitDisabled
                          ? (hasInvalidRow
                              ? 'काही पावत्यांची रक्कम ० किंवा अमान्य आहे.'
                              : `तफावत ₹ ${Math.abs(difference)} शिल्लक आहे. कृपया तंतोतंत शून्य करा.`)
                          : ''
                      }
                    >
                      <span>💾 {entryMode === 'bulk' ? `बल्क पावत्या सेव्ह करा (${receiptRows.length})` : 'मुदत ठेव खाते उघडा (Open FD)'}</span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ==================== LIST VIEW ==================== */}
        {view === 'list' && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>📊</span> उघडलेल्या मुदत ठेव खात्यांची यादी (FD Accounts List)
              </div>

              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="पावती क्र / नाव / कोड शोधा..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full pl-7 pr-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                    <th className="px-3 py-2 text-left font-mono">पावती क्र. (Account No)</th>
                    <th className="px-3 py-2 text-left">खातेदाराचे नाव & CIF / कोड</th>
                    <th className="px-3 py-2 text-left">ठेव योजना (Scheme)</th>
                    <th className="px-3 py-2 text-right">ठेव रक्कम (₹)</th>
                    <th className="px-3 py-2 text-center">व्याजदर</th>
                    <th className="px-3 py-2 text-center">भरणा पद्धत</th>
                    <th className="px-3 py-2 text-right">मुदतपूर्ती रक्कम (₹)</th>
                    <th className="px-3 py-2 text-center">तारीख</th>
                    <th className="px-3 py-2 text-center">स्थिती</th>
                    <th className="px-3 py-2 text-center w-32">कारवाई</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <tr><td colSpan={10} className="text-center py-4 text-gray-400">लोड होत आहे...</td></tr>
                  ) : filteredList.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-4 text-gray-400">कोणतेही मुदत ठेव खाते सापडले नाही.</td></tr>
                  ) : (
                    filteredList.map((fd: any) => (
                      <tr key={fd.fdAccountID} className="hover:bg-emerald-50/50 border-b border-gray-100 transition-colors">
                        <td className="px-3 py-1.5 font-mono text-blue-900">
                          <div className="font-bold">{fd.accountNo}</div>
                          {fd.legacyAccountNumber && (
                            <div className="text-[10px] text-amber-800 font-semibold">
                              जुना क्र: {fd.legacyAccountNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-bold text-gray-800">
                          {fd.customerName || fd.memberName}{' '}
                          <span className="text-[10px] text-gray-500 font-normal">({fd.cifNo || fd.memberCode || ''})</span>
                        </td>
                        <td className="px-3 py-1.5 font-medium">{fd.schemeName}</td>
                        <td className="px-3 py-1.5 text-right font-extrabold text-emerald-800">{formatCurrency(fd.depositAmount)}</td>
                        <td className="px-3 py-1.5 text-center font-bold">{fd.interestRate}%</td>
                        <td className="px-3 py-1.5 text-center font-bold text-gray-700">{fd.paymentMode || 'Cash'}</td>
                        <td className="px-3 py-1.5 text-right font-extrabold text-blue-900">
                          <div>{formatCurrency(fd.maturityAmount)}</div>
                          {(fd.monthlyInterestAmount > 0 || fd.interestType === 'MIS' || fd.interestType === 'Monthly Interest') && (
                            <div className="text-[10px] text-emerald-700 font-bold">
                              +₹{Math.round(fd.monthlyInterestAmount || (fd.depositAmount * fd.interestRate / 1200)).toLocaleString('en-IN')}/महा
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center text-[10px]">{formatDate(fd.openingDate)}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-block px-2 py-0.2 rounded-full text-[10px] font-bold ${getStatusColor(fd.status)}`}>
                            {fd.status}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedPrintAccount(fd)}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                              title="पावती प्रिंट करा"
                            >
                              🖨️ प्रिंट
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ id: fd.fdAccountID, accountNo: fd.accountNo })}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                              title="खाते व पासिंग व्हाउचर थेट डिलीट करा"
                            >
                              🗑️ डिलीट
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-sm w-full space-y-3 shadow-xl border border-gray-200">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-sm">मुदत ठेव खाते थेट डिलीट करा</h3>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              तुम्हाला खरोखर मुदत ठेव खाते <strong className="font-mono text-rose-700">'{deleteConfirm.accountNo}'</strong> थेट डेटाबेसमधून डिलीट करायचे आहे का?
            </p>
            <div className="bg-amber-50 border border-amber-200 p-2 rounded text-[11px] text-amber-900 leading-relaxed">
              ⚡ <strong>स्वयंचलित कृती:</strong> हे खाते डिलीट केल्यास <strong>व्हाउचर पासिंगमधून व्हाउचर हटवले जाईल</strong> आणि <strong>आरंभिक ठेव पावती क्र. -१ रोलबॅक</strong> होईल.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs font-bold border border-gray-300 rounded text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 text-white rounded hover:bg-rose-700 shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                {deleting ? 'डिलीट होत आहे...' : '🗑️ होय, थेट डिलीट करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {selectedPrintAccount && (
        <FdReceiptPrintModal
          account={selectedPrintAccount}
          onClose={() => setSelectedPrintAccount(null)}
        />
      )}

      {/* FD Interest Accrual & Amortization Chart Modal */}
      {isScheduleModalOpen && (
        <FdInterestScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          summary={scheduleSummary}
          customerName={activeCustomerName}
          memberCode={activeCustomerCode}
          cifNo={activeCustomerCif}
          schemeName={selectedScheme?.schemeName || 'मुदत ठेव योजना'}
          isSeniorCitizen={formData.isSeniorCitizen}
          entryMode={entryMode}
          splitCount={Number(splitCount) || 1}
          totalDepositAmount={Number(totalDepositAmount) || 0}
        />
      )}

      {/* Reject Confirmation Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 border-b border-rose-100 pb-2">
              <span className="text-xl">❌</span>
              <h3 className="font-bold text-sm">मुदत ठेव व्हाउचर नामंजूर / रद्द करा</h3>
            </div>

            <p className="text-xs text-gray-600">
              व्हाउचर क्र. <strong className="text-gray-900 font-mono">{passingVoucherData?.voucherNo || voucherId}</strong> नामंजूर करण्याचे कारण खालीलप्रमाणे नोंदवा:
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="नामंजूर / रद्द करण्याचे कारण प्रविष्ट करा (उदा. कागदपत्रे अपूर्ण, चुकीची रक्कम, इ.)..."
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
    </div>
  );
};

export default FdAccountOpening;

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect, { CustomerOption } from './common/CustomerSearchSelect';
import {
  Landmark,
  Layers,
  CheckCircle,
  XCircle,
  RotateCcw,
  Save,
  Edit2,
  Trash2,
  Search,
  FileSpreadsheet,
  X,
  Plus,
  IndianRupee,
  Percent,
  Calendar,
  UserCheck,
  BookOpen,
  Scale,
  Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { FdInterestScheduleModal } from './FdInterestScheduleModal';
import { generateFdInterestSchedule, FdScheduleSummary } from '../utils/fdInterestSchedule';

interface ScheduleModalData {
  summary: FdScheduleSummary;
  customerName: string;
  memberCode: string;
  cifNo: string;
  schemeName: string;
  isSeniorCitizen?: boolean;
}

interface Customer extends CustomerOption {
  id?: number;
  customerId?: number;
  legacyCustomerNo?: string;
  fullName?: string;
  customerName?: string;
  customerCode?: string;
}

interface FdScheme {
  fdSchemeID: number;
  schemeCode?: string;
  schemeName: string;
  interestRate: number;
  durationMonths?: number;
  durationType?: string; // 'Days' | 'Months' | 'Years'
  durationValue?: number;
  schemeDurationModel?: string; // 'Fixed' | 'Slab'
  minDurationDays?: number;
  maxDurationDays?: number;
  interestType?: string;
  interestCompoundingFrequency?: string;
}

interface FdAccountRecord {
  fdAccountID: number;
  branchID: number;
  branchName?: string;
  customerID?: number;
  customerName?: string;
  cifNo?: string;
  memberID?: number;
  memberName?: string;
  memberCode?: string;
  fdSchemeID: number;
  schemeName?: string;
  accountNo: string;
  legacyAccountNumber?: string;
  openingDate: string;
  depositAmount: number;
  durationValue?: number;
  durationType?: string;
  durationInDays?: number;
  interestRate: number;
  maturityDate: string;
  maturityAmount: number;
  isLegacyAccount: boolean;
  legacyAccruedInt: number;
  lastInterestPostingDate?: string;
  status: string;
  nomineeName?: string;
  nomineeRelation?: string;
  remarks?: string;
}

/**
 * Format date string into Indian standard DD/MM/YYYY
 */
const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const clean = dateStr.split('T')[0].trim();
  if (!clean) return '-';
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return clean;
};

/**
 * Format duration display with units (महिने / दिवस / वर्षे)
 */
const formatDurationDisplay = (acc: FdAccountRecord): string => {
  if (acc.durationValue && acc.durationValue > 0) {
    const typeLabel = acc.durationType === 'Days' 
      ? 'दिवस' 
      : acc.durationType === 'Years' 
      ? 'वर्षे' 
      : 'महिने';
    return `${acc.durationValue} ${typeLabel}`;
  }
  if (acc.durationInDays && acc.durationInDays > 0) {
    return `${acc.durationInDays} दिवस`;
  }
  return '-';
};

const FdOpeningBalanceMigration: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [schemes, setSchemes] = useState<FdScheme[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [migratedAccounts, setMigratedAccounts] = useState<FdAccountRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMigratedModal, setShowMigratedModal] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isManualMaturityEdited, setIsManualMaturityEdited] = useState(false);
  const [isManualMaturityDateEdited, setIsManualMaturityDateEdited] = useState(false);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const depositAmountInputRef = useRef<HTMLInputElement>(null);
  const [syncingFinancials, setSyncingFinancials] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalData, setScheduleModalData] = useState<ScheduleModalData | null>(null);

  const API_URL = '/api';

  const handleSyncFinancialStatements = async () => {
    try {
      setSyncingFinancials(true);
      setError('');
      setSuccess('');
      const res = await axios.post(`${API_URL}/FdAccounts/SyncOpeningBalances`);
      if (res.data?.success) {
        setSyncResult(res.data);
        const depStr = Number(res.data.totalDepositsSynced || 0).toLocaleString('en-IN');
        const intStr = Number(res.data.totalAccruedSynced || 0).toLocaleString('en-IN');
        setSuccess(`✅ मुदत ठेव सुरुवातीची शिल्लक आणि साचलेले जुने व्याज आर्थिक पत्रके (ताळेबंद / तेरीज) सह यशस्वीरीत्या सिंक करण्यात आले आहे! (एकूण मुद्दल: ₹${depStr}, साचलेले व्याज: ₹${intStr})`);
        fetchMigratedAccounts();
      } else {
        setSuccess(res.data?.message || 'सिंक पूर्ण झाले.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'आर्थिक पत्रक सिंक करताना त्रुटी आली.');
    } finally {
      setSyncingFinancials(false);
    }
  };

  const [formData, setFormData] = useState({
    branchID: 1,
    customerID: 0,
    fdSchemeID: 0,
    accountNo: '',
    legacyAccountNumber: '',
    openingDate: '',
    depositAmount: 0,
    interestRate: 0,
    durationType: 'Months',
    durationValue: 12,
    durationInDays: 365,
    maturityDate: '',
    maturityAmount: 0,
    legacyAccruedInt: 0,
    lastInterestPostingDate: '2026-03-31',
    nomineeName: '',
    nomineeRelation: '',
    remarks: '३१/०३/२०२६ पूर्वीचे चालू मुदत ठेव स्थलांतर',
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCustomers();
    fetchSchemes();
    fetchBranches();
    fetchMigratedAccounts();
    fetchNextAccountNo(1);
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const formatAccountNo = (accNo?: string) => {
    if (!accNo) return '-';
    const digits = accNo.replace(/\D/g, '');
    if (digits.length === 14) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 13)}-${digits.slice(13)}`;
    }
    return accNo;
  };

  const fetchNextAccountNo = async (bId: number, sId?: number) => {
    try {
      const schemeParam = sId || formData.fdSchemeID;
      const url = schemeParam && schemeParam > 0
        ? `${API_URL}/FdAccounts/next-account-no/${bId}?schemeId=${schemeParam}`
        : `${API_URL}/FdAccounts/next-account-no/${bId}`;
      const response = await axios.get(url);
      if (!isMountedRef.current) return;
      if (response.data) {
        const nextNo = typeof response.data === 'string'
          ? response.data
          : (response.data.formattedAccountNo || response.data.displayAccountNo || response.data.accountNo || response.data.nextAccountNo || '');
        if (nextNo) {
          setFormData((prev) => ({
            ...prev,
            accountNo: nextNo
          }));
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching next account number', err);
      }
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      if (!isMountedRef.current) return;
      setBranches(response.data);
      if (response.data.length > 0) {
        const firstBranchId = response.data[0].branchID;
        setFormData(prev => ({ ...prev, branchID: firstBranchId }));
        fetchNextAccountNo(firstBranchId);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching branches', err);
      }
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API_URL}/Customers`);
      if (isMountedRef.current) {
        setCustomers(response.data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching customers', err);
      }
    }
  };

  const fetchSchemes = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdSchemes`);
      if (isMountedRef.current) {
        setSchemes(response.data);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching schemes', err);
      }
    }
  };

  const fetchMigratedAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/FdAccounts`);
      if (!isMountedRef.current) return;
      const list = response.data
        .filter((a: any) => a.isLegacyAccount)
        .sort((a: any, b: any) => (a.accountNo || '').localeCompare(b.accountNo || '') || (a.fdAccountID - b.fdAccountID));
      setMigratedAccounts(list);
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching migrated FD accounts', err);
      }
    }
  };

  const getSchemeId = (s: any) => s?.fdSchemeID ?? s?.fdSchemeId ?? s?.FdSchemeID ?? 0;

  // [RULE-FD-010] Calendar, leap-year and unit-safe (Days/Months/Years) maturity date calculation (Timezone-safe)
  const calculateMaturityDate = (opDateStr: string, val: number, unit: string = 'Months'): string => {
    if (!opDateStr || !val || val <= 0) return '';
    const parts = opDateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); // 1 to 12
    const day = parseInt(parts[2], 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    // 1. Days: strictly add calendar days
    if (unit === 'Days' || unit === 'दिन' || unit === 'दिवस') {
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + val);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    // 2. Years: add calendar years (safe for Feb 29 leap years)
    if (unit === 'Years' || unit === 'वर्षे') {
      const targetYear = year + val;
      const maxDaysInTargetMonth = new Date(targetYear, month, 0).getDate();
      const targetDay = Math.min(day, maxDaysInTargetMonth);
      return `${targetYear}-${pad(month)}-${pad(targetDay)}`;
    }

    // 3. Months (default): add calendar months (safe for 31st to 28/30th month end)
    const totalMonths = year * 12 + (month - 1) + val;
    const targetYear = Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1; // 1 to 12

    // Find last day of target month to prevent overflow (e.g., Jan 31 + 1 month -> Feb 28 or 29)
    const maxDaysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(day, maxDaysInTargetMonth);

    return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
  };

  // [RULE-FD-009] Scheme-specific maturity amount auto-calculation (with Days & Short-term deposit support)
  const calculateMaturityAmount = (
    p: number,
    r: number,
    opDateStr: string,
    matDateStr: string,
    scheme?: FdScheme
  ): number => {
    if (!p || p <= 0) return 0;
    if (!r || r <= 0) return Math.round(p);

    let diffDays = 0;
    if (opDateStr && matDateStr) {
      const d1 = new Date(opDateStr);
      const d2 = new Date(matDateStr);
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime()) && d2 > d1) {
        diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    if (diffDays <= 0) {
      const durType = scheme?.durationType || 'Months';
      const durVal = Number(scheme?.durationMonths) || 12;
      if (durType === 'Days') diffDays = durVal;
      else if (durType === 'Years') diffDays = durVal * 365;
      else diffDays = Math.round(durVal * 30.4167);
    }

    if (diffDays <= 0) return Math.round(p);

    const type = (scheme?.interestType || '').toLowerCase();

    // 1. MIS / Monthly Interest: Maturity Amount = Principal (Interest already disbursed monthly)
    if (type.includes('mis') || type.includes('monthly')) {
      return Math.round(p);
    }

    // 2. Short Term Deposit (< 1 Year / Days based) or Simple Interest: standard Indian banking formula
    const isShortTermOrSimple = (scheme?.durationType === 'Days') || diffDays < 90 || type.includes('simple') || (!type.includes('cumulative') && !type.includes('damduppat') && !type.includes('चक्रवाढ') && !(scheme?.schemeName || '').toLowerCase().includes('दाम'));
    if (isShortTermOrSimple) {
      const t = diffDays / 365.0;
      const matAmt = p * (1 + (r * t) / 100);
      return Math.round(matAmt);
    }

    // 3. Cumulative / Damduppat / Reinvestment: Quarterly (or configured frequency) compounding
    let n = 4; // default Quarterly
    const freq = (scheme?.interestCompoundingFrequency || '').toLowerCase();
    if (freq.includes('half') || freq.includes('2')) n = 2;
    if (freq.includes('year') || freq.includes('1')) n = 1;
    if (freq.includes('month') || freq.includes('12')) n = 12;

    const t = diffDays / 365.0;
    const matAmt = p * Math.pow(1 + r / (n * 100), n * t);
    return Math.round(matAmt);
  };

  const handleSchemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = parseInt(e.target.value, 10) || 0;
    const selected = schemes.find((s: any) => getSchemeId(s) === sId);
    const newRate = selected ? Number(selected.interestRate) || 0 : 0;
    const durType = selected?.durationType || 'Months';
    const durVal = selected ? Number(selected.durationMonths) || 0 : 0;
    const durInDays = durType === 'Days' ? durVal : (durType === 'Years' ? durVal * 365 : Math.round(durVal * 30.4167));

    let newMatDate = formData.maturityDate;
    // [RULE-FD-010] If scheme has duration and openingDate is present, auto-calculate maturity date
    if (durVal > 0 && formData.openingDate && (!isManualMaturityDateEdited || !formData.maturityDate)) {
      newMatDate = calculateMaturityDate(formData.openingDate, durVal, durType);
    }

    const autoMat = !isManualMaturityEdited
      ? calculateMaturityAmount(formData.depositAmount, newRate, formData.openingDate, newMatDate, selected)
      : formData.maturityAmount;

    setFormData((prev) => ({
      ...prev,
      fdSchemeID: sId,
      interestRate: newRate,
      durationType: durType,
      durationValue: durVal,
      durationInDays: durInDays,
      maturityDate: newMatDate,
      maturityAmount: autoMat,
    }));
    if (sId > 0 && formData.branchID > 0) {
      fetchNextAccountNo(formData.branchID, sId);
    }
  };

  const normalizeToNumericDigits = (input: string): string => {
    if (!input) return '';
    const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    let normalized = String(input);
    devanagariDigits.forEach((d, i) => {
      normalized = normalized.replaceAll(d, i.toString());
    });
    return normalized.replace(/\D/g, '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'legacyAccountNumber') {
      const sanitized = normalizeToNumericDigits(value);
      setFormData((prev) => ({ ...prev, legacyAccountNumber: sanitized }));
      return;
    }

    const isNumericField = 
      (name.includes('Amount') || name.includes('Rate') || name === 'legacyAccruedInt' || name === 'branchID')
      && !name.toLowerCase().includes('date');

    const parsedVal = isNumericField
      ? parseFloat(value) || 0
      : value;
    
    if (name === 'branchID') {
      fetchNextAccountNo(parsedVal as number, formData.fdSchemeID);
    }

    if (name === 'lastInterestPostingDate') {
      if (value && value > '2026-03-31') {
        setError('शेवटची व्याज तारीख ३१/०३/२०२६ नंतरची असू शकत नाही.');
        return;
      }
      setError('');
    }

    if (name === 'maturityAmount') {
      setIsManualMaturityEdited(true);
      setFormData((prev) => ({
        ...prev,
        maturityAmount: parsedVal as number
      }));
      return;
    }

    if (name === 'maturityDate') {
      setIsManualMaturityDateEdited(true);
      setFormData((prev) => {
        const updated = {
          ...prev,
          maturityDate: value
        };
        // [RULE-FD-009] If user has not manually overridden maturityAmount, auto-calculate with new maturityDate
        if (!isManualMaturityEdited) {
          const selected = schemes.find((s: any) => getSchemeId(s) === updated.fdSchemeID);
          updated.maturityAmount = calculateMaturityAmount(
            Number(updated.depositAmount) || 0,
            Number(updated.interestRate) || 0,
            updated.openingDate,
            value,
            selected
          );
        }
        return updated;
      });
      return;
    }

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: parsedVal,
      };

      // [RULE-FD-010] Auto-suggest maturityDate if openingDate entered/changed and scheme has duration
      if (name === 'openingDate' && parsedVal) {
        const selected = schemes.find((s: any) => getSchemeId(s) === updated.fdSchemeID);
        if (selected?.durationMonths) {
          const durType = selected.durationType || 'Months';
          const durVal = Number(selected.durationMonths) || 0;
          const durInDays = durType === 'Days' ? durVal : (durType === 'Years' ? durVal * 365 : Math.round(durVal * 30.4167));
          updated.maturityDate = calculateMaturityDate(parsedVal as string, durVal, durType);
          updated.durationType = durType;
          updated.durationValue = durVal;
          updated.durationInDays = durInDays;
          setIsManualMaturityDateEdited(false);
        }
        // [RULE-FD-011] Auto-suggest lastInterestPostingDate to 31/03/2026 if opening date is before 01/04/2026
        if (!updated.lastInterestPostingDate && (parsedVal as string) < '2026-04-01') {
          updated.lastInterestPostingDate = '2026-03-31';
        }
      }

      // If user has not manually overridden maturityAmount, auto-calculate
      if (!isManualMaturityEdited && ['depositAmount', 'interestRate', 'openingDate', 'maturityDate'].includes(name)) {
        const selected = schemes.find((s: any) => getSchemeId(s) === updated.fdSchemeID);
        updated.maturityAmount = calculateMaturityAmount(
          Number(updated.depositAmount) || 0,
          Number(updated.interestRate) || 0,
          updated.openingDate,
          updated.maturityDate,
          selected
        );
      }

      return updated;
    });
  };

  const handleRecalculateMaturity = () => {
    const selected = schemes.find((s: any) => getSchemeId(s) === formData.fdSchemeID);
    const autoMat = calculateMaturityAmount(
      Number(formData.depositAmount) || 0,
      Number(formData.interestRate) || 0,
      formData.openingDate,
      formData.maturityDate,
      selected
    );
    setFormData((prev) => ({
      ...prev,
      maturityAmount: autoMat
    }));
    setIsManualMaturityEdited(false);
  };

  // [RULE-FD-010] Recalculate maturity date based on scheme duration and unit (Days/Months/Years)
  const handleRecalculateMaturityDate = () => {
    const selected = schemes.find((s: any) => getSchemeId(s) === formData.fdSchemeID);
    if (selected?.durationMonths && formData.openingDate) {
      const durType = selected.durationType || 'Months';
      const durVal = Number(selected.durationMonths) || 0;
      const durInDays = durType === 'Days' ? durVal : (durType === 'Years' ? durVal * 365 : Math.round(durVal * 30.4167));
      const autoMatDate = calculateMaturityDate(formData.openingDate, durVal, durType);
      setFormData((prev) => {
        const updated = {
          ...prev,
          durationType: durType,
          durationValue: durVal,
          durationInDays: durInDays,
          maturityDate: autoMatDate
        };
        if (!isManualMaturityEdited) {
          updated.maturityAmount = calculateMaturityAmount(
            Number(updated.depositAmount) || 0,
            Number(updated.interestRate) || 0,
            updated.openingDate,
            autoMatDate,
            selected
          );
        }
        return updated;
      });
      setIsManualMaturityDateEdited(false);
    }
  };

  const handleOpenFormSchedule = () => {
    const depAmt = Number(formData.depositAmount) || 0;
    if (depAmt <= 0 || !formData.openingDate || !formData.maturityDate) {
      setError('कृपया आधी ठेव मुद्दल, ठेव तारीख आणि मुदतपूर्ती तारीख भरा.');
      return;
    }

    const currentCustomer = customers.find((c: any) => Number(c.customerID || c.id || c.customerId) === Number(formData.customerID));
    const scheme = schemes.find((s: any) => getSchemeId(s) === Number(formData.fdSchemeID));

    const summary = generateFdInterestSchedule({
      depositAmount: depAmt,
      interestRate: Number(formData.interestRate) || 0,
      openingDate: formData.openingDate,
      maturityDate: formData.maturityDate,
      schemeType: scheme?.interestType || 'Cumulative',
      compoundingFrequency: scheme?.interestCompoundingFrequency || 'Quarterly',
      targetMaturityAmount: Number(formData.maturityAmount) || 0,
    });

    setScheduleModalData({
      summary,
      customerName: currentCustomer?.fullName || currentCustomer?.customerName || (currentCustomer?.firstName ? `${currentCustomer.firstName} ${currentCustomer.lastName || ''}`.trim() : 'खातेदार'),
      memberCode: currentCustomer?.legacyCustomerNo || currentCustomer?.customerCode || '',
      cifNo: currentCustomer?.cifNo || '',
      schemeName: scheme?.schemeName || 'मुदत ठेव योजना',
      isSeniorCitizen: false,
    });
    setIsScheduleModalOpen(true);
  };

  const handleOpenGridSchedule = (acc: FdAccountRecord) => {
    const depAmt = Number(acc.depositAmount) || 0;
    if (depAmt <= 0 || !acc.openingDate || !acc.maturityDate) {
      return;
    }

    const matchedScheme = schemes.find((s: any) => getSchemeId(s) === Number(acc.fdSchemeID));
    const opDate = acc.openingDate.split('T')[0];
    const matDate = acc.maturityDate.split('T')[0];

    const summary = generateFdInterestSchedule({
      depositAmount: depAmt,
      interestRate: Number(acc.interestRate) || 0,
      openingDate: opDate,
      maturityDate: matDate,
      schemeType: matchedScheme?.interestType || 'Cumulative',
      compoundingFrequency: matchedScheme?.interestCompoundingFrequency || 'Quarterly',
      targetMaturityAmount: Number(acc.maturityAmount) || 0,
    });

    setScheduleModalData({
      summary,
      customerName: acc.customerName || acc.memberName || 'खातेदार',
      memberCode: acc.memberCode || '',
      cifNo: acc.cifNo || '',
      schemeName: acc.schemeName || matchedScheme?.schemeName || 'मुदत ठेव योजना',
      isSeniorCitizen: false,
    });
    setIsScheduleModalOpen(true);
  };

  const resetForm = () => {
    setEditingAccountId(null);
    setIsManualMaturityEdited(false);
    setIsManualMaturityDateEdited(false);
    const bId = formData.branchID || 1;
    setFormData({
      branchID: bId,
      customerID: 0,
      fdSchemeID: 0,
      accountNo: '',
      legacyAccountNumber: '',
      openingDate: '',
      depositAmount: 0,
      interestRate: 0,
      durationType: 'Months',
      durationValue: 12,
      durationInDays: 365,
      maturityDate: '',
      maturityAmount: 0,
      legacyAccruedInt: 0,
      lastInterestPostingDate: '2026-03-31',
      nomineeName: '',
      nomineeRelation: '',
      remarks: '३१/०३/२०२६ पूर्वीचे चालू मुदत ठेव स्थलांतर',
    });
    fetchNextAccountNo(bId);
    setError('');
    setSuccess('');
  };

  const handleEdit = (acc: FdAccountRecord) => {
    setEditingAccountId(acc.fdAccountID);
    setIsManualMaturityEdited(true); // Preserve recorded value from database
    setIsManualMaturityDateEdited(true); // Preserve recorded maturity date from database
    const custId = acc.customerID || 0;
    setFormData({
      branchID: acc.branchID || 1,
      customerID: custId,
      fdSchemeID: acc.fdSchemeID || 0,
      accountNo: acc.accountNo || '',
      legacyAccountNumber: acc.legacyAccountNumber || '',
      openingDate: acc.openingDate ? acc.openingDate.split('T')[0] : '',
      depositAmount: acc.depositAmount || 0,
      interestRate: acc.interestRate || 0,
      durationType: acc.durationType || 'Months',
      durationValue: acc.durationValue || 0,
      durationInDays: acc.durationInDays || 0,
      maturityDate: acc.maturityDate ? acc.maturityDate.split('T')[0] : '',
      maturityAmount: acc.maturityAmount || 0,
      legacyAccruedInt: acc.legacyAccruedInt || 0,
      lastInterestPostingDate: acc.lastInterestPostingDate ? acc.lastInterestPostingDate.split('T')[0] : '',
      nomineeName: acc.nomineeName || '',
      nomineeRelation: acc.nomineeRelation || '',
      remarks: acc.remarks || '३१/०३/२०२६ पूर्वीचे चालू मुदत ठेव स्थलांतर',
    });
    setError('');
    setSuccess('');
    setShowMigratedModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      depositAmountInputRef.current?.focus();
      depositAmountInputRef.current?.select();
    }, 150);
  };

  const handleDelete = async (id: number, accNo: string, force: boolean = false) => {
    if (!force && !window.confirm(`तुम्हाला खरोखर मुदत ठेव खाते '${accNo}' डिलीट करायचे आहे का?`)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const res = await axios.delete(`${API_URL}/FdAccounts/${id}${force ? '?force=true' : ''}`);
      const successMsg = res.data?.message || `मुदत ठेव खाते '${accNo}' यशस्वीरित्या डिलीट केले.`;
      setSuccess(successMsg);
      await fetchMigratedAccounts();
      fetchNextAccountNo(formData.branchID, formData.fdSchemeID);
      if (editingAccountId === id) {
        resetForm();
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data || 'खाते डिलीट करताना त्रुटी आली.';
      setError(errMsg);
      if (err.response?.data?.canForce) {
        if (window.confirm(`${errMsg}\n\nतुम्हाला तरीही हे खाते बळजबरीने (Force Delete) नष्ट करायचे आहे का?`)) {
          await handleDelete(id, accNo, true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.customerID) {
      setError('कृपया खातेदार (Customer / CIF) निवडा.');
      return;
    }
    if (formData.fdSchemeID === 0) {
      setError('कृपया ठेव योजना निवडा.');
      return;
    }
    if (!formData.openingDate) {
      setError('कृपया ठेव तारीख (Opening Date) टाका.');
      return;
    }
    if (!formData.maturityDate) {
      setError('कृपया मुदतपूर्ती तारीख (Maturity Date) टाका.');
      return;
    }
    if (new Date(formData.maturityDate) <= new Date(formData.openingDate)) {
      setError('[RULE-FD-010] मुदतपूर्ती तारीख (Maturity Date) ही ठेव तारखेपेक्षा (Opening Date) पुढील असणे आवश्यक आहे.');
      return;
    }

    const depAmt = Number(formData.depositAmount) || 0;
    if (depAmt <= 0) {
      setError('ठेव मुद्दल रक्कम ० पेक्षा जास्त असणे आवश्यक आहे.');
      return;
    }

    const selectedScheme = schemes.find((s: any) => getSchemeId(s) === Number(formData.fdSchemeID));
    let matAmt = Number(formData.maturityAmount) || 0;

    // Fallback to auto-calculated if 0 or empty
    if (matAmt <= 0) {
      matAmt = calculateMaturityAmount(
        depAmt,
        Number(formData.interestRate) || 0,
        formData.openingDate,
        formData.maturityDate,
        selectedScheme
      );
    }

    // [RULE-FD-009] Validation: Maturity Amount cannot be less than Principal
    const isMis = (selectedScheme?.interestType || '').toLowerCase().includes('mis');
    if (!isMis && matAmt < depAmt) {
      setError(`[RULE-FD-009] मुदतपूर्ती रक्कम (₹${matAmt}) ठेव मुद्दलापेक्षा (₹${depAmt}) कमी असू शकत नाही.`);
      return;
    }

    // [RULE-FD-001] Strict Customer-First Architecture: resolve CustomerID
    const targetCustId = Number(formData.customerID);
    const selectedCust = customers.find((c: any) => Number(c.customerID || c.id || c.customerId) === targetCustId);
    const resolvedCustId = Number(selectedCust?.customerID || selectedCust?.id || targetCustId);

    if (!resolvedCustId || resolvedCustId <= 0) {
      setError('कृपया वैध खातेदार (Customer / CIF) निवडा.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        legacyAccountNumber: formData.legacyAccountNumber ? formData.legacyAccountNumber.trim() : null,
        lastInterestPostingDate: formData.lastInterestPostingDate ? formData.lastInterestPostingDate : null,
        customerID: resolvedCustId,
        depositAmount: depAmt,
        maturityAmount: matAmt,
        isLegacyAccount: true,
        status: 'Active'
      };

      if (editingAccountId) {
        await axios.put(`${API_URL}/FdAccounts/${editingAccountId}`, {
          fdAccountID: editingAccountId,
          ...payload
        });
        setSuccess('मुदत ठेव खात्याची माहिती यशस्वीरित्या अपडेट झाली!');
      } else {
        const res = await axios.post(`${API_URL}/FdAccounts/Migrate`, payload);
        const assignedNo = res.data?.accountNo || '';
        setSuccess(`जुन्या मुदत ठेव खात्याचे स्थलांतर यशस्वीरित्या झाले! ${assignedNo ? `(नवीन पावती क्र.: ${assignedNo})` : ''}`);
      }
      resetForm();
      fetchMigratedAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'माहिती जतन करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredAccounts.map((acc, i) => ({
      'अ.क्र.': i + 1,
      'नवीन पावती क्र.': acc.accountNo,
      'जुना पावती क्र.': acc.legacyAccountNumber || '-',
      'सीआयएफ क्र.': acc.cifNo || '-',
      'मेंबर कोड': acc.memberCode || '-',
      'खातेदाराचे नाव': acc.customerName || acc.memberName || '-',
      'योजनेचे नाव': acc.schemeName || '-',
      'ठेव तारीख (DD/MM/YYYY)': formatDateDisplay(acc.openingDate),
      'कालावधी': formatDurationDisplay(acc),
      'ठेव मुद्दल (₹)': acc.depositAmount || 0,
      'व्याजदर (%)': `${acc.interestRate || 0}%`,
      'मुदतपूर्ती दिनांक (DD/MM/YYYY)': formatDateDisplay(acc.maturityDate),
      'मुदतपूर्ती रक्कम (₹)': acc.maturityAmount || 0,
      'मागील जमा व्याज (₹)': acc.legacyAccruedInt || 0,
      'शेवटची व्याज तारीख (DD/MM/YYYY)': formatDateDisplay(acc.lastInterestPostingDate),
      'वारसदार नाव': acc.nomineeName || '-',
      'वारसदार नाते': acc.nomineeRelation || '-',
      'शेरा': acc.remarks || '-',
      'स्थिती': acc.status === 'Active' ? 'सक्रिय' : 'बंद'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FD_Migrated_List');
    XLSX.writeFile(wb, `FD_Migrated_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintModal = () => {
    window.print();
  };

  const formatCustomerLabel = (c: Customer) => {
    const nameParts = [c.firstName, c.middleName, c.lastName].filter(Boolean);
    let fullName = nameParts.join(' ').trim();
    if (!fullName) fullName = `खातेदार ID: ${c.customerID}`;

    const cifStr = c.cifNo ? `CIF: ${c.cifNo}` : '';
    const mobileStr = c.mobileNo ? `मो.: ${c.mobileNo}` : '';
    const details = [cifStr, mobileStr].filter(Boolean).join(' | ');
    return details ? `${fullName} (${details})` : fullName;
  };

  const filteredAccounts = migratedAccounts
    .filter((acc) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        (acc.accountNo && acc.accountNo.toLowerCase().includes(term)) ||
        (acc.legacyAccountNumber && acc.legacyAccountNumber.toLowerCase().includes(term)) ||
        (acc.customerName && acc.customerName.toLowerCase().includes(term)) ||
        (acc.memberName && acc.memberName.toLowerCase().includes(term)) ||
        (acc.cifNo && acc.cifNo.toLowerCase().includes(term)) ||
        (acc.memberCode && acc.memberCode.toLowerCase().includes(term)) ||
        (acc.schemeName && acc.schemeName.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => (a.accountNo || '').localeCompare(b.accountNo || '') || (a.fdAccountID - b.fdAccountID));

  // KPI Calculations
  const totalDepositAmount = migratedAccounts.reduce((sum, a) => sum + (a.depositAmount || 0), 0);
  const totalAccruedInt = migratedAccounts.reduce((sum, a) => sum + (a.legacyAccruedInt || 0), 0);
  const avgRate = migratedAccounts.length > 0
    ? (migratedAccounts.reduce((sum, a) => sum + (a.interestRate || 0), 0) / migratedAccounts.length).toFixed(2)
    : '0.00';

  const selectedCustomer = customers.find((c: any) => 
    Number(c.customerID || c.id || c.customerId) === Number(formData.customerID)
  );

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Landmark size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>मुदत ठेव सुरुवातीची शिल्लक स्थलांतर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(FD Opening Balance Migration)</span>
              {editingAccountId && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingAccountId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              ३१ मार्च पूर्वीची जुनी मुदत ठेव खाती, पावती क्रमांक, मुद्दल रक्कम, व्याजदर व मुदतपूर्ती रक्कम स्थलांतर व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {editingAccountId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          {/* SYNC WITH FINANCIAL STATEMENTS BUTTON */}
          <button
            type="button"
            onClick={handleSyncFinancialStatements}
            disabled={syncingFinancials}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="मुदत ठेव सुरुवातीची शिल्लक व साचलेले व्याज आर्थिक पत्रके (ताळेबंद / तेरीज) सह सिंक करा"
          >
            <Scale className={`w-3.5 h-3.5 ${syncingFinancials ? 'animate-spin' : ''}`} />
            <span>{syncingFinancials ? 'सिंक होत आहे...' : '📊 आर्थिक पत्रक सिंक करा'}</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchMigratedAccounts();
              setShowMigratedModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व स्थलांतरित मुदत ठेव यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेली खाती पहा ({migratedAccounts.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण स्थलांतरित FD</div>
            <div className="text-sm font-black text-gray-900">{migratedAccounts.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण ठेव मुद्दल (₹)</div>
            <div className="text-sm font-black text-emerald-800">₹{totalDepositAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सरासरी व्याजदर</div>
            <div className="text-sm font-black text-indigo-950">{avgRate}% p.a.</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">साचलेले जुने व्याज (₹)</div>
            <div className="text-sm font-black text-amber-800">₹{totalAccruedInt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* MAIN SINGLE UNIFIED FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          editingAccountId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Customer & Scheme Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. शाखा, खातेदार व ठेव योजना (Branch, Customer & Scheme)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">शाखा (Branch)</label>
                </div>
                <select name="branchID" value={formData.branchID} onChange={handleChange} className={inputClass}>
                  {branches.map((b) => (
                    <option key={b.branchID} value={b.branchID}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-6">
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    खातेदार निवडा (Customer / CIF) <span className="text-red-500">*</span>
                  </label>
                  {selectedCustomer && (
                    <span className="text-[10px] text-blue-900 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-mono">
                      {selectedCustomer.cifNo ? `CIF: ${selectedCustomer.cifNo}` : (selectedCustomer.legacyCustomerNo ? `जुना: ${selectedCustomer.legacyCustomerNo}` : `ID: ${selectedCustomer.customerID}`)}
                    </span>
                  )}
                </div>
                <CustomerSearchSelect
                  customers={customers}
                  value={formData.customerID || ''}
                  onChange={(val) => setFormData(prev => ({ 
                    ...prev, 
                    customerID: val ? Number(val) : 0
                  }))}
                  placeholder="-- खातेदार (CIF / नाव / मोबाईलने शोधा) --"
                />
                {selectedCustomer && (
                  <div className="mt-1 flex items-center justify-between text-[11px] bg-sky-50/70 border border-sky-200 px-2 py-1 rounded text-sky-950 font-bold shadow-2xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-sky-700">👤 खातेदार:</span>
                      <span className="font-extrabold text-slate-900">
                        {selectedCustomer.fullName || [selectedCustomer.firstName, selectedCustomer.middleName, selectedCustomer.lastName].filter(Boolean).join(' ') || (selectedCustomer as any).customerName}
                      </span>
                      {selectedCustomer.cifNo && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 border border-blue-300 ml-1">
                          CIF: {selectedCustomer.cifNo}
                        </span>
                      )}
                    </div>
                    {selectedCustomer.mobileNo && (
                      <span className="text-slate-600 font-mono text-[10px] shrink-0 ml-2">
                        📱 {selectedCustomer.mobileNo}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="sm:col-span-3">
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    मुदत ठेव योजना (FD Scheme) <span className="text-red-500">*</span>
                  </label>
                </div>
                <select name="fdSchemeID" value={formData.fdSchemeID} onChange={handleSchemeChange} className={inputClass} required>
                  <option value="0">-- योजना निवडा --</option>
                  {schemes.map((s: any) => (
                    <option key={getSchemeId(s)} value={getSchemeId(s)}>
                      {s.schemeName} ({s.interestRate}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Deposit Amount, Rates & Dates (Standardized 3x3 Grid) */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-3">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <IndianRupee className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. ठेव मुद्दल, पावती क्र. व मुदतपूर्ती माहिती (Deposit & Maturity)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {/* Row 1, Col 1: नवीन खाते क्र. */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    नवीन खाते क्र. (14-Digit CBS Account No) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold border border-emerald-300" title="सिस्टीम स्वयंचलित युनिक अनुक्रमांक वाटप करेल">
                    ⚡ ऑटो अनुक्रमांक
                  </span>
                </div>
                <input
                  type="text"
                  name="accountNo"
                  value={formData.accountNo}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-primary bg-blue-50/20`}
                  placeholder="उदा. 001-401-0000001-1 (स्वयंचलित)"
                  required
                />
              </div>

              {/* Row 1, Col 2: जुना पावती क्र. */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    जुना पावती क्र. (Old Receipt No)
                  </label>
                  <span className="text-[9px] text-amber-700 font-semibold">फक्त अंकात</span>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="legacyAccountNumber"
                  value={formData.legacyAccountNumber}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-amber-900 bg-amber-50/40 border-amber-300 focus:border-amber-500`}
                  placeholder="उदा. 1024"
                  title="फक्त अंक (0-9) टाका"
                />
              </div>

              {/* Row 1, Col 3: ठेव मुद्दल रक्कम */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    ठेव मुद्दल रक्कम (Deposit Amount ₹) <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  ref={depositAmountInputRef}
                  type="number"
                  name="depositAmount"
                  value={formData.depositAmount}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-mono font-bold text-emerald-700`}
                  min="1"
                  placeholder="उदा. 100000"
                  required
                />
              </div>

              {/* Row 2, Col 1: ठेव तारीख */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    ठेव तारीख (Opening Date) <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  type="date"
                  name="openingDate"
                  value={formData.openingDate}
                  onChange={handleChange}
                  className={inputClass}
                  required
                />
              </div>

              {/* Row 2, Col 2: मुदतपूर्ती तारीख */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                    <span>मुदतपूर्ती तारीख (Maturity Date)</span>
                    <span className="text-red-500">*</span>
                    {formData.durationValue > 0 && (
                      <span className="text-[10px] text-primary font-bold bg-primary/10 px-1 py-0.2 rounded border border-primary/20 font-mono">
                        {formData.durationValue} {formData.durationType === 'Days' ? 'दिवस' : formData.durationType === 'Years' ? 'वर्षे' : 'महिने'}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-1">
                    {isManualMaturityDateEdited ? (
                      <span className="text-[9px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-bold border border-amber-300" title="मॅन्युअली बदललेली तारीख">
                        ✏️ मॅन्युअल
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold border border-emerald-300" title="योजनेनुसार आलेली तारीख">
                        ⚡ ऑटो
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleRecalculateMaturityDate}
                      className="text-[10px] text-primary hover:text-primary-dark font-bold underline cursor-pointer flex items-center gap-0.5"
                      title="योजनेच्या कालावधीप्रमाणे पुन्हा तारीख आणा"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>री-कॅल्क</span>
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  name="maturityDate"
                  value={formData.maturityDate}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold ${
                    isManualMaturityDateEdited ? 'text-amber-900 bg-amber-50/40 border-amber-300' : 'text-primary bg-blue-50/20'
                  }`}
                  required
                />
              </div>

              {/* Row 2, Col 3: मुदतपूर्ती रक्कम */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    मुदतपूर्ती रक्कम (Maturity ₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    {isManualMaturityEdited ? (
                      <span className="text-[9px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-bold border border-amber-300" title="जुन्या छापील पावतीप्रमाणे मॅन्युअली बदललेले">
                        ✏️ मॅन्युअल
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold border border-emerald-300" title="सिस्टीमने आपोआप मोजलेले">
                        ⚡ ऑटो
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleRecalculateMaturity}
                      className="text-[10px] text-primary hover:text-primary-dark font-bold underline cursor-pointer flex items-center gap-0.5"
                      title="सूत्राप्रमाणे पुन्हा स्वयं-गणना करा"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      <span>री-कॅल्क</span>
                    </button>
                    {Number(formData.depositAmount) > 0 && formData.maturityDate && (
                      <button
                        type="button"
                        onClick={handleOpenFormSchedule}
                        className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-xs hover:shadow flex items-center gap-0.5 transition-all cursor-pointer whitespace-nowrap ml-1"
                        title="सविस्तर तिमाही/मासिक व्याज तक्ता व वेळापत्रक पहा"
                      >
                        <span>📊</span>
                        <span>व्याज तक्ता</span>
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="number"
                  name="maturityAmount"
                  value={formData.maturityAmount || ''}
                  onChange={handleChange}
                  onFocus={(e) => e.target.select()}
                  className={`${inputClass} font-mono font-bold ${
                    isManualMaturityEdited ? 'text-amber-900 bg-amber-50/40 border-amber-300' : 'text-primary bg-blue-50/20'
                  }`}
                  placeholder="उदा. 108243"
                  required
                />
                {formData.maturityAmount > 0 && formData.depositAmount > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-[9px] text-gray-500 font-medium">
                      <span>अंदाजित व्याज: </span>
                      <span className="font-bold text-emerald-700 font-mono">
                        +₹{Math.max(0, formData.maturityAmount - formData.depositAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenFormSchedule}
                      className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                      title="सविस्तर तिमाही/मासिक व्याज तक्ता पहा"
                    >
                      <span>📊 वेळापत्रक तक्ता</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Row 3, Col 1: व्याजदर */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    व्याजदर (% p.a.) <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  type="number"
                  step="0.01"
                  name="interestRate"
                  value={formData.interestRate}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-primary`}
                  required
                />
              </div>

              {/* Row 3, Col 2: शेवटची व्याज तारीख */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    शेवटची व्याज तारीख (Last Int. Date)
                  </label>
                  {formData.lastInterestPostingDate && (
                    <span className="text-[9px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-bold border border-blue-300" title="नवीन वर्षात व्याज मोजण्याचा कट-ऑफ">
                      कट-ऑफ
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  name="lastInterestPostingDate"
                  max="2026-03-31"
                  value={formData.lastInterestPostingDate}
                  onChange={handleChange}
                  className={inputClass}
                  title="जुन्या सॉफ्टवेअरमध्ये ज्या तारखेपर्यंत व्याज झाले होते ती तारीख (जास्तीत जास्त 31/03/2026)"
                />
              </div>

              {/* Row 3, Col 3: साचलेले जुने व्याज */}
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    साचलेले जुने व्याज (Accrued Int. ₹)
                  </label>
                  <span className="text-[9px] text-gray-400">कट-ऑफ अखेरचे</span>
                </div>
                <input
                  type="number"
                  name="legacyAccruedInt"
                  value={formData.legacyAccruedInt}
                  onChange={handleChange}
                  className={`${inputClass} font-mono font-bold text-amber-800 bg-amber-50/20`}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Nominee & Remarks */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">३. वारसदार व शेरा (Nominee & Remarks)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">वारसदाराचे नाव (Nominee Name)</label>
                </div>
                <input
                  type="text"
                  name="nomineeName"
                  value={formData.nomineeName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. सुनीता रमेश पाटील"
                />
              </div>

              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">वारसदाराशी नाते (Relation)</label>
                </div>
                <input
                  type="text"
                  name="nomineeRelation"
                  value={formData.nomineeRelation}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. पत्नी / मुलगा"
                />
              </div>

              <div>
                <div className="flex items-center justify-between min-h-[22px] mb-1">
                  <label className="text-[11px] font-bold text-gray-700">शेरा (Remarks)</label>
                </div>
                <input
                  type="text"
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="उदा. जुनी मुदत ठेव स्थलांतर"
                />
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{editingAccountId ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 ${
                editingAccountId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'जतन होत आहे...' : editingAccountId ? 'बदल सेव्ह करा (Update)' : 'मुदत ठेव स्थलांतर सेव्ह करा (Migrate FD)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED FD ACCOUNTS LIST                                   */}
      {/* ========================================================================= */}
      {showMigratedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-[96vw] xl:max-w-7xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>स्थलांतरित मुदत ठेव (FD) यादी (Migrated FD Accounts List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredAccounts.length} खाती
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMigratedModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input 
                  type="text" 
                  placeholder="पावती क्र, नाव, कोड, वारसदार किंवा योजना शोधा..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-64 lg:w-80 focus:outline-none focus:border-primary bg-white shadow-2xs"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                  एकूण ठेव: <strong className="text-emerald-700 font-mono">₹{filteredAccounts.reduce((s, a) => s + (a.depositAmount || 0), 0).toLocaleString('en-IN')}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filteredAccounts.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="सर्व फील्ड्ससह एक्सेल फाइल डाउनलोड करा"
                >
                  <FileSpreadsheet size={13} />
                  <span>एक्सेल एक्सपोर्ट</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintModal}
                  disabled={filteredAccounts.length === 0}
                  className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="स्थलांतरित मुदत ठेव यादी प्रिंट करा"
                >
                  <Printer size={13} />
                  <span>प्रिंट (A4)</span>
                </button>
              </div>
            </div>

            {/* Modal Alert Messages (Delete / Edit Feedback) */}
            {error && (
              <div className="mx-2.5 mt-2 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center justify-between text-xs font-bold shadow-2xs shrink-0">
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
                <button type="button" onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">✕</button>
              </div>
            )}
            {success && (
              <div className="mx-2.5 mt-2 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center justify-between text-xs font-bold shadow-2xs shrink-0">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{success}</span>
                </div>
                <button type="button" onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">✕</button>
              </div>
            )}

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center sticky left-0 bg-slate-100 z-10 w-28">कृती</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">नवीन खाते क्र. (CBS Account No)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">जुना पावती क्र.</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left min-w-[170px]">खातेदाराचे नाव & CIF</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">योजना नाव</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">ठेव तारीख</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">कालावधी</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">ठेव मुद्दल (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याजदर (%)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">मुदतपूर्ती दिनांक</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">मुदतपूर्ती रक्कम (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">मागील जमा व्याज (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">शेवटची व्याज तारीख</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">वारसदार व नाते</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left max-w-[200px]">शेरा</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredAccounts.map((acc) => (
                      <tr key={acc.fdAccountID} className="hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap sticky left-0 bg-white z-10 shadow-r">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => handleOpenGridSchedule(acc)} 
                              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="व्याज वेळापत्रक तक्ता पहा (View Interest Schedule)"
                            >
                              <span>📊</span>
                              <span>तक्ता</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleEdit(acc)} 
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="खाते फॉर्ममध्ये लोड करा (Load in Form)"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>सुधारा</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleDelete(acc.fdAccountID, acc.accountNo)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="खाते डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-mono font-bold text-primary">
                          {formatAccountNo(acc.accountNo)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-mono font-bold text-amber-900">
                          {acc.legacyAccountNumber ? (
                            <span className="bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                              {acc.legacyAccountNumber}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-900">{acc.customerName || acc.memberName}</div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {acc.cifNo ? `CIF: ${acc.cifNo}` : ''}
                            {acc.cifNo && acc.memberCode ? ' | ' : ''}
                            {acc.memberCode ? `कोड: ${acc.memberCode}` : ''}
                            {!acc.cifNo && !acc.memberCode ? '-' : ''}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-800">
                          {acc.schemeName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono font-medium text-slate-800">
                          {formatDateDisplay(acc.openingDate)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono">
                          {formatDurationDisplay(acc)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                          ₹{(acc.depositAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono">
                          {acc.interestRate}%
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono text-gray-700">
                          {formatDateDisplay(acc.maturityDate)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-primary">
                          ₹{(acc.maturityAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-medium text-amber-800">
                          ₹{(acc.legacyAccruedInt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono font-bold text-blue-700">
                          {formatDateDisplay(acc.lastInterestPostingDate)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-800">
                          {acc.nomineeName ? (
                            <div>
                              <span className="font-medium">{acc.nomineeName}</span>
                              {acc.nomineeRelation && (
                                <span className="text-[10px] text-gray-500 ml-1">({acc.nomineeRelation})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-600 max-w-[200px] truncate" title={acc.remarks || ''}>
                          {acc.remarks || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            acc.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {acc.status === 'Active' ? 'Active' : 'Closed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <tr>
                        <td colSpan={16} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतेही स्थलांतरित मुदत ठेव खाते सापडले नाही.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredAccounts.length > 0 && (
                    <tfoot className="bg-slate-50 font-bold border-t-2 border-gray-300 text-xs">
                      <tr>
                        <td colSpan={7} className="px-2 py-2 text-right border-r border-gray-300 font-bold text-gray-700 sticky left-0 bg-slate-50 z-10">
                          एकूण बेरीज ({filteredAccounts.length} खाती):
                        </td>
                        <td className="px-2 py-2 text-right border-r border-gray-300 font-mono font-bold text-emerald-800">
                          ₹{filteredAccounts.reduce((sum, a) => sum + (a.depositAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2} className="px-2 py-2 border-r border-gray-300 text-center text-gray-400">-</td>
                        <td className="px-2 py-2 text-right border-r border-gray-300 font-mono font-bold text-primary">
                          ₹{filteredAccounts.reduce((sum, a) => sum + (a.maturityAmount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-2 text-right border-r border-gray-300 font-mono font-bold text-amber-900">
                          ₹{filteredAccounts.reduce((sum, a) => sum + (a.legacyAccruedInt || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td colSpan={4} className="px-2 py-2"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-gray-500 font-medium">
                टीप: 'सुधारा' वर क्लिक केल्यास खाते थेट मुख्य फॉर्ममध्ये संपादन करण्यासाठी लोड होईल.
              </span>
              <button
                type="button"
                onClick={() => setShowMigratedModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FD Interest Accrual & Amortization Chart Modal */}
      {isScheduleModalOpen && scheduleModalData && (
        <FdInterestScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          summary={scheduleModalData.summary}
          customerName={scheduleModalData.customerName}
          memberCode={scheduleModalData.memberCode}
          cifNo={scheduleModalData.cifNo}
          schemeName={scheduleModalData.schemeName}
          isSeniorCitizen={scheduleModalData.isSeniorCitizen}
        />
      )}

    </div>
  );
};

export default FdOpeningBalanceMigration;

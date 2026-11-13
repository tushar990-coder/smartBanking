import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldCheck,
  X,
  Clock,
  Sparkles,
  Info,
  ChevronDown,
  Building2,
  FolderDown,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { transliterateMarathi } from '../utils/transliterateMarathi';
import { isValidAadhaar, isValidPAN } from '../utils/kycValidation';

export interface BulkCustomerRow {
  id: string; // unique client id
  customerID?: number; // 0 or undefined for new customer, > 0 for existing customer
  cifNo?: string; // CIF number if existing
  isExisting?: boolean; // visual flag
  isDirty?: boolean; // true once edited (or newly added with data)
  firstName: string;
  middleName: string;
  lastName: string;
  firstNameEng: string;
  middleNameEng: string;
  lastNameEng: string;
  mobileNo: string;
  aadhaarNo: string;
  panNo: string;
  gender: string;
  birthDate: string;
  address: string;
  village: string;
  taluka: string;
  district: string;
  occupation: string;
  customerType: string;
  kycStatus: string;
  ckycNo: string;
  riskCategory: string;
  email: string;
  nomineeName: string;
  nomineeRelation: string;
  legacyCustomerNo: string;
}

export interface RowValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SansthaDefaults {
  address?: string;
  village?: string;
  taluka?: string;
  district?: string;
  state?: string;
  pinCode?: string;
}

interface BranchOption {
  branchID: number;
  branchCode: string;
  branchName: string;
}

interface CustomerBulkEntryProps {
  onBack?: () => void;
  onNavigateToCustomers?: () => void;
}

const STORAGE_DRAFT_KEY = 'BHISI_CUSTOMER_BULK_ENTRY_DRAFT_V2';
const DEFAULT_BIRTH_DATE = '1990-01-01';
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const CKYC_REGEX = /^\d{14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CUSTOMER_TYPES = ['Individual', 'Proprietorship', 'Partnership', 'PvtLtd', 'PublicLtd', 'Trust', 'Society', 'SHG', 'HUF'] as const;
const KYC_STATUSES = ['Verified', 'Pending', 'ReKYCDue', 'Simplified', 'Exempted'] as const;
const RISK_CATEGORIES = ['Low', 'Medium', 'High'] as const;

const createEmptyRow = (
  customDefaults?: Partial<BulkCustomerRow>,
  sanstha?: SansthaDefaults | null
): BulkCustomerRow => ({
  id: 'row_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
  customerID: 0,
  cifNo: '',
  isExisting: false,
  isDirty: false,
  firstName: '',
  middleName: '',
  lastName: '',
  firstNameEng: '',
  middleNameEng: '',
  lastNameEng: '',
  mobileNo: '',
  aadhaarNo: '',
  panNo: '',
  gender: 'Male',
  birthDate: DEFAULT_BIRTH_DATE,
  address: sanstha?.address || '',
  village: sanstha?.village || '',
  taluka: sanstha?.taluka || '',
  district: sanstha?.district || '',
  occupation: customDefaults?.occupation ?? 'शेती',
  customerType: 'Individual',
  kycStatus: 'Verified',
  ckycNo: '',
  riskCategory: 'Low',
  email: '',
  nomineeName: '',
  nomineeRelation: '',
  legacyCustomerNo: '',
  ...customDefaults,
});

function parseExcelDate(val: any, fallback: string): string {
  if (val === undefined || val === null || val === '') return fallback;

  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof val === 'number' && val > 1 && val < 100000) {
    // Excel date serial (days since 1899-12-30 UTC)
    const utcMs = Date.UTC(1899, 11, 30) + Math.round(val) * 86400000;
    const dObj = new Date(utcMs);
    if (!isNaN(dObj.getTime())) {
      const y = dObj.getUTCFullYear();
      const m = String(dObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  return fallback;
}

function normalizeCustomerType(raw: string): string {
  const v = raw.trim();
  if (!v) return 'Individual';
  const low = v.toLowerCase();
  if (low.includes('बचत') || low === 'shg') return 'SHG';
  if (low.includes('भागीदारी') || low === 'partnership') return 'Partnership';
  if (low.includes('एकल') || low === 'proprietorship') return 'Proprietorship';
  if (low.includes('pvt')) return 'PvtLtd';
  if (low.includes('public')) return 'PublicLtd';
  if (low.includes('विश्वस्त') || low === 'trust') return 'Trust';
  if (low.includes('सहकारी') || low === 'society') return 'Society';
  if (low === 'huf') return 'HUF';
  const exact = CUSTOMER_TYPES.find((t) => t.toLowerCase() === low);
  return exact || v;
}

function normalizeKycStatus(raw: string): string {
  const v = raw.trim();
  if (!v) return 'Verified';
  const exact = KYC_STATUSES.find((k) => k.toLowerCase() === v.toLowerCase());
  return exact || v;
}

function normalizeRiskCategory(raw: string): string {
  const v = raw.trim();
  if (!v) return 'Low';
  const exact = RISK_CATEGORIES.find((r) => r.toLowerCase() === v.toLowerCase());
  return exact || v;
}

function isRowContentPresent(r: BulkCustomerRow): boolean {
  return Boolean(
    r.firstName.trim() ||
      r.middleName.trim() ||
      r.lastName.trim() ||
      r.mobileNo.trim() ||
      r.aadhaarNo.trim() ||
      r.panNo.trim() ||
      r.ckycNo.trim() ||
      r.legacyCustomerNo.trim() ||
      r.email.trim() ||
      r.nomineeName.trim()
  );
}

function checkMaxLen(val: string, maxLen: number, label: string, errors: string[]) {
  if (val && val.trim().length > maxLen) {
    errors.push(`${label} कमाल ${maxLen} अक्षरांपर्यंत असावा (सध्या ${val.trim().length}).`);
  }
}

function getExactExcelCell(row: Record<string, any>, exactKeys: string[], fallbackTokens: string[]): any {
  const rowEntries = Object.entries(row);

  // Pass 1: exact (case-insensitive, normalized punctuation) match on known header names
  for (const target of exactKeys) {
    const cleanTarget = target.trim().toLowerCase();
    const normTarget = cleanTarget.replace(/[\s*()_\-\/]/g, '');
    for (const [hdr, val] of rowEntries) {
      const cleanHdr = hdr.trim().toLowerCase();
      const normHdr = cleanHdr.replace(/[\s*()_\-\/]/g, '');
      if (cleanHdr === cleanTarget || normHdr === normTarget) {
        return val;
      }
    }
  }

  // Pass 2: safe full-token / prefix match avoiding ambiguous 1-word collisions
  for (const token of fallbackTokens) {
    const lowTok = token.toLowerCase();
    for (const [hdr, val] of rowEntries) {
      const lowHdr = hdr.trim().toLowerCase();
      if (lowHdr.includes(lowTok)) {
        return val;
      }
    }
  }

  return '';
}

export default function CustomerBulkEntry({ onBack, onNavigateToCustomers }: CustomerBulkEntryProps) {
  const [sansthaDefaults, setSansthaDefaults] = useState<SansthaDefaults | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [isHoAdmin, setIsHoAdmin] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const [rows, setRows] = useState<BulkCustomerRow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore corrupted draft
    }
    return Array.from({ length: 10 }, () => createEmptyRow());
  });

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'invalid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nextCifPreview, setNextCifPreview] = useState('CIF000001');
  const [lastDraftSavedTime, setLastDraftSavedTime] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Live Server Duplicates Cache (keyed strictly by clientRowId = row.id)
  const [serverErrorsMap, setServerErrorsMap] = useState<Record<string, string[]>>({});
  const [isValidatingServer, setIsValidatingServer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saving States
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<string>('');
  const [saveResultModal, setSaveResultModal] = useState<{
    isOpen: boolean;
    success: boolean;
    batchNumber: string;
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    startCif: string;
    endCif: string;
    message: string;
  } | null>(null);

  // Quick-fill popover state
  const [quickFillVillage, setQuickFillVillage] = useState('');
  const [quickFillTaluka, setQuickFillTaluka] = useState('');
  const [quickFillDistrict, setQuickFillDistrict] = useState('');
  const [showQuickFill, setShowQuickFill] = useState(false);

  // Existing Customers Load Modal State
  const [showExistingModal, setShowExistingModal] = useState(false);
  const [existingSearch, setExistingSearch] = useState('');
  const [existingOnlyIncomplete, setExistingOnlyIncomplete] = useState(false);
  const [existingLimit, setExistingLimit] = useState(50);
  const [existingBranchFilter, setExistingBranchFilter] = useState<string>('all');
  const [existingCustomersList, setExistingCustomersList] = useState<any[]>([]);
  const [selectedExistingIds, setSelectedExistingIds] = useState<Set<number>>(new Set());
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  const loadMetadata = useCallback(async (applyFreshDefaults = false) => {
    try {
      const res = await axios.get('/api/CustomerBulk/meta');
      if (res.data?.nextCif) {
        setNextCifPreview(res.data.nextCif);
      }
      if (Array.isArray(res.data?.branches)) {
        setBranches(res.data.branches);
      }
      setIsHoAdmin(Boolean(res.data?.isHoAdmin));
      const opBranch = res.data?.operatingBranchId ? String(res.data.operatingBranchId) : '';
      setSelectedBranchId((prev) => prev || opBranch);

      if (res.data?.sansthaDefaults) {
        const s = res.data.sansthaDefaults;
        setSansthaDefaults(s);
        setQuickFillVillage((prev) => prev || s.village || '');
        setQuickFillTaluka((prev) => prev || s.taluka || '');
        setQuickFillDistrict((prev) => prev || s.district || '');

        if (applyFreshDefaults) {
          setRows((prevRows) => {
            const isFresh = prevRows.every(
              (r) => !r.isExisting && !r.firstName && !r.lastName && !r.mobileNo && !r.aadhaarNo
            );
            if (!isFresh) return prevRows;
            return prevRows.map((r) => ({
              ...r,
              occupation: r.occupation || 'शेती',
              birthDate: r.birthDate || DEFAULT_BIRTH_DATE,
              address: r.address || s.address || '',
              village: r.village || s.village || '',
              taluka: r.taluka || s.taluka || '',
              district: r.district || s.district || '',
            }));
          });
        }
      }
    } catch {
      // silent metadata error handled elsewhere
    }
  }, []);

  useEffect(() => {
    loadMetadata(true);
  }, [loadMetadata]);

  // Warn before tab unload if unsaved changes exist
  const hasUnsavedChanges = useMemo(
    () => rows.some((r) => (r.isExisting ? r.isDirty : isRowContentPresent(r))),
    [rows]
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // AUTO-SAVE DRAFT ONLY FOR NEW (NON-EXISTING) ROWS (Debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const draftNewRows = rows.filter((r) => !r.isExisting && isRowContentPresent(r));
      if (draftNewRows.length > 0 && draftNewRows.length <= 250) {
        try {
          localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(draftNewRows));
          const now = new Date();
          setLastDraftSavedTime(
            now.toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
        } catch (e) {
          console.error('Draft save failed', e);
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [rows]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, searchQuery, pageSize]);

  // Original index lookup map (prevents filtered-index mismatch bugs!)
  const rowIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r, i) => map.set(r.id, i));
    return map;
  }, [rows]);

  // REAL-TIME CLIENT-SIDE VALIDATION
  const validations = useMemo(() => {
    const valMap = new Map<string, RowValidation>();

    const mobileFreq: Record<string, number> = {};
    const aadhaarFreq: Record<string, number> = {};
    const panFreq: Record<string, number> = {};
    const ckycFreq: Record<string, number> = {};
    const legacyFreq: Record<string, number> = {};
    const existingIdFreq: Record<number, number> = {};

    rows.forEach((r) => {
      const mob = r.mobileNo.trim();
      const aadh = r.aadhaarNo.trim();
      const pan = r.panNo.trim().toUpperCase();
      const ckyc = r.ckycNo.trim();
      const leg = r.legacyCustomerNo.trim().toUpperCase();

      if (r.customerID && r.customerID > 0) {
        existingIdFreq[r.customerID] = (existingIdFreq[r.customerID] || 0) + 1;
      }
      if (mob) mobileFreq[mob] = (mobileFreq[mob] || 0) + 1;
      if (aadh) aadhaarFreq[aadh] = (aadhaarFreq[aadh] || 0) + 1;
      if (pan) panFreq[pan] = (panFreq[pan] || 0) + 1;
      if (ckyc) ckycFreq[ckyc] = (ckycFreq[ckyc] || 0) + 1;
      if (leg) legacyFreq[leg] = (legacyFreq[leg] || 0) + 1;
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);

    rows.forEach((r) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const isBlankNewRow = !r.isExisting && !isRowContentPresent(r);
      if (isBlankNewRow) {
        errors.push('पहिले नाव आणि आडनाव आवश्यक आहे.');
      } else {
        if (r.customerID && r.customerID > 0 && existingIdFreq[r.customerID] > 1) {
          errors.push('हा विद्यमान खातेदार ग्रिडमध्ये एकापेक्षा जास्त वेळा आला आहे.');
        }

        if (!r.firstName.trim()) errors.push('पहिले नाव आवश्यक आहे (First name is required).');
        if (!r.lastName.trim()) errors.push('आडनाव आवश्यक आहे (Last name is required).');

        checkMaxLen(r.firstName, 50, 'पहिले नाव', errors);
        checkMaxLen(r.middleName, 50, 'मधले नाव', errors);
        checkMaxLen(r.lastName, 50, 'आडनाव', errors);
        checkMaxLen(r.firstNameEng, 50, 'First Name (Eng)', errors);
        checkMaxLen(r.middleNameEng, 50, 'Middle Name (Eng)', errors);
        checkMaxLen(r.lastNameEng, 50, 'Last Name (Eng)', errors);
        checkMaxLen(r.legacyCustomerNo, 50, 'जुना खातेदार क्र.', errors);
        checkMaxLen(r.village, 100, 'गाव / शहर', errors);
        checkMaxLen(r.taluka, 100, 'तालुका', errors);
        checkMaxLen(r.district, 100, 'जिल्हा', errors);
        checkMaxLen(r.address, 500, 'पत्ता', errors);
        checkMaxLen(r.occupation, 100, 'व्यवसाय', errors);
        checkMaxLen(r.nomineeName, 150, 'वारसदार नाव', errors);
        checkMaxLen(r.nomineeRelation, 50, 'वारसदार नाते', errors);
        checkMaxLen(r.email, 150, 'ईमेल', errors);

        const mob = r.mobileNo.trim();
        if (mob) {
          if (!MOBILE_REGEX.test(mob)) {
            errors.push('मोबाईल नंबर १० अंकी वैध असावा (६-९ ने सुरू).');
          } else if (mobileFreq[mob] > 1) {
            errors.push(`मोबाईल नंबर '${mob}' ग्रिडमध्ये पुनरावृत्ती (Duplicate) झाला आहे.`);
          }
        }

        const aadh = r.aadhaarNo.trim();
        if (aadh) {
          const aCheck = isValidAadhaar(aadh);
          if (!aCheck.isValid) {
            errors.push(aCheck.error || 'आधार क्रमांक १२ अंकी वैध असावा.');
          } else if (aadhaarFreq[aadh] > 1) {
            errors.push(`आधार क्रमांक '${aadh}' ग्रिडमध्ये पुनरावृत्ती (Duplicate) झाला आहे.`);
          }
        }

        const pan = r.panNo.trim().toUpperCase();
        if (pan) {
          const pCheck = isValidPAN(pan);
          if (!pCheck.isValid) {
            errors.push(pCheck.error || 'पॅन नंबर १० अक्षरी वैध फॉरमॅटमध्ये असावा (उदा. ABCDE1234F).');
          } else if (panFreq[pan] > 1) {
            errors.push(`पॅन नंबर '${pan}' ग्रिडमध्ये पुनरावृत्ती (Duplicate) झाला आहे.`);
          }
        }

        const ckyc = r.ckycNo.trim();
        if (ckyc) {
          if (!CKYC_REGEX.test(ckyc)) {
            errors.push('सी-केवायसी क्रमांक १४ अंकी असावा.');
          } else if (ckycFreq[ckyc] > 1) {
            errors.push(`CKYC क्रमांक '${ckyc}' ग्रिडमध्ये पुनरावृत्ती झाला आहे.`);
          }
        }

        const leg = r.legacyCustomerNo.trim().toUpperCase();
        if (leg && legacyFreq[leg] > 1) {
          errors.push(`जुना खातेदार क्र. '${r.legacyCustomerNo.trim()}' ग्रिडमध्ये पुनरावृत्ती झाला आहे.`);
        }

        const email = r.email.trim();
        if (email && !EMAIL_REGEX.test(email)) {
          errors.push('ईमेल फॉरमॅट अवैध आहे.');
        }

        if (!CUSTOMER_TYPES.includes(r.customerType as any)) {
          errors.push(`खातेदार प्रकार '${r.customerType}' अवैध आहे.`);
        }
        if (!KYC_STATUSES.includes(r.kycStatus as any)) {
          errors.push(`केवायसी स्थिती '${r.kycStatus}' अवैध आहे.`);
        }
        if (!RISK_CATEGORIES.includes(r.riskCategory as any)) {
          errors.push(`जोखीम वर्ग '${r.riskCategory}' अवैध आहे.`);
        }

        if (r.birthDate) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(r.birthDate) || isNaN(new Date(r.birthDate).getTime())) {
            errors.push('जन्मतारीख अवैध स्वरूपात आहे (YYYY-MM-DD असावी).');
          } else if (r.birthDate > todayStr) {
            errors.push('जन्मतारीख भविष्यातील असू शकत नाही.');
          } else if (new Date(r.birthDate) > eighteenYearsAgo) {
            warnings.push('खातेदार अल्पवयीन (वय १८ पेक्षा कमी - Minor) आहे.');
          }
        }

        if (r.nomineeName?.trim() && !r.nomineeRelation?.trim()) {
          warnings.push('वारसदाराचे नाव भरले आहे, नाते (Relation) भरणे उचित ठरेल.');
        }

        const serverErrs = serverErrorsMap[r.id];
        if (serverErrs && serverErrs.length > 0) {
          serverErrs.forEach((serr) => {
            if (!errors.includes(serr)) errors.push(serr);
          });
        }
      }

      valMap.set(r.id, {
        isValid: errors.length === 0,
        errors,
        warnings,
      });
    });

    return valMap;
  }, [rows, serverErrorsMap]);

  // KPI Counts & Actionable Saveable Count
  const { totalRows, validRows, invalidRows, saveableValidCount } = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    let saveable = 0;
    rows.forEach((r) => {
      const v = validations.get(r.id);
      if (v?.isValid) {
        valid++;
        if (!r.customerID || r.customerID <= 0 || r.isDirty) {
          saveable++;
        }
      } else {
        invalid++;
      }
    });
    return {
      totalRows: rows.length,
      validRows: valid,
      invalidRows: invalid,
      saveableValidCount: saveable,
    };
  }, [rows, validations]);

  const newRowCifMap = useMemo(() => {
    const map = new Map<string, string>();
    let baseNum = 1;
    let prefix = 'CIF';
    let padLen = 6;

    if (nextCifPreview) {
      const letters = nextCifPreview.match(/^[A-Za-z]+/)?.[0] || 'CIF';
      const digits = nextCifPreview.replace(/\D/g, '');
      prefix = letters;
      if (digits) {
        baseNum = parseInt(digits, 10);
        padLen = digits.length;
      }
    }

    let maxExistingCifNum = 0;
    rows.forEach((r) => {
      if (r.cifNo && r.cifNo.startsWith(prefix)) {
        const num = parseInt(r.cifNo.substring(prefix.length), 10);
        if (!isNaN(num) && num > maxExistingCifNum) {
          maxExistingCifNum = num;
        }
      }
    });

    let currentNewNum = Math.max(baseNum, maxExistingCifNum + 1);
    rows.forEach((r) => {
      if (!r.customerID || r.customerID <= 0) {
        map.set(r.id, `${prefix}${String(currentNewNum).padStart(padLen, '0')}`);
        currentNewNum++;
      }
    });
    return map;
  }, [rows, nextCifPreview]);

  // DEBOUNCED SERVER DUPLICATE VALIDATION
  const validateWithServer = useCallback(async (sourceRows: BulkCustomerRow[]) => {
    const candidateRows = sourceRows
      .map((r, i) => ({
        rowIndex: i + 1,
        clientRowId: r.id,
        customerID: r.customerID || 0,
        firstName: r.firstName,
        lastName: r.lastName,
        mobileNo: r.mobileNo,
        aadhaarNo: r.aadhaarNo,
        panNo: r.panNo,
        ckycNo: r.ckycNo,
        legacyCustomerNo: r.legacyCustomerNo,
        email: r.email,
        gender: r.gender,
        birthDate: r.birthDate || null,
        customerType: r.customerType,
        kycStatus: r.kycStatus,
        riskCategory: r.riskCategory,
      }))
      .filter((r) => r.firstName || r.lastName || r.mobileNo || r.aadhaarNo || r.panNo || r.ckycNo || r.legacyCustomerNo);

    if (candidateRows.length === 0) {
      setServerErrorsMap({});
      return {};
    }

    try {
      setIsValidatingServer(true);
      const res = await axios.post('/api/CustomerBulk/validate-live', candidateRows);
      const errMap: Record<string, string[]> = {};
      if (res.data?.results) {
        res.data.results.forEach((item: any) => {
          if (!item.isValid && item.errors?.length > 0 && item.clientRowId) {
            errMap[item.clientRowId] = item.errors;
          }
        });
      }
      setServerErrorsMap(errMap);
      return errMap;
    } catch (e) {
      console.error('Server validation error', e);
      return {};
    } finally {
      setIsValidatingServer(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      validateWithServer(rows);
    }, 900);
    return () => clearTimeout(timer);
  }, [rows, validateWithServer]);

  // ROW MANIPULATION ACTIONS
  const handleAddRows = (count: number) => {
    const newRows = Array.from({ length: count }, () => createEmptyRow(undefined, sansthaDefaults));
    setRows((prev) => [...prev, ...newRows]);
  };

  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow(undefined, sansthaDefaults)]);
      setServerErrorsMap({});
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setServerErrorsMap((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedRowIds.size === 0) return;
    if (!window.confirm(`तुम्हाला निवडलेल्या ${selectedRowIds.size} ओळी हटवायच्या आहेत का?`)) return;

    setRows((prev) => {
      const remaining = prev.filter((r) => !selectedRowIds.has(r.id));
      return remaining.length > 0 ? remaining : [createEmptyRow(undefined, sansthaDefaults)];
    });
    setSelectedRowIds(new Set());
  };

  const handleClearAll = () => {
    if (!window.confirm('तुम्हाला सर्व डेटा साफ करायचा आहे का? जतन न केलेला डेटा नष्ट होईल.')) return;
    localStorage.removeItem(STORAGE_DRAFT_KEY);
    setRows(Array.from({ length: 10 }, () => createEmptyRow(undefined, sansthaDefaults)));
    setSelectedRowIds(new Set());
    setServerErrorsMap({});
    setLastDraftSavedTime(null);
  };

  const handleCellChange = (id: string, field: keyof BulkCustomerRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated: BulkCustomerRow = { ...r, [field]: value, isDirty: true };

        if (field === 'panNo' && typeof value === 'string') {
          updated.panNo = value.toUpperCase();
        }

        // Auto-transliterate ONLY if English field is empty or still matches the prior auto-transliteration
        if (field === 'firstName' && typeof value === 'string') {
          if (!r.firstNameEng.trim() || r.firstNameEng === transliterateMarathi(r.firstName)) {
            updated.firstNameEng = transliterateMarathi(value);
          }
        }
        if (field === 'middleName' && typeof value === 'string') {
          if (!r.middleNameEng.trim() || r.middleNameEng === transliterateMarathi(r.middleName)) {
            updated.middleNameEng = transliterateMarathi(value);
          }
        }
        if (field === 'lastName' && typeof value === 'string') {
          if (!r.lastNameEng.trim() || r.lastNameEng === transliterateMarathi(r.lastName)) {
            updated.lastNameEng = transliterateMarathi(value);
          }
        }

        return updated;
      })
    );

    // Clear stale server error immediately upon edit
    setServerErrorsMap((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleAutoFillEnglishNames = () => {
    setRows((prev) =>
      prev.map((r) => {
        if (selectedRowIds.size > 0 && !selectedRowIds.has(r.id)) return r;
        if (!r.firstName && !r.middleName && !r.lastName) return r;

        const newFirstEng = r.firstName ? transliterateMarathi(r.firstName) : r.firstNameEng;
        const newMidEng = r.middleName ? transliterateMarathi(r.middleName) : r.middleNameEng;
        const newLastEng = r.lastName ? transliterateMarathi(r.lastName) : r.lastNameEng;
        const changed = newFirstEng !== r.firstNameEng || newMidEng !== r.middleNameEng || newLastEng !== r.lastNameEng;

        return {
          ...r,
          firstNameEng: newFirstEng,
          middleNameEng: newMidEng,
          lastNameEng: newLastEng,
          isDirty: r.isDirty || changed,
        };
      })
    );

    toast.success(
      `मराठी नावांवरून इंग्रजी स्पेलिंग तयार केले! (${selectedRowIds.size > 0 ? selectedRowIds.size + ' निवडलेल्या' : 'सर्व'} ओळी तपासल्या)`
    );
    if (showQuickFill) setShowQuickFill(false);
  };

  const applyQuickFill = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        village: quickFillVillage || r.village,
        taluka: quickFillTaluka || r.taluka,
        district: quickFillDistrict || r.district,
        isDirty: r.isDirty || Boolean(quickFillVillage || quickFillTaluka || quickFillDistrict),
      }))
    );
    setShowQuickFill(false);
    toast.success('निवडलेली गाव/तालुका/जिल्हा माहिती सर्व ओळींना लागू केली!');
  };

  const applySansthaAddressToAll = () => {
    if (!sansthaDefaults) return;
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        address: sansthaDefaults.address || r.address,
        village: sansthaDefaults.village || r.village,
        taluka: sansthaDefaults.taluka || r.taluka,
        district: sansthaDefaults.district || r.district,
        isDirty: true,
      }))
    );
    setShowQuickFill(false);
    toast.success('सर्व ओळींना संस्थेचा पत्ता यशस्वीरित्या लागू केला!');
  };

  // EXISTING CUSTOMERS LOAD / BULK EDIT HANDLERS
  const fetchExistingCustomers = async () => {
    setIsLoadingExisting(true);
    try {
      const targetBranch = isHoAdmin && existingBranchFilter !== 'all' ? existingBranchFilter : undefined;
      const res = await axios.get('/api/CustomerBulk/existing-customers', {
        params: {
          search: existingSearch,
          onlyIncomplete: existingOnlyIncomplete,
          limit: existingLimit,
          branchId: targetBranch,
        },
      });
      const list = res.data?.customers || [];
      setExistingCustomersList(list);
      setSelectedExistingIds(new Set(list.map((c: any) => c.customerID)));
    } catch (err) {
      console.error('Fetch existing customers failed', err);
      toast.error('विद्यमान खातेदार यादी आणताना त्रुटी आली.');
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const handleLoadExistingIntoGrid = (mode: 'replace' | 'append') => {
    const chosen = existingCustomersList.filter((c) => selectedExistingIds.has(c.customerID));
    if (chosen.length === 0) {
      toast.error('कृपया ग्रिडमध्ये लोड करण्यासाठी किमान एक खातेदार निवडा.');
      return;
    }

    chosen.sort((a, b) => {
      if (a.cifNo && b.cifNo) {
        return a.cifNo.localeCompare(b.cifNo, undefined, { numeric: true });
      }
      return (a.customerID || 0) - (b.customerID || 0);
    });

    const existingIdsInGrid = mode === 'append' ? new Set(rows.map((r) => r.customerID).filter(Boolean)) : new Set<number>();
    const filteredChosen = chosen.filter((c) => !existingIdsInGrid.has(c.customerID));

    if (mode === 'append' && filteredChosen.length === 0) {
      toast('निवडलेले सर्व खातेदार आधीच ग्रिडमध्ये लोड केलेले आहेत.');
      setShowExistingModal(false);
      return;
    }

    // Preserve DB blank birthDate / address faithfully so untouched fields are NEVER overwritten!
    const mappedRows: BulkCustomerRow[] = filteredChosen.map((c) => ({
      id: 'row_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      customerID: c.customerID,
      cifNo: c.cifNo || '',
      isExisting: true,
      isDirty: false,
      firstName: c.firstName || '',
      middleName: c.middleName || '',
      lastName: c.lastName || '',
      firstNameEng: c.firstNameEng || '',
      middleNameEng: c.middleNameEng || '',
      lastNameEng: c.lastNameEng || '',
      mobileNo: c.mobileNo || '',
      aadhaarNo: c.aadhaarNo || '',
      panNo: c.panNo || '',
      gender: c.gender || 'Male',
      birthDate: c.birthDate ? String(c.birthDate).substring(0, 10) : '',
      address: c.address || '',
      village: c.village || '',
      taluka: c.taluka || '',
      district: c.district || '',
      occupation: c.occupation || '',
      customerType: normalizeCustomerType(c.customerType || 'Individual'),
      kycStatus: normalizeKycStatus(c.kycStatus || 'Verified'),
      ckycNo: c.ckycNo || '',
      riskCategory: normalizeRiskCategory(c.riskCategory || 'Low'),
      email: c.email || '',
      nomineeName: c.nomineeName || '',
      nomineeRelation: c.nomineeRelation || '',
      legacyCustomerNo: c.legacyCustomerNo || '',
    }));

    if (mode === 'replace') {
      setRows(mappedRows);
      setCurrentPage(1);
    } else {
      setRows((prev) => {
        const activeRows = prev.filter((r) => r.isExisting || isRowContentPresent(r));
        return [...activeRows, ...mappedRows];
      });
    }

    setShowExistingModal(false);
    toast.success(`${mappedRows.length} विद्यमान खातेदार ग्रिडमध्ये लोड झाले. फक्त बदल केलेल्या नोंदीच अपडेट होतील.`);
  };

  // EXCEL COPY-PASTE SUPPORT (Preserves leading empty tabs & maps to original row index)
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    origStartRowIdx: number,
    startField: keyof BulkCustomerRow
  ) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData || (!pasteData.includes('\t') && !pasteData.includes('\n'))) {
      return;
    }

    e.preventDefault();
    const cleanText = pasteData.replace(/\r\n/g, '\n').replace(/\n+$/, '');
    const lines = cleanText.split(/\r?\n/);
    if (lines.length === 0) return;

    const fieldOrder: (keyof BulkCustomerRow)[] = [
      'legacyCustomerNo',
      'firstName',
      'middleName',
      'lastName',
      'firstNameEng',
      'middleNameEng',
      'lastNameEng',
      'mobileNo',
      'aadhaarNo',
      'panNo',
      'gender',
      'nomineeName',
      'nomineeRelation',
      'occupation',
      'birthDate',
      'village',
      'taluka',
      'district',
      'address',
      'email',
      'customerType',
      'kycStatus',
      'ckycNo',
      'riskCategory',
    ];

    const startFieldIdx = fieldOrder.indexOf(startField);
    if (startFieldIdx === -1) return;

    setRows((prev) => {
      const next = [...prev];
      while (origStartRowIdx + lines.length > next.length) {
        next.push(createEmptyRow(undefined, sansthaDefaults));
      }

      lines.forEach((line, rOffset) => {
        const targetRowIdx = origStartRowIdx + rOffset;
        if (targetRowIdx >= next.length) return;

        const cells = line.split('\t');
        const currentRow = { ...next[targetRowIdx], isDirty: true };

        cells.forEach((cellVal, cOffset) => {
          const targetFieldIdx = startFieldIdx + cOffset;
          if (targetFieldIdx < fieldOrder.length) {
            const fName = fieldOrder[targetFieldIdx];
            let cleanVal = cellVal.trim();
            if (fName === 'panNo') {
              cleanVal = cleanVal.toUpperCase().replace(/[^A-Z0-9]/g, '');
            } else if (fName === 'mobileNo') {
              cleanVal = cleanVal.replace(/\D/g, '');
              if (cleanVal.length === 12 && cleanVal.startsWith('91')) cleanVal = cleanVal.substring(2);
            } else if (fName === 'aadhaarNo' || fName === 'ckycNo') {
              cleanVal = cleanVal.replace(/\D/g, '');
            } else if (fName === 'birthDate') {
              cleanVal = parseExcelDate(cleanVal, currentRow.birthDate);
            } else if (fName === 'customerType') {
              cleanVal = normalizeCustomerType(cleanVal);
            } else if (fName === 'kycStatus') {
              cleanVal = normalizeKycStatus(cleanVal);
            } else if (fName === 'riskCategory') {
              cleanVal = normalizeRiskCategory(cleanVal);
            }
            (currentRow as any)[fName] = cleanVal;
          }
        });

        if (currentRow.firstName && !currentRow.firstNameEng) {
          currentRow.firstNameEng = transliterateMarathi(currentRow.firstName);
        }
        if (currentRow.middleName && !currentRow.middleNameEng) {
          currentRow.middleNameEng = transliterateMarathi(currentRow.middleName);
        }
        if (currentRow.lastName && !currentRow.lastNameEng) {
          currentRow.lastNameEng = transliterateMarathi(currentRow.lastName);
        }

        next[targetRowIdx] = currentRow;
      });

      return next;
    });
  };

  // Download Sample Excel Template
  const handleDownloadSampleTemplate = () => {
    const sampleData = [
      {
        'जुना खातेदार क्र (LegacyCustomerNo)': 'OLD-101',
        'पहिले नाव (FirstName) *': 'रमेश',
        'मधले नाव (MiddleName)': 'आनंदराव',
        'आडनाव (LastName) *': 'पाटील',
        'First Name (Eng)': 'Ramesh',
        'Middle Name (Eng)': 'Anandrao',
        'Last Name (Eng)': 'Patil',
        'मोबाईल क्र (MobileNo)': '9822012345',
        'आधार क्र (AadhaarNo)': '234567890123',
        'पॅन क्र (PANNo)': 'ABCDE1234F',
        'लिंग (Gender)': 'Male',
        'वारसदार (NomineeName)': 'सुनिता पाटील',
        'नाते (NomineeRelation)': 'पत्नी',
        'व्यवसाय (Occupation)': 'शेती',
        'जन्मतारीख (BirthDate YYYY-MM-DD)': '1990-01-01',
        'गाव / शहर (Village)': sansthaDefaults?.village || 'सांगली',
        'तालुका (Taluka)': sansthaDefaults?.taluka || 'मिरज',
        'जिल्हा (District)': sansthaDefaults?.district || 'सांगली',
        'पत्ता (Address)': sansthaDefaults?.address || 'मु. पो. सांगली',
        'ईमेल (Email)': 'ramesh.patil@example.com',
        'खातेदार प्रकार (CustomerType)': 'Individual',
        'केवायसी (KYCStatus)': 'Verified',
        'CKYC क्र (CKYCNo)': '',
        'जोखीम (RiskCategory)': 'Low',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer_Template');
    XLSX.writeFile(wb, 'Customer_Bulk_Sample_Template.xlsx');
  };

  // Direct Excel File Upload Parser (with accurate Date serial & collision-free headers)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          toast.error('निवडलेल्या एक्सेल फाइलमध्ये कोणताही डेटा आढळला नाही.');
          return;
        }

        const importedRows: BulkCustomerRow[] = rawJson.map((row: any) => {
          const strVal = (exact: string[], tokens: string[]) => {
            const v = getExactExcelCell(row, exact, tokens);
            return v !== undefined && v !== null ? String(v).trim() : '';
          };

          const fName = strVal(['पहिले नाव (FirstName) *', 'पहिले नाव (FirstName)', 'पहिले नाव', 'FirstName', 'First_Name'], ['पहिले नाव', 'firstname']);
          const mName = strVal(['मधले नाव (MiddleName)', 'मधले नाव', 'MiddleName', 'Middle_Name'], ['मधले नाव', 'middlename']);
          const lName = strVal(['आडनाव (LastName) *', 'आडनाव (LastName)', 'आडनाव', 'LastName', 'Last_Name'], ['आडनाव', 'lastname']);
          const fNameEng = strVal(['First Name (Eng)', 'FirstNameEng', 'नाव इंग्रजीत (FirstNameEng)'], ['firstnameeng', 'first name (eng)']);
          const mNameEng = strVal(
            ['Middle Name (Eng)', 'MiddleNameEng', 'Father / Middle (Eng)', 'वडिलांचे नाव इंग्रजीत (MiddleNameEng)'],
            ['middlenameeng', 'middle name (eng)', 'fathernameeng']
          );
          const lNameEng = strVal(['Last Name (Eng)', 'LastNameEng', 'आडनाव इंग्रजीत (LastNameEng)'], ['lastnameeng', 'last name (eng)']);

          let mob = strVal(['मोबाईल क्र (MobileNo)', 'मोबाईल (MobileNo)', 'MobileNo', 'मोबाईल'], ['मोबाईल', 'mobileno']);
          mob = mob.replace(/\D/g, '');
          if (mob.length === 12 && mob.startsWith('91')) mob = mob.substring(2);

          let aadh = strVal(['आधार क्र (AadhaarNo)', 'AadhaarNo', 'आधार क्रमांक'], ['आधार', 'aadhaar']);
          aadh = aadh.replace(/\D/g, '');

          let pan = strVal(['पॅन क्र (PANNo)', 'PANNo', 'पॅन नंबर', 'PAN'], ['पॅन', 'panno']);
          pan = pan.toUpperCase().replace(/[^A-Z0-9]/g, '');

          const rawGender = strVal(['लिंग (Gender)', 'Gender', 'लिंग'], ['लिंग', 'gender']);
          let gender = 'Male';
          if (rawGender.toLowerCase().startsWith('f') || rawGender.includes('स्त्री')) gender = 'Female';
          else if (rawGender.toLowerCase().startsWith('o') || rawGender.includes('इतर')) gender = 'Other';

          const rawBirthVal = getExactExcelCell(
            row,
            ['जन्मतारीख (BirthDate YYYY-MM-DD)', 'जन्मतारीख (BirthDate)', 'BirthDate', 'DOB', 'जन्मतारीख'],
            ['जन्मतारीख', 'birthdate', 'dob']
          );
          const bDate = parseExcelDate(rawBirthVal, DEFAULT_BIRTH_DATE);

          const vill = strVal(['गाव / शहर (Village)', 'गाव (Village)', 'Village'], ['गाव', 'village']) || sansthaDefaults?.village || '';
          const tal = strVal(['तालुका (Taluka)', 'Taluka', 'तालुका'], ['तालुका', 'taluka']) || sansthaDefaults?.taluka || '';
          const dist = strVal(['जिल्हा (District)', 'District', 'जिल्हा'], ['जिल्हा', 'district']) || sansthaDefaults?.district || '';
          const addr = strVal(['पत्ता (Address)', 'Address', 'पत्ता'], ['पत्ता', 'address']) || sansthaDefaults?.address || '';
          const occ = strVal(['व्यवसाय (Occupation)', 'Occupation', 'व्यवसाय'], ['व्यवसाय', 'occupation']) || 'शेती';
          const cType = normalizeCustomerType(strVal(['खातेदार प्रकार (CustomerType)', 'CustomerType'], ['खातेदार प्रकार', 'customertype']));
          const kyc = normalizeKycStatus(strVal(['केवायसी (KYCStatus)', 'केवायसी स्थिती (KYCStatus)', 'KYCStatus'], ['केवायसी', 'kycstatus']));
          const ckyc = strVal(['CKYC क्र (CKYCNo)', 'CKYCNo', 'CKYC'], ['ckyc']).replace(/\D/g, '');
          const risk = normalizeRiskCategory(strVal(['जोखीम (RiskCategory)', 'जोखीम वर्ग (RiskCategory)', 'RiskCategory'], ['जोखीम', 'riskcategory']));
          const email = strVal(['ईमेल (Email)', 'Email', 'ईमेल'], ['ईमेल', 'email']);
          const nomName = strVal(['वारसदार (NomineeName)', 'वारसदार नाव (NomineeName)', 'NomineeName', 'वारसदार नाव'], ['वारसदार', 'nomineename']);
          const nomRel = strVal(['नाते (NomineeRelation)', 'वारसदार नाते (NomineeRelation)', 'NomineeRelation'], ['nomineerelation', 'नाते']);
          const legNo = strVal(['जुना खातेदार क्र (LegacyCustomerNo)', 'LegacyCustomerNo', 'जुना खातेदार क्र'], ['जुना खातेदार', 'legacy']);

          return createEmptyRow(
            {
              isDirty: true,
              firstName: fName,
              middleName: mName,
              lastName: lName,
              firstNameEng: fNameEng || (fName ? transliterateMarathi(fName) : ''),
              middleNameEng: mNameEng || (mName ? transliterateMarathi(mName) : ''),
              lastNameEng: lNameEng || (lName ? transliterateMarathi(lName) : ''),
              mobileNo: mob,
              aadhaarNo: aadh,
              panNo: pan,
              gender,
              birthDate: bDate,
              village: vill,
              taluka: tal,
              district: dist,
              address: addr,
              occupation: occ,
              customerType: cType,
              kycStatus: kyc,
              ckycNo: ckyc,
              riskCategory: risk,
              email,
              nomineeName: nomName,
              nomineeRelation: nomRel,
              legacyCustomerNo: legNo,
            },
            sansthaDefaults
          );
        });

        const hasData = rows.some((r) => isRowContentPresent(r) || r.isExisting);
        if (hasData) {
          const append = window.confirm(
            `एक्सेल फाइलमधून ${importedRows.length} खातेदार सापडले.\n\n[OK] = सध्याच्या ग्रिडमध्ये जोडा (Append)\n[Cancel] = सध्याचा ग्रिड साफ करून हेच खातेदार ठेवा (Replace)`
          );
          if (append) {
            setRows((prev) => [...prev, ...importedRows]);
          } else {
            setRows(importedRows);
            setCurrentPage(1);
          }
        } else {
          setRows(importedRows);
          setCurrentPage(1);
        }

        toast.success(`एक्सेल फाइलमधून ${importedRows.length} खातेदार यशस्वीरित्या आयात केले!`);
      } catch (err) {
        console.error('Excel parse error', err);
        toast.error('एक्सेल फाइल वाचताना त्रुटी आली. कृपया फाइल फॉरमॅट तपासा.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Filtered rows view + Pagination
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const v = validations.get(r.id);
      if (filterMode === 'valid' && !v?.isValid) return false;
      if (filterMode === 'invalid' && v?.isValid) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${r.firstName} ${r.middleName} ${r.lastName}`.toLowerCase();
        const contact = `${r.mobileNo} ${r.aadhaarNo} ${r.panNo} ${r.legacyCustomerNo} ${r.cifNo || ''} ${r.email}`.toLowerCase();
        if (!fullName.includes(q) && !contact.includes(q)) return false;
      }
      return true;
    });
  }, [rows, validations, filterMode, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  // Enter navigates visually across visible paginated rows
  const handleKeyDownNavigate = (e: React.KeyboardEvent<HTMLInputElement>, visibleIdx: number, fieldName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.querySelector(
        `input[data-visible-idx="${visibleIdx + 1}"][data-field="${fieldName}"]`
      ) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  const handleDownloadErrorExcel = () => {
    const errorRowsData: any[] = [];
    rows.forEach((r, idx) => {
      const v = validations.get(r.id);
      if (v && !v.isValid) {
        errorRowsData.push({
          'अनुक्रमांक (Row)': idx + 1,
          'नोंदणी प्रकार': r.customerID && r.customerID > 0 ? `संपादित (CIF: ${r.cifNo || ''})` : `नवीन (CIF: ${newRowCifMap.get(r.id) || ''})`,
          'त्रुटीचे कारण (Error Reason)': v.errors.join(' | '),
          'जुना खातेदार क्र (LegacyCustomerNo)': r.legacyCustomerNo,
          'पहिले नाव (FirstName)': r.firstName,
          'मधले नाव (MiddleName)': r.middleName,
          'आडनाव (LastName)': r.lastName,
          'First Name (Eng)': r.firstNameEng,
          'Middle Name (Eng)': r.middleNameEng,
          'Last Name (Eng)': r.lastNameEng,
          'मोबाईल (MobileNo)': r.mobileNo,
          'आधार क्र (AadhaarNo)': r.aadhaarNo ? `'${r.aadhaarNo}` : '',
          'पॅन क्र (PANNo)': r.panNo,
          'लिंग (Gender)': r.gender,
          'वारसदार नाव (NomineeName)': r.nomineeName,
          'वारसदार नाते (NomineeRelation)': r.nomineeRelation,
          'व्यवसाय (Occupation)': r.occupation,
          'जन्मतारीख (BirthDate)': r.birthDate,
          'गाव (Village)': r.village,
          'तालुका (Taluka)': r.taluka,
          'जिल्हा (District)': r.district,
          'पत्ता (Address)': r.address,
          'ईमेल (Email)': r.email,
          'खातेदार प्रकार (CustomerType)': r.customerType,
          'केवायसी स्थिती (KYCStatus)': r.kycStatus,
          'CKYC क्र (CKYCNo)': r.ckycNo ? `'${r.ckycNo}` : '',
          'जोखीम वर्ग (RiskCategory)': r.riskCategory,
        });
      }
    });

    if (errorRowsData.length === 0) {
      toast('सध्या कोणतीही त्रुटी असलेली ओळ नाही.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(errorRowsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invalid_Customers');
    XLSX.writeFile(wb, `Customer_Bulk_Errors_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  // ATOMIC BULK SAVE (Inserts valid new customers & Updates ONLY changed existing customers)
  const handleBulkSave = async (saveValidOnly = true) => {
    if (saveableValidCount === 0) {
      if (validRows > 0) {
        toast('विद्यमान खातेदारांच्या माहितीत कोणताही बदल केलेला नाही.');
      } else {
        toast.error('जतन करण्यासाठी एकही वैध खातेदार सापडला नाही. कृपया आवश्यक फील्ड्स (पहिले नाव, आडनाव) भरा.');
      }
      return;
    }

    if (!saveValidOnly && invalidRows > 0) {
      toast.error(`ग्रिडमध्ये ${invalidRows} ओळींमध्ये त्रुटी आहेत. कृपया त्रुटी दुरुस्त करा.`);
      return;
    }

    // Force immediate live validation before save so stale errors aren't missed during debounce
    const latestServerErrs = await validateWithServer(rows);

    const candidateList = rows
      .map((r, i) => ({ row: r, origIdx: i + 1 }))
      .filter(({ row }) => {
        const v = validations.get(row.id);
        const hasFreshErr = Boolean(latestServerErrs[row.id]?.length);
        if (!v?.isValid || hasFreshErr) return false;
        const isExisting = Boolean(row.customerID && row.customerID > 0);
        return !isExisting || Boolean(row.isDirty);
      });

    if (candidateList.length === 0) {
      toast.error('सर्व्हर पडताळणीनंतर जतन करण्यासाठी एकही वैध नोंद उरलेली नाही. कृपया लाल त्रुटी तपासा.');
      return;
    }

    const newCount = candidateList.filter(({ row }) => !row.customerID || row.customerID === 0).length;
    const editCount = candidateList.filter(({ row }) => row.customerID && row.customerID > 0).length;

    const confirmMsg = `एकूण ${candidateList.length} वैध नोंदी सेव्ह करायच्या आहेत का?\n(नवीन खातेदार: ${newCount}, बदललेले विद्यमान खातेदार: ${editCount})`;
    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    setSaveProgress('डेटाबेस ट्रान्झॅक्शन सुरू करत आहे व सलग CIF वाटप / अपडेट करत आहे...');

    try {
      const payloadRows = candidateList.map(({ row, origIdx }) => ({
        rowIndex: origIdx,
        clientRowId: row.id,
        customerID: row.customerID || 0,
        cifNo: row.cifNo || '',
        firstName: row.firstName,
        middleName: row.middleName,
        lastName: row.lastName,
        firstNameEng: row.firstNameEng,
        middleNameEng: row.middleNameEng,
        lastNameEng: row.lastNameEng,
        mobileNo: row.mobileNo,
        aadhaarNo: row.aadhaarNo,
        panNo: row.panNo,
        gender: row.gender,
        birthDate: row.birthDate ? row.birthDate : null,
        address: row.address,
        village: row.village,
        taluka: row.taluka,
        district: row.district,
        occupation: row.occupation,
        customerType: row.customerType,
        kycStatus: row.kycStatus,
        ckycNo: row.ckycNo,
        riskCategory: row.riskCategory,
        email: row.email,
        nomineeName: row.nomineeName,
        nomineeRelation: row.nomineeRelation,
        legacyCustomerNo: row.legacyCustomerNo,
      }));

      const savedIds = new Set(payloadRows.map((p) => p.clientRowId));

      const res = await axios.post('/api/CustomerBulk/save', {
        batchName: `DirectGrid_${new Date().toISOString().substring(0, 10)}`,
        branchID: selectedBranchId ? Number(selectedBranchId) : undefined,
        saveValidOnly: true,
        customers: payloadRows,
      });

      if (res.data?.success) {
        localStorage.removeItem(STORAGE_DRAFT_KEY);
        toast.success(res.data.message || 'सर्व बदल यशस्वीरित्या जतन झाले!');

        setRows((prev) => {
          const remaining = prev.filter((r) => !savedIds.has(r.id) && (isRowContentPresent(r) || r.isExisting));
          if (remaining.length > 0) {
            return remaining.map((r) => (savedIds.has(r.id) ? { ...r, isDirty: false } : r));
          }
          return Array.from({ length: 10 }, () => createEmptyRow(undefined, sansthaDefaults));
        });

        // Refresh metadata so nextCifPreview reflects newly allocated CIFs!
        loadMetadata(false);

        setSaveResultModal({
          isOpen: true,
          success: true,
          batchNumber: res.data.batchNumber,
          importedCount: res.data.insertedCount ?? res.data.importedCount ?? 0,
          updatedCount: res.data.updatedCount || 0,
          skippedCount: res.data.skippedCount || 0,
          startCif: res.data.startCif || '-',
          endCif: res.data.endCif || '-',
          message: res.data.message || 'सर्व खातेदार यशस्वीरित्या जतन झाले.',
        });
      }
    } catch (err: any) {
      console.error(err);
      const data = err.response?.data;
      if (Array.isArray(data?.validationErrors)) {
        const errMap: Record<string, string[]> = {};
        data.validationErrors.forEach((v: any) => {
          if (v.clientRowId && v.errors?.length) {
            errMap[v.clientRowId] = v.errors;
          }
        });
        setServerErrorsMap((prev) => ({ ...prev, ...errMap }));
      }
      const errMsg = data?.message || err.message || 'खातेदार जतन करताना त्रुटी आली.';
      toast.error('त्रुटी: ' + errMsg);
    } finally {
      setIsSaving(false);
      setSaveProgress('');
    }
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(filteredRows.map((r) => r.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-3 bg-slate-50 min-h-screen font-sans">
      {/* Top Header Bar */}
      <div className="bg-white border border-slate-200 rounded-sm p-3 mb-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-sm transition cursor-pointer"
              title="मागे जा"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded-sm border border-primary/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h1 className="text-base font-black text-slate-900 tracking-tight">
                खातेदार बल्क नोंदणी व संपादन (Customer Bulk Entry &amp; Edit Grid)
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Excel Spreadsheet Mode
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              एकाच स्क्रीनवर नवीन खातेदारांची नोंद करा किंवा विद्यमान खातेदार लोड करून बल्क एडिट करा (फक्त बदललेल्या ओळी अपडेट होतात).
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center flex-wrap gap-2">
          {isHoAdmin && branches.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 py-1 text-xs">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none"
                title="नवीन नोंदणीसाठी लक्ष्य शाखा"
              >
                {branches.map((b) => (
                  <option key={b.branchID} value={String(b.branchID)}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {lastDraftSavedTime && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded-sm border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                ड्राफ्ट जतन: <strong className="text-slate-800">{lastDraftSavedTime}</strong>
              </span>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-sm border border-emerald-300 flex items-center gap-1.5 cursor-pointer transition"
            title="एक्सेल फाइल (.xlsx / .csv) निवडून थेट ग्रिडमध्ये डेटा आयात करा"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-700" />
            <span>एक्सेल फाइल अपलोड</span>
          </button>

          <button
            onClick={handleDownloadSampleTemplate}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-sm border border-slate-300 flex items-center gap-1.5 cursor-pointer transition"
            title="खातेदारांच्या डेटा एन्ट्रीसाठी नमुना एक्सेल टेम्प्लेट डाऊनलोड करा"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>नमुना टेम्प्लेट</span>
          </button>

          <button
            onClick={() => {
              setShowExistingModal(true);
              if (existingCustomersList.length === 0) {
                fetchExistingCustomers();
              }
            }}
            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold rounded-sm border border-sky-300 flex items-center gap-1.5 cursor-pointer transition"
            title="डेटाबेसमधील आधी भरलेले खातेदार ग्रिडमध्ये आणून बल्क एडिट करा"
          >
            <FolderDown className="w-3.5 h-3.5 text-sky-700" />
            <span>विद्यमान खातेदार लोड करा</span>
          </button>

          {/* Quick-Fill Popover Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowQuickFill(!showQuickFill)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-sm border border-slate-300 flex items-center gap-1 cursor-pointer transition"
              title="सर्व ओळींमध्ये समान गाव/पत्ता भरणे"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>स्मार्ट ऑटो-फिल</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showQuickFill && (
              <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-300 rounded-sm shadow-lg p-3 z-50">
                <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>सर्व ओळींना समान माहिती लावा:</span>
                  <button onClick={() => setShowQuickFill(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {sansthaDefaults && (
                  <div className="p-2 bg-emerald-50 rounded-sm border border-emerald-200 mb-2.5">
                    <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 mb-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>संस्थेचा पत्ता (Sanstha Master):</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mb-1.5 font-medium leading-tight">
                      {sansthaDefaults.village}, {sansthaDefaults.taluka}, {sansthaDefaults.district} - {sansthaDefaults.address}
                    </div>
                    <button
                      type="button"
                      onClick={applySansthaAddressToAll}
                      className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-sm cursor-pointer transition"
                    >
                      सर्व ओळींना संस्थेचा पत्ता लावा
                    </button>
                  </div>
                )}

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">गाव / शहर</label>
                    <input
                      type="text"
                      maxLength={100}
                      value={quickFillVillage}
                      onChange={(e) => setQuickFillVillage(e.target.value)}
                      placeholder="उदा. मुंबई / सांगली"
                      className="w-full px-2 py-1 border border-slate-300 rounded-sm text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">तालुका</label>
                    <input
                      type="text"
                      maxLength={100}
                      value={quickFillTaluka}
                      onChange={(e) => setQuickFillTaluka(e.target.value)}
                      placeholder="उदा. कडेगाव"
                      className="w-full px-2 py-1 border border-slate-300 rounded-sm text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">जिल्हा</label>
                    <input
                      type="text"
                      maxLength={100}
                      value={quickFillDistrict}
                      onChange={(e) => setQuickFillDistrict(e.target.value)}
                      placeholder="उदा. सांगली"
                      className="w-full px-2 py-1 border border-slate-300 rounded-sm text-xs"
                    />
                  </div>
                  <button
                    onClick={applyQuickFill}
                    className="w-full mt-2 py-1 bg-primary text-white text-xs font-bold rounded-sm hover:opacity-90 cursor-pointer"
                  >
                    कस्टम लागू करा (Apply Custom)
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 mt-2">
                  <button
                    type="button"
                    onClick={handleAutoFillEnglishNames}
                    className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-sm flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span>मराठीवरून इंग्रजी नावे भरा</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {invalidRows > 0 && (
            <button
              onClick={handleDownloadErrorExcel}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-sm border border-rose-200 flex items-center gap-1.5 cursor-pointer transition"
              title="केवळ त्रुटी असलेल्या ओळी एक्सेलमध्ये डाऊनलोड करा"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>त्रुटींची Excel ({invalidRows})</span>
            </button>
          )}

          <button
            onClick={handleClearAll}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-sm border border-slate-300 flex items-center gap-1 cursor-pointer transition"
            title="सर्व नोंदी साफ करा"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>साफ करा</span>
          </button>

          <button
            onClick={() => handleBulkSave(true)}
            disabled={isSaving || saveableValidCount === 0}
            className={`px-4 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer ${
              saveableValidCount > 0 && !isSaving
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
            title="नवीन व बदललेल्या वैध नोंदी जतन करा"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>जतन होत आहे...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>एकत्रित जतन करा ({saveableValidCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Summary & Filter Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 mb-3">
        <div
          onClick={() => setFilterMode('all')}
          className={`p-2.5 rounded-sm border cursor-pointer transition flex items-center justify-between ${
            filterMode === 'all' ? 'bg-white border-primary ring-1 ring-primary shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-sm">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">एकूण ओळी (Total)</div>
              <div className="text-base font-black text-slate-900">{totalRows}</div>
            </div>
          </div>
          {filterMode === 'all' && <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-sm">सक्रिय</span>}
        </div>

        <div
          onClick={() => setFilterMode('valid')}
          className={`p-2.5 rounded-sm border cursor-pointer transition flex items-center justify-between ${
            filterMode === 'valid' ? 'bg-emerald-50/50 border-emerald-500 ring-1 ring-emerald-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-sm">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">वैध नोंदी (Valid)</div>
              <div className="text-base font-black text-emerald-800">{validRows}</div>
            </div>
          </div>
          {filterMode === 'valid' && <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded-sm">सक्रिय</span>}
        </div>

        <div
          onClick={() => setFilterMode('invalid')}
          className={`p-2.5 rounded-sm border cursor-pointer transition flex items-center justify-between ${
            filterMode === 'invalid' ? 'bg-rose-50/50 border-rose-500 ring-1 ring-rose-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">त्रुटी असलेल्या (Errors)</div>
              <div className="text-base font-black text-rose-800">{invalidRows}</div>
            </div>
          </div>
          {filterMode === 'invalid' && <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded-sm">सक्रिय</span>}
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">पुढील CIF क्रमांक</div>
              <div className="text-base font-black text-indigo-900">{nextCifPreview}</div>
            </div>
          </div>
          {isValidatingServer && (
            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> तपासणी चालू
            </span>
          )}
        </div>
      </div>

      {/* Action Toolbar (+Rows, Delete, Search) */}
      <div className="bg-white border border-slate-200 rounded-sm p-2 mb-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-xs font-bold text-slate-600 mr-1">ओळी जोडा (Add):</span>
          <button
            onClick={() => handleAddRows(1)}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-sm border border-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> +१
          </button>
          <button
            onClick={() => handleAddRows(5)}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-sm border border-slate-300 cursor-pointer"
          >
            +५
          </button>
          <button
            onClick={() => handleAddRows(10)}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-sm border border-primary/30 cursor-pointer"
          >
            +१० ओळी
          </button>
          <button
            onClick={() => handleAddRows(50)}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-sm border border-primary/30 cursor-pointer"
          >
            +५० ओळी
          </button>
          <button
            onClick={() => handleAddRows(100)}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-sm shadow-xs cursor-pointer"
          >
            ⚡ +१०० ओळी
          </button>

          <button
            onClick={handleAutoFillEnglishNames}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-sm shadow-xs flex items-center gap-1 cursor-pointer transition ml-1"
            title="मराठी नावांवरून इंग्रजी स्पेलिंग स्वयंचलित तयार करा"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-100" />
            <span>⚡ इंग्रजी स्पेलिंग भरा</span>
          </button>

          {selectedRowIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-sm ml-2 flex items-center gap-1 cursor-pointer transition shadow-xs"
            >
              <Trash2 className="w-3 h-3" />
              <span>निवडलेल्या ओळी हटवा ({selectedRowIds.size})</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="नावाने / मोबाईलने / CIF ने शोधा..."
              className="pl-8 pr-6 py-1 text-xs border border-slate-300 rounded-sm w-56 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            दाखवत आहे: <strong>{filteredRows.length}</strong> / {rows.length}
          </div>
        </div>
      </div>

      {/* EXCEL-STYLE SPREADSHEET GRID TABLE */}
      <div className="bg-white border border-slate-300 rounded-sm shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-20 shadow-2xs select-none">
              <tr>
                <th className="p-1.5 w-10 text-center border-r border-slate-300">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && selectedRowIds.size === filteredRows.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded-sm border-slate-300 text-primary cursor-pointer"
                  />
                </th>
                <th className="p-1.5 w-12 text-center border-r border-slate-300">#</th>
                <th className="p-1.5 min-w-[95px] text-center border-r border-slate-300">प्रकार / CIF</th>
                <th className="p-1.5 min-w-[70px] text-center border-r border-slate-300">स्थिती</th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300 text-indigo-900 font-bold bg-indigo-50/40">
                  जुना खातेदार क्र.
                </th>
                <th className="p-1.5 min-w-[120px] border-r border-slate-300 text-slate-900">
                  पहिले नाव <span className="text-rose-600 font-black">*</span>
                </th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">मधले नाव</th>
                <th className="p-1.5 min-w-[120px] border-r border-slate-300 text-slate-900">
                  आडनाव <span className="text-rose-600 font-black">*</span>
                </th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">First Name (Eng)</th>
                <th className="p-1.5 min-w-[125px] border-r border-slate-300">Father / Middle (Eng)</th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">Last Name (Eng)</th>
                <th className="p-1.5 min-w-[115px] border-r border-slate-300">मोबाईल क्र. (10 अंक)</th>
                <th className="p-1.5 min-w-[125px] border-r border-slate-300">आधार क्र. (12 अंक)</th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">पॅन क्र. (PAN)</th>
                <th className="p-1.5 min-w-[85px] border-r border-slate-300">लिंग</th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">वारसदार नाव</th>
                <th className="p-1.5 min-w-[90px] border-r border-slate-300">नाते</th>
                <th className="p-1.5 min-w-[100px] border-r border-slate-300">व्यवसाय</th>
                <th className="p-1.5 min-w-[115px] border-r border-slate-300">जन्मतारीख</th>
                <th className="p-1.5 min-w-[120px] border-r border-slate-300">गाव / शहर</th>
                <th className="p-1.5 min-w-[100px] border-r border-slate-300">तालुका</th>
                <th className="p-1.5 min-w-[100px] border-r border-slate-300">जिल्हा</th>
                <th className="p-1.5 min-w-[140px] border-r border-slate-300">पत्ता</th>
                <th className="p-1.5 min-w-[140px] border-r border-slate-300">ईमेल (Email)</th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">खातेदार प्रकार</th>
                <th className="p-1.5 min-w-[100px] border-r border-slate-300">केवायसी</th>
                <th className="p-1.5 min-w-[125px] border-r border-slate-300">CKYC क्र.</th>
                <th className="p-1.5 min-w-[80px] border-r border-slate-300">जोखीम</th>
                <th className="p-1.5 w-12 text-center">कृती</th>
              </tr>
            </thead>

            <tbody>
              {paginatedRows.map((row, visibleIdx) => {
                const origIdx = rowIndexMap.get(row.id) ?? 0;
                const validation = validations.get(row.id) || { isValid: true, errors: [], warnings: [] };
                const isInvalid = !validation.isValid;
                const isSelected = selectedRowIds.has(row.id);
                const isExisting = Boolean(row.customerID && row.customerID > 0);

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-200 transition-colors ${
                      isInvalid
                        ? 'bg-rose-50/60 hover:bg-rose-50'
                        : isExisting && row.isDirty
                        ? 'bg-amber-50/50 hover:bg-amber-50'
                        : isSelected
                        ? 'bg-indigo-50/50'
                        : 'bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="p-1 text-center border-r border-slate-200">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(row.id)}
                        className="rounded-sm border-slate-300 text-primary cursor-pointer"
                      />
                    </td>

                    <td className="p-1 text-center border-r border-slate-200 text-slate-500 font-mono text-[10px]">
                      {origIdx + 1}
                    </td>

                    <td className="p-1 text-center border-r border-slate-200 bg-slate-50/60">
                      {isExisting ? (
                        <div className="flex flex-col items-center">
                          <span
                            className={`font-black text-[9px] px-1 py-0.5 rounded-sm border ${
                              row.isDirty
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-sky-100 text-sky-800 border-sky-300'
                            }`}
                            title={`CustomerID: ${row.customerID}`}
                          >
                            {row.isDirty ? 'बदललेले' : 'संपादित'}
                          </span>
                          <span className="text-[9px] font-mono text-slate-600 font-bold mt-0.5">
                            {row.cifNo || `ID:${row.customerID}`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="bg-emerald-50 text-emerald-700 font-bold text-[9px] px-1.5 py-0.5 rounded-sm border border-emerald-200">
                            नवीन
                          </span>
                          <span className="text-[9px] font-mono text-emerald-700 font-bold mt-0.5">
                            {newRowCifMap.get(row.id) || nextCifPreview}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="p-1 text-center border-r border-slate-200">
                      {isInvalid ? (
                        <div className="group relative inline-block cursor-help">
                          <span className="bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded-sm shadow-2xs">
                            त्रुटी
                          </span>
                          <div className="hidden group-hover:block absolute left-8 top-0 z-50 w-64 p-2 bg-slate-900 text-white text-[10px] rounded-sm shadow-lg text-left">
                            <div className="font-bold text-rose-300 mb-1">दुरुस्ती आवश्यक:</div>
                            <ul className="list-disc pl-3 space-y-0.5">
                              {validation.errors.map((err, eIdx) => (
                                <li key={eIdx}>{err}</li>
                              ))}
                            </ul>
                            {validation.warnings.length > 0 && (
                              <>
                                <div className="font-bold text-amber-300 mt-1.5 mb-0.5">सूचना (Warnings):</div>
                                <ul className="list-disc pl-3 space-y-0.5 text-amber-200">
                                  {validation.warnings.map((warn, wIdx) => (
                                    <li key={wIdx}>{warn}</li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        </div>
                      ) : validation.warnings.length > 0 ? (
                        <div className="group relative inline-block cursor-help">
                          <span className="bg-amber-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-sm shadow-2xs">
                            सूचना
                          </span>
                          <div className="hidden group-hover:block absolute left-8 top-0 z-50 w-64 p-2 bg-slate-900 text-white text-[10px] rounded-sm shadow-lg text-left">
                            <div className="font-bold text-amber-300 mb-1">सूचना (Warnings):</div>
                            <ul className="list-disc pl-3 space-y-0.5 text-amber-200">
                              {validation.warnings.map((warn, wIdx) => (
                                <li key={wIdx}>{warn}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 font-bold text-[9px] px-1.5 py-0.5 rounded-sm">
                          वैध
                        </span>
                      )}
                    </td>

                    <td className="p-0.5 border-r border-slate-200 bg-indigo-50/20">
                      <input
                        type="text"
                        maxLength={50}
                        data-visible-idx={visibleIdx}
                        data-field="legacyCustomerNo"
                        value={row.legacyCustomerNo}
                        onChange={(e) => handleCellChange(row.id, 'legacyCustomerNo', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'legacyCustomerNo')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'legacyCustomerNo')}
                        placeholder="जुना क्र."
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-indigo-500 font-medium"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={50}
                        data-visible-idx={visibleIdx}
                        data-field="firstName"
                        value={row.firstName}
                        onChange={(e) => handleCellChange(row.id, 'firstName', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'firstName')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'firstName')}
                        placeholder="पहिले नाव"
                        className={`w-full px-1.5 py-1 text-xs border rounded-xs focus:outline-none focus:ring-1 ${
                          !row.firstName.trim() ? 'border-rose-400 bg-rose-50/40 text-slate-900' : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={50}
                        data-visible-idx={visibleIdx}
                        data-field="middleName"
                        value={row.middleName}
                        onChange={(e) => handleCellChange(row.id, 'middleName', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'middleName')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'middleName')}
                        placeholder="मधले नाव"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={50}
                        data-visible-idx={visibleIdx}
                        data-field="lastName"
                        value={row.lastName}
                        onChange={(e) => handleCellChange(row.id, 'lastName', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'lastName')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'lastName')}
                        placeholder="आडनाव"
                        className={`w-full px-1.5 py-1 text-xs border rounded-xs focus:outline-none focus:ring-1 ${
                          !row.lastName.trim() ? 'border-rose-400 bg-rose-50/40 text-slate-900' : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={50}
                        data-visible-idx={visibleIdx}
                        data-field="firstNameEng"
                        value={row.firstNameEng}
                        onChange={(e) => handleCellChange(row.id, 'firstNameEng', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'firstNameEng')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'firstNameEng')}
                        placeholder="First Name"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={50}
                        data-visible-idx={visibleIdx}
                        data-field="middleNameEng"
                        value={row.middleNameEng}
                        onChange={(e) => handleCellChange(row.id, 'middleNameEng', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'middleNameEng')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'middleNameEng')}
                        placeholder="Middle / Father"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={50}
                        data-visible-idx={visibleIdx}
                        data-field="lastNameEng"
                        value={row.lastNameEng}
                        onChange={(e) => handleCellChange(row.id, 'lastNameEng', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'lastNameEng')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'lastNameEng')}
                        placeholder="Last Name"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={10}
                        data-visible-idx={visibleIdx}
                        data-field="mobileNo"
                        value={row.mobileNo}
                        onChange={(e) => handleCellChange(row.id, 'mobileNo', e.target.value.replace(/\D/g, ''))}
                        onPaste={(e) => handlePaste(e, origIdx, 'mobileNo')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'mobileNo')}
                        placeholder="98XXXXXXXX"
                        className={`w-full px-1.5 py-1 text-xs font-mono border rounded-xs focus:outline-none ${
                          row.mobileNo && (!MOBILE_REGEX.test(row.mobileNo) || validation.errors.some((x) => x.includes('मोबाईल')))
                            ? 'border-rose-500 bg-rose-50 text-rose-900'
                            : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={12}
                        data-visible-idx={visibleIdx}
                        data-field="aadhaarNo"
                        value={row.aadhaarNo}
                        onChange={(e) => handleCellChange(row.id, 'aadhaarNo', e.target.value.replace(/\D/g, ''))}
                        onPaste={(e) => handlePaste(e, origIdx, 'aadhaarNo')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'aadhaarNo')}
                        placeholder="12 अंकी आधार"
                        className={`w-full px-1.5 py-1 text-xs font-mono border rounded-xs focus:outline-none ${
                          row.aadhaarNo && (!isValidAadhaar(row.aadhaarNo).isValid || validation.errors.some((x) => x.includes('आधार')))
                            ? 'border-rose-500 bg-rose-50 text-rose-900'
                            : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={10}
                        data-visible-idx={visibleIdx}
                        data-field="panNo"
                        value={row.panNo}
                        onChange={(e) => handleCellChange(row.id, 'panNo', e.target.value.toUpperCase())}
                        onPaste={(e) => handlePaste(e, origIdx, 'panNo')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'panNo')}
                        placeholder="ABCDE1234F"
                        className={`w-full px-1.5 py-1 text-xs font-mono border rounded-xs focus:outline-none uppercase ${
                          row.panNo && (!PAN_REGEX.test(row.panNo) || validation.errors.some((x) => x.includes('पॅन')))
                            ? 'border-rose-500 bg-rose-50 text-rose-900'
                            : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <select
                        value={row.gender}
                        onChange={(e) => handleCellChange(row.id, 'gender', e.target.value)}
                        className="w-full px-1 py-1 text-xs border border-slate-300 rounded-xs bg-white focus:outline-none"
                      >
                        <option value="Male">पुरुष</option>
                        <option value="Female">स्त्री</option>
                        <option value="Other">इतर</option>
                      </select>
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={150}
                        data-visible-idx={visibleIdx}
                        data-field="nomineeName"
                        value={row.nomineeName}
                        onChange={(e) => handleCellChange(row.id, 'nomineeName', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'nomineeName')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'nomineeName')}
                        placeholder="वारसदार नाव"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={50}
                        data-visible-idx={visibleIdx}
                        data-field="nomineeRelation"
                        value={row.nomineeRelation}
                        onChange={(e) => handleCellChange(row.id, 'nomineeRelation', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'nomineeRelation')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'nomineeRelation')}
                        placeholder="नाते"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={100}
                        data-visible-idx={visibleIdx}
                        data-field="occupation"
                        value={row.occupation}
                        onChange={(e) => handleCellChange(row.id, 'occupation', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'occupation')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'occupation')}
                        placeholder="व्यवसाय"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                        value={row.birthDate}
                        onChange={(e) => handleCellChange(row.id, 'birthDate', e.target.value)}
                        className={`w-full px-1 py-0.5 text-xs border rounded-xs focus:outline-none ${
                          validation.errors.some((x) => x.includes('जन्मतारीख')) ? 'border-rose-500 bg-rose-50' : 'border-slate-300'
                        }`}
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={100}
                        data-visible-idx={visibleIdx}
                        data-field="village"
                        value={row.village}
                        onChange={(e) => handleCellChange(row.id, 'village', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'village')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'village')}
                        placeholder="गाव/शहर"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={100}
                        data-visible-idx={visibleIdx}
                        data-field="taluka"
                        value={row.taluka}
                        onChange={(e) => handleCellChange(row.id, 'taluka', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'taluka')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'taluka')}
                        placeholder="तालुका"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={100}
                        data-visible-idx={visibleIdx}
                        data-field="district"
                        value={row.district}
                        onChange={(e) => handleCellChange(row.id, 'district', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'district')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'district')}
                        placeholder="जिल्हा"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={500}
                        data-visible-idx={visibleIdx}
                        data-field="address"
                        value={row.address}
                        onChange={(e) => handleCellChange(row.id, 'address', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'address')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'address')}
                        placeholder="पत्ता"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="email"
                        maxLength={150}
                        data-visible-idx={visibleIdx}
                        data-field="email"
                        value={row.email}
                        onChange={(e) => handleCellChange(row.id, 'email', e.target.value)}
                        onPaste={(e) => handlePaste(e, origIdx, 'email')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'email')}
                        placeholder="email@example.com"
                        className={`w-full px-1.5 py-1 text-xs border rounded-xs focus:outline-none ${
                          row.email && !EMAIL_REGEX.test(row.email.trim())
                            ? 'border-rose-500 bg-rose-50 text-rose-900'
                            : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <select
                        value={row.customerType}
                        onChange={(e) => handleCellChange(row.id, 'customerType', e.target.value)}
                        className="w-full px-1 py-1 text-xs border border-slate-300 rounded-xs bg-white focus:outline-none"
                      >
                        <option value="Individual">व्यक्ती (Individual)</option>
                        <option value="Proprietorship">एकल व्यापारी</option>
                        <option value="Partnership">भागीदारी संस्था</option>
                        <option value="PvtLtd">Pvt Ltd कंपनी</option>
                        <option value="PublicLtd">Public Ltd कंपनी</option>
                        <option value="Society">सहकारी संस्था</option>
                        <option value="Trust">विश्वस्त संस्था</option>
                        <option value="SHG">बचत गट</option>
                        <option value="HUF">HUF</option>
                      </select>
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <select
                        value={row.kycStatus}
                        onChange={(e) => handleCellChange(row.id, 'kycStatus', e.target.value)}
                        className="w-full px-1 py-1 text-xs border border-slate-300 rounded-xs bg-white focus:outline-none"
                      >
                        <option value="Verified">Verified</option>
                        <option value="Pending">Pending</option>
                        <option value="ReKYCDue">ReKYCDue</option>
                        <option value="Simplified">Simplified</option>
                        <option value="Exempted">Exempted</option>
                      </select>
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={14}
                        data-visible-idx={visibleIdx}
                        data-field="ckycNo"
                        value={row.ckycNo}
                        onChange={(e) => handleCellChange(row.id, 'ckycNo', e.target.value.replace(/\D/g, ''))}
                        onPaste={(e) => handlePaste(e, origIdx, 'ckycNo')}
                        onKeyDown={(e) => handleKeyDownNavigate(e, visibleIdx, 'ckycNo')}
                        placeholder="14 अंकी CKYC"
                        className={`w-full px-1.5 py-1 text-xs font-mono border rounded-xs focus:outline-none ${
                          row.ckycNo && (!CKYC_REGEX.test(row.ckycNo) || validation.errors.some((x) => x.includes('CKYC')))
                            ? 'border-rose-500 bg-rose-50 text-rose-900'
                            : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    <td className="p-0.5 border-r border-slate-200">
                      <select
                        value={row.riskCategory}
                        onChange={(e) => handleCellChange(row.id, 'riskCategory', e.target.value)}
                        className="w-full px-1 py-1 text-xs border border-slate-300 rounded-xs bg-white focus:outline-none"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </td>

                    <td className="p-1 text-center">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-sm transition cursor-pointer"
                        title="ही ओळ हटवा"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Grid Pagination Footer */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>प्रति पान ओळी:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-slate-300 rounded-sm px-1.5 py-0.5 bg-white text-xs font-bold"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              (एकूण {filteredRows.length} पैकी {filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filteredRows.length)})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2 py-1 border border-slate-300 rounded-sm bg-white hover:bg-slate-100 disabled:opacity-40 flex items-center gap-0.5 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> मागील
            </button>
            <span className="px-2 font-bold text-slate-800">
              पान {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-2 py-1 border border-slate-300 rounded-sm bg-white hover:bg-slate-100 disabled:opacity-40 flex items-center gap-0.5 cursor-pointer"
            >
              पुढील <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Summary Bar */}
      <div className="mt-3 bg-white border border-slate-200 rounded-sm p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>टीप:</strong> केवळ नवीन वैध आणि बदललेल्या विद्यमान (<strong>{saveableValidCount}</strong>) नोंदीच जतन केल्या जातील. न बदललेल्या जुन्या नोंदींवर कोणताही परिणाम होणार नाही.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToCustomers && (
            <button
              onClick={onNavigateToCustomers}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-sm border border-slate-300 cursor-pointer transition"
            >
              📋 खातेदार यादी पहा
            </button>
          )}

          <button
            onClick={() => handleBulkSave(true)}
            disabled={isSaving || saveableValidCount === 0}
            className={`px-5 py-2 rounded-sm text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer ${
              saveableValidCount > 0 && !isSaving
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{saveProgress || 'जतन होत आहे...'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>सर्व वैध खातेदार जतन करा ({saveableValidCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL: LOAD EXISTING CUSTOMERS FOR BULK EDIT */}
      {showExistingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm shadow-xl max-w-4xl w-full p-5 border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-100 text-sky-800 rounded-sm">
                  <FolderDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    विद्यमान खातेदार डेटा लोड करा (Bulk Edit Customers)
                  </h3>
                  <p className="text-xs text-slate-500">
                    डेटाबेसमधून खातेदार निवडून ग्रिडमध्ये आणा आणि त्यांचे नाव, पत्ता किंवा संपर्क माहिती एकाच वेळी अपडेट करा.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowExistingModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={existingSearch}
                    onChange={(e) => setExistingSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchExistingCustomers()}
                    placeholder="नाव, मधले नाव, जुना क्र., मोबाईल, आधार, पॅन किंवा CIF..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-sm text-xs bg-white"
                  />
                </div>
                <button
                  onClick={fetchExistingCustomers}
                  disabled={isLoadingExisting}
                  className="px-3 py-1.5 bg-primary text-white font-bold rounded-sm cursor-pointer hover:opacity-90 flex items-center gap-1"
                >
                  {isLoadingExisting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  <span>शोधा</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {isHoAdmin && branches.length > 0 && (
                  <select
                    value={existingBranchFilter}
                    onChange={(e) => setExistingBranchFilter(e.target.value)}
                    className="border border-slate-300 rounded-sm px-2 py-1 bg-white font-medium"
                  >
                    <option value="all">सर्व शाखा</option>
                    {branches.map((b) => (
                      <option key={b.branchID} value={String(b.branchID)}>
                        {b.branchName}
                      </option>
                    ))}
                  </select>
                )}

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={existingOnlyIncomplete}
                    onChange={(e) => setExistingOnlyIncomplete(e.target.checked)}
                    className="rounded-sm text-primary"
                  />
                  <span>केवळ अपूर्ण माहिती</span>
                </label>

                <div className="flex items-center gap-1 text-slate-500">
                  <span>मर्यादा:</span>
                  <select
                    value={existingLimit}
                    onChange={(e) => setExistingLimit(Number(e.target.value))}
                    className="border border-slate-300 rounded-sm px-1.5 py-1 bg-white"
                  >
                    <option value={25}>२५</option>
                    <option value={50}>५०</option>
                    <option value={100}>१००</option>
                    <option value={200}>२००</option>
                    <option value={500}>५००</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-sm mb-3 max-h-[48vh]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={existingCustomersList.length > 0 && selectedExistingIds.size === existingCustomersList.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExistingIds(new Set(existingCustomersList.map((c) => c.customerID)));
                          } else {
                            setSelectedExistingIds(new Set());
                          }
                        }}
                        className="rounded-sm"
                      />
                    </th>
                    <th className="p-2 w-24">CIF क्रमांक</th>
                    <th className="p-2">खातेदाराचे पूर्ण नाव</th>
                    <th className="p-2 w-28">मोबाईल नंबर</th>
                    <th className="p-2 w-32">आधार क्रमांक</th>
                    <th className="p-2 w-24">पॅन क्रमांक</th>
                    <th className="p-2 w-28">गाव / शहर</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingExisting ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                        <span>खातेदार यादी लोड होत आहे...</span>
                      </td>
                    </tr>
                  ) : existingCustomersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        कोणतेही खातेदार सापडले नाहीत. कृपया शोध निकष तपासा.
                      </td>
                    </tr>
                  ) : (
                    existingCustomersList.map((c) => {
                      const isChecked = selectedExistingIds.has(c.customerID);
                      return (
                        <tr
                          key={c.customerID}
                          className={`hover:bg-slate-50 cursor-pointer ${isChecked ? 'bg-sky-50/40' : ''}`}
                          onClick={() => {
                            setSelectedExistingIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.customerID)) next.delete(c.customerID);
                              else next.add(c.customerID);
                              return next;
                            });
                          }}
                        >
                          <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedExistingIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(c.customerID)) next.delete(c.customerID);
                                  else next.add(c.customerID);
                                  return next;
                                });
                              }}
                              className="rounded-sm"
                            />
                          </td>
                          <td className="p-2 font-mono font-bold text-indigo-700">{c.cifNo || '-'}</td>
                          <td className="p-2 font-medium text-slate-900">
                            {c.firstName} {c.middleName || ''} {c.lastName}
                          </td>
                          <td className="p-2 font-mono">{c.mobileNo || <span className="text-slate-400 italic">रिकामे</span>}</td>
                          <td className="p-2 font-mono">{c.aadhaarNo || <span className="text-slate-400 italic">रिकामे</span>}</td>
                          <td className="p-2 font-mono">{c.panNo || <span className="text-slate-400 italic">रिकामे</span>}</td>
                          <td className="p-2">{c.village || <span className="text-slate-400 italic">रिकामे</span>}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
              <div className="text-slate-600 font-medium">
                निवडलेले खातेदार: <strong className="text-sky-800 font-black">{selectedExistingIds.size}</strong> /{' '}
                {existingCustomersList.length}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExistingModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-sm cursor-pointer transition"
                >
                  रद्द करा
                </button>
                <button
                  onClick={() => handleLoadExistingIntoGrid('append')}
                  disabled={selectedExistingIds.size === 0}
                  className={`px-3 py-1.5 rounded-sm font-bold transition cursor-pointer ${
                    selectedExistingIds.size > 0
                      ? 'bg-sky-600 hover:bg-sky-700 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  ग्रिडमध्ये जोडा (+ Append)
                </button>
                <button
                  onClick={() => handleLoadExistingIntoGrid('replace')}
                  disabled={selectedExistingIds.size === 0}
                  className={`px-3.5 py-1.5 rounded-sm font-bold transition cursor-pointer ${
                    selectedExistingIds.size > 0
                      ? 'bg-primary hover:opacity-90 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  ग्रिड बदला (Replace Grid)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS / BATCH RESULT MODAL */}
      {saveResultModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-sm shadow-xl max-w-md w-full p-5 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-slate-900 mb-1">खातेदार बल्क व्यवहार यशस्वी!</h3>
            <p className="text-xs text-slate-500 mb-4">{saveResultModal.message}</p>

            <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 mb-4 text-xs text-left space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">बॅच क्रमांक:</span>
                <span className="font-bold text-slate-800 font-mono">{saveResultModal.batchNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">नवीन नोंदलेले खातेदार (Inserted):</span>
                <span className="font-black text-emerald-700">{saveResultModal.importedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">अद्ययावत केलेले खातेदार (Updated):</span>
                <span className="font-black text-sky-700">{saveResultModal.updatedCount}</span>
              </div>
              {saveResultModal.importedCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">नवीन CIF क्रमांक श्रेणी:</span>
                  <span className="font-bold text-indigo-700 font-mono">
                    {saveResultModal.startCif} ते {saveResultModal.endCif}
                  </span>
                </div>
              )}
              {saveResultModal.skippedCount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>वगळलेल्या (त्रुटी) ओळी:</span>
                  <span className="font-bold">{saveResultModal.skippedCount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setSaveResultModal(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-sm cursor-pointer transition"
              >
                पुढील नोंदणी करा
              </button>
              {onNavigateToCustomers && (
                <button
                  onClick={() => {
                    setSaveResultModal(null);
                    onNavigateToCustomers();
                  }}
                  className="px-4 py-1.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-sm cursor-pointer transition shadow-xs"
                >
                  📋 खातेदार यादी पहा
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

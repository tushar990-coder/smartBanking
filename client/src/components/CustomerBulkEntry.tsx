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
  Search,
  ShieldCheck,
  Check,
  X,
  Clock,
  Sparkles,
  Info,
  ChevronDown,
  Building2,
  FolderDown,
  Edit3,
  Filter,
  CheckSquare
} from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export interface BulkCustomerRow {
  id: string; // unique client id
  customerID?: number; // 0 or undefined for new customer, > 0 for existing customer
  cifNo?: string;      // CIF number if existing
  isExisting?: boolean; // visual flag
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

const STORAGE_DRAFT_KEY = 'BHISI_CUSTOMER_BULK_ENTRY_DRAFT_V2';
const DEFAULT_BIRTH_DATE = '1990-01-01'; // Default: 01/01/1990 as requested

export interface SansthaDefaults {
  address?: string;
  village?: string;
  taluka?: string;
  district?: string;
  state?: string;
  pinCode?: string;
}

const createEmptyRow = (
  customDefaults?: Partial<BulkCustomerRow>,
  sanstha?: SansthaDefaults | null
): BulkCustomerRow => ({
  id: 'row_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
  customerID: 0,
  cifNo: '',
  isExisting: false,
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
  occupation: '',
  customerType: 'Individual',
  kycStatus: 'Verified',
  ckycNo: '',
  riskCategory: 'Low',
  email: '',
  nomineeName: '',
  nomineeRelation: '',
  legacyCustomerNo: '',
  ...customDefaults
});

interface CustomerBulkEntryProps {
  onBack?: () => void;
  onNavigateToCustomers?: () => void;
}

export default function CustomerBulkEntry({ onBack, onNavigateToCustomers }: CustomerBulkEntryProps) {
  // Sanstha Defaults from API
  const [sansthaDefaults, setSansthaDefaults] = useState<SansthaDefaults | null>(null);

  // Main Rows State (Initialize with 10 empty rows or load draft)
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
      // fallback
    }
    return Array.from({ length: 10 }, () => createEmptyRow());
  });

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'invalid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [nextCifPreview, setNextCifPreview] = useState('CIF000001');
  const [lastDraftSavedTime, setLastDraftSavedTime] = useState<string | null>(null);

  // Live Server Duplicates Cache (Mobile, Aadhaar, PAN)
  const [serverErrorsMap, setServerErrorsMap] = useState<Record<number, string[]>>({});
  const [isValidatingServer, setIsValidatingServer] = useState(false);

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
  const [existingCustomersList, setExistingCustomersList] = useState<any[]>([]);
  const [selectedExistingIds, setSelectedExistingIds] = useState<Set<number>>(new Set());
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Load Metadata (Next CIF, Sanstha Defaults)
  useEffect(() => {
    axios.get('/api/CustomerBulk/meta')
      .then(res => {
        if (res.data?.nextCif) {
          setNextCifPreview(res.data.nextCif);
        }
        if (res.data?.sansthaDefaults) {
          const s = res.data.sansthaDefaults;
          setSansthaDefaults(s);
          setQuickFillVillage(s.village || '');
          setQuickFillTaluka(s.taluka || '');
          setQuickFillDistrict(s.district || '');

          // If current rows are completely blank and fresh, populate Sanstha defaults & default birthDate
          setRows(prevRows => {
            const isFresh = prevRows.every(r => !r.firstName && !r.lastName && !r.mobileNo && !r.aadhaarNo);
            if (isFresh) {
              return prevRows.map(r => ({
                ...r,
                birthDate: r.birthDate || DEFAULT_BIRTH_DATE,
                address: r.address || s.address || '',
                village: r.village || s.village || '',
                taluka: r.taluka || s.taluka || '',
                district: r.district || s.district || ''
              }));
            }
            return prevRows;
          });
        }
      })
      .catch(() => { });
  }, []);

  // -------------------------------------------------------------
  // AUTO-SAVE DRAFT TO LOCALSTORAGE (Debounced)
  // -------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if rows have any content before storing
      const hasAnyData = rows.some(r => r.firstName || r.lastName || r.mobileNo || r.aadhaarNo);
      if (hasAnyData) {
        try {
          localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(rows));
          const now = new Date();
          setLastDraftSavedTime(now.toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (e) {
          console.error('Draft save failed', e);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [rows]);

  // -------------------------------------------------------------
  // REAL-TIME CLIENT-SIDE VALIDATION & IN-GRID DEDUPLICATION
  // -------------------------------------------------------------
  const mobileRegex = useMemo(() => /^[6-9]\d{9}$/, []);
  const aadhaarRegex = useMemo(() => /^[2-9]\d{11}$/, []);
  const panRegex = useMemo(() => /^[A-Z]{5}\d{4}[A-Z]$/, []);
  const ckycRegex = useMemo(() => /^\d{14}$/, []);

  const validations = useMemo(() => {
    const valMap = new Map<string, RowValidation>();

    // Collect frequencies for in-grid duplicate detection
    const mobileFreq: Record<string, number> = {};
    const aadhaarFreq: Record<string, number> = {};
    const panFreq: Record<string, number> = {};
    const ckycFreq: Record<string, number> = {};
    const legacyFreq: Record<string, number> = {};

    rows.forEach(r => {
      const mob = r.mobileNo.trim();
      const aadh = r.aadhaarNo.trim();
      const pan = r.panNo.trim().toUpperCase();
      const ckyc = r.ckycNo.trim();
      const leg = r.legacyCustomerNo.trim();

      if (mob) mobileFreq[mob] = (mobileFreq[mob] || 0) + 1;
      if (aadh) aadhaarFreq[aadh] = (aadhaarFreq[aadh] || 0) + 1;
      if (pan) panFreq[pan] = (panFreq[pan] || 0) + 1;
      if (ckyc) ckycFreq[ckyc] = (ckycFreq[ckyc] || 0) + 1;
      if (leg) legacyFreq[leg] = (legacyFreq[leg] || 0) + 1;
    });

    rows.forEach((r, idx) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check if row is completely blank (allowed to skip or delete)
      const isCompletelyEmpty =
        !r.firstName.trim() &&
        !r.lastName.trim() &&
        !r.mobileNo.trim() &&
        !r.aadhaarNo.trim() &&
        !r.panNo.trim();

      if (isCompletelyEmpty) {
        errors.push('पहिले नाव आणि आडनाव आवश्यक आहे.');
      } else {
        // Mandatory fields
        if (!r.firstName.trim()) {
          errors.push('पहिले नाव आवश्यक आहे (First name is required).');
        }
        if (!r.lastName.trim()) {
          errors.push('आडनाव आवश्यक आहे (Last name is required).');
        }

        // Mobile validation
        const mob = r.mobileNo.trim();
        if (mob) {
          if (!mobileRegex.test(mob)) {
            errors.push('मोबाईल नंबर १० अंकी वैध असावा (६-९ ने सुरू).');
          } else if (mobileFreq[mob] > 1) {
            errors.push(`मोबाईल नंबर '${mob}' ग्रिडमध्ये पुनरावृत्ती (Duplicate) झाला आहे.`);
          }
        }

        // Aadhaar validation
        const aadh = r.aadhaarNo.trim();
        if (aadh) {
          if (!aadhaarRegex.test(aadh)) {
            errors.push('आधार क्रमांक १२ अंकी वैध असावा.');
          } else if (aadhaarFreq[aadh] > 1) {
            errors.push(`आधार क्रमांक '${aadh}' ग्रिडमध्ये पुनरावृत्ती (Duplicate) झाला आहे.`);
          }
        }

        // PAN validation
        const pan = r.panNo.trim().toUpperCase();
        if (pan) {
          if (!panRegex.test(pan)) {
            errors.push('पॅन नंबर १० अक्षरी वैध फॉरमॅटमध्ये असावा (उदा. ABCDE1234F).');
          } else if (panFreq[pan] > 1) {
            errors.push(`पॅन नंबर '${pan}' ग्रिडमध्ये पुनरावृत्ती (Duplicate) झाला आहे.`);
          }
        }

        // CKYC validation
        const ckyc = r.ckycNo.trim();
        if (ckyc) {
          if (!ckycRegex.test(ckyc)) {
            errors.push('सी-केवायसी क्रमांक १४ अंकी असावा.');
          } else if (ckycFreq[ckyc] > 1) {
            errors.push(`CKYC क्रमांक '${ckyc}' ग्रिडमध्ये पुनरावृत्ती झाला आहे.`);
          }
        }

        // LegacyCustomerNo validation
        const leg = r.legacyCustomerNo.trim();
        if (leg && legacyFreq[leg] > 1) {
          errors.push(`जुना ग्राहक क्र. '${leg}' ग्रिडमध्ये पुनरावृत्ती झाला आहे.`);
        }

        // Check if server validation flagged this row index
        const serverErrs = serverErrorsMap[idx + 1];
        if (serverErrs && serverErrs.length > 0) {
          serverErrs.forEach(serr => {
            if (!errors.includes(serr)) errors.push(serr);
          });
        }
      }

      valMap.set(r.id, {
        isValid: errors.length === 0,
        errors,
        warnings
      });
    });

    return valMap;
  }, [rows, mobileRegex, aadhaarRegex, panRegex, ckycRegex, serverErrorsMap]);

  // KPI Counts
  const { totalRows, validRows, invalidRows } = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    rows.forEach(r => {
      const v = validations.get(r.id);
      if (v?.isValid) valid++;
      else invalid++;
    });
    return {
      totalRows: rows.length,
      validRows: valid,
      invalidRows: invalid
    };
  }, [rows, validations]);

  // -------------------------------------------------------------
  // DEBOUNCED SERVER DUPLICATE VALIDATION
  // -------------------------------------------------------------
  const validateWithServer = useCallback(async () => {
    // Only send rows that have at least Mobile, Aadhaar, or PAN
    const candidateRows = rows
      .map((r, i) => ({
        rowIndex: i + 1,
        clientRowId: r.id,
        customerID: r.customerID || 0, // Excludes self from duplicate checks when editing
        firstName: r.firstName,
        lastName: r.lastName,
        mobileNo: r.mobileNo,
        aadhaarNo: r.aadhaarNo,
        panNo: r.panNo,
        ckycNo: r.ckycNo,
        legacyCustomerNo: r.legacyCustomerNo
      }))
      .filter(r => r.firstName || r.lastName || r.mobileNo || r.aadhaarNo || r.panNo);

    if (candidateRows.length === 0) {
      setServerErrorsMap({});
      return;
    }

    try {
      setIsValidatingServer(true);
      const res = await axios.post('/api/CustomerBulk/validate-live', candidateRows);
      if (res.data?.results) {
        const errMap: Record<number, string[]> = {};
        res.data.results.forEach((item: any) => {
          if (!item.isValid && item.errors?.length > 0) {
            errMap[item.rowIndex] = item.errors;
          }
        });
        setServerErrorsMap(errMap);
      }
    } catch (e) {
      console.error('Server validation error', e);
    } finally {
      setIsValidatingServer(false);
    }
  }, [rows]);

  useEffect(() => {
    const timer = setTimeout(() => {
      validateWithServer();
    }, 1200);
    return () => clearTimeout(timer);
  }, [validateWithServer]);

  // -------------------------------------------------------------
  // ROW MANIPULATION ACTIONS
  // -------------------------------------------------------------
  const handleAddRows = (count: number) => {
    const newRows = Array.from({ length: count }, () => createEmptyRow(undefined, sansthaDefaults));
    setRows(prev => [...prev, ...newRows]);
  };

  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow(undefined, sansthaDefaults)]);
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (selectedRowIds.size === 0) return;
    if (!window.confirm(`तुम्हाला निवडलेल्या ${selectedRowIds.size} ओळी हटवायच्या आहेत का?`)) return;

    setRows(prev => {
      const remaining = prev.filter(r => !selectedRowIds.has(r.id));
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
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };

      // Auto uppercase for PAN
      if (field === 'panNo' && typeof value === 'string') {
        updated.panNo = value.toUpperCase();
      }

      return updated;
    }));
  };

  // -------------------------------------------------------------
  // SMART QUICK-FILL TOOLS & SANSTHA ADDRESS APPLICATION
  // -------------------------------------------------------------
  const applyQuickFill = () => {
    setRows(prev => prev.map(r => ({
      ...r,
      village: quickFillVillage ? quickFillVillage : r.village,
      taluka: quickFillTaluka ? quickFillTaluka : r.taluka,
      district: quickFillDistrict ? quickFillDistrict : r.district
    })));
    setShowQuickFill(false);
  };

  const applySansthaAddressToAll = () => {
    if (!sansthaDefaults) return;
    setRows(prev => prev.map(r => ({
      ...r,
      address: sansthaDefaults.address || r.address,
      village: sansthaDefaults.village || r.village,
      taluka: sansthaDefaults.taluka || r.taluka,
      district: sansthaDefaults.district || r.district
    })));
    setShowQuickFill(false);
    alert('सर्व ओळींना संस्थेचा पत्ता (गाव, तालुका, जिल्हा) यशस्वीरित्या लागू केला!');
  };

  // -------------------------------------------------------------
  // EXISTING CUSTOMERS LOAD / BULK EDIT HANDLERS
  // -------------------------------------------------------------
  const fetchExistingCustomers = async () => {
    setIsLoadingExisting(true);
    try {
      const res = await axios.get('/api/CustomerBulk/existing-customers', {
        params: {
          search: existingSearch,
          onlyIncomplete: existingOnlyIncomplete,
          limit: existingLimit
        }
      });
      const list = res.data?.customers || [];
      setExistingCustomersList(list);
      setSelectedExistingIds(new Set(list.map((c: any) => c.customerID)));
    } catch (err) {
      console.error('Fetch existing customers failed', err);
      alert('विद्यमान ग्राहक यादी आणताना त्रुटी आली.');
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const handleLoadExistingIntoGrid = (mode: 'replace' | 'append') => {
    const chosen = existingCustomersList.filter(c => selectedExistingIds.has(c.customerID));
    if (chosen.length === 0) {
      alert('कृपया ग्रिडमध्ये लोड करण्यासाठी किमान एक ग्राहक निवडा.');
      return;
    }

    const mappedRows: BulkCustomerRow[] = chosen.map(c => ({
      id: 'row_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      customerID: c.customerID,
      cifNo: c.cifNo || '',
      isExisting: true,
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
      birthDate: c.birthDate ? c.birthDate.substring(0, 10) : DEFAULT_BIRTH_DATE,
      address: c.address || sansthaDefaults?.address || '',
      village: c.village || sansthaDefaults?.village || '',
      taluka: c.taluka || sansthaDefaults?.taluka || '',
      district: c.district || sansthaDefaults?.district || '',
      occupation: c.occupation || '',
      customerType: c.customerType || 'Individual',
      kycStatus: c.kycStatus || 'Verified',
      ckycNo: c.ckycNo || '',
      riskCategory: c.riskCategory || 'Low',
      email: c.email || '',
      nomineeName: c.nomineeName || '',
      nomineeRelation: c.nomineeRelation || '',
      legacyCustomerNo: c.legacyCustomerNo || ''
    }));

    if (mode === 'replace') {
      setRows(mappedRows);
    } else {
      setRows(prev => {
        const activeRows = prev.filter(r => r.firstName || r.lastName || r.mobileNo);
        return [...activeRows, ...mappedRows];
      });
    }

    setShowExistingModal(false);
    alert(`${mappedRows.length} विद्यमान ग्राहक ग्रिडमध्ये यशस्वीरित्या लोड झाले. तुम्ही आता त्यांच्या माहितीत बदल करून थेट सेव्ह करू शकता!`);
  };

  // -------------------------------------------------------------
  // EXCEL COPY-PASTE & FILE IMPORT / EXPORT SUPPORT
  // -------------------------------------------------------------
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowIdx: number, startField: keyof BulkCustomerRow) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData || (!pasteData.includes('\t') && !pasteData.includes('\n'))) {
      return; // normal single-cell paste
    }

    e.preventDefault();
    const lines = pasteData.trim().split(/\r\n|\n|\r/);
    if (lines.length === 0) return;

    const fieldOrder: (keyof BulkCustomerRow)[] = [
      'firstName', 'middleName', 'lastName', 'firstNameEng', 'lastNameEng',
      'mobileNo', 'aadhaarNo', 'panNo', 'gender', 'birthDate',
      'address', 'village', 'taluka', 'district', 'occupation',
      'customerType', 'kycStatus', 'ckycNo', 'riskCategory',
      'email', 'nomineeName', 'nomineeRelation', 'legacyCustomerNo'
    ];

    const startFieldIdx = fieldOrder.indexOf(startField);
    if (startFieldIdx === -1) return;

    setRows(prev => {
      const next = [...prev];

      // Expand rows if pasted lines exceed current row count
      while (startRowIdx + lines.length > next.length) {
        next.push(createEmptyRow(undefined, sansthaDefaults));
      }

      lines.forEach((line, rOffset) => {
        const targetRowIdx = startRowIdx + rOffset;
        if (targetRowIdx >= next.length) return;

        const cells = line.split('\t');
        const currentRow = { ...next[targetRowIdx] };

        cells.forEach((cellVal, cOffset) => {
          const targetFieldIdx = startFieldIdx + cOffset;
          if (targetFieldIdx < fieldOrder.length) {
            const fName = fieldOrder[targetFieldIdx];
            let cleanVal = cellVal.trim();
            if (fName === 'panNo') cleanVal = cleanVal.toUpperCase();
            (currentRow as any)[fName] = cleanVal;
          }
        });

        next[targetRowIdx] = currentRow;
      });

      return next;
    });
  };

  // Download Error Excel (Export only invalid rows with reasons)
  const handleDownloadErrorExcel = () => {
    const errorRowsData: any[] = [];

    rows.forEach((r, idx) => {
      const v = validations.get(r.id);
      if (v && !v.isValid) {
        errorRowsData.push({
          'अनुक्रमांक (Row)': idx + 1,
          'नोंदणी प्रकार': r.customerID && r.customerID > 0 ? `संपादित (CIF: ${r.cifNo || ''})` : 'नवीन',
          'त्रुटीचे कारण (Error Reason)': v.errors.join(' | '),
          'पहिले नाव (FirstName)': r.firstName,
          'मधले नाव (MiddleName)': r.middleName,
          'आडनाव (LastName)': r.lastName,
          'नाव इंग्रजीत (FirstNameEng)': r.firstNameEng,
          'आडनाव इंग्रजीत (LastNameEng)': r.lastNameEng,
          'मोबाईल (MobileNo)': r.mobileNo,
          'आधार क्र (AadhaarNo)': r.aadhaarNo ? String(r.aadhaarNo) : '',
          'पॅन क्र (PANNo)': r.panNo,
          'लिंग (Gender)': r.gender,
          'जन्मतारीख (BirthDate)': r.birthDate,
          'पत्ता (Address)': r.address,
          'गाव (Village)': r.village,
          'तालुका (Taluka)': r.taluka,
          'जिल्हा (District)': r.district,
          'व्यवसाय (Occupation)': r.occupation,
          'ग्राहक प्रकार (CustomerType)': r.customerType,
          'केवायसी स्थिती (KYCStatus)': r.kycStatus,
          'CKYC क्र (CKYCNo)': r.ckycNo,
          'जोखीम वर्ग (RiskCategory)': r.riskCategory,
          'ईमेल (Email)': r.email,
          'वारसदार (NomineeName)': r.nomineeName,
          'जुना ग्राहक क्र (LegacyCustomerNo)': r.legacyCustomerNo
        });
      }
    });

    if (errorRowsData.length === 0) {
      alert('सध्या कोणतीही त्रुटी असलेली ओळ नाही.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(errorRowsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invalid_Customers');
    XLSX.writeFile(wb, `Customer_Bulk_Errors_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  // -------------------------------------------------------------
  // ATOMIC BULK SAVE (INSERTS NEW & UPDATES EXISTING CUSTOMERS)
  // -------------------------------------------------------------
  const handleBulkSave = async (saveValidOnly = true) => {
    if (validRows === 0) {
      alert('जतन करण्यासाठी एकही वैध ग्राहक सापडला नाही. कृपया आवश्यक फील्ड्स (पहिले नाव, आडनाव) भरा.');
      return;
    }

    if (!saveValidOnly && invalidRows > 0) {
      alert(`ग्रिडमध्ये ${invalidRows} ओळींमध्ये त्रुटी आहेत. कृपया त्रुटी दुरुस्त करा किंवा 'केवळ वैध नोंदी जतन करा' पर्याय वापरा.`);
      return;
    }

    const newCount = rows.filter(r => validations.get(r.id)?.isValid && (!r.customerID || r.customerID === 0)).length;
    const editCount = rows.filter(r => validations.get(r.id)?.isValid && r.customerID && r.customerID > 0).length;

    const confirmMsg = `एकूण ${validRows} वैध नोंदी सेव्ह करायच्या आहेत का?\n(नवीन ग्राहक: ${newCount}, अद्ययावत ग्राहक: ${editCount})`;

    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    setSaveProgress('डेटाबेस ट्रान्झॅक्शन सुरू करत आहे व सलग CIF वाटप / अपडेट करत आहे...');

    try {
      const payloadRows = rows
        .map((r, i) => ({
          rowIndex: i + 1,
          clientRowId: r.id,
          customerID: r.customerID || 0,
          cifNo: r.cifNo || '',
          firstName: r.firstName,
          middleName: r.middleName,
          lastName: r.lastName,
          firstNameEng: r.firstNameEng,
          middleNameEng: r.middleNameEng,
          lastNameEng: r.lastNameEng,
          mobileNo: r.mobileNo,
          aadhaarNo: r.aadhaarNo,
          panNo: r.panNo,
          gender: r.gender,
          birthDate: r.birthDate ? r.birthDate : DEFAULT_BIRTH_DATE,
          address: r.address,
          village: r.village,
          taluka: r.taluka,
          district: r.district,
          occupation: r.occupation,
          customerType: r.customerType,
          kycStatus: r.kycStatus,
          ckycNo: r.ckycNo,
          riskCategory: r.riskCategory,
          email: r.email,
          nomineeName: r.nomineeName,
          nomineeRelation: r.nomineeRelation,
          legacyCustomerNo: r.legacyCustomerNo
        }))
        .filter(r => {
          if (!saveValidOnly) return true;
          const v = validations.get(r.clientRowId);
          return v?.isValid;
        });

      const res = await axios.post('/api/CustomerBulk/save', {
        batchName: `DirectGrid_${new Date().toISOString().substring(0, 10)}`,
        saveValidOnly: true,
        customers: payloadRows
      });

      if (res.data?.success) {
        // Clear saved draft from localStorage
        localStorage.removeItem(STORAGE_DRAFT_KEY);

        // Keep remaining invalid rows if any, otherwise reset grid
        if (invalidRows > 0) {
          setRows(prev => prev.filter(r => {
            const v = validations.get(r.id);
            return !v?.isValid;
          }));
        } else {
          setRows(Array.from({ length: 10 }, () => createEmptyRow(undefined, sansthaDefaults)));
        }

        setSaveResultModal({
          isOpen: true,
          success: true,
          batchNumber: res.data.batchNumber,
          importedCount: res.data.importedCount || 0,
          updatedCount: res.data.updatedCount || 0,
          skippedCount: res.data.skippedCount || 0,
          startCif: res.data.startCif || '-',
          endCif: res.data.endCif || '-',
          message: res.data.message || 'सर्व ग्राहक यशस्वीरित्या जतन झाले.'
        });
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.message || 'ग्राहक जतन करताना त्रुटी आली.';
      alert('त्रुटी: ' + errMsg);
    } finally {
      setIsSaving(false);
      setSaveProgress('');
    }
  };

  // -------------------------------------------------------------
  // FILTERED ROWS VIEW
  // -------------------------------------------------------------
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const v = validations.get(r.id);
      if (filterMode === 'valid' && !v?.isValid) return false;
      if (filterMode === 'invalid' && v?.isValid) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = `${r.firstName} ${r.middleName} ${r.lastName}`.toLowerCase();
        const contact = `${r.mobileNo} ${r.aadhaarNo} ${r.panNo} ${r.legacyCustomerNo} ${r.cifNo || ''}`.toLowerCase();
        if (!fullName.includes(q) && !contact.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, validations, filterMode, searchQuery]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRowIds(new Set(filteredRows.map(r => r.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-3 bg-slate-50 min-h-screen font-sans">
      {/* 🏛️ Top Header Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-3 mb-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition cursor-pointer"
              title="मागे जा"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 text-primary rounded border border-primary/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h1 className="text-base font-black text-slate-900 tracking-tight">
                ग्राहक बल्क नोंदणी व संपादन (Customer Bulk Entry & Edit Grid)
              </h1>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Excel Spreadsheet Mode
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              एकाच स्क्रीनवर १००+ नवीन ग्राहकांची नोंद करा किंवा विद्यमान ग्राहक लोड करून बल्क एडिट करा • संस्थेचा पत्ता व जन्मतारीख 01/01/1990 आपोआप लागू.
            </p>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Draft indicator */}
          {lastDraftSavedTime && (
            <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>ड्राफ्ट जतन: <strong className="text-slate-800">{lastDraftSavedTime}</strong></span>
            </div>
          )}

          {/* 📥 Load Existing Customers Button */}
          <button
            onClick={() => {
              setShowExistingModal(true);
              if (existingCustomersList.length === 0) {
                fetchExistingCustomers();
              }
            }}
            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold rounded border border-sky-300 flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
            title="डेटाबेसमधील आधी भरलेले ग्राहक ग्रिडमध्ये आणून बल्क एडिट करा"
          >
            <FolderDown className="w-3.5 h-3.5 text-sky-700" />
            <span>विद्यमान ग्राहक लोड करा</span>
          </button>

          {/* Quick-Fill Popover Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowQuickFill(!showQuickFill)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 cursor-pointer transition"
              title="सर्व ओळींमध्ये समान गाव/पत्ता भरणे"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>स्मार्ट ऑटो-फिल</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showQuickFill && (
              <div className="absolute right-0 mt-1 w-72 bg-white border border-slate-300 rounded-md shadow-lg p-3 z-50 animate-in fade-in zoom-in-95">
                <div className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>सर्व ओळींना समान माहिती लावा:</span>
                  <button onClick={() => setShowQuickFill(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Apply Sanstha Address Shortcut */}
                {sansthaDefaults && (
                  <div className="p-2 bg-emerald-50 rounded border border-emerald-200 mb-2.5">
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
                      className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded cursor-pointer transition"
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
                      value={quickFillVillage}
                      onChange={e => setQuickFillVillage(e.target.value)}
                      placeholder="उदा. मुंबई / सांगली"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">तालुका</label>
                    <input
                      type="text"
                      value={quickFillTaluka}
                      onChange={e => setQuickFillTaluka(e.target.value)}
                      placeholder="उदा. कडेगाव"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">जिल्हा</label>
                    <input
                      type="text"
                      value={quickFillDistrict}
                      onChange={e => setQuickFillDistrict(e.target.value)}
                      placeholder="उदा. सांगली"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <button
                    onClick={applyQuickFill}
                    className="w-full mt-2 py-1 bg-primary text-white text-xs font-bold rounded hover:opacity-90 cursor-pointer"
                  >
                    कस्टम लागू करा (Apply Custom)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Download Error Excel */}
          {invalidRows > 0 && (
            <button
              onClick={handleDownloadErrorExcel}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded border border-rose-200 flex items-center gap-1.5 cursor-pointer transition"
              title="केवळ त्रुटी असलेल्या ओळी एक्सेलमध्ये डाऊनलोड करा"
            >
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>त्रुटींची Excel ({invalidRows})</span>
            </button>
          )}

          {/* Clear All Button */}
          <button
            onClick={handleClearAll}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 cursor-pointer transition"
            title="सर्व नोंदी साफ करा"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>साफ करा</span>
          </button>

          {/* Primary Bulk Save Button */}
          <button
            onClick={() => handleBulkSave(true)}
            disabled={isSaving || validRows === 0}
            className={`px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer ${
              validRows > 0 && !isSaving
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
            title="सर्व वैध ग्राहक एकाच वेळी सेव्ह करा"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>जतन होत आहे...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>एकत्रित जतन करा ({validRows})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 📊 KPI Summary & Filter Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 mb-3">
        {/* Total Rows Card */}
        <div
          onClick={() => setFilterMode('all')}
          className={`p-2.5 rounded-md border cursor-pointer transition flex items-center justify-between ${
            filterMode === 'all' ? 'bg-white border-primary ring-1 ring-primary shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-700 rounded">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">एकूण ओळी (Total)</div>
              <div className="text-base font-black text-slate-900">{totalRows}</div>
            </div>
          </div>
          {filterMode === 'all' && <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded">सक्रिय</span>}
        </div>

        {/* Valid Rows Card */}
        <div
          onClick={() => setFilterMode('valid')}
          className={`p-2.5 rounded-md border cursor-pointer transition flex items-center justify-between ${
            filterMode === 'valid' ? 'bg-emerald-50/50 border-emerald-500 ring-1 ring-emerald-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">वैध नोंदी (Valid)</div>
              <div className="text-base font-black text-emerald-800">{validRows}</div>
            </div>
          </div>
          {filterMode === 'valid' && <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded">सक्रिय</span>}
        </div>

        {/* Invalid Rows Card */}
        <div
          onClick={() => setFilterMode('invalid')}
          className={`p-2.5 rounded-md border cursor-pointer transition flex items-center justify-between ${
            filterMode === 'invalid' ? 'bg-rose-50/50 border-rose-500 ring-1 ring-rose-500 shadow-xs' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 text-rose-700 rounded">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">त्रुटी असलेल्या (Errors)</div>
              <div className="text-base font-black text-rose-800">{invalidRows}</div>
            </div>
          </div>
          {filterMode === 'invalid' && <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded">सक्रिय</span>}
        </div>

        {/* Next Starting CIF Card */}
        <div className="bg-white p-2.5 rounded-md border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded">
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

      {/* 🛠️ Action Toolbar (+Rows, Delete, Search) */}
      <div className="bg-white border border-slate-200 rounded-md p-2 mb-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-xs font-bold text-slate-600 mr-1">ओळी जोडा (Add):</span>
          <button
            onClick={() => handleAddRows(1)}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> +१
          </button>
          <button
            onClick={() => handleAddRows(5)}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 cursor-pointer"
          >
            +५
          </button>
          <button
            onClick={() => handleAddRows(10)}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded border border-primary/30 cursor-pointer"
          >
            +१० ओळी
          </button>
          <button
            onClick={() => handleAddRows(50)}
            className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded border border-primary/30 cursor-pointer"
          >
            +५० ओळी
          </button>
          <button
            onClick={() => handleAddRows(100)}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded shadow-xs cursor-pointer"
          >
            ⚡ +१०० ओळी (Fast Bulk)
          </button>

          {selectedRowIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded ml-2 flex items-center gap-1 cursor-pointer transition shadow-xs"
            >
              <Trash2 className="w-3 h-3" />
              <span>निवडलेल्या ओळी हटवा ({selectedRowIds.size})</span>
            </button>
          )}
        </div>

        {/* Search within grid */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="नावाने / मोबाईलने / CIF ने शोधा..."
              className="pl-8 pr-2.5 py-1 text-xs border border-slate-300 rounded w-52 focus:outline-none focus:ring-1 focus:ring-primary"
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

      {/* 📋 EXCEL-STYLE SPREADSHEET GRID TABLE */}
      <div className="bg-white border border-slate-300 rounded-md shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[68vh]">
          <table className="w-full text-left border-collapse text-[11px]">
            {/* Sticky Header */}
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-20 shadow-2xs select-none">
              <tr>
                <th className="p-1.5 w-10 text-center border-r border-slate-300 bg-slate-100">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && selectedRowIds.size === filteredRows.length}
                    onChange={e => toggleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-primary cursor-pointer"
                  />
                </th>
                <th className="p-1.5 w-12 text-center border-r border-slate-300">#</th>
                <th className="p-1.5 w-20 text-center border-r border-slate-300 bg-slate-100">प्रकार / CIF</th>
                <th className="p-1.5 w-14 text-center border-r border-slate-300">स्थिती</th>
                <th className="p-1.5 min-w-[120px] border-r border-slate-300 text-slate-900">
                  पहिले नाव <span className="text-rose-600 font-black">*</span>
                </th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">मधले नाव</th>
                <th className="p-1.5 min-w-[120px] border-r border-slate-300 text-slate-900">
                  आडनाव <span className="text-rose-600 font-black">*</span>
                </th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">First Name (Eng)</th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">Last Name (Eng)</th>
                <th className="p-1.5 min-w-[115px] border-r border-slate-300">मोबाईल क्र. (10 अंक)</th>
                <th className="p-1.5 min-w-[125px] border-r border-slate-300">आधार क्र. (12 अंक)</th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">पॅन क्र. (PAN)</th>
                <th className="p-1.5 min-w-[85px] border-r border-slate-300">लिंग</th>
                <th className="p-1.5 min-w-[115px] border-r border-slate-300">जन्मतारीख</th>
                <th className="p-1.5 min-w-[120px] border-r border-slate-300">गाव / शहर</th>
                <th className="p-1.5 min-w-[100px] border-r border-slate-300">तालुका</th>
                <th className="p-1.5 min-w-[100px] border-r border-slate-300">जिल्हा</th>
                <th className="p-1.5 min-w-[140px] border-r border-slate-300">पत्ता</th>
                <th className="p-1.5 min-w-[100px] border-r border-slate-300">व्यवसाय</th>
                <th className="p-1.5 min-w-[105px] border-r border-slate-300">ग्राहक प्रकार</th>
                <th className="p-1.5 min-w-[95px] border-r border-slate-300">केवायसी</th>
                <th className="p-1.5 min-w-[125px] border-r border-slate-300">CKYC क्र.</th>
                <th className="p-1.5 min-w-[80px] border-r border-slate-300">जोखीम</th>
                <th className="p-1.5 min-w-[110px] border-r border-slate-300">वारसदार नाव</th>
                <th className="p-1.5 min-w-[90px] border-r border-slate-300">नाते</th>
                <th className="p-1.5 min-w-[100px] border-r border-slate-300">जुना ग्राहक क्र.</th>
                <th className="p-1.5 w-12 text-center">कृती</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {filteredRows.map((row, idx) => {
                const validation = validations.get(row.id) || { isValid: true, errors: [], warnings: [] };
                const isInvalid = !validation.isValid;
                const isSelected = selectedRowIds.has(row.id);
                const isExisting = row.customerID && row.customerID > 0;

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-200 transition-colors ${
                      isInvalid ? 'bg-rose-50/60 hover:bg-rose-50' : isSelected ? 'bg-indigo-50/50' : 'bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-1 text-center border-r border-slate-200">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(row.id)}
                        className="rounded border-slate-300 text-primary cursor-pointer"
                      />
                    </td>

                    {/* Row Index */}
                    <td className="p-1 text-center border-r border-slate-200 text-slate-500 font-mono text-[10px]">
                      {idx + 1}
                    </td>

                    {/* Type / CIF Badge */}
                    <td className="p-1 text-center border-r border-slate-200 bg-slate-50/50">
                      {isExisting ? (
                        <div className="flex flex-col items-center">
                          <span className="bg-sky-100 text-sky-800 font-black text-[9px] px-1 py-0.5 rounded border border-sky-300" title={`CustomerID: ${row.customerID}`}>
                            संपादित
                          </span>
                          <span className="text-[9px] font-mono text-slate-600 font-bold mt-0.5" title="विद्यमान CIF क्रमांक">
                            {row.cifNo || `ID:${row.customerID}`}
                          </span>
                        </div>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 font-bold text-[9px] px-1.5 py-0.5 rounded border border-emerald-200">
                          नवीन
                        </span>
                      )}
                    </td>

                    {/* Status Badge with Tooltip */}
                    <td className="p-1 text-center border-r border-slate-200">
                      {isInvalid ? (
                        <div className="group relative inline-block cursor-help">
                          <span className="bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded shadow-2xs">
                            त्रुटी
                          </span>
                          <div className="hidden group-hover:block absolute left-8 top-0 z-50 w-56 p-2 bg-slate-900 text-white text-[10px] rounded shadow-lg">
                            <div className="font-bold text-rose-300 mb-1">दुरुस्ती आवश्यक:</div>
                            <ul className="list-disc pl-3 space-y-0.5">
                              {validation.errors.map((err, eIdx) => (
                                <li key={eIdx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 font-bold text-[9px] px-1.5 py-0.5 rounded">
                          वैध
                        </span>
                      )}
                    </td>

                    {/* FirstName (Mandatory) */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.firstName}
                        onChange={e => handleCellChange(row.id, 'firstName', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'firstName')}
                        placeholder="पहिले नाव"
                        className={`w-full px-1.5 py-1 text-xs border rounded-xs focus:outline-none focus:ring-1 ${
                          !row.firstName.trim() ? 'border-rose-400 bg-rose-50/40 text-slate-900' : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    {/* MiddleName */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.middleName}
                        onChange={e => handleCellChange(row.id, 'middleName', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'middleName')}
                        placeholder="मधले नाव"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    {/* LastName (Mandatory) */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.lastName}
                        onChange={e => handleCellChange(row.id, 'lastName', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'lastName')}
                        placeholder="आडनाव"
                        className={`w-full px-1.5 py-1 text-xs border rounded-xs focus:outline-none focus:ring-1 ${
                          !row.lastName.trim() ? 'border-rose-400 bg-rose-50/40 text-slate-900' : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    {/* FirstNameEng */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.firstNameEng}
                        onChange={e => handleCellChange(row.id, 'firstNameEng', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'firstNameEng')}
                        placeholder="First Name"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    {/* LastNameEng */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.lastNameEng}
                        onChange={e => handleCellChange(row.id, 'lastNameEng', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'lastNameEng')}
                        placeholder="Last Name"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    {/* MobileNo */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={10}
                        value={row.mobileNo}
                        onChange={e => handleCellChange(row.id, 'mobileNo', e.target.value.replace(/\D/g, ''))}
                        onPaste={e => handlePaste(e, idx, 'mobileNo')}
                        placeholder="98XXXXXXXX"
                        className={`w-full px-1.5 py-1 text-xs font-mono border rounded-xs focus:outline-none ${
                          row.mobileNo && (!mobileRegex.test(row.mobileNo) || (validation.errors.some(x => x.includes('मोबाईल'))))
                            ? 'border-rose-500 bg-rose-50 text-rose-900'
                            : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    {/* AadhaarNo */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={12}
                        value={row.aadhaarNo}
                        onChange={e => handleCellChange(row.id, 'aadhaarNo', e.target.value.replace(/\D/g, ''))}
                        onPaste={e => handlePaste(e, idx, 'aadhaarNo')}
                        placeholder="12 अंकी आधार"
                        className={`w-full px-1.5 py-1 text-xs font-mono border rounded-xs focus:outline-none ${
                          row.aadhaarNo && (!aadhaarRegex.test(row.aadhaarNo) || (validation.errors.some(x => x.includes('आधार'))))
                            ? 'border-rose-500 bg-rose-50 text-rose-900'
                            : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    {/* PANNo */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={10}
                        value={row.panNo}
                        onChange={e => handleCellChange(row.id, 'panNo', e.target.value.toUpperCase())}
                        onPaste={e => handlePaste(e, idx, 'panNo')}
                        placeholder="ABCDE1234F"
                        className={`w-full px-1.5 py-1 text-xs font-mono border rounded-xs focus:outline-none uppercase ${
                          row.panNo && (!panRegex.test(row.panNo) || (validation.errors.some(x => x.includes('पॅन'))))
                            ? 'border-rose-500 bg-rose-50 text-rose-900'
                            : 'border-slate-300 focus:border-primary'
                        }`}
                      />
                    </td>

                    {/* Gender */}
                    <td className="p-0.5 border-r border-slate-200">
                      <select
                        value={row.gender}
                        onChange={e => handleCellChange(row.id, 'gender', e.target.value)}
                        className="w-full px-1 py-1 text-xs border border-slate-300 rounded-xs bg-white focus:outline-none"
                      >
                        <option value="Male">पुरुष</option>
                        <option value="Female">स्त्री</option>
                        <option value="Other">इतर</option>
                      </select>
                    </td>

                    {/* BirthDate */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="date"
                        value={row.birthDate}
                        onChange={e => handleCellChange(row.id, 'birthDate', e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border border-slate-300 rounded-xs focus:outline-none"
                      />
                    </td>

                    {/* Village */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.village}
                        onChange={e => handleCellChange(row.id, 'village', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'village')}
                        placeholder="गाव/शहर"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    {/* Taluka */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.taluka}
                        onChange={e => handleCellChange(row.id, 'taluka', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'taluka')}
                        placeholder="तालुका"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    {/* District */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.district}
                        onChange={e => handleCellChange(row.id, 'district', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'district')}
                        placeholder="जिल्हा"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    {/* Address */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.address}
                        onChange={e => handleCellChange(row.id, 'address', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'address')}
                        placeholder="पत्ता"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    {/* Occupation */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.occupation}
                        onChange={e => handleCellChange(row.id, 'occupation', e.target.value)}
                        onPaste={e => handlePaste(e, idx, 'occupation')}
                        placeholder="व्यवसाय"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none focus:border-primary"
                      />
                    </td>

                    {/* CustomerType */}
                    <td className="p-0.5 border-r border-slate-200">
                      <select
                        value={row.customerType}
                        onChange={e => handleCellChange(row.id, 'customerType', e.target.value)}
                        className="w-full px-1 py-1 text-xs border border-slate-300 rounded-xs bg-white focus:outline-none"
                      >
                        <option value="Individual">व्यक्ती (Individual)</option>
                        <option value="Proprietorship">एकल व्यापारी</option>
                        <option value="Partnership">भागीदारी संस्था</option>
                        <option value="PvtLtd">Pvt Ltd कंपनी</option>
                        <option value="Society">सहकारी संस्था</option>
                        <option value="Trust">विश्वस्त संस्था</option>
                        <option value="SHG">बचत गट</option>
                        <option value="HUF">HUF</option>
                      </select>
                    </td>

                    {/* KYCStatus */}
                    <td className="p-0.5 border-r border-slate-200">
                      <select
                        value={row.kycStatus}
                        onChange={e => handleCellChange(row.id, 'kycStatus', e.target.value)}
                        className="w-full px-1 py-1 text-xs border border-slate-300 rounded-xs bg-white focus:outline-none"
                      >
                        <option value="Verified">Verified</option>
                        <option value="Pending">Pending</option>
                        <option value="ReKYCDue">ReKYCDue</option>
                      </select>
                    </td>

                    {/* CKYCNo */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        maxLength={14}
                        value={row.ckycNo}
                        onChange={e => handleCellChange(row.id, 'ckycNo', e.target.value.replace(/\D/g, ''))}
                        onPaste={e => handlePaste(e, idx, 'ckycNo')}
                        placeholder="14 अंकी CKYC"
                        className="w-full px-1.5 py-1 text-xs font-mono border border-slate-300 rounded-xs focus:outline-none"
                      />
                    </td>

                    {/* RiskCategory */}
                    <td className="p-0.5 border-r border-slate-200">
                      <select
                        value={row.riskCategory}
                        onChange={e => handleCellChange(row.id, 'riskCategory', e.target.value)}
                        className="w-full px-1 py-1 text-xs border border-slate-300 rounded-xs bg-white focus:outline-none"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </td>

                    {/* NomineeName */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.nomineeName}
                        onChange={e => handleCellChange(row.id, 'nomineeName', e.target.value)}
                        placeholder="वारसदार नाव"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none"
                      />
                    </td>

                    {/* NomineeRelation */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.nomineeRelation}
                        onChange={e => handleCellChange(row.id, 'nomineeRelation', e.target.value)}
                        placeholder="नाते"
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none"
                      />
                    </td>

                    {/* LegacyCustomerNo */}
                    <td className="p-0.5 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.legacyCustomerNo}
                        onChange={e => handleCellChange(row.id, 'legacyCustomerNo', e.target.value)}
                        placeholder="जुना ग्राहक क्र."
                        className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded-xs focus:outline-none"
                      />
                    </td>

                    {/* Delete Action */}
                    <td className="p-1 text-center">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
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
      </div>

      {/* 🏁 Bottom Sticky Action Summary Bar */}
      <div className="mt-3 bg-white border border-slate-200 rounded-md p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Info className="w-4 h-4 text-primary" />
          <span>
            <strong>टीप:</strong> केवळ वैध असलेले <strong>{validRows}</strong> ग्राहक जतन केले जातील. विद्यमान ग्राहकांचे जुने CustomerID व CIF सुरक्षित ठेवून बदल सेव्ह केले जातात.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToCustomers && (
            <button
              onClick={onNavigateToCustomers}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded border border-slate-300 cursor-pointer transition"
            >
              📋 ग्राहक यादी पहा
            </button>
          )}

          <button
            onClick={() => handleBulkSave(true)}
            disabled={isSaving || validRows === 0}
            className={`px-5 py-2 rounded text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer ${
              validRows > 0 && !isSaving
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
                <span>सर्व वैध ग्राहक जतन करा ({validRows})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 📥 MODAL: LOAD EXISTING CUSTOMERS FOR BULK EDIT */}
      {showExistingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-5 border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-100 text-sky-800 rounded">
                  <FolderDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    विद्यमान ग्राहक डेटा लोड करा (Bulk Edit Customers)
                  </h3>
                  <p className="text-xs text-slate-500">
                    डेटाबेसमधून ग्राहक निवडून ग्रिडमध्ये आणा आणि त्यांचे नाव, पत्ता किंवा संपर्क माहिती एकाच वेळी अपडेट करा.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExistingModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={existingSearch}
                    onChange={e => setExistingSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchExistingCustomers()}
                    placeholder="नाव, मोबाईल, आधार, पॅन किंवा CIF ने शोधा..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  />
                </div>
                <button
                  onClick={fetchExistingCustomers}
                  disabled={isLoadingExisting}
                  className="px-3 py-1.5 bg-primary text-white font-bold rounded cursor-pointer hover:opacity-90 flex items-center gap-1"
                >
                  {isLoadingExisting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  <span>शोधा</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={existingOnlyIncomplete}
                    onChange={e => setExistingOnlyIncomplete(e.target.checked)}
                    className="rounded text-primary"
                  />
                  <span>केवळ अपूर्ण माहिती असलेले (Missing Data)</span>
                </label>

                <div className="flex items-center gap-1 text-slate-500">
                  <span>मर्यादा:</span>
                  <select
                    value={existingLimit}
                    onChange={e => setExistingLimit(Number(e.target.value))}
                    className="border border-slate-300 rounded px-1.5 py-1 bg-white"
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

            {/* Customers Preview Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md mb-3 max-h-[48vh]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={existingCustomersList.length > 0 && selectedExistingIds.size === existingCustomersList.length}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedExistingIds(new Set(existingCustomersList.map(c => c.customerID)));
                          } else {
                            setSelectedExistingIds(new Set());
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="p-2 w-24">CIF क्रमांक</th>
                    <th className="p-2">ग्राहकाचे पूर्ण नाव</th>
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
                        <span>ग्राहक यादी लोड होत आहे...</span>
                      </td>
                    </tr>
                  ) : existingCustomersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        कोणतेही ग्राहक सापडले नाहीत. कृपया शोध निकष तपासा.
                      </td>
                    </tr>
                  ) : (
                    existingCustomersList.map(c => {
                      const isChecked = selectedExistingIds.has(c.customerID);
                      return (
                        <tr
                          key={c.customerID}
                          className={`hover:bg-slate-50 cursor-pointer ${isChecked ? 'bg-sky-50/40' : ''}`}
                          onClick={() => {
                            setSelectedExistingIds(prev => {
                              const next = new Set(prev);
                              if (next.has(c.customerID)) next.delete(c.customerID);
                              else next.add(c.customerID);
                              return next;
                            });
                          }}
                        >
                          <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedExistingIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(c.customerID)) next.delete(c.customerID);
                                  else next.add(c.customerID);
                                  return next;
                                });
                              }}
                              className="rounded"
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

            {/* Modal Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
              <div className="text-slate-600 font-medium">
                निवडलेले ग्राहक: <strong className="text-sky-800 font-black">{selectedExistingIds.size}</strong> / {existingCustomersList.length}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExistingModal(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded cursor-pointer transition"
                >
                  रद्द करा
                </button>
                <button
                  onClick={() => handleLoadExistingIntoGrid('append')}
                  disabled={selectedExistingIds.size === 0}
                  className={`px-3 py-1.5 rounded font-bold transition cursor-pointer ${
                    selectedExistingIds.size > 0
                      ? 'bg-sky-600 hover:bg-sky-700 text-white'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title="सध्याच्या ग्रिडमध्ये या ग्राहकांना पुढे जोडा"
                >
                  ग्रिडमध्ये जोडा (+ Append)
                </button>
                <button
                  onClick={() => handleLoadExistingIntoGrid('replace')}
                  disabled={selectedExistingIds.size === 0}
                  className={`px-3.5 py-1.5 rounded font-bold transition cursor-pointer ${
                    selectedExistingIds.size > 0
                      ? 'bg-primary hover:opacity-90 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title="सध्याचा ग्रिड रिकामा करून फक्त हेच ग्राहक लोड करा"
                >
                  ग्रिड बदला (Replace Grid)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🎉 SUCCESS / BATCH RESULT MODAL */}
      {saveResultModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-slate-900 mb-1">
              ग्राहक बल्क व्यवहार यशस्वी!
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              डेटाबेसमध्ये सर्व बदल यशस्वीरित्या जतन झाले आहेत.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-4 text-xs text-left space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">बॅच क्रमांक:</span>
                <span className="font-bold text-slate-800 font-mono">{saveResultModal.batchNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">नवीन नोंदलेले ग्राहक (Inserted):</span>
                <span className="font-black text-emerald-700">{saveResultModal.importedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">अद्ययावत केलेले ग्राहक (Updated):</span>
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
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded cursor-pointer transition"
              >
                पुढील नोंदणी करा
              </button>
              {onNavigateToCustomers && (
                <button
                  onClick={() => {
                    setSaveResultModal(null);
                    onNavigateToCustomers();
                  }}
                  className="px-4 py-1.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded cursor-pointer transition shadow-xs"
                >
                  📋 ग्राहक यादी पहा
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

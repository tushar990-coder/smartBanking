import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { toast } from 'react-hot-toast';
import {
  Coins,
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
  User,
  CheckCircle2,
  Printer,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Upload,
  Download
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import { getCachedMasterArray, safeArray } from '../utils/apiCache';
import * as XLSX from 'xlsx';

export default function PigmyOpeningBalance() {
  const [customers, setCustomers] = useState<any[]>(
    () => getCachedMasterArray<any>('/api/Customers')
  );
  const [schemes, setSchemes] = useState<any[]>(
    () => getCachedMasterArray<any>('/api/PigmySchemes')
  );
  const [agents, setAgents] = useState<any[]>(
    () => getCachedMasterArray<any>('/api/PigmyAgents')
  );
  const [financialYears, setFinancialYears] = useState<any[]>(
    () => getCachedMasterArray<any>('/api/FinancialYears')
  );
  const [migratedAccounts, setMigratedAccounts] = useState<any[]>(
    () => getCachedMasterArray<any>('/api/PigmyAccounts')
  );
  const [showMigratedModal, setShowMigratedModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [successModalData, setSuccessModalData] = useState<any | null>(null);
  const [glRecon, setGlRecon] = useState<any | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [excelImportPreview, setExcelImportPreview] = useState<{
    fileName: string;
    rows: Array<{
      rowNumber: number;
      customerCif: string;
      customerID?: number;
      customerName: string;
      schemeCodeOrName: string;
      pigmySchemeID?: number;
      schemeName: string;
      agentCodeOrName: string;
      pigmyAgentID?: number;
      agentName: string;
      legacyAccountNumber: string;
      openingDate: string;
      openingBalance: number;
      dailyDepositAmount: number;
      financialYear: string;
      asOfDate: string;
      isValid: boolean;
      error?: string;
    }>;
    schemeSummary: Array<{ schemeId: number; schemeName: string; count: number; totalBalance: number }>;
  } | null>(null);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const balanceInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    customerID: '',
    branchID: '1',
    pigmySchemeID: '',
    pigmyAgentID: '',
    legacyAccountNumber: '',
    openingDate: new Date().toISOString().split('T')[0],
    openingBalance: '',
    financialYear: '2025-2026',
    asOfDate: new Date().toISOString().split('T')[0]
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMasters();
    const timer = setTimeout(() => {
      fetchMigratedAccounts();
      fetchGlReconciliation();
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  const fetchGlReconciliation = async () => {
    try {
      setReconciling(true);
      const res = await api.get('/api/PigmyAccounts/GlReconciliation');
      if (res.data) setGlRecon(res.data);
    } catch (error) {
      console.error('Failed to fetch Pigmy GL reconciliation', error);
    } finally {
      setReconciling(false);
    }
  };

  const handleSyncAllGl = async () => {
    try {
      setReconciling(true);
      const res = await api.post('/api/PigmyAccounts/SyncAllGlOpeningBalances');
      toast.success(res.data?.message || 'पिग्मी खतावणी यशस्वीरीत्या सिंक झाली!');
      await Promise.all([fetchGlReconciliation(), fetchMigratedAccounts()]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'सिंक करताना त्रुटी आली.');
    } finally {
      setReconciling(false);
    }
  };

  const computeAsOfDateFromStartDate = (startDateStr: string): string => {
    if (!startDateStr) return '';
    try {
      const d = new Date(startDateStr);
      if (isNaN(d.getTime())) return '';
      d.setDate(d.getDate() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const fetchMasters = async () => {
    try {
      const [schemesRes, agentsRes, yearsRes] = await Promise.all([
        api.get('/api/PigmySchemes'),
        api.get('/api/PigmyAgents'),
        api.get('/api/FinancialYears')
      ]);

      setSchemes(safeArray(schemesRes.data));
      setAgents(safeArray(agentsRes.data));
      const yearsList = safeArray(yearsRes.data);
      if (yearsList.length > 0) {
        const sortedYears = [...yearsList].sort((a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        setFinancialYears(sortedYears);

        // Find the earliest created year or active year
        const initialYear = sortedYears.find((y: any) => y.isActive) || sortedYears[0];
        const computedAsOfDate = computeAsOfDateFromStartDate(initialYear.startDate);

        setFormData(prev => ({
          ...prev,
          financialYear: initialYear.yearCode || '2025-2026',
          asOfDate: computedAsOfDate || prev.asOfDate,
          openingDate: computedAsOfDate || prev.openingDate
        }));
      }

      setTimeout(async () => {
        try {
          const customersRes = await api.get('/api/Customers');
          setCustomers(safeArray(customersRes.data));
        } catch (bgErr) {
          console.error('Failed to fetch customers in background', bgErr);
        }
      }, 40);
    } catch (error) {
      console.error('Failed to fetch masters', error);
      toast.error('मास्टर डेटा लोड करताना त्रुटी आली.');
    }
  };

  const handleFinancialYearChange = (yearCode: string) => {
    const matchedYear = safeArray(financialYears).find(y => y.yearCode === yearCode);
    if (matchedYear) {
      const computedAsOfDate = computeAsOfDateFromStartDate(matchedYear.startDate);
      setFormData(prev => ({
        ...prev,
        financialYear: matchedYear.yearCode,
        asOfDate: computedAsOfDate || prev.asOfDate,
        openingDate: computedAsOfDate || prev.openingDate
      }));
    } else {
      setFormData(prev => ({ ...prev, financialYear: yearCode }));
    }
  };

  const fetchMigratedAccounts = async () => {
    try {
      const res = await api.get('/api/PigmyAccounts');
      setMigratedAccounts(safeArray(res.data));
    } catch (error) {
      console.error('Failed to fetch migrated accounts', error);
    }
  };

  const resetForm = () => {
    setEditingAccountId(null);
    const yearsList = safeArray(financialYears);
    const initialYear = yearsList.length > 0 ? (yearsList.find((y: any) => y.isActive) || yearsList[0]) : null;
    const computedAsOfDate = initialYear ? computeAsOfDateFromStartDate(initialYear.startDate) : new Date().toISOString().split('T')[0];

    setFormData({
      customerID: '',
      branchID: '1',
      pigmySchemeID: '',
      pigmyAgentID: '',
      legacyAccountNumber: '',
      openingDate: computedAsOfDate,
      openingBalance: '',
      financialYear: initialYear ? initialYear.yearCode : '2025-2026',
      asOfDate: computedAsOfDate
    });
  };

  const handleEdit = (acc: any) => {
    setEditingAccountId(acc.pigmyAccountID);
    setFormData({
      customerID: String(acc.customerID || ''),
      branchID: String(acc.branchID || '1'),
      pigmySchemeID: String(acc.pigmySchemeID || ''),
      pigmyAgentID: String(acc.pigmyAgentID || ''),
      legacyAccountNumber: acc.legacyAccountNumber || '',
      openingDate: acc.openingDate ? acc.openingDate.split('T')[0] : new Date().toISOString().split('T')[0],
      openingBalance: String(acc.openingBalance !== undefined && acc.openingBalance !== null && acc.openingBalance !== '' ? acc.openingBalance : (acc.totalDepositedAmount || '')),
      financialYear: acc.financialYear || '2025-2026',
      asOfDate: acc.asOfDate ? acc.asOfDate.split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setShowMigratedModal(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      balanceInputRef.current?.focus();
      balanceInputRef.current?.select();
    }, 150);
  };

  const handleDelete = async (id: number, accNo: string) => {
    if (!window.confirm(`तुम्हाला खरोखर पिग्मी खाते '${accNo}' डिलीट करायचे आहे का?`)) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/api/PigmyAccounts/${id}?force=true`);
      toast.success(`पिग्मी खाते '${accNo}' यशस्वीरीत्या डिलीट झाले.`);
      setMigratedAccounts(prev => prev.filter(a => a.pigmyAccountID !== id));
      if (editingAccountId === id) {
        resetForm();
      }
      Promise.all([fetchMigratedAccounts(), fetchGlReconciliation()]).catch(() => {});
    } catch (error: any) {
      console.error('Error deleting account', error);
      toast.error(error.response?.data?.message || 'खाते डिलीट करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const maxAllowedOpeningDate = React.useMemo(() => {
    if (formData.asOfDate) return formData.asOfDate;
    const matchedYear = safeArray(financialYears).find(y => y.yearCode === formData.financialYear);
    if (matchedYear && matchedYear.startDate) {
      return computeAsOfDateFromStartDate(matchedYear.startDate);
    }
    return '2026-03-31';
  }, [formData.asOfDate, formData.financialYear, financialYears]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerID) return toast.error('कृपया खातेदार निवडा.');
    if (!formData.pigmySchemeID) return toast.error('कृपया पिग्मी योजना निवडा.');
    if (!formData.pigmyAgentID) return toast.error('कृपया एजंट निवडा.');
    if (!formData.openingDate) return toast.error('कृपया मूळ उघडल्याची तारीख निवडा.');

    if (maxAllowedOpeningDate && formData.openingDate > maxAllowedOpeningDate) {
      const formattedMax = maxAllowedOpeningDate.split('-').reverse().join('/');
      return toast.error(`मूळ उघडल्याची तारीख ${formattedMax} (आर्थिक वर्षाच्या आरंभा) नंतरची असू शकत नाही.`);
    }

    setLoading(true);
    try {
      const payload = {
        customerID: parseInt(formData.customerID),
        branchID: parseInt(formData.branchID),
        pigmySchemeID: parseInt(formData.pigmySchemeID),
        pigmyAgentID: parseInt(formData.pigmyAgentID),
        legacyAccountNumber: formData.legacyAccountNumber.trim() || null,
        openingDate: formData.openingDate || formData.asOfDate,
        openingBalance: parseFloat(formData.openingBalance || '0'),
        financialYear: formData.financialYear || null,
        asOfDate: formData.asOfDate || null
      };

      const customerObj = safeArray(customers).find(c => String(c.customerID || c.id) === String(formData.customerID));
      const schemeObj = safeArray(schemes).find(s => String(s.pigmySchemeID || s.id) === String(formData.pigmySchemeID));
      const agentObj = safeArray(agents).find(a => String(a.pigmyAgentID || a.id) === String(formData.pigmyAgentID));

      if (editingAccountId) {
        await api.put(`/api/PigmyAccounts/${editingAccountId}`, {
          pigmyAccountID: editingAccountId,
          totalDepositedAmount: parseFloat(formData.openingBalance || '0'),
          ...payload
        });
        const updatedAccount = safeArray(migratedAccounts).find(a => a.pigmyAccountID === editingAccountId);
        const accNo = updatedAccount?.accountNo || `PG-${editingAccountId}`;
        setSuccessModalData({
          isEdit: true,
          accountNo: format14DigitDisplay(accNo),
          legacyAccountNumber: formData.legacyAccountNumber.trim() || '-',
          customerName: customerObj ? `${customerObj.firstName || ''} ${customerObj.middleName ? customerObj.middleName + ' ' : ''}${customerObj.lastName || ''}`.trim() : 'खातेदार',
          cifNo: customerObj?.cifNo || '-',
          mobileNo: customerObj?.mobileNo || '-',
          schemeName: schemeObj?.schemeName || 'पिग्मी योजना',
          interestRate: schemeObj?.interestRate || 0,
          agentName: agentObj?.agentName || 'एजंट',
          openingBalance: parseFloat(formData.openingBalance || '0'),
          financialYear: formData.financialYear,
          asOfDate: formData.asOfDate,
          openingDate: formData.openingDate
        });
        const updatedLeg = formData.legacyAccountNumber.trim() || null;
        setMigratedAccounts(prev => prev.map(a => a.pigmyAccountID === editingAccountId ? {
          ...a,
          legacyAccountNumber: updatedLeg,
          oldAccountNo: updatedLeg,
          pigmyAgentID: parseInt(formData.pigmyAgentID),
          pigmySchemeID: parseInt(formData.pigmySchemeID),
          openingDate: formData.openingDate || formData.asOfDate || a.openingDate,
          totalDepositedAmount: parseFloat(formData.openingBalance || '0'),
          openingBalance: parseFloat(formData.openingBalance || '0'),
          financialYear: formData.financialYear || a.financialYear,
          asOfDate: formData.asOfDate || a.asOfDate,
          pigmyAgent: agentObj || a.pigmyAgent,
          pigmyScheme: schemeObj || a.pigmyScheme
        } : a));
        toast.success('पिग्मी खाते माहिती यशस्वीरीत्या अद्ययावत केली!');
      } else {
        const response = await api.post('/api/PigmyAccounts/Migrate', payload);
        const rawAccountNo = response.data?.accountNo || '';
        const displayAccNo = response.data?.formattedAccountNo || format14DigitDisplay(rawAccountNo) || rawAccountNo || 'नोंदणीकृत';
        setSuccessModalData({
          isEdit: false,
          accountNo: displayAccNo,
          legacyAccountNumber: formData.legacyAccountNumber.trim() || '-',
          customerName: customerObj ? `${customerObj.firstName || ''} ${customerObj.middleName ? customerObj.middleName + ' ' : ''}${customerObj.lastName || ''}`.trim() : 'खातेदार',
          cifNo: customerObj?.cifNo || '-',
          mobileNo: customerObj?.mobileNo || '-',
          schemeName: schemeObj?.schemeName || 'पिग्मी योजना',
          interestRate: schemeObj?.interestRate || 0,
          agentName: agentObj?.agentName || 'एजंट',
          openingBalance: parseFloat(formData.openingBalance || '0'),
          financialYear: formData.financialYear,
          asOfDate: formData.asOfDate,
          openingDate: formData.openingDate
        });
        toast.success(`पिग्मी खाते यशस्वीरीत्या स्थलांतरित झाले! खाते क्र.: ${displayAccNo}`);
        fetchMigratedAccounts();
      }

      resetForm();
      fetchGlReconciliation();
    } catch (error: any) {
      console.error('Error migrating account', error);
      const errMsg = error.response?.data?.message || error.response?.data || 'खाते स्थलांतर करताना त्रुटी आली.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredAccounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredAccounts.map((acc, i) => ({
      'अ.क्र.': i + 1,
      'खाते क्र.': acc.accountNo,
      'जुना खाते क्र.': acc.legacyAccountNumber || '-',
      'खातेदार CIF': acc.customer?.cifNo || '-',
      'खातेदाराचे नाव': acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : '-',
      'पिग्मी योजना': acc.pigmyScheme?.schemeName || '-',
      'एजंटचे नाव': acc.pigmyAgent?.agentName || '-',
      'आरंभिक शिल्लक (₹)': (acc.openingBalance !== undefined && acc.openingBalance !== null && acc.openingBalance !== '') ? acc.openingBalance : (acc.totalDepositedAmount || 0),
      'उघडल्याचा दिनांक': acc.openingDate ? acc.openingDate.split('T')[0] : '-',
      'स्थिती': acc.status || 'Active'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PigmyOpeningBalances');
    XLSX.writeFile(wb, `Pigmy_Opening_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const parseExcelImportDate = (val: any, fallback: string): string => {
    if (val === undefined || val === null || val === '') return fallback;
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof val === 'number' && val > 20000) {
      const utcDays = Math.floor(val - 25569);
      const dt = new Date(utcDays * 86400 * 1000);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString().split('T')[0];
      }
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmy) {
      const d = String(parseInt(dmy[1], 10)).padStart(2, '0');
      const m = String(parseInt(dmy[2], 10)).padStart(2, '0');
      let y = parseInt(dmy[3], 10);
      if (y < 100) y += 2000;
      return `${y}-${m}-${d}`;
    }
    return fallback;
  };

  const handleDownloadImportTemplate = () => {
    const activeSchemes = safeArray(schemes).filter((s: any) => !s.status || s.status === 'Active');
    const activeAgents = safeArray(agents).filter((a: any) => !a.status || a.status === 'Active');
    const s1 = activeSchemes[0];
    const s2 = activeSchemes[1] || s1;
    const a1 = activeAgents[0];

    const sampleRows = [
      {
        'खातेदार CIF (Customer CIF)': 'CIF000001',
        'पिग्मी योजना (Pigmy Scheme - अनिवार्य)': s1 ? (s1.schemeCode ? `${s1.schemeCode} - ${s1.schemeName}` : s1.schemeName) : 'पिग्मी ठेव 1',
        'पिग्मी एजंट (Agent Name / ID)': a1 ? a1.agentName : 'Agent 1',
        'जुना खाते क्र. (Legacy A/c No)': '101',
        'उघडल्याचा दिनांक (Opening Date)': formData.asOfDate || '2026-03-31',
        'आरंभिक शिल्लक (Opening Balance)': 5000,
        'दैनिक रक्कम (Daily Deposit)': 100,
        'आर्थिक वर्ष (Financial Year)': formData.financialYear || '2025-2026',
        'शिल्लक दिनांक (As Of Date)': formData.asOfDate || '2026-03-31'
      },
      {
        'खातेदार CIF (Customer CIF)': 'CIF000002',
        'पिग्मी योजना (Pigmy Scheme - अनिवार्य)': s2 ? (s2.schemeCode ? `${s2.schemeCode} - ${s2.schemeName}` : s2.schemeName) : 'पिग्मी ठेव 2',
        'पिग्मी एजंट (Agent Name / ID)': a1 ? a1.agentName : 'Agent 1',
        'जुना खाते क्र. (Legacy A/c No)': '101',
        'उघडल्याचा दिनांक (Opening Date)': formData.asOfDate || '2026-03-31',
        'आरंभिक शिल्लक (Opening Balance)': 8000,
        'दैनिक रक्कम (Daily Deposit)': 200,
        'आर्थिक वर्ष (Financial Year)': formData.financialYear || '2025-2026',
        'शिल्लक दिनांक (As Of Date)': formData.asOfDate || '2026-03-31'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(sampleRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Pigmy_Opening_Import');

    const masterInfo = [
      ...activeSchemes.map((s: any) => ({
        'प्रकार': 'पिग्मी योजना (Scheme)',
        'ID': s.pigmySchemeID,
        'कोड (Code)': s.schemeCode || '-',
        'नाव (Name)': s.schemeName,
        'एक्सेलमध्ये लिहिण्याचे नाव': s.schemeCode ? `${s.schemeCode} - ${s.schemeName}` : s.schemeName
      })),
      ...activeAgents.map((a: any) => ({
        'प्रकार': 'पिग्मी एजंट (Agent)',
        'ID': a.pigmyAgentID,
        'कोड (Code)': a.username || `AGT-${a.pigmyAgentID}`,
        'नाव (Name)': a.agentName,
        'एक्सेलमध्ये लिहिण्याचे नाव': a.agentName
      }))
    ];
    const ws2 = XLSX.utils.json_to_sheet(masterInfo);
    XLSX.utils.book_append_sheet(wb, ws2, 'Schemes_&_Agents_Reference');

    XLSX.writeFile(wb, `Pigmy_MultiScheme_Opening_Template.xlsx`);
    toast.success('मल्टी-स्कीम पिग्मी एक्सेल टेम्पलेट डाउनलोड झाले!');
  };

  const handleImportExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          toast.error('एक्सेल शीटमध्ये डेटा आढळला नाही.');
          return;
        }

        const activeSchemes = safeArray(schemes).filter((s: any) => !s.status || s.status === 'Active');
        const activeAgents = safeArray(agents).filter((a: any) => !a.status || a.status === 'Active');
        const custList = safeArray(customers);
        const existingLegacySet = new Set<string>();
        safeArray(migratedAccounts).forEach((m: any) => {
          const sId = Number(m.pigmySchemeID || 0);
          const leg = String(m.legacyAccountNumber || m.oldAccountNo || '').trim().toUpperCase();
          if (sId > 0 && leg) existingLegacySet.add(`${sId}|${leg}`);
        });
        const fileLegacySet = new Set<string>();

        const parsedRows = rawRows.map((row, idx) => {
          const keys = Object.keys(row);
          const pick = (re: RegExp) => {
            const k = keys.find(key => re.test(key));
            return k ? row[k] : '';
          };

          const rawCif = String(pick(/cif|member|खातेदार.*कोड|customer/i) || '').trim();
          const rawScheme = String(pick(/योजना|scheme/i) || '').trim();
          const rawAgent = String(pick(/एजंट|agent/i) || '').trim();
          const rawLegacy = String(pick(/जुना|legacy|old/i) || '').trim();
          const rawOpDate = pick(/उघड|opening\s*date/i);
          const rawBal = parseFloat(String(pick(/शिल्लक|balance|opening\s*balance/i) || '0')) || 0;
          const rawDaily = parseFloat(String(pick(/दैनिक|daily/i) || '100')) || 100;
          const rawFy = String(pick(/वर्ष|financial|fy/i) || formData.financialYear || 'Legacy').trim();
          const rawAsOf = pick(/शिल्लक दिनांक|as\s*of/i);

          // Resolve Customer
          const lowerCif = rawCif.toLowerCase();
          const matchedCust = custList.find((c: any) =>
            (c.cifNo && String(c.cifNo).trim().toLowerCase() === lowerCif) ||
            (c.legacyCustomerNo && String(c.legacyCustomerNo).trim().toLowerCase() === lowerCif) ||
            String(c.customerID) === rawCif
          );

          // Resolve Scheme STRICTLY (Never default to Scheme 1)
          const lowerScheme = rawScheme.toLowerCase();
          const prefixScheme = rawScheme.split(/[-–|:]/)[0].trim().toLowerCase();
          const matchedScheme = rawScheme
            ? activeSchemes.find((s: any) =>
                (s.schemeCode && String(s.schemeCode).trim().toLowerCase() === lowerScheme) ||
                (s.schemeName && String(s.schemeName).trim().toLowerCase() === lowerScheme) ||
                String(s.pigmySchemeID) === rawScheme ||
                `${s.schemeCode || ''} - ${s.schemeName || ''}`.trim().toLowerCase() === lowerScheme ||
                (s.schemeCode && String(s.schemeCode).trim().toLowerCase() === prefixScheme) ||
                String(s.pigmySchemeID) === prefixScheme
              )
            : undefined;

          // Resolve Agent
          const lowerAgent = rawAgent.toLowerCase();
          const matchedAgent = rawAgent
            ? activeAgents.find((a: any) =>
                (a.agentName && String(a.agentName).trim().toLowerCase() === lowerAgent) ||
                (a.username && String(a.username).trim().toLowerCase() === lowerAgent) ||
                String(a.pigmyAgentID) === rawAgent ||
                `agt-${a.pigmyAgentID}` === lowerAgent
              )
            : undefined;

          const opDateStr = parseExcelImportDate(rawOpDate, formData.asOfDate || '2026-03-31');
          const asOfStr = parseExcelImportDate(rawAsOf, opDateStr);

          let err: string | undefined;
          if (!rawCif) err = 'खातेदार CIF रिकामा आहे';
          else if (custList.length > 0 && !matchedCust) err = `खातेदार '${rawCif}' सापडला नाही`;
          else if (!rawScheme) err = 'पिग्मी योजना अनिवार्य आहे (Default घेतली जाणार नाही)';
          else if (!matchedScheme) err = `योजना '${rawScheme}' सापडली नाही`;
          else if (!matchedScheme.pigmyLiabilityLedgerID) err = `योजना '${matchedScheme.schemeName}' ला देयता लेजर मॅप नाही`;
          else if (!rawAgent) err = 'पिग्मी एजंट रिकामा आहे';
          else if (!matchedAgent) err = `एजंट '${rawAgent}' सापडला नाही`;
          else if (rawBal < 0) err = 'शिल्लक 0 पेक्षा कमी असू शकत नाही';
          else if (rawLegacy && matchedScheme) {
            const legKey = `${matchedScheme.pigmySchemeID}|${rawLegacy.toUpperCase()}`;
            if (existingLegacySet.has(legKey)) {
              err = `जुना क्र. '${rawLegacy}' या योजनेत आधीच अस्तित्वात आहे`;
            } else if (fileLegacySet.has(legKey)) {
              err = `जुना क्र. '${rawLegacy}' या एक्सेल फाईलमध्ये दोनदा आला आहे`;
            } else {
              fileLegacySet.add(legKey);
            }
          }

          return {
            rowNumber: idx + 2,
            customerCif: rawCif,
            customerID: matchedCust?.customerID,
            customerName: matchedCust ? `${matchedCust.firstName || ''} ${matchedCust.lastName || ''}`.trim() : rawCif || '-',
            schemeCodeOrName: rawScheme,
            pigmySchemeID: matchedScheme?.pigmySchemeID,
            schemeName: matchedScheme?.schemeName || rawScheme || '(योजना नाही)',
            agentCodeOrName: rawAgent,
            pigmyAgentID: matchedAgent?.pigmyAgentID,
            agentName: matchedAgent?.agentName || rawAgent || '-',
            legacyAccountNumber: rawLegacy,
            openingDate: opDateStr,
            openingBalance: rawBal,
            dailyDepositAmount: rawDaily,
            financialYear: rawFy,
            asOfDate: asOfStr,
            isValid: !err,
            error: err
          };
        });

        const summaryMap = new Map<number, { schemeId: number; schemeName: string; count: number; totalBalance: number }>();
        parsedRows.filter(r => r.isValid && r.pigmySchemeID).forEach(r => {
          const sId = Number(r.pigmySchemeID);
          const cur = summaryMap.get(sId) || { schemeId: sId, schemeName: r.schemeName, count: 0, totalBalance: 0 };
          cur.count += 1;
          cur.totalBalance += Number(r.openingBalance || 0);
          summaryMap.set(sId, cur);
        });

        setExcelImportPreview({
          fileName: file.name,
          rows: parsedRows,
          schemeSummary: Array.from(summaryMap.values()).sort((a, b) => a.schemeId - b.schemeId)
        });
        setShowImportModal(true);
      } catch (err) {
        console.error('Pigmy opening Excel parse failed', err);
        toast.error('एक्सेल फाईल वाचताना त्रुटी आली.');
      } finally {
        if (importFileInputRef.current) importFileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmExcelImport = async () => {
    if (!excelImportPreview) return;
    const validRows = excelImportPreview.rows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('आयात करण्यासाठी वैध नोंदी नाहीत.');
      return;
    }
    if (excelImportPreview.rows.some(r => !r.isValid)) {
      toast.error('कृपया प्रथम एक्सेलमधील सर्व त्रुटी दुरुस्त करून पुन्हा अपलोड करा.');
      return;
    }

    setImportingExcel(true);
    try {
      const payload = {
        branchID: Number(formData.branchID || 1),
        financialYear: formData.financialYear,
        asOfDate: formData.asOfDate,
        rows: validRows.map(r => ({
          rowNumber: r.rowNumber,
          customerID: r.customerID || null,
          customerCif: r.customerCif,
          pigmySchemeID: r.pigmySchemeID || null,
          schemeCodeOrName: r.schemeCodeOrName,
          pigmyAgentID: r.pigmyAgentID || null,
          agentCodeOrName: r.agentCodeOrName,
          legacyAccountNumber: r.legacyAccountNumber,
          openingDate: r.openingDate,
          openingBalance: r.openingBalance,
          dailyDepositAmount: r.dailyDepositAmount,
          financialYear: r.financialYear,
          asOfDate: r.asOfDate
        }))
      };

      const res = await api.post('/api/PigmyAccounts/Import', payload);
      toast.success(res.data?.message || 'पिग्मी खाती यशस्वीरीत्या आयात झाली!');
      setShowImportModal(false);
      setExcelImportPreview(null);
      await Promise.all([fetchMigratedAccounts(), fetchGlReconciliation()]);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'एक्सेल आयात करताना त्रुटी आली.';
      toast.error(msg, { duration: 6000 });
    } finally {
      setImportingExcel(false);
    }
  };

  const formatCustomerLabel = (c: any) => {
    const cifPart = c.cifNo ? `[CIF: ${c.cifNo}] ` : '';
    return `${cifPart}${c.firstName} ${c.middleName ? c.middleName + ' ' : ''}${c.lastName}`;
  };

  const format14DigitDisplay = (accNo: string) => {
    if (!accNo) return '';
    const d = accNo.replace(/\D/g, '');
    if (d.length === 14) {
      return `${d.substring(0, 3)}-${d.substring(3, 6)}-${d.substring(6, 13)}-${d.substring(13, 14)}`;
    }
    return accNo;
  };

  const filteredAccounts = migratedAccounts.filter(acc => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const custName = acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}`.toLowerCase() : '';
    const cifNo = acc.customer?.cifNo ? acc.customer.cifNo.toLowerCase() : '';
    const accNo = acc.accountNo ? acc.accountNo.toLowerCase() : '';
    const formattedAccNo = format14DigitDisplay(acc.accountNo || '').toLowerCase();
    const previousAccNo = acc.previousAccountNo ? acc.previousAccountNo.toLowerCase() : '';
    const legacyAccNo = acc.legacyAccountNumber ? acc.legacyAccountNumber.toLowerCase() : '';
    const agentName = acc.pigmyAgent?.agentName ? acc.pigmyAgent.agentName.toLowerCase() : '';
    return accNo.includes(term) || formattedAccNo.includes(term) || previousAccNo.includes(term) || legacyAccNo.includes(term) || custName.includes(term) || cifNo.includes(term) || agentName.includes(term);
  });

  // KPI Calculations
  const totalBalance = migratedAccounts.reduce((sum, a) => sum + Number((a.openingBalance !== undefined && a.openingBalance !== null && a.openingBalance !== '') ? a.openingBalance : (a.totalDepositedAmount || 0)), 0);
  const activeAgentsCount = new Set(migratedAccounts.map(a => a.pigmyAgentID).filter(Boolean)).size;

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Coins size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>पिग्मी खाते सुरुवातीची शिल्लक स्थलांतर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Pigmy Opening Balance Migration)</span>
              {editingAccountId && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingAccountId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              ३१ मार्च पूर्वीच्या जुन्या पिग्मी खात्यांचा डेटा, एजंट मॅपिंग व सुरुवातीची शिल्लक स्थलांतर व्यवस्थापन
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
            onClick={handleDownloadImportTemplate}
            className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="मल्टी-स्कीम पिग्मी ओपनिंग एक्सेल टेम्पलेट डाउनलोड करा"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📥 एक्सेल सॅम्पल</span>
          </button>

          <button
            type="button"
            onClick={() => importFileInputRef.current?.click()}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="एकापेक्षा जास्त पिग्मी योजनांची खाती एक्सेलमधून आयात करा"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>📤 मल्टी-स्कीम एक्सेल आयात</span>
          </button>
          <input
            type="file"
            ref={importFileInputRef}
            onChange={handleImportExcelFile}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <button
            type="button"
            onClick={resetForm}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchMigratedAccounts();
              setShowMigratedModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व स्थलांतरित पिग्मी यादी पॉप-अप मध्ये पहा"
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
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण स्थलांतरित पिग्मी</div>
            <div className="text-sm font-black text-gray-900">{migratedAccounts.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण आरंभिक शिल्लक</div>
            <div className="text-sm font-black text-emerald-800">₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय एजंट्स (Active Agents)</div>
            <div className="text-sm font-black text-indigo-950">{activeAgentsCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">आर्थिक वर्ष व शिल्लक तारीख</div>
            <div className="text-xs font-black text-amber-800">
              {formData.financialYear} {formData.asOfDate ? `(${formData.asOfDate.split('-').reverse().join('/')} अखेर)` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time GL Reconciliation Banner */}
      <div className={`p-3 rounded-sm border shadow-xs mb-3 flex flex-wrap items-center justify-between gap-3 ${
        glRecon?.summary?.status === 'Reconciled' 
          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' 
          : 'bg-amber-50/80 border-amber-300 text-amber-950'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-xs ${
            glRecon?.summary?.status === 'Reconciled' ? 'bg-emerald-600' : 'bg-amber-600 animate-pulse'
          }`}>
            {glRecon?.summary?.status === 'Reconciled' ? '✓' : '!'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs tracking-tight">
                🏛️ मुख्य खतावणी व ताळेबंद ताळमेळ (GL & Balance Sheet Reconciliation):
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                glRecon?.summary?.status === 'Reconciled'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                  : 'bg-amber-100 text-amber-900 border-amber-400'
              }`}>
                {glRecon?.summary?.status === 'Reconciled' ? 'पूर्णतः जुळले (Reconciled) ✅' : 'तफावत (Pending)'}
              </span>
            </div>
            <div className="text-[11px] font-medium opacity-90 mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>उप-खाती एकूण: <b>₹{Number(glRecon?.summary?.slTotalMigratedBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr</b></span>
              <span>•</span>
              <span>मुख्य खतावणी (GL): <b>₹{Number(glRecon?.summary?.glLiabilityOpeningBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr</b></span>
              <span>•</span>
              <span>तफावत: <b>₹{Number(glRecon?.summary?.difference || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></span>
              <span>•</span>
              <span className="italic text-gray-600">{glRecon?.summary?.statusMessage || 'सर्व योजनांचा ताळमेळ सक्रिय आहे.'}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSyncAllGl}
          disabled={reconciling}
          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          title="सर्व पिग्मी योजनांची मुख्य खतावणी (GL) तेरीज व ताळेबंदशी पुन्हा ताडून सिंक करा"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${reconciling ? 'animate-spin text-primary' : ''}`} />
          <span>{reconciling ? 'सिंक होत आहे...' : '🔄 खतावणी रि-सिंक करा'}</span>
        </button>
      </div>

      {/* MAIN SINGLE UNIFIED FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          editingAccountId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Member, Scheme & Agent */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. खाते, योजना व एजंट तपशील (Account, Scheme & Agent Details)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-6 lg:col-span-6">
                <label className={labelClass}>
                  खातेदार निवडा (Customer) <span className="text-red-500">*</span>
                </label>
                <CustomerSearchSelect
                  customers={customers}
                  value={formData.customerID ? Number(formData.customerID) : ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, customerID: val ? String(val) : '' }))}
                  placeholder="-- खातेदार नाव, CIF किंवा मोबाईलने शोधा --"
                />
              </div>

              <div className="md:col-span-3 lg:col-span-3">
                <label className={labelClass}>
                  पिग्मी योजना (Pigmy Scheme) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className={inputClass}
                  value={formData.pigmySchemeID}
                  onChange={(e) => setFormData({ ...formData, pigmySchemeID: e.target.value })}
                >
                  <option value="">-- योजना निवडा --</option>
                  {schemes.map(s => (
                    <option key={s.pigmySchemeID} value={s.pigmySchemeID}>{s.schemeName} ({s.interestRate}%)</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 lg:col-span-3">
                <label className={labelClass}>
                  पिग्मी एजंट (Select Agent) <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className={inputClass}
                  value={formData.pigmyAgentID}
                  onChange={(e) => setFormData({ ...formData, pigmyAgentID: e.target.value })}
                >
                  <option value="">-- एजंट निवडा --</option>
                  {agents.map(a => (
                    <option key={a.pigmyAgentID} value={a.pigmyAgentID}>{a.agentName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Balance & Date Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <IndianRupee className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. शिल्लक व तारीख तपशील (Balance & Date Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>
                  जुना पिग्मी खाते क्र. <span className="text-gray-500 text-[10px] font-mono">(Old/Legacy A/c No)</span>
                </label>
                <input 
                  type="text" 
                  className={`${inputClass} font-mono font-bold text-gray-800`}
                  value={formData.legacyAccountNumber}
                  onChange={(e) => setFormData({ ...formData, legacyAccountNumber: e.target.value })}
                  placeholder="उदा. PG-45 किंवा 12"
                />
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                  (जुने पासबुक क्र. / जुना खाते क्र.)
                </span>
              </div>

              <div>
                <label className={labelClass}>
                  मूळ उघडल्याची तारीख (Opening Date) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  required
                  max={maxAllowedOpeningDate}
                  className={inputClass}
                  value={formData.openingDate}
                  onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                />
                {maxAllowedOpeningDate && (
                  <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                    (जास्तीत जास्त: {maxAllowedOpeningDate.split('-').reverse().join('/')} पर्यंत)
                  </span>
                )}
              </div>

              <div>
                <label className={labelClass}>३१ मार्च ची शिल्लक रक्कम (Balance ₹) <span className="text-red-500">*</span></label>
                <input 
                  ref={balanceInputRef}
                  type="number" 
                  step="0.01"
                  required
                  className={`${inputClass} font-mono font-bold text-emerald-700`}
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className={labelClass}>
                  शिल्लक तारीख (As Of Date) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date" 
                  required
                  className={`${inputClass} font-mono font-bold text-primary`}
                  value={formData.asOfDate}
                  onChange={(e) => setFormData({ ...formData, asOfDate: e.target.value })}
                />
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  * {formData.financialYear} चे ३१ मार्च अखेर
                </span>
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
              <span>{loading ? 'जतन होत आहे...' : editingAccountId ? 'बदल सेव्ह करा (Update)' : 'पिग्मी खाते स्थलांतर सेव्ह करा (Migrate Pigmy)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: MIGRATED PIGMY ACCOUNTS LIST                                */}
      {/* ========================================================================= */}
      {showMigratedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>स्थलांतरित पिग्मी खाती यादी (Migrated Pigmy Accounts List)</span>
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
                  placeholder="खाते क्र, जुना खाते क्र, CIF किंवा नावाने शोधा..." 
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

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={filteredAccounts.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="एक्सेल फाइल डाउनलोड करा"
              >
                <FileSpreadsheet size={13} />
                <span>एक्सेल एक्सपोर्ट</span>
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">कृती</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">खाते क्रमांक</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">सभासद नाव & कोड</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">पिग्मी योजना</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">एजंट नाव</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">आरंभिक शिल्लक (₹)</th>
                      <th className="px-2 py-1.5 text-center w-24">उघडल्याची तारीख</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredAccounts.map((acc) => (
                      <tr key={acc.pigmyAccountID} className="hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
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
                              onClick={() => handleDelete(acc.pigmyAccountID, acc.accountNo)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="खाते डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-mono font-bold text-primary">{acc.formattedAccountNo || format14DigitDisplay(acc.accountNo)}</div>
                          {acc.previousAccountNo && (
                            <div className="text-[10px] text-slate-500 font-mono">मागील: {acc.previousAccountNo}</div>
                          )}
                          {acc.legacyAccountNumber && (
                            <div className="text-[10px] text-amber-700 font-mono font-bold">जुना: {acc.legacyAccountNumber}</div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-900">{acc.customer ? `${acc.customer.firstName} ${acc.customer.lastName}` : `खातेदार ID: ${acc.customerID}`}</div>
                          <div className="text-[10px] text-gray-500 font-mono">CIF: {acc.customer?.cifNo || '-'}</div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-800">
                          {acc.pigmyScheme?.schemeName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-700">
                          {acc.pigmyAgent?.agentName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                          ₹{Number((acc.openingBalance !== undefined && acc.openingBalance !== null && acc.openingBalance !== '') ? acc.openingBalance : (acc.totalDepositedAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-gray-600">
                          {acc.openingDate ? new Date(acc.openingDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                      </tr>
                    ))}
                    {filteredAccounts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतेही स्थलांतरित पिग्मी खाते सापडले नाही.
                        </td>
                      </tr>
                    )}
                  </tbody>
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

      {/* ATTRACTIVE SUCCESS CONFIRMATION MODAL (छान आणि आकर्षक संदेश पेटी) */}
      {successModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header with Emerald Gradient */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex justify-between items-center relative overflow-hidden shadow-sm">
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-inner">
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-base tracking-tight">
                      {successModalData.isEdit ? 'पिग्मी खाते अद्ययावत केले!' : '🎉 पिग्मी खाते स्थलांतर यशस्वी!'}
                    </h3>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  </div>
                  <p className="text-[11px] text-emerald-100 font-medium">
                    {successModalData.isEdit ? 'Pigmy Account Updated Successfully' : 'Pigmy Opening Balance Migrated Successfully'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSuccessModalData(null)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white/90 hover:text-white transition-colors relative z-10 cursor-pointer"
                title="बंद करा"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body with Rich Metadata */}
            <div className="p-5 space-y-4 bg-slate-50/80 text-xs">
              
              {/* Highlight Card: Account Number & Balance */}
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/60 p-4 rounded-2xl border border-emerald-200/80 text-center space-y-1 shadow-2xs">
                <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest block">
                  स्थलांतरित पिग्मी खाते क्रमांक (Account No)
                </span>
                <div className="text-2xl font-black text-emerald-950 font-mono tracking-wider">
                  {successModalData.accountNo}
                </div>
                {successModalData.legacyAccountNumber && successModalData.legacyAccountNumber !== '-' && (
                  <div className="inline-block mt-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-xs rounded-full shadow-2xs">
                    जुना पिग्मी खाते क्र.: {successModalData.legacyAccountNumber}
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 rounded-full border border-emerald-300/80 shadow-2xs mt-1.5">
                  <span className="text-[11px] text-slate-500 font-semibold">आरंभिक शिल्लक (Opening Balance):</span>
                  <span className="text-sm font-black text-emerald-700 font-mono">
                    ₹ {successModalData.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* 2-Column Information Grid */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                
                {/* Row 1: Customer Name */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>खातेदाराचे नाव:</span>
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 text-xs">{successModalData.customerName}</span>
                    <span className="ml-1.5 px-1.5 py-0.5 bg-primary/10 text-primary font-mono text-[10px] font-bold rounded">
                      [CIF: {successModalData.cifNo}]
                    </span>
                  </div>
                </div>

                {/* Row 2: Scheme */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                    <span>पिग्मी योजना:</span>
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-slate-800">{successModalData.schemeName}</span>
                    <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold text-[10px] rounded">
                      {successModalData.interestRate}% व्याज
                    </span>
                  </div>
                </div>

                {/* Row 3: Agent */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>पिग्मी एजंट:</span>
                  </span>
                  <span className="font-bold text-slate-800">{successModalData.agentName}</span>
                </div>

                {/* Row 4: As Of Date & Financial Year */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>शिल्लक तारीख (As Of Date):</span>
                  </span>
                  <div className="text-right font-mono font-bold text-slate-900">
                    {successModalData.asOfDate ? successModalData.asOfDate.split('-').reverse().join('/') : '-'}
                    <span className="ml-1 text-[10px] text-gray-500 font-sans font-normal">
                      ({successModalData.financialYear} अखेर)
                    </span>
                  </div>
                </div>

              </div>

              {/* Success Info Footer Note */}
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/70 flex items-center gap-2 text-[11px] text-emerald-900 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>सदर खात्याची सुरुवातीची शिल्लक रोजकीर्द व तेरीज पत्रकात स्वयंचलित जोडली गेली आहे.</span>
              </div>
            </div>

            {/* Modal Footer Actions Bar */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>प्रिंट पावती</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessModalData(null);
                    fetchMigratedAccounts();
                    setShowMigratedModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>सर्व यादी पहा</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSuccessModalData(null);
                  setTimeout(() => {
                    balanceInputRef.current?.focus();
                  }, 100);
                }}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>➕ पुढील नवीन नोंद करा</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MULTI-SCHEME PIGMY EXCEL IMPORT PREVIEW                            */}
      {/* ========================================================================= */}
      {showImportModal && excelImportPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-emerald-700 text-white px-4 py-2.5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                <h2 className="text-sm font-bold">
                  मल्टी-स्कीम पिग्मी आरंभिक शिल्लक एक्सेल आयात ({excelImportPreview.fileName})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setExcelImportPreview(null); }}
                className="text-white/80 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-white border border-gray-300 font-bold">
                  एकूण ओळी: {excelImportPreview.rows.length}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                  ✓ वैध: {excelImportPreview.rows.filter(r => r.isValid).length}
                </span>
                {excelImportPreview.rows.some(r => !r.isValid) && (
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-900 border border-red-300 font-bold">
                    ✕ अवैध: {excelImportPreview.rows.filter(r => !r.isValid).length}
                  </span>
                )}
              </div>

              {excelImportPreview.schemeSummary.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {excelImportPreview.schemeSummary.map(ss => (
                    <span key={`imp-ss-${ss.schemeId}`} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold">
                      {ss.schemeName}: {ss.count} खाती (₹{ss.totalBalance.toLocaleString('en-IN')})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <table className="w-full text-left border-collapse text-[11px] bg-white border border-gray-200">
                <thead className="bg-slate-100 sticky top-0 text-gray-700 font-bold border-b border-gray-300">
                  <tr>
                    <th className="p-1.5 border-r border-gray-200 text-center">ओळ</th>
                    <th className="p-1.5 border-r border-gray-200">खातेदार (CIF)</th>
                    <th className="p-1.5 border-r border-gray-200">पिग्मी योजना</th>
                    <th className="p-1.5 border-r border-gray-200">एजंट</th>
                    <th className="p-1.5 border-r border-gray-200">जुना क्र.</th>
                    <th className="p-1.5 border-r border-gray-200 text-right">शिल्लक (₹)</th>
                    <th className="p-1.5">स्थिती / त्रुटी</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {excelImportPreview.rows.map((r) => (
                    <tr key={`imp-row-${r.rowNumber}`} className={r.isValid ? 'hover:bg-emerald-50/40' : 'bg-red-50'}>
                      <td className="p-1.5 border-r border-gray-200 text-center font-mono">{r.rowNumber}</td>
                      <td className="p-1.5 border-r border-gray-200">
                        <div className="font-bold text-gray-900">{r.customerName}</div>
                        <div className="text-[10px] font-mono text-gray-500">{r.customerCif}</div>
                      </td>
                      <td className="p-1.5 border-r border-gray-200">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
                          {r.schemeName}
                        </span>
                      </td>
                      <td className="p-1.5 border-r border-gray-200">{r.agentName}</td>
                      <td className="p-1.5 border-r border-gray-200 font-mono">{r.legacyAccountNumber || '-'}</td>
                      <td className="p-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                        ₹{r.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-1.5">
                        {r.isValid ? (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">✓ वैध</span>
                        ) : (
                          <span className="text-red-700 font-bold">❌ {r.error}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-white border-t border-gray-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setExcelImportPreview(null); }}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-bold cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={handleConfirmExcelImport}
                disabled={importingExcel || excelImportPreview.rows.some(r => !r.isValid) || excelImportPreview.rows.length === 0}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {importingExcel ? 'आयात सुरू आहे...' : `सर्व ${excelImportPreview.rows.filter(r => r.isValid).length} खाती आयात करा`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

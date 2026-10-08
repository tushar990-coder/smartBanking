import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Percent,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Plus,
  Save,
  Edit2,
  Trash2,
  Printer,
  FileSpreadsheet,
  Search,
  X,
  BookOpen,
  Layers,
  Landmark,
  Coins,
  ShieldCheck,
  Calendar,
  History
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
// @ts-ignore
import * as XLSX from 'xlsx';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountGroup?: {
    groupName?: string;
  };
}

interface LoanRate {
  loanRateID: number;
  loanType: string;
  loanCode: string;
  loanLedgerID: number | null;
  interestLedgerID: number | null;
  overdueInterestLedgerID: number | null;
  receivableInterestLedgerID: number | null;
  surchargeLedgerID: number | null;
  recoveryFeeLedgerID: number | null;
  processingFeeLedgerID: number | null;
  interestRate: number;
  overdueInterestRate: number;
  interestPostingType: string;
  interestPostingFrequency?: string;
  interestCalculationMethod: string;
  shortName: string;
  durationMonths: number;
  installmentType: string;
  installmentCount: number;
  loanInstallmentType: string;
  securityType: string;
  collateralCategory?: string;
  maxLtvPercentage?: number;
  isLienRequired?: boolean;
  isCollateralMandatoryForOpeningBalance?: boolean;
  isActive: boolean;
}

interface LoanRateHistory {
  historyID: number;
  loanRateID: number;
  loanCode: string;
  loanType: string;
  oldInterestRate: number;
  newInterestRate: number;
  oldOverdueRate: number;
  newOverdueRate: number;
  resolutionNo?: string;
  resolutionDate?: string;
  effectiveDate?: string;
  revisionReason?: string;
  changedBy?: string;
  changedAt: string;
}

interface LoanRateMasterProps {
  isReportOnly?: boolean;
}

export default function LoanRateMaster({ isReportOnly = false }: LoanRateMasterProps) {
  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [sansthaName, setSansthaName] = useState<string>('');
  const [sansthaAddress, setSansthaAddress] = useState<string>('');
  const [registrationNo, setRegistrationNo] = useState<string>('');
  const [registrationDate, setRegistrationDate] = useState<string>('');
  
  const [formData, setFormData] = useState({
    loanRateID: 0,
    loanType: 'तारणी',
    loanCode: '',
    loanLedgerID: '',
    interestLedgerID: '',
    overdueInterestLedgerID: '',
    receivableInterestLedgerID: '',
    surchargeLedgerID: '',
    recoveryFeeLedgerID: '',
    processingFeeLedgerID: '',
    interestRate: '',
    overdueInterestRate: '',
    interestPostingType: 'कर्जावर',
    interestPostingFrequency: 'मासिक (Monthly)',
    interestCalculationMethod: 'Flat (फ्लॅट)',
    shortName: '',
    durationMonths: '',
    installmentType: 'वार्षिक',
    installmentCount: '',
    loanInstallmentType: 'कर्जावरती',
    securityType: 'तारणी',
    collateralCategory: 'None',
    maxLtvPercentage: '85',
    isLienRequired: false,
    isCollateralMandatoryForOpeningBalance: false,
    isActive: true
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showList, setShowList] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const formContainerRef = useRef<HTMLDivElement>(null);
  const loanCodeInputRef = useRef<HTMLInputElement>(null);

  // Board Resolution & Rate Revision State (दोष क्र. ७)
  const [resolutionNo, setResolutionNo] = useState('');
  const [resolutionDate, setResolutionDate] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [revisionReason, setRevisionReason] = useState('');
  const [originalRates, setOriginalRates] = useState<{ interestRate: number; overdueInterestRate: number } | null>(null);

  // Rate Revision History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<LoanRateHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [selectedSchemeFilter, setSelectedSchemeFilter] = useState<string>('ALL');

  const API_URL = '/api/LoanRates';
  const LEDGER_API = '/api/Ledgers';
  const SANSTHA_API = '/api/SansthaDetails';

  useEffect(() => {
    fetchLoanRates();
    fetchLedgers();
    fetchSansthaDetails();
    fetchNextLoanCode();
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const response = await fetch(SANSTHA_API);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setSansthaName(data[0].sansthaName || 'सहकारी पतसंस्था मर्यादित');
          const fullAddr = [data[0].address, data[0].village ? `मु. ${data[0].village}` : '', data[0].taluka ? `ता. ${data[0].taluka}` : '', data[0].district ? `जि. ${data[0].district}` : ''].filter(Boolean).join(', ');
          setSansthaAddress(fullAddr);
          setRegistrationNo(data[0].registrationNo || '');
          setRegistrationDate(data[0].registrationDate || '');
        }
      }
    } catch (error) {
      console.error("Error fetching sanstha details", error);
    }
  };

  const fetchNextLoanCode = async () => {
    try {
      const res = await fetch(`${API_URL}/NextCode`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.nextCode) {
          setFormData(prev => ({ ...prev, loanCode: data.nextCode }));
        }
      }
    } catch (err) {
      console.error("Error fetching next loan code", err);
    }
  };

  const fetchLoanRates = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setLoanRates(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching loan rates", error);
      setLoanRates([]);
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await fetch(LEDGER_API);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          data.sort((a: Ledger, b: Ledger) => (a.ledgerName || '').localeCompare(b.ledgerName || ''));
          setLedgers(data);
        }
      }
    } catch (error) {
      console.error("Error fetching ledgers", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string; value: any } }) => {
    const name = e.target.name;
    if (!name) return;
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const fetchRevisionHistory = async (loanRateID?: number) => {
    setHistoryLoading(true);
    try {
      const url = loanRateID ? `${API_URL}/${loanRateID}/History` : `${API_URL}/AllHistory`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(Array.isArray(data) ? data : []);
      } else {
        setHistoryList([]);
      }
    } catch (err) {
      console.error("Error fetching rate history", err);
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const currentInterest = formData.interestRate ? parseFloat(formData.interestRate) : 0;
  const currentOverdue = formData.overdueInterestRate ? parseFloat(formData.overdueInterestRate) : 0;
  const isRateChanged = isEditing && originalRates !== null && (
    Math.abs(currentInterest - (originalRates.interestRate || 0)) > 0.0001 ||
    Math.abs(currentOverdue - (originalRates.overdueInterestRate || 0)) > 0.0001
  );

  const handleNew = () => {
    setFormData({
      loanRateID: 0,
      loanType: 'तारणी',
      loanCode: '',
      loanLedgerID: '',
      interestLedgerID: '',
      overdueInterestLedgerID: '',
      receivableInterestLedgerID: '',
      surchargeLedgerID: '',
      recoveryFeeLedgerID: '',
      processingFeeLedgerID: '',
      interestRate: '',
      overdueInterestRate: '',
      interestPostingType: 'कर्जावर',
      interestPostingFrequency: 'मासिक (Monthly)',
      interestCalculationMethod: 'Flat (फ्लॅट)',
      shortName: '',
      durationMonths: '',
      installmentType: 'वार्षिक',
      installmentCount: '',
      loanInstallmentType: 'कर्जावरती',
      securityType: 'तारणी',
      collateralCategory: 'None',
      maxLtvPercentage: '85',
      isLienRequired: false,
      isCollateralMandatoryForOpeningBalance: false,
      isActive: true
    });
    setIsEditing(false);
    setOriginalRates(null);
    setResolutionNo('');
    setResolutionDate(new Date().toISOString().split('T')[0]);
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setRevisionReason('');
    fetchNextLoanCode();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedType = (formData.loanType || '').trim();
    const trimmedCode = (formData.loanCode || '').trim();

    if (!trimmedType) {
      alert('कृपया कर्ज प्रकार निवडा.');
      return;
    }

    // Client-side unique check for LoanType
    const duplicateType = loanRates.find(r => 
      r.loanRateID !== (isEditing ? formData.loanRateID : 0) && 
      (r.loanType || '').trim().toLowerCase() === trimmedType.toLowerCase()
    );
    if (duplicateType) {
      alert(`कर्ज योजना प्रकार / नाव '${trimmedType}' आधीपासून अस्तित्वात आहे. कृपया वेगळे नाव द्या.`);
      return;
    }

    // Client-side unique check for LoanCode
    if (trimmedCode) {
      const duplicateCode = loanRates.find(r => 
        r.loanRateID !== (isEditing ? formData.loanRateID : 0) && 
        (r.loanCode || '').trim().toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        alert(`कर्ज योजना कोड '${trimmedCode}' आधीपासून योजना '${duplicateCode.loanType}' साठी वापरला आहे. कृपया दुसरा कोड वापरा.`);
        return;
      }
    }

    if (!formData.loanLedgerID || parseInt(formData.loanLedgerID) <= 0) {
      alert('कृपया कर्ज मुद्दल खाते (Loan Ledger) निवडणे अनिवार्य आहे.');
      return;
    }

    if (!formData.interestLedgerID || parseInt(formData.interestLedgerID) <= 0) {
      alert('कृपया कर्ज व्याज खाते (Interest Ledger) निवडणे अनिवार्य आहे.');
      return;
    }

    const isAccrue = formData.interestPostingType?.includes('येणे');
    if (isAccrue && (!formData.receivableInterestLedgerID || parseInt(formData.receivableInterestLedgerID) <= 0)) {
      alert("व्याज पोस्टींग प्रकार 'येणे व्याजावर' असताना 'येणे व्याज खाते (Receivable Interest Ledger)' निवडणे अनिवार्य आहे.");
      return;
    }

    // Validation for Board Resolution when interest rate changes (दोष क्र. ७)
    if (isEditing && isRateChanged) {
      if (!resolutionNo.trim()) {
        alert('⚠️ व्याजदरात किंवा थकीत दरात बदल केला आहे. सहकार ऑडिट मानकांनुसार संचालक मंडळाचा ठराव क्रमांक (Board Resolution No) भरणे अनिवार्य आहे.');
        return;
      }
      if (!resolutionDate) {
        alert('⚠️ कृपया संचालक मंडळ ठराव दिनांक (Resolution Date) निवडा.');
        return;
      }
      if (!effectiveDate) {
        alert('⚠️ कृपया नवीन व्याजदर लागू होण्याचा दिनांक (Effective Date) निवडा.');
        return;
      }
    }

    const payload = {
      loanRateID: isEditing ? formData.loanRateID : 0,
      loanType: formData.loanType,
      loanCode: formData.loanCode,
      loanLedgerID: formData.loanLedgerID ? parseInt(formData.loanLedgerID) : null,
      interestLedgerID: formData.interestLedgerID ? parseInt(formData.interestLedgerID) : null,
      overdueInterestLedgerID: formData.overdueInterestLedgerID ? parseInt(formData.overdueInterestLedgerID) : null,
      receivableInterestLedgerID: formData.receivableInterestLedgerID ? parseInt(formData.receivableInterestLedgerID) : null,
      surchargeLedgerID: formData.surchargeLedgerID ? parseInt(formData.surchargeLedgerID) : null,
      recoveryFeeLedgerID: formData.recoveryFeeLedgerID ? parseInt(formData.recoveryFeeLedgerID) : null,
      processingFeeLedgerID: formData.processingFeeLedgerID ? parseInt(formData.processingFeeLedgerID) : null,
      interestRate: formData.interestRate ? parseFloat(formData.interestRate) : 0,
      overdueInterestRate: formData.overdueInterestRate ? parseFloat(formData.overdueInterestRate) : 0,
      interestPostingType: formData.interestPostingType,
      interestPostingFrequency: formData.interestPostingFrequency,
      interestCalculationMethod: formData.interestCalculationMethod,
      shortName: formData.shortName,
      durationMonths: formData.durationMonths ? parseInt(formData.durationMonths) : 0,
      installmentType: formData.installmentType,
      installmentCount: formData.installmentCount ? parseInt(formData.installmentCount) : 0,
      loanInstallmentType: formData.loanInstallmentType,
      securityType: formData.securityType,
      collateralCategory: formData.collateralCategory,
      maxLtvPercentage: parseFloat(formData.maxLtvPercentage) || 85,
      isLienRequired: formData.isLienRequired,
      isCollateralMandatoryForOpeningBalance: formData.isCollateralMandatoryForOpeningBalance,
      isActive: formData.isActive,
      resolutionNo: isRateChanged ? resolutionNo.trim() : null,
      resolutionDate: isRateChanged ? resolutionDate : null,
      effectiveDate: isRateChanged ? effectiveDate : null,
      revisionReason: isRateChanged ? (revisionReason.trim() || 'संचालक मंडळ ठरावानुसार व्याजदर सुधारित') : null
    };

    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `${API_URL}/${formData.loanRateID}` : API_URL;
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert(isEditing ? 'कर्ज दर यशस्वीरीत्या अद्ययावत केला.' : 'नवीन कर्ज दर यशस्वीरीत्या सेव्ह केला.');
        fetchLoanRates();
        handleNew();
      } else if (response.status === 403) {
        alert('आपल्याकडे कर्ज योजना बदलण्याचे किंवा तयार करण्याचे अधिकार नाहीत (Access Denied). केवळ Admin किंवा Manager ही कृती करू शकतात.');
      } else if (response.status === 401) {
        alert('सत्र समाप्त झाले आहे (Session Expired). कृपया पुन्हा लॉगिन करा.');
      } else {
        const errData = await response.json().catch(() => null);
        alert(errData?.message || 'माहिती सेव्ह करताना त्रुटी आली.');
      }
    } catch (error) {
      console.error("Error saving loan rate", error);
      alert('सर्व्हर एरर! कृपया नंतर प्रयत्न करा.');
    }
  };

  const handleEdit = (rate: LoanRate) => {
    setFormData({
      loanRateID: rate.loanRateID,
      loanType: rate.loanType || 'तारणी',
      loanCode: rate.loanCode || '',
      loanLedgerID: rate.loanLedgerID?.toString() || '',
      interestLedgerID: rate.interestLedgerID?.toString() || '',
      overdueInterestLedgerID: rate.overdueInterestLedgerID?.toString() || '',
      receivableInterestLedgerID: rate.receivableInterestLedgerID?.toString() || '',
      surchargeLedgerID: rate.surchargeLedgerID?.toString() || '',
      recoveryFeeLedgerID: rate.recoveryFeeLedgerID?.toString() || '',
      processingFeeLedgerID: rate.processingFeeLedgerID?.toString() || '',
      interestRate: rate.interestRate?.toString() || '',
      overdueInterestRate: rate.overdueInterestRate?.toString() || '',
      interestPostingType: rate.interestPostingType && !rate.interestPostingType.includes('?') && !rate.interestPostingType.includes('à') 
        ? (rate.interestPostingType.startsWith('कर्ज') ? 'कर्जावर' : rate.interestPostingType.includes('येणे') ? 'येणे व्याजावर' : rate.interestPostingType) 
        : 'कर्जावर',
      interestPostingFrequency: rate.interestPostingFrequency && !rate.interestPostingFrequency.includes('?') && !rate.interestPostingFrequency.includes('à') ? rate.interestPostingFrequency : 'मासिक (Monthly)',
      interestCalculationMethod: rate.interestCalculationMethod && !rate.interestCalculationMethod.includes('?') && !rate.interestCalculationMethod.includes('à') ? rate.interestCalculationMethod : 'Reducing (घटती पद्धत)',
      shortName: rate.shortName || '',
      durationMonths: rate.durationMonths?.toString() || '',
      installmentType: rate.installmentType || 'वार्षिक',
      installmentCount: rate.installmentCount?.toString() || '',
      loanInstallmentType: rate.loanInstallmentType || 'कर्जावरती',
      securityType: rate.securityType || 'तारणी',
      collateralCategory: rate.collateralCategory || 'None',
      maxLtvPercentage: rate.maxLtvPercentage !== undefined ? rate.maxLtvPercentage.toString() : '85',
      isLienRequired: rate.isLienRequired || false,
      isCollateralMandatoryForOpeningBalance: rate.isCollateralMandatoryForOpeningBalance || false,
      isActive: rate.isActive
    });
    setOriginalRates({
      interestRate: rate.interestRate || 0,
      overdueInterestRate: rate.overdueInterestRate || 0
    });
    setResolutionNo('');
    setResolutionDate(new Date().toISOString().split('T')[0]);
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setRevisionReason('');
    setIsEditing(true);
    setShowList(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: number) => {
    if(window.confirm('तुम्हाला नक्की ही कर्ज योजना डिलीट करायची आहे का?')) {
      try {
        const response = await fetch(`${API_URL}/${id}`, {
          method: 'DELETE'
        });
        if(response.ok) {
          fetchLoanRates();
          handleNew();
        } else if (response.status === 403) {
          alert('आपल्याकडे कर्ज योजना डिलीट करण्याचे अधिकार नाहीत (Access Denied). केवळ Admin किंवा Manager ही कृती करू शकतात.');
        } else if (response.status === 401) {
          alert('सत्र समाप्त झाले आहे (Session Expired). कृपया पुन्हा लॉगिन करा.');
        } else {
          const errData = await response.json().catch(() => null);
          alert(errData?.message || 'ही योजना डिलीट करता आली नाही.');
        }
      } catch (error) {
        console.error("Error deleting loan rate", error);
      }
    }
  };

  const getLedgerName = (id: number | null) => {
    if (!id) return '-';
    const l = ledgers.find(x => x.ledgerID === id);
    return l ? l.ledgerName : '-';
  };

  const renderLedgerCell = (id: number | null) => {
    if (!id) {
      return (
        <span className="px-1.5 py-0.5 rounded-xs text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          ⚠️ न जोडलेले
        </span>
      );
    }
    const l = ledgers.find(x => x.ledgerID === id);
    return <span className="font-semibold text-gray-800">{l ? l.ledgerName : '-'}</span>;
  };

  const ledgerOptions = [
    { value: '', label: '-- खाते निवडा --' },
    ...(ledgers || []).map(l => ({
      value: l.ledgerID.toString(),
      label: `${l.ledgerID} - ${l.ledgerName}${l.accountGroup?.groupName ? ` (${l.accountGroup.groupName})` : ''}`
    }))
  ];

  const formatPercent = (val: any): string => {
    if (val === null || val === undefined || val === '') return '0.00%';
    const num = Number(val);
    return isNaN(num) ? '0.00%' : `${num.toFixed(2)}%`;
  };

  const filteredLoanRates = (loanRates || []).filter(r =>
    (r.loanType && r.loanType.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.loanCode && r.loanCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.shortName && r.shortName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.interestCalculationMethod && r.interestCalculationMethod.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExportExcel = () => {
    const excelRows = filteredLoanRates.map((rate, idx) => ({
      "अ.नं.": idx + 1,
      "कर्ज प्रकार": rate.loanType,
      "कोड": rate.loanCode || '-',
      "संक्षिप्त नाव": rate.shortName || '-',
      "तारणी प्रकार": rate.securityType || '-',
      "व्याजदर (%)": rate.interestRate ? `${rate.interestRate.toFixed(2)}%` : '0.00%',
      "थकीत दर (%)": rate.overdueInterestRate ? `${rate.overdueInterestRate.toFixed(2)}%` : '0.00%',
      "मुदत (महिने)": rate.durationMonths || 0,
      "हप्ता प्रकार": rate.installmentType || '-',
      "हप्ता संख्या": rate.installmentCount || 0,
      "कर्ज हप्ता प्रकार": rate.loanInstallmentType && !rate.loanInstallmentType.includes('?') && !rate.loanInstallmentType.includes('à') ? rate.loanInstallmentType : 'कर्जावरती',
      "व्याज आकारणी पद्धत": rate.interestCalculationMethod && !rate.interestCalculationMethod.includes('?') && !rate.interestCalculationMethod.includes('à') ? rate.interestCalculationMethod : 'Reducing (घटती पद्धत)',
      "पोस्टिंग वारंवारता": rate.interestPostingFrequency && !rate.interestPostingFrequency.includes('?') && !rate.interestPostingFrequency.includes('à') ? rate.interestPostingFrequency : 'मासिक (Monthly)',
      "पोस्टिंग प्रकार": rate.interestPostingType && !rate.interestPostingType.includes('?') && !rate.interestPostingType.includes('à') ? rate.interestPostingType : 'कर्जावर',
      "कर्ज खाते": getLedgerName(rate.loanLedgerID),
      "व्याज खाते": getLedgerName(rate.interestLedgerID),
      "थकीत व्याज खाते": getLedgerName(rate.overdueInterestLedgerID),
      "येणे व्याज खाते": getLedgerName(rate.receivableInterestLedgerID),
      "स्थिती": rate.isActive ? 'सक्रिय' : 'निष्क्रिय'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "कर्ज दर पत्रक");
    XLSX.writeFile(workbook, `Karj_Dar_Patrak_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredHistory = (historyList || []).filter(item => {
    const matchesScheme = selectedSchemeFilter === 'ALL' || item.loanRateID.toString() === selectedSchemeFilter;
    const matchesSearch = !historySearchTerm || (
      (item.loanType && item.loanType.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
      (item.loanCode && item.loanCode.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
      (item.resolutionNo && item.resolutionNo.toLowerCase().includes(historySearchTerm.toLowerCase())) ||
      (item.revisionReason && item.revisionReason.toLowerCase().includes(historySearchTerm.toLowerCase()))
    );
    return matchesScheme && matchesSearch;
  });

  const handleExportHistoryExcel = () => {
    const excelRows = filteredHistory.map((item, idx) => ({
      "अ.क्र.": idx + 1,
      "कर्ज प्रकार": item.loanType,
      "कोड": item.loanCode || '-',
      "जुना व्याजदर (%)": item.oldInterestRate !== undefined && item.oldInterestRate !== null ? `${item.oldInterestRate.toFixed(2)}%` : '0.00%',
      "नवीन व्याजदर (%)": item.newInterestRate !== undefined && item.newInterestRate !== null ? `${item.newInterestRate.toFixed(2)}%` : '0.00%',
      "जुना थकीत दर (%)": item.oldOverdueRate !== undefined && item.oldOverdueRate !== null ? `${item.oldOverdueRate.toFixed(2)}%` : '0.00%',
      "नवीन थकीत दर (%)": item.newOverdueRate !== undefined && item.newOverdueRate !== null ? `${item.newOverdueRate.toFixed(2)}%` : '0.00%',
      "ठराव क्रमांक": item.resolutionNo || '-',
      "ठराव दिनांक": item.resolutionDate ? new Date(item.resolutionDate).toLocaleDateString('en-GB') : '-',
      "लागू दिनांक": item.effectiveDate ? new Date(item.effectiveDate).toLocaleDateString('en-GB') : '-',
      "बदलाचे कारण": item.revisionReason || '-',
      "बदल दिनांक": item.changedAt ? new Date(item.changedAt).toLocaleString('en-GB') : '-',
      "ऑपरेटर": item.changedBy || 'System'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "व्याजदर बदल नोंदवही");
    XLSX.writeFile(workbook, `Vyajdar_Badal_Nondvahi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // KPI Calculations
  const activeCount = loanRates.filter(r => r.isActive).length;
  const avgInterestRate = loanRates.length > 0
    ? (loanRates.reduce((acc, r) => acc + (Number(r.interestRate) || 0), 0) / loanRates.length).toFixed(2)
    : '0.00';
  const avgOverdueRate = loanRates.length > 0
    ? (loanRates.reduce((acc, r) => acc + (Number(r.overdueInterestRate) || 0), 0) / loanRates.length).toFixed(2)
    : '0.00';

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  if (isReportOnly) {
    return (
      <div className="p-3 space-y-3 font-sans text-xs bg-gray-50 min-h-screen">
        {/* Top Banner & Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 rounded-sm shadow-sm border border-gray-200 no-print">
          <h1 className="text-base font-bold text-gray-800 tracking-wide flex items-center gap-2">
            <span className="w-2 h-4 bg-primary rounded-xs"></span>
            कर्ज दर पत्रक अहवाल (Loan Rate Master Report)
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-sm border border-gray-300">
              <span className="text-gray-600 font-bold text-[11px]">शोधा:</span>
              <input
                type="text"
                placeholder="प्रकार / कोड / संक्षिप्त नाव / पद्धत..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-2 py-0.5 text-xs text-gray-900 bg-white rounded-xs border border-gray-300 focus:outline-none w-48"
              />
            </div>
            <button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-sm shadow-xs transition-colors h-8 text-xs flex items-center gap-1 cursor-pointer"
            >
              🖨️ प्रिंट (Print)
            </button>
            <button
              onClick={handleExportExcel}
              className="bg-primary hover:opacity-90 text-white font-bold px-3 py-1.5 rounded-sm shadow-xs transition-colors h-8 text-xs flex items-center gap-1 cursor-pointer"
            >
              📊 एक्सेल (Excel Export)
            </button>
          </div>
        </div>

        {/* Report Content Document */}
        <div className="bg-white p-4 rounded-sm shadow-sm border border-gray-200">
          <div className="text-center mb-4 pb-2 border-b-2 border-gray-800">
            <div className="flex justify-between items-start text-[10px] font-bold mb-2">
              <div><span>रजि. नं. - </span><span className="font-mono">{registrationNo || '-'}</span></div>
              <div><span>रजि. दिनांक - </span><span className="font-mono">{registrationDate ? new Date(registrationDate).toLocaleDateString('en-GB') : '-'}</span></div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{sansthaName}</h1>
            <p className="text-sm text-gray-700 mb-4">{sansthaAddress}</p>
            
            <div className="flex justify-center items-center">
              <div className="border border-gray-400 px-6 py-1 shadow-sm font-bold text-gray-800 text-base bg-gray-50">
                कर्ज दर पत्रक अहवाल
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse whitespace-nowrap text-center border border-gray-800">
              <thead>
                <tr className="bg-gray-100 font-bold border-b border-gray-800 text-gray-900 divide-x divide-gray-800">
                  <th className="p-1.5 border border-gray-800 w-10">अ.नं.</th>
                  <th className="p-1.5 border border-gray-800 text-left pl-2">कर्ज प्रकार</th>
                  <th className="p-1.5 border border-gray-800 text-center">कोड</th>
                  <th className="p-1.5 border border-gray-800 text-left pl-2">संक्षिप्त नाव</th>
                  <th className="p-1.5 border border-gray-800 text-center">तारणी प्रकार</th>
                  <th className="p-1.5 border border-gray-800 text-right pr-2">व्याजदर (%)</th>
                  <th className="p-1.5 border border-gray-800 text-right pr-2">थकीत दर (%)</th>
                  <th className="p-1.5 border border-gray-800 text-center">मुदत (महिने)</th>
                  <th className="p-1.5 border border-gray-800 text-center">हप्ता प्रकार</th>
                  <th className="p-1.5 border border-gray-800 text-center">हप्ता संख्या</th>
                  <th className="p-1.5 border border-gray-800 text-center">कर्ज हप्ता प्रकार</th>
                  <th className="p-1.5 border border-gray-800 text-left pl-2">व्याज आकारणी पद्धत</th>
                  <th className="p-1.5 border border-gray-800 text-left pl-2">पोस्टिंग वारंवारता</th>
                  <th className="p-1.5 border border-gray-800 text-left pl-2">पोस्टिंग प्रकार</th>
                  <th className="p-1.5 border border-gray-800 text-left pl-2">कर्ज खाते</th>
                  <th className="p-1.5 border border-gray-800 text-left pl-2">व्याज खाते</th>
                  <th className="p-1.5 border border-gray-800 text-left pl-2">थकीत व्याज खाते</th>
                  <th className="p-1.5 border border-gray-800 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredLoanRates.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="p-6 text-center text-gray-500 italic border border-gray-800">
                      कोणतीही कर्ज दर नोंद उपलब्ध नाही.
                    </td>
                  </tr>
                ) : (
                  filteredLoanRates.map((rate, idx) => (
                    <tr key={rate.loanRateID} className="hover:bg-gray-50 border border-gray-800 divide-x divide-gray-800">
                      <td className="p-1.5 border border-gray-800 text-center font-medium">{idx + 1}</td>
                      <td className="p-1.5 border border-gray-800 text-left pl-2 font-bold text-primary">{rate.loanType}</td>
                      <td className="p-1.5 border border-gray-800 text-center font-mono font-bold">{rate.loanCode || '-'}</td>
                      <td className="p-1.5 border border-gray-800 text-left pl-2 font-semibold">{rate.shortName || '-'}</td>
                      <td className="p-1.5 border border-gray-800 text-center">{rate.securityType || '-'}</td>
                      <td className="p-1.5 border border-gray-800 text-right pr-2 font-bold text-emerald-700">
                        {formatPercent(rate.interestRate)}
                      </td>
                      <td className="p-1.5 border border-gray-800 text-right pr-2 font-bold text-red-600">
                        {formatPercent(rate.overdueInterestRate)}
                      </td>
                      <td className="p-1.5 border border-gray-800 text-center font-bold">{rate.durationMonths || 0}</td>
                      <td className="p-1.5 border border-gray-800 text-center">{rate.installmentType || '-'}</td>
                      <td className="p-1.5 border border-gray-800 text-center font-bold">{rate.installmentCount || 0}</td>
                      <td className="p-1.5 border border-gray-800 text-center">
                        {rate.loanInstallmentType && !rate.loanInstallmentType.includes('?') && !rate.loanInstallmentType.includes('à') ? rate.loanInstallmentType : 'कर्जावरती'}
                      </td>
                      <td className="p-1.5 border border-gray-800 text-left pl-2">
                        {rate.interestCalculationMethod && !rate.interestCalculationMethod.includes('?') && !rate.interestCalculationMethod.includes('à') ? rate.interestCalculationMethod : 'Reducing (घटती पद्धत)'}
                      </td>
                      <td className="p-1.5 border border-gray-800 text-left pl-2">
                        {rate.interestPostingFrequency && !rate.interestPostingFrequency.includes('?') && !rate.interestPostingFrequency.includes('à') ? rate.interestPostingFrequency : 'मासिक (Monthly)'}
                      </td>
                      <td className="p-1.5 border border-gray-800 text-left pl-2">
                        {rate.interestPostingType && !rate.interestPostingType.includes('?') && !rate.interestPostingType.includes('à') ? rate.interestPostingType : 'कर्जावर'}
                      </td>
                      <td className="p-1.5 border border-gray-800 text-left pl-2">{getLedgerName(rate.loanLedgerID)}</td>
                      <td className="p-1.5 border border-gray-800 text-left pl-2">{getLedgerName(rate.interestLedgerID)}</td>
                      <td className="p-1.5 border border-gray-800 text-left pl-2">{getLedgerName(rate.overdueInterestLedgerID)}</td>
                      <td className="p-1.5 border border-gray-800 text-center font-bold">
                        <span className={rate.isActive ? 'text-green-700' : 'text-red-600'}>
                          {rate.isActive ? 'सक्रिय' : 'निष्क्रिय'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

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
              <span>कर्ज दर पत्रक व नियम</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Loan Rate Master)</span>
              {isEditing && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.loanCode || formData.loanRateID})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              कर्ज प्रकार, व्याजदर, थकीत दर, हप्ते नियम, आकारणी वारंवारता व खातावणी लेजर मॅपिंग व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={handleNew}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleNew}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="प्रिंट करा"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>प्रिंट</span>
          </button>

          {/* RATE REVISION HISTORY BUTTON (दोष क्र. ७) */}
          <button
            type="button"
            onClick={() => {
              fetchRevisionHistory();
              setSelectedSchemeFilter('ALL');
              setShowHistoryModal(true);
            }}
            className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="सर्व व्याजदर बदल व संचालक मंडळ ठराव नोंदवही पहा"
          >
            <History className="w-3.5 h-3.5 text-amber-700" />
            <span>📜 दर बदल नोंदवही</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchLoanRates();
              setShowList(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व कर्ज दर पत्रक यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेले दर पत्रक पहा ({loanRates.length})</span>
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
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण कर्ज योजना</div>
            <div className="text-sm font-black text-gray-900">{loanRates.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय कर्ज योजना</div>
            <div className="text-sm font-black text-emerald-800">{activeCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सरासरी व्याजदर (% Avg)</div>
            <div className="text-sm font-black text-indigo-950">{avgInterestRate}% p.a.</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सरासरी थकीत दर (% Overdue)</div>
            <div className="text-sm font-black text-rose-800">{avgOverdueRate}% p.a.</div>
          </div>
        </div>
      </div>

      {/* MAIN SINGLE UNIFIED FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
          isEditing ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Basic Details */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Landmark className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. प्राथमिक माहिती (Basic Loan Details)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>कर्ज प्रकार <span className="text-red-500">*</span></label>
                <select name="loanType" value={formData.loanType} onChange={handleChange} className={inputClass}>
                  <option value="तारणी">तारणी</option>
                  <option value="विनातारणी">विनातारणी</option>
                  <option value="सोने तारण">सोने तारण</option>
                  <option value="ठेव तारण">ठेव तारण</option>
                  <option value="पगार तारण">पगार तारण</option>
                  <option value="गृह कर्ज">गृह कर्ज</option>
                  <option value="वाहन कर्ज">वाहन कर्ज</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className={labelClass}>कोड (Loan Code)</label>
                  <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 rounded border border-primary/20">⚡ ऑटो</span>
                </div>
                <input 
                  ref={loanCodeInputRef}
                  type="text" 
                  name="loanCode" 
                  value={formData.loanCode} 
                  readOnly
                  className={`${inputClass} bg-slate-100 font-bold text-primary cursor-not-allowed`} 
                  placeholder="उदा. LN01" 
                />
              </div>

              <div>
                <label className={labelClass}>संक्षिप्त नाव (Short Name) <span className="text-red-500">*</span></label>
                <input type="text" name="shortName" value={formData.shortName} onChange={handleChange} className={inputClass} placeholder="उदा. वैयक्तिक कर्ज" required />
              </div>

              <div>
                <label className={labelClass}>तारणी प्रकार (Security Type)</label>
                <select name="securityType" value={formData.securityType} onChange={handleChange} className={inputClass}>
                  <option value="तारणी">तारणी</option>
                  <option value="विनातारणी">विनातारणी</option>
                  <option value="पगार तारण">पगार तारण</option>
                  <option value="सोने तारण">सोने तारण</option>
                  <option value="ठेव तारण">ठेव तारण</option>
                </select>
              </div>
            </div>

            {/* Dynamic Collateral Configuration Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-gray-200 bg-slate-50/70 p-2.5 rounded-sm border border-slate-200">
              <div>
                <label className={labelClass}>
                  तारण वर्गवारी (Collateral Category) <span className="text-primary font-bold">*</span>
                </label>
                <select 
                  name="collateralCategory" 
                  value={formData.collateralCategory} 
                  onChange={(e) => {
                    const val = e.target.value;
                    const isDeposit = ['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(val);
                    setFormData(prev => ({
                      ...prev,
                      collateralCategory: val,
                      isLienRequired: isDeposit ? true : prev.isLienRequired,
                      securityType: val === 'None' ? 'विनातारणी' : (isDeposit ? 'ठेव तारण' : (val === 'Gold' ? 'सोने तारण' : prev.securityType))
                    }));
                  }} 
                  className={`${inputClass} font-semibold text-primary border-primary/40`}
                >
                  <option value="None">लागू नाही / विनातारणी (None / Unsecured)</option>
                  <option value="FixedDeposit">मुदत ठेव तारण (Fixed Deposit - FD)</option>
                  <option value="PigmyDeposit">दैनिक / पिग्मी ठेव तारण (Pigmy / Daily Deposit)</option>
                  <option value="RecurringDeposit">आवर्ती ठेव तारण (Recurring Deposit - RD)</option>
                  <option value="SavingDeposit">बचत ठेव तारण (Saving Account)</option>
                  <option value="Gold">सुवर्ण तारण (Gold Loan)</option>
                  <option value="Salary">पगार तारण (Salary Loan)</option>
                  <option value="Property">मालमत्ता / स्थावर तारण (Property / Mortgage)</option>
                  <option value="Other">इतर तारण (Other Security)</option>
                </select>
              </div>

              {['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(formData.collateralCategory) && (
                <>
                  <div>
                    <label className={labelClass}>
                      कमाल कर्ज मर्यादा (Max LTV %) <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="maxLtvPercentage" 
                      value={formData.maxLtvPercentage} 
                      onChange={handleChange} 
                      className={`${inputClass} font-bold text-blue-700 font-mono`} 
                      placeholder="उदा. 85.00" 
                      title="ठेवीच्या शिलकीवर किती टक्के कर्ज देता येईल"
                    />
                    <span className="text-[10px] text-gray-500 font-medium">उदा. १०० रुपयांच्या ठेवीवर कमाल ₹८५ कर्ज</span>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <label className="flex items-center space-x-2 cursor-pointer bg-white p-2 rounded-sm border border-slate-300 w-full hover:bg-emerald-50 transition-colors">
                      <input
                        type="checkbox"
                        name="isLienRequired"
                        checked={formData.isLienRequired}
                        onChange={(e) => setFormData(prev => ({ ...prev, isLienRequired: e.target.checked }))}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="text-xs font-semibold text-gray-800">नवीन कर्ज अर्जाला ठेवीवर बोजा (Lien Lock) अनिवार्य</span>
                    </label>

                    <label className="flex items-start space-x-2 cursor-pointer bg-white p-2 rounded-sm border border-slate-300 w-full hover:bg-emerald-50 transition-colors">
                      <input
                        type="checkbox"
                        name="isCollateralMandatoryForOpeningBalance"
                        checked={formData.isCollateralMandatoryForOpeningBalance}
                        onChange={(e) => setFormData(prev => ({ ...prev, isCollateralMandatoryForOpeningBalance: e.target.checked }))}
                        className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-800">आरंभिक शिल्लकीत (Opening Balance) तारण ठेव अनिवार्य ठेवा</span>
                        <span className="text-[10px] text-gray-500">
                          (अनचेक असल्यास: जुनी आरंभिक शिल्लक नोंदवताना तारण उपलब्ध नसले तरी डेटा एन्ट्री अडकणार नाही व नंतर एडिट करून तारण जोडता येईल)
                        </span>
                      </div>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>नियमित व्याजदर (% p.a.) <span className="text-red-500">*</span></label>
                <input type="number" step="0.01" name="interestRate" value={formData.interestRate} onChange={handleChange} className={`${inputClass} font-bold text-emerald-700 font-mono`} placeholder="उदा. 12.00" required />
              </div>

              <div>
                <label className={labelClass}>थकीत व्याजदर (% p.a.)</label>
                <input type="number" step="0.01" name="overdueInterestRate" value={formData.overdueInterestRate} onChange={handleChange} className={`${inputClass} font-bold text-rose-700 font-mono`} placeholder="उदा. 2.00" />
              </div>

              <div className="flex items-center pt-3">
                <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 p-1.5 rounded-sm border border-slate-200 w-full hover:bg-primary/5 transition-colors">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleCheckboxChange}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800">ही कर्ज योजना सक्रीय ठेवा (Is Active)</span>
                </label>
              </div>
            </div>

            {/* Board Resolution & Revision Notice Card (दोष क्र. ७) */}
            {isRateChanged && (
              <div className="mt-2.5 p-3 bg-amber-50 border-2 border-amber-400 rounded-sm shadow-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-amber-300 pb-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <span>📜 संचालक मंडळ ठराव व अंमलबजावणी नोंद (Board Resolution & Rate Revision)</span>
                  </div>
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-400">
                    ⚠️ व्याजदरात बदल आढळला
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-amber-100/70 p-2 rounded border border-amber-200">
                  <div>
                    <span className="text-gray-600 block text-[10px]">मूळ व्याजदर:</span>
                    <span className="font-mono font-bold text-gray-800">{originalRates?.interestRate?.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block text-[10px]">नवीन व्याजदर:</span>
                    <span className="font-mono font-black text-emerald-800">{currentInterest.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block text-[10px]">मूळ थकीत दर:</span>
                    <span className="font-mono font-bold text-gray-800">{originalRates?.overdueInterestRate?.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block text-[10px]">नवीन थकीत दर:</span>
                    <span className="font-mono font-black text-rose-800">{currentOverdue.toFixed(2)}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className={labelClass}>
                      संचालक मंडळ ठराव क्रमांक <span className="text-red-600 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={resolutionNo}
                      onChange={(e) => setResolutionNo(e.target.value)}
                      placeholder="उदा. ठराव क्र. १२/२०२६"
                      className={`${inputClass} border-amber-400 focus:ring-amber-500 font-bold`}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      ठराव दिनांक <span className="text-red-600 font-bold">*</span>
                    </label>
                    <input
                      type="date"
                      value={resolutionDate}
                      onChange={(e) => setResolutionDate(e.target.value)}
                      className={`${inputClass} border-amber-400 focus:ring-amber-500 font-bold`}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      नवीन दर लागू दिनांक (Effective Date) <span className="text-red-600 font-bold">*</span>
                    </label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className={`${inputClass} border-amber-400 focus:ring-amber-500 font-bold`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>दर बदलाचे कारण / इतिवृत्त टिपणी (Reason for Revision)</label>
                  <input
                    type="text"
                    value={revisionReason}
                    onChange={(e) => setRevisionReason(e.target.value)}
                    placeholder="उदा. संचालक मंडळ मासिक सभा निर्णयानुसार व्याजदर कपात / वाढ"
                    className={`${inputClass} border-amber-400`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Terms & Methods */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. कर्जाच्या अटी व पद्धत (Terms & Calculation Methods)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>मुदत (महिने - Duration) <span className="text-red-500">*</span></label>
                <input type="number" name="durationMonths" value={formData.durationMonths} onChange={handleChange} className={`${inputClass} font-mono font-bold`} placeholder="उदा. 36" required />
              </div>

              <div>
                <label className={labelClass}>हप्ता प्रकार (Installment Type)</label>
                <select name="installmentType" value={formData.installmentType} onChange={handleChange} className={inputClass}>
                  <option value="साप्ताहिक">साप्ताहिक</option>
                  <option value="मासिक">मासिक</option>
                  <option value="त्रैमासिक">त्रैमासिक</option>
                  <option value="सहामाही">सहामाही</option>
                  <option value="वार्षिक">वार्षिक</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>हप्ता संख्या (Installment Count) <span className="text-red-500">*</span></label>
                <input type="number" name="installmentCount" value={formData.installmentCount} onChange={handleChange} className={`${inputClass} font-mono font-bold`} placeholder="उदा. 36" required />
              </div>

              <div>
                <label className={labelClass}>कर्ज हप्ता प्रकार (Installment Type)</label>
                <select name="loanInstallmentType" value={formData.loanInstallmentType} onChange={handleChange} className={inputClass}>
                  <option value="समान हप्ता">समान हप्ता (EMI - स्थिर मासिक हप्ता)</option>
                  <option value="समान मुद्दल">समान मुद्दल (Equal Principal - घटता हप्ता)</option>
                  <option value="फ्लॅट हप्ता">फ्लॅट हप्ता (Flat Installment)</option>
                  <option value="कर्जावरती">कर्जावरती (Equal Principal - मुद्दलावर)</option>
                  <option value="व्याजवरती">व्याजवरती (Interest Only / Bullet)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 border-t border-gray-200">
              <div>
                <label className={labelClass}>व्याज आकारणी पद्धत (Interest Method)</label>
                <select name="interestCalculationMethod" value={formData.interestCalculationMethod} onChange={handleChange} className={inputClass}>
                  <option value="Flat (फ्लॅट)">Flat (फ्लॅट)</option>
                  <option value="Reducing (घटती पद्धत)">Reducing (घटती पद्धत)</option>
                  <option value="Daily Reducing (दैनिक घटती)">Daily Reducing (दैनिक घटती पद्धत)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>व्याज पोस्टींग वारंवारता (Posting Frequency)</label>
                <select name="interestPostingFrequency" value={formData.interestPostingFrequency} onChange={handleChange} className={inputClass}>
                  <option value="लागू नाही (N/A)">लागू नाही / पोस्ट होणार नाही (N/A)</option>
                  <option value="मासिक (Monthly)">मासिक (Monthly - दर महिन्याला)</option>
                  <option value="त्रैमासिक (Quarterly)">त्रैमासिक (Quarterly - दर ३ महिन्यांनी)</option>
                  <option value="सहामाही (Half-Yearly)">सहामाही (Half-Yearly - दर ६ महिन्यांनी)</option>
                  <option value="वार्षिक (Yearly)">वार्षिक (Yearly - दर वर्षाला)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>व्याज पोस्टींग प्रकार (Posting Type)</label>
                <select name="interestPostingType" value={formData.interestPostingType} onChange={handleChange} className={inputClass}>
                  <option value="कर्जावर">कर्जावर (मुद्दलामध्ये जमा / Capitalize to Loan)</option>
                  <option value="येणे व्याजावर">येणे व्याजावर (येणे व्याज शिल्लक / Accrue to Receivable)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: GL Ledger Mappings */}
          <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">३. कोर बँकिंग खातावणी लेजर खाते मॅपिंग (GL Ledger Mappings)</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  १. कर्ज खाते (Loan Account) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect name="loanLedgerID" value={formData.loanLedgerID} onChange={handleChange} options={ledgerOptions} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  २. व्याज खाते (Interest Income) <span className="text-red-500">*</span>
                </label>
                <SearchableSelect name="interestLedgerID" value={formData.interestLedgerID} onChange={handleChange} options={ledgerOptions} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ३. थकीत व्याज खाते (Overdue Interest)
                </label>
                <SearchableSelect name="overdueInterestLedgerID" value={formData.overdueInterestLedgerID} onChange={handleChange} options={ledgerOptions} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ४. येणे व्याज खाते (Receivable Interest) {formData.interestPostingType?.includes('येणे') && <span className="text-red-500 font-bold">* (अनिवार्य)</span>}
                </label>
                <SearchableSelect name="receivableInterestLedgerID" value={formData.receivableInterestLedgerID} onChange={handleChange} options={ledgerOptions} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ५. सरचार्ज खाते (Surcharge)
                </label>
                <SearchableSelect name="surchargeLedgerID" value={formData.surchargeLedgerID} onChange={handleChange} options={ledgerOptions} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ६. वसुली फी खाते (Recovery Fee)
                </label>
                <SearchableSelect name="recoveryFeeLedgerID" value={formData.recoveryFeeLedgerID} onChange={handleChange} options={ledgerOptions} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-800 mb-0.5">
                  ७. प्रोसेसिंग फी खाते (Processing Fee)
                </label>
                <SearchableSelect name="processingFeeLedgerID" value={formData.processingFeeLedgerID} onChange={handleChange} options={ledgerOptions} />
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-200">
            <button
              type="button"
              onClick={handleNew}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isEditing ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
            </button>

            <button
              type="submit"
              className={`px-6 py-2 ${
                isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition-all`}
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'बदल सेव्ह करा (Update)' : 'दर पत्रक सेव्ह करा (Save Rate)'}</span>
            </button>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: SAVED LOAN RATES GRID LIST                                 */}
      {/* ========================================================================= */}
      {showList && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-7xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेले कर्ज दर पत्रक यादी (Saved Loan Rates List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredLoanRates.length} योजना
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowList(false)}
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
                  placeholder="प्रकार / कोड / संक्षिप्त नाव / खाते शोधा..." 
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
                disabled={filteredLoanRates.length === 0}
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-36">कृती</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">कर्ज प्रकार</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">कोड</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">संक्षिप्त नाव</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">तारणी प्रकार</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">व्याजदर (%)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">थकीत दर (%)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">मुदत (महिने)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">हप्ता प्रकार</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">हप्ता संख्या</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">कर्ज खाते</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">व्याज खाते</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredLoanRates.map((rate) => (
                      <tr key={rate.loanRateID} className="hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => {
                                fetchRevisionHistory(rate.loanRateID);
                                setSelectedSchemeFilter(rate.loanRateID.toString());
                                setShowHistoryModal(true);
                              }}
                              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="या योजनेचा दर बदल इतिहास पहा"
                            >
                              <History className="w-3 h-3 text-indigo-700" />
                              <span>इतिहास</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleEdit(rate)} 
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="योजना फॉर्ममध्ये लोड करा (Load in Form)"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>सुधारा</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleDelete(rate.loanRateID)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="योजना डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-primary">
                          {rate.loanType}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono font-bold text-gray-700">
                          {rate.loanCode || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-800">
                          {rate.shortName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                          {rate.securityType || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-black text-emerald-700 font-mono">
                          {formatPercent(rate.interestRate)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-black text-rose-600 font-mono">
                          {formatPercent(rate.overdueInterestRate)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold text-gray-800 font-mono">
                          {rate.durationMonths || 0}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-medium">
                          {rate.installmentType || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold font-mono">
                          {rate.installmentCount || 0}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          {renderLedgerCell(rate.loanLedgerID)}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          {renderLedgerCell(rate.interestLedgerID)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rate.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {rate.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredLoanRates.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतीही कर्ज दर नोंद सापडली नाही.
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
                टीप: 'सुधारा' वर क्लिक केल्यास नोंद थेट मुख्य फॉर्ममध्ये संपादन करण्यासाठी लोड होईल.
              </span>
              <button
                type="button"
                onClick={() => setShowList(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL: LOAN RATE REVISION HISTORY REGISTER (दोष क्र. ७)            */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-7xl w-full max-h-[94vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-amber-700 text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-amber-800">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <span>📜 व्याजदर बदल व संचालक मंडळ ठराव नोंदवही (Loan Rate Revision History)</span>
                    <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                      {filteredHistory.length} नोंदी
                    </span>
                  </h2>
                  <p className="text-[10px] text-amber-100 font-medium">
                    सहकार निबंधक लेखापरीक्षण व ऑडिट मानकांनुसार व्याजदर बदलांचा ऐतिहासिक पुरावा
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                  <input 
                    type="text" 
                    placeholder="योजना / कोड / ठराव क्र. / कारण शोधा..." 
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-60 lg:w-72 focus:outline-none focus:border-amber-600 bg-white shadow-2xs"
                  />
                  {historySearchTerm && (
                    <button 
                      onClick={() => setHistorySearchTerm('')} 
                      className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-gray-600">योजना:</span>
                  <select
                    value={selectedSchemeFilter}
                    onChange={(e) => setSelectedSchemeFilter(e.target.value)}
                    className="border border-gray-300 rounded-sm text-xs h-[30px] px-2 bg-white text-gray-800 font-medium focus:outline-none focus:border-amber-600"
                  >
                    <option value="ALL">-- सर्व कर्ज योजना --</option>
                    {loanRates.map(r => (
                      <option key={r.loanRateID} value={r.loanRateID.toString()}>
                        {r.loanCode ? `[${r.loanCode}] ` : ''}{r.loanType}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportHistoryExcel}
                  disabled={filteredHistory.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="एक्सेल फाइल डाउनलोड करा"
                >
                  <FileSpreadsheet size={13} />
                  <span>एक्सेल एक्सपोर्ट</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="प्रिंट करा"
                >
                  <Printer size={13} />
                  <span>प्रिंट</span>
                </button>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              {historyLoading ? (
                <div className="p-8 text-center text-gray-500 font-bold">
                  माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                </div>
              ) : (
                <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                      <tr>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-center w-12">अ.क्र.</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-left">कर्ज योजना व कोड</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याजदर बदल (% p.a.)</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-center">थकीत दर बदल (% p.a.)</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-left">संचालक मंडळ ठराव क्र.</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-center">ठराव दिनांक</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-center">लागू दिनांक (Effective)</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-left">बदलाचे कारण / टिपणी</th>
                        <th className="px-2 py-1.5 border-r border-gray-200 text-center">बदल दिनांक व ऑपरेटर</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                      {filteredHistory.map((item, idx) => (
                        <tr key={item.historyID} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold text-gray-600">
                            {idx + 1}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-primary">
                            <div>{item.loanType}</div>
                            <span className="text-[10px] font-mono text-gray-500 font-semibold">{item.loanCode || '-'}</span>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                            <span className="font-mono text-gray-500 line-through mr-1.5">
                              {item.oldInterestRate !== undefined && item.oldInterestRate !== null ? `${item.oldInterestRate.toFixed(2)}%` : '0.00%'}
                            </span>
                            <span className="font-bold text-gray-400 mr-1.5">➔</span>
                            <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                              {item.newInterestRate !== undefined && item.newInterestRate !== null ? `${item.newInterestRate.toFixed(2)}%` : '0.00%'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                            <span className="font-mono text-gray-500 line-through mr-1.5">
                              {item.oldOverdueRate !== undefined && item.oldOverdueRate !== null ? `${item.oldOverdueRate.toFixed(2)}%` : '0.00%'}
                            </span>
                            <span className="font-bold text-gray-400 mr-1.5">➔</span>
                            <span className="font-mono font-black text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                              {item.newOverdueRate !== undefined && item.newOverdueRate !== null ? `${item.newOverdueRate.toFixed(2)}%` : '0.00%'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-amber-900 font-sans">
                            {item.resolutionNo || '-'}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono">
                            {item.resolutionDate ? new Date(item.resolutionDate).toLocaleDateString('en-GB') : '-'}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono font-bold text-emerald-800">
                            {item.effectiveDate ? new Date(item.effectiveDate).toLocaleDateString('en-GB') : '-'}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-800 font-sans">
                            {item.revisionReason || '-'}
                          </td>
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                            <div className="font-mono text-[10px] text-gray-800">
                              {item.changedAt ? new Date(item.changedAt).toLocaleString('en-GB') : '-'}
                            </div>
                            <div className="text-[10px] text-gray-500 font-semibold">
                              {item.changedBy || 'System'}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredHistory.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-6 py-10 text-center text-gray-400 font-bold">
                            कोणतीही व्याजदर बदल नोंद सापडली नाही.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-between items-center text-xs shrink-0">
              <span className="text-gray-500 font-medium">
                टीप: जेव्हा जेव्हा कोणत्याही योजनेचा व्याजदर किंवा थकीत दर बदलला जातो, तेव्हा सिस्टीम स्वयंचलितपणे येथे ऑडिट ट्रेल नोंदवते.
              </span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

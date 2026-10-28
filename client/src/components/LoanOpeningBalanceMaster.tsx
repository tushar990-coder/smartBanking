import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import { 
  PlusCircle, 
  List, 
  Search, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Save, 
  CheckCircle, 
  Coins, 
  Users, 
  Award, 
  AlertCircle, 
  FileSpreadsheet, 
  X, 
  Plus, 
  CreditCard, 
  Wallet, 
  Scale, 
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  Camera,
  Image as ImageIcon,
  ZoomIn
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DepositCollateralSelectorModal, { EligibleDeposit } from './DepositCollateralSelectorModal';

interface Customer {
  customerID: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  cifNo: string;
  mobileNo?: string;
}

interface LoanRate {
  loanRateID: number;
  loanType: string;
  loanCode: string;
  shortName: string;
  interestRate?: number;
  durationMonths?: number;
  installmentCount?: number;
  installmentType?: string;
  interestCalculationMethod?: string;
  loanInstallmentType?: string;
  collateralCategory?: string;
  maxLtvPercentage?: number;
  isLienRequired?: boolean;
  isCollateralMandatoryForOpeningBalance?: boolean;
}

interface LoanOpeningBalance {
  loanAccountID: number;
  branchID: number;
  branch?: {
    branchName: string;
    branchCode: string;
  };
  customerID?: number;
  loanRateID: number;
  loanAccountNo: string;
  legacyAccountNumber?: string;
  isOpeningBalance?: boolean;
  status?: string;
  
  purePrincipalBalance?: number;
  capitalizedInterestAmount?: number;
  principalBalance: number;
  interestBalance: number;
  overdueInterestBalance: number;
  interestProvisionBalance?: number;
  initialNpaClassification?: string;
  chargeInterestOnCapitalizedAmount?: boolean;
  openingDate: string;
  
  loanDisbursementDate?: string;
  sanctionedAmount: number;
  disbursedAmount?: number;
  loanDisbursements?: any[];
  interestRate: number;
  durationMonths: number;
  installmentAmount: number;
  firstInstallmentDate?: string;
  maturityDate?: string;
  installmentFrequency?: string;
  lastInstallmentPaidDate?: string;
  
  guarantor1?: string;
  guarantor2?: string;
  securityDetails?: string;
  securityValue: number;
  depositCollaterals?: any[];

  customer?: Customer;
  loanRate?: LoanRate;
}

export interface GoldLoanItem {
  id: string;
  itemName: string;
  purity: string;
  quantity: number;
  grossWeight: number;
  netWeight: number;
  ratePerGram: number;
  valuationAmount: number;
  remarks: string;
  imagePath?: string;
  valuerName?: string;
  valuerValuation?: number;
  valuationReceiptNo?: string;
  valuationDate?: string;
}

interface GlReconciliationSchemeItem {
  branchID: number;
  loanRateID: number;
  schemeName: string;
  loanCode: string;
  loanLedgerID?: number;
  loanLedgerName: string;
  glPrincipalOpeningBalance: number;
  glOpeningBalanceType: string;
  slTotalPrincipalBalance: number;
  slTotalPurePrincipal: number;
  slTotalCapitalizedInterest: number;
  totalAccountsCount: number;
  principalDifference: number;
  principalStatus: 'Reconciled' | 'Pending' | 'Excess' | 'NoLedger' | string;
  statusMessage: string;
  receivableInterestLedgerID?: number;
  receivableInterestLedgerName?: string;
  glInterestOpeningBalance?: number;
  slTotalInterestBalance?: number;
  interestDifference?: number;
  interestStatus?: string;
}

interface GlReconciliationResponse {
  summary: GlReconciliationSchemeItem;
  schemes: GlReconciliationSchemeItem[];
}

const getDisbursedAmt = (b: any): number => {
  if (b.disbursedAmount !== undefined && b.disbursedAmount !== null && Number(b.disbursedAmount) > 0) {
    return Number(b.disbursedAmount);
  }
  if (b.loanDisbursements && Array.isArray(b.loanDisbursements) && b.loanDisbursements.length > 0) {
    const obDisb = b.loanDisbursements.find((d: any) => d.paymentMode === 'Opening Balance' || d.remarks?.includes('Opening Balance')) || b.loanDisbursements[0];
    if (obDisb && Number(obDisb.disbursementAmount) > 0) {
      return Number(obDisb.disbursementAmount);
    }
  }
  return Number(b.sanctionedAmount) || 0;
};

export default function LoanOpeningBalanceMaster() {
  const [allAccounts, setAllAccounts] = useState<LoanOpeningBalance[]>([]);
  const [showListModal, setShowListModal] = useState(false);
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [showGoldModal, setShowGoldModal] = useState(false);
  const DEFAULT_ORNAMENTS = [
    'सोन्याची साखळी (Chain)',
    'सोन्याची अंगठी (Ring)',
    'सोन्याचे पाटल्या / बांगड्या (Bangles)',
    'सोन्याचा हार / नेकलेस (Necklace)',
    'सोन्याचे मंगलसूत्र (Mangalsutra)',
    'सोन्याची वेढणी / नाणे (Coin/Bar)',
    'सोन्याचे झुमके / कानातील (Earrings)',
    'सोन्याचे पदक / पेंडंट (Pendant)',
    'सोन्याचे कडे (Kade)',
    'इतर सुवर्ण अलंकार (Other Ornaments)'
  ];

  const [goldItems, setGoldItems] = useState<GoldLoanItem[]>([]);
  const [editingGoldId, setEditingGoldId] = useState<string | null>(null);
  const [ornamentNames, setOrnamentNames] = useState<string[]>(DEFAULT_ORNAMENTS);
  const [showCustomItemInput, setShowCustomItemInput] = useState(false);
  const [customItemText, setCustomItemText] = useState('');

  // Camera & Photo states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Deposit Collateral Modal & State
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositCollaterals, setDepositCollaterals] = useState<any[]>([]);
  const [goldForm, setGoldForm] = useState<{
    itemName: string;
    purity: string;
    quantity: number | string;
    grossWeight: number | string;
    netWeight: number | string;
    ratePerGram: number | string;
    valuationAmount: number | string;
    remarks: string;
    imagePath: string;
    valuerName: string;
    valuerValuation: number | string;
    valuationReceiptNo: string;
    valuationDate: string;
  }>({
    itemName: 'सोन्याची साखळी (Chain)',
    purity: '22K (91.6%)',
    quantity: 1,
    grossWeight: '',
    netWeight: '',
    ratePerGram: 6000,
    valuationAmount: '',
    remarks: '',
    imagePath: '',
    valuerName: '',
    valuerValuation: '',
    valuationReceiptNo: '',
    valuationDate: ''
  });

  const getPurityRatio = (purityStr: string): number => {
    if (!purityStr) return 22 / 24;
    if (purityStr.includes('24K') || purityStr.includes('99.9')) return 24 / 24;
    if (purityStr.includes('22K') || purityStr.includes('91.6')) return 22 / 24;
    if (purityStr.includes('20K') || purityStr.includes('83.3')) return 20 / 24;
    if (purityStr.includes('18K') || purityStr.includes('75.0')) return 18 / 24;
    const match = purityStr.match(/(\d+(\.\d+)?)K/i);
    if (match) {
      const k = parseFloat(match[1]);
      if (k > 0 && k <= 24) return k / 24;
    }
    return 22 / 24;
  };

  const calculateGoldItemValuation = (netWt: number, purityStr: string, rate: number): number => {
    if (netWt <= 0 || rate <= 0) return 0;
    const ratio = getPurityRatio(purityStr);
    const pureGrams = netWt * ratio;
    return Math.round(pureGrams * rate);
  };

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        setCameraStream(stream);
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } else {
        alert('या ब्राउझरमध्ये कॅमेरा उपलब्ध नाही.');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      alert('कॅमेरा सुरू करताना त्रुटी आली. कृपया कॅमेरा परवानगी तपासा: ' + (err.message || ''));
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setGoldForm(prev => ({ ...prev, imagePath: dataUrl }));
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('फोटोची साईझ 5MB पेक्षा कमी असावी.');
      return;
    }
    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setGoldForm(prev => ({ ...prev, imagePath: base64 }));
      setIsUploadingPhoto(false);
    };
    reader.onerror = () => {
      alert('फोटो लोड करताना त्रुटी आली.');
      setIsUploadingPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAddCustomOrnament = () => {
    const trimmed = customItemText.trim();
    if (!trimmed) return;
    if (!ornamentNames.includes(trimmed)) {
      setOrnamentNames(prev => [...prev, trimmed]);
    }
    setGoldForm(prev => ({ ...prev, itemName: trimmed }));
    setCustomItemText('');
    setShowCustomItemInput(false);
  };

  const handleAddGoldItem = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(goldForm.quantity.toString() || '1');
    const gross = parseFloat(goldForm.grossWeight.toString() || '0');
    const net = parseFloat(goldForm.netWeight.toString() || '0');
    const rate = parseFloat(goldForm.ratePerGram.toString() || '0');
    const valuerVal = parseFloat(goldForm.valuerValuation?.toString() || '0');
    
    // Auto pure valuation formula
    const autoValuation = calculateGoldItemValuation(net, goldForm.purity, rate);
    const valuation = parseFloat(goldForm.valuationAmount?.toString() || '0') || autoValuation;

    if (net <= 0) {
      alert('कृपया निव्वळ वजन (Net Weight) टाका!');
      return;
    }

    if (editingGoldId) {
      setGoldItems(prev => prev.map(item => item.id === editingGoldId ? {
        ...item,
        itemName: goldForm.itemName,
        purity: goldForm.purity,
        quantity: qty,
        grossWeight: gross,
        netWeight: net,
        ratePerGram: rate,
        valuationAmount: valuation,
        remarks: goldForm.remarks,
        imagePath: goldForm.imagePath,
        valuerName: goldForm.valuerName,
        valuerValuation: valuerVal,
        valuationReceiptNo: goldForm.valuationReceiptNo,
        valuationDate: goldForm.valuationDate
      } : item));
      setEditingGoldId(null);
    } else {
      const newItem: GoldLoanItem = {
        id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        itemName: goldForm.itemName,
        purity: goldForm.purity,
        quantity: qty,
        grossWeight: gross,
        netWeight: net,
        ratePerGram: rate,
        valuationAmount: valuation,
        remarks: goldForm.remarks,
        imagePath: goldForm.imagePath,
        valuerName: goldForm.valuerName,
        valuerValuation: valuerVal,
        valuationReceiptNo: goldForm.valuationReceiptNo,
        valuationDate: goldForm.valuationDate
      };
      setGoldItems(prev => [...prev, newItem]);
    }

    setGoldForm({
      itemName: 'सोन्याची साखळी (Chain)',
      purity: '22K (91.6%)',
      quantity: 1,
      grossWeight: '',
      netWeight: '',
      ratePerGram: goldForm.ratePerGram || 6000,
      valuationAmount: '',
      remarks: '',
      imagePath: '',
      valuerName: goldForm.valuerName || '',
      valuerValuation: '',
      valuationReceiptNo: goldForm.valuationReceiptNo || '',
      valuationDate: goldForm.valuationDate || ''
    });
  };

  const handleEditGoldItem = (item: GoldLoanItem) => {
    setEditingGoldId(item.id);
    if (!ornamentNames.includes(item.itemName)) {
      setOrnamentNames(prev => [...prev, item.itemName]);
    }
    setGoldForm({
      itemName: item.itemName,
      purity: item.purity,
      quantity: item.quantity,
      grossWeight: item.grossWeight,
      netWeight: item.netWeight,
      ratePerGram: item.ratePerGram,
      valuationAmount: item.valuationAmount,
      remarks: item.remarks || '',
      imagePath: item.imagePath || '',
      valuerName: item.valuerName || '',
      valuerValuation: item.valuerValuation || '',
      valuationReceiptNo: item.valuationReceiptNo || '',
      valuationDate: item.valuationDate || ''
    });
  };

  const handleDeleteGoldItem = (id: string) => {
    setGoldItems(prev => prev.filter(item => item.id !== id));
    if (editingGoldId === id) {
      setEditingGoldId(null);
    }
  };

  const totalGoldItemsCount = goldItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalGoldGrossWeight = goldItems.reduce((sum, item) => sum + (item.grossWeight || 0), 0);
  const totalGoldNetWeight = goldItems.reduce((sum, item) => sum + (item.netWeight || 0), 0);
  const totalGoldValuation = goldItems.reduce((sum, item) => sum + (item.valuationAmount || 0), 0);
  const totalGoldValuerValuation = goldItems.reduce((sum, item) => sum + (item.valuerValuation || 0), 0);

  const applyGoldLoanToOpeningBalance = () => {
    let effectiveItems = [...goldItems];
    const pendingGross = parseFloat(goldForm.grossWeight?.toString() || '0');
    const pendingNet = parseFloat(goldForm.netWeight?.toString() || '0') || pendingGross;
    const pendingRate = parseFloat(goldForm.ratePerGram?.toString() || '0');

    if (pendingNet > 0 && goldForm.itemName) {
      const qty = parseInt(goldForm.quantity?.toString() || '1', 10) || 1;
      const autoValuation = calculateGoldItemValuation(pendingNet, goldForm.purity, pendingRate);
      const valuation = parseFloat(goldForm.valuationAmount?.toString() || '0') || autoValuation;
      const valuerVal = parseFloat(goldForm.valuerValuation?.toString() || '0') || valuation;
      const effectiveGross = pendingGross > 0 ? pendingGross : pendingNet;

      if (editingGoldId) {
        effectiveItems = effectiveItems.map(item =>
          item.id === editingGoldId
            ? {
                ...item,
                itemName: goldForm.itemName,
                purity: goldForm.purity,
                quantity: qty,
                grossWeight: effectiveGross,
                netWeight: pendingNet,
                ratePerGram: pendingRate,
                valuationAmount: valuation,
                remarks: goldForm.remarks,
                imagePath: goldForm.imagePath,
                valuerName: goldForm.valuerName,
                valuerValuation: valuerVal,
                valuationReceiptNo: goldForm.valuationReceiptNo,
                valuationDate: goldForm.valuationDate
              }
            : item
        );
        setEditingGoldId(null);
      } else {
        effectiveItems.push({
          id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          itemName: goldForm.itemName,
          purity: goldForm.purity,
          quantity: qty,
          grossWeight: effectiveGross,
          netWeight: pendingNet,
          ratePerGram: pendingRate,
          valuationAmount: valuation,
          remarks: goldForm.remarks,
          imagePath: goldForm.imagePath,
          valuerName: goldForm.valuerName,
          valuerValuation: valuerVal,
          valuationReceiptNo: goldForm.valuationReceiptNo,
          valuationDate: goldForm.valuationDate
        });
      }

      setGoldItems(effectiveItems);
      setGoldForm({
        itemName: 'सोन्याची साखळी (Chain)',
        purity: '22K (91.6%)',
        quantity: 1,
        grossWeight: '',
        netWeight: '',
        ratePerGram: goldForm.ratePerGram || 6000,
        valuationAmount: '',
        remarks: '',
        imagePath: '',
        valuerName: goldForm.valuerName || '',
        valuerValuation: '',
        valuationReceiptNo: goldForm.valuationReceiptNo || '',
        valuationDate: goldForm.valuationDate || ''
      });
    }

    if (effectiveItems.length === 0) {
      alert('कृपया किमान एक सोन्याचा दागिना आणि त्याचे निव्वळ वजन प्रविष्ट करा!');
      return;
    }

    const effCount = effectiveItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const effNet = effectiveItems.reduce((sum, item) => sum + (item.netWeight || 0), 0);
    const effSysVal = effectiveItems.reduce((sum, item) => sum + (item.valuationAmount || 0), 0);
    const effValuerVal = effectiveItems.reduce((sum, item) => sum + (Number(item.valuerValuation) || 0), 0);

    const effectiveVal = effValuerVal > 0 ? effValuerVal : effSysVal;
    const valuerNote = effValuerVal > 0 ? `, व्हॅल्यूअर मूल्यांकन: ₹${effValuerVal.toLocaleString('en-IN')}` : '';
    const securitySummary = `सोने तारण: ${effectiveItems.length} जिन्नस (${effCount} नग), निव्वळ वजन: ${effNet.toFixed(2)} ग्रॅम, सिस्टीम मूल्यांकन: ₹${effSysVal.toLocaleString('en-IN')}${valuerNote}`;
    setFormData(prev => ({
      ...prev,
      securityValue: effectiveVal.toString(),
      securityDetails: securitySummary
    }));
    setShowGoldModal(false);
    stopCamera();
  };
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [installmentChart, setInstallmentChart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loanFilterType, setLoanFilterType] = useState<'all' | 'opening' | 'regular'>('all');
  const [cutoffDate, setCutoffDate] = useState<string>('2025-03-31');
  const [firstFyInfo, setFirstFyInfo] = useState<{ yearCode?: string, startDate?: string } | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const interestBalanceInputRef = useRef<HTMLInputElement>(null);
  
  const getDefaultDate = () => {
    return cutoffDate || '2025-03-31';
  };

  const getTodayDate = () => {
    return cutoffDate || '2025-03-31';
  };

  const [isInstAmountEdited, setIsInstAmountEdited] = useState(false);
  const [isInterestManuallyEdited, setIsInterestManuallyEdited] = useState(false);

  // GL vs SL Reconciliation States
  const [glRecon, setGlRecon] = useState<GlReconciliationResponse | null>(null);
  const [isLoadingRecon, setIsLoadingRecon] = useState<boolean>(false);
  const [showReconBreakdown, setShowReconBreakdown] = useState<boolean>(false);
  const [isSyncingGl, setIsSyncingGl] = useState<boolean>(false);

  const handleSyncAllGlBalances = async () => {
    if (!window.confirm('सर्व कर्ज योजनांची मुख्य खतावणी (GL) आरंभिक शिल्लक उप-खात्यांनुसार सिंक करावी का? यामुळे तेरीज पत्रक व ताळेबंद अचूक जुळेल.')) return;
    try {
      setIsSyncingGl(true);
      const res = await axios.post('/api/LoanAccounts/SyncAllGlOpeningBalances');
      alert(res.data?.message || 'सर्व खतावणी शिल्लक यशस्वीरित्या सिंक झाली!');
      fetchBalances();
      fetchGlReconciliation(formData.branchID, formData.loanRateID);
    } catch (err: any) {
      alert('सिंक करताना त्रुटी आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSyncingGl(false);
    }
  };
  const [formData, setFormData] = useState({
    loanOpeningBalanceID: 0,
    branchID: '1',
    customerID: '',
    loanRateID: '',
    loanAccountNo: '',
    legacyAccountNumber: '',
    purePrincipalBalance: '',
    capitalizedInterestAmount: '',
    principalBalance: '',
    interestBalance: '',
    overdueInterestBalance: '',
    interestProvisionBalance: '',
    initialNpaClassification: 'Standard',
    chargeInterestOnCapitalizedAmount: true,
    openingDate: '2025-03-31',

    loanDisbursementDate: '2025-03-31',
    sanctionedAmount: '',
    disbursedAmount: '',
    interestRate: '',
    durationMonths: '',
    noOfInstallments: '',
    installmentFrequency: 'मासिक',
    installmentAmount: '',
    firstInstallmentDate: '',
    maturityDate: '',
    lastInstallmentPaidDate: '',
    
    guarantor1: '',
    guarantor2: '',
    securityDetails: '',
    securityValue: ''
  });

  const API_URL = '/api/LoanAccounts/OpeningBalance';
  const GET_API_URL = '/api/LoanAccounts';
  const CUSTOMERS_API = '/api/Customers';
  const LOAN_RATES_API = '/api/LoanRates';
  const BRANCHES_API = '/api/Branches';
  const FINANCIAL_YEARS_API = '/api/FinancialYears';

  useEffect(() => {
    fetchFinancialYears();
    fetchBalances();
    fetchCustomers();
    fetchLoanRates();
    fetchBranches();
    fetchNextAccountNo();
  }, []);

  const fetchGlReconciliation = async (branchId?: string, loanRateId?: string) => {
    const rawBranch = branchId !== undefined ? branchId : formData.branchID;
    const bId = rawBranch && String(rawBranch).trim() !== '' && !isNaN(Number(rawBranch)) ? String(rawBranch).trim() : '1';
    
    const rawRate = loanRateId !== undefined ? loanRateId : formData.loanRateID;
    const rId = rawRate && String(rawRate).trim() !== '' && !isNaN(Number(rawRate)) ? String(rawRate).trim() : '0';

    try {
      setIsLoadingRecon(true);
      const res = await axios.get<GlReconciliationResponse>(`/api/LoanAccounts/GlReconciliationSummary?branchId=${bId}&loanRateId=${rId}`);
      setGlRecon(res.data);
    } catch (err) {
      console.error("Error fetching GL reconciliation summary:", err);
    } finally {
      setIsLoadingRecon(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const rawBranch = formData.branchID;
    const bId = rawBranch && String(rawBranch).trim() !== '' && !isNaN(Number(rawBranch)) ? String(rawBranch).trim() : '1';
    
    const rawRate = formData.loanRateID;
    const rId = rawRate && String(rawRate).trim() !== '' && !isNaN(Number(rawRate)) ? String(rawRate).trim() : '0';

    const runRecon = async () => {
      try {
        setIsLoadingRecon(true);
        const res = await axios.get<GlReconciliationResponse>(`/api/LoanAccounts/GlReconciliationSummary?branchId=${bId}&loanRateId=${rId}`);
        if (isMounted) {
          setGlRecon(res.data);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching GL reconciliation summary:", err);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRecon(false);
        }
      }
    };
    runRecon();
    return () => { isMounted = false; };
  }, [formData.branchID, formData.loanRateID]);

  const fetchFinancialYears = async () => {
    try {
      const res = await fetch(FINANCIAL_YEARS_API);
      if (res.ok) {
        const fyList = await res.json();
        if (Array.isArray(fyList) && fyList.length > 0) {
          const sorted = [...fyList].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
          const firstFy = sorted[0];
          if (firstFy && firstFy.startDate) {
            const fStart = new Date(firstFy.startDate);
            const cutoff = new Date(fStart.getTime() - 86400000); // 1 day before start date
            const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
            setCutoffDate(cutoffStr);
            setFirstFyInfo({ yearCode: firstFy.yearCode, startDate: firstFy.startDate.split('T')[0] });
            
            setFormData(prev => {
              if (prev.loanOpeningBalanceID === 0) {
                return {
                  ...prev,
                  openingDate: cutoffStr,
                  loanDisbursementDate: prev.loanDisbursementDate > cutoffStr ? cutoffStr : prev.loanDisbursementDate
                };
              }
              return prev;
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching financial years", err);
    }
  };

  const format14DigitDisplay = (val?: string) => {
    if (!val) return '';
    let clean = val.trim();
    if (clean.startsWith('{') && clean.includes('AccountNo')) {
      try {
        const parsed = JSON.parse(clean);
        clean = parsed.formattedAccountNo || parsed.nextAccountNo || parsed.accountNo || '';
      } catch {}
    }
    const digits = clean.replace(/\D/g, '');
    if (digits.length === 14) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 13)}-${digits.slice(13)}`;
    }
    return clean;
  };

  const fetchNextAccountNo = async (branchId?: string | number, loanRateId?: string | number) => {
    try {
      const bId = branchId || formData.branchID || '1';
      const lrId = loanRateId || formData.loanRateID || '';
      const url = lrId 
        ? `/api/LoanAccounts/next-account-no?branchId=${bId}&loanRateId=${lrId}`
        : `/api/LoanAccounts/next-account-no?branchId=${bId}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        let nextNo = '';
        if (typeof data === 'string') {
          if (data.startsWith('{') && data.includes('AccountNo')) {
            try {
              const parsed = JSON.parse(data);
              nextNo = parsed.formattedAccountNo || parsed.nextAccountNo || parsed.accountNo || '';
            } catch {
              nextNo = data;
            }
          } else {
            nextNo = data;
          }
        } else if (data && typeof data === 'object') {
          nextNo = data.formattedAccountNo || data.nextAccountNo || data.accountNo || '';
        }
        setFormData(prev => ({ ...prev, loanAccountNo: format14DigitDisplay(nextNo) }));
      }
    } catch (err) {
      console.error("Error fetching next loan account no", err);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch(BRANCHES_API);
      if (response.ok) {
        const data = await response.json();
        setBranches(data);
      }
    } catch (error) {
      console.error("Error fetching branches", error);
    }
  };

  const balances = loanFilterType === 'opening'
    ? allAccounts.filter((d: any) => d.isOpeningBalance === true)
    : (loanFilterType === 'regular' 
        ? allAccounts.filter((d: any) => d.isOpeningBalance !== true) 
        : allAccounts);

  const filteredBalances = balances.filter(balance => {
    const term = searchTerm.toLowerCase();
    const customerName = (balance.customer 
      ? `${balance.customer.firstName || ''} ${balance.customer.lastName || ''}` 
      : '').toLowerCase();
    const cifNo = (balance.customer?.cifNo || '').toLowerCase();
    const loanAccountNo = (balance.loanAccountNo || '').toLowerCase();
    const oldAccountNo = (balance.legacyAccountNumber || '').toLowerCase();
    return customerName.includes(term) || cifNo.includes(term) || loanAccountNo.includes(term) || oldAccountNo.includes(term);
  }).sort((a, b) => {
    const aVal = (a.legacyAccountNumber || '').trim();
    const bVal = (b.legacyAccountNumber || '').trim();

    // 1. Both have legacy account numbers -> Natural numeric sort (1, 2, 10, 269, 402)
    if (aVal && bVal) {
      return aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
    }
    // 2. Accounts with legacy account numbers come first
    if (aVal && !bVal) return -1;
    if (!aVal && bVal) return 1;

    // 3. Fallback: Sort by CBS loanAccountNo
    return (a.loanAccountNo || '').localeCompare(b.loanAccountNo || '', undefined, { numeric: true });
  });

  // [RULE-LOAN-LEGACY-DUP] Real-time detection of duplicate Old Loan Account No under the selected Loan Scheme
  const duplicateLegacyAccount = useMemo(() => {
    if (!formData.legacyAccountNumber || !formData.legacyAccountNumber.trim() || !formData.loanRateID) {
      return null;
    }
    const cleanLegacy = formData.legacyAccountNumber.trim().toLowerCase();
    const currentRateId = Number(formData.loanRateID);
    return (
      allAccounts.find(
        (acc) =>
          Number(acc.loanRateID) === currentRateId &&
          (acc.legacyAccountNumber || '').trim().toLowerCase() === cleanLegacy &&
          (!isEditing || acc.loanAccountID !== formData.loanOpeningBalanceID)
      ) || null
    );
  }, [formData.legacyAccountNumber, formData.loanRateID, formData.loanOpeningBalanceID, isEditing, allAccounts]);

  const fetchBalances = async () => {
    try {
      const response = await fetch(GET_API_URL);
      if (response.ok) {
        const data = await response.json();
        setAllAccounts(data);
      }
    } catch (error) {
      console.error("Error fetching balances", error);
    } finally {
      fetchGlReconciliation(formData.branchID, formData.loanRateID);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch(CUSTOMERS_API);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Error fetching customers", error);
    }
  };

  const fetchLoanRates = async () => {
    try {
      const response = await fetch(LOAN_RATES_API);
      if (response.ok) {
        const data = await response.json();
        setLoanRates(data);
      }
    } catch (error) {
      console.error("Error fetching loan rates", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string, value?: any, type?: string, checked?: boolean } }) => {
    const target = e.target as any;
    const name = target.name || '';
    const isCheckbox = target.type === 'checkbox';
    const value = isCheckbox ? target.checked : String(target.value ?? '');
    let updates: any = { [name]: value };

    if (name === 'branchID' && !isEditing) {
      fetchNextAccountNo(value, formData.loanRateID);
    }
    if (name === 'loanRateID' && !isEditing) {
      fetchNextAccountNo(formData.branchID, value);
    }
    
    if (name === 'interestBalance') {
      setIsInterestManuallyEdited(true);
    }

    if (name === 'installmentAmount') {
      setIsInstAmountEdited(true);
    }
    if (name === 'sanctionedAmount' || name === 'disbursedAmount' || name === 'loanRateID' || name === 'durationMonths' || name === 'installmentFrequency') {
      setIsInstAmountEdited(false);
    }
    if (name === 'sanctionedAmount') {
      if (!formData.disbursedAmount || formData.disbursedAmount === formData.sanctionedAmount) {
        updates.disbursedAmount = value;
      }
    }

    if (name === 'loanRateID') {
      const selectedRate = loanRates.find(r => r.loanRateID.toString() === value);
      if (selectedRate && ['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(selectedRate.collateralCategory || '')) {
        // Only auto-open modal if the scheme explicitly made collateral mandatory for opening balance
        if (selectedRate.isCollateralMandatoryForOpeningBalance && formData.customerID && depositCollaterals.length === 0) {
          setShowDepositModal(true);
        }
      }
    }

    // Auto-sum purePrincipalBalance + capitalizedInterestAmount into principalBalance
    if (name === 'purePrincipalBalance' || name === 'capitalizedInterestAmount') {
      const pPure = name === 'purePrincipalBalance' ? (parseFloat(value) || 0) : (parseFloat(formData.purePrincipalBalance) || 0);
      const pCap = name === 'capitalizedInterestAmount' ? (parseFloat(value) || 0) : (parseFloat(formData.capitalizedInterestAmount) || 0);
      const totalP = pPure + pCap;
      updates.principalBalance = totalP > 0 ? totalP.toString() : (pPure === 0 && pCap === 0 && (formData.purePrincipalBalance !== '' || formData.capitalizedInterestAmount !== '') ? '0' : '');
    }

    if (name === 'principalBalance') {
      const totalP = parseFloat(value) || 0;
      const pCap = parseFloat(formData.capitalizedInterestAmount) || 0;
      if (pCap > 0) {
        updates.purePrincipalBalance = Math.max(0, totalP - pCap).toString();
      } else {
        updates.purePrincipalBalance = totalP.toString();
      }
    }

    // Auto-fill Interest Rate and Duration when Loan Type is selected
    if (name === 'loanRateID') {
      const loanRate = loanRates.find(r => r.loanRateID.toString() === value);
      if (loanRate) {
        updates.interestRate = (loanRate.interestRate || 0).toString();
        updates.durationMonths = (loanRate.durationMonths || 12).toString();
        updates.installmentFrequency = loanRate.installmentType || formData.installmentFrequency || 'मासिक';
        if (loanRate.installmentCount) {
          updates.noOfInstallments = loanRate.installmentCount.toString();
        }
      }
    }

    // Cut-off Date Validation for Opening Balance dates
    if ((name === 'loanDisbursementDate' || name === 'lastInstallmentPaidDate' || name === 'openingDate') && value) {
      if (cutoffDate && value > cutoffDate) {
        const fieldLabels: Record<string, string> = {
          loanDisbursementDate: 'कर्ज वाटप दिनांक',
          lastInstallmentPaidDate: 'शेवटचा हप्ता भरल्याची दिनांक',
          openingDate: 'बाकी दिनांक (As of Date)'
        };
        const label = fieldLabels[name] || 'दिनांक';
        const formattedCutoff = new Date(cutoffDate).toLocaleDateString('en-GB');
        alert(`कर्ज आरंभिक शिल्लक नोंदणीमध्ये ${label} ही कट-ऑफ दिनांक (${formattedCutoff}) च्या पुढील किंवा पहिल्या आर्थिक वर्षाच्या सुरुवातीची तारीख असू शकत नाही!`);
        updates[name] = cutoffDate;
      }
    }

    if (name === 'loanDisbursementDate' && (updates.loanDisbursementDate || value)) {
      const actualVal = updates.loanDisbursementDate || value;
      const date = new Date(actualVal);
      if (!isNaN(date.getTime())) {
        const freq = (formData.installmentFrequency || '').toLowerCase();
        if (freq.includes('साप्ताहिक') || freq.includes('weekly')) {
          date.setDate(date.getDate() + 7);
        } else if (freq.includes('त्रैमासिक') || freq.includes('quarterly')) {
          date.setMonth(date.getMonth() + 3);
        } else if (freq.includes('सहामाही') || freq.includes('half')) {
          date.setMonth(date.getMonth() + 6);
        } else if (freq.includes('वार्षिक') || freq.includes('yearly') || freq.includes('annual')) {
          date.setFullYear(date.getFullYear() + 1);
        } else {
          date.setMonth(date.getMonth() + 1);
        }
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        updates.firstInstallmentDate = formattedDate;
      }
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Auto-calculate noOfInstallments from durationMonths and installmentFrequency
  useEffect(() => {
    if (formData.durationMonths && formData.installmentFrequency) {
      let div = 1;
      if (formData.installmentFrequency === 'साप्ताहिक') div = 0.2307;
      else if (formData.installmentFrequency === 'त्रैमासिक') div = 3;
      else if (formData.installmentFrequency === 'सहामाही') div = 6;
      else if (formData.installmentFrequency === 'वार्षिक') div = 12;

      const calculatedInst = formData.installmentFrequency === 'साप्ताहिक'
        ? Math.max(1, Math.round(Number(formData.durationMonths) * 4.33))
        : Math.max(1, Math.floor(Number(formData.durationMonths) / div));

      if (formData.noOfInstallments !== calculatedInst.toString()) {
        setFormData(prev => ({ ...prev, noOfInstallments: calculatedInst.toString() }));
      }
    }
  }, [formData.durationMonths, formData.installmentFrequency]);

  useEffect(() => {
    calculateEMI();
  }, [
    formData.sanctionedAmount, 
    formData.disbursedAmount,
    formData.interestRate, 
    formData.durationMonths, 
    formData.noOfInstallments, 
    formData.installmentFrequency, 
    formData.loanRateID, 
    formData.loanDisbursementDate, 
    formData.firstInstallmentDate,
    formData.installmentAmount
  ]);

  useEffect(() => {
    const baseDateStr = formData.loanDisbursementDate || formData.openingDate;
    if (baseDateStr) {
      const date = new Date(baseDateStr);
      if (!isNaN(date.getTime())) {
        const freq = (formData.installmentFrequency || '').toLowerCase();
        
        if (freq.includes('साप्ताहिक') || freq.includes('weekly')) {
          date.setDate(date.getDate() + 7);
        } else if (freq.includes('त्रैमासिक') || freq.includes('quarterly')) {
          date.setMonth(date.getMonth() + 3);
        } else if (freq.includes('सहामाही') || freq.includes('half')) {
          date.setMonth(date.getMonth() + 6);
        } else if (freq.includes('वार्षिक') || freq.includes('yearly') || freq.includes('annual')) {
          date.setFullYear(date.getFullYear() + 1);
        } else {
          date.setMonth(date.getMonth() + 1);
        }
        
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (!formData.firstInstallmentDate || (formData.loanDisbursementDate && formData.firstInstallmentDate < formData.loanDisbursementDate)) {
          setFormData(prev => ({ ...prev, firstInstallmentDate: formattedDate }));
        }
      }
    }
  }, [formData.loanDisbursementDate, formData.openingDate, formData.installmentFrequency]);

  useEffect(() => {
    if (formData.firstInstallmentDate && formData.installmentFrequency) {
      const firstDate = new Date(formData.firstInstallmentDate);
      if (!isNaN(firstDate.getTime())) {
        let n = parseInt(formData.noOfInstallments) || 0;
        if (n <= 0) {
          const months = parseInt(formData.durationMonths) || 0;
          let step = 1;
          if (formData.installmentFrequency === 'साप्ताहिक') n = Math.max(1, Math.round(months * 4.33));
          else {
            if (formData.installmentFrequency === 'त्रैमासिक') step = 3;
            else if (formData.installmentFrequency === 'सहामाही') step = 6;
            else if (formData.installmentFrequency === 'वार्षिक') step = 12;
            n = Math.max(1, Math.floor(months / step));
          }
        }

        if (n > 0) {
          const matDate = new Date(firstDate);
          if (formData.installmentFrequency === 'साप्ताहिक') {
            matDate.setDate(matDate.getDate() + (n - 1) * 7);
          } else if (formData.installmentFrequency === 'मासिक') {
            matDate.setMonth(matDate.getMonth() + (n - 1));
          } else if (formData.installmentFrequency === 'त्रैमासिक') {
            matDate.setMonth(matDate.getMonth() + (n - 1) * 3);
          } else if (formData.installmentFrequency === 'सहामाही') {
            matDate.setMonth(matDate.getMonth() + (n - 1) * 6);
          } else if (formData.installmentFrequency === 'वार्षिक') {
            matDate.setFullYear(matDate.getFullYear() + (n - 1));
          }

          const formattedDate = `${matDate.getFullYear()}-${String(matDate.getMonth() + 1).padStart(2, '0')}-${String(matDate.getDate()).padStart(2, '0')}`;
          if (formData.maturityDate !== formattedDate) {
            setFormData(prev => ({ ...prev, maturityDate: formattedDate }));
          }
        }
      }
    }
  }, [formData.firstInstallmentDate, formData.durationMonths, formData.installmentFrequency, formData.noOfInstallments]);

  const calculateAccurateInterest = (forceRecalc = true) => {
    if (isInterestManuallyEdited && !forceRecalc) {
      return;
    }

    const openDateStr = formData.openingDate;
    if (!openDateStr) return;

    const openDate = new Date(openDateStr);
    const principal = parseFloat(formData.principalBalance) || 0;
    const rate = parseFloat(formData.interestRate) || 0;

    if (principal <= 0 || rate <= 0) return;

    const matDateStr = formData.maturityDate;
    const matDate = matDateStr ? new Date(matDateStr) : null;
    const lastPaidStr = formData.lastInstallmentPaidDate;
    const lastPaidDate = lastPaidStr ? new Date(lastPaidStr) : null;
    const disburseStr = formData.loanDisbursementDate;
    const disburseDate = disburseStr ? new Date(disburseStr) : null;

    // Tier 1: Scheduled Pre-Maturity Unpaid Interest
    let scheduledInterest = 0;
    if (installmentChart && installmentChart.length > 0) {
      const cutoffForSchedule = (matDate && openDate > matDate) ? matDate : openDate;
      const baselineDate = lastPaidDate ? lastPaidDate : (disburseDate ? disburseDate : new Date(0));
      
      installmentChart.forEach(row => {
        const [day, month, year] = row.date.split('/');
        const rowDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        rowDate.setHours(0, 0, 0, 0);

        const cmpBaseline = new Date(baselineDate);
        cmpBaseline.setHours(0, 0, 0, 0);

        const cmpCutoff = new Date(cutoffForSchedule);
        cmpCutoff.setHours(23, 59, 59, 999);

        if (rowDate <= cmpCutoff && rowDate > cmpBaseline) {
          scheduledInterest += parseFloat(row.interest || '0');
        }
      });
    }

    // Tier 2: Post-Maturity Overdue Interest
    let postMaturityInterest = 0;
    let overdueDays = 0;
    if (matDate && openDate > matDate && principal > 0 && rate > 0) {
      const overdueStartDate = (lastPaidDate && lastPaidDate > matDate) ? new Date(lastPaidDate) : new Date(matDate);
      overdueStartDate.setHours(0, 0, 0, 0);

      const openDateNorm = new Date(openDate);
      openDateNorm.setHours(0, 0, 0, 0);

      const diffMs = openDateNorm.getTime() - overdueStartDate.getTime();
      overdueDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

      if (overdueDays > 0) {
        // Standard Banking Daily Simple Interest Formula: (P * R * Days) / (365 * 100)
        postMaturityInterest = Math.round((principal * rate * overdueDays) / (365 * 100));
      }
    }

    const totalInterest = Math.max(0, Math.round(scheduledInterest + postMaturityInterest));

    setIsInterestManuallyEdited(true);

    setFormData(prev => {
      const updates: any = { interestBalance: totalInterest.toString() };
      if (postMaturityInterest > 0 && (!prev.overdueInterestBalance || prev.overdueInterestBalance === '0')) {
        updates.overdueInterestBalance = postMaturityInterest.toString();
      }
      return { ...prev, ...updates };
    });
  };

  // NOTE: Automatic calculateAccurateInterest useEffect is intentionally removed
  // to allow 100% manual entry without background calculation overwriting saved values.

  const calculateEMI = async () => {
    const calcBasePrincipal = (parseFloat(formData.disbursedAmount) > 0 ? parseFloat(formData.disbursedAmount) : parseFloat(formData.sanctionedAmount)) || 0;
    const rate = parseFloat(formData.interestRate) || 0;
    const months = parseInt(formData.durationMonths) || 0;
    
    if (calcBasePrincipal <= 0 || rate <= 0 || months <= 0 || !formData.loanRateID) {
      if(!isEditing) setFormData(prev => ({ ...prev, installmentAmount: '' }));
      setInstallmentChart([]);
      return;
    }

    let count = parseInt(formData.noOfInstallments) || 0;
    if (count <= 0) {
      if (formData.installmentFrequency === 'साप्ताहिक') {
        count = Math.max(1, Math.round(months * 4.33));
      } else {
        let step = 1;
        if (formData.installmentFrequency === 'त्रैमासिक') step = 3;
        else if (formData.installmentFrequency === 'सहामाही') step = 6;
        else if (formData.installmentFrequency === 'वार्षिक') step = 12;
        count = Math.max(1, Math.floor(months / step));
      }
    }

    try {
      const customInst = isInstAmountEdited ? (parseFloat(formData.installmentAmount) || 0) : 0;
      const payload = {
        loanRateID: parseInt(formData.loanRateID),
        loanAmount: calcBasePrincipal,
        interestRate: rate,
        noOfInstallments: count,
        durationMonths: months,
        installmentFrequency: formData.installmentFrequency || 'मासिक',
        loanDisbursementDate: formData.loanDisbursementDate || new Date().toISOString().split('T')[0],
        firstInstallmentDate: formData.firstInstallmentDate ? formData.firstInstallmentDate : null,
        customInstallmentAmount: customInst > 0 ? customInst : null
      };

      const res = await axios.post('/api/LoanAccounts/PreviewSchedule', payload);
      
      const mappedChart = res.data.map((row: any) => {
        const roundedPrincipal = Math.round(row.principal);
        const roundedInterest = Math.round(row.interest);
        const roundedTotal = roundedPrincipal + roundedInterest;
        return {
          no: row.no,
          date: new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          principal: roundedPrincipal.toString(),
          interest: roundedInterest.toString(),
          total: roundedTotal.toString(),
          balance: Math.round(row.balance).toString(),
          principalValue: roundedPrincipal,
          openingBalance: Math.round(row.openingBalance),
          closingBalance: Math.round(row.closingBalance),
          days: row.days,
          interestRate: row.interestRate
        };
      });

      if (mappedChart.length > 0 && !isInstAmountEdited) {
        const firstRow = mappedChart[0];
        const rateObj = loanRates.find(r => r.loanRateID.toString() === formData.loanRateID);
        let instAmount = Math.round(parseFloat(firstRow.total) || 0);
        
        if (rateObj) {
          const calcMethod = rateObj.interestCalculationMethod || "Reducing (घटती शिल्लक)";
          const instType = rateObj.loanInstallmentType || "समान हप्ता";
          if (calcMethod.includes("Reducing") && (instType === "समान मुद्दल" || instType === "कर्जावरती" || instType.includes("मुद्दल") || instType.includes("कर्जावर"))) {
            instAmount = Math.round(parseFloat(firstRow.principal) || 0);
          }
        }

        if (formData.installmentAmount !== instAmount.toString()) {
          setFormData(prev => ({ ...prev, installmentAmount: instAmount.toString() }));
        }
      }
      setInstallmentChart(mappedChart);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNew = () => {
    setIsInstAmountEdited(false);
    setIsInterestManuallyEdited(false);
    setFormData({
      loanOpeningBalanceID: 0,
      branchID: '1',
      customerID: '',
      loanRateID: '',
      loanAccountNo: '',
      legacyAccountNumber: '',
      purePrincipalBalance: '',
      capitalizedInterestAmount: '',
      principalBalance: '',
      interestBalance: '',
      overdueInterestBalance: '',
      interestProvisionBalance: '',
      initialNpaClassification: 'Standard',
      chargeInterestOnCapitalizedAmount: true,
      openingDate: getDefaultDate(),
      loanDisbursementDate: getTodayDate(),
      sanctionedAmount: '',
      disbursedAmount: '',
      interestRate: '',
      durationMonths: '',
      noOfInstallments: '',
      installmentFrequency: 'मासिक',
      installmentAmount: '',
      firstInstallmentDate: '',
      maturityDate: '',
      lastInstallmentPaidDate: '',
      guarantor1: '',
      guarantor2: '',
      securityDetails: '',
      securityValue: ''
    });
    setGoldItems([]);
    setEditingGoldId(null);
    setDepositCollaterals([]);
    setShowDepositModal(false);
    stopCamera();
    setGoldForm({
      itemName: 'सोन्याची साखळी (Chain)',
      purity: '22K (91.6%)',
      quantity: 1,
      grossWeight: '',
      netWeight: '',
      ratePerGram: 6000,
      valuationAmount: '',
      remarks: '',
      imagePath: '',
      valuerName: '',
      valuerValuation: '',
      valuationReceiptNo: '',
      valuationDate: ''
    });
    setIsEditing(false);
    fetchNextAccountNo();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerID || !formData.loanRateID || !formData.loanAccountNo) {
        alert("कृपया कर्जदार खातेदार व आवश्यक माहिती भरा!");
        return;
    }

    // [RULE-LOAN-LEGACY-DUP] Validation: Prevent duplicate Old Loan Account No under the same loan scheme
    if (formData.legacyAccountNumber && formData.legacyAccountNumber.trim()) {
      const cleanLegacy = formData.legacyAccountNumber.trim().toLowerCase();
      const currentRateId = Number(formData.loanRateID);
      const duplicateAcc = allAccounts.find(
        (acc) =>
          Number(acc.loanRateID) === currentRateId &&
          (acc.legacyAccountNumber || '').trim().toLowerCase() === cleanLegacy &&
          (!isEditing || acc.loanAccountID !== formData.loanOpeningBalanceID)
      );
      if (duplicateAcc) {
        const selectedRate = loanRates.find(r => r.loanRateID.toString() === formData.loanRateID);
        const schemeName = selectedRate ? `${selectedRate.loanCode} - ${selectedRate.shortName || selectedRate.loanType}` : 'सदर कर्ज योजना';
        const custName = duplicateAcc.customer 
          ? `${duplicateAcc.customer.firstName || ''} ${duplicateAcc.customer.lastName || ''}`.trim()
          : '';
        alert(`जुना कर्ज खाते क्र. '${formData.legacyAccountNumber.trim()}' हा '${schemeName}' या कर्ज योजनेमध्ये आधीच खाते क्र. ${format14DigitDisplay(duplicateAcc.loanAccountNo)} ${custName ? `(${custName})` : ''} साठी नोंदवलेला आहे!\n\nएकाच कर्ज योजनेमध्ये जुना कर्ज खाते क्र. डबल (डुप्लिकेट) घेता येत नाही.`);
        return;
      }
    }

    const selectedRate = loanRates.find(r => r.loanRateID.toString() === formData.loanRateID);
    const isDepositScheme = selectedRate && ['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(selectedRate.collateralCategory || '');
    if (isDepositScheme && selectedRate.isCollateralMandatoryForOpeningBalance && depositCollaterals.length === 0) {
      alert(`सदर कर्ज योजनेसाठी (${selectedRate.shortName || selectedRate.loanType}) आरंभिक शिल्लक नोंदणीतही तारण ठेव जोडणे अनिवार्य केले आहे. कृपया ठेव जोडा किंवा 'कर्ज दर/प्रकार' सेटिंग्जमध्ये हे ऐच्छिक करा.`);
      setShowDepositModal(true);
      return;
    }

    if (cutoffDate) {
      const formattedCutoff = new Date(cutoffDate).toLocaleDateString('en-GB');
      if (formData.loanDisbursementDate && formData.loanDisbursementDate > cutoffDate) {
        alert(`कर्ज वाटप दिनांक ही कट-ऑफ दिनांक (${formattedCutoff}) च्या आधीची किंवा त्या दिनांकाचीच असावी!`);
        return;
      }
      if (formData.openingDate && formData.openingDate > cutoffDate) {
        alert(`बाकी दिनांक (As of Date) ही कट-ऑफ दिनांक (${formattedCutoff}) च्या आधीची किंवा त्या दिनांकाचीच असावी!`);
        return;
      }
      if (formData.lastInstallmentPaidDate && formData.lastInstallmentPaidDate > cutoffDate) {
        alert(`शेवटचा हप्ता भरल्याची दिनांक ही कट-ऑफ दिनांक (${formattedCutoff}) च्या आधीची किंवा त्या दिनांकाचीच असावी!`);
        return;
      }
    }

    const sancAmt = parseFloat(formData.sanctionedAmount || '0');
    const disbAmt = parseFloat(formData.disbursedAmount || formData.sanctionedAmount || '0');
    const princBal = parseFloat(formData.principalBalance || '0');
    const pureBal = parseFloat(formData.purePrincipalBalance || formData.principalBalance || '0');

    if (sancAmt <= 0) {
      alert("कृपया वैध कर्ज मंजूर रक्कम टाका!");
      return;
    }
    if (disbAmt <= 0) {
      alert("कृपया वैध कर्ज वाटप रक्कम टाका!");
      return;
    }
    if (disbAmt > sancAmt) {
      alert(`कर्ज वाटप रक्कम (₹ ${disbAmt.toLocaleString('en-IN')}) मंजूर रकमेपेक्षा (₹ ${sancAmt.toLocaleString('en-IN')}) जास्त असू शकत नाही!`);
      return;
    }
    if (pureBal > disbAmt) {
      alert(`शुद्ध मुद्दल बाकी (₹ ${pureBal.toLocaleString('en-IN')}) वाटप रकमेपेक्षा (₹ ${disbAmt.toLocaleString('en-IN')}) जास्त असू शकत नाही!`);
      return;
    }
    if (parseFloat(formData.capitalizedInterestAmount || '0') <= 0 && princBal > disbAmt) {
      alert(`एकूण मुद्दल बाकी (₹ ${princBal.toLocaleString('en-IN')}) वाटप रकमेपेक्षा (₹ ${disbAmt.toLocaleString('en-IN')}) जास्त असू शकत नाही!`);
      return;
    }
    
    try {
      const dataToSubmit = {
        ...formData,
        legacyAccountNumber: formData.legacyAccountNumber || null,
        loanOpeningBalanceID: isEditing ? formData.loanOpeningBalanceID : 0,
        branchID: parseInt(formData.branchID),
        customerID: parseInt(formData.customerID),
        loanRateID: parseInt(formData.loanRateID),
        
        purePrincipalBalance: parseFloat(formData.purePrincipalBalance || formData.principalBalance || '0'),
        capitalizedInterestAmount: parseFloat(formData.capitalizedInterestAmount || '0'),
        principalBalance: parseFloat(formData.principalBalance || '0'),
        interestBalance: parseFloat(formData.interestBalance || '0'),
        overdueInterestBalance: parseFloat(formData.overdueInterestBalance || '0'),
        interestProvisionBalance: parseFloat(formData.interestProvisionBalance || '0'),
        initialNpaClassification: formData.initialNpaClassification || 'Standard',
        chargeInterestOnCapitalizedAmount: Boolean(formData.chargeInterestOnCapitalizedAmount),
        
        sanctionedAmount: sancAmt,
        disbursedAmount: disbAmt,
        interestRate: parseFloat(formData.interestRate || '0'),
        durationMonths: parseInt(formData.durationMonths || '0'),
        installmentAmount: parseFloat(formData.installmentAmount || '0'),
        securityValue: parseFloat(formData.securityValue || '0'),
        noOfInstallments: installmentChart.length,
        guarantor1CustomerID: formData.guarantor1 ? parseInt(formData.guarantor1) : null,
        guarantor2CustomerID: formData.guarantor2 ? parseInt(formData.guarantor2) : null,
        goldItems: goldItems.map(g => {
          let purityNum = 22;
          if (typeof g.purity === 'string') {
            const match = g.purity.match(/(\d+(\.\d+)?)/);
            if (match) purityNum = parseFloat(match[1]);
          } else if (typeof g.purity === 'number') {
            purityNum = g.purity;
          }
          const rawId = g.id && !String(g.id).startsWith('temp_') ? Number(g.id) : 0;
          const safeGoldDetailId =
            Number.isInteger(rawId) && rawId > 0 && rawId <= 2147483647 ? rawId : 0;
          return {
            goldLoanDetailID: safeGoldDetailId,
            ornamentName: g.itemName,
            quantity: g.quantity || 1,
            grossWeight: g.grossWeight || 0,
            netWeight: g.netWeight || 0,
            purity: purityNum,
            goldRatePerGram: g.ratePerGram || 0,
            estimatedValue: g.valuationAmount || (g.netWeight * g.ratePerGram) || 0,
            remarks: g.remarks || '',
            imagePath: g.imagePath || '',
            valuerName: g.valuerName || '',
            valuerValuation: g.valuerValuation || 0,
            valuationReceiptNo: g.valuationReceiptNo || '',
            valuationDate: g.valuationDate || null
          };
        }),
        
        depositCollaterals: depositCollaterals.map((c: any) => ({
          collateralID: c.collateralID || c.CollateralID || 0,
          customerID: Number(formData.customerID) || 0,
          collateralType: c.depositType || c.collateralType || c.CollateralType || 'FixedDeposit',
          depositAccountID: c.depositAccountID || c.DepositAccountID,
          depositAccountNo: c.accountNo || c.depositAccountNo || c.DepositAccountNo,
          depositAmount: c.depositAmount || c.DepositAmount || 0,
          currentDepositBalance: c.currentBalance || c.currentDepositBalance || c.CurrentDepositBalance || 0,
          maturityDate: c.maturityDate || c.MaturityDate || null,
          lienAmount: c.lienAmount || c.LienAmount || c.currentBalance || c.depositAmount || 0,
          lienStatus: 'LienMarked',
          remarks: c.remarks || c.Remarks || 'Loan Opening Balance Collateral'
        })),

        loanDisbursementDate: formData.loanDisbursementDate || null,
        firstInstallmentDate: formData.firstInstallmentDate || null,
        maturityDate: formData.maturityDate || null,
        lastInstallmentPaidDate: formData.lastInstallmentPaidDate || null,
        schedule: installmentChart.map((row: any) => {
          let dateStr = row.date;
          if (row.date && typeof row.date === 'string' && row.date.includes('/')) {
            const parts = row.date.split('/');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`;
            }
          } else if (row.date && typeof row.date === 'string' && !row.date.includes('T')) {
            dateStr = `${row.date}T00:00:00`;
          }
          return {
            no: row.no,
            date: dateStr,
            principal: parseFloat(row.principal) || 0,
            interest: parseFloat(row.interest) || 0,
            total: parseFloat(row.total) || 0,
            balance: parseFloat(row.balance) || 0,
            openingBalance: parseFloat(row.openingBalance) || 0,
            closingBalance: parseFloat(row.closingBalance) || 0,
            days: row.days || 0,
            interestRate: row.interestRate || parseFloat(formData.interestRate) || 0
          };
        })
      };

      const isEditMode = isEditing && Boolean(formData.loanOpeningBalanceID && Number(formData.loanOpeningBalanceID) > 0);
      const targetUrl = isEditMode ? `${API_URL}/${formData.loanOpeningBalanceID}` : API_URL;
      const targetMethod = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(targetUrl, {
        method: targetMethod,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSubmit)
      });

      if (response.ok) {
        alert(isEditMode ? 'कर्ज खाते यशस्वीरित्या अद्यतनित (Updated) झाले असून मुख्य खतावणी (GL) शिल्लक तेरीज व ताळेबंदशी सिंक झाली आहे!' : 'नवीन कर्ज आरंभिक शिल्लक यशस्वीरित्या नोंदवली गेली असून मुख्य खतावणीत (GL) तेरीज व ताळेबंदसाठी शिल्लक थेट जोडली गेली आहे!');
        fetchBalances();
        fetchGlReconciliation(formData.branchID, formData.loanRateID);
        handleNew();
      } else {
        const errText = await response.text();
        let displayError = errText;
        try {
          const parsed = JSON.parse(errText);
          if (parsed.message) displayError = parsed.message;
        } catch {}
        alert('त्रुटी आली: ' + displayError);
      }
    } catch (error) {
      console.error("Error saving loan opening balance", error);
      alert("सर्व्हरशी संपर्क साधता आला नाही.");
    }
  };

  const handleEdit = async (balance: any) => {
    setIsInstAmountEdited(false);
    setIsInterestManuallyEdited(true);
    const custId = balance.customerID || balance.customer?.customerID;
    setFormData({
      loanOpeningBalanceID: balance.loanOpeningBalanceID || balance.loanAccountID,
      branchID: balance.branchID.toString(),
      customerID: custId ? custId.toString() : '',
      loanRateID: balance.loanRateID.toString(),
      loanAccountNo: balance.loanAccountNo,
      legacyAccountNumber: balance.legacyAccountNumber || '',
      purePrincipalBalance: (balance.purePrincipalBalance ?? balance.principalBalance ?? '').toString(),
      capitalizedInterestAmount: (balance.capitalizedInterestAmount ?? 0).toString(),
      principalBalance: balance.principalBalance.toString(),
      interestBalance: (balance.interestBalance ?? 0).toString(),
      overdueInterestBalance: (balance.overdueInterestBalance || 0).toString(),
      interestProvisionBalance: (balance.interestProvisionBalance ?? 0).toString(),
      initialNpaClassification: balance.initialNpaClassification || 'Standard',
      chargeInterestOnCapitalizedAmount: balance.chargeInterestOnCapitalizedAmount ?? true,
      openingDate: balance.openingDate ? balance.openingDate.split('T')[0] : '',
      loanDisbursementDate: balance.loanDisbursementDate ? balance.loanDisbursementDate.split('T')[0] : '',
      sanctionedAmount: balance.sanctionedAmount.toString(),
      disbursedAmount: getDisbursedAmt(balance).toString(),
      interestRate: balance.interestRate.toString(),
      durationMonths: balance.durationMonths.toString(),
      noOfInstallments: (balance as any).noOfInstallments?.toString() || '',
      installmentFrequency: balance.installmentFrequency || 'मासिक',
      installmentAmount: balance.installmentAmount.toString(),
      firstInstallmentDate: balance.firstInstallmentDate ? balance.firstInstallmentDate.split('T')[0] : '',
      maturityDate: balance.maturityDate ? balance.maturityDate.split('T')[0] : '',
      lastInstallmentPaidDate: balance.lastInstallmentPaidDate ? balance.lastInstallmentPaidDate.split('T')[0] : '',
      guarantor1: (balance as any).guarantor1CustomerID?.toString() || '',
      guarantor2: (balance as any).guarantor2CustomerID?.toString() || '',
      securityDetails: balance.securityDetails || '',
      securityValue: balance.securityValue?.toString() || ''
    });
    setIsEditing(true);
    setShowListModal(false);

    // Fetch Gold Details if any
    try {
      const goldRes = await axios.get(`/api/GoldLoanDetails/ByLoanAccount/${balance.loanAccountID}`);
      if (goldRes.data && Array.isArray(goldRes.data) && goldRes.data.length > 0) {
        const mappedGold: GoldLoanItem[] = goldRes.data.map((g: any) => ({
          id: g.goldLoanDetailID ? String(g.goldLoanDetailID) : `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          itemName: g.ornamentName || 'सोन्याचे अलंकार',
          purity: g.purity ? `${g.purity}K` : '22K (91.6%)',
          quantity: g.quantity || 1,
          grossWeight: Number(g.grossWeight) || 0,
          netWeight: Number(g.netWeight) || 0,
          ratePerGram: Number(g.goldRatePerGram) || 0,
          valuationAmount: Number(g.estimatedValue) || 0,
          remarks: g.remarks || '',
          imagePath: g.imagePath || '',
          valuerName: g.valuerName || '',
          valuerValuation: Number(g.valuerValuation) || 0,
          valuationReceiptNo: g.valuationReceiptNo || '',
          valuationDate: g.valuationDate ? g.valuationDate.split('T')[0] : ''
        }));
        setGoldItems(mappedGold);
      } else {
        setGoldItems([]);
      }
    } catch (err) {
      console.error("Error fetching gold details for loan:", err);
      setGoldItems([]);
    }

    // Fetch Deposit Collaterals if any
    try {
      const colRes = await axios.get(`/api/LoanCollaterals/ByAccount/${balance.loanAccountID}`);
      if (colRes.data && Array.isArray(colRes.data) && colRes.data.length > 0) {
        setDepositCollaterals(colRes.data);
      } else {
        setDepositCollaterals([]);
      }
    } catch {
      setDepositCollaterals([]);
    }

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (interestBalanceInputRef.current) {
        interestBalanceInputRef.current.focus();
        interestBalanceInputRef.current.select();
      }
    }, 120);
  };

  const handleDelete = async (id: number) => {
    if(window.confirm('तुम्हाला नक्की डिलीट करायचे आहे का?')) {
      try {
        const response = await fetch(`${GET_API_URL}/${id}`, {
          method: 'DELETE'
        });
        if(response.ok) {
          alert('खाते यशस्वीरित्या डिलीट झाले असून मुख्य खतावणीतून (GL) शिल्लक वजा करण्यात आली आहे!');
          fetchBalances();
          fetchGlReconciliation(formData.branchID, formData.loanRateID);
          handleNew();
        } else {
          const errText = await response.text();
          alert('डिलीट करताना त्रुटी आली: ' + errText);
        }
      } catch (error) {
        console.error("Error deleting loan opening balance", error);
      }
    }
  };

  const handleExportExcel = () => {
    if (filteredBalances.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const rows = filteredBalances.map((b, i) => ({
      'अ.क्र.': i + 1,
      'दिनांक': new Date(b.openingDate).toLocaleDateString('en-GB'),
      'शाखा': b.branch?.branchName || '-',
      'खातेदार (ग्राहक)': b.customer 
        ? `${b.customer.firstName || ''} ${b.customer.lastName || ''}`.trim() 
        : '-',
      'प्रकार': b.isOpeningBalance ? 'आरंभिक शिल्लक (OB)' : 'नियमित कर्ज (Regular)',
      'कर्ज प्रकार': `${b.loanRate?.loanCode || ''} - ${b.loanRate?.shortName || ''}`,
      'खाते क्र.': b.loanAccountNo,
      'जुना खाते क्र.': b.legacyAccountNumber || '-',
      'मंजूर रक्कम (₹)': b.sanctionedAmount,
      'वाटप रक्कम (₹)': getDisbursedAmt(b),
      'कर्ज वाटप दिनांक': b.loanDisbursementDate ? new Date(b.loanDisbursementDate).toLocaleDateString('en-GB') : '-',
      'शुद्ध मुद्दल बाकी (₹)': b.purePrincipalBalance || b.principalBalance,
      'समाविष्ट व्याज (₹)': b.capitalizedInterestAmount || 0,
      'एकूण मुद्दल बाकी (₹)': b.principalBalance,
      'व्याज बाकी (₹)': b.interestBalance,
      'व्याज तरतूद (₹)': b.interestProvisionBalance || 0,
      'NPA वर्गवारी': b.initialNpaClassification || 'Standard'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LoanOpeningBalances');
    XLSX.writeFile(wb, `Loan_Opening_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const inputClass = "w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] h-[28px] bg-white";
  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";

  const customerOptions = customers.map(c => ({
      value: c.customerID.toString(),
      label: `${c.cifNo ? '[' + c.cifNo + '] ' : ''}${c.firstName} ${c.middleName ? c.middleName + ' ' : ''}${c.lastName}`.trim()
  }));

  const guarantorOptions = customers.map(c => ({
      value: c.customerID.toString(),
      label: `${c.cifNo ? '[' + c.cifNo + '] ' : ''}${c.firstName} ${c.middleName ? c.middleName + ' ' : ''}${c.lastName}`.trim()
  }));

  const loanRateOptions = loanRates.map(r => ({
      value: r.loanRateID.toString(),
      label: `${r.loanCode} - ${r.shortName || r.loanType}`
  }));

  // KPI Calculations
  const openingAccounts = allAccounts.filter((d: any) => d.isOpeningBalance === true);
  const totalSanctioned = allAccounts.reduce((sum, a) => sum + (a.sanctionedAmount || 0), 0);
  const totalPrincipal = allAccounts.reduce((sum, a) => sum + (a.principalBalance || 0), 0);
  const totalInterest = allAccounts.reduce((sum, a) => sum + (a.interestBalance || 0), 0);

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <CreditCard size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>कर्ज आरंभिक शिल्लक नोंदणी</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Loan Opening Balance Master)</span>
              {isEditing && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.loanOpeningBalanceID})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">जुनी कर्ज शिल्लक, मुद्दल, देय व्याज, जामीनदार व सिक्युरिटी माहिती स्थलांतर</p>
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
            title="नवीन नोंद फॉर्म रिकामा करा"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          {/* VIEW LIST BUTTON -> Opens Pop-up List Modal */}
          <button
            type="button"
            onClick={() => {
              fetchBalances();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व नोंदवलेली कर्ज बाकी यादी पॉप-अप मध्ये पहा"
          >
            <List className="w-4 h-4" />
            <span>📋 नोंदवलेली कर्ज यादी पहा ({allAccounts.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">नोंदवलेली एकूण कर्ज खाती</div>
            <div className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <span>{allAccounts.length}</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1 py-0.2 rounded border border-emerald-200 font-normal">आरंभिक बाकी: {openingAccounts.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण मंजूर रक्कम (₹)</div>
            <div className="text-sm font-black text-indigo-950">₹ {totalSanctioned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण मुद्दल बाकी (₹)</div>
            <div className="text-sm font-black text-emerald-800">₹ {totalPrincipal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण येणे व्याज बाकी (₹)</div>
            <div className="text-sm font-black text-amber-800">₹ {totalInterest.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>




      {/* Main Single Form Container (Full Width Clean Layout) */}
      <div ref={formContainerRef} className="w-full">
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Section 1: Basic Info */}
          <div className={`p-3 rounded-sm shadow-xs border transition-all duration-300 ${
            isEditing ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'bg-white border-gray-200 border-t-2 border-primary'
          }`}>
            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5 mb-2.5">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">१. प्राथमिक व खातेदार माहिती (Basic Details)</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-2.5 gap-y-2.5">
              <div className="lg:col-span-1 sm:col-span-1">
                <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                <select name="branchID" value={formData.branchID} onChange={handleChange} className={inputClass} required disabled={isEditing}>
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID.toString()}>{b.branchName}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2 sm:col-span-2">
                <label className={labelClass}>कर्जदार खातेदार (Borrower Customer) <span className="text-red-500">*</span></label>
                <SearchableSelect 
                  id="loan-borrower-customer"
                  name="customerID" 
                  value={formData.customerID} 
                  onChange={(e: any) => {
                    const cIdStr = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      customerID: cIdStr
                    }));
                  }} 
                  options={customerOptions} 
                  placeholder="कर्जदार खातेदार निवडा (CIF किंवा नाव)..." 
                  disabled={isEditing} 
                />
              </div>
              <div className="lg:col-span-1 sm:col-span-1">
                <label className={labelClass}>कर्ज प्रकार (Loan Type) <span className="text-red-500">*</span></label>
                <SearchableSelect 
                  id="loan-rate-scheme"
                  name="loanRateID" 
                  value={formData.loanRateID} 
                  onChange={handleChange} 
                  options={loanRateOptions} 
                  disabled={isEditing} 
                />
              </div>
              <div className="lg:col-span-1 sm:col-span-1">
                <label className={labelClass}>कर्ज खाते क्र. (Auto) <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  name="loanAccountNo" 
                  value={format14DigitDisplay(formData.loanAccountNo)} 
                  readOnly 
                  tabIndex={-1}
                  className={`${inputClass} bg-slate-100 cursor-not-allowed font-bold text-primary`} 
                  placeholder="उदा. 001-201-0000001-0" 
                  required 
                />
              </div>
              <div className="lg:col-span-1 sm:col-span-1">
                <label className={labelClass}>जुना कर्ज खाते क्र. (Old A/C)</label>
                <input 
                  type="text" 
                  name="legacyAccountNumber" 
                  value={formData.legacyAccountNumber} 
                  onChange={handleChange} 
                  className={`${inputClass} font-mono font-bold ${
                    duplicateLegacyAccount
                      ? 'border-red-500 bg-red-50 text-red-950 ring-1 ring-red-500 focus:border-red-600 focus:ring-red-500'
                      : 'text-slate-950 font-extrabold focus:border-primary'
                  }`} 
                  placeholder="उदा. 402" 
                />
                {duplicateLegacyAccount && (
                  <p className="text-[10px] text-red-600 font-bold mt-1 leading-tight flex items-start gap-1">
                    <span>⚠️</span>
                    <span>
                      हा क्र. आधीच खाते <strong>{format14DigitDisplay(duplicateLegacyAccount.loanAccountNo)}</strong> {duplicateLegacyAccount.customer ? `(${duplicateLegacyAccount.customer.firstName || ''} ${duplicateLegacyAccount.customer.lastName || ''})` : ''} साठी नोंदवला आहे!
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Loan Terms */}
          <div className="bg-white p-3 rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary">
            <div className="flex flex-wrap items-center justify-between border-b border-gray-200 pb-1.5 mb-2.5 gap-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">२. कर्ज व परतफेड माहिती (Loan Terms)</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallmentModal(true)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-sm text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                title="हप्ता परतफेड वेळापत्रक व हप्ता चार्ट पहा"
              >
                <Scale className="w-3.5 h-3.5 text-indigo-600" />
                <span>📊 हप्ता चार्ट पहा (Installment Chart)</span>
                {installmentChart.length > 0 && (
                  <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                    {installmentChart.length} हप्ते
                  </span>
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-2.5 gap-y-2.5">
              <div>
                <label className={labelClass}>कर्ज मंजूर रक्कम (₹) *</label>
                <input type="number" step="0.01" name="sanctionedAmount" value={formData.sanctionedAmount} onChange={handleChange} onFocus={(e) => e.target.select()} className={`${inputClass} font-bold text-gray-900`} placeholder="0.00" />
              </div>
              <div>
                <label className={labelClass}>कर्ज वाटप रक्कम (₹) *</label>
                <input type="number" step="0.01" name="disbursedAmount" value={formData.disbursedAmount} onChange={handleChange} onFocus={(e) => e.target.select()} className={`${inputClass} font-bold text-indigo-950 bg-indigo-50/40 border-indigo-300`} placeholder="0.00" title="प्रत्यक्ष वाटप केलेली रक्कम (व्याज व हप्ता गणनेचा आधार)" />
              </div>
              <div>
                <label className={labelClass}>कर्ज वाटप दिनांक *</label>
                <input type="date" name="loanDisbursementDate" value={formData.loanDisbursementDate} onChange={handleChange} max={cutoffDate} className={inputClass} title="कर्ज प्रत्यक्ष वाटप केल्याची तारीख" />
              </div>
              <div>
                <label className={labelClass}>व्याज दर (%) *</label>
                <input type="number" step="0.01" name="interestRate" value={formData.interestRate} onChange={handleChange} onFocus={(e) => e.target.select()} className={`${inputClass} font-bold text-gray-900`} placeholder="0.00" />
              </div>
              <div>
                <label className={labelClass}>मुदत (महिने) *</label>
                <input type="number" name="durationMonths" value={formData.durationMonths} onChange={handleChange} onFocus={(e) => e.target.select()} className={`${inputClass} font-bold text-gray-900`} placeholder="0" />
              </div>
              <div>
                <label className={labelClass}>हप्ता प्रकार</label>
                <select name="installmentFrequency" value={formData.installmentFrequency} onChange={handleChange} className={inputClass}>
                  <option value="साप्ताहिक">साप्ताहिक</option>
                  <option value="मासिक">मासिक</option>
                  <option value="त्रैमासिक">त्रैमासिक</option>
                  <option value="सहामाही">सहामाही</option>
                  <option value="वार्षिक">वार्षिक</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>हप्ता संख्या</label>
                <input 
                  type="number" 
                  name="noOfInstallments" 
                  value={formData.noOfInstallments} 
                  onChange={handleChange} 
                  onFocus={(e) => e.target.select()} 
                  className={`${inputClass} font-bold text-gray-900 font-mono`} 
                  placeholder="0" 
                />
              </div>
              <div>
                <label className={labelClass}>हप्ता रक्कम</label>
                <input 
                  type="number" 
                  step="0.01" 
                  name="installmentAmount" 
                  value={formData.installmentAmount} 
                  onChange={handleChange} 
                  onFocus={(e) => e.target.select()} 
                  className={`${inputClass} bg-amber-50/70 font-bold text-primary font-mono`} 
                  placeholder="0.00" 
                />
              </div>
              <div>
                <label className={labelClass}>पहिली हप्ता दिनांक</label>
                <input type="date" name="firstInstallmentDate" value={formData.firstInstallmentDate} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>कर्ज परतफेड दिनांक (Maturity)</label>
                <input type="date" name="maturityDate" value={formData.maturityDate} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>शेवटचा हप्ता भरल्याची दिनांक</label>
                <input type="date" name="lastInstallmentPaidDate" value={formData.lastInstallmentPaidDate} onChange={handleChange} max={cutoffDate} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Section 3: Outstanding Balances Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              
              {/* Card A: मुद्दल शिल्लक तपशील (Principal Breakdown) */}
              <div className="bg-emerald-50/30 p-3 rounded-sm shadow-xs border border-emerald-200">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-700" />
                      <h2 className="text-xs font-bold text-emerald-800">३. मुद्दल शिल्लक तपशील (Principal Balances)</h2>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                      मूळ मुद्दल + समाविष्ट व्याज
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                          <label className={labelClass}>शुद्ध मुद्दल बाकी (Pure Principal) <span className="text-red-500">*</span></label>
                          <input 
                            type="number" 
                            step="0.01" 
                            name="purePrincipalBalance" 
                            value={formData.purePrincipalBalance} 
                            onChange={handleChange} 
                            onFocus={(e) => e.target.select()} 
                            className={`${inputClass} font-bold text-emerald-800 ${isEditing ? 'bg-slate-100' : ''}`} 
                            placeholder="0.00" 
                            required 
                            disabled={isEditing} 
                          />
                          <div className="text-[10px] text-gray-500 mt-0.5">व्याजाव्यतिरिक्त खरी बाकी मुद्दल</div>
                      </div>

                      <div>
                          <label className={labelClass}>मुद्दलात समाविष्ट व्याज (Capitalized Interest)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            name="capitalizedInterestAmount" 
                            value={formData.capitalizedInterestAmount} 
                            onChange={handleChange} 
                            onFocus={(e) => e.target.select()} 
                            className={`${inputClass} font-bold text-blue-800 bg-blue-50/40 border-blue-300`} 
                            placeholder="0.00" 
                            disabled={isEditing} 
                          />
                          <div className="text-[10px] text-blue-700 mt-0.5">जुन्या सॉफ्टवेअरमधून मुद्दलात चढवलेले व्याज</div>
                      </div>

                      <div>
                          <label className={labelClass}>एकूण मुद्दल बाकी (Total Principal) <span className="text-emerald-700 font-normal">(स्वयंचलित)</span></label>
                          <input 
                            type="number" 
                            step="0.01" 
                            name="principalBalance" 
                            value={formData.principalBalance} 
                            onChange={handleChange} 
                            onFocus={(e) => e.target.select()} 
                            className={`${inputClass} font-black text-emerald-900 bg-emerald-100/50 border-emerald-400`} 
                            placeholder="0.00" 
                            required 
                            disabled={isEditing} 
                          />
                          {parseFloat(formData.principalBalance || '0') > parseFloat(formData.sanctionedAmount || '0') && parseFloat(formData.sanctionedAmount || '0') > 0 && (
                            <div className="text-[10px] text-amber-700 font-bold mt-0.5 flex items-center gap-1">
                              ℹ️ मुद्दल मंजूर मर्यादेपेक्षा जास्त (व्याज समाविष्ट झाल्यामुळे)
                            </div>
                          )}
                      </div>

                      <div>
                          <label className={labelClass}>बाकी दिनांक (As of Date) <span className="text-red-500">*</span></label>
                          <input 
                            type="date" 
                            name="openingDate" 
                            value={formData.openingDate} 
                            onChange={handleChange} 
                            max={cutoffDate} 
                            className={`${inputClass} ${isEditing ? 'bg-slate-100' : ''}`} 
                            required 
                            disabled={isEditing} 
                          />
                          <div className="text-[10px] text-gray-500 mt-0.5">आरंभिक शिल्लक नोंद दिनांक</div>
                      </div>
                  </div>

                  {/* Capitalized Interest Alert & Policy Checkbox */}
                  {parseFloat(formData.capitalizedInterestAmount || '0') > 0 && (
                    <div className="mt-2.5 p-2 bg-blue-50/90 border border-blue-200 rounded-sm">
                      <div className="flex items-center gap-1.5 text-[10px] text-blue-900 font-bold mb-1">
                        <AlertCircle className="w-3.5 h-3.5 text-blue-700" />
                        <span>भांडवलीकृत व्याज नोंद: ₹{parseFloat(formData.capitalizedInterestAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-[10px] text-blue-950 font-semibold">
                        <input 
                          type="checkbox" 
                          name="chargeInterestOnCapitalizedAmount" 
                          checked={formData.chargeInterestOnCapitalizedAmount} 
                          onChange={handleChange}
                          className="rounded text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>भांडवलीकृत व्याजावर नियमित व्याज आकारणी चालू ठेवा (Compound Policy)</span>
                      </label>
                    </div>
                  )}
              </div>

              {/* Card B: व्याज व तरतूद विभाग (Interest & NPA Provision) */}
              <div className="bg-amber-50/30 p-3 rounded-sm shadow-xs border border-amber-200">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-1.5 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-amber-700" />
                      <h2 className="text-xs font-bold text-amber-900">४. व्याज व तरतूद विभाग (Interest & Provision)</h2>
                    </div>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                      येणे व्याज + NPA तरतूद
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                          <div className="flex items-center justify-between">
                            <label className={labelClass}>चालू येणे व्याज बाकी (Interest)</label>
                            <button
                              type="button"
                              onClick={() => calculateAccurateInterest(true)}
                              className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                              title="बँकिंग सूत्रानुसार व्याज पुन्हा मोजा"
                            >
                              ⚡ स्वयं गणना
                            </button>
                          </div>
                          <input 
                            ref={interestBalanceInputRef}
                            type="number" 
                            step="0.01" 
                            name="interestBalance" 
                            value={formData.interestBalance} 
                            onChange={handleChange} 
                            onFocus={(e) => e.target.select()} 
                            className={`${inputClass} font-bold text-amber-900 ${isEditing ? 'border-primary bg-amber-50/40' : ''}`} 
                            placeholder="0.00" 
                          />
                          {formData.openingDate && formData.maturityDate && new Date(formData.openingDate) > new Date(formData.maturityDate) && (
                            <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                              ℹ️ मुदत संपल्यानंतरचे थकीत व्याज समाविष्ट
                            </div>
                          )}
                      </div>

                      <div>
                          <label className={labelClass}>थकीत व्याज (Overdue Interest)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            name="overdueInterestBalance" 
                            value={formData.overdueInterestBalance} 
                            onChange={handleChange} 
                            onFocus={(e) => e.target.select()} 
                            className={inputClass} 
                            placeholder="0.00" 
                          />
                          <div className="text-[10px] text-gray-500 mt-0.5">मुदतबाह्य दंडात्मक/अतिरिक्त व्याज</div>
                      </div>

                      <div>
                          <label className={labelClass}>थकीत व्याज तरतूद/अनामत (Interest Provision)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            name="interestProvisionBalance" 
                            value={formData.interestProvisionBalance} 
                            onChange={handleChange} 
                            onFocus={(e) => e.target.select()} 
                            className={`${inputClass} font-bold text-purple-900 bg-purple-50/40 border-purple-300`} 
                            placeholder="0.00" 
                          />
                          <div className="text-[10px] text-purple-700 mt-0.5">NPA खात्यांसाठी राखीव व्याज तरतूद (Suspense)</div>
                      </div>

                      <div>
                          <label className={labelClass}>आरंभिक NPA वर्गवारी (Asset Classification)</label>
                          <select 
                            name="initialNpaClassification" 
                            value={formData.initialNpaClassification} 
                            onChange={handleChange} 
                            className={`${inputClass} font-semibold ${
                              formData.initialNpaClassification !== 'Standard' ? 'bg-rose-50 text-rose-900 border-rose-300' : 'text-gray-800'
                            }`}
                          >
                            <option value="Standard">नियमित (Standard Asset)</option>
                            <option value="SubStandard">दुय्यम (Sub-Standard NPA)</option>
                            <option value="Sub-Standard">दुय्यम (Sub-Standard NPA)</option>
                            <option value="Doubtful1">संशयास्पद १ (Doubtful D1 NPA)</option>
                            <option value="Doubtful-1">संशयास्पद १ (Doubtful D1 NPA)</option>
                            <option value="Doubtful2">संशयास्पद २ (Doubtful D2 NPA)</option>
                            <option value="Doubtful-2">संशयास्पद २ (Doubtful D2 NPA)</option>
                            <option value="Doubtful3">संशयास्पद ३ (Doubtful D3 NPA)</option>
                            <option value="Doubtful-3">संशयास्पद ३ (Doubtful D3 NPA)</option>
                            <option value="Loss">बुडीत (Loss Asset)</option>
                          </select>
                          <div className="text-[10px] text-gray-500 mt-0.5">सुरुवातीची कर्ज मालमत्ता वर्गवारी</div>
                      </div>
                  </div>

                  {formData.initialNpaClassification !== 'Standard' && (
                    <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-sm text-[10px] text-rose-900 font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>⚠️ NPA खात्यांसाठी जमा न झालेले व्याज नफा-तोट्यात (P&L) न घेता व्याज अनामत (Suspense) मध्ये ठेवले जाईल.</span>
                    </div>
                  )}
              </div>
          </div>

          {/* Section 4: Security & Guarantor */}
          <div className="bg-white p-3 rounded-sm shadow-xs border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-bold text-primary">५. तारण व जामीनदार (Guarantor & Security)</h2>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const curRate = loanRates.find(r => r.loanRateID.toString() === formData.loanRateID);
                    const isDepScheme = curRate && ['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(curRate.collateralCategory || '');
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (!formData.customerID) {
                            alert('कृपया आधी कर्जदार खातेदार (Borrower Customer) निवडा.');
                            return;
                          }
                          setShowDepositModal(true);
                        }}
                        className={`${
                          isDepScheme 
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white border-emerald-500 ring-2 ring-emerald-300' 
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                        } px-3 py-1 rounded text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer border`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          {curRate?.collateralCategory === 'FixedDeposit' 
                            ? 'मुदत ठेव (FD) तारण जोडा' 
                            : curRate?.collateralCategory === 'PigmyDeposit' 
                              ? 'पिग्मी ठेव तारण जोडा' 
                              : curRate?.collateralCategory === 'RecurringDeposit'
                                ? 'RD ठेव तारण जोडा'
                                : 'ठेव तारण जोडा (FD/Pigmy)'}
                        </span>
                        {depositCollaterals.length > 0 && (
                          <span className="bg-emerald-950/80 text-emerald-100 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                            {depositCollaterals.length} खाती
                          </span>
                        )}
                      </button>
                    );
                  })()}

                  {(() => {
                    const curRate = loanRates.find(r => r.loanRateID.toString() === formData.loanRateID);
                    const isDepScheme = curRate && ['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(curRate.collateralCategory || '');
                    if (!isDepScheme) return null;
                    return (
                      <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-300 rounded px-2 py-0.5 font-medium flex items-center gap-1 shadow-2xs">
                        <span>ℹ️ {curRate?.isCollateralMandatoryForOpeningBalance ? '⚠️ तारण अनिवार्य' : '✅ तारण ऐच्छिक (नंतरही जोडता येईल)'}</span>
                      </span>
                    );
                  })()}

                  {(() => {
                    const curRate = loanRates.find(r => r.loanRateID.toString() === formData.loanRateID);
                    const isGoldScheme = !!(curRate && (
                      curRate.collateralCategory === 'Gold' ||
                      /gold|सोने|सोन्या|सुवर्ण|दागिन|अलंकार/i.test(
                        `${(curRate as any).securityType || ''} ${curRate.loanType || ''} ${curRate.shortName || ''}`
                      )
                    ));
                    if (!isGoldScheme && goldItems.length === 0) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => setShowGoldModal(true)}
                        className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white px-3 py-1 rounded text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer border border-amber-400"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-100" />
                        <span>सुवर्ण कर्ज तारण तपशील (Gold Loan Collateral)</span>
                        {goldItems.length > 0 && (
                          <span className="bg-amber-950/80 text-amber-100 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                            {goldItems.length} जिन्नस (₹{(totalGoldValuerValuation > 0 ? totalGoldValuerValuation : totalGoldValuation).toLocaleString('en-IN')})
                          </span>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                      <label className={labelClass}>जामीनदार १ (Guarantor 1)</label>
                      <SearchableSelect name="guarantor1" value={formData.guarantor1} onChange={handleChange} options={guarantorOptions} placeholder="जामीनदार निवडा..." />
                  </div>
                  <div>
                      <label className={labelClass}>जामीनदार २ (Guarantor 2)</label>
                      <SearchableSelect name="guarantor2" value={formData.guarantor2} onChange={handleChange} options={guarantorOptions} placeholder="जामीनदार निवडा..." />
                  </div>
                  <div>
                      <label className={labelClass}>तारण (Security Item)</label>
                      <input type="text" name="securityDetails" value={formData.securityDetails} onChange={handleChange} className={inputClass} placeholder="उदा. सोने, वाहन, घर..." />
                  </div>
                  <div>
                      <label className={labelClass}>तारण मूल्य (Security Value)</label>
                      <input type="number" step="0.01" name="securityValue" value={formData.securityValue} onChange={handleChange} className={inputClass} placeholder="0.00" />
                  </div>
              </div>

              {depositCollaterals.length > 0 && (
                <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-300 rounded text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-emerald-950 font-medium">
                      🔒 <strong className="text-emerald-900">तारण ठेव खाती ({depositCollaterals.length}):</strong>{' '}
                      <span className="font-mono font-bold">
                        {depositCollaterals.map((c: any) => c.accountNo || c.depositAccountNo || c.DepositAccountNo).join(', ')}
                      </span>{' '}
                      | तारण मूल्य: <strong className="text-emerald-800 font-mono">₹{Number(formData.securityValue || 0).toLocaleString('en-IN')}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDepositModal(true)}
                    className="text-emerald-800 hover:text-emerald-950 underline font-bold text-[11px] cursor-pointer"
                  >
                    बदला / तपासा
                  </button>
                </div>
              )}

              {goldItems.length > 0 && (
                <div className="mt-2.5 p-2 bg-amber-50/80 border border-amber-200 rounded text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-800 font-bold">💎 जोडलेले सुवर्ण तारण:</span>
                    <span className="text-amber-950 font-medium">
                      {goldItems.length} जिन्नस ({totalGoldItemsCount} नग) | एकूण ग्रॉस: <span className="font-mono">{totalGoldGrossWeight.toFixed(2)}g</span> | निव्वळ वजन: <strong className="font-mono">{totalGoldNetWeight.toFixed(2)}g</strong> | मूल्यांकन: <strong className="text-emerald-700 font-mono">₹{totalGoldValuation.toLocaleString('en-IN')}</strong>
                      {totalGoldValuerValuation > 0 && (
                        <span className="ml-1 text-purple-900 font-bold">(व्हॅल्यूअर मूल्यांकन: <strong className="font-mono">₹{totalGoldValuerValuation.toLocaleString('en-IN')}</strong>)</span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGoldModal(true)}
                    className="text-amber-800 hover:text-amber-950 underline font-bold text-[11px] cursor-pointer"
                  >
                    तपशील पहा / बदला
                  </button>
                </div>
              )}
          </div>

          {/* Form Footer Action Buttons */}
          <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <button 
                type="button" 
                onClick={() => setShowInstallmentModal(true)} 
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-sm font-bold shadow-2xs transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5 text-indigo-600" />
                <span>📊 हप्ता चार्ट पहा ({installmentChart.length} हप्ते)</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                type="button" 
                onClick={handleNew} 
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-sm font-bold shadow-2xs transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isEditing ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
              </button>
              <button 
                type="submit" 
                className={`${
                  isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
                } text-white px-6 py-2 rounded-sm font-bold shadow-xs transition-all text-xs flex items-center gap-1.5 cursor-pointer`}
              >
                <Save className="w-4 h-4" />
                <span>{isEditing ? 'बदल सेव्ह करा (Update)' : 'नोंद सेव्ह करा (Save)'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* POP-UP MODAL: INSTALLMENT CHART & EMI SCHEDULE                             */}
      {/* ========================================================================= */}
      {showInstallmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-white" />
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <span>हप्ता परतफेड वेळापत्रक व हप्ता चार्ट (Installment Schedule & EMI Chart)</span>
                    <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                      {installmentChart.length} हप्ते
                    </span>
                  </h2>
                  <div className="text-[10px] text-white/80 font-normal">
                    खाते क्र.: {format14DigitDisplay(formData.loanAccountNo) || '-'} | खातेदार: {customers.find(c => c.customerID.toString() === formData.customerID)?.firstName || '-'} | कर्ज वाटप दिनांक: {formData.loanDisbursementDate ? new Date(formData.loanDisbursementDate).toLocaleDateString('en-GB') : '-'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallmentModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary KPI Badges */}
            <div className="p-3 bg-slate-50 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
              <div className="p-2 bg-white border border-slate-200 rounded-sm shadow-2xs">
                <div className="text-[10px] text-gray-500 font-bold uppercase">मंजूर कर्ज रक्कम</div>
                <div className="text-xs font-black text-indigo-950 font-mono">₹ {(parseFloat(formData.sanctionedAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-sm shadow-2xs">
                <div className="text-[10px] text-gray-500 font-bold uppercase">व्याज दर / मुदत</div>
                <div className="text-xs font-black text-slate-800 font-mono">{formData.interestRate || '0'}% | {formData.durationMonths || '0'} महिने</div>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-sm shadow-2xs">
                <div className="text-[10px] text-gray-500 font-bold uppercase">हप्ता प्रकार / हप्ता रक्कम</div>
                <div className="text-xs font-black text-primary font-mono">{formData.installmentFrequency} | ₹ {(parseFloat(formData.installmentAmount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="p-2 bg-white border border-slate-200 rounded-sm shadow-2xs">
                <div className="text-[10px] text-gray-500 font-bold uppercase">एकूण परतफेड देय</div>
                <div className="text-xs font-black text-emerald-800 font-mono">
                  ₹ {Math.round(installmentChart.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0)).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Post-Maturity Overdue Banner (If loan is past maturity date) */}
            {formData.maturityDate && formData.openingDate && new Date(formData.openingDate) > new Date(formData.maturityDate) && (
              <div className="mx-3 mt-2 p-2 bg-amber-50 border border-amber-300 rounded-sm text-xs flex flex-wrap items-center justify-between gap-2 text-amber-950 shrink-0 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">⏰ मुदत समाप्तीनंतरचे थकीत दिवस:</span>
                  <span className="font-mono font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[11px]">
                    {Math.max(0, Math.round((new Date(formData.openingDate).getTime() - new Date((formData.lastInstallmentPaidDate && new Date(formData.lastInstallmentPaidDate) > new Date(formData.maturityDate)) ? formData.lastInstallmentPaidDate : formData.maturityDate).getTime()) / (1000 * 60 * 60 * 24)))} दिवस
                  </span>
                  <span className="text-[10px] text-amber-800">
                    ({new Date((formData.lastInstallmentPaidDate && new Date(formData.lastInstallmentPaidDate) > new Date(formData.maturityDate)) ? formData.lastInstallmentPaidDate : formData.maturityDate).toLocaleDateString('en-GB')} ते {new Date(formData.openingDate).toLocaleDateString('en-GB')})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span>मुदतीनंतरचे थकीत येणे व्याज: <strong className="text-rose-700 font-bold">₹{Math.round((parseFloat(formData.principalBalance || '0') * parseFloat(formData.interestRate || '0') * Math.max(0, Math.round((new Date(formData.openingDate).getTime() - new Date((formData.lastInstallmentPaidDate && new Date(formData.lastInstallmentPaidDate) > new Date(formData.maturityDate)) ? formData.lastInstallmentPaidDate : formData.maturityDate).getTime()) / (1000 * 60 * 60 * 24)))) / (365 * 100)).toLocaleString('en-IN')}</strong></span>
                </div>
              </div>
            )}

            {/* Installment Table */}
            <div className="flex-1 overflow-y-auto p-3">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-center border border-gray-200 rounded-sm">
                <thead className="bg-slate-100 sticky top-0 shadow-2xs font-bold text-gray-700">
                  <tr>
                    <th className="px-2 py-2 border-r border-gray-200 w-12">हप्ता क्र.</th>
                    <th className="px-2 py-2 border-r border-gray-200">हप्ता दिनांक</th>
                    <th className="px-2 py-2 border-r border-gray-200 text-right">मुद्दल (₹)</th>
                    <th className="px-2 py-2 border-r border-gray-200 text-right">व्याज (₹)</th>
                    <th className="px-2 py-2 border-r border-gray-200 text-right">एकूण हप्ता (₹)</th>
                    <th className="px-2 py-2 border-r border-gray-200 text-right">बाकी शिल्लक (₹)</th>
                    <th className="px-2 py-2">स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {installmentChart.map((row) => {
                    const repaidPrincipal = (parseFloat(formData.sanctionedAmount) || 0) - (parseFloat(formData.principalBalance) || 0);
                    let isPaid = false;
                    let isOverdue = false;
                    
                    let cumulativePrincipal = 0;
                    for (let i = 0; i < row.no; i++) {
                      cumulativePrincipal += installmentChart[i].principalValue || 0;
                    }
                    
                    if (repaidPrincipal > 0 && repaidPrincipal >= cumulativePrincipal - (row.principalValue / 2)) {
                      isPaid = true;
                    }

                    if (!isPaid && formData.openingDate) {
                      const [day, month, year] = row.date.split('/');
                      const rowDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                      const openingDateObj = new Date(formData.openingDate);
                      rowDate.setHours(0, 0, 0, 0);
                      openingDateObj.setHours(0, 0, 0, 0);
                      
                      if (rowDate <= openingDateObj) {
                        isOverdue = true;
                      }
                    }

                    let rowClass = "hover:bg-primary/5 transition-colors ";
                    if (isPaid) rowClass += "bg-emerald-50 text-emerald-900 font-semibold ";
                    else if (isOverdue) rowClass += "bg-rose-50 text-rose-900 font-semibold ";

                    return (
                      <tr key={row.no} className={rowClass.trim()}>
                        <td className="px-2 py-1.5 border-r border-gray-200 font-mono font-bold">{row.no}</td>
                        <td className="px-2 py-1.5 border-r border-gray-200 font-mono">{row.date}</td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono text-gray-800">{Math.round(row.principalValue || 0).toLocaleString('en-IN')}</td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right text-rose-600 font-mono">{Math.round(parseFloat(row.interest) || 0).toLocaleString('en-IN')}</td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-emerald-700 font-mono">{Math.round(parseFloat(row.total) || 0).toLocaleString('en-IN')}</td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right text-gray-700 font-mono">{Math.round(parseFloat(row.balance) || 0).toLocaleString('en-IN')}</td>
                        <td className="px-2 py-1.5">
                          {isPaid && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">भरलेला</span>}
                          {isOverdue && <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold">थकीत</span>}
                          {!isPaid && !isOverdue && <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">भविष्य</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {installmentChart.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400 font-medium">
                        कर्ज मंजूर रक्कम, मुदत आणि व्याज दर प्रविष्ट करा.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Summary */}
            <div className="p-3 bg-slate-100 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-4 text-xs font-mono">
                <div><span className="text-gray-500 font-sans font-bold">एकूण मुद्दल:</span> <strong>₹{Math.round(installmentChart.reduce((acc, curr) => acc + (curr.principalValue || 0), 0)).toLocaleString('en-IN')}</strong></div>
                <div><span className="text-gray-500 font-sans font-bold">एकूण व्याज:</span> <strong className="text-rose-700">₹{Math.round(installmentChart.reduce((acc, curr) => acc + (parseFloat(curr.interest) || 0), 0)).toLocaleString('en-IN')}</strong></div>
                <div><span className="text-gray-500 font-sans font-bold">एकूण परतफेड:</span> <strong className="text-primary">₹{Math.round(installmentChart.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0)).toLocaleString('en-IN')}</strong></div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallmentModal(false)}
                className="bg-slate-700 hover:bg-slate-800 text-white px-5 py-1.5 rounded-sm text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL: GOLD LOAN COLLATERAL DETAILS (सुवर्ण कर्ज तारण तपशील)       */}
      {/* ========================================================================= */}
      {showGoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-amber-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 text-white px-4 py-2.5 flex justify-between items-center shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-100" />
                <div>
                  <h3 className="text-sm font-bold tracking-wide">
                    सुवर्ण कर्ज तारण तपशील (Gold Loan Collateral Details)
                  </h3>
                  <p className="text-[10px] text-amber-100 font-medium">
                    दागिन्यांचे वजन, कॅरेट शुद्धता, सिस्टीम व सोनाराचे अधिकृत मूल्यांकन आणि फोटो नोंदणी
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGoldModal(false);
                  stopCamera();
                }}
                className="text-white/80 hover:text-white hover:bg-amber-800/60 w-7 h-7 flex items-center justify-center rounded-full transition-colors font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-3 space-y-3 overflow-y-auto bg-slate-50/50 flex-1 text-xs">
              {/* Form Card */}
              <form onSubmit={handleAddGoldItem} className="bg-white p-3 rounded border border-amber-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-amber-100 pb-1.5">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <span>💎</span>
                    <span>{editingGoldId ? 'सोन्याचा जिन्नस दुरुस्त करा (Edit Item)' : 'नवीन सोन्याचा जिन्नस जोडा (Add New Gold Item)'}</span>
                  </h4>
                  {editingGoldId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGoldId(null);
                        setGoldForm({
                          itemName: 'सोन्याची साखळी (Chain)',
                          purity: '22K (91.6%)',
                          quantity: 1,
                          grossWeight: '',
                          netWeight: '',
                          ratePerGram: 6000,
                          valuationAmount: '',
                          remarks: '',
                          imagePath: '',
                          valuerName: '',
                          valuerValuation: '',
                          valuationReceiptNo: '',
                          valuationDate: new Date().toISOString().split('T')[0]
                        });
                        stopCamera();
                      }}
                      className="text-[10px] text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      रद्द करा (Reset Form)
                    </button>
                  )}
                </div>

                {/* Row 1: Ornament Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className={labelClass}>
                      जिन्नस / दागिन्याचे नाव <span className="text-rose-500">*</span>
                    </label>
                    {!showCustomItemInput ? (
                      <div className="flex gap-1">
                        <select
                          value={goldForm.itemName}
                          onChange={(e) => {
                            if (e.target.value === '__ADD_NEW__') {
                              setShowCustomItemInput(true);
                              setCustomItemText('');
                            } else {
                              setGoldForm(prev => ({ ...prev, itemName: e.target.value }));
                            }
                          }}
                          className={`${inputClass} flex-1`}
                        >
                          {ornamentNames.map((name, i) => (
                            <option key={i} value={name}>{name}</option>
                          ))}
                          <option value="__ADD_NEW__">➕ नवीन जिन्नस टाईप करा (Add Custom)...</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomItemInput(true);
                            setCustomItemText('');
                          }}
                          title="नवीन दागिन्याचे नाव जोडा"
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 rounded-sm text-xs font-bold cursor-pointer"
                        >
                          ➕
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={customItemText}
                          onChange={(e) => setCustomItemText(e.target.value)}
                          placeholder="उदा. सोन्याचे तोडे"
                          className={`${inputClass} flex-1 border-amber-400 bg-amber-50/50`}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomOrnament}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 rounded-sm text-[10px] font-bold cursor-pointer"
                        >
                          जोडा
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCustomItemInput(false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 rounded-sm text-[10px] cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>शुद्धता / कॅरेट (Purity) *</label>
                    <select
                      value={goldForm.purity}
                      onChange={(e) => {
                        const newPurity = e.target.value;
                        const autoVal = calculateGoldItemValuation(Number(goldForm.netWeight) || 0, newPurity, Number(goldForm.ratePerGram) || 0);
                        setGoldForm(prev => ({
                          ...prev,
                          purity: newPurity,
                          valuationAmount: autoVal,
                          valuerValuation: prev.valuerValuation === '' || prev.valuerValuation === prev.valuationAmount ? autoVal : prev.valuerValuation
                        }));
                      }}
                      className={inputClass}
                    >
                      <option value="24K (99.9%)">24K (99.9% शुद्ध सोन्याचे नाणे/वेढणी)</option>
                      <option value="22K (91.6%)">22K (91.6% हॉलमार्क दागिने)</option>
                      <option value="20K (83.3%)">20K (83.3% शुद्धता)</option>
                      <option value="18K (75.0%)">18K (75.0% शुद्धता)</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>नग / संख्या (Qty)</label>
                    <input
                      type="number"
                      min="1"
                      value={goldForm.quantity}
                      onChange={(e) => setGoldForm(prev => ({ ...prev, quantity: e.target.value }))}
                      className={`${inputClass} font-mono`}
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>ग्रॉस वजन (Gross Wt. g) *</label>
                    <input
                      type="number"
                      step="0.001"
                      value={goldForm.grossWeight}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGoldForm(prev => {
                          const newNet = prev.netWeight === '' ? val : prev.netWeight;
                          const autoVal = calculateGoldItemValuation(Number(newNet) || 0, prev.purity, Number(prev.ratePerGram) || 0);
                          return {
                            ...prev,
                            grossWeight: val,
                            netWeight: newNet,
                            valuationAmount: autoVal,
                            valuerValuation: prev.valuerValuation === '' || prev.valuerValuation === prev.valuationAmount ? autoVal : prev.valuerValuation
                          };
                        });
                      }}
                      className={`${inputClass} font-mono`}
                      placeholder="उदा. 15.500"
                    />
                  </div>
                </div>

                {/* Row 2: Weights, Rates & System Valuation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className={labelClass}>निव्वळ वजन (Net Wt. g) *</label>
                    <input
                      type="number"
                      step="0.001"
                      value={goldForm.netWeight}
                      onChange={(e) => {
                        const val = e.target.value;
                        const autoVal = calculateGoldItemValuation(Number(val) || 0, goldForm.purity, Number(goldForm.ratePerGram) || 0);
                        setGoldForm(prev => ({
                          ...prev,
                          netWeight: val,
                          valuationAmount: autoVal,
                          valuerValuation: prev.valuerValuation === '' || prev.valuerValuation === prev.valuationAmount ? autoVal : prev.valuerValuation
                        }));
                      }}
                      className={`${inputClass} font-mono font-bold text-amber-950`}
                      placeholder="उदा. 14.800"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>दर प्रति ग्रॅम (Rate / g ₹) *</label>
                    <input
                      type="number"
                      value={goldForm.ratePerGram}
                      onChange={(e) => {
                        const val = e.target.value;
                        const autoVal = calculateGoldItemValuation(Number(goldForm.netWeight) || 0, goldForm.purity, Number(val) || 0);
                        setGoldForm(prev => ({
                          ...prev,
                          ratePerGram: val,
                          valuationAmount: autoVal,
                          valuerValuation: prev.valuerValuation === '' || prev.valuerValuation === prev.valuationAmount ? autoVal : prev.valuerValuation
                        }));
                      }}
                      className={`${inputClass} font-mono`}
                      placeholder="6000"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <label className={labelClass}>सिस्टीम मूल्यांकन (System ₹)</label>
                      <button
                        type="button"
                        onClick={() => {
                          const autoVal = calculateGoldItemValuation(Number(goldForm.netWeight) || 0, goldForm.purity, Number(goldForm.ratePerGram) || 0);
                          setGoldForm(prev => ({ ...prev, valuationAmount: autoVal }));
                        }}
                        title="कॅरेट सूत्रानुसार पुन्हा काढा"
                        className="text-[9px] text-emerald-700 hover:underline flex items-center gap-0.5"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>रि-कॅल्क्युलेट</span>
                      </button>
                    </div>
                    <input
                      type="number"
                      value={goldForm.valuationAmount}
                      onChange={(e) => setGoldForm(prev => ({ ...prev, valuationAmount: e.target.value }))}
                      className={`${inputClass} bg-emerald-50/60 text-emerald-800 font-bold font-mono border-emerald-300`}
                      placeholder="0.00"
                    />
                    <span className="text-[9px] text-slate-500 block truncate mt-0.5">
                      {goldForm.netWeight && goldForm.ratePerGram ? (
                        <>💡 {(parseFloat(goldForm.netWeight.toString() || '0') * getPurityRatio(goldForm.purity)).toFixed(2)}g शुद्ध सोने × ₹{goldForm.ratePerGram}</>
                      ) : 'कॅरेट शुद्धतेनुसार ऑटो-कॅल्क्युलेशन'}
                    </span>
                  </div>

                  <div>
                    <label className={labelClass}>शेरा / ओळख खूण (Remarks)</label>
                    <input
                      type="text"
                      value={goldForm.remarks}
                      onChange={(e) => setGoldForm(prev => ({ ...prev, remarks: e.target.value }))}
                      className={inputClass}
                      placeholder="उदा. 22K हॉलमार्क मोहर"
                    />
                  </div>
                </div>

                {/* Row 3: Goldsmith / Valuer Official Valuation */}
                <div className="bg-amber-50/70 p-2 rounded border border-amber-200 space-y-1.5">
                  <div className="text-[10px] font-bold text-amber-950 flex items-center gap-1">
                    <span>🏛️</span>
                    <span>सोनाराने केलेले अधिकृत मूल्यांकन (Goldsmith / Valuer Valuation)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-700 mb-0.5 block">सोनाराचे नाव (Goldsmith Name)</label>
                      <input
                        type="text"
                        value={goldForm.valuerName}
                        onChange={(e) => setGoldForm(prev => ({ ...prev, valuerName: e.target.value }))}
                        className={`${inputClass} bg-white`}
                        placeholder="उदा. मे. जगताप सराफ"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-amber-900 mb-0.5 block">
                        सोनाराचे मूल्यांकन (Valuer ₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={goldForm.valuerValuation}
                        onChange={(e) => setGoldForm(prev => ({ ...prev, valuerValuation: e.target.value }))}
                        className={`${inputClass} bg-amber-100/60 font-bold font-mono text-amber-950 border-amber-400`}
                        placeholder="पावतीवरील अधिकृत रक्कम"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-700 mb-0.5 block">व्हॅल्युएशन पावती क्र. (Receipt No.)</label>
                      <input
                        type="text"
                        value={goldForm.valuationReceiptNo}
                        onChange={(e) => setGoldForm(prev => ({ ...prev, valuationReceiptNo: e.target.value }))}
                        className={`${inputClass} bg-white`}
                        placeholder="उदा. VAL-102"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-gray-700 mb-0.5 block">व्हॅल्युएशन दिनांक (Valuation Date)</label>
                      <input
                        type="date"
                        value={goldForm.valuationDate}
                        onChange={(e) => setGoldForm(prev => ({ ...prev, valuationDate: e.target.value }))}
                        className={`${inputClass} bg-white`}
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Ornament Photo Capture / Upload */}
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-slate-600" />
                      <span className="text-[11px] font-bold text-slate-800">दागिन्याचा फोटो (Ornament Photo)</span>
                      {isUploadingPhoto && (
                        <span className="text-[10px] text-amber-700 font-bold animate-pulse">⏳ फोटो अपलोड होत आहे...</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Live Camera Button */}
                      <button
                        type="button"
                        onClick={startCamera}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Camera className="w-3 h-3" />
                        <span>📷 थेट कॅमेऱ्याने फोटो घ्या</span>
                      </button>

                      {/* File Upload Button */}
                      <label className="bg-slate-700 hover:bg-slate-800 text-white px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs">
                        <ImageIcon className="w-3 h-3" />
                        <span>📁 फाईल निवडा</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>

                      {/* If Image exists */}
                      {goldForm.imagePath && (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            type="button"
                            onClick={() => setPreviewImageModal(goldForm.imagePath || null)}
                            className="relative group border border-slate-300 rounded overflow-hidden cursor-pointer"
                            title="फोटो मोठा करून पहा"
                          >
                            <img
                              src={goldForm.imagePath}
                              alt="Ornament"
                              className="w-7 h-7 object-cover hover:opacity-80 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <ZoomIn className="w-3 h-3 text-white" />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setGoldForm(prev => ({ ...prev, imagePath: '' }))}
                            className="text-rose-600 hover:text-rose-800 text-[10px] font-bold px-1"
                            title="फोटो काढा"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-amber-100">
                  <button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-1.5 rounded-sm text-xs shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>{editingGoldId ? '✓ बदल सेव्ह करा (Update Item)' : '➕ जिन्नस जोडा (Add Item)'}</span>
                  </button>
                </div>
              </form>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs text-center">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">एकूण जिन्नस</span>
                  <span className="text-xs font-black text-gray-800">{goldItems.length} जिन्नस ({totalGoldItemsCount} नग)</span>
                </div>

                <div className="bg-white p-2 rounded border border-slate-200 shadow-2xs text-center">
                  <span className="text-[10px] font-bold text-gray-500 block uppercase">एकूण ग्रॉस वजन</span>
                  <span className="text-xs font-black text-gray-800 font-mono">{totalGoldGrossWeight.toFixed(2)} g</span>
                </div>

                <div className="bg-amber-50 p-2 rounded border border-amber-200 shadow-2xs text-center">
                  <span className="text-[10px] font-bold text-amber-800 block uppercase">निव्वळ शुद्ध वजन</span>
                  <span className="text-xs font-black text-amber-950 font-mono">{totalGoldNetWeight.toFixed(2)} g</span>
                </div>

                <div className="bg-emerald-50 p-2 rounded border border-emerald-200 shadow-2xs text-center">
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">सिस्टीम मूल्यांकन (System)</span>
                  <span className="text-xs font-black text-emerald-800 font-mono">₹{totalGoldValuation.toLocaleString('en-IN')}</span>
                </div>

                <div className="bg-gradient-to-br from-amber-100 to-yellow-100 p-2 rounded border-2 border-amber-400 shadow-2xs text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-amber-900 block uppercase">सोनाराचे मूल्यांकन (Valuer)</span>
                  <span className="text-xs font-black text-amber-950 font-mono">₹{totalGoldValuerValuation.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-800">तारण सोन्याच्या दागिन्यांची यादी ({goldItems.length})</h4>
                  <span className="text-[10px] text-slate-500 italic">नोंद एडिट करण्यासाठी 'बदला' किंवा 'काढा' वर क्लिक करा</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-[10px]">
                        <th className="p-1.5 text-center w-8">अ.क्र.</th>
                        <th className="p-1.5 text-center w-12">फोटो</th>
                        <th className="p-1.5">दागिन्याचे नाव</th>
                        <th className="p-1.5 text-center">कॅरेट</th>
                        <th className="p-1.5 text-center">नग</th>
                        <th className="p-1.5 text-right">ग्रॉस (g)</th>
                        <th className="p-1.5 text-right">निव्वळ (g)</th>
                        <th className="p-1.5 text-right">दर / g</th>
                        <th className="p-1.5 text-right">सिस्टीम मूल्य (₹)</th>
                        <th className="p-1.5 text-right font-bold text-amber-950 bg-amber-50/50">सोनाराचे मूल्य (₹)</th>
                        <th className="p-1.5">सोनार / पावती</th>
                        <th className="p-1.5">शेरा</th>
                        <th className="p-1.5 text-center w-20">कृती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                      {goldItems.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="p-6 text-center text-slate-400 font-sans italic">
                            कोणताही सोन्याचा जिन्नस जोडलेला नाही.
                          </td>
                        </tr>
                      ) : (
                        goldItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="p-1.5 text-center font-bold text-slate-500 font-sans">{idx + 1}</td>
                            <td className="p-1 text-center font-sans">
                              {item.imagePath ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewImageModal(item.imagePath || null)}
                                  className="border border-amber-300 rounded p-0.5 hover:scale-110 transition-transform cursor-pointer inline-block"
                                  title="फोटो पहा"
                                >
                                  <img src={item.imagePath} alt="Gold" className="w-6 h-6 object-cover rounded-xs" />
                                </button>
                              ) : (
                                <span className="text-slate-300 text-[10px]">-</span>
                              )}
                            </td>
                            <td className="p-1.5 font-bold text-slate-800 font-sans">{item.itemName}</td>
                            <td className="p-1.5 text-center font-bold text-amber-800">{item.purity}</td>
                            <td className="p-1.5 text-center font-semibold">{item.quantity}</td>
                            <td className="p-1.5 text-right">{item.grossWeight.toFixed(2)} g</td>
                            <td className="p-1.5 text-right font-bold text-amber-900">{item.netWeight.toFixed(2)} g</td>
                            <td className="p-1.5 text-right">₹{item.ratePerGram.toLocaleString('en-IN')}</td>
                            <td className="p-1.5 text-right font-semibold text-emerald-700">₹{item.valuationAmount.toLocaleString('en-IN')}</td>
                            <td className="p-1.5 text-right font-black text-amber-950 bg-amber-50/40">
                              ₹{(item.valuerValuation || item.valuationAmount).toLocaleString('en-IN')}
                            </td>
                            <td className="p-1.5 text-[10px] font-sans text-slate-700">
                              {item.valuerName ? (
                                <span>{item.valuerName} {item.valuationReceiptNo ? `(#${item.valuationReceiptNo})` : ''}</span>
                              ) : '-'}
                            </td>
                            <td className="p-1.5 text-slate-600 text-[10px] truncate max-w-[100px] font-sans">{item.remarks || '-'}</td>
                            <td className="p-1.5 text-center font-sans">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditGoldItem(item)}
                                  className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-200 cursor-pointer"
                                >
                                  बदला
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGoldItem(item.id)}
                                  className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-rose-200 cursor-pointer"
                                >
                                  काढा
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
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-slate-700 font-medium">
                <span>
                  ✨ सिस्टीम मूल्यांकन: <strong className="text-emerald-700 font-black font-mono">₹{totalGoldValuation.toLocaleString('en-IN')}</strong>
                </span>
                <span>
                  🏛️ सोनाराचे एकूण मूल्यांकन: <strong className="text-amber-900 font-black font-mono">₹{totalGoldValuerValuation.toLocaleString('en-IN')}</strong>
                </span>
                <span>
                  ({totalGoldNetWeight.toFixed(2)} ग्रॅम निव्वळ वजन)
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowGoldModal(false);
                    stopCamera();
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-1.5 rounded-sm text-xs font-bold cursor-pointer border border-slate-300"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="button"
                  onClick={applyGoldLoanToOpeningBalance}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 rounded-sm text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✅ तारण माहिती खात्याशी जोडा (Apply)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIVE CAMERA CAPTURE MODAL */}
      {isCameraActive && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-3 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-md p-3 max-w-lg w-full flex flex-col items-center gap-3 shadow-2xl">
            <div className="w-full flex justify-between items-center text-white pb-1 border-b border-slate-800">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>दागिन्याचा फोटो काढा (Live Camera Feed)</span>
              </span>
              <button
                type="button"
                onClick={stopCamera}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="w-full bg-black rounded overflow-hidden aspect-video flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                autoPlay
                muted
              />
            </div>

            <div className="flex items-center gap-2 w-full justify-between pt-1">
              <button
                type="button"
                onClick={stopCamera}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-xs font-bold cursor-pointer"
              >
                रद्द करा
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer animate-bounce"
              >
                <Camera className="w-4 h-4" />
                <span>📸 फोटो कॅप्चर करा (Snap & Save)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO ZOOM MODAL */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImageModal(null)}
        >
          <div
            className="bg-white rounded-md p-2 max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center px-1 pb-1 border-b">
              <span className="text-xs font-bold text-slate-800">दागिन्याचा फोटो (Ornament Photo Preview)</span>
              <button
                type="button"
                onClick={() => setPreviewImageModal(null)}
                className="text-slate-500 hover:text-slate-800 font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto flex items-center justify-center">
              <img
                src={previewImageModal}
                alt="Gold Ornament Zoom"
                className="max-w-full max-h-[72vh] object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL: SAVED LOAN OPENING BALANCES LIST                            */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <List className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेली कर्ज बाकी यादी (Saved Loan Opening Balances)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredBalances.length} खाती
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                title="बंद करा (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-slate-200/70 p-0.5 rounded-sm border border-slate-300">
                <button
                  type="button"
                  onClick={() => setLoanFilterType('all')}
                  className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                    loanFilterType === 'all'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  🌟 सर्व कर्ज खाती ({allAccounts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLoanFilterType('opening')}
                  className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                    loanFilterType === 'opening'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  📗 फक्त आरंभिक शिल्लक ({openingAccounts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLoanFilterType('regular')}
                  className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer ${
                    loanFilterType === 'regular'
                      ? 'bg-indigo-700 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white/60'
                  }`}
                >
                  📘 नियमित कर्ज ({allAccounts.length - openingAccounts.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                  <input 
                    type="text" 
                    placeholder="खाते क्र., जुना क्र. किंवा नाव शोधा..." 
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
                  disabled={filteredBalances.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="एक्सेल फाइल डाउनलोड करा"
                >
                  <FileSpreadsheet size={13} />
                  <span>एक्सेल एक्सपोर्ट</span>
                </button>
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-2 bg-slate-100">
              <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">कृती</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">शाखा</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">खातेदार नाव</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">कर्ज प्रकार</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">खाते क्र.</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left bg-slate-200/80 font-black text-slate-900" title="यादी जुना खाते क्र. च्या चढत्या क्रमाने (1, 2, 3...) लावली आहे">
                        जुना खाते क्र. ⇅
                      </th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">मंजूर रक्कम (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">वाटप रक्कम (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">वाटप दिनांक</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">मुद्दल बाकी (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">व्याज बाकी (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">व्याज तरतूद (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">NPA वर्ग</th>
                      <th className="px-2 py-1.5 text-center w-24">दिनांक</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredBalances.map((balance) => (
                      <tr key={balance.loanAccountID} className="hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => handleEdit(balance)} 
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="नोंद फॉर्ममध्ये लोड करा (Load in Form)"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>बदला</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleDelete(balance.loanAccountID)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="नोंद डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-600">
                          {balance.branch?.branchName || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-primary">
                          {balance.customer 
                            ? `${balance.customer.firstName || ''} ${balance.customer.lastName || ''}`.trim() 
                            : '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-700">
                          {balance.loanRate?.loanCode} - {balance.loanRate?.shortName}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-gray-900 font-mono">
                          <div className="flex items-center gap-1">
                            <span>{format14DigitDisplay(balance.loanAccountNo)}</span>
                            {balance.isOpeningBalance ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 py-0.2 rounded border border-emerald-300">OB</span>
                            ) : (
                              <span className="text-[9px] bg-slate-100 text-slate-700 font-bold px-1 py-0.2 rounded border border-slate-300">नियमित</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-mono">
                          {balance.legacyAccountNumber ? (
                            <span className="font-extrabold text-slate-950 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 shadow-2xs inline-block">
                              {balance.legacyAccountNumber}
                            </span>
                          ) : (
                            <span className="text-gray-400 font-normal">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-gray-800">
                          {(balance.sanctionedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-indigo-950 bg-indigo-50/20">
                          {getDisbursedAmt(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono text-slate-700 font-medium whitespace-nowrap">
                          {balance.loanDisbursementDate ? new Date(balance.loanDisbursementDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono">
                          <div className="font-bold text-emerald-700">
                            {balance.principalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          {(balance.capitalizedInterestAmount || 0) > 0 && (
                            <div className="text-[9px] text-blue-700 font-semibold">
                              (समाविष्ट: ₹{(balance.capitalizedInterestAmount || 0).toLocaleString('en-IN')})
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-amber-700 font-mono">
                          {balance.interestBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono text-purple-800 font-semibold">
                          {(balance.interestProvisionBalance || 0) > 0 
                            ? `₹${(balance.interestProvisionBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` 
                            : '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold text-[10px]">
                          {balance.initialNpaClassification && balance.initialNpaClassification !== 'Standard' ? (
                            <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded border border-rose-300">
                              {balance.initialNpaClassification}
                            </span>
                          ) : (
                            <span className="text-gray-500 font-normal">नियमित</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-gray-600">
                          {new Date(balance.openingDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                    {filteredBalances.length === 0 && (
                      <tr>
                        <td colSpan={14} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणतीही नोंद सापडली नाही (No loan opening balances found).
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
                टीप: 'बदला' वर क्लिक केल्यास नोंद थेट मुख्य फॉर्ममध्ये संपादन करण्यासाठी लोड होईल.
              </span>
              <button
                type="button"
                onClick={() => setShowListModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold transition-all cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 🛡️ DEPOSIT COLLATERAL SELECTOR MODAL (FD, Pigmy, RD, Saving) */}
      {(() => {
        const curRate = loanRates.find(r => r.loanRateID.toString() === formData.loanRateID);
        const selectedCust = customers.find(c => c.customerID.toString() === formData.customerID);
        return (
          <DepositCollateralSelectorModal
            isOpen={showDepositModal}
            onClose={() => setShowDepositModal(false)}
            customerID={formData.customerID ? Number(formData.customerID) : 0}
            customerName={selectedCust ? `${selectedCust.firstName} ${selectedCust.lastName}` : ''}
            collateralCategory={curRate?.collateralCategory || 'FixedDeposit'}
            maxLtv={curRate?.maxLtvPercentage || 85}
            alreadySelectedIds={depositCollaterals.map((c: any) => c.depositAccountID || c.DepositAccountID)}
            onApply={(selectedItems, totalVal, summaryText) => {
              setDepositCollaterals(selectedItems);
              setFormData(prev => ({
                ...prev,
                securityValue: totalVal.toString(),
                securityDetails: summaryText
              }));
            }}
          />
        );
      })()}

    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import {
  Landmark,
  CheckCircle2,
  AlertCircle,
  Calendar,
  UserCheck,
  Search,
  BookOpen,
  ShieldCheck,
  RotateCcw,
  X,
  List,
  Percent,
  IndianRupee,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Plus,
  Layers,
  CheckCircle,
  XCircle,
  Save,
  Calculator,
  UserPlus,
  Clock,
  Sparkles,
  Eye,
  FileText,
  Printer,
  User,
  Phone,
  MapPin
} from 'lucide-react';
import LoanApplicationPrintModal from './LoanApplicationPrintModal';
import DepositCollateralSelectorModal, { EligibleDeposit } from './DepositCollateralSelectorModal';

export interface Member extends MemberOption {}

export interface LoanRate {
  loanRateID: number;
  loanType: string;
  loanCode?: string;
  shortName: string;
  interestRate: number;
  isActive: boolean;
  interestCalculationMethod?: string;
  loanInstallmentType?: string;
  installmentType?: string;
  installmentCount?: number;
  durationMonths?: number;
  collateralCategory?: string;
  maxLtvPercentage?: number;
  isLienRequired?: boolean;
  isCollateralMandatoryForOpeningBalance?: boolean;
}

export interface LoanApplication {
  loanApplicationID: number;
  applicationNo: string;
  applicationDate: string;
  customerID?: number;
  coCustomerID?: number;
  coCustomer2ID?: number;
  loanRateID: number;
  loanType?: string;
  requestedAmount: number;
  interestRate: number;
  durationMonths: number;
  installmentFrequency: string;
  noOfInstallments: number;
  installmentAmount: number;
  firstInstallmentDate?: string;
  maturityDate?: string;
  recommendedByDirectorID?: number;
  guarantor1CustomerID?: number;
  guarantor2CustomerID?: number;
  securityDetails?: string;
  securityValue?: number;
  purpose?: string;
  customer?: any;
  coCustomer?: any;
  coCustomer2?: any;
  loanRate?: LoanRate;
  guarantor1Customer?: any;
  guarantor2Customer?: any;
  recommendedByDirector?: any;
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
}

interface GuaranteedLoanItem {
  loanAccountID?: number;
  loanApplicationID?: number;
  loanAccountNo?: string;
  applicationNo?: string;
  borrowerName: string;
  borrowerCode?: string;
  loanType: string;
  sanctionedAmount?: number;
  requestedAmount?: number;
  currentBalance?: number;
  status: string;
}

interface GuarantorSummary {
  memberID: number;
  memberName: string;
  memberCode: string;
  cifNo?: string;
  mobileNo?: string;
  address?: string;
  village?: string;
  occupation?: string;
  sharesCount?: number;
  sharesBalance?: number;
  savingsBalance?: number;
  ownActiveLoansCount?: number;
  ownPendingAppsCount?: number;
  ownTotalBalance?: number;
  ownLoans?: GuaranteedLoanItem[];
  ownApplications?: GuaranteedLoanItem[];
  activeGuaranteedLoansCount: number;
  pendingGuaranteedAppsCount: number;
  totalGuaranteedAmount: number;
  totalCurrentBalance: number;
  guaranteedLoans: GuaranteedLoanItem[];
  guaranteedApplications: GuaranteedLoanItem[];
}

interface DirectorRecommendationSummary {
  memberID: number;
  directorName: string;
  directorCode: string;
  cifNo?: string;
  mobileNo?: string;
  activeRecommendedLoansCount: number;
  pendingRecommendedAppsCount: number;
  totalRecommendedSanctionedAmount: number;
  totalRecommendedCurrentBalance: number;
  recommendedLoans: GuaranteedLoanItem[];
  recommendedApplications: GuaranteedLoanItem[];
}

const InstallmentFrequencies = [
  "साप्ताहिक",
  "मासिक",
  "त्रैमासिक",
  "सहामाही",
  "वार्षिक"
];

const formatDateSafe = (dateVal: any): string => {
  if (!dateVal) return '-';
  if (typeof dateVal === 'string') {
    const str = dateVal.trim();
    if (!str) return '-';
    // Match DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (ddmmyyyyMatch) {
      const day = ddmmyyyyMatch[1].padStart(2, '0');
      const month = ddmmyyyyMatch[2].padStart(2, '0');
      const year = ddmmyyyyMatch[3];
      return `${day}/${month}/${year}`;
    }
    // Match YYYY-MM-DD
    const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (yyyymmddMatch) {
      const year = yyyymmddMatch[1];
      const month = yyyymmddMatch[2].padStart(2, '0');
      const day = yyyymmddMatch[3].padStart(2, '0');
      return `${day}/${month}/${year}`;
    }
  }
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return String(dateVal);
};

const LoanApplicationMaster: React.FC<{ onNext?: (data: any) => void; editingApplicationId?: number }> = ({ onNext, editingApplicationId }) => {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [securityTypes, setSecurityTypes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [showListModal, setShowListModal] = useState(false);
  const [guarantor1Summary, setGuarantor1Summary] = useState<GuarantorSummary | null>(null);
  const [guarantor2Summary, setGuarantor2Summary] = useState<GuarantorSummary | null>(null);
  const [selectedGuarantorForModal, setSelectedGuarantorForModal] = useState<GuarantorSummary | null>(null);
  const [directorSummary, setDirectorSummary] = useState<DirectorRecommendationSummary | null>(null);
  const [selectedDirectorForModal, setSelectedDirectorForModal] = useState<DirectorRecommendationSummary | null>(null);
  const [isInstAmountEdited, setIsInstAmountEdited] = useState<boolean>(false);
  const [showSchedule, setShowSchedule] = useState<boolean>(false);
  const [printApplication, setPrintApplication] = useState<any | null>(null);

  const formContainerRef = useRef<HTMLDivElement>(null);
  const requestedAmountInputRef = useRef<HTMLInputElement>(null);

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-1 truncate";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[30px]";

  // Deposit Collateral Modal & State
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositCollaterals, setDepositCollaterals] = useState<any[]>([]);

  // Gold Loan Modal & CRUD State
  const [showGoldModal, setShowGoldModal] = useState(false);
  const [goldItems, setGoldItems] = useState<GoldLoanItem[]>([]);
  const [editingGoldId, setEditingGoldId] = useState<string | null>(null);
  const [goldForm, setGoldForm] = useState<{
    itemName: string;
    purity: string;
    quantity: number | string;
    grossWeight: number | string;
    netWeight: number | string;
    ratePerGram: number | string;
    remarks: string;
  }>({
    itemName: 'सोन्याची साखळी (Chain)',
    purity: '22K (91.6%)',
    quantity: 1,
    grossWeight: '',
    netWeight: '',
    ratePerGram: 6000,
    remarks: ''
  });

  const initialFormState: Partial<LoanApplication> = {
    applicationNo: "AUTO",
    applicationDate: new Date().toISOString().split('T')[0],
    customerID: 0,
    coCustomerID: 0,
    coCustomer2ID: 0,
    guarantor1CustomerID: 0,
    guarantor2CustomerID: 0,
    loanRateID: 0,
    requestedAmount: 0,
    interestRate: 0,
    durationMonths: 12,
    installmentFrequency: 'मासिक',
    noOfInstallments: 12,
    installmentAmount: 0,
    firstInstallmentDate: '',
    maturityDate: '',
    recommendedByDirectorID: 0,
    securityDetails: '',
    securityValue: 0,
    purpose: ''
  };

  const [formData, setFormData] = useState<Partial<LoanApplication>>(initialFormState);
  const [showCoBorrowers, setShowCoBorrowers] = useState<boolean>(false);

  const fetchNextAppNo = async () => {
    try {
      const res = await axios.get('/api/LoanApplications/next-number');
      if (res.data) {
        setFormData(prev => ({
          ...prev,
          applicationNo: typeof res.data === 'string' ? res.data : (res.data.applicationNo || "AUTO")
        }));
      }
    } catch (err) {
      console.error("Failed to fetch next application number", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDropdowns();
    fetchNextAppNo();
  }, []);

  useEffect(() => {
    if (formData.guarantor1CustomerID) {
      axios.get(`/api/Members/${formData.guarantor1CustomerID}/guarantor-summary`)
        .then(res => setGuarantor1Summary(res.data))
        .catch(err => console.error("Failed to fetch guarantor 1 summary", err));
    } else {
      setGuarantor1Summary(null);
    }
  }, [formData.guarantor1CustomerID]);

  useEffect(() => {
    if (formData.guarantor2CustomerID) {
      axios.get(`/api/Members/${formData.guarantor2CustomerID}/guarantor-summary`)
        .then(res => setGuarantor2Summary(res.data))
        .catch(err => console.error("Failed to fetch guarantor 2 summary", err));
    } else {
      setGuarantor2Summary(null);
    }
  }, [formData.guarantor2CustomerID]);

  useEffect(() => {
    if (formData.recommendedByDirectorID) {
      axios.get(`/api/Members/${formData.recommendedByDirectorID}/director-recommendation-summary`)
        .then(res => setDirectorSummary(res.data))
        .catch(err => console.error("Failed to fetch director summary", err));
    } else {
      setDirectorSummary(null);
    }
  }, [formData.recommendedByDirectorID]);

  useEffect(() => {
    if (editingApplicationId) {
      const fetchApp = async () => {
        try {
          let app = applications.find(a => a.loanApplicationID === editingApplicationId);
          if (!app) {
            const res = await axios.get(`/api/LoanApplications/${editingApplicationId}`);
            app = res.data;
          }
          if (app) {
            handleEdit(app);
          }
        } catch (err) {
          console.error("Failed to load application for editing", err);
        }
      };
      fetchApp();
    }
  }, [editingApplicationId, applications]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerIdStr = params.get('customerId') || params.get('memberId');
    if (customerIdStr && members.length > 0) {
      const cId = parseInt(customerIdStr, 10);
      const matchedCust = members.find((m: any) => m.customerID === cId || m.id === cId);
      if (matchedCust) {
        setFormData(prev => ({
          ...prev,
          customerID: cId
        }));
      }
    }
  }, [members]);

  // Core Banking Helper for computing standard installment based on interest policy
  const computeCalculatedInstallment = (
    P: number,
    ratePerYear: number,
    n: number,
    frequency: string,
    durationMonths: number,
    rateObj?: LoanRate
  ) => {
    if (P <= 0 || ratePerYear <= 0 || n <= 0) return 0;

    let freqDivisor = 12;
    let stepMonths = 1;
    const isWeekly = frequency === 'साप्ताहिक';
    if (isWeekly) {
      freqDivisor = 52;
      stepMonths = 0;
    } else if (frequency === 'त्रैमासिक') {
      freqDivisor = 4;
      stepMonths = 3;
    } else if (frequency === 'सहामाही') {
      freqDivisor = 2;
      stepMonths = 6;
    } else if (frequency === 'वार्षिक') {
      freqDivisor = 1;
      stepMonths = 12;
    }

    const calcMethod = rateObj?.interestCalculationMethod || "Flat (फ्लॅट)";
    const instType = rateObj?.loanInstallmentType || "समान हप्ता";

    if (calcMethod.includes("Flat") || calcMethod.includes("फ्लॅट") || instType.includes("फ्लॅट")) {
      // Flat Interest Policy: Total Interest = P * R * T / 100
      const totalMonths = durationMonths > 0 ? durationMonths : (isWeekly ? Math.max(1, Math.ceil(n / 4.33)) : n * stepMonths);
      const totalInterest = (P * ratePerYear * (totalMonths / 12)) / 100;
      return Math.round((P + totalInterest) / n);
    } else if (calcMethod.includes("Reducing") && (instType === "समान मुद्दल" || instType === "कर्जावरती" || instType.includes("मुद्दल") || instType.includes("कर्जावर"))) {
      // Reducing - Equal Principal (मुद्दल स्थिर, हप्ता घटत जाणारा)
      return Math.round(P / n);
    } else {
      // Reducing - Equated Monthly Installment (EMI)
      const r = (ratePerYear / 100) / freqDivisor;
      if (r === 0) return Math.round(P / n);
      return Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    }
  };

  // Auto EMI calculation
  useEffect(() => {
    if (formData.requestedAmount && formData.interestRate && formData.noOfInstallments) {
      const P = formData.requestedAmount;
      const ratePerYear = formData.interestRate;
      const n = formData.noOfInstallments;
      const rateObj = loanRates.find(r => r.loanRateID === formData.loanRateID);

      const newInstallment = computeCalculatedInstallment(
        P,
        ratePerYear,
        n,
        formData.installmentFrequency || 'मासिक',
        formData.durationMonths || 12,
        rateObj
      );
      
      if (!isInstAmountEdited && formData.installmentAmount !== newInstallment) {
        setFormData(prev => ({ ...prev, installmentAmount: newInstallment }));
      }
    }
  }, [formData.requestedAmount, formData.interestRate, formData.noOfInstallments, formData.installmentFrequency, formData.durationMonths, formData.loanRateID, loanRates, isInstAmountEdited]);

  useEffect(() => {
    if (formData.durationMonths && formData.installmentFrequency) {
      let div = 1;
      if (formData.installmentFrequency === 'साप्ताहिक') div = 0.2307;
      else if (formData.installmentFrequency === 'त्रैमासिक') div = 3;
      else if (formData.installmentFrequency === 'सहामाही') div = 6;
      else if (formData.installmentFrequency === 'वार्षिक') div = 12;

      const calculatedInst = formData.installmentFrequency === 'साप्ताहिक'
        ? Math.max(1, Math.round(formData.durationMonths * 4.33))
        : Math.max(1, Math.floor(formData.durationMonths / div));
      if (formData.noOfInstallments !== calculatedInst) {
        setFormData(prev => ({ ...prev, noOfInstallments: calculatedInst }));
      }
    }
  }, [formData.durationMonths, formData.installmentFrequency]);

  useEffect(() => {
    if (formData.applicationDate && formData.installmentFrequency && formData.noOfInstallments) {
      const appDate = new Date(formData.applicationDate);
      let firstDate = new Date(appDate);
      let matDate = new Date(appDate);
      const n = formData.noOfInstallments;

      if (formData.installmentFrequency === 'साप्ताहिक') {
        firstDate.setDate(firstDate.getDate() + 7);
        matDate = new Date(firstDate);
        matDate.setDate(matDate.getDate() + (n - 1) * 7);
      } else if (formData.installmentFrequency === 'मासिक') {
        firstDate.setMonth(firstDate.getMonth() + 1);
        matDate = new Date(firstDate);
        matDate.setMonth(matDate.getMonth() + (n - 1));
      } else if (formData.installmentFrequency === 'त्रैमासिक') {
        firstDate.setMonth(firstDate.getMonth() + 3);
        matDate = new Date(firstDate);
        matDate.setMonth(matDate.getMonth() + (n - 1) * 3);
      } else if (formData.installmentFrequency === 'सहामाही') {
        firstDate.setMonth(firstDate.getMonth() + 6);
        matDate = new Date(firstDate);
        matDate.setMonth(matDate.getMonth() + (n - 1) * 6);
      } else if (formData.installmentFrequency === 'वार्षिक') {
        firstDate.setFullYear(firstDate.getFullYear() + 1);
        matDate = new Date(firstDate);
        matDate.setFullYear(matDate.getFullYear() + (n - 1));
      }

      const firstStr = firstDate.toISOString().split('T')[0];
      const matStr = matDate.toISOString().split('T')[0];

      if (formData.firstInstallmentDate !== firstStr || formData.maturityDate !== matStr) {
        setFormData(prev => ({ 
          ...prev, 
          firstInstallmentDate: firstStr, 
          maturityDate: matStr 
        }));
      }
    }
  }, [formData.applicationDate, formData.installmentFrequency, formData.noOfInstallments]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/LoanApplications');
      setApplications(res.data);
    } catch (err) {
      console.error(err);
      setError('कर्ज अर्ज लोड करण्यात अयशस्वी!');
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const memRes = await axios.get('/api/Customers');
      setMembers(memRes.data.filter((m: any) => m.status === 'Active'));

      const ratesRes = await axios.get('/api/LoanRates');
      setLoanRates(ratesRes.data);

      const secRes = await axios.get('/api/SecurityTypes');
      setSecurityTypes(secRes.data.filter((s: any) => s.isActive));
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (name === 'installmentAmount') {
      setIsInstAmountEdited(true);
    }
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (parseFloat(value) || 0) : value
    }));
  };

  const handleResetInstAmount = () => {
    setIsInstAmountEdited(false);
    if (formData.requestedAmount && formData.interestRate && formData.noOfInstallments) {
      const P = formData.requestedAmount;
      const ratePerYear = formData.interestRate;
      const n = formData.noOfInstallments;
      const rateObj = loanRates.find(r => r.loanRateID === formData.loanRateID);

      const newInstallment = computeCalculatedInstallment(
        P,
        ratePerYear,
        n,
        formData.installmentFrequency || 'मासिक',
        formData.durationMonths || 12,
        rateObj
      );
      setFormData(prev => ({ ...prev, installmentAmount: newInstallment }));
    }
  };

  const handleLoanRateChange = (id: number) => {
    const rate = loanRates.find(r => r.loanRateID === id);
    if (rate) {
      setFormData(prev => ({
        ...prev,
        loanRateID: id,
        loanType: rate.loanType,
        interestRate: rate.interestRate,
        installmentFrequency: rate.installmentType || prev.installmentFrequency || 'मासिक',
        noOfInstallments: rate.installmentCount || prev.noOfInstallments || 12,
        durationMonths: rate.durationMonths || prev.durationMonths || 12
      }));

      if (['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(rate.collateralCategory || '') && formData.customerID && depositCollaterals.length === 0) {
        setShowDepositModal(true);
      }
    } else {
      setFormData(prev => ({ ...prev, loanRateID: id }));
    }
  };

  const handleResetForm = () => {
    setIsInstAmountEdited(false);
    setShowSchedule(false);
    setError('');
    setSuccess('');
    setScheduleData([]);
    setShowCoBorrowers(false);
    setDepositCollaterals([]);
    setShowDepositModal(false);
    setFormData({
      ...initialFormState,
      applicationDate: new Date().toISOString().split('T')[0]
    });
    fetchNextAppNo();
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.customerID) {
      setError('कृपया अर्जदार खातेदार निवडा! (Please select Applicant Customer)');
      return;
    }

    if (!formData.loanRateID || !formData.requestedAmount) {
      setError('कृपया कर्ज प्रकार आणि मागणी रक्कम टाका! (Please select Loan Type and Requested Amount)');
      return;
    }

    const curRate = loanRates.find(r => r.loanRateID === formData.loanRateID);
    if (curRate && ['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(curRate.collateralCategory || '')) {
      if (curRate.isLienRequired && depositCollaterals.length === 0) {
        setError(`सदर कर्ज योजनेसाठी (${curRate.shortName || curRate.loanType}) नवीन कर्ज अर्जात तारण ठेव जोडणे अनिवार्य आहे! कृपया तारण ठेव जोडा.`);
        setShowDepositModal(true);
        return;
      }
    }

    setLoading(true);
    try {
      let savedData: any = null;

      const payload: any = {
        ...formData,
        customerID: Number(formData.customerID),
        coCustomerID: formData.coCustomerID && Number(formData.coCustomerID) > 0 ? Number(formData.coCustomerID) : null,
        coCustomer2ID: formData.coCustomer2ID && Number(formData.coCustomer2ID) > 0 ? Number(formData.coCustomer2ID) : null,
        guarantor1CustomerID: formData.guarantor1CustomerID && Number(formData.guarantor1CustomerID) > 0 ? Number(formData.guarantor1CustomerID) : null,
        guarantor2CustomerID: formData.guarantor2CustomerID && Number(formData.guarantor2CustomerID) > 0 ? Number(formData.guarantor2CustomerID) : null,
        loanRateID: Number(formData.loanRateID),
        requestedAmount: parseFloat(String(formData.requestedAmount || '0')),
        interestRate: parseFloat(String(formData.interestRate || '0')),
        durationMonths: parseInt(String(formData.durationMonths || '12'), 10),
        noOfInstallments: parseInt(String(formData.noOfInstallments || '12'), 10),
        installmentAmount: parseFloat(String(formData.installmentAmount || '0')),
        securityValue: parseFloat(String(formData.securityValue || '0')),
        recommendedByDirectorID: formData.recommendedByDirectorID && Number(formData.recommendedByDirectorID) > 0 ? Number(formData.recommendedByDirectorID) : null,
        firstInstallmentDate: formData.firstInstallmentDate ? formData.firstInstallmentDate : null,
        maturityDate: formData.maturityDate ? formData.maturityDate : null,
      };
      delete payload.customer;
      delete payload.coCustomer;
      delete payload.coCustomer2;
      delete payload.loanRate;
      delete payload.guarantor1Customer;
      delete payload.guarantor2Customer;
      delete payload.recommendedByDirector;

      let savedAppId = formData.loanApplicationID;
      if (formData.loanApplicationID) {
        await axios.put(`/api/LoanApplications/${formData.loanApplicationID}`, payload);
        savedData = { ...payload };
        setSuccess(`कर्ज अर्ज #${formData.applicationNo || formData.loanApplicationID} यशस्वीरित्या अद्यतनित झाला!`);
      } else {
        delete payload.loanApplicationID;
        const res = await axios.post('/api/LoanApplications', payload);
        savedData = res.data;
        savedAppId = res.data.loanApplicationID;
        setSuccess(`नवीन कर्ज अर्ज #${res.data.applicationNo || res.data.loanApplicationID} यशस्वीरीत्या सेव्ह झाला!`);
      }

      if (savedAppId && depositCollaterals.length > 0) {
        try {
          await axios.post(`/api/LoanCollaterals/SaveApplicationCollaterals/${savedAppId}`, depositCollaterals);
        } catch (colErr) {
          console.error("Failed to save collaterals", colErr);
        }
      }

      fetchData();

      if (onNext) {
        onNext(savedData);
      } else {
        setTimeout(() => {
          handleResetForm();
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      const errorData = err.response?.data;
      if (typeof errorData === 'object' && errorData !== null) {
        setError(errorData.title || errorData.message || JSON.stringify(errorData));
      } else {
        setError(errorData || 'कर्ज अर्ज जतन करताना त्रुटी आली.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (app: LoanApplication) => {
    setIsInstAmountEdited(true);
    setError('');
    setSuccess('');
    setShowCoBorrowers(Boolean(app.coCustomerID || (app as any).coCustomer2ID || (app as any).coMemberID || (app as any).coMember2ID));
    setFormData({
      ...app,
      applicationDate: app.applicationDate ? app.applicationDate.split('T')[0] : '',
      firstInstallmentDate: app.firstInstallmentDate ? app.firstInstallmentDate.split('T')[0] : '',
      maturityDate: app.maturityDate ? app.maturityDate.split('T')[0] : ''
    });

    // Fetch collaterals if any
    try {
      const colRes = await axios.get(`/api/LoanCollaterals/ByApplication/${app.loanApplicationID}`);
      setDepositCollaterals(colRes.data || []);
    } catch {
      setDepositCollaterals([]);
    }
    
    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    // Auto-fetch schedule for edited application
    if (app.requestedAmount && app.interestRate && app.noOfInstallments && app.loanRateID) {
      try {
        const payload = {
          loanRateID: app.loanRateID,
          loanAmount: app.requestedAmount,
          interestRate: app.interestRate,
          noOfInstallments: app.noOfInstallments,
          durationMonths: app.durationMonths || 12,
          installmentFrequency: app.installmentFrequency || 'मासिक',
          loanDisbursementDate: app.applicationDate || new Date().toISOString().split('T')[0],
          firstInstallmentDate: app.firstInstallmentDate ? app.firstInstallmentDate : null,
          customInstallmentAmount: app.installmentAmount && app.installmentAmount > 0 ? app.installmentAmount : null
        };
        const res = await axios.post('/api/LoanAccounts/PreviewSchedule', payload);
        const mappedSchedule = res.data.map((row: any) => ({
          instNo: row.no,
          dueDate: formatDateSafe(row.date),
          principal: Math.round(row.principal),
          interest: Math.round(row.interest),
          total: Math.round(row.principal) + Math.round(row.interest),
          balance: Math.round(row.balance),
          openingBalance: Math.round(row.openingBalance),
          closingBalance: Math.round(row.closingBalance),
          days: row.days,
          interestRate: row.interestRate
        }));
        setScheduleData(mappedSchedule);
      } catch(e) {}
    }
  };

  const calculateSchedule = async () => {
    setError('');

    const reqAmount = parseFloat(String(formData.requestedAmount || '0'));
    const intRate = parseFloat(String(formData.interestRate || '0'));
    const instCount = parseInt(String(formData.noOfInstallments || '0'), 10);
    const rateId = parseInt(String(formData.loanRateID || '0'), 10);

    if (!rateId || reqAmount <= 0 || intRate <= 0 || instCount <= 0) {
      setError('कृपया कर्ज प्रकार, कर्ज रक्कम, व्याज दर आणि हप्ते संख्या टाका!');
      return;
    }

    try {
      const payload = {
        loanRateID: rateId,
        loanAmount: reqAmount,
        interestRate: intRate,
        noOfInstallments: instCount,
        durationMonths: formData.durationMonths || 12,
        installmentFrequency: formData.installmentFrequency || 'मासिक',
        loanDisbursementDate: formData.applicationDate || new Date().toISOString().split('T')[0],
        firstInstallmentDate: formData.firstInstallmentDate ? formData.firstInstallmentDate : null,
        customInstallmentAmount: isInstAmountEdited && formData.installmentAmount && formData.installmentAmount > 0 ? formData.installmentAmount : null
      };

      const res = await axios.post('/api/LoanAccounts/PreviewSchedule', payload);
      
      const mappedSchedule = res.data.map((row: any) => {
        const roundedPrincipal = Math.round(row.principal);
        const roundedInterest = Math.round(row.interest);
        const roundedTotal = roundedPrincipal + roundedInterest;
        return {
          instNo: row.no,
          dueDate: formatDateSafe(row.date),
          principal: roundedPrincipal,
          interest: roundedInterest,
          total: roundedTotal,
          balance: Math.round(row.balance),
          openingBalance: Math.round(row.openingBalance),
          closingBalance: Math.round(row.closingBalance),
          days: row.days,
          interestRate: row.interestRate
        };
      });

      if (mappedSchedule.length > 0 && !isInstAmountEdited) {
        const firstRow = mappedSchedule[0];
        const rateObj = loanRates.find(r => r.loanRateID === formData.loanRateID);
        let instAmount = Math.round(firstRow.total);
        
        if (rateObj) {
          const calcMethod = rateObj.interestCalculationMethod || "Reducing (घटती शिल्लक)";
          const instType = rateObj.loanInstallmentType || "समान हप्ता";
          if (calcMethod.includes("Reducing") && (instType === "समान मुद्दल" || instType === "कर्जावरती" || instType.includes("मुद्दल") || instType.includes("कर्जावर"))) {
            instAmount = Math.round(firstRow.principal);
          }
        }
        setFormData(p => ({ ...p, installmentAmount: instAmount }));
      }

      setError('');
      setScheduleData(mappedSchedule);
      setShowSchedule(true);
    } catch (err) {
      console.error(err);
      setError('हप्ता वेळापत्रक लोड करताना त्रुटी आली.');
    }
  };

  const handleExportScheduleExcel = () => {
    if (!scheduleData || scheduleData.length === 0) return;
    const applicantMember = members.find((m: any) => (m.customerID || m.id) === formData.customerID);
    const applicantName = applicantMember ? (applicantMember.fullName || applicantMember.name) : 'अर्जदार';
    const rateObj = loanRates.find(r => r.loanRateID === formData.loanRateID);

    const data: any[][] = [
      ['हप्ता वेळापत्रक पत्रक (Live Schedule)'],
      ['अर्ज क्र.', formData.applicationNumber || '-', 'अर्ज दिनांक', formData.applicationDate || '-'],
      ['अर्जदार', applicantName, 'कर्ज योजना', rateObj?.loanType || '-'],
      ['मागणी रक्कम', formData.requestedAmount || 0, 'व्याज दर', `${formData.interestRate || 0}%`],
      ['हप्ता रक्कम', formData.installmentAmount || 0, 'हप्ते संख्या', formData.noOfInstallments || 0],
      [],
      ['हप्ता क्र.', 'हप्ता दिनांक', 'मुद्दल (₹)', 'व्याज (₹)', 'एकूण हप्ता (₹)', 'बाकी शिल्लक (₹)']
    ];

    scheduleData.forEach((row) => {
      data.push([
        row.instNo,
        row.dueDate,
        Math.round(row.principal || 0),
        Math.round(row.interest || 0),
        Math.round(row.total || 0),
        Math.round(row.balance || 0)
      ]);
    });

    const totalPrin = scheduleData.reduce((acc, r) => acc + Math.round(r.principal || 0), 0);
    const totalInt = scheduleData.reduce((acc, r) => acc + Math.round(r.interest || 0), 0);
    const totalAll = scheduleData.reduce((acc, r) => acc + Math.round(r.total || 0), 0);

    data.push(['एकूण (Total)', '', totalPrin, totalInt, totalAll, '']);

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'वेळापत्रक');
    XLSX.writeFile(wb, `Loan_Schedule_${formData.applicationNumber || 'APP'}.xlsx`);
  };

  const handlePrintSchedule = () => {
    if (!scheduleData || scheduleData.length === 0) return;
    const applicantMember = members.find((m: any) => (m.customerID || m.id) === formData.customerID);
    const applicantName = applicantMember ? (applicantMember.fullName || applicantMember.name) : '-';
    const rateObj = loanRates.find(r => r.loanRateID === formData.loanRateID);
    const totalPrin = scheduleData.reduce((acc, r) => acc + Math.round(r.principal || 0), 0);
    const totalInt = scheduleData.reduce((acc, r) => acc + Math.round(r.interest || 0), 0);
    const totalAll = scheduleData.reduce((acc, r) => acc + Math.round(r.total || 0), 0);

    const printWin = window.open('', '_blank', 'width=850,height=900');
    if (!printWin) {
      alert('कृपया पॉपअप ब्लॉकर बंद करा.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>हप्ता वेळापत्रक - ${formData.applicationNumber || 'APP'}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 10px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 12px; }
          .header h2 { margin: 0 0 4px 0; font-size: 18px; color: #047857; }
          .header p { margin: 0; font-size: 12px; color: #555; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; margin-bottom: 14px; }
          .meta-item { font-size: 11px; }
          .meta-item span { display: block; color: #64748b; font-size: 10px; }
          .meta-item strong { font-size: 12px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 11px; }
          th { background: #f1f5f9; font-weight: bold; text-align: center; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          tfoot tr td { font-weight: bold; background: #f8fafc; border-top: 2px solid #475569; }
          .footer-sign { margin-top: 40px; display: flex; justify-content: space-between; padding: 0 30px; font-weight: bold; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>हप्ता वेळापत्रक पत्रक (Live Schedule)</h2>
          <p>कर्ज अर्ज क्र.: <strong>${formData.applicationNumber || '-'}</strong> | अर्ज दिनांक: <strong>${formData.applicationDate || '-'}</strong></p>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><span>अर्जदार खातेदार:</span><strong>${applicantName}</strong></div>
          <div class="meta-item"><span>कर्ज योजना:</span><strong>${rateObj?.loanType || '-'}</strong></div>
          <div class="meta-item"><span>मागणी रक्कम:</span><strong>₹${(formData.requestedAmount || 0).toLocaleString('en-IN')}</strong></div>
          <div class="meta-item"><span>व्याज दर:</span><strong>${formData.interestRate || 0}% p.a.</strong></div>
          <div class="meta-item"><span>हप्ता रक्कम:</span><strong>₹${(formData.installmentAmount || 0).toLocaleString('en-IN')}</strong></div>
          <div class="meta-item"><span>हप्ते संख्या:</span><strong>${formData.noOfInstallments || 0} हप्ते</strong></div>
          <div class="meta-item"><span>पहिले हप्ता दि.:</span><strong>${formData.firstInstallmentDate || '-'}</strong></div>
          <div class="meta-item"><span>परतफेड मुदत:</span><strong>${formData.maturityDate || '-'}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">हप्ता</th>
              <th>हप्ता दिनांक</th>
              <th class="text-right">मुद्दल (₹)</th>
              <th class="text-right">व्याज (₹)</th>
              <th class="text-right">एकूण हप्ता (₹)</th>
              <th class="text-right">बाकी शिल्लक (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${scheduleData.map(r => `
              <tr>
                <td class="text-center">${r.instNo}</td>
                <td class="text-center">${r.dueDate || '-'}</td>
                <td class="text-right">${Math.round(r.principal || 0).toLocaleString('en-IN')}</td>
                <td class="text-right">${Math.round(r.interest || 0).toLocaleString('en-IN')}</td>
                <td class="text-right" style="font-weight: bold;">${Math.round(r.total || 0).toLocaleString('en-IN')}</td>
                <td class="text-right">${Math.round(r.balance || 0).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="text-center">एकूण (Total)</td>
              <td class="text-right">₹${totalPrin.toLocaleString('en-IN')}</td>
              <td class="text-right">₹${totalInt.toLocaleString('en-IN')}</td>
              <td class="text-right">₹${totalAll.toLocaleString('en-IN')}</td>
              <td class="text-right">-</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer-sign">
          <div>लिपिक / अधिकारी स्वाक्षरी</div>
          <div>शाखा व्यवस्थापक स्वाक्षरी</div>
          <div>कर्जदार स्वाक्षरी</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    printWin.document.write(html);
    printWin.document.close();
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('तुम्हाला नक्की हा कर्ज अर्ज डिलीट करायचा आहे का? (या अर्जाशी संबंधित कर्ज खाते व वितरण असल्यास तेही सुरक्षितपणे काढले जाईल.)')) {
      try {
        await axios.delete(`/api/LoanApplications/${id}`);
        fetchData();
        setSuccess('कर्ज अर्ज यशस्वीरित्या डिलीट करण्यात आला.');
      } catch (err: any) {
        console.error(err);
        const msg = err.response?.data?.message || (typeof err.response?.data === 'string' ? err.response.data : err.message);
        setError(msg || 'कर्ज अर्ज डिलीट करताना त्रुटी आली.');
        alert(msg || 'कर्ज अर्ज डिलीट करताना त्रुटी आली.');
      }
    }
  };

  // Gold Loan Add/Edit/Delete
  const handleAddGoldItem = (e: React.FormEvent) => {
    e.preventDefault();
    const gross = parseFloat(goldForm.grossWeight.toString() || '0');
    const net = parseFloat(goldForm.netWeight.toString() || '0');
    const rate = parseFloat(goldForm.ratePerGram.toString() || '0');
    const qty = parseInt(goldForm.quantity.toString() || '1');
    const valuation = Math.round(net * rate);

    if (!goldForm.itemName) {
      alert('कृपया सोन्याच्या दागिन्याचे नाव प्रविष्ट करा!');
      return;
    }
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
        remarks: goldForm.remarks
      } : item));
      setEditingGoldId(null);
    } else {
      const newItem: GoldLoanItem = {
        id: Date.now().toString(),
        itemName: goldForm.itemName,
        purity: goldForm.purity,
        quantity: qty,
        grossWeight: gross,
        netWeight: net,
        ratePerGram: rate,
        valuationAmount: valuation,
        remarks: goldForm.remarks
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
      remarks: ''
    });
  };

  const handleEditGoldItem = (item: GoldLoanItem) => {
    setEditingGoldId(item.id);
    setGoldForm({
      itemName: item.itemName,
      purity: item.purity,
      quantity: item.quantity,
      grossWeight: item.grossWeight,
      netWeight: item.netWeight,
      ratePerGram: item.ratePerGram,
      remarks: item.remarks || ''
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

  const applyGoldLoanToApplication = () => {
    const securitySummary = `सोने तारण: ${goldItems.length} जिन्नस (${totalGoldItemsCount} नग), निव्वळ वजन: ${totalGoldNetWeight.toFixed(2)} ग्रॅम, मूल्यांकन: ₹${totalGoldValuation.toLocaleString('en-IN')}`;
    setFormData(prev => ({
      ...prev,
      securityValue: totalGoldValuation,
      securityDetails: securitySummary
    }));
    setShowGoldModal(false);
    setSuccess('सुवर्ण तारण मूल्यांकन रक्कम कर्ज अर्जाला जोडली गेली!');
  };

  const handleExportExcel = () => {
    if (filteredApps.length === 0) return;
    const rows = filteredApps.map((a, i) => ({
      'अ.क्र.': i + 1,
      'अर्ज क्र.': a.applicationNo,
      'दिनांक': a.applicationDate ? new Date(a.applicationDate).toLocaleDateString('en-GB') : '-',
      'CIF क्र.': a.customer?.cifNo || '-',
      'अर्जदार नाव': `${a.customer?.firstName || ''} ${a.customer?.lastName || ''}`.trim(),
      'कर्ज प्रकार': a.loanRate?.shortName || a.loanRate?.loanType || a.loanType || '-',
      'मागणी रक्कम (₹)': a.requestedAmount || 0,
      'व्याजदर (%)': a.interestRate || 0,
      'मुदत (महिने)': a.durationMonths || 0,
      'हप्ता रक्कम (₹)': a.installmentAmount || 0,
      'तारण मूल्य (₹)': a.securityValue || 0,
      'कर्जाचे कारण': a.purpose || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LoanApplications');
    XLSX.writeFile(wb, `Loan_Applications_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const selectedMember = members.find((m: any) => 
    formData.customerID && (m.customerID === Number(formData.customerID) || m.id === Number(formData.customerID))
  );

  const selectedCoMember1 = members.find((m: any) => 
    formData.coCustomerID && (m.customerID === Number(formData.coCustomerID) || m.id === Number(formData.coCustomerID))
  );

  const selectedCoMember2 = members.find((m: any) => 
    formData.coCustomer2ID && (m.customerID === Number(formData.coCustomer2ID) || m.id === Number(formData.coCustomer2ID))
  );

  const filteredApps = applications.filter(a => {
    const q = searchTerm.toLowerCase();
    const custName = a.customer ? `${a.customer.firstName || ''} ${a.customer.lastName || ''}`.toLowerCase() : '';
    const custCif = a.customer?.cifNo ? a.customer.cifNo.toLowerCase() : '';
    const legacyCif = (a.customer as any)?.legacyCustomerNo ? String((a.customer as any).legacyCustomerNo).toLowerCase() : '';
    return (
      (a.applicationNo && a.applicationNo.toLowerCase().includes(q)) ||
      custName.includes(q) ||
      custCif.includes(q) ||
      legacyCif.includes(q) ||
      (a.loanRate?.loanType && a.loanRate.loanType.toLowerCase().includes(q))
    );
  });

  const secOptions = securityTypes.map(s => ({
    value: s.name,
    label: s.name
  }));

  // KPI Calculations
  const totalRequestedAmount = applications.reduce((sum, a) => sum + (a.requestedAmount || 0), 0);
  const avgRate = applications.length > 0
    ? (applications.reduce((sum, a) => sum + (a.interestRate || 0), 0) / applications.length).toFixed(2)
    : '0.00';
  const activeSchemesCount = loanRates.filter(r => r.isActive).length;

  const isEditing = Boolean(formData.loanApplicationID);

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* ========================================================================= */}
      {/* TOP SLEEK CBS HEADER BANNER (Matching SavingOpeningBalance.tsx)          */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TOP SLEEK CBS HEADER BANNER WITH COMPACT KPI BAR                          */}
      {/* ========================================================================= */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-2.5 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs shrink-0">
            <Landmark size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xs sm:text-sm font-bold text-gray-900 tracking-tight">
                कर्ज अर्ज नोंदणी व मंजुरी
              </h1>
              <span className="text-[10px] font-semibold text-primary font-mono hidden md:inline">(Loan Application Master)</span>
              {isEditing && (
                <span className="bg-amber-100 text-amber-900 text-[9.5px] font-black px-2 py-0.2 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन (#{formData.applicationNo || formData.loanApplicationID})
                </span>
              )}
            </div>
            {/* Ultra-compact inline KPI metrics strip */}
            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium mt-0.5 flex-wrap">
              <span>एकूण अर्ज: <b className="text-gray-800">{applications.length}</b></span>
              <span className="text-gray-300">|</span>
              <span>मागणी रक्कम: <b className="text-emerald-700 font-mono">₹{totalRequestedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</b></span>
              <span className="text-gray-300">|</span>
              <span>सरासरी व्याज: <b className="text-indigo-900 font-mono">{avgRate}%</b></span>
              <span className="text-gray-300">|</span>
              <span>योजना: <b className="text-amber-800">{activeSchemesCount}</b></span>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1.5">
          {isEditing && (
            <button
              type="button"
              onClick={handleResetForm}
              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3 h-3" />
              <span>रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetForm}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन फॉर्म रिकामा करा"
          >
            <Plus className="w-3 h-3" />
            <span>नवीन नोंद</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchData();
              setShowListModal(true);
            }}
            className="px-2.5 py-1 bg-primary hover:opacity-90 text-white rounded-sm text-[10.5px] font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
            title="सर्व नोंदवलेले कर्ज अर्ज यादी पहा"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>अर्ज यादी ({applications.length})</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-2 p-1.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-1.5 text-[11px] font-bold shadow-2xs animate-in fade-in duration-150">
          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-2 p-1.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-1.5 text-[11px] font-bold shadow-2xs animate-in fade-in duration-150">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE: COMPACT 2-COLUMN SIDE-BY-SIDE CBS GRID                   */}
      {/* ========================================================================= */}
      <div 
        ref={formContainerRef}
        className={`w-full bg-white p-2.5 sm:p-3 rounded-sm shadow-xs border transition-all duration-300 ${
          isEditing ? 'border-primary ring-2 ring-primary/20 bg-blue-50/15' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-start">
            
            {/* =================================================================== */}
            {/* LEFT COLUMN: अर्जदार व कर्ज तपशील                                    */}
            {/* =================================================================== */}
            <div className="space-y-2.5">
              
              {/* Card 1: अर्जदार व सह-कर्जदार माहिती */}
              <div className="bg-white p-2.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2 shadow-2xs">
                <div className="flex items-center justify-between border-b border-gray-200 pb-1 h-[24px]">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <h2 className="text-xs font-bold text-primary">१. अर्जदार व सह-कर्जदार (Applicant Details)</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCoBorrowers(p => !p)}
                    className={`text-[10px] px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer border ${
                      showCoBorrowers || Boolean(formData.coCustomerID || formData.coCustomer2ID)
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-300'
                    }`}
                    title="सह-कर्जदार जोडा किंवा बदला"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>{showCoBorrowers || Boolean(formData.coCustomerID || formData.coCustomer2ID) ? 'सह-कर्जदार बंद' : '+ सह-कर्जदार'}</span>
                  </button>
                </div>

                {/* Row 1: App No & App Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>
                      अर्ज क्र. (App No) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="applicationNo"
                      value={formData.applicationNo || ''}
                      readOnly
                      className={`${inputClass} bg-slate-100 font-mono font-bold text-primary`}
                      placeholder="AUTO"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      अर्ज दिनांक (Date) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="applicationDate"
                      value={formData.applicationDate ? formData.applicationDate.split('T')[0] : ''}
                      onChange={handleInputChange}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Applicant Customer Select (Full Width) */}
                <div>
                  <label className={labelClass}>
                    अर्जदार खातेदार निवडा (Select Applicant Customer) <span className="text-red-500">*</span>
                  </label>
                  <div className={isEditing ? 'opacity-90' : ''}>
                    <CustomerSearchSelect
                      customers={members}
                      value={formData.customerID ? Number(formData.customerID) : ''}
                      onChange={(val) => {
                        setFormData(p => ({
                          ...p,
                          customerID: val ? Number(val) : 0
                        }));
                      }}
                      placeholder="-- अर्जदार CIF / नाव / मोबाईलने शोधा --"
                    />
                  </div>
                </div>

                {/* Ultra-Compact Selected Customer Profile Banner */}
                {selectedMember && (
                  <div className="p-1.5 bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/80 border border-primary/25 rounded shadow-2xs flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                        <User className="w-3 h-3" />
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-gray-900 mr-1.5">
                          {selectedMember.firstName} {selectedMember.middleName ? selectedMember.middleName + ' ' : ''}{selectedMember.lastName}
                        </span>
                        <span className="px-1.5 py-0.2 bg-primary/10 text-primary border border-primary/20 font-mono text-[9.5px] rounded font-bold mr-1.5">
                          CIF: {selectedMember.cifNo || (selectedMember as any).cif || '-'}
                        </span>
                        <span className="text-gray-500 font-mono text-[10px]">
                          📞 {selectedMember.mobileNo || (selectedMember as any).mobile || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[9.5px]">
                      <span className="text-gray-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                        📍 {(selectedMember as any).village || (selectedMember as any).address || '-'}
                      </span>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>केवायसी पडताळणी पूर्ण</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Co-Borrowers Compact Drawer */}
                {(showCoBorrowers || Boolean(formData.coCustomerID || formData.coCustomer2ID)) && (
                  <div className="p-2 bg-slate-50 rounded border border-primary/20 space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-primary flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> सह-कर्जदार (Co-Borrowers)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(p => ({ ...p, coCustomerID: 0, coCustomer2ID: 0 }));
                          setShowCoBorrowers(false);
                        }}
                        className="text-[9.5px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                      >
                        ✕ सह-कर्जदार काढा (Remove)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className={labelClass}>सह-कर्जदार १</label>
                        <CustomerSearchSelect
                          customers={members.filter((m: any) => {
                            const mCustId = m.customerID || m.id;
                            return formData.customerID ? mCustId !== formData.customerID : true;
                          })}
                          value={formData.coCustomerID ? Number(formData.coCustomerID) : ''}
                          onChange={(val) => setFormData(p => ({ ...p, coCustomerID: val ? Number(val) : 0 }))}
                          placeholder="-- सह-कर्जदार १ निवडा --"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>सह-कर्जदार २</label>
                        <CustomerSearchSelect
                          customers={members.filter((m: any) => {
                            const mCustId = m.customerID || m.id;
                            return (formData.customerID ? mCustId !== formData.customerID : true) &&
                                   (formData.coCustomerID ? mCustId !== formData.coCustomerID : true);
                          })}
                          value={formData.coCustomer2ID ? Number(formData.coCustomer2ID) : ''}
                          onChange={(val) => setFormData(p => ({ ...p, coCustomer2ID: val ? Number(val) : 0 }))}
                          placeholder="-- सह-कर्जदार २ निवडा --"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: कर्ज माहिती व परतफेड नियम */}
              <div className="bg-white p-2.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2 shadow-2xs">
                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 h-[24px]">
                  <Percent className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-bold text-primary">२. कर्ज माहिती व परतफेड नियम (Loan Terms & Rates)</h2>
                </div>

                {/* Row 1: Scheme, Requested Amount, Interest Rate */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <label className={labelClass}>
                      कर्ज योजना (Scheme) <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="loanRateID"
                      value={formData.loanRateID || ''}
                      onChange={(e) => handleLoanRateChange(parseInt(e.target.value, 10))}
                      className={inputClass}
                      required
                    >
                      <option value="">-- कर्ज योजना निवडा --</option>
                      {loanRates.filter(r => r.isActive).map(r => (
                        <option key={r.loanRateID} value={r.loanRateID}>
                          {r.shortName || r.loanType} ({r.interestRate}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-6 sm:col-span-4">
                    <label className={labelClass}>
                      मागणी रक्कम (Requested ₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={requestedAmountInputRef}
                      type="number"
                      name="requestedAmount"
                      value={formData.requestedAmount || ''}
                      onChange={handleInputChange}
                      onFocus={(e) => e.target.select()}
                      className={`${inputClass} font-bold text-emerald-700 font-mono`}
                      min="1"
                      required
                      placeholder="0.00"
                    />
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label className={labelClass}>
                      व्याज दर (% p.a.) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="interestRate"
                      value={formData.interestRate || ''}
                      onChange={handleInputChange}
                      className={`${inputClass} font-bold text-indigo-900 font-mono`}
                      required
                    />
                  </div>
                </div>

                {/* Row 2: Frequency, Duration, No of Inst, Inst Amount */}
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6 sm:col-span-3">
                    <label className={labelClass}>
                      हप्ता प्रकार <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="installmentFrequency"
                      value={formData.installmentFrequency}
                      onChange={handleInputChange}
                      className={inputClass}
                    >
                      {InstallmentFrequencies.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-6 sm:col-span-3">
                    <label className={labelClass}>
                      मुदत महिने <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="durationMonths"
                      value={formData.durationMonths || ''}
                      onChange={handleInputChange}
                      className={`${inputClass} font-mono`}
                      min="1"
                      required
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <label className={labelClass}>
                      हप्ते संख्या <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="noOfInstallments"
                      value={formData.noOfInstallments || ''}
                      onChange={handleInputChange}
                      className={`${inputClass} font-mono`}
                      min="1"
                      required
                    />
                  </div>

                  <div className="col-span-8 sm:col-span-4">
                    <div className="flex justify-between items-center mb-1 h-[15px]">
                      <label className={labelClass}>
                        हप्ता रक्कम (Inst ₹) <span className="text-red-500">*</span>
                      </label>
                      {isInstAmountEdited && (
                        <button
                          type="button"
                          onClick={handleResetInstAmount}
                          title="ऑटो हप्ता रिसेट करा"
                          className="text-[9.5px] text-primary hover:underline font-bold"
                        >
                          🔄 रिसेट
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        name="installmentAmount"
                        value={formData.installmentAmount || ''}
                        onChange={handleInputChange}
                        className={`${inputClass} font-bold font-mono ${
                          isInstAmountEdited ? 'text-purple-800 bg-purple-50/50 border-purple-300' : 'text-emerald-700'
                        }`}
                        required
                      />
                      <button
                        type="button"
                        onClick={calculateSchedule}
                        title="हप्ता वेळापत्रक पत्रक पहा (View Schedule)"
                        className="bg-primary hover:opacity-90 text-white px-2 py-0.5 rounded-sm text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors shadow-2xs flex items-center gap-1 shrink-0 h-[30px]"
                      >
                        <span>📊 पत्रक</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 3: Due Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>पहिले हप्ता दि. (First Due)</label>
                    <input
                      type="date"
                      name="firstInstallmentDate"
                      value={formData.firstInstallmentDate ? formData.firstInstallmentDate.split('T')[0] : ''}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>परतफेड दि. (Maturity)</label>
                    <input
                      type="date"
                      name="maturityDate"
                      value={formData.maturityDate ? formData.maturityDate.split('T')[0] : ''}
                      onChange={handleInputChange}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* =================================================================== */}
            {/* RIGHT COLUMN: जामीनदार, तारण व शिफारस                               */}
            {/* =================================================================== */}
            <div className="space-y-2.5">
              
              {/* Card 3: जामीनदार तपशील */}
              <div className="bg-white p-2.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2 shadow-2xs">
                <div className="flex items-center justify-between border-b border-gray-200 pb-1 h-[24px]">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <h2 className="text-xs font-bold text-primary">३. जामीनदार तपशील (Guarantor Details)</h2>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium italic">
                    (किमान १ जामीनदार आवश्यक)
                  </span>
                </div>

                {/* Row 1: Guarantor 1 (Full Width) */}
                <div>
                  <label className={labelClass}>
                    जामीनदार १ (Guarantor 1) <span className="text-red-500">*</span>
                  </label>
                  <CustomerSearchSelect
                    customers={members.filter((m: any) => {
                      const mCustId = m.customerID || m.id;
                      return formData.customerID ? mCustId !== formData.customerID : true;
                    })}
                    value={formData.guarantor1CustomerID ? Number(formData.guarantor1CustomerID) : ''}
                    onChange={(val) => {
                      setFormData(p => ({
                        ...p,
                        guarantor1CustomerID: val ? Number(val) : 0
                      }));
                    }}
                    placeholder="-- जामीनदार १ शोधा (CIF / नाव / मोबाईल) --"
                  />
                  {guarantor1Summary && (
                    <div className="mt-1 p-1 bg-amber-50 border border-amber-300 rounded text-[9.5px] text-amber-900 flex justify-between items-center shadow-2xs">
                      <span>🛡️ <b>{guarantor1Summary.activeGuaranteedLoansCount}</b> चालू जामीन | बाकी: ₹{(guarantor1Summary.totalCurrentBalance || 0).toLocaleString('en-IN')}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGuarantorForModal(guarantor1Summary)}
                        className="px-1.5 py-0.2 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded text-[9px] font-bold cursor-pointer"
                      >
                        तपशील
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 2: Guarantor 2 (Full Width) */}
                <div>
                  <label className={labelClass}>
                    जामीनदार २ (Guarantor 2)
                  </label>
                  <CustomerSearchSelect
                    customers={members.filter((m: any) => {
                      const mCustId = m.customerID || m.id;
                      return (formData.customerID ? mCustId !== formData.customerID : true) &&
                             (formData.guarantor1CustomerID ? mCustId !== formData.guarantor1CustomerID : true);
                    })}
                    value={formData.guarantor2CustomerID ? Number(formData.guarantor2CustomerID) : ''}
                    onChange={(val) => {
                      setFormData(p => ({
                        ...p,
                        guarantor2CustomerID: val ? Number(val) : 0
                      }));
                    }}
                    placeholder="-- जामीनदार २ शोधा (CIF / नाव / मोबाईल) --"
                  />
                  {guarantor2Summary && (
                    <div className="mt-1 p-1 bg-amber-50 border border-amber-300 rounded text-[9.5px] text-amber-900 flex justify-between items-center shadow-2xs">
                      <span>🛡️ <b>{guarantor2Summary.activeGuaranteedLoansCount}</b> चालू जामीन | बाकी: ₹{(guarantor2Summary.totalCurrentBalance || 0).toLocaleString('en-IN')}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGuarantorForModal(guarantor2Summary)}
                        className="px-1.5 py-0.2 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded text-[9px] font-bold cursor-pointer"
                      >
                        तपशील
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 4: तारण, शिफारस व कारण */}
              <div className="bg-white p-2.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2 shadow-2xs">
                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 h-[24px]">
                  <Landmark className="w-3.5 h-3.5 text-primary" />
                  <h2 className="text-xs font-bold text-primary">४. तारण, शिफारस व कारण (Security & Details)</h2>
                </div>

                {/* Row 1: Security Details & Security Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1 h-[15px]">
                      <label className={labelClass}>तारण प्रकार (Security Details)</label>
                    </div>
                    <SearchableSelect
                      options={secOptions}
                      value={formData.securityDetails || ''}
                      onChange={(e: any) => setFormData(p => ({ ...p, securityDetails: e.target.value }))}
                      placeholder="-- तारण प्रकार निवडा --"
                      className={`${inputClass} flex justify-between items-center text-left cursor-pointer`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1 h-[15px]">
                      <label className={labelClass}>तारण मूल्य (Security ₹)</label>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const curRate = loanRates.find(r => r.loanRateID === formData.loanRateID);
                          const isDepScheme = curRate && ['FixedDeposit', 'PigmyDeposit', 'RecurringDeposit', 'SavingDeposit'].includes(curRate.collateralCategory || '');
                          if (!isDepScheme) return null;
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (!formData.customerID) {
                                  alert('कृपया आधी मुख्य कर्जदार ग्राहक (Customer) निवडा.');
                                  return;
                                }
                                setShowDepositModal(true);
                              }}
                              className="text-[9.5px] text-emerald-950 font-bold hover:underline flex items-center gap-0.5 cursor-pointer bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-400 shadow-2xs"
                            >
                              <ShieldCheck className="w-3 h-3 text-emerald-700" />
                              <span>
                                {curRate?.collateralCategory === 'FixedDeposit' 
                                  ? 'FD ठेव' 
                                  : curRate?.collateralCategory === 'PigmyDeposit' 
                                    ? 'पिग्मी' 
                                    : curRate?.collateralCategory === 'RecurringDeposit'
                                      ? 'RD ठेव'
                                      : 'बचत ठेव'}
                              </span>
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => setShowGoldModal(true)}
                          className="text-[9.5px] text-amber-900 font-bold hover:underline flex items-center gap-0.5 cursor-pointer bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-300"
                        >
                          <Sparkles className="w-3 h-3 text-amber-700" />
                          <span>सुवर्ण</span>
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      name="securityValue"
                      value={formData.securityValue || ''}
                      onChange={handleInputChange}
                      className={`${inputClass} font-mono font-bold text-amber-900`}
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Row 2: Director Recommendation */}
                <div>
                  <label className={labelClass}>संचालक शिफारस (Director Recommendation)</label>
                  <CustomerSearchSelect
                    customers={members}
                    value={formData.recommendedByDirectorID ? Number(formData.recommendedByDirectorID) : ''}
                    onChange={(val) => setFormData(p => ({ ...p, recommendedByDirectorID: val ? Number(val) : 0 }))}
                    placeholder="-- संचालक शिफारस खातेदार निवडा --"
                  />
                  {directorSummary && (
                    <div className="mt-1 p-1 bg-purple-50/70 border border-purple-200 rounded text-[9.5px] text-purple-900 flex justify-between items-center shadow-2xs">
                      <div>
                        <span>👔 <b>{directorSummary.activeRecommendedLoansCount}</b> चालू शिफारस कर्जे | <b>{directorSummary.pendingRecommendedAppsCount}</b> अर्ज</span>
                        <span className="ml-2 font-mono text-purple-950 font-bold">बाकी: ₹{(directorSummary.totalRecommendedCurrentBalance || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDirectorForModal(directorSummary)}
                        className="px-1.5 py-0.2 bg-purple-200 hover:bg-purple-300 text-purple-950 rounded text-[9px] font-bold cursor-pointer"
                      >
                        तपशील
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 3: Loan Purpose */}
                <div>
                  <label className={labelClass}>कर्जाचे कारण (Loan Purpose)</label>
                  <input
                    type="text"
                    name="purpose"
                    value={formData.purpose || ''}
                    onChange={handleInputChange}
                    className={inputClass}
                    placeholder="उदा. शेती / व्यवसाय / घर दुरुस्ती"
                  />
                </div>
              </div>

            </div>

          </div>

          {/* Form Action Buttons Bar (Full Width) */}
          <div className="pt-2 flex flex-wrap justify-between items-center gap-2 border-t border-gray-200 bg-slate-50/70 -mx-2.5 sm:-mx-3 -mb-2.5 sm:-mb-3 p-2 rounded-b-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  fetchData();
                  setShowListModal(true);
                }}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
              >
                <Layers className="w-3.5 h-3.5 text-slate-600" />
                <span>कर्ज अर्ज यादी ({applications.length})</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  calculateSchedule();
                  setShowSchedule(true);
                }}
                className="px-3 py-1.5 font-bold rounded-sm text-xs border cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all bg-white hover:bg-slate-100 text-primary border-primary/30"
                title="हप्ता वेळापत्रक पत्रक उघडा (View Live Schedule)"
              >
                <Calculator className="w-3.5 h-3.5 text-primary" />
                <span>📊 वेळापत्रक पत्रक</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                <span>{isEditing ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
              </button>

              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-1.5 ${
                  isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
                } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
              >
                <Save className="w-4 h-4" />
                <span>
                  {loading
                    ? 'जतन होत आहे...'
                    : isEditing
                    ? 'बदल सेव्ह करा (Update)'
                    : onNext
                    ? 'कर्ज अर्ज सेव्ह करा व पुढे जा (Save & Proceed)'
                    : 'कर्ज अर्ज सेव्ह करा (Save Application)'}
                </span>
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* ULTRA-REFINED NAJUK GLASSMORPHISM POPUP MODAL: LIVE INSTALLMENT SCHEDULE */}
      {/* ========================================================================= */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-3 animate-in fade-in duration-150">
          {/* Frosted Glass Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity cursor-pointer" 
            onClick={() => setShowSchedule(false)} 
          />
          
          {/* Compact Delicate Modal Box */}
          <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-xl ring-1 ring-black/5 flex flex-col z-10 animate-in zoom-in-95 duration-150 overflow-hidden max-h-[88vh]">
            
            {/* 1. Delicate Header (Slim & Crisp) */}
            <div className="px-3.5 py-2 bg-gradient-to-r from-emerald-800 via-primary to-teal-800 text-white flex items-center justify-between shadow-2xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-white shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-white tracking-wide truncate">
                      हप्ता वेळापत्रक पत्रक (Live Schedule)
                    </h3>
                    {formData.applicationNumber && (
                      <span className="text-[9.5px] font-mono bg-white/20 px-1.5 py-0.2 rounded text-emerald-100 shrink-0">
                        {formData.applicationNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-emerald-100/90 truncate">
                    {(() => {
                      const applicant = members.find((m: any) => (m.customerID || m.id) === formData.customerID);
                      const rate = loanRates.find(r => r.loanRateID === formData.loanRateID);
                      const name = applicant ? (applicant.fullName || applicant.name) : '';
                      return name ? `${name} ${rate?.loanType ? `• ${rate.loanType}` : ''}` : (rate?.loanType || 'थेट कर्ज हप्ता व व्याज पत्रक');
                    })()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {scheduleData.length > 0 && (
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                    {scheduleData.length} हप्ते
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowSchedule(false)}
                  className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
                  title="बंद करा (Close)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* 2. Delicate Micro Metrics Strip (Super Compact, No Big Cards!) */}
            <div className="px-3.5 pt-2 pb-1.5 bg-slate-50/70 border-b border-slate-200 shrink-0 space-y-1.5">
              {/* Row 1: 4 Inline Micro-Metrics */}
              <div className="grid grid-cols-4 gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200/90 shadow-2xs text-[11px]">
                {/* Metric 1 */}
                <div className="px-1.5 py-0.5 border-r border-slate-100">
                  <span className="text-[9.5px] text-slate-400 block leading-tight">मागणी रक्कम</span>
                  <span className="font-bold text-slate-800 font-mono text-[11.5px] leading-tight">
                    ₹{(formData.requestedAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                {/* Metric 2 */}
                <div className="px-1.5 py-0.5 border-r border-slate-100">
                  <span className="text-[9.5px] text-emerald-600 block leading-tight">हप्ता (EMI)</span>
                  <span className="font-bold text-emerald-700 font-mono text-[11.5px] leading-tight">
                    ₹{(formData.installmentAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                {/* Metric 3 */}
                <div className="px-1.5 py-0.5 border-r border-slate-100">
                  <span className="text-[9.5px] text-rose-500 block leading-tight">एकूण व्याज ({formData.interestRate || 0}%)</span>
                  <span className="font-bold text-rose-700 font-mono text-[11.5px] leading-tight">
                    ₹{scheduleData.reduce((acc, r) => acc + Math.round(r.interest || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>
                {/* Metric 4 */}
                <div className="px-1.5 py-0.5">
                  <span className="text-[9.5px] text-indigo-500 block leading-tight">एकूण परतफेड</span>
                  <span className="font-bold text-indigo-900 font-mono text-[11.5px] leading-tight">
                    ₹{scheduleData.reduce((acc, r) => acc + Math.round(r.total || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Row 2: Slim Info Ribbon */}
              {(() => {
                const currentRate = loanRates.find(r => r.loanRateID === formData.loanRateID);
                const isFlat = currentRate?.interestCalculationMethod?.includes('Flat') || currentRate?.interestCalculationMethod?.includes('फ्लॅट');
                const isDeclining = currentRate?.interestCalculationMethod?.includes('Reducing') && 
                  (currentRate?.loanInstallmentType === 'समान मुद्दल' || currentRate?.loanInstallmentType === 'कर्जावरती' || currentRate?.loanInstallmentType?.includes('मुद्दल') || currentRate?.loanInstallmentType?.includes('कर्जावर'));
                
                return (
                  <div className="px-2 py-0.5 rounded bg-emerald-50/60 border border-emerald-200/60 text-[10px] text-slate-600 flex items-center justify-between">
                    <span>
                      व्याज पद्धत: <strong className="text-emerald-800 font-semibold">{currentRate?.interestCalculationMethod || 'Flat (फ्लॅट)'}</strong>
                    </span>
                    <span>
                      हप्ता प्रकार: <strong className={isFlat ? 'text-blue-700' : (isDeclining ? 'text-amber-800' : 'text-emerald-700')}>
                        {isFlat ? 'फ्लॅट हप्ता' : (isDeclining ? 'समान मुद्दल (घटणारा हप्ता)' : 'समान हप्ता (EMI)')}
                      </strong>
                    </span>
                    <span>
                      मुदत: <strong className="text-slate-800">{formData.durationMonths || 12} महिने ({formData.noOfInstallments || 0} हप्ते)</strong>
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* 3. Delicate Schedule Table Frame */}
            <div className="p-2 sm:p-2.5 flex-1 flex flex-col overflow-hidden min-h-[260px]">
              {scheduleData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
                  <Calculator className="w-8 h-8 text-gray-300 mb-1 stroke-[1.5]" />
                  <p className="text-[11px] font-semibold text-gray-600">हप्ता पत्रक तयार करण्यासाठी कर्ज रक्कम व माहिती भरा.</p>
                  <button
                    type="button"
                    onClick={calculateSchedule}
                    className="mt-2 px-3 py-1 bg-primary text-white rounded text-[11px] font-bold shadow-2xs hover:opacity-90 cursor-pointer"
                  >
                    📊 वेळापत्रक लोड करा
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-auto rounded border border-slate-200 shadow-2xs bg-white">
                  <table className="w-full text-left border-collapse text-[10.5px]">
                    <thead className="bg-slate-100 sticky top-0 shadow-2xs text-slate-700 font-bold border-b border-slate-300 z-10">
                      <tr>
                        <th className="py-1 px-1.5 border-r border-slate-200 text-center w-9">क्र.</th>
                        <th className="py-1 px-2 border-r border-slate-200 text-center w-24">हप्ता दिनांक</th>
                        <th className="py-1 px-2 border-r border-slate-200 text-right">मुद्दल (₹)</th>
                        <th className="py-1 px-2 border-r border-slate-200 text-right">व्याज (₹)</th>
                        <th className="py-1 px-2 border-r border-slate-200 text-right">एकूण हप्ता (₹)</th>
                        <th className="py-1 px-2 text-right">बाकी शिल्लक (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[10px] text-slate-700">
                      {scheduleData.map((row, i) => (
                        <tr key={i} className="hover:bg-emerald-50/50 transition-colors">
                          <td className="py-0.5 px-1.5 border-r border-slate-100 text-center font-bold text-slate-500 bg-slate-50/40">{row.instNo}</td>
                          <td className="py-0.5 px-2 border-r border-slate-100 text-center text-slate-600 font-sans">
                            {row.dueDate || '-'}
                          </td>
                          <td className="py-0.5 px-2 border-r border-slate-100 text-right text-slate-800">
                            {Math.round(row.principal || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-0.5 px-2 border-r border-slate-100 text-right text-rose-600">
                            {Math.round(row.interest || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-0.5 px-2 border-r border-slate-100 text-right font-bold text-emerald-700 bg-emerald-50/20">
                            {Math.round(row.total || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-0.5 px-2 text-right text-slate-600">
                            {Math.round(row.balance || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t-2 border-slate-300 sticky bottom-0 z-20 shadow-xs text-[10.5px]">
                      <tr>
                        <td colSpan={2} className="py-1 px-2 text-center font-sans text-[10.5px]">एकूण (Total):</td>
                        <td className="py-1 px-2 text-right text-slate-900 border-r border-slate-200">
                          ₹{scheduleData.reduce((acc, r) => acc + Math.round(r.principal || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-1 px-2 text-right text-rose-700 border-r border-slate-200">
                          ₹{scheduleData.reduce((acc, r) => acc + Math.round(r.interest || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-1 px-2 text-right text-emerald-800 border-r border-slate-200">
                          ₹{scheduleData.reduce((acc, r) => acc + Math.round(r.total || 0), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-1 px-2 text-right text-slate-400 font-sans">-</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* 4. Delicate Footer Action Bar */}
            <div className="px-3.5 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportScheduleExcel}
                  disabled={scheduleData.length === 0}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-800 font-bold rounded text-[11px] border border-emerald-300 shadow-2xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="एक्सेल फाइल डाउनलोड करा"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>एक्सेल (Excel)</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintSchedule}
                  disabled={scheduleData.length === 0}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded text-[11px] border border-slate-300 shadow-2xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                  title="हप्ता वेळापत्रक प्रिंट करा"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>प्रिंट (Print)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSchedule(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-[11px] shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>बंद करा (Close)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL 1: LOAN APPLICATIONS LIST                                   */}
      {/* ========================================================================= */}
      {showListModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-white" />
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>नोंदवलेले कर्ज अर्ज यादी (Loan Applications List)</span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                    {filteredApps.length} अर्ज
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
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input 
                  type="text" 
                  placeholder="अर्ज क्र., खातेदार नाव किंवा CIF शोधा..." 
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
                disabled={filteredApps.length === 0}
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">अर्ज क्र.</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">अर्जदार खातेदार नाव व CIF</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">कर्ज योजना</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">मागणी रक्कम</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याजदर (%)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center">अर्ज दिनांक</th>
                      <th className="px-2 py-1.5 text-center w-20">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {filteredApps.map((app) => (
                      <tr key={app.loanApplicationID} className="hover:bg-primary/5 transition-colors">
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => {
                                handleEdit(app);
                                setShowListModal(false);
                              }} 
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="अर्ज फॉर्ममध्ये लोड करा (Edit Application)"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>सुधारा</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setPrintApplication(app)} 
                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer shadow-2xs"
                              title="कर्ज मागणी अर्ज प्रिंट करा (Print Loan Application)"
                            >
                              <Printer className="w-3 h-3 text-blue-600" />
                              <span>प्रिंट</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleDelete(app.loanApplicationID)} 
                              className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="अर्ज डिलीट करा (Delete)"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>बाद</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-mono font-bold text-primary">
                          {app.applicationNo}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left">
                          <div className="font-bold text-gray-900">
                            {app.customer ? `${app.customer.firstName || ''} ${app.customer.lastName || ''}`.trim() : '-'}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {app.customer?.cifNo ? `CIF: ${app.customer.cifNo}` : ''} {(app.customer as any)?.mobileNo ? `| मो.: ${(app.customer as any).mobileNo}` : ''}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium text-gray-800">
                          {app.loanRate?.shortName || app.loanRate?.loanType || app.loanType || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                          ₹{(app.requestedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono">
                          {app.interestRate || 0}%
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono text-gray-600">
                          {app.applicationDate ? new Date(app.applicationDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            नोंदणीकृत
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredApps.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-gray-400 font-bold">
                          कोणताही कर्ज अर्ज सापडला नाही.
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
                टीप: 'सुधारा' वर क्लिक केल्यास अर्ज थेट मुख्य फॉर्ममध्ये संपादन करण्यासाठी लोड होईल.
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

      {/* ========================================================================= */}
      {/* POP-UP MODAL 2: GUARANTOR PROFILE & SUMMARY                               */}
      {/* ========================================================================= */}
      {selectedGuarantorForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>जामीनदाराचे सविस्तर तपशील (Guarantor Profile & Summary)</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedGuarantorForModal(null)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 text-xs max-h-[75vh] overflow-y-auto space-y-3 bg-slate-50/50 flex-1">
              {/* Profile Card */}
              <div className="bg-white border border-slate-300 rounded-sm p-3 shadow-xs">
                <div className="text-xs font-bold text-primary border-b pb-1 mb-2 flex justify-between items-center">
                  <span>👤 जामीनदाराची वैयक्तिक व वित्तीय माहिती</span>
                  <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {selectedGuarantorForModal.cifNo ? `CIF: ${selectedGuarantorForModal.cifNo}` : `Code: ${selectedGuarantorForModal.memberCode}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-500 block">नाव:</span>
                    <span className="font-bold text-gray-900">{selectedGuarantorForModal.memberName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">सभासद कोड:</span>
                    <span className="font-semibold text-gray-700 font-mono">{selectedGuarantorForModal.memberCode || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">मोबाईल नं:</span>
                    <span className="font-semibold text-gray-700 font-mono">{selectedGuarantorForModal.mobileNo || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">व्यवसाय:</span>
                    <span className="font-semibold text-gray-700">{selectedGuarantorForModal.occupation || '-'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-500 block">पत्ता / गाव:</span>
                    <span className="font-semibold text-gray-700">{selectedGuarantorForModal.address || selectedGuarantorForModal.village || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">भाग भांडवल (Shares):</span>
                    <span className="font-bold text-emerald-700 font-mono">₹{(selectedGuarantorForModal.sharesBalance || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">बचत जमा (Savings):</span>
                    <span className="font-bold text-blue-700 font-mono">₹{(selectedGuarantorForModal.savingsBalance || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-amber-50 p-2.5 rounded-sm border border-amber-200 text-center">
                <div>
                  <div className="text-gray-600 text-[10px] font-bold">स्वतःचे कर्ज / बाकी</div>
                  <div className="font-black text-indigo-950 text-xs font-mono">₹{(selectedGuarantorForModal.ownTotalBalance || 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-gray-600 text-[10px] font-bold">चालू जामीन कर्जे</div>
                  <div className="font-black text-blue-900 text-xs">{selectedGuarantorForModal.activeGuaranteedLoansCount} खाते</div>
                </div>
                <div>
                  <div className="text-gray-600 text-[10px] font-bold">प्रलंबित जामीन अर्ज</div>
                  <div className="font-black text-amber-800 text-xs">{selectedGuarantorForModal.pendingGuaranteedAppsCount} अर्ज</div>
                </div>
                <div>
                  <div className="text-gray-600 text-[10px] font-bold">जामीन कर्ज बाकी</div>
                  <div className="font-black text-rose-800 text-xs font-mono">₹{(selectedGuarantorForModal.totalCurrentBalance || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Own Loans */}
              {((selectedGuarantorForModal.ownLoans && selectedGuarantorForModal.ownLoans.length > 0) || (selectedGuarantorForModal.ownApplications && selectedGuarantorForModal.ownApplications.length > 0)) && (
                <div className="border border-indigo-200 bg-indigo-50/40 p-2.5 rounded-sm">
                  <h4 className="font-bold text-indigo-900 mb-1 border-b border-indigo-200 pb-1 text-[11px]">
                    १. जामीनदाराची स्वतःची / सह-कर्जदार कर्ज खाती (Own Loans)
                  </h4>
                  {selectedGuarantorForModal.ownLoans && selectedGuarantorForModal.ownLoans.length > 0 && (
                    <table className="w-full border-collapse border border-indigo-200 mb-2 text-[10px] bg-white">
                      <thead>
                        <tr className="bg-indigo-100 font-bold text-indigo-900">
                          <th className="border p-1 text-left">खाते क्र.</th>
                          <th className="border p-1 text-left">कर्जदार</th>
                          <th className="border p-1 text-left">प्रकार</th>
                          <th className="border p-1 text-right">मंजूर रक्कम</th>
                          <th className="border p-1 text-right">सध्याची बाकी</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {selectedGuarantorForModal.ownLoans.map((item, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/50">
                            <td className="border p-1 font-bold text-primary">{item.loanAccountNo}</td>
                            <td className="border p-1 font-semibold text-gray-800 font-sans">{item.borrowerName}</td>
                            <td className="border p-1 font-sans">{item.loanType}</td>
                            <td className="border p-1 text-right">₹{(item.sanctionedAmount || 0).toLocaleString('en-IN')}</td>
                            <td className="border p-1 text-right font-bold text-rose-700">₹{(item.currentBalance || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Guaranteed Loans */}
              <div>
                <h4 className="font-bold text-gray-800 mb-1 border-b pb-1 text-[11px]">२. जामीन राहिलेली चालू कर्ज खाती (Active Guaranteed Loans)</h4>
                {selectedGuarantorForModal.guaranteedLoans.length === 0 ? (
                  <p className="text-gray-400 italic mb-2 text-[11px]">कोणतेही चालू जामीन कर्ज खाते नाही.</p>
                ) : (
                  <table className="w-full border-collapse border border-gray-300 mb-2 text-[10px] bg-white">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-gray-700">
                        <th className="border p-1 text-left">खाते क्र.</th>
                        <th className="border p-1 text-left">मुख्य कर्जदार</th>
                        <th className="border p-1 text-left">प्रकार</th>
                        <th className="border p-1 text-right">मंजूर रक्कम</th>
                        <th className="border p-1 text-right">सध्याची बाकी</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {selectedGuarantorForModal.guaranteedLoans.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="border p-1 font-bold text-primary">{item.loanAccountNo}</td>
                          <td className="border p-1 font-semibold text-gray-800 font-sans">{item.borrowerName}</td>
                          <td className="border p-1 font-sans">{item.loanType}</td>
                          <td className="border p-1 text-right">₹{(item.sanctionedAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="border p-1 text-right font-bold text-rose-700">₹{(item.currentBalance || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedGuarantorForModal(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-1 rounded-sm text-xs font-bold cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL 3: DIRECTOR RECOMMENDATION SUMMARY                           */}
      {/* ========================================================================= */}
      {selectedDirectorForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-purple-900 text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-purple-800">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-white" />
                <span>👔 संचालक शिफारस सविस्तर तपशील (Director Recommendation Summary)</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDirectorForModal(null)}
                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 text-xs max-h-[75vh] overflow-y-auto space-y-3 bg-slate-50/50 flex-1">
              <div className="bg-purple-50/50 border border-purple-200 rounded-sm p-3 shadow-xs">
                <div className="text-xs font-bold text-purple-900 border-b border-purple-200 pb-1 mb-2 flex justify-between items-center">
                  <span>👤 संचालक वैयक्तिक माहिती</span>
                  <span className="bg-purple-200 text-purple-950 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                    {selectedDirectorForModal.cifNo || `Code: ${selectedDirectorForModal.directorCode}`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-500 block">संचालकाचे नाव:</span>
                    <span className="font-bold text-purple-950">{selectedDirectorForModal.directorName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">सभासद कोड:</span>
                    <span className="font-semibold text-gray-700 font-mono">{selectedDirectorForModal.directorCode || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">मोबाईल नं:</span>
                    <span className="font-semibold text-gray-700 font-mono">{selectedDirectorForModal.mobileNo || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 bg-purple-100/60 p-2.5 rounded-sm border border-purple-200 text-center">
                <div>
                  <div className="text-gray-700 text-[10px] font-bold">चालू शिफारस कर्जे</div>
                  <div className="font-black text-purple-950 text-sm">{selectedDirectorForModal.activeRecommendedLoansCount} खाते</div>
                </div>
                <div>
                  <div className="text-gray-700 text-[10px] font-bold">प्रलंबित शिफारस अर्ज</div>
                  <div className="font-black text-amber-800 text-sm">{selectedDirectorForModal.pendingRecommendedAppsCount} अर्ज</div>
                </div>
                <div>
                  <div className="text-gray-700 text-[10px] font-bold">एकूण शिफारस बाकी</div>
                  <div className="font-black text-rose-800 text-sm font-mono">₹{(selectedDirectorForModal.totalRecommendedCurrentBalance || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-800 mb-1 border-b pb-1 text-[11px]">१. संचालकांनी शिफारस केलेली चालू कर्ज खाती (Active Recommended Loans)</h4>
                {selectedDirectorForModal.recommendedLoans.length === 0 ? (
                  <p className="text-gray-400 italic mb-2 text-[11px]">कोणतेही चालू शिफारस केलेले कर्ज खाते नाही.</p>
                ) : (
                  <table className="w-full border-collapse border border-gray-300 mb-2 text-[10px] bg-white">
                    <thead>
                      <tr className="bg-purple-50 font-bold text-purple-900">
                        <th className="border p-1 text-left">खाते क्र.</th>
                        <th className="border p-1 text-left">कर्जदार नाव</th>
                        <th className="border p-1 text-left">प्रकार</th>
                        <th className="border p-1 text-right">मंजूर रक्कम</th>
                        <th className="border p-1 text-right">सध्याची बाकी</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {selectedDirectorForModal.recommendedLoans.map((item, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/50">
                          <td className="border p-1 font-bold text-primary">{item.loanAccountNo}</td>
                          <td className="border p-1 font-semibold text-gray-800 font-sans">{item.borrowerName}</td>
                          <td className="border p-1 font-sans">{item.loanType}</td>
                          <td className="border p-1 text-right">₹{(item.sanctionedAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="border p-1 text-right font-bold text-rose-700">₹{(item.currentBalance || 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDirectorForModal(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-1 rounded-sm text-xs font-bold cursor-pointer"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL 4: GOLD LOAN COLLATERAL DETAILS CRUD MODAL                   */}
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
                    सोन्याचे जिन्नस, कॅरेट शुद्धता, निव्वळ वजन व मूल्यांकनाचा हिशोब जोडा
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGoldModal(false)}
                className="text-white/80 hover:text-white hover:bg-amber-800/60 w-7 h-7 flex items-center justify-center rounded-full transition-colors font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-3.5 space-y-3 overflow-y-auto bg-slate-50/50 flex-1">
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
                        setGoldForm({ itemName: 'सोन्याची साखळी (Chain)', purity: '22K (91.6%)', quantity: 1, grossWeight: '', netWeight: '', ratePerGram: 6000, remarks: '' });
                      }}
                      className="text-[10px] text-rose-700 font-bold hover:underline cursor-pointer"
                    >
                      रद्द करा (Reset Form)
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className={labelClass}>जिन्नस / दागिन्याचे नाव *</label>
                    <select
                      value={goldForm.itemName}
                      onChange={(e) => setGoldForm(prev => ({ ...prev, itemName: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="सोन्याची साखळी (Chain)">सोन्याची साखळी (Chain)</option>
                      <option value="सोन्याची अंगठी (Ring)">सोन्याची अंगठी (Ring)</option>
                      <option value="सोन्याचे पाटल्या / बांगड्या (Bangles)">सोन्याचे पाटल्या / बांगड्या (Bangles)</option>
                      <option value="सोन्याचा हार / नेकलेस (Necklace)">सोन्याचा हार / नेकलेस (Necklace)</option>
                      <option value="सोन्याचे मंगलसूत्र (Mangalsutra)">सोन्याचे मंगलसूत्र (Mangalsutra)</option>
                      <option value="सोन्याची वेढणी / नाणे (Coin/Bar)">सोन्याची वेढणी / नाणे (Coin/Bar)</option>
                      <option value="सोन्याचे झुमके / कानातील (Earrings)">सोन्याचे झुमके / कानातील (Earrings)</option>
                      <option value="इतर सुवर्ण अलंकार (Other Ornaments)">इतर सुवर्ण अलंकार (Other Ornaments)</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>शुद्धता / कॅरेट (Purity) *</label>
                    <select
                      value={goldForm.purity}
                      onChange={(e) => setGoldForm(prev => ({ ...prev, purity: e.target.value }))}
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
                      step="0.01"
                      value={goldForm.grossWeight}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGoldForm(prev => ({
                          ...prev,
                          grossWeight: val,
                          netWeight: prev.netWeight === '' ? val : prev.netWeight
                        }));
                      }}
                      className={`${inputClass} font-mono`}
                      placeholder="उदा. 15.50"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>निव्वळ वजन (Net Wt. g) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={goldForm.netWeight}
                      onChange={(e) => setGoldForm(prev => ({ ...prev, netWeight: e.target.value }))}
                      className={`${inputClass} font-mono font-bold text-amber-950`}
                      placeholder="उदा. 14.80"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>दर प्रति ग्रॅम (Rate / g ₹) *</label>
                    <input
                      type="number"
                      value={goldForm.ratePerGram}
                      onChange={(e) => setGoldForm(prev => ({ ...prev, ratePerGram: e.target.value }))}
                      className={`${inputClass} font-mono`}
                      placeholder="6000"
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>मूल्यांकन (Valuation ₹)</label>
                    <input
                      type="text"
                      readOnly
                      value={(() => {
                        const net = parseFloat(goldForm.netWeight.toString() || '0');
                        const rate = parseFloat(goldForm.ratePerGram.toString() || '0');
                        return Math.round(net * rate).toLocaleString('en-IN');
                      })()}
                      className={`${inputClass} bg-emerald-50 text-emerald-800 font-bold font-mono border-emerald-300`}
                    />
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

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-1 rounded-sm text-xs shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>{editingGoldId ? '✓ बदल सेव्ह करा (Update)' : '➕ जिन्नस जोडा (Add Item)'}</span>
                  </button>
                </div>
              </form>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  <span className="text-[10px] font-bold text-emerald-800 block uppercase">सुवर्ण मूल्य (Valuation ₹)</span>
                  <span className="text-xs font-black text-emerald-800 font-mono">₹{totalGoldValuation.toLocaleString('en-IN')}</span>
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
                        <th className="p-1.5">दागिन्याचे नाव</th>
                        <th className="p-1.5 text-center">कॅरेट</th>
                        <th className="p-1.5 text-center">नग</th>
                        <th className="p-1.5 text-right">ग्रॉस वजन (g)</th>
                        <th className="p-1.5 text-right">निव्वळ वजन (g)</th>
                        <th className="p-1.5 text-right">दर / ग्रॅम (₹)</th>
                        <th className="p-1.5 text-right">एकूण मूल्य (₹)</th>
                        <th className="p-1.5">शेरा</th>
                        <th className="p-1.5 text-center w-24">कृती</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px] font-mono">
                      {goldItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-6 text-center text-slate-400 font-sans italic">
                            कोणताही सोन्याचा जिन्नस जोडलेला नाही.
                          </td>
                        </tr>
                      ) : (
                        goldItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                            <td className="p-1.5 text-center font-bold text-slate-500 font-sans">{idx + 1}</td>
                            <td className="p-1.5 font-bold text-slate-800 font-sans">{item.itemName}</td>
                            <td className="p-1.5 text-center font-bold text-amber-800">{item.purity}</td>
                            <td className="p-1.5 text-center font-semibold">{item.quantity}</td>
                            <td className="p-1.5 text-right">{item.grossWeight.toFixed(2)} g</td>
                            <td className="p-1.5 text-right font-bold text-amber-900">{item.netWeight.toFixed(2)} g</td>
                            <td className="p-1.5 text-right">₹{item.ratePerGram.toLocaleString('en-IN')}</td>
                            <td className="p-1.5 text-right font-black text-emerald-700">₹{item.valuationAmount.toLocaleString('en-IN')}</td>
                            <td className="p-1.5 text-slate-600 text-[10px] truncate max-w-[120px] font-sans">{item.remarks || '-'}</td>
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
            <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-700 font-medium">
                ✨ सुवर्ण एकूण मूल्यांकन: <strong className="text-emerald-700 font-black font-mono">₹{totalGoldValuation.toLocaleString('en-IN')}</strong> ({totalGoldNetWeight.toFixed(2)} ग्रॅम निव्वळ वजन)
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoldModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-1.5 rounded-sm text-xs font-bold cursor-pointer border border-slate-300"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="button"
                  onClick={applyGoldLoanToApplication}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-1.5 rounded-sm text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>✅ तारण माहिती अर्जाशी जोडा (Apply)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ DEPOSIT COLLATERAL SELECTOR MODAL (FD, Pigmy, RD, Saving) */}
      {(() => {
        const curRate = loanRates.find(r => r.loanRateID === formData.loanRateID);
        const selectedCust: any = members.find((m: any) => (m.customerID || m.id) === formData.customerID);
        const customerDisplayName = selectedCust ? (selectedCust.name || `${selectedCust.firstName || ''} ${selectedCust.lastName || ''}`.trim()) : '';
        return (
          <DepositCollateralSelectorModal
            isOpen={showDepositModal}
            onClose={() => setShowDepositModal(false)}
            customerID={formData.customerID || 0}
            customerName={customerDisplayName}
            collateralCategory={curRate?.collateralCategory || 'FixedDeposit'}
            maxLtv={curRate?.maxLtvPercentage || 85}
            alreadySelectedIds={depositCollaterals.map((c: any) => c.depositAccountID || c.DepositAccountID)}
            onApply={(selectedItems, totalVal, summaryText) => {
              setDepositCollaterals(selectedItems);
              setFormData(prev => ({
                ...prev,
                securityValue: totalVal,
                securityDetails: summaryText
              }));
              setSuccess('ठेव तारण माहिती कर्ज अर्जाशी यशस्वीरित्या जोडली गेली!');
            }}
          />
        );
      })()}

      {/* 📄 LOAN APPLICATION FORM PRINT PREVIEW MODAL */}
      {printApplication && (
        <LoanApplicationPrintModal
          application={printApplication}
          onClose={() => setPrintApplication(null)}
        />
      )}

    </div>
  );
};

export default LoanApplicationMaster;

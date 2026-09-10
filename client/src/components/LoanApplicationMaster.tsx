import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
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
  Printer
} from 'lucide-react';
import LoanApplicationPrintModal from './LoanApplicationPrintModal';

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
}

export interface LoanApplication {
  loanApplicationID: number;
  applicationNo: string;
  applicationDate: string;
  customerID?: number;
  memberID?: number;
  coCustomerID?: number;
  coCustomer2ID?: number;
  coMemberID?: number;
  coMember2ID?: number;
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
  guarantor1MemberID?: number;
  guarantor2MemberID?: number;
  securityDetails?: string;
  securityValue?: number;
  purpose?: string;
  customer?: any;
  member?: Member;
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

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

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
    memberID: 0,
    coCustomerID: 0,
    coCustomer2ID: 0,
    coMemberID: 0,
    coMember2ID: 0,
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
    guarantor1MemberID: 0,
    guarantor2MemberID: 0,
    securityDetails: '',
    securityValue: 0,
    purpose: ''
  };

  const [formData, setFormData] = useState<Partial<LoanApplication>>(initialFormState);

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
    if (formData.guarantor1MemberID) {
      axios.get(`/api/Members/${formData.guarantor1MemberID}/guarantor-summary`)
        .then(res => setGuarantor1Summary(res.data))
        .catch(err => console.error("Failed to fetch guarantor 1 summary", err));
    } else {
      setGuarantor1Summary(null);
    }
  }, [formData.guarantor1MemberID]);

  useEffect(() => {
    if (formData.guarantor2MemberID) {
      axios.get(`/api/Members/${formData.guarantor2MemberID}/guarantor-summary`)
        .then(res => setGuarantor2Summary(res.data))
        .catch(err => console.error("Failed to fetch guarantor 2 summary", err));
    } else {
      setGuarantor2Summary(null);
    }
  }, [formData.guarantor2MemberID]);

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
    const memberIdStr = params.get('memberId');
    if (memberIdStr && members.length > 0) {
      const mId = parseInt(memberIdStr, 10);
      const matchedMember = members.find(m => m.memberID === mId);
      if (matchedMember) {
        setFormData(prev => ({
          ...prev,
          memberID: mId
        }));
      }
    }
  }, [members]);

  // Auto EMI calculation
  useEffect(() => {
    if (formData.requestedAmount && formData.interestRate && formData.noOfInstallments) {
      const P = formData.requestedAmount;
      const ratePerYear = formData.interestRate;
      const n = formData.noOfInstallments;
      let freqDivisor = 12;
      if (formData.installmentFrequency === 'साप्ताहिक') freqDivisor = 52;
      else if (formData.installmentFrequency === 'त्रैमासिक') freqDivisor = 4;
      else if (formData.installmentFrequency === 'सहामाही') freqDivisor = 2;
      else if (formData.installmentFrequency === 'वार्षिक') freqDivisor = 1;

      const rateObj = loanRates.find(r => r.loanRateID === formData.loanRateID);
      let newInstallment = 0;

      if (rateObj) {
        const calcMethod = rateObj.interestCalculationMethod || "Reducing (घटती शिल्लक)";
        const instType = rateObj.loanInstallmentType || "समान हप्ता";

        if (calcMethod.includes("Reducing") && (instType === "समान मुद्दल" || instType === "कर्जावरती" || instType.includes("मुद्दल") || instType.includes("कर्जावर"))) {
          newInstallment = Math.round(P / n);
        } else {
          const r = (ratePerYear / 100) / freqDivisor;
          if (r === 0) {
            newInstallment = Math.round(P / n);
          } else {
            newInstallment = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
          }
        }
      } else {
        const r = (ratePerYear / 100) / freqDivisor;
        if (r === 0) {
          newInstallment = Math.round(P / n);
        } else {
          newInstallment = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
        }
      }
      
      if (!isInstAmountEdited && formData.installmentAmount !== newInstallment) {
        setFormData(prev => ({ ...prev, installmentAmount: newInstallment }));
      }
    }
  }, [formData.requestedAmount, formData.interestRate, formData.noOfInstallments, formData.installmentFrequency, formData.loanRateID, loanRates, isInstAmountEdited]);

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
      let freqDivisor = 12;
      if (formData.installmentFrequency === 'त्रैमासिक') freqDivisor = 4;
      else if (formData.installmentFrequency === 'सहामाही') freqDivisor = 2;
      else if (formData.installmentFrequency === 'वार्षिक') freqDivisor = 1;

      const rateObj = loanRates.find(r => r.loanRateID === formData.loanRateID);
      let newInstallment = 0;

      if (rateObj) {
        const calcMethod = rateObj.interestCalculationMethod || "Reducing (घटती शिल्लक)";
        const instType = rateObj.loanInstallmentType || "समान हप्ता";

        if (calcMethod.includes("Reducing") && (instType === "समान मुद्दल" || instType === "कर्जावरती" || instType.includes("मुद्दल") || instType.includes("कर्जावर"))) {
          newInstallment = Math.round(P / n);
        } else {
          const r = (ratePerYear / 100) / freqDivisor;
          if (r === 0) newInstallment = Math.round(P / n);
          else newInstallment = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
        }
      } else {
        const r = (ratePerYear / 100) / freqDivisor;
        if (r === 0) newInstallment = Math.round(P / n);
        else newInstallment = Math.round((P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
      }
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

    if (!formData.memberID && !formData.customerID) {
      setError('कृपया अर्जदार ग्राहक किंवा सभासद निवडा! (Please select Applicant)');
      return;
    }

    if (!formData.loanRateID || !formData.requestedAmount) {
      setError('कृपया कर्ज प्रकार आणि मागणी रक्कम टाका! (Please select Loan Type and Requested Amount)');
      return;
    }

    setLoading(true);
    try {
      let savedData: any = null;
      // Resolve applicant customer and member ID
      const selApp = members.find((m: any) => 
        (formData.customerID && (m.customerID === Number(formData.customerID) || m.id === Number(formData.customerID))) ||
        (formData.memberID && (m.memberID === Number(formData.memberID) || m.memberProfile?.memberID === Number(formData.memberID)))
      );
      const resolvedCustId = formData.customerID || selApp?.customerID || selApp?.id || selApp?.memberProfile?.customerID || null;
      const resolvedMemId = formData.memberID || selApp?.memberProfile?.memberID || selApp?.memberID || null;

      const payload: any = {
        ...formData,
        customerID: resolvedCustId ? Number(resolvedCustId) : null,
        memberID: resolvedMemId ? Number(resolvedMemId) : null,
        coCustomerID: formData.coCustomerID && Number(formData.coCustomerID) > 0 ? Number(formData.coCustomerID) : null,
        coCustomer2ID: (formData as any).coCustomer2ID && Number((formData as any).coCustomer2ID) > 0 ? Number((formData as any).coCustomer2ID) : null,
        guarantor1CustomerID: (formData as any).guarantor1CustomerID && Number((formData as any).guarantor1CustomerID) > 0 ? Number((formData as any).guarantor1CustomerID) : null,
        guarantor2CustomerID: (formData as any).guarantor2CustomerID && Number((formData as any).guarantor2CustomerID) > 0 ? Number((formData as any).guarantor2CustomerID) : null,
        loanRateID: Number(formData.loanRateID),
        requestedAmount: parseFloat(String(formData.requestedAmount || '0')),
        interestRate: parseFloat(String(formData.interestRate || '0')),
        durationMonths: parseInt(String(formData.durationMonths || '12'), 10),
        noOfInstallments: parseInt(String(formData.noOfInstallments || '12'), 10),
        installmentAmount: parseFloat(String(formData.installmentAmount || '0')),
        securityValue: parseFloat(String(formData.securityValue || '0')),
        coMemberID: formData.coMemberID && Number(formData.coMemberID) > 0 ? Number(formData.coMemberID) : null,
        coMember2ID: (formData as any).coMember2ID && Number((formData as any).coMember2ID) > 0 ? Number((formData as any).coMember2ID) : null,
        recommendedByDirectorID: formData.recommendedByDirectorID && Number(formData.recommendedByDirectorID) > 0 ? Number(formData.recommendedByDirectorID) : null,
        guarantor1MemberID: formData.guarantor1MemberID && Number(formData.guarantor1MemberID) > 0 ? Number(formData.guarantor1MemberID) : null,
        guarantor2MemberID: formData.guarantor2MemberID && Number(formData.guarantor2MemberID) > 0 ? Number(formData.guarantor2MemberID) : null,
        firstInstallmentDate: formData.firstInstallmentDate ? formData.firstInstallmentDate : null,
        maturityDate: formData.maturityDate ? formData.maturityDate : null,
      };
      delete payload.customer;
      delete payload.member;
      delete payload.coCustomer;
      delete payload.coCustomer2;
      delete payload.coMember;
      delete payload.coMember2;
      delete payload.loanRate;
      delete payload.guarantor1Customer;
      delete payload.guarantor2Customer;
      delete payload.guarantor1Member;
      delete payload.guarantor2Member;
      delete payload.recommendedByDirector;

      if (formData.loanApplicationID) {
        await axios.put(`/api/LoanApplications/${formData.loanApplicationID}`, payload);
        savedData = { ...payload };
        setSuccess(`कर्ज अर्ज #${formData.applicationNo || formData.loanApplicationID} यशस्वीरित्या अद्यतनित झाला!`);
      } else {
        delete payload.loanApplicationID;
        const res = await axios.post('/api/LoanApplications', payload);
        savedData = res.data;
        setSuccess(`नवीन कर्ज अर्ज #${res.data.applicationNo || res.data.loanApplicationID} यशस्वीरीत्या सेव्ह झाला!`);
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
    setFormData({
      ...app,
      applicationDate: app.applicationDate ? app.applicationDate.split('T')[0] : '',
      firstInstallmentDate: app.firstInstallmentDate ? app.firstInstallmentDate.split('T')[0] : '',
      maturityDate: app.maturityDate ? app.maturityDate.split('T')[0] : ''
    });
    
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
        customInstallmentAmount: formData.installmentAmount && formData.installmentAmount > 0 ? formData.installmentAmount : null
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
      'सभासद कोड': a.member?.memberCode || '-',
      'सभासद नाव': `${a.member?.firstName || ''} ${a.member?.lastName || ''}`.trim(),
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
    (formData.customerID && (m.customerID === Number(formData.customerID) || m.id === Number(formData.customerID))) ||
    (formData.memberID && (m.memberID === Number(formData.memberID) || m.memberProfile?.memberID === Number(formData.memberID)))
  );

  const filteredApps = applications.filter(a => {
    const q = searchTerm.toLowerCase();
    const custName = a.customer ? `${a.customer.firstName || ''} ${a.customer.lastName || ''}`.toLowerCase() : '';
    const custCif = a.customer?.cifNo ? a.customer.cifNo.toLowerCase() : '';
    return (
      (a.applicationNo && a.applicationNo.toLowerCase().includes(q)) ||
      (a.member?.firstName && a.member.firstName.toLowerCase().includes(q)) ||
      (a.member?.lastName && a.member.lastName.toLowerCase().includes(q)) ||
      (a.member?.memberCode && a.member.memberCode.toLowerCase().includes(q)) ||
      custName.includes(q) ||
      custCif.includes(q) ||
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
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Landmark size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>कर्ज अर्ज नोंदणी व मंजुरी</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Loan Application Master)</span>
              {isEditing && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{formData.applicationNo || formData.loanApplicationID})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              नवीन कर्ज मागणी अर्ज, सह-कर्जदार, जामीनदार पडताळणी, सुवर्ण तारण मूल्यांकन व हप्ता वेळापत्रक व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              type="button"
              onClick={handleResetForm}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetForm}
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
              fetchData();
              setShowListModal(true);
            }}
            className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="सर्व नोंदवलेले कर्ज अर्ज यादी पॉप-अप मध्ये पहा"
          >
            <Layers className="w-4 h-4" />
            <span>📋 नोंदवलेले अर्ज पहा ({applications.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUMMARY KPI CARDS                                                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण कर्ज अर्ज</div>
            <div className="text-sm font-black text-gray-900">{applications.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण मागणी रक्कम</div>
            <div className="text-sm font-black text-emerald-800">₹{totalRequestedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">सक्रिय कर्ज योजना</div>
            <div className="text-sm font-black text-amber-800">{activeSchemesCount} योजना</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs animate-in fade-in duration-150">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs animate-in fade-in duration-150">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE: FORM & ON-DEMAND LIVE SCHEDULE                            */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row gap-3 items-start">
        
        {/* Main Form Container - Full Width when schedule is hidden */}
        <div 
          ref={formContainerRef}
          className={`${showSchedule ? 'w-full lg:w-7/12' : 'w-full'} bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
            isEditing ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            
            {/* Section 1: Member & Co-Borrower Details */}
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
              <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                <UserCheck className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. अर्जदार व सह-कर्जदार तपशील (Applicant & Co-Borrowers)</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className={labelClass}>अर्ज क्र. (App No)</label>
                  <input
                    type="text"
                    name="applicationNo"
                    value={formData.applicationNo || ''}
                    readOnly
                    className={`${inputClass} bg-slate-100 font-bold text-primary font-mono cursor-not-allowed`}
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

                <div className="sm:col-span-2">
                  <label className={labelClass}>
                    अर्जदार ग्राहक / सभासद निवडा (Select Customer / Member) <span className="text-red-500">*</span>
                  </label>
                  <div className={isEditing ? 'opacity-90' : ''}>
                    <MemberSearchSelect
                      members={members}
                      value={formData.memberID ? Number(formData.memberID) : (formData.customerID ? Number(formData.customerID) : '')}
                      onChange={(val, selected) => {
                        const custId = selected?.customerID || selected?.id || selected?.memberProfile?.customerID || 0;
                        const memId = selected?.memberIdOnly || selected?.memberProfile?.memberID || (selected?.memberCode ? selected.memberID : 0) || 0;
                        setFormData(p => ({
                          ...p,
                          customerID: custId ? Number(custId) : (val ? Number(val) : 0),
                          memberID: memId ? Number(memId) : (selected?.memberCode ? Number(val) : 0)
                        }));
                      }}
                      placeholder="-- सभासद/ग्राहक नाव, CIF, कोड किंवा मोबाईलने शोधा --"
                    />
                  </div>
                </div>
              </div>

              {/* Selected Member Profile Card with Centered Name */}
              {selectedMember && (
                <div className="p-2 bg-primary/5 border border-primary/20 rounded-sm text-[10px] space-y-1 text-gray-800 font-medium">
                  <div className="flex flex-wrap justify-between items-center gap-1 border-b border-primary/10 pb-1">
                    <span><b>CIF No:</b> <span className="font-mono">{selectedMember.cifNo || (selectedMember as any).cif || '-'}</span></span>
                    <span><b>मोबाईल:</b> <span className="font-mono">{selectedMember.mobileNo || '-'}</span></span>
                    <span><b>सभासद कोड:</b> <span className="font-mono">{(selectedMember as any).memberCode || (selectedMember as any).memberProfile?.memberCode || 'बिगर-सभासद (Customer Only)'}</span></span>
                  </div>
                  <div className="text-center pt-0.5 text-xs font-bold text-gray-900">
                    <span className="text-gray-600 font-medium">अर्जदार नाव: </span>
                    <span className="text-primary font-black text-sm">
                      {selectedMember.firstName} {selectedMember.middleName ? selectedMember.middleName + ' ' : ''}{selectedMember.lastName}
                    </span>
                  </div>
                </div>
              )}

              {/* Co-Borrowers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-gray-100">
                <div>
                  <label className={labelClass}>सह-कर्जदार १ (Co-Borrower 1)</label>
                  <MemberSearchSelect
                    members={members.filter((m: any) => {
                      const mCustId = m.customerID || m.id || m.memberProfile?.customerID;
                      const mMemId = m.memberID || m.memberProfile?.memberID;
                      return (formData.customerID ? mCustId !== formData.customerID : true) &&
                             (formData.memberID ? mMemId !== formData.memberID : true);
                    })}
                    value={formData.coMemberID ? Number(formData.coMemberID) : (formData.coCustomerID ? Number(formData.coCustomerID) : '')}
                    onChange={(val, selected) => {
                      const custId = selected?.customerID || selected?.id || selected?.memberProfile?.customerID || 0;
                      const memId = selected?.memberIdOnly || selected?.memberProfile?.memberID || 0;
                      setFormData(p => ({
                        ...p,
                        coCustomerID: custId ? Number(custId) : 0,
                        coMemberID: memId ? Number(memId) : 0
                      }));
                    }}
                    placeholder="-- सह-कर्जदार १ शोधा --"
                  />
                </div>

                <div>
                  <label className={labelClass}>सह-कर्जदार २ (Co-Borrower 2)</label>
                  <MemberSearchSelect
                    members={members.filter((m: any) => {
                      const mCustId = m.customerID || m.id || m.memberProfile?.customerID;
                      const mMemId = m.memberID || m.memberProfile?.memberID;
                      return (formData.customerID ? mCustId !== formData.customerID : true) &&
                             (formData.memberID ? mMemId !== formData.memberID : true) &&
                             (formData.coCustomerID ? mCustId !== formData.coCustomerID : true);
                    })}
                    value={(formData as any).coMember2ID ? Number((formData as any).coMember2ID) : ((formData as any).coCustomer2ID ? Number((formData as any).coCustomer2ID) : '')}
                    onChange={(val, selected) => {
                      const custId = selected?.customerID || selected?.id || selected?.memberProfile?.customerID || 0;
                      const memId = selected?.memberIdOnly || selected?.memberProfile?.memberID || 0;
                      setFormData(p => ({
                        ...p,
                        coCustomer2ID: custId ? Number(custId) : 0,
                        coMember2ID: memId ? Number(memId) : 0
                      }));
                    }}
                    placeholder="-- सह-कर्जदार २ शोधा --"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Loan Details & Repayment Rules */}
            <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
              <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                <Percent className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">२. कर्ज माहिती व परतफेड नियम (Loan Terms & Rates)</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-1">
                  <label className={labelClass}>
                    कर्ज प्रकार / योजना (Loan Scheme) <span className="text-red-500">*</span>
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

                <div>
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

                <div>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className={labelClass}>
                    हप्ता प्रकार (Frequency) <span className="text-red-500">*</span>
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

                <div>
                  <label className={labelClass}>
                    मुदत महिने (Duration) <span className="text-red-500">*</span>
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

                <div>
                  <label className={labelClass}>
                    हप्ते संख्या (No of Inst) <span className="text-red-500">*</span>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className={labelClass}>
                      हप्ता रक्कम (Inst Amount ₹) <span className="text-red-500">*</span>
                    </label>
                    {isInstAmountEdited && (
                      <button
                        type="button"
                        onClick={handleResetInstAmount}
                        title="ऑटो हप्ता रिसेट करा"
                        className="text-[10px] text-primary hover:underline font-bold"
                      >
                        🔄 ऑटो रिसेट
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
                      title="हप्ता पत्रक पहा (View Schedule)"
                      className="bg-primary hover:opacity-90 text-white px-2.5 py-0.5 rounded-sm text-[10px] font-bold whitespace-nowrap cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                    >
                      <span>📊 पत्रक</span>
                    </button>
                  </div>
                </div>

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

              {/* Director Recommendation */}
              <div className="pt-1.5 border-t border-gray-100">
                <label className={labelClass}>संचालक शिफारस (Director Recommendation)</label>
                <MemberSearchSelect
                  members={members}
                  value={formData.recommendedByDirectorID ? Number(formData.recommendedByDirectorID) : ''}
                  onChange={(val) => setFormData(p => ({ ...p, recommendedByDirectorID: val ? Number(val) : 0 }))}
                  placeholder="-- संचालक शिफारस शोधा --"
                />
                {directorSummary && (
                  <div className="mt-1 p-1.5 bg-purple-50/70 border border-purple-200 rounded-sm text-[10px] text-purple-900 flex justify-between items-center shadow-2xs">
                    <div>
                      <span>👔 <b>{directorSummary.activeRecommendedLoansCount}</b> चालू शिफारस कर्जे | <b>{directorSummary.pendingRecommendedAppsCount}</b> अर्ज</span>
                      <span className="ml-2 font-mono text-purple-950 font-bold">बाकी: ₹{(directorSummary.totalRecommendedCurrentBalance || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDirectorForModal(directorSummary)}
                      className="px-1.5 py-0.5 bg-purple-200 hover:bg-purple-300 text-purple-950 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>तपशील</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Guarantors & Collateral Security (Styled in primary/5) */}
            <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
              <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">३. जामीनदार व तारण तपशील (Guarantors & Collateral Security)</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className={labelClass}>जामीनदार १ (Guarantor 1)</label>
                  <MemberSearchSelect
                    members={members.filter((m: any) => {
                      const mCustId = m.customerID || m.id || m.memberProfile?.customerID;
                      const mMemId = m.memberID || m.memberProfile?.memberID;
                      return (formData.customerID ? mCustId !== formData.customerID : true) &&
                             (formData.memberID ? mMemId !== formData.memberID : true);
                    })}
                    value={formData.guarantor1MemberID ? Number(formData.guarantor1MemberID) : ((formData as any).guarantor1CustomerID ? Number((formData as any).guarantor1CustomerID) : '')}
                    onChange={(val, selected) => {
                      const custId = selected?.customerID || selected?.id || selected?.memberProfile?.customerID || 0;
                      const memId = selected?.memberIdOnly || selected?.memberProfile?.memberID || 0;
                      setFormData(p => ({
                        ...p,
                        guarantor1CustomerID: custId ? Number(custId) : 0,
                        guarantor1MemberID: memId ? Number(memId) : 0
                      }));
                    }}
                    placeholder="-- जामीनदार १ शोधा --"
                  />
                  {guarantor1Summary && (
                    <div className="mt-1 p-1.5 bg-amber-50 border border-amber-300 rounded-sm text-[10px] text-amber-900 flex justify-between items-center shadow-2xs">
                      <div>
                        <span>🛡️ <b>{guarantor1Summary.activeGuaranteedLoansCount}</b> चालू जामीन | <b>{guarantor1Summary.pendingGuaranteedAppsCount}</b> अर्ज</span>
                        <span className="ml-2 font-mono text-amber-950 font-bold">बाकी: ₹{(guarantor1Summary.totalCurrentBalance || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedGuarantorForModal(guarantor1Summary)}
                        className="px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>तपशील</span>
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>जामीनदार २ (Guarantor 2)</label>
                  <MemberSearchSelect
                    members={members.filter((m: any) => {
                      const mCustId = m.customerID || m.id || m.memberProfile?.customerID;
                      const mMemId = m.memberID || m.memberProfile?.memberID;
                      return (formData.customerID ? mCustId !== formData.customerID : true) &&
                             (formData.memberID ? mMemId !== formData.memberID : true) &&
                             ((formData as any).guarantor1CustomerID ? mCustId !== (formData as any).guarantor1CustomerID : true) &&
                             (formData.guarantor1MemberID ? mMemId !== formData.guarantor1MemberID : true);
                    })}
                    value={formData.guarantor2MemberID ? Number(formData.guarantor2MemberID) : ((formData as any).guarantor2CustomerID ? Number((formData as any).guarantor2CustomerID) : '')}
                    onChange={(val, selected) => {
                      const custId = selected?.customerID || selected?.id || selected?.memberProfile?.customerID || 0;
                      const memId = selected?.memberIdOnly || selected?.memberProfile?.memberID || 0;
                      setFormData(p => ({
                        ...p,
                        guarantor2CustomerID: custId ? Number(custId) : 0,
                        guarantor2MemberID: memId ? Number(memId) : 0
                      }));
                    }}
                    placeholder="-- जामीनदार २ शोधा --"
                  />
                  {guarantor2Summary && (
                    <div className="mt-1 p-1.5 bg-amber-50 border border-amber-300 rounded-sm text-[10px] text-amber-900 flex justify-between items-center shadow-2xs">
                      <div>
                        <span>🛡️ <b>{guarantor2Summary.activeGuaranteedLoansCount}</b> चालू जामीन | <b>{guarantor2Summary.pendingGuaranteedAppsCount}</b> अर्ज</span>
                        <span className="ml-2 font-mono text-amber-950 font-bold">बाकी: ₹{(guarantor2Summary.totalCurrentBalance || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedGuarantorForModal(guarantor2Summary)}
                        className="px-1.5 py-0.5 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>तपशील</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-primary/10">
                <div>
                  <label className={labelClass}>तारण तपशील (Security Details)</label>
                  <SearchableSelect
                    options={secOptions}
                    value={formData.securityDetails || ''}
                    onChange={(e: any) => setFormData(p => ({ ...p, securityDetails: e.target.value }))}
                    placeholder="-- तारण प्रकार निवडा --"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className={labelClass}>तारण मूल्य (Security Value ₹)</label>
                    <button
                      type="button"
                      onClick={() => setShowGoldModal(true)}
                      className="text-[10px] text-amber-900 font-bold hover:underline flex items-center gap-0.5 cursor-pointer bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-300"
                    >
                      <Sparkles className="w-3 h-3 text-amber-700" />
                      <span>सुवर्ण तारण</span>
                    </button>
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

            {/* Form Action Buttons Bar */}
            <div className="pt-2 flex flex-wrap justify-between items-center gap-2 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowListModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-600" />
                  <span>कर्ज अर्ज यादी ({applications.length})</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    if (!showSchedule) {
                      calculateSchedule();
                    } else {
                      setShowSchedule(false);
                    }
                  }}
                  className={`px-3 py-1.5 font-bold rounded-sm text-xs border cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all ${
                    showSchedule 
                      ? 'bg-primary text-white border-primary shadow-xs' 
                      : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20'
                  }`}
                  title={showSchedule ? "हप्ता वेळापत्रक पत्रक लपवा" : "हप्ता वेळापत्रक पत्रक उघडा"}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>{showSchedule ? 'हप्ता पत्रक लपवा' : '📊 वेळापत्रक पत्रक'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
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

        {/* Right Live Installment Schedule Preview (Displayed only on-demand when showSchedule is true) */}
        {showSchedule && (
          <div className="w-full lg:w-5/12 bg-white p-3.5 rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary sticky top-2 min-h-[480px] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold text-primary">हप्ता वेळापत्रक पत्रक (Live Schedule)</h3>
              </div>
              <div className="flex items-center gap-1.5">
                {scheduleData.length > 0 && (
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                    {scheduleData.length} हप्ते
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowSchedule(false)}
                  className="text-gray-400 hover:text-gray-700 hover:bg-slate-100 p-1 rounded-sm transition-colors cursor-pointer"
                  title="पत्रक लपवा (Hide Schedule)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Mini Summary Banner */}
            <div className="grid grid-cols-3 gap-1 text-[10px] bg-primary/5 p-2 rounded-sm border border-primary/20 mb-2">
              <div>
                <span className="text-gray-500 block">मागणी रक्कम:</span>
                <span className="font-bold text-gray-900 font-mono">₹{(formData.requestedAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-gray-500 block">हप्ता रक्कम:</span>
                <span className="font-bold text-emerald-700 font-mono">₹{(formData.installmentAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-gray-500 block">व्याज दर:</span>
                <span className="font-bold text-indigo-900 font-mono">{formData.interestRate || 0}% p.a.</span>
              </div>
            </div>

            {scheduleData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400 bg-slate-50/50 rounded border border-dashed border-gray-200">
                <Calculator className="w-8 h-8 text-gray-300 mb-2 stroke-[1.5]" />
                <p className="text-xs font-semibold text-gray-600">हप्ता पत्रक तयार करण्यासाठी डावीकडील कर्ज रक्कम व माहिती भरा.</p>
                <button
                  type="button"
                  onClick={calculateSchedule}
                  className="mt-3 px-3 py-1 bg-primary text-white rounded-sm text-[11px] font-bold shadow-2xs hover:opacity-90 cursor-pointer"
                >
                  📊 वेळापत्रक लोड करा
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-auto max-h-[58vh] border border-gray-200 rounded-sm">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="p-1.5 border-r border-gray-200 text-center w-8">क्र.</th>
                      <th className="p-1.5 border-r border-gray-200 text-center">हप्ता दिनांक</th>
                      <th className="p-1.5 border-r border-gray-200 text-right">मुद्दल (₹)</th>
                      <th className="p-1.5 border-r border-gray-200 text-right">व्याज (₹)</th>
                      <th className="p-1.5 border-r border-gray-200 text-right">एकूण (₹)</th>
                      <th className="p-1.5 text-right">बाकी शिल्लक (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white font-mono">
                    {scheduleData.map((row, i) => (
                      <tr key={i} className="hover:bg-primary/5 transition-colors">
                        <td className="p-1.5 border-r border-gray-200 text-center font-bold text-gray-700">{row.instNo}</td>
                        <td className="p-1.5 border-r border-gray-200 text-center text-gray-600">
                          {row.dueDate || '-'}
                        </td>
                        <td className="p-1.5 border-r border-gray-200 text-right text-gray-800">{Math.round(row.principal || 0).toLocaleString('en-IN')}</td>
                        <td className="p-1.5 border-r border-gray-200 text-right text-rose-700">{Math.round(row.interest || 0).toLocaleString('en-IN')}</td>
                        <td className="p-1.5 border-r border-gray-200 text-right font-bold text-emerald-800">{Math.round(row.total || 0).toLocaleString('en-IN')}</td>
                        <td className="p-1.5 text-right text-gray-700">{Math.round(row.balance || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

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
                  placeholder="अर्ज क्र., सभासद नाव किंवा कोड शोधा..." 
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">सभासद नाव व कोड</th>
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
                            {app.customer ? `${app.customer.firstName || ''} ${app.customer.lastName || ''}`.trim() : `${app.member?.firstName || ''} ${app.member?.lastName || ''}`.trim()}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {app.member?.memberCode ? `कोड: ${app.member.memberCode}` : 'बिगर-सभासद'} {app.customer?.cifNo || app.member?.cifNo ? `| CIF: ${app.customer?.cifNo || app.member?.cifNo}` : ''}
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

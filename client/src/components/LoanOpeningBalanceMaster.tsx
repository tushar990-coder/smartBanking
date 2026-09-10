import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Member {
  memberID: number;
  firstName: string;
  middleName: string;
  lastName: string;
  cifNo: string;
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
}

interface LoanOpeningBalance {
  loanAccountID: number;
  branchID: number;
  branch?: {
    branchName: string;
    branchCode: string;
  };
  memberID: number;
  loanRateID: number;
  loanAccountNo: string;
  legacyAccountNumber?: string;
  
  principalBalance: number;
  interestBalance: number;
  overdueInterestBalance: number;
  openingDate: string;
  
  loanDisbursementDate?: string;
  sanctionedAmount: number;
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

  member?: Member;
  loanRate?: LoanRate;
}

export default function LoanOpeningBalanceMaster() {
  const [allAccounts, setAllAccounts] = useState<LoanOpeningBalance[]>([]);
  const [showAllLoans, setShowAllLoans] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [installmentChart, setInstallmentChart] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
  const [formData, setFormData] = useState({
    loanOpeningBalanceID: 0,
    branchID: '1',
    memberID: '',
    loanRateID: '',
    loanAccountNo: '',
    legacyAccountNumber: '',
    
    principalBalance: '',
    interestBalance: '',
    overdueInterestBalance: '',
    openingDate: '2025-03-31',

    loanDisbursementDate: '2025-03-31',
    sanctionedAmount: '',
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
  const MEMBERS_API = '/api/Members';
  const LOAN_RATES_API = '/api/LoanRates';
  const BRANCHES_API = '/api/Branches';
  const FINANCIAL_YEARS_API = '/api/FinancialYears';

  useEffect(() => {
    fetchFinancialYears();
    fetchBalances();
    fetchMembers();
    fetchLoanRates();
    fetchBranches();
    fetchNextAccountNo();
  }, []);

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

  const fetchNextAccountNo = async (branchId?: string | number) => {
    try {
      const bId = branchId || formData.branchID || '1';
      const res = await fetch(`/api/LoanAccounts/next-account-no?branchId=${bId}`);
      if (res.ok) {
        const nextNo = await res.text();
        setFormData(prev => ({ ...prev, loanAccountNo: nextNo }));
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

  const balances = showAllLoans 
    ? allAccounts 
    : allAccounts.filter((d: any) => d.isOpeningBalance === true);

  const filteredBalances = balances.filter(balance => {
    const term = searchTerm.toLowerCase();
    const memberName = `${balance.member?.firstName || ''} ${balance.member?.lastName || ''}`.toLowerCase();
    const loanAccountNo = (balance.loanAccountNo || '').toLowerCase();
    const oldAccountNo = (balance.legacyAccountNumber || '').toLowerCase();
    return memberName.includes(term) || loanAccountNo.includes(term) || oldAccountNo.includes(term);
  });

  const fetchBalances = async () => {
    try {
      const response = await fetch(GET_API_URL);
      if (response.ok) {
        const data = await response.json();
        setAllAccounts(data);
      }
    } catch (error) {
      console.error("Error fetching balances", error);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(MEMBERS_API);
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Error fetching members", error);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string, value: string | number } }) => {
    const name = e.target.name || '';
    const value = String(e.target.value ?? '');
    let updates: any = { [name]: value };

    if (name === 'branchID' && !isEditing) {
      fetchNextAccountNo(value);
    }
    
    // Prevent Principal from exceeding Sanctioned Amount
    if (name === 'principalBalance' || name === 'sanctionedAmount') {
      const principal = name === 'principalBalance' ? parseFloat(value || '0') : parseFloat(formData.principalBalance || '0');
      const sanction = name === 'sanctionedAmount' ? parseFloat(value || '0') : parseFloat(formData.sanctionedAmount || '0');
      
      if (sanction > 0 && principal > sanction) {
        if (name === 'principalBalance') {
          alert("मुद्दल कर्ज बाकी ही मंजूर रक्कमेपेक्षा जास्त असू शकत नाही!");
          updates.principalBalance = sanction.toString();
        } else {
          alert("मंजूर रक्कम ही मुद्दल कर्ज बाकीपेक्षा कमी असू शकत नाही! कृपया आधी मुद्दल बाकी कमी करा.");
          updates.sanctionedAmount = principal.toString();
        }
      }
    }

    if (name === 'installmentAmount') {
      setIsInstAmountEdited(true);
    }
    if (name === 'sanctionedAmount' || name === 'loanRateID' || name === 'durationMonths' || name === 'installmentFrequency') {
      setIsInstAmountEdited(false);
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
          loanDisbursementDate: 'कर्ज उचल दिनांक',
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

  useEffect(() => {
    if (formData.openingDate && installmentChart && installmentChart.length > 0) {
      const openDate = new Date(formData.openingDate);
      const firstEmiDate = formData.firstInstallmentDate ? new Date(formData.firstInstallmentDate) : null;
      
      if (firstEmiDate && openDate < firstEmiDate) {
         return;
      }

      const principal = parseFloat(formData.principalBalance) || 0;
      const sanction = parseFloat(formData.sanctionedAmount) || 0;
      if (principal > sanction) {
         return;
      }

      let lastPaidDate = new Date(0);
      if (formData.lastInstallmentPaidDate) {
        lastPaidDate = new Date(formData.lastInstallmentPaidDate);
      } else if (formData.loanDisbursementDate) {
        lastPaidDate = new Date(formData.loanDisbursementDate);
      }

      let sumInterest = 0;

      installmentChart.forEach(row => {
        const [day, month, year] = row.date.split('/');
        const rowDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        if (rowDate <= openDate && rowDate > lastPaidDate) {
          sumInterest += parseFloat(row.interest || '0');
        }
      });
      
      if (sumInterest < 0) sumInterest = 0;

      const roundedInterest = Math.round(sumInterest).toString();
      if (formData.interestBalance !== roundedInterest) {
        setFormData(prev => ({ ...prev, interestBalance: roundedInterest }));
      }
    }
  }, [formData.lastInstallmentPaidDate, formData.openingDate, formData.principalBalance, formData.sanctionedAmount, installmentChart]);

  const calculateEMI = async () => {
    const principal = parseFloat(formData.sanctionedAmount) || 0;
    const rate = parseFloat(formData.interestRate) || 0;
    const months = parseInt(formData.durationMonths) || 0;
    
    if (principal <= 0 || rate <= 0 || months <= 0 || !formData.loanRateID) {
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
        loanAmount: principal,
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
    setFormData({
      loanOpeningBalanceID: 0,
      branchID: '1',
      memberID: '',
      loanRateID: '',
      loanAccountNo: '',
      legacyAccountNumber: '',
      principalBalance: '',
      interestBalance: '',
      overdueInterestBalance: '',
      openingDate: getDefaultDate(),
      loanDisbursementDate: getTodayDate(),
      sanctionedAmount: '',
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
    setIsEditing(false);
    fetchNextAccountNo();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberID || !formData.loanRateID || !formData.loanAccountNo) {
        alert("कृपया आवश्यक माहिती भरा!");
        return;
    }

    const principal = parseFloat(formData.principalBalance || '0');
    const sanction = parseFloat(formData.sanctionedAmount || '0');
    if (sanction > 0 && principal > sanction) {
        alert("मुद्दल कर्ज बाकी ही मंजूर रक्कमेपेक्षा जास्त असू शकत नाही!");
        return;
    }

    if (cutoffDate) {
      const formattedCutoff = new Date(cutoffDate).toLocaleDateString('en-GB');
      if (formData.loanDisbursementDate && formData.loanDisbursementDate > cutoffDate) {
        alert(`कर्ज उचल दिनांक ही कट-ऑफ दिनांक (${formattedCutoff}) च्या आधीची किंवा त्या दिनांकाचीच असावी!`);
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
    
    try {
      const dataToSubmit = {
        ...formData,
        legacyAccountNumber: formData.legacyAccountNumber || null,
        loanOpeningBalanceID: isEditing ? formData.loanOpeningBalanceID : 0,
        branchID: parseInt(formData.branchID),
        memberID: parseInt(formData.memberID),
        loanRateID: parseInt(formData.loanRateID),
        
        principalBalance: parseFloat(formData.principalBalance || '0'),
        interestBalance: parseFloat(formData.interestBalance || '0'),
        overdueInterestBalance: parseFloat(formData.overdueInterestBalance || '0'),
        
        sanctionedAmount: parseFloat(formData.sanctionedAmount || '0'),
        interestRate: parseFloat(formData.interestRate || '0'),
        durationMonths: parseInt(formData.durationMonths || '0'),
        installmentAmount: parseFloat(formData.installmentAmount || '0'),
        securityValue: parseFloat(formData.securityValue || '0'),
        noOfInstallments: installmentChart.length,
        guarantor1MemberID: formData.guarantor1 ? parseInt(formData.guarantor1) : null,
        guarantor2MemberID: formData.guarantor2 ? parseInt(formData.guarantor2) : null,
        
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

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSubmit)
      });

      if (response.ok) {
        alert(isEditing ? 'खाते यशस्वीरित्या अद्यतनित झाले!' : 'खाते यशस्वीरित्या सेव्ह झाले!');
        fetchBalances();
        handleNew();
      } else {
        const errText = await response.text();
        alert('त्रुटी आली: ' + errText);
      }
    } catch (error) {
      console.error("Error saving loan opening balance", error);
      alert("सर्व्हरशी संपर्क साधता आला नाही.");
    }
  };

  const handleEdit = (balance: any) => {
    setIsInstAmountEdited(false);
    setFormData({
      loanOpeningBalanceID: balance.loanOpeningBalanceID || balance.loanAccountID,
      branchID: balance.branchID.toString(),
      memberID: balance.memberID.toString(),
      loanRateID: balance.loanRateID.toString(),
      loanAccountNo: balance.loanAccountNo,
      legacyAccountNumber: balance.legacyAccountNumber || '',
      principalBalance: balance.principalBalance.toString(),
      interestBalance: balance.interestBalance.toString(),
      overdueInterestBalance: (balance.overdueInterestBalance || 0).toString(),
      openingDate: balance.openingDate ? balance.openingDate.split('T')[0] : '',
      loanDisbursementDate: balance.loanDisbursementDate ? balance.loanDisbursementDate.split('T')[0] : '',
      sanctionedAmount: balance.sanctionedAmount.toString(),
      interestRate: balance.interestRate.toString(),
      durationMonths: balance.durationMonths.toString(),
      noOfInstallments: (balance as any).noOfInstallments?.toString() || '',
      installmentFrequency: balance.installmentFrequency || 'मासिक',
      installmentAmount: balance.installmentAmount.toString(),
      firstInstallmentDate: balance.firstInstallmentDate ? balance.firstInstallmentDate.split('T')[0] : '',
      maturityDate: balance.maturityDate ? balance.maturityDate.split('T')[0] : '',
      lastInstallmentPaidDate: balance.lastInstallmentPaidDate ? balance.lastInstallmentPaidDate.split('T')[0] : '',
      guarantor1: balance.guarantor1MemberID?.toString() || '',
      guarantor2: balance.guarantor2MemberID?.toString() || '',
      securityDetails: balance.securityDetails || '',
      securityValue: balance.securityValue?.toString() || ''
    });
    setIsEditing(true);
    setShowListModal(false);

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
          alert('खाते यशस्वीरित्या डिलीट झाले!');
          fetchBalances();
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
      'सभासद': `${b.member?.firstName || ''} ${b.member?.lastName || ''}`.trim(),
      'कर्ज प्रकार': `${b.loanRate?.loanCode || ''} - ${b.loanRate?.shortName || ''}`,
      'खाते क्र.': b.loanAccountNo,
      'जुना खाते क्र.': b.legacyAccountNumber || '-',
      'मंजूर रक्कम (₹)': b.sanctionedAmount,
      'मुद्दल बाकी (₹)': b.principalBalance,
      'व्याज बाकी (₹)': b.interestBalance
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LoanOpeningBalances');
    XLSX.writeFile(wb, `Loan_Opening_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const inputClass = "w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] h-[28px] bg-white";
  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";

  const memberOptions = members.map(m => ({ 
      value: m.memberID.toString(), 
      label: `${m.cifNo ? m.cifNo + ' - ' : ''}${m.firstName} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName}`
  }));

  const guarantorOptions = members.map(m => {
      const fullName = `${m.firstName} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName}`.trim();
      return {
          value: m.memberID.toString(),
          label: `${m.cifNo ? m.cifNo + ' - ' : ''}${fullName}`
      };
  });

  const loanRateOptions = loanRates.map(r => ({
      value: r.loanRateID.toString(),
      label: `${r.loanCode} - ${r.shortName || r.loanType}`
  }));

  // KPI Calculations
  const openingAccounts = allAccounts.filter((d: any) => d.isOpeningBalance === true);
  const totalSanctioned = openingAccounts.reduce((sum, a) => sum + (a.sanctionedAmount || 0), 0);
  const totalPrincipal = openingAccounts.reduce((sum, a) => sum + (a.principalBalance || 0), 0);
  const totalInterest = openingAccounts.reduce((sum, a) => sum + (a.interestBalance || 0), 0);

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
            <span>📋 नोंदवलेली यादी पहा ({openingAccounts.length})</span>
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
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">नोंदवलेली कर्ज खाती</div>
            <div className="text-sm font-black text-gray-900">{openingAccounts.length}</div>
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

      {/* Cut-off Date Info Banner */}
      <div className="bg-amber-50/80 border border-amber-300 p-2 rounded-sm text-[11px] text-amber-900 flex flex-wrap items-center justify-between gap-2 shadow-2xs mb-3">
        <div className="flex items-center gap-1.5 font-medium">
          <Calendar className="w-4 h-4 text-amber-700" />
          <span><strong>आरंभिक शिल्लक कट-ऑफ दिनांक मर्यादा:</strong> <span className="font-bold text-amber-950 font-mono">{new Date(cutoffDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span> {firstFyInfo ? `(पहिले आर्थिक वर्ष ${firstFyInfo.yearCode || ''} सुरू होण्याच्या आधीचा दिनांक)` : ''}</span>
        </div>
        <span className="text-[10px] text-amber-900 font-semibold bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
          ⚠️ कर्ज उचल दिनांक, शेवटचा हप्ता व बाकी दिनांक या कट-ऑफ दिनांकाच्या पुढील असणार नाहीत
        </span>
      </div>

      {/* Main Single Form Container */}
      <div ref={formContainerRef} className="flex flex-col lg:flex-row gap-3">
        
        {/* Left Form Section */}
        <div className="w-full lg:w-7/12">
          <form onSubmit={handleSubmit} className="space-y-2.5">
            
            {/* Section 1: Basic Info */}
            <div className={`p-3 rounded-sm shadow-xs border transition-all duration-300 ${
              isEditing ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'bg-white border-gray-200 border-t-2 border-primary'
            }`}>
              <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5 mb-2.5">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">१. प्राथमिक व सभासद माहिती (Basic Details)</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-x-2 gap-y-2.5">
                <div className="md:col-span-2">
                  <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                  <select name="branchID" value={formData.branchID} onChange={handleChange} className={inputClass} required disabled={isEditing}>
                    {branches.map(b => (
                      <option key={b.branchID} value={b.branchID.toString()}>{b.branchName}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className={labelClass}>सभासद (Member) <span className="text-red-500">*</span></label>
                  <SearchableSelect name="memberID" value={formData.memberID} onChange={handleChange} options={memberOptions} disabled={isEditing} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>कर्ज प्रकार (Loan Type) <span className="text-red-500">*</span></label>
                  <SearchableSelect name="loanRateID" value={formData.loanRateID} onChange={handleChange} options={loanRateOptions} disabled={isEditing} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>कर्ज खाते क्र. (Auto) <span className="text-red-500">*</span></label>
                  <input type="text" name="loanAccountNo" value={formData.loanAccountNo} readOnly className={`${inputClass} bg-slate-100 cursor-not-allowed font-bold text-primary`} placeholder="उदा. LN-00001" required />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>जुना कर्ज खाते क्र. (Old A/C)</label>
                  <input type="text" name="legacyAccountNumber" value={formData.legacyAccountNumber} onChange={handleChange} className={inputClass} placeholder="उदा. OLD-101" />
                </div>
              </div>
            </div>

            {/* Section 2: Loan Terms */}
            <div className="bg-white p-3 rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary">
              <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5 mb-2.5">
                <CreditCard className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">२. कर्ज व परतफेड माहिती (Loan Terms)</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-2.5 gap-y-2.5">
                <div>
                  <label className={labelClass}>कर्ज उचल दिनांक</label>
                  <input type="date" name="loanDisbursementDate" value={formData.loanDisbursementDate} onChange={handleChange} max={cutoffDate} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>कर्ज मंजूर रक्कम</label>
                  <input type="number" step="0.01" name="sanctionedAmount" value={formData.sanctionedAmount} onChange={handleChange} onFocus={(e) => e.target.select()} className={`${inputClass} font-bold text-gray-900`} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass}>व्याज दर (%)</label>
                  <input type="number" step="0.01" name="interestRate" value={formData.interestRate} onChange={handleChange} onFocus={(e) => e.target.select()} className={`${inputClass} font-bold text-gray-900`} placeholder="0.00" />
                </div>
                <div>
                  <label className={labelClass}>मुदत (महिने)</label>
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

            {/* Section 3: Outstanding Balances & Security */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                
                {/* Balances */}
                <div className="bg-primary/5 p-3 rounded-sm shadow-xs border border-primary/20">
                    <div className="flex items-center gap-1.5 border-b border-primary/20 pb-1.5 mb-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      <h2 className="text-xs font-bold text-primary">३. बाकी रक्कम (Outstanding Balances)</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={labelClass}>मुद्दल बाकी (Principal) <span className="text-red-500">*</span></label>
                            <input type="number" step="0.01" name="principalBalance" value={formData.principalBalance} onChange={handleChange} onFocus={(e) => e.target.select()} className={`${inputClass} font-bold text-emerald-800 ${isEditing ? 'bg-slate-100' : ''}`} placeholder="0.00" required disabled={isEditing} />
                        </div>
                        <div>
                            <label className={labelClass}>येणे व्याज बाकी (Interest)</label>
                            <input 
                              ref={interestBalanceInputRef}
                              type="number" 
                              step="0.01" 
                              name="interestBalance" 
                              value={formData.interestBalance} 
                              onChange={handleChange} 
                              onFocus={(e) => e.target.select()} 
                              className={`${inputClass} font-bold text-amber-800 ${isEditing ? 'border-primary bg-amber-50/40' : ''}`} 
                              placeholder="0.00" 
                            />
                        </div>
                        <div>
                            <label className={labelClass}>थकीत व्याज (Overdue Int)</label>
                            <input type="number" step="0.01" name="overdueInterestBalance" value={formData.overdueInterestBalance} onChange={handleChange} onFocus={(e) => e.target.select()} className={inputClass} placeholder="0.00" />
                        </div>
                        <div>
                            <label className={labelClass}>बाकी दिनांक (As of Date) <span className="text-red-500">*</span></label>
                            <input type="date" name="openingDate" value={formData.openingDate} onChange={handleChange} max={cutoffDate} className={`${inputClass} ${isEditing ? 'bg-slate-100' : ''}`} required disabled={isEditing} />
                        </div>
                    </div>
                </div>

                {/* Security & Guarantor */}
                <div className="bg-white p-3 rounded-sm shadow-xs border border-gray-200">
                    <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5 mb-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <h2 className="text-xs font-bold text-primary">४. तारण व जामीनदार (Guarantor & Security)</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
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
                </div>
            </div>

            {/* Form Footer Action Buttons */}
            <div className="pt-2 border-t border-gray-200 flex flex-wrap justify-end gap-2">
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

          </form>
        </div>

        {/* Right Side: Installment Chart Preview */}
        <div className="w-full lg:w-5/12 bg-white p-3 rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary flex flex-col h-[520px]">
          <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-2">
            <h2 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-primary" />
              <span>हप्ता चार्ट (Installment Chart)</span>
            </h2>
            <span className="text-[10px] text-gray-500 font-mono">
              हप्ते: {installmentChart.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto border border-gray-200 rounded-sm">
            <table className="min-w-full divide-y divide-gray-200 text-[10px] text-center">
              <thead className="bg-slate-100 sticky top-0 shadow-2xs font-bold text-gray-700">
                <tr>
                  <th className="px-1 py-1.5 border-r border-gray-200 w-8">क्र.</th>
                  <th className="px-1.5 py-1.5 border-r border-gray-200">हप्ता दिनांक</th>
                  <th className="px-1.5 py-1.5 border-r border-gray-200 text-right">मुद्दल (₹)</th>
                  <th className="px-1.5 py-1.5 border-r border-gray-200 text-right">व्याज (₹)</th>
                  <th className="px-1.5 py-1.5 border-r border-gray-200 text-right">एकूण (₹)</th>
                  <th className="px-1.5 py-1.5 text-right">बाकी शिल्लक (₹)</th>
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
                        <td className="px-1 py-1 border-r border-gray-200 font-mono">{row.no}</td>
                        <td className="px-1.5 py-1 border-r border-gray-200 font-mono">{row.date}</td>
                        <td className="px-1.5 py-1 border-r border-gray-200 text-right font-mono text-gray-800">{Math.round(row.principalValue || 0).toLocaleString('en-IN')}</td>
                        <td className="px-1.5 py-1 border-r border-gray-200 text-right text-rose-600 font-mono">{Math.round(parseFloat(row.interest) || 0).toLocaleString('en-IN')}</td>
                        <td className="px-1.5 py-1 border-r border-gray-200 text-right font-bold text-emerald-700 font-mono">{Math.round(parseFloat(row.total) || 0).toLocaleString('en-IN')}</td>
                        <td className="px-1.5 py-1 text-right text-gray-700 font-mono">{Math.round(parseFloat(row.balance) || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    );
                })}
                {installmentChart.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-12 text-center text-gray-400 font-medium">
                      कर्ज मंजूर रक्कम, मुदत आणि व्याज दर प्रविष्ट करा.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {installmentChart.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-gray-200 bg-slate-50 p-1.5 rounded-sm">
              <div className="text-center p-1 bg-white border border-slate-200 rounded-sm">
                <span className="block text-[9px] text-gray-500 font-bold uppercase">मुद्दल</span>
                <span className="text-[11px] font-bold text-gray-900 font-mono">
                  ₹{Math.round(installmentChart.reduce((acc, curr) => acc + (curr.principalValue || 0), 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-center p-1 bg-white border border-slate-200 rounded-sm">
                <span className="block text-[9px] text-gray-500 font-bold uppercase">व्याज</span>
                <span className="text-[11px] font-bold text-rose-700 font-mono">
                  ₹{Math.round(installmentChart.reduce((acc, curr) => acc + (parseFloat(curr.interest) || 0), 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="text-center p-1 bg-white border border-slate-200 rounded-sm">
                <span className="block text-[9px] text-gray-500 font-bold uppercase">एकूण</span>
                <span className="text-[11px] font-bold text-primary font-mono">
                  ₹{Math.round(installmentChart.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAllLoans(!showAllLoans)}
                  className={`px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs cursor-pointer border flex items-center gap-1 ${
                    showAllLoans 
                      ? 'bg-primary text-white border-primary hover:opacity-90' 
                      : 'bg-white text-primary border-primary hover:bg-primary/5'
                  }`}
                >
                  {showAllLoans ? '📋 फक्त बाकी कर्ज पहा' : '🔍 सर्व कर्ज खाती पहा'}
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
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">सभासद</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">कर्ज प्रकार</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">खाते क्र.</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-left">जुना खाते क्र.</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">मुद्दल बाकी (₹)</th>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-right">व्याज बाकी (₹)</th>
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
                          {balance.member?.firstName} {balance.member?.lastName}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-700">
                          {balance.loanRate?.loanCode} - {balance.loanRate?.shortName}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-gray-900 font-mono">
                          {balance.loanAccountNo}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-600 font-mono">
                          {balance.legacyAccountNumber || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-emerald-700 font-mono">
                          {balance.principalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-right font-bold text-amber-700 font-mono">
                          {balance.interestBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2 py-1.5 text-center font-mono text-gray-600">
                          {new Date(balance.openingDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                    {filteredBalances.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-10 text-center text-gray-400 font-bold">
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

    </div>
  );
}

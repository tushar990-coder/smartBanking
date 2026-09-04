import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Scale, FileText, Printer, CheckCircle, AlertTriangle, ShieldCheck, UserCheck, Calculator, ArrowRight, Search, RefreshCw } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface EligibleLoan {
  loanAccountID: number;
  branchID: number;
  branchName: string;
  loanAccountNo: string;
  memberID: number;
  memberName: string;
  memberCode: string;
  mobileNo: string;
  address: string;
  coMemberName?: string;
  coMember2Name?: string;
  loanScheme: string;
  principalBalance: number;
  interestBalance: number;
  overdueInterestBalance: number;
  totalOutstanding: number;
  openingDate: string;
}

interface FormMData {
  sanstha?: any;
  loanAccountID?: number;
  loanAccountNo?: string;
  branchName?: string;
  asOnDate?: string;
  borrower?: {
    memberID?: number;
    fullName?: string;
    memberCode?: string;
    address?: string;
    mobileNo?: string;
    aadhaarNo?: string;
    panNo?: string;
  };
  guarantor1?: {
    memberID?: number;
    fullName?: string;
    memberCode?: string;
    address?: string;
    mobileNo?: string;
  };
  guarantor2?: {
    memberID?: number;
    fullName?: string;
    memberCode?: string;
    address?: string;
    mobileNo?: string;
  };
  loanDetails?: {
    sanctionDate?: string;
    sanctionAmount?: number;
    interestRate?: number;
    penalRate?: number;
    schemeName?: string;
    principalBalance?: number;
    interestBalance?: number;
    penalInterestBalance?: number;
    legalExpenses?: number;
    totalDues?: number;
  };
  noticesCount?: number;
  notices?: any[];
}

export default function Sec101CaseFilingMaster() {
  const [loans, setLoans] = useState<EligibleLoan[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selected Loan & Form M Data
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [formM, setFormM] = useState<FormMData | null>(null);
  const [loadingFormM, setLoadingFormM] = useState<boolean>(false);

  // Editable Form 'M' Breakdown States
  const [borrowerName, setBorrowerName] = useState<string>('');
  const [borrowerCode, setBorrowerCode] = useState<string>('');
  const [borrowerAddress, setBorrowerAddress] = useState<string>('');
  const [borrowerMobile, setBorrowerMobile] = useState<string>('');
  const [loanAccountNo, setLoanAccountNo] = useState<string>('');
  const [schemeName, setSchemeName] = useState<string>('साधारण कर्ज योजना');
  
  const [principalClaim, setPrincipalClaim] = useState<number>(0);
  const [interestClaim, setInterestClaim] = useState<number>(0);
  const [penalInterestClaim, setPenalInterestClaim] = useState<number>(0);
  const [otherChargesClaim, setOtherChargesClaim] = useState<number>(0);
  const [interestRate, setInterestRate] = useState<number>(14.0);
  const [penalRate, setPenalRate] = useState<number>(2.0);

  // Case Filing Inputs
  const [caseNumber, setCaseNumber] = useState<string>('');
  const [courtName, setCourtName] = useState<string>('मा. सहाय्यक निबंधक, सहकारी संस्था');
  const [advocateName, setAdvocateName] = useState<string>('');
  const [filingDate, setFilingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [courtFeeAmount, setCourtFeeAmount] = useState<number>(0);
  const [courtFeeChallanNo, setCourtFeeChallanNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [filing, setFiling] = useState<boolean>(false);

  // Search Filter
  const [loanSearchTerm, setLoanSearchTerm] = useState<string>('');

  // Print Preview Modal
  const [showPetitionPrint, setShowPetitionPrint] = useState<boolean>(false);

  // Dynamic Theme Hook
  const getInitialTheme = () => {
    return document.documentElement.getAttribute('data-theme') || 
           localStorage.getItem('app-theme') || 
           'blue';
  };

  const [appTheme, setAppTheme] = useState(getInitialTheme);

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') || 
                      localStorage.getItem('app-theme') || 
                      'blue';
      setAppTheme(current);
    };

    window.addEventListener('storage', updateTheme);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTheme();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener('storage', updateTheme);
      observer.disconnect();
    };
  }, []);

  const getThemeConfig = () => {
    switch (appTheme) {
      case 'green':
        return {
          bannerGrad: 'from-emerald-950 via-[#0E8A5A] to-teal-900',
          btnPrimary: 'bg-[#0E8A5A] hover:bg-emerald-700 text-white',
          accentBorder: 'border-emerald-500 bg-emerald-50 text-emerald-950',
          badgeText: 'text-emerald-800 bg-emerald-100',
          highlightText: 'text-emerald-700'
        };
      case 'wine-red':
        return {
          bannerGrad: 'from-[#380413] via-[#880E4F] to-[#4c0519]',
          btnPrimary: 'bg-[#880E4F] hover:bg-rose-900 text-white',
          accentBorder: 'border-rose-500 bg-rose-50 text-rose-950',
          badgeText: 'text-rose-800 bg-rose-100',
          highlightText: 'text-rose-700'
        };
      case 'blue':
      default:
        return {
          bannerGrad: 'from-slate-950 via-[#005689] to-blue-900',
          btnPrimary: 'bg-[#005689] hover:bg-blue-800 text-white',
          accentBorder: 'border-blue-500 bg-blue-50 text-blue-950',
          badgeText: 'text-blue-800 bg-blue-100',
          highlightText: 'text-blue-700'
        };
    }
  };

  const theme = getThemeConfig();

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchEligibleLoans();
  }, [selectedBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      if (res.data) setBranches(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEligibleLoans = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/LegalRecovery/eligible-loans?branchId=${selectedBranchId}`);
      if (res.data) {
        const data: EligibleLoan[] = res.data;
        setLoans(data);
        if (data.length > 0 && !selectedLoanId) {
          handleSelectLoan(data[0].loanAccountID, data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLoan = async (loanId: number, fallbackLoanObj?: EligibleLoan) => {
    setSelectedLoanId(loanId);
    setLoadingFormM(true);

    const loanObj = fallbackLoanObj || loans.find((l) => l.loanAccountID === loanId);
    if (loanObj) {
      setBorrowerName(loanObj.memberName || '');
      setBorrowerCode(loanObj.memberCode || '');
      setBorrowerAddress(loanObj.address || '');
      setBorrowerMobile(loanObj.mobileNo || '');
      setLoanAccountNo(loanObj.loanAccountNo || '');
      setSchemeName(loanObj.loanScheme || 'कर्ज योजना');
      setPrincipalClaim(loanObj.principalBalance || 0);
      setInterestClaim(loanObj.interestBalance || 0);
      setPenalInterestClaim(loanObj.overdueInterestBalance || 0);
      const year = new Date().getFullYear();
      setCaseNumber(`१०१/${year}/${loanObj.loanAccountNo}`);
    }

    try {
      const res = await axios.get(`/api/LegalRecovery/form-m/${loanId}`);
      if (res.data) {
        const data = res.data;
        setFormM(data);
        if (data.borrower?.fullName) setBorrowerName(data.borrower.fullName);
        if (data.borrower?.memberCode) setBorrowerCode(data.borrower.memberCode);
        if (data.borrower?.address) setBorrowerAddress(data.borrower.address);
        if (data.borrower?.mobileNo) setBorrowerMobile(data.borrower.mobileNo);
        if (data.loanAccountNo) setLoanAccountNo(data.loanAccountNo);
        if (data.loanDetails) {
          setPrincipalClaim(data.loanDetails.principalBalance || 0);
          setInterestClaim(data.loanDetails.interestBalance || 0);
          setPenalInterestClaim(data.loanDetails.penalInterestBalance || 0);
          setOtherChargesClaim(data.loanDetails.legalExpenses || 0);
          setInterestRate(data.loanDetails.interestRate || 14.0);
          setPenalRate(data.loanDetails.penalRate || 2.0);
          setSchemeName(data.loanDetails.schemeName || 'कर्ज योजना');
        }
        const year = new Date().getFullYear();
        setCaseNumber(`१०१/${year}/${data.loanAccountNo || loanObj?.loanAccountNo}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFormM(false);
    }
  };

  const calculatedTotalClaim = Number(principalClaim || 0) + Number(interestClaim || 0) + Number(penalInterestClaim || 0) + Number(otherChargesClaim || 0);

  const handleFileCase = async () => {
    if (!selectedLoanId && !loanAccountNo) {
      alert('कृपया प्रथम कर्जदार खाते निवडा किंवा खाते क्रमांक प्रविष्ट करा.');
      return;
    }

    if (!caseNumber.trim()) {
      alert('कृपया दावा क्रमांक (Case Number) प्रविष्ट करा.');
      return;
    }

    setFiling(true);
    try {
      const res = await axios.post('/api/LegalRecovery/case/file', {
        branchId: selectedBranchId,
        loanAccountId: selectedLoanId || 1,
        caseNumber,
        courtName,
        advocateName,
        filingDate,
        principalClaim: Number(principalClaim) || 0,
        interestClaim: Number(interestClaim) || 0,
        penalInterestClaim: Number(penalInterestClaim) || 0,
        otherChargesClaim: Number(otherChargesClaim) || 0,
        courtFeeAmount: Number(courtFeeAmount) || 0,
        courtFeeChallanNo,
        remarks
      });

      if (res.status === 200) {
        const result = res.data;
        alert(`कलम १०१ दावा अर्ज यशस्वीरीत्या दाखल झाला!\nदावा क्र.: ${result.caseNumber || caseNumber}`);
        setShowPetitionPrint(true);
      } else {
        alert('दावा दाखल करताना त्रुटी आली.');
      }
    } catch (e: any) {
      console.error(e);
      alert('दावा दाखल करताना त्रुटी आली: ' + (e.response?.data?.message || e.message));
    } finally {
      setFiling(false);
    }
  };

  const filteredLoans = loans.filter((l) =>
    l.memberName?.toLowerCase().includes(loanSearchTerm.toLowerCase()) ||
    l.loanAccountNo?.toLowerCase().includes(loanSearchTerm.toLowerCase()) ||
    l.memberCode?.toLowerCase().includes(loanSearchTerm.toLowerCase())
  );

  const loanSelectOptions = loans.map((l) => ({
    value: l.loanAccountID,
    label: `${l.loanAccountNo} - ${l.memberName} (थकबाकी: ₹${l.totalOutstanding.toLocaleString('en-IN')})`
  }));

  return (
    <div className="p-3 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans space-y-3">
      {/* Header Banner */}
      <div className={`bg-gradient-to-r ${theme.bannerGrad} text-white p-4 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3`}>
        <div>
          <div className="flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-amber-300" />
            <h1 className="text-base font-bold tracking-wide">कलम १०१ दावा अर्ज व Form 'M' तक्ता (Sec 101 Case Filing & Statement)</h1>
          </div>
          <p className="text-white/80 text-[11px] mt-0.5">
            मा. सहाय्यक/उपनिबंधक कोर्टासाठी अधिकृत मराठी दावा अर्ज दाखल करणे, Form 'M' वैधानिक थकबाकी तक्ता व कोर्ट फी ऑटो-व्हाउचर.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={() => setShowPetitionPrint(true)}
          className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
        >
          <Printer className="w-3.5 h-3.5 text-amber-300" /> दावा अर्ज प्रिंट पूर्वावलोकन
        </button>
      </div>

      {/* Top Search & Branch Selector Bar */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-gray-700 whitespace-nowrap">शाखा:</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-800 bg-white"
            >
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 max-w-lg">
            <SearchableSelect
              options={loanSelectOptions}
              value={selectedLoanId || 0}
              onChange={(e) => handleSelectLoan(Number(e.target.value))}
              placeholder="🔍 कर्जदार खाते किंवा नाव शोधा / निवडा..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEligibleLoans}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md border"
            title="रिफ्रेश करा"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-gray-500 font-medium">
            एकूण थकबाकीदार खाती: <strong>{loans.length}</strong>
          </span>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Quick Select Loan List (4 Cols) */}
        <div className="lg:col-span-4 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs space-y-2.5">
          <div className="flex justify-between items-center border-b pb-2">
            <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              थकबाकीदार कर्ज खाती ({loans.length})
            </h2>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="नाव / खाते क्र. शोधा..."
              value={loanSearchTerm}
              onChange={(e) => setLoanSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md pl-7 pr-2 py-1 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
          </div>

          <div className="max-h-[520px] overflow-y-auto space-y-1.5 pr-1">
            {filteredLoans.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                {loading ? 'खाती लोड होत आहेत...' : 'कोणतीही खाती आढळली नाहीत.'}
              </div>
            ) : (
              filteredLoans.map((loan) => {
                const isSelected = selectedLoanId === loan.loanAccountID;
                return (
                  <div
                    key={loan.loanAccountID}
                    onClick={() => handleSelectLoan(loan.loanAccountID, loan)}
                    className={`p-2 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? `${theme.accentBorder} shadow-xs font-bold`
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-xs text-gray-900">{loan.memberName}</div>
                        <div className="text-[10px] text-gray-500 font-mono">खाते: {loan.loanAccountNo} | कोड: {loan.memberCode}</div>
                      </div>
                      <span className={`text-[10px] font-bold ${theme.badgeText} px-1.5 py-0.2 rounded`}>
                        ₹{loan.totalOutstanding.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Form 'M' Breakdown & Case Filing Form (8 Cols) - ALWAYS VISIBLE */}
        <div className="lg:col-span-8 space-y-3.5">
          {/* Section 1: Borrower & Loan Master Details */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className={`text-[10px] font-bold ${theme.badgeText} px-2 py-0.5 rounded uppercase`}>
                १. कर्जदार व खात्याची माहिती (Borrower Details)
              </span>
              {loadingFormM && <span className="text-[10px] text-amber-600 font-bold animate-pulse">डेटा लोड होत आहे...</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-700">कर्जदाराचे नाव (Borrower Name):</label>
                <input
                  type="text"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  placeholder="श्री/श्रीमती..."
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-bold text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-700">कर्ज खाते क्र. (Loan Account No):</label>
                <input
                  type="text"
                  value={loanAccountNo}
                  onChange={(e) => setLoanAccountNo(e.target.value)}
                  placeholder="उदा. LA-00123"
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-bold text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-700">मोबाईल क्र. (Mobile No):</label>
                <input
                  type="text"
                  value={borrowerMobile}
                  onChange={(e) => setBorrowerMobile(e.target.value)}
                  placeholder="९८xxxxxxxx"
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-700">कर्जदाराचा संपूर्ण पत्ता (Address):</label>
              <input
                type="text"
                value={borrowerAddress}
                onChange={(e) => setBorrowerAddress(e.target.value)}
                placeholder="घर नं., मु.पो., ता., जि...."
                className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800 bg-white"
              />
            </div>
          </div>

          {/* Section 2: Form 'M' Statement of Dues (थकबाकी तक्ता) */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className={`text-[10px] font-bold ${theme.badgeText} px-2 py-0.5 rounded uppercase`}>
                २. Form 'M' वैधानिक थकबाकी तक्ता (Statement of Dues)
              </span>
              <span className="text-[10px] text-gray-500">रक्कम बदलल्यास एकूण आपोआप गणली जाईल</span>
            </div>

            {/* Dues Inputs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div>
                <label className="text-[10px] font-bold text-gray-700">१. थकीत मुद्दल (Principal ₹):</label>
                <input
                  type="number"
                  value={principalClaim}
                  onChange={(e) => setPrincipalClaim(Number(e.target.value))}
                  className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-700">२. नियमित व्याज (Interest ₹):</label>
                <input
                  type="number"
                  value={interestClaim}
                  onChange={(e) => setInterestClaim(Number(e.target.value))}
                  className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-700">३. दंडव्याज (Penal ₹):</label>
                <input
                  type="number"
                  value={penalInterestClaim}
                  onChange={(e) => setPenalInterestClaim(Number(e.target.value))}
                  className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-700">४. नोटीस / कायदेशीर खर्च (₹):</label>
                <input
                  type="number"
                  value={otherChargesClaim}
                  onChange={(e) => setOtherChargesClaim(Number(e.target.value))}
                  className="w-full mt-0.5 border rounded-md px-2 py-1 text-xs font-bold text-gray-900 bg-white"
                />
              </div>
            </div>

            {/* Total Claim Highlight Banner */}
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex justify-between items-center">
              <div>
                <div className="text-[11px] font-black text-blue-950 uppercase">एकूण दावा मागणी रक्कम (Total Claim Amount):</div>
                <div className="text-[10px] text-blue-700">मुद्दल + व्याज + दंडव्याज + कायदेशीर खर्च</div>
              </div>
              <div className="text-xl font-black text-blue-900">
                ₹{calculatedTotalClaim.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Section 3: Case Filing Inputs (निबंधक कोर्ट दावा तपशील) */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="border-b pb-2">
              <span className={`text-[10px] font-bold ${theme.badgeText} px-2 py-0.5 rounded uppercase`}>
                ३. निबंधक कोर्ट दावा तपशील व कोर्ट फी (Case Filing & Court Fees)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700">दावा क्रमांक (Case No.):</label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="उदा. १०१/२०२६/पुणे"
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-bold text-gray-900"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700">न्यायालयाचे नाव (Court Name):</label>
                <input
                  type="text"
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700">वकिलाचे नाव (Advocate Name):</label>
                <input
                  type="text"
                  value={advocateName}
                  onChange={(e) => setAdvocateName(e.target.value)}
                  placeholder="ॲड. श्री..."
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700">दाखल तारीख (Filing Date):</label>
                <input
                  type="date"
                  value={filingDate}
                  onChange={(e) => setFilingDate(e.target.value)}
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700">कोर्ट फी रक्कम (Court Fee ₹):</label>
                <input
                  type="number"
                  value={courtFeeAmount}
                  onChange={(e) => setCourtFeeAmount(Number(e.target.value))}
                  placeholder="₹ भरलेली कोर्ट फी"
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-bold text-rose-700"
                />
                <span className="text-[9px] text-gray-400">डायनॅमिक लेजरनुसार आपोआप व्हाउचर पोस्ट होईल</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700">कोर्ट फी शासकीय चलन क्र.:</label>
                <input
                  type="text"
                  value={courtFeeChallanNo}
                  onChange={(e) => setCourtFeeChallanNo(e.target.value)}
                  placeholder="GRAS / Challan No."
                  className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-700">शेरा / तपशील (Remarks):</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="उदा. सर्व कागदपत्रे व नोटिसांसह दावा दाखल केला"
                className="w-full mt-0.5 border border-gray-300 rounded-md px-2.5 py-1.5 text-xs text-gray-800"
              />
            </div>

            <button
              onClick={handleFileCase}
              disabled={filing}
              className={`w-full py-2.5 rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${theme.btnPrimary}`}
            >
              {filing ? 'दावा दाखल होत आहे...' : 'कलम १०१ दावा अर्ज दाखल करा व सेव्ह करा (Submit Case Filing)'}
            </button>
          </div>
        </div>
      </div>

      {/* Official Marathi Petition Print Modal */}
      {showPetitionPrint && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 shadow-2xl space-y-6">
            <div className="text-center font-bold text-sm text-slate-900 border-b-2 border-slate-900 pb-3 space-y-1">
              <p className="text-base font-extrabold uppercase">
                {courtName || 'मा. सहाय्यक निबंधक, सहकारी संस्था यांचेकडे'}
              </p>
              <p className="text-xs text-slate-600">
                महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम १०१ अन्वये वसुली दाखला मिळणेबाबतचा दावा अर्ज
              </p>
            </div>

            <div className="flex justify-between text-xs font-bold text-slate-800">
              <div>दावा अर्ज क्र.: {caseNumber || '१०१/२०२६'}</div>
              <div>दाखल तारीख: {filingDate}</div>
            </div>

            {/* Parties */}
            <div className="text-xs text-slate-800 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <strong>अर्जदार (Applicant):</strong><br />
                {formM?.sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}<br />
                पत्ता: {formM?.sanstha?.address || 'मुख्य कार्यालय'}
              </div>
              <div className="text-center font-bold text-slate-400">-- विरुद्ध --</div>
              <div>
                <strong>गैरअर्जदार क्र. १ (मुख्य कर्जदार):</strong><br />
                {borrowerName || 'कर्जदार नाव'} (सभासद क्र.: {borrowerCode || '-'})<br />
                पत्ता: {borrowerAddress} | मो.: {borrowerMobile}
              </div>
              {formM?.guarantor1 && (
                <div>
                  <strong>गैरअर्जदार क्र. २ (जामीनदार क्र. १):</strong><br />
                  {formM.guarantor1.fullName} | पत्ता: {formM.guarantor1.address}
                </div>
              )}
              {formM?.guarantor2 && (
                <div>
                  <strong>गैरअर्जदार क्र. ३ (जामीनदार क्र. २):</strong><br />
                  {formM.guarantor2.fullName} | पत्ता: {formM.guarantor2.address}
                </div>
              )}
            </div>

            {/* Petition Content */}
            <div className="text-xs text-slate-800 space-y-3 leading-relaxed text-justify">
              <p><strong>अर्जदार संस्थेचा सविनय अर्ज खालीलप्रमाणे आहे:</strong></p>
              <p>
                १. अर्जदार ही एक नोंदणीकृत सहकारी पतसंस्था असून गैरअर्जदार क्र. १ हे संस्थेचे सभासद आहेत. गैरअर्जदार क्र. १ यांनी संस्थेकडून खाते क्र. <strong>{loanAccountNo}</strong> अन्वये कर्ज घेतले होते.
              </p>
              <p>
                २. गैरअर्जदारांनी कर्जाची नियमित परतफेड न केल्यामुळे त्यांना वारंवार कायदेशीर नोटिसा देण्यात आल्या. परंतु त्यांनी मुदतीत रकमेचा भरणा केला नाही.
              </p>
              <p>
                ३. <strong>थकबाकी विवरण (Form 'M' Statement of Dues):</strong>
              </p>

              <table className="w-full border text-xs border-slate-300">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border p-2">अ.क्र.</th>
                    <th className="border p-2">तपशील</th>
                    <th className="border p-2 text-right">रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2 text-center">१</td>
                    <td className="border p-2">थकीत मुद्दल रक्कम (Principal Dues)</td>
                    <td className="border p-2 text-right">₹{Number(principalClaim || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center">२</td>
                    <td className="border p-2">थकीत नियमित व्याज (Interest @ {interestRate}%)</td>
                    <td className="border p-2 text-right">₹{Number(interestClaim || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center">३</td>
                    <td className="border p-2">दंडव्याज (Penal Interest @ {penalRate}%)</td>
                    <td className="border p-2 text-right">₹{Number(penalInterestClaim || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 text-center">४</td>
                    <td className="border p-2">नोटीस व कायदेशीर खर्च (Legal/Notice Charges)</td>
                    <td className="border p-2 text-right">₹{Number(otherChargesClaim || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-blue-50 font-bold text-blue-900 text-sm">
                    <td className="border p-2 text-center" colSpan={2}>एकूण दावा वसुली रक्कम (Total Claim Amount)</td>
                    <td className="border p-2 text-right">₹{calculatedTotalClaim.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>

              <p><strong>४. मागणी (Prayer):</strong></p>
              <p>
                अ) गैरअर्जदार यांचेकडून अर्जदार संस्थेस एकूण दावा रक्कम ₹{calculatedTotalClaim.toLocaleString('en-IN')} व दावा दाखल दिनांकापासून प्रत्यक्ष वसुली होईपर्यंतचे चालू व्याज मिळण्याचा <strong>महाराष्ट्र सहकारी संस्था अधिनियम १९६० चे कलम १०१ अन्वये वसुली दाखला (Recovery Certificate)</strong> मंजूर करण्यात यावा.
              </p>
              <p>
                ब) सदर दाव्याचा संपूर्ण कोर्ट फी (₹{courtFeeAmount}) व कायदेशीर खर्च गैरअर्जदारांवर आकारण्यात यावा.
              </p>
            </div>

            {/* Signature */}
            <div className="flex justify-between items-end pt-8 text-xs font-bold text-slate-900">
              <div>
                <p>ॲडव्होकेट: {advocateName || 'संस्थेचे कायदेशीर सल्लागार'}</p>
              </div>
              <div className="text-center space-y-6">
                <p>अर्जदार संस्थेतर्फे</p>
                <p>शाखा व्यवस्थापक / मुख्य कार्यकारी अधिकारी<br />{formM?.sanstha?.sansthaName || 'सहकारी पतसंस्था'}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" /> अधिकृत दावा अर्ज प्रिंट करा (Print Petition)
              </button>
              <button
                onClick={() => setShowPetitionPrint(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-5 py-2 rounded-xl font-bold text-xs"
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

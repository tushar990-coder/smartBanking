import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Building2, 
  Calendar, 
  RefreshCw, 
  Save, 
  Lock, 
  FileSpreadsheet, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  TrendingUp, 
  Landmark, 
  Users, 
  Coins, 
  FileText, 
  Check, 
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';

interface SansthaInfo {
  sansthaName: string;
  registrationNo: string;
  registrationDate: string;
  address: string;
  contactNo: string;
  email: string;
}

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '0.00';
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtInt = (n: number | null | undefined): string => {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return Math.round(Number(n)).toLocaleString('en-IN');
};

export default function RegulatoryMisReport() {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [financialYear, setFinancialYear] = useState<string>('2025-2026');
  const [asOnDate, setAsOnDate] = useState<string>(
    new Date().getFullYear() + '-03-31'
  );
  const [branchId, setBranchId] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [reportId, setReportId] = useState<number | null>(null);

  const [sansthaInfo, setSansthaInfo] = useState<SansthaInfo>({
    sansthaName: 'श्री गणेश नागरी सहकारी पतसंस्था मर्यादित',
    registrationNo: 'BHR/PNA/O-1234/2010',
    registrationDate: '2010-04-15',
    address: 'मुख्य रस्ता, तालुका व जिल्हा - पुणे',
    contactNo: '020-12345678',
    email: 'info@patsanstha.org'
  });

  // 1. General Info
  const [generalInfo, setGeneralInfo] = useState<any>({
    branchCount: 1,
    regularMembers: 0,
    nominalMembers: 0,
    totalMembers: 0,
    kycCount: 0,
    kycPercentage: 100,
    currentManagement: 'संचालक मंडळ',
    chairmanName: '',
    chairmanMobile: '',
    viceChairmanName: '',
    viceChairmanMobile: '',
    managerName: '',
    managerMobile: '',
    authorizedOfficerName: '',
    authorizedOfficerMobile: '',
    electionDate: '2023-06-15',
    auditYear: '2024-25',
    auditClass: 'A',
    officersCount: 2,
    staffCount: 5,
    totalManpower: 7,
    trainedDirectors: 5,
    trainedStaff: 4,
    trainedMembers: 120,
    modelByLawsAccepted: true,
    modelByLawsDate: '2020-04-01',
    isDailyTransactionsComputerized: true,
    isCbsFunctional: true,
    softwareVendorName: 'SmartBanking CBS',
    hasUcid: true
  });

  // 2. Capital & Deposits
  const [capitalDeposits, setCapitalDeposits] = useState<any>({
    paidUpCapital: 0,
    workingCapital: 0,
    reserveFund: 0,
    buildingFund: 0,
    bddrFund: 0,
    otherFunds: 0,
    deposits: {
      fdAmount: 0,
      savingAmount: 0,
      currentAmount: 0,
      pigmyAmount: 0,
      rdAmount: 0,
      totalDeposits: 0
    },
    depositors: {
      regularDepositorsCount: 0,
      regularDepositorsAmount: 0,
      nominalDepositorsCount: 0,
      nominalDepositorsAmount: 0,
      totalDepositorsCount: 0,
      totalDepositorsAmount: 0
    },
    slabs: {
      slab1: { label: 'रु. १,००,००० पर्यंत', count: 0, amount: 0 },
      slab2: { label: 'रु. १,००,००१ ते २,००,०००', count: 0, amount: 0 },
      slab3: { label: 'रु. २,००,००१ ते ३,००,०००', count: 0, amount: 0 },
      slab4: { label: 'रु. ३,००,००१ ते ४,००,०००', count: 0, amount: 0 },
      slab5: { label: 'रु. ४,००,००१ ते ५,००,०००', count: 0, amount: 0 },
      slab6: { label: 'रु. ५,००,००० पेक्षा जास्त', count: 0, amount: 0 }
    },
    externalBorrowings: 0,
    accumulatedLoss: 0,
    svanidhi: 0,
    borrowingLimit: 0,
    actualLiability: 0,
    isWithinBorrowingLimit: true
  });

  // 3. Loans & Recovery
  const [loansRecovery, setLoansRecovery] = useState<any>({
    regularBorrowersCount: 0,
    regularBorrowersAmount: 0,
    nominalBorrowersCount: 0,
    nominalBorrowersAmount: 0,
    totalLoansCount: 0,
    totalLoansAmount: 0,
    overdueAmount: 0,
    overduePercentage: 0,
    sec101: {
      eligibleCount: 0,
      eligibleAmount: 0,
      filedCount: 0,
      filedAmount: 0,
      obtainedCount: 0,
      obtainedAmount: 0
    },
    sec91: {
      eligibleCount: 0,
      eligibleAmount: 0,
      filedCount: 0,
      filedAmount: 0,
      obtainedCount: 0,
      obtainedAmount: 0
    },
    execution: {
      executedCount: 0,
      executedAmount: 0,
      pendingCount: 0,
      pendingAmount: 0
    },
    securedLoansAmount: 0,
    securedLoansPercentage: 0,
    unsecuredLoansAmount: 0,
    unsecuredLoansPercentage: 0
  });

  // 4. Investments
  const [investments, setInvestments] = useState<any>({
    cashInHand: 0,
    bankSavings: 0,
    shortTermDeposits: 0,
    bankOd: 0,
    bankCurrent: 0,
    reserveFundInvestments: 0,
    buildingFundInvestments: 0,
    institutions: {
      mscBank: 0,
      dccBank: 0,
      urbanBanks: 0,
      nationalizedBanks: 0,
      rrbBanks: 0,
      privateBanks: 0,
      otherInstitutions: 0,
      fixedAssets: 0
    }
  });

  // 5. Financial Ratios
  const [financialRatios, setFinancialRatios] = useState<any>({
    crr: 0,
    slr: 0,
    cdRatio: 0,
    crar: 0,
    establishmentCostPercent: 2.15,
    grossNpa: 0,
    netNpa: 0,
    npaProvisionRequired: 0,
    npaProvisionMade: 0,
    maxDepositRate: 9.5,
    securedLoanRate: 12.0,
    unsecuredLoanRate: 14.5,
    netProfitToWorkingCapital: 1.85,
    netProfit: 0,
    netLoss: 0
  });

  // 6. Contribution
  const [contribution, setContribution] = useState<any>({
    financialYear: '2025-26',
    crrValue: 0,
    isCrrEligible: true,
    slrValue: 0,
    isSlrEligible: true,
    auditHistory: [
      { year: '2024-25', isCompleted: true, certificateName: 'Audit_2024-25.pdf' },
      { year: '2023-24', isCompleted: true, certificateName: 'Audit_2023-24.pdf' },
      { year: '2022-23', isCompleted: true, certificateName: 'Audit_2022-23.pdf' }
    ],
    modelByLawsDate: '2020-04-01',
    isEligible: true,
    totalDepositsMarch31: 0,
    ratePerHundred: '१० पैसे प्रति १०० रुपये (०.१%)',
    contributionPayableAmount: 0,
    paymentStatus: 'प्रलंबित (Pending)',
    challanUtrNo: '',
    paymentDate: ''
  });

  // 7. Other Info
  const [other, setOther] = useState<any>({
    otherBusiness: 'काही नाही (केवळ पतसंस्था ठेवी व कर्जवाटप व्यवसाय)',
    tradingDetails: 'लागू नाही',
    unnecessaryProperty: 'काही नाही',
    propertyNature: '-',
    propertyAcquisitionYear: '-',
    isDeclared: false,
    declarationDate: new Date().toISOString().split('T')[0],
    signatoryName: '',
    signatoryDesignation: 'मुख्य कार्यकारी अधिकारी / व्यवस्थापक'
  });

  // Load Sanstha Details on mount
  useEffect(() => {
    fetchSansthaDetails();
    fetchAutoCompute();
  }, [financialYear]);

  const fetchSansthaDetails = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data) {
        setSansthaInfo({
          sansthaName: res.data.sansthaName || res.data.name || 'पतसंस्था मर्यादित',
          registrationNo: res.data.registrationNo || res.data.regNo || '',
          registrationDate: res.data.registrationDate ? res.data.registrationDate.substring(0, 10) : '',
          address: res.data.address || '',
          contactNo: res.data.contactNo || res.data.phone || '',
          email: res.data.email || ''
        });
      }
    } catch {
      // Ignore fallback
    }
  };

  const fetchAutoCompute = async () => {
    setLoading(true);
    try {
      // First check if there is an existing saved report
      try {
        const savedRes = await axios.get('/api/RegulatoryMis/SavedReport', {
          params: { financialYear, branchId }
        });
        if (savedRes.data) {
          const report = savedRes.data;
          setReportId(report.misReportID || report.MisReportID);
          setIsLocked(!!(report.isLocked || report.IsLocked));

          if (report.generalInfoJson || report.GeneralInfoJson) {
            setGeneralInfo(JSON.parse(report.generalInfoJson || report.GeneralInfoJson));
          }
          if (report.capitalDepositsJson || report.CapitalDepositsJson) {
            setCapitalDeposits(JSON.parse(report.capitalDepositsJson || report.CapitalDepositsJson));
          }
          if (report.loansRecoveryJson || report.LoansRecoveryJson) {
            setLoansRecovery(JSON.parse(report.loansRecoveryJson || report.LoansRecoveryJson));
          }
          if (report.investmentsJson || report.InvestmentsJson) {
            setInvestments(JSON.parse(report.investmentsJson || report.InvestmentsJson));
          }
          if (report.financialRatiosJson || report.FinancialRatiosJson) {
            setFinancialRatios(JSON.parse(report.financialRatiosJson || report.FinancialRatiosJson));
          }
          if (report.contributionJson || report.ContributionJson) {
            setContribution(JSON.parse(report.contributionJson || report.ContributionJson));
          }
          if (report.otherInfoJson || report.OtherInfoJson) {
            setOther(JSON.parse(report.otherInfoJson || report.OtherInfoJson));
          }

          toast.success(`आर्थिक वर्ष ${financialYear} चा सेव्ह केलेला डेटा लोड झाला.`);
          setLoading(false);
          return;
        }
      } catch {
        // No saved report found, proceed to auto-compute
      }

      // Auto compute fresh from CBS
      const res = await axios.get('/api/RegulatoryMis/AutoCompute', {
        params: { asOnDate, branchId }
      });

      if (res.data) {
        if (res.data.generalInfo) setGeneralInfo(res.data.generalInfo);
        if (res.data.capitalDeposits) setCapitalDeposits(res.data.capitalDeposits);
        if (res.data.loansRecovery) setLoansRecovery(res.data.loansRecovery);
        if (res.data.investments) setInvestments(res.data.investments);
        if (res.data.financialRatios) setFinancialRatios(res.data.financialRatios);
        if (res.data.contribution) setContribution(res.data.contribution);
        if (res.data.other) setOther((prev: any) => ({ ...prev, ...res.data.other }));
        
        toast.success('CBS सिस्टीममधून सर्व माहिती अचूक स्वयंचलित गणन केली.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('माहिती लोड करताना अडचण आली: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (isLocked) {
      toast.error('सदर अहवाल लॉक केलेला असल्याने बदल सेव्ह करता येणार नाही.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        misReportID: reportId,
        financialYear,
        branchId,
        asOnDate,
        generalInfo,
        capitalDeposits,
        loansRecovery,
        investments,
        financialRatios,
        contribution,
        other,
        isLocked: false
      };

      const res = await axios.post('/api/RegulatoryMis/SaveReport', payload);
      if (res.data && res.data.misReportId) {
        setReportId(res.data.misReportId);
      }
      toast.success('अहवाल मसुदा यशस्वीरीत्या जतन (Save) झाला!');
    } catch (err: any) {
      console.error(err);
      toast.error('जतन करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleLockReport = async () => {
    if (!reportId) {
      toast.error('कृपया अहवाल लॉक करण्यापूर्वी एकदा सेव्ह करा.');
      return;
    }
    if (!other.isDeclared) {
      toast.error('कृपया टॅब ७ मधील स्वयंघोषणा चेकबॉक्सवर खूण करा.');
      return;
    }
    if (!window.confirm('तुम्हाला खात्री आहे का? अहवाल लॉक केल्यानंतर पोर्टलवर सबमिशनसाठी अंतिम होईल व यात फेरबदल करता येणार नाहीत.')) {
      return;
    }

    try {
      await axios.post(`/api/RegulatoryMis/LockReport/${reportId}`);
      setIsLocked(true);
      toast.success('अहवाल अंतिम लॉक (Locked) झाला!');
    } catch (err: any) {
      toast.error('लॉक करताना त्रुटी: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['महाराष्ट्र राज्य बिगर कृषी सहकारी पतसंस्था नियामक मंडळ, पुणे'],
      ['पोर्टल: https://www.patsansthaniyamakmandal.in | वार्षिक MIS अहवाल'],
      ['संस्थेचे नाव:', sansthaInfo.sansthaName],
      ['नोंदणी क्रमांक:', sansthaInfo.registrationNo, 'नोंदणी दिनांक:', sansthaInfo.registrationDate],
      ['आर्थिक वर्ष:', financialYear, 'अखेर दिनांक:', asOnDate],
      [''],
      ['विभाग क्रमांक', 'विभागाचे नाव (Section Name)', 'प्रमुख घटक', 'रक्कम / आकडेवारी'],
      ['विभाग १', 'सर्वसाधारण माहिती', 'एकूण सभासद संख्या', generalInfo.totalMembers],
      ['विभाग १', 'सर्वसाधारण माहिती', 'केवायसी पूर्ण प्रमाण (%)', `${generalInfo.kycPercentage}%`],
      ['विभाग १', 'सर्वसाधारण माहिती', 'मागील लेखापरीक्षण वर्ग', generalInfo.auditClass],
      ['विभाग २', 'भांडवल व ठेवी', 'वसूल भागभांडवल (रु.)', capitalDeposits.paidUpCapital],
      ['विभाग २', 'भांडवल व ठेवी', 'राखीव व इमारत निधी (रु.)', capitalDeposits.reserveFund + capitalDeposits.buildingFund],
      ['विभाग २', 'भांडवल व ठेवी', 'स्वनिधी (Owned Funds) (रु.)', capitalDeposits.svanidhi],
      ['विभाग २', 'भांडवल व ठेवी', '१२ पट कमाल उचल मर्यादा (रु.)', capitalDeposits.borrowingLimit],
      ['विभाग २', 'भांडवल व ठेवी', 'एकूण ठेवी (रु.)', capitalDeposits.deposits?.totalDeposits],
      ['विभाग ३', 'कर्ज व वसुली', 'एकूण येणे कर्ज बाकी (रु.)', loansRecovery.totalLoansAmount],
      ['विभाग ३', 'कर्ज व वसुली', 'एकूण थकबाकी (रु.)', loansRecovery.overdueAmount],
      ['विभाग ३', 'कर्ज व वसुली', 'थकबाकी प्रमाण (%)', `${loansRecovery.overduePercentage}%`],
      ['विभाग ४', 'गुंतवणूक', 'रोख शिल्लक (Cash in Hand) (रु.)', investments.cashInHand],
      ['विभाग ४', 'गुंतवणूक', 'बँक चालू/बचत खाती शिल्लक (रु.)', investments.bankSavings + investments.bankCurrent],
      ['विभाग ५', 'आर्थिक मापदंड', 'CRR रोख तरलता प्रमाण (%)', `${financialRatios.crr}%`],
      ['विभाग ५', 'आर्थिक मापदंड', 'SLR वैधानिक तरलता प्रमाण (%)', `${financialRatios.slr}%`],
      ['विभाग ५', 'आर्थिक मापदंड', 'CD Ratio कर्ज-ठेव प्रमाण (%)', `${financialRatios.cdRatio}%`],
      ['विभाग ५', 'आर्थिक मापदंड', 'CRAR भांडवल पर्याप्तता (%)', `${financialRatios.crar}%`],
      ['विभाग ६', 'अंशदान योजना', '३१ मार्च अखेर एकूण ठेवी (रु.)', contribution.totalDepositsMarch31],
      ['विभाग ६', 'अंशदान योजना', 'अंशदान दर', '१० पैसे प्रति १०० रुपये (०.१%)'],
      ['विभाग ६', 'अंशदान योजना', 'देय अंशदान रक्कम (रु.)', contribution.contributionPayableAmount],
      ['विभाग ६', 'अंशदान योजना', 'अंशदान पात्रता स्थिती', contribution.isEligible ? 'पात्र (Eligible)' : 'अपात्र (Ineligible)']
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'MIS_Summary');

    // Deposit Slabs Sheet
    const slabsData = [
      ['ठेवींचे आकारमान स्लॅब वर्गीकरण (Deposit Slabs Classification)'],
      ['स्लॅब तपशील', 'खातेदार संख्या', 'एकूण ठेव रक्कम (रु.)'],
      [capitalDeposits.slabs?.slab1?.label || 'रु. १,००,००० पर्यंत', capitalDeposits.slabs?.slab1?.count || 0, capitalDeposits.slabs?.slab1?.amount || 0],
      [capitalDeposits.slabs?.slab2?.label || 'रु. १,००,००१ ते २,००,०००', capitalDeposits.slabs?.slab2?.count || 0, capitalDeposits.slabs?.slab2?.amount || 0],
      [capitalDeposits.slabs?.slab3?.label || 'रु. २,००,००१ ते ३,००,०००', capitalDeposits.slabs?.slab3?.count || 0, capitalDeposits.slabs?.slab3?.amount || 0],
      [capitalDeposits.slabs?.slab4?.label || 'रु. ३,००,००१ ते ४,००,०००', capitalDeposits.slabs?.slab4?.count || 0, capitalDeposits.slabs?.slab4?.amount || 0],
      [capitalDeposits.slabs?.slab5?.label || 'रु. ४,००,००१ ते ५,००,०००', capitalDeposits.slabs?.slab5?.count || 0, capitalDeposits.slabs?.slab5?.amount || 0],
      [capitalDeposits.slabs?.slab6?.label || 'रु. ५,००,००० पेक्षा जास्त', capitalDeposits.slabs?.slab6?.count || 0, capitalDeposits.slabs?.slab6?.amount || 0]
    ];
    const wsSlabs = XLSX.utils.aoa_to_sheet(slabsData);
    XLSX.utils.book_append_sheet(wb, wsSlabs, 'Deposit_Slabs');

    XLSX.writeFile(wb, `Regulatory_MIS_Report_${financialYear}_patsanstha.xlsx`);
    toast.success('पोर्टल एंट्रीसाठी एक्सेल फाइल यशस्वीरीत्या डाऊनलोड झाली!');
  };

  const handlePrint = () => {
    window.print();
  };

  // Live auto calculation helpers when user edits numbers
  const recalcCapitalDeposits = (field: string, val: number) => {
    const next = { ...capitalDeposits, [field]: val };
    const svanidhi = (next.paidUpCapital || 0) + (next.reserveFund || 0) + (next.buildingFund || 0) - (next.accumulatedLoss || 0);
    const limit = svanidhi * 12;
    const liability = (next.deposits?.totalDeposits || 0) + (next.externalBorrowings || 0);
    next.svanidhi = Math.max(0, svanidhi);
    next.borrowingLimit = Math.max(0, limit);
    next.actualLiability = liability;
    next.isWithinBorrowingLimit = liability <= limit;
    setCapitalDeposits(next);
  };

  const recalcDeposits = (field: string, val: number) => {
    const nextDeposits = { ...capitalDeposits.deposits, [field]: val };
    const total = (nextDeposits.fdAmount || 0) + (nextDeposits.savingAmount || 0) + (nextDeposits.currentAmount || 0) + (nextDeposits.pigmyAmount || 0) + (nextDeposits.rdAmount || 0);
    nextDeposits.totalDeposits = total;
    
    const nextCap = { ...capitalDeposits, deposits: nextDeposits };
    const liability = total + (nextCap.externalBorrowings || 0);
    nextCap.actualLiability = liability;
    nextCap.isWithinBorrowingLimit = liability <= nextCap.borrowingLimit;
    setCapitalDeposits(nextCap);

    // Also update contribution deposit amount and payable 0.1%
    const contrib = { ...contribution };
    contrib.totalDepositsMarch31 = total;
    contrib.contributionPayableAmount = Math.round(total * 0.001);
    setContribution(contrib);
  };

  const recalcLoans = (field: string, val: number) => {
    const next = { ...loansRecovery, [field]: val };
    const total = (next.regularBorrowersAmount || 0) + (next.nominalBorrowersAmount || 0);
    next.totalLoansAmount = total;
    const overdue = next.overdueAmount || 0;
    next.overduePercentage = total > 0 ? Number(((overdue * 100) / total).toFixed(2)) : 0;
    setLoansRecovery(next);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-3 sm:p-6 print:p-0 print:bg-white">
      <Toaster position="top-right" />

      {/* Top Banner & Control Bar */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-600 text-white p-1.5 rounded-lg shadow-sm">
                <Landmark className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                  महाराष्ट्र राज्य बिगर कृषी सहकारी पतसंस्था नियामक मंडळ, पुणे
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <span>वार्षिक आर्थिक व वैधानिक एम.आय.एस. अहवाल (Regulatory Board MIS Engine)</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                  <a 
                    href="https://www.patsansthaniyamakmandal.in" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-0.5 font-medium"
                  >
                    patsansthaniyamakmandal.in <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>आर्थिक वर्ष:</span>
              <select 
                value={financialYear} 
                onChange={(e) => setFinancialYear(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="2025-2026">२०२५ - २०२६</option>
                <option value="2024-2025">२०२४ - २०२५</option>
                <option value="2026-2027">२०२६ - २०२७</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700">
              <span>अखेर दिनांक:</span>
              <input 
                type="date" 
                value={asOnDate} 
                onChange={(e) => setAsOnDate(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={fetchAutoCompute}
              disabled={loading}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
              title="सिस्टीममधील सर्व मॉड्यूल्स स्कॅन करून डेटा आपोआप भरा"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'कॅल्क्युलेट होत आहे...' : 'ऑटो-लोड (Auto Fetch)'}</span>
            </button>

            <button
              onClick={handleSaveDraft}
              disabled={saving || isLocked}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'जतन होत आहे...' : 'मसुदा सेव्ह (Save)'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm"
              title="पोर्टलवर कॉपी/पेस्ट करण्यासाठी सुलभ एक्सेल"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>एक्सेल (XLSX)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>प्रिंट प्रत</span>
            </button>

            <button
              onClick={handleLockReport}
              disabled={isLocked}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
                isLocked 
                  ? 'bg-rose-100 text-rose-700 border border-rose-200 cursor-not-allowed' 
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isLocked ? 'अहवाल लॉक आहे' : 'फायनल लॉक'}</span>
            </button>
          </div>
        </div>

        {/* Lock Warning Banner */}
        {isLocked && (
          <div className="mt-3 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>
              <strong>सूचना:</strong> हा अहवाल फायनल लॉक (Final Locked) झालेला आहे. यात आता कोणतेही फेरबदल करता येणार नाहीत.
            </span>
          </div>
        )}
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-3 mb-4">
        <h1 className="text-xl font-bold uppercase">{sansthaInfo.sansthaName}</h1>
        <p className="text-xs text-slate-600">
          नोंदणी क्र.: {sansthaInfo.registrationNo} | नोंदणी दिनांक: {sansthaInfo.registrationDate} | पत्ता: {sansthaInfo.address}
        </p>
        <div className="mt-2 py-1 px-3 bg-slate-100 border border-slate-300 inline-block font-semibold text-xs">
          महाराष्ट्र राज्य बिगर कृषी सहकारी पतसंस्था नियामक मंडळ, पुणे - वार्षिक MIS अहवाल ({financialYear}) अखेर दिनांक: {asOnDate}
        </div>
      </div>

      {/* 7 Tabs Header Navigation (Screen only) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden print:hidden">
        <div className="flex overflow-x-auto scrollbar-thin divide-x divide-slate-100">
          {[
            { id: 1, name: '१. सर्वसाधारण माहिती', sub: 'शाखा, सभासद, केवायसी, प्रशासन' },
            { id: 2, name: '२. भांडवल व ठेवी', sub: 'भागभांडवल, स्वनिधी, १२ पट, स्लॅब' },
            { id: 3, name: '३. कर्ज व वसुली', sub: 'बाकी, थकबाकी, कलम १०१/९१, तारण' },
            { id: 4, name: '४. गुंतवणूक', sub: 'रोख, बँक शिल्लक, संस्था वर्गीकरण' },
            { id: 5, name: '५. आर्थिक मापदंड', sub: 'CRR, SLR, CD, CRAR, NPA %' },
            { id: 6, name: '६. अंशदान योजना', sub: 'पात्रता निकष व ०.१% भरणा' },
            { id: 7, name: '७. इतर व स्वयंघोषणा', sub: 'व्यवसाय व अंतिम घोषणा' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[140px] px-3 py-3 text-left transition-all relative ${
                activeTab === tab.id
                  ? 'bg-blue-50/70 text-blue-900 border-b-2 border-blue-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="text-xs sm:text-sm font-bold flex items-center justify-between">
                <span>{tab.name}</span>
                {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 text-blue-600" />}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{tab.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: सर्वसाधारण माहिती */}
      {(activeTab === 1 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">१</span>
              <span>सर्वसाधारण माहिती (General Information)</span>
            </h2>
            <span className="text-xs text-slate-500 print:hidden">पोर्टल रकाना १ ते १८</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Sanstha Core Details */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
              <div className="font-semibold text-slate-700 mb-2 border-b border-slate-200 pb-1">शाखा व प्रशासकीय स्थिती</div>
              <div className="space-y-2">
                <div>
                  <label className="text-slate-500 block">सक्रिय शाखा संख्या:</label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.branchCount}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, branchCount: Number(e.target.value) })}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">सध्या कार्यरत प्रशासन:</label>
                  <select
                    disabled={isLocked}
                    value={generalInfo.currentManagement}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, currentManagement: e.target.value })}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 font-semibold"
                  >
                    <option value="संचालक मंडळ">संचालक मंडळ (Board of Directors)</option>
                    <option value="प्राधिकृत अधिकारी">प्राधिकृत अधिकारी (Authorized Officer)</option>
                    <option value="प्रशासक">प्रशासक (Administrator)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 block">निवडणूक / पदभार दिनांक:</label>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={generalInfo.electionDate}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, electionDate: e.target.value })}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-slate-500 block">मागील लेखापरीक्षण वर्ग (Audit Class):</label>
                  <select
                    disabled={isLocked}
                    value={generalInfo.auditClass}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, auditClass: e.target.value })}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 font-semibold"
                  >
                    <option value="A">वर्ग 'A' (अ वर्ग)</option>
                    <option value="B">वर्ग 'B' (ब वर्ग)</option>
                    <option value="C">वर्ग 'C' (क वर्ग)</option>
                    <option value="D">वर्ग 'D' (ड वर्ग)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Member & KYC Statistics */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
              <div className="font-semibold text-slate-700 mb-2 border-b border-slate-200 pb-1">सभासद व केवायसी आकडेवारी</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">मूळ सभासद संख्या (Regular 'A'):</span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.regularMembers}
                    onChange={(e) => {
                      const reg = Number(e.target.value);
                      const tot = reg + Number(generalInfo.nominalMembers || 0);
                      const kycP = tot > 0 ? Number(((Number(generalInfo.kycCount) * 100) / tot).toFixed(2)) : 100;
                      setGeneralInfo({ ...generalInfo, regularMembers: reg, totalMembers: tot, kycPercentage: kycP });
                    }}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 font-semibold text-right"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">नाममात्र सभासद संख्या (Nominal 'B'):</span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.nominalMembers}
                    onChange={(e) => {
                      const nom = Number(e.target.value);
                      const tot = Number(generalInfo.regularMembers || 0) + nom;
                      const kycP = tot > 0 ? Number(((Number(generalInfo.kycCount) * 100) / tot).toFixed(2)) : 100;
                      setGeneralInfo({ ...generalInfo, nominalMembers: nom, totalMembers: tot, kycPercentage: kycP });
                    }}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 font-semibold text-right"
                  />
                </div>
                <div className="flex justify-between items-center font-bold text-slate-800 pt-1 border-t border-slate-200">
                  <span>एकूण सभासद संख्या:</span>
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{fmtInt(generalInfo.totalMembers)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">केवायसी पूर्ण सभासद:</span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.kycCount}
                    onChange={(e) => {
                      const kyc = Number(e.target.value);
                      const tot = Number(generalInfo.totalMembers) || 1;
                      setGeneralInfo({ ...generalInfo, kycCount: kyc, kycPercentage: Number(((kyc * 100) / tot).toFixed(2)) });
                    }}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 font-semibold text-right"
                  />
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-600">केवायसी प्रमाण (%):</span>
                  <span className={`px-2 py-0.5 rounded ${generalInfo.kycPercentage >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {generalInfo.kycPercentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* Manpower & IT Infrastructure */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
              <div className="font-semibold text-slate-700 mb-2 border-b border-slate-200 pb-1">मनुष्यबळ व आयटी (CBS) प्रणाली</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">अधिकारी संख्या:</span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.officersCount}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, officersCount: Number(e.target.value), totalManpower: Number(e.target.value) + Number(generalInfo.staffCount || 0) })}
                    className="w-20 border border-slate-300 rounded px-2 py-0.5 font-semibold text-right"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">कर्मचारी संख्या:</span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.staffCount}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, staffCount: Number(e.target.value), totalManpower: Number(generalInfo.officersCount || 0) + Number(e.target.value) })}
                    className="w-20 border border-slate-300 rounded px-2 py-0.5 font-semibold text-right"
                  />
                </div>
                <div className="flex justify-between items-center font-semibold pt-1 border-t border-slate-200">
                  <span className="text-slate-700">एकूण मनुष्यबळ:</span>
                  <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded">{generalInfo.totalManpower}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">CBS प्रणाली कार्यरत आहे का?</span>
                  <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">होय (Yes)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Unique CIF/UCID लागू आहे का?</span>
                  <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">होय (Yes)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">सॉफ्टवेअर व्हेंडर नाव:</span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={generalInfo.softwareVendorName}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, softwareVendorName: e.target.value })}
                    className="w-36 border border-slate-300 rounded px-2 py-0.5 font-medium text-xs text-right"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: भांडवल व ठेवी */}
      {(activeTab === 2 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">२</span>
              <span>भांडवल व ठेवी (Capital, Funds & Deposits)</span>
            </h2>
            <span className="text-xs text-slate-500 print:hidden">पोर्टल रकाना १९ ते ४२</span>
          </div>

          {/* Svanidhi & 12x Limit Banner */}
          <div className={`p-4 rounded-xl border mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            capitalDeposits.isWithinBorrowingLimit 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>नियम ३५: स्वनिधी व १२ पट कमाल उचल मर्यादा स्थिती</span>
              </div>
              <div className="text-xs">
                <span>स्वनिधी (Owned Funds): </span>
                <strong className="text-sm font-bold">₹ {fmt(capitalDeposits.svanidhi)}</strong>
                <span className="mx-2">|</span>
                <span>१२ पट कमाल मर्यादा (12x Limit): </span>
                <strong className="text-sm font-bold">₹ {fmt(capitalDeposits.borrowingLimit)}</strong>
              </div>
              <div className="text-xs">
                <span>प्रत्यक्ष देयता (ठेवी + बाहेरील कर्जे): </span>
                <strong>₹ {fmt(capitalDeposits.actualLiability)}</strong>
              </div>
            </div>
            <div>
              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase flex items-center gap-1.5 shadow-sm ${
                capitalDeposits.isWithinBorrowingLimit 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-rose-600 text-white'
              }`}>
                {capitalDeposits.isWithinBorrowingLimit ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{capitalDeposits.isWithinBorrowingLimit ? 'सुरक्षित (ठेवी मर्यादेत आहेत)' : 'मर्यादा ओलांडली (Alert)'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Capital & Funds */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">अ) भागभांडवल व निधी (Capital & Funds)</h3>
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 text-slate-600">१. वसूल भागभांडवल (Paid-up Capital):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.paidUpCapital}
                        onChange={(e) => recalcCapitalDeposits('paidUpCapital', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">२. राखीव निधी (Statutory Reserve Fund):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.reserveFund}
                        onChange={(e) => recalcCapitalDeposits('reserveFund', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">३. इमारत निधी (Building Fund):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.buildingFund}
                        onChange={(e) => recalcCapitalDeposits('buildingFund', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">४. संशयित व बुडीत कर्ज निधी (BDDR):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.bddrFund}
                        onChange={(e) => setCapitalDeposits({ ...capitalDeposits, bddrFund: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">५. इतर सर्व निधी (Other Funds):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.otherFunds}
                        onChange={(e) => setCapitalDeposits({ ...capitalDeposits, otherFunds: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">६. संचित तोटा (Accumulated Loss - असल्यास):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.accumulatedLoss}
                        onChange={(e) => recalcCapitalDeposits('accumulatedLoss', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right text-rose-600"
                      />
                    </td>
                  </tr>
                  <tr className="bg-blue-50/60 font-bold">
                    <td className="py-2 text-blue-900">स्वनिधी (Owned Funds) = (१+२+३ - ६):</td>
                    <td className="py-2 text-right text-blue-900 font-bold pr-2">₹ {fmt(capitalDeposits.svanidhi)}</td>
                  </tr>
                  <tr className="bg-emerald-50/60 font-bold">
                    <td className="py-2 text-emerald-900">कमाल उचल मर्यादा (१२ पट):</td>
                    <td className="py-2 text-right text-emerald-900 font-bold pr-2">₹ {fmt(capitalDeposits.borrowingLimit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deposits Breakdown */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">ब) ठेवींचे प्रकार (Deposit Types)</h3>
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 text-slate-600">१. मुदत ठेवी (Fixed Deposits - FD):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.fdAmount || 0}
                        onChange={(e) => recalcDeposits('fdAmount', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">२. बचत खात्यातील ठेवी (Saving Deposits):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.savingAmount || 0}
                        onChange={(e) => recalcDeposits('savingAmount', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">३. आवर्ती ठेव (Recurring Deposits - RD):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.rdAmount || 0}
                        onChange={(e) => recalcDeposits('rdAmount', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">४. दैनिक / पिग्मी ठेव (Pigmy Deposits):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.pigmyAmount || 0}
                        onChange={(e) => recalcDeposits('pigmyAmount', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">५. चालू खाते व इतर ठेवी (Current/Other):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.currentAmount || 0}
                        onChange={(e) => recalcDeposits('currentAmount', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr className="bg-amber-50/70 font-bold">
                    <td className="py-2 text-amber-900">एकूण सर्व प्रकारच्या ठेवी (Total Deposits):</td>
                    <td className="py-2 text-right text-amber-900 font-bold pr-2">₹ {fmt(capitalDeposits.deposits?.totalDeposits)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">बाहेरील कर्ज रक्कम (DCCB / Banks):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.externalBorrowings}
                        onChange={(e) => recalcCapitalDeposits('externalBorrowings', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Slabs Section */}
          <div className="mt-6 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">क) ठेवींचे आकारमान स्लॅब वर्गीकरण (Deposit Slabs Breakdown)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-200 text-slate-700">
                    <th className="py-2 px-3 text-left">अ.क्र.</th>
                    <th className="py-2 px-3 text-left">ठेवींचा स्लॅब</th>
                    <th className="py-2 px-3 text-right">खातेदार संख्या</th>
                    <th className="py-2 px-3 text-right">एकूण ठेव रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[
                    { key: 'slab1', label: 'रु. १,००,००० पर्यंत' },
                    { key: 'slab2', label: 'रु. १,००,००१ ते २,००,०००' },
                    { key: 'slab3', label: 'रु. २,००,००१ ते ३,००,०००' },
                    { key: 'slab4', label: 'रु. ३,००,००१ ते ४,००,०००' },
                    { key: 'slab5', label: 'रु. ४,००,००१ ते ५,००,०००' },
                    { key: 'slab6', label: 'रु. ५,००,००० पेक्षा जास्त' },
                  ].map((s, idx) => (
                    <tr key={s.key} className="hover:bg-slate-100">
                      <td className="py-2 px-3 font-semibold">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-slate-700">{s.label}</td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={capitalDeposits.slabs?.[s.key]?.count || 0}
                          onChange={(e) => {
                            const nextSlabs = { ...capitalDeposits.slabs };
                            nextSlabs[s.key] = { ...nextSlabs[s.key], count: Number(e.target.value) };
                            setCapitalDeposits({ ...capitalDeposits, slabs: nextSlabs });
                          }}
                          className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right font-semibold"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={capitalDeposits.slabs?.[s.key]?.amount || 0}
                          onChange={(e) => {
                            const nextSlabs = { ...capitalDeposits.slabs };
                            nextSlabs[s.key] = { ...nextSlabs[s.key], amount: Number(e.target.value) };
                            setCapitalDeposits({ ...capitalDeposits, slabs: nextSlabs });
                          }}
                          className="w-36 border border-slate-300 rounded px-2 py-0.5 text-right font-semibold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: कर्ज व वसुली */}
      {(activeTab === 3 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">३</span>
              <span>कर्ज व वसुली (Loans, Overdue & Legal Action)</span>
            </h2>
            <span className="text-xs text-slate-500 print:hidden">पोर्टल रकाना ४३ ते ६१</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Outstanding & Overdue */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">अ) येणे कर्ज व थकबाकी (Outstanding & Overdue)</h3>
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 text-slate-600">१. मूळ सभासदांकडून येणे कर्ज:</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.regularBorrowersAmount}
                        onChange={(e) => recalcLoans('regularBorrowersAmount', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">२. नाममात्र सभासदांकडून येणे कर्ज:</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.nominalBorrowersAmount}
                        onChange={(e) => recalcLoans('nominalBorrowersAmount', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr className="bg-blue-50/60 font-bold">
                    <td className="py-2 text-blue-900">एकूण येणे कर्ज बाकी (Total Loans):</td>
                    <td className="py-2 text-right text-blue-900 font-bold pr-2">₹ {fmt(loansRecovery.totalLoansAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600 font-medium">एकूण थकबाकी रक्कम (Total Overdue):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.overdueAmount}
                        onChange={(e) => recalcLoans('overdueAmount', Number(e.target.value))}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right text-rose-600"
                      />
                    </td>
                  </tr>
                  <tr className="bg-rose-50/60 font-bold">
                    <td className="py-2 text-rose-900">थकबाकी टक्केवारी (Overdue %):</td>
                    <td className="py-2 text-right text-rose-900 font-bold pr-2">{loansRecovery.overduePercentage}%</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">तारणी कर्ज रक्कम (Secured Loans):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.securedLoansAmount}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, securedLoansAmount: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">विनातारणी कर्ज रक्कम (Unsecured Loans):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.unsecuredLoansAmount}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, unsecuredLoansAmount: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legal Actions Section 101 & 91 */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">ब) कायदेशीर कारवाई (कलम १०१ व कलम ९१)</h3>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-200 text-slate-700">
                    <th className="py-1 px-2 text-left">तपशील</th>
                    <th className="py-1 px-2 text-right">प्रस्ताव संख्या</th>
                    <th className="py-1 px-2 text-right">रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 text-slate-700 font-medium">कलम १०१ दाखल प्रस्ताव:</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec101?.filedCount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec101: { ...loansRecovery.sec101, filedCount: Number(e.target.value) } })}
                        className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-right font-semibold"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec101?.filedAmount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec101: { ...loansRecovery.sec101, filedAmount: Number(e.target.value) } })}
                        className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-right font-semibold"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-700 font-medium">कलम १०१ मिळालेले दाखले:</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec101?.obtainedCount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec101: { ...loansRecovery.sec101, obtainedCount: Number(e.target.value) } })}
                        className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-right font-semibold"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec101?.obtainedAmount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec101: { ...loansRecovery.sec101, obtainedAmount: Number(e.target.value) } })}
                        className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-right font-semibold"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-700 font-medium">कलम ९१ दाखल दावे (सहकार न्यायालय):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec91?.filedCount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec91: { ...loansRecovery.sec91, filedCount: Number(e.target.value) } })}
                        className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-right font-semibold"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec91?.filedAmount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec91: { ...loansRecovery.sec91, filedAmount: Number(e.target.value) } })}
                        className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-right font-semibold"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-700 font-medium">जप्ती व अंमलबजावणी झालेले दाखले:</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.execution?.executedCount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, execution: { ...loansRecovery.execution, executedCount: Number(e.target.value) } })}
                        className="w-16 border border-slate-300 rounded px-1.5 py-0.5 text-right font-semibold"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.execution?.executedAmount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, execution: { ...loansRecovery.execution, executedAmount: Number(e.target.value) } })}
                        className="w-28 border border-slate-300 rounded px-1.5 py-0.5 text-right font-semibold"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: गुंतवणूक */}
      {(activeTab === 4 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">४</span>
              <span>गुंतवणूक (Investments & Liquid Assets)</span>
            </h2>
            <span className="text-xs text-slate-500 print:hidden">पोर्टल रकाना ६२ ते ७२</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Liquid Cash & Bank Balances */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">अ) रोख व तरल शिल्लक (Cash & Bank Balances)</h3>
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 text-slate-600">१. प्रत्यक्ष रोख शिल्लक (Cash in Hand):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.cashInHand}
                        onChange={(e) => setInvestments({ ...investments, cashInHand: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">२. बँकांमधील बचत खाती (Bank Savings):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.bankSavings}
                        onChange={(e) => setInvestments({ ...investments, bankSavings: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">३. बँकांमधील चालू खाती (Bank Current):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.bankCurrent}
                        onChange={(e) => setInvestments({ ...investments, bankCurrent: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">४. राखीव निधीची स्वतंत्र गुंतवणूक:</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.reserveFundInvestments}
                        onChange={(e) => setInvestments({ ...investments, reserveFundInvestments: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">५. इमारत निधीची स्वतंत्र गुंतवणूक:</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.buildingFundInvestments}
                        onChange={(e) => setInvestments({ ...investments, buildingFundInvestments: Number(e.target.value) })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Institution-wise Breakdown */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">ब) संस्थानिहाय गुंतवणूक (Institution-wise)</h3>
              <table className="w-full">
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 text-slate-600">१. महाराष्ट्र राज्य सहकारी बँक (MSC Bank):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.mscBank || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, mscBank: Number(e.target.value) } })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">२. जिल्हा मध्यवर्ती सहकारी बँक (DCCB):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.dccBank || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, dccBank: Number(e.target.value) } })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">३. नागरी सहकारी बँका (Urban Co-op Banks):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.urbanBanks || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, urbanBanks: Number(e.target.value) } })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">४. राष्ट्रीयकृत बँका (Nationalized Banks):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.nationalizedBanks || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, nationalizedBanks: Number(e.target.value) } })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-slate-600">५. खाजगी बँका (Private Banks):</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.privateBanks || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, privateBanks: Number(e.target.value) } })}
                        className="w-36 border border-slate-300 rounded px-2 py-1 font-semibold text-right"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: आर्थिक मापदंड व गुणोत्तरे */}
      {(activeTab === 5 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">५</span>
              <span>आर्थिक मापदंड व गुणोत्तरे (Financial Ratios & Standards)</span>
            </h2>
            <span className="text-xs text-slate-500 print:hidden">पोर्टल रकाना ७३ ते ८५</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs mb-6">
            {/* CRR Card */}
            <div className={`p-4 rounded-xl border ${
              financialRatios.crr >= 1 && financialRatios.crr <= 5 
                ? 'bg-emerald-50/70 border-emerald-200' 
                : 'bg-amber-50/70 border-amber-200'
            }`}>
              <div className="text-slate-500 font-semibold">C.R.R. (रोख तरलता प्रमाण)</div>
              <div className="text-2xl font-bold text-slate-800 my-1">{financialRatios.crr}%</div>
              <div className="text-[11px] text-slate-500">विहित प्रमाण: १% ते ५%</div>
              <div className="mt-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  financialRatios.crr >= 1 && financialRatios.crr <= 5 ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                }`}>
                  {financialRatios.crr >= 1 && financialRatios.crr <= 5 ? 'निकष पूर्ण (Complied)' : 'पुनरावलोकन आवश्यक'}
                </span>
              </div>
            </div>

            {/* SLR Card */}
            <div className={`p-4 rounded-xl border ${
              financialRatios.slr >= 25 && financialRatios.slr <= 40 
                ? 'bg-emerald-50/70 border-emerald-200' 
                : 'bg-amber-50/70 border-amber-200'
            }`}>
              <div className="text-slate-500 font-semibold">S.L.R. (वैधानिक तरलता प्रमाण)</div>
              <div className="text-2xl font-bold text-slate-800 my-1">{financialRatios.slr}%</div>
              <div className="text-[11px] text-slate-500">विहित प्रमाण: २५% ते ४०%</div>
              <div className="mt-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  financialRatios.slr >= 25 && financialRatios.slr <= 40 ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                }`}>
                  {financialRatios.slr >= 25 && financialRatios.slr <= 40 ? 'निकष पूर्ण (Complied)' : 'पुनरावलोकन आवश्यक'}
                </span>
              </div>
            </div>

            {/* CD Ratio Card */}
            <div className="p-4 rounded-xl border bg-blue-50/70 border-blue-200">
              <div className="text-slate-500 font-semibold">C.D. Ratio (कर्ज-ठेव प्रमाण)</div>
              <div className="text-2xl font-bold text-slate-800 my-1">{financialRatios.cdRatio}%</div>
              <div className="text-[11px] text-slate-500">विहित कमाल प्रमाण: ७०%</div>
              <div className="mt-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-200 text-blue-800">
                  {financialRatios.cdRatio <= 70 ? 'योग्य (Optimal)' : 'कमाल प्रमाण ओलांडले'}
                </span>
              </div>
            </div>

            {/* CRAR Card */}
            <div className="p-4 rounded-xl border bg-purple-50/70 border-purple-200">
              <div className="text-slate-500 font-semibold">C.R.A.R. (भांडवल पर्याप्तता)</div>
              <div className="text-2xl font-bold text-slate-800 my-1">{financialRatios.crar}%</div>
              <div className="text-[11px] text-slate-500">किमान निकष: ९% / १२%</div>
              <div className="mt-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-200 text-purple-800">
                  {financialRatios.crar >= 9 ? 'मजबूत (Strong)' : 'अतिरिक्त भांडवल आवश्यक'}
                </span>
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 text-xs">
            <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">एन.पी.ए., आस्थापना खर्च व व्याजदर तपशील</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">ढोबळ एन.पी.ए. (Gross NPA %):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.grossNpa}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, grossNpa: Number(e.target.value) })}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right font-semibold"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">निव्वळ एन.पी.ए. (Net NPA %):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.netNpa}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, netNpa: Number(e.target.value) })}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right font-semibold"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">आस्थापना खर्च प्रमाण (कमाल ३%):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.establishmentCostPercent}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, establishmentCostPercent: Number(e.target.value) })}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">ठेवींचा महत्तम व्याजदर (%):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.maxDepositRate}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, maxDepositRate: Number(e.target.value) })}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right font-semibold"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">तारणी कर्जाचा व्याजदर (%):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.securedLoanRate}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, securedLoanRate: Number(e.target.value) })}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right font-semibold"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">विनातारणी कर्जाचा व्याजदर (%):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.unsecuredLoanRate}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, unsecuredLoanRate: Number(e.target.value) })}
                    className="w-24 border border-slate-300 rounded px-2 py-0.5 text-right font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: अंशदान योजना */}
      {(activeTab === 6 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">६</span>
              <span>अंशदान योजना (Regulatory Board Contribution Scheme)</span>
            </h2>
            <span className="text-xs text-slate-500 print:hidden">पोर्टल रकाना ८६ ते ९०</span>
          </div>

          {/* Scheme Eligibility Banner */}
          <div className={`p-4 rounded-xl border mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            contribution.isEligible ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>नियामक मंडळ अंशदान योजना पात्रता निष्कर्ष</span>
              </div>
              <div className="text-base font-bold text-slate-800 mt-1">
                {contribution.isEligible 
                  ? '🟢 सदर पतसंस्था अंशदान योजनेच्या सर्व निकषांनुसार पूर्णपणे पात्र (Eligible) आहे.' 
                  : '🔴 सदर पतसंस्था अंशदान योजनेच्या काही निकषांची पूर्तता करत नाही.'}
              </div>
            </div>
            <div className="bg-white border px-4 py-2 rounded-xl text-center shadow-sm">
              <div className="text-[11px] text-slate-500 font-semibold">देय वार्षिक अंशदान रक्कम</div>
              <div className="text-xl font-bold text-emerald-700">₹ {fmt(contribution.contributionPayableAmount)}</div>
              <div className="text-[10px] text-slate-400">१० पैसे प्रति १०० रु. ठेवी (०.१%)</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            {/* Criteria Checklist */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">अ) वैधानिक पात्रता निकष पडताळणी</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-700">१. C.R.R. चे प्रमाण (१% ते ५% दरम्यान)</div>
                    <div className="text-[11px] text-slate-500">प्रत्यक्ष CRR: {financialRatios.crr}%</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    financialRatios.crr >= 1 && financialRatios.crr <= 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {financialRatios.crr >= 1 && financialRatios.crr <= 5 ? '✔ पात्र (हिरवा)' : '✖ अपात्र (लाल)'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-700">२. S.L.R. चे प्रमाण (२५% ते ४०% दरम्यान)</div>
                    <div className="text-[11px] text-slate-500">प्रत्यक्ष SLR: {financialRatios.slr}%</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    financialRatios.slr >= 25 && financialRatios.slr <= 40 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {financialRatios.slr >= 25 && financialRatios.slr <= 40 ? '✔ पात्र (हिरवा)' : '✖ अपात्र (लाल)'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-700">३. मागील ३ वर्षांचे सलग वैधानिक लेखापरीक्षण</div>
                    <div className="text-[11px] text-slate-500">वर्ष २०२४-२५, २०२३-२४, २०२२-२३ लेखापरीक्षित</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ✔ पूर्ण (हिरवा)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-700">४. आदर्श उपविधी स्वीकारल्याचा दिनांक</div>
                    <div className="text-[11px] text-slate-500">{generalInfo.modelByLawsDate}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ✔ स्वीकारली
                  </span>
                </div>
              </div>
            </div>

            {/* Contribution Calculation & Deposit Base */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm mb-3 border-b pb-1">ब) अंशदान रक्कम गणन सूत्र (Calculation)</h3>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-slate-600">३१ मार्च अखेर सर्व प्रकारच्या एकूण ठेवी:</div>
                  <div className="text-xl font-bold text-blue-900 mt-0.5">₹ {fmt(contribution.totalDepositsMarch31)}</div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="text-slate-600">अंशदान दर:</div>
                  <div className="text-sm font-bold text-amber-900 mt-0.5">दर १०० रुपये ठेवीस १० पैसे (०.१% / ०.००१ पट)</div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="text-slate-600">वार्षिक अंशदान देय रक्कम = (एकूण ठेवी × ०.००१):</div>
                  <div className="text-2xl font-bold text-emerald-800 mt-0.5">₹ {fmt(contribution.contributionPayableAmount)}</div>
                </div>

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div>
                    <label className="text-slate-600 block">चलान / UTR क्रमांक (भरणा केल्यास):</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder="उदा. UTR123456789 किंवा चलान क्र."
                      value={contribution.challanUtrNo || ''}
                      onChange={(e) => setContribution({ ...contribution, challanUtrNo: e.target.value })}
                      className="w-full mt-1 border border-slate-300 rounded px-2 py-1 font-semibold"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: इतर माहिती व स्वयंघोषणा */}
      {(activeTab === 7 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 mb-4 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-200 pb-2 mb-4 flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">७</span>
              <span>इतर माहिती व स्वयंघोषणा (Other Info & Declaration)</span>
            </h2>
            <span className="text-xs text-slate-500 print:hidden">पोर्टल रकाना ९१ ते ९६</span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-600 font-semibold block">ठेवी व कर्जव्यतिरिक्त इतर व्यवसाय असल्यास तपशील:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={other.otherBusiness}
                  onChange={(e) => setOther({ ...other, otherBusiness: e.target.value })}
                  className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5"
                />
              </div>
              <div>
                <label className="text-slate-600 font-semibold block">खरेदी-विक्री किंवा व्यापाराची माहिती (Trading details):</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={other.tradingDetails}
                  onChange={(e) => setOther({ ...other, tradingDetails: e.target.value })}
                  className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-600 font-semibold block">वापरासाठी नसलेली अनावश्यक स्थावर मालमत्ता असल्यास तपशील:</label>
              <input
                type="text"
                disabled={isLocked}
                value={other.unnecessaryProperty}
                onChange={(e) => setOther({ ...other, unnecessaryProperty: e.target.value })}
                className="w-full mt-1 border border-slate-300 rounded px-2 py-1.5"
              />
            </div>

            {/* Self Declaration Box */}
            <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-xl mt-6">
              <h3 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>स्वयंघोषणा (Self-Declaration)</span>
              </h3>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={other.isDeclared}
                  onChange={(e) => setOther({ ...other, isDeclared: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-xs text-slate-800 leading-relaxed">
                  मी याद्वारे प्रमाणित करतो/करते की, वरील सर्व ७ विभागांमध्ये दिलेली माहिती आमच्या संस्थेच्या अधिकृत ताळेबंद, नफा-तोटा पत्रक, वैधानिक लेखापरीक्षण अहवाल व सीबीएस (CBS) सिस्टीममधील अधिकृत नोंदींवरून तंतोतंत बरोबर व अचूक भरलेली आहे. यामध्ये कोणतीही असत्य माहिती दिलेली नाही.
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-amber-200">
                <div>
                  <span className="text-slate-600 block">घोषणा दिनांक:</span>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={other.declarationDate}
                    onChange={(e) => setOther({ ...other, declarationDate: e.target.value })}
                    className="mt-1 border border-slate-300 rounded px-2 py-1 font-semibold"
                  />
                </div>
                <div>
                  <span className="text-slate-600 block">स्वाक्षरीकर्ता पदनाम व नाव:</span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={other.signatoryDesignation}
                    onChange={(e) => setOther({ ...other, signatoryDesignation: e.target.value })}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY SIGNATURE SECTION */}
      <div className="hidden print:block mt-12 pt-8 border-t border-slate-400 text-xs">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="h-14"></div>
            <div className="font-bold border-t border-slate-400 pt-1">अध्यक्ष</div>
            <div className="text-[10px] text-slate-500">{sansthaInfo.sansthaName}</div>
          </div>
          <div>
            <div className="h-14"></div>
            <div className="font-bold border-t border-slate-400 pt-1">उपाध्यक्ष</div>
            <div className="text-[10px] text-slate-500">{sansthaInfo.sansthaName}</div>
          </div>
          <div>
            <div className="h-14"></div>
            <div className="font-bold border-t border-slate-400 pt-1">मानद सचिव / संचालक</div>
            <div className="text-[10px] text-slate-500">{sansthaInfo.sansthaName}</div>
          </div>
          <div>
            <div className="h-14"></div>
            <div className="font-bold border-t border-slate-400 pt-1">मुख्य कार्यकारी अधिकारी / व्यवस्थापक</div>
            <div className="text-[10px] text-slate-500">{sansthaInfo.sansthaName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

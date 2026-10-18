import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import toast, { Toaster, ToastBar } from 'react-hot-toast';
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
  Info,
  Scale,
  Percent,
  SlidersHorizontal,
  CheckCircle,
  AlertTriangle,
  X
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

          toast.success(`आर्थिक वर्ष ${financialYear} चा सेव्ह केलेला डेटा लोड झाला.`, {
            id: 'mis-saved-data-loaded',
            duration: 3000
          });
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
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans print:p-0 print:bg-white text-gray-800">
      <Toaster 
        position="top-right"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#ffffff',
            color: '#1e293b',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            fontSize: '12px',
            padding: '8px 12px',
          },
        }}
      >
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <div 
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => toast.dismiss(t.id)}
              >
                {icon}
                <div className="text-xs font-semibold text-slate-800 pr-1">{message}</div>
                {t.type !== 'loading' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toast.dismiss(t.id);
                    }}
                    className="p-1 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-sm cursor-pointer transition-colors"
                    title="बंद करा (Close)"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </ToastBar>
        )}
      </Toaster>

      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
              background: white !important;
              overflow: visible !important;
              display: block !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              page-break-inside: auto !important;
              break-inside: auto !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            thead {
              display: table-header-group !important;
            }
          }
        `}
      </style>

      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-slate-300 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2 no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs shrink-0">
            <Building2 size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>महाराष्ट्र राज्य पतसंस्था नियामक मंडळ, पुणे — वार्षिक MIS अहवाल</span>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-sm border border-primary/20 font-mono">
                {financialYear}
              </span>
              {isLocked && (
                <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-sm border border-rose-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> अंतिम लॉक (Locked)
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span>सहकार आयुक्त व निबंधक, सहकारी संस्था, महाराष्ट्र राज्य मार्गदर्शक नमुन्यांनुसार ७ अधिकृत टॅब्स</span>
              <span className="inline-block w-1 h-1 rounded-full bg-slate-400"></span>
              <a 
                href="https://www.patsansthaniyamakmandal.in" 
                target="_blank" 
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-0.5 font-bold"
              >
                patsansthaniyamakmandal.in <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchAutoCompute}
            disabled={loading}
            className="px-3 py-1 bg-primary hover:opacity-90 text-white font-bold rounded-sm text-[11px] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 h-[30px]"
            title="सिस्टीममधील सर्व मॉड्यूल्स स्कॅन करून डेटा आपोआप भरा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'कॅल्क्युलेट होत आहे...' : 'ऑटो-लोड (Auto Fetch)'}</span>
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={saving || isLocked}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-sm text-[11px] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 h-[30px]"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'जतन होत आहे...' : 'मसुदा सेव्ह (Save)'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer h-[30px]"
            title="पोर्टलवर कॉपी/पेस्ट करण्यासाठी सुलभ एक्सेल"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>एक्सेल (XLSX)</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white border border-slate-700 text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer h-[30px]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>प्रिंट प्रत</span>
          </button>

          <button
            onClick={handleLockReport}
            disabled={isLocked}
            className={`px-2.5 py-1 text-white text-[11px] font-bold rounded-sm flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer h-[30px] disabled:opacity-50 ${
              isLocked 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-rose-700 hover:bg-rose-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isLocked ? 'अहवाल लॉक आहे' : 'फायनल लॉक'}</span>
          </button>
        </div>
      </div>

      {/* CBS Filter & Parameters Bar (Screen Only) */}
      <div className="bg-white px-3.5 py-2 rounded-sm border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-[11px] mb-3 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <label className="font-bold text-gray-700">आर्थिक वर्ष:</label>
            <select 
              value={financialYear} 
              onChange={(e) => setFinancialYear(e.target.value)}
              className="px-2.5 py-1 border border-primary/30 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-bold text-primary bg-primary/5 h-[30px]"
            >
              <option value="2025-2026">२०२५ - २०२६</option>
              <option value="2024-2025">२०२४ - २०२५</option>
              <option value="2026-2027">२०२६ - २०२७</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="font-bold text-gray-700">अखेर दिनांक:</label>
            <input 
              type="date" 
              value={asOnDate} 
              onChange={(e) => setAsOnDate(e.target.value)}
              className="px-2.5 py-1 border border-gray-300 rounded-sm focus:ring-1 focus:ring-primary focus:border-primary font-medium text-gray-800 bg-white h-[30px]"
            />
          </div>
        </div>

        <div className="text-[10.5px] text-gray-600 font-medium">
          संस्था: <strong className="text-gray-900">{sansthaInfo.sansthaName}</strong> | नोंदणी: <strong className="text-primary font-mono">{sansthaInfo.registrationNo}</strong>
        </div>
      </div>

      {/* Lock Warning Banner */}
      {isLocked && (
        <div className="mb-3 bg-rose-50 border border-rose-300 text-rose-800 px-3 py-2 rounded-sm text-[11px] flex items-center gap-2 shadow-2xs no-print font-medium">
          <Lock className="w-4 h-4 text-rose-700 shrink-0" />
          <span>
            <strong>सूचना:</strong> हा अहवाल फायनल लॉक (Final Locked) झालेला आहे. यात आता कोणतेही फेरबदल करता येणार नाहीत.
          </span>
        </div>
      )}

      {/* 7 Tabs Horizontal CBS Segmented Switcher (Screen Only) */}
      <div className="bg-slate-100 p-0.5 rounded-sm border border-slate-300 flex overflow-x-auto items-center gap-1 text-[11px] font-semibold mb-3 no-print">
        {[
          { id: 1, name: '१. सर्वसाधारण माहिती', sub: 'शाखा, सभासद, केवायसी' },
          { id: 2, name: '२. भांडवल व ठेवी', sub: 'स्वनिधी, १२ पट, स्लॅब्स' },
          { id: 3, name: '३. कर्ज व वसुली', sub: 'बाकी, थकबाकी, कलम १०१/९१' },
          { id: 4, name: '४. गुंतवणूक', sub: 'रोख, बँक शिल्लक, संस्था' },
          { id: 5, name: '५. आर्थिक मापदंड', sub: 'CRR, SLR, CD, CRAR, NPA%' },
          { id: 6, name: '६. अंशदान योजना', sub: 'पात्रता व ०.१% भरणा' },
          { id: 7, name: '७. इतर व स्वयंघोषणा', sub: 'व्यवसाय व अंतिम घोषणा' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-sm shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-primary shadow-2xs border border-gray-300 font-bold'
                : 'text-gray-600 hover:text-gray-900 font-medium'
            }`}
          >
            <span>{tab.name}</span>
            <span className="text-[10px] text-gray-400 hidden xl:inline">({tab.sub})</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 7 TABS WORKSPACE CONTENT                                                  */}
      {/* ========================================================================= */}

      {/* TAB 1: सर्वसाधारण माहिती */}
      {(activeTab === 1 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-300 rounded-sm shadow-2xs p-3.5 mb-3 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-300 pb-2 mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">१</span>
              <span>सर्वसाधारण माहिती (General Information)</span>
            </h2>
            <span className="text-[10.5px] font-mono text-gray-500 font-semibold print:hidden">पोर्टल रकाना १ ते १८</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-[11px]">
            {/* Sanstha Core Details */}
            <div className="bg-slate-50 border border-slate-300 p-3 rounded-sm">
              <div className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-200">शाखा व प्रशासकीय स्थिती</div>
              <div className="space-y-2">
                <div>
                  <label className="text-gray-600 block font-semibold mb-0.5">सक्रिय शाखा संख्या:</label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.branchCount}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, branchCount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                  />
                </div>
                <div>
                  <label className="text-gray-600 block font-semibold mb-0.5">सध्या कार्यरत प्रशासन:</label>
                  <select
                    disabled={isLocked}
                    value={generalInfo.currentManagement}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, currentManagement: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                  >
                    <option value="संचालक मंडळ">संचालक मंडळ (Board of Directors)</option>
                    <option value="प्राधिकृत अधिकारी">प्राधिकृत अधिकारी (Authorized Officer)</option>
                    <option value="प्रशासक">प्रशासक (Administrator)</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-600 block font-semibold mb-0.5">निवडणूक / पदभार दिनांक:</label>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={generalInfo.electionDate}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, electionDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                  />
                </div>
                <div>
                  <label className="text-gray-600 block font-semibold mb-0.5">मागील लेखापरीक्षण वर्ग (Audit Class):</label>
                  <select
                    disabled={isLocked}
                    value={generalInfo.auditClass}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, auditClass: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
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
            <div className="bg-slate-50 border border-slate-300 p-3 rounded-sm">
              <div className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-200">सभासद व केवायसी आकडेवारी</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">मूळ सभासद (Regular 'A'):</span>
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
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">नाममात्र सभासद (Nominal 'B'):</span>
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
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center font-bold text-gray-900 pt-1 border-t border-slate-200">
                  <span>एकूण सभासद संख्या:</span>
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-sm font-mono border border-primary/20">{fmtInt(generalInfo.totalMembers)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">केवायसी पूर्ण सभासद:</span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.kycCount}
                    onChange={(e) => {
                      const kyc = Number(e.target.value);
                      const tot = Number(generalInfo.totalMembers) || 1;
                      setGeneralInfo({ ...generalInfo, kycCount: kyc, kycPercentage: Number(((kyc * 100) / tot).toFixed(2)) });
                    }}
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center font-bold">
                  <span className="text-gray-600">केवायसी प्रमाण (%):</span>
                  <span className={`px-2 py-0.5 rounded-sm border ${generalInfo.kycPercentage >= 85 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
                    {generalInfo.kycPercentage}%
                  </span>
                </div>
              </div>
            </div>

            {/* Manpower & IT Infrastructure */}
            <div className="bg-slate-50 border border-slate-300 p-3 rounded-sm">
              <div className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-200">मनुष्यबळ व आयटी (CBS) प्रणाली</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">अधिकारी संख्या:</span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.officersCount}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, officersCount: Number(e.target.value), totalManpower: Number(e.target.value) + Number(generalInfo.staffCount || 0) })}
                    className="w-20 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">कर्मचारी संख्या:</span>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={generalInfo.staffCount}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, staffCount: Number(e.target.value), totalManpower: Number(generalInfo.officersCount || 0) + Number(e.target.value) })}
                    className="w-20 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center font-semibold pt-1 border-t border-slate-200">
                  <span className="text-gray-700">एकूण मनुष्यबळ:</span>
                  <span className="bg-slate-200 text-gray-800 px-2 py-0.5 rounded-sm font-mono">{generalInfo.totalManpower}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">CBS प्रणाली कार्यरत आहे का?</span>
                  <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-sm border border-emerald-300">होय (Yes)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Unique CIF/UCID लागू आहे का?</span>
                  <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-sm border border-emerald-300">होय (Yes)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">सॉफ्टवेअर व्हेंडर नाव:</span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={generalInfo.softwareVendorName}
                    onChange={(e) => setGeneralInfo({ ...generalInfo, softwareVendorName: e.target.value })}
                    className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-medium text-[10.5px] text-right focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: भांडवल व ठेवी */}
      {(activeTab === 2 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-300 rounded-sm shadow-2xs p-3.5 mb-3 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-300 pb-2 mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">२</span>
              <span>भांडवल व ठेवी (Capital, Funds & Deposits)</span>
            </h2>
            <span className="text-[10.5px] font-mono text-gray-500 font-semibold print:hidden">पोर्टल रकाना १९ ते ४२</span>
          </div>

          {/* Svanidhi & 12x Limit Banner */}
          <div className={`p-3 rounded-sm border mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs ${
            capitalDeposits.isWithinBorrowingLimit 
              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900' 
              : 'bg-rose-50/70 border-rose-300 text-rose-900'
          }`}>
            <div className="space-y-1">
              <div className="text-[10.5px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>नियम ३५: स्वनिधी व १२ पट कमाल उचल मर्यादा स्थिती</span>
              </div>
              <div className="text-[11px]">
                <span>स्वनिधी (Owned Funds): </span>
                <strong className="text-xs font-bold font-mono">₹ {fmt(capitalDeposits.svanidhi)}</strong>
                <span className="mx-2 text-slate-400">|</span>
                <span>१२ पट कमाल मर्यादा (12x Limit): </span>
                <strong className="text-xs font-bold font-mono">₹ {fmt(capitalDeposits.borrowingLimit)}</strong>
                <span className="mx-2 text-slate-400">|</span>
                <span>प्रत्यक्ष देयता (ठेवी + बाहेरील कर्जे): </span>
                <strong className="font-mono">₹ {fmt(capitalDeposits.actualLiability)}</strong>
              </div>
            </div>
            <div>
              <span className={`px-2.5 py-1 rounded-sm text-[10.5px] font-bold uppercase flex items-center gap-1 shadow-2xs border ${
                capitalDeposits.isWithinBorrowingLimit 
                  ? 'bg-emerald-700 text-white border-emerald-800' 
                  : 'bg-rose-700 text-white border-rose-800'
              }`}>
                {capitalDeposits.isWithinBorrowingLimit ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                <span>{capitalDeposits.isWithinBorrowingLimit ? 'सुरक्षित (ठेवी मर्यादेत)' : 'मर्यादा ओलांडली (Alert)'}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-[11px]">
            {/* Capital & Funds */}
            <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60">
              <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">अ) भागभांडवल व निधी (Capital & Funds)</h3>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">१. वसूल भागभांडवल (Paid-up Capital):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.paidUpCapital}
                        onChange={(e) => recalcCapitalDeposits('paidUpCapital', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">२. राखीव निधी (Statutory Reserve Fund):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.reserveFund}
                        onChange={(e) => recalcCapitalDeposits('reserveFund', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">३. इमारत निधी (Building Fund):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.buildingFund}
                        onChange={(e) => recalcCapitalDeposits('buildingFund', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">४. संशयित व बुडीत कर्ज निधी (BDDR):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.bddrFund}
                        onChange={(e) => setCapitalDeposits({ ...capitalDeposits, bddrFund: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">५. इतर सर्व निधी (Other Funds):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.otherFunds}
                        onChange={(e) => setCapitalDeposits({ ...capitalDeposits, otherFunds: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">६. संचित तोटा (Accumulated Loss - असल्यास):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.accumulatedLoss}
                        onChange={(e) => recalcCapitalDeposits('accumulatedLoss', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono text-rose-600 focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                    <td className="py-1.5 px-2 text-primary border border-slate-300">स्वनिधी (Owned Funds) = (१+२+३ - ६):</td>
                    <td className="py-1.5 px-2 text-right text-primary font-bold font-mono border border-slate-300">₹ {fmt(capitalDeposits.svanidhi)}</td>
                  </tr>
                  <tr className="bg-emerald-50 font-bold border-t border-emerald-300">
                    <td className="py-1.5 px-2 text-emerald-900 border border-slate-300">कमाल उचल मर्यादा (१२ पट):</td>
                    <td className="py-1.5 px-2 text-right text-emerald-900 font-bold font-mono border border-slate-300">₹ {fmt(capitalDeposits.borrowingLimit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deposits Breakdown */}
            <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60">
              <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">ब) ठेवींचे प्रकार (Deposit Types)</h3>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">१. मुदत ठेवी (Fixed Deposits - FD):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.fdAmount || 0}
                        onChange={(e) => recalcDeposits('fdAmount', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">२. बचत खात्यातील ठेवी (Saving Deposits):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.savingAmount || 0}
                        onChange={(e) => recalcDeposits('savingAmount', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">३. आवर्ती ठेव (Recurring Deposits - RD):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.rdAmount || 0}
                        onChange={(e) => recalcDeposits('rdAmount', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">४. दैनिक / पिग्मी ठेव (Pigmy Deposits):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.pigmyAmount || 0}
                        onChange={(e) => recalcDeposits('pigmyAmount', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">५. चालू खाते व इतर ठेवी (Current/Other):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.deposits?.currentAmount || 0}
                        onChange={(e) => recalcDeposits('currentAmount', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                    <td className="py-1.5 px-2 text-primary border border-slate-300">एकूण सर्व प्रकारच्या ठेवी (Total Deposits):</td>
                    <td className="py-1.5 px-2 text-right text-primary font-bold font-mono border border-slate-300">₹ {fmt(capitalDeposits.deposits?.totalDeposits)}</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">बाहेरील कर्ज रक्कम (DCCB / Banks):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={capitalDeposits.externalBorrowings}
                        onChange={(e) => recalcCapitalDeposits('externalBorrowings', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Slabs Section */}
          <div className="mt-3 border border-slate-300 rounded-sm p-3 bg-slate-50/60">
            <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">क) ठेवींचे आकारमान स्लॅब वर्गीकरण (Deposit Slabs Breakdown)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-gray-800 font-bold border-b border-slate-300">
                    <th className="py-1.5 px-2 text-left border border-slate-300">अ.क्र.</th>
                    <th className="py-1.5 px-2 text-left border border-slate-300">ठेवींचा स्लॅब</th>
                    <th className="py-1.5 px-2 text-right border border-slate-300">खातेदार संख्या</th>
                    <th className="py-1.5 px-2 text-right border border-slate-300">एकूण ठेव रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'slab1', label: 'रु. १,००,००० पर्यंत' },
                    { key: 'slab2', label: 'रु. १,००,००१ ते २,००,०००' },
                    { key: 'slab3', label: 'रु. २,००,००१ ते ३,००,०००' },
                    { key: 'slab4', label: 'रु. ३,००,००१ ते ४,००,०००' },
                    { key: 'slab5', label: 'रु. ४,००,००१ ते ५,००,०००' },
                    { key: 'slab6', label: 'रु. ५,००,००० पेक्षा जास्त' },
                  ].map((s, idx) => (
                    <tr key={s.key} className="hover:bg-primary/5 transition-colors">
                      <td className="py-1.5 px-2 font-semibold border border-slate-200">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-medium text-gray-800 border border-slate-200">{s.label}</td>
                      <td className="py-1.5 px-2 text-right border border-slate-200">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={capitalDeposits.slabs?.[s.key]?.count || 0}
                          onChange={(e) => {
                            const nextSlabs = { ...capitalDeposits.slabs };
                            nextSlabs[s.key] = { ...nextSlabs[s.key], count: Number(e.target.value) };
                            setCapitalDeposits({ ...capitalDeposits, slabs: nextSlabs });
                          }}
                          className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right border border-slate-200">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={capitalDeposits.slabs?.[s.key]?.amount || 0}
                          onChange={(e) => {
                            const nextSlabs = { ...capitalDeposits.slabs };
                            nextSlabs[s.key] = { ...nextSlabs[s.key], amount: Number(e.target.value) };
                            setCapitalDeposits({ ...capitalDeposits, slabs: nextSlabs });
                          }}
                          className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
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
        <div className="bg-white border border-slate-300 rounded-sm shadow-2xs p-3.5 mb-3 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-300 pb-2 mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">३</span>
              <span>कर्ज व वसुली (Loans, Overdue & Legal Action)</span>
            </h2>
            <span className="text-[10.5px] font-mono text-gray-500 font-semibold print:hidden">पोर्टल रकाना ४३ ते ६१</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-[11px]">
            {/* Outstanding & Overdue */}
            <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60">
              <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">अ) येणे कर्ज व थकबाकी (Outstanding & Overdue)</h3>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">१. मूळ सभासदांकडून येणे कर्ज:</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.regularBorrowersAmount}
                        onChange={(e) => recalcLoans('regularBorrowersAmount', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">२. नाममात्र सभासदांकडून येणे कर्ज:</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.nominalBorrowersAmount}
                        onChange={(e) => recalcLoans('nominalBorrowersAmount', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="bg-primary/10 font-bold border-t-2 border-primary/30">
                    <td className="py-1.5 px-2 text-primary border border-slate-300">एकूण येणे कर्ज बाकी (Total Loans):</td>
                    <td className="py-1.5 px-2 text-right text-primary font-bold font-mono border border-slate-300">₹ {fmt(loansRecovery.totalLoansAmount)}</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 font-medium border border-slate-200">एकूण थकबाकी रक्कम (Total Overdue):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.overdueAmount}
                        onChange={(e) => recalcLoans('overdueAmount', Number(e.target.value))}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono text-rose-600 focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="bg-rose-50/70 font-bold border-t border-rose-300">
                    <td className="py-1.5 px-2 text-rose-900 border border-slate-300">थकबाकी टक्केवारी (Overdue %):</td>
                    <td className="py-1.5 px-2 text-right text-rose-900 font-bold font-mono border border-slate-300">{loansRecovery.overduePercentage}%</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">तारणी कर्ज रक्कम (Secured Loans):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.securedLoansAmount}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, securedLoansAmount: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">विनातारणी कर्ज रक्कम (Unsecured Loans):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.unsecuredLoansAmount}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, unsecuredLoansAmount: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legal Actions Section 101 & 91 */}
            <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60">
              <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">ब) कायदेशीर कारवाई (कलम १०१ व कलम ९१)</h3>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-gray-800 font-bold border-b border-slate-300">
                    <th className="py-1.5 px-2 text-left border border-slate-300">तपशील</th>
                    <th className="py-1.5 px-2 text-right border border-slate-300">प्रस्ताव संख्या</th>
                    <th className="py-1.5 px-2 text-right border border-slate-300">रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-800 font-medium border border-slate-200">कलम १०१ दाखल प्रस्ताव:</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec101?.filedCount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec101: { ...loansRecovery.sec101, filedCount: Number(e.target.value) } })}
                        className="w-16 border border-gray-300 rounded-sm px-1.5 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec101?.filedAmount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec101: { ...loansRecovery.sec101, filedAmount: Number(e.target.value) } })}
                        className="w-28 border border-gray-300 rounded-sm px-1.5 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-800 font-medium border border-slate-200">कलम १०१ मिळालेले दाखले:</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec101?.obtainedCount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec101: { ...loansRecovery.sec101, obtainedCount: Number(e.target.value) } })}
                        className="w-16 border border-gray-300 rounded-sm px-1.5 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec101?.obtainedAmount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec101: { ...loansRecovery.sec101, obtainedAmount: Number(e.target.value) } })}
                        className="w-28 border border-gray-300 rounded-sm px-1.5 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-800 font-medium border border-slate-200">कलम ९१ दाखल दावे (सहकार न्यायालय):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec91?.filedCount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec91: { ...loansRecovery.sec91, filedCount: Number(e.target.value) } })}
                        className="w-16 border border-gray-300 rounded-sm px-1.5 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.sec91?.filedAmount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, sec91: { ...loansRecovery.sec91, filedAmount: Number(e.target.value) } })}
                        className="w-28 border border-gray-300 rounded-sm px-1.5 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-800 font-medium border border-slate-200">जप्ती व अंमलबजावणी झालेले दाखले:</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.execution?.executedCount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, execution: { ...loansRecovery.execution, executedCount: Number(e.target.value) } })}
                        className="w-16 border border-gray-300 rounded-sm px-1.5 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={loansRecovery.execution?.executedAmount || 0}
                        onChange={(e) => setLoansRecovery({ ...loansRecovery, execution: { ...loansRecovery.execution, executedAmount: Number(e.target.value) } })}
                        className="w-28 border border-gray-300 rounded-sm px-1.5 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
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
        <div className="bg-white border border-slate-300 rounded-sm shadow-2xs p-3.5 mb-3 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-300 pb-2 mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">४</span>
              <span>गुंतवणूक (Investments & Liquid Assets)</span>
            </h2>
            <span className="text-[10.5px] font-mono text-gray-500 font-semibold print:hidden">पोर्टल रकाना ६२ ते ७२</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-[11px]">
            {/* Liquid Cash & Bank Balances */}
            <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60">
              <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">अ) रोख व तरल शिल्लक (Cash & Bank Balances)</h3>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">१. प्रत्यक्ष रोख शिल्लक (Cash in Hand):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.cashInHand}
                        onChange={(e) => setInvestments({ ...investments, cashInHand: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">२. बँकांमधील बचत खाती (Bank Savings):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.bankSavings}
                        onChange={(e) => setInvestments({ ...investments, bankSavings: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">३. बँकांमधील चालू खाती (Bank Current):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.bankCurrent}
                        onChange={(e) => setInvestments({ ...investments, bankCurrent: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">४. राखीव निधीची स्वतंत्र गुंतवणूक:</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.reserveFundInvestments}
                        onChange={(e) => setInvestments({ ...investments, reserveFundInvestments: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">५. इमारत निधीची स्वतंत्र गुंतवणूक:</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.buildingFundInvestments}
                        onChange={(e) => setInvestments({ ...investments, buildingFundInvestments: Number(e.target.value) })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Institution-wise Breakdown */}
            <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60">
              <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">ब) संस्थानिहाय गुंतवणूक (Institution-wise)</h3>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">१. महाराष्ट्र राज्य सहकारी बँक (MSC Bank):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.mscBank || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, mscBank: Number(e.target.value) } })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">२. जिल्हा मध्यवर्ती सहकारी बँक (DCCB):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.dccBank || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, dccBank: Number(e.target.value) } })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">३. नागरी सहकारी बँका (Urban Co-op Banks):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.urbanBanks || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, urbanBanks: Number(e.target.value) } })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">४. राष्ट्रीयकृत बँका (Nationalized Banks):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.nationalizedBanks || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, nationalizedBanks: Number(e.target.value) } })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                      />
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 text-gray-700 border border-slate-200">५. खाजगी बँका (Private Banks):</td>
                    <td className="py-1.5 px-2 text-right border border-slate-200">
                      <input
                        type="number"
                        disabled={isLocked}
                        value={investments.institutions?.privateBanks || 0}
                        onChange={(e) => setInvestments({ ...investments, institutions: { ...investments.institutions, privateBanks: Number(e.target.value) } })}
                        className="w-36 border border-gray-300 rounded-sm px-2 py-0.5 font-semibold text-right font-mono focus:ring-1 focus:ring-primary focus:border-primary bg-white"
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
        <div className="bg-white border border-slate-300 rounded-sm shadow-2xs p-3.5 mb-3 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-300 pb-2 mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">५</span>
              <span>आर्थिक मापदंड व गुणोत्तरे (Financial Ratios & Standards)</span>
            </h2>
            <span className="text-[10.5px] font-mono text-gray-500 font-semibold print:hidden">पोर्टल रकाना ७३ ते ८५</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
            {/* CRR Card */}
            <div className={`p-3 rounded-sm border border-slate-300 border-l-4 shadow-2xs flex items-center gap-3 ${
              financialRatios.crr >= 1 && financialRatios.crr <= 5 
                ? 'bg-white border-l-emerald-600' 
                : 'bg-amber-50/20 border-l-amber-500'
            }`}>
              <div className={`p-2 rounded-sm shrink-0 ${
                financialRatios.crr >= 1 && financialRatios.crr <= 5 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">C.R.R. (रोख तरलता)</div>
                <div className="text-base font-bold text-gray-900 font-mono my-0.5">{financialRatios.crr}%</div>
                <div className="text-[9.5px] text-gray-500 font-medium">विहित निकष: १% ते ५%</div>
                <div className="mt-1">
                  <span className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-bold border inline-flex items-center gap-1 ${
                    financialRatios.crr >= 1 && financialRatios.crr <= 5 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {financialRatios.crr >= 1 && financialRatios.crr <= 5 ? '✔ निकष पूर्ण' : '⚠️ पुनरावलोकन'}
                  </span>
                </div>
              </div>
            </div>

            {/* SLR Card */}
            <div className={`p-3 rounded-sm border border-slate-300 border-l-4 shadow-2xs flex items-center gap-3 ${
              financialRatios.slr >= 25 && financialRatios.slr <= 40 
                ? 'bg-white border-l-emerald-600' 
                : 'bg-amber-50/20 border-l-amber-500'
            }`}>
              <div className={`p-2 rounded-sm shrink-0 ${
                financialRatios.slr >= 25 && financialRatios.slr <= 40 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">S.L.R. (वैधानिक तरलता)</div>
                <div className="text-base font-bold text-gray-900 font-mono my-0.5">{financialRatios.slr}%</div>
                <div className="text-[9.5px] text-gray-500 font-medium">विहित निकष: २५% ते ४०%</div>
                <div className="mt-1">
                  <span className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-bold border inline-flex items-center gap-1 ${
                    financialRatios.slr >= 25 && financialRatios.slr <= 40 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {financialRatios.slr >= 25 && financialRatios.slr <= 40 ? '✔ निकष पूर्ण' : '⚠️ पुनरावलोकन'}
                  </span>
                </div>
              </div>
            </div>

            {/* CD Ratio Card */}
            <div className={`p-3 rounded-sm border border-slate-300 border-l-4 shadow-2xs flex items-center gap-3 ${
              financialRatios.cdRatio <= 70 ? 'bg-white border-l-primary' : 'bg-rose-50/20 border-l-rose-600'
            }`}>
              <div className={`p-2 rounded-sm shrink-0 ${
                financialRatios.cdRatio <= 70 ? 'bg-primary/10 text-primary' : 'bg-rose-50 text-rose-700'
              }`}>
                <Scale className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">C.D. Ratio (कर्ज-ठेव)</div>
                <div className="text-base font-bold text-gray-900 font-mono my-0.5">{financialRatios.cdRatio}%</div>
                <div className="text-[9.5px] text-gray-500 font-medium">विहित कमाल निकष: ७०%</div>
                <div className="mt-1">
                  <span className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-bold border inline-flex items-center gap-1 ${
                    financialRatios.cdRatio <= 70 ? 'bg-primary/10 text-primary border-primary/20' : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {financialRatios.cdRatio <= 70 ? '✔ योग्य (Optimal)' : '⚠️ ओलांडले'}
                  </span>
                </div>
              </div>
            </div>

            {/* CRAR Card */}
            <div className={`p-3 rounded-sm border border-slate-300 border-l-4 shadow-2xs flex items-center gap-3 ${
              financialRatios.crar >= 9 ? 'bg-white border-l-emerald-600' : 'bg-rose-50/20 border-l-rose-600'
            }`}>
              <div className={`p-2 rounded-sm shrink-0 ${
                financialRatios.crar >= 9 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                <Coins className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">C.R.A.R. (भांडवल पर्याप्तता)</div>
                <div className="text-base font-bold text-gray-900 font-mono my-0.5">{financialRatios.crar}%</div>
                <div className="text-[9.5px] text-gray-500 font-medium">किमान निकष: ९% / १२%</div>
                <div className="mt-1">
                  <span className={`px-1.5 py-0.5 rounded-xs text-[9.5px] font-bold border inline-flex items-center gap-1 ${
                    financialRatios.crar >= 9 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {financialRatios.crar >= 9 ? '✔ मजबूत (Strong)' : '⚠️ अपुरे भांडवल'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Table */}
          <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60 text-[11px]">
            <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">एन.पी.ए., आस्थापना खर्च व व्याजदर तपशील</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">ढोबळ एन.पी.ए. (Gross NPA %):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.grossNpa}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, grossNpa: Number(e.target.value) })}
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">निव्वळ एन.पी.ए. (Net NPA %):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.netNpa}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, netNpa: Number(e.target.value) })}
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">आस्थापना खर्च प्रमाण (कमाल ३%):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.establishmentCostPercent}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, establishmentCostPercent: Number(e.target.value) })}
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">ठेवींचा महत्तम व्याजदर (%):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.maxDepositRate}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, maxDepositRate: Number(e.target.value) })}
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">तारणी कर्जाचा व्याजदर (%):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.securedLoanRate}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, securedLoanRate: Number(e.target.value) })}
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">विनातारणी कर्जाचा व्याजदर (%):</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={isLocked}
                    value={financialRatios.unsecuredLoanRate}
                    onChange={(e) => setFinancialRatios({ ...financialRatios, unsecuredLoanRate: Number(e.target.value) })}
                    className="w-24 border border-gray-300 rounded-sm px-2 py-0.5 text-right font-mono font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: अंशदान योजना */}
      {(activeTab === 6 || window.matchMedia('print').matches) && (
        <div className="bg-white border border-slate-300 rounded-sm shadow-2xs p-3.5 mb-3 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-300 pb-2 mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">६</span>
              <span>अंशदान योजना (Regulatory Board Contribution Scheme)</span>
            </h2>
            <span className="text-[10.5px] font-mono text-gray-500 font-semibold print:hidden">पोर्टल रकाना ८६ ते ९०</span>
          </div>

          {/* Scheme Eligibility Banner */}
          <div className={`p-3 rounded-sm border mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs ${
            contribution.isEligible ? 'bg-emerald-50/70 border-emerald-300' : 'bg-amber-50/70 border-amber-300'
          }`}>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>नियामक मंडळ अंशदान योजना पात्रता निष्कर्ष</span>
              </div>
              <div className="text-xs font-bold text-gray-900 mt-1">
                {contribution.isEligible 
                  ? '🟢 सदर पतसंस्था अंशदान योजनेच्या सर्व वैधानिक निकषांनुसार पूर्णपणे पात्र (Eligible) आहे.' 
                  : '🔴 सदर पतसंस्था अंशदान योजनेच्या काही निकषांची पूर्तता करत नाही.'}
              </div>
            </div>
            <div className="bg-white border border-slate-300 px-3.5 py-1.5 rounded-sm text-center shadow-2xs">
              <div className="text-[10px] text-gray-500 font-semibold">देय वार्षिक अंशदान रक्कम</div>
              <div className="text-base font-bold text-emerald-800 font-mono">₹ {fmt(contribution.contributionPayableAmount)}</div>
              <div className="text-[9.5px] text-gray-400 font-medium">१० पैसे प्रति १०० रु. ठेवी (०.१%)</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-[11px]">
            {/* Criteria Checklist */}
            <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60">
              <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">अ) वैधानिक पात्रता निकष पडताळणी</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-sm bg-white border border-slate-300">
                  <div>
                    <div className="font-semibold text-gray-800">१. C.R.R. चे प्रमाण (१% ते ५% दरम्यान)</div>
                    <div className="text-[10px] text-gray-500">प्रत्यक्ष CRR: {financialRatios.crr}%</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-xs text-[10px] font-bold border ${
                    financialRatios.crr >= 1 && financialRatios.crr <= 5 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {financialRatios.crr >= 1 && financialRatios.crr <= 5 ? '✔ पात्र (हिरवा)' : '✖ अपात्र (लाल)'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-sm bg-white border border-slate-300">
                  <div>
                    <div className="font-semibold text-gray-800">२. S.L.R. चे प्रमाण (२५% ते ४०% दरम्यान)</div>
                    <div className="text-[10px] text-gray-500">प्रत्यक्ष SLR: {financialRatios.slr}%</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-xs text-[10px] font-bold border ${
                    financialRatios.slr >= 25 && financialRatios.slr <= 40 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {financialRatios.slr >= 25 && financialRatios.slr <= 40 ? '✔ पात्र (हिरवा)' : '✖ अपात्र (लाल)'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-sm bg-white border border-slate-300">
                  <div>
                    <div className="font-semibold text-gray-800">३. मागील ३ वर्षांचे सलग वैधानिक लेखापरीक्षण</div>
                    <div className="text-[10px] text-gray-500">वर्ष २०२४-२५, २०२३-२४, २०२२-२३ लेखापरीक्षित</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    ✔ पूर्ण (हिरवा)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-sm bg-white border border-slate-300">
                  <div>
                    <div className="font-semibold text-gray-800">४. आदर्श उपविधी स्वीकारल्याचा दिनांक</div>
                    <div className="text-[10px] text-gray-500">{generalInfo.modelByLawsDate}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    ✔ स्वीकारली
                  </span>
                </div>
              </div>
            </div>

            {/* Contribution Calculation & Deposit Base */}
            <div className="border border-slate-300 rounded-sm p-3 bg-slate-50/60">
              <h3 className="font-bold text-gray-800 text-[11px] mb-2 pb-1 border-b border-slate-300">ब) अंशदान रक्कम गणन सूत्र (Calculation)</h3>
              <div className="space-y-2.5">
                <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-sm">
                  <div className="text-gray-600 font-medium">३१ मार्च अखेर सर्व प्रकारच्या एकूण ठेवी:</div>
                  <div className="text-base font-bold text-primary font-mono mt-0.5">₹ {fmt(contribution.totalDepositsMarch31)}</div>
                </div>

                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-sm">
                  <div className="text-gray-600 font-medium">अंशदान दर:</div>
                  <div className="text-xs font-bold text-amber-900 mt-0.5">दर १०० रुपये ठेवीस १० पैसे (०.१% / ०.००१ पट)</div>
                </div>

                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-sm">
                  <div className="text-gray-600 font-medium">वार्षिक अंशदान देय रक्कम = (एकूण ठेवी × ०.००१):</div>
                  <div className="text-lg font-bold text-emerald-800 font-mono mt-0.5">₹ {fmt(contribution.contributionPayableAmount)}</div>
                </div>

                <div className="pt-2 border-t border-slate-300 space-y-1">
                  <div>
                    <label className="text-gray-600 block font-semibold mb-0.5">चलान / UTR क्रमांक (भरणा केल्यास):</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder="उदा. UTR123456789 किंवा चलान क्र."
                      value={contribution.challanUtrNo || ''}
                      onChange={(e) => setContribution({ ...contribution, challanUtrNo: e.target.value })}
                      className="w-full border border-gray-300 rounded-sm px-2 py-1 font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
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
        <div className="bg-white border border-slate-300 rounded-sm shadow-2xs p-3.5 mb-3 print:border-none print:shadow-none print:p-0">
          <div className="border-b border-slate-300 pb-2 mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">७</span>
              <span>इतर माहिती व स्वयंघोषणा (Other Info & Declaration)</span>
            </h2>
            <span className="text-[10.5px] font-mono text-gray-500 font-semibold print:hidden">पोर्टल रकाना ९१ ते ९६</span>
          </div>

          <div className="space-y-3 text-[11px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-700 font-semibold block mb-1">ठेवी व कर्जव्यतिरिक्त इतर व्यवसाय असल्यास तपशील:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={other.otherBusiness}
                  onChange={(e) => setOther({ ...other, otherBusiness: e.target.value })}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                />
              </div>
              <div>
                <label className="text-gray-700 font-semibold block mb-1">खरेदी-विक्री किंवा व्यापाराची माहिती (Trading details):</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={other.tradingDetails}
                  onChange={(e) => setOther({ ...other, tradingDetails: e.target.value })}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-700 font-semibold block mb-1">वापरासाठी नसलेली अनावश्यक स्थावर मालमत्ता असल्यास तपशील:</label>
              <input
                type="text"
                disabled={isLocked}
                value={other.unnecessaryProperty}
                onChange={(e) => setOther({ ...other, unnecessaryProperty: e.target.value })}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
              />
            </div>

            {/* Self Declaration Box */}
            <div className="bg-amber-50/60 border border-amber-300 p-3.5 rounded-sm mt-4 shadow-2xs">
              <h3 className="font-bold text-amber-900 text-xs mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-800" />
                <span>स्वयंघोषणा (Self-Declaration)</span>
              </h3>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={other.isDeclared}
                  onChange={(e) => setOther({ ...other, isDeclared: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded-sm focus:ring-primary cursor-pointer"
                />
                <span className="text-[11px] text-gray-800 leading-relaxed font-medium">
                  मी याद्वारे प्रमाणित करतो/करते की, वरील सर्व ७ विभागांमध्ये दिलेली माहिती आमच्या संस्थेच्या अधिकृत ताळेबंद, नफा-तोटा पत्रक, वैधानिक लेखापरीक्षण अहवाल व सीबीएस (CBS) सिस्टीममधील अधिकृत नोंदींवरून तंतोतंत बरोबर व अचूक भरलेली आहे. यामध्ये कोणतीही असत्य माहिती दिलेली नाही.
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-2.5 border-t border-amber-200">
                <div>
                  <span className="text-gray-700 block font-semibold mb-0.5">घोषणा दिनांक:</span>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={other.declarationDate}
                    onChange={(e) => setOther({ ...other, declarationDate: e.target.value })}
                    className="border border-gray-300 rounded-sm px-2 py-1 font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                  />
                </div>
                <div>
                  <span className="text-gray-700 block font-semibold mb-0.5">स्वाक्षरीकर्ता पदनाम व नाव:</span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={other.signatoryDesignation}
                    onChange={(e) => setOther({ ...other, signatoryDesignation: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 font-semibold focus:ring-1 focus:ring-primary focus:border-primary bg-white h-[28px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINT-ONLY OFFICIAL CBS REPORT (Hidden on Screen, Visible on Print)       */}
      {/* ========================================================================= */}
      <div className="hidden print:block print-area">
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
          <h1 className="text-base font-bold uppercase tracking-wide text-gray-900">{sansthaInfo.sansthaName}</h1>
          <p className="text-[10px] text-gray-600 mt-0.5">
            नोंदणी क्र.: {sansthaInfo.registrationNo} | नोंदणी दिनांक: {sansthaInfo.registrationDate} | पत्ता: {sansthaInfo.address}
          </p>
          <div className="mt-2 py-0.5 px-3 bg-slate-100 border border-slate-400 inline-block font-bold text-xs uppercase tracking-wider">
            महाराष्ट्र राज्य बिगर कृषी सहकारी पतसंस्था नियामक मंडळ, पुणे — वार्षिक MIS अहवाल ({financialYear})
          </div>
          <div className="text-[10px] text-gray-600 mt-1">
            अखेर दिनांक: <strong>{asOnDate}</strong> | पोर्टल संदर्भ: <strong>patsansthaniyamakmandal.in</strong>
          </div>
        </div>

        {/* Print Signatures Block (Official CBS 4-Tier) */}
        <div className="mt-14 pt-4 text-xs">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="h-12"></div>
              <div className="font-bold border-t border-slate-800 pt-1">अध्यक्ष</div>
              <div className="text-[10px] text-gray-500">{sansthaInfo.sansthaName}</div>
            </div>
            <div>
              <div className="h-12"></div>
              <div className="font-bold border-t border-slate-800 pt-1">उपाध्यक्ष</div>
              <div className="text-[10px] text-gray-500">{sansthaInfo.sansthaName}</div>
            </div>
            <div>
              <div className="h-12"></div>
              <div className="font-bold border-t border-slate-800 pt-1">मानद सचिव / संचालक</div>
              <div className="text-[10px] text-gray-500">{sansthaInfo.sansthaName}</div>
            </div>
            <div>
              <div className="h-12"></div>
              <div className="font-bold border-t border-slate-800 pt-1">मुख्य कार्यकारी अधिकारी / व्यवस्थापक</div>
              <div className="text-[10px] text-gray-500">{sansthaInfo.sansthaName}</div>
            </div>
          </div>
          <div className="text-[9px] text-gray-500 text-center mt-6">
            हा अहवाल SmartBanking Core Banking System द्वारे दिनांक {new Date().toLocaleDateString('en-GB')} रोजी तयार करण्यात आला असून संगणकीय सुरक्षित प्रत आहे.
          </div>
        </div>
      </div>
    </div>
  );
}

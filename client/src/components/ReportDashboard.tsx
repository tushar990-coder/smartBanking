import React from 'react';
import { Calculator, Wallet, Users, PiggyBank, FileText, Lock, LayoutDashboard, Clock, Building, KeyRound, Scale, ShieldCheck, ChevronRight } from 'lucide-react';

interface ReportDashboardProps {
  setActiveTab: (tab: string, params?: any) => void;
}

interface ReportItem {
  id: string;
  name: string;
  spanFullOnSm?: boolean;
}

interface ReportModule {
  title: string;
  icon: React.ReactNode;
  colSpanClass: string;
  gridColsClass: string;
  cardBorder: string;
  headerBg: string;
  iconBox: string;
  titleColor: string;
  countBadge: string;
  bodyBg: string;
  btnStyle: string;
  numBadge: string;
  textHover: string;
  chevronColor: string;
  reports: ReportItem[];
}

export default function ReportDashboard({ setActiveTab }: ReportDashboardProps) {
  const reportModules: ReportModule[] = [
    {
      title: '१. अकाउंटिंग व वैधानिक अहवाल (Accounting & Statutory Reports)',
      icon: <Calculator className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-12',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      cardBorder: 'border-sky-200 border-t-sky-500',
      headerBg: 'bg-sky-50 border-sky-200',
      iconBox: 'bg-white border-sky-300 text-sky-600',
      titleColor: 'text-sky-700',
      countBadge: 'bg-white text-sky-700 border-sky-200',
      bodyBg: 'bg-sky-50/35',
      btnStyle: 'border-sky-200/80 hover:border-sky-400 hover:bg-sky-50',
      numBadge: 'bg-sky-50 text-sky-700 border-sky-200 group-hover:bg-sky-100',
      textHover: 'group-hover:text-sky-700',
      chevronColor: 'text-sky-400 group-hover:text-sky-600',
      reports: [
        { id: 'daybook', name: 'रोजकीर्द (Daybook)' },
        { id: 'draft-daybook', name: 'कच्ची रोजकीर्द - पासिंग पूर्व (Draft Daybook)' },
        { id: 'legacy-daybook', name: 'लेगसी रोजकीर्द (Legacy Daybook)' },
        { id: 'daybook-summary', name: 'रोजकीर्द सारांश (Daybook Summary)' },
        { id: 'cash-book', name: 'रोख पुस्तक (Cash Book)' },
        { id: 'general-ledger', name: 'जनरल लेजर (General Ledger)' },
        { id: 'trial-balance', name: 'तेरीज पत्रक (Trial Balance)' },
        { id: 'trial-balance-namuna-n', name: 'तेरीज पत्रक (नमुना N)' },
        { id: 'profit-loss', name: 'नफा-तोटा पत्रक (P&L A/c)' },
        { id: 'balance-sheet', name: 'ताळेबंद पत्रक (Balance Sheet)' },
        { id: 'balance-sheet-form-n', name: 'ताळेबंद पत्रक (नमुना न)' },
        { id: 'ibt-reconciliation-report', name: 'आंतर-शाखा ताळमेळ अहवाल (IBT Reconciliation)' },
        { id: 'swanidhi-report', name: 'स्वनिधी व कमाल उचल अहवाल (Rule 35 Swanidhi)' },
        { id: 'regulatory-mis-report', name: 'पतसंस्था नियामक मंडळ MIS अहवाल (Regulatory MIS)' },
        { id: 'crr-report', name: 'CRR रोख राखीव प्रमाण अहवाल (Cash Reserve Ratio)' },
        { id: 'voucher-batch-print', name: 'व्हाउचर प्रिंटिंग (Voucher Print)' },
      ]
    },
    {
      title: '२. कर्ज विभाग अहवाल (Loan Department Reports)',
      icon: <Wallet className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-12',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      cardBorder: 'border-rose-200 border-t-rose-500',
      headerBg: 'bg-rose-50 border-rose-200',
      iconBox: 'bg-white border-rose-300 text-rose-600',
      titleColor: 'text-rose-700',
      countBadge: 'bg-white text-rose-700 border-rose-200',
      bodyBg: 'bg-rose-50/35',
      btnStyle: 'border-rose-200/80 hover:border-rose-400 hover:bg-rose-50',
      numBadge: 'bg-rose-50 text-rose-700 border-rose-200 group-hover:bg-rose-100',
      textHover: 'group-hover:text-rose-700',
      chevronColor: 'text-rose-400 group-hover:text-rose-600',
      reports: [
        { id: 'loan-disbursement-register', name: 'कर्ज वाटप रजिस्टर (कर्ज प्रकारानुसार)' },
        { id: 'loan-collection-register', name: 'कर्ज वसुली रजिस्टर (कर्ज प्रकारानुसार)' },
        { id: 'loan-ledger-report', name: 'कर्ज खतावणी (Loan Ledger)' },
        { id: 'loan-outstanding-report', name: 'कर्ज येणे बाकी व जनरल अहवाल (Loan Outstanding)' },
        { id: 'closed-loan-report', name: 'बंद झालेले कर्ज खाते अहवाल (Closed Loan Report)' },
        { id: 'loan-overdue-report', name: 'थकीत कर्ज यादी (Overdue Loan List)' },
        { id: 'loan-recovery-notice-report', name: 'लवादपूर्व कर्ज फेडीची नोटीस (Notice Report)' },
        { id: 'guarantor-loan-report', name: 'सभासद जामीनदार अहवाल (Guarantor Report)' },
        { id: 'gold-jewelry-report', name: 'सोने तारण जिन्नस यादी (Gold Jewelry List)' },
        { id: 'npa-register', name: 'NPA तरतूद माहिती (NPA Register)' },
        { id: 'interest-waiver-register', name: 'कर्ज व्याज सूट व तडजोड अहवाल (OTS & Waiver)' },
        { id: 'loan-rate', name: 'कर्ज व्याजदर पत्रक (Loan Rate Chart)' },
      ]
    },
    {
      title: '३. खातेदार, सभासद व शेअर्स अहवाल (Customer, Member & Shares)',
      icon: <Users className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-12',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
      cardBorder: 'border-emerald-200 border-t-emerald-500',
      headerBg: 'bg-emerald-50 border-emerald-200',
      iconBox: 'bg-white border-emerald-300 text-emerald-600',
      titleColor: 'text-emerald-700',
      countBadge: 'bg-white text-emerald-700 border-emerald-200',
      bodyBg: 'bg-emerald-50/35',
      btnStyle: 'border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-50',
      numBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200 group-hover:bg-emerald-100',
      textHover: 'group-hover:text-emerald-700',
      chevronColor: 'text-emerald-400 group-hover:text-emerald-600',
      reports: [
        { id: 'customer-list-report', name: 'खातेदार यादी (Customer / CIF List)' },
        { id: 'customer-opening-balance-report', name: 'खातेदार आरंभी बाकी अहवाल (Opening Balance)' },
        { id: 'member-list-report', name: 'सभासद यादी (Member List)' },
        { id: 'aadhaar-list', name: 'आधार कार्ड यादी (Aadhaar Card List)' },
        { id: 'member-balance-report', name: 'सभासद शेअर्स बाकी यादी (Member Shares List)' },
        { id: 'share-certificate-report', name: 'अधिकृत शेअर प्रमाणपत्र (Official Share Certificate)' },
        { id: 'sabhasad-labhansh-report', name: 'सभासद लाभांश यादी (Dividend List)' },
        { id: 'shares-khatavani-report', name: 'शेअर्स खतावणी (Shares Ledger)' },
        { id: 'cbs-sample-report', name: 'सीबीएस ऑडिट नमुना अहवाल (CBS Sample Report)' },
        { id: 'i-namuna-report', name: 'वैधानिक नमूना आय रजिस्टर (I-Namuna)' },
        { id: 'voter-list-report', name: 'मतदार यादी (Voter List - Form E-1)', spanFullOnSm: true },
      ]
    },
    {
      title: '४. मुदत ठेव विभाग अहवाल (Fixed Deposit - FD Reports)',
      icon: <Lock className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-12',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      cardBorder: 'border-amber-200 border-t-amber-500',
      headerBg: 'bg-amber-50 border-amber-200',
      iconBox: 'bg-white border-amber-300 text-amber-600',
      titleColor: 'text-amber-700',
      countBadge: 'bg-white text-amber-700 border-amber-200',
      bodyBg: 'bg-amber-50/35',
      btnStyle: 'border-amber-200/80 hover:border-amber-400 hover:bg-amber-50',
      numBadge: 'bg-amber-50 text-amber-700 border-amber-200 group-hover:bg-amber-100',
      textHover: 'group-hover:text-amber-700',
      chevronColor: 'text-amber-400 group-hover:text-amber-600',
      reports: [
        { id: 'fd-reports&reportType=Register', name: 'मुदत ठेव नोंदवही (FD Register)' },
        { id: 'fd-reports&reportType=Outstanding', name: 'मुदत ठेव बाकी अहवाल (FD Outstanding)' },
        { id: 'fd-reports&reportType=MaturityDue', name: 'मुदतपूर्ती देय अहवाल (Maturity Due)' },
        { id: 'fd-reports&reportType=MemberLedger', name: 'मुदत ठेव खातावणी अहवाल (FD Account Ledger)' },
        { id: 'fd-reports&reportType=AccrualProvision', name: 'मुदत ठेव व्याज तरतूद (FD Interest Provision)' },
        { id: 'fd-reports&reportType=VoucherPassing', name: 'मुदत ठेव व्हाउचर पासिंग अहवाल (Voucher Passing)' },
        { id: 'fd-reports&reportType=DeletedEntries', name: 'रद्द नोंदी व रोलबॅक अहवाल (Deleted & Rollback)' },
        { id: 'fd-reports&reportType=MigratedFD', name: 'स्थलांतरित मुदत ठेव यादी (Migrated FD Report)' },
        { id: 'fd-customer-summary', name: 'ग्राहक-निहाय एकत्रित ठेवी (CBS Customer Summary)' }
      ]
    },
    {
      title: '५. आवर्ती ठेव विभाग अहवाल (Recurring Deposit - RD Reports)',
      icon: <PiggyBank className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-12',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      cardBorder: 'border-violet-200 border-t-violet-500',
      headerBg: 'bg-violet-50 border-violet-200',
      iconBox: 'bg-white border-violet-300 text-violet-600',
      titleColor: 'text-violet-700',
      countBadge: 'bg-white text-violet-700 border-violet-200',
      bodyBg: 'bg-violet-50/35',
      btnStyle: 'border-violet-200/80 hover:border-violet-400 hover:bg-violet-50',
      numBadge: 'bg-violet-50 text-violet-700 border-violet-200 group-hover:bg-violet-100',
      textHover: 'group-hover:text-violet-700',
      chevronColor: 'text-violet-400 group-hover:text-violet-600',
      reports: [
        { id: 'rd-reports&reportType=register', name: 'आरडी नोंदवही (RD Register)' },
        { id: 'rd-reports&reportType=outstanding', name: 'आरडी बाकी अहवाल (RD Outstanding)' },
        { id: 'rd-reports&reportType=defaulters', name: 'थकीत खातेदार यादी (RD Defaulters)' },
        { id: 'rd-reports&reportType=maturity', name: 'मुदतपूर्ती देय अहवाल (Maturity Due)' },
        { id: 'rd-reports&reportType=closed', name: 'खाते बंद अहवाल (Closure Report)' },
        { id: 'rd-khatavani-report', name: 'आरडी खतावणी (RD Khatavani / Ledger)' }
      ]
    },
    {
      title: '६. पिग्मी ठेव विभाग अहवाल (Pigmy Deposit Reports)',
      icon: <PiggyBank className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-6',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2',
      cardBorder: 'border-teal-200 border-t-teal-500',
      headerBg: 'bg-teal-50 border-teal-200',
      iconBox: 'bg-white border-teal-300 text-teal-600',
      titleColor: 'text-teal-700',
      countBadge: 'bg-white text-teal-700 border-teal-200',
      bodyBg: 'bg-teal-50/35',
      btnStyle: 'border-teal-200/80 hover:border-teal-400 hover:bg-teal-50',
      numBadge: 'bg-teal-50 text-teal-700 border-teal-200 group-hover:bg-teal-100',
      textHover: 'group-hover:text-teal-700',
      chevronColor: 'text-teal-400 group-hover:text-teal-600',
      reports: [
        { id: 'pigmy-reports&reportType=collection-register', name: 'पिग्मी दैनंदिन वसुली नोंदवही (Collection Register)' },
        { id: 'pigmy-reports&reportType=account-register', name: 'पिग्मी खाती नोंदवही (Pigmy Accounts Register)' },
        { id: 'pigmy-daybook', name: 'एजंट रोख ताळमेळ (Daily Settlement / Daybook)' },
        { id: 'pigmy-commission', name: 'एजंट कमिशन विवरणपत्रक (Commission Statement)' },
        { id: 'pigmy-khatavani-report', name: 'पिग्मी ठेव खतावणी (Pigmy Khatavani / Ledger)', spanFullOnSm: true }
      ]
    },
    {
      title: '७. गुंतवणूक विभाग व ऑडिट शेड्यूल (Investment & Audit)',
      icon: <FileText className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-6',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2',
      cardBorder: 'border-indigo-200 border-t-indigo-500',
      headerBg: 'bg-indigo-50 border-indigo-200',
      iconBox: 'bg-white border-indigo-300 text-indigo-600',
      titleColor: 'text-indigo-700',
      countBadge: 'bg-white text-indigo-700 border-indigo-200',
      bodyBg: 'bg-indigo-50/35',
      btnStyle: 'border-indigo-200/80 hover:border-indigo-400 hover:bg-indigo-50',
      numBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200 group-hover:bg-indigo-100',
      textHover: 'group-hover:text-indigo-700',
      chevronColor: 'text-indigo-400 group-hover:text-indigo-600',
      reports: [
        { id: 'inv-reports&reportType=summary', name: 'गुंतवणूक सारांश (Investment Summary)' },
        { id: 'inv-reports&reportType=list', name: 'गुंतवणूक नोंदवही (Investment Register)' },
        { id: 'inv-reports&reportType=maturityDue', name: 'मुदतपूर्ती देय अहवाल (Maturity Schedule)' },
        { id: 'inv-reports&reportType=accrued', name: 'संचित / येणे व्याज अहवाल (Accrued Interest)' },
        { id: 'inv-reports&reportType=auditSchedule', name: 'वैधानिक ऑडिट नमुना - गुंतवणूक शेड्यूल (Audit Schedule)', spanFullOnSm: true }
      ]
    },
    {
      title: '८. लॉकर विभाग अहवाल (Locker Reports)',
      icon: <KeyRound className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-6',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2',
      cardBorder: 'border-cyan-200 border-t-cyan-500',
      headerBg: 'bg-cyan-50 border-cyan-200',
      iconBox: 'bg-white border-cyan-300 text-cyan-600',
      titleColor: 'text-cyan-700',
      countBadge: 'bg-white text-cyan-700 border-cyan-200',
      bodyBg: 'bg-cyan-50/35',
      btnStyle: 'border-cyan-200/80 hover:border-cyan-400 hover:bg-cyan-50',
      numBadge: 'bg-cyan-50 text-cyan-700 border-cyan-200 group-hover:bg-cyan-100',
      textHover: 'group-hover:text-cyan-700',
      chevronColor: 'text-cyan-400 group-hover:text-cyan-600',
      reports: [
        { id: 'locker-reports&reportType=occupancy', name: 'लॉकर उपलब्धता व स्थिती अहवाल (Locker Occupancy)' },
        { id: 'locker-reports&reportType=allotment', name: 'लॉकर वाटप नोंदवही (Allotment Register)' },
        { id: 'locker-reports&reportType=visits', name: 'लॉकर व्हिजिट ऑडिट रजिस्टर (Visit Audit Log)' },
        { id: 'locker-reports&reportType=notices', name: 'थकीत भाडे नोटीस अहवाल (Overdue Rent Notice)' }
      ]
    },
    {
      title: '९. एन.पी.ए. व कलम १०१ कायदेशीर वसुली (NPA & Legal Recovery)',
      icon: <Scale className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-6',
      gridColsClass: 'grid-cols-1 sm:grid-cols-2',
      cardBorder: 'border-orange-200 border-t-orange-500',
      headerBg: 'bg-orange-50 border-orange-200',
      iconBox: 'bg-white border-orange-300 text-orange-600',
      titleColor: 'text-orange-700',
      countBadge: 'bg-white text-orange-700 border-orange-200',
      bodyBg: 'bg-orange-50/35',
      btnStyle: 'border-orange-200/80 hover:border-orange-400 hover:bg-orange-50',
      numBadge: 'bg-orange-50 text-orange-700 border-orange-200 group-hover:bg-orange-100',
      textHover: 'group-hover:text-orange-700',
      chevronColor: 'text-orange-400 group-hover:text-orange-600',
      reports: [
        { id: 'npa-statement', name: 'एन.पी.ए. वैधानिक विवरणपत्र (NPA Statement)' },
        { id: 'npa-defaulters', name: 'एन.पी.ए. थकबाकीदार यादी (NPA Defaulters List)' },
        { id: 'collateral-compliance', name: 'तारण व कागदपत्र पूर्तता अहवाल (Collateral Compliance)' },
        { id: 'sec101-reports', name: 'कलम १०१ दावे व वसुली खर्च अहवाल (Sec 101 Legal Reports)' }
      ]
    },
    {
      title: '१०. बचत ठेव विभाग अहवाल (Saving Deposit Reports)',
      icon: <PiggyBank className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-6',
      gridColsClass: 'grid-cols-1 sm:grid-cols-3',
      cardBorder: 'border-green-200 border-t-green-500',
      headerBg: 'bg-green-50 border-green-200',
      iconBox: 'bg-white border-green-300 text-green-600',
      titleColor: 'text-green-700',
      countBadge: 'bg-white text-green-700 border-green-200',
      bodyBg: 'bg-green-50/35',
      btnStyle: 'border-green-200/80 hover:border-green-400 hover:bg-green-50',
      numBadge: 'bg-green-50 text-green-700 border-green-200 group-hover:bg-green-100',
      textHover: 'group-hover:text-green-700',
      chevronColor: 'text-green-400 group-hover:text-green-600',
      reports: [
        { id: 'saving-account-list-report', name: 'बचत खाते यादी (Account List)' },
        { id: 'saving-khatavani-report', name: 'बचत ठेव खतावणी (Saving Ledger)' },
        { id: 'saving-passbook', name: 'बचत पासबुक छपाई (Passbook Print)' }
      ]
    },
    {
      title: '११. मालमत्ता व्यवस्थापन / डेडस्टॉक अहवाल (Assets & Deadstock)',
      icon: <Building className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-6',
      gridColsClass: 'grid-cols-1 sm:grid-cols-3',
      cardBorder: 'border-fuchsia-200 border-t-fuchsia-500',
      headerBg: 'bg-fuchsia-50 border-fuchsia-200',
      iconBox: 'bg-white border-fuchsia-300 text-fuchsia-600',
      titleColor: 'text-fuchsia-700',
      countBadge: 'bg-white text-fuchsia-700 border-fuchsia-200',
      bodyBg: 'bg-fuchsia-50/35',
      btnStyle: 'border-fuchsia-200/80 hover:border-fuchsia-400 hover:bg-fuchsia-50',
      numBadge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 group-hover:bg-fuchsia-100',
      textHover: 'group-hover:text-fuchsia-700',
      chevronColor: 'text-fuchsia-400 group-hover:text-fuchsia-600',
      reports: [
        { id: 'asset-reports&reportType=register', name: 'मालमत्ता नोंदवही (Asset Register)' },
        { id: 'asset-reports&reportType=depreciation', name: 'घसारा पत्रक अहवाल (Depreciation)' },
        { id: 'asset-reports&reportType=maintenance', name: 'देखभाल खर्च अहवाल (Maintenance)' }
      ]
    },
    {
      title: '१२. सुरक्षा व सिस्टीम ऑडीट (Security & Audit)',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      colSpanClass: 'lg:col-span-4',
      gridColsClass: 'grid-cols-1',
      cardBorder: 'border-purple-200 border-t-purple-500',
      headerBg: 'bg-purple-50 border-purple-200',
      iconBox: 'bg-white border-purple-300 text-purple-600',
      titleColor: 'text-purple-700',
      countBadge: 'bg-white text-purple-700 border-purple-200',
      bodyBg: 'bg-purple-50/35',
      btnStyle: 'border-purple-200/80 hover:border-purple-400 hover:bg-purple-50',
      numBadge: 'bg-purple-50 text-purple-700 border-purple-200 group-hover:bg-purple-100',
      textHover: 'group-hover:text-purple-700',
      chevronColor: 'text-purple-400 group-hover:text-purple-600',
      reports: [
        { id: 'audit-logs', name: 'सिस्टीम ऑडीट ट्रेल अहवाल (System Audit Trail Log)' }
      ]
    }
  ];

  const totalReportsCount = reportModules.reduce((sum, mod) => sum + mod.reports.length, 0);

  const upcomingReports = [
    'दैनंदिन व्हाउचर',
    'शेअर्स रजिस्टर',
    'पिग्मी यादी',
    'खर्च / उत्पन्न तपशील'
  ];

  const handleReportClick = (reportId: string) => {
    if (reportId.includes('&')) {
      const [tab, queryString] = reportId.split('&');
      const params: Record<string, string> = {};
      new URLSearchParams(queryString).forEach((val, key) => {
        params[key] = val;
      });
      if (setActiveTab) {
        setActiveTab(tab, params);
      } else {
        window.location.href = `/?tab=${tab}&${queryString}`;
      }
    } else {
      if (setActiveTab) {
        setActiveTab(reportId);
      } else {
        window.location.href = `/?tab=${reportId}`;
      }
    }
  };

  return (
    <div className="p-3 min-h-full flex flex-col bg-slate-50 text-[11px] font-sans space-y-3">
      
      {/* Theme-Shaded Header Banner (Matches FD Account Opening soft theme banner) */}
      <div className="bg-primary/10 border border-primary/30 rounded-sm px-3.5 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/15 text-primary border border-primary/30 rounded-sm">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-primary tracking-wide leading-tight">
              सर्व रिपोर्ट केंद्र (Reports Dashboard)
            </h1>
            <p className="text-[10.5px] text-slate-600 font-medium">
              संस्थेचे विभागनिहाय सर्व वैधानिक, आर्थिक व कामकाज अहवाल (Co-operative Society Centralized Reports)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-white border border-primary/30 text-primary rounded-sm text-[10.5px] font-bold shadow-2xs">
            एकूण विभाग: {reportModules.length}
          </span>
          <span className="px-2.5 py-1 bg-primary/15 border border-primary/30 text-primary rounded-sm text-[10.5px] font-bold shadow-2xs">
            एकूण अहवाल: {totalReportsCount}
          </span>
        </div>
      </div>

      {/* 12-Column Balanced Modules Grid with Module-wise Soft Color Shades */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {reportModules.map((module, idx) => (
          <div 
            key={idx} 
            className={`${module.colSpanClass} bg-white rounded-sm shadow-2xs border ${module.cardBorder} border-t-2 flex flex-col overflow-hidden`}
          >
            {/* Card Header with Module Soft Color Shade */}
            <div className={`px-3 py-1.5 flex items-center justify-between gap-2 border-b ${module.headerBg}`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 ${module.iconBox}`}>
                  {module.icon}
                </div>
                <h2 className={`text-xs font-bold ${module.titleColor} tracking-wide truncate`}>
                  {module.title}
                </h2>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-sm border flex-shrink-0 ${module.countBadge}`}>
                {module.reports.length} अहवाल
              </span>
            </div>
            
            {/* Card Body with Module Light Tint */}
            <div className={`p-2.5 ${module.bodyBg} grid ${module.gridColsClass} gap-2 content-start flex-1`}>
              {module.reports.map((report, rIdx) => (
                <button
                  key={report.id}
                  onClick={() => handleReportClick(report.id)}
                  title={report.name}
                  className={`${report.spanFullOnSm ? 'sm:col-span-2' : ''} flex items-center justify-between gap-2 px-2.5 h-[32px] bg-white border ${module.btnStyle} transition-all text-left w-full group rounded-sm cursor-pointer shadow-2xs`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`w-5 h-5 rounded-sm border text-[10px] font-bold flex items-center justify-center flex-shrink-0 transition-colors ${module.numBadge}`}>
                      {rIdx + 1}
                    </span>
                    <span className={`text-[11px] font-semibold text-slate-700 ${module.textHover} leading-tight truncate`}>
                      {report.name}
                    </span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${module.chevronColor}`} />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Upcoming Section paired alongside Module 12 (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-sm shadow-2xs border border-slate-200 border-t-2 border-t-slate-400 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-100/80">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-sm bg-white border border-slate-300 text-slate-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xs font-bold text-slate-700 tracking-wide truncate">
                लवकरच येत आहेत (Upcoming Reports)
              </h2>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-sm bg-white text-slate-600 border border-slate-200 flex-shrink-0">
              {upcomingReports.length} अहवाल
            </span>
          </div>

          <div className="p-2.5 bg-slate-50/70 grid grid-cols-2 sm:grid-cols-4 gap-2 content-start flex-1">
            {upcomingReports.map((name, index) => (
              <div
                key={index}
                className="flex items-center gap-1.5 px-2.5 h-[32px] bg-white/90 border border-slate-200 text-slate-400 cursor-not-allowed rounded-sm"
                title="लवकरच येत आहे (Coming Soon)"
              >
                <Lock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                <span className="text-[11px] font-medium truncate">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
    </div>
  );
}

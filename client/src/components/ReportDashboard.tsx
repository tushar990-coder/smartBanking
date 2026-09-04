import React from 'react';
import { Calculator, Wallet, Users, PiggyBank, FileText, Lock, LayoutDashboard, Clock } from 'lucide-react';

interface ReportDashboardProps {
  setActiveTab: (tab: string) => void;
}

export default function ReportDashboard({ setActiveTab }: ReportDashboardProps) {
  const reportModules = [
    {
      title: 'अकाउंटिंग (Accounting)',
      icon: <Calculator className="w-3.5 h-3.5" />,
      accentColor: 'border-blue-600',
      iconColor: 'text-blue-700',
      bgColor: 'bg-blue-50',
      reports: [
        { id: 'daybook', name: 'रोजकीर्द (Daybook)' },
        { id: 'daybook-summary', name: 'रोजकीर्द (Daybook Summary)' },
        { id: 'cash-book', name: 'रोख पुस्तक (Cash Book)' },
        { id: 'general-ledger', name: 'जनरल लेजर (General Ledger)' },
        { id: 'trial-balance', name: 'तेरीज (Trial Balance)' },
        { id: 'trial-balance-namuna-n', name: 'तेरीज पत्रक (नमुना N)' },
        { id: 'profit-loss', name: 'नफा-तोटा पत्रक (P&L A/c)' },
        { id: 'balance-sheet', name: 'ताळेबंद (Balance Sheet)' },
        { id: 'balance-sheet-form-n', name: 'ताळेबंद (नमुना न)' },
        { id: 'voucher-batch-print', name: 'व्हाउचर प्रिंटिंग (Voucher Print)' },
      ]
    },
    {
      title: 'कर्ज विभाग (Loan)',
      icon: <Wallet className="w-3.5 h-3.5" />,
      accentColor: 'border-red-700',
      iconColor: 'text-red-700',
      bgColor: 'bg-red-50',
      reports: [
        { id: 'loan-disbursement-register', name: 'कर्ज वाटप रजिस्टर (कर्ज प्रकारानुसार)' },
        { id: 'loan-collection-register', name: 'कर्ज वसुली रजिस्टर (कर्ज प्रकारानुसार)' },
        { id: 'loan-ledger-report', name: 'कर्ज खतावणी (Loan Ledger)' },
        { id: 'loan-overdue-report', name: 'थकीत कर्ज यादी (Overdue Loan List)' },
        { id: 'loan-recovery-notice-report', name: 'लवादपूर्व कर्ज फेडीची नोटीस (Notice Report)' },
        { id: 'guarantor-loan-report', name: 'सभासद जामीनदार अहवाल (Guarantor Loan Report)' },
        { id: 'gold-jewelry-report', name: 'सोने जिन्नस यादी (Gold Jewelry List)' },
        { id: 'npa-register', name: 'NPA तरतूद माहिती (NPA Register)' },
        { id: 'interest-waiver-register', name: 'कर्ज व्याज सूट व तडजोड अहवाल (OTS & Waiver Register)' },
        { id: 'loan-rate', name: 'कर्ज दर पत्रक (Loan Rate)' },
      ]
    },
    {
      title: 'सभासद व शेअर्स (Member & Shares)',
      icon: <Users className="w-3.5 h-3.5" />,
      accentColor: 'border-emerald-700',
      iconColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      reports: [
        { id: 'member-list-report', name: 'सभासद यादी (Member List)' },
        { id: 'aadhaar-list', name: 'आधार कार्ड यादी (Aadhaar Card List)' },
        { id: 'member-balance-report', name: 'सभासद शेअर्स यादी (Member Shares List)' },
        { id: 'share-certificate-report', name: 'अधिकृत शेअर प्रमाणपत्र प्रिव्ह्यू (Share Certificate)' },
        { id: 'sabhasad-labhansh-report', name: 'सभासद लाभांश यादी (Dividend List)' },
        { id: 'shares-khatavani-report', name: 'शेअर्स खतावणी (Shares Ledger)' },
        { id: 'cbs-sample-report', name: '⭐ सीबीएस ऑडिट नमुना अहवाल (CBS Sample Report v2.4)' },
        { id: 'i-namuna-report', name: 'नमूना आय (I-Namuna)' },
        { id: 'voter-list-report', name: 'मतदार यादी (Voter List - Form E-1)' },
      ]
    },
    {
      title: 'बचत ठेव (Saving)',
      icon: <PiggyBank className="w-3.5 h-3.5" />,
      accentColor: 'border-amber-600',
      iconColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      reports: [
        { id: 'saving-account-list-report', name: 'बचत खाते यादी (Saving Account List)' },
        { id: 'saving-khatavani-report', name: 'बचत ठेव खतावणी (Saving Ledger)' }
      ]
    },
    {
      title: 'पिग्मी ठेव (Pigmy Deposit)',
      icon: <PiggyBank className="w-3.5 h-3.5" />,
      accentColor: 'border-teal-600',
      iconColor: 'text-teal-700',
      bgColor: 'bg-teal-50',
      reports: [
        { id: 'pigmy-reports&reportType=register', name: '१. पिग्मी ठेव नोंदवही (Pigmy Register)' },
        { id: 'pigmy-reports&reportType=settlement', name: '२. एजंट रोख ताळमेळ (Daily Settlement)' },
        { id: 'pigmy-reports&reportType=commission', name: '३. एजंट कमिशन विवरणपत्रक (Commission Statement)' },
        { id: 'pigmy-reports&reportType=ledger', name: '४. पिग्मी खाते लेजर (Account Ledger)' }
      ]
    },
    {
      title: 'आवर्ती ठेव (RD)',
      icon: <PiggyBank className="w-3.5 h-3.5" />,
      accentColor: 'border-purple-600',
      iconColor: 'text-purple-700',
      bgColor: 'bg-purple-50',
      reports: [
        { id: 'rd-reports&reportType=register', name: '१. आरडी नोंदवही (RD Register)' },
        { id: 'rd-reports&reportType=outstanding', name: '२. आरडी बाकी अहवाल (Outstanding)' },
        { id: 'rd-reports&reportType=defaulters', name: '३. थकीत खातेदार (Defaulters)' },
        { id: 'rd-reports&reportType=maturity', name: '४. मुदतपूर्ती देय (Maturity Due)' },
        { id: 'rd-reports&reportType=closed', name: '५. खाते बंद अहवाल (Closure Report)' }
      ]
    },
    {
      title: 'मुदत ठेव (FD)',
      icon: <Lock className="w-3.5 h-3.5" />,
      accentColor: 'border-orange-600',
      iconColor: 'text-orange-700',
      bgColor: 'bg-orange-50',
      reports: [
        { id: 'fd-reports&reportType=Register', name: '१. मुदत ठेव नोंदवही (FD Register)' },
        { id: 'fd-reports&reportType=Outstanding', name: '२. मुदत ठेव बाकी अहवाल (FD Outstanding)' },
        { id: 'fd-reports&reportType=MaturityDue', name: '३. मुदतपूर्ती देय अहवाल (Maturity Due)' },
        { id: 'fd-reports&reportType=MemberLedger', name: '✨ ४. मुदत ठेव खातावणी अहवाल (Member FD Ledger Statement)' },
        { id: 'fd-accrual', name: '⚡ ५. मुदत ठेव व्याज तरतूद अहवाल / रन (FD Interest Provision)' }
      ]
    },
    {
      title: 'गुंतवणूक विभाग व ऑडिट शेड्यूल (Investment & Audit)',
      icon: <FileText className="w-3.5 h-3.5" />,
      accentColor: 'border-blue-700',
      iconColor: 'text-blue-800',
      bgColor: 'bg-blue-50',
      reports: [
        { id: 'inv-reports&reportType=summary', name: '१. गुंतवणूक सारांश (Investment Summary)' },
        { id: 'inv-reports&reportType=list', name: '२. गुंतवणूक नोंदवही (Investment Register)' },
        { id: 'inv-reports&reportType=maturityDue', name: '३. मुदतपूर्ती देय अहवाल (Maturity Schedule)' },
        { id: 'inv-reports&reportType=accrued', name: '४. संचित / येणे व्याज अहवाल (Accrued Interest)' },
        { id: 'inv-reports&reportType=auditSchedule', name: '५. वैधानिक ऑडिट नमुना - गुंतवणूक शेड्यूल (Statutory Audit Schedule)' }
      ]
    },
    {
      title: 'सुरक्षा व ऑडीट (Security & Audit)',
      icon: <FileText className="w-3.5 h-3.5" />,
      accentColor: 'border-indigo-600',
      iconColor: 'text-indigo-700',
      bgColor: 'bg-indigo-50',
      reports: [
        { id: 'audit-logs', name: '🛡️ सिस्टीम ऑडीट रिपोर्ट (Audit Trail Log)' }
      ]
    }
  ];

  const upcomingReports = [
    'दैनंदिन व्हाउचर', 
    'शेअर्स रजिस्टर', 
    'पिग्मी यादी',
    'खर्च / उत्पन्न तपशील'
  ];

  return (
    <div className="p-2 h-full flex flex-col bg-gray-50 text-[11px] font-sans">
      
      {/* Header Section */}
      <div className="bg-white border-b border-primary p-2 mb-2 shadow-sm flex items-center gap-2">
        <div className="p-1 bg-primary text-white rounded-sm">
          <LayoutDashboard className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-[12px] font-bold text-gray-800 tracking-wide">
            रिपोर्ट्स डॅशबोर्ड
          </h1>
          <p className="text-[10px] text-gray-500 font-medium leading-none">
            संस्थेचे सर्व आवश्यक अहवाल (Co-operative Society Reports)
          </p>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {reportModules.map((module, idx) => (
          <div 
            key={idx} 
            className={`bg-white shadow-sm border border-gray-200 border-t-2 ${module.accentColor} flex flex-col`}
          >
            {/* Card Header */}
            <div className={`px-2 py-1.5 flex items-center gap-2 border-b border-gray-200 ${module.bgColor}`}>
              <div className={`${module.iconColor}`}>
                {module.icon}
              </div>
              <h2 className={`text-[11px] font-bold ${module.iconColor} uppercase tracking-wider`}>
                {module.title}
              </h2>
            </div>
            
            {/* Card Body */}
            <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 flex-1">
              {module.reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => window.open(`/?tab=${report.id}`, '_blank')}
                  className="flex items-center gap-1.5 p-1.5 bg-white border border-gray-200 hover:border-primary hover:bg-[#f0f7fb] hover:text-primary transition-colors text-left w-full group rounded-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary flex-shrink-0" />
                  <span className="text-[11px] font-medium text-gray-700 group-hover:text-primary leading-tight truncate">
                    {report.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming Section */}
      <div className="bg-gray-100 border border-gray-200 p-2 shadow-inner mt-auto">
        <div className="flex items-center gap-1.5 mb-2 border-b border-gray-200 pb-1">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">लवकरच येत आहेत (Upcoming)</h2>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
          {upcomingReports.map((name, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 p-1 bg-white border border-gray-200 text-gray-400 cursor-not-allowed rounded-sm"
              title="लवकरच येत आहे (Coming Soon)"
            >
              <Lock className="w-3 h-3 flex-shrink-0" />
              <span className="text-[10px] font-medium truncate">{name}</span>
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}

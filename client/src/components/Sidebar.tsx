import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  LayoutDashboard, 
  BellRing, 
  UserCheck, 
  Users, 
  Award, 
  TrendingDown, 
  Wallet, 
  Building2, 
  Clock, 
  Coins, 
  Receipt, 
  BarChart3, 
  Building, 
  KeyRound, 
  Scale, 
  Gavel, 
  Moon, 
  Calculator, 
  ShieldCheck, 
  FileSpreadsheet, 
  FileText,
  FileCheck,
  Settings, 
  UserCog,
  LogOut,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  activeTab: string;
  handleNavigate: (tab: string, params?: any) => void;
  user: any;
  logout: () => void;
}

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  handleNavigate,
  user,
  logout
}: SidebarProps) {
  
  // Helpers to detect active state
  const isSharesActive = activeTab === 'members' || activeTab === 'share-master' || activeTab === 'share-transfer' || activeTab === 'member-closure' || activeTab === 'share-withdrawal';
  const isLoanActive = activeTab === 'loan' || activeTab.startsWith('loan') || activeTab === 'gold-loan-details' || activeTab === 'employee-bank' || activeTab === 'employer-master';
  const isSavingActive = activeTab === 'saving' || activeTab === 'saving-account' || activeTab === 'saving-transaction' || activeTab === 'saving-setting' || activeTab === 'saving-posting' || activeTab === 'saving-closing' || activeTab === 'saving-passbook';
  const isFdActive = activeTab === 'fd' || activeTab.startsWith('fd-');
  const isRdActive = activeTab === 'rd' || activeTab === 'rd-migrate' || activeTab === 'rd-account' || activeTab === 'rd-collect' || activeTab === 'rd-withdrawal' || activeTab === 'rd-accrual' || activeTab === 'rd-reports';
  const isPigmyActive = activeTab === 'pigmy' || activeTab.startsWith('pigmy');
  const isVoucherActive = activeTab === 'voucher' || activeTab === 'voucher-posting' || activeTab === 'voucher-batch-print';
  const isCashierActive = activeTab === 'cashier-dashboard' || activeTab === 'cash-management' || activeTab === 'cash-allocation' || activeTab === 'cash-denomination';
  const isInvActive = activeTab === 'investment' || activeTab.startsWith('inv-');
  const isAssetActive = activeTab === 'assets' || activeTab.startsWith('asset-');
  const isLockerActive = activeTab === 'locker' || activeTab.startsWith('locker-');
  const isNpaActive = activeTab === 'npa-dashboard' || activeTab === 'npa-statement' || activeTab === 'collateral-compliance' || activeTab === 'npa-defaulters';
  const isLegalActive = activeTab === 'legal-recovery' || activeTab.startsWith('sec101-');
  const isReportsActive = activeTab === 'reports' || activeTab === 'trial-balance' || activeTab === 'trial-balance-namuna-n' || activeTab === 'daybook' || activeTab === 'daybook-summary' || activeTab === 'profit-loss' || activeTab === 'balance-sheet' || activeTab === 'balance-sheet-form-n' || activeTab === 'general-ledger' || activeTab === 'member-balance-report' || activeTab === 'loan-disbursement-register' || activeTab === 'loan-collection-register' || activeTab === 'loan-ledger-report' || activeTab === 'loan-outstanding-report' || activeTab === 'loan-overdue-report' || activeTab === 'saving-account-list-report' || activeTab === 'saving-khatavani-report' || activeTab === 'npa-register' || activeTab === 'loan-rate' || activeTab === 'sabhasad-labhansh-report' || activeTab === 'shares-khatavani-report';

  const getItemClass = (isActive: boolean) => `
    w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 select-none group ${
      isActive 
        ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 backdrop-blur-md shadow-2xs relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-r-full before:bg-emerald-600' 
        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
    }
  `;

  const getSubItemClass = (isActive: boolean) => `
    px-2 py-0.5 cursor-pointer flex items-center transition-all text-[10.5px] rounded-md select-none ${
      isActive 
        ? 'text-emerald-800 font-bold bg-emerald-500/15 border border-emerald-500/20 shadow-2xs' 
        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
    }
  `;

  return (
    <aside 
      className={`relative flex flex-col z-30 h-full print:hidden transition-all duration-200 ease-in-out shrink-0 select-none overflow-hidden ${
        isSidebarOpen ? 'w-48 sm:w-50' : 'w-12'
      } backdrop-blur-xl bg-white/80 border-r border-white/70 shadow-xs`}
    >
      {/* Top Header Bar */}
      <div className={`h-9 flex items-center border-b border-white/60 shrink-0 bg-white/50 backdrop-blur-md relative z-10 ${
        isSidebarOpen ? 'justify-between px-2.5' : 'justify-center px-1'
      }`}>
        {isSidebarOpen ? (
          <>
            <div className="flex items-center space-x-1.5 truncate">
              <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-[10px] shadow-2xs border border-emerald-400/40 shrink-0">
                S
              </div>
              <span className="text-[11px] font-black text-slate-800 tracking-wide truncate">
                SMART <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">BANKING</span>
              </span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="text-slate-400 hover:text-emerald-700 p-0.5 rounded hover:bg-white/80 transition-all shrink-0 cursor-pointer"
              title="साईडबार बंद करा"
            >
              <ChevronLeft size={14} />
            </button>
          </>
        ) : (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-6 h-6 rounded-md bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-400/40 flex items-center justify-center font-black text-emerald-700 text-[10px] shadow-2xs hover:scale-105 transition-transform cursor-pointer"
            title="साईडबार उघडा"
          >
            S
          </button>
        )}
      </div>

      {/* Scrollable Navigation Items */}
      <div className="flex-1 overflow-y-auto py-1 px-1.5 space-y-0.5 custom-scrollbar relative z-10">

        {/* ========================================================================= */}
        {/* GROUP 1: MAIN DASHBOARD                                                   */}
        {/* ========================================================================= */}
        {isSidebarOpen && (
          <p className="px-2 pt-1 pb-0.5 text-[9px] font-black text-slate-400 tracking-wider uppercase flex items-center gap-1">
            <span>✨</span> मुख्य डॅशबोर्ड
          </p>
        )}

        <button 
          onClick={() => handleNavigate('dashboard')}
          title="डॅशबोर्ड"
          className={getItemClass(activeTab === 'dashboard')}
        >
          <LayoutDashboard size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">डॅशबोर्ड</span>}
        </button>

        <button 
          onClick={() => handleNavigate('todays-tasks')}
          title="आजची कामे"
          className={getItemClass(activeTab === 'todays-tasks')}
        >
          <BellRing size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'todays-tasks' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">आजची कामे</span>}
        </button>

        <button 
          onClick={() => handleNavigate('member-360')}
          title="खातेदार ३६०°"
          className={getItemClass(activeTab === 'member-360')}
        >
          <UserCheck size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'member-360' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार ३६०°</span>}
        </button>

        <button 
          onClick={() => handleNavigate('customers')}
          title="खातेदार"
          className={getItemClass(activeTab === 'customers')}
        >
          <Users size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'customers' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार</span>}
        </button>

        <button 
          onClick={() => handleNavigate('customer-bulk')}
          title="खातेदार बल्क नोंदणी (Excel Grid)"
          className={getItemClass(activeTab === 'customer-bulk')}
        >
          <FileSpreadsheet size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'customer-bulk' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार बल्क नोंदणी (Grid)</span>}
        </button>

        <button 
          onClick={() => handleNavigate('customer-list-report')}
          title="खातेदार यादी अहवाल"
          className={getItemClass(activeTab === 'customer-list-report')}
        >
          <FileText size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'customer-list-report' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार यादी अहवाल</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 2: BANKING MODULES                                                  */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[9px] font-black text-slate-400 tracking-wider uppercase border-t border-slate-200/60 mt-1 flex items-center gap-1">
            <span>🏛️</span> बँकिंग व्यवहार
          </p>
        ) : (
          <div className="border-t border-slate-200/60 my-1" />
        )}

        {/* Shares Module */}
        <button 
          onClick={() => handleNavigate('members')}
          title="सभासद नोंदणी व शेअर्स"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isSharesActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <Award size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isSharesActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">सभासद नोंदणी (Shares)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isSharesActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isSharesActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'members')} onClick={() => handleNavigate('members')}>
              <span className="truncate">&rsaquo; अर्ज व भाग वाटप</span>
            </li>
            <li className={getSubItemClass(activeTab === 'share-master')} onClick={() => handleNavigate('share-master')}>
              <span className="truncate">&rsaquo; अतिरिक्त शेअर वाटप</span>
            </li>
            <li className={getSubItemClass(activeTab === 'share-transfer')} onClick={() => handleNavigate('share-transfer')}>
              <span className="truncate">&rsaquo; शेअर हस्तांतरण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'member-closure')} onClick={() => handleNavigate('member-closure')}>
              <span className="truncate">&rsaquo; सभासदत्व समाप्ती</span>
            </li>
            <li className={getSubItemClass(activeTab === 'share-withdrawal')} onClick={() => handleNavigate('share-withdrawal')}>
              <span className="truncate">&rsaquo; शेअर परतावा</span>
            </li>
          </ul>
        )}

        {/* Loan Module */}
        <button 
          onClick={() => handleNavigate('loan')}
          title="कर्ज विभाग"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isLoanActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <TrendingDown size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLoanActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">कर्ज विभाग (Loans)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isLoanActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isLoanActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'loan' || activeTab === 'loan-process')} onClick={() => handleNavigate('loan-process')}>
              <span className="truncate">&rsaquo; कर्ज मागणी व वितरण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-ob' || activeTab === 'loan-opening')} onClick={() => handleNavigate('loan-ob')}>
              <span className="truncate">&rsaquo; कर्ज आरंभिक शिल्लक</span>
            </li>
            <li className={getSubItemClass(activeTab === 'gold-loan-details')} onClick={() => handleNavigate('gold-loan-details')}>
              <span className="truncate">&rsaquo; सुवर्ण कर्ज तारण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'gold-jewelry-report')} onClick={() => handleNavigate('gold-jewelry-report')}>
              <span className="truncate">&rsaquo; सोने जिन्नस यादी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-collection')} onClick={() => handleNavigate('loan-collection')}>
              <span className="truncate">&rsaquo; कर्ज वसुली नोंदी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-outstanding-report')} onClick={() => handleNavigate('loan-outstanding-report')}>
              <span className="truncate text-emerald-800 font-semibold">&rsaquo; कर्ज येणे बाकी अहवाल</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-interest-posting')} onClick={() => handleNavigate('loan-interest-posting')}>
              <span className="truncate">&rsaquo; कर्ज व्याज आकारणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-documents')} onClick={() => handleNavigate('loan-documents')}>
              <span className="truncate">&rsaquo; कर्ज कागदपत्रे</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-rate')} onClick={() => handleNavigate('loan-rate')}>
              <span className="truncate">&rsaquo; कर्ज योजना व व्याजदर</span>
            </li>
            <li className={getSubItemClass(activeTab === 'employer-master')} onClick={() => handleNavigate('employer-master')}>
              <span className="truncate">&rsaquo; नियोक्ता (Employer)</span>
            </li>
            <li className={getSubItemClass(activeTab === 'employee-bank')} onClick={() => handleNavigate('employee-bank')}>
              <span className="truncate">&rsaquo; कर्मचारी बँक खाती</span>
            </li>
          </ul>
        )}

        {/* Saving Module */}
        <button 
          onClick={() => handleNavigate('saving')}
          title="बचत ठेव"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isSavingActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <Wallet size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isSavingActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">बचत ठेव</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isSavingActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isSavingActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'saving-account')} onClick={() => handleNavigate('saving-account')}>
              <span className="truncate">&rsaquo; बचत खाती</span>
            </li>
            <li className={getSubItemClass(activeTab === 'saving-transaction')} onClick={() => handleNavigate('saving-transaction')}>
              <span className="truncate">&rsaquo; जमा/नावे व्यवहार</span>
            </li>
            <li className={getSubItemClass(activeTab === 'saving-posting')} onClick={() => handleNavigate('saving-posting')}>
              <span className="truncate">&rsaquo; व्याज आकारणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'saving-passbook')} onClick={() => handleNavigate('saving-passbook')}>
              <span className="truncate">&rsaquo; पासबुक प्रिंट</span>
            </li>
          </ul>
        )}

        {/* Fixed Deposit Module */}
        <button 
          onClick={() => handleNavigate('fd-account')}
          title="मुदत ठेव"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isFdActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <Building2 size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isFdActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">मुदत ठेव (FD)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isFdActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isFdActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'fd-account')} onClick={() => handleNavigate('fd-account')}>
              <span className="truncate">&rsaquo; नवीन ठेव खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-withdrawal')} onClick={() => handleNavigate('fd-withdrawal')}>
              <span className="truncate">&rsaquo; नूतनीकरण / परतावा</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-accrual')} onClick={() => handleNavigate('fd-accrual')}>
              <span className="truncate">&rsaquo; मुदत ठेव व्याज तरतूद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-reports')} onClick={() => handleNavigate('fd-reports')}>
              <span className="truncate">&rsaquo; मुदत ठेव अहवाल</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-customer-summary')} onClick={() => handleNavigate('fd-customer-summary')}>
              <span className="truncate">&rsaquo; मुदतबंद ठेव यादी (CBS)</span>
            </li>
          </ul>
        )}

        {/* Recurring Deposit Module */}
        <button 
          onClick={() => handleNavigate('rd-account')}
          title="आवर्ती ठेव"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isRdActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <Clock size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isRdActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">आवर्ती ठेव (RD)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isRdActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isRdActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'rd-account')} onClick={() => handleNavigate('rd-account')}>
              <span className="truncate">&rsaquo; नवीन आरडी खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-collect')} onClick={() => handleNavigate('rd-collect')}>
              <span className="truncate">&rsaquo; हप्ता संकलन</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-withdrawal')} onClick={() => handleNavigate('rd-withdrawal')}>
              <span className="truncate">&rsaquo; नूतनीकरण / परतावा</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-accrual')} onClick={() => handleNavigate('rd-accrual')}>
              <span className="truncate">&rsaquo; व्याज तरतूद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-reports')} onClick={() => handleNavigate('rd-reports')}>
              <span className="truncate">&rsaquo; आरडी अहवाल</span>
            </li>
          </ul>
        )}

        {/* Pigmy Module */}
        <button 
          onClick={() => handleNavigate('pigmy-account')}
          title="पिग्मी ठेव"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isPigmyActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <Coins size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isPigmyActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">पिग्मी ठेव</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isPigmyActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isPigmyActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'pigmy-account')} onClick={() => handleNavigate('pigmy-account')}>
              <span className="truncate">&rsaquo; नवीन पिग्मी खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy' || activeTab === 'pigmy-agent')} onClick={() => handleNavigate('pigmy-agent')}>
              <span className="truncate">&rsaquo; पिग्मी एजंट नोंदणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-collection' || activeTab === 'pigmy-collect')} onClick={() => handleNavigate('pigmy-collection')}>
              <span className="truncate">&rsaquo; दैनंदिन संकलन</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-daybook')} onClick={() => handleNavigate('pigmy-daybook')}>
              <span className="truncate">&rsaquo; एजंट डे-बुक नोंद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-commission')} onClick={() => handleNavigate('pigmy-commission')}>
              <span className="truncate">&rsaquo; कमिशन व्यवस्थापन</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-interest')} onClick={() => handleNavigate('pigmy-interest')}>
              <span className="truncate">&rsaquo; पिग्मी व्याज आकारणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-closure')} onClick={() => handleNavigate('pigmy-closure')}>
              <span className="truncate">&rsaquo; खाते बंद (Closure)</span>
            </li>
            <li className={getSubItemClass(activeTab.startsWith('pigmy-reports'))} onClick={() => handleNavigate('pigmy-reports')}>
              <span className="truncate">&rsaquo; पिग्मी अहवाल</span>
            </li>
          </ul>
        )}

        {/* Voucher Module */}
        <button 
          onClick={() => handleNavigate('voucher')}
          title="वाउचर / पावती"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isVoucherActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <Receipt size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isVoucherActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">वाउचर / पावती</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isVoucherActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isVoucherActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'voucher')} onClick={() => handleNavigate('voucher')}>
              <span className="truncate">&rsaquo; वाउचर नोंदणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'voucher-posting')} onClick={() => handleNavigate('voucher-posting')}>
              <span className="truncate">&rsaquo; वाउचर पासिंग</span>
            </li>
            <li className={getSubItemClass(activeTab === 'voucher-batch-print')} onClick={() => handleNavigate('voucher-batch-print')}>
              <span className="truncate">&rsaquo; बॅच प्रिंट</span>
            </li>
          </ul>
        )}

        {/* Cashier / Cash Management */}
        <button 
          onClick={() => handleNavigate('cashier-dashboard')}
          title="कॅश मॅनेजमेंट"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isCashierActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <Coins size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isCashierActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">कॅश मॅनेजमेंट</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isCashierActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isCashierActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'cashier-dashboard' || activeTab === 'cash-management')} onClick={() => handleNavigate('cashier-dashboard')}>
              <span className="truncate">&rsaquo; कॅशिअर डॅशबोर्ड</span>
            </li>
            <li className={getSubItemClass(activeTab === 'cash-allocation')} onClick={() => handleNavigate('cash-allocation')}>
              <span className="truncate">&rsaquo; रोख वाटप (Allocation)</span>
            </li>
            <li className={getSubItemClass(activeTab === 'cash-denomination')} onClick={() => handleNavigate('cash-denomination')}>
              <span className="truncate">&rsaquo; नोटांची मोजणी</span>
            </li>
          </ul>
        )}

        {/* Investment Module */}
        <button 
          onClick={() => handleNavigate('inv-institution')}
          title="गुंतवणूक"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isInvActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <BarChart3 size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isInvActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">गुंतवणूक (Investment)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isInvActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isInvActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'investment' || activeTab === 'inv-institution')} onClick={() => handleNavigate('inv-institution')}>
              <span className="truncate">&rsaquo; संस्था नोंदणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'inv-account')} onClick={() => handleNavigate('inv-account')}>
              <span className="truncate">&rsaquo; नवीन गुंतवणूक खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'inv-claim')} onClick={() => handleNavigate('inv-claim')}>
              <span className="truncate">&rsaquo; मुदतपूर्ती दावा</span>
            </li>
            <li className={getSubItemClass(activeTab === 'inv-accrual')} onClick={() => handleNavigate('inv-accrual')}>
              <span className="truncate">&rsaquo; व्याज तरतूद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'inv-reports')} onClick={() => handleNavigate('inv-reports')}>
              <span className="truncate">&rsaquo; गुंतवणूक अहवाल</span>
            </li>
          </ul>
        )}

        {/* Asset Management */}
        <button 
          onClick={() => handleNavigate('asset-category')}
          title="मालमत्ता"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isAssetActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <Building size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isAssetActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">मालमत्ता व्यवस्थापन</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isAssetActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isAssetActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'assets' || activeTab === 'asset-category')} onClick={() => handleNavigate('asset-category')}>
              <span className="truncate">&rsaquo; मालमत्ता वर्ग</span>
            </li>
            <li className={getSubItemClass(activeTab === 'asset-master')} onClick={() => handleNavigate('asset-master')}>
              <span className="truncate">&rsaquo; मालमत्ता मास्टर</span>
            </li>
            <li className={getSubItemClass(activeTab === 'asset-purchase')} onClick={() => handleNavigate('asset-purchase')}>
              <span className="truncate">&rsaquo; नवीन खरेदी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'asset-reports')} onClick={() => handleNavigate('asset-reports')}>
              <span className="truncate">&rsaquo; मालमत्ता अहवाल</span>
            </li>
          </ul>
        )}

        {/* Locker Module */}
        <button 
          onClick={() => handleNavigate('locker-dashboard')}
          title="लॉकर विभाग"
          className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isLockerActive 
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <div className="flex items-center truncate">
            <KeyRound size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLockerActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">लॉकर विभाग</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={12} className={`shrink-0 text-slate-400 transition-transform ${isLockerActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isLockerActive && (
          <ul className="pl-4 space-y-0.5 border-l border-emerald-500/30 ml-3 my-0.5 bg-white/20 rounded-r-lg py-0.5">
            <li className={getSubItemClass(activeTab === 'locker' || activeTab === 'locker-dashboard')} onClick={() => handleNavigate('locker-dashboard')}>
              <span className="truncate">&rsaquo; लॉकर डॅशबोर्ड</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-master')} onClick={() => handleNavigate('locker-master')}>
              <span className="truncate">&rsaquo; कपाट व इन्व्हेंटरी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-types')} onClick={() => handleNavigate('locker-types')}>
              <span className="truncate">&rsaquo; लॉकर प्रकार व दर</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-allotment')} onClick={() => handleNavigate('locker-allotment')}>
              <span className="truncate">&rsaquo; नवीन लॉकर वाटप</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-visit-register')} onClick={() => handleNavigate('locker-visit-register')}>
              <span className="truncate">&rsaquo; दैनिक व्हिजिट नोंद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-rent-renewal')} onClick={() => handleNavigate('locker-rent-renewal')}>
              <span className="truncate">&rsaquo; भाडे नूतनीकरण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-surrender')} onClick={() => handleNavigate('locker-surrender')}>
              <span className="truncate">&rsaquo; लॉकर समर्पण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-reports')} onClick={() => handleNavigate('locker-reports')}>
              <span className="truncate">&rsaquo; लॉकर अहवाल</span>
            </li>
          </ul>
        )}

        {/* NPA Module */}
        <button 
          onClick={() => handleNavigate('npa-dashboard')}
          title="एन.पी.ए. विभाग"
          className={getItemClass(isNpaActive)}
        >
          <Scale size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isNpaActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">एन.पी.ए. विभाग</span>}
        </button>

        {/* Legal Recovery 101 */}
        <button 
          onClick={() => handleNavigate('legal-recovery')}
          title="कलम १०१ कायदेशीर वसुली"
          className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 group ${
            isLegalActive 
              ? 'bg-amber-500/15 text-amber-950 font-bold border border-amber-500/30 shadow-2xs' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
          }`}
        >
          <Gavel size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLegalActive ? 'text-amber-600' : 'text-slate-500 group-hover:text-amber-600'}`} />
          {isSidebarOpen && <span className="truncate">कलम १०१ वसुली</span>}
        </button>

        {/* Committee Master */}
        <button 
          onClick={() => handleNavigate('committee')}
          title="पंच कमिटी (संचालक मंडळ)"
          className={getItemClass(activeTab === 'committee')}
        >
          <UserCheck size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'committee' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">संचालक मंडळ</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 3: UTILITIES                                                        */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[9px] font-black text-slate-400 tracking-wider uppercase border-t border-slate-200/60 mt-1 flex items-center gap-1">
            <span>⚙️</span> युटिलिटीज
          </p>
        ) : (
          <div className="border-t border-slate-200/60 my-1" />
        )}

        <button 
          onClick={() => handleNavigate('day-end')}
          title="दिवस समाप्ती (EOD)"
          className={getItemClass(activeTab === 'day-end' || activeTab === 'eod-dashboard')}
        >
          <Moon size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'day-end' || activeTab === 'eod-dashboard') ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">दिवस समाप्ती (EOD)</span>}
        </button>

        <button 
          onClick={() => handleNavigate('interest-calculator')}
          title="व्याज कॅल्क्युलेटर"
          className={getItemClass(activeTab === 'interest-calculator')}
        >
          <Calculator size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'interest-calculator' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">व्याज कॅल्क्युलेटर</span>}
        </button>

        <button 
          onClick={() => handleNavigate('audit-compliance')}
          title="सहकार ऑडीट व कम्प्लायन्स"
          className={getItemClass(activeTab === 'audit-compliance')}
        >
          <ShieldCheck size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'audit-compliance' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">ऑडीट व कम्प्लायन्स</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 4: SPECIAL HIGHLIGHTED ACTIONS                                      */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[9px] font-black text-amber-700 tracking-wider uppercase border-t border-amber-200/80 mt-1.5 flex items-center gap-1">
            <span>⚡</span> मंजुरी (APPROVAL)
          </p>
        ) : (
          <div className="border-t border-amber-300/80 my-1" />
        )}

        {/* Voucher Approval Button */}
        <button 
          onClick={() => handleNavigate('voucher-posting')}
          title="वाउचर पासिंग व मंजुरी फॉर्म"
          className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 shadow-2xs border cursor-pointer ${
            activeTab === 'voucher-posting' || activeTab === 'voucher-approval'
              ? 'bg-gradient-to-r from-amber-600 via-emerald-700 to-teal-800 text-white font-bold shadow-xs ring-1 ring-amber-300 border-amber-400' 
              : 'bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-teal-500/15 hover:from-amber-500/25 text-slate-800 font-bold border-amber-300/70'
          }`}
        >
          <FileCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'voucher-posting' || activeTab === 'voucher-approval') ? 'text-white' : 'text-amber-700'}`} />
          {isSidebarOpen && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">वाउचर पासिंग/मंजुरी</span>
              <span className="ml-1 px-1 py-0.2 text-[8px] bg-amber-600 text-white font-black rounded-full uppercase tracking-tighter shadow-2xs">मंजुरी</span>
            </div>
          )}
        </button>

        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[9px] font-black text-blue-700 tracking-wider uppercase border-t border-blue-200/80 mt-1.5 flex items-center gap-1">
            <span>📊</span> अहवाल (REPORTS)
          </p>
        ) : (
          <div className="border-t border-blue-300/80 my-1" />
        )}

        {/* Reports Center Button */}
        <button 
          onClick={() => handleNavigate('reports')}
          title="सर्व अहवाल केंद्र"
          className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] transition-all duration-150 shadow-2xs border cursor-pointer ${
            isReportsActive
              ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-bold shadow-xs ring-1 ring-blue-300 border-blue-400' 
              : 'bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-blue-500/15 hover:from-blue-500/25 text-slate-800 font-bold border-blue-300/70'
          }`}
        >
          <FileSpreadsheet size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isReportsActive ? 'text-white' : 'text-blue-600'}`} />
          {isSidebarOpen && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">सर्व रिपोर्ट केंद्र</span>
              <span className="ml-1 px-1 py-0.2 text-[8px] bg-blue-600 text-white font-black rounded-full uppercase tracking-tighter shadow-2xs">मुख्य</span>
            </div>
          )}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 5: ADMIN & SETTINGS                                                 */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[9px] font-black text-slate-400 tracking-wider uppercase border-t border-slate-200/60 mt-1.5">
            प्रशासन व सेटिंग्ज
          </p>
        ) : (
          <div className="border-t border-slate-200/60 my-1" />
        )}

        <button 
          onClick={() => handleNavigate('settings')}
          title="सिस्टीम सेटिंग्ज"
          className={getItemClass(activeTab === 'settings' || activeTab === 'member-opening')}
        >
          <Settings size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'settings' || activeTab === 'member-opening') ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">सिस्टीम सेटिंग्ज</span>}
        </button>

        {(user.role === 'Admin' || user.role === 'HO_Manager' || user.role === 'HO Manager') && (
          <button 
            onClick={() => handleNavigate('users')}
            title="युजर व्यवस्थापन"
            className={getItemClass(activeTab === 'users')}
          >
            <UserCog size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'users' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">युजर व्यवस्थापन</span>}
          </button>
        )}

        {/* ========================================================================= */}
        {/* GROUP 6: LOGOUT                                                           */}
        {/* ========================================================================= */}
        <div className="pt-1.5 border-t border-slate-200/60 mt-1">
          <button
            onClick={logout}
            title="लॉगआउट (Logout)"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1.5 rounded-lg text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 transition-all duration-150 cursor-pointer shadow-2xs`}
          >
            <LogOut size={15} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 text-red-500`} />
            {isSidebarOpen && <span>लॉगआउट (Logout)</span>}
          </button>
        </div>

      </div>
    </aside>
  );
}

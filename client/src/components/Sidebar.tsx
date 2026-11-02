import React from 'react';
import { 
  ChevronLeft, 
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
  Landmark,
  FileSpreadsheet, 
  FileText,
  FileCheck,
  Settings, 
  UserCog,
  LogOut
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
  const isRdActive = activeTab === 'rd' || activeTab === 'rd-dashboard' || activeTab === 'rd-migrate' || activeTab === 'rd-account' || activeTab === 'rd-collect' || activeTab === 'rd-withdrawal' || activeTab === 'rd-accrual' || activeTab === 'rd-reports' || activeTab === 'rd-khatavani-report';
  const isPigmyActive = activeTab === 'pigmy' || activeTab.startsWith('pigmy');
  const isVoucherActive = activeTab === 'voucher' || activeTab === 'voucher-posting' || activeTab === 'voucher-batch-print';
  const isCashierActive = activeTab === 'cashier-dashboard' || activeTab === 'cash-management' || activeTab === 'cash-allocation' || activeTab === 'cash-denomination';
  const isInvActive = activeTab === 'investment' || activeTab.startsWith('inv-');
  const isAssetActive = activeTab === 'assets' || activeTab.startsWith('asset-');
  const isLockerActive = activeTab === 'locker' || activeTab.startsWith('locker-');
  const isNpaActive = activeTab === 'npa-dashboard' || activeTab === 'npa-statement' || activeTab === 'collateral-compliance' || activeTab === 'npa-defaulters';
  const isLegalActive = activeTab === 'legal-recovery' || activeTab.startsWith('sec101-');
  const isReportsActive = activeTab === 'reports' || activeTab === 'crr-report' || activeTab === 'regulatory-mis-report' || activeTab === 'swanidhi-report' || activeTab === 'trial-balance' || activeTab === 'trial-balance-namuna-n' || activeTab === 'daybook' || activeTab === 'draft-daybook' || activeTab === 'legacy-daybook' || activeTab === 'daybook-summary' || activeTab === 'profit-loss' || activeTab === 'balance-sheet' || activeTab === 'balance-sheet-form-n' || activeTab === 'general-ledger' || activeTab === 'member-balance-report' || activeTab === 'loan-disbursement-register' || activeTab === 'loan-collection-register' || activeTab === 'loan-ledger-report' || activeTab === 'loan-outstanding-report' || activeTab === 'loan-overdue-report' || activeTab === 'saving-account-list-report' || activeTab === 'saving-khatavani-report' || activeTab === 'rd-khatavani-report' || activeTab === 'pigmy-khatavani-report' || activeTab === 'npa-register' || activeTab === 'loan-rate' || activeTab === 'sabhasad-labhansh-report' || activeTab === 'shares-khatavani-report';

  const getItemClass = (isActive: boolean) => `
    w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 select-none cursor-pointer group ${
      isActive 
        ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/12 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/35 shadow-sm relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-emerald-600' 
        : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100/80 font-semibold'
    }
  `;

  const getModuleBtnClass = (isActive: boolean) => `
    w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 select-none cursor-pointer group ${
      isActive 
        ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/12 to-emerald-500/5 text-emerald-950 font-bold border border-emerald-500/35 shadow-sm relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-emerald-600' 
        : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100/80 font-semibold'
    }
  `;

  const getSubItemClass = (isActive: boolean) => `
    px-2 py-0.5 cursor-pointer flex items-center gap-1.5 transition-all duration-150 text-[11px] leading-snug rounded-md select-none group/sub ${
      isActive 
        ? 'text-emerald-900 font-bold bg-emerald-500/20 border border-emerald-500/30 shadow-sm' 
        : 'text-slate-600 hover:text-slate-950 hover:bg-white/80 font-medium'
    }
  `;

  const renderSubDot = (isActive: boolean) => (
    <span
      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
        isActive
          ? 'bg-emerald-600 ring-2 ring-emerald-500/30'
          : 'bg-slate-400 group-hover/sub:bg-emerald-500'
      }`}
    />
  );

  const subMenuContainerClass = "pl-2 pr-1 py-0.5 space-y-0.5 border-l-2 border-emerald-500/35 ml-3 my-0.5 bg-emerald-50/35 rounded-r-lg";

  return (
    <aside 
      className={`relative flex flex-col z-30 h-full print:hidden transition-all duration-200 ease-in-out shrink-0 select-none overflow-hidden ${
        isSidebarOpen ? 'w-[206px]' : 'w-12'
      } backdrop-blur-xl bg-gradient-to-b from-white/95 via-slate-50/90 to-emerald-50/30 border-r border-slate-200/80 shadow-sm`}
    >
      {/* Top Header Bar - Matches h-9 Global Header */}
      <div className={`h-9 flex items-center border-b border-slate-200/80 shrink-0 bg-white/80 backdrop-blur-md relative z-10 ${
        isSidebarOpen ? 'justify-between px-2.5' : 'justify-center px-1'
      }`}>
        {isSidebarOpen ? (
          <>
            <div className="flex items-center space-x-2 truncate">
              <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black text-[11px] shadow-2xs border border-emerald-400/50 shrink-0">
                S
              </div>
              <span className="text-[12px] font-black text-slate-800 tracking-wide truncate">
                SMART <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">BANKING</span>
              </span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="text-slate-400 hover:text-emerald-700 p-0.5 rounded hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
              title="साईडबार बंद करा"
            >
              <ChevronLeft size={15} />
            </button>
          </>
        ) : (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-6 h-6 rounded-md bg-gradient-to-tr from-emerald-600 to-teal-500 text-white border border-emerald-400/40 flex items-center justify-center font-black text-[11px] shadow-2xs hover:scale-105 transition-transform cursor-pointer"
            title="साईडबार उघडा"
          >
            S
          </button>
        )}
      </div>

      {/* Scrollable Navigation Items */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5 custom-scrollbar sidebar-scrollbar relative z-10">

        {/* ========================================================================= */}
        {/* GROUP 1: MAIN DASHBOARD                                                   */}
        {/* ========================================================================= */}
        {isSidebarOpen && (
          <p className="px-2 pt-0.5 pb-0.5 text-[10px] font-extrabold text-slate-500 tracking-wide uppercase flex items-center gap-1">
            <span>✨</span> मुख्य डॅशबोर्ड
          </p>
        )}

        <button 
          onClick={() => handleNavigate('dashboard')}
          title="डॅशबोर्ड"
          className={getItemClass(activeTab === 'dashboard')}
        >
          <LayoutDashboard size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">डॅशबोर्ड</span>}
        </button>

        <button 
          onClick={() => handleNavigate('todays-tasks')}
          title="आजची कामे"
          className={getItemClass(activeTab === 'todays-tasks')}
        >
          <BellRing size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'todays-tasks' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">आजची कामे</span>}
        </button>

        <button 
          onClick={() => handleNavigate('member-360')}
          title="खातेदार ३६०°"
          className={getItemClass(activeTab === 'member-360' || activeTab === 'customer-360' || activeTab === 'khatedar-360')}
        >
          <UserCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'member-360' || activeTab === 'customer-360' || activeTab === 'khatedar-360' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार ३६०°</span>}
        </button>

        <button 
          onClick={() => handleNavigate('customers')}
          title="खातेदार"
          className={getItemClass(activeTab === 'customers')}
        >
          <Users size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'customers' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार</span>}
        </button>

        <button 
          onClick={() => handleNavigate('customer-bulk')}
          title="खातेदार बल्क नोंदणी (Excel Grid)"
          className={getItemClass(activeTab === 'customer-bulk')}
        >
          <FileSpreadsheet size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'customer-bulk' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार बल्क नोंदणी (Grid)</span>}
        </button>

        <button 
          onClick={() => handleNavigate('customer-list-report')}
          title="खातेदार यादी अहवाल"
          className={getItemClass(activeTab === 'customer-list-report')}
        >
          <FileText size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'customer-list-report' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार यादी अहवाल</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 2: BANKING MODULES                                                  */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-slate-500 tracking-wide uppercase border-t border-slate-200/80 mt-1 flex items-center gap-1">
            <span>🏛️</span> बँकिंग व्यवहार
          </p>
        ) : (
          <div className="border-t border-slate-200/80 my-1" />
        )}

        {/* Shares Module */}
        <button 
          onClick={() => handleNavigate('members')}
          title="सभासद नोंदणी व शेअर्स"
          className={getModuleBtnClass(isSharesActive)}
        >
          <div className="flex items-center truncate">
            <Award size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isSharesActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">सभासद नोंदणी (Shares)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isSharesActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isSharesActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'members')} onClick={() => handleNavigate('members')}>
              {renderSubDot(activeTab === 'members')}
              <span className="truncate">अर्ज व भाग वाटप</span>
            </li>
            <li className={getSubItemClass(activeTab === 'share-master')} onClick={() => handleNavigate('share-master')}>
              {renderSubDot(activeTab === 'share-master')}
              <span className="truncate">अतिरिक्त शेअर वाटप</span>
            </li>
            <li className={getSubItemClass(activeTab === 'share-transfer')} onClick={() => handleNavigate('share-transfer')}>
              {renderSubDot(activeTab === 'share-transfer')}
              <span className="truncate">शेअर हस्तांतरण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'member-closure')} onClick={() => handleNavigate('member-closure')}>
              {renderSubDot(activeTab === 'member-closure')}
              <span className="truncate">सभासदत्व समाप्ती</span>
            </li>
            <li className={getSubItemClass(activeTab === 'share-withdrawal')} onClick={() => handleNavigate('share-withdrawal')}>
              {renderSubDot(activeTab === 'share-withdrawal')}
              <span className="truncate">शेअर परतावा</span>
            </li>
          </ul>
        )}

        {/* Loan Module */}
        <button 
          onClick={() => handleNavigate('loan')}
          title="कर्ज विभाग"
          className={getModuleBtnClass(isLoanActive)}
        >
          <div className="flex items-center truncate">
            <TrendingDown size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLoanActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">कर्ज विभाग (Loans)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isLoanActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isLoanActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'loan' || activeTab === 'loan-process')} onClick={() => handleNavigate('loan-process')}>
              {renderSubDot(activeTab === 'loan' || activeTab === 'loan-process')}
              <span className="truncate">कर्ज मागणी व वितरण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-ob' || activeTab === 'loan-opening')} onClick={() => handleNavigate('loan-ob')}>
              {renderSubDot(activeTab === 'loan-ob' || activeTab === 'loan-opening')}
              <span className="truncate">कर्ज आरंभिक शिल्लक</span>
            </li>
            <li className={getSubItemClass(activeTab === 'gold-loan-details')} onClick={() => handleNavigate('gold-loan-details')}>
              {renderSubDot(activeTab === 'gold-loan-details')}
              <span className="truncate">सुवर्ण कर्ज तारण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'gold-jewelry-report')} onClick={() => handleNavigate('gold-jewelry-report')}>
              {renderSubDot(activeTab === 'gold-jewelry-report')}
              <span className="truncate">सोने जिन्नस यादी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-collection')} onClick={() => handleNavigate('loan-collection')}>
              {renderSubDot(activeTab === 'loan-collection')}
              <span className="truncate">कर्ज वसुली नोंदी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-outstanding-report')} onClick={() => handleNavigate('loan-outstanding-report')}>
              {renderSubDot(activeTab === 'loan-outstanding-report')}
              <span className="truncate">कर्ज येणे बाकी अहवाल</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-interest-posting')} onClick={() => handleNavigate('loan-interest-posting')}>
              {renderSubDot(activeTab === 'loan-interest-posting')}
              <span className="truncate">कर्ज व्याज आकारणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-documents')} onClick={() => handleNavigate('loan-documents')}>
              {renderSubDot(activeTab === 'loan-documents')}
              <span className="truncate">कर्ज कागदपत्रे</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-rate')} onClick={() => handleNavigate('loan-rate')}>
              {renderSubDot(activeTab === 'loan-rate')}
              <span className="truncate">कर्ज योजना व व्याजदर</span>
            </li>
            <li className={getSubItemClass(activeTab === 'employer-master')} onClick={() => handleNavigate('employer-master')}>
              {renderSubDot(activeTab === 'employer-master')}
              <span className="truncate">नियोक्ता (Employer)</span>
            </li>
            <li className={getSubItemClass(activeTab === 'employee-bank')} onClick={() => handleNavigate('employee-bank')}>
              {renderSubDot(activeTab === 'employee-bank')}
              <span className="truncate">कर्मचारी बँक खाती</span>
            </li>
          </ul>
        )}

        {/* Saving Module */}
        <button 
          onClick={() => handleNavigate('saving')}
          title="बचत ठेव"
          className={getModuleBtnClass(isSavingActive)}
        >
          <div className="flex items-center truncate">
            <Wallet size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isSavingActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">बचत ठेव</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isSavingActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isSavingActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'saving-account')} onClick={() => handleNavigate('saving-account')}>
              {renderSubDot(activeTab === 'saving-account')}
              <span className="truncate">बचत खाती</span>
            </li>
            <li className={getSubItemClass(activeTab === 'saving-transaction')} onClick={() => handleNavigate('saving-transaction')}>
              {renderSubDot(activeTab === 'saving-transaction')}
              <span className="truncate">जमा/नावे व्यवहार</span>
            </li>
            <li className={getSubItemClass(activeTab === 'saving-posting')} onClick={() => handleNavigate('saving-posting')}>
              {renderSubDot(activeTab === 'saving-posting')}
              <span className="truncate">व्याज आकारणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'saving-passbook')} onClick={() => handleNavigate('saving-passbook')}>
              {renderSubDot(activeTab === 'saving-passbook')}
              <span className="truncate">पासबुक प्रिंट</span>
            </li>
          </ul>
        )}

        {/* Fixed Deposit Module */}
        <button 
          onClick={() => handleNavigate('fd-account')}
          title="मुदत ठेव"
          className={getModuleBtnClass(isFdActive)}
        >
          <div className="flex items-center truncate">
            <Building2 size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isFdActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">मुदत ठेव (FD)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isFdActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isFdActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'fd-account')} onClick={() => handleNavigate('fd-account')}>
              {renderSubDot(activeTab === 'fd-account')}
              <span className="truncate">नवीन ठेव खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-withdrawal')} onClick={() => handleNavigate('fd-withdrawal')}>
              {renderSubDot(activeTab === 'fd-withdrawal')}
              <span className="truncate">नूतनीकरण / परतावा</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-accrual')} onClick={() => handleNavigate('fd-accrual')}>
              {renderSubDot(activeTab === 'fd-accrual')}
              <span className="truncate">मुदत ठेव व्याज तरतूद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-mis-payout')} onClick={() => handleNavigate('fd-mis-payout')}>
              {renderSubDot(activeTab === 'fd-mis-payout')}
              <span className="truncate">मासिक व्याज ट्रान्सफर (MIS)</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-reports')} onClick={() => handleNavigate('fd-reports')}>
              {renderSubDot(activeTab === 'fd-reports')}
              <span className="truncate">मुदत ठेव अहवाल</span>
            </li>
            <li className={getSubItemClass(activeTab === 'fd-customer-summary')} onClick={() => handleNavigate('fd-customer-summary')}>
              {renderSubDot(activeTab === 'fd-customer-summary')}
              <span className="truncate">मुदतबंद ठेव यादी (CBS)</span>
            </li>
          </ul>
        )}

        {/* Recurring Deposit Module */}
        <button 
          onClick={() => handleNavigate('rd-account')}
          title="आवर्ती ठेव"
          className={getModuleBtnClass(isRdActive)}
        >
          <div className="flex items-center truncate">
            <Clock size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isRdActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">आवर्ती ठेव (RD)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isRdActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isRdActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'rd-account')} onClick={() => handleNavigate('rd-account')}>
              {renderSubDot(activeTab === 'rd-account')}
              <span className="truncate">नवीन आरडी खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-collect')} onClick={() => handleNavigate('rd-collect')}>
              {renderSubDot(activeTab === 'rd-collect')}
              <span className="truncate">हप्ता संकलन</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-withdrawal')} onClick={() => handleNavigate('rd-withdrawal')}>
              {renderSubDot(activeTab === 'rd-withdrawal')}
              <span className="truncate">नूतनीकरण / परतावा</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-accrual')} onClick={() => handleNavigate('rd-accrual')}>
              {renderSubDot(activeTab === 'rd-accrual')}
              <span className="truncate">व्याज तरतूद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-reports')} onClick={() => handleNavigate('rd-reports')}>
              {renderSubDot(activeTab === 'rd-reports')}
              <span className="truncate">आरडी अहवाल</span>
            </li>
            <li className={getSubItemClass(activeTab === 'rd-khatavani-report')} onClick={() => handleNavigate('rd-khatavani-report')}>
              {renderSubDot(activeTab === 'rd-khatavani-report')}
              <span className="truncate">आरडी खतावणी (Ledger)</span>
            </li>
          </ul>
        )}

        {/* Pigmy Module */}
        <button 
          onClick={() => handleNavigate('pigmy-account')}
          title="पिग्मी ठेव"
          className={getModuleBtnClass(isPigmyActive)}
        >
          <div className="flex items-center truncate">
            <Coins size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isPigmyActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">पिग्मी ठेव</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isPigmyActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isPigmyActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'pigmy-account')} onClick={() => handleNavigate('pigmy-account')}>
              {renderSubDot(activeTab === 'pigmy-account')}
              <span className="truncate">नवीन पिग्मी खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy' || activeTab === 'pigmy-agent')} onClick={() => handleNavigate('pigmy-agent')}>
              {renderSubDot(activeTab === 'pigmy' || activeTab === 'pigmy-agent')}
              <span className="truncate">पिग्मी एजंट नोंदणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-collection' || activeTab === 'pigmy-collect')} onClick={() => handleNavigate('pigmy-collection')}>
              {renderSubDot(activeTab === 'pigmy-collection' || activeTab === 'pigmy-collect')}
              <span className="truncate">दैनंदिन संकलन</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-daybook')} onClick={() => handleNavigate('pigmy-daybook')}>
              {renderSubDot(activeTab === 'pigmy-daybook')}
              <span className="truncate">एजंट डे-बुक नोंद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-commission')} onClick={() => handleNavigate('pigmy-commission')}>
              {renderSubDot(activeTab === 'pigmy-commission')}
              <span className="truncate">कमिशन व्यवस्थापन</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-interest')} onClick={() => handleNavigate('pigmy-interest')}>
              {renderSubDot(activeTab === 'pigmy-interest')}
              <span className="truncate">पिग्मी व्याज आकारणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-closure')} onClick={() => handleNavigate('pigmy-closure')}>
              {renderSubDot(activeTab === 'pigmy-closure')}
              <span className="truncate">खाते बंद (Closure)</span>
            </li>
            <li className={getSubItemClass(activeTab.startsWith('pigmy-reports'))} onClick={() => handleNavigate('pigmy-reports')}>
              {renderSubDot(activeTab.startsWith('pigmy-reports'))}
              <span className="truncate">पिग्मी अहवाल</span>
            </li>
            <li className={getSubItemClass(activeTab === 'pigmy-khatavani-report')} onClick={() => handleNavigate('pigmy-khatavani-report')}>
              {renderSubDot(activeTab === 'pigmy-khatavani-report')}
              <span className="truncate">पिग्मी खतावणी (Ledger)</span>
            </li>
          </ul>
        )}

        {/* Voucher Module */}
        <button 
          onClick={() => handleNavigate('voucher')}
          title="वाउचर / पावती"
          className={getModuleBtnClass(isVoucherActive)}
        >
          <div className="flex items-center truncate">
            <Receipt size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isVoucherActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">वाउचर / पावती</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isVoucherActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isVoucherActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'voucher')} onClick={() => handleNavigate('voucher')}>
              {renderSubDot(activeTab === 'voucher')}
              <span className="truncate">वाउचर नोंदणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'voucher-posting')} onClick={() => handleNavigate('voucher-posting')}>
              {renderSubDot(activeTab === 'voucher-posting')}
              <span className="truncate">वाउचर पासिंग</span>
            </li>
            <li className={getSubItemClass(activeTab === 'voucher-batch-print')} onClick={() => handleNavigate('voucher-batch-print')}>
              {renderSubDot(activeTab === 'voucher-batch-print')}
              <span className="truncate">बॅच प्रिंट</span>
            </li>
          </ul>
        )}

        {/* Cashier / Cash Management */}
        <button 
          onClick={() => handleNavigate('cashier-dashboard')}
          title="कॅश मॅनेजमेंट"
          className={getModuleBtnClass(isCashierActive)}
        >
          <div className="flex items-center truncate">
            <Coins size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isCashierActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">कॅश मॅनेजमेंट</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isCashierActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isCashierActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'cashier-dashboard' || activeTab === 'cash-management')} onClick={() => handleNavigate('cashier-dashboard')}>
              {renderSubDot(activeTab === 'cashier-dashboard' || activeTab === 'cash-management')}
              <span className="truncate">कॅशिअर डॅशबोर्ड</span>
            </li>
            <li className={getSubItemClass(activeTab === 'cash-allocation')} onClick={() => handleNavigate('cash-allocation')}>
              {renderSubDot(activeTab === 'cash-allocation')}
              <span className="truncate">रोख वाटप (Allocation)</span>
            </li>
            <li className={getSubItemClass(activeTab === 'cash-denomination')} onClick={() => handleNavigate('cash-denomination')}>
              {renderSubDot(activeTab === 'cash-denomination')}
              <span className="truncate">नोटांची मोजणी</span>
            </li>
          </ul>
        )}

        {/* Investment Module */}
        <button 
          onClick={() => handleNavigate('inv-institution')}
          title="गुंतवणूक"
          className={getModuleBtnClass(isInvActive)}
        >
          <div className="flex items-center truncate">
            <BarChart3 size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isInvActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">गुंतवणूक (Investment)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isInvActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isInvActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'investment' || activeTab === 'inv-institution')} onClick={() => handleNavigate('inv-institution')}>
              {renderSubDot(activeTab === 'investment' || activeTab === 'inv-institution')}
              <span className="truncate">संस्था नोंदणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'inv-account')} onClick={() => handleNavigate('inv-account')}>
              {renderSubDot(activeTab === 'inv-account')}
              <span className="truncate">नवीन गुंतवणूक खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'inv-claim')} onClick={() => handleNavigate('inv-claim')}>
              {renderSubDot(activeTab === 'inv-claim')}
              <span className="truncate">मुदतपूर्ती दावा</span>
            </li>
            <li className={getSubItemClass(activeTab === 'inv-accrual')} onClick={() => handleNavigate('inv-accrual')}>
              {renderSubDot(activeTab === 'inv-accrual')}
              <span className="truncate">व्याज तरतूद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'inv-reports')} onClick={() => handleNavigate('inv-reports')}>
              {renderSubDot(activeTab === 'inv-reports')}
              <span className="truncate">गुंतवणूक अहवाल</span>
            </li>
          </ul>
        )}

        {/* Asset Management */}
        <button 
          onClick={() => handleNavigate('asset-category')}
          title="मालमत्ता"
          className={getModuleBtnClass(isAssetActive)}
        >
          <div className="flex items-center truncate">
            <Building size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isAssetActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">मालमत्ता व्यवस्थापन</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isAssetActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isAssetActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'assets' || activeTab === 'asset-category')} onClick={() => handleNavigate('asset-category')}>
              {renderSubDot(activeTab === 'assets' || activeTab === 'asset-category')}
              <span className="truncate">मालमत्ता वर्ग</span>
            </li>
            <li className={getSubItemClass(activeTab === 'asset-master')} onClick={() => handleNavigate('asset-master')}>
              {renderSubDot(activeTab === 'asset-master')}
              <span className="truncate">मालमत्ता मास्टर</span>
            </li>
            <li className={getSubItemClass(activeTab === 'asset-purchase')} onClick={() => handleNavigate('asset-purchase')}>
              {renderSubDot(activeTab === 'asset-purchase')}
              <span className="truncate">नवीन खरेदी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'asset-reports')} onClick={() => handleNavigate('asset-reports')}>
              {renderSubDot(activeTab === 'asset-reports')}
              <span className="truncate">मालमत्ता अहवाल</span>
            </li>
          </ul>
        )}

        {/* Locker Module */}
        <button 
          onClick={() => handleNavigate('locker-dashboard')}
          title="लॉकर विभाग"
          className={getModuleBtnClass(isLockerActive)}
        >
          <div className="flex items-center truncate">
            <KeyRound size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLockerActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">लॉकर विभाग</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform duration-200 ${isLockerActive ? 'rotate-180 text-emerald-600' : ''}`} />}
        </button>

        {isSidebarOpen && isLockerActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'locker' || activeTab === 'locker-dashboard')} onClick={() => handleNavigate('locker-dashboard')}>
              {renderSubDot(activeTab === 'locker' || activeTab === 'locker-dashboard')}
              <span className="truncate">लॉकर डॅशबोर्ड</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-master')} onClick={() => handleNavigate('locker-master')}>
              {renderSubDot(activeTab === 'locker-master')}
              <span className="truncate">कपाट व इन्व्हेंटरी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-types')} onClick={() => handleNavigate('locker-types')}>
              {renderSubDot(activeTab === 'locker-types')}
              <span className="truncate">लॉकर प्रकार व दर</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-allotment')} onClick={() => handleNavigate('locker-allotment')}>
              {renderSubDot(activeTab === 'locker-allotment')}
              <span className="truncate">नवीन लॉकर वाटप</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-visit-register')} onClick={() => handleNavigate('locker-visit-register')}>
              {renderSubDot(activeTab === 'locker-visit-register')}
              <span className="truncate">दैनिक व्हिजिट नोंद</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-rent-renewal')} onClick={() => handleNavigate('locker-rent-renewal')}>
              {renderSubDot(activeTab === 'locker-rent-renewal')}
              <span className="truncate">भाडे नूतनीकरण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-surrender')} onClick={() => handleNavigate('locker-surrender')}>
              {renderSubDot(activeTab === 'locker-surrender')}
              <span className="truncate">लॉकर समर्पण</span>
            </li>
            <li className={getSubItemClass(activeTab === 'locker-reports')} onClick={() => handleNavigate('locker-reports')}>
              {renderSubDot(activeTab === 'locker-reports')}
              <span className="truncate">लॉकर अहवाल</span>
            </li>
          </ul>
        )}

        {/* NPA Module */}
        <button 
          onClick={() => handleNavigate('npa-dashboard')}
          title="एन.पी.ए. विभाग"
          className={getItemClass(isNpaActive)}
        >
          <Scale size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isNpaActive ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">एन.पी.ए. विभाग</span>}
        </button>

        {/* Legal Recovery 101 */}
        <button 
          onClick={() => handleNavigate('legal-recovery')}
          title="कलम १०१ कायदेशीर वसुली"
          className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 cursor-pointer group ${
            isLegalActive 
              ? 'bg-amber-500/20 text-amber-950 font-bold border border-amber-500/40 shadow-sm relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-amber-600' 
              : 'text-slate-700 hover:text-slate-950 hover:bg-amber-50/80 font-semibold'
          }`}
        >
          <Gavel size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLegalActive ? 'text-amber-600' : 'text-slate-500 group-hover:text-amber-600'}`} />
          {isSidebarOpen && <span className="truncate">कलम १०१ वसुली</span>}
        </button>

        {/* Committee Master */}
        <button 
          onClick={() => handleNavigate('committee')}
          title="पंच कमिटी (संचालक मंडळ)"
          className={getItemClass(activeTab === 'committee')}
        >
          <UserCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'committee' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">संचालक मंडळ</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 3: UTILITIES                                                        */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-slate-500 tracking-wide uppercase border-t border-slate-200/80 mt-1 flex items-center gap-1">
            <span>⚙️</span> युटिलिटीज
          </p>
        ) : (
          <div className="border-t border-slate-200/80 my-1" />
        )}

        <button 
          onClick={() => handleNavigate('day-end')}
          title="दिवस समाप्ती (EOD)"
          className={getItemClass(activeTab === 'day-end' || activeTab === 'eod-dashboard')}
        >
          <Moon size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'day-end' || activeTab === 'eod-dashboard') ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">दिवस समाप्ती (EOD)</span>}
        </button>

        <button 
          onClick={() => handleNavigate('interest-calculator')}
          title="व्याज कॅल्क्युलेटर"
          className={getItemClass(activeTab === 'interest-calculator')}
        >
          <Calculator size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'interest-calculator' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">व्याज कॅल्क्युलेटर</span>}
        </button>

        <button 
          onClick={() => handleNavigate('audit-compliance')}
          title="सहकार ऑडीट व कम्प्लायन्स"
          className={getItemClass(activeTab === 'audit-compliance')}
        >
          <ShieldCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'audit-compliance' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">ऑडीट व कम्प्लायन्स</span>}
        </button>

        <button 
          onClick={() => handleNavigate('regulatory-mis-report')}
          title="महाराष्ट्र राज्य नियामक मंडळ MIS अहवाल"
          className={getItemClass(activeTab === 'regulatory-mis-report')}
        >
          <Landmark size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'regulatory-mis-report' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">नियामक मंडळ MIS</span>}
        </button>

        <button 
          onClick={() => handleNavigate('crr-report')}
          title="CRR रोख राखीव प्रमाण व तरलता अहवाल"
          className={getItemClass(activeTab === 'crr-report')}
        >
          <Coins size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'crr-report' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">CRR तरलता अहवाल</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 4: SPECIAL HIGHLIGHTED ACTIONS                                      */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-amber-700 tracking-wide uppercase border-t border-amber-200/80 mt-1 flex items-center gap-1">
            <span>⚡</span> मंजुरी (APPROVAL)
          </p>
        ) : (
          <div className="border-t border-amber-300/80 my-1" />
        )}

        {/* Voucher Approval Button */}
        <button 
          onClick={() => handleNavigate('voucher-posting')}
          title="वाउचर पासिंग व मंजुरी फॉर्म"
          className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 shadow-sm border cursor-pointer ${
            activeTab === 'voucher-posting' || activeTab === 'voucher-approval'
              ? 'bg-gradient-to-r from-amber-600 via-emerald-700 to-teal-800 text-white font-bold shadow-sm ring-1 ring-amber-300 border-amber-400' 
              : 'bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-teal-500/15 hover:from-amber-500/25 text-slate-800 font-bold border-amber-300/80'
          }`}
        >
          <FileCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'voucher-posting' || activeTab === 'voucher-approval') ? 'text-white' : 'text-amber-700'}`} />
          {isSidebarOpen && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">वाउचर पासिंग/मंजुरी</span>
              <span className="ml-1 px-1 py-0.2 text-[9px] bg-amber-600 text-white font-extrabold rounded-full uppercase tracking-tight shadow-sm">मंजुरी</span>
            </div>
          )}
        </button>

        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-blue-700 tracking-wide uppercase border-t border-blue-200/80 mt-1 flex items-center gap-1">
            <span>📊</span> अहवाल (REPORTS)
          </p>
        ) : (
          <div className="border-t border-blue-300/80 my-1" />
        )}

        {/* Reports Center Button */}
        <button 
          onClick={() => handleNavigate('reports')}
          title="सर्व अहवाल केंद्र"
          className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 shadow-sm border cursor-pointer ${
            isReportsActive
              ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-bold shadow-sm ring-1 ring-blue-300 border-blue-400' 
              : 'bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-blue-500/15 hover:from-blue-500/25 text-slate-800 font-bold border-blue-300/80'
          }`}
        >
          <FileSpreadsheet size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isReportsActive ? 'text-white' : 'text-blue-600'}`} />
          {isSidebarOpen && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">सर्व रिपोर्ट केंद्र</span>
              <span className="ml-1 px-1 py-0.2 text-[9px] bg-blue-600 text-white font-extrabold rounded-full uppercase tracking-tight shadow-sm">मुख्य</span>
            </div>
          )}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 5: ADMIN & SETTINGS                                                 */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-slate-500 tracking-wide uppercase border-t border-slate-200/80 mt-1">
            प्रशासन व सेटिंग्ज
          </p>
        ) : (
          <div className="border-t border-slate-200/80 my-1" />
        )}

        <button 
          onClick={() => handleNavigate('settings')}
          title="सिस्टीम सेटिंग्ज"
          className={getItemClass(activeTab === 'settings' || activeTab === 'member-opening')}
        >
          <Settings size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'settings' || activeTab === 'member-opening') ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
          {isSidebarOpen && <span className="truncate">सिस्टीम सेटिंग्ज</span>}
        </button>

        {(user.role === 'Admin' || user.role === 'HO_Manager' || user.role === 'HO Manager') && (
          <button 
            onClick={() => handleNavigate('users')}
            title="युजर व्यवस्थापन"
            className={getItemClass(activeTab === 'users')}
          >
            <UserCog size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'users' ? 'text-emerald-600' : 'text-slate-500 group-hover:text-emerald-600'}`} />
            {isSidebarOpen && <span className="truncate">युजर व्यवस्थापन</span>}
          </button>
        )}

        {/* ========================================================================= */}
        {/* GROUP 6: LOGOUT                                                           */}
        {/* ========================================================================= */}
        <div className="pt-1.5 pb-1 border-t border-slate-200/80 mt-1">
          <button
            onClick={logout}
            title="लॉगआउट (Logout)"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] font-bold text-red-600 hover:text-red-700 bg-red-500/10 hover:bg-red-500/15 border border-red-500/25 transition-all duration-150 cursor-pointer shadow-sm`}
          >
            <LogOut size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 text-red-500`} />
            {isSidebarOpen && <span>लॉगआउट (Logout)</span>}
          </button>
        </div>

      </div>
    </aside>
  );
}

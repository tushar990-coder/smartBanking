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
  FileSpreadsheet, 
  FileCheck,
  Settings, 
  UserCog,
  LogOut
} from 'lucide-react';
import { hasPermission } from '../utils/permissionUtils';

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
  const isLoanActive = activeTab === 'loan' || activeTab === 'loan-process' || activeTab === 'loan-ob' || activeTab === 'loan-opening' || activeTab === 'gold-loan-details' || activeTab === 'loan-collection' || activeTab === 'loan-interest-posting' || activeTab === 'loan-bulk-charges' || activeTab === 'loan-documents' || activeTab === 'employee-bank' || activeTab === 'employer-master';
  const isBorrowingActive = activeTab === 'bank-borrowing' || activeTab === 'borrowing-dashboard' || activeTab === 'borrowing-account' || activeTab === 'borrowing-disbursement' || activeTab === 'borrowing-repayment' || activeTab === 'borrowing-custody';
  const isDemandActive = activeTab === 'demand-notice' || activeTab === 'demand-recovery' || activeTab === 'demand-settings';
  const isSavingActive = activeTab === 'saving' || activeTab === 'saving-account' || activeTab === 'saving-transaction' || activeTab === 'saving-bulk-transfer' || activeTab === 'saving-setting' || activeTab === 'saving-posting' || activeTab === 'saving-closing';
  const isFdActive = activeTab === 'fd' || activeTab === 'fd-account' || activeTab === 'fd-withdrawal' || activeTab === 'fd-accrual' || activeTab === 'fd-mis-payout' || activeTab === 'fd-scheme' || activeTab === 'fd-migrate';
  const isRdActive = activeTab === 'rd' || activeTab === 'rd-dashboard' || activeTab === 'rd-migrate' || activeTab === 'rd-account' || activeTab === 'rd-collect' || activeTab === 'rd-collection' || activeTab === 'rd-withdrawal' || activeTab === 'rd-accrual' || activeTab === 'rd-scheme';
  const isPigmyActive = activeTab === 'pigmy' || activeTab === 'pigmy-account' || activeTab === 'pigmy-agent' || activeTab === 'pigmy-collection' || activeTab === 'pigmy-collect' || activeTab === 'pigmy-daybook' || activeTab === 'pigmy-commission' || activeTab === 'pigmy-interest' || activeTab === 'pigmy-closure' || activeTab === 'pigmy-scheme';
  const isVoucherActive = activeTab === 'voucher' || activeTab === 'voucher-posting';
  const isCashierActive = activeTab === 'cashier-dashboard' || activeTab === 'cash-management' || activeTab === 'cash-allocation' || activeTab === 'cash-denomination';
  const isInvActive = activeTab === 'investment' || activeTab === 'inv-institution' || activeTab === 'inv-account' || activeTab === 'inv-claim' || activeTab === 'inv-accrual' || activeTab === 'inv-scheme';
  const isAssetActive = activeTab === 'assets' || activeTab === 'asset-category' || activeTab === 'asset-master' || activeTab === 'asset-purchase';
  const isLockerActive = activeTab === 'locker' || activeTab === 'locker-dashboard' || activeTab === 'locker-master' || activeTab === 'locker-types' || activeTab === 'locker-allotment' || activeTab === 'locker-visit-register' || activeTab === 'locker-rent-renewal' || activeTab === 'locker-surrender';
  const isNpaActive = activeTab === 'npa-dashboard' || activeTab === 'npa-config';
  const isLegalActive = activeTab === 'legal-recovery' || (activeTab.startsWith('sec101-') && activeTab !== 'sec101-reports');
  const isReportsActive =
    activeTab === 'reports' ||
    activeTab.endsWith('-report') ||
    activeTab.includes('-reports') ||
    activeTab === 'crr-report' ||
    activeTab === 'regulatory-mis-report' ||
    activeTab === 'swanidhi-report' ||
    activeTab === 'trial-balance' ||
    activeTab === 'trial-balance-namuna-n' ||
    activeTab === 'cash-book' ||
    activeTab === 'daybook' ||
    activeTab === 'draft-daybook' ||
    activeTab === 'legacy-daybook' ||
    activeTab === 'daybook-summary' ||
    activeTab === 'profit-loss' ||
    activeTab === 'balance-sheet' ||
    activeTab === 'balance-sheet-form-n' ||
    activeTab === 'general-ledger' ||
    activeTab === 'voucher-batch-print' ||
    activeTab === 'loan-disbursement-register' ||
    activeTab === 'loan-collection-register' ||
    activeTab === 'interest-waiver-register' ||
    activeTab === 'aadhaar-list' ||
    activeTab === 'saving-passbook' ||
    activeTab === 'fd-customer-summary' ||
    activeTab === 'npa-register' ||
    activeTab === 'npa-statement' ||
    activeTab === 'npa-defaulters' ||
    activeTab === 'collateral-compliance' ||
    activeTab === 'sec101-reports' ||
    activeTab === 'loan-rate' ||
    activeTab === 'borrowing-reports' ||
    activeTab === 'audit-logs';

  const getItemClass = (isActive: boolean) => `
    w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 select-none cursor-pointer group ${
      isActive 
        ? 'bg-gradient-to-r from-[#7C2418]/12 via-[#B44814]/10 to-[#D97706]/12 text-[#5A1A14] font-bold border border-[#D97706]/35 shadow-xs relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#7C2418] before:via-[#B44814] before:to-[#D97706]' 
        : 'text-[#5C3A2E] hover:text-[#5A1A14] hover:bg-white/80 font-semibold'
    }
  `;

  const getModuleBtnClass = (isActive: boolean) => `
    w-full flex items-center justify-between ${isSidebarOpen ? 'px-2.5' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 select-none cursor-pointer group ${
      isActive 
        ? 'bg-gradient-to-r from-[#7C2418]/12 via-[#B44814]/10 to-[#D97706]/12 text-[#5A1A14] font-bold border border-[#D97706]/35 shadow-xs relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-r-full before:bg-gradient-to-b before:from-[#7C2418] before:via-[#B44814] before:to-[#D97706]' 
        : 'text-[#5C3A2E] hover:text-[#5A1A14] hover:bg-white/80 font-semibold'
    }
  `;

  const getSubItemClass = (isActive: boolean) => `
    px-2 py-0.5 cursor-pointer flex items-center gap-1.5 transition-all duration-150 text-[11px] leading-snug rounded-md select-none group/sub ${
      isActive 
        ? 'text-[#7C2418] font-bold bg-[#D97706]/12 border border-[#D97706]/25 shadow-2xs' 
        : 'text-[#6E493C] hover:text-[#5A1A14] hover:bg-white/85 font-medium'
    }
  `;

  const renderSubDot = (isActive: boolean) => (
    <span
      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
        isActive
          ? 'bg-[#B44814] ring-2 ring-[#F59E0B]/40'
          : 'bg-amber-300 group-hover/sub:bg-[#D97706]'
      }`}
    />
  );

  const subMenuContainerClass = "pl-2 pr-1 py-0.5 space-y-0.5 border-l-2 border-[#D97706]/40 ml-3 my-0.5 bg-white/60 rounded-r-lg";

  return (
    <aside 
      className={`relative flex flex-col z-30 h-full print:hidden transition-all duration-200 ease-in-out shrink-0 select-none overflow-hidden ${
        isSidebarOpen ? 'w-[206px]' : 'w-12'
      } backdrop-blur-xl border-r border-amber-200/80 shadow-[2px_0_16px_rgba(124,36,24,0.08)]`}
      style={{
        background:
          'linear-gradient(180deg, #FDF2EE 0%, #FFFBF7 38%, #FEF3E2 76%, #FCE3BE 100%)',
      }}
    >
      {/* Top Header Bar - Matches h-9 Global Header */}
      <div className={`h-9 flex items-center border-b border-amber-200/75 shrink-0 bg-white/75 backdrop-blur-md relative z-10 ${
        isSidebarOpen ? 'justify-between px-2.5' : 'justify-center px-1'
      }`}>
        {isSidebarOpen ? (
          <>
            <div className="flex items-center space-x-2 truncate">
              <div
                className="w-6 h-6 rounded-md text-white flex items-center justify-center font-black text-[11px] shadow-xs border border-amber-200/60 shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)',
                }}
              >
                S
              </div>
              <span className="text-[12px] font-black text-[#5A1A14] tracking-wide truncate">
                SMART{' '}
                <span className="bg-gradient-to-r from-[#7C2418] via-[#B44814] to-[#D97706] bg-clip-text text-transparent">
                  BANKING
                </span>
              </span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="text-[#B45309]/70 hover:text-[#7C2418] p-0.5 rounded hover:bg-amber-100/70 transition-all shrink-0 cursor-pointer"
              title="साईडबार बंद करा"
            >
              <ChevronLeft size={15} />
            </button>
          </>
        ) : (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-6 h-6 rounded-md text-white border border-amber-200/60 flex items-center justify-center font-black text-[11px] shadow-xs hover:scale-105 transition-transform cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #7C2418 0%, #B44814 55%, #D97706 100%)',
            }}
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
          <p className="px-2 pt-0.5 pb-0.5 text-[10px] font-extrabold text-[#8C3B2B]/80 tracking-wide uppercase flex items-center gap-1">
            <span>✨</span> मुख्य डॅशबोर्ड
          </p>
        )}

        <button 
          onClick={() => handleNavigate('dashboard')}
          title="डॅशबोर्ड"
          className={getItemClass(activeTab === 'dashboard')}
        >
          <LayoutDashboard size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'dashboard' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">डॅशबोर्ड</span>}
        </button>

        <button 
          onClick={() => handleNavigate('todays-tasks')}
          title="आजची कामे"
          className={getItemClass(activeTab === 'todays-tasks')}
        >
          <BellRing size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'todays-tasks' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">आजची कामे</span>}
        </button>

        <button 
          onClick={() => handleNavigate('member-360')}
          title="खातेदार ३६०°"
          className={getItemClass(activeTab === 'member-360' || activeTab === 'customer-360' || activeTab === 'khatedar-360')}
        >
          <UserCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'member-360' || activeTab === 'customer-360' || activeTab === 'khatedar-360' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार ३६०°</span>}
        </button>

        <button 
          onClick={() => handleNavigate('customers')}
          title="खातेदार"
          className={getItemClass(activeTab === 'customers')}
        >
          <Users size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'customers' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार</span>}
        </button>

        <button 
          onClick={() => handleNavigate('customer-bulk')}
          title="खातेदार बल्क नोंदणी (Excel Grid)"
          className={getItemClass(activeTab === 'customer-bulk')}
        >
          <FileSpreadsheet size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'customer-bulk' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">खातेदार बल्क नोंदणी (Grid)</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 2: BANKING MODULES                                                  */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-[#8C3B2B]/80 tracking-wide uppercase border-t border-amber-200/75 mt-1 flex items-center gap-1">
            <span>🏛️</span> बँकिंग व्यवहार
          </p>
        ) : (
          <div className="border-t border-amber-200/75 my-1" />
        )}

        {/* Shares Module */}
        <button 
          onClick={() => handleNavigate('members')}
          title="सभासद नोंदणी व शेअर्स"
          className={getModuleBtnClass(isSharesActive)}
        >
          <div className="flex items-center truncate">
            <Award size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isSharesActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">सभासद नोंदणी (Shares)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isSharesActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
            <TrendingDown size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLoanActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">कर्ज विभाग (Loans)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isLoanActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
            <li className={getSubItemClass(activeTab === 'loan-collection')} onClick={() => handleNavigate('loan-collection')}>
              {renderSubDot(activeTab === 'loan-collection')}
              <span className="truncate">कर्ज वसुली नोंदी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-interest-posting')} onClick={() => handleNavigate('loan-interest-posting')}>
              {renderSubDot(activeTab === 'loan-interest-posting')}
              <span className="truncate">कर्ज व्याज आकारणी</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-bulk-charges')} onClick={() => handleNavigate('loan-bulk-charges')}>
              {renderSubDot(activeTab === 'loan-bulk-charges')}
              <span className="truncate">वसुली खर्च नावे (Bulk)</span>
            </li>
            <li className={getSubItemClass(activeTab === 'loan-documents')} onClick={() => handleNavigate('loan-documents')}>
              {renderSubDot(activeTab === 'loan-documents')}
              <span className="truncate">तारण दस्त व दागिने ट्रॅकिंग</span>
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

        {/* Employee Patsanstha Demand Module */}
        <button
          onClick={() => handleNavigate('demand-notice')}
          title="पगारदार डिमांड (Salary Demand)"
          className={getModuleBtnClass(isDemandActive)}
        >
          <div className="flex items-center truncate">
            <FileSpreadsheet size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isDemandActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">पगारदार डिमांड</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isDemandActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
        </button>

        {isSidebarOpen && isDemandActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'demand-notice')} onClick={() => handleNavigate('demand-notice')}>
              {renderSubDot(activeTab === 'demand-notice')}
              <span className="truncate">डिमांड फॉर्म (Demand)</span>
            </li>
            <li className={getSubItemClass(activeTab === 'demand-recovery')} onClick={() => handleNavigate('demand-recovery')}>
              {renderSubDot(activeTab === 'demand-recovery')}
              <span className="truncate">बल्क पगार वसुली</span>
            </li>
            {hasPermission(user?.role, 'Settings', 'View') && (
              <li className={getSubItemClass(activeTab === 'demand-settings')} onClick={() => handleNavigate('demand-settings')}>
                {renderSubDot(activeTab === 'demand-settings')}
                <span className="truncate">डिमांड सेटिंग्ज (Sequence)</span>
              </li>
            )}
          </ul>
        )}

        {/* Saving Module */}
        <button 
          onClick={() => handleNavigate('saving')}
          title="बचत ठेव"
          className={getModuleBtnClass(isSavingActive)}
        >
          <div className="flex items-center truncate">
            <Wallet size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isSavingActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">बचत ठेव</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isSavingActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
            <li className={getSubItemClass(activeTab === 'saving-bulk-transfer')} onClick={() => handleNavigate('saving-bulk-transfer')}>
              {renderSubDot(activeTab === 'saving-bulk-transfer')}
              <span className="truncate">बचत बल्क ट्रान्सफर</span>
            </li>
            <li className={getSubItemClass(activeTab === 'saving-posting')} onClick={() => handleNavigate('saving-posting')}>
              {renderSubDot(activeTab === 'saving-posting')}
              <span className="truncate">व्याज आकारणी</span>
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
            <Building2 size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isFdActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">मुदत ठेव (FD)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isFdActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
          </ul>
        )}

        {/* Recurring Deposit Module */}
        <button 
          onClick={() => handleNavigate('rd-account')}
          title="आवर्ती ठेव"
          className={getModuleBtnClass(isRdActive)}
        >
          <div className="flex items-center truncate">
            <Clock size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isRdActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">आवर्ती ठेव (RD)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isRdActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
          </ul>
        )}

        {/* Pigmy Module */}
        <button 
          onClick={() => handleNavigate('pigmy-account')}
          title="पिग्मी ठेव"
          className={getModuleBtnClass(isPigmyActive)}
        >
          <div className="flex items-center truncate">
            <Coins size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isPigmyActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">पिग्मी ठेव</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isPigmyActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
          </ul>
        )}

        {/* Voucher Module */}
        <button 
          onClick={() => handleNavigate('voucher')}
          title="वाउचर / पावती"
          className={getModuleBtnClass(isVoucherActive)}
        >
          <div className="flex items-center truncate">
            <Receipt size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isVoucherActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">वाउचर / पावती</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isVoucherActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
          </ul>
        )}

        {/* Cashier / Cash Management */}
        <button 
          onClick={() => handleNavigate('cashier-dashboard')}
          title="कॅश मॅनेजमेंट"
          className={getModuleBtnClass(isCashierActive)}
        >
          <div className="flex items-center truncate">
            <Coins size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isCashierActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">कॅश मॅनेजमेंट</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isCashierActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
            <BarChart3 size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isInvActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">गुंतवणूक (Investment)</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isInvActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
          </ul>
        )}

        {/* Bank & Patsanstha Borrowings Module (Standalone Full Module) */}
        <button
          onClick={() => handleNavigate('borrowing-dashboard')}
          title="बाह्य कर्जे व पुनर्गहाण (Bank Borrowings)"
          className={getModuleBtnClass(isBorrowingActive)}
        >
          <div className="flex items-center truncate">
            <Building2 size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isBorrowingActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">बाह्य कर्जे व पुनर्गहाण</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isBorrowingActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
        </button>

        {isSidebarOpen && isBorrowingActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'borrowing-dashboard' || activeTab === 'bank-borrowing')} onClick={() => handleNavigate('borrowing-dashboard')}>
              {renderSubDot(activeTab === 'borrowing-dashboard' || activeTab === 'bank-borrowing')}
              <span className="truncate">डॅशबोर्ड व देय हप्ते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'borrowing-account')} onClick={() => handleNavigate('borrowing-account')}>
              {renderSubDot(activeTab === 'borrowing-account')}
              <span className="truncate">१. नवीन बाह्य कर्ज खाते</span>
            </li>
            <li className={getSubItemClass(activeTab === 'borrowing-disbursement')} onClick={() => handleNavigate('borrowing-disbursement')}>
              {renderSubDot(activeTab === 'borrowing-disbursement')}
              <span className="truncate">२. कर्ज रक्कम उचल (वाटप)</span>
            </li>
            <li className={getSubItemClass(activeTab === 'borrowing-repayment')} onClick={() => handleNavigate('borrowing-repayment')}>
              {renderSubDot(activeTab === 'borrowing-repayment')}
              <span className="truncate">३. हप्ता भरणा व वेळापत्रक</span>
            </li>
            <li className={getSubItemClass(activeTab === 'borrowing-custody')} onClick={() => handleNavigate('borrowing-custody')}>
              {renderSubDot(activeTab === 'borrowing-custody')}
              <span className="truncate">४. सोने पाकीट सुटका</span>
            </li>
            <li className={getSubItemClass(activeTab === 'borrowing-reports')} onClick={() => handleNavigate('borrowing-reports')}>
              {renderSubDot(activeTab === 'borrowing-reports')}
              <span className="truncate">५. खतावणी व अहवाल</span>
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
            <Building size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isAssetActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">मालमत्ता व्यवस्थापन</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isAssetActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
          </ul>
        )}

        {/* Locker Module */}
        <button 
          onClick={() => handleNavigate('locker-dashboard')}
          title="लॉकर विभाग"
          className={getModuleBtnClass(isLockerActive)}
        >
          <div className="flex items-center truncate">
            <KeyRound size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLockerActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">लॉकर विभाग</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isLockerActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
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
          </ul>
        )}

        {/* NPA Module */}
        <button 
          onClick={() => handleNavigate('npa-dashboard')}
          title="एन.पी.ए. विभाग"
          className={getItemClass(isNpaActive)}
        >
          <Scale size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isNpaActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">एन.पी.ए. विभाग</span>}
        </button>

        {/* Legal Recovery 101 / 91 Expandable Module */}
        <button 
          onClick={() => handleNavigate('legal-recovery')}
          title="कलम १०१ वसुली"
          className={getModuleBtnClass(isLegalActive)}
        >
          <div className="flex items-center truncate">
            <Gavel size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isLegalActive ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">कलम १०१ वसुली</span>}
          </div>
          {isSidebarOpen && <ChevronDown size={13} className={`shrink-0 text-[#B88B75] transition-transform duration-200 ${isLegalActive ? 'rotate-180 text-[#9A3412]' : ''}`} />}
        </button>

        {isSidebarOpen && isLegalActive && (
          <ul className={subMenuContainerClass}>
            <li className={getSubItemClass(activeTab === 'legal-recovery')} onClick={() => handleNavigate('legal-recovery')}>
              {renderSubDot(activeTab === 'legal-recovery')}
              <span className="truncate">मुख्य डॅशबोर्ड</span>
            </li>
            <li className={getSubItemClass(activeTab === 'sec101-tracker')} onClick={() => handleNavigate('sec101-tracker')}>
              {renderSubDot(activeTab === 'sec101-tracker')}
              <span className="truncate">ग्राहक १०१/९१ ट्रॅकर</span>
            </li>
            <li className={getSubItemClass(activeTab === 'sec101-notices')} onClick={() => handleNavigate('sec101-notices')}>
              {renderSubDot(activeTab === 'sec101-notices')}
              <span className="truncate">३-टप्प्यांच्या नोटिसा</span>
            </li>
            <li className={getSubItemClass(activeTab === 'sec101-filing')} onClick={() => handleNavigate('sec101-filing')}>
              {renderSubDot(activeTab === 'sec101-filing')}
              <span className="truncate">दावा अर्ज व Form M</span>
            </li>
            <li className={getSubItemClass(activeTab === 'sec101-hearings')} onClick={() => handleNavigate('sec101-hearings')}>
              {renderSubDot(activeTab === 'sec101-hearings')}
              <span className="truncate">सुनावणी व दाखला</span>
            </li>
            <li className={getSubItemClass(activeTab === 'sec101-executions')} onClick={() => handleNavigate('sec101-executions')}>
              {renderSubDot(activeTab === 'sec101-executions')}
              <span className="truncate">जप्ती, कपात व लिलाव</span>
            </li>
            <li className={getSubItemClass(activeTab === 'sec101-mapping')} onClick={() => handleNavigate('sec101-mapping')}>
              {renderSubDot(activeTab === 'sec101-mapping')}
              <span className="truncate">लेजर मॅपिंग</span>
            </li>
          </ul>
        )}

        {/* Committee Master */}
        <button 
          onClick={() => handleNavigate('committee')}
          title="पंच कमिटी (संचालक मंडळ)"
          className={getItemClass(activeTab === 'committee')}
        >
          <UserCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'committee' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">संचालक मंडळ</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 3: UTILITIES                                                        */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-[#8C3B2B]/80 tracking-wide uppercase border-t border-amber-200/75 mt-1 flex items-center gap-1">
            <span>⚙️</span> युटिलिटीज
          </p>
        ) : (
          <div className="border-t border-amber-200/75 my-1" />
        )}

        <button 
          onClick={() => handleNavigate('day-end')}
          title="दिवस समाप्ती (EOD)"
          className={getItemClass(activeTab === 'day-end' || activeTab === 'eod-dashboard')}
        >
          <Moon size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'day-end' || activeTab === 'eod-dashboard') ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">दिवस समाप्ती (EOD)</span>}
        </button>

        <button 
          onClick={() => handleNavigate('interest-calculator')}
          title="व्याज कॅल्क्युलेटर"
          className={getItemClass(activeTab === 'interest-calculator')}
        >
          <Calculator size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'interest-calculator' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">व्याज कॅल्क्युलेटर</span>}
        </button>

        <button 
          onClick={() => handleNavigate('audit-compliance')}
          title="सहकार ऑडीट व कम्प्लायन्स"
          className={getItemClass(activeTab === 'audit-compliance')}
        >
          <ShieldCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'audit-compliance' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
          {isSidebarOpen && <span className="truncate">ऑडीट व कम्प्लायन्स</span>}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 4: SPECIAL HIGHLIGHTED ACTIONS                                      */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-[#047857] tracking-wide uppercase border-t border-amber-200/75 mt-1 flex items-center gap-1">
            <span>⚡</span> मंजुरी (APPROVAL)
          </p>
        ) : (
          <div className="border-t border-amber-200/75 my-1" />
        )}

        {/* Voucher Approval Button */}
        <button 
          onClick={() => handleNavigate('voucher-posting')}
          title="वाउचर पासिंग व मंजुरी फॉर्म"
          className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 shadow-sm border cursor-pointer ${
            activeTab === 'voucher-posting' || activeTab === 'voucher-approval'
              ? 'bg-gradient-to-r from-[#10B981] via-[#059669] to-[#047857] text-white font-bold shadow-sm ring-1 ring-emerald-300 border-emerald-400' 
              : 'bg-gradient-to-r from-[#10B981]/14 via-[#FEF3E2]/55 to-white/80 hover:from-[#10B981]/22 text-[#5A1A14] font-bold border-[#10B981]/35'
          }`}
        >
          <FileCheck size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'voucher-posting' || activeTab === 'voucher-approval') ? 'text-white' : 'text-[#059669]'}`} />
          {isSidebarOpen && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">वाउचर पासिंग/मंजुरी</span>
              <span className="ml-1 px-1.5 py-0.2 text-[9px] bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-extrabold rounded-full uppercase tracking-tight shadow-xs">मंजुरी</span>
            </div>
          )}
        </button>

        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-[#9A3412] tracking-wide uppercase border-t border-amber-200/75 mt-1 flex items-center gap-1">
            <span>📊</span> अहवाल (REPORTS)
          </p>
        ) : (
          <div className="border-t border-amber-200/75 my-1" />
        )}

        {/* Reports Center Button */}
        <button 
          onClick={() => handleNavigate('reports')}
          title="सर्व अहवाल केंद्र"
          className={`w-full flex items-center ${isSidebarOpen ? 'px-2.5 justify-start' : 'px-0 justify-center'} py-1 rounded-lg text-[11.5px] leading-snug transition-all duration-150 shadow-sm border cursor-pointer ${
            isReportsActive
              ? 'bg-gradient-to-r from-[#7C2418] via-[#B44814] to-[#D97706] text-white font-bold shadow-sm ring-1 ring-amber-300 border-amber-400' 
              : 'bg-gradient-to-r from-[#7C2418]/10 via-[#B44814]/10 to-[#D97706]/12 hover:from-[#7C2418]/18 text-[#5A1A14] font-bold border-[#D97706]/35'
          }`}
        >
          <FileSpreadsheet size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${isReportsActive ? 'text-white' : 'text-[#9A3412]'}`} />
          {isSidebarOpen && (
            <div className="flex items-center justify-between w-full">
              <span className="truncate">सर्व रिपोर्ट केंद्र</span>
              <span className="ml-1 px-1.5 py-0.2 text-[9px] bg-gradient-to-r from-[#9A3412] to-[#D97706] text-white font-extrabold rounded-full uppercase tracking-tight shadow-xs">मुख्य</span>
            </div>
          )}
        </button>

        {/* ========================================================================= */}
        {/* GROUP 5: ADMIN & SETTINGS                                                 */}
        {/* ========================================================================= */}
        {isSidebarOpen ? (
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-extrabold text-[#8C3B2B]/80 tracking-wide uppercase border-t border-amber-200/75 mt-1">
            प्रशासन व सेटिंग्ज
          </p>
        ) : (
          <div className="border-t border-amber-200/75 my-1" />
        )}

        {hasPermission(user?.role, 'Settings', 'View') && (
          <button 
            onClick={() => handleNavigate('settings')}
            title="सिस्टीम सेटिंग्ज"
            className={getItemClass(activeTab === 'settings' || activeTab === 'member-opening')}
          >
            <Settings size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${(activeTab === 'settings' || activeTab === 'member-opening') ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">सिस्टीम सेटिंग्ज</span>}
          </button>
        )}

        {['superadmin', 'super admin', 'admin', 'systemadmin', 'headoffice', 'ho_manager', 'ho manager'].includes(
          (user?.role || '').trim().toLowerCase()
        ) && (
          <button 
            onClick={() => handleNavigate('users')}
            title="युजर व्यवस्थापन"
            className={getItemClass(activeTab === 'users')}
          >
            <UserCog size={16} className={`${isSidebarOpen ? 'mr-2' : ''} shrink-0 ${activeTab === 'users' ? 'text-[#9A3412]' : 'text-[#8C5E4F] group-hover:text-[#B45309]'}`} />
            {isSidebarOpen && <span className="truncate">युजर व्यवस्थापन</span>}
          </button>
        )}

        {/* ========================================================================= */}
        {/* GROUP 6: LOGOUT                                                           */}
        {/* ========================================================================= */}
        <div className="pt-1.5 pb-1 border-t border-amber-200/75 mt-1">
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

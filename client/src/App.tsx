import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ArrowLeft,
  Menu, 
  LayoutDashboard, 
  BellRing, 
  UserCheck, 
  Users, 
  Award, 
  Landmark, 
  TrendingDown, 
  Wallet, 
  Building2, 
  Clock, 
  Coins, 
  Receipt, 
  BarChart3, 
  Building, 
  Scale, 
  Moon, 
  Calculator, 
  ShieldCheck, 
  FileSpreadsheet, 
  Settings, 
  UserCog,
  KeyRound,
  FileCheck,
  Gavel,
  LogOut
} from 'lucide-react';
import FinancialYearMaster from './components/FinancialYearMaster';
import CustomerMaster from './components/CustomerMaster';
import MemberMaster from './components/MemberMaster';
import EmployeeBankDetails from './components/EmployeeBankDetails';
import EmployerMaster from './components/EmployerMaster';
import CustomerOpeningBalance from './components/CustomerOpeningBalance';
import MemberOpeningBalance from './components/MemberOpeningBalance';
import MemberClosure from './components/MemberClosure';

import LoanProcessMaster from './components/LoanProcessMaster';
import LoanCollectionMaster from './components/LoanCollectionMaster';
import LoanInterestPostingMaster from './components/LoanInterestPostingMaster';

// Voucher & Accounting Modules
import VoucherMaster from './components/VoucherMaster';
import VoucherPosting from './components/VoucherPosting';
import SansthaMaster from './components/SansthaMaster';
import VoucherMappingMaster from './components/VoucherMappingMaster';
import Dashboard from './components/Dashboard';
import LoanDashboard from './components/LoanDashboard';
import SavingDashboard from './components/SavingDashboard';
import FdRdDashboard from './components/FdRdDashboard';
import PigmyDashboard from './components/PigmyDashboard';
import SharesDashboard from './components/SharesDashboard';
import VoucherDashboard from './components/VoucherDashboard';
import ReportDashboard from './components/ReportDashboard';
import TrialBalance from './components/TrialBalance';
import TrialBalanceNamunaN from './components/TrialBalanceNamunaN';
import ProfitAndLoss from './components/ProfitAndLoss';
import Daybook from './components/Daybook';
import DaybookSummary from './components/DaybookSummary';
import BalanceSheet from './components/BalanceSheet';
import BalanceSheetFormN from './components/BalanceSheetFormN';
import GeneralLedger from './components/GeneralLedger';
import CashBookReport from './components/CashBookReport';
import VoucherPrint from './components/VoucherPrint';
import VoucherBatchPrint from './components/VoucherBatchPrint';
import MemberBalanceReport from './components/MemberBalanceReport';
import LoanRateMaster from './components/LoanRateMaster';
import LoanDisbursementRegister from './components/LoanDisbursementRegister';
import LoanCollectionRegister from './components/LoanCollectionRegister';
import LoanLedgerReport from './components/LoanLedgerReport';
import LoanOverdueReport from './components/LoanOverdueReport';
import LoanRecoveryNoticeReport from './components/LoanRecoveryNoticeReport';
import GuarantorReport from './components/GuarantorReport';
import MemberListReport from './components/MemberListReport';
import AadhaarCardYadiReport from './components/AadhaarCardYadiReport';
import SabhasadLabhanshReport from './components/SabhasadLabhanshReport';
import SharesKhatavaniReport from './components/SharesKhatavaniReport';
import CbsSampleReport from './components/CbsSampleReport';
import SavingKhatavaniReport from './components/SavingKhatavaniReport';
import INamunaReport from './components/INamunaReport';
import VoterListReport from './components/VoterListReport';
import GoldLoanDetails from './components/GoldLoanDetails';
import GoldJewelryReport from './components/GoldJewelryReport';
import LoanDocumentsUpload from './components/LoanDocumentsUpload';
import NpaRegister from './components/NpaRegister';
import InterestWaiverRegister from './components/InterestWaiverRegister';
import SavingAccountMaster from './components/SavingAccountMaster';
import SavingTransactionEntry from './components/SavingTransactionEntry';
import SavingInterestSettingMaster from './components/SavingInterestSettingMaster';
import SavingInterestPostingMaster from './components/SavingInterestPostingMaster';
import SavingAccountClosingMaster from './components/SavingAccountClosingMaster';
import SavingPassbookMaster from './components/SavingPassbookMaster';
import GlobalContextMenu from './components/GlobalContextMenu';
import SettingsDashboard from './components/SettingsDashboard';
import CommitteeMaster from './components/CommitteeMaster';
import CoOpAuditComplianceMaster from './components/CoOpAuditComplianceMaster';
import SavingAccountListReport from './components/SavingAccountListReport';
import Member360Dashboard from './components/Member360Dashboard';
import ShareMaster from './components/ShareMaster';
import UserMaster from './components/UserMaster';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import LicenseGuardModal from './components/common/LicenseGuardModal';

import ShareWithdrawal from './components/ShareWithdrawal';
import ShareTransferMaster from './components/ShareTransferMaster';
import AuditLogReport from './components/AuditLogReport';
import NpaConfigMaster from './components/NpaConfigMaster';
import DayEndDashboard from './components/DayEndDashboard';
import ShareCertificateReport from './components/ShareCertificateReport';
import TodaysTasksDashboard from './components/TodaysTasksDashboard';
import NotificationCenter from './components/NotificationCenter';


// Fixed Deposit Module Imports
import FdSchemeMaster from './components/FdSchemeMaster';
import FdOpeningBalanceMigration from './components/FdOpeningBalanceMigration';
import FdAccountOpening from './components/FdAccountOpening';
import FdWithdrawalMaturity from './components/FdWithdrawalMaturity';
import FdAccrualPosting from './components/FdAccrualPosting';
import FdReports from './components/FdReports';

// Recurring Deposit Module Imports
import RdSchemeMaster from './components/RdSchemeMaster';
import RdOpeningBalanceMigration from './components/RdOpeningBalanceMigration';
import RdAccountOpening from './components/RdAccountOpening';
import RdInstallmentCollection from './components/RdInstallmentCollection';
import RdWithdrawalMaturity from './components/RdWithdrawalMaturity';
import RdAccrualPosting from './components/RdAccrualPosting';
import RdReports from './components/RdReports';
import RdDashboard from './components/RdDashboard';

// Pigmy Deposit Module Imports
import PigmySchemeMaster from './components/PigmySchemeMaster';
import PigmyAgentMaster from './components/PigmyAgentMaster';
import PigmyAccountOpening from './components/PigmyAccountOpening';
import PigmyCollectionMaster from './components/PigmyCollectionMaster';
import AgentDayBookMaster from './components/AgentDayBookMaster';
import AgentCommissionMaster from './components/AgentCommissionMaster';
import PigmyInterestPosting from './components/PigmyInterestPosting';
import PigmyClosureMaster from './components/PigmyClosureMaster';
import PigmyReports from './components/PigmyReports';

// Investment Module Imports
import InvestmentInstitutionMaster from './components/InvestmentInstitutionMaster';
import InvestmentSchemeMaster from './components/InvestmentSchemeMaster';
import InvestmentAccountOpening from './components/InvestmentAccountOpening';
import InvestmentMaturityClaim from './components/InvestmentMaturityClaim';
import InvestmentInterestAccrualPosting from './components/InvestmentInterestAccrualPosting';
import InvestmentReports from './components/InvestmentReports';

// Asset Module Imports
import AssetCategoryMaster from './components/AssetCategoryMaster';
import AssetMaster from './components/AssetMaster';
import AssetPurchaseForm from './components/AssetPurchaseForm';
import AssetReports from './components/AssetReports';

// NPA Module Imports
import NpaDashboard from './components/NpaDashboard';
import NpaStatementReport from './components/NpaStatementReport';
import CollateralComplianceTracker from './components/CollateralComplianceTracker';
import NpaDefaultersList from './components/NpaDefaultersList';

// Locker Module Imports
import LockerDashboard from './components/LockerDashboard';
import LockerTypeMaster from './components/LockerTypeMaster';
import LockerMaster from './components/LockerMaster';
import LockerAllotmentMaster from './components/LockerAllotmentMaster';
import LockerVisitRegister from './components/LockerVisitRegister';
import LockerRentRenewal from './components/LockerRentRenewal';
import LockerSurrenderMaster from './components/LockerSurrenderMaster';
import LockerReports from './components/LockerReports';

// Legal Recovery (Sec 101 / 91) Module Imports
import LegalRecoveryDashboard from './components/LegalRecoveryDashboard';
import Sec101NoticeMaster from './components/Sec101NoticeMaster';
import Sec101CaseFilingMaster from './components/Sec101CaseFilingMaster';
import Sec101HearingDiary from './components/Sec101HearingDiary';
import Sec101ExecutionAuctionMaster from './components/Sec101ExecutionAuctionMaster';
import Sec101LegalReports from './components/Sec101LegalReports';
import LegalRecoveryMappingMaster from './components/LegalRecoveryMappingMaster';

// Utilities
import InterestCalculator from './components/InterestCalculator';

// Cash Management & Cashier Window Imports
import CashierDashboard from './components/CashierDashboard';
import CashAllocation from './components/CashAllocation';
import CashDenominationEntry from './components/CashDenominationEntry';

import { useAuth } from './context/AuthContext';
import LoginForm from './components/LoginForm';

function App() {
  const { user, logout, switchBranch } = useAuth();
  const [headerBranches, setHeaderBranches] = useState<any[]>([]);
  const [showLoginNotifications, setShowLoginNotifications] = useState(false);

  useEffect(() => {
    if (user && sessionStorage.getItem('just_logged_in') === 'true') {
      setShowLoginNotifications(true);
      sessionStorage.removeItem('just_logged_in');
    }
  }, [user]);
  
  const tabToPathMap: Record<string, string> = {
    // Core & Dashboards
    'dashboard': '/dashboard',
    'todays-tasks': '/todays-tasks',
    'member-360': '/member-360',
    'committee': '/committee',
    'audit-compliance': '/audit-compliance',

    // Member & Share Module
    'shares': '/shares/dashboard',
    'members': '/members',
    'member-opening': '/members/opening-balance',
    'member-closure': '/members/closure',
    'share-master': '/shares/allocation',
    'share-withdrawal': '/shares/withdrawal',

    // Loan Department (कर्ज विभाग)
    'loan': '/karjvibhag',
    'loan-process': '/karjvibhag/karjmagni',
    'gold-loan-details': '/karjvibhag/goldloan',
    'loan-collection': '/karjvibhag/vasuli',
    'loan-interest-posting': '/karjvibhag/vyaj',
    'loan-documents': '/karjvibhag/documents',
    'loan-rate': '/karjvibhag/yojana',
    'employer-master': '/karjvibhag/employer',
    'employee-bank': '/karjvibhag/employee-bank',

    // Saving Deposit (बचत ठेव)
    'saving': '/saving/dashboard',
    'saving-account': '/saving/accounts',
    'saving-transaction': '/saving/transaction',
    'saving-setting': '/saving/interest-setting',
    'saving-posting': '/saving/interest-posting',
    'saving-closing': '/saving/account-closing',
    'saving-passbook': '/saving/passbook',

    // Fixed Deposit (मुदत ठेव - FD)
    'fd': '/fd/dashboard',
    'fd-account': '/fd/account-opening',
    'fd-scheme': '/fd/schemes',
    'fd-migrate': '/fd/opening-balance',
    'fd-withdrawal': '/fd/withdrawal-maturity',
    'fd-accrual': '/fd/interest-accrual',
    'fd-reports': '/fd/reports',

    // Recurring Deposit (आवर्ती ठेव - RD)
    'rd-account': '/rd/account-opening',
    'rd': '/rd/account-opening',
    'rd-scheme': '/rd/schemes',
    'rd-migrate': '/rd/opening-balance',
    'rd-collect': '/rd/collection',
    'rd-collection': '/rd/collection',
    'rd-withdrawal': '/rd/withdrawal-maturity',
    'rd-accrual': '/rd/interest-accrual',
    'rd-reports': '/rd/reports',

    // Pigmy Deposit (पिग्मी ठेव)
    'pigmy': '/pigmy/dashboard',
    'pigmy-account': '/pigmy/account-opening',
    'pigmy-agent': '/pigmy/agent-registration',
    'pigmy-collection': '/pigmy/daily-collection',
    'pigmy-collect': '/pigmy/daily-collection',
    'pigmy-daybook': '/pigmy/agent-daybook',
    'pigmy-commission': '/pigmy/agent-commission',
    'pigmy-interest': '/pigmy/interest-posting',
    'pigmy-closure': '/pigmy/account-closure',
    'pigmy-reports': '/pigmy/reports',

    // Voucher & Accounting (व्हाऊचर व्यवस्थापन)
    'vouchers': '/vouchers/dashboard',
    'voucher': '/voucher/entry',
    'voucher-posting': '/voucher/passing',
    'voucher-batch-print': '/voucher/batch-print',

    // Cash Management & Cashier Window (कॅश मॅनेजमेंट)
    'cashier-dashboard': '/cashier/dashboard',
    'cash-management': '/cashier/dashboard',
    'cash-allocation': '/cashier/allocation',
    'cash-denomination': '/cashier/denomination',

    // Investment Module (गुंतवणूक)
    'inv-institution': '/investment/institutions',
    'investment': '/investment/institutions',
    'inv-scheme': '/investment/schemes',
    'inv-account': '/investment/accounts',
    'inv-claim': '/investment/maturity-claims',
    'inv-accrual': '/investment/interest-accrual',
    'inv-reports': '/investment/reports',

    // Asset Management (मालमत्ता व्यवस्थापन)
    'asset-category': '/assets/categories',
    'assets': '/assets/categories',
    'asset-master': '/assets/master',
    'asset-purchase': '/assets/purchase',
    'asset-reports': '/assets/reports',

    // NPA Module (एन.पी.ए. विभाग)
    'npa-dashboard': '/npa/dashboard',
    'npa-config': '/npa/config',
    'npa-statement': '/npa/statement',
    'collateral-compliance': '/npa/collateral-compliance',
    'npa-defaulters': '/npa/defaulters',

    // Locker Module (लॉकर विभाग)
    'locker': '/locker',
    'locker-dashboard': '/locker/dashboard',
    'locker-types': '/locker/types',
    'locker-master': '/locker/inventory',
    'locker-allotment': '/locker/allotment',
    'locker-visit-register': '/locker/visits',
    'locker-rent-renewal': '/locker/rent-renewal',
    'locker-surrender': '/locker/surrender',
    'locker-reports': '/locker/reports',

    // Legal Recovery Section 101/91 (सहकार कायदा कलम १०१/९१ कायदेशीर वसुली)
    'legal-recovery': '/legal-recovery',
    'sec101-notices': '/legal-recovery/notices',
    'sec101-filing': '/legal-recovery/filing',
    'sec101-hearings': '/legal-recovery/hearings',
    'sec101-executions': '/legal-recovery/executions',
    'sec101-reports': '/legal-recovery/reports',
    'sec101-mapping': '/legal-recovery/mapping',

    // EOD / Day End
    'day-end': '/day-end',
    'eod-dashboard': '/day-end',

    // Reports Center (अहवाल केंद्र)
    'reports': '/reports',
    'trial-balance': '/reports/trial-balance',
    'trial-balance-namuna-n': '/reports/trial-balance-form-n',
    'cash-book': '/reports/cash-book',
    'daybook': '/reports/daybook',
    'daybook-summary': '/reports/daybook-summary',
    'profit-loss': '/reports/profit-loss',
    'balance-sheet': '/reports/balance-sheet',
    'balance-sheet-form-n': '/reports/balance-sheet-form-n',
    'general-ledger': '/reports/general-ledger',
    'member-balance-report': '/reports/member-balance',
    'loan-disbursement-register': '/reports/loan-disbursement',
    'loan-collection-register': '/reports/loan-collection',
    'loan-ledger-report': '/reports/loan-ledger',
    'loan-overdue-report': '/reports/loan-overdue',
    'loan-recovery-notice-report': '/reports/loan-recovery-notice',
    'interest-waiver-register': '/reports/interest-waiver',
    'guarantor-loan-report': '/reports/guarantor-report',
    'member-list-report': '/reports/member-list',
    'aadhaar-list': '/reports/aadhaar-list',
    'sabhasad-labhansh-report': '/reports/labhansh-report',
    'shares-khatavani-report': '/reports/shares-khatavani',
    'cbs-sample-report': '/reports/cbs-sample',
    'i-namuna-report': '/reports/i-namuna',
    'voter-list-report': '/reports/voter-list',
    'saving-account-list-report': '/reports/saving-account-list',
    'saving-khatavani-report': '/reports/saving-khatavani',
    'npa-register': '/reports/npa-register',
    'gold-jewelry-report': '/reports/gold-jewelry',
    'gold-jewelry': '/reports/gold-jewelry',
    'audit-logs': '/reports/audit-logs',

    // Utilities & System Settings
    'interest-calculator': '/utilities/interest-calculator',
    'settings': '/settings',
    'users': '/users',
  };

  const pathToTabMap: Record<string, string> = Object.entries(tabToPathMap).reduce(
    (acc, [tab, path]) => {
      acc[path.toLowerCase()] = tab;
      return acc;
    },
    {} as Record<string, string>
  );

  const getTabFromURL = () => {
    const pathname = window.location.pathname.toLowerCase();
    if (pathToTabMap[pathname]) {
      return pathToTabMap[pathname];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getTabFromURL);
  const [lastMemberId, setLastMemberId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('memberId');
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'blue';
  });

  useEffect(() => {
    let isMounted = true;
    if (user) {
      fetch('/api/Branches')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (isMounted) setHeaderBranches(data);
        })
        .catch(err => console.error("Error loading header branches", err));
    }
    return () => { isMounted = false; };
  }, [user?.token]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromURL());
      const mId = new URLSearchParams(window.location.search).get('memberId');
      if (mId) setLastMemberId(mId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (tab: string, params?: any) => {
    if (params && params.memberId) {
      setLastMemberId(String(params.memberId));
    }
    let targetUrl = '';
    if (tabToPathMap[tab]) {
      targetUrl = tabToPathMap[tab];
      if (params) {
        const queryParams = new URLSearchParams(params).toString();
        if (queryParams) targetUrl += `?${queryParams}`;
      }
    } else {
      targetUrl = `?tab=${tab}`;
      if (params) {
        Object.keys(params).forEach(key => {
          targetUrl += `&${key}=${params[key]}`;
        });
      }
    }
    window.history.pushState(null, '', targetUrl);
    setActiveTab(tab);
  };

  if (!user) {
    return (
      <>
        <LicenseGuardModal />
        <LoginForm />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <LicenseGuardModal />
      <GlobalContextMenu />
      {/* Sidebar */}
      <aside className={`bg-white text-slate-700 shadow-xl flex flex-col z-20 border-r border-slate-200 h-full print:hidden transition-all duration-300 ease-in-out shrink-0 ${isSidebarOpen ? 'w-56' : 'w-14'}`}>
        <div className={`h-9 flex items-center border-b border-slate-100 shrink-0 bg-slate-50/80 ${isSidebarOpen ? 'justify-between px-3' : 'justify-center px-1'}`}>
          {isSidebarOpen ? (
            <>
              <div className="flex items-center space-x-2 truncate">
                <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center font-black text-white text-[10px] shadow-2xs shrink-0">S</div>
                <span className="text-xs font-bold text-slate-800 tracking-wide truncate">SMART <span className="text-emerald-600 font-bold">BANKING</span></span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-200/60 transition-colors shrink-0"
                title="साईडबार बंद करा"
              >
                <ChevronLeft size={16} />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="text-emerald-600 font-black text-sm flex items-center justify-center w-full h-full hover:scale-110 transition-transform"
              title="साईडबार उघडा"
            >
              <div className="w-6 h-6 rounded bg-emerald-100 border border-emerald-300 flex items-center justify-center font-black text-emerald-700 text-[10px]">S</div>
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">

          {/* Main Group */}
          {isSidebarOpen && <p className="px-2 pt-1 pb-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase">मुख्य डॅशबोर्ड</p>}

          <button 
            onClick={() => handleNavigate('dashboard')}
            title="डॅशबोर्ड"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'dashboard' 
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <LayoutDashboard size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">डॅशबोर्ड</span>}
          </button>

          <button 
            onClick={() => handleNavigate('todays-tasks')}
            title="आजची कामे"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'todays-tasks' 
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <BellRing size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${activeTab === 'todays-tasks' ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">आजची कामे</span>}
          </button>

          <button 
            onClick={() => handleNavigate('member-360')}
            title="खातेदार ३६०°"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'member-360' 
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <UserCheck size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${activeTab === 'member-360' ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">खातेदार ३६०°</span>}
          </button>

          <button 
            onClick={() => handleNavigate('customers')}
            title="ग्राहक नोंदणी (CIF)"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'customers'
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <Users size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${activeTab === 'customers' ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">ग्राहक नोंदणी (CIF)</span>}
          </button>

          {/* Business Modules Group */}
          {isSidebarOpen ? (
            <p className="px-2 pt-3 pb-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-t border-slate-100 mt-3">बँकिंग व्यवहार</p>
          ) : (
            <div className="border-t border-slate-100 my-2" />
          )}

          <button 
            onClick={() => handleNavigate('members')}
            title="सभासद नोंदणी व शेअर्स"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'members' || activeTab === 'share-master' || activeTab === 'share-transfer' || activeTab === 'member-closure' || activeTab === 'share-withdrawal'
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <Award size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'members' || activeTab === 'share-master' || activeTab === 'share-transfer' || activeTab === 'member-closure' || activeTab === 'share-withdrawal') ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">सभासद नोंदणी (Shares)</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${activeTab === 'members' || activeTab === 'share-master' || activeTab === 'share-transfer' || activeTab === 'member-closure' || activeTab === 'share-withdrawal' ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'members' || activeTab === 'share-master' || activeTab === 'share-transfer' || activeTab === 'member-closure' || activeTab === 'share-withdrawal') && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'members' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('members')}
              >
                <span className="truncate">› सभासदत्व अर्ज व भाग वाटप</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'share-master' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('share-master')}
              >
                <span className="truncate">› अतिरिक्त शेअर खरेदी व वाटप</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'share-transfer' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('share-transfer')}
              >
                <span className="truncate">› शेअर हस्तांतरण (Transfer)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'member-closure' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('member-closure')}
              >
                <span className="truncate">› सभासदत्व समाप्ती / बंद</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'share-withdrawal' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('share-withdrawal')}
              >
                <span className="truncate">› शेअर परतावा</span>
              </li>
            </ul>
          )}


          <button 
            onClick={() => handleNavigate('loan')}
            title="कर्ज विभाग"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'loan' || activeTab.startsWith('loan') || activeTab === 'gold-loan-details' || activeTab === 'employee-bank' || activeTab === 'employer-master') 
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <TrendingDown size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'loan' || activeTab.startsWith('loan') || activeTab === 'gold-loan-details' || activeTab === 'employee-bank' || activeTab === 'employer-master') ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">कर्ज विभाग (Loan Dept)</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'loan' || activeTab.startsWith('loan') || activeTab === 'gold-loan-details' || activeTab === 'employee-bank' || activeTab === 'employer-master') ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'loan' || activeTab.startsWith('loan') || activeTab === 'gold-loan-details' || activeTab === 'employee-bank' || activeTab === 'employer-master') && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${(activeTab === 'loan' || activeTab === 'loan-process') ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('loan-process')}
              >
                <span className="truncate">› कर्ज मागणी व वितरण</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'gold-loan-details' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('gold-loan-details')}
              >
                <span className="truncate">› सुवर्ण कर्ज तारण</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'gold-jewelry-report' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('gold-jewelry-report')}
              >
                <span className="truncate">› सोने जिन्नस यादी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'loan-collection' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('loan-collection')}
              >
                <span className="truncate">› कर्ज वसुली नोंदी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'loan-interest-posting' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('loan-interest-posting')}
              >
                <span className="truncate">› कर्ज व्याज आकारणी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'loan-documents' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('loan-documents')}
              >
                <span className="truncate">› कर्ज कागदपत्रे</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'loan-rate' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('loan-rate')}
              >
                <span className="truncate">› कर्ज योजना व व्याजदर</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'employer-master' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('employer-master')}
              >
                <span className="truncate">› नियोक्ता (Employer) मास्टर</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'employee-bank' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('employee-bank')}
              >
                <span className="truncate">› कर्मचारी बँक खाती</span>
              </li>
            </ul>
          )}

          <button 
            onClick={() => handleNavigate('saving')}
            title="बचत ठेव"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'saving' || activeTab === 'saving-account' || activeTab === 'saving-transaction' || activeTab === 'saving-setting' || activeTab === 'saving-posting' || activeTab === 'saving-closing' || activeTab === 'saving-passbook')
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <Wallet size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'saving' || activeTab === 'saving-account' || activeTab === 'saving-transaction' || activeTab === 'saving-setting' || activeTab === 'saving-posting' || activeTab === 'saving-closing' || activeTab === 'saving-passbook') ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">बचत ठेव</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'saving' || activeTab === 'saving-account' || activeTab === 'saving-transaction' || activeTab === 'saving-setting' || activeTab === 'saving-posting' || activeTab === 'saving-closing' || activeTab === 'saving-passbook') ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'saving' || activeTab === 'saving-account' || activeTab === 'saving-transaction' || activeTab === 'saving-setting' || activeTab === 'saving-posting' || activeTab === 'saving-closing' || activeTab === 'saving-passbook') && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'saving-account' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('saving-account')}
              >
                <span className="truncate">› बचत खाती</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'saving-transaction' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('saving-transaction')}
              >
                <span className="truncate">› जमा/नावे व्यवहार</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'saving-posting' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('saving-posting')}
              >
                <span className="truncate">› व्याज आकारणी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'saving-passbook' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('saving-passbook')}
              >
                <span className="truncate">› पासबुक प्रिंट</span>
              </li>
            </ul>
          )}

          <button 
            onClick={() => handleNavigate('fd-account')}
            title="मुदत ठेव"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'fd' || activeTab === 'fd-scheme' || activeTab === 'fd-migrate' || activeTab === 'fd-account' || activeTab === 'fd-withdrawal' || activeTab === 'fd-accrual' || activeTab === 'fd-reports')
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <Building2 size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'fd' || activeTab === 'fd-scheme' || activeTab === 'fd-migrate' || activeTab === 'fd-account' || activeTab === 'fd-withdrawal' || activeTab === 'fd-accrual' || activeTab === 'fd-reports') ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">मुदत ठेव (FD)</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'fd' || activeTab === 'fd-scheme' || activeTab === 'fd-migrate' || activeTab === 'fd-account' || activeTab === 'fd-withdrawal' || activeTab === 'fd-accrual' || activeTab === 'fd-reports') ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'fd' || activeTab === 'fd-scheme' || activeTab === 'fd-migrate' || activeTab === 'fd-account' || activeTab === 'fd-withdrawal' || activeTab === 'fd-accrual' || activeTab === 'fd-reports') && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'fd-account' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('fd-account')}
              >
                <span className="truncate">› नवीन ठेव खाते</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'fd-withdrawal' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('fd-withdrawal')}
              >
                <span className="truncate">› नूतनीकरण / परतावा</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'fd-accrual' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('fd-accrual')}
              >
                <span className="truncate">› मुदत ठेव व्याज तरतूद (Accrual)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'fd-reports' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('fd-reports')}
              >
                <span className="truncate">› मुदत ठेव अहवाल (FD Reports)</span>
              </li>
            </ul>
          )}

          <button 
            onClick={() => handleNavigate('rd-account')}
            title="आवर्ती ठेव"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'rd' || activeTab === 'rd-migrate' || activeTab === 'rd-account' || activeTab === 'rd-collect' || activeTab === 'rd-withdrawal' || activeTab === 'rd-accrual' || activeTab === 'rd-reports')
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <Clock size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'rd' || activeTab === 'rd-migrate' || activeTab === 'rd-account' || activeTab === 'rd-collect' || activeTab === 'rd-withdrawal' || activeTab === 'rd-accrual' || activeTab === 'rd-reports') ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">आवर्ती ठेव (RD)</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'rd' || activeTab === 'rd-migrate' || activeTab === 'rd-account' || activeTab === 'rd-collect' || activeTab === 'rd-withdrawal' || activeTab === 'rd-accrual' || activeTab === 'rd-reports') ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'rd' || activeTab === 'rd-migrate' || activeTab === 'rd-account' || activeTab === 'rd-collect' || activeTab === 'rd-withdrawal' || activeTab === 'rd-accrual' || activeTab === 'rd-reports') && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'rd-account' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('rd-account')}
              >
                <span className="truncate">› नवीन आरडी खाते</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'rd-collect' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('rd-collect')}
              >
                <span className="truncate">› हप्ता संकलन (Collection)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'rd-withdrawal' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('rd-withdrawal')}
              >
                <span className="truncate">› नूतनीकरण / परतावा</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'rd-reports' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('rd-reports')}
              >
                <span className="truncate">› आरडी अहवाल (Reports)</span>
              </li>
            </ul>
          )}

          <button 
            onClick={() => handleNavigate('pigmy-account')}
            title="पिग्मी ठेव"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'pigmy' || activeTab.startsWith('pigmy'))
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <Coins size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'pigmy' || activeTab.startsWith('pigmy')) ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">पिग्मी ठेव</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'pigmy' || activeTab.startsWith('pigmy')) ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'pigmy' || activeTab.startsWith('pigmy')) && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'pigmy-account' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('pigmy-account')}
              >
                <span className="truncate">› नवीन पिग्मी खाते</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${(activeTab === 'pigmy' || activeTab === 'pigmy-agent') ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('pigmy-agent')}
              >
                <span className="truncate">› पिग्मी एजंट नोंदणी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${(activeTab === 'pigmy-collection' || activeTab === 'pigmy-collect') ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('pigmy-collection')}
              >
                <span className="truncate">› दैनंदिन संकलन (Collection)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'pigmy-daybook' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('pigmy-daybook')}
              >
                <span className="truncate">› एजंट डे-बुक / संकलन नोंद</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'pigmy-commission' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('pigmy-commission')}
              >
                <span className="truncate">› एजंट कमिशन व्यवस्थापन</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'pigmy-interest' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('pigmy-interest')}
              >
                <span className="truncate">› पिग्मी व्याज आकारणी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'pigmy-closure' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('pigmy-closure')}
              >
                <span className="truncate">› खाते बंद (Closure)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab.startsWith('pigmy-reports') ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('pigmy-reports')}
              >
                <span className="truncate">› पिग्मी अहवाल (Reports)</span>
              </li>
            </ul>
          )}

          <button 
            onClick={() => handleNavigate('voucher')}
            title="वाउचर / पावती"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'voucher' || activeTab === 'voucher-posting' || activeTab === 'voucher-batch-print')
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <Receipt size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'voucher' || activeTab === 'voucher-posting' || activeTab === 'voucher-batch-print') ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">वाउचर / पावती</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'voucher' || activeTab === 'voucher-posting' || activeTab === 'voucher-batch-print') ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'voucher' || activeTab === 'voucher-posting' || activeTab === 'voucher-batch-print') && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'voucher' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('voucher')}
              >
                <span className="truncate">› वाउचर नोंदणी (Entry)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'voucher-posting' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('voucher-posting')}
              >
                <span className="truncate">› वाउचर पासिंग (Passing)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'voucher-batch-print' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('voucher-batch-print')}
              >
                <span className="truncate">› बॅच प्रिंट (Batch Print)</span>
              </li>
            </ul>
          )}

          {/* Cash Management / Cashier Window (कॅश मॅनेजमेंट) */}
          <button 
            onClick={() => handleNavigate('cashier-dashboard')}
            title="कॅश मॅनेजमेंट"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'cashier-dashboard' || activeTab === 'cash-management' || activeTab === 'cash-allocation' || activeTab === 'cash-denomination')
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <Coins size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'cashier-dashboard' || activeTab === 'cash-management' || activeTab === 'cash-allocation' || activeTab === 'cash-denomination') ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">कॅश मॅनेजमेंट</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'cashier-dashboard' || activeTab === 'cash-management' || activeTab === 'cash-allocation' || activeTab === 'cash-denomination') ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'cashier-dashboard' || activeTab === 'cash-management' || activeTab === 'cash-allocation' || activeTab === 'cash-denomination') && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'cashier-dashboard' || activeTab === 'cash-management' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('cashier-dashboard')}
              >
                <span className="truncate">› कॅशिअर डॅशबोर्ड</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'cash-allocation' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('cash-allocation')}
              >
                <span className="truncate">› रोख वाटप (Allocation)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'cash-denomination' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('cash-denomination')}
              >
                <span className="truncate">› नोटांची मोजणी (Denomination)</span>
              </li>
            </ul>
          )}

          <button 
            onClick={() => handleNavigate('inv-institution')}
            title="गुंतवणूक"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'investment' || activeTab.startsWith('inv-'))
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <BarChart3 size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'investment' || activeTab.startsWith('inv-')) ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">गुंतवणूक (Investment)</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'investment' || activeTab.startsWith('inv-')) ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'investment' || activeTab.startsWith('inv-')) && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${(activeTab === 'investment' || activeTab === 'inv-institution') ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('inv-institution')}
              >
                <span className="truncate">› बँक / संस्था नोंदणी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'inv-account' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('inv-account')}
              >
                <span className="truncate">› नवीन गुंतवणूक खाते</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'inv-claim' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('inv-claim')}
              >
                <span className="truncate">› मुदतपूर्ती / परतावा दावा</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'inv-accrual' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('inv-accrual')}
              >
                <span className="truncate">› गुंतवणूक व्याज तरतूद</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'inv-reports' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('inv-reports')}
              >
                <span className="truncate">› गुंतवणूक अहवाल (Reports)</span>
              </li>
            </ul>
          )}

          <button 
            onClick={() => handleNavigate('asset-category')}
            title="मालमत्ता"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'assets' || activeTab.startsWith('asset-'))
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <Building size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'assets' || activeTab.startsWith('asset-')) ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">मालमत्ता व्यवस्थापन</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'assets' || activeTab.startsWith('asset-')) ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'assets' || activeTab.startsWith('asset-')) && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${(activeTab === 'assets' || activeTab === 'asset-category') ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('asset-category')}
              >
                <span className="truncate">› मालमत्ता वर्ग (Category)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'asset-master' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('asset-master')}
              >
                <span className="truncate">› मालमत्ता मास्टर नोंदणी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'asset-purchase' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('asset-purchase')}
              >
                <span className="truncate">› नवीन मालमत्ता खरेदी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'asset-reports' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('asset-reports')}
              >
                <span className="truncate">› मालमत्ता अहवाल (Reports)</span>
              </li>
            </ul>
          )}

          {/* Locker Module Sidebar Item */}
          <button 
            onClick={() => handleNavigate('locker-dashboard')}
            title="लॉकर विभाग"
            className={`w-full flex items-center justify-between ${isSidebarOpen ? 'px-3' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'locker' || activeTab.startsWith('locker-'))
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <div className="flex items-center truncate">
              <KeyRound size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'locker' || activeTab.startsWith('locker-')) ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">लॉकर विभाग (Locker Dept)</span>}
            </div>
            {isSidebarOpen && <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${(activeTab === 'locker' || activeTab.startsWith('locker-')) ? 'rotate-180 text-emerald-600' : ''}`} />}
          </button>

          {isSidebarOpen && (activeTab === 'locker' || activeTab.startsWith('locker-')) && (
            <ul className="pl-7 space-y-1 border-l-2 border-slate-200 ml-4 my-1">
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${(activeTab === 'locker' || activeTab === 'locker-dashboard') ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('locker-dashboard')}
              >
                <span className="truncate">› लॉकर डॅशबोर्ड</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'locker-master' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('locker-master')}
              >
                <span className="truncate">› कपाट व इन्व्हेंटरी</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'locker-types' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('locker-types')}
              >
                <span className="truncate">› लॉकर प्रकार व दर</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'locker-allotment' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('locker-allotment')}
              >
                <span className="truncate">› नवीन लॉकर वाटप</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'locker-visit-register' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('locker-visit-register')}
              >
                <span className="truncate">› दैनिक व्हिजिट नोंद</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'locker-rent-renewal' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('locker-rent-renewal')}
              >
                <span className="truncate">› भाडे नूतनीकरण व वसुली</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'locker-surrender' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('locker-surrender')}
              >
                <span className="truncate">› लॉकर समर्पण (Surrender)</span>
              </li>
              <li 
                className={`px-3 py-1 cursor-pointer flex items-center transition-colors text-[11px] rounded ${activeTab === 'locker-reports' ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => handleNavigate('locker-reports')}
              >
                <span className="truncate">› लॉकर अहवाल व नोटीस</span>
              </li>
            </ul>
          )}

          <button 
            onClick={() => handleNavigate('npa-dashboard')}
            title="एन.पी.ए. विभाग"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'npa-dashboard' || activeTab === 'npa-statement' || activeTab === 'collateral-compliance' || activeTab === 'npa-defaulters')
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <Scale size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'npa-dashboard' || activeTab === 'npa-statement' || activeTab === 'collateral-compliance' || activeTab === 'npa-defaulters') ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">एन.पी.ए. विभाग</span>}
          </button>

          {/* Section 101/91 Legal Recovery Sidebar Item */}
          <button 
            onClick={() => handleNavigate('legal-recovery')}
            title="कलम १०१ कायदेशीर वसुली (Sec 101 Legal Recovery)"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              (activeTab === 'legal-recovery' || activeTab.startsWith('sec101-'))
                ? 'bg-amber-50 text-amber-950 font-bold border-l-4 border-amber-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <Gavel size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'legal-recovery' || activeTab.startsWith('sec101-')) ? 'text-amber-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">कलम १०१ कायदेशीर वसुली</span>}
          </button>

          <button 
            onClick={() => handleNavigate('committee')}
            title="पंच कमिटी (संचालक मंडळ)"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'committee' 
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <UserCheck size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${activeTab === 'committee' ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">पंच कमिटी (संचालक मंडळ)</span>}
          </button>

          {/* Utilities & Systems Group */}
          {isSidebarOpen ? (
            <p className="px-2 pt-3 pb-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-t border-slate-100 mt-3">युटिलिटीज (Utilities)</p>
          ) : (
            <div className="border-t border-slate-100 my-2" />
          )}

          <button 
            onClick={() => handleNavigate('day-end')}
            title="दिवस समाप्ती (EOD)"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'day-end' || activeTab === 'eod-dashboard'
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <Moon size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'day-end' || activeTab === 'eod-dashboard') ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">दिवस समाप्ती (EOD)</span>}
          </button>

          <button 
            onClick={() => handleNavigate('interest-calculator')}
            title="व्याज कॅल्क्युलेटर"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'interest-calculator' 
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <Calculator size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${activeTab === 'interest-calculator' ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">व्याज कॅल्क्युलेटर</span>}
          </button>

          <button 
            onClick={() => handleNavigate('audit-compliance')}
            title="सहकार ऑडीट व कम्प्लायन्स"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'audit-compliance'
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <ShieldCheck size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${activeTab === 'audit-compliance' ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">ऑडीट व कम्प्लायन्स</span>}
          </button>

          {/* Dedicated Highlighted Voucher Passing / Approval Master Group */}
          {isSidebarOpen ? (
            <p className="px-2 pt-3 pb-1 text-[10px] font-extrabold text-amber-700 tracking-wider uppercase border-t border-amber-200/80 mt-3 flex items-center gap-1">
              <span>⚡</span> व्हाउचर्स मंजुरी (APPROVAL)
            </p>
          ) : (
            <div className="border-t border-amber-200/80 my-2" />
          )}

          <button 
            onClick={() => handleNavigate('voucher-posting')}
            title="वाउचर पासिंग व मंजुरी फॉर्म (Voucher Passing / Approval Master)"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2.5 rounded-lg text-xs transition-all duration-200 shadow-sm ${
              activeTab === 'voucher-posting' || activeTab === 'voucher-approval'
                ? 'bg-gradient-to-r from-amber-600 via-emerald-700 to-teal-800 text-white font-bold shadow-md ring-2 ring-amber-300' 
                : 'bg-gradient-to-r from-amber-50 to-emerald-50 text-emerald-950 hover:from-amber-100 hover:to-emerald-100 font-bold border border-amber-300/80'
            }`}
          >
            <FileCheck size={19} className={`${isSidebarOpen ? 'mr-2.5' : ''} shrink-0 ${(activeTab === 'voucher-posting' || activeTab === 'voucher-approval') ? 'text-white' : 'text-amber-700'}`} />
            {isSidebarOpen && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate">वाउचर पासिंग व मंजुरी</span>
                <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-amber-600 text-white font-black rounded-full uppercase tracking-tighter shadow-2xs">मंजुरी</span>
              </div>
            )}
          </button>

          {/* Dedicated Highlighted Reports Center Group */}
          {isSidebarOpen ? (
            <p className="px-2 pt-3 pb-1 text-[10px] font-extrabold text-blue-600 tracking-wider uppercase border-t border-blue-100 mt-3 flex items-center gap-1">
              <span>📊</span> अहवाल विभाग (REPORTS)
            </p>
          ) : (
            <div className="border-t border-blue-200 my-2" />
          )}

          <button 
            onClick={() => handleNavigate('reports')}
            title="सर्व अहवाल केंद्र (Reports Center)"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2.5 rounded-lg text-xs transition-all duration-200 shadow-sm ${
              activeTab === 'reports' || activeTab === 'trial-balance' || activeTab === 'trial-balance-namuna-n' || activeTab === 'daybook' || activeTab === 'daybook-summary' || activeTab === 'profit-loss' || activeTab === 'balance-sheet' || activeTab === 'balance-sheet-form-n' || activeTab === 'general-ledger' || activeTab === 'member-balance-report' || activeTab === 'loan-disbursement-register' || activeTab === 'loan-collection-register' || activeTab === 'loan-ledger-report' || activeTab === 'loan-overdue-report' || activeTab === 'saving-account-list-report' || activeTab === 'saving-khatavani-report' || activeTab === 'npa-register' || activeTab === 'loan-rate' || activeTab === 'sabhasad-labhansh-report' || activeTab === 'shares-khatavani-report'
                ? 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white font-bold shadow-md ring-2 ring-blue-300' 
                : 'bg-blue-50/90 text-blue-950 hover:bg-blue-100 hover:text-blue-900 font-bold border border-blue-200'
            }`}
          >
            <FileSpreadsheet size={19} className={`${isSidebarOpen ? 'mr-2.5' : ''} shrink-0 ${(activeTab === 'reports' || activeTab === 'trial-balance' || activeTab === 'daybook') ? 'text-white' : 'text-blue-600'}`} />
            {isSidebarOpen && (
              <div className="flex items-center justify-between w-full">
                <span className="truncate">सर्व रिपोर्ट</span>
                <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-blue-600 text-white font-black rounded-full uppercase tracking-tighter shadow-2xs">मुख्य</span>
              </div>
            )}
          </button>

          {/* Admin & Settings Group */}
          {isSidebarOpen ? (
            <p className="px-2 pt-3 pb-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-t border-slate-100 mt-3">प्रशासन व सेटिंग्ज</p>
          ) : (
            <div className="border-t border-slate-100 my-2" />
          )}

          <button 
            onClick={() => handleNavigate('settings')}
            title="सिस्टीम सेटिंग्ज"
            className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
              activeTab === 'settings' || activeTab === 'member-opening'
                ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
            }`}
          >
            <Settings size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${(activeTab === 'settings' || activeTab === 'member-opening') ? 'text-emerald-600' : 'text-slate-500'}`} />
            {isSidebarOpen && <span className="truncate">सिस्टीम सेटिंग्ज</span>}
          </button>

          {(user.role === 'Admin' || user.role === 'HO_Manager' || user.role === 'HO Manager') && (
            <button 
              onClick={() => handleNavigate('users')}
              title="युजर व्यवस्थापन"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs transition-all duration-150 ${
                activeTab === 'users' 
                  ? 'bg-emerald-50 text-emerald-950 font-bold border-l-4 border-emerald-600 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
              }`}
            >
              <UserCog size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 ${activeTab === 'users' ? 'text-emerald-600' : 'text-slate-500'}`} />
              {isSidebarOpen && <span className="truncate">युजर व्यवस्थापन</span>}
            </button>
          )}

          {/* Logout Button in Sidebar */}
          <div className="pt-2 border-t border-slate-200 mt-2">
            <button
              onClick={logout}
              title="लॉगआउट (Logout)"
              className={`w-full flex items-center ${isSidebarOpen ? 'px-3 justify-start' : 'px-0 justify-center'} py-2 rounded-md text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-150 border border-transparent hover:border-red-200`}
            >
              <LogOut size={18} className={`${isSidebarOpen ? 'mr-3' : ''} shrink-0 text-red-500`} />
              {isSidebarOpen && <span>लॉगआउट (Logout)</span>}
            </button>
          </div>

        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-gray-50 overflow-hidden relative">
        {/* Network Disconnection Status Monitor Banner */}
        <NetworkStatusBanner />

        {/* Global Header - Slim & Compact Ribbon (Mobile Responsive) */}
        <header className="h-9 bg-white border-b border-gray-200 flex justify-between items-center px-2 sm:px-3 shrink-0 shadow-2xs z-10 print:hidden text-xs">
          <div className="flex items-center space-x-1.5 sm:space-x-2 font-medium text-gray-700 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-primary transition-colors focus:outline-none shrink-0"
              title={isSidebarOpen ? "साईडबार बंद करा (Close Sidebar)" : "साईडबार उघडा (Open Sidebar)"}
            >
              {isSidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
            </button>
            <div className="flex items-center space-x-1 truncate">
              <span className="text-gray-400 text-xs">👤</span>
              <span className="font-semibold text-primary truncate text-[11px] sm:text-xs">
                {user.username} <span className="hidden sm:inline text-[10px] text-gray-500 font-normal">({user.role})</span>
              </span>
            </div>
            <div className="hidden sm:flex items-center space-x-1">
              <span className="text-gray-400 text-xs">🏢</span>
              {(user.role === 'Admin' || user.role === 'HO_Manager' || user.role === 'HO Manager') && headerBranches.length > 0 ? (
                <select
                  value={user.branchID}
                  onChange={(e) => {
                    const selectedId = parseInt(e.target.value);
                    const b = headerBranches.find((x: any) => x.branchID === selectedId);
                    if (b) {
                      switchBranch(b.branchID, b.branchName);
                    }
                  }}
                  className="text-[11px] font-bold text-primary border border-gray-300 rounded px-1.5 py-0 outline-none focus:border-primary cursor-pointer bg-blue-50/50 hover:bg-blue-100/50 transition-colors h-6"
                >
                  {headerBranches.map((b: any) => (
                    <option key={b.branchID} value={b.branchID}>
                      {(b.branchType || '').toLowerCase() === 'headoffice' ? '👑 ' : '🏢 '}{b.branchName}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-gray-800 bg-gray-100 px-1.5 py-0 rounded border border-gray-300 text-[11px] flex items-center gap-1 shadow-2xs h-6">
                  <span>🔒</span> {user.branchName || 'Main Branch'}
                </span>
              )}
            </div>
            <div className="hidden md:flex items-center space-x-1 text-[11px]">
              <span className="text-gray-400">📅</span>
              <span>FY: {user.financialYearCode}</span>
            </div>
            <div className="hidden lg:flex items-center space-x-1 text-[11px]">
              <span className="text-gray-400">📆</span>
              <span className="text-green-700 font-bold">{user.businessDate}</span>
            </div>
            <button 
              onClick={() => handleNavigate('system-update')}
              title="सिस्टीम आवृत्ती v2.4.1 (काय नवीन आहे ते पहा)"
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-900 border border-emerald-300 font-mono font-black text-[10px] cursor-pointer shadow-2xs transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>v2.4.1</span>
              <span className="text-[9px] bg-emerald-200 text-emerald-950 px-1 py-0.2 rounded font-sans font-bold">New</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
            <NotificationCenter onNavigate={handleNavigate} branchId={user?.branchID || 1} />
            <div className="hidden md:flex items-center space-x-1">
              <label className="text-[10px] font-bold text-gray-500">Theme:</label>
              <select 
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  window.dispatchEvent(new Event('storage'));
                }}
                className="text-[10px] border border-gray-300 rounded px-1.5 py-0 outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer bg-gray-50 h-5.5"
              >
                <option value="wine-red">Wine Red (वाइन रेड)</option>
                <option value="green">Emerald Green (अमला)</option>
                <option value="blue">Corporate Blue (निळा)</option>
              </select>
            </div>
            <button 
              onClick={logout}
              className="px-2 sm:px-2.5 py-0.5 bg-red-50 text-red-600 rounded text-[11px] font-bold hover:bg-red-100 hover:text-red-700 transition-colors border border-red-200 h-6 flex items-center justify-center shrink-0 gap-1 shadow-2xs"
              title="लॉगआउट (Logout)"
            >
              <LogOut size={13} className="shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <div className="flex-1 w-full overflow-y-auto">
          {/* Quick return to Member 360 Sticky Banner */}
          {activeTab !== 'member-360' && (new URLSearchParams(window.location.search).get('memberId') || lastMemberId) && (
            <div className="bg-primary text-white px-3.5 py-1.5 flex items-center justify-between shadow-xs border-b border-white/20 font-sans shrink-0 sticky top-0 z-30 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                <span className="text-xs font-bold tracking-wide">
                  सभासद ३६०° डॅशबोर्डवरून उघडलेला फॉर्म (Navigated from Member 360°)
                </span>
              </div>
              <button
                onClick={() => {
                  const mId = new URLSearchParams(window.location.search).get('memberId') || lastMemberId;
                  handleNavigate('member-360', mId ? { memberId: mId } : undefined);
                }}
                className="px-3 py-1 bg-white text-primary hover:bg-slate-100 font-extrabold text-xs rounded shadow-xs transition-all flex items-center gap-1.5 cursor-pointer border border-white/30"
              >
                <ArrowLeft size={14} />
                <span>सभासद ३६०° वर परत जा (Back to Member 360°)</span>
              </button>
            </div>
          )}

          {showLoginNotifications && (
            <TodaysTasksDashboard
              onNavigate={handleNavigate}
              showLoginModal={true}
              onCloseLoginModal={() => setShowLoginNotifications(false)}
            />
          )}
          {activeTab === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
          {activeTab === 'todays-tasks' && <TodaysTasksDashboard onNavigate={handleNavigate} showLoginModal={false} />}
          {activeTab === 'member-360' && <Member360Dashboard onNavigate={handleNavigate} />}
          {activeTab === 'committee' && <CommitteeMaster />}
          {activeTab === 'audit-compliance' && <CoOpAuditComplianceMaster />}
        
        {/* Vouchers & Accounting */}
        {activeTab === 'vouchers' && <VoucherDashboard onNavigate={handleNavigate} />}
        {activeTab === 'voucher' && <VoucherMaster />}
        {(activeTab === 'voucher-posting' || activeTab === 'voucher-approval') && <VoucherPosting />}

        {/* Cash Management & Cashier Window */}
        {(activeTab === 'cashier-dashboard' || activeTab === 'cash-management') && <CashierDashboard onNavigate={handleNavigate} />}
        {activeTab === 'cash-allocation' && <CashAllocation onNavigate={handleNavigate} />}
        {activeTab === 'cash-denomination' && <CashDenominationEntry onNavigate={handleNavigate} />}
        
        {/* Customer & Member Module */}
        {activeTab === 'customers' && <CustomerMaster />}
        {activeTab === 'customer-opening' && <CustomerOpeningBalance />}
        {activeTab === 'shares' && <SharesDashboard onNavigate={handleNavigate} />}
        {activeTab === 'members' && <MemberMaster onNavigate={handleNavigate} />}
        {activeTab === 'member-opening' && <MemberOpeningBalance />}
        {activeTab === 'member-closure' && <MemberClosure />}
        {activeTab === 'share-master' && <ShareMaster initialMemberId={lastMemberId} onNavigate={handleNavigate} />}
        {activeTab === 'share-transfer' && <ShareTransferMaster />}
        {activeTab === 'share-withdrawal' && <ShareWithdrawal />}

        {/* Loan */}
        {activeTab === 'loan' && <LoanDashboard onNavigate={handleNavigate} />}
        {activeTab === 'loan-process' && <LoanProcessMaster />}
        {activeTab === 'gold-loan-details' && <GoldLoanDetails />}
        {activeTab === 'employee-bank' && <EmployeeBankDetails onNavigate={handleNavigate} />}
        {activeTab === 'employer-master' && <EmployerMaster />}
        {activeTab === 'loan-collection' && <LoanCollectionMaster />}
        {activeTab === 'loan-interest-posting' && <LoanInterestPostingMaster />}
        {activeTab === 'loan-documents' && <LoanDocumentsUpload />}

        {/* Day End / EOD Module Screens */}
        {(activeTab === 'day-end' || activeTab === 'eod-dashboard') && <DayEndDashboard />}

        {/* NPA Module Screens */}
        {activeTab === 'npa-dashboard' && <NpaDashboard onNavigate={handleNavigate} />}
        {activeTab === 'npa-config' && <NpaConfigMaster onBack={() => handleNavigate('npa-dashboard')} />}
        {activeTab === 'npa-statement' && <NpaStatementReport onBack={() => handleNavigate('npa-dashboard')} />}
        {activeTab === 'collateral-compliance' && <CollateralComplianceTracker onBack={() => handleNavigate('npa-dashboard')} />}
        {activeTab === 'npa-defaulters' && <NpaDefaultersList onBack={() => handleNavigate('npa-dashboard')} />}
        
        {/* Saving Module */}
        {activeTab === 'saving' && <SavingDashboard onNavigate={handleNavigate} />}
        {activeTab === 'saving-account' && <SavingAccountMaster />}
        {activeTab === 'saving-transaction' && <SavingTransactionEntry />}
        {activeTab === 'saving-setting' && <SavingInterestSettingMaster />}
        {activeTab === 'saving-posting' && <SavingInterestPostingMaster />}
        {activeTab === 'saving-closing' && <SavingAccountClosingMaster />}
        {activeTab === 'saving-passbook' && <SavingPassbookMaster />}

        {/* Fixed Deposit Module */}
        {activeTab === 'fd' && <FdRdDashboard onNavigate={handleNavigate} />}
        {activeTab === 'fd-scheme' && <SettingsDashboard defaultCategory="schemes" defaultSub="fd-scheme-sub" />}
        {activeTab === 'fd-migrate' && <SettingsDashboard defaultCategory="opening-balance" defaultSub="fd-ob" />}
        {activeTab === 'fd-account' && <FdAccountOpening />}
        {activeTab === 'fd-withdrawal' && <FdWithdrawalMaturity />}
        {activeTab === 'fd-accrual' && <FdAccrualPosting />}
        {activeTab === 'fd-reports' && <FdReports onNavigate={handleNavigate} />}

        {/* Pigmy Deposit Module */}
        {activeTab === 'pigmy' && <PigmyDashboard onNavigate={handleNavigate} />}
        {activeTab === 'pigmy-scheme' && <PigmySchemeMaster />}
        {activeTab === 'pigmy-agent' && <PigmyAgentMaster />}
        {activeTab === 'pigmy-account' && <PigmyAccountOpening />}
        {(activeTab === 'pigmy-collection' || activeTab === 'pigmy-collect') && <PigmyCollectionMaster />}
        {activeTab === 'pigmy-daybook' && <AgentDayBookMaster />}
        {activeTab === 'pigmy-commission' && <AgentCommissionMaster />}
        {activeTab === 'pigmy-interest' && <PigmyInterestPosting />}
        {activeTab === 'pigmy-closure' && <PigmyClosureMaster />}
        {activeTab.startsWith('pigmy-reports') && <PigmyReports />}

        {/* Recurring Deposit Module */}
        {(activeTab === 'rd' || activeTab === 'rd-dashboard') && <RdDashboard onNavigate={handleNavigate} />}
        {activeTab === 'rd-scheme' && <SettingsDashboard defaultCategory="schemes" defaultSub="rd-scheme-sub" />}
        {activeTab === 'rd-migrate' && <RdOpeningBalanceMigration />}
        {activeTab === 'rd-account' && <RdAccountOpening />}
        {(activeTab === 'rd-collect' || activeTab === 'rd-collection') && <RdInstallmentCollection />}
        {activeTab === 'rd-withdrawal' && <RdWithdrawalMaturity />}
        {activeTab === 'rd-accrual' && <RdAccrualPosting />}
        {activeTab === 'rd-reports' && <RdReports />}

        {/* Investment Module */}
        {(activeTab === 'investment' || activeTab === 'inv-institution') && <InvestmentInstitutionMaster />}
        {activeTab === 'inv-scheme' && <SettingsDashboard defaultCategory="schemes" defaultSub="inv-scheme-sub" />}
        {activeTab === 'inv-account' && <InvestmentAccountOpening />}
        {activeTab === 'inv-claim' && <InvestmentMaturityClaim />}
        {activeTab === 'inv-accrual' && <InvestmentInterestAccrualPosting />}
        {activeTab === 'inv-reports' && <InvestmentReports />}

        {/* Asset Management Module */}
        {(activeTab === 'assets' || activeTab === 'asset-category') && <AssetCategoryMaster />}
        {activeTab === 'asset-master' && <AssetMaster />}
        {activeTab === 'asset-purchase' && <AssetPurchaseForm />}
        {activeTab === 'asset-reports' && <AssetReports />}
        
        {/* Locker Management Module Views */}
        {(activeTab === 'locker' || activeTab === 'locker-dashboard') && <LockerDashboard onNavigate={handleNavigate} />}
        {activeTab === 'locker-types' && <LockerTypeMaster />}
        {activeTab === 'locker-master' && <LockerMaster onNavigateToAllotment={(lid) => handleNavigate('locker-allotment', { lockerId: lid })} />}
        {activeTab === 'locker-allotment' && <LockerAllotmentMaster initialLockerId={Number(new URLSearchParams(window.location.search).get('lockerId')) || undefined} />}
        {activeTab === 'locker-visit-register' && <LockerVisitRegister />}
        {activeTab === 'locker-rent-renewal' && <LockerRentRenewal />}
        {activeTab === 'locker-surrender' && <LockerSurrenderMaster />}
        {activeTab === 'locker-reports' && <LockerReports />}

        {/* Legal Recovery (Sec 101 / 91) Module */}
        {(activeTab === 'legal-recovery' || activeTab.startsWith('sec101-')) && <LegalRecoveryDashboard />}

        {/* Reports */}
        {activeTab === 'reports' && <ReportDashboard setActiveTab={handleNavigate} />}
        {activeTab === 'trial-balance' && <TrialBalance />}
        {activeTab === 'trial-balance-namuna-n' && <TrialBalanceNamunaN />}
        {activeTab === 'cash-book' && <CashBookReport />}
        {activeTab === 'daybook' && <Daybook />}
        {activeTab === 'daybook-summary' && <DaybookSummary />}
        {activeTab === 'profit-loss' && <ProfitAndLoss />}
        {activeTab === 'balance-sheet' && <BalanceSheet />}
        {activeTab === 'balance-sheet-form-n' && <BalanceSheetFormN />}
        {activeTab === 'general-ledger' && <GeneralLedger />}
        {activeTab === 'voucher-batch-print' && <VoucherBatchPrint />}
        {activeTab === 'member-balance-report' && <MemberBalanceReport />}
        {activeTab === 'share-certificate-report' && <ShareCertificateReport />}
        {activeTab === 'loan-disbursement-register' && <LoanDisbursementRegister />}
        {activeTab === 'loan-collection-register' && <LoanCollectionRegister />}
        {activeTab === 'loan-ledger-report' && <LoanLedgerReport />}
        {activeTab === 'loan-overdue-report' && <LoanOverdueReport />}
        {activeTab === 'loan-recovery-notice-report' && <LoanRecoveryNoticeReport />}
        {activeTab === 'interest-waiver-register' && <InterestWaiverRegister />}
        {activeTab === 'guarantor-loan-report' && <GuarantorReport />}
        {activeTab === 'member-list-report' && <MemberListReport />}
        {activeTab === 'aadhaar-list' && <AadhaarCardYadiReport />}
        {activeTab === 'sabhasad-labhansh-report' && <SabhasadLabhanshReport />}
        {activeTab === 'shares-khatavani-report' && <SharesKhatavaniReport />}
        {activeTab === 'cbs-sample-report' && <CbsSampleReport />}
        {activeTab === 'i-namuna-report' && <INamunaReport />}
        {activeTab === 'voter-list-report' && <VoterListReport />}
        {activeTab === 'saving-account-list-report' && <SavingAccountListReport />}
        {activeTab === 'saving-khatavani-report' && <SavingKhatavaniReport />}
        {activeTab === 'npa-register' && <NpaRegister />}
        {activeTab === 'gold-jewelry-report' && <GoldJewelryReport />}
        {activeTab === 'loan-rate' && <LoanRateMaster isReportOnly={true} />}
        {activeTab === 'audit-logs' && <AuditLogReport />}

        {/* Utilities */}
        {activeTab === 'interest-calculator' && <InterestCalculator />}

        {/* Settings */}
        {activeTab === 'settings' && <SettingsDashboard />}
        {activeTab === 'system-update' && <SettingsDashboard defaultCategory="admin" defaultSub="system-update" />}
        {activeTab === 'users' && <UserMaster />}

        </div>
      </main>
    </div>
  );
}

export default App;

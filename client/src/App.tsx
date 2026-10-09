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
  FileText,
  Settings, 
  UserCog,
  KeyRound,
  FileCheck,
  Gavel,
  LogOut
} from 'lucide-react';
import FinancialYearMaster from './components/FinancialYearMaster';
import CustomerMaster from './components/CustomerMaster';
import CustomerBulkEntry from './components/CustomerBulkEntry';
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
import Sidebar from './components/Sidebar';
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
import LoanOutstandingReport from './components/LoanOutstandingReport';
import LoanOverdueReport from './components/LoanOverdueReport';
import LoanRecoveryNoticeReport from './components/LoanRecoveryNoticeReport';
import GuarantorReport from './components/GuarantorReport';
import CustomerListReport from './components/CustomerListReport';
import CustomerOpeningBalanceReport from './components/CustomerOpeningBalanceReport';
import MemberListReport from './components/MemberListReport';
import AadhaarCardYadiReport from './components/AadhaarCardYadiReport';
import SabhasadLabhanshReport from './components/SabhasadLabhanshReport';
import SharesKhatavaniReport from './components/SharesKhatavaniReport';
import CbsSampleReport from './components/CbsSampleReport';
import SavingKhatavaniReport from './components/SavingKhatavaniReport';
import FdCustomerSummaryReport from './components/FdCustomerSummaryReport';
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
  const [systemVersion, setSystemVersion] = useState<string>('2.5.32');

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data?.version) {
            setSystemVersion(data.version);
            return;
          }
        }
      } catch {}

      try {
        const res = await fetch('/api/SystemUpdate/current-version');
        if (res.ok) {
          const data = await res.json();
          if (data?.currentVersion) {
            setSystemVersion(data.currentVersion);
          }
        }
      } catch {}
    };

    fetchVersion();
  }, []);

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
    'customer-opening': '/settings?category=opening-balance&sub=customer-ob',
    'customer-ob': '/settings?category=opening-balance&sub=customer-ob',
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
    'fd-customer-summary': '/fd/customer-summary',

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
    'draft-daybook': '/reports/draft-daybook',
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
    'customer-list-report': '/reports/customer-list',
    'customer-opening-balance-report': '/reports/customer-opening-balance',
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
      {/* Glassmorphic Sidebar */}
      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        activeTab={activeTab}
        handleNavigate={handleNavigate}
        user={user}
        logout={logout}
      />
      
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
              title={`सिस्टीम आवृत्ती v${systemVersion} (काय नवीन आहे ते पहा)`}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-900 border border-emerald-300 font-mono font-black text-[10px] cursor-pointer shadow-2xs transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>v{systemVersion}</span>
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
        {(activeTab === 'voucher-posting' || activeTab === 'voucher-approval') && <VoucherPosting onNavigate={handleNavigate} />}

        {/* Cash Management & Cashier Window */}
        {(activeTab === 'cashier-dashboard' || activeTab === 'cash-management') && <CashierDashboard onNavigate={handleNavigate} />}
        {activeTab === 'cash-allocation' && <CashAllocation onNavigate={handleNavigate} />}
        {activeTab === 'cash-denomination' && <CashDenominationEntry onNavigate={handleNavigate} />}
        
        {/* Customer & Member Module */}
        {activeTab === 'customers' && <CustomerMaster onNavigate={handleNavigate} />}
        {activeTab === 'customer-bulk' && <CustomerBulkEntry onBack={() => handleNavigate('customers')} onNavigateToCustomers={() => handleNavigate('customers')} />}
        {(activeTab === 'customer-opening' || activeTab === 'customer-ob') && <SettingsDashboard defaultCategory="opening-balance" defaultSub="customer-ob" />}
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
        {(activeTab === 'loan-ob' || activeTab === 'loan-opening') && <SettingsDashboard defaultCategory="opening-balance" defaultSub="loan-ob" />}

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
        {activeTab === 'fd-customer-summary' && <FdCustomerSummaryReport onNavigate={handleNavigate} />}

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
        {activeTab === 'draft-daybook' && <Daybook initialVoucherStatus="pending" />}
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
        {activeTab === 'loan-outstanding-report' && <LoanOutstandingReport />}
        {activeTab === 'loan-overdue-report' && <LoanOverdueReport />}
        {activeTab === 'loan-recovery-notice-report' && <LoanRecoveryNoticeReport />}
        {activeTab === 'interest-waiver-register' && <InterestWaiverRegister />}
        {activeTab === 'guarantor-loan-report' && <GuarantorReport />}
        {activeTab === 'customer-list-report' && <CustomerListReport />}
        {activeTab === 'customer-opening-balance-report' && <CustomerOpeningBalanceReport />}
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

import React, { useState } from 'react';
import SansthaMaster from './SansthaMaster';
import FinancialYearMaster from './FinancialYearMaster';
import VoucherMappingMaster from './VoucherMappingMaster';
import LoanRateMaster from './LoanRateMaster';
import SavingInterestSettingMaster from './SavingInterestSettingMaster';
import AccountGroupMaster from './AccountGroupMaster';
import LedgerMaster from './LedgerMaster';
import BranchMaster from './BranchMaster';
import DepartmentMaster from './DepartmentMaster';
import CompanyBranchMaster from './CompanyBranchMaster';
import SecurityTypeMaster from './SecurityTypeMaster';
import SavingOpeningBalance from './SavingOpeningBalance';
import FdOpeningBalanceMigration from './FdOpeningBalanceMigration';
import FdSchemeMaster from './FdSchemeMaster';
import RdOpeningBalanceMigration from './RdOpeningBalanceMigration';
import RdSchemeMaster from './RdSchemeMaster';
import PigmyOpeningBalance from './PigmyOpeningBalance';
import PigmySchemeMaster from './PigmySchemeMaster';
import InvestmentOpeningBalance from './InvestmentOpeningBalance';
import InvestmentSchemeMaster from './InvestmentSchemeMaster';
import ShareSchemeMaster from './ShareSchemeMaster';
import LoanOpeningBalanceMaster from './LoanOpeningBalanceMaster';
import ShareOpeningBalance from './ShareOpeningBalance';
import ShareOpeningBalanceBulk from './ShareOpeningBalanceBulk';
import LedgerOpeningBalance from './LedgerOpeningBalance';
import DataImportMaster from './DataImportMaster';
import CommitteeMaster from './CommitteeMaster';
import YearEndClosure from './YearEndClosure';
import DatabaseBackup from './DatabaseBackup';
import ThemeSettingsMaster from './ThemeSettingsMaster';
import LicenseMaster from './LicenseMaster';
import SystemUpdateMaster from './SystemUpdateMaster';
import CashSchemeSettingMaster from './CashSchemeSettingMaster';
import InvestmentInstitutionMaster from './InvestmentInstitutionMaster';

interface SettingsDashboardProps {
  defaultCategory?: string;
  defaultSub?: string;
}

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({ defaultCategory, defaultSub }) => {
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return defaultCategory || params.get('category') || 'general';
  });
  const [activeSubTab, setActiveSubTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return defaultSub || params.get('sub') || 'sanstha';
  });

  // Streamlined 5 Core Categories
  const tabs = [
    { id: 'general', label: 'सर्वसाधारण (General)', icon: '⚙️' },
    { id: 'schemes', label: 'योजना मास्टर (Schemes)', icon: '🏛️' },
    { id: 'opening-balance', label: 'सुरुवातीची शिल्लक (Opening Balances)', icon: '⚖️' },
    { id: 'accounts-import', label: 'खाते व डेटा (Accounts & Import)', icon: '📊' },
    { id: 'admin', label: 'प्रशासन (Admin & Backup)', icon: '🛡️' }
  ];

  const subTabs: Record<string, { id: string; label: string; icon?: string }[]> = {
    'general': [
      { id: 'sanstha', label: 'संस्था माहिती (Sanstha Profile)', icon: '🏛️' },
      { id: 'theme-settings', label: 'थीम व डिझाईन (Theme & Colors)', icon: '🎨' },
      { id: 'branch', label: 'शाखा माहिती (Branch Master)', icon: '🏢' },
      { id: 'department', label: 'विभाग माहिती (Department Master)', icon: '📁' },
      { id: 'company-branch', label: 'कंपनी शाखा (Company Branch)', icon: '🏬' },
      { id: 'financial-year', label: 'आर्थिक वर्ष (Financial Year)', icon: '📅' },
      { id: 'committee', label: 'पंच कमिटी (Committee Master)', icon: '👥' }
    ],
    'schemes': [
      { id: 'cash-scheme-sub', label: 'कॅश व काउंटर योजना (Cash Scheme Setting)', icon: '💵' },
      { id: 'share-scheme-sub', label: 'भाग भांडवल व सभासद योजना (Share & Member Scheme)', icon: '🤝' },
      { id: 'fd-scheme-sub', label: 'मुदत ठेव योजना (FD Scheme)', icon: '🏛️' },
      { id: 'rd-scheme-sub', label: 'आवर्ती ठेव योजना (RD Scheme)', icon: '💳' },
      { id: 'pigmy-scheme-sub', label: 'पिग्मी ठेव योजना (Pigmy Scheme)', icon: '🐖' },
      { id: 'inv-institution-sub', label: 'गुंतवणूक संस्था (Investment Institution)', icon: '🏛️' },
      { id: 'inv-scheme-sub', label: 'गुंतवणूक योजना (Investment Scheme)', icon: '💼' },
      { id: 'saving-setting', label: 'बचत व्याजदर (Saving Interest)', icon: '💰' },
      { id: 'loan-rate', label: 'कर्ज दर पत्रक (Loan Interest Rate)', icon: '📉' },
      { id: 'security-type', label: 'तारण प्रकार (Security Types)', icon: '🛡️' }
    ],
    'opening-balance': [
      { id: 'saving-ob', label: 'बचत खाते शिल्लक (Saving OB)', icon: '💰' },
      { id: 'fd-ob', label: 'मुदत ठेव सुरुवातीची शिल्लक स्थलांतर (FD Opening Balance)', icon: '🏛️' },
      { id: 'rd-ob', label: 'आवर्ती ठेव शिल्लक (RD OB)', icon: '💳' },
      { id: 'pigmy-ob', label: 'पिग्मी शिल्लक (Pigmy OB)', icon: '🐖' },
      { id: 'inv-ob', label: 'गुंतवणूक शिल्लक (Investment OB)', icon: '📊' },
      { id: 'loan-ob', label: 'कर्ज बाकी शिल्लक (Loan OB)', icon: '📉' },
      { id: 'share-ob', label: 'शेअर शिल्लक (Share OB)', icon: '🤝' },
      { id: 'share-bulk-ob', label: 'शेअर बल्क ग्रिड (Share Bulk Grid)', icon: '📊' },
      { id: 'cash-ob', label: 'रोख शिल्लक (Cash OB)', icon: '💵' },
      { id: 'bank-ob', label: 'बँक शिल्लक (Bank OB)', icon: '🏦' },
      { id: 'ledger-ob', label: 'इतर खाते शिल्लक (Ledger OB)', icon: '📖' },
      { id: 'deadstock-ob', label: 'डेडस्टॉक शिल्लक (Deadstock OB)', icon: '📦' }
    ],
    'accounts-import': [
      { id: 'account-group', label: 'खाते गट (Account Groups)', icon: '📁' },
      { id: 'ledger', label: 'खाते माहिती (Ledger Master)', icon: '📖' },
      { id: 'mapping', label: 'व्हाउचर मॅपिंग (Voucher Mapping)', icon: '📑' },
      { id: 'data-import', label: 'एक्सेल इम्पोर्ट (Excel Data Import)', icon: '📊' }
    ],
    'admin': [
      { id: 'system-update', label: 'सिस्टीम अपडेट व आवृत्ती (System Update)', icon: '🚀' },
      { id: 'year-end', label: 'आर्थिक वर्ष बंद (Year End Closure)', icon: '🔒' },
      { id: 'backup', label: 'डेटाबेस बॅकअप (Database Backup)', icon: '💾' },
      { id: 'license', label: 'लायसन्स व नोंदणी (License & Machine)', icon: '🔑' }
    ]
  };

  const renderComponent = () => {
    switch (activeSubTab) {
      case 'system-update': return <SystemUpdateMaster />;
      case 'sanstha': return <SansthaMaster />;
      case 'theme-settings-sub':
      case 'theme-settings': return <ThemeSettingsMaster />;
      case 'branch': return <BranchMaster />;
      case 'department': return <DepartmentMaster />;
      case 'company-branch': return <CompanyBranchMaster />;
      case 'financial-year': return <FinancialYearMaster />;
      case 'committee': return <CommitteeMaster />;
      case 'cash-scheme-sub':
      case 'cash-scheme': return <CashSchemeSettingMaster />;
      case 'share-scheme-sub':
      case 'share-scheme': return <ShareSchemeMaster />;
      case 'fd-scheme-sub':
      case 'fd-scheme': return <FdSchemeMaster />;
      case 'rd-scheme-sub':
      case 'rd-scheme': return <RdSchemeMaster />;
      case 'pigmy-scheme-sub':
      case 'pigmy-scheme': return <PigmySchemeMaster />;
      case 'inv-institution-sub':
      case 'inv-institution': return <InvestmentInstitutionMaster />;
      case 'inv-scheme-sub':
      case 'inv-scheme': return <InvestmentSchemeMaster />;
      case 'saving-setting': return <SavingInterestSettingMaster />;
      case 'loan-rate': return <LoanRateMaster />;
      case 'security-type': return <SecurityTypeMaster />;
      case 'saving-ob': return <SavingOpeningBalance />;
      case 'fd-migrate':
      case 'fd-ob': return <FdOpeningBalanceMigration />;
      case 'rd-ob': return <RdOpeningBalanceMigration />;
      case 'pigmy-ob': return <PigmyOpeningBalance />;
      case 'inv-ob': return <InvestmentOpeningBalance />;
      case 'loan-ob': return <LoanOpeningBalanceMaster />;
      case 'share-ob': return <ShareOpeningBalance />;
      case 'share-bulk-ob': return <ShareOpeningBalanceBulk onSwitchToSingle={() => setActiveSubTab('share-ob')} />;
      case 'cash-ob': return <LedgerOpeningBalance defaultFilter="Cash" />;
      case 'bank-ob': return <LedgerOpeningBalance defaultFilter="Bank" />;
      case 'ledger-ob': return <LedgerOpeningBalance defaultFilter="All" />;
      case 'deadstock-ob': return <LedgerOpeningBalance defaultFilter="Deadstock" />;
      case 'account-group': return <AccountGroupMaster />;
      case 'ledger': return <LedgerMaster />;
      case 'mapping': return <VoucherMappingMaster />;
      case 'data-import': return <DataImportMaster />;
      case 'year-end': return <YearEndClosure />;
      case 'backup': return <DatabaseBackup />;
      case 'license': return <LicenseMaster />;
      default: return <div className="p-4 text-xs text-gray-500">माहिती लोड होत आहे...</div>;
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setActiveSubTab(subTabs[tabId][0].id);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-75px)] bg-gray-50 p-2 text-[11px] font-sans">
      {/* Top Main Categories Navigation */}
      <div className="bg-white p-1.5 rounded-sm shadow-sm border border-gray-200 mb-2 flex space-x-1 flex-shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all flex items-center shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-xs'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <span className="mr-1.5 text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Workspace Layout */}
      <div className="flex flex-col md:flex-row flex-1 gap-2">
        {/* Left Submenu Navigation Sidebar */}
        <div className="w-full md:w-52 bg-white border border-gray-200 rounded-sm shadow-2xs flex-shrink-0 flex flex-col p-1.5 overflow-y-auto">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1 border-b border-gray-100 mb-1">
            सेटिंग्ज प्रकार (Category)
          </div>
          {subTabs[activeTab]?.map(subTab => (
            <button
              key={subTab.id}
              onClick={() => setActiveSubTab(subTab.id)}
              className={`w-full text-left px-2.5 py-1.5 text-[11px] font-semibold rounded-sm mb-0.5 transition-all flex items-center cursor-pointer ${
                activeSubTab === subTab.id
                  ? 'bg-blue-50/90 text-primary border-l-3 border-primary shadow-2xs font-bold'
                  : 'text-gray-700 hover:bg-gray-100/80 hover:text-gray-900'
              }`}
            >
              <span className="mr-2 text-xs">{subTab.icon || '›'}</span>
              <span className="truncate">{subTab.label}</span>
            </button>
          ))}
        </div>

        {/* Component Content Area */}
        <div className="flex-1 bg-white border border-gray-200 rounded-sm shadow-sm overflow-y-auto p-2 min-h-[550px]">
          {renderComponent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsDashboard;

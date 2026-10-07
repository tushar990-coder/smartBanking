import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import FdAccrualPosting from './FdAccrualPosting';
import CbsReportLayout, { formatDisplayDate, CbsPaperSize, CbsSignatureTier } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  Building2,
  Calendar,
  Users,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FdAccountReportRow {
  fdAccountID: number;
  branchID?: number;
  branchName: string;
  customerID?: number;
  cifNo?: string;
  customerName?: string;
  memberCode: string;
  memberName: string;
  memberID?: number;
  accountNo: string;
  legacyAccountNumber?: string;
  fdSchemeID?: number;
  schemeCode?: string;
  schemeName: string;
  openingDate: string;
  durationType?: string;
  durationValue?: number;
  durationInDays?: number;
  depositAmount: number;
  interestRate: number;
  maturityDate: string;
  maturityAmount?: number;
  legacyAccruedInt?: number;
  postedInterest?: number;
  isInterestCapitalized?: boolean;
  totalOutstandingWithInterest?: number;
  lastInterestPostingDate?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  remarks?: string;
  status: string;
}

interface FdVoucherPassingRow {
  voucherID: number;
  voucherNo: string;
  voucherDate: string;
  branchName: string;
  accountNo: string;
  customerName: string;
  customerCode: string;
  transactionType: string;
  typeBadge: string;
  voucherType: string;
  totalAmount: number;
  status: string;
  scrollNo?: number;
  narration: string;
  createdBy: string;
  approvedBy: string;
  approvedOn: string;
}

interface FdDeletedEntryRow {
  logID: number;
  deletedDate: string;
  accountNo: string;
  voucherNo: string;
  deleteType: string;
  typeBadge: string;
  amount: number;
  deletedBy: string;
  rollbackInfo: string;
  reasonOrDetails: string;
}

interface CustomerLedgerData {
  customerID: number;
  cifNo: string;
  customerName: string;
  mobileNo: string;
  address: string;
  branchName: string;
  totalFDAccountsCount: number;
  totalPrincipalInvested: number;
  totalMaturityValue: number;
  accounts: {
    fdAccountID: number;
    accountNo: string;
    legacyAccountNumber?: string;
    openingDate: string;
    maturityDate: string;
    depositAmount: number;
    interestRate: number;
    maturityAmount: number;
    status: string;
    paymentMode: string;
    nomineeName: string;
    nomineeRelation: string;
    remarks: string;
    schemeName: string;
    durationMonths: number;
    totalAccruedInterest: number;
    transactions: {
      fdTransactionID: number;
      transactionDate: string;
      transactionType: string;
      debitCredit: string;
      amount: number;
      voucherNo: string;
      narration: string;
    }[];
  }[];
}

interface FdCustomerSummaryAccountItem {
  fdAccountID: number;
  accountNo: string;
  legacyAccountNumber?: string;
  depositAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityAmount: number;
  status: string;
  schemeName: string;
}

interface FdCustomerSummaryRow {
  srNo: number;
  customerID: number;
  cifNo: string;
  accountNo: string;
  customerName: string;
  mobileNo: string;
  depositAmount: number;
  maturityAmount: number;
  fdCount: number;
  accounts: FdCustomerSummaryAccountItem[];
}

interface FdReportsProps {
  onNavigate?: (tab: string, params?: any) => void;
  onBack?: () => void;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function FdReports({ onNavigate }: FdReportsProps) {
  const { user } = useAuth();

  const [reportType, setReportType] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reportType') || 'Register';
  });

  const [paperSize, setPaperSize] = useState<CbsPaperSize>(() => {
    return reportType === 'MemberLedger' || reportType === 'CustomerSummary' ? 'a4-portrait' : 'a4-landscape';
  });
  const [signatureTier, setSignatureTier] = useState<CbsSignatureTier>('3-tier');

  const [branches, setBranches] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number>(0);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerID, setSelectedCustomerID] = useState<number>(0);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 1;
  const [branchID, setBranchID] = useState<number>(initialBranchId);

  const [data, setData] = useState<FdAccountReportRow[]>([]);
  const [voucherPassingData, setVoucherPassingData] = useState<FdVoucherPassingRow[]>([]);
  const [deletedEntriesData, setDeletedEntriesData] = useState<FdDeletedEntryRow[]>([]);
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [voucherPassingStatus, setVoucherPassingStatus] = useState<string>('ALL');

  const [customerSummaryData, setCustomerSummaryData] = useState<FdCustomerSummaryRow[]>([]);
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<number[]>([]);
  const [summaryViewMode, setSummaryViewMode] = useState<'DualColumn' | 'Detailed'>('DualColumn');

  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleReportTypeChange = (nextType: string) => {
    setReportType(nextType);
    if (nextType === 'MemberLedger' || nextType === 'CustomerSummary') {
      setPaperSize('a4-portrait');
    } else {
      setPaperSize('a4-landscape');
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('reportType', nextType);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      // ignore in environments without full window.location
    }
  };

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const rt = params.get('reportType');
      if (rt && rt !== reportType) {
        setReportType(rt);
        if (rt === 'MemberLedger' || rt === 'CustomerSummary') {
          setPaperSize('a4-portrait');
        } else {
          setPaperSize('a4-landscape');
        }
      }
    };
    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  useEffect(() => {
    fetchBranches();
    fetchSansthaDetail();
    fetchCustomers();
    fetchSchemes();
  }, []);

  const fetchSansthaDetail = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSansthaDetail(res.data[0]);
      } else if (res.data && !Array.isArray(res.data)) {
        setSansthaDetail(res.data);
      }
    } catch (err) {
      console.error('Error fetching sanstha detail', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await axios.get('/api/FdSchemes');
      setSchemes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching schemes', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get('/api/Customers');
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Error fetching customers', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  useEffect(() => {
    if (reportType === 'MemberLedger') {
      if (selectedCustomerID > 0) {
        fetchCustomerLedgerData(selectedCustomerID);
      } else {
        setCustomerLedger(null);
      }
    } else if (reportType !== 'AccrualProvision') {
      fetchReportData();
    }
  }, [reportType, branchID, selectedSchemeId, selectedCustomerID, fromDate, toDate, asOfDate, voucherPassingStatus]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      if (reportType === 'CustomerSummary') {
        const res = await axios.get('/api/Reports/fd-customer-summary', {
          params: {
            branchID: branchID > 0 ? branchID : undefined,
            asOfDate: asOfDate || undefined
          }
        });
        setCustomerSummaryData(res.data?.data || []);
      } else if (reportType === 'VoucherPassing') {
        const res = await axios.get('/api/Reports/fd-voucher-passing', {
          params: {
            branchId: branchID > 0 ? branchID : undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            status: voucherPassingStatus !== 'ALL' ? voucherPassingStatus : undefined
          }
        });
        setVoucherPassingData(res.data || []);
      } else if (reportType === 'DeletedEntries') {
        const res = await axios.get('/api/Reports/fd-deleted-entries', {
          params: {
            branchId: branchID > 0 ? branchID : undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined
          }
        });
        setDeletedEntriesData(res.data || []);
      } else {
        let endpoint = '/api/Reports/fd-register';
        if (reportType === 'Outstanding') endpoint = '/api/Reports/fd-outstanding';
        if (reportType === 'MaturityDue') endpoint = '/api/Reports/fd-maturity-due';
        if (reportType === 'MigratedFD') endpoint = '/api/Reports/fd-migrated';

        const res = await axios.get(endpoint, {
          params: { 
            branchID: branchID > 0 ? branchID : undefined,
            fdSchemeID: selectedSchemeId > 0 ? selectedSchemeId : undefined,
            fromDate: (reportType === 'MaturityDue' || reportType === 'Register') ? fromDate : undefined,
            toDate: (reportType === 'MaturityDue' || reportType === 'Register') ? toDate : undefined
          }
        });
        setData(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching FD report data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerLedgerData = async (customerId: number) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/Reports/fd-member-ledger/${customerId}`);
      const d = res.data;
      if (d) {
        setCustomerLedger({
          customerID: d.customerID || d.memberID || customerId,
          cifNo: d.cifNo || d.memberCode || '',
          customerName: d.customerName || d.memberName || '',
          mobileNo: d.mobileNo || '',
          address: d.address || '',
          branchName: d.branchName || '',
          totalFDAccountsCount: d.totalFDAccountsCount || 0,
          totalPrincipalInvested: d.totalPrincipalInvested || 0,
          totalMaturityValue: d.totalMaturityValue || 0,
          accounts: d.accounts || []
        });
      } else {
        setCustomerLedger(null);
      }
    } catch (err) {
      console.error('Error fetching FD customer ledger', err);
      setCustomerLedger(null);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data
    .filter((row) => {
      if (selectedSchemeId > 0 && row.fdSchemeID && row.fdSchemeID !== selectedSchemeId) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        (row.accountNo && row.accountNo.toLowerCase().includes(term)) ||
        (row.legacyAccountNumber && row.legacyAccountNumber.toLowerCase().includes(term)) ||
        (row.memberName && row.memberName.toLowerCase().includes(term)) ||
        (row.customerName && row.customerName.toLowerCase().includes(term)) ||
        (row.cifNo && row.cifNo.toLowerCase().includes(term)) ||
        (row.memberCode && row.memberCode.toLowerCase().includes(term)) ||
        (row.schemeName && row.schemeName.toLowerCase().includes(term)) ||
        (row.nomineeName && row.nomineeName.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => (a.accountNo || '').localeCompare(b.accountNo || '') || (a.fdAccountID - b.fdAccountID));

  const filteredVoucherPassing = voucherPassingData.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (r.voucherNo && r.voucherNo.toLowerCase().includes(term)) ||
      (r.accountNo && r.accountNo.toLowerCase().includes(term)) ||
      (r.customerName && r.customerName.toLowerCase().includes(term)) ||
      (r.customerCode && r.customerCode.toLowerCase().includes(term)) ||
      (r.transactionType && r.transactionType.toLowerCase().includes(term)) ||
      (r.scrollNo && r.scrollNo.toString().includes(term))
    );
  });

  const filteredDeletedEntries = deletedEntriesData.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (r.accountNo && r.accountNo.toLowerCase().includes(term)) ||
      (r.voucherNo && r.voucherNo.toLowerCase().includes(term)) ||
      (r.deleteType && r.deleteType.toLowerCase().includes(term)) ||
      (r.deletedBy && r.deletedBy.toLowerCase().includes(term)) ||
      (r.reasonOrDetails && r.reasonOrDetails.toLowerCase().includes(term))
    );
  });

  const totalDepositSum = filteredData.reduce((s, r) => s + (r.depositAmount || 0), 0);
  const totalOutstandingWithInterestSum = filteredData.reduce((s, r) => s + (r.totalOutstandingWithInterest ?? r.depositAmount ?? 0), 0);
  const totalPostedInterestSum = filteredData.reduce((s, r) => s + (r.postedInterest || 0), 0);
  const totalMaturitySum = filteredData.reduce((s, r) => s + (r.maturityAmount || 0), 0);
  const totalLegacyAccruedSum = filteredData.reduce((s, r) => s + (r.legacyAccruedInt || 0), 0);
  const totalVoucherPassingSum = filteredVoucherPassing.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const totalDeletedSum = filteredDeletedEntries.reduce((s, r) => s + (r.amount || 0), 0);

  const filteredCustomerSummary = customerSummaryData.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (row.cifNo && row.cifNo.toLowerCase().includes(term)) ||
      (row.accountNo && row.accountNo.toLowerCase().includes(term)) ||
      (row.customerName && row.customerName.toLowerCase().includes(term)) ||
      (row.mobileNo && row.mobileNo.toLowerCase().includes(term))
    );
  });

  const totalCustomerSummaryDeposit = filteredCustomerSummary.reduce((s, r) => s + (r.depositAmount || 0), 0);
  const totalCustomerSummaryMaturity = filteredCustomerSummary.reduce((s, r) => s + (r.maturityAmount || 0), 0);
  const totalCustomerSummaryFdCount = filteredCustomerSummary.reduce((s, r) => s + (r.fdCount || 0), 0);

  const getReportTitle = () => {
    switch (reportType) {
      case 'CustomerSummary': return 'मुदतबंद ठेव यादी (ग्राहक-निहाय एकत्रित ठेवी)';
      case 'Register': return 'मुदत ठेव नोंदवही';
      case 'Outstanding': return 'मुदत ठेव बाकी अहवाल';
      case 'MaturityDue': return 'मुदतपूर्ती देय अहवाल';
      case 'MemberLedger': return 'मुदत ठेव खातावणी विवरणपत्र';
      case 'VoucherPassing': return 'मुदत ठेव व्हाउचर पासिंग अहवाल';
      case 'DeletedEntries': return 'मुदत ठेव थेट रद्द नोंदी व रोलबॅक अहवाल';
      case 'MigratedFD': return 'स्थलांतरित मुदत ठेव (FD) यादी अहवाल';
      default: return 'मुदत ठेव अहवाल';
    }
  };

  const getReportSubtitle = () => {
    switch (reportType) {
      case 'CustomerSummary': return 'Customer-wise Fixed Deposit Summary';
      case 'Register': return 'Fixed Deposit Register';
      case 'Outstanding': return 'Fixed Deposit Outstanding Report';
      case 'MaturityDue': return 'Fixed Deposit Maturity Due Report';
      case 'MemberLedger': return 'Customer-wise Fixed Deposit Account Ledger';
      case 'VoucherPassing': return 'Fixed Deposit Voucher Passing Report';
      case 'DeletedEntries': return 'Fixed Deposit Deleted Entries & Rollback Audit';
      case 'MigratedFD': return 'Migrated Fixed Deposit Accounts Report';
      default: return 'Fixed Deposit Report';
    }
  };

  const getPeriodText = () => {
    switch (reportType) {
      case 'CustomerSummary':
        return `दि. ${formatDisplayDate(asOfDate)} अखेर`;
      case 'Outstanding':
        return `दि. ${formatDisplayDate(toDate)} अखेर (चालू बाकी स्थिती)`;
      case 'Register':
      case 'MaturityDue':
      case 'VoucherPassing':
      case 'DeletedEntries':
        return `दि. ${formatDisplayDate(fromDate)} ते दि. ${formatDisplayDate(toDate)}`;
      case 'MigratedFD':
        return 'स्थलांतरित मुदत ठेव खाती यादी (आरंभिक शिल्लक)';
      case 'MemberLedger':
        return customerLedger ? `ग्राहक: ${customerLedger.customerName} (${customerLedger.cifNo || '-'})` : 'कृपया खातेदार निवडा';
      default:
        return `दिनांक: ${formatDisplayDate(new Date().toISOString())}`;
    }
  };

  const selectedBranchObj = branches.find(b => b.branchID === branchID);
  const activeBranchName = branchID > 0
    ? (selectedBranchObj ? selectedBranchObj.branchName : 'शाखा')
    : 'सर्व शाखा (All Branches)';

  const getHasData = () => {
    switch (reportType) {
      case 'CustomerSummary': return filteredCustomerSummary.length > 0;
      case 'VoucherPassing': return filteredVoucherPassing.length > 0;
      case 'DeletedEntries': return filteredDeletedEntries.length > 0;
      case 'MemberLedger': return !!customerLedger;
      default: return filteredData.length > 0;
    }
  };

  const handleExportExcel = () => {
    if (reportType === 'CustomerSummary') {
      if (filteredCustomerSummary.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredCustomerSummary.map((r, i) => ({
        'अ.क्र.': i + 1,
        'खाते / CIF क्र.': r.cifNo || r.accountNo,
        'खातेदाराचे नाव': r.customerName,
        'मोबाईल क्र.': r.mobileNo || '',
        'एकूण ठेवी (पावत्या)': r.fdCount,
        'एकूण ठेव रक्कम (₹)': r.depositAmount || 0,
        'मुदतपूर्ती रक्कम (₹)': r.maturityAmount || 0
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'खाते / CIF क्र.': 'एकूण बेरीज (Grand Total):',
        'खातेदाराचे नाव': `एकूण खातेदार: ${filteredCustomerSummary.length}`,
        'मोबाईल क्र.': '',
        'एकूण ठेवी (पावत्या)': totalCustomerSummaryFdCount,
        'एकूण ठेव रक्कम (₹)': totalCustomerSummaryDeposit,
        'मुदतपूर्ती रक्कम (₹)': totalCustomerSummaryMaturity
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FD Customer Summary');
      XLSX.writeFile(wb, `FD_Customer_Summary_${asOfDate}.xlsx`);
      return;
    }

    if (reportType === 'MemberLedger') {
      if (!customerLedger || customerLedger.accounts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows: any[] = [];
      customerLedger.accounts.forEach(acc => {
        acc.transactions.forEach((tx) => {
          rows.push({
            'FD पावती क्र.': acc.accountNo,
            'जुनी पावती क्र.': acc.legacyAccountNumber || '-',
            'योजना': acc.schemeName,
            'ठेव रक्कम (₹)': acc.depositAmount,
            'व्याज दर %': acc.interestRate,
            'मुदत दिनांक': formatDisplayDate(acc.maturityDate),
            'व्यवहार तारीख': formatDisplayDate(tx.transactionDate),
            'व्हाउचर क्र.': tx.voucherNo || '-',
            'तपशील': tx.narration || tx.transactionType,
            'रक्कम (₹)': tx.amount
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FD Member Ledger');
      XLSX.writeFile(wb, `FD_Ledger_${customerLedger.customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'VoucherPassing') {
      if (filteredVoucherPassing.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredVoucherPassing.map((v, i) => ({
        'अ.क्र.': i + 1,
        'व्हाउचर क्र.': v.voucherNo,
        'तारीख': formatDisplayDate(v.voucherDate),
        'व्यवहार प्रकार': v.transactionType,
        'FD पावती क्र.': v.accountNo || '-',
        'खातेदाराचे नाव': v.customerName || '-',
        'रक्कम (₹)': v.totalAmount || 0,
        'स्क्रॉल क्र.': v.scrollNo || '-',
        'स्थिती': v.status === 'Approved' ? 'मंजूर' : (v.status === 'Pending' ? 'प्रलंबित' : v.status),
        'तपशील': v.narration || '-'
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'व्हाउचर क्र.': '',
        'तारीख': '',
        'व्यवहार प्रकार': '',
        'FD पावती क्र.': '',
        'खातेदाराचे नाव': 'एकूण व्हाउचर रक्कम बेरीज:',
        'रक्कम (₹)': totalVoucherPassingSum,
        'स्क्रॉल क्र.': '',
        'स्थिती': '',
        'तपशील': ''
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FD Voucher Passing');
      XLSX.writeFile(wb, `FD_Voucher_Passing_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'DeletedEntries') {
      if (filteredDeletedEntries.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredDeletedEntries.map((d, i) => ({
        'अ.क्र.': i + 1,
        'रद्द दिनांक & वेळ': d.deletedDate,
        'रद्द नोंद प्रकार': d.deleteType,
        'FD पावती क्र.': d.accountNo || '-',
        'व्हाउचर क्र.': d.voucherNo || '-',
        'रक्कम (₹)': d.amount || 0,
        'रद्दकर्ता': d.deletedBy,
        'पावती क्र. रोलबॅक स्थिती': d.rollbackInfo,
        'तपशील व कारण': d.reasonOrDetails
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'रद्द दिनांक & वेळ': '',
        'रद्द नोंद प्रकार': '',
        'FD पावती क्र.': '',
        'व्हाउचर क्र.': 'एकूण रक्कम बेरीज:',
        'रक्कम (₹)': totalDeletedSum,
        'रद्दकर्ता': '',
        'पावती क्र. रोलबॅक स्थिती': '',
        'तपशील व कारण': ''
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'FD Deleted Entries');
      XLSX.writeFile(wb, `FD_Deleted_Entries_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'MigratedFD') {
      if (filteredData.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredData.map((row, i) => ({
        'अ.क्र.': i + 1,
        'नवीन पावती क्र.': row.accountNo,
        'जुनी पावती क्र.': row.legacyAccountNumber || '-',
        'खातेदाराचे नाव': row.customerName || row.memberName,
        'CIF क्र.': row.cifNo || '-',
        'योजना': row.schemeName,
        'ठेव तारीख': formatDisplayDate(row.openingDate),
        'कालावधी': row.durationValue ? `${row.durationValue} ${row.durationType || 'महिने'}` : (row.durationInDays ? `${row.durationInDays} दिवस` : '-'),
        'ठेव मुद्दल (₹)': row.depositAmount || 0,
        'व्याज दर (%)': row.interestRate,
        'मुदतपूर्ती तारीख': formatDisplayDate(row.maturityDate),
        'मुदतपूर्ती रक्कम (₹)': row.maturityAmount || 0,
        'साचलेले जुने व्याज (₹)': row.legacyAccruedInt || 0,
        'शेवटची व्याज तारीख': formatDisplayDate(row.lastInterestPostingDate),
        'वारसदार': row.nomineeName ? `${row.nomineeName} (${row.nomineeRelation || ''})` : '-',
        'शेरा': row.remarks || '-',
        'स्थिती': row.status
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'नवीन पावती क्र.': '',
        'जुनी पावती क्र.': '',
        'खातेदाराचे नाव': 'एकूण बेरीज (Grand Total):',
        'CIF क्र.': '',
        'योजना': '',
        'ठेव तारीख': '',
        'कालावधी': '',
        'ठेव मुद्दल (₹)': totalDepositSum,
        'व्याज दर (%)': 0,
        'मुदतपूर्ती तारीख': '',
        'मुदतपूर्ती रक्कम (₹)': totalMaturitySum,
        'साचलेले जुने व्याज (₹)': totalLegacyAccruedSum,
        'शेवटची व्याज तारीख': '',
        'वारसदार': '',
        'शेरा': '',
        'स्थिती': ''
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Migrated FD Accounts');
      XLSX.writeFile(wb, `Migrated_FD_Accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (filteredData.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const excelRows = filteredData.map((row, i) => {
      const item: any = {
        'अ.क्र.': i + 1,
        'FD पावती / खाते नं.': row.accountNo,
        'ग्राहक क्र. (CIF)': row.cifNo || row.memberCode || '-',
        'खातेदाराचे नाव': row.customerName || row.memberName,
        'योजना': row.schemeName,
        'ठेव तारीख': formatDisplayDate(row.openingDate),
        'मुदत ठेव रक्कम (₹)': row.depositAmount || 0
      };

      if (reportType === 'Outstanding') {
        item['मुद्दल + पोस्ट व्याज (₹)'] = row.totalOutstandingWithInterest ?? row.depositAmount ?? 0;
        item['पोस्ट झालेले व्याज (₹)'] = row.postedInterest || 0;
      }

      item['व्याज दर (%)'] = row.interestRate;
      item['मुदतपूर्ती तारीख'] = formatDisplayDate(row.maturityDate);
      item['मुदतपूर्ती रक्कम (₹)'] = row.maturityAmount || 0;
      item['स्थिती'] = row.status;

      return item;
    });

    const grandTotalRow: any = {
      'अ.क्र.': '' as any,
      'FD पावती / खाते नं.': '',
      'ग्राहक क्र. (CIF)': '',
      'खातेदाराचे नाव': 'एकूण बेरीज (Grand Total):',
      'योजना': '',
      'ठेव तारीख': '',
      'मुदत ठेव रक्कम (₹)': totalDepositSum
    };

    if (reportType === 'Outstanding') {
      grandTotalRow['मुद्दल + पोस्ट व्याज (₹)'] = totalOutstandingWithInterestSum;
      grandTotalRow['पोस्ट झालेले व्याज (₹)'] = totalPostedInterestSum;
    }

    grandTotalRow['व्याज दर (%)'] = 0;
    grandTotalRow['मुदतपूर्ती तारीख'] = '';
    grandTotalRow['मुदतपूर्ती रक्कम (₹)'] = totalMaturitySum;
    grandTotalRow['स्थिती'] = '';

    excelRows.push(grandTotalRow);

    const activeScheme = schemes.find(s => s.fdSchemeID === selectedSchemeId);
    const activeSchemeName = activeScheme ? activeScheme.schemeName : 'AllSchemes';
    const cleanSchemeName = activeSchemeName.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_');
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FD Report');
    XLSX.writeFile(wb, `FD_Report_${reportType}_${cleanSchemeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const renderSummaryBanner = () => {
    if (reportType === 'Register') {
      const avgDeposit = filteredData.length > 0 ? totalDepositSum / filteredData.length : 0;
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण मुदत ठेव खाती</span>
              <strong className="text-primary font-mono text-xs">{filteredData.length.toLocaleString('en-IN')}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव मुद्दल</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalDepositSum)}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण मुदतपूर्ती रक्कम</span>
              <strong className="text-blue-700 font-mono text-xs">₹ {fmtCurrency(totalMaturitySum)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">सरासरी ठेव रक्कम</span>
              <strong className="text-slate-900 font-mono text-xs">₹ {fmtCurrency(avgDeposit)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'Outstanding') {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण चालू बाकी खाती</span>
              <strong className="text-primary font-mono text-xs">{filteredData.length.toLocaleString('en-IN')} खाती</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण मूळ ठेव मुद्दल</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalDepositSum)}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">पोस्ट झालेले व्याज</span>
              <strong className="text-blue-700 font-mono text-xs">₹ {fmtCurrency(totalPostedInterestSum)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण बाकी (मुद्दल + पोस्ट व्याज)</span>
              <strong className="text-amber-800 font-mono text-xs font-black">₹ {fmtCurrency(totalOutstandingWithInterestSum)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'MaturityDue') {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">मुदतपूर्ती खाती</span>
              <strong className="text-primary font-mono text-xs">{filteredData.length.toLocaleString('en-IN')}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">मूळ ठेव मुद्दल</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalDepositSum)}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण देय मुदतपूर्ती रक्कम</span>
              <strong className="text-blue-700 font-mono text-xs">₹ {fmtCurrency(totalMaturitySum)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">कालावधी</span>
              <strong className="text-slate-800 text-[10.5px] font-mono">{formatDisplayDate(fromDate)} - {formatDisplayDate(toDate)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'MemberLedger' && customerLedger) {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">खातेदाराचे नाव</span>
              <strong className="text-slate-950 text-xs truncate block">{customerLedger.customerName}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">CIF क्र. / मोबाईल</span>
              <strong className="text-primary font-mono text-xs">{customerLedger.cifNo || '-'} | {customerLedger.mobileNo || '-'}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण FD खाती</span>
              <strong className="text-blue-700 font-mono text-xs">{customerLedger.totalFDAccountsCount} खाती</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव गुंतवणूक</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(customerLedger.totalPrincipalInvested)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'VoucherPassing') {
      const pendingCount = filteredVoucherPassing.filter(v => v.status === 'Pending').length;
      const approvedCount = filteredVoucherPassing.filter(v => v.status === 'Approved').length;
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण व्हाउचर</span>
              <strong className="text-primary font-mono text-xs">{filteredVoucherPassing.length}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">प्रलंबित व्हाउचर</span>
              <strong className="text-amber-700 font-mono text-xs">{pendingCount}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">मंजूर व्हाउचर</span>
              <strong className="text-emerald-700 font-mono text-xs">{approvedCount}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण उलाढाल</span>
              <strong className="text-slate-950 font-mono text-xs">₹ {fmtCurrency(totalVoucherPassingSum)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'DeletedEntries') {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण रद्द नोंदी</span>
              <strong className="text-rose-700 font-mono text-xs">{filteredDeletedEntries.length}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">ठेव अर्ज रद्द</span>
              <strong className="text-amber-700 font-mono text-xs">{filteredDeletedEntries.filter(d => d.typeBadge === 'ठेव अर्ज रद्द').length}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">परतफेड रद्द</span>
              <strong className="text-purple-700 font-mono text-xs">{filteredDeletedEntries.filter(d => d.typeBadge === 'परतफेड रद्द').length}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण रद्द रक्कम</span>
              <strong className="text-rose-900 font-mono text-xs font-black">₹ {fmtCurrency(totalDeletedSum)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'MigratedFD') {
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">स्थलांतरित खाती</span>
              <strong className="text-primary font-mono text-xs">{filteredData.length}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव मुद्दल</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalDepositSum)}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण मुदतपूर्ती रक्कम</span>
              <strong className="text-blue-700 font-mono text-xs">₹ {fmtCurrency(totalMaturitySum)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">साचलेले जुने व्याज</span>
              <strong className="text-amber-800 font-mono text-xs">₹ {fmtCurrency(totalLegacyAccruedSum)}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'CustomerSummary') {
      const avgDepositPerCust = filteredCustomerSummary.length > 0 ? totalCustomerSummaryDeposit / filteredCustomerSummary.length : 0;
      return (
        <div className="border border-slate-900 bg-white p-2 my-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण खातेदार</span>
              <strong className="text-primary font-mono text-xs">{filteredCustomerSummary.length.toLocaleString('en-IN')}</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव पावत्या</span>
              <strong className="text-blue-700 font-mono text-xs">{totalCustomerSummaryFdCount.toLocaleString('en-IN')} ठेवी</strong>
            </div>
            <div className="border-r border-slate-300 pr-2">
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">एकूण ठेव रक्कम</span>
              <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(totalCustomerSummaryDeposit)}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-bold">सरासरी ठेव / खातेदार</span>
              <strong className="text-slate-900 font-mono text-xs">₹ {fmtCurrency(avgDepositPerCust)}</strong>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const extraToolbarControls = (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {/* 1. Report Selector */}
      <div className="w-52 sm:w-60">
        <select
          value={reportType}
          onChange={(e) => handleReportTypeChange(e.target.value)}
          className="h-6 border border-slate-300 rounded px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary w-full text-primary"
        >
          <option value="Register">१. मुदत ठेव नोंदवही (FD Register)</option>
          <option value="Outstanding">२. मुदत ठेव बाकी अहवाल (FD Outstanding)</option>
          <option value="MaturityDue">३. मुदतपूर्ती देय अहवाल (Maturity Due)</option>
          <option value="MemberLedger">४. मुदत ठेव खातावणी (FD Account Ledger)</option>
          <option value="AccrualProvision">५. व्याज तरतूद (Interest Provision)</option>
          <option value="VoucherPassing">६. मुदत ठेव व्हाउचर पासिंग अहवाल (Voucher Passing)</option>
          <option value="DeletedEntries">७. मुदत ठेव रद्द नोंदी व रोलबॅक अहवाल (Deleted & Rollback)</option>
          <option value="MigratedFD">८. स्थलांतरित मुदत ठेव (FD) यादी (Migrated FD Accounts Report)</option>
          <option value="CustomerSummary">९. मुदतबंद ठेव यादी (ग्राहक-निहाय एकत्रित ठेवी)</option>
        </select>
      </div>

      {/* 2. Branch Selector */}
      {reportType !== 'AccrualProvision' && reportType !== 'MemberLedger' && branches.length > 0 && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <Building2 size={11} className="text-slate-500" />
          <label className="text-[10px] text-slate-600 font-semibold">शाखा:</label>
          <select
            value={branchID}
            onChange={(e) => setBranchID(parseInt(e.target.value, 10))}
            className="h-5 text-[10.5px] border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-semibold cursor-pointer max-w-[120px]"
          >
            <option value={0}>सर्व शाखा (All)</option>
            {branches.map((b) => (
              <option key={b.branchID} value={b.branchID}>
                {b.branchName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Customer Search Select (for MemberLedger) */}
      {reportType === 'MemberLedger' && (
        <div className="w-56 sm:w-72">
          <CustomerSearchSelect
            customers={customers}
            value={selectedCustomerID || ''}
            onChange={(val) => setSelectedCustomerID(val ? Number(val) : 0)}
            placeholder="-- खातेदार निवडा (CIF / नाव / मो.) --"
          />
        </div>
      )}

      {/* 4. Scheme Selector */}
      {(reportType === 'Register' || reportType === 'Outstanding' || reportType === 'MaturityDue' || reportType === 'MigratedFD') && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <label className="text-[10px] text-slate-600 font-semibold">योजना:</label>
          <select
            value={selectedSchemeId}
            onChange={(e) => setSelectedSchemeId(parseInt(e.target.value, 10))}
            className="h-5 text-[10.5px] font-bold border-none bg-transparent focus:ring-0 p-0 text-slate-900 cursor-pointer max-w-[140px]"
          >
            <option value={0}>सर्व योजना (All)</option>
            {schemes.map((s) => (
              <option key={s.fdSchemeID} value={s.fdSchemeID}>
                {s.schemeName} {s.schemeCode ? `(${s.schemeCode})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 5. Date Filter (AsOfDate for CustomerSummary) */}
      {reportType === 'CustomerSummary' && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <Calendar size={11} className="text-slate-500" />
          <label className="text-[10px] text-slate-600 font-semibold">अखेर तारीख:</label>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="h-5 text-[11px] font-mono border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-bold"
          />
        </div>
      )}

      {/* 6. Date Range (for Register, MaturityDue, VoucherPassing, DeletedEntries) */}
      {(reportType === 'Register' || reportType === 'MaturityDue' || reportType === 'VoucherPassing' || reportType === 'DeletedEntries') && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <Calendar size={11} className="text-slate-500" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-5 text-[10.5px] font-mono border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-bold w-24"
            title="या तारखेपासून"
          />
          <span className="text-slate-400 text-xs">-</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-5 text-[10.5px] font-mono border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-bold w-24"
            title="या तारखेपर्यंत"
          />
        </div>
      )}

      {/* 7. Status Filter (for VoucherPassing) */}
      {reportType === 'VoucherPassing' && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
          <label className="text-[10px] text-slate-600 font-semibold">स्थिती:</label>
          <select
            value={voucherPassingStatus}
            onChange={(e) => setVoucherPassingStatus(e.target.value)}
            className="h-5 text-[10.5px] border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-semibold cursor-pointer"
          >
            <option value="ALL">सर्व (All)</option>
            <option value="Pending">प्रलंबित (Pending)</option>
            <option value="Approved">मंजूर / पास (Passed)</option>
          </select>
        </div>
      )}

      {/* 8. Layout Mode Toggle (for CustomerSummary: DualColumn vs Detailed) */}
      {reportType === 'CustomerSummary' && (
        <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-300">
          <button
            type="button"
            onClick={() => setSummaryViewMode('DualColumn')}
            className={`px-1.5 py-0.5 rounded-xs font-semibold text-[10.5px] cursor-pointer transition-colors ${
              summaryViewMode === 'DualColumn' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            २ स्तंभी (Dual)
          </button>
          <button
            type="button"
            onClick={() => setSummaryViewMode('Detailed')}
            className={`px-1.5 py-0.5 rounded-xs font-semibold text-[10.5px] cursor-pointer transition-colors ${
              summaryViewMode === 'Detailed' 
                ? 'bg-primary text-white shadow-2xs' 
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            तपशीलवार
          </button>
        </div>
      )}

      {/* 9. Search Box */}
      {reportType !== 'AccrualProvision' && reportType !== 'MemberLedger' && (
        <div className="relative w-36 sm:w-44">
          <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="शोधा..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-5 pr-1.5 py-0.5 h-6 border border-slate-300 rounded text-[10.5px] focus:outline-none focus:border-primary bg-white"
          />
        </div>
      )}

      {/* 10. Signature Tier Selector */}
      <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
        <label className="text-[10px] text-slate-600 font-semibold whitespace-nowrap">स्वाक्षरी:</label>
        <select
          value={signatureTier}
          onChange={(e) => setSignatureTier(e.target.value as CbsSignatureTier)}
          className="h-5 text-[10.5px] border-none bg-transparent focus:ring-0 p-0 text-slate-800 font-semibold cursor-pointer"
        >
          <option value="3-tier">३-स्तरीय</option>
          <option value="4-tier">४-स्तरीय</option>
        </select>
      </div>

      {/* 11. Refresh Button */}
      {reportType !== 'AccrualProvision' && (
        <button
          type="button"
          onClick={() => {
            if (reportType === 'MemberLedger') {
              if (selectedCustomerID > 0) fetchCustomerLedgerData(selectedCustomerID);
            } else {
              fetchReportData();
            }
          }}
          disabled={loading}
          className="h-6 bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 rounded border border-slate-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
          title="रिफ्रेश करा"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );

  const signatureTitles = signatureTier === '4-tier'
    ? [
        { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' },
        { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Director)' }
      ]
    : [
        { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' }
      ];

  if (reportType === 'AccrualProvision') {
    return (
      <div className="cbs-report-wrapper p-2 sm:p-4 bg-slate-100 min-h-screen">
        <div className="cbs-toolbar bg-white px-3 py-1.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText size={13} className="stroke-[2.5]" />
            </div>
            <h2 className="text-xs font-bold text-gray-900 leading-none">
              मुदत ठेव अहवाल केंद्र <span className="text-[10px] font-normal text-slate-500">(FD Reports Center)</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-700">अहवाल प्रकार:</label>
            <div className="w-56 sm:w-64">
              <select
                value={reportType}
                onChange={(e) => handleReportTypeChange(e.target.value)}
                className="h-6 border border-slate-300 rounded px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary w-full text-primary"
              >
                <option value="Register">१. मुदत ठेव नोंदवही (FD Register)</option>
                <option value="Outstanding">२. मुदत ठेव बाकी अहवाल (FD Outstanding)</option>
                <option value="MaturityDue">३. मुदतपूर्ती देय अहवाल (Maturity Due)</option>
                <option value="MemberLedger">४. मुदत ठेव खातावणी (FD Account Ledger)</option>
                <option value="AccrualProvision">५. व्याज तरतूद (Interest Provision)</option>
                <option value="VoucherPassing">६. मुदत ठेव व्हाउचर पासिंग अहवाल (Voucher Passing)</option>
                <option value="DeletedEntries">७. मुदत ठेव रद्द नोंदी व रोलबॅक अहवाल (Deleted & Rollback)</option>
                <option value="MigratedFD">८. स्थलांतरित मुदत ठेव (FD) यादी (Migrated FD Accounts Report)</option>
                <option value="CustomerSummary">९. मुदतबंद ठेव यादी (ग्राहक-निहाय एकत्रित ठेवी)</option>
              </select>
            </div>
          </div>
        </div>
        <FdAccrualPosting />
      </div>
    );
  }

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      reportTitle={getReportTitle()}
      reportSubtitle={getReportSubtitle()}
      periodText={getPeriodText()}
      branchName={activeBranchName}
      sansthaInfo={sansthaDetail}
      summaryBanner={renderSummaryBanner()}
      signatureTier={signatureTier}
      signatureTitles={signatureTitles}
      onExportExcel={handleExportExcel}
      extraToolbarControls={extraToolbarControls}
      isLoading={loading}
      hasData={getHasData()}
      preparedBy={user?.username || 'Admin'}
      emptyState={
        reportType === 'MemberLedger' && !customerLedger ? (
          <div className="py-16 text-center text-slate-500 font-medium border border-dashed border-slate-300 rounded bg-white">
            <Search size={32} className="mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-xs font-bold text-slate-700">खातावणी पाहण्यासाठी कृपया वरील शोध बॉक्समधून खातेदार निवडा.</p>
            <p className="text-[11px] text-slate-400 mt-1">(Please select a customer from the search box above to view FD ledger statement)</p>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-500 font-medium border border-dashed border-slate-300 rounded bg-white">
            <Users size={32} className="mx-auto mb-2 text-slate-400 opacity-60" />
            <p className="text-xs font-bold text-slate-700">निवडलेल्या निकषांनुसार कोणतीही माहिती उपलब्ध नाही.</p>
          </div>
        )
      }
    >
      {/* ============================================================
          VIEW 1: CUSTOMER SUMMARY (९. मुदतबंद ठेव यादी - Dual Column & Detailed)
          ============================================================ */}
      {reportType === 'CustomerSummary' && (
        <div className="space-y-4">
          {/* Dual-Column Print Format */}
          {summaryViewMode === 'DualColumn' && (
            <div className="overflow-x-auto">
              {(() => {
                const half = Math.ceil(filteredCustomerSummary.length / 2);
                const leftRows = filteredCustomerSummary.slice(0, half);
                const rightRows = filteredCustomerSummary.slice(half);

                return (
                  <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold text-[11px]">
                        {/* Left Column Header */}
                        <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.नं.</th>
                        <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center font-mono">खाते क्र.</th>
                        <th className="border border-slate-900 py-1.5 px-2.5 w-[24%] text-left">खातेदाराचे नाव</th>
                        <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right font-extrabold">रक्कम (₹)</th>
                        
                        {/* Divider / Right Column Header */}
                        <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center border-l-2 border-l-slate-900">अ.नं.</th>
                        <th className="border border-slate-900 py-1.5 px-1.5 w-[8%] text-center font-mono">खाते क्र.</th>
                        <th className="border border-slate-900 py-1.5 px-2.5 w-[24%] text-left">खातेदाराचे नाव</th>
                        <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right font-extrabold">रक्कम (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: half }).map((_, i) => {
                        const left = leftRows[i];
                        const right = rightRows[i];
                        return (
                          <tr key={`dual-row-${i}`} className="hover:bg-slate-50 text-slate-900 text-[11px] leading-tight">
                            {/* Left cell */}
                            <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                              {i + 1}
                            </td>
                            <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-900">
                              {left ? (left.cifNo || left.accountNo) : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2.5 text-left font-medium truncate max-w-[200px]" title={left?.customerName}>
                              {left ? left.customerName : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950">
                              {left ? Number(left.depositAmount).toFixed(2) : ''}
                            </td>

                            {/* Right cell */}
                            <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium border-l-2 border-l-slate-900">
                              {right ? half + i + 1 : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-900">
                              {right ? (right.cifNo || right.accountNo) : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2.5 text-left font-medium truncate max-w-[200px]" title={right?.customerName}>
                              {right ? right.customerName : ''}
                            </td>
                            <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-950">
                              {right ? Number(right.depositAmount).toFixed(2) : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                        <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                          एकूण खातेदार: <strong className="font-mono">{filteredCustomerSummary.length}</strong>
                        </td>
                        <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                          ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                        </td>
                        <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider border-l-2 border-l-slate-900">
                          एकूण ठेवी: <strong className="font-mono">{totalCustomerSummaryFdCount}</strong>
                        </td>
                        <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-slate-950">
                          ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                );
              })()}
            </div>
          )}

          {/* Detailed Drilldown View */}
          {summaryViewMode === 'Detailed' && (
            <div className="overflow-x-auto">
              <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                    <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">तपशील</th>
                    <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.नं.</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center font-mono">खाते / CIF क्र.</th>
                    <th className="border border-slate-900 py-1.5 px-3 w-[28%] text-left">खातेदाराचे नाव</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">एकूण ठेवी</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right font-extrabold">एकूण ठेव रक्कम (₹)</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-right font-bold">एकूण मुदतपूर्ती (₹)</th>
                    <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center font-mono">मोबाईल नं.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomerSummary.map((cust, idx) => {
                    const isExpanded = expandedCustomerIds.includes(cust.customerID);
                    return (
                      <React.Fragment key={`cust-summary-${cust.customerID || idx}`}>
                        <tr 
                          onClick={() => {
                            setExpandedCustomerIds(prev => 
                              prev.includes(cust.customerID)
                                ? prev.filter(id => id !== cust.customerID)
                                : [...prev, cust.customerID]
                            );
                          }}
                          className="hover:bg-slate-50 cursor-pointer text-slate-900 text-[11px]"
                        >
                          <td className="border border-slate-900 py-1 px-1 text-center">
                            <button 
                              type="button"
                              className="w-4 h-4 inline-flex items-center justify-center rounded bg-slate-100 hover:bg-primary hover:text-white font-bold text-xs"
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          </td>
                          <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                          <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-primary">
                            {cust.cifNo || cust.accountNo}
                          </td>
                          <td className="border border-slate-900 py-1 px-3 text-left font-bold text-slate-950">
                            {cust.customerName}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-center">
                            <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold text-[10px] font-mono">
                              {cust.fdCount} {cust.fdCount > 1 ? 'ठेवी' : 'ठेव'}
                            </span>
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-800 text-xs">
                            ₹ {fmtCurrency(cust.depositAmount)}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-blue-900">
                            ₹ {fmtCurrency(cust.maturityAmount)}
                          </td>
                          <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px] text-slate-600">
                            {cust.mobileNo || '-'}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50 border-b-2 border-slate-400">
                            <td colSpan={8} className="p-2 border border-slate-900">
                              <div className="bg-white p-2 rounded border border-slate-300">
                                <div className="flex justify-between items-center text-xs font-bold text-slate-800 mb-1 pb-1 border-b">
                                  <span>{cust.customerName} - वैयक्तिक मुदत ठेव पावत्या तपशील:</span>
                                  <span className="text-primary font-mono">एकूण ठेवी: {cust.fdCount} | एकूण रक्कम: ₹ {fmtCurrency(cust.depositAmount)}</span>
                                </div>
                                <table className="w-full border-collapse border border-slate-300 text-[11px]">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-800 text-center font-bold">
                                      <th className="border border-slate-300 p-1">पावती क्र.</th>
                                      <th className="border border-slate-300 p-1 text-left">योजना</th>
                                      <th className="border border-slate-300 p-1">ठेव तारीख</th>
                                      <th className="border border-slate-300 p-1 text-right">ठेव रक्कम (₹)</th>
                                      <th className="border border-slate-300 p-1">व्याज दर %</th>
                                      <th className="border border-slate-300 p-1">मुदतपूर्ती तारीख</th>
                                      <th className="border border-slate-300 p-1 text-right">मुदतपूर्ती रक्कम (₹)</th>
                                      <th className="border border-slate-300 p-1">स्थिती</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cust.accounts.map((acc, aIdx) => (
                                      <tr key={acc.fdAccountID || aIdx} className="hover:bg-amber-50/50">
                                        <td className="border border-slate-300 p-1 text-center font-mono font-bold text-primary">
                                          {acc.accountNo}
                                          {acc.legacyAccountNumber && (
                                            <span className="text-[10px] text-amber-900 bg-amber-50 px-1 rounded border border-amber-300 ml-1">
                                              {acc.legacyAccountNumber}
                                            </span>
                                          )}
                                        </td>
                                        <td className="border border-slate-300 p-1 text-left">{acc.schemeName}</td>
                                        <td className="border border-slate-300 p-1 text-center font-mono">{formatDisplayDate(acc.openingDate)}</td>
                                        <td className="border border-slate-300 p-1 text-right font-mono font-bold text-emerald-800">
                                          ₹ {fmtCurrency(acc.depositAmount)}
                                        </td>
                                        <td className="border border-slate-300 p-1 text-center font-mono">{acc.interestRate}%</td>
                                        <td className="border border-slate-300 p-1 text-center font-mono">{formatDisplayDate(acc.maturityDate)}</td>
                                        <td className="border border-slate-300 p-1 text-right font-mono font-bold text-blue-900">
                                          ₹ {fmtCurrency(acc.maturityAmount)}
                                        </td>
                                        <td className="border border-slate-300 p-1 text-center">
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                            {acc.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                    <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण बेरीज (Grand Total - {filteredCustomerSummary.length} खातेदार):
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-center font-mono font-bold text-primary">
                      {totalCustomerSummaryFdCount} ठेवी
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                      ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/50">
                      ₹ {fmtCurrency(totalCustomerSummaryMaturity)}
                    </td>
                    <td className="border border-slate-900 py-1.5 px-2 text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          VIEW 2: MEMBER LEDGER (४. मुदत ठेव खातावणी विवरणपत्र)
          ============================================================ */}
      {reportType === 'MemberLedger' && customerLedger && (
        <div className="space-y-4">
          <div className="border border-slate-900 p-2.5 my-2 bg-slate-50/50 rounded-xs text-[11px]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-slate-500 block text-[10px]">खातेदाराचे नाव:</span>
                <strong className="text-slate-950">{customerLedger.customerName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">ग्राहक क्र. (CIF):</span>
                <strong className="text-primary font-mono">{customerLedger.cifNo || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">एकूण FD खाती:</span>
                <strong className="text-slate-900 font-mono">{customerLedger.totalFDAccountsCount}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">एकूण मुदत ठेव गुंतवणूक:</span>
                <strong className="text-emerald-800 font-mono">₹ {fmtCurrency(customerLedger.totalPrincipalInvested)}</strong>
              </div>
            </div>
          </div>

          {customerLedger.accounts.map((acc, aIdx) => (
            <div key={acc.fdAccountID || aIdx} className="border border-slate-900 p-2.5 rounded-xs mt-3">
              <div className="flex justify-between items-center bg-slate-100 p-1.5 border-b border-slate-900 font-bold text-xs mb-2">
                <span>
                  FD पावती नं.: <span className="font-mono text-primary">{acc.accountNo}</span>
                  {acc.legacyAccountNumber && (
                    <span className="text-[10px] text-amber-900 bg-amber-50 border border-amber-300 px-1 py-0.5 rounded font-mono ml-1.5 font-bold" title="जुना पावती क्र.">
                      जुनी पावती: {acc.legacyAccountNumber}
                    </span>
                  )}
                  {' '}({acc.schemeName})
                </span>
                <span className="text-emerald-800 font-mono">ठेव रक्कम: ₹ {fmtCurrency(acc.depositAmount)} | व्याज दर: {acc.interestRate}%</span>
              </div>

              <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-900">
                    <th className="border border-slate-900 p-1 text-center">तारीख</th>
                    <th className="border border-slate-900 p-1 text-center">व्हाउचर क्र.</th>
                    <th className="border border-slate-900 p-1 text-left">तपशील</th>
                    <th className="border border-slate-900 p-1 text-right">रक्कम (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {acc.transactions.map((tx, tIdx) => (
                    <tr key={tIdx} className="text-[11px]">
                      <td className="border border-slate-900 p-1 text-center font-mono">{formatDisplayDate(tx.transactionDate)}</td>
                      <td className="border border-slate-900 p-1 text-center font-mono">{tx.voucherNo || '-'}</td>
                      <td className="border border-slate-900 p-1">{tx.narration || tx.transactionType}</td>
                      <td className="border border-slate-900 p-1 text-right font-mono font-bold">{fmtCurrency(tx.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================
          VIEW 3: VOUCHER PASSING (६. मुदत ठेव व्हाउचर पासिंग अहवाल)
          ============================================================ */}
      {reportType === 'VoucherPassing' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center font-mono">व्हाउचर क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">तारीख</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">व्यवहार प्रकार</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center font-mono">FD पावती क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">खातेदाराचे नाव</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-right font-extrabold">रक्कम (₹)</th>
                <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center font-mono">स्क्रॉल</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-center">स्थिती</th>
              </tr>
            </thead>
            <tbody>
              {filteredVoucherPassing.map((v, idx) => (
                <tr key={v.voucherID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-900">{v.voucherNo}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(v.voucherDate)}</td>
                  <td className="border border-slate-900 py-1 px-2">
                    <span className="font-semibold">{v.transactionType}</span>
                    {v.narration && <span className="block text-[10px] text-slate-500 truncate max-w-[200px]" title={v.narration}>{v.narration}</span>}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-800">{v.accountNo || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 font-medium">{v.customerName || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(v.totalAmount)}</td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">{v.scrollNo || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${v.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                      {v.status === 'Approved' ? 'मंजूर' : (v.status === 'Pending' ? 'प्रलंबित' : v.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredVoucherPassing.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={6} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    एकूण व्हाउचर रक्कम बेरीज (Total):
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                    ₹ {fmtCurrency(totalVoucherPassingSum)}
                  </td>
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ============================================================
          VIEW 4: DELETED ENTRIES & ROLLBACK (७. मुदत ठेव रद्द नोंदी व रोलबॅक)
          ============================================================ */}
      {reportType === 'DeletedEntries' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-center">रद्द दिनांक & वेळ</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">रद्द नोंद प्रकार</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-center font-mono">FD पावती क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-center font-mono">व्हाउचर क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right font-extrabold">रक्कम (₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-center">रद्दकर्ता</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-center">पावती रोलबॅक</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-left">तपशील / शेरा</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeletedEntries.map((d, idx) => (
                <tr key={d.logID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px]">{d.deletedDate}</td>
                  <td className="border border-slate-900 py-1 px-2 font-semibold">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${d.typeBadge === 'ठेव अर्ज रद्द' ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'}`}>
                      {d.deleteType}
                    </span>
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">{d.accountNo || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-900">{d.voucherNo || '-'}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-rose-800">{fmtCurrency(d.amount)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-medium">{d.deletedBy}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center text-[10px]">
                    <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${d.rollbackInfo.includes('-१') ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'}`}>
                      {d.rollbackInfo}
                    </span>
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-[10px] text-slate-600 truncate max-w-[160px]" title={d.reasonOrDetails}>
                    {d.reasonOrDetails}
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredDeletedEntries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={5} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    एकूण रद्द रक्कम बेरीज (Total):
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-rose-900 bg-rose-100/50">
                    ₹ {fmtCurrency(totalDeletedSum)}
                  </td>
                  <td colSpan={3} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ============================================================
          VIEW 5: MIGRATED FD ACCOUNTS (८. स्थलांतरित मुदत ठेव यादी)
          ============================================================ */}
      {reportType === 'MigratedFD' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[3%] text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center font-mono">नवीन पावती</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center font-mono">जुनी पावती</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center font-mono">CIF नं.</th>
                <th className="border border-slate-900 py-1.5 px-3 text-left">खातेदाराचे नाव</th>
                <th className="border border-slate-900 py-1.5 px-2 text-left">योजना</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">ठेव दिनांक</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">कालावधी</th>
                <th className="border border-slate-900 py-1.5 px-2 text-right font-extrabold">ठेव मुद्दल (₹)</th>
                <th className="border border-slate-900 py-1.5 px-1 text-center">व्याज %</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">मुदतपूर्ती दिनांक</th>
                <th className="border border-slate-900 py-1.5 px-2 text-right font-bold">मुदतपूर्ती (₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 text-right font-medium">मागील व्याज (₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 text-center">शेवटची व्याज तारीख</th>
                <th className="border border-slate-900 py-1.5 px-2 text-left">वारसदार</th>
                <th className="border border-slate-900 py-1.5 px-1 text-center">स्थिती</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={row.fdAccountID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-primary">{row.accountNo}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-semibold text-amber-900">
                    {row.legacyAccountNumber ? (
                      <span className="bg-amber-50 text-amber-900 px-1 py-0.5 rounded border border-amber-300">
                        {row.legacyAccountNumber}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-900">
                    {row.cifNo || '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-3 text-left font-bold text-slate-950">
                    {row.customerName || row.memberName}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-slate-700">{row.schemeName}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.openingDate)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px]">
                    {row.durationValue && row.durationValue > 0
                      ? `${row.durationValue} ${row.durationType === 'Days' ? 'दिवस' : row.durationType === 'Years' ? 'वर्षे' : 'महिने'}`
                      : (row.durationInDays && row.durationInDays > 0 ? `${row.durationInDays} दिवस` : '-')}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(row.depositAmount)}</td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">{row.interestRate}%</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.maturityDate)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-blue-900">{fmtCurrency(row.maturityAmount)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-medium text-amber-800">{fmtCurrency(row.legacyAccruedInt)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px] text-blue-700">
                    {formatDisplayDate(row.lastInterestPostingDate)}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-left text-[10px]">
                    {row.nomineeName ? (
                      <span>
                        {row.nomineeName} {row.nomineeRelation ? `(${row.nomineeRelation})` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {row.status === 'Active' ? 'Active' : row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={8} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    {selectedSchemeId > 0 
                      ? `एकूण स्थलांतरित बेरीज (${schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeName || 'योजना'} - ${filteredData.length} खाती):`
                      : `एकूण स्थलांतरित बेरीज (${filteredData.length} खाती):`}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                    ₹ {fmtCurrency(totalDepositSum)}
                  </td>
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/50">
                    ₹ {fmtCurrency(totalMaturitySum)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-amber-950 bg-amber-100/50">
                    ₹ {fmtCurrency(totalLegacyAccruedSum)}
                  </td>
                  <td colSpan={3} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ============================================================
          VIEW 6: STANDARD FD TABLE (१. नोंदवही, २. बाकी अहवाल, ३. मुदतपूर्ती देय)
          ============================================================ */}
      {reportType !== 'MemberLedger' && reportType !== 'VoucherPassing' && reportType !== 'DeletedEntries' && reportType !== 'MigratedFD' && reportType !== 'CustomerSummary' && (
        <div className="overflow-x-auto">
          <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">#</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">FD पावती क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center font-mono">CIF नं.</th>
                <th className="border border-slate-900 py-1.5 px-3 w-[20%] text-left">खातेदाराचे नाव</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-left">योजना</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-center">ठेव दिनांक</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right font-extrabold">ठेव रक्कम (₹)</th>
                {reportType === 'Outstanding' && (
                  <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-right font-extrabold bg-amber-100/70 text-amber-950">
                    मुद्दल + पोस्ट व्याज (₹)
                  </th>
                )}
                <th className="border border-slate-900 py-1.5 px-1 w-[5%] text-center">व्याज %</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[9%] text-center">मुदतपूर्ती दिनांक</th>
                {(reportType === 'Register' || reportType === 'MaturityDue') && (
                  <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-right font-bold">मुदतपूर्ती रक्कम (₹)</th>
                )}
                <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">स्थिती</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={row.fdAccountID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-slate-900">
                    <span className="font-bold text-slate-900">{row.accountNo}</span>
                    {row.legacyAccountNumber && (
                      <div className="text-[10px] text-amber-900 font-semibold bg-amber-50 px-1 rounded border border-amber-300 inline-block mt-0.5" title="जुना पावती क्र. (Legacy Receipt No)">
                        जुनी: {row.legacyAccountNumber}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-blue-900">
                    {row.cifNo || '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-3 font-medium">{row.customerName || row.memberName}</td>
                  <td className="border border-slate-900 py-1 px-2 text-slate-700">{row.schemeName}</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.openingDate)}</td>
                  <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(row.depositAmount)}</td>
                  {reportType === 'Outstanding' && (
                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-black text-amber-950 bg-amber-50/40">
                      <div>₹ {fmtCurrency(row.totalOutstandingWithInterest ?? row.depositAmount)}</div>
                      {row.isInterestCapitalized && (row.postedInterest || 0) > 0 ? (
                        <div className="text-[9px] font-normal text-emerald-700">
                          (+₹{fmtCurrency(row.postedInterest)} व्याज)
                        </div>
                      ) : (
                        <div className="text-[9px] font-normal text-slate-400">
                          {row.isInterestCapitalized ? '(व्याज निरंक)' : '(परतावा योजना)'}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">{row.interestRate}%</td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.maturityDate)}</td>
                  {(reportType === 'Register' || reportType === 'MaturityDue') && (
                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-bold text-blue-900">
                      {fmtCurrency(row.maturityAmount)}
                    </td>
                  )}
                  <td className="border border-slate-900 py-1 px-1 text-center">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}>
                      {row.status === 'Active' ? 'Active' : row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={6} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    {selectedSchemeId > 0 
                      ? `एकूण मुदत ठेव बेरीज (${schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeName || 'निवडलेली योजना'} - ${filteredData.length} खाती):`
                      : `एकूण मुदत ठेव बेरीज (सर्व योजना - ${filteredData.length} खाती):`}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                    ₹ {fmtCurrency(totalDepositSum)}
                  </td>
                  {reportType === 'Outstanding' && (
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-amber-950 bg-amber-100/70">
                      ₹ {fmtCurrency(totalOutstandingWithInterestSum)}
                    </td>
                  )}
                  <td colSpan={2} className="border border-slate-900 py-1.5 px-2 text-center"></td>
                  {(reportType === 'Register' || reportType === 'MaturityDue') && (
                    <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/50">
                      ₹ {fmtCurrency(totalMaturitySum)}
                    </td>
                  )}
                  <td className="border border-slate-900 py-1.5 px-2 text-center"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </CbsReportLayout>
  );
}

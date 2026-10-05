import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CustomerSearchSelect from './common/CustomerSearchSelect';
import FdAccrualPosting from './FdAccrualPosting';
import FdCustomerSummaryReport from './FdCustomerSummaryReport';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  Landmark, 
  Building2,
  Calendar,
  ArrowLeft
} from 'lucide-react';

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

const formatDisplayDate = (dStr?: string | null) => {
  if (!dStr) return '-';
  try {
    const clean = dStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dStr;
  }
};



export default function FdReports({ onNavigate, onBack }: FdReportsProps) {
  const [reportType, setReportType] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reportType') || 'Register';
  });

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
  const reportRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = () => {
    window.print();
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
      case 'CustomerSummary': return 'मुदतबंद ठेव यादी (Customer-wise Fixed Deposit Summary)';
      case 'Register': return 'मुदत ठेव नोंदवही (Fixed Deposit Register)';
      case 'Outstanding': return 'मुदत ठेव बाकी अहवाल (FD Outstanding Report)';
      case 'MaturityDue': return 'मुदतपूर्ती देय अहवाल (FD Maturity Due Report)';
      case 'MemberLedger': return 'मुदत ठेव खातावणी विवरणपत्र (FD Account Ledger)';
      case 'VoucherPassing': return 'मुदत ठेव व्हाउचर पासिंग अहवाल (FD Voucher Passing Report)';
      case 'DeletedEntries': return 'मुदत ठेव थेट रद्द नोंदी व रोलबॅक अहवाल (FD Deleted Entries & Rollback Report)';
      case 'MigratedFD': return 'स्थलांतरित मुदत ठेव (FD) यादी अहवाल (Migrated FD Accounts Report)';
      default: return 'मुदत ठेव अहवाल (FD Report)';
    }
  };

  const handleExportExcel = () => {
    if (reportType === 'CustomerSummary') {
      if (filteredCustomerSummary.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredCustomerSummary.map((r, i) => ({
        'अ.क्र.': i + 1,
        'खाते / CIF क्र.': r.cifNo || r.accountNo,
        'खातेदाराचे नाव': r.customerName,
        'एकूण ठेवी (संख्या)': r.fdCount,
        'एकूण ठेव रक्कम (₹)': r.depositAmount,
        'एकूण मुदतपूर्ती रक्कम (₹)': r.maturityAmount,
        'मोबाईल नं.': r.mobileNo || '-'
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'खाते / CIF क्र.': '',
        'खातेदाराचे नाव': 'एकूण बेरीज (Grand Total):',
        'एकूण ठेवी (संख्या)': totalCustomerSummaryFdCount,
        'एकूण ठेव रक्कम (₹)': totalCustomerSummaryDeposit,
        'एकूण मुदतपूर्ती रक्कम (₹)': totalCustomerSummaryMaturity,
        'मोबाईल नं.': ''
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Mudatband Thev Yadi');
      XLSX.writeFile(wb, `Mudatband_Thev_Yadi_${asOfDate || new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'VoucherPassing') {
      if (filteredVoucherPassing.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
      const rows = filteredVoucherPassing.map((r, i) => ({
        'अ.क्र.': i + 1,
        'व्हाउचर क्र.': r.voucherNo,
        'दिनांक': formatDisplayDate(r.voucherDate),
        'व्यवहार प्रकार': r.transactionType,
        'FD पावती क्र.': r.accountNo || '-',
        'खातेदाराचे नाव': r.customerName || '-',
        'रक्कम (₹)': r.totalAmount,
        'स्थिती': r.status === 'Approved' ? 'पास / मंजूर' : (r.status === 'Pending' ? 'प्रलंबित' : r.status),
        'स्क्रॉल क्र.': r.scrollNo || '-',
        'तपशील': r.narration
      }));
      rows.push({
        'अ.क्र.': '' as any,
        'व्हाउचर क्र.': '',
        'दिनांक': '',
        'व्यवहार प्रकार': '',
        'FD पावती क्र.': '',
        'खातेदाराचे नाव': 'एकूण बेरीज (Total):',
        'रक्कम (₹)': totalVoucherPassingSum,
        'स्थिती': '',
        'स्क्रॉल क्र.': '',
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
      const rows = filteredDeletedEntries.map((r, i) => ({
        'अ.क्र.': i + 1,
        'रद्द दिनांक & वेळ': r.deletedDate,
        'रद्द नोंद प्रकार': r.deleteType,
        'FD पावती क्र.': r.accountNo || '-',
        'व्हाउचर क्र.': r.voucherNo || '-',
        'रक्कम (₹)': r.amount,
        'रद्दकर्ता': r.deletedBy,
        'पावती क्र. रोलबॅक स्थिती': r.rollbackInfo,
        'तपशील व कारण': r.reasonOrDetails
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
    const excelRows = filteredData.map((row, i) => ({
      'अ.क्र.': i + 1,
      'FD पावती / खाते नं.': row.accountNo,
      'ग्राहक क्र. (CIF)': row.cifNo || row.memberCode || '-',
      'खातेदाराचे नाव': row.customerName || row.memberName,
      'योजना': row.schemeName,
      'ठेव तारीख': formatDisplayDate(row.openingDate),
      'मुदत ठेव रक्कम (₹)': row.depositAmount || 0,
      'व्याज दर (%)': row.interestRate,
      'मुदतपूर्ती तारीख': formatDisplayDate(row.maturityDate),
      'मुदतपूर्ती रक्कम (₹)': row.maturityAmount || 0,
      'स्थिती': row.status
    }));

    excelRows.push({
      'अ.क्र.': '' as any,
      'FD पावती / खाते नं.': '',
      'ग्राहक क्र. (CIF)': '',
      'खातेदाराचे नाव': 'एकूण बेरीज (Grand Total):',
      'योजना': '',
      'ठेव तारीख': '',
      'मुदत ठेव रक्कम (₹)': totalDepositSum,
      'व्याज दर (%)': 0,
      'मुदतपूर्ती तारीख': '',
      'मुदतपूर्ती रक्कम (₹)': totalMaturitySum,
      'स्थिती': ''
    });

    const activeScheme = schemes.find(s => s.fdSchemeID === selectedSchemeId);
    const activeSchemeName = activeScheme ? activeScheme.schemeName : 'AllSchemes';
    const cleanSchemeName = activeSchemeName.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_');
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FD Report');
    XLSX.writeFile(wb, `FD_Report_${reportType}_${cleanSchemeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 8mm 8mm;
            }
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: transparent !important;
            }
            .no-print {
              display: none !important;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            tfoot {
              display: table-footer-group;
            }
          }
        `}
      </style>

      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5">
        
        {/* Row 1: Title + Inline Filters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          
          {/* Left: Compact Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Landmark size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>मुदत ठेव अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(FD Reports Center)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Report Type */}
            <div className="w-52 sm:w-60">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full text-primary"
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

            {/* As-Of Date for CustomerSummary */}
            {reportType === 'CustomerSummary' && (
              <div className="flex items-center gap-1">
                <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">अखेर तारीख:</label>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary w-28"
                  title="मुदतबंद ठेव यादी अखेर तारीख"
                />
              </div>
            )}

            {/* Date Range for VoucherPassing, DeletedEntries, MaturityDue */}
            {(reportType === 'VoucherPassing' || reportType === 'DeletedEntries' || reportType === 'MaturityDue') && (
              <div className="flex items-center gap-1">
                <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">तारीख:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary w-28"
                  title="या तारखेपासून"
                />
                <span className="text-gray-400 text-xs">-</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary w-28"
                  title="या तारखेपर्यंत"
                />
              </div>
            )}

            {/* Status filter for VoucherPassing */}
            {reportType === 'VoucherPassing' && (
              <div className="flex items-center gap-1">
                <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">स्थिती:</label>
                <select
                  value={voucherPassingStatus}
                  onChange={(e) => setVoucherPassingStatus(e.target.value)}
                  className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary w-24 sm:w-28"
                >
                  <option value="ALL">सर्व (All)</option>
                  <option value="Pending">प्रलंबित (Pending)</option>
                  <option value="Approved">मंजूर / पास (Passed)</option>
                </select>
              </div>
            )}

            {/* Branch or Customer selector */}
            {reportType === 'MemberLedger' ? (
              <div className="w-64 sm:w-80">
                <CustomerSearchSelect
                  customers={customers}
                  value={selectedCustomerID || ''}
                  onChange={(val) => setSelectedCustomerID(val ? Number(val) : 0)}
                  placeholder="-- खातेदार निवडा (CIF / नाव / मो.) --"
                />
              </div>
            ) : reportType !== 'AccrualProvision' ? (
              <div className="flex items-center gap-1">
                <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
                <select
                  value={branchID}
                  onChange={(e) => setBranchID(parseInt(e.target.value, 10))}
                  className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
                >
                  <option value={0}>सर्व शाखा (All)</option>
                  {branches.map((b) => (
                    <option key={b.branchID} value={b.branchID}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Scheme Selector */}
            {reportType !== 'AccrualProvision' && reportType !== 'MemberLedger' && reportType !== 'VoucherPassing' && reportType !== 'DeletedEntries' && (
              <div className="flex items-center gap-1">
                <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">योजना:</label>
                <select
                  value={selectedSchemeId}
                  onChange={(e) => setSelectedSchemeId(parseInt(e.target.value, 10))}
                  className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[130px] max-w-[200px] text-gray-900"
                  title="मुदत ठेव योजना निवडा (सर्व योजना एकत्रित किंवा विशिष्ट योजना)"
                >
                  <option value={0}>सर्व योजना (एकत्रित)</option>
                  {schemes.map((s) => (
                    <option key={s.fdSchemeID} value={s.fdSchemeID}>
                      {s.schemeName} {s.schemeCode ? `(${s.schemeCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Button */}
            {reportType !== 'AccrualProvision' && (
              <button
                onClick={fetchReportData}
                disabled={loading}
                className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
                <span>पहा</span>
              </button>
            )}
          </div>

          {/* Right: Export & Print Action Buttons */}
          {reportType !== 'AccrualProvision' && reportType !== 'CustomerSummary' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleExportExcel}
                disabled={
                  reportType === 'VoucherPassing'
                    ? filteredVoucherPassing.length === 0
                    : reportType === 'DeletedEntries'
                    ? filteredDeletedEntries.length === 0
                    : filteredData.length === 0
                }
                className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${(reportType === 'VoucherPassing' ? filteredVoucherPassing.length === 0 : (reportType === 'DeletedEntries' ? filteredDeletedEntries.length === 0 : filteredData.length === 0)) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="एक्सेल फाइल डाउनलोड करा"
              >
                <FileSpreadsheet size={12} />
                <span>एक्सेल</span>
              </button>

              <button
                onClick={handlePrint}
                disabled={
                  reportType === 'VoucherPassing'
                    ? filteredVoucherPassing.length === 0
                    : reportType === 'DeletedEntries'
                    ? filteredDeletedEntries.length === 0
                    : (filteredData.length === 0 && !customerLedger)
                }
                className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${(reportType === 'VoucherPassing' ? filteredVoucherPassing.length === 0 : (reportType === 'DeletedEntries' ? filteredDeletedEntries.length === 0 : (filteredData.length === 0 && !customerLedger))) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="A4 प्रिंट काढा"
              >
                <Printer size={12} />
                <span>प्रिंट (A4)</span>
              </button>
            </div>
          )}

        </div>

        {/* Row 2: In-Table Search + Summary Metrics Strip */}
        {reportType !== 'AccrualProvision' && reportType !== 'MemberLedger' && reportType !== 'CustomerSummary' && (
          <div className="pt-1.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="relative w-64 max-w-full">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={
                  reportType === 'VoucherPassing'
                    ? 'व्हाउचर नं, खाते क्र, नाव किंवा स्क्रॉल शोधा...'
                    : reportType === 'DeletedEntries'
                    ? 'खाते क्र, व्हाउचर नं, वापरकर्ता किंवा कारण शोधा...'
                    : 'नाव, खाते क्र. किंवा योजना शोधा...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-600">
              {reportType === 'VoucherPassing' ? (
                <>
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                    एकूण व्हाउचर्स: <strong className="text-primary font-bold">{filteredVoucherPassing.length}</strong>
                  </span>
                  <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-800 border border-amber-200">
                    प्रलंबित: <strong className="text-amber-700 font-bold">{filteredVoucherPassing.filter(v => v.status === 'Pending').length}</strong>
                  </span>
                  <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
                    एकूण उलाढाल: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalVoucherPassingSum)}</strong>
                  </span>
                </>
              ) : reportType === 'DeletedEntries' ? (
                <>
                  <span className="bg-rose-50 px-2 py-0.5 rounded text-rose-800 border border-rose-200">
                    एकूण रद्द नोंदी: <strong className="text-rose-700 font-bold">{filteredDeletedEntries.length}</strong>
                  </span>
                  <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-800 border border-amber-200">
                    ठेव अर्ज रद्द: <strong className="text-amber-700 font-bold">{filteredDeletedEntries.filter(d => d.typeBadge === 'ठेव अर्ज रद्द').length}</strong>
                  </span>
                  <span className="bg-purple-50 px-2 py-0.5 rounded text-purple-800 border border-purple-200">
                    परतफेड रद्द: <strong className="text-purple-700 font-bold">{filteredDeletedEntries.filter(d => d.typeBadge === 'परतफेड रद्द').length}</strong>
                  </span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                    रद्द रक्कम: <strong className="text-rose-700 font-bold">₹ {fmtCurrency(totalDeletedSum)}</strong>
                  </span>
                </>
              ) : reportType === 'MigratedFD' ? (
                <>
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                    स्थलांतरित खाती: <strong className="text-primary font-bold">{filteredData.length}</strong>
                  </span>
                  <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
                    एकूण ठेव मुद्दल: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalDepositSum)}</strong>
                  </span>
                  <span className="bg-blue-50 px-2 py-0.5 rounded text-blue-800 border border-blue-200">
                    एकूण मुदतपूर्ती: <strong className="text-blue-700 font-bold">₹ {fmtCurrency(totalMaturitySum)}</strong>
                  </span>
                  <span className="bg-amber-50 px-2 py-0.5 rounded text-amber-800 border border-amber-200">
                    साचलेले जुने व्याज: <strong className="text-amber-700 font-bold">₹ {fmtCurrency(totalLegacyAccruedSum)}</strong>
                  </span>
                </>
              ) : (
                <>
                  {selectedSchemeId > 0 && (
                    <span className="bg-primary/10 px-2 py-0.5 rounded text-primary font-bold border border-primary/20">
                      योजना: {schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeName}
                    </span>
                  )}
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                    एकूण खाती: <strong className="text-primary font-bold">{filteredData.length}</strong>
                  </span>
                  <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
                    एकूण मुदत ठेव: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalDepositSum)}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {reportType === 'AccrualProvision' ? (
        <FdAccrualPosting />
      ) : reportType === 'CustomerSummary' ? (
        <FdCustomerSummaryReport initialBranchId={branchID} initialAsOfDate={asOfDate} onNavigate={onNavigate} />
      ) : (
        /* Main Printable A4 Document Frame */
        <div 
          ref={reportRef} 
          className="print-area bg-white mx-auto max-w-5xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between text-xs"
        >
          <div>
            
            {/* Official Bank Header Box (Exact Reference Format) */}
            <div className="border border-gray-900 p-3 relative text-center">
              
              {/* Registration Top Bar */}
              <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
                <div>
                  <span>रजि. नं. - </span>
                  <span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span>
                </div>
                <div>
                  <span>रजि. दि. - </span>
                  <span className="font-mono">{sansthaDetail?.registrationDate ? formatDisplayDate(sansthaDetail.registrationDate) : '-'}</span>
                </div>
              </div>

              {/* Central Sanstha Name */}
              <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
                {sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h1>

              {/* Subtitle / Address */}
              <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
                {sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
              </p>
            </div>

            {/* Report Title Banner Section */}
            <div className="mt-3 mb-2 flex items-center justify-between">
              <div className="w-28 hidden sm:block"></div>

              {/* Title Banner Box */}
              <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs text-center">
                <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif">
                  {getReportTitle()}
                </h2>
                {selectedSchemeId > 0 ? (
                  <div className="text-xs font-bold text-primary mt-0.5 font-mono">
                    [ योजना: {schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeName} {schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeCode ? `(${schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeCode})` : ''} ]
                  </div>
                ) : (
                  reportType !== 'CustomerSummary' && (
                    <div className="text-[11px] font-semibold text-gray-600 mt-0.5">
                      ( सर्व मुदत ठेव योजना एकत्रित )
                    </div>
                  )
                )}
                {reportType === 'CustomerSummary' && (
                  <div className="text-xs font-bold text-gray-800 mt-0.5">
                    ( दि. {formatDisplayDate(asOfDate)} अखेर )
                  </div>
                )}
              </div>

              {/* Date Tag on Right */}
              <div className="text-right text-xs font-bold text-gray-800">
                <span>दिनांक : </span>
                <span className="font-mono">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Customer / FD Account Ledger View */}
            {reportType === 'MemberLedger' && !customerLedger && (
              <div className="py-16 text-center text-gray-500 font-medium border border-dashed border-gray-300 rounded my-4 bg-gray-50/50">
                <Search size={32} className="mx-auto mb-2 text-gray-400 opacity-60" />
                <p className="text-sm font-bold text-gray-700">खातावणी पाहण्यासाठी कृपया वरील सर्च बॉक्समधून खातेदार निवडा.</p>
                <p className="text-xs text-gray-400 mt-1">(Please select a customer from the search box above to view FD ledger statement)</p>
              </div>
            )}

            {reportType === 'MemberLedger' && customerLedger && (
              <div className="space-y-4">
                <div className="border border-gray-900 p-2.5 my-2 bg-gray-50/50 rounded-xs text-[11px]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-gray-500 block text-[10px]">खातेदाराचे नाव:</span>
                      <strong className="text-gray-950">{customerLedger.customerName}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">ग्राहक क्र. (CIF):</span>
                      <strong className="text-primary font-mono">{customerLedger.cifNo || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">एकूण FD खाती:</span>
                      <strong className="text-gray-900 font-mono">{customerLedger.totalFDAccountsCount}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">एकूण मुदत ठेव गुंतवणूक:</span>
                      <strong className="text-emerald-800 font-mono">₹ {fmtCurrency(customerLedger.totalPrincipalInvested)}</strong>
                    </div>
                  </div>
                </div>

                {customerLedger.accounts.map((acc, aIdx) => (
                  <div key={acc.fdAccountID || aIdx} className="border border-gray-900 p-2.5 rounded-xs mt-3">
                    <div className="flex justify-between items-center bg-gray-100 p-1.5 border-b border-gray-900 font-bold text-xs mb-2">
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

                    <table className="w-full border-collapse border border-gray-900 text-xs">
                      <thead>
                        <tr className="bg-gray-50 font-bold border-b border-gray-900">
                          <th className="border border-gray-900 p-1 text-center">तारीख</th>
                          <th className="border border-gray-900 p-1 text-center">व्हाउचर क्र.</th>
                          <th className="border border-gray-900 p-1 text-left">तपशील</th>
                          <th className="border border-gray-900 p-1 text-right">रक्कम (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acc.transactions.map((tx, tIdx) => (
                          <tr key={tIdx} className="text-[11px]">
                            <td className="border border-gray-900 p-1 text-center font-mono">{formatDisplayDate(tx.transactionDate)}</td>
                            <td className="border border-gray-900 p-1 text-center font-mono">{tx.voucherNo || '-'}</td>
                            <td className="border border-gray-900 p-1">{tx.narration || tx.transactionType}</td>
                            <td className="border border-gray-900 p-1 text-right font-mono font-bold">{fmtCurrency(tx.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* FD Voucher Passing Table */}
            {reportType === 'VoucherPassing' && (
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse border border-gray-900 text-xs">
                  <thead>
                    <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                      <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">#</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-center font-mono">व्हाउचर क्र.</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-center">तारीख</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-left">व्यवहार प्रकार</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[12%] text-center font-mono">FD पावती क्र.</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-left">खातेदाराचे नाव</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[13%] text-right font-extrabold">रक्कम (₹)</th>
                      <th className="border border-gray-900 py-1.5 px-1 w-[6%] text-center font-mono">स्क्रॉल</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[9%] text-center">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          व्हाउचर पासिंग माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                        </td>
                      </tr>
                    ) : filteredVoucherPassing.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          निवडलेल्या फिल्टरनुसार कोणतेही मुदत ठेव व्हाउचर सापडले नाही.
                        </td>
                      </tr>
                    ) : (
                      filteredVoucherPassing.map((v, idx) => (
                        <tr key={v.voucherID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-blue-900">{v.voucherNo}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(v.voucherDate)}</td>
                          <td className="border border-gray-900 py-1 px-2">
                            <span className="font-semibold">{v.transactionType}</span>
                            {v.narration && <span className="block text-[10px] text-gray-500 truncate max-w-[200px]" title={v.narration}>{v.narration}</span>}
                          </td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-800">{v.accountNo || '-'}</td>
                          <td className="border border-gray-900 py-1 px-2 font-medium">{v.customerName || '-'}</td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(v.totalAmount)}</td>
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono">{v.scrollNo || '-'}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${v.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                              {v.status === 'Approved' ? 'मंजूर' : (v.status === 'Pending' ? 'प्रलंबित' : v.status)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredVoucherPassing.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                        <td colSpan={6} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                          एकूण व्हाउचर रक्कम बेरीज (Total):
                        </td>
                        <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                          ₹ {fmtCurrency(totalVoucherPassingSum)}
                        </td>
                        <td colSpan={2} className="border border-gray-900 py-1.5 px-2 text-center"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* FD Deleted Entries & Rollback Table */}
            {reportType === 'DeletedEntries' && (
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse border border-gray-900 text-xs">
                  <thead>
                    <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                      <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">#</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[13%] text-center">रद्द दिनांक & वेळ</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-left">रद्द नोंद प्रकार</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[13%] text-center font-mono">FD पावती क्र.</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[13%] text-center font-mono">व्हाउचर क्र.</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-right font-extrabold">रक्कम (₹)</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[9%] text-center">रद्दकर्ता</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-center">पावती रोलबॅक</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-left">तपशील / शेरा</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          रद्द नोंदी माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                        </td>
                      </tr>
                    ) : filteredDeletedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          कोणतीही थेट रद्द केलेली नोंद आढळली नाही.
                        </td>
                      </tr>
                    ) : (
                      filteredDeletedEntries.map((d, idx) => (
                        <tr key={d.logID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono text-[10px]">{d.deletedDate}</td>
                          <td className="border border-gray-900 py-1 px-2 font-semibold">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${d.typeBadge === 'ठेव अर्ज रद्द' ? 'bg-rose-100 text-rose-800' : 'bg-purple-100 text-purple-800'}`}>
                              {d.deleteType}
                            </span>
                          </td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-900">{d.accountNo || '-'}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-blue-900">{d.voucherNo || '-'}</td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-rose-800">{fmtCurrency(d.amount)}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-medium">{d.deletedBy}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center text-[10px]">
                            <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${d.rollbackInfo.includes('-१') ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-gray-100 text-gray-700'}`}>
                              {d.rollbackInfo}
                            </span>
                          </td>
                          <td className="border border-gray-900 py-1 px-2 text-[10px] text-gray-600 truncate max-w-[160px]" title={d.reasonOrDetails}>
                            {d.reasonOrDetails}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredDeletedEntries.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                        <td colSpan={5} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                          एकूण रद्द रक्कम बेरीज (Total):
                        </td>
                        <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-rose-900 bg-rose-100/50">
                          ₹ {fmtCurrency(totalDeletedSum)}
                        </td>
                        <td colSpan={3} className="border border-gray-900 py-1.5 px-2 text-center"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Migrated FD Accounts Table (स्थलांतरित मुदत ठेव यादी - Pure Customer-First Architecture) */}
            {reportType === 'MigratedFD' && (
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse border border-gray-900 text-xs">
                  <thead>
                    <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                      <th className="border border-gray-900 py-1.5 px-1 w-[3%] text-center">#</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-center font-mono">नवीन पावती</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-center font-mono">जुनी पावती</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-center font-mono">CIF नं.</th>
                      <th className="border border-gray-900 py-1.5 px-3 text-left">खातेदाराचे नाव</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-left">योजना</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-center">ठेव दिनांक</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-center">कालावधी</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-right font-extrabold">ठेव मुद्दल (₹)</th>
                      <th className="border border-gray-900 py-1.5 px-1 text-center">व्याज %</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-center">मुदतपूर्ती दिनांक</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-right font-bold">मुदतपूर्ती (₹)</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-right font-medium">मागील व्याज (₹)</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-center">शेवटची व्याज तारीख</th>
                      <th className="border border-gray-900 py-1.5 px-2 text-left">वारसदार</th>
                      <th className="border border-gray-900 py-1.5 px-1 text-center">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={16} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          स्थलांतरित मुदत ठेव यादी लोड होत आहे, कृपया प्रतीक्षा करा...
                        </td>
                      </tr>
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          कोणतीही स्थलांतरित मुदत ठेव नोंद आढळली नाही.
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row, idx) => (
                        <tr key={row.fdAccountID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-primary">{row.accountNo}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-semibold text-amber-900">
                            {row.legacyAccountNumber ? (
                              <span className="bg-amber-50 text-amber-900 px-1 py-0.5 rounded border border-amber-300">
                                {row.legacyAccountNumber}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-blue-900">
                            {row.cifNo || '-'}
                          </td>
                          <td className="border border-gray-900 py-1 px-3 text-left font-bold text-gray-950">
                            {row.customerName || row.memberName}
                          </td>
                          <td className="border border-gray-900 py-1 px-2 text-gray-700">{row.schemeName}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.openingDate)}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono text-[10px]">
                            {row.durationValue && row.durationValue > 0
                              ? `${row.durationValue} ${row.durationType === 'Days' ? 'दिवस' : row.durationType === 'Years' ? 'वर्षे' : 'महिने'}`
                              : (row.durationInDays && row.durationInDays > 0 ? `${row.durationInDays} दिवस` : '-')}
                          </td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(row.depositAmount)}</td>
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono">{row.interestRate}%</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.maturityDate)}</td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-blue-900">{fmtCurrency(row.maturityAmount)}</td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-medium text-amber-800">{fmtCurrency(row.legacyAccruedInt)}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono text-[10px] text-blue-700">
                            {formatDisplayDate(row.lastInterestPostingDate)}
                          </td>
                          <td className="border border-gray-900 py-1 px-2 text-left text-[10px]">
                            {row.nomineeName ? (
                              <span>
                                {row.nomineeName} {row.nomineeRelation ? `(${row.nomineeRelation})` : ''}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="border border-gray-900 py-1 px-1 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-700 border border-gray-300'
                            }`}>
                              {row.status === 'Active' ? 'Active' : row.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredData.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                        <td colSpan={8} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                          {selectedSchemeId > 0 
                            ? `एकूण स्थलांतरित बेरीज (${schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeName || 'योजना'} - ${filteredData.length} खाती):`
                            : `एकूण स्थलांतरित बेरीज (${filteredData.length} खाती):`}
                        </td>
                        <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                          ₹ {fmtCurrency(totalDepositSum)}
                        </td>
                        <td colSpan={2} className="border border-gray-900 py-1.5 px-2 text-center"></td>
                        <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/50">
                          ₹ {fmtCurrency(totalMaturitySum)}
                        </td>
                        <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-amber-950 bg-amber-100/50">
                          ₹ {fmtCurrency(totalLegacyAccruedSum)}
                        </td>
                        <td colSpan={3} className="border border-gray-900 py-1.5 px-2 text-center"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Customer-wise FD Summary Report (मुदतबंद ठेव यादी - Dual-Column Exact Format) */}
            {reportType === 'CustomerSummary' && (
              <div className="mt-3">
                {/* Mode toggle for web screen only (Dual Column vs Detailed) */}
                <div className="no-print flex flex-wrap justify-between items-center bg-blue-50 border border-blue-200 p-2 rounded mb-3 text-xs gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-900">मांडणी पर्याय (View Layout):</span>
                    <button
                      type="button"
                      onClick={() => setSummaryViewMode('DualColumn')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                        summaryViewMode === 'DualColumn' 
                          ? 'bg-blue-700 text-white shadow-xs' 
                          : 'bg-white text-blue-800 border border-blue-300 hover:bg-blue-100'
                      }`}
                    >
                      ड्युअल-कॉलम मुद्रण नमुना (२ स्तंभी - Print Layout)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryViewMode('Detailed')}
                      className={`px-2.5 py-1 rounded font-bold cursor-pointer transition-all ${
                        summaryViewMode === 'Detailed' 
                          ? 'bg-blue-700 text-white shadow-xs' 
                          : 'bg-white text-blue-800 border border-blue-300 hover:bg-blue-100'
                      }`}
                    >
                      तपशीलवार पावती यादी (Interactive Drilldown)
                    </button>
                  </div>
                  <div className="text-blue-950 font-bold">
                    एकूण खातेदार: <span className="font-mono text-primary text-sm">{filteredCustomerSummary.length}</span> | 
                    एकूण ठेव रक्कम: <span className="font-mono text-emerald-700 text-sm">₹ {fmtCurrency(totalCustomerSummaryDeposit)}</span>
                  </div>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-gray-500 font-semibold border border-gray-900">
                    मुदतबंद ठेव यादी लोड होत आहे, कृपया प्रतीक्षा करा...
                  </div>
                ) : filteredCustomerSummary.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-semibold border border-gray-900">
                    कोणतीही मुदतबंद ठेव नोंद आढळली नाही.
                  </div>
                ) : (
                  <>
                    {/* Dual-Column Print Format (Always active in Print mode, and displayed on screen when DualColumn is selected) */}
                    <div className={`${summaryViewMode === 'Detailed' ? 'hidden print:block' : 'block'}`}>
                      {(() => {
                        const half = Math.ceil(filteredCustomerSummary.length / 2);
                        const leftRows = filteredCustomerSummary.slice(0, half);
                        const rightRows = filteredCustomerSummary.slice(half);

                        return (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse border-2 border-gray-950 text-xs">
                              <thead>
                                <tr className="bg-gray-100 text-gray-950 border-b-2 border-gray-950 text-center font-bold text-[11px]">
                                  {/* Left Column Header */}
                                  <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">अ.नं.</th>
                                  <th className="border border-gray-900 py-1.5 px-1.5 w-[7%] text-center font-mono">खाते नं.</th>
                                  <th className="border border-gray-900 py-1.5 px-2.5 w-[25%] text-left">खातेदाराचे नाव</th>
                                  <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-right font-extrabold">रक्कम</th>
                                  
                                  {/* Divider / Right Column Header */}
                                  <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center border-l-2 border-l-gray-950">अ.नं.</th>
                                  <th className="border border-gray-900 py-1.5 px-1.5 w-[7%] text-center font-mono">खाते नं.</th>
                                  <th className="border border-gray-900 py-1.5 px-2.5 w-[25%] text-left">खातेदाराचे नाव</th>
                                  <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-right font-extrabold">रक्कम</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Array.from({ length: half }).map((_, i) => {
                                  const left = leftRows[i];
                                  const right = rightRows[i];
                                  return (
                                    <tr key={`dual-row-${i}`} className="hover:bg-slate-50 text-gray-900 text-[11px] leading-tight">
                                      {/* Left cell */}
                                      <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">
                                        {i + 1}
                                      </td>
                                      <td className="border border-gray-900 py-1 px-1.5 text-center font-mono font-bold text-gray-900">
                                        {left ? (left.cifNo || left.accountNo) : ''}
                                      </td>
                                      <td className="border border-gray-900 py-1 px-2.5 text-left font-medium truncate max-w-[200px]" title={left?.customerName}>
                                        {left ? left.customerName : ''}
                                      </td>
                                      <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-gray-950">
                                        {left ? Number(left.depositAmount).toFixed(2) : ''}
                                      </td>

                                      {/* Right cell */}
                                      <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium border-l-2 border-l-gray-950">
                                        {right ? half + i + 1 : ''}
                                      </td>
                                      <td className="border border-gray-900 py-1 px-1.5 text-center font-mono font-bold text-gray-900">
                                        {right ? (right.cifNo || right.accountNo) : ''}
                                      </td>
                                      <td className="border border-gray-900 py-1 px-2.5 text-left font-medium truncate max-w-[200px]" title={right?.customerName}>
                                        {right ? right.customerName : ''}
                                      </td>
                                      <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-gray-950">
                                        {right ? Number(right.depositAmount).toFixed(2) : ''}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-950 text-xs">
                                  <td colSpan={3} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                                    एकूण खातेदार: <strong className="font-mono">{filteredCustomerSummary.length}</strong>
                                  </td>
                                  <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-gray-950">
                                    ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                                  </td>
                                  <td colSpan={3} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider border-l-2 border-l-gray-950">
                                    एकूण ठेवी: <strong className="font-mono">{totalCustomerSummaryFdCount}</strong>
                                  </td>
                                  <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-gray-950">
                                    ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Detailed Drilldown Table (Interactive Web View only) */}
                    <div className={`no-print ${summaryViewMode === 'Detailed' ? 'block' : 'hidden'}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-900 text-xs">
                          <thead>
                            <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                              <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">तपशील</th>
                              <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">अ.नं.</th>
                              <th className="border border-gray-900 py-1.5 px-2 w-[12%] text-center font-mono">खाते / CIF क्र.</th>
                              <th className="border border-gray-900 py-1.5 px-3 w-[28%] text-left">खातेदाराचे नाव</th>
                              <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-center">एकूण ठेवी</th>
                              <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right font-extrabold">एकूण ठेव रक्कम (₹)</th>
                              <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-right font-bold">एकूण मुदतपूर्ती (₹)</th>
                              <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-center font-mono">मोबाईल नं.</th>
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
                                    className="hover:bg-blue-50/50 cursor-pointer text-gray-900 text-[11px] border-b border-gray-300"
                                  >
                                    <td className="border border-gray-900 py-1 px-1 text-center">
                                      <button 
                                        type="button"
                                        className="w-5 h-5 inline-flex items-center justify-center rounded bg-gray-100 hover:bg-primary hover:text-white font-bold text-xs"
                                      >
                                        {isExpanded ? '−' : '+'}
                                      </button>
                                    </td>
                                    <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                                    <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-primary">
                                      {cust.cifNo || cust.accountNo}
                                    </td>
                                    <td className="border border-gray-900 py-1 px-3 text-left font-bold text-gray-950">
                                      {cust.customerName}
                                    </td>
                                    <td className="border border-gray-900 py-1 px-2 text-center">
                                      <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold text-[10px] font-mono">
                                        {cust.fdCount} {cust.fdCount > 1 ? 'ठेवी' : 'ठेव'}
                                      </span>
                                    </td>
                                    <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800 text-xs">
                                      ₹ {fmtCurrency(cust.depositAmount)}
                                    </td>
                                    <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-blue-900">
                                      ₹ {fmtCurrency(cust.maturityAmount)}
                                    </td>
                                    <td className="border border-gray-900 py-1 px-2 text-center font-mono text-[10px] text-gray-600">
                                      {cust.mobileNo || '-'}
                                    </td>
                                  </tr>

                                  {/* Sub-table with individual receipts */}
                                  {isExpanded && (
                                    <tr className="bg-slate-50 border-b-2 border-gray-400">
                                      <td colSpan={8} className="p-3 border border-gray-900">
                                        <div className="bg-white p-2.5 rounded border border-gray-300 shadow-2xs">
                                          <div className="flex justify-between items-center text-xs font-bold text-gray-800 mb-1.5 pb-1 border-b">
                                            <span>{cust.customerName} - वैयक्तिक मुदत ठेव पावत्या तपशील:</span>
                                            <span className="text-primary font-mono">एकूण ठेवी: {cust.fdCount} | एकूण रक्कम: ₹ {fmtCurrency(cust.depositAmount)}</span>
                                          </div>
                                          <table className="w-full border-collapse border border-gray-300 text-[11px]">
                                            <thead>
                                              <tr className="bg-gray-100 text-gray-800 text-center font-bold">
                                                <th className="border border-gray-300 p-1">पावती क्र.</th>
                                                <th className="border border-gray-300 p-1 text-left">योजना</th>
                                                <th className="border border-gray-300 p-1">ठेव तारीख</th>
                                                <th className="border border-gray-300 p-1 text-right">ठेव रक्कम (₹)</th>
                                                <th className="border border-gray-300 p-1">व्याज दर %</th>
                                                <th className="border border-gray-300 p-1">मुदतपूर्ती तारीख</th>
                                                <th className="border border-gray-300 p-1 text-right">मुदतपूर्ती रक्कम (₹)</th>
                                                <th className="border border-gray-300 p-1">स्थिती</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {cust.accounts.map((acc, aIdx) => (
                                                <tr key={acc.fdAccountID || aIdx} className="hover:bg-amber-50/50">
                                                  <td className="border border-gray-300 p-1 text-center font-mono font-bold text-primary">
                                                    {acc.accountNo}
                                                    {acc.legacyAccountNumber && (
                                                      <span className="text-[10px] text-amber-900 bg-amber-50 px-1 rounded border border-amber-300 ml-1">
                                                        {acc.legacyAccountNumber}
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="border border-gray-300 p-1 text-left">{acc.schemeName}</td>
                                                  <td className="border border-gray-300 p-1 text-center font-mono">{formatDisplayDate(acc.openingDate)}</td>
                                                  <td className="border border-gray-300 p-1 text-right font-mono font-bold text-emerald-800">
                                                    ₹ {fmtCurrency(acc.depositAmount)}
                                                  </td>
                                                  <td className="border border-gray-300 p-1 text-center font-mono">{acc.interestRate}%</td>
                                                  <td className="border border-gray-300 p-1 text-center font-mono">{formatDisplayDate(acc.maturityDate)}</td>
                                                  <td className="border border-gray-300 p-1 text-right font-mono font-bold text-blue-900">
                                                    ₹ {fmtCurrency(acc.maturityAmount)}
                                                  </td>
                                                  <td className="border border-gray-300 p-1 text-center">
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
                            <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                              <td colSpan={4} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                                एकूण बेरीज (Grand Total - {filteredCustomerSummary.length} खातेदार):
                              </td>
                              <td className="border border-gray-900 py-1.5 px-2 text-center font-mono font-bold text-primary">
                                {totalCustomerSummaryFdCount} ठेवी
                              </td>
                              <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                                ₹ {fmtCurrency(totalCustomerSummaryDeposit)}
                              </td>
                              <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-blue-950 bg-blue-100/50">
                                ₹ {fmtCurrency(totalCustomerSummaryMaturity)}
                              </td>
                              <td className="border border-gray-900 py-1.5 px-2 text-center"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Standard FD Table (Register, Outstanding, Maturity Due) */}
            {reportType !== 'MemberLedger' && reportType !== 'VoucherPassing' && reportType !== 'DeletedEntries' && reportType !== 'MigratedFD' && reportType !== 'CustomerSummary' && (
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse border border-gray-900 text-xs">
                  <thead>
                    <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                      <th className="border border-gray-900 py-1.5 px-1 w-[4%] text-center">#</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[13%] text-center">FD पावती क्र.</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-center font-mono">CIF नं.</th>
                      <th className="border border-gray-900 py-1.5 px-3 w-[23%] text-left">खातेदाराचे नाव</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[13%] text-left">योजना</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-center">ठेव दिनांक</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[13%] text-right font-extrabold">ठेव रक्कम (₹)</th>
                      <th className="border border-gray-900 py-1.5 px-1 w-[5%] text-center">व्याज %</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[10%] text-center">मुदतपूर्ती दिनांक</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                        </td>
                      </tr>
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          कोणतीही मुदत ठेव नोंद आढळली नाही.
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row, idx) => (
                        <tr key={row.fdAccountID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono text-gray-900">
                            <span className="font-bold text-gray-900">{row.accountNo}</span>
                            {row.legacyAccountNumber && (
                              <div className="text-[10px] text-amber-900 font-semibold bg-amber-50 px-1 rounded border border-amber-300 inline-block mt-0.5" title="जुना पावती क्र. (Legacy Receipt No)">
                                जुनी पावती: {row.legacyAccountNumber}
                              </div>
                            )}
                          </td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-blue-900">
                            {row.cifNo || '-'}
                          </td>
                          <td className="border border-gray-900 py-1 px-3 font-medium">{row.customerName || row.memberName}</td>
                          <td className="border border-gray-900 py-1 px-2 text-gray-700">{row.schemeName}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.openingDate)}</td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(row.depositAmount)}</td>
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono">{row.interestRate}%</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.maturityDate)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredData.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                        <td colSpan={6} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                          {selectedSchemeId > 0 
                            ? `एकूण मुदत ठेव बेरीज (${schemes.find(s => s.fdSchemeID === selectedSchemeId)?.schemeName || 'निवडलेली योजना'} - ${filteredData.length} खाती):`
                            : `एकूण मुदत ठेव बेरीज (सर्व योजना - ${filteredData.length} खाती):`}
                        </td>
                        <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                          ₹ {fmtCurrency(totalDepositSum)}
                        </td>
                        <td colSpan={2} className="border border-gray-900 py-1.5 px-2 text-center"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

          </div>

          {/* Verification Signatures Section */}
          <div className="mt-14 pt-4 border-t border-dashed border-gray-400 grid grid-cols-3 text-center text-xs font-bold text-gray-900">
            <div>
              <div className="h-10"></div>
              <p className="border-t border-gray-800 mx-4 pt-1">लिपिक / रोखपाल</p>
              <span className="text-[10px] text-gray-500 font-normal">(Clerk / Cashier)</span>
            </div>

            <div>
              <div className="h-10"></div>
              <p className="border-t border-gray-800 mx-4 pt-1">लेखापाल / ठेव तपासनीस</p>
              <span className="text-[10px] text-gray-500 font-normal">(Accountant / Inspector)</span>
            </div>

            <div>
              <div className="h-10"></div>
              <p className="border-t border-gray-800 mx-4 pt-1">शाखा व्यवस्थापक / मानद सचिव</p>
              <span className="text-[10px] text-gray-500 font-normal">(Manager / Secretary)</span>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

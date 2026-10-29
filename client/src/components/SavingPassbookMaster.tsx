import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Select from 'react-select';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { 
  BookOpen, 
  FileText, 
  Layers, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  CheckCircle,
  PiggyBank,
  UserCheck
} from 'lucide-react';

interface SavingAccountSummary {
  savingAccountID: number;
  accountNo: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  cifNo?: string;
  customerID?: number;
  customerName?: string;
  currentBalance: number;
  status?: string;
  ledgerName?: string;
}

interface SavingAccountFullDetails {
  savingAccountID: number;
  branchID?: number;
  branchName?: string;
  branchCode?: string;
  accountNo: string;
  formattedAccountNo?: string;
  previousAccountNo?: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  savingSchemeID?: number;
  schemeName?: string;
  customerID?: number;
  cifNo?: string;
  customerName?: string;
  customerNameEng?: string;
  address?: string;
  mobileNo?: string;
  aadhaarNo?: string;
  panNo?: string;
  accountType?: string;
  openingDate?: string;
  currentBalance?: number;
  openingBalance?: number;
  minimumBalance?: number;
  lienAmount?: number;
  availableBalance?: number;
  interestRate?: number;
  status?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineeAddress?: string;
  jointHolders?: Array<{
    jointHolderID: number;
    customerID?: number;
    cifNo?: string;
    customerName?: string;
    mobileNo?: string;
  }>;
}

interface SavingTransaction {
  transactionID: number;
  transactionDate: string;
  transactionType: string;
  paymentMode?: string;
  amount: number;
  balanceAfterTxn: number;
  narration?: string;
  voucherNo?: string;
  chequeNo?: string;
  isPrintedOnPassbook?: boolean | number;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const SavingPassbookMaster: React.FC = () => {
  const [accounts, setAccounts] = useState<SavingAccountSummary[]>([]);
  const [selectedAccountSummary, setSelectedAccountSummary] = useState<SavingAccountSummary | null>(null);
  const [accountDetails, setAccountDetails] = useState<SavingAccountFullDetails | null>(null);
  const [transactions, setTransactions] = useState<SavingTransaction[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  // Print & Filter state
  const [printMode, setPrintMode] = useState<'statement' | 'cover'>('statement');
  const [statementPrintType, setStatementPrintType] = useState<'standard-cbs' | 'passbook-booklet'>('standard-cbs');
  const [filterType, setFilterType] = useState<'all' | 'unprinted' | 'date_range'>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [startingLine, setStartingLine] = useState<number>(1);
  const [pageNo, setPageNo] = useState<number>(1);

  const [loading, setLoading] = useState(false);
  const [markingPrinted, setMarkingPrinted] = useState(false);
  const [markedSuccess, setMarkedSuccess] = useState(false);
  const [error, setError] = useState('');

  const API_URL = '/api';

  useEffect(() => {
    fetchSansthaDetails();
    fetchAccounts();

    // Default dates to current financial year
    const today = new Date();
    let startYear = today.getFullYear();
    if (today.getMonth() < 3) {
      startYear -= 1;
    }
    const start = new Date(startYear, 3, 1);
    setFromDate(start.toISOString().split('T')[0]);
    setToDate(today.toISOString().split('T')[0]);
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const res = await axios.get(`${API_URL}/SansthaDetails`);
      if (res.data) {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSansthaDetail(res.data[0]);
        } else if (!Array.isArray(res.data)) {
          setSansthaDetail(res.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load Sanstha details in passbook', err);
    }
  };

  const loadAccountFullDetailsAndTxns = async (accId: number) => {
    setLoading(true);
    setError('');
    setMarkedSuccess(false);

    try {
      const [accRes, txRes] = await Promise.all([
        axios.get(`${API_URL}/SavingAccounts/${accId}`).catch(() => null),
        axios.get(`${API_URL}/SavingTransactions/account/${accId}`).catch(() => null)
      ]);

      if (accRes && accRes.data) {
        setAccountDetails(accRes.data);
      }
      if (txRes && txRes.data) {
        setTransactions(txRes.data);
      }
    } catch (err) {
      console.error('Error fetching account details / transactions', err);
      setError('खात्याचे तपशील किंवा व्यवहार लोड करता आले नाहीत.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      let customerIdStr = params.get('customerId') || params.get('customerID');
      let accountIdStr = params.get('accountId') || params.get('savingAccountId');

      if (!customerIdStr && !accountIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
              accountIdStr = bridgeData.savingAccountId || bridgeData.accountId ? String(bridgeData.savingAccountId || bridgeData.accountId) : null;
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      let fastTrackDone = false;
      const targetAccId = accountIdStr ? parseInt(accountIdStr, 10) : 0;
      const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;

      // ⚡ FAST-TRACK 1: Direct targeted account ID lookup (~15-20ms)
      if (targetAccId > 0) {
        try {
          const singleRes = await axios.get(`${API_URL}/SavingAccounts/${targetAccId}`);
          if (singleRes.data && singleRes.data.savingAccountID) {
            const acc = singleRes.data;
            setSelectedAccountSummary(acc);
            setAccountDetails(acc);
            setAccounts([acc]);
            fastTrackDone = true;
            loadAccountFullDetailsAndTxns(acc.savingAccountID);
          }
        } catch (e) {
          console.warn('Fast-track account lookup failed, falling back', e);
        }
      }
      // ⚡ FAST-TRACK 2: Direct targeted customer ID lookup (~20-30ms)
      else if (cId > 0) {
        try {
          const custRes = await axios.get(`${API_URL}/SavingAccounts?customerId=${cId}`);
          const list = Array.isArray(custRes.data) ? custRes.data : [custRes.data];
          if (list.length > 0) {
            setSelectedAccountSummary(list[0]);
            setAccounts(list);
            fastTrackDone = true;
            loadAccountFullDetailsAndTxns(list[0].savingAccountID);
          }
        } catch (e) {
          console.warn('Fast-track customer lookup failed, falling back', e);
        }
      }

      if (!fastTrackDone) {
        const response = await axios.get(`${API_URL}/SavingAccounts`);
        setAccounts(response.data || []);
      } else {
        // Load background dropdown lazily
        axios.get(`${API_URL}/SavingAccounts`).then(res => {
          if (Array.isArray(res.data)) {
            setAccounts(prev => {
              const map = new Map<number, any>();
              prev.forEach(a => map.set(a.savingAccountID, a));
              res.data.forEach((a: any) => map.set(a.savingAccountID, a));
              return Array.from(map.values());
            });
          }
        }).catch(e => console.error(e));
      }
    } catch (err) {
      console.error('Error fetching accounts', err);
    }
  };

  const handleAccountSelect = (selectedOption: any) => {
    if (!selectedOption) {
      setSelectedAccountSummary(null);
      setAccountDetails(null);
      setTransactions([]);
      return;
    }

    const accountId = parseInt(selectedOption.value, 10);
    const acc = accounts.find(a => a.savingAccountID === accountId) || null;
    setSelectedAccountSummary(acc);
    if (acc) {
      loadAccountFullDetailsAndTxns(acc.savingAccountID);
    }
  };

  // Filter transactions based on filterType
  const displayedTransactions = transactions.filter(t => {
    if (filterType === 'unprinted') {
      return !t.isPrintedOnPassbook;
    }
    if (filterType === 'date_range') {
      const txDate = t.transactionDate ? t.transactionDate.split('T')[0] : '';
      if (fromDate && txDate < fromDate) return false;
      if (toDate && txDate > toDate) return false;
      return true;
    }
    return true; // 'all'
  });

  const totalDeposit = displayedTransactions
    .filter(t => t.transactionType === 'Deposit' || t.transactionType === 'Interest' || t.amount > 0 && t.transactionType !== 'Withdrawal')
    .reduce((sum, t) => sum + (t.transactionType !== 'Withdrawal' && t.transactionType !== 'Charges' ? t.amount : 0), 0);

  const totalWithdrawal = displayedTransactions
    .filter(t => t.transactionType === 'Withdrawal' || t.transactionType === 'Charges')
    .reduce((sum, t) => sum + t.amount, 0);

  const latestBalance = displayedTransactions.length > 0 
    ? displayedTransactions[displayedTransactions.length - 1].balanceAfterTxn 
    : (accountDetails?.currentBalance || selectedAccountSummary?.currentBalance || 0);

  const openingBalance = accountDetails?.openingBalance || 0;

  // Excel Export
  const handleExportExcel = () => {
    if (printMode === 'cover') {
      if (!accountDetails) {
        alert('माहिती उपलब्ध नाही.');
        return;
      }
      const coverData = [
        { 'तपशील (Particular)': 'संस्थेचे नाव', 'माहिती (Details)': sansthaDetail?.sansthaName || '' },
        { 'तपशील (Particular)': 'शाखा', 'माहिती (Details)': accountDetails.branchName || '' },
        { 'तपशील (Particular)': 'बचत खाते क्रमांक', 'माहिती (Details)': accountDetails.accountNo },
        { 'तपशील (Particular)': 'CIF क्रमांक', 'माहिती (Details)': accountDetails.cifNo || '' },
        { 'तपशील (Particular)': 'खातेदाराचे नाव', 'माहिती (Details)': accountDetails.customerName || '' },
        { 'तपशील (Particular)': 'खातेदाराचे नाव (English)', 'माहिती (Details)': accountDetails.customerNameEng || '' },
        { 'तपशील (Particular)': 'मोबाईल क्रमांक', 'माहिती (Details)': accountDetails.mobileNo || '' },
        { 'तपशील (Particular)': 'आधार क्रमांक', 'माहिती (Details)': accountDetails.aadhaarNo || '' },
        { 'तपशील (Particular)': 'पॅन क्रमांक', 'माहिती (Details)': accountDetails.panNo || '' },
        { 'तपशील (Particular)': 'उघडल्याचा दिनांक', 'माहिती (Details)': formatDisplayDate(accountDetails.openingDate) },
        { 'तपशील (Particular)': 'योजना', 'माहिती (Details)': accountDetails.schemeName || 'बचत ठेव' },
        { 'तपशील (Particular)': 'व्याजदर', 'माहिती (Details)': `${accountDetails.interestRate || 0}%` },
        { 'तपशील (Particular)': 'किमान शिल्लक मर्यादा', 'माहिती (Details)': `₹ ${fmtCurrency(accountDetails.minimumBalance ?? 0)}` },
        { 'तपशील (Particular)': 'वारसदाराचे नाव', 'माहिती (Details)': accountDetails.nomineeName || '-' },
        { 'तपशील (Particular)': 'वारसदार नाते', 'माहिती (Details)': accountDetails.nomineeRelation || '-' },
        { 'तपशील (Particular)': 'सध्याची शिल्लक', 'माहिती (Details)': `₹ ${fmtCurrency(accountDetails.currentBalance)}` }
      ];
      const ws = XLSX.utils.json_to_sheet(coverData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'पासबुक मुखपृष्ठ');
      XLSX.writeFile(wb, `Saving_Passbook_Cover_${accountDetails.accountNo}.xlsx`);
      return;
    }

    if (displayedTransactions.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी व्यवहार नाहीत.');
      return;
    }

    const excelData = displayedTransactions.map((t, idx) => {
      const isDeposit = t.transactionType === 'Deposit' || t.transactionType === 'Interest';
      const isWithdrawal = t.transactionType === 'Withdrawal' || t.transactionType === 'Charges';
      return {
        'अ.क्र.': idx + 1,
        'दिनांक': formatDisplayDate(t.transactionDate),
        'तपशील (Particulars)': t.narration || t.transactionType,
        'व्हाउचर / संदर्भ क्र.': t.voucherNo || t.chequeNo || '-',
        'नावे (Withdrawal Dr ₹)': isWithdrawal ? t.amount : 0,
        'जमा (Deposit Cr ₹)': isDeposit ? t.amount : 0,
        'शिल्लक (Balance ₹)': t.balanceAfterTxn
      };
    });

    excelData.push({
      'अ.क्र.': '' as any,
      'दिनांक': '',
      'तपशील (Particulars)': 'एकूण बेरीज (Total):',
      'व्हाउचर / संदर्भ क्र.': '',
      'नावे (Withdrawal Dr ₹)': totalWithdrawal,
      'जमा (Deposit Cr ₹)': totalDeposit,
      'शिल्लक (Balance ₹)': latestBalance
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'पासबुक नोंदी');
    XLSX.writeFile(wb, `Saving_Passbook_${accountDetails?.accountNo || 'Statement'}.xlsx`);
  };

  // Mark transactions as printed
  const handleMarkAsPrinted = () => {
    if (displayedTransactions.length === 0) {
      alert('कोणतेही व्यवहार उपलब्ध नाहीत.');
      return;
    }
    setMarkingPrinted(true);
    // Optimistically update local transactions state
    const ids = new Set(displayedTransactions.map(t => t.transactionID));
    setTransactions(prev => prev.map(t => ids.has(t.transactionID) ? { ...t, isPrintedOnPassbook: true } : t));
    setMarkingPrinted(false);
    setMarkedSuccess(true);
    setTimeout(() => setMarkedSuccess(false), 4000);
  };

  const handlePrintTrigger = () => {
    window.print();
  };

  // Dropdown options
  const accountOptions = accounts.map(a => {
    const oldPart = (a.oldAccountNo || a.legacyAccountNumber) ? ` (जुने: ${a.oldAccountNo || a.legacyAccountNumber})` : '';
    const cifPart = a.cifNo ? ` [CIF: ${a.cifNo}]` : '';
    const namePart = a.customerName || 'अज्ञात';
    const balPart = ` - ₹${fmtCurrency(a.currentBalance)}`;
    return {
      value: a.savingAccountID.toString(),
      label: `${a.accountNo}${oldPart}${cifPart} - ${namePart}${balPart}`
    };
  });

  const selectedSelectValue = selectedAccountSummary ? {
    value: selectedAccountSummary.savingAccountID.toString(),
    label: `${selectedAccountSummary.accountNo} - ${selectedAccountSummary.customerName || ''}`
  } : null;

  // Empty rows for Booklet Offset simulation
  const emptyOffsetRows = Array.from({ length: Math.max(0, startingLine - 1) });

  // Summary Banner
  const summaryBanner = accountDetails ? (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">बचत खाते क्र.</span>
        <strong className="text-primary font-mono text-[11.5px]">{accountDetails.accountNo}</strong>
        {accountDetails.oldAccountNo && (
          <span className="text-[9.5px] text-amber-900 bg-amber-100 border border-amber-300 rounded px-1 ml-1 font-bold">
            जुने: {accountDetails.oldAccountNo}
          </span>
        )}
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">खातेदार व CIF</span>
        <strong className="text-slate-900 text-[11px] truncate block" title={accountDetails.customerName}>
          {accountDetails.customerName} {accountDetails.cifNo ? `[${accountDetails.cifNo}]` : ''}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">योजना व व्याजदर</span>
        <strong className="text-slate-900 text-[11px] truncate block">
          {accountDetails.schemeName || 'बचत ठेव'}{accountDetails.interestRate ? ` (${accountDetails.interestRate}%)` : ''}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">वारसदार (Nominee)</span>
        <strong className="text-slate-800 text-[11px] truncate block">
          {accountDetails.nomineeName ? `${accountDetails.nomineeName} (${accountDetails.nomineeRelation || '-'})` : '-'}
        </strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">चालू शिल्लक बाकी</span>
        <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(latestBalance)}</strong>
      </div>
    </div>
  ) : null;

  // Filter Toolbar Controls (Passed to CbsReportLayout)
  const filterToolbar = (
    <div className="flex flex-wrap items-center gap-1.5 w-full">
      {/* 1. Mode Switcher (Cover Page vs Statement) */}
      <div className="inline-flex rounded-xs border border-slate-300 bg-white p-0.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setPrintMode('statement')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-bold transition-all ${
            printMode === 'statement'
              ? 'bg-primary text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers size={11} />
          <span>व्यवहार छपाई (Transactions)</span>
        </button>
        <button
          type="button"
          onClick={() => setPrintMode('cover')}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-bold transition-all ${
            printMode === 'cover'
              ? 'bg-primary text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen size={11} />
          <span>मुखपृष्ठ (Cover Page)</span>
        </button>
      </div>

      {/* 2. Account Searchable Dropdown */}
      <div className="w-56 sm:w-64">
        <Select
          options={accountOptions}
          value={selectedSelectValue}
          onChange={handleAccountSelect}
          placeholder="खाते क्र. किंवा नाव शोधा..."
          isClearable
          className="text-[11px]"
          styles={{
            control: (base) => ({
              ...base,
              minHeight: '24px',
              height: '24px',
              fontSize: '11px'
            }),
            valueContainer: (base) => ({
              ...base,
              padding: '0 4px'
            }),
            input: (base) => ({
              ...base,
              margin: 0,
              padding: 0
            }),
            dropdownIndicator: (base) => ({
              ...base,
              padding: '1px'
            }),
            clearIndicator: (base) => ({
              ...base,
              padding: '1px'
            }),
            option: (base) => ({
              ...base,
              fontSize: '11px',
              padding: '3px 6px'
            })
          }}
        />
      </div>

      {/* Additional Controls for Statement Mode */}
      {printMode === 'statement' && (
        <>
          {/* Format: Standard CBS Report vs Passbook Booklet Direct */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xs px-1.5 py-0.5">
            <span className="text-[10px] text-slate-500 font-semibold">फॉरमॅट:</span>
            <select
              value={statementPrintType}
              onChange={(e: any) => setStatementPrintType(e.target.value)}
              className="text-[11px] font-bold text-slate-800 bg-transparent border-none focus:outline-none"
            >
              <option value="standard-cbs">A4/A5 लेझर प्रिंट (CBS Report)</option>
              <option value="passbook-booklet">पासबुक प्रिंटर (Booklet Dot-Matrix)</option>
            </select>
          </div>

          {/* Filter Type: All vs Unprinted vs Date Range */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xs px-1.5 py-0.5">
            <span className="text-[10px] text-slate-500 font-semibold">नोंदी:</span>
            <select
              value={filterType}
              onChange={(e: any) => setFilterType(e.target.value)}
              className="text-[11px] font-bold text-slate-800 bg-transparent border-none focus:outline-none"
            >
              <option value="all">सर्व व्यवहार (All)</option>
              <option value="unprinted">फक्त न छापलेले (Unprinted Only)</option>
              <option value="date_range">तारीख श्रेणीनुसार (Date Range)</option>
            </select>
          </div>

          {filterType === 'date_range' && (
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xs px-1.5 py-0.5">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-[10.5px] border-none focus:outline-none bg-transparent"
              />
              <span className="text-slate-400 text-[10px]">ते</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-[10.5px] border-none focus:outline-none bg-transparent"
              />
            </div>
          )}

          {/* Starting Line Offset (Especially for Booklet) */}
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xs px-1.5 py-0.5">
            <span className="text-[10px] text-slate-500 font-semibold" title="कोणत्या ओळीपासून छपाई करायची?">
              सुरुवातीची ओळ:
            </span>
            <input
              type="number"
              min="1"
              max="25"
              value={startingLine}
              onChange={(e) => setStartingLine(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-10 text-center font-bold text-[11px] text-slate-800 border border-slate-200 rounded-xs px-1 py-0"
            />
          </div>

          {/* Mark as Printed Button */}
          <button
            type="button"
            onClick={handleMarkAsPrinted}
            disabled={markingPrinted || displayedTransactions.length === 0}
            className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs text-[10.5px] font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            title="हे व्यवहार पासबुकवर छापले म्हणून नोंदवा"
          >
            <CheckCircle size={11} />
            <span>छापले म्हणून चिन्हांकित करा</span>
          </button>
        </>
      )}

      {markedSuccess && (
        <span className="text-emerald-700 text-[10.5px] font-bold flex items-center gap-1">
          ✓ छापले म्हणून नोंदवले!
        </span>
      )}
    </div>
  );

  return (
    <div className="w-full">
      {/* Passbook Booklet Print CSS Specific Overrides */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          ${statementPrintType === 'passbook-booklet' && printMode === 'statement' ? `
            .cbs-report-header,
            .cbs-title-ribbon,
            .cbs-title-badge,
            .cbs-summary-banner,
            .cbs-report-footer,
            .cbs-audit-footer,
            .cbs-signature-section,
            .cbs-toolbar,
            .no-print {
              display: none !important;
            }
            .cbs-print-container {
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
            table.passbook-booklet-table {
              width: 100% !important;
              font-family: 'Courier New', Courier, monospace !important;
              font-size: 10.5pt !important;
              line-height: 1.15 !important;
              border-collapse: collapse !important;
            }
            table.passbook-booklet-table th,
            table.passbook-booklet-table td {
              border: none !important;
              padding: 2.2mm 1.5mm !important;
            }
            table.passbook-booklet-table thead {
              display: none !important;
            }
            .booklet-offset-row {
              height: 7.5mm !important;
            }
            .booklet-offset-row td {
              visibility: hidden !important;
            }
          ` : ''}
        }
      `}} />

      <CbsReportLayout
        defaultPaperSize={printMode === 'cover' ? 'a5-portrait' : 'a4-portrait'}
        allowPaperSizeToggle={true}
        reportTitle={printMode === 'cover' ? 'बचत ठेव पासबुक - मुखपृष्ठ' : 'बचत ठेव पासबुक'}
        reportSubtitle={printMode === 'cover' ? 'Saving Deposit Passbook - First Page' : 'Saving Deposit Passbook Statement'}
        periodText={
          printMode === 'cover' 
            ? `खाते उघडल्याचा दिनांक: ${formatDisplayDate(accountDetails?.openingDate)}` 
            : (filterType === 'date_range' 
                ? `${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}` 
                : (filterType === 'unprinted' ? 'फक्त न छापलेले व्यवहार (Unprinted Only)' : 'सर्व व्यवहार नोंदी (All Transactions)'))
        }
        sansthaInfo={sansthaDetail}
        summaryBanner={summaryBanner}
        signatureTier={printMode === 'cover' ? 'none' : '3-tier'}
        signatureTitles={[
          { title: 'लिपिक / रोखपाल', subtitle: '(Clerk / Cashier)' },
          { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
          { title: 'शाखा व्यवस्थापक', subtitle: '(Branch Manager)' }
        ]}
        onExportExcel={handleExportExcel}
        onPrint={handlePrintTrigger}
        extraToolbarControls={filterToolbar}
        isLoading={loading}
        hasData={Boolean(accountDetails || selectedAccountSummary)}
        emptyState={
          <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
            <PiggyBank size={36} className="mx-auto mb-2 text-primary/40" />
            <p className="font-bold text-sm text-slate-800">कृपया बचत खाते निवडा.</p>
            <p className="text-xs text-slate-500 mt-1">
              वर दिलेल्या शोध बॉक्समधून खाते क्रमांक किंवा ग्राहकाच्या नावाने खाते निवडा.
            </p>
          </div>
        }
      >
        {/* ========================================================
            MODE 1: PASSBOOK COVER PAGE (मुखपृष्ठ / पहिले पान)
           ======================================================== */}
        {printMode === 'cover' && accountDetails && (
          <div className="bg-white border-2 border-slate-900 p-4 sm:p-6 rounded-xs max-w-3xl mx-auto shadow-xs text-slate-950">
            {/* Cover Header Banner */}
            <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
              <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-slate-950">
                {sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h2>
              <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                {sansthaDetail?.address ? `${sansthaDetail.address}, ` : ''}
                {sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}
                {sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
                {sansthaDetail?.pinCode ? ` - ${sansthaDetail.pinCode}` : ''}
              </p>
              <p className="text-[10px] text-slate-600 font-medium">
                {sansthaDetail?.registrationNo ? `नोंदणी क्र.: ${sansthaDetail.registrationNo} | ` : ''}
                {sansthaDetail?.contactNo ? `फोन: ${sansthaDetail.contactNo}` : ''}
              </p>
              <div className="mt-2 inline-block bg-slate-900 text-white px-4 py-0.5 rounded-full text-xs font-bold tracking-widest uppercase">
                बचत ठेव पासबुक (SAVING PASSBOOK)
              </div>
            </div>

            {/* Main Information Grid with Photo/Sign Box */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
              {/* Left Details (3 Cols) */}
              <div className="md:col-span-3 space-y-2 text-xs">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600 w-36">बचत खाते क्रमांक:</td>
                      <td className="py-1 font-black text-slate-950 font-mono text-sm tracking-wide">
                        {accountDetails.accountNo}
                        {accountDetails.oldAccountNo && (
                          <span className="text-xs text-slate-600 font-normal ml-2">
                            (जुने खाते क्र.: {accountDetails.oldAccountNo})
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">खातेदार ओळख (CIF):</td>
                      <td className="py-1 font-bold text-slate-900 font-mono">
                        {accountDetails.cifNo || '-'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">खातेदाराचे नाव:</td>
                      <td className="py-1 font-black text-slate-950 text-[12.5px]">
                        {accountDetails.customerName}
                      </td>
                    </tr>
                    {accountDetails.customerNameEng && (
                      <tr className="border-b border-slate-200">
                        <td className="py-1 font-bold text-slate-600">Name in English:</td>
                        <td className="py-1 font-semibold text-slate-800 uppercase tracking-wide">
                          {accountDetails.customerNameEng}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">पत्ता (Address):</td>
                      <td className="py-1 text-slate-800 font-medium">
                        {accountDetails.address || '-'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">मोबाईल क्रमांक:</td>
                      <td className="py-1 font-bold text-slate-900 font-mono">
                        {accountDetails.mobileNo || '-'}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">आधार / पॅन क्रमांक:</td>
                      <td className="py-1 text-slate-800 font-mono">
                        {accountDetails.aadhaarNo ? `Aadhaar: ${accountDetails.aadhaarNo}` : ''}
                        {accountDetails.aadhaarNo && accountDetails.panNo ? ' | ' : ''}
                        {accountDetails.panNo ? `PAN: ${accountDetails.panNo}` : ''}
                        {!accountDetails.aadhaarNo && !accountDetails.panNo ? '-' : ''}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">खाते उघडल्याचा दिनांक:</td>
                      <td className="py-1 font-bold text-slate-900 font-mono">
                        {formatDisplayDate(accountDetails.openingDate)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">बचत योजना व व्याजदर:</td>
                      <td className="py-1 font-bold text-slate-900">
                        {accountDetails.schemeName || 'सर्वसाधारण बचत ठेव'}
                        {accountDetails.interestRate ? ` (${accountDetails.interestRate}% प्रति वर्ष)` : ''}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">किमान शिल्लक मर्यादा:</td>
                      <td className="py-1 font-bold text-slate-900 font-mono">
                        ₹ {fmtCurrency(accountDetails.minimumBalance ?? 0)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-1 font-bold text-slate-600">वारसदाराचे नाव (Nominee):</td>
                      <td className="py-1 font-bold text-slate-900">
                        {accountDetails.nomineeName ? `${accountDetails.nomineeName} (नाते: ${accountDetails.nomineeRelation || '-'})` : 'नोंद नाही'}
                      </td>
                    </tr>
                    {accountDetails.jointHolders && accountDetails.jointHolders.length > 0 && (
                      <tr className="border-b border-slate-200">
                        <td className="py-1 font-bold text-slate-600">संयुक्त खातेदार (Joint):</td>
                        <td className="py-1 font-bold text-slate-900">
                          {accountDetails.jointHolders.map(jh => `${jh.customerName} [CIF: ${jh.cifNo}]`).join(', ')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Right Boxes (Photo, Sign, Seal) */}
              <div className="md:col-span-1 flex flex-col items-center gap-3">
                {/* Photo Box */}
                <div className="w-28 h-32 border-2 border-dashed border-slate-400 flex flex-col items-center justify-center p-2 text-center text-slate-400 bg-slate-50 rounded-xs">
                  <UserCheck size={24} className="mb-1 opacity-50" />
                  <span className="text-[9.5px] font-bold leading-tight">खातेदाराचा फोटो</span>
                  <span className="text-[8px] leading-tight">(Passport Photo)</span>
                </div>

                {/* Customer Specimen Signature Box */}
                <div className="w-32 h-16 border-2 border-slate-400 flex flex-col items-center justify-end p-1 text-center bg-white rounded-xs">
                  <div className="w-full border-t border-dashed border-slate-400 pt-0.5">
                    <span className="text-[8.5px] font-bold text-slate-600 block leading-tight">
                      खातेदाराची स्वाक्षरी
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Seal & Manager Authorization */}
            <div className="mt-6 pt-4 border-t-2 border-slate-900 flex justify-between items-end text-xs">
              <div className="text-center w-36">
                <div className="h-12 flex items-center justify-center text-slate-300 italic text-[10px]">
                  [शाखा शिक्का]
                </div>
                <div className="border-t border-slate-900 pt-1 font-bold text-slate-800 text-[11px]">
                  संस्थेचा अधिकृत शिक्का
                </div>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-slate-500 font-semibold block">पासबुक जारी दिनांक:</span>
                <strong className="font-mono text-xs">{new Date().toLocaleDateString('en-GB')}</strong>
              </div>

              <div className="text-center w-40">
                <div className="h-12"></div>
                <div className="border-t border-slate-900 pt-1 font-bold text-slate-800 text-[11px]">
                  शाखा व्यवस्थापक / अधिकृत स्वाक्षरी
                </div>
              </div>
            </div>

            {/* Important Instructions Box */}
            <div className="mt-4 pt-2 border-t border-slate-300 text-[9.5px] text-slate-600 space-y-0.5">
              <p className="font-bold text-slate-700">खातेदारांसाठी महत्त्वाच्या सूचना:</p>
              <p>१. संस्थेत प्रत्येक देवाणघेवाणीच्या वेळी हे पासबुक सादर करणे बंधनकारक आहे.</p>
              <p>२. पासबुकमधील व्यवहारांची नोंद तपासून काही विसंगती आढळल्यास तात्काळ व्यवस्थापकांच्या निदर्शनास आणावी.</p>
              <p>३. पासबुक गहाळ झाल्यास शाखेत लेखी कळवून रीतसर नवीन पासबुक मिळवावे.</p>
            </div>
          </div>
        )}

        {/* ========================================================
            MODE 2: TRANSACTION STATEMENT / PASSBOOK LINES
           ======================================================== */}
        {printMode === 'statement' && (
          <table className={`cbs-table ${statementPrintType === 'passbook-booklet' ? 'passbook-booklet-table' : ''} w-full border-collapse border border-slate-900 text-xs`}>
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
                <th className="border border-slate-900 py-1.5 px-1.5 w-[6%] text-center">अ.क्र.</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">दिनांक</th>
                <th className="border border-slate-900 py-1.5 px-3 w-[34%] text-left">तपशील (Particulars)</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">व्हाउचर / चेक</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">नावे रक्कम (Dr ₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">जमा रक्कम (Cr ₹)</th>
                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right font-black">शिल्लक (₹)</th>
              </tr>
            </thead>
            <tbody>
              {/* Booklet Offset Simulated Rows (Starting Line) */}
              {startingLine > 1 && emptyOffsetRows.map((_, i) => (
                <tr key={`offset-${i}`} className="booklet-offset-row hover:bg-slate-50/50">
                  <td colSpan={7} className="border border-slate-300 py-1 px-2 text-center text-slate-300 font-mono italic text-[10px]">
                    [ ओळ {i + 1} - आधी छापलेली ओळ ]
                  </td>
                </tr>
              ))}

              {/* Transaction Data Rows */}
              {displayedTransactions.map((t, idx) => {
                const isDeposit = t.transactionType === 'Deposit' || t.transactionType === 'Interest' || (t.amount > 0 && t.transactionType !== 'Withdrawal' && t.transactionType !== 'Charges');
                const isWithdrawal = t.transactionType === 'Withdrawal' || t.transactionType === 'Charges';

                return (
                  <tr key={t.transactionID} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                    <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-center font-mono whitespace-nowrap">
                      {formatDisplayDate(t.transactionDate)}
                    </td>
                    <td className="border border-slate-900 py-1 px-3 text-left">
                      <span className="font-semibold text-slate-950">{t.narration || t.transactionType}</span>
                    </td>
                    <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10px]">
                      {t.voucherNo || t.chequeNo || '-'}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 cbs-num-cell text-right font-bold text-red-700">
                      {isWithdrawal ? fmtCurrency(t.amount) : '-'}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 cbs-num-cell text-right font-bold text-emerald-700">
                      {isDeposit ? fmtCurrency(t.amount) : '-'}
                    </td>
                    <td className="border border-slate-900 py-1 px-2 cbs-num-cell text-right font-black text-slate-950 font-mono">
                      {fmtCurrency(t.balanceAfterTxn)}
                    </td>
                  </tr>
                );
              })}

              {displayedTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-semibold border border-slate-900">
                    या खात्यावर निवडलेल्या निकषानुसार कोणतेही व्यवहार आढळले नाहीत.
                  </td>
                </tr>
              )}
            </tbody>
            {statementPrintType === 'standard-cbs' && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                  <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                    एकूण व्यवहार बेरीज / अखेर शिल्लक:
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell text-right font-bold text-red-700">
                    ₹ {fmtCurrency(totalWithdrawal)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell text-right font-bold text-emerald-700">
                    ₹ {fmtCurrency(totalDeposit)}
                  </td>
                  <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell text-right font-black text-primary bg-primary/10">
                    ₹ {fmtCurrency(latestBalance)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </CbsReportLayout>
    </div>
  );
};

export default SavingPassbookMaster;

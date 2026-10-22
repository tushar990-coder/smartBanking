import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Select from 'react-select';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  CalendarClock,
  Calendar
} from 'lucide-react';

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function RdKhatavaniReport() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reportView, setReportView] = useState<'ledger' | 'schedule'>('ledger');

  useEffect(() => {
    fetchSansthaDetail();
    
    // Set default dates to current financial year
    const today = new Date();
    let startYear = today.getFullYear();
    if (today.getMonth() < 3) {
      startYear -= 1;
    }
    const start = new Date(startYear, 3, 1);
    
    setFromDate(start.toISOString().split('T')[0]);
    setToDate(today.toISOString().split('T')[0]);

    fetchInitialData();
  }, []);

  const fetchSansthaDetail = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data) {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSansthaDetail(res.data[0]);
        } else if (!Array.isArray(res.data)) {
          setSansthaDetail(res.data);
        }
      }
    } catch (err) {
      console.error('Error fetching sanstha detail:', err);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [resAccounts, resSchemes, resFy] = await Promise.all([
        axios.get('/api/RdAccounts').catch(() => ({ data: [] })),
        axios.get('/api/RdSchemes').catch(() => ({ data: [] })),
        axios.get('/api/FinancialYears').catch(() => ({ data: [] }))
      ]);

      const accData = resAccounts.data || [];
      const schemeData = resSchemes.data || [];
      const fyData = resFy.data || [];

      if (Array.isArray(fyData)) {
        const activeFy = fyData.find((f: any) => f.isActive);
        if (activeFy && activeFy.startDate) {
          setFromDate(activeFy.startDate.split('T')[0]);
        }
      }

      if (Array.isArray(accData)) {
        setAccounts(accData);
      }

      if (Array.isArray(schemeData)) {
        setSchemes(schemeData);
      }

      // Check if URL has accountId parameter for auto-loading
      const params = new URLSearchParams(window.location.search);
      const urlAccountId = params.get('accountId');
      if (urlAccountId && Array.isArray(accData)) {
        const matched = accData.find((a: any) => a.rdAccountID?.toString() === urlAccountId);
        if (matched) {
          const oldAcc = matched.legacyAccountNumber ? ` [जुने: ${matched.legacyAccountNumber}]` : '';
          const cif = matched.cifNo ? ` [CIF: ${matched.cifNo}]` : '';
          const name = matched.customerName || matched.memberName || '';
          const opt = {
            value: matched.rdAccountID.toString(),
            label: `${matched.formattedAccountNo || matched.accountNo}${oldAcc}${cif} - ${name}`
          };
          setSelectedAccount(opt);
          loadReport(matched.rdAccountID);
        }
      }
    } catch (error) {
      console.error('Error fetching initial RD data:', error);
    }
  };

  const loadReport = async (accId: string | number) => {
    if (!accId) return;
    setIsLoading(true);
    try {
      let url = `/api/Reports/RdKhatavani/${accId}?`;
      if (fromDate) url += `fromDate=${fromDate}&`;
      if (toDate) url += `toDate=${toDate}&`;
      
      const response = await axios.get(url);
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching RD Khatavani report:', error);
      alert('माहिती उपलब्ध नाही किंवा काही त्रुटी आली.');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewReport = () => {
    if (!selectedAccount?.value) {
      alert('कृपया आवर्ती ठेव (RD) खाते निवडा.');
      return;
    }
    loadReport(selectedAccount.value);
  };

  const schemeOptions = schemes.map(s => ({
    value: s.rdSchemeID.toString(),
    label: `${s.schemeName} (${s.schemeCode || `${s.interestRate}%`})`
  }));

  const filteredAccounts = selectedScheme
    ? accounts.filter(a => (a.rdSchemeID ?? a.rdSchemeId)?.toString() === selectedScheme.value)
    : accounts;

  const accountOptions = filteredAccounts.map(a => {
    const id = a.rdAccountID || a.rdAccountId;
    const oldAcc = (a.legacyAccountNumber || a.oldAccountNo) ? ` [जुने: ${a.legacyAccountNumber || a.oldAccountNo}]` : '';
    const cif = a.cifNo ? ` [CIF: ${a.cifNo}]` : '';
    const name = a.customerName || a.memberName || '';
    const bal = ` - जमा ठेव: ₹${(a.totalDepositedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return {
      value: id ? id.toString() : '',
      label: `${a.formattedAccountNo || a.accountNo}${oldAcc}${cif} - ${name}${bal}`
    };
  }).filter(o => o.value !== '');

  const transactions = reportData?.transactions || [];
  const schedules = reportData?.schedules || [];

  const totalDebit = transactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum: number, t: any) => sum + (t.credit || 0), 0);
  const latestBalance = reportData?.closingBalance ?? (transactions.length > 0 ? transactions[transactions.length - 1].balance : 0);

  const handleExportExcel = () => {
    if (!reportData) {
      alert('एक्सपोर्ट करण्यासाठी माहिती नाही.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Ledger Sheet
    const excelLedgerData: any[] = [
      { 'अ.क्र.': 'संस्था नाव', 'दिनांक': reportData.sansthaDetail?.sansthaName || sansthaDetail?.sansthaName || '' },
      { 'अ.क्र.': 'अहवाल', 'दिनांक': 'आवर्ती ठेव खतावणी पत्रक (RD Ledger Statement)' },
      { 'अ.क्र.': 'खाते क्र.', 'दिनांक': reportData.accountNo, 'व्हाउचर क्र.': `जुने क्र.: ${reportData.oldAccountNo || '-'}` },
      { 'अ.क्र.': 'खातेदाराचे नाव', 'दिनांक': reportData.customerName, 'व्हाउचर क्र.': `CIF: ${reportData.cifNo || '-'}` },
      { 'अ.क्र.': 'योजना', 'दिनांक': `${reportData.schemeName} (${reportData.interestRate}%)`, 'व्हाउचर क्र.': `कालावधी: ${reportData.durationMonths} महिने` },
      { 'अ.क्र.': 'मासिक हप्ता', 'दिनांक': reportData.installmentAmount, 'व्हाउचर क्र.': `परिपक्वता रक्कम: ${reportData.maturityAmount}` },
      { 'अ.क्र.': '', 'दिनांक': '' } // Blank Row
    ];

    transactions.forEach((row: any, idx: number) => {
      excelLedgerData.push({
        'अ.क्र.': row.transactionType === 'Opening' ? '-' : idx + 1,
        'दिनांक': formatDisplayDate(row.date),
        'व्हाउचर क्र.': row.voucherNo || '-',
        'हप्ता क्र.': row.installmentNo ? `हप्ता ${row.installmentNo}` : '-',
        'तपशील': row.particulars,
        'नावे रक्कम (Dr ₹)': row.debit || 0,
        'जमा रक्कम (Cr ₹)': row.credit || 0,
        'शिल्लक रक्कम (Balance ₹)': row.balance || 0
      });
    });

    excelLedgerData.push({
      'अ.क्र.': '',
      'दिनांक': '',
      'व्हाउचर क्र.': '',
      'हप्ता क्र.': '',
      'तपशील': 'एकूण व्यवहार / अखेर शिल्लक:',
      'नावे रक्कम (Dr ₹)': totalDebit,
      'जमा रक्कम (Cr ₹)': totalCredit,
      'शिल्लक रक्कम (Balance ₹)': latestBalance
    });

    const wsLedger = XLSX.utils.json_to_sheet(excelLedgerData);
    XLSX.utils.book_append_sheet(wb, wsLedger, 'RD_खतावणी_पत्रक');

    // 2. Schedule Sheet
    if (schedules && schedules.length > 0) {
      const excelScheduleData = schedules.map((s: any) => ({
        'हप्ता क्र.': s.installmentNo,
        'देय दिनांक (Due Date)': formatDisplayDate(s.dueDate),
        'अपेक्षित रक्कम (Expected ₹)': s.expectedAmount,
        'भरणा दिनांक (Paid Date)': formatDisplayDate(s.paidDate),
        'भरलेली रक्कम (Paid Amount ₹)': s.paidAmount,
        'विलंब दिवस (Overdue Days)': s.overdueDays,
        'दंड आकारणी (Penalty ₹)': s.penaltyCharged,
        'पावती/व्हाउचर क्र.': s.voucherNo || '-',
        'स्थिती (Status)': s.status === 'Paid' ? 'जमा (Paid)' : s.status === 'Overdue' ? 'थकीत (Overdue)' : 'प्रलंबित (Pending)'
      }));

      const wsSchedule = XLSX.utils.json_to_sheet(excelScheduleData);
      XLSX.utils.book_append_sheet(wb, wsSchedule, 'हप्ता_वेळापत्रक');
    }

    XLSX.writeFile(wb, `RD_Khatavani_${reportData.accountNo || 'Acc'}.xlsx`);
  };

  const activeSanstha = reportData?.sansthaDetail || sansthaDetail;

  // Account Summary Banner (Strict CBS Standard Banner)
  const summaryBanner = reportData ? (
    <div className="cbs-summary-banner space-y-1.5">
      {/* Primary Details Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">आरडी खाते क्र.</span>
          <strong className="text-primary font-mono text-[11px]">{reportData.accountNo}</strong>
          {reportData.oldAccountNo && (
            <span className="text-[10px] text-amber-900 bg-amber-100 border border-amber-300 rounded px-1 ml-1.5 font-bold">
              जुने: {reportData.oldAccountNo}
            </span>
          )}
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">खातेदाराचे नाव</span>
          <strong className="text-slate-900 text-[11px] truncate block">
            {reportData.customerName} {reportData.cifNo ? `[CIF: ${reportData.cifNo}]` : ''}
          </strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">योजना / व्याजदर</span>
          <strong className="text-slate-900 text-[11px] truncate block">
            {reportData.schemeName || 'आवर्ती ठेव'}{reportData.interestRate > 0 ? ` (${reportData.interestRate}% ${reportData.interestMethod || 'Flat'})` : ''}
          </strong>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सध्याची आरडी ठेव बाकी</span>
          <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(latestBalance)}</strong>
        </div>
      </div>

      {/* Secondary Account Term Details Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs pt-1 border-t border-slate-200">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">मासिक हप्ता</span>
          <strong className="text-slate-900 font-mono text-[11px]">₹ {fmtCurrency(reportData.installmentAmount)}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कालावधी / मुदतपूर्ती</span>
          <strong className="text-slate-900 text-[11px]">
            {reportData.durationMonths} महिने (मुदत: {formatDisplayDate(reportData.maturityDate)})
          </strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">परिपक्वता देय रक्कम</span>
          <strong className="text-indigo-900 font-mono text-[11px]">₹ {fmtCurrency(reportData.maturityAmount)}</strong>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">हप्ते भरणा / स्थिती</span>
          <strong className="text-slate-900 font-mono text-[11px]">
            {reportData.totalPaidInstallments} / {reportData.durationMonths} ({reportData.status === 'Active' ? 'सुरू' : reportData.status === 'Matured' ? 'मुदतपूर्ण' : 'बंद'})
          </strong>
        </div>
      </div>
    </div>
  ) : null;

  // Filter Toolbar Controls (Compact CBS Style Matching SavingKhatavaniReport)
  const filterControls = (
    <>
      {/* Scheme Dropdown */}
      <div className="w-40 sm:w-48">
        <Select
          options={schemeOptions}
          value={selectedScheme}
          onChange={(val) => {
            setSelectedScheme(val);
            setSelectedAccount(null);
          }}
          placeholder="-- सर्व आरडी योजना --"
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

      {/* Account Dropdown */}
      <div className="w-48 sm:w-64">
        <Select
          options={accountOptions}
          value={selectedAccount}
          onChange={setSelectedAccount}
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

      {/* View Type Toggle */}
      <div className="flex items-center gap-1">
        <select
          value={reportView}
          onChange={(e) => setReportView(e.target.value as 'ledger' | 'schedule')}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-semibold bg-white text-slate-800 focus:outline-none focus:border-primary"
        >
          <option value="ledger">१. खतावणी लेजर (Ledger)</option>
          <option value="schedule">२. हप्ता वेळापत्रक (Due Schedule)</option>
        </select>
      </div>

      {/* From Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
        />
      </div>

      {/* To Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
        />
      </div>

      {/* View Button */}
      <button
        onClick={handleViewReport}
        disabled={isLoading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-xs text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        {isLoading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        <span>पहा</span>
      </button>
    </>
  );

  return (
    <CbsReportLayout
      defaultPaperSize="a4-portrait"
      allowPaperSizeToggle={true}
      reportTitle="आवर्ती ठेव खतावणी पत्रक"
      reportSubtitle={reportView === 'ledger' ? 'Recurring Deposit (RD) Account Ledger Statement' : 'RD Installment Due & Recovery Schedule'}
      periodText={`${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`}
      sansthaInfo={activeSanstha}
      summaryBanner={summaryBanner}
      signatureTier="3-tier"
      signatureTitles={[
        { title: 'लिपिक / खतावणी लेखक', subtitle: '(Clerk / Ledger Writer)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' }
      ]}
      onExportExcel={handleExportExcel}
      extraToolbarControls={filterControls}
      isLoading={isLoading}
      hasData={Boolean(reportData)}
      emptyState={
        <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
          <CalendarClock size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">कृपया आवर्ती ठेव (RD) खाते व कालावधी निवडून "पहा" बटणावर क्लिक करा.</p>
        </div>
      }
    >
      {/* 1. STANDARD CBS KHATAVANI LEDGER TABLE */}
      {reportView === 'ledger' && (
        <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
              <th className="border border-slate-900 py-1.5 px-1 w-[5%] text-center">अ.क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">दिनांक</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">व्हाउचर क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">हप्ता क्र.</th>
              <th className="border border-slate-900 py-1.5 px-3 w-[29%] text-left">तपशील (Particulars)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-right">नावे रक्कम (Dr ₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-right">जमा रक्कम (Cr ₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right font-extrabold">शिल्लक रक्कम (₹)</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((row: any, idx: number) => {
              const isOpening = row.transactionType === 'Opening';
              return (
                <tr 
                  key={idx} 
                  className={`hover:bg-slate-50 text-slate-900 text-[11px] ${
                    isOpening ? 'bg-amber-50/60 font-semibold' : ''
                  }`}
                >
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                    {isOpening ? '-' : idx + 1}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                    {formatDisplayDate(row.date)}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">
                    {row.voucherNo || '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                    {row.installmentNo ? `हप्ता ${row.installmentNo}` : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-3 text-left">
                    {row.particulars}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-dr">
                    {row.debit > 0 ? fmtCurrency(row.debit) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-cr font-bold">
                    {row.credit > 0 ? fmtCurrency(row.credit) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-bold">
                    {fmtCurrency(row.balance)}
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500 font-semibold border border-slate-900">
                  या कालावधीत कोणतेही आवर्ती ठेव व्यवहार आढळले नाहीत.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
              <td colSpan={5} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                एकूण व्यवहार / अखेर शिल्लक:
              </td>
              <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-dr font-bold">
                ₹ {fmtCurrency(totalDebit)}
              </td>
              <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-cr font-bold">
                ₹ {fmtCurrency(totalCredit)}
              </td>
              <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-bal font-black text-primary bg-primary/10">
                ₹ {fmtCurrency(latestBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* 2. STANDARD CBS INSTALLMENT SCHEDULE TABLE */}
      {reportView === 'schedule' && (
        <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
              <th className="border border-slate-900 py-1.5 px-2 w-[8%] text-center">हप्ता क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center">देय दिनांक (Due Date)</th>
              <th className="border border-slate-900 py-1.5 px-3 w-[14%] text-right">अपेक्षित हप्ता (₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center">भरणा दिनांक (Paid Date)</th>
              <th className="border border-slate-900 py-1.5 px-3 w-[14%] text-right">भरलेली रक्कम (₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">विलंब दिवस</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-right">दंड आकारणी (₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center">व्हाउचर क्र. व स्थिती</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s: any, idx: number) => {
              const isPaid = s.status === 'Paid';
              const isOverdue = s.status === 'Overdue';
              return (
                <tr key={idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold">
                    #{s.installmentNo}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                    {formatDisplayDate(s.dueDate)}
                  </td>
                  <td className="border border-slate-900 py-1 px-3 cbs-num-cell">
                    {fmtCurrency(s.expectedAmount)}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                    {s.paidDate ? formatDisplayDate(s.paidDate) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-3 cbs-num-cell font-bold cbs-amt-cr">
                    {s.paidAmount > 0 ? fmtCurrency(s.paidAmount) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                    {s.overdueDays > 0 ? `${s.overdueDays} दिवस` : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-dr">
                    {s.penaltyCharged > 0 ? fmtCurrency(s.penaltyCharged) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-[10.5px]">
                    <span className="font-semibold text-slate-800">{s.voucherNo || '-'}</span>
                    <span className="block text-[9.5px]">
                      {isPaid ? '(जमा / Paid)' : isOverdue ? '(थकीत / Overdue)' : '(प्रलंबित / Pending)'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-500 font-semibold border border-slate-900">
                  हप्ता वेळापत्रक माहिती उपलब्ध नाही.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
              <td colSpan={2} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                एकूण बेरीज:
              </td>
              <td className="border border-slate-900 py-1.5 px-3 cbs-num-cell font-bold">
                ₹ {fmtCurrency(schedules.reduce((acc: number, cur: any) => acc + (cur.expectedAmount || 0), 0))}
              </td>
              <td className="border border-slate-900 py-1.5 px-2 text-center">-</td>
              <td className="border border-slate-900 py-1.5 px-3 cbs-num-cell font-bold cbs-amt-cr">
                ₹ {fmtCurrency(schedules.reduce((acc: number, cur: any) => acc + (cur.paidAmount || 0), 0))}
              </td>
              <td colSpan={3} className="border border-slate-900"></td>
            </tr>
          </tfoot>
        </table>
      )}
    </CbsReportLayout>
  );
}

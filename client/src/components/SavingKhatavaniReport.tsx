import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Select from 'react-select';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  PiggyBank
} from 'lucide-react';

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function SavingKhatavaniReport() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [selectedLedger, setSelectedLedger] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

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

    fetchData();
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
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      const [resAccounts, resInterest, resFy] = await Promise.all([
        axios.get('/api/SavingAccounts').catch(() => ({ data: [] })),
        axios.get('/api/SavingSettings/Interest').catch(() => ({ data: [] })),
        axios.get('/api/FinancialYears').catch(() => ({ data: [] }))
      ]);

      const accData = resAccounts.data || [];
      const interestData = resInterest.data || [];
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

      const uniqueLedgerMap = new Map<number, string>();

      // 1. Load schemes created in Saving Scheme Master
      if (Array.isArray(interestData) && interestData.length > 0) {
        interestData.forEach((s: any) => {
          const targetLid = s.savingLiabilityLedgerID || s.ledgerID || s.interestExpenseLedgerID || 7;
          if (targetLid && targetLid > 0) {
            const rawName = s.schemeName || s.savingLiabilityLedger?.ledgerName || s.ledger?.ledgerName || 'बचत ठेव योजना';
            const rateInfo = (s.interestRate !== undefined && s.interestRate !== null) ? ` (${s.interestRate}%)` : '';
            uniqueLedgerMap.set(targetLid, `${rawName}${rateInfo}`);
          }
        });
      }

      // 2. Fallback
      if (uniqueLedgerMap.size === 0 && Array.isArray(accData)) {
        accData.forEach((acc: any) => {
          const lid = acc.ledgerID || 7;
          const lname = acc.ledgerName || 'बचत ठेव';
          if (!uniqueLedgerMap.has(lid)) {
            uniqueLedgerMap.set(lid, lname);
          }
        });
      }

      const ledgerList = Array.from(uniqueLedgerMap.entries()).map(([ledgerID, ledgerName]) => ({
        ledgerID,
        ledgerName
      }));

      setLedgers(ledgerList);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleViewReport = async () => {
    if (!selectedAccount?.value) {
      alert('कृपया खाते निवडा (Select Account).');
      return;
    }

    setIsLoading(true);
    try {
      let url = `/api/Reports/SavingKhatavani/${selectedAccount.value}?`;
      if (fromDate) url += `fromDate=${fromDate}&`;
      if (toDate) url += `toDate=${toDate}&`;
      
      const response = await axios.get(url);
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      alert('माहिती उपलब्ध नाही किंवा काही त्रुटी आली.');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const ledgerOptions = ledgers.map(l => ({
    value: l.ledgerID.toString(),
    label: l.ledgerName
  }));

  const filteredAccounts = selectedLedger
    ? accounts.filter(a => {
        const lid = a.ledgerID || 7;
        return lid.toString() === selectedLedger.value;
      })
    : accounts;

  const accountOptions = filteredAccounts.map(a => {
    const id = a.savingAccountID || a.savingAccountId;
    const oldAcc = (a.oldAccountNo || a.legacyAccountNumber) ? ` (जुने: ${a.oldAccountNo || a.legacyAccountNumber})` : '';
    const code = a.memberCode ? ` [${a.memberCode}]` : '';
    const bal = ` - शिल्लक: ₹${(a.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return {
      value: id ? id.toString() : '',
      label: `${a.accountNo}${oldAcc}${code} - ${a.memberName || ''}${bal}`
    };
  }).filter(o => o.value !== '');

  const transactions = reportData?.transactions || [];
  const totalDebit = transactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum: number, t: any) => sum + (t.credit || 0), 0);
  const latestBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;

  const handleExportExcel = () => {
    if (!reportData || !transactions || transactions.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी माहिती नाही.');
      return;
    }

    const excelData = transactions.map((row: any, idx: number) => ({
      'अ.क्र.': idx + 1,
      'दिनांक': formatDisplayDate(row.date),
      'तपशील': row.particulars,
      'नावे (Debit ₹)': row.debit || 0,
      'जमा (Credit ₹)': row.credit || 0,
      'शिल्लक (Balance ₹)': row.balance || 0
    }));

    excelData.push({
      'अ.क्र.': '' as any,
      'दिनांक': '',
      'तपशील': 'एकूण व्यवहार बेरीज (Total):',
      'नावे (Debit ₹)': totalDebit,
      'जमा (Credit ₹)': totalCredit,
      'शिल्लक (Balance ₹)': latestBalance
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'बचत खतावणी');
    XLSX.writeFile(workbook, `Saving_Khatavani_${reportData.accountNo || 'Acc'}.xlsx`);
  };

  const activeSanstha = reportData?.sansthaDetail || sansthaDetail;

  // Account Summary Banner
  const summaryBanner = reportData ? (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">बचत खाते क्र.</span>
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
          {reportData.memberName} {reportData.memberCode ? `[${reportData.memberCode}]` : ''}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">योजना / व्याजदर</span>
        <strong className="text-slate-900 text-[11px] truncate block">
          {reportData.ledgerName || 'बचत ठेव'}{reportData.interestRate > 0 ? ` (${reportData.interestRate}%)` : ''}
        </strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सध्याची बचत बाकी</span>
        <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(latestBalance)}</strong>
      </div>
    </div>
  ) : null;

  // Filter Toolbar Controls
  const filterControls = (
    <>
      {/* Scheme Dropdown */}
      <div className="w-40 sm:w-48">
        <Select
          options={ledgerOptions}
          value={selectedLedger}
          onChange={(val) => {
            setSelectedLedger(val);
            setSelectedAccount(null);
          }}
          placeholder="-- योजना निवडा --"
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
      <div className="w-48 sm:w-60">
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
      reportTitle="बचत ठेव खतावणी पत्रक"
      reportSubtitle="Saving Account Ledger Statement"
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
          <PiggyBank size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">कृपया बचत खाते व कालावधी निवडून "पहा" बटणावर क्लिक करा.</p>
        </div>
      }
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center">दिनांक</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[44%] text-left">तपशील (Particulars)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right">नावे रक्कम (Dr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-right">जमा रक्कम (Cr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[14%] text-right font-extrabold">शिल्लक रक्कम (₹)</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((row: any, idx: number) => (
            <tr key={idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
              <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                {formatDisplayDate(row.date)}
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
              <td className="border border-slate-900 py-1 px-3 cbs-num-cell cbs-amt-bal font-bold">
                {fmtCurrency(row.balance)}
              </td>
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-slate-500 font-semibold border border-slate-900">
                या कालावधीत कोणतेही बचत व्यवहार आढळले नाहीत.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
            <td colSpan={2} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
              एकूण व्यवहार / अखेर शिल्लक:
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-dr font-bold">
              ₹ {fmtCurrency(totalDebit)}
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-cr font-bold">
              ₹ {fmtCurrency(totalCredit)}
            </td>
            <td className="border border-slate-900 py-1.5 px-3 cbs-num-cell cbs-amt-bal font-black text-primary bg-primary/10">
              ₹ {fmtCurrency(latestBalance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </CbsReportLayout>
  );
}

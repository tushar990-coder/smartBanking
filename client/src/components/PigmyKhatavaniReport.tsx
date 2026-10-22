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

export default function PigmyKhatavaniReport() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
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
      const [resAccounts, resAgents, resFy] = await Promise.all([
        axios.get('/api/PigmyAccounts?sortOrder=asc').catch(() => ({ data: [] })),
        axios.get('/api/PigmyAgents').catch(() => ({ data: [] })),
        axios.get('/api/FinancialYears').catch(() => ({ data: [] }))
      ]);

      const accData = resAccounts.data || [];
      const agentData = resAgents.data || [];
      const fyData = resFy.data || [];

      if (Array.isArray(fyData)) {
        const activeFy = fyData.find((f: any) => f.isActive);
        if (activeFy && activeFy.startDate) {
          setFromDate(activeFy.startDate.split('T')[0]);
        }
      }

      if (Array.isArray(accData)) {
        accData.sort((a: any, b: any) => (a.accountNo || '').localeCompare(b.accountNo || '', undefined, { numeric: true }));
        setAccounts(accData);
      }

      if (Array.isArray(agentData)) {
        setAgents(agentData);
      }

      // Check if URL has accountId parameter for auto-loading
      const params = new URLSearchParams(window.location.search);
      const urlAccountId = params.get('accountId');
      const urlAgentId = params.get('agentId');

      if (urlAgentId && Array.isArray(agentData)) {
        const matchedAgent = agentData.find((ag: any) => ag.pigmyAgentID?.toString() === urlAgentId);
        if (matchedAgent) {
          setSelectedAgent({
            value: matchedAgent.pigmyAgentID.toString(),
            label: `${matchedAgent.agentName} ${matchedAgent.username ? `(${matchedAgent.username})` : ''}`
          });
        }
      }

      if (urlAccountId && Array.isArray(accData)) {
        const matched = accData.find((a: any) => a.pigmyAccountID?.toString() === urlAccountId);
        if (matched) {
          const oldAcc = (matched.legacyAccountNumber || matched.oldAccountNo) ? ` [जुने: ${matched.legacyAccountNumber || matched.oldAccountNo}]` : '';
          const cif = matched.cifNo || matched.customer?.cifNo ? ` [CIF: ${matched.cifNo || matched.customer?.cifNo}]` : '';
          const name = matched.customerName || matched.customer?.fullName || '';
          const opt = {
            value: matched.pigmyAccountID.toString(),
            label: `${matched.formattedAccountNo || matched.accountNo}${oldAcc}${cif} - ${name}`
          };
          setSelectedAccount(opt);
          loadReport(matched.pigmyAccountID);
        }
      }
    } catch (error) {
      console.error('Error fetching initial Pigmy data:', error);
    }
  };

  const loadReport = async (accId: string | number) => {
    if (!accId) return;
    setIsLoading(true);
    try {
      let url = `/api/Reports/PigmyKhatavani/${accId}?`;
      if (fromDate) url += `fromDate=${fromDate}&`;
      if (toDate) url += `toDate=${toDate}&`;
      
      const response = await axios.get(url);
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching Pigmy Khatavani report:', error);
      alert('माहिती उपलब्ध नाही किंवा काही त्रुटी आली.');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewReport = () => {
    if (!selectedAccount?.value) {
      alert('कृपया पिग्मी ठेव खाते निवडा.');
      return;
    }
    loadReport(selectedAccount.value);
  };

  const agentOptions = agents.map(ag => ({
    value: ag.pigmyAgentID.toString(),
    label: `${ag.agentName}${ag.username ? ` (${ag.username})` : ''}`
  }));

  const filteredAccounts = selectedAgent
    ? accounts.filter(a => a.pigmyAgentID?.toString() === selectedAgent.value)
    : accounts;

  const accountOptions = filteredAccounts.map(a => {
    const id = a.pigmyAccountID || a.pigmyAccountId;
    const oldAcc = (a.legacyAccountNumber || a.oldAccountNo) ? ` [जुने: ${a.legacyAccountNumber || a.oldAccountNo}]` : '';
    const cif = a.cifNo || a.customer?.cifNo ? ` [CIF: ${a.cifNo || a.customer?.cifNo}]` : '';
    const name = a.customerName || a.customer?.fullName || '';
    const balAmt = Math.max(0, (a.totalDepositedAmount || 0) - (a.totalWithdrawnAmount || 0));
    const bal = ` - जमा: ₹${balAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return {
      value: id ? id.toString() : '',
      label: `${a.formattedAccountNo || a.accountNo}${oldAcc}${cif} - ${name}${bal}`
    };
  }).filter(o => o.value !== '');

  const transactions = reportData?.transactions || [];

  const totalDebit = transactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum: number, t: any) => sum + (t.credit || 0), 0);
  const latestBalance = reportData?.closingBalance ?? (transactions.length > 0 ? transactions[transactions.length - 1].balance : 0);

  const handleExportExcel = () => {
    if (!reportData) {
      alert('एक्सपोर्ट करण्यासाठी माहिती नाही.');
      return;
    }

    const wb = XLSX.utils.book_new();

    const excelData: any[] = [
      { 'अ.क्र.': 'संस्था नाव', 'व्यवहार दिनांक': reportData.sansthaDetail?.sansthaName || sansthaDetail?.sansthaName || '' },
      { 'अ.क्र.': 'अहवाल', 'व्यवहार दिनांक': 'पिग्मी ठेव खतावणी पत्रक (Pigmy Deposit Ledger Statement)' },
      { 'अ.क्र.': 'खाते क्र.', 'व्यवहार दिनांक': reportData.accountNo, 'संदर्भ / पावती क्र.': `जुने क्र.: ${reportData.oldAccountNo || '-'}` },
      { 'अ.क्र.': 'खातेदाराचे नाव', 'व्यवहार दिनांक': reportData.customerName, 'संदर्भ / पावती क्र.': `CIF: ${reportData.cifNo || '-'}` },
      { 'अ.क्र.': 'प्रतिनिधी (Agent)', 'व्यवहार दिनांक': `${reportData.agentName || '-'} (${reportData.agentCode || '-'})`, 'संदर्भ / पावती क्र.': `योजना: ${reportData.schemeName || 'पिग्मी ठेव'}` },
      { 'अ.क्र.': 'दैनिक ठेव हप्ता', 'व्यवहार दिनांक': reportData.dailyDepositAmount, 'संदर्भ / पावती क्र.': `व्याजदर: ${reportData.interestRate}%` },
      { 'अ.क्र.': 'एकूण जमा व्याज', 'व्यवहार दिनांक': reportData.totalPostedInterest || 0, 'संदर्भ / पावती क्र.': `कालावधीतील व्याज: ₹${reportData.periodPostedInterest || 0}` },
      { 'अ.क्र.': '', 'व्यवहार दिनांक': '' } // Blank Row
    ];

    transactions.forEach((row: any, idx: number) => {
      const isOpening = row.transactionType === 'OPENING_BALANCE' || row.transactionType === 'Opening';
      excelData.push({
        'अ.क्र.': isOpening ? '-' : idx + 1,
        'व्यवहार दिनांक': formatDisplayDate(row.transactionDate || row.date),
        'वसुली दिनांक': isOpening ? '-' : formatDisplayDate(row.valueDate || row.date),
        'संदर्भ / पावती क्र.': row.referenceId || '-',
        'तपशील': row.particulars,
        'नावे रक्कम (Dr ₹)': row.debit || 0,
        'जमा रक्कम (Cr ₹)': row.credit || 0,
        'शिल्लक रक्कम (Balance ₹)': row.balance || 0
      });
    });

    excelData.push({
      'अ.क्र.': '',
      'व्यवहार दिनांक': '',
      'वसुली दिनांक': '',
      'संदर्भ / पावती क्र.': '',
      'तपशील': 'एकूण व्यवहार / अखेर शिल्लक:',
      'नावे रक्कम (Dr ₹)': totalDebit,
      'जमा रक्कम (Cr ₹)': totalCredit,
      'शिल्लक रक्कम (Balance ₹)': latestBalance
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'पिग्मी_खतावणी_पत्रक');

    XLSX.writeFile(wb, `Pigmy_Khatavani_${reportData.accountNo || 'Acc'}.xlsx`);
  };

  const activeSanstha = reportData?.sansthaDetail || sansthaDetail;

  // Account Summary Banner (Strict CBS Standard Banner)
  const summaryBanner = reportData ? (
    <div className="cbs-summary-banner space-y-1.5">
      {/* Primary Details Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">पिग्मी खाते क्र.</span>
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
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">प्रतिनिधी (Agent)</span>
          <strong className="text-slate-900 text-[11px] truncate block">
            {reportData.agentName || '-'} {reportData.agentCode ? `(${reportData.agentCode})` : ''}
          </strong>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सध्याची पिग्मी ठेव बाकी</span>
          <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(latestBalance)}</strong>
        </div>
      </div>

      {/* Secondary Account Term Details Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs pt-1 border-t border-slate-200">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">दैनिक ठेव हप्ता</span>
          <strong className="text-slate-900 font-mono text-[11px]">₹ {fmtCurrency(reportData.dailyDepositAmount)}</strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">योजना / व्याजदर</span>
          <strong className="text-slate-900 text-[11px] truncate block">
            {reportData.schemeName || 'पिग्मी ठेव'}{reportData.interestRate > 0 ? ` (${reportData.interestRate}%)` : ''}
          </strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सुरू दिनांक / मुदत</span>
          <strong className="text-slate-900 text-[11px]">
            {formatDisplayDate(reportData.openingDate)} {reportData.maturityDate ? `(मुदत: ${formatDisplayDate(reportData.maturityDate)})` : ''}
          </strong>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">खाते स्थिती</span>
          <strong className="text-slate-900 text-[11px]">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              reportData.status === 'Active' 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : reportData.status === 'Matured' 
                ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              {reportData.status === 'Active' ? 'सुरू (Active)' : reportData.status === 'Matured' ? 'मुदतपूर्ण (Matured)' : 'बंद (Closed)'}
            </span>
          </strong>
        </div>
      </div>

      {/* Tertiary Interest & Collection Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs pt-1 border-t border-slate-200">
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">एकूण जमा केलेले व्याज</span>
          <strong className="text-emerald-800 font-mono text-[11px]">
            ₹ {fmtCurrency(reportData.totalPostedInterest)}
          </strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कालावधीतील जमा व्याज</span>
          <strong className="text-emerald-700 font-mono text-[11px]">
            ₹ {fmtCurrency(reportData.periodPostedInterest)}
          </strong>
        </div>
        <div>
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कालावधीतील संकलन ठेवी</span>
          <strong className="text-slate-900 font-mono text-[11px]">
            ₹ {fmtCurrency(reportData.periodTotalCredit - (reportData.periodPostedInterest || 0))}
          </strong>
        </div>
        <div className="sm:text-right">
          <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">कालावधीतील एकूण उचल (Dr)</span>
          <strong className="text-rose-700 font-mono text-[11px]">
            ₹ {fmtCurrency(reportData.periodTotalDebit)}
          </strong>
        </div>
      </div>
    </div>
  ) : null;

  // Filter Toolbar Controls (Compact CBS Style)
  const filterControls = (
    <>
      {/* Agent Dropdown */}
      <div className="w-40 sm:w-48">
        <Select
          options={agentOptions}
          value={selectedAgent}
          onChange={(val) => {
            setSelectedAgent(val);
            setSelectedAccount(null);
          }}
          placeholder="-- सर्व प्रतिनिधी (Agent) --"
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
      reportTitle="पिग्मी ठेव खतावणी पत्रक"
      reportSubtitle="Daily Pigmy Deposit Account Ledger Statement"
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
          <p className="font-semibold text-xs">कृपया पिग्मी ठेव खाते व कालावधी निवडून "पहा" बटणावर क्लिक करा.</p>
        </div>
      }
    >
      {/* STANDARD CBS KHATAVANI LEDGER TABLE WITH TRANSACTION DATE & COLLECTION DATE */}
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[10%] text-center">व्यवहार दिनांक</th>
            <th className="border border-slate-900 py-1.5 px-1.5 w-[10%] text-center">वसुली दिनांक</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-center">संदर्भ / पावती क्र.</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[27%] text-left">तपशील (Particulars)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">नावे रक्कम (Dr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">जमा रक्कम (Cr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right font-extrabold">शिल्लक रक्कम (₹)</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((row: any, idx: number) => {
            const isOpening = row.transactionType === 'OPENING_BALANCE' || row.transactionType === 'Opening';
            const isInterest = row.isInterest || row.transactionType === 'INTEREST';
            return (
              <tr 
                key={idx} 
                className={`hover:bg-slate-50 text-slate-900 text-[11px] ${
                  isOpening 
                    ? 'bg-amber-50/60 font-semibold' 
                    : isInterest 
                    ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600 font-medium' 
                    : ''
                }`}
              >
                <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                  {isOpening ? '-' : idx + 1}
                </td>
                <td 
                  className="border border-slate-900 py-1 px-1.5 text-center font-mono"
                  title={row.systemPostedOn ? `सिस्टीम नोंद दिनांक व वेळ: ${new Date(row.systemPostedOn).toLocaleString('mr-IN')}` : undefined}
                >
                  {formatDisplayDate(row.transactionDate || row.date)}
                </td>
                <td className="border border-slate-900 py-1 px-1.5 text-center font-mono">
                  {isOpening ? '-' : formatDisplayDate(row.valueDate || row.date)}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">
                  {row.referenceId || '-'}
                </td>
                <td className="border border-slate-900 py-1 px-3 text-left">
                  {isInterest && (
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 mr-1.5 shrink-0 shadow-2xs">
                      व्याज जमा
                    </span>
                  )}
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
                या कालावधीत कोणतेही पिग्मी व्यवहार आढळले नाहीत.
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

      {/* CBS Financial Summary Strip */}
      {reportData && (
        <div className="mt-2 text-xs flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-300 rounded-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-500 text-[10px] block font-semibold">कालावधीतील प्रत्यक्ष संकलन (Deposits)</span>
              <strong className="text-slate-900 font-mono text-[11px]">
                ₹ {fmtCurrency(totalCredit - (reportData.periodPostedInterest || 0))}
              </strong>
            </div>
            <div className="sm:border-l sm:border-slate-300 sm:pl-4">
              <span className="text-slate-500 text-[10px] block font-semibold">कालावधीतील जमा व्याज (Interest Cr)</span>
              <strong className="text-emerald-700 font-mono text-[11px]">
                ₹ {fmtCurrency(reportData.periodPostedInterest)}
              </strong>
            </div>
            <div className="sm:border-l sm:border-slate-300 sm:pl-4">
              <span className="text-slate-500 text-[10px] block font-semibold">कालावधीतील उचल (Withdrawals)</span>
              <strong className="text-rose-700 font-mono text-[11px]">
                ₹ {fmtCurrency(totalDebit)}
              </strong>
            </div>
          </div>
          <div className="text-right">
            <span className="text-slate-500 text-[10px] block font-semibold">अखेर शिल्लक रक्कम (Closing Balance)</span>
            <strong className="text-primary font-mono text-xs">
              ₹ {fmtCurrency(latestBalance)}
            </strong>
          </div>
        </div>
      )}
    </CbsReportLayout>
  );
}

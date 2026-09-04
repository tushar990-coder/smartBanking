import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Select from 'react-select';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  Layers
} from 'lucide-react';

interface SansthaInfo {
  sansthaID?: number;
  sansthaName?: string;
  address?: string;
  village?: string;
  taluka?: string;
  district?: string;
  pinCode?: string;
  mobileNo?: string;
  email?: string;
  registrationNo?: string;
  registrationDate?: string;
  joiningDate?: string;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function SharesKhatavaniReport() {
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedLedger, setSelectedLedger] = useState<any>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sansthaInfo, setSansthaInfo] = useState<SansthaInfo | null>(null);
  
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSansthaDetails();
    
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

  const fetchSansthaDetails = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data) {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSansthaInfo(res.data[0]);
        } else if (!Array.isArray(res.data)) {
          setSansthaInfo(res.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      const [resLedgers, resMembers] = await Promise.all([
        axios.get('/api/Ledgers'),
        axios.get('/api/Members')
      ]);
      
      if (resLedgers.data) {
        const shareLedgers = resLedgers.data.filter((l: any) => 
          l.accountType === 'Share Capital' || 
          (l.ledgerName || '').includes('भाग') || 
          (l.ledgerName || '').includes('शेअर्स') || 
          (l.ledgerName || '').toLowerCase().includes('share') ||
          (l.accountGroup?.groupName || '').includes('भांडवल') ||
          (l.accountGroup?.groupName || '').includes('भाग')
        );

        const finalLedgers = shareLedgers.length > 0 ? shareLedgers : resLedgers.data;
        setLedgers(finalLedgers);
        
        const defaultShare = finalLedgers.find((l: any) => l.accountType === 'Share Capital') ||
                             finalLedgers.find((l: any) => 
          (l.ledgerName || '').includes('सभासद भाग') || 
          (l.ledgerName || '').includes('भाग भांडवल') || 
          (l.ledgerName || '').includes('शेअर्स')
        ) || finalLedgers[0];

        if (defaultShare) {
          const id = defaultShare.ledgerID || defaultShare.ledgerId;
          if (id) {
            setSelectedLedger({ 
              value: id.toString(), 
              label: `${defaultShare.ledgerName} (${defaultShare.accountGroup?.groupName || 'भांडवल'})` 
            });
          }
        }
      }

      if (resMembers.data) {
        setMembers(resMembers.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleViewReport = async () => {
    if (!selectedLedger?.value || !selectedMemberId || !fromDate || !toDate) {
      alert('कृपया सर्व माहिती निवडा (सभासद, लेजर आणि तारखा).');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get(`/api/Reports/member-ledger-statement?memberId=${selectedMemberId}&ledgerId=${selectedLedger.value}&fromDate=${fromDate}&toDate=${toDate}`);
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching report:', error);
      alert('माहिती उपलब्ध नाही किंवा काही त्रुटी आली.');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const activeSanstha = reportData?.sansthaInfo || sansthaInfo;
  const ledgerOptions = ledgers.map(l => ({
    value: l.ledgerID.toString(),
    label: `${l.ledgerName} (${l.accountGroup?.groupName || 'भांडवल'})`
  }));

  const transactions = reportData?.transactions || [];
  const openingBalance = reportData?.openingBalance || 0;
  const closingBalance = reportData?.closingBalance || 0;
  const totalDebit = reportData?.totalDebit || 0;
  const totalCredit = reportData?.totalCredit || 0;

  const handleExportExcel = () => {
    if (!reportData) {
      alert('एक्सपोर्ट करण्यासाठी माहिती नाही.');
      return;
    }

    const excelData: any[] = [];
    excelData.push({
      'अ.क्र.': '',
      'दिनांक': formatDisplayDate(fromDate),
      'व्हाउचर क्र.': '-',
      'तपशील': 'आरंभीची शिल्लक (Opening Balance)',
      'नावे रक्कम (Debit ₹)': 0,
      'जमा रक्कम (Credit ₹)': 0,
      'शिल्लक (Balance ₹)': openingBalance
    });

    let sr = 1;
    transactions.forEach((tx: any) => {
      excelData.push({
        'अ.क्र.': sr++,
        'दिनांक': formatDisplayDate(tx.voucherDate),
        'व्हाउचर क्र.': tx.voucherNo || '-',
        'तपशील': tx.narration || tx.particulars || '-',
        'नावे रक्कम (Debit ₹)': tx.debitAmount || 0,
        'जमा रक्कम (Credit ₹)': tx.creditAmount || 0,
        'शिल्लक (Balance ₹)': tx.runningBalance || 0
      });
    });

    excelData.push({
      'अ.क्र.': '',
      'दिनांक': formatDisplayDate(toDate),
      'व्हाउचर क्र.': '',
      'तपशील': 'एकूण व्यवहार (Total)',
      'नावे रक्कम (Debit ₹)': totalDebit,
      'जमा रक्कम (Credit ₹)': totalCredit,
      'शिल्लक (Balance ₹)': closingBalance
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'शेअर्स खतावणी');
    XLSX.writeFile(workbook, `Shares_Khatavani_${reportData.memberCode || 'Member'}.xlsx`);
  };

  // Summary Banner Node
  const summaryBanner = reportData ? (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सभासद क्र.</span>
        <strong className="text-primary font-mono text-[11px]">
          {reportData.memberNo || reportData.memberCode || reportData.cifNo || '-'}
          {reportData.legacyMemberNo ? ` (जुना: ${reportData.legacyMemberNo})` : ''}
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सभासदाचे नाव</span>
        <strong className="text-slate-900 text-[11px] truncate block">{reportData.memberName || '-'}</strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">लेजर</span>
        <strong className="text-slate-900 text-[11px] truncate block">{reportData.ledgerName || selectedLedger?.label || '-'}</strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सध्याची शेअर्स बाकी</span>
        <strong className="text-emerald-700 font-mono text-xs">₹ {fmtCurrency(closingBalance)}</strong>
      </div>
    </div>
  ) : null;

  // Filter toolbar controls
  const filterControls = (
    <>
      {/* Member Search */}
      <div className="w-56 sm:w-64 md:w-72">
        <MemberSearchSelect
          members={members}
          value={selectedMemberId}
          onChange={(val) => setSelectedMemberId(val)}
          placeholder="सभासद नाव, कोड किंवा जुना क्र..."
          className="text-[11px]"
        />
      </div>

      {/* Ledger Dropdown */}
      <div className="w-40 sm:w-48">
        <Select
          options={ledgerOptions}
          value={selectedLedger}
          onChange={setSelectedLedger}
          placeholder="-- लेजर निवडा --"
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
      reportTitle="शेअर्स खतावणी पत्रक"
      reportSubtitle="Shares Ledger Statement"
      periodText={`${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`}
      sansthaInfo={activeSanstha}
      summaryBanner={summaryBanner}
      signatureTier="3-tier"
      signatureTitles={[
        { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' }
      ]}
      onExportExcel={handleExportExcel}
      extraToolbarControls={filterControls}
      isLoading={isLoading}
      hasData={Boolean(reportData)}
      emptyState={
        <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
          <Layers size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">कृपया सभासद व कालावधी निवडून "पहा" बटणावर क्लिक करा.</p>
        </div>
      }
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">अ.क्र.</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">दिनांक</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">व्हाउचर क्र.</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[34%] text-left">तपशील</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">नावे रक्कम (Dr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">जमा रक्कम (Cr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right font-extrabold">शिल्लक रक्कम (₹)</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening Balance Row */}
          <tr className="bg-slate-50/70 font-bold text-slate-900 text-[11px]">
            <td className="border border-slate-900 py-1 px-1 text-center font-mono">-</td>
            <td className="border border-slate-900 py-1 px-2 text-center font-mono">{formatDisplayDate(fromDate)}</td>
            <td className="border border-slate-900 py-1 px-2 text-center font-mono">-</td>
            <td className="border border-slate-900 py-1 px-3 italic text-primary">आरंभीची शिल्लक (Opening Balance)</td>
            <td className="border border-slate-900 py-1 px-2 text-right font-mono">-</td>
            <td className="border border-slate-900 py-1 px-2 text-right font-mono">-</td>
            <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-bold text-slate-950">
              {fmtCurrency(openingBalance)}
            </td>
          </tr>

          {transactions.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-6 text-slate-500 font-semibold border border-slate-900">
                निवडलेल्या कालावधीत कोणतेही शेअर्स व्यवहार आढळले नाहीत.
              </td>
            </tr>
          ) : (
            transactions.map((tx: any, idx: number) => (
              <tr key={tx.voucherDetailID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                  {idx + 1}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                  {formatDisplayDate(tx.voucherDate)}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">
                  {tx.voucherNo || '-'}
                </td>
                <td className="border border-slate-900 py-1 px-3">
                  {tx.narration || tx.particulars || '-'}
                </td>
                <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-dr">
                  {tx.debitAmount > 0 ? fmtCurrency(tx.debitAmount) : '-'}
                </td>
                <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-cr">
                  {tx.creditAmount > 0 ? fmtCurrency(tx.creditAmount) : '-'}
                </td>
                <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal">
                  {fmtCurrency(tx.runningBalance)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
            <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
              एकूण व्यवहार / अखेर शिल्लक:
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-dr font-bold">
              ₹ {fmtCurrency(totalDebit)}
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-cr font-bold">
              ₹ {fmtCurrency(totalCredit)}
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-bal font-black text-primary bg-primary/10">
              ₹ {fmtCurrency(closingBalance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </CbsReportLayout>
  );
}

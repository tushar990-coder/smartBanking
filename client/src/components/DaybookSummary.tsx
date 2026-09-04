import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

interface DaybookSummaryLedgerDto {
  ledgerId: number;
  ledgerName: string;
  voucherNo?: string;
  memberDetails?: string;
  narration?: string;
  receiptCash: number;
  receiptTransfer: number;
  receiptTotal: number;
  paymentCash: number;
  paymentTransfer: number;
  paymentTotal: number;
}

interface DaybookSummaryGroupDto {
  groupId: number;
  groupName: string;
  ledgers: DaybookSummaryLedgerDto[];
}

interface DaybookSummaryResponseDto {
  openingBalance: number;
  closingBalance: number;
  groups: DaybookSummaryGroupDto[];
  totalReceiptsCash: number;
  totalReceiptsTransfer: number;
  totalPaymentsCash: number;
  totalPaymentsTransfer: number;
}

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function DaybookSummary() {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState<string>(getTodayDate());
  const [toDate, setToDate] = useState<string>(getTodayDate());
  const [pages, setPages] = useState<{ date: string; data: DaybookSummaryResponseDto }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sansthaName, setSansthaName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [registrationNo, setRegistrationNo] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch
    ? (globalBranchStr as string)
    : user?.branchID
    ? user.branchID.toString()
    : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  useEffect(() => {
    fetchBranches();
    fetchSansthaName();
    fetchReport();
  }, []);

  useEffect(() => {
    if (user?.branchID) {
      setSelectedBranchId(user.branchID.toString());
    }
  }, [user?.branchID]);

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/Branches');
      if (response.ok) {
        setBranches(await response.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  const fetchSansthaName = async () => {
    try {
      const response = await fetch('/api/SansthaDetails');
      if (response.ok) {
        const details = await response.json();
        if (details && details.length > 0) {
          setSansthaDetail(details[0]);
          setSansthaName(details[0].sansthaName);
          setAddress(details[0].address);
          setRegistrationNo(details[0].registrationNo);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sanstha name', err);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/Reports/DaybookSummaryBatch?date=${fromDate}&toDate=${toDate}`;
      if (selectedBranchId !== 'all') {
        url += `&branchId=${selectedBranchId}`;
      }

      let response = await fetch(url);
      if (response.ok) {
        const batchData = await response.json();
        const newPages: { date: string; data: DaybookSummaryResponseDto }[] = (batchData.days || []).map(
          (day: { date: string; data: DaybookSummaryResponseDto }) => ({
            date: day.date,
            data: day.data,
          })
        );
        setPages(newPages);
        if (newPages.length === 0) {
          setError('या तारखांमध्ये कोणताही व्यवहार आढळला नाही. (No transactions found)');
        }
      } else if (response.status === 404) {
        // Fallback to single summary endpoint if batch endpoint is not available
        let fallbackUrl = `/api/Reports/DaybookSummary?date=${fromDate}&toDate=${toDate}`;
        if (selectedBranchId !== 'all') {
          fallbackUrl += `&branchId=${selectedBranchId}`;
        }
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          const singleData = await fallbackRes.json();
          setPages([{ date: fromDate, data: singleData }]);
        } else {
          setError('सर्व्हरशी संपर्क होऊ शकला नाही. (Server connection failed)');
        }
      } else {
        setError('सर्व्हरशी संपर्क होऊ शकला नाही. (Server connection failed)');
      }
    } catch (err) {
      setError('सर्व्हरशी संपर्क होऊ शकला नाही. (Server connection failed)');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (pages.length === 0) return;
    const rows: any[][] = [];

    pages.forEach((page) => {
      const data = page.data;
      rows.push([sansthaName]);
      rows.push([address]);
      rows.push([`रोजकीर्द सारांश (Daybook Summary) - दिनांक: ${formatDate(page.date)}`]);
      rows.push([`शाखा: ${getBranchName()}`]);
      rows.push([]);

      rows.push([
        'Particulars (तपशील)',
        'Member Details / Narration (सभासद तपशील)',
        'Voucher No.',
        'Receipts Cash (₹)',
        'Receipts Transfer (₹)',
        'Receipts Total (₹)',
        'Payments Cash (₹)',
        'Payments Transfer (₹)',
        'Payments Total (₹)',
      ]);

      data.groups.forEach((group) => {
        rows.push([group.groupName.toUpperCase(), '', '', '', '', '', '', '', '']);
        group.ledgers.forEach((ledger) => {
          rows.push([
            ledger.ledgerName,
            ledger.memberDetails || ledger.narration || '',
            ledger.voucherNo || '',
            ledger.receiptCash || 0,
            ledger.receiptTransfer || 0,
            ledger.receiptTotal || 0,
            ledger.paymentCash || 0,
            ledger.paymentTransfer || 0,
            ledger.paymentTotal || 0,
          ]);
        });
        const groupReceiptCash = group.ledgers.reduce((s, l) => s + l.receiptCash, 0);
        const groupReceiptTransfer = group.ledgers.reduce((s, l) => s + l.receiptTransfer, 0);
        const groupReceiptTotal = group.ledgers.reduce((s, l) => s + l.receiptTotal, 0);
        const groupPaymentCash = group.ledgers.reduce((s, l) => s + l.paymentCash, 0);
        const groupPaymentTransfer = group.ledgers.reduce((s, l) => s + l.paymentTransfer, 0);
        const groupPaymentTotal = group.ledgers.reduce((s, l) => s + l.paymentTotal, 0);

        rows.push([
          `Group Total - ${group.groupName}`,
          '',
          groupReceiptCash,
          groupReceiptTransfer,
          groupReceiptTotal,
          groupPaymentCash,
          groupPaymentTransfer,
          groupPaymentTotal,
        ]);
      });

      const totalR = data.totalReceiptsCash + data.totalReceiptsTransfer;
      const totalP = data.totalPaymentsCash + data.totalPaymentsTransfer;
      rows.push([
        'Transactions Total (व्यवहार एकूण)',
        '',
        data.totalReceiptsCash,
        data.totalReceiptsTransfer,
        totalR,
        data.totalPaymentsCash,
        data.totalPaymentsTransfer,
        totalP,
      ]);

      rows.push([
        'Opening Balance (आरंभीची शिल्लक)',
        '',
        '',
        '',
        data.openingBalance,
        'Day End Closing Cash (अखेरची रोख शिल्लक)',
        '',
        data.closingBalance,
      ]);

      rows.push([
        'Grand Total (एकूण सर्व)',
        '',
        '',
        '',
        totalR + data.openingBalance,
        'Grand Total (एकूण सर्व)',
        '',
        totalP + data.closingBalance,
      ]);

      rows.push([]);
      rows.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DaybookSummary');
    XLSX.writeFile(wb, `Daybook_Summary_${fromDate}_to_${toDate}.xlsx`);
  };

  const formatAmount = (amount: number) => {
    return Math.abs(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const getBranchName = () => {
    if (selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const b = branches.find((item) => item.branchID.toString() === selectedBranchId);
    return b ? b.branchName : 'मुख्य शाखा';
  };

  return (
    <div className="p-1 max-w-[1300px] mx-auto bg-gray-50 min-h-screen font-sans print:p-0 print:bg-white text-xs">
      {/* Print styles */}
      <style>
        {`
          @media print {
            @page { size: landscape; margin: 8mm; }
            body { background-color: white; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 9pt; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .page-break { page-break-after: always; }
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
              <span className="text-xs">📖</span>
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>रोजकीर्द सारांश</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Daybook Summary)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Branch */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
              >
                <option value="all">सर्व शाखा (All)</option>
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* View Button */}
            <button
              onClick={fetchReport}
              disabled={loading}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? '...' : 'शोधा'}</span>
            </button>
          </div>

          {/* Right: Export & Print Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={pages.length === 0}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${pages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={pages.length === 0}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${pages.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="A4 लँडस्केप प्रिंट काढा"
            >
              <span>प्रिंट (A4)</span>
            </button>
          </div>

        </div>

      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-sm mb-4 font-bold text-xs shadow-2xs border border-red-200 no-print flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Report Pages Area */}
      {pages.length > 0 && (
        <div className="space-y-6 print:space-y-0">
          {pages.map((page, idx) => {
            const data = page.data;
            const pageDate = page.date;
            return (
              <div
                key={idx}
                className="bg-white border-2 border-gray-900 p-3 mx-auto shadow-sm print:border-2 print:border-black print:shadow-none print:p-2 font-sans text-xs max-w-[297mm] min-h-[200mm]"
                style={{ pageBreakAfter: idx < pages.length - 1 ? 'always' : 'auto' }}
              >
                {/* Header Section Matching Bank Reports */}
                <div className="border-2 border-gray-900 mb-2 p-2 relative bg-gray-50/50 print:bg-white text-center">
                  <div className="flex justify-between items-center text-[11px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1.5">
                    <div><span>रजि. नं. - </span><span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span></div>
                    <div><span>शाखा: </span><span className="text-primary font-bold">{getBranchName()}</span></div>
                    <div><span>रजि. दि. - </span><span className="font-mono">{sansthaDetail?.registrationDate ? formatDate(sansthaDetail.registrationDate) : '-'}</span></div>
                  </div>

                  <h1 className="text-base font-black text-gray-900 tracking-wide uppercase font-serif">{sansthaDetail?.sansthaName || sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h1>
                  <h2 className="text-[11px] font-semibold text-gray-700 mt-0.5">{sansthaDetail?.address || address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}</h2>

                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="w-24"></div>
                    <span className="border-2 border-gray-900 font-extrabold px-6 py-0.5 bg-gray-200 print:bg-gray-100 text-xs tracking-wider text-gray-900 shadow-2xs font-serif uppercase">
                      रोजकीर्द सारांश (DAYBOOK SUMMARY)
                    </span>
                    <div className="text-right text-[11px] font-bold text-gray-800">
                      दिनांक : <span className="font-mono">{formatDate(pageDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Sub-header details */}
                <div className="border border-gray-800 p-1 flex justify-between items-center text-[10px] font-bold mb-2 bg-gray-100/60 print:bg-white">
                  <div>
                    शाखा (Branch) : <span className="font-normal">{getBranchName()}</span>
                  </div>
                  <div className="tracking-wide">
                    कालावधी : <span className="font-normal">{formatDate(pageDate)}</span>
                  </div>
                  <div>
                    Cash Counter Name : <span className="font-normal uppercase">All</span>
                  </div>
                </div>

                {/* Main Table */}
                <table className="w-full border-collapse border-2 border-gray-900 text-[10.5px] leading-tight font-sans">
                  <thead>
                    <tr className="bg-gray-100 print:bg-gray-200 text-gray-900 border-b-2 border-gray-900 font-bold">
                      <th className="border border-gray-800 p-1.5 align-middle text-left" rowSpan={2}>
                        तपशील (Particulars)
                      </th>
                      <th className="border border-gray-800 p-1.5 align-middle text-center w-24" rowSpan={2}>
                        व्हाउचर क्र.
                      </th>
                      <th className="border border-gray-800 p-1 text-center bg-blue-50/80 print:bg-gray-200" colSpan={3}>
                        जमा (Receipts)
                      </th>
                      <th className="border border-gray-800 p-1 text-center bg-amber-50/80 print:bg-gray-200" colSpan={3}>
                        नावे / खर्च (Payments)
                      </th>
                    </tr>
                    <tr className="bg-gray-100 print:bg-gray-200 text-gray-900 border-b-2 border-gray-900 font-bold text-[10px]">
                      <th className="border border-gray-800 p-1 text-right w-20">रोख (₹)</th>
                      <th className="border border-gray-800 p-1 text-right w-20">वर्ग (₹)</th>
                      <th className="border border-gray-800 p-1 text-right w-24 bg-blue-100/50 print:bg-gray-200 font-extrabold">
                        एकूण (₹)
                      </th>
                      <th className="border border-gray-800 p-1 text-right w-20">रोख (₹)</th>
                      <th className="border border-gray-800 p-1 text-right w-20">वर्ग (₹)</th>
                      <th className="border border-gray-800 p-1 text-right w-24 bg-amber-100/50 print:bg-gray-200 font-extrabold">
                        एकूण (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.groups.map((group) => (
                      <React.Fragment key={group.groupId}>
                        {/* Group Header Row */}
                        <tr className="bg-slate-100 print:bg-gray-100 font-bold border-y border-gray-400">
                          <td className="p-1 px-1.5 border border-gray-800 uppercase text-[11px] text-gray-900" colSpan={8}>
                            📂 {group.groupName}
                          </td>
                        </tr>

                        {/* Ledgers under group */}
                        {group.ledgers.map((ledger) => (
                          <tr key={ledger.ledgerId} className="hover:bg-gray-50 transition-colors">
                            <td className="p-1 px-2 border border-gray-300 font-medium text-gray-800" title={ledger.ledgerName}>
                              <div className="font-bold text-gray-900">{ledger.ledgerName}</div>
                              {(ledger.memberDetails || ledger.narration) && (
                                <div className="text-[9.5px] text-blue-900 print:text-black font-normal mt-0.5 flex items-start gap-1">
                                  <span className="font-semibold shrink-0">👤 सभासद / तपशील:</span>
                                  <span className="break-words">{ledger.memberDetails || ledger.narration}</span>
                                </div>
                              )}
                            </td>
                            <td
                              className="p-1 px-1.5 border border-gray-300 text-center text-[10px] text-gray-600 max-w-[80px] break-words"
                              title={ledger.voucherNo || ''}
                            >
                              {ledger.voucherNo || '-'}
                            </td>
                            <td className="p-1 px-1.5 border border-gray-300 text-right font-mono">
                              {ledger.receiptCash > 0 ? formatAmount(ledger.receiptCash) : '-'}
                            </td>
                            <td className="p-1 px-1.5 border border-gray-300 text-right font-mono">
                              {ledger.receiptTransfer > 0 ? formatAmount(ledger.receiptTransfer) : '-'}
                            </td>
                            <td className="p-1 px-1.5 border border-gray-300 text-right font-mono font-bold bg-blue-50/40 print:bg-transparent">
                              {ledger.receiptTotal > 0 ? formatAmount(ledger.receiptTotal) : '-'}
                            </td>
                            <td className="p-1 px-1.5 border border-gray-300 text-right font-mono">
                              {ledger.paymentCash > 0 ? formatAmount(ledger.paymentCash) : '-'}
                            </td>
                            <td className="p-1 px-1.5 border border-gray-300 text-right font-mono">
                              {ledger.paymentTransfer > 0 ? formatAmount(ledger.paymentTransfer) : '-'}
                            </td>
                            <td className="p-1 px-1.5 border border-gray-300 text-right font-mono font-bold bg-amber-50/40 print:bg-transparent">
                              {ledger.paymentTotal > 0 ? formatAmount(ledger.paymentTotal) : '-'}
                            </td>
                          </tr>
                        ))}

                        {/* Group Total Row */}
                        <tr className="bg-slate-50 print:bg-transparent font-bold border-y border-gray-400">
                          <td className="p-1 px-1.5 border border-gray-800 text-right uppercase text-[10px]" colSpan={2}>
                            गट एकूण (Group Total) (₹)
                          </td>
                          <td className="p-1 px-1.5 border border-gray-800 text-right font-mono">
                            {formatAmount(group.ledgers.reduce((sum, l) => sum + l.receiptCash, 0))}
                          </td>
                          <td className="p-1 px-1.5 border border-gray-800 text-right font-mono">
                            {formatAmount(group.ledgers.reduce((sum, l) => sum + l.receiptTransfer, 0))}
                          </td>
                          <td className="p-1 px-1.5 border border-gray-800 text-right font-mono font-extrabold bg-blue-100/60 print:bg-transparent text-[11px]">
                            {formatAmount(group.ledgers.reduce((sum, l) => sum + l.receiptTotal, 0))}
                          </td>
                          <td className="p-1 px-1.5 border border-gray-800 text-right font-mono">
                            {formatAmount(group.ledgers.reduce((sum, l) => sum + l.paymentCash, 0))}
                          </td>
                          <td className="p-1 px-1.5 border border-gray-800 text-right font-mono">
                            {formatAmount(group.ledgers.reduce((sum, l) => sum + l.paymentTransfer, 0))}
                          </td>
                          <td className="p-1 px-1.5 border border-gray-800 text-right font-mono font-extrabold bg-amber-100/60 print:bg-transparent text-[11px]">
                            {formatAmount(group.ledgers.reduce((sum, l) => sum + l.paymentTotal, 0))}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}

                    {/* Day's Transactions Total Row */}
                    <tr className="bg-amber-50/70 print:bg-gray-200 font-extrabold border-y-2 border-gray-900 text-gray-900">
                      <td className="p-1 px-1.5 border border-gray-800 text-right uppercase text-[11px]" colSpan={2}>
                        दैनंदिन व्यवहार एकूण (Transactions Total)
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-right font-mono">
                        {formatAmount(data.totalReceiptsCash)}
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-right font-mono">
                        {formatAmount(data.totalReceiptsTransfer)}
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-right font-mono font-extrabold text-[11px] bg-blue-100/70 print:bg-gray-200">
                        {formatAmount(data.totalReceiptsCash + data.totalReceiptsTransfer)}
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-right font-mono">
                        {formatAmount(data.totalPaymentsCash)}
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-right font-mono">
                        {formatAmount(data.totalPaymentsTransfer)}
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-right font-mono font-extrabold text-[11px] bg-amber-100/70 print:bg-gray-200">
                        {formatAmount(data.totalPaymentsCash + data.totalPaymentsTransfer)}
                      </td>
                    </tr>

                    {/* Opening Balance and Closing Cash Row */}
                    <tr className="bg-blue-50/70 print:bg-gray-100 font-extrabold border-y border-gray-800 text-gray-900">
                      <td className="p-1 px-1.5 border border-gray-800 text-right uppercase text-[10.5px]" colSpan={2}>
                        📌 आरंभीची रोख शिल्लक (Opening Cash Balance)
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-center font-mono font-black tracking-wider text-[11px]" colSpan={3}>
                        {formatAmount(data.openingBalance)}
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-right uppercase text-[10.5px]" colSpan={2}>
                        🏁 अखेरची रोख शिल्लक (Closing Cash Balance)
                      </td>
                      <td className="p-1 px-1.5 border border-gray-800 text-right font-mono font-black tracking-wider text-[11px]">
                        {formatAmount(data.closingBalance)}
                      </td>
                    </tr>

                    {/* Final Grand Total Row */}
                    <tr className="bg-emerald-100/70 print:bg-gray-200 font-black border-y-2 border-gray-900 text-emerald-950 print:text-black uppercase text-[11.5px]">
                      <td className="p-1.5 px-1.5 border border-gray-900 text-right font-extrabold" colSpan={2}>
                        सर्व एकूण (GRAND TOTAL)
                      </td>
                      <td className="p-1.5 px-1.5 border border-gray-900 text-center font-mono font-black tracking-wider text-[12px]" colSpan={3}>
                        {formatAmount(data.totalReceiptsCash + data.totalReceiptsTransfer + data.openingBalance)}
                      </td>
                      <td className="p-1.5 px-1.5 border border-gray-900 text-right font-extrabold" colSpan={2}>
                        सर्व एकूण (GRAND TOTAL)
                      </td>
                      <td className="p-1.5 px-1.5 border border-gray-900 text-right font-mono font-black tracking-wider text-[12px]">
                        {formatAmount(data.totalPaymentsCash + data.totalPaymentsTransfer + data.closingBalance)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Footer Area */}
                <div className="mt-3 font-bold text-[10px] uppercase tracking-wide border-b border-gray-300 pb-2">
                  अखेरची रोख शिल्लक अक्षरी (Closing Cash In Words) :{' '}
                  <span className="border-b border-dashed border-gray-800 pb-0.5 font-semibold text-gray-900">
                    {formatAmount(data.closingBalance)} Rupees Only
                  </span>
                </div>

                <div className="mt-12 text-center text-[10px]">
                  <div className="flex justify-between font-bold text-[11px] uppercase">
                    <div className="border-t border-black pt-1 px-4 w-48 text-center">तपासणारा (Clerk)</div>
                    <div className="border-t border-black pt-1 px-4 w-48 text-center">व्यवस्थापक (Manager)</div>
                    <div className="border-t border-black pt-1 px-4 w-48 text-right">
                      <div className="font-normal text-[9px] mb-0.5">
                        Printed On : {new Date().toLocaleString('en-IN', { hour12: false }).replace(',', '')}
                      </div>
                      <div className="font-normal text-[9px]">Printed By : {user?.username || 'SYSTEM'}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

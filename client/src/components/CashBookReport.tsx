import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

interface CashBookEntry {
  voucherNo: string;
  details: string;
  amount: number;
}

interface CashBookGroup {
  ledgerId: number;
  ledgerName: string;
  totalAmount: number;
  entries: CashBookEntry[];
}

interface CashBookResponse {
  openingBalance: number;
  openingType: string;
  closingBalance: number;
  closingType: string;
  receipts: CashBookGroup[];
  payments: CashBookGroup[];
  totalReceipts: number;
  totalPayments: number;
}

interface SansthaDetails {
  sansthaName: string;
  address: string;
  registrationNo: string;
}

export default function CashBookReport() {
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [pages, setPages] = useState<{ date: string; data: CashBookResponse }[]>([]);
  const [sanstha, setSanstha] = useState<SansthaDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  useEffect(() => {
    fetchSanstha();
    fetchBranches();
    fetchReport();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/Branches');
      if (res.ok) setBranches(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSanstha = async () => {
    try {
      const res = await fetch('/api/SansthaDetails');
      if (res.ok) {
        const result = await res.json();
        if (result && result.length > 0) setSanstha(result[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = `/api/Reports/CashBookBatch?date=${fromDate}&toDate=${toDate}`;
      if (selectedBranchId !== 'all') {
        url += `&branchId=${selectedBranchId}`;
      }

      const response = await fetch(url);
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const batchData = await response.json();
        const newPages: { date: string; data: CashBookResponse }[] = (batchData.days || []).map(
          (day: { date: string; data: CashBookResponse }) => ({
            date: day.date,
            data: day.data,
          })
        );
        setPages(newPages);
        if (newPages.length === 0) {
          setError('या तारखांमध्ये कोणताही व्यवहार आढळला नाही. (No transactions found)');
        }
      } else {
        setError('सर्व्हरशी संपर्क होत आहे किंवा नवीन बॅकएंड रीस्टार्ट करा. (Failed to load report - please ensure API server is running)');
      }
    } catch (err) {
      console.error(err);
      setError('सर्व्हरशी संपर्क होऊ शकला नाही.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (pages.length === 0) return;
    const rows: any[] = [];

    rows.push([sanstha?.sansthaName || 'संस्थेचे नाव']);
    rows.push([sanstha?.address || '']);
    rows.push(['रोख पुस्तक (CASH BOOK)']);
    rows.push([`कालावधी: ${formatDate(fromDate)} ते ${formatDate(toDate)}`]);
    rows.push([]);

    pages.forEach((page) => {
      const data = page.data;
      rows.push([`दिनांक: ${formatDate(page.date)}`]);
      rows.push(['जमा / RECEIPT', '', '', '', 'नावे / PAYMENT', '', '', '']);
      rows.push(['ले.नं.', 'खाते नाव / तपशील', 'व्हाउचर क्र.', 'रक्कम (₹)', 'ले.नं.', 'खाते नाव / तपशील', 'व्हाउचर क्र.', 'रक्कम (₹)']);

      // Opening balance
      rows.push([
        '-',
        'आरंभीची शिल्लक',
        '',
        data.openingType === 'Dr' ? data.openingBalance : 0,
        '-',
        'आरंभीची शिल्लक (Cr)',
        '',
        data.openingType === 'Cr' ? data.openingBalance : 0,
      ]);

      const receiptList: { ledgerId: number; ledgerName: string; voucherNo: string; details: string; amount: number }[] = [];
      data.receipts.forEach((g) => {
        g.entries.forEach((e) => {
          receiptList.push({ ledgerId: g.ledgerId, ledgerName: g.ledgerName, voucherNo: e.voucherNo, details: e.details, amount: e.amount });
        });
      });

      const paymentList: { ledgerId: number; ledgerName: string; voucherNo: string; details: string; amount: number }[] = [];
      data.payments.forEach((g) => {
        g.entries.forEach((e) => {
          paymentList.push({ ledgerId: g.ledgerId, ledgerName: g.ledgerName, voucherNo: e.voucherNo, details: e.details, amount: e.amount });
        });
      });

      const maxLen = Math.max(receiptList.length, paymentList.length);
      for (let i = 0; i < maxLen; i++) {
        const r = receiptList[i];
        const p = paymentList[i];
        rows.push([
          r ? r.ledgerId : '',
          r ? `${r.ledgerName} ${r.details ? '(' + r.details + ')' : ''}` : '',
          r ? r.voucherNo : '',
          r ? r.amount : '',
          p ? p.ledgerId : '',
          p ? `${p.ledgerName} ${p.details ? '(' + p.details + ')' : ''}` : '',
          p ? p.voucherNo : '',
          p ? p.amount : '',
        ]);
      }

      const totalR = (data.openingType === 'Dr' ? data.openingBalance : 0) + data.totalReceipts;
      const totalP = data.totalPayments + (data.closingType === 'Dr' ? data.closingBalance : 0);

      rows.push(['', 'एकूण जमा', '', totalR, '', 'एकूण खर्च + अखेरची शिल्लक', '', totalP]);
      rows.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CashBook');
    XLSX.writeFile(wb, `CashBook_Report_${fromDate}_to_${toDate}.xlsx`);
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
      {/* Print styles matching Daybook */}
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
              <span className="text-xs">💵</span>
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>रोख पुस्तक अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Cash Book Report)</span>
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
            const pageData = page.data;
            const pageDate = page.date;
            const openBalDr = pageData.openingType === 'Dr' ? pageData.openingBalance : 0;
            const openBalCr = pageData.openingType === 'Cr' ? pageData.openingBalance : 0;
            const totalReceiptsSide = openBalDr + pageData.totalReceipts;
            const closingBalDr = pageData.closingType === 'Dr' ? pageData.closingBalance : 0;
            const totalPaymentsSide = pageData.totalPayments + closingBalDr;

            return (
              <div
                key={idx}
                className="bg-white border-2 border-gray-900 p-3 mx-auto shadow-sm print:border-2 print:border-black print:shadow-none print:p-2 bg-white"
                style={{
                  maxWidth: '297mm',
                  minHeight: '200mm',
                  pageBreakAfter: idx < pages.length - 1 ? 'always' : 'auto',
                }}
              >
                {/* Header Block */}
                <div className="border-2 border-gray-900 mb-2 p-2 relative bg-gray-50/50 print:bg-white text-center">
                  <div className="flex justify-between items-center text-[11px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1.5">
                    <div><span>रजि. नं. - </span><span className="font-mono">{sanstha?.registrationNo || '-'}</span></div>
                    <div><span>शाखा: </span><span className="text-primary font-bold">{getBranchName()}</span></div>
                    <div><span>रजि. दि. - </span><span className="font-mono">{sanstha?.registrationDate ? formatDate(sanstha.registrationDate) : '-'}</span></div>
                  </div>

                  <h1 className="text-base font-black text-gray-900 tracking-wide uppercase font-serif">{sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h1>
                  <h2 className="text-[11px] font-semibold text-gray-700 mt-0.5">{sanstha?.address || ''} {sanstha?.village ? `मु. ${sanstha.village}, ` : ''}{sanstha?.taluka ? `ता. ${sanstha.taluka}, ` : ''}{sanstha?.district ? `जि. ${sanstha.district}` : ''}</h2>

                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="w-24"></div>
                    <span className="border-2 border-gray-900 font-extrabold px-6 py-0.5 bg-gray-200 print:bg-gray-100 text-xs tracking-wider text-gray-900 shadow-2xs font-serif uppercase">
                      रोख पुस्तक (CASH BOOK)
                    </span>
                    <div className="text-right text-[11px] font-bold text-gray-800">
                      दिनांक : <span className="font-mono">{formatDate(pageDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Main 2-Column Table */}
                <div className="w-full border-2 border-gray-900 flex text-[10.5px] leading-tight">
                  {/* Left Column: Receipts (जमा) */}
                  <div className="w-1/2 border-r-2 border-gray-900 flex flex-col">
                    <div className="border-b-2 border-gray-900 text-center font-black py-1 bg-emerald-100 print:bg-gray-200 text-emerald-900 print:text-black uppercase tracking-wider text-xs">
                      जमा / RECEIPT
                    </div>

                    {/* Column Headers */}
                    <div className="flex border-b-2 border-gray-900 font-bold text-center bg-gray-100 print:bg-gray-200 text-[10px]">
                      <div className="w-10 border-r border-gray-800 py-1">ले.नं.</div>
                      <div className="flex-1 border-r border-gray-800 py-1">तपशील (Particulars)</div>
                      <div className="w-24 border-r border-gray-800 py-1 text-right pr-1">रक्कम (₹)</div>
                      <div className="w-10 py-1">सही</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 pb-1">
                      {/* Receipts Groups */}
                      {pageData.receipts.map((group, gIdx) => (
                        <React.Fragment key={gIdx}>
                          <div className="flex border-b border-gray-400 font-bold bg-slate-100/80 print:bg-gray-100">
                            <div className="w-10 border-r border-gray-400 px-1 py-1 text-center font-mono font-bold text-gray-800">
                              {group.ledgerId}
                            </div>
                            <div className="flex-1 border-r border-gray-400 px-1 py-1 font-bold text-gray-900">
                              {group.ledgerName}
                            </div>
                            <div className="w-24 border-r border-gray-400 px-1 py-1 text-right font-mono font-bold bg-gray-200/50 print:bg-gray-100">
                              {formatAmount(group.totalAmount)}
                            </div>
                            <div className="w-10 px-1 py-1"></div>
                          </div>

                          {group.entries.map((entry, eIdx) => (
                            <div
                              key={eIdx}
                              className="flex border-b border-dashed border-gray-300 print:border-gray-400 text-gray-800"
                            >
                              <div className="w-10 border-r border-gray-300 print:border-gray-400 px-1 py-0.5"></div>
                              <div className="flex-1 border-r border-gray-300 print:border-gray-400 px-1 py-0.5 pl-3 text-[10px]">
                                {entry.voucherNo && (
                                  <span className="font-bold text-primary print:text-black mr-1">
                                    [{entry.voucherNo}]
                                  </span>
                                )}
                                <span>{entry.details}</span>
                              </div>
                              <div className="w-24 border-r border-gray-300 print:border-gray-400 px-1 py-0.5 text-right font-mono">
                                {formatAmount(entry.amount)}
                              </div>
                              <div className="w-10 px-1 py-0.5"></div>
                            </div>
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Payments (नावे) */}
                  <div className="w-1/2 flex flex-col">
                    <div className="border-b-2 border-gray-900 text-center font-black py-1 bg-rose-100 print:bg-gray-200 text-rose-900 print:text-black uppercase tracking-wider text-xs">
                      नावे / PAYMENT
                    </div>

                    {/* Column Headers */}
                    <div className="flex border-b-2 border-gray-900 font-bold text-center bg-gray-100 print:bg-gray-200 text-[10px]">
                      <div className="w-10 border-r border-gray-800 py-1">ले.नं.</div>
                      <div className="flex-1 border-r border-gray-800 py-1">तपशील (Particulars)</div>
                      <div className="w-24 border-r border-gray-800 py-1 text-right pr-1">रक्कम (₹)</div>
                      <div className="w-10 py-1">सही</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 pb-1">
                      {/* Credit Opening Balance if any */}
                      {openBalCr > 0 && (
                        <div className="flex border-b border-gray-400 font-extrabold bg-blue-50/70 print:bg-gray-100 text-gray-900">
                          <div className="w-10 border-r border-gray-400 px-1 py-1 text-center">-</div>
                          <div className="flex-1 border-r border-gray-400 px-1 py-1 font-black text-rose-900 print:text-black">
                            📌 आरंभीची रोख शिल्लक (Cr)
                          </div>
                          <div className="w-24 border-r border-gray-400 px-1 py-1 text-right font-mono font-black">
                            {formatAmount(openBalCr)}
                          </div>
                          <div className="w-10 px-1 py-1"></div>
                        </div>
                      )}

                      {pageData.payments.map((group, gIdx) => (
                        <React.Fragment key={gIdx}>
                          <div className="flex border-b border-gray-400 font-bold bg-slate-100/80 print:bg-gray-100">
                            <div className="w-10 border-r border-gray-400 px-1 py-1 text-center font-mono font-bold text-gray-800">
                              {group.ledgerId}
                            </div>
                            <div className="flex-1 border-r border-gray-400 px-1 py-1 font-bold text-gray-900">
                              {group.ledgerName}
                            </div>
                            <div className="w-24 border-r border-gray-400 px-1 py-1 text-right font-mono font-bold bg-gray-200/50 print:bg-gray-100">
                              {formatAmount(group.totalAmount)}
                            </div>
                            <div className="w-10 px-1 py-1"></div>
                          </div>

                          {group.entries.map((entry, eIdx) => (
                            <div
                              key={eIdx}
                              className="flex border-b border-dashed border-gray-300 print:border-gray-400 text-gray-800"
                            >
                              <div className="w-10 border-r border-gray-300 print:border-gray-400 px-1 py-0.5"></div>
                              <div className="flex-1 border-r border-gray-300 print:border-gray-400 px-1 py-0.5 pl-3 text-[10px]">
                                {entry.voucherNo && (
                                  <span className="font-bold text-rose-700 print:text-black mr-1">
                                    [{entry.voucherNo}]
                                  </span>
                                )}
                                <span>{entry.details}</span>
                              </div>
                              <div className="w-24 border-r border-gray-300 print:border-gray-400 px-1 py-0.5 text-right font-mono">
                                {formatAmount(entry.amount)}
                              </div>
                              <div className="w-10 px-1 py-0.5"></div>
                            </div>
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Grand Totals Section - Symmetrical 3-Row Layout */}
                <div className="w-full border-b-2 border-l-2 border-r-2 border-gray-900 flex text-[10.5px] font-bold bg-gray-100 print:bg-white">
                  {/* Left Side Total (Receipts) */}
                  <div className="w-1/2 border-r-2 border-gray-900 flex flex-col">
                    {/* Row 1: Total Receipts */}
                    <div className="flex border-b border-gray-800 font-bold">
                      <div className="w-10 px-1 py-1"></div>
                      <div className="flex-1 px-1 py-1 text-center">एकूण जमा (Total Receipts)</div>
                      <div className="w-24 border-l border-gray-800 px-1 py-1 text-right font-mono font-bold">
                        {formatAmount(pageData.totalReceipts)}
                      </div>
                      <div className="w-10 px-1 py-1 border-l border-gray-800"></div>
                    </div>

                    {/* Row 2: Opening Cash Balance */}
                    <div className="flex border-b border-gray-800 font-extrabold bg-blue-50/70 print:bg-gray-200 text-gray-900">
                      <div className="w-10 px-1 py-1"></div>
                      <div className="flex-1 px-1 py-1 text-center font-black text-blue-900 print:text-black">
                        📌 आरंभीची रोख शिल्लक (Opening Balance)
                      </div>
                      <div className="w-24 border-l border-gray-800 px-1 py-1 text-right font-mono font-black text-blue-900 print:text-black bg-blue-100 print:bg-gray-300">
                        {formatAmount(openBalDr)}
                      </div>
                      <div className="w-10 px-1 py-1 border-l border-gray-800"></div>
                    </div>

                    {/* Row 3: Grand Total Left */}
                    <div className="flex font-black bg-gray-200 print:bg-gray-100">
                      <div className="w-10 px-1 py-1"></div>
                      <div className="flex-1 px-1 py-1 text-center text-xs">एकूण (Grand Total)</div>
                      <div className="w-24 border-l border-gray-800 px-1 py-1 text-right font-mono font-black bg-slate-300 print:bg-gray-300">
                        {formatAmount(totalReceiptsSide)}
                      </div>
                      <div className="w-10 px-1 py-1 border-l border-gray-800"></div>
                    </div>
                  </div>

                  {/* Right Side Total (Payments + Closing Balance) */}
                  <div className="w-1/2 flex flex-col">
                    {/* Row 1: Total Payments */}
                    <div className="flex border-b border-gray-800 font-bold">
                      <div className="w-10 px-1 py-1"></div>
                      <div className="flex-1 px-1 py-1 text-center">एकूण खर्च (Total Payments)</div>
                      <div className="w-24 border-l border-gray-800 px-1 py-1 text-right font-mono font-bold">
                        {formatAmount(pageData.totalPayments)}
                      </div>
                      <div className="w-10 px-1 py-1 border-l border-gray-800"></div>
                    </div>

                    {/* Row 2: Closing Cash Balance */}
                    <div className="flex border-b border-gray-800 font-extrabold bg-emerald-100/70 print:bg-gray-200 text-gray-900">
                      <div className="w-10 px-1 py-1"></div>
                      <div className="flex-1 px-1 py-1 text-center font-black text-emerald-900 print:text-black">
                        📌 अखेरची रोख शिल्लक (Closing Balance)
                      </div>
                      <div className="w-24 border-l border-gray-800 px-1 py-1 text-right font-mono font-black text-emerald-900 print:text-black bg-emerald-200 print:bg-gray-300">
                        {formatAmount(closingBalDr)}
                      </div>
                      <div className="w-10 px-1 py-1 border-l border-gray-800"></div>
                    </div>

                    {/* Row 3: Grand Total Right */}
                    <div className="flex font-black bg-gray-200 print:bg-gray-100">
                      <div className="w-10 px-1 py-1"></div>
                      <div className="flex-1 px-1 py-1 text-center text-xs">एकूण (Grand Total)</div>
                      <div className="w-24 border-l border-gray-800 px-1 py-1 text-right font-mono font-black bg-slate-300 print:bg-gray-300">
                        {formatAmount(totalPaymentsSide)}
                      </div>
                      <div className="w-10 px-1 py-1 border-l border-gray-800"></div>
                    </div>
                  </div>
                </div>

                {/* Official Cash Balance Banner */}
                <div className="mt-2.5 p-1.5 bg-amber-50 print:bg-white border-2 border-amber-300 print:border-black rounded-xs text-center font-black text-xs text-amber-900 print:text-black shadow-2xs">
                  💼 अखेरची शिल्लक ₹ {formatAmount(closingBalDr)} (सचिव / सेल्समन / कॅशियर यांचेकडे आहे)
                </div>

                {/* Official Signatures Block */}
                <div className="flex justify-between items-center px-6 mt-10 pt-2 text-[11px] font-bold text-gray-900">
                  <div className="w-1/3 text-center">
                    <div className="border-t-2 border-gray-900 pt-1 w-36 mx-auto">कॅशियर / क्लार्क</div>
                  </div>
                  <div className="w-1/3 text-center">
                    <div className="border-t-2 border-gray-900 pt-1 w-36 mx-auto">सचिव / व्यवस्थापक</div>
                  </div>
                  <div className="w-1/3 text-center">
                    <div className="border-t-2 border-gray-900 pt-1 w-36 mx-auto">अध्यक्ष / चेअरमन</div>
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

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import html2pdf from 'html2pdf.js';

export interface DaybookProps {
  initialVoucherStatus?: 'approved' | 'pending' | 'all';
}

interface DaybookEntry {
  voucherNo: string;
  narration: string;
  cashAmount: number;
  transferAmount: number;
  status?: string;
}

interface DaybookGroup {
  ledgerId: number;
  ledgerName: string;
  totalCash: number;
  totalTransfer: number;
  entries: DaybookEntry[];
}

interface DaybookResponse {
  openingBalance: number;
  closingBalance: number;
  receipts: DaybookGroup[];
  payments: DaybookGroup[];
  totalReceiptsCash: number;
  totalReceiptsTransfer: number;
  totalPaymentsCash: number;
  totalPaymentsTransfer: number;
  voucherStatus?: string;
  isDraft?: boolean;
}

const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Daybook({ initialVoucherStatus }: DaybookProps = {}) {
  const { user } = useAuth();
  const pagesAreaRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [reportViewType, setReportViewType] = useState<'detailed' | 'ledger-wise'>('detailed');

  const getInitialStatus = (): 'approved' | 'pending' | 'all' => {
    if (initialVoucherStatus) return initialVoucherStatus;
    const params = new URLSearchParams(window.location.search);
    const s = params.get('voucherStatus') || params.get('status');
    if (s === 'pending' || s === 'draft') return 'pending';
    if (s === 'all') return 'all';
    return 'approved';
  };

  const [voucherStatus, setVoucherStatus] = useState<'approved' | 'pending' | 'all'>(getInitialStatus);
  const [fromDate, setFromDate] = useState<string>(getTodayDate());
  const [toDate, setToDate] = useState<string>(getTodayDate());
  const [pages, setPages] = useState<{ date: string; data: DaybookResponse }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sansthaName, setSansthaName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [registrationNo, setRegistrationNo] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  useEffect(() => {
    fetchBranches();
    fetchSansthaName();
    fetchReport(getInitialStatus());
  }, []);

  useEffect(() => {
    if (initialVoucherStatus && initialVoucherStatus !== voucherStatus) {
      setVoucherStatus(initialVoucherStatus);
      fetchReport(initialVoucherStatus);
    }
  }, [initialVoucherStatus]);

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

  const fetchReport = async (overrideStatus?: 'approved' | 'pending' | 'all') => {
    setLoading(true);
    setError(null);

    const activeStatus = overrideStatus || voucherStatus;
    try {
      let url = `/api/Reports/DaybookBatch?date=${fromDate}&toDate=${toDate}&voucherStatus=${activeStatus}`;
      if (selectedBranchId !== 'all') {
        url += `&branchId=${selectedBranchId}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const batchData = await response.json();
        const newPages: { date: string; data: DaybookResponse }[] = (batchData.days || []).map(
          (day: { date: string; data: DaybookResponse }) => {
            const cleanGroups = (groups: DaybookGroup[]) => {
              return (groups || []).map(g => {
                const cleanEntries = (g.entries || []).filter(e => {
                  const n = (e.narration || '').toLowerCase();
                  return !n.includes('opening balance') && !n.includes('आरंभीची शिल्लक') && !n.includes('स्थलांतर');
                });
                const cashTotal = cleanEntries.reduce((sum, e) => sum + (e.cashAmount || 0), 0);
                const transferTotal = cleanEntries.reduce((sum, e) => sum + (e.transferAmount || 0), 0);
                return {
                  ...g,
                  entries: cleanEntries,
                  totalCash: cashTotal,
                  totalTransfer: transferTotal
                };
              }).filter(g => g.entries.length > 0);
            };

            return {
              date: day.date,
              data: {
                ...day.data,
                receipts: cleanGroups(day.data?.receipts || []),
                payments: cleanGroups(day.data?.payments || [])
              },
            };
          }
        );
        setPages(newPages);
        if (newPages.length === 0) {
          setError('या तारखांमध्ये कोणताही व्यवहार आढळला नाही. (No transactions found)');
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
    const filePrefix = voucherStatus === 'pending' ? 'Draft_Daybook' : voucherStatus === 'all' ? 'Combined_Daybook' : 'Daybook';
    const statusLabel = voucherStatus === 'pending' ? 'कच्ची रोजकीर्द - व्हाउचर पासिंग पूर्व (Draft Pre-Posting)' : voucherStatus === 'all' ? 'एकत्रित रोजकीर्द (Combined)' : 'पक्की रोजकीर्द (Posted)';
    let csv = `रजि.नं.,${registrationNo || '-'}\n`;
    csv += `संस्था नाव,${sansthaName}\n`;
    csv += `पत्ता,${address}\n`;
    csv += `स्थिती (Status),${statusLabel}\n`;
    csv += `अहवाल प्रकार,${reportViewType === 'ledger-wise' ? 'खातेवहीनुसार रोजकीर्द (Ledger-wise Summary)' : 'तपशीलवार रोजकीर्द (Detailed)'}\n`;
    csv += `दिनांक,${formatDate(fromDate)} ते ${formatDate(toDate)}\n\n`;

    pages.forEach((page, idx) => {
      csv += `--- रोजकीर्द दिनांक: ${formatDate(page.date)} ---\n`;
      csv += `आरंभीची शिल्लक,${page.data.openingBalance}\n\n`;

      if (reportViewType === 'ledger-wise') {
        csv += `प्रकार,लेजर आयडी,खातेवही नाव (Ledger Name),रोख (Cash),वर्ग (Transfer),एकूण (Total)\n`;

        page.data.receipts.forEach(g => {
          csv += `जमा (Receipt),${g.ledgerId},"${g.ledgerName}",${g.totalCash},${g.totalTransfer},${g.totalCash + g.totalTransfer}\n`;
        });

        page.data.payments.forEach(g => {
          csv += `नावे (Payment),${g.ledgerId},"${g.ledgerName}",${g.totalCash},${g.totalTransfer},${g.totalCash + g.totalTransfer}\n`;
        });
      } else {
        csv += `प्रकार,लेजर आयडी,लेजर नाव,व्हाउचर क्र.,तपशील,स्थिती,रोख (Cash),वर्ग (Transfer),एकूण\n`;

        page.data.receipts.forEach(g => {
          g.entries.forEach(e => {
            csv += `जमा (Receipt),${g.ledgerId},"${g.ledgerName}",${e.voucherNo || ''},"${e.narration || ''}",${e.status || ''},${e.cashAmount},${e.transferAmount},${e.cashAmount + e.transferAmount}\n`;
          });
        });

        page.data.payments.forEach(g => {
          g.entries.forEach(e => {
            csv += `नावे (Payment),${g.ledgerId},"${g.ledgerName}",${e.voucherNo || ''},"${e.narration || ''}",${e.status || ''},${e.cashAmount},${e.transferAmount},${e.cashAmount + e.transferAmount}\n`;
          });
        });
      }

      csv += `\nएकूण जमा रोख,${page.data.totalReceiptsCash},वर्ग,${page.data.totalReceiptsTransfer}\n`;
      csv += `एकूण खर्च रोख,${page.data.totalPaymentsCash},वर्ग,${page.data.totalPaymentsTransfer}\n`;
      csv += `अखेरची शिल्लक,${page.data.closingBalance}\n\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filePrefix}_${reportViewType}_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatAmount = (amount: number) => {
    return Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleDownloadPdf = async () => {
    if (!pagesAreaRef.current) return;
    setDownloadingPdf(true);

    const pdfPrefix = voucherStatus === 'pending' ? 'Draft_Daybook' : voucherStatus === 'all' ? 'Combined_Daybook' : 'Daybook';
    const opt = {
      margin: [5, 5, 5, 5],
      filename: `${pdfPrefix}_Report_${fromDate}_to_${toDate}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    try {
      await html2pdf().set(opt as any).from(pagesAreaRef.current).save();
    } catch (err) {
      console.error('PDF generation error:', err);
      handlePrint();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getBranchName = () => {
    if (selectedBranchId === 'all') return 'सर्व शाखा (All Branches)';
    const b = branches.find(item => item.branchID.toString() === selectedBranchId);
    return b ? b.branchName : 'मुख्य शाखा';
  };

  return (
    <div className="p-1 max-w-[1300px] mx-auto bg-gray-50 min-h-screen font-sans print:p-0 print:bg-white text-xs">
      {/* Print styles */}
      <style>
        {`
          @media print {
            @page { size: landscape; margin: 5mm; }
            body { background-color: white !important; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important; font-size: 8.5pt !important; color: black !important; margin: 0 !important; padding: 0 !important; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .daybook-page {
              width: 100% !important;
              max-width: none !important;
              min-height: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border-color: black !important;
              page-break-before: always !important;
              page-break-after: always !important;
              page-break-inside: avoid !important;
              break-before: page !important;
              break-after: page !important;
              break-inside: avoid !important;
              box-sizing: border-box !important;
            }
            .daybook-page:first-child {
              page-break-before: auto !important;
              break-before: auto !important;
            }
            .daybook-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
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
              <span className="text-xs">📖</span>
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>रोजकीर्द अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Daybook Report)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Daybook Mode / Voucher Status */}
            <div className="w-44 sm:w-56">
              <select
                value={voucherStatus}
                onChange={e => {
                  const newStatus = e.target.value as 'approved' | 'pending' | 'all';
                  setVoucherStatus(newStatus);
                  fetchReport(newStatus);
                }}
                className={`h-6 border rounded-sm px-1.5 text-[11px] font-bold focus:outline-none focus:ring-1 w-full transition-colors cursor-pointer ${
                  voucherStatus === 'pending'
                    ? 'border-amber-500 text-amber-900 bg-amber-50 focus:border-amber-600 focus:ring-amber-500'
                    : voucherStatus === 'all'
                    ? 'border-indigo-500 text-indigo-900 bg-indigo-50 focus:border-indigo-600 focus:ring-indigo-500'
                    : 'border-emerald-600 text-emerald-900 bg-emerald-50 focus:border-emerald-700 focus:ring-emerald-600'
                }`}
                title="रोजकीर्द प्रकार निवडा (पक्की / कच्ची / एकत्रित)"
              >
                <option value="approved">१. पक्की रोजकीर्द (मंजूर / Posted)</option>
                <option value="pending">२. कच्ची रोजकीर्द (पासिंग पूर्व / Draft)</option>
                <option value="all">३. एकत्रित रोजकीर्द (सर्व / Combined)</option>
              </select>
            </div>

            {/* Report View Type */}
            <div className="w-36 sm:w-40">
              <select
                value={reportViewType}
                onChange={e => setReportViewType(e.target.value as 'detailed' | 'ledger-wise')}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full text-primary"
              >
                <option value="detailed">१. तपशीलवार रोजकीर्द</option>
                <option value="ledger-wise">२. खातेवहीनुसार रोजकीर्द</option>
              </select>
            </div>

            {/* Branch */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
              <select
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
              >
                <option value="all">सर्व शाखा (All)</option>
                {branches.map(b => (
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
                onChange={e => setFromDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पर्यंत:</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* View Button */}
            <button
              onClick={() => fetchReport()}
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
              onClick={handleDownloadPdf}
              disabled={pages.length === 0 || downloadingPdf}
              className={`h-6 bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${(pages.length === 0 || downloadingPdf) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="PDF डाउनलोड करा"
            >
              <span>{downloadingPdf ? 'PDF...' : 'PDF'}</span>
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

      {/* Amber Draft Daybook Notice Banner (Pre-Posting Maker-Checker Audit) */}
      {voucherStatus === 'pending' && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-sm p-2.5 mb-3 no-print text-amber-900 flex items-start gap-2 shadow-xs">
          <span className="text-base leading-none">⚠️</span>
          <div className="flex-1 text-xs">
            <div className="font-extrabold flex items-center gap-1.5 text-[11px]">
              <span>कच्ची रोजकीर्द (व्हाउचर पासिंग पूर्व - PRE-POSTING / DRAFT DAYBOOK)</span>
              <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 font-mono text-[9px] rounded font-bold uppercase">Pre-Posting Audit Mode</span>
            </div>
            <p className="text-[10.5px] mt-0.5 text-amber-800 leading-normal">
              सदर रोजकीर्दीमध्ये अद्याप मंजूर न झालेली प्रलंबित (Pending) व्हाउचर्स समाविष्ट आहेत. दिवसअखेर व्हाउचर पासिंग (Voucher Posting) करण्यापूर्वी कॅश शिल्लक व नोंदींची पडताळणी करण्यासाठी हा अहवाल वापरावा.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-sm mb-4 font-bold text-xs shadow-2xs border border-red-200 no-print flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Report Pages Area */}
      {pages.length > 0 && (
        <div ref={pagesAreaRef} className="space-y-6 print:space-y-0">
          {pages.map((page, idx) => {
            const pageData = page.data;
            const pageDate = page.date;
            return (
              <div
                key={idx}
                className="daybook-page bg-white border-2 border-gray-900 p-3 mx-auto shadow-sm print:border-2 print:border-black print:shadow-none print:p-0"
                style={{
                  maxWidth: '297mm',
                  minHeight: '200mm',
                }}
              >
                {/* Header Block */}
                <div className={`border-2 mb-2 p-2 relative text-center ${
                  voucherStatus === 'pending'
                    ? 'border-amber-800 bg-amber-50/40 print:bg-white print:border-black'
                    : 'border-gray-900 bg-gray-50/50 print:bg-white'
                }`}>
                  {/* Draft Watermark / Stamp on Printed Report */}
                  {voucherStatus === 'pending' && (
                    <div className="border border-amber-500 bg-amber-100 text-amber-900 font-extrabold text-[9.5px] py-0.5 px-2 mb-1 rounded-xs tracking-wider uppercase flex items-center justify-between">
                      <span>⚠️ कच्ची रोजकीर्द / व्हाउचर पासिंग पूर्व मसुदा (DRAFT PRE-POSTING DAYBOOK)</span>
                      <span className="font-mono text-[8.5px]">अंतिम पासिंग बाकी (UNPOSTED)</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[11px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-1.5">
                    <div><span>रजि. नं. - </span><span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span></div>
                    <div><span>शाखा: </span><span className="text-primary font-bold">{getBranchName()}</span></div>
                    <div><span>रजि. दि. - </span><span className="font-mono">{sansthaDetail?.registrationDate ? formatDate(sansthaDetail.registrationDate) : '-'}</span></div>
                  </div>

                  <h1 className="text-base font-black text-gray-900 tracking-wide uppercase font-serif">{sansthaDetail?.sansthaName || sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h1>
                  <h2 className="text-[11px] font-semibold text-gray-700 mt-0.5">{sansthaDetail?.address || address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}</h2>

                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="w-24"></div>
                    <span className={`border-2 font-extrabold px-6 py-0.5 text-xs tracking-wider shadow-2xs font-serif uppercase ${
                      voucherStatus === 'pending'
                        ? 'border-amber-800 bg-amber-200 print:bg-gray-100 text-amber-950 print:text-black'
                        : voucherStatus === 'all'
                        ? 'border-indigo-800 bg-indigo-100 print:bg-gray-100 text-indigo-950 print:text-black'
                        : 'border-gray-900 bg-gray-200 print:bg-gray-100 text-gray-900'
                    }`}>
                      {voucherStatus === 'pending'
                        ? (reportViewType === 'ledger-wise' ? 'कच्ची खातेवहीनुसार रोजकीर्द - पासिंग पूर्व (DRAFT LEDGER-WISE DAYBOOK)' : 'कच्ची रोजकीर्द - व्हाउचर पासिंग पूर्व (PRE-POSTING / DRAFT DAYBOOK)')
                        : voucherStatus === 'all'
                        ? (reportViewType === 'ledger-wise' ? 'एकत्रित खातेवहीनुसार रोजकीर्द (COMBINED LEDGER-WISE DAYBOOK)' : 'एकत्रित रोजकीर्द - मंजूर व प्रलंबित (COMBINED DAYBOOK)')
                        : (reportViewType === 'ledger-wise' ? 'खातेवहीनुसार रोजकीर्द (LEDGER-WISE DAYBOOK)' : 'रोजकीर्द (DAYBOOK)')}
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
                    <div className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-b-2 border-gray-900 font-bold text-center bg-gray-100 print:bg-gray-200 text-[10px]">
                      <div className="border-r border-gray-900 py-1 px-0.5">ले.नं.</div>
                      <div className="border-r border-gray-900 py-1 px-1 text-left">
                        {reportViewType === 'ledger-wise' ? 'खातेवहीचे नाव (Ledger Name)' : 'तपशील (Particulars)'}
                      </div>
                      <div className="border-r border-gray-900 py-1 px-1 text-right">रोख (₹)</div>
                      <div className="border-r border-gray-900 py-1 px-1 text-right">वर्ग (₹)</div>
                      <div className="border-r border-gray-900 py-1 px-1 text-right">एकूण (₹)</div>
                      <div className="py-1 px-0.5">सही</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 pb-0">
                      {/* Receipts Groups */}
                      {pageData.receipts.map((group, gIdx) => (
                        <React.Fragment key={gIdx}>
                          {/* Head Ledger Row - Solid Top & Bottom Borders */}
                          <div className={`grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-t border-b border-gray-800 font-bold ${reportViewType === 'ledger-wise' ? (gIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50') : 'bg-gray-100'} print:bg-gray-100`}>
                            <div className="border-r border-gray-800 px-1 py-1 text-center font-mono font-bold text-gray-900">
                              {group.ledgerId}
                            </div>
                            <div className="border-r border-gray-800 px-2 py-1 font-bold text-gray-900">
                              {group.ledgerName}
                            </div>
                            <div className="border-r border-gray-800 px-1.5 py-1 text-right font-mono font-bold">
                              {group.totalCash > 0 ? formatAmount(group.totalCash) : '-'}
                            </div>
                            <div className="border-r border-gray-800 px-1.5 py-1 text-right font-mono font-bold">
                              {group.totalTransfer > 0 ? formatAmount(group.totalTransfer) : '-'}
                            </div>
                            <div className="border-r border-gray-800 px-1.5 py-1 text-right font-mono font-bold bg-gray-200/60 print:bg-gray-100">
                              {formatAmount(group.totalCash + group.totalTransfer)}
                            </div>
                            <div className="px-1 py-1"></div>
                          </div>

                          {/* Individual Entries Sub-rows: Only shown in Detailed mode */}
                          {reportViewType === 'detailed' && group.entries.map((entry, eIdx) => (
                            <div key={eIdx} className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-b border-gray-200 print:border-gray-200 text-gray-800">
                              <div className="border-r border-gray-300 px-1 py-0.5"></div>
                              <div className="border-r border-gray-300 px-1.5 py-0.5 pl-6 text-[10px]">
                                {entry.voucherNo && (
                                  <span className="font-semibold text-primary print:text-black mr-1.5 font-mono">
                                    [{entry.voucherNo}]
                                    {voucherStatus !== 'approved' && entry.status && (
                                      <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded font-sans font-medium ${
                                        entry.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900 border border-amber-300'
                                      }`}>
                                        {entry.status === 'Approved' ? 'मंजूर' : 'प्रलंबित'}
                                      </span>
                                    )}
                                  </span>
                                )}
                                <span className="text-gray-700">{entry.narration}</span>
                              </div>
                              <div className="border-r border-gray-300 px-1.5 py-0.5 text-right font-mono text-[10px]">
                                {entry.cashAmount > 0 ? formatAmount(entry.cashAmount) : '-'}
                              </div>
                              <div className="border-r border-gray-300 px-1.5 py-0.5 text-right font-mono text-[10px]">
                                {entry.transferAmount > 0 ? formatAmount(entry.transferAmount) : '-'}
                              </div>
                              <div className="border-r border-gray-300 px-1.5 py-0.5 text-right font-mono text-[10px] text-gray-600">
                                {formatAmount(entry.cashAmount + entry.transferAmount)}
                              </div>
                              <div className="px-1 py-0.5"></div>
                            </div>
                          ))}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Payments (नावे) */}
                  <div className="w-1/2 border-r-2 border-transparent flex flex-col">
                    <div className="border-b-2 border-gray-900 text-center font-black py-1 bg-rose-100 print:bg-gray-200 text-rose-900 print:text-black uppercase tracking-wider text-xs">
                      नावे / PAYMENT
                    </div>

                    {/* Column Headers */}
                    <div className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-b-2 border-gray-900 font-bold text-center bg-gray-100 print:bg-gray-200 text-[10px]">
                      <div className="border-r border-gray-900 py-1 px-0.5">ले.नं.</div>
                      <div className="border-r border-gray-900 py-1 px-1 text-left">
                        {reportViewType === 'ledger-wise' ? 'खातेवहीचे नाव (Ledger Name)' : 'तपशील (Particulars)'}
                      </div>
                      <div className="border-r border-gray-900 py-1 px-1 text-right">रोख (₹)</div>
                      <div className="border-r border-gray-900 py-1 px-1 text-right">वर्ग (₹)</div>
                      <div className="border-r border-gray-900 py-1 px-1 text-right">एकूण (₹)</div>
                      <div className="py-1 px-0.5">सही</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex-1 pb-0">
                      {/* Payments Groups */}
                      {pageData.payments.map((group, gIdx) => (
                        <React.Fragment key={gIdx}>
                          {/* Head Ledger Row - Solid Top & Bottom Borders */}
                          <div className={`grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-t border-b border-gray-800 font-bold ${reportViewType === 'ledger-wise' ? (gIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50') : 'bg-gray-100'} print:bg-gray-100`}>
                            <div className="border-r border-gray-800 px-1 py-1 text-center font-mono font-bold text-gray-900">
                              {group.ledgerId}
                            </div>
                            <div className="border-r border-gray-800 px-2 py-1 font-bold text-gray-900">
                              {group.ledgerName}
                            </div>
                            <div className="border-r border-gray-800 px-1.5 py-1 text-right font-mono font-bold">
                              {group.totalCash > 0 ? formatAmount(group.totalCash) : '-'}
                            </div>
                            <div className="border-r border-gray-800 px-1.5 py-1 text-right font-mono font-bold">
                              {group.totalTransfer > 0 ? formatAmount(group.totalTransfer) : '-'}
                            </div>
                            <div className="border-r border-gray-800 px-1.5 py-1 text-right font-mono font-bold bg-gray-200/60 print:bg-gray-100">
                              {formatAmount(group.totalCash + group.totalTransfer)}
                            </div>
                            <div className="px-1 py-1"></div>
                          </div>

                          {/* Individual Entries Sub-rows: Only shown in Detailed mode */}
                          {reportViewType === 'detailed' && group.entries.map((entry, eIdx) => (
                            <div key={eIdx} className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-b border-gray-200 print:border-gray-200 text-gray-800">
                              <div className="border-r border-gray-300 px-1 py-0.5"></div>
                              <div className="border-r border-gray-300 px-1.5 py-0.5 pl-6 text-[10px]">
                                {entry.voucherNo && (
                                  <span className="font-semibold text-rose-700 print:text-black mr-1.5 font-mono">
                                    [{entry.voucherNo}]
                                    {voucherStatus !== 'approved' && entry.status && (
                                      <span className={`ml-1 text-[8.5px] px-1 py-0.2 rounded font-sans font-medium ${
                                        entry.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900 border border-amber-300'
                                      }`}>
                                        {entry.status === 'Approved' ? 'मंजूर' : 'प्रलंबित'}
                                      </span>
                                    )}
                                  </span>
                                )}
                                <span className="text-gray-700">{entry.narration}</span>
                              </div>
                              <div className="border-r border-gray-300 px-1.5 py-0.5 text-right font-mono text-[10px]">
                                {entry.cashAmount > 0 ? formatAmount(entry.cashAmount) : '-'}
                              </div>
                              <div className="border-r border-gray-300 px-1.5 py-0.5 text-right font-mono text-[10px]">
                                {entry.transferAmount > 0 ? formatAmount(entry.transferAmount) : '-'}
                              </div>
                              <div className="border-r border-gray-300 px-1.5 py-0.5 text-right font-mono text-[10px] text-gray-600">
                                {formatAmount(entry.cashAmount + entry.transferAmount)}
                              </div>
                              <div className="px-1 py-0.5"></div>
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
                    <div className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-b border-gray-900 font-bold">
                      <div className="border-r border-gray-900 px-1 py-1"></div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-center font-bold">एकूण जमा (Total Receipts)</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono">{formatAmount(pageData.totalReceiptsCash)}</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono">{formatAmount(pageData.totalReceiptsTransfer)}</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono">{formatAmount(pageData.totalReceiptsCash + pageData.totalReceiptsTransfer)}</div>
                      <div className="px-1 py-1"></div>
                    </div>

                    {/* Row 2: Opening Cash Balance */}
                    <div className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-b border-gray-900 font-extrabold bg-blue-50/70 print:bg-gray-100 text-gray-900">
                      <div className="border-r border-gray-900 px-1 py-1"></div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-center font-black text-blue-900 print:text-black">
                        📌 आरंभीची रोख शिल्लक (Opening Balance)
                      </div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black text-blue-900 print:text-black">
                        {formatAmount(pageData.openingBalance)}
                      </div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-center text-gray-400">-</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black bg-blue-100 print:bg-gray-200">
                        {formatAmount(pageData.openingBalance)}
                      </div>
                      <div className="px-1 py-1"></div>
                    </div>

                    {/* Row 3: Grand Total Left */}
                    <div className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] font-black bg-gray-200 print:bg-gray-100">
                      <div className="border-r border-gray-900 px-1 py-1"></div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-center text-xs">सर्व एकूण (Grand Total)</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black">
                        {formatAmount(pageData.totalReceiptsCash + pageData.openingBalance)}
                      </div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black">
                        {formatAmount(pageData.totalReceiptsTransfer)}
                      </div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black bg-slate-300 print:bg-gray-300">
                        {formatAmount(pageData.totalReceiptsCash + pageData.totalReceiptsTransfer + pageData.openingBalance)}
                      </div>
                      <div className="px-1 py-1"></div>
                    </div>
                  </div>

                  {/* Right Side Total (Payments + Closing Balance) */}
                  <div className="w-1/2 border-r-2 border-transparent flex flex-col">
                    {/* Row 1: Total Payments */}
                    <div className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-b border-gray-900 font-bold">
                      <div className="border-r border-gray-900 px-1 py-1"></div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-center font-bold">एकूण खर्च (Total Payments)</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono">{formatAmount(pageData.totalPaymentsCash)}</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono">{formatAmount(pageData.totalPaymentsTransfer)}</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono">{formatAmount(pageData.totalPaymentsCash + pageData.totalPaymentsTransfer)}</div>
                      <div className="px-1 py-1"></div>
                    </div>

                    {/* Row 2: Closing Cash Balance */}
                    <div className={`grid grid-cols-[40px_1fr_70px_70px_82px_35px] border-b border-gray-900 font-extrabold print:bg-gray-200 text-gray-900 ${
                      voucherStatus === 'pending' ? 'bg-amber-100/80' : 'bg-emerald-100/70'
                    }`}>
                      <div className="border-r border-gray-900 px-1 py-1"></div>
                      <div className={`border-r border-gray-900 px-1.5 py-1 text-center font-black print:text-black ${
                        voucherStatus === 'pending' ? 'text-amber-950' : 'text-emerald-900'
                      }`}>
                        {voucherStatus === 'pending'
                          ? '📌 अपेक्षित अखेर रोख शिल्लक (Anticipated Cash)'
                          : '📌 अखेरची रोख शिल्लक (Closing Balance)'}
                      </div>
                      <div className={`border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black print:text-black ${
                        voucherStatus === 'pending' ? 'text-amber-950' : 'text-emerald-900'
                      }`}>
                        {formatAmount(pageData.closingBalance)}
                      </div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-center text-gray-400">-</div>
                      <div className={`border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black print:bg-gray-300 ${
                        voucherStatus === 'pending' ? 'bg-amber-200 text-amber-950' : 'bg-emerald-200 text-emerald-900'
                      }`}>
                        {formatAmount(pageData.closingBalance)}
                      </div>
                      <div className="px-1 py-1"></div>
                    </div>

                    {/* Row 3: Grand Total Right */}
                    <div className="grid grid-cols-[40px_1fr_70px_70px_82px_35px] font-black bg-gray-200 print:bg-gray-100">
                      <div className="border-r border-gray-900 px-1 py-1"></div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-center text-xs">सर्व एकूण (Grand Total)</div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black">
                        {formatAmount(pageData.totalPaymentsCash + pageData.closingBalance)}
                      </div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black">
                        {formatAmount(pageData.totalPaymentsTransfer)}
                      </div>
                      <div className="border-r border-gray-900 px-1.5 py-1 text-right font-mono font-black bg-slate-300 print:bg-gray-300">
                        {formatAmount(pageData.totalPaymentsCash + pageData.totalPaymentsTransfer + pageData.closingBalance)}
                      </div>
                      <div className="px-1 py-1"></div>
                    </div>
                  </div>
                </div>

                {/* Official Cash Balance Banner */}
                <div className={`mt-2.5 p-1.5 border-2 rounded-xs text-center font-black text-xs shadow-2xs ${
                  voucherStatus === 'pending'
                    ? 'bg-amber-100 border-amber-500 text-amber-950 print:border-black print:text-black'
                    : 'bg-amber-50 border-amber-300 text-amber-900 print:border-black print:text-black'
                }`}>
                  {voucherStatus === 'pending'
                    ? `💼 अपेक्षित अखेर रोख शिल्लक (व्हाउचर पासिंगनंतर) ₹ ${formatAmount(pageData.closingBalance)} (कॅशियर / मुख्य रोकडपाल यांचेकडे अपेक्षित)`
                    : `💼 अखेरची शिल्लक ₹ ${formatAmount(pageData.closingBalance)} (सचिव / सेल्समन / कॅशियर यांचेकडे आहे)`}
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

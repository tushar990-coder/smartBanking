import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { FileText, Printer, Download, FileSpreadsheet, Eye, Filter, Calendar, UserCheck } from 'lucide-react';

interface SansthaDetail {
  sansthaName?: string;
  address?: string;
  sansthaAddress?: string;
  village?: string;
  taluka?: string;
  district?: string;
  pinCode?: string;
  registrationNo?: string;
  registrationDate?: string;
}

interface LoanLedgerGuarantorDto {
  name: string;
}

interface LoanLedgerTransactionDto {
  date: string;
  receiptNo: string;
  particulars: string;
  loanDisbursement: number;
  principalDeposit: number;
  interest: number;
  penalInterest: number;
  receivableInterest: number;
  recoveryCharges: number;
  total: number;
  days: number;
  balance: number;
}

interface OpeningBalanceScheduleDto {
  no: number;
  date: string;
  principal: number;
  interest: number;
  total: number;
  balance: number;
  openingBalance?: number;
  closingBalance?: number;
  days?: number;
  interestRate?: number;
}

interface LoanLedgerReportDto {
  sansthaInfo?: SansthaDetail;
  loanType: string;
  loanAccountNo: string;
  status: string;
  sanctionedAmount: number;
  memberName: string;
  interestRate: number;
  disbursementDate: string | null;
  installmentAmount: number;
  aadhaarNo: string;
  panNo: string;
  cifNo: string;
  maturityDate: string | null;
  durationMonths: number;
  overdueInstallmentCount: number;
  overdueAmount: number;
  guarantors: LoanLedgerGuarantorDto[];
  transactions: LoanLedgerTransactionDto[];
  installmentChart: OpeningBalanceScheduleDto[];
}

interface LoanRate {
  loanRateID: number;
  loanType: string;
  shortName?: string;
}

interface LoanAccount {
  loanAccountID: number;
  loanAccountNo: string;
  loanRateID: number;
  memberID: number;
  member: {
    firstName: string;
    lastName: string;
    memberCode?: string;
  };
}

const LoanLedgerReport: React.FC = () => {
  const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
  const [selectedLoanRate, setSelectedLoanRate] = useState<any>(null);

  const [loanAccounts, setLoanAccounts] = useState<LoanAccount[]>([]);
  const [selectedLoanAccount, setSelectedLoanAccount] = useState<any>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showInstallmentChart, setShowInstallmentChart] = useState<boolean>(true);

  const [reportData, setReportData] = useState<LoanLedgerReportDto | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchLoanRates();
    // Default dates (current financial year)
    const today = new Date();
    const currentYear = today.getFullYear();
    const startYear = today.getMonth() >= 3 ? currentYear : currentYear - 1;
    setFromDate(`${startYear}-04-01`);
    setToDate(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (selectedLoanRate?.value) {
      fetchLoanAccounts(Number(selectedLoanRate.value));
    } else {
      setLoanAccounts([]);
      setSelectedLoanAccount(null);
    }
  }, [selectedLoanRate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const memberIdStr = params.get('memberId');
    if (!memberIdStr || loanRates.length === 0) return;

    const mId = parseInt(memberIdStr, 10);
    const autoLoad = async () => {
      try {
        const res = await fetch(`/api/LoanAccounts`);
        const data = await res.json();
        const matchedAcc = data.find((a: any) => a.memberID === mId);
        if (matchedAcc) {
          const rateOption = {
            value: matchedAcc.loanRateID,
            label: loanRates.find(r => r.loanRateID === matchedAcc.loanRateID)?.shortName || 'कर्ज प्रकार'
          };
          setSelectedLoanRate(rateOption);

          const accOptions = data
            .filter((a: any) => a.loanRateID === matchedAcc.loanRateID)
            .map((a: any) => ({
              value: a.loanAccountID,
              label: `${a.loanAccountNo} - ${a.member?.firstName || ''} ${a.member?.lastName || ''}`
            }));

          const matchedAccOpt = accOptions.find((o: any) => o.value === matchedAcc.loanAccountID);
          setSelectedLoanAccount(matchedAccOpt || null);

          setLoading(true);
          const fDate = fromDate || `${new Date().getFullYear() - (new Date().getMonth() >= 3 ? 0 : 1)}-04-01`;
          const tDate = toDate || new Date().toISOString().split('T')[0];
          const reportRes = await fetch(`/api/Reports/LoanLedger?loanAccountId=${matchedAcc.loanAccountID}&fromDate=${fDate}&toDate=${tDate}`);
          if (reportRes.ok) {
            const rData = await reportRes.json();
            setReportData(rData);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
      }
    };
    autoLoad();
  }, [loanRates]);

  const fetchLoanRates = async () => {
    try {
      const res = await fetch('/api/LoanRates');
      const data = await res.json();
      setLoanRates(data);
    } catch (err) {
      console.error("Error fetching loan rates", err);
    }
  };

  const fetchLoanAccounts = async (rateId: number) => {
    try {
      const res = await fetch(`/api/LoanAccounts`);
      const data = await res.json();
      const filtered = data.filter((a: any) => a.loanRateID === rateId);
      setLoanAccounts(filtered);
    } catch (err) {
      console.error("Error fetching loan accounts", err);
    }
  };

  const handleFetchReport = async () => {
    if (!selectedLoanAccount?.value || !fromDate || !toDate) {
      alert("कृपया कर्ज खाते आणि वैध तारीख निवडा.");
      return;
    }

    setLoading(true);
    setError('');
    setReportData(null);

    try {
      const res = await fetch(`/api/Reports/LoanLedger?loanAccountId=${selectedLoanAccount.value}&fromDate=${fromDate}&toDate=${toDate}`);
      if (!res.ok) {
        throw new Error('अहवाल माहिती लोड करण्यास त्रुटी आली.');
      }
      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'त्रुटी आली');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      const cleanDate = dateStr.split('T')[0];
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return cleanDate;
    } catch {
      return '-';
    }
  };

  const formatAmount = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num) || num === 0) return '-';
    return Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrint = () => {
    if (!reportData) return;

    const printContent = document.getElementById('print-area')?.innerHTML || '';
    const printWindow = window.open('', '_blank', 'width=1150,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Karj_Khatavani_${reportData.loanAccountNo}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              font-size: 10px;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 10px;
            }
            .no-print {
              display: none !important;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #1f2937;
              padding: 4px;
              text-align: center;
              box-sizing: border-box;
            }
            th {
              background-color: #f3f4f6 !important;
              font-weight: bold;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .bg-gray-100 { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .bg-gray-50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .bg-gray-50\/50 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .bg-gray-50\/30 { background-color: #f9fafb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .border-gray-800 { border-color: #1f2937 !important; }
            .border-gray-400 { border-color: #9ca3af !important; }
            .border-gray-300 { border-color: #d1d5db !important; }
            .border-gray-200 { border-color: #e5e7eb !important; }
            .p-6 { padding: 0px !important; }
            .shadow-lg, .shadow-md, .shadow-sm { box-shadow: none !important; }
            
            /* Print Grid & Flex Utilities */
            .grid { display: grid !important; }
            .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            .md\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .md\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            .gap-x-6 { column-gap: 1.5rem !important; }
            .gap-y-1\.5 { row-gap: 0.375rem !important; }
            .gap-2 { gap: 0.5rem !important; }
            .gap-3 { gap: 0.75rem !important; }
            .flex { display: flex !important; }
            .justify-between { justify-content: space-between !important; }
            .items-center { align-items: center !important; }
            .items-end { align-items: flex-end !important; }
            .space-y-1 > * + * { margin-top: 0.25rem !important; }
            .border { border-style: solid; border-width: 1px; }
            .border-b { border-bottom-style: solid; border-bottom-width: 1px; }
            .border-t { border-top-style: solid; border-top-width: 1px; }
            
            /* Text Colors */
            .text-primary { color: #004a75 !important; }
            .text-blue-900 { color: #1e3a8a !important; }
            .text-green-700 { color: #15803d !important; }
            .text-green-800 { color: #166534 !important; }
            .text-red-600 { color: #dc2626 !important; }
            .text-indigo-900 { color: #312e81 !important; }
            .text-gray-900 { color: #111827 !important; }
            .text-gray-800 { color: #1f2937 !important; }
            .text-gray-700 { color: #374151 !important; }
            .text-gray-600 { color: #4b5563 !important; }
          </style>
        </head>
        <body>
          <div id="print-area">
            ${printContent}
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPdf = () => {
    if (!reportData) return;
    const element = document.getElementById('print-area');
    if (!element) return;

    setDownloadingPdf(true);

    const opt: any = {
      margin: [6, 6, 6, 6],
      filename: `Karj_Khatavani_${reportData.loanAccountNo}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      html2pdf().set(opt).from(element).save().then(() => {
        setDownloadingPdf(false);
      }).catch((err: any) => {
        console.error('Error generating PDF:', err);
        setDownloadingPdf(false);
        handlePrint();
      });
    } catch (err) {
      console.error('PDF error:', err);
      setDownloadingPdf(false);
      handlePrint();
    }
  };

  const handleExportExcel = () => {
    if (!reportData) return;

    const excelRows: any[] = [];

    // Header Account Details
    excelRows.push({ "तपशील": "कर्ज प्रकार", "माहिती": reportData.loanType });
    excelRows.push({ "तपशील": "कर्ज खाते नं", "माहिती": reportData.loanAccountNo });
    excelRows.push({ "तपशील": "कर्जदाराचे नाव", "माहिती": reportData.memberName });
    excelRows.push({ "तपशील": "मंजूर रक्कम", "माहिती": reportData.sanctionedAmount });
    excelRows.push({ "तपशील": "व्याजदर", "माहिती": `${reportData.interestRate}%` });
    excelRows.push({ "तपशील": "मुदत तारीख", "माहिती": formatDate(reportData.maturityDate) });
    excelRows.push({ "तपशील": "", "माहिती": "" }); // Blank row

    // Transactions Table
    excelRows.push({
      "दिनांक": "दिनांक",
      "पावती नं": "पावती नं",
      "तपशील": "तपशील",
      "वाटप रक्कम": "वाटप रक्कम",
      "मुद्दल जमा": "मुद्दल जमा",
      "व्याज": "व्याज",
      "दंड व्याज": "दंड व्याज",
      "येणे व्याज": "येणे व्याज",
      "वसुली खर्च": "वसुली खर्च",
      "एकूण": "एकूण",
      "दिवस": "दिवस",
      "शिल्लक": "शिल्लक"
    });

    reportData.transactions.forEach((t) => {
      excelRows.push({
        "दिनांक": formatDate(t.date),
        "पावती नं": t.receiptNo || "-",
        "तपशील": t.particulars,
        "वाटप रक्कम": t.loanDisbursement || 0,
        "मुद्दल जमा": t.principalDeposit || 0,
        "व्याज": t.interest || 0,
        "दंड व्याज": t.penalInterest || 0,
        "येणे व्याज": t.receivableInterest || 0,
        "वसुली खर्च": t.recoveryCharges || 0,
        "एकूण": t.total || 0,
        "दिवस": t.days || 0,
        "शिल्लक": t.balance || 0
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "कर्ज खतावणी");
    XLSX.writeFile(workbook, `Karj_Khatavani_${reportData.loanAccountNo}.xlsx`);
  };

  // Convert options for Select
  const loanRateOptions = loanRates.map(lr => ({
    value: lr.loanRateID,
    label: lr.shortName || lr.loanType
  }));

  const loanAccountOptions = loanAccounts.map(la => ({
    value: la.loanAccountID,
    label: `${la.loanAccountNo} - ${la.member?.firstName || ''} ${la.member?.lastName || ''}`
  }));

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5">
        
        {/* Row 1: Title + Inline Filters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          
          {/* Left: Compact Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>कर्ज खतावणी अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Loan Ledger Report)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Loan Type */}
            <div className="w-36 sm:w-44">
              <Select
                options={loanRateOptions}
                value={selectedLoanRate}
                onChange={(val) => setSelectedLoanRate(val)}
                placeholder="-- कर्ज प्रकार --"
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

            {/* Loan Account */}
            <div className="w-48 sm:w-56">
              <Select
                options={loanAccountOptions}
                value={selectedLoanAccount}
                onChange={(val) => setSelectedLoanAccount(val)}
                placeholder={selectedLoanRate ? "खाते नं / नाव शोधा..." : "-- आधी प्रकार निवडा --"}
                isDisabled={!selectedLoanRate}
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
              <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">पासून:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28"
              />
            </div>

            {/* To Date */}
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
              onClick={handleFetchReport}
              disabled={loading}
              className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Eye size={11} />
              <span>पहा</span>
            </button>
          </div>

          {/* Right: Export & Print Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={!reportData}
              className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${!reportData ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="एक्सेल फाइल डाउनलोड करा"
            >
              <FileSpreadsheet size={12} />
              <span>एक्सेल</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={!reportData || downloadingPdf}
              className={`h-6 bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${(!reportData || downloadingPdf) ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="PDF डाउनलोड करा"
            >
              <Download size={12} />
              <span>PDF</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={!reportData}
              className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${!reportData ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="A4 प्रिंट काढा"
            >
              <Printer size={12} />
              <span>प्रिंट</span>
            </button>
          </div>

        </div>

        {/* Row 2: Schedule Checkbox */}
        <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between text-xs">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showInstallmentChart} 
              onChange={(e) => setShowInstallmentChart(e.target.checked)} 
              className="w-3.5 h-3.5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
            />
            <span>हप्ता परतफेड वेळापत्रक चार्ट अहवालात समाविष्ट करा (Include Installment Schedule)</span>
          </label>
        </div>

      </div>

      {loading && (
        <div className="py-20 bg-white rounded-sm shadow-sm border border-gray-200 text-center text-gray-500 font-bold text-xs">
          कर्ज खतावणी अहवाल लोड होत आहे...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 font-bold text-xs rounded-sm text-center">
          {error}
        </div>
      )}

      {/* Inline Print Styles for A4 Page Formatting */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          #print-area {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
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
      `}</style>

      {/* Main Report Printable Document Area */}
      {reportData && !loading && (
        <div id="print-area" className="bg-white mx-auto max-w-7xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 text-xs">
          
          {/* Official Bank Header Box (Exact Reference Format) */}
          <div className="border border-gray-900 p-3 relative text-center mb-3">
            
            {/* Registration Top Bar */}
            <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
              <div>
                <span>रजि. नं. - </span>
                <span className="font-mono">{reportData.sansthaInfo?.registrationNo || '-'}</span>
              </div>
              <div>
                <span>रजि. दि. - </span>
                <span className="font-mono">{reportData.sansthaInfo?.registrationDate ? new Date(reportData.sansthaInfo.registrationDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span>
              </div>
            </div>

            {/* Central Sanstha Name */}
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
              {reportData.sansthaInfo?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
            </h1>

            {/* Subtitle / Address */}
            <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
              {reportData.sansthaInfo?.sansthaAddress ||
               [
                 reportData.sansthaInfo?.address,
                 reportData.sansthaInfo?.village ? `मु. ${reportData.sansthaInfo.village},` : '',
                 reportData.sansthaInfo?.taluka ? `ता. ${reportData.sansthaInfo.taluka},` : '',
                 reportData.sansthaInfo?.district ? `जि. ${reportData.sansthaInfo.district}` : '',
                 reportData.sansthaInfo?.pinCode ? `-${reportData.sansthaInfo.pinCode}` : ''
               ].filter(Boolean).join(' ') || ''
              }
            </p>
          </div>

          {/* Report Title Banner Section */}
          <div className="mt-3 mb-3 flex items-center justify-between">
            <div className="w-28 hidden sm:block"></div>

            {/* Title Banner Box */}
            <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif text-center">
                कर्ज खतावणी अहवाल (Loan Ledger Report)
              </h2>
            </div>

            {/* Date Tag on Right */}
            <div className="text-right text-xs font-bold text-gray-800">
              <span>कालावधी : </span>
              <span className="font-mono">{formatDate(fromDate)} ते {formatDate(toDate)}</span>
            </div>
          </div>

          {/* Account Details 3-Column Info Card */}
          <div className="border border-slate-300 p-3 mb-3 bg-slate-50/70 rounded-md shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1.5 text-[11px] text-gray-900">
              {/* Column 1 */}
              <div className="space-y-1">
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">कर्ज प्रकार:</span>
                  <span className="font-bold text-blue-900">{reportData.loanType}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">कर्ज खाते नं:</span>
                  <span className="font-extrabold text-primary">{reportData.loanAccountNo}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">कर्ज मंजूर रक्कम:</span>
                  <span className="font-bold text-emerald-800">₹ {formatAmount(reportData.sanctionedAmount)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">एकूण वाटप रक्कम:</span>
                  <span className="font-bold text-blue-900">
                    ₹ {formatAmount(reportData.transactions.reduce((s, t) => s + (t.loanDisbursement || 0), 0))}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">व्याजदर:</span>
                  <span className="font-bold">{reportData.interestRate} %</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-700">आधार कार्ड नं:</span>
                  <span className="font-medium">{reportData.aadhaarNo || '-'}</span>
                </div>
              </div>

              {/* Column 2 */}
              <div className="space-y-1">
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">स्थिती (Status):</span>
                  <span className={`font-bold ${reportData.status === 'Active' ? 'text-green-700 bg-green-50 px-1.5 rounded border border-green-200' : 'text-gray-700'}`}>
                    {reportData.status === 'Active' ? 'सुरू (Active)' : reportData.status}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">कर्जदाराचे नाव:</span>
                  <span className="font-bold text-gray-900">{reportData.memberName}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">कर्ज वाटप दिनांक:</span>
                  <span className="font-medium">{formatDate(reportData.disbursementDate)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">हप्त्याची रक्कम:</span>
                  <span className="font-bold">₹ {formatAmount(reportData.installmentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-700">पॅन कार्ड नं:</span>
                  <span className="font-medium">{reportData.panNo || '-'}</span>
                </div>
              </div>

              {/* Column 3 */}
              <div className="space-y-1">
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">CIF / आयडी नं:</span>
                  <span className="font-bold text-indigo-900">{reportData.cifNo || '-'}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">कर्ज मुदत:</span>
                  <span className="font-medium">{reportData.durationMonths} महिने</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">मुदत संपण्याची तारीख:</span>
                  <span className="font-medium">{formatDate(reportData.maturityDate)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-200 pb-0.5">
                  <span className="font-bold text-gray-700">थकीत हफ्ते:</span>
                  <span className="font-bold text-red-600">{reportData.overdueInstallmentCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-gray-700">थकबाकी रक्कम:</span>
                  <span className="font-bold text-red-600">₹ {formatAmount(reportData.overdueAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Guarantor Details Section */}
          <div className="border border-blue-200 p-2.5 mb-3 bg-blue-50/40 rounded-md shadow-xs">
            <div className="font-bold text-blue-950 mb-1 border-b border-blue-200/80 pb-0.5 text-[10.5px] flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>जामीनदार माहिती (Guarantor Details):</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
              {reportData.guarantors && reportData.guarantors.length > 0 ? (
                reportData.guarantors.map((g, idx) => (
                  <div key={idx} className="bg-white border border-blue-200 px-2.5 py-1 rounded-md font-semibold text-gray-800 shadow-xs">
                    जामीनदार {idx + 1} :- {g.name}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 italic">कोणतीही जामीनदार माहिती नोंदवलेली नाही.</div>
              )}
            </div>
          </div>

          {/* Transactions Ledger Table */}
          <div className="overflow-x-auto mb-4 border border-slate-300 rounded-md shadow-xs">
            <table className="w-full text-center border-collapse text-[10px]">
              <thead>
                <tr className="bg-gradient-to-r from-slate-900 to-primary text-white border-b-2 border-slate-900 font-bold">
                  <th className="p-1.5 border border-slate-700 w-20">दिनांक</th>
                  <th className="p-1.5 border border-slate-700 w-16">पावती नं</th>
                  <th className="p-1.5 border border-slate-700 text-left pl-2">तपशील</th>
                  <th className="p-1.5 border border-slate-700 text-right pr-2">वाटप रक्कम</th>
                  <th className="p-1.5 border border-slate-700 text-right pr-2">मुद्दल जमा</th>
                  <th className="p-1.5 border border-slate-700 text-right pr-2">व्याज</th>
                  <th className="p-1.5 border border-slate-700 text-right pr-2">दंड व्याज</th>
                  <th className="p-1.5 border border-slate-700 text-right pr-2">येणे व्याज</th>
                  <th className="p-1.5 border border-slate-700 text-right pr-2">वसुली खर्च</th>
                  <th className="p-1.5 border border-slate-700 text-right pr-2">एकूण</th>
                  <th className="p-1.5 border border-slate-700 w-12">दिवस</th>
                  <th className="p-1.5 border border-slate-700 text-right pr-2 font-bold">शिल्लक</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportData.transactions.map((t, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                    <td className="p-1 border border-gray-200 font-medium text-gray-800">{formatDate(t.date)}</td>
                    <td className="p-1 border border-gray-200 text-gray-700">{t.receiptNo || '-'}</td>
                    <td className="p-1 border border-gray-200 text-left pl-2 font-semibold text-gray-800">{t.particulars}</td>
                    <td className="p-1 border border-gray-200 text-right pr-2 text-blue-900 font-bold">
                      {formatAmount(t.loanDisbursement)}
                    </td>
                    <td className="p-1 border border-gray-200 text-right pr-2 text-green-700 font-bold">
                      {formatAmount(t.principalDeposit)}
                    </td>
                    <td className="p-1 border border-gray-200 text-right pr-2 text-gray-800 font-medium">{formatAmount(t.interest)}</td>
                    <td className="p-1 border border-gray-200 text-right pr-2 text-amber-700">{formatAmount(t.penalInterest)}</td>
                    <td className="p-1 border border-gray-200 text-right pr-2 text-gray-700">{formatAmount(t.receivableInterest)}</td>
                    <td className="p-1 border border-gray-200 text-right pr-2 text-gray-700">{formatAmount(t.recoveryCharges)}</td>
                    <td className="p-1 border border-gray-200 text-right pr-2 font-bold text-slate-900">{formatAmount(t.total)}</td>
                    <td className="p-1 border border-gray-200 text-gray-600">{t.days > 0 ? t.days : '-'}</td>
                    <td className="p-1 border border-gray-200 text-right pr-2 font-extrabold text-slate-900 bg-slate-50/80">
                      {formatAmount(t.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-800 text-slate-900 shadow-xs">
                  <td colSpan={3} className="p-1.5 border border-gray-300 text-right pr-3">एकूण :</td>
                  <td className="p-1.5 border border-gray-300 text-right pr-2 text-blue-950 font-black">
                    {formatAmount(reportData.transactions.reduce((s, t) => s + (t.loanDisbursement || 0), 0))}
                  </td>
                  <td className="p-1.5 border border-gray-300 text-right pr-2 text-green-800 font-black">
                    {formatAmount(reportData.transactions.reduce((s, t) => s + (t.principalDeposit || 0), 0))}
                  </td>
                  <td className="p-1.5 border border-gray-300 text-right pr-2">
                    {formatAmount(reportData.transactions.reduce((s, t) => s + (t.interest || 0), 0))}
                  </td>
                  <td className="p-1.5 border border-gray-300 text-right pr-2">
                    {formatAmount(reportData.transactions.reduce((s, t) => s + (t.penalInterest || 0), 0))}
                  </td>
                  <td className="p-1.5 border border-gray-300 text-right pr-2">
                    {formatAmount(reportData.transactions.reduce((s, t) => s + (t.receivableInterest || 0), 0))}
                  </td>
                  <td className="p-1.5 border border-gray-300 text-right pr-2">
                    {formatAmount(reportData.transactions.reduce((s, t) => s + (t.recoveryCharges || 0), 0))}
                  </td>
                  <td className="p-1.5 border border-gray-300 text-right pr-2 font-black">
                    {formatAmount(reportData.transactions.reduce((s, t) => s + (t.total || 0), 0))}
                  </td>
                  <td className="p-1.5 border border-gray-300"></td>
                  <td className="p-1.5 border border-gray-300 text-right pr-2 font-black text-slate-950">
                    {reportData.transactions.length > 0 ? formatAmount(reportData.transactions[reportData.transactions.length - 1].balance) : '0.00'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Installment Schedule Chart */}
          {showInstallmentChart && reportData.installmentChart && reportData.installmentChart.length > 0 && (
            <div className="mt-5 border border-slate-300 rounded-md overflow-hidden shadow-xs p-3 bg-white">
              <div className="font-bold text-xs bg-slate-800 text-white px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 mb-2.5">
                <Calendar className="w-3.5 h-3.5 text-blue-200" />
                <span>कर्ज हप्ता परतफेड वेळापत्रक (Loan Installment Schedule)</span>
              </div>
              <table className="w-full text-center border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-700 text-white border-b border-slate-800 font-bold">
                    <th className="p-1.5 border border-slate-600 w-16">हप्ता क्र.</th>
                    <th className="p-1.5 border border-slate-600">परतफेड दिनांक</th>
                    <th className="p-1.5 border border-slate-600 text-right pr-2">मुद्दल रक्कम (Principal)</th>
                    <th className="p-1.5 border border-slate-600 text-right pr-2">व्याज (Interest)</th>
                    <th className="p-1.5 border border-slate-600 text-right pr-2 font-bold">एकूण हप्ता (Total)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.installmentChart.map((h, i) => (
                    <tr key={i} className="hover:bg-gray-50 border border-gray-800">
                      <td className="p-1 border border-gray-800 font-medium">{h.no || i + 1}</td>
                      <td className="p-1 border border-gray-800">{formatDate(h.date)}</td>
                      <td className="p-1 border border-gray-800 text-right pr-2">{formatAmount(h.principal || 0)}</td>
                      <td className="p-1 border border-gray-800 text-right pr-2">{formatAmount(h.interest || 0)}</td>
                      <td className="p-1 border border-gray-800 text-right pr-2 font-bold">{formatAmount(h.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold border border-gray-800 text-gray-900">
                    <td colSpan={2} className="p-1.5 border border-gray-800 text-right pr-3">एकूण वेळापत्रक बेरीज :</td>
                    <td className="p-1 border border-gray-800 text-right pr-2 text-blue-900">
                      {formatAmount(reportData.installmentChart.reduce((acc, curr) => acc + (curr.principal || 0), 0))}
                    </td>
                    <td className="p-1 border border-gray-800 text-right pr-2 text-indigo-900">
                      {formatAmount(reportData.installmentChart.reduce((acc, curr) => acc + (curr.interest || 0), 0))}
                    </td>
                    <td className="p-1 border border-gray-800 text-right pr-2 font-bold text-green-800">
                      {formatAmount(reportData.installmentChart.reduce((acc, curr) => acc + (curr.total || 0), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Verification Signatures Section */}
          <div className="mt-14 pt-4 border-t border-dashed border-gray-400 grid grid-cols-3 text-center text-xs font-bold text-gray-900">
            <div>
              <div className="h-10"></div>
              <p className="border-t border-gray-800 mx-4 pt-1">लिपिक / खतावणी लेखक</p>
              <span className="text-[10px] text-gray-500 font-normal">(Clerk / Ledger Writer)</span>
            </div>

            <div>
              <div className="h-10"></div>
              <p className="border-t border-gray-800 mx-4 pt-1">लेखापाल / कर्ज तपासनीस</p>
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
};

export default LoanLedgerReport;

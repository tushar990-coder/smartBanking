import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import html2pdf from 'html2pdf.js';
import { Printer, Download, FileText } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface LoanAccountOption {
  value: string;
  label: string;
}

interface SansthaDetails {
  sansthaID?: number;
  sansthaName?: string;
  address?: string;
  village?: string;
  taluka?: string;
  district?: string;
  pinCode?: string;
  registrationNo?: string;
  registrationDate?: string;
  phoneNo?: string;
  contactNo?: string;
}

const unitsMarathi = ['', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ', 'दहा',
  'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस'];

const tensMarathi: { [key: number]: string } = {
  20: 'वीस', 21: 'एकवीस', 22: 'बावीस', 23: 'तेवीस', 24: 'चोवीस', 25: 'पंचवीस', 26: 'सव्व्हीस', 27: 'सत्तावीस', 28: 'अठ्ठावीस', 29: 'एकोणतीस',
  30: 'तीस', 31: 'एकतीस', 32: 'बत्तीस', 33: 'तेत्तीस', 34: 'चौतीस', 35: 'पस्तीस', 36: 'छत्तीस', 37: 'सदतीस', 38: 'अडतीस', 39: 'एकोणचाळीस',
  40: 'चाळीस', 41: 'एकचाळीस', 42: 'बेचाळीस', 43: 'त्रेचाळीस', 44: 'चौचाळीस', 45: 'पंचेचाळीस', 46: 'शेचाळीस', 47: 'सतचाळीस', 48: 'अडचाळीस', 49: 'एकोणपन्नास',
  50: 'पन्नास', 51: 'एकपन्न', 52: 'बावन्न', 53: 'त्रेपन्न', 54: 'चौपन्न', 55: 'पंचावन्न', 56: 'छप्पन्न', 57: 'सत्तावन्न', 58: 'अठ्ठावन्न', 59: 'एकोणसाठ',
  60: 'साठ', 61: 'एकसाठ', 62: 'बासाठ', 63: 'त्रेसष्ट', 64: 'चौसष्ट', 65: 'पाचसष्ट', 66: 'सहसष्ट', 67: 'सदुसष्ट', 68: 'अडुसष्ट', 69: 'एकोणत्तर',
  70: 'सत्तर', 71: 'एकहत्तर', 72: 'बाहत्तर', 73: 'त्र्याहत्तर', 74: 'चौऱ्याहत्तर', 75: 'पंच्याहत्तर', 76: 'शहात्तर', 77: 'सतहत्तर', 78: 'अठ्ठ्याहत्तर', 79: 'एकोणऐंशी',
  80: 'ऐंशी', 81: 'एक्याऐंशी', 82: 'ब्याऐंशी', 83: 'त्र्याऐंशी', 84: 'चौऱ्याऐंशी', 85: 'पंच्याऐंशी', 86: 'शहाऐंशी', 87: 'सत्त्याऐंशी', 88: 'अठ्ठ्याऐंशी', 89: 'एकॉण्णवऊ',
  90: 'नव्वद', 91: 'एक्याण्णव', 92: 'ब्याण्णव', 93: 'त्र्याण्णव', 94: 'चौऱ्याण्णव', 95: 'पंच्याण्णव', 96: 'शहाण्णव', 97: 'सत्त्याण्णव', 98: 'अठ्ठ्याण्णव', 99: 'नव्व्याण्णव'
};

function numToMarathiWordsLessThanThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    const hundredDigit = Math.floor(n / 100);
    str += (unitsMarathi[hundredDigit] || '') + ' शे ';
    n %= 100;
  }
  if (n > 0) {
    if (n < 20) {
      str += unitsMarathi[n];
    } else {
      str += tensMarathi[n] || (unitsMarathi[Math.floor(n / 10) * 10] + ' ' + unitsMarathi[n % 10]);
    }
  }
  return str.trim();
}

function amountToMarathiWords(num: number): string {
  if (!num || num === 0) return 'शून्य रुपये फक्त';

  let n = Math.floor(num);
  let result = '';

  if (n >= 10000000) {
    const crore = Math.floor(n / 10000000);
    result += numToMarathiWordsLessThanThousand(crore) + ' कोटी ';
    n %= 10000000;
  }

  if (n >= 100000) {
    const lakh = Math.floor(n / 100000);
    result += numToMarathiWordsLessThanThousand(lakh) + ' लाख ';
    n %= 100000;
  }

  if (n >= 1000) {
    const thousand = Math.floor(n / 1000);
    result += numToMarathiWordsLessThanThousand(thousand) + ' हजार ';
    n %= 1000;
  }

  if (n > 0) {
    result += numToMarathiWordsLessThanThousand(n);
  }

  return 'अक्षरी रुपये ' + result.trim() + ' फक्त';
}

function formatMarathiCurrency(amount: number): string {
  if (amount == null || isNaN(amount)) return '०.००';
  const formattedEn = amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return formattedEn.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0x0966 - 48));
}

export default function LoanRecoveryNoticeReport() {
  const [sanstha, setSanstha] = useState<SansthaDetails | null>(null);
  const [loanAccounts, setLoanAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  
  // Notice Form Inputs
  const [noticeDate, setNoticeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customInterest, setCustomInterest] = useState<string>('');
  const [otherExpenses, setOtherExpenses] = useState<number>(500);
  const [deadlineDays, setDeadlineDays] = useState<number>(7);

  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSansthaDetails();
    fetchLoanAccounts();
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        setSanstha(res.data[0]);
      } else if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
        setSanstha(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch sanstha details', err);
    }
  };

  const fetchLoanAccounts = async () => {
    try {
      const res = await axios.get('/api/LoanAccounts');
      if (Array.isArray(res.data)) {
        setLoanAccounts(res.data);
      }
    } catch (err) {
      console.error('Error fetching loan accounts', err);
    }
  };

  const handleAccountSelect = async (valOrEvent: any) => {
    const accIdStr = typeof valOrEvent === 'object' && valOrEvent !== null && 'target' in valOrEvent
      ? String(valOrEvent.target.value || '')
      : String(valOrEvent || '');

    setSelectedAccountId(accIdStr);
    setCustomInterest(''); // Reset custom interest on new account selection
    if (!accIdStr) {
      setSelectedAccount(null);
      setGuarantors([]);
      return;
    }

    const accId = parseInt(accIdStr, 10);
    const acc = loanAccounts.find((a: any) => a.loanAccountID === accId);
    setSelectedAccount(acc || null);

    if (acc) {
      try {
        const detailsRes = await axios.get(`/api/LoanAccounts/${accId}/AccountDetailsAndSchedule`);
        if (detailsRes.data) {
          setSelectedAccount((prev: any) => ({
            ...prev,
            ...detailsRes.data
          }));
        }
      } catch (err) {
        console.error('Failed to fetch detailed account info', err);
      }

      try {
        const appId = acc.loanApplicationID || acc.applicationID;
        if (appId) {
          const gRes = await axios.get(`/api/LoanApplications/${appId}`);
          if (gRes.data && gRes.data.guarantors) {
            setGuarantors(gRes.data.guarantors);
          } else {
            setGuarantors([]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch guarantors', err);
      }
    }
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    let formatted = clean;
    if (parts.length === 3) {
      formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return formatted.replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0x0966 - 48));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setDownloadingPdf(true);
    try {
      const opt = {
        margin: [4, 5, 4, 5],
        filename: `Loan_Recovery_Notice_${selectedAccount?.loanAccountNo || 'Report'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().set(opt as any).from(reportRef.current).save();
      setDownloadingPdf(false);
    } catch (err) {
      console.error('PDF generation error:', err);
      setDownloadingPdf(false);
      handlePrint();
    }
  };

  // Filter out Nil/Closed/Zero balance accounts
  const overdueLoanAccounts = loanAccounts.filter((a: any) => {
    const pBal = a.principalBalance ?? a.sanctionedAmount ?? 0;
    const iBal = a.interestBalance ?? a.overdueInterestBalance ?? 0;
    const totalDue = pBal + iBal;
    const isClosed = a.status === 'Closed' || a.status === 'Nil' || a.status === 'Paid' || a.isClosed === true;
    return !isClosed && totalDue > 0;
  });

  const options: LoanAccountOption[] = overdueLoanAccounts.map((a: any) => {
    const pBal = a.principalBalance ?? a.sanctionedAmount ?? 0;
    const iBal = a.interestBalance ?? a.overdueInterestBalance ?? 0;
    const tot = pBal + iBal;
    return {
      value: a.loanAccountID.toString(),
      label: `${a.loanAccountNo} - ${a.member?.firstName || ''} ${a.member?.lastName || ''} (बाकी रू. ${tot.toLocaleString('en-IN')})`
    };
  });

  const borrower = selectedAccount?.member;
  const borrowerAddress = borrower 
    ? `${borrower.address || ''}${borrower.village ? `, रा. ${borrower.village}` : ''}${borrower.taluka ? `, ता. ${borrower.taluka}` : ''}${borrower.district ? `, जि. ${borrower.district}` : ''}`
    : '';

  const guarantor1 = guarantors.length > 0 ? guarantors[0]?.member || guarantors[0] : null;
  const guarantor2 = guarantors.length > 1 ? guarantors[1]?.member || guarantors[1] : null;
  const coBorrower = selectedAccount?.coMember || selectedAccount?.coBorrower || null;

  const getPersonAddress = (person: any): string => {
    if (!person) return '';
    const m = person.member || person;
    const parts: string[] = [];
    if (m.address) parts.push(m.address.trim());
    if (m.village && !m.address?.toLowerCase().includes(m.village.toLowerCase())) parts.push(m.village.trim());
    if (m.taluka && !m.address?.toLowerCase().includes(m.taluka.toLowerCase())) parts.push(`ता. ${m.taluka.trim()}`);
    if (m.district && !m.address?.toLowerCase().includes(m.district.toLowerCase())) parts.push(`जि. ${m.district.trim()}`);
    return parts.join(', ');
  };

  const principalDue = selectedAccount?.currentPrincipalBalance ?? selectedAccount?.principalBalance ?? selectedAccount?.sanctionedAmount ?? 0;
  
  // Calculate recoverable interest automatically (property lookup -> schedule sum -> days interest)
  const getAutoCalculatedInterest = (): number => {
    if (!selectedAccount) return 0;

    const directInt = 
      selectedAccount.currentInterestBalance ??
      selectedAccount.interestBalance ??
      selectedAccount.currentOverdueInterestBalance ??
      selectedAccount.overdueInterestBalance ??
      selectedAccount.outstandingInterest ??
      selectedAccount.interestDue ??
      0;

    if (directInt > 0) return directInt;

    if (selectedAccount.schedule && Array.isArray(selectedAccount.schedule) && selectedAccount.schedule.length > 0) {
      const noticeD = new Date(noticeDate);
      const scheduleInt = selectedAccount.schedule.reduce((sum: number, s: any) => {
        const dStr = s.dueDate || s.date;
        if (dStr && new Date(dStr) <= noticeD) {
          return sum + (s.interestAmount || s.interest || 0);
        }
        return sum;
      }, 0);
      if (scheduleInt > 0) return Math.round(scheduleInt);
    }

    const p = principalDue;
    const rate = selectedAccount.loanRate?.interestRate ?? selectedAccount.interestRate ?? 0;
    const startDateStr = selectedAccount.loanDisbursementDate || selectedAccount.openingDate;

    if (p > 0 && rate > 0 && startDateStr) {
      const startDate = new Date(startDateStr);
      const noticeD = new Date(noticeDate);
      const diffTime = Math.max(0, noticeD.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        return Math.round((p * rate * diffDays) / (365 * 100));
      }
    }

    return 0;
  };

  const autoInterest = getAutoCalculatedInterest();
  const interestDue = customInterest !== '' ? (parseFloat(customInterest) || 0) : autoInterest;

  const totalPayable = principalDue + interestDue + (otherExpenses || 0);

  const sansthaName = sanstha?.sansthaName || 'विद्यासागर ग्रामीण बिगरशेती सहकारी पत संस्था मर्यादित., कवठेसार';
  const headerTaluka = sanstha?.taluka ? `ता. ${sanstha.taluka}` : 'ता. शिरोळ';
  const headerDistrict = sanstha?.district ? `जि. ${sanstha.district}` : 'जि. कोल्हापूर';

  const getCleanSansthaAddress = () => {
    if (!sanstha) return '';
    const parts: string[] = [];
    if (sanstha.address) parts.push(sanstha.address.trim());
    if (sanstha.village && !sanstha.address?.toLowerCase().includes(sanstha.village.toLowerCase())) parts.push(sanstha.village.trim());
    if (sanstha.taluka && !sanstha.address?.toLowerCase().includes(sanstha.taluka.toLowerCase())) parts.push(`ता. ${sanstha.taluka.trim()}`);
    if (sanstha.district && !sanstha.address?.toLowerCase().includes(sanstha.district.toLowerCase())) parts.push(`जि. ${sanstha.district.trim()}`);
    let fullAddr = parts.join(', ');
    if (sanstha.pinCode) fullAddr += ` - ${sanstha.pinCode}`;
    const phone = sanstha.contactNo || sanstha.phoneNo;
    if (phone) fullAddr += ` | संपर्क: ${phone}`;
    return fullAddr;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 text-gray-800 font-sans">
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 4mm 8mm;
            }
            body {
              background-color: white !important;
              -webkit-print-color-adjust: exact !important;
            }
            .print\\:hidden {
              display: none !important;
            }
            .notice-print-area {
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}
      </style>

      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="print:hidden max-w-5xl mx-auto bg-white rounded-sm shadow-xs p-3 mb-4 border border-gray-200 border-b-2 border-primary">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText size={14} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-gray-900 leading-tight flex items-center gap-1">
                <span>लवादपूर्व कर्ज फेडीची नोटीस</span>
                <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Pre-Arbitration Recovery Notice)</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handlePrint}
              disabled={!selectedAccount}
              className="h-6 bg-slate-800 hover:bg-slate-900 text-white px-2.5 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer size={12} />
              <span>प्रिंट (Print)</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={!selectedAccount || downloadingPdf}
              className="h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={12} />
              <span>{downloadingPdf ? 'डाउनलोड...' : 'PDF डाउनलोड'}</span>
            </button>
          </div>
        </div>

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 mt-2 items-end text-xs">
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-gray-700 mb-0.5 block">
              १. कर्ज खाते / सभासद निवडा:
            </label>
            <div className="bg-white rounded-sm">
              <SearchableSelect
                name="selectedAccountId"
                options={options}
                value={selectedAccountId}
                onChange={handleAccountSelect}
                placeholder="खाते क्र. किंवा नाव शोधा..."
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-700 mb-0.5 block">
              २. नोटीस दिनांक:
            </label>
            <input
              type="date"
              value={noticeDate}
              onChange={(e) => setNoticeDate(e.target.value)}
              className="w-full h-6 border border-gray-300 rounded-sm px-2 text-[11px] text-gray-800 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-700 mb-0.5 block">
              ३. व्याज (रू.):
            </label>
            <input
              type="number"
              value={customInterest !== '' ? customInterest : (autoInterest || '')}
              onChange={(e) => setCustomInterest(e.target.value)}
              placeholder={autoInterest ? String(autoInterest) : '0'}
              className="w-full h-6 border border-gray-300 rounded-sm px-2 text-[11px] text-gray-900 font-bold text-amber-700 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-700 mb-0.5 block">
              ४. मुदत (दिवस):
            </label>
            <input
              type="number"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(parseInt(e.target.value) || 7)}
              min={1}
              max={90}
              className="w-full h-6 border border-gray-300 rounded-sm px-2 text-[11px] text-gray-800 font-semibold focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Notice Template Render Container */}
      {!selectedAccount ? (
        <div className="print:hidden max-w-5xl mx-auto bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">कृपया कर्ज खाते निवडा</h3>
          <p className="text-xs text-gray-500 mt-1">
            नोटीस रिपोर्ट पाहण्यासाठी आणि मुद्रण करण्यासाठी वरील ड्रॉपडाऊनमधून कर्ज खाते निवडा.
          </p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto bg-white p-4 md:p-8 shadow-lg rounded-sm print:shadow-none print:p-0 print:m-0 border border-gray-200 print:border-none font-serif text-gray-900 leading-relaxed text-sm md:text-base notice-print-area">
          <div ref={reportRef} className="bg-white p-2 print:p-0" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            
            {/* Official Bank Header Box (Exact Reference Format) */}
            <div className="border border-gray-900 p-3 relative text-center mb-3">
              <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
                <div>
                  <span>रजि. नं. - </span>
                  <span className="font-mono">{sanstha?.registrationNo || '-'}</span>
                </div>
                <div>
                  <span>रजि. दि. - </span>
                  <span className="font-mono">{sanstha?.registrationDate ? formatDate(sanstha.registrationDate) : '-'}</span>
                </div>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
                {sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h1>
              {getCleanSansthaAddress() && (
                <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
                  {getCleanSansthaAddress()}
                </p>
              )}
            </div>

            {/* Notice Title Box */}
            <div className="text-center my-2">
              <span className="inline-block border-2 border-black font-extrabold text-base md:text-lg px-8 py-0.5 tracking-wide uppercase bg-gray-50 print:bg-transparent">
                लवादपूर्व कर्ज फेडीची नोटीस
              </span>
            </div>

            {/* 4 Parties Listing Section - Original 2-Line Layout */}
            <div className="space-y-1.5 my-2.5 text-sm md:text-base">
              <div className="flex items-start">
                <span className="font-bold w-36 shrink-0">१) कर्जदार</span>
                <span className="font-semibold">: {borrower ? `${borrower.firstName || ''} ${borrower.middleName || ''} ${borrower.lastName || ''}`.trim() : '-'}</span>
              </div>
              <div className="flex items-start pl-36">
                <span className="text-gray-800">रा. {borrowerAddress || '---------------------------------------------------'}</span>
              </div>

              <div className="flex items-start">
                <span className="font-bold w-36 shrink-0">२) जामीनदार नं. १</span>
                <span className="font-semibold">: {guarantor1 ? `${guarantor1.firstName || guarantor1.name || ''} ${guarantor1.lastName || ''}`.trim() : '---------------------------------------------------'}</span>
              </div>
              <div className="flex items-start pl-36">
                <span className="text-gray-800">रा. {getPersonAddress(guarantor1) || '---------------------------------------------------'}</span>
              </div>

              <div className="flex items-start">
                <span className="font-bold w-36 shrink-0">३) जामीनदार नं. २</span>
                <span className="font-semibold">: {guarantor2 ? `${guarantor2.firstName || guarantor2.name || ''} ${guarantor2.lastName || ''}`.trim() : '---------------------------------------------------'}</span>
              </div>
              <div className="flex items-start pl-36">
                <span className="text-gray-800">रा. {getPersonAddress(guarantor2) || '---------------------------------------------------'}</span>
              </div>

              <div className="flex items-start">
                <span className="font-bold w-36 shrink-0">४) सहकर्जदार १</span>
                <span className="font-semibold">: {coBorrower ? `${coBorrower.firstName || coBorrower.name || ''} ${coBorrower.lastName || ''}`.trim() : '---------------------------------------------------'}</span>
              </div>
              <div className="flex items-start pl-36">
                <span className="text-gray-800">रा. {getPersonAddress(coBorrower) || '---------------------------------------------------'}</span>
              </div>
            </div>

            {/* Loan Account No. & Subject Header */}
            <div className="my-2 space-y-1">
              <div className="font-bold text-sm md:text-base">
                कर्ज खा. नं. : <span className="font-mono text-sm md:text-base underline">{selectedAccount?.loanAccountNo || '-'}</span>
              </div>

              <div className="text-center font-extrabold text-base md:text-lg my-1.5 underline">
                विषय : कर्ज वसुली नोटीस
              </div>

              <div className="font-bold text-sm md:text-base">
                श्री / सौ. <span className="underline">{borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}` : '--------------------'}</span> यांना
              </div>
            </div>

            {/* Body Paragraph 1 */}
            <p className="text-justify leading-relaxed text-sm md:text-base my-2">
              <strong className="font-bold">{sansthaName}</strong> यांचेकडून नोटीशीद्वारे कळविणेत येते की, आपण नं. १ ते ४ हे पतसंस्थेचे सभासद आहात. आपल्या मागणीवरुन आपणांस पतसंस्थेने रक्कम रु. <strong className="font-bold border-b border-black px-1">{formatMarathiCurrency(selectedAccount?.sanctionedAmount || 0)}/-</strong> चे (कर्जप्रकार) <strong className="font-bold border-b border-black px-1">{selectedAccount?.loanRate?.shortName || selectedAccount?.loanRate?.loanType || 'कर्ज'}</strong> दिनांक <strong className="font-bold border-b border-black px-1">{formatDate(selectedAccount?.loanDisbursementDate || selectedAccount?.openingDate)}</strong> रोजी आपणांस दिले आहे.
            </p>

            <p className="text-justify leading-relaxed text-sm md:text-base my-2">
              आपण आमच्या पतसंस्थेस प्रॉमिसरी नोट, कर्ज रोखा, जामीन कतबा, तारण गहाण दस्त इत्यादी कागदपत्रे लिहून सही करुन आमच्या पतसंस्थेच्या हक्कात दिल्या आहात. आपण सर्वांनी पतसंस्थेच्या कर्जाबाबतची मान्यता दिली आहे. त्यामुळे आपण सर्वांनी वैयक्तीक व संयुक्तीक कर्ज फेड करण्याची जबाबदारी स्विकारली आहे.
            </p>

            {/* Financial Breakdown Table */}
            <div className="my-2.5">
              <table className="w-full border-collapse border border-black text-center text-sm md:text-base">
                <thead>
                  <tr className="bg-gray-100 print:bg-transparent border-b border-black">
                    <th className="border-r border-black p-1.5 font-bold">कर्ज बाकी तारीख</th>
                    <th className="border-r border-black p-1.5 font-bold">मुदत येणे बाकी (रु.)</th>
                    <th className="border-r border-black p-1.5 font-bold">वसूल पात्र व्याज (रु.)</th>
                    <th className="border-r border-black p-1.5 font-bold">इतर खर्च (रु.)</th>
                    <th className="p-1.5 font-extrabold">एकूण येणे बाकी (रु.)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black font-semibold">
                    <td className="border-r border-black p-1.5">{formatDate(noticeDate)}</td>
                    <td className="border-r border-black p-1.5 font-mono">{formatMarathiCurrency(principalDue)}</td>
                    <td className="border-r border-black p-1.5 font-mono">{formatMarathiCurrency(interestDue)}</td>
                    <td className="border-r border-black p-1.5 font-mono">{formatMarathiCurrency(otherExpenses || 0)}</td>
                    <td className="p-1.5 font-mono font-bold text-red-700 print:text-black">{formatMarathiCurrency(totalPayable)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-center font-bold text-xs md:text-sm mt-1 text-gray-900 print:text-black">
                ({amountToMarathiWords(totalPayable)})
              </div>
            </div>

            {/* Body Paragraph 2 & Final Warning */}
            <p className="text-justify leading-relaxed text-sm md:text-base my-2">
              वरीलप्रमाणे रक्कम भरणेबाबत आपणांस लेखी व तोंडी प्रत्यक्ष भेटून आमच्या अधिकाऱ्यांनी कर्ज रक्कम जमा करण्याबाबत सुचना दिल्या आहेत. असे असूनही आपण १ ते ४ यांनी कर्जाची पूर्ण परतफेेड मुदतीत केलेली नाही. त्यामुळे आपण आमच्या पतसंस्थेचे थकबाकीदार आहात. त्यामुळे करारातील अटीप्रमाणे तुमच्याकडील कर्जाची संपूर्ण रक्कम एक रकमेने वसूल करण्याचा अधिकार संस्थेला प्राप्त झाला असून संस्थेच्या उपविधीनुसार कर्ज वसुलीबाबत तुमच्यावर इलाज करण्यास तुम्ही सर्वच पात्र झाला आहात.
            </p>

            <p className="text-justify leading-relaxed text-sm md:text-base my-2">
              अशाप्रकारे आपण पतसंस्थेचे वैयक्तीक व संयुक्तिकरित्या थकीत कर्ज रक्कम रु. <strong className="font-bold underline">{formatMarathiCurrency(totalPayable)}/-</strong> <span className="font-bold underline text-xs md:text-sm">({amountToMarathiWords(totalPayable)})</span> इतकी तसेच व्याजाची दि. <strong className="font-bold underline">{formatDate(noticeDate)}</strong> पासून आजतागायत देणे लागत आहे. सदरची नोटीस आपणांस मिळाल्यापासून <strong className="font-bold underline text-sm md:text-base">{String(deadlineDays).replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0x0966 - 48))}</strong> दिवसांचे आत आपण वरील कर्ज रक्कम भागविली नसल्यास आपणांविरुद्ध वसुलीसाठी कायदेशीर कारवाई सुरु करेल त्याची खर्चाची व परिणामांची जबाबदारी आपणावर राहील याची नोंद घ्यावी. तरी आपण वरील रक्कम मुदतीमध्ये जमा करावी.
            </p>

            {/* Bottom Signatures Block */}
            <div className="mt-6 pt-1 flex justify-between items-end text-sm md:text-base font-bold">
              <div className="text-center">
                <div className="mb-5">________________________</div>
                <div>सचिव / व्यवस्थापक</div>
              </div>

              <div className="text-center">
                <div className="mb-5">________________________</div>
                <div>अध्यक्ष / संचालक</div>
              </div>

              <div className="text-right max-w-xs">
                <div className="text-center">
                  <div className="font-extrabold mb-0.5">{sansthaName}</div>
                  <div className="text-xs font-normal text-gray-700 print:text-black">
                    {headerTaluka}, {headerDistrict}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

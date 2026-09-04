import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';
import FdAccrualPosting from './FdAccrualPosting';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  Landmark, 
  Building2,
  Calendar,
  ArrowLeft
} from 'lucide-react';

interface FdAccountReportRow {
  fdAccountID: number;
  branchName: string;
  memberCode: string;
  memberName: string;
  accountNo: string;
  schemeName: string;
  openingDate: string;
  depositAmount: number;
  interestRate: number;
  maturityDate: string;
  maturityAmount: number;
  legacyAccruedInt: number;
  status: string;
}

interface MemberOption {
  memberID: number;
  memberCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  cifNo?: string;
}

interface MemberLedgerData {
  memberID: number;
  memberCode: string;
  cifNo: string;
  memberName: string;
  mobileNo: string;
  address: string;
  branchName: string;
  totalFDAccountsCount: number;
  totalPrincipalInvested: number;
  totalMaturityValue: number;
  accounts: {
    fdAccountID: number;
    accountNo: string;
    openingDate: string;
    maturityDate: string;
    depositAmount: number;
    interestRate: number;
    maturityAmount: number;
    status: string;
    paymentMode: string;
    nomineeName: string;
    nomineeRelation: string;
    remarks: string;
    schemeName: string;
    durationMonths: number;
    totalAccruedInterest: number;
    transactions: {
      fdTransactionID: number;
      transactionDate: string;
      transactionType: string;
      debitCredit: string;
      amount: number;
      voucherNo: string;
      narration: string;
    }[];
  }[];
}

interface FdReportsProps {
  onNavigate?: (tab: string, params?: any) => void;
  onBack?: () => void;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatDisplayDate = (dStr?: string | null) => {
  if (!dStr) return '-';
  try {
    const clean = dStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dStr;
  }
};

const formatMemberOptionLabel = (m: MemberOption) => {
  const code = m.memberCode || m.memberID;
  const name = `${m.firstName || ''} ${m.middleName || ''} ${m.lastName || ''}`.trim();
  const cif = m.cifNo ? ` [CIF: ${m.cifNo}]` : '';
  return `${code} - ${name}${cif}`;
};

export default function FdReports({ onNavigate, onBack }: FdReportsProps) {
  const [reportType, setReportType] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('reportType') || 'Register';
  });

  const [branches, setBranches] = useState<any[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedMemberID, setSelectedMemberID] = useState<number>(0);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 1;
  const [branchID, setBranchID] = useState<number>(initialBranchId);

  const [data, setData] = useState<FdAccountReportRow[]>([]);
  const [memberLedger, setMemberLedger] = useState<MemberLedgerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBranches();
    fetchSansthaDetail();
    fetchMembers();
  }, []);

  const fetchSansthaDetail = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSansthaDetail(res.data[0]);
      } else if (res.data && !Array.isArray(res.data)) {
        setSansthaDetail(res.data);
      }
    } catch (err) {
      console.error('Error fetching sanstha detail', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await axios.get('/api/Members');
      setMembers(res.data || []);
    } catch (err) {
      console.error('Error fetching members', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  useEffect(() => {
    if (reportType === 'MemberLedger') {
      if (selectedMemberID > 0) {
        fetchMemberLedgerData(selectedMemberID);
      } else {
        setMemberLedger(null);
      }
    } else if (reportType !== 'AccrualProvision') {
      fetchReportData();
    }
  }, [reportType, branchID, selectedMemberID]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let endpoint = '/api/Reports/fd-register';
      if (reportType === 'Outstanding') endpoint = '/api/Reports/fd-outstanding';
      if (reportType === 'MaturityDue') endpoint = '/api/Reports/fd-maturity-due';

      const res = await axios.get(endpoint, {
        params: { branchID: branchID > 0 ? branchID : undefined }
      });
      setData(res.data || []);
    } catch (err) {
      console.error('Error fetching FD report data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberLedgerData = async (memberId: number) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/Reports/fd-member-ledger/${memberId}`);
      setMemberLedger(res.data);
    } catch (err) {
      console.error('Error fetching FD member ledger', err);
      setMemberLedger(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredData = data.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (row.accountNo && row.accountNo.toLowerCase().includes(term)) ||
      (row.memberName && row.memberName.toLowerCase().includes(term)) ||
      (row.memberCode && row.memberCode.toLowerCase().includes(term)) ||
      (row.schemeName && row.schemeName.toLowerCase().includes(term))
    );
  });

  const totalDepositSum = filteredData.reduce((s, r) => s + (r.depositAmount || 0), 0);
  const totalMaturitySum = filteredData.reduce((s, r) => s + (r.maturityAmount || 0), 0);

  const getReportTitle = () => {
    switch (reportType) {
      case 'Register': return 'मुदत ठेव नोंदवही (Fixed Deposit Register)';
      case 'Outstanding': return 'मुदत ठेव बाकी अहवाल (FD Outstanding Report)';
      case 'MaturityDue': return 'मुदतपूर्ती देय अहवाल (FD Maturity Due Report)';
      case 'MemberLedger': return 'मुदत ठेव खातावणी विवरणपत्र (Member FD Ledger)';
      default: return 'मुदत ठेव अहवाल (FD Report)';
    }
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा नाही.');
    const excelRows = filteredData.map((row, i) => ({
      'अ.क्र.': i + 1,
      'FD पावती / खाते नं.': row.accountNo,
      'सभासद कोड': row.memberCode,
      'खातेदाराचे नाव': row.memberName,
      'योजना': row.schemeName,
      'ठेव तारीख': formatDisplayDate(row.openingDate),
      'मुदत ठेव रक्कम (₹)': row.depositAmount || 0,
      'व्याज दर (%)': row.interestRate,
      'मुदतपूर्ती तारीख': formatDisplayDate(row.maturityDate),
      'मुदतपूर्ती रक्कम (₹)': row.maturityAmount || 0,
      'स्थिती': row.status
    }));

    excelRows.push({
      'अ.क्र.': '' as any,
      'FD पावती / खाते नं.': '',
      'सभासद कोड': '',
      'खातेदाराचे नाव': 'एकूण बेरीज (Grand Total):',
      'योजना': '',
      'ठेव तारीख': '',
      'मुदत ठेव रक्कम (₹)': totalDepositSum,
      'व्याज दर (%)': 0,
      'मुदतपूर्ती तारीख': '',
      'मुदतपूर्ती रक्कम (₹)': totalMaturitySum,
      'स्थिती': ''
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FD Report');
    XLSX.writeFile(wb, `FD_Report_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 8mm 8mm;
            }
            body * {
              visibility: hidden;
            }
            .print-area, .print-area * {
              visibility: visible;
            }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: transparent !important;
            }
            .no-print {
              display: none !important;
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
        `}
      </style>

      {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print space-y-1.5">
        
        {/* Row 1: Title + Inline Filters + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          
          {/* Left: Compact Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Landmark size={14} className="stroke-[2.5]" />
            </div>
            <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
              <span>मुदत ठेव अहवाल</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(FD Reports Center)</span>
            </h1>
          </div>

          {/* Center: Integrated Inline Filter Inputs */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
            
            {/* Report Type */}
            <div className="w-48 sm:w-56">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-bold bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full text-primary"
              >
                <option value="Register">१. मुदत ठेव नोंदवही (FD Register)</option>
                <option value="Outstanding">२. मुदत ठेव बाकी अहवाल (FD Outstanding)</option>
                <option value="MaturityDue">३. मुदतपूर्ती देय अहवाल (Maturity Due)</option>
                <option value="MemberLedger">४. मुदत ठेव खातावणी (Member Ledger)</option>
                <option value="AccrualProvision">५. व्याज तरतूद (Interest Provision)</option>
              </select>
            </div>

            {/* Branch or Member selector */}
            {reportType === 'MemberLedger' ? (
              <div className="w-64 sm:w-72">
                <SearchableSelect
                  name="memberID"
                  options={members.map((m) => ({
                    value: m.memberID,
                    label: formatMemberOptionLabel(m),
                  }))}
                  value={selectedMemberID}
                  onChange={(e: any) => setSelectedMemberID(parseInt(e.target.value, 10) || 0)}
                  placeholder="नाव किंवा कोडने शोधा..."
                />
              </div>
            ) : reportType !== 'AccrualProvision' ? (
              <div className="flex items-center gap-1">
                <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
                <select
                  value={branchID}
                  onChange={(e) => setBranchID(parseInt(e.target.value, 10))}
                  className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
                >
                  <option value={0}>सर्व शाखा (All)</option>
                  {branches.map((b) => (
                    <option key={b.branchID} value={b.branchID}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* View Button */}
            {reportType !== 'AccrualProvision' && (
              <button
                onClick={fetchReportData}
                disabled={loading}
                className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
                <span>पहा</span>
              </button>
            )}
          </div>

          {/* Right: Export & Print Action Buttons */}
          {reportType !== 'AccrualProvision' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleExportExcel}
                disabled={filteredData.length === 0}
                className={`h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${filteredData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="एक्सेल फाइल डाउनलोड करा"
              >
                <FileSpreadsheet size={12} />
                <span>एक्सेल</span>
              </button>

              <button
                onClick={handlePrint}
                disabled={filteredData.length === 0 && !memberLedger}
                className={`h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${(filteredData.length === 0 && !memberLedger) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="A4 प्रिंट काढा"
              >
                <Printer size={12} />
                <span>प्रिंट (A4)</span>
              </button>
            </div>
          )}

        </div>

        {/* Row 2: In-Table Search + Summary Metrics Strip */}
        {reportType !== 'AccrualProvision' && reportType !== 'MemberLedger' && (
          <div className="pt-1.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="relative w-64 max-w-full">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="नाव, खाते क्र. किंवा योजना शोधा..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-600">
              <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                एकूण खाती: <strong className="text-primary font-bold">{filteredData.length}</strong>
              </span>
              <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200">
                एकूण मुदत ठेव: <strong className="text-emerald-700 font-bold">₹ {fmtCurrency(totalDepositSum)}</strong>
              </span>
            </div>
          </div>
        )}

      </div>

      {reportType === 'AccrualProvision' ? (
        <FdAccrualPosting />
      ) : (
        /* Main Printable A4 Document Frame */
        <div 
          ref={reportRef} 
          className="print-area bg-white mx-auto max-w-5xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 min-h-[900px] flex flex-col justify-between text-xs"
        >
          <div>
            
            {/* Official Bank Header Box (Exact Reference Format) */}
            <div className="border border-gray-900 p-3 relative text-center">
              
              {/* Registration Top Bar */}
              <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
                <div>
                  <span>रजि. नं. - </span>
                  <span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span>
                </div>
                <div>
                  <span>रजि. दि. - </span>
                  <span className="font-mono">{sansthaDetail?.registrationDate ? formatDisplayDate(sansthaDetail.registrationDate) : '-'}</span>
                </div>
              </div>

              {/* Central Sanstha Name */}
              <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
                {sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
              </h1>

              {/* Subtitle / Address */}
              <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
                {sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
              </p>
            </div>

            {/* Report Title Banner Section */}
            <div className="mt-3 mb-2 flex items-center justify-between">
              <div className="w-28 hidden sm:block"></div>

              {/* Title Banner Box */}
              <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs text-center">
                <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif">
                  {getReportTitle()}
                </h2>
              </div>

              {/* Date Tag on Right */}
              <div className="text-right text-xs font-bold text-gray-800">
                <span>दिनांक : </span>
                <span className="font-mono">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Member Ledger View */}
            {reportType === 'MemberLedger' && memberLedger && (
              <div className="space-y-4">
                <div className="border border-gray-900 p-2.5 my-2 bg-gray-50/50 rounded-xs text-[11px]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-gray-500 block text-[10px]">सभासद नाव:</span>
                      <strong className="text-gray-950">{memberLedger.memberName}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">सभासद कोड / CIF:</span>
                      <strong className="text-primary font-mono">{memberLedger.memberCode || memberLedger.cifNo || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">एकूण FD खाती:</span>
                      <strong className="text-gray-900 font-mono">{memberLedger.totalFDAccountsCount}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">एकूण मुदत ठेव गुंतवणूक:</span>
                      <strong className="text-emerald-800 font-mono">₹ {fmtCurrency(memberLedger.totalPrincipalInvested)}</strong>
                    </div>
                  </div>
                </div>

                {memberLedger.accounts.map((acc, aIdx) => (
                  <div key={acc.fdAccountID || aIdx} className="border border-gray-900 p-2.5 rounded-xs mt-3">
                    <div className="flex justify-between items-center bg-gray-100 p-1.5 border-b border-gray-900 font-bold text-xs mb-2">
                      <span>FD पावती नं.: <span className="font-mono text-primary">{acc.accountNo}</span> ({acc.schemeName})</span>
                      <span className="text-emerald-800 font-mono">ठेव रक्कम: ₹ {fmtCurrency(acc.depositAmount)} | व्याज दर: {acc.interestRate}%</span>
                    </div>

                    <table className="w-full border-collapse border border-gray-900 text-xs">
                      <thead>
                        <tr className="bg-gray-50 font-bold border-b border-gray-900">
                          <th className="border border-gray-900 p-1 text-center">तारीख</th>
                          <th className="border border-gray-900 p-1 text-center">व्हाउचर क्र.</th>
                          <th className="border border-gray-900 p-1 text-left">तपशील</th>
                          <th className="border border-gray-900 p-1 text-right">रक्कम (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acc.transactions.map((tx, tIdx) => (
                          <tr key={tIdx} className="text-[11px]">
                            <td className="border border-gray-900 p-1 text-center font-mono">{formatDisplayDate(tx.transactionDate)}</td>
                            <td className="border border-gray-900 p-1 text-center font-mono">{tx.voucherNo || '-'}</td>
                            <td className="border border-gray-900 p-1">{tx.narration || tx.transactionType}</td>
                            <td className="border border-gray-900 p-1 text-right font-mono font-bold">{fmtCurrency(tx.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {/* Standard FD Table (Register, Outstanding, Maturity Due) */}
            {reportType !== 'MemberLedger' && (
              <div className="overflow-x-auto mt-2">
                <table className="w-full border-collapse border border-gray-900 text-xs">
                  <thead>
                    <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                      <th className="border border-gray-900 py-1.5 px-1 w-[5%] text-center">#</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-center">FD पावती क्र.</th>
                      <th className="border border-gray-900 py-1.5 px-3 w-[26%] text-left">खातेदाराचे नाव</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-left">योजना</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-center">ठेव दिनांक</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[14%] text-right font-extrabold">ठेव रक्कम (₹)</th>
                      <th className="border border-gray-900 py-1.5 px-1 w-[5%] text-center">व्याज %</th>
                      <th className="border border-gray-900 py-1.5 px-2 w-[11%] text-center">मुदतपूर्ती दिनांक</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                        </td>
                      </tr>
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-gray-500 font-semibold border border-gray-900">
                          कोणतीही मुदत ठेव नोंद आढळली नाही.
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((row, idx) => (
                        <tr key={row.fdAccountID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">{idx + 1}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-900">{row.accountNo}</td>
                          <td className="border border-gray-900 py-1 px-3 font-medium">{row.memberName}</td>
                          <td className="border border-gray-900 py-1 px-2 text-gray-700">{row.schemeName}</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.openingDate)}</td>
                          <td className="border border-gray-900 py-1 px-2 text-right font-mono font-bold text-emerald-800">{fmtCurrency(row.depositAmount)}</td>
                          <td className="border border-gray-900 py-1 px-1 text-center font-mono">{row.interestRate}%</td>
                          <td className="border border-gray-900 py-1 px-2 text-center font-mono">{formatDisplayDate(row.maturityDate)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredData.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                        <td colSpan={5} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                          एकूण मुदत ठेव बेरीज:
                        </td>
                        <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                          ₹ {fmtCurrency(totalDepositSum)}
                        </td>
                        <td colSpan={2} className="border border-gray-900 py-1.5 px-2 text-center"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

          </div>

          {/* Verification Signatures Section */}
          <div className="mt-14 pt-4 border-t border-dashed border-gray-400 grid grid-cols-3 text-center text-xs font-bold text-gray-900">
            <div>
              <div className="h-10"></div>
              <p className="border-t border-gray-800 mx-4 pt-1">लिपिक / रोखपाल</p>
              <span className="text-[10px] text-gray-500 font-normal">(Clerk / Cashier)</span>
            </div>

            <div>
              <div className="h-10"></div>
              <p className="border-t border-gray-800 mx-4 pt-1">लेखापाल / ठेव तपासनीस</p>
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
}

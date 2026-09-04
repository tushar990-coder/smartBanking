import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
  Printer, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  PiggyBank, 
  Building2,
  Calendar
} from 'lucide-react';

interface SavingAccountDto {
  savingAccountID: number;
  branchID?: number;
  branchName?: string;
  branchCode?: string;
  accountNo: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  customerID?: number;
  memberID?: number;
  cifNo?: string;
  memberCode?: string;
  memberName?: string;
  memberNameEng?: string;
  customer?: { firstName: string; middleName?: string; lastName: string; cifNo?: string; mobileNo?: string };
  member?: { firstName: string; middleName?: string; lastName: string; memberCode?: string; cifNo?: string };
  accountType: string;
  openingDate: string;
  openingBalance?: number;
  currentBalance: number;
  interestRate?: number;
  minimumBalance?: number;
  status: string;
  ledgerID?: number;
  ledgerName?: string;
  ledger?: { ledgerName: string };
  lastInterestPostingDate?: string;
  lastInterestAmount?: number;
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

export default function SavingAccountListReport() {
  const [data, setData] = useState<SavingAccountDto[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [branches, setBranches] = useState<any[]>([]);
  
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSanstha();
    fetchBranches();
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedBranchId]);

  const fetchSanstha = async () => {
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
      console.error('Failed to fetch sanstha details', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = '/api/SavingAccounts';
      if (selectedBranchId !== 'all') {
        url += `?branchId=${selectedBranchId}`;
      }
      const res = await axios.get(url);
      setData(res.data || []);
    } catch (err: any) {
      console.error(err);
      alert('बचत खाती डेटा लोड करता आला नाही.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getMemberName = (acc: SavingAccountDto) => {
    if (acc.memberName && acc.memberName.trim() !== '') {
      return acc.memberName.trim();
    }
    if (acc.customer) {
      const c = acc.customer;
      return `${c.firstName || ''} ${c.middleName || ''} ${c.lastName || ''}`.trim();
    }
    if (acc.member) {
      const m = acc.member;
      return `${m.firstName || ''} ${m.middleName || ''} ${m.lastName || ''}`.trim();
    }
    return '-';
  };

  const getCifNo = (acc: SavingAccountDto) => {
    return acc.cifNo || acc.customer?.cifNo || acc.member?.cifNo || acc.memberCode || acc.member?.memberCode || '-';
  };

  // Filter items
  const filteredData = data.filter((item) => {
    if (statusFilter !== 'सर्व' && item.status !== statusFilter) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const name = getMemberName(item).toLowerCase();
    const accNo = (item.accountNo || '').toLowerCase();
    const oldAccNo = (item.oldAccountNo || item.legacyAccountNumber || '').toLowerCase();
    const cif = getCifNo(item).toLowerCase();
    const code = (item.memberCode || item.member?.memberCode || '').toLowerCase();
    return name.includes(term) || accNo.includes(term) || oldAccNo.includes(term) || code.includes(term) || cif.includes(term);
  });

  const totalBalance = filteredData.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      alert('एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }

    const excelRows: any[] = [];
    let sr = 1;

    filteredData.forEach((a) => {
      excelRows.push({
        'अ.क्र.': sr++,
        'बचत खाते नं. (CBS)': a.accountNo,
        'बचत खाते नं.': a.accountNo,
        'जुने खाते नं.': a.oldAccountNo || a.legacyAccountNumber || '-',
        'सभासद कोड': a.memberCode || a.member?.memberCode || a.memberID || '-',
        'खातेदाराचे नाव': getMemberName(a),
        'खाते उघडल्याचा दिनांक': formatDisplayDate(a.openingDate),
        'सध्याची शिल्लक (₹)': a.currentBalance || 0,
        'स्थिती': a.status
      });
    });

    excelRows.push({
      'अ.क्र.': '',
      'बचत खाते नं.': '',
      'जुने खाते नं.': '',
      'सभासद कोड': '',
      'खातेदाराचे नाव': 'एकूण बचत शिल्लक (Grand Total):',
      'खाते उघडल्याचा दिनांक': '',
      'सध्याची शिल्लक (₹)': totalBalance,
      'स्थिती': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'बचत खाते यादी');
    XLSX.writeFile(workbook, `Saving_Accounts_List_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 8mm 8mm 8mm;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background-color: white !important;
            }
          }
        `}
      </style>

      {/* Header Actions: Non-printable */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-md shadow-xs border border-slate-200 print:hidden mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-sm text-primary">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              बचत खाते यादी <span className="text-xs font-normal text-gray-500 font-mono">(Saving Account List)</span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-gray-600">शाखा:</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={hasGlobalBranch}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-primary disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="all">सर्व शाखा (All Branches)</option>
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-gray-600">स्थिती:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:border-primary"
            >
              <option value="Active">सक्रिय (Active)</option>
              <option value="Closed">बंद (Closed)</option>
              <option value="सर्व">सर्व (All)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1 bg-primary text-white text-xs font-semibold rounded hover:opacity-90 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Search className="w-3.5 h-3.5" />
            <span>पहा</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1 px-3 py-1 bg-emerald-700 text-white text-xs font-semibold rounded hover:bg-emerald-800 transition-all shadow-xs cursor-pointer"
            title="Excel मध्ये एक्सपोर्ट करा"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>एक्सेल</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1 px-3 py-1 bg-slate-800 text-white text-xs font-semibold rounded hover:bg-slate-900 transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>प्रिंट (A4)</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-md shadow-xs border border-slate-200 print:hidden mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="नाव, खाते क्र., जुना क्र. किंवा कोड शोधा..."
            className="w-full text-xs pl-7 pr-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:border-primary"
          />
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2.5" />
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded font-medium border border-slate-200">
            एकूण खाती: <span className="font-bold text-gray-900 font-mono">{filteredData.length}</span>
          </div>
          <div className="text-xs bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded font-medium border border-emerald-200">
            एकूण बचत शिल्लक: <span className="font-bold font-mono">₹ {fmtCurrency(totalBalance)}</span>
          </div>
        </div>
      </div>

      <div 
        ref={reportRef} 
        className="bg-white p-6 sm:p-8 rounded-md shadow-sm border border-slate-200 mx-auto max-w-[210mm] print:shadow-none print:border-none print:p-0 print:m-0"
      >
        <div className="border border-gray-900 p-2.5 mb-2">
          <div className="flex justify-between items-start text-[11px] font-bold text-gray-800">
            <div>रजि. नं. - {sansthaDetail?.registrationNo || '-'}</div>
            <div>रजि. दि. - {sansthaDetail?.registrationDate ? formatDisplayDate(sansthaDetail.registrationDate) : '-'}</div>
          </div>
          
          <div className="text-center my-1">
            <h1 className="text-lg font-black text-gray-950 uppercase tracking-tight">
              {sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
            </h1>
            <p className="text-[11px] font-medium text-gray-800 mt-0.5">
              {sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
            </p>
          </div>
        </div>

        {/* Report Title & Metadata Banner */}
        <div className="flex justify-between items-center mb-1 text-xs">
          <div className="w-1/3"></div>
          <div className="w-1/3 text-center">
            <span className="border border-gray-900 px-4 py-1 font-bold text-gray-950 uppercase inline-block text-[11px] bg-slate-50">
              बचत खाते यादी (SAVING ACCOUNT LIST)
            </span>
          </div>
          <div className="w-1/3 text-right font-bold text-gray-900 text-[11px]">
            दिनांक : <span className="font-mono">{formatDisplayDate(new Date().toISOString())}</span>
          </div>
        </div>

        {/* Selected Branch Details if specific branch */}
        {selectedBranchId !== 'all' && (
          <div className="text-xs font-semibold text-gray-800 mb-1 text-left">
            शाखा: {branches.find(b => b.branchID.toString() === selectedBranchId)?.branchName || 'मुख्य शाखा'}
          </div>
        )}

        {/* Table Data */}
        <div className="overflow-x-auto mt-2">
          <table className="w-full border-collapse border border-gray-900 text-xs">
            <thead>
              <tr className="bg-gray-100/90 text-gray-900 border-b border-gray-900 text-center font-bold">
                <th className="border border-gray-900 py-1.5 px-1 w-[6%] text-center">अ.क्र.</th>
                <th className="border border-gray-900 py-1.5 px-2 w-[20%] text-center">बचत खाते नं.</th>
                <th className="border border-gray-900 py-1.5 px-3 w-[40%] text-left">खातेदाराचे नाव</th>
                <th className="border border-gray-900 py-1.5 px-2 w-[16%] text-center">उघडल्याचा दिनांक</th>
                <th className="border border-gray-900 py-1.5 px-3 w-[18%] text-right font-extrabold">शिल्लक रक्कम (₹)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                    माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                    कोणतीही बचत खाते नोंद आढळली नाही.
                  </td>
                </tr>
              ) : (
                filteredData.map((acc, idx) => (
                  <tr key={acc.savingAccountID || idx} className="hover:bg-slate-50 text-gray-900 text-[11px]">
                    <td className="border border-gray-900 py-1 px-1 text-center font-mono font-medium">
                      {idx + 1}
                    </td>
                    <td className="border border-gray-900 py-1 px-2 text-center font-mono font-bold text-gray-900">
                      <div>{acc.accountNo}</div>
                      {(acc.oldAccountNo || acc.legacyAccountNumber) && (
                        <div className="text-[10px] text-amber-950 font-bold bg-amber-100/80 border border-amber-300 rounded px-1 mt-0.5 inline-block print:text-black">
                          जुने: {acc.oldAccountNo || acc.legacyAccountNumber}
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-900 py-1 px-3 font-medium">
                      <div className="font-bold text-gray-900 leading-snug">{getMemberName(acc)}</div>
                      {(acc.memberCode || acc.cifNo) && (
                        <div className="text-[10px] text-gray-600 font-mono print:text-black mt-0.5">
                          {acc.memberCode ? `कोड: ${acc.memberCode}` : ''} {acc.cifNo ? ` | CIF: ${acc.cifNo}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-900 py-1 px-2 text-center font-mono text-gray-700">
                      {formatDisplayDate(acc.openingDate)}
                    </td>
                    <td className="border border-gray-900 py-1 px-3 text-right font-mono font-bold text-gray-950">
                      {fmtCurrency(acc.currentBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
              {filteredData.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-xs">
                    <td colSpan={4} className="border border-gray-900 py-1.5 px-3 text-right uppercase tracking-wider">
                      एकूण बचत शिल्लक बेरीज:
                    </td>
                    <td className="border border-gray-900 py-1.5 px-3 text-right font-mono font-black text-emerald-950 bg-emerald-100/50">
                      ₹ {fmtCurrency(totalBalance)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
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
            <p className="border-t border-gray-800 mx-4 pt-1">लेखापाल / बचत तपासनीस</p>
            <span className="text-[10px] text-gray-500 font-normal">(Accountant / Inspector)</span>
          </div>

          <div>
            <div className="h-10"></div>
            <p className="border-t border-gray-800 mx-4 pt-1">शाखा व्यवस्थापक / मानद सचिव</p>
            <span className="text-[10px] text-gray-500 font-normal">(Manager / Secretary)</span>
          </div>
        </div>

      </div>

    </div>
  );
}

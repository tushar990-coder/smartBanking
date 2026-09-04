import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  BookOpen
} from 'lucide-react';

interface MemberBalanceRow {
  memberId: number;
  memberCode: string;
  legacyMemberNo?: string;
  cifNo?: string;
  memberName: string;
  balance: number;
  balanceType?: string;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function MemberBalanceReport() {
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  
  const [balances, setBalances] = useState<MemberBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [sansthaRes, ledgersRes, branchesRes] = await Promise.all([
        axios.get('/api/SansthaDetails'),
        axios.get('/api/Ledgers'),
        axios.get('/api/Branches')
      ]);

      if (sansthaRes.data) {
        if (Array.isArray(sansthaRes.data) && sansthaRes.data.length > 0) {
          setSansthaDetail(sansthaRes.data[0]);
        } else if (!Array.isArray(sansthaRes.data)) {
          setSansthaDetail(sansthaRes.data);
        }
      }

      if (ledgersRes.data) {
        const personalLedgers = ledgersRes.data.filter((l: any) => l.accountType === 'Personal Account' || l.accountType === 'Share Capital');
        setLedgers(personalLedgers);
        if (personalLedgers.length > 0) {
          setSelectedLedgerId(personalLedgers[0].ledgerID.toString());
        }
      }

      if (branchesRes.data) {
        setBranches(branchesRes.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReport = async () => {
    if (!selectedLedgerId) {
      alert('कृपया लेजर निवडा (Please select a ledger)');
      return;
    }
    
    setLoading(true);
    try {
      const params: any = {
        ledgerId: selectedLedgerId,
        asOfDate: asOfDate
      };
      if (selectedBranchId !== 'all') {
        params.branchId = selectedBranchId;
      }
      
      const res = await axios.get('/api/Reports/MemberBalances', { params });
      setBalances(res.data || []);
    } catch (err) {
      console.error(err);
      alert('सभासद शेअर्स यादी लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const selectedLedgerName = ledgers.find(l => l.ledgerID.toString() === selectedLedgerId)?.ledgerName || '';

  const filteredBalances = balances.filter(item => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      (item.memberCode && item.memberCode.toLowerCase().includes(term)) ||
      (item.legacyMemberNo && item.legacyMemberNo.toLowerCase().includes(term)) ||
      (item.cifNo && item.cifNo.toLowerCase().includes(term)) ||
      (item.memberName && item.memberName.toLowerCase().includes(term))
    );
  });

  const totalBalanceSum = filteredBalances.reduce((sum, r) => sum + (r.balance || 0), 0);

  const handleExportExcel = () => {
    if (filteredBalances.length === 0) {
      alert('एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }

    const excelRows: any[] = [];
    let sr = 1;

    filteredBalances.forEach((r) => {
      excelRows.push({
        'अ.क्र.': sr++,
        'सभासद क्र.': r.memberCode || r.memberId,
        'जुना सभासद क्र.': r.legacyMemberNo || '-',
        'CIF क्र.': r.cifNo || '-',
        'सभासदाचे नाव': r.memberName,
        'बाकी रक्कम (₹)': r.balance || 0
      });
    });

    excelRows.push({
      'अ.क्र.': '',
      'सभासद क्र.': '',
      'जुना सभासद क्र.': '',
      'CIF क्र.': '',
      'सभासदाचे नाव': 'एकूण बेरीज (Grand Total):',
      'बाकी रक्कम (₹)': totalBalanceSum
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'सभासद शिल्लक');
    XLSX.writeFile(workbook, `Member_Balances_${asOfDate}.xlsx`);
  };

  const getBranchName = () => {
    if (selectedBranchId === 'all') return 'सर्व शाखा';
    const b = branches.find((item: any) => item.branchID?.toString() === selectedBranchId);
    return b ? b.branchName : 'मुख्य शाखा';
  };

  // Filter toolbar controls
  const filterControls = (
    <>
      {/* Branch */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
        <select
          value={selectedBranchId}
          disabled={hasGlobalBranch}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28 sm:w-32"
        >
          <option value="all">सर्व शाखा (All)</option>
          {branches.map((b: any) => (
            <option key={b.branchID} value={b.branchID.toString()}>
              {b.branchName}
            </option>
          ))}
        </select>
      </div>

      {/* Ledger Select */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">लेजर:</label>
        <select
          value={selectedLedgerId}
          onChange={(e) => setSelectedLedgerId(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-bold bg-white focus:outline-none focus:border-primary w-36 sm:w-48 text-primary"
        >
          {ledgers.map((l: any) => (
            <option key={l.ledgerID} value={l.ledgerID.toString()}>
              {l.ledgerName}
            </option>
          ))}
        </select>
      </div>

      {/* As of Date */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">दिनांक:</label>
        <input
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
        />
      </div>

      {/* In-table Search */}
      <div className="relative w-36 sm:w-44">
        <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="नाव / कोड शोधा..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-5 pr-1 py-0.5 h-6 border border-gray-300 rounded-xs text-[10.5px] focus:outline-none focus:border-primary bg-white"
        />
      </div>

      {/* View Button */}
      <button
        onClick={fetchReport}
        disabled={loading}
        className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-xs text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
      >
        {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
        <span>पहा</span>
      </button>
    </>
  );

  return (
    <CbsReportLayout
      defaultPaperSize="a4-portrait"
      allowPaperSizeToggle={true}
      reportTitle="सभासद शेअर्स व ठेव बाकी यादी"
      reportSubtitle={selectedLedgerName ? `Member Balances: ${selectedLedgerName}` : 'Member Shares & Deposit Balances'}
      periodText={`${formatDisplayDate(asOfDate)} पर्यंत`}
      branchName={getBranchName()}
      sansthaInfo={sansthaDetail}
      signatureTier="3-tier"
      signatureTitles={[
        { title: 'लिपिक / नोंदणी सहाय्यक', subtitle: '(Clerk / Assistant)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' }
      ]}
      onExportExcel={handleExportExcel}
      extraToolbarControls={filterControls}
      isLoading={loading}
      hasData={balances.length > 0}
      emptyState={
        <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
          <BookOpen size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">कृपया लेजर व दिनांक निवडून "पहा" बटणावर क्लिक करा.</p>
        </div>
      }
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">अ.क्र.</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-center">सभासद क्र.</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center">जुना क्र.</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[40%] text-left">सभासदाचे नाव</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[24%] text-right font-extrabold">बाकी रक्कम (₹)</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
              </td>
            </tr>
          ) : filteredBalances.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                कोणतीही बाकी नोंद आढळली नाही.
              </td>
            </tr>
          ) : (
            filteredBalances.map((m, idx) => (
              <tr key={m.memberId || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                  {idx + 1}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">
                  {m.memberCode || m.memberId}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono text-amber-900 font-bold bg-amber-50/40">
                  {m.legacyMemberNo || '-'}
                </td>
                <td className="border border-slate-900 py-1 px-3 font-medium">
                  {m.memberName}
                </td>
                <td className="border border-slate-900 py-1 px-3 cbs-num-cell cbs-amt-bal font-bold">
                  {fmtCurrency(m.balance)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {filteredBalances.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
              <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                एकूण बेरीज ({filteredBalances.length} सभासद):
              </td>
              <td className="border border-slate-900 py-1.5 px-3 cbs-num-cell cbs-amt-bal font-black text-emerald-950 bg-emerald-100/60">
                ₹ {fmtCurrency(totalBalanceSum)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </CbsReportLayout>
  );
}

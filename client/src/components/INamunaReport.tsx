import React, { useState, useEffect } from "react";
import axios from "axios";
import MemberSearchSelect from "./common/MemberSearchSelect";
import * as XLSX from "xlsx";
import CbsReportLayout, { formatDisplayDate } from "./common/CbsReportLayout";
import { 
  Search, 
  RefreshCw, 
  BookOpen, 
  Layers
} from "lucide-react";

interface SansthaInfo {
  sansthaName: string;
  address: string;
  registrationNo: string;
  registrationDate: string;
}

interface MemberInfo {
  memberID: number;
  memberCode: string;
  accountNo: string;
  joiningDate: string;
  entranceFeeDate: string;
  fullName: string;
  address: string;
  ageAtJoining: number;
  nomineeName: string;
  nomineeAddress: string;
  nominationDate: string | null;
  cessationDate: string | null;
  occupation: string;
  cessationReason: string;
  remarks: string;
}

interface INamunaTransaction {
  allotmentDate: string | null;
  allotmentCashbookNo: string;
  application: string;
  totalAmountReceived: number;
  numberOfSharesHeld: number;
  allotmentCertificateNo: string;

  transferDate: string | null;
  transferCashbookNo: string;
  numberOfSharesTransferred: number;
  numberOfSharesReturned: number;

  balanceAmount: number;
  balanceCertificateNo: string;
  remarks: string;
}

interface INamunaReport {
  sansthaInfo: SansthaInfo;
  memberInfo: MemberInfo;
  transactions: INamunaTransaction[];
}

interface INamunaRegisterRow {
  srNo: number;
  memberID: number;
  memberCode: string;
  cifNo: string;
  fullName: string;
  fullNameEng: string;
  address: string;
  occupation: string;
  joiningDate: string;
  ageAtJoining?: number | null;
  totalShareCount: number;
  totalShareAmount: number;
  certificateNos: string;
  nomineeName: string;
  nomineeRelation: string;
  nomineeAddress: string;
  nomineeIsMinor: boolean;
  nomineeGuardianName?: string | null;
  status: string;
  cessationDate?: string | null;
  cessationReason?: string | null;
  remarks?: string | null;
}

interface INamunaRegisterResponse {
  sansthaInfo: any;
  rows: INamunaRegisterRow[];
  totalMembers: number;
  totalShares: number;
  totalShareCapital: number;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function INamunaReport() {
  // Mode: 'register' = Consolidated Form I, 'single' = Single Member Form I Ledger
  const [viewMode, setViewMode] = useState<'register' | 'single'>('register');

  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);
  const [statusFilter, setStatusFilter] = useState<string>('सर्व');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data states
  const [registerData, setRegisterData] = useState<INamunaRegisterResponse | null>(null);
  const [reportData, setReportData] = useState<INamunaReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchSansthaDetails();
    fetchBranches();
  }, []);

  useEffect(() => {
    if (viewMode === 'register') {
      fetchRegisterData();
    }
  }, [viewMode, selectedBranchId, statusFilter]);

  const fetchSansthaDetails = async () => {
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
      console.error(err);
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

  const fetchMembers = async () => {
    try {
      const res = await axios.get('/api/Members');
      setMembers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRegisterData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranchId !== 'all') params.append('branchId', selectedBranchId);
      if (statusFilter !== 'सर्व') params.append('status', statusFilter);

      const res = await axios.get(`/api/Reports/i-namuna-register?${params.toString()}`);
      setRegisterData(res.data);
    } catch (err) {
      console.error(err);
      alert("एकत्रित आय-नमुना डेटा लोड करण्यात त्रुटी आली.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewSingle = async () => {
    if (!selectedMemberId) {
      alert("कृपया सभासद निवडा.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(
        `/api/Reports/i-namuna?memberId=${selectedMemberId}`,
      );
      if (res.data) {
        setReportData(res.data);
      } else {
        alert("रिपोर्ट डेटा मिळू शकला नाही.");
      }
    } catch (err) {
      console.error(err);
      alert("सर्व्हरशी संपर्क होऊ शकला नाही.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered rows for consolidated register
  const filteredRegisterRows = (registerData?.rows || []).filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const name = (r.fullName || '').toLowerCase();
    const code = (r.memberCode || '').toLowerCase();
    const cif = (r.cifNo || '').toLowerCase();
    const nom = (r.nomineeName || '').toLowerCase();
    return name.includes(term) || code.includes(term) || cif.includes(term) || nom.includes(term);
  });

  const exportRegisterExcel = () => {
    if (filteredRegisterRows.length === 0) {
      alert("एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.");
      return;
    }

    const excelRows = filteredRegisterRows.map((r) => ({
      "अ.क्र.": r.srNo,
      "सभासद क्र.": r.memberCode,
      "CIF क्रमांक": r.cifNo,
      "सभासदाचे पूर्ण नाव": r.fullName,
      "Full Name (Eng)": r.fullNameEng,
      "पत्ता": r.address,
      "व्यवसाय": r.occupation,
      "प्रवेश दिनांक": formatDisplayDate(r.joiningDate),
      "वय": r.ageAtJoining || "-",
      "शेअर्स संख्या": r.totalShareCount,
      "एकूण भागभांडवल (₹)": r.totalShareAmount,
      "प्रमाणपत्र क्र.": r.certificateNos,
      "वारसदाराचे नाव": r.nomineeName,
      "वारसदाराचे नाते": r.nomineeRelation,
      "वारसदाराचा पत्ता": r.nomineeAddress,
      "अज्ञान वारसदार?": r.nomineeIsMinor ? "होय (Minor)" : "नाही",
      "पालकाचे नाव": r.nomineeGuardianName || "-",
      "स्थिती": r.status,
      "समाप्ती दिनांक": formatDisplayDate(r.cessationDate),
      "समाप्ती कारण": r.cessationReason || "-",
      "शेरा": r.remarks || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "I-Namuna-Register");
    XLSX.writeFile(wb, `I_Namuna_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportSingleExcel = () => {
    if (!reportData) return;
    const info = reportData.memberInfo;
    const txns = reportData.transactions;

    const dataArr: any[] = [
      ["नमूना 'आय' (नियम ३२ पहा) - सभासदांचे रजिस्टर"],
      [sansthaDetail?.sansthaName || ""],
      [""],
      ["सभासद क्र.:", info.memberCode, "खाते क्र.:", info.accountNo],
      ["पूर्ण नाव:", info.fullName, "प्रवेश दिनांक:", formatDisplayDate(info.joiningDate)],
      ["पत्ता:", info.address, "वारसदाराचे नाव:", info.nomineeName],
      ["व्यवसाय:", info.occupation, "वारसदाराचा पत्ता:", info.nomineeAddress],
      ["स्थिती:", info.remarks, "समाप्ती दिनांक:", formatDisplayDate(info.cessationDate)],
      [""],
      ["दिनांक", "व्हाउचर/पावती क्र.", "प्राप्त रक्कम", "शेअर्स संख्या", "प्रमाणपत्र क्र.", "परत/हस्तांतरण शेअर्स", "शिल्लक रक्कम", "शेरा"]
    ];

    txns.forEach((t) => {
      dataArr.push([
        formatDisplayDate(t.allotmentDate || t.transferDate),
        t.allotmentCashbookNo || t.transferCashbookNo || "-",
        t.totalAmountReceived || 0,
        t.numberOfSharesHeld || 0,
        t.allotmentCertificateNo || "-",
        (t.numberOfSharesTransferred || 0) + (t.numberOfSharesReturned || 0),
        t.balanceAmount || 0,
        t.remarks || "-"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataArr);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "I-Namuna-Member");
    XLSX.writeFile(wb, `I_Namuna_${info.memberCode || info.memberID}.xlsx`);
  };

  const getBranchName = () => {
    if (selectedBranchId === 'all') return 'सर्व शाखा';
    const b = branches.find((item: any) => item.branchID?.toString() === selectedBranchId);
    return b ? b.branchName : 'मुख्य शाखा';
  };

  // Summary Banner Node for Single Mode
  const singleSummaryBanner = (viewMode === 'single' && reportData) ? (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सभासदाचे पूर्ण नाव:</span>
        <strong className="text-slate-900 text-[11px]">{reportData.memberInfo.fullName}</strong>
        <span className="text-slate-600 block text-[9.5px]">({reportData.memberInfo.address})</span>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">वारसदाराचे नाव व नाते:</span>
        <strong className="text-slate-900 text-[11px]">{reportData.memberInfo.nomineeName}</strong>
        <span className="text-slate-600 block text-[9.5px]">{reportData.memberInfo.nomineeAddress}</span>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सभासद क्र. / प्रवेश दिनांक:</span>
        <strong className="text-primary font-mono text-[11px]">{reportData.memberInfo.memberCode}</strong>
        <span className="text-slate-700 font-mono block text-[10px]">दाखल: {formatDisplayDate(reportData.memberInfo.joiningDate)}</span>
      </div>
    </div>
  ) : null;

  // Filter Toolbar Controls
  const filterControls = (
    <>
      {/* View Mode Toggle */}
      <div className="inline-flex rounded-xs border border-slate-300 p-0.5 bg-slate-100 h-6 items-center">
        <button
          type="button"
          onClick={() => setViewMode('register')}
          className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs cursor-pointer ${
            viewMode === 'register' ? 'bg-primary text-white' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          १. एकत्रित आय नमुना (Register)
        </button>
        <button
          type="button"
          onClick={() => setViewMode('single')}
          className={`px-1.5 py-0.5 text-[10px] font-bold rounded-xs cursor-pointer ${
            viewMode === 'single' ? 'bg-primary text-white' : 'text-slate-700 hover:text-slate-900'
          }`}
        >
          २. वैयक्तिक भाग खाते (Individual)
        </button>
      </div>

      {viewMode === 'register' ? (
        <>
          {/* Branch */}
          <div className="flex items-center gap-1">
            <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
            <select
              value={selectedBranchId}
              disabled={hasGlobalBranch}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28"
            >
              <option value="all">सर्व शाखा</option>
              {branches.map((b: any) => (
                <option key={b.branchID} value={b.branchID.toString()}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1">
            <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">स्थिती:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-bold bg-white focus:outline-none focus:border-primary w-24 text-primary"
            >
              <option value="सर्व">सर्व (All)</option>
              <option value="Active">सक्रिय</option>
              <option value="Mayat">मयत</option>
              <option value="Closed">बंद</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative w-36 sm:w-44">
            <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="नाव / CIF / वारसदार..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-5 pr-1 py-0.5 h-6 border border-gray-300 rounded-xs text-[10.5px] focus:outline-none focus:border-primary bg-white"
            />
          </div>

          {/* View Button */}
          <button
            onClick={fetchRegisterData}
            disabled={loading}
            className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-xs text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
            <span>पहा</span>
          </button>
        </>
      ) : (
        <>
          {/* Member Search Select */}
          <div className="w-56 sm:w-72">
            <MemberSearchSelect
              value={selectedMemberId}
              onChange={(mId) => setSelectedMemberId(mId)}
              members={members}
              placeholder="सभासद निवडा / नाव किंवा कोड शोधा..."
              className="text-[11px]"
            />
          </div>

          {/* View Button */}
          <button
            onClick={handleViewSingle}
            disabled={loading || !selectedMemberId}
            className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-xs text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
            <span>लेजर पहा</span>
          </button>
        </>
      )}
    </>
  );

  return (
    <CbsReportLayout
      defaultPaperSize="legal-landscape"
      allowPaperSizeToggle={true}
      reportTitle={
        viewMode === 'register' 
          ? "नमुना 'आय' - सभासदांचे रजिस्टर (महाराष्ट्र सहकारी संस्था अधिनियम १९६० नियम ३२)" 
          : "नमुना 'आय' - सभासद भाग भांडवल खाते (Member Share Ledger)"
      }
      reportSubtitle={viewMode === 'register' ? "Form 'I' Consolidated Register of Members" : "Form 'I' Member Share Ledger"}
      periodText={`दिनांक: ${new Date().toLocaleDateString('en-GB')}`}
      branchName={getBranchName()}
      sansthaInfo={sansthaDetail}
      summaryBanner={singleSummaryBanner}
      signatureTier="3-tier"
      signatureTitles={[
        { title: 'लिपिक / नोंदणी सहाय्यक', subtitle: '(Clerk / Assistant)' },
        { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
        { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' }
      ]}
      onExportExcel={viewMode === 'register' ? exportRegisterExcel : exportSingleExcel}
      extraToolbarControls={filterControls}
      isLoading={loading}
      hasData={viewMode === 'register' ? (registerData?.rows && registerData.rows.length > 0) : Boolean(reportData)}
      emptyState={
        <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
          <BookOpen size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">कृपया फिल्टर निवडून "पहा" बटणावर क्लिक करा.</p>
        </div>
      }
    >
      {viewMode === 'register' ? (
        <table className="cbs-table w-full border-collapse border border-slate-900 text-[10px]">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
              <th className="border border-slate-900 py-1 px-1 w-[3%]">अ.क्र.</th>
              <th className="border border-slate-900 py-1 px-1 w-[7%]">सभासद क्र./CIF</th>
              <th className="border border-slate-900 py-1 px-2 w-[18%] text-left">सभासदाचे पूर्ण नाव व पत्ता</th>
              <th className="border border-slate-900 py-1 px-1 w-[8%] text-left">व्यवसाय</th>
              <th className="border border-slate-900 py-1 px-1 w-[7%]">दाखल दिनांक</th>
              <th className="border border-slate-900 py-1 px-1 w-[4%]">वय</th>
              <th className="border border-slate-900 py-1 px-1 w-[6%]">शेअर्स संख्या</th>
              <th className="border border-slate-900 py-1 px-1 w-[8%] text-right">रक्कम (₹)</th>
              <th className="border border-slate-900 py-1 px-1 w-[8%]">प्रमाणपत्र क्र.</th>
              <th className="border border-slate-900 py-1 px-2 w-[18%] text-left">वारसदाराचे नाव, नाते व पत्ता</th>
              <th className="border border-slate-900 py-1 px-1 w-[6%]">स्थिती</th>
              <th className="border border-slate-900 py-1 px-1 w-[7%]">समाप्ती दिनांक</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                  माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                </td>
              </tr>
            ) : filteredRegisterRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                  कोणतीही सभासद नोंद आढळली नाही.
                </td>
              </tr>
            ) : (
              filteredRegisterRows.map((r, idx) => (
                <tr key={r.memberID || idx} className="hover:bg-slate-50 text-slate-900 text-[10px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold">
                    {r.memberCode || r.cifNo}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-left">
                    <div className="font-bold text-slate-950">{r.fullName}</div>
                    <div className="text-[9px] text-slate-600">{r.address}</div>
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-left">
                    {r.occupation || "-"}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                    {formatDisplayDate(r.joiningDate)}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                    {r.ageAtJoining || "-"}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold text-primary">
                    {r.totalShareCount}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 cbs-num-cell cbs-amt-bal font-bold">
                    {fmtCurrency(r.totalShareAmount)}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[9px]">
                    {r.certificateNos || "-"}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-left text-[9.5px]">
                    <div className="font-semibold text-slate-900">{r.nomineeName} ({r.nomineeRelation})</div>
                    <div className="text-[8.5px] text-slate-600 truncate max-w-[150px]">{r.nomineeAddress}</div>
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center text-[9px] font-bold">
                    {r.status}
                  </td>
                  <td className="border border-slate-900 py-1 px-1 text-center text-[8.5px]">
                    {r.cessationDate ? formatDisplayDate(r.cessationDate) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filteredRegisterRows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
                <td colSpan={6} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                  एकूण बेरीज ({filteredRegisterRows.length} सभासद):
                </td>
                <td className="border border-slate-900 py-1.5 px-1 text-center font-mono font-bold text-primary">
                  {filteredRegisterRows.reduce((sum, r) => sum + r.totalShareCount, 0)}
                </td>
                <td className="border border-slate-900 py-1.5 px-1 cbs-num-cell cbs-amt-bal font-black bg-primary/10">
                  ₹ {fmtCurrency(filteredRegisterRows.reduce((sum, r) => sum + r.totalShareAmount, 0))}
                </td>
                <td colSpan={4} className="border border-slate-900"></td>
              </tr>
            </tfoot>
          )}
        </table>
      ) : reportData ? (
        <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
              <th className="border border-slate-900 py-1.5 px-2">दिनांक</th>
              <th className="border border-slate-900 py-1.5 px-2">व्हाउचर / पावती क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2 text-right">प्राप्त रक्कम (₹)</th>
              <th className="border border-slate-900 py-1.5 px-2">शेअर्स संख्या</th>
              <th className="border border-slate-900 py-1.5 px-2">प्रमाणपत्र क्र.</th>
              <th className="border border-slate-900 py-1.5 px-2">हस्तांतरण / परत शेअर्स</th>
              <th className="border border-slate-900 py-1.5 px-2 text-right">शिल्लक भागभांडवल (₹)</th>
              <th className="border border-slate-900 py-1.5 px-2 text-left">शेरा / तपशील</th>
            </tr>
          </thead>
          <tbody>
            {reportData.transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-6 text-slate-500 border border-slate-900">
                  कोणतेही भाग व्यवहार उपलब्ध नाहीत.
                </td>
              </tr>
            ) : (
              reportData.transactions.map((t, idx) => (
                <tr key={idx} className="hover:bg-slate-50 text-[11px]">
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                    {formatDisplayDate(t.allotmentDate || t.transferDate)}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                    {t.allotmentCashbookNo || t.transferCashbookNo || "-"}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-cr">
                    {t.totalAmountReceived > 0 ? fmtCurrency(t.totalAmountReceived) : "-"}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-primary">
                    {t.numberOfSharesHeld > 0 ? t.numberOfSharesHeld : "-"}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono">
                    {t.allotmentCertificateNo || "-"}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-center font-mono text-rose-700">
                    {(t.numberOfSharesTransferred > 0 ? t.numberOfSharesTransferred : 0) + (t.numberOfSharesReturned > 0 ? t.numberOfSharesReturned : 0) || "-"}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-bold">
                    ₹ {fmtCurrency(t.balanceAmount)}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 text-left text-[10px]">
                    {t.remarks || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : null}
    </CbsReportLayout>
  );
}

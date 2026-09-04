import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import CbsReportLayout, { formatDisplayDate } from "./common/CbsReportLayout";
import { 
  Search, 
  RefreshCw, 
  Vote
} from "lucide-react";

interface SansthaDetail {
  sansthaName: string;
  address: string;
  city?: string;
  registrationNo: string;
  registrationDate?: string;
}

interface VoterListRow {
  srNo: number;
  memberID: number;
  memberCode: string;
  cifNo: string;
  fullName: string;
  fullNameEng: string;
  address: string;
  mobileNo: string;
  membershipType: string;
  totalShareCount: number;
  totalShareAmount: number;
  jointMemberNames: string;
  status: string;
  isVotingEligible: boolean;
  votingEligibilityText: string;
  ineligibilityReason?: string | null;
}

interface VoterListResponse {
  sansthaInfo?: SansthaDetail;
  rows: VoterListRow[];
  totalMembers: number;
  totalEligibleVoters: number;
  totalIneligibleVoters: number;
  totalShares: number;
  totalShareCapital: number;
}

const fmtCurrency = (n: number | null | undefined) => {
  return (n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function VoterListReport() {
  const [sanstha, setSanstha] = useState<SansthaDetail | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const [membershipTypeFilter, setMembershipTypeFilter] = useState<string>('सर्व');
  const [eligibilityFilter, setEligibilityFilter] = useState<string>('सर्व');
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [reportData, setReportData] = useState<VoterListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchSansthaDetails();
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchVoterList();
  }, [selectedBranchId, membershipTypeFilter, eligibilityFilter, statusFilter]);

  const fetchSansthaDetails = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (res.data) {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSanstha(res.data[0]);
        } else if (!Array.isArray(res.data)) {
          setSanstha(res.data);
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

  const fetchVoterList = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranchId !== 'all') params.append('branchId', selectedBranchId);
      if (membershipTypeFilter !== 'सर्व') params.append('membershipType', membershipTypeFilter);
      if (statusFilter !== 'सर्व') params.append('status', statusFilter);
      if (eligibilityFilter !== 'सर्व') params.append('eligibility', eligibilityFilter);

      const res = await axios.get(`/api/Reports/voter-list?${params.toString()}`);
      setReportData(res.data);
    } catch (err) {
      console.error(err);
      alert("मतदार यादी लोड करताना त्रुटी आली.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = (reportData?.rows || []).filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const name = (r.fullName || '').toLowerCase();
    const code = (r.memberCode || '').toLowerCase();
    const cif = (r.cifNo || '').toLowerCase();
    const joint = (r.jointMemberNames || '').toLowerCase();
    return name.includes(term) || code.includes(term) || cif.includes(term) || joint.includes(term);
  });

  const exportExcel = () => {
    if (filteredRows.length === 0) {
      alert("एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.");
      return;
    }

    const excelRows = filteredRows.map(r => ({
      "अ.क्र.": r.srNo,
      "सभासद क्र.": r.memberCode,
      "CIF क्रमांक": r.cifNo,
      "सभासदाचे पूर्ण नाव": r.fullName,
      "Full Name (Eng)": r.fullNameEng,
      "पत्ता": r.address,
      "संयुक्त धारक": r.jointMemberNames !== '-' ? r.jointMemberNames : '',
      "मोबाईल नं.": r.mobileNo,
      "सभासद प्रकार": r.membershipType,
      "शेअर्स संख्या": r.totalShareCount,
      "भागभांडवल रक्कम (₹)": r.totalShareAmount,
      "पात्रता स्थिती": r.votingEligibilityText,
      "अपात्रता कारण": r.ineligibilityReason || "-"
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Voter-List");
    XLSX.writeFile(wb, `Voter_List_${new Date().toISOString().split('T')[0]}.xlsx`);
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

      {/* Member Type */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">वर्ग:</label>
        <select
          value={membershipTypeFilter}
          onChange={(e) => setMembershipTypeFilter(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-24"
        >
          <option value="सर्व">सर्व वर्ग</option>
          <option value="Regular">नियमित</option>
          <option value="Associate">सह-सभासद</option>
          <option value="Nominal">नाममात्र</option>
        </select>
      </div>

      {/* Eligibility */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">पात्रता:</label>
        <select
          value={eligibilityFilter}
          onChange={(e) => setEligibilityFilter(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-bold bg-white focus:outline-none focus:border-primary w-28 text-primary"
        >
          <option value="सर्व">सर्व (All)</option>
          <option value="eligible">केवळ पात्र</option>
          <option value="ineligible">केवळ अपात्र</option>
        </select>
      </div>

      {/* Search */}
      <div className="relative w-36 sm:w-44">
        <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="नाव / CIF / कोड शोधा..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-5 pr-1 py-0.5 h-6 border border-gray-300 rounded-xs text-[10.5px] focus:outline-none focus:border-primary bg-white"
        />
      </div>

      {/* View Button */}
      <button
        onClick={fetchVoterList}
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
      defaultPaperSize="legal-landscape"
      allowPaperSizeToggle={true}
      reportTitle="प्रारूप मतदार यादी (महाराष्ट्र सहकारी संस्था अधिनियम १९६० कलम २७)"
      reportSubtitle="Provisional Voter List (Election Rules Form E-1)"
      periodText={`दिनांक: ${new Date().toLocaleDateString('en-GB')}`}
      branchName={getBranchName()}
      sansthaInfo={sanstha}
      signatureTier="3-tier"
      signatureTitles={[
        { title: 'लिपिक / नोंदणी सहाय्यक', subtitle: '(Clerk / Assistant)' },
        { title: 'लेखापाल / निवडणूक अधिकारी', subtitle: '(Election Officer)' },
        { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' }
      ]}
      onExportExcel={exportExcel}
      extraToolbarControls={filterControls}
      isLoading={loading}
      hasData={Boolean(reportData?.rows && reportData.rows.length > 0)}
      emptyState={
        <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
          <Vote size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">कोणतीही मतदार नोंद आढळली नाही.</p>
        </div>
      }
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-[10px]">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-1 w-[4%]">अ.क्र.</th>
            <th className="border border-slate-900 py-1.5 px-1 w-[9%]">सभासद क्र./CIF</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[22%] text-left">सभासदाचे पूर्ण नाव व पत्ता</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[18%] text-left">सह-सभासद / संयुक्त धारक (Joint)</th>
            <th className="border border-slate-900 py-1.5 px-1 w-[10%]">मोबाईल नं.</th>
            <th className="border border-slate-900 py-1.5 px-1 w-[9%]">सभासद वर्ग (Sec 24)</th>
            <th className="border border-slate-900 py-1.5 px-1 w-[8%] text-center">शेअर्स संख्या</th>
            <th className="border border-slate-900 py-1.5 px-1 w-[9%] text-right">भागभांडवल (₹)</th>
            <th className="border border-slate-900 py-1.5 px-1 w-[11%]">मतदान हक्क पात्रता</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={9} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                मतदार यादी माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
              </td>
            </tr>
          ) : filteredRows.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                कोणतीही नोंद आढळली नाही.
              </td>
            </tr>
          ) : (
            filteredRows.map((r, idx) => (
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
                <td className="border border-slate-900 py-1 px-2 text-left text-[9.5px]">
                  {r.jointMemberNames !== '-' ? (
                    <div className="font-semibold text-indigo-900">{r.jointMemberNames}</div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="border border-slate-900 py-1 px-1 text-center font-mono">
                  {r.mobileNo}
                </td>
                <td className="border border-slate-900 py-1 px-1 text-center font-semibold">
                  {r.membershipType === 'Regular' ? 'नियमित' : r.membershipType === 'Associate' ? 'सह-सभासद' : 'नाममात्र'}
                </td>
                <td className="border border-slate-900 py-1 px-1 text-center font-mono font-bold text-primary">
                  {r.totalShareCount}
                </td>
                <td className="border border-slate-900 py-1 px-1 cbs-num-cell cbs-amt-bal font-bold">
                  {fmtCurrency(r.totalShareAmount)}
                </td>
                <td className="border border-slate-900 py-1 px-1 text-center text-[9px]">
                  {r.isVotingEligible ? (
                    <span className="text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                      ✓ पात्र (Eligible)
                    </span>
                  ) : (
                    <div>
                      <span className="text-rose-800 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-300 block">
                        ✕ अपात्र
                      </span>
                      {r.ineligibilityReason && (
                        <span className="text-[8px] text-slate-500 block mt-0.5">{r.ineligibilityReason}</span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {filteredRows.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
              <td colSpan={6} className="border border-slate-900 py-1 px-3 text-right uppercase">
                एकूण ({filteredRows.length} सभासद):
              </td>
              <td className="border border-slate-900 py-1 px-1 text-center font-mono text-primary font-bold">
                {filteredRows.reduce((sum, r) => sum + r.totalShareCount, 0)}
              </td>
              <td className="border border-slate-900 py-1 px-1 cbs-num-cell cbs-amt-bal font-black bg-primary/10">
                ₹ {fmtCurrency(filteredRows.reduce((sum, r) => sum + r.totalShareAmount, 0))}
              </td>
              <td className="border border-slate-900 py-1 px-1 text-center text-[9.5px] text-emerald-900 font-bold">
                पात्र मतदार: {filteredRows.filter(r => r.isVotingEligible).length}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </CbsReportLayout>
  );
}

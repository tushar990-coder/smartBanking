import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { 
  Search, 
  RefreshCw, 
  Users
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MemberDto {
  memberID: number;
  cifNo: string | null;
  memberCode?: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  mobileNo?: string | null;
  aadhaarNo?: string | null;
  panNo?: string | null;
  status?: string | null;
  joiningDate?: string | null;
}

export default function MemberListReport() {
  const [data, setData] = useState<MemberDto[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('सर्व');
  const [branches, setBranches] = useState<any[]>([]);
  
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchSanstha();
    fetchBranches();
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedBranchId, statusFilter]);

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
      const params = new URLSearchParams();
      if (selectedBranchId !== 'all') {
        params.append('branchId', selectedBranchId);
      }
      if (statusFilter !== 'सर्व') {
        params.append('status', statusFilter);
      }
      const res = await axios.get(`/api/Members?${params.toString()}`);
      setData(res.data || []);
    } catch (err: any) {
      console.error(err);
      alert('सभासद माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const fullName = `${item.firstName || ''} ${item.middleName || ''} ${item.lastName || ''}`.toLowerCase();
    const cif = (item.cifNo || '').toLowerCase();
    const code = (item.memberCode || '').toLowerCase();
    const mob = (item.mobileNo || '');
    return fullName.includes(term) || cif.includes(term) || code.includes(term) || mob.includes(term);
  });

  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      alert('एक्सेलमध्ये एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
      return;
    }

    const excelRows: any[] = [];
    let sr = 1;

    filteredData.forEach((m) => {
      excelRows.push({
        'अ.क्र.': sr++,
        'CIF क्रमांक': m.cifNo || '-',
        'सभासद क्र.': m.memberCode || '-',
        'सभासदाचे नाव': `${m.firstName || ''} ${m.middleName || ''} ${m.lastName || ''}`.trim(),
        'मोबाईल नं.': m.mobileNo || '-',
        'स्थिती': m.status || 'Active',
        'दाखल दिनांक': formatDisplayDate(m.joiningDate)
      });
    });

    excelRows.push({
      'अ.क्र.': '',
      'CIF क्रमांक': '',
      'सभासद क्र.': '',
      'सभासदाचे नाव': `एकूण नोंदणीकृत सभासद: ${filteredData.length}`,
      'मोबाईल नं.': '',
      'स्थिती': '',
      'दाखल दिनांक': ''
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'सभासद यादी');
    XLSX.writeFile(workbook, `MemberList_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getBranchName = () => {
    if (selectedBranchId === 'all') return 'सर्व शाखा';
    const b = branches.find((item: any) => item.branchID?.toString() === selectedBranchId);
    return b ? b.branchName : 'मुख्य शाखा';
  };

  const getStatusBadge = (status?: string | null) => {
    const s = (status || 'Active').toLowerCase();
    if (s.includes('active') || s.includes('सक्रिय') || s.includes('चालू')) {
      return <span className="text-emerald-800 font-bold">सक्रिय (Active)</span>;
    }
    if (s.includes('inactive') || s.includes('बंद') || s.includes('रद्द')) {
      return <span className="text-rose-800 font-bold">बंद (Closed)</span>;
    }
    return <span className="text-slate-800 font-semibold">{status || 'Active'}</span>;
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

      {/* Status Filter */}
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">स्थिती:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-bold bg-white focus:outline-none focus:border-primary w-24 text-primary"
        >
          <option value="सर्व">सर्व (All)</option>
          <option value="Active">सक्रिय (Active)</option>
          <option value="Inactive">बंद (Inactive)</option>
        </select>
      </div>

      {/* In-table Search */}
      <div className="relative w-36 sm:w-48">
        <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="नाव / CIF / मोबाईल शोधा..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-5 pr-1 py-0.5 h-6 border border-gray-300 rounded-xs text-[10.5px] focus:outline-none focus:border-primary bg-white"
        />
      </div>

      {/* View Button */}
      <button
        onClick={fetchData}
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
      reportTitle="नोंदणीकृत सभासद यादी"
      reportSubtitle="Registered Members Master List"
      periodText={`दिनांक: ${new Date().toLocaleDateString('en-GB')}`}
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
      hasData={data.length > 0}
      emptyState={
        <div className="bg-white p-12 text-center text-gray-500 rounded-xs border border-gray-200 shadow-xs max-w-4xl mx-auto">
          <Users size={32} className="mx-auto mb-2 text-primary/40" />
          <p className="font-semibold text-xs">कोणतीही सभासद माहिती उपलब्ध नाही.</p>
        </div>
      }
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-1 w-[5%] text-center">अ.क्र.</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center">CIF क्रमांक</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">सभासद क्र.</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[35%] text-left">सभासदाचे नाव</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[14%] text-center">मोबाईल नं.</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">स्थिती</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">दाखल दिनांक</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
              </td>
            </tr>
          ) : filteredData.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-8 text-slate-500 font-semibold border border-slate-900">
                कोणतीही सभासद नोंद आढळली नाही.
              </td>
            </tr>
          ) : (
            filteredData.map((m, idx) => (
              <tr key={m.memberID || idx} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                  {idx + 1}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">
                  {m.cifNo || '-'}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono font-semibold text-primary">
                  {m.memberCode || '-'}
                </td>
                <td className="border border-slate-900 py-1 px-3 font-medium">
                  {`${m.firstName || ''} ${m.middleName || ''} ${m.lastName || ''}`.trim()}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono text-slate-700">
                  {m.mobileNo || '-'}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center text-[10.5px]">
                  {getStatusBadge(m.status)}
                </td>
                <td className="border border-slate-900 py-1 px-2 text-center font-mono text-slate-700">
                  {formatDisplayDate(m.joiningDate)}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {filteredData.length > 0 && (
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
              <td colSpan={3} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
                एकूण नोंदणीकृत सभासद:
              </td>
              <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-left font-bold text-primary">
                {filteredData.length} सभासद
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </CbsReportLayout>
  );
}

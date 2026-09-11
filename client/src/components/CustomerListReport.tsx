import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CbsReportLayout, { formatDisplayDate } from './common/CbsReportLayout';
import { 
  Users, 
  Search, 
  RefreshCw, 
  Filter, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Building2, 
  Calendar,
  UserCheck,
  UserX,
  FileSpreadsheet,
  Printer
} from 'lucide-react';

interface CustomerReportRowDto {
  srNo: number;
  customerID: number;
  cifNo: string;
  legacyCustomerNo?: string | null;
  fullName: string;
  fullNameEng?: string | null;
  mobileNo?: string | null;
  email?: string | null;
  address?: string | null;
  village?: string | null;
  taluka?: string | null;
  district?: string | null;
  customerType: string;
  kycStatus: string;
  aadhaarNoMasked?: string | null;
  panNo?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  registrationDate: string;
  branchID: number;
  branchName: string;
  status: string;
  riskCategory?: string | null;
}

interface CustomerReportResponseDto {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  kycVerifiedCount: number;
  kycPendingCount: number;
  individualCount: number;
  commercialCount: number;
  rows: CustomerReportRowDto[];
}

export default function CustomerListReport() {
  const [reportData, setReportData] = useState<CustomerReportResponseDto | null>(null);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Branch Selection
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  // Filter States
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('सर्व');
  const [kycStatusFilter, setKycStatusFilter] = useState<string>('सर्व');
  const [statusFilter, setStatusFilter] = useState<string>('सर्व');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchSanstha();
    fetchBranches();
    fetchData();
  }, []);

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
      console.error('Failed to load sanstha details', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error('Failed to load branches', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedBranchId !== 'all') {
        params.append('branchId', selectedBranchId);
      }
      if (customerTypeFilter !== 'सर्व') {
        params.append('customerType', customerTypeFilter);
      }
      if (kycStatusFilter !== 'सर्व') {
        params.append('kycStatus', kycStatusFilter);
      }
      if (statusFilter !== 'सर्व') {
        params.append('status', statusFilter);
      }
      if (fromDate) {
        params.append('fromDate', fromDate);
      }
      if (toDate) {
        params.append('toDate', toDate);
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const res = await axios.get(`/api/Reports/CustomerListReport?${params.toString()}`);
      setReportData(res.data);
    } catch (err: any) {
      console.error(err);
      setError('खातेदार यादी माहिती लोड करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedBranchId(initialBranchId);
    setCustomerTypeFilter('सर्व');
    setKycStatusFilter('सर्व');
    setStatusFilter('सर्व');
    setFromDate('');
    setToDate('');
    setSearchTerm('');
  };

  // Client-side quick search filtering on currently loaded rows
  const displayedRows = (reportData?.rows || []).filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    const fullName = (r.fullName || '').toLowerCase();
    const fullNameEng = (r.fullNameEng || '').toLowerCase();
    const cif = (r.cifNo || '').toLowerCase();
    const leg = (r.legacyCustomerNo || '').toLowerCase();
    const mob = (r.mobileNo || '');
    const aadh = (r.aadhaarNoMasked || '');
    const vill = (r.village || '').toLowerCase();

    return fullName.includes(term) ||
           fullNameEng.includes(term) ||
           cif.includes(term) ||
           leg.includes(term) ||
           mob.includes(term) ||
           aadh.includes(term) ||
           vill.includes(term);
  });

  const selectedBranchName = selectedBranchId === 'all' 
    ? 'सर्व शाखा (All Branches)' 
    : branches.find(b => String(b.branchID) === String(selectedBranchId))?.branchName || `शाखा #${selectedBranchId}`;

  const periodText = fromDate && toDate
    ? `कालावधी: ${formatDisplayDate(fromDate)} ते ${formatDisplayDate(toDate)}`
    : fromDate
    ? `दिनांक ${formatDisplayDate(fromDate)} पासून`
    : toDate
    ? `दिनांक ${formatDisplayDate(toDate)} पर्यंत`
    : 'दिनांक: आजअखेर (As-on-date)';

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!displayedRows || displayedRows.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी कोणताही डेटा उपलब्ध नाही.');
      return;
    }

    const excelData = displayedRows.map((r, index) => ({
      'अ.क्र.': index + 1,
      'सीआयएफ क्र. (CIF)': r.cifNo || '',
      'जुना खातेदार क्र.': r.legacyCustomerNo || '',
      'खातेदाराचे नाव (मराठी)': r.fullName,
      'नाव (इंग्रजी)': r.fullNameEng || '',
      'मोबाईल क्र.': r.mobileNo || '',
      'ईमेल': r.email || '',
      'पत्ता': r.address || '',
      'गाव / शहर': r.village || '',
      'तालुका': r.taluka || '',
      'जिल्हा': r.district || '',
      'खातेदार प्रकार': r.customerType || 'Individual',
      'केवायसी स्थिती': r.kycStatus || 'Verified',
      'आधार क्र. (Masked)': r.aadhaarNoMasked || '',
      'पॅन क्र.': r.panNo || '',
      'लिंग': r.gender || '',
      'जन्मदिनांक': r.birthDate ? formatDisplayDate(r.birthDate) : '',
      'नोंदणी दिनांक': formatDisplayDate(r.registrationDate),
      'शाखा': r.branchName || '',
      'सद्यस्थिती': r.status || 'Active'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'खातेदार यादी');

    const fileName = `Customer_List_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-3">
      {/* 1. TOP ERP CONTROL PANEL (Non-Printable) */}
      <div className="bg-white p-3 rounded-sm border border-gray-200 shadow-2xs space-y-3 no-print">
        {/* Title & Action Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                खातेदार यादी अहवाल (Customer / CIF Master List)
                <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                  कोर बँकिंग सीबीएस
                </span>
              </h1>
              <p className="text-[11px] text-gray-500">
                शाखावार, केवायसी व वर्गवारीनुसार अधिकृत खातेदार नोंदवही व अहवाल
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded hover:bg-primary/90 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              अहवाल लोड करा (Refresh)
            </button>
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded hover:bg-emerald-800 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              एक्सेल (.xlsx)
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded hover:bg-slate-900 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              प्रिंट करा (A4 Landscape)
            </button>
          </div>
        </div>

        {/* Multi-Criteria Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Branch Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              शाखा (Branch)
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="all">सर्व शाखा (All Branches)</option>
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Type */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              खातेदार प्रकार (Type)
            </label>
            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="सर्व">सर्व (All Types)</option>
              <option value="Individual">वैयक्तिक (Individual)</option>
              <option value="Joint">संयुक्त (Joint)</option>
              <option value="Proprietorship">प्रोप्रायटरशिप (Proprietorship)</option>
              <option value="SHG">बचत गट (SHG)</option>
              <option value="Trust">ट्रस्ट / संस्था (Trust/Org)</option>
            </select>
          </div>

          {/* KYC Status */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              केवायसी स्थिती (KYC)
            </label>
            <select
              value={kycStatusFilter}
              onChange={(e) => setKycStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="सर्व">सर्व (All KYC)</option>
              <option value="Verified">केवायसी पूर्ण (Verified)</option>
              <option value="Pending">केवायसी अपूर्ण (Pending)</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              सद्यस्थिती (Status)
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="सर्व">सर्व स्थिती (All)</option>
              <option value="Active">सक्रिय (Active)</option>
              <option value="Inactive">निष्क्रिय (Inactive)</option>
              <option value="Suspended">स्थगित (Suspended)</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              दिनांक पासून (From)
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">
              दिनांक पर्यंत (To)
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Search Bar & Reset */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-gray-100">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="सीआयएफ (CIF), जुना क्र., खातेदाराचे नाव (मराठी/इंग्रजी), मोबाईल, आधार किंवा गावाने शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 bg-gray-800 hover:bg-black text-white text-xs font-semibold rounded transition cursor-pointer"
          >
            फिल्टर लागू करा
          </button>
          <button
            onClick={handleResetFilters}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded transition border border-gray-300 cursor-pointer"
          >
            रीसेट
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE KPI CARDS (Summary Strip) */}
      {reportData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 no-print">
          <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">एकूण खातेदार</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-lg font-black text-gray-900 mt-1">
              {reportData.totalCustomers.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-gray-500">निवडलेल्या निकषानुसार</span>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">सक्रिय (Active)</span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-black text-emerald-700 mt-1">
              {reportData.activeCustomers.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold">
              {reportData.totalCustomers > 0 
                ? `${Math.round((reportData.activeCustomers / reportData.totalCustomers) * 100)}% सक्रिय` 
                : '०%'}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">निष्क्रिय (Inactive)</span>
              <UserX className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-lg font-black text-red-600 mt-1">
              {reportData.inactiveCustomers.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-gray-500">बंद किंवा डॉरमंट</span>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">केवायसी पूर्ण</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-lg font-black text-emerald-700 mt-1">
              {reportData.kycVerifiedCount.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold">KYC Verified</span>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">केवायसी अपूर्ण</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-lg font-black text-amber-600 mt-1">
              {reportData.kycPendingCount.toLocaleString('en-IN')}
            </p>
            <span className="text-[10px] text-amber-600 font-semibold">Pending Docs</span>
          </div>

          <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-gray-600">वैयक्तिक / इतर</span>
              <Building2 className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-lg font-black text-indigo-700 mt-1">
              {reportData.individualCount} / {reportData.commercialCount}
            </p>
            <span className="text-[10px] text-gray-500">Indiv / Non-Indiv</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm">
          {error}
        </div>
      )}

      {/* 3. AUDIT-READY CBS REPORT LAYOUT & DATA TABLE */}
      <CbsReportLayout
        defaultPaperSize="a4-landscape"
        reportTitle="खातेदार यादी अहवाल (Customer / CIF Master Register)"
        reportSubtitle="कोर बँकिंग प्रणाली - शाखावार व केवायसी वर्गवारीनिहाय खातेदार नोंदवही"
        periodText={periodText}
        branchName={selectedBranchName}
        sansthaInfo={sansthaDetail}
        signatureTier="3-tier"
        onExportExcel={handleExportExcel}
        hasData={displayedRows.length > 0}
        isLoading={loading}
        emptyState={
          <div className="py-12 text-center text-gray-500 text-xs">
            <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            दिलेल्या निकषांनुसार कोणतेही खातेदार आढळले नाहीत.
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse border border-gray-400 font-sans">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-gray-400 font-bold text-center">
                <th className="p-1 border border-gray-400 w-8">अ.क्र.</th>
                <th className="p-1 border border-gray-400 w-16">सीआयएफ क्र. (CIF)</th>
                <th className="p-1 border border-gray-400 w-16">जुना क्र.</th>
                <th className="p-1 border border-gray-400 text-left">खातेदाराचे पूर्ण नाव (मराठी व इंग्रजीत)</th>
                <th className="p-1 border border-gray-400 w-24">मोबाईल क्र.</th>
                <th className="p-1 border border-gray-400 text-left">पत्ता व गाव / शहर</th>
                <th className="p-1 border border-gray-400 w-18">प्रकार</th>
                <th className="p-1 border border-gray-400 w-18">केवायसी स्थिती</th>
                <th className="p-1 border border-gray-400 w-24">आधार क्रमांक</th>
                <th className="p-1 border border-gray-400 w-16">पॅन क्र.</th>
                <th className="p-1 border border-gray-400 w-18">नोंदणी दिनांक</th>
                <th className="p-1 border border-gray-400 w-20">शाखा</th>
                <th className="p-1 border border-gray-400 w-14">स्थिती</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((r, idx) => (
                <tr 
                  key={r.customerID || idx} 
                  className={`border-b border-gray-300 hover:bg-blue-50/50 transition-colors ${
                    idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                  }`}
                >
                  <td className="p-1 border border-gray-300 text-center font-medium text-gray-600">
                    {idx + 1}
                  </td>
                  <td className="p-1 border border-gray-300 text-center font-bold font-mono text-primary">
                    {r.cifNo || '-'}
                  </td>
                  <td className="p-1 border border-gray-300 text-center font-mono text-gray-600">
                    {r.legacyCustomerNo || '-'}
                  </td>
                  <td className="p-1 border border-gray-300">
                    <div className="font-bold text-gray-900 leading-tight">
                      {r.fullName}
                    </div>
                    {r.fullNameEng && (
                      <div className="text-[9px] text-gray-500 font-normal leading-tight">
                        {r.fullNameEng}
                      </div>
                    )}
                  </td>
                  <td className="p-1 border border-gray-300 text-center font-mono">
                    {r.mobileNo || '-'}
                  </td>
                  <td className="p-1 border border-gray-300 leading-tight">
                    <span>{r.address || ''}</span>
                    {r.village && (
                      <span className="text-gray-600 font-medium">, {r.village}</span>
                    )}
                  </td>
                  <td className="p-1 border border-gray-300 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700">
                      {r.customerType || 'Individual'}
                    </span>
                  </td>
                  <td className="p-1 border border-gray-300 text-center">
                    {r.kycStatus === 'Verified' || r.kycStatus === 'पूर्ण' ? (
                      <span className="text-emerald-700 font-bold flex items-center justify-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        पूर्ण
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold flex items-center justify-center gap-0.5">
                        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                        अपूर्ण
                      </span>
                    )}
                  </td>
                  <td className="p-1 border border-gray-300 text-center font-mono text-gray-700">
                    {r.aadhaarNoMasked || '-'}
                  </td>
                  <td className="p-1 border border-gray-300 text-center font-mono font-medium">
                    {r.panNo || '-'}
                  </td>
                  <td className="p-1 border border-gray-300 text-center font-mono">
                    {formatDisplayDate(r.registrationDate)}
                  </td>
                  <td className="p-1 border border-gray-300 text-center truncate">
                    {r.branchName || '-'}
                  </td>
                  <td className="p-1 border border-gray-300 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        r.status === 'Active'
                          ? 'text-emerald-800 bg-emerald-100'
                          : 'text-red-800 bg-red-100'
                      }`}
                    >
                      {r.status === 'Active' ? 'सक्रिय' : r.status || 'निष्क्रिय'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold border-t-2 border-gray-500 text-[10px]">
                <td colSpan={3} className="p-1 text-center border border-gray-400">
                  एकूण नोंदवही नोंदी
                </td>
                <td colSpan={10} className="p-1 border border-gray-400">
                  एकूण खातेदार संख्या: <strong className="text-primary font-bold">{displayedRows.length}</strong> 
                  {' '}| सक्रिय: <strong className="text-emerald-700 font-bold">{displayedRows.filter(x => x.status === 'Active').length}</strong>
                  {' '}| केवायसी पूर्ण: <strong className="text-blue-700 font-bold">{displayedRows.filter(x => x.kycStatus === 'Verified' || x.kycStatus === 'पूर्ण').length}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CbsReportLayout>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Award,
  Search,
  Filter,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Users,
  Layers,
  Calendar,
  Building2,
  FileText,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import ShareCertificatePreview from './ShareCertificatePreview';

interface ShareCertificateDto {
  certificateId: number;
  certificateNo: string;
  issueDate: string;
  memberId: number;
  memberName: string;
  memberNameEng?: string;
  memberNo: string;
  accountNo: string;
  cifNo?: string;
  legacyMemberNo?: string;
  fromShareNo: number;
  toShareNo: number;
  numberOfShares: number;
  faceValue: number;
  totalAmount: number;
  status: string;
  printCount: number;
  memberAddress?: string;
  village?: string;
  mobileNo?: string;
  fatherHusbandName?: string;
  jointMemberNames?: string;
  membershipType?: string;
}

export default function ShareCertificateReport() {
  const [data, setData] = useState<ShareCertificateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Certificate Modal Preview State
  const [selectedCertificate, setSelectedCertificate] = useState<ShareCertificateDto | null>(null);

  // Members list for dropdown filter
  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    fetchSansthaDetails();
    fetchMembers();
    fetchCertificates();
  }, []);

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
      console.error('Failed to fetch sanstha details', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await axios.get('/api/Members');
      setMembers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch members', err);
    }
  };

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      if (selectedMemberId && selectedMemberId !== 'ALL') params.memberId = parseInt(selectedMemberId);
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await axios.get('/api/ShareCertificates', { params });
      setData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch share certificates', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [statusFilter, selectedMemberId, fromDate, toDate]);

  // Format currency
  const fmtCurrency = (val: number | null | undefined) => {
    return Math.round(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Format Date DD/MM/YYYY
  const formatDisplayDate = (dStr: string | null | undefined) => {
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

  // Filtered data by client-side search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const s = searchTerm.toLowerCase().trim();
    return data.filter((item) => {
      return (
        item.certificateNo?.toLowerCase().includes(s) ||
        item.memberNo?.toLowerCase().includes(s) ||
        item.memberName?.toLowerCase().includes(s) ||
        item.memberNameEng?.toLowerCase().includes(s) ||
        item.accountNo?.toLowerCase().includes(s) ||
        item.mobileNo?.includes(s) ||
        item.village?.toLowerCase().includes(s) ||
        item.fromShareNo?.toString().includes(s) ||
        item.toShareNo?.toString().includes(s)
      );
    });
  }, [data, searchTerm]);

  // Aggregate summary calculations
  const totalCertificates = filteredData.length;
  const totalShares = filteredData.reduce((acc, curr) => acc + (curr.numberOfShares || 0), 0);
  const totalAmount = filteredData.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const activeCertificates = filteredData.filter((c) => c.status === 'Issued' || c.status === 'Active').length;
  const cancelledCertificates = filteredData.filter((c) => c.status === 'Cancelled').length;

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredData.length === 0) {
      alert('डाउनलोड करण्यासाठी कोणतीही माहिती उपलब्ध नाही.');
      return;
    }

    const rows: any[] = [];

    // Header Metadata
    rows.push([sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित']);
    rows.push([`${sansthaDetail?.address || ''} ${sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}${sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}` : ''}`]);
    rows.push(['अधिकृत शेअर प्रमाणपत्र अहवाल (Official Share Certificate Register)']);
    rows.push([`दिनांक: ${new Date().toLocaleDateString('en-GB')} | एकूण प्रमाणपत्रे: ${totalCertificates} | एकूण शेअर्स: ${totalShares} | एकूण रक्कम: ₹ ${totalAmount.toLocaleString('en-IN')}`]);
    rows.push([]); // Empty row

    // Table Headers
    rows.push([
      'अ.क्र.',
      'प्रमाणपत्र क्र.',
      'जारी दिनांक',
      'सभासद कोड',
      'सभासदाचे पूर्ण नाव',
      'शेअर्स खाते क्र.',
      'शेअर्स संख्या',
      'हिस्सा क्र. पासून',
      'हिस्सा क्र. पर्यंत',
      'दर्शनी मूल्य (₹)',
      'एकूण रक्कम (₹)',
      'स्थिती',
      'प्रिंट संख्या',
      'मोबाईल क्र.',
      'पत्ता / गाव'
    ]);

    // Data rows
    filteredData.forEach((item, idx) => {
      rows.push([
        idx + 1,
        item.certificateNo,
        formatDisplayDate(item.issueDate),
        item.memberNo || '-',
        item.memberName,
        item.accountNo || '-',
        item.numberOfShares,
        item.fromShareNo,
        item.toShareNo,
        item.faceValue,
        item.totalAmount,
        item.status === 'Cancelled' ? 'रद्द (Cancelled)' : 'जारी (Issued)',
        item.printCount || 0,
        item.mobileNo || '-',
        item.village || item.memberAddress || '-'
      ]);
    });

    // Total Row
    rows.push([]);
    rows.push([
      'एकूण बेरीज',
      '',
      '',
      '',
      '',
      '',
      totalShares,
      '',
      '',
      '',
      totalAmount,
      '',
      '',
      '',
      ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Share_Certificates');
    XLSX.writeFile(wb, `Share_Certificate_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrintRegister = () => {
    window.print();
  };

  return (
    <div className="p-2 sm:p-4 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans text-xs pb-12">
      {/* Top Header Card */}
      <div className="bg-white border-b-2 border-primary p-3 rounded-t-sm shadow-sm flex flex-wrap justify-between items-center gap-3 no-print">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary rounded-sm border border-primary/20">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-gray-900 tracking-tight font-serif">
                अधिकृत शेअर प्रमाणपत्र अहवाल
              </h1>
              <span className="text-[10px] font-bold text-primary bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                (Official Share Certificate Register)
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium mt-0.5">
              संस्थेतील सर्व सभासदांचे शेअर्स प्रमाणपत्रे, हिस्सा क्रमांक व थेट प्रिव्ह्यू / प्रिंटिंग
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCertificates}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm font-semibold border border-gray-300 transition-colors shadow-2xs"
            title="रिफ्रेश करा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>रिफ्रेश</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-sm font-semibold shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel एक्सपोर्ट</span>
          </button>

          <button
            onClick={handlePrintRegister}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-[#004a75] text-white rounded-sm font-semibold shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>रजिस्टर प्रिंट</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 my-3 no-print">
        <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-primary">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">एकूण प्रमाणपत्रे</span>
          <div className="text-base font-black text-gray-900 mt-0.5 font-mono">{totalCertificates}</div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-blue-600">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">एकूण शेअर्स संख्या</span>
          <div className="text-base font-black text-blue-900 mt-0.5 font-mono">{totalShares.toLocaleString('en-IN')}</div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-emerald-600">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">एकूण शेअर भांडवल</span>
          <div className="text-base font-black text-emerald-800 mt-0.5 font-mono">₹ {fmtCurrency(totalAmount)}</div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-indigo-600">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">सक्रिय (Active / Issued)</span>
          <div className="text-base font-black text-indigo-900 mt-0.5 font-mono">{activeCertificates}</div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs border-l-4 border-l-rose-600">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">रद्द (Cancelled)</span>
          <div className="text-base font-black text-rose-800 mt-0.5 font-mono">{cancelledCertificates}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-sm border border-gray-200 shadow-2xs mb-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 items-end">
          {/* Quick Search */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              शोध (Search Member / Cert No / Code / Account / Mobile):
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="सभासदाचे नाव, कोड, प्रमाणपत्र क्र, खाते नं..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-xs font-medium"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Member Dropdown Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              विशिष्ट सभासद निवडा (Member):
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
            >
              <option value="ALL">-- सर्व सभासद (All Members) --</option>
              {members.map((m) => (
                <option key={m.memberID} value={m.memberID}>
                  {m.memberCode ? `${m.memberCode} - ` : ''}{m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              प्रमाणपत्र स्थिती (Status):
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
            >
              <option value="ALL">सर्व स्थिती (All Status)</option>
              <option value="Issued">जारी केलेले (Issued)</option>
              <option value="Active">सक्रिय (Active)</option>
              <option value="Cancelled">रद्द केलेले (Cancelled)</option>
            </select>
          </div>

          {/* Date Range: From */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                दिनांक पासून:
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-sm focus:outline-none focus:border-primary text-xs font-medium"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-gray-700 mb-1">
                दिनांक पर्यंत:
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded-sm focus:outline-none focus:border-primary text-xs font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Printable Sheet View */}
      <div className="bg-white border border-gray-300 shadow-sm p-4 print:p-0 print:border-none print:shadow-none font-serif">
        {/* Printable Official Letterhead */}
        <div className="text-center border-b-2 border-gray-900 pb-3 mb-3">
          <div className="flex justify-between items-start text-[11px] font-sans text-gray-700 font-bold mb-1">
            <div>
              <span>रजि. नं. - </span>
              <span className="font-mono">{sansthaDetail?.registrationNo || '-'}</span>
            </div>
            <div>
              <span>रजि. दि. - </span>
              <span className="font-mono">{sansthaDetail?.registrationDate ? formatDisplayDate(sansthaDetail.registrationDate) : '-'}</span>
            </div>
          </div>

          <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 uppercase tracking-wide">
            {sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
          </h1>
          <p className="text-xs font-bold text-gray-800 mt-0.5">
            {sansthaDetail?.address || ''} {sansthaDetail?.village ? `मु. ${sansthaDetail.village}, ` : ''}{sansthaDetail?.taluka ? `ता. ${sansthaDetail.taluka}, ` : ''}{sansthaDetail?.district ? `जि. ${sansthaDetail.district}` : ''}
          </p>

          <div className="mt-2 flex justify-between items-center">
            <div className="w-24"></div>
            <div className="inline-block border border-gray-900 bg-gray-100 px-6 py-0.5 rounded font-black text-xs uppercase tracking-wider">
              अधिकृत शेअर प्रमाणपत्र रजिस्टर (Share Certificate Register)
            </div>
            <div className="text-right text-[11px] font-sans font-bold text-gray-800">
              दिनांक: {new Date().toLocaleDateString('en-GB')}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse border border-gray-900 text-[11px] font-sans">
            <thead>
              <tr className="bg-gray-100 text-gray-950 font-bold border-b border-gray-900">
                <th className="border border-gray-900 py-1.5 px-1 w-10">अ.क्र.</th>
                <th className="border border-gray-900 py-1.5 px-2 text-left min-w-[120px]">प्रमाणपत्र क्र.</th>
                <th className="border border-gray-900 py-1.5 px-1.5">जारी दिनांक</th>
                <th className="border border-gray-900 py-1.5 px-1.5">सभासद कोड</th>
                <th className="border border-gray-900 py-1.5 px-2 text-left min-w-[150px]">सभासदाचे पूर्ण नाव</th>
                <th className="border border-gray-900 py-1.5 px-1.5">शेअर्स खाते नं</th>
                <th className="border border-gray-900 py-1.5 px-1.5 text-right font-bold text-blue-950">शेअर्स संख्या</th>
                <th className="border border-gray-900 py-1.5 px-1.5">हिस्सा क्र. (From - To)</th>
                <th className="border border-gray-900 py-1.5 px-1 text-right">दर्शनी मूल्य</th>
                <th className="border border-gray-900 py-1.5 px-2 text-right bg-emerald-50 text-emerald-950 font-black">एकूण रक्कम</th>
                <th className="border border-gray-900 py-1.5 px-1.5">स्थिती</th>
                <th className="border border-gray-900 py-1.5 px-1">प्रिंट</th>
                <th className="border border-gray-900 py-1.5 px-2 no-print text-center">प्रमाणपत्र प्रिव्ह्यू</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                    शेअर प्रमाणपत्र माहिती लोड होत आहे, कृपया प्रतीक्षा करा...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-gray-500 font-semibold border border-gray-900">
                    कोणतेही शेअर प्रमाणपत्र आढळले नाही.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, idx) => (
                  <tr
                    key={item.certificateId || idx}
                    className={`hover:bg-blue-50/40 text-gray-900 border-b border-gray-300 transition-colors ${
                      item.status === 'Cancelled' ? 'bg-rose-50/40 text-gray-500' : ''
                    }`}
                  >
                    <td className="border border-gray-900 py-1 px-1 font-mono">{idx + 1}</td>
                    <td className="border border-gray-900 py-1 px-2 text-left font-mono font-bold text-primary">
                      {item.certificateNo}
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5 font-mono">
                      {formatDisplayDate(item.issueDate)}
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5 font-mono font-semibold">
                      {item.memberNo || '-'}
                    </td>
                    <td className="border border-gray-900 py-1 px-2 text-left font-medium">
                      <div className="font-bold text-gray-950">{item.memberName}</div>
                      {item.jointMemberNames && (
                        <div className="text-[10px] text-gray-500 italic">सह: {item.jointMemberNames}</div>
                      )}
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5 font-mono font-semibold">
                      {item.accountNo || '-'}
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold text-blue-900">
                      {item.numberOfShares}
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5 font-mono font-semibold text-gray-700">
                      {item.fromShareNo} ते {item.toShareNo}
                    </td>
                    <td className="border border-gray-900 py-1 px-1 text-right font-mono">
                      ₹ {item.faceValue}
                    </td>
                    <td className="border border-gray-900 py-1 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-50/50">
                      ₹ {fmtCurrency(item.totalAmount)}
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5">
                      {item.status === 'Cancelled' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <XCircle className="w-3 h-3" /> रद्द
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> जारी
                        </span>
                      )}
                    </td>
                    <td className="border border-gray-900 py-1 px-1 font-mono text-gray-600">
                      {item.printCount || 0}
                    </td>
                    <td className="border border-gray-900 py-1 px-2 no-print text-center">
                      <button
                        onClick={() => setSelectedCertificate(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white rounded text-[10.5px] font-bold shadow-2xs transition-all transform hover:scale-[1.02]"
                        title="अधिकृत शेअर प्रमाणपत्र पहा व प्रिंट करा"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>प्रमाणपत्र प्रिव्ह्यू</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Grand Total Footer */}
            {filteredData.length > 0 && (
              <tfoot>
                <tr className="bg-gray-200 text-gray-950 font-black border-t-2 border-gray-900 text-xs">
                  <td colSpan={6} className="border border-gray-900 py-1.5 px-2 text-right uppercase tracking-wider">
                    एकूण बेरीज (Grand Total):
                  </td>
                  <td className="border border-gray-900 py-1.5 px-1.5 text-right font-mono font-extrabold text-blue-950">
                    {totalShares.toLocaleString('en-IN')}
                  </td>
                  <td className="border border-gray-900" colSpan={2}></td>
                  <td className="border border-gray-900 py-1.5 px-2 text-right font-mono font-black text-emerald-950 bg-emerald-100/70">
                    ₹ {fmtCurrency(totalAmount)}
                  </td>
                  <td className="border border-gray-900" colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer Notes for Print */}
        <div className="mt-6 pt-3 border-t border-gray-400 hidden print:flex justify-between items-end text-xs font-serif font-bold text-gray-800">
          <div>लिपिक / रोखपाल</div>
          <div>मुख्य कार्यकारी अधिकारी / व्यवस्थापक</div>
          <div>अध्यक्ष / संचालक मंडळ</div>
        </div>
      </div>

      {/* Official Share Certificate Modal Preview */}
      {selectedCertificate && (
        <ShareCertificatePreview
          certificate={selectedCertificate}
          onClose={() => {
            setSelectedCertificate(null);
            fetchCertificates(); // Refresh print count if printed
          }}
        />
      )}
    </div>
  );
}

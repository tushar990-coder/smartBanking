import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ShareCertificatePreview, { CertificateData } from './ShareCertificatePreview';
import {
  Award,
  Search,
  Printer,
  RefreshCw,
  ArrowLeft,
  Edit2,
  XCircle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowUpDown,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface Props {
  onBack?: () => void;
}

const ShareCertificateReport: React.FC<Props> = ({ onBack }) => {
  const [certificates, setCertificates] = useState<CertificateData[]>([]);
  const [branches, setBranches] = useState<{ branchID: number; branchName: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Selected certificate for Official Share Certificate Preview Modal
  const [selectedCert, setSelectedCert] = useState<CertificateData | null>(null);

  // Sanstha Details for Register Print Header
  const [sanstha, setSanstha] = useState<any>(null);

  // Cancellation Modal State
  const [cancellingCert, setCancellingCert] = useState<CertificateData | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('सभासद राजीनामा / शेअर समर्पण');
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [savingAccounts, setSavingAccounts] = useState<any[]>([]);
  const [selectedSavingId, setSelectedSavingId] = useState<number | undefined>(undefined);
  const [bankLedgers, setBankLedgers] = useState<any[]>([]);
  const [selectedBankLedgerId, setSelectedBankLedgerId] = useState<number>(0);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  // Edit Certificate Modal State
  const [editingCert, setEditingCert] = useState<CertificateData | null>(null);
  const [editIssueDate, setEditIssueDate] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');
  const [editLoading, setEditLoading] = useState<boolean>(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (branchFilter !== 'ALL') params.branchId = Number(branchFilter);
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await axios.get('/api/ShareCertificates', {
        params,
        headers: getAuthHeaders()
      });
      setCertificates(Array.isArray(res.data) ? res.data : []);
      setPage(1);
    } catch (err) {
      console.error('Error fetching share certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();

    axios
      .get('/api/SansthaDetails', { headers: getAuthHeaders() })
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) setSanstha(res.data[0]);
      })
      .catch(err => console.error('Failed to fetch SansthaDetails:', err));

    axios
      .get('/api/Branches', { headers: getAuthHeaders() })
      .then(res => {
        if (Array.isArray(res.data)) setBranches(res.data);
      })
      .catch(() => {});

    axios
      .get('/api/AccountLedgers/bank-accounts', { headers: getAuthHeaders() })
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setBankLedgers(list);
        if (list.length > 0) setSelectedBankLedgerId(list[0].ledgerID);
      })
      .catch(() => {});
  }, []);

  // Re-fetch when backend filters change
  useEffect(() => {
    fetchCertificates();
  }, [statusFilter, branchFilter, fromDate, toDate]);

  // Extract numeric sort key from LegacyMemberNo or MemberNo or CertificateNo
  const getNumericSortKey = (c: CertificateData): number => {
    if (c.legacyMemberNo) {
      const num = parseInt(String(c.legacyMemberNo).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) return num;
    }
    if (c.memberNo) {
      const num = parseInt(String(c.memberNo).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) return num;
    }
    return c.certificateId || 0;
  };

  const filteredAndSortedCertificates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = certificates.filter(c => {
      if (!q) return true;
      return (
        (c.certificateNo || '').toLowerCase().includes(q) ||
        (c.memberNo || '').toLowerCase().includes(q) ||
        (c.legacyMemberNo || '').toLowerCase().includes(q) ||
        (c.cifNo || '').toLowerCase().includes(q) ||
        (c.memberName || '').toLowerCase().includes(q) ||
        (c.memberNameEng || '').toLowerCase().includes(q) ||
        (c.accountNo || '').toLowerCase().includes(q) ||
        (c.mobileNo || '').toLowerCase().includes(q) ||
        (c.village || '').toLowerCase().includes(q) ||
        (c.nomineeName || '').toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      const keyA = getNumericSortKey(a);
      const keyB = getNumericSortKey(b);
      if (keyA !== keyB) {
        return sortOrder === 'asc' ? keyA - keyB : keyB - keyA;
      }
      return sortOrder === 'asc'
        ? (a.certificateId || 0) - (b.certificateId || 0)
        : (b.certificateId || 0) - (a.certificateId || 0);
    });
  }, [certificates, search, sortOrder]);

  // Summary calculations
  const totalCerts = filteredAndSortedCertificates.length;
  const activeCertsList = useMemo(
    () =>
      filteredAndSortedCertificates.filter(
        c => c.status === 'Active' || c.status === 'Issued' || c.status === 'OpeningBalance'
      ),
    [filteredAndSortedCertificates]
  );
  const activeCertsCount = activeCertsList.length;
  const totalActiveShares = useMemo(
    () => activeCertsList.reduce((acc, c) => acc + (c.numberOfShares || 0), 0),
    [activeCertsList]
  );
  const totalActiveCapital = useMemo(
    () => activeCertsList.reduce((acc, c) => acc + (c.totalAmount || 0), 0),
    [activeCertsList]
  );

  // Pagination
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalCerts / pageSize)) : 1;
  const safePage = Math.min(page, totalPages);
  const paginatedCertificates = useMemo(() => {
    if (pageSize <= 0) return filteredAndSortedCertificates;
    const start = (safePage - 1) * pageSize;
    return filteredAndSortedCertificates.slice(start, start + pageSize);
  }, [filteredAndSortedCertificates, safePage, pageSize]);

  const handleOpenCancelModal = async (cert: CertificateData) => {
    setCancellingCert(cert);
    setCancelReason('सभासद राजीनामा / शेअर समर्पण');
    setPaymentMode('Cash');
    setSelectedSavingId(undefined);

    if (cert.memberId) {
      try {
        const res = await axios.get(`/api/SavingAccounts/member/${cert.memberId}`, {
          headers: getAuthHeaders()
        });
        const activeAccounts = (res.data || []).filter((a: any) => a.status === 'Active');
        setSavingAccounts(activeAccounts);
        if (activeAccounts.length > 0) {
          setSelectedSavingId(activeAccounts[0].savingAccountID);
        }
      } catch (err) {
        console.error('Error fetching member saving accounts:', err);
        setSavingAccounts([]);
      }
    } else {
      setSavingAccounts([]);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingCert) return;
    if (!cancelReason.trim()) {
      alert('कृपया रद्दीकरणाचे कारण प्रविष्ट करा.');
      return;
    }

    if (paymentMode === 'Transfer' && !selectedSavingId) {
      alert('कृपया परतावा जमा करण्यासाठी बचत खाते निवडा किंवा रोख (Cash) पर्याय निवडा.');
      return;
    }
    if (paymentMode === 'Bank' && (!selectedBankLedgerId || selectedBankLedgerId <= 0)) {
      alert('कृपया बँक खाते (Bank Ledger) निवडा.');
      return;
    }

    const confirmMsg = `तुम्हाला खरोखरच प्रमाणपत्र क्र. ${cancellingCert.certificateNo} (${cancellingCert.memberName} - ₹${cancellingCert.totalAmount}) रद्द करायचे आहे का?\n\nयामुळे सभासदाचे शेअर भांडवल कमी होईल आणि रोजकीर्दमध्ये उलट (Reversal) व्हाउचर पडेल!`;
    if (!window.confirm(confirmMsg)) return;

    setCancelLoading(true);
    try {
      const res = await axios.post(
        `/api/ShareCertificates/${cancellingCert.certificateId}/cancel`,
        {
          reason: cancelReason,
          paymentMode: paymentMode,
          savingAccountId: paymentMode === 'Transfer' ? selectedSavingId : null,
          bankLedgerId: paymentMode === 'Bank' ? selectedBankLedgerId : null,
          branchId: cancellingCert.branchId || 1
        },
        { headers: getAuthHeaders() }
      );

      alert(res.data?.message || 'शेअर प्रमाणपत्र यशस्वीरित्या रद्द केले.');
      setCancellingCert(null);
      fetchCertificates();
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data || 'प्रमाणपत्र रद्द करताना त्रुटी आली.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleOpenEditModal = (cert: CertificateData) => {
    setEditingCert(cert);
    setEditIssueDate(cert.issueDate ? cert.issueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setEditRemarks(cert.cancellationReason || '');
  };

  const handleConfirmEdit = async () => {
    if (!editingCert) return;
    setEditLoading(true);
    try {
      await axios.put(
        `/api/ShareCertificates/${editingCert.certificateId}`,
        {
          issueDate: editIssueDate,
          cancellationReason: editRemarks
        },
        { headers: getAuthHeaders() }
      );
      setEditingCert(null);
      fetchCertificates();
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data || 'प्रमाणपत्र अद्ययावत करताना त्रुटी आली.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      'अ.क्र.',
      'प्रमाणपत्र क्र.',
      'वाटप दिनांक',
      'सभासद क्र.',
      'जुना क्र. (LF)',
      'CIF क्र.',
      'शेअर खाते क्र.',
      'सभासदाचे संपूर्ण नाव',
      'गाव',
      'मोबाईल',
      'शेअर पासून',
      'शेअर पर्यंत',
      'एकूण शेअर्स',
      'दर्शनी मूल्य',
      'एकूण भागभांडवल (₹)',
      'वारसदार नाव',
      'वारसदार नाते',
      'स्थिती',
      'प्रिंट संख्या'
    ];
    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = filteredAndSortedCertificates.map((c, idx) => [
      idx + 1,
      c.certificateNo,
      c.issueDate,
      c.memberNo,
      c.legacyMemberNo || '-',
      c.cifNo || '-',
      c.accountNo || '-',
      c.memberName,
      c.village || '-',
      c.mobileNo || '-',
      c.fromShareNo,
      c.toShareNo,
      c.numberOfShares,
      c.faceValue,
      c.totalAmount,
      c.nomineeName || '-',
      c.nomineeRelation || '-',
      c.status || '-',
      c.printCount || 0
    ]);
    const csv = [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Share_Certificate_Register_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setBranchFilter('ALL');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const getStatusBadge = (status?: string, rawStatus?: string) => {
    if (status === 'Active' || status === 'Issued' || status === 'OpeningBalance') {
      return (
        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-sm text-[10px] font-bold border border-emerald-200 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>सक्रिय (Active)</span>
          {rawStatus === 'OpeningBalance' && (
            <span className="text-[9px] text-emerald-600 font-normal">(आरंभी)</span>
          )}
        </span>
      );
    }
    if (status === 'PendingApproval') {
      return (
        <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-sm text-[10px] font-bold border border-amber-200">
          मंजुरी प्रलंबित (Pending)
        </span>
      );
    }
    if (status === 'Transferred') {
      return (
        <span className="bg-sky-50 text-sky-800 px-2 py-0.5 rounded-sm text-[10px] font-bold border border-sky-200">
          हस्तांतरित (Transferred)
        </span>
      );
    }
    if (status === 'Surrendered') {
      return (
        <span className="bg-orange-50 text-orange-800 px-2 py-0.5 rounded-sm text-[10px] font-bold border border-orange-200">
          समर्पित (Surrendered)
        </span>
      );
    }
    if (status === 'Cancelled') {
      return (
        <span className="bg-rose-50 text-rose-800 px-2 py-0.5 rounded-sm text-[10px] font-bold border border-rose-200">
          रद्द (Cancelled)
        </span>
      );
    }
    return <span className="text-gray-600 text-xs">{status || '-'}</span>;
  };

  const formatDateDisplay = (dtStr?: string) => {
    if (!dtStr) return '-';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return dtStr;
      return d.toLocaleDateString('en-GB');
    } catch {
      return dtStr;
    }
  };

  return (
    <div className="p-2.5 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans pb-6 text-xs space-y-2.5">
      <div className="share-cert-report-main space-y-2.5">
        
        {/* Print Only Header for Share Certificate Register */}
        <div className="hidden print:block text-center border-b-2 border-black pb-2.5 mb-3">
          <h1 className="text-lg font-bold uppercase text-black">
            {sanstha?.sansthaName || 'आदर्श नागरिक सहकारी पतसंस्था मर्यादित'}
          </h1>
          <p className="text-[11px] font-semibold text-gray-800">
            {sanstha?.address || 'मुख्य कार्यालय'}, {sanstha?.village || ''} {sanstha?.taluka ? `ता. ${sanstha.taluka}` : ''}{' '}
            {sanstha?.district ? `जि. ${sanstha.district}` : ''}
            {sanstha?.registrationNo ? ` | नोंदणी क्र.: ${sanstha.registrationNo}` : ''}
          </p>
          <h2 className="text-sm font-bold mt-1 text-slate-900 underline">
            अधिकृत शेअर प्रमाणपत्र नोंदवही अहवाल (Official Share Certificate Register)
          </h2>
          <div className="flex justify-between items-center text-[10px] text-slate-700 font-semibold mt-1 px-1">
            <span>अहवाल दिनांक: {new Date().toLocaleDateString('en-GB')}</span>
            <span>एकूण प्रमाणपत्रे: {totalCerts} | सक्रिय शेअर्स: {totalActiveShares}</span>
            <span>एकूण भागभांडवल: ₹{totalActiveCapital.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Screen Header Banner (Matches Active App Theme) */}
        <div className="bg-primary/10 border border-primary/30 rounded-sm px-3.5 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                onClick={onBack}
                className="bg-white hover:bg-primary/10 text-primary px-2.5 py-1.5 rounded-sm border border-primary/30 flex items-center gap-1 text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>मागे (Back)</span>
              </button>
            )}
            <div className="p-1.5 bg-primary/15 text-primary border border-primary/30 rounded-sm">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-primary tracking-wide leading-tight">
                अधिकृत शेअर प्रमाणपत्र अहवाल व प्रिंट केंद्र (Official Share Certificate Report)
              </h1>
              <p className="text-[10.5px] text-slate-600 font-medium">
                नोंदणीकृत सभासदांचे अधिकृत भाग प्रमाणपत्र प्रिव्ह्यू, प्रिंट, दुय्यम प्रत (Duplicate) व रजिस्टर अहवाल
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCertificates}
              className="bg-white hover:bg-primary/10 text-primary border border-primary/30 px-3 py-1.5 rounded-sm font-bold transition text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>रिफ्रेश</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={totalCerts === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-sm text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>एक्सेल (CSV/Excel)</span>
            </button>
            <button
              onClick={() => window.print()}
              disabled={totalCerts === 0}
              className="bg-primary hover:opacity-90 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-sm text-xs font-bold shadow-2xs transition-opacity flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>रजिस्टर प्रिंट (Print)</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Summary Cards (Compact Soft Shades with Left Accent Border) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 no-print">
          <div className="bg-sky-50/70 p-2.5 rounded-sm border border-sky-200 border-l-4 border-l-sky-500 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">एकूण प्रमाणपत्रे (Total Certificates)</p>
              <p className="text-base font-black text-sky-900 mt-0.5">{totalCerts.toLocaleString('en-IN')}</p>
            </div>
            <span className="text-lg bg-white border border-sky-200 w-8 h-8 rounded-sm flex items-center justify-center">📜</span>
          </div>

          <div className="bg-emerald-50/70 p-2.5 rounded-sm border border-emerald-200 border-l-4 border-l-emerald-500 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">सक्रिय प्रमाणपत्रे (Active Certificates)</p>
              <p className="text-base font-black text-emerald-900 mt-0.5">{activeCertsCount.toLocaleString('en-IN')}</p>
            </div>
            <span className="text-lg bg-white border border-emerald-200 w-8 h-8 rounded-sm flex items-center justify-center">✅</span>
          </div>

          <div className="bg-indigo-50/70 p-2.5 rounded-sm border border-indigo-200 border-l-4 border-l-indigo-500 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">एकूण वितरित शेअर्स (Active Shares)</p>
              <p className="text-base font-black text-indigo-900 mt-0.5">{totalActiveShares.toLocaleString('en-IN')}</p>
            </div>
            <span className="text-lg bg-white border border-indigo-200 w-8 h-8 rounded-sm flex items-center justify-center">📊</span>
          </div>

          <div className="bg-amber-50/70 p-2.5 rounded-sm border border-amber-200 border-l-4 border-l-amber-500 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">एकूण भागभांडवल (Share Capital ₹)</p>
              <p className="text-base font-black text-amber-900 mt-0.5">₹{totalActiveCapital.toLocaleString('en-IN')}</p>
            </div>
            <span className="text-lg bg-white border border-amber-200 w-8 h-8 rounded-sm flex items-center justify-center">💰</span>
          </div>
        </div>

        {/* Filters Form (Theme Matched) */}
        <div className="bg-white p-3 rounded-sm shadow-2xs border border-primary/25 border-t-2 border-t-primary space-y-2.5 no-print">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-1.5">
            <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              शेअर प्रमाणपत्र शोध व फिल्टर (Search & Filter Controls)
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-semibold flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-primary" />
                क्रमवारी (Sort):
              </span>
              <button
                type="button"
                onClick={() => setSortOrder('asc')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-sm border transition cursor-pointer ${
                  sortOrder === 'asc'
                    ? 'bg-primary text-white border-primary'
                    : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/15'
                }`}
              >
                १ पासून (Ascending)
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('desc')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-sm border transition cursor-pointer ${
                  sortOrder === 'desc'
                    ? 'bg-primary text-white border-primary'
                    : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/15'
                }`}
              >
                शेवटून (Descending)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
            {/* Search Box */}
            <div className="lg:col-span-4">
              <label className="block text-[10.5px] font-bold text-gray-700 mb-1">
                शोध (प्रमाणपत्र क्र. / सभासद नाव / जुना क्र. LF / CIF / मोबाईल)
              </label>
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="नाव, जुना क्र. (LF), MEM कोड, CIF, मोबाईलने शोधा..."
                className="w-full h-[30px] border border-gray-300 px-2.5 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
              />
            </div>

            {/* Branch Filter */}
            <div className="lg:col-span-2">
              <label className="block text-[10.5px] font-bold text-gray-700 mb-1">शाखा (Branch)</label>
              <select
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
              >
                <option value="ALL">-- सर्व शाखा (All) --</option>
                {branches.map(b => (
                  <option key={b.branchID} value={String(b.branchID)}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-2">
              <label className="block text-[10.5px] font-bold text-gray-700 mb-1">प्रमाणपत्र स्थिती (Status)</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
              >
                <option value="ALL">-- सर्व स्थिती (All) --</option>
                <option value="Active">सक्रिय (Active / Issued)</option>
                <option value="PendingApproval">मंजुरी प्रलंबित (Pending)</option>
                <option value="Transferred">हस्तांतरित (Transferred)</option>
                <option value="Surrendered">समर्पित (Surrendered)</option>
                <option value="Cancelled">रद्द (Cancelled)</option>
              </select>
            </div>

            {/* From Date */}
            <div className="lg:col-span-2">
              <label className="block text-[10.5px] font-bold text-gray-700 mb-1">वाटप दिनांक पासून</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
              />
            </div>

            {/* To Date + Reset */}
            <div className="lg:col-span-2 flex gap-1.5 items-end">
              <div className="flex-1 min-w-0">
                <label className="block text-[10.5px] font-bold text-gray-700 mb-1 truncate">वाटप दिनांक पर्यंत</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
                />
              </div>
              <button
                type="button"
                onClick={clearFilters}
                title="सर्व फिल्टर्स रीसेट करा"
                className="h-[30px] px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-sm text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Share Certificates Register Table (Theme Matched) */}
        <div className="bg-white rounded-sm shadow-2xs border border-primary/25 overflow-hidden">
          <div className="bg-primary/10 px-3 py-1.5 border-b border-primary/20 flex flex-wrap justify-between items-center gap-2 no-print">
            <div className="font-bold text-primary text-xs flex items-center gap-2">
              <span>📋 अधिकृत शेअर प्रमाणपत्र यादी (Share Certificate Register)</span>
              <span className="bg-white text-primary border border-primary/30 text-[10.5px] px-2 py-0.5 rounded-sm font-bold">
                एकूण: {totalCerts}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10.5px] text-slate-600 hidden sm:inline">
                💡 सभासदाचे अधिकृत भाग प्रमाणपत्र पाहण्यासाठी किंवा प्रिंट करण्यासाठी <b>"प्रमाणपत्र प्रिंट"</b> बटणावर क्लिक करा.
              </span>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-600 font-semibold">प्रति पान:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-primary/30 bg-white rounded-sm px-1.5 py-0.5 text-[11px] font-bold text-primary focus:outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={0}>सर्व ({totalCerts})</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[340px]">
            <table id="share-certificate-register-table" className="min-w-full divide-y divide-gray-200 text-xs border-collapse">
              <thead className="bg-primary text-white sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-2 py-1.5 border-r border-white/20 font-semibold w-12 text-center">अ.क्र.</th>
                  <th className="px-2.5 py-1.5 border-r border-white/20 font-semibold text-left">प्रमाणपत्र क्र. व दिनांक</th>
                  <th className="px-2.5 py-1.5 border-r border-white/20 font-semibold text-left">सभासद क्र. / खाते क्र.</th>
                  <th className="px-2.5 py-1.5 border-r border-white/20 font-semibold text-left">जुना क्र. (LF) / CIF</th>
                  <th className="px-2.5 py-1.5 border-r border-white/20 font-semibold text-left">सभासदाचे संपूर्ण नाव, गाव व मोबाईल</th>
                  <th className="px-2 py-1.5 border-r border-white/20 font-semibold text-center">शेअर क्रमांक (From – To)</th>
                  <th className="px-2 py-1.5 border-r border-white/20 font-semibold text-center">एकूण शेअर्स</th>
                  <th className="px-2.5 py-1.5 border-r border-white/20 font-semibold text-right">भागभांडवल रक्कम (₹)</th>
                  <th className="px-2.5 py-1.5 border-r border-white/20 font-semibold text-left">वारसदार (Nominee)</th>
                  <th className="px-2 py-1.5 border-r border-white/20 font-semibold text-center">स्थिती / प्रिंट</th>
                  <th className="px-2.5 py-1.5 font-semibold text-center no-print">अधिकृत प्रमाणपत्र कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500 font-bold">
                      <div className="inline-flex items-center gap-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                        शेअर प्रमाणपत्र माहिती लोड होत आहे... कृपया प्रतीक्षा करा.
                      </div>
                    </td>
                  </tr>
                ) : paginatedCertificates.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500 font-bold">
                      कोणतेही शेअर प्रमाणपत्र सापडले नाही.
                    </td>
                  </tr>
                ) : (
                  paginatedCertificates.map((c, index) => {
                    const rowNum = pageSize > 0 ? (safePage - 1) * pageSize + index + 1 : index + 1;
                    return (
                      <tr
                        key={c.certificateId}
                        className={`hover:bg-primary/5 transition-colors ${index % 2 === 1 ? 'bg-slate-50/50' : ''}`}
                      >
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono font-semibold text-gray-600">
                          {rowNum}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200">
                          <div className="font-mono font-black text-primary">{c.certificateNo}</div>
                          <div className="text-[10px] text-slate-500 font-semibold">
                            दि. {formatDateDisplay(c.issueDate)}
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200">
                          <div className="font-mono font-bold text-slate-900">{c.memberNo || '-'}</div>
                          <div className="text-[10px] font-mono text-slate-500">{c.accountNo || '-'}</div>
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200">
                          <div className="font-mono font-black text-amber-800">
                            {c.legacyMemberNo ? `LF: ${c.legacyMemberNo}` : '-'}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">{c.cifNo || '-'}</div>
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200">
                          <div className="font-bold text-slate-900 text-xs">{c.memberName || '-'}</div>
                          <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-2">
                            {c.village && <span>📍 {c.village}</span>}
                            {c.mobileNo && <span>📞 {c.mobileNo}</span>}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-sm border border-slate-300 font-bold text-[10.5px]">
                            {c.fromShareNo} ते {c.toShareNo}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                          <span className="font-black text-primary text-xs">{c.numberOfShares}</span>
                          <span className="block text-[10px] text-slate-400">x ₹{c.faceValue}</span>
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-black text-slate-900 text-xs">
                          ₹{(c.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-2.5 py-1.5 border-r border-gray-200 text-[11px] text-slate-700">
                          {c.nomineeName ? (
                            <div>
                              <span className="font-semibold text-slate-800">{c.nomineeName}</span>
                              {c.nomineeRelation && (
                                <span className="block text-[10px] text-slate-500">({c.nomineeRelation})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                          <div>{getStatusBadge(c.status, c.rawStatus)}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 font-semibold">
                            प्रिंट: <strong className="text-slate-800">{c.printCount || 0}</strong>
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedCert(c)}
                              className="bg-primary hover:opacity-90 text-white px-2.5 py-1 rounded-sm text-[11px] font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                              title="अधिकृत शेअर प्रमाणपत्र पहा व प्रिंट करा (Official Share Certificate)"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>प्रमाणपत्र प्रिंट</span>
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 p-1 rounded-sm text-xs font-bold transition cursor-pointer"
                              title="दिनांक / शेरा संपादन करा"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {c.status !== 'Cancelled' && (
                              <button
                                onClick={() => handleOpenCancelModal(c)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 p-1 rounded-sm text-xs font-bold transition cursor-pointer"
                                title="प्रमाणपत्र रद्द करा (Cancel & Reverse Capital)"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredAndSortedCertificates.length > 0 && (
                <tfoot>
                  <tr className="bg-primary/10 border-t-2 border-primary/30 font-black text-primary text-xs">
                    <td colSpan={6} className="px-2.5 py-2 text-right border-r border-primary/20">
                      एकूण सक्रिय सारांश (Active Total):
                    </td>
                    <td className="px-2 py-2 text-center border-r border-primary/20">
                      {totalActiveShares.toLocaleString('en-IN')} शेअर्स
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono border-r border-primary/20">
                      ₹{totalActiveCapital.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination Footer (Theme Matched) */}
          <div className="px-3 py-2 bg-slate-50 border-t border-gray-200 flex flex-wrap justify-between items-center gap-2 text-xs text-slate-600 no-print">
            <div>
              दाखवत आहे:{' '}
              <strong className="text-slate-900">
                {totalCerts === 0
                  ? 0
                  : pageSize === 0
                    ? `1 ते ${totalCerts}`
                    : `${(safePage - 1) * pageSize + 1} ते ${Math.min(safePage * pageSize, totalCerts)}`}
              </strong>{' '}
              (एकूण प्रमाणपत्रे: <strong className="text-primary">{totalCerts}</strong>)
            </div>

            {pageSize > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(1)}
                  className="px-2 py-1 bg-white border border-gray-300 rounded-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-[11px]"
                >
                  पहिले
                </button>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 bg-white border border-gray-300 rounded-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center gap-0.5 text-[11px]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>मागील</span>
                </button>
                <span className="px-2.5 py-1 bg-primary text-white rounded-sm font-bold font-mono text-[11px]">
                  पान {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 bg-white border border-gray-300 rounded-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center gap-0.5 text-[11px]"
                >
                  <span>पुढील</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="px-2 py-1 bg-white border border-gray-300 rounded-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer text-[11px]"
                >
                  शेवटचे
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Official Share Certificate Preview Modal */}
      {selectedCert && (
        <ShareCertificatePreview
          certificate={selectedCert}
          onClose={() => setSelectedCert(null)}
          onPrinted={(certId, newCount) => {
            setCertificates(prev =>
              prev.map(item => (item.certificateId === certId ? { ...item, printCount: newCount } : item))
            );
            setSelectedCert(prev => (prev && prev.certificateId === certId ? { ...prev, printCount: newCount } : prev));
          }}
        />
      )}

      {/* Edit Certificate Modal */}
      {editingCert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white border border-gray-300 rounded-sm max-w-md w-full p-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2.5 mb-3">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <Edit2 className="w-4 h-4" />
                <span>शेअर प्रमाणपत्र तपशील संपादन (Edit Certificate)</span>
              </h3>
              <button
                onClick={() => setEditingCert(null)}
                className="text-gray-400 hover:text-gray-700 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-sm p-2.5 mb-3 text-xs space-y-1">
              <p>
                <span className="text-gray-600">प्रमाणपत्र क्र.:</span>{' '}
                <b className="font-mono text-primary">{editingCert.certificateNo}</b>
              </p>
              <p>
                <span className="text-gray-600">सभासद नाव:</span>{' '}
                <b className="text-gray-900">{editingCert.memberName}</b> ({editingCert.memberNo})
              </p>
              <p>
                <span className="text-gray-600">शेअर्स / रक्कम:</span>{' '}
                <b className="text-emerald-700 font-bold">
                  {editingCert.numberOfShares} शेअर्स (₹{editingCert.totalAmount?.toLocaleString('en-IN')})
                </b>
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">वाटप दिनांक (Issue Date) *</label>
                <input
                  type="date"
                  value={editIssueDate}
                  onChange={e => setEditIssueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">शेरा / टीप (Remarks)</label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={e => setEditRemarks(e.target.value)}
                  placeholder="आवश्यक असल्यास शेरा लिहा..."
                  className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-2.5 border-t border-gray-200">
              <button
                onClick={() => setEditingCert(null)}
                className="px-3.5 py-1.5 rounded-sm bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold cursor-pointer"
              >
                बंद करा
              </button>
              <button
                onClick={handleConfirmEdit}
                disabled={editLoading}
                className="px-3.5 py-1.5 rounded-sm bg-primary hover:opacity-90 text-white text-xs font-bold shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {editLoading ? 'जतन होत आहे...' : 'बदल जतन करा'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Certificate Modal with Accounting Reversal */}
      {cancellingCert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white border border-gray-300 rounded-sm max-w-md w-full p-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-200 pb-2.5 mb-3">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                <span>शेअर प्रमाणपत्र रद्दीकरण (Cancel Certificate)</span>
              </h3>
              <button
                onClick={() => setCancellingCert(null)}
                className="text-gray-400 hover:text-gray-700 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-sm p-2.5 mb-3 text-xs space-y-1">
              <p>
                <span className="text-gray-600">प्रमाणपत्र क्र.:</span>{' '}
                <b className="font-mono text-gray-900">{cancellingCert.certificateNo}</b>
              </p>
              <p>
                <span className="text-gray-600">सभासद नाव:</span>{' '}
                <b className="text-gray-900">{cancellingCert.memberName}</b> ({cancellingCert.memberNo})
              </p>
              <p>
                <span className="text-gray-600">परतावा रक्कम:</span>{' '}
                <b className="text-rose-700 font-bold">
                  ₹{cancellingCert.totalAmount?.toLocaleString('en-IN')} ({cancellingCert.numberOfShares} शेअर्स)
                </b>
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">रद्दीकरणाचे कारण (Cancellation Reason) *</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="उदा. सभासद राजीनामा / शेअर समर्पण..."
                  className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">परतावा देण्याची पद्धत (Refund Mode) *</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-rose-500"
                >
                  <option value="Cash">रोख परतावा (Cash Payment Voucher)</option>
                  <option value="Bank">बँक ट्रान्सफर (Bank / NEFT / UPI)</option>
                  <option value="Transfer">बचत खात्यात वर्ग (Transfer to Saving A/c)</option>
                </select>
              </div>

              {paymentMode === 'Bank' && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">बँक खाते निवडा (Select Bank Ledger) *</label>
                  <select
                    value={selectedBankLedgerId}
                    onChange={e => setSelectedBankLedgerId(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-rose-500"
                  >
                    <option value={0}>-- बँक खाते निवडा --</option>
                    {bankLedgers.map((b: any) => (
                      <option key={b.ledgerID} value={b.ledgerID}>
                        {b.ledgerName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentMode === 'Transfer' && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">बचत खाते निवडा (Select Saving Account) *</label>
                  {savingAccounts.length === 0 ? (
                    <p className="text-rose-600 font-semibold">या सभासदाचे कोणतेही सक्रिय बचत खाते आढळले नाही.</p>
                  ) : (
                    <select
                      value={selectedSavingId}
                      onChange={e => setSelectedSavingId(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-sm px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-rose-500"
                    >
                      {savingAccounts.map(acc => (
                        <option key={acc.savingAccountID} value={acc.savingAccountID}>
                          {acc.accountNo} (शिल्लक: ₹{acc.currentBalance})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-sm p-2.5 text-[11px] text-amber-900">
                <b>नोंद:</b> हे प्रमाणपत्र रद्द केल्यास संस्थेच्या <b>भाग भांडवल (Share Capital)</b> लेजरमधून रक्कम नावे (Debit) होऊन निवडलेल्या माध्यमात जमा (Credit) होईल.
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-2.5 border-t border-gray-200">
              <button
                onClick={() => setCancellingCert(null)}
                className="px-3.5 py-1.5 rounded-sm bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold cursor-pointer"
              >
                बंद करा
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                className="px-3.5 py-1.5 rounded-sm bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {cancelLoading ? 'प्रक्रिया सुरू आहे...' : 'प्रमाणपत्र रद्द करा'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareCertificateReport;

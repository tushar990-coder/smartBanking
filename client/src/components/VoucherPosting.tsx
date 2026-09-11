import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Building,
  Calendar,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Info
} from 'lucide-react';

interface VoucherDetail {
  voucherDetailID: number;
  ledgerID: number;
  drCr: string;
  amount: number;
  narration: string;
  ledger: { ledgerName: string };
  customer?: {
    cifNo?: string;
    CIFNo?: string;
    firstName?: string;
    lastName?: string;
    FirstName?: string;
    LastName?: string;
  };
  member?: {
    MemberCode?: string;
    FirstName?: string;
    LastName?: string;
    memberCode?: string;
    firstName?: string;
    lastName?: string;
    customer?: {
      cifNo?: string;
      CIFNo?: string;
      firstName?: string;
      lastName?: string;
      FirstName?: string;
      LastName?: string;
    };
  };
}

interface Voucher {
  voucherID: number;
  branchID?: number;
  voucherNo: string;
  scrollNo?: number;
  voucherDate: string;
  voucherType: string;
  narration: string;
  totalAmount: number;
  status: string;
  voucherDetails: VoucherDetail[];
}

interface VoucherPostingProps {
  onNavigate?: (tab: string) => void;
}

const VoucherPosting: React.FC<VoucherPostingProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedVouchers, setSelectedVouchers] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [expandedVoucherId, setExpandedVoucherId] = useState<number | null>(null);

  // Deletion Modal States
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetVoucherToDelete, setTargetVoucherToDelete] = useState<Voucher | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchUnpostedVouchers();
  }, []);

  const fetchUnpostedVouchers = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const branchId = user?.branchID || 1;
      const res = await fetch(`/api/VoucherPosting/Unposted?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        setVouchers(data);
        setSelectedVouchers(new Set());

        const params = new URLSearchParams(window.location.search);
        const entityIdStr = params.get('entityId');
        const voucherIdStr = params.get('voucherId') || params.get('id');
        const targetVId = voucherIdStr ? parseInt(voucherIdStr) : (entityIdStr ? parseInt(entityIdStr) : null);

        if (targetVId && data.some((v: any) => v.voucherID === targetVId)) {
          setExpandedVoucherId(targetVId);
          setSelectedVouchers(new Set([targetVId]));
        }
      } else {
        setError('प्रलंबित व्हाउचर्स लोड करताना त्रुटी आली. (Failed to load pending vouchers)');
      }
    } catch (err) {
      setError('सर्व्हरशी संपर्क साधता आला नाही. (Network Error)');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedVouchers);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedVouchers(newSelection);
  };

  const selectAllFiltered = () => {
    if (selectedVouchers.size === filteredVouchers.length && filteredVouchers.length > 0) {
      setSelectedVouchers(new Set());
    } else {
      setSelectedVouchers(new Set(filteredVouchers.map((v) => v.voucherID)));
    }
  };

  const handlePostSelected = async () => {
    if (selectedVouchers.size === 0) return;
    if (!window.confirm(`तुम्हाला खात्री आहे का की तुम्ही निवडलेले ${selectedVouchers.size} व्हाउचर मंजूर व पोस्ट करू इच्छिता?`)) return;

    setActionLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: Array.from(selectedVouchers),
          approvedBy: user?.userID || 1,
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        let successText = `${selectedVouchers.size} व्हाउचर(स) यशस्वीरीत्या पास व पोस्ट झाले.`;
        if (resData.vouchers && Array.isArray(resData.vouchers)) {
          const scrollInfo = resData.vouchers.map((v: any) => `${v.voucherNo} (#${v.scrollNo})`).join(', ');
          successText += ` वाटप केलेले स्क्रॉल क्र.: ${scrollInfo}`;
        }
        setMessage(successText);
        fetchUnpostedVouchers();
      } else {
        const errText = await res.text();
        setError(`त्रुटी: ${errText}`);
      }
    } catch (err) {
      setError('पोस्टिंग करताना नेटवर्क त्रुटी आली. (Network error during posting)');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Single Delete Modal
  const openSingleDeleteModal = (voucher: Voucher) => {
    setTargetVoucherToDelete(voucher);
    setDeleteReason('');
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  // Open Bulk Delete Modal
  const openBulkDeleteModal = () => {
    if (selectedVouchers.size === 0) return;
    setDeleteReason('');
    setDeleteError('');
    setBulkDeleteModalOpen(true);
  };

  const closeDeleteModals = () => {
    setDeleteModalOpen(false);
    setBulkDeleteModalOpen(false);
    setTargetVoucherToDelete(null);
    setDeleteReason('');
    setDeleteError('');
  };

  // Execute Single Delete with optional Reason & Audit Log
  const handleConfirmSingleDelete = async () => {
    if (!targetVoucherToDelete) return;

    setActionLoading(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/VoucherPosting/${targetVoucherToDelete.voucherID}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: deleteReason.trim() || 'नोंद थेट रद्द / डिलीट (Direct Deleted from Database)',
          userId: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin',
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok) {
        setMessage(resData?.message || `व्हाउचर क्र. ${targetVoucherToDelete.voucherNo} यशस्वीरीत्या रद्द व हटवले गेले.`);
        closeDeleteModals();
        fetchUnpostedVouchers();
      } else {
        setDeleteError(resData?.message || resData || 'व्हाउचर हटवताना त्रुटी आली.');
      }
    } catch (err) {
      setDeleteError('सर्व्हरशी संपर्क साधता आला नाही. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Bulk Delete with optional Reason & Audit Log
  const handleConfirmBulkDelete = async () => {
    if (selectedVouchers.size === 0) return;

    setActionLoading(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/VoucherPosting/BulkReject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherIds: Array.from(selectedVouchers),
          reason: deleteReason.trim() || 'नोंद थेट रद्द / डिलीट (Direct Deleted from Database)',
          userId: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin',
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok) {
        setMessage(resData?.message || `${selectedVouchers.size} व्हाउचर्स यशस्वीरीत्या रद्द व हटवले गेले.`);
        closeDeleteModals();
        fetchUnpostedVouchers();
      } else {
        setDeleteError(resData?.message || resData || 'एकत्रित व्हाउचर्स हटवताना त्रुटी आली.');
      }
    } catch (err) {
      setDeleteError('सर्व्हरशी संपर्क साधता आला नाही. कृपया पुन्हा प्रयत्न करा.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter vouchers based on search query and type filter
  const filteredVouchers = vouchers.filter((v) => {
    const matchesType = typeFilter === 'ALL' || (v.voucherType || '').toUpperCase() === typeFilter.toUpperCase();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesType;

    const matchesNo = (v.voucherNo || '').toLowerCase().includes(query);
    const matchesScroll = (v.scrollNo || '').toString().includes(query);
    const matchesNarration = (v.narration || '').toLowerCase().includes(query);
    const matchesAmount = (v.totalAmount || 0).toString().includes(query);
    const matchesLedger = v.voucherDetails?.some((vd) =>
      (vd.ledger?.ledgerName || '').toLowerCase().includes(query)
    );

    return matchesType && (matchesNo || matchesScroll || matchesNarration || matchesAmount || matchesLedger);
  });

  // Calculate metrics
  const totalPendingCount = vouchers.length;
  const receiptsCount = vouchers.filter((v) => v.voucherType === 'Receipt').length;
  const paymentsCount = vouchers.filter((v) => v.voucherType === 'Payment').length;
  const totalPendingAmount = vouchers.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

  const selectedVouchersList = vouchers.filter((v) => selectedVouchers.has(v.voucherID));
  const selectedTotalAmount = selectedVouchersList.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

  return (
    <div className="p-2 sm:p-3 max-w-full min-h-full flex flex-col bg-gray-50 text-[11px] font-sans relative pb-28">
      {/* Outer Container */}
      <div className="bg-white rounded-md shadow-sm border border-gray-300 flex flex-col">
        {/* Hero Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0E8A5A] to-emerald-950 text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-white/10 rounded-sm">
              <FileText className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-wide flex items-center gap-1.5">
                <span>📋 व्हाउचर पासिंग, मंजुरी व व्यवस्थापन (Voucher Passing & Approval Master)</span>
              </h2>
              <p className="text-[10px] text-emerald-200/90 font-normal">
                कोअर बँकिंग दुहेरी नियंत्रण (Maker-Checker Approval & Secure Deletion Audit System)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUnpostedVouchers}
              disabled={loading || actionLoading}
              className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded text-xs font-medium border border-white/20 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>रीफ्रेश (Refresh)</span>
            </button>

            {/* Verify Pre-Posting Draft Daybook Button */}
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('draft-daybook');
                } else {
                  window.location.href = '/reports/draft-daybook';
                }
              }}
              className="bg-amber-400 hover:bg-amber-300 text-amber-950 px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-sm border border-amber-500"
              title="व्हाउचर पासिंग करण्यापूर्वी कच्ची रोजकीर्द तपासा (Verify Pre-Posting Draft Daybook)"
            >
              <span>📖</span>
              <span>कच्ची रोजकीर्द (Draft Daybook)</span>
            </button>

            {/* Bulk Reject Button */}
            <button
              onClick={openBulkDeleteModal}
              disabled={selectedVouchers.size === 0 || actionLoading}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                selectedVouchers.size > 0
                  ? 'bg-rose-700 text-white hover:bg-rose-800 shadow-sm border border-rose-600'
                  : 'bg-white/10 text-white/40 cursor-not-allowed border border-white/10'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>निवडलेले रद्द करा ({selectedVouchers.size})</span>
            </button>

            {/* Bulk Post Button */}
            <button
              onClick={handlePostSelected}
              disabled={selectedVouchers.size === 0 || actionLoading}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                selectedVouchers.size > 0
                  ? 'bg-white text-emerald-950 shadow-sm hover:bg-emerald-50'
                  : 'bg-white/20 text-white/50 cursor-not-allowed border border-white/10'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>निवडलेले पास करा ({selectedVouchers.size})</span>
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-white p-2.5 rounded-sm border-l-4 border-slate-700 shadow-2xs flex items-center justify-between border border-gray-200">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">एकूण प्रलंबित व्हाउचर्स</p>
                <p className="text-base font-black text-slate-800">{totalPendingCount}</p>
              </div>
              <span className="text-xl">📚</span>
            </div>

            <div className="bg-white p-2.5 rounded-sm border-l-4 border-emerald-600 shadow-2xs flex items-center justify-between border border-gray-200">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">रिसिप्ट्स (Receipts)</p>
                <p className="text-base font-black text-emerald-700">{receiptsCount}</p>
              </div>
              <span className="text-xl">📥</span>
            </div>

            <div className="bg-white p-2.5 rounded-sm border-l-4 border-rose-600 shadow-2xs flex items-center justify-between border border-gray-200">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">पेमेंट्स (Payments)</p>
                <p className="text-base font-black text-rose-700">{paymentsCount}</p>
              </div>
              <span className="text-xl">📤</span>
            </div>

            <div className="bg-white p-2.5 rounded-sm border-l-4 border-amber-500 shadow-2xs flex items-center justify-between border border-gray-200">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">एकूण प्रलंबित रक्कम</p>
                <p className="text-base font-black text-amber-700">
                  ₹{totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <span className="text-xl">💰</span>
            </div>
          </div>

          {/* Feedback Alerts */}
          {message && (
            <div className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-300 text-xs rounded-sm font-bold flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-rose-50 text-rose-900 border border-rose-300 text-xs rounded-sm font-bold flex items-center gap-2 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Master Table Container */}
          <div className="bg-white rounded-sm shadow-2xs border border-gray-200">
            {/* Controls Header */}
            <div className="p-2 bg-gray-100 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <label className="flex items-center space-x-2 cursor-pointer font-bold text-gray-800 select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary rounded-sm border-gray-400 focus:ring-primary cursor-pointer"
                    checked={selectedVouchers.size === filteredVouchers.length && filteredVouchers.length > 0}
                    onChange={selectAllFiltered}
                  />
                  <span className="text-xs">
                    सर्व {filteredVouchers.length} व्हाउचर्स निवडा (Select All)
                  </span>
                </label>
                {selectedVouchers.size > 0 && (
                  <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-sm border border-primary/20">
                    निवडलेली रक्कम: ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="व्हाउचर क्र., नरेशन किंवा रक्कमेने शोधा..."
                    className="w-full pl-7 pr-6 py-1 text-xs border border-gray-300 rounded-sm focus:outline-none focus:border-primary bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="border border-gray-300 px-2.5 py-1 rounded-sm text-xs focus:outline-none focus:border-primary bg-white font-semibold"
                >
                  <option value="ALL">सर्व प्रकार (All Types)</option>
                  <option value="RECEIPT">रिसिप्ट (Receipt)</option>
                  <option value="PAYMENT">पेमेंट (Payment)</option>
                  <option value="JOURNAL">जर्नल (Journal)</option>
                  <option value="CONTRA">कॉन्ट्रा (Contra)</option>
                </select>
              </div>
            </div>

            {/* Master Table Body */}
            <div className="overflow-x-auto min-h-[350px]">
              <table className="min-w-full divide-y divide-gray-200 text-xs text-center border-collapse">
                <thead className="bg-slate-800 text-white sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="px-2 py-2 border-r border-slate-700 font-semibold w-10 text-center">#</th>
                    <th className="px-2.5 py-2 border-r border-slate-700 font-semibold w-28 text-left">तारीख (Date)</th>
                    <th className="px-2.5 py-2 border-r border-slate-700 font-semibold w-36 text-left">व्हाउचर नंबर (No)</th>
                    <th className="px-2 py-2 border-r border-slate-700 font-semibold w-24 text-center">स्क्रॉल क्र. (Scroll)</th>
                    <th className="px-2.5 py-2 border-r border-slate-700 font-semibold w-24 text-left">प्रकार (Type)</th>
                    <th className="px-2.5 py-2 border-r border-slate-700 font-semibold text-left">तपशील (Narration)</th>
                    <th className="px-2.5 py-2 border-r border-slate-700 font-semibold w-32 text-right">रक्कम (Amount ₹)</th>
                    <th className="px-2 py-2 border-r border-slate-700 font-semibold w-20 text-center">खाती</th>
                    <th className="px-2 py-2 font-semibold w-24 text-center">कृती (Action)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white text-gray-800">
                  {loading && vouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500 font-bold">
                        <div className="inline-flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                          <span>लोड होत आहे... (Loading Pending Vouchers...)</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500 font-bold">
                        {vouchers.length === 0 ? (
                          <div className="space-y-1">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                            <p className="text-sm font-bold text-gray-800">कोणतेही प्रलंबित व्हाउचर शिल्लक नाही</p>
                            <p className="text-xs text-gray-500 font-normal">सर्व व्हाउचर्स यशस्वीरीत्या मंजूर व पोस्ट झालेले आहेत.</p>
                          </div>
                        ) : (
                          'शोधलेल्या निकषांशी जुळणारे कोणतेही व्हाउचर सापडले नाही.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredVouchers.map((v) => {
                      const isSelected = selectedVouchers.has(v.voucherID);
                      const isExpanded = expandedVoucherId === v.voucherID;

                      let typeBadgeStyle = 'bg-blue-100 text-blue-800 border-blue-200';
                      if (v.voucherType === 'Receipt') {
                        typeBadgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                      } else if (v.voucherType === 'Payment') {
                        typeBadgeStyle = 'bg-rose-100 text-rose-800 border-rose-200';
                      } else if (v.voucherType === 'Journal') {
                        typeBadgeStyle = 'bg-purple-100 text-purple-800 border-purple-200';
                      } else if (v.voucherType === 'Contra') {
                        typeBadgeStyle = 'bg-amber-100 text-amber-800 border-amber-200';
                      }

                      return (
                        <React.Fragment key={v.voucherID}>
                          <tr
                            onClick={() => setExpandedVoucherId(isExpanded ? null : v.voucherID)}
                            className={`hover:bg-blue-50/60 transition-colors cursor-pointer ${
                              isSelected ? 'bg-blue-50/90 font-medium' : ''
                            }`}
                          >
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-primary rounded-sm border-gray-400 focus:ring-primary cursor-pointer"
                                checked={isSelected}
                                onChange={() => toggleSelection(v.voucherID)}
                              />
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-left font-medium whitespace-nowrap text-gray-900">
                              <span className="mr-1 text-gray-400 text-[10px] inline-block">{isExpanded ? '▼' : '▶'}</span>
                              {new Date(v.voucherDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-left font-black text-gray-900 whitespace-nowrap font-mono">
                              {v.voucherNo}
                            </td>
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold whitespace-nowrap">
                              {v.scrollNo ? (
                                <span className="px-2 py-0.5 inline-flex text-[10px] font-black bg-amber-100 text-amber-900 rounded-sm border border-amber-300">
                                  #{v.scrollNo}
                                </span>
                              ) : (
                                <span className="text-gray-400 font-mono text-[10px] italic">प्रलंबित</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-left whitespace-nowrap">
                              <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm border ${typeBadgeStyle}`}>
                                {v.voucherType}
                              </span>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-left text-gray-700 truncate max-w-xs" title={v.narration || ''}>
                              {v.narration ? (
                                <span>{v.narration}</span>
                              ) : (
                                <span className="text-gray-400 italic">तपशील उपलब्ध नाही</span>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                              ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center font-bold text-gray-600">
                              {v.voucherDetails?.length || 0} खाती
                            </td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => openSingleDeleteModal(v)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-2 py-0.5 rounded-sm font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                                title="व्हाउचर कायमचे रद्द व हटवा"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                                <span>रद्द / हटवा</span>
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Voucher Details Breakdown */}
                          {isExpanded && (
                            <tr
                              ref={(el) => {
                                if (el) {
                                  setTimeout(() => {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                  }, 60);
                                }
                              }}
                              className="bg-slate-50 border-b-2 border-primary/30"
                            >
                              <td colSpan={9} className="p-2.5 sm:p-3 text-left">
                                <div className="bg-white p-3 rounded-md border-2 border-primary/20 shadow-md space-y-2">
                                  <div className="flex flex-wrap justify-between items-center border-b border-gray-200 pb-2 gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="p-1 bg-primary/10 rounded text-primary">
                                        <Layers className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <h4 className="font-extrabold text-primary text-xs flex items-center gap-1.5">
                                          <span>खाती तपशील (Ledger Breakdown for {v.voucherNo})</span>
                                        </h4>
                                        <p className="text-[10px] text-gray-500">
                                          तारीख: <span className="font-bold text-gray-700">{new Date(v.voucherDate).toLocaleDateString('en-GB')}</span> | 
                                          स्क्रॉल क्र.: <span className="font-bold text-amber-700">{v.scrollNo ? `#${v.scrollNo}` : 'मंजुरीनंतर'}</span> | 
                                          प्रकार: <span className="font-bold text-gray-700">{v.voucherType}</span>
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-black bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded border border-emerald-300">
                                        एकूण रक्कम: ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedVoucherId(null);
                                        }}
                                        className="text-gray-400 hover:text-rose-600 px-2 py-1 rounded text-[10px] font-bold border border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer flex items-center gap-1"
                                        title="तपशील बंद करा"
                                      >
                                        <X className="w-3 h-3" />
                                        <span>बंद करा</span>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto border border-gray-200 rounded-sm">
                                    <table className="min-w-full divide-y divide-gray-200 text-[11px]">
                                      <thead className="bg-slate-800 text-white font-semibold">
                                        <tr>
                                          <th className="px-3 py-1.5 text-left border-r border-slate-700">खाते (Ledger Name)</th>
                                          <th className="px-3 py-1.5 text-left border-r border-slate-700 w-52">सीआयएफ क्र. / खातेदार (CIF ID)</th>
                                          <th className="px-3 py-1.5 text-right border-r border-slate-700 w-36">नावे (Debit Dr ₹)</th>
                                          <th className="px-3 py-1.5 text-right w-36">जमा (Credit Cr ₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 bg-white">
                                        {v.voucherDetails?.map((vd, idx) => (
                                          <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                            <td className="px-3 py-1.5 text-gray-900 font-bold border-r border-gray-200">
                                              <span>{vd.ledger?.ledgerName || 'Unknown Ledger'}</span>
                                              {vd.narration ? (
                                                <span className="text-gray-500 font-normal italic ml-2 text-[10.5px]">({vd.narration})</span>
                                              ) : null}
                                            </td>
                                             <td className="px-3 py-1.5 text-gray-700 border-r border-gray-200 font-medium">
                                               {(() => {
                                                 const ledgerName = vd.ledger?.ledgerName || '';
                                                 const accountType = (vd.ledger as any)?.accountType || '';
                                                 const isCashOrGeneral = accountType === 'Cash In Hand' || 
                                                                         ledgerName.includes('रोख') || 
                                                                         ledgerName.toLowerCase().includes('cash');

                                                 if (isCashOrGeneral) {
                                                   return <span className="text-gray-400 font-mono">-</span>;
                                                 }

                                                 const cif = vd.customer?.CIFNo || vd.customer?.cifNo || vd.member?.customer?.CIFNo || vd.member?.customer?.cifNo;
                                                 const firstName = vd.customer?.FirstName || vd.customer?.firstName || vd.member?.customer?.FirstName || vd.member?.customer?.firstName || vd.member?.FirstName || vd.member?.firstName || '';
                                                 const lastName = vd.customer?.LastName || vd.customer?.lastName || vd.member?.customer?.LastName || vd.member?.customer?.lastName || vd.member?.LastName || vd.member?.lastName || '';
                                                 const fullName = `${firstName} ${lastName}`.trim();

                                                 if (cif) {
                                                   return (
                                                     <div className="flex flex-col leading-tight">
                                                       <span className="font-extrabold text-primary font-mono text-[11.5px]">{cif}</span>
                                                       {fullName ? <span className="text-[10px] text-gray-600 font-medium">{fullName}</span> : null}
                                                     </div>
                                                   );
                                                 }

                                                 const memCode = vd.member?.MemberCode || vd.member?.memberCode;
                                                 if (memCode) {
                                                   return (
                                                     <div className="flex flex-col leading-tight">
                                                       <span className="font-bold text-gray-800 font-mono text-[11.5px]">{memCode}</span>
                                                       {fullName ? <span className="text-[10px] text-gray-600 font-medium">{fullName}</span> : null}
                                                     </div>
                                                   );
                                                 }

                                                 return <span className="text-gray-400 font-mono">-</span>;
                                               })()}
                                             </td>
                                            <td className="px-3 py-1.5 text-right text-rose-600 font-mono font-bold border-r border-gray-200">
                                              {vd.drCr === 'Dr' ? `₹${vd.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-emerald-700 font-mono font-bold">
                                              {vd.drCr === 'Cr' ? `₹${vd.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-slate-100 font-bold text-[11px] border-t-2 border-slate-300">
                                        <tr>
                                          <td colSpan={2} className="px-3 py-1.5 text-right font-bold text-gray-800 border-r border-gray-200">
                                            एकूण बेरजा (Total Dr / Cr):
                                          </td>
                                          <td className="px-3 py-1.5 text-right text-rose-700 font-mono font-black border-r border-gray-200">
                                            ₹{(v.voucherDetails?.filter(d => d.drCr === 'Dr').reduce((s, d) => s + (d.amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td className="px-3 py-1.5 text-right text-emerald-800 font-mono font-black">
                                            ₹{(v.voucherDetails?.filter(d => d.drCr === 'Cr').reduce((s, d) => s + (d.amount || 0), 0) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* SINGLE VOUCHER DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && targetVoucherToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="bg-white rounded-md shadow-2xl border border-rose-300 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-rose-700 to-rose-900 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-200" />
                <h3 className="text-xs font-bold tracking-wide">
                  व्हाउचर रद्द व डिलीट प्रक्रिया (Core Banking Voucher Deletion)
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDeleteModals}
                className="text-rose-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              {/* Voucher Detail Summary Card */}
              <div className="bg-rose-50/70 border border-rose-200 rounded-sm p-3 space-y-1.5 text-xs text-gray-800">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-rose-900 font-mono text-sm">
                    {targetVoucherToDelete.voucherNo}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-white border border-rose-200 text-rose-800">
                    {targetVoucherToDelete.voucherType}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                  <div>
                    तारीख: <strong>{new Date(targetVoucherToDelete.voucherDate).toLocaleDateString('en-GB')}</strong>
                  </div>
                  <div>
                    रक्कम: <strong className="text-rose-700 font-mono">₹{targetVoucherToDelete.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
                {targetVoucherToDelete.narration && (
                  <div className="text-[11px] text-gray-600 border-t border-rose-200 pt-1 mt-1">
                    तपशील: <span className="italic">{targetVoucherToDelete.narration}</span>
                  </div>
                )}
              </div>

              {/* Core Banking Rule Notice */}
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-sm text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">कोअर बँकिंग सुरक्षा व ऑडिट नियम:</p>
                  <p className="text-[10px] text-amber-800 mt-0.5 leading-relaxed">
                    हे व्हाउचर हटवल्यास मूळ व्यवहार (Pigmy / Loan / Share / Savings) चे व्हाऊचर लिंकेज पूर्ववत होईल. संपूर्ण व्हाउचर तपशील व तुमचे कारण <strong>सुरक्षा ऑडिट ट्रेल (Audit Log)</strong> मध्ये नोंदवले जाईल.
                  </p>
                </div>
              </div>

              {/* Optional Reason Input */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  रद्द / डिलीट करण्याचे कारण (Reason - पर्यायी / Optional)
                </label>
                <textarea
                  rows={3}
                  value={deleteReason}
                  onChange={(e) => {
                    setDeleteReason(e.target.value);
                    if (deleteError) setDeleteError('');
                  }}
                  placeholder="व्हाउचर थेट रद्द करण्याचे कारण लिहा (नसल्यास थेट डिलीट होईल)..."
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 bg-white"
                  autoFocus
                />
                <div className="flex justify-between items-center mt-1 text-[10px]">
                  <span className="text-gray-500">
                    थेट डिलीट: कारण लिहिणे ऐच्छिक (Optional) आहे
                  </span>
                  <span className="text-gray-400">
                    वापरकर्ता: <strong>{user?.username || 'Admin'}</strong>
                  </span>
                </div>
              </div>

              {/* Error in modal */}
              {deleteError && (
                <div className="p-2 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-sm font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-100 px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModals}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-sm text-xs border border-gray-300 cursor-pointer disabled:opacity-50"
              >
                मागे जा (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-sm text-xs border border-rose-800 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>हटवत आहे...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>व्हाउचर कायमचे रद्द करा (Confirm Delete)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK VOUCHERS DELETE CONFIRMATION MODAL */}
      {bulkDeleteModalOpen && selectedVouchers.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="bg-white rounded-md shadow-2xl border border-rose-300 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-rose-800 to-rose-950 text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-300" />
                <h3 className="text-xs font-bold tracking-wide">
                  एकत्रित व्हाउचर्स रद्द व डिलीट करणे (Bulk Voucher Rejection)
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDeleteModals}
                className="text-rose-200 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3">
              {/* Bulk Summary Card */}
              <div className="bg-rose-50/80 border border-rose-200 rounded-sm p-3 space-y-2 text-xs text-gray-800">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-rose-900">
                    एकूण निवडलेले व्हाउचर्स: <strong>{selectedVouchers.size}</strong>
                  </span>
                  <span className="text-rose-900 font-mono font-bold">
                    एकूण रक्कम: ₹{selectedTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="max-h-24 overflow-y-auto bg-white p-1.5 border border-rose-200 rounded-sm text-[10px] space-y-1">
                  {selectedVouchersList.map((v) => (
                    <div key={v.voucherID} className="flex justify-between border-b border-gray-100 last:border-0 pb-0.5">
                      <span className="font-mono font-bold">{v.voucherNo}</span>
                      <span className="text-gray-500">{v.voucherType}</span>
                      <span className="font-mono">₹{v.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Core Banking Rule Notice */}
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-sm text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">कोअर बँकिंग सुरक्षा ऑडिट नोंद:</p>
                  <p className="text-[10px] text-amber-800 mt-0.5 leading-relaxed">
                    हे सर्व <strong>{selectedVouchers.size}</strong> प्रलंबित व्हाउचर्स कायमस्वरूपी रद्द केले जातील. प्रत्येक व्हाउचरचा सुरक्षा ऑडिट स्नॅपशॉट जतन केला जाईल.
                  </p>
                </div>
              </div>

              {/* Optional Reason Input */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  एकत्रित रद्द / डिलीट करण्याचे कारण (Reason - पर्यायी / Optional)
                </label>
                <textarea
                  rows={3}
                  value={deleteReason}
                  onChange={(e) => {
                    setDeleteReason(e.target.value);
                    if (deleteError) setDeleteError('');
                  }}
                  placeholder="सर्व निवडलेले व्हाउचर थेट रद्द करण्याचे कारण लिहा (नसल्यास थेट डिलीट होतील)..."
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 bg-white"
                  autoFocus
                />
                <div className="flex justify-between items-center mt-1 text-[10px]">
                  <span className="text-gray-500">
                    थेट डिलीट: कारण लिहिणे ऐच्छिक (Optional) आहे
                  </span>
                  <span className="text-gray-400">
                    मंजूर/रद्दकर्ता: <strong>{user?.username || 'Admin'}</strong>
                  </span>
                </div>
              </div>

              {/* Error in modal */}
              {deleteError && (
                <div className="p-2 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-sm font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-100 px-4 py-2.5 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModals}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-bold rounded-sm text-xs border border-gray-300 cursor-pointer disabled:opacity-50"
              >
                मागे जा (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={actionLoading}
                className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-sm text-xs border border-rose-800 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>हटवत आहे...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>सर्व {selectedVouchers.size} व्हाउचर्स रद्द करा (Confirm Bulk Rejection)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherPosting;

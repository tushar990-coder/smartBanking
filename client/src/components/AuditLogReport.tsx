import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ShieldCheck, Search, RotateCcw, Printer, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  auditLogID: number;
  userID: number | null;
  username: string;
  action: string;
  entityName: string;
  entityID: string | null;
  timestamp: string;
  ipAddress: string | null;
  details: string | null;
  status: string;
}

const getLocalTodayStr = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const shiftDateStr = (baseDateStr: string, days: number): string => {
  const dt = new Date(baseDateStr + 'T00:00:00');
  if (isNaN(dt.getTime())) return getLocalTodayStr();
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ENTITY_LABELS: Record<string, string> = {
  Voucher: 'व्हाउचर (Voucher)',
  Customer: 'खातेदार (Customer)',
  Member: 'सभासद (Member)',
  JointMember: 'संयुक्त सभासद (Joint Member)',
  SavingAccountMaster: 'बचत खाते (Saving Account)',
  SavingTransaction: 'बचत व्यवहार (Saving Txn)',
  SavingAccountClosing: 'बचत खाते बंद (Saving Close)',
  FdAccount: 'मुदत ठेव (FD Account)',
  RdAccount: 'आवर्ती ठेव (RD Account)',
  RdTransaction: 'आवर्ती ठेव व्यवहार (RD Txn)',
  LoanAccount: 'कर्ज खाते (Loan Account)',
  LoanCollection: 'कर्ज वसुली (Loan Collection)',
  LoanCollateral: 'कर्ज तारण (Loan Collateral)',
  LoanRate: 'कर्ज व्याजदर (Loan Rate)',
  EmployeeBankDetail: 'कर्मचारी बँक माहिती',
  FinancialYear: 'आर्थिक वर्ष (Financial Year)',
  Branch: 'शाखा (Branch)',
  User: 'युजर मास्टर (User)',
  UserLogin: 'लॉगिन सुरक्षा (Auth Login)',
};

const parseCleanDetails = (rawDetails: string | null): { summary: string; snapshotJson: string | null } => {
  if (!rawDetails) return { summary: '-', snapshotJson: null };

  let text = rawDetails.trim();
  let snapshotPart: string | null = null;

  const snapMarkers = ['| Snapshot:', '| OldVoucherDetails:', '| Details:'];
  for (const marker of snapMarkers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      snapshotPart = text.substring(idx + marker.length).trim();
      text = text.substring(0, idx).trim();
      break;
    }
  }

  if (!snapshotPart && (text.startsWith('{') || text.startsWith('['))) {
    try {
      const parsed = JSON.parse(text);
      snapshotPart = JSON.stringify(parsed, null, 2);
      const keysPreview = Object.entries(parsed)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' | ');
      text = keysPreview || 'JSON डेटा तपशील';
    } catch {
      // Keep original text
    }
  } else if (snapshotPart) {
    try {
      const parsed = JSON.parse(snapshotPart);
      snapshotPart = JSON.stringify(parsed, null, 2);
    } catch {
      // Keep raw snapshot string
    }
  }

  return { summary: text || '-', snapshotJson: snapshotPart };
};

const AuditLogReport: React.FC = () => {
  const todayDefault = getLocalTodayStr();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [usernameFilter, setUsernameFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>(todayDefault);
  const [toDate, setToDate] = useState<string>(todayDefault);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);

  useEffect(() => {
    fetchSansthaDetails();
  }, []);

  const fetchSansthaDetails = async () => {
    try {
      const res = await axios.get('/api/SansthaDetails');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSansthaDetail(res.data[0]);
      } else if (res.data && !Array.isArray(res.data)) {
        setSansthaDetail(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchAuditLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        if (actionFilter) params.set('action', actionFilter);
        if (usernameFilter) params.set('username', usernameFilter);
        if (entityFilter) params.set('entityName', entityFilter);
        if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
        params.set('pageSize', '2500');

        const res = await axios.get(`/api/AuditLogs?${params.toString()}`);
        if (isMounted) {
          setLogs(Array.isArray(res.data) ? res.data : []);
          setCurrentPage(1);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.message || 'ऑडीट लॉग्स लोड करताना त्रुटी आली. (Failed to fetch audit logs)');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAuditLogs();

    return () => {
      isMounted = false;
    };
  }, [fromDate, toDate, actionFilter, usernameFilter, entityFilter, statusFilter]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter(log => {
      if (statusFilter !== 'ALL' && (log.status || '').toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (q) {
        const matchId = String(log.auditLogID).includes(q);
        const matchUser = (log.username || '').toLowerCase().includes(q);
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchEntity = (log.entityName || '').toLowerCase().includes(q);
        const matchEntityId = (log.entityID || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        const matchIp = (log.ipAddress || '').toLowerCase().includes(q);
        if (!matchId && !matchUser && !matchAction && !matchEntity && !matchEntityId && !matchDetails && !matchIp) {
          return false;
        }
      }
      return true;
    });
  }, [logs, statusFilter, searchQuery]);

  // Reset to page 1 when searchQuery changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filteredLogs.length / pageSize)) : 1;
  const paginatedLogs = useMemo(() => {
    if (pageSize <= 0) return filteredLogs;
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Calculate metrics on full filtered dataset
  const totalLogs = filteredLogs.length;
  const uniqueUsers = new Set(filteredLogs.map(l => l.username).filter(Boolean)).size;
  const createUpdateCount = filteredLogs.filter(l => {
    const a = (l.action || '').toUpperCase();
    return a.includes('CREATE') || a.includes('UPDATE') || a.includes('EDIT') || a.includes('POST') || a.includes('UPSERT');
  }).length;
  const highRiskCount = filteredLogs.filter(l => {
    const a = (l.action || '').toUpperCase();
    const st = (l.status || '').toUpperCase();
    return a.includes('DELETE') || a.includes('REVERT') || a.includes('UNPASS') || a.includes('REJECT') || a.includes('LOCK') || st === 'FAILED';
  }).length;

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;
    let csv = `SrNo,AuditLogID,Timestamp,Username,Action,EntityName,EntityID,IP Address,Status,Details\n`;
    filteredLogs.forEach((log, idx) => {
      const { summary } = parseCleanDetails(log.details);
      const detailsClean = summary.replace(/"/g, '""');
      const timeStr = new Date(log.timestamp).toLocaleString('en-IN');
      csv += `${idx + 1},${log.auditLogID},"${timeStr}","${log.username || 'System'}","${log.action}","${log.entityName}","${log.entityID || ''}","${log.ipAddress || ''}",${log.status || 'Success'},"${detailsClean}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `System_Audit_Trail_${fromDate || 'All'}_to_${toDate || 'All'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    const today = getLocalTodayStr();
    setActionFilter('');
    setUsernameFilter('');
    setEntityFilter('');
    setSearchQuery('');
    setStatusFilter('ALL');
    setFromDate(today);
    setToDate(today);
    setCurrentPage(1);
  };

  const setQuickRange = (days: number | null) => {
    const today = getLocalTodayStr();
    if (days === null) {
      setFromDate('');
      setToDate('');
    } else if (days === 0) {
      setFromDate(today);
      setToDate(today);
    } else {
      setFromDate(shiftDateStr(today, -days));
      setToDate(today);
    }
  };

  return (
    <div className="p-2.5 max-w-7xl mx-auto bg-slate-50 min-h-screen font-sans pb-6 text-xs space-y-2.5">
      {/* Print styles */}
      <style>
        {`
          @media print {
            @page { size: A4 landscape; margin: 8mm; }
            body { background-color: white !important; font-family: sans-serif; font-size: 8.5pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .print-table-wrap { max-height: none !important; min-height: 0 !important; overflow: visible !important; }
            table { width: 100% !important; border-collapse: collapse !important; page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
          }
        `}
      </style>

      {/* Print Only Header */}
      <div className="hidden print:block text-center border-b-2 border-black pb-2.5 mb-3">
        <h1 className="text-lg font-bold uppercase">{sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h1>
        <p className="text-[11px] font-semibold">
          {sansthaDetail?.address || 'मुख्य कार्यालय'}
          {sansthaDetail?.registrationNo ? ` | नोंदणी क्र.: ${sansthaDetail.registrationNo}` : ''}
        </p>
        <h2 className="text-sm font-bold mt-1 text-slate-900 underline">
          सिस्टीम ऑडीट ट्रेल अहवाल (System Audit Trail Report)
        </h2>
        <div className="flex justify-between items-center text-[10px] text-slate-700 font-semibold mt-1 px-1">
          <span>कालावधी: {fromDate ? `${fromDate} ते ${toDate || fromDate}` : 'सर्व कालावधी (All Dates)'}</span>
          <span>एकूण नोंदी: {filteredLogs.length} | सक्रिय युजर्स: {uniqueUsers}</span>
          <span>छपाई दिनांक: {new Date().toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Screen Header Banner (Soft Theme Shade) */}
      <div className="bg-primary/10 border border-primary/30 rounded-sm px-3.5 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/15 text-primary border border-primary/30 rounded-sm">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-primary tracking-wide leading-tight">
              सिस्टीम ऑडीट ट्रेल अहवाल (System Audit Trail Report)
            </h1>
            <p className="text-[10.5px] text-slate-600 font-medium">
              लॉगिन सुरक्षा, व्हाउचर निर्मिती/पासिंग, खाते बदल, डिलीट नोंदी व युजर क्रियाकलापांचा संपूर्ण ऑडीट अहवाल
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={filteredLogs.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-sm text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>एक्सेल (CSV/Excel)</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={filteredLogs.length === 0}
            className="bg-primary hover:opacity-90 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-sm text-xs font-bold shadow-2xs transition-opacity flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>प्रिंट करा (Print)</span>
          </button>
        </div>
      </div>

      {/* Stat Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 no-print">
        <div className="bg-sky-50/70 p-2.5 rounded-sm border border-sky-200 border-l-4 border-l-sky-500 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-sky-800 uppercase tracking-wider">एकूण ऑडीट नोंदी (Total Logs)</p>
            <p className="text-base font-black text-sky-900 mt-0.5">{totalLogs}</p>
          </div>
          <span className="text-lg bg-white border border-sky-200 w-8 h-8 rounded-sm flex items-center justify-center">📋</span>
        </div>

        <div className="bg-indigo-50/70 p-2.5 rounded-sm border border-indigo-200 border-l-4 border-l-indigo-500 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">सक्रिय युजर्स (Active Users)</p>
            <p className="text-base font-black text-indigo-900 mt-0.5">{uniqueUsers}</p>
          </div>
          <span className="text-lg bg-white border border-indigo-200 w-8 h-8 rounded-sm flex items-center justify-center">👥</span>
        </div>

        <div className="bg-emerald-50/70 p-2.5 rounded-sm border border-emerald-200 border-l-4 border-l-emerald-500 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">नवीन व अपडेट नोंदी (Create/Edit)</p>
            <p className="text-base font-black text-emerald-900 mt-0.5">{createUpdateCount}</p>
          </div>
          <span className="text-lg bg-white border border-emerald-200 w-8 h-8 rounded-sm flex items-center justify-center">✅</span>
        </div>

        <div className="bg-rose-50/70 p-2.5 rounded-sm border border-rose-200 border-l-4 border-l-rose-500 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">डिलीट / रिव्हर्ट / अलर्ट (High Risk)</p>
            <p className="text-base font-black text-rose-900 mt-0.5">{highRiskCount}</p>
          </div>
          <span className="text-lg bg-white border border-rose-200 w-8 h-8 rounded-sm flex items-center justify-center">⚠️</span>
        </div>
      </div>

      {/* Filters Form */}
      <div className="bg-white p-3 rounded-sm shadow-2xs border border-primary/25 border-t-2 border-t-primary space-y-2.5 no-print">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-1.5">
          <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            ऑडीट नोंदी शोध व फिल्टर (Search & Filter Controls)
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-500 font-semibold">जलद कालावधी:</span>
            <button
              type="button"
              onClick={() => setQuickRange(0)}
              className="px-2 py-0.5 text-[10px] font-bold rounded-sm border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 cursor-pointer"
            >
              आज (Today)
            </button>
            <button
              type="button"
              onClick={() => setQuickRange(7)}
              className="px-2 py-0.5 text-[10px] font-bold rounded-sm border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 cursor-pointer"
            >
              मागील ७ दिवस
            </button>
            <button
              type="button"
              onClick={() => setQuickRange(30)}
              className="px-2 py-0.5 text-[10px] font-bold rounded-sm border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 cursor-pointer"
            >
              मागील ३० दिवस
            </button>
            <button
              type="button"
              onClick={() => setQuickRange(null)}
              className="px-2 py-0.5 text-[10px] font-bold rounded-sm border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer"
            >
              सर्व कालावधी (All Dates)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
          <div className="lg:col-span-2">
            <label className="block text-[10.5px] font-bold text-gray-700 mb-1">पासून (From Date)</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10.5px] font-bold text-gray-700 mb-1">पर्यंत (To Date)</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10.5px] font-bold text-gray-700 mb-1">विभाग / एंटिटी (Entity)</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
            >
              <option value="">-- सर्व विभाग (All) --</option>
              <option value="Voucher">व्हाउचर (Voucher)</option>
              <option value="Customer">खातेदार (Customer)</option>
              <option value="Member">सभासद (Member)</option>
              <option value="Saving">बचत ठेव (Saving)</option>
              <option value="FdAccount">मुदत ठेव (FD)</option>
              <option value="Rd">आवर्ती ठेव (RD)</option>
              <option value="Loan">कर्ज विभाग (Loan)</option>
              <option value="UserLogin">लॉगिन सुरक्षा (User Login)</option>
              <option value="User">युजर मास्टर (User)</option>
              <option value="FinancialYear">आर्थिक वर्ष (Financial Year)</option>
              <option value="Branch">शाखा (Branch)</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10.5px] font-bold text-gray-700 mb-1">कृती प्रकार (Action)</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
            >
              <option value="">-- सर्व कृती (All Actions) --</option>
              <option value="CREATE">CREATE (नवीन नोंद)</option>
              <option value="UPDATE">UPDATE (बदल / दुरुस्ती)</option>
              <option value="DELETE">DELETE (डिलीट / रद्द)</option>
              <option value="UNPASSED">UNPASSED (व्हाउचर रिव्हर्ट)</option>
              <option value="LOGIN">LOGIN (युजर लॉगिन)</option>
              <option value="PASSWORD">PASSWORD (पासवर्ड बदल)</option>
              <option value="BRANCH_SWITCH">BRANCH_SWITCH (शाखा बदल)</option>
            </select>
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[10.5px] font-bold text-gray-700 mb-1">युजर (User)</label>
            <input
              type="text"
              placeholder="उदा. admin"
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[10.5px] font-bold text-gray-700 mb-1">व्हाउचर / खाते क्र. / तपशील शोध</label>
            <input
              type="text"
              placeholder="व्हाउचर क्र., खाते क्र., रक्कम शोधा..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[30px] border border-gray-300 px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
            />
          </div>

          <div className="lg:col-span-1 flex gap-1.5 items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-[10.5px] font-bold text-gray-700 mb-1 truncate">स्थिती</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-[30px] border border-gray-300 px-1 rounded-sm focus:outline-none focus:border-primary text-xs font-medium bg-white"
              >
                <option value="ALL">सर्व</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              title="सर्व फिल्टर्स रीसेट करा"
              className="h-[30px] px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-sm text-xs font-bold transition-colors cursor-pointer flex items-center justify-center flex-shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 text-rose-800 border border-rose-200 text-xs rounded-sm font-bold flex items-center gap-1.5 no-print">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white rounded-sm shadow-2xs border border-primary/25 overflow-hidden">
        <div className="bg-primary/10 px-3 py-1.5 border-b border-primary/20 flex flex-wrap justify-between items-center gap-2 no-print">
          <div className="font-bold text-primary text-xs flex items-center gap-2">
            <span>📋 ऑडीट नोंदी यादी (Audit Trail Records)</span>
            <span className="bg-white text-primary border border-primary/30 text-[10.5px] px-2 py-0.5 rounded-sm font-bold">
              एकूण: {filteredLogs.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10.5px] text-slate-600 hidden sm:inline">
              💡 सविस्तर माहिती व JSON Snapshot पाहण्यासाठी ओळीवर क्लिक करा.
            </span>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-600 font-semibold">प्रति पान:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-primary/30 bg-white rounded-sm px-1.5 py-0.5 text-[11px] font-bold text-primary focus:outline-none"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={0}>सर्व ({filteredLogs.length})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Screen Paginated Table + Print Full Table */}
        <div className="overflow-x-auto min-h-[340px] max-h-[600px] print-table-wrap">
          <table className="min-w-full divide-y divide-gray-200 text-xs border-collapse">
            <thead className="bg-primary text-white sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="px-2 py-1.5 border-r border-white/20 font-semibold w-12 text-center">अ.क्र.</th>
                <th className="px-2 py-1.5 border-r border-white/20 font-semibold w-16 text-center">लॉग आयडी</th>
                <th className="px-2 py-1.5 border-r border-white/20 font-semibold w-36 text-left">तारीख व वेळ (Timestamp)</th>
                <th className="px-2 py-1.5 border-r border-white/20 font-semibold w-28 text-left">युजरनाव (User)</th>
                <th className="px-2 py-1.5 border-r border-white/20 font-semibold w-36 text-left">कृती (Action)</th>
                <th className="px-2 py-1.5 border-r border-white/20 font-semibold w-36 text-left">विभाग / संदर्भ क्र. (Entity)</th>
                <th className="px-2 py-1.5 border-r border-white/20 font-semibold text-left">तपशील (Audit Details)</th>
                <th className="px-2 py-1.5 border-r border-white/20 font-semibold w-24 text-left">IP ॲड्रेस</th>
                <th className="px-2 py-1.5 font-semibold w-20 text-center">स्थिती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500 font-bold">
                    <div className="inline-flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                      ऑडीट लॉग्स लोड होत आहेत... (Loading Audit Logs...)
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500 font-bold">
                    निवडलेल्या तारखेसाठी किंवा फिल्टर्ससाठी कोणतीही ऑडीट नोंद सापडली नाही. (वर 'सर्व कालावधी' किंवा 'मागील ३० दिवस' क्लिक करून पहा)
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log, idx) => {
                  const srNo = pageSize > 0 ? (currentPage - 1) * pageSize + idx + 1 : idx + 1;
                  const isExpanded = expandedLogId === log.auditLogID;
                  const isSuccess = (log.status || 'SUCCESS').toUpperCase() === 'SUCCESS';
                  const actionUpper = (log.action || '').toUpperCase();
                  const { summary, snapshotJson } = parseCleanDetails(log.details);

                  let actionBadgeStyle = 'bg-sky-50 text-sky-800 border-sky-200';
                  if (actionUpper.includes('DELETE') || actionUpper.includes('REJECT') || actionUpper.includes('FAILED') || actionUpper.includes('LOCK')) {
                    actionBadgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
                  } else if (actionUpper.includes('POST') || actionUpper.includes('APPROVE') || actionUpper.includes('CREATE') || actionUpper.includes('LOGIN')) {
                    actionBadgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  } else if (actionUpper.includes('UPDATE') || actionUpper.includes('EDIT') || actionUpper.includes('UNPASS') || actionUpper.includes('REVERT')) {
                    actionBadgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
                  }

                  const entityDisplay = ENTITY_LABELS[log.entityName] || log.entityName || '-';

                  return (
                    <React.Fragment key={log.auditLogID}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.auditLogID)}
                        className={`hover:bg-primary/5 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-primary/10 font-medium' : idx % 2 === 1 ? 'bg-slate-50/50' : ''
                        }`}
                      >
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center font-semibold text-gray-600">
                          {srNo}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 font-mono text-[10.5px] text-gray-500 text-center font-bold">
                          #{log.auditLogID > 10000000 ? `L-${log.auditLogID - 10000000}` : log.auditLogID}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium whitespace-nowrap text-gray-900">
                          <span className="mr-1 text-primary text-[10px] no-print">{isExpanded ? '▼' : '▶'}</span>
                          {new Date(log.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                          })}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-slate-800 whitespace-nowrap">
                          {log.username || 'System'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left whitespace-nowrap">
                          <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm border ${actionBadgeStyle}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-semibold text-gray-800 whitespace-nowrap">
                          <span>{entityDisplay}</span>
                          {log.entityID ? (
                            <span className="ml-1 text-primary font-mono text-[10.5px] font-bold">#{log.entityID}</span>
                          ) : null}
                        </td>
                        <td
                          className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-700 max-w-md truncate print:max-w-none print:whitespace-normal print:break-words"
                          title={summary}
                        >
                          {summary}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-mono text-[10.5px] text-gray-500 whitespace-nowrap">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm border ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {log.status || 'Success'}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Detail View */}
                      {isExpanded && (
                        <tr className="bg-primary/5 border-b-2 border-primary/30 no-print">
                          <td colSpan={9} className="p-3 text-left">
                            <div className="bg-white p-3 rounded-sm border border-primary/30 shadow-2xs space-y-2">
                              <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                                <h4 className="font-bold text-primary text-xs flex items-center gap-1.5">
                                  <span>🔍 सविस्तर ऑडीट माहिती (Audit Log Record #{log.auditLogID})</span>
                                </h4>
                                <span className="text-[10.5px] text-gray-600 font-mono bg-slate-100 px-2 py-0.5 rounded-sm border border-slate-200">
                                  IP Address: {log.ipAddress || 'Localhost'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs bg-slate-50 p-2 rounded-sm border border-slate-200">
                                <div>
                                  <span className="font-bold text-gray-500">युजर (User):</span>{' '}
                                  <span className="font-bold text-primary">{log.username || 'System'}</span>{' '}
                                  {log.userID ? <span className="text-gray-500">(ID: {log.userID})</span> : ''}
                                </div>
                                <div>
                                  <span className="font-bold text-gray-500">कृती (Action):</span>{' '}
                                  <span className="font-bold text-gray-800">{log.action}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-500">विभाग (Entity):</span>{' '}
                                  <span className="font-bold text-gray-800">{entityDisplay}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-500">संदर्भ क्र. (Entity ID):</span>{' '}
                                  <span className="font-mono font-bold text-primary">{log.entityID || '-'}</span>
                                </div>
                              </div>

                              <div>
                                <span className="font-bold text-gray-700 block mb-1">प्रमुख तपशील (Audit Summary):</span>
                                <div className="bg-slate-50 p-2 rounded-sm text-xs text-slate-800 border border-slate-200 font-medium">
                                  {summary}
                                </div>
                              </div>

                              {snapshotJson && (
                                <div>
                                  <span className="font-bold text-gray-700 block mb-1">
                                    तांत्रिक डेटा स्नॅपशॉट (Technical Snapshot / JSON Payload):
                                  </span>
                                  <pre className="bg-slate-900 text-emerald-300 p-2.5 rounded-sm text-[11px] font-mono whitespace-pre-wrap border border-slate-700 max-h-52 overflow-y-auto">
                                    {snapshotJson}
                                  </pre>
                                </div>
                              )}
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

        {/* Pagination Footer */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="bg-slate-50 px-3 py-2 border-t border-gray-200 flex items-center justify-between no-print">
            <span className="text-[11px] text-slate-600 font-medium">
              नोंदी <b>{(currentPage - 1) * pageSize + 1}</b> ते{' '}
              <b>{Math.min(currentPage * pageSize, filteredLogs.length)}</b> (एकूण <b>{filteredLogs.length}</b> पैकी)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-white border border-gray-300 rounded-sm text-xs font-bold text-slate-700 hover:bg-primary/10 hover:border-primary disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> मागील
              </button>
              <span className="px-2.5 py-1 bg-primary/10 border border-primary/30 text-primary font-bold rounded-sm text-xs">
                पान {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 bg-white border border-gray-300 rounded-sm text-xs font-bold text-slate-700 hover:bg-primary/10 hover:border-primary disabled:opacity-40 cursor-pointer flex items-center gap-1"
              >
                पुढील <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Print Only Signature Footer */}
      <div className="hidden print:grid grid-cols-3 gap-8 pt-12 mt-8 text-center text-xs font-bold text-slate-800">
        <div>
          <div className="border-t border-black pt-1.5 mx-6">तयार करणार (Prepared By)</div>
        </div>
        <div>
          <div className="border-t border-black pt-1.5 mx-6">अंतर्गत लेखापरीक्षक (Internal Auditor)</div>
        </div>
        <div>
          <div className="border-t border-black pt-1.5 mx-6">मुख्य कार्यकारी अधिकारी / व्यवस्थापक</div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogReport;

import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

const AuditLogReport: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [usernameFilter, setUsernameFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

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
        let url = `/api/AuditLogs?fromDate=${fromDate}&toDate=${toDate}`;
        if (actionFilter) url += `&action=${encodeURIComponent(actionFilter)}`;
        if (usernameFilter) url += `&username=${encodeURIComponent(usernameFilter)}`;
        if (entityFilter) url += `&entityName=${encodeURIComponent(entityFilter)}`;

        const res = await axios.get(url);
        if (isMounted) {
          setLogs(res.data);
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
  }, [fromDate, toDate, actionFilter, usernameFilter, entityFilter]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (filteredLogs.length === 0) return;
    let csv = `ID,Timestamp,User,Action,Entity,EntityID,IP Address,Status,Details\n`;
    filteredLogs.forEach(log => {
      const detailsClean = (log.details || '').replace(/"/g, '""');
      csv += `${log.auditLogID},"${new Date(log.timestamp).toLocaleString('en-IN')}",${log.username || 'System'},"${log.action}","${log.entityName}",${log.entityID || ''},"${log.ipAddress || ''}",${log.status},"${detailsClean}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Trail_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setActionFilter('');
    setUsernameFilter('');
    setEntityFilter('');
    setStatusFilter('ALL');
    setFromDate(new Date().toISOString().split('T')[0]);
    setToDate(new Date().toISOString().split('T')[0]);
  };

  const filteredLogs = logs.filter(log => {
    if (statusFilter !== 'ALL' && (log.status || '').toUpperCase() !== statusFilter.toUpperCase()) {
      return false;
    }
    return true;
  });

  // Calculate metrics
  const totalLogs = filteredLogs.length;
  const uniqueUsers = new Set(filteredLogs.map(l => l.username).filter(Boolean)).size;
  const criticalActions = filteredLogs.filter(l => 
    (l.action || '').toUpperCase().includes('DELETE') || 
    (l.action || '').toUpperCase().includes('REJECT') ||
    (l.action || '').toUpperCase().includes('POST') ||
    (l.action || '').toUpperCase().includes('UPDATE')
  ).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogsCount = filteredLogs.filter(l => l.timestamp && l.timestamp.startsWith(todayStr)).length;

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4 text-xs">
      {/* Print styles */}
      <style>
        {`
          @media print {
            @page { size: landscape; margin: 8mm; }
            body { background-color: white; font-family: sans-serif; font-size: 9pt; }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
          }
        `}
      </style>

      {/* Print Only Header */}
      <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-4">
        <h1 className="text-xl font-bold uppercase">{sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h1>
        <p className="text-xs font-semibold">{sansthaDetail?.address || 'मुख्य कार्यालय'}{sansthaDetail?.registrationNo ? ` | नोंदणी क्र.: ${sansthaDetail.registrationNo}` : ''}</p>
        <h2 className="text-md font-bold mt-1 text-red-900">सिस्टीम ऑडीट ट्रेल अहवाल (System Audit Trail Report)</h2>
        <p className="text-xs text-gray-600">कालावधी: {fromDate} ते {toDate}</p>
      </div>
      <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1 no-print">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h1 className="text-lg font-bold text-gray-800">सिस्टीम ऑडीट ट्रेल अहवाल (System Audit Trail Report)</h1>
          </div>
          <p className="text-gray-500 text-[10px] font-medium mt-0.5">
            सुरक्षा नोंदी, व्हाउचर निर्मिती, मंजुरी, डिलीट व युजर क्रियाकलापांची ऑडीट नोंद (Track security events & system activities)
          </p>
        </div>

        <div className="flex items-center gap-2 mb-0.5">
          <button
            onClick={handleExportExcel}
            disabled={filteredLogs.length === 0}
            className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 text-white px-3 py-1 rounded-sm text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>📊 एक्सेल (Excel)</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={filteredLogs.length === 0}
            className="bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 text-white px-3 py-1 rounded-sm text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span>🖨️ प्रिंट (Print)</span>
          </button>
        </div>
      </div>

      {/* Stat Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2.5 no-print">
        <div className="bg-white p-2 rounded-sm border-l-4 border-primary shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">एकूण ऑडीट नोंदी</p>
            <p className="text-base font-black text-primary">{totalLogs}</p>
          </div>
          <span className="text-xl">📋</span>
        </div>

        <div className="bg-white p-2 rounded-sm border-l-4 border-indigo-600 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">सक्रिय युजर्स</p>
            <p className="text-base font-black text-indigo-700">{uniqueUsers}</p>
          </div>
          <span className="text-xl">👥</span>
        </div>

        <div className="bg-white p-2 rounded-sm border-l-4 border-amber-500 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">महत्त्वाच्या क्रिया (Updates/Delete)</p>
            <p className="text-base font-black text-amber-700">{criticalActions}</p>
          </div>
          <span className="text-xl">⚡</span>
        </div>

        <div className="bg-white p-2 rounded-sm border-l-4 border-emerald-600 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">आजच्या नोंदी (Today)</p>
            <p className="text-base font-black text-emerald-700">{todayLogsCount}</p>
          </div>
          <span className="text-xl">🗓️</span>
        </div>
      </div>

      {/* Filters Form */}
      <div className="bg-white p-2 rounded-sm shadow-2xs border border-gray-200 mb-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-x-2 gap-y-1.5 items-end">
          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase">पासून (From Date)</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 text-xs font-medium bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase">पर्यंत (To Date)</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 text-xs font-medium bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase">कृती (Action Filter)</label>
            <input
              type="text"
              placeholder="उदा. VOUCHER, POST..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 text-xs font-medium bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase">युजरनाव (Username)</label>
            <input
              type="text"
              placeholder="युजर शोधा..."
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 text-xs font-medium bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase">एंटिटी (Entity Name)</label>
            <input
              type="text"
              placeholder="उदा. Voucher, Member..."
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 text-xs font-medium bg-white"
            />
          </div>

          <div className="flex gap-1.5">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase">स्थिती (Status)</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 px-1 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 text-xs font-medium bg-white"
              >
                <option value="ALL">सर्व (All)</option>
                <option value="SUCCESS">यशस्वी (Success)</option>
                <option value="FAILED">अयशस्वी (Failed)</option>
              </select>
            </div>

            <button
              onClick={clearFilters}
              title="फिल्टर्स क्लिअर करा"
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-0.5 rounded-sm text-xs font-bold transition-colors cursor-pointer self-end h-[24px]"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-50 text-red-700 border border-red-200 text-xs rounded-sm font-bold flex items-center gap-1.5 no-print">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Audit Logs Table */}
      <div className="bg-white rounded-sm shadow-2xs border border-gray-200 overflow-hidden">
        <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-200 flex justify-between items-center no-print">
          <div className="font-bold text-gray-700 text-xs flex items-center gap-1.5">
            <span>📋 ऑडीट नोंदी यादी (Audit Trail Records)</span>
            <span className="bg-primary text-white text-[10px] px-2 py-0.2 rounded-full font-black">
              {filteredLogs.length}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 italic">💡 कोणत्याही ओळीवर क्लिक करून सविस्तर तपशील पहा.</span>
        </div>

        <div className="overflow-x-auto min-h-[350px] max-h-[600px]">
          <table className="min-w-full divide-y divide-gray-200 text-xs text-center border-collapse">
            <thead className="bg-primary text-white sticky top-0 z-10 shadow-xs">
              <tr>
                <th className="px-2 py-1.5 border-r border-blue-400 font-semibold w-16 text-center">आयडी (ID)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-semibold w-36 text-left">तारीख व वेळ (Timestamp)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-semibold w-32 text-left">युजरनाव (User)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-semibold w-36 text-left">कृती (Action)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-semibold w-32 text-left">माहिती प्रकार (Entity)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-semibold text-left">तपशील (Details)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-semibold w-28 text-left">IP ॲड्रेस</th>
                <th className="px-2 py-1.5 font-semibold w-24 text-center">स्थिती (Status)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 font-bold">
                    <div className="inline-flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                      लोड होत आहे... (Loading Audit Logs...)
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 font-bold">
                    निवडलेल्या फिल्टर्ससाठी कोणतीही ऑडीट नोंद सापडली नाही. (No audit records found)
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.auditLogID;
                  const isSuccess = (log.status || '').toUpperCase() === 'SUCCESS';
                  const actionUpper = (log.action || '').toUpperCase();

                  let actionBadgeStyle = 'bg-blue-100 text-blue-800 border-blue-200';
                  if (actionUpper.includes('DELETE') || actionUpper.includes('REJECT')) {
                    actionBadgeStyle = 'bg-red-100 text-red-800 border-red-200';
                  } else if (actionUpper.includes('POST') || actionUpper.includes('APPROVE') || actionUpper.includes('CREATE')) {
                    actionBadgeStyle = 'bg-green-100 text-green-800 border-green-200';
                  } else if (actionUpper.includes('UPDATE') || actionUpper.includes('EDIT')) {
                    actionBadgeStyle = 'bg-amber-100 text-amber-800 border-amber-200';
                  }

                  return (
                    <React.Fragment key={log.auditLogID}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.auditLogID)}
                        className={`hover:bg-blue-50/60 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-blue-50/80 font-medium' : ''
                        }`}
                      >
                        <td className="px-2 py-1.5 border-r border-gray-200 font-mono text-[11px] text-gray-600 text-center font-bold">
                          #{log.auditLogID}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-medium whitespace-nowrap text-gray-900">
                          <span className="mr-1 text-gray-400 text-[10px]">{isExpanded ? '▼' : '▶'}</span>
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
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-bold text-indigo-900 whitespace-nowrap">
                          👤 {log.username || 'System'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left whitespace-nowrap">
                          <span className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm border ${actionBadgeStyle}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-semibold text-gray-800 whitespace-nowrap">
                          {log.entityName} {log.entityID ? <span className="text-gray-500 font-mono text-[10px]">#{log.entityID}</span> : ''}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left text-gray-600 truncate max-w-xs" title={log.details || ''}>
                          {log.details || '-'}
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-left font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 inline-flex text-[10px] leading-3 font-bold rounded-sm border ${
                              isSuccess
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-red-100 text-red-800 border-red-200'
                            }`}
                          >
                            {log.status || 'SUCCESS'}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Detail View */}
                      {isExpanded && (
                        <tr className="bg-slate-50 border-b-2 border-primary/30">
                          <td colSpan={8} className="p-3 text-left">
                            <div className="bg-white p-3 rounded-sm border border-gray-300 shadow-2xs space-y-2">
                              <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                                <h4 className="font-bold text-primary text-xs flex items-center gap-1.5">
                                  <span>🔍 सविस्तर ऑडीट माहिती (Audit Log Details #{log.auditLogID})</span>
                                </h4>
                                <span className="text-[10px] text-gray-500 font-mono">IP: {log.ipAddress || 'Localhost'}</span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="font-bold text-gray-600">युजर (User):</span>{' '}
                                  <span className="font-bold text-indigo-700">{log.username}</span> {log.userID ? `(ID: ${log.userID})` : ''}
                                </div>
                                <div>
                                  <span className="font-bold text-gray-600">ॲक्शन (Action):</span>{' '}
                                  <span className="font-bold text-gray-800">{log.action}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-gray-600">एंटिटी (Entity):</span>{' '}
                                  <span className="font-bold text-gray-800">{log.entityName}</span> {log.entityID ? `#${log.entityID}` : ''}
                                </div>
                              </div>

                              <div>
                                <span className="font-bold text-gray-600 block mb-0.5">सविस्तर तपशील (Details payload / Remarks):</span>
                                <pre className="bg-gray-100 p-2 rounded-sm text-[11px] font-mono text-gray-800 whitespace-pre-wrap border border-gray-200 max-h-48 overflow-y-auto">
                                  {log.details || 'कोणताही अतिरिक्त तपशील नोंदवलेला नाही.'}
                                </pre>
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
  );
};

export default AuditLogReport;

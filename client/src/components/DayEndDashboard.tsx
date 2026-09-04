import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface EodStatus {
  businessDate: string;
  isDayClosed: boolean;
  unpostedVouchers: number;
  transferTally: {
    debit: number;
    credit: number;
    isMatched: boolean;
  };
  cashTally: {
    opening: number;
    closing: number;
    isPositive: boolean;
  };
  pigmyReconciliation: {
    pendingCollections: number;
    isReconciled: boolean;
  };
}

interface EodLog {
  logID: number;
  businessDate: string;
  stepNumber: number;
  stepName: string;
  status: string;
  recordsProcessed: number;
  errorMessage: string | null;
  startTime: string;
}

interface Branch {
  branchID: number;
  branchName: string;
  branchCode: string;
}

const DayEndDashboard: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const [status, setStatus] = useState<EodStatus | null>(null);
  const [logs, setLogs] = useState<EodLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'checklist' | 'reopen' | 'logs'>('checklist');
  const [reopenReason, setReopenReason] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchEodData(selectedBranchId);
    }
  }, [selectedBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/Branches');
      setBranches(res.data);
      if (res.data.length > 0) {
        setSelectedBranchId(res.data[0].branchID);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEodData = async (branchId: number) => {
    setLoading(true);
    setError('');
    try {
      const [statusRes, logsRes] = await Promise.all([
        axios.get(`/api/EodOperations/status/${branchId}`),
        axios.get(`/api/EodOperations/logs/${branchId}`)
      ]);
      setStatus(statusRes.data);
      setLogs(logsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'EOD माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunEod = async () => {
    if (!window.confirm('तुम्ही खात्रीशीरपणे शाखेची दिवस अखेर (EOD) प्रक्रिया करू इच्छिता? EOD पूर्ण झाल्यावर आजचे व्यवहार बंद होतील.')) {
      return;
    }

    setProcessing(true);
    setMessage('');
    setError('');

    try {
      const res = await axios.post(`/api/EodOperations/close-day/${selectedBranchId}`);
      setMessage(res.data.message || 'दिवस अखेर (EOD) यशस्वीरीत्या पूर्ण झाली आहे!');
      fetchEodData(selectedBranchId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'EOD प्रक्रियेदरम्यान त्रुटी आली. कृपया सर्व प्रलंबित वॉउचर्स तपासा.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUnlockDay = async () => {
    if (!reopenReason || reopenReason.trim().length < 10) {
      setError('दिवस पुन्हा उघडण्यासाठी किमान १० अक्षरांचे सबळ कारण नमूद करणे बंधनकारक आहे.');
      return;
    }

    if (!window.confirm('तुम्ही मागील बिझनेस डेट पुन्हा उघडू इच्छिता? हे फक्त ॲडमिन मंजुरीने केले जाते.')) {
      return;
    }

    setProcessing(true);
    setMessage('');
    setError('');

    try {
      const res = await axios.post(`/api/EodOperations/unlock-day/${selectedBranchId}`, {
        reason: reopenReason
      });
      setMessage(res.data.message || 'मागील बिझनेस डेट यशस्वीरीत्या अनलॉक केली आहे.');
      setReopenReason('');
      fetchEodData(selectedBranchId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'दिवस अनलॉक करताना त्रुटी आली.');
    } finally {
      setProcessing(false);
    }
  };

  const stepsList = [
    { num: 1, name: 'अमंजूर वॉउचर्स पडताळणी (Validate Unposted Vouchers)' },
    { num: 2, name: 'युझर सेशन्स लॉक (Teller Session Lockout)' },
    { num: 3, name: 'दैनंदिन कर्ज व्याज गणना (Daily Loan Interest)' },
    { num: 4, name: 'मुदत ठेव व्याज संचय (FD Accruals)' },
    { num: 5, name: 'आवर्ती ठेव हप्ते व दंड (RD Dues & Penalty)' },
    { num: 6, name: 'पिग्मी शिल्लक व कमिशन (Pigmy Balances & Commission)' },
    { num: 7, name: 'अखेरची रोख शिल्लक (Closing Cash Calculation)' },
    { num: 8, name: 'चालू बिझनेस डेट गोठवणे (Freeze Business Date)' },
    { num: 9, name: 'पुढील बिझनेस डेट उघडणे (Advance Date & BOD)' }
  ];

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt || 0);
  };

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
      {/* Title Header */}
      <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1">
        <div>
          <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            🏛️ बिझनेस डेट व दिवस अखेर मॉड्यूल्स (Day End / EOD Control)
          </h1>
          <p className="text-[11px] text-gray-500">
            शाखेची अधिकृत बँकिंग बिझनेस डेट व स्वयंचलित ९-टप्प्यांची दिवस अखेर (EOD/BOD) प्रक्रिया
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-700">शाखा (Branch):</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(parseInt(e.target.value))}
            className="border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 transition-colors text-xs font-bold bg-white"
          >
            {branches.map(b => (
              <option key={b.branchID} value={b.branchID}>
                {b.branchName} ({b.branchCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="mb-2 p-2 bg-green-50 border border-green-300 text-green-800 rounded-sm text-xs font-medium flex items-center justify-between">
          <span>✅ {message}</span>
          <button onClick={() => setMessage('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-300 text-red-800 rounded-sm text-xs font-medium flex items-center justify-between">
          <span>❌ {error}</span>
          <button onClick={() => setError('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      )}

      {/* Business Date Status Header Card */}
      {status && (
        <div className="bg-white p-2.5 rounded-sm shadow-sm border border-gray-200 mb-3 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-sm ${status.isDayClosed ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <span className="text-xl">{status.isDayClosed ? '🔒' : '📅'}</span>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">चालू बिझनेस डेट (Active Business Date)</div>
              <div className="text-xl font-extrabold text-gray-800 font-mono">
                {new Date(status.businessDate).toLocaleDateString('en-GB')}
              </div>
              <div className="text-xs mt-0.5">
                स्थिती: {' '}
                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${status.isDayClosed ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                  {status.isDayClosed ? 'दिवस बंद (Frozen/Closed)' : 'दिवस चालू (Open for Transactions)'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchEodData(selectedBranchId)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-sm text-xs font-semibold text-gray-700 transition"
            >
              🔄 रीफ्रेश (Refresh)
            </button>
            <button
              onClick={handleRunEod}
              disabled={processing || status.isDayClosed}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-sm shadow-sm transition disabled:opacity-50 text-xs flex items-center space-x-1"
            >
              <span>{processing ? 'प्रक्रिया सुरू...' : '⚡ दिवस अखेर करा (Run EOD)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-300 mb-3 space-x-1">
        <button
          onClick={() => setActiveTab('checklist')}
          className={`px-3 py-1.5 font-bold text-xs rounded-t-sm transition border-b-2 ${
            activeTab === 'checklist'
              ? 'border-primary text-primary bg-white border-t border-l border-r border-gray-200'
              : 'border-transparent text-gray-600 hover:text-gray-900 bg-gray-100'
          }`}
        >
          ✅ EOD पूर्व-तपासणी तक्ता (Pre-EOD Checklist & 9 Steps)
        </button>
        <button
          onClick={() => setActiveTab('reopen')}
          className={`px-3 py-1.5 font-bold text-xs rounded-t-sm transition border-b-2 ${
            activeTab === 'reopen'
              ? 'border-primary text-primary bg-white border-t border-l border-r border-gray-200'
              : 'border-transparent text-gray-600 hover:text-gray-900 bg-gray-100'
          }`}
        >
          🔓 मागील दिवस उघडणे (Reopen Day - Admin)
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-1.5 font-bold text-xs rounded-t-sm transition border-b-2 ${
            activeTab === 'logs'
              ? 'border-primary text-primary bg-white border-t border-l border-r border-gray-200'
              : 'border-transparent text-gray-600 hover:text-gray-900 bg-gray-100'
          }`}
        >
          📜 EOD बॅच लॉग अहवाल (Audit Logs)
        </button>
      </div>

      {/* Tab 1: Pre-EOD Checklist & 9 Steps */}
      {activeTab === 'checklist' && status && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Validation Indicators */}
          <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200">
            <div className="flex justify-between items-center border-b pb-1 mb-2">
              <h2 className="text-xs font-bold text-primary">
                १. EOD पूर्व तपासणी (Validation Checks)
              </h2>
              <span className="text-[10px] text-gray-400 font-semibold">स्वयंचलित २४ तास मेळ</span>
            </div>

            <div className="space-y-2">
              {/* Check 1: Unposted Vouchers */}
              <div className="p-2 rounded-sm border border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div>
                  <div className="font-bold text-xs text-gray-800">अमंजूर/प्रलंबित वॉउचर्स (Unposted Vouchers)</div>
                  <div className="text-[11px] text-gray-500">मंजूर न झालेले वॉउचर्स: {status.unpostedVouchers}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-extrabold ${status.unpostedVouchers === 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                  {status.unpostedVouchers === 0 ? '🟢 PASSED (0 Pending)' : `🔴 FAILED (${status.unpostedVouchers} Pending)`}
                </span>
              </div>

              {/* Check 2: Transfer Tally */}
              <div className="p-2 rounded-sm border border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div>
                  <div className="font-bold text-xs text-gray-800">डेबिट व क्रेडिट जुळणी (Transfer Debit-Credit Tally)</div>
                  <div className="text-[11px] text-gray-500 font-mono">
                    Dr: {formatCurrency(status.transferTally.debit)} | Cr: {formatCurrency(status.transferTally.credit)}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-extrabold ${status.transferTally.isMatched ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                  {status.transferTally.isMatched ? '🟢 MATCHED' : '🔴 MISMATCH'}
                </span>
              </div>

              {/* Check 3: Closing Cash */}
              <div className="p-2 rounded-sm border border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div>
                  <div className="font-bold text-xs text-gray-800">अखेरची रोख शिल्लक (Closing Cash Balance)</div>
                  <div className="text-[11px] text-gray-500 font-mono">
                    शुरुवात: {formatCurrency(status.cashTally.opening)} | अखेर: {formatCurrency(status.cashTally.closing)}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-extrabold ${status.cashTally.isPositive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                  {status.cashTally.isPositive ? '🟢 POSITIVE CASH' : '🔴 NEGATIVE CASH'}
                </span>
              </div>

              {/* Check 4: Pigmy Agent Reconciliation */}
              <div className="p-2 rounded-sm border border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div>
                  <div className="font-bold text-xs text-gray-800">पिग्मी एजंट डे-बुक मेळ (Pigmy Collection Reconciliation)</div>
                  <div className="text-[11px] text-gray-500">अपड पडताळलेली खाती: {status.pigmyReconciliation.pendingCollections}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-extrabold ${status.pigmyReconciliation.isReconciled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                  {status.pigmyReconciliation.isReconciled ? '🟢 RECONCILED' : '🟡 UNVERIFIED ENTRIES'}
                </span>
              </div>
            </div>
          </div>

          {/* 9-Step Process Breakdown */}
          <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200">
            <div className="border-b pb-1 mb-2">
              <h2 className="text-xs font-bold text-primary">
                २. EOD ९-टप्प्यांची स्वयंचलित कार्यपद्धती (9-Step EOD Workflow)
              </h2>
            </div>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {stepsList.map(s => {
                const logMatch = logs.find(l => l.stepNumber === s.num);
                return (
                  <div key={s.num} className="p-1.5 rounded-sm border border-gray-200 flex items-center justify-between hover:bg-blue-50/40 transition">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px]">
                        {s.num}
                      </span>
                      <span className="text-xs font-semibold text-gray-700">{s.name}</span>
                    </div>
                    {logMatch ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold ${logMatch.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                        {logMatch.status} ({logMatch.recordsProcessed} Recs)
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-sm bg-gray-100 text-gray-500 font-medium">
                        {status.isDayClosed ? 'COMPLETED' : 'PENDING RUN'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Reopen Day (Admin) */}
      {activeTab === 'reopen' && (
        <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200 max-w-2xl">
          <div className="flex items-center space-x-2 border-b pb-1.5 mb-3">
            <span className="text-lg">🔓</span>
            <h2 className="text-xs font-bold text-primary">
              दिवस पुन्हा उघडणे (Reopen Closed Business Date - Admin Authority)
            </h2>
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-sm text-xs mb-3">
            ⚠️ <strong>ॲडमिन सूचना:</strong> मागील दिवस पुन्हा उघडल्यास बंद झालेल्या बिझनेस डेटसाठी नवीन जमा/नावे व्यवहार पोस्ट करता येतील. ही क्रिया सिस्टीम ऑडिट लॉगमध्ये नोंदवली जाईल.
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                दिवस पुन्हा उघडण्याचे सबळ कारण (Mandatory Reason - min 10 chars):
              </label>
              <textarea
                rows={3}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="उदा. मॅनेजर मंजुरीनुसार १ प्रलंबित दैनंदिन पावती पोस्ट करण्यासाठी दिवस अनलॉक केला."
                className="w-full p-2 bg-gray-50 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <button
              onClick={handleUnlockDay}
              disabled={processing}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-sm shadow-sm transition flex items-center space-x-1 disabled:opacity-50"
            >
              <span>{processing ? 'प्रक्रिया सुरू...' : '🔓 मागील बिझनेस डेट पुन्हा उघडा (Unlock Previous Day)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: EOD Audit Logs */}
      {activeTab === 'logs' && (
        <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200">
          <h2 className="text-xs font-bold text-primary border-b pb-1.5 mb-2">
            📜 दिवस अखेर बॅच प्रक्रिया अहवाल (EOD Execution Logs)
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 border border-gray-200 text-xs">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="py-1.5 px-2 text-left font-semibold">बिझनेस डेट</th>
                  <th className="py-1.5 px-2 text-center font-semibold">टप्पा</th>
                  <th className="py-1.5 px-2 text-left font-semibold">टप्प्याचे नाव</th>
                  <th className="py-1.5 px-2 text-center font-semibold">स्थिती</th>
                  <th className="py-1.5 px-2 text-right font-semibold">नोंदी (Records)</th>
                  <th className="py-1.5 px-2 text-left font-semibold">वेळ (Time)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-gray-500">
                      कोणतेही EOD लॉग सापडले नाहीत.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.logID} className="hover:bg-blue-50/50 transition-colors">
                      <td className="py-1 px-2 font-mono font-semibold text-gray-800">{new Date(log.businessDate).toLocaleDateString('en-GB')}</td>
                      <td className="py-1 px-2 text-center font-bold text-gray-700">{log.stepNumber}</td>
                      <td className="py-1 px-2 font-medium text-gray-800">{log.stepName}</td>
                      <td className="py-1 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-gray-700">{log.recordsProcessed}</td>
                      <td className="py-1 px-2 text-gray-500 font-mono">{new Date(log.startTime).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayEndDashboard;

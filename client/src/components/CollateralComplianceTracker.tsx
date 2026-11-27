import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Building2, CheckCircle2, ShieldCheck, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';

interface CollateralComplianceTrackerProps {
  onBack?: () => void;
}

const getLocalTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getBusinessDateStr = (rawDate?: string | null): string => {
  if (rawDate && typeof rawDate === 'string') {
    const clean = rawDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  return getLocalTodayStr();
};

const resolveLoanBorrowerName = (l: any): string => {
  const cust = l?.customer || l?.member?.customer;
  if (cust) {
    const full = `${cust.firstName || ''} ${cust.middleName || ''} ${cust.lastName || ''}`.replace(/\s+/g, ' ').trim();
    if (full) return full;
  }
  return l?.borrowerName || '';
};

const CollateralComplianceTracker: React.FC<CollateralComplianceTrackerProps> = ({ onBack }) => {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const API_URL = '/api/Npa';

  const defaultDate = getBusinessDateStr(user?.businessDate);

  const [logs, setLogs] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    effectiveBranch === null ? 'all' : String(effectiveBranch)
  );

  const [loanAccountId, setLoanAccountId] = useState<number | ''>('');
  const [collateralType, setCollateralType] = useState('Immovable Property');
  const [valuationDate, setValuationDate] = useState(defaultDate);
  const [valuationValue, setValuationValue] = useState('');
  const [valuersCount, setValuersCount] = useState(1);
  const [lastInspectionDate, setLastInspectionDate] = useState(defaultDate);
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState(() => {
    const d = new Date(defaultDate);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [lastStockStatementDate, setLastStockStatementDate] = useState('');
  const [isAuditorVerified, setIsAuditorVerified] = useState(false);
  const [isMarginMaintained, setIsMarginMaintained] = useState(true);

  useEffect(() => {
    axios.get('/api/Branches').then((r) => setBranches(r.data || [])).catch(() => {});
  }, []);

  const fetchData = async (bId = selectedBranchId) => {
    try {
      setLoading(true);
      const bQuery = bId && bId !== 'all' ? `?branchId=${bId}` : '';
      const [logsRes, loansRes] = await Promise.all([
        axios.get(`${API_URL}/compliance-logs${bQuery}`),
        axios.get(`/api/LoanAccounts${bQuery}`),
      ]);
      setLogs(logsRes.data || []);
      setActiveLoans((loansRes.data || []).filter((l: any) => l.status === 'Active'));
    } catch (err) {
      console.error(err);
      setError('डेटा लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedBranchId);
  }, [selectedBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!loanAccountId || !valuationValue) {
      setError('कृपया कर्ज खाते आणि तारण मूल्य प्रविष्ट करा.');
      return;
    }

    const payload = {
      loanAccountID: Number(loanAccountId),
      collateralType,
      valuationDate,
      valuationValue: Number(valuationValue),
      valuersCount,
      lastInspectionDate,
      insuranceExpiryDate,
      lastStockStatementDate: lastStockStatementDate ? lastStockStatementDate : null,
      isAuditorVerified,
      isMarginMaintained,
    };

    try {
      await axios.post(`${API_URL}/collateral-compliance`, payload);
      setMessage('✅ तारण पूर्तता नोंद यशस्वीरित्या जतन झाली!');
      setLoanAccountId('');
      setValuationValue('');
      setValuersCount(1);
      setLastStockStatementDate('');
      setIsAuditorVerified(false);
      setIsMarginMaintained(true);
      fetchData(selectedBranchId);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'नोंद जतन करताना त्रुटी आली.');
    }
  };

  const refCompareDate = new Date(defaultDate);

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto bg-slate-50/70 min-h-[calc(100vh-3.15rem)] font-sans text-xs text-slate-800 space-y-2.5">
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="h-6 px-2 rounded-sm border border-slate-300 bg-white hover:bg-primary/10 hover:text-primary hover:border-primary text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={12} />
              <span>मागे</span>
            </button>
          )}
          <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <ShieldCheck size={14} />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-primary">
              मालमत्ता तारण पूर्तता ट्रॅकर (Collateral Compliance Tracker)
            </h1>
            <p className="text-[10px] text-slate-500">
              तारण मूल्यांकन वैधता (३ वर्षे), विमा मुदत, वार्षिक पाहणी आणि मार्जिन पूर्तता नोंद
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-sm px-2 h-7">
          <Building2 size={12} className="text-primary" />
          <span className="text-[11px] font-bold text-slate-600">शाखा:</span>
          <select
            value={selectedBranchId}
            disabled={!isHOUser}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="bg-transparent text-[11px] font-bold text-slate-900 focus:outline-none"
          >
            {isHOUser && <option value="all">सर्व शाखा</option>}
            {(isHOUser || !lockedBranchId
              ? branches
              : branches.filter((b: any) => Number(b.branchID) === Number(lockedBranchId))
            ).map((b: any) => (
              <option key={b.branchID} value={String(b.branchID)}>
                {b.branchName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-1.5 rounded-sm text-[11px] font-bold flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-600" />
            {message}
          </span>
          <button onClick={() => setMessage('')} className="text-emerald-700 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 px-3 py-1.5 rounded-sm text-[11px] font-bold flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-700 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        <div className="bg-white p-3 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary h-fit space-y-2.5">
          <h3 className="text-xs font-extrabold text-primary border-b border-slate-200 pb-1">
            १. नवीन तारण पूर्तता नोंद जोडा
          </h3>
          <form onSubmit={handleSubmit} className="space-y-2.5 text-[11px]">
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">कर्ज खाते निवडा *</label>
              <select
                value={loanAccountId}
                onChange={(e) => setLoanAccountId(e.target.value ? Number(e.target.value) : '')}
                className="w-full h-7 px-2 border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-primary font-semibold"
                required
              >
                <option value="">-- कर्ज खाते निवडा --</option>
                {activeLoans.map((l: any) => {
                  const bName = resolveLoanBorrowerName(l);
                  return (
                    <option key={l.loanAccountID} value={l.loanAccountID}>
                      {l.loanAccountNo} {bName ? `- ${bName}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">तारण प्रकार</label>
              <select
                value={collateralType}
                onChange={(e) => setCollateralType(e.target.value)}
                className="w-full h-7 px-2 border border-slate-300 rounded-sm bg-white focus:outline-none focus:border-primary font-semibold"
              >
                <option value="Immovable Property">स्थावर मालमत्ता (Immovable Property)</option>
                <option value="Plant & Machinery">यंत्रसामग्री व उपकरणे (Plant &amp; Machinery)</option>
                <option value="Pledged Stock">तारण मालसाठा (Pledged Stock)</option>
                <option value="Other Exempt">सवलतपात्र (सोने / FD / LIC / NSC)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">मूल्यमापन तारीख</label>
                <input
                  type="date"
                  value={valuationDate}
                  onChange={(e) => setValuationDate(e.target.value)}
                  className="w-full h-7 px-2 border border-slate-300 rounded-sm font-mono focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">व्हॅल्युअर संख्या</label>
                <input
                  type="number"
                  min="1"
                  value={valuersCount}
                  onChange={(e) => setValuersCount(Number(e.target.value))}
                  className="w-full h-7 px-2 border border-slate-300 rounded-sm font-mono focus:outline-none focus:border-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">तारण एकूण मूल्य (₹) *</label>
              <input
                type="number"
                value={valuationValue}
                onChange={(e) => setValuationValue(e.target.value)}
                placeholder="उदा. 500000"
                className="w-full h-7 px-2 border border-slate-300 rounded-sm font-mono font-bold text-primary focus:outline-none focus:border-primary"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">पाहणी तारीख</label>
                <input
                  type="date"
                  value={lastInspectionDate}
                  onChange={(e) => setLastInspectionDate(e.target.value)}
                  className="w-full h-7 px-2 border border-slate-300 rounded-sm font-mono focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">विमा मुदत संपण्याची तारीख</label>
                <input
                  type="date"
                  value={insuranceExpiryDate}
                  onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                  className="w-full h-7 px-2 border border-slate-300 rounded-sm font-mono focus:outline-none focus:border-primary"
                  required
                />
              </div>
            </div>

            {collateralType === 'Pledged Stock' && (
              <div className="p-2 bg-primary/5 rounded-sm space-y-2 border border-primary/20">
                <div>
                  <label className="block font-bold text-slate-700 mb-0.5">मालसाठा पत्रक तारीख</label>
                  <input
                    type="date"
                    value={lastStockStatementDate}
                    onChange={(e) => setLastStockStatementDate(e.target.value)}
                    className="w-full h-7 px-2 border border-slate-300 rounded-sm bg-white font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAuditorVerified}
                    onChange={(e) => setIsAuditorVerified(e.target.checked)}
                    className="w-3.5 h-3.5 accent-primary"
                  />
                  <span>ऑडिटरद्वारे प्रमाणित (Auditor Verified)</span>
                </label>
              </div>
            )}

            {collateralType === 'Other Exempt' && (
              <label className="flex items-center gap-1.5 p-2 bg-primary/5 rounded-sm border border-primary/20 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMarginMaintained}
                  onChange={(e) => setIsMarginMaintained(e.target.checked)}
                  className="w-3.5 h-3.5 accent-primary"
                />
                <span>मार्जिन योग्य राखले आहे (Margin Maintained)</span>
              </label>
            )}

            <button
              type="submit"
              className="w-full h-8 bg-primary hover:opacity-90 text-white rounded-sm font-extrabold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save size={13} />
              <span>नोंद जतन करा (Save Compliance Log)</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-extrabold text-primary">२. तारण पूर्तता नोंदी यादी ({logs.length})</h3>
          </div>

          <div className="flex-1 overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-[11px] leading-tight whitespace-nowrap">
              <thead className="bg-slate-100 border-b-2 border-primary/30 text-slate-800 font-bold">
                <tr className="h-7">
                  <th className="py-1 px-2 border-r border-slate-200 text-left">खाते क्र.</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-left">कर्जदाराचे नाव</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-left">तारण प्रकार</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-right">मूल्य (₹)</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-center">मूल्यमापन दि.</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-center">विमा मुदत</th>
                  <th className="py-1 px-2 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 font-semibold">
                      लोड होत आहे...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-bold">
                      कोणतेही तारण पूर्तता लॉग सापडले नाहीत. (FD बोजा, सोने तारण व कर्ज मास्टरमधील तारण रक्कम आपोआप विचारात घेतली जाते.)
                    </td>
                  </tr>
                ) : (
                  logs.map((log, index) => {
                    const isInsuranceExpired = new Date(log.insuranceExpiryDate) < refCompareDate;
                    const isInspectionOld =
                      refCompareDate.getTime() - new Date(log.lastInspectionDate).getTime() >
                      365 * 24 * 60 * 60 * 1000;
                    const isValuationOld =
                      refCompareDate.getTime() - new Date(log.valuationDate).getTime() >
                      3 * 365 * 24 * 60 * 60 * 1000;
                    const isNonCompliant =
                      isInsuranceExpired || isInspectionOld || isValuationOld || !log.isMarginMaintained;

                    const bName = log.borrowerName || log.loanAccount?.borrowerName || '-';

                    return (
                      <tr key={log.collateralComplianceLogID || index} className="h-6 hover:bg-primary/10 transition-colors">
                        <td className="py-0.5 px-2 border-r border-slate-200 font-mono font-bold text-primary">
                          {log.loanAccount?.loanAccountNo || '-'}
                        </td>
                        <td className="py-0.5 px-2 border-r border-slate-200 font-semibold text-slate-900">{bName}</td>
                        <td className="py-0.5 px-2 border-r border-slate-200">{log.collateralType}</td>
                        <td className="py-0.5 px-2 border-r border-slate-200 text-right font-mono font-bold text-slate-800">
                          ₹ {Number(log.valuationValue || 0).toLocaleString('en-IN')}
                        </td>
                        <td
                          className={`py-0.5 px-2 border-r border-slate-200 text-center font-mono ${
                            isValuationOld ? 'text-rose-600 font-bold' : ''
                          }`}
                        >
                          {new Date(log.valuationDate).toLocaleDateString('en-GB')}
                        </td>
                        <td
                          className={`py-0.5 px-2 border-r border-slate-200 text-center font-mono ${
                            isInsuranceExpired ? 'text-rose-600 font-bold' : ''
                          }`}
                        >
                          {new Date(log.insuranceExpiryDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-0.5 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold ${
                              isNonCompliant
                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isNonCompliant ? 'अपूर्ण (Breached)' : 'सुसंगत (Compliant)'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollateralComplianceTracker;

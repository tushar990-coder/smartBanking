import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface CollateralComplianceTrackerProps {
  onBack?: () => void;
}

const CollateralComplianceTracker: React.FC<CollateralComplianceTrackerProps> = ({ onBack }) => {
  const API_URL = '/api/Npa';
  const [logs, setLogs] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Form Fields
  const [loanAccountId, setLoanAccountId] = useState<number | ''>('');
  const [collateralType, setCollateralType] = useState('Immovable Property');
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().split('T')[0]);
  const [valuationValue, setValuationValue] = useState('');
  const [valuersCount, setValuersCount] = useState(1);
  const [lastInspectionDate, setLastInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState(new Date().toISOString().split('T')[0]);
  const [lastStockStatementDate, setLastStockStatementDate] = useState('');
  const [isAuditorVerified, setIsAuditorVerified] = useState(false);
  const [isMarginMaintained, setIsMarginMaintained] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [logsRes, loansRes] = await Promise.all([
        axios.get(`${API_URL}/compliance-logs`),
        axios.get('/api/LoanAccounts')
      ]);
      setLogs(logsRes.data);
      setActiveLoans(loansRes.data.filter((l: any) => l.status === 'Active'));
    } catch (err) {
      console.error(err);
      setMessage('डेटा लोड करताना त्रुटी आली. (Error loading data.)');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanAccountId || !valuationValue) {
      alert('कृपया कर्ज खाते आणि तारण मूल्य प्रविष्ट करा. (Please select loan and enter valuation value.)');
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
      isMarginMaintained
    };

    try {
      await axios.post(`${API_URL}/collateral-compliance`, payload);
      setMessage('नोंद यशस्वीरित्या जतन केली! (Log entry saved successfully!)');
      // Reset form
      setLoanAccountId('');
      setValuationValue('');
      setValuersCount(1);
      setLastStockStatementDate('');
      setIsAuditorVerified(false);
      setIsMarginMaintained(true);
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage('नोंद जतन करताना त्रुटी आली. (Error saving log entry.)');
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <button onClick={onBack} className="text-gray-600 hover:text-gray-900 font-semibold text-xs flex items-center gap-1.5 mb-2 focus:outline-none">
            ← मागे (Back)
          </button>
          <h1 className="text-xl font-bold text-gray-800">मालमत्ता तारण पूर्तता ट्रॅकर (Collateral Compliance Tracker)</h1>
          <p className="text-xs text-gray-500 mt-1">तारण ऑडिट, विमा मुदत, वार्षिक पाहणी आणि मार्जिन देखरेख</p>
        </div>
      </div>

      {message && (
        <div className="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-3 rounded-xl text-xs font-medium flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-blue-500 hover:text-blue-700">✕</button>
        </div>
      )}

      {/* Main Grid: Form on Left, List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit space-y-4">
          <h3 className="text-xs font-bold text-gray-800 border-b pb-2 uppercase">नवीन पूर्तता लॉग जोडा (Add Compliance Log)</h3>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
            <div className="space-y-1">
              <label className="text-gray-500 font-bold">कर्ज खाते निवडा (Select Loan Account)</label>
              <select
                value={loanAccountId}
                onChange={(e) => setLoanAccountId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- कर्ज खाते निवडा --</option>
                {activeLoans.map((l: any) => (
                  <option key={l.loanAccountID} value={l.loanAccountID}>
                    {l.loanAccountNo} - {l.member?.firstName} {l.member?.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-gray-500 font-bold">तारण प्रकार (Collateral Type)</label>
              <select
                value={collateralType}
                onChange={(e) => setCollateralType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Immovable Property">स्थावर मालमत्ता (Immovable Property)</option>
                <option value="Plant & Machinery">यंत्रसामग्री व उपकरणे (Plant & Machinery)</option>
                <option value="Pledged Stock">तारण मालसाठा (Pledged Stock)</option>
                <option value="Other Exempt">सवलतपात्र (सोने/एफडी/एलआयसी/इतर)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-500 font-bold">मूल्यमापन तारीख (Valuation Date)</label>
                <input
                  type="date"
                  value={valuationDate}
                  onChange={(e) => setValuationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-500 font-bold">व्हॅल्युअर संख्या (Valuers Count)</label>
                <input
                  type="number"
                  min="1"
                  value={valuersCount}
                  onChange={(e) => setValuersCount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-gray-500 font-bold">तारण एकूण मूल्य (Valuation Amount) (₹)</label>
              <input
                type="number"
                value={valuationValue}
                onChange={(e) => setValuationValue(e.target.value)}
                placeholder="उदा. ५०००००"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-500 font-bold">पाहणी तारीख (Inspection Date)</label>
                <input
                  type="date"
                  value={lastInspectionDate}
                  onChange={(e) => setLastInspectionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-500 font-bold">विमा मुदत संपण्याची तारीख (Insurance Expiry)</label>
                <input
                  type="date"
                  value={insuranceExpiryDate}
                  onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {collateralType === 'Pledged Stock' && (
              <div className="p-3 bg-gray-50 rounded-xl space-y-3 border border-gray-100">
                <div className="space-y-1">
                  <label className="text-gray-500 font-bold">मालसाठा पत्रक तारीख (Stock Statement Date)</label>
                  <input
                    type="date"
                    value={lastStockStatementDate}
                    onChange={(e) => setLastStockStatementDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={isAuditorVerified}
                    onChange={(e) => setIsAuditorVerified(e.target.checked)}
                    id="auditor_check"
                    className="h-4 w-4 rounded text-blue-600 border-gray-300"
                  />
                  <label htmlFor="auditor_check" className="text-gray-600 font-bold select-none cursor-pointer">
                    ऑडिटरद्वारे प्रमाणित (Auditor Verified)?
                  </label>
                </div>
              </div>
            )}

            {collateralType === 'Other Exempt' && (
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                <input
                  type="checkbox"
                  checked={isMarginMaintained}
                  onChange={(e) => setIsMarginMaintained(e.target.checked)}
                  id="margin_check"
                  className="h-4 w-4 rounded text-blue-600 border-gray-300"
                />
                <label htmlFor="margin_check" className="text-gray-600 font-bold select-none cursor-pointer">
                  मार्जिन योग्य राखले आहे (Margin Maintained)?
                </label>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-all"
            >
              नोंद जतन करा (Save Log)
            </button>
          </form>
        </div>

        {/* List Logs */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-xs font-bold text-gray-800 border-b pb-2 uppercase mb-4">नोंद यादी (Compliance Logs List)</h3>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-[11px] font-medium text-gray-600">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-left">
                  <th className="p-3">खाते क्र. (Loan No)</th>
                  <th className="p-3">नाव (Member)</th>
                  <th className="p-3">तारण प्रकार (Type)</th>
                  <th className="p-3">मूल्य (Value)</th>
                  <th className="p-3">मूल्यमापन तारीख (Valuation Date)</th>
                  <th className="p-3">विमा मुदत (Insurance Expiry)</th>
                  <th className="p-3">स्थिती (Status)</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 text-xs font-bold">कोणतेही तारण लॉग सापडले नाहीत.</td>
                  </tr>
                ) : (
                  logs.map((log, index) => {
                    // Compliance calculations
                    const isInsuranceExpired = new Date(log.insuranceExpiryDate) < new Date();
                    const isInspectionOld = (new Date().getTime() - new Date(log.lastInspectionDate).getTime()) > (365 * 24 * 60 * 60 * 1000);
                    const isValuationOld = (new Date().getTime() - new Date(log.valuationDate).getTime()) > (3 * 365 * 24 * 60 * 60 * 1000);
                    const isNonCompliant = isInsuranceExpired || isInspectionOld || isValuationOld || !log.isMarginMaintained;

                    return (
                      <tr key={index} className="border-b hover:bg-gray-50/50 transition-colors">
                        <td className="p-3 font-bold text-gray-800">{log.loanAccount?.loanAccountNo}</td>
                        <td className="p-3">{log.loanAccount?.member?.firstName} {log.loanAccount?.member?.lastName}</td>
                        <td className="p-3">{log.collateralType}</td>
                        <td className="p-3 font-bold text-gray-700">₹ {log.valuationValue.toLocaleString('mr-IN')}</td>
                        <td className={`p-3 ${isValuationOld ? 'text-red-600 font-bold' : ''}`}>
                          {new Date(log.valuationDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className={`p-3 ${isInsuranceExpired ? 'text-red-600 font-bold' : ''}`}>
                          {new Date(log.insuranceExpiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                            isNonCompliant ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
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


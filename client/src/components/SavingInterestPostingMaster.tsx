import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface CalculatedInterest {
  savingAccountID: number;
  accountNo: string;
  memberName: string;
  currentBalance: number;
  interestRate: number;
  calculatedInterest: number;
}

interface InterestPostingHistory {
  postingID: number;
  financialYearCode: string;
  periodStart: string;
  periodEnd: string;
  totalInterest: number;
  postedOn: string;
}

const SavingInterestPostingMaster: React.FC = () => {
  const [history, setHistory] = useState<InterestPostingHistory[]>([]);
  const [calculationResults, setCalculationResults] = useState<CalculatedInterest[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [dateRange, setDateRange] = useState({
    periodStart: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0],
    periodEnd: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0]
  });

  const API_URL = '/api/SavingInterestPostings';

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(API_URL);
      setHistory(response.data);
    } catch (err) {
      console.error('Error fetching posting history', err);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setCalculationResults([]);

    try {
      const response = await axios.post(`${API_URL}/calculate`, dateRange);
      setCalculationResults(response.data);
      if (response.data.length === 0) {
        setSuccess('या कालावधीसाठी कोणतेही व्याज देय नाही.');
      }
    } catch (err: any) {
      setError(err.response?.data || 'An error occurred during calculation.');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!window.confirm("तुम्हाला खात्री आहे का की हे व्याज सर्व बचत खात्यांवर जमा करायचे आहे?")) return;
    
    setPosting(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(`${API_URL}/post`, {
        ...dateRange,
        postedBy: 1
      });
      setSuccess(response.data.message);
      setCalculationResults([]);
      fetchHistory();
    } catch (err: any) {
      setError(err.response?.data || 'An error occurred during posting.');
    } finally {
      setPosting(false);
    }
  };

  const totalCalculated = calculationResults.reduce((sum, item) => sum + item.calculatedInterest, 0);

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
      {/* Title Header */}
      <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1">
        <h1 className="text-lg font-bold text-gray-800">बचत व्याज आकारणी (Saving Interest Calculation & Posting)</h1>
      </div>

      {/* Date Filter Form */}
      <div className="bg-white p-1.5 rounded-sm shadow-sm border border-gray-200 mb-3">
        <h2 className="text-sm font-bold text-primary mb-1 border-b pb-0.5">व्याज आकारणी कालावधी निवडा (Select Calculation Period)</h2>
        
        {error && (
          <div className="mb-2 bg-red-50 text-red-600 px-2 py-1 rounded-sm text-xs border border-red-100">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-2 bg-green-50 text-green-600 px-2 py-1 rounded-sm text-xs border border-green-100">
            {success}
          </div>
        )}

        <form onSubmit={handleCalculate} className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-1.5 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">पासून तारीख (Start Date) *</label>
            <input
              type="date"
              name="periodStart"
              value={dateRange.periodStart}
              onChange={handleDateChange}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">पर्यंत तारीख (End Date) *</label>
            <input
              type="date"
              name="periodEnd"
              value={dateRange.periodEnd}
              onChange={handleDateChange}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs"
              required
            />
          </div>

          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={loading || posting}
              className="bg-primary hover:bg-[#004a75] text-white px-6 py-1 rounded-sm font-medium shadow-sm transition-colors text-xs disabled:opacity-50"
            >
              {loading ? 'मोजत आहे...' : 'व्याज मोजा (Calculate Interest)'}
            </button>

            {calculationResults.length > 0 && (
              <button
                type="button"
                onClick={handlePost}
                disabled={posting}
                className="bg-green-700 hover:bg-green-800 text-white px-6 py-1 rounded-sm font-medium shadow-sm transition-colors text-xs disabled:opacity-50"
              >
                {posting ? 'जमा करत आहे...' : `व्याज जमा करा (Post ₹${totalCalculated.toFixed(2)})`}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Preview Section */}
      {calculationResults.length > 0 && (
        <div className="bg-white p-1.5 rounded-sm shadow-sm border border-gray-200 mb-3">
          <div className="flex justify-between items-center mb-1 border-b pb-0.5">
            <h3 className="text-sm font-bold text-primary">व्याज आकारणी पडताळणी (Calculation Preview)</h3>
            <span className="text-xs font-bold text-gray-700">एकूण व्याज: ₹{totalCalculated.toFixed(2)}</span>
          </div>

          <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-200 rounded-sm">
            <table className="min-w-full divide-y divide-gray-200 text-xs text-center">
              <thead className="bg-gray-100 text-gray-700 sticky top-0">
                <tr>
                  <th className="px-2 py-1 border-r border-gray-300 font-medium text-left">खाते क्र. (A/c No)</th>
                  <th className="px-2 py-1 border-r border-gray-300 font-medium text-left">नाव (Member Name)</th>
                  <th className="px-2 py-1 border-r border-gray-300 font-medium text-right">सध्याची शिल्लक (Balance)</th>
                  <th className="px-2 py-1 border-r border-gray-300 font-medium text-center">व्याजदर %</th>
                  <th className="px-2 py-1 font-medium text-right">आकारलेले व्याज (Interest)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {calculationResults.map((item) => (
                  <tr key={item.savingAccountID} className="hover:bg-gray-50">
                    <td className="px-2 py-0.5 border-r border-gray-200 text-left font-medium text-primary">{item.accountNo}</td>
                    <td className="px-2 py-0.5 border-r border-gray-200 text-left">{item.memberName}</td>
                    <td className="px-2 py-0.5 border-r border-gray-200 text-right">₹{item.currentBalance.toFixed(2)}</td>
                    <td className="px-2 py-0.5 border-r border-gray-200 text-center">{item.interestRate}%</td>
                    <td className="px-2 py-0.5 text-right font-bold text-emerald-600">₹{item.calculatedInterest.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Grid */}
      <div className="mt-3">
        <h2 className="text-sm font-bold text-gray-800 mb-1 border-b pb-0.5">व्याज आकारणी इतिहास (Interest Posting Run History)</h2>
        <div className="overflow-x-auto bg-white rounded-sm shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-xs text-center">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">आर्थिक वर्ष (Financial Year)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">पासून तारीख (Start Date)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">पर्यंत तारीख (End Date)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-right">एकूण व्याज (Total Posted)</th>
                <th className="px-2 py-1.5 font-medium text-center">केव्हा जतन झाले (Posted On)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    कोणताही इतिहास आढळला नाही.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.postingID} className="hover:bg-gray-50">
                    <td className="px-2 py-1 border-r border-gray-200 text-left font-medium text-primary">{h.financialYearCode}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left">{new Date(h.periodStart).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left">{new Date(h.periodEnd).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-right font-bold text-green-700">₹{h.totalInterest.toFixed(2)}</td>
                    <td className="px-2 py-1 text-center">{new Date(h.postedOn).toLocaleString('en-GB')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SavingInterestPostingMaster;


import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';

interface SavingAccount {
  savingAccountID: number;
  accountNo: string;
  cifNo?: string;
  customerID?: number;
  customerName?: string;
  memberID?: number;
  memberName?: string;
  currentBalance: number;
  minimumBalance: number;
  status: string;
}

interface SavingAccountClosing {
  closingID: number;
  accountNo: string;
  cifNo?: string;
  customerName?: string;
  memberName?: string;
  closureDate: string;
  grossBalance: number;
  closingCharges: number;
  netPayable: number;
  paymentMode: string;
  voucherNo?: string;
}

const SavingAccountClosingMaster: React.FC = () => {
  const [activeAccounts, setActiveAccounts] = useState<SavingAccount[]>([]);
  const [closings, setClosings] = useState<SavingAccountClosing[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavingAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    savingAccountID: 0,
    closureDate: new Date().toISOString().split('T')[0],
    closingCharges: '0',
    paymentMode: 'Cash'
  });

  const API_URL = '/api';

  useEffect(() => {
    fetchActiveAccounts();
    fetchClosings();
  }, []);

  const fetchActiveAccounts = async () => {
    try {
      const response = await axios.get(`${API_URL}/SavingAccounts`);
      // Only filter active accounts
      const active = response.data.filter((a: any) => a.status === 'Active');
      setActiveAccounts(active);

      const params = new URLSearchParams(window.location.search);
      const customerIdStr = params.get('customerId') || params.get('customerID');
      const memberIdStr = params.get('memberId');
      const accountIdStr = params.get('accountId') || params.get('savingAccountId');

      let matchedAcc: any = null;
      if (accountIdStr) {
        const accId = parseInt(accountIdStr, 10);
        matchedAcc = active.find((a: any) => a.savingAccountID === accId);
      } else if (customerIdStr) {
        const cId = parseInt(customerIdStr, 10);
        matchedAcc = active.find((a: any) => a.customerID === cId);
      } else if (memberIdStr) {
        const mId = parseInt(memberIdStr, 10);
        matchedAcc = active.find((a: any) => a.customerID === mId || a.memberID === mId);
      }

      if (matchedAcc) {
        setFormData((prev) => ({ ...prev, savingAccountID: matchedAcc.savingAccountID }));
        setSelectedAccount(matchedAcc);
      }
    } catch (err) {
      console.error('Error fetching accounts', err);
    }
  };

  const fetchClosings = async () => {
    try {
      const response = await axios.get(`${API_URL}/SavingAccountClosings`);
      setClosings(response.data);
    } catch (err) {
      console.error('Error fetching closings', err);
    }
  };

  const handleAccountChange = (e: any) => {
    const accountId = parseInt(e.target.value);
    setFormData((prev) => ({ ...prev, savingAccountID: accountId }));
    const acc = activeAccounts.find(a => a.savingAccountID === accountId) || null;
    setSelectedAccount(acc);
    setError('');
    setSuccess('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.savingAccountID) {
      setError('कृपया बंद करण्यासाठी बचत खाते निवडा.');
      return;
    }

    const charges = parseFloat(formData.closingCharges || '0');
    if (selectedAccount && selectedAccount.currentBalance < charges) {
      setError('खात्यातील शिल्लक चार्जेसपेक्षा कमी आहे.');
      return;
    }

    if (!window.confirm("तुम्हाला खात्री आहे का की हे खाते कायमचे बंद करायचे आहे?")) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post(`${API_URL}/SavingAccountClosings`, {
        savingAccountID: formData.savingAccountID,
        closureDate: formData.closureDate,
        closingCharges: charges,
        paymentMode: formData.paymentMode,
        createdBy: 1
      });

      setSuccess('खाते यशस्वीरित्या बंद करण्यात आले आहे व अंतिम सेटलमेंट पूर्ण झाली आहे!');
      setFormData({
        savingAccountID: 0,
        closureDate: new Date().toISOString().split('T')[0],
        closingCharges: '0',
        paymentMode: 'Cash'
      });
      setSelectedAccount(null);
      fetchActiveAccounts();
      fetchClosings();
    } catch (err: any) {
      setError(err.response?.data || 'An error occurred during closure.');
    } finally {
      setLoading(false);
    }
  };

  const grossBalance = selectedAccount ? selectedAccount.currentBalance : 0;
  const closingCharges = parseFloat(formData.closingCharges || '0');
  const netPayable = Math.max(0, grossBalance - closingCharges);

  const accountOptions = activeAccounts.map(a => {
    const cifPart = a.cifNo ? ` [CIF: ${a.cifNo}]` : '';
    const namePart = a.customerName || a.memberName || 'अज्ञात';
    return {
      value: a.savingAccountID,
      label: `${a.accountNo}${cifPart} - ${namePart} (शिल्लक: ₹${a.currentBalance.toFixed(2)})`
    };
  });

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
      {/* Title Header */}
      <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1">
        <h1 className="text-lg font-bold text-gray-800">बचत खाते बंद करणे (Saving Account Closing)</h1>
      </div>

      {/* Main Content Form */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
        <div className="md:col-span-3 bg-white p-1.5 rounded-sm shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-primary mb-1 border-b pb-0.5">खाते बंद तपशील (Account Closure Details)</h2>

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

          <form onSubmit={handleSubmit} className="space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-1.5 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-0.5">बचत खाते निवडा *</label>
                <SearchableSelect
                  options={accountOptions}
                  value={formData.savingAccountID}
                  onChange={handleAccountChange}
                  name="savingAccountID"
                  placeholder="-- खाते निवडा --"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-0.5">बंद करण्याची तारीख *</label>
                <input
                  type="date"
                  name="closureDate"
                  value={formData.closureDate}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-0.5">खाते बंद चार्जेस (Closing Charges - ₹)</label>
                <input
                  type="number"
                  name="closingCharges"
                  value={formData.closingCharges}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-0.5">पेमेंट पद्धत (Payment Mode)</label>
                <select
                  name="paymentMode"
                  value={formData.paymentMode}
                  onChange={handleInputChange}
                  className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs bg-white"
                >
                  <option value="Cash">रोख (Cash)</option>
                  <option value="Transfer">हस्तांतरण (Transfer)</option>
                  <option value="Bank">बँक (Bank)</option>
                </select>
              </div>

              <div className="md:col-span-2 flex justify-between items-center bg-gray-50 border p-2 rounded-sm text-xs mt-1.5">
                <div>
                  <span className="text-gray-500 font-semibold">एकूण शिल्लक (Gross Bal):</span>
                  <span className="font-bold text-gray-800 ml-1">₹{grossBalance.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-semibold">देय रक्कम (Net Payable):</span>
                  <span className="font-bold text-red-600 ml-1">₹{netPayable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={loading || !selectedAccount}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-1 rounded-sm text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'प्रक्रिया सुरू आहे...' : 'खाते बंद करा व रक्कम द्या (Confirm Closure)'}
              </button>
            </div>
          </form>
        </div>

        {/* Selected Account Info */}
        <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="bg-primary text-white px-2 py-1 text-xs font-bold">
            खाते माहिती (Account Details)
          </div>
          <div className="p-2 flex-1 flex flex-col justify-center space-y-2 text-xs text-gray-700">
            {selectedAccount ? (
              <div className="space-y-1.5">
                <div>
                  <span className="font-semibold text-gray-500">खातेदार:</span>
                  <p className="font-bold text-sm text-primary truncate">{selectedAccount.customerName || selectedAccount.memberName}</p>
                  {selectedAccount.cifNo && (
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 font-mono">
                      CIF: {selectedAccount.cifNo}
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-semibold text-gray-500">खाते क्र.:</span>
                  <p className="font-bold">{selectedAccount.accountNo}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-500">किमान शिल्लक मर्यादा:</span>
                  <p className="font-medium">₹{selectedAccount.minimumBalance.toFixed(2)}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <p>माहिती पाहण्यासाठी खाते निवडा</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Closure History Grid */}
      <div className="mt-3">
        <h2 className="text-sm font-bold text-gray-800 mb-1 border-b pb-0.5">बंद केलेल्या खात्यांची यादी (Closed Accounts History)</h2>
        <div className="overflow-x-auto bg-white rounded-sm shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-xs text-center">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">खाते क्र. (A/c No)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">नाव (Customer Name)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">बंद तारीख (Closure Date)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-right">एकूण शिल्लक (Gross Bal)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-right">चार्जेस (Charges)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-right">दिलेली रक्कम (Paid Amt)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-center">पद्धत (Mode)</th>
                <th className="px-2 py-1.5 font-medium text-center">व्हाउचर (Voucher No)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {closings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                    कोणतेही खाते बंद केल्याची नोंद नाही.
                  </td>
                </tr>
              ) : (
                closings.map((c) => (
                  <tr key={c.closingID} className="hover:bg-gray-50">
                    <td className="px-2 py-1 border-r border-gray-200 text-left font-medium text-red-600">{c.accountNo}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left">{c.customerName || c.memberName}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-left">
                      {new Date(c.closureDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-2 py-1 border-r border-gray-200 text-right">₹{c.grossBalance.toFixed(2)}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-right text-red-500">₹{c.closingCharges.toFixed(2)}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-right font-bold text-gray-800">₹{c.netPayable.toFixed(2)}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-center">{c.paymentMode}</td>
                    <td className="px-2 py-1 text-center font-medium text-blue-700">{c.voucherNo || '-'}</td>
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

export default SavingAccountClosingMaster;


import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';
import { RotateCcw, Trash2, CheckCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SavingAccount {
  savingAccountID: number;
  accountNo: string;
  cifNo?: string;
  customerID?: number;
  customerName?: string;
  currentBalance: number;
  minimumBalance: number;
  status: string;
}

interface SavingAccountClosing {
  closingID: number;
  accountNo: string;
  cifNo?: string;
  customerName?: string;
  closureDate: string;
  grossBalance: number;
  closingCharges: number;
  netPayable: number;
  paymentMode: string;
  voucherNo?: string;
}

interface SavingAccountClosingMasterProps {
  voucherId?: number;
  isReadOnly?: boolean;
  onNavigate?: (tab: string, params?: any) => void;
}

const SavingAccountClosingMaster: React.FC<SavingAccountClosingMasterProps> = ({ voucherId, isReadOnly, onNavigate }) => {
  const queryParams = new URLSearchParams(window.location.search);
  const voucherIdFromUrl = voucherId || (queryParams.get('voucherId') ? Number(queryParams.get('voucherId')) : undefined);
  const isPassingMode = Boolean(isReadOnly || queryParams.get('passingMode') === 'true');

  const [passingVoucher, setPassingVoucher] = useState<any>(null);
  const [passingActionLoading, setPassingActionLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { user } = useAuth();

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

  // Voucher Passing Mode: Load Closing Details linked to Voucher
  useEffect(() => {
    if (!isPassingMode || !voucherIdFromUrl) return;

    const loadPassingClosing = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/SavingAccountClosings/by-voucher/${voucherIdFromUrl}`);
        const d = res.data;
        if (!d) return;

        setPassingVoucher(d.voucher);
        setFormData({
          savingAccountID: d.savingAccountID || d.savingAccount?.savingAccountID || 0,
          closureDate: d.closureDate ? d.closureDate.split('T')[0] : new Date().toISOString().split('T')[0],
          closingCharges: String(d.closingCharges || '0'),
          paymentMode: d.paymentMode || 'Cash'
        });

        if (d.savingAccount) {
          setSelectedAccount({
            savingAccountID: d.savingAccount.savingAccountID,
            accountNo: d.savingAccount.accountNo,
            customerName: d.savingAccount.customer?.fullName || '',
            cifNo: d.savingAccount.customer?.cifNo || '',
            currentBalance: d.grossBalance || d.savingAccount.currentBalance || 0,
            minimumBalance: 0,
            status: 'Closed'
          });
        }
      } catch (err) {
        console.error('Failed to load saving account closing for passing:', err);
        setError('बचत खाते बंद तपशील लोड करताना त्रुटी आली.');
      } finally {
        setLoading(false);
      }
    };

    loadPassingClosing();
  }, [isPassingMode, voucherIdFromUrl]);

  const fetchActiveAccounts = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      let customerIdStr = params.get('customerId') || params.get('customerID');
      let accountIdStr = params.get('accountId') || params.get('savingAccountId');

      if (!customerIdStr && !accountIdStr) {
        try {
          const rawBridge = sessionStorage.getItem('cbs_active_customer_transfer');
          if (rawBridge) {
            sessionStorage.removeItem('cbs_active_customer_transfer');
            const bridgeData = JSON.parse(rawBridge);
            if (bridgeData) {
              customerIdStr = bridgeData.customerId ? String(bridgeData.customerId) : null;
              accountIdStr = bridgeData.savingAccountId || bridgeData.accountId ? String(bridgeData.savingAccountId || bridgeData.accountId) : null;
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      let fastTrackDone = false;
      const targetAccId = accountIdStr ? parseInt(accountIdStr, 10) : 0;
      const cId = customerIdStr ? parseInt(customerIdStr, 10) : 0;

      // ⚡ FAST-TRACK 1: Direct targeted account ID lookup (~15-20ms)
      if (targetAccId > 0) {
        try {
          const singleRes = await axios.get(`${API_URL}/SavingAccounts/${targetAccId}`);
          if (singleRes.data && singleRes.data.savingAccountID) {
            const acc = singleRes.data;
            setActiveAccounts([acc]);
            setFormData((prev) => ({ ...prev, savingAccountID: acc.savingAccountID }));
            setSelectedAccount(acc);
            fastTrackDone = true;
          }
        } catch (e) {
          console.warn('Fast-track account lookup failed, falling back', e);
        }
      }
      // ⚡ FAST-TRACK 2: Direct targeted customer ID lookup (~20-30ms)
      else if (cId > 0) {
        try {
          const custRes = await axios.get(`${API_URL}/SavingAccounts?customerId=${cId}`);
          const active = (custRes.data || []).filter((a: any) => a.status === 'Active');
          if (active.length > 0) {
            setActiveAccounts(active);
            setFormData((prev) => ({ ...prev, savingAccountID: active[0].savingAccountID }));
            setSelectedAccount(active[0]);
            fastTrackDone = true;
          }
        } catch (e) {
          console.warn('Fast-track customer lookup failed, falling back', e);
        }
      }

      if (!fastTrackDone) {
        const response = await axios.get(`${API_URL}/SavingAccounts`);
        const active = response.data.filter((a: any) => a.status === 'Active');
        setActiveAccounts(active);
      } else {
        // Load full dropdown list in background lazily
        axios.get(`${API_URL}/SavingAccounts`).then(res => {
          if (Array.isArray(res.data)) {
            const active = res.data.filter((a: any) => a.status === 'Active');
            setActiveAccounts(prev => {
              const map = new Map<number, any>();
              prev.forEach(a => map.set(a.savingAccountID, a));
              active.forEach((a: any) => map.set(a.savingAccountID, a));
              return Array.from(map.values());
            });
          }
        }).catch(e => console.error(e));
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
        createdBy: user?.userID || 1
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
    const namePart = a.customerName || 'अज्ञात';
    return {
      value: a.savingAccountID,
      label: `${a.accountNo}${cifPart} - ${namePart} (शिल्लक: ₹${a.currentBalance.toFixed(2)})`
    };
  });

  const handlePassVoucher = async () => {
    const vId = passingVoucher?.voucherID || voucherIdFromUrl;
    const vNo = passingVoucher?.voucherNo || `Voucher #${vId}`;
    if (!vId) return;

    if (!window.confirm(`तुम्हाला बचत खाते बंद व्हाउचर क्र. ${vNo} पास व मंजूर करायचे आहे का?`)) {
      return;
    }

    setPassingActionLoading(true);
    try {
      const payload = {
        voucherIds: [Number(vId)],
        approvedBy: user?.userID || 1
      };

      const res = await fetch('/api/VoucherPosting/Post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const scrollInfo = data.results && data.results[0] ? ` (Scroll No: ${data.results[0].scrollNo})` : '';
        alert(`बचत खाते बंद व्हाउचर क्र. ${vNo} यशस्वीरीत्या पास करण्यात आले!${scrollInfo}`);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        const errText = await res.text();
        alert(`त्रुटी: ${errText}`);
      }
    } catch (e) {
      alert('व्हाउचर पास करताना नेटवर्क त्रुटी आली.');
    } finally {
      setPassingActionLoading(false);
    }
  };

  const handleRejectVoucher = async () => {
    const vId = passingVoucher?.voucherID || voucherIdFromUrl;
    const vNo = passingVoucher?.voucherNo || `Voucher #${vId}`;
    if (!vId) return;
    if (!rejectionReason.trim()) {
      alert('कृपया नामंजूर करण्याचे कारण लिहा.');
      return;
    }

    setPassingActionLoading(true);
    try {
      const res = await fetch(`/api/VoucherPosting/${vId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectionReason.trim(),
          userId: user?.userID || 1,
          username: user?.username || 'Admin',
          userRole: user?.roleName || user?.role || 'Admin'
        })
      });

      const resData = await res.json().catch(() => null);
      if (res.ok) {
        alert(resData?.message || `बचत खाते बंद व्हाउचर क्र. ${vNo} नामंजूर / रद्द करण्यात आले.`);
        setRejectModalOpen(false);
        if (onNavigate) {
          onNavigate('voucher-posting');
        } else {
          window.location.href = '/?tab=voucher-posting';
        }
      } else {
        alert(resData?.message || resData || 'व्हाउचर नामंजूर करताना त्रुटी आली.');
      }
    } catch (e) {
      alert('व्हाउचर नामंजूर करताना नेटवर्क त्रुटी आली.');
    } finally {
      setPassingActionLoading(false);
    }
  };

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
      {/* Passing Checker Banner */}
      {isPassingMode && (
        <div className="mb-3 bg-amber-50 border-2 border-amber-400 rounded-sm p-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <div className="font-bold text-amber-950 text-xs">
                ⚠️ व्हाउचर पासिंग तपासणी मोड (Checker Verification Mode) - पूर्णपणे केवळ वाचन (Read-Only)
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-mono border border-amber-300">
                व्हाउचर क्र.: {passingVoucher?.voucherNo || voucherIdFromUrl}
              </span>
              <span className="text-amber-800">
                अंतिम देय रक्कम: <b>₹{netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b>
              </span>
              <span className="bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded">
                प्रकार: बचत खाते बंद (Account Closure)
              </span>
            </div>
          </div>
        </div>
      )}

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
            <fieldset disabled={isPassingMode} className="space-y-1.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-1.5 items-end">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-0.5">बचत खाते निवडा *</label>
                <SearchableSelect
                  options={accountOptions}
                  value={formData.savingAccountID}
                  onChange={handleAccountChange}
                  name="savingAccountID"
                  disabled={isPassingMode}
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
            </fieldset>

            <div className="flex justify-end gap-2 items-center pt-1">
              {isPassingMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate ? onNavigate('voucher-posting') : window.location.href = '/?tab=voucher-posting'}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                    <span>पासिंग यादीवर परत जा (Back)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(true)}
                    disabled={passingActionLoading}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>व्हाउचर नामंजूर / रद्द करा (Reject)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePassVoucher}
                    disabled={passingActionLoading}
                    className="px-6 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{passingActionLoading ? 'पास होत आहे...' : 'खाते बंद व्हाउचर पास करा (Approve & Pass)'}</span>
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !selectedAccount}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-1 rounded-sm text-xs font-medium shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'प्रक्रिया सुरू आहे...' : 'खाते बंद करा व रक्कम द्या (Confirm Closure)'}
                </button>
              )}
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
                  <p className="font-bold text-sm text-primary truncate">{selectedAccount.customerName}</p>
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
                    <td className="px-2 py-1 border-r border-gray-200 text-left">{c.customerName || 'अज्ञात'}</td>
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

      {/* Rejection Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-md shadow-2xl max-w-md w-full overflow-hidden border border-rose-200">
            <div className="bg-rose-600 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>बचत खाते बंद व्हाउचर नामंजूर / रद्द करणे (Reject Voucher)</span>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="text-white hover:bg-rose-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-slate-700 font-medium">
                व्हाउचर क्र.: <b className="font-mono text-slate-900">{passingVoucher?.voucherNo || voucherIdFromUrl}</b>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  नामंजूर करण्याचे कारण (Reason for Rejection) *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="उदा. चुकीचे खाते, चार्जेस मोजणीत त्रुटी, संशयास्पद विनंती इत्यादी..."
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
                >
                  रद्द करा (Cancel)
                </button>
                <button
                  type="button"
                  onClick={handleRejectVoucher}
                  disabled={passingActionLoading || !rejectionReason.trim()}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{passingActionLoading ? 'रद्द होत आहे...' : 'खात्रीपूर्वक नामंजूर करा'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavingAccountClosingMaster;


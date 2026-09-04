import React, { useState, useEffect } from 'react';

interface VoucherDetail {
  voucherDetailID: number;
  ledgerID: number;
  drCr: string;
  amount: number;
  narration: string;
  ledger: { ledgerName: string };
}

interface Voucher {
  voucherID: number;
  voucherNo: string;
  voucherDate: string;
  voucherType: string;
  narration: string;
  totalAmount: number;
  status: string;
  voucherDetails: VoucherDetail[];
}

const VoucherApproval: React.FC = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchPendingVouchers();
  }, []);

  const fetchPendingVouchers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/Vouchers?status=Pending');
      if (res.ok) {
        const data = await res.json();
        setVouchers(data);
      } else {
        setMessage('Failed to load pending vouchers.');
      }
    } catch (error) {
      setMessage('Network Error.');
    }
    setLoading(false);
  };

  const handleApprove = async (id: number) => {
    if (!window.confirm('Are you sure you want to approve this voucher? It will reflect in the Daybook immediately.')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/Vouchers/${id}/Approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 1 }) // Hardcoded manager ID for now
      });

      if (res.ok) {
        setMessage(`Voucher approved successfully.`);
        fetchPendingVouchers();
      } else {
        const error = await res.text();
        setMessage(`Error: ${error}`);
      }
    } catch (error) {
      setMessage('Network Error.');
    }
    setLoading(false);
  };

  const openRejectModal = (id: number) => {
    setSelectedVoucherId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!selectedVoucherId || !rejectReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/Vouchers/${selectedVoucherId}/Reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectedBy: 1, reason: rejectReason })
      });

      if (res.ok) {
        setMessage(`Voucher rejected.`);
        setRejectModalOpen(false);
        fetchPendingVouchers();
      } else {
        const error = await res.text();
        setMessage(`Error: ${error}`);
      }
    } catch (error) {
      setMessage('Network Error.');
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">वाउचर पासिंग (Voucher Passing)</h2>
        <button 
          onClick={fetchPendingVouchers}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Refresh List
        </button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded font-medium ${message.includes('Error') || message.includes('Failed') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {message}
        </div>
      )}

      {loading && vouchers.length === 0 ? (
        <div className="text-center py-10">Loading pending vouchers...</div>
      ) : vouchers.length === 0 ? (
        <div className="bg-white p-8 rounded shadow text-center text-gray-500">
          <p className="text-xl">No pending vouchers awaiting approval.</p>
          <p className="text-sm mt-2">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {vouchers.map(v => (
            <div key={v.voucherID} className="bg-white rounded shadow border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-800 mr-4">{v.voucherNo}</span>
                  <span className="text-sm text-gray-600 bg-gray-200 px-2 py-1 rounded">
                    {new Date(v.voucherDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <span className={`ml-4 px-2 py-1 rounded text-xs font-bold ${
                    v.voucherType === 'Receipt' ? 'bg-green-100 text-green-800' :
                    v.voucherType === 'Payment' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {v.voucherType}
                  </span>
                </div>
                <div className="text-xl font-bold text-gray-800">
                  ₹{v.totalAmount.toFixed(2)}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">Narration:</p>
                  <p className="bg-yellow-50 text-yellow-800 p-2 rounded text-sm italic border border-yellow-200">
                    {v.narration || "No narration provided"}
                  </p>

                  <div className="mt-4">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-1">Ledger</th>
                          <th className="px-2 py-1 text-right">Debit (Dr)</th>
                          <th className="px-2 py-1 text-right">Credit (Cr)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {v.voucherDetails?.map((vd, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="px-2 py-1">{vd.ledger?.ledgerName}</td>
                            <td className="px-2 py-1 text-right text-red-600 font-medium">
                              {vd.drCr === 'Dr' ? vd.amount.toFixed(2) : ''}
                            </td>
                            <td className="px-2 py-1 text-right text-green-600 font-medium">
                              {vd.drCr === 'Cr' ? vd.amount.toFixed(2) : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="md:w-48 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l pl-0 md:pl-6 pt-4 md:pt-0">
                  <button 
                    onClick={() => handleApprove(v.voucherID)}
                    className="w-full bg-green-600 text-white font-bold py-3 rounded hover:bg-green-700 transition flex items-center justify-center shadow"
                    disabled={loading}
                  >
                    <span className="mr-2">✓</span> Approve
                  </button>
                  <button 
                    onClick={() => openRejectModal(v.voucherID)}
                    className="w-full bg-red-100 text-red-700 font-bold py-2 rounded hover:bg-red-200 transition border border-red-300"
                    disabled={loading}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-red-600 px-4 py-3 text-white font-bold flex justify-between items-center">
              <span>Reject Voucher</span>
              <button onClick={() => setRejectModalOpen(false)} className="text-white hover:text-red-200">✕</button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Rejection *</label>
              <textarea 
                className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="e.g. Incorrect ledger selected, amount mismatch..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="mt-4 flex gap-3 justify-end">
                <button 
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleReject}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherApproval;


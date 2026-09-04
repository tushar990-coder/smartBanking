import React, { useState, useEffect } from 'react';

interface Agent {
  pigmyAgentID: number;
  agentName: string;
  agentCode?: string;
  mobileNo?: string;
}

interface RemittanceItem {
  depositId: number;
  receiptNo: string;
  depositDate: string;
  amount: number;
  paymentMode?: string;
  narration: string;
  voucherId?: number;
  voucherNo?: string;
}

interface DayBookSummary {
  openingBalance: number;
  todaysCollection: number;
  cashDeposited: number;
  closingBalance: number;
  recentRemittances: RemittanceItem[];
}

const AgentDayBookMaster: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | ''>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [summary, setSummary] = useState<DayBookSummary | null>(null);

  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<string>('CASH');
  const [narration, setNarration] = useState('');
  const [message, setMessage] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<RemittanceItem | null>(null);

  useEffect(() => {
    fetch('/api/PigmyAgents')
      .then((res) => res.json())
      .then((data) => {
        setAgents(data);
        if (data.length > 0) {
          setSelectedAgentId(data[0].pigmyAgentID);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedAgentId && selectedDate) {
      fetchSummary();
    }
  }, [selectedAgentId, selectedDate]);

  const fetchSummary = async () => {
    if (!selectedAgentId || !selectedDate) return;
    try {
      const res = await fetch(
        `/api/AgentDayBook/Summary/${selectedAgentId}/${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
        setMessage('');
      } else {
        setMessage('डे बुक माहिती लोड करताना त्रुटी आली.');
      }
    } catch (err) {
      console.error(err);
      setMessage('सर्व्हरशी संपर्क साधता आला नाही.');
    }
  };

  const handleDeposit = async () => {
    if (!selectedAgentId || !depositAmount) return;
    try {
      const payload = {
        agentId: Number(selectedAgentId),
        depositDate: selectedDate,
        amount: Number(depositAmount),
        paymentMode: paymentMode,
        narration: narration,
        branchId: 1
      };

      const res = await fetch('/api/AgentDayBook/DepositCash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setMessage(`यशस्वी! पावती क्र: ${data.receiptNo} | मोड: ${paymentMode} | व्हाउचर क्र: ${data.voucherNo}`);
        setDepositAmount('');
        setNarration('');
        fetchSummary(); // Refresh balances and history
      } else {
        const errText = await res.text();
        setMessage(`त्रुटी: ${errText}`);
      }
    } catch (err) {
      console.error(err);
      setMessage('भरणा करताना नेटवर्क त्रुटी आली.');
    }
  };

  const selectedAgentObj = agents.find(a => a.pigmyAgentID === Number(selectedAgentId));

  const getModeLabel = (mode?: string) => {
    switch (mode?.toUpperCase()) {
      case 'ONLINE': return '💳 ऑनलाईन';
      case 'UPI': return '📱 युपीआय';
      case 'CHEQUE': return '📜 चेक';
      default: return '💵 रोख (Cash)';
    }
  };

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      
      {/* Outer Container matching Standard ERP Theme */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden flex flex-col">
        
        {/* Standard ERP Header Banner */}
        <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs">
          <div>
            <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
              <span>📖 एजंट डे बुक (Agent Day Book - Cash Remittance)</span>
            </h2>
            <p className="text-[10px] text-blue-100 font-normal">एजंट दैनंदिन संकलन ताळमेळ, रोख भरणा, पावती जनरेशन आणि शिल्लक तपासणी</p>
          </div>

          <button
            onClick={fetchSummary}
            className="px-2.5 py-0.5 bg-blue-800/60 hover:bg-blue-800 text-white font-semibold rounded-sm border border-blue-400/40 flex items-center gap-1 text-xs cursor-pointer"
          >
            <span>रिफ्रेश (Refresh)</span>
          </button>
        </div>

        <div className="p-3 space-y-3">

          {message && (
            <div className={`p-2.5 rounded-sm border text-xs font-bold ${
              message.startsWith('यशस्वी') || message.startsWith('Success')
                ? 'bg-green-50 text-green-800 border-green-200' 
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}>
              {message}
            </div>
          )}

      {/* Filter Section */}
      <div className="bg-white p-2 rounded-sm shadow-sm mb-3 flex flex-wrap gap-4 items-end border border-gray-200">
        <div className="w-64">
          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">एजंट निवडा (Select Agent)</label>
          <select
            className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] bg-white font-medium"
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(Number(e.target.value))}
          >
            <option value="">-- एजंट निवडा --</option>
            {agents.map((a) => (
              <option key={a.pigmyAgentID} value={a.pigmyAgentID}>
                {a.agentName} ({a.pigmyAgentID})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">तारीख (Date)</label>
          <input
            type="date"
            className="border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] bg-white"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <button
          className="bg-primary hover:bg-[#004a75] text-white px-4 py-1 rounded-sm font-bold shadow-sm transition-colors text-[11px]"
          onClick={fetchSummary}
        >
          रिफ्रेश (Refresh)
        </button>
      </div>

      {/* Summary Balance Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div className="bg-white p-2.5 rounded-sm shadow-sm border-l-4 border-gray-500 border border-gray-200">
            <h3 className="text-[10px] text-gray-500 font-bold uppercase">सुरुवातीची बाकी (Opening)</h3>
            <p className="text-sm font-extrabold text-gray-800 mt-0.5">₹ {summary.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white p-2.5 rounded-sm shadow-sm border-l-4 border-green-500 border border-gray-200">
            <h3 className="text-[10px] text-gray-500 font-bold uppercase">आजची जमा (Today's Coll.)</h3>
            <p className="text-sm font-extrabold text-green-600 mt-0.5">+ ₹ {summary.todaysCollection.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white p-2.5 rounded-sm shadow-sm border-l-4 border-red-500 border border-gray-200">
            <h3 className="text-[10px] text-gray-500 font-bold uppercase">शाखेत भरलेली रोख (Remitted)</h3>
            <p className="text-sm font-extrabold text-red-600 mt-0.5">- ₹ {summary.cashDeposited.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white p-2.5 rounded-sm shadow-sm border-l-4 border-blue-600 border border-gray-200">
            <h3 className="text-[10px] text-gray-500 font-bold uppercase">एजंटकडील अखेर कॅश शिल्लक (Closing)</h3>
            <p className="text-sm font-extrabold text-blue-700 mt-0.5">₹ {summary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Left Receive Cash Form | Right Remittance History Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Receive Cash Form */}
        <div className="bg-white p-3 rounded-sm shadow-sm border border-gray-200 h-fit">
          <div className="text-[12px] font-bold text-primary border-b border-gray-200 pb-1 mb-2.5 flex justify-between items-center">
            <span>एजंट रोख रक्कम भरणा नोंद (Receive Remittance)</span>
          </div>

          <div className="mb-2">
            <label className="block text-[11px] font-bold text-gray-700 mb-0.5">एजंटकडील शिल्लक रोख</label>
            <input
              type="text"
              readOnly
              className="w-full border border-gray-300 px-2 py-1 rounded-sm bg-gray-100 font-mono font-bold text-xs text-blue-700"
              value={summary ? `₹ ${summary.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ 0.00'}
            />
          </div>

          <div className="mb-2">
            <label className="block text-[11px] font-bold text-gray-700 mb-0.5">पैसे भरणा प्रकार (Payment Mode) <span className="text-red-500">*</span></label>
            <select
              className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-xs font-bold bg-white"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="CASH">💵 रोख (Cash)</option>
              <option value="ONLINE">💳 ऑनलाईन (Online / NEFT / RTGS)</option>
              <option value="UPI">📱 युपीआय (UPI / PhonePe / GPay)</option>
              <option value="CHEQUE">📜 चेक (Cheque / Demand Draft)</option>
            </select>
          </div>

          <div className="mb-2">
            <label className="block text-[11px] font-bold text-gray-700 mb-0.5">शाखेत जमा रक्कम (Remittance Amount ₹)</label>
            <input
              type="number"
              className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-xs font-bold bg-white"
              placeholder={`Max: ₹ ${summary?.closingBalance || 0}`}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value ? Number(e.target.value) : '')}
            />
          </div>

          <div className="mb-3">
            <label className="block text-[11px] font-bold text-gray-700 mb-0.5">तपशील / शेरा (Narration)</label>
            <input
              type="text"
              className="w-full border border-gray-300 px-2 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] bg-white"
              placeholder="उदा. Cash handed over to Branch Counter"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
          </div>

          <button
            className="w-full bg-primary hover:bg-[#004a75] text-white px-3 py-1.5 rounded-sm font-bold shadow-sm transition-colors text-xs disabled:opacity-50"
            disabled={!summary || summary.closingBalance <= 0 || !depositAmount}
            onClick={handleDeposit}
          >
            रक्कम जमा करा व व्हाउचर जनरेट करा (Receive & Create Voucher)
          </button>
        </div>

        {/* Remittance History Sheet */}
        <div className="md:col-span-2 bg-white p-3 rounded-sm shadow-sm border border-gray-200">
          <h2 className="text-[12px] font-bold text-gray-800 mb-2 border-b pb-1 flex justify-between items-center">
            <span>एजंट भरणा पावती इतिहास (Remittance Receipts History)</span>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-sm font-bold">
              {summary?.recentRemittances?.length || 0} पावत्या
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-center text-[11px]">
              <thead className="bg-primary text-white">
                <tr>
                  <th className="px-2 py-1.5 border-r border-blue-400 font-medium">पावती क्र. (Receipt)</th>
                  <th className="px-2 py-1.5 border-r border-blue-400 font-medium">तारीख (Date)</th>
                  <th className="px-2 py-1.5 border-r border-blue-400 font-medium">भरणा प्रकार (Mode)</th>
                  <th className="px-2 py-1.5 border-r border-blue-400 font-medium">व्हाउचर क्र. (Voucher)</th>
                  <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-right">रक्कम (Amount ₹)</th>
                  <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">तपशील (Narration)</th>
                  <th className="px-2 py-1.5 font-medium text-center">कृती (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {!summary?.recentRemittances || summary.recentRemittances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                      या एजंटच्या कोणत्याही भरणा पावत्या आढळल्या नाहीत.
                    </td>
                  </tr>
                ) : (
                  summary.recentRemittances.map((item) => (
                    <tr key={item.depositId} className="hover:bg-gray-50">
                      <td className="px-2 py-1 border-r border-gray-200 font-mono font-bold text-primary">
                        {item.receiptNo}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-200 whitespace-nowrap">
                        {new Date(item.depositDate).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-200 font-semibold text-gray-800">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 border border-gray-300">
                          {getModeLabel(item.paymentMode)}
                        </span>
                      </td>
                      <td className="px-2 py-1 border-r border-gray-200 font-mono text-gray-700">
                        {item.voucherNo || '-'}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-200 text-right font-bold text-green-700">
                        ₹ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-2 py-1 border-r border-gray-200 text-left text-gray-600 max-w-xs truncate">
                        {item.narration || '-'}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => setSelectedReceipt(item)}
                          className="border border-blue-500 text-blue-700 px-2 py-0.5 rounded-sm hover:bg-blue-50 transition-colors font-semibold text-[10px]"
                        >
                          पावती प्रिंट
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Printable Cash Remittance Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-4 rounded-sm shadow-lg font-sans border border-gray-300">
            
            {/* Header */}
            <div className="text-center border-b-2 border-primary pb-2 mb-3">
              <h2 className="text-sm font-bold text-primary uppercase tracking-wide">स्मार्ट बँकिंग को-ऑपरेटिव्ह क्रेडिट सोसायटी</h2>
              <p className="text-[10px] text-gray-600 font-semibold">एजंट रक्कम भरणा पावती (Agent Remittance Advice Slip)</p>
            </div>

            {/* Receipt Details */}
            <div className="space-y-1.5 text-xs border-b pb-3 mb-3">
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">पावती क्र. (Receipt No):</span>
                <span className="font-mono font-bold text-primary">{selectedReceipt.receiptNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">भरणा प्रकार (Payment Mode):</span>
                <span className="font-bold text-blue-800">{getModeLabel(selectedReceipt.paymentMode)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">व्हाउचर क्र. (Voucher No):</span>
                <span className="font-mono font-bold text-gray-800">{selectedReceipt.voucherNo || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">भरणा तारीख (Date):</span>
                <span className="font-semibold">{new Date(selectedReceipt.depositDate).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">पिग्मी एजंटचे नाव (Agent Name):</span>
                <span className="font-bold text-gray-900">{selectedAgentObj?.agentName || `Agent ID: ${selectedAgentId}`}</span>
              </div>
              <div className="flex justify-between bg-green-50 p-1.5 rounded-sm border border-green-200">
                <span className="font-bold text-green-900">भरणा केलेली रक्कम (Remitted Amount):</span>
                <span className="font-extrabold text-green-800 text-sm">₹ {selectedReceipt.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {selectedReceipt.narration && (
                <div className="flex justify-between pt-1">
                  <span className="text-gray-600 font-semibold">तपशील (Narration):</span>
                  <span className="text-gray-800">{selectedReceipt.narration}</span>
                </div>
              )}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4 pt-4 pb-2 text-center text-[10px] text-gray-600 font-semibold border-b mb-3">
              <div>
                <div className="h-8"></div>
                <p className="border-t pt-0.5">पिग्मी एजंट सही (Agent Signature)</p>
              </div>
              <div>
                <div className="h-8"></div>
                <p className="border-t pt-0.5">शाखा कॅशियर सही (Cashier Signature)</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-3 py-1 bg-gray-500 text-white rounded-sm text-xs font-semibold hover:bg-gray-600"
              >
                बंद करा (Close)
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1 bg-primary text-white rounded-sm text-xs font-bold hover:bg-[#004a75]"
              >
                प्रिंट काढा (Print Slip)
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
};

export default AgentDayBookMaster;

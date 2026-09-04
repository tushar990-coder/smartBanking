import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CreditCard,
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Coins,
  Layers,
  Save,
  Info,
  CheckSquare,
  Square
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface RdAccount {
  rdAccountID: number;
  accountNo: string;
  memberCode: string;
  memberName: string;
  schemeName: string;
  installmentAmount: number;
  totalPaidInstallments: number;
  durationMonths: number;
  status: string;
  openingDate: string;
}

export default function RdInstallmentCollection() {
  const [accounts, setAccounts] = useState<RdAccount[]>([]);
  const [selectedAccId, setSelectedAccId] = useState('');
  const [selectedAcc, setSelectedAcc] = useState<RdAccount | null>(null);

  // Form states
  const [isBulk, setIsBulk] = useState(false);
  const [count, setCount] = useState(1);
  const [penaltyAmount, setPenaltyAmount] = useState(0);
  const [payMode, setPayMode] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bulk States
  const [bulkRows, setBulkRows] = useState<{ [key: number]: { count: number; penalty: number; selected: boolean } }>({});

  const fetchAccounts = async () => {
    try {
      const res = await axios.get('/api/RdAccounts');
      const active = (res.data || []).filter((a: any) => a.status === 'Active' || a.status === 'Matured');
      setAccounts(active);

      const params = new URLSearchParams(window.location.search);
      const memberIdStr = params.get('memberId');
      const entityIdStr = params.get('entityId');
      const rdAccountIdStr = params.get('rdAccountId') || params.get('id');

      let matchedAcc: any = undefined;
      if (rdAccountIdStr) {
        const accId = parseInt(rdAccountIdStr, 10);
        matchedAcc = active.find((a: any) => a.rdAccountID === accId);
      } else if (entityIdStr) {
        const eId = parseInt(entityIdStr, 10);
        matchedAcc = active.find((a: any) => a.rdAccountID === eId || a.memberID === eId);
      } else if (memberIdStr) {
        const mId = parseInt(memberIdStr, 10);
        matchedAcc = active.find((a: any) => a.memberID === mId);
      }

      if (matchedAcc) {
        setSelectedAccId(matchedAcc.rdAccountID.toString());
        setSelectedAcc(matchedAcc);
      }
    } catch (err) {
      console.error('Error fetching RD accounts', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAccountChange = (e: any) => {
    const val = e?.target?.value ?? e;
    setSelectedAccId(val);
    const acc = accounts.find((a) => a.rdAccountID === parseInt(val, 10)) || null;
    setSelectedAcc(acc);
    setCount(1);

    if (acc) {
      // Auto-penalty calculation rules: compare OpeningDate + Paid Months vs Today
      const start = new Date(acc.openingDate);
      start.setMonth(start.getMonth() + acc.totalPaidInstallments);
      const today = new Date();

      const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
      if (diffMonths > 0) {
        // 2% penalty per overdue month
        const p = Math.round(acc.installmentAmount * 0.02 * diffMonths);
        setPenaltyAmount(p);
      } else {
        setPenaltyAmount(0);
      }
    } else {
      setPenaltyAmount(0);
    }
  };

  // Initialize Bulk Rows when mode changes
  useEffect(() => {
    if (isBulk && accounts.length > 0) {
      const initial: typeof bulkRows = {};
      accounts.forEach((acc) => {
        const start = new Date(acc.openingDate);
        start.setMonth(start.getMonth() + acc.totalPaidInstallments);
        const today = new Date();
        const diffMonths = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
        const penalty = diffMonths > 0 ? Math.round(acc.installmentAmount * 0.02 * diffMonths) : 0;

        initial[acc.rdAccountID] = {
          count: 1,
          penalty: penalty,
          selected: false,
        };
      });
      setBulkRows(initial);
    }
  }, [isBulk, accounts]);

  const handleBulkRowChange = (id: number, field: string, val: any) => {
    setBulkRows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: val,
      },
    }));
  };

  const handleSelectAllBulk = (checked: boolean) => {
    setBulkRows((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((idStr) => {
        const id = Number(idStr);
        updated[id] = { ...updated[id], selected: checked };
      });
      return updated;
    });
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcc) {
      setError('कृपया आरडी खाते निवडा.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.post(
        `/api/RdAccounts/${selectedAcc.rdAccountID}/CollectInstallment?count=${count}&penaltyAmount=${penaltyAmount}&payMode=${payMode}`
      );
      setSuccess(`✅ आरडी हप्ता यशस्वीरीत्या जमा झाला! खाते क्रमांक: ${selectedAcc.accountNo}`);

      setSelectedAccId('');
      setSelectedAcc(null);
      setCount(1);
      setPenaltyAmount(0);
      fetchAccounts();
    } catch (err: any) {
      const errText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message || 'हप्ता संकलन करताना त्रुटी आली.';
      setError(errText);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async () => {
    const selectedIds = Object.keys(bulkRows)
      .map(Number)
      .filter((id) => bulkRows[id].selected);

    if (selectedIds.length === 0) {
      setError('कृपया हप्ता भरण्यासाठी किमान एक खाते निवडा.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      let successCount = 0;
      for (const id of selectedIds) {
        const row = bulkRows[id];
        await axios.post(
          `/api/RdAccounts/${id}/CollectInstallment?count=${row.count}&penaltyAmount=${row.penalty}&payMode=Cash`
        );
        successCount++;
      }
      setSuccess(`✅ एकत्रित संकलन यशस्वी! ${successCount} खात्यांचे हप्ते जमा झाले.`);
      fetchAccounts();
    } catch (err: any) {
      const errText = typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message || 'एकत्रित संकलन करताना त्रुटी आली.';
      setError(errText);
    } finally {
      setLoading(false);
    }
  };

  const labelClass = "block text-xs font-semibold text-slate-700 mb-1.5";
  const inputClass = "w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none bg-white text-slate-900 font-medium transition duration-150";

  const selectedBulkCount = Object.values(bulkRows).filter((r) => r.selected).length;

  return (
    <div className="p-3 md:p-5 max-w-full h-full flex flex-col bg-slate-50 text-xs font-sans space-y-4">
      {/* Header Bar */}
      <div className="bg-white p-3.5 md:p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800">
                मासिक आरडी हप्ता संकलन (RD Installment Collection)
              </h1>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded border border-indigo-100">
                हप्ता संकलन
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              सभासदांच्या आरडी खात्यांचा मासिक हप्ता व थकीत दंड जमा करा.
            </p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { setIsBulk(false); setError(''); setSuccess(''); }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              !isBulk 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>एकल (Single)</span>
          </button>

          <button
            type="button"
            onClick={() => { setIsBulk(true); setError(''); setSuccess(''); }}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              isBulk 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>एकत्रित (Bulk)</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-2 text-xs">
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="flex-1 font-medium">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg flex items-center gap-2 text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1 font-bold">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-slate-400 hover:text-slate-600">×</button>
        </div>
      )}

      {/* Mode Renderings */}
      {!isBulk ? (
        /* Single Account Collection Form */
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 max-w-xl mx-auto space-y-4 w-full">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Coins className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              हप्ता जमा फॉर्म (Single Collection)
            </h2>
          </div>

          <form onSubmit={handleSingleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>आरडी खाते क्रमांक निवडा (Select RD Account) <span className="text-red-500">*</span></label>
              <SearchableSelect
                options={accounts.map((a) => ({
                  value: a.rdAccountID,
                  label: `${a.accountNo} - ${a.memberName} (${a.schemeName})`,
                }))}
                value={selectedAccId}
                onChange={handleAccountChange}
                placeholder="नाव किंवा खाते क्रमांकाने शोधा..."
              />
            </div>

            {/* Selected Account Details Card */}
            {payMode === 'Cash' && (
              <CashLedgerReflectBadge 
                transactionType="Collection" 
                customTitle="हप्ता जमा होणारे रोख खाते (Cash Collection Ledger)"
              />
            )}

            {selectedAcc && (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700 shadow-2xs">
                <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                  <span className="text-slate-500 text-[11px] font-semibold">खातेदार नाव:</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedAcc.memberName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 text-[11px] block">मासिक हप्ता:</span>
                    <strong className="text-indigo-700 font-mono font-bold text-xs">
                      ₹ {selectedAcc.installmentAmount?.toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">हप्ते प्रगती (Progress):</span>
                    <strong className="text-slate-800 text-xs">
                      {selectedAcc.totalPaidInstallments} / {selectedAcc.durationMonths} महिने
                    </strong>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (selectedAcc.totalPaidInstallments / (selectedAcc.durationMonths || 1)) * 100
                      )}%`,
                    }}
                  ></div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500 text-[11px]">खाते स्थिती:</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      selectedAcc.status === 'Matured'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {selectedAcc.status === 'Matured' ? 'मुदतपूर्ती (Matured)' : 'सक्रिय (Active)'}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>हप्ते संख्या (Quantity)</label>
                <input
                  type="number"
                  name="count"
                  value={count}
                  onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className={inputClass}
                  min="1"
                  required
                />
              </div>

              <div>
                <label className={labelClass}>थकीत दंड (Penalty ₹)</label>
                <input
                  type="number"
                  name="penaltyAmount"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={inputClass}
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>पेमेंट मोड (Payment Mode)</label>
              <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={inputClass}>
                <option value="Cash">रोख (Cash)</option>
                <option value="Bank">बँक ट्रान्सफर (Bank Transfer)</option>
              </select>
            </div>

            {selectedAcc && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex justify-between items-center text-slate-800 text-xs shadow-2xs">
                <span className="font-semibold text-slate-700">एकूण जमा रक्कम (Total Payable):</span>
                <span className="text-base font-bold font-mono text-emerald-700">
                  ₹ {(selectedAcc.installmentAmount * count + penaltyAmount).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !selectedAcc}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition duration-200 text-xs shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? 'प्रक्रिया होत आहे...' : 'हप्ता जमा करा (Collect Installment)'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Bulk Accounts Collection Table View */
        <div className="bg-white p-4 md:p-5 rounded-xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800">एकत्रित हप्ता संकलन यादी (Bulk Collection List)</h2>
              {selectedBulkCount > 0 && (
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-full text-[10px] border border-indigo-100">
                  {selectedBulkCount} खाती निवडली
                </span>
              )}
            </div>

            <button
              onClick={handleBulkSubmit}
              disabled={loading || selectedBulkCount === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition duration-200 disabled:opacity-50 shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'प्रक्रिया होत आहे...' : 'निवडलेले हप्ते जमा करा'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center">
                    <input
                      type="checkbox"
                      onChange={(e) => handleSelectAllBulk(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                      title="सर्व निवडा"
                    />
                  </th>
                  <th className="py-2.5 px-3">खाते क्रमांक / नाव</th>
                  <th className="py-2.5 px-3 text-center">मासिक हप्ता (₹)</th>
                  <th className="py-2.5 px-3 text-center">भरलेले / एकूण महिने</th>
                  <th className="py-2.5 px-3 text-center w-28">हप्ते (Qty)</th>
                  <th className="py-2.5 px-3 text-center w-28">दंड (₹)</th>
                  <th className="py-2.5 px-3 text-right">एकूण जमा (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                      कोणतीही सक्रिय आरडी खाती उपलब्ध नाहीत.
                    </td>
                  </tr>
                ) : (
                  accounts.map((acc) => {
                    const row = bulkRows[acc.rdAccountID] || { count: 1, penalty: 0, selected: false };
                    const subtotal = acc.installmentAmount * row.count + row.penalty;
                    return (
                      <tr key={acc.rdAccountID} className="hover:bg-slate-50/80 transition duration-150">
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => handleBulkRowChange(acc.rdAccountID, 'selected', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          <div className="font-mono font-bold text-indigo-700">{acc.accountNo}</div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            {acc.memberName} ({acc.schemeName})
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                          ₹{acc.installmentAmount?.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-center font-medium">
                          {acc.totalPaidInstallments} / {acc.durationMonths}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            value={row.count}
                            onChange={(e) =>
                              handleBulkRowChange(acc.rdAccountID, 'count', Math.max(1, parseInt(e.target.value, 10) || 1))
                            }
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-slate-800 text-xs focus:outline-none focus:border-indigo-600 font-bold"
                            min="1"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            value={row.penalty}
                            onChange={(e) =>
                              handleBulkRowChange(acc.rdAccountID, 'penalty', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-slate-800 text-xs focus:outline-none focus:border-indigo-600 font-medium"
                            min="0"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                          ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

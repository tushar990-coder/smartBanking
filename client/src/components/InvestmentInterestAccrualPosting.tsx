import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  TrendingUp,
  Coins,
  CheckCircle,
  XCircle,
  RotateCcw,
  Calendar,
  Building,
  Percent,
  Landmark,
  FileSpreadsheet,
  Search,
  BookOpen,
  PieChart,
  Layers,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SearchableSelect from './SearchableSelect';

const InvestmentInterestAccrualPosting: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [accruals, setAccruals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'accrual' | 'receipt'>('accrual');
  const [receiptType, setReceiptType] = useState<'DepositInterest' | 'ShareDividend'>('DepositInterest');
  const [searchTerm, setSearchTerm] = useState('');

  const API_URL = '/api';

  const [accrualForm, setAccrualForm] = useState({
    branchID: 1,
    accrualDate: new Date().toISOString().split('T')[0],
  });

  const [receiptForm, setReceiptForm] = useState({
    investmentAccountID: 0,
    receiptDate: new Date().toISOString().split('T')[0],
    receivedAmount: 0,
    remarks: 'व्याज प्राप्ती',
  });

  useEffect(() => {
    fetchBranches();
    fetchAccruals();
    fetchAccounts();
    fetchReceipts();
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/Branches`);
      setBranches(res.data || []);
    } catch {}
  };

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentAccounts?status=Active`);
      setAccounts(res.data || []);
    } catch {}
  };

  const fetchAccruals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/InvestmentAccounts/Accruals`);
      setAccruals(res.data || []);
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async () => {
    try {
      const res = await axios.get(`${API_URL}/InvestmentAccounts/Receipts`);
      setReceipts(res.data || []);
    } catch {}
  };

  const handleAccrualPosting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/InvestmentAccounts/AccrualPosting`, accrualForm);
      setSuccess(`${response.data.message} (एकूण प्रक्रिया खाती: ${response.data.accountsProcessed}, एकूण संचित व्याज: ₹${response.data.totalInterest?.toLocaleString('en-IN')})`);
      fetchAccruals();
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : 'व्याज तरतूद करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleReceiptPosting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!receiptForm.investmentAccountID || Number(receiptForm.investmentAccountID) === 0) {
      setError('कृपया गुंतवणूक खाते निवडा.');
      return;
    }
    if (receiptForm.receivedAmount <= 0) {
      setError('कृपया मिळालेली रक्कम प्रविष्ट करा.');
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(`${API_URL}/InvestmentAccounts/InterestReceipt`, {
        ...receiptForm,
        remarks: receiptType === 'ShareDividend' ? `शेअर्स लाभांश प्राप्ती (${receiptForm.remarks})` : receiptForm.remarks
      });
      setSuccess(response.data.message || 'उत्पन्न प्राप्ती यशस्वीरीत्या नोंदवली!');
      setReceiptForm({
        investmentAccountID: 0,
        receiptDate: new Date().toISOString().split('T')[0],
        receivedAmount: 0,
        remarks: 'व्याज प्राप्ती',
      });
      fetchReceipts();
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : 'प्राप्ती नोंदवताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportAccrualsExcel = () => {
    if (accruals.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = accruals.map((a, idx) => ({
      'अ.क्र.': idx + 1,
      'खाते क्रमांक': a.investmentNo,
      'तरतूद तारीख': a.accrualDate?.split('T')[0],
      'संचित व्याज रक्कम ₹': a.interestAmount,
      'व्हाउचर क्रमांक': a.voucherID ? `V-${a.voucherID}` : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InterestAccruals');
    XLSX.writeFile(wb, `Interest_Accruals_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportReceiptsExcel = () => {
    if (receipts.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = receipts.map((r, idx) => ({
      'अ.क्र.': idx + 1,
      'खाते क्रमांक': r.investmentNo,
      'प्राप्ती तारीख': r.receiptDate?.split('T')[0],
      'मिळालेली रक्कम ₹': r.receivedAmount,
      'व्हाउचर क्रमांक': r.voucherID ? `V-${r.voucherID}` : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InterestReceipts');
    XLSX.writeFile(wb, `Interest_Receipts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (n: number) => n?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  // Accounts filtered by receipt type
  const selectableAccounts = accounts.filter(a => {
    const isShare = a.investmentType === 'Share' || a.durationMonths === 0;
    return receiptType === 'ShareDividend' ? isShare : !isShare;
  });

  const totalAccrualsAmt = accruals.reduce((acc, a) => acc + (a.interestAmount || 0), 0);
  const totalReceiptsAmt = receipts.reduce((acc, r) => acc + (r.receivedAmount || 0), 0);

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <TrendingUp size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>गुंतवणूक व्याज तरतूद व प्राप्ती</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Interest Accrual & Dividend Receipt Posting)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              बँकांमधील मुदत ठेवींचे ३१ मार्च संचित व्याज तरतूद आणि शेअर्स लाभांश / व्याज पावती नोंदणी
            </p>
          </div>
        </div>

        {/* Action Tabs Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 border border-slate-200 rounded-sm gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('accrual')}
            className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'accrual'
                ? 'bg-primary text-white shadow-2xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>१. मुदत ठेव व्याज तरतूद (Accrual)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receipt')}
            className={`px-3 py-1 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'receipt'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>२. व्याज व लाभांश प्राप्ती (Receipt)</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण संचित व्याज तरतूद</div>
            <div className="text-sm font-black text-gray-900">₹{formatCurrency(totalAccrualsAmt)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण प्रत्यक्ष प्राप्त उत्पन्न</div>
            <div className="text-sm font-black text-emerald-800">₹{formatCurrency(totalReceiptsAmt)}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">तरतूद नोंदी (Accruals)</div>
            <div className="text-sm font-black text-indigo-900">{accruals.length} नोंदी</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">प्राप्ती पावत्या (Receipts)</div>
            <div className="text-sm font-black text-amber-800">{receipts.length} पावत्या</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ACCRUAL POSTING                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'accrual' && (
        <div className="space-y-3">
          <div className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 space-y-3">
            <div className="bg-primary/5 p-3.5 rounded-sm border border-primary/20 space-y-2.5">
              <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-bold text-primary">मुदत ठेव संचित व्याज तरतूद (Monthly / Annual Accrual Posting)</h2>
                </div>
                <span className="text-[10px] text-gray-500 font-medium">ऑटोमॅटिक व्हाऊचर निर्मिती</span>
              </div>

              <p className="text-[11px] text-gray-600">
                ही प्रक्रिया सर्व सक्रिय मुदत ठेव खात्यांचे व्याज तरतूद तारीख (उदा. ३१ मार्च किंवा महिनाअखेर) पर्यंतचे संचित व्याज मोजून खातावणीमध्ये थेट 
                <strong> 'येणे व्याज खाते (Accrued Asset Dr)'</strong> ते <strong>'गुंतवणूक व्याज उत्पन्न खाते (Income Cr)'</strong> असे ऑटो व्हाऊचर तयार करते.
              </p>

              <form onSubmit={handleAccrualPosting} className="pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className={labelClass}>लागू शाखा (Branch)</label>
                    <select
                      value={accrualForm.branchID}
                      onChange={(e) => setAccrualForm(prev => ({ ...prev, branchID: parseInt(e.target.value, 10) }))}
                      className={inputClass}
                    >
                      {branches.map((b: any) => (
                        <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>तरतूद तारीख (Accrual Date) *</label>
                    <input
                      type="date"
                      value={accrualForm.accrualDate}
                      onChange={(e) => setAccrualForm(prev => ({ ...prev, accrualDate: e.target.value }))}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full h-[28px] bg-primary hover:opacity-90 text-white font-bold rounded-sm text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{saving ? 'प्रक्रिया चालू आहे...' : '📊 व्याज तरतूद व्हाऊचर पोस्ट करा'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Accruals History Table */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-800">📋 नोंदवलेली व्याज तरतूद यादी ({accruals.length})</h3>
                <button
                  type="button"
                  onClick={handleExportAccrualsExcel}
                  disabled={accruals.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-sm text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={13} />
                  <span>एक्सेल एक्सपोर्ट</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-10">#</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">खाते क्रमांक</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-center">तरतूद तारीख</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-right">संचित व्याज रक्कम ₹</th>
                      <th className="px-3 py-1.5 text-center w-28">तयार व्हाऊचर</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-6 text-center text-gray-500 font-bold">डेटा लोड होत आहे...</td>
                      </tr>
                    ) : accruals.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-6 text-center text-gray-400 font-bold">कोणतीही व्याज तरतूद उपलब्ध नाही.</td>
                      </tr>
                    ) : (
                      accruals.map((a: any, idx: number) => (
                        <tr key={a.accrualID || idx} className="hover:bg-primary/5 transition-colors">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 font-mono font-bold text-primary">{a.investmentNo}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-center text-gray-700">{formatDate(a.accrualDate)}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                            ₹{formatCurrency(a.interestAmount)}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {a.voucherID ? (
                              <span className="bg-primary/10 text-primary font-mono font-bold px-2 py-0.5 rounded border border-primary/20">
                                V-{a.voucherID}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTEREST & DIVIDEND RECEIPT POSTING                                */}
      {/* ========================================================================= */}
      {activeTab === 'receipt' && (
        <div className="space-y-3">
          <div className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 space-y-3">
            
            {/* Category Selector Pill */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
              <span className="font-bold text-xs text-gray-700">प्राप्ती वर्गवारी:</span>
              <button
                type="button"
                onClick={() => {
                  setReceiptType('DepositInterest');
                  setReceiptForm(prev => ({ ...prev, investmentAccountID: 0, remarks: 'मुदत ठेव व्याज प्राप्ती' }));
                }}
                className={`px-3 py-1 text-xs font-bold rounded-sm border transition-all cursor-pointer ${
                  receiptType === 'DepositInterest'
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50'
                }`}
              >
                🏛️ मुदत ठेव व्याज पावती (Term Deposit Interest)
              </button>

              <button
                type="button"
                onClick={() => {
                  setReceiptType('ShareDividend');
                  setReceiptForm(prev => ({ ...prev, investmentAccountID: 0, remarks: 'शेअर्स वार्षिक लाभांश प्राप्ती' }));
                }}
                className={`px-3 py-1 text-xs font-bold rounded-sm border transition-all cursor-pointer ${
                  receiptType === 'ShareDividend'
                    ? 'bg-indigo-800 text-white border-indigo-800 shadow-xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-slate-50'
                }`}
              >
                📊 शेअर्स लाभांश पावती (Shares Dividend Receipt)
              </button>
            </div>

            <form onSubmit={handleReceiptPosting} className="bg-emerald-50/40 p-3.5 rounded-sm border border-emerald-200 border-t-2 border-emerald-600 space-y-2.5">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-700" />
                  <h2 className="text-xs font-bold text-emerald-900">
                    {receiptType === 'ShareDividend' ? 'शेअर्स लाभांश पावती नोंद (Share Dividend Entry)' : 'मुदत ठेव व्याज पावती नोंद (Deposit Interest Entry)'}
                  </h2>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300">
                  बँक / कॅश जमा व्हाउचर
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="col-span-1 sm:col-span-2">
                  <label className={labelClass}>
                    गुंतवणूक खाते निवडा <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    name="investmentAccountID"
                    value={receiptForm.investmentAccountID}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, investmentAccountID: Number(e.target.value) }))}
                    options={[
                      { value: 0, label: `-- ${receiptType === 'ShareDividend' ? 'शेअर्स खाते निवडा' : 'मुदत ठेव खाते निवडा'} --` },
                      ...selectableAccounts.map((a: any) => ({
                        value: a.investmentAccountID,
                        label: `${a.investmentNo} | ${a.institutionName} | ${a.schemeName} | भांडवल: ₹${formatCurrency(a.principalAmount)}`
                      }))
                    ]}
                    placeholder="-- खाते शोधा --"
                  />
                </div>

                <div>
                  <label className={labelClass}>प्राप्ती तारीख *</label>
                  <input
                    type="date"
                    value={receiptForm.receiptDate}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, receiptDate: e.target.value }))}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    प्राप्त रक्कम (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={receiptForm.receivedAmount || ''}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, receivedAmount: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                    required
                    placeholder="उदा. 35000"
                    className={`${inputClass} font-mono font-bold text-emerald-800`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className={labelClass}>शेरा / ठराव / चेक संदर्भ</label>
                  <input
                    type="text"
                    value={receiptForm.remarks}
                    onChange={(e) => setReceiptForm(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="उदा. DCC बँक वार्षिक लाभांश ठराव क्र. ५"
                    className={inputClass}
                  />
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-[28px] px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>{saving ? 'नोंद होत आहे...' : '💵 उत्पन्न पावती नोंदवा'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Receipts History Table */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-800">📋 नोंदवलेल्या उत्पन्न पावत्या यादी ({receipts.length})</h3>
                <button
                  type="button"
                  onClick={handleExportReceiptsExcel}
                  disabled={receipts.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-sm text-[11px] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet size={13} />
                  <span>एक्सेल एक्सपोर्ट</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-300">
                    <tr>
                      <th className="px-2 py-1.5 border-r border-gray-200 text-center w-10">#</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-left">खाते क्रमांक</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-center">प्राप्ती तारीख</th>
                      <th className="px-3 py-1.5 border-r border-gray-200 text-right">मिळालेली रक्कम ₹</th>
                      <th className="px-3 py-1.5 text-center w-28">तयार व्हाऊचर</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                    {receipts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-6 text-center text-gray-400 font-bold">कोणतीही प्राप्ती पावती उपलब्ध नाही.</td>
                      </tr>
                    ) : (
                      receipts.map((r: any, idx: number) => (
                        <tr key={r.receiptID || idx} className="hover:bg-primary/5 transition-colors">
                          <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 font-mono font-bold text-primary">{r.investmentNo}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-center text-gray-700">{formatDate(r.receiptDate)}</td>
                          <td className="px-3 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-emerald-700">
                            ₹{formatCurrency(r.receivedAmount)}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {r.voucherID ? (
                              <span className="bg-primary/10 text-primary font-mono font-bold px-2 py-0.5 rounded border border-primary/20">
                                V-{r.voucherID}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default InvestmentInterestAccrualPosting;

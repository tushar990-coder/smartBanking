import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
}

const AssetReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'register' | 'depreciation' | 'maintenance'>('register');
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [sansthaDetail, setSansthaDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Register Filters
  const [regBranch, setRegBranch] = useState('all');
  const [regCategory, setRegCategory] = useState('all');
  const [regStatus, setRegStatus] = useState('all');

  // Batch Depreciation States
  const [depPreview, setDepPreview] = useState<any[]>([]);
  const [depLoading, setDepLoading] = useState(false);
  const [depBranch, setDepBranch] = useState(1);
  const [depCategory, setDepCategory] = useState('all');
  const [depDate, setDepDate] = useState(new Date().toISOString().split('T')[0]);
  const [depPostVoucher, setDepPostVoucher] = useState(true);
  const [depDebitLedger, setDepDebitLedger] = useState(0);
  const [depCreditLedger, setDepCreditLedger] = useState(0);

  const API_URL = '/api';

  useEffect(() => {
    fetchBranches();
    fetchCategories();
    fetchLedgers();
    fetchSansthaDetail();
  }, []);

  const fetchSansthaDetail = async () => {
    try {
      const res = await axios.get(`${API_URL}/SansthaDetails`);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSansthaDetail(res.data[0]);
      } else if (res.data && !Array.isArray(res.data)) {
        setSansthaDetail(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'register') {
      fetchRegisterAssets();
    } else if (activeTab === 'maintenance') {
      fetchMaintenanceLogs();
    }
  }, [activeTab, regBranch, regCategory, regStatus]);

  const fetchBranches = async () => {
    try { setBranches((await axios.get(`${API_URL}/Branches`)).data); } catch {}
  };

  const fetchCategories = async () => {
    try { setCategories((await axios.get(`${API_URL}/AssetCategories`)).data); } catch {}
  };

  const fetchLedgers = async () => {
    try { setLedgers((await axios.get(`${API_URL}/Ledgers`)).data); } catch {}
  };

  const fetchRegisterAssets = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/Assets?`;
      if (regBranch !== 'all') url += `branchId=${regBranch}&`;
      if (regCategory !== 'all') url += `categoryId=${regCategory}&`;
      if (regStatus !== 'all') url += `status=${regStatus}&`;
      const res = await axios.get(url);
      setAssets(res.data);
    } catch {
      setError('मालमत्ता लोड करताना त्रुटी.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/AssetMaintenances`);
      setMaintenances(res.data);
    } catch {
      setError('देखभाल लॉग लोड करताना त्रुटी.');
    } finally {
      setLoading(false);
    }
  };

  // Preview batch depreciation
  const handlePreviewDepreciation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setDepLoading(true);
    try {
      const res = await axios.post(`${API_URL}/AssetDepreciations/preview`, {
        branchID: depBranch,
        categoryID: depCategory === 'all' ? null : parseInt(depCategory),
        calculationDate: depDate
      });
      setDepPreview(res.data);
      if (res.data.length === 0) {
        setSuccess('या फिल्टरसाठी घसारा आकारणी करण्यायोग्य कोणतीही मालमत्ता नाही. (No assets eligible for depreciation.)');
      }
    } catch {
      setError('घसारा आकडेवारी मोजताना त्रुटी.');
    } finally {
      setDepLoading(false);
    }
  };

  // Commit batch depreciation
  const handleCommitDepreciation = async () => {
    setError(''); setSuccess('');
    if (depPreview.length === 0) return;
    if (depPostVoucher && (!depDebitLedger || !depCreditLedger)) {
      setError('घसारा पोस्ट करण्यासाठी आवश्यक लेजर निवडा. (Debit and Credit ledgers required.)');
      return;
    }
    if (!window.confirm(`तुम्हाला खात्री आहे का की ${depPreview.length} मालमत्तांवर घसारा आकारणी करायची आहे?`)) return;

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/AssetDepreciations/commit`, {
        branchID: depBranch,
        financialYearID: 1, // default
        calculationDate: depDate,
        items: depPreview,
        postVoucher: depPostVoucher,
        debitLedgerID: depDebitLedger,
        creditLedgerID: depCreditLedger,
        createdBy: 1
      });
      setSuccess(res.data.message || 'घसारा यशस्वीरित्या आकारण्यात आला!');
      setDepPreview([]);
    } catch (err: any) {
      setError(err.response?.data || 'घसारा नोंदवताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => n?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';

  // Stats summaries
  const totalCount = assets.length;
  const totalCost = assets.reduce((s, a) => s + a.originalCost, 0);
  const totalBookVal = assets.reduce((s, a) => s + a.currentBookValue, 0);
  const totalAccumDep = assets.reduce((s, a) => s + a.accumulatedDepreciation, 0);
  const totalDisposed = assets.filter(a => a.status === 'Disposed').length;

  return (
    <div className="p-3">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-sm text-xs mb-3 font-semibold">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-sm text-xs mb-3 font-semibold">{success}</div>}

      {/* Summary Statistics Panel */}
      {activeTab === 'register' && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-sm p-3 shadow-xs">
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">एकूण मालमत्ता (Assets)</p>
            <p className="text-lg font-black text-blue-800">{totalCount}</p>
            <p className="text-[11px] font-semibold text-blue-700">नोंदणीकृत मालमत्ता</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-sm p-3 shadow-xs">
            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider">एकूण मूळ किंमत (Cost)</p>
            <p className="text-lg font-black text-green-800">₹{fmt(totalCost)}</p>
            <p className="text-[11px] font-semibold text-green-700">Original Investment</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-sm p-3 shadow-xs">
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">चालू पुस्तकी मूल्य (WDV)</p>
            <p className="text-lg font-black text-emerald-800">₹{fmt(totalBookVal)}</p>
            <p className="text-[11px] font-semibold text-emerald-700">Written Down Value</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-sm p-3 shadow-xs">
            <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">एकूण घसारा (Accum. Depr.)</p>
            <p className="text-lg font-black text-purple-800">₹{fmt(totalAccumDep)}</p>
            <p className="text-[11px] font-semibold text-purple-700">Depreciation Charged</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-sm p-3 shadow-xs">
            <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">विल्हेवाट लावली (Disposed)</p>
            <p className="text-lg font-black text-red-800">{totalDisposed} नगा</p>
            <p className="text-[11px] font-semibold text-red-700">Scrapped / Sold Assets</p>
          </div>
        </div>
      )}

      {/* Print Only Header */}
      <div className="hidden print:block text-center border-b-2 border-black pb-3 mb-4">
        <h1 className="text-xl font-bold uppercase">{sansthaDetail?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}</h1>
        <p className="text-xs font-semibold">{sansthaDetail?.address || 'मुख्य कार्यालय'}{sansthaDetail?.registrationNo ? ` | नोंदणी क्र.: ${sansthaDetail.registrationNo}` : ''}</p>
        <h2 className="text-md font-bold mt-1 text-primary">
          {activeTab === 'register' && 'डेडस्टॉक व मालमत्ता नोंदवही (Asset Register)'}
          {activeTab === 'depreciation' && 'मालमत्ता वार्षिक घसारा आकारणी पत्रक (Asset Depreciation Schedule)'}
          {activeTab === 'maintenance' && 'मालमत्ता देखभाल नोंदवही (Asset Maintenance Log)'}
        </h2>
        <p className="text-xs text-gray-600">दिनांक: {new Date().toLocaleDateString('en-GB')}</p>
      </div>

      {/* Main Report Container */}
      <div className="bg-white rounded shadow-sm border border-gray-200">
        {/* Header Tabs */}
        <div className="bg-primary text-white px-4 py-2 rounded-t flex items-center justify-between print:hidden">
          <h2 className="text-sm font-bold">📊 मालमत्ता अहवाल (Asset Management Reports)</h2>
          <div className="flex gap-1">
            <button onClick={() => setActiveTab('register')} className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${activeTab === 'register' ? 'bg-white text-primary' : 'bg-[#004a75] text-white'}`}>📋 मालमत्ता रजिस्टर</button>
            <button onClick={() => setActiveTab('depreciation')} className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${activeTab === 'depreciation' ? 'bg-white text-primary' : 'bg-[#004a75] text-white'}`}>⚡ घसारा आकारणी (Depr Run)</button>
            <button onClick={() => setActiveTab('maintenance')} className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${activeTab === 'maintenance' ? 'bg-white text-primary' : 'bg-[#004a75] text-white'}`}>🛠️ देखभाल रजिस्टर</button>
          </div>
        </div>

        <div className="p-3">
          {/* TAB 1: ASSET REGISTER */}
          {activeTab === 'register' && (
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-end bg-gray-50 border p-2 rounded print:hidden text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">शाखा (Branch)</label>
                  <select value={regBranch} onChange={e => setRegBranch(e.target.value)} className="border rounded px-2 py-0.5 bg-white mt-0.5">
                    <option value="all">सर्व शाखा (All Branches)</option>
                    {branches.map(b => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">मालमत्ता वर्ग (Category)</label>
                  <select value={regCategory} onChange={e => setRegCategory(e.target.value)} className="border rounded px-2 py-0.5 bg-white mt-0.5">
                    <option value="all">सर्व वर्ग (All)</option>
                    {categories.map(c => <option key={c.categoryID} value={c.categoryID}>{c.categoryName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">स्थिती (Status)</label>
                  <select value={regStatus} onChange={e => setRegStatus(e.target.value)} className="border rounded px-2 py-0.5 bg-white mt-0.5">
                    <option value="all">सर्व</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Disposed">Disposed</option>
                  </select>
                </div>
                <div>
                  <button onClick={() => window.print()} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-sm text-xs font-semibold">🖨️ प्रिंट अहवाल</button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-sm">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-left">
                      <th className="px-2.5 py-1.5">#</th>
                      <th className="px-2.5 py-1.5">शाखा</th>
                      <th className="px-2.5 py-1.5">मालमत्ता कोड</th>
                      <th className="px-2.5 py-1.5">मालमत्ता नाव</th>
                      <th className="px-2.5 py-1.5">वर्ग</th>
                      <th className="px-2.5 py-1.5">खरेदी दिनांक</th>
                      <th className="px-2.5 py-1.5 text-right">मूळ किंमत (₹)</th>
                      <th className="px-2.5 py-1.5 text-right">घसारा (₹)</th>
                      <th className="px-2.5 py-1.5 text-right">पुस्तकी मूल्य (₹)</th>
                      <th className="px-2.5 py-1.5">ताबाधारक</th>
                      <th className="px-2.5 py-1.5">स्थान</th>
                      <th className="px-2.5 py-1.5 text-center">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={12} className="text-center py-4 text-gray-400">लोड होत आहे...</td></tr>
                    ) : assets.length === 0 ? (
                      <tr><td colSpan={12} className="text-center py-4 text-gray-400">अहवालासाठी कोणतीही नोंद नाही.</td></tr>
                    ) : assets.map((a, idx) => (
                      <tr key={a.assetID} className="hover:bg-blue-50 border-b border-gray-100 transition-colors">
                        <td className="px-2.5 py-1">{idx + 1}</td>
                        <td className="px-2.5 py-1">{a.branch?.branchName}</td>
                        <td className="px-2.5 py-1 font-mono font-medium text-blue-700">{a.assetCode}</td>
                        <td className="px-2.5 py-1 font-medium">{a.assetName}</td>
                        <td className="px-2.5 py-1">{a.category?.categoryName}</td>
                        <td className="px-2.5 py-1">{new Date(a.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                        <td className="px-2.5 py-1 text-right">₹{fmt(a.originalCost)}</td>
                        <td className="px-2.5 py-1 text-right text-red-600">₹{fmt(a.accumulatedDepreciation)}</td>
                        <td className="px-2.5 py-1 text-right font-bold text-gray-800">₹{fmt(a.currentBookValue)}</td>
                        <td className="px-2.5 py-1">{a.custodian || '-'}</td>
                        <td className="px-2.5 py-1">{a.location || '-'}</td>
                        <td className="px-2.5 py-1 text-center">
                          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold 
                            ${a.status === 'Active' ? 'bg-green-50 text-green-700' : 
                              a.status === 'Suspended' ? 'bg-yellow-50 text-yellow-700' : 
                              a.status === 'Damaged' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {assets.length > 0 && (
                    <tr className="bg-gray-100 font-bold border-t border-gray-300">
                      <td colSpan={6} className="px-2.5 py-1.5 text-right">एकूण (Totals):</td>
                      <td className="px-2.5 py-1.5 text-right">₹{fmt(totalCost)}</td>
                      <td className="px-2.5 py-1.5 text-right text-red-600">₹{fmt(totalAccumDep)}</td>
                      <td className="px-2.5 py-1.5 text-right text-gray-800">₹{fmt(totalBookVal)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: BATCH DEPRECIATION RUN */}
          {activeTab === 'depreciation' && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded text-xs">
                📌 मालमत्ता घसारा वार्षिक किंवा विशिष्ट कालावधीसाठी एकत्रितपणे पोस्ट करण्यासाठी हे पान वापरावे. आधी घसारा आकडेवारी तपासा (Calculate) आणि नंतर सेव्ह करा.
              </div>

              <form onSubmit={handlePreviewDepreciation} className="grid grid-cols-4 gap-2 items-end bg-gray-50 p-3 border rounded text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">शाखा (Branch) *</label>
                  <select value={depBranch} onChange={e => setDepBranch(parseInt(e.target.value))} className="w-full border rounded px-2 py-1 bg-white mt-0.5">
                    {branches.map(b => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">मालमत्ता वर्ग (Category)</label>
                  <select value={depCategory} onChange={e => setDepCategory(e.target.value)} className="w-full border rounded px-2 py-1 bg-white mt-0.5">
                    <option value="all">सर्व वर्ग (All Categories)</option>
                    {categories.map(c => <option key={c.categoryID} value={c.categoryID}>{c.categoryName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">गणना तारीख (As on Date) *</label>
                  <input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} required className="w-full border rounded px-2 py-1 mt-0.5" />
                </div>
                <div>
                  <button type="submit" disabled={depLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-sm font-semibold">
                    {depLoading ? 'गणना चालू आहे...' : '⚡ घसारा मोजा (Calculate Preview)'}
                  </button>
                </div>
              </form>

              {/* Preview Table */}
              {depPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="overflow-x-auto border border-gray-200 rounded-sm">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-left">
                          <th className="px-2.5 py-1.5">#</th>
                          <th className="px-2.5 py-1.5">मालमत्ता कोड</th>
                          <th className="px-2.5 py-1.5">नाव</th>
                          <th className="px-2.5 py-1.5 text-right">पूर्वीचे मूल्य (WDV)</th>
                          <th className="px-2.5 py-1.5 text-right">घसारा दर (%)</th>
                          <th className="px-2.5 py-1.5 text-left">पद्धत</th>
                          <th className="px-2.5 py-1.5 text-right font-bold text-red-600">आकारणी घसारा (₹)</th>
                          <th className="px-2.5 py-1.5 text-right font-bold text-green-700">नवीन पुस्तकी मूल्य (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {depPreview.map((item, idx) => (
                          <tr key={item.assetID} className="hover:bg-blue-50 border-b border-gray-100 transition-colors">
                            <td className="px-2.5 py-1">{idx + 1}</td>
                            <td className="px-2.5 py-1 font-mono font-medium text-blue-700">{item.assetCode}</td>
                            <td className="px-2.5 py-1">{item.assetName}</td>
                            <td className="px-2.5 py-1 text-right">₹{fmt(item.bookValueBefore)}</td>
                            <td className="px-2.5 py-1 text-right text-green-700">{item.rate}%</td>
                            <td className="px-2.5 py-1">{item.method}</td>
                            <td className="px-2.5 py-1 text-right font-bold text-red-600">₹{fmt(item.depreciationAmount)}</td>
                            <td className="px-2.5 py-1 text-right font-bold text-green-700">₹{fmt(item.bookValueAfter)}</td>
                          </tr>
                        ))}
                        <tr className="bg-gray-100 font-bold">
                          <td colSpan={6} className="px-2.5 py-1.5 text-right">एकूण घसारा (Total Depreciation):</td>
                          <td className="px-2.5 py-1.5 text-right text-red-600">₹{fmt(depPreview.reduce((s, i) => s + i.depreciationAmount, 0))}</td>
                          <td className="px-2.5 py-1.5 text-right text-green-700">₹{fmt(depPreview.reduce((s, i) => s + i.bookValueAfter, 0))}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Accounting mapping settings */}
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs space-y-3">
                    <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={depPostVoucher} onChange={e => setDepPostVoucher(e.target.checked)} className="rounded" />
                      या घसारा आकारणीसाठी हिशोब वही मध्ये जनरल व्हाउचर पोस्ट करा (Post Journal Voucher)
                    </label>

                    {depPostVoucher && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block font-bold text-gray-600 mb-0.5">नावे खाते (Debit Depreciation Expense Ledger) *</label>
                          <select value={depDebitLedger} onChange={e => setDepDebitLedger(parseInt(e.target.value))} required
                            className="w-full border rounded px-2.5 py-1 bg-white">
                            <option value={0}>-- घसारा खर्च खाते निवडा --</option>
                            {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-gray-600 mb-0.5">जमा खाते (Credit Accumulated Depreciation / Asset Ledger) *</label>
                          <select value={depCreditLedger} onChange={e => setDepCreditLedger(parseInt(e.target.value))} required
                            className="w-full border rounded px-2.5 py-1 bg-white">
                            <option value={0}>-- जमा मालमत्ता खाते निवडा --</option>
                            {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2 border-t mt-2">
                      <button 
                        type="button" 
                        onClick={handleCommitDepreciation}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-sm font-semibold shadow-sm text-xs"
                      >
                        ⚡ घसारा प्रक्रिया पूर्ण करा (Commit and Post Depreciation)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MAINTENANCE LOG REGISTER */}
          {activeTab === 'maintenance' && (
            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-left">
                    <th className="px-2.5 py-2">#</th>
                    <th className="px-2.5 py-2">मालमत्ता कोड</th>
                    <th className="px-2.5 py-2">मालमत्ता नाव</th>
                    <th className="px-2.5 py-2">सर्व्हिस दिनांक</th>
                    <th className="px-2.5 py-2">सर्व्हिस प्रकार</th>
                    <th className="px-2.5 py-2">सर्व्हिस एजन्सी</th>
                    <th className="px-2.5 py-2 text-right">खर्च (₹)</th>
                    <th className="px-2.5 py-2">पुढील दिनांक</th>
                    <th className="px-2.5 py-2">नोंद व्हाउचर</th>
                    <th className="px-2.5 py-2">टिप्पणी</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={10} className="text-center py-4 text-gray-400">लोड होत आहे...</td></tr>
                  ) : maintenances.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-4 text-gray-400">कोणतीही देखभाल नोंद सापडली नाही.</td></tr>
                  ) : maintenances.map((m, idx) => (
                    <tr key={m.maintenanceID} className="hover:bg-blue-50 border-b border-gray-100 transition-colors">
                      <td className="px-2.5 py-1">{idx + 1}</td>
                      <td className="px-2.5 py-1 font-mono font-medium text-blue-700">{m.asset?.assetCode}</td>
                      <td className="px-2.5 py-1 font-medium">{m.asset?.assetName}</td>
                      <td className="px-2.5 py-1">{new Date(m.maintenanceDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td className="px-2.5 py-1 font-semibold text-orange-700">{m.maintenanceType}</td>
                      <td className="px-2.5 py-1">{m.serviceProvider}</td>
                      <td className="px-2.5 py-1 text-right font-bold text-gray-800">₹{fmt(m.cost)}</td>
                      <td className="px-2.5 py-1">{m.nextServiceDate ? new Date(m.nextServiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</td>
                      <td className="px-2.5 py-1 text-blue-800 font-bold">{m.voucher?.voucherNo || 'Manual'}</td>
                      <td className="px-2.5 py-1 text-gray-500 italic truncate max-w-[150px]">{m.remarks || '-'}</td>
                    </tr>
                  ))}
                  {maintenances.length > 0 && (
                    <tr className="bg-gray-100 font-bold border-t border-gray-300">
                      <td colSpan={6} className="px-2.5 py-1.5 text-right">एकूण (Total Cost):</td>
                      <td className="px-2.5 py-1.5 text-right text-gray-800">₹{fmt(maintenances.reduce((s, m) => s + m.cost, 0))}</td>
                      <td colSpan={3}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssetReports;


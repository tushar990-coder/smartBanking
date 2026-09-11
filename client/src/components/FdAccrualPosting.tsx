import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calculator, Search, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PreviewItem {
  fdAccountID: number;
  accountNo: string;
  memberID: number;
  memberName: string;
  memberCode: string;
  schemeName: string;
  openingDate: string;
  fromDate?: string;
  lastInterestPostingDate?: string;
  depositAmount: number;
  effectivePrincipal: number;
  alreadyAccruedInterest: number;
  elapsedDays: number;
  interestRate: number;
  calculatedInterest: number;
  calculationMethod: string;
  isSelected: boolean;
}

const FdAccrualPosting: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 1;
  const [branchID, setBranchID] = useState<number>(initialBranchId);

  const [accrualDate, setAccrualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [calculationMethod, setCalculationMethod] = useState<'OnPrincipal' | 'OnInterest'>('OnPrincipal');

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingPosting, setLoadingPosting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const API_URL = '/api';

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await axios.get(`${API_URL}/Branches`);
      setBranches(response.data);
    } catch (err) {
      console.error('Error fetching branches', err);
    }
  };

  // Calculate & Preview List
  const handleCalculatePreview = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setLoadingPreview(true);
    setPreviewItems([]);

    try {
      const payload = {
        branchID: branchID,
        accrualDate: accrualDate,
        calculationMethod: calculationMethod,
      };

      const response = await axios.post(`${API_URL}/FdAccounts/CalculateInterestPreview`, payload);
      const items: PreviewItem[] = (response.data || []).map((item: any) => ({
        ...item,
        isSelected: item.calculatedInterest > 0,
      }));
      setPreviewItems(items);

      if (items.length === 0) {
        setError('निवडलेल्या शाखेत व्याज मोजण्यासाठी कोणतेही सक्रिय मुदत ठेव खाते सापडले नाही.');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.response?.data || err.message || 'व्याज मोजणी करताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingPreview(false);
    }
  };

  // Toggle Single Selection
  const toggleSelect = (id: number) => {
    setPreviewItems((prev) =>
      prev.map((item) => (item.fdAccountID === id ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  // Toggle All Selection
  const toggleSelectAll = (checked: boolean) => {
    setPreviewItems((prev) =>
      prev.map((item) => ({ ...item, isSelected: checked && item.calculatedInterest > 0 }))
    );
  };

  // Post Selected Interest Accounts
  const handlePostSelected = async () => {
    const selected = previewItems.filter((i) => i.isSelected && i.calculatedInterest > 0);
    if (selected.length === 0) {
      setError('कृपया व्याज पोस्ट करण्यासाठी किमान एक खाते निवडा.');
      return;
    }

    if (!window.confirm(`तुम्हाला खरोखर निवडलेल्या ${selected.length} खातेदारांच्या खात्यांवर एकूण ₹ ${selected.reduce((sum, i) => sum + i.calculatedInterest, 0).toLocaleString('en-IN')} व्याज पोस्ट करायचे आहे का?`)) {
      return;
    }

    setError('');
    setSuccess('');
    setLoadingPosting(true);

    try {
      const payload = {
        branchID: branchID,
        accrualDate: accrualDate,
        calculationMethod: calculationMethod,
        selectedItems: selected.map((i) => ({
          fdAccountID: i.fdAccountID,
          calculatedInterest: i.calculatedInterest,
          elapsedDays: i.elapsedDays,
        })),
      };

      const response = await axios.post(`${API_URL}/FdAccounts/PostSelectedInterest`, payload);
      setSuccess(`✅ ${response.data.message} (व्हाउचर क्र: ${response.data.voucherNo})`);
      
      // Refresh list
      handleCalculatePreview();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.response?.data || err.message || 'व्याज पोस्ट करताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingPosting(false);
    }
  };

  const filteredItems = previewItems.filter(
    (item) =>
      item.accountNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.memberName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.memberCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.schemeName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCount = previewItems.filter((i) => i.isSelected && i.calculatedInterest > 0).length;
  const totalSelectedInterest = previewItems
    .filter((i) => i.isSelected && i.calculatedInterest > 0)
    .reduce((sum, i) => sum + i.calculatedInterest, 0);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* ERP Header Banner matching MemberMaster */}
      <div className="bg-primary px-3 py-2 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-200" />
          <div>
            <h1 className="text-sm font-bold tracking-wide">मुदत ठेव व्याज तरतूद (FD Interest Provision Run & Posting)</h1>
            <p className="text-[10px] text-blue-100 font-normal">खातेदारानुसार (Customer-wise) व्याज मोजणी, मुद्दलावर / व्याजावर निवड आणि सिस्टीम ऑटो-व्हाउचर पोस्टिंग</p>
          </div>
        </div>
        <span className="text-[10px] bg-blue-800/60 border border-blue-400/40 text-blue-100 font-semibold px-2 py-0.5 rounded font-mono">
          प्रोव्हिजन मॉड्यूल
        </span>
      </div>

      {/* Error / Success Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-sm text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <div className="whitespace-pre-line">{error}</div>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-2 rounded-sm text-xs flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <div className="whitespace-pre-line">{success}</div>
        </div>
      )}

      {/* Filter & Run Section Box matching MemberMaster Form Section */}
      <form onSubmit={handleCalculatePreview} className="bg-gray-50/80 p-2.5 rounded border border-gray-200 shadow-2xs">
        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center justify-between">
          <span>१. तरतूद निकष व व्याज मोजणी निवड (Provision Criteria & Calculation Base)</span>
          <span className="text-[10px] text-gray-500 font-normal normal-case">
            💡 {calculationMethod === 'OnPrincipal' ? 'फक्त मूळ ठेव मुद्दलावर मोजणी' : 'मुद्दल + पूर्वी जमा व्याजावर मोजणी (Compounding)'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-2">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शाखा (Branch) *</label>
            <select
              value={branchID}
              onChange={(e) => setBranchID(parseInt(e.target.value, 10))}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              {branches.map((b) => (
                <option key={b.branchID} value={b.branchID}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">तरतूद तारीख (Provision Date) *</label>
            <input
              type="date"
              value={accrualDate}
              onChange={(e) => setAccrualDate(e.target.value)}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              required
            />
          </div>

          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">व्याज मोजणी प्रकार (Calculation Base) *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCalculationMethod('OnPrincipal')}
                className={`flex-1 py-1 px-2 text-xs font-semibold rounded-sm border transition cursor-pointer flex items-center justify-center gap-1 ${
                  calculationMethod === 'OnPrincipal'
                    ? 'bg-primary text-white border-blue-900 font-bold shadow-xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                📌 मुद्दलावर (On Principal)
              </button>
              <button
                type="button"
                onClick={() => setCalculationMethod('OnInterest')}
                className={`flex-1 py-1 px-2 text-xs font-semibold rounded-sm border transition cursor-pointer flex items-center justify-center gap-1 ${
                  calculationMethod === 'OnInterest'
                    ? 'bg-purple-700 text-white border-purple-900 font-bold shadow-xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                📈 व्याजावर (On Interest)
              </button>

              <button
                type="submit"
                disabled={loadingPreview}
                className="bg-primary hover:bg-[#004a75] text-white px-4 py-1 rounded-sm shadow-sm text-xs font-medium cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                {loadingPreview ? 'मोजणी चालू...' : '🔍 मोजणी करा'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Customer Preview Table Section matching MemberMaster Table View */}
      {previewItems.length > 0 && (
        <div className="bg-white rounded-sm shadow-xs border border-gray-200 p-2.5 space-y-2">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-800">
                २. खातेदार-निहाय व्याज मोजणी तक्ता (Customer-wise List)
              </span>
              <span className="text-[11px] text-gray-500 font-medium">
                एकूण खाती: <strong className="text-primary font-bold">{previewItems.length}</strong> | निवडलेले: <strong className="text-emerald-700 font-bold">{selectedCount}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="नाव, कोड किंवा पावतीने शोधा..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-gray-300 pl-8 pr-2 py-1 rounded-sm text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                />
              </div>

              <button
                type="button"
                onClick={handlePostSelected}
                disabled={loadingPosting || selectedCount === 0}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded-sm shadow-sm text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                {loadingPosting ? 'सेव्ह होत आहे...' : `💾 निवडलेल्या (${selectedCount}) खात्यांवर व्याज पोस्ट करा (₹ ${Math.round(totalSelectedInterest).toLocaleString('en-IN')})`}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full border-collapse text-xs text-center">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-gray-300 z-10 font-bold text-[11px]">
                <tr>
                  <th className="px-2 py-1.5 border-r border-gray-200 text-center w-8">
                    <input
                      type="checkbox"
                      checked={selectedCount > 0 && selectedCount === previewItems.filter((i) => i.calculatedInterest > 0).length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="w-3.5 h-3.5 text-primary rounded border-gray-300 focus:ring-blue-400 cursor-pointer"
                    />
                  </th>
                  <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">पावती क्र.</th>
                  <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">खातेदाराचे नाव & कोड</th>
                  <th className="px-2.5 py-1.5 border-r border-gray-200 text-left">ठेव योजना</th>
                  <th className="px-2 py-1.5 border-r border-gray-200 text-center">ठेव दि.</th>
                  <th className="px-2 py-1.5 border-r border-gray-200 text-center" title="या तारखेपासून चालू व्याज मोजले जात आहे">व्याज सुरु दि.</th>
                  <th className="px-2.5 py-1.5 border-r border-gray-200 text-right">ठेव मुद्दल (₹)</th>
                  <th className="px-2.5 py-1.5 border-r border-gray-200 text-right">पूर्वी जमा व्याज (₹)</th>
                  <th className="px-2.5 py-1.5 border-r border-gray-200 text-right">मोजणी मुद्दल (₹)</th>
                  <th className="px-2 py-1.5 border-r border-gray-200 text-center">दिवस</th>
                  <th className="px-2 py-1.5 border-r border-gray-200 text-center">दर %</th>
                  <th className="px-2.5 py-1.5 border-r border-gray-200 text-right">नवीन व्याज (₹)</th>
                  <th className="px-2 py-1.5 text-center">मोजणी पद्धत</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-xs">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-gray-500 font-medium">
                      कोणतीही मुदत ठेव खाती सापडली नाहीत.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.fdAccountID}
                      className={`hover:bg-blue-50/60 transition-colors ${
                        item.isSelected ? 'bg-blue-50/30' : 'opacity-60'
                      }`}
                    >
                      <td className="px-2 py-1.5 border-r border-gray-100 text-center">
                        <input
                          type="checkbox"
                          checked={item.isSelected}
                          onChange={() => toggleSelect(item.fdAccountID)}
                          disabled={item.calculatedInterest <= 0}
                          className="w-3.5 h-3.5 text-primary rounded border-gray-300 focus:ring-blue-400 cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100 text-left font-bold text-primary">
                        {item.accountNo}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100 text-left">
                        <div className="font-bold text-gray-800">{item.memberName}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{item.memberCode}</div>
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100 text-left font-medium text-gray-700">
                        {item.schemeName}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-100 text-center text-gray-600 text-[11px]">
                        {formatDate(item.openingDate)}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-100 text-center text-[11px]">
                        <span className="font-semibold text-blue-700">
                          {formatDate(item.fromDate || item.openingDate)}
                        </span>
                        {item.lastInterestPostingDate && (
                          <span className="block text-[9px] text-amber-700 font-bold bg-amber-50 rounded px-1 mt-0.5" title="मायग्रेशन शेवटची व्याज तारीख कट-ऑफ">
                            मायग्रेशन कट-ऑफ
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100 text-right font-semibold text-gray-800">
                        ₹ {Math.round(item.depositAmount).toLocaleString('en-IN')}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100 text-right font-semibold text-purple-700">
                        ₹ {Math.round(item.alreadyAccruedInterest).toLocaleString('en-IN')}
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100 text-right font-bold text-blue-900 bg-blue-50/40">
                        ₹ {Math.round(item.effectivePrincipal).toLocaleString('en-IN')}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-100 text-center font-semibold text-gray-700">
                        {item.elapsedDays}
                      </td>
                      <td className="px-2 py-1.5 border-r border-gray-100 text-center font-semibold text-gray-700">
                        {item.interestRate}%
                      </td>
                      <td className="px-2.5 py-1.5 border-r border-gray-100 text-right font-black text-emerald-700 text-xs">
                        ₹ {Math.round(item.calculatedInterest).toLocaleString('en-IN')}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.calculationMethod === 'OnInterest' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {item.calculationMethod === 'OnInterest' ? 'व्याजावर' : 'मुद्दलावर'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FdAccrualPosting;

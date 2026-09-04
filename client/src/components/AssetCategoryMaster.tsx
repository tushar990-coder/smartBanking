import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Package, Search, X, Edit, Trash2, Plus, Eye, RefreshCw, CheckCircle2 } from 'lucide-react';

interface AssetCategory {
  categoryID: number;
  branchID: number;
  categoryCode: string;
  categoryName: string;
  usefulLifeMonths: number;
  depreciationRate: number;
  depreciationMethod: string;
  status: string;
}

const AssetCategoryMaster: React.FC = () => {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const categoryNameInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  const [formData, setFormData] = useState({
    branchID: 1,
    categoryCode: '',
    categoryName: '',
    usefulLifeMonths: 36,
    depreciationRate: 15.0,
    depreciationMethod: 'WDV',
    status: 'Active',
  });

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const [catRes, branchRes] = await Promise.allSettled([
        axios.get(`${API_URL}/AssetCategories`),
        axios.get(`${API_URL}/Branches`)
      ]);

      if (catRes.status === 'fulfilled') setCategories(catRes.value.data);
      if (branchRes.status === 'fulfilled') setBranches(branchRes.value.data);
    } catch {
      setError('मालमत्ता वर्ग लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'branchID' || name === 'usefulLifeMonths' ? parseInt(value) : name === 'depreciationRate' ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.categoryCode || !formData.categoryName) {
      setError('कृपया आवश्यक फील्ड भरा. (Please fill required fields.)');
      return;
    }

    try {
      if (isEditMode && editId) {
        await axios.put(`${API_URL}/AssetCategories/${editId}`, {
          ...formData,
          categoryID: editId,
        });
        setSuccess('मालमत्ता वर्ग यशस्वीरित्या अपडेट झाला! (Asset category updated successfully!)');
      } else {
        await axios.post(`${API_URL}/AssetCategories`, formData);
        setSuccess('नवीन मालमत्ता वर्ग यशस्वीरित्या जोडला गेला! (New asset category added successfully!)');
      }
      resetForm();
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data || 'जतन करताना त्रुटी आली. (Error saving category.)');
    }
  };

  const handleEdit = (c: AssetCategory) => {
    setIsEditMode(true);
    setEditId(c.categoryID);
    setFormData({
      branchID: c.branchID,
      categoryCode: c.categoryCode,
      categoryName: c.categoryName,
      usefulLifeMonths: c.usefulLifeMonths,
      depreciationRate: c.depreciationRate,
      depreciationMethod: c.depreciationMethod,
      status: c.status,
    });
    setIsListModalOpen(false);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (categoryNameInputRef.current) {
        categoryNameInputRef.current.focus();
        categoryNameInputRef.current.select();
      }
    }, 120);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('तुम्हाला खात्री आहे का की हा मालमत्ता वर्ग डिलीट करायचा आहे? (Are you sure you want to delete this category?)')) return;
    setError('');
    setSuccess('');
    try {
      await axios.delete(`${API_URL}/AssetCategories/${id}`);
      setSuccess('मालमत्ता वर्ग यशस्वीरित्या डिलीट केला! (Asset category deleted successfully!)');
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data || 'डिलीट करताना त्रुटी आली. (Error deleting category.)');
    }
  };

  const resetForm = () => {
    setIsEditMode(false);
    setEditId(null);
    setFormData({
      branchID: 1,
      categoryCode: '',
      categoryName: '',
      usefulLifeMonths: 36,
      depreciationRate: 15.0,
      depreciationMethod: 'WDV',
      status: 'Active',
    });
  };

  const filteredCategories = categories.filter(c => {
    if (!c) return false;
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (c.categoryCode && c.categoryCode.toLowerCase().includes(q)) ||
      (c.categoryName && c.categoryName.toLowerCase().includes(q)) ||
      (c.depreciationMethod && c.depreciationMethod.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans relative overflow-y-auto">
      {/* Container */}
      <div 
        ref={formContainerRef}
        className={`bg-white rounded-md shadow-sm border overflow-hidden flex flex-col transition-all duration-300 ${
          isEditMode ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-gray-300'
        }`}
      >

        {/* Hero Header Banner matching Investment Institution Master */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0E8A5A] to-emerald-950 text-white px-3 py-2 flex items-center justify-between shadow-sm">
          <h2 className="text-xs font-bold tracking-wide flex items-center gap-1.5">
            <Package className="w-4 h-4 text-emerald-400" />
            <span>मालमत्ता वर्ग मास्टर (Asset Category Master)</span>
            {isEditMode && editId && (
              <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded font-extrabold ml-1 animate-pulse">
                ✏️ संपादन चालू (#{editId})
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            {isEditMode && (
              <button
                type="button"
                onClick={resetForm}
                className="px-2.5 py-0.5 rounded bg-red-600/80 hover:bg-red-600 text-white text-xs font-medium border border-red-400/40 transition-all cursor-pointer"
              >
                ✕ संपादन रद्द करा (Cancel)
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsListModalOpen(true)}
              className="px-2.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>मालमत्ता वर्ग यादी ({categories.length})</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-sm text-xs mb-2">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-sm text-xs mb-2">{success}</div>}

          {/* Section: वर्ग व घसारा माहिती */}
          <div className="bg-gray-50/80 p-2.5 rounded border border-gray-200 mb-3">
            <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-200 flex items-center gap-1">
              <span>📋</span> मालमत्ता वर्ग व घसारा तपशील (Asset Category & Depreciation Info)
            </div>

            {/* Row 1 - 4 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 mb-2.5">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शाखा (Branch) *</label>
                <select name="branchID" value={formData.branchID} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                  {branches.map((b: any) => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वर्ग कोड (Category Code) *</label>
                <input type="text" name="categoryCode" value={formData.categoryCode} onChange={handleChange} required
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-blue-900"
                  placeholder="उदा. COMP, FURN, BLDG" />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वर्ग नाव (Category Name) *</label>
                <input 
                  ref={categoryNameInputRef}
                  type="text" 
                  name="categoryName" 
                  value={formData.categoryName} 
                  onChange={handleChange} 
                  required
                  className={`w-full border rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${
                    isEditMode ? 'border-primary bg-amber-50/40 font-semibold' : 'border-gray-300 bg-white'
                  }`}
                  placeholder="उदा. संगणक (Computers)" 
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">उपयुक्त आयुष्य (महिने) *</label>
                <input type="number" name="usefulLifeMonths" value={formData.usefulLifeMonths} onChange={handleChange} required min="1"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" placeholder="36" />
              </div>
            </div>

            {/* Row 2 - 4 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">घसारा दर (Depreciation Rate %) *</label>
                <input type="number" name="depreciationRate" value={formData.depreciationRate} onChange={handleChange} required step="0.01" min="0" max="100"
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white font-bold text-emerald-800" />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">घसारा पद्धत (Depreciation Method) *</label>
                <select name="depreciationMethod" value={formData.depreciationMethod} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                  <option value="WDV">Written Down Value (WDV)</option>
                  <option value="SLM">Straight Line Method (SLM)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">स्थिती (Status) *</label>
                <select name="status" value={formData.status} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                  <option value="Active">Active (सक्रिय)</option>
                  <option value="Inactive">Inactive (निष्क्रिय)</option>
                </select>
              </div>

              <div className="flex items-end">
                <p className="text-[10px] text-gray-500 italic leading-tight pb-1">
                  * मालमत्ता वर्गानुसार कर व घसारा गणना ऑटो सिस्टीमद्वारे लादली जाईल.
                </p>
              </div>
            </div>
          </div>

          {/* Form Controls */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-200">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1 rounded-sm shadow-xs text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>{isEditMode ? '✏️ अपडेट करा (Update)' : '💾 जतन करा (Save Category)'}</span>
            </button>

            {isEditMode && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-sm text-xs font-medium cursor-pointer"
              >
                ❌ रद्द करा (Cancel)
              </button>
            )}
          </div>
        </form>

        {/* In-page Master Table */}
        <div className="p-3 pt-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>📊</span> नोंदणीकृत मालमत्ता वर्ग यादी (Registered Categories)
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="शोध (Search Code/Name)..."
                className="w-full pl-7 pr-2 py-0.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                  <th className="px-3 py-2 text-left w-10">#</th>
                  <th className="px-3 py-2 text-left">वर्ग कोड (Code)</th>
                  <th className="px-3 py-2 text-left">मालमत्ता वर्ग नाव (Name)</th>
                  <th className="px-3 py-2 text-right">उपयुक्त आयुष्य</th>
                  <th className="px-3 py-2 text-right">घसारा दर (%)</th>
                  <th className="px-3 py-2 text-left">घसारा पद्धत</th>
                  <th className="px-3 py-2 text-center">स्थिती</th>
                  <th className="px-3 py-2 text-center w-20">कृती</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-4 text-gray-400">लोड होत आहे...</td></tr>
                ) : filteredCategories.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-4 text-gray-400">कोणतेही मालमत्ता वर्ग आढळले नाहीत.</td></tr>
                ) : filteredCategories.map((c, idx) => (
                  <tr key={c.categoryID} className="hover:bg-emerald-50/50 border-b border-gray-100 transition-colors">
                    <td className="px-3 py-1.5 font-bold text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-1.5 font-mono font-bold text-blue-900">{c.categoryCode}</td>
                    <td className="px-3 py-1.5 font-bold text-gray-800">{c.categoryName}</td>
                    <td className="px-3 py-1.5 text-right font-medium">{c.usefulLifeMonths} महिने</td>
                    <td className="px-3 py-1.5 text-right font-extrabold text-emerald-700">{c.depreciationRate}%</td>
                    <td className="px-3 py-1.5 font-medium">{c.depreciationMethod}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`inline-block px-2 py-0.2 rounded-full text-[10px] font-bold ${c.status === 'Active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                        {c.status === 'Active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                          title="संपादित करा"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.categoryID)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                          title="डिलीट करा"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SEARCH LIST MODAL POPUP */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-[#0E8A5A] to-emerald-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">सर्व मालमत्ता वर्ग यादी (Asset Categories List)</h3>
              </div>
              <button
                onClick={() => setIsListModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="वर्ग कोड, नाव किंवा पद्धतीनुसार शोधा..."
                  className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div className="text-xs font-semibold text-gray-600">
                एकूण नोंदी: <span className="text-emerald-700 font-extrabold">{filteredCategories.length}</span>
              </div>
            </div>

            <div className="p-3 overflow-y-auto flex-1">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white font-semibold border-b border-slate-800">
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left">वर्ग कोड (Code)</th>
                    <th className="px-3 py-2 text-left">वर्ग नाव (Name)</th>
                    <th className="px-3 py-2 text-right">उपयुक्त आयुष्य</th>
                    <th className="px-3 py-2 text-right">घसारा दर (%)</th>
                    <th className="px-3 py-2 text-left">घसारा पद्धत</th>
                    <th className="px-3 py-2 text-center">स्थिती</th>
                    <th className="px-3 py-2 text-center w-16">निवडा</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-6 text-gray-400">कोणत्याही नोंदी सापडल्या नाहीत.</td></tr>
                  ) : filteredCategories.map((c, idx) => (
                    <tr key={c.categoryID} className="hover:bg-emerald-50/60 border-b border-gray-100 transition-colors">
                      <td className="px-3 py-2 font-bold text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono font-bold text-blue-900">{c.categoryCode}</td>
                      <td className="px-3 py-2 font-bold text-gray-800">{c.categoryName}</td>
                      <td className="px-3 py-2 text-right font-medium">{c.usefulLifeMonths} महिने</td>
                      <td className="px-3 py-2 text-right font-extrabold text-emerald-700">{c.depreciationRate}%</td>
                      <td className="px-3 py-2 font-medium">{c.depreciationMethod}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-2 py-0.2 rounded-full text-[10px] font-bold ${c.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleEdit(c)}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          निवडा
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setIsListModalOpen(false)}
                className="px-4 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded text-xs"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetCategoryMaster;


import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Package,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Save,
  RotateCcw,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Search,
  Building,
  Layers,
  Calendar,
  X,
  IndianRupee,
  Percent,
  CheckCircle2,
  Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

interface AssetCategory {
  categoryID: number;
  categoryName: string;
  categoryCode: string;
  depreciationRate: number;
  depreciationMethod: string;
  usefulLifeYears?: number;
}

interface Asset {
  assetID: number;
  branchID: number;
  branch?: { branchID: number; branchName: string };
  categoryID: number;
  category?: AssetCategory;
  assetCode: string;
  assetName: string;
  purchaseDate: string;
  originalCost: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
  status: string;
  location?: string;
  custodian?: string;
  isOpeningBalance: boolean;
}

export default function DeadstockOpeningBalance() {
  const { user, globalBranchId } = useAuth();
  const effectiveBranchId = globalBranchId ? Number(globalBranchId) : (user?.branchID ? Number(user.branchID) : 1);
  const isHeadOfficeOrAdmin = user?.role === 'Admin' || user?.branchType === 'HeadOffice';
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingGl, setSyncingGl] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [branchFilter, setBranchFilter] = useState(isHeadOfficeOrAdmin ? 'all' : String(effectiveBranchId));
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [showForm, setShowForm] = useState(true);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const assetCodeInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    branchID: effectiveBranchId,
    categoryID: 0,
    assetCode: '',
    assetName: '',
    purchaseDate: '2026-03-31',
    quantity: 1,
    costMode: 'perUnit' as 'perUnit' | 'total',
    originalCost: 0,
    accumulatedDepreciation: 0,
    location: '',
    custodian: '',
    isOpeningBalance: true
  });

  const API_URL = '/api';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      let assetUrl = `${API_URL}/Assets?`;
      if (branchFilter !== 'all') assetUrl += `branchId=${branchFilter}&`;
      if (categoryFilter !== 'all') assetUrl += `categoryId=${categoryFilter}&`;

      const [assetsRes, catRes, branchRes] = await Promise.allSettled([
        axios.get(assetUrl),
        axios.get(`${API_URL}/AssetCategories`),
        axios.get(`${API_URL}/Branches`)
      ]);

      if (assetsRes.status === 'fulfilled') {
        const raw: Asset[] = assetsRes.value.data || [];
        // Only show opening balance assets
        const openingAssets = raw.filter(a => a.isOpeningBalance || a.accumulatedDepreciation > 0);
        setAssets(openingAssets);
      }
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data || []);
      if (branchRes.status === 'fulfilled') setBranches(branchRes.value.data || []);
    } catch (err: any) {
      console.error('Error loading deadstock data', err);
      setError('डेटा लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [branchFilter, categoryFilter]);

  // Derived Calculations for current form
  const safeQty = Math.max(1, formData.quantity || 1);
  const isPerUnit = formData.costMode === 'perUnit';
  const unitCost = isPerUnit ? formData.originalCost : (formData.originalCost / safeQty);
  const unitDepr = isPerUnit ? formData.accumulatedDepreciation : (formData.accumulatedDepreciation / safeQty);
  const unitWdv = Math.max(0, unitCost - unitDepr);

  const totalCostCalc = isPerUnit ? (formData.originalCost * safeQty) : formData.originalCost;
  const totalDeprCalc = isPerUnit ? (formData.accumulatedDepreciation * safeQty) : formData.accumulatedDepreciation;
  const totalWdvCalc = Math.max(0, totalCostCalc - totalDeprCalc);

  // Form Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      const numVal = parseFloat(value) || 0;
      setFormData(prev => ({ ...prev, [name]: numVal }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setEditingAssetId(null);
    setFormData({
      branchID: branchFilter !== 'all' ? Number(branchFilter) : effectiveBranchId,
      categoryID: 0,
      assetCode: '',
      assetName: '',
      purchaseDate: '2026-03-31',
      quantity: 1,
      costMode: 'perUnit',
      originalCost: 0,
      accumulatedDepreciation: 0,
      location: '',
      custodian: '',
      isOpeningBalance: true
    });
  };

  const handleEditClick = (asset: Asset) => {
    setEditingAssetId(asset.assetID);
    setShowForm(true);
    setFormData({
      branchID: asset.branchID,
      categoryID: asset.categoryID,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '2026-03-31',
      quantity: 1,
      costMode: 'perUnit',
      originalCost: asset.originalCost,
      accumulatedDepreciation: asset.accumulatedDepreciation,
      location: asset.location || '',
      custodian: asset.custodian || '',
      isOpeningBalance: true
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryID || formData.categoryID === 0) {
      setError('कृपया मालमत्ता वर्ग (Category) निवडा.');
      return;
    }
    if (!formData.assetCode.trim() || !formData.assetName.trim()) {
      setError('मालमत्ता कोड आणि नाव भरणे आवश्यक आहे.');
      return;
    }
    if (formData.originalCost <= 0) {
      setError('मूळ खरेदी किंमत ० पेक्षा जास्त असावी.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingAssetId) {
        // Update existing single asset
        await axios.put(`${API_URL}/Assets/${editingAssetId}`, {
          assetID: editingAssetId,
          institutionID: 1,
          branchID: formData.branchID,
          financialYearID: 1,
          categoryID: formData.categoryID,
          assetCode: formData.assetCode.trim(),
          assetName: formData.assetName.trim(),
          purchaseDate: formData.purchaseDate,
          originalCost: formData.originalCost,
          accumulatedDepreciation: formData.accumulatedDepreciation,
          currentBookValue: Math.max(0, formData.originalCost - formData.accumulatedDepreciation),
          status: 'Active',
          location: formData.location,
          custodian: formData.custodian,
          isOpeningBalance: true
        });
        setSuccess(`मालमत्ता '${formData.assetCode}' ची सुरुवातीची शिल्लक यशस्वीरीत्या अद्ययावत केली!`);
      } else {
        // Create new opening asset (single or batch by quantity)
        const payload = {
          branchID: formData.branchID,
          categoryID: formData.categoryID,
          assetCode: formData.assetCode.trim(),
          assetName: formData.assetName.trim(),
          purchaseDate: formData.purchaseDate,
          quantity: safeQty,
          costMode: formData.costMode,
          originalCost: formData.originalCost,
          accumulatedDepreciation: formData.accumulatedDepreciation,
          location: formData.location,
          custodian: formData.custodian,
          isOpeningBalance: true,
          createdBy: user?.userID || 1
        };

        const res = await axios.post(`${API_URL}/Assets/opening-batch`, payload);
        const count = Array.isArray(res.data) ? res.data.length : safeQty;
        setSuccess(`यशस्वी! ${count} डेडस्टॉक सुरुवातीची शिल्लक नोंद सुरक्षितपणे जतन झाली.`);

        // Auto sync with GL
        try {
          await axios.post(`${API_URL}/Assets/sync-opening-balances?branchId=${formData.branchID}`);
        } catch { }
      }

      resetForm();
      fetchData();
    } catch (err: any) {
      console.error('Error saving opening asset', err);
      setError(err.response?.data?.message || err.response?.data || 'डेडस्टॉक नोंद जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`मालमत्ता क्र. ${asset.assetCode} (${asset.assetName}) ची सुरुवातीची शिल्लक खरोखर डिलीट करायची आहे का?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await axios.delete(`${API_URL}/Assets/${asset.assetID}`);
      setSuccess(`मालमत्ता क्र. ${asset.assetCode} यशस्वीरीत्या डिलीट करण्यात आली.`);

      // Sync GL after delete
      try {
        await axios.post(`${API_URL}/Assets/sync-opening-balances?branchId=${asset.branchID}`);
      } catch { }

      fetchData();
    } catch (err: any) {
      console.error('Error deleting asset', err);
      setError(err.response?.data?.message || err.response?.data || 'मालमत्ता डिलीट करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click GL & Balance Sheet Sync
  const handleSyncToGl = async () => {
    setSyncingGl(true);
    setError('');
    setSuccess('');
    try {
      const bId = branchFilter !== 'all' ? branchFilter : '';
      const res = await axios.post(`${API_URL}/Assets/sync-opening-balances${bId ? `?branchId=${bId}` : ''}`);
      setSuccess(res.data?.message || 'डेडस्टॉक सुरुवातीची शिल्लक ताळेबंद (Balance Sheet) व खतावणीशी यशस्वीरीत्या सिंक झाली!');
    } catch (err: any) {
      console.error('Error syncing deadstock to GL', err);
      setError(err.response?.data?.message || err.response?.data || 'ताळेबंद सिंक करताना त्रुटी आली.');
    } finally {
      setSyncingGl(false);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    if (filteredAssets.length === 0) {
      alert('एक्सपोर्ट करण्यासाठी कोणताही डेटा उपलब्ध नाही.');
      return;
    }

    const rows = filteredAssets.map((a, idx) => ({
      'अ.क्र.': idx + 1,
      'शाखा': a.branch?.branchName || a.branchID,
      'मालमत्ता वर्ग': a.category?.categoryName || a.categoryID,
      'मालमत्ता कोड': a.assetCode,
      'मालमत्ता नाव': a.assetName,
      'खरेदी तारीख': a.purchaseDate ? a.purchaseDate.split('T')[0] : '',
      'मूळ खरेदी किंमत (₹)': a.originalCost,
      'एकत्रित घसारा (₹)': a.accumulatedDepreciation,
      'पुस्तकी मूल्य (WDV ₹)': a.currentBookValue,
      'स्थान (Location)': a.location || '-',
      'कस्टोडियन (Custodian)': a.custodian || '-',
      'स्थिती': a.status
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DeadstockOpeningBalances');
    XLSX.writeFile(wb, `Deadstock_Opening_Balances_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Filtered Assets List
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = a.assetCode?.toLowerCase().includes(q);
        const nameMatch = a.assetName?.toLowerCase().includes(q);
        const catMatch = a.category?.categoryName?.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !catMatch) return false;
      }
      return true;
    });
  }, [assets, searchQuery]);

  // Overall KPIs
  const totalItems = filteredAssets.length;
  const totalCost = filteredAssets.reduce((sum, a) => sum + (Number(a.originalCost) || 0), 0);
  const totalDepreciation = filteredAssets.reduce((sum, a) => sum + (Number(a.accumulatedDepreciation) || 0), 0);
  const totalBookValue = filteredAssets.reduce((sum, a) => sum + (Number(a.currentBookValue) || 0), 0);

  const inputClass = "w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-sm bg-white text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all";
  const selectClass = "w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-sm bg-white text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer";
  const labelClass = "block text-[11px] font-bold text-slate-700 mb-1";

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">

      {/* 1. Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Package size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>डेडस्टॉक सुरुवातीची शिल्लक</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Deadstock Opening Balances)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              स्थिर मालमत्तांची नोंद, सुरुवातीची खरेदी किंमत, घसारा व ताळेबंद खतावणी सिंक व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Branch Filter */}
          {isHeadOfficeOrAdmin && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 hidden md:inline">शाखा:</span>
              <select
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                className="text-xs px-2 py-1 border border-slate-300 rounded-sm bg-white text-slate-700 font-medium focus:outline-none focus:border-primary"
              >
                <option value="all">सर्व शाखा (All Branches)</option>
                {branches.map((b: any) => (
                  <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="डेटा रिफ्रेश करा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-sm flex items-center justify-between text-xs font-medium animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-sm flex items-center justify-between text-xs font-medium animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">एकूण डेडस्टॉक वस्तू</div>
            <div className="text-base font-bold text-slate-800 mt-0.5">{totalItems} नग</div>
          </div>
          <div className="p-2 rounded bg-slate-100 text-slate-600">
            <Package size={18} />
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">एकूण मूळ खरेदी किंमत</div>
            <div className="text-base font-bold text-blue-700 mt-0.5">₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="p-2 rounded bg-blue-50 text-blue-600">
            <IndianRupee size={18} />
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase">आजवरचा एकूण घसारा</div>
            <div className="text-base font-bold text-amber-700 mt-0.5">₹{totalDepreciation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="p-2 rounded bg-amber-50 text-amber-600">
            <Percent size={18} />
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-emerald-200 shadow-2xs flex items-center justify-between bg-gradient-to-br from-emerald-50/50 to-white">
          <div>
            <div className="text-[10px] font-bold text-emerald-700 uppercase">पुस्तकी मूल्य (WDV)</div>
            <div className="text-base font-bold text-emerald-800 mt-0.5">₹{totalBookValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div className="p-2 rounded bg-emerald-100 text-emerald-700">
            <CheckCircle size={18} />
          </div>
        </div>
      </div>

      {/* 3. Opening Balance Entry Form */}
      <div className="bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary mb-3 overflow-hidden transition-all duration-200 animate-in fade-in">
        <div className="bg-slate-50 px-3.5 py-2 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-primary/10 text-primary rounded">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-800">
                {editingAssetId ? 'डेडस्टॉक नोंद दुरुस्ती (Edit Deadstock Opening Entry)' : 'नवीन डेडस्टॉक शिल्लक नोंद (New Deadstock Opening Balance Entry)'}
              </h3>
              <p className="text-[10px] text-gray-500">प्रारंभिक शिल्लक (Opening Balance) मालमत्तेची माहिती, खरेदी किंमत व घसारा नोंदवा</p>
            </div>
          </div>
          {editingAssetId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <X size={12} />
              <span>दुरुस्ती रद्द करा</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-3.5 space-y-3">
          {/* Row 1: Branch, Category, Code, Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div>
              <label className={labelClass}>शाखा (Branch) *</label>
              <select
                name="branchID"
                value={formData.branchID}
                onChange={handleInputChange}
                className={selectClass}
                required
              >
                {branches.map((b: any) => (
                  <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>मालमत्ता वर्ग (Category) *</label>
              <select
                name="categoryID"
                value={formData.categoryID}
                onChange={handleInputChange}
                className={selectClass}
                required
              >
                <option value={0}>-- वर्ग निवडा --</option>
                {categories.map((c: any) => (
                  <option key={c.categoryID} value={c.categoryID}>
                    {c.categoryName} ({c.depreciationRate}% {c.depreciationMethod || 'SLM'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>
                {safeQty > 1 ? 'मालमत्ता कोड प्रिफिक्स (Asset Code Prefix) *' : 'मालमत्ता कोड (Asset Code) *'}
              </label>
              <input
                ref={assetCodeInputRef}
                type="text"
                name="assetCode"
                value={formData.assetCode}
                onChange={handleInputChange}
                required
                placeholder={safeQty > 1 ? "उदा. COMP-HQ किंवा FURN" : "उदा. COMP-HQ-01"}
                className={`${inputClass} font-mono font-bold text-primary`}
              />
            </div>

            <div>
              <label className={labelClass}>मालमत्ता नाव (Asset Name) *</label>
              <input
                type="text"
                name="assetName"
                value={formData.assetName}
                onChange={handleInputChange}
                required
                placeholder="उदा. Lenovo ThinkCentre / Executive Chair / Godrej Safe"
                className={inputClass}
              />
            </div>
          </div>

          {/* Row 2: Purchase Date, Quantity, Calculation Mode, Original Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div>
              <label className={labelClass}>खरेदी तारीख (Purchase Date) *</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleInputChange}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                <span className="text-primary font-bold">नग / संख्या (Quantity) *</span>
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity || ''}
                onChange={handleInputChange}
                required
                min="1"
                step="1"
                disabled={editingAssetId !== null}
                className={`${inputClass} font-bold text-primary bg-primary/5 border-primary/30`}
                placeholder="1"
              />
            </div>

            <div>
              <label className={labelClass}>किंमत पद्धत (Calculation Mode)</label>
              <select
                name="costMode"
                value={formData.costMode}
                onChange={handleInputChange}
                disabled={editingAssetId !== null || safeQty <= 1}
                className={selectClass}
              >
                <option value="perUnit">प्रति नग किंमत (Per Item Cost)</option>
                <option value="total">एकूण एकत्रित किंमत (Total Lump-sum)</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>
                {formData.costMode === 'perUnit' ? 'प्रति नग मूळ किंमत (Cost / Unit ₹) *' : 'सर्व नगांची एकूण किंमत (Total Cost ₹) *'}
              </label>
              <input
                type="number"
                name="originalCost"
                value={formData.originalCost || ''}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className={`${inputClass} font-semibold`}
              />
            </div>
          </div>

          {/* Row 3: Accumulated Depr, Unit WDV, Location, Custodian */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            <div>
              <label className={labelClass}>
                {formData.costMode === 'perUnit' ? 'प्रति नग घसारा (Depr / Unit ₹)' : 'एकूण एकत्रित घसारा (Total Depr ₹)'}
              </label>
              <input
                type="number"
                name="accumulatedDepreciation"
                value={formData.accumulatedDepreciation || ''}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>प्रति नग WDV (Unit Book Value ₹)</label>
              <input
                type="text"
                value={unitWdv.toFixed(2)}
                readOnly
                className={`${inputClass} bg-slate-100 font-mono font-bold text-slate-700 cursor-not-allowed`}
              />
            </div>

            <div>
              <label className={labelClass}>स्थान (Location)</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="उदा. मुख्य दालन, केबिन, रेकॉर्ड रूम"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>कस्टोडियन / जबाबदार व्यक्ती</label>
              <input
                type="text"
                name="custodian"
                value={formData.custodian}
                onChange={handleInputChange}
                placeholder="उदा. शाखा व्यवस्थापक, कॅशियर"
                className={inputClass}
              />
            </div>
          </div>

          {/* Live Calculation Preview Banner */}
          <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-600 font-medium">
                एकूण नग: <strong className="text-slate-900 font-bold">{safeQty}</strong>
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 font-medium">
                एकूण मूळ किंमत: <strong className="text-blue-700 font-bold">₹{totalCostCalc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 font-medium">
                एकूण घसारा: <strong className="text-amber-700 font-bold">₹{totalDeprCalc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-600 font-medium">
                एकूण पुस्तकी मूल्य (WDV): <strong className="text-emerald-700 font-bold">₹{totalWdvCalc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>

            {safeQty > 1 && (
              <div className="text-[11px] font-mono text-primary font-bold">
                सिक्वेन्स: {formData.assetCode.trim() || 'ASSET'}-001 ते {formData.assetCode.trim() || 'ASSET'}-{String(safeQty).padStart(3, '0')}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-sm border border-slate-300 transition-all cursor-pointer"
            >
              रीसेट (Reset)
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-primary hover:opacity-90 disabled:opacity-50 text-white rounded-sm text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={13} />
              <span>{saving ? 'जतन होत आहे...' : editingAssetId ? 'बदल जतन करा (Update)' : 'सुरुवातीची शिल्लक जतन करा (Save Entry)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 4. Registered Deadstock Opening Balances Table */}
      <div className="bg-white rounded-sm border border-slate-200 shadow-2xs overflow-hidden flex flex-col flex-1">
        {/* Table Header & Search */}
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-slate-500" />
            <span className="text-xs font-bold text-slate-800">नोंदवलेली डेडस्टॉक शिल्लक यादी</span>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-mono">
              {filteredAssets.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-xs px-2 py-1 border border-slate-300 rounded-sm bg-white text-slate-700 font-medium focus:outline-none focus:border-primary"
            >
              <option value="all">सर्व वर्ग (All Categories)</option>
              {categories.map((c: any) => (
                <option key={c.categoryID} value={c.categoryID}>{c.categoryName}</option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="कोड, नाव किंवा वर्गाने शोधा..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs border border-slate-300 rounded-sm bg-white text-slate-800 focus:outline-none focus:border-primary w-48 sm:w-64"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                <th className="py-2 px-2.5 w-10 text-center">अ.क्र.</th>
                <th className="py-2 px-2.5 w-28">मालमत्ता कोड</th>
                <th className="py-2 px-2.5">मालमत्ता नाव</th>
                <th className="py-2 px-2.5">वर्ग (Category)</th>
                <th className="py-2 px-2.5">शाखा</th>
                <th className="py-2 px-2.5 w-24">खरेदी तारीख</th>
                <th className="py-2 px-2.5 text-right w-24">मूळ किंमत (₹)</th>
                <th className="py-2 px-2.5 text-right w-24">घसारा (₹)</th>
                <th className="py-2 px-2.5 text-right w-28 font-bold text-emerald-800">पुस्तकी मूल्य (₹)</th>
                <th className="py-2 px-2.5">स्थान / कस्टोडियन</th>
                <th className="py-2 px-2.5 w-16 text-center">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-primary" />
                    <span>डेटा लोड होत आहे, कृपया थांबा...</span>
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    <Package size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-600 text-xs">कोणतीही डेडस्टॉक शिल्लक नोंद आढळली नाही</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">नवीन डेडस्टॉक शिल्लक नोंदवण्यासाठी वरील फॉर्म वापरा</p>
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset, index) => (
                  <tr
                    key={asset.assetID}
                    className="hover:bg-slate-50 transition-colors group text-slate-700"
                  >
                    <td className="py-1.5 px-2.5 text-center text-[10px] text-slate-400 font-mono">
                      {index + 1}
                    </td>
                    <td className="py-1.5 px-2.5 font-mono font-bold text-primary">
                      {asset.assetCode}
                    </td>
                    <td className="py-1.5 px-2.5 font-medium text-slate-900">
                      {asset.assetName}
                    </td>
                    <td className="py-1.5 px-2.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                        <Tag size={10} className="text-slate-400" />
                        {asset.category?.categoryName || '-'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-600">
                      {asset.branch?.branchName || `शाखा #${asset.branchID}`}
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-600 font-mono text-[11px]">
                      {asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '-'}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-medium text-slate-800">
                      ₹{Number(asset.originalCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono text-amber-700 font-medium">
                      ₹{Number(asset.accumulatedDepreciation).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-700 bg-emerald-50/30">
                      ₹{Number(asset.currentBookValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-500 text-[11px]">
                      {asset.location || asset.custodian ? (
                        <span>
                          {asset.location && <span className="font-medium text-slate-700">{asset.location}</span>}
                          {asset.location && asset.custodian && ' • '}
                          {asset.custodian && <span>{asset.custodian}</span>}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2.5 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleEditClick(asset)}
                          className="p-1 hover:bg-blue-100 text-blue-600 rounded transition-all cursor-pointer"
                          title="दुरुस्त करा (Edit)"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(asset)}
                          className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-all cursor-pointer"
                          title="हटवा (Delete)"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredAssets.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t border-slate-300 text-slate-800">
                  <td colSpan={6} className="py-2 px-2.5 text-right text-xs uppercase tracking-wider">
                    एकूण (Total):
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-blue-800">
                    ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-amber-800">
                    ₹{totalDepreciation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-emerald-800 bg-emerald-100/50">
                    ₹{totalBookValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-2 px-2.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}


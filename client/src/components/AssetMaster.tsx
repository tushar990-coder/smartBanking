import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Asset {
  assetID: number;
  branchID: number;
  branch?: { branchName: string };
  categoryID: number;
  category?: { categoryName: string; depreciationRate: number; depreciationMethod: string };
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

interface Ledger {
  ledgerID: number;
  ledgerName: string;
}

const AssetMaster: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Selection/Timeline
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetHistory, setAssetHistory] = useState<any[]>([]);
  
  // Filters
  const [branchFilter, setBranchFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form States
  const [showAddOpening, setShowAddOpening] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<'details' | 'allocate' | 'transfer' | 'verify' | 'maintenance' | 'dispose' | 'depreciation'>('details');
  const assetCodeInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  // Opening Balance Form
  const [openingData, setOpeningData] = useState({
    branchID: 1,
    categoryID: 0,
    assetCode: '',
    assetName: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    originalCost: 0,
    accumulatedDepreciation: 0,
    location: '',
    custodian: '',
    isOpeningBalance: true
  });

  // Action Forms
  const [allocateData, setAllocateData] = useState({
    allocatedBranchID: 1,
    department: '',
    custodianName: '',
    remarks: '',
    allocationDate: new Date().toISOString().split('T')[0]
  });

  const [transferData, setTransferData] = useState({
    toBranchID: 1,
    toCustodian: '',
    remarks: '',
    transferDate: new Date().toISOString().split('T')[0]
  });

  const [verifyData, setVerifyData] = useState({
    auditorName: '',
    physicalStatus: 'Found',
    remarks: '',
    verificationDate: new Date().toISOString().split('T')[0]
  });

  const [maintenanceData, setMaintenanceData] = useState({
    maintenanceType: 'Repair',
    serviceProvider: '',
    cost: 0,
    remarks: '',
    nextServiceDate: '',
    postVoucher: true,
    debitLedgerID: 0,
    creditLedgerID: 0
  });

  const [disposeData, setDisposeData] = useState({
    disposalType: 'Scrap',
    saleAmount: 0,
    buyerName: '',
    remarks: '',
    disposalDate: new Date().toISOString().split('T')[0],
    postVoucher: true,
    debitLedgerID: 0,
    creditLedgerID: 0,
    profitLossLedgerID: 0
  });

  const [depData, setDepData] = useState({
    calculationDate: new Date().toISOString().split('T')[0],
    depreciationAmount: 0,
    postVoucher: true,
    debitLedgerID: 0,
    creditLedgerID: 0
  });

  const calculateDefaultDepreciation = (asset: Asset) => {
    if (!asset || !asset.category) return 0;
    const rate = asset.category.depreciationRate;
    const method = asset.category.depreciationMethod;
    const cost = asset.originalCost;
    const bookVal = asset.currentBookValue;
    
    let amount = 0;
    if (method === 'SLM') {
      amount = cost * (rate / 100);
    } else {
      amount = bookVal * (rate / 100);
    }
    
    amount = Math.round(amount * 100) / 100;
    if (bookVal - amount < 1) {
      amount = Math.max(0, bookVal - 1);
    }
    return amount;
  };

  const fetchAssets = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/Assets?`;
      if (branchFilter !== 'all') url += `branchId=${branchFilter}&`;
      if (categoryFilter !== 'all') url += `categoryId=${categoryFilter}&`;
      if (statusFilter !== 'all') url += `status=${statusFilter}&`;

      const [assetsRes, catRes, branchRes, ledgerRes] = await Promise.allSettled([
        axios.get(url),
        axios.get(`${API_URL}/AssetCategories`),
        axios.get(`${API_URL}/Branches`),
        axios.get(`${API_URL}/Ledgers`)
      ]);

      if (assetsRes.status === 'fulfilled') setAssets(assetsRes.value.data);
      if (catRes.status === 'fulfilled') setCategories(catRes.value.data);
      if (branchRes.status === 'fulfilled') setBranches(branchRes.value.data);
      if (ledgerRes.status === 'fulfilled') setLedgers(ledgerRes.value.data);
    } catch {
      setError('मालमत्ता यादी लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [branchFilter, categoryFilter, statusFilter]);

  const fetchAssetHistory = async (id: number) => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/Assets/${id}/history`);
      setAssetHistory(res.data);
    } catch {
      console.error("Error loading history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const selectAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    fetchAssetHistory(asset.assetID);
    setActiveActionTab('details');
    // Set defaults for action forms
    setAllocateData(prev => ({ ...prev, allocatedBranchID: asset.branchID }));
    setTransferData(prev => ({ ...prev, toBranchID: asset.branchID }));
    
    // Set single depr form default values
    const defaultDepAmount = calculateDefaultDepreciation(asset);
    setDepData({
      calculationDate: new Date().toISOString().split('T')[0],
      depreciationAmount: defaultDepAmount,
      postVoucher: true,
      debitLedgerID: 0,
      creditLedgerID: 0
    });
  };

  const handleOpeningChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setOpeningData(prev => ({
      ...prev,
      [name]: name === 'branchID' || name === 'categoryID' ? parseInt(value) : name === 'originalCost' || name === 'accumulatedDepreciation' ? parseFloat(value) : value
    }));
  };

  const handleAddOpeningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!openingData.categoryID) {
      setError('कृपया मालमत्ता वर्ग निवडा. (Please select asset category.)');
      return;
    }

    try {
      await axios.post(`${API_URL}/Assets`, {
        ...openingData,
        currentBookValue: openingData.originalCost - openingData.accumulatedDepreciation
      });
      setSuccess('मालमत्ता शिल्लक यशस्वीरित्या जोडली! (Opening asset added successfully!)');
      setShowAddOpening(false);
      fetchAssets();
      // Reset form
      setOpeningData({
        branchID: 1,
        categoryID: 0,
        assetCode: '',
        assetName: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        originalCost: 0,
        accumulatedDepreciation: 0,
        location: '',
        custodian: '',
        isOpeningBalance: true
      });
    } catch (err: any) {
      setError(err.response?.data || 'जतन करताना त्रुटी. (Error saving asset.)');
    }
  };

  // Actions Submission
  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(''); setSuccess('');
    try {
      await axios.post(`${API_URL}/AssetAllocations`, {
        ...allocateData,
        assetID: selectedAsset.assetID
      });
      setSuccess('मालमत्ता यशस्वीरित्या वाटप करण्यात आली! (Asset successfully allocated!)');
      fetchAssets();
      selectAsset({ ...selectedAsset, custodian: allocateData.custodianName, location: allocateData.department, branchID: allocateData.allocatedBranchID });
    } catch (err: any) {
      setError(err.response?.data || 'वाटप करताना त्रुटी.');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(''); setSuccess('');
    try {
      await axios.post(`${API_URL}/AssetTransfers`, {
        ...transferData,
        assetID: selectedAsset.assetID,
        fromBranchID: selectedAsset.branchID,
        fromCustodian: selectedAsset.custodian || 'None'
      });
      setSuccess('मालमत्ता यशस्वीरित्या हस्तांतरित करण्यात आली! (Asset transferred successfully!)');
      fetchAssets();
      selectAsset({ ...selectedAsset, branchID: transferData.toBranchID, custodian: transferData.toCustodian, location: 'हस्तांतरित (Transferred)' });
    } catch (err: any) {
      setError(err.response?.data || 'हस्तांतरण करताना त्रुटी.');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(''); setSuccess('');
    try {
      await axios.post(`${API_URL}/AssetVerifications`, {
        ...verifyData,
        assetID: selectedAsset.assetID
      });
      setSuccess('तपासणी नोंद यशस्वीरित्या जतन झाली! (Verification log saved!)');
      fetchAssets();
      let status = selectedAsset.status;
      if (verifyData.physicalStatus === 'Damaged') status = 'Damaged';
      else if (verifyData.physicalStatus === 'Missing') status = 'Suspended';
      else if (verifyData.physicalStatus === 'Found') status = 'Active';
      selectAsset({ ...selectedAsset, status });
    } catch (err: any) {
      setError(err.response?.data || 'नोंद जतन करताना त्रुटी.');
    }
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(''); setSuccess('');
    if (maintenanceData.postVoucher && (!maintenanceData.debitLedgerID || !maintenanceData.creditLedgerID)) {
      setError('व व्हाउचर जोडण्यासाठी खर्च आणि बँक/कॅश खाते आवश्यक आहे. (Voucher mapping ledgers required.)');
      return;
    }
    try {
      await axios.post(`${API_URL}/AssetMaintenances`, {
        maintenance: {
          ...maintenanceData,
          assetID: selectedAsset.assetID,
          cost: parseFloat(maintenanceData.cost as any)
        },
        postVoucher: maintenanceData.postVoucher,
        debitLedgerID: maintenanceData.debitLedgerID,
        creditLedgerID: maintenanceData.creditLedgerID
      });
      setSuccess('देखभाल नोंद यशस्वीरित्या जतन झाली! (Maintenance log recorded!)');
      fetchAssetHistory(selectedAsset.assetID);
      // Reset maintenance inputs
      setMaintenanceData({
        maintenanceType: 'Repair',
        serviceProvider: '',
        cost: 0,
        remarks: '',
        nextServiceDate: '',
        postVoucher: true,
        debitLedgerID: 0,
        creditLedgerID: 0
      });
    } catch (err: any) {
      setError(err.response?.data || 'त्रुटी आली.');
    }
  };

  const handleDisposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(''); setSuccess('');
    if (disposeData.postVoucher && (!disposeData.creditLedgerID || !disposeData.profitLossLedgerID)) {
      setError('व्हाउचर नोंदवण्यासाठी मालमत्ता आणि नफा/तोटा खाते आवश्यक आहे.');
      return;
    }
    try {
      await axios.post(`${API_URL}/AssetDisposals`, {
        disposal: {
          ...disposeData,
          assetID: selectedAsset.assetID,
          saleAmount: parseFloat(disposeData.saleAmount as any)
        },
        postVoucher: disposeData.postVoucher,
        debitLedgerID: disposeData.debitLedgerID || null,
        creditLedgerID: disposeData.creditLedgerID,
        profitLossLedgerID: disposeData.profitLossLedgerID
      });
      setSuccess('मालमत्ता यशस्वीरित्या विल्हेवाट लावण्यात आली! (Asset disposed successfully!)');
      fetchAssets();
      selectAsset({ ...selectedAsset, status: 'Disposed', currentBookValue: 0 });
    } catch (err: any) {
      setError(err.response?.data || 'त्रुटी आली.');
    }
  };

  const handleSingleDepreciationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(''); setSuccess('');
    if (depData.postVoucher && (!depData.debitLedgerID || !depData.creditLedgerID)) {
      setError('घसारा पोस्ट करण्यासाठी आवश्यक लेजर निवडा. (Debit and Credit ledgers required.)');
      return;
    }
    if (depData.depreciationAmount <= 0) {
      setError('घसारा रक्कम ० पेक्षा जास्त असावी. (Depreciation amount must be greater than 0.)');
      return;
    }
    if (depData.depreciationAmount > selectedAsset.currentBookValue - 1) {
      setError(`घसारा रक्कम शिल्लक पुस्तकी मूल्यापेक्षा (₹${(selectedAsset.currentBookValue - 1).toFixed(2)}) जास्त असू शकत नाही.`);
      return;
    }

    try {
      await axios.post(`${API_URL}/AssetDepreciations/commit`, {
        branchID: selectedAsset.branchID,
        financialYearID: 1, // default
        calculationDate: depData.calculationDate,
        items: [{
          assetID: selectedAsset.assetID,
          assetCode: selectedAsset.assetCode,
          assetName: selectedAsset.assetName,
          originalCost: selectedAsset.originalCost,
          bookValueBefore: selectedAsset.currentBookValue,
          rate: selectedAsset.category?.depreciationRate || 0,
          method: selectedAsset.category?.depreciationMethod || 'WDV',
          depreciationAmount: depData.depreciationAmount,
          bookValueAfter: selectedAsset.currentBookValue - depData.depreciationAmount
        }],
        postVoucher: depData.postVoucher,
        debitLedgerID: depData.debitLedgerID,
        creditLedgerID: depData.creditLedgerID,
        createdBy: 1
      });
      setSuccess('मालमत्ता घसारा यशस्वीरित्या आकारण्यात आला! (Depreciation successfully charged!)');
      fetchAssets();
      selectAsset({
        ...selectedAsset,
        accumulatedDepreciation: selectedAsset.accumulatedDepreciation + depData.depreciationAmount,
        currentBookValue: selectedAsset.currentBookValue - depData.depreciationAmount
      });
    } catch (err: any) {
      setError(err.response?.data || 'घसारा नोंदवताना त्रुटी.');
    }
  };

  return (
    <div className="p-3">
      {/* Messages */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded-sm text-xs mb-3 font-semibold">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-sm text-xs mb-3 font-semibold">{success}</div>}

      <div className="flex flex-col xl:flex-row gap-3">
        {/* Left pane - Assets grid & filters */}
        <div className="flex-1 bg-white rounded shadow-sm border border-gray-200 p-3">
          <div className="flex justify-between items-center border-b pb-2 mb-3">
            <h2 className="text-sm font-bold text-primary">🏢 मालमत्ता यादी (Assets Management Hub)</h2>
            <button 
              onClick={() => {
                const nextState = !showAddOpening;
                setShowAddOpening(nextState);
                if (nextState) {
                  setTimeout(() => {
                    if (assetCodeInputRef.current) {
                      assetCodeInputRef.current.focus();
                      assetCodeInputRef.current.select();
                    }
                  }, 120);
                }
              }} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-sm text-xs font-semibold cursor-pointer"
            >
              {showAddOpening ? '❌ रद्द' : '➕ मालमत्ता शिल्लक (Opening Asset)'}
            </button>
          </div>

          {/* Add Opening Balance Asset Form */}
          {showAddOpening && (
            <form onSubmit={handleAddOpeningSubmit} className="bg-gray-50 border border-gray-200 rounded-sm p-3 mb-4 space-y-2">
              <h3 className="text-xs font-bold text-gray-700 border-b pb-1">➕ नवीन मालमत्ता (ओपनिंग शिल्लक)</h3>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">शाखा (Branch)</label>
                  <select name="branchID" value={openingData.branchID} onChange={handleOpeningChange}
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs bg-white">
                    {branches.map((b: any) => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">मालमत्ता वर्ग (Category) *</label>
                  <select name="categoryID" value={openingData.categoryID} onChange={handleOpeningChange} required
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs bg-white">
                    <option value={0}>-- निवडा --</option>
                    {categories.map((c: any) => <option key={c.categoryID} value={c.categoryID}>{c.categoryName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">मालमत्ता कोड (Asset Code) *</label>
                  <input 
                    ref={assetCodeInputRef}
                    type="text" 
                    name="assetCode" 
                    value={openingData.assetCode} 
                    onChange={handleOpeningChange} 
                    required
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary font-bold text-blue-900" 
                    placeholder="उदा. COMP-HQ-01" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">मालमत्ता नाव (Asset Name) *</label>
                  <input type="text" name="assetName" value={openingData.assetName} onChange={handleOpeningChange} required
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs" placeholder="उदा. Lenovo ThinkCentre" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">खरेदी तारीख (Purchase Date) *</label>
                  <input type="date" name="purchaseDate" value={openingData.purchaseDate} onChange={handleOpeningChange} required
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">मूळ किंमत (Cost Price) *</label>
                  <input type="number" name="originalCost" value={openingData.originalCost} onChange={handleOpeningChange} required min="0" step="0.01"
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">एकत्रित घसारा (Accum. Depr.)</label>
                  <input type="number" name="accumulatedDepreciation" value={openingData.accumulatedDepreciation} onChange={handleOpeningChange} min="0" step="0.01"
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">चालू पुस्तकी मूल्य (Current Value)</label>
                  <input type="number" value={(openingData.originalCost - openingData.accumulatedDepreciation).toFixed(2)} readOnly
                    className="w-full border border-gray-200 bg-gray-100 rounded-sm px-2 py-0.5 text-xs font-bold text-gray-600 cursor-not-allowed" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">स्थान (Location)</label>
                  <input type="text" name="location" value={openingData.location} onChange={handleOpeningChange}
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs" placeholder="उदा. Office 1st Floor" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600">ताबाधारक (Custodian)</label>
                  <input type="text" name="custodian" value={openingData.custodian} onChange={handleOpeningChange}
                    className="w-full border border-gray-300 rounded-sm px-2 py-0.5 text-xs" placeholder="उदा. Clerk / Rajesh Patel" />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t mt-2">
                <button type="submit" className="bg-primary hover:bg-[#004a75] text-white px-4 py-1.5 rounded-sm text-xs font-semibold">💾 शिल्लक सेव्ह करा</button>
                <button type="button" onClick={() => setShowAddOpening(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-sm text-xs font-semibold">रद्द</button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex gap-2 mb-3 bg-gray-50 border border-gray-200 rounded p-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">शाखा (Branch)</label>
              <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white mt-0.5">
                <option value="all">सर्व शाखा (All Branches)</option>
                {branches.map(b => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">वर्ग (Category)</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white mt-0.5">
                <option value="all">सर्व वर्ग (All Categories)</option>
                {categories.map(c => <option key={c.categoryID} value={c.categoryID}>{c.categoryName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">स्थिती (Status)</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-xs bg-white mt-0.5">
                <option value="all">सर्व स्थिती (All Status)</option>
                <option value="Active">Active (सक्रिय)</option>
                <option value="Suspended">Suspended (स्थगित)</option>
                <option value="Damaged">Damaged (खराब)</option>
                <option value="Disposed">Disposed (विल्हेवाट लावलेली)</option>
              </select>
            </div>
          </div>

          {/* Assets Grid */}
          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-left">
                  <th className="px-2.5 py-2">#</th>
                  <th className="px-2.5 py-2">कोड (Code)</th>
                  <th className="px-2.5 py-2">नाव (Name)</th>
                  <th className="px-2.5 py-2">वर्ग (Category)</th>
                  <th className="px-2.5 py-2">खरेदी तारीख</th>
                  <th className="px-2.5 py-2 text-right">मूळ किंमत</th>
                  <th className="px-2.5 py-2 text-right">पुस्तकी मूल्य (WDV)</th>
                  <th className="px-2.5 py-2 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-4 text-gray-400">लोड होत आहे...</td></tr>
                ) : assets.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-4 text-gray-400">कोणतीही मालमत्ता सापडली नाही.</td></tr>
                ) : assets.map((a, idx) => (
                  <tr 
                    key={a.assetID} 
                    onClick={() => selectAsset(a)}
                    className={`hover:bg-blue-50 border-b border-gray-100 transition-colors cursor-pointer ${selectedAsset?.assetID === a.assetID ? 'bg-blue-50/85 font-medium' : ''}`}
                  >
                    <td className="px-2.5 py-2">{idx + 1}</td>
                    <td className="px-2.5 py-2 font-mono font-medium text-blue-700">{a.assetCode}</td>
                    <td className="px-2.5 py-2">{a.assetName}</td>
                    <td className="px-2.5 py-2">{a.category?.categoryName}</td>
                    <td className="px-2.5 py-2">{new Date(a.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-2.5 py-2 text-right">₹{a.originalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-2.5 py-2 text-right font-bold text-gray-800">₹{a.currentBookValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-2.5 py-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold 
                        ${a.status === 'Active' ? 'bg-green-50 text-green-700' : 
                          a.status === 'Suspended' ? 'bg-yellow-50 text-yellow-700' : 
                          a.status === 'Damaged' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right pane - Action Forms and History Timeline */}
        {selectedAsset && (
          <div className="w-full xl:w-96 bg-white rounded shadow-sm border border-gray-200 p-3 flex flex-col self-start">
            <div className="border-b pb-2 mb-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Selected Asset Details</h3>
              <h2 className="text-sm font-bold text-blue-700 mt-0.5">{selectedAsset.assetName} ({selectedAsset.assetCode})</h2>
            </div>

            {/* Action Navigation Tabs */}
            <div className="flex flex-wrap border-b border-gray-200 mb-3 gap-0.5 text-[10px] font-bold">
              <button onClick={() => setActiveActionTab('details')} className={`px-2 py-1 rounded-t-sm transition-colors ${activeActionTab === 'details' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>📊 माहिती & इतिहास</button>
              {selectedAsset.status === 'Active' && (
                <>
                  <button onClick={() => setActiveActionTab('allocate')} className={`px-2 py-1 rounded-t-sm transition-colors ${activeActionTab === 'allocate' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>👤 वाटप</button>
                  <button onClick={() => setActiveActionTab('transfer')} className={`px-2 py-1 rounded-t-sm transition-colors ${activeActionTab === 'transfer' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>➡️ हस्तांतरण</button>
                  <button onClick={() => setActiveActionTab('verify')} className={`px-2 py-1 rounded-t-sm transition-colors ${activeActionTab === 'verify' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>✔️ तपासणी</button>
                  <button onClick={() => setActiveActionTab('maintenance')} className={`px-2 py-1 rounded-t-sm transition-colors ${activeActionTab === 'maintenance' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🛠️ देखभाल</button>
                  <button onClick={() => setActiveActionTab('depreciation')} className={`px-2 py-1 rounded-t-sm transition-colors ${activeActionTab === 'depreciation' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>⚡ घसारा</button>
                  <button onClick={() => setActiveActionTab('dispose')} className={`px-2 py-1 rounded-t-sm transition-colors ${activeActionTab === 'dispose' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>⚠️ विल्हेवाट</button>
                </>
              )}
            </div>

            {/* TAB CONTENT: Details & History Timeline */}
            {activeActionTab === 'details' && (
              <div className="space-y-3 flex-1 overflow-y-auto">
                <div className="bg-gray-50 border border-gray-100 rounded-sm p-2 text-xs space-y-1">
                  <div className="flex justify-between border-b pb-0.5"><span className="text-gray-500">शाखा (Branch):</span> <span className="font-semibold text-gray-700">{selectedAsset.branch?.branchName}</span></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="text-gray-500">वर्ग (Category):</span> <span className="font-semibold text-gray-700">{selectedAsset.category?.categoryName}</span></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="text-gray-500">खरेदी किंमत:</span> <span className="font-semibold text-gray-700">₹{selectedAsset.originalCost.toFixed(2)}</span></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="text-gray-500">एकत्रित घसारा:</span> <span className="font-semibold text-red-600">₹{selectedAsset.accumulatedDepreciation.toFixed(2)}</span></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="text-gray-500">पुस्तकी मूल्य (WDV):</span> <span className="font-bold text-green-700">₹{selectedAsset.currentBookValue.toFixed(2)}</span></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="text-gray-500">स्थान (Location):</span> <span className="font-semibold text-gray-700">{selectedAsset.location || '-'}</span></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="text-gray-500">ताबाधारक (Custodian):</span> <span className="font-semibold text-gray-700">{selectedAsset.custodian || '-'}</span></div>
                  <div className="flex justify-between border-b pb-0.5"><span className="text-gray-500">घसारा पद्धत/दर:</span> <span className="font-semibold text-gray-700">{selectedAsset.category?.depreciationMethod} ({selectedAsset.category?.depreciationRate}%)</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ओपनिंग बॅलन्स?:</span> <span className="font-semibold text-gray-700">{selectedAsset.isOpeningBalance ? 'होय (Yes)' : 'नाही (No)'}</span></div>
                </div>

                <div className="border-t pt-2">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">व्यवहार इतिहास (Transaction Timeline)</h4>
                  {historyLoading ? (
                    <div className="text-center py-4 text-xs text-gray-400">इतिहास लोड होत आहे...</div>
                  ) : assetHistory.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">या मालमत्तेचा कोणताही इतिहास नाही.</div>
                  ) : (
                    <div className="relative border-l-2 border-blue-200 ml-2.5 pl-4 space-y-3">
                      {assetHistory.map((item, idx) => (
                        <div key={idx} className="relative text-xs">
                          {/* Dot indicator */}
                          <div className={`absolute -left-[21px] w-2.5 h-2.5 rounded-full border-2 border-white 
                            ${item.type === 'Allocation' ? 'bg-indigo-500' :
                              item.type === 'Transfer' ? 'bg-blue-500' :
                              item.type === 'Verification' ? 'bg-emerald-500' :
                              item.type === 'Maintenance' ? 'bg-orange-500' :
                              item.type === 'Depreciation' ? 'bg-purple-500' : 'bg-red-500'}`} />
                          
                          <p className="text-[10px] font-semibold text-gray-400">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                          <p className="font-bold text-gray-700 mt-0.5">{item.type}</p>
                          <p className="text-[11px] text-gray-600">{item.description}</p>
                          {item.remarks && <p className="text-[10px] italic text-gray-500 mt-0.5">Note: {item.remarks}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Allocate */}
            {activeActionTab === 'allocate' && (
              <form onSubmit={handleAllocate} className="space-y-2.5 text-xs flex-1">
                <h4 className="font-bold text-gray-700 border-b pb-1">👤 नवीन वाटप (Asset Allocation)</h4>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">शाखा (Branch)</label>
                  <select value={allocateData.allocatedBranchID} onChange={e => setAllocateData({ ...allocateData, allocatedBranchID: parseInt(e.target.value) })}
                    className="w-full border rounded-sm px-2 py-1 bg-white">
                    {branches.map((b: any) => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">विभाग (Department) *</label>
                  <input type="text" value={allocateData.department} onChange={e => setAllocateData({ ...allocateData, department: e.target.value })} required
                    className="w-full border rounded-sm px-2 py-1" placeholder="उदा. लोन विभाग / कॅश विभाग" />
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">ताबाधारक (Custodian Name) *</label>
                  <input type="text" value={allocateData.custodianName} onChange={e => setAllocateData({ ...allocateData, custodianName: e.target.value })} required
                    className="w-full border rounded-sm px-2 py-1" placeholder="उदा. रमेश कुमार / संजीव शर्मा" />
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">वाटप तारीख (Date)</label>
                  <input type="date" value={allocateData.allocationDate} onChange={e => setAllocateData({ ...allocateData, allocationDate: e.target.value })} required
                    className="w-full border rounded-sm px-2 py-1" />
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">तपशील (Remarks)</label>
                  <textarea value={allocateData.remarks} onChange={e => setAllocateData({ ...allocateData, remarks: e.target.value })}
                    className="w-full border rounded-sm px-2 py-1" rows={2} placeholder="अधिक माहिती..." />
                </div>
                <button type="submit" className="w-full bg-primary hover:bg-[#004a75] text-white py-1.5 rounded-sm font-semibold mt-1">जतन करा</button>
              </form>
            )}

            {/* TAB CONTENT: Transfer */}
            {activeActionTab === 'transfer' && (
              <form onSubmit={handleTransfer} className="space-y-2.5 text-xs flex-1">
                <h4 className="font-bold text-gray-700 border-b pb-1">➡️ शाखा हस्तांतरण (Asset Branch Transfer)</h4>
                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-2 rounded-sm text-[10px] font-semibold">
                  वर्तमान शाखा: {selectedAsset.branch?.branchName}<br/>
                  वर्तमान ताबाधारक: {selectedAsset.custodian || 'None'}
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">कोणत्या शाखेत हस्तांतरित करायचे? (To Branch) *</label>
                  <select value={transferData.toBranchID} onChange={e => setTransferData({ ...transferData, toBranchID: parseInt(e.target.value) })}
                    className="w-full border rounded-sm px-2 py-1 bg-white">
                    {branches.filter(b => b.branchID !== selectedAsset.branchID).map((b: any) => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">नवीन ताबाधारक (To Custodian) *</label>
                  <input type="text" value={transferData.toCustodian} onChange={e => setTransferData({ ...transferData, toCustodian: e.target.value })} required
                    className="w-full border rounded-sm px-2 py-1" placeholder="नवीन जबाबदार व्यक्तीचे नाव..." />
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">हस्तांतरण तारीख (Transfer Date)</label>
                  <input type="date" value={transferData.transferDate} onChange={e => setTransferData({ ...transferData, transferDate: e.target.value })} required
                    className="w-full border rounded-sm px-2 py-1" />
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">तपशील (Remarks)</label>
                  <textarea value={transferData.remarks} onChange={e => setTransferData({ ...transferData, remarks: e.target.value })}
                    className="w-full border rounded-sm px-2 py-1" rows={2} placeholder="स्थानांतरणाचे कारण..." />
                </div>
                <button type="submit" className="w-full bg-primary hover:bg-[#004a75] text-white py-1.5 rounded-sm font-semibold mt-1">हस्तांतरित करा</button>
              </form>
            )}

            {/* TAB CONTENT: Verify */}
            {activeActionTab === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-2.5 text-xs flex-1">
                <h4 className="font-bold text-gray-700 border-b pb-1">✔️ भौतिक तपासणी (Physical Verification Audit)</h4>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">तपासणी अधिकारी / ऑडिटर (Auditor Name) *</label>
                  <input type="text" value={verifyData.auditorName} onChange={e => setVerifyData({ ...verifyData, auditorName: e.target.value })} required
                    className="w-full border rounded-sm px-2 py-1" placeholder="उदा. CA Shrikant Gokhale" />
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">भौतिक स्थिती (Physical Status) *</label>
                  <select value={verifyData.physicalStatus} onChange={e => setVerifyData({ ...verifyData, physicalStatus: e.target.value })}
                    className="w-full border rounded-sm px-2 py-1 bg-white">
                    <option value="Found">व्यवस्थित सापडली (Found - Active)</option>
                    <option value="Missing">सापडत नाही (Missing - Suspended)</option>
                    <option value="Damaged">खराब झाली (Damaged - Damaged)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">तपासणी तारीख (Audit Date)</label>
                  <input type="date" value={verifyData.verificationDate} onChange={e => setVerifyData({ ...verifyData, verificationDate: e.target.value })} required
                    className="w-full border rounded-sm px-2 py-1" />
                </div>
                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">तपशील (Remarks)</label>
                  <textarea value={verifyData.remarks} onChange={e => setVerifyData({ ...verifyData, remarks: e.target.value })}
                    className="w-full border rounded-sm px-2 py-1" rows={2} placeholder="भौतिक पडताळणी संबंधित टिप्पणी..." />
                </div>
                <button type="submit" className="w-full bg-primary hover:bg-[#004a75] text-white py-1.5 rounded-sm font-semibold mt-1">तपासणी नोंद जतन करा</button>
              </form>
            )}

            {/* TAB CONTENT: Maintenance */}
            {activeActionTab === 'maintenance' && (
              <form onSubmit={handleMaintenanceSubmit} className="space-y-2 text-xs flex-1">
                <h4 className="font-bold text-gray-700 border-b pb-1">🛠️ देखभाल नोंद (Asset Maintenance log)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">देखभाल प्रकार *</label>
                    <select value={maintenanceData.maintenanceType} onChange={e => setMaintenanceData({ ...maintenanceData, maintenanceType: e.target.value })}
                      className="w-full border rounded-sm px-2 py-1 bg-white">
                      <option value="Repair">दुरुस्ती (Repair)</option>
                      <option value="AMC">करार (AMC)</option>
                      <option value="Routine">नियमित सर्व्हिस (Routine)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">सर्व्हिस प्रोव्हाइडर *</label>
                    <input type="text" value={maintenanceData.serviceProvider} onChange={e => setMaintenanceData({ ...maintenanceData, serviceProvider: e.target.value })} required
                      className="w-full border rounded-sm px-2 py-1" placeholder="उदा. Dell Care / Local Agency" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">खर्च (Cost ₹) *</label>
                    <input type="number" value={maintenanceData.cost} onChange={e => setMaintenanceData({ ...maintenanceData, cost: parseFloat(e.target.value) })} required min="0" step="0.01"
                      className="w-full border rounded-sm px-2 py-1" />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">पुढील सर्व्हिस तारीख</label>
                    <input type="date" value={maintenanceData.nextServiceDate} onChange={e => setMaintenanceData({ ...maintenanceData, nextServiceDate: e.target.value })}
                      className="w-full border rounded-sm px-2 py-1" />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">तपशील (Remarks)</label>
                  <textarea value={maintenanceData.remarks} onChange={e => setMaintenanceData({ ...maintenanceData, remarks: e.target.value })}
                    className="w-full border rounded-sm px-2 py-1" rows={1.5} placeholder="देखभालीचे सविस्तर वर्णन..." />
                </div>

                {/* Accounting Voucher fields */}
                <div className="bg-gray-50 border border-gray-200 rounded p-2 mt-1.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={maintenanceData.postVoucher} onChange={e => setMaintenanceData({ ...maintenanceData, postVoucher: e.target.checked })} className="rounded" />
                    हिशोब वही मध्ये व्हाउचर पोस्ट करा (Post Voucher)
                  </label>

                  {maintenanceData.postVoucher && (
                    <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                      <div>
                        <label className="block font-bold text-gray-600 mb-0.5">नाव खाते (Debit Ledger) *</label>
                        <select value={maintenanceData.debitLedgerID} onChange={e => setMaintenanceData({ ...maintenanceData, debitLedgerID: parseInt(e.target.value) })} required
                          className="w-full border rounded px-1.5 py-0.5 bg-white text-[11px]">
                          <option value={0}>-- खर्च खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-gray-600 mb-0.5">जमा खाते (Credit Ledger - Cash/Bank) *</label>
                        <select value={maintenanceData.creditLedgerID} onChange={e => setMaintenanceData({ ...maintenanceData, creditLedgerID: parseInt(e.target.value) })} required
                          className="w-full border rounded px-1.5 py-0.5 bg-white text-[11px]">
                          <option value={0}>-- बँक / रोख खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className="w-full bg-primary hover:bg-[#004a75] text-white py-1.5 rounded-sm font-semibold mt-1">💾 देखभाल नोंदवा & व्हाउचर पोस्ट करा</button>
              </form>
            )}

            {/* TAB CONTENT: Depreciation */}
            {activeActionTab === 'depreciation' && (
              <form onSubmit={handleSingleDepreciationSubmit} className="space-y-2 text-xs flex-1">
                <h4 className="font-bold text-blue-700 border-b pb-1">⚡ मालमत्ता घसारा आकारणी (Asset Depreciation Run)</h4>
                
                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-2 rounded-sm text-[10px] font-semibold space-y-1">
                  <div>घसारा पद्धत (Method): {selectedAsset.category?.depreciationMethod}</div>
                  <div>घसारा दर (Rate): {selectedAsset.category?.depreciationRate}%</div>
                  <div>मूळ किंमत (Cost): ₹{selectedAsset.originalCost.toFixed(2)}</div>
                  <div>चालू पुस्तकी मूल्य (WDV): ₹{selectedAsset.currentBookValue.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">गणना तारीख *</label>
                    <input type="date" value={depData.calculationDate} onChange={e => setDepData({ ...depData, calculationDate: e.target.value })} required
                      className="w-full border rounded-sm px-2 py-1" />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">घसारा रक्कम (₹) *</label>
                    <input type="number" value={depData.depreciationAmount} onChange={e => setDepData({ ...depData, depreciationAmount: parseFloat(e.target.value) })} required min="0" step="0.01"
                      className="w-full border rounded-sm px-2 py-1" />
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded p-2 mt-1.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={depData.postVoucher} onChange={e => setDepData({ ...depData, postVoucher: e.target.checked })} className="rounded" />
                    हिशोब वही मध्ये जनरल व्हाउचर पोस्ट करा (Post Voucher)
                  </label>

                  {depData.postVoucher && (
                    <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                      <div>
                        <label className="block font-bold text-gray-600 mb-0.5">नाव खाते (Debit Depreciation Expense) *</label>
                        <select value={depData.debitLedgerID} onChange={e => setDepData({ ...depData, debitLedgerID: parseInt(e.target.value) })} required
                          className="w-full border rounded px-1.5 py-0.5 bg-white text-[11px]">
                          <option value={0}>-- घसारा खर्च खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-gray-600 mb-0.5">जमा खाते (Credit Accum Depr / Asset) *</label>
                        <select value={depData.creditLedgerID} onChange={e => setDepData({ ...depData, creditLedgerID: parseInt(e.target.value) })} required
                          className="w-full border rounded px-1.5 py-0.5 bg-white text-[11px]">
                          <option value={0}>-- जमा मालमत्ता खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded-sm font-semibold mt-1">💾 घसारा प्रक्रिया जतन करा</button>
              </form>
            )}

            {/* TAB CONTENT: Dispose */}
            {activeActionTab === 'dispose' && (
              <form onSubmit={handleDisposeSubmit} className="space-y-2 text-xs flex-1">
                <h4 className="font-bold text-red-700 border-b pb-1">⚠️ मालमत्ता विल्हेवाट (Asset Disposal Entry)</h4>
                <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded-sm text-[10px] font-semibold">
                  चालू पुस्तकी मूल्य (Current Book Value): ₹{selectedAsset.currentBookValue.toFixed(2)}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">विल्हेवाट प्रकार *</label>
                    <select value={disposeData.disposalType} onChange={e => setDisposeData({ ...disposeData, disposalType: e.target.value })}
                      className="w-full border rounded-sm px-2 py-1 bg-white">
                      <option value="Scrap">स्क्रॅप (Scrap)</option>
                      <option value="Sale">विक्री (Sale)</option>
                      <option value="Write-Off">राईट ऑफ (Write-Off)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">विक्री रक्कम (Sale Price ₹)</label>
                    <input type="number" value={disposeData.saleAmount} onChange={e => setDisposeData({ ...disposeData, saleAmount: parseFloat(e.target.value) })} min="0" step="0.01"
                      className="w-full border rounded-sm px-2 py-1" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">खरेदीदार (Buyer Name)</label>
                    <input type="text" value={disposeData.buyerName} onChange={e => setDisposeData({ ...disposeData, buyerName: e.target.value })}
                      className="w-full border rounded-sm px-2 py-1" placeholder="खरेदीदाराचे नाव..." />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-600 mb-0.5">विल्हेवाट तारीख *</label>
                    <input type="date" value={disposeData.disposalDate} onChange={e => setDisposeData({ ...disposeData, disposalDate: e.target.value })} required
                      className="w-full border rounded-sm px-2 py-1" />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-600 mb-0.5">तपशील (Remarks)</label>
                  <textarea value={disposeData.remarks} onChange={e => setDisposeData({ ...disposeData, remarks: e.target.value })}
                    className="w-full border rounded-sm px-2 py-1" rows={1.5} placeholder="अधिक माहिती..." />
                </div>

                {/* Accounting Voucher fields */}
                <div className="bg-gray-50 border border-gray-200 rounded p-2 mt-1.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={disposeData.postVoucher} onChange={e => setDisposeData({ ...disposeData, postVoucher: e.target.checked })} className="rounded" />
                    हिशोब वही मध्ये व्हाउचर पोस्ट करा (Post Voucher)
                  </label>

                  {disposeData.postVoucher && (
                    <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                      {disposeData.saleAmount > 0 && (
                        <div>
                          <label className="block font-bold text-gray-600 mb-0.5">नावे खाते (Debit Cash/Bank Ledger) *</label>
                          <select value={disposeData.debitLedgerID} onChange={e => setDisposeData({ ...disposeData, debitLedgerID: parseInt(e.target.value) })} required
                            className="w-full border rounded px-1.5 py-0.5 bg-white text-[11px]">
                            <option value={0}>-- कॅश / बँक खाते निवडा --</option>
                            {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block font-bold text-gray-600 mb-0.5">जमा खाते (Credit Asset Ledger) *</label>
                        <select value={disposeData.creditLedgerID} onChange={e => setDisposeData({ ...disposeData, creditLedgerID: parseInt(e.target.value) })} required
                          className="w-full border rounded px-1.5 py-0.5 bg-white text-[11px]">
                          <option value={0}>-- मालमत्ता खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block font-bold text-gray-600 mb-0.5">नफा/तोटा खाते (Profit/Loss Ledger) *</label>
                        <select value={disposeData.profitLossLedgerID} onChange={e => setDisposeData({ ...disposeData, profitLossLedgerID: parseInt(e.target.value) })} required
                          className="w-full border rounded px-1.5 py-0.5 bg-white text-[11px]">
                          <option value={0}>-- मालमत्ता विक्री नफा/तोटा खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-sm font-semibold mt-1">⚠️ मालमत्ता विल्हेवाट लावा & जतन करा</button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetMaster;


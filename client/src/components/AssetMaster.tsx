import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Plus,
  RefreshCw,
  Search,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  ArrowRightLeft,
  ShieldCheck,
  Wrench,
  TrendingDown,
  Trash2,
  Clock,
  MapPin,
  User,
  Layers,
  Calendar,
  Save,
  DollarSign,
  Info,
  CheckCircle,
  Percent,
  CheckSquare,
  BookOpen
} from 'lucide-react';
import BankLedgerSelect from './common/BankLedgerSelect';
import { RawLedgerItem } from '../utils/bankLedgerUtils';

interface Asset {
  assetID: number;
  branchID: number;
  branch?: { branchName: string };
  categoryID: number;
  category?: {
    categoryName: string;
    depreciationRate: number;
    depreciationMethod: string;
    assetLedgerID?: number | null;
    depreciationExpenseLedgerID?: number | null;
    accumulatedDepreciationLedgerID?: number | null;
    disposalProfitLossLedgerID?: number | null;
  };
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

interface Ledger extends RawLedgerItem {
  ledgerID: number;
  ledgerName: string;
}

const AssetMaster: React.FC = () => {
  const { user, globalBranchId } = useAuth();
  const activeBusinessDate = user?.businessDate ? user.businessDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const effectiveBranchId = globalBranchId ? Number(globalBranchId) : (user?.branchID ? Number(user.branchID) : 1);
  const isHeadOfficeOrAdmin = user?.role === 'Admin' || user?.branchType === 'HeadOffice';

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [syncingGl, setSyncingGl] = useState(false);
  
  // Selection/Timeline
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetHistory, setAssetHistory] = useState<any[]>([]);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState(isHeadOfficeOrAdmin ? 'all' : String(effectiveBranchId));
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form States
  const [showAddOpening, setShowAddOpening] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<'details' | 'allocate' | 'transfer' | 'verify' | 'maintenance' | 'dispose' | 'depreciation'>('details');
  const assetCodeInputRef = useRef<HTMLInputElement>(null);

  const API_URL = '/api';

  // Opening Balance Form
  const [openingData, setOpeningData] = useState({
    branchID: effectiveBranchId,
    categoryID: 0,
    assetCode: '',
    assetName: '',
    purchaseDate: activeBusinessDate,
    quantity: 1,
    costMode: 'perUnit' as 'perUnit' | 'total',
    originalCost: 0,
    accumulatedDepreciation: 0,
    location: '',
    custodian: '',
    isOpeningBalance: true
  });

  // Action Forms
  const [allocateData, setAllocateData] = useState({
    allocatedBranchID: effectiveBranchId,
    department: '',
    custodianName: '',
    remarks: '',
    allocationDate: activeBusinessDate
  });

  const [transferData, setTransferData] = useState({
    toBranchID: effectiveBranchId === 1 ? 2 : 1,
    toCustodian: '',
    remarks: '',
    transferDate: activeBusinessDate
  });

  // Sync CBS Business Date if changed
  useEffect(() => {
    if (user?.businessDate) {
      const bDate = user.businessDate.split('T')[0];
      setOpeningData(prev => ({ ...prev, purchaseDate: bDate }));
      setAllocateData(prev => ({ ...prev, allocationDate: bDate }));
      setTransferData(prev => ({ ...prev, transferDate: bDate }));
      setVerifyData(prev => ({ ...prev, verificationDate: bDate }));
      setDisposeData(prev => ({ ...prev, disposalDate: bDate }));
      setDepData(prev => ({ ...prev, calculationDate: bDate }));
    }
  }, [user?.businessDate]);

  useEffect(() => {
    if (!isHeadOfficeOrAdmin && effectiveBranchId) {
      setBranchFilter(String(effectiveBranchId));
      setOpeningData(prev => ({ ...prev, branchID: effectiveBranchId }));
      setAllocateData(prev => ({ ...prev, allocatedBranchID: effectiveBranchId }));
    }
  }, [effectiveBranchId, isHeadOfficeOrAdmin]);

  const [verifyData, setVerifyData] = useState({
    auditorName: '',
    physicalStatus: 'Found',
    remarks: '',
    verificationDate: activeBusinessDate
  });

  const [maintenanceData, setMaintenanceData] = useState({
    maintenanceType: 'Repair',
    serviceProvider: '',
    cost: 0,
    remarks: '',
    nextServiceDate: '',
    postVoucher: true,
    paymentMode: 'Cash' as 'Cash' | 'Bank',
    debitLedgerID: 0,
    creditLedgerID: 0
  });

  const [disposeData, setDisposeData] = useState({
    disposalType: 'Scrap',
    saleAmount: 0,
    buyerName: '',
    remarks: '',
    disposalDate: activeBusinessDate,
    postVoucher: true,
    paymentMode: 'Cash' as 'Cash' | 'Bank',
    debitLedgerID: 0,
    creditLedgerID: 0,
    profitLossLedgerID: 0
  });

  const [depData, setDepData] = useState({
    calculationDate: activeBusinessDate,
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
    const otherBranch = branches.find(b => b.branchID !== asset.branchID);
    setTransferData(prev => ({ ...prev, toBranchID: otherBranch ? otherBranch.branchID : (asset.branchID === 1 ? 2 : 1) }));
    
    // Resolve Category GL Scheme Ledgers
    const cat = categories.find((c: any) => c.categoryID === asset.categoryID);
    const assetLedgerId = cat?.assetLedgerID || asset.category?.assetLedgerID || 0;
    const depExpLedgerId = cat?.depreciationExpenseLedgerID || asset.category?.depreciationExpenseLedgerID || 0;
    const accumDepLedgerId = cat?.accumulatedDepreciationLedgerID || asset.category?.accumulatedDepreciationLedgerID || 0;
    const disposalPlLedgerId = cat?.disposalProfitLossLedgerID || asset.category?.disposalProfitLossLedgerID || 0;

    // Set single depr form default values
    const defaultDepAmount = calculateDefaultDepreciation(asset);
    setDepData({
      calculationDate: activeBusinessDate,
      depreciationAmount: defaultDepAmount,
      postVoucher: true,
      debitLedgerID: depExpLedgerId,
      creditLedgerID: accumDepLedgerId || assetLedgerId
    });

    // Set disposal form default values
    setDisposeData(prev => ({
      ...prev,
      disposalDate: activeBusinessDate,
      creditLedgerID: assetLedgerId,
      profitLossLedgerID: disposalPlLedgerId
    }));
  };

  const handleOpenDepreciationTab = () => {
    setActiveActionTab('depreciation');
    if (selectedAsset) {
      const cat = categories.find((c: any) => c.categoryID === selectedAsset.categoryID);
      const depExpLedgerId = cat?.depreciationExpenseLedgerID || selectedAsset.category?.depreciationExpenseLedgerID || 0;
      const accumDepLedgerId = cat?.accumulatedDepreciationLedgerID || selectedAsset.category?.accumulatedDepreciationLedgerID || 0;
      const assetLedgerId = cat?.assetLedgerID || selectedAsset.category?.assetLedgerID || 0;
      setDepData(prev => ({
        ...prev,
        debitLedgerID: prev.debitLedgerID || depExpLedgerId,
        creditLedgerID: prev.creditLedgerID || (accumDepLedgerId || assetLedgerId)
      }));
    }
  };

  const handleOpenDisposeTab = () => {
    setActiveActionTab('dispose');
    if (selectedAsset) {
      const cat = categories.find((c: any) => c.categoryID === selectedAsset.categoryID);
      const assetLedgerId = cat?.assetLedgerID || selectedAsset.category?.assetLedgerID || 0;
      const disposalPlLedgerId = cat?.disposalProfitLossLedgerID || selectedAsset.category?.disposalProfitLossLedgerID || 0;
      setDisposeData(prev => ({
        ...prev,
        creditLedgerID: prev.creditLedgerID || assetLedgerId,
        profitLossLedgerID: prev.profitLossLedgerID || disposalPlLedgerId
      }));
    }
  };

  const handleOpeningChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setOpeningData(prev => ({
      ...prev,
      [name]: name === 'branchID' || name === 'categoryID' || name === 'quantity'
        ? parseInt(value) || 0
        : name === 'originalCost' || name === 'accumulatedDepreciation'
        ? parseFloat(value) || 0
        : value
    }));
  };

  const handleAddOpeningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!openingData.categoryID) {
      setError('कृपया मालमत्ता वर्ग निवडा. (Please select asset category.)');
      return;
    }
    const qty = Math.max(1, openingData.quantity || 1);
    if (!openingData.assetCode || !openingData.assetName) {
      setError('कृपया मालमत्ता कोड आणि नाव भरा. (Asset Code and Name are required.)');
      return;
    }

    try {
      await axios.post(`${API_URL}/Assets/opening-batch`, {
        branchID: openingData.branchID,
        categoryID: openingData.categoryID,
        assetCode: openingData.assetCode,
        assetName: openingData.assetName,
        purchaseDate: openingData.purchaseDate,
        quantity: qty,
        costMode: openingData.costMode,
        originalCost: openingData.originalCost,
        accumulatedDepreciation: openingData.accumulatedDepreciation,
        location: openingData.location,
        custodian: openingData.custodian,
        isOpeningBalance: true,
        createdBy: user?.userID ? Number(user.userID) : 1
      });

      // Auto-sync with Balance Sheet (GL)
      try {
        await axios.post(`${API_URL}/Assets/sync-opening-balances?branchId=${openingData.branchID}`);
      } catch (syncErr) {
        console.warn("Background GL sync note:", syncErr);
      }

      setSuccess(`एकूण ${qty} मालमत्ता शिल्लक नोंदी यशस्वीरित्या जोडल्या आणि ताळेबंदाशी सिंक केल्या!`);
      setShowAddOpening(false);
      fetchAssets();
      // Reset form
      setOpeningData({
        branchID: effectiveBranchId,
        categoryID: 0,
        assetCode: '',
        assetName: '',
        purchaseDate: activeBusinessDate,
        quantity: 1,
        costMode: 'perUnit',
        originalCost: 0,
        accumulatedDepreciation: 0,
        location: '',
        custodian: '',
        isOpeningBalance: true
      });
    } catch (err: any) {
      setError(err.response?.data || 'जतन करताना त्रुटी. (Error saving assets.)');
    }
  };

  // Manual GL Balance Sheet Sync
  const handleManualGlSync = async () => {
    setSyncingGl(true);
    setError(''); setSuccess('');
    try {
      const bId = branchFilter !== 'all' ? branchFilter : (effectiveBranchId || '');
      const res = await axios.post(`${API_URL}/Assets/sync-opening-balances${bId ? `?branchId=${bId}` : ''}`);
      setSuccess(res.data?.message || 'डेडस्टॉक सुरुवातीची शिल्लक ताळेबंद (Balance Sheet) व खतावणीशी यशस्वीरीत्या सिंक झाली!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'ताळेबंद सिंक करताना त्रुटी आली.');
    } finally {
      setSyncingGl(false);
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
    if (maintenanceData.postVoucher) {
      if (!maintenanceData.debitLedgerID) {
        setError('व्हाउचर जोडण्यासाठी खर्च खाते (Debit Expense Ledger) निवडणे आवश्यक आहे.');
        return;
      }
      if (maintenanceData.paymentMode === 'Bank' && !maintenanceData.creditLedgerID) {
        setError('बँक पेमेंटसाठी बँक जी.एल. खाते (Bank GL Account) निवडणे आवश्यक आहे.');
        return;
      }
    }
    try {
      const { paymentMode, ...maintenanceEntityFields } = maintenanceData;
      await axios.post(`${API_URL}/AssetMaintenances`, {
        maintenance: {
          ...maintenanceEntityFields,
          assetID: selectedAsset.assetID,
          cost: parseFloat(maintenanceData.cost as any)
        },
        postVoucher: maintenanceData.postVoucher,
        paymentMode,
        debitLedgerID: maintenanceData.debitLedgerID,
        creditLedgerID: paymentMode === 'Bank' ? maintenanceData.creditLedgerID : null
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
        paymentMode: 'Cash',
        debitLedgerID: 0,
        creditLedgerID: 0
      });
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || 'त्रुटी आली.'));
    }
  };

  const handleDisposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    setError(''); setSuccess('');
    if (disposeData.postVoucher) {
      if (!disposeData.creditLedgerID || !disposeData.profitLossLedgerID) {
        setError('व्हाउचर नोंदवण्यासाठी मालमत्ता आणि नफा/तोटा खाते आवश्यक आहे.');
        return;
      }
      if (Number(disposeData.saleAmount) > 0 && disposeData.paymentMode === 'Bank' && !disposeData.debitLedgerID) {
        setError('बँक प्राप्तीसाठी बँक जी.एल. खाते (Bank GL Account) निवडणे आवश्यक आहे.');
        return;
      }
    }
    try {
      const { paymentMode, ...disposalEntityFields } = disposeData;
      await axios.post(`${API_URL}/AssetDisposals`, {
        disposal: {
          ...disposalEntityFields,
          assetID: selectedAsset.assetID,
          saleAmount: parseFloat(disposeData.saleAmount as any)
        },
        postVoucher: disposeData.postVoucher,
        paymentMode,
        debitLedgerID: (Number(disposeData.saleAmount) > 0 && paymentMode === 'Bank') ? disposeData.debitLedgerID : null,
        creditLedgerID: disposeData.creditLedgerID,
        profitLossLedgerID: disposeData.profitLossLedgerID
      });
      setSuccess('मालमत्ता यशस्वीरित्या विल्हेवाट लावण्यात आली! (Asset disposed successfully!)');
      fetchAssets();
      selectAsset({ ...selectedAsset, status: 'Disposed', currentBookValue: 0 });
    } catch (err: any) {
      setError(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || 'त्रुटी आली.'));
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

  // Filtered Assets based on search query
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      const q = (searchQuery || '').trim().toLowerCase();
      if (!q) return true;
      return (
        (a.assetCode && a.assetCode.toLowerCase().includes(q)) ||
        (a.assetName && a.assetName.toLowerCase().includes(q)) ||
        (a.custodian && a.custodian.toLowerCase().includes(q)) ||
        (a.location && a.location.toLowerCase().includes(q)) ||
        (a.category?.categoryName && a.category.categoryName.toLowerCase().includes(q)) ||
        (a.branch?.branchName && a.branch.branchName.toLowerCase().includes(q))
      );
    });
  }, [assets, searchQuery]);

  // KPI Calculations
  const totalAssetsCount = assets.length;
  const totalOriginalCost = assets.reduce((sum, a) => sum + (a.originalCost || 0), 0);
  const totalAccumDepr = assets.reduce((sum, a) => sum + (a.accumulatedDepreciation || 0), 0);
  const totalBookValue = assets.reduce((sum, a) => sum + (a.currentBookValue || 0), 0);

  const labelClass = 'block text-[11px] font-bold text-gray-700 mb-0.5';
  const inputClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';
  const selectClass = 'w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]';

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans pb-8">
      
      {/* 🌟 1. TOP SLEEK CBS HEADER BANNER */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Building2 size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>मालमत्ता व्यवस्थापन हब</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Assets Management Hub)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              स्थिर मालमत्ता यादी, ओपनिंग शिल्लक नोंद, वाटप, शाखा हस्तांतरण, घसारा आकारणी व विल्हेवाट
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
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
            className={`px-3 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              showAddOpening
                ? 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                : 'bg-primary hover:opacity-90 text-white'
            }`}
          >
            {showAddOpening ? <X size={14} /> : <Plus size={14} />}
            <span>{showAddOpening ? 'फॉर्म बंद करा' : 'मालमत्ता शिल्लक (Opening Asset)'}</span>
          </button>

          <button
            type="button"
            onClick={fetchAssets}
            disabled={loading}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="डेटा रिफ्रेश करा"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">रिफ्रेश</span>
          </button>

          <button
            type="button"
            onClick={handleManualGlSync}
            disabled={syncingGl || loading}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="डेडस्टॉक शिल्लक ताळेबंद (Balance Sheet) व खतावणीशी (GL) सिंक करा"
          >
            <BookOpen size={13} className={syncingGl ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{syncingGl ? 'सिंक होत आहे...' : 'ताळेबंद सिंक (GL)'}</span>
          </button>
        </div>
      </div>

      {/* 📊 2. SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण मालमत्ता (Assets)</div>
            <div className="text-sm font-black text-gray-900">{totalAssetsCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-700 border border-blue-200 rounded">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण मूळ किंमत (Cost)</div>
            <div className="text-sm font-black text-blue-900 font-mono">₹{totalOriginalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकत्रित घसारा (Depr.)</div>
            <div className="text-sm font-black text-amber-800 font-mono">₹{totalAccumDepr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">चालू पुस्तकी मूल्य (WDV)</div>
            <div className="text-sm font-black text-emerald-800 font-mono">₹{totalBookValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-2.5 rounded-sm mb-3 border font-semibold flex items-center justify-between text-xs bg-rose-50 text-rose-900 border-rose-300 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-gray-500 hover:text-gray-800 text-xs px-1 font-bold cursor-pointer">✕</button>
        </div>
      )}
      {success && (
        <div className="p-2.5 rounded-sm mb-3 border font-semibold flex items-center justify-between text-xs bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-gray-500 hover:text-gray-800 text-xs px-1 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Add Opening Balance Asset Form - Themed & Structured */}
      {showAddOpening && (
        <div className="bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary mb-3 overflow-hidden transition-all duration-200 animate-in fade-in">
          <div className="bg-slate-50 px-3.5 py-2 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/10 text-primary rounded">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-800">नवीन मालमत्ता शिल्लक नोंद (Asset Opening Balance Entry)</h3>
                <p className="text-[10px] text-gray-500">प्रारंभिक शिल्लक (Opening Balance) मालमत्तेची माहिती, खरेदी किंमत व घसारा नोंदवा</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setShowAddOpening(false)} 
              className="text-gray-400 hover:text-gray-700 text-xs font-bold cursor-pointer p-1"
              title="फॉर्म बंद करा"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {(() => {
            const safeQty = Math.max(1, openingData.quantity || 1);
            const isPerUnit = openingData.costMode === 'perUnit';
            const unitCost = isPerUnit ? openingData.originalCost : (openingData.originalCost / safeQty);
            const unitDepr = isPerUnit ? openingData.accumulatedDepreciation : (openingData.accumulatedDepreciation / safeQty);
            const unitWdv = Math.max(0, unitCost - unitDepr);

            const totalCostCalc = isPerUnit ? (openingData.originalCost * safeQty) : openingData.originalCost;
            const totalDeprCalc = isPerUnit ? (openingData.accumulatedDepreciation * safeQty) : openingData.accumulatedDepreciation;
            const totalWdvCalc = Math.max(0, totalCostCalc - totalDeprCalc);

            return (
              <form onSubmit={handleAddOpeningSubmit} className="p-3.5 space-y-3">
                {/* Row 1: Branch, Category, Code, Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className={labelClass}>शाखा (Branch) *</label>
                    <select 
                      name="branchID" 
                      value={openingData.branchID} 
                      onChange={handleOpeningChange}
                      className={selectClass}
                    >
                      {branches.map((b: any) => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>मालमत्ता वर्ग (Category) *</label>
                    <select 
                      name="categoryID" 
                      value={openingData.categoryID} 
                      onChange={handleOpeningChange} 
                      required
                      className={selectClass}
                    >
                      <option value={0}>-- वर्ग निवडा --</option>
                      {categories.map((c: any) => <option key={c.categoryID} value={c.categoryID}>{c.categoryName}</option>)}
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
                      value={openingData.assetCode} 
                      onChange={handleOpeningChange} 
                      required
                      className={`${inputClass} font-mono font-bold text-primary`} 
                      placeholder={safeQty > 1 ? "उदा. COMP-HQ किंवा FURN" : "उदा. COMP-HQ-01"} 
                    />
                  </div>
                  <div>
                    <label className={labelClass}>मालमत्ता नाव (Asset Name) *</label>
                    <input 
                      type="text" 
                      name="assetName" 
                      value={openingData.assetName} 
                      onChange={handleOpeningChange} 
                      required
                      className={inputClass} 
                      placeholder="उदा. Lenovo ThinkCentre / Executive Chair" 
                    />
                  </div>
                </div>

                {/* Row 2: Purchase Date, Quantity, Calculation Mode, Cost */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className={labelClass}>खरेदी तारीख (Purchase Date) *</label>
                    <input 
                      type="date" 
                      name="purchaseDate" 
                      value={openingData.purchaseDate} 
                      onChange={handleOpeningChange} 
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
                      value={openingData.quantity || ''} 
                      onChange={handleOpeningChange} 
                      required 
                      min="1" 
                      step="1"
                      className={`${inputClass} font-bold text-primary bg-primary/5 border-primary/30`} 
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>किंमत पद्धत (Calculation Mode)</label>
                    <select 
                      name="costMode" 
                      value={openingData.costMode} 
                      onChange={handleOpeningChange}
                      className={selectClass}
                    >
                      <option value="perUnit">प्रति नग किंमत (Per Item Cost)</option>
                      <option value="total">एकूण एकत्रित किंमत (Total Lump-sum)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>
                      {openingData.costMode === 'perUnit' ? 'प्रति नग मूळ किंमत (Cost / Unit ₹) *' : 'सर्व नगांची एकूण किंमत (Total Cost ₹) *'}
                    </label>
                    <input 
                      type="number" 
                      name="originalCost" 
                      value={openingData.originalCost || ''} 
                      onChange={handleOpeningChange} 
                      required 
                      min="0" 
                      step="0.01"
                      className={inputClass} 
                    />
                  </div>
                </div>

                {/* Row 3: Accumulated Depr, Unit WDV, Location, Custodian */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div>
                    <label className={labelClass}>
                      {openingData.costMode === 'perUnit' ? 'प्रति नग घसारा (Depr / Unit ₹)' : 'एकूण एकत्रित घसारा (Total Depr ₹)'}
                    </label>
                    <input 
                      type="number" 
                      name="accumulatedDepreciation" 
                      value={openingData.accumulatedDepreciation || ''} 
                      onChange={handleOpeningChange} 
                      min="0" 
                      step="0.01"
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
                      value={openingData.location} 
                      onChange={handleOpeningChange}
                      className={inputClass} 
                      placeholder="उदा. 1st Floor / IT Room / Hall" 
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ताबाधारक (Custodian)</label>
                    <input 
                      type="text" 
                      name="custodian" 
                      value={openingData.custodian} 
                      onChange={handleOpeningChange}
                      className={inputClass} 
                      placeholder="उदा. Head Cashier / Clerk / Rajesh Patel" 
                    />
                  </div>
                </div>

                {/* Batch Helper / Live Preview Box when Quantity > 1 */}
                {safeQty > 1 && (
                  <div className="bg-primary/5 border border-primary/20 rounded p-2.5 text-xs space-y-1.5 animate-in fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-1.5">
                      <div className="font-bold text-primary flex items-center gap-1.5">
                        <Layers size={14} />
                        <span>एकाधिक मालमत्ता निर्मिती बॅच (Batch Creation: {safeQty} Items)</span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium">
                        कोड सिक्वेन्स प्रिव्ह्यू: <span className="font-mono font-bold text-primary">{openingData.assetCode.trim() || 'ASSET'}-001</span> ते <span className="font-mono font-bold text-primary">{openingData.assetCode.trim() || 'ASSET'}-{String(safeQty).padStart(3, '0')}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                      <div className="bg-white p-1.5 rounded border border-primary/10">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">एकूण मूळ खर्च (Total Cost)</div>
                        <div className="text-xs font-black text-gray-900 font-mono">₹{totalCostCalc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-primary/10">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">एकूण घसारा (Total Depr)</div>
                        <div className="text-xs font-black text-amber-700 font-mono">₹{totalDeprCalc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-primary/10">
                        <div className="text-[10px] text-gray-500 font-bold uppercase">एकूण निव्वळ WDV मूल्य</div>
                        <div className="text-xs font-black text-emerald-700 font-mono">₹{totalWdvCalc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button 
                    type="submit" 
                    className="bg-primary hover:opacity-90 text-white px-4 py-1.5 rounded-sm text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <Save size={13} />
                    <span>{safeQty > 1 ? `सर्व ${safeQty} शिल्लक मालमत्ता सेव्ह करा` : 'शिल्लक सेव्ह करा (Save Asset)'}</span>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setShowAddOpening(false)} 
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-sm text-xs font-bold cursor-pointer transition-all"
                  >
                    रद्द करा
                  </button>
                </div>
              </form>
            );
          })()}
        </div>
      )}

      {/* Main Two-Column Hub Layout */}
      <div className="flex flex-col xl:flex-row gap-3">
        {/* Left pane - Assets grid & filters */}
        <div className="flex-1 bg-white rounded-sm shadow-xs border border-gray-200 p-3">
          
          {/* Header Title inside Hub */}
          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-3">
            <h2 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-primary" />
              <span>मालमत्ता यादी (Assets List & Register)</span>
            </h2>
            <div className="text-[11px] text-gray-500 font-medium">
              नोंदी: <span className="font-bold text-primary font-mono">{filteredAssets.length}</span> / {assets.length}
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="bg-slate-50 border border-gray-200 rounded-sm p-2 mb-2.5 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Quick Search */}
              <div className="relative min-w-[180px] flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="कोड, नाव, ताबाधारक शोधा..."
                  className="w-full text-[11px] border border-gray-300 rounded-sm pl-7 pr-6 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white h-[28px]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 text-xs">
                    ✕
                  </button>
                )}
              </div>

              {/* Branch Filter */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">शाखा:</span>
                <select 
                  value={branchFilter} 
                  onChange={e => setBranchFilter(e.target.value)} 
                  className="border border-gray-300 rounded-sm px-2 py-0.5 text-[11px] bg-white h-[28px] focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="all">सर्व शाखा (All)</option>
                  {branches.map(b => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">वर्ग:</span>
                <select 
                  value={categoryFilter} 
                  onChange={e => setCategoryFilter(e.target.value)} 
                  className="border border-gray-300 rounded-sm px-2 py-0.5 text-[11px] bg-white h-[28px] focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="all">सर्व वर्ग (All)</option>
                  {categories.map(c => <option key={c.categoryID} value={c.categoryID}>{c.categoryName}</option>)}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">स्थिती:</span>
                <select 
                  value={statusFilter} 
                  onChange={e => setStatusFilter(e.target.value)} 
                  className="border border-gray-300 rounded-sm px-2 py-0.5 text-[11px] bg-white h-[28px] focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  <option value="all">सर्व स्थिती (All)</option>
                  <option value="Active">Active (सक्रिय)</option>
                  <option value="Suspended">Suspended (स्थगित)</option>
                  <option value="Damaged">Damaged (खराब)</option>
                  <option value="Disposed">Disposed (विल्हेवाट)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Assets Grid */}
          <div className="overflow-x-auto border border-gray-200 rounded-sm shadow-2xs">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-primary border-b-2 border-primary font-bold text-left">
                  <th className="px-2.5 py-2">#</th>
                  <th className="px-2.5 py-2">शाखा (Branch)</th>
                  <th className="px-2.5 py-2">कोड (Code)</th>
                  <th className="px-2.5 py-2">नाव (Name)</th>
                  <th className="px-2.5 py-2">वर्ग (Category)</th>
                  <th className="px-2.5 py-2">खरेदी तारीख</th>
                  <th className="px-2.5 py-2 text-right">मूळ किंमत</th>
                  <th className="px-2.5 py-2 text-right">पुस्तकी मूल्य (WDV)</th>
                  <th className="px-2.5 py-2 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-6 text-gray-400">लोड होत आहे...</td></tr>
                ) : filteredAssets.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-6 text-gray-400">कोणतीही मालमत्ता सापडली नाही.</td></tr>
                ) : (
                  filteredAssets.map((a, idx) => {
                    const isSelected = selectedAsset?.assetID === a.assetID;
                    return (
                      <tr 
                        key={a.assetID} 
                        onClick={() => selectAsset(a)}
                        className={`cursor-pointer transition-colors duration-150 ${
                          isSelected 
                            ? 'bg-primary/10 border-l-4 border-primary text-gray-900 font-semibold' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="px-2.5 py-2 text-gray-500">{idx + 1}</td>
                        <td className="px-2.5 py-2">
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-slate-200">
                            {a.branch?.branchName || `शाखा ${a.branchID}`}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 font-mono font-bold text-primary">{a.assetCode}</td>
                        <td className="px-2.5 py-2 font-medium">{a.assetName}</td>
                        <td className="px-2.5 py-2 text-gray-600">{a.category?.categoryName || '-'}</td>
                        <td className="px-2.5 py-2 text-gray-600">{new Date(a.purchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                        <td className="px-2.5 py-2 text-right font-mono text-gray-700">₹{a.originalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-900">₹{a.currentBookValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-2.5 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            a.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                            a.status === 'Suspended' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                            a.status === 'Damaged' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                            'bg-slate-100 text-slate-700 border-slate-300'
                          }`}>
                            {a.status === 'Active' ? 'सक्रिय' : a.status === 'Suspended' ? 'स्थगित' : a.status === 'Damaged' ? 'खराब' : 'विल्हेवाट'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right pane - Action Forms and History Timeline */}
        {selectedAsset ? (
          <div className="w-full xl:w-96 bg-white rounded-sm shadow-xs border border-gray-200 p-3 flex flex-col self-start">
            {/* Selected Header */}
            <div className="border-b border-gray-200 pb-2 mb-2.5 flex justify-between items-start">
              <div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">निवडलेली मालमत्ता (Selected Asset)</div>
                <h2 className="text-xs font-bold text-primary mt-0.5">{selectedAsset.assetName}</h2>
              </div>
              <span className="font-mono text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-bold">
                {selectedAsset.assetCode}
              </span>
            </div>

            {/* Action Navigation Tabs */}
            <div className="flex flex-wrap border-b border-gray-200 mb-3 gap-1 text-[10px] font-bold pb-2">
              <button 
                onClick={() => setActiveActionTab('details')} 
                className={`px-2 py-1 rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                  activeActionTab === 'details' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Info size={12} />
                <span>माहिती व इतिहास</span>
              </button>

              {selectedAsset.status === 'Active' && (
                <>
                  <button 
                    onClick={() => setActiveActionTab('allocate')} 
                    className={`px-2 py-1 rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                      activeActionTab === 'allocate' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <UserCheck size={12} />
                    <span>वाटप</span>
                  </button>

                  <button 
                    onClick={() => setActiveActionTab('transfer')} 
                    className={`px-2 py-1 rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                      activeActionTab === 'transfer' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <ArrowRightLeft size={12} />
                    <span>हस्तांतरण</span>
                  </button>

                  <button 
                    onClick={() => setActiveActionTab('verify')} 
                    className={`px-2 py-1 rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                      activeActionTab === 'verify' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <ShieldCheck size={12} />
                    <span>तपासणी</span>
                  </button>

                  <button 
                    onClick={() => setActiveActionTab('maintenance')} 
                    className={`px-2 py-1 rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                      activeActionTab === 'maintenance' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Wrench size={12} />
                    <span>देखभाल</span>
                  </button>

                  <button 
                    onClick={handleOpenDepreciationTab} 
                    className={`px-2 py-1 rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                      activeActionTab === 'depreciation' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Percent size={12} />
                    <span>घसारा</span>
                  </button>

                  <button 
                    onClick={handleOpenDisposeTab} 
                    className={`px-2 py-1 rounded-sm transition-all flex items-center gap-1 cursor-pointer ${
                      activeActionTab === 'dispose' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <Trash2 size={12} />
                    <span>विल्हेवाट</span>
                  </button>
                </>
              )}
            </div>

            {/* TAB CONTENT: Details & History Timeline */}
            {activeActionTab === 'details' && (
              <div className="space-y-3 flex-1 overflow-y-auto">
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 text-xs divide-y divide-gray-200/70">
                  <div className="flex justify-between py-1"><span className="text-gray-500">शाखा (Branch):</span> <span className="font-semibold text-gray-800">{selectedAsset.branch?.branchName}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500">वर्ग (Category):</span> <span className="font-semibold text-gray-800">{selectedAsset.category?.categoryName}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500">खरेदी किंमत:</span> <span className="font-semibold text-gray-800 font-mono">₹{selectedAsset.originalCost.toFixed(2)}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500">एकत्रित घसारा:</span> <span className="font-semibold text-amber-700 font-mono">₹{selectedAsset.accumulatedDepreciation.toFixed(2)}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500">पुस्तकी मूल्य (WDV):</span> <span className="font-bold text-emerald-700 font-mono">₹{selectedAsset.currentBookValue.toFixed(2)}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500">स्थान (Location):</span> <span className="font-semibold text-gray-800">{selectedAsset.location || '-'}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500">ताबाधारक (Custodian):</span> <span className="font-semibold text-gray-800">{selectedAsset.custodian || '-'}</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500">घसारा पद्धत/दर:</span> <span className="font-semibold text-gray-800">{selectedAsset.category?.depreciationMethod} ({selectedAsset.category?.depreciationRate}%)</span></div>
                  <div className="flex justify-between py-1"><span className="text-gray-500">ओपनिंग शिल्लक?:</span> <span className="font-semibold text-gray-800">{selectedAsset.isOpeningBalance ? 'होय (Yes)' : 'नाही (No)'}</span></div>
                </div>

                <div className="border-t border-gray-200 pt-2.5">
                  <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock size={12} className="text-primary" />
                    <span>व्यवहार इतिहास (Transaction Timeline)</span>
                  </h4>
                  {historyLoading ? (
                    <div className="text-center py-4 text-xs text-gray-400">इतिहास लोड होत आहे...</div>
                  ) : assetHistory.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">या मालमत्तेचा कोणताही इतिहास नाही.</div>
                  ) : (
                    <div className="relative border-l-2 border-primary/30 ml-2.5 pl-3.5 space-y-3">
                      {assetHistory.map((item, idx) => (
                        <div key={idx} className="relative text-xs">
                          {/* Dot indicator */}
                          <div className={`absolute -left-[19px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white 
                            ${item.type === 'Allocation' ? 'bg-indigo-500' :
                              item.type === 'Transfer' ? 'bg-blue-500' :
                              item.type === 'Verification' ? 'bg-emerald-500' :
                              item.type === 'Maintenance' ? 'bg-orange-500' :
                              item.type === 'Depreciation' ? 'bg-purple-500' : 'bg-red-500'}`} />
                          
                          <p className="text-[10px] font-semibold text-gray-400">{new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                          <p className="font-bold text-gray-800 mt-0.5">{item.type}</p>
                          <p className="text-[11px] text-gray-600">{item.description}</p>
                          {item.remarks && <p className="text-[10px] italic text-gray-500 mt-0.5">टीप: {item.remarks}</p>}
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
                <div className="font-bold text-gray-800 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-primary" />
                  <span>नवीन वाटप (Asset Allocation)</span>
                </div>
                <div>
                  <label className={labelClass}>शाखा (Branch)</label>
                  <select 
                    value={allocateData.allocatedBranchID} 
                    onChange={e => setAllocateData({ ...allocateData, allocatedBranchID: parseInt(e.target.value) })}
                    className={selectClass}
                  >
                    {branches.map((b: any) => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>विभाग (Department) *</label>
                  <input 
                    type="text" 
                    value={allocateData.department} 
                    onChange={e => setAllocateData({ ...allocateData, department: e.target.value })} 
                    required
                    className={inputClass} 
                    placeholder="उदा. कर्ज विभाग / कॅश विभाग" 
                  />
                </div>
                <div>
                  <label className={labelClass}>ताबाधारक (Custodian Name) *</label>
                  <input 
                    type="text" 
                    value={allocateData.custodianName} 
                    onChange={e => setAllocateData({ ...allocateData, custodianName: e.target.value })} 
                    required
                    className={inputClass} 
                    placeholder="उदा. रमेश कुमार / संजीव शर्मा" 
                  />
                </div>
                <div>
                  <label className={labelClass}>वाटप तारीख (Date)</label>
                  <input 
                    type="date" 
                    value={allocateData.allocationDate} 
                    onChange={e => setAllocateData({ ...allocateData, allocationDate: e.target.value })} 
                    required
                    className={inputClass} 
                  />
                </div>
                <div>
                  <label className={labelClass}>तपशील (Remarks)</label>
                  <textarea 
                    value={allocateData.remarks} 
                    onChange={e => setAllocateData({ ...allocateData, remarks: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900" 
                    rows={2} 
                    placeholder="अधिक माहिती..." 
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-primary hover:opacity-90 text-white py-1.5 rounded-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-1"
                >
                  <Save size={13} />
                  <span>वाटप जतन करा</span>
                </button>
              </form>
            )}

            {/* TAB CONTENT: Transfer */}
            {activeActionTab === 'transfer' && (
              <form onSubmit={handleTransfer} className="space-y-2.5 text-xs flex-1">
                <div className="font-bold text-gray-800 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                  <ArrowRightLeft size={14} className="text-primary" />
                  <span>शाखा हस्तांतरण (Asset Branch Transfer)</span>
                </div>
                <div className="bg-amber-50/70 border border-amber-200 text-amber-900 p-2 rounded-sm text-[10px] font-semibold space-y-0.5">
                  <div>वर्तमान शाखा: <span className="font-bold">{selectedAsset.branch?.branchName}</span></div>
                  <div>वर्तमान ताबाधारक: <span className="font-bold">{selectedAsset.custodian || 'उपलब्ध नाही'}</span></div>
                </div>
                <div>
                  <label className={labelClass}>कोणत्या शाखेत हस्तांतरित करायचे? (To Branch) *</label>
                  <select 
                    value={transferData.toBranchID} 
                    onChange={e => setTransferData({ ...transferData, toBranchID: parseInt(e.target.value) })}
                    className={selectClass}
                  >
                    {branches.filter(b => b.branchID !== selectedAsset.branchID).map((b: any) => <option key={b.branchID} value={b.branchID}>{b.branchName}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>नवीन ताबाधारक (To Custodian) *</label>
                  <input 
                    type="text" 
                    value={transferData.toCustodian} 
                    onChange={e => setTransferData({ ...transferData, toCustodian: e.target.value })} 
                    required
                    className={inputClass} 
                    placeholder="नवीन जबाबदार व्यक्तीचे नाव..." 
                  />
                </div>
                <div>
                  <label className={labelClass}>हस्तांतरण तारीख (Transfer Date)</label>
                  <input 
                    type="date" 
                    value={transferData.transferDate} 
                    onChange={e => setTransferData({ ...transferData, transferDate: e.target.value })} 
                    required
                    className={inputClass} 
                  />
                </div>
                <div>
                  <label className={labelClass}>तपशील (Remarks)</label>
                  <textarea 
                    value={transferData.remarks} 
                    onChange={e => setTransferData({ ...transferData, remarks: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900" 
                    rows={2} 
                    placeholder="स्थानांतरणाचे कारण..." 
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-primary hover:opacity-90 text-white py-1.5 rounded-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-1"
                >
                  <ArrowRightLeft size={13} />
                  <span>हस्तांतरित करा</span>
                </button>
              </form>
            )}

            {/* TAB CONTENT: Verify */}
            {activeActionTab === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-2.5 text-xs flex-1">
                <div className="font-bold text-gray-800 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-primary" />
                  <span>भौतिक तपासणी (Physical Verification Audit)</span>
                </div>
                <div>
                  <label className={labelClass}>तपासणी अधिकारी / ऑडिटर (Auditor Name) *</label>
                  <input 
                    type="text" 
                    value={verifyData.auditorName} 
                    onChange={e => setVerifyData({ ...verifyData, auditorName: e.target.value })} 
                    required
                    className={inputClass} 
                    placeholder="उदा. CA Shrikant Gokhale" 
                  />
                </div>
                <div>
                  <label className={labelClass}>भौतिक स्थिती (Physical Status) *</label>
                  <select 
                    value={verifyData.physicalStatus} 
                    onChange={e => setVerifyData({ ...verifyData, physicalStatus: e.target.value })}
                    className={selectClass}
                  >
                    <option value="Found">व्यवस्थित सापडली (Found - Active)</option>
                    <option value="Missing">सापडत नाही (Missing - Suspended)</option>
                    <option value="Damaged">खराब झाली (Damaged - Damaged)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>तपासणी तारीख (Audit Date)</label>
                  <input 
                    type="date" 
                    value={verifyData.verificationDate} 
                    onChange={e => setVerifyData({ ...verifyData, verificationDate: e.target.value })} 
                    required
                    className={inputClass} 
                  />
                </div>
                <div>
                  <label className={labelClass}>तपशील (Remarks)</label>
                  <textarea 
                    value={verifyData.remarks} 
                    onChange={e => setVerifyData({ ...verifyData, remarks: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900" 
                    rows={2} 
                    placeholder="भौतिक पडताळणी संबंधित टिप्पणी..." 
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-primary hover:opacity-90 text-white py-1.5 rounded-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-1"
                >
                  <CheckCircle size={13} />
                  <span>तपासणी नोंद जतन करा</span>
                </button>
              </form>
            )}

            {/* TAB CONTENT: Maintenance */}
            {activeActionTab === 'maintenance' && (
              <form onSubmit={handleMaintenanceSubmit} className="space-y-2 text-xs flex-1">
                <div className="font-bold text-gray-800 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                  <Wrench size={14} className="text-primary" />
                  <span>देखभाल नोंद (Asset Maintenance Log)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>देखभाल प्रकार *</label>
                    <select 
                      value={maintenanceData.maintenanceType} 
                      onChange={e => setMaintenanceData({ ...maintenanceData, maintenanceType: e.target.value })}
                      className={selectClass}
                    >
                      <option value="Repair">दुरुस्ती (Repair)</option>
                      <option value="AMC">करार (AMC)</option>
                      <option value="Routine">नियमित सर्व्हिस (Routine)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>सर्व्हिस प्रोव्हाइडर *</label>
                    <input 
                      type="text" 
                      value={maintenanceData.serviceProvider} 
                      onChange={e => setMaintenanceData({ ...maintenanceData, serviceProvider: e.target.value })} 
                      required
                      className={inputClass} 
                      placeholder="उदा. Dell Care / Vendor" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>खर्च (Cost ₹) *</label>
                    <input 
                      type="number" 
                      value={maintenanceData.cost || ''} 
                      onChange={e => setMaintenanceData({ ...maintenanceData, cost: parseFloat(e.target.value) })} 
                      required 
                      min="0" 
                      step="0.01"
                      className={inputClass} 
                    />
                  </div>
                  <div>
                    <label className={labelClass}>पुढील सर्व्हिस तारीख</label>
                    <input 
                      type="date" 
                      value={maintenanceData.nextServiceDate} 
                      onChange={e => setMaintenanceData({ ...maintenanceData, nextServiceDate: e.target.value })}
                      className={inputClass} 
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>तपशील (Remarks)</label>
                  <textarea 
                    value={maintenanceData.remarks} 
                    onChange={e => setMaintenanceData({ ...maintenanceData, remarks: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900" 
                    rows={1.5} 
                    placeholder="देखभालीचे सविस्तर वर्णन..." 
                  />
                </div>

                {/* Accounting Voucher fields */}
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 mt-1.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={maintenanceData.postVoucher} 
                      onChange={e => setMaintenanceData({ ...maintenanceData, postVoucher: e.target.checked })} 
                      className="rounded accent-primary" 
                    />
                    <span>हिशोब वही मध्ये व्हाउचर पोस्ट करा (Post Voucher)</span>
                  </label>

                  {maintenanceData.postVoucher && (
                    <div className="grid grid-cols-1 gap-1.5 text-[10px] pt-1 border-t border-slate-200">
                      <div>
                        <label className={labelClass}>नाव खाते (Debit Ledger - Expense) *</label>
                        <select 
                          value={maintenanceData.debitLedgerID} 
                          onChange={e => setMaintenanceData({ ...maintenanceData, debitLedgerID: parseInt(e.target.value) })} 
                          required
                          className={selectClass}
                        >
                          <option value={0}>-- खर्च खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerID} - {l.ledgerName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>पेमेंट पद्धत (Payment Mode) *</label>
                        <select
                          value={maintenanceData.paymentMode}
                          onChange={e => setMaintenanceData({
                            ...maintenanceData,
                            paymentMode: e.target.value as 'Cash' | 'Bank',
                            creditLedgerID: e.target.value === 'Cash' ? 0 : maintenanceData.creditLedgerID
                          })}
                          className={selectClass}
                        >
                          <option value="Cash">💵 रोख रक्कम (Cash)</option>
                          <option value="Bank">🏦 बँक खाते (Bank Account)</option>
                        </select>
                      </div>
                      {maintenanceData.paymentMode === 'Bank' && (
                        <div>
                          <BankLedgerSelect
                            label="🏦 जमा बँक जी.एल. खाते (Credit Bank GL) *"
                            ledgers={ledgers}
                            value={maintenanceData.creditLedgerID}
                            onChange={id => setMaintenanceData({ ...maintenanceData, creditLedgerID: id })}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-primary hover:opacity-90 text-white py-1.5 rounded-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-1"
                >
                  <Save size={13} />
                  <span>नोंदवा व व्हाउचर पोस्ट करा</span>
                </button>
              </form>
            )}

            {/* TAB CONTENT: Depreciation */}
            {activeActionTab === 'depreciation' && (
              <form onSubmit={handleSingleDepreciationSubmit} className="space-y-2 text-xs flex-1">
                <div className="font-bold text-gray-800 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                  <Percent size={14} className="text-primary" />
                  <span>मालमत्ता घसारा आकारणी (Asset Depreciation Run)</span>
                </div>
                
                <div className="bg-primary/5 border border-primary/20 text-slate-800 p-2 rounded-sm text-[10px] font-semibold space-y-0.5">
                  <div>पद्धत (Method): <span className="font-bold text-primary">{selectedAsset.category?.depreciationMethod}</span> ({selectedAsset.category?.depreciationRate}%)</div>
                  <div>मूळ खरेदी किंमत (Cost): <span className="font-bold font-mono">₹{selectedAsset.originalCost.toFixed(2)}</span></div>
                  <div>चालू पुस्तकी मूल्य (WDV): <span className="font-bold text-emerald-800 font-mono">₹{selectedAsset.currentBookValue.toFixed(2)}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>गणना तारीख *</label>
                    <input 
                      type="date" 
                      value={depData.calculationDate} 
                      onChange={e => setDepData({ ...depData, calculationDate: e.target.value })} 
                      required
                      className={inputClass} 
                    />
                  </div>
                  <div>
                    <label className={labelClass}>घसारा रक्कम (₹) *</label>
                    <input 
                      type="number" 
                      value={depData.depreciationAmount || ''} 
                      onChange={e => setDepData({ ...depData, depreciationAmount: parseFloat(e.target.value) })} 
                      required 
                      min="0" 
                      step="0.01"
                      className={inputClass} 
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 mt-1.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={depData.postVoucher} 
                      onChange={e => setDepData({ ...depData, postVoucher: e.target.checked })} 
                      className="rounded accent-primary" 
                    />
                    <span>हिशोब वही मध्ये जनरल व्हाउचर पोस्ट करा</span>
                  </label>

                  {depData.postVoucher && (
                    <div className="grid grid-cols-1 gap-1.5 text-[10px] pt-1 border-t border-slate-200">
                      <div>
                        <label className={labelClass}>नाव खाते (Debit Depreciation Expense) *</label>
                        <select 
                          value={depData.debitLedgerID} 
                          onChange={e => setDepData({ ...depData, debitLedgerID: parseInt(e.target.value) })} 
                          required
                          className={selectClass}
                        >
                          <option value={0}>-- घसारा खर्च खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>जमा खाते (Credit Accum Depr / Asset) *</label>
                        <select 
                          value={depData.creditLedgerID} 
                          onChange={e => setDepData({ ...depData, creditLedgerID: parseInt(e.target.value) })} 
                          required
                          className={selectClass}
                        >
                          <option value={0}>-- जमा मालमत्ता खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-primary hover:opacity-90 text-white py-1.5 rounded-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-1"
                >
                  <Save size={13} />
                  <span>घसारा प्रक्रिया जतन करा</span>
                </button>
              </form>
            )}

            {/* TAB CONTENT: Dispose */}
            {activeActionTab === 'dispose' && (
              <form onSubmit={handleDisposeSubmit} className="space-y-2 text-xs flex-1">
                <div className="font-bold text-rose-700 border-b border-gray-200 pb-1 flex items-center gap-1.5">
                  <Trash2 size={14} className="text-rose-600" />
                  <span>मालमत्ता विल्हेवाट (Asset Disposal Entry)</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 text-rose-900 p-2 rounded-sm text-[10px] font-semibold">
                  चालू पुस्तकी मूल्य (Current Book Value): <span className="font-mono font-bold">₹{selectedAsset.currentBookValue.toFixed(2)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>विल्हेवाट प्रकार *</label>
                    <select 
                      value={disposeData.disposalType} 
                      onChange={e => setDisposeData({ ...disposeData, disposalType: e.target.value })}
                      className={selectClass}
                    >
                      <option value="Scrap">स्क्रॅप (Scrap)</option>
                      <option value="Sale">विक्री (Sale)</option>
                      <option value="Write-Off">राईट ऑफ (Write-Off)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>विक्री रक्कम (Sale Price ₹)</label>
                    <input 
                      type="number" 
                      value={disposeData.saleAmount || ''} 
                      onChange={e => setDisposeData({ ...disposeData, saleAmount: parseFloat(e.target.value) })} 
                      min="0" 
                      step="0.01"
                      className={inputClass} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>खरेदीदार (Buyer Name)</label>
                    <input 
                      type="text" 
                      value={disposeData.buyerName} 
                      onChange={e => setDisposeData({ ...disposeData, buyerName: e.target.value })}
                      className={inputClass} 
                      placeholder="खरेदीदाराचे नाव..." 
                    />
                  </div>
                  <div>
                    <label className={labelClass}>विल्हेवाट तारीख *</label>
                    <input 
                      type="date" 
                      value={disposeData.disposalDate} 
                      onChange={e => setDisposeData({ ...disposeData, disposalDate: e.target.value })} 
                      required
                      className={inputClass} 
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>तपशील (Remarks)</label>
                  <textarea 
                    value={disposeData.remarks} 
                    onChange={e => setDisposeData({ ...disposeData, remarks: e.target.value })}
                    className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900" 
                    rows={1.5} 
                    placeholder="अधिक माहिती..." 
                  />
                </div>

                {/* Accounting Voucher fields */}
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-2 mt-1.5 space-y-1.5">
                  <label className="flex items-center gap-1.5 font-bold text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={disposeData.postVoucher} 
                      onChange={e => setDisposeData({ ...disposeData, postVoucher: e.target.checked })} 
                      className="rounded accent-primary" 
                    />
                    <span>हिशोब वही मध्ये व्हाउचर पोस्ट करा (Post Voucher)</span>
                  </label>

                  {disposeData.postVoucher && (
                    <div className="grid grid-cols-1 gap-1.5 text-[10px] pt-1 border-t border-slate-200">
                      {disposeData.saleAmount > 0 && (
                        <>
                          <div>
                            <label className={labelClass}>प्राप्ती पद्धत (Receipt Mode) *</label>
                            <select
                              value={disposeData.paymentMode}
                              onChange={e => setDisposeData({
                                ...disposeData,
                                paymentMode: e.target.value as 'Cash' | 'Bank',
                                debitLedgerID: e.target.value === 'Cash' ? 0 : disposeData.debitLedgerID
                              })}
                              className={selectClass}
                            >
                              <option value="Cash">💵 रोख रक्कम (Cash)</option>
                              <option value="Bank">🏦 बँक खाते (Bank Account)</option>
                            </select>
                          </div>
                          {disposeData.paymentMode === 'Bank' && (
                            <div>
                              <BankLedgerSelect
                                label="🏦 नावे बँक जी.एल. खाते (Debit Bank GL) *"
                                ledgers={ledgers}
                                value={disposeData.debitLedgerID}
                                onChange={id => setDisposeData({ ...disposeData, debitLedgerID: id })}
                              />
                            </div>
                          )}
                        </>
                      )}
                      <div>
                        <label className={labelClass}>जमा खाते (Credit Asset Ledger) *</label>
                        <select 
                          value={disposeData.creditLedgerID} 
                          onChange={e => setDisposeData({ ...disposeData, creditLedgerID: parseInt(e.target.value) })} 
                          required
                          className={selectClass}
                        >
                          <option value={0}>-- मालमत्ता खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>नफा/तोटा खाते (Profit/Loss Ledger) *</label>
                        <select 
                          value={disposeData.profitLossLedgerID} 
                          onChange={e => setDisposeData({ ...disposeData, profitLossLedgerID: parseInt(e.target.value) })} 
                          required
                          className={selectClass}
                        >
                          <option value={0}>-- मालमत्ता विक्री नफा/तोटा खाते निवडा --</option>
                          {ledgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-1.5 rounded-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer mt-1"
                >
                  <Trash2 size={13} />
                  <span>मालमत्ता विल्हेवाट लावा & जतन करा</span>
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="w-full xl:w-96 bg-white rounded-sm shadow-xs border border-gray-200 p-6 flex flex-col items-center justify-center text-center self-start min-h-[300px]">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2 border border-slate-200">
              <Building2 size={24} />
            </div>
            <h3 className="text-xs font-bold text-gray-700">कोणतीही मालमत्ता निवडलेली नाही</h3>
            <p className="text-[11px] text-gray-500 mt-1 max-w-[220px]">
              तपशील पाहण्यासाठी, वाटप, हस्तांतरण, घसारा किंवा विल्हेवाट लावण्यासाठी डाव्या बाजूच्या यादीतून कोणत्याही मालमत्तेवर क्लिक करा.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetMaster;


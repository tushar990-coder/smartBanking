import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Plus, 
  Grid, 
  List, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Key, 
  Box, 
  Sparkles, 
  UserCheck, 
  Layers, 
  Search, 
  Eye, 
  Filter,
  RefreshCw,
  PlusCircle,
  ShieldAlert,
  Building
} from 'lucide-react';

interface LockerType {
  lockerTypeID: number;
  typeCode: string;
  typeName: string;
  annualRent: number;
  securityDeposit: number;
}

interface LockerItem {
  lockerID: number;
  branchID: number;
  cabinetNo: string;
  lockerNo: string;
  keyNo: string;
  lockerTypeID: number;
  typeName: string;
  typeCode: string;
  dimensions?: string;
  annualRent: number;
  securityDeposit: number;
  status: string; // Available, Allotted, UnderMaintenance, Sealed
  remarks?: string;
  isActive: boolean;
  currentAllotment?: {
    allotmentID: number;
    lockerAccountNo: string;
    memberName: string;
    allotmentDate: string;
    expiryDate: string;
  } | null;
}

interface LockerMasterProps {
  onNavigateToAllotment?: (lockerId: number) => void;
}

const LockerMaster: React.FC<LockerMasterProps> = ({ onNavigateToAllotment }) => {
  const [lockers, setLockers] = useState<LockerItem[]>([]);
  const [lockerTypes, setLockerTypes] = useState<LockerType[]>([]);
  const [cabinets, setCabinets] = useState<string[]>([]);
  const [selectedCabinet, setSelectedCabinet] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [mainTab, setMainTab] = useState<'grid' | 'table'>('grid');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Single Form Modal State
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLockerDetail, setSelectedLockerDetail] = useState<LockerItem | null>(null);
  const lockerNoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    lockerID: 0,
    branchID: 1,
    cabinetNo: 'C-1',
    lockerNo: '',
    keyNo: '',
    lockerTypeID: '',
    status: 'Available',
    remarks: '',
    isActive: true
  });

  // Bulk Create Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkData, setBulkData] = useState({
    branchID: 1,
    cabinetNo: 'C-1',
    startNo: 1,
    endNo: 20,
    prefix: 'L-',
    suffix: '',
    keyPrefix: 'K-L-',
    lockerTypeID: '',
    remarks: ''
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchLockers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/Lockers');
      if (Array.isArray(res.data)) setLockers(res.data);
    } catch (err) {
      console.error('Error fetching lockers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLockerTypes = async () => {
    try {
      const res = await axios.get('/api/LockerTypes');
      if (Array.isArray(res.data)) {
        setLockerTypes(res.data);
        if (res.data.length > 0 && !formData.lockerTypeID) {
          setFormData(prev => ({ ...prev, lockerTypeID: res.data[0].lockerTypeID.toString() }));
          setBulkData(prev => ({ ...prev, lockerTypeID: res.data[0].lockerTypeID.toString() }));
        }
      }
    } catch (err) {
      console.error('Error fetching types:', err);
    }
  };

  const fetchCabinets = async () => {
    try {
      const res = await axios.get('/api/Lockers/Cabinets');
      if (Array.isArray(res.data)) setCabinets(res.data);
    } catch (err) {
      console.error('Error fetching cabinets:', err);
    }
  };

  useEffect(() => {
    fetchLockers();
    fetchLockerTypes();
    fetchCabinets();
  }, []);

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lockerNo || !formData.keyNo || !formData.lockerTypeID) {
      showMsg('कृपया लॉकर क्र., चावी क्र. व प्रकार निवडा.', 'error');
      return;
    }

    const payload = {
      ...formData,
      lockerTypeID: parseInt(formData.lockerTypeID)
    };

    try {
      if (isEditing) {
        const res = await axios.put(`/api/Lockers/${formData.lockerID}`, payload);
        showMsg(res.data?.message || 'लॉकर अपडेट केला!');
      } else {
        const res = await axios.post('/api/Lockers', payload);
        showMsg(res.data?.message || 'नवीन लॉकर तयार केला!');
      }
      setIsSingleModalOpen(false);
      fetchLockers();
      fetchCabinets();
    } catch (err: any) {
      console.error(err);
      showMsg(err.response?.data?.message || 'त्रुटी आली.', 'error');
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkData.cabinetNo || !bulkData.lockerTypeID || bulkData.startNo <= 0 || bulkData.endNo < bulkData.startNo) {
      showMsg('कृपया कपाट, प्रकार आणि योग्य नंबर रेंज निवडा.', 'error');
      return;
    }

    const payload = {
      ...bulkData,
      lockerTypeID: parseInt(bulkData.lockerTypeID)
    };

    try {
      const res = await axios.post('/api/Lockers/BulkCreate', payload);
      showMsg(res.data?.message || 'लॉकर्स तयार केले!');
      setIsBulkModalOpen(false);
      fetchLockers();
      fetchCabinets();
    } catch (err: any) {
      console.error(err);
      showMsg(err.response?.data?.message || 'त्रुटी आली.', 'error');
    }
  };

  const handleEdit = (l: LockerItem) => {
    setFormData({
      lockerID: l.lockerID,
      branchID: l.branchID,
      cabinetNo: l.cabinetNo,
      lockerNo: l.lockerNo,
      keyNo: l.keyNo,
      lockerTypeID: l.lockerTypeID.toString(),
      status: l.status,
      remarks: l.remarks || '',
      isActive: l.isActive
    });
    setIsEditing(true);
    setIsSingleModalOpen(true);

    setTimeout(() => {
      if (lockerNoInputRef.current) {
        lockerNoInputRef.current.focus();
        lockerNoInputRef.current.select();
      }
    }, 120);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('तुम्हाला नक्की हा लॉकर डिलीट करायचा आहे का?')) return;

    try {
      const res = await axios.delete(`/api/Lockers/${id}`);
      showMsg(res.data?.message || 'लॉकर डिलीट केला!');
      fetchLockers();
    } catch (err: any) {
      console.error(err);
      showMsg(err.response?.data?.message || 'डिलीट करता आले नाही.', 'error');
    }
  };

  // Filter Lockers
  const safeLockers = Array.isArray(lockers) ? lockers : [];
  const filteredLockers = safeLockers.filter(l => {
    const matchesCabinet = selectedCabinet === 'All' || l.cabinetNo === selectedCabinet;
    const matchesStatus = selectedStatus === 'All' || l.status === selectedStatus;
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term || 
      l.lockerNo.toLowerCase().includes(term) || 
      l.keyNo.toLowerCase().includes(term) ||
      (l.currentAllotment?.memberName && l.currentAllotment.memberName.toLowerCase().includes(term));

    return matchesCabinet && matchesStatus && matchesSearch;
  });

  // Summary counts
  const totalCount = safeLockers.length;
  const availableCount = safeLockers.filter(l => l.status === 'Available').length;
  const allottedCount = safeLockers.filter(l => l.status === 'Allotted').length;
  const maintenanceCount = safeLockers.filter(l => l.status === 'UnderMaintenance').length;
  const sealedCount = safeLockers.filter(l => l.status === 'Sealed').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
        return {
          bg: 'bg-emerald-600 hover:bg-emerald-700',
          border: 'border-emerald-500',
          badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          text: 'text-white',
          lightBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
          label: 'उपलब्ध (Available)'
        };
      case 'Allotted':
        return {
          bg: 'bg-rose-600 hover:bg-rose-700',
          border: 'border-rose-500',
          badge: 'bg-rose-100 text-rose-900 border-rose-300',
          text: 'text-white',
          lightBg: 'bg-rose-50 text-rose-900 border-rose-200',
          label: 'वाटप झालेले (Allotted)'
        };
      case 'UnderMaintenance':
        return {
          bg: 'bg-amber-500 hover:bg-amber-600',
          border: 'border-amber-500',
          badge: 'bg-amber-100 text-amber-900 border-amber-300',
          text: 'text-white',
          lightBg: 'bg-amber-50 text-amber-900 border-amber-200',
          label: 'दुरुस्तीत (Maintenance)'
        };
      case 'Sealed':
        return {
          bg: 'bg-slate-800 hover:bg-slate-900',
          border: 'border-slate-700',
          badge: 'bg-slate-200 text-slate-900 border-slate-400',
          text: 'text-white',
          lightBg: 'bg-slate-100 text-slate-800 border-slate-300',
          label: 'सील केलेले (Sealed)'
        };
      default:
        return {
          bg: 'bg-slate-400',
          border: 'border-slate-500',
          badge: 'bg-slate-100 text-slate-800 border-slate-300',
          text: 'text-white',
          lightBg: 'bg-slate-50 text-slate-700 border-slate-200',
          label: status
        };
    }
  };

  const labelClass = 'block text-xs font-bold text-gray-700 mb-1';
  const inputClass = 'w-full text-xs border border-gray-300 rounded-sm px-2.5 py-1.5 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150';

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
      {/* Top ERP Header Banner Matching Application Standard */}
      <div className="bg-primary px-3.5 py-2.5 text-white flex items-center justify-between shadow-xs rounded-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white/10 rounded border border-white/20">
            <Layers className="w-5 h-5 text-blue-100" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">लॉकर व कपाट इन्व्हेंटरी (Locker & Cabinet Master)</h1>
            <p className="text-[10px] text-blue-100 font-normal">
              कपाटातील लॉकर्स, चावी क्रमांक, प्रकार मॅपिंग व थेट व्हिज्युअल नकाशा (Interactive Rack Matrix)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchLockers();
              fetchCabinets();
            }}
            disabled={loading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-md border border-white/30 flex items-center gap-1 text-[11px] cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>

          <button
            onClick={() => {
              setFormData({
                lockerID: 0,
                branchID: 1,
                cabinetNo: cabinets[0] || 'C-1',
                lockerNo: '',
                keyNo: '',
                lockerTypeID: lockerTypes[0]?.lockerTypeID?.toString() || '',
                status: 'Available',
                remarks: '',
                isActive: true
              });
              setIsEditing(false);
              setIsSingleModalOpen(true);
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-2xs flex items-center gap-1 text-[11px] cursor-pointer transition border border-emerald-500"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>१ लॉकर जोडा</span>
          </button>

          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-blue-50 text-primary font-bold rounded-md shadow-2xs flex items-center gap-1 text-[11px] cursor-pointer transition border border-white/50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>एकत्रित लॉकर्स जोडा (Bulk)</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs: Visual Matrix vs Table List */}
      <div className="flex border-b border-gray-300 bg-white rounded-t-md shadow-xs overflow-hidden select-none">
        <button
          type="button"
          onClick={() => setMainTab('grid')}
          className={`flex-1 py-2.5 px-4 flex items-center justify-center gap-2 font-bold text-xs border-b-2 transition cursor-pointer ${
            mainTab === 'grid'
              ? 'border-primary text-primary bg-white shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <Grid className="w-4 h-4 text-emerald-600" />
          <span>१. व्हिज्युअल कपाट नकाशा (Interactive Visual Rack Matrix)</span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab('table')}
          className={`flex-1 py-2.5 px-4 flex items-center justify-center gap-2 font-bold text-xs border-b-2 transition cursor-pointer ${
            mainTab === 'table'
              ? 'border-primary text-primary bg-white shadow-xs'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          <List className="w-4 h-4 text-blue-600" />
          <span>२. लॉकर यादी व व्यवस्थापन (Lockers Table List)</span>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded-full text-[10px] font-bold border border-blue-200">
            {totalCount}
          </span>
        </button>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`p-2.5 rounded-md text-xs font-bold flex items-center space-x-2 shadow-xs border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-red-50 text-red-900 border-red-300'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Quick Status KPI Filter Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button 
          onClick={() => setSelectedStatus('All')}
          className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
            selectedStatus === 'All' 
              ? 'bg-primary text-white border-primary shadow-xs' 
              : 'bg-white text-gray-800 hover:bg-gray-50 border-gray-200'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">एकूण लॉकर्स</div>
          <div className="text-base font-black mt-0.5">{totalCount}</div>
        </button>

        <button 
          onClick={() => setSelectedStatus('Available')}
          className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
            selectedStatus === 'Available' 
              ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs' 
              : 'bg-emerald-50 text-emerald-950 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider">🟢 उपलब्ध (Available)</div>
          <div className="text-base font-black mt-0.5">{availableCount}</div>
        </button>

        <button 
          onClick={() => setSelectedStatus('Allotted')}
          className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
            selectedStatus === 'Allotted' 
              ? 'bg-rose-700 text-white border-rose-800 shadow-xs' 
              : 'bg-rose-50 text-rose-950 border-rose-200 hover:bg-rose-100'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider">🔴 वाटप झालेले</div>
          <div className="text-base font-black mt-0.5">{allottedCount}</div>
        </button>

        <button 
          onClick={() => setSelectedStatus('UnderMaintenance')}
          className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
            selectedStatus === 'UnderMaintenance' 
              ? 'bg-amber-600 text-white border-amber-700 shadow-xs' 
              : 'bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider">🟡 दुरुस्तीत</div>
          <div className="text-base font-black mt-0.5">{maintenanceCount}</div>
        </button>

        <button 
          onClick={() => setSelectedStatus('Sealed')}
          className={`p-2 rounded-md border text-left cursor-pointer transition-all ${
            selectedStatus === 'Sealed' 
              ? 'bg-slate-800 text-white border-slate-900 shadow-xs' 
              : 'bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider">⚫ सील केलेले</div>
          <div className="text-base font-black mt-0.5">{sealedCount}</div>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-md border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-gray-500" />
            <span className="font-bold text-gray-700">कपाट निवडा:</span>
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCabinet('All')}
              className={`px-2.5 py-1 text-xs rounded-sm font-bold border transition-colors ${
                selectedCabinet === 'All'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              सर्व कपाटे
            </button>
            {cabinets.map(cab => (
              <button
                key={cab}
                onClick={() => setSelectedCabinet(cab)}
                className={`px-2.5 py-1 text-xs rounded-sm font-bold border transition-colors ${
                  selectedCabinet === cab
                    ? 'bg-primary text-white border-primary'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                कपाट {cab}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="लॉकर क्र. / चावी क्र. / सभासद शोधा..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white text-gray-900"
          />
        </div>
      </div>

      {/* Main View 1: Visual Rack Matrix */}
      {mainTab === 'grid' && (
        <div className="space-y-4">
          {cabinets.length === 0 && (
            <div className="bg-white p-12 rounded-md border border-gray-200 text-center space-y-3">
              <Box size={40} className="mx-auto text-gray-300" />
              <p className="text-gray-500 font-bold">कोणतेही लॉकर्स तयार केलेले नाहीत.</p>
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="px-4 py-2 bg-primary text-white rounded font-bold hover:opacity-90 transition"
              >
                + नवीन लॉकर्स तयार करा
              </button>
            </div>
          )}

          {cabinets
            .filter(cab => selectedCabinet === 'All' || cab === selectedCabinet)
            .map(cab => {
              const cabLockers = filteredLockers.filter(l => l.cabinetNo === cab);
              if (cabLockers.length === 0 && searchTerm) return null;

              return (
                <div key={cab} className="bg-white rounded-md border border-gray-300 shadow-2xs overflow-hidden">
                  {/* Cabinet Header Bar */}
                  <div className="p-3 bg-gradient-to-r from-gray-100 via-gray-50 to-white border-b border-gray-300 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-primary text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                        <Box size={14} />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-gray-800 text-xs tracking-wide">कपाट क्रमांक: {cab} (Cabinet {cab})</h2>
                        <span className="text-[10px] text-gray-500">एकूण {cabLockers.length} लॉकर्स</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                        उपलब्ध: {cabLockers.filter(l => l.status === 'Available').length}
                      </span>
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded">
                        वाटप: {cabLockers.filter(l => l.status === 'Allotted').length}
                      </span>
                    </div>
                  </div>

                  {/* Visual Locker Grid Tiles */}
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 bg-gray-50/50">
                    {cabLockers.map(locker => {
                      const colorInfo = getStatusColor(locker.status);
                      return (
                        <div
                          key={locker.lockerID}
                          onClick={() => setSelectedLockerDetail(locker)}
                          className={`group relative p-2.5 rounded-lg border-2 shadow-2xs hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col justify-between h-28 bg-white ${colorInfo.border} hover:scale-[1.02]`}
                        >
                          {/* Door Handle & Keyhole Aesthetic */}
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-mono font-bold text-gray-500 bg-gray-100 px-1 rounded">
                              {locker.typeCode || 'SML'}
                            </span>
                            <div className="w-2 h-4 rounded-full bg-gray-300 border border-gray-400 group-hover:bg-amber-400 transition-colors shadow-inner"></div>
                          </div>

                          <div className="text-center my-0.5">
                            <div className="text-sm font-black text-gray-900 tracking-tight group-hover:text-primary transition-colors">
                              {locker.lockerNo}
                            </div>
                            <div className="text-[9px] text-gray-500 font-mono flex items-center justify-center gap-0.5 mt-0.5">
                              <Key size={10} className="text-amber-600" />
                              <span>{locker.keyNo}</span>
                            </div>
                          </div>

                          {/* Bottom Status Tag */}
                          <div className="w-full">
                            {locker.status === 'Allotted' && locker.currentAllotment ? (
                              <div className="text-[9px] font-bold bg-rose-50 text-rose-900 border border-rose-200 rounded px-1 py-0.5 truncate text-center" title={locker.currentAllotment.memberName}>
                                {locker.currentAllotment.memberName}
                              </div>
                            ) : (
                              <div className={`text-[9px] font-bold rounded px-1 py-0.5 text-center ${colorInfo.badge}`}>
                                {locker.status === 'Available' ? 'उपलब्ध' : locker.status}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Main View 2: Table List */}
      {mainTab === 'table' && (
        <div className="bg-white rounded-md border border-gray-300 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-800 border-b border-gray-300 font-bold">
                  <th className="py-2.5 px-3">कपाट क्र.</th>
                  <th className="py-2.5 px-3">लॉकर क्र.</th>
                  <th className="py-2.5 px-3">चावी क्र.</th>
                  <th className="py-2.5 px-3">प्रकार व परिमाणे</th>
                  <th className="py-2.5 px-3 text-right">वार्षिक भाडे</th>
                  <th className="py-2.5 px-3 text-right">अनामत रक्कम</th>
                  <th className="py-2.5 px-3 text-center">स्थिती (Status)</th>
                  <th className="py-2.5 px-3">सध्याचे वाटप / सभासद</th>
                  <th className="py-2.5 px-3 text-center">कृती (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-700">
                {filteredLockers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-400 font-bold">
                      कोणतेही लॉकर्स सापडले नाहीत.
                    </td>
                  </tr>
                ) : (
                  filteredLockers.map((l) => {
                    const statusInfo = getStatusColor(l.status);
                    return (
                      <tr key={l.lockerID} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2 px-3 font-bold text-gray-800">{l.cabinetNo}</td>
                        <td className="py-2 px-3 font-black text-primary">{l.lockerNo}</td>
                        <td className="py-2 px-3 font-mono font-bold text-amber-700">{l.keyNo}</td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-gray-800">{l.typeName}</span>
                          {l.dimensions && <span className="text-[10px] text-gray-500 ml-1">({l.dimensions})</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                          ₹{l.annualRent?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-800">
                          ₹{l.securityDeposit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.badge}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {l.currentAllotment ? (
                            <div>
                              <p className="font-bold text-gray-900">{l.currentAllotment.memberName}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{l.currentAllotment.lockerAccountNo}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => setSelectedLockerDetail(l)}
                              title="तपशील पहा"
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded cursor-pointer"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleEdit(l)}
                              title="दुरुस्त करा"
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(l.lockerID)}
                              title="डिलीट करा"
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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

      {/* Locker Detail Popup Modal */}
      {selectedLockerDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 bg-primary text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Box size={18} className="text-blue-200" />
                <div>
                  <h3 className="text-sm font-bold">लॉकर तपशील: {selectedLockerDetail.lockerNo}</h3>
                  <p className="text-[10px] text-blue-100">कपाट: {selectedLockerDetail.cabinetNo} | चावी क्र.: {selectedLockerDetail.keyNo}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedLockerDetail(null)}
                className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-gray-700">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded border border-gray-200">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">प्रकार</span>
                  <p className="font-bold text-gray-800">{selectedLockerDetail.typeName} ({selectedLockerDetail.typeCode})</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">वार्षिक भाडे</span>
                  <p className="font-bold text-emerald-700">₹{selectedLockerDetail.annualRent?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">अनामत रक्कम</span>
                  <p className="font-bold text-blue-700">₹{selectedLockerDetail.securityDeposit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">सध्याची स्थिती</span>
                  <p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(selectedLockerDetail.status).badge}`}>
                      {getStatusColor(selectedLockerDetail.status).label}
                    </span>
                  </p>
                </div>
              </div>

              {/* Occupant Info if Allotted */}
              {selectedLockerDetail.currentAllotment ? (
                <div className="bg-rose-50 p-3 rounded border border-rose-200 space-y-1.5">
                  <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1">
                    <UserCheck size={14} className="text-rose-700" /> वाटप तपशील (Allotment Details)
                  </h4>
                  <p><strong className="text-gray-600">खाते क्र.:</strong> {selectedLockerDetail.currentAllotment.lockerAccountNo}</p>
                  <p><strong className="text-gray-600">सभासद:</strong> {selectedLockerDetail.currentAllotment.memberName}</p>
                  <p><strong className="text-gray-600">वाटप दिनांक:</strong> {new Date(selectedLockerDetail.currentAllotment.allotmentDate).toLocaleDateString('en-GB')}</p>
                  <p><strong className="text-gray-600">नूतनीकरण दिनांक:</strong> {new Date(selectedLockerDetail.currentAllotment.expiryDate).toLocaleDateString('en-GB')}</p>
                </div>
              ) : (
                selectedLockerDetail.status === 'Available' && (
                  <div className="bg-emerald-50 p-3 rounded border border-emerald-200 text-center space-y-2">
                    <p className="text-emerald-900 font-semibold">हा लॉकर नवीन सभासदास वाटप करण्यासाठी उपलब्ध आहे.</p>
                    {onNavigateToAllotment && (
                      <button
                        onClick={() => {
                          const id = selectedLockerDetail.lockerID;
                          setSelectedLockerDetail(null);
                          onNavigateToAllotment(id);
                        }}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <UserCheck size={15} /> नवीन सभासदास वाटप करा
                      </button>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => {
                  handleEdit(selectedLockerDetail);
                  setSelectedLockerDetail(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
              >
                दुरुस्त करा
              </button>
              <button
                onClick={() => setSelectedLockerDetail(null)}
                className="px-4 py-1.5 text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded cursor-pointer"
              >
                बंद करा
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Add/Edit Modal */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-lg w-full overflow-hidden">
            <div className="p-3.5 bg-primary text-white flex justify-between items-center">
              <h3 className="text-sm font-bold">{isEditing ? 'लॉकर दुरुस्त करा (Edit Locker)' : 'नवीन लॉकर नोंदणी करा (Add Single Locker)'}</h3>
              <button onClick={() => setIsSingleModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSingleSubmit} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>कपाट क्रमांक (Cabinet No.) *</label>
                  <input
                    type="text"
                    required
                    placeholder="उदा. C-1, C-2"
                    value={formData.cabinetNo}
                    onChange={(e) => setFormData({ ...formData, cabinetNo: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>लॉकर क्रमांक (Locker No.) *</label>
                  <input
                    ref={lockerNoInputRef}
                    type="text"
                    required
                    placeholder="उदा. L-101"
                    value={formData.lockerNo}
                    onChange={(e) => setFormData({ ...formData, lockerNo: e.target.value })}
                    className={`${inputClass} ${isEditing ? 'border-primary bg-amber-50/40 font-semibold' : ''}`}
                  />
                </div>

                <div>
                  <label className={labelClass}>चावी क्रमांक (Key No.) *</label>
                  <input
                    type="text"
                    required
                    placeholder="उदा. K-101"
                    value={formData.keyNo}
                    onChange={(e) => setFormData({ ...formData, keyNo: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>लॉकर प्रकार (Locker Type) *</label>
                  <select
                    value={formData.lockerTypeID}
                    onChange={(e) => setFormData({ ...formData, lockerTypeID: e.target.value })}
                    className={inputClass}
                  >
                    {lockerTypes.map(t => (
                      <option key={t.lockerTypeID} value={t.lockerTypeID}>
                        {t.typeName} (भाडे ₹{t.annualRent} | अनामत ₹{t.securityDeposit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>स्थिती (Status)</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className={inputClass}
                  >
                    <option value="Available">उपलब्ध (Available)</option>
                    <option value="Allotted">वाटप झालेले (Allotted)</option>
                    <option value="UnderMaintenance">दुरुस्तीत (Under Maintenance)</option>
                    <option value="Sealed">सील केलेले (Sealed)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>सक्रिय आहे का?</label>
                  <div className="flex items-center space-x-2 mt-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="isActive" className="text-xs font-semibold text-gray-700 cursor-pointer">सक्रिय (Active)</label>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>शेरा (Remarks)</label>
                <input
                  type="text"
                  placeholder="काही विशेष टीप असल्यास..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 text-xs font-bold text-white bg-primary hover:opacity-90 rounded shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  <span>{isEditing ? 'बदल जतन करा' : 'लॉकर जोडा'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Lockers Generation Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-xl w-full overflow-hidden">
            <div className="p-3.5 bg-primary text-white flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Sparkles size={18} className="text-amber-300" />
                <h3 className="text-sm font-bold">एकत्रित सलग लॉकर्स जोडा (Bulk Locker Generator)</h3>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="p-4 space-y-3.5 text-xs">
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-950 rounded text-xs leading-relaxed">
                💡 <strong>सूचना:</strong> या सुविधेमुळे तुम्ही एका कपाटातील सलग क्रमांकाचे लॉकर्स (उदा. L-101 ते L-150) आणि त्यांच्या चाव्या आपोआप तयार करू शकता.
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>कपाट क्रमांक *</label>
                  <input
                    type="text"
                    required
                    placeholder="उदा. C-1"
                    value={bulkData.cabinetNo}
                    onChange={(e) => setBulkData({ ...bulkData, cabinetNo: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>सुरवातीचा नंबर *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={bulkData.startNo}
                    onChange={(e) => setBulkData({ ...bulkData, startNo: parseInt(e.target.value) || 1 })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>शेवटचा नंबर *</label>
                  <input
                    type="number"
                    min={bulkData.startNo}
                    required
                    value={bulkData.endNo}
                    onChange={(e) => setBulkData({ ...bulkData, endNo: parseInt(e.target.value) || 1 })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>लॉकर Prefix (पर्यायी)</label>
                  <input
                    type="text"
                    placeholder="उदा. L-"
                    value={bulkData.prefix}
                    onChange={(e) => setBulkData({ ...bulkData, prefix: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>चावी Prefix (Key Prefix)</label>
                  <input
                    type="text"
                    placeholder="उदा. K-L-"
                    value={bulkData.keyPrefix}
                    onChange={(e) => setBulkData({ ...bulkData, keyPrefix: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>लॉकर प्रकार निवडा *</label>
                  <select
                    value={bulkData.lockerTypeID}
                    onChange={(e) => setBulkData({ ...bulkData, lockerTypeID: e.target.value })}
                    className={inputClass}
                  >
                    {lockerTypes.map(t => (
                      <option key={t.lockerTypeID} value={t.lockerTypeID}>
                        {t.typeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview Box */}
              <div className="p-3 bg-gray-100 rounded border border-gray-300 font-mono text-xs">
                <span className="text-gray-500 font-sans block text-[11px] font-bold mb-1">तयार होणाऱ्या लॉकर्सचे स्वरूप (Preview):</span>
                <span className="text-primary font-bold">
                  {bulkData.prefix}{bulkData.startNo} {bulkData.suffix} ते {bulkData.prefix}{bulkData.endNo} {bulkData.suffix}
                </span>
                <span className="text-gray-600 font-sans text-[11px] ml-2">
                  (एकूण <strong>{Math.max(0, bulkData.endNo - bulkData.startNo + 1)}</strong> लॉकर्स तयार होतील)
                </span>
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 text-xs font-bold text-white bg-primary hover:opacity-90 rounded shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles size={14} className="text-amber-300" />
                  <span>एकत्रित तयार करा</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LockerMaster;

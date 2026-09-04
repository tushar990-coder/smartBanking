import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  BookOpen,
  Layers,
  CheckCircle,
  XCircle,
  RotateCcw,
  Save,
  Edit2,
  Trash2,
  Search,
  FileSpreadsheet,
  X,
  Plus,
  IndianRupee,
  Percent,
  Calendar,
  Building,
  Scale
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AccountGroup {
  groupID: number;
  groupName: string;
}

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  groupID: number;
  accountGroup?: AccountGroup;
  openingBalance: number;
  openingBalanceType: string;
  accountType?: string;
  reportType?: string;
  isActive: boolean;
}

interface LedgerOpeningBalanceProps {
  defaultFilter?: string;
}

export default function LedgerOpeningBalance({ defaultFilter = 'All' }: LedgerOpeningBalanceProps) {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState(defaultFilter);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  const [editFormData, setEditFormData] = useState({
    openingBalance: 0,
    openingBalanceType: 'Dr'
  });

  const fetchLedgers = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await axios.get('/api/Ledgers');
      setLedgers(response.data || []);
    } catch (error) {
      console.error("Error fetching ledgers", error);
      setErrorMsg('खाती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgers();
  }, []);

  useEffect(() => {
    setFilterType(defaultFilter);
  }, [defaultFilter]);

  const handleEditClick = (ledger: Ledger) => {
    setEditingId(ledger.ledgerID);
    setEditFormData({
      openingBalance: ledger.openingBalance || 0,
      openingBalanceType: ledger.openingBalanceType || 'Dr'
    });

    setTimeout(() => {
      if (amountInputRef.current) {
        amountInputRef.current.focus();
        amountInputRef.current.select();
      }
    }, 120);
  };

  const handleSaveClick = async (ledger: Ledger) => {
    try {
      const updatedLedger = {
        ...ledger,
        openingBalance: parseFloat(editFormData.openingBalance.toString()) || 0,
        openingBalanceType: editFormData.openingBalanceType
      };

      const { accountGroup, ...payload } = updatedLedger;

      await axios.put(`/api/Ledgers/${ledger.ledgerID}`, payload);
      setSuccessMsg(`खाते '${ledger.ledgerName}' ची सुरुवातीची शिल्लक यशस्वीरीत्या अद्ययावत केली!`);
      setEditingId(null);
      fetchLedgers();
    } catch (error) {
      console.error("Error updating ledger opening balance", error);
      setErrorMsg('सुरुवातीची शिल्लक अद्ययावत करताना त्रुटी आली.');
    }
  };

  const handleExportExcel = () => {
    if (filteredLedgers.length === 0) return alert('एक्सपोर्ट करण्यासाठी डेटा उपलब्ध नाही.');
    const rows = filteredLedgers.map((l, i) => ({
      'अ.क्र.': i + 1,
      'खाते ID': l.ledgerID,
      'खात्याचे नाव': l.ledgerName,
      'गट (Group)': l.accountGroup?.groupName || '-',
      'प्रकार (Type)': l.accountType || l.reportType || '-',
      'सुरुवातीची शिल्लक (₹)': l.openingBalance || 0,
      'Dr / Cr': l.openingBalanceType || 'Dr',
      'स्थिती': l.isActive ? 'सक्रिय' : 'बंद'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LedgerOpeningBalances');
    XLSX.writeFile(wb, `Ledger_Opening_Balances_${filterType}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const filteredLedgers = ledgers.filter(ledger => {
    if (searchTerm && !ledger.ledgerName.toLowerCase().includes(searchTerm.toLowerCase()) && !String(ledger.ledgerID).includes(searchTerm)) {
      return false;
    }
    
    if (filterType === 'Cash') {
      return ledger.accountType === 'Cash Account' || ledger.ledgerName.toLowerCase().includes('cash') || ledger.ledgerName === 'रोख';
    } else if (filterType === 'Bank') {
      return ledger.accountType === 'Bank Account' || ledger.ledgerName.toLowerCase().includes('bank') || ledger.ledgerName === 'बँक';
    } else if (filterType === 'Deadstock') {
      return ledger.accountType === 'Deadstock Account' || ledger.reportType?.includes('Deadstock') || ledger.ledgerName.toLowerCase().includes('deadstock') || ledger.ledgerName.includes('डेडस्टॉक');
    }
    return true;
  });

  // KPI Calculations
  const totalDr = filteredLedgers.filter(l => l.openingBalanceType === 'Dr').reduce((sum, l) => sum + (l.openingBalance || 0), 0);
  const totalCr = filteredLedgers.filter(l => l.openingBalanceType === 'Cr').reduce((sum, l) => sum + (l.openingBalance || 0), 0);
  const netDifference = Math.abs(totalDr - totalCr);

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <BookOpen size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>खाते सुरुवातीची शिल्लक</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Ledger Opening Balances)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              सर्व खात्यांची (रोख, बँक, डेडस्टॉक व इतर जनरल लेजर्स) १ एप्रिल सुरुवातीची शिल्लक (Dr/Cr) व्यवस्थापन
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLedgers}
            disabled={loading}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="रिफ्रेश करा"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>रिफ्रेश</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredLedgers.length === 0}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="एक्सेल फाइल डाउनलोड करा"
          >
            <FileSpreadsheet size={13} />
            <span>एक्सेल एक्सपोर्ट</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण खाती</div>
            <div className="text-sm font-black text-gray-900">{filteredLedgers.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-700 border border-blue-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण Dr शिल्लक (नावे)</div>
            <div className="text-sm font-black text-blue-900">₹{totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <IndianRupee className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण Cr शिल्लक (जमा)</div>
            <div className="text-sm font-black text-emerald-800">₹{totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">शिल्लक फरक (Net Diff)</div>
            <div className="text-sm font-black text-amber-900">₹{netDifference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {errorMsg && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {successMsg && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white p-3 sm:p-4 rounded-sm shadow-xs border border-gray-200 space-y-3">
        
        {/* Filter Toolbar */}
        <div className="flex flex-wrap justify-between items-center gap-2 pb-2 border-b border-gray-200">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
            <input 
              type="text" 
              placeholder="खाते क्र किंवा नाव शोधा..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-64 lg:w-80 focus:outline-none focus:border-primary bg-white shadow-2xs"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700">वर्गवारी:</span>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 px-2 py-1 rounded-sm text-xs font-bold focus:outline-none focus:border-primary bg-white h-[30px] shadow-2xs cursor-pointer"
            >
              <option value="All">सर्व खाती (All)</option>
              <option value="Cash">रोख खाती (Cash)</option>
              <option value="Bank">बँक खाती (Bank)</option>
              <option value="Deadstock">डेडस्टॉक खाती (Deadstock)</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-sm">
          <table className="min-w-full divide-y divide-gray-200 text-xs text-left border-collapse">
            <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
              <tr>
                <th className="px-2 py-1.5 border-r border-gray-200 text-center w-14">ID</th>
                <th className="px-2 py-1.5 border-r border-gray-200 text-left">खात्याचे नाव (Ledger Name)</th>
                <th className="px-2 py-1.5 border-r border-gray-200 text-left">गट (Account Group)</th>
                <th className="px-2 py-1.5 border-r border-gray-200 text-left">प्रकार (Type)</th>
                <th className="px-2 py-1.5 border-r border-gray-200 text-right w-64">सुरुवातीची शिल्लक (Opening Balance ₹)</th>
                <th className="px-2 py-1.5 text-center w-28">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 font-bold">माहिती लोड होत आहे...</td></tr>
              ) : filteredLedgers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-bold">कोणतेही खाते सापडले नाही.</td></tr>
              ) : (
                filteredLedgers.map(ledger => (
                  <tr key={ledger.ledgerID} className={`transition-colors ${editingId === ledger.ledgerID ? 'bg-amber-50/60 ring-1 ring-primary/30' : 'hover:bg-primary/5'}`}>
                    <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono font-bold text-gray-600">{ledger.ledgerID}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 font-bold text-gray-900">{ledger.ledgerName}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 text-gray-700 font-medium">{ledger.accountGroup?.groupName || '-'}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 text-gray-600">{ledger.accountType || ledger.reportType || '-'}</td>
                    <td className="px-2 py-1.5 border-r border-gray-200 text-right">
                      {editingId === ledger.ledgerID ? (
                        <div className="flex items-center gap-1 justify-end">
                          <input 
                            ref={amountInputRef}
                            type="number" 
                            step="0.01" 
                            value={editFormData.openingBalance} 
                            onChange={(e) => setEditFormData({...editFormData, openingBalance: parseFloat(e.target.value) || 0})}
                            className="w-36 border border-primary bg-amber-50/80 font-bold font-mono px-2 py-0.5 rounded-sm focus:outline-none focus:ring-1 focus:ring-primary text-xs h-[26px]"
                          />
                          <select 
                            value={editFormData.openingBalanceType} 
                            onChange={(e) => setEditFormData({...editFormData, openingBalanceType: e.target.value})}
                            className="border border-gray-300 px-1 py-0.5 rounded-sm bg-white focus:outline-none focus:border-primary font-bold text-xs h-[26px] cursor-pointer"
                          >
                            <option value="Dr">Dr (नावे)</option>
                            <option value="Cr">Cr (जमा)</option>
                          </select>
                        </div>
                      ) : (
                        <span className={`font-mono font-bold ${ledger.openingBalanceType === 'Dr' ? 'text-blue-700' : 'text-emerald-700'}`}>
                          ₹{ledger.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 border border-slate-300">{ledger.openingBalanceType}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      {editingId === ledger.ledgerID ? (
                        <div className="flex justify-center items-center gap-1">
                          <button 
                            type="button" 
                            onClick={() => handleSaveClick(ledger)} 
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-0.5 cursor-pointer shadow-2xs"
                          >
                            <Save className="w-3 h-3" />
                            <span>जतन</span>
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setEditingId(null)} 
                            className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-bold cursor-pointer"
                          >
                            रद्द
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button" 
                          onClick={() => handleEditClick(ledger)} 
                          className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>बदला</span>
                        </button>
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
  );
}

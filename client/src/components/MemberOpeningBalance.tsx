import React, { useState, useEffect } from 'react';
import { Wallet, Search, PlusCircle, Save, Trash2, RefreshCw, BookOpen, Layers, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react';
import MemberSearchSelect, { MemberOption } from './common/MemberSearchSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  accountType: string;
}

interface Member extends MemberOption {}

interface MemberOpeningBalance {
  memberOpeningBalanceID: number;
  memberID: number;
  ledgerID: number;
  amount: number;
  balanceType: string;
  member?: Member;
  ledger?: Ledger;
}

export default function MemberOpeningBalanceForm() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [balances, setBalances] = useState<MemberOpeningBalance[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [formData, setFormData] = useState({
    ledgerID: '',
    cifNo: '',
    memberName: '',
    amount: '',
    balanceType: 'Dr'
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom dropdown states
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [memberSearchText, setMemberSearchText] = useState('');
  
  useEffect(() => {
    fetchLedgers();
    fetchMembers();
    fetchBalances();
  }, []);

  const fetchLedgers = async () => {
    try {
      const response = await fetch('/api/Ledgers');
      if (response.ok) {
        const data = await response.json();
        // Filter ledgers where AccountType === 'Personal Account' or 'Share Capital'
        const personalLedgers = data.filter((l: Ledger) => l.accountType === 'Personal Account' || l.accountType === 'Share Capital');
        setLedgers(personalLedgers);
      }
    } catch (error) {
      console.error("Error fetching ledgers", error);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/Members');
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Error fetching members", error);
    }
  };

  const fetchBalances = async () => {
    try {
      const response = await fetch('/api/MemberOpeningBalances');
      if (response.ok) {
        const data = await response.json();
        setBalances(data);
      }
    } catch (error) {
      console.error("Error fetching balances", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('तुम्हाला खात्री आहे का की तुम्हाला ही नोंद डिलीट करायची आहे?')) {
      return;
    }

    try {
      const response = await fetch(`/api/MemberOpeningBalances/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchBalances();
        alert("माहिती यशस्वीरित्या डिलीट केली.");
      } else {
        alert("माहिती डिलीट करताना त्रुटी आली.");
      }
    } catch (error) {
      console.error("Error deleting balance", error);
      alert("नेटवर्क त्रुटी.");
    }
  };

  const selectMember = (member: Member) => {
    setFormData({
      ...formData,
      cifNo: member.memberID.toString(),
      memberName: `${member.firstName} ${member.middleName || ''} ${member.lastName}`
    });
    setMemberSearchText(`${member.cifNo ? member.cifNo + ' - ' : ''}${member.firstName} ${member.lastName}`);
    setShowMemberDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const member = members.find(m => m.memberID.toString() === formData.cifNo);
    if (!member) {
      alert("कृपया ड्रॉपडाऊनमधून वैध सभासद निवडा.");
      return;
    }
    
    if (!formData.ledgerID) {
      alert("कृपया लेजर निवडा.");
      return;
    }

    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("कृपया वैध बाकी रक्कम टाका.");
      return;
    }

    setIsSubmitting(true);
    const payload = {
      memberID: member.memberID,
      ledgerID: parseInt(formData.ledgerID),
      amount: numAmount,
      balanceType: formData.balanceType
    };

    try {
      const response = await fetch('/api/MemberOpeningBalances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        fetchBalances();
        handleNew();
        alert("सभासद बाकी यशस्वीरित्या जतन झाली!");
      } else {
        const errText = await response.text();
        alert("जतन करण्यात त्रुटी: " + errText);
      }
    } catch (error) {
      console.error("Error saving balance", error);
      alert("नेटवर्क त्रुटी: सर्व्हरशी संपर्क साधता आला नाही.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/MemberOpeningBalances/SyncAllLedgers');
      if (response.ok) {
        alert("सर्व लेजर बाकी यशस्वीरित्या सिंक झाले!");
        fetchBalances();
      } else {
        alert("सिंक करताना त्रुटी आली.");
      }
    } catch (error) {
      console.error("Error syncing ledgers", error);
      alert("नेटवर्क त्रुटी.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleNew = () => {
    setFormData({
      ledgerID: '',
      cifNo: '',
      memberName: '',
      amount: '',
      balanceType: 'Dr'
    });
    setMemberSearchText('');
  };

  const filteredBalances = balances.filter(b => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const memberName = b.member ? `${b.member.firstName} ${b.member.middleName || ''} ${b.member.lastName}`.toLowerCase() : '';
    const cifNo = b.member?.cifNo?.toLowerCase() || '';
    const code = b.member?.memberCode?.toLowerCase() || '';
    const ledgerName = b.ledger?.ledgerName?.toLowerCase() || '';
    
    return memberName.includes(q) || cifNo.includes(q) || code.includes(q) || ledgerName.includes(q);
  });

  const filteredDropdownMembers = members.filter(m => {
    const q = memberSearchText.trim().toLowerCase();
    if (!q) return true;
    const name = `${m.firstName} ${m.middleName || ''} ${m.lastName}`.toLowerCase();
    const cif = (m.cifNo || '').toLowerCase();
    const code = (m.memberCode || '').toLowerCase();
    const mobile = (m.mobileNo || '').toLowerCase();
    return name.includes(q) || cif.includes(q) || code.includes(q) || mobile.includes(q);
  });

  const totalDrAmount = filteredBalances.filter(b => b.balanceType === 'Dr').reduce((sum, b) => sum + b.amount, 0);
  const totalCrAmount = filteredBalances.filter(b => b.balanceType === 'Cr').reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="p-3 max-w-6xl mx-auto bg-gray-50 min-h-screen font-sans pb-8">
      
      {/* Top Header Card */}
      <div className="mb-4 flex flex-wrap justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800 leading-tight">सभासद बाकी (Member Opening Balance)</h1>
            <p className="text-[11px] text-gray-500">सभासदांची प्रारंभीची नावे (Dr) / जमा (Cr) बाकी नोंदवा व लेजर सिंक करा</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-semibold text-xs border border-slate-300 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="सर्व लेजर शिल्लक पुनर्गणित (Sync) करा"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'सिंक होत आहे...' : 'लेजर सिंक करा'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">एकूण नोंदी</span>
            <span className="text-lg font-black text-slate-800">{filteredBalances.length}</span>
          </div>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">एकूण येणे बाकी (Total Dr)</span>
            <span className="text-lg font-black text-emerald-700">₹ {totalDrAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-md">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">एकूण देणे बाकी (Total Cr)</span>
            <span className="text-lg font-black text-amber-700">₹ {totalCrAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="p-2 bg-amber-50 text-amber-600 rounded-md">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Entry Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
        <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold tracking-wide">१. नवीन सभासद बाकी नोंदवणी फॉर्म (Opening Balance Entry)</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            
            {/* Ledger Select */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">लेजर (Ledger) *</label>
              <select 
                className="w-full border border-gray-300 px-2.5 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-xs bg-white font-medium"
                value={formData.ledgerID}
                onChange={(e) => setFormData({...formData, ledgerID: e.target.value})}
                required
              >
                <option value="">-- लेजर निवडा --</option>
                {ledgers.map(l => (
                  <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName} ({l.accountType})</option>
                ))}
              </select>
            </div>

            {/* Member Search Select */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">सभासद (Member / CIF) *</label>
              <MemberSearchSelect
                members={members}
                value={formData.cifNo ? Number(formData.cifNo) : ''}
                onChange={(val) => {
                  const selected = members.find(m => m.memberID === val);
                  if (selected) {
                    selectMember(selected);
                  } else {
                    setFormData(prev => ({ ...prev, cifNo: '', memberName: '' }));
                    setMemberSearchText('');
                  }
                }}
                placeholder="-- सभासद नाव, कोड किंवा मोबाईलने शोधा --"
              />
            </div>

            {/* Amount & Type */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">बाकी रक्कम (Amount & Type) *</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  className="w-full border border-gray-300 px-2.5 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-xs bg-white font-bold text-right text-gray-800"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
                <select
                  className="w-24 border border-gray-300 px-2 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-xs bg-white font-extrabold"
                  value={formData.balanceType}
                  onChange={(e) => setFormData({...formData, balanceType: e.target.value})}
                >
                  <option value="Dr">Dr (येणे)</option>
                  <option value="Cr">Cr (देणे)</option>
                </select>
              </div>
            </div>

          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button 
              type="button" 
              onClick={handleNew} 
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-1.5 rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>रद्द / नवीन (Reset)</span>
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-gradient-to-r from-primary to-[#004a75] hover:from-[#004a75] hover:to-[#003452] text-white px-6 py-1.5 rounded-md font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'सेव्ह होत आहे...' : 'माहिती सेव्ह करा (Save)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Table List Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar & Search */}
        <div className="p-3 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              className="w-full border border-gray-300 pl-9 pr-3 py-1.5 rounded-md bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs shadow-xs"
              placeholder="नाव, लेजर किंवा CIF ने शोधा..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="text-xs text-gray-500 font-medium self-end sm:self-center">
            दाखवत आहे: <strong className="text-primary font-bold">{filteredBalances.length}</strong> नोंदी
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[220px]">
          <table className="w-full border-collapse text-xs text-center">
            <thead className="bg-slate-100 text-slate-700 border-b border-gray-300 font-bold">
              <tr>
                <th className="px-2.5 py-2 border-r border-gray-200 w-10">अ.क्र.</th>
                <th className="px-2.5 py-2 border-r border-gray-200 text-left">लेजर नाव (Ledger)</th>
                <th className="px-2.5 py-2 border-r border-gray-200 text-left">CIF / कोड</th>
                <th className="px-2.5 py-2 border-r border-gray-200 text-left">सभासदाचे नाव (Member Name)</th>
                <th className="px-2.5 py-2 border-r border-gray-200 text-right">येणे/देणे बाकी (Amount)</th>
                <th className="px-2.5 py-2 text-center w-20">कृती</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredBalances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <AlertCircle className="w-7 h-7 text-gray-300" />
                      <p className="font-semibold text-gray-600">कोणतीही सभासद बाकी नोंद आढळली नाही.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBalances.map((b, idx) => (
                  <tr key={b.memberOpeningBalanceID} className="hover:bg-blue-50/60 transition-colors">
                    <td className="px-2.5 py-1.5 border-r border-gray-100 text-gray-500 font-medium">{idx + 1}</td>
                    <td className="px-2.5 py-1.5 border-r border-gray-100 text-left font-bold text-gray-800">
                      {b.ledger?.ledgerName || '-'}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-100 text-left font-semibold text-primary font-mono">
                      {b.member?.cifNo || b.member?.memberCode || '-'}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-100 text-left font-bold text-gray-800">
                      {b.member ? `${b.member.firstName} ${b.member.middleName ? b.member.middleName + ' ' : ''}${b.member.lastName}` : '-'}
                    </td>
                    <td className="px-2.5 py-1.5 border-r border-gray-100 text-right font-extrabold whitespace-nowrap">
                      <span>₹ {b.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${b.balanceType === 'Dr' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                        {b.balanceType === 'Dr' ? 'Dr (येणे)' : 'Cr (देणे)'}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <button 
                        type="button"
                        onClick={() => handleDelete(b.memberOpeningBalanceID)}
                        className="p-1 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors cursor-pointer"
                        title="डिलीट करा"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="bg-slate-100 border-t border-gray-300 px-4 py-2 flex flex-wrap justify-between items-center text-xs font-bold text-slate-700">
          <div>एकूण नोंदी: {filteredBalances.length}</div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-700">एकूण Dr (येणे): ₹ {totalDrAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className="text-amber-700">एकूण Cr (देणे): ₹ {totalCrAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      
    </div>
  );
}

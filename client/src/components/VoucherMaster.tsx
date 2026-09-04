import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Receipt, RefreshCw, CheckCircle2, AlertCircle, Plus, RotateCcw, 
  CheckSquare, FileText, ArrowDownLeft, ArrowUpRight, Calendar, 
  Search, Printer, Edit2, Trash2, Layers, BookOpen, Building2, 
  CreditCard, UserCheck, X
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import VoucherPrint from './VoucherPrint';
import MemberSearchSelect from './common/MemberSearchSelect';
import { useAuth } from '../context/AuthContext';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  ledgerNameEnglish?: string;
  accountType?: string;
  legacyLedgerId?: string;
  accountGroup?: {
    groupName?: string;
  };
}

interface Member {
  memberID: number;
  memberCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  mobileNo?: string;
  aadhaarNo?: string;
  cifNo?: string;
}

interface VoucherDetail {
  ledgerID: number;
  drCr: 'Dr' | 'Cr';
  amount: number;
  searchQuery?: string;
  ledgerBalance?: number;
  ledgerBalanceType?: string;
  ledgerPath?: string;
  isLocked?: boolean;
  memberID?: number | '';
  accountType?: string;
}

interface Voucher {
  voucherID: number;
  voucherNo: string;
  scrollNo?: number;
  voucherDate: string;
  voucherType: string;
  narration: string;
  totalAmount: number;
  voucherDetails: {
    voucherDetailID: number;
    ledgerID: number;
    ledger?: Ledger;
    drCr: string;
    amount: number;
    memberID?: number;
  }[];
}

export default function VoucherMaster() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string) : 1;
  const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId);
  const [expandedVoucherId, setExpandedVoucherId] = useState<number | null>(null);
  const [printingVoucherId, setPrintingVoucherId] = useState<number | null>(null);
  
  // List Modal & Search States
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [listTypeFilter, setListTypeFilter] = useState('All');
  
  const { user } = useAuth();
  
  useEffect(() => {
    if (user?.branchID) {
      setSelectedBranchId(user.branchID);
    }
  }, [user?.branchID]);
  
  // Form State
  const ledgerOptions = useMemo(() => {
    return ledgers.map(l => {
      const legacyPart = l.legacyLedgerId ? ` [जुना क्र: ${l.legacyLedgerId}]` : '';
      const engPart = l.ledgerNameEnglish ? ` (${l.ledgerNameEnglish})` : '';
      const groupPart = l.accountGroup?.groupName ? ` - ${l.accountGroup.groupName}` : '';
      return {
        value: l.ledgerID.toString(),
        label: `${l.ledgerID} - ${l.ledgerName}${engPart}${legacyPart}${groupPart}`
      };
    });
  }, [ledgers]);

  const [editingVoucherId, setEditingVoucherId] = useState<number | null>(null);
  const [voucherNo, setVoucherNo] = useState('AUTO');
  const [voucherDate, setVoucherDate] = useState(user?.businessDate || new Date().toISOString().split('T')[0]);
  const [voucherType, setVoucherType] = useState('Receipt');
  const [narration, setNarration] = useState('');
  const [details, setDetails] = useState<VoucherDetail[]>([]);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const narrationInputRef = useRef<HTMLTextAreaElement>(null);

  const API_URL = '/api/Vouchers';
  const LEDGER_API = '/api/Ledgers';
  const MEMBER_API = '/api/Members';
  const BRANCH_API = '/api/Branches';

  useEffect(() => {
    fetchLedgers().then(() => {
      fetchNextVoucherNo('Receipt', selectedBranchId);
    });
    fetchMembers();
    fetchVouchers();
    fetchBranches();
    fetchBranchBusinessDate(selectedBranchId);
  }, []);

  const fetchBranchBusinessDate = async (bId: number) => {
    try {
      const res = await fetch(`/api/EodOperations/status/${bId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.businessDate) {
          setVoucherDate(data.businessDate.split('T')[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching business date:', e);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch(BRANCH_API);
      if (response.ok) {
        setBranches(await response.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getCashLedger = (
    ledgersList: Ledger[] = ledgers,
    branchId: number = selectedBranchId,
    branchesList: any[] = branches
  ): number => {
    if (!ledgersList || ledgersList.length === 0) return 0;

    const currentBranch = branchesList.find(b => b.branchID === branchId);

    // 1. Check if the branch has a mapped defaultCashLedgerID
    if (currentBranch?.defaultCashLedgerID) {
      const mappedLedger = ledgersList.find(l => l.ledgerID === currentBranch.defaultCashLedgerID);
      if (mappedLedger) return mappedLedger.ledgerID;
    }

    // 2. If branch is Head Office / मुख्य शाखा, prioritize main cash ledger
    const isHeadOffice = currentBranch?.branchType === 'HeadOffice' || branchId === 1 || (currentBranch?.branchName && currentBranch.branchName.includes('मुख्य'));
    if (isHeadOffice) {
      const mainCash = ledgersList.find(l => 
        (l.ledgerName.includes('हातातील रोख शिल्लक') || l.ledgerName.includes('हातावरील रोख शिल्लक (मुख्य') || l.ledgerName === 'हातावरील रोख शिल्लक' || l.ledgerName === 'रोख खाते' || l.ledgerName.toLowerCase() === 'cash') &&
        !l.ledgerName.includes('शाखा')
      );
      if (mainCash) return mainCash.ledgerID;
    }

    // 3. Match branch name inside ledger name (e.g. 'हातावरील रोख शिल्लक (ढंबावडे शाखा)')
    if (currentBranch?.branchName) {
      const cleanBranchName = currentBranch.branchName.replace(/शाखा/g, '').trim();
      if (cleanBranchName) {
        const branchCash = ledgersList.find(l => 
          (l.ledgerName.includes('रोख') || l.ledgerName.toLowerCase().includes('cash')) && 
          l.ledgerName.includes(cleanBranchName)
        );
        if (branchCash) return branchCash.ledgerID;
      }
    }

    // 4. Fallback: First ledger containing रोख / Cash
    const fallbackCash = ledgersList.find(l => 
      l.ledgerName.includes('हातातील रोख शिल्लक') || 
      l.ledgerName.includes('हातावरील रोख शिल्लक') || 
      l.ledgerName.toLowerCase().includes('cash') ||
      l.ledgerName.includes('रोख')
    );
    return fallbackCash?.ledgerID || (ledgersList[0]?.ledgerID || 0);
  };

  const fetchNextVoucherNo = async (type: string, branchId: number = selectedBranchId) => {
    try {
      const res = await fetch(`${API_URL}/next-number?type=${type}&branchId=${branchId}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setVoucherNo(typeof data === 'string' ? data : (data.nextNumber || data.voucherNo || text));
        } catch {
          setVoucherNo(text.trim() || 'AUTO');
        }
      }
    } catch (e) {
      console.error('Failed to get next voucher number', e);
      setVoucherNo('AUTO');
    }
  };

  const fetchLedgers = async () => {
    try {
      const response = await fetch(LEDGER_API);
      if (response.ok) {
        const data = await response.json();
        setLedgers(data);
        return data;
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(MEMBER_API);
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVouchers = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setVouchers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBranchId = parseInt(e.target.value);
    setSelectedBranchId(newBranchId);
    fetchBranchBusinessDate(newBranchId);
    fetchNextVoucherNo(voucherType, newBranchId);

    if (voucherType === 'Receipt' || voucherType === 'Payment') {
      const cashLId = getCashLedger(ledgers, newBranchId, branches);
      setDetails(prev => {
        return prev.map(d => {
          if (d.isLocked) {
            return { ...d, ledgerID: cashLId };
          }
          return d;
        });
      });
    }
  };

  const handleVoucherTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setVoucherType(newType);
    fetchNextVoucherNo(newType, selectedBranchId);

    const cashLId = getCashLedger(ledgers, selectedBranchId, branches);

    if (newType === 'Receipt') {
      setDetails([
        { ledgerID: cashLId, drCr: 'Dr', amount: 0, isLocked: true, searchQuery: '' },
        { ledgerID: 0, drCr: 'Cr', amount: 0, searchQuery: '' }
      ]);
    } else if (newType === 'Payment') {
      setDetails([
        { ledgerID: 0, drCr: 'Dr', amount: 0, searchQuery: '' },
        { ledgerID: cashLId, drCr: 'Cr', amount: 0, isLocked: true, searchQuery: '' }
      ]);
    } else {
      setDetails([
        { ledgerID: 0, drCr: 'Dr', amount: 0, searchQuery: '' },
        { ledgerID: 0, drCr: 'Cr', amount: 0, searchQuery: '' }
      ]);
    }
  };

  useEffect(() => {
    if (ledgers.length > 0 && details.length === 0 && editingVoucherId === null) {
      const cashLId = getCashLedger(ledgers, selectedBranchId, branches);
      setDetails([
        { ledgerID: cashLId, drCr: 'Dr', amount: 0, isLocked: true, searchQuery: '' },
        { ledgerID: 0, drCr: 'Cr', amount: 0, searchQuery: '' }
      ]);
    }
  }, [ledgers, branches]);

  const handleAddRow = () => {
    let defaultDrCr: 'Dr' | 'Cr' = 'Dr';
    if (voucherType === 'Receipt') defaultDrCr = 'Cr';
    if (voucherType === 'Payment') defaultDrCr = 'Dr';

    setDetails([...details, { ledgerID: 0, drCr: defaultDrCr, amount: 0, searchQuery: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    setDetails(details.filter((_, i) => i !== index));
  };

  const fetchLedgerBalanceAndPath = async (ledgerId: number, index: number) => {
    if (!ledgerId) return;
    try {
      const bRes = await fetch(`/api/Ledgers/${ledgerId}/balance`);
      if (bRes.ok) {
        const bData = await bRes.json();
        setDetails(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index].ledgerBalance = bData.currentBalance;
            updated[index].ledgerBalanceType = bData.balanceType;
          }
          return updated;
        });
      }

      const lRes = await fetch(`/api/Ledgers/${ledgerId}`);
      if (lRes.ok) {
        const lData = await lRes.json();
        setDetails(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index].ledgerPath = lData.pathString || '';
            updated[index].accountType = lData.accountType || '';
          }
          return updated;
        });
      }
    } catch (e) {
      console.error('Error fetching ledger details', e);
    }
  };

  const handleDetailChange = (index: number, field: keyof VoucherDetail, value: any) => {
    const newDetails = [...details];
    const isEditingLocked = newDetails[index]?.isLocked;

    if (isEditingLocked && field !== 'amount') return;

    newDetails[index] = { ...newDetails[index], [field]: value };

    if (field === 'ledgerID' && value) {
      fetchLedgerBalanceAndPath(Number(value), index);
    }

    if (field === 'amount') {
      const val = parseFloat(value) || 0;
      newDetails[index].amount = val;

      if (voucherType === 'Receipt') {
        const totalOther = newDetails
          .filter(d => !d.isLocked && d.drCr === 'Cr')
          .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const lockedIndex = newDetails.findIndex(d => d.isLocked);
        if (lockedIndex !== -1) {
          newDetails[lockedIndex].amount = totalOther;
        }
      } else if (voucherType === 'Payment') {
        const totalOther = newDetails
          .filter(d => !d.isLocked && d.drCr === 'Dr')
          .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
        const lockedIndex = newDetails.findIndex(d => d.isLocked);
        if (lockedIndex !== -1) {
          newDetails[lockedIndex].amount = totalOther;
        }
      }
    }

    setDetails(newDetails);
  };

  const totalDr = details.filter(d => d.drCr === 'Dr').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalCr = details.filter(d => d.drCr === 'Cr').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (details.length === 0) {
      alert("कृपया किमान एक व्हाउचर ओळ जोडा.");
      return;
    }

    const hasZeroLedger = details.some(d => !d.ledgerID);
    if (hasZeroLedger) {
      alert("कृपया सर्व ओळींसाठी खाते (Ledger) निवडा.");
      return;
    }

    const hasZeroAmount = details.some(d => !d.amount || d.amount <= 0);
    if (hasZeroAmount) {
      alert("कृपया सर्व ओळींसाठी वैध रक्कम प्रविष्ट करा.");
      return;
    }

    if (Math.abs(totalDr - totalCr) > 0.01) {
      alert(`Dr आणि Cr रकमा जुळत नाहीत! (Dr: ${totalDr.toFixed(2)}, Cr: ${totalCr.toFixed(2)})`);
      return;
    }

    const payload = {
      voucherDate,
      voucherType,
      narration: narration || '',
      branchID: selectedBranchId,
      details: details.map(d => ({
        ledgerID: d.ledgerID,
        drCr: d.drCr,
        amount: d.amount,
        memberID: d.memberID ? Number(d.memberID) : null
      }))
    };

    try {
      let response;
      if (editingVoucherId !== null) {
        response = await fetch(`${API_URL}/${editingVoucherId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, voucherID: editingVoucherId })
        });
      } else {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const resData = await response.json().catch(() => null);

      if (response.ok) {
        alert(editingVoucherId ? "व्हाउचर यशस्वीरित्या अपडेट झाले!" : "व्हाउचर यशस्वीरित्या सेव्ह झाले!");
        cancelEdit();
        fetchVouchers();
      } else {
        alert(resData?.message || resData || "व्हाउचर सेव्ह करण्यात त्रुटी आली.");
      }
    } catch (err) {
      console.error(err);
      alert("सर्व्हरशी संपर्क होऊ शकला नाही.");
    }
  };

  const handleEdit = (v: Voucher) => {
    setEditingVoucherId(v.voucherID);
    setVoucherNo(v.voucherNo);
    setVoucherDate(v.voucherDate.split('T')[0]);
    setVoucherType(v.voucherType);
    setNarration(v.narration || '');
    if ((v as any).branchID) {
      setSelectedBranchId((v as any).branchID);
    }

    const cashLId = getCashLedger(ledgers, (v as any).branchID || selectedBranchId, branches);

    const loadedDetails: VoucherDetail[] = (v.voucherDetails || []).map((vd) => {
      const isAutoCashRow = (v.voucherType === 'Receipt' && vd.drCr === 'Dr' && vd.ledgerID === cashLId) ||
                            (v.voucherType === 'Payment' && vd.drCr === 'Cr' && vd.ledgerID === cashLId);
      return {
        ledgerID: vd.ledgerID,
        drCr: vd.drCr as 'Dr' | 'Cr',
        amount: vd.amount,
        memberID: vd.memberID || '',
        isLocked: isAutoCashRow,
        searchQuery: vd.ledger?.ledgerName || ''
      };
    });

    setDetails(loadedDetails);

    loadedDetails.forEach((d, idx) => {
      if (d.ledgerID) {
        fetchLedgerBalanceAndPath(d.ledgerID, idx);
      }
    });

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancelEdit = () => {
    setEditingVoucherId(null);
    setNarration('');
    fetchNextVoucherNo(voucherType, selectedBranchId);

    const cashLId = getCashLedger(ledgers, selectedBranchId, branches);

    if (voucherType === 'Receipt') {
      setDetails([
        { ledgerID: cashLId, drCr: 'Dr', amount: 0, isLocked: true, searchQuery: '' },
        { ledgerID: 0, drCr: 'Cr', amount: 0, searchQuery: '' }
      ]);
    } else if (voucherType === 'Payment') {
      setDetails([
        { ledgerID: 0, drCr: 'Dr', amount: 0, searchQuery: '' },
        { ledgerID: cashLId, drCr: 'Cr', amount: 0, isLocked: true, searchQuery: '' }
      ]);
    } else {
      setDetails([
        { ledgerID: 0, drCr: 'Dr', amount: 0, searchQuery: '' },
        { ledgerID: 0, drCr: 'Cr', amount: 0, searchQuery: '' }
      ]);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("तुम्हाला खात्री आहे का की हे व्हाउचर डिलीट करायचे आहे?")) return;

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE'
      });

      const resData = await response.json().catch(() => null);

      if (response.ok) {
        alert(resData?.message || "व्हाउचर यशस्वीरित्या डिलीट झाले!");
        fetchVouchers();
      } else {
        alert(resData?.message || resData || "व्हाउचर डिलीट करण्यात त्रुटी आली.");
      }
    } catch (err) {
      console.error(err);
      alert("सर्व्हरशी संपर्क होऊ शकला नाही.");
    }
  };

  const toggleVoucher = (id: number) => {
    if (expandedVoucherId === id) setExpandedVoucherId(null);
    else setExpandedVoucherId(id);
  };

  const filteredVouchers = vouchers.filter(v => {
    const matchesType = listTypeFilter === 'All' || v.voucherType === listTypeFilter;
    const q = listSearchQuery.trim().toLowerCase();
    if (!q) return matchesType;

    const dateStr = new Date(v.voucherDate).toLocaleDateString('en-GB');
    const branchName = (v as any).branch?.branchName || '';
    const matchNo = (v.voucherNo || '').toLowerCase().includes(q);
    const matchType = (v.voucherType || '').toLowerCase().includes(q);
    const matchNarration = (v.narration || '').toLowerCase().includes(q);
    const matchAmount = (v.totalAmount || 0).toString().includes(q);
    const matchDate = dateStr.includes(q);
    const matchBranch = branchName.toLowerCase().includes(q);

    const matchLedger = v.voucherDetails?.some(vd => 
      (vd.ledger?.ledgerName || '').toLowerCase().includes(q)
    );

    return matchesType && (matchNo || matchType || matchNarration || matchAmount || matchDate || matchBranch || matchLedger);
  });

  if (printingVoucherId) {
    return <VoucherPrint voucherId={printingVoucherId} onBack={() => setPrintingVoucherId(null)} />;
  }

  const todayStr = user?.businessDate || new Date().toISOString().split('T')[0];
  const receiptCount = vouchers.filter(v => v.voucherType === 'Receipt').length;
  const paymentCount = vouchers.filter(v => v.voucherType === 'Payment').length;
  const todayCount = vouchers.filter(v => (v.voucherDate || '').startsWith(todayStr)).length;

  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
  const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans pb-8">
      
      {/* 🌟 1. TOP SLEEK CBS HEADER BANNER */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Receipt size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>व्हाउचर एंट्री मास्टर</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Voucher & Journal Entry Master)</span>
              {editingVoucherId !== null && (
                <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                  ✏️ संपादन चालू (#{editingVoucherId})
                </span>
              )}
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              रिसिप्ट (Receipt), पेमेंट (Payment), जर्नल (Journal) व कॉन्ट्रा (Contra) रोजकीर्द नोंदी व खतावणी
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {editingVoucherId !== null && (
            <button
              type="button"
              onClick={cancelEdit}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={cancelEdit}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन नोंद (Reset)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन व्हाउचर</span>
          </button>

          <button
            type="button"
            onClick={() => setIsListModalOpen(true)}
            className="px-2.5 py-1 bg-primary hover:opacity-90 text-white rounded-sm text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="नोंदणीकृत व्हाउचर्स यादी पहा"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>📋 व्हाउचर्स यादी ({vouchers.length})</span>
          </button>
        </div>
      </div>

      {/* 📊 2. SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण व्हाउचर्स</div>
            <div className="text-sm font-black text-gray-900">{vouchers.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">रिसिप्ट नोंदी (Receipts)</div>
            <div className="text-sm font-black text-emerald-800">{receiptCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">पेमेंट नोंदी (Payments)</div>
            <div className="text-sm font-black text-rose-800">{paymentCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">आजच्या नोंदी (Today)</div>
            <div className="text-sm font-black text-amber-800">{todayCount}</div>
          </div>
        </div>
      </div>

      {/* 📝 3. MAIN VOUCHER FORM */}
      <div 
        ref={formContainerRef}
        className={`bg-white p-3.5 rounded-sm shadow-xs border transition-all duration-300 mb-3 ${
          editingVoucherId !== null ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* SECTION 1: व्हाउचर मूलभूत माहिती */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">
                  {editingVoucherId ? `१. व्हाउचर संपादन चालू (Voucher ID: #${editingVoucherId})` : "१. व्हाउचर मूलभूत माहिती (Voucher Header & Type)"}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                <select 
                  value={selectedBranchId} 
                  onChange={handleBranchChange} 
                  disabled={editingVoucherId !== null || hasGlobalBranch}
                  className={`${inputClass} font-bold disabled:bg-slate-100 disabled:text-slate-500`}
                >
                  {branches.map(b => (
                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>व्हाउचरचा प्रकार (Voucher Type) <span className="text-red-500">*</span></label>
                <select 
                  value={voucherType} 
                  onChange={handleVoucherTypeChange} 
                  disabled={editingVoucherId !== null}
                  className={`${inputClass} font-bold disabled:bg-slate-100 disabled:text-slate-500`}
                >
                  <option value="Receipt">📥 रिसिप्ट (Receipt - रोख आवक)</option>
                  <option value="Payment">📤 पेमेंट (Payment - रोख जावक)</option>
                  <option value="Journal">🔄 जर्नल (Journal - ट्रान्सफर नोंद)</option>
                  <option value="Contra">🏦 कॉन्ट्रा (Contra - बँक / रोख)</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>व्हाउचर तारीख (Voucher Date) <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  value={voucherDate} 
                  onChange={e => setVoucherDate(e.target.value)} 
                  required
                  className={inputClass} 
                />
              </div>

              <div>
                <label className={labelClass}>व्हाउचर नंबर (Voucher No)</label>
                <input 
                  type="text" 
                  value={voucherNo === 'AUTO' ? 'लोड होत आहे...' : voucherNo} 
                  readOnly
                  className={`${inputClass} bg-slate-100 font-bold font-mono text-primary cursor-not-allowed`} 
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: व्हाउचर खतावणी तपशील */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold text-primary">२. व्हाउचर खतावणी तपशील (Account Ledgers & Amount Allocation)</h2>
              </div>

              <button 
                type="button" 
                onClick={handleAddRow} 
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-sm text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ओळ जोडा (Add Row)</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-sm max-h-[420px] shadow-2xs">
              <table className="min-w-full divide-y divide-gray-200 text-[11px] text-center border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0 z-10 shadow-xs border-b border-slate-300">
                  <tr>
                    <th className="p-2 border-r border-slate-300 text-center w-16">Dr / Cr</th>
                    <th className="p-2 border-r border-slate-300 text-left">खाते (Ledger Name & Code)</th>
                    <th className="p-2 border-r border-slate-300 text-right w-36">रक्कम (Amount ₹)</th>
                    <th className="p-2 text-center w-16">कृती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {details.map((detail, index) => (
                    <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-2 border-r border-gray-200 text-center">
                        <select 
                          value={detail.drCr} 
                          onChange={e => handleDetailChange(index, 'drCr', e.target.value)} 
                          disabled={detail.isLocked || voucherType === 'Payment' || voucherType === 'Receipt'}
                          className="w-full text-center border border-gray-300 rounded-sm px-1 py-1 text-[11px] bg-white disabled:bg-slate-100 disabled:text-slate-500 font-bold cursor-pointer h-[28px]"
                        >
                          <option value="Dr">Dr</option>
                          <option value="Cr">Cr</option>
                        </select>
                      </td>

                      <td className="p-2 border-r border-gray-200 text-left min-w-[280px]">
                        <SearchableSelect
                          disabled={detail.isLocked}
                          value={detail.ledgerID ? detail.ledgerID.toString() : ''}
                          onChange={(e) => {
                            const lId = parseInt(String(e.target.value)) || 0;
                            handleDetailChange(index, 'ledgerID', lId);
                            const sel = ledgers.find(l => l.ledgerID === lId);
                            handleDetailChange(index, 'searchQuery', sel?.ledgerName || '');
                          }}
                          options={ledgerOptions}
                          placeholder="-- खाते नाव किंवा नंबर शोधा (Search Ledger) --"
                          className={detail.isLocked 
                            ? "w-full border border-gray-300 px-2 py-1 rounded-sm text-[11px] bg-slate-100 font-bold text-gray-700 cursor-not-allowed flex justify-between items-center h-[28px]"
                            : "w-full border border-gray-300 px-2 py-1 rounded-sm text-[11px] bg-white flex justify-between items-center hover:border-primary cursor-pointer focus-within:border-primary focus-within:ring-1 focus-within:ring-primary h-[28px]"
                          }
                        />

                        {detail.ledgerID > 0 && detail.ledgerPath && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            <p className="text-[10px] text-gray-500 truncate" title={detail.ledgerPath}>
                              📍 {detail.ledgerPath}
                            </p>
                            <p className="text-[10.5px] font-bold text-indigo-700">
                              शिल्लक (Balance): {detail.ledgerBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {detail.ledgerBalanceType}
                            </p>
                          </div>
                        )}
                        
                        {(detail.accountType === 'Personal Account' || detail.accountType === 'Share Capital') && (
                          <div className="mt-1.5">
                            <MemberSearchSelect
                              members={members}
                              value={detail.memberID || ''}
                              onChange={(val) => handleDetailChange(index, 'memberID', val)}
                              placeholder="-- सभासद निवडा (Select Member) --"
                              className="w-full text-[11px]"
                            />
                          </div>
                        )}
                      </td>

                      <td className="p-2 border-r border-gray-200">
                        <input 
                          type="number" 
                          min="0" 
                          step="0.01" 
                          value={detail.amount || ''} 
                          onChange={e => handleDetailChange(index, 'amount', e.target.value)} 
                          readOnly={detail.isLocked}
                          placeholder="0.00"
                          className={`w-full text-right font-mono font-bold text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-[28px] ${
                            detail.isLocked ? 'bg-slate-100 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-900'
                          }`} 
                        />
                      </td>

                      <td className="p-2 text-center">
                        {!detail.isLocked ? (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveRow(index)} 
                            disabled={details.filter(d => !d.isLocked).length <= 1}
                            className="px-2 py-0.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-sm font-bold text-[10px] transition-colors cursor-pointer disabled:opacity-30"
                          >
                            बाद
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold">लॉक</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-[11px] sticky bottom-0 z-10 shadow-xs border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={2} className="p-2 text-right border-r border-slate-300 font-bold text-gray-800">
                      एकूण बेरीज (Total Allocation):
                    </td>
                    <td className="p-2 text-right border-r border-slate-300 font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-700 font-bold">Dr: ₹{totalDr.toFixed(2)}</span>
                        <span className="text-primary font-bold">Cr: ₹{totalCr.toFixed(2)}</span>
                      </div>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalDr !== totalCr && (
              <div className="mt-1.5 bg-rose-50 text-[11px] text-rose-700 font-bold p-2 rounded-sm border border-rose-200 flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Dr आणि Cr रकमा जुळत नाहीत! फरक (Difference): <strong>₹{Math.abs(totalDr - totalCr).toFixed(2)}</strong></span>
              </div>
            )}
          </div>

          {/* SECTION 3: व्यवहार तपशील */}
          <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2">
            <label className={labelClass}>व्यवहार सविस्तर तपशील (Narration / Remark)</label>
            <textarea 
              ref={narrationInputRef}
              value={narration} 
              onChange={e => setNarration(e.target.value)} 
              placeholder="व्यवहाराचा सविस्तर तपशील (उदा. चेक नंबर, बँकेचे नाव, कुणाकडून मिळाले, कशाबद्दल दिले इत्यादी)..."
              rows={2}
              className="w-full text-[11px] border border-gray-300 rounded-sm px-2.5 py-1.5 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-slate-50/50 text-gray-900 font-medium" 
            />
          </div>

          {/* Form Action Footer */}
          <div className="pt-2 flex justify-end items-center gap-2 border-t border-gray-200">
            {editingVoucherId && (
              <button 
                type="button" 
                onClick={cancelEdit}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>रद्द करा</span>
              </button>
            )}

            <button 
              type="submit" 
              disabled={totalDr !== totalCr || totalDr === 0}
              className="px-6 py-2 bg-primary hover:opacity-90 disabled:bg-slate-400 text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <CheckSquare className="w-4 h-4" />
              <span>{editingVoucherId ? '✏️ व्हाउचर अपडेट करा (Update)' : '💾 व्हाउचर सेव्ह करा (Save Voucher)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 📜 4. REGISTERED VOUCHERS LIST MODAL POPUP */}
      {isListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-300 border-t-4 border-t-primary animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <span className="text-sm font-bold flex items-center gap-1.5">
                  <span>नोंदवलेले व्हाउचर्स यादी (Registered Vouchers Directory)</span>
                </span>
                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {filteredVouchers.length} / {vouchers.length}
                </span>
              </div>
              <button 
                onClick={() => setIsListModalOpen(false)} 
                className="text-white hover:bg-red-600 text-sm font-bold w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer"
                title="बंद करा"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row gap-2 justify-between items-center">
              <div className="relative w-full sm:w-96">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  placeholder="व्हाउचर क्र., प्रकार, तारीख, तपशील किंवा रक्कमेने शोधा..."
                  className="w-full pl-8 pr-8 py-1 text-[11px] border border-gray-300 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white h-[28px]"
                  autoFocus
                />
                {listSearchQuery && (
                  <button
                    onClick={() => setListSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-[11px] font-bold text-gray-700 whitespace-nowrap">प्रकारनुसार (Type):</label>
                <select
                  value={listTypeFilter}
                  onChange={(e) => setListTypeFilter(e.target.value)}
                  className="border border-gray-300 px-2 py-1 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-white h-[28px] font-bold"
                >
                  <option value="All">सर्व व्हाउचर प्रकार (All)</option>
                  <option value="Receipt">📥 रिसिप्ट (Receipt)</option>
                  <option value="Payment">📤 पेमेंट (Payment)</option>
                  <option value="Journal">🔄 जर्नल (Journal)</option>
                  <option value="Contra">🏦 कॉन्ट्रा (Contra)</option>
                </select>
              </div>
            </div>

            {/* Modal Body Table */}
            <div className="p-3 overflow-y-auto flex-1 bg-slate-50">
              <div className="overflow-x-auto bg-white rounded-sm shadow-xs border border-gray-200">
                <table className="w-full text-[11px] text-center border-collapse whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2 border-r border-gray-200 text-left">शाखा (Branch)</th>
                      <th className="p-2 border-r border-gray-200 text-left">तारीख (Date)</th>
                      <th className="p-2 border-r border-gray-200 text-left">प्रकार (Type)</th>
                      <th className="p-2 border-r border-gray-200 text-left">नंबर (No)</th>
                      <th className="p-2 border-r border-gray-200 text-left">तपशील (Narration)</th>
                      <th className="p-2 border-r border-gray-200 text-right">रक्कम (Amount ₹)</th>
                      <th className="p-2 text-center w-36">क्रिया (Actions)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                          कोणतेही व्हाउचर सापडले नाही.
                        </td>
                      </tr>
                    ) : (
                      filteredVouchers.map(v => (
                        <React.Fragment key={v.voucherID}>
                          <tr className="hover:bg-blue-50/60 cursor-pointer transition-colors" onClick={() => toggleVoucher(v.voucherID)}>
                            <td className="p-2 border-r border-gray-200 text-left text-gray-700 font-bold">
                              {(v as any).branch?.branchName || '-'}
                            </td>
                            <td className="p-2 border-r border-gray-200 text-left text-gray-900 font-medium">
                              <span className="mr-1 text-gray-400 font-mono">{expandedVoucherId === v.voucherID ? '▼' : '▶'}</span>
                              {new Date(v.voucherDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </td>
                            <td className="p-2 border-r border-gray-200 text-left">
                              <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded ${
                                v.voucherType === 'Receipt' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                v.voucherType === 'Payment' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                                v.voucherType === 'Journal' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}>
                                {v.voucherType}
                              </span>
                            </td>
                            <td className="p-2 border-r border-gray-200 text-left font-bold text-primary font-mono">{v.voucherNo}</td>
                            <td className="p-2 border-r border-gray-200 text-left text-gray-600 truncate max-w-[200px]" title={v.narration || ''}>
                              {v.narration || '-'}
                            </td>
                            <td className="p-2 border-r border-gray-200 text-right font-bold text-gray-900 font-mono">
                              ₹{v.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setPrintingVoucherId(v.voucherID); }} 
                                  className="px-2 py-0.5 rounded-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                  title="प्रिंट करा"
                                >
                                  <Printer size={11} />
                                  <span>प्रिंट</span>
                                </button>
                                
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setIsListModalOpen(false); handleEdit(v); }} 
                                  className="px-2 py-0.5 rounded-sm bg-blue-50 hover:bg-blue-100 text-primary border border-blue-200 font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                  title="बदला"
                                >
                                  <Edit2 size={11} />
                                  <span>बदला</span>
                                </button>
                                
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(v.voucherID); }} 
                                  className="px-2 py-0.5 rounded-sm bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                                  title="डिलीट करा"
                                >
                                  <Trash2 size={11} />
                                  <span>बाद</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Accordion Expanded Ledger Details */}
                          {expandedVoucherId === v.voucherID && (
                            <tr className="bg-slate-50">
                              <td colSpan={7} className="p-3 border-l-4 border-primary">
                                <div className="text-[10.5px] font-bold text-primary mb-1.5 uppercase tracking-wider flex items-center gap-1">
                                  <BookOpen size={13} />
                                  <span>व्हाउचर मधील खाती व खतावणी तपशील (Ledger Breakdown):</span>
                                </div>
                                <table className="w-full bg-white border border-gray-200 rounded-sm text-[11px] shadow-xs">
                                  <thead className="bg-slate-100 text-slate-700 font-bold text-left">
                                    <tr>
                                      <th className="p-1.5 border-r border-gray-200">खाते (Ledger Name)</th>
                                      <th className="p-1.5 border-r border-gray-200 text-right w-32">नावे रक्कम (Dr ₹)</th>
                                      <th className="p-1.5 text-right w-32">जमा रक्कम (Cr ₹)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {v.voucherDetails && v.voucherDetails.map((vd, i) => (
                                      <tr key={i} className="hover:bg-slate-50">
                                        <td className="p-1.5 border-r border-gray-200 text-gray-900 font-medium">{vd.ledger?.ledgerName || 'Unknown Ledger'}</td>
                                        <td className="p-1.5 border-r border-gray-200 text-right text-emerald-700 font-bold font-mono">
                                          {vd.drCr === 'Dr' ? `₹${vd.amount.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="p-1.5 text-right text-primary font-bold font-mono">
                                          {vd.drCr === 'Cr' ? `₹${vd.amount.toFixed(2)}` : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 p-2.5 px-4 border-t border-gray-200 flex justify-between items-center text-[11px] text-gray-600">
              <span>💡 <strong>टीप:</strong> कोणत्याही व्हाउचरच्या ओळीवर क्लिक करून त्यातील खाती व Dr/Cr खतावणी पाहू शकता.</span>
              <button
                type="button"
                onClick={() => setIsListModalOpen(false)}
                className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-1 rounded-sm font-bold transition-colors cursor-pointer shadow-2xs"
              >
                बंद करा (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

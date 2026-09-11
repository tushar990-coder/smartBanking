import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  Printer, 
  Search, 
  Key, 
  DollarSign, 
  ShieldAlert, 
  Save, 
  UserCheck, 
  ArrowRight, 
  List, 
  Plus 
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface AllotmentOption {
  allotmentID: number;
  lockerAccountNo: string;
  lockerNo: string;
  cabinetNo: string;
  keyNo: string;
  memberName: string;
  memberNo: string;
  securityDepositAmount: number;
  annualRent: number;
  expiryDate: string;
  linkedSavingAccountID?: number;
  linkedSavingAccountNo?: string;
  isOverdue: boolean;
  status: string;
}

interface SurrenderRecord {
  surrenderID: number;
  branchID: number;
  allotmentID: number;
  lockerAccountNo: string;
  lockerNo: string;
  memberName: string;
  surrenderDate: string;
  keyReceived: boolean;
  keysCondition: string;
  depositAmount: number;
  unpaidRentDeduction: number;
  damagePenaltyDeduction: number;
  netRefundAmount: number;
  refundPaymentMode: string;
  voucherNo?: string;
  remarks?: string;
  createdAt: string;
}

const LockerSurrenderMaster: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'surrender' | 'history'>('surrender');
  const [surrenders, setSurrenders] = useState<SurrenderRecord[]>([]);
  const [allotments, setAllotments] = useState<AllotmentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    allotmentID: '',
    surrenderDate: new Date().toISOString().split('T')[0],
    keyReceived: true,
    keysCondition: 'Good',
    depositAmount: 0,
    unpaidRentDeduction: 0,
    damagePenaltyDeduction: 0,
    netRefundAmount: 0,
    refundPaymentMode: 'Cash',
    remarks: ''
  });

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchSurrenders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/LockerSurrender');
      if (res.ok) {
        const data = await res.json();
        setSurrenders(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveAllotments = async () => {
    try {
      const res = await fetch('/api/LockerAllotments?status=Active');
      if (res.ok) {
        const data = await res.json();
        setAllotments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSurrenders();
    fetchActiveAllotments();
  }, []);

  // When Allotment is selected, auto calculate deposit and unpaid rent if any
  useEffect(() => {
    if (formData.allotmentID) {
      const selected = allotments.find(a => a.allotmentID.toString() === formData.allotmentID.toString());
      if (selected) {
        const deposit = selected.securityDepositAmount || 0;
        let unpaid = 0;
        if (selected.isOverdue) {
          unpaid = selected.annualRent || 0;
        }

        const net = Math.max(0, deposit - unpaid - formData.damagePenaltyDeduction);
        setFormData(prev => ({
          ...prev,
          depositAmount: deposit,
          unpaidRentDeduction: unpaid,
          netRefundAmount: net,
          refundPaymentMode: selected.linkedSavingAccountID ? 'SavingCredit' : 'Cash'
        }));
      }
    }
  }, [formData.allotmentID, allotments]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name?: string; value: string | number; type?: string } }
  ) => {
    const target = e.target as any;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    
    setFormData(prev => {
      const updated = { ...prev, [target.name]: value };
      if (target.name === 'unpaidRentDeduction' || target.name === 'damagePenaltyDeduction' || target.name === 'depositAmount') {
        const dep = parseFloat(updated.depositAmount as any) || 0;
        const unp = parseFloat(updated.unpaidRentDeduction as any) || 0;
        const dmg = parseFloat(updated.damagePenaltyDeduction as any) || 0;
        updated.netRefundAmount = Math.max(0, dep - unp - dmg);
      }
      return updated;
    });
  };

  const handleReset = () => {
    setFormData({
      allotmentID: '',
      surrenderDate: new Date().toISOString().split('T')[0],
      keyReceived: true,
      keysCondition: 'Good',
      depositAmount: 0,
      unpaidRentDeduction: 0,
      damagePenaltyDeduction: 0,
      netRefundAmount: 0,
      refundPaymentMode: 'Cash',
      remarks: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.allotmentID) {
      showMsg('कृपया लॉकर खाते निवडा.', 'error');
      return;
    }
    if (!window.confirm('तुम्हाला हे लॉकर खाते नक्की बंद (Surrender) करायचे आहे का?')) return;

    const payload = {
      allotmentID: parseInt(formData.allotmentID),
      surrenderDate: formData.surrenderDate,
      keyReceived: formData.keyReceived,
      keysCondition: formData.keysCondition,
      depositAmount: Number(formData.depositAmount),
      unpaidRentDeduction: Number(formData.unpaidRentDeduction),
      damagePenaltyDeduction: Number(formData.damagePenaltyDeduction),
      netRefundAmount: Number(formData.netRefundAmount),
      refundPaymentMode: formData.refundPaymentMode,
      remarks: formData.remarks
    };

    try {
      const res = await fetch('/api/LockerSurrender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        showMsg(data.message || 'लॉकर यशस्वीरीत्या समर्पित करण्यात आला!');
        handleReset();
        fetchActiveAllotments();
        fetchSurrenders();
        setActiveTab('history');
      } else {
        const data = await res.json();
        showMsg(data.message || 'त्रुटी आली.', 'error');
      }
    } catch (err) {
      console.error(err);
      showMsg('सर्व्हर एरर आली.', 'error');
    }
  };

  const safeAllotments = Array.isArray(allotments) ? allotments : [];
  const safeSurrenders = Array.isArray(surrenders) ? surrenders : [];

  const allotmentDropdownOptions = [
    { value: '', label: '-- सक्रिय लॉकर खाते निवडा --' },
    ...safeAllotments.map(a => ({
      value: a.allotmentID.toString(),
      label: `${a.lockerAccountNo} | लॉकर: ${a.cabinetNo}-${a.lockerNo} (चावी: ${a.keyNo}) | ${a.memberName} (डिपॉझिट ₹${a.securityDepositAmount})`
    }))
  ];

  const selectedAllotment = safeAllotments.find(a => a.allotmentID.toString() === formData.allotmentID.toString());

  const filteredSurrenders = safeSurrenders.filter(s => {
    const term = searchTerm.toLowerCase();
    return !term ||
      (s.lockerAccountNo && s.lockerAccountNo.toLowerCase().includes(term)) ||
      (s.lockerNo && s.lockerNo.toLowerCase().includes(term)) ||
      (s.memberName && s.memberName.toLowerCase().includes(term));
  });

  const inputClass = "w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white";
  const labelClass = "block text-[11px] font-bold text-slate-700 mb-0.5";

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-lg shadow-xs border border-slate-200 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
            <LogOut size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">लॉकर समर्पण व अनामत परतावा (Locker Surrender)</h1>
            <p className="text-xs text-slate-500">लॉकर खाते बंद करणे, चावी तपासणी, थकीत वजावट व अनामत रक्कम परतावा व्हाऊचर</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('surrender')}
            className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'surrender' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus size={14} /> लॉकर समर्पण फॉर्म
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'history' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List size={14} /> समर्पण इतिहास ({surrenders.length})
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-2.5 rounded-md text-xs font-semibold flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tab 1: Surrender Form */}
      {activeTab === 'surrender' && (
        <div className="bg-white p-4 rounded-lg shadow-xs border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Step 1: Select Active Allotment */}
            <div className="bg-rose-50/40 p-3 rounded-lg border border-rose-200">
              <h2 className="text-xs font-bold text-rose-950 mb-2 flex items-center gap-1.5">
                <LogOut size={15} className="text-rose-700" /> १. समर्पित करावयाचे लॉकर खाते निवडा
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className={labelClass}>सक्रिय लॉकर खाते *</label>
                  <SearchableSelect
                    name="allotmentID"
                    value={formData.allotmentID}
                    onChange={handleChange}
                    options={allotmentDropdownOptions}
                    placeholder="-- लॉकर खाते किंवा लॉकर क्रमांक शोधा --"
                  />
                </div>
                <div>
                  <label className={labelClass}>समर्पण दिनांक (Surrender Date) *</label>
                  <input
                    type="date"
                    name="surrenderDate"
                    value={formData.surrenderDate}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Selected Info Card */}
            {selectedAllotment && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">सभासद</span>
                  <p className="font-bold text-slate-800">{selectedAllotment.memberName}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">कपाट व लॉकर</span>
                  <p className="font-bold text-slate-800">{selectedAllotment.cabinetNo} - {selectedAllotment.lockerNo}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">जमा अनामत रक्कम</span>
                  <p className="font-bold text-blue-700">₹{selectedAllotment.securityDepositAmount?.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">मुदत स्थिती</span>
                  <p className={`font-bold ${selectedAllotment.isOverdue ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {new Date(selectedAllotment.expiryDate).toLocaleDateString('en-GB')} {selectedAllotment.isOverdue ? '(थकबाकी)' : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Key Handover & Verification */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <h2 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Key size={15} className="text-amber-600" /> २. चावी हस्तांतरण व तपासणी (Key Handover)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center space-x-2 pt-4">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      name="keyReceived"
                      checked={formData.keyReceived}
                      onChange={handleChange}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>खातेदाराकडून मूळ चावी परत मिळाली</span>
                  </label>
                </div>

                <div>
                  <label className={labelClass}>चावीची स्थिती (Keys Condition)</label>
                  <select
                    name="keysCondition"
                    value={formData.keysCondition}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Good">उत्कृष्ट / मूळ चावी (Good / Original Key)</option>
                    <option value="KeyDamaged">चावी खराब झालेली (Damaged Key)</option>
                    <option value="LostKeyBreakOpen">चावी हरवली / लॉकर तोडला (Lost Key Break-Open)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>परतावा पद्धत (Refund Mode) *</label>
                  <select
                    name="refundPaymentMode"
                    value={formData.refundPaymentMode}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Cash">रोख परतावा (Cash Refund)</option>
                    {selectedAllotment?.linkedSavingAccountID && (
                      <option value="SavingCredit">
                        बचत खात्यात जमा (A/c: {selectedAllotment.linkedSavingAccountNo})
                      </option>
                    )}
                    <option value="BankTransfer">बँक ट्रान्सफर (Bank Transfer)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 3: Refund & Deductions Calculation */}
            <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
              <h2 className="text-xs font-bold text-emerald-950 mb-2 flex items-center gap-1.5">
                <DollarSign size={15} className="text-emerald-700" /> ३. परतावा हिशोब व कपात (Deposit Refund Calculation)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>मूळ अनामत रक्कम (Deposit ₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="depositAmount"
                    value={formData.depositAmount}
                    onChange={handleChange}
                    className={`${inputClass} font-bold text-blue-700`}
                  />
                </div>
                <div>
                  <label className={labelClass}>थकीत भाडे वजावट (Unpaid Rent ₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="unpaidRentDeduction"
                    value={formData.unpaidRentDeduction}
                    onChange={handleChange}
                    className={`${inputClass} font-bold text-rose-700`}
                  />
                </div>
                <div>
                  <label className={labelClass}>नुकसान / दंड वजावट (Penalty ₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="damagePenaltyDeduction"
                    value={formData.damagePenaltyDeduction}
                    onChange={handleChange}
                    className={`${inputClass} font-bold text-rose-700`}
                  />
                </div>
                <div>
                  <label className={labelClass}>निव्वळ परतावा रक्कम (Net Refund ₹)</label>
                  <div className="text-sm font-black text-emerald-800 bg-white p-1.5 rounded-md border border-emerald-300">
                    ₹{formData.netRefundAmount?.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>शेरा (Remarks)</label>
              <input
                type="text"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                placeholder="लॉकर सोडण्याचे कारण व शेरा"
                className={inputClass}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                रद्द करा
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-xs flex items-center gap-1.5"
              >
                <LogOut size={14} /> लॉकर समर्पित करा व डिपॉझिट परतावा व्हाऊचर बनवा
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Surrender History */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <div className="bg-white p-2.5 rounded-lg shadow-xs border border-slate-200 flex justify-between items-center">
            <div className="relative w-72">
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="खाते क्र. / लॉकर क्र. / सभासद शोधा..."
                className="w-full text-xs pl-7 pr-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <span className="text-xs text-slate-500">
              एकूण समर्पित लॉकर्स: <strong className="text-slate-800">{filteredSurrenders.length}</strong>
            </span>
          </div>

          <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">समर्पण दिनांक</th>
                    <th className="py-2 px-3">खाते क्रमांक</th>
                    <th className="py-2 px-3">लॉकर क्र.</th>
                    <th className="py-2 px-3">सभासद नाव</th>
                    <th className="py-2 px-3 text-right">मूळ डिपॉझिट</th>
                    <th className="py-2 px-3 text-right">थकीत वजावट</th>
                    <th className="py-2 px-3 text-right">परतावा रक्कम</th>
                    <th className="py-2 px-3">पेमेंट मोड</th>
                    <th className="py-2 px-3">व्हाऊचर क्रमांक</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSurrenders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400">
                        कोणतेही समर्पण रेकॉर्ड सापडले नाही.
                      </td>
                    </tr>
                  ) : (
                    filteredSurrenders.map((s) => (
                      <tr key={s.surrenderID} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-semibold">{new Date(s.surrenderDate).toLocaleDateString('en-GB')}</td>
                        <td className="py-2 px-3 font-mono font-bold text-rose-800">{s.lockerAccountNo}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{s.lockerNo}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{s.memberName}</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-700">₹{s.depositAmount?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-semibold text-rose-700">₹{(s.unpaidRentDeduction + s.damagePenaltyDeduction)?.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-800 text-sm">₹{s.netRefundAmount?.toFixed(2)}</td>
                        <td className="py-2 px-3 font-semibold text-slate-600">{s.refundPaymentMode}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-purple-700">{s.voucherNo || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LockerSurrenderMaster;

import React, { useState, useEffect } from 'react';
import { 
  X, ShieldCheck, ShieldAlert, CheckCircle2, User, 
  Lock, Unlock, Save, AlertCircle, RefreshCw, Smartphone, 
  Banknote, Wallet, Coins, Landmark
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DoorstepAccountItem {
  accountID: number;
  accountNo: string;
  schemeOrType: string;
  currentBalance: number;
  targetOrEmiAmount: number;
  isAgentCollectionAllowed: boolean;
  assignedAgentID: number | null;
  assignedAgentName?: string | null;
  status: string;
}

interface AgentOption {
  agentID: number;
  agentName: string;
  agentCode: string;
  mobileNo: string;
}

interface CustomerDoorstepPermissionsData {
  customerID: number;
  customerName: string;
  cifNo: string;
  mobileNo: string;
  pigmyAccounts: DoorstepAccountItem[];
  loanAccounts: DoorstepAccountItem[];
  savingAccounts: DoorstepAccountItem[];
  rdAccounts: DoorstepAccountItem[];
  availableAgents: AgentOption[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
  customerName?: string;
  onUpdated?: () => void;
}

export default function DoorstepPermissionsModal({
  isOpen,
  onClose,
  customerId,
  customerName,
  onUpdated
}: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CustomerDoorstepPermissionsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editable copies
  const [pigmyList, setPigmyList] = useState<DoorstepAccountItem[]>([]);
  const [loanList, setLoanList] = useState<DoorstepAccountItem[]>([]);
  const [savingList, setSavingList] = useState<DoorstepAccountItem[]>([]);
  const [rdList, setRdList] = useState<DoorstepAccountItem[]>([]);

  // Default agent for bulk assignment
  const [selectedBulkAgentId, setSelectedBulkAgentId] = useState<number | ''>('');

  const getAuthHeaders = (): Record<string, string> => {
    const token = user?.token || localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const fetchPermissions = async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/Customers/${customerId}/doorstep-permissions`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'माहिती लोड करण्यात अडचण आली.');
      }
      const json: CustomerDoorstepPermissionsData = await res.json();
      setData(json);
      setPigmyList((json.pigmyAccounts || []).map(p => ({
        ...p,
        isAgentCollectionAllowed: true,
        assignedAgentID: p.assignedAgentID || (json.availableAgents?.[0]?.agentID ?? null)
      })));
      setLoanList(json.loanAccounts || []);
      setSavingList(json.savingAccounts || []);
      setRdList(json.rdAccounts || []);
    } catch (err: any) {
      console.error('Error fetching doorstep permissions:', err);
      setError(err.message || 'डोअरस्टेप परवानग्या लोड होऊ शकल्या नाहीत.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customerId) {
      fetchPermissions();
    }
  }, [isOpen, customerId]);

  if (!isOpen) return null;

  const handleToggle = (
    type: 'pigmy' | 'loan' | 'saving' | 'rd',
    accountId: number,
    allowed: boolean
  ) => {
    const update = (list: DoorstepAccountItem[]) =>
      list.map(acc => {
        if (acc.accountID !== accountId) return acc;
        return {
          ...acc,
          isAgentCollectionAllowed: allowed,
          assignedAgentID: allowed ? (acc.assignedAgentID || (data?.availableAgents?.[0]?.agentID ?? null)) : null
        };
      });

    if (type === 'pigmy') setPigmyList(update);
    if (type === 'loan') setLoanList(update);
    if (type === 'saving') setSavingList(update);
    if (type === 'rd') setRdList(update);
  };

  const handleAgentChange = (
    type: 'pigmy' | 'loan' | 'saving' | 'rd',
    accountId: number,
    agentId: number | null
  ) => {
    const update = (list: DoorstepAccountItem[]) =>
      list.map(acc => {
        if (acc.accountID !== accountId) return acc;
        return {
          ...acc,
          assignedAgentID: agentId,
          isAgentCollectionAllowed: agentId !== null && agentId > 0
        };
      });

    if (type === 'pigmy') setPigmyList(update);
    if (type === 'loan') setLoanList(update);
    if (type === 'saving') setSavingList(update);
    if (type === 'rd') setRdList(update);
  };

  const handleBulkAssign = (agentId: number) => {
    const assignAll = (list: DoorstepAccountItem[]) =>
      list.map(acc => ({
        ...acc,
        isAgentCollectionAllowed: true,
        assignedAgentID: agentId
      }));

    setPigmyList(assignAll);
    setLoanList(assignAll);
    setSavingList(assignAll);
    setRdList(assignAll);
  };

  const handleResetAllToPrivate = () => {
    const makePrivate = (list: DoorstepAccountItem[]) =>
      list.map(acc => ({
        ...acc,
        isAgentCollectionAllowed: false,
        assignedAgentID: null
      }));

    setLoanList(makePrivate);
    setSavingList(makePrivate);
    setRdList(makePrivate);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const payload = {
      pigmyAccounts: pigmyList.map(p => ({
        accountID: p.accountID,
        isAgentCollectionAllowed: p.isAgentCollectionAllowed,
        assignedAgentID: p.assignedAgentID
      })),
      loanAccounts: loanList.map(l => ({
        accountID: l.accountID,
        isAgentCollectionAllowed: l.isAgentCollectionAllowed,
        assignedAgentID: l.assignedAgentID
      })),
      savingAccounts: savingList.map(s => ({
        accountID: s.accountID,
        isAgentCollectionAllowed: s.isAgentCollectionAllowed,
        assignedAgentID: s.assignedAgentID
      })),
      rdAccounts: rdList.map(r => ({
        accountID: r.accountID,
        isAgentCollectionAllowed: r.isAgentCollectionAllowed,
        assignedAgentID: r.assignedAgentID
      }))
    };

    try {
      const res = await fetch(`/api/Customers/${customerId}/doorstep-permissions`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'परवानग्या सेव्ह करताना त्रुटी आली.');
      }

      setSuccessMessage('ग्राहकाच्या डोअरस्टेप वसुली व गोपनीयता परवानग्या यशस्वीरीत्या सेव्ह झाल्या!');
      if (onUpdated) onUpdated();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error saving doorstep permissions:', err);
      setError(err.message || 'परवानग्या सेव्ह होऊ शकल्या नाहीत.');
    } finally {
      setSaving(false);
    }
  };

  const renderAccountTable = (
    title: string,
    icon: React.ReactNode,
    accounts: DoorstepAccountItem[],
    type: 'pigmy' | 'loan' | 'saving' | 'rd',
    typeNote?: string
  ) => {
    if (accounts.length === 0) {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center text-slate-500 text-xs my-2">
          {title}: कोणतेही सक्रिय खाते उपलब्ध नाही.
        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden mb-4">
        <div className="bg-slate-100/80 px-3 py-2 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-bold text-slate-800 text-xs">{title}</span>
            <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
              {accounts.length} खाती
            </span>
          </div>
          {typeNote && <span className="text-[10px] text-slate-500 italic">{typeNote}</span>}
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-semibold">
              <th className="p-2 w-12 text-center">अ.क्र.</th>
              <th className="p-2">खाते क्र.</th>
              <th className="p-2">योजना / प्रकार</th>
              <th className="p-2 text-right">शिल्लक रक्कम</th>
              <th className="p-2 text-right">हप्ता / दैनंदिन</th>
              <th className="p-2 text-center">एजंट वसुली परवानगी</th>
              <th className="p-2 min-w-[200px]">अधिकृत एजंट (Assigned Agent)</th>
              <th className="p-2 text-center">मोबाईल ॲप स्टेटस</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc, idx) => {
              const isAllowed = acc.isAgentCollectionAllowed;
              return (
                <tr 
                  key={acc.accountID} 
                  className={`border-b border-slate-100 transition ${isAllowed ? 'bg-emerald-50/30' : 'bg-slate-50/40 opacity-90'}`}
                >
                  <td className="p-2 text-center text-slate-500 font-semibold">{idx + 1}</td>
                  <td className="p-2 font-black text-slate-800">{acc.AccountNo || acc.accountNo}</td>
                  <td className="p-2 text-slate-700">{acc.schemeOrType}</td>
                  <td className="p-2 text-right font-mono font-bold text-slate-800">
                    ₹{(acc.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 text-right font-mono text-slate-600">
                    {acc.targetOrEmiAmount > 0 ? `₹${acc.targetOrEmiAmount.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggle(type, acc.accountID, !isAllowed)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                        isAllowed 
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs' 
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {isAllowed ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{isAllowed ? 'परवानगी सुरू' : 'गोपनीय (बंद)'}</span>
                    </button>
                  </td>
                  <td className="p-2">
                    <select
                      value={acc.assignedAgentID || ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        handleAgentChange(type, acc.accountID, val);
                      }}
                      disabled={!isAllowed}
                      className={`w-full px-2 py-1 text-xs border rounded transition outline-none ${
                        isAllowed 
                          ? 'bg-white border-slate-300 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium' 
                          : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <option value="">-- एजंट निवडा --</option>
                      {data?.availableAgents?.map(ag => (
                        <option key={ag.agentID} value={ag.agentID}>
                          {ag.agentName} ({ag.agentCode})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    {isAllowed && acc.assignedAgentID ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-2.5 h-2.5" /> ॲपवर दिसेल
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" /> ॲपवर लपवलेले
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-300">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                डोअरस्टेप वसुली व ग्राहक गोपनीयता व्यवस्थापन
              </h2>
              <p className="text-xs text-slate-300">
                खातेदार: <span className="font-bold text-white">{data?.customerName || customerName}</span> | 
                CIF: <span className="font-mono text-emerald-300 font-bold">{data?.cifNo || '-'}</span> | 
                मोबाईल: <span className="font-mono text-slate-200">{data?.mobileNo || '-'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Privacy Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2.5 text-amber-900 text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">गोपनीयता व सुरक्षा नियंत्रण (Doorstep Privacy Control):</span> ज्या खात्यांसाठी परवानगी 'सुरू' ठेवाल आणि अधिकृत एजंट नियुक्त कराल, फक्त तेच खाते एजंटच्या मोबाईल ॲपवर दिसेल. अनधिकृत किंवा बंद ठेवलेली खाती (उदा. कर्ज किंवा शिल्लक) एजंटला दिसणार नाहीत.
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
              <p className="font-medium text-xs">खातेदाराची खाती व परवानग्या लोड होत आहेत...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Quick Actions Bar */}
              <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">जलद कृती:</span>
                  <select
                    value={selectedBulkAgentId}
                    onChange={(e) => setSelectedBulkAgentId(e.target.value ? parseInt(e.target.value) : '')}
                    className="px-2 py-1 text-xs border border-slate-300 rounded outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- एजंट निवडा --</option>
                    {data?.availableAgents?.map(ag => (
                      <option key={ag.agentID} value={ag.agentID}>
                        {ag.agentName} ({ag.agentCode})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBulkAgentId) handleBulkAssign(selectedBulkAgentId as number);
                    }}
                    disabled={!selectedBulkAgentId}
                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    सर्व खाती या एजंटला द्या
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleResetAllToPrivate}
                  className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded text-xs font-bold transition cursor-pointer"
                >
                  🔒 कर्ज व बचत खाजगी ठेवा (सर्व बंद)
                </button>
              </div>

              {/* 1. Pigmy Accounts */}
              {renderAccountTable(
                'दैनिक ठेव खाती (Pigmy Daily Deposit)',
                <Coins className="w-4 h-4 text-amber-600" />,
                pigmyList,
                'pigmy',
                'नेहमी प्रमाणे दैनिक ठेव गोळा करण्याची परवानगी'
              )}

              {/* 2. Loan Accounts */}
              {renderAccountTable(
                'कर्ज खाती (Loan Accounts - EMI Collection)',
                <Landmark className="w-4 h-4 text-blue-600" />,
                loanList,
                'loan',
                'एजंट मोबाईलवर कर्ज EMI स्वीकारू शकेल (वॉटरफॉल नुसार जमा होईल)'
              )}

              {/* 3. Saving Accounts */}
              {renderAccountTable(
                'बचत खाती (Saving Accounts - Deposit Acceptance)',
                <Wallet className="w-4 h-4 text-emerald-600" />,
                savingList,
                'saving',
                'एजंट मोबाईलवर बचत खात्यात कॅश ठेव स्वीकारू शकेल'
              )}

              {/* 4. RD Accounts */}
              {renderAccountTable(
                'आवर्ती ठेव खाती (RD Recurring Deposit)',
                <Banknote className="w-4 h-4 text-purple-600" />,
                rdList,
                'rd',
                'एजंट मोबाईलवर RD चा मासिक हप्ता स्वीकारू शकेल'
              )}
            </>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
          >
            बंद करा (Close)
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 shadow transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'जतन होत आहे...' : 'परवानग्या जतन करा (Save Settings)'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  Wallet,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building,
  Coins,
  ShieldCheck,
  UserCheck,
  Settings,
  Scale,
  RotateCcw
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  ledgerNameEnglish?: string;
  accountType?: string;
  accountGroup?: { groupName?: string };
}

interface CashierItem {
  id: number;
  cashierName: string;
  counterNumber: string;
  cashLedgerId?: number | null;
  cashLedgerName?: string;
  isHeadCashier: boolean;
  isActive: boolean;
  maxCashLimit: number;
  remarks?: string;
}

export default function CashSchemeSettingMaster() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [cashiers, setCashiers] = useState<CashierItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(user?.branchID || 1);

  const [settings, setSettings] = useState({
    id: 0,
    branchId: 1,
    mainVaultLedgerId: 0,
    cashShortageLedgerId: 0,
    cashExcessLedgerId: 0,
    autoGenerateVouchers: false,
    enableDenominationMandatory: true,
    maxBranchVaultLimit: 5000000,
    defaultCounterLimit: 500000,
    remarks: ''
  });

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async (isMounted = true) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      // 1. Load Ledgers
      const ledgersRes = await api.get('/Ledgers');
      if (!isMounted) return;
      setLedgers(ledgersRes.data || []);

      // 2. Load Branches
      const branchesRes = await api.get('/Branches');
      if (!isMounted) return;
      setBranches(branchesRes.data || []);

      // 3. Load Cash Settings
      const settingsRes = await api.get(`/CashManagement/Settings?branchId=${selectedBranchId}`);
      if (!isMounted) return;
      if (settingsRes.data) {
        setSettings({
          id: settingsRes.data.id || 0,
          branchId: settingsRes.data.branchId || selectedBranchId,
          mainVaultLedgerId: settingsRes.data.mainVaultLedgerId || 0,
          cashShortageLedgerId: settingsRes.data.cashShortageLedgerId || 0,
          cashExcessLedgerId: settingsRes.data.cashExcessLedgerId || 0,
          autoGenerateVouchers: settingsRes.data.autoGenerateVouchers || false,
          enableDenominationMandatory: settingsRes.data.enableDenominationMandatory ?? true,
          maxBranchVaultLimit: settingsRes.data.maxBranchVaultLimit || 5000000,
          defaultCounterLimit: settingsRes.data.defaultCounterLimit || 500000,
          remarks: settingsRes.data.remarks || ''
        });
      }

      // 4. Load Cashiers list
      const cashiersRes = await api.get(`/CashManagement/Cashiers?branchId=${selectedBranchId}`);
      if (!isMounted) return;
      const cashierList: CashierItem[] = (cashiersRes.data || []).map((c: any) => ({
        id: c.Id || c.id,
        cashierName: c.CashierName || c.cashierName,
        counterNumber: c.CounterNumber || c.counterNumber,
        cashLedgerId: c.CashLedgerId || c.cashLedgerId || 0,
        cashLedgerName: c.CashLedgerName || c.cashLedgerName,
        isHeadCashier: c.IsHeadCashier ?? c.isHeadCashier,
        isActive: c.IsActive ?? c.isActive,
        maxCashLimit: c.MaxCashLimit || c.maxCashLimit || 500000,
        remarks: c.Remarks || c.remarks || ''
      }));
      setCashiers(cashierList);
    } catch (err) {
      if (!isMounted) return;
      console.error('Error loading Cash scheme settings:', err);
      setErrorMsg('सेटिंग डेटा लोड करताना त्रुटी आली.');
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    loadData(isMounted);
    return () => {
      isMounted = false;
    };
  }, [selectedBranchId]);

  // Options for SearchableSelect
  const ledgerOptions = useMemo(() => {
    return [
      { value: 0, label: '-- रोख खाते निवडा (Select Ledger) --' },
      ...ledgers.map(l => {
        const groupInfo = l.accountGroup?.groupName ? ` [${l.accountGroup.groupName}]` : (l.accountType ? ` [${l.accountType}]` : '');
        const eng = l.ledgerNameEnglish ? ` (${l.ledgerNameEnglish})` : '';
        return {
          value: l.ledgerID,
          label: `${l.ledgerName}${eng}${groupInfo}`
        };
      })
    ];
  }, [ledgers]);

  const handleCashierLedgerChange = (cashierId: number, ledgerId: number) => {
    setCashiers(prev => prev.map(c => {
      if (c.id === cashierId) {
        return { ...c, cashLedgerId: ledgerId };
      }
      return c;
    }));
  };

  const handleCashierLimitChange = (cashierId: number, limit: number) => {
    setCashiers(prev => prev.map(c => {
      if (c.id === cashierId) {
        return { ...c, maxCashLimit: limit };
      }
      return c;
    }));
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      // 1. Save Scheme Settings
      await api.post('/CashManagement/Settings', {
        id: settings.id,
        branchId: selectedBranchId,
        mainVaultLedgerId: Number(settings.mainVaultLedgerId) || null,
        cashShortageLedgerId: Number(settings.cashShortageLedgerId) || null,
        cashExcessLedgerId: Number(settings.cashExcessLedgerId) || null,
        autoGenerateVouchers: settings.autoGenerateVouchers,
        enableDenominationMandatory: settings.enableDenominationMandatory,
        maxBranchVaultLimit: Number(settings.maxBranchVaultLimit) || 5000000,
        defaultCounterLimit: Number(settings.defaultCounterLimit) || 500000,
        remarks: settings.remarks
      });

      // 2. Save individual Cashier Counter updates
      for (const c of cashiers) {
        await api.put(`/CashManagement/Cashiers/${c.id}`, {
          id: c.id,
          branchId: selectedBranchId,
          cashierName: c.cashierName,
          counterNumber: c.counterNumber,
          cashLedgerId: Number(c.cashLedgerId) || null,
          isHeadCashier: c.isHeadCashier,
          isActive: c.isActive,
          maxCashLimit: c.maxCashLimit,
          remarks: c.remarks
        });
      }

      setSuccessMsg('कॅश मॅनेजमेंट व लेजर मॅपिंग सेटिंग्ज यशस्वीरित्या जतन झाल्या!');
      await loadData();
    } catch (err: any) {
      console.error('Error saving Cash Scheme settings:', err);
      setErrorMsg(err.response?.data?.message || 'सेटिंग्ज जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full border border-gray-300 px-2.5 py-1 rounded-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-[11px] h-[28px] bg-white font-medium";
  const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-[11px] font-sans">
      
      {/* Top Sleek CBS Header Banner */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-2xs">
            <Coins size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>कॅश मॅनेजमेंट व काउंटर योजना सेटिंग</span>
              <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Cash Scheme Setting)</span>
            </h1>
            <p className="text-[11px] text-gray-500 font-medium">
              मुख्य तिजोरी, काउंटर निहाय रोख खाती (GL Ledgers), तफावत खाती व रोख मर्यादा व्यवस्थापन
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-sm px-2.5 py-1 text-xs shadow-2xs">
              <Building size={13} className="text-slate-600" />
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="bg-transparent font-bold text-gray-800 outline-none text-[11px]"
              >
                {branches.map((b) => {
                  const bId = b.branchID ?? b.BranchID;
                  const bName = b.branchName ?? b.BranchName;
                  return (
                    <option key={bId} value={bId}>
                      {bName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => loadData()}
            title="रिफ्रेश करा"
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-sm text-xs font-bold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm text-xs font-bold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm text-xs font-bold flex items-center gap-2 shadow-2xs">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-3">
        
        {/* Section 1: Core Scheme GL Ledger Mappings */}
        <div className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary">
          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5 mb-3">
            <Scale className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-primary">१. मुख्य रोख व तफावत लेजर मॅपिंग (Core Cash GL Mappings)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Main Vault Ledger */}
            <div>
              <label className={labelClass}>
                मुख्य तिजोरी रोख खाते (Main Vault Cash Ledger) <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                name="mainVaultLedgerId"
                value={settings.mainVaultLedgerId}
                options={ledgerOptions}
                onChange={(e) => setSettings({ ...settings, mainVaultLedgerId: Number(e.target.value) })}
                placeholder="-- मुख्य रोख खाते निवडा --"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                बँकेच्या मुख्य तिजोरीशी संलग्न जनरल लेजर (उदा. तिजोरी रोख खाते)
              </p>
            </div>

            {/* Cash Shortage Ledger */}
            <div>
              <label className={labelClass}>
                कॅश तफावत - कमी रक्कम खर्च खाते (Shortage Expense A/c)
              </label>
              <SearchableSelect
                name="cashShortageLedgerId"
                value={settings.cashShortageLedgerId}
                options={ledgerOptions}
                onChange={(e) => setSettings({ ...settings, cashShortageLedgerId: Number(e.target.value) })}
                placeholder="-- खर्च / नुकसान खाते निवडा --"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                दिवस अखेर नोटा मोजणीत रोख कमी आढळल्यास खर्च नोंद
              </p>
            </div>

            {/* Cash Excess Ledger */}
            <div>
              <label className={labelClass}>
                कॅश तफावत - जास्त रक्कम उत्पन्न खाते (Excess Gain A/c)
              </label>
              <SearchableSelect
                name="cashExcessLedgerId"
                value={settings.cashExcessLedgerId}
                options={ledgerOptions}
                onChange={(e) => setSettings({ ...settings, cashExcessLedgerId: Number(e.target.value) })}
                placeholder="-- उत्पन्न / इतर जमा खाते निवडा --"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                दिवस अखेर नोटा मोजणीत जास्त रोख आढळल्यास जमा नोंद
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Counter-Wise GL Mapping & Limits */}
        <div className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-gray-200 pb-1.5 mb-3">
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold text-primary">२. काउंटर निहाय विशिष्ट रोख लेजर व मर्यादा (Counter-Wise GL & Limits)</h2>
            </div>
            <span className="text-[10px] text-gray-500 font-medium">
              प्रत्येक टेलर काउंटरला स्वतंत्र रोख खाते किंवा डिफॉल्ट खाते मॅप करा
            </span>
          </div>

          {cashiers.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 font-bold">
              सध्या कोणतेही कॅश काउंटर उपलब्ध नाही.
            </div>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-gray-700 font-bold border-b border-gray-300">
                  <tr>
                    <th className="py-2 px-3 border-r border-gray-200">काउंटर / कॅशिअर</th>
                    <th className="py-2 px-3 border-r border-gray-200 text-center w-28">भूमिका</th>
                    <th className="py-2 px-3 border-r border-gray-200 min-w-[280px]">विशिष्ट रोख खाते (Counter Cash GL Ledger)</th>
                    <th className="py-2 px-3 border-r border-gray-200 min-w-[150px]">कमाल मर्यादा (Max Limit ₹)</th>
                    <th className="py-2 px-3 text-center w-20">स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                  {cashiers.map((c, idx) => (
                    <tr key={c.id} className={`hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="py-2 px-3 border-r border-gray-200">
                        <div className="font-bold text-gray-900">{c.cashierName}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{c.counterNumber}</div>
                      </td>
                      <td className="py-2 px-3 border-r border-gray-200 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.isHeadCashier ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {c.isHeadCashier ? 'हेड कॅशिअर' : 'टेलर / काउंटर'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-gray-200">
                        <SearchableSelect
                          value={c.cashLedgerId || 0}
                          options={ledgerOptions}
                          onChange={(e) => handleCashierLedgerChange(c.id, Number(e.target.value))}
                          placeholder="-- डिफॉल्ट मुख्य रोख खाते वापरा --"
                        />
                      </td>
                      <td className="py-2 px-3 border-r border-gray-200">
                        <input
                          type="number"
                          value={c.maxCashLimit}
                          onChange={(e) => handleCashierLimitChange(c.id, Number(e.target.value))}
                          className={`${inputClass} font-bold text-gray-900 font-mono`}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          c.isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-500 border border-slate-300'
                        }`}>
                          {c.isActive ? 'सक्रिय' : 'बंद'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: Operational Rules & Controls */}
        <div className="bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary">
          <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5 mb-3">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-bold text-primary">३. रोख नियंत्रण व पडताळणी नियम (Cash Rules & Controls)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-3">
            <div>
              <label className={labelClass}>
                शाखेची एकूण तिजोरी मर्यादा (Branch Vault Limit ₹)
              </label>
              <input
                type="number"
                value={settings.maxBranchVaultLimit}
                onChange={(e) => setSettings({ ...settings, maxBranchVaultLimit: Number(e.target.value) })}
                className={`${inputClass} font-bold font-mono text-gray-900`}
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                तिजोरीत या मर्यादेपेक्षा जास्त रोख असल्यास अलर्ट दिला जाईल
              </span>
            </div>

            <div>
              <label className={labelClass}>
                डीफॉल्ट काउंटर मर्यादा (Default Counter Limit ₹)
              </label>
              <input
                type="number"
                value={settings.defaultCounterLimit}
                onChange={(e) => setSettings({ ...settings, defaultCounterLimit: Number(e.target.value) })}
                className={`${inputClass} font-bold font-mono text-gray-900`}
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                नवीन काउंटर तयार करताना लागू होणारी कमाल शिल्लक मर्यादा
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200">
            <label className="flex items-center gap-2.5 p-2 rounded-sm bg-slate-50 border border-slate-200 cursor-pointer hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                checked={settings.enableDenominationMandatory}
                onChange={(e) => setSettings({ ...settings, enableDenominationMandatory: e.target.checked })}
                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <div>
                <span className="font-bold text-gray-900 block text-xs">दिवस अखेर नोटा मोजणी बंधनकारक</span>
                <span className="text-[10px] text-gray-500">काउंटर क्लोजिंग करण्यापूर्वी नोटांची मोजणी करणे अनिवार्य राहील</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-sm bg-slate-50 border border-slate-200 cursor-pointer hover:bg-primary/5 transition-colors">
              <input
                type="checkbox"
                checked={settings.autoGenerateVouchers}
                onChange={(e) => setSettings({ ...settings, autoGenerateVouchers: e.target.checked })}
                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <div>
                <span className="font-bold text-gray-900 block text-xs">हस्तांतरण व्हाउचर स्वयं-निर्मिती</span>
                <span className="text-[10px] text-gray-500">तिजोरीतून वाटप किंवा परतावा झाल्यावर आपोआप व्हाउचर पास करणे</span>
              </div>
            </label>
          </div>

          <div className="mt-3">
            <label className={labelClass}>शेरा / टिप्पणी (Remarks)</label>
            <input
              type="text"
              value={settings.remarks}
              onChange={(e) => setSettings({ ...settings, remarks: e.target.value })}
              placeholder="योजना व रोख नियमांविषयी अतिरिक्त माहिती"
              className={inputClass}
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => loadData()}
            className="px-4 py-2 rounded-sm border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
          >
            <RotateCcw size={13} />
            <span>बदल रद्द करा</span>
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-6 py-2 rounded-sm bg-primary hover:opacity-90 text-white font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? 'जतन होत आहे...' : 'कॅश योजना सेटिंग्ज जतन करा'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

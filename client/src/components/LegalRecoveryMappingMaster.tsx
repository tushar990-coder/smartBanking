import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Scale, Save, CheckCircle, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { isHeadOfficeUser, getLockedBranchId, resolveWriteBranchId } from '../utils/branchAccess';

interface Ledger {
  ledgerID: number;
  ledgerName: string;
  ledgerNameEnglish?: string;
  accountType?: string;
}

interface Branch {
  branchID: number;
  branchName: string;
  branchCode: string;
}

interface MappingItem {
  mappingId?: number;
  branchId: number | null;
  transactionType: string;
  typeLabel: string;
  description: string;
  debitLedgerId: number;
  creditLedgerId: number;
  isActive: boolean;
  isInheritedGlobal?: boolean;
}

const TRANSACTION_TYPES: { key: string; label: string; defaultDr: string; defaultCr: string; desc: string }[] = [
  {
    key: 'NOTICE_FEE',
    label: '१. नोटीस टपाल व प्रशासकीय फी (Notice Fee)',
    defaultDr: 'येणे कायदेशीर खर्च (मंजुरीनंतर Overdue Ledger)',
    defaultCr: 'नोटीस फी उत्पन्न / टपाल खर्च',
    desc: 'नोटीस १, २ व कलम १०१/९१ अंतिम नोटीस काढताना आकारण्यात येणारी फी'
  },
  {
    key: 'COURT_FEE',
    label: '२. कलम १०१/९१ कोर्ट फी व शासकीय चलन (Court Fee)',
    defaultDr: 'कोर्ट फी येणे / खर्च खाते',
    defaultCr: 'रोख / बँक खाते (Cash/Bank)',
    desc: 'मा. निबंधक किंवा सहकारी न्यायालयात दावा दाखल करताना भरलेली कोर्ट फी'
  },
  {
    key: 'ADVOCATE_FEE',
    label: '३. वकिली फी व कायदेशीर सल्ला (Advocate Fees)',
    defaultDr: 'वकिली फी येणे / खर्च खाते',
    defaultCr: 'रोख / बँक खाते (Cash/Bank)',
    desc: 'कोर्ट सुनावणी व दावा ड्राफ्टिंगसाठी वकिलांना अदा केलेली फी'
  },
  {
    key: 'NEWSPAPER_AD',
    label: '४. वर्तमानपत्र लिलाव जाहीरनामा खर्च (Newspaper Ad)',
    defaultDr: 'लिलाव जाहिरात खर्च येणे खाते',
    defaultCr: 'रोख / बँक खाते (Cash/Bank)',
    desc: 'नियम १०७ अंतर्गत मालमत्ता जप्ती व लिलाव वर्तमानपत्र जाहिरात खर्च'
  },
  {
    key: 'SRO_COMMISSION',
    label: '५. विशेष वसुली अधिकारी फी (SRO Commission)',
    defaultDr: 'SRO वसुली खर्च येणे खाते',
    defaultCr: 'रोख / बँक खाते (Cash/Bank)',
    desc: 'विशेष वसुली अधिकारी (SRO / Sale Officer) मांग पत्रक व जप्ती कमिशन'
  },
  {
    key: 'AUCTION_SUSPENSE',
    label: '६. लिलाव अनामत सस्पेन्स खाते (Auction EMD / Suspense)',
    defaultDr: 'रोख / बँक खाते (Cash/Bank)',
    defaultCr: 'लिलाव सस्पेन्स खाते (Auction Suspense)',
    desc: 'लिलाव बोलीदाराकडून जमा झालेली अनामत व लिलाव विक्री रक्कम'
  },
  {
    key: 'PENAL_INTEREST',
    label: '७. दंडव्याज आकारणी (Penal Interest Income)',
    defaultDr: 'कर्जदार येणे दंडव्याज खाते',
    defaultCr: 'दंडव्याज उत्पन्न खाते (Penal Interest Income)',
    desc: 'थकीत मुदतीवर आकारलेले अतिरिक्त दंडव्याज'
  },
  {
    key: 'OTHER_LEGAL',
    label: '८. इतर कायदेशीर / स्टॅम्प व प्रवास खर्च (Other Legal Expense)',
    defaultDr: 'इतर कायदेशीर खर्च येणे खाते',
    defaultCr: 'रोख / बँक खाते (Cash/Bank)',
    desc: 'पंचनामा, मुल्यांकन, स्टॅम्प पेपर व इतर विविध कायदेशीर खर्च'
  },
  {
    key: 'BORROWER_SURPLUS_PAYABLE',
    label: '९. नियम १०७ लिलाव अतिरिक्त रक्कम देय (Borrower Surplus Payable)',
    defaultDr: 'रोख / बँक खाते (Cash/Bank)',
    defaultCr: 'कर्जदार अतिरिक्त लिलाव देय खाते (Payable)',
    desc: 'लिलाव विक्रीतून सर्व कर्ज व खर्च वजा करून उरणारी रक्कम ठेवण्यासाठी दायित्व खाते'
  }
];

interface LegalRecoveryMappingMasterProps {
  branchId?: number;
  embedded?: boolean;
  onDataChanged?: () => void;
}

export default function LegalRecoveryMappingMaster({ branchId: propBranchId, embedded = false, onDataChanged }: LegalRecoveryMappingMasterProps = {}) {
  const { user, globalBranchId } = useAuth();
  const isHo = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const canEditMapping = ['admin', 'superadmin', 'super admin', 'systemadmin', 'headoffice', 'ho_manager', 'ho manager', 'branchmanager', 'manager']
    .includes((user?.role || '').trim().toLowerCase());

  const [branches, setBranches] = useState<Branch[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [selectedBranchKey, setSelectedBranchKey] = useState<string>(() => {
    if (!isHo && lockedBranchId) return String(lockedBranchId);
    const resolved = propBranchId || resolveWriteBranchId(user, globalBranchId);
    return String(resolved || 'global');
  });
  const [mappings, setMappings] = useState<Record<string, MappingItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isHo && lockedBranchId) {
      setSelectedBranchKey(String(lockedBranchId));
    } else if (propBranchId && propBranchId > 0) {
      setSelectedBranchKey(String(propBranchId));
    }
  }, [isHo, lockedBranchId, propBranchId]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    loadMappingsForBranch(selectedBranchKey);
  }, [selectedBranchKey, ledgers]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [branchRes, ledgerRes] = await Promise.all([
        axios.get('/api/Branches'),
        axios.get('/api/Ledgers')
      ]);

      if (branchRes.data) setBranches(Array.isArray(branchRes.data) ? branchRes.data : []);
      if (ledgerRes.data) setLedgers(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
    } catch (e) {
      console.error(e);
      setMessage({ text: 'डेटा लोड करताना त्रुटी आली.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadMappingsForBranch = async (branchKey: string) => {
    try {
      const targetBranchId = branchKey === 'global' ? null : Number(branchKey);
      const url = targetBranchId ? `/api/LegalRecoveryMapping?branchId=${targetBranchId}` : '/api/LegalRecoveryMapping';
      const res = await axios.get(url);
      const serverMappings: any[] = Array.isArray(res.data) ? res.data : [];

      const mapObj: Record<string, MappingItem> = {};
      TRANSACTION_TYPES.forEach((t) => {
        const exactMatch = serverMappings.find((m: any) =>
          m.transactionType === t.key &&
          (targetBranchId === null ? (m.branchId === null || m.branchId === 0) : m.branchId === targetBranchId)
        );
        const globalFallback = targetBranchId !== null
          ? serverMappings.find((m: any) => m.transactionType === t.key && (m.branchId === null || m.branchId === 0))
          : undefined;
        const found = exactMatch || globalFallback;

        mapObj[t.key] = {
          mappingId: exactMatch?.mappingId,
          branchId: targetBranchId,
          transactionType: t.key,
          typeLabel: t.label,
          description: t.desc,
          debitLedgerId: found?.debitLedgerId || 0,
          creditLedgerId: found?.creditLedgerId || 0,
          isActive: found ? found.isActive : true,
          isInheritedGlobal: !exactMatch && Boolean(globalFallback),
        };
      });

      setMappings(mapObj);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLedgerChange = (typeKey: string, field: 'debitLedgerId' | 'creditLedgerId', val: number) => {
    setMappings((prev) => ({
      ...prev,
      [typeKey]: {
        ...prev[typeKey],
        [field]: val,
        isInheritedGlobal: false,
      }
    }));
  };

  const handleSaveAll = async () => {
    if (!canEditMapping) {
      setMessage({ text: 'अधिकृत ब्रांच मॅनेजर किंवा अ‍ॅडमिन यांनाच लेजर मॅपिंग बदलण्याची परवानगी आहे.', type: 'error' });
      return;
    }

    const targetBranchId = selectedBranchKey === 'global' ? null : Number(selectedBranchKey);
    const items = Object.values(mappings);

    const incomplete = items.filter((m) => (m.debitLedgerId > 0) !== (m.creditLedgerId > 0));
    if (incomplete.length > 0) {
      setMessage({
        text: `कृपया '${incomplete[0].typeLabel}' साठी नावे (Debit) आणि जमा (Credit) दोन्ही लेजर निवडा.`,
        type: 'error'
      });
      return;
    }

    const validItems = items.filter((m) => m.debitLedgerId > 0 && m.creditLedgerId > 0);
    if (validItems.length === 0) {
      setMessage({ text: 'सेव्ह करण्यासाठी किमान एक वैध लेजर मॅपिंग निवडा.', type: 'error' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const listToSave = validItems.map((m) => ({
        mappingId: m.mappingId || 0,
        branchId: targetBranchId,
        transactionType: m.transactionType,
        debitLedgerId: Number(m.debitLedgerId),
        creditLedgerId: Number(m.creditLedgerId),
        isActive: m.isActive
      }));

      const res = await axios.post('/api/LegalRecoveryMapping/bulk-save', listToSave);

      if (res.status === 200) {
        setMessage({ text: 'सर्व कायदेशीर वसुली लेजर मॅपिंग यशस्वीरीत्या सेव्ह झाले आहेत!', type: 'success' });
        await loadMappingsForBranch(selectedBranchKey);
        if (onDataChanged) onDataChanged();
      } else {
        setMessage({ text: 'मॅपिंग सेव्ह करताना त्रुटी आली.', type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setMessage({ text: 'मॅपिंग सेव्ह करताना त्रुटी आली: ' + (e.response?.data?.message || e.message), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const ledgerOptions = ledgers.map((l) => ({
    value: l.ledgerID,
    label: `${l.ledgerName} (${l.accountType || 'General'})`
  }));

  return (
    <div className={embedded ? 'max-w-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5' : 'p-2.5 max-w-full h-full flex flex-col bg-transparent text-[11px] font-sans space-y-2.5'}>
      {/* Top Header (Standalone CBS Header vs Embedded Action Strip) */}
      {!embedded ? (
        <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary shrink-0" />
              <h1 className="text-sm font-bold text-primary tracking-wide">कायदेशीर वसुली लेजर मॅपिंग (Legal Recovery Dynamic COA Mapping)</h1>
            </div>
            <p className="text-slate-500 text-[10.5px] mt-0.5">
              सहकार कायदा कलम १०१ व ९१ कोर्ट फी, वकिली फी, नोटीस फी व लिलाव खर्चासाठी संस्थेचे डायनॅमिक लेजर्स मॅप करा. (Zero Hardcoding)
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || !canEditMapping || loading}
            className="flex items-center gap-1.5 bg-primary hover:opacity-95 text-white px-4 py-1.5 rounded-sm font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            सर्व मॅपिंग सेव्ह करा (Save All)
          </button>
        </div>
      ) : (
        <div className="bg-white px-3 py-2 rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">शाखा निवडा (Select Branch):</label>
            <select
              value={selectedBranchKey}
              disabled={!isHo}
              onChange={(e) => setSelectedBranchKey(e.target.value)}
              className="border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-semibold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-gray-100"
            >
              {isHo && <option value="global">सर्व शाखांसाठी डीफॉल्ट (Global Default)</option>}
              {branches.map((b) => (
                <option key={b.branchID} value={String(b.branchID)}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
              एकूण {TRANSACTION_TYPES.length} लेजर मॅपिंग
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || !canEditMapping || loading}
            className="flex items-center gap-1.5 bg-primary hover:opacity-95 text-white px-3.5 py-1 rounded-sm font-bold text-xs shadow-xs transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            सर्व मॅपिंग सेव्ह करा (Save All)
          </button>
        </div>
      )}

      {/* Info Alert */}
      <div className="bg-primary/5 border border-primary/20 rounded-sm p-2.5 flex items-start gap-2.5 text-slate-800 text-xs">
        <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-primary">डायनॅमिक लेजर रचना माहिती: </span>
          येथे मॅप केलेले लेजर्स कोर्ट फी, वकील फी, नोटीस फी व नियम १०७ लिलाव वसुलीसाठी <strong>व्हाउचर (Auto-Voucher)</strong> तयार करण्याकरिता वापरले जातील. (Zero Hardcoding Principle)
        </div>
      </div>

      {/* Branch Selector (Standalone mode) */}
      {!embedded && (
        <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700">शाखा निवडा (Select Branch):</label>
            <select
              value={selectedBranchKey}
              disabled={!isHo}
              onChange={(e) => setSelectedBranchKey(e.target.value)}
              className="border border-gray-300 rounded-sm px-2.5 py-1 text-xs font-semibold text-gray-800 bg-white focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:bg-gray-100"
            >
              {isHo && <option value="global">सर्व शाखांसाठी डीफॉल्ट (Global Default)</option>}
              {branches.map((b) => (
                <option key={b.branchID} value={String(b.branchID)}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
          </div>
          <span className="text-[11px] text-gray-500 font-medium">
            एकूण {TRANSACTION_TYPES.length} प्रकारच्या कायदेशीर व्यवहारांसाठी लेजर मॅपिंग उपलब्ध
          </span>
        </div>
      )}

      {/* Notification Message */}
      {message && (
        <div
          className={`p-2.5 rounded-sm border flex items-center gap-2 text-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
              : 'bg-rose-50 border-rose-300 text-rose-800 font-semibold'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Mappings Table */}
      <div className="bg-white rounded-sm border border-gray-200 border-t-2 border-t-primary shadow-xs overflow-hidden">
        <div className="p-2.5 bg-slate-50 border-b border-gray-200">
          <h2 className="text-xs font-bold text-primary border-l-4 border-primary pl-2">कायदेशीर व्यवहार व लेजर कॉन्फिगरेशन</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {TRANSACTION_TYPES.map((t, idx) => {
            const cur = mappings[t.key] || {
              debitLedgerId: 0,
              creditLedgerId: 0,
              isActive: true
            };

            return (
              <div key={t.key} className="p-3 hover:bg-primary/5 transition grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                {/* Description */}
                <div className="lg:col-span-4 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.2 rounded-sm uppercase">
                      व्यवहार {idx + 1}
                    </span>
                    {cur.isInheritedGlobal && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-sm">
                        Global Default लागू
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-gray-900">{t.label}</h3>
                  <p className="text-[10px] text-gray-500">{t.desc}</p>
                </div>

                {/* Debit Ledger */}
                <div className="lg:col-span-4 space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                    <span className="text-rose-600 font-black">नावे खाते (Debit Ledger):</span>
                  </label>
                  <SearchableSelect
                    options={ledgerOptions}
                    value={cur.debitLedgerId}
                    onChange={(e) => handleLedgerChange(t.key, 'debitLedgerId', Number(e.target.value))}
                    placeholder={`- नावे लेजर निवडा (उदा. ${t.defaultDr}) -`}
                  />
                  <span className="text-[10px] text-gray-400">डीफॉल्ट: {t.defaultDr}</span>
                </div>

                {/* Credit Ledger */}
                <div className="lg:col-span-4 space-y-1">
                  <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                    <span className="text-emerald-700 font-black">जमा खाते (Credit Ledger):</span>
                  </label>
                  <SearchableSelect
                    options={ledgerOptions}
                    value={cur.creditLedgerId}
                    onChange={(e) => handleLedgerChange(t.key, 'creditLedgerId', Number(e.target.value))}
                    placeholder={`- जमा लेजर निवडा (उदा. ${t.defaultCr}) -`}
                  />
                  <span className="text-[10px] text-gray-400">डीफॉल्ट: {t.defaultCr}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Save Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || !canEditMapping || loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-xs font-bold shadow-xs transition disabled:opacity-50 bg-primary hover:opacity-95 text-white"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            बदल सेव्ह करा (Save Changes)
          </button>
        </div>
      </div>
    </div>
  );
}

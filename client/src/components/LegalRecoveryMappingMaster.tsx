import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Scale, Save, CheckCircle, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

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
  branchId: number;
  transactionType: string;
  typeLabel: string;
  description: string;
  debitLedgerId: number;
  creditLedgerId: number;
  isActive: boolean;
}

const TRANSACTION_TYPES: { key: string; label: string; defaultDr: string; defaultCr: string; desc: string }[] = [
  {
    key: 'NOTICE_FEE',
    label: '१. नोटीस टपाल व प्रशासकीय फी (Notice Fee)',
    defaultDr: 'कर्जदार खाते / येणे खर्च',
    defaultCr: 'नोटीस फी उत्पन्न / टपाल खर्च',
    desc: 'नोटीस १, २ व अंतिम नोटीस पाठवताना कर्जदारावर आकारण्यात येणारा खर्च'
  },
  {
    key: 'COURT_FEE',
    label: '२. कलम १०१ कोर्ट फी व शासकीय चलन (Court Fee)',
    defaultDr: 'कर्जदार खाते (Borrower Loan A/c)',
    defaultCr: 'रोख / बँक खाते (Cash/Bank)',
    desc: 'मा. निबंधकांकडे दावा दाखल करताना भरलेली कोर्ट फी व स्टॅम्प फी'
  },
  {
    key: 'ADVOCATE_FEE',
    label: '३. वकिली फी व कायदेशीर सल्ला (Advocate Fees)',
    defaultDr: 'कर्जदार खाते (Borrower Loan A/c)',
    defaultCr: 'रोख / बँक खाते (Cash/Bank)',
    desc: 'कोर्ट सुनावणी व दावा ड्राफ्टिंगसाठी वकिलांना अदा केलेली फी'
  },
  {
    key: 'NEWSPAPER_AD',
    label: '४. वर्तमानपत्र लिलाव जाहीरनामा खर्च (Newspaper Ad)',
    defaultDr: 'कर्जदार खाते (Borrower Loan A/c)',
    defaultCr: 'रोख / बँक खाते (Cash/Bank)',
    desc: 'मालमत्ता जप्ती व लिलावाच्या वर्तमानपत्र जाहिरातीचा खर्च'
  },
  {
    key: 'SRO_COMMISSION',
    label: '५. विशेष वसुली अधिकारी फी (SRO Commission)',
    defaultDr: 'कर्जदार खाते (Borrower Loan A/c)',
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
    defaultDr: 'कर्जदार खाते (Borrower Loan A/c)',
    defaultCr: 'दंडव्याज उत्पन्न खाते (Penal Interest Income)',
    desc: 'थकीत मुदतीवर आकारलेले अतिरिक्त दंडव्याज'
  }
];

export default function LegalRecoveryMappingMaster() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number>(1);
  const [mappings, setMappings] = useState<Record<string, MappingItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Dynamic Theme Hook
  const getInitialTheme = () => {
    return document.documentElement.getAttribute('data-theme') || 
           localStorage.getItem('app-theme') || 
           'blue';
  };

  const [appTheme, setAppTheme] = useState(getInitialTheme);

  useEffect(() => {
    const updateTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') || 
                      localStorage.getItem('app-theme') || 
                      'blue';
      setAppTheme(current);
    };

    window.addEventListener('storage', updateTheme);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTheme();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    return () => {
      window.removeEventListener('storage', updateTheme);
      observer.disconnect();
    };
  }, []);

  const getThemeConfig = () => {
    switch (appTheme) {
      case 'green':
        return {
          bannerGrad: 'from-emerald-950 via-[#0E8A5A] to-teal-900',
          btnPrimary: 'bg-[#0E8A5A] hover:bg-emerald-700 text-white',
          badgeText: 'text-emerald-800 bg-emerald-100'
        };
      case 'wine-red':
        return {
          bannerGrad: 'from-[#380413] via-[#880E4F] to-[#4c0519]',
          btnPrimary: 'bg-[#880E4F] hover:bg-rose-900 text-white',
          badgeText: 'text-rose-800 bg-rose-100'
        };
      case 'blue':
      default:
        return {
          bannerGrad: 'from-slate-950 via-[#005689] to-blue-900',
          btnPrimary: 'bg-[#005689] hover:bg-blue-800 text-white',
          badgeText: 'text-blue-800 bg-blue-100'
        };
    }
  };

  const theme = getThemeConfig();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedBranchId !== undefined) {
      loadMappingsForBranch(selectedBranchId);
    }
  }, [selectedBranchId, ledgers]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [branchRes, ledgerRes] = await Promise.all([
        axios.get('/api/Branches'),
        axios.get('/api/Ledgers')
      ]);

      if (branchRes.data) setBranches(branchRes.data);
      if (ledgerRes.data) setLedgers(ledgerRes.data);
    } catch (e) {
      console.error(e);
      setMessage({ text: 'डेटा लोड करताना त्रुटी आली.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadMappingsForBranch = async (bId: number) => {
    try {
      const res = await axios.get(`/api/LegalRecoveryMapping?branchId=${bId}`);
      let serverMappings: any[] = [];
      if (res.data) {
        serverMappings = res.data;
      }

      const mapObj: Record<string, MappingItem> = {};
      TRANSACTION_TYPES.forEach((t) => {
        const found = serverMappings.find((m: any) => m.transactionType === t.key);
        mapObj[t.key] = {
          mappingId: found?.mappingId,
          branchId: bId,
          transactionType: t.key,
          typeLabel: t.label,
          description: t.desc,
          debitLedgerId: found?.debitLedgerId || 0,
          creditLedgerId: found?.creditLedgerId || 0,
          isActive: found ? found.isActive : true
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
        [field]: val
      }
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const listToSave = Object.values(mappings).map((m) => ({
        mappingId: m.mappingId || 0,
        branchId: selectedBranchId,
        transactionType: m.transactionType,
        debitLedgerId: Number(m.debitLedgerId) || 0,
        creditLedgerId: Number(m.creditLedgerId) || 0,
        isActive: m.isActive
      }));

      const res = await axios.post('/api/LegalRecoveryMapping/bulk-save', listToSave);

      if (res.status === 200) {
        setMessage({ text: 'सर्व कायदेशीर वसुली लेजर मॅपिंग यशस्वीरीत्या सेव्ह झाले आहेत! (Mappings saved successfully)', type: 'success' });
        loadMappingsForBranch(selectedBranchId);
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
    <div className="p-3 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans space-y-3">
      {/* Top Banner */}
      <div className={`bg-gradient-to-r ${theme.bannerGrad} text-white p-4 rounded-xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3`}>
        <div>
          <div className="flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-amber-300" />
            <h1 className="text-base font-bold tracking-wide">कायदेशीर वसुली लेजर मॅपिंग (Legal Recovery Dynamic COA Mapping)</h1>
          </div>
          <p className="text-white/80 text-[11px] mt-0.5">
            सहकार कायदा कलम १०१ व ९१ कोर्ट फी, वकिली फी, नोटीस फी व लिलाव खर्चासाठी संस्थेचे डायनॅमिक लेजर्स मॅप करा. (Zero Hardcoding)
          </p>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 rounded-lg font-bold text-xs shadow transition disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          सर्व मॅपिंग सेव्ह करा (Save All)
        </button>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2.5 text-blue-900 text-xs">
        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">डायनॅमिक लेजर रचना माहिती: </span>
          येथे मॅप केलेले लेजर्स कोर्ट फी भरताना, वकील फी नोंदवताना किंवा नोटीस काढताना आपोआप <strong>व्हाउचर (Auto-Voucher)</strong> तयार करण्यासाठी वापरले जातील.
        </div>
      </div>

      {/* Branch Selector */}
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700">शाखा निवडा (Select Branch):</label>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-800 bg-white"
          >
            <option value={0}>सर्व शाखांसाठी डीफॉल्ट (Global Default - 0)</option>
            {branches.map((b) => (
              <option key={b.branchID} value={b.branchID}>
                {b.branchName} ({b.branchCode})
              </option>
            ))}
          </select>
        </div>
        <span className="text-[11px] text-gray-500 font-medium">
          एकूण ७ प्रकारच्या कायदेशीर व्यवहारांसाठी लेजर मॅपिंग उपलब्ध
        </span>
      </div>

      {/* Notification Message */}
      {message && (
        <div
          className={`p-3 rounded-lg border flex items-center gap-2 text-xs ${
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-gray-100/70 border-b border-gray-200">
          <h2 className="text-xs font-bold text-gray-800">कायदेशीर व्यवहार व लेजर कॉन्फिगरेशन</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {TRANSACTION_TYPES.map((t, idx) => {
            const cur = mappings[t.key] || {
              debitLedgerId: 0,
              creditLedgerId: 0,
              isActive: true
            };

            return (
              <div key={t.key} className="p-3.5 hover:bg-gray-50/80 transition grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                {/* Description */}
                <div className="lg:col-span-4 space-y-0.5">
                  <span className={`text-[10px] font-bold ${theme.badgeText} px-1.5 py-0.2 rounded uppercase`}>
                    व्यवहार {idx + 1}
                  </span>
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
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50 ${theme.btnPrimary}`}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            बदल सेव्ह करा (Save Changes)
          </button>
        </div>
      </div>
    </div>
  );
}

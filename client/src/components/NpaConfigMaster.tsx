import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, CheckCircle2, AlertCircle, Save, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NpaConfig {
  financialYear: string;
  concessionPeriodDays: number;
}

interface NpaProvisionSlab {
  npaProvisionSlabID: number;
  financialYear: string;
  category: string;
  securityType: string;
  overdueOrOutOfOrderMonthsFrom: number;
  overdueOrOutOfOrderMonthsTo: number;
  npaMonthsFrom: number;
  npaMonthsTo: number;
  minProvisionPercent: number;
}

interface Props {
  onBack?: () => void;
}

const FY_OPTIONS = ['2024-25', '2025-26', '2026-27', '2027-28'];

const getLocalTodayStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getBusinessDateStr = (rawDate?: string | null): string => {
  if (rawDate && typeof rawDate === 'string') {
    const clean = rawDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  return getLocalTodayStr();
};

const NpaConfigMaster: React.FC<Props> = ({ onBack }) => {
  const { user } = useAuth();
  const [selectedFy, setSelectedFy] = useState<string>('');
  const [config, setConfig] = useState<NpaConfig>({ financialYear: '2026-27', concessionPeriodDays: 180 });
  const [slabs, setSlabs] = useState<NpaProvisionSlab[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const loadSettings = async (fyParam?: string) => {
    setLoading(true);
    setError('');
    try {
      const query = fyParam ? `?financialYear=${encodeURIComponent(fyParam)}` : '';
      const [configRes, slabsRes] = await Promise.all([
        axios.get(`/api/npa/config${query}`),
        axios.get(`/api/npa/slabs${query}`),
      ]);
      setConfig(configRes.data);
      setSelectedFy(configRes.data.financialYear);
      setSlabs(slabsRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'NPA सेटिंग लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSlabPercentChange = (id: number, val: any) => {
    setSlabs((prev) =>
      prev.map((slab) => (slab.npaProvisionSlabID === id ? { ...slab, minProvisionPercent: val } : slab))
    );
  };

  const handleSaveAndRecalculate = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await axios.post('/api/npa/config', config);

      const processedSlabs = slabs.map((s) => ({
        ...s,
        minProvisionPercent: parseFloat(String(s.minProvisionPercent)) || 0,
      }));
      await axios.post('/api/npa/slabs', processedSlabs);

      const bizDate = getBusinessDateStr(user?.businessDate);
      await axios.post('/api/npa/run', {
        asOfDate: bizDate,
        triggeredBy: user?.username || 'Manager Settings Update',
      });

      setMessage(`✅ आर्थिक वर्ष ${config.financialYear} चे NPA निकष व स्लॅब जतन झाले आणि दि. ${bizDate} साठी NPA गणना अद्ययावत झाली!`);
    } catch (err: any) {
      setError(err.response?.data?.message || String(err.response?.data || 'सेटिंग्ज सेव्ह करताना त्रुटी आली.'));
    } finally {
      setSaving(false);
    }
  };

  const getCategoryMarathi = (cat: string) => {
    switch (cat) {
      case 'Standard':
        return 'नियमित (Standard)';
      case 'Sub-Standard':
        return 'दुय्यम / सब-स्टँडर्ड (Sub-Standard)';
      case 'Doubtful-1':
        return 'संशयास्पद-१ (Doubtful-1)';
      case 'Doubtful-2':
        return 'संशयास्पद-२ (Doubtful-2)';
      case 'Doubtful-3':
        return 'संशयास्पद-३ (Doubtful-3)';
      case 'Loss':
        return 'बुडीत / तोटा (Loss)';
      default:
        return cat;
    }
  };

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto bg-slate-50/70 min-h-[calc(100vh-3.15rem)] font-sans text-xs text-slate-800 space-y-2.5">
      {/* ERP Header Card */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Settings size={14} />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-primary">
              NPA तरतूद निकष व स्लॅब सेटिंग (NPA Provisioning Settings)
            </h1>
            <p className="text-[11px] text-slate-500">
              सहकार आयुक्त परिपत्रक व RBI नियमानुसार मुद्दल बाकीवरील BDDR स्लॅब व सवलत कालावधी (येणे व्याजावर स्वतंत्र १००% OIR लागू)
            </p>
          </div>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="h-7 px-2.5 bg-white hover:bg-primary/10 hover:text-primary hover:border-primary text-slate-700 border border-slate-300 rounded-sm text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
          >
            <ArrowLeft size={12} />
            <span>मागे (Back)</span>
          </button>
        )}
      </div>

      {message && (
        <div className="p-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-sm text-[11px] font-bold flex items-center gap-1.5">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm text-[11px] font-bold flex items-center gap-1.5">
          <AlertCircle size={14} className="text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Concession Days & Financial Year Card */}
      <div className="bg-white p-3 rounded-sm shadow-xs border border-slate-300 space-y-2">
        <h2 className="text-xs font-extrabold text-primary border-b border-slate-200 pb-1">
          १. आर्थिक वर्ष व NPA सवलत कालावधी (Concession Period Days)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">आर्थिक वर्ष निवडा (Financial Year)</label>
            <select
              value={selectedFy || config.financialYear}
              onChange={(e) => {
                const nextFy = e.target.value;
                setSelectedFy(nextFy);
                loadSettings(nextFy);
              }}
              className="w-full h-7 border border-slate-300 bg-white px-2 rounded-sm font-mono text-xs font-bold text-primary focus:outline-none focus:border-primary cursor-pointer"
            >
              {Array.from(new Set([...FY_OPTIONS, config.financialYear])).map((fy) => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              NPA सवलत मुदत (Concession Days)
            </label>
            <select
              value={config.concessionPeriodDays}
              onChange={(e) => setConfig({ ...config, concessionPeriodDays: parseInt(e.target.value, 10) })}
              className="w-full h-7 border border-slate-300 bg-white px-2 rounded-sm focus:outline-none focus:border-primary text-xs font-bold text-slate-900 cursor-pointer"
            >
              <option value={90}>90 दिवस (३ महिने — RBI Standard 90-Days Rule)</option>
              <option value={180}>180 दिवस (६ महिने — पतसंस्था सवलत नियम)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Slabs Table Card */}
      <div className="bg-white rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary overflow-hidden">
        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
          <h2 className="text-xs font-extrabold text-primary">
            २. वर्गवारीनुसार मुद्दल बाकीवरील BDDR तरतूद टक्केवारी (Provisioning Slabs — {config.financialYear})
          </h2>
          <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 font-bold px-2 py-0.5 rounded-sm">
            येणे व्याजासाठी स्वतंत्र १००% OIR आपोआप लागू
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px] leading-tight">
            <thead className="bg-slate-100 text-slate-800 border-b-2 border-primary/30 font-bold">
              <tr className="h-7">
                <th className="px-2.5 py-1 border-r border-slate-200 text-left">NPA वर्गवारी (Category)</th>
                <th className="px-2.5 py-1 border-r border-slate-200 text-center">तारण प्रकार (Security)</th>
                <th className="px-2.5 py-1 border-r border-slate-200 text-center">NPA कालावधी (महिने)</th>
                <th className="px-2.5 py-1 text-right">किमान BDDR तरतूद (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    NPA स्लॅब लोड होत आहेत...
                  </td>
                </tr>
              ) : (
                slabs.map((slab) => (
                  <tr key={slab.npaProvisionSlabID} className="h-7 hover:bg-primary/10 transition-colors">
                    <td className="px-2.5 py-1 border-r border-slate-200 font-bold text-slate-900">
                      {getCategoryMarathi(slab.category)}
                    </td>
                    <td className="px-2.5 py-1 border-r border-slate-200 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                          slab.securityType === 'Secured'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : slab.securityType === 'Unsecured'
                            ? 'bg-amber-50 text-amber-900 border border-amber-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {slab.securityType === 'Secured'
                          ? 'तारणी (Secured)'
                          : slab.securityType === 'Unsecured'
                          ? 'विनातारणी (Unsecured)'
                          : 'दोन्ही (Both)'}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 border-r border-slate-200 text-center font-mono text-slate-700">
                      {slab.category === 'Standard'
                        ? 'सवलत मुदतीच्या आत'
                        : slab.category === 'Loss'
                        ? 'प्रमाणित बुडीत'
                        : `${slab.npaMonthsFrom} ते ${slab.npaMonthsTo === 999 ? '४८+ (पुढे)' : slab.npaMonthsTo} महिने`}
                    </td>
                    <td className="px-2.5 py-1 text-right">
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={slab.minProvisionPercent}
                          onChange={(e) =>
                            handleSlabPercentChange(slab.npaProvisionSlabID, e.target.value === '' ? '' : e.target.value)
                          }
                          onFocus={(e) => e.target.select()}
                          className="w-20 h-6 border border-slate-300 px-2 text-right rounded-sm text-xs font-mono font-extrabold text-primary bg-white focus:outline-none focus:border-primary"
                        />
                        <span className="font-bold text-slate-600">%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Action */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveAndRecalculate}
          disabled={saving}
          className="h-8 bg-primary hover:opacity-90 text-white px-5 rounded-sm font-extrabold shadow-xs transition text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Save size={14} />
          <span>{saving ? 'जतन व मोजणी सुरू आहे...' : 'सेव्ह करा व NPA पुनर्गणना करा (Save & Recalculate)'}</span>
        </button>
      </div>
    </div>
  );
};

export default NpaConfigMaster;

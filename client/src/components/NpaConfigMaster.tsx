import React, { useState, useEffect } from 'react';
import axios from 'axios';

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

const NpaConfigMaster: React.FC<Props> = ({ onBack }) => {
  const [config, setConfig] = useState<NpaConfig>({ financialYear: '2026-27', concessionPeriodDays: 180 });
  const [slabs, setSlabs] = useState<NpaProvisionSlab[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const fetchNpaSettings = async () => {
      setLoading(true);
      setError('');
      try {
        const [configRes, slabsRes] = await Promise.all([
          axios.get('/api/npa/config'),
          axios.get('/api/npa/slabs')
        ]);

        if (isMounted) {
          setConfig(configRes.data);
          setSlabs(slabsRes.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.message || 'NPA सेटिंग लोड करताना त्रुटी आली.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchNpaSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSlabPercentChange = (id: number, val: any) => {
    setSlabs(prev =>
      prev.map(slab =>
        slab.npaProvisionSlabID === id ? { ...slab, minProvisionPercent: val } : slab
      )
    );
  };

  const handleSaveAndRecalculate = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      // 1. Save Config
      await axios.post('/api/npa/config', config);

      // 2. Save Slabs
      const processedSlabs = slabs.map(s => ({
        ...s,
        minProvisionPercent: parseFloat(String(s.minProvisionPercent)) || 0
      }));
      await axios.post('/api/npa/slabs', processedSlabs);

      // 3. Trigger NPA Classification Run
      await axios.post('/api/npa/run', { triggeredBy: 'Manager Settings Update' });

      setMessage('✅ NPA तरतूद निकष व स्लॅब यशस्वीरित्या सेव्ह झाले आणि NPA गणना अपडेट झाली!');
    } catch (err: any) {
      setError(err.response?.data || 'सेटिंग्ज सेव्ह करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryMarathi = (cat: string) => {
    switch (cat) {
      case 'Standard': return 'नियमित (Standard)';
      case 'Sub-Standard': return 'दुय्यम (Sub-Standard)';
      case 'Doubtful-1': return 'संशयास्पद-१ (Doubtful-1)';
      case 'Doubtful-2': return 'संशयास्पद-२ (Doubtful-2)';
      case 'Doubtful-3': return 'संशयास्पद-३ (Doubtful-3)';
      case 'Loss': return 'तोटा (Loss)';
      default: return cat;
    }
  };

  return (
    <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
      {/* Header */}
      <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1">
        <div>
          <h1 className="text-lg font-bold text-gray-800">
            NPA तरतूद निकष व स्लॅब सेटिंग (NPA Provisioning Settings)
          </h1>
          <p className="text-xs text-gray-500">
            RBI व सहकार कायद्यानुसार NPA सवलत कालावधी व वर्गवारीनुसार तरतूद टक्केवारी (Provision Slabs) कॉन्फिगर करा
          </p>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-sm text-xs font-medium shadow-sm transition-colors"
          >
            ← परत जा (Back to Dashboard)
          </button>
        )}
      </div>

      {message && (
        <div className="mb-2 p-2 bg-green-100 border border-green-300 text-green-800 rounded-sm text-xs font-medium">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-2 p-2 bg-red-100 border border-red-300 text-red-800 rounded-sm text-xs font-medium">
          {error}
        </div>
      )}

      {/* Concession Days Setting */}
      <div className="bg-white p-2 rounded-sm shadow-sm border border-gray-200 mb-3">
        <h2 className="text-xs font-bold text-primary mb-1 border-b pb-0.5">
          १. NPA सवलत कालावधी (Concession Period Days)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end pt-1">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">
              आर्थिक वर्ष (Financial Year)
            </label>
            <input
              type="text"
              readOnly
              value={config.financialYear}
              className="w-full border border-gray-300 bg-gray-100 px-2 py-0.5 rounded-sm font-mono text-xs font-bold text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-0.5">
              NPA सवलत मुदत (Concession Days) - दिवस
            </label>
            <select
              value={config.concessionPeriodDays}
              onChange={(e) => setConfig({ ...config, concessionPeriodDays: parseInt(e.target.value) })}
              className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
            >
              <option value={90}>90 दिवस (Standard RBI 90-Days Rule)</option>
              <option value={180}>180 दिवस (180-Days Co-op Society Relaxation Rule)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Slabs Table */}
      <div className="bg-white p-2 rounded-sm shadow-sm border border-gray-200 mb-3">
        <div className="flex justify-between items-center mb-1 border-b pb-0.5">
          <h2 className="text-xs font-bold text-primary">
            २. वर्गवारीनुसार NPA तरतूद टक्केवारी (Provisioning Slabs Table)
          </h2>
          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-sm">
            RBI & Co-Op Bank Standard Rates
          </span>
        </div>

        <div className="overflow-x-auto mt-1">
          <table className="min-w-full divide-y divide-gray-200 text-xs text-center">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">NPA वर्गवारी (Category)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-left">तारण प्रकार (Security)</th>
                <th className="px-2 py-1.5 border-r border-blue-400 font-medium text-center">थकीत कालावधी (महिने)</th>
                <th className="px-2 py-1.5 font-medium text-right">किमान तरतूद (%) Provision Percent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                    NPA स्लॅब लोड होत आहेत...
                  </td>
                </tr>
              ) : (
                slabs.map((slab) => (
                  <tr
                    key={slab.npaProvisionSlabID}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-2 py-1.5 text-left font-semibold text-gray-800">
                      {getCategoryMarathi(slab.category)}
                    </td>
                    <td className="px-2 py-1.5 text-left">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        slab.securityType === 'Secured'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : slab.securityType === 'Unsecured'
                          ? 'bg-orange-100 text-orange-800 border border-orange-200'
                          : 'bg-gray-100 text-gray-800 border border-gray-200'
                      }`}>
                        {slab.securityType}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs font-mono text-gray-600">
                      {slab.overdueOrOutOfOrderMonthsFrom} - {slab.overdueOrOutOfOrderMonthsTo === 999 ? 'अनंत (999)' : slab.overdueOrOutOfOrderMonthsTo} महिने
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={slab.minProvisionPercent}
                          onChange={(e) => handleSlabPercentChange(slab.npaProvisionSlabID, e.target.value === '' ? '' : e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="w-20 border border-gray-300 px-2 py-0.5 text-right rounded-sm text-xs font-bold text-blue-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="font-bold text-gray-600 text-xs">%</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex justify-end items-center gap-3">
        <button
          onClick={handleSaveAndRecalculate}
          disabled={saving}
          className="bg-primary hover:bg-[#004a75] text-white px-6 py-1.5 rounded-sm font-semibold shadow-sm transition-colors text-xs flex items-center space-x-2 disabled:opacity-50"
        >
          {saving ? (
            <span>प्रक्रिया सुरू आहे... (Processing...)</span>
          ) : (
            <>
              <span>💾 सेव्ह करा व NPA recalculate करा (Save & Recalculate NPA)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default NpaConfigMaster;

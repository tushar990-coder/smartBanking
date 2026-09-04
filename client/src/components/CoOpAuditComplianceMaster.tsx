import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import SearchableSelect from './SearchableSelect';

interface AuditCategory {
  code: string;
  name: string;
  group: string;
}

interface SavedMapping {
  auditLedgerMappingID: number;
  categoryCode: string;
  categoryName: string;
  ledgerID: number;
  ledgerName: string;
}

interface LedgerOption {
  ledgerID: number;
  ledgerName: string;
  groupName: string;
  openingBalance: number;
  openingBalanceType: string;
}

export default function CoOpAuditComplianceMaster() {
  const [activeSubTab, setActiveSubTab] = useState<'mapping' | 'scorecard' | 'owned-funds' | 'cd-ratio' | 'crr-slr' | 'crar' | 'print'>('mapping');
  const [loading, setLoading] = useState(true);

  // Mapping State
  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [savedMappings, setSavedMappings] = useState<Record<string, number>>({});
  const [allLedgers, setAllLedgers] = useState<LedgerOption[]>([]);
  const [mappingSearchTerm, setMappingSearchTerm] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Ratio Data States
  const [ownedFundsData, setOwnedFundsData] = useState<any>(null);
  const [cdRatioData, setCdRatioData] = useState<any>(null);
  const [crrSlrData, setCrrSlrData] = useState<any>(null);
  const [crarData, setCrarData] = useState<any>(null);
  const [scorecardData, setScorecardData] = useState<any>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMappings(),
        fetchOwnedFunds(),
        fetchCdRatio(),
        fetchCrrSlr(),
        fetchCrar(),
        fetchScorecard()
      ]);
    } catch (err) {
      console.error('Error loading audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMappings = async () => {
    try {
      const res = await axios.get('/api/AuditCompliance/Mappings');
      setCategories(res.data.categories || []);
      setAllLedgers(res.data.allLedgers || []);

      const mappingMap: Record<string, number> = {};
      (res.data.savedMappings || []).forEach((m: SavedMapping) => {
        mappingMap[m.categoryCode] = m.ledgerID;
      });
      setSavedMappings(mappingMap);
    } catch (err) {
      console.error('Error fetching mappings:', err);
    }
  };

  const fetchOwnedFunds = async () => {
    try {
      const res = await axios.get('/api/AuditCompliance/OwnedFunds');
      setOwnedFundsData(res.data);
    } catch (err) {
      console.error('Error fetching owned funds:', err);
    }
  };

  const fetchCdRatio = async () => {
    try {
      const res = await axios.get('/api/AuditCompliance/CdRatio');
      setCdRatioData(res.data);
    } catch (err) {
      console.error('Error fetching CD ratio:', err);
    }
  };

  const fetchCrrSlr = async () => {
    try {
      const res = await axios.get('/api/AuditCompliance/CrrSlr');
      setCrrSlrData(res.data);
    } catch (err) {
      console.error('Error fetching CRR SLR:', err);
    }
  };

  const fetchCrar = async () => {
    try {
      const res = await axios.get('/api/AuditCompliance/Crar');
      setCrarData(res.data);
    } catch (err) {
      console.error('Error fetching CRAR:', err);
    }
  };

  const fetchScorecard = async () => {
    try {
      const res = await axios.get('/api/AuditCompliance/AuditRatingScore');
      setScorecardData(res.data);
    } catch (err) {
      console.error('Error fetching scorecard:', err);
    }
  };

  const handleMappingChange = (categoryCode: string, ledgerId: number) => {
    setSavedMappings(prev => ({
      ...prev,
      [categoryCode]: ledgerId
    }));
  };

  const handleSaveMappings = async () => {
    try {
      const payload = Object.keys(savedMappings).map(catCode => {
        const catObj = categories.find(c => c.code === catCode);
        return {
          categoryCode: catCode,
          categoryName: catObj?.name || catCode,
          ledgerID: savedMappings[catCode]
        };
      });

      await axios.post('/api/AuditCompliance/Mappings', payload);
      setSaveSuccess('✅ लेजर मॅपिंग यशस्वीरीत्या सेव्ह झाले! गुणोत्तरे अपडेट होत आहेत...');
      setTimeout(() => setSaveSuccess(''), 4000);
      loadAllData();
    } catch (err) {
      console.error('Error saving mappings:', err);
      alert('माहिती सेव्ह करताना त्रुटी आली.');
    }
  };

  const handleAutoSuggest = async () => {
    try {
      let res;
      try {
        res = await axios.get('/api/AuditCompliance/AutoSuggestMappings');
      } catch {
        res = await axios.post('/api/AuditCompliance/AutoSuggestMappings');
      }
      const suggested: Record<string, number> = { ...savedMappings };
      (res.data || []).forEach((item: any) => {
        suggested[item.categoryCode] = item.ledgerID;
      });
      setSavedMappings(suggested);
      setSaveSuccess('✨ ऑटो-मॅपिंग सुचवण्यात आले आहे. कृपया तपासून सेव्ह करा.');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      console.error('Error auto-suggesting mappings:', err);
    }
  };

  const ledgerOptions = useMemo(() => [
    { value: 0, label: '-- निवडा (Select Ledger) --' },
    ...allLedgers.map(l => ({
      value: l.ledgerID,
      label: `${l.ledgerName} (${l.groupName}) - ₹${(l.openingBalance || 0).toLocaleString('en-IN')}`
    }))
  ], [allLedgers]);

  const filteredCategories = useMemo(() => {
    if (!mappingSearchTerm.trim()) return categories;
    const term = mappingSearchTerm.toLowerCase();
    return categories.filter(c => 
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      c.group.toLowerCase().includes(term)
    );
  }, [categories, mappingSearchTerm]);

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="w-full min-h-full font-sans relative overflow-y-auto bg-slate-50 pb-16">
      {/* Subtle Background Blurs */}
      <div className="absolute top-[-5%] left-[-5%] w-[35rem] h-[35rem] bg-indigo-100/40 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-5%] w-[35rem] h-[35rem] bg-emerald-100/40 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="p-4 md:p-6 max-w-7xl mx-auto relative z-10 space-y-6">

        {/* Header Banner */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200 shadow-xs">
              <span className="text-2xl">🏛️</span>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <span>सहकार ऑडीट व वैधानिक गुणोत्तर केंद्र</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                  विशेष लेखापरीक्षक मार्गदर्शक नमुना
                </span>
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                नागरी व बिगरशेती पतसंस्थांसाठी स्वनिधी, C.D. रेशो, CRR, SLR, CRAR व ६००-गुणांची ऑडीटर वर्गवारी प्रणाली
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveSubTab('print')}
              className="px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>🖨️ अधिकृत ऑडीट रिपोर्ट प्रिंट</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setActiveSubTab('mapping')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'mapping' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>⚙️ १. ऑडीट लेजर मॅपिंग</span>
          </button>

          <button
            onClick={() => setActiveSubTab('scorecard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'scorecard' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🏆 २. ऑडीट ग्रेड व डॅशबोर्ड</span>
          </button>

          <button
            onClick={() => setActiveSubTab('owned-funds')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'owned-funds' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>💼 ३. स्वनिधी व कर्ज मर्यादा</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cd-ratio')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'cd-ratio' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📊 ४. C.D. रेशो व स्प्रेड</span>
          </button>

          <button
            onClick={() => setActiveSubTab('crr-slr')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'crr-slr' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>💧 ५. CRR व SLR तरलता</span>
          </button>

          <button
            onClick={() => setActiveSubTab('crar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === 'crar' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🛡️ ६. CRAR भांडवल पर्याप्तता</span>
          </button>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold animate-fade-in shadow-2xs">
            {saveSuccess}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* TAB 1: LEDGER MAPPING MASTER */}
            {activeSubTab === 'mapping' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <span>⚙️ वैधानिक ऑडीट लेजर मॅपिंग मास्टर्स</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      प्रत्येक पतसंस्थेचे लेजर अनुक्रम बदलू शकत असल्याने, ऑडीट गुणोत्तरांसाठी संस्थेचे लेजर हेड निवडून मॅप करा.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <input
                      type="text"
                      placeholder="🔍 ऑडीट हेड शोधा..."
                      value={mappingSearchTerm}
                      onChange={(e) => setMappingSearchTerm(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 w-full sm:w-48 bg-slate-50"
                    />
                    <button
                      onClick={handleAutoSuggest}
                      className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>✨ Auto Detect</span>
                    </button>
                    <button
                      onClick={handleSaveMappings}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>💾 Save Mappings</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 border-r border-slate-200 w-12 text-center">अ.क्र.</th>
                        <th className="px-4 py-3 border-r border-slate-200 w-1/3">मानक ऑडीट हेड / वर्गवारी</th>
                        <th className="px-4 py-3 border-r border-slate-200 w-36">विभाग (Group)</th>
                        <th className="px-4 py-3">पतसंस्थेचे संबंधित General Ledger (Search & Select)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-medium">
                      {filteredCategories.map((cat, idx) => {
                        const currentLedgerId = savedMappings[cat.code] || 0;
                        return (
                          <tr key={cat.code} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 border-r border-slate-200 text-center font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 border-r border-slate-200 font-bold text-slate-800">
                              {cat.name}
                              <div className="text-[10px] font-mono text-slate-400 font-normal">Code: {cat.code}</div>
                            </td>
                            <td className="px-4 py-3 border-r border-slate-200">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {cat.group}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <SearchableSelect
                                options={ledgerOptions}
                                value={currentLedgerId}
                                onChange={(e) => handleMappingChange(cat.code, parseInt(String(e.target.value)) || 0)}
                                placeholder="-- लेजर शोधा किंवा निवडा (Search Ledger) --"
                                className="w-full"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button
                    onClick={handleSaveMappings}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    💾 सर्व लेजर मॅपिंग सेव्ह करा
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: SCORECARD & GRADE */}
            {activeSubTab === 'scorecard' && scorecardData && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="space-y-2 text-center md:text-left">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">विशेष लेखापरीक्षक ऑडीट वर्गवारी रेटिंग</span>
                    <h2 className="text-2xl font-black text-slate-800">
                      संस्थेचे एकूण ऑडीट गुण: <span className="text-indigo-600">{scorecardData.finalScore} / १००</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold">
                      ६००-गुणांच्या ६ स्तंभांवर आधारित व पेनल्टी गुण वजा करून निश्चित केलेली अंतिम वर्गवारी
                    </p>
                  </div>

                  <div className={`p-6 rounded-2xl border-2 text-center shadow-sm min-w-56 ${scorecardData.badgeBg}`}>
                    <span className="text-xs uppercase font-extrabold tracking-wider block">प्राप्त ऑडीट वर्ग</span>
                    <span className="text-5xl font-black block my-1">{scorecardData.auditGrade}</span>
                    <span className="text-xs font-bold block">{scorecardData.auditClassText}</span>
                  </div>
                </div>

                {/* 6 Pillars Scores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <p className="text-xs font-bold text-slate-500">१. भाग भांडवल पर्याप्तता (Capital)</p>
                    <p className="text-xl font-extrabold text-indigo-700">{scorecardData.capitalAdequacyScore} / १०० <span className="text-xs font-normal text-slate-500">(वेटेज: १५%)</span></p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <p className="text-xs font-bold text-slate-500">२. जिंदगीची गुणवत्ता व NPA</p>
                    <p className="text-xl font-extrabold text-emerald-700">{scorecardData.assetQualityScore} / १०० <span className="text-xs font-normal text-slate-500">(वेटेज: २५%)</span></p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <p className="text-xs font-bold text-slate-500">३. व्यवस्थापन व प्रशिक्षण</p>
                    <p className="text-xl font-extrabold text-amber-700">{scorecardData.managementScore} / १०० <span className="text-xs font-normal text-slate-500">(वेटेज: १५%)</span></p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <p className="text-xs font-bold text-slate-500">४. उत्पन्न व नफा क्षमता</p>
                    <p className="text-xl font-extrabold text-blue-700">{scorecardData.earningsScore} / १०० <span className="text-xs font-normal text-slate-500">(वेटेज: २०%)</span></p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <p className="text-xs font-bold text-slate-500">५. तरलता व रोखता (Liquidity)</p>
                    <p className="text-xl font-extrabold text-purple-700">{scorecardData.liquidityScore} / १०० <span className="text-xs font-normal text-slate-500">(वेटेज: १५%)</span></p>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                    <p className="text-xs font-bold text-slate-500">६. कार्यपद्धती व संगणकीकरण</p>
                    <p className="text-xl font-extrabold text-teal-700">{scorecardData.controlsScore} / १०० <span className="text-xs font-normal text-slate-500">(वेटेज: १०%)</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: OWNED FUNDS */}
            {activeSubTab === 'owned-funds' && ownedFundsData && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">१. स्वनिधी (Net Owned Funds / Net Worth) परिगणना पत्रक</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    पोटनियम व कलम १४४-२२ अ (क) नुसार पतसंस्थेचे निव्वळ स्वनिधी व कमाल कर्ज मर्यादा
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                      <thead className="bg-slate-100 font-bold text-slate-700">
                        <tr>
                          <th className="p-3">तपशील</th>
                          <th className="p-3 text-right">रक्कम (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white font-medium">
                        <tr>
                          <td className="p-3">अ. वसूल भाग भांडवल + शेअर्स अनामत</td>
                          <td className="p-3 text-right font-bold">₹{ownedFundsData.totalPartA?.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr>
                          <td className="p-3">ब. वैधानिक व इतर राखीव निधी</td>
                          <td className="p-3 text-right font-bold">₹{ownedFundsData.totalPartB?.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="bg-rose-50/50 text-rose-800">
                          <td className="p-3">क. वजा: संचित तोटा व न केलेल्या तरतुदी</td>
                          <td className="p-3 text-right font-bold">- ₹{ownedFundsData.totalPartC?.toLocaleString('en-IN')}</td>
                        </tr>
                        <tr className="bg-emerald-100 text-emerald-900 font-black text-sm">
                          <td className="p-3">एकूण निव्वळ स्वनिधी (अ + ब - क)</td>
                          <td className="p-3 text-right">₹{ownedFundsData.netOwnedFunds?.toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">वैधानिक कर्ज मर्यादा (Exposure Limits)</h4>
                    <div className="space-y-3">
                      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">वैयक्तिक सभासद कमाल कर्ज मर्यादा (१५% स्वनिधी)</span>
                        <span className="text-sm font-extrabold text-indigo-700">₹{ownedFundsData.individualLoanLimit15Percent?.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">कुटुंब / ग्रुप कमाल कर्ज मर्यादा (२०% स्वनिधी)</span>
                        <span className="text-sm font-extrabold text-indigo-700">₹{ownedFundsData.groupLoanLimit20Percent?.toLocaleString('en-IN')}</span>
                      </div>

                      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-700">कलम ४३ बाहेरील कर्ज उभारणी मर्यादा (१० पट)</span>
                        <span className="text-sm font-extrabold text-indigo-700">₹{ownedFundsData.section43MaxBorrowingLimit?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CD RATIO & SPREAD */}
            {activeSubTab === 'cd-ratio' && cdRatioData && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">२. C.D. रेशो (Credit Deposit Ratio) व लिक्विडिटी विश्लेषण</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    निबंधक परिपत्रकानुसार आदर्श C.D. रेशो ६५% ते ७०% दरम्यान असणे आवश्यक आहे.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">एकूण कर्जे</span>
                    <p className="text-xl font-extrabold text-slate-800">₹{cdRatioData.totalLoans?.toLocaleString('en-IN')}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-1">
                    <span className="text-xs font-bold text-slate-500 uppercase">एकूण ठेवी</span>
                    <p className="text-xl font-extrabold text-slate-800">₹{cdRatioData.totalDeposits?.toLocaleString('en-IN')}</p>
                  </div>

                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 text-center space-y-1">
                    <span className="text-xs font-bold text-indigo-800 uppercase">C.D. रेशो (प्रमाण)</span>
                    <p className="text-2xl font-black text-indigo-700">{cdRatioData.cdRatioPercent}%</p>
                    <span className="text-[11px] font-bold text-slate-600 block">{cdRatioData.statusText}</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-700">💡 C.D. रेशो मार्गदर्शन सूचना:</h4>
                  <ul className="list-disc pl-5 text-slate-600 space-y-1">
                    <li>यदि C.D. रेशो <strong>७०% पेक्षा जास्त</strong> असेल तर अति-उचल (Over-trading) होऊन लिक्विडिटीचा धोका निर्माण होतो.</li>
                    <li>यदि C.D. रेशो <strong>६५% पेक्षा कमी</strong> असेल तर निधी विनावापर (Under-trading) राहून उत्पन्न घटते.</li>
                    <li><strong>CASA ठेवी प्रमाण:</strong> {cdRatioData.casaPercent}% (आदर्श प्रमाण: ४०% ते ६०%).</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 5: CRR & SLR */}
            {activeSubTab === 'crr-slr' && crrSlrData && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">३. C.R.R. (रोख राखीव) व S.L.R. (वैधानिक तरलता) कम्प्लायन्स</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    कलम १४४-९अ व १४४-१०अ नुसार रोखता व बँक गुंतवणुकीचे वैधानिक प्रमाण
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* CRR Card */}
                  <div className={`p-5 rounded-xl border-2 space-y-3 ${
                    crrSlrData.isCrrCompliant ? 'bg-emerald-50/50 border-emerald-300' : 'bg-rose-50/50 border-rose-300'
                  }`}>
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-sm text-slate-800">C.R.R. (रोख राखीव निधी)</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        crrSlrData.isCrrCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {crrSlrData.isCrrCompliant ? '🟢 पूर्ण (Min 2%)' : '🔴 तुटवडा'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>एकूण ठेवी:</span><span className="font-bold">₹{crrSlrData.totalDeposits?.toLocaleString('en-IN')}</span></div>
                      <div className="flex justify-between"><span>आवश्यक २% CRR:</span><span className="font-bold">₹{crrSlrData.requiredCrr2Percent?.toLocaleString('en-IN')}</span></div>
                      <div className="flex justify-between"><span>प्रत्यक्ष उपलब्ध CRR:</span><span className="font-extrabold text-indigo-700">₹{crrSlrData.actualCrrAmount?.toLocaleString('en-IN')} ({crrSlrData.actualCrrPercent}%)</span></div>
                    </div>
                  </div>

                  {/* SLR Card */}
                  <div className={`p-5 rounded-xl border-2 space-y-3 ${
                    crrSlrData.isSlrCompliant ? 'bg-emerald-50/50 border-emerald-300' : 'bg-rose-50/50 border-rose-300'
                  }`}>
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-sm text-slate-800">S.L.R. (वैधानिक तरलता निधी)</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        crrSlrData.isSlrCompliant ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {crrSlrData.isSlrCompliant ? '🟢 पूर्ण (Min 25%)' : '🔴 तुटवडा'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>एकूण ठेवी:</span><span className="font-bold">₹{crrSlrData.totalDeposits?.toLocaleString('en-IN')}</span></div>
                      <div className="flex justify-between"><span>आवश्यक २५% SLR:</span><span className="font-bold">₹{crrSlrData.requiredSlr25Percent?.toLocaleString('en-IN')}</span></div>
                      <div className="flex justify-between"><span>प्रत्यक्ष उपलब्ध SLR:</span><span className="font-extrabold text-indigo-700">₹{crrSlrData.actualSlrAmount?.toLocaleString('en-IN')} ({crrSlrData.actualSlrPercent}%)</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: CRAR */}
            {activeSubTab === 'crar' && crarData && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">४. CRAR (भांडवल पर्याप्तता प्रमाण) व Risk Weighted Assets</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    भारतीय रिझर्व्ह बँक व सहकार निबंधक नियमानुसार पतसंस्थेचे किमान ९% CRAR असणे अनिवार्य आहे.
                  </p>
                </div>

                <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200 flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-indigo-800 uppercase">प्राप्त CRAR (Capital Adequacy Ratio)</span>
                    <p className="text-3xl font-black text-indigo-700">{crarData.crarPercent}%</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    crarData.isCrarCompliant ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {crarData.isCrarCompliant ? '🟢 वैधानिक निकष पूर्ण (>= 9%)' : '🔴 अपुरे भांडवल (< 9%)'}
                  </span>
                </div>
              </div>
            )}

            {/* TAB 7: PRINTABLE REPORT */}
            {activeSubTab === 'print' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div className="flex justify-between items-center border-b pb-4">
                  <h3 className="text-sm font-extrabold text-slate-800">🖨️ अधिकृत लेखापरीक्षण वर्गवारी रिपोर्ट (Official Audit Scorecard)</h3>
                  <button
                    onClick={triggerPrint}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                  >
                    🖨️ प्रिंट काढा (Print Scorecard)
                  </button>
                </div>

                <div className="print-area p-8 border rounded-xl bg-white space-y-6 text-black">
                  <div className="text-center border-b-2 border-slate-800 pb-4">
                    <h2 className="text-xl font-black uppercase">प्राथमिक शिक्षक सहकारी पतसंस्था मर्यादित</h2>
                    <p className="text-xs font-bold text-slate-700 mt-1">
                      विशेष लेखापरीक्षक वर्ग-१ (सहकारी संस्था) मार्गदर्शक नियमावलीनुसार ऑडीट रिपोर्ट
                    </p>
                  </div>

                  <div className="flex justify-between text-xs font-semibold">
                    <span>तारीख: {new Date().toLocaleDateString('en-GB')}</span>
                    <span>ऑडीट वर्ग: <strong>{scorecardData?.auditGrade}</strong> ({scorecardData?.auditClassText})</span>
                  </div>

                  <div className="border border-slate-400 rounded p-4 space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1 font-bold"><span>अंतिम गुण:</span><span>{scorecardData?.finalScore} / १००</span></div>
                    <div className="flex justify-between border-b pb-1"><span>C.D. रेशो:</span><span>{cdRatioData?.cdRatioPercent}%</span></div>
                    <div className="flex justify-between border-b pb-1"><span>CRR प्रमाण:</span><span>{crrSlrData?.actualCrrPercent}%</span></div>
                    <div className="flex justify-between"><span>SLR प्रमाण:</span><span>{crrSlrData?.actualSlrPercent}%</span></div>
                  </div>

                  <div className="flex justify-between items-end pt-12 text-xs font-bold">
                    <div className="text-center">
                      <p>_______________________</p>
                      <p className="mt-1">मुख्य कार्यकारी अधिकारी / व्यवस्थापक</p>
                    </div>
                    <div className="text-center">
                      <p>_______________________</p>
                      <p className="mt-1">मा. विशेष लेखापरीक्षक / वैधानिक लेखापरीक्षक</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

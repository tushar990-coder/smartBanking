import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface NpaDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

const NpaDashboard: React.FC<NpaDashboardProps> = ({ onNavigate }) => {
  const API_URL = '/api/Npa';
  const [statement, setStatement] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runDate, setRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [runningBatch, setRunningBatch] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = async (isMounted = true) => {
    try {
      if (isMounted) setLoading(true);
      const [stmtRes, runsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/statement`),
        axios.get(`${API_URL}/runs`)
      ]);
      
      if (isMounted) {
        if (stmtRes.status === 'fulfilled' && stmtRes.value?.data) {
          setStatement(stmtRes.value.data);
        }
        if (runsRes.status === 'fulfilled' && runsRes.value?.data) {
          setRuns(Array.isArray(runsRes.value.data) ? runsRes.value.data : []);
        }
      }
    } catch (err) {
      if (isMounted) {
        console.error(err);
        setMessage('माहिती लोड करताना त्रुटी आली. (Error loading data.)');
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchData(isMounted);
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRunBatch = async () => {
    try {
      setRunningBatch(true);
      setMessage('एन.पी.ए. गणना प्रक्रिया चालू आहे... (NPA Calculation in progress...)');
      await axios.post(`${API_URL}/run`, { asOfDate: runDate, triggeredBy: 'Manager' });
      setMessage('बॅच यशस्वीरित्या पूर्ण झाली! (Batch completed successfully!)');
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage('बॅच चालवताना त्रुटी आली. (Error running batch.)');
    } finally {
      setRunningBatch(false);
    }
  };

  if (loading && !statement) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 text-[11px] font-sans">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-xs text-gray-600 font-medium">माहिती लोड होत आहे... (Loading NPA data...)</p>
        </div>
      </div>
    );
  }

  // Compliance Flags
  const isGrossNpaViolated = statement ? statement.grossNpaPercent > 10 : false;
  const isNetNpaViolated = statement ? statement.netNpaPercent > 5 : false;

  return (
    <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans">
      {/* Top Title Bar */}
      <div className="text-xs font-bold text-primary border-b border-gray-400 pb-1 mb-2 flex justify-between items-center">
        <div>
          <span>एन.पी.ए. व्यवस्थापन डॅशबोर्ड (NPA Dashboard)</span>
          <span className="text-[10px] text-gray-500 font-normal ml-2">(महाराष्ट्र सहकारी आयुक्त परिपत्रक २०२४ नियमांनुसार)</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            className="px-2 py-0.5 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-white"
          />
          <button
            onClick={() => onNavigate && onNavigate('npa-config')}
            className="px-3 py-1 rounded-sm text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white shadow-sm transition-colors flex items-center gap-1"
          >
            ⚙️ NPA तरतूद निकष व स्लॅब सेटिंग
          </button>
          <button
            onClick={handleRunBatch}
            disabled={runningBatch}
            className={`px-3 py-1 rounded-sm text-xs font-bold text-white shadow-sm transition-colors ${
              runningBatch ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-[#004a75]'
            }`}
          >
            {runningBatch ? 'प्रक्रिया चालू...' : '⚡ एन.पी.ए. गणना करा (Run Batch)'}
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-sm text-[11px] font-medium flex justify-between items-center mb-2">
          <span>ℹ️ {message}</span>
          <button onClick={() => setMessage('')} className="text-blue-600 hover:text-blue-800 font-bold">✕</button>
        </div>
      )}

      {(isGrossNpaViolated || isNetNpaViolated) && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-1.5 rounded-sm text-[11px] font-medium flex flex-col gap-0.5 mb-2">
          <div className="font-bold flex items-center text-red-700">
            <span className="mr-1.5">⚠️</span> नियामक मर्यादांचे उल्लंघन (Regulatory Threshold Breach):
          </div>
          {isGrossNpaViolated && <div>• एकूण एन.पी.ए. प्रमाण (Gross NPA) नियामक कमाल मर्यादा १०% पेक्षा जास्त आहे.</div>}
          {isNetNpaViolated && <div>• निव्वळ एन.पी.ए. प्रमाण (Net NPA) नियामक कमाल मर्यादा ५% पेक्षा जास्त आहे.</div>}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-sm">
          <div className="text-[10px] font-bold text-gray-500 uppercase">एकूण कर्ज वाटप (Gross Advances)</div>
          <div className="text-base font-black text-gray-900 mt-1">₹ {statement?.grossAdvances?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'} <span className="text-[10px] font-normal text-gray-500">लाख</span></div>
        </div>

        <div className={`bg-white p-2.5 rounded-sm border shadow-sm ${isGrossNpaViolated ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}>
          <div className="text-[10px] font-bold text-gray-500 uppercase">एकूण एन.पी.ए. (Gross NPA)</div>
          <div className={`text-base font-black mt-1 ${isGrossNpaViolated ? 'text-red-700' : 'text-gray-900'}`}>
            ₹ {statement?.grossNpa?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'} <span className="text-[10px] font-normal text-gray-500">लाख</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] border-t border-gray-100 pt-1">
            <span className="text-gray-500">Gross NPA %:</span>
            <span className={`font-bold ${isGrossNpaViolated ? 'text-red-600' : 'text-gray-700'}`}>{statement?.grossNpaPercent || 0}%</span>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-sm">
          <div className="text-[10px] font-bold text-gray-500 uppercase">निव्वळ कर्ज (Net Advances)</div>
          <div className="text-base font-black text-gray-900 mt-1">₹ {statement?.netAdvances?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'} <span className="text-[10px] font-normal text-gray-500">लाख</span></div>
        </div>

        <div className={`bg-white p-2.5 rounded-sm border shadow-sm ${isNetNpaViolated ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}>
          <div className="text-[10px] font-bold text-gray-500 uppercase">निव्वळ एन.पी.ए. (Net NPA)</div>
          <div className={`text-base font-black mt-1 ${isNetNpaViolated ? 'text-red-700' : 'text-gray-900'}`}>
            ₹ {statement?.netNpa?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'} <span className="text-[10px] font-normal text-gray-500">लाख</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] border-t border-gray-100 pt-1">
            <span className="text-gray-500">Net NPA %:</span>
            <span className={`font-bold ${isNetNpaViolated ? 'text-red-600' : 'text-gray-700'}`}>{statement?.netNpaPercent || 0}%</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Quick Nav & Historical Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1">
        {/* Left: Quick Links */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white p-2.5 rounded-sm shadow-sm border border-gray-200">
            <div className="text-[11px] font-bold text-primary border-b border-gray-200 pb-1 mb-2">
              १. त्वरित दुवे (Quick Navigation)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => onNavigate?.('npa-statement')}
                className="flex flex-col justify-between p-2.5 bg-blue-50/50 hover:bg-blue-100/60 border border-blue-200/70 rounded-sm transition-all text-left group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900">एन.पी.ए. पत्रक</span>
                    <span className="text-blue-600 group-hover:translate-x-1 transition-transform text-xs">➔</span>
                  </div>
                  <p className="text-[10px] text-blue-600 mt-1">वैधानिक अहवाल आणि ऑडिट सही ब्लॉक</p>
                </div>
              </button>

              <button
                onClick={() => onNavigate?.('collateral-compliance')}
                className="flex flex-col justify-between p-2.5 bg-indigo-50/50 hover:bg-indigo-100/60 border border-indigo-200/70 rounded-sm transition-all text-left group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">तारण पूर्तता ट्रॅकर</span>
                    <span className="text-indigo-600 group-hover:translate-x-1 transition-transform text-xs">➔</span>
                  </div>
                  <p className="text-[10px] text-indigo-600 mt-1">मूल्यमापन, विमा आणि तपासणी नोंद</p>
                </div>
              </button>

              <button
                onClick={() => onNavigate?.('npa-defaulters')}
                className="flex flex-col justify-between p-2.5 bg-amber-50/50 hover:bg-amber-100/60 border border-amber-200/70 rounded-sm transition-all text-left group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">थकबाकीदार यादी</span>
                    <span className="text-amber-600 group-hover:translate-x-1 transition-transform text-xs">➔</span>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1">पहिले २० थकबाकीदार आणि मोठे कर्जदार</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Audit Runs Log */}
        <div className="bg-white p-2.5 rounded-sm shadow-sm border border-gray-200 flex flex-col">
          <div className="text-[11px] font-bold text-primary border-b border-gray-200 pb-1 mb-2">
            २. बॅच रन इतिहास (Audit Runs Log)
          </div>
          <div className="flex-1 overflow-y-auto max-h-[250px] space-y-2 pr-1">
            {runs.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-6">अद्याप कोणतीही बॅच चालवली नाही.</p>
            ) : (
              runs.map((r, i) => (
                <div key={i} className="p-2 bg-gray-50 rounded-sm border border-gray-200 flex justify-between items-center text-[11px] hover:bg-blue-50/40 transition-colors">
                  <div>
                    <div className="font-bold text-gray-800">{new Date(r.runDate).toLocaleString('mr-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">युझर: {r.triggeredBy} | रेकॉर्ड्स: {r.recordsProcessed}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase ${
                    r.status === 'Success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    {r.status === 'Success' ? 'यशस्वी' : 'अयशस्वी'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NpaDashboard;


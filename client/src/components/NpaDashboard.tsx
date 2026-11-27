import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertOctagon, Building2, Calculator, FileSpreadsheet, Settings, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';

interface NpaDashboardProps {
  onNavigate?: (tab: string, params?: any) => void;
}

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

const fmtLakh = (val: any): string =>
  Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NpaDashboard: React.FC<NpaDashboardProps> = ({ onNavigate }) => {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const API_URL = '/api/Npa';

  const [statement, setStatement] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runDate, setRunDate] = useState<string>(() => getBusinessDateStr(user?.businessDate));
  const [runningBatch, setRunningBatch] = useState(false);
  const [message, setMessage] = useState('');

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    effectiveBranch === null ? 'all' : String(effectiveBranch)
  );

  useEffect(() => {
    if (user?.businessDate) {
      setRunDate(getBusinessDateStr(user.businessDate));
    }
  }, [user?.businessDate]);

  useEffect(() => {
    axios.get('/api/Branches').then((r) => setBranches(r.data || [])).catch(() => {});
  }, []);

  const fetchData = async (date = runDate, bId = selectedBranchId) => {
    try {
      setLoading(true);
      const bQuery = bId && bId !== 'all' ? `&branchId=${bId}` : '';
      const [stmtRes, runsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/statement?asOfDate=${date}${bQuery}`),
        axios.get(`${API_URL}/runs`),
      ]);

      if (stmtRes.status === 'fulfilled' && stmtRes.value?.data) {
        setStatement(stmtRes.value.data);
      }
      if (runsRes.status === 'fulfilled' && runsRes.value?.data) {
        setRuns(Array.isArray(runsRes.value.data) ? runsRes.value.data : []);
      }
    } catch (err) {
      console.error(err);
      setMessage('माहिती लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(runDate, selectedBranchId);
  }, [runDate, selectedBranchId]);

  const handleRunBatch = async () => {
    try {
      setRunningBatch(true);
      setMessage('एन.पी.ए. गणना प्रक्रिया चालू आहे...');
      await axios.post(`${API_URL}/run`, { asOfDate: runDate, triggeredBy: user?.username || 'Manager' });
      setMessage(`✅ दि. ${runDate} अखेर एन.पी.ए. वर्गीकरण व तरतूद मोजणी यशस्वीरित्या पूर्ण झाली!`);
      await fetchData(runDate, selectedBranchId);
    } catch (err) {
      console.error(err);
      setMessage('बॅच चालवताना त्रुटी आली.');
    } finally {
      setRunningBatch(false);
    }
  };

  const isGrossNpaViolated = statement ? statement.grossNpaPercent > 10 : false;
  const isNetNpaViolated = statement ? statement.netNpaPercent > 5 : false;

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto bg-slate-50/70 min-h-[calc(100vh-3.15rem)] flex flex-col gap-2.5 font-sans text-xs text-slate-800">
      {/* ERP Header Bar */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <AlertOctagon size={14} />
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-primary">
              एन.पी.ए. व्यवस्थापन व तरतूद डॅशबोर्ड (NPA &amp; Provisioning Dashboard)
            </h1>
            <p className="text-[10px] text-slate-500">
              मुद्दल बाकीवर BDDR तरतूद स्लॅब + NPA येणे व्याजावर स्वतंत्र १००% थकीत व्याज तरतूद (OIR)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 h-7">
            <Building2 size={12} className="text-primary" />
            <select
              value={selectedBranchId}
              disabled={!isHOUser}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-slate-900 focus:outline-none"
            >
              {isHOUser && <option value="all">सर्व शाखा (All)</option>}
              {(isHOUser || !lockedBranchId
                ? branches
                : branches.filter((b: any) => Number(b.branchID) === Number(lockedBranchId))
              ).map((b: any) => (
                <option key={b.branchID} value={String(b.branchID)}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>

          <input
            type="date"
            value={runDate}
            onChange={(e) => setRunDate(e.target.value)}
            className="h-7 px-2 border border-slate-300 rounded-sm text-[11px] font-mono font-bold bg-white focus:outline-none focus:border-primary"
          />

          <button
            onClick={() => onNavigate?.('npa-config')}
            className="h-7 px-2.5 rounded-sm text-[11px] font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 flex items-center gap-1 cursor-pointer transition"
          >
            <Settings size={12} />
            <span>तरतूद स्लॅब सेटिंग</span>
          </button>

          <button
            onClick={handleRunBatch}
            disabled={runningBatch}
            className="h-7 px-3 rounded-sm text-[11px] font-extrabold text-white bg-primary hover:opacity-90 shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Calculator size={12} />
            <span>{runningBatch ? 'प्रक्रिया चालू...' : 'एन.पी.ए. गणना करा (Run Batch)'}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-primary/5 border border-primary/20 text-slate-900 px-3 py-1.5 rounded-sm text-[11px] font-bold flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-primary font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {(isGrossNpaViolated || isNetNpaViolated) && (
        <div className="bg-rose-50 border border-rose-300 text-rose-900 px-3 py-1.5 rounded-sm text-[11px] font-medium space-y-0.5">
          <div className="font-extrabold flex items-center gap-1 text-rose-700">
            <ShieldAlert size={13} />
            <span>नियामक मर्यादांचे उल्लंघन (Regulatory Threshold Breach):</span>
          </div>
          {isGrossNpaViolated && <div>• एकूण एन.पी.ए. प्रमाण (Gross NPA) कमाल १०% मर्यादेपेक्षा जास्त आहे.</div>}
          {isNetNpaViolated && <div>• निव्वळ एन.पी.ए. प्रमाण (Net NPA) कमाल ५% मर्यादेपेक्षा जास्त आहे.</div>}
        </div>
      )}

      {/* 6 Compact KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="bg-white p-2.5 rounded-sm border border-slate-300 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">एकूण कर्ज बाकी</div>
          <div className="text-sm font-black text-slate-900 font-mono mt-0.5">₹ {fmtLakh(statement?.grossAdvances)} लाख</div>
        </div>

        <div className={`bg-white p-2.5 rounded-sm border shadow-2xs ${isGrossNpaViolated ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'}`}>
          <div className="text-[10px] font-bold text-slate-500 uppercase">एकूण NPA ({statement?.grossNpaPercent || 0}%)</div>
          <div className={`text-sm font-black font-mono mt-0.5 ${isGrossNpaViolated ? 'text-rose-700' : 'text-slate-900'}`}>
            ₹ {fmtLakh(statement?.grossNpa)} लाख
          </div>
        </div>

        <div className="bg-amber-50/60 p-2.5 rounded-sm border border-amber-300 shadow-2xs">
          <div className="text-[10px] font-bold text-amber-800 uppercase">१००% OIR (व्याज तरतूद)</div>
          <div className="text-sm font-black text-amber-950 font-mono mt-0.5">
            ₹ {fmtLakh(statement?.overdueInterestReserve)} लाख
          </div>
        </div>

        <div className="bg-primary/5 p-2.5 rounded-sm border border-primary/20 shadow-2xs">
          <div className="text-[10px] font-bold text-primary uppercase">आवश्यक BDDR (मुद्दल)</div>
          <div className="text-sm font-black text-primary font-mono mt-0.5">₹ {fmtLakh(statement?.totalProvision)} लाख</div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-300 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-500 uppercase">निव्वळ कर्ज बाकी</div>
          <div className="text-sm font-black text-slate-900 font-mono mt-0.5">₹ {fmtLakh(statement?.netAdvances)} लाख</div>
        </div>

        <div className={`bg-white p-2.5 rounded-sm border shadow-2xs ${isNetNpaViolated ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'}`}>
          <div className="text-[10px] font-bold text-slate-500 uppercase">निव्वळ NPA ({statement?.netNpaPercent || 0}%)</div>
          <div className={`text-sm font-black font-mono mt-0.5 ${isNetNpaViolated ? 'text-rose-700' : 'text-slate-900'}`}>
            ₹ {fmtLakh(statement?.netNpa)} लाख
          </div>
        </div>
      </div>

      {/* Quick Navigation + Audit Runs Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 flex-1">
        <div className="lg:col-span-2 bg-white p-3 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary">
          <div className="text-xs font-extrabold text-primary border-b border-slate-200 pb-1.5 mb-2.5">
            १. एन.पी.ए. अहवाल व व्यवस्थापन दुवे (Quick Navigation)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={() => onNavigate?.('npa-register')}
              className="p-3 bg-primary/5 hover:bg-primary/15 border border-primary/20 rounded-sm transition text-left cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-primary flex items-center gap-1.5">
                  <FileSpreadsheet size={14} />
                  <span>NPA तरतूद माहिती (खातेनिहाय रजिस्टर)</span>
                </span>
                <span className="text-primary font-bold">➔</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                प्रत्येक कर्ज खात्याची मुद्दल बाकी, तारणी/विनातारणी विभागणी, BDDR % व १००% OIR रजिस्टर
              </p>
            </button>

            <button
              onClick={() => onNavigate?.('npa-statement')}
              className="p-3 bg-white hover:bg-primary/10 border border-slate-300 hover:border-primary rounded-sm transition text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">एन.पी.ए. वैधानिक पत्रक (Statement)</span>
                <span className="text-primary font-bold">➔</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                भाग १ व भाग २ वैधानिक ऑडिट पत्रक, १००% OIR वजावट आणि लेखापरीक्षक स्वाक्षरी ब्लॉक
              </p>
            </button>

            <button
              onClick={() => onNavigate?.('collateral-compliance')}
              className="p-3 bg-white hover:bg-primary/10 border border-slate-300 hover:border-primary rounded-sm transition text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-primary" />
                  <span>तारण पूर्तता ट्रॅकर (Collateral Compliance)</span>
                </span>
                <span className="text-primary font-bold">➔</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                स्थावर मालमत्ता मूल्यांकन, विमा मुदत आणि वार्षिक पाहणी पूर्तता लॉग
              </p>
            </button>

            <button
              onClick={() => onNavigate?.('npa-defaulters')}
              className="p-3 bg-white hover:bg-primary/10 border border-slate-300 hover:border-primary rounded-sm transition text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Users size={14} className="text-amber-600" />
                  <span>पहिले २० थकबाकीदार व मोठे कर्जदार</span>
                </span>
                <span className="text-primary font-bold">➔</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                संचालक मंडळ मासिक सभेसाठी टॉप २० NPA थकबाकीदार व मोठे नियमित कर्जदार
              </p>
            </button>
          </div>
        </div>

        {/* Audit Runs Log */}
        <div className="bg-white p-3 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary flex flex-col">
          <div className="text-xs font-extrabold text-primary border-b border-slate-200 pb-1.5 mb-2">
            २. बॅच रन इतिहास (Audit Runs Log)
          </div>
          <div className="flex-1 overflow-y-auto max-h-[260px] space-y-1.5 pr-1 custom-scrollbar">
            {loading && runs.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-6">लोड होत आहे...</p>
            ) : runs.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-6">अद्याप कोणतीही बॅच चालवली नाही.</p>
            ) : (
              runs.map((r, i) => (
                <div
                  key={r.npaClassificationRunID || i}
                  className="px-2.5 py-1.5 bg-slate-50 rounded-sm border border-slate-200 flex justify-between items-center text-[11px] hover:bg-primary/5 transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-800">
                      {new Date(r.runDate).toLocaleString('mr-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      युझर: {r.triggeredBy} | खाती: {r.recordsProcessed}
                    </div>
                    {r.remarks && <div className="text-[10px] text-primary font-medium">{r.remarks}</div>}
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase ${
                      r.status === 'Success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border border-rose-300'
                    }`}
                  >
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

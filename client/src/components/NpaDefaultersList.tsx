import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { ArrowLeft, Building2, FileSpreadsheet, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getEffectiveBranchId, getLockedBranchId, isHeadOfficeUser } from '../utils/branchAccess';

interface NpaDefaultersListProps {
  onBack?: () => void;
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

const NpaDefaultersList: React.FC<NpaDefaultersListProps> = ({ onBack }) => {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const API_URL = '/api/Npa';

  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [largeBorrowers, setLargeBorrowers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => getBusinessDateStr(user?.businessDate));

  const effectiveBranch = getEffectiveBranchId(user, globalBranchId);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    effectiveBranch === null ? 'all' : String(effectiveBranch)
  );

  useEffect(() => {
    if (user?.businessDate) {
      setSelectedDate(getBusinessDateStr(user.businessDate));
    }
  }, [user?.businessDate]);

  useEffect(() => {
    axios.get('/api/Branches').then((r) => setBranches(r.data || [])).catch(() => {});
  }, []);

  const fetchData = async (date: string, bId = selectedBranchId) => {
    try {
      setLoading(true);
      const bQuery = bId && bId !== 'all' ? `&branchId=${bId}` : '';
      const res = await axios.get(`${API_URL}/defaulters?asOfDate=${date}${bQuery}`);
      setDefaulters(res.data.defaulters || []);
      setLargeBorrowers(res.data.largeStandardBorrowers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedDate, selectedBranchId);
  }, [selectedDate, selectedBranchId]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const defRows = defaulters.map((r, i) => ({
      'अनु.': i + 1,
      'खाते क्र.': r.loanAccountNo,
      'कर्जदाराचे नाव': r.borrowerName,
      'वर्गवारी': r.categoryMarathi,
      'एकूण बाकी (₹ लाख)': r.outstandingBalance,
      'थकीत दिवस': r.overdueDays,
    }));
    const stdRows = largeBorrowers.map((r, i) => ({
      'अनु.': i + 1,
      'खाते क्र.': r.loanAccountNo,
      'कर्जदाराचे नाव': r.borrowerName,
      'वर्गवारी': r.categoryMarathi,
      'एकूण बाकी (₹ लाख)': r.outstandingBalance,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(defRows), 'Top_20_Defaulters');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stdRows), 'Top_20_Large_Borrowers');
    XLSX.writeFile(wb, `NPA_Board_Defaulters_${selectedDate}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-3 max-w-7xl mx-auto bg-slate-50/70 min-h-[calc(100vh-3.15rem)] font-sans text-xs text-slate-800 space-y-2.5">
      {/* Header */}
      <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary flex flex-wrap gap-2 justify-between items-center print:hidden">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="h-6 px-2 rounded-sm border border-slate-300 bg-white hover:bg-primary/10 hover:text-primary hover:border-primary text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft size={12} />
              <span>मागे</span>
            </button>
          )}
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-primary">
              संचालक मंडळ सभा विशेष अहवाल (Top 20 Defaulters &amp; Large Borrowers)
            </h1>
            <p className="text-[10px] text-slate-500">
              परिपत्रकानुसार मासिक सभेसाठी पहिले २० थकबाकीदार आणि मोठे नियमित कर्जदार
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 h-6">
            <Building2 size={11} className="text-primary" />
            <select
              value={selectedBranchId}
              disabled={!isHOUser}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-slate-900 focus:outline-none"
            >
              {isHOUser && <option value="all">सर्व शाखा</option>}
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
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-6 px-2 border border-slate-300 rounded-sm text-[11px] font-mono font-bold bg-white focus:outline-none focus:border-primary"
          />

          <button
            onClick={handleExportExcel}
            className="h-6 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <FileSpreadsheet size={12} />
            <span>एक्सेल</span>
          </button>

          <button
            onClick={() => window.print()}
            className="h-6 px-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-sm text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Printer size={12} />
            <span>प्रिंट</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Top 20 Defaulters */}
        <div className="bg-white rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-rose-600 flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 bg-rose-50/70 border-b border-rose-200">
            <h3 className="text-xs font-extrabold text-rose-800">
              १. पहिले २० एन.पी.ए. थकबाकीदार (Top 20 NPA Defaulters)
            </h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-[11px] leading-tight whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <tr className="h-7">
                  <th className="py-1 px-2 border-r border-slate-200 w-10 text-center">अनु.</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-left">खाते क्र.</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-left">कर्जदाराचे नाव</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-left">श्रेणी</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-right">रक्कम (₹ लाख)</th>
                  <th className="py-1 px-2 text-center">दिवस</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading && defaulters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 font-bold">
                      लोड होत आहे...
                    </td>
                  </tr>
                ) : defaulters.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400 font-bold">
                      थकबाकीदार आढळले नाहीत.
                    </td>
                  </tr>
                ) : (
                  defaulters.map((r, i) => (
                    <tr key={r.loanAccountID || i} className="h-6 hover:bg-rose-50/40 transition-colors">
                      <td className="py-0.5 px-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
                      <td className="py-0.5 px-2 border-r border-slate-200 font-mono font-bold text-primary">
                        {r.loanAccountNo}
                      </td>
                      <td className="py-0.5 px-2 border-r border-slate-200 font-semibold text-slate-900">
                        {r.borrowerName || '-'}
                      </td>
                      <td className="py-0.5 px-2 border-r border-slate-200 font-bold text-rose-700">{r.categoryMarathi}</td>
                      <td className="py-0.5 px-2 border-r border-slate-200 text-right font-mono font-black text-slate-900">
                        ₹ {Number(r.outstandingBalance || 0).toFixed(2)}
                      </td>
                      <td className="py-0.5 px-2 text-center font-mono font-bold text-rose-900 bg-rose-50">
                        {r.overdueDays}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 20 Large Standard Borrowers */}
        <div className="bg-white rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary flex flex-col overflow-hidden">
          <div className="px-3 py-1.5 bg-primary/5 border-b border-primary/20">
            <h3 className="text-xs font-extrabold text-primary">
              २. पहिले २० मोठे नियमित कर्जदार (Top 20 Large Standard Borrowers)
            </h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse text-[11px] leading-tight whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                <tr className="h-7">
                  <th className="py-1 px-2 border-r border-slate-200 w-10 text-center">अनु.</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-left">खाते क्र.</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-left">कर्जदाराचे नाव</th>
                  <th className="py-1 px-2 border-r border-slate-200 text-left">श्रेणी</th>
                  <th className="py-1 px-2 text-right">रक्कम (₹ लाख)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading && largeBorrowers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 font-bold">
                      लोड होत आहे...
                    </td>
                  </tr>
                ) : largeBorrowers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 font-bold">
                      मोठे कर्जदार आढळले नाहीत.
                    </td>
                  </tr>
                ) : (
                  largeBorrowers.map((r, i) => (
                    <tr key={r.loanAccountID || i} className="h-6 hover:bg-primary/10 transition-colors">
                      <td className="py-0.5 px-2 border-r border-slate-200 text-center font-mono">{i + 1}</td>
                      <td className="py-0.5 px-2 border-r border-slate-200 font-mono font-bold text-primary">
                        {r.loanAccountNo}
                      </td>
                      <td className="py-0.5 px-2 border-r border-slate-200 font-semibold text-slate-900">
                        {r.borrowerName || '-'}
                      </td>
                      <td className="py-0.5 px-2 border-r border-slate-200 font-bold text-emerald-700">
                        {r.categoryMarathi}
                      </td>
                      <td className="py-0.5 px-2 text-right font-mono font-black text-slate-900">
                        ₹ {Number(r.outstandingBalance || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NpaDefaultersList;

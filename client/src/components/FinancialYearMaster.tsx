import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Calendar, Lock, Unlock, RefreshCw, ArrowRightLeft,
  CheckCircle2, ShieldAlert, TrendingUp, Layers, Plus, Edit3, Trash2, RotateCcw, CheckSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCachedMasterData, invalidateApiCache, setCachedMasterData } from '../utils/apiCache';

interface FinancialYear {
  financialYearID: number;
  yearCode: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
}

interface CandidatePlLedger {
  ledgerID: number;
  ledgerCode?: string;
  ledgerName: string;
}

interface YearEndPreview {
  sourceFinancialYearID: number;
  sourceYearCode: string;
  sourceStartDate: string;
  sourceEndDate: string;
  isSourceClosed: boolean;
  nextFinancialYearID?: number | null;
  nextYearCode: string;
  nextStartDate: string;
  nextEndDate: string;
  nextYearAlreadyExists: boolean;
  pendingVouchersCount: number;
  totalBranches: number;
  carriedLedgerCount: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  defaultProfitLossLedgerID: number;
  defaultProfitLossLedgerName: string;
  candidateProfitLossLedgers: CandidatePlLedger[];
}

const formatDisplayDate = (dateVal?: string | null): string => {
  if (!dateVal) return '—';
  const str = dateVal.split('T')[0];
  const parts = str.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return new Date(dateVal).toLocaleDateString('en-GB');
};

const normalizeFinancialYears = (raw: any, fallbackUser?: any): FinancialYear[] => {
  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.value)
    ? parsed.value
    : [];

  const mapped: FinancialYear[] = arr
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any) => ({
      financialYearID: Number(item.financialYearID ?? item.FinancialYearID ?? item.financialYearId ?? 1),
      yearCode: String(item.yearCode ?? item.YearCode ?? '2026-2027'),
      startDate: String(item.startDate ?? item.StartDate ?? '2026-04-01'),
      endDate: String(item.endDate ?? item.EndDate ?? '2027-03-31'),
      isActive: Boolean(item.isActive ?? item.IsActive ?? false),
      isClosed: Boolean(item.isClosed ?? item.IsClosed ?? false)
    }));

  if (mapped.length > 0) {
    return mapped;
  }

  // Fallback to current logged-in user's financial year if cache/response was unexpectedly empty
  if (fallbackUser?.financialYearCode) {
    const code = String(fallbackUser.financialYearCode);
    const match = code.match(/^(\d{4})\D+(\d{2,4})$/);
    const startYear = match ? Number(match[1]) : 2026;
    const endYear = startYear + 1;
    return [
      {
        financialYearID: Number(fallbackUser.financialYearID || 1),
        yearCode: code,
        startDate: `${startYear}-04-01`,
        endDate: `${endYear}-03-31`,
        isActive: true,
        isClosed: false
      }
    ];
  }

  return [];
};

export default function FinancialYearMaster() {
  const { user, updateFinancialYear } = useAuth();
  const [years, setYears] = useState<FinancialYear[]>(() =>
    normalizeFinancialYears(getCachedMasterData<any>('/api/FinancialYears'), user)
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);
  const yearCodeInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    yearCode: '',
    startDate: '',
    endDate: '',
    isActive: false,
    isClosed: false
  });

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Year-End Closing Wizard State
  const [selectedFyForYearEnd, setSelectedFyForYearEnd] = useState<FinancialYear | null>(null);
  const [preview, setPreview] = useState<YearEndPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedPlLedgerId, setSelectedPlLedgerId] = useState<number>(0);
  const [activateTargetYear, setActivateTargetYear] = useState<boolean>(true);
  const [closeSourceYear, setCloseSourceYear] = useState<boolean>(false);
  const [carryingForward, setCarryingForward] = useState(false);
  const [lockingYearId, setLockingYearId] = useState<number | null>(null);

  const API_URL = '/api/FinancialYears';

  useEffect(() => {
    fetchYears();
  }, []);

  const fetchYears = async (forceBypassCache = false) => {
    try {
      if (forceBypassCache) {
        invalidateApiCache(API_URL);
      }
      const res = await axios.get(API_URL);
      const list = normalizeFinancialYears(res.data, user);
      setYears(list);
      if (list.length > 0) {
        setCachedMasterData(API_URL, list);
        const activeFy = list.find(f => f.isActive);
        if (activeFy && user && (user.financialYearCode !== activeFy.yearCode || user.financialYearID !== activeFy.financialYearID)) {
          updateFinancialYear(activeFy.financialYearID, activeFy.yearCode);
        }
      }
    } catch (error) {
      console.error('Error fetching years', error);
      setYears(prev => (prev.length > 0 ? prev : normalizeFinancialYears([], user)));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.target;

    if (type === 'checkbox') {
      if (name === 'isActive') {
        setFormData(prev => ({
          ...prev,
          isActive: checked,
          isClosed: checked ? false : prev.isClosed
        }));
      } else if (name === 'isClosed') {
        setFormData(prev => ({
          ...prev,
          isClosed: checked,
          isActive: checked ? false : prev.isActive
        }));
      }
      return;
    }

    if (name === 'yearCode') {
      const nextForm = { ...formData, yearCode: value };
      // Smart auto-fill: if user types e.g. "2026-2027" or "2027-2028", auto-populate 01/04/YYYY and 31/03/YYYY+1
      const match = value.trim().match(/^(20\d{2})\s*[-/]\s*(20\d{2}|\d{2})$/);
      if (match) {
        const startYr = Number(match[1]);
        const rawEnd = match[2];
        const endYr = rawEnd.length === 2 ? Number(`20${rawEnd}`) : Number(rawEnd);
        if (endYr === startYr + 1 && startYr >= 2000 && endYr <= 2099) {
          nextForm.startDate = `${startYr}-04-01`;
          nextForm.endDate = `${endYr}-03-31`;
        }
      }
      setFormData(nextForm);
      return;
    }

    if (name === 'startDate') {
      const nextForm = { ...formData, startDate: value };
      if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const startYr = Number(value.split('-')[0]);
        if (startYr >= 2000 && startYr < 2099) {
          const endYr = startYr + 1;
          if (!nextForm.endDate) {
            nextForm.endDate = `${endYr}-03-31`;
          }
          if (!nextForm.yearCode.trim()) {
            nextForm.yearCode = `${startYr}-${endYr}`;
          }
        }
      }
      setFormData(nextForm);
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = (year: FinancialYear) => {
    setEditingId(year.financialYearID);
    setFormData({
      yearCode: year.yearCode,
      startDate: year.startDate ? year.startDate.split('T')[0] : '',
      endDate: year.endDate ? year.endDate.split('T')[0] : '',
      isActive: year.isActive,
      isClosed: year.isClosed
    });
    setStatusMessage(null);

    if (formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      if (yearCodeInputRef.current) {
        yearCodeInputRef.current.focus();
        yearCodeInputRef.current.select();
      }
    }, 120);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ yearCode: '', startDate: '', endDate: '', isActive: false, isClosed: false });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const cleanCode = formData.yearCode.trim();
    if (!cleanCode) {
      setStatusMessage({ type: 'error', text: 'कृपया आर्थिक वर्षाचा कोड (उदा. 2026-2027) प्रविष्ट करा.' });
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      setStatusMessage({ type: 'error', text: 'कृपया सुरुवात तारीख आणि शेवटची तारीख निवडा.' });
      return;
    }
    if (formData.startDate >= formData.endDate) {
      setStatusMessage({
        type: 'error',
        text: 'सुरुवातीची तारीख (Start Date) ही शेवटच्या तारखेपेक्षा (End Date) लहान असणे आवश्यक आहे.'
      });
      return;
    }
    if (formData.isActive && formData.isClosed) {
      setStatusMessage({
        type: 'error',
        text: 'बंद (Closed) केलेले आर्थिक वर्ष एकाच वेळी सक्रिय (Active) ठेवता येत नाही.'
      });
      return;
    }

    const duplicate = years.find(
      y => y.yearCode.toLowerCase() === cleanCode.toLowerCase() && y.financialYearID !== editingId
    );
    if (duplicate) {
      setStatusMessage({
        type: 'error',
        text: `आर्थिक वर्ष '${cleanCode}' आधीच नोंदवलेले आहे.`
      });
      return;
    }

    if (editingId) {
      const otherActive = years.some(y => y.isActive && y.financialYearID !== editingId);
      if (!formData.isActive && !otherActive) {
        setStatusMessage({
          type: 'error',
          text: 'प्रणालीमध्ये किमान एक आर्थिक वर्ष सक्रिय (Active) असणे आवश्यक आहे.'
        });
        return;
      }
    }

    try {
      const payload = {
        ...formData,
        yearCode: cleanCode,
        ...(editingId ? { financialYearID: editingId } : {})
      };

      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload);
      } else {
        await axios.post(API_URL, payload);
      }

      invalidateApiCache(API_URL);
      await fetchYears(true);
      handleCancelEdit();
      setStatusMessage({
        type: 'success',
        text: editingId ? 'आर्थिक वर्ष यशस्वीरित्या अपडेट झाले!' : 'नवीन आर्थिक वर्ष यशस्वीरित्या सेव्ह झाले!'
      });
    } catch (err: any) {
      console.error('Error saving year', err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.Message ||
        (typeof err?.response?.data === 'string' ? err.response.data : '') ||
        'माहिती सेव्ह करणे अयशस्वी झाले.';
      setStatusMessage({
        type: 'error',
        text: `एरर: ${errMsg}`
      });
    }
  };

  const handleDelete = async (id: number) => {
    const target = years.find(y => y.financialYearID === id);
    if (target?.isClosed) {
      setStatusMessage({ type: 'error', text: 'बंद (Closed) केलेले आर्थिक वर्ष डिलीट करता येत नाही.' });
      return;
    }
    if (target?.isActive) {
      setStatusMessage({
        type: 'error',
        text: 'सध्याचे चालू सक्रिय (Active) आर्थिक वर्ष डिलीट करता येत नाही. कृपया आधी दुसरे आर्थिक वर्ष सक्रिय करा.'
      });
      return;
    }

    if (!window.confirm('तुम्हाला खात्री आहे का की हे आर्थिक वर्ष डिलीट करायचे आहे?')) {
      return;
    }
    setStatusMessage(null);
    try {
      await axios.delete(`${API_URL}/${id}`);
      invalidateApiCache(API_URL);
      await fetchYears(true);
      setStatusMessage({ type: 'success', text: 'आर्थिक वर्ष यशस्वीरित्या डिलीट झाले!' });
    } catch (err: any) {
      console.error('Error deleting financial year', err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.Message ||
        (typeof err?.response?.data === 'string' ? err.response.data : '') ||
        'डिलीट करणे अयशस्वी झाले.';
      setStatusMessage({ type: 'error', text: `एरर: ${errMsg}` });
    }
  };

  const handleOpenYearEndWizard = async (year: FinancialYear) => {
    setSelectedFyForYearEnd(year);
    setLoadingPreview(true);
    setPreview(null);
    setStatusMessage(null);

    try {
      const res = await axios.get(`${API_URL}/${year.financialYearID}/year-end-preview`);
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      const normalized: YearEndPreview = {
        sourceFinancialYearID: data.sourceFinancialYearID ?? data.SourceFinancialYearID,
        sourceYearCode: data.sourceYearCode ?? data.SourceYearCode,
        sourceStartDate: data.sourceStartDate ?? data.SourceStartDate,
        sourceEndDate: data.sourceEndDate ?? data.SourceEndDate,
        isSourceClosed: Boolean(data.isSourceClosed ?? data.IsSourceClosed),
        nextFinancialYearID: data.nextFinancialYearID ?? data.NextFinancialYearID,
        nextYearCode: data.nextYearCode ?? data.NextYearCode,
        nextStartDate: data.nextStartDate ?? data.NextStartDate,
        nextEndDate: data.nextEndDate ?? data.NextEndDate,
        nextYearAlreadyExists: Boolean(data.nextYearAlreadyExists ?? data.NextYearAlreadyExists),
        pendingVouchersCount: Number(data.pendingVouchersCount ?? data.PendingVouchersCount ?? 0),
        totalBranches: Number(data.totalBranches ?? data.TotalBranches ?? 1),
        carriedLedgerCount: Number(data.carriedLedgerCount ?? data.CarriedLedgerCount ?? 0),
        totalIncome: Number(data.totalIncome ?? data.TotalIncome ?? 0),
        totalExpense: Number(data.totalExpense ?? data.TotalExpense ?? 0),
        netProfit: Number(data.netProfit ?? data.NetProfit ?? 0),
        defaultProfitLossLedgerID: Number(data.defaultProfitLossLedgerID ?? data.DefaultProfitLossLedgerID ?? 0),
        defaultProfitLossLedgerName:
          data.defaultProfitLossLedgerName ?? data.DefaultProfitLossLedgerName ?? 'संचित नफा-तोटा खाते',
        candidateProfitLossLedgers: (
          data.candidateProfitLossLedgers ??
          data.CandidateProfitLossLedgers ??
          []
        ).map((l: any) => ({
          ledgerID: l.ledgerID ?? l.LedgerID,
          ledgerCode: l.ledgerCode ?? l.LedgerCode,
          ledgerName: l.ledgerName ?? l.LedgerName
        }))
      };
      setPreview(normalized);
      setSelectedPlLedgerId(normalized.defaultProfitLossLedgerID || 0);
      setTimeout(() => {
        wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.Message ||
        (typeof err?.response?.data === 'string' ? err.response.data : '') ||
        'वार्षिक अखेर माहिती लोड करताना त्रुटी आली.';
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCarryForward = async () => {
    if (!preview || !selectedFyForYearEnd) return;
    if (preview.pendingVouchersCount > 0) {
      setStatusMessage({
        type: 'error',
        text: `आर्थिक वर्ष ${preview.sourceYearCode} मध्ये ${preview.pendingVouchersCount} प्रलंबित व्हाउचर्स आहेत. कृपया आधी व्हाउचर्स पास करा.`
      });
      return;
    }

    if (
      !window.confirm(
        `तुम्हाला आर्थिक वर्ष ${preview.sourceYearCode} ची ३१ मार्चची अखेरची शिल्लक व निव्वळ नफा/तोटा पुढील आर्थिक वर्ष ${preview.nextYearCode} च्या १ एप्रिलसाठी पुढे ओढायची (Carry Forward) आहे का?`
      )
    ) {
      return;
    }

    setCarryingForward(true);
    setStatusMessage(null);
    try {
      const res = await axios.post(`${API_URL}/${selectedFyForYearEnd.financialYearID}/carry-forward`, {
        targetFinancialYearID: preview.nextFinancialYearID || null,
        profitLossLedgerID: selectedPlLedgerId > 0 ? selectedPlLedgerId : null,
        activateTargetYear,
        closeSourceYear
      });

      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      setStatusMessage({
        type: 'success',
        text:
          data?.message ||
          data?.Message ||
          `आर्थिक वर्ष ${preview.sourceYearCode} ची शिल्लक ${preview.nextYearCode} मध्ये यशस्वीरित्या ट्रान्सफर झाली!`
      });
      invalidateApiCache(API_URL);
      await fetchYears(true);
      await handleOpenYearEndWizard(selectedFyForYearEnd);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.Message ||
        (typeof err?.response?.data === 'string' ? err.response.data : '') ||
        'शिल्लक पुढे ओढताना त्रुटी आली.';
      setStatusMessage({
        type: 'error',
        text: errMsg
      });
    } finally {
      setCarryingForward(false);
    }
  };

  const handleToggleLock = async (year: FinancialYear) => {
    const targetClosed = !year.isClosed;
    const actionLabel = targetClosed ? 'बंद / लॉक (Close & Lock)' : 'पुन्हा उघडणे (Unlock)';

    if (
      !window.confirm(
        `तुम्हाला आर्थिक वर्ष ${year.yearCode} हे ${actionLabel} करायचे आहे का?`
      )
    ) {
      return;
    }

    setLockingYearId(year.financialYearID);
    setStatusMessage(null);
    try {
      const res = await axios.post(`${API_URL}/${year.financialYearID}/toggle-lock`, {
        isClosed: targetClosed,
        reason: `Financial Year ${year.yearCode} ${targetClosed ? 'Locked' : 'Unlocked'} from FinancialYearMaster`
      });
      const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
      setStatusMessage({
        type: 'success',
        text: data?.message || data?.Message || `आर्थिक वर्ष ${year.yearCode} अपडेट झाले!`
      });
      invalidateApiCache(API_URL);
      await fetchYears(true);
      if (selectedFyForYearEnd?.financialYearID === year.financialYearID) {
        await handleOpenYearEndWizard({ ...year, isClosed: targetClosed });
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.Message ||
        (typeof err?.response?.data === 'string' ? err.response.data : '') ||
        'आर्थिक वर्ष लॉक/अनलॉक करताना त्रुटी आली.';
      setStatusMessage({
        type: 'error',
        text: errMsg
      });
    } finally {
      setLockingYearId(null);
    }
  };

  const activeYear = years.find(y => y.isActive);
  const openYearsCount = years.filter(y => !y.isClosed).length;
  const closedYearsCount = years.filter(y => y.isClosed).length;

  const labelClass = 'block text-xs font-bold text-gray-700 mb-0.5';
  const inputClass =
    'w-full text-xs border border-gray-300 rounded-sm px-2.5 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-semibold transition duration-150 h-7';

  return (
    <div className="p-2 sm:p-3 max-w-6xl mx-auto min-h-screen flex flex-col bg-slate-50 text-xs font-sans pb-8">
      {/* 🌟 1. TOP SLEEK CBS HEADER BANNER (Matches SansthaMaster & BranchMaster) */}
      <div className="bg-white px-3.5 py-2.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-2xs shrink-0">
            <Calendar className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <span>आर्थिक वर्ष व ३१ मार्च वार्षिक अखेर नियंत्रण</span>
              <span className="text-xs font-semibold text-primary font-mono hidden sm:inline">
                (Financial Year & Year-End Closing)
              </span>
              {editingId && (
                <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  ✏️ संपादन चालू (#{editingId})
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              नवीन आर्थिक वर्ष नोंदणी, ३१ मार्चची शिल्लक व नफा-तोटा १ एप्रिलला पुढे ओढणे (Carry Forward) आणि ऑडिट लॉक
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-sm text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="संपादन रद्द करा"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>संपादन रद्द करा</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCancelEdit}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="नवीन नोंद (Reset)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>नवीन नोंद</span>
          </button>

          <button
            type="button"
            onClick={() => fetchYears(true)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-sm text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
            title="यादी ताजी करा (Refresh)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>रिफ्रेश</span>
          </button>
        </div>
      </div>

      {/* 📊 2. SUMMARY KPI CARDS (Matches SansthaMaster & BranchMaster) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-bold">एकूण आर्थिक वर्षे</div>
            <div className="text-sm font-black text-gray-900">{years.length}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-bold">सध्याचे सक्रिय वर्ष</div>
            <div className="text-sm font-black text-emerald-800">{activeYear?.yearCode || 'नाही'}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-sky-50 text-sky-700 border border-sky-200 rounded">
            <Unlock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-bold">चालू (Open) वर्षे</div>
            <div className="text-sm font-black text-sky-900">{openYearsCount}</div>
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
          <div className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-bold">ऑडिट लॉक / बंद वर्षे</div>
            <div className="text-sm font-black text-rose-800">{closedYearsCount}</div>
          </div>
        </div>
      </div>

      {/* STATUS FEEDBACK BANNER */}
      {statusMessage && (
        <div
          className={`mb-3 px-3.5 py-2 rounded-sm border border-l-4 flex items-center justify-between gap-2 text-xs font-bold shadow-2xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 border-l-emerald-600 text-emerald-800'
              : 'bg-rose-50 border-rose-300 border-l-rose-600 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold px-1.5 py-0.5 rounded-sm hover:bg-black/10 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 📝 3. SECTION 1: ADD / EDIT FINANCIAL YEAR (Matches SansthaMaster & BranchMaster) */}
      <div
        ref={formContainerRef}
        className={`bg-white p-3.5 rounded-sm shadow-xs border border-t-2 border-t-primary transition-all duration-300 mb-3 ${
          editingId ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 pb-1.5 mb-2.5">
          <div className="flex items-center gap-1.5">
            {editingId ? (
              <Edit3 className="w-4 h-4 text-primary" />
            ) : (
              <Calendar className="w-4 h-4 text-primary" />
            )}
            <h2 className="text-xs font-bold text-primary">
              {editingId
                ? `१. आर्थिक वर्ष माहिती सुधारणा (संपादन मोड - आयडी: ${editingId})`
                : '१. नवीन आर्थिक वर्ष जोडा (Add Financial Year)'}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
            >
              ✕ संपादन रद्द करा
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className={labelClass}>
              वर्षाचा कोड (Year Code) <span className="text-red-500">*</span>
            </label>
            <input
              ref={yearCodeInputRef}
              type="text"
              name="yearCode"
              value={formData.yearCode}
              onChange={handleChange}
              required
              placeholder="उदा. 2026-2027"
              className={`${inputClass} font-bold text-primary font-mono`}
            />
          </div>

          <div>
            <label className={labelClass}>
              सुरुवात तारीख (Start Date) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              शेवटची तारीख (End Date) <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5 pb-0.5">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className="h-3.5 w-3.5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
              />
              <span className="text-xs font-bold text-gray-800">सध्याचे सक्रिय (Active) वर्ष</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                name="isClosed"
                checked={formData.isClosed}
                onChange={handleChange}
                className="h-3.5 w-3.5 text-rose-600 rounded border-gray-300 focus:ring-rose-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-gray-800">ऑडिट लॉक / बंद (Closed)</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>रद्द करा</span>
              </button>
            )}
            <button
              type="submit"
              className={`px-4 py-1.5 ${
                editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
              } text-white font-bold rounded-sm text-xs cursor-pointer shadow-xs flex items-center gap-1.5 transition-all`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{editingId ? 'अपडेट करा (Update)' : 'सेव्ह करा (Save)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 📜 4. SECTION 2: REGISTERED FINANCIAL YEARS & YEAR-END ACTIONS */}
      <div className="bg-white rounded-sm shadow-xs overflow-hidden border border-gray-200 border-t-2 border-t-primary mb-3">
        <div className="bg-slate-50 px-3.5 py-2 border-b border-gray-200 font-bold text-gray-900 flex justify-between items-center text-xs flex-wrap gap-2">
          <span className="flex items-center gap-1.5 text-primary">
            <Layers className="w-4 h-4 text-primary" />
            <span>२. नोंदवलेली आर्थिक वर्षे व वार्षिक अखेर नियंत्रण (Financial Years List)</span>
          </span>
          <span className="bg-primary/10 text-primary border border-primary/30 text-xs font-bold px-2.5 py-0.5 rounded-sm">
            एकूण: {years.length} वर्षे
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <th className="p-2 border-r border-gray-200 text-left">वर्षाचा कोड (Year Code)</th>
                <th className="p-2 border-r border-gray-200 text-left">सुरुवात तारीख (Start Date)</th>
                <th className="p-2 border-r border-gray-200 text-left">शेवटची तारीख (End Date)</th>
                <th className="p-2 border-r border-gray-200 text-center">सक्रिय स्थिती (Active)</th>
                <th className="p-2 border-r border-gray-200 text-center">ऑडिट लॉक स्थिती (Lock Status)</th>
                <th className="p-2 text-center">वार्षिक अखेर व कृती (Year-End & Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {years.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400 italic">
                    कोणतेही आर्थिक वर्ष आढळले नाही.
                  </td>
                </tr>
              ) : (
                years.map(year => (
                  <tr key={year.financialYearID} className="hover:bg-primary/5 transition-colors">
                    <td className="p-2 border-r border-gray-200 text-left font-bold text-primary font-mono">
                      {year.yearCode}
                    </td>
                    <td className="p-2 border-r border-gray-200 text-left font-semibold text-gray-800">
                      {formatDisplayDate(year.startDate)}
                    </td>
                    <td className="p-2 border-r border-gray-200 text-left font-semibold text-gray-800">
                      {formatDisplayDate(year.endDate)}
                    </td>
                    <td className="p-2 border-r border-gray-200 text-center">
                      <span
                        className={`px-2 py-0.5 inline-flex text-xs font-bold rounded-sm border ${
                          year.isActive
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {year.isActive ? '✅ सक्रिय (Active)' : 'निष्क्रिय'}
                      </span>
                    </td>
                    <td className="p-2 border-r border-gray-200 text-center">
                      <span
                        className={`px-2 py-0.5 inline-flex items-center gap-1 text-xs font-bold rounded-sm border ${
                          year.isClosed
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-sky-50 text-sky-900 border-sky-300'
                        }`}
                      >
                        {year.isClosed ? (
                          <>
                            <Lock className="w-3 h-3" /> बंद (Closed)
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" /> चालू (Open)
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenYearEndWizard(year)}
                          className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-sm font-bold text-xs inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                          title="३१ मार्चची अखेरची शिल्लक व नफा-तोटा पुढील वर्षात पुढे ओढा"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
                          <span>वार्षिक अखेर / शिल्लक पुढे ओढा</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleLock(year)}
                          disabled={lockingYearId === year.financialYearID}
                          className={`px-2.5 py-1 rounded-sm font-bold text-xs inline-flex items-center gap-1 border cursor-pointer shadow-2xs transition-colors ${
                            year.isClosed
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                          }`}
                        >
                          {year.isClosed ? (
                            <>
                              <Unlock className="w-3 h-3" /> अनलॉक करा
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" /> वर्ष लॉक करा
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(year)}
                          className="px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 rounded-sm font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> संपादन
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(year.financialYearID)}
                          disabled={year.isClosed || year.isActive}
                          title={
                            year.isClosed
                              ? 'बंद (Closed) केलेले आर्थिक वर्ष डिलीट करता येत नाही'
                              : year.isActive
                              ? 'चालू सक्रिय (Active) आर्थिक वर्ष डिलीट करता येत नाही'
                              : 'आर्थिक वर्ष डिलीट करा'
                          }
                          className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-sm font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3 h-3" /> डिलीट
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔄 5. SECTION 3: 31st MARCH YEAR-END CLOSING & CARRY-FORWARD WIZARD */}
      {selectedFyForYearEnd && (
        <div
          ref={wizardRef}
          className="bg-white rounded-sm shadow-xs border border-gray-200 border-t-2 border-t-primary overflow-hidden"
        >
          <div className="bg-slate-50 px-3.5 py-2 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
            <h2 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              <span>
                ३. ३१ मार्च वार्षिक अखेर व शिल्लक ट्रान्सफर पॅनेल — आर्थिक वर्ष {selectedFyForYearEnd.yearCode}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenYearEndWizard(selectedFyForYearEnd)}
                disabled={loadingPreview}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded-sm text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingPreview ? 'animate-spin' : ''}`} />
                <span>ताजे करा</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFyForYearEnd(null);
                  setPreview(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-rose-700 px-1.5 py-0.5 cursor-pointer"
              >
                ✕ बंद करा
              </button>
            </div>
          </div>

          {loadingPreview || !preview ? (
            <div className="p-6 text-center text-xs font-semibold text-slate-600">
              वार्षिक अखेर ताळमेळ व शिल्लक माहिती लोड होत आहे...
            </div>
          ) : (
            <div className="p-3.5 space-y-3 bg-white">
              {/* 3 Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
                {/* Card 1: Pre-Check & Pending Vouchers */}
                <div
                  className={`rounded-sm border flex flex-col justify-between overflow-hidden shadow-2xs ${
                    preview.pendingVouchersCount === 0
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-rose-50/90 border-rose-300'
                  }`}
                >
                  <div
                    className={`px-3 py-2 border-b flex items-center justify-between ${
                      preview.pendingVouchersCount === 0
                        ? 'bg-primary/10 border-primary/20'
                        : 'bg-rose-100/90 border-rose-300'
                    }`}
                  >
                    <span className="text-xs font-bold text-primary">
                      १) प्रलंबित व्हाउचर्स तपासणी
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-sm border bg-white ${
                        preview.pendingVouchersCount === 0
                          ? 'text-emerald-800 border-emerald-300'
                          : 'text-rose-800 border-rose-300'
                      }`}
                    >
                      {preview.pendingVouchersCount === 0
                        ? '✅ ० प्रलंबित'
                        : `❌ ${preview.pendingVouchersCount} प्रलंबित`}
                    </span>
                  </div>

                  <div className="p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>संपणारे आर्थिक वर्ष:</span>
                      <span className="font-bold text-slate-900">{preview.sourceYearCode}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>कालावधी:</span>
                      <span className="font-semibold text-slate-900">
                        {formatDisplayDate(preview.sourceStartDate)} ते {formatDisplayDate(preview.sourceEndDate)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>एकूण कार्यरत शाखा:</span>
                      <span className="font-semibold text-slate-900">{preview.totalBranches} शाखा</span>
                    </div>
                  </div>

                  <div
                    className={`px-3 py-2 border-t flex items-center justify-between ${
                      preview.pendingVouchersCount === 0
                        ? 'bg-primary/10 border-primary/20'
                        : 'bg-rose-100/60 border-rose-300'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-800">व्हाउचर स्थिती:</span>
                    <span className="text-xs font-bold text-emerald-900">
                      {preview.pendingVouchersCount === 0
                        ? 'सर्व व्हाउचर्स पास आहेत'
                        : 'आधी व्हाउचर्स पास करा'}
                    </span>
                  </div>
                </div>

                {/* Card 2: Annual Income, Expense & Net Profit/Loss */}
                <div className="rounded-sm border bg-emerald-50/80 border-emerald-300 flex flex-col justify-between overflow-hidden shadow-2xs">
                  <div className="px-3 py-2 border-b bg-emerald-100/80 border-emerald-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                      २) वार्षिक उत्पन्न व खर्च (P&L)
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-sm border bg-white text-emerald-800 border-emerald-300">
                      {preview.netProfit >= 0 ? 'निव्वळ नफा' : 'निव्वळ तोटा'}
                    </span>
                  </div>

                  <div className="p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>एकूण वार्षिक उत्पन्न (Cr):</span>
                      <span className="font-semibold text-emerald-800">
                        ₹ {preview.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>एकूण वार्षिक खर्च (Dr):</span>
                      <span className="font-semibold text-rose-700">
                        ₹ {preview.totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>पुढे ओढली जाणारी ताळेबंद खाती:</span>
                      <span className="font-semibold text-slate-900">{preview.carriedLedgerCount} खाती</span>
                    </div>
                  </div>

                  <div className="px-3 py-2 border-t bg-emerald-100/60 border-emerald-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-950">
                      {preview.netProfit >= 0 ? 'वार्षिक निव्वळ नफा (Cr):' : 'वार्षिक निव्वळ तोटा (Dr):'}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        preview.netProfit >= 0 ? 'text-emerald-900' : 'text-rose-800'
                      }`}
                    >
                      ₹ {Math.abs(preview.netProfit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Card 3: Target Next Financial Year */}
                <div className="rounded-sm border bg-amber-50/80 border-amber-300 flex flex-col justify-between overflow-hidden shadow-2xs">
                  <div className="px-3 py-2 border-b bg-amber-100/80 border-amber-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-700" />
                      ३) पुढील आर्थिक वर्ष ({preview.nextYearCode})
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-sm border bg-white text-amber-900 border-amber-300">
                      {preview.nextYearAlreadyExists ? 'तयार आहे' : 'स्वयं-निर्मित होईल'}
                    </span>
                  </div>

                  <div className="p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span>पुढील आर्थिक वर्ष:</span>
                      <span className="font-bold text-amber-950">{preview.nextYearCode}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>नवीन वर्ष सुरुवात (१ एप्रिल):</span>
                      <span className="font-semibold text-slate-900">
                        {formatDisplayDate(preview.nextStartDate)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span>उत्पन्न व खर्च खाती:</span>
                      <span className="font-semibold text-slate-900">₹ 0.00 (नफा ताळेबंदात वर्ग)</span>
                    </div>
                  </div>

                  <div className="px-3 py-2 border-t bg-amber-100/60 border-amber-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-950">१ एप्रिल तेरीज स्थिती:</span>
                    <span className="text-xs font-bold text-emerald-900">१००% नावे = जमा (Tallied)</span>
                  </div>
                </div>
              </div>

              {/* P&L Ledger Selection & Execution Bar */}
              <div className="p-3 rounded-sm border border-gray-200 bg-slate-50 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                  <div className="min-w-[260px]">
                    <label className="block text-xs font-bold text-gray-800 mb-1">
                      निव्वळ नफा / तोटा वर्ग करण्याचे ताळेबंद खाते (P&L Reserve Ledger):
                    </label>
                    <select
                      value={selectedPlLedgerId}
                      onChange={e => setSelectedPlLedgerId(Number(e.target.value))}
                      className={inputClass}
                    >
                      <option value={0}>
                        ⚡ स्वयं-निवड / नवीन तयार करा ({preview.defaultProfitLossLedgerName})
                      </option>
                      {preview.candidateProfitLossLedgers.map(l => (
                        <option key={l.ledgerID} value={l.ledgerID}>
                          {l.ledgerName} {l.ledgerCode ? `(${l.ledgerCode})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={activateTargetYear}
                        onChange={e => setActivateTargetYear(e.target.checked)}
                        className="h-3.5 w-3.5 text-primary rounded border-gray-300 focus:ring-primary cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-800">
                        पुढील आर्थिक वर्ष ({preview.nextYearCode}) सक्रिय (Active) करा
                      </span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={closeSourceYear}
                        onChange={e => setCloseSourceYear(e.target.checked)}
                        className="h-3.5 w-3.5 text-rose-600 rounded border-gray-300 focus:ring-rose-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-gray-800">
                        मागील आर्थिक वर्ष ({preview.sourceYearCode}) ऑडिट लॉक (Closed) करा
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCarryForward}
                    disabled={carryingForward || preview.pendingVouchersCount > 0}
                    className={`py-2 px-4 rounded-sm font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      preview.pendingVouchersCount === 0 && !carryingForward
                        ? 'bg-primary hover:opacity-90 text-white cursor-pointer shadow-xs'
                        : 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    {carryingForward
                      ? 'शिल्लक पुढे ओढली जात आहे...'
                      : `३१ मार्चची शिल्लक व नफा ${preview.nextYearCode} मध्ये पुढे ओढा (Carry Forward)`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

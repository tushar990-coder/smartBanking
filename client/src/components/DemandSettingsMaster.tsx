import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  Settings,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info
} from 'lucide-react';

interface LoanRateOption {
  loanRateID: number;
  loanType: string;
  loanCode: string;
  shortName?: string;
  loanLedgerID?: number;
  interestLedgerID?: number;
  receivableInterestLedgerID?: number;
  overdueInterestLedgerID?: number;
}

interface SavingSchemeOption {
  settingID: number;
  schemeCode: string;
  schemeName: string;
  interestRate: number;
  postingFrequency: string;
  savingLiabilityLedgerID?: number;
  ledgerID?: number;
}

interface RdSchemeOption {
  rdSchemeID: number;
  schemeCode: string;
  schemeName: string;
  durationMonths: number;
  minimumInstallment: number;
  rdLiabilityLedgerID?: number;
}

interface ShareSchemeOption {
  shareSchemeId: number;
  schemeCode: string;
  schemeName: string;
  shareFaceValue: number;
  shareCapitalLedgerID?: number;
}

interface LedgerOption {
  ledgerID: number;
  ledgerCode: string;
  ledgerName: string;
  accountType?: string;
  natureOfGroup?: string;
}

export interface DemandColumnSettingRow {
  demandColumnSettingId: number;
  sequenceOrder: number;
  columnHeaderMr: string;
  itemType: 'LOAN' | 'THRIFT_SAVING' | 'RD' | 'SHARE' | 'LEDGER_OTHER';
  loanRateID?: number | null;
  savingSchemeID?: number | null;
  rdSchemeID?: number | null;
  shareSchemeId?: number | null;
  principalOrDepositLedgerID?: number | null;
  interestLedgerID?: number | null;
  receivableInterestLedgerID?: number | null;
  overdueInterestLedgerID?: number | null;
  showBalanceColumn: boolean;
  includeOverduePenalInterest: boolean;
  loanIntraAllocationOrder: 'INTEREST_FIRST' | 'PRINCIPAL_FIRST';
  isContributionTarget: boolean;
  defaultAmount: number;
  isActive: boolean;
}

interface DemandSettingsMasterProps {
  onNavigate?: (tab: string) => void;
}

export default function DemandSettingsMaster({ onNavigate }: DemandSettingsMasterProps) {
  const [rows, setRows] = useState<DemandColumnSettingRow[]>([]);
  const [suggestedDefaults, setSuggestedDefaults] = useState<DemandColumnSettingRow[]>([]);
  const [loanRates, setLoanRates] = useState<LoanRateOption[]>([]);
  const [savingSchemes, setSavingSchemes] = useState<SavingSchemeOption[]>([]);
  const [rdSchemes, setRdSchemes] = useState<RdSchemeOption[]>([]);
  const [shareSchemes, setShareSchemes] = useState<ShareSchemeOption[]>([]);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/DemandSettings');
      const data = res.data || {};
      setIsConfigured(Boolean(data.isConfigured));
      setLoanRates(data.loanRates || []);
      setSavingSchemes(data.savingSchemes || []);
      setRdSchemes(data.rdSchemes || []);
      setShareSchemes(data.shareSchemes || []);
      setLedgers(data.ledgers || []);
      setSuggestedDefaults(data.suggestedDefaults || []);

      const loaded: DemandColumnSettingRow[] =
        data.settings && data.settings.length > 0
          ? data.settings
          : data.suggestedDefaults || [];

      setRows(
        loaded
          .slice()
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
          .map((r, idx) => ({ ...r, sequenceOrder: idx + 1, isActive: true }))
      );
    } catch (err: any) {
      setError(err.response?.data || 'डिमांड सेटिंग्ज लोड करताना त्रुटी आली.');
    } finally {
      setLoading(false);
    }
  };

  const resequence = (list: DemandColumnSettingRow[]): DemandColumnSettingRow[] =>
    list.map((item, idx) => ({ ...item, sequenceOrder: idx + 1 }));

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= rows.length) return;
    const copy = rows.slice();
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    setRows(resequence(copy));
  };

  const handleAddRow = () => {
    setRows((prev) =>
      resequence([
        ...prev,
        {
          demandColumnSettingId: 0,
          sequenceOrder: prev.length + 1,
          columnHeaderMr: '',
          itemType: 'LOAN',
          loanRateID: null,
          savingSchemeID: null,
          rdSchemeID: null,
          shareSchemeId: null,
          principalOrDepositLedgerID: null,
          interestLedgerID: null,
          receivableInterestLedgerID: null,
          overdueInterestLedgerID: null,
          showBalanceColumn: true,
          includeOverduePenalInterest: false,
          loanIntraAllocationOrder: 'INTEREST_FIRST',
          isContributionTarget: false,
          defaultAmount: 0,
          isActive: true
        }
      ])
    );
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => resequence(prev.filter((_, i) => i !== index)));
  };

  const handleTypeChange = (index: number, newType: DemandColumnSettingRow['itemType']) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        return {
          ...row,
          itemType: newType,
          loanRateID: null,
          savingSchemeID: null,
          rdSchemeID: null,
          shareSchemeId: null,
          principalOrDepositLedgerID: null,
          interestLedgerID: null,
          receivableInterestLedgerID: null,
          overdueInterestLedgerID: null,
          showBalanceColumn: newType === 'LOAN',
          includeOverduePenalInterest: false,
          isContributionTarget: newType === 'THRIFT_SAVING' ? row.isContributionTarget : false
        };
      })
    );
  };

  const handleSchemeChange = (index: number, schemeIdStr: string) => {
    const schemeId = schemeIdStr ? Number(schemeIdStr) : null;
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        if (row.itemType === 'LOAN') {
          const lr = loanRates.find((l) => l.loanRateID === schemeId);
          return {
            ...row,
            loanRateID: schemeId,
            columnHeaderMr: lr ? (lr.shortName || lr.loanType) : row.columnHeaderMr,
            principalOrDepositLedgerID: lr?.loanLedgerID ?? row.principalOrDepositLedgerID ?? null,
            interestLedgerID: lr?.interestLedgerID ?? row.interestLedgerID ?? null,
            receivableInterestLedgerID: lr?.receivableInterestLedgerID ?? null,
            overdueInterestLedgerID: lr?.overdueInterestLedgerID ?? null
          };
        }

        if (row.itemType === 'THRIFT_SAVING') {
          const ss = savingSchemes.find((s) => s.settingID === schemeId);
          return {
            ...row,
            savingSchemeID: schemeId,
            columnHeaderMr: ss ? ss.schemeName : row.columnHeaderMr,
            principalOrDepositLedgerID:
              ss?.savingLiabilityLedgerID ?? ss?.ledgerID ?? row.principalOrDepositLedgerID ?? null
          };
        }

        if (row.itemType === 'RD') {
          const rd = rdSchemes.find((r) => r.rdSchemeID === schemeId);
          return {
            ...row,
            rdSchemeID: schemeId,
            columnHeaderMr: rd ? rd.schemeName : row.columnHeaderMr,
            principalOrDepositLedgerID: rd?.rdLiabilityLedgerID ?? row.principalOrDepositLedgerID ?? null,
            defaultAmount: rd ? rd.minimumInstallment : row.defaultAmount
          };
        }

        if (row.itemType === 'SHARE') {
          const sh = shareSchemes.find((s) => s.shareSchemeId === schemeId);
          return {
            ...row,
            shareSchemeId: schemeId,
            columnHeaderMr: sh ? sh.schemeName : row.columnHeaderMr,
            principalOrDepositLedgerID: sh?.shareCapitalLedgerID ?? row.principalOrDepositLedgerID ?? null
          };
        }

        return row;
      })
    );
  };

  const handleContributionTargetToggle = (index: number, checked: boolean) => {
    setRows((prev) =>
      prev.map((row, i) => ({
        ...row,
        isContributionTarget: i === index ? checked : false
      }))
    );
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (rows.length === 0) {
      setError('कृपया किमान एक डिमांड रकाना जोडा.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        items: resequence(rows).map((r) => ({
          ...r,
          defaultAmount: Number(r.defaultAmount || 0)
        }))
      };
      const res = await axios.put('/api/DemandSettings', payload);
      setIsConfigured(true);
      if (res.data?.settings) {
        setRows(res.data.settings);
      }
      setSuccess(res.data?.message || 'डिमांड सेटिंग्ज यशस्वीरीत्या जतन केल्या आहेत!');
    } catch (err: any) {
      const msg = err.response?.data;
      setError(typeof msg === 'string' ? msg : 'डिमांड सेटिंग्ज जतन करताना त्रुटी आली.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-2 max-w-[1400px] mx-auto font-sans text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-3 border-b-2 border-primary">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-primary text-white">
            <Settings size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">
              कर्मचारी पगार डिमांड सेटिंग्ज (Sanstha Default Sequence &amp; Ledger Setting)
            </h1>
            <p className="text-[11px] text-slate-500">
              संपूर्ण संस्थेसाठी एकमेव डिफॉल्ट सेटिंग — डिमांड कॉलम्सचा क्रम, एकापेक्षा जास्त RD स्कीम उप-ओळी व वसुली प्राधान्यक्रम
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isConfigured && suggestedDefaults.length > 0 && (
            <button
              type="button"
              onClick={() => setRows(resequence(suggestedDefaults))}
              className="px-2.5 py-1.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Sparkles size={14} /> डिफॉल्ट सुचवलेला क्रम भरा
            </button>
          )}
          <button
            type="button"
            onClick={handleAddRow}
            className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} /> नवीन योजना / कॉलम जोडा
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-3.5 py-1.5 rounded bg-primary hover:opacity-95 text-white font-bold shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'जतन होत आहे...' : 'सेटिंग्ज जतन करा'}
          </button>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('demand-notice')}
              className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm cursor-pointer"
            >
              डिमांड फॉर्मवर जा →
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-3 p-2.5 rounded border border-blue-200 bg-blue-50/80 text-blue-950 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-700" />
        <div className="space-y-0.5 text-[11px] leading-relaxed">
          <div>
            <strong>१) `क्रम (Sequence)` चा दुहेरी उपयोग:</strong> फॉर्म व प्रिंट यादीत कॉलम्स डावीकडून उजवीकडे याच क्रमाने दिसतील, आणि पगारातून अपुरी (कमी) कपात आल्यास याच प्राधान्यक्रमाने वसुली जमा होईल.
          </div>
          <div>
            <strong>२) एकापेक्षा जास्त RD स्कीम:</strong> प्रत्येक सक्रिय RD स्कीम येथे स्वतंत्र ओळीत जोडा व क्रम द्या. डिमांड फॉर्मवर फक्त RD साठी एकाच कर्मचाऱ्याच्या मुख्य रोखाली क्रमाने उप-ओळी (Sub-Row) तयार होतील आणि वसुली प्राधान्य सेटिंगच्या क्रमाप्रमाणे चालेल.
          </div>
          <div>
            <strong>३) संजीवनी ठेव / वर्गणी ठेव:</strong> या प्रकाराला <strong>'वर्गणी ठेव Auto-Fill'</strong> चिन्हांकित केल्यास डिमांड फॉर्मवरील वर्गणी रक्कम टाकून 'पहा' क्लिक करताच सर्व कर्मचाऱ्यांत ती रक्कम आपोआप भरली जाईल.
          </div>
        </div>
      </div>

      {!isConfigured && (
        <div className="mb-2 p-2 rounded border border-amber-300 bg-amber-50 text-amber-900 font-semibold text-[11px]">
          ⚠️ संस्थेची डिमांड सेटिंग अद्याप जतन केलेली नाही. खालील सुचवलेला क्रम तपासा, सर्व लेजर (Credit / Interest) जुळवा आणि <strong>"सेटिंग्ज जतन करा"</strong> क्लिक करा.
        </div>
      )}

      {error && (
        <div className="mb-2 p-2 rounded border border-red-300 bg-red-50 text-red-700 font-semibold flex items-center gap-1.5">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {success && (
        <div className="mb-2 p-2 rounded border border-green-300 bg-green-50 text-green-800 font-semibold flex items-center gap-1.5">
          <CheckCircle2 size={15} /> {success}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500 bg-white border rounded">डिमांड सेटिंग्ज लोड होत आहेत...</div>
      ) : (
        <div className="bg-white border border-slate-300 rounded shadow-sm overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="bg-primary text-white">
              <tr>
                <th className="px-2 py-2 border border-slate-400/40 w-20 text-center">क्रम (Seq)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-36 text-left">प्रकार (Type)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-52 text-left">योजना निवडा (Scheme)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-44 text-left">कॉलमचे नाव (Display Header)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-56 text-left">मुद्दल / ठेव जमा लेजर (Credit Ledger) *</th>
                <th className="px-2 py-2 border border-slate-400/40 w-56 text-left">व्याज जमा लेजर (Loan Interest Ledger)</th>
                <th className="px-2 py-2 border border-slate-400/40 w-52 text-left">नियम व ऑटो-फिल</th>
                <th className="px-2 py-2 border border-slate-400/40 w-14 text-center">काढा</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    कोणताही कॉलम जोडलेला नाही. "नवीन योजना / कॉलम जोडा" क्लिक करा.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                    {/* Sequence */}
                    <td className="px-1.5 py-1.5 border border-slate-200 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="inline-block w-6 font-bold text-primary text-xs">{row.sequenceOrder}</span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMove(idx, -1)}
                            disabled={idx === 0}
                            title="वर घ्या"
                            className="p-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 1)}
                            disabled={idx === rows.length - 1}
                            title="खाली घ्या"
                            className="p-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown size={11} />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-1.5 py-1.5 border border-slate-200">
                      <select
                        value={row.itemType}
                        onChange={(e) => handleTypeChange(idx, e.target.value as any)}
                        className="w-full border border-slate-300 rounded px-1.5 py-1 bg-white font-semibold"
                      >
                        <option value="LOAN">कर्ज (Loan)</option>
                        <option value="THRIFT_SAVING">संजीवनी / वर्गणी ठेव</option>
                        <option value="RD">आवर्ती ठेव (RD)</option>
                        <option value="SHARE">शेअर्स (Share)</option>
                        <option value="LEDGER_OTHER">इतर सामान्य लेजर</option>
                      </select>
                    </td>

                    {/* Scheme */}
                    <td className="px-1.5 py-1.5 border border-slate-200">
                      {row.itemType === 'LOAN' && (
                        <select
                          value={row.loanRateID ?? ''}
                          onChange={(e) => handleSchemeChange(idx, e.target.value)}
                          className="w-full border border-slate-300 rounded px-1.5 py-1 bg-white"
                        >
                          <option value="">-- कर्ज योजना निवडा --</option>
                          {loanRates.map((l) => (
                            <option key={l.loanRateID} value={l.loanRateID}>
                              {l.loanType} ({l.loanCode})
                            </option>
                          ))}
                        </select>
                      )}

                      {row.itemType === 'THRIFT_SAVING' && (
                        <select
                          value={row.savingSchemeID ?? ''}
                          onChange={(e) => handleSchemeChange(idx, e.target.value)}
                          className="w-full border border-slate-300 rounded px-1.5 py-1 bg-white"
                        >
                          <option value="">-- ठेव योजना निवडा --</option>
                          {savingSchemes.map((s) => (
                            <option key={s.settingID} value={s.settingID}>
                              {s.schemeName} ({s.schemeCode}) - {s.postingFrequency}
                            </option>
                          ))}
                        </select>
                      )}

                      {row.itemType === 'RD' && (
                        <select
                          value={row.rdSchemeID ?? ''}
                          onChange={(e) => handleSchemeChange(idx, e.target.value)}
                          className="w-full border border-slate-300 rounded px-1.5 py-1 bg-white"
                        >
                          <option value="">-- RD योजना निवडा --</option>
                          {rdSchemes.map((r) => (
                            <option key={r.rdSchemeID} value={r.rdSchemeID}>
                              {r.schemeName} ({r.durationMonths} महिने)
                            </option>
                          ))}
                        </select>
                      )}

                      {row.itemType === 'SHARE' && (
                        <select
                          value={row.shareSchemeId ?? ''}
                          onChange={(e) => handleSchemeChange(idx, e.target.value)}
                          className="w-full border border-slate-300 rounded px-1.5 py-1 bg-white"
                        >
                          <option value="">-- शेअर योजना (ऐच्छिक) --</option>
                          {shareSchemes.map((s) => (
                            <option key={s.shareSchemeId} value={s.shareSchemeId}>
                              {s.schemeName} (₹{s.shareFaceValue})
                            </option>
                          ))}
                        </select>
                      )}

                      {row.itemType === 'LEDGER_OTHER' && (
                        <span className="text-slate-400 italic">थेट लेजरवर जमा (योजना लागू नाही)</span>
                      )}
                    </td>

                    {/* Header Name */}
                    <td className="px-1.5 py-1.5 border border-slate-200">
                      <input
                        type="text"
                        value={row.columnHeaderMr}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, columnHeaderMr: e.target.value } : r))
                          )
                        }
                        placeholder="उदा. आकस्मिक कर्ज"
                        className="w-full border border-slate-300 rounded px-1.5 py-1 font-medium"
                      />
                    </td>

                    {/* Principal / Deposit Credit Ledger */}
                    <td className="px-1.5 py-1.5 border border-slate-200">
                      <select
                        value={row.principalOrDepositLedgerID ?? ''}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, principalOrDepositLedgerID: e.target.value ? Number(e.target.value) : null }
                                : r
                            )
                          )
                        }
                        className={`w-full border rounded px-1.5 py-1 bg-white ${
                          !row.principalOrDepositLedgerID ? 'border-red-400 bg-red-50' : 'border-slate-300'
                        }`}
                      >
                        <option value="">-- जमा लेजर निवडा --</option>
                        {ledgers.map((l) => (
                          <option key={l.ledgerID} value={l.ledgerID}>
                            {l.ledgerName} ({l.ledgerCode})
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Loan Interest Ledgers */}
                    <td className="px-1.5 py-1.5 border border-slate-200">
                      {row.itemType === 'LOAN' ? (
                        <div className="space-y-1">
                          <select
                            value={row.interestLedgerID ?? ''}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, interestLedgerID: e.target.value ? Number(e.target.value) : null }
                                    : r
                                )
                              )
                            }
                            className={`w-full border rounded px-1.5 py-1 bg-white ${
                              !row.interestLedgerID ? 'border-red-400 bg-red-50' : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- चालू व्याज उत्पन्न लेजर * --</option>
                            {ledgers.map((l) => (
                              <option key={l.ledgerID} value={l.ledgerID}>
                                {l.ledgerName} ({l.ledgerCode})
                              </option>
                            ))}
                          </select>
                          <select
                            value={row.receivableInterestLedgerID ?? ''}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        receivableInterestLedgerID: e.target.value ? Number(e.target.value) : null
                                      }
                                    : r
                                )
                              )
                            }
                            className="w-full border border-slate-200 rounded px-1.5 py-0.5 bg-slate-50 text-[10px]"
                          >
                            <option value="">-- येणे व्याज लेजर (ऐच्छिक) --</option>
                            {ledgers.map((l) => (
                              <option key={l.ledgerID} value={l.ledgerID}>
                                {l.ledgerName}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">फक्त कर्जासाठी लागू</span>
                      )}
                    </td>

                    {/* Rules */}
                    <td className="px-2 py-1.5 border border-slate-200 space-y-1">
                      {row.itemType === 'LOAN' ? (
                        <>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.showBalanceColumn}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, showBalanceColumn: e.target.checked } : r))
                                )
                              }
                            />
                            <span>'बाकी' कॉलम दाखवा</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row.includeOverduePenalInterest}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, includeOverduePenalInterest: e.target.checked } : r
                                  )
                                )
                              }
                            />
                            <span>थकीत दंडव्याज समाविष्ट करा</span>
                          </label>
                          <select
                            value={row.loanIntraAllocationOrder}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, loanIntraAllocationOrder: e.target.value as any } : r
                                )
                              )
                            }
                            className="w-full border border-slate-200 rounded px-1 py-0.5 text-[10px]"
                          >
                            <option value="INTEREST_FIRST">वसुली क्रम: आधी व्याज → मुद्दल</option>
                            <option value="PRINCIPAL_FIRST">वसुली क्रम: आधी मुद्दल → व्याज</option>
                          </select>
                        </>
                      ) : (
                        <>
                          {(row.itemType === 'THRIFT_SAVING' || row.itemType === 'LEDGER_OTHER') && (
                            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-emerald-800">
                              <input
                                type="checkbox"
                                checked={row.isContributionTarget}
                                onChange={(e) => handleContributionTargetToggle(idx, e.target.checked)}
                              />
                              <span>'वर्गणी ठेव' Auto-Fill लक्ष्य</span>
                            </label>
                          )}
                          {row.itemType === 'RD' && (
                            <div className="text-[10px] text-blue-700 font-medium">
                              &gt; १ RD असल्यास फॉर्मवर खाली उप-ओळ तयार होईल
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-600">डिफॉल्ट ₹:</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.defaultAmount}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, defaultAmount: Number(e.target.value) || 0 } : r
                                  )
                                )
                              }
                              className="w-20 border border-slate-300 rounded px-1 py-0.5 text-right font-mono"
                            />
                          </div>
                        </>
                      )}
                    </td>

                    {/* Remove */}
                    <td className="px-1.5 py-1.5 border border-slate-200 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        title="काढून टाका"
                        className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

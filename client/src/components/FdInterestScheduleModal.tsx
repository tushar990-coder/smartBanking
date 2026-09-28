import React, { useRef } from 'react';
import { FdScheduleSummary } from '../utils/fdInterestSchedule';

export interface FdScheduleOverdueInfo {
  isOverdue: boolean;
  overdueDays: number;
  overdueInterest: number;
  closureDate: string;
  effectiveOverdueRate: number;
  baseAmount: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  summary: FdScheduleSummary;
  customerName?: string;
  memberCode?: string;
  cifNo?: string;
  schemeName?: string;
  isSeniorCitizen?: boolean;
  entryMode?: 'single' | 'bulk';
  splitCount?: number;
  totalDepositAmount?: number;
  overdueDetails?: FdScheduleOverdueInfo;
}

export const FdInterestScheduleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  summary,
  customerName = 'ग्राहक',
  memberCode = '',
  cifNo = '',
  schemeName = 'मुदत ठेव योजना',
  isSeniorCitizen = false,
  entryMode = 'single',
  splitCount = 1,
  totalDepositAmount = 0,
  overdueDetails
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const formatCurrency = (amt: number) => {
    return `₹ ${Math.round(amt || 0).toLocaleString('en-IN')}`;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('en-GB');
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const principalRatio = summary.totalBenefit > 0
    ? Math.round((summary.principalAmount / summary.totalBenefit) * 100)
    : 100;
  const interestRatio = 100 - principalRatio;

  const isBulk = entryMode === 'bulk' && splitCount > 1;
  const grandTotalDeposit = isBulk ? totalDepositAmount : summary.principalAmount;
  const grandTotalInterest = isBulk ? summary.totalInterest * splitCount : summary.totalInterest;
  const grandTotalMaturity = isBulk ? summary.maturityAmount * splitCount : summary.maturityAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div 
        ref={printAreaRef}
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:max-h-none print:shadow-none print:border-none print:w-full"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white px-5 py-4 flex items-center justify-between border-b border-indigo-800 print:bg-none print:text-black print:border-b-2 print:border-black print:px-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                मुदत ठेव व्याज वेळापत्रक तक्ता (FD Interest Accrual Chart)
              </h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] px-2 py-0.5 rounded-full font-semibold">
                {summary.schemeType === 'Cumulative' ? 'चक्रवाढ (Quarterly Compounding)' : (summary.isPeriodicPayout ? 'मासिक परतावा (MIS)' : 'साधी मुदत ठेव')}
              </span>
            </div>
            <p className="text-xs text-indigo-200/90 mt-0.5">
              योजना: <b className="text-white">{schemeName}</b> | व्याजदर: <b className="text-amber-300">{summary.interestRate}%</b> {isSeniorCitizen && <span className="text-amber-200 font-bold">(ज्येष्ठ नागरिक)</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors print:hidden"
            title="बंद करा (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 print:p-0 print:overflow-visible">
          {/* Customer & Account Context Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">ठेवीदार / सभासद नाव:</span>
              <b className="text-slate-800 font-semibold">{customerName}</b>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">CIF / सभासद क्र.:</span>
              <span className="font-mono font-medium text-slate-700">{memberCode || cifNo || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">ठेव तारीख:</span>
              <b className="text-slate-800">{formatDateDisplay(summary.openingDate)}</b>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">मुदतपूर्ती तारीख:</span>
              <b className="text-indigo-900 font-bold">{formatDateDisplay(summary.maturityDate)}</b>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-lg">
              <div className="text-[11px] font-medium text-blue-800">
                {isBulk ? 'प्रति पावती मुद्दल (₹)' : 'ठेव मुद्दल (Principal)'}
              </div>
              <div className="text-lg font-black text-blue-950 mt-0.5">
                {formatCurrency(summary.principalAmount)}
              </div>
              <div className="text-[10px] text-blue-700 mt-1 font-mono">
                एकूण दिवस: {summary.totalDays} दिवस
              </div>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-lg">
              <div className="text-[11px] font-medium text-emerald-800">
                {isBulk ? 'प्रति पावती एकूण व्याज (₹)' : (overdueDetails?.isOverdue && overdueDetails.overdueInterest > 0 ? 'करारानुसार देय व्याज' : 'एकूण मिळणारे व्याज (Gain)')}
              </div>
              <div className="text-lg font-black text-emerald-700 mt-0.5">
                {formatCurrency(summary.totalInterest)}
              </div>
              <div className="text-[10px] text-emerald-700 mt-1">
                {summary.periods.length} टप्पे (Periods)
              </div>
            </div>

            {overdueDetails && overdueDetails.isOverdue && overdueDetails.overdueInterest > 0 ? (
              <div className="bg-amber-50/80 border border-amber-300 p-3 rounded-lg">
                <div className="text-[11px] font-medium text-amber-900">
                  ओव्हरड्यू व्याज (Overdue Interest)
                </div>
                <div className="text-lg font-black text-amber-900 mt-0.5">
                  +{formatCurrency(overdueDetails.overdueInterest)}
                </div>
                <div className="text-[10px] text-amber-800 mt-1 font-mono">
                  {overdueDetails.overdueDays} दिवस @ {overdueDetails.effectiveOverdueRate}%
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-lg">
                <div className="text-[11px] font-medium text-amber-900">
                  {summary.isPeriodicPayout ? 'दरमहा व्याज परतावा' : (isBulk ? 'प्रति पावती मुदतपूर्ती' : 'मुदतपूर्ती रक्कम (Maturity)')}
                </div>
                <div className="text-lg font-black text-amber-950 mt-0.5">
                  {summary.isPeriodicPayout && summary.monthlyInterestAmount
                    ? formatCurrency(summary.monthlyInterestAmount)
                    : formatCurrency(summary.maturityAmount)}
                </div>
                <div className="text-[10px] text-amber-800 mt-1">
                  {summary.isPeriodicPayout ? 'दरमहा थेट बँक/बचत खात्यात' : 'मुदतअखेर पूर्ण परतावा'}
                </div>
              </div>
            )}

            <div className="bg-purple-50/70 border border-purple-200 p-3 rounded-lg">
              <div className="text-[11px] font-medium text-purple-900">
                {overdueDetails?.isOverdue && overdueDetails.overdueInterest > 0 ? 'अंतिम परतावा (Total Payout)' : 'एकूण परतावा लाभ (Total Benefit)'}
              </div>
              <div className="text-lg font-black text-purple-950 mt-0.5">
                {formatCurrency(overdueDetails?.isOverdue && overdueDetails.overdueInterest > 0 
                  ? summary.maturityAmount + overdueDetails.overdueInterest 
                  : summary.totalBenefit)}
              </div>
              <div className="text-[10px] text-purple-700 mt-1">
                {overdueDetails?.isOverdue && overdueDetails.overdueInterest > 0 
                  ? 'मुद्दल + करार व्याज + ओव्हरड्यू' 
                  : 'मुद्दल + एकूण कालावधीचे व्याज'}
              </div>
            </div>
          </div>

          {/* Bulk Mode Summary Callout */}
          {isBulk && (
            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-indigo-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                  बल्क पावती मोड (Bulk Split)
                </span>
                <span className="text-slate-700">
                  एकूण पावत्या: <b className="text-indigo-900">{splitCount}</b>
                </span>
              </div>
              <div className="flex items-center gap-3 font-semibold text-slate-800">
                <span>एकूण ठेव: <b className="text-blue-900">{formatCurrency(grandTotalDeposit)}</b></span>
                <span>एकूण सर्व पावत्यांचे व्याज: <b className="text-emerald-700">{formatCurrency(grandTotalInterest)}</b></span>
                <span>एकूण एकत्रित मुदतपूर्ती: <b className="text-indigo-950">{formatCurrency(grandTotalMaturity)}</b></span>
              </div>
            </div>
          )}

          {/* Visual Amortization Progress Bar */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg space-y-1.5 print:hidden">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                ठेव मुद्दल ({principalRatio}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                व्याज वाढ लाभ ({interestRatio}%)
              </span>
            </div>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
              <div 
                className="bg-blue-600 h-full transition-all duration-300" 
                style={{ width: `${principalRatio}%` }}
                title={`मुद्दल: ${formatCurrency(summary.principalAmount)}`}
              ></div>
              <div 
                className="bg-emerald-500 h-full transition-all duration-300" 
                style={{ width: `${interestRatio}%` }}
                title={`व्याज: ${formatCurrency(summary.totalInterest)}`}
              ></div>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>📅</span> टप्पानिहाय व्याज आकारणी वेळापत्रक (Period-wise Amortization Table)
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                सूत्र: (मुद्दल × {summary.interestRate}% × दिवस) / ३६५००
              </span>
            </div>
            <div className="overflow-x-auto max-h-72 print:max-h-none">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 text-[11px] uppercase font-bold sticky top-0 border-b border-slate-300">
                  <tr>
                    <th className="px-2 py-2 text-center w-10 border-r border-slate-200 whitespace-nowrap">क्र.</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap border-r border-slate-200">टप्पा (Period)</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap border-r border-slate-200">कालावधी (From - To)</th>
                    <th className="px-2 py-2 text-center whitespace-nowrap w-16 border-r border-slate-200">दिवस</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-200">आरंभी मुद्दल (₹)</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-200">या टप्प्याचे व्याज (₹)</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-200">एकूण साचलेले व्याज (₹)</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-200">अखेर शिल्लक (₹)</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">शेरा / स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {summary.periods.map((item, idx) => {
                    const isLast = idx === summary.periods.length - 1;
                    return (
                      <tr 
                        key={item.periodNo}
                        className={isLast ? 'bg-emerald-50/80 font-bold text-emerald-950' : (idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-50/80')}
                      >
                        <td className="px-2 py-2 text-center text-slate-500 font-mono border-r border-slate-100">{item.periodNo}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800 whitespace-nowrap border-r border-slate-100">{item.periodLabel}</td>
                        <td className="px-3 py-2 text-center font-mono text-[11px] whitespace-nowrap border-r border-slate-100">
                          <span className="text-slate-800">{formatDateDisplay(item.fromDate)}</span>
                          <span className="text-slate-400 font-sans mx-1.5 font-normal">ते</span>
                          <span className="text-slate-800">{formatDateDisplay(item.toDate)}</span>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-slate-700 border-r border-slate-100">{item.days}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap border-r border-slate-100">{formatCurrency(item.openingBalance)}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700 font-bold tabular-nums whitespace-nowrap border-r border-slate-100">
                          +{formatCurrency(item.interestAmount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap border-r border-slate-100">{formatCurrency(item.cumulativeInterest)}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900 font-bold tabular-nums whitespace-nowrap border-r border-slate-100">
                          {formatCurrency(item.closingBalance)}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-600 whitespace-nowrap">
                          {isLast && summary.schemeType === 'Cumulative' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              🎉 अंतिम मुदतपूर्ती
                            </span>
                          ) : item.statusNote}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Overdue Period Row if applicable */}
                  {overdueDetails && overdueDetails.isOverdue && overdueDetails.overdueInterest > 0 && (
                    <tr className="bg-amber-100/80 font-bold text-amber-950 border-t-2 border-amber-300">
                      <td className="px-2 py-2 text-center text-amber-900 font-mono border-r border-amber-200">+</td>
                      <td className="px-3 py-2 font-bold text-amber-950 whitespace-nowrap border-r border-amber-200">
                        ⚠️ ओव्हरड्यू व्याज (Overdue)
                      </td>
                      <td className="px-3 py-2 text-center font-mono text-[11px] whitespace-nowrap border-r border-amber-200">
                        <span className="text-amber-900">{formatDateDisplay(summary.maturityDate)}</span>
                        <span className="text-amber-600 font-sans mx-1.5 font-normal">ते</span>
                        <span className="text-amber-900">{formatDateDisplay(overdueDetails.closureDate)}</span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-amber-900 border-r border-amber-200">
                        {overdueDetails.overdueDays}d
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-900 tabular-nums whitespace-nowrap border-r border-amber-200">
                        {formatCurrency(overdueDetails.baseAmount)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-900 font-black tabular-nums whitespace-nowrap border-r border-amber-200">
                        +{formatCurrency(overdueDetails.overdueInterest)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-900 tabular-nums whitespace-nowrap border-r border-amber-200">
                        {formatCurrency(summary.totalInterest + overdueDetails.overdueInterest)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-amber-950 font-black tabular-nums whitespace-nowrap border-r border-amber-200">
                        {formatCurrency(summary.maturityAmount + overdueDetails.overdueInterest)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-amber-900 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-amber-200 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          मुदत संपल्यानंतरचा व्याज खर्च (@ {overdueDetails.effectiveOverdueRate}%)
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-right font-bold text-slate-800 border-r border-slate-200">
                      {overdueDetails?.isOverdue && overdueDetails.overdueInterest > 0 ? 'एकूण अंतिम देय परतावा (Total Final Payout):' : 'एकूण (Total):'}
                    </td>
                    <td className="px-2 py-2.5 text-center font-mono border-r border-slate-200">
                      {summary.totalDays + (overdueDetails?.isOverdue ? overdueDetails.overdueDays : 0)}d
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap border-r border-slate-200">
                      {formatCurrency(summary.principalAmount)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-800 font-black tabular-nums whitespace-nowrap border-r border-slate-200">
                      +{formatCurrency(summary.totalInterest + (overdueDetails?.isOverdue ? overdueDetails.overdueInterest : 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-800 tabular-nums whitespace-nowrap border-r border-slate-200">
                      {formatCurrency(summary.totalInterest + (overdueDetails?.isOverdue ? overdueDetails.overdueInterest : 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-indigo-950 font-black text-sm tabular-nums whitespace-nowrap border-r border-slate-200">
                      {formatCurrency(summary.maturityAmount + (overdueDetails?.isOverdue ? overdueDetails.overdueInterest : 0))}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-indigo-900 font-semibold whitespace-nowrap">
                      {overdueDetails?.isOverdue && overdueDetails.overdueInterest > 0 ? 'अंतिम रोख/बँक देय रक्कम' : 'मुदतपूर्ती देय रक्कम'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Explanatory Banking Note */}
          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1">
            <p>
              💡 <b>बँकिंग नियम नोंद:</b> वरील तक्ता ३६५ दिवसांच्या प्रत्यक्ष कॅलेंडर वर्षावर आणि तिमाही चक्रवाढ (Quarterly Compounding) नियमावर आधारित आहे. 
              प्रत्येक तिमाहीचे व्याज शासकीय नियमानुसार <b>पूर्णांक रुपयात (Nearest Whole Rupee)</b> राऊंड केले गेले आहे.
            </p>
            {overdueDetails && overdueDetails.isOverdue && overdueDetails.overdueInterest > 0 && (
              <p className="text-amber-900 font-semibold bg-amber-50 p-1.5 rounded border border-amber-200">
                ⚠️ <b>ओव्हरड्यू व्याज हिशोब:</b> ठेव मुदत संपल्यानंतर खातेदाराने {overdueDetails.overdueDays} दिवसांनी परतावा घेतला आहे. संस्थेच्या धोरणानुसार मुदतपूर्ती रकमेवर {overdueDetails.effectiveOverdueRate}% दराने {formatCurrency(overdueDetails.overdueInterest)} अतिरिक्त व्याज खर्च मंजूर करण्यात आला आहे.
              </p>
            )}
            {summary.isPeriodicPayout && (
              <p className="text-emerald-800 font-semibold">
                📌 मासिक परतावा योजनेमध्ये (MIS) दरमहा व्याज बचत खात्यात/रोख अदा केले जात असल्याने मुदतपूर्तीला मूळ ठेव मुद्दल रक्कम परत केली जाईल.
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 print:hidden">
          <div className="text-xs text-slate-500">
            {isBulk ? `बल्क मोड: एकूण ${splitCount} पावत्यांचे संयुक्त कॅल्क्युलेशन` : 'एकल ठेव पावती व्याज तक्ता'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>🖨️ वेळापत्रक प्रिंट करा</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              बंद करा (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

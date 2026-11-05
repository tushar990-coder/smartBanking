import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Printer, ArrowLeft, FileText } from 'lucide-react';
import { getAmountInWordsMarathi } from '../utils/marathiWords';
import { formatDisplayDate, SansthaDetails } from './common/CbsReportLayout';
import { useAuth } from '../context/AuthContext';
import './common/cbsPrintStyles.css';

interface VoucherPrintProps {
  voucherId: number;
  onBack: () => void;
}

const MARATHI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export const toMarathiNum = (val: string | number): string =>
  String(val).replace(/\d/g, (d) => MARATHI_DIGITS[Number(d)]);

export const fmtVoucherAmt = (val: number | undefined | null, marathi = false): string => {
  const num = Number(val || 0);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return marathi ? toMarathiNum(formatted) : formatted;
};

export default function VoucherPrint({ voucherId, onBack }: VoucherPrintProps) {
  const { user } = useAuth();
  const [voucher, setVoucher] = useState<any>(null);
  const [sanstha, setSanstha] = useState<SansthaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [signatureTier, setSignatureTier] = useState<'3-tier' | '4-tier'>('3-tier');
  const [digitMode, setDigitMode] = useState<'marathi' | 'english'>('english');

  useEffect(() => {
    fetchData();
  }, [voucherId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sansthaRes, voucherRes] = await Promise.all([
        axios.get('/api/SansthaDetails').catch(() => ({ data: [] })),
        axios.get(`/api/Vouchers/${voucherId}`)
      ]);

      if (sansthaRes.data) {
        if (Array.isArray(sansthaRes.data) && sansthaRes.data.length > 0) {
          setSanstha(sansthaRes.data[0]);
        } else if (!Array.isArray(sansthaRes.data)) {
          setSanstha(sansthaRes.data);
        }
      }

      if (voucherRes.data) {
        setVoucher(voucherRes.data);
      } else {
        alert('व्हाउचर सापडले नाही! (Voucher not found)');
        onBack();
      }
    } catch (error) {
      console.error(error);
      alert('व्हाउचर माहिती लोड करताना त्रुटी आली.');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    document.body.classList.remove(
      'cbs-print-a4-portrait',
      'cbs-print-a4-landscape',
      'cbs-print-legal-landscape',
      'cbs-print-a5-portrait'
    );
    document.body.classList.add('cbs-print-a4-portrait');
    window.print();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-600 text-xs font-semibold">
        व्हाउचर प्रिंट प्रिव्ह्यू लोड होत आहे...
      </div>
    );
  }

  if (!voucher) return null;

  return (
    <div className="cbs-report-wrapper p-2 sm:p-4 bg-slate-100 min-h-screen print:p-0 print:bg-white">
      {/* Unified CBS Action Toolbar */}
      <div className="cbs-toolbar bg-white px-3 py-1.5 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 no-print flex flex-wrap items-center justify-between gap-2 max-w-[210mm] mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FileText size={13} className="stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-gray-900 leading-none flex items-center gap-1">
              <span>अधिकृत व्हाउचर पावती प्रिव्ह्यू</span>
              <span className="text-[10px] font-normal text-slate-500 hidden sm:inline">(CBS Voucher Slip v2.4)</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10.5px] font-bold hidden md:inline">
            ✓ CBS Standard Reference Model v2.4
          </span>

          <select
            value={digitMode}
            onChange={(e) => setDigitMode(e.target.value as 'marathi' | 'english')}
            className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
            title="अंक भाषा निवडा"
          >
            <option value="english">Eng 1,2,3</option>
            <option value="marathi">मराठी १,२,३</option>
          </select>

          <div className="flex items-center gap-1">
            <label className="text-[10.5px] text-slate-600 font-semibold">स्वाक्षरी लेव्हल:</label>
            <select
              value={signatureTier}
              onChange={(e) => setSignatureTier(e.target.value as '3-tier' | '4-tier')}
              className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
            >
              <option value="3-tier">३-स्तरीय स्वाक्षरी (लिपिक, लेखापाल, व्यवस्थापक)</option>
              <option value="4-tier">४-स्तरीय स्वाक्षरी (+ चेअरमन / संचालक)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="h-6 bg-slate-600 hover:bg-slate-700 text-white px-2.5 py-0.5 rounded-xs text-[11px] font-semibold shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft size={12} />
            <span>मागे जा</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="h-6 bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-0.5 rounded-xs text-[11px] font-bold shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <Printer size={12} />
            <span>प्रिंट (A4)</span>
          </button>
        </div>
      </div>

      <VoucherPrintTemplate
        voucher={voucher}
        sanstha={sanstha}
        signatureTier={signatureTier}
        isMarathiDigits={digitMode === 'marathi'}
        preparedBy={user ? `${user.username} (${user.role})` : 'Admin'}
        branchName={voucher?.branch?.branchName || user?.branchName || 'मुख्य शाखा'}
      />
    </div>
  );
}

export interface VoucherPrintTemplateProps {
  voucher: any;
  sanstha: SansthaDetails | any;
  signatureTier?: '3-tier' | '4-tier';
  isMarathiDigits?: boolean;
  preparedBy?: string;
  branchName?: string;
}

export function VoucherPrintTemplate({
  voucher,
  sanstha,
  signatureTier = '3-tier',
  isMarathiDigits = false,
  preparedBy = 'Admin',
  branchName
}: VoucherPrintTemplateProps) {
  const d = (val: string | number) => (isMarathiDigits ? toMarathiNum(val) : String(val));

  const now = new Date();
  const timestampStr = `${now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

  const partyDetail =
    voucher.voucherDetails?.find(
      (det: any) => det.customer != null || det.member?.customer != null || det.member != null
    ) ||
    voucher.voucherDetails?.find(
      (det: any) => det.ledger?.ledgerName !== 'Cash' && !det.ledger?.ledgerName?.includes('रोख')
    );

  const partyCust = partyDetail?.customer || partyDetail?.member?.customer;
  const partyCif = partyCust?.cifNo || partyCust?.CIFNo || '';
  const partyLegacyNo = partyCust?.legacyCustomerNo || partyCust?.LegacyCustomerNo || '';
  const partyNameStr = [
    partyCust?.firstName || partyCust?.FirstName || partyDetail?.member?.firstName || partyDetail?.member?.FirstName || '',
    partyCust?.middleName || partyCust?.MiddleName || partyDetail?.member?.middleName || partyDetail?.member?.MiddleName || '',
    partyCust?.lastName || partyCust?.LastName || partyDetail?.member?.lastName || partyDetail?.member?.LastName || ''
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const partyCode = partyCif
    ? `${partyCif}${partyLegacyNo ? ` (जुना खा.नं: ${partyLegacyNo})` : ''}`
    : partyLegacyNo
    ? `जुना खा.नं: ${partyLegacyNo}`
    : '';

  const partyName =
    partyCode || partyNameStr
      ? `${partyCode ? `${partyCode} - ` : ''}${partyNameStr}`.trim()
      : partyDetail?.ledger?.ledgerName || 'संस्था अंतर्गत व्यवहार (Internal Ledger)';

  let vTypeMarathi = voucher.voucherType || 'व्हाउचर';
  let vTypeSubtitle = 'Accounting Voucher';
  if (voucher.voucherType === 'Receipt') {
    vTypeMarathi = 'जमा पावती';
    vTypeSubtitle = 'Receipt Voucher';
  } else if (voucher.voucherType === 'Payment') {
    vTypeMarathi = 'नावे पावती';
    vTypeSubtitle = 'Payment Voucher';
  } else if (voucher.voucherType === 'Contra') {
    vTypeMarathi = 'कॉन्ट्रा पावती';
    vTypeSubtitle = 'Contra Voucher';
  } else if (voucher.voucherType === 'Journal') {
    vTypeMarathi = 'जर्नल व्हाउचर';
    vTypeSubtitle = 'Journal Voucher';
  }

  const totalDr =
    voucher.voucherDetails
      ?.filter((det: any) => det.drCr === 'Dr')
      .reduce((sum: number, det: any) => sum + Number(det.amount || 0), 0) || 0;
  const totalCr =
    voucher.voucherDetails
      ?.filter((det: any) => det.drCr === 'Cr')
      .reduce((sum: number, det: any) => sum + Number(det.amount || 0), 0) || 0;
  const displayTotal = Math.max(totalDr, totalCr);

  const signatureList =
    signatureTier === '4-tier'
      ? [
          { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
          { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
          { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' },
          { title: 'अध्यक्ष / संचालक मंडळ', subtitle: '(Chairman / Board of Directors)' }
        ]
      : [
          { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
          { title: 'लेखापाल / तपासनीस', subtitle: '(Accountant / Checker)' },
          { title: 'व्यवस्थापक / शाखाधिकारी', subtitle: '(Manager / Secretary)' }
        ];

  const effectiveBranchName =
    voucher?.branch?.branchName || branchName || 'मुख्य शाखा (पडवळवाडी)';

  const statusText =
    voucher?.status === 'Approved'
      ? 'मंजूर (Approved)'
      : voucher?.status === 'Pending'
      ? 'प्रलंबित (Pending)'
      : voucher?.status || 'नोंदवलेले';

  return (
    <div
      className="cbs-voucher-slip bg-white p-3 sm:p-4 mx-auto rounded-xs shadow-md border border-slate-900 print:shadow-none print:border-slate-900 flex flex-col justify-between text-slate-900"
      style={{
        maxWidth: '210mm',
        minHeight: '136mm',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      <div>
        {/* 1. Standard CBS Compact Header (Matching CbsSampleReport.tsx) */}
        <div className="cbs-compact-header">
          <div className="cbs-reg-bar">
            <div>
              <span>रजि. नं.: </span>
              <span className="font-mono font-bold text-slate-900">
                {sanstha?.registrationNo || '-'}
              </span>
            </div>
            <div>
              <span>शाखा: </span>
              <span className="font-bold text-slate-900">{effectiveBranchName}</span>
            </div>
            <div>
              <span>रजि. दि.: </span>
              <span className="font-mono font-bold text-slate-900">
                {sanstha?.registrationDate ? d(formatDisplayDate(sanstha.registrationDate)) : '-'}
              </span>
            </div>
          </div>

          <h1 className="cbs-sanstha-title">
            {sanstha?.sansthaName || 'जोतिर्लिंग ग्रामीण बिगरशेती सह. पतसंस्था मर्या. पडवळवाडी'}
          </h1>

          <p className="cbs-address-text">
            {[
              sanstha?.address,
              !sanstha?.address?.includes(sanstha?.village || '___') && sanstha?.village
                ? `मु. ${sanstha.village}`
                : null,
              !sanstha?.address?.includes(sanstha?.taluka || '___') && sanstha?.taluka
                ? `ता. ${sanstha.taluka}`
                : null,
              !sanstha?.address?.includes(sanstha?.district || '___') && sanstha?.district
                ? `जि. ${sanstha.district}`
                : null,
              sanstha?.pinCode ? `पिन: ${sanstha.pinCode}` : null
            ]
              .filter(Boolean)
              .join(', ') || 'मु. पो. पडवळवाडी, ता. कडेगाव, जि. सांगली'}
          </p>
        </div>

        {/* 2. CBS Report Ribbon */}
        <div className="cbs-ribbon">
          <div className="cbs-ribbon-title flex items-center gap-1.5">
            <span>{vTypeMarathi}</span>
            <span className="text-[9.5px] font-normal text-slate-600">({vTypeSubtitle})</span>
          </div>
          <div className="cbs-ribbon-meta flex items-center gap-3">
            <span>
              <span className="text-slate-600 font-medium">पावती क्र.: </span>
              <span className="font-mono font-bold text-slate-950">{d(voucher.voucherNo || '-')}</span>
              {voucher.scrollNo ? (
                <span className="ml-1 text-primary font-extrabold text-[9.5px]">
                  (स्क्रॉल #{d(voucher.scrollNo)})
                </span>
              ) : null}
            </span>
            <span>
              <span className="text-slate-600 font-medium">दिनांक: </span>
              <span className="font-mono font-bold text-slate-950">
                {d(formatDisplayDate(voucher.voucherDate))}
              </span>
            </span>
          </div>
        </div>

        {/* 3. CBS Summary Banner (4-Column Grid Matching CbsSampleReport.tsx) */}
        <div className="cbs-summary-banner">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">
                व्हाउचर / पावती क्र.
              </span>
              <strong className="text-primary font-mono text-[11px]">
                {d(voucher.voucherNo || '-')}
                {voucher.scrollNo ? (
                  <span className="text-slate-500 font-normal ml-1">(#{d(voucher.scrollNo)})</span>
                ) : null}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">
                पार्टी / खातेदाराचे नाव
              </span>
              <strong className="text-slate-900 text-[11px] truncate block" title={partyName}>
                {d(partyName)}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">
                व्हाउचर प्रकार / स्थिती
              </span>
              <strong className="text-slate-900 text-[11px] truncate block">
                {vTypeMarathi} <span className="text-slate-500 font-normal">({statusText})</span>
              </strong>
            </div>
            <div className="sm:text-right">
              <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">
                व्हाउचर एकूण रक्कम
              </span>
              <strong className="text-emerald-700 font-mono text-xs">
                ₹ {fmtVoucherAmt(displayTotal, isMarathiDigits)}
              </strong>
            </div>
          </div>
        </div>

        {/* 4. CBS Standard Table (Matching CbsSampleReport.tsx) */}
        <table className="cbs-table w-full border-collapse border border-slate-900 text-xs mb-2">
          <thead>
            <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
              <th className="border border-slate-900 py-1 px-1 w-[7%] text-center">अ.क्र.</th>
              <th className="border border-slate-900 py-1 px-1.5 w-[13%] text-center">लेजर कोड</th>
              <th className="border border-slate-900 py-1 px-2.5 w-[50%] text-left">
                खाते / तपशील (Ledger &amp; Sub-Ledger Particulars)
              </th>
              <th className="border border-slate-900 py-1 px-2 w-[15%] text-right">नावे (Dr ₹)</th>
              <th className="border border-slate-900 py-1 px-2 w-[15%] text-right">जमा (Cr ₹)</th>
            </tr>
          </thead>
          <tbody>
            {voucher.voucherDetails?.map((det: any, index: number) => {
              const cust = det.customer || det.member?.customer;
              const cif = cust?.cifNo || cust?.CIFNo || '';
              const legacyNo = cust?.legacyCustomerNo || cust?.LegacyCustomerNo || '';
              const name = [
                cust?.firstName || cust?.FirstName || det.member?.firstName || det.member?.FirstName || '',
                cust?.middleName || cust?.MiddleName || det.member?.middleName || det.member?.MiddleName || '',
                cust?.lastName || cust?.LastName || det.member?.lastName || det.member?.LastName || ''
              ]
                .filter(Boolean)
                .join(' ')
                .trim();

              const code = cif
                ? `${cif}${legacyNo ? ` | जुना खा.नं: ${legacyNo}` : ''}`
                : legacyNo
                ? `जुना खा.नं: ${legacyNo}`
                : '';

              const ledgerCode =
                det.ledger?.ledgerCode || det.ledger?.legacyAccountCode || det.ledgerID || '-';

              return (
                <tr key={det.voucherDetailID || index} className="hover:bg-slate-50 text-slate-900 text-[11px]">
                  <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                    {d(index + 1)}
                  </td>
                  <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-slate-800">
                    {d(ledgerCode)}
                  </td>
                  <td className="border border-slate-900 py-1 px-2.5">
                    <span className="font-bold text-slate-900">{det.ledger?.ledgerName || '-'}</span>
                    {(code || name) && (
                      <span className="block text-[10px] text-slate-600 font-medium mt-0.5">
                        खातेदार: {d(code ? `${code} - ${name}` : name)}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-dr">
                    {det.drCr === 'Dr' ? fmtVoucherAmt(det.amount, isMarathiDigits) : '-'}
                  </td>
                  <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-cr">
                    {det.drCr === 'Cr' ? fmtVoucherAmt(det.amount, isMarathiDigits) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
              <td colSpan={3} className="border border-slate-900 py-1 px-2.5 text-right uppercase tracking-wider">
                एकूण व्यवहार रक्कम (Total):
              </td>
              <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-dr font-bold">
                ₹ {fmtVoucherAmt(totalDr, isMarathiDigits)}
              </td>
              <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-cr font-bold">
                ₹ {fmtVoucherAmt(totalCr, isMarathiDigits)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* 5. Narration & Amount in Words Strip */}
        <div className="border border-slate-300 bg-slate-50/70 print:bg-white rounded-xs px-2.5 py-1.5 text-[10.5px] space-y-1">
          <div className="flex items-start gap-1.5">
            <span className="font-bold text-slate-700 shrink-0">तपशील (Narration):</span>
            <span className="text-slate-900 font-medium">{d(voucher.narration || '-')}</span>
          </div>
          <div className="flex items-center gap-1.5 border-t border-dashed border-slate-300 pt-1">
            <span className="font-bold text-slate-700 shrink-0">अक्षरी रक्कम:</span>
            <span className="font-extrabold text-slate-950">
              {getAmountInWordsMarathi(displayTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* 6. CBS Statutory Signatures & Audit Stamp Footer */}
      <div className="cbs-footer-group mt-2">
        <div
          className="cbs-signature-strip"
          style={{
            marginTop: '10px',
            paddingTop: '4px',
            gridTemplateColumns: `repeat(${signatureList.length}, minmax(0, 1fr))`
          }}
        >
          {signatureList.map((sig, idx) => (
            <div key={idx} className="cbs-sig-col">
              <div className="cbs-sig-line" style={{ margin: '20px 8px 2px 8px' }}>
                {sig.title}
              </div>
              {sig.subtitle && <div className="cbs-sig-sub">{sig.subtitle}</div>}
            </div>
          ))}
        </div>

        <div className="cbs-audit-footer" style={{ marginTop: '6px' }}>
          <div>
            <span>प्रिंट दिनांक व वेळ: </span>
            <strong className="text-slate-800">{timestampStr}</strong>
          </div>
          <div>
            <span>तयार करणार: </span>
            <strong className="text-slate-800">{preparedBy}</strong>
          </div>
          <div>
            <span>प्रणाली: </span>
            <strong className="text-slate-800">SmartBanking CBS v2.4</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

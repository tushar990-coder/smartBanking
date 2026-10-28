import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Printer, 
  Share2, 
  X, 
  Sparkles, 
  CheckCircle2, 
  Image as ImageIcon, 
  FileText, 
  Building2,
  ZoomIn
} from 'lucide-react';
import { getAmountInWordsMarathi } from '../utils/marathiWords';

export interface GoldLoanReceiptItem {
  srNo?: number;
  ornamentName: string;
  quantity: number;
  grossWeight: number;
  netWeight: number;
  purity: number | string;
  goldRatePerGram: number;
  estimatedValue: number;
  valuerValuation?: number;
  valuerName?: string | null;
  valuationReceiptNo?: string | null;
  valuationDate?: string | null;
  imagePath?: string | null;
  remarks?: string | null;
}

export interface GoldLoanReceiptData {
  receiptNo?: string;
  receiptDate?: string;
  loanAccountNo?: string;
  applicationNo?: string;
  loanApplicationID?: number;
  loanAccountID?: number;
  borrowerName: string;
  cifNo?: string;
  memberCode?: string;
  mobileNo?: string;
  address?: string;
  loanSchemeName?: string;
  sanctionedAmount?: number;
  disbursedAmount?: number;
  interestRate?: number;
  durationMonths?: number;
  valuerName?: string;
  valuationReceiptNo?: string;
  valuationDate?: string;
  items: GoldLoanReceiptItem[];
  branchName?: string;
  sansthaInfo?: any;
}

interface Props {
  data?: GoldLoanReceiptData;
  receiptData?: GoldLoanReceiptData;
  isOpen?: boolean;
  activeSanstha?: any;
  onClose: () => void;
}

export default function GoldLoanReceiptPrintModal({ 
  data: propData, 
  receiptData, 
  isOpen = true, 
  activeSanstha, 
  onClose 
}: Props) {
  const data = receiptData || propData;
  if (!isOpen || !data) return null;

  const [sanstha, setSanstha] = useState<any>(activeSanstha || data.sansthaInfo || null);
  const [showPhotos, setShowPhotos] = useState<boolean>(true);
  const [printCopyType, setPrintCopyType] = useState<'single' | 'dual'>('single');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sanstha) {
      axios.get('/api/SansthaDetails')
        .then(res => {
          if (res.data && res.data.length > 0) {
            setSanstha(res.data[0]);
          }
        })
        .catch(err => console.error('Failed to load Sanstha details:', err));
    }
  }, [sanstha]);

  const items = data.items || [];
  const totalQty = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
  const totalGross = items.reduce((sum, i) => sum + (Number(i.grossWeight) || 0), 0);
  const totalNet = items.reduce((sum, i) => sum + (Number(i.netWeight) || 0), 0);
  const totalSystemVal = items.reduce((sum, i) => sum + (Number(i.estimatedValue) || 0), 0);
  const totalValuerVal = items.reduce((sum, i) => sum + (Number(i.valuerValuation) || Number(i.estimatedValue) || 0), 0);
  
  const officialValuation = totalValuerVal > 0 ? totalValuerVal : totalSystemVal;
  const valuationInWords = getAmountInWordsMarathi(Math.round(officialValuation));

  // Determine Primary Goldsmith Name and Receipt No from items if not at root
  const primaryValuer = data.valuerName || items.find(i => i.valuerName)?.valuerName || '-';
  const primaryValuerReceipt = data.valuationReceiptNo || items.find(i => i.valuationReceiptNo)?.valuationReceiptNo || '-';
  const primaryValuerDate = data.valuationDate || items.find(i => i.valuationDate)?.valuationDate || data.receiptDate || new Date().toISOString().split('T')[0];

  const fmtCurrency = (n: number) => {
    return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtWeight = (n: number) => {
    return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const formatDate = (dStr?: string | null) => {
    if (!dStr) return '-';
    try {
      const clean = dStr.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const sName = sanstha?.sansthaName || 'सहकारी पतसंस्था';
    const accNo = data.loanAccountNo || data.applicationNo || '-';
    const cleanMob = (data.mobileNo || '').replace(/\D/g, '');

    let itemLines = items.map((it, idx) => 
      `${idx + 1}. *${it.ornamentName}* | नग: ${it.quantity} | ग्रॉस: ${fmtWeight(it.grossWeight)}g | निव्वळ: ${fmtWeight(it.netWeight)}g | शुद्धता: ${it.purity} | व्हॅल्युएशन: ₹${fmtCurrency(it.valuerValuation || it.estimatedValue)}`
    ).join('\n');

    const msg = 
`🏦 *${sName}*
----------------------------------------
📜 *सुवर्ण कर्ज तारण ठेव पावती व मूल्यांकन प्रमाणपत्र*

नमस्कार *${data.borrowerName}*,
आपल्या सुवर्ण कर्ज खात्यांतर्गत खालील सुवर्ण अलंकार संस्थेच्या सुरक्षित लॉकरमध्ये तारण म्हणून जमा करण्यात आले आहेत:

📄 *पावती क्र.:* ${data.receiptNo || 'GLR-' + (data.loanAccountID || Date.now())}
🗓️ *दिनांक:* ${formatDate(data.receiptDate || new Date().toISOString().split('T')[0])}
🔢 *कर्ज खाते / अर्ज क्र.:* ${accNo}
📊 *कर्ज योजना:* ${data.loanSchemeName || 'सुवर्ण तारण कर्ज'}
💰 *मंजूर रक्कम:* ₹${(data.sanctionedAmount || 0).toLocaleString('en-IN')}

📦 *तारण ठेवलेल्या दागिन्यांचा तपशील:*
${itemLines}

----------------------------------------
⚖️ *एकूण नग:* ${totalQty}
⚖️ *एकूण निव्वळ वजन:* ${fmtWeight(totalNet)} ग्रॅम
💎 *एकूण अधिकृत मूल्यांकन:* ₹${fmtCurrency(officialValuation)}
(अक्षरी: ${valuationInWords})

🏛️ *अधिकृत सोनार:* ${primaryValuer}
📝 *सराफ पावती क्र.:* ${primaryValuerReceipt}

🔒 *हमी:* सदर दागिने संस्थेच्या सुरक्षित लॉकरमध्ये सीलबंद स्थितीत सुरक्षित आहेत.
धन्यवाद! 🙏
*${sName}*`;

    const encoded = encodeURIComponent(msg);
    const targetUrl = cleanMob ? `https://api.whatsapp.com/send?phone=91${cleanMob}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(targetUrl, '_blank');
  };

  const renderSingleReceiptCopy = (copyLabel: string) => {
    return (
      <div className="border-2 border-gray-900 p-4 sm:p-5 bg-white relative text-gray-950 font-sans shadow-sm my-2 print:my-0 print:border-gray-900 print:p-4">
        
        {/* Copy Badge */}
        <div className="absolute right-3 top-2 text-[10px] font-bold uppercase tracking-wider bg-gray-100 border border-gray-400 px-2 py-0.5 rounded print:border-gray-900">
          {copyLabel}
        </div>

        {/* Official Sanstha Header Box */}
        <div className="border-b-2 border-gray-900 pb-2 text-center">
          <div className="flex justify-between items-center text-[10.5px] font-bold text-gray-800 mb-1">
            <span>रजि. नं. : <strong className="font-mono text-gray-950">{sanstha?.registrationNo || '-'}</strong></span>
            <span>रजि. दि. : <strong className="font-mono text-gray-950">{formatDate(sanstha?.registrationDate)}</strong></span>
          </div>

          <h1 className="text-base sm:text-lg font-black text-gray-950 tracking-wide uppercase font-serif">
            {sanstha?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
          </h1>
          <p className="text-[11px] font-semibold text-gray-700">
            {sanstha?.address || ''} {sanstha?.village ? `मु. ${sanstha.village}, ` : ''}{sanstha?.taluka ? `ता. ${sanstha.taluka}, ` : ''}{sanstha?.district ? `जि. ${sanstha.district}` : ''}
            {sanstha?.phone ? ` | फोन : ${sanstha.phone}` : ''}
          </p>
          <div className="mt-1 inline-block bg-amber-50 border border-amber-300 px-3 py-0.5 rounded text-[11px] font-bold text-amber-950 print:border-gray-900 print:bg-gray-100">
            शाखा: {data.branchName || 'मुख्य शाखा'}
          </div>
        </div>

        {/* Title Banner */}
        <div className="text-center my-2">
          <span className="inline-block border-2 border-gray-900 bg-gray-100 px-4 py-0.5 font-black text-xs sm:text-[13px] tracking-wider uppercase font-serif shadow-2xs">
            सुवर्ण कर्ज तारण ठेव पावती व मूल्यांकन प्रमाणपत्र
          </span>
          <div className="text-[9.5px] text-gray-600 font-mono mt-0.5">
            (Gold Loan Collateral Deposit & Valuer Certificate)
          </div>
        </div>

        {/* Metadata Grid (Compact CBS Standard) */}
        <div className="border border-gray-900 p-2 bg-gray-50/50 rounded-xs text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2 print:bg-white print:border-gray-900">
          <div>
            <span className="text-gray-600 font-medium block text-[10px]">पावती क्र. (Receipt No):</span>
            <strong className="font-mono text-gray-950 text-xs">
              {data.receiptNo || `GLR-${new Date().getFullYear()}-${String(data.loanAccountID || data.loanApplicationID || '001').padStart(4, '0')}`}
            </strong>
          </div>
          <div>
            <span className="text-gray-600 font-medium block text-[10px]">पावती दिनांक (Date):</span>
            <strong className="font-mono text-gray-950">
              {formatDate(data.receiptDate || new Date().toISOString().split('T')[0])}
            </strong>
          </div>
          <div>
            <span className="text-gray-600 font-medium block text-[10px]">कर्ज खाते / अर्ज क्र.:</span>
            <strong className="font-mono text-gray-950">
              {data.loanAccountNo || (data.applicationNo ? `अर्ज: ${data.applicationNo}` : '-')}
            </strong>
          </div>
          <div>
            <span className="text-gray-600 font-medium block text-[10px]">कर्ज योजना (Scheme):</span>
            <strong className="text-primary font-bold">
              {data.loanSchemeName || 'सुवर्ण तारण कर्ज'}
            </strong>
          </div>

          <div className="col-span-2">
            <span className="text-gray-600 font-medium block text-[10px]">कर्जदार सभासद नाव:</span>
            <strong className="text-gray-950 text-xs">{data.borrowerName}</strong>
            {data.cifNo && <span className="text-[10px] text-gray-600 ml-1 font-mono">[CIF: {data.cifNo}]</span>}
            {data.memberCode && <span className="text-[10px] text-gray-600 ml-1 font-mono">[सभासद: {data.memberCode}]</span>}
          </div>
          <div>
            <span className="text-gray-600 font-medium block text-[10px]">मोबाईल नंबर:</span>
            <strong className="font-mono text-gray-950">{data.mobileNo || '-'}</strong>
          </div>
          <div>
            <span className="text-gray-600 font-medium block text-[10px]">मंजूर मर्यादा / रक्कम:</span>
            <strong className="font-mono text-emerald-800 font-black">
              ₹{(data.sanctionedAmount || 0).toLocaleString('en-IN')}
            </strong>
            {data.interestRate ? <span className="text-[9.5px] text-gray-600 ml-1">(@{data.interestRate}% p.a.)</span> : null}
          </div>
          {data.address && (
            <div className="col-span-2 sm:col-span-4 text-[10px] text-gray-700">
              <span>पत्ता: </span><strong>{data.address}</strong>
            </div>
          )}
        </div>

        {/* Pledged Gold Ornaments Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-gray-900 text-[10.5px]">
            <thead>
              <tr className="bg-gray-100 text-gray-900 border-b-2 border-gray-900 text-center font-bold">
                <th className="border border-gray-900 py-1 px-1 w-[5%]">अ.क्र.</th>
                <th className="border border-gray-900 py-1 px-2 w-[22%] text-left">दागिन्याचे नाव (Ornament)</th>
                <th className="border border-gray-900 py-1 px-1 w-[6%]">नग</th>
                <th className="border border-gray-900 py-1 px-1.5 w-[10%] text-right">ग्रॉस वजन</th>
                <th className="border border-gray-900 py-1 px-1.5 w-[10%] text-right">निव्वळ वजन</th>
                <th className="border border-gray-900 py-1 px-1 w-[9%] text-center">कॅरेट</th>
                <th className="border border-gray-900 py-1 px-1.5 w-[9%] text-right">दर / ग्रॅम</th>
                <th className="border border-gray-900 py-1 px-2 w-[14%] text-right">सोनार मूल्यांकन (₹)</th>
                <th className="border border-gray-900 py-1 px-2 w-[15%] text-left">शेरा / हॉलमार्क</th>
                {showPhotos && (
                  <th className="border border-gray-900 py-1 px-1 w-[8%] text-center no-print-force">फोटो</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={showPhotos ? 10 : 9} className="text-center py-4 text-gray-500 font-medium border border-gray-900">
                    कोणतेही सुवर्ण तारण दागिने जोडलेले नाहीत.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 text-gray-900">
                    <td className="border border-gray-900 py-1 px-1 text-center font-mono">
                      {idx + 1}
                    </td>
                    <td className="border border-gray-900 py-1 px-2 font-bold text-gray-900">
                      {item.ornamentName}
                    </td>
                    <td className="border border-gray-900 py-1 px-1 text-center font-mono font-bold">
                      {item.quantity || 1}
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                      {fmtWeight(item.grossWeight)} g
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-bold text-amber-950">
                      {fmtWeight(item.netWeight)} g
                    </td>
                    <td className="border border-gray-900 py-1 px-1 text-center font-mono font-semibold">
                      {item.purity}
                    </td>
                    <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                      ₹{item.goldRatePerGram?.toLocaleString('en-IN')}
                    </td>
                    <td className="border border-gray-900 py-1 px-2 text-right font-mono font-black text-gray-950">
                      ₹{fmtCurrency(item.valuerValuation || item.estimatedValue)}
                    </td>
                    <td className="border border-gray-900 py-1 px-2 text-gray-700 text-[10px]">
                      {item.remarks || '-'}
                    </td>
                    {showPhotos && (
                      <td className="border border-gray-900 py-0.5 px-1 text-center no-print-force">
                        {item.imagePath ? (
                          <button
                            type="button"
                            onClick={() => setPreviewPhoto(item.imagePath || null)}
                            className="inline-block relative group cursor-pointer"
                            title="फोटो मोठा करा"
                          >
                            <img
                              src={item.imagePath}
                              alt="Gold"
                              className="w-7 h-7 object-cover mx-auto rounded border border-gray-300"
                            />
                            <ZoomIn className="w-3 h-3 text-white absolute inset-0 m-auto opacity-0 group-hover:opacity-100 bg-black/40 rounded p-0.5" />
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[9px]">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold text-gray-950 border-t-2 border-gray-900 text-[11px]">
                <td colSpan={2} className="border border-gray-900 py-1 px-2 text-right font-bold uppercase">
                  एकूण (Total):
                </td>
                <td className="border border-gray-900 py-1 px-1 text-center font-mono font-black">
                  {totalQty}
                </td>
                <td className="border border-gray-900 py-1 px-1.5 text-right font-mono">
                  {fmtWeight(totalGross)} g
                </td>
                <td className="border border-gray-900 py-1 px-1.5 text-right font-mono font-black text-amber-950">
                  {fmtWeight(totalNet)} g
                </td>
                <td colSpan={2} className="border border-gray-900 py-1 px-1.5 text-right text-gray-600 font-semibold text-[10px]">
                  एकूण मूल्यांकन:
                </td>
                <td className="border border-gray-900 py-1 px-2 text-right font-mono font-black text-emerald-900 text-xs">
                  ₹{fmtCurrency(officialValuation)}
                </td>
                <td colSpan={showPhotos ? 2 : 1} className="border border-gray-900 py-1 px-1 text-center text-[10px]">
                  -
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in Marathi Words Strip */}
        <div className="mt-1.5 p-1.5 bg-amber-50/70 border border-amber-300 rounded-xs text-[10.5px] font-bold text-amber-950 flex flex-wrap justify-between items-center print:border-gray-900 print:bg-gray-50">
          <span>
            अक्षरी अधिकृत मूल्यांकन: <span className="underline decoration-amber-600">{valuationInWords}</span>
          </span>
          <span className="font-mono text-gray-700">
            [एकूण निव्वळ शुद्ध सोने: {fmtWeight(totalNet)} ग्रॅम]
          </span>
        </div>

        {/* Goldsmith / Valuer Official Verification Strip */}
        <div className="mt-1.5 p-1.5 border border-gray-800 rounded-xs text-[10px] grid grid-cols-1 sm:grid-cols-3 gap-1 bg-gray-50/60 print:bg-white print:border-gray-900">
          <div>
            <span className="text-gray-600">अधिकृत सोनार / सराफ: </span>
            <strong className="text-gray-900 font-bold">{primaryValuer}</strong>
          </div>
          <div>
            <span className="text-gray-600">सराफ पावती / प्रमाणपत्र क्र.: </span>
            <strong className="font-mono text-gray-900 font-bold">{primaryValuerReceipt}</strong>
          </div>
          <div>
            <span className="text-gray-600">मूल्यांकन दिनांक: </span>
            <strong className="font-mono text-gray-900 font-bold">{formatDate(primaryValuerDate)}</strong>
          </div>
        </div>

        {/* Statutory Terms & Conditions Box */}
        <div className="mt-2 p-1.5 border border-gray-400 rounded-xs text-[9px] text-gray-800 leading-tight bg-slate-50/40 print:bg-white print:border-gray-700">
          <div className="font-bold text-gray-950 mb-0.5 underline">सुवर्ण तारण नियम, हमी व वैधानिक अटी:</div>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>सदर तारण ठेवलेल्या सुवर्ण अलंकारांचे वजन व कॅरेट शुद्धता अधिकृत सराफ / व्हॅल्युअर यांच्या उपस्थितीत कर्जदारासमोर प्रमाणित केली आहे.</li>
            <li>सदर सर्व सुवर्ण अलंकार संस्थेच्या सुरक्षित लॉकरमध्ये (Strong Room / Safe Locker) सीलबंद पाकिटात सुरक्षित ठेवण्यात आले आहेत.</li>
            <li>कर्ज मुद्दल व संपूर्ण व्याज आणि इतर शुल्काची नियमित परतफेड पूर्ण झाल्यानंतरच तारण अलंकार प्रत्यक्ष कर्जदार सभासदास परत केले जातील.</li>
            <li>कर्जदाराने ठरलेल्या मुदतीत कर्ज परतफेड न केल्यास किंवा मुदतवाढ न घेतल्यास संस्थेला कायदेशीर नोटीस देऊन दागिन्यांचा जाहीर लिलाव करण्याचा पूर्ण अधिकार राहील.</li>
          </ol>
        </div>

        {/* 4 Official Bank Signature Blocks */}
        <div className="mt-6 pt-2 grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-gray-900 border-t border-dashed border-gray-500 print:mt-8 print:border-gray-900">
          <div className="flex flex-col justify-end h-12">
            <div className="border-t border-gray-800 pt-1">कर्जदार सभासद स्वाक्षरी</div>
          </div>
          <div className="flex flex-col justify-end h-12">
            <div className="border-t border-gray-800 pt-1">अधिकृत सोनार / सराफ</div>
          </div>
          <div className="flex flex-col justify-end h-12">
            <div className="border-t border-gray-800 pt-1">रोखपाल / लिपिक स्वाक्षरी</div>
          </div>
          <div className="flex flex-col justify-end h-12">
            <div className="border-t border-gray-800 pt-1">शाखा व्यवस्थापक स्वाक्षरी</div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      
      {/* Print Specific CSS */}
      <style>
        {`
          @media print {
            @page {
              size: A4 portrait;
              margin: 6mm 8mm 6mm 8mm;
            }
            body * {
              visibility: hidden;
            }
            .print-receipt-modal, .print-receipt-modal * {
              visibility: visible;
            }
            .print-receipt-modal {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              background: transparent !important;
            }
            .no-print {
              display: none !important;
            }
            .no-print-force {
              display: none !important;
            }
            table {
              page-break-inside: avoid;
            }
            tr {
              page-break-inside: avoid;
            }
          }
        `}
      </style>

      <div className="bg-slate-100 rounded-md shadow-2xl w-full max-w-4xl max-h-[96vh] flex flex-col overflow-hidden border border-amber-300">
        
        {/* Modal Top Control Bar (Hidden on Print) */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-yellow-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm no-print">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-200" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold tracking-wide flex items-center gap-1.5">
                <span>सुवर्ण कर्ज तारण ठेव पावती व मूल्यांकन प्रमाणपत्र</span>
                <span className="text-[10px] bg-amber-950/70 text-amber-200 px-1.5 py-0.2 rounded font-mono">
                  {data.loanAccountNo || data.applicationNo || 'RECEIPT'}
                </span>
              </h3>
              <p className="text-[10px] text-amber-200 font-medium">
                अधिकृत बँक फॉरमॅट A4 प्रिंट, डिजिटल रेकॉर्ड व थेट WhatsApp शेअर
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Dual/Single Copy */}
            <div className="flex items-center bg-amber-950/60 p-0.5 rounded border border-amber-600 text-[10px]">
              <button
                type="button"
                onClick={() => setPrintCopyType('single')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${printCopyType === 'single' ? 'bg-amber-500 text-gray-950' : 'text-amber-200 hover:text-white'}`}
                title="फक्त १ प्रत प्रिंट करा"
              >
                एकल प्रत (Single)
              </button>
              <button
                type="button"
                onClick={() => setPrintCopyType('dual')}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${printCopyType === 'dual' ? 'bg-amber-500 text-gray-950' : 'text-amber-200 hover:text-white'}`}
                title="सभासद प्रत + बँक प्रत दोन प्रती"
              >
                दुहेरी प्रत (Dual)
              </button>
            </div>

            {/* Toggle Photos */}
            <label className="flex items-center gap-1 text-[10.5px] font-semibold text-amber-100 cursor-pointer bg-amber-950/50 px-2 py-1 rounded border border-amber-600">
              <input
                type="checkbox"
                checked={showPhotos}
                onChange={(e) => setShowPhotos(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-500 rounded"
              />
              <span>फोटो दाखवा</span>
            </label>

            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
              title="ग्राहकाच्या मोबाईलवर WhatsApp पावती पाठवा"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="bg-primary hover:opacity-90 text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer border border-primary/50"
              title="A4 पावती प्रिंट करा"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>प्रिंट (A4)</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-amber-950/80 w-7 h-7 flex items-center justify-center rounded-full transition font-bold text-base cursor-pointer"
              title="बंद करा"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3 overflow-y-auto flex-1 bg-slate-200/70">
          <div ref={receiptRef} className="print-receipt-modal max-w-3xl mx-auto space-y-4">
            
            {/* Copy 1: Member Copy / Main */}
            {renderSingleReceiptCopy(printCopyType === 'dual' ? 'सभासद प्रत (Borrower Copy)' : 'अधिकृत पावती (Official Collateral Receipt)')}

            {/* Copy 2: Bank Office Copy (if Dual selected) */}
            {printCopyType === 'dual' && (
              <div className="pt-2 border-t-2 border-dashed border-gray-400 print:pt-4">
                {renderSingleReceiptCopy('बँक कार्यालयीन प्रत (Bank Office Copy)')}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Image Zoom Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative max-w-xl max-h-[85vh] bg-white rounded p-2">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shadow cursor-pointer"
            >
              ✕
            </button>
            <img
              src={previewPhoto}
              alt="Ornament Full View"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded"
            />
            <div className="text-center text-xs font-bold text-gray-700 mt-2">
              दागिन्याचा अधिकृत फोटो (Pledged Ornament Photo)
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

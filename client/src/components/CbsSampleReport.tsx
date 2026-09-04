import React, { useState } from 'react';
import CbsReportLayout, { CbsPaperSize } from './common/CbsReportLayout';
import * as XLSX from 'xlsx';

export default function CbsSampleReport() {
  const [paperSize, setPaperSize] = useState<CbsPaperSize>('a4-portrait');
  const [signatureTier, setSignatureTier] = useState<'3-tier' | '4-tier'>('3-tier');

  // Sample Sanstha Data from Section 4 of Audit Report
  const sampleSanstha = {
    sansthaName: 'जोतिर्लिंग ग्रामीण बिगरशेती सह. पतसंस्था मर्या. पडवळवाडी',
    registrationNo: 'PDW/123/2018',
    registrationDate: '2018-12-17',
    address: 'मु. पो. पडवळवाडी, ता. कडेगाव, जि. सांगली',
    village: 'पडवळवाडी',
    taluka: 'कडेगाव',
    district: 'सांगली'
  };

  // Sample Member Statement Data from Audit Specification
  const sampleMember = {
    memberCode: 'MEM0099',
    legacyNo: '102',
    name: 'विमल भीमराव खोत',
    ledger: 'भाग भांडवल खाते (Share Capital)',
    openingBalance: 500.0,
    closingBalance: 570.0,
    fromDate: '2026-04-01',
    toDate: '2027-03-31'
  };

  const sampleTransactions = [
    {
      sr: 1,
      date: '15/05/2026',
      voucherNo: 'VCH-102',
      particulars: 'शेअर्स लाभांश वर्ग (Share Dividend Credit)',
      dr: 0,
      cr: 70.0,
      balance: 570.0
    }
  ];

  const handleExportExcel = () => {
    const excelData = [
      {
        'अ.क्र.': '-',
        'दिनांक': '01/04/2026',
        'व्हाउचर क्र.': '-',
        'तपशील': 'आरंभीची शिल्लक (Op.Bal)',
        'नावे (Dr ₹)': '',
        'जमा (Cr ₹)': '',
        'शिल्लक (Balance ₹)': 500.0
      },
      {
        'अ.क्र.': 1,
        'दिनांक': '15/05/2026',
        'व्हाउचर क्र.': 'VCH-102',
        'तपशील': 'शेअर्स लाभांश वर्ग',
        'नावे (Dr ₹)': '',
        'जमा (Cr ₹)': 70.0,
        'शिल्लक (Balance ₹)': 570.0
      },
      {
        'अ.क्र.': '',
        'दिनांक': '31/03/2027',
        'व्हाउचर क्र.': '',
        'तपशील': 'एकूण व्यवहार / अखेर शिल्लक',
        'नावे (Dr ₹)': 0,
        'जमा (Cr ₹)': 70.0,
        'शिल्लक (Balance ₹)': 570.0
      }
    ];
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample_Khatavani');
    XLSX.writeFile(wb, 'SmartBanking_CBS_Sample_Report.xlsx');
  };

  const summaryBanner = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center text-xs">
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सभासद क्र.</span>
        <strong className="text-primary font-mono text-[11px]">
          {sampleMember.memberCode} <span className="text-slate-500 font-normal">(जुना: {sampleMember.legacyNo})</span>
        </strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सभासदाचे नाव</span>
        <strong className="text-slate-900 text-[11px] truncate block">{sampleMember.name}</strong>
      </div>
      <div>
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">लेजर</span>
        <strong className="text-slate-900 text-[11px] truncate block">{sampleMember.ledger}</strong>
      </div>
      <div className="sm:text-right">
        <span className="text-slate-500 block text-[9.5px] uppercase font-semibold">सध्याची शेअर्स बाकी</span>
        <strong className="text-emerald-700 font-mono text-xs">₹ {sampleMember.closingBalance.toFixed(2)}</strong>
      </div>
    </div>
  );

  const filterControls = (
    <div className="flex items-center gap-2 text-xs">
      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
        ✓ CBS Standard Reference Model v2.4
      </span>
      <div className="flex items-center gap-1">
        <label className="text-[10.5px] text-slate-600 font-semibold">स्वाक्षरी लेव्हल:</label>
        <select 
          value={signatureTier} 
          onChange={e => setSignatureTier(e.target.value as '3-tier' | '4-tier')}
          className="h-6 border border-slate-300 rounded px-1 text-[10.5px] bg-white text-slate-800"
        >
          <option value="3-tier">३-स्तरीय स्वाक्षरी (लिपिक, लेखापाल, व्यवस्थापक)</option>
          <option value="4-tier">४-स्तरीय स्वाक्षरी (+ चेअरमन / संचालक)</option>
        </select>
      </div>
    </div>
  );

  return (
    <CbsReportLayout
      defaultPaperSize={paperSize}
      allowPaperSizeToggle={true}
      reportTitle="शेअर्स खतावणी पत्रक"
      reportSubtitle="Shares Ledger Statement"
      periodText="01/04/2026 ते 31/03/2027"
      branchName="मुख्य शाखा (पडवळवाडी)"
      sansthaInfo={sampleSanstha}
      summaryBanner={summaryBanner}
      signatureTier={signatureTier}
      signatureTitles={
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
            ]
      }
      onExportExcel={handleExportExcel}
      extraToolbarControls={filterControls}
      hasData={true}
      preparedBy="Admin (Tushar S.)"
    >
      <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 text-center font-bold">
            <th className="border border-slate-900 py-1.5 px-1 w-[6%] text-center">अ.क्र.</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">दिनांक</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">व्हाउचर क्र.</th>
            <th className="border border-slate-900 py-1.5 px-3 w-[34%] text-left">तपशील</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">नावे (Dr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">जमा (Cr ₹)</th>
            <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right font-extrabold">शिल्लक (Balance ₹)</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening Balance Row */}
          <tr className="bg-slate-50/70 font-bold text-slate-900 text-[11px]">
            <td className="border border-slate-900 py-1 px-1 text-center font-mono">-</td>
            <td className="border border-slate-900 py-1 px-2 text-center font-mono">01/04/2026</td>
            <td className="border border-slate-900 py-1 px-2 text-center font-mono">-</td>
            <td className="border border-slate-900 py-1 px-3 italic text-primary">आरंभीची शिल्लक (Op.Bal)</td>
            <td className="border border-slate-900 py-1 px-2 text-right font-mono">-</td>
            <td className="border border-slate-900 py-1 px-2 text-right font-mono">-</td>
            <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal font-bold text-slate-950">
              500.00
            </td>
          </tr>

          {/* Transactions */}
          {sampleTransactions.map(tx => (
            <tr key={tx.sr} className="hover:bg-slate-50 text-slate-900 text-[11px]">
              <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">१</td>
              <td className="border border-slate-900 py-1 px-2 text-center font-mono">{tx.date}</td>
              <td className="border border-slate-900 py-1 px-2 text-center font-mono font-bold text-slate-900">{tx.voucherNo}</td>
              <td className="border border-slate-900 py-1 px-3">{tx.particulars}</td>
              <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-dr font-mono">-</td>
              <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-cr">{tx.cr.toFixed(2)}</td>
              <td className="border border-slate-900 py-1 px-2 cbs-num-cell cbs-amt-bal">{tx.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-900 text-xs">
            <td colSpan={4} className="border border-slate-900 py-1.5 px-3 text-right uppercase tracking-wider">
              एकूण व्यवहार / अखेर शिल्लक:
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-dr font-bold">
              ₹ 0.00
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-cr font-bold">
              ₹ 70.00
            </td>
            <td className="border border-slate-900 py-1.5 px-2 cbs-num-cell cbs-amt-bal font-black text-primary bg-primary/10">
              ₹ 570.00
            </td>
          </tr>
        </tfoot>
      </table>
    </CbsReportLayout>
  );
}

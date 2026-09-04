import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Printer, Shield, ChevronDown, ChevronRight, UserCheck, AlertCircle, Download, FileSpreadsheet, RefreshCw, Layers } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import html2pdf from 'html2pdf.js';
import * as XLSX from 'xlsx';

interface LoanDetail {
    loanAccountID?: number;
    loanAccountNo?: string;
    loanApplicationID?: number;
    applicationNo?: string;
    borrowerName: string;
    borrowerCode?: string;
    borrowerCIF?: string;
    loanType: string;
    sanctionedAmount?: number;
    requestedAmount?: number;
    currentBalance?: number;
    guarantorType: string;
    status: string;
}

interface GuarantorRow {
    guarantorMemberID: number;
    guarantorName: string;
    guarantorCode: string;
    cifNo: string;
    mobileNo: string;
    activeGuaranteedLoansCount: number;
    pendingGuaranteedAppsCount: number;
    totalGuaranteedSanctionedAmount: number;
    totalGuaranteedCurrentBalance: number;
    activeLoans: LoanDetail[];
    pendingApplications: LoanDetail[];
}

const GuarantorReport: React.FC = () => {
    const [guarantors, setGuarantors] = useState<GuarantorRow[]>([]);
    const [sansthaInfo, setSansthaInfo] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    
    const globalBranchStr = localStorage.getItem('globalBranchId');
    const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
    const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
    const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

    const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [expandedMemberIds, setExpandedMemberIds] = useState<number[]>([]);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchBranches();
        fetchMembers();
        fetchSansthaDetails();
        fetchReport();
    }, []);

    const fetchSansthaDetails = async () => {
        try {
            const res = await axios.get('/api/SansthaDetails');
            if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                setSansthaInfo(res.data[0]);
            }
        } catch (err) {
            console.error('Error fetching sanstha details:', err);
        }
    };

    const fetchBranches = async () => {
        try {
            const res = await axios.get('/api/Branches');
            setBranches(res.data || []);
        } catch (err) {
            console.error('Error fetching branches:', err);
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await axios.get('/api/Members');
            setMembers(res.data || []);
        } catch (err) {
            console.error('Error fetching members:', err);
        }
    };

    const fetchReport = async (mId?: number, bId?: string) => {
        setLoading(true);
        try {
            const params: any = {};
            const memberToUse = mId !== undefined ? mId : selectedMemberId;
            const branchToUse = bId !== undefined ? bId : selectedBranchId;
            
            if (memberToUse) params.memberId = Number(memberToUse);
            if (branchToUse && branchToUse !== 'all') params.branchId = Number(branchToUse);

            const res = await axios.get('/api/Reports/GuarantorReport', { params });
            const list: GuarantorRow[] = res.data.guarantors || [];
            setGuarantors(list);
            setSansthaInfo(res.data.sansthaInfo);
            
            // Keep rows collapsed by default for compact view, expand all if single member search
            if (memberToUse) {
                setExpandedMemberIds(list.map(g => g.guarantorMemberID));
            } else {
                setExpandedMemberIds([]);
            }
        } catch (err) {
            console.error('Error fetching Guarantor Report:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleMemberExpand = (mId: number) => {
        setExpandedMemberIds(prev => 
            prev.includes(mId) ? prev.filter(id => id !== mId) : [...prev, mId]
        );
    };

    const toggleAllExpand = () => {
        if (expandedMemberIds.length === displayGuarantors.length) {
            setExpandedMemberIds([]);
        } else {
            setExpandedMemberIds(displayGuarantors.map(g => g.guarantorMemberID));
        }
    };

    const handleFilter = () => {
        fetchReport(selectedMemberId ? Number(selectedMemberId) : undefined, selectedBranchId);
    };

    const handleReset = () => {
        setSelectedMemberId('');
        setSelectedBranchId(initialBranchId);
        setSearchTerm('');
        fetchReport(undefined, initialBranchId);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        const element = reportRef.current;
        if (!element) return;

        const previousExpanded = [...expandedMemberIds];
        setExpandedMemberIds(displayGuarantors.map(g => g.guarantorMemberID));

        setTimeout(async () => {
            const opt: any = {
                margin: [6, 6, 8, 6],
                filename: `Guarantor_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            try {
                await html2pdf().set(opt).from(element).save();
            } catch (err) {
                console.error('PDF export error:', err);
                window.print();
            } finally {
                setExpandedMemberIds(previousExpanded);
            }
        }, 300);
    };

    const handleExportExcel = () => {
        if (displayGuarantors.length === 0) return;

        const excelRows: any[] = [];
        let globalIndex = 1;

        displayGuarantors.forEach(g => {
            const loans = g.activeLoans && g.activeLoans.length > 0 ? g.activeLoans : [];

            if (loans.length === 0) {
                excelRows.push({
                    "अ. क्र.": globalIndex++,
                    "जामीनदाराचे नाव": g.guarantorName,
                    "सभासद कोड": g.guarantorCode,
                    "CIF No": g.cifNo || "-",
                    "मोबाईल नं": g.mobileNo || "-",
                    "कर्ज खाते क्र.": "-",
                    "मुख्य कर्जदाराचे नाव": "-",
                    "कर्ज प्रकार": "-",
                    "जामीनदार स्थान": "-",
                    "मंजूर जामीन रक्कम (₹)": 0,
                    "चालू जामीन बाकी (₹)": 0
                });
            } else {
                loans.forEach((l, lIdx) => {
                    excelRows.push({
                        "अ. क्र.": lIdx === 0 ? globalIndex++ : "",
                        "जामीनदाराचे नाव": lIdx === 0 ? g.guarantorName : "",
                        "सभासद कोड": lIdx === 0 ? g.guarantorCode : "",
                        "CIF No": lIdx === 0 ? (g.cifNo || "-") : "",
                        "मोबाईल नं": lIdx === 0 ? (g.mobileNo || "-") : "",
                        "कर्ज खाते क्र.": l.loanAccountNo || "-",
                        "मुख्य कर्जदाराचे नाव": `${l.borrowerName} (${l.borrowerCode || ''})`.trim(),
                        "कर्ज प्रकार": l.loanType || "-",
                        "जामीनदार स्थान": l.guarantorType || "-",
                        "मंजूर जामीन रक्कम (₹)": l.sanctionedAmount || 0,
                        "चालू जामीन बाकी (₹)": l.currentBalance || 0
                    });
                });
            }
        });

        // Grand Total Row
        excelRows.push({
            "अ. क्र.": "",
            "जामीनदाराचे नाव": "एकूण (Grand Total)",
            "सभासद कोड": "",
            "CIF No": "",
            "मोबाईल नं": "",
            "कर्ज खाते क्र.": `${totalGuaranteedLoansCount} खाती`,
            "मुख्य कर्जदाराचे नाव": "",
            "कर्ज प्रकार": "",
            "जामीनदार स्थान": "",
            "मंजूर जामीन रक्कम (₹)": totalSanctionedAmtSum,
            "चालू जामीन बाकी (₹)": totalCurrentBalSum
        });

        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Guarantor_Report");
        XLSX.writeFile(workbook, `Guarantor_Audit_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Filter Guarantors based on selected member or live search
    const displayGuarantors = guarantors.filter(g => {
        if (!selectedMemberId && g.activeGuaranteedLoansCount === 0 && g.pendingGuaranteedAppsCount === 0) {
            return false;
        }
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        return (
            g.guarantorName.toLowerCase().includes(term) ||
            (g.guarantorCode && g.guarantorCode.toLowerCase().includes(term)) ||
            (g.cifNo && g.cifNo.toLowerCase().includes(term)) ||
            (g.mobileNo && g.mobileNo.includes(term))
        );
    });

    // Calculate Grand Totals
    const totalGuarantorsCount = displayGuarantors.length;
    const totalGuaranteedLoansCount = displayGuarantors.reduce((sum, g) => sum + g.activeGuaranteedLoansCount, 0);
    const totalSanctionedAmtSum = displayGuarantors.reduce((sum, g) => sum + g.totalGuaranteedSanctionedAmount, 0);
    const totalCurrentBalSum = displayGuarantors.reduce((sum, g) => sum + g.totalGuaranteedCurrentBalance, 0);

    const memberOptions = members.map(m => ({
        value: m.memberID,
        label: `${m.firstName} ${m.middleName || ''} ${m.lastName} (${m.memberCode}) [CIF: ${m.cifNo || 'N/A'}]`
    }));

    const isAllExpanded = displayGuarantors.length > 0 && expandedMemberIds.length === displayGuarantors.length;

    return (
        <div className="p-2 sm:p-4 max-w-7xl mx-auto bg-gray-50/50 min-h-screen font-sans">
            {/* Custom Print Styles for A4 Page */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 6mm 6mm 8mm 6mm;
                    }
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                        font-size: 9.5px !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print-container {
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .print\\:hidden, .print-hidden {
                        display: none !important;
                    }
                    .print-block-avoid {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .print-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    .print-table th, .print-table td {
                        border: 1px solid #cbd5e1 !important;
                        padding: 3px 5px !important;
                    }
                    .print-header-bg {
                        background-color: #005689 !important;
                        color: #ffffff !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            {/* Sleek Compact CBS Header & Filter Control Panel (Hidden on Print) */}
            <div className="bg-white px-3 py-2 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary mb-3 print:hidden space-y-1.5">
                
                {/* Row 1: Title + Inline Filters + Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    
                    {/* Left: Compact Title */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-6 h-6 rounded bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                            <Shield size={14} className="stroke-[2.5]" />
                        </div>
                        <h1 className="text-xs font-bold text-gray-900 tracking-tight flex items-center gap-1">
                            <span>सभासद जामीनदार अहवाल</span>
                            <span className="text-[10px] font-semibold text-primary font-mono hidden sm:inline">(Guarantor Report)</span>
                        </h1>
                    </div>

                    {/* Center: Integrated Inline Filter Inputs */}
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end sm:justify-center">
                        
                        {/* Branch */}
                        <div className="flex items-center gap-1">
                            <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
                            <select 
                                value={selectedBranchId} 
                                disabled={hasGlobalBranch} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedBranchId(val);
                                    fetchReport(selectedMemberId ? Number(selectedMemberId) : undefined, val);
                                }}
                                className="h-6 border border-gray-300 rounded-sm px-1.5 text-[11px] font-medium bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-28 sm:w-32"
                            >
                                <option value="all">सर्व शाखा (All)</option>
                                {branches.map(b => (
                                    <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                                ))}
                            </select>
                        </div>

                        {/* Searchable Member Select */}
                        <div className="flex items-center gap-1 min-w-[200px] max-w-[280px]">
                            <label className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">जामीनदार:</label>
                            <div className="flex-1">
                                <SearchableSelect 
                                    options={memberOptions}
                                    value={selectedMemberId}
                                    onChange={(e: any) => {
                                        const val = e?.target ? e.target.value : e;
                                        const id = val ? Number(val) : '';
                                        setSelectedMemberId(id);
                                        fetchReport(id ? Number(id) : undefined, selectedBranchId);
                                    }}
                                    placeholder="-- सर्व जामीनदार --"
                                    className="text-xs h-6"
                                />
                            </div>
                        </div>

                        {/* Search View Button */}
                        <button 
                            onClick={handleFilter}
                            className="h-6 bg-primary hover:opacity-90 text-white px-2.5 rounded-sm text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                            <Search size={11} />
                            <span>शोधा</span>
                        </button>

                        <button 
                            onClick={handleReset}
                            className="h-6 bg-slate-600 hover:bg-slate-700 text-white px-2 rounded-sm text-[11px] font-medium shadow-2xs cursor-pointer flex items-center gap-1"
                            title="फिल्टर रिसेट करा"
                        >
                            <RefreshCw size={11} /> रिसेट
                        </button>

                        <button 
                            onClick={toggleAllExpand}
                            className="h-6 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-2 rounded-sm text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            title={isAllExpanded ? 'सर्व तपशील बंद करा' : 'सर्व तपशील उघडा'}
                        >
                            <Layers size={11} /> {isAllExpanded ? 'बंद करा' : 'सर्व उघडा'}
                        </button>
                    </div>

                    {/* Right: Export & Print Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                            onClick={handleExportExcel}
                            className="h-6 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="Excel शीट मध्ये डाऊनलोड करा"
                        >
                            <FileSpreadsheet size={12} /> Excel
                        </button>
                        <button 
                            onClick={handleDownloadPDF}
                            className="h-6 bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="PDF फाइल डाऊनलोड करा"
                        >
                            <Download size={12} /> PDF
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="h-6 bg-slate-800 hover:bg-slate-900 text-white px-2 py-0.5 rounded-sm text-[11px] font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="A4 प्रिंट काढा"
                        >
                            <Printer size={12} /> प्रिंट (A4)
                        </button>
                    </div>

                </div>

                {/* Row 2: In-Table Search + Summary Metrics Strip */}
                <div className="pt-1.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="relative w-64 max-w-full">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="यादीत नाव/कोडने शोधा..."
                            className="w-full pl-6 pr-2 py-0.5 h-6 border border-gray-300 rounded-sm text-[11px] focus:outline-none focus:border-primary bg-gray-50/50 focus:bg-white"
                        />
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-600">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                            एकूण जामीनदार: <strong className="text-primary font-bold">{totalGuarantorsCount}</strong>
                        </span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                            एकूण खाती: <strong className="text-blue-700 font-bold">{totalGuaranteedLoansCount}</strong>
                        </span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 border border-gray-200">
                            मंजूर जामीन: <strong className="text-primary font-bold">₹{totalSanctionedAmtSum.toLocaleString('en-IN')}</strong>
                        </span>
                        <span className="bg-emerald-50 px-2 py-0.5 rounded text-emerald-800 border border-emerald-200 font-bold">
                            चालू जामीन बाकी: ₹{totalCurrentBalSum.toLocaleString('en-IN')}
                        </span>
                    </div>
                </div>

            </div>

            {/* Printable Document Container */}
            <div ref={reportRef} className="bg-white mx-auto max-w-7xl p-5 md:p-8 rounded-sm shadow-md border border-slate-300 print:border-0 print:shadow-none print:p-0">
                
                {/* Official Bank Header Box (Exact Reference Format) */}
                <div className="border border-gray-900 p-3 relative text-center">
                    
                    {/* Registration Top Bar */}
                    <div className="flex justify-between items-center text-[12px] font-bold text-gray-900 border-b border-gray-300 pb-1 mb-2">
                        <div>
                            <span>रजि. नं. - </span>
                            <span className="font-mono">{sansthaInfo?.registrationNo || '-'}</span>
                        </div>
                        <div>
                            <span>रजि. दि. - </span>
                            <span className="font-mono">{sansthaInfo?.registrationDate ? new Date(sansthaInfo.registrationDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span>
                        </div>
                    </div>

                    {/* Central Sanstha Name */}
                    <h1 className="text-lg sm:text-xl font-extrabold text-gray-950 tracking-tight leading-snug font-serif uppercase">
                        {sansthaInfo?.sansthaName || 'सहकारी पतसंस्था मर्यादित'}
                    </h1>

                    {/* Subtitle / Address */}
                    <p className="text-xs sm:text-[13px] font-bold text-gray-800 mt-1">
                        {sansthaInfo?.address || ''} {sansthaInfo?.village ? `मु. ${sansthaInfo.village}, ` : ''}{sansthaInfo?.taluka ? `ता. ${sansthaInfo.taluka}, ` : ''}{sansthaInfo?.district ? `जि. ${sansthaInfo.district}` : ''}
                    </p>
                </div>

                {/* Report Title Banner Section */}
                <div className="mt-3 mb-2 flex items-center justify-between">
                    <div className="w-28 hidden sm:block"></div>

                    {/* Title Banner Box */}
                    <div className="mx-auto inline-block border border-gray-400 bg-gray-50/80 px-8 py-1 rounded-xs shadow-2xs">
                        <h2 className="text-sm sm:text-base font-extrabold text-gray-950 tracking-wider uppercase font-serif text-center">
                            सभासद जामीनदार अहवाल (Guarantor Audit Statement)
                        </h2>
                    </div>

                    {/* Date Tag on Right */}
                    <div className="text-right text-xs font-bold text-gray-800">
                        <span>दिनांक : </span>
                        <span className="font-mono">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    </div>
                </div>

                {/* Main Data Table */}
                {loading ? (
                    <div className="p-10 text-center text-gray-500 text-xs font-bold animate-pulse">
                        डेटा लोड होत आहे, कृपया प्रतीक्षा करा...
                    </div>
                ) : displayGuarantors.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-xs font-semibold bg-gray-50 rounded border border-dashed border-gray-300">
                        <AlertCircle size={22} className="mx-auto text-amber-500 mb-1.5" />
                        कोणतेही जामीनदार रेकॉर्ड आढळले नाहीत.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px] text-left border-collapse print-table border border-gray-300 shadow-2xs">
                            <thead>
                                <tr className="bg-primary text-white font-bold text-[11px] uppercase tracking-wider print-header-bg">
                                    <th className="py-2 px-1.5 border border-slate-700 text-center w-8 print:w-7">#</th>
                                    <th className="py-2 px-2 border border-slate-700 text-left w-[26%]">जामीनदाराचे नाव व तपशील (GUARANTOR)</th>
                                    <th className="py-2 px-2 border border-slate-700 text-left w-[13%]">कर्ज खाते क्र.</th>
                                    <th className="py-2 px-2 border border-slate-700 text-left w-[24%]">मुख्य कर्जदाराचे नाव (BORROWER)</th>
                                    <th className="py-2 px-1.5 border border-slate-700 text-left w-[13%]">कर्ज योजना</th>
                                    <th className="py-2 px-1.5 border border-slate-700 text-center w-[9%]">स्थान</th>
                                    <th className="py-2 px-2 border border-slate-700 text-right w-[11%]">मंजूर रक्कम (₹)</th>
                                    <th className="py-2 px-2 border border-slate-700 text-right w-[11%]">चालू बाकी (₹)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {displayGuarantors.map((g, gIdx) => {
                                    const loans = g.activeLoans && g.activeLoans.length > 0 ? g.activeLoans : [];
                                    const isExpanded = expandedMemberIds.includes(g.guarantorMemberID);

                                    if (loans.length === 0) {
                                        return (
                                            <tr key={g.guarantorMemberID} className="border-b border-gray-200 hover:bg-gray-50/80 transition-colors print-block-avoid">
                                                <td className="py-1.5 px-1.5 text-center border-r border-gray-200 font-semibold text-gray-700 bg-gray-50/50">
                                                    {gIdx + 1}
                                                </td>
                                                <td className="py-1.5 px-2 border-r border-gray-200">
                                                    <div className="font-bold text-gray-900 text-xs">{g.guarantorName}</div>
                                                    <div className="text-[10px] text-gray-600">
                                                        कोड: <span className="font-mono font-bold text-gray-800">{g.guarantorCode}</span> | CIF: {g.cifNo || '-'} | मो: {g.mobileNo || '-'}
                                                    </div>
                                                </td>
                                                <td colSpan={6} className="py-1.5 px-2 text-gray-400 italic text-center text-[10.5px]">
                                                    कोणतेही चालू जामीन खाते उपलब्ध नाही
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <React.Fragment key={g.guarantorMemberID}>
                                            {/* Summary Group Header Row for Guarantor */}
                                            <tr className="bg-slate-50/90 border-t-2 border-slate-300 font-semibold text-gray-900 print-block-avoid">
                                                <td className="py-1.5 px-1.5 text-center border-r border-gray-300 font-bold text-gray-800 bg-slate-100">
                                                    {gIdx + 1}
                                                </td>
                                                <td colSpan={5} className="py-1.5 px-2 border-r border-gray-300">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <button 
                                                                onClick={() => toggleMemberExpand(g.guarantorMemberID)}
                                                                className="text-primary hover:text-blue-900 print:hidden cursor-pointer p-0.5 rounded hover:bg-blue-50"
                                                                title={isExpanded ? 'खाती लपवा' : 'खाती पहा'}
                                                            >
                                                                {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                            </button>
                                                            <div>
                                                                <span className="font-extrabold text-gray-900 text-xs">{g.guarantorName}</span>
                                                                <span className="ml-2 text-[10px] font-mono text-gray-600">
                                                                    (कोड: <span className="font-bold text-gray-900">{g.guarantorCode}</span> | CIF: {g.cifNo || '-'} | मो: {g.mobileNo || '-'})
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[9.5px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-bold shadow-2xs whitespace-nowrap">
                                                            एकूण {loans.length} जामीन खाती
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-1.5 px-2 border-r border-gray-300 text-right font-mono font-bold text-gray-900">
                                                    ₹{g.totalGuaranteedSanctionedAmount.toLocaleString('en-IN')}
                                                </td>
                                                <td className="py-1.5 px-2 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                                                    ₹{g.totalGuaranteedCurrentBalance.toLocaleString('en-IN')}
                                                </td>
                                            </tr>

                                            {/* Detailed Sub-Rows (Collapsible unless printing or expanded) */}
                                            {(isExpanded || true) && loans.map((l, lIdx) => (
                                                <tr 
                                                    key={`${g.guarantorMemberID}-${lIdx}`} 
                                                    className={`hover:bg-blue-50/40 transition-colors print-block-avoid ${!isExpanded ? 'hidden print:table-row' : ''}`}
                                                >
                                                    <td className="py-1 px-1.5 border-r border-gray-200 bg-gray-50/30"></td>
                                                    <td className="py-1 px-2 border-r border-gray-200 pl-6 text-gray-500 text-[10.5px]">
                                                        └ खाते क्र. {lIdx + 1}
                                                    </td>
                                                    <td className="py-1 px-2 border-r border-gray-200 font-mono font-bold text-primary text-xs">
                                                        {l.loanAccountNo}
                                                    </td>
                                                    <td className="py-1 px-2 border-r border-gray-200 font-semibold text-gray-900">
                                                        {l.borrowerName} <span className="text-[10px] text-gray-500">({l.borrowerCode})</span>
                                                    </td>
                                                    <td className="py-1 px-1.5 border-r border-gray-200 text-gray-700 font-medium">
                                                        {l.loanType}
                                                    </td>
                                                    <td className="py-1 px-1.5 border-r border-gray-200 text-center">
                                                        <span className="inline-block bg-slate-100 text-slate-800 text-[9.5px] font-bold px-1.5 py-0.2 rounded border border-slate-300">
                                                            {l.guarantorType}
                                                        </span>
                                                    </td>
                                                    <td className="py-1 px-2 border-r border-gray-200 text-right font-mono text-gray-800 font-semibold">
                                                        {l.sanctionedAmount ? `₹${l.sanctionedAmount.toLocaleString('en-IN')}` : '-'}
                                                    </td>
                                                    <td className="py-1 px-2 text-right font-mono font-bold text-emerald-700 bg-emerald-50/20">
                                                        {l.currentBalance ? `₹${l.currentBalance.toLocaleString('en-IN')}` : '₹0'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-primary text-white font-black text-xs border-t-2 border-slate-800 print-header-bg">
                                    <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-100">
                                        एकूण एकत्रित बाकी (Grand Total):
                                    </td>
                                    <td className="py-2.5 px-1 text-center text-amber-300 font-black text-[11px]">
                                        {totalGuaranteedLoansCount} खाती
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-mono text-white text-xs font-bold">
                                        ₹{totalSanctionedAmtSum.toLocaleString('en-IN')}
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-mono text-amber-300 text-xs font-black">
                                        ₹{totalCurrentBalSum.toLocaleString('en-IN')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}

                {/* Verification Signatures Section */}
                <div className="mt-12 pt-4 border-t border-dashed border-gray-400 grid grid-cols-3 text-center text-xs font-bold text-gray-900">
                    <div>
                        <div className="h-10"></div>
                        <p className="border-t border-gray-800 mx-4 pt-1">लिपिक / सहाय्यक</p>
                        <span className="text-[10px] text-gray-500 font-normal">(Clerk / Assistant)</span>
                    </div>

                    <div>
                        <div className="h-10"></div>
                        <p className="border-t border-gray-800 mx-4 pt-1">कर्ज अधिकारी / तपासनीस</p>
                        <span className="text-[10px] text-gray-500 font-normal">(Loan Officer / Inspector)</span>
                    </div>

                    <div>
                        <div className="h-10"></div>
                        <p className="border-t border-gray-800 mx-4 pt-1">शाखा व्यवस्थापक / सचिव</p>
                        <span className="text-[10px] text-gray-500 font-normal">(Manager / Secretary)</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuarantorReport;

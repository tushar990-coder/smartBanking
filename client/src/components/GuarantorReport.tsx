import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Search, 
    Printer, 
    Shield, 
    ChevronDown, 
    ChevronRight, 
    AlertTriangle, 
    AlertCircle, 
    FileSpreadsheet, 
    RefreshCw, 
    Layers, 
    CheckCircle2, 
    Building2, 
    UserCheck,
    ListFilter
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import * as XLSX from 'xlsx';
import CbsReportLayout, { formatDisplayDate, CbsPaperSize } from './common/CbsReportLayout';

interface LoanDetail {
    loanAccountID?: number;
    loanAccountNo?: string;
    legacyAccountNumber?: string;
    loanApplicationID?: number;
    applicationNo?: string;
    borrowerName: string;
    borrowerCode?: string;
    borrowerCIF?: string;
    loanType: string;
    disbursementDate?: string;
    disbursementDateDisplay?: string;
    sanctionedAmount?: number;
    requestedAmount?: number;
    principalBalance?: number;
    interestBalance?: number;
    currentBalance?: number;
    guarantorType: string;
    isBorrowerOverdue?: boolean;
    status: string;
}

interface GuarantorRow {
    guarantorMemberID: number;
    guarantorCustomerID?: number;
    guarantorName: string;
    guarantorCode: string;
    cifNo: string;
    mobileNo: string;
    guarantorShares?: number;
    guarantorSavings?: number;
    ownLoansCount?: number;
    ownLoansSanctioned?: number;
    ownLoansPrincipal?: number;
    ownLoansInterest?: number;
    ownLoansBalance?: number;
    hasOverdueOwnLoan?: boolean;
    ownLoanInfo?: string;
    auditStatus?: string;
    auditAlertCode?: string; // NORMAL | EXCESS_GUARANTEE | DEFAULTER_GUARANTOR | OWN_BORROWER
    activeGuaranteedLoansCount: number;
    pendingGuaranteedAppsCount: number;
    totalGuaranteedSanctionedAmount: number;
    totalGuaranteedPrincipalBalance?: number;
    totalGuaranteedInterestBalance?: number;
    totalGuaranteedCurrentBalance: number;
    activeLoans: LoanDetail[];
    pendingApplications: LoanDetail[];
}

const GuarantorReport: React.FC = () => {
    const [guarantors, setGuarantors] = useState<GuarantorRow[]>([]);
    const [sansthaInfo, setSansthaInfo] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [asOnDateDisplay, setAsOnDateDisplay] = useState<string>(new Date().toLocaleDateString('en-GB'));
    
    const globalBranchStr = localStorage.getItem('globalBranchId');
    const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
    const initialBranchId = hasGlobalBranch ? (globalBranchStr as string) : 'all';
    const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

    const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [auditFilter, setAuditFilter] = useState<'all' | 'excess' | 'own_loan' | 'defaulter'>('all');
    const [viewMode, setViewMode] = useState<'detailed' | 'grouped'>('detailed');
    const [loading, setLoading] = useState(false);
    const [expandedMemberIds, setExpandedMemberIds] = useState<number[]>([]);

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
            if (res.data.sansthaInfo) {
                setSansthaInfo(res.data.sansthaInfo);
            }
            if (res.data.asOnDateDisplay) {
                setAsOnDateDisplay(res.data.asOnDateDisplay);
            }
            
            // Expand all by default for immediate audit visibility
            setExpandedMemberIds(list.map(g => g.guarantorMemberID));
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
        fetchReport();
    };

    const handleReset = () => {
        setSelectedMemberId('');
        if (!hasGlobalBranch) setSelectedBranchId('all');
        setSearchTerm('');
        setAuditFilter('all');
        fetchReport(undefined, hasGlobalBranch ? initialBranchId : 'all');
    };

    // Filter Guarantors based on live search & audit risk category
    const displayGuarantors = guarantors.filter(g => {
        // Audit Category Filter
        if (auditFilter === 'excess' && g.activeGuaranteedLoansCount <= 2) return false;
        if (auditFilter === 'own_loan' && (!g.ownLoansCount || g.ownLoansCount === 0)) return false;
        if (auditFilter === 'defaulter' && !g.hasOverdueOwnLoan) return false;

        // Search text matching
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase().trim();
        const nameMatch = g.guarantorName.toLowerCase().includes(term);
        const codeMatch = Boolean(g.guarantorCode && g.guarantorCode.toLowerCase().includes(term));
        const cifMatch = Boolean(g.cifNo && g.cifNo.toLowerCase().includes(term));
        const mobileMatch = Boolean(g.mobileNo && g.mobileNo.includes(term));
        const loanMatch = g.activeLoans && g.activeLoans.some(l => 
            (l.loanAccountNo && l.loanAccountNo.toLowerCase().includes(term)) ||
            (l.legacyAccountNumber && l.legacyAccountNumber.toLowerCase().includes(term)) ||
            (l.borrowerName && l.borrowerName.toLowerCase().includes(term)) ||
            (l.borrowerCode && l.borrowerCode.toLowerCase().includes(term))
        );
        return nameMatch || codeMatch || cifMatch || mobileMatch || loanMatch;
    });

    // Statistical KPI calculations
    const totalGuarantorsCount = displayGuarantors.length;
    const totalGuaranteedLoansCount = displayGuarantors.reduce((sum, g) => sum + g.activeGuaranteedLoansCount, 0);
    const totalSanctionedAmtSum = displayGuarantors.reduce((sum, g) => sum + g.totalGuaranteedSanctionedAmount, 0);
    const totalPrincipalBalSum = displayGuarantors.reduce((sum, g) => sum + (g.totalGuaranteedPrincipalBalance || 0), 0);
    const totalInterestBalSum = displayGuarantors.reduce((sum, g) => sum + (g.totalGuaranteedInterestBalance || 0), 0);
    const totalCurrentBalSum = displayGuarantors.reduce((sum, g) => sum + g.totalGuaranteedCurrentBalance, 0);
    const excessGuarantorsCount = displayGuarantors.filter(g => g.activeGuaranteedLoansCount > 2).length;
    const defaulterGuarantorsCount = displayGuarantors.filter(g => g.hasOverdueOwnLoan).length;
    const ownLoanGuarantorsCount = displayGuarantors.filter(g => (g.ownLoansCount || 0) > 0).length;

    const memberOptions = members.map(m => {
        const legacyBadge = m.legacyMemberNo ? ` [🏷️ जुना: ${m.legacyMemberNo}]` : '';
        return {
            value: m.memberID,
            label: `${m.firstName} ${m.middleName || ''} ${m.lastName} (${m.memberCode})${legacyBadge} [CIF: ${m.cifNo || 'N/A'}]`
        };
    });

    const isAllExpanded = displayGuarantors.length > 0 && expandedMemberIds.length === displayGuarantors.length;

    // Excel Export according to Statutory Audit Template
    const handleExportExcel = () => {
        if (displayGuarantors.length === 0) {
            alert('एक्सपोर्ट करण्यासाठी कोणताही डेटा उपलब्ध नाही.');
            return;
        }

        const excelRows: any[] = [];
        let srNo = 1;

        displayGuarantors.forEach(g => {
            const loans = g.activeLoans && g.activeLoans.length > 0 ? g.activeLoans : [];

            if (loans.length === 0) {
                excelRows.push({
                    "अ.क्र.": srNo++,
                    "जामीनदाराचे नाव": g.guarantorName,
                    "सभासद कोड": g.guarantorCode,
                    "सीआयएफ क्र.": g.cifNo || "-",
                    "मोबाईल क्र.": g.mobileNo || "-",
                    "भागभांडवल (₹)": g.guarantorShares || 0,
                    "बचत ठेवी (₹)": g.guarantorSavings || 0,
                    "स्वतःचे कर्ज बाकी (₹)": g.ownLoansBalance || 0,
                    "मुख्य कर्जदाराचे नाव": "-",
                    "कर्ज खाते क्र.": "-",
                    "कर्ज योजना": "-",
                    "वाटप दिनांक": "-",
                    "मंजूर कर्ज रक्कम (₹)": 0,
                    "मुद्दल बाकी (₹)": 0,
                    "व्याज बाकी (₹)": 0,
                    "एकूण येणेबाकी (₹)": 0,
                    "स्थान": "-",
                    "लेखापरीक्षण शेरा / स्थिती": g.auditStatus || "नियमित"
                });
            } else {
                loans.forEach((l, lIdx) => {
                    excelRows.push({
                        "अ.क्र.": lIdx === 0 ? srNo++ : "",
                        "जामीनदाराचे नाव": lIdx === 0 ? g.guarantorName : "",
                        "सभासद कोड": lIdx === 0 ? g.guarantorCode : "",
                        "सीआयएफ क्र.": lIdx === 0 ? (g.cifNo || "-") : "",
                        "मोबाईल क्र.": lIdx === 0 ? (g.mobileNo || "-") : "",
                        "भागभांडवल (₹)": lIdx === 0 ? (g.guarantorShares || 0) : "",
                        "बचत ठेवी (₹)": lIdx === 0 ? (g.guarantorSavings || 0) : "",
                        "स्वतःचे कर्ज बाकी (₹)": lIdx === 0 ? (g.ownLoansBalance || 0) : "",
                        "मुख्य कर्जदाराचे नाव": `${l.borrowerName} (${l.borrowerCode || '-'})`,
                        "कर्ज खाते क्र.": l.legacyAccountNumber ? `${l.loanAccountNo} (जुना: ${l.legacyAccountNumber})` : (l.loanAccountNo || "-"),
                        "कर्ज योजना": l.loanType || "-",
                        "वाटप दिनांक": l.disbursementDateDisplay || formatDisplayDate(l.disbursementDate),
                        "मंजूर कर्ज रक्कम (₹)": l.sanctionedAmount || 0,
                        "मुद्दल बाकी (₹)": l.principalBalance || 0,
                        "व्याज बाकी (₹)": l.interestBalance || 0,
                        "एकूण येणेबाकी (₹)": l.currentBalance || 0,
                        "स्थान": l.guarantorType || "-",
                        "लेखापरीक्षण शेरा / स्थिती": lIdx === 0 ? (g.auditStatus || "नियमित") : ""
                    });
                });
            }
        });

        // Add Summary Total Row
        excelRows.push({
            "अ.क्र.": "",
            "जामीनदाराचे नाव": `एकूण जामीनदार: ${totalGuarantorsCount}`,
            "सभासद कोड": "",
            "सीआयएफ क्र.": "",
            "मोबाईल क्र.": "",
            "भागभांडवल (₹)": "",
            "बचत ठेवी (₹)": "",
            "स्वतःचे कर्ज बाकी (₹)": "",
            "मुख्य कर्जदाराचे नाव": `एकूण हमी खाती: ${totalGuaranteedLoansCount}`,
            "कर्ज खाते क्र.": "",
            "कर्ज योजना": "",
            "वाटप दिनांक": "एकूण बाकी:",
            "मंजूर कर्ज रक्कम (₹)": totalSanctionedAmtSum,
            "मुद्दल बाकी (₹)": totalPrincipalBalSum,
            "व्याज बाकी (₹)": totalInterestBalSum,
            "एकूण येणेबाकी (₹)": totalCurrentBalSum,
            "स्थान": "",
            "लेखापरीक्षण शेरा / स्थिती": ""
        });

        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Guarantor_Audit");
        XLSX.writeFile(workbook, `Guarantor_Audit_Statement_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const selectedBranchObj = branches.find(b => String(b.branchID) === String(selectedBranchId));
    const branchNameDisplay = selectedBranchId === 'all' ? 'सर्व शाखा (All Branches)' : (selectedBranchObj?.branchName || 'मुख्य शाखा');

    // Filter controls embedded inside CBS Unified Toolbar
    const filterToolbarControls = (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Branch Selector */}
            <div className="flex items-center gap-1">
                <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">शाखा:</label>
                <select 
                    value={selectedBranchId} 
                    disabled={hasGlobalBranch} 
                    onChange={(e) => {
                        const val = e.target.value;
                        setSelectedBranchId(val);
                        fetchReport(selectedMemberId ? Number(selectedMemberId) : undefined, val);
                    }}
                    className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-medium bg-white focus:outline-none focus:border-primary w-28 sm:w-32"
                >
                    <option value="all">सर्व शाखा (All)</option>
                    {branches.map(b => (
                        <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                    ))}
                </select>
            </div>

            {/* Member / Guarantor Searchable Select */}
            <div className="flex items-center gap-1 min-w-[190px] max-w-[260px]">
                <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">जामीनदार:</label>
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

            {/* View Mode Toggle (Detailed Register vs Grouped) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xs border border-slate-300 text-[10.5px]">
                <button
                    type="button"
                    onClick={() => setViewMode('detailed')}
                    className={`px-1.5 py-0.5 rounded-xs font-semibold cursor-pointer transition-colors ${
                        viewMode === 'detailed' 
                            ? 'bg-primary text-white font-bold shadow-2xs' 
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="सविस्तर ऑडिट नोंदवही (Detailed Audit Statement)"
                >
                    सविस्तर नोंदवही
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`px-1.5 py-0.5 rounded-xs font-semibold cursor-pointer transition-colors ${
                        viewMode === 'grouped' 
                            ? 'bg-primary text-white font-bold shadow-2xs' 
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="जामीनदारवार गटवारी (Grouped Summary)"
                >
                    जामीनदारवार गट
                </button>
            </div>

            {/* Audit Compliance Filter */}
            <div className="flex items-center gap-1">
                <label className="text-[10.5px] font-semibold text-gray-600 whitespace-nowrap">ऑडिट निकष:</label>
                <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value as any)}
                    className="h-6 border border-gray-300 rounded-xs px-1 text-[10.5px] font-bold bg-white focus:outline-none focus:border-primary text-slate-800"
                >
                    <option value="all">सर्व (All)</option>
                    <option value="excess">⚠️ २+ जामीन (मर्यादा उल्लंघन)</option>
                    <option value="own_loan">स्वतःचे कर्ज असणारे</option>
                    <option value="defaulter">⚠️ स्वतः थकीत कर्जदार</option>
                </select>
            </div>

            {/* Live Search Input */}
            <div className="relative w-36 sm:w-48">
                <Search size={11} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text"
                    placeholder="नाव / खाते / CIF शोधा..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-5 pr-1 py-0.5 h-6 border border-gray-300 rounded-xs text-[10.5px] focus:outline-none focus:border-primary bg-white"
                />
            </div>

            {/* Action Buttons */}
            <button 
                onClick={handleFilter}
                disabled={loading}
                className="h-6 bg-primary hover:opacity-90 text-white px-2 rounded-xs text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
                <Search size={11} />
                <span>पहा</span>
            </button>

            <button 
                onClick={handleReset}
                className="h-6 bg-slate-600 hover:bg-slate-700 text-white px-1.5 rounded-xs text-[11px] font-medium shadow-2xs cursor-pointer flex items-center gap-1"
                title="फिल्टर रिसेट करा"
            >
                <RefreshCw size={11} /> रिसेट
            </button>

            {viewMode === 'grouped' && (
                <button 
                    onClick={toggleAllExpand}
                    className="h-6 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-1.5 rounded-xs text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title={isAllExpanded ? 'सर्व तपशील बंद करा' : 'सर्व तपशील उघडा'}
                >
                    <Layers size={11} /> {isAllExpanded ? 'बंद करा' : 'सर्व उघडा'}
                </button>
            )}
        </div>
    );

    // KPI Summary Banner strip displayed at the top of the report
    const summaryBanner = (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs print:grid-cols-6">
            <div className="bg-white p-2 rounded-xs border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wide">एकूण जामीनदार</span>
                <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono">{totalGuarantorsCount}</span>
            </div>
            <div className="bg-white p-2 rounded-xs border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wide">हमी दिलेली खाती</span>
                <span className="text-sm sm:text-base font-extrabold text-blue-700 font-mono">{totalGuaranteedLoansCount}</span>
            </div>
            <div className="bg-white p-2 rounded-xs border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wide">एकूण मंजूर जामीन</span>
                <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono">₹{totalSanctionedAmtSum.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-white p-2 rounded-xs border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wide">एकूण मुद्दल बाकी</span>
                <span className="text-sm sm:text-base font-extrabold text-indigo-700 font-mono">₹{totalPrincipalBalSum.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-white p-2 rounded-xs border border-emerald-300 bg-emerald-50/40 shadow-2xs">
                <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wide">एकूण चालू येणेबाकी</span>
                <span className="text-sm sm:text-base font-black text-emerald-800 font-mono">₹{totalCurrentBalSum.toLocaleString('en-IN')}</span>
            </div>
            <div className={`p-2 rounded-xs border shadow-2xs ${excessGuarantorsCount > 0 || defaulterGuarantorsCount > 0 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <span className="text-[10px] font-bold block flex items-center gap-1 uppercase tracking-wide">
                    {excessGuarantorsCount > 0 && <AlertTriangle size={11} className="text-amber-600 inline" />}
                    ऑडिट आक्षेप (२+ जामीन/थकीत)
                </span>
                <span className="text-sm sm:text-base font-black font-mono">
                    {excessGuarantorsCount} / {defaulterGuarantorsCount}
                </span>
            </div>
        </div>
    );

    return (
        <CbsReportLayout
            defaultPaperSize="a4-landscape"
            allowPaperSizeToggle={true}
            titleStyle="classic-badge"
            reportTitle="सभासद जामीनदार अहवाल (Guarantor Audit Statement)"
            reportSubtitle="सहकारी संस्था अधिनियम व पोटनियमान्वये जामीनकी देयता व वैधानिक लेखापरीक्षण नोंदवही"
            periodText={`दिनांक: आजअखेर (${asOnDateDisplay})`}
            branchName={branchNameDisplay}
            sansthaInfo={sansthaInfo}
            summaryBanner={summaryBanner}
            signatureTier="4-tier"
            signatureTitles={[
                { title: 'लिपिक / तयार करणार', subtitle: '(Clerk / Maker)' },
                { title: 'कर्ज विभाग प्रमुख / तपासनीस', subtitle: '(Loan In-charge / Checker)' },
                { title: 'शाखा व्यवस्थापक / मानद सचिव', subtitle: '(Manager / Secretary)' },
                { title: 'वैधानिक लेखापरीक्षक (सही व शिक्का)', subtitle: '(Statutory Auditor / CA)' }
            ]}
            onExportExcel={handleExportExcel}
            extraToolbarControls={filterToolbarControls}
            isLoading={loading}
            hasData={displayGuarantors.length > 0}
            preparedBy="Admin"
            emptyState={
                <div className="bg-white p-12 text-center text-slate-500 rounded-xs border border-slate-200 shadow-xs max-w-4xl mx-auto">
                    <Shield size={36} className="mx-auto mb-2 text-primary/40" />
                    <p className="font-semibold text-xs text-slate-700">कोणतेही जामीनदार रेकॉर्ड आढळले नाहीत.</p>
                    <p className="text-[11px] text-slate-500 mt-1">कृपया वरील फिल्टर निवडून 'पहा' बटणावर क्लिक करा.</p>
                </div>
            }
        >
            {/* 1. STATUTORY DETAILED AUDIT REGISTER TABLE (नमुना - सविस्तर जामीनदार ऑडिट नोंदवही) */}
            {viewMode === 'detailed' ? (
                <div className="overflow-x-auto">
                    <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                        <thead>
                            <tr className="bg-white text-slate-950 border-b border-slate-900 text-center font-bold text-[10.5px] sm:text-xs">
                                <th className="border border-slate-900 py-1.5 px-1 w-[3%] text-center">अ.क्र.</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[16%] text-left">जामीनदाराचे नाव व तपशील (GUARANTOR)</th>
                                <th className="border border-slate-900 py-1.5 px-1.5 w-[7%] text-right leading-tight">भागभांडवल / ठेवी (₹)</th>
                                <th className="border border-slate-900 py-1.5 px-1.5 w-[7.5%] text-center leading-tight">स्वतःचे कर्ज</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[15%] text-left">मुख्य कर्जदाराचे नाव (BORROWER)</th>
                                <th className="border border-slate-900 py-1.5 px-1.5 w-[7.5%] text-center leading-tight">कर्ज खाते नं.</th>
                                <th className="border border-slate-900 py-1.5 px-1.5 w-[9%] text-left">कर्ज योजना</th>
                                <th className="border border-slate-900 py-1.5 px-1.5 w-[6.5%] text-center">मंजूर दिनांक</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[8%] text-right leading-tight">मंजूर रक्कम (₹)</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[8%] text-right leading-tight">मुद्दल बाकी (₹)</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[7.5%] text-right leading-tight">व्याज बाकी (₹)</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[8.5%] text-right font-black">एकूण बाकी (₹)</th>
                                <th className="border border-slate-900 py-1.5 px-1 w-[4.5%] text-center">स्थान</th>
                                <th className="border border-slate-900 py-1.5 px-1.5 w-[7.5%] text-center">ऑडिट शेरा</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayGuarantors.map((g, gIdx) => {
                                const loans = g.activeLoans && g.activeLoans.length > 0 ? g.activeLoans : [];

                                if (loans.length === 0) {
                                    return (
                                        <tr key={g.guarantorMemberID} className="hover:bg-slate-50 text-slate-900 text-[11px] border-b border-slate-300">
                                            <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">{gIdx + 1}</td>
                                            <td className="border border-slate-900 py-1 px-2">
                                                <div className="font-bold text-slate-950 text-xs">{g.guarantorName}</div>
                                                <div className="text-[10px] text-slate-600 font-mono">
                                                    कोड: <span className="font-bold text-slate-900">{g.guarantorCode}</span> | CIF: {g.cifNo || '-'}
                                                </div>
                                            </td>
                                            <td className="border border-slate-900 py-1 px-1.5 text-right font-mono text-[10.5px]">
                                                <div>शे: ₹{(g.guarantorShares || 0).toLocaleString('en-IN')}</div>
                                                <div className="text-slate-600">ठे: ₹{(g.guarantorSavings || 0).toLocaleString('en-IN')}</div>
                                            </td>
                                            <td className="border border-slate-900 py-1 px-1.5 text-center text-[10.5px]">
                                                {g.ownLoanInfo || '-'}
                                            </td>
                                            <td colSpan={9} className="border border-slate-900 py-1 px-2 text-center text-slate-400 italic text-[10.5px]">
                                                कोणतेही चालू जामीन खाते उपलब्ध नाही
                                            </td>
                                            <td className="border border-slate-900 py-1 px-1.5 text-center text-[10px]">
                                                <span className="px-1.5 py-0.5 rounded text-emerald-800 bg-emerald-100 font-bold">
                                                    {g.auditStatus || 'नियमित'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <React.Fragment key={g.guarantorMemberID}>
                                        {loans.map((l, lIdx) => {
                                            const isFirstRow = lIdx === 0;
                                            return (
                                                <tr 
                                                    key={`${g.guarantorMemberID}-${lIdx}`} 
                                                    className={`hover:bg-slate-50 text-slate-900 text-[11px] ${isFirstRow ? 'border-t-2 border-slate-700 bg-slate-50/30' : 'border-t border-slate-200'}`}
                                                >
                                                    {/* Sr No */}
                                                    <td className="border border-slate-900 py-1 px-1 text-center font-mono font-medium">
                                                        {isFirstRow ? gIdx + 1 : ''}
                                                    </td>

                                                    {/* Guarantor Details */}
                                                    <td className="border border-slate-900 py-1 px-2">
                                                        {isFirstRow ? (
                                                            <div>
                                                                <div className="font-bold text-slate-950 text-xs flex items-center justify-between">
                                                                    <span>{g.guarantorName}</span>
                                                                    {loans.length > 1 && (
                                                                        <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1 rounded">
                                                                            {loans.length} खाती
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-600 font-mono">
                                                                    कोड: <span className="font-bold text-slate-900">{g.guarantorCode}</span> | CIF: {g.cifNo || '-'} | मो: {g.mobileNo || '-'}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-slate-400 pl-2">
                                                                └ (खाते क्र. {lIdx + 1})
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Guarantor Shares & Deposits */}
                                                    <td className="border border-slate-900 py-1 px-1.5 text-right font-mono text-[10.5px]">
                                                        {isFirstRow ? (
                                                            <div>
                                                                <div title="भागभांडवल">शे: ₹{(g.guarantorShares || 0).toLocaleString('en-IN')}</div>
                                                                <div className="text-slate-600" title="बचत ठेवी">ठे: ₹{(g.guarantorSavings || 0).toLocaleString('en-IN')}</div>
                                                            </div>
                                                        ) : ''}
                                                    </td>

                                                    {/* Guarantor's Own Loan */}
                                                    <td className="border border-slate-900 py-1 px-1.5 text-center text-[10.5px]">
                                                        {isFirstRow ? (
                                                            g.hasOverdueOwnLoan ? (
                                                                <span className="text-rose-700 font-bold bg-rose-50 px-1 py-0.5 rounded border border-rose-200 block text-[9.5px]">
                                                                    ⚠️ थकीत: {g.ownLoanInfo}
                                                                </span>
                                                            ) : (g.ownLoansCount || 0) > 0 ? (
                                                                <span className="text-slate-800 font-medium block text-[10px]">
                                                                    {g.ownLoanInfo}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400">-</span>
                                                            )
                                                        ) : ''}
                                                    </td>

                                                    {/* Borrower Name */}
                                                    <td className="border border-slate-900 py-1 px-2">
                                                        <div className="font-bold text-slate-900">{l.borrowerName}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                            {l.borrowerCode ? `कोड: ${l.borrowerCode}` : ''} {l.borrowerCIF ? `| CIF: ${l.borrowerCIF}` : ''}
                                                        </div>
                                                    </td>

                                                    {/* Loan Account No */}
                                                    <td className="border border-slate-900 py-1 px-1.5 text-center font-mono font-bold text-primary">
                                                        <div>{l.loanAccountNo}</div>
                                                        {l.legacyAccountNumber && (
                                                            <span className="inline-block mt-0.5 bg-purple-100 text-purple-950 border border-purple-300 px-1 py-0.2 rounded font-mono font-bold text-[9px]">
                                                                🏷️ जुने: {l.legacyAccountNumber}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Loan Type / Scheme */}
                                                    <td className="border border-slate-900 py-1 px-1.5 font-medium text-slate-800">
                                                        {l.loanType}
                                                    </td>

                                                    {/* Sanction Date */}
                                                    <td className="border border-slate-900 py-1 px-1 text-center font-mono text-[10.5px]">
                                                        {l.disbursementDateDisplay || formatDisplayDate(l.disbursementDate)}
                                                    </td>

                                                    {/* Sanctioned Amount */}
                                                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-semibold text-slate-900">
                                                        {l.sanctionedAmount ? `₹${l.sanctionedAmount.toLocaleString('en-IN')}` : '-'}
                                                    </td>

                                                    {/* Principal Balance */}
                                                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-medium text-slate-800">
                                                        {l.principalBalance ? `₹${l.principalBalance.toLocaleString('en-IN')}` : '₹0'}
                                                    </td>

                                                    {/* Interest Balance */}
                                                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-medium text-slate-700">
                                                        {l.interestBalance ? `₹${l.interestBalance.toLocaleString('en-IN')}` : '₹0'}
                                                    </td>

                                                    {/* Total Current Outstanding */}
                                                    <td className="border border-slate-900 py-1 px-2 text-right font-mono font-black text-emerald-800 bg-emerald-50/20">
                                                        {l.currentBalance ? `₹${l.currentBalance.toLocaleString('en-IN')}` : '₹0'}
                                                    </td>

                                                    {/* Position */}
                                                    <td className="border border-slate-900 py-1 px-1 text-center">
                                                        <span className="inline-block bg-slate-100 text-slate-800 text-[9.5px] font-bold px-1.5 py-0.5 rounded border border-slate-300">
                                                            {l.guarantorType}
                                                        </span>
                                                    </td>

                                                    {/* Audit Remarks */}
                                                    <td className="border border-slate-900 py-1 px-1 text-center text-[10px]">
                                                        {isFirstRow ? (
                                                            g.auditAlertCode === 'EXCESS_GUARANTEE' ? (
                                                                <span className="px-1.5 py-0.5 rounded text-amber-900 bg-amber-100 font-bold border border-amber-300 block leading-tight">
                                                                    २+ जामीन (आक्षेप)
                                                                </span>
                                                            ) : g.auditAlertCode === 'DEFAULTER_GUARANTOR' ? (
                                                                <span className="px-1.5 py-0.5 rounded text-rose-900 bg-rose-100 font-bold border border-rose-300 block leading-tight">
                                                                    थकीत कर्जदार
                                                                </span>
                                                            ) : g.auditAlertCode === 'OWN_BORROWER' ? (
                                                                <span className="px-1.5 py-0.5 rounded text-blue-900 bg-blue-100 font-semibold block leading-tight">
                                                                    स्वतः कर्जदार
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-emerald-900 bg-emerald-100 font-semibold block leading-tight">
                                                                    नियमित
                                                                </span>
                                                            )
                                                        ) : ''}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-900 text-xs">
                                <td colSpan={4} className="border border-slate-900 py-2 px-2 text-right uppercase tracking-wider">
                                    एकूण एकत्रित गोषवारा (Grand Total):
                                </td>
                                <td colSpan={3} className="border border-slate-900 py-2 px-2 text-left text-primary font-bold">
                                    एकूण जामीनदार: {totalGuarantorsCount} | एकूण खाती: {totalGuaranteedLoansCount}
                                </td>
                                <td className="border border-slate-900 py-2 px-1 text-center text-slate-600 font-medium text-[10px]">
                                    एकूण रक्कम:
                                </td>
                                <td className="border border-slate-900 py-2 px-2 text-right font-mono text-slate-950 font-bold">
                                    ₹{totalSanctionedAmtSum.toLocaleString('en-IN')}
                                </td>
                                <td className="border border-slate-900 py-2 px-2 text-right font-mono text-indigo-900 font-bold">
                                    ₹{totalPrincipalBalSum.toLocaleString('en-IN')}
                                </td>
                                <td className="border border-slate-900 py-2 px-2 text-right font-mono text-slate-900 font-bold">
                                    ₹{totalInterestBalSum.toLocaleString('en-IN')}
                                </td>
                                <td className="border border-slate-900 py-2 px-2 text-right font-mono text-emerald-900 font-black bg-emerald-100/50">
                                    ₹{totalCurrentBalSum.toLocaleString('en-IN')}
                                </td>
                                <td colSpan={2} className="border border-slate-900 py-2 px-1 text-center text-[10px] text-slate-600">
                                    पूर्ण पूर्तता
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                /* 2. GROUPED AUDIT VIEW (गटवारी नमुना - जामीनदारनिहाय सारांश व विस्तार) */
                <div className="overflow-x-auto">
                    <table className="cbs-table w-full border-collapse border border-slate-900 text-xs">
                        <thead>
                            <tr className="bg-white text-slate-950 border-b border-slate-900 text-center font-bold text-[10.5px] sm:text-xs">
                                <th className="border border-slate-900 py-1.5 px-1 w-[4%] text-center">अ.क्र.</th>
                                <th className="border border-slate-900 py-1.5 px-2 text-left">जामीनदाराचे नाव व तपशील (GUARANTOR)</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">भागभांडवल / ठेवी (₹)</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-center">स्वतःचे कर्ज</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[10%] text-center">हमी खाती</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[12%] text-right">एकूण मंजूर जामीन (₹)</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[13%] text-right">एकूण चालू बाकी (₹)</th>
                                <th className="border border-slate-900 py-1.5 px-2 w-[11%] text-center">ऑडिट शेरा</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayGuarantors.map((g, gIdx) => {
                                const loans = g.activeLoans && g.activeLoans.length > 0 ? g.activeLoans : [];
                                const isExpanded = expandedMemberIds.includes(g.guarantorMemberID);

                                return (
                                    <React.Fragment key={g.guarantorMemberID}>
                                        {/* Master Guarantor Summary Row */}
                                        <tr className="bg-slate-50/80 hover:bg-blue-50/40 border-t-2 border-slate-300 font-semibold text-slate-900 transition-colors">
                                            <td className="border border-slate-900 py-1.5 px-1 text-center font-mono font-bold text-slate-800 bg-slate-100">
                                                {gIdx + 1}
                                            </td>
                                            <td className="border border-slate-900 py-1.5 px-2">
                                                <div className="flex items-center gap-1.5">
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleMemberExpand(g.guarantorMemberID)}
                                                        className="text-primary hover:text-blue-900 no-print cursor-pointer p-0.5 rounded hover:bg-blue-100"
                                                        title={isExpanded ? 'खाती लपवा' : 'खाती पहा'}
                                                    >
                                                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                                    </button>
                                                    <div>
                                                        <span className="font-extrabold text-slate-950 text-xs">{g.guarantorName}</span>
                                                        <span className="ml-2 text-[10.5px] font-mono text-slate-600">
                                                            (कोड: <span className="font-bold text-slate-900">{g.guarantorCode}</span> | CIF: {g.cifNo || '-'} | मो: {g.mobileNo || '-'})
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="border border-slate-900 py-1.5 px-2 text-right font-mono text-[10.5px]">
                                                <div>शे: ₹{(g.guarantorShares || 0).toLocaleString('en-IN')}</div>
                                                <div className="text-slate-600">ठे: ₹{(g.guarantorSavings || 0).toLocaleString('en-IN')}</div>
                                            </td>
                                            <td className="border border-slate-900 py-1.5 px-2 text-center text-[10.5px]">
                                                {g.hasOverdueOwnLoan ? (
                                                    <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                                        ⚠️ थकीत: {g.ownLoanInfo}
                                                    </span>
                                                ) : (g.ownLoansCount || 0) > 0 ? (
                                                    <span className="text-slate-800 font-medium">
                                                        {g.ownLoanInfo}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="border border-slate-900 py-1.5 px-2 text-center">
                                                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-bold shadow-2xs">
                                                    {loans.length} खाती
                                                </span>
                                            </td>
                                            <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-bold text-slate-950">
                                                ₹{g.totalGuaranteedSanctionedAmount.toLocaleString('en-IN')}
                                            </td>
                                            <td className="border border-slate-900 py-1.5 px-2 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                                                ₹{g.totalGuaranteedCurrentBalance.toLocaleString('en-IN')}
                                            </td>
                                            <td className="border border-slate-900 py-1.5 px-2 text-center text-[10px]">
                                                {g.auditAlertCode === 'EXCESS_GUARANTEE' ? (
                                                    <span className="px-1.5 py-0.5 rounded text-amber-900 bg-amber-100 font-bold border border-amber-300">
                                                        २+ जामीन
                                                    </span>
                                                ) : g.auditAlertCode === 'DEFAULTER_GUARANTOR' ? (
                                                    <span className="px-1.5 py-0.5 rounded text-rose-900 bg-rose-100 font-bold border border-rose-300">
                                                        थकीत कर्जदार
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded text-emerald-900 bg-emerald-100 font-semibold">
                                                        नियमित
                                                    </span>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Collapsible Sub-Table for Guarantor's Loans */}
                                        {isExpanded && loans.length > 0 && (
                                            <tr>
                                                <td colSpan={8} className="p-0 border border-slate-900 bg-slate-50/40">
                                                    <div className="p-2 sm:px-6 py-2">
                                                        <table className="w-full text-[10.5px] border-collapse border border-slate-300 bg-white">
                                                            <thead>
                                                                <tr className="bg-slate-200/80 text-slate-900 font-bold text-center">
                                                                    <th className="border border-slate-300 p-1 w-8">#</th>
                                                                    <th className="border border-slate-300 p-1 w-24">कर्ज खाते नं.</th>
                                                                    <th className="border border-slate-300 p-1 text-left">मुख्य कर्जदाराचे नाव</th>
                                                                    <th className="border border-slate-300 p-1 text-left w-32">कर्ज योजना</th>
                                                                    <th className="border border-slate-300 p-1 w-24 text-center">वाटप दिनांक</th>
                                                                    <th className="border border-slate-300 p-1 w-24 text-right">मंजूर रक्कम (₹)</th>
                                                                    <th className="border border-slate-300 p-1 w-24 text-right">मुद्दल बाकी (₹)</th>
                                                                    <th className="border border-slate-300 p-1 w-24 text-right">व्याज बाकी (₹)</th>
                                                                    <th className="border border-slate-300 p-1 w-28 text-right font-bold">चालू बाकी (₹)</th>
                                                                    <th className="border border-slate-300 p-1 w-20 text-center">स्थान</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {loans.map((l, lIdx) => (
                                                                    <tr key={lIdx} className="hover:bg-blue-50/40 border-b border-slate-200">
                                                                        <td className="border border-slate-300 p-1 text-center font-mono">{lIdx + 1}</td>
                                                                        <td className="border border-slate-300 p-1 text-center font-mono font-bold text-primary">
                                                                            {l.loanAccountNo}
                                                                        </td>
                                                                        <td className="border border-slate-300 p-1 font-semibold text-slate-900">
                                                                            {l.borrowerName} <span className="text-[10px] text-slate-500 font-mono">({l.borrowerCode})</span>
                                                                        </td>
                                                                        <td className="border border-slate-300 p-1 text-slate-800">{l.loanType}</td>
                                                                        <td className="border border-slate-300 p-1 text-center font-mono">
                                                                            {l.disbursementDateDisplay || formatDisplayDate(l.disbursementDate)}
                                                                        </td>
                                                                        <td className="border border-slate-300 p-1 text-right font-mono">
                                                                            {l.sanctionedAmount ? `₹${l.sanctionedAmount.toLocaleString('en-IN')}` : '-'}
                                                                        </td>
                                                                        <td className="border border-slate-300 p-1 text-right font-mono">
                                                                            {l.principalBalance ? `₹${l.principalBalance.toLocaleString('en-IN')}` : '₹0'}
                                                                        </td>
                                                                        <td className="border border-slate-300 p-1 text-right font-mono">
                                                                            {l.interestBalance ? `₹${l.interestBalance.toLocaleString('en-IN')}` : '₹0'}
                                                                        </td>
                                                                        <td className="border border-slate-300 p-1 text-right font-mono font-bold text-emerald-800 bg-emerald-50/20">
                                                                            {l.currentBalance ? `₹${l.currentBalance.toLocaleString('en-IN')}` : '₹0'}
                                                                        </td>
                                                                        <td className="border border-slate-300 p-1 text-center">
                                                                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                                                                                {l.guarantorType}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-slate-100 font-black text-slate-950 border-t-2 border-slate-900 text-xs">
                                <td colSpan={4} className="border border-slate-900 py-2 px-2 text-right uppercase tracking-wider">
                                    एकूण एकत्रित बाकी (Grand Total):
                                </td>
                                <td className="border border-slate-900 py-2 px-2 text-center text-primary font-bold">
                                    {totalGuaranteedLoansCount} खाती
                                </td>
                                <td className="border border-slate-900 py-2 px-2 text-right font-mono text-slate-950 font-bold">
                                    ₹{totalSanctionedAmtSum.toLocaleString('en-IN')}
                                </td>
                                <td className="border border-slate-900 py-2 px-2 text-right font-mono text-emerald-900 font-black bg-emerald-100/50">
                                    ₹{totalCurrentBalSum.toLocaleString('en-IN')}
                                </td>
                                <td className="border border-slate-900 py-2 px-2 text-center text-[10.5px] text-slate-600">
                                    {totalGuarantorsCount} जामीनदार
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* 3. STATUTORY CO-OPERATIVE AUDIT NOTES & INSTRUCTIONS BOX */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-300 rounded-xs text-[11px] text-slate-800 space-y-1">
                <div className="font-bold text-slate-950 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                    <Shield size={13} className="text-primary" />
                    <span>महाराष्ट्र सहकारी संस्था अधिनियम व वैधानिक लेखापरीक्षण नियमावली मार्गदर्शक सूचना:</span>
                </div>
                <ul className="list-disc list-inside text-[10.5px] space-y-0.5 text-slate-700 pt-1">
                    <li>
                        <strong>जास्तीत जास्त जामीन मर्यादा:</strong> महाराष्ट्र सहकारी संस्था अधिनियम व संस्थेच्या मंजूर पोटनियमानुसार कोणत्याही एका सभासदास सर्वसाधारणपणे २ पेक्षा जास्त सभासदांच्या कर्जास जामीन राहता येत नाही. २ पेक्षा जास्त जामीन असणाऱ्या खात्यांवर लेखापरीक्षणात आक्षेप नोंदविला जातो.
                    </li>
                    <li>
                        <strong>थकीत कर्जदारास जामीन प्रतिबंध:</strong> ज्या सभासदाचे स्वतःचे संस्थेकडील कोणतेही कर्ज थकीत (Overdue/NPA) आहे, अशा सभासदास इतर कोणाच्याही कर्जास जामीनदार म्हणून स्वीकारण्यास वैधानिक बंदी आहे.
                    </li>
                    <li>
                        <strong>आर्थिक पत व भागभांडवल तपासणी:</strong> जामीनदाराचे संस्थेतील वसूल भागभांडवल (Shares), मुदत/बचत ठेवी आणि त्याची परतफेड क्षमता विचारात घेऊनच जामीनकीची कायदेशीर वैधता मान्य केली जाते.
                    </li>
                </ul>
            </div>
        </CbsReportLayout>
    );
};

export default GuarantorReport;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ShieldAlert, Award, ChevronRight, ChevronDown, AlertTriangle, FileText, FolderClosed } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import MemberSearchSelect from './common/MemberSearchSelect';

interface Member360DashboardProps {
    onNavigate: (tab: string, params?: any) => void;
}

interface MemberInfoDto {
    memberID: number;
    memberCode: string;
    oldMemberCode?: string;
    cifNo?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    nickName?: string;
    mobileNo: string;
    aadhaarNo: string;
    panNo?: string;
    branchName: string;
    joiningDate: string;
    status: string;
    photoPath?: string;
}

interface ProductSummaryDto {
    accounts: number;
    balance: number;
    statusColor: string;
    lastTxDate?: string | null;
    folioNo?: string | null;
}

interface PortfolioSummaryDto {
    savings: ProductSummaryDto;
    fixedDeposits: ProductSummaryDto;
    recurringDeposits: ProductSummaryDto;
    pigmy: ProductSummaryDto;
    loans: ProductSummaryDto;
    shares: ProductSummaryDto;
}

interface RecentTransactionDto {
    date: string;
    module: string;
    transactionType: string;
    amount: number;
    branch: string;
    voucherNo: string;
}

interface Member360Data {
    memberInfo: MemberInfoDto;
    balances: {
        totalDeposits: number;
        totalLoansOutstanding: number;
        shareCapital: number;
    };
    portfolio: PortfolioSummaryDto;
    recentTransactions: RecentTransactionDto[];
}

export default function Member360Dashboard({ onNavigate }: Member360DashboardProps) {
    const [rawMembers, setRawMembers] = useState<any[]>([]);
    const [membersList, setMembersList] = useState<any[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState<string>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('memberId') || sessionStorage.getItem('last_member360_selected_id') || '';
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [data, setData] = useState<Member360Data | null>(null);
    const [error, setError] = useState<string>('');
    
    const [alertMsg, setAlertMsg] = useState<string>('');
    const [activeReportModule, setActiveReportModule] = useState<'savings' | 'fd' | 'rd' | 'pigmy' | 'loans' | 'shares' | null>(null);

    const handleReportNavigate = (rawId: string) => {
        if (rawId.includes('&')) {
            const [tab, query] = rawId.split('&');
            const params: any = { memberId: selectedMemberId };
            const searchParams = new URLSearchParams(query);
            searchParams.forEach((v, k) => {
                params[k] = v;
            });
            onNavigate(tab, params);
        } else {
            onNavigate(rawId, { memberId: selectedMemberId });
        }
    };

    const moduleReportsConfig = {
        savings: {
            title: 'बचत ठेव (SAVING) रिपोर्ट',
            countLabel: '४ रिपोर्ट उपलब्ध',
            borderColor: 'border-blue-600',
            headerBg: 'bg-blue-50/90',
            headerBorder: 'border-blue-200',
            headerText: 'text-blue-900',
            iconColor: 'text-blue-600',
            hoverBorder: 'hover:border-blue-500',
            hoverBg: 'hover:bg-blue-50/50',
            hoverText: 'hover:text-blue-900',
            containerBg: 'bg-blue-50/20',
            closeBtnHover: 'hover:bg-blue-100',
            reports: [
                { id: 'saving-account-list-report', name: '१. बचत खाते यादी (Saving Account List)' },
                { id: 'saving-khatavani-report', name: '२. बचत ठेव खतावणी (Saving Ledger Statement)' },
                { id: 'saving-passbook', name: '३. बचत पासबुक प्रिंट (Passbook Print)' },
                { id: 'saving-posting', name: '४. व्याज जमा पोस्टिंग (Interest Posting Statement)' },
            ]
        },
        fd: {
            title: 'मुदत ठेव (FD) रिपोर्ट',
            countLabel: '५ रिपोर्ट उपलब्ध',
            borderColor: 'border-teal-600',
            headerBg: 'bg-teal-50/90',
            headerBorder: 'border-teal-200',
            headerText: 'text-teal-900',
            iconColor: 'text-teal-600',
            hoverBorder: 'hover:border-teal-500',
            hoverBg: 'hover:bg-teal-50/50',
            hoverText: 'hover:text-teal-900',
            containerBg: 'bg-teal-50/20',
            closeBtnHover: 'hover:bg-teal-100',
            reports: [
                { id: 'fd-reports&reportType=Register', name: '१. मुदत ठेव नोंदवही (FD Register)' },
                { id: 'fd-reports&reportType=Outstanding', name: '२. मुदत ठेव बाकी रिपोर्ट (FD Outstanding)' },
                { id: 'fd-reports&reportType=MaturityDue', name: '३. मुदतपूर्ती देय रिपोर्ट (Maturity Due)' },
                { id: 'fd-reports&reportType=MemberLedger', name: '४. मुदत ठेव खातावणी रिपोर्ट (Member FD Ledger Statement)' },
                { id: 'fd-accrual', name: '५. मुदत ठेव व्याज तरतूद रिपोर्ट (FD Interest Provision)' },
            ]
        },
        rd: {
            title: 'आवर्ती ठेव (RD) रिपोर्ट',
            countLabel: '६ रिपोर्ट उपलब्ध',
            borderColor: 'border-amber-600',
            headerBg: 'bg-amber-50/90',
            headerBorder: 'border-amber-200',
            headerText: 'text-amber-900',
            iconColor: 'text-amber-600',
            hoverBorder: 'hover:border-amber-500',
            hoverBg: 'hover:bg-amber-50/50',
            hoverText: 'hover:text-amber-900',
            containerBg: 'bg-amber-50/20',
            closeBtnHover: 'hover:bg-amber-100',
            reports: [
                { id: 'rd-reports&reportType=register', name: '१. आरडी नोंदवही (RD Register)' },
                { id: 'rd-reports&reportType=outstanding', name: '२. आरडी बाकी रिपोर्ट (RD Outstanding)' },
                { id: 'rd-reports&reportType=defaulters', name: '३. थकीत खातेदार यादी (Defaulters List)' },
                { id: 'rd-reports&reportType=maturity', name: '४. मुदतपूर्ती देय रिपोर्ट (Maturity Due)' },
                { id: 'rd-reports&reportType=closed', name: '५. खाते बंद रिपोर्ट (Closure Report)' },
                { id: 'rd-accrual', name: '६. आरडी व्याज तरतूद रिपोर्ट (Accrual Posting)' },
            ]
        },
        pigmy: {
            title: 'पिग्मी ठेव (PIGMY) रिपोर्ट',
            countLabel: '५ रिपोर्ट उपलब्ध',
            borderColor: 'border-emerald-600',
            headerBg: 'bg-emerald-50/90',
            headerBorder: 'border-emerald-200',
            headerText: 'text-emerald-900',
            iconColor: 'text-emerald-600',
            hoverBorder: 'hover:border-emerald-500',
            hoverBg: 'hover:bg-emerald-50/50',
            hoverText: 'hover:text-emerald-900',
            containerBg: 'bg-emerald-50/20',
            closeBtnHover: 'hover:bg-emerald-100',
            reports: [
                { id: 'pigmy-reports&reportType=register', name: '१. पिग्मी ठेव नोंदवही (Pigmy Register)' },
                { id: 'pigmy-reports&reportType=settlement', name: '२. एजंट रोख ताळमेळ (Daily Settlement)' },
                { id: 'pigmy-reports&reportType=commission', name: '३. एजंट कमिशन विवरणपत्रक (Commission Statement)' },
                { id: 'pigmy-reports&reportType=ledger', name: '४. पिग्मी खाते लेजर (Account Ledger)' },
                { id: 'pigmy-reports&reportType=collection-register', name: '५. दैनिक वसुली रजिस्टर (Daily Collection Register)' },
            ]
        },
        loans: {
            title: 'कर्ज विभाग (LOAN) रिपोर्ट',
            countLabel: '९ रिपोर्ट उपलब्ध',
            borderColor: 'border-red-700/80',
            headerBg: 'bg-red-50/90',
            headerBorder: 'border-red-200',
            headerText: 'text-red-900',
            iconColor: 'text-red-600',
            hoverBorder: 'hover:border-red-500',
            hoverBg: 'hover:bg-red-50/50',
            hoverText: 'hover:text-red-900',
            containerBg: 'bg-red-50/20',
            closeBtnHover: 'hover:bg-red-100',
            reports: [
                { id: 'loan-disbursement-register', name: '१. कर्ज वाटप रजिस्टर (कर्ज प्रकारानुसार)' },
                { id: 'loan-collection-register', name: '२. कर्ज वसुली रजिस्टर (कर्ज प्रकारानुसार)' },
                { id: 'loan-ledger-report', name: '३. कर्ज खतावणी (Loan Ledger)' },
                { id: 'loan-overdue-report', name: '४. थकीत कर्ज यादी (Overdue Loan List)' },
                { id: 'loan-recovery-notice-report', name: '५. लवादपूर्व कर्ज फेडीची नोटीस (Notice Report)' },
                { id: 'guarantor-loan-report', name: '६. सभासद जामीनदार रिपोर्ट (Guarantor Loan Report)' },
                { id: 'npa-register', name: '७. NPA तरतूद माहिती (NPA Register)' },
                { id: 'interest-waiver-register', name: '८. कर्ज व्याज सूट व तडजोड रिपोर्ट (OTS & Waiver Register)' },
                { id: 'loan-rate', name: '९. कर्ज दर पत्रक (Loan Rate)' },
            ]
        },
        shares: {
            title: 'भाग भांडवल (SHARES) रिपोर्ट',
            countLabel: '६ रिपोर्ट उपलब्ध',
            borderColor: 'border-purple-600',
            headerBg: 'bg-purple-50/90',
            headerBorder: 'border-purple-200',
            headerText: 'text-purple-900',
            iconColor: 'text-purple-600',
            hoverBorder: 'hover:border-purple-500',
            hoverBg: 'hover:bg-purple-50/50',
            hoverText: 'hover:text-purple-900',
            containerBg: 'bg-purple-50/20',
            closeBtnHover: 'hover:bg-purple-100',
            reports: [
                { id: 'shares-khatavani-report', name: '१. शेअर्स खतावणी (Shares Ledger)' },
                { id: 'i-namuna-report', name: '२. नमूना आय (I-Namuna Register)' },
                { id: 'sabhasad-labhansh-report', name: '३. सभासद लाभांश यादी (Dividend List)' },
                { id: 'member-balance-report', name: '४. सभासद शेअर्स यादी (Member Shares List)' },
                { id: 'member-list-report', name: '५. सभासद यादी (Member List)' },
                { id: 'aadhaar-list', name: '६. आधार कार्ड यादी (Aadhaar Card List)' },
            ]
        }
    };

    // Keep selectedMemberId synced in sessionStorage and URL search params
    useEffect(() => {
        if (selectedMemberId) {
            sessionStorage.setItem('last_member360_selected_id', selectedMemberId);
            const params = new URLSearchParams(window.location.search);
            if (params.get('memberId') !== selectedMemberId) {
                params.set('memberId', selectedMemberId);
                const newUrl = `${window.location.pathname}?${params.toString()}`;
                window.history.replaceState(null, '', newUrl);
            }
        }
    }, [selectedMemberId]);

    // Fetch customers on load
    useEffect(() => {
        let isMounted = true;
        const fetchMembers = async () => {
            try {
                const res = await axios.get('/api/Customers');
                if (!isMounted) return;
                setRawMembers(res.data || []);
                const formatted = res.data.map((m: any) => {
                    const fullName = `${m.firstName} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName}`.trim();
                    const cifStr = m.cifNo ? `CIF: ${m.cifNo}` : '';
                    const codeStr = m.memberCode ? `सभासद नं: ${m.memberCode}` : '';
                    const oldNo = m.oldMemberCode || m.legacyMemberNo;
                    const oldNoStr = oldNo ? `जुना नं: ${oldNo}` : '';

                    const details = [cifStr, codeStr, oldNoStr].filter(Boolean).join(' | ');
                    return {
                        label: details ? `${fullName} (${details})` : `${fullName} (${m.cifNo || m.memberCode || ''})`,
                        value: (m.customerID || m.memberID).toString()
                    };
                });
                setMembersList(formatted);
                if (formatted.length > 0) {
                    const params = new URLSearchParams(window.location.search);
                    const urlMemberId = params.get('memberId');
                    const savedMemberId = sessionStorage.getItem('last_member360_selected_id');
                    const targetId = urlMemberId || savedMemberId || selectedMemberId;

                    if (targetId && formatted.some((m: any) => m.value === targetId)) {
                        setSelectedMemberId(targetId);
                    } else {
                        setSelectedMemberId(formatted[0].value);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    console.error("Failed to load customer list", err);
                    setError("ग्राहकांची यादी लोड करता आली नाही.");
                }
            }
        };
        fetchMembers();
        return () => { isMounted = false; };
    }, []);

    // Fetch 360 view when member selection changes
    useEffect(() => {
        if (!selectedMemberId) return;
        
        const fetch360Data = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await axios.get(`/api/Reports/Member360/${selectedMemberId}`);
                setData(res.data);
            } catch (err) {
                console.error("Failed to load 360 summary", err);
                setError("सभासद ३६० डिग्री सारांश लोड करता आला नाही.");
                setData(null);
            } finally {
                setLoading(false);
            }
        };
        fetch360Data();
    }, [selectedMemberId]);

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime()) || d.getFullYear() <= 1) return '-';
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return '-';
        }
    };

    const getStatusBadge = (color: string) => {
        switch ((color || '').toLowerCase()) {
            case 'green':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'yellow':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'red':
                return 'bg-red-100 text-red-800 border-red-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="p-2 max-w-full h-full flex flex-col bg-gray-50 text-[11px] font-sans relative overflow-y-auto">
            {alertMsg && (
                <div className="fixed top-4 right-4 z-50 bg-primary text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-300">
                    <ShieldAlert size={16} className="text-amber-400" />
                    {alertMsg}
                </div>
            )}

            <div className="bg-white rounded-md shadow-sm border border-gray-300 flex flex-col mb-4 overflow-visible">

                <div className="bg-gradient-to-r from-slate-900 via-[#0E8A5A] to-emerald-950 text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm rounded-t-md">
                    <h2 className="text-xs font-bold tracking-wide flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-400" />
                        <span>सभासद ३६०° डॅशबोर्ड (Member 360° Comprehensive View)</span>
                    </h2>

                    <div className="w-full sm:w-80 md:w-96 flex items-center gap-2 bg-white/10 px-2 py-0.5 rounded border border-white/20">
                        <label className="text-[10px] font-bold text-slate-100 whitespace-nowrap">सभासद:</label>
                        <div className="flex-1 text-slate-900">
                            <MemberSearchSelect
                                members={rawMembers}
                                value={selectedMemberId ? Number(selectedMemberId) : ''}
                                onChange={(val) => setSelectedMemberId(val ? String(val) : '')}
                                placeholder="-- नाव, CIF किंवा जुना नं शोधा --"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-3">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 bg-white border border-gray-200 rounded-md shadow-xs">
                            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs text-gray-600 font-semibold mt-3">माहिती लोड होत आहे... (Loading Profile...)</span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-800 text-xs p-3 rounded border border-red-200 mb-3 font-semibold flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="text-red-600" />
                                <span>{error}</span>
                            </div>
                            <button
                                onClick={() => {
                                    const id = selectedMemberId;
                                    setSelectedMemberId('');
                                    setTimeout(() => setSelectedMemberId(id), 50);
                                }}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] rounded cursor-pointer"
                            >
                                पुनः प्रयत्न करा (Retry)
                            </button>
                        </div>
                    )}

                    {!loading && !data && !error && (
                        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 border border-dashed border-gray-300 rounded-md text-gray-400">
                            <Search size={36} className="stroke-[1.5] mb-2 opacity-60 text-emerald-700" />
                            <span className="text-xs font-bold text-gray-600">कृपया प्रोफाइल पाहण्यासाठी वरील ड्रॉपडाऊनमधून सभासद निवडा.</span>
                        </div>
                    )}

                    {!loading && data && (
                        <div className="grid grid-cols-1 gap-4">
                            {/* Header Summary Section */}
                            <div className="bg-gradient-to-r from-slate-900 via-[#0E8A5A] to-emerald-950 text-white rounded-md shadow-sm p-4 flex flex-wrap md:flex-nowrap gap-4 items-center border border-white/20 relative overflow-hidden">
                                <div className="absolute -right-16 -top-16 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                                
                                <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white font-extrabold text-lg shadow-inner select-none shrink-0">
                                    {data.memberInfo.photoPath ? (
                                        <img src={data.memberInfo.photoPath} alt="Photo" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        `${(data.memberInfo?.firstName || 'M')[0]}${(data.memberInfo?.lastName || 'M')[0]}`
                                    )}
                                </div>
                                
                                <div className="flex-1 min-w-[280px]">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-sm md:text-base font-extrabold tracking-tight">
                                            {data.memberInfo.firstName} {data.memberInfo.middleName || ''} {data.memberInfo.lastName}
                                            {data.memberInfo.nickName && (
                                                <span className="text-amber-200 text-xs font-semibold ml-1.5 opacity-90">({data.memberInfo.nickName})</span>
                                            )}
                                        </h2>
                                        <span className="text-[9px] bg-white/20 text-white px-2 py-0.5 rounded-md font-mono font-bold tracking-wider uppercase border border-white/10" title="सभासद कोड">
                                            {data.memberInfo.memberCode}
                                        </span>
                                        {data.memberInfo.cifNo && (
                                            <span className="text-[9px] bg-sky-500/25 text-sky-200 px-2 py-0.5 rounded-md font-mono font-bold tracking-wider border border-sky-400/30" title="CIF नंबर">
                                                CIF: {data.memberInfo.cifNo}
                                            </span>
                                        )}
                                        {data.memberInfo.oldMemberCode && (
                                            <span className="text-[9px] bg-amber-500/25 text-amber-200 px-2 py-0.5 rounded-md font-mono font-bold tracking-wider border border-amber-400/30" title="जुना सभासद नंबर">
                                                जुना नं: {data.memberInfo.oldMemberCode}
                                            </span>
                                        )}
                                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold border ${data.memberInfo.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' : 'bg-rose-500/20 text-rose-300 border-rose-400/30'}`}>
                                            {data.memberInfo.status === 'Active' ? 'सक्रीय (Active)' : 'निष्क्रिय (Inactive)'}
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-2 gap-x-4 mt-3 text-xs text-slate-100/90 font-medium">
                                        <div><span className="text-white/60 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">CIF नं:</span> {data.memberInfo.cifNo || '-'}</div>
                                        <div><span className="text-white/60 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">जुना नं:</span> {data.memberInfo.oldMemberCode || '-'}</div>
                                        <div><span className="text-white/60 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">मोबाईल:</span> {data.memberInfo.mobileNo || '-'}</div>
                                        <div><span className="text-white/60 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">आधार क्रमांक:</span> {data.memberInfo.aadhaarNo || '-'}</div>
                                        <div><span className="text-white/60 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">शाखा:</span> {data.memberInfo.branchName || '-'}</div>
                                        <div><span className="text-white/60 font-semibold block text-[10px] uppercase tracking-wider mb-0.5">दाखल तारीख:</span> {formatDate(data.memberInfo.joiningDate)}</div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2.5 border-t md:border-t-0 md:border-l border-white/15 pt-3 md:pt-0 md:pl-4 w-full md:w-auto justify-around shrink-0 flex-wrap sm:flex-nowrap">
                                    <div className="text-center md:text-right bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex-1 sm:flex-none">
                                        <div className="text-[9px] font-bold text-emerald-200 uppercase tracking-wider">एकूण ठेव (Deposits)</div>
                                        <div className="text-sm font-black text-emerald-300 mt-0.5">₹ {(data.balances?.totalDeposits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                    <div className="text-center md:text-right bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex-1 sm:flex-none">
                                        <div className="text-[9px] font-bold text-purple-200 uppercase tracking-wider">भाग भांडवल (Shares)</div>
                                        <div className="text-sm font-black text-purple-300 mt-0.5">₹ {(data.balances?.shareCapital || data.portfolio?.shares?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                    <div className="text-center md:text-right bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex-1 sm:flex-none">
                                        <div className="text-[9px] font-bold text-rose-200 uppercase tracking-wider">कर्ज बाकी (Loans)</div>
                                        <div className="text-sm font-black text-rose-300 mt-0.5">₹ {(data.balances?.totalLoansOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                    <div className="text-center md:text-right bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-400/30 flex-1 sm:flex-none">
                                        <div className="text-[9px] font-bold text-amber-200 uppercase tracking-wider">निव्वळ शिल्लक (Net)</div>
                                        <div className="text-sm font-black text-amber-300 mt-0.5">₹ {((data.balances?.totalDeposits || 0) + (data.balances?.shareCapital || data.portfolio?.shares?.balance || 0) - (data.balances?.totalLoansOutstanding || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                    </div>
                                </div>
                            </div>

                            {/* 360 Degree Product Cards */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-600 mb-3 tracking-wider uppercase flex items-center justify-between">
                                    <span>पोर्टफोलिओ प्रॉडक्ट्स (Product Accounts)</span>
                                </h3>
                                
                                {(() => {
                                    const hasSavings = (data.portfolio.savings?.accounts || 0) > 0 || (data.portfolio.savings?.balance || 0) > 0 || Boolean(data.portfolio.savings?.lastTxDate);
                                    const hasFD = (data.portfolio.fixedDeposits?.accounts || 0) > 0 || (data.portfolio.fixedDeposits?.balance || 0) > 0 || Boolean(data.portfolio.fixedDeposits?.lastTxDate);
                                    const hasRD = (data.portfolio.recurringDeposits?.accounts || 0) > 0 || (data.portfolio.recurringDeposits?.balance || 0) > 0 || Boolean(data.portfolio.recurringDeposits?.lastTxDate);
                                    const hasPigmy = (data.portfolio.pigmy?.accounts || 0) > 0 || (data.portfolio.pigmy?.balance || 0) > 0 || Boolean(data.portfolio.pigmy?.lastTxDate);
                                    const hasLoans = (data.portfolio.loans?.accounts || 0) > 0 || (data.portfolio.loans?.balance || 0) > 0 || Boolean(data.portfolio.loans?.lastTxDate);
                                    const hasShares = (data.portfolio.shares?.accounts || 0) > 0 || (data.portfolio.shares?.balance || 0) > 0 || Boolean(data.portfolio.shares?.folioNo);

                                    return (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                                            
                                            {/* Savings Deposit Card */}
                                            <div className="bg-white border border-slate-200/90 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[450px] h-[450px] hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.16)] hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group">
                                                <div className="p-4 border-b border-slate-100 bg-slate-50/60 rounded-t-xl border-t-4 border-t-blue-500">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs md:text-sm font-extrabold text-slate-800">१. बचत ठेव (Savings)</span>
                                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadge(data.portfolio.savings.statusColor)}`}>
                                                            {hasSavings ? 'सुरू' : 'शून्य'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3.5 flex justify-between items-end">
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-semibold">एकूण खाती: <span className="font-bold text-slate-700">{data.portfolio.savings.accounts}</span></div>
                                                            <div className="text-base md:text-lg font-black text-slate-800 mt-1">₹ {data.portfolio.savings.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 font-medium">अखेरचा व्यवहार</div>
                                                            <div className="text-xs font-bold text-slate-600 mt-0.5">{data.portfolio.savings.lastTxDate || '-'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-3 flex flex-col gap-1.5 text-xs text-primary font-semibold flex-1 justify-start">
                                                    <button onClick={() => onNavigate('saving-account', { memberId: selectedMemberId })} className={`text-left py-1.5 px-2.5 rounded-md hover:bg-blue-50 font-bold flex items-center justify-between hover:text-blue-700 cursor-pointer transition-colors ${!hasSavings ? 'bg-blue-50/80 border border-blue-200 text-blue-800' : ''}`}>
                                                        <span>{!hasSavings ? '+ नवीन बचत खाते उघडा' : 'नवे बचत खाते उघडा'}</span> <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                                    </button>

                                                    {hasSavings && (
                                                        <>
                                                            <button onClick={() => onNavigate('saving-transaction', { memberId: selectedMemberId, type: 'Deposit' })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-blue-700 cursor-pointer transition-colors">
                                                                <span>बचत जमा नोंदणी</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('saving-transaction', { memberId: selectedMemberId, type: 'Withdrawal' })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-blue-700 cursor-pointer transition-colors">
                                                                <span>बचत उचल नोंदणी</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('saving-posting')} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-blue-700 cursor-pointer transition-colors">
                                                                <span>व्याज जमा पोस्टिंग</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('saving-passbook', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-blue-700 cursor-pointer transition-colors">
                                                                <span>पासबुक प्रिंट करा</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('saving-closing', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-blue-700 cursor-pointer transition-colors">
                                                                <span>खाते बंद प्रक्रिया</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setActiveReportModule(prev => prev === 'savings' ? null : 'savings')} 
                                                                className={`text-left py-1.5 px-2.5 rounded-md font-bold flex items-center justify-between cursor-pointer transition-all ${
                                                                    activeReportModule === 'savings'
                                                                        ? 'bg-blue-600 text-white shadow-xs' 
                                                                        : 'bg-blue-50/80 border border-blue-200 text-blue-800 hover:bg-blue-100 hover:text-blue-900'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <span>📊</span> बचत रिपोर्ट (Savings Reports)
                                                                </span> 
                                                                {activeReportModule === 'savings' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Fixed Deposit Card */}
                                            <div className="bg-white border border-slate-200/90 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[450px] h-[450px] hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.16)] hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group">
                                                <div className="p-4 border-b border-slate-100 bg-slate-50/60 rounded-t-xl border-t-4 border-t-teal-500">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs md:text-sm font-extrabold text-slate-800">२. मुदत ठेव (FD)</span>
                                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadge(data.portfolio.fixedDeposits.statusColor)}`}>
                                                            {hasFD ? 'सुरू' : 'शून्य'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3.5 flex justify-between items-end">
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-semibold">एकूण खाती: <span className="font-bold text-slate-700">{data.portfolio.fixedDeposits.accounts}</span></div>
                                                            <div className="text-base md:text-lg font-black text-slate-800 mt-1">₹ {data.portfolio.fixedDeposits.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 font-medium">अखेरचा व्यवहार</div>
                                                            <div className="text-xs font-bold text-slate-600 mt-0.5">{data.portfolio.fixedDeposits.lastTxDate || '-'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-3 flex flex-col gap-1.5 text-xs text-primary font-semibold flex-1 justify-start">
                                                    <button onClick={() => onNavigate('fd-account', { memberId: selectedMemberId })} className={`text-left py-1.5 px-2.5 rounded-md hover:bg-teal-50 font-bold flex items-center justify-between hover:text-teal-700 cursor-pointer transition-colors ${!hasFD ? 'bg-teal-50/80 border border-teal-200 text-teal-800' : ''}`}>
                                                        <span>{!hasFD ? '+ नवीन FD उघडा' : 'नवे FD उघडा'}</span> <ChevronRight size={14} />
                                                    </button>

                                                    {hasFD && (
                                                        <>
                                                            <button onClick={() => onNavigate('fd-scheme')} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-teal-700 cursor-pointer transition-colors">
                                                                <span>ठेव योजना (Schemes)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('fd-migrate', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-teal-700 cursor-pointer transition-colors">
                                                                <span>ठेव स्थलांतर (Migration)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('fd-accrual')} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-teal-700 cursor-pointer transition-colors">
                                                                <span>व्याज तरतूद (Accrual)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('fd-withdrawal', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-teal-700 cursor-pointer transition-colors">
                                                                <span>मुदतपूर्ती प्रक्रिया</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setActiveReportModule(prev => prev === 'fd' ? null : 'fd')} 
                                                                className={`text-left py-1.5 px-2.5 rounded-md font-bold flex items-center justify-between cursor-pointer transition-all ${
                                                                    activeReportModule === 'fd'
                                                                        ? 'bg-teal-600 text-white shadow-xs' 
                                                                        : 'bg-teal-50/80 border border-teal-200 text-teal-800 hover:bg-teal-100 hover:text-teal-900'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <span>📊</span> ठेव रिपोर्ट (FD Reports)
                                                                </span> 
                                                                {activeReportModule === 'fd' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Recurring Deposit Card */}
                                            <div className="bg-white border border-slate-200/90 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[450px] h-[450px] hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.16)] hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group">
                                                <div className="p-4 border-b border-slate-100 bg-slate-50/60 rounded-t-xl border-t-4 border-t-amber-500">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs md:text-sm font-extrabold text-slate-800">३. आवर्ती ठेव (RD)</span>
                                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadge(data.portfolio.recurringDeposits.statusColor)}`}>
                                                            {hasRD ? 'सुरू' : 'शून्य'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3.5 flex justify-between items-end">
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-semibold">एकूण खाती: <span className="font-bold text-slate-700">{data.portfolio.recurringDeposits.accounts}</span></div>
                                                            <div className="text-base md:text-lg font-black text-slate-800 mt-1">₹ {data.portfolio.recurringDeposits.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 font-medium">अखेरचा व्यवहार</div>
                                                            <div className="text-xs font-bold text-slate-600 mt-0.5">{data.portfolio.recurringDeposits.lastTxDate || '-'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-3 flex flex-col gap-1.5 text-xs text-primary font-semibold flex-1 justify-start">
                                                    <button onClick={() => onNavigate('rd-account', { memberId: selectedMemberId })} className={`text-left py-1.5 px-2.5 rounded-md hover:bg-amber-50 font-bold flex items-center justify-between hover:text-amber-700 cursor-pointer transition-colors ${!hasRD ? 'bg-amber-50/80 border border-amber-200 text-amber-800' : ''}`}>
                                                        <span>{!hasRD ? '+ नवीन RD उघडा' : 'नवे RD उघडा'}</span> <ChevronRight size={14} />
                                                    </button>

                                                    {hasRD && (
                                                        <>
                                                            <button onClick={() => onNavigate('rd-collect', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-amber-700 cursor-pointer transition-colors">
                                                                <span>मासिक हप्ता (Collection)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('rd-scheme')} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-amber-700 cursor-pointer transition-colors">
                                                                <span>ठेव योजना (Schemes)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('rd-migrate', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-amber-700 cursor-pointer transition-colors">
                                                                <span>ठेव स्थलांतर (Migration)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('rd-withdrawal', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-amber-700 cursor-pointer transition-colors">
                                                                <span>मुदतपूर्ती प्रक्रिया</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setActiveReportModule(prev => prev === 'rd' ? null : 'rd')} 
                                                                className={`text-left py-1.5 px-2.5 rounded-md font-bold flex items-center justify-between cursor-pointer transition-all ${
                                                                    activeReportModule === 'rd'
                                                                        ? 'bg-amber-600 text-white shadow-xs' 
                                                                        : 'bg-amber-50/80 border border-amber-200 text-amber-800 hover:bg-amber-100 hover:text-amber-900'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <span>📊</span> ठेव रिपोर्ट (RD Reports)
                                                                </span> 
                                                                {activeReportModule === 'rd' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Pigmy Deposit Card */}
                                            <div className="bg-white border border-slate-200/90 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[450px] h-[450px] hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.16)] hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group">
                                                <div className="p-4 border-b border-slate-100 bg-slate-50/60 rounded-t-xl border-t-4 border-t-emerald-500">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs md:text-sm font-extrabold text-slate-800">४. पिग्मी ठेव (Pigmy)</span>
                                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadge(data.portfolio.pigmy?.statusColor || 'Gray')}`}>
                                                            {hasPigmy ? 'सुरू' : 'शून्य'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3.5 flex justify-between items-end">
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-semibold">एकूण खाती: <span className="font-bold text-slate-700">{data.portfolio.pigmy?.accounts || 0}</span></div>
                                                            <div className="text-base md:text-lg font-black text-slate-800 mt-1">₹ {(data.portfolio.pigmy?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 font-medium">अखेरचा व्यवहार</div>
                                                            <div className="text-xs font-bold text-slate-600 mt-0.5">{data.portfolio.pigmy?.lastTxDate || '-'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-3 flex flex-col gap-1.5 text-xs text-primary font-semibold flex-1 justify-start">
                                                    <button onClick={() => onNavigate('pigmy-account', { memberId: selectedMemberId })} className={`text-left py-1.5 px-2.5 rounded-md hover:bg-emerald-50 font-bold flex items-center justify-between hover:text-emerald-700 cursor-pointer transition-colors ${!hasPigmy ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-800' : ''}`}>
                                                        <span>{!hasPigmy ? '+ नवीन पिग्मी खाते उघडा' : 'नवे पिग्मी खाते उघडा'}</span> <ChevronRight size={14} />
                                                    </button>

                                                    {hasPigmy && (
                                                        <>
                                                            <button onClick={() => onNavigate('pigmy-collect', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-emerald-700 cursor-pointer transition-colors">
                                                                <span>पिग्मी जमा वसुली</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('pigmy-scheme')} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-emerald-700 cursor-pointer transition-colors">
                                                                <span>ठेव योजना (Schemes)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('pigmy-closure', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-emerald-700 cursor-pointer transition-colors">
                                                                <span>पिग्मी खाते बंद</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setActiveReportModule(prev => prev === 'pigmy' ? null : 'pigmy')} 
                                                                className={`text-left py-1.5 px-2.5 rounded-md font-bold flex items-center justify-between cursor-pointer transition-all ${
                                                                    activeReportModule === 'pigmy'
                                                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                                                        : 'bg-emerald-50/80 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <span>📊</span> पिग्मी रिपोर्ट (Pigmy Reports)
                                                                </span> 
                                                                {activeReportModule === 'pigmy' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Loan Card */}
                                            <div className="bg-white border border-slate-200/90 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[450px] h-[450px] hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.16)] hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group">
                                                <div className="p-4 border-b border-slate-100 bg-slate-50/60 rounded-t-xl border-t-4 border-t-rose-500">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs md:text-sm font-extrabold text-slate-800">५. कर्ज विभाग (Loans)</span>
                                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadge(data.portfolio.loans.statusColor)}`}>
                                                            {hasLoans ? (data.portfolio.loans.statusColor === 'Red' ? 'थकीत' : 'सुरू') : 'शून्य'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3.5 flex justify-between items-end">
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-semibold">एकूण खाती: <span className="font-bold text-slate-700">{data.portfolio.loans.accounts}</span></div>
                                                            <div className="text-base md:text-lg font-black text-rose-600 mt-1">₹ {data.portfolio.loans.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 font-medium">अखेरचा व्यवहार</div>
                                                            <div className="text-xs font-bold text-slate-600 mt-0.5">{data.portfolio.loans.lastTxDate || '-'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-3 flex flex-col gap-1.5 text-xs text-primary font-semibold flex-1 justify-start">
                                                    <button onClick={() => onNavigate('loan-process', { subTab: 1, memberId: selectedMemberId })} className={`text-left py-1.5 px-2.5 rounded-md hover:bg-rose-50 font-bold flex items-center justify-between hover:text-rose-700 cursor-pointer transition-colors ${!hasLoans ? 'bg-rose-50/80 border border-rose-200 text-rose-800' : ''}`}>
                                                        <span>{!hasLoans ? '+ नवीन कर्ज मागणी नोंदणी' : 'कर्ज मागणी नोंदणी'}</span> <ChevronRight size={14} />
                                                    </button>

                                                    {hasLoans && (
                                                        <>
                                                            <button onClick={() => onNavigate('loan-process', { subTab: 2, memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-rose-700 cursor-pointer transition-colors">
                                                                <span>कर्ज मंजुरी व वितरण</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('loan-collection', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-rose-700 cursor-pointer transition-colors">
                                                                <span>कर्ज हप्ता वसुली</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('loan-ledger-report', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-rose-700 cursor-pointer transition-colors">
                                                                <span>कर्ज खाते स्टेटमेंट</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setActiveReportModule(prev => prev === 'loans' ? null : 'loans')} 
                                                                className={`text-left py-1.5 px-2.5 rounded-md font-bold flex items-center justify-between cursor-pointer transition-all ${
                                                                    activeReportModule === 'loans' 
                                                                        ? 'bg-rose-600 text-white shadow-xs' 
                                                                        : 'bg-rose-50/80 border border-rose-200 text-rose-800 hover:bg-rose-100 hover:text-rose-900'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <span>📊</span> कर्ज रिपोर्ट (Loan Reports)
                                                                </span> 
                                                                {activeReportModule === 'loans' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Share Capital Card */}
                                            <div className="bg-white border border-slate-200/90 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[450px] h-[450px] hover:shadow-[0_12px_28px_-4px_rgba(0,0,0,0.16)] hover:border-slate-300 hover:-translate-y-1 transition-all duration-300 group">
                                                <div className="p-4 border-b border-slate-100 bg-slate-50/60 rounded-t-xl border-t-4 border-t-purple-500">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs md:text-sm font-extrabold text-slate-800">६. भाग भांडवल (Shares)</span>
                                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getStatusBadge(data.portfolio.shares.statusColor)}`}>
                                                            {hasShares ? 'सुरू' : 'शून्य'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3.5 flex justify-between items-end">
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-semibold">फोलिओ: <span className="font-bold text-slate-700">{data.portfolio.shares.folioNo || '-'}</span></div>
                                                            <div className="text-base md:text-lg font-black text-slate-800 mt-1">₹ {data.portfolio.shares.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 font-medium">शेअर्स संख्या</div>
                                                            <div className="text-xs font-bold text-slate-600 mt-0.5 font-mono">{Math.floor(data.portfolio.shares.balance / 100)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-3 flex flex-col gap-1.5 text-xs text-primary font-semibold flex-1 justify-start">
                                                    <button onClick={() => onNavigate('share-master', { memberId: selectedMemberId })} className={`text-left py-1.5 px-2.5 rounded-md hover:bg-purple-50 font-bold flex items-center justify-between hover:text-purple-700 cursor-pointer transition-colors ${!hasShares ? 'bg-purple-50/80 border border-purple-200 text-purple-800' : ''}`}>
                                                        <span>{!hasShares ? '+ नवे भाग खरेदी / वाटप' : 'भाग खरेदी व वाटप (Allocation)'}</span> <ChevronRight size={14} />
                                                    </button>

                                                    {hasShares && (
                                                        <>
                                                            <button onClick={() => onNavigate('share-withdrawal', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-purple-700 cursor-pointer transition-colors">
                                                                <span>भाग हस्तांतरण व परतावा</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('shares-khatavani-report', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-purple-700 cursor-pointer transition-colors">
                                                                <span>भाग खाते खतावणी (Ledger)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('sabhasad-labhansh-report', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-purple-700 cursor-pointer transition-colors">
                                                                <span>लाभांश जमा (Dividend)</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button onClick={() => onNavigate('i-namuna-report', { memberId: selectedMemberId })} className="text-left py-1.5 px-2.5 rounded-md hover:bg-slate-100/80 flex items-center justify-between hover:text-purple-700 cursor-pointer transition-colors">
                                                                <span>आय नमुना शेअर रजिस्टर</span> <ChevronRight size={13} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setActiveReportModule(prev => prev === 'shares' ? null : 'shares')} 
                                                                className={`text-left py-1.5 px-2.5 rounded-md font-bold flex items-center justify-between cursor-pointer transition-all ${
                                                                    activeReportModule === 'shares'
                                                                        ? 'bg-purple-600 text-white shadow-xs' 
                                                                        : 'bg-purple-50/80 border border-purple-200 text-purple-800 hover:bg-purple-100 hover:text-purple-900'
                                                                }`}
                                                            >
                                                                <span className="flex items-center gap-1.5">
                                                                    <span>📊</span> शेअर्स रिपोर्ट (Shares Reports)
                                                                </span> 
                                                                {activeReportModule === 'shares' ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    );
                                })()}

                                {/* Module Reports Collapsible Section */}
                                {activeReportModule && moduleReportsConfig[activeReportModule] && (() => {
                                    const cfg = moduleReportsConfig[activeReportModule];
                                    return (
                                        <div className={`mt-4 bg-white border-2 ${cfg.borderColor} rounded-lg shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}>
                                            <div className={`${cfg.headerBg} border-b ${cfg.headerBorder} px-4 py-2.5 flex items-center justify-between`}>
                                                <div className="flex items-center gap-2">
                                                    <FolderClosed className={`w-4 h-4 ${cfg.iconColor}`} />
                                                    <h4 className={`text-xs md:text-sm font-bold ${cfg.headerText} tracking-tight`}>
                                                        {cfg.title}
                                                    </h4>
                                                    <span className="text-[10px] bg-white/80 font-bold px-2 py-0.5 rounded-full border border-gray-300 shadow-2xs">
                                                        {cfg.countLabel}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveReportModule(null)}
                                                    className={`${cfg.headerText} ${cfg.closeBtnHover} px-2 py-0.5 rounded text-xs font-bold transition-colors cursor-pointer`}
                                                    title="बंद करा"
                                                >
                                                    ✕ बंद करा
                                                </button>
                                            </div>
                                            <div className={`p-3.5 ${cfg.containerBg}`}>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                    {cfg.reports.map((rpt) => (
                                                        <button
                                                            key={rpt.id}
                                                            type="button"
                                                            onClick={() => handleReportNavigate(rpt.id)}
                                                            className={`bg-white border border-gray-200 ${cfg.hoverBorder} ${cfg.hoverBg} p-2.5 rounded-md shadow-2xs flex items-center gap-2.5 text-left text-xs font-semibold text-gray-800 ${cfg.hoverText} transition-all cursor-pointer group active:scale-[0.99]`}
                                                        >
                                                            <FileText className={`w-4 h-4 text-gray-400 group-hover:${cfg.iconColor} transition-colors shrink-0`} />
                                                            <span className="flex-1">{rpt.name}</span>
                                                            <ChevronRight className={`w-3.5 h-3.5 text-gray-300 group-hover:${cfg.iconColor} group-hover:translate-x-0.5 transition-all shrink-0`} />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

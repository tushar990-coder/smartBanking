import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Search, 
    ShieldAlert, 
    Award, 
    ChevronRight, 
    ChevronDown, 
    AlertTriangle, 
    FileText, 
    FolderClosed,
    CreditCard,
    RefreshCw,
    History,
    ArrowUpRight,
    ArrowDownLeft
} from 'lucide-react';
import MemberSearchSelect from './common/MemberSearchSelect';

interface Member360DashboardProps {
    onNavigate: (tab: string, params?: any) => void;
}

interface MemberInfoDto {
    memberID: number;
    memberCode: string;
    membershipType?: string;
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
    const [selectedMemberId, setSelectedMemberId] = useState<string>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('memberId') || sessionStorage.getItem('last_member360_selected_id') || '';
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [data, setData] = useState<Member360Data | null>(null);
    const [error, setError] = useState<string>('');
    const [showTransactions, setShowTransactions] = useState<boolean>(false);
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
            title: 'बचत ठेव (SAVING) अहवाल',
            countLabel: '४ अहवाल उपलब्ध',
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
            title: 'मुदत ठेव (FD) अहवाल',
            countLabel: '९ अहवाल उपलब्ध',
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
                { id: 'fd-reports&reportType=MemberLedger', name: '४. मुदत ठेव खातावणी अहवाल (FD Account Ledger)' },
                { id: 'fd-reports&reportType=AccrualProvision', name: '५. मुदत ठेव व्याज तरतूद (FD Interest Provision)' },
                { id: 'fd-reports&reportType=VoucherPassing', name: '६. मुदत ठेव व्हाउचर पासिंग अहवाल (Voucher Passing)' },
                { id: 'fd-reports&reportType=DeletedEntries', name: '७. थेट रद्द नोंदी व रोलबॅक अहवाल (Deleted & Rollback)' },
                { id: 'fd-reports&reportType=MigratedFD', name: '८. स्थलांतरित मुदत ठेव यादी अहवाल (Migrated FD Report)' },
                { id: 'fd-reports&reportType=CustomerSummary', name: '९. मुदतबंद ठेव यादी (ग्राहक-निहाय एकत्रित ठेवी)' }
            ]
        },
        rd: {
            title: 'आवर्ती ठेव (RD) अहवाल',
            countLabel: '६ अहवाल उपलब्ध',
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
                { id: 'rd-reports&reportType=closed', name: '५. खाते बंद अहवाल (Closure Report)' },
                { id: 'rd-accrual', name: '६. आरडी व्याज तरतूद अहवाल (Accrual Posting)' },
            ]
        },
        pigmy: {
            title: 'पिग्मी ठेव (PIGMY) अहवाल',
            countLabel: '५ अहवाल उपलब्ध',
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
            title: 'कर्ज विभाग (LOAN) अहवाल',
            countLabel: '९ अहवाल उपलब्ध',
            borderColor: 'border-rose-600',
            headerBg: 'bg-rose-50/90',
            headerBorder: 'border-rose-200',
            headerText: 'text-rose-900',
            iconColor: 'text-rose-600',
            hoverBorder: 'hover:border-rose-500',
            hoverBg: 'hover:bg-rose-50/50',
            hoverText: 'hover:text-rose-900',
            containerBg: 'bg-rose-50/20',
            closeBtnHover: 'hover:bg-rose-100',
            reports: [
                { id: 'loan-disbursement-register', name: '१. कर्ज वाटप रजिस्टर (Disbursement Register)' },
                { id: 'loan-collection-register', name: '२. कर्ज वसुली रजिस्टर (Collection Register)' },
                { id: 'loan-ledger-report', name: '३. कर्ज खतावणी अहवाल (Loan Ledger)' },
                { id: 'loan-overdue-report', name: '४. थकीत कर्ज यादी (Overdue Loan List)' },
                { id: 'loan-recovery-notice-report', name: '५. लवादपूर्व कर्ज नोटीस (Notice Report)' },
                { id: 'guarantor-loan-report', name: '६. सभासद जामीनदार अहवाल (Guarantor Loan Report)' },
                { id: 'npa-register', name: '७. NPA तरतूद माहिती (NPA Register)' },
                { id: 'interest-waiver-register', name: '८. कर्ज व्याज सूट व तडजोड (OTS & Waiver)' },
                { id: 'loan-rate', name: '९. कर्ज दर पत्रक (Loan Rate Master)' },
            ]
        },
        shares: {
            title: 'भाग भांडवल (SHARES) अहवाल',
            countLabel: '६ अहवाल उपलब्ध',
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
                { id: 'i-namuna-report', name: '२. नमूना आय रजिस्टर (I-Namuna Register)' },
                { id: 'sabhasad-labhansh-report', name: '३. सभासद लाभांश यादी (Dividend List)' },
                { id: 'member-balance-report', name: '४. सभासद शेअर्स यादी (Member Shares List)' },
                { id: 'member-list-report', name: '५. सभासद यादी (Member Master List)' },
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
                
                if (res.data && res.data.length > 0) {
                    const params = new URLSearchParams(window.location.search);
                    const urlMemberId = params.get('memberId');
                    const savedMemberId = sessionStorage.getItem('last_member360_selected_id');
                    const targetId = urlMemberId || savedMemberId || selectedMemberId;

                    if (targetId && res.data.some((m: any) => String(m.customerID || m.memberID) === targetId)) {
                        setSelectedMemberId(targetId);
                    } else {
                        setSelectedMemberId(String(res.data[0].customerID || res.data[0].memberID));
                    }
                }
            } catch (err) {
                if (isMounted) {
                    console.error("Failed to load customer list", err);
                    setError("खातेदारांची यादी लोड करता आली नाही.");
                }
            }
        };
        fetchMembers();
        return () => { isMounted = false; };
    }, []);

    // Fetch 360 view when member selection changes
    const fetch360Data = async () => {
        if (!selectedMemberId) return;
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`/api/Reports/Customer360/${selectedMemberId}`);
            setData(res.data);
        } catch (err) {
            console.error("Failed to load 360 summary", err);
            setError("सभासद ३६०° सारांश लोड करता आला नाही.");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetch360Data();
    }, [selectedMemberId]);

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        try {
            const cleanStr = String(dateStr).trim();
            if (!cleanStr || cleanStr === '-' || cleanStr.startsWith('0001') || cleanStr.startsWith('1900')) return '-';
            
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanStr)) return cleanStr;
            
            if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
                const [year, month, day] = cleanStr.substring(0, 10).split('-');
                return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
            }

            const d = new Date(cleanStr);
            if (isNaN(d.getTime()) || d.getFullYear() <= 1900) return '-';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        } catch {
            return '-';
        }
    };

    const getStatusBadge = (color: string) => {
        switch ((color || '').toLowerCase()) {
            case 'green':
                return 'bg-emerald-500/15 text-emerald-700 border-emerald-300';
            case 'yellow':
                return 'bg-amber-500/15 text-amber-700 border-amber-300';
            case 'red':
                return 'bg-rose-500/15 text-rose-700 border-rose-300';
            default:
                return 'bg-slate-500/10 text-slate-600 border-slate-200';
        }
    };

    return (
        <div className="p-3.5 max-w-full h-full flex flex-col bg-gradient-to-br from-slate-100/90 via-slate-50/80 to-slate-200/60 text-xs font-sans relative overflow-y-auto">
            {/* Ambient Background Light Orbs */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/3 -right-24 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 left-1/3 w-80 h-80 bg-purple-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-3">
                
                {/* 1. Glassmorphic Top Navigation & Member Search Bar */}
                <div className="backdrop-blur-xl bg-white/85 border border-white/90 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
                            <Award className="w-4.5 h-4.5 text-emerald-100" />
                        </div>
                        <div>
                            <h2 className="text-sm md:text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                <span>सभासद ३६०° डॅशबोर्ड</span>
                                <span className="text-xs font-semibold text-slate-400 hidden sm:inline">(Member 360° Comprehensive View)</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 hidden sm:block">सर्वसमावेशक खातेदार माहिती, पोर्टफोलिओ शिल्लक व जलद व्यवहार</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <div className="w-full sm:w-84 md:w-96 flex items-center gap-2 bg-slate-50/90 border border-slate-200/90 rounded-lg px-2.5 py-1 shadow-2xs">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex-1 text-slate-800 text-xs">
                                <MemberSearchSelect
                                    members={rawMembers}
                                    value={selectedMemberId ? Number(selectedMemberId) : ''}
                                    onChange={(val) => setSelectedMemberId(val ? String(val) : '')}
                                    placeholder="-- नाव, CIF किंवा जुना नं शोधा --"
                                    valueType="customerId"
                                />
                            </div>
                        </div>

                        <button
                            onClick={fetch360Data}
                            disabled={loading || !selectedMemberId}
                            title="रिफ्रेश करा (Refresh)"
                            className="p-2 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-600 hover:text-emerald-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* 2. Loading State */}
                {loading && (
                    <div className="backdrop-blur-xl bg-white/70 border border-white/80 rounded-xl p-10 shadow-xs flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-slate-600 font-semibold mt-3">सभासद ३६०° तपशील लोड होत आहे...</span>
                    </div>
                )}

                {/* 3. Error Alert */}
                {error && (
                    <div className="backdrop-blur-xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl shadow-xs flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                            <span className="font-semibold">{error}</span>
                        </div>
                        <button
                            onClick={fetch360Data}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded cursor-pointer transition-colors shadow-2xs"
                        >
                            पुनः प्रयत्न करा (Retry)
                        </button>
                    </div>
                )}

                {/* 4. Empty State */}
                {!loading && !data && !error && (
                    <div className="backdrop-blur-xl bg-white/60 border border-dashed border-slate-300 rounded-xl p-14 text-center flex flex-col items-center justify-center">
                        <Search size={36} className="stroke-[1.5] mb-2.5 text-slate-400" />
                        <span className="text-xs md:text-sm font-bold text-slate-600">कृपया प्रोफाइल पाहण्यासाठी वरील शोध बारमधून सभासद निवडा.</span>
                    </div>
                )}

                {/* 5. Main 360 Degree View Content */}
                {!loading && data && (
                    <div className="flex flex-col gap-3">
                        
                        {/* Member Profile Hero Glass Banner */}
                        <div className="backdrop-blur-xl bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-emerald-950/95 text-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-4 border border-white/15 relative overflow-hidden flex flex-wrap lg:flex-nowrap gap-3.5 items-center">
                            {/* Ambient specular highlight */}
                            <div className="absolute top-0 right-0 w-80 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

                            {/* Avatar / Photo */}
                            <div className="w-15 h-15 rounded-full bg-gradient-to-tr from-emerald-500/30 to-teal-500/20 border-2 border-emerald-400/50 p-0.5 shadow-md flex items-center justify-center text-white font-black text-base shrink-0">
                                {data.memberInfo.photoPath ? (
                                    <img src={data.memberInfo.photoPath} alt="Photo" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-emerald-600/40 flex items-center justify-center text-emerald-200">
                                        {`${(data.memberInfo?.firstName || 'M')[0]}${(data.memberInfo?.lastName || 'M')[0]}`}
                                    </div>
                                )}
                            </div>

                            {/* Member Details */}
                            <div className="flex-1 min-w-[280px]">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm md:text-base font-extrabold tracking-tight text-white">
                                        {data.memberInfo.firstName} {data.memberInfo.middleName || ''} {data.memberInfo.lastName}
                                    </h3>
                                    {data.memberInfo.nickName && (
                                        <span className="text-amber-300 text-xs font-semibold">({data.memberInfo.nickName})</span>
                                    )}

                                    {data.memberInfo.memberCode ? (
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded font-mono font-bold tracking-wider">
                                            सभासद: {data.memberInfo.memberCode}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] bg-amber-400/20 text-amber-200 border border-amber-400/30 px-2.5 py-0.5 rounded font-semibold">
                                            नाममात्र खातेदार
                                        </span>
                                    )}

                                    {data.memberInfo.cifNo && (
                                        <span className="text-[10px] bg-sky-500/20 text-sky-200 border border-sky-400/30 px-2.5 py-0.5 rounded font-mono font-bold">
                                            CIF: {data.memberInfo.cifNo}
                                        </span>
                                    )}

                                    {data.memberInfo.oldMemberCode && (
                                        <span className="text-[10px] bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2.5 py-0.5 rounded font-mono font-bold">
                                            जुना नं: {data.memberInfo.oldMemberCode}
                                        </span>
                                    )}

                                    <span className={`text-[10px] px-2.5 py-0.5 rounded font-bold border ${data.memberInfo.status === 'Active' ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40' : 'bg-rose-500/25 text-rose-300 border-rose-400/40'}`}>
                                        {data.memberInfo.status === 'Active' ? 'सक्रीय (Active)' : 'निष्क्रिय (Inactive)'}
                                    </span>
                                </div>

                                {/* Demographics Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1.5 mt-2.5 text-[11px] text-slate-200/90 font-medium">
                                    <div><span className="text-white/50 block text-[10px] uppercase tracking-wider">CIF नं:</span> {data.memberInfo.cifNo || '-'}</div>
                                    <div><span className="text-white/50 block text-[10px] uppercase tracking-wider">जुना नं:</span> {data.memberInfo.oldMemberCode || '-'}</div>
                                    <div><span className="text-white/50 block text-[10px] uppercase tracking-wider">मोबाईल:</span> {data.memberInfo.mobileNo || '-'}</div>
                                    <div><span className="text-white/50 block text-[10px] uppercase tracking-wider">आधार क्रमांक:</span> {data.memberInfo.aadhaarNo || '-'}</div>
                                    <div><span className="text-white/50 block text-[10px] uppercase tracking-wider">शाखा:</span> {data.memberInfo.branchName || '-'}</div>
                                    <div><span className="text-white/50 block text-[10px] uppercase tracking-wider">दाखल तारीख:</span> {formatDate(data.memberInfo.joiningDate)}</div>
                                </div>
                            </div>

                            {/* 4 Financial Stat Glass Orbs / Panels */}
                            <div className="flex gap-2.5 border-t lg:border-t-0 lg:border-l border-white/15 pt-3 lg:pt-0 lg:pl-3.5 w-full lg:w-auto justify-between lg:justify-end shrink-0 flex-wrap sm:flex-nowrap">
                                <div className="backdrop-blur-md bg-white/10 px-3 py-2 rounded-lg border border-white/15 text-right flex-1 sm:flex-none">
                                    <div className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider">एकूण ठेव (Deposits)</div>
                                    <div className="text-sm font-black text-emerald-300 mt-0.5">₹ {(data.balances?.totalDeposits || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>

                                <div className="backdrop-blur-md bg-white/10 px-3 py-2 rounded-lg border border-white/15 text-right flex-1 sm:flex-none">
                                    <div className="text-[10px] font-bold text-purple-200 uppercase tracking-wider">भाग भांडवल (Shares)</div>
                                    <div className="text-sm font-black text-purple-300 mt-0.5">₹ {(data.balances?.shareCapital || data.portfolio?.shares?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>

                                <div className="backdrop-blur-md bg-white/10 px-3 py-2 rounded-lg border border-white/15 text-right flex-1 sm:flex-none">
                                    <div className="text-[10px] font-bold text-rose-200 uppercase tracking-wider">कर्ज बाकी (Loans)</div>
                                    <div className="text-sm font-black text-rose-300 mt-0.5">₹ {(data.balances?.totalLoansOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>

                                <div className="backdrop-blur-md bg-emerald-950/70 px-3 py-2 rounded-lg border border-emerald-400/40 text-right flex-1 sm:flex-none shadow-xs">
                                    <div className="text-[10px] font-bold text-amber-200 uppercase tracking-wider">निव्वळ शिल्लक (Net)</div>
                                    <div className="text-sm font-black text-amber-300 mt-0.5">
                                        ₹ {((data.balances?.totalDeposits || 0) + (data.balances?.shareCapital || data.portfolio?.shares?.balance || 0) - (data.balances?.totalLoansOutstanding || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section Header: Product Accounts */}
                        <div className="flex items-center justify-between mt-1 px-1">
                            <h4 className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
                                <CreditCard size={14} className="text-slate-500" />
                                <span>पोर्टफोलिओ प्रॉडक्ट्स (Product Accounts)</span>
                            </h4>

                            {data.recentTransactions && data.recentTransactions.length > 0 && (
                                <button
                                    onClick={() => setShowTransactions(!showTransactions)}
                                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                >
                                    <History size={13} />
                                    <span>अलिकडील व्यवहार ({data.recentTransactions.length})</span>
                                    {showTransactions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                            )}
                        </div>

                        {/* 6 Portfolio Product Cards */}
                        {(() => {
                            const hasSavings = (data.portfolio.savings?.accounts || 0) > 0 || (data.portfolio.savings?.balance || 0) > 0 || Boolean(data.portfolio.savings?.lastTxDate);
                            const hasFD = (data.portfolio.fixedDeposits?.accounts || 0) > 0 || (data.portfolio.fixedDeposits?.balance || 0) > 0 || Boolean(data.portfolio.fixedDeposits?.lastTxDate);
                            const hasRD = (data.portfolio.recurringDeposits?.accounts || 0) > 0 || (data.portfolio.recurringDeposits?.balance || 0) > 0 || Boolean(data.portfolio.recurringDeposits?.lastTxDate);
                            const hasPigmy = (data.portfolio.pigmy?.accounts || 0) > 0 || (data.portfolio.pigmy?.balance || 0) > 0 || Boolean(data.portfolio.pigmy?.lastTxDate);
                            const hasLoans = (data.portfolio.loans?.accounts || 0) > 0 || (data.portfolio.loans?.balance || 0) > 0 || Boolean(data.portfolio.loans?.lastTxDate);
                            const hasShares = (data.portfolio.shares?.accounts || 0) > 0 || (data.portfolio.shares?.balance || 0) > 0 || Boolean(data.portfolio.shares?.folioNo);

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
                                    
                                    {/* 1. SAVINGS DEPOSIT CARD */}
                                    <div className="backdrop-blur-md bg-white/85 hover:bg-white/95 border border-slate-200/90 hover:border-blue-300 rounded-xl shadow-[0_2px_14px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col justify-between transition-all duration-200 overflow-hidden group">
                                        <div className="p-2.5 border-b border-slate-100 bg-gradient-to-b from-blue-50/70 to-white/60 border-t-3 border-t-blue-500">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-extrabold text-slate-800 truncate" title="१. बचत ठेव (Savings)">१. बचत ठेव (Savings)</span>
                                                <span className={`text-[9.5px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${getStatusBadge(data.portfolio.savings.statusColor)}`}>
                                                    {hasSavings ? 'सुरू' : 'शून्य'}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-semibold leading-none">खाती: <span className="font-bold text-slate-700">{data.portfolio.savings.accounts}</span></div>
                                                    <div className="text-sm font-black text-slate-900 leading-none mt-1">₹ {data.portfolio.savings.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-slate-400 font-medium leading-none">अखेरचा व्यवहार</div>
                                                    <div className="text-[10px] font-bold text-slate-600 leading-none mt-1">{formatDate(data.portfolio.savings.lastTxDate)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2 flex flex-col justify-between flex-1 bg-slate-50/20">
                                            <div className="flex flex-col gap-1.5">
                                                <button 
                                                    onClick={() => onNavigate('saving-account', { memberId: selectedMemberId })} 
                                                    className="w-full text-left py-1.5 px-2 rounded-md font-bold text-[11px] flex items-center justify-between transition-all duration-150 shadow-2xs border cursor-pointer bg-blue-50/90 hover:bg-blue-100 text-blue-900 border-blue-200 hover:border-blue-300 group/btn"
                                                >
                                                    <span className="truncate">{!hasSavings ? '+ नवीन बचत खाते' : 'नवे बचत खाते उघडा'}</span> 
                                                    <ChevronRight size={13} className="text-blue-600 group-hover/btn:translate-x-0.5 transition-transform shrink-0" />
                                                </button>

                                                {hasSavings && (
                                                    <>
                                                        <button onClick={() => onNavigate('saving-transaction', { memberId: selectedMemberId, type: 'Deposit' })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-blue-900">बचत जमा नोंदणी</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-blue-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('saving-transaction', { memberId: selectedMemberId, type: 'Withdrawal' })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-blue-900">बचत उचल नोंदणी</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-blue-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('saving-posting')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-blue-900">व्याज जमा पोस्टिंग</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-blue-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('saving-passbook', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-blue-900">पासबुक प्रिंट करा</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-blue-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('saving-closing', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-blue-50/60 border border-slate-200/90 hover:border-blue-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-blue-900">खाते बंद प्रक्रिया</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-blue-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {hasSavings && (
                                                <div className="pt-2 mt-auto">
                                                    <button 
                                                        onClick={() => setActiveReportModule(prev => prev === 'savings' ? null : 'savings')} 
                                                        className={`w-full text-left py-1.5 px-2 rounded-md font-bold text-[10.5px] flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                                                            activeReportModule === 'savings'
                                                                ? 'bg-blue-600 text-white' 
                                                                : 'bg-blue-50/90 border border-blue-200 text-blue-900 hover:bg-blue-100'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-1.5 truncate">
                                                            <span>📊</span> बचत अहवाल
                                                        </span> 
                                                        {activeReportModule === 'savings' ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. FIXED DEPOSIT CARD */}
                                    <div className="backdrop-blur-md bg-white/85 hover:bg-white/95 border border-slate-200/90 hover:border-teal-300 rounded-xl shadow-[0_2px_14px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col justify-between transition-all duration-200 overflow-hidden group">
                                        <div className="p-2.5 border-b border-slate-100 bg-gradient-to-b from-teal-50/70 to-white/60 border-t-3 border-t-teal-500">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-extrabold text-slate-800 truncate" title="२. मुदत ठेव (FD)">२. मुदत ठेव (FD)</span>
                                                <span className={`text-[9.5px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${getStatusBadge(data.portfolio.fixedDeposits.statusColor)}`}>
                                                    {hasFD ? 'सुरू' : 'शून्य'}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-semibold leading-none">खाती: <span className="font-bold text-slate-700">{data.portfolio.fixedDeposits.accounts}</span></div>
                                                    <div className="text-sm font-black text-slate-900 leading-none mt-1">₹ {data.portfolio.fixedDeposits.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-slate-400 font-medium leading-none">अखेरचा व्यवहार</div>
                                                    <div className="text-[10px] font-bold text-slate-600 leading-none mt-1">{formatDate(data.portfolio.fixedDeposits.lastTxDate)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2 flex flex-col justify-between flex-1 bg-slate-50/20">
                                            <div className="flex flex-col gap-1.5">
                                                <button 
                                                    onClick={() => onNavigate('fd-account', { memberId: selectedMemberId })} 
                                                    className="w-full text-left py-1.5 px-2 rounded-md font-bold text-[11px] flex items-center justify-between transition-all duration-150 shadow-2xs border cursor-pointer bg-teal-50/90 hover:bg-teal-100 text-teal-900 border-teal-200 hover:border-teal-300 group/btn"
                                                >
                                                    <span className="truncate">{!hasFD ? '+ नवीन FD उघडा' : 'नवे FD उघडा'}</span> 
                                                    <ChevronRight size={13} className="text-teal-600 group-hover/btn:translate-x-0.5 transition-transform shrink-0" />
                                                </button>

                                                {hasFD && (
                                                    <>
                                                        <button onClick={() => onNavigate('fd-scheme')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-teal-50/60 border border-slate-200/90 hover:border-teal-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-teal-900">ठेव योजना (Schemes)</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-teal-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('fd-migrate', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-teal-50/60 border border-slate-200/90 hover:border-teal-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-teal-900">ठेव स्थलांतर (Migration)</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-teal-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('fd-accrual')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-teal-50/60 border border-slate-200/90 hover:border-teal-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-teal-900">व्याज तरतूद (Accrual)</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-teal-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('fd-withdrawal', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-teal-50/60 border border-slate-200/90 hover:border-teal-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-teal-900">मुदतपूर्ती प्रक्रिया</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-teal-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => handleReportNavigate('fd-reports&reportType=MemberLedger')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-teal-50/60 border border-slate-200/90 hover:border-teal-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-teal-900">मुदत ठेव खतावणी</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-teal-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {hasFD && (
                                                <div className="pt-2 mt-auto">
                                                    <button 
                                                        onClick={() => setActiveReportModule(prev => prev === 'fd' ? null : 'fd')} 
                                                        className={`w-full text-left py-1.5 px-2 rounded-md font-bold text-[10.5px] flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                                                            activeReportModule === 'fd'
                                                                ? 'bg-teal-600 text-white' 
                                                                : 'bg-teal-50/90 border border-teal-200 text-teal-900 hover:bg-teal-100'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-1.5 truncate">
                                                            <span>📊</span> मुदत ठेव अहवाल
                                                        </span> 
                                                        {activeReportModule === 'fd' ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. RECURRING DEPOSIT CARD */}
                                    <div className="backdrop-blur-md bg-white/85 hover:bg-white/95 border border-slate-200/90 hover:border-amber-300 rounded-xl shadow-[0_2px_14px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col justify-between transition-all duration-200 overflow-hidden group">
                                        <div className="p-2.5 border-b border-slate-100 bg-gradient-to-b from-amber-50/70 to-white/60 border-t-3 border-t-amber-500">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-extrabold text-slate-800 truncate" title="३. आवर्ती ठेव (RD)">३. आवर्ती ठेव (RD)</span>
                                                <span className={`text-[9.5px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${getStatusBadge(data.portfolio.recurringDeposits.statusColor)}`}>
                                                    {hasRD ? 'सुरू' : 'शून्य'}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-semibold leading-none">खाती: <span className="font-bold text-slate-700">{data.portfolio.recurringDeposits.accounts}</span></div>
                                                    <div className="text-sm font-black text-slate-900 leading-none mt-1">₹ {data.portfolio.recurringDeposits.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-slate-400 font-medium leading-none">अखेरचा व्यवहार</div>
                                                    <div className="text-[10px] font-bold text-slate-600 leading-none mt-1">{formatDate(data.portfolio.recurringDeposits.lastTxDate)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2 flex flex-col justify-between flex-1 bg-slate-50/20">
                                            <div className="flex flex-col gap-1.5">
                                                <button 
                                                    onClick={() => onNavigate('rd-account', { memberId: selectedMemberId })} 
                                                    className="w-full text-left py-1.5 px-2 rounded-md font-bold text-[11px] flex items-center justify-between transition-all duration-150 shadow-2xs border cursor-pointer bg-amber-50/90 hover:bg-amber-100 text-amber-900 border-amber-200 hover:border-amber-300 group/btn"
                                                >
                                                    <span className="truncate">{!hasRD ? '+ नवीन RD उघडा' : 'नवे RD उघडा'}</span> 
                                                    <ChevronRight size={13} className="text-amber-600 group-hover/btn:translate-x-0.5 transition-transform shrink-0" />
                                                </button>

                                                {hasRD && (
                                                    <>
                                                        <button onClick={() => onNavigate('rd-collect', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-amber-50/60 border border-slate-200/90 hover:border-amber-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-amber-900">मासिक हप्ता वसुली</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-amber-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('rd-scheme')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-amber-50/60 border border-slate-200/90 hover:border-amber-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-amber-900">ठेव योजना (Schemes)</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-amber-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('rd-migrate', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-amber-50/60 border border-slate-200/90 hover:border-amber-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-amber-900">ठेव स्थलांतर (Migration)</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-amber-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('rd-withdrawal', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-amber-50/60 border border-slate-200/90 hover:border-amber-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-amber-900">मुदतपूर्ती प्रक्रिया</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-amber-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => handleReportNavigate('rd-reports&reportType=defaulters')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-amber-50/60 border border-slate-200/90 hover:border-amber-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-amber-900">थकीत खातेदार यादी</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-amber-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {hasRD && (
                                                <div className="pt-2 mt-auto">
                                                    <button 
                                                        onClick={() => setActiveReportModule(prev => prev === 'rd' ? null : 'rd')} 
                                                        className={`w-full text-left py-1.5 px-2 rounded-md font-bold text-[10.5px] flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                                                            activeReportModule === 'rd'
                                                                ? 'bg-amber-600 text-white' 
                                                                : 'bg-amber-50/90 border border-amber-200 text-amber-900 hover:bg-amber-100'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-1.5 truncate">
                                                            <span>📊</span> आरडी अहवाल
                                                        </span> 
                                                        {activeReportModule === 'rd' ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. PIGMY DEPOSIT CARD */}
                                    <div className="backdrop-blur-md bg-white/85 hover:bg-white/95 border border-slate-200/90 hover:border-emerald-300 rounded-xl shadow-[0_2px_14px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col justify-between transition-all duration-200 overflow-hidden group">
                                        <div className="p-2.5 border-b border-slate-100 bg-gradient-to-b from-emerald-50/70 to-white/60 border-t-3 border-t-emerald-500">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-extrabold text-slate-800 truncate" title="४. पिग्मी ठेव (Pigmy)">४. पिग्मी ठेव (Pigmy)</span>
                                                <span className={`text-[9.5px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${getStatusBadge(data.portfolio.pigmy?.statusColor || 'Gray')}`}>
                                                    {hasPigmy ? 'सुरू' : 'शून्य'}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-semibold leading-none">खाती: <span className="font-bold text-slate-700">{data.portfolio.pigmy?.accounts || 0}</span></div>
                                                    <div className="text-sm font-black text-slate-900 leading-none mt-1">₹ {(data.portfolio.pigmy?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-slate-400 font-medium leading-none">अखेरचा व्यवहार</div>
                                                    <div className="text-[10px] font-bold text-slate-600 leading-none mt-1">{formatDate(data.portfolio.pigmy?.lastTxDate)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2 flex flex-col justify-between flex-1 bg-slate-50/20">
                                            <div className="flex flex-col gap-1.5">
                                                <button 
                                                    onClick={() => onNavigate('pigmy-account', { memberId: selectedMemberId })} 
                                                    className="w-full text-left py-1.5 px-2 rounded-md font-bold text-[11px] flex items-center justify-between transition-all duration-150 shadow-2xs border cursor-pointer bg-emerald-50/90 hover:bg-emerald-100 text-emerald-900 border-emerald-200 hover:border-emerald-300 group/btn"
                                                >
                                                    <span className="truncate">{!hasPigmy ? '+ नवीन पिग्मी खाते' : 'नवे पिग्मी खाते उघडा'}</span> 
                                                    <ChevronRight size={13} className="text-emerald-600 group-hover/btn:translate-x-0.5 transition-transform shrink-0" />
                                                </button>

                                                {hasPigmy && (
                                                    <>
                                                        <button onClick={() => onNavigate('pigmy-collect', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-emerald-50/60 border border-slate-200/90 hover:border-emerald-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-emerald-900">पिग्मी जमा वसुली</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-emerald-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('pigmy-scheme')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-emerald-50/60 border border-slate-200/90 hover:border-emerald-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-emerald-900">ठेव योजना (Schemes)</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-emerald-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('pigmy-closure', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-emerald-50/60 border border-slate-200/90 hover:border-emerald-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-emerald-900">पिग्मी खाते बंद</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-emerald-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => handleReportNavigate('pigmy-reports&reportType=settlement')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-emerald-50/60 border border-slate-200/90 hover:border-emerald-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-emerald-900">एजंट रोख ताळमेळ</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-emerald-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => handleReportNavigate('pigmy-reports&reportType=ledger')} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-emerald-50/60 border border-slate-200/90 hover:border-emerald-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-emerald-900">पिग्मी खाते लेजर</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-emerald-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {hasPigmy && (
                                                <div className="pt-2 mt-auto">
                                                    <button 
                                                        onClick={() => setActiveReportModule(prev => prev === 'pigmy' ? null : 'pigmy')} 
                                                        className={`w-full text-left py-1.5 px-2 rounded-md font-bold text-[10.5px] flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                                                            activeReportModule === 'pigmy'
                                                                ? 'bg-emerald-600 text-white' 
                                                                : 'bg-emerald-50/90 border border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-1.5 truncate">
                                                            <span>📊</span> पिग्मी अहवाल
                                                        </span> 
                                                        {activeReportModule === 'pigmy' ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 5. LOAN DEPARTMENT CARD */}
                                    <div className="backdrop-blur-md bg-white/85 hover:bg-white/95 border border-slate-200/90 hover:border-rose-300 rounded-xl shadow-[0_2px_14px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col justify-between transition-all duration-200 overflow-hidden group">
                                        <div className="p-2.5 border-b border-slate-100 bg-gradient-to-b from-rose-50/70 to-white/60 border-t-3 border-t-rose-500">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-extrabold text-slate-800 truncate" title="५. कर्ज विभाग (Loans)">५. कर्ज विभाग (Loans)</span>
                                                <span className={`text-[9.5px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${getStatusBadge(data.portfolio.loans.statusColor)}`}>
                                                    {hasLoans ? (data.portfolio.loans.statusColor === 'Red' ? 'थकीत' : 'सुरू') : 'शून्य'}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-semibold leading-none">खाती: <span className="font-bold text-slate-700">{data.portfolio.loans.accounts}</span></div>
                                                    <div className="text-sm font-black text-rose-600 leading-none mt-1">₹ {data.portfolio.loans.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-slate-400 font-medium leading-none">अखेरचा व्यवहार</div>
                                                    <div className="text-[10px] font-bold text-slate-600 leading-none mt-1">{formatDate(data.portfolio.loans.lastTxDate)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2 flex flex-col justify-between flex-1 bg-slate-50/20">
                                            <div className="flex flex-col gap-1.5">
                                                <button 
                                                    onClick={() => onNavigate('loan-process', { subTab: 1, memberId: selectedMemberId })} 
                                                    className="w-full text-left py-1.5 px-2 rounded-md font-bold text-[11px] flex items-center justify-between transition-all duration-150 shadow-2xs border cursor-pointer bg-rose-50/90 hover:bg-rose-100 text-rose-900 border-rose-200 hover:border-rose-300 group/btn"
                                                >
                                                    <span className="truncate">{!hasLoans ? '+ नवीन कर्ज मागणी' : 'कर्ज मागणी नोंदणी'}</span> 
                                                    <ChevronRight size={13} className="text-rose-600 group-hover/btn:translate-x-0.5 transition-transform shrink-0" />
                                                </button>

                                                {hasLoans && (
                                                    <>
                                                        <button onClick={() => onNavigate('loan-process', { subTab: 2, memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-rose-50/60 border border-slate-200/90 hover:border-rose-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-rose-900">कर्ज मंजुरी व वितरण</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-rose-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('loan-collection', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-rose-50/60 border border-slate-200/90 hover:border-rose-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-rose-900">कर्ज हप्ता वसुली</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-rose-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('loan-ledger-report', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-rose-50/60 border border-slate-200/90 hover:border-rose-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-rose-900">कर्ज खाते स्टेटमेंट</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-rose-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('loan-overdue-recovery', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-rose-50/60 border border-slate-200/90 hover:border-rose-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-rose-900">थकीत वसुली नोंदणी</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-rose-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('loan-process', { subTab: 4, memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-rose-50/60 border border-slate-200/90 hover:border-rose-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-rose-900">कर्ज हप्ता तक्ता</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-rose-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {hasLoans && (
                                                <div className="pt-2 mt-auto">
                                                    <button 
                                                        onClick={() => setActiveReportModule(prev => prev === 'loans' ? null : 'loans')} 
                                                        className={`w-full text-left py-1.5 px-2 rounded-md font-bold text-[10.5px] flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                                                            activeReportModule === 'loans' 
                                                                ? 'bg-rose-600 text-white' 
                                                                : 'bg-rose-50/90 border border-rose-200 text-rose-800 hover:bg-rose-100'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-1.5 truncate">
                                                            <span>📊</span> कर्ज अहवाल
                                                        </span> 
                                                        {activeReportModule === 'loans' ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 6. SHARE CAPITAL CARD */}
                                    <div className="backdrop-blur-md bg-white/85 hover:bg-white/95 border border-slate-200/90 hover:border-purple-300 rounded-xl shadow-[0_2px_14px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] flex flex-col justify-between transition-all duration-200 overflow-hidden group">
                                        <div className="p-2.5 border-b border-slate-100 bg-gradient-to-b from-purple-50/70 to-white/60 border-t-3 border-t-purple-500">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-extrabold text-slate-800 truncate" title="६. भाग भांडवल (Shares)">६. भाग भांडवल (Shares)</span>
                                                <span className={`text-[9.5px] px-2 py-0.5 rounded-full border font-bold shrink-0 ${getStatusBadge(data.portfolio.shares.statusColor)}`}>
                                                    {hasShares ? 'सुरू' : 'शून्य'}
                                                </span>
                                            </div>
                                            <div className="mt-1.5 flex justify-between items-end">
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-semibold leading-none">फोलिओ: <span className="font-bold text-slate-700">{data.portfolio.shares.folioNo || '-'}</span></div>
                                                    <div className="text-sm font-black text-slate-900 leading-none mt-1">₹ {data.portfolio.shares.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[9px] text-slate-400 font-medium leading-none">शेअर्स संख्या</div>
                                                    <div className="text-[10px] font-bold text-slate-600 leading-none mt-1 font-mono">{Math.floor(data.portfolio.shares.balance / 100)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2 flex flex-col justify-between flex-1 bg-slate-50/20">
                                            <div className="flex flex-col gap-1.5">
                                                <button 
                                                    onClick={() => onNavigate('share-master', { memberId: selectedMemberId })} 
                                                    className="w-full text-left py-1.5 px-2 rounded-md font-bold text-[11px] flex items-center justify-between transition-all duration-150 shadow-2xs border cursor-pointer bg-purple-50/90 hover:bg-purple-100 text-purple-900 border-purple-200 hover:border-purple-300 group/btn"
                                                >
                                                    <span className="truncate">{!hasShares ? '+ नवीन शेअर्स खरेदी' : 'शेअर्स खरेदी व वाटप'}</span> 
                                                    <ChevronRight size={13} className="text-purple-600 group-hover/btn:translate-x-0.5 transition-transform shrink-0" />
                                                </button>

                                                {hasShares && (
                                                    <>
                                                        <button onClick={() => onNavigate('share-withdrawal', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-purple-50/60 border border-slate-200/90 hover:border-purple-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-purple-900">भाग हस्तांतरण व परतावा</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-purple-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('shares-khatavani-report', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-purple-50/60 border border-slate-200/90 hover:border-purple-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-purple-900">भाग खाते खतावणी</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-purple-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('sabhasad-labhansh-report', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-purple-50/60 border border-slate-200/90 hover:border-purple-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-purple-900">लाभांश जमा (Dividend)</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-purple-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('i-namuna-report', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-purple-50/60 border border-slate-200/90 hover:border-purple-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-purple-900">आय नमुना शेअर नोंदवही</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-purple-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                        <button onClick={() => onNavigate('j-namuna-report', { memberId: selectedMemberId })} className="w-full text-left py-1 px-2 rounded-md font-semibold text-[10.5px] text-slate-700 bg-white hover:bg-purple-50/60 border border-slate-200/90 hover:border-purple-200 shadow-2xs flex items-center justify-between group/btn cursor-pointer transition-all">
                                                            <span className="truncate group-hover/btn:text-purple-900">जे नमुना सभासद यादी</span> 
                                                            <ChevronRight size={12} className="text-slate-400 group-hover/btn:text-purple-600 group-hover/btn:translate-x-0.5 transition-all shrink-0" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {hasShares && (
                                                <div className="pt-2 mt-auto">
                                                    <button 
                                                        onClick={() => setActiveReportModule(prev => prev === 'shares' ? null : 'shares')} 
                                                        className={`w-full text-left py-1.5 px-2 rounded-md font-bold text-[10.5px] flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                                                            activeReportModule === 'shares'
                                                                ? 'bg-purple-600 text-white' 
                                                                : 'bg-purple-50/90 border border-purple-200 text-purple-900 hover:bg-purple-100'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-1.5 truncate">
                                                            <span>📊</span> शेअर्स अहवाल
                                                        </span> 
                                                        {activeReportModule === 'shares' ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            );
                        })()}

                        {/* Collapsible Module Reports Drawer (Restored Original Style with Compact Resolution) */}
                        {activeReportModule && moduleReportsConfig[activeReportModule] && (() => {
                            const cfg = moduleReportsConfig[activeReportModule];

                            return (
                                <div className={`bg-white border-2 ${cfg.borderColor} rounded-lg shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}>
                                    
                                    {/* Header matching original style */}
                                    <div className={`${cfg.headerBg} border-b ${cfg.headerBorder} px-3 py-1.5 flex items-center justify-between`}>
                                        <div className="flex items-center gap-2">
                                            <FolderClosed className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                                            <h4 className={`text-xs font-bold ${cfg.headerText} tracking-tight`}>
                                                {cfg.title}
                                            </h4>
                                            <span className="text-[9.5px] bg-white/90 font-bold px-2 py-0.2 rounded-full border border-gray-300 shadow-2xs">
                                                {cfg.countLabel}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveReportModule(null)}
                                            className={`${cfg.headerText} ${cfg.closeBtnHover} px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer`}
                                            title="बंद करा"
                                        >
                                            ✕ बंद करा
                                        </button>
                                    </div>

                                    {/* Reports Buttons with Compact Resolution */}
                                    <div className={`p-2.5 ${cfg.containerBg}`}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {cfg.reports.map((rpt) => (
                                                <button
                                                    key={rpt.id}
                                                    type="button"
                                                    onClick={() => handleReportNavigate(rpt.id)}
                                                    className={`bg-white border border-gray-200 ${cfg.hoverBorder} ${cfg.hoverBg} py-1.5 px-2.5 rounded-md shadow-2xs flex items-center gap-2 text-left text-[11px] font-semibold text-gray-800 ${cfg.hoverText} transition-all cursor-pointer group active:scale-[0.99]`}
                                                >
                                                    <FileText className={`w-3.5 h-3.5 text-gray-400 group-hover:${cfg.iconColor} transition-colors shrink-0`} />
                                                    <span className="flex-1 truncate">{rpt.name}</span>
                                                    <ChevronRight className={`w-3 h-3 text-gray-300 group-hover:${cfg.iconColor} group-hover:translate-x-0.5 transition-all shrink-0`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Recent Transactions Accordion Tray */}
                        {showTransactions && data.recentTransactions && data.recentTransactions.length > 0 && (
                            <div className="backdrop-blur-xl bg-white/90 border border-slate-200/90 rounded-xl shadow-xs overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="bg-slate-50/90 border-b border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <History className="w-4 h-4 text-emerald-700" />
                                        <span className="text-xs md:text-sm font-bold text-slate-800">अलिकडील व्यवहार इतिहास (Recent Transactions - Top 20)</span>
                                    </div>
                                    <button
                                        onClick={() => setShowTransactions(false)}
                                        className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-1 rounded cursor-pointer"
                                    >
                                        ✕ लपवा
                                    </button>
                                </div>
                                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead className="bg-slate-100/80 text-slate-600 font-bold sticky top-0 border-b border-slate-200/80 z-10">
                                            <tr>
                                                <th className="p-2.5">दिनांक व वेळ</th>
                                                <th className="p-2.5">विभाग</th>
                                                <th className="p-2.5">व्यवहार प्रकार</th>
                                                <th className="p-2.5 text-right">रक्कम (₹)</th>
                                                <th className="p-2.5">शाखा</th>
                                                <th className="p-2.5">व्हाउचर / पावती क्र.</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {data.recentTransactions.map((tx, idx) => {
                                                const isCredit = tx.transactionType.includes('जमा') || tx.transactionType.includes('Deposit') || tx.transactionType.includes('Collection');
                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="p-2.5 text-slate-600 font-mono whitespace-nowrap">{tx.date}</td>
                                                        <td className="p-2.5 font-semibold text-slate-700">{tx.module}</td>
                                                        <td className="p-2.5">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                                                                isCredit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                                                            }`}>
                                                                {isCredit ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                                                                {tx.transactionType}
                                                            </span>
                                                        </td>
                                                        <td className={`p-2.5 text-right font-bold font-mono ${isCredit ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                            {isCredit ? '+' : '-'} ₹ {Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-2.5 text-slate-600 truncate">{tx.branch}</td>
                                                        <td className="p-2.5 font-mono text-slate-600">{tx.voucherNo}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
}

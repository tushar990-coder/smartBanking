import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Landmark, CheckCircle2, AlertCircle, Calendar, UserCheck, 
    Search, BookOpen, ShieldCheck, RotateCcw, X, List, Percent, 
    IndianRupee, Edit2, Trash2, FileSpreadsheet, Plus, Layers, 
    CheckCircle, XCircle, Save, Calculator, UserPlus, Clock, 
    Sparkles, Eye, FileText, Banknote, RefreshCw, CreditCard, 
    Wallet, Receipt, ArrowRight, ChevronRight
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import LoanDistributionListModal from './LoanDistributionListModal';
import CashLedgerReflectBadge from './common/CashLedgerReflectBadge';

interface Member {
    memberID: number;
    firstName: string;
    middleName?: string;
    lastName: string;
    memberCode: string;
    cifNo?: string;
    mobileNo?: string;
}

interface LoanApplication {
    loanApplicationID: number;
    applicationNo: string;
    applicationDate: string;
    memberID: number;
    coMemberID?: number;
    guarantor1MemberID?: number;
    guarantor2MemberID?: number;
    guarantor1Member?: Member;
    guarantor2Member?: Member;
    securityDetails?: string;
    securityValue?: number;
    requestedAmount: number;
    interestRate: number;
    durationMonths: number;
    installmentFrequency: string;
    status: string;
    member?: Member;
    loanRateID: number;
    noOfInstallments?: number;
    installmentAmount?: number;
    firstInstallmentDate?: string;
    maturityDate?: string;
    loanAccountNo?: string;
    totalDisbursedAmount?: number;
    pendingSanctionedAmount?: number;
    disbursementCount?: number;
    disbursementStatus?: string;
    linkedLoanAccountID?: number;
    loanRate?: {
        loanRateID: number;
        loanType: string;
        shortName?: string;
        interestCalculationMethod?: string;
        loanInstallmentType?: string;
    };
}

interface LoanAccount {
    loanAccountID: number;
    loanAccountNo: string;
    memberID: number;
    loanApplicationID?: number;
    guarantor1MemberID?: number;
    guarantor2MemberID?: number;
    securityDetails?: string;
    securityValue?: number;
    sanctionedAmount: number;
    interestRate: number;
    durationMonths: number;
    installmentFrequency: string;
    coMemberID?: number;
    loanRateID?: number;
    member?: Member;
    guarantor1Member?: Member;
    guarantor2Member?: Member;
    noOfInstallments?: number;
    installmentAmount?: number;
    openingDate?: string;
    firstInstallmentDate?: string;
    maturityDate?: string;
    status?: string;
    loanRate?: {
        loanRateID: number;
        loanType: string;
        shortName?: string;
        interestCalculationMethod?: string;
        loanInstallmentType?: string;
    };
}

interface LoanDisbursementDeduction {
    ledgerID: number;
    amount: number;
    ledgerName?: string;
}

interface LoanDisbursement {
    loanDisbursementID: number;
    loanAccountID: number;
    disbursementDate: string;
    sanctionedAmount: number;
    disbursementAmount: number;
    netAmountPaid: number;
    paymentMode: string;
    paymentDetails?: string;
    bankName?: string;
    chequeNo?: string;
    transferToSavingAccountNo?: string;
    bankAccountLedgerID?: number;
    remarks?: string;
    loanAccount?: LoanAccount;
    deductions?: LoanDisbursementDeduction[];
}

interface Props {
    draftApplication?: any;
    editingDisbursement?: any;
    onRequestEditApplication?: (d: any) => void;
    onSaveSuccess?: () => void;
}

const formatDateSafe = (dateVal: any): string => {
    if (!dateVal) return '-';
    if (typeof dateVal === 'string') {
        const str = dateVal.trim();
        if (!str) return '-';
        const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (ddmmyyyyMatch) {
            const day = ddmmyyyyMatch[1].padStart(2, '0');
            const month = ddmmyyyyMatch[2].padStart(2, '0');
            const year = ddmmyyyyMatch[3];
            return `${day}/${month}/${year}`;
        }
        const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (yyyymmddMatch) {
            const year = yyyymmddMatch[1];
            const month = yyyymmddMatch[2].padStart(2, '0');
            const day = yyyymmddMatch[3].padStart(2, '0');
            return `${day}/${month}/${year}`;
        }
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return String(dateVal);
};

const LoanDisbursementMaster: React.FC<Props> = ({ draftApplication, editingDisbursement, onRequestEditApplication, onSaveSuccess }) => {
    const [disbursements, setDisbursements] = useState<LoanDisbursement[]>([]);
    const [applications, setApplications] = useState<LoanApplication[]>([]);
    const [accounts, setAccounts] = useState<LoanAccount[]>([]);
    const [bankLedgers, setBankLedgers] = useState<any[]>([]);
    const [allLedgers, setAllLedgers] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [savingAccounts, setSavingAccounts] = useState<any[]>([]);
    
    const globalBranchStr = localStorage.getItem('globalBranchId');
    const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
    const initialBranchId = hasGlobalBranch ? parseInt(globalBranchStr as string, 10) : 1;
    const [selectedBranchId, setSelectedBranchId] = useState<number>(initialBranchId);
    
    const [showListModal, setShowListModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
    // Live Schedule & Summary Side Panel State (Matching LoanApplicationMaster.tsx)
    const [showSchedule, setShowSchedule] = useState<boolean>(false);
    const [scheduleTab, setScheduleTab] = useState<'summary' | 'schedule'>('summary');
    const [scheduleData, setScheduleData] = useState<any[]>([]);
    
    // Multi-Tranche Tracking State
    const [alreadyDisbursedAmount, setAlreadyDisbursedAmount] = useState<number>(0);
    const [pendingSanctionedLimit, setPendingSanctionedLimit] = useState<number>(0);
    const [currentTrancheNo, setCurrentTrancheNo] = useState<number>(1);

    // Limits and member specific data
    const maxShareLimit = 10000;
    const [memberShareBalance, setMemberShareBalance] = useState(0);
    const [nextShareConfig, setNextShareConfig] = useState<{ nextCertificateNo: string; nextFromShareNo: number; nextMemberCode?: string }>({ nextCertificateNo: 'CERT-2026-00001', nextFromShareNo: 1, nextMemberCode: '' });

    const formContainerRef = useRef<HTMLDivElement>(null);

    // Exact matching theme classes from LoanApplicationMaster.tsx
    const labelClass = "block text-[11px] font-bold text-gray-700 mb-0.5";
    const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[28px]";

    const fetchNextShareConfig = async () => {
        try {
            const res = await axios.get('/api/ShareAccounts/NextShareConfig');
            if (res.data) {
                setNextShareConfig(res.data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const [formData, setFormData] = useState<Partial<LoanDisbursement>>({
        disbursementDate: new Date().toISOString().split('T')[0],
        paymentMode: "Cash",
        sanctionedAmount: 0,
        disbursementAmount: 0,
        netAmountPaid: 0,
        remarks: ''
    });

    const [deductions, setDeductions] = useState<LoanDisbursementDeduction[]>([]);
    const [sharePercent, setSharePercent] = useState<number>(5);

    const [newAccountData, setNewAccountData] = useState<Partial<LoanAccount>>({
        loanAccountNo: '',
        installmentFrequency: "मासिक"
    });

    const [sourceType, setSourceType] = useState<'Draft' | 'Application' | 'ExistingAccount'>('Application');
    const [selectedSourceId, setSelectedSourceId] = useState<number | ''>('');

    useEffect(() => {
        fetchNextShareConfig();
        fetchData();
        fetchDropdowns().then(() => {
            if (draftApplication && !editingId && !editingDisbursement) {
                setSourceType('Draft');
                setSelectedSourceId('');
                
                setAlreadyDisbursedAmount(0);
                setPendingSanctionedLimit(draftApplication.requestedAmount || 0);
                setCurrentTrancheNo(1);

                setFormData(prev => ({
                    ...prev,
                    sanctionedAmount: draftApplication.requestedAmount,
                    disbursementAmount: draftApplication.requestedAmount,
                    netAmountPaid: draftApplication.requestedAmount
                }));
                
                fetchMemberShareBalance(draftApplication.memberID);

                setNewAccountData({
                    memberID: draftApplication.memberID,
                    coMemberID: draftApplication.coMemberID,
                    guarantor1MemberID: draftApplication.guarantor1MemberID,
                    guarantor2MemberID: draftApplication.guarantor2MemberID,
                    securityDetails: draftApplication.securityDetails,
                    securityValue: draftApplication.securityValue,
                    loanRateID: draftApplication.loanRateID,
                    sanctionedAmount: draftApplication.requestedAmount,
                    interestRate: draftApplication.interestRate,
                    durationMonths: draftApplication.durationMonths,
                    noOfInstallments: draftApplication.noOfInstallments || 0,
                    installmentAmount: draftApplication.installmentAmount || 0,
                    installmentFrequency: draftApplication.installmentFrequency || 'मासिक',
                    openingDate: formData.disbursementDate || new Date().toISOString().split('T')[0],
                    firstInstallmentDate: draftApplication.firstInstallmentDate,
                    maturityDate: draftApplication.maturityDate,
                    status: "Active",
                    loanAccountNo: `L-${new Date().getFullYear()}-${Math.floor(Math.random()*1000)}`
                });
            } else if (editingDisbursement && draftApplication && (!editingId || editingId === editingDisbursement.loanDisbursementID)) {
                setEditingId(editingDisbursement.loanDisbursementID);
                setSourceType('Draft');
                setSelectedSourceId('');

                setFormData(prev => ({
                    ...prev,
                    loanDisbursementID: editingDisbursement.loanDisbursementID,
                    loanAccountID: editingDisbursement.loanAccountID,
                    disbursementDate: new Date(editingDisbursement.disbursementDate).toISOString().split('T')[0],
                    paymentMode: editingDisbursement.paymentMode || 'Cash',
                    sanctionedAmount: draftApplication.requestedAmount,
                    disbursementAmount: editingDisbursement.disbursementAmount || draftApplication.requestedAmount,
                    netAmountPaid: editingDisbursement.netAmountPaid || draftApplication.requestedAmount,
                    bankAccountLedgerID: editingDisbursement.bankAccountLedgerID,
                    chequeNo: editingDisbursement.chequeNo,
                    transferToSavingAccountNo: editingDisbursement.transferToSavingAccountNo,
                    remarks: editingDisbursement.remarks
                }));

                const deds = editingDisbursement.deductions?.map((d: any) => ({
                    ledgerID: d.ledgerID,
                    amount: d.amount
                })) || [];
                setDeductions(deds);

                fetchMemberShareBalance(draftApplication.memberID);

                setNewAccountData({
                    loanAccountID: editingDisbursement.loanAccountID,
                    memberID: draftApplication.memberID,
                    coMemberID: draftApplication.coMemberID,
                    loanRateID: draftApplication.loanRateID,
                    sanctionedAmount: draftApplication.requestedAmount,
                    interestRate: draftApplication.interestRate,
                    durationMonths: draftApplication.durationMonths,
                    noOfInstallments: draftApplication.noOfInstallments || 0,
                    installmentAmount: draftApplication.installmentAmount || 0,
                    installmentFrequency: draftApplication.installmentFrequency || 'मासिक',
                    openingDate: formData.disbursementDate || new Date().toISOString().split('T')[0],
                    firstInstallmentDate: draftApplication.firstInstallmentDate,
                    maturityDate: draftApplication.maturityDate,
                    status: "Active",
                    loanAccountNo: editingDisbursement.loanAccount?.loanAccountNo || `L-${new Date().getFullYear()}-${Math.floor(Math.random()*1000)}`
                });
            }
        });
    }, [draftApplication, editingDisbursement]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/LoanDisbursements');
            setDisbursements(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const [appRes, accRes, ledgersRes, branchesRes, savingAccsRes, disbRes] = await Promise.all([
                axios.get('/api/LoanApplications'),
                axios.get('/api/LoanAccounts'),
                axios.get('/api/Ledgers'),
                axios.get('/api/Branches'),
                axios.get('/api/SavingAccounts'),
                axios.get('/api/LoanDisbursements')
            ]);
            
            const allDisbursements: LoanDisbursement[] = disbRes.data || [];
            setDisbursements(allDisbursements);

            // Compute multi-tranche status for each application
            const appsWithStatus: LoanApplication[] = (appRes.data || []).map((a: any) => {
                const linkedAcc = accRes.data?.find((acc: any) => acc.loanApplicationID === a.loanApplicationID);
                const accDisbursements = linkedAcc ? allDisbursements.filter(d => d.loanAccountID === linkedAcc.loanAccountID) : [];
                const totalDisb = a.totalDisbursedAmount !== undefined 
                    ? a.totalDisbursedAmount 
                    : accDisbursements.reduce((s, d) => s + (d.disbursementAmount || 0), 0);
                
                const pendingLimit = a.pendingSanctionedAmount !== undefined
                    ? a.pendingSanctionedAmount
                    : Math.max(0, (a.requestedAmount || 0) - totalDisb);

                return {
                    ...a,
                    totalDisbursedAmount: totalDisb,
                    pendingSanctionedAmount: pendingLimit,
                    disbursementCount: a.disbursementCount !== undefined ? a.disbursementCount : accDisbursements.length,
                    linkedLoanAccountID: linkedAcc?.loanAccountID,
                    loanAccountNo: a.loanAccountNo || linkedAcc?.loanAccountNo
                };
            });

            // Filter applications that have pending sanctioned limit > 0
            const availableApps = appsWithStatus.filter((a: any) => (a.pendingSanctionedAmount || 0) > 0);
            setApplications(availableApps);
            setAccounts((accRes.data || []).filter((a: any) => !a.isOpeningBalance));
            setBankLedgers((ledgersRes.data || []).filter((l: any) => (l.accountGroup?.groupName?.toLowerCase() || '').includes('bank') || (l.accountGroup?.groupName || '').includes('बँक')));
            setAllLedgers(ledgersRes.data || []);
            setBranches(branchesRes.data || []);
            setSavingAccounts(savingAccsRes.data || []);
            return availableApps;
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMemberShareBalance = async (memberId: number) => {
        if (!memberId) return;
        try {
            const res = await axios.get(`/api/Reports/Member360/${memberId}`);
            if (res.data && res.data.profile && res.data.profile.shareCapital !== undefined) {
                setMemberShareBalance(res.data.profile.shareCapital);
            } else if (res.data && res.data.portfolio && res.data.portfolio.shares) {
                setMemberShareBalance(res.data.portfolio.shares.balance || 0);
            } else {
                setMemberShareBalance(0);
            }
        } catch (err) {
            console.error("Error fetching share balance:", err);
            setMemberShareBalance(0);
        }
    };

    // Calculate dynamic shares when share percent or sanctioned amount changes
    useEffect(() => {
        if (!allLedgers || allLedgers.length === 0) return;
        const shareLedger = allLedgers.find(l => l.accountType === 'Share Capital') || 
                            allLedgers.find(l => l.ledgerName && (l.ledgerName.includes('Share') || l.ledgerName.includes('भाग') || l.ledgerName.includes('भांडवल')));
        if (shareLedger && formData.disbursementAmount) {
            let calculatedShare = (formData.disbursementAmount || 0) * (sharePercent / 100);
            
            if (memberShareBalance + calculatedShare > maxShareLimit) {
                calculatedShare = maxShareLimit - memberShareBalance;
                if (calculatedShare < 0) calculatedShare = 0;
            }

            setDeductions(prev => {
                const existingShareIndex = prev.findIndex(d => d.ledgerID === shareLedger.ledgerID);
                if (existingShareIndex !== -1) {
                    const next = [...prev];
                    next[existingShareIndex].amount = calculatedShare;
                    return next;
                } else if (calculatedShare > 0) {
                    return [...prev, { ledgerID: shareLedger.ledgerID, amount: calculatedShare, ledgerName: shareLedger.ledgerName }];
                }
                return prev;
            });
        }
    }, [sharePercent, formData.disbursementAmount, memberShareBalance, allLedgers]);

    // Recalculate net amount whenever deductions or disbursement amount changes
    useEffect(() => {
        const totalDeductions = deductions.reduce((sum, d) => sum + (parseFloat(d.amount as any) || 0), 0);
        const disburseAmt = parseFloat(formData.disbursementAmount as any) || 0;
        setFormData(prev => ({
            ...prev,
            disbursementAmount: disburseAmt,
            netAmountPaid: Math.max(0, disburseAmt - totalDeductions)
        }));
    }, [deductions, formData.disbursementAmount]);

    const getCurrentApplicantMemberId = () => {
        if (draftApplication) return draftApplication.memberID;
        if (sourceType === 'Application' && selectedSourceId) {
            const app = applications.find(a => a.loanApplicationID === selectedSourceId);
            if (app) return app.memberID;
        }
        if (sourceType === 'ExistingAccount' && selectedSourceId) {
            const acc = accounts.find(a => a.loanAccountID === selectedSourceId);
            if (acc) return acc.memberID;
        }
        return 0;
    };

    // Auto-select applicant's primary saving account when payment mode is Saving Transfer
    useEffect(() => {
        const applicantId = getCurrentApplicantMemberId();
        if (formData.paymentMode === 'Saving Transfer' && applicantId && savingAccounts.length > 0) {
            const appAcc = savingAccounts.find(s => s.memberID === applicantId && (s.status === 'Active' || !s.status));
            if (appAcc && (!formData.transferToSavingAccountNo || !savingAccounts.some(s => s.accountNo === formData.transferToSavingAccountNo))) {
                setFormData(prev => ({ ...prev, transferToSavingAccountNo: appAcc.accountNo }));
            }
        }
    }, [formData.paymentMode, selectedSourceId, sourceType, draftApplication, savingAccounts]);

    const handleSourceSelection = (e: any) => {
        const val = e.target.value;
        setErrorMessage('');
        setSuccessMessage('');
        if (!val) {
            setSelectedSourceId('');
            setAlreadyDisbursedAmount(0);
            setPendingSanctionedLimit(0);
            setCurrentTrancheNo(1);
            setScheduleData([]);
            return;
        }
        const id = parseInt(val, 10);
        setSelectedSourceId(id);

        let sancAmount = 0;
        let memberId = 0;
        let alreadyDisb = 0;
        let pendingLimit = 0;
        let trancheNo = 1;

        if (sourceType === 'Application') {
            const app = applications.find(a => a.loanApplicationID === id);
            if (app) {
                sancAmount = app.requestedAmount;
                memberId = app.memberID;
                
                alreadyDisb = app.totalDisbursedAmount || 0;
                pendingLimit = app.pendingSanctionedAmount !== undefined ? app.pendingSanctionedAmount : Math.max(0, sancAmount - alreadyDisb);
                trancheNo = (app.disbursementCount || 0) + 1;

                setAlreadyDisbursedAmount(alreadyDisb);
                setPendingSanctionedLimit(pendingLimit);
                setCurrentTrancheNo(trancheNo);

                setNewAccountData({
                    loanAccountID: app.linkedLoanAccountID,
                    loanApplicationID: app.loanApplicationID,
                    memberID: app.memberID,
                    coMemberID: app.coMemberID,
                    guarantor1MemberID: app.guarantor1MemberID,
                    guarantor2MemberID: app.guarantor2MemberID,
                    securityDetails: app.securityDetails,
                    securityValue: app.securityValue,
                    loanRateID: app.loanRateID,
                    sanctionedAmount: app.requestedAmount,
                    interestRate: app.interestRate,
                    durationMonths: app.durationMonths,
                    noOfInstallments: app.noOfInstallments || 0,
                    installmentAmount: app.installmentAmount || 0,
                    installmentFrequency: app.installmentFrequency || 'मासिक',
                    openingDate: formData.disbursementDate || new Date().toISOString().split('T')[0],
                    firstInstallmentDate: app.firstInstallmentDate,
                    maturityDate: app.maturityDate,
                    status: "Active",
                    loanAccountNo: app.loanAccountNo || `L-${new Date().getFullYear()}-${Math.floor(Math.random()*1000)}`
                });

                setFormData(prev => ({
                    ...prev,
                    loanAccountID: app.linkedLoanAccountID || 0,
                    sanctionedAmount: sancAmount,
                    disbursementAmount: pendingLimit,
                    disbursementDate: new Date().toISOString().split('T')[0]
                }));
            }
        } else {
            const acc = accounts.find(a => a.loanAccountID === id);
            if (acc) {
                sancAmount = acc.sanctionedAmount;
                memberId = acc.memberID;
                
                alreadyDisb = disbursements
                    .filter(d => d.loanAccountID === acc.loanAccountID)
                    .reduce((sum, d) => sum + (d.disbursementAmount || 0), 0);
                pendingLimit = Math.max(0, sancAmount - alreadyDisb);
                trancheNo = disbursements.filter(d => d.loanAccountID === acc.loanAccountID).length + 1;

                setAlreadyDisbursedAmount(alreadyDisb);
                setPendingSanctionedLimit(pendingLimit);
                setCurrentTrancheNo(trancheNo);

                setNewAccountData({
                    loanAccountID: acc.loanAccountID,
                    memberID: acc.memberID,
                    coMemberID: acc.coMemberID,
                    guarantor1MemberID: acc.guarantor1MemberID,
                    guarantor2MemberID: acc.guarantor2MemberID,
                    securityDetails: acc.securityDetails,
                    securityValue: acc.securityValue,
                    loanRateID: acc.loanRateID,
                    sanctionedAmount: acc.sanctionedAmount,
                    interestRate: acc.interestRate,
                    durationMonths: acc.durationMonths,
                    noOfInstallments: acc.noOfInstallments || 0,
                    installmentAmount: acc.installmentAmount || 0,
                    installmentFrequency: acc.installmentFrequency || 'मासिक',
                    openingDate: acc.openingDate,
                    firstInstallmentDate: acc.firstInstallmentDate,
                    maturityDate: acc.maturityDate,
                    status: "Active",
                    loanAccountNo: acc.loanAccountNo
                });

                setFormData(p => ({ 
                    ...p, 
                    loanAccountID: acc.loanAccountID,
                    sanctionedAmount: sancAmount,
                    disbursementAmount: pendingLimit > 0 ? pendingLimit : sancAmount
                }));
            }
        }

        fetchMemberShareBalance(memberId);
        setDeductions([]);
    };

    // Calculate Live EMI / Repayment Schedule (Matching LoanApplicationMaster.tsx)
    const calculateSchedule = async () => {
        setErrorMessage('');

        const disbAmount = parseFloat(String(formData.disbursementAmount || '0'));
        const intRate = parseFloat(String(newAccountData.interestRate || '0'));
        const instCount = parseInt(String(newAccountData.noOfInstallments || '12'), 10);
        const rateId = parseInt(String(newAccountData.loanRateID || '0'), 10);

        if (disbAmount <= 0) {
            setErrorMessage('कृपया वैध कर्ज वाटप रक्कम टाका!');
            return;
        }

        try {
            const payload = {
                loanRateID: rateId || 1,
                loanAmount: disbAmount,
                interestRate: intRate > 0 ? intRate : 12,
                noOfInstallments: instCount > 0 ? instCount : 12,
                durationMonths: newAccountData.durationMonths || 12,
                installmentFrequency: newAccountData.installmentFrequency || 'मासिक',
                loanDisbursementDate: formData.disbursementDate || new Date().toISOString().split('T')[0],
                firstInstallmentDate: newAccountData.firstInstallmentDate ? newAccountData.firstInstallmentDate : null,
                customInstallmentAmount: newAccountData.installmentAmount && newAccountData.installmentAmount > 0 ? newAccountData.installmentAmount : null
            };

            const res = await axios.post('/api/LoanAccounts/PreviewSchedule', payload);
            
            const mappedSchedule = res.data.map((row: any) => {
                const roundedPrincipal = Math.round(row.principal);
                const roundedInterest = Math.round(row.interest);
                const roundedTotal = roundedPrincipal + roundedInterest;
                return {
                    instNo: row.no,
                    dueDate: formatDateSafe(row.date),
                    principal: roundedPrincipal,
                    interest: roundedInterest,
                    total: roundedTotal,
                    balance: Math.round(row.balance),
                    openingBalance: Math.round(row.openingBalance),
                    closingBalance: Math.round(row.closingBalance),
                    days: row.days,
                    interestRate: row.interestRate
                };
            });

            setScheduleData(mappedSchedule);
            setScheduleTab('schedule');
            setShowSchedule(true);
        } catch (err) {
            console.error(err);
            setErrorMessage('हप्ता वेळापत्रक लोड करताना त्रुटी आली.');
        }
    };

    const addDeductionRow = () => {
        setDeductions(prev => [...prev, { ledgerID: 0, amount: 0 }]);
    };

    const removeDeductionRow = (index: number) => {
        setDeductions(prev => prev.filter((_, i) => i !== index));
    };

    const handleDeductionChange = (index: number, field: string, value: any) => {
        setDeductions(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            if (field === 'ledgerID') {
                const ledger = allLedgers.find(l => l.ledgerID === value);
                next[index].ledgerName = ledger?.ledgerName;
            }
            return next;
        });
    };

    const handleEdit = (d: LoanDisbursement) => {
        if (d.loanAccount?.loanApplicationID && onRequestEditApplication) {
            onRequestEditApplication(d);
            setShowListModal(false);
            return;
        }

        setEditingId(d.loanDisbursementID);
        setSourceType('ExistingAccount');
        setSelectedSourceId(d.loanAccountID);
        setFormData({
            loanDisbursementID: d.loanDisbursementID,
            disbursementDate: new Date(d.disbursementDate).toISOString().split('T')[0],
            paymentMode: d.paymentMode || 'Cash',
            sanctionedAmount: d.sanctionedAmount,
            disbursementAmount: d.disbursementAmount,
            netAmountPaid: d.netAmountPaid,
            bankAccountLedgerID: d.bankAccountLedgerID,
            chequeNo: d.chequeNo,
            transferToSavingAccountNo: d.transferToSavingAccountNo,
            remarks: d.remarks || ''
        });

        const deds = d.deductions?.map(ded => ({
            ledgerID: ded.ledgerID,
            amount: ded.amount,
            ledgerName: ded.ledgerName || allLedgers.find(l => l.ledgerID === ded.ledgerID)?.ledgerName
        })) || [];
        setDeductions(deds);
        
        setShowListModal(false);
        if (formContainerRef.current) {
            formContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleResetForm = () => {
        setEditingId(null);
        setSourceType('Application');
        setSelectedSourceId('');
        setAlreadyDisbursedAmount(0);
        setPendingSanctionedLimit(0);
        setCurrentTrancheNo(1);
        setDeductions([]);
        setMemberShareBalance(0);
        setNewAccountData({});
        setScheduleData([]);
        setShowSchedule(false);
        setErrorMessage('');
        setSuccessMessage('');
        setFormData({
            disbursementDate: new Date().toISOString().split('T')[0],
            paymentMode: "Cash",
            sanctionedAmount: 0,
            disbursementAmount: 0,
            netAmountPaid: 0,
            remarks: ''
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const curDisbAmt = parseFloat(formData.disbursementAmount as any) || 0;
        const allowedMax = pendingSanctionedLimit > 0 ? pendingSanctionedLimit : (formData.sanctionedAmount || 0);

        if (!selectedSourceId && sourceType !== 'Draft') {
            setErrorMessage('कृपया मंजूर कर्ज अर्ज किंवा कर्ज खाते निवडा!');
            return;
        }

        if (curDisbAmt <= 0) {
            setErrorMessage('कृपया वैध कर्ज वाटप रक्कम टाका!');
            return;
        }

        if (curDisbAmt > allowedMax) {
            setErrorMessage(`वाटप रक्कम (₹${curDisbAmt.toLocaleString('en-IN')}) मंजूर शिल्लक मर्यादेपेक्षा (₹${allowedMax.toLocaleString('en-IN')}) जास्त असू शकत नाही!`);
            return;
        }

        if ((formData.netAmountPaid || 0) < 0) {
            setErrorMessage('एकूण कपातींची रक्कम वाटप रक्कमेपेक्षा जास्त असू शकत नाही! कृपया कपाती तपासा.');
            return;
        }

        setIsSaving(true);
        try {
            const payload: any = { 
                ...formData, 
                deductions: deductions.filter(d => d.ledgerID && d.amount > 0)
            };

            if (sourceType === 'Application' || sourceType === 'Draft') {
                payload.loanAccount = {
                    ...newAccountData,
                    branchID: selectedBranchId,
                    openingDate: formData.disbursementDate,
                    loanDisbursementDate: formData.disbursementDate,
                    principalBalance: formData.disbursementAmount,
                    interestBalance: 0,
                    overdueInterestBalance: 0,
                    status: 'Active'
                } as any;
            }

            if (sourceType === 'Draft' && draftApplication) {
                const appPayload = { ...draftApplication, status: 'Approved' };
                delete (appPayload as any).member;
                delete (appPayload as any).coMember;
                delete (appPayload as any).loanRate;
                let appRes;
                if (appPayload.loanApplicationID) {
                    await axios.put(`/api/LoanApplications/${appPayload.loanApplicationID}`, appPayload);
                    payload.loanAccount!.loanApplicationID = appPayload.loanApplicationID;
                } else {
                    appRes = await axios.post('/api/LoanApplications', appPayload);
                    payload.loanAccount!.loanApplicationID = appRes.data.loanApplicationID;
                }
            }

            if (editingId) {
                await axios.put(`/api/LoanDisbursements/${editingId}`, payload);
                setSuccessMessage(`कर्ज वाटप #${editingId} यशस्वीरीत्या अद्यतनित (Updated) झाले!`);
            } else {
                await axios.post('/api/LoanDisbursements', payload);
                setSuccessMessage(`नवीन कर्ज वाटप यशस्वीरीत्या पूर्ण झाले! पावती/व्हाउचर तयार झाले.`);
            }
            
            fetchData();
            fetchDropdowns();
            if (onSaveSuccess) onSaveSuccess();
            setTimeout(() => {
                handleResetForm();
            }, 1200);
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.message || err.response?.data?.title || (typeof err.response?.data === 'string' ? err.response.data : err.message);
            setErrorMessage(msg || 'कर्ज वाटप सेव्ह करताना त्रुटी आली.');
        } finally {
            setIsSaving(false);
        }
    };

    // Derived values for right panel & summary
    let selectedName = "";
    let selectedCif = "";
    let selectedAccountNo = "";
    let selectedLoanType = "";
    let selectedGuarantor1 = "-";
    let selectedGuarantor2 = "-";
    let selectedSecurity = "-";

    const currentApplicantMemberId = getCurrentApplicantMemberId();

    if (draftApplication) {
        selectedName = `${draftApplication.member?.firstName || ''} ${draftApplication.member?.lastName || ''}`.trim();
        selectedCif = draftApplication.member?.cifNo || '';
        selectedAccountNo = draftApplication.applicationNo || 'DRAFT';
        selectedLoanType = draftApplication.loanRate?.loanType || 'General Loan';
        selectedGuarantor1 = draftApplication.guarantor1Member ? `${draftApplication.guarantor1Member.firstName} ${draftApplication.guarantor1Member.lastName}` : '-';
        selectedGuarantor2 = draftApplication.guarantor2Member ? `${draftApplication.guarantor2Member.firstName} ${draftApplication.guarantor2Member.lastName}` : '-';
        selectedSecurity = draftApplication.securityDetails || '-';
    } else if (sourceType === 'Application' && selectedSourceId) {
        const app = applications.find(a => a.loanApplicationID === selectedSourceId);
        if (app) {
            selectedName = `${app.member?.firstName || ''} ${app.member?.lastName || ''}`.trim();
            selectedCif = app.member?.cifNo || '';
            selectedAccountNo = app.applicationNo || '';
            selectedLoanType = app.loanRate?.loanType || '';
            selectedGuarantor1 = app.guarantor1Member ? `${app.guarantor1Member.firstName} ${app.guarantor1Member.lastName}` : '-';
            selectedGuarantor2 = app.guarantor2Member ? `${app.guarantor2Member.firstName} ${app.guarantor2Member.lastName}` : '-';
            selectedSecurity = app.securityDetails || '-';
        }
    } else if (sourceType === 'ExistingAccount' && selectedSourceId) {
        const acc = accounts.find(a => a.loanAccountID === selectedSourceId);
        if (acc) {
            selectedName = `${acc.member?.firstName || ''} ${acc.member?.lastName || ''}`.trim();
            selectedCif = acc.member?.cifNo || '';
            selectedAccountNo = acc.loanAccountNo || '';
            selectedLoanType = acc.loanRate?.loanType || '';
            selectedGuarantor1 = acc.guarantor1Member ? `${acc.guarantor1Member.firstName} ${acc.guarantor1Member.lastName}` : '-';
            selectedGuarantor2 = acc.guarantor2Member ? `${acc.guarantor2Member.firstName} ${acc.guarantor2Member.lastName}` : '-';
            selectedSecurity = acc.securityDetails || '-';
        }
    }

    const applicantSavingAccounts = savingAccounts.filter(s => s.memberID === currentApplicantMemberId && (s.status === 'Active' || !s.status));
    const otherSavingAccounts = savingAccounts.filter(s => s.memberID !== currentApplicantMemberId && (s.status === 'Active' || !s.status));

    const totalDeductionsAmount = deductions.reduce((sum, d) => sum + (parseFloat(d.amount as any) || 0), 0);
    const isExceedingPendingLimit = Boolean((formData.disbursementAmount || 0) > (pendingSanctionedLimit > 0 ? pendingSanctionedLimit : (formData.sanctionedAmount || 0)));

    // KPI Metrics calculation
    const totalDisbursementsCount = disbursements.length;
    const totalSanctionedSum = disbursements.reduce((s, d) => s + (d.sanctionedAmount || 0), 0);
    const totalDisbursedSum = disbursements.reduce((s, d) => s + (d.disbursementAmount || 0), 0);
    const totalNetPaidSum = disbursements.reduce((s, d) => s + (d.netAmountPaid || 0), 0);

    return (
        <div ref={formContainerRef} className="p-3 max-w-7xl mx-auto space-y-3 font-sans text-xs">
            
            {/* ========================================================================= */}
            {/* TOP ERP HEADER CARD (Matching LoanApplicationMaster.tsx)                   */}
            {/* ========================================================================= */}
            <div className="bg-white p-3 sm:p-4 rounded-sm shadow-xs border border-gray-200 border-b-2 border-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded shrink-0">
                        <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                                कर्ज वितरण / वाटप (Loan Disbursement Master)
                            </h1>
                            <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                                CBS Core
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                            मंजूर कर्ज अर्जावरून कर्ज वाटप (Single & Multi-Tranche), कपाती (Deductions) व व्हाऊचर ऑटो-जनरेशन
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    <button
                        type="button"
                        onClick={handleResetForm}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>+ नवीन वाटप</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            fetchData();
                            setShowListModal(true);
                        }}
                        className="px-3.5 py-1.5 bg-primary hover:opacity-90 text-white rounded-sm text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="सर्व नोंदवलेली कर्ज वाटप यादी पॉप-अप मध्ये पहा"
                    >
                        <Layers className="w-4 h-4" />
                        <span>📋 नोंदवलेले वाटप पहा ({disbursements.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => { fetchData(); fetchDropdowns(); }}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-sm cursor-pointer transition"
                        title="रिफ्रेश करा"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* SUMMARY KPI CARDS (Matching LoanApplicationMaster.tsx)                     */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
                    <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded">
                        <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण कर्ज वाटप</div>
                        <div className="text-sm font-black text-gray-900">{totalDisbursementsCount}</div>
                    </div>
                </div>

                <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                        <IndianRupee className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण मंजूर मर्यादा</div>
                        <div className="text-sm font-black text-emerald-800">₹{totalSanctionedSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>

                <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                        <Banknote className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण प्रत्यक्ष वाटप</div>
                        <div className="text-sm font-black text-indigo-950">₹{totalDisbursedSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>

                <div className="bg-white p-2.5 rounded-sm border border-slate-200 shadow-xs flex items-center gap-2.5">
                    <div className="p-2 bg-amber-50 text-amber-700 border border-amber-200 rounded">
                        <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">एकूण निव्वळ प्रदान</div>
                        <div className="text-sm font-black text-amber-800">₹{totalNetPaidSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                </div>
            </div>

            {/* Alert Messages (Matching LoanApplicationMaster.tsx) */}
            {errorMessage && (
                <div className="mb-3 p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs animate-in fade-in duration-150">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="flex-1">{errorMessage}</span>
                    <button onClick={() => setErrorMessage('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
                </div>
            )}

            {successMessage && (
                <div className="mb-3 p-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm flex items-center gap-2 text-xs font-bold shadow-2xs animate-in fade-in duration-150">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="flex-1">{successMessage}</span>
                    <button onClick={() => setSuccessMessage('')} className="font-bold text-gray-400 hover:text-gray-600 text-sm cursor-pointer">×</button>
                </div>
            )}

            {editingId && (
                <div className="mb-3 p-2.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-sm flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                        <span className="animate-pulse text-sm">✏️</span>
                        <span className="font-bold text-xs">
                            संपादन मोड चालू: कर्ज वितरण क्रमांक <strong>#{editingId}</strong> चे बदल करत आहात.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={handleResetForm}
                        className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-sm font-bold text-[11px] transition shadow-2xs cursor-pointer"
                    >
                        ❌ संपादन रद्द करा (Cancel Edit)
                    </button>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MAIN WORKSPACE: FORM & ON-DEMAND LIVE SCHEDULE / SUMMARY                  */}
            {/* ========================================================================= */}
            <div className="flex flex-col lg:flex-row gap-3 items-start">
                
                {/* Main Form Container - Full Width when schedule is hidden */}
                <div 
                    className={`${showSchedule ? 'w-full lg:w-7/12' : 'w-full'} bg-white p-3.5 sm:p-4 rounded-sm shadow-xs border space-y-3 transition-all duration-300 ${
                        editingId ? 'border-primary ring-2 ring-primary/20 bg-blue-50/20' : 'border-gray-200'
                    }`}
                >
                    <form onSubmit={handleSubmit} className="space-y-3">
                        
                        {/* Section 1: कर्ज स्त्रोत व खाते निवड (Matching Section 1 in LoanApplicationMaster) */}
                        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
                            <div className="flex items-center justify-between border-b border-gray-200 pb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <UserCheck className="w-4 h-4 text-primary" />
                                    <h2 className="text-xs font-bold text-primary">१. कर्ज स्त्रोत व खाते निवड (Loan Source & Account Details)</h2>
                                </div>
                                {alreadyDisbursedAmount > 0 && (
                                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-mono">
                                        टप्पा क्र. {currentTrancheNo} वाटप (Multi-Tranche)
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                                <div>
                                    <label className={labelClass}>वितरण दिनांक (Date) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="date" 
                                        name="disbursementDate" 
                                        value={formData.disbursementDate || ''} 
                                        onChange={(e) => setFormData(p => ({ ...p, disbursementDate: e.target.value }))} 
                                        required 
                                        className={inputClass} 
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>वितरण प्रकार (Type) <span className="text-red-500">*</span></label>
                                    <select 
                                        value={sourceType} 
                                        onChange={(e) => {
                                            setSourceType(e.target.value as any);
                                            setSelectedSourceId('');
                                            setAlreadyDisbursedAmount(0);
                                            setPendingSanctionedLimit(0);
                                            setCurrentTrancheNo(1);
                                        }}
                                        disabled={!!editingId}
                                        className={inputClass}
                                    >
                                        <option value="Application">मंजूर अर्जावरून (From Sanctioned App)</option>
                                        <option value="Draft">नवीन मसुदा (New Draft)</option>
                                        <option value="ExistingAccount">विद्यमान खात्यात (Existing Account)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>शाखा (Branch) <span className="text-red-500">*</span></label>
                                    <select 
                                        value={selectedBranchId} 
                                        onChange={(e) => setSelectedBranchId(parseInt(e.target.value, 10))}
                                        disabled={sourceType === 'ExistingAccount' || hasGlobalBranch}
                                        className={inputClass}
                                    >
                                        {branches.map(b => (
                                            <option key={b.branchID} value={b.branchID}>{b.branchName}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        {sourceType === 'Application' ? 'मंजूर अर्ज निवडा' : 'कर्ज खाते निवडा'} <span className="text-red-500">*</span>
                                    </label>
                                    {sourceType === 'Draft' ? (
                                        <input 
                                            type="text" 
                                            value={draftApplication ? `मसुदा: ₹${draftApplication.requestedAmount}` : 'कोणताही मसुदा उपलब्ध नाही'} 
                                            readOnly 
                                            className={`${inputClass} bg-slate-100 font-bold`} 
                                        />
                                    ) : (
                                        <SearchableSelect 
                                            options={sourceType === 'Application' 
                                                ? applications.map(a => {
                                                    const mem = a.member;
                                                    const name = mem ? `${mem.firstName} ${mem.lastName}` : '';
                                                    const cif = mem?.cifNo ? ` [CIF: ${mem.cifNo}]` : '';
                                                    const trancheTag = (a.disbursementCount || 0) > 0 
                                                        ? ` [टप्पा ${(a.disbursementCount || 0) + 1} | शिल्लक: ₹${(a.pendingSanctionedAmount || 0).toLocaleString('en-IN')}]` 
                                                        : ` - मंजूर: ₹${(a.requestedAmount || 0).toLocaleString('en-IN')}`;
                                                    return { 
                                                        value: a.loanApplicationID.toString(), 
                                                        label: `${name} (${a.applicationNo || a.loanApplicationID})${trancheTag}${cif}` 
                                                    };
                                                })
                                                : accounts.map(a => {
                                                    const mem = a.member;
                                                    const name = mem ? `${mem.firstName} ${mem.lastName}` : '';
                                                    const cif = mem?.cifNo ? ` [CIF: ${mem.cifNo}]` : '';
                                                    const accDisbursed = disbursements.filter(d => d.loanAccountID === a.loanAccountID).reduce((s, d) => s + (d.disbursementAmount || 0), 0);
                                                    const pending = Math.max(0, (a.sanctionedAmount || 0) - accDisbursed);
                                                    return { 
                                                        value: a.loanAccountID.toString(), 
                                                        label: `${name} (${a.loanAccountNo}) - ${a.loanRate?.shortName || a.loanRate?.loanType || ''} - मंजूर: ₹${(a.sanctionedAmount || 0).toLocaleString('en-IN')} | शिल्लक: ₹${pending.toLocaleString('en-IN')}${cif}` 
                                                    };
                                                })
                                            }
                                            value={selectedSourceId.toString()} 
                                            onChange={handleSourceSelection} 
                                            placeholder="-- अर्ज किंवा खाते निवडा --" 
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Selected Member Profile Card with Centered Name (Matching LoanApplicationMaster.tsx) */}
                            {selectedSourceId ? (
                                <div className="p-2 bg-primary/5 border border-primary/20 rounded-sm text-[10px] space-y-1 text-gray-800 font-medium">
                                    <div className="flex flex-wrap justify-between items-center gap-1 border-b border-primary/10 pb-1">
                                        <span><b>CIF No:</b> <span className="font-mono">{selectedCif || '-'}</span></span>
                                        <span><b>खाते / अर्ज क्र.:</b> <span className="font-mono font-bold text-gray-900">{selectedAccountNo}</span></span>
                                        <span><b>कर्ज योजना:</b> <span className="font-bold text-primary">{selectedLoanType}</span></span>
                                    </div>
                                    <div className="text-center pt-0.5 text-xs font-bold text-gray-900">
                                        <span className="text-gray-600 font-medium">कर्जदार सभासद नाव: </span>
                                        <span className="text-primary font-black text-sm">
                                            {selectedName}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap justify-between items-center gap-1 border-t border-primary/10 pt-1 text-[10px] text-gray-600">
                                        <span><b>जामीनदार १:</b> {selectedGuarantor1}</span>
                                        <span><b>जामीनदार २:</b> {selectedGuarantor2}</span>
                                        <span><b>तारण:</b> {selectedSecurity}</span>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Section 2: वाटप मर्यादा व मल्टी-टप्पा प्रगती (Matching Section 2 in LoanApplicationMaster) */}
                        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
                            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                                <Percent className="w-4 h-4 text-primary" />
                                <h2 className="text-xs font-bold text-primary">२. कर्ज वाटप मर्यादा व रक्कम (Disbursement Limits & Tranches)</h2>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="bg-slate-50 p-2 rounded-sm border border-slate-200">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase">मंजूर मर्यादा</div>
                                    <div className="text-xs font-bold text-gray-800 font-mono mt-0.5">
                                        ₹{(formData.sanctionedAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </div>
                                </div>

                                <div className="bg-amber-50 p-2 rounded-sm border border-amber-200">
                                    <div className="text-[10px] font-bold text-amber-800 uppercase">यापूर्वीचे वाटप</div>
                                    <div className="text-xs font-bold text-amber-900 font-mono mt-0.5">
                                        ₹{alreadyDisbursedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-2 rounded-sm border border-blue-300">
                                    <div className="text-[10px] font-bold text-blue-900 uppercase">शिल्लक मंजुरी मर्यादा</div>
                                    <div className="text-xs font-black text-blue-900 font-mono mt-0.5">
                                        ₹{pendingSanctionedLimit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </div>
                                </div>

                                <div className={`p-2 rounded-sm border ${isExceedingPendingLimit ? 'bg-red-50 border-red-400' : 'bg-emerald-50 border-emerald-300'}`}>
                                    <label className="text-[10px] font-bold text-emerald-900 uppercase block mb-0.5">सध्याचे वाटप <span className="text-red-500">*</span></label>
                                    <input 
                                        type="number" 
                                        name="disbursementAmount" 
                                        value={formData.disbursementAmount || ''} 
                                        max={pendingSanctionedLimit > 0 ? pendingSanctionedLimit : (formData.sanctionedAmount || 0)}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                            setFormData(p => ({ ...p, disbursementAmount: val }));
                                        }}
                                        onFocus={(e) => e.target.select()} 
                                        required 
                                        min="1" 
                                        className={`w-full text-xs font-black font-mono px-2 py-0.5 rounded-sm border focus:outline-none ${
                                            isExceedingPendingLimit 
                                                ? 'border-red-500 bg-white text-red-700 ring-2 ring-red-300' 
                                                : 'border-emerald-500 bg-white text-emerald-900'
                                        }`} 
                                    />
                                </div>
                            </div>

                            {isExceedingPendingLimit && (
                                <div className="p-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-sm font-bold text-[11px] flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                    <span>वाटप रक्कम (₹{(formData.disbursementAmount || 0).toLocaleString('en-IN')}) ही शिल्लक मंजूर मर्यादेपेक्षा (₹{pendingSanctionedLimit.toLocaleString('en-IN')}) जास्त असू शकत नाही!</span>
                                </div>
                            )}

                            {/* Multi-Tranche Progress Bar */}
                            {formData.sanctionedAmount ? (
                                <div className="p-2 bg-gray-50 rounded-sm border border-gray-200 text-[11px]">
                                    <div className="flex justify-between items-center text-gray-600 font-bold mb-1">
                                        <span>कर्ज वाटप प्रगती (Disbursement Progress)</span>
                                        <span className="font-mono font-bold text-primary">
                                            {Math.min(100, Math.round(((alreadyDisbursedAmount + (formData.disbursementAmount || 0)) / (formData.sanctionedAmount || 1)) * 100))}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden flex">
                                        <div 
                                            className="bg-amber-500 h-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, ((alreadyDisbursedAmount) / (formData.sanctionedAmount || 1)) * 100)}%` }}
                                            title={`मागील वाटप: ₹${alreadyDisbursedAmount}`}
                                        />
                                        <div 
                                            className="bg-emerald-500 h-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, ((formData.disbursementAmount || 0) / (formData.sanctionedAmount || 1)) * 100)}%` }}
                                            title={`आजचे वाटप: ₹${formData.disbursementAmount}`}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-medium">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> मागील वाटप
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> आजचे वाटप
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> उर्वरित शिल्लक
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Section 3: कपाती, शेअर्स व पेमेंट तपशील (Matching Section 1 & 2 with top primary border) */}
                        <div className="bg-white p-3.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2.5">
                            <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1.5">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                                <h2 className="text-xs font-bold text-primary">३. कपाती, शेअर्स व पेमेंट तपशील (Deductions, Shares & Payment Mode)</h2>
                            </div>

                            {/* Deductions Quick Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                                <div>
                                    <label className={labelClass}>शेअर्स कपात (%)</label>
                                    <input 
                                        type="number" 
                                        value={sharePercent || ''} 
                                        onChange={(e) => setSharePercent(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)} 
                                        onFocus={(e) => e.target.select()} 
                                        step="0.01" 
                                        min="0"
                                        className={inputClass} 
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>एकूण कपात (Total Deductions)</label>
                                    <input 
                                        type="text" 
                                        disabled 
                                        value={`₹${totalDeductionsAmount.toFixed(2)}`} 
                                        className={`${inputClass} bg-red-50 text-red-700 font-bold font-mono border-red-200`} 
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-emerald-800 mb-0.5">
                                        निव्वळ अदा रक्कम (Net Paid) *
                                    </label>
                                    <input 
                                        type="text" 
                                        disabled 
                                        value={`₹${(formData.netAmountPaid || 0).toFixed(2)}`} 
                                        className={`${inputClass} bg-emerald-50 text-emerald-800 font-black font-mono text-sm border-2 border-emerald-500`} 
                                    />
                                </div>
                            </div>

                            {/* Dynamic Deduction Rows Table */}
                            <div className="bg-slate-50/50 border border-gray-200 rounded-sm p-2.5">
                                <div className="flex justify-between items-center mb-2 border-b border-gray-200 pb-1.5">
                                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <Receipt className="w-3.5 h-3.5 text-primary" />
                                        कपातींची यादी (Deductions List)
                                    </span>
                                    <button 
                                        type="button" 
                                        onClick={addDeductionRow} 
                                        className="text-primary hover:text-blue-900 flex items-center gap-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-sm cursor-pointer transition shadow-2xs"
                                    >
                                        <Plus className="w-3 h-3" /> + कपात जोडा
                                    </button>
                                </div>

                                {deductions.map((deduction, index) => (
                                    <div key={index} className="flex gap-2 items-center mb-1.5 animate-fadeIn">
                                        <div className="flex-1">
                                            <SearchableSelect 
                                                options={allLedgers.map(l => ({ value: l.ledgerID.toString(), label: `${l.ledgerID} - ${l.ledgerName}` }))}
                                                value={deduction.ledgerID ? deduction.ledgerID.toString() : ''}
                                                onChange={(e: any) => handleDeductionChange(index, 'ledgerID', parseInt(e.target.value, 10))}
                                                placeholder="-- खाते (Ledger) निवडा --" 
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <input 
                                                type="number" 
                                                value={deduction.amount || ''} 
                                                onChange={(e) => handleDeductionChange(index, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                                onFocus={(e) => e.target.select()}
                                                placeholder="रक्कम ₹" 
                                                required 
                                                min="0"
                                                className={`${inputClass} text-red-600 font-bold font-mono`} 
                                            />
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeDeductionRow(index)} 
                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition cursor-pointer"
                                            title="कपात हटवा"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}

                                {deductions.length === 0 && (
                                    <div className="text-center text-gray-400 text-[11px] py-1.5">
                                        कोणतीही कपात जोडलेली नाही. वरून '+ कपात जोडा' बटणावर क्लिक करा.
                                    </div>
                                )}
                            </div>

                            {/* Auto Share Allocation Card */}
                            {(() => {
                                const shareDeductionItem = deductions.find(d => {
                                    const name = (d.ledgerName || allLedgers.find(l => l.ledgerID === d.ledgerID)?.ledgerName || '').toLowerCase();
                                    return name.includes('share') || name.includes('भाग') || name.includes('शेअर');
                                });
                                
                                const shareAmt = shareDeductionItem ? (parseFloat(shareDeductionItem.amount as any) || 0) : 0;
                                const qty = Math.floor(shareAmt / 100);
                                const applicantId = getCurrentApplicantMemberId();
                                const applicantMember = (applications.find(a => a.loanApplicationID === selectedSourceId)?.member) || (accounts.find(a => a.loanAccountID === selectedSourceId)?.member) || (draftApplication?.member);
                                
                                if (shareAmt <= 0 || qty <= 0) return null;

                                const certNo = nextShareConfig.nextCertificateNo || `CERT-${new Date().getFullYear()}-00001`;
                                const fromNo = nextShareConfig.nextFromShareNo || 1;
                                const toNo = fromNo + qty - 1;

                                return (
                                    <div className="p-2.5 bg-blue-50/90 border border-blue-200 rounded-sm text-xs shadow-2xs animate-fadeIn">
                                        <div className="font-bold text-blue-900 border-b border-blue-200 pb-1 mb-1.5 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Percent className="w-3.5 h-3.5 text-blue-700" />
                                                ✨ ऑटो शेअर कपात वाटप तपशील (Auto Share Allocation)
                                            </span>
                                            <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-mono font-bold">
                                                ₹{shareAmt.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                                            <div className="bg-white p-1.5 rounded-sm border border-blue-100">
                                                <div className="text-gray-500 text-[10px] font-semibold">सभासद क्रमांक (Member Code)</div>
                                                <div className="font-bold text-blue-950 mt-0.5 truncate flex items-center gap-1">
                                                    {applicantMember?.memberCode && !applicantMember.memberCode.startsWith('TEMP') ? (
                                                        <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold shadow-2xs">
                                                            ★ {applicantMember.memberCode}
                                                        </span>
                                                    ) : (
                                                        <span className="text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold shadow-2xs" title="कर्ज वाटप सेव्ह होताच हा अधिकृत सभासद क्रमांक मिळेल">
                                                            ★ {nextShareConfig.nextMemberCode || 'MEM000X'} <span className="text-[9px] font-normal text-blue-600">(Auto)</span>
                                                        </span>
                                                    )}
                                                    {applicantMember ? (
                                                        <span className="text-gray-700 font-medium text-[11px] truncate">
                                                            ({applicantMember.firstName} {applicantMember.lastName})
                                                        </span>
                                                    ) : applicantId ? (
                                                        <span className="text-gray-500 text-[10px]">#{applicantId}</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="bg-white p-1.5 rounded-sm border border-blue-100">
                                                <div className="text-gray-500 text-[10px] font-semibold">शेअर्सची संख्या</div>
                                                <div className="font-bold text-emerald-700 mt-0.5">{qty} शेअर्स (₹100 दर)</div>
                                            </div>
                                            <div className="bg-white p-1.5 rounded-sm border border-blue-100">
                                                <div className="text-gray-500 text-[10px] font-semibold">सर्टिफिकेट क्र. [Auto]</div>
                                                <div className="font-mono font-bold text-indigo-700 mt-0.5">{certNo}</div>
                                            </div>
                                            <div className="bg-white p-1.5 rounded-sm border border-blue-100">
                                                <div className="text-gray-500 text-[10px] font-semibold">शेअर्स नं. पासून</div>
                                                <div className="font-mono font-bold text-gray-800 mt-0.5">{fromNo}</div>
                                            </div>
                                            <div className="bg-white p-1.5 rounded-sm border border-blue-100">
                                                <div className="text-gray-500 text-[10px] font-semibold">शेअर्स नं. पर्यंत</div>
                                                <div className="font-mono font-bold text-gray-800 mt-0.5">{toNo}</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Payment Mode Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2 border-t border-gray-200">
                                <div>
                                    <label className={labelClass}>पेमेंट पद्धत (Mode) <span className="text-red-500">*</span></label>
                                    <select 
                                        name="paymentMode" 
                                        value={formData.paymentMode} 
                                        onChange={(e) => setFormData(p => ({ ...p, paymentMode: e.target.value }))}
                                        className={inputClass}
                                    >
                                        <option value="Cash">Cash (रोख)</option>
                                        <option value="Bank">Bank Transfer (बँक वर्ग)</option>
                                        <option value="Cheque">Cheque (धनादेश)</option>
                                        <option value="Saving Transfer">Saving Transfer (बचत खाते वर्ग)</option>
                                    </select>
                                </div>

                                {formData.paymentMode === 'Cash' && (
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>रोख खाते (Cash Ledger)</label>
                                        <CashLedgerReflectBadge 
                                            transactionType="Disbursement" 
                                            customTitle="कर्ज वितरण रोख खाते (Disbursement Cash Ledger)"
                                        />
                                    </div>
                                )}

                                {formData.paymentMode === 'Bank' && (
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>बँक खाते (Bank A/c) <span className="text-red-500">*</span></label>
                                        <select 
                                            name="bankAccountLedgerID" 
                                            value={formData.bankAccountLedgerID || ''} 
                                            onChange={(e) => setFormData(p => ({ ...p, bankAccountLedgerID: parseInt(e.target.value, 10) }))}
                                            className={inputClass} 
                                            required
                                        >
                                            <option value="">-- बँक खाते निवडा --</option>
                                            {bankLedgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                                        </select>
                                    </div>
                                )}

                                {formData.paymentMode === 'Cheque' && (
                                    <>
                                        <div>
                                            <label className={labelClass}>बँक खाते (Bank A/c) <span className="text-red-500">*</span></label>
                                            <select 
                                                name="bankAccountLedgerID" 
                                                value={formData.bankAccountLedgerID || ''} 
                                                onChange={(e) => setFormData(p => ({ ...p, bankAccountLedgerID: parseInt(e.target.value, 10) }))}
                                                className={inputClass} 
                                                required
                                            >
                                                <option value="">-- बँक खाते निवडा --</option>
                                                {bankLedgers.map(l => <option key={l.ledgerID} value={l.ledgerID}>{l.ledgerName}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>चेक नंबर (Cheque No)</label>
                                            <input 
                                                type="text" 
                                                name="chequeNo" 
                                                value={formData.chequeNo || ''} 
                                                onChange={(e) => setFormData(p => ({ ...p, chequeNo: e.target.value }))} 
                                                placeholder="उदा. 123456"
                                                className={inputClass} 
                                            />
                                        </div>
                                    </>
                                )}

                                {formData.paymentMode === 'Saving Transfer' && (
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>सेव्हिंग खाते नंबर (Saving A/C No) <span className="text-red-500">*</span></label>
                                        <select 
                                            name="transferToSavingAccountNo" 
                                            value={formData.transferToSavingAccountNo || ''} 
                                            onChange={(e) => setFormData(p => ({ ...p, transferToSavingAccountNo: e.target.value }))} 
                                            className={inputClass}
                                            required
                                        >
                                            <option value="">-- सेव्हिंग खाते निवडा --</option>
                                            {applicantSavingAccounts.length > 0 && (
                                                <optgroup label="⭐ अर्जदाराचे सेव्हिंग खाते (Applicant's Accounts)">
                                                    {applicantSavingAccounts.map(s => (
                                                        <option key={s.savingAccountID} value={s.accountNo}>
                                                            {s.accountNo} - {s.memberName || 'Member'} (शिल्लक: ₹{(s.currentBalance || 0).toLocaleString('en-IN')})
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            )}
                                            <optgroup label="📋 इतर सर्व सेव्हिंग खाती (All Other Accounts)">
                                                {otherSavingAccounts.map(s => (
                                                    <option key={s.savingAccountID} value={s.accountNo}>
                                                        {s.accountNo} - {s.memberName || 'Member'} (शिल्लक: ₹{(s.currentBalance || 0).toLocaleString('en-IN')})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className={labelClass}>शेरा / टिप (Remarks)</label>
                                <input 
                                    type="text" 
                                    value={formData.remarks || ''} 
                                    onChange={(e) => setFormData(p => ({ ...p, remarks: e.target.value }))} 
                                    placeholder="कर्ज वाटपाबाबत विशेष शेरा..." 
                                    className={inputClass} 
                                />
                            </div>
                        </div>

                        {/* Form Action Buttons Bar (Matching LoanApplicationMaster.tsx) */}
                        <div className="pt-2 flex flex-wrap justify-between items-center gap-2 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowListModal(true)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5"
                                >
                                    <Layers className="w-3.5 h-3.5 text-slate-600" />
                                    <span>कर्ज वाटप यादी ({disbursements.length})</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!showSchedule) {
                                            calculateSchedule();
                                        } else {
                                            setShowSchedule(false);
                                        }
                                    }}
                                    className={`px-3 py-1.5 font-bold rounded-sm text-xs border cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all ${
                                        showSchedule 
                                            ? 'bg-primary text-white border-primary shadow-xs' 
                                            : 'bg-primary/10 hover:bg-primary/20 text-primary border-primary/20'
                                    }`}
                                    title={showSchedule ? "वेळापत्रक पत्रक व गोषवारा लपवा" : "हप्ता वेळापत्रक पत्रक व गोषवारा उघडा"}
                                >
                                    <Calculator className="w-3.5 h-3.5" />
                                    <span>{showSchedule ? 'पत्रक व गोषवारा लपवा' : '📊 वेळापत्रक व गोषवारा'}</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleResetForm}
                                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>{editingId ? 'संपादन रद्द करा' : 'नवीन फॉर्म (Reset)'}</span>
                                </button>

                                <button
                                    type="submit"
                                    disabled={isSaving || isExceedingPendingLimit}
                                    className={`px-6 py-1.5 ${
                                        editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:opacity-90'
                                    } text-white font-bold rounded-sm text-xs shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer transition-all`}
                                >
                                    <Save className="w-4 h-4" />
                                    <span>
                                        {isSaving
                                            ? 'जतन होत आहे...'
                                            : editingId
                                            ? 'बदल सेव्ह करा (Update)'
                                            : `वितरण सेव्ह करा (${alreadyDisbursedAmount > 0 ? `टप्पा ${currentTrancheNo}` : 'Save & Disburse'})`}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Right Live Installment Schedule & Summary Panel (Matching LoanApplicationMaster.tsx showSchedule toggle) */}
                {showSchedule && (
                    <div className="w-full lg:w-5/12 bg-white p-3.5 rounded-sm shadow-xs border border-gray-200 border-t-2 border-primary sticky top-2 min-h-[480px] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-2">
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setScheduleTab('summary')}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                        scheduleTab === 'summary' 
                                            ? 'bg-primary text-white shadow-2xs' 
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    📋 वितरण गोषवारा
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setScheduleTab('schedule');
                                        if (scheduleData.length === 0) calculateSchedule();
                                    }}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                        scheduleTab === 'schedule' 
                                            ? 'bg-primary text-white shadow-2xs' 
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    📊 हप्ता वेळापत्रक ({scheduleData.length})
                                </button>
                            </div>
                            
                            <button
                                type="button"
                                onClick={() => setShowSchedule(false)}
                                className="text-gray-400 hover:text-gray-700 hover:bg-slate-100 p-1 rounded-sm transition-colors cursor-pointer"
                                title="पत्रक लपवा (Hide Panel)"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Mini Summary Banner on Top */}
                        <div className="grid grid-cols-3 gap-1 text-[10px] bg-primary/5 p-2 rounded-sm border border-primary/20 mb-2">
                            <div>
                                <span className="text-gray-500 block">सध्याचे वाटप:</span>
                                <span className="font-bold text-gray-900 font-mono">₹{(formData.disbursementAmount || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">निव्वळ अदा:</span>
                                <span className="font-bold text-emerald-700 font-mono">₹{(formData.netAmountPaid || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                                <span className="text-gray-500 block">व्याज दर:</span>
                                <span className="font-bold text-indigo-900 font-mono">{newAccountData.interestRate || 12}% p.a.</span>
                            </div>
                        </div>

                        {/* TAB 1: Live EMI Repayment Schedule */}
                        {scheduleTab === 'schedule' && (
                            <div className="flex-1 flex flex-col">
                                {scheduleData.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400 bg-slate-50/50 rounded border border-dashed border-gray-200">
                                        <Calculator className="w-8 h-8 text-gray-300 mb-2 stroke-[1.5]" />
                                        <p className="text-xs font-semibold text-gray-600">हप्ता पत्रक तयार करण्यासाठी डावीकडील कर्ज वाटप रक्कम भरा.</p>
                                        <button
                                            type="button"
                                            onClick={calculateSchedule}
                                            className="mt-3 px-3 py-1 bg-primary text-white rounded-sm text-[11px] font-bold shadow-2xs hover:opacity-90 cursor-pointer"
                                        >
                                            📊 वेळापत्रक लोड करा
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-auto max-h-[58vh] border border-gray-200 rounded-sm">
                                        <table className="w-full text-left border-collapse text-[10px]">
                                            <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                                                <tr>
                                                    <th className="p-1.5 border-r border-gray-200 text-center w-8">क्र.</th>
                                                    <th className="p-1.5 border-r border-gray-200 text-center">हप्ता दिनांक</th>
                                                    <th className="p-1.5 border-r border-gray-200 text-right">मुद्दल (₹)</th>
                                                    <th className="p-1.5 border-r border-gray-200 text-right">व्याज (₹)</th>
                                                    <th className="p-1.5 border-r border-gray-200 text-right">एकूण (₹)</th>
                                                    <th className="p-1.5 text-right">बाकी शिल्लक (₹)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white font-mono">
                                                {scheduleData.map((row, i) => (
                                                    <tr key={i} className="hover:bg-primary/5 transition-colors">
                                                        <td className="p-1.5 border-r border-gray-200 text-center font-bold text-gray-700">{row.instNo}</td>
                                                        <td className="p-1.5 border-r border-gray-200 text-center text-gray-600">
                                                            {row.dueDate || '-'}
                                                        </td>
                                                        <td className="p-1.5 border-r border-gray-200 text-right text-gray-800">{Math.round(row.principal || 0).toLocaleString('en-IN')}</td>
                                                        <td className="p-1.5 border-r border-gray-200 text-right text-rose-700">{Math.round(row.interest || 0).toLocaleString('en-IN')}</td>
                                                        <td className="p-1.5 border-r border-gray-200 text-right font-bold text-emerald-800">{Math.round(row.total || 0).toLocaleString('en-IN')}</td>
                                                        <td className="p-1.5 text-right text-gray-700">{Math.round(row.balance || 0).toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: Disbursement Live Summary Breakdown */}
                        {scheduleTab === 'summary' && (
                            <div className="space-y-2.5 text-xs">
                                {selectedSourceId ? (
                                    <>
                                        {/* Member Profile Box */}
                                        <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-sm">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase">कर्जदार सभासद नाव</div>
                                            <div className="font-black text-sm text-primary mt-0.5">{selectedName}</div>
                                            <div className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1.5 font-medium">
                                                <span>{selectedLoanType}</span>
                                                <span>•</span>
                                                <span className="font-mono text-gray-800 font-bold">{selectedAccountNo}</span>
                                            </div>
                                            {alreadyDisbursedAmount > 0 && (
                                                <div className="text-[10px] text-amber-900 font-bold mt-1.5 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-sm">
                                                    टप्पा क्र. {currentTrancheNo} वाटप प्रक्रिया
                                                </div>
                                            )}
                                        </div>

                                        {/* Financial Details Table */}
                                        <div className="bg-slate-50/80 p-2.5 rounded-sm border border-slate-200 space-y-1.5 text-[11px]">
                                            <div className="flex justify-between items-center text-gray-700">
                                                <span>एकूण मंजूर मर्यादा:</span>
                                                <span className="font-bold font-mono">₹{(formData.sanctionedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>

                                            {alreadyDisbursedAmount > 0 && (
                                                <div className="flex justify-between items-center text-amber-800">
                                                    <span>यापूर्वीचे वाटप:</span>
                                                    <span className="font-bold font-mono">₹{alreadyDisbursedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center text-primary border-t border-slate-200 pt-1">
                                                <span className="font-semibold">सध्याचे वाटप रक्कम:</span>
                                                <span className="font-black font-mono text-xs">₹{(formData.disbursementAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-emerald-800 border-t border-slate-200 pt-1">
                                                <span className="font-semibold">या वाटपानंतर एकूण वाटप:</span>
                                                <span className="font-bold font-mono">₹{(alreadyDisbursedAmount + (formData.disbursementAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>

                                            <div className="flex justify-between items-center text-gray-600">
                                                <span>उर्वरित शिल्लक मंजुरी मर्यादा:</span>
                                                <span className="font-bold font-mono text-purple-800">
                                                    ₹{Math.max(0, (formData.sanctionedAmount || 0) - (alreadyDisbursedAmount + (formData.disbursementAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Deductions Summary */}
                                        <div className="p-2.5 bg-red-50/60 border border-red-200 rounded-sm">
                                            <div className="text-[10px] font-bold text-red-900 uppercase mb-1">कपाती तपशील (Deductions Breakdown)</div>
                                            {deductions.map((d, i) => (
                                                <div key={i} className="flex justify-between items-center text-[11px] mb-0.5 text-red-700">
                                                    <span>- {d.ledgerName || allLedgers.find(l => l.ledgerID === d.ledgerID)?.ledgerName || 'कपात खाते'}</span>
                                                    <span className="font-mono font-bold">₹{d.amount?.toFixed(2) || '0.00'}</span>
                                                </div>
                                            ))}
                                            {deductions.length === 0 && (
                                                <div className="text-[11px] text-gray-400 italic">कोणतीही कपात नाही.</div>
                                            )}
                                            <div className="flex justify-between items-center pt-1 mt-1 border-t border-red-200 font-bold text-red-900 text-xs">
                                                <span>एकूण कपात:</span>
                                                <span className="font-mono">₹{totalDeductionsAmount.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Net Payout Highlight Box */}
                                        <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-sm shadow-xs flex items-center justify-between">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                                                    निव्वळ हातात मिळणारी रक्कम
                                                </div>
                                                <div className="text-[11px] font-medium text-emerald-100">
                                                    (Net Amount Payable)
                                                </div>
                                            </div>
                                            <div className="text-xl font-black font-mono tracking-tight">
                                                ₹{(formData.netAmountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-12 text-center text-gray-400 space-y-2">
                                        <Banknote className="w-8 h-8 mx-auto text-gray-300" />
                                        <div className="text-xs font-semibold text-gray-500">गोषवारा पाहण्यासाठी कर्ज स्त्रोत व खाते निवडा.</div>
                                        <p className="text-[11px] text-gray-400">निवडलेल्या खात्याची मर्यादा व कपाती येथे थेट दिसतील.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* List Modal */}
            {showListModal && (
                <LoanDistributionListModal 
                    onClose={() => setShowListModal(false)} 
                    onEdit={handleEdit} 
                    onDelete={() => { fetchData(); fetchDropdowns(); }} 
                />
            )}
        </div>
    );
};

export default LoanDisbursementMaster;

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { 
    Landmark, CheckCircle2, AlertCircle, Calendar, UserCheck, 
    Search, BookOpen, ShieldCheck, RotateCcw, X, List, Percent, 
    IndianRupee, Edit2, Trash2, FileSpreadsheet, Plus, Layers, 
    CheckCircle, XCircle, Save, Calculator, UserPlus, Clock, 
    Sparkles, Eye, FileText, Banknote, RefreshCw, CreditCard, 
    Wallet, Receipt, ArrowRight, ChevronRight, Lock, Printer
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
    customerID?: number;
    customerId?: number;
    customer?: any;
}

interface LoanApplication {
    loanApplicationID: number;
    applicationNo: string;
    applicationDate: string;
    memberID?: number;
    customerID?: number;
    coCustomerID?: number | null;
    coCustomer2ID?: number | null;
    guarantor1CustomerID?: number | null;
    guarantor2CustomerID?: number | null;
    guarantor1Customer?: any;
    guarantor2Customer?: any;
    securityDetails?: string;
    securityValue?: number;
    requestedAmount: number;
    interestRate: number;
    durationMonths: number;
    installmentFrequency: string;
    status: string;
    customer?: any;
    coCustomer?: any;
    coCustomer2?: any;
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
    customerID?: number | null;
    memberID?: number | null;
    loanApplicationID?: number;
    coCustomerID?: number | null;
    coCustomer2ID?: number | null;
    guarantor1CustomerID?: number | null;
    guarantor2CustomerID?: number | null;
    guarantor1Customer?: any;
    guarantor2Customer?: any;
    securityDetails?: string;
    securityValue?: number;
    sanctionedAmount: number;
    interestRate: number;
    durationMonths: number;
    installmentFrequency: string;
    loanRateID?: number;
    customer?: any;
    coCustomer?: any;
    coCustomer2?: any;
    member?: Member;
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

export const format14DigitDisplay = (num?: string) => {
    if (!num) return '-';
    const clean = num.replace(/\D/g, '');
    if (clean.length === 14) {
        return `${clean.substring(0, 3)}-${clean.substring(3, 3)}-${clean.substring(6, 7)}-${clean.substring(13, 1)}`;
    }
    return num;
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
    const labelClass = "block text-[11px] font-bold text-gray-700 mb-1 truncate";
    const inputClass = "w-full text-[11px] border border-gray-300 rounded-sm px-2 py-1 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none bg-white text-gray-900 font-medium transition duration-150 h-[30px]";

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

                const autoDisbDate = draftApplication.applicationDate 
                    ? draftApplication.applicationDate.split('T')[0] 
                    : new Date().toISOString().split('T')[0];

                setFormData(prev => ({
                    ...prev,
                    disbursementDate: autoDisbDate,
                    sanctionedAmount: draftApplication.requestedAmount,
                    disbursementAmount: draftApplication.requestedAmount,
                    netAmountPaid: draftApplication.requestedAmount
                }));
                
                fetchCustomerShareBalance(draftApplication.customerID || draftApplication.customer?.customerID);

                setNewAccountData({
                    customerID: draftApplication.customerID || (draftApplication as any).customer?.customerID || null,
                    memberID: draftApplication.memberID,
                    coCustomerID: draftApplication.coCustomerID || null,
                    coCustomer2ID: draftApplication.coCustomer2ID || (draftApplication as any).coCustomer2ID || null,
                    guarantor1CustomerID: draftApplication.guarantor1CustomerID || null,
                    guarantor2CustomerID: draftApplication.guarantor2CustomerID || null,
                    securityDetails: draftApplication.securityDetails,
                    securityValue: draftApplication.securityValue,
                    loanRateID: draftApplication.loanRateID,
                    sanctionedAmount: draftApplication.requestedAmount,
                    interestRate: draftApplication.interestRate,
                    durationMonths: draftApplication.durationMonths,
                    noOfInstallments: draftApplication.noOfInstallments || 0,
                    installmentAmount: draftApplication.installmentAmount || 0,
                    installmentFrequency: draftApplication.installmentFrequency || 'मासिक',
                    openingDate: autoDisbDate,
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

                fetchCustomerShareBalance(draftApplication.customerID || draftApplication.customer?.customerID);

                setNewAccountData({
                    loanAccountID: editingDisbursement.loanAccountID,
                    customerID: draftApplication.customerID || (draftApplication as any).customer?.customerID || null,
                    memberID: draftApplication.memberID,
                    coCustomerID: draftApplication.coCustomerID || null,
                    coCustomer2ID: draftApplication.coCustomer2ID || (draftApplication as any).coCustomer2ID || null,
                    guarantor1CustomerID: draftApplication.guarantor1CustomerID || null,
                    guarantor2CustomerID: draftApplication.guarantor2CustomerID || null,
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
            const filteredBankLedgers = (ledgersRes.data || []).filter((l: any) => {
                if (!l) return false;
                const gId = l.groupID || l.accountGroupID || 0;
                const parentGId = l.accountGroup?.parentGroupID || 0;
                const gName = (l.accountGroup?.groupName || '').toLowerCase();
                const lName = (l.ledgerName || '').toLowerCase();
                const accType = (l.accountType || '').toLowerCase();

                return (
                    gId === 32 || gId === 33 || gId === 34 ||
                    parentGId === 32 ||
                    gName.includes('बँक') || gName.includes('bank') ||
                    gName.includes('करंट') || gName.includes('current') ||
                    gName.includes('चालू') || gName.includes('शिल्लक') ||
                    lName.includes('बँक') || lName.includes('bank') ||
                    lName.includes('करंट') || lName.includes('current') ||
                    lName.includes('चालू') ||
                    accType.includes('bank') || accType.includes('current')
                );
            });
            setBankLedgers(filteredBankLedgers);
            setAllLedgers(ledgersRes.data || []);
            setBranches(branchesRes.data || []);
            setSavingAccounts(savingAccsRes.data || []);
            return availableApps;
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCustomerShareBalance = async (customerId?: number) => {
        if (!customerId) return;
        try {
            // Strict Customer-First: exclusively query Customer360
            const res = await axios.get(`/api/Reports/Customer360/${customerId}`);
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

    const getCurrentApplicantCustomerId = () => {
        if (draftApplication) return draftApplication.customerID || draftApplication.customer?.customerID || 0;
        if (sourceType === 'Application' && selectedSourceId) {
            const app = applications.find(a => a.loanApplicationID === selectedSourceId);
            if (app) return app.customerID || app.customer?.customerID || 0;
        }
        if (sourceType === 'ExistingAccount' && selectedSourceId) {
            const acc = accounts.find(a => a.loanAccountID === selectedSourceId);
            if (acc) return acc.customerID || acc.customer?.customerID || 0;
        }
        return 0;
    };

    // Auto-select applicant's primary saving account when payment mode is Saving Transfer
    useEffect(() => {
        const applicantCustId = getCurrentApplicantCustomerId();
        if (formData.paymentMode === 'Saving Transfer' && applicantCustId && savingAccounts.length > 0) {
            const appAcc = savingAccounts.find(s => 
                s.customerID === applicantCustId && (s.status === 'Active' || !s.status)
            );
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
        let customerId = 0;
        let alreadyDisb = 0;
        let pendingLimit = 0;
        let trancheNo = 1;

        if (sourceType === 'Application') {
            const app = applications.find(a => a.loanApplicationID === id);
            if (app) {
                const autoDisbDate = app.applicationDate 
                    ? app.applicationDate.split('T')[0] 
                    : new Date().toISOString().split('T')[0];

                sancAmount = app.requestedAmount;
                memberId = app.memberID || 0;
                customerId = app.customerID || app.customer?.customerID || 0;
                
                alreadyDisb = app.totalDisbursedAmount || 0;
                pendingLimit = app.pendingSanctionedAmount !== undefined ? app.pendingSanctionedAmount : Math.max(0, sancAmount - alreadyDisb);
                trancheNo = (app.disbursementCount || 0) + 1;

                setAlreadyDisbursedAmount(alreadyDisb);
                setPendingSanctionedLimit(pendingLimit);
                setCurrentTrancheNo(trancheNo);

                setNewAccountData({
                    loanAccountID: app.linkedLoanAccountID,
                    loanApplicationID: app.loanApplicationID,
                    memberID: app.memberID || null,
                    customerID: app.customerID || app.customer?.customerID || null,
                    coCustomerID: app.coCustomerID || null,
                    coCustomer2ID: app.coCustomer2ID || null,
                    guarantor1CustomerID: app.guarantor1CustomerID || null,
                    guarantor2CustomerID: app.guarantor2CustomerID || null,
                    securityDetails: app.securityDetails,
                    securityValue: app.securityValue,
                    loanRateID: app.loanRateID,
                    sanctionedAmount: app.requestedAmount,
                    interestRate: app.interestRate,
                    durationMonths: app.durationMonths,
                    noOfInstallments: app.noOfInstallments || 0,
                    installmentAmount: app.installmentAmount || 0,
                    installmentFrequency: app.installmentFrequency || 'मासिक',
                    openingDate: autoDisbDate,
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
                    disbursementDate: autoDisbDate
                }));
            }
        } else {
            const acc = accounts.find(a => a.loanAccountID === id);
            if (acc) {
                sancAmount = acc.sanctionedAmount;
                memberId = acc.memberID || 0;
                customerId = acc.customerID || acc.customer?.customerID || 0;
                
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
                    memberID: acc.memberID || null,
                    customerID: acc.customerID || acc.customer?.customerID || null,
                    coCustomerID: acc.coCustomerID || null,
                    coCustomer2ID: acc.coCustomer2ID || null,
                    guarantor1CustomerID: acc.guarantor1CustomerID || null,
                    guarantor2CustomerID: acc.guarantor2CustomerID || null,
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

        fetchCustomerShareBalance(customerId);
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

    const handleExportScheduleExcel = () => {
        if (!scheduleData || scheduleData.length === 0) return;

        const data: any[][] = [
            ['कर्ज वाटप व हप्ता वेळापत्रक पत्रक (Disbursement & Live Schedule)'],
            ['खाते / अर्ज क्र.', selectedAccountNo || '-', 'वितरण दिनांक', formData.disbursementDate || '-'],
            ['कर्जदार सभासद', selectedName || '-', 'कर्ज योजना', selectedLoanType || '-'],
            ['मंजूर मर्यादा', formData.sanctionedAmount || 0, 'सध्याचे वाटप', formData.disbursementAmount || 0],
            ['निव्वळ अदा रक्कम', formData.netAmountPaid || 0, 'व्याज दर', `${newAccountData.interestRate || 12}%`],
            [],
            ['हप्ता क्र.', 'हप्ता दिनांक', 'मुद्दल (₹)', 'व्याज (₹)', 'एकूण हप्ता (₹)', 'बाकी शिल्लक (₹)']
        ];

        scheduleData.forEach((row) => {
            data.push([
                row.instNo,
                row.dueDate,
                Math.round(row.principal || 0),
                Math.round(row.interest || 0),
                Math.round(row.total || 0),
                Math.round(row.balance || 0)
            ]);
        });

        const totalPrin = scheduleData.reduce((acc, r) => acc + Math.round(r.principal || 0), 0);
        const totalInt = scheduleData.reduce((acc, r) => acc + Math.round(r.interest || 0), 0);
        const totalAll = scheduleData.reduce((acc, r) => acc + Math.round(r.total || 0), 0);

        data.push(['एकूण (Total)', '', totalPrin, totalInt, totalAll, '']);

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'वेळापत्रक');
        XLSX.writeFile(wb, `Loan_Disbursement_${selectedAccountNo || 'DISB'}.xlsx`);
    };

    const handlePrintSchedule = () => {
        if (!scheduleData || scheduleData.length === 0) return;
        const totalPrin = scheduleData.reduce((acc, r) => acc + Math.round(r.principal || 0), 0);
        const totalInt = scheduleData.reduce((acc, r) => acc + Math.round(r.interest || 0), 0);
        const totalAll = scheduleData.reduce((acc, r) => acc + Math.round(r.total || 0), 0);

        const printWin = window.open('', '_blank', 'width=850,height=900');
        if (!printWin) {
            alert('कृपया पॉपअप ब्लॉकर बंद करा.');
            return;
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>कर्ज वाटप वेळापत्रक - ${selectedAccountNo || 'DISB'}</title>
                <style>
                    @page { size: A4 portrait; margin: 15mm; }
                    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 10px; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 12px; }
                    .header h2 { margin: 0 0 4px 0; font-size: 18px; color: #047857; }
                    .header p { margin: 0; font-size: 12px; color: #555; }
                    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; border-radius: 4px; margin-bottom: 14px; }
                    .meta-item { font-size: 11px; }
                    .meta-item span { display: block; color: #64748b; font-size: 10px; }
                    .meta-item strong { font-size: 12px; color: #0f172a; }
                    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
                    th, td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 11px; }
                    th { background: #f1f5f9; font-weight: bold; text-align: center; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    tfoot tr td { font-weight: bold; background: #f8fafc; border-top: 2px solid #475569; }
                    .footer-sign { margin-top: 40px; display: flex; justify-content: space-between; padding: 0 30px; font-weight: bold; font-size: 11px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>कर्ज वाटप व हप्ता वेळापत्रक (Loan Disbursement Schedule)</h2>
                    <p>खाते / अर्ज क्र.: <strong>${selectedAccountNo || '-'}</strong> | वाटप दिनांक: <strong>${formData.disbursementDate || '-'}</strong></p>
                </div>
                <div class="meta-grid">
                    <div class="meta-item"><span>कर्जदार सभासद:</span><strong>${selectedName || '-'}</strong></div>
                    <div class="meta-item"><span>कर्ज योजना:</span><strong>${selectedLoanType || '-'}</strong></div>
                    <div class="meta-item"><span>मंजूर मर्यादा:</span><strong>₹${(formData.sanctionedAmount || 0).toLocaleString('en-IN')}</strong></div>
                    <div class="meta-item"><span>सध्याचे वाटप:</span><strong>₹${(formData.disbursementAmount || 0).toLocaleString('en-IN')}</strong></div>
                    <div class="meta-item"><span>निव्वळ प्रदान रक्कम:</span><strong>₹${(formData.netAmountPaid || 0).toLocaleString('en-IN')}</strong></div>
                    <div class="meta-item"><span>व्याज दर:</span><strong>${newAccountData.interestRate || 12}% p.a.</strong></div>
                    <div class="meta-item"><span>हप्ता रक्कम:</span><strong>₹${(newAccountData.installmentAmount || 0).toLocaleString('en-IN')}</strong></div>
                    <div class="meta-item"><span>हप्ते संख्या:</span><strong>${newAccountData.noOfInstallments || 12} हप्ते</strong></div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;">हप्ता</th>
                            <th>हप्ता दिनांक</th>
                            <th class="text-right">मुद्दल (₹)</th>
                            <th class="text-right">व्याज (₹)</th>
                            <th class="text-right">एकूण हप्ता (₹)</th>
                            <th class="text-right">बाकी शिल्लक (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${scheduleData.map(r => `
                            <tr>
                                <td class="text-center">${r.instNo}</td>
                                <td class="text-center">${r.dueDate || '-'}</td>
                                <td class="text-right">${Math.round(r.principal || 0).toLocaleString('en-IN')}</td>
                                <td class="text-right">${Math.round(r.interest || 0).toLocaleString('en-IN')}</td>
                                <td class="text-right" style="font-weight: bold;">${Math.round(r.total || 0).toLocaleString('en-IN')}</td>
                                <td class="text-right">${Math.round(r.balance || 0).toLocaleString('en-IN')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" class="text-center">एकूण (Total)</td>
                            <td class="text-right">₹${totalPrin.toLocaleString('en-IN')}</td>
                            <td class="text-right">₹${totalInt.toLocaleString('en-IN')}</td>
                            <td class="text-right">₹${totalAll.toLocaleString('en-IN')}</td>
                            <td class="text-right">-</td>
                        </tr>
                    </tfoot>
                </table>
                <div class="footer-sign">
                    <div>लिपिक / अधिकारी स्वाक्षरी</div>
                    <div>शाखा व्यवस्थापक स्वाक्षरी</div>
                    <div>कर्जदार स्वाक्षरी</div>
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;
        printWin.document.write(html);
        printWin.document.close();
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

            // Strict CBS Single-Call Atomicity: Link Draft Application ID directly into payload
            // The unified database transaction in POST /api/LoanDisbursements commits or rolls back atomically.
            if (sourceType === 'Draft' && draftApplication) {
                if (payload.loanAccount && draftApplication.loanApplicationID) {
                    payload.loanAccount.loanApplicationID = draftApplication.loanApplicationID;
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

    if (draftApplication) {
        const borrower = draftApplication.customer;
        selectedName = borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() : (draftApplication.customerID ? `ग्राहक #${draftApplication.customerID}` : 'अर्जदार');
        selectedCif = draftApplication.customer?.cifNo || '';
        selectedAccountNo = draftApplication.applicationNo || 'DRAFT';
        selectedLoanType = draftApplication.loanRate?.loanType || 'General Loan';
        const g1 = draftApplication.guarantor1Customer;
        selectedGuarantor1 = g1 ? `${g1.firstName || ''} ${g1.lastName || ''}`.trim() : '-';
        const g2 = draftApplication.guarantor2Customer;
        selectedGuarantor2 = g2 ? `${g2.firstName || ''} ${g2.lastName || ''}`.trim() : '-';
        selectedSecurity = draftApplication.securityDetails || '-';
    } else if (sourceType === 'Application' && selectedSourceId) {
        const app = applications.find(a => a.loanApplicationID === selectedSourceId);
        if (app) {
            const borrower = app.customer;
            selectedName = borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() : (app.customerID ? `ग्राहक #${app.customerID}` : 'अर्जदार');
            selectedCif = app.customer?.cifNo || '';
            selectedAccountNo = app.applicationNo || '';
            selectedLoanType = app.loanRate?.loanType || '';
            const g1 = app.guarantor1Customer;
            selectedGuarantor1 = g1 ? `${g1.firstName || ''} ${g1.lastName || ''}`.trim() : '-';
            const g2 = app.guarantor2Customer;
            selectedGuarantor2 = g2 ? `${g2.firstName || ''} ${g2.lastName || ''}`.trim() : '-';
            selectedSecurity = app.securityDetails || '-';
        }
    } else if (sourceType === 'ExistingAccount' && selectedSourceId) {
        const acc = accounts.find(a => a.loanAccountID === selectedSourceId);
        if (acc) {
            const borrower = acc.customer;
            selectedName = borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() : (acc.customerID ? `ग्राहक #${acc.customerID}` : 'खातेदार');
            selectedCif = acc.customer?.cifNo || '';
            selectedAccountNo = acc.loanAccountNo || '';
            selectedLoanType = acc.loanRate?.loanType || '';
            const g1 = acc.guarantor1Customer;
            selectedGuarantor1 = g1 ? `${g1.firstName || ''} ${g1.lastName || ''}`.trim() : '-';
            const g2 = acc.guarantor2Customer;
            selectedGuarantor2 = g2 ? `${g2.firstName || ''} ${g2.lastName || ''}`.trim() : '-';
            selectedSecurity = acc.securityDetails || '-';
        }
    }

    const currentApplicantCustomerId = getCurrentApplicantCustomerId();
    const isApplicantSaving = (s: any) => {
        if (currentApplicantCustomerId && s.customerID === currentApplicantCustomerId) return true;
        return false;
    };

    const applicantSavingAccounts = savingAccounts.filter(s => isApplicantSaving(s) && (s.status === 'Active' || !s.status));
    const otherSavingAccounts = savingAccounts.filter(s => !isApplicantSaving(s) && (s.status === 'Active' || !s.status));

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

            {/* ========================================================================= */}
            {/* MAIN WORKSPACE: 2-COLUMN BALANCED FORM LAYOUT                             */}
            {/* ========================================================================= */}
            <div className="w-full bg-white p-2.5 sm:p-3 rounded-sm shadow-xs border border-gray-200">
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                        
                        {/* ===================================================================== */}
                        {/* LEFT COLUMN: CARDS 1 & 2 (SOURCE, ACCOUNT & DISBURSEMENT LIMITS)       */}
                        {/* ===================================================================== */}
                        <div className="space-y-3">
                            
                            {/* Card 1: कर्ज स्त्रोत व खाते निवड */}
                            <div className="bg-white p-2.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-gray-200 pb-1 h-[24px]">
                                    <div className="flex items-center gap-1.5">
                                        <UserCheck className="w-3.5 h-3.5 text-primary" />
                                        <h2 className="text-xs font-bold text-primary">१. कर्ज स्त्रोत व खाते निवड (Loan Source & Account)</h2>
                                    </div>
                                    {alreadyDisbursedAmount > 0 && (
                                        <span className="text-[9.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-full font-mono">
                                            टप्पा क्र. {currentTrancheNo} वाटप (Multi-Tranche)
                                        </span>
                                    )}
                                </div>

                                {/* Row 1: Date, Type & Branch */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div>
                                        <label className={labelClass}>वितरण दिनांक (Date) <span className="text-red-500">*</span></label>
                                        <input 
                                            type="date" 
                                            name="disbursementDate" 
                                            value={formData.disbursementDate || ''} 
                                            onChange={(e) => {
                                                const newDate = e.target.value;
                                                setFormData(p => ({ ...p, disbursementDate: newDate }));
                                                setNewAccountData(a => ({ ...a, openingDate: newDate }));
                                            }} 
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
                                            <option value="Application">मंजूर अर्जावरून (Sanctioned App)</option>
                                            <option value="Draft">नवीन मसुदा (New Draft)</option>
                                            <option value="ExistingAccount">विद्यमान खात्यात (Existing A/c)</option>
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
                                </div>

                                {/* Row 2: Account or Application Search Selector (Full Width) */}
                                <div>
                                    <label className={labelClass}>
                                        {sourceType === 'Application' ? 'मंजूर कर्ज अर्ज निवडा' : 'कर्ज खाते निवडा'} <span className="text-red-500">*</span>
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
                                                    const borrower = a.customer;
                                                    const name = borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() : (a.customerID ? `ग्राहक #${a.customerID}` : 'अर्जदार');
                                                    const cif = a.customer?.cifNo ? ` [CIF: ${a.customer.cifNo}]` : '';
                                                    const trancheTag = (a.disbursementCount || 0) > 0 
                                                        ? ` [टप्पा ${(a.disbursementCount || 0) + 1} | शिल्लक: ₹${(a.pendingSanctionedAmount || 0).toLocaleString('en-IN')}]` 
                                                        : ` - मंजूर: ₹${(a.requestedAmount || 0).toLocaleString('en-IN')}`;
                                                    return { 
                                                        value: a.loanApplicationID.toString(), 
                                                        label: `${name} (${a.applicationNo || a.loanApplicationID})${trancheTag}${cif}` 
                                                    };
                                                })
                                                : accounts.map(a => {
                                                    const borrower = a.customer;
                                                    const name = borrower ? `${borrower.firstName || ''} ${borrower.lastName || ''}`.trim() : (a.customerID ? `ग्राहक #${a.customerID}` : 'खातेदार');
                                                    const cif = a.customer?.cifNo ? ` [CIF: ${a.customer.cifNo}]` : '';
                                                    const accDisbursed = disbursements.filter(d => d.loanAccountID === a.loanAccountID).reduce((s, d) => s + (d.disbursementAmount || 0), 0);
                                                    const pending = Math.max(0, (a.sanctionedAmount || 0) - accDisbursed);
                                                    return { 
                                                        value: a.loanAccountID.toString(), 
                                                        label: `${name} (${format14DigitDisplay(a.loanAccountNo)}) - ${a.loanRate?.shortName || a.loanRate?.loanType || ''} - मंजूर: ₹${(a.sanctionedAmount || 0).toLocaleString('en-IN')} | शिल्लक: ₹${pending.toLocaleString('en-IN')}${cif}` 
                                                    };
                                                })
                                            }
                                            value={selectedSourceId.toString()} 
                                            onChange={handleSourceSelection} 
                                            placeholder="-- अर्ज किंवा खाते निवडा --" 
                                            className={`${inputClass} flex justify-between items-center text-left cursor-pointer`}
                                        />
                                    )}
                                </div>

                                {/* Selected Member Profile Ribbon (Compact & Informative) */}
                                {selectedSourceId ? (
                                    <div className="p-2 bg-primary/5 border border-primary/20 rounded text-[10px] space-y-1 text-gray-800 font-medium shadow-2xs">
                                        <div className="flex flex-wrap justify-between items-center gap-1 border-b border-primary/10 pb-1">
                                            <span><b>CIF No:</b> <span className="font-mono">{selectedCif || '-'}</span></span>
                                            <span><b>खाते / अर्ज क्र.:</b> <span className="font-mono font-bold text-gray-900">{selectedAccountNo}</span></span>
                                            <span><b>कर्ज योजना:</b> <span className="font-bold text-primary">{selectedLoanType}</span></span>
                                        </div>
                                        <div className="text-center pt-0.5 text-xs font-bold text-gray-900">
                                            <span className="text-gray-600 font-medium">कर्जदार सभासद नाव: </span>
                                            <span className="text-primary font-black text-xs">
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

                            {/* Card 2: कर्ज वाटप मर्यादा व रक्कम */}
                            <div className="bg-white p-2.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2 shadow-2xs">
                                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 h-[24px]">
                                    <Percent className="w-3.5 h-3.5 text-primary" />
                                    <h2 className="text-xs font-bold text-primary">२. कर्ज वाटप मर्यादा व रक्कम (Disbursement Limits & Tranches)</h2>
                                </div>

                                {/* 4-Col Quick Stats Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                                        <div className="text-[9.5px] font-bold text-gray-500 uppercase">मंजूर मर्यादा</div>
                                        <div className="text-xs font-bold text-gray-800 font-mono mt-0.5">
                                            ₹{(formData.sanctionedAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 p-1.5 rounded border border-amber-200">
                                        <div className="text-[9.5px] font-bold text-amber-800 uppercase">यापूर्वीचे वाटप</div>
                                        <div className="text-xs font-bold text-amber-900 font-mono mt-0.5">
                                            ₹{alreadyDisbursedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-1.5 rounded border border-blue-300">
                                        <div className="text-[9.5px] font-bold text-blue-900 uppercase">शिल्लक मंजुरी मर्यादा</div>
                                        <div className="text-xs font-black text-blue-900 font-mono mt-0.5">
                                            ₹{pendingSanctionedLimit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>

                                    <div className={`p-1.5 rounded border ${isExceedingPendingLimit ? 'bg-red-50 border-red-400' : 'bg-emerald-50 border-emerald-300'}`}>
                                        <label className="text-[9.5px] font-bold text-emerald-900 uppercase block mb-0.5">सध्याचे वाटप <span className="text-red-500">*</span></label>
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
                                            className={`w-full text-xs font-black font-mono px-2 py-0.5 rounded border focus:outline-none h-[26px] ${
                                                isExceedingPendingLimit 
                                                    ? 'border-red-500 bg-white text-red-700 ring-2 ring-red-300' 
                                                    : 'border-emerald-500 bg-white text-emerald-900'
                                            }`} 
                                        />
                                    </div>
                                </div>

                                {isExceedingPendingLimit && (
                                    <div className="p-1.5 bg-rose-50 border border-rose-300 text-rose-800 rounded font-bold text-[10.5px] flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                        <span>वाटप रक्कम (₹{(formData.disbursementAmount || 0).toLocaleString('en-IN')}) ही शिल्लक मंजूर मर्यादेपेक्षा (₹{pendingSanctionedLimit.toLocaleString('en-IN')}) जास्त असू शकत नाही!</span>
                                    </div>
                                )}

                                {/* Multi-Tranche Progress Bar */}
                                {formData.sanctionedAmount ? (
                                    <div className="p-2 bg-gray-50 rounded border border-gray-200 text-[10.5px]">
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
                                        <div className="flex justify-between text-[9.5px] text-gray-500 mt-1 font-medium">
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
                        </div>

                        {/* ===================================================================== */}
                        {/* RIGHT COLUMN: CARDS 3 & 4 (DEDUCTIONS, SHARES & PAYMENT EXECUTION)    */}
                        {/* ===================================================================== */}
                        <div className="space-y-3">
                            
                            {/* Card 3: कपाती, शेअर्स व निव्वळ अदा */}
                            <div className="bg-white p-2.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2 shadow-2xs">
                                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 h-[24px]">
                                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                    <h2 className="text-xs font-bold text-primary">३. कपाती, शेअर्स व निव्वळ अदा (Deductions & Net Payout)</h2>
                                </div>

                                {/* Deductions Quick Row */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
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
                                        <label className={labelClass}>एकूण कपात (Deductions)</label>
                                        <input 
                                            type="text" 
                                            disabled 
                                            value={`₹${totalDeductionsAmount.toFixed(2)}`} 
                                            className={`${inputClass} bg-red-50 text-red-700 font-bold font-mono border-red-200`} 
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-emerald-800 mb-1 truncate">
                                            निव्वळ अदा रक्कम (Net Paid) *
                                        </label>
                                        <input 
                                            type="text" 
                                            disabled 
                                            value={`₹${(formData.netAmountPaid || 0).toFixed(2)}`} 
                                            className={`${inputClass} bg-emerald-50 text-emerald-800 font-black font-mono text-xs border-2 border-emerald-500`} 
                                        />
                                    </div>
                                </div>

                                {/* Dynamic Deductions List */}
                                <div className="bg-slate-50/70 border border-gray-200 rounded p-2">
                                    <div className="flex justify-between items-center mb-1.5 border-b border-gray-200 pb-1">
                                        <span className="text-[11px] font-bold text-gray-800 flex items-center gap-1">
                                            <Receipt className="w-3.5 h-3.5 text-primary" />
                                            कपातींची यादी (Deductions List)
                                        </span>
                                        <button 
                                            type="button" 
                                            onClick={addDeductionRow} 
                                            className="text-primary hover:text-blue-900 flex items-center gap-1 text-[10.5px] font-bold bg-white hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded cursor-pointer transition shadow-2xs"
                                        >
                                            <Plus className="w-3 h-3" /> + कपात जोडा
                                        </button>
                                    </div>

                                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-0.5">
                                        {deductions.map((deduction, index) => {
                                            const currentLedger = allLedgers.find(l => l.ledgerID === deduction.ledgerID);
                                            const ledgerDisplayName = currentLedger ? `${currentLedger.ledgerID} - ${currentLedger.ledgerName}` : (deduction.ledgerName || `खाते क्र. ${deduction.ledgerID}`);
                                            const isFirstAutoDeduction = index === 0;

                                            return (
                                                <div key={index} className="flex gap-1.5 items-center animate-fadeIn">
                                                    <div className="flex-1">
                                                        {isFirstAutoDeduction ? (
                                                            <div 
                                                                className="flex items-center justify-between px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10.5px] font-bold text-slate-800 h-[30px]"
                                                                title="हे सेटिंगमधील डीफॉल्ट अनिवार्य कपात खाते आहे (Read-Only)"
                                                            >
                                                                <div className="flex items-center gap-1.5 truncate">
                                                                    <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                                                                    <span className="truncate">{ledgerDisplayName}</span>
                                                                </div>
                                                                <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-200 px-1 py-0.2 rounded font-normal shrink-0 ml-1">
                                                                    (Default)
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <SearchableSelect 
                                                                options={allLedgers.map(l => ({ value: l.ledgerID.toString(), label: `${l.ledgerID} - ${l.ledgerName}` }))}
                                                                value={deduction.ledgerID ? deduction.ledgerID.toString() : ''}
                                                                onChange={(e: any) => handleDeductionChange(index, 'ledgerID', parseInt(e.target.value, 10))}
                                                                placeholder="-- कपात खाते निवडा --" 
                                                                className={`${inputClass} flex justify-between items-center text-left cursor-pointer`}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="w-28 shrink-0">
                                                        <input 
                                                            type="number" 
                                                            value={deduction.amount || ''} 
                                                            onChange={(e) => handleDeductionChange(index, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                                            onFocus={(e) => e.target.select()}
                                                            placeholder="रक्कम ₹" 
                                                            required 
                                                            min="0"
                                                            className={`${inputClass} text-red-600 font-bold font-mono`} 
                                                            title="कपातीची रक्कम एडिट करू शकता"
                                                        />
                                                    </div>
                                                    {isFirstAutoDeduction ? (
                                                        <button 
                                                            type="button" 
                                                            disabled
                                                            className="p-1 text-gray-300 cursor-not-allowed shrink-0"
                                                            title="डीफॉल्ट सेटिंग कपात हटवता येत नाही"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removeDeductionRow(index)} 
                                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer shrink-0"
                                                            title="कपात हटवा"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {deductions.length === 0 && (
                                            <div className="text-center text-gray-400 text-[10.5px] py-1">
                                                कोणतीही कपात जोडलेली नाही. '+ कपात जोडा' बटणावर क्लिक करा.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Auto Share Allocation Ribbon */}
                                {(() => {
                                    const shareDeductionItem = deductions.find(d => {
                                        const name = (d.ledgerName || allLedgers.find(l => l.ledgerID === d.ledgerID)?.ledgerName || '').toLowerCase();
                                        return name.includes('share') || name.includes('भाग') || name.includes('शेअर');
                                    });
                                    
                                    const shareAmt = shareDeductionItem ? (parseFloat(shareDeductionItem.amount as any) || 0) : 0;
                                    const qty = Math.floor(shareAmt / 100);
                                    const appObj = applications.find(a => a.loanApplicationID === selectedSourceId);
                                    const accObj = accounts.find(a => a.loanAccountID === selectedSourceId);
                                    const applicantMember = appObj?.member || accObj?.member || draftApplication?.member;
                                    
                                    if (shareAmt <= 0 || qty <= 0) {
                                        return (
                                            <div className="p-1.5 bg-amber-50/80 border border-amber-200 rounded text-[10px] text-amber-900 flex items-center justify-between">
                                                <span className="font-medium">
                                                    ℹ️ शेअर्स कपात शून्य आहे (बिगर-सभासद कर्ज).
                                                </span>
                                                <span className="text-[9px] bg-amber-200/70 text-amber-900 px-1 py-0.2 rounded font-semibold font-mono">
                                                    Non-Member
                                                </span>
                                            </div>
                                        );
                                    }

                                    const certNo = nextShareConfig.nextCertificateNo || `CERT-${new Date().getFullYear()}-00001`;
                                    const fromNo = nextShareConfig.nextFromShareNo || 1;
                                    const toNo = fromNo + qty - 1;

                                    return (
                                        <div className="p-2 bg-blue-50/90 border border-blue-200 rounded text-[10.5px] shadow-2xs space-y-1">
                                            <div className="font-bold text-blue-900 flex items-center justify-between border-b border-blue-200 pb-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Percent className="w-3 h-3 text-blue-700" />
                                                    ऑटो शेअर कपात वाटप (Auto Share Allocation)
                                                </span>
                                                <span className="text-[9.5px] bg-blue-100 text-blue-900 px-1.5 py-0.2 rounded font-mono font-bold">
                                                    ₹{shareAmt.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-[9.5px]">
                                                <div className="bg-white p-1 rounded border border-blue-100">
                                                    <div className="text-gray-400">सभासद क्र.</div>
                                                    <div className="font-bold text-blue-950 font-mono truncate">{applicantMember?.memberCode || 'Auto'}</div>
                                                </div>
                                                <div className="bg-white p-1 rounded border border-blue-100">
                                                    <div className="text-gray-400">वर्गवारी</div>
                                                    <div className="font-bold text-emerald-800">नियमित ('अ')</div>
                                                </div>
                                                <div className="bg-white p-1 rounded border border-blue-100">
                                                    <div className="text-gray-400">शेअर्स संख्या</div>
                                                    <div className="font-bold text-emerald-700">{qty} (₹100 दर)</div>
                                                </div>
                                                <div className="bg-white p-1 rounded border border-blue-100">
                                                    <div className="text-gray-400">सर्टिफिकेट क्र.</div>
                                                    <div className="font-mono font-bold text-indigo-700 truncate">{certNo}</div>
                                                </div>
                                                <div className="bg-white p-1 rounded border border-blue-100">
                                                    <div className="text-gray-400">नं. पासून</div>
                                                    <div className="font-mono font-bold text-gray-800">{fromNo}</div>
                                                </div>
                                                <div className="bg-white p-1 rounded border border-blue-100">
                                                    <div className="text-gray-400">नं. पर्यंत</div>
                                                    <div className="font-mono font-bold text-gray-800">{toNo}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Card 4: पेमेंट तपशील व शेरा */}
                            <div className="bg-white p-2.5 rounded-sm border border-gray-200 border-t-2 border-primary space-y-2 shadow-2xs">
                                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 h-[24px]">
                                    <Banknote className="w-3.5 h-3.5 text-primary" />
                                    <h2 className="text-xs font-bold text-primary">४. पेमेंट तपशील व शेरा (Payment Execution & Remarks)</h2>
                                </div>

                                {/* Row 1: Payment Mode & Target Account */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                                    <div>
                                        {formData.paymentMode === 'Cash' && (
                                            <div>
                                                <label className={labelClass}>रोख खाते (Cash Ledger)</label>
                                                <CashLedgerReflectBadge 
                                                    transactionType="Disbursement" 
                                                    customTitle="कर्ज वितरण रोख खाते"
                                                />
                                            </div>
                                        )}

                                        {(formData.paymentMode === 'Bank' || formData.paymentMode === 'Cheque') && (
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
                                                    {bankLedgers.map(l => (
                                                        <option key={l.ledgerID} value={l.ledgerID}>
                                                            {l.ledgerName}{l.accountGroup?.groupName ? ` (${l.accountGroup.groupName})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {formData.paymentMode === 'Saving Transfer' && (
                                            <div>
                                                <label className={labelClass}>सेव्हिंग खाते नंबर <span className="text-red-500">*</span></label>
                                                <select 
                                                    name="transferToSavingAccountNo" 
                                                    value={formData.transferToSavingAccountNo || ''} 
                                                    onChange={(e) => setFormData(p => ({ ...p, transferToSavingAccountNo: e.target.value }))} 
                                                    className={inputClass}
                                                    required
                                                >
                                                    <option value="">-- सेव्हिंग खाते निवडा --</option>
                                                    {applicantSavingAccounts.length > 0 && (
                                                        <optgroup label="⭐ अर्जदाराचे सेव्हिंग खाते">
                                                            {applicantSavingAccounts.map(s => (
                                                                <option key={s.savingAccountID} value={s.accountNo}>
                                                                    {s.accountNo} - {s.memberName || 'Member'} (₹{(s.currentBalance || 0).toLocaleString('en-IN')})
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}
                                                    <optgroup label="📋 इतर सर्व सेव्हिंग खाती">
                                                        {otherSavingAccounts.map(s => (
                                                            <option key={s.savingAccountID} value={s.accountNo}>
                                                                {s.accountNo} - {s.memberName || 'Member'} (₹{(s.currentBalance || 0).toLocaleString('en-IN')})
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: Cheque No (if applicable) & Remarks */}
                                <div className={`grid ${formData.paymentMode === 'Cheque' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                    {formData.paymentMode === 'Cheque' && (
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
                                    )}

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
                            </div>
                        </div>
                    </div>

                    {/* Form Action Buttons Bar (Full Width) */}
                    <div className="pt-2 flex flex-wrap justify-between items-center gap-2 border-t border-gray-200 bg-slate-50/70 -mx-2.5 sm:-mx-3 -mb-2.5 sm:-mb-3 p-2 rounded-b-sm">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    fetchData();
                                    setShowListModal(true);
                                }}
                                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
                            >
                                <Layers className="w-3.5 h-3.5 text-slate-600" />
                                <span>कर्ज वाटप यादी ({disbursements.length})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    calculateSchedule();
                                    setShowSchedule(true);
                                }}
                                className="px-3 py-1.5 font-bold rounded-sm text-xs border cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all bg-white hover:bg-slate-100 text-primary border-primary/30"
                                title="हप्ता वेळापत्रक व गोषवारा पहा"
                            >
                                <Calculator className="w-3.5 h-3.5 text-primary" />
                                <span>📊 वेळापत्रक व गोषवारा</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleResetForm}
                                className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-bold rounded-sm text-xs border border-slate-300 cursor-pointer shadow-2xs flex items-center gap-1.5 transition-all"
                            >
                                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
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

            {/* ========================================================================= */}
            {/* ULTRA-REFINED NAJUK GLASSMORPHISM POPUP MODAL: SCHEDULE & SUMMARY         */}
            {/* ========================================================================= */}
            {showSchedule && (
                <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-2 sm:p-3 animate-in fade-in duration-150">
                    {/* Frosted Glass Backdrop */}
                    <div 
                        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity cursor-pointer" 
                        onClick={() => setShowSchedule(false)} 
                    />
                    
                    {/* Compact Delicate Modal Box */}
                    <div className="relative w-full max-w-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-xl ring-1 ring-black/5 flex flex-col z-10 animate-in zoom-in-95 duration-150 overflow-hidden max-h-[88vh]">
                        
                        {/* 1. Delicate Header (Slim & Crisp with Tab Switcher) */}
                        <div className="px-3.5 py-2 bg-gradient-to-r from-emerald-800 via-primary to-teal-800 text-white flex items-center justify-between shadow-2xs shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-white shrink-0">
                                    <Calendar className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-xs font-bold text-white tracking-wide truncate">
                                            कर्ज वाटप गोषवारा व हप्ता पत्रक
                                        </h3>
                                        {selectedAccountNo && (
                                            <span className="text-[9.5px] font-mono bg-white/20 px-1.5 py-0.2 rounded text-emerald-100 shrink-0">
                                                {selectedAccountNo}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-emerald-100/90 truncate">
                                        {selectedName ? `${selectedName} • ${selectedLoanType}` : (selectedLoanType || 'थेट कर्ज वाटप व हप्ता गणना')}
                                    </p>
                                </div>
                            </div>

                            {/* Tab Switcher Pills */}
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <button
                                    type="button"
                                    onClick={() => setScheduleTab('summary')}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        scheduleTab === 'summary' 
                                            ? 'bg-white text-emerald-900 shadow-2xs' 
                                            : 'bg-white/15 text-white hover:bg-white/25'
                                    }`}
                                >
                                    📋 गोषवारा
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setScheduleTab('schedule');
                                        if (scheduleData.length === 0) calculateSchedule();
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                        scheduleTab === 'schedule' 
                                            ? 'bg-white text-emerald-900 shadow-2xs' 
                                            : 'bg-white/15 text-white hover:bg-white/25'
                                    }`}
                                >
                                    📊 वेळापत्रक {scheduleData.length > 0 ? `(${scheduleData.length})` : ''}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowSchedule(false)}
                                    className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer ml-1"
                                    title="बंद करा (Close)"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {/* 2. Micro Metrics Strip (Super Compact) */}
                        <div className="px-3.5 pt-2 pb-1.5 bg-slate-50/70 border-b border-slate-200 shrink-0">
                            <div className="grid grid-cols-4 gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200/90 shadow-2xs text-[11px]">
                                <div className="px-1.5 py-0.5 border-r border-slate-100">
                                    <span className="text-[9.5px] text-slate-400 block leading-tight">मंजूर मर्यादा</span>
                                    <span className="font-bold text-slate-800 font-mono text-[11.5px] leading-tight">
                                        ₹{(formData.sanctionedAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                                <div className="px-1.5 py-0.5 border-r border-slate-100">
                                    <span className="text-[9.5px] text-amber-600 block leading-tight">यापूर्वीचे वाटप</span>
                                    <span className="font-bold text-amber-700 font-mono text-[11.5px] leading-tight">
                                        ₹{alreadyDisbursedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                                <div className="px-1.5 py-0.5 border-r border-slate-100">
                                    <span className="text-[9.5px] text-blue-600 block leading-tight">सध्याचे वाटप</span>
                                    <span className="font-bold text-blue-800 font-mono text-[11.5px] leading-tight">
                                        ₹{(formData.disbursementAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                                <div className="px-1.5 py-0.5">
                                    <span className="text-[9.5px] text-emerald-600 block leading-tight">निव्वळ प्रदान</span>
                                    <span className="font-bold text-emerald-800 font-mono text-[11.5px] leading-tight">
                                        ₹{(formData.netAmountPaid || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Modal Body: Tab 1 Summary OR Tab 2 Schedule */}
                        <div className="p-2 sm:p-2.5 flex-1 flex flex-col overflow-hidden min-h-[260px]">
                            {/* TAB 1: DISBURSEMENT LIVE SUMMARY */}
                            {scheduleTab === 'summary' && (
                                <div className="flex-1 overflow-auto space-y-2 p-0.5 text-xs">
                                    {selectedSourceId ? (
                                        <>
                                            {/* Financial Overview Breakdown */}
                                            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs space-y-1.5 text-[11px]">
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

                                                <div className="flex justify-between items-center text-primary border-t border-slate-100 pt-1">
                                                    <span className="font-semibold">सध्याचे वाटप रक्कम:</span>
                                                    <span className="font-black font-mono text-xs">₹{(formData.disbursementAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>

                                                <div className="flex justify-between items-center text-emerald-800 border-t border-slate-100 pt-1">
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

                                            {/* Deductions Breakdown */}
                                            <div className="p-2.5 bg-red-50/60 border border-red-200 rounded text-[11px] shadow-2xs">
                                                <div className="text-[10px] font-bold text-red-900 uppercase mb-1">कपाती तपशील (Deductions Breakdown)</div>
                                                {deductions.map((d, i) => (
                                                    <div key={i} className="flex justify-between items-center mb-0.5 text-red-700">
                                                        <span>- {d.ledgerName || allLedgers.find(l => l.ledgerID === d.ledgerID)?.ledgerName || 'कपात खाते'}</span>
                                                        <span className="font-mono font-bold">₹{d.amount?.toFixed(2) || '0.00'}</span>
                                                    </div>
                                                ))}
                                                {deductions.length === 0 && (
                                                    <div className="text-[10.5px] text-gray-400 italic">कोणतीही कपात नाही.</div>
                                                )}
                                                <div className="flex justify-between items-center pt-1 mt-1 border-t border-red-200 font-bold text-red-900 text-xs">
                                                    <span>एकूण कपात:</span>
                                                    <span className="font-mono">₹{totalDeductionsAmount.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            {/* Net Payout Highlight Box */}
                                            <div className="p-2.5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white rounded shadow-xs flex items-center justify-between">
                                                <div>
                                                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-100">
                                                        निव्वळ हातात मिळणारी रक्कम
                                                    </div>
                                                    <div className="text-[10.5px] font-medium text-emerald-200">
                                                        (Net Amount Payable)
                                                    </div>
                                                </div>
                                                <div className="text-lg font-black font-mono tracking-tight">
                                                    ₹{(formData.netAmountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="py-10 text-center text-gray-400 space-y-1">
                                            <Banknote className="w-8 h-8 mx-auto text-gray-300" />
                                            <div className="text-xs font-semibold text-gray-500">गोषवारा पाहण्यासाठी कर्ज स्त्रोत व खाते निवडा.</div>
                                            <p className="text-[10.5px] text-gray-400">निवडलेल्या खात्याची मर्यादा व कपाती येथे थेट दिसतील.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: LIVE EMI REPAYMENT SCHEDULE */}
                            {scheduleTab === 'schedule' && (
                                <div className="flex-1 flex flex-col overflow-hidden">
                                    {scheduleData.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400">
                                            <Calculator className="w-8 h-8 text-gray-300 mb-1 stroke-[1.5]" />
                                            <p className="text-[11px] font-semibold text-gray-600">हप्ता पत्रक तयार करण्यासाठी कर्ज वाटप रक्कम भरा.</p>
                                            <button
                                                type="button"
                                                onClick={calculateSchedule}
                                                className="mt-2 px-3 py-1 bg-primary text-white rounded text-[11px] font-bold shadow-2xs hover:opacity-90 cursor-pointer"
                                            >
                                                📊 वेळापत्रक लोड करा
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-auto rounded border border-slate-200 shadow-2xs bg-white">
                                            <table className="w-full text-left border-collapse text-[10.5px]">
                                                <thead className="bg-slate-100 sticky top-0 shadow-2xs text-slate-700 font-bold border-b border-slate-300 z-10">
                                                    <tr>
                                                        <th className="py-1 px-1.5 border-r border-slate-200 text-center w-9">क्र.</th>
                                                        <th className="py-1 px-2 border-r border-slate-200 text-center w-24">हप्ता दिनांक</th>
                                                        <th className="py-1 px-2 border-r border-slate-200 text-right">मुद्दल (₹)</th>
                                                        <th className="py-1 px-2 border-r border-slate-200 text-right">व्याज (₹)</th>
                                                        <th className="py-1 px-2 border-r border-slate-200 text-right">एकूण हप्ता (₹)</th>
                                                        <th className="py-1 px-2 text-right">बाकी शिल्लक (₹)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 font-mono text-[10px] text-slate-700">
                                                    {scheduleData.map((row, i) => (
                                                        <tr key={i} className="hover:bg-emerald-50/50 transition-colors">
                                                            <td className="py-0.5 px-1.5 border-r border-slate-100 text-center font-bold text-slate-500 bg-slate-50/40">{row.instNo}</td>
                                                            <td className="py-0.5 px-2 border-r border-slate-100 text-center text-slate-600 font-sans">
                                                                {row.dueDate || '-'}
                                                            </td>
                                                            <td className="py-0.5 px-2 border-r border-slate-100 text-right text-slate-800">
                                                                {Math.round(row.principal || 0).toLocaleString('en-IN')}
                                                            </td>
                                                            <td className="py-0.5 px-2 border-r border-slate-100 text-right text-rose-600">
                                                                {Math.round(row.interest || 0).toLocaleString('en-IN')}
                                                            </td>
                                                            <td className="py-0.5 px-2 border-r border-slate-100 text-right font-bold text-emerald-700 bg-emerald-50/20">
                                                                {Math.round(row.total || 0).toLocaleString('en-IN')}
                                                            </td>
                                                            <td className="py-0.5 px-2 text-right text-slate-600">
                                                                {Math.round(row.balance || 0).toLocaleString('en-IN')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t-2 border-slate-300 sticky bottom-0 z-20 shadow-xs text-[10.5px]">
                                                    <tr>
                                                        <td colSpan={2} className="py-1 px-2 text-center font-sans text-[10.5px]">एकूण (Total):</td>
                                                        <td className="py-1 px-2 text-right text-slate-900 border-r border-slate-200">
                                                            ₹{scheduleData.reduce((acc, r) => acc + Math.round(r.principal || 0), 0).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="py-1 px-2 text-right text-rose-700 border-r border-slate-200">
                                                            ₹{scheduleData.reduce((acc, r) => acc + Math.round(r.interest || 0), 0).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="py-1 px-2 text-right text-emerald-800 border-r border-slate-200">
                                                            ₹{scheduleData.reduce((acc, r) => acc + Math.round(r.total || 0), 0).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="py-1 px-2 text-right text-slate-400 font-sans">-</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 4. Delicate Footer Action Bar */}
                        <div className="px-3.5 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleExportScheduleExcel}
                                    disabled={scheduleData.length === 0}
                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-emerald-800 font-bold rounded text-[11px] border border-emerald-300 shadow-2xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                                    title="एक्सेल फाइल डाउनलोड करा"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>एक्सेल (Excel)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handlePrintSchedule}
                                    disabled={scheduleData.length === 0}
                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded text-[11px] border border-slate-300 shadow-2xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                                    title="वेळापत्रक प्रिंट करा"
                                >
                                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                                    <span>प्रिंट (Print)</span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowSchedule(false)}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-[11px] shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                                <span>बंद करा (Close)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

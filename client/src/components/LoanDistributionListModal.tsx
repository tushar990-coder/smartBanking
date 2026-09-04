import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    X, Edit2, Trash2, Search, Filter, RefreshCw, FileText, 
    Layers, User, Calendar, CreditCard, Banknote, ShieldAlert, 
    CheckCircle2, FileSpreadsheet, Eye, IndianRupee, Landmark, Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ShareCertificatePreview from './ShareCertificatePreview';

interface Props {
    onClose: () => void;
    onEdit?: (disbursement: any) => void;
    onDelete?: (id: number) => void;
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

const LoanDistributionListModal: React.FC<Props> = ({ onClose, onEdit, onDelete }) => {
    const [disbursements, setDisbursements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLoanType, setSelectedLoanType] = useState('');
    const [selectedPaymentMode, setSelectedPaymentMode] = useState('');
    const [selectedCertificate, setSelectedCertificate] = useState<any | null>(null);
    const [fetchingCertId, setFetchingCertId] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/LoanDisbursements');
            setDisbursements(res.data || []);
        } catch (error) {
            console.error('Error fetching disbursements:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintShareCertificate = async (disbursementId: number) => {
        try {
            setFetchingCertId(disbursementId);
            const res = await axios.get(`/api/ShareCertificates/ByDisbursement/${disbursementId}`);
            if (res.data) {
                setSelectedCertificate(res.data);
            } else {
                alert('या वितरणासाठी शेअर प्रमाणपत्र आढळले नाही.');
            }
        } catch (err: any) {
            console.error('Error fetching share certificate:', err);
            const msg = err.response?.data?.message || (typeof err.response?.data === 'string' ? err.response.data : 'शेअर प्रमाणपत्र लोड करताना त्रुटी आली.');
            alert(msg);
        } finally {
            setFetchingCertId(null);
        }
    };

    const getGuarantor1Name = (d: any) => {
        const acc = d.loanAccount || {};
        const g1 = acc.guarantor1Member || acc.loanApplication?.guarantor1Member;
        if (g1) return `${g1.firstName || ''} ${g1.middleName ? g1.middleName + ' ' : ''}${g1.lastName || ''}`.trim();
        return '-';
    };

    const getGuarantor2Name = (d: any) => {
        const acc = d.loanAccount || {};
        const g2 = acc.guarantor2Member || acc.loanApplication?.guarantor2Member;
        if (g2) return `${g2.firstName || ''} ${g2.middleName ? g2.middleName + ' ' : ''}${g2.lastName || ''}`.trim();
        return '-';
    };

    const filteredData = disbursements.filter(d => {
        const term = searchTerm.toLowerCase().trim();
        const matchesTerm = !term || (
            (d.loanAccount?.member?.firstName || '').toLowerCase().includes(term) ||
            (d.loanAccount?.member?.lastName || '').toLowerCase().includes(term) ||
            (d.loanAccount?.loanAccountNo || '').toLowerCase().includes(term) ||
            getGuarantor1Name(d).toLowerCase().includes(term) ||
            getGuarantor2Name(d).toLowerCase().includes(term) ||
            (d.loanAccount?.member?.cifNo || '').toLowerCase().includes(term) ||
            (d.loanAccount?.member?.memberCode || '').toLowerCase().includes(term)
        );

        const matchesType = !selectedLoanType || (
            (d.loanAccount?.loanRate?.loanType || '').toLowerCase().includes(selectedLoanType.toLowerCase()) ||
            (d.loanAccount?.loanRate?.shortName || '').toLowerCase().includes(selectedLoanType.toLowerCase())
        );

        const matchesMode = !selectedPaymentMode || (
            (d.paymentMode || '').toLowerCase() === selectedPaymentMode.toLowerCase()
        );

        return matchesTerm && matchesType && matchesMode;
    });

    const handleDelete = async (id: number) => {
        if (window.confirm("तुम्हाला हे कर्ज वितरण कायमचे डिलीट करायचे आहे का?")) {
            try {
                await axios.delete(`/api/LoanDisbursements/${id}`);
                await fetchData();
                if (onDelete) onDelete(id);
            } catch (error: any) {
                console.error('Error deleting disbursement:', error);
                const msg = error.response?.data?.message || (typeof error.response?.data === 'string' ? error.response.data : error.message);
                alert(msg || "कर्ज वितरण डिलीट करताना त्रुटी आली.");
            }
        }
    };

    const handleExportExcel = () => {
        if (filteredData.length === 0) {
            alert('एक्सपोर्ट करण्यासाठी कोणतीही माहिती उपलब्ध नाही.');
            return;
        }

        const exportRows = filteredData.map((d, index) => {
            const acc = d.loanAccount || {};
            const totalDeds = (d.deductions || []).reduce((s: number, item: any) => s + (item.amount || 0), 0);
            return {
                "अ.क्र.": index + 1,
                "वितरण क्र.": d.loanDisbursementID,
                "कर्ज खाते क्र.": acc.loanAccountNo || `L-${d.loanAccountID}`,
                "सभासद कोड": acc.member?.memberCode || '-',
                "CIF क्र.": acc.member?.cifNo || '-',
                "कर्जदार नाव": `${acc.member?.firstName || ''} ${acc.member?.lastName || ''}`.trim(),
                "जामीनदार १": getGuarantor1Name(d),
                "जामीनदार २": getGuarantor2Name(d),
                "कर्ज योजना": acc.loanRate?.shortName || acc.loanRate?.loanType || '-',
                "मंजूर रक्कम ₹": acc.sanctionedAmount || d.sanctionedAmount || 0,
                "वाटप रक्कम ₹": d.disbursementAmount || 0,
                "वितरण दिनांक": formatDateSafe(d.disbursementDate),
                "हप्ता रक्कम ₹": acc.installmentAmount || 0,
                "व्याजदर (%)": acc.interestRate || 0,
                "हप्ते संख्या": acc.noOfInstallments || '-',
                "एकूण कपात ₹": totalDeds,
                "निव्वळ अदा ₹": d.netAmountPaid || 0,
                "पेमेंट पद्धत": d.paymentMode || 'Cash',
                "शेरा": d.remarks || '-'
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Loan_Disbursements");
        XLSX.writeFile(wb, `Loan_Disbursement_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const totalFilteredDisbursed = filteredData.reduce((s, d) => s + (d.disbursementAmount || 0), 0);
    const totalFilteredNetPaid = filteredData.reduce((s, d) => s + (d.netAmountPaid || 0), 0);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150 font-sans">
            <div className="bg-white rounded-md shadow-2xl border border-gray-300 max-w-[96vw] xl:max-w-[92vw] w-full max-h-[92vh] flex flex-col overflow-hidden">
                
                {/* Modal Header (Matching LoanApplicationMaster.tsx) */}
                <div className="bg-primary text-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-primary/20">
                    <div className="flex items-center gap-2">
                        <Landmark className="w-5 h-5 text-white" />
                        <h2 className="text-sm font-bold flex items-center gap-2">
                            <span>नोंदवलेली कर्ज वितरण यादी (Loan Disbursement Register)</span>
                            <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
                                {filteredData.length} नोंदी
                            </span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={fetchData}
                            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                            title="रिफ्रेश करा"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-sm transition-colors cursor-pointer"
                            title="बंद करा (Close)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                {/* Modal Filter Toolbar (Matching LoanApplicationMaster.tsx) */}
                <div className="p-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 shrink-0 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                            <input 
                                type="text" 
                                placeholder="खाते क्र., सभासद नाव, कोड किंवा CIF शोधा..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-6 py-1 border border-gray-300 rounded-sm text-xs h-[30px] w-64 lg:w-80 focus:outline-none focus:border-primary bg-white shadow-2xs"
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')} 
                                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            <label className="text-gray-600 font-bold text-[11px] shrink-0">कर्ज प्रकार:</label>
                            <select 
                                className="border border-gray-300 px-2 py-1 rounded-sm text-xs h-[30px] bg-white focus:outline-none focus:border-primary shadow-2xs font-medium"
                                value={selectedLoanType}
                                onChange={(e) => setSelectedLoanType(e.target.value)}
                            >
                                <option value="">सर्व कर्ज प्रकार (All)</option>
                                <option value="वैयक्तिक">वैयक्तिक कर्ज</option>
                                <option value="तारण">तारण कर्ज</option>
                                <option value="वाहन">वाहन कर्ज</option>
                                <option value="सोने">सोने तारण कर्ज</option>
                                <option value="व्यावसायिक">व्यावसायिक कर्ज</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1">
                            <label className="text-gray-600 font-bold text-[11px] shrink-0">पेमेंट:</label>
                            <select 
                                className="border border-gray-300 px-2 py-1 rounded-sm text-xs h-[30px] bg-white focus:outline-none focus:border-primary shadow-2xs font-medium"
                                value={selectedPaymentMode}
                                onChange={(e) => setSelectedPaymentMode(e.target.value)}
                            >
                                <option value="">सर्व पद्धती</option>
                                <option value="Cash">Cash (रोख)</option>
                                <option value="Bank">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Saving Transfer">Saving Transfer</option>
                            </select>
                        </div>

                        {(searchTerm || selectedLoanType || selectedPaymentMode) && (
                            <button 
                                onClick={() => { setSearchTerm(''); setSelectedLoanType(''); setSelectedPaymentMode(''); }} 
                                className="text-gray-500 hover:text-gray-800 text-xs font-semibold px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded-sm transition cursor-pointer"
                            >
                                ✕ फिल्टर काढा
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-3 text-gray-700 text-[11px] font-medium bg-white px-2.5 py-1 border border-gray-200 rounded-sm shadow-2xs">
                            <span>एकूण वाटप: <strong className="text-blue-900 font-mono font-bold">₹{totalFilteredDisbursed.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
                            <span className="text-gray-300">|</span>
                            <span>एकूण निव्वळ अदा: <strong className="text-emerald-800 font-mono font-bold">₹{totalFilteredNetPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong></span>
                        </div>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={filteredData.length === 0}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-3 py-1 rounded-sm text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer h-[30px]"
                            title="एक्सेल फाइल डाउनलोड करा"
                        >
                            <FileSpreadsheet size={13} />
                            <span>एक्सेल एक्सपोर्ट</span>
                        </button>
                    </div>
                </div>

                {/* Modal Table Content */}
                <div className="flex-1 overflow-auto p-2 bg-slate-100">
                    <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
                        <table className="w-full text-left border-collapse min-w-[1550px] text-xs">
                            <thead className="bg-slate-100 sticky top-0 shadow-2xs text-gray-700 font-bold border-b border-gray-300">
                                <tr>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-center w-24">कृती</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-center w-10">अ.क्र.</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-left">खाते क्र. व टप्पा</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-left">कर्जदार सभासद नाव</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-left bg-amber-50/70 text-amber-950">जामीनदार १</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-left bg-amber-50/70 text-amber-950">जामीनदार २</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-left">कर्ज प्रकार</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-right">मंजूर रक्कम ₹</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-right bg-blue-50/70 text-blue-950">वाटप रक्कम ₹</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-center">वितरण दिनांक</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-right">हप्ता रक्कम ₹</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-center">व्याजदर (%)</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-center">हप्ते संख्या</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-right text-red-700">एकूण कपात ₹</th>
                                    <th className="px-2 py-1.5 border-r border-gray-200 text-right bg-emerald-50/70 text-emerald-950">निव्वळ अदा ₹</th>
                                    <th className="px-2 py-1.5 text-left w-28">पेमेंट पद्धत</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-[11px] bg-white">
                                {loading ? (
                                    <tr>
                                        <td colSpan={16} className="text-center py-12 text-gray-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                                            <span>माहिती लोड होत आहे...</span>
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={16} className="text-center py-12 text-gray-400">
                                            <FileText className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                                            <span>कोणतीही कर्ज वितरण नोंद सापडली नाही.</span>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((d, index) => {
                                        const acc = d.loanAccount || {};
                                        const g1Name = getGuarantor1Name(d);
                                        const g2Name = getGuarantor2Name(d);
                                        
                                        const accountDisbursements = disbursements
                                            .filter(x => x.loanAccountID === d.loanAccountID)
                                            .sort((a, b) => new Date(a.disbursementDate).getTime() - new Date(b.disbursementDate).getTime() || a.loanDisbursementID - b.loanDisbursementID);
                                        
                                        const trancheIdx = accountDisbursements.findIndex(x => x.loanDisbursementID === d.loanDisbursementID);
                                        const trancheNo = trancheIdx >= 0 ? trancheIdx + 1 : 1;
                                        const hasMultipleTranches = accountDisbursements.length > 1;

                                        const totalDeds = (d.deductions || []).reduce((s: number, item: any) => s + (item.amount || 0), 0);

                                        return (
                                            <tr key={d.loanDisbursementID} className="hover:bg-primary/5 transition-colors">
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => onEdit && onEdit(d)} 
                                                            className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                                            title="वितरण फॉर्ममध्ये लोड करा (Edit)"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                            <span>सुधारा</span>
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleDelete(d.loanDisbursementID)} 
                                                            className="px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                                                            title="वितरण डिलीट करा (Delete)"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                            <span>बाद</span>
                                                        </button>
                                                        {(d.shareDeduction > 0 || (d.deductions && d.deductions.some((x: any) => (x.amount > 0 && ((x.ledger?.ledgerName || '').toLowerCase().includes('share') || (x.ledger?.ledgerName || '').includes('भाग')))))) && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handlePrintShareCertificate(d.loanDisbursementID)} 
                                                                disabled={fetchingCertId === d.loanDisbursementID}
                                                                className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer shadow-2xs"
                                                                title="शेअर प्रमाणपत्र प्रिंट करा"
                                                            >
                                                                <Award className="w-3 h-3 text-emerald-600" />
                                                                <span>{fetchingCertId === d.loanDisbursementID ? '...' : 'प्रमाणपत्र'}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 text-center text-gray-500 font-mono text-[11px] border-r border-gray-200">
                                                    {index + 1}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 font-mono">
                                                    <div className="font-bold text-gray-900">{acc.loanAccountNo || `L-${d.loanAccountID}`}</div>
                                                    {hasMultipleTranches && (
                                                        <span className="inline-block text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded border border-amber-300 mt-0.5">
                                                            टप्पा {trancheNo}/{accountDisbursements.length}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200">
                                                    <div className="font-bold text-primary">{acc.member?.firstName} {acc.member?.lastName}</div>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono mt-0.5">
                                                        {acc.member?.memberCode && <span>कोड: {acc.member.memberCode}</span>}
                                                        {acc.member?.cifNo && <span>CIF: {acc.member.cifNo}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-amber-950 bg-amber-50/30 font-medium">
                                                    {g1Name}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-amber-950 bg-amber-50/30 font-medium">
                                                    {g2Name}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 font-semibold text-gray-700">
                                                    {acc.loanRate?.shortName || acc.loanRate?.loanType || '-'}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-gray-800">
                                                    ₹{(acc.sanctionedAmount || d.sanctionedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-black text-blue-900 bg-blue-50/30">
                                                    ₹{(d.disbursementAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono text-[11px] font-semibold text-gray-700">
                                                    {formatDateSafe(d.disbursementDate)}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-gray-700">
                                                    ₹{(acc.installmentAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono font-semibold">
                                                    {acc.interestRate}%
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-center font-mono font-semibold">
                                                    {acc.noOfInstallments || '-'}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-bold text-red-600">
                                                    ₹{totalDeds.toFixed(2)}
                                                </td>
                                                <td className="px-2 py-1.5 border-r border-gray-200 text-right font-mono font-black text-emerald-800 bg-emerald-50/30">
                                                    ₹{(d.netAmountPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-2 py-1.5 font-medium">
                                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 border border-gray-200">
                                                        {d.paymentMode || 'Cash'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modal Footer (Matching LoanApplicationMaster.tsx) */}
                <div className="bg-slate-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center text-xs shrink-0">
                    <span className="text-gray-500 font-medium">
                        नोंदी: <strong>{filteredData.length}</strong> पैकी <strong>{disbursements.length}</strong>
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-sm text-xs transition cursor-pointer"
                    >
                        बंद करा (Close)
                    </button>
                </div>
            </div>

            {/* 🖨️ SHARE CERTIFICATE PREVIEW MODAL */}
            {selectedCertificate && (
                <ShareCertificatePreview 
                    certificate={selectedCertificate} 
                    onClose={() => setSelectedCertificate(null)} 
                />
            )}
        </div>
    );
};

export default LoanDistributionListModal;

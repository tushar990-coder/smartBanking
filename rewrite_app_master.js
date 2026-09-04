const fs = require('fs');
const path = require('path');

const content = `import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PlusCircle, Search, Save, Edit, Trash2, X } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface Member {
    memberID: number;
    firstName: string;
    middleName: string;
    lastName: string;
    memberCode: string;
}

interface LoanRate {
    loanRateID: number;
    loanType: string;
    shortName: string;
    interestRate: number;
    isActive: boolean;
}

interface LoanApplication {
    loanApplicationID: number;
    applicationNo: string;
    applicationDate: string;
    memberID: number;
    coMemberID?: number;
    coMember2ID?: number;
    loanRateID: number;
    requestedAmount: number;
    interestRate: number;
    durationMonths: number;
    installmentFrequency: string;
    noOfInstallments: number;
    installmentAmount: number;
    firstInstallmentDate?: string;
    maturityDate?: string;
    recommendedByDirectorID?: number;
    guarantor1MemberID?: number;
    guarantor2MemberID?: number;
    securityDetails?: string;
    securityValue?: number;
    purpose?: string;
    status: string;
    member?: Member;
    loanRate?: LoanRate;
}

const InstallmentFrequencies = [
    "दैनिक (Daily)",
    "साप्ताहिक (Weekly)",
    "पाक्षिक (Fortnightly)",
    "मासिक (Monthly)",
    "त्रैमासिक (Quarterly)",
    "सहामाही (Half-Yearly)",
    "वार्षिक (Yearly)"
];

const LoanApplicationMaster: React.FC = () => {
    const [applications, setApplications] = useState<LoanApplication[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loanRates, setLoanRates] = useState<LoanRate[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleData, setScheduleData] = useState<any[]>([]);
    
    const [formData, setFormData] = useState<Partial<LoanApplication>>({
        applicationNo: "AUTO",
        applicationDate: new Date().toISOString().split('T')[0],
        requestedAmount: 0,
        interestRate: 0,
        durationMonths: 12,
        installmentFrequency: 'मासिक (Monthly)',
        noOfInstallments: 12,
        installmentAmount: 0,
        status: 'Pending'
    });

    useEffect(() => {
        fetchData();
        fetchDropdowns();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get('http://localhost:5238/api/LoanApplications');
            setApplications(res.data);
        } catch (err) {
            console.error(err);
            setError('Failed to fetch applications');
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdowns = async () => {
        try {
            const memRes = await axios.get('http://localhost:5238/api/Members');
            setMembers(memRes.data.filter((m: any) => m.status === 'Active'));

            const ratesRes = await axios.get('http://localhost:5238/api/LoanRates');
            setLoanRates(ratesRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (parseFloat(value) || 0) : value
        }));
    };

    const handleLoanRateChange = (id: number) => {
        const rate = loanRates.find(r => r.loanRateID === id);
        if (rate) {
            setFormData(prev => ({
                ...prev,
                loanRateID: id,
                interestRate: rate.interestRate
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            if (formData.loanApplicationID) {
                await axios.put(\`http://localhost:5238/api/LoanApplications/\${formData.loanApplicationID}\`, formData);
            } else {
                await axios.post('http://localhost:5238/api/LoanApplications', formData);
            }
            // Reset form
            setFormData({
                applicationNo: "AUTO",
                applicationDate: new Date().toISOString().split('T')[0],
                requestedAmount: 0,
                interestRate: 0,
                durationMonths: 12,
                installmentFrequency: 'मासिक (Monthly)',
                noOfInstallments: 12,
                installmentAmount: 0,
                status: 'Pending'
            });
            fetchData();
            alert('Application saved successfully!');
        } catch (err: any) {
            console.error(err);
            const errorData = err.response?.data;
            if (typeof errorData === 'object' && errorData !== null) {
                setError(errorData.title || errorData.message || JSON.stringify(errorData));
            } else {
                setError(errorData || 'An error occurred while saving.');
            }
        }
    };

    const handleEdit = (app: LoanApplication) => {
        setFormData({
            ...app,
            applicationDate: app.applicationDate.split('T')[0],
            firstInstallmentDate: app.firstInstallmentDate ? app.firstInstallmentDate.split('T')[0] : '',
            maturityDate: app.maturityDate ? app.maturityDate.split('T')[0] : ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const calculateSchedule = () => {
        if (!formData.requestedAmount || !formData.interestRate || !formData.noOfInstallments) {
            alert('कृपया कर्ज रक्कम, व्याज दर आणि हप्ते संख्या टाका! (Please enter amount, rate and installments)');
            return;
        }

        const P = formData.requestedAmount;
        const ratePerYear = formData.interestRate;
        const n = formData.noOfInstallments;
        
        let freqDivisor = 12; // Monthly default
        if (formData.installmentFrequency === 'दैनिक (Daily)') freqDivisor = 365;
        else if (formData.installmentFrequency === 'साप्ताहिक (Weekly)') freqDivisor = 52;
        
        const r = (ratePerYear / 100) / freqDivisor;
        let emi = 0;
        let schedule = [];

        if (r === 0) {
            emi = P / n;
            let bal = P;
            for(let i=1; i<=n; i++) {
                bal -= emi;
                schedule.push({ instNo: i, principal: emi, interest: 0, total: emi, balance: Math.max(0, bal) });
            }
        } else {
            emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            let bal = P;
            for(let i=1; i<=n; i++) {
                const interest = bal * r;
                const principal = emi - interest;
                bal -= principal;
                schedule.push({ 
                    instNo: i, 
                    principal: principal, 
                    interest: interest, 
                    total: emi, 
                    balance: Math.max(0, bal) 
                });
            }
        }
        
        setFormData(p => ({ ...p, installmentAmount: Math.round(emi) }));
        setScheduleData(schedule);
        setShowScheduleModal(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this application?')) {
            try {
                await axios.delete(\`http://localhost:5238/api/LoanApplications/\${id}\`);
                fetchData();
            } catch (err) {
                console.error(err);
                setError('Failed to delete application.');
            }
        }
    };

    const memberOptions = members.map(m => ({
        value: m.memberID.toString(),
        label: \`\${m.memberCode} - \${m.firstName} \${m.middleName ? m.middleName + ' ' : ''}\${m.lastName}\`
    }));

    const filteredApps = applications.filter(a => 
        a.applicationNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.member?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.member?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-1 max-w-7xl mx-auto bg-gray-50 min-h-screen font-sans pb-4">
            <div className="mb-2 flex justify-between items-end border-b-2 border-red-600 pb-1">
                <h1 className="text-lg font-bold text-gray-800">Loan Application (कर्ज अर्ज)</h1>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-sm mb-3 text-xs">
                    {error}
                </div>
            )}

            <div className="bg-white p-1.5 rounded-sm shadow-sm border border-gray-200 mb-3">
                <h2 className="text-sm font-bold text-[#005a8d] mb-1 border-b pb-0.5">
                    {formData.loanApplicationID ? 'अर्ज सुधारा (Update Application)' : 'नवीन कर्ज अर्ज (New Loan Application)'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-1.5">
                    
                    {/* Section 1: Basic Info */}
                    <div>
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">प्राथमिक माहिती (Basic Info)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-1.5">
                            {formData.applicationNo && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-0.5">अर्ज क्र. (App No)</label>
                                    <input type="text" disabled value={formData.applicationNo} className="w-full border border-gray-300 bg-gray-100 px-2 py-0.5 rounded-sm text-xs" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">अर्ज दिनांक (Date) *</label>
                                <input type="date" name="applicationDate" value={formData.applicationDate} onChange={handleInputChange} required 
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">सभासद (Member) *</label>
                                <div className="text-xs">
                                <SearchableSelect options={memberOptions} value={formData.memberID?.toString() || ''} 
                                    onChange={(e: any) => setFormData(p => ({ ...p, memberID: parseInt(e.target.value) }))} placeholder="सभासद निवडा..." required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">सह-कर्जदार (Co-Borrower 1)</label>
                                <div className="text-xs">
                                <SearchableSelect options={memberOptions} value={formData.coMemberID?.toString() || ''} 
                                    onChange={(e: any) => setFormData(p => ({ ...p, coMemberID: parseInt(e.target.value) }))} placeholder="सह-कर्जदार निवडा..." />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">सह-कर्जदार २ (Co-Borrower 2)</label>
                                <div className="text-xs">
                                <SearchableSelect options={memberOptions} value={(formData as any).coMember2ID?.toString() || ''} 
                                    onChange={(e: any) => setFormData(p => ({ ...p, coMember2ID: parseInt(e.target.value) }))} placeholder="दुसरा सह-कर्जदार..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-200 my-1.5" />

                    {/* Section 2: Loan Details */}
                    <div>
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">कर्ज माहिती (Loan Details)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-x-3 gap-y-1.5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">कर्ज प्रकार (Loan Type) *</label>
                                <select name="loanRateID" value={formData.loanRateID || ''} onChange={(e) => handleLoanRateChange(parseInt(e.target.value))} required
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs bg-white">
                                    <option value="">-- प्रकार निवडा --</option>
                                    {loanRates.filter(r => r.isActive).map(r => (
                                        <option key={r.loanRateID} value={r.loanRateID}>{r.shortName || r.loanType} ({r.interestRate}%)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">मागणी रक्कम (Requested Amount) *</label>
                                <input type="number" name="requestedAmount" value={formData.requestedAmount || ''} onChange={handleInputChange} required min="0" 
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">व्याज दर (Interest Rate %) *</label>
                                <input type="number" name="interestRate" value={formData.interestRate || ''} onChange={handleInputChange} required step="0.01" 
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">हप्ता प्रकार (Inst. Freq) *</label>
                                <select name="installmentFrequency" value={formData.installmentFrequency} onChange={handleInputChange}
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs bg-white">
                                    {InstallmentFrequencies.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">हप्ते संख्या (No of Inst) *</label>
                                <input type="number" name="noOfInstallments" value={formData.noOfInstallments || ''} onChange={handleInputChange} required min="1" 
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">हप्ता रक्कम (Inst Amount) *</label>
                                <div className="flex gap-1">
                                    <input type="number" name="installmentAmount" value={formData.installmentAmount || ''} onChange={handleInputChange} required min="0" 
                                        className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                                    <button type="button" onClick={calculateSchedule} title="हप्ता पत्रक पहा (View Chart)"
                                        className="bg-purple-600 hover:bg-purple-700 text-white px-2 py-0.5 rounded-sm text-xs font-bold whitespace-nowrap shadow-sm">
                                        📊 पत्रक
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">पहिला हप्ता दि. (First Inst Date)</label>
                                <input type="date" name="firstInstallmentDate" value={formData.firstInstallmentDate ? formData.firstInstallmentDate.split('T')[0] : ''} onChange={handleInputChange} 
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">परतफेड दि. (Maturity Date)</label>
                                <input type="date" name="maturityDate" value={formData.maturityDate ? formData.maturityDate.split('T')[0] : ''} onChange={handleInputChange} 
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">मुदत महिने (Duration) *</label>
                                <input type="number" name="durationMonths" value={formData.durationMonths || ''} onChange={handleInputChange} required min="1" 
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">संचालक शिफारस (Director)</label>
                                <div className="text-xs">
                                <SearchableSelect options={memberOptions} value={formData.recommendedByDirectorID?.toString() || ''} 
                                    onChange={(e: any) => setFormData(p => ({ ...p, recommendedByDirectorID: parseInt(e.target.value) }))} placeholder="शिफारस..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-200 my-1.5" />

                    {/* Section 3: Guarantors & Security */}
                    <div>
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">जामीनदार व तारण (Guarantors & Security)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-1.5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">जामीनदार १ (Guarantor 1)</label>
                                <div className="text-xs">
                                <SearchableSelect options={memberOptions} value={formData.guarantor1MemberID?.toString() || ''} 
                                    onChange={(e: any) => setFormData(p => ({ ...p, guarantor1MemberID: parseInt(e.target.value) }))} placeholder="जामीनदार निवडा..." />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">जामीनदार २ (Guarantor 2)</label>
                                <div className="text-xs">
                                <SearchableSelect options={memberOptions} value={formData.guarantor2MemberID?.toString() || ''} 
                                    onChange={(e: any) => setFormData(p => ({ ...p, guarantor2MemberID: parseInt(e.target.value) }))} placeholder="जामीनदार निवडा..." />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">तारण तपशील (Security Details)</label>
                                <input type="text" name="securityDetails" value={formData.securityDetails || ''} onChange={handleInputChange}
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-3 gap-y-1.5 mt-1.5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">तारण मूल्य (Security Value)</label>
                                <input type="number" name="securityValue" value={formData.securityValue || ''} onChange={handleInputChange} min="0"
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">कर्जाचे कारण (Purpose)</label>
                                <input type="text" name="purpose" value={formData.purpose || ''} onChange={handleInputChange}
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-0.5">अर्जाची स्थिती (Status)</label>
                                <select name="status" value={formData.status} onChange={handleInputChange}
                                    className="w-full border border-gray-300 px-2 py-0.5 rounded-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-xs bg-white">
                                    <option value="Pending">Pending (प्रलंबित)</option>
                                    <option value="Approved">Approved (मंजूर)</option>
                                    <option value="Rejected">Rejected (नामंजूर)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 mt-1.5">
                        {formData.loanApplicationID && (
                            <button type="button" onClick={() => {
                                setFormData({
                                    applicationDate: new Date().toISOString().split('T')[0],
                                    requestedAmount: 0,
                                    interestRate: 0,
                                    durationMonths: 12,
                                    installmentFrequency: 'Monthly',
                                    status: 'Pending'
                                });
                            }} className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-1 rounded-sm font-medium shadow-sm transition-colors text-xs">
                                रद्द करा (Cancel)
                            </button>
                        )}
                        <button type="submit" className="bg-[#005a8d] hover:bg-[#004a75] text-white px-6 py-1 rounded-sm font-medium shadow-sm transition-colors text-xs">
                            {formData.loanApplicationID ? 'अपडेट करा (Update)' : 'सेव्ह करा (Save)'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="mt-3">
                <div className="bg-white p-2 rounded-sm shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <div className="relative w-1/3">
                            <input type="text" placeholder="अर्ज क्र. किंवा नाव शोधा..." className="w-full border border-gray-300 px-2 py-0.5 pl-6 rounded-sm text-xs focus:outline-none focus:border-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            <Search className="w-3 h-3 text-gray-400 absolute left-1.5 top-1" />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-100 text-gray-700 text-xs uppercase tracking-wider">
                                    <th className="p-1.5 border">अर्ज क्र. (App No)</th>
                                    <th className="p-1.5 border">दिनांक (Date)</th>
                                    <th className="p-1.5 border">सभासद (Member)</th>
                                    <th className="p-1.5 border">कर्ज प्रकार (Loan Type)</th>
                                    <th className="p-1.5 border">रक्कम (Amount)</th>
                                    <th className="p-1.5 border text-center">स्थिती (Status)</th>
                                    <th className="p-1.5 border text-center w-20">कृती (Action)</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs text-gray-800">
                                {loading ? (
                                    <tr><td colSpan={7} className="text-center p-2">Loading...</td></tr>
                                ) : filteredApps.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center p-2 text-gray-500">माहिती उपलब्ध नाही.</td></tr>
                                ) : (
                                    filteredApps.map(app => (
                                        <tr key={app.loanApplicationID} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="p-1.5 border font-medium text-gray-900">{app.applicationNo}</td>
                                            <td className="p-1.5 border">{new Date(app.applicationDate).toLocaleDateString('en-GB')}</td>
                                            <td className="p-1.5 border font-semibold">{app.member?.firstName} {app.member?.lastName}</td>
                                            <td className="p-1.5 border">{app.loanRate?.shortName || app.loanRate?.loanType}</td>
                                            <td className="p-1.5 border font-bold text-green-700">₹{app.requestedAmount.toFixed(2)}</td>
                                            <td className="p-1.5 border text-center">
                                                <span className={\`px-1.5 py-0.5 rounded-sm font-semibold \${
                                                    app.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                                    app.status === 'Approved' ? 'bg-green-100 text-green-800 border border-green-200' :
                                                    'bg-red-100 text-red-800 border border-red-200'
                                                }\`}>
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="p-1.5 border text-center">
                                                <button onClick={() => handleEdit(app)} className="text-blue-600 hover:text-blue-900 mx-1" title="Edit">
                                                    <Edit className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDelete(app.loanApplicationID)} className="text-red-600 hover:text-red-900 mx-1" title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Installment Schedule Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-md shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-3 border-b bg-gray-50 rounded-t-md">
                            <h2 className="text-lg font-bold text-gray-800">हप्ता पत्रक (Installment Schedule)</h2>
                            <button onClick={() => setShowScheduleModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-3 overflow-y-auto flex-grow">
                            <div className="mb-3 grid grid-cols-3 gap-2 text-sm bg-blue-50 p-2 rounded-sm border border-blue-200">
                                <div><span className="text-gray-600">कर्ज रक्कम:</span> <strong>₹{formData.requestedAmount}</strong></div>
                                <div><span className="text-gray-600">व्याज दर:</span> <strong>{formData.interestRate}%</strong></div>
                                <div><span className="text-gray-600">हप्ता:</span> <strong className="text-green-700">₹{formData.installmentAmount}</strong></div>
                            </div>
                            <table className="w-full text-center border-collapse text-xs">
                                <thead>
                                    <tr className="bg-gray-200 text-gray-700">
                                        <th className="p-1.5 border border-gray-300">हप्ता क्र.</th>
                                        <th className="p-1.5 border border-gray-300">मुद्दल (Principal)</th>
                                        <th className="p-1.5 border border-gray-300">व्याज (Interest)</th>
                                        <th className="p-1.5 border border-gray-300">एकूण हप्ता (Total)</th>
                                        <th className="p-1.5 border border-gray-300">बाकी (Balance)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scheduleData.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 border-b border-gray-200">
                                            <td className="p-1.5 border-r border-gray-300 font-bold">{row.instNo}</td>
                                            <td className="p-1.5 border-r border-gray-300">₹{Math.round(row.principal)}</td>
                                            <td className="p-1.5 border-r border-gray-300 text-red-600">₹{Math.round(row.interest)}</td>
                                            <td className="p-1.5 border-r border-gray-300 font-bold text-green-700">₹{Math.round(row.total)}</td>
                                            <td className="p-1.5">₹{Math.round(row.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-3 border-t flex justify-end bg-gray-50 rounded-b-md">
                            <button type="button" onClick={() => setShowScheduleModal(false)} className="bg-gray-600 text-white px-4 py-1.5 rounded-sm text-sm font-bold hover:bg-gray-700">
                                बंद करा (Close)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoanApplicationMaster;
`;

fs.writeFileSync(path.join(__dirname, 'client', 'src', 'components', 'LoanApplicationMaster.tsx'), content);
console.log('File written successfully.');
